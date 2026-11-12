/* ============================================================
   ST. TERESA ACADEMY — PROFESSIONAL FEES EXTENSION
   Actual payment dates · term allocation · receipts · statements
   automatic fee notifications · messaging centre · SMS delivery
   ------------------------------------------------------------
   Loaded AFTER admin.js, modules.js and portals.js. It extends the
   existing Fees/Payments modules; it never creates a parallel student
   or payment table.
   ============================================================ */

/* ------------------------------------------------------------
   1. NOTIFICATION CONFIGURATION
   ------------------------------------------------------------ */
const NotificationConfig = {
  defaults() {
    return {
      enabled: true,
      autoReminders: true,
      reminderDays: 7,
      cooldownDays: 7,
      channels: { sms: false, portal: true },
      requireReference: false,
      deadlines: {},
      templates: {
        first_outstanding: 'Dear Parent/Guardian,\n\nOur records indicate that your child, {student}, has an outstanding school fee balance of {balance} for {term}, Academic Year {year}.\n\nPlease contact the school office if you require clarification or have already made a payment that has not yet been recorded.\n\nThank you for your cooperation.\n\nST. TERESA ACADEMY SCHOOL',
        approaching: 'Dear Parent/Guardian,\n\nThis is a reminder that {student} has an outstanding school fee balance of {balance} for {term}, Academic Year {year}. The payment deadline ({deadline}) is approaching.\n\nPlease contact the school office if you require clarification.\n\nThank you.\n\nST. TERESA ACADEMY SCHOOL',
        overdue: 'Dear Parent/Guardian,\n\nOur records show that {student} still has an outstanding school fee balance of {balance} for {term}, Academic Year {year}. The payment deadline ({deadline}) has passed.\n\nPlease contact the school office as soon as possible.\n\nThank you.\n\nST. TERESA ACADEMY SCHOOL',
        partial: 'Dear Parent/Guardian,\n\nThank you for your recent payment towards {student}\'s school fees. The outstanding balance for {term}, Academic Year {year} is now {balance}.\n\nThank you for your continued support.\n\nST. TERESA ACADEMY SCHOOL',
        cleared: 'Dear Parent/Guardian,\n\nWe confirm that {student}\'s school fee balance for {term}, Academic Year {year} has been fully cleared. Thank you for your payment.\n\nST. TERESA ACADEMY SCHOOL'
      },
      sms: { provider: 'none', endpoint: '', apiKey: '', senderId: '', configs: {}, enabled: false }
    };
  },
  _merge(base, patch) {
    const out = Array.isArray(base) ? base.slice() : { ...base };
    Object.keys(patch || {}).forEach(k => {
      const v = patch[k];
      if (v && typeof v === 'object' && !Array.isArray(v) && base && typeof base[k] === 'object' && base[k] !== null && !Array.isArray(base[k])) {
        out[k] = this._merge(base[k], v);
      } else out[k] = v;
    });
    return out;
  },
  get() {
    let raw = null;
    try { raw = DB.get('notificationSettings', null); } catch (e) { raw = null; }
    return this._merge(this.defaults(), raw && typeof raw === 'object' ? raw : {});
  },
  save(patch) {
    if (!Perm.canManageNotificationSettings()) return { ok: false, error: 'You are not authorised to change notification settings.' };
    if (patch && patch.sms && !Perm.canManageSmsProvider()) delete patch.sms;
    const next = this._merge(this.get(), patch || {});
    next.updatedAt = new Date().toISOString();
    next.updatedBy = (Auth.session() || {}).name || '';
    DB.set('notificationSettings', next);
    Audit.log('notifications.settings', 'Fee notification settings updated' + (patch && patch.sms ? ' (SMS provider configuration)' : ''));
    return { ok: true, settings: next };
  },
  deadlineFor(year, term) {
    const cfg = this.get();
    const y = cfg.deadlines && cfg.deadlines[String(year)];
    return (y && y[String(term)]) || '';
  },
  render(template, vars) {
    let out = String(template == null ? '' : template);
    Object.keys(vars || {}).forEach(k => { out = out.split('{' + k + '}').join(String(vars[k] == null ? '' : vars[k])); });
    return out;
  }
};

/* ------------------------------------------------------------
   2. SMS PROVIDER INTERFACE
   Nothing is ever marked "delivered" without a successful provider
   response. With no provider configured the result is honestly
   "not_configured".
   ------------------------------------------------------------ */
const SMS_PROVIDERS = {
  none: { label: 'None (portal only)', fields: [] },
  talksasa: {
    label: 'Talk Sasa',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 'Talk Sasa API key' },
      { key: 'senderId', label: 'Sender ID', type: 'text', required: true, placeholder: 'e.g. STTERESA', hint: 'Use the exact sender ID approved in your Talk Sasa dashboard (max 11 letters/numbers, no spaces). An unregistered name is rejected as "Originator not authorized".' }
    ],
    build(cfg, phone, message) {
      return {
        url: 'https://bulksms.talksasa.com/api/v3/sms/send',
        init: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': 'Bearer ' + cfg.apiKey },
          body: JSON.stringify({ recipient: feeNormalizePhone(phone), sender_id: cfg.senderId, type: 'plain', message })
        },
        ref: d => (d && d.data && (d.data.message_id || d.data.uid)) || (d && (d.message_id || d.id)) || ''
      };
    }
  },
  africastalking: {
    label: "Africa's Talking",
    fields: [
      { key: 'username', label: 'Username', type: 'text', required: true, placeholder: 'Africa\'s Talking username' },
      { key: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 'Africa\'s Talking API key' },
      { key: 'senderId', label: 'Sender ID', type: 'text', required: false, placeholder: 'e.g. STTERESA (optional)' }
    ],
    build(cfg, phone, message) {
      const body = new URLSearchParams({ username: cfg.username, to: '+' + feeNormalizePhone(phone), message });
      if (cfg.senderId) body.set('from', cfg.senderId);
      return {
        url: 'https://api.africastalking.com/version1/messaging',
        init: {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json', 'apiKey': cfg.apiKey },
          body: body.toString()
        },
        ref: d => (d && d.SMSMessageData && d.SMSMessageData.Recipients && d.SMSMessageData.Recipients[0] && d.SMSMessageData.Recipients[0].messageId) || ''
      };
    },
    check(d) {
      const r = d && d.SMSMessageData && d.SMSMessageData.Recipients && d.SMSMessageData.Recipients[0];
      if (r && r.status && String(r.status).toLowerCase() !== 'success') return "Africa's Talking: " + r.status;
      return '';
    }
  },
  mobilesasa: {
    label: 'Mobile Sasa',
    fields: [
      { key: 'apiKey', label: 'API Token', type: 'password', required: true, placeholder: 'mbs_… token from the Mobile Sasa portal' },
      { key: 'senderId', label: 'Sender ID', type: 'text', required: true, placeholder: 'e.g. STTERESA' }
    ],
    build(cfg, phone, message) {
      return {
        url: 'https://api.mobilesasa.com/v1/send/message',
        init: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': 'Bearer ' + cfg.apiKey },
          body: JSON.stringify({ senderID: cfg.senderId, phone: feeNormalizePhone(phone), message })
        },
        ref: d => (d && d.message && (d.message.messageId || d.message.id)) || (d && (d.messageId || d.reference)) || ''
      };
    }
  },
  brevo: {
    label: 'Brevo',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 'Brevo API v3 key' },
      { key: 'senderId', label: 'Sender ID', type: 'text', required: true, placeholder: 'e.g. STTERESA (max 11 chars)' }
    ],
    build(cfg, phone, message) {
      return {
        url: 'https://api.brevo.com/v3/transactionalSMS/sms',
        init: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'api-key': cfg.apiKey },
          body: JSON.stringify({ sender: cfg.senderId, recipient: feeNormalizePhone(phone), content: message, type: 'transactional' })
        },
        ref: d => (d && d.messageId) || ''
      };
    }
  },
  twilio: {
    label: 'Twilio',
    fields: [
      { key: 'accountSid', label: 'Account SID', type: 'text', required: true, placeholder: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
      { key: 'authToken', label: 'Auth Token', type: 'password', required: true, placeholder: 'Twilio auth token' },
      { key: 'senderId', label: 'From number', type: 'text', required: true, placeholder: 'e.g. +1234567890' }
    ],
    build(cfg, phone, message) {
      const body = new URLSearchParams({ To: '+' + feeNormalizePhone(phone), From: cfg.senderId, Body: message });
      return {
        url: 'https://api.twilio.com/2010-04-01/Accounts/' + encodeURIComponent(cfg.accountSid) + '/Messages.json',
        init: {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': 'Basic ' + btoa(cfg.accountSid + ':' + cfg.authToken) },
          body: body.toString()
        },
        ref: d => (d && d.sid) || ''
      };
    }
  },
  vonage: {
    label: 'Vonage (Nexmo)',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'text', required: true, placeholder: 'Vonage API key' },
      { key: 'apiSecret', label: 'API Secret', type: 'password', required: true, placeholder: 'Vonage API secret' },
      { key: 'senderId', label: 'From / Sender ID', type: 'text', required: true, placeholder: 'e.g. STTERESA' }
    ],
    build(cfg, phone, message) {
      const body = new URLSearchParams({ api_key: cfg.apiKey, api_secret: cfg.apiSecret, to: feeNormalizePhone(phone), from: cfg.senderId, text: message });
      return {
        url: 'https://rest.nexmo.com/sms/json',
        init: { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() },
        ref: d => (d && d.messages && d.messages[0] && d.messages[0]['message-id']) || ''
      };
    },
    check(d) {
      const m = d && d.messages && d.messages[0];
      if (m && String(m.status) !== '0') return 'Vonage: ' + (m['error-text'] || ('status ' + m.status));
      return '';
    }
  },
  infobip: {
    label: 'Infobip',
    fields: [
      { key: 'baseUrl', label: 'Base URL', type: 'url', required: true, placeholder: 'https://xxxxx.api.infobip.com' },
      { key: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 'Infobip API key' },
      { key: 'senderId', label: 'Sender ID', type: 'text', required: true, placeholder: 'e.g. STTERESA' }
    ],
    build(cfg, phone, message) {
      return {
        url: String(cfg.baseUrl || '').replace(/\/+$/, '') + '/sms/2/text/advanced',
        init: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': 'App ' + cfg.apiKey },
          body: JSON.stringify({ messages: [{ destinations: [{ to: feeNormalizePhone(phone) }], from: cfg.senderId, text: message }] })
        },
        ref: d => (d && d.messages && d.messages[0] && (d.messages[0].messageId || d.messages[0].message_id)) || ''
      };
    }
  },
  webhook: {
    label: 'Generic webhook',
    fields: [
      { key: 'endpoint', label: 'Webhook endpoint URL', type: 'url', required: true, placeholder: 'https://sms-provider.example/send' },
      { key: 'apiKey', label: 'API key / bearer token', type: 'password', required: false, placeholder: 'Optional bearer token' },
      { key: 'senderId', label: 'Sender ID', type: 'text', required: false, placeholder: 'e.g. STTERESA' }
    ],
    build(cfg, phone, message) {
      return {
        url: cfg.endpoint,
        init: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(cfg.apiKey ? { 'Authorization': 'Bearer ' + cfg.apiKey } : {})
          },
          body: JSON.stringify({ to: phone, message, senderId: cfg.senderId || '' })
        },
        ref: d => (d && (d.reference || d.id || d.messageId || d.message_id)) || ''
      };
    }
  }
};

const SMSProvider = {
  providerList() { return SMS_PROVIDERS; },
  getProvider(key) { return SMS_PROVIDERS[key] || null; },
  config() { return NotificationConfig.get().sms || {}; },
  providerConfig(provider) {
    const c = this.config();
    const stored = (c.configs && c.configs[provider]) || {};
    if (provider === 'webhook') {
      return {
        endpoint: stored.endpoint != null ? stored.endpoint : (c.endpoint || ''),
        apiKey: stored.apiKey != null ? stored.apiKey : (c.apiKey || ''),
        senderId: stored.senderId != null ? stored.senderId : (c.senderId || '')
      };
    }
    return stored;
  },
  missingFields(provider) {
    const def = this.getProvider(provider);
    if (!def) return [];
    const cfg = this.providerConfig(provider);
    return (def.fields || []).filter(f => f.required && !String(cfg[f.key] == null ? '' : cfg[f.key]).trim());
  },
  isConfigured() {
    const c = this.config();
    if (!c.enabled || !c.provider || c.provider === 'none' || !this.getProvider(c.provider)) return false;
    return this.missingFields(c.provider).length === 0;
  },
  describe() {
    const c = this.config();
    const def = this.getProvider(c.provider);
    if (!c.enabled || !c.provider || c.provider === 'none' || !def) return 'No SMS provider is configured. Portal notifications still work; SMS will not be sent.';
    const cfg = this.providerConfig(c.provider);
    const bits = [];
    if (cfg.senderId) bits.push('Sender: ' + cfg.senderId);
    if (c.provider === 'webhook' && cfg.endpoint) bits.push(cfg.endpoint);
    return 'Provider: ' + def.label + (bits.length ? ' · ' + bits.join(' · ') : '');
  },
  async send(phone, message) {
    const c = this.config();
    const def = this.getProvider(c.provider);
    if (!c.enabled || !c.provider || c.provider === 'none' || !def) {
      return { ok: false, status: 'not_configured', error: 'No SMS provider is configured.' };
    }
    const missing = this.missingFields(c.provider);
    if (missing.length) {
      return { ok: false, status: 'not_configured', error: def.label + ' is missing: ' + missing.map(f => f.label).join(', ') + '.' };
    }
    if (typeof fetch !== 'function') return { ok: false, status: 'failed', error: 'This browser cannot reach the SMS provider.' };
    try {
      const cfg = this.providerConfig(c.provider);
      const req = def.build(cfg, phone, message);
      const res = await fetch(req.url, req.init);
      let raw = '';
      try { raw = await res.text(); } catch (e) { raw = ''; }
      let data = null;
      try { data = raw ? JSON.parse(raw) : null; } catch (e) { data = null; }
      if (!res.ok) {
        const detail = (data && (data.message || data.error || data.detail || (data.data && (data.data.message || data.data.error)))) || String(raw || '').slice(0, 240);
        return { ok: false, status: 'failed', error: 'Provider rejected the message (HTTP ' + res.status + ')' + (detail ? ': ' + detail : '') + '.', httpStatus: res.status };
      }
      if (typeof def.check === 'function') {
        const problem = def.check(data, res);
        if (problem) return { ok: false, status: 'failed', error: problem };
      }
      const ref = typeof def.ref === 'function' ? def.ref(data) : '';
      return { ok: true, status: 'sent', providerRef: String(ref || '') };
    } catch (e) {
      const msg = e && e.message ? e.message : 'network error';
      const hint = /failed to fetch|networkerror|load failed/i.test(msg)
        ? ' The browser could not reach the provider — this is usually a CORS/network block. Ask the provider to allow browser requests, or send through a server-side relay (Generic webhook).'
        : '';
      return { ok: false, status: 'failed', error: 'SMS provider could not be reached: ' + msg + '.' + hint };
    }
  }
};

/* ------------------------------------------------------------
   3. CONTACT RESOLUTION (never leaves the data layer)
   ------------------------------------------------------------ */
function feeNormalizePhone(raw) {
  let digits = String(raw || '').replace(/[^\d+]/g, '').replace(/^\+/, '');
  if (/^0\d{9}$/.test(digits)) digits = '254' + digits.slice(1);
  return digits;
}
function feeValidPhone(raw) {
  const d = feeNormalizePhone(raw);
  return d.length >= 9 && d.length <= 15;
}

const Messaging = {
  guard() {
    if (!Perm.canSendMessages()) return 'You are not authorised to send messages.';
    return null;
  },
  students(opts) {
    const o = opts || {};
    let list = DB.get('students').filter(s => s.status !== 'archived' && s.status !== 'withdrawn');
    if (o.className) list = list.filter(s => String(s.className || s.grade || '') === String(o.className));
    if (o.year) list = list.filter(s => !s.academicYear || String(s.academicYear) === String(o.year));
    if (o.onlyOutstanding) list = list.filter(s => Fees.balanceOf(s.id) > 0.009);
    return list;
  },
  contactsFor(student) {
    const st = student || {};
    const out = [];
    const push = (name, phone, relation) => {
      const nm = String(name || '').trim();
      const ph = String(phone || '').trim();
      if (!nm && !ph) return;
      out.push({ name: nm || 'Parent/Guardian', phone: ph, relation: relation || 'Parent/Guardian', studentId: st.id, studentName: st.fullName || (st.firstName + ' ' + st.lastName) });
    };
    push(st.parentName, st.parentPhone, st.parentRelationship || 'Parent/Guardian');
    push(st.guardian2Name, st.guardian2Phone, 'Second Parent/Guardian');
    DB.get('parents').forEach(p => {
      if ((p.childrenIds || []).includes(st.id)) push(p.name, p.phone, 'Parent/Guardian');
    });
    return out;
  },
  resolve(opts) {
    const o = opts || {};
    const audience = o.audience || 'individual';
    let students = [];
    if (audience === 'individual') {
      const ids = o.studentIds && o.studentIds.length ? o.studentIds : (o.studentId ? [o.studentId] : []);
      students = ids.map(id => Students.get(id)).filter(Boolean);
    } else if (audience === 'class') {
      students = this.students({ className: o.className, year: o.year });
    } else if (audience === 'outstanding') {
      students = this.students({ className: o.className, year: o.year, onlyOutstanding: true });
    } else {
      students = this.students({ className: o.className, year: o.year });
    }
    const byPhone = new Map();
    const invalid = [];
    students.forEach(st => {
      this.contactsFor(st).forEach(c => {
        if (!feeValidPhone(c.phone)) {
          invalid.push({ studentName: c.studentName, name: c.name, phone: c.phone, reason: c.phone ? 'Invalid number' : 'No phone number' });
          return;
        }
        const key = feeNormalizePhone(c.phone);
        if (!byPhone.has(key)) byPhone.set(key, { name: c.name, phone: c.phone, students: [c.studentName], studentIds: [st.id] });
        else {
          const row = byPhone.get(key);
          if (!row.students.includes(c.studentName)) row.students.push(c.studentName);
          if (!row.studentIds.includes(st.id)) row.studentIds.push(st.id);
        }
      });
    });
    return {
      students, contacts: Array.from(byPhone.values()), invalid,
      duplicatePhonesMerged: students.reduce((a, s) => a + Math.max(0, this.contactsFor(s).length - 1), 0)
    };
  },
  _log(entry) {
    const logs = DB.get('messageLog');
    logs.push(entry);
    if (logs.length > 800) logs.splice(0, logs.length - 800);
    DB.set('messageLog', logs);
  },
  _portalDeliver(student, title, message, meta) {
    const s = Auth.session();
    const delivered = [];
    const linkedUser = DB.get('users').find(u => u.role === 'student' && (u.id === student.id || (student.email && u.email === student.email)));
    if (linkedUser) delivered.push(student.id);
    if (Notifications.send(student.id, 'student', title, message, meta && meta.type || 'info', meta)) delivered.push(student.id);
    DB.get('parents').forEach(p => {
      if ((p.childrenIds || []).includes(student.id)) {
        Notifications.send(p.id, 'parent', title, message, meta && meta.type || 'info', { ...(meta || {}), studentId: student.id });
        delivered.push(p.id);
      }
    });
    return delivered;
  },
  async send(opts) {
    const denied = this.guard();
    if (denied) return { ok: false, error: denied };
    const o = opts || {};
    const title = String(o.title || '').trim();
    const message = String(o.message || '').trim();
    if (!title) return { ok: false, error: 'A message title is required.' };
    if (!message) return { ok: false, error: 'A message body is required.' };
    const channels = { portal: o.channels ? !!o.channels.portal : true, sms: !!(o.channels && o.channels.sms) };
    if (!channels.portal && !channels.sms) return { ok: false, error: 'Choose at least one delivery channel.' };
    const resolved = this.resolve(o);
    if (!resolved.students.length) return { ok: false, error: 'No matching recipients were found.' };
    const operator = Auth.session() || {};
    const log = {
      id: DB.uid(), type: o.audience || 'individual', title, message,
      audience: o.audience || 'individual', channels,
      sentById: operator.id, sentByName: operator.name, sentAt: new Date().toISOString(),
      recipients: [], smsConfigured: SMSProvider.isConfigured()
    };
    let portalCount = 0, smsSent = 0, smsFailed = 0, smsNotConfigured = 0;
    /* Portal notifications go to each student once */
    if (channels.portal) {
      resolved.students.forEach(st => {
        const meta = { category: 'messaging', messageId: log.id, relatedStudentId: st.id };
        this._portalDeliver(st, title, message, meta);
        portalCount++;
      });
    }
    /* SMS: one message per unique phone, combining student names */
    for (const c of resolved.contacts) {
      const body = resolved.contacts.length && c.students.length > 1 && o.audience === 'school'
        ? message + '\n\nRe: ' + c.students.join(', ')
        : message;
      let r = { ok: false, status: 'not_requested', providerRef: '', error: '' };
      if (channels.sms) {
        r = await SMSProvider.send(c.phone, body);
        if (r.ok) smsSent++;
        else if (r.status === 'not_configured') smsNotConfigured++;
        else smsFailed++;
      }
      log.recipients.push({
        name: c.name, phone: c.phone, students: c.students,
        smsStatus: channels.sms ? r.status : 'not_requested',
        providerRef: r.providerRef || '', error: r.error || '',
        portal: channels.portal ? 'delivered' : 'not_requested',
        at: new Date().toISOString()
      });
    }
    if (channels.sms && !resolved.contacts.length) {
      resolved.invalid.forEach(v => log.recipients.push({ name: v.name, phone: v.phone, students: [v.studentName], smsStatus: 'not_sent', error: v.reason, portal: 'not_requested', at: new Date().toISOString() }));
    }
    log.summary = { portalCount, smsSent, smsFailed, smsNotConfigured, invalid: resolved.invalid.length, recipients: resolved.contacts.length };
    this._log(log);
    Audit.log('message.send', log.type + ' · "' + title + '" · portal ' + portalCount + ' · sms sent ' + smsSent + ' · sms failed ' + smsFailed + ' · not configured ' + smsNotConfigured);
    return { ok: true, log, resolved, summary: log.summary };
  },
  async sendFeeReminders(studentIds, opts) {
    const denied = this.guard();
    if (denied) return { ok: false, error: denied };
    const ids = Array.isArray(studentIds) ? studentIds : [];
    if (!ids.length) return { ok: false, error: 'Select at least one student with an outstanding balance.' };
    const cfg = NotificationConfig.get();
    const o = opts || {};
    const chosen = ids.map(id => Students.get(id)).filter(Boolean).filter(s => Fees.balanceOf(s.id) > 0.009);
    if (!chosen.length) return { ok: false, error: 'None of the selected students has an outstanding balance.' };
    const channels = { portal: o.channels ? !!o.channels.portal : true, sms: !!(o.channels && o.channels.sms) };
    const operator = Auth.session() || {};
    const log = {
      id: DB.uid(), type: 'fee_reminder', title: 'School Fees Reminder',
      audience: 'fee_reminder', channels,
      sentById: operator.id, sentByName: operator.name, sentAt: new Date().toISOString(),
      recipients: [], smsConfigured: SMSProvider.isConfigured()
    };
    let portalCount = 0, smsSent = 0, smsFailed = 0, smsNotConfigured = 0, invalid = 0;
    const phoneMap = new Map();
    for (const st of chosen) {
      const year = String(o.year || st.academicYear || AcademicYears.activeYear());
      const term = String(o.term || st.term || AcademicYears.activeTerm() || '1');
      const ts = Fees.termSummary(st.id, year, term);
      const total = Fees.balanceOf(st.id);
      const balance = ts.balance > 0.009 ? ts.balance : total;
      const deadline = NotificationConfig.deadlineFor(year, term);
      const vars = { student: st.fullName || (st.firstName + ' ' + st.lastName), balance: money(balance), term: termLabel(term), year, deadline: deadline ? fmtDate(deadline) : '—' };
      const message = NotificationConfig.render(cfg.templates[o.templateKey || 'first_outstanding'], vars);
      const title = 'Fee Reminder — ' + termLabel(term) + ', ' + year;
      if (channels.portal) {
        this._portalDeliver(st, title, message, { category: 'fee_reminder', relatedStudentId: st.id, relatedYear: year, relatedTerm: term });
        portalCount++;
      }
      this.contactsFor(st).forEach(c => {
        if (!feeValidPhone(c.phone)) { invalid++; log.recipients.push({ name: c.name, phone: c.phone, students: [st.fullName], smsStatus: 'not_sent', error: c.phone ? 'Invalid number' : 'No phone number', portal: channels.portal ? 'delivered' : 'not_requested', at: new Date().toISOString() }); return; }
        const key = feeNormalizePhone(c.phone);
        if (!phoneMap.has(key)) phoneMap.set(key, { name: c.name, phone: c.phone, body: message, students: [st.fullName] });
      });
    }
    for (const c of phoneMap.values()) {
      let r = { ok: false, status: 'not_requested', providerRef: '', error: '' };
      if (channels.sms) {
        r = await SMSProvider.send(c.phone, c.body);
        if (r.ok) smsSent++; else if (r.status === 'not_configured') smsNotConfigured++; else smsFailed++;
      }
      log.recipients.push({ name: c.name, phone: c.phone, students: c.students, smsStatus: channels.sms ? r.status : 'not_requested', providerRef: r.providerRef || '', error: r.error || '', portal: channels.portal ? 'delivered' : 'not_requested', at: new Date().toISOString() });
    }
    log.summary = { portalCount, smsSent, smsFailed, smsNotConfigured, invalid, recipients: phoneMap.size };
    this._log(log);
    Audit.log('message.feeReminder', chosen.length + ' student(s) · portal ' + portalCount + ' · sms sent ' + smsSent + ' · failed ' + smsFailed + ' · not configured ' + smsNotConfigured);
    return { ok: true, log, summary: log.summary };
  },
  history(limit) {
    const logs = DB.get('messageLog').slice().reverse();
    return limit ? logs.slice(0, limit) : logs;
  }
};

/* ------------------------------------------------------------
   4. AUTOMATIC FEE-BALANCE NOTIFICATIONS
   ------------------------------------------------------------ */
const FeeNotifier = {
  _lastSent(key) {
    const logs = DB.get('feeNotificationLog');
    const hit = logs.filter(l => l.key === key).sort((a, b) => new Date(b.at) - new Date(a.at))[0];
    return hit ? new Date(hit.at).getTime() : 0;
  },
  _record(key, rule, studentId, meta) {
    const logs = DB.get('feeNotificationLog');
    logs.push({ id: DB.uid(), key, rule, studentId, at: new Date().toISOString(), meta: meta || {} });
    if (logs.length > 500) logs.splice(0, logs.length - 500);
    DB.set('feeNotificationLog', logs);
  },
  ruleFor(ctx) {
    const cfg = NotificationConfig.get();
    const st = Students.get(ctx.studentId);
    if (!st) return null;
    const year = String(ctx.year || st.academicYear || AcademicYears.activeYear());
    const term = String(ctx.term || st.term || AcademicYears.activeTerm() || '1');
    const after = ctx.after == null ? Fees.balanceOf(st.id) : Number(ctx.after);
    const before = ctx.before == null ? after : Number(ctx.before);
    const deadline = NotificationConfig.deadlineFor(year, term);
    let daysTo = null;
    if (deadline) daysTo = Math.round((new Date(deadline + 'T12:00:00').getTime() - new Date(schoolToday() + 'T12:00:00').getTime()) / 86400000);
    if (after <= 0.009 && before > 0.009) return { rule: 'cleared', year, term, deadline, daysTo, after, before };
    if (after <= 0.009) return null;
    if (before <= 0.009) return { rule: 'first_outstanding', year, term, deadline, daysTo, after, before };
    if (after < before - 0.009) return { rule: 'partial', year, term, deadline, daysTo, after, before };
    if (deadline && daysTo != null && daysTo >= 0 && daysTo <= cfg.reminderDays) return { rule: 'approaching', year, term, deadline, daysTo, after, before };
    if (deadline && daysTo != null && daysTo < 0) return { rule: 'overdue', year, term, deadline, daysTo, after, before };
    return null;
  },
  onBalanceChange(studentId, ctx) {
    const cfg = NotificationConfig.get();
    if (!cfg.enabled || !cfg.autoReminders) return { ok: false, skipped: 'disabled' };
    const st = Students.get(studentId);
    if (!st) return { ok: false, skipped: 'no student' };
    const info = this.ruleFor({ ...(ctx || {}), studentId });
    if (!info) return { ok: false, skipped: 'no rule' };
    const key = 'fee:' + info.rule + ':' + studentId + ':' + info.year + ':' + info.term;
    const cooldown = Number(cfg.cooldownDays || 7) * 86400000;
    const last = this._lastSent(key);
    if (last && Date.now() - last < cooldown) return { ok: false, skipped: 'cooldown' };
    const ts = Fees.termSummary(studentId, info.year, info.term);
    const total = Fees.balanceOf(studentId);
    const balance = info.after <= 0.009 ? 0 : (ts.balance > 0.009 ? ts.balance : total);
    const vars = {
      student: st.fullName || (st.firstName + ' ' + st.lastName),
      balance: money(balance), term: termLabel(info.term), year: info.year,
      deadline: info.deadline ? fmtDate(info.deadline) : '—'
    };
    const titleMap = {
      first_outstanding: 'School Fees Reminder',
      approaching: 'Fee Deadline Approaching',
      overdue: 'Fees Overdue',
      partial: 'Fee Balance Update',
      cleared: 'School Fees Cleared'
    };
    const title = 'ST. TERESA ACADEMY SCHOOL — ' + (titleMap[info.rule] || 'Fee Notification');
    const message = NotificationConfig.render(cfg.templates[info.rule] || cfg.templates.first_outstanding, vars);
    const deliveries = [];
    const portalOn = !cfg.channels || cfg.channels.portal !== false;
    if (portalOn) {
      deliveries.push({ channel: 'portal', status: 'delivered' });
      Notifications.send(st.id, 'student', title, message, info.rule === 'cleared' ? 'success' : (info.rule === 'overdue' ? 'alert' : 'info'), {
        category: 'fee', rule: info.rule, relatedStudentId: st.id, relatedYear: info.year, relatedTerm: info.term, balance
      });
      DB.get('parents').forEach(p => {
        if ((p.childrenIds || []).includes(st.id)) {
          Notifications.send(p.id, 'parent', title, message, info.rule === 'cleared' ? 'success' : 'info', { category: 'fee', relatedStudentId: st.id });
        }
      });
    }
    this._record(key, info.rule, st.id, { balance, year: info.year, term: info.term });
    if (cfg.channels && cfg.channels.sms) {
      const contacts = Messaging.contactsFor(st).filter(c => feeValidPhone(c.phone));
      contacts.forEach(c => {
        SMSProvider.send(c.phone, message).then(r => {
          Messaging._log({
            id: DB.uid(), type: 'fee_auto_' + info.rule, title, message,
            audience: 'automatic', channels: { portal: true, sms: true },
            sentAt: new Date().toISOString(), recipients: [{
              name: c.name, phone: c.phone, students: [st.fullName],
              smsStatus: r.status, providerRef: r.providerRef || '', error: r.error || '', portal: 'delivered', at: new Date().toISOString()
            }], summary: { portalCount: 1, smsSent: r.ok ? 1 : 0, smsFailed: r.ok ? 0 : (r.status === 'not_configured' ? 0 : 1), smsNotConfigured: r.status === 'not_configured' ? 1 : 0 }
          });
        }).catch(() => {});
      });
    }
    return { ok: true, rule: info.rule, balance, deliveries };
  },
  scanAll(opts) {
    const cfg = NotificationConfig.get();
    if (!cfg.enabled || !cfg.autoReminders) return { ok: true, sent: 0, skipped: 'disabled' };
    const o = opts || {};
    const list = DB.get('students').filter(s => s.status !== 'archived' && s.status !== 'withdrawn' && Fees.balanceOf(s.id) > 0.009);
    let sent = 0;
    list.forEach(st => {
      const y = o.year || st.academicYear || AcademicYears.activeYear();
      const t = o.term || st.term || AcademicYears.activeTerm();
      const nowBal = Fees.balanceOf(st.id);
      /* A background scan has no "before" amount; use zero so an outstanding
         balance is treated as a first-outstanding reminder (subject to the
         duplicate-reminder cooldown). */
      const r = this.onBalanceChange(st.id, { trigger: 'scan', before: 0, after: nowBal, year: y, term: t });
      if (r && r.ok) sent++;
    });
    return { ok: true, sent, scanned: list.length };
  }
};

/* ------------------------------------------------------------
   5. UI HELPERS
   ------------------------------------------------------------ */
const FeeProUI = {
  _msgTab: 'compose',
  _lastReceipt: null,
  _receiptModalReady: false,

  /* ---------- receipts ---------- */
  receiptButtons(paymentId, small) {
    const cls = small ? 'btn btn-xs btn-outline' : 'btn btn-outline btn-sm';
    return `<button class="${cls}" onclick="FeeProUI.showReceipt('${esc(paymentId)}')" title="View receipt"><i class="fas fa-eye"></i>${small ? '' : ' View'}</button>
      <button class="${cls}" onclick="FeeProUI.printReceipt('${esc(paymentId)}')" title="Print receipt"><i class="fas fa-print"></i>${small ? '' : ' Print'}</button>
      <button class="${cls}" onclick="FeeProUI.downloadReceipt('${esc(paymentId)}')" title="Download receipt PDF"><i class="fas fa-file-pdf"></i>${small ? '' : ' PDF'}</button>`;
  },
  printReceipt(paymentId) {
    if (typeof Fees.printReceipt === 'function') { Fees.printReceipt(paymentId); return; }
    const html = Fees.receiptHTML(paymentId);
    if (html) printHTML('Official Fee Receipt', html);
  },
  async downloadReceipt(paymentId) {
    const logo = await logoForPDF();
    const pdf = Fees.receiptPDF(paymentId, { logo });
    if (!pdf) { toast('Receipt not available.', 'error'); return; }
    const p = Payments.get(paymentId);
    downloadPDFFile('Receipt-' + String(p.receiptNo || paymentId).replace(/[^A-Za-z0-9-]/g, '') + '.pdf', pdf, 'application/pdf');
    Audit.log('payment.receipt.download', p.receiptNo + ' · ' + p.studentName);
  },
  _ensureReceiptModal() {
    if (document.getElementById('feeReceiptModal')) return;
    const wrap = document.createElement('div');
    wrap.className = 'modal-overlay';
    wrap.id = 'feeReceiptModal';
    wrap.innerHTML = `<div class="modal modal-lg">
      <div class="modal-head"><h3><i class="fas fa-receipt"></i> Official Fee Receipt</h3><button class="modal-close" onclick="closeModal('feeReceiptModal')">&times;</button></div>
      <div class="modal-body" id="feeReceiptBody" style="max-height:72vh;overflow:auto"></div>
      <div class="modal-foot" style="display:flex;gap:8px;flex-wrap:wrap;padding:14px 20px;border-top:1px solid var(--border)">
        <button class="btn btn-primary" onclick="FeeProUI.printLastReceipt()"><i class="fas fa-print"></i> Print</button>
        <button class="btn btn-gold" onclick="FeeProUI.downloadLastReceipt()"><i class="fas fa-file-pdf"></i> Download PDF</button>
        <button class="btn btn-outline" onclick="closeModal('feeReceiptModal')">Close</button>
      </div>
    </div>`;
    document.body.appendChild(wrap);
  },
  async showReceipt(paymentId) {
    this._lastReceipt = paymentId;
    this._ensureReceiptModal();
    const body = document.getElementById('feeReceiptBody');
    const logo = await schoolLogoForPrint();
    const html = Fees.receiptHTML(paymentId, logo);
    if (!html) return;
    if (body) body.innerHTML = html;
    openModal('feeReceiptModal');
  },
  printLastReceipt() { if (this._lastReceipt) this.printReceipt(this._lastReceipt); },
  downloadLastReceipt() { if (this._lastReceipt) this.downloadReceipt(this._lastReceipt); },

  /* ---------- term summary ---------- */
  termCards(studentId, year) {
    const st = Students.get(studentId);
    if (!st) return '';
    const y = String(year || st.academicYear || AcademicYears.activeYear());
    const sum = Fees.yearSummary(studentId, y);
    if (!sum.ok) return '';
    return `<div class="fee-term-grid">${sum.terms.map(t => `
      <div class="fee-term-card${t.balance > 0.009 ? ' is-outstanding' : ' is-clear'}">
        <div class="ftc-head"><strong>${esc(termLabel(t.term))}</strong><span class="badge badge-${t.balance > 0.009 ? 'danger' : 'success'}">${t.balance > 0.009 ? 'Outstanding' : 'Cleared'}</span></div>
        <div class="ftc-row"><span>Fees charged</span><strong>${money(t.charged)}</strong></div>
        <div class="ftc-row"><span>Adjustments</span><strong>${money(t.adjustments)}</strong></div>
        <div class="ftc-row"><span>Payments received</span><strong>${money(t.paid)}</strong></div>
        <div class="ftc-row ftc-balance"><span>Term balance</span><strong>${money(t.balance)}</strong></div>
      </div>`).join('')}</div>
      <div class="fee-total-strip">
        <span>Total charged <strong>${money(sum.totalCharged)}</strong></span>
        <span>Total paid <strong>${money(sum.totalPaid)}</strong></span>
        <span class="ftc-total">Total outstanding (all terms) <strong>${money(sum.totalOutstanding)}</strong></span>
      </div>`;
  },
  renderAccountExtras(studentId) {
    const host = document.getElementById('feeAcctTerms');
    if (host) host.innerHTML = this.termCards(studentId);
  },
  renderStudentFeesPro(s, student) {
    const host = document.getElementById('stuTermSummary');
    const st = student && student.id ? student : (typeof studentForSession === 'function' ? studentForSession(s) : null);
    if (!st || !st.id) return;
    if (host) host.innerHTML = this.termCards(st.id);
    const totalEl = document.getElementById('stuTotalBalance');
    if (totalEl) totalEl.textContent = money(Fees.balanceOf(st.id));
    const yearEl = document.getElementById('stuFeeYear');
    if (yearEl) yearEl.textContent = st.academicYear || AcademicYears.activeYear();
    const termEl = document.getElementById('stuFeeTerm');
    if (termEl) termEl.textContent = 'Term ' + (st.term || AcademicYears.activeTerm());
  },

  /* ---------- date correction ---------- */
  openDateCorrection(paymentId) {
    if (!Perm.canRecordPayments()) { toast('Only the Secretary may correct a payment date.', 'error'); return; }
    const p = Payments.get(paymentId);
    if (!p) { toast('Payment not found.', 'error'); return; }
    let m = document.getElementById('feeDateCorrectModal');
    if (!m) {
      m = document.createElement('div');
      m.className = 'modal-overlay';
      m.id = 'feeDateCorrectModal';
      m.innerHTML = `<div class="modal">
        <div class="modal-head"><h3><i class="fas fa-calendar-pen"></i> Correct Actual Payment Date</h3><button class="modal-close" onclick="closeModal('feeDateCorrectModal')">&times;</button></div>
        <div class="modal-body">
          <p id="fdcInfo" style="font-size:0.9rem;margin-bottom:12px"></p>
          <input type="hidden" id="fdcPaymentId">
          <div class="form-group"><label>Correct actual payment date <span class="req">*</span></label><input type="date" id="fdcDate" required></div>
          <div class="form-group"><label>Reason for correction <span class="req">*</span></label><textarea id="fdcReason" rows="3" required placeholder="Why is the payment date being corrected? Kept in the audit trail."></textarea></div>
          <div class="form-actions"><button class="btn btn-primary" onclick="FeeProUI.saveDateCorrection()"><i class="fas fa-save"></i> Save Correction</button><button class="btn btn-outline" onclick="closeModal('feeDateCorrectModal')">Cancel</button></div>
        </div></div>`;
      document.body.appendChild(m);
    }
    document.getElementById('fdcPaymentId').value = paymentId;
    document.getElementById('fdcDate').value = p.paymentDate || p.date || schoolToday();
    document.getElementById('fdcDate').max = schoolToday();
    document.getElementById('fdcReason').value = '';
    document.getElementById('fdcInfo').innerHTML = '<strong>' + esc(p.receiptNo) + '</strong> · ' + esc(p.studentName) + ' · ' + money(p.amount) +
      '<br>Actual date: <strong>' + esc(fmtDate(p.paymentDate || p.date)) + '</strong> · System recording date: <strong>' + esc(fmtDate(Payments.systemDateOf(p))) + '</strong>' +
      '<br><small style="color:var(--text-light)">The system recording date is never changed.</small>';
    openModal('feeDateCorrectModal');
  },
  saveDateCorrection() {
    const id = document.getElementById('fdcPaymentId').value;
    const r = Payments.correctDate(id, { paymentDate: document.getElementById('fdcDate').value, reason: document.getElementById('fdcReason').value });
    if (!r.ok) { toast(r.error, 'error'); return; }
    toast('Actual payment date corrected. Receipts now show ' + fmtDate(r.payment.paymentDate) + '.', 'success');
    closeModal('feeDateCorrectModal');
    if (typeof FeeUI !== 'undefined') FeeUI.refreshAll();
    if (FeeUI && FeeUI._accountId) FeeUI.openAccount(FeeUI._accountId);
    if (typeof renderSecretaryPayments === 'function') renderSecretaryPayments();
  },

  /* ------------------------------------------------------------
     6. MESSAGING CENTRE
     ------------------------------------------------------------ */
  msgTab(tab) {
    this._msgTab = tab || 'compose';
    this.renderMessaging();
  },
  messagingHosts() {
    return ['secMessagingRoot', 'admMessagingRoot'].map(id => document.getElementById(id)).filter(Boolean);
  },
  renderMessaging() {
    const hosts = this.messagingHosts();
    if (!hosts.length) return;
    if (!Perm.canSendMessages()) {
      hosts.forEach(h => { h.innerHTML = '<div class="empty-state"><i class="fas fa-lock"></i><h4>Messaging is restricted</h4><p>Only the Secretary and administrators can send school messages.</p></div>'; });
      return;
    }
    const canSettings = Perm.canManageNotificationSettings();
    const canProvider = Perm.canManageSmsProvider();
    const tab = this._msgTab;
    const nav = `<div class="msg-tabs">
      ${['compose|Compose', 'reminders|Fee Reminders', 'log|Delivery Log', 'settings|Settings'].map(x => { const [k, l] = x.split('|'); return `<button class="msg-tab${tab === k ? ' active' : ''}" onclick="FeeProUI.msgTab('${k}')">${l}</button>`; }).join('')}
    </div>`;
    let body = '';
    if (tab === 'compose') body = this.composeHTML();
    else if (tab === 'reminders') body = this.remindersHTML();
    else if (tab === 'log') body = this.logHTML();
    else body = this.settingsHTML(canSettings, canProvider);
    hosts.forEach(h => { h.innerHTML = nav + `<div id="msgPane">${body}</div>`; });
    if (tab === 'reminders') this.bindReminderChecks();
  },
  composeHTML() {
    const students = Messaging.students({});
    const classes = FeeUI ? FeeUI.classOptions('') : '';
    return `<div class="panel"><div class="panel-body">
      <div class="form-group"><label>Audience</label>
        <select id="msgAudience" onchange="FeeProUI.msgAudienceChanged()">
          <option value="individual">Individual student / parent</option>
          <option value="class">A whole class</option>
          <option value="school">Whole school</option>
          <option value="outstanding">Parents with outstanding fees</option>
        </select>
      </div>
      <div id="msgAudienceFields">
        ${this.individualFieldsHTML(students)}
      </div>
      <div class="form-group"><label>Message title <span class="req">*</span></label><input type="text" id="msgTitle" placeholder="e.g. School Fees Reminder" maxlength="120"></div>
      <div class="form-group"><label>Message <span class="req">*</span></label><textarea id="msgBody" rows="6" placeholder="Type the message to send…"></textarea></div>
      <div class="form-group"><label>Delivery channels</label>
        <label class="check-line"><input type="checkbox" id="msgPortal" checked> Student / Parent portal notification</label>
        <label class="check-line"><input type="checkbox" id="msgSms"> SMS to parent/guardian phone</label>
        <small style="color:var(--text-light)">${esc(SMSProvider.describe())}</small>
      </div>
      <div id="msgPreview" class="msg-preview"></div>
      <div class="form-actions">
        <button class="btn btn-outline" onclick="FeeProUI.previewCompose()"><i class="fas fa-users"></i> Preview recipients</button>
        <button class="btn btn-primary" onclick="FeeProUI.sendCompose()"><i class="fas fa-paper-plane"></i> Send message</button>
      </div>
    </div></div>`;
  },
  individualFieldsHTML(students) {
    const cls = FeeUI ? FeeUI.classOptions('') : '';
    return `<div class="form-group"><label>Student <span class="req">*</span></label>
        <input type="text" id="msgStudentSearch" placeholder="Search by name, admission number or class…" oninput="FeeProUI.filterStudentOptions()">
        <select id="msgStudent" size="1">${students.map(s => `<option value="${esc(s.id)}" data-hay="${esc(((s.firstName || '') + ' ' + (s.lastName || '') + ' ' + (s.admissionNo || '') + ' ' + (s.className || '')).toLowerCase())}">${esc(s.fullName || (s.firstName + ' ' + s.lastName))} — ${esc(s.admissionNo || '')} · ${esc(s.className || s.grade || '')}</option>`).join('')}</select>
      </div>
      <div class="form-group"><label>Class</label><select id="msgClass"><option value="">All classes</option>${cls}</select></div>`;
  },
  msgAudienceChanged() {
    const a = (document.getElementById('msgAudience') || {}).value || 'individual';
    const host = document.getElementById('msgAudienceFields');
    if (!host) return;
    if (a === 'individual') host.innerHTML = this.individualFieldsHTML(Messaging.students({}));
    else if (a === 'class') host.innerHTML = `<div class="form-group"><label>Class <span class="req">*</span></label><select id="msgClass"><option value="">Select class…</option>${FeeUI ? FeeUI.classOptions('') : ''}</select></div>`;
    else if (a === 'outstanding') host.innerHTML = `<div class="form-group"><label>Class filter</label><select id="msgClass"><option value="">All classes</option>${FeeUI ? FeeUI.classOptions('') : ''}</select></div>
      <div class="form-group"><label>Academic year filter</label><select id="msgYear">${FeeUI ? FeeUI.yearOptions(AcademicYears.activeYear()) : ''}</select></div>`;
    else host.innerHTML = `<div class="form-group"><label>Class filter (optional)</label><select id="msgClass"><option value="">All classes</option>${FeeUI ? FeeUI.classOptions('') : ''}</select></div>
      <div class="form-group"><label>Academic year filter</label><select id="msgYear">${FeeUI ? FeeUI.yearOptions(AcademicYears.activeYear()) : ''}</select></div>`;
  },
  filterStudentOptions() {
    const q = String((document.getElementById('msgStudentSearch') || {}).value || '').toLowerCase();
    const sel = document.getElementById('msgStudent');
    if (!sel) return;
    Array.from(sel.options).forEach(o => { o.hidden = !!q && !String(o.dataset.hay || '').includes(q); });
    const first = Array.from(sel.options).find(o => !o.hidden);
    if (first) sel.value = first.value;
  },
  composeOptions() {
    const audience = (document.getElementById('msgAudience') || {}).value || 'individual';
    const o = { audience };
    if (audience === 'individual') o.studentId = (document.getElementById('msgStudent') || {}).value || '';
    const cls = document.getElementById('msgClass');
    if (cls && cls.value) o.className = cls.value;
    const yr = document.getElementById('msgYear');
    if (yr && yr.value) o.year = yr.value;
    return o;
  },
  previewCompose() {
    const o = this.composeOptions();
    if (o.audience === 'individual' && !o.studentId) { toast('Choose a student.', 'error'); return; }
    if (o.audience === 'class' && !o.className) { toast('Choose a class.', 'error'); return; }
    const r = Messaging.resolve(o);
    const box = document.getElementById('msgPreview');
    if (!box) return;
    box.innerHTML = `<div class="msg-summary">
      <strong>${r.students.length}</strong> student(s) · <strong>${r.contacts.length}</strong> unique parent phone number(s)
      ${r.invalid.length ? `<div class="msg-warn">${r.invalid.length} contact(s) will be skipped: ${r.invalid.slice(0, 8).map(v => esc(v.name) + ' (' + esc(v.reason) + ')').join(', ')}${r.invalid.length > 8 ? '…' : ''}</div>` : ''}
    </div>
    <div class="table-wrap"><table class="data-table"><thead><tr><th>Parent / Guardian</th><th>Phone</th><th>Student(s)</th></tr></thead><tbody>
      ${r.contacts.map(c => `<tr><td>${esc(c.name)}</td><td>${esc(c.phone)}</td><td>${esc(c.students.join(', '))}</td></tr>`).join('') || '<tr><td colspan="3" style="text-align:center">No valid phone contacts.</td></tr>'}
    </tbody></table></div>`;
  },
  async sendCompose() {
    const o = this.composeOptions();
    const title = (document.getElementById('msgTitle') || {}).value || '';
    const message = (document.getElementById('msgBody') || {}).value || '';
    const channels = { portal: !!(document.getElementById('msgPortal') || {}).checked, sms: !!(document.getElementById('msgSms') || {}).checked };
    if (!title.trim() || !message.trim()) { toast('Enter a title and a message.', 'error'); return; }
    if (o.audience === 'individual' && !o.studentId) { toast('Choose a student.', 'error'); return; }
    if (o.audience === 'class' && !o.className) { toast('Choose a class.', 'error'); return; }
    const pre = Messaging.resolve(o);
    if (o.audience === 'school' && !confirm('Send this message to the whole school (' + pre.students.length + ' students, ' + pre.contacts.length + ' parent contacts)?')) return;
    if (o.audience === 'class' && !confirm('Send this message to ' + pre.students.length + ' student(s) in ' + o.className + '?')) return;
    const r = await Messaging.send({ ...o, title, message, channels });
    if (!r.ok) { toast(r.error, 'error'); return; }
    const s = r.summary;
    const firstError = (r.log && (r.log.recipients || []).find(x => x.error)) ? ' First error: ' + (r.log.recipients.find(x => x.error).error) : '';
    toast('Sent to portals: ' + s.portalCount + ' · SMS sent: ' + s.smsSent + ' · SMS failed: ' + s.smsFailed + ' · SMS not configured: ' + s.smsNotConfigured + firstError, s.smsFailed ? 'error' : 'success');
    this._msgTab = 'log';
    this.renderMessaging();
  },
  remindersHTML() {
    const cfg = NotificationConfig.get();
    const year = AcademicYears.activeYear();
    const students = Messaging.students({ year, onlyOutstanding: true });
    const rows = students.map(s => {
      const ts = Fees.termSummary(s.id, year, s.term || AcademicYears.activeTerm());
      return `<tr>
        <td><input type="checkbox" class="rem-check" value="${esc(s.id)}"></td>
        <td><strong>${esc(s.fullName || (s.firstName + ' ' + s.lastName))}</strong><br><small>${esc(s.admissionNo || '')}</small></td>
        <td>${esc(s.className || s.grade || '')}</td>
        <td>${esc(s.term || '')}</td>
        <td style="text-align:right">${money(ts.balance)}</td>
        <td style="text-align:right"><strong>${money(Fees.balanceOf(s.id))}</strong></td>
        <td>${feeValidPhone(s.parentPhone) ? esc(s.parentPhone) : '<span style="color:var(--danger)">Missing/invalid</span>'}</td>
      </tr>`;
    }).join('');
    return `<div class="panel"><div class="panel-head"><h3><i class="fas fa-bell"></i> Fee Reminders</h3>
        <button class="btn btn-xs btn-outline" onclick="FeeProUI.scanReminders()"><i class="fas fa-rotate"></i> Run automatic scan</button></div>
      <div class="panel-body">
        <p style="font-size:0.86rem;color:var(--text-light)">Reminders use the student's real term balance and the template configured in Settings. Invalid phone numbers are skipped and reported.</p>
        <div class="table-wrap"><table class="data-table">
          <thead><tr><th><input type="checkbox" id="remAll" onchange="FeeProUI.toggleAllReminders(this.checked)"></th><th>Student</th><th>Class</th><th>Term</th><th style="text-align:right">Term Balance</th><th style="text-align:right">Total Outstanding</th><th>Parent Phone</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-light)">No students currently have an outstanding balance.</td></tr>'}</tbody>
        </table></div>
        <div class="form-actions">
          <label class="check-line"><input type="checkbox" id="remPortal" checked> Portal notification</label>
          <label class="check-line"><input type="checkbox" id="remSms" ${cfg.channels && cfg.channels.sms ? 'checked' : ''}> SMS</label>
          <button class="btn btn-outline" onclick="FeeProUI.previewReminder()"><i class="fas fa-eye"></i> Preview</button>
          <button class="btn btn-primary" onclick="FeeProUI.sendReminders()"><i class="fas fa-paper-plane"></i> Send reminders</button>
        </div>
        <div id="remPreview" class="msg-preview"></div>
        <small style="color:var(--text-light)">${esc(SMSProvider.describe())}</small>
      </div></div>`;
  },
  bindReminderChecks() {},
  toggleAllReminders(on) { document.querySelectorAll('.rem-check').forEach(c => { c.checked = !!on; }); },
  selectedReminders() { return Array.from(document.querySelectorAll('.rem-check:checked')).map(c => c.value); },
  previewReminder() {
    const ids = this.selectedReminders();
    if (!ids.length) { toast('Select at least one student.', 'error'); return; }
    const st = Students.get(ids[0]);
    const cfg = NotificationConfig.get();
    const year = st.academicYear || AcademicYears.activeYear();
    const term = st.term || AcademicYears.activeTerm();
    const ts = Fees.termSummary(st.id, year, term);
    const balance = ts.balance > 0.009 ? ts.balance : Fees.balanceOf(st.id);
    const msg = NotificationConfig.render(cfg.templates.first_outstanding, {
      student: st.fullName || (st.firstName + ' ' + st.lastName), balance: money(balance),
      term: termLabel(term), year, deadline: NotificationConfig.deadlineFor(year, term) ? fmtDate(NotificationConfig.deadlineFor(year, term)) : '—'
    });
    const box = document.getElementById('remPreview');
    if (box) box.innerHTML = '<strong>Preview for ' + esc(st.fullName) + '</strong><pre class="msg-template-preview">' + esc(msg) + '</pre>';
  },
  async sendReminders() {
    const ids = this.selectedReminders();
    const channels = { portal: !!(document.getElementById('remPortal') || {}).checked, sms: !!(document.getElementById('remSms') || {}).checked };
    if (!ids.length) { toast('Select at least one student.', 'error'); return; }
    if (!channels.portal && !channels.sms) { toast('Choose at least one channel.', 'error'); return; }
    if (!confirm('Send fee reminders to ' + ids.length + ' selected student(s)?')) return;
    const r = await Messaging.sendFeeReminders(ids, { channels });
    if (!r.ok) { toast(r.error, 'error'); return; }
    const s = r.summary;
    const firstErr = (r.log && (r.log.recipients || []).find(x => x.error)) ? ' First error: ' + (r.log.recipients.find(x => x.error).error) : '';
    toast('Reminders: portal ' + s.portalCount + ' · SMS sent ' + s.smsSent + ' · failed ' + s.smsFailed + ' · not configured ' + s.smsNotConfigured + ' · invalid ' + s.invalid + firstErr, s.smsFailed ? 'error' : 'success');
    this._msgTab = 'log';
    this.renderMessaging();
  },
  scanReminders() {
    const r = FeeNotifier.scanAll({});
    toast('Automatic scan checked ' + r.scanned + ' student(s); ' + r.sent + ' reminder(s) sent (cooldown prevents repeats).', 'success');
  },
  logHTML() {
    const logs = Messaging.history(60);
    const rows = logs.map(l => {
      const s = l.summary || {};
      return `<tr>
        <td>${esc(new Date(l.sentAt).toLocaleString())}</td>
        <td><strong>${esc(l.title)}</strong><br><small>${esc(l.type)}</small></td>
        <td>${esc(l.sentByName || '—')}</td>
        <td>${l.channels && l.channels.portal ? 'Portal' : ''}${l.channels && l.channels.sms ? ' + SMS' : ''}</td>
        <td>${s.portalCount || 0}</td>
        <td>${s.smsSent || 0}</td>
        <td>${s.smsFailed || 0}</td>
        <td>${s.smsNotConfigured || 0}</td>
        <td><button class="btn btn-xs btn-outline" onclick="FeeProUI.viewLog('${esc(l.id)}')" title="View details"><i class="fas fa-eye"></i></button>
          ${Perm.canSendMessages() ? `<button class="btn btn-xs btn-danger" onclick="FeeProUI.deleteLog('${esc(l.id)}')" title="Delete log"><i class="fas fa-trash"></i></button>` : ''}</td>
      </tr>`;
    }).join('');
    return `<div class="panel"><div class="panel-head"><h3><i class="fas fa-list-check"></i> Delivery Log</h3>
        ${Perm.canSendMessages() && logs.length ? '<button class="btn btn-sm btn-danger" onclick="FeeProUI.clearLogs()"><i class="fas fa-trash"></i> Clear all</button>' : ''}</div>
      <div class="panel-body table-wrap"><table class="data-table">
        <thead><tr><th>Sent</th><th>Message</th><th>By</th><th>Channels</th><th>Portal</th><th>SMS Sent</th><th>SMS Failed</th><th>Not Configured</th><th>Action</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--text-light)">No messages have been sent yet.</td></tr>'}</tbody>
      </table></div><div id="msgLogDetail"></div></div>`;
  },
  deleteLog(id) {
    if (!Perm.canSendMessages()) { toast('You are not authorised to delete delivery logs.', 'error'); return; }
    const log = DB.get('messageLog').find(l => l.id === id);
    if (!log) { toast('That log entry no longer exists.', 'error'); return; }
    if (!confirm('Delete this delivery log?\n\n"' + log.title + '"\n\nThis cannot be undone.')) return;
    DB.set('messageLog', DB.get('messageLog').filter(l => l.id !== id));
    Audit.log('message.logDelete', 'Delivery log deleted · "' + log.title + '" · ' + log.id);
    toast('Delivery log deleted.', 'success');
    this.renderMessaging();
  },
  clearLogs() {
    if (!Perm.canSendMessages()) { toast('You are not authorised to clear delivery logs.', 'error'); return; }
    const logs = DB.get('messageLog');
    if (!logs.length) { toast('There are no delivery logs to clear.', 'error'); return; }
    if (!confirm('Delete all ' + logs.length + ' delivery log entries? This cannot be undone.')) return;
    DB.set('messageLog', []);
    Audit.log('message.logClear', 'All delivery logs cleared (' + logs.length + ' entries)');
    toast('All delivery logs cleared.', 'success');
    this.renderMessaging();
  },
  viewLog(id) {
    const log = DB.get('messageLog').find(l => l.id === id);
    const box = document.getElementById('msgLogDetail');
    if (!log || !box) return;
    box.innerHTML = `<div class="panel"><div class="panel-head"><h3>${esc(log.title)}</h3></div><div class="panel-body table-wrap">
      <p style="font-size:0.86rem;color:var(--text-light)">${esc(log.message).replace(/\n/g, '<br>')}</p>
      <table class="data-table"><thead><tr><th>Recipient</th><th>Phone</th><th>Student(s)</th><th>Portal</th><th>SMS status</th><th>Provider ref</th><th>Error</th><th>At</th></tr></thead><tbody>
      ${(log.recipients || []).map(r => `<tr><td>${esc(r.name)}</td><td>${esc(r.phone)}</td><td>${esc((r.students || []).join(', '))}</td><td>${esc(r.portal)}</td><td><span class="badge badge-${r.smsStatus === 'sent' ? 'success' : r.smsStatus === 'not_configured' ? 'warning' : r.smsStatus === 'failed' ? 'danger' : 'navy'}">${esc(r.smsStatus)}</span></td><td>${esc(r.providerRef || '—')}</td><td>${esc(r.error || '—')}</td><td>${esc(r.at ? new Date(r.at).toLocaleString() : '')}</td></tr>`).join('') || '<tr><td colspan="8" style="text-align:center">No recipient rows.</td></tr>'}
      </tbody></table></div></div>`;
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },
  settingsHTML(canSettings, canProvider) {
    const cfg = NotificationConfig.get();
    const year = AcademicYears.activeYear();
    const deadlines = cfg.deadlines && cfg.deadlines[String(year)] || {};
    const dis = canSettings ? '' : 'disabled';
    return `<div class="panel"><div class="panel-head"><h3><i class="fas fa-sliders"></i> Fee Notification Settings</h3></div>
      <div class="panel-body">
        ${!canSettings ? '<div class="msg-warn">You do not have permission to change these settings.</div>' : ''}
        <div class="settings-grid">
          <label class="check-line"><input type="checkbox" id="nsEnabled" ${cfg.enabled ? 'checked' : ''} ${dis}> Automatic fee notifications enabled</label>
          <label class="check-line"><input type="checkbox" id="nsAuto" ${cfg.autoReminders ? 'checked' : ''} ${dis}> Send reminders automatically when a balance changes</label>
          <label class="check-line"><input type="checkbox" id="nsPortal" ${cfg.channels.portal ? 'checked' : ''} ${dis}> Portal notifications</label>
          <label class="check-line"><input type="checkbox" id="nsSms" ${cfg.channels.sms ? 'checked' : ''} ${dis}> SMS notifications</label>
          <label class="check-line"><input type="checkbox" id="nsRef" ${cfg.requireReference ? 'checked' : ''} ${dis}> Require transaction reference for M-Pesa / bank / cheque / card payments</label>
        </div>
        <div class="form-row-2">
          <div class="form-group"><label>Reminder window before deadline (days)</label><input type="number" min="1" max="90" id="nsDays" value="${Number(cfg.reminderDays) || 7}" ${dis}></div>
          <div class="form-group"><label>Duplicate-reminder cooldown (days)</label><input type="number" min="0" max="365" id="nsCooldown" value="${Number(cfg.cooldownDays) || 7}" ${dis}></div>
        </div>
        <h4 style="color:var(--navy);margin:14px 0 8px">Term payment deadlines — ${esc(year)}</h4>
        <div class="form-row-3">
          ${['1', '2', '3'].map(t => `<div class="form-group"><label>Term ${t} deadline</label><input type="date" id="nsDeadline${t}" value="${esc(deadlines[t] || '')}" ${dis}></div>`).join('')}
        </div>
        <h4 style="color:var(--navy);margin:14px 0 8px">Default message templates</h4>
        ${[['first_outstanding', 'Outstanding balance'], ['approaching', 'Deadline approaching'], ['overdue', 'Overdue balance'], ['partial', 'After a partial payment'], ['cleared', 'Balance cleared']].map(([k, l]) =>
          `<div class="form-group"><label>${l}</label><textarea rows="4" id="nsTpl_${k}" ${dis}>${esc(cfg.templates[k] || '')}</textarea></div>`).join('')}
        <p style="font-size:0.8rem;color:var(--text-light)">Placeholders: {student}, {balance}, {term}, {year}, {deadline}.</p>
        <h4 style="color:var(--navy);margin:14px 0 8px">Add SMS Provider</h4>
        <p style="font-size:0.85rem;color:var(--text-light)">${esc(SMSProvider.describe())}</p>
        ${canProvider ? `
          <div class="form-row-2">
            <div class="form-group"><label>Provider <span class="req">*</span></label><select id="nsSmsProvider" onchange="FeeProUI.smsProviderChanged()">
              <option value="none"${!cfg.sms.provider || cfg.sms.provider === 'none' ? ' selected' : ''}>Select Provider</option>
              ${Object.keys(SMSProvider.providerList()).filter(p => p !== 'none').map(p => `<option value="${esc(p)}"${cfg.sms.provider === p ? ' selected' : ''}>${esc(SMSProvider.getProvider(p).label)}</option>`).join('')}
            </select></div>
          </div>
          <div id="nsSmsProviderConfig">${this.smsProviderFieldsHTML(cfg.sms.provider)}</div>
          <label class="check-line"><input type="checkbox" id="nsSmsEnabled" ${cfg.sms.enabled ? 'checked' : ''}> Enable SMS delivery</label>`
        : '<div class="msg-warn">SMS provider credentials can only be changed by an administrator.</div>'}
        <div class="form-actions">
          ${canSettings ? '<button class="btn btn-primary" onclick="FeeProUI.saveSettings()"><i class="fas fa-save"></i> Save settings</button>' : ''}
          ${canProvider ? '<button class="btn btn-outline" onclick="FeeProUI.testSms()"><i class="fas fa-vial"></i> Send test SMS</button>' : ''}
          <button class="btn btn-outline" onclick="FeeProUI.msgTab(\'log\')"><i class="fas fa-list-check"></i> View delivery history</button>
        </div>
      </div></div>`;
  },
  async testSms() {
    const phone = prompt('Send a test SMS to which phone number? (e.g. 0712345678)');
    if (!phone) return;
    if (!feeValidPhone(phone)) { toast('Enter a valid phone number.', 'error'); return; }
    const r = await SMSProvider.send(phone, 'This is a test message from ST. TERESA ACADEMY.');
    if (r.ok) toast('Test SMS accepted by the provider.' + (r.providerRef ? ' · Ref: ' + r.providerRef : ''), 'success');
    else toast(r.error, 'error');
  },
  smsProviderFieldsHTML(provider) {
    const def = SMSProvider.getProvider(provider);
    if (!def || !def.fields || !def.fields.length) return '';
    const cfg = SMSProvider.providerConfig(provider);
    const fields = def.fields.map(f => {
      const req = f.required ? ' <span class="req">*</span>' : '';
      const val = cfg[f.key] == null ? '' : cfg[f.key];
      return `<div class="form-group"><label>${esc(f.label)}${req}</label>
        <input type="${esc(f.type || 'text')}" id="nsSmsCfg_${esc(f.key)}" value="${esc(val)}" placeholder="${esc(f.placeholder || '')}" autocomplete="off">
        ${f.hint ? `<small style="color:var(--text-light)">${esc(f.hint)}</small>` : ''}</div>`;
    }).join('');
    return `<div class="provider-config">
      <h4 style="color:var(--navy);margin:14px 0 8px">${esc(def.label)} Configuration</h4>
      <div class="form-row-2">${fields}</div>
      <small style="color:var(--text-light)">The provider is called only when an SMS is actually sent. A failed call is logged as failed — never as delivered. Some providers block direct browser requests (CORS) — if a test fails with a network error, use a server-side relay via Generic webhook.</small>
    </div>`;
  },
  smsProviderChanged() {
    const provider = (document.getElementById('nsSmsProvider') || {}).value || '';
    const host = document.getElementById('nsSmsProviderConfig');
    if (host) host.innerHTML = this.smsProviderFieldsHTML(provider);
  },
  saveSettings() {
    const patch = {
      enabled: !!(document.getElementById('nsEnabled') || {}).checked,
      autoReminders: !!(document.getElementById('nsAuto') || {}).checked,
      channels: {
        portal: !!(document.getElementById('nsPortal') || {}).checked,
        sms: !!(document.getElementById('nsSms') || {}).checked
      },
      requireReference: !!(document.getElementById('nsRef') || {}).checked,
      reminderDays: Number((document.getElementById('nsDays') || {}).value || 7),
      cooldownDays: Number((document.getElementById('nsCooldown') || {}).value || 7),
      deadlines: {},
      templates: {}
    };
    const year = AcademicYears.activeYear();
    patch.deadlines[year] = {};
    ['1', '2', '3'].forEach(t => { const el = document.getElementById('nsDeadline' + t); if (el) patch.deadlines[year][t] = el.value; });
    ['first_outstanding', 'approaching', 'overdue', 'partial', 'cleared'].forEach(k => {
      const el = document.getElementById('nsTpl_' + k);
      if (el) patch.templates[k] = el.value;
    });
    const providerEl = document.getElementById('nsSmsProvider');
    if (providerEl) {
      const provider = providerEl.value || 'none';
      const def = SMSProvider.getProvider(provider);
      const values = {};
      (def && def.fields ? def.fields : []).forEach(f => {
        const el = document.getElementById('nsSmsCfg_' + f.key);
        if (el) values[f.key] = el.value.trim();
      });
      const prevSms = NotificationConfig.get().sms || {};
      patch.sms = {
        provider,
        enabled: !!(document.getElementById('nsSmsEnabled') || {}).checked,
        configs: Object.assign({}, prevSms.configs || {}, { [provider]: values })
      };
    }
    const r = NotificationConfig.save(patch);
    toast(r.ok ? 'Notification settings saved.' : r.error, r.ok ? 'success' : 'error');
    if (r.ok) this.renderMessaging();
  },

  /* ------------------------------------------------------------
     7. WIRING
     ------------------------------------------------------------ */
  afterPayment(result, opts) {
    if (!result || !result.ok) return;
    this._lastReceipt = result.payment.id;
    try { this.showReceipt(result.payment.id); } catch (e) { /* printing still works */ }
    if (opts && opts.refresh) opts.refresh();
  },
  init() {
    if (typeof Fees === 'undefined') return;
    /* refresh messaging section when it is opened from either portal */
    window.onSectionOpen = (function (prev) {
      return function (section, link) {
        if (typeof prev === 'function') { try { prev(section, link); } catch (e) {} }
        if (section === 'messaging' || section === 'messaging-admin') {
          try { FeeProUI.renderMessaging(); } catch (e) { console.error(e); }
        }
        if (section === 'student-fees' && FeeUI && FeeUI._accountId) {
          try { FeeProUI.renderAccountExtras(FeeUI._accountId); } catch (e) {}
        }
        if (section === 'fees') {
          try {
            const s = Auth.session();
            const st = (typeof studentForSession === 'function') ? studentForSession(s) : null;
            if (st && st.id) FeeProUI.renderStudentFeesPro(s, st);
          } catch (e) {}
        }
      };
    })(window.onSectionOpen);
  }
};

/* ------------------------------------------------------------
   8. BACKGROUND SCAN
   Automatic reminders for approaching/overdue deadlines are evaluated
   at most once per cooldown when the portal loads.
   ------------------------------------------------------------ */
document.addEventListener('DOMContentLoaded', () => {
  try { FeeProUI.init(); } catch (e) { console.error(e); }
  try {
    const page = document.body ? document.body.dataset.page : '';
    if (page === 'student') {
      const s = Auth.session();
      const st = (typeof studentForSession === 'function') ? studentForSession(s) : null;
      if (s && st && st.id) {
        FeeProUI.renderStudentFeesPro(s, st);
        if (typeof renderStudentFees === 'function') renderStudentFees(s);
      }
    }
    if (page === 'secretary') {
      const host = document.getElementById('secMessagingRoot');
      if (host) FeeProUI.renderMessaging();
    }
    if (page === 'admin') {
      const host = document.getElementById('admMessagingRoot');
      if (host) FeeProUI.renderMessaging();
    }
  } catch (e) { console.error(e); }
  try {
    if (typeof FeeNotifier !== 'undefined' && Perm.canSendMessages()) {
      setTimeout(() => { try { FeeNotifier.scanAll({}); } catch (e) {} }, 1500);
    }
  } catch (e) {}
});
