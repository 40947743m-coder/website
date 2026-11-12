/* ============================================================
   ST. TERESA ACADEMY — PROCUREMENT · STORE · KITCHEN · UNIFORMS
   Centralized inventory engine, transfers, audit and reporting
   Loaded AFTER admin.js + modules.js + portals.js
   ============================================================ */

const DEPTS = {
  store: { label: 'Main Store', icon: 'fa-warehouse', color: 'navy' },
  kitchen: { label: 'Kitchen Department', icon: 'fa-fire-burner', color: 'gold' },
  junior_uniform: { label: "Junior School Uniforms", icon: 'fa-shirt', color: 'info' },
  academy_uniform: { label: 'Academy School Uniforms', icon: 'fa-user-tie', color: 'success' }
};
const UNIFORM_DEPTS = ['junior_uniform', 'academy_uniform'];
const UNIFORM_ITEM_TYPES = ['Shirts', 'Shorts', 'Skirts', 'Sweaters', 'Socks', 'Ties', 'Tracksuits', 'Shoes', 'Other'];
const STOCK_UNITS = ['pieces', 'packets', 'kilograms', 'litres', 'bags', 'boxes', 'rolls', 'units'];

/* AUTOMATIC STOCK STATUS — derived only from the available quantity.
   0–9   → Low stock      10–20 → Normal stock      21+ → Active
   Users can never set this by hand; it recalculates on every movement. */
const STOCK_STATUS_LOW_BELOW = 10;      // quantities 0–9 are "low"
const STOCK_STATUS_NORMAL_UP_TO = 20;   // quantities 10–20 are "normal"; 21+ are "active"

const Inventory = {
  /* ---------- STORES ---------- */
  items() { return DB.get('invItems'); },
  movements() { return DB.get('invMovements'); },
  transfers() { return DB.get('invTransfers'); },
  requests() { return DB.get('invRequests'); },
  suppliers() { return DB.get('invSuppliers'); },
  orders() { return DB.get('invOrders'); },

  nextRef(prefix, counterKey) {
    const c = DB.get('invCounters', {});
    c[counterKey] = (c[counterKey] || 0) + 1;
    DB.set('invCounters', c);
    return prefix + '-' + new Date().getFullYear() + '-' + String(c[counterKey]).padStart(4, '0');
  },
  itemCodeFor(dept) {
    const prefix = { store: 'STO', kitchen: 'KIT', junior_uniform: 'JUN', academy_uniform: 'ACA' }[dept] || 'ITM';
    return this.nextRef(prefix, 'code_' + dept);
  },

  itemsFor(dept, includeArchived) {
    return this.items().filter(i => i.dept === dept && (includeArchived ? true : !i.archived));
  },
  getItem(id) { return this.items().find(i => i.id === id); },

  /* ---------- AUTOMATIC STOCK STATUS ----------
     Quantity-driven only — recalculated from i.balance everywhere it is shown. */
  statusFor(balance) {
    const b = Number(balance || 0);
    if (b < STOCK_STATUS_LOW_BELOW) return { code: 'low', label: 'Low stock', qtyTag: 'Low', badge: 'danger' };
    if (b <= STOCK_STATUS_NORMAL_UP_TO) return { code: 'normal', label: 'Normal stock', qtyTag: '', badge: 'warning' };
    return { code: 'active', label: 'Active', qtyTag: '', badge: 'success' };
  },
  lowStock(dept) {
    return this.itemsFor(dept).filter(i => this.statusFor(i.balance).code === 'low');
  },

  /* ============================================================
     STOCK ENGINE — single write path for every balance change.
     Validates the resulting balance, records prev/new balance,
     responsible user and receiver, then commits everything at once
     so a failed transaction can never leave stock half-updated.
     ============================================================ */
  applyMovement(opts) {
    const s = Auth.session();
    if (!s) return { ok: false, error: 'Not signed in.' };
    const dept = opts.dept;
    // cross-department engine writes: a Kitchen Manager confirming a store delivery, or a
    // Storekeeper issuing stock to the Kitchen, may move stock in the other department.
    const crossDept = !!opts.allowTransfer && (Perm.canSendStoreTransfer() || Perm.canConfirmKitchenReceipt());
    if (!Perm.canManageInventory(dept) && !(opts.allowKitchenReceipt && Perm.canConfirmKitchenReceipt()) && !crossDept)
      return { ok: false, error: 'You are not authorized to change stock for ' + (DEPTS[dept] || {}).label + '.' };

    const items = this.items();
    const idx = items.findIndex(i => i.id === opts.itemId);
    if (idx === -1) return { ok: false, error: 'Item not found.' };
    const item = items[idx];
    if (item.dept !== dept) return { ok: false, error: 'Item belongs to a different department.' };
    if (item.archived && opts.type !== 'receipt') return { ok: false, error: 'This item is archived. Restore it before recording transactions.' };

    const qtyIn = Number(opts.qtyIn || 0);
    const qtyOut = Number(opts.qtyOut || 0);
    if (qtyIn < 0 || qtyOut < 0) return { ok: false, error: 'Quantities cannot be negative.' };
    if (qtyIn === 0 && qtyOut === 0) return { ok: false, error: 'Enter a quantity.' };

    const prev = Number(item.balance || 0);
    const next = prev + qtyIn - qtyOut;
    if (next < 0) return { ok: false, error: 'Insufficient stock for ' + item.name + ': available ' + prev + ', requested ' + qtyOut + '.' };
    if (opts.type !== 'receipt' && prev < qtyOut) return { ok: false, error: 'Stock would go negative — transaction blocked.' };

    // commit item + movement together
    item.balance = next;
    item.qtyReceived = Number(item.qtyReceived || 0) + qtyIn;
    item.qtyIssued = Number(item.qtyIssued || 0) + qtyOut;
    if (opts.type === 'receipt' && opts.expiryDate) item.expiryDate = opts.expiryDate;
    items[idx] = item;

    const mv = {
      id: DB.uid(),
      ref: opts.ref || this.nextRef('MOV', 'mov'),
      itemId: item.id, itemCode: item.code, itemName: item.name,
      dept, type: opts.type,
      qtyIn, qtyOut, prevBalance: prev, newBalance: next,
      at: new Date().toISOString(),
      byId: s.id, byName: s.name,
      receiverId: opts.receiverId || '', receiverName: opts.receiverName || '',
      reason: opts.reason || '', notes: opts.notes || '',
      transferRef: opts.transferRef || ''
    };
    const mvs = this.movements();
    // duplicate-transaction guard: identical movement within 5 seconds
    const dup = mvs.find(m => m.itemId === mv.itemId && m.type === mv.type && m.qtyIn === mv.qtyIn &&
      m.qtyOut === mv.qtyOut && m.byId === mv.byId && (Date.now() - new Date(m.at).getTime()) < 5000);
    if (dup) return { ok: false, error: 'Duplicate transaction blocked (' + dup.ref + ').' };
    mvs.push(mv);

    DB.set('invItems', items);
    DB.set('invMovements', mvs);
    Audit.log('inventory.' + opts.type, item.code + ' ' + item.name + ' [' + dept + '] in:' + qtyIn + ' out:' + qtyOut + ' balance ' + prev + '→' + next + (opts.reason ? ' — ' + opts.reason : ''));
    return { ok: true, movement: mv, balance: next };
  },

  /* ---------- ITEM CRUD ---------- */
  saveItem(dept, data, id) {
    if (!Perm.canManageInventory(dept)) return { ok: false, error: 'You are not authorized to manage ' + (DEPTS[dept] || {}).label + ' items.' };
    if (!data.name || !data.name.trim()) return { ok: false, error: 'Item name is required.' };
    const list = this.items();
    const dup = list.find(i => i.dept === dept && i.name.trim().toLowerCase() === data.name.trim().toLowerCase() &&
      (data.clothingSize || '') === (i.clothingSize || '') && (data.shoeSize || '') === (i.shoeSize || '') && i.id !== id);
    if (dup) return { ok: false, error: 'An identical item (including size) already exists in this department.' };
    const rec = {
      id: id || DB.uid(),
      code: id ? (data.code || '') : (data.code || this.itemCodeFor(dept)),
      dept,
      name: data.name.trim(),
      description: data.description || '',
      category: data.category || 'General',
      itemType: data.itemType || '',
      unit: data.unit || 'pieces',
      minLevel: Number(data.minLevel) || 0,
      reorderLevel: Number(data.reorderLevel || data.minLevel) || 0,
      supplierId: data.supplierId || '',
      supplierName: data.supplierName || '',
      purchasePrice: Number(data.purchasePrice) || 0,
      sellingPrice: Number(data.sellingPrice) || 0,
      location: data.location || '',
      color: data.color || '',
      clothingSize: data.clothingSize || '',
      shoeSize: data.shoeSize || '',
      expiryDate: data.expiryDate || '',
      batchNo: data.batchNo || '',
      archived: id ? !!data.archived : false,
      addedAt: id ? (data.addedAt || today()) : today(),
      updatedAt: today()
    };
    const openQty = id ? 0 : (Number(data.openingQty) || 0);
    if (id) {
      const i = list.findIndex(x => x.id === id);
      if (i === -1) return { ok: false, error: 'Item not found.' };
      rec.balance = list[i].balance; rec.qtyReceived = list[i].qtyReceived; rec.qtyIssued = list[i].qtyIssued;
      list[i] = rec;
    } else {
      // opening stock is posted through the movement engine below (single write path)
      rec.balance = 0; rec.qtyReceived = 0; rec.qtyIssued = 0;
      list.push(rec);
    }
    DB.set('invItems', list);
    if (!id && openQty > 0) {
      this.applyMovement({ dept, itemId: rec.id, type: 'receipt', qtyIn: openQty, qtyOut: 0, reason: 'Opening stock on item creation', notes: 'Item created' });
    }
    Audit.log(id ? 'inventory.item.update' : 'inventory.item.create', rec.code + ' ' + rec.name + ' [' + dept + ']');
    return { ok: true, item: rec };
  },
  archiveItem(dept, id) {
    if (!Perm.canManageInventory(dept)) return { ok: false, error: 'Permission denied.' };
    const list = this.items();
    const i = list.findIndex(x => x.id === id);
    if (i === -1) return { ok: false, error: 'Item not found.' };
    list[i].archived = true;
    list[i].updatedAt = today();
    DB.set('invItems', list);
    Audit.log('inventory.item.archive', list[i].code + ' ' + list[i].name);
    return { ok: true };
  },
  restoreItem(dept, id) {
    if (!Perm.canManageInventory(dept)) return { ok: false, error: 'Permission denied.' };
    const list = this.items();
    const i = list.findIndex(x => x.id === id);
    if (i === -1) return { ok: false, error: 'Item not found.' };
    list[i].archived = false;
    DB.set('invItems', list);
    Audit.log('inventory.item.restore', list[i].code + ' ' + list[i].name);
    return { ok: true };
  },
  removeItem(dept, id) {
    if (!Perm.canManageInventory(dept)) return { ok: false, error: 'Permission denied.' };
    const it = this.getItem(id);
    if (!it) return { ok: false, error: 'Item not found.' };
    const hasTx = this.movements().some(m => m.itemId === id) || Number(it.balance) !== 0;
    if (hasTx) return { ok: false, error: 'This item has recorded transactions or a stock balance. Items with a history must be archived instead of deleted.' };
    DB.set('invItems', this.items().filter(x => x.id !== id));
    Audit.log('inventory.item.delete', it.code + ' ' + it.name);
    return { ok: true };
  },

  /* ---------- SIMPLE STOCK OPS ---------- */
  receive(dept, itemId, qty, meta) {
    return this.applyMovement({ dept, itemId, type: 'receipt', qtyIn: qty, qtyOut: 0, ...meta });
  },
  issue(dept, itemId, qty, meta) {
    return this.applyMovement({ dept, itemId, type: 'issue', qtyIn: 0, qtyOut: qty, ...meta });
  },
  adjust(dept, itemId, delta, reason) {
    if (!reason || !reason.trim()) return { ok: false, error: 'A reason is required for stock adjustments.' };
    if (!delta) return { ok: false, error: 'Enter a non-zero adjustment.' };
    return this.applyMovement({
      dept, itemId, type: 'adjustment',
      qtyIn: delta > 0 ? delta : 0, qtyOut: delta < 0 ? Math.abs(delta) : 0,
      reason: reason.trim(), notes: 'Manual stock adjustment'
    });
  },
  recordDamaged(dept, itemId, qty, reason) {
    return this.applyMovement({ dept, itemId, type: 'damaged', qtyIn: 0, qtyOut: qty, reason: reason || 'Damaged / expired', notes: 'Damaged or expired stock write-off' });
  },

  /* ============================================================
     STORE → KITCHEN TRANSFER  (never auto-received)
     ============================================================ */
  createTransfer(lines, notes) {
    if (!Perm.canSendStoreTransfer()) return { ok: false, error: 'Only the Store Manager can send stock to the Kitchen.' };
    if (!lines || !lines.length) return { ok: false, error: 'Select at least one item to transfer.' };
    const clean = [];
    for (const l of lines) {
      const item = this.getItem(l.itemId);
      if (!item) return { ok: false, error: 'One of the selected items no longer exists.' };
      if (item.dept !== 'store') return { ok: false, error: item.name + ' is not a Main Store item.' };
      const qty = Number(l.qty);
      if (!(qty > 0)) return { ok: false, error: 'Enter a valid quantity for ' + item.name + '.' };
      if (qty > Number(item.balance)) return { ok: false, error: 'Cannot transfer ' + qty + ' of ' + item.name + ' — only ' + item.balance + ' available.' };
      clean.push({ itemId: item.id, code: item.code, name: item.name, unit: item.unit, sent: qty, received: '', discrepancyReason: '' });
    }
    const s = Auth.session();
    const ref = this.nextRef('TRF', 'trf');
    const tr = {
      id: DB.uid(), ref, fromDept: 'store', toDept: 'kitchen',
      lines: clean, status: 'pending',
      notes: notes || '', sentAt: new Date().toISOString(), sentById: s.id, sentByName: s.name,
      notifiedAt: new Date().toISOString(),
      receivedAt: '', receivedById: '', receivedByName: '', receiverFirstName: '', receiveNote: ''
    };
    const list = this.transfers();
    list.push(tr);
    DB.set('invTransfers', list);
    DB.get('users').filter(u => u.role === 'kitchenmanager').forEach(u =>
      Notifications.send(u.id, 'kitchenmanager', 'Stock Transfer Awaiting Receipt (' + ref + ')',
        s.name + ' sent ' + clean.length + ' item line(s) to the Kitchen. Review the delivery and click Confirm Receipt. No stock moves until you confirm.', 'info'));
    Audit.log('inventory.transfer.create', ref + ' store→kitchen, ' + clean.length + ' line(s), ' + (notes ? 'notes: ' + notes : 'no notes'));
    return { ok: true, transfer: tr };
  },
  getTransfer(refOrId) { return this.transfers().find(t => t.id === refOrId || t.ref === refOrId); },

  /* Kitchen manager confirms — authenticated identity is authoritative */
  confirmTransfer(refOrId, receiverFirstName, receivedLines, note) {
    if (!Perm.canConfirmKitchenReceipt()) return { ok: false, error: 'Only the Kitchen Manager can confirm receipt of kitchen transfers.' };
    const s = Auth.session();
    if (!s || s.role !== 'kitchenmanager') return { ok: false, error: 'Authenticated Kitchen Manager account required.' };
    const tr = this.getTransfer(refOrId);
    if (!tr) return { ok: false, error: 'Transfer not found.' };
    if (tr.status !== 'pending') return { ok: false, error: 'Transfer ' + tr.ref + ' has already been ' + tr.status + '. It cannot be confirmed twice.' };
    if (!receiverFirstName || !receiverFirstName.trim()) return { ok: false, error: 'Type your first name as an additional acknowledgment.' };

    const lines = [];
    for (const sent of tr.lines) {
      const r = receivedLines.find(x => x.itemId === sent.itemId);
      const recv = r ? Number(r.received) : 0;
      if (recv < 0 || isNaN(recv)) return { ok: false, error: 'Invalid received quantity for ' + sent.name + '.' };
      if (recv > Number(sent.sent)) return { ok: false, error: 'Received quantity for ' + sent.name + ' cannot exceed the quantity sent (' + sent.sent + ').' };
      const diff = Number(sent.sent) - recv;
      lines.push({ ...sent, received: recv, diff, discrepancyReason: diff > 0 ? ((r && r.reason) || '') : '' });
      if (diff > 0 && !((r && r.reason) || '').trim())
        return { ok: false, error: 'A discrepancy explanation is required for ' + sent.name + ' (sent ' + sent.sent + ', received ' + recv + ').' };
    }

    // ---- atomic commit: deduct store, credit kitchen, one movement per line ----
    const results = [];
    for (const line of lines) {
      const out = this.applyMovement({ dept: 'store', itemId: line.itemId, type: 'transfer_out', qtyIn: 0, qtyOut: Number(line.sent), transferRef: tr.ref, reason: 'Transfer to Kitchen Department', notes: 'Received ' + line.received + (line.diff ? ' (short by ' + line.diff + ')' : ''), allowTransfer: true });
      if (!out.ok) {
        // roll back anything already applied in this loop
        results.forEach(bk => this.applyMovement({ dept: 'store', itemId: bk.itemId, type: 'adjustment', qtyIn: bk.qty, qtyOut: 0, reason: 'Rollback of failed transfer ' + tr.ref, notes: 'Automatic rollback — transfer did not complete', allowTransfer: true }));
        return { ok: false, error: 'Transfer failed and was rolled back: ' + out.error };
      }
      results.push({ itemId: line.itemId, qty: Number(line.sent) });
      if (Number(line.received) > 0) {
        // create/locate the matching kitchen item (separate balance) and credit it
        let kIt = this.itemsFor('kitchen').find(k => k.transferSourceId === line.itemId && k.name === line.name);
        if (!kIt) {
          const created = this.saveItem('kitchen', {
            name: line.name, code: '', description: 'Received from Main Store via ' + tr.ref,
            category: 'Transferred from Store', unit: line.unit, minLevel: 0, openingQty: 0
          });
          if (!created.ok) return { ok: false, error: created.error };
          kIt = created.item;
          const kl = this.items();
          const ki = kl.findIndex(x => x.id === kIt.id);
          if (ki > -1) { kl[ki].transferSourceId = line.itemId; DB.set('invItems', kl); }
          kIt = this.getItem(kIt.id);
        }
        const cred = this.applyMovement({ dept: 'kitchen', itemId: kIt.id, type: 'transfer_in', qtyIn: Number(line.received), qtyOut: 0, transferRef: tr.ref, receiverId: s.id, receiverName: s.name, reason: 'Received from Main Store', notes: line.diff ? 'Discrepancy: ' + line.discrepancyReason : '' });
        if (!cred.ok) return { ok: false, error: 'Kitchen credit failed: ' + cred.error };
      }
    }

    tr.lines = lines;
    tr.status = lines.some(l => l.diff > 0) ? 'partially_received' : 'received';
    tr.receivedAt = new Date().toISOString();
    tr.receivedById = s.id;
    tr.receivedByName = s.name;
    tr.receiverFirstName = receiverFirstName.trim();
    tr.receiveNote = note || '';
    const tl = this.transfers();
    const ti = tl.findIndex(t => t.id === tr.id);
    if (ti > -1) tl[ti] = tr;
    DB.set('invTransfers', tl);

    DB.get('users').filter(u => u.role === 'storekeeper').forEach(u =>
      Notifications.send(u.id, 'storekeeper', 'Transfer Receipt Confirmed (' + tr.ref + ')',
        'Kitchen Manager ' + s.name + ' confirmed receipt of transfer ' + tr.ref + '.' +
        lines.filter(l => l.diff > 0).length + ' line(s) had discrepancies.', 'success'));
    Audit.log('inventory.transfer.confirm', tr.ref + ' confirmed by ' + s.name + ' (acknowledged as "' + receiverFirstName.trim() + '"), status ' + tr.status);
    return { ok: true, transfer: tr };
  },

  /* Kitchen → Store request */
  createRequest(lines, notes) {
    if (!Perm.canManageInventory('kitchen')) return { ok: false, error: 'Only Kitchen staff can request stock.' };
    if (!lines || !lines.length) return { ok: false, error: 'Select at least one item.' };
    const s = Auth.session();
    const ref = this.nextRef('REQ', 'req');
    const req = {
      id: DB.uid(), ref, fromDept: 'kitchen', toDept: 'store',
      lines: lines.map(l => ({ itemId: l.itemId, name: l.name, qty: Number(l.qty) || 0, note: l.note || '' })),
      status: 'pending', notes: notes || '', requestedAt: new Date().toISOString(), requestedById: s.id, requestedByName: s.name
    };
    const list = this.requests();
    list.push(req);
    DB.set('invRequests', list);
    DB.get('users').filter(u => u.role === 'storekeeper').forEach(u =>
      Notifications.send(u.id, 'storekeeper', 'Kitchen Stock Request (' + ref + ')',
        s.name + ' requested ' + req.lines.length + ' item line(s) from the Main Store.', 'info'));
    Audit.log('inventory.request.create', ref + ' kitchen→store');
    return { ok: true, request: req };
  },

  /* ============================================================
     PROCUREMENT
     ============================================================ */
  saveSupplier(data, id) {
    if (!Perm.canProcure()) return { ok: false, error: 'Only procurement staff can manage suppliers.' };
    if (!data.name || !data.name.trim()) return { ok: false, error: 'Supplier name is required.' };
    const list = this.suppliers();
    if (id) {
      const i = list.findIndex(s => s.id === id);
      if (i === -1) return { ok: false, error: 'Supplier not found.' };
      list[i] = { ...list[i], ...data, updatedAt: today() };
    } else list.push({ id: DB.uid(), name: data.name.trim(), contact: data.contact || '', phone: data.phone || '', email: data.email || '', address: data.address || '', createdAt: today() });
    DB.set('invSuppliers', list);
    Audit.log(id ? 'procurement.supplier.update' : 'procurement.supplier.create', data.name);
    return { ok: true };
  },
  saveOrder(data, id) {
    if (!Perm.canProcure()) return { ok: false, error: 'Only procurement staff can raise purchase orders.' };
    if (!data.supplierId) return { ok: false, error: 'Select a supplier.' };
    if (!data.lines || !data.lines.length) return { ok: false, error: 'Add at least one item line.' };
    const sup = this.suppliers().find(s => s.id === data.supplierId);
    if (!sup) return { ok: false, error: 'Supplier not found.' };
    const lines = data.lines.map(l => ({
      name: l.name, description: l.description || '', qty: Number(l.qty) || 0,
      unitPrice: Number(l.unitPrice) || 0, total: (Number(l.qty) || 0) * (Number(l.unitPrice) || 0)
    })).filter(l => l.name && l.qty > 0);
    if (!lines.length) return { ok: false, error: 'Each line needs an item and a quantity.' };
    const s = Auth.session();
    const rec = {
      id: id || DB.uid(),
      ref: id ? data.ref : this.nextRef('PO', 'po'),
      type: data.type || 'purchase_order',
      supplierId: sup.id, supplierName: sup.name,
      lines,
      total: lines.reduce((a, b) => a + b.total, 0),
      orderDate: data.orderDate || today(),
      deliveryDate: data.deliveryDate || '',
      invoiceNo: data.invoiceNo || '',
      status: data.status || 'pending',
      notes: data.notes || '',
      attachments: data.attachments || [],
      deliveries: data.deliveries || [],
      createdById: s.id, createdByName: s.name,
      updatedAt: new Date().toISOString()
    };
    if (!id) rec.createdAt = new Date().toISOString();
    const list = this.orders();
    if (id) {
      const i = list.findIndex(o => o.id === id);
      if (i === -1) return { ok: false, error: 'Order not found.' };
      list[i] = rec;
    } else list.push(rec);
    DB.set('invOrders', list);
    Audit.log(id ? 'procurement.order.update' : 'procurement.order.create', rec.ref + ' · ' + sup.name + ' · ' + rec.lines.length + ' line(s) · ' + rec.total);
    return { ok: true, order: rec };
  },
  setOrderStatus(id, status, comment) {
    const allowed = ['pending', 'approved', 'ordered', 'partially_received', 'fully_received', 'rejected'];
    if (!allowed.includes(status)) return { ok: false, error: 'Invalid status.' };
    if (!Perm.canProcure()) return { ok: false, error: 'Permission denied.' };
    const list = this.orders();
    const i = list.findIndex(o => o.id === id);
    if (i === -1) return { ok: false, error: 'Order not found.' };
    const s = Auth.session();
    list[i].status = status;
    list[i].approval = { status, byId: s.id, byName: s.name, at: new Date().toISOString(), comment: comment || '' };
    DB.set('invOrders', list);
    Audit.log('procurement.order.' + status, list[i].ref + (comment ? ' — ' + comment : ''));
    return { ok: true, order: list[i] };
  },
  receiveOrder(id, receivedLines, note) {
    if (!Perm.canProcure()) return { ok: false, error: 'Permission denied.' };
    const order = this.orders().find(o => o.id === id);
    if (!order) return { ok: false, error: 'Order not found.' };
    if (['fully_received', 'rejected'].includes(order.status)) return { ok: false, error: 'This order is already ' + order.status + '.' };
    const s = Auth.session();
    let anyReceived = 0;
    const deliveries = order.deliveries || [];
    for (const sent of order.lines) {
      const r = receivedLines.find(x => x.name === sent.name);
      const qty = r ? Number(r.qty) || 0 : 0;
      const problem = r ? (r.problem || '') : '';
      if (qty < 0) return { ok: false, error: 'Invalid quantity for ' + sent.name + '.' };
      if (qty > sent.qty) return { ok: false, error: 'Received quantity for ' + sent.name + ' exceeds the ordered quantity.' };
      if (qty === 0 && !problem) continue;
      deliveries.push({ name: sent.name, qty, problem, note: note || '', at: new Date().toISOString(), byName: s.name });
      anyReceived += qty;
    }
    if (!anyReceived && !deliveries.some(d => d.note === note && d.at)) return { ok: false, error: 'Enter the quantities received.' };
    const list = this.orders();
    const i = list.findIndex(o => o.id === id);
    list[i].deliveries = deliveries;
    const totalOrdered = order.lines.reduce((a, b) => a + b.qty, 0);
    const totalReceived = deliveries.reduce((a, b) => a + Number(b.qty || 0), 0);
    list[i].status = totalReceived >= totalOrdered ? 'fully_received' : 'partially_received';
    list[i].updatedAt = new Date().toISOString();
    DB.set('invOrders', list);
    Audit.log('procurement.order.receive', order.ref + ' received ' + totalReceived + '/' + totalOrdered + ' → ' + list[i].status);
    return { ok: true, order: list[i] };
  },

  /* ============================================================
     REPORTING
     ============================================================ */
  filterMovements(f) {
    f = f || {};
    let m = this.movements().slice().reverse();
    if (f.dept) m = m.filter(x => x.dept === f.dept);
    if (f.type) m = m.filter(x => x.type === f.type);
    if (f.itemId) m = m.filter(x => x.itemId === f.itemId);
    if (f.from) m = m.filter(x => String(x.at).slice(0, 10) >= f.from);
    if (f.to) m = m.filter(x => String(x.at).slice(0, 10) <= f.to);
    if (f.userId) m = m.filter(x => x.byId === f.userId);
    if (f.search) { const q = f.search.toLowerCase(); m = m.filter(x => (x.itemName + ' ' + x.itemCode + ' ' + (x.ref || '')).toLowerCase().includes(q)); }
    return m;
  },
  reportRows(kind, dept, f) {
    const mv = this.filterMovements(Object.assign({}, f, { dept: dept || f.dept }));
    switch (kind) {
      case 'balance': {
        const items = this.itemsFor(dept || f.dept, true);
        return items.map(i => [i.code, i.name, i.category, i.unit, i.balance, this.statusFor(i.balance).label, i.location || '', i.expiryDate || '', i.archived ? 'Archived' : 'Current']);
      }
      case 'received': return mv.filter(m => m.type === 'receipt').map(m => [m.ref, fmtDate(m.at), m.itemCode, m.itemName, m.qtyIn, m.byName, m.reason]);
      case 'issued': return mv.filter(m => ['issue', 'damaged'].includes(m.type)).map(m => [m.ref, fmtDate(m.at), m.itemCode, m.itemName, m.qtyOut, m.type, m.byName, m.reason]);
      case 'transfers': return this.transfers().filter(t => !dept || t.fromDept === dept || t.toDept === dept).slice().reverse().map(t => [t.ref, fmtDate(t.sentAt), DEPTS[t.fromDept].label, DEPTS[t.toDept].label, t.lines.length, t.status, t.sentByName, t.receivedByName || '—']);
      case 'pending_transfers': return this.transfers().filter(t => t.status === 'pending').map(t => [t.ref, fmtDate(t.sentAt), t.lines.length, t.sentByName, 'Awaiting Kitchen confirmation']);
      case 'low': return this.lowStock(dept).map(i => [i.code, i.name, i.balance, this.statusFor(i.balance).label, i.unit]);
      case 'damaged': return mv.filter(m => m.type === 'damaged').map(m => [m.ref, fmtDate(m.at), m.itemCode, m.itemName, m.qtyOut, m.byName, m.reason]);
      case 'movement': return mv.map(m => [m.ref, fmtDate(m.at), m.itemCode, m.itemName, DEPTS[m.dept].label, m.type, m.qtyIn, m.qtyOut, m.prevBalance, m.newBalance, m.byName, m.receiverName || '', m.reason || '']);
      case 'uniform': {
        const items = this.itemsFor(dept, true);
        return items.map(i => [i.code, i.name, i.itemType || '', i.category, i.color || '', i.clothingSize || '', i.shoeSize || '', i.balance, this.statusFor(i.balance).label, i.supplierName || '', i.purchasePrice || 0, i.sellingPrice || 0]);
      }
      case 'suppliers': return this.suppliers().map(su => [su.name, su.contact, su.phone, su.email, this.orders().filter(o => o.supplierId === su.id).length]);
      case 'procurement': return this.orders().slice().reverse().map(o => [o.ref, o.supplierName, o.lines.length, o.total, o.orderDate, o.deliveryDate || '—', o.invoiceNo || '—', o.status]);
      default: return [];
    }
  },
  reportHeaders(kind) {
    switch (kind) {
      case 'balance': return ['Item Code', 'Item Name', 'Category', 'Unit', 'Available Balance', 'Stock Status', 'Location', 'Expiry', 'Record State'];
      case 'received': return ['Reference', 'Date', 'Item Code', 'Item Name', 'Quantity In', 'Received By', 'Reason'];
      case 'issued': return ['Reference', 'Date', 'Item Code', 'Item Name', 'Quantity Out', 'Type', 'Issued By', 'Reason'];
      case 'transfers': return ['Transfer Ref', 'Date', 'From', 'To', 'Lines', 'Status', 'Sent By', 'Received By'];
      case 'pending_transfers': return ['Transfer Ref', 'Date', 'Lines', 'Sent By', 'Status'];
      case 'low': return ['Item Code', 'Item Name', 'Available', 'Stock Status', 'Unit'];
      case 'damaged': return ['Reference', 'Date', 'Item Code', 'Item Name', 'Quantity Written Off', 'Recorded By', 'Reason'];
      case 'movement': return ['Reference', 'Date', 'Item Code', 'Item Name', 'Department', 'Type', 'Qty In', 'Qty Out', 'Previous Balance', 'New Balance', 'Responsible User', 'Receiver', 'Reason'];
      case 'uniform': return ['Item Code', 'Item Name', 'Item Type', 'Category', 'Colour', 'Clothing Size', 'Shoe Size', 'Quantity in Stock', 'Stock Status', 'Supplier', 'Purchase Price', 'Selling Price'];
      case 'suppliers': return ['Supplier', 'Contact Person', 'Phone', 'Email', 'Orders'];
      case 'procurement': return ['Order Ref', 'Supplier', 'Lines', 'Total Cost', 'Purchase Date', 'Delivery Date', 'Invoice No', 'Status'];
      default: return [];
    }
  },
  printReport(kind, dept, title) {
    const rows = this.reportRows(kind, dept, InventoryUI.currentFilters());
    if (!rows.length) return toast('No data to print for this report.', 'info');
    const headers = this.reportHeaders(kind);
    const html = '<h2>' + esc(title || kind) + '</h2>' +
      '<p class="meta">Department: ' + esc((DEPTS[dept] || {}).label || 'All') + ' · Generated ' + new Date().toLocaleString() + '</p>' +
      '<table><thead><tr>' + headers.map(h => '<th>' + esc(h) + '</th>').join('') + '</tr></thead><tbody>' +
      rows.map(r => '<tr>' + r.map(c => '<td>' + esc(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
    printHTML(title || 'Inventory Report', html);
    Audit.log('inventory.report.print', (title || kind) + ' [' + (dept || 'all') + ']');
  },
  exportReport(kind, dept) {
    const rows = this.reportRows(kind, dept, InventoryUI.currentFilters());
    if (!rows.length) return toast('No data to export.', 'info');
    downloadCSV('st-teresa-' + kind + '-' + (dept || 'all') + '.csv', this.reportHeaders(kind), rows);
    Audit.log('inventory.report.export', kind + ' [' + (dept || 'all') + ']');
  }
};

/* ============================================================
   INVENTORY UI (shared by store, kitchen and uniform portals)
   ============================================================ */
const InventoryUI = {
  dept: 'store',
  filters: {},
  currentFilters() { return { ...this.filters, dept: this.dept }; },
  setDept(d) { this.dept = d; this.filters = {}; },

  isUniform() { return UNIFORM_DEPTS.includes(this.dept); },

  init(dept) {
    this.dept = dept;
    this.bindForms();
    this.refreshAll();
  },

  refreshAll() {
    this.renderDashboard();
    this.renderItems();
    this.renderMovements();
    this.renderTransfers();
    this.renderRequests();
    this.renderOrders();
    this.renderSuppliers();
    this.renderReports();
  },

  renderDashboard() {
    const dept = this.dept;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    const items = Inventory.itemsFor(dept);
    const low = Inventory.lowStock(dept);
    set('invItemCount', items.length);
    set('invLowCount', low.length);
    set('invValue', money(items.reduce((a, i) => a + Number(i.balance || 0) * Number(i.purchasePrice || 0), 0)));
    set('invPendingTransfers', Inventory.transfers().filter(t => t.status === 'pending' && (t.toDept === dept || t.fromDept === dept)).length);
    set('invPendingReceipts', Inventory.transfers().filter(t => t.status === 'pending' && t.toDept === dept).length);
    set('invOpenOrders', Inventory.orders().filter(o => ['pending', 'approved', 'ordered', 'partially_received'].includes(o.status)).length);
    set('invRequests', Inventory.requests().filter(r => r.status === 'pending' && r.toDept === dept).length);
    const box = document.getElementById('invLowList');
    if (box) {
      box.innerHTML = low.length ? low.map(i => `
        <div style="display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
          <span><strong>${esc(i.name)}</strong><br><small style="color:var(--text-light)">${esc(i.code)} · ${esc(i.unit)}</small></span>
          <span class="badge badge-danger">${i.balance} available — low stock (below ${STOCK_STATUS_LOW_BELOW})</span>
        </div>`).join('') : '<p style="color:var(--text-light)">No low-stock items. </p>';
    }
  },

  /* ---------- ITEMS ---------- */
  renderItems() {
    const box = document.getElementById('invItemsBody');
    if (!box) return;
    const dept = this.dept;
    const q = ((document.getElementById('invItemSearch') || {}).value || '').toLowerCase();
    const cat = (document.getElementById('invItemCategory') || {}).value || '';
    const showArchived = !!((document.getElementById('invShowArchived') || {}).checked);
    let items = Inventory.itemsFor(dept, true);
    if (!showArchived) items = items.filter(i => !i.archived);
    if (q) items = items.filter(i => (i.name + ' ' + i.code + ' ' + i.category + ' ' + (i.clothingSize || '') + ' ' + (i.shoeSize || '')).toLowerCase().includes(q));
    if (cat) items = items.filter(i => i.category === cat);
    // categories for filter
    const catSel = document.getElementById('invItemCategory');
    if (catSel && catSel.dataset.dept !== dept) {
      catSel.dataset.dept = dept;
      const cats = [...new Set(Inventory.itemsFor(dept, true).map(i => i.category))];
      const cur = catSel.value;
      catSel.innerHTML = '<option value="">All Categories</option>' + cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
      if (cats.includes(cur)) catSel.value = cur;
    }

    const canEdit = Perm.canManageInventory(dept);
    box.innerHTML = items.length ? items.map(i => {
      const st = Inventory.statusFor(i.balance);
      return `
      <tr style="${i.archived ? 'opacity:.55' : ''}">
        <td><code>${esc(i.code)}</code></td>
        <td><strong>${esc(i.name)}</strong>
          ${i.clothingSize || i.shoeSize ? `<br><small style="color:var(--text-light)">${i.clothingSize ? 'Size ' + esc(i.clothingSize) : ''}${i.clothingSize && i.shoeSize ? ' · ' : ''}${i.shoeSize ? 'Shoe ' + esc(i.shoeSize) : ''}</small>` : ''}
          ${i.color ? `<br><small style="color:var(--text-light)">${esc(i.color)}</small>` : ''}
        </td>
        <td>${esc(i.category)}${i.itemType ? '<br><small style="color:var(--text-light)">' + esc(i.itemType) + '</small>' : ''}</td>
        <td>${esc(i.unit)}</td>
        <td><strong>${i.balance}</strong>${st.qtyTag ? ` <span class="badge badge-${st.badge}">${st.qtyTag}</span>` : ''}</td>
        <td>${i.location || '—'}${i.expiryDate ? `<br><small style="color:var(--warning)">Exp ${fmtDate(i.expiryDate)}</small>` : ''}</td>
        <td>${i.archived ? '<span class="badge badge-navy">Archived</span>' : `<span class="badge badge-${st.badge}">${st.label}</span>`}</td>
        <td class="table-actions">
          <button class="btn btn-xs btn-outline" onclick="InventoryUI.viewItem('${i.id}')" title="Product & stock details"><i class="fas fa-eye"></i></button>
          ${canEdit && !i.archived ? `
            <button class="btn btn-xs btn-success" onclick="InventoryUI.stockModal('${i.id}','in')" title="Record incoming stock"><i class="fas fa-arrow-down"></i></button>
            <button class="btn btn-xs btn-warning" onclick="InventoryUI.stockModal('${i.id}','out')" title="Record outgoing stock"><i class="fas fa-arrow-up"></i></button>
            <button class="btn btn-xs btn-primary" onclick="InventoryUI.adjustModal('${i.id}')" title="Adjust"><i class="fas fa-sliders"></i></button>
            <button class="btn btn-xs btn-warning" onclick="InventoryUI.damagedModal('${i.id}')" title="Damaged / expired"><i class="fas fa-trash-can"></i></button>
            <button class="btn btn-xs btn-outline" onclick="InventoryUI.editItem('${i.id}')" title="Edit"><i class="fas fa-pen"></i></button>
            <button class="btn btn-xs btn-danger" onclick="InventoryUI.archiveItem('${i.id}')" title="Archive"><i class="fas fa-box-archive"></i></button>` : ''}
          ${canEdit && i.archived ? `<button class="btn btn-xs btn-success" onclick="InventoryUI.restoreItem('${i.id}')"><i class="fas fa-rotate-left"></i></button>` : ''}
        </td>
      </tr>`;
    }).join('') : `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text-light)">No items yet — press <strong>Add New Item</strong>.</td></tr>`;

    const cnt = document.getElementById('invItemCountLabel');
    if (cnt) cnt.textContent = items.length + ' item(s)';
  },

  openItem(id) {
    const form = document.getElementById('invItemForm');
    if (!form) return;
    form.reset();
    delete form.dataset.editingId;
    document.getElementById('invItemTitle').textContent = id ? 'Edit Item' : 'Add New Item';
    const unitSel = document.getElementById('invUnit');
    if (unitSel) unitSel.innerHTML = STOCK_UNITS.map(u => `<option value="${u}">${u}</option>`).join('');
    const supSel = document.getElementById('invSupplier');
    if (supSel) supSel.innerHTML = '<option value="">—</option>' + Inventory.suppliers().map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
    const typeBox = document.getElementById('invItemTypeWrap');
    if (typeBox) typeBox.style.display = this.isUniform() ? '' : 'none';
    const sizeBox = document.getElementById('invSizeWrap');
    if (sizeBox) sizeBox.style.display = this.isUniform() ? '' : 'none';
    const uniformDept = document.getElementById('invUniformDept');
    if (uniformDept) {
      uniformDept.style.display = this.isUniform() ? '' : 'none';
      if (this.isUniform()) uniformDept.value = DEPTS[this.dept].label;
    }
    if (id) {
      const i = Inventory.getItem(id);
      if (!i) return;
      form.dataset.editingId = id;
      const set = (n, v) => { const el = document.getElementById(n); if (el) el.value = v == null ? '' : v; };
      set('invName', i.name); set('invCode', i.code); set('invDesc', i.description);
      set('invCategory', i.category); set('invItemType', i.itemType); set('invUnit', i.unit);
      set('invSupplier', i.supplierId);
      set('invPrice', i.purchasePrice); set('invSell', i.sellingPrice); set('invLocation', i.location);
      set('invColor', i.color); set('invClothingSize', i.clothingSize); set('invShoeSize', i.shoeSize);
      set('invExpiry', i.expiryDate); set('invBatch', i.batchNo); set('invOpening', 0);
      const opWrap = document.getElementById('invOpeningWrap'); if (opWrap) opWrap.style.display = 'none';
    } else {
      const opWrap = document.getElementById('invOpeningWrap'); if (opWrap) opWrap.style.display = '';
      set0('invOpening');
    }
    function set0(n) { const el = document.getElementById(n); if (el) el.value = 0; }
    openModal('invItemModal');
  },
  editItem(id) { this.openItem(id); },

  saveItem() {
    const form = document.getElementById('invItemForm');
    const id = form.dataset.editingId || null;
    const supSel = document.getElementById('invSupplier');
    const data = {
      name: document.getElementById('invName').value,
      code: document.getElementById('invCode').value,
      description: document.getElementById('invDesc').value,
      category: document.getElementById('invCategory').value || 'General',
      itemType: document.getElementById('invItemType').value,
      unit: document.getElementById('invUnit').value,
      supplierId: supSel ? supSel.value : '',
      supplierName: supSel && supSel.selectedOptions[0] ? supSel.selectedOptions[0].text : '',
      purchasePrice: document.getElementById('invPrice').value,
      sellingPrice: document.getElementById('invSell').value,
      location: document.getElementById('invLocation').value,
      color: document.getElementById('invColor').value,
      clothingSize: document.getElementById('invClothingSize').value,
      shoeSize: document.getElementById('invShoeSize').value,
      expiryDate: document.getElementById('invExpiry').value,
      batchNo: document.getElementById('invBatch').value,
      openingQty: document.getElementById('invOpening').value
    };
    const r = Inventory.saveItem(this.dept, data, id);
    if (!r.ok) return toast(r.error, 'error');
    closeModal('invItemModal');
    toast(id ? 'Item updated.' : 'Item created: ' + r.item.code);
    this.refreshAll();
  },
  archiveItem(id) {
    const i = Inventory.getItem(id);
    if (!i) return;
    if (!confirm('Archive "' + i.name + '"? Archived items are hidden from active stock but keep their full transaction history.')) return;
    const r = Inventory.archiveItem(this.dept, id);
    if (!r.ok) return toast(r.error, 'error');
    toast('Item archived.', 'info');
    this.refreshAll();
  },
  restoreItem(id) {
    const r = Inventory.restoreItem(this.dept, id);
    if (!r.ok) return toast(r.error, 'error');
    toast('Item restored.');
    this.refreshAll();
  },

  viewItem(id) {
    const i = Inventory.getItem(id);
    if (!i) return;
    if (!Perm.canViewInventory(i.dept)) return toast('Not authorized to view this department.', 'error');
    const moves = Inventory.movements().filter(m => m.itemId === id).slice().reverse();
    document.getElementById('invItemDetailTitle').textContent = i.code + ' — ' + i.name;
    document.getElementById('invItemDetailBody').innerHTML = `
      <div class="form-grid" style="margin-bottom:14px">
        <div class="form-group"><label>Item Code / SKU</label><div><code>${esc(i.code)}</code></div></div>
        <div class="form-group"><label>Department</label><div><span class="badge badge-navy">${esc((DEPTS[i.dept] || {}).label)}</span></div></div>
        <div class="form-group full"><label>Description</label><div>${esc(i.description || '—')}</div></div>
        <div class="form-group"><label>Category</label><div>${esc(i.category)}${i.itemType ? ' · ' + esc(i.itemType) : ''}</div></div>
        <div class="form-group"><label>Unit of Measurement</label><div>${esc(i.unit)}</div></div>
        <div class="form-group"><label>Quantity Received</label><div>${i.qtyReceived}</div></div>
        <div class="form-group"><label>Quantity Issued</label><div>${i.qtyIssued}</div></div>
        <div class="form-group"><label>Available Balance</label><div style="font-weight:800;font-size:1.15rem;color:var(--navy)">${i.balance}</div></div>
        <div class="form-group"><label>Stock Status (automatic)</label><div><span class="badge badge-${Inventory.statusFor(i.balance).badge}">${Inventory.statusFor(i.balance).label}</span></div></div>
        <div class="form-group"><label>Supplier</label><div>${esc(i.supplierName || '—')}</div></div>
        <div class="form-group"><label>Purchase Price</label><div>${i.purchasePrice ? money(i.purchasePrice) : '—'}</div></div>
        <div class="form-group"><label>Storage Location</label><div>${esc(i.location || '—')}</div></div>
        <div class="form-group"><label>Date Added</label><div>${fmtDate(i.addedAt)}</div></div>
        <div class="form-group"><label>Expiry Date</label><div>${i.expiryDate ? fmtDate(i.expiryDate) : '—'}</div></div>
        ${i.clothingSize ? `<div class="form-group"><label>Clothing Size</label><div>${esc(i.clothingSize)}</div></div>` : ''}
        ${i.shoeSize ? `<div class="form-group"><label>Shoe Size</label><div>${esc(i.shoeSize)}</div></div>` : ''}
        ${i.color ? `<div class="form-group"><label>Colour</label><div>${esc(i.color)}</div></div>` : ''}
      </div>
      <h4 style="color:var(--navy);margin-bottom:8px"><i class="fas fa-clock-rotate-left"></i> Stock Movement History</h4>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Ref</th><th>Date</th><th>Type</th><th>In</th><th>Out</th><th>Balance</th><th>By</th><th>Receiver</th><th>Reason</th></tr></thead>
        <tbody>${moves.length ? moves.map(m => `<tr>
          <td><code>${esc(m.ref)}</code></td>
          <td style="white-space:nowrap">${esc(String(m.at).replace('T', ' ').slice(0, 16))}</td>
          <td><span class="badge badge-${m.type === 'receipt' || m.type === 'transfer_in' ? 'success' : m.type === 'damaged' ? 'danger' : 'navy'}">${esc(m.type)}</span></td>
          <td>${m.qtyIn || '—'}</td><td>${m.qtyOut || '—'}</td>
          <td>${m.prevBalance} → ${m.newBalance}</td>
          <td>${esc(m.byName)}</td><td>${esc(m.receiverName || '—')}</td><td style="font-size:.8rem">${esc(m.reason || '')}</td>
        </tr>`).join('') : '<tr><td colspan="9" style="text-align:center;color:var(--text-light)">No movements yet</td></tr>'}</tbody>
      </table></div>`;
    openModal('invItemDetailModal');
  },

  /* ---------- STOCK IN / OUT / ADJUST ---------- */
  stockModal(id, dir) {
    const i = Inventory.getItem(id);
    if (!i) return;
    const form = document.getElementById('invStockForm');
    form.reset();
    form.dataset.itemId = id;
    form.dataset.dir = dir;
    document.getElementById('invStockTitle').textContent = (dir === 'in' ? 'Record Incoming Stock — ' : 'Record Outgoing Stock — ') + i.name;
    document.getElementById('invStockInfo').innerHTML = 'Available balance: <strong>' + i.balance + ' ' + esc(i.unit) + '</strong>';
    const expWrap = document.getElementById('invStockExpiryWrap');
    if (expWrap) expWrap.style.display = dir === 'in' ? '' : 'none';
    openModal('invStockModal');
  },
  saveStock() {
    const form = document.getElementById('invStockForm');
    const id = form.dataset.itemId, dir = form.dataset.dir;
    const qty = Number(document.getElementById('invStockQty').value);
    const reason = document.getElementById('invStockReason').value;
    const notes = document.getElementById('invStockNotes').value;
    const expiry = (document.getElementById('invStockExpiry') || {}).value || '';
    if (!(qty > 0)) return toast('Enter a quantity greater than zero.', 'error');
    const r = dir === 'in'
      ? Inventory.receive(this.dept, id, qty, { reason, notes, expiryDate: expiry })
      : Inventory.issue(this.dept, id, qty, { reason, notes });
    if (!r.ok) return toast(r.error, 'error');
    closeModal('invStockModal');
    toast(dir === 'in' ? 'Incoming stock recorded. New balance: ' + r.balance : 'Outgoing stock recorded. New balance: ' + r.balance);
    this.refreshAll();
  },
  adjustModal(id) {
    const i = Inventory.getItem(id);
    if (!i) return;
    const form = document.getElementById('invAdjustForm');
    form.reset();
    form.dataset.itemId = id;
    form.dataset.type = 'adjustment';
    document.getElementById('invAdjustTitle').textContent = 'Stock Adjustment — ' + i.name;
    document.getElementById('invAdjustInfo').innerHTML = 'Current balance: <strong>' + i.balance + ' ' + esc(i.unit) + '</strong>';
    openModal('invAdjustModal');
  },
  saveAdjust() {
    const form = document.getElementById('invAdjustForm');
    const delta = Number(document.getElementById('invAdjustQty').value);
    const reason = document.getElementById('invAdjustReason').value;
    let r;
    if (form.dataset.type === 'damaged') {
      if (!(delta > 0)) return toast('Enter the quantity damaged or expired.', 'error');
      r = Inventory.recordDamaged(this.dept, form.dataset.itemId, delta, reason);
    } else {
      r = Inventory.adjust(this.dept, form.dataset.itemId, delta, reason);
    }
    if (!r.ok) return toast(r.error, 'error');
    closeModal('invAdjustModal');
    toast(form.dataset.type === 'damaged' ? 'Damaged/expired stock written off. New balance: ' + r.balance : 'Adjustment recorded. New balance: ' + r.balance);
    this.refreshAll();
  },
  damagedModal(id) {
    const i = Inventory.getItem(id);
    if (!i) return;
    const form = document.getElementById('invAdjustForm');
    form.reset();
    form.dataset.itemId = id;
    form.dataset.type = 'damaged';
    document.getElementById('invAdjustTitle').textContent = 'Damaged / Expired Items — ' + i.name;
    document.getElementById('invAdjustInfo').innerHTML = 'Current balance: <strong>' + i.balance + ' ' + esc(i.unit) + '</strong>. Enter the quantity to write off; a reason is required.';
    openModal('invAdjustModal');
  },

  /* ---------- MOVEMENTS ---------- */
  renderMovements() {
    const box = document.getElementById('invMovesBody');
    if (!box) return;
    const f = this.filters;
    let mv = Inventory.filterMovements({ dept: this.dept, type: f.type, from: f.from, to: f.to, search: f.search, userId: f.userId });
    const total = mv.length;
    const page = Number(this.filters.page || 1);
    const size = 15;
    const pages = Math.max(1, Math.ceil(total / size));
    mv = mv.slice((page - 1) * size, page * size);
    box.innerHTML = mv.length ? mv.map(m => `
      <tr>
        <td><code>${esc(m.ref)}</code></td>
        <td style="white-space:nowrap">${esc(String(m.at).replace('T', ' ').slice(0, 16))}</td>
        <td>${esc(m.itemCode)}<br><strong>${esc(m.itemName)}</strong></td>
        <td><span class="badge badge-${m.type === 'receipt' || m.type === 'transfer_in' ? 'success' : m.type === 'damaged' || m.type === 'transfer_out' ? 'danger' : 'navy'}">${esc(m.type)}</span></td>
        <td>${m.qtyIn ? '+' + m.qtyIn : '—'}</td>
        <td>${m.qtyOut ? '-' + m.qtyOut : '—'}</td>
        <td>${m.prevBalance} → <strong>${m.newBalance}</strong></td>
        <td>${esc(m.byName)}${m.receiverName ? '<br><small style="color:var(--text-light)">rcv: ' + esc(m.receiverName) + '</small>' : ''}</td>
        <td style="font-size:.8rem">${esc(m.reason || '')}${m.transferRef ? '<br><code>' + esc(m.transferRef) + '</code>' : ''}</td>
      </tr>`).join('') : `<tr><td colspan="9" style="text-align:center;padding:30px;color:var(--text-light)">No stock movements match these filters.</td></tr>`;
    const pager = document.getElementById('invMovesPager');
    if (pager) pager.innerHTML = pages > 1 ? `
      <button class="btn btn-xs btn-outline" ${page <= 1 ? 'disabled' : ''} onclick="InventoryUI.movPage(${page - 1})"><i class="fas fa-chevron-left"></i></button>
      <span style="padding:0 8px;font-size:.8rem;color:var(--text-light)">Page ${page} / ${pages}</span>
      <button class="btn btn-xs btn-outline" ${page >= pages ? 'disabled' : ''} onclick="InventoryUI.movPage(${page + 1})"><i class="fas fa-chevron-right"></i></button>` : '';
    const cnt = document.getElementById('invMovesCount');
    if (cnt) cnt.textContent = total + ' transaction(s)';
  },
  movPage(p) { this.filters.page = p; this.renderMovements(); },
  applyFilters() {
    this.filters = {
      type: (document.getElementById('invFType') || {}).value || '',
      from: (document.getElementById('invFFrom') || {}).value || '',
      to: (document.getElementById('invFTo') || {}).value || '',
      search: (document.getElementById('invFSearch') || {}).value || '',
      userId: (document.getElementById('invFUser') || {}).value || '',
      page: 1
    };
    this.renderMovements();
    this.renderReports();
  },
  clearFilters() {
    ['invFType', 'invFFrom', 'invFTo', 'invFSearch', 'invFUser'].forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; });
    this.filters = {};
    this.renderMovements();
    this.renderReports();
  },

  /* ---------- TRANSFERS ---------- */
  renderTransfers() {
    const box = document.getElementById('invTransfersBody');
    if (!box) return;
    const all = Inventory.transfers().slice().reverse();
    const scope = this.dept === 'kitchen' ? 'incoming' : this.dept === 'store' ? 'outgoing' : 'all';
    let list = all;
    if (scope === 'incoming') list = all.filter(t => t.toDept === 'kitchen');
    if (scope === 'outgoing') list = all.filter(t => t.fromDept === 'store');
    if (scope === 'all') list = [];
    const filter = (document.getElementById('invTransferFilter') || {}).value || '';
    if (filter) list = list.filter(t => t.status === filter);
    box.innerHTML = list.length ? list.map(t => {
      const statusBadge = t.status === 'pending' ? 'warning' : t.status === 'received' ? 'success' : t.status === 'partially_received' ? 'gold' : 'danger';
      const canConfirm = this.dept === 'kitchen' && t.status === 'pending' && Perm.canConfirmKitchenReceipt();
      return `
      <div class="panel" style="margin-bottom:14px">
        <div class="panel-head">
          <h3><i class="fas fa-truck-ramp-box" style="color:var(--gold)"></i> ${esc(t.ref)} — ${esc(DEPTS[t.fromDept].label)} → ${esc(DEPTS[t.toDept].label)}</h3>
          <span class="badge badge-${statusBadge}">${esc(t.status.replace('_', ' '))}</span>
        </div>
        <div class="panel-body">
          <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:.85rem;color:var(--text-light);margin-bottom:10px">
            <span><i class="fas fa-clock"></i> Sent ${esc(String(t.sentAt).replace('T', ' ').slice(0, 16))} by ${esc(t.sentByName)}</span>
            ${t.receivedAt ? `<span><i class="fas fa-circle-check"></i> Received ${esc(String(t.receivedAt).replace('T', ' ').slice(0, 16))} by ${esc(t.receivedByName)}${t.receiverFirstName ? ' (acknowledged as "' + esc(t.receiverFirstName) + '")' : ''}</span>` : ''}
            ${t.notes ? `<span><i class="fas fa-comment"></i> ${esc(t.notes)}</span>` : ''}
          </div>
          <div class="table-wrap"><table class="data-table">
            <thead><tr><th>Item</th><th>Unit</th><th>Sent</th><th>Received</th><th>Discrepancy</th></tr></thead>
            <tbody>${t.lines.map(l => `<tr>
              <td>${esc(l.name)}<br><small style="color:var(--text-light)"><code>${esc(l.code)}</code></small></td>
              <td>${esc(l.unit || '')}</td>
              <td><strong>${l.sent}</strong></td>
              <td>${l.received === '' || l.received == null ? '<span class="badge badge-warning">Not confirmed</span>' : '<strong>' + l.received + '</strong>'}</td>
              <td>${l.diff > 0 ? `<span class="badge badge-danger">short ${l.diff}</span><br><small>${esc(l.discrepancyReason || '')}</small>` : (l.received === '' || l.received == null ? '—' : '<span class="badge badge-success">exact</span>')}</td>
            </tr>`).join('')}</tbody>
          </table></div>
          ${canConfirm ? `<div style="margin-top:12px"><button class="btn btn-gold" onclick="InventoryUI.confirmModal('${t.ref}')"><i class="fas fa-clipboard-check"></i> Confirm Receipt</button></div>` : ''}
          ${t.status !== 'pending' ? `<p style="font-size:.82rem;color:var(--text-light);margin-top:10px"><i class="fas fa-lock"></i> Finalized — both departments' balances have been updated. This transfer cannot be confirmed again.</p>` : ''}
        </div>
      </div>`;
    }).join('') : `<div class="empty-state"><i class="fas fa-truck-ramp-box"></i><h4>No transfers here</h4>
      <p>${this.dept === 'kitchen' ? 'Transfers from the Main Store appear here awaiting your confirmation.' : this.dept === 'store' ? 'Use "Transfer Items to Kitchen" to send stock.' : 'Transfers do not apply to this department.'}</p></div>`;
  },

  /* --- Store: initiate transfer --- */
  openTransferModal() {
    if (!Perm.canSendStoreTransfer()) return toast('Only the Store Manager can send transfers.', 'error');
    const form = document.getElementById('invTransferForm');
    form.reset();
    const sel = document.getElementById('trfItem');
    const items = Inventory.itemsFor('store').filter(i => i.balance > 0);
    sel.innerHTML = items.length ? items.map(i => `<option value="${i.id}">${esc(i.name)} (${i.code}) — ${i.balance} ${esc(i.unit)}</option>`).join('') : '<option value="">No stock available</option>';
    document.getElementById('trfLines').innerHTML = '';
    openModal('invTransferModal');
  },
  addTransferLine() {
    const sel = document.getElementById('trfItem');
    const itemId = sel.value;
    if (!itemId) return toast('No item selected.', 'error');
    const box = document.getElementById('trfLines');
    if (box.querySelector(`[data-line="${itemId}"]`)) return toast('That item is already in the transfer.', 'info');
    const item = Inventory.getItem(itemId);
    const row = document.createElement('div');
    row.dataset.line = itemId;
    row.style.cssText = 'display:flex;gap:8px;align-items:flex-end;padding:8px;border:1px solid var(--border);border-radius:8px;margin-bottom:8px;flex-wrap:wrap';
    row.innerHTML = `
      <div style="flex:1;min-width:170px"><strong>${esc(item.name)}</strong><br><small style="color:var(--text-light)">${esc(item.code)} · available ${item.balance} ${esc(item.unit)}</small></div>
      <div class="form-group" style="margin:0"><label>Quantity</label>
        <input type="number" min="1" max="${item.balance}" value="1" data-qty style="width:110px"></div>
      <button type="button" class="btn btn-xs btn-danger" onclick="this.parentElement.remove()"><i class="fas fa-trash"></i></button>`;
    box.appendChild(row);
  },
  submitTransfer() {
    const box = document.getElementById('trfLines');
    const lines = [...box.querySelectorAll('[data-line]')].map(r => ({ itemId: r.dataset.line, qty: Number(r.querySelector('[data-qty]').value) }));
    if (!lines.length) return toast('Add at least one item.', 'error');
    const notes = document.getElementById('trfNotes').value;
    if (!confirm('Send ' + lines.length + ' line(s) to the Kitchen? Stock leaves the store only after the Kitchen Manager confirms receipt.')) return;
    const r = Inventory.createTransfer(lines, notes);
    if (!r.ok) return toast(r.error, 'error');
    closeModal('invTransferModal');
    toast('Transfer ' + r.transfer.ref + ' submitted — awaiting Kitchen Manager confirmation.');
    this.refreshAll();
  },

  /* --- Kitchen: confirm receipt --- */
  confirmModal(ref) {
    const t = Inventory.getTransfer(ref);
    if (!t) return;
    if (t.status !== 'pending') return toast('This transfer was already confirmed.', 'error');
    if (!Perm.canConfirmKitchenReceipt()) return toast('Only the Kitchen Manager can confirm receipt.', 'error');
    const s = Auth.session();
    const form = document.getElementById('invConfirmForm');
    form.reset();
    form.dataset.ref = ref;
    document.getElementById('invConfirmRef').textContent = ref;
    document.getElementById('invConfirmAuth').innerHTML =
      '<i class="fas fa-user-check"></i> Authenticated receiver: <strong>' + esc(s.name) + '</strong> (Kitchen Manager account)';
    const fn = document.getElementById('invConfirmFirst');
    if (fn) fn.value = '';
    document.getElementById('invConfirmLines').innerHTML = t.lines.map(l => `
      <div style="display:flex;gap:10px;align-items:flex-end;padding:10px;border:1px solid var(--border);border-radius:8px;margin-bottom:10px;flex-wrap:wrap" data-cline="${l.itemId}">
        <div style="flex:1;min-width:170px"><strong>${esc(l.name)}</strong><br><small style="color:var(--text-light)">Sent: <strong>${l.sent}</strong> ${esc(l.unit || '')}</small></div>
        <div class="form-group" style="margin:0"><label>Actually Received</label>
          <input type="number" min="0" max="${l.sent}" value="${l.sent}" data-received style="width:110px"></div>
        <div class="form-group" style="margin:0;flex:1;min-width:180px"><label>Discrepancy Explanation (required if short)</label>
          <input type="text" data-reason placeholder="e.g., 2 packets damaged in transit" style="width:100%"></div>
      </div>`).join('');
    openModal('invConfirmModal');
  },
  submitConfirmation() {
    const form = document.getElementById('invConfirmForm');
    const ref = form.dataset.ref;
    const fn = document.getElementById('invConfirmFirst').value.trim();
    if (!fn) return toast('Type your first name as an additional acknowledgment.', 'error');
    const s = Auth.session();
    if (!s || s.role !== 'kitchenmanager') return toast('Confirmation must come from the authenticated Kitchen Manager account.', 'error');
    const lines = [...document.querySelectorAll('[data-cline]')].map(r => ({
      itemId: r.dataset.cline,
      received: Number(r.querySelector('[data-received]').value),
      reason: r.querySelector('[data-reason]').value.trim()
    }));
    const note = document.getElementById('invConfirmNote').value;
    const r = Inventory.confirmTransfer(ref, fn, lines, note);
    if (!r.ok) return toast(r.error, 'error');
    closeModal('invConfirmModal');
    toast('Receipt confirmed for ' + ref + '. Both departments\' stock balances are updated.');
    this.refreshAll();
  },

  /* --- Kitchen: request stock --- */
  openRequestModal() {
    const form = document.getElementById('invRequestForm');
    form.reset();
    const sel = document.getElementById('reqItem');
    const items = Inventory.itemsFor('kitchen');
    sel.innerHTML = items.length ? items.map(i => `<option value="${i.id}">${esc(i.name)} (${i.code}) — ${i.balance} ${esc(i.unit)}</option>`).join('') : '<option value="">No kitchen items yet</option>';
    document.getElementById('reqLines').innerHTML = '';
    openModal('invRequestModal');
  },
  addRequestLine() {
    const sel = document.getElementById('reqItem');
    const itemId = sel.value;
    if (!itemId) return toast('No item selected.', 'error');
    const box = document.getElementById('reqLines');
    if (box.querySelector(`[data-line="${itemId}"]`)) return toast('Already added.', 'info');
    const item = Inventory.getItem(itemId);
    const row = document.createElement('div');
    row.dataset.line = itemId;
    row.dataset.name = item.name;
    row.style.cssText = 'display:flex;gap:8px;align-items:flex-end;padding:8px;border:1px solid var(--border);border-radius:8px;margin-bottom:8px;flex-wrap:wrap';
    row.innerHTML = `
      <div style="flex:1;min-width:170px"><strong>${esc(item.name)}</strong><br><small style="color:var(--text-light)">In stock: ${item.balance} ${esc(item.unit)}</small></div>
      <div class="form-group" style="margin:0"><label>Quantity Requested</label><input type="number" min="1" value="1" data-qty style="width:110px"></div>
      <button type="button" class="btn btn-xs btn-danger" onclick="this.parentElement.remove()"><i class="fas fa-trash"></i></button>`;
    box.appendChild(row);
  },
  submitRequest() {
    const box = document.getElementById('reqLines');
    const lines = [...box.querySelectorAll('[data-line]')].map(r => ({ itemId: r.dataset.line, name: r.dataset.name, qty: Number(r.querySelector('[data-qty]').value) }));
    if (!lines.length) return toast('Add at least one item.', 'error');
    const r = Inventory.createRequest(lines, document.getElementById('reqNotes').value);
    if (!r.ok) return toast(r.error, 'error');
    closeModal('invRequestModal');
    toast('Stock request ' + r.request.ref + ' sent to the Main Store.');
    this.refreshAll();
  },
  renderRequests() {
    const box = document.getElementById('invRequestsBody');
    if (!box) return;
    const list = Inventory.requests().slice().reverse().filter(r => this.dept === 'store' ? r.toDept === 'store' : r.fromDept === this.dept);
    box.innerHTML = list.length ? `<div class="table-wrap"><table class="data-table">
      <thead><tr><th>Ref</th><th>Requested</th><th>By</th><th>Items</th><th>Notes</th><th>Status</th><th></th></tr></thead>
      <tbody>${list.map(r => `<tr>
        <td><code>${esc(r.ref)}</code></td>
        <td>${esc(String(r.requestedAt).replace('T', ' ').slice(0, 16))}</td>
        <td>${esc(r.requestedByName)}</td>
        <td>${r.lines.map(l => esc(l.name) + ' × ' + l.qty).join('<br>')}</td>
        <td style="font-size:.82rem">${esc(r.notes || '—')}</td>
        <td><span class="badge badge-${r.status === 'pending' ? 'warning' : 'success'}">${esc(r.status)}</span></td>
        <td class="table-actions">${this.dept === 'store' && r.status === 'pending' ? `<button class="btn btn-xs btn-success" onclick="InventoryUI.fulfilRequest('${r.ref}')"><i class="fas fa-check"></i> Issue</button>` : ''}</td>
      </tr>`).join('')}</tbody></table></div>` : '<p style="color:var(--text-light)">No stock requests.</p>';
  },
  fulfilRequest(ref) {
    const req = Inventory.requests().find(r => r.ref === ref);
    if (!req) return;
    if (!confirm('Issue the requested stock for ' + ref + '? This deducts from Main Store balances.')) return;
    for (const line of req.lines) {
      // match by name in the store if the kitchen item id doesn't exist in store
      let storeItem = Inventory.getItem(line.itemId);
      if (!storeItem || storeItem.dept !== 'store') storeItem = Inventory.itemsFor('store').find(i => i.name === line.name);
      if (!storeItem) { toast('Store item not found for ' + line.name + '.', 'error'); continue; }
      const r = Inventory.issue('store', storeItem.id, Number(line.qty), { reason: 'Fulfilment of kitchen request ' + ref, notes: req.notes });
      if (!r.ok) return toast(r.error, 'error');
      // credit the matching kitchen item
      let kIt = Inventory.itemsFor('kitchen').find(k => k.transferSourceId === storeItem.id || k.name === line.name);
      if (kIt) Inventory.applyMovement({ dept: 'kitchen', itemId: kIt.id, type: 'transfer_in', qtyIn: Number(line.qty), qtyOut: 0, transferRef: ref, receiverName: (Auth.session() || {}).name, reason: 'Issued against request ' + ref, allowTransfer: true });
    }
    const list = Inventory.requests();
    const i = list.findIndex(r => r.ref === ref);
    list[i].status = 'fulfilled';
    list[i].fulfilledAt = new Date().toISOString();
    list[i].fulfilledByName = (Auth.session() || {}).name;
    DB.set('invRequests', list);
    DB.get('users').filter(u => u.role === 'kitchenmanager').forEach(u => Notifications.send(u.id, 'kitchenmanager', 'Stock Request Fulfilled (' + ref + ')', 'Your requested stock has been issued from the Main Store.', 'success'));
    Audit.log('inventory.request.fulfilled', ref);
    toast('Request ' + ref + ' fulfilled.');
    this.refreshAll();
  },

  /* ---------- PROCUREMENT ---------- */
  renderOrders() {
    const box = document.getElementById('invOrdersBody');
    if (!box) return;
    const status = (document.getElementById('invOrderStatus') || {}).value || '';
    let list = Inventory.orders().slice().reverse();
    if (status) list = list.filter(o => o.status === status);
    const canProcure = Perm.canProcure();
    box.innerHTML = list.length ? `<div class="table-wrap"><table class="data-table">
      <thead><tr><th>Order Ref</th><th>Supplier</th><th>Items</th><th>Total Cost</th><th>Purchase Date</th><th>Delivery</th><th>Invoice</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>${list.map(o => `<tr>
        <td><code>${esc(o.ref)}</code></td>
        <td>${esc(o.supplierName)}</td>
        <td>${o.lines.map(l => esc(l.name) + ' × ' + l.qty + ' @ ' + money(l.unitPrice)).join('<br>')}</td>
        <td><strong>${money(o.total)}</strong></td>
        <td>${fmtDate(o.orderDate)}</td>
        <td>${fmtDate(o.deliveryDate)}</td>
        <td>${esc(o.invoiceNo || '—')}</td>
        <td><span class="badge badge-${{ pending: 'warning', approved: 'info', ordered: 'navy', partially_received: 'gold', fully_received: 'success', rejected: 'danger' }[o.status] || 'navy'}">${esc(o.status.replace('_', ' '))}</span></td>
        <td class="table-actions">
          <button class="btn btn-xs btn-outline" onclick="InventoryUI.viewOrder('${o.id}')"><i class="fas fa-eye"></i></button>
          ${canProcure && !['fully_received', 'rejected'].includes(o.status) ? `
            <button class="btn btn-xs btn-success" onclick="InventoryUI.receiveOrder('${o.id}')"><i class="fas fa-truck"></i></button>
            <button class="btn btn-xs btn-primary" onclick="InventoryUI.orderStatus('${o.id}','approved')"><i class="fas fa-check"></i></button>
            <button class="btn btn-xs btn-danger" onclick="InventoryUI.orderStatus('${o.id}','rejected')"><i class="fas fa-xmark"></i></button>` : ''}
        </td>
      </tr>`).join('')}</tbody></table></div>` : '<div class="empty-state"><i class="fas fa-cart-flatbed"></i><h4>No purchase orders yet</h4><p>Create a supplier, then raise a purchase request or order.</p></div>';
  },
  openSupplierModal() {
    if (!Perm.canProcure()) return toast('Only procurement staff can manage suppliers.', 'error');
    document.getElementById('invSupplierForm').reset();
    openModal('invSupplierModal');
  },
  saveSupplier() {
    const f = document.getElementById('invSupplierForm');
    const r = Inventory.saveSupplier({
      name: document.getElementById('supName').value,
      contact: document.getElementById('supContact').value,
      phone: document.getElementById('supPhone').value,
      email: document.getElementById('supEmail').value,
      address: document.getElementById('supAddress').value
    });
    if (!r.ok) return toast(r.error, 'error');
    closeModal('invSupplierModal');
    toast('Supplier saved.');
    this.renderSuppliers();
  },
  renderSuppliers() {
    const box = document.getElementById('invSuppliersBody');
    if (!box) return;
    const list = Inventory.suppliers();
    box.innerHTML = list.length ? `<div class="table-wrap"><table class="data-table">
      <thead><tr><th>Supplier</th><th>Contact Person</th><th>Phone</th><th>Email</th><th>Address</th><th>Orders</th></tr></thead>
      <tbody>${list.map(s => `<tr>
        <td><strong>${esc(s.name)}</strong></td><td>${esc(s.contact || '—')}</td><td>${esc(s.phone || '—')}</td>
        <td>${esc(s.email || '—')}</td><td>${esc(s.address || '—')}</td>
        <td>${Inventory.orders().filter(o => o.supplierId === s.id).length}</td>
      </tr>`).join('')}</tbody></table></div>` : '<p style="color:var(--text-light)">No suppliers recorded yet.</p>';
  },
  openOrderModal() {
    if (!Perm.canProcure()) return toast('Only procurement staff can raise orders.', 'error');
    const f = document.getElementById('invOrderForm');
    f.reset();
    const sup = document.getElementById('poSupplier');
    sup.innerHTML = '<option value="">Select supplier…</option>' + Inventory.suppliers().map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
    if (!Inventory.suppliers().length) toast('Add a supplier first.', 'info');
    document.getElementById('poLines').innerHTML = '';
    this.addOrderLine();
    openModal('invOrderModal');
  },
  addOrderLine() {
    const box = document.getElementById('poLines');
    const row = document.createElement('div');
    row.className = 'po-line';
    row.style.cssText = 'display:flex;gap:8px;align-items:flex-end;padding:8px;border:1px solid var(--border);border-radius:8px;margin-bottom:8px;flex-wrap:wrap';
    row.innerHTML = `
      <div class="form-group" style="margin:0;flex:2;min-width:160px"><label>Item Description</label><input type="text" data-name required></div>
      <div class="form-group" style="margin:0"><label>Qty</label><input type="number" min="1" value="1" data-qty style="width:90px" required></div>
      <div class="form-group" style="margin:0"><label>Unit Price</label><input type="number" min="0" step="0.01" value="0" data-price style="width:110px" required></div>
      <div class="form-group" style="margin:0"><label>Line Total</label><div data-total style="padding:8px 0;font-weight:700">${money(0)}</div></div>
      <button type="button" class="btn btn-xs btn-danger" onclick="this.parentElement.remove();InventoryUI.orderTotal()"><i class="fas fa-trash"></i></button>`;
    box.appendChild(row);
    row.querySelectorAll('[data-qty],[data-price]').forEach(i => i.addEventListener('input', () => {
      const t = row.querySelector('[data-total]');
      t.textContent = money(Number(row.querySelector('[data-qty]').value) * Number(row.querySelector('[data-price]').value));
      InventoryUI.orderTotal();
    }));
  },
  orderTotal() {
    const t = [...document.querySelectorAll('.po-line')].reduce((a, r) =>
      a + Number(r.querySelector('[data-qty]').value || 0) * Number(r.querySelector('[data-price]').value || 0), 0);
    const el = document.getElementById('poTotal');
    if (el) el.textContent = money(t);
  },
  saveOrder() {
    const lines = [...document.querySelectorAll('.po-line')].map(r => ({
      name: r.querySelector('[data-name]').value.trim(),
      qty: Number(r.querySelector('[data-qty]').value),
      unitPrice: Number(r.querySelector('[data-price]').value)
    })).filter(l => l.name);
    const r = Inventory.saveOrder({
      supplierId: document.getElementById('poSupplier').value,
      orderDate: document.getElementById('poOrderDate').value,
      deliveryDate: document.getElementById('poDeliveryDate').value,
      invoiceNo: document.getElementById('poInvoice').value,
      notes: document.getElementById('poNotes').value,
      status: 'pending',
      lines
    });
    if (!r.ok) return toast(r.error, 'error');
    closeModal('invOrderModal');
    toast('Purchase order ' + r.order.ref + ' created (pending approval).');
    this.refreshAll();
  },
  orderStatus(id, status) {
    const comment = status === 'rejected' ? (prompt('Reason for rejection:') || '') : '';
    if (status === 'rejected' && !comment.trim()) return toast('A reason is required.', 'error');
    if (!confirm('Mark this order as ' + status + '?')) return;
    const r = Inventory.setOrderStatus(id, status, comment);
    if (!r.ok) return toast(r.error, 'error');
    toast('Order ' + status + '.');
    this.renderOrders();
  },
  receiveOrderModal(id) {
    const o = Inventory.orders().find(x => x.id === id);
    if (!o) return;
    document.getElementById('invReceiveBody').innerHTML = `
      <p style="font-weight:600;color:var(--navy);margin-bottom:12px">${esc(o.ref)} — ${esc(o.supplierName)}</p>
      <div id="recvLines">${o.lines.map(l => `
        <div style="display:flex;gap:10px;align-items:flex-end;padding:9px;border:1px solid var(--border);border-radius:8px;margin-bottom:8px;flex-wrap:wrap" data-rline="${esc(l.name)}">
          <div style="flex:1;min-width:160px"><strong>${esc(l.name)}</strong><br><small style="color:var(--text-light)">Ordered: ${l.qty}</small></div>
          <div class="form-group" style="margin:0"><label>Received</label><input type="number" min="0" max="${l.qty}" value="${l.qty}" data-rqty style="width:100px"></div>
          <div class="form-group" style="margin:0;flex:1;min-width:170px"><label>Damaged / Missing / Rejected</label><input type="text" data-rproblem placeholder="None" style="width:100%"></div>
        </div>`).join('')}</div>
      <div class="form-group" style="margin-top:10px"><label>Delivery Note</label><textarea id="recvNote" rows="2"></textarea></div>`;
    document.getElementById('invReceiveForm').dataset.orderId = id;
    openModal('invReceiveModal');
  },
  receiveOrder(id) { this.receiveOrderModal(id); },
  saveReceive() {
    const id = document.getElementById('invReceiveForm').dataset.orderId;
    const lines = [...document.querySelectorAll('[data-rline]')].map(r => ({
      name: r.dataset.rline,
      qty: Number(r.querySelector('[data-rqty]').value),
      problem: r.querySelector('[data-rproblem]').value.trim()
    }));
    const r = Inventory.receiveOrder(id, lines, document.getElementById('recvNote').value);
    if (!r.ok) return toast(r.error, 'error');
    closeModal('invReceiveModal');
    toast('Delivery recorded. Order status: ' + r.order.status.replace('_', ' '));
    this.renderOrders();
  },
  viewOrder(id) {
    const o = Inventory.orders().find(x => x.id === id);
    if (!o) return;
    document.getElementById('invOrderDetailTitle').textContent = o.ref + ' — ' + o.supplierName;
    document.getElementById('invOrderDetailBody').innerHTML = `
      <div class="form-grid" style="margin-bottom:12px">
        <div class="form-group"><label>Reference</label><div><code>${esc(o.ref)}</code></div></div>
        <div class="form-group"><label>Status</label><div><span class="badge badge-navy">${esc(o.status.replace('_', ' '))}</span></div></div>
        <div class="form-group"><label>Purchase Date</label><div>${fmtDate(o.orderDate)}</div></div>
        <div class="form-group"><label>Delivery Date</label><div>${fmtDate(o.deliveryDate)}</div></div>
        <div class="form-group"><label>Invoice No</label><div>${esc(o.invoiceNo || '—')}</div></div>
        <div class="form-group"><label>Total Cost</label><div style="font-weight:800">${money(o.total)}</div></div>
        <div class="form-group"><label>Raised By</label><div>${esc(o.createdByName || '—')}</div></div>
        <div class="form-group"><label>Approval</label><div>${o.approval ? esc(o.approval.byName + ' → ' + o.approval.status + ' @ ' + String(o.approval.at).slice(0, 16)) : '—'}</div></div>
      </div>
      <div class="table-wrap"><table class="data-table"><thead><tr><th>Item</th><th>Description</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
      <tbody>${o.lines.map(l => `<tr><td>${esc(l.name)}</td><td>${esc(l.description || '—')}</td><td>${l.qty}</td><td>${money(l.unitPrice)}</td><td>${money(l.total)}</td></tr>`).join('')}</tbody></table></div>
      ${(o.deliveries || []).length ? `<h4 style="color:var(--navy);margin:14px 0 8px">Delivery Records</h4>
        <div class="table-wrap"><table class="data-table"><thead><tr><th>Item</th><th>Qty</th><th>Issue</th><th>By</th><th>When</th></tr></thead>
        <tbody>${o.deliveries.map(d => `<tr><td>${esc(d.name)}</td><td>${d.qty}</td><td>${esc(d.problem || '—')}</td><td>${esc(d.byName)}</td><td>${esc(String(d.at).slice(0, 16))}</td></tr>`).join('')}</tbody></table></div>` : ''}
      <div style="margin-top:14px"><button class="btn btn-outline" onclick="window.print()"><i class="fas fa-print"></i> Print</button></div>`;
    openModal('invOrderDetailModal');
  },

  /* ---------- REPORTS ---------- */
  renderReports() {
    const box = document.getElementById('invReportsBody');
    if (!box) return;
    const reports = [
      { id: 'balance', label: 'Current Stock Balance', icon: 'fa-scale-balanced' },
      { id: 'received', label: 'Stock Received', icon: 'fa-arrow-down' },
      { id: 'issued', label: 'Stock Issued', icon: 'fa-arrow-up' },
      { id: 'transfers', label: 'Transfers Between Departments', icon: 'fa-truck-ramp-box' },
      { id: 'pending_transfers', label: 'Pending Transfers', icon: 'fa-hourglass-half' },
      { id: 'low', label: 'Low Stock', icon: 'fa-triangle-exclamation' },
      { id: 'damaged', label: 'Damaged & Expired Items', icon: 'fa-trash-can' },
      { id: 'movement', label: 'Full Stock Movement / Audit Trail', icon: 'fa-clock-rotate-left' }
    ];
    if (this.isUniform()) reports.push({ id: 'uniform', label: 'Uniform Stock by Size', icon: 'fa-shirt' });
    if (this.dept === 'store') {
      reports.push({ id: 'procurement', label: 'Procurement & Supplier History', icon: 'fa-cart-flatbed' });
      reports.push({ id: 'suppliers', label: 'Supplier Directory', icon: 'fa-address-book' });
    }
    if (this.dept === 'kitchen') reports.push({ id: 'issued', label: 'Kitchen Stock Usage', icon: 'fa-utensils' });
    const rows = box;
    rows.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px">
      ${reports.map(r => {
        const data = Inventory.reportRows(r.id, this.dept, this.currentFilters());
        return `<div class="panel" style="margin:0">
          <div class="panel-body" style="padding:16px">
            <div style="display:flex;gap:10px;align-items:center;margin-bottom:8px">
              <i class="fas ${r.icon}" style="color:var(--gold);font-size:1.1rem"></i>
              <strong style="color:var(--navy);font-size:.9rem">${esc(r.label)}</strong>
            </div>
            <p style="font-size:.78rem;color:var(--text-light);margin-bottom:10px">${data.length} record(s)</p>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <button class="btn btn-xs btn-primary" onclick="InventoryUI.previewReport('${r.id}','${esc(r.label)}')"><i class="fas fa-eye"></i> Preview</button>
              <button class="btn btn-xs btn-outline" onclick="Inventory.printReport('${r.id}','${this.dept}','${esc(r.label)}')"><i class="fas fa-print"></i> Print</button>
              <button class="btn btn-xs btn-outline" onclick="Inventory.exportReport('${r.id}','${this.dept}')"><i class="fas fa-file-csv"></i> CSV</button>
            </div>
          </div>
        </div>`;
      }).join('')}</div>`;
  },
  previewReport(kind, label) {
    const rows = Inventory.reportRows(kind, this.dept, this.currentFilters());
    const headers = Inventory.reportHeaders(kind);
    document.getElementById('invReportPreviewTitle').textContent = label;
    document.getElementById('invReportPreviewBody').innerHTML = rows.length
      ? `<div class="table-wrap"><table class="data-table"><thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
         <tbody>${rows.slice(0, 200).map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
         <p style="font-size:.8rem;color:var(--text-light);margin-top:8px">Showing ${Math.min(rows.length, 200)} of ${rows.length} record(s).</p>`
      : '<p style="color:var(--text-light)">No data for this report.</p>';
    openModal('invReportPreviewModal');
  },

  /* ---------- FORM WIRING ---------- */
  bindForms() {
    const bind = (id, fn) => { const el = document.getElementById(id); if (el && !el.dataset.bound) { el.dataset.bound = '1'; el.addEventListener('click', fn); } };
    bind('btnInvAddItem', () => this.openItem(null));
    bind('btnInvSaveItem', () => this.saveItem());
    bind('btnInvTransferKitchen', () => this.openTransferModal());
    bind('btnInvRequest', () => this.openRequestModal());
    bind('btnInvAddSupplier', () => this.openSupplierModal());
    bind('btnInvSaveSupplier', () => this.saveSupplier());
    bind('btnInvAddOrder', () => this.openOrderModal());
    bind('btnInvSaveOrder', () => this.saveOrder());
    const bindFn = (id, fn) => { const el = document.getElementById(id); if (el && !el.dataset.bound) { el.dataset.bound = '1'; el.addEventListener('submit', e => { e.preventDefault(); fn(); }); } };
    bindFn('invStockForm', () => this.saveStock());
    bindFn('invAdjustForm', () => this.saveAdjust());
    bindFn('invTransferForm', () => this.submitTransfer());
    bindFn('invConfirmForm', () => this.submitConfirmation());
    bindFn('invRequestForm', () => this.submitRequest());
    bindFn('invReceiveForm', () => this.saveReceive());
    bind('btnInvAddLine', () => this.addTransferLine());
    bind('btnInvAddReqLine', () => this.addRequestLine());
    bind('btnInvAddPoLine', () => this.addOrderLine());
    ['invItemSearch', 'invItemCategory'].forEach(id => {
      const el = document.getElementById(id);
      if (el && !el.dataset.bound) { el.dataset.bound = '1'; el.addEventListener('input', () => this.renderItems()); el.addEventListener('change', () => this.renderItems()); }
    });
    const arch = document.getElementById('invShowArchived');
    if (arch && !arch.dataset.bound) { arch.dataset.bound = '1'; arch.addEventListener('change', () => this.renderItems()); }
    ['invFType', 'invFFrom', 'invFTo', 'invFUser'].forEach(id => {
      const el = document.getElementById(id);
      if (el && !el.dataset.bound) { el.dataset.bound = '1'; el.addEventListener('change', () => this.applyFilters()); }
    });
    const fsearch = document.getElementById('invFSearch');
    if (fsearch && !fsearch.dataset.bound) { fsearch.dataset.bound = '1'; fsearch.addEventListener('input', () => this.applyFilters()); }
    const tfilter = document.getElementById('invTransferFilter');
    if (tfilter && !tfilter.dataset.bound) { tfilter.dataset.bound = '1'; tfilter.addEventListener('change', () => this.renderTransfers()); }
    const ostatus = document.getElementById('invOrderStatus');
    if (ostatus && !ostatus.dataset.bound) { ostatus.dataset.bound = '1'; ostatus.addEventListener('change', () => this.renderOrders()); }
    // fill responsible-user filter
    const userSel = document.getElementById('invFUser');
    if (userSel && !userSel.dataset.filled) {
      userSel.dataset.filled = '1';
      const users = [...new Set(Inventory.movements().map(m => JSON.stringify({ id: m.byId, name: m.byName })))].map(x => JSON.parse(x));
      userSel.innerHTML = '<option value="">All Users</option>' + users.map(u => `<option value="${u.id}">${esc(u.name)}</option>`).join('');
    }
  }
};

/* ---------- SIDEBAR HOOK ---------- */
window.onSectionOpen = (function (prev) {
  return function (section, anchor) {
    if (typeof prev === 'function') { try { prev(section, anchor); } catch (e) { console.error(e); } }
    try {
      if (section === 'inv-items') InventoryUI.renderItems();
      if (section === 'inv-movements') InventoryUI.renderMovements();
      if (section === 'inv-transfers') InventoryUI.renderTransfers();
      if (section === 'inv-procurement') { InventoryUI.renderSuppliers(); InventoryUI.renderOrders(); }
      if (section === 'inv-requests') InventoryUI.renderRequests();
      if (section === 'inv-reports') InventoryUI.renderReports();
      if (section === 'inv-dashboard') InventoryUI.renderDashboard();
      if (section === 'approvals-monitor' && typeof renderApprovalMonitor === 'function') renderApprovalMonitor();
    } catch (e) { console.error(e); }
  };
})(window.onSectionOpen);
