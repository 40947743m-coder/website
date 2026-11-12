/* ============================================================
   ST. TERESA ACADEMY — REVIEW & OPERATIONS PORTALS
   Chief Examiner · Headteacher · Store · Kitchen · Uniforms
   Builds each portal page from a config, then wires the
   approval-workflow and inventory modules into it.
   Loaded AFTER admin.js + modules.js + portals.js +
   timetable.js + approvals.js + inventory.js
   ============================================================ */

/* ---------- SHARED MARK-UP ---------- */
const TT_GRID_HTML = `
<div class="panel">
  <div class="panel-head">
    <h3><i class="fas fa-calendar-days" style="color:var(--gold)"></i> Timetable Grid</h3>
    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
      <span id="ttPublishState"></span>
      <button class="btn btn-xs btn-outline" onclick="ttPrintScope()"><i class="fas fa-print"></i> Print</button>
    </div>
  </div>
  <div class="panel-body">
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;align-items:flex-end">
      <div class="btn-group" style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-ttmode="class" onclick="ttGridMode('class')"><i class="fas fa-school"></i> Class</button>
        <button class="btn btn-sm btn-outline" data-ttmode="teacher" onclick="ttGridMode('teacher')"><i class="fas fa-chalkboard-teacher"></i> Teacher</button>
        <button class="btn btn-sm btn-outline" data-ttmode="room" onclick="ttGridMode('room')"><i class="fas fa-door-open"></i> Classroom</button>
      </div>
      <div class="form-group" style="margin:0" data-ttfilter="class"><label>Class</label><select id="ttgClass" onchange="renderTtGrid()"></select></div>
      <div class="form-group" style="margin:0;display:none" data-ttfilter="teacher"><label>Teacher</label><select id="ttgTeacher" onchange="renderTtGrid()"></select></div>
      <div class="form-group" style="margin:0;display:none" data-ttfilter="room"><label>Classroom</label><select id="ttgRoom" onchange="renderTtGrid()"></select></div>
      <span id="ttGenReport" style="flex:1;min-width:200px"></span>
    </div>
    <div id="ttFullGrid"></div>
  </div>
</div>`;

const PORTAL_MODALS = `
<!-- APPROVAL PREVIEW -->
<div class="modal-overlay" id="approvalPreviewModal">
  <div class="modal modal-lg">
    <div class="modal-head"><h3 id="approvalPreviewTitle">Document</h3><button class="modal-close" onclick="closeModal('approvalPreviewModal')">&times;</button></div>
    <div class="modal-body" id="approvalPreviewBody" style="max-height:74vh;overflow-y:auto"></div>
  </div>
</div>

<!-- INVENTORY: ITEM -->
<div class="modal-overlay" id="invItemModal">
  <div class="modal modal-lg">
    <div class="modal-head"><h3 id="invItemTitle">Add New Item</h3><button class="modal-close" onclick="closeModal('invItemModal')">&times;</button></div>
    <div class="modal-body">
      <form id="invItemForm">
        <div class="form-grid">
          <div class="form-group"><label>Item Name <span class="req">*</span></label><input type="text" id="invName" required></div>
          <div class="form-group"><label>Item Code / SKU</label><input type="text" id="invCode" placeholder="auto-generated if blank"></div>
          <div class="form-group full"><label>Description</label><textarea id="invDesc" rows="2"></textarea></div>
          <div class="form-group"><label>Category</label><input type="text" id="invCategory" placeholder="e.g. Foodstuffs, Uniform, Stationery"></div>
          <div class="form-group"><label>Unit of Measurement</label><select id="invUnit"></select></div>
          <div class="form-group" id="invItemTypeWrap" style="display:none"><label>Item Type</label>
            <select id="invItemType"><option value="">—</option>${UNIFORM_ITEM_TYPES.map(t => `<option>${t}</option>`).join('')}</select></div>
          <div class="form-group"><label>Supplier</label><select id="invSupplier"></select></div>
          <div class="form-group full" style="background:var(--info-bg);color:var(--info);padding:10px 12px;border-radius:8px;font-size:.83rem;line-height:1.5">
            <i class="fas fa-circle-info"></i> <strong>Stock status is automatic</strong> — it is calculated from the available quantity and cannot be set by hand:
            <strong>0–9</strong> → Low stock · <strong>10–20</strong> → Normal stock · <strong>21+</strong> → Active. It updates by itself whenever stock is received, issued or adjusted.
          </div>
          <div class="form-group"><label>Purchase Price (Ksh)</label><input type="number" id="invPrice" min="0" step="0.01" value="0"></div>
          <div class="form-group"><label>Selling Price (Ksh)</label><input type="number" id="invSell" min="0" step="0.01" value="0"></div>
          <div class="form-group"><label>Storage Location</label><input type="text" id="invLocation" placeholder="e.g. Aisle 2 / Kitchen"></div>
          <div class="form-group"><label>Expiry Date</label><input type="date" id="invExpiry"></div>
          <div class="form-group"><label>Batch Number</label><input type="text" id="invBatch"></div>
          <div class="form-group" id="invSizeWrap" style="display:none"><label>Clothing Size</label>
            <select id="invClothingSize"><option value="">—</option>${['3-4Y', '5-6Y', '7-8Y', '9-10Y', '11-12Y', '13-14Y', 'XS', 'S', 'M', 'L', 'XL', 'XXL'].map(s => `<option>${s}</option>`).join('')}</select></div>
          <div class="form-group" id="invSizeWrap2" style="display:none"><label>Shoe Size</label>
            <input type="text" id="invShoeSize" placeholder="e.g. UK 12, EU 30"></div>
          <div class="form-group"><label>Colour</label><input type="text" id="invColor"></div>
          <div class="form-group" id="invOpeningWrap"><label>Opening Quantity</label><input type="number" id="invOpening" min="0" value="0"></div>
          <div class="form-group full" id="invUniformDeptWrap" style="display:none"><label>Department</label><input type="text" id="invUniformDept" readonly style="background:var(--cream);font-weight:700"></div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-primary" onclick="InventoryUI.saveItem()"><i class="fas fa-floppy-disk"></i> Save Item</button>
          <button type="button" class="btn btn-outline" onclick="closeModal('invItemModal')">Close</button>
        </div>
      </form>
    </div>
  </div>
</div>

<!-- INVENTORY: ITEM DETAILS -->
<div class="modal-overlay" id="invItemDetailModal">
  <div class="modal modal-lg">
    <div class="modal-head"><h3 id="invItemDetailTitle">Item</h3><button class="modal-close" onclick="closeModal('invItemDetailModal')">&times;</button></div>
    <div class="modal-body" id="invItemDetailBody" style="max-height:74vh;overflow-y:auto"></div>
  </div>
</div>

<!-- INVENTORY: STOCK IN/OUT -->
<div class="modal-overlay" id="invStockModal">
  <div class="modal">
    <div class="modal-head"><h3 id="invStockTitle">Stock</h3><button class="modal-close" onclick="closeModal('invStockModal')">&times;</button></div>
    <div class="modal-body">
      <p id="invStockInfo" style="font-weight:700;color:var(--navy);margin-bottom:12px"></p>
      <form id="invStockForm">
        <div class="form-grid">
          <div class="form-group"><label>Quantity <span class="req">*</span></label><input type="number" id="invStockQty" min="1" value="1" required></div>
          <div class="form-group" id="invStockExpiryWrap"><label>Expiry Date (if applicable)</label><input type="date" id="invStockExpiry"></div>
          <div class="form-group full"><label>Reason <span class="req">*</span></label><input type="text" id="invStockReason" placeholder="e.g. Delivery from supplier / Issued to kitchen"></div>
          <div class="form-group full"><label>Notes</label><textarea id="invStockNotes" rows="2"></textarea></div>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary"><i class="fas fa-floppy-disk"></i> Record Stock</button>
          <button type="button" class="btn btn-outline" onclick="closeModal('invStockModal')">Cancel</button>
        </div>
      </form>
    </div>
  </div>
</div>

<!-- INVENTORY: ADJUST -->
<div class="modal-overlay" id="invAdjustModal">
  <div class="modal">
    <div class="modal-head"><h3 id="invAdjustTitle">Adjustment</h3><button class="modal-close" onclick="closeModal('invAdjustModal')">&times;</button></div>
    <div class="modal-body">
      <p id="invAdjustInfo" style="font-weight:700;color:var(--navy);margin-bottom:12px"></p>
      <form id="invAdjustForm">
        <div class="form-grid">
          <div class="form-group"><label>Change (+ to add, − to remove) <span class="req">*</span></label><input type="number" id="invAdjustQty" value="0" required></div>
          <div class="form-group full"><label>Reason <span class="req">*</span></label><input type="text" id="invAdjustReason" placeholder="Why is this adjustment being made?" required></div>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary"><i class="fas fa-floppy-disk"></i> Save Adjustment</button>
          <button type="button" class="btn btn-outline" onclick="closeModal('invAdjustModal')">Cancel</button>
        </div>
      </form>
    </div>
  </div>
</div>

<!-- TRANSFER TO KITCHEN -->
<div class="modal-overlay" id="invTransferModal">
  <div class="modal modal-lg">
    <div class="modal-head"><h3>Transfer Items to Kitchen</h3><button class="modal-close" onclick="closeModal('invTransferModal')">&times;</button></div>
    <div class="modal-body">
      <div style="background:var(--info-bg);color:var(--info);padding:12px;border-radius:8px;font-size:.86rem;margin-bottom:14px">
        <i class="fas fa-circle-info"></i> Stock is <strong>not</strong> deducted until the Kitchen Manager reviews the delivery and clicks <strong>Confirm Receipt</strong>.
      </div>
      <form id="invTransferForm">
        <div class="form-group"><label>Select Item</label>
          <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap">
            <select id="trfItem" style="flex:1;min-width:200px"></select>
            <button type="button" class="btn btn-outline" onclick="InventoryUI.addTransferLine()"><i class="fas fa-plus"></i> Add</button>
          </div>
        </div>
        <div id="trfLines" style="margin-top:12px"></div>
        <div class="form-group" style="margin-top:10px"><label>Transfer Notes</label><textarea id="trfNotes" rows="2" placeholder="Condition, reference, special instructions…"></textarea></div>
        <div class="form-actions">
          <button type="submit" class="btn btn-gold"><i class="fas fa-truck-ramp-box"></i> Submit Transfer</button>
          <button type="button" class="btn btn-outline" onclick="closeModal('invTransferModal')">Cancel</button>
        </div>
      </form>
    </div>
  </div>
</div>

<!-- KITCHEN CONFIRM RECEIPT -->
<div class="modal-overlay" id="invConfirmModal">
  <div class="modal modal-lg">
    <div class="modal-head"><h3>Confirm Receipt — <span id="invConfirmRef"></span></h3><button class="modal-close" onclick="closeModal('invConfirmModal')">&times;</button></div>
    <div class="modal-body">
      <div id="invConfirmAuth" style="background:var(--success-bg);color:var(--success);padding:12px;border-radius:8px;font-weight:600;margin-bottom:12px"></div>
      <form id="invConfirmForm">
        <div class="form-grid">
          <div class="form-group"><label>Type your first name (acknowledgment) <span class="req">*</span></label>
            <input type="text" id="invConfirmFirst" required autocomplete="given-name" placeholder="First name"></div>
          <div class="form-group"><label>Delivery Note</label><input type="text" id="invConfirmNote" placeholder="Optional"></div>
        </div>
        <h4 style="color:var(--navy);margin:14px 0 8px">Quantities Actually Received</h4>
        <div id="invConfirmLines"></div>
        <div class="form-actions">
          <button type="submit" class="btn btn-gold"><i class="fas fa-clipboard-check"></i> Confirm Receipt</button>
          <button type="button" class="btn btn-outline" onclick="closeModal('invConfirmModal')">Cancel</button>
        </div>
      </form>
    </div>
  </div>
</div>

<!-- KITCHEN REQUEST -->
<div class="modal-overlay" id="invRequestModal">
  <div class="modal">
    <div class="modal-head"><h3>Request Stock from Main Store</h3><button class="modal-close" onclick="closeModal('invRequestModal')">&times;</button></div>
    <div class="modal-body">
      <form id="invRequestForm">
        <div class="form-group"><label>Select Item</label>
          <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap">
            <select id="reqItem" style="flex:1;min-width:200px"></select>
            <button type="button" class="btn btn-outline" onclick="InventoryUI.addRequestLine()"><i class="fas fa-plus"></i> Add</button>
          </div>
        </div>
        <div id="reqLines" style="margin-top:12px"></div>
        <div class="form-group" style="margin-top:10px"><label>Notes</label><textarea id="reqNotes" rows="2" placeholder="Urgency, menu plan, event…"></textarea></div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary"><i class="fas fa-paper-plane"></i> Send Request</button>
          <button type="button" class="btn btn-outline" onclick="closeModal('invRequestModal')">Cancel</button>
        </div>
      </form>
    </div>
  </div>
</div>

<!-- SUPPLIER -->
<div class="modal-overlay" id="invSupplierModal">
  <div class="modal">
    <div class="modal-head"><h3>Add Supplier</h3><button class="modal-close" onclick="closeModal('invSupplierModal')">&times;</button></div>
    <div class="modal-body">
      <form id="invSupplierForm">
        <div class="form-grid">
          <div class="form-group"><label>Supplier Name <span class="req">*</span></label><input type="text" id="supName" required></div>
          <div class="form-group"><label>Contact Person</label><input type="text" id="supContact"></div>
          <div class="form-group"><label>Phone</label><input type="tel" id="supPhone"></div>
          <div class="form-group"><label>Email</label><input type="email" id="supEmail"></div>
          <div class="form-group full"><label>Address</label><input type="text" id="supAddress"></div>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary"><i class="fas fa-floppy-disk"></i> Save Supplier</button>
          <button type="button" class="btn btn-outline" onclick="closeModal('invSupplierModal')">Cancel</button>
        </div>
      </form>
    </div>
  </div>
</div>

<!-- PURCHASE ORDER -->
<div class="modal-overlay" id="invOrderModal">
  <div class="modal modal-lg">
    <div class="modal-head"><h3>New Purchase Request / Order</h3><button class="modal-close" onclick="closeModal('invOrderModal')">&times;</button></div>
    <div class="modal-body">
      <form id="invOrderForm">
        <div class="form-grid">
          <div class="form-group"><label>Supplier <span class="req">*</span></label><select id="poSupplier" required></select></div>
          <div class="form-group"><label>Purchase Date</label><input type="date" id="poOrderDate" value="${today()}"></div>
          <div class="form-group"><label>Expected Delivery Date</label><input type="date" id="poDeliveryDate"></div>
          <div class="form-group"><label>Invoice Number</label><input type="text" id="poInvoice"></div>
          <div class="form-group full"><label>Notes</label><input type="text" id="poNotes"></div>
        </div>
        <h4 style="color:var(--navy);margin:14px 0 8px">Items</h4>
        <div id="poLines"></div>
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
          <button type="button" class="btn btn-sm btn-outline" onclick="InventoryUI.addOrderLine()"><i class="fas fa-plus"></i> Add Item Line</button>
          <div style="font-weight:800;color:var(--navy)">Total: <span id="poTotal">${money(0)}</span></div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-primary" onclick="InventoryUI.saveOrder()"><i class="fas fa-floppy-disk"></i> Save Order</button>
          <button type="button" class="btn btn-outline" onclick="closeModal('invOrderModal')">Cancel</button>
        </div>
      </form>
    </div>
  </div>
</div>

<!-- RECEIVE DELIVERY -->
<div class="modal-overlay" id="invReceiveModal">
  <div class="modal modal-lg">
    <div class="modal-head"><h3>Record Delivery</h3><button class="modal-close" onclick="closeModal('invReceiveModal')">&times;</button></div>
    <div class="modal-body">
      <form id="invReceiveForm">
        <div id="invReceiveBody"></div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary"><i class="fas fa-truck"></i> Save Delivery</button>
          <button type="button" class="btn btn-outline" onclick="closeModal('invReceiveModal')">Cancel</button>
        </div>
      </form>
    </div>
  </div>
</div>

<!-- ORDER DETAIL -->
<div class="modal-overlay" id="invOrderDetailModal">
  <div class="modal modal-lg">
    <div class="modal-head"><h3 id="invOrderDetailTitle">Order</h3><button class="modal-close" onclick="closeModal('invOrderDetailModal')">&times;</button></div>
    <div class="modal-body" id="invOrderDetailBody" style="max-height:74vh;overflow-y:auto"></div>
  </div>
</div>

<!-- REPORT PREVIEW -->
<div class="modal-overlay" id="invReportPreviewModal">
  <div class="modal modal-lg">
    <div class="modal-head"><h3 id="invReportPreviewTitle">Report</h3><button class="modal-close" onclick="closeModal('invReportPreviewModal')">&times;</button></div>
    <div class="modal-body" id="invReportPreviewBody" style="max-height:74vh;overflow-y:auto"></div>
    <div style="padding:0 24px 20px;display:flex;gap:8px">
      <button class="btn btn-primary" onclick="window.print()"><i class="fas fa-print"></i> Print</button>
    </div>
  </div>
</div>`;

/* ---------- PAGE BUILDER ---------- */
function buildPortalPage(cfg) {
  document.title = cfg.brand + ' | St. Teresa Academy';
  const root = document.getElementById('portalRoot') || document.body;
  root.innerHTML = `
<div class="admin-layout">
  <aside class="sidebar" id="sidebar">
    <div class="sidebar-header">
      <div class="brand-mini">
        <div class="crest-mini">ST</div>
        <div><h2>St. Teresa Kanyange Academy</h2><span>${esc(cfg.brand)}</span></div>
      </div>
    </div>
    <nav class="sidebar-nav">
      ${cfg.nav.map(n => n.label ? `<div class="nav-label">${esc(n.label)}</div>` :
    `<a href="#" data-section="${n.id}" data-title="${esc(n.title)}" ${n.active ? 'class="active"' : ''}><i class="fas ${n.icon}"></i> ${esc(n.title)}${n.badge ? ` <span class="badge badge-danger" id="${n.badge}" style="display:none;margin-left:4px"></span>` : ''}</a>`).join('')}
    </nav>
    <div class="sidebar-footer">
      <a href="../index.html"><i class="fas fa-globe"></i> View Website</a>
      <a href="../admin/login.html"><i class="fas fa-right-from-bracket"></i> Logout</a>
    </div>
  </aside>
  <div class="sidebar-overlay" id="sidebarOverlay"></div>
  <main class="main-content">
    <header class="topbar">
      <div class="topbar-left"><button class="menu-toggle" id="menuToggle"><i class="fas fa-bars"></i></button><h1 id="topbarTitle">${esc(cfg.sections[0].title)}</h1></div>
      <div class="topbar-right">
        <div class="user-chip" id="userChip"></div>
        <button class="logout-btn" id="logoutBtn"><i class="fas fa-right-from-bracket"></i> Logout</button>
      </div>
    </header>
    <div class="page-body">
      ${cfg.sections.map((s, i) => `
      <section class="page-section ${i === 0 ? 'active' : ''}" id="sec-${s.id}">
        <div class="section-head"><div><h2>${esc(s.title)}</h2><p>${s.sub || ''}</p></div>${s.head || ''}</div>
        ${s.html}
      </section>`).join('')}
    </div>
  </main>
</div>
${cfg.modals !== undefined ? cfg.modals : PORTAL_MODALS}`;
}

function statsHTML(items) {
  return `<div class="stats-row">${items.map(s => `
    <div class="stat-card">
      <div class="s-icon ${s.color || 'navy'}"><i class="fas ${s.icon}"></i></div>
      <div class="s-info"><div class="s-num" id="${s.id}">0</div><div class="s-label">${esc(s.label)}</div></div>
    </div>`).join('')}</div>`;
}

/* ============================================================
   CHIEF EXAMINER / HEADTEACHER REVIEW PORTALS
   ============================================================ */
function initReviewPortal(page) {
  const s = Auth.require([page]);
  if (!s) return;
  const isChief = page === 'chiefexaminer';

  buildPortalPage({
    brand: isChief ? 'Chief Examiner Portal' : 'Headteacher Portal',
    nav: [
      { label: 'Main' },
      { id: 'dashboard', title: 'Dashboard', icon: 'fa-gauge-high', active: true },
      { label: 'Approvals' },
      {
        id: isChief ? 'ce-queue' : 'ht-queue',
        title: isChief ? 'Pending Review' : 'Pending Approval',
        icon: 'fa-inbox',
        badge: isChief ? 'ceBadge' : 'htBadge'
      },
      { id: isChief ? 'ce-reviewed' : 'ht-reviewed', title: isChief ? 'Reviewed by Me' : 'My Decisions', icon: 'fa-clipboard-check' },
      { label: 'School' },
      { id: 'tt-grid', title: 'Official Timetable', icon: 'fa-calendar-days' },
      { id: 'fees', title: 'Fee Structures', icon: 'fa-layer-group' },
      ...(isChief ? [] : [
        { id: 'att-overview', title: 'Attendance Overview', icon: 'fa-clipboard-list' },
        { id: 'performance', title: 'Class Performance', icon: 'fa-chart-line' }
      ]),
      { id: 'audit', title: 'Audit Log', icon: 'fa-clock-rotate-left' }
    ],
    sections: [
      {
        id: 'dashboard', title: isChief ? 'Chief Examiner Dashboard' : 'Headteacher Dashboard',
        sub: isChief
          ? 'Review examination papers, marking schemes, marks and results before they proceed to the Headteacher.'
          : 'Documents approved by the Chief Examiner arrive here for your approval before they reach the Secretary.',
        html: statsHTML([
          { id: 'rvPending', label: isChief ? 'Awaiting My Review' : 'Awaiting My Approval', icon: 'fa-inbox', color: 'gold' },
          { id: 'rvDone', label: 'Decisions I Have Made', icon: 'fa-clipboard-check', color: 'green' },
          { id: 'rvRejected', label: 'Rejected / Returned', icon: 'fa-rotate-left', color: 'red' },
          { id: 'rvPublished', label: 'Published Documents', icon: 'fa-bullhorn', color: 'blue' },
          { id: 'rvTotal', label: 'Total Submissions', icon: 'fa-files', color: 'navy' }
        ]) + `
        <div class="panel">
          <div class="panel-head"><h3><i class="fas fa-list" style="color:var(--gold)"></i> Recent Activity</h3></div>
          <div class="panel-body" id="rvActivity"></div>
        </div>
        ${isChief ? '' : '<div id="rvAttDash"></div>'}`
      },
      {
        id: isChief ? 'ce-queue' : 'ht-queue',
        title: isChief ? 'Pending Chief Examiner Review' : 'Pending Headteacher Approval',
        sub: 'Preview each document, then approve and forward it, or reject it with a reason so the teacher can correct it.',
        html: `
        <div class="panel">
          <div class="panel-body" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
            <input type="text" id="${isChief ? 'ceSearch' : 'htSearch'}" placeholder="Search tracking no, title, class…" style="flex:1;min-width:220px;padding:9px 12px;border:1px solid var(--border);border-radius:8px">
            <select id="${isChief ? 'ceType' : 'htType'}" style="padding:9px 12px;border:1px solid var(--border);border-radius:8px">
              <option value="">All Types</option>${Submissions.TYPES.map(t => `<option value="${t.id}">${esc(t.label)}</option>`).join('')}
            </select>
          </div>
          <div class="panel-body" id="${isChief ? 'cePendingBody' : 'htPendingBody'}"></div>
        </div>`
      },
      {
        id: isChief ? 'ce-reviewed' : 'ht-reviewed',
        title: isChief ? 'Previously Reviewed Submissions' : 'My Approval History',
        sub: 'Every decision you made, with the comment, date and time.',
        html: `<div class="panel"><div class="panel-body" id="${isChief ? 'ceDoneBody' : 'htDoneBody'}"></div></div>`
      },
      { id: 'tt-grid', title: 'Official Timetable', sub: 'Read-only view of the published school timetable.', html: TT_GRID_HTML },
      {
        id: 'fees', title: 'Fee Structures (Read-Only)',
        sub: 'The school fee catalogue and the per-class fee structures. Only the Secretary may create or change them — this view is for reference.',
        html: `
        <div class="panel" style="margin-bottom:18px">
          <div class="panel-head"><h3><i class="fas fa-layer-group" style="color:var(--gold)"></i> Class Fee Structures</h3>
            <small style="color:var(--text-light)">Read-only</small></div>
          <div class="panel-body table-wrap">
            <table class="data-table"><thead><tr><th>Class</th><th>Academic Year</th><th>Term</th><th>Fee Lines</th><th>Total</th><th>Status</th></tr></thead>
            <tbody id="rvClassFeesBody"></tbody></table>
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><h3><i class="fas fa-tags" style="color:var(--gold)"></i> School Fee Items</h3>
            <small style="color:var(--text-light)">Read-only</small></div>
          <div class="panel-body table-wrap">
            <table class="data-table"><thead><tr><th>Fee Item</th><th>Amount</th><th>Status</th><th>Last Updated</th></tr></thead>
            <tbody id="rvFeeItemsBody"></tbody></table>
          </div>
        </div>`
      },
      {
        id: 'audit', title: 'Audit Log', sub: 'Immutable record of who did what and when.',
        html: `<div class="panel"><div class="panel-body table-wrap">
          <table class="data-table"><thead><tr><th>When</th><th>User</th><th>Role</th><th>Action</th><th>Details</th></tr></thead>
          <tbody id="rvAuditBody"></tbody></table></div></div>`
      },
      ...(isChief ? [] : [
        {
          id: 'att-overview', title: 'Attendance Overview',
          sub: 'Daily, weekly and monthly attendance summaries across the whole school. View-only.',
          html: `
          <div class="panel">
            <div class="panel-body" style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
              <div class="form-group" style="margin:0"><label>Report Period</label>
                <select id="attOvRange"><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select>
              </div>
              <div class="form-group" style="margin:0"><label>Date</label><input type="date" id="attOvDate"></div>
              <div class="form-group" style="margin:0"><label>Class</label><select id="attOvClass"><option value="">All classes</option></select></div>
              <button class="btn btn-primary" onclick="renderAttendanceOverview()"><i class="fas fa-rotate"></i> Refresh</button>
              <button class="btn btn-outline" onclick="printAttendanceOverview()"><i class="fas fa-print"></i> Print</button>
            </div>
          </div>
          <div class="stats-row" id="attOvSummary"></div>
          <div class="panel"><div class="panel-head"><h3>Attendance by Class</h3></div>
            <div class="panel-body table-wrap"><table class="data-table">
              <thead><tr><th>Class</th><th>Class Teacher</th><th>Enrolled</th><th>Present</th><th>Absent</th><th>Late</th><th>Excused</th><th>Attendance %</th></tr></thead>
              <tbody id="attOvBody"></tbody></table></div></div>
          <div class="panel"><div class="panel-head"><h3>Students Needing Follow-up</h3><small id="attOvAbsentNote" style="color:var(--text-light)"></small></div>
            <div class="panel-body" id="attOvAbsentees"></div></div>`
        },
        {
          id: 'performance', title: 'Class Performance',
          sub: 'Automatic class-performance monitoring and feedback based only on finalized examination results. View-only.',
          html: `
          <div class="panel">
            <div class="panel-body" style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
              <div class="form-group" style="margin:0"><label>Class</label><select id="perfClass"><option value="">All classes</option></select></div>
              <div class="form-group" style="margin:0"><label>Subject</label><select id="perfSubject"><option value="">All subjects</option></select></div>
              <div class="form-group" style="margin:0"><label>Academic Year</label><select id="perfYear"><option value="">All years</option></select></div>
              <button class="btn btn-primary" onclick="renderPerformanceBoard()"><i class="fas fa-rotate"></i> Refresh</button>
              <button class="btn btn-outline" onclick="printPerformanceBoard()"><i class="fas fa-print"></i> Print</button>
            </div>
          </div>
          <div class="stats-row" id="perfSummary"></div>
          <div id="perfTargetsPanel"></div>
          <div class="panel"><div class="panel-head"><h3>Class Performance &amp; Automatic Feedback</h3></div>
            <div class="panel-body table-wrap"><table class="data-table">
              <thead><tr><th>Class</th><th>Class Teacher</th><th>Students</th><th>Finalized Exams</th><th>Average</th><th>Pass Rate</th><th>Trend</th><th>Automatic Feedback</th></tr></thead>
              <tbody id="perfBody"></tbody></table></div></div>`
        }
      ])
    ]
  });

  renderTopbarUser(s);
  initSidebar();
  renderReviewDashboard(isChief);
  renderChiefExaminerQueue();
  renderHeadteacherQueue();
  renderReviewAudit();
  wireReviewFilters(isChief);
  fillTtSelects();
  renderTtGrid();
  renderReviewFees();
}

/* Read-only fee view for the Headteacher / Chief Examiner.
   No action buttons exist here, and the data layer refuses the same
   operations for these roles anyway (Fees.* / Payments.*). */
function renderReviewFees() {
  const cls = document.getElementById('rvClassFeesBody');
  const items = document.getElementById('rvFeeItemsBody');
  if (cls) {
    const list = (typeof Fees !== 'undefined') ? Fees.classStructures() : [];
    cls.innerHTML = list.length ? list.map(s => `
      <tr>
        <td><strong>${esc(s.className)}</strong></td>
        <td>${esc(s.academicYear)}</td>
        <td>${s.term ? 'Term ' + esc(s.term) : 'All terms'}</td>
        <td>${s.items.map(i => esc(i.name)).join(', ')}</td>
        <td>${money(s.total)}</td>
        <td><span class="badge badge-${s.active === false ? 'warning' : 'success'}">${s.active === false ? 'Inactive' : 'Active'}</span></td>
      </tr>`).join('')
      : '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-light)">No class fee structures configured yet.</td></tr>';
  }
  if (items) {
    const list = (typeof Fees !== 'undefined') ? Fees.items() : [];
    items.innerHTML = list.length ? list.map(it => `
      <tr>
        <td><strong>${esc(it.name)}</strong></td>
        <td>${money(it.price)}</td>
        <td><span class="badge badge-${it.active === false ? 'warning' : 'success'}">${it.active === false ? 'Inactive' : 'Active'}</span></td>
        <td>${esc(it.updatedAt ? fmtDate(it.updatedAt) : fmtDate(it.createdAt))}</td>
      </tr>`).join('')
      : '<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--text-light)">No fee items configured yet.</td></tr>';
  }
}

function wireReviewFilters(isChief) {
  const ids = isChief ? ['ceSearch', 'ceType'] : ['htSearch', 'htType'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el || el.dataset.bound) return;
    el.dataset.bound = '1';
    el.addEventListener('input', () => (isChief ? renderChiefExaminerQueue() : renderHeadteacherQueue()));
    el.addEventListener('change', () => (isChief ? renderChiefExaminerQueue() : renderHeadteacherQueue()));
  });
}

function renderReviewDashboard(isChief) {
  const stats = Submissions.statsFor();
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  const s = Auth.session();
  const mine = s ? Submissions.reviewedBy(s.id) : [];
  set('rvPending', isChief ? stats.chiefexaminer : stats.headteacher);
  set('rvDone', mine.length);
  set('rvRejected', stats.rejected);
  set('rvPublished', stats.published);
  set('rvTotal', stats.total);
  const badge = document.getElementById(isChief ? 'ceBadge' : 'htBadge');
  if (badge) {
    const n = isChief ? stats.chiefexaminer : stats.headteacher;
    badge.textContent = n;
    badge.style.display = n ? '' : 'none';
  }
  const act = document.getElementById('rvActivity');
  if (act) {
    const recent = Submissions.list().slice().reverse().slice(0, 8);
    act.innerHTML = recent.length ? recent.map(x => `
      <div style="display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid var(--border);flex-wrap:wrap">
        <div><strong style="color:var(--navy)">${esc(x.title)}</strong>
          <br><small style="color:var(--text-light)"><code>${esc(x.trackingNo)}</code> · ${esc(x.submittedByName)} · ${fmtDate(x.submittedAt)}</small></div>
        <div>${ApprovalUI.badge(x.status)}</div>
      </div>`).join('') : '<p style="color:var(--text-light)">No submissions yet.</p>';
  }
  window.renderReviewDashboard = function () { renderReviewDashboard(isChief); };
}
window.renderSubmissionStats = function () { renderReviewDashboard(document.body.dataset.page === 'chiefexaminer'); };

function renderChiefExaminerQueue() {
  ApprovalUI.renderQueue('cePendingBody', {
    stage: 'chiefexaminer', showSubmitter: true,
    filter: x => x.status === 'chiefexaminer',
    searchId: 'ceSearch', typeFilterId: 'ceType',
    emptyText: 'No documents are awaiting Chief Examiner review.'
  });
  renderReviewedList('ceDoneBody', 'chiefexaminer');
  const st = Submissions.statsFor();
  const b = document.getElementById('ceBadge');
  if (b) { b.textContent = st.chiefexaminer; b.style.display = st.chiefexaminer ? '' : 'none'; }
}
function renderHeadteacherQueue() {
  ApprovalUI.renderQueue('htPendingBody', {
    stage: 'headteacher', showSubmitter: true,
    filter: x => x.status === 'headteacher',
    searchId: 'htSearch', typeFilterId: 'htType',
    emptyText: 'No documents are awaiting Headteacher approval.'
  });
  renderReviewedList('htDoneBody', 'headteacher');
  const st = Submissions.statsFor();
  const b = document.getElementById('htBadge');
  if (b) { b.textContent = st.headteacher; b.style.display = st.headteacher ? '' : 'none'; }
}
function renderReviewedList(containerId, stage) {
  const box = document.getElementById(containerId);
  if (!box) return;
  const s = Auth.session();
  if (!s) return;
  const items = Submissions.list().filter(x => (x.history || []).some(h => h.byId === s.id && ['approve', 'reject', 'publish', 'unpublish'].includes(h.action))).reverse();
  box.innerHTML = items.length ? `<div class="table-wrap"><table class="data-table">
    <thead><tr><th>Tracking No</th><th>Document</th><th>My Decision</th><th>Comment</th><th>When</th><th>Current Status</th><th></th></tr></thead>
    <tbody>${items.map(x => {
      const h = (x.history || []).filter(y => y.byId === s.id && ['approve', 'reject', 'publish', 'unpublish'].includes(y.action)).slice(-1)[0];
      return `<tr>
        <td><code>${esc(x.trackingNo)}</code></td>
        <td><strong>${esc(x.title)}</strong></td>
        <td><span class="badge badge-${h.action === 'approve' || h.action === 'publish' ? 'success' : 'danger'}">${esc(h.action)}</span></td>
        <td style="font-size:.83rem">${esc(h.comment || '—')}</td>
        <td>${esc(String(h.at || '').replace('T', ' ').slice(0, 16))}</td>
        <td>${ApprovalUI.badge(x.status)}</td>
        <td><button class="btn btn-xs btn-outline" onclick="ApprovalUI.preview('${x.id}')"><i class="fas fa-eye"></i></button></td>
      </tr>`;
    }).join('')}</tbody></table></div>`
    : `<div class="empty-state"><i class="fas fa-clipboard-check"></i><h4>No decisions yet</h4><p>Documents you approve or reject will be listed here.</p></div>`;
}
function renderReviewAudit() {
  const box = document.getElementById('rvAuditBody');
  if (!box) return;
  const logs = Audit.list(200);
  box.innerHTML = logs.length ? logs.map(l => `
    <tr><td style="white-space:nowrap">${esc(String(l.timestamp).replace('T', ' ').slice(0, 16))}</td>
    <td>${esc(l.userName)}</td><td><span class="badge badge-navy">${esc(l.role)}</span></td>
    <td><code>${esc(l.action)}</code></td><td>${esc(l.details)}</td></tr>`).join('')
    : '<tr><td colspan="5" style="text-align:center;color:var(--text-light)">No audit entries visible to you.</td></tr>';
}

/* ============================================================
   SECRETARY — FINAL REVIEW & PUBLICATION QUEUE
   ============================================================ */
function renderPublishQueue() {
  const typeSel = document.getElementById('secPubType');
  if (typeSel && typeSel.options.length < 2) {
    typeSel.innerHTML = '<option value="">All Types</option>' + Submissions.TYPES.map(t => `<option value="${t.id}">${esc(t.label)}</option>`).join('');
  }
  ['secPubSearch', 'secPubType'].forEach(id => {
    const el = document.getElementById(id);
    if (!el || el.dataset.bound) return;
    el.dataset.bound = '1';
    el.addEventListener('input', renderPublishQueue);
    el.addEventListener('change', renderPublishQueue);
  });
  const box = document.getElementById('secPublishBody');
  if (!box) return;
  const stats = Submissions.statsFor();
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  const awaiting = stats.secretary + stats.approved_final;
  set('secPubPending', awaiting);
  set('secPubPublished', stats.published);
  set('secPubRejected', stats.rejected);
  set('secPubTotal', stats.total);
  ApprovalUI.renderQueue('secPublishBody', {
    stage: 'secretary', showSubmitter: true,
    filter: x => x.status === 'secretary' || x.status === 'approved_final',
    searchId: 'secPubSearch', typeFilterId: 'secPubType',
    emptyText: 'No documents have completed the Chief Examiner and Headteacher approval stages yet.'
  });
  const hist = document.getElementById('secPublishHistory');
  if (hist) {
    const published = Submissions.list().filter(x => ['published', 'withdrawn'].includes(x.status)).reverse();
    hist.innerHTML = published.length ? `<div class="table-wrap"><table class="data-table">
      <thead><tr><th>Tracking No</th><th>Document</th><th>Portal</th><th>Published</th><th>Published By</th><th>Status</th><th></th></tr></thead>
      <tbody>${published.map(x => `<tr>
        <td><code>${esc(x.trackingNo)}</code></td>
        <td><strong>${esc(x.title)}</strong></td>
        <td><span class="badge badge-info">${esc(x.publishTarget || '—')}</span></td>
        <td>${esc(String(x.publishedAt || '').replace('T', ' ').slice(0, 16))}${x.scheduledAt ? `<br><small style="color:var(--text-light)">scheduled ${esc(x.scheduledAt)}</small>` : ''}</td>
        <td>${esc(x.publishedBy || '—')}</td>
        <td>${x.status === 'withdrawn' ? '<span class="badge badge-danger">Withdrawn</span>' : '<span class="badge badge-success">Published</span>'}</td>
        <td class="table-actions">
          <button class="btn btn-xs btn-outline" onclick="ApprovalUI.preview('${x.id}')"><i class="fas fa-eye"></i></button>
          ${x.status === 'published' ? `<button class="btn btn-xs btn-danger" onclick="ApprovalUI.unpublishPrompt('${x.id}')"><i class="fas fa-eye-slash"></i></button>` : ''}
        </td>
      </tr>`).join('')}</tbody></table></div>` : '<p style="color:var(--text-light)">Nothing published yet.</p>';
  }
}
window.renderSubmissionStats = window.renderSubmissionStats || function () {};

/* ============================================================
   ADMISSION REQUIREMENTS — UNIFORM & KIT CHECKLISTS
   Shown inside Inventory & Uniforms (Procurement & Stores Portal)
   ============================================================ */
const ADMISSION_SCHOOLS = [
  {
    key: 'junior',
    crest: 'JNR',
    level: 'Junior School',
    name: 'ST. TERESA KANYANGE JUNIOR SCHOOL',
    phone: '0700131515',
    uniformNote: 'NB: Original uniform is available in the school at reasonable prices.',
    groups: [
      {
        title: 'Bedding', icon: 'fa-bed',
        items: [
          'Standard school bed mattress 3/6',
          '2 heavy blankets',
          '2 pairs of bed sheets — blue, green or pink',
          '2 pillow cases — blue, green or pink',
          '1 pillow',
          '1 bedcover (Maasai, with equal large red and light green squares)',
          '1 mackintosh (for those who wet their beds)',
          '2 strong padlocks — for the box and the locker'
        ]
      },
      {
        title: 'Boys', icon: 'fa-person',
        items: [
          '3 cream yellow shirts with school logo',
          '3 grey trousers',
          'Dark blue blazer, gold striped, with school logo',
          'Navy-blue tie with gold stripes',
          'Short-sleeved black sweater, gold stripes, with school logo',
          'Long-sleeved black sweater, gold stripes, with school logo',
          '3 pairs short grey socks',
          'Grey-and-red striped track suit and red T-shirt',
          'Grey fleece jacket with school logo',
          '2 pairs of black leather shoes (Bata Toughees)',
          '2 large towels and 2 bathing towels',
          '2 sleeping suits (pyjamas)',
          '1 pair of slippers — preferably Bata',
          '1 large bucket / dozen of pegs',
          '1 pair quality sports shoes'
        ]
      },
      {
        title: 'Girls', icon: 'fa-person-dress',
        items: [
          '3 cream white blouses with school logo',
          '3 suspended skirts, checked with fold',
          '2 bow ties',
          'Short-sleeved black sweater, gold stripes, with school logo',
          'Long-sleeved black sweater, gold stripes, with school logo',
          '3 pairs white socks',
          'Red-and-grey striped track suit and red T-shirt',
          'Grey fleece jacket with school logo',
          '2 pairs of black leather shoes (Bata Toughees)',
          '2 large towels and 2 bathing towels',
          '2 night dresses and a pair of slippers',
          '4 black petticoats',
          '1 large bucket / dozen of pegs',
          '1 pair of slippers — preferably Bata',
          '1 pair quality sports shoes',
          'Cotton leso (optional)'
        ]
      },
      {
        title: 'Others', icon: 'fa-basket-shopping',
        items: [
          'Plate, mug and a spoon',
          'Enough soaps, at least 6 tissue papers, shoe polish, oil, toothbrush, toothpaste, legwarmers (black), handkerchiefs and enough underwear'
        ],
        notes: [
          'Pocket money of at least Ksh. 2,000 must be deposited and receipted in the office on the reporting day, for medical or personal use. Every student will have a personal account for easy follow-up.'
        ]
      }
    ]
  },
  {
    key: 'academy',
    crest: 'ACA',
    level: 'Academy',
    name: 'ST. TERESA KANYANGE ACADEMY',
    phone: '0700131515',
    uniformNote: 'NB: Original uniform is sold in the school at reasonable prices.',
    groups: [
      {
        title: 'Bedding', icon: 'fa-bed',
        items: [
          'Standard school bed mattress',
          '2 heavy blankets',
          '2 pairs of blue bed sheets',
          '2 pink pillow cases',
          '1 pink bedcover',
          '1 pillow',
          '1 mackintosh (for those who wet their beds)',
          '2 padlocks — for the box and the locker'
        ]
      },
      {
        title: 'Boys', icon: 'fa-person',
        items: [
          '2 navy-blue ready-made pullovers with two white stripes on the neck, hands and waist',
          '3 plain black trousers',
          '3 shirts with white and navy-blue stripes',
          '2 plain navy-blue ties',
          '2 pairs of black leather shoes (Bata Toughees)',
          '3 pairs grey socks with blue-white-blue stripes (scholars)',
          '1 large towel and 2 bathing towels',
          '2 sleeping suits (pyjamas)',
          '1 pair of slippers — preferably Bata',
          '1 large bucket / dozen of pegs',
          '1 plain navy-blue or black quality jacket',
          'Special occasions shirt — 2 sky-blue short-sleeved (as per sample)',
          'Navy-blue track suit / 2 yellow T-shirts for games',
          '1 pair quality sports shoes — not white in colour'
        ]
      },
      {
        title: 'Girls', icon: 'fa-person-dress',
        items: [
          '2 navy-blue ready-made pullovers with two white stripes on the neck, hands and waist',
          '3 dresses with white and navy-blue stripes',
          '4 black petticoats',
          '2 pairs of black leather shoes (Bata Toughees)',
          '3 pairs grey socks with blue-white-blue stripes (scholars)',
          '1 large towel and 2 bathing towels',
          '2 night dresses and a pair of slippers',
          '1 large bucket / dozen of pegs',
          '1 plain navy-blue or black quality jacket',
          'Special occasions uniform — 2 light purple coloured dresses and white socks (as per sample)',
          'Dark yellow track suit / 2 yellow T-shirts for games',
          '1 pair quality sports shoes — not white in colour',
          '1 leso'
        ]
      },
      {
        title: 'Others', icon: 'fa-basket-shopping',
        items: [
          'A copy of birth certificate attached with parents\' / guardian\'s IDs',
          'Plate, mug and a spoon',
          'Enough soaps, at least 6 tissue papers, enough sanitary towels (for girls), shoe polish, oil, toothbrush, toothpaste, legwarmers (navy-blue) and handkerchiefs'
        ],
        notes: [
          'Pocket money of at least Ksh. 2,000 must be deposited and receipted in the office on the reporting day, for medical or personal use. Every student will have a personal account for easy follow-up.'
        ]
      }
    ]
  }
];

function admissionCardHTML(sc) {
  const total = sc.groups.reduce((n, g) => n + g.items.length, 0);
  return `
  <div class="adm-card" data-adm-school="${sc.key}">
    <div class="adm-head">
      <div class="adm-crest">${esc(sc.crest)}</div>
      <div class="adm-title">
        <h4>${esc(sc.name)}</h4>
        <span><i class="fas fa-phone"></i> ${esc(sc.phone)} <b class="adm-sep">·</b> ${esc(sc.level)}</span>
      </div>
      <div class="adm-actions">
        <span class="adm-count" data-adm-count>0 / ${total} checked</span>
        <button type="button" class="btn btn-xs btn-outline adm-print-btn" onclick="printAdmissionList('${sc.key}')"><i class="fas fa-print"></i> Print</button>
      </div>
    </div>
    <div class="adm-intro">
      <p><i class="fas fa-circle-exclamation"></i><span>The following items <strong>MUST</strong> be checked before admission.</span></p>
      <p><i class="fas fa-tag"></i><span>All articles MUST be permanently labelled with the child's admission number.</span></p>
      <p class="adm-admno"><i class="fas fa-id-card"></i><span>Your child's Admission Number is <b class="adm-line"></b></span></p>
    </div>
    <div class="adm-note"><i class="fas fa-shirt"></i> ${esc(sc.uniformNote)}</div>
    <div class="adm-groups">
      ${sc.groups.map(g => `
      <div class="adm-group" data-adm-group>
        <div class="adm-group-head"><i class="fas ${g.icon}"></i><span>${esc(g.title)}</span><span class="adm-group-count" data-adm-group-count>0/${g.items.length}</span></div>
        <ul class="adm-list">
          ${g.items.map(it => `<li><label><input type="checkbox"><span>${esc(it)}</span></label></li>`).join('')}
        </ul>
        ${(g.notes || []).map(n => `<div class="adm-note adm-note-sm"><i class="fas fa-circle-info"></i> ${esc(n)}</div>`).join('')}
      </div>`).join('')}
    </div>
  </div>`;
}

function admissionPanelHTML() {
  return `
        <div class="panel" id="admReqPanel">
          <div class="panel-head">
            <h3><i class="fas fa-clipboard-check" style="color:var(--gold)"></i> Admission Requirements &amp; Uniform Checklists</h3>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <button type="button" class="btn btn-xs btn-outline" onclick="printAdmissionList('junior')"><i class="fas fa-print"></i> Print Junior List</button>
              <button type="button" class="btn btn-xs btn-outline" onclick="printAdmissionList('academy')"><i class="fas fa-print"></i> Print Academy List</button>
              <button type="button" class="btn btn-xs btn-danger" onclick="resetAdmissionChecks()"><i class="fas fa-rotate-left"></i> Clear Ticks</button>
            </div>
          </div>
          <div class="panel-body">
            <div class="adm-legend">
              <i class="fas fa-list-check"></i>
              <span>Official pre-admission articles for each school. Tick every item as it is verified against the child's kit, then print a hard copy for the reporting day.</span>
            </div>
            <div class="adm-grid" id="admReqBody">${ADMISSION_SCHOOLS.map(admissionCardHTML).join('')}</div>
          </div>
        </div>`;
}

function refreshAdmissionChecks() {
  const body = document.getElementById('admReqBody');
  if (!body) return;
  body.querySelectorAll('.adm-card').forEach(card => {
    const boxes = card.querySelectorAll('input[type="checkbox"]');
    const done = card.querySelectorAll('input[type="checkbox"]:checked').length;
    const c = card.querySelector('[data-adm-count]');
    if (c) c.textContent = done + ' / ' + boxes.length + ' checked';
    card.classList.toggle('adm-complete', boxes.length > 0 && done === boxes.length);
    card.querySelectorAll('[data-adm-group]').forEach(g => {
      const gb = g.querySelectorAll('input[type="checkbox"]');
      const gd = g.querySelectorAll('input[type="checkbox"]:checked').length;
      const gc = g.querySelector('[data-adm-group-count]');
      if (gc) gc.textContent = gd + '/' + gb.length;
      g.classList.toggle('adm-done', gb.length > 0 && gd === gb.length);
    });
  });
}

function initAdmissionChecklists() {
  const body = document.getElementById('admReqBody');
  if (!body || body.dataset.bound) return;
  body.dataset.bound = '1';
  body.addEventListener('change', e => { if (e.target && e.target.matches('input[type="checkbox"]')) refreshAdmissionChecks(); });
  refreshAdmissionChecks();
}

function resetAdmissionChecks() {
  const body = document.getElementById('admReqBody');
  if (!body) return;
  body.querySelectorAll('input[type="checkbox"]').forEach(b => { b.checked = false; });
  refreshAdmissionChecks();
  toast('All checklist ticks have been cleared.', 'info');
}

function printAdmissionList(key) {
  const sc = ADMISSION_SCHOOLS.find(x => x.key === key);
  if (!sc) return;
  const w = window.open('', '_blank', 'width=960,height=1040');
  if (!w) { toast('Pop-ups are blocked — allow pop-ups to print the checklist.', 'error'); return; }
  const css = `
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 12px; margin: 0; }
    h1 { font-size: 17px; text-align: center; margin: 0; letter-spacing: .6px; color: #0f2c4c; }
    .sub { text-align: center; font-size: 12px; font-weight: 700; margin: 3px 0 0; color: #0f2c4c; }
    .rule { border: 0; border-top: 3px double #0f2c4c; margin: 9px 0 11px; }
    .intro p { margin: 0 0 5px; font-size: 11.5px; }
    .admno { font-weight: 700; margin: 9px 0 11px !important; }
    .admno span { display: inline-block; border-bottom: 1.5px dotted #000; min-width: 190px; }
    h2 { font-size: 12.5px; margin: 13px 0 6px; padding: 5px 8px; background: #0f2c4c; color: #fff;
         text-transform: uppercase; letter-spacing: .7px; border-left: 5px solid #c9a227; }
    ul { list-style: none; margin: 0; padding: 0; column-count: 2; column-gap: 26px; }
    li { break-inside: avoid; font-size: 11.5px; padding: 3px 0; display: flex; gap: 7px; line-height: 1.35; }
    .box { flex: 0 0 auto; width: 11px; height: 11px; border: 1.4px solid #000; margin-top: 2px; }
    .note { font-size: 11px; background: #f4f1ea; border-left: 3px solid #c9a227; padding: 6px 8px; margin: 8px 0 0; }
    .uninote { font-size: 11.5px; font-weight: 700; margin: 0 0 4px; }
    .foot { margin-top: 16px; display: flex; gap: 26px; font-size: 11px; }
    .foot div { flex: 1; border-top: 1.2px dotted #000; padding-top: 4px; }
    .disclaim { text-align: center; font-size: 10px; color: #555; margin-top: 14px; }
  `;
  const groupsHTML = sc.groups.map(g => `
    <h2>${esc(g.title)}</h2>
    <ul>${g.items.map(it => `<li><span class="box"></span><span>${esc(it)}</span></li>`).join('')}</ul>
    ${(g.notes || []).map(n => `<div class="note">${esc(n)}</div>`).join('')}
  `).join('');
  w.document.write(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${esc(sc.name)} — Admission Requirements</title><style>${css}</style></head>
<body>
  <h1>${esc(sc.name)}</h1>
  <p class="sub">${esc(sc.phone)} &nbsp;·&nbsp; ADMISSION REQUIREMENTS &amp; UNIFORM CHECKLIST</p>
  <hr class="rule">
  <div class="intro">
    <p><strong>1.</strong> The following items <strong>MUST</strong> be checked before admission.</p>
    <p><strong>2.</strong> All articles MUST be permanently labelled with the child's admission number.</p>
    <p class="admno"><strong>3.</strong> Your child's Admission Number is <span></span></p>
  </div>
  <p class="uninote">${esc(sc.uniformNote)}</p>
  ${groupsHTML}
  <div class="foot">
    <div>Verified by (Uniforms / Stores Officer)</div>
    <div>Date</div>
    <div>Parent / Guardian Signature</div>
  </div>
  <p class="disclaim">${esc(sc.name)} · ${esc(sc.phone)}</p>
</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => { try { w.print(); } catch (e) { console.error(e); } }, 400);
}

/* ============================================================
   STORE PORTAL
   ============================================================ */
function inventoryNav(title) {
  return [
    { label: 'Main' },
    { id: 'dashboard', title: 'Dashboard', icon: 'fa-gauge-high', active: true },
    { label: 'Stock' },
    { id: 'inv-items', title: 'Inventory Items', icon: 'fa-boxes-stacked' },
    { id: 'inv-movements', title: 'Stock Movements', icon: 'fa-clock-rotate-left' },
    { label: 'Transfers' },
    { id: 'inv-transfers', title: 'Stock Transfers', icon: 'fa-truck-ramp-box' },
    { label: 'Reports' },
    { id: 'inv-reports', title: 'Reports & Printing', icon: 'fa-file-csv' }
  ];
}

function initStorePortal() {
  const s = Auth.require(['storekeeper']);
  if (!s) return;
  buildPortalPage({
    brand: 'Procurement & Stores Portal',
    nav: [
      { label: 'Main' },
      { id: 'dashboard', title: 'Dashboard', icon: 'fa-gauge-high', active: true },
      { label: 'Store & Uniforms' },
      { id: 'inv-items', title: 'Inventory & Uniforms', icon: 'fa-boxes-stacked' },
      { id: 'inv-movements', title: 'Stock Movements', icon: 'fa-clock-rotate-left' },
      { label: 'Kitchen Transfer' },
      { id: 'inv-transfers', title: 'Transfers to Kitchen', icon: 'fa-truck-ramp-box' },
      { id: 'inv-requests', title: 'Kitchen Requests', icon: 'fa-comment-dots' },
      { label: 'Procurement' },
      { id: 'inv-procurement', title: 'Suppliers & Orders', icon: 'fa-cart-flatbed' },
      { label: 'School' },
      { id: 'tt-grid', title: 'School Timetable', icon: 'fa-calendar-days' },
      { label: 'Reports' },
      { id: 'inv-reports', title: 'Reports & Printing', icon: 'fa-file-csv' }
    ],
    sections: [
      {
        id: 'dashboard', title: 'Stores Dashboard', sub: 'Main Store stock position, low-stock alerts and pending work.',
        html: statsHTML([
          { id: 'invItemCount', label: 'Items in Store', icon: 'fa-boxes-stacked' },
          { id: 'invLowCount', label: 'Low-Stock Items', icon: 'fa-triangle-exclamation', color: 'red' },
          { id: 'invValue', label: 'Stock Value', icon: 'fa-coins', color: 'gold' },
          { id: 'invPendingTransfers', label: 'Transfers In Motion', icon: 'fa-truck-ramp-box', color: 'blue' },
          { id: 'invOpenOrders', label: 'Open Purchase Orders', icon: 'fa-cart-flatbed', color: 'green' },
          { id: 'invRequests', label: 'Kitchen Requests', icon: 'fa-comment-dots', color: 'gold' }
        ]) + `
        <div class="panel">
          <div class="panel-head"><h3><i class="fas fa-triangle-exclamation" style="color:var(--danger)"></i> Low-Stock Alerts</h3>
            <button class="btn btn-sm btn-gold" id="btnInvTransferKitchen"><i class="fas fa-truck-ramp-box"></i> Transfer Items to Kitchen</button></div>
          <div class="panel-body" id="invLowList"></div>
        </div>`
      },
      {
        id: 'inv-items', title: 'Inventory & Uniforms',
        sub: 'Add, describe and edit items; record incoming and outgoing stock; run adjustments. Switch the department below to manage Junior or Academy uniform stock.',
        head: `<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
          <label style="display:flex;align-items:center;gap:7px;font-size:.83rem;font-weight:600;color:var(--navy)">Department
            <select id="invDeptSwitch" style="padding:9px 12px;border:1px solid var(--border);border-radius:8px">
              <option value="store">Main Store</option>
              <option value="junior_uniform">Junior Uniforms</option>
              <option value="academy_uniform">Academy Uniforms</option>
            </select>
          </label>
          <button class="btn btn-primary" id="btnInvAddItem"><i class="fas fa-plus"></i> Add New Item</button>
          <button class="btn btn-gold" id="btnInvTransferKitchen2" onclick="InventoryUI.openTransferModal()"><i class="fas fa-truck-ramp-box"></i> Transfer Items to Kitchen</button>
        </div>`,
        html: `
        <div class="panel">
          <div class="panel-body" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
            <input type="text" id="invItemSearch" placeholder="Search item name, code, size…" style="flex:1;min-width:200px;padding:9px 12px;border:1px solid var(--border);border-radius:8px">
            <select id="invItemCategory" style="padding:9px 12px;border:1px solid var(--border);border-radius:8px"><option value="">All Categories</option></select>
            <label style="display:flex;align-items:center;gap:6px;font-size:.85rem"><input type="checkbox" id="invShowArchived"> Show archived</label>
            <span id="invItemCountLabel" style="color:var(--text-light);font-size:.85rem"></span>
          </div>
          <div class="panel-body table-wrap">
            <table class="data-table">
              <thead><tr><th>Code</th><th>Item</th><th>Category</th><th>Unit</th><th>Available</th><th>Location</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody id="invItemsBody"></tbody>
            </table>
          </div>
        </div>
        <div class="panel" id="uniSizePanel" style="display:none">
          <div class="panel-head"><h3>Size Guide in Stock</h3></div>
          <div class="panel-body" id="uniSizeSummary"></div>
        </div>
        ${admissionPanelHTML()}`
      },
      {
        id: 'inv-movements', title: 'Stock Movements', sub: 'Every transaction with previous balance, new balance and responsible user.',
        html: `
        <div class="panel">
          <div class="panel-body" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
            <input type="text" id="invFSearch" placeholder="Search item or reference…" style="flex:1;min-width:190px;padding:9px 12px;border:1px solid var(--border);border-radius:8px">
            <select id="invFType" style="padding:9px 12px;border:1px solid var(--border);border-radius:8px">
              <option value="">All Types</option>
              <option value="receipt">Receipt</option><option value="issue">Issue</option>
              <option value="adjustment">Adjustment</option><option value="damaged">Damaged / Expired</option>
              <option value="transfer_in">Transfer In</option><option value="transfer_out">Transfer Out</option>
            </select>
            <input type="date" id="invFFrom" style="padding:8px;border:1px solid var(--border);border-radius:8px">
            <input type="date" id="invFTo" style="padding:8px;border:1px solid var(--border);border-radius:8px">
            <select id="invFUser" style="padding:9px 12px;border:1px solid var(--border);border-radius:8px"><option value="">All Users</option></select>
            <button class="btn btn-outline btn-sm" onclick="InventoryUI.clearFilters()"><i class="fas fa-xmark"></i> Clear</button>
          </div>
          <div class="panel-body table-wrap">
            <table class="data-table">
              <thead><tr><th>Ref</th><th>Date &amp; Time</th><th>Item</th><th>Type</th><th>In</th><th>Out</th><th>Balance</th><th>User / Receiver</th><th>Reason</th></tr></thead>
              <tbody id="invMovesBody"></tbody>
            </table>
          </div>
          <div class="panel-body" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
            <span id="invMovesCount" style="color:var(--text-light);font-size:.85rem"></span>
            <div style="display:flex;gap:6px;align-items:center" id="invMovesPager"></div>
          </div>
        </div>`
      },
      {
        id: 'inv-transfers', title: 'Transfer Items to Kitchen',
        sub: 'Stock leaves the Main Store only after the Kitchen Manager confirms the actual quantity received.',
        head: `<button class="btn btn-gold" onclick="InventoryUI.openTransferModal()"><i class="fas fa-truck-ramp-box"></i> Transfer Items to Kitchen</button>`,
        html: `
        <div class="panel"><div class="panel-body" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
          <select id="invTransferFilter" style="padding:9px 12px;border:1px solid var(--border);border-radius:8px">
            <option value="">All statuses</option><option value="pending">Pending</option>
            <option value="received">Received</option><option value="partially_received">Partially received</option>
          </select>
        </div></div>
        <div id="invTransfersBody"></div>`
      },
      {
        id: 'inv-requests', title: 'Kitchen Stock Requests',
        sub: 'Requests raised by the Kitchen Department against Main Store stock.',
        html: `<div class="panel"><div class="panel-body" id="invRequestsBody"></div></div>`
      },
      {
        id: 'inv-procurement', title: 'Suppliers & Procurement',
        sub: 'Purchase requests, purchase orders, invoices, deliveries and audit trail.',
        head: `<div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-outline" id="btnInvAddSupplier"><i class="fas fa-plus"></i> New Supplier</button>
          <button class="btn btn-primary" id="btnInvAddOrder"><i class="fas fa-cart-flatbed"></i> New Purchase Order</button>
        </div>`,
        html: `
        <div class="panel">
          <div class="panel-head"><h3>Suppliers</h3></div>
          <div class="panel-body table-wrap">
            <table class="data-table"><thead><tr><th>Supplier</th><th>Contact</th><th>Phone</th><th>Email</th><th>Address</th><th>Orders</th></tr></thead>
            <tbody id="invSuppliersBody"></tbody></table>
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><h3>Purchase Requests &amp; Orders</h3>
            <select id="invOrderStatus" style="padding:7px 10px;border:1px solid var(--border);border-radius:8px">
              <option value="">All statuses</option><option value="pending">Pending</option><option value="approved">Approved</option>
              <option value="ordered">Ordered</option><option value="partially_received">Partially Received</option>
              <option value="fully_received">Fully Received</option><option value="rejected">Rejected</option>
            </select>
          </div>
          <div class="panel-body" id="invOrdersBody"></div>
        </div>`
      },
      { id: 'inv-reports', title: 'Reports & Printing', sub: 'Print or export stock, transfer, low-stock and procurement reports.', html: `<div class="panel"><div class="panel-body" id="invReportsBody"></div></div>` },
      { id: 'tt-grid', title: 'School Timetable', sub: 'Read-only view of the published school timetable.', html: TT_GRID_HTML }
    ]
  });
  renderTopbarUser(s);
  initSidebar();
  InventoryUI.init('store');
  initStoreDeptSwitch();
  initAdmissionChecklists();
}

/* Stores portal: switch between Main Store and the two uniform departments.
   The authenticated Stores account manages uniform stock directly (Perm.canManageInventory). */
function initStoreDeptSwitch() {
  const sel = document.getElementById('invDeptSwitch');
  if (!sel) return;
  const apply = () => {
    const d = sel.value || 'store';
    InventoryUI.setDept(d);
    InventoryUI.refreshAll();
    const isStore = d === 'store';
    // kitchen transfers are a Main Store function only
    ['btnInvTransferKitchen', 'btnInvTransferKitchen2'].forEach(id => {
      const b = document.getElementById(id);
      if (b) b.style.display = isStore ? '' : 'none';
    });
    const sizePanel = document.getElementById('uniSizePanel');
    if (sizePanel) sizePanel.style.display = isStore ? 'none' : '';
    if (!isStore) renderUniformSizeSummary(d);
    const sec = document.getElementById('sec-inv-items');
    if (sec) {
      const h2 = sec.querySelector('h2');
      if (h2) h2.textContent = (DEPTS[d] || {}).label || 'Inventory';
    }
  };
  sel.addEventListener('change', apply);
  // initial heading matches the starting department
  const sec = document.getElementById('sec-inv-items');
  const h2 = sec && sec.querySelector('h2');
  if (h2) h2.textContent = DEPTS.store.label;
}

/* ============================================================
   KITCHEN PORTAL
   ============================================================ */
function initKitchenPortal() {
  const s = Auth.require(['kitchenmanager']);
  if (!s) return;
  buildPortalPage({
    brand: 'Kitchen Department Portal',
    nav: [
      { label: 'Main' },
      { id: 'dashboard', title: 'Dashboard', icon: 'fa-gauge-high', active: true },
      { label: 'Kitchen Stock' },
      { id: 'inv-items', title: 'Kitchen Inventory', icon: 'fa-boxes-stacked' },
      { id: 'inv-movements', title: 'Usage & Movements', icon: 'fa-clock-rotate-left' },
      { label: 'Transfers' },
      { id: 'inv-transfers', title: 'Incoming Transfers', icon: 'fa-truck-ramp-box', badge: 'kitchenBadge' },
      { id: 'inv-requests', title: 'Request from Store', icon: 'fa-comment-dots' },
      { label: 'School' },
      { id: 'tt-grid', title: 'School Timetable', icon: 'fa-calendar-days' },
      { label: 'Reports' },
      { id: 'inv-reports', title: 'Reports & Printing', icon: 'fa-file-csv' }
    ],
    sections: [
      {
        id: 'dashboard', title: 'Kitchen Dashboard', sub: 'Kitchen stock is held separately from the Main Store and only changes through confirmed transfers and recorded usage.',
        html: statsHTML([
          { id: 'invItemCount', label: 'Kitchen Items', icon: 'fa-boxes-stacked' },
          { id: 'invLowCount', label: 'Low-Stock Items', icon: 'fa-triangle-exclamation', color: 'red' },
          { id: 'invPendingReceipts', label: 'Awaiting My Receipt', icon: 'fa-clipboard-check', color: 'gold' },
          { id: 'invRequests', label: 'My Open Requests', icon: 'fa-comment-dots', color: 'blue' },
          { id: 'invValue', label: 'Kitchen Stock Value', icon: 'fa-coins', color: 'green' },
          { id: 'invPendingTransfers', label: 'Transfers In Motion', icon: 'fa-truck-ramp-box', color: 'navy' }
        ]) + `
        <div class="panel">
          <div class="panel-head"><h3><i class="fas fa-triangle-exclamation" style="color:var(--danger)"></i> Low-Stock Alerts</h3>
            <button class="btn btn-sm btn-primary" onclick="InventoryUI.openRequestModal()"><i class="fas fa-paper-plane"></i> Request Stock</button></div>
          <div class="panel-body" id="invLowList"></div>
        </div>
        <div class="panel">
          <div class="panel-head"><h3><i class="fas fa-clipboard-check" style="color:var(--gold)"></i> Transfers Awaiting Your Confirmation</h3></div>
          <div class="panel-body" id="kitchenPendingBox"></div>
        </div>`
      },
      {
        id: 'inv-items', title: 'Kitchen Inventory',
        sub: 'Add, describe and edit kitchen items; record usage, adjustments and damaged or expired stock.',
        head: `<button class="btn btn-primary" id="btnInvAddItem"><i class="fas fa-plus"></i> Add New Item</button>`,
        html: `
        <div class="panel">
          <div class="panel-body" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
            <input type="text" id="invItemSearch" placeholder="Search item…" style="flex:1;min-width:200px;padding:9px 12px;border:1px solid var(--border);border-radius:8px">
            <select id="invItemCategory" style="padding:9px 12px;border:1px solid var(--border);border-radius:8px"><option value="">All Categories</option></select>
            <label style="display:flex;align-items:center;gap:6px;font-size:.85rem"><input type="checkbox" id="invShowArchived"> Show archived</label>
            <span id="invItemCountLabel" style="color:var(--text-light);font-size:.85rem"></span>
          </div>
          <div class="panel-body table-wrap">
            <table class="data-table">
              <thead><tr><th>Code</th><th>Item</th><th>Category</th><th>Unit</th><th>Available</th><th>Location</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody id="invItemsBody"></tbody>
            </table>
          </div>
        </div>`
      },
      {
        id: 'inv-movements', title: 'Kitchen Usage & Movements', sub: 'Every receipt, usage entry, adjustment and write-off.',
        html: `
        <div class="panel">
          <div class="panel-body" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
            <input type="text" id="invFSearch" placeholder="Search item…" style="flex:1;min-width:190px;padding:9px 12px;border:1px solid var(--border);border-radius:8px">
            <select id="invFType" style="padding:9px 12px;border:1px solid var(--border);border-radius:8px">
              <option value="">All Types</option><option value="receipt">Receipt</option><option value="issue">Usage / Issue</option>
              <option value="adjustment">Adjustment</option><option value="damaged">Damaged / Expired</option>
              <option value="transfer_in">Transfer In</option><option value="transfer_out">Transfer Out</option>
            </select>
            <input type="date" id="invFFrom" style="padding:8px;border:1px solid var(--border);border-radius:8px">
            <input type="date" id="invFTo" style="padding:8px;border:1px solid var(--border);border-radius:8px">
            <select id="invFUser" style="padding:9px 12px;border:1px solid var(--border);border-radius:8px"><option value="">All Users</option></select>
            <button class="btn btn-outline btn-sm" onclick="InventoryUI.clearFilters()"><i class="fas fa-xmark"></i> Clear</button>
          </div>
          <div class="panel-body table-wrap">
            <table class="data-table">
              <thead><tr><th>Ref</th><th>Date &amp; Time</th><th>Item</th><th>Type</th><th>In</th><th>Out</th><th>Balance</th><th>User / Receiver</th><th>Reason</th></tr></thead>
              <tbody id="invMovesBody"></tbody>
            </table>
          </div>
          <div class="panel-body" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
            <span id="invMovesCount" style="color:var(--text-light);font-size:.85rem"></span>
            <div style="display:flex;gap:6px;align-items:center" id="invMovesPager"></div>
          </div>
        </div>`
      },
      {
        id: 'inv-transfers', title: 'Incoming Transfers',
        sub: 'Review each delivery, enter the quantity actually received and confirm with your authenticated account.',
        head: `<span class="badge badge-warning">Signed in as ${esc(s.name)} — Kitchen Manager</span>`,
        html: `
        <div class="panel"><div class="panel-body" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
          <select id="invTransferFilter" style="padding:9px 12px;border:1px solid var(--border);border-radius:8px">
            <option value="">All statuses</option><option value="pending">Pending confirmation</option>
            <option value="received">Received</option><option value="partially_received">Partially received</option>
          </select>
        </div></div>
        <div id="invTransfersBody"></div>`
      },
      {
        id: 'inv-requests', title: 'Request Stock from Main Store',
        sub: 'Raise a request; the Store Manager issues it and both balances update.',
        head: `<button class="btn btn-primary" onclick="InventoryUI.openRequestModal()"><i class="fas fa-paper-plane"></i> Request Stock</button>`,
        html: `<div class="panel"><div class="panel-body" id="invRequestsBody"></div></div>`
      },
      { id: 'inv-reports', title: 'Kitchen Reports', sub: 'Print or export kitchen stock, usage and transfer reports.', html: `<div class="panel"><div class="panel-body" id="invReportsBody"></div></div>` },
      { id: 'tt-grid', title: 'School Timetable', sub: 'Read-only view of the published school timetable.', html: TT_GRID_HTML }
    ]
  });
  renderTopbarUser(s);
  initSidebar();
  InventoryUI.init('kitchen');
  renderKitchenPending();
}
function renderKitchenPending() {
  const box = document.getElementById('kitchenPendingBox');
  if (!box) return;
  const pending = Inventory.transfers().filter(t => t.status === 'pending' && t.toDept === 'kitchen');
  const badge = document.getElementById('kitchenBadge');
  if (badge) { badge.textContent = pending.length; badge.style.display = pending.length ? '' : 'none'; }
  box.innerHTML = pending.length ? pending.map(t => `
    <div style="display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);flex-wrap:wrap">
      <div><strong style="color:var(--navy)">${esc(t.ref)}</strong>
        <br><small style="color:var(--text-light)">Sent ${esc(String(t.sentAt).replace('T', ' ').slice(0, 16))} by ${esc(t.sentByName)} · ${t.lines.length} line(s)</small></div>
      <button class="btn btn-gold btn-sm" onclick="InventoryUI.confirmModal('${t.ref}')"><i class="fas fa-clipboard-check"></i> Review &amp; Confirm Receipt</button>
    </div>`).join('') : '<p style="color:var(--text-light)">No transfers awaiting confirmation.</p>';
}

/* ============================================================
   UNIFORM PORTAL (Junior School / Academy School)
   ============================================================ */
function initUniformPortal() {
  const s = Auth.require(['uniformstaff']);
  if (!s) return;
  const depts = Array.isArray(s.uniformDepts) && s.uniformDepts.length ? s.uniformDepts : ['junior_uniform'];
  const dept = depts[0];
  const label = DEPTS[dept].label;

  buildPortalPage({
    brand: label + ' Portal',
    nav: [
      { label: 'Main' },
      { id: 'dashboard', title: 'Dashboard', icon: 'fa-gauge-high', active: true },
      { label: 'Uniform Stock' },
      { id: 'inv-items', title: 'Uniform Inventory', icon: 'fa-shirt' },
      { id: 'inv-movements', title: 'Stock Movements', icon: 'fa-clock-rotate-left' },
      { label: 'Reports' },
      { id: 'inv-reports', title: 'Reports & Printing', icon: 'fa-file-csv' }
    ],
    sections: [
      {
        id: 'dashboard', title: label + ' Dashboard',
        sub: 'Boys\' and girls\' uniform stock, sizes and shoe sizes — held separately from every other department.',
        html: `
        <div style="background:var(--info-bg);color:var(--info);padding:12px 14px;border-radius:8px;font-size:.87rem;margin-bottom:14px">
          <i class="fas fa-lock"></i> You are managing <strong>${esc(label)}</strong> only. ${dept === 'junior_uniform' ? 'Academy' : 'Junior School'} stock cannot be viewed or changed from this portal.
        </div>` + statsHTML([
          { id: 'invItemCount', label: 'Uniform Items / Variants', icon: 'fa-shirt' },
          { id: 'invLowCount', label: 'Low Stock Items (0–9)', icon: 'fa-triangle-exclamation', color: 'red' },
          { id: 'invValue', label: 'Stock Value', icon: 'fa-coins', color: 'gold' },
          { id: 'invPendingTransfers', label: 'Transfers In Motion', icon: 'fa-truck-ramp-box', color: 'blue' },
          { id: 'invOpenOrders', label: 'Open Purchase Orders', icon: 'fa-cart-flatbed', color: 'green' },
          { id: 'invRequests', label: 'Pending Requests', icon: 'fa-comment-dots', color: 'navy' }
        ]) + `
        <div class="panel">
          <div class="panel-head"><h3><i class="fas fa-triangle-exclamation" style="color:var(--danger)"></i> Low-Stock Alerts (0–9 available)</h3></div>
          <div class="panel-body" id="invLowList"></div>
        </div>`
      },
      {
        id: 'inv-items', title: label + ' Inventory',
        sub: 'Record quantities received and issued, clothing sizes, shoe sizes, returns, exchanges and damaged items.',
        head: `<button class="btn btn-primary" id="btnInvAddItem"><i class="fas fa-plus"></i> Add New Item</button>`,
        html: `
        <div class="panel">
          <div class="panel-body" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
            <input type="text" id="invItemSearch" placeholder="Search item, code, size…" style="flex:1;min-width:200px;padding:9px 12px;border:1px solid var(--border);border-radius:8px">
            <select id="invItemCategory" style="padding:9px 12px;border:1px solid var(--border);border-radius:8px"><option value="">All Categories</option></select>
            <label style="display:flex;align-items:center;gap:6px;font-size:.85rem"><input type="checkbox" id="invShowArchived"> Show archived</label>
            <span id="invItemCountLabel" style="color:var(--text-light);font-size:.85rem"></span>
          </div>
          <div class="panel-body table-wrap">
            <table class="data-table">
              <thead><tr><th>Code</th><th>Item</th><th>Category</th><th>Unit</th><th>Available</th><th>Location</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody id="invItemsBody"></tbody>
            </table>
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><h3>Size Guide in Stock</h3></div>
          <div class="panel-body" id="uniSizeSummary"></div>
        </div>`
      },
      {
        id: 'inv-movements', title: 'Uniform Stock Movements', sub: 'Receipts, issues, returns, exchanges, damaged items and adjustments.',
        html: `
        <div class="panel">
          <div class="panel-body" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
            <input type="text" id="invFSearch" placeholder="Search item…" style="flex:1;min-width:190px;padding:9px 12px;border:1px solid var(--border);border-radius:8px">
            <select id="invFType" style="padding:9px 12px;border:1px solid var(--border);border-radius:8px">
              <option value="">All Types</option><option value="receipt">Received</option><option value="issue">Issued</option>
              <option value="adjustment">Adjustment / Exchange</option><option value="damaged">Damaged</option>
            </select>
            <input type="date" id="invFFrom" style="padding:8px;border:1px solid var(--border);border-radius:8px">
            <input type="date" id="invFTo" style="padding:8px;border:1px solid var(--border);border-radius:8px">
            <select id="invFUser" style="padding:9px 12px;border:1px solid var(--border);border-radius:8px"><option value="">All Users</option></select>
            <button class="btn btn-outline btn-sm" onclick="InventoryUI.clearFilters()"><i class="fas fa-xmark"></i> Clear</button>
          </div>
          <div class="panel-body table-wrap">
            <table class="data-table">
              <thead><tr><th>Ref</th><th>Date &amp; Time</th><th>Item</th><th>Type</th><th>In</th><th>Out</th><th>Balance</th><th>User / Receiver</th><th>Reason</th></tr></thead>
              <tbody id="invMovesBody"></tbody>
            </table>
          </div>
          <div class="panel-body" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
            <span id="invMovesCount" style="color:var(--text-light);font-size:.85rem"></span>
            <div style="display:flex;gap:6px;align-items:center" id="invMovesPager"></div>
          </div>
        </div>`
      },
      { id: 'inv-reports', title: 'Uniform Reports', sub: 'Print or export stock by department, category and size.', html: `<div class="panel"><div class="panel-body" id="invReportsBody"></div></div>` }
    ]
  });
  renderTopbarUser(s);
  initSidebar();
  InventoryUI.init(dept);
  renderUniformSizeSummary(dept);
}
function renderUniformSizeSummary(dept) {
  const box = document.getElementById('uniSizeSummary');
  if (!box) return;
  const items = Inventory.itemsFor(dept);
  const byType = {};
  items.forEach(i => {
    const k = i.itemType || i.category || 'Other';
    byType[k] = byType[k] || [];
    byType[k].push(i);
  });
  const keys = Object.keys(byType);
  box.innerHTML = keys.length ? `<div class="table-wrap"><table class="data-table">
    <thead><tr><th>Item Type</th><th>Variants</th><th>Sizes In Stock</th><th>Total Available</th></tr></thead>
    <tbody>${keys.map(k => {
      const g = byType[k];
      const sizes = [...new Set(g.map(i => i.clothingSize || i.shoeSize).filter(Boolean))];
      return `<tr><td><strong>${esc(k)}</strong></td><td>${g.length}</td>
        <td>${sizes.map(x => `<span class="badge badge-navy">${esc(x)}</span>`).join(' ') || '—'}</td>
        <td><strong>${g.reduce((a, i) => a + Number(i.balance || 0), 0)}</strong></td></tr>`;
    }).join('')}</tbody></table></div>`
    : '<p style="color:var(--text-light)">No uniform items yet.</p>';
}

/* ---------- sidebar hook for the new portals ---------- */
window.onSectionOpen = (function (prev) {
  return function (section, anchor) {
    if (typeof prev === 'function') { try { prev(section, anchor); } catch (e) { console.error(e); } }
    try {
      if (section === 'dashboard') {
        const page = document.body.dataset.page;
        if (page === 'chiefexaminer') renderReviewDashboard(true);
        if (page === 'headteacher') renderReviewDashboard(false);
        if (page === 'kitchenmanager') { InventoryUI.renderDashboard(); renderKitchenPending(); }
        if (['storekeeper', 'kitchenmanager', 'uniformstaff'].includes(page)) InventoryUI.renderDashboard();
        if (page === 'uniformstaff') renderUniformSizeSummary(InventoryUI.dept);
      }
      if (section === 'inv-movements' && typeof InventoryUI !== 'undefined') InventoryUI.renderMovements();
      if (section === 'inv-items' && typeof InventoryUI !== 'undefined') {
        InventoryUI.renderItems();
        if (typeof renderUniformSizeSummary === 'function' && InventoryUI.isUniform()) renderUniformSizeSummary(InventoryUI.dept);
      }
      if (section === 'inv-reports' && typeof InventoryUI !== 'undefined') InventoryUI.renderReports();
      if (section === 'inv-transfers' && typeof InventoryUI !== 'undefined') InventoryUI.renderTransfers();
      if (section === 'tt-grid') { fillTtSelects(); renderTtGrid(); }
      if (section === 'audit' && typeof renderReviewAudit === 'function') renderReviewAudit();
      if (section === 'publish-queue') renderPublishQueue();
    } catch (e) { console.error(e); }
  };
})(window.onSectionOpen);
