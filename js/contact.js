/* ============================================================
   ST. TERESA ACADEMY — CONTACT MESSAGES
   Inbox for messages sent through the public contact form.

   The public form (js/script.js) writes to the shared browser key
   `sta_contactMessages`; this module lets the Admin / Secretary
   read, mark and delete those messages. Permission is enforced in
   the data layer, then mirrored in the UI.

   Loaded AFTER modules.js on the admin & secretary portals.
   ============================================================ */

const CONTACT_MSG_KEY = 'sta_contactMessages';

const ContactMessages = {
  _raw() {
    try {
      const v = JSON.parse(localStorage.getItem(CONTACT_MSG_KEY));
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  },
  _save(list) { try { localStorage.setItem(CONTACT_MSG_KEY, JSON.stringify(list)); } catch (e) { /* storage full/blocked */ } },

  /* Only the administrator/director and the secretary may read the inbox. */
  canView() {
    const s = Auth.session();
    return !!s && ['admin', 'director', 'secretary'].includes(s.role);
  },

  list() {
    if (!this.canView()) return [];
    return this._raw().slice().sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
  },
  unreadCount() {
    if (!this.canView()) return 0;
    return this._raw().filter(m => !m.read).length;
  },
  markRead(id, read) {
    if (!this.canView()) return { ok: false, error: 'Permission denied.' };
    const list = this._raw();
    const m = list.find(x => x.id === id);
    if (!m) return { ok: false, error: 'Message not found.' };
    const s = Auth.session();
    m.read = read !== false;
    m.readAt = m.read ? new Date().toISOString() : '';
    m.readBy = m.read ? s.name : '';
    this._save(list);
    if (typeof Audit !== 'undefined') Audit.log('contact.message.' + (m.read ? 'read' : 'unread'), (m.name || '') + ' — ' + (m.email || ''));
    return { ok: true };
  },
  markAllRead() {
    if (!this.canView()) return { ok: false, error: 'Permission denied.' };
    const s = Auth.session();
    const list = this._raw();
    list.forEach(m => { if (!m.read) { m.read = true; m.readAt = new Date().toISOString(); m.readBy = s.name; } });
    this._save(list);
    return { ok: true };
  },
  remove(id) {
    if (!this.canView()) return { ok: false, error: 'Permission denied.' };
    const before = this._raw();
    const after = before.filter(x => x.id !== id);
    if (after.length === before.length) return { ok: false, error: 'Message not found.' };
    this._save(after);
    if (typeof Audit !== 'undefined') Audit.log('contact.message.delete', id);
    return { ok: true };
  }
};

const CONTACT_INTEREST_LABELS = {
  '': 'General',
  admissions: 'Admissions',
  tour: 'Campus Tour',
  'financial-aid': 'Financial Aid',
  careers: 'Employment',
  general: 'General Inquiry'
};

function contactDate(v) {
  if (!v) return '—';
  try { return new Date(v).toLocaleString(); } catch (e) { return String(v); }
}

function updateContactMsgBadge() {
  const n = (typeof ContactMessages !== 'undefined') ? ContactMessages.unreadCount() : 0;
  document.querySelectorAll('#badge-contactmsgs').forEach(b => {
    b.textContent = n;
    b.style.display = n ? '' : 'none';
  });
}

function renderContactMessages() {
  const box = document.getElementById('contactMsgBody');
  if (!box) return;
  updateContactMsgBadge();
  if (!ContactMessages.canView()) {
    box.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:26px;color:var(--text-light)">You are not authorized to view contact messages.</td></tr>';
    return;
  }
  const list = ContactMessages.list();
  const unread = list.filter(m => !m.read).length;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('cmTotal', list.length);
  set('cmUnread', unread);

  box.innerHTML = list.length ? list.map(m => `
    <tr style="${m.read ? '' : 'background:rgba(201,162,39,.06)'}">
      <td><small>${esc(contactDate(m.at))}</small></td>
      <td><strong>${esc(m.name || '—')}</strong>${m.read ? '' : ' <span class="badge badge-gold">New</span>'}</td>
      <td><a href="mailto:${esc(m.email || '')}">${esc(m.email || '—')}</a></td>
      <td>${esc(m.phone || '—')}</td>
      <td>${esc(CONTACT_INTEREST_LABELS[m.interest] || m.interest || 'General')}</td>
      <td style="max-width:360px;white-space:pre-wrap">${esc(m.message || '')}</td>
      <td>${m.read ? `<span class="badge badge-success">Read</span><br><small style="color:var(--text-light)">${esc(m.readBy || '')}</small>` : '<span class="badge badge-warning">Unread</span>'}</td>
      <td class="table-actions">
        <button class="btn btn-xs btn-outline" onclick="toggleContactMessageRead('${m.id}')" title="${m.read ? 'Mark as unread' : 'Mark as read'}"><i class="fas ${m.read ? 'fa-envelope' : 'fa-envelope-open'}"></i></button>
        <button class="btn btn-xs btn-danger" onclick="deleteContactMessage('${m.id}')" title="Delete message"><i class="fas fa-trash"></i></button>
      </td>
    </tr>`).join('') :
    '<tr><td colspan="8" style="text-align:center;padding:26px;color:var(--text-light)">No contact messages yet. Messages sent through the website contact form will appear here.</td></tr>';
}

/* Refresh from other tabs / after a new submission. */
function toggleContactMessageRead(id) {
  const cur = ContactMessages._raw().find(m => m.id === id);
  const r = ContactMessages.markRead(id, !(cur && cur.read));
  if (!r.ok) { toast(r.error, 'error'); return; }
  renderContactMessages();
}
function deleteContactMessage(id) {
  if (!confirm('Delete this contact message? This cannot be undone.')) return;
  const r = ContactMessages.remove(id);
  if (!r.ok) { toast(r.error, 'error'); return; }
  toast('Message deleted.');
  renderContactMessages();
}

/* ---------- routing hook + badge refresh ---------- */
window.onSectionOpen = (function (prev) {
  return function (section, anchor) {
    if (typeof prev === 'function') { try { prev(section, anchor); } catch (e) { console.error(e); } }
    try { if (section === 'contact-messages') renderContactMessages(); } catch (e) { console.error(e); }
  };
})(window.onSectionOpen);

document.addEventListener('DOMContentLoaded', function () {
  setTimeout(function () {
    try { updateContactMsgBadge(); } catch (e) { console.error(e); }
  }, 0);
});
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('storage', function (e) {
    if (e && e.key === 'sta_contactMessages') { updateContactMsgBadge(); }
  });
}
