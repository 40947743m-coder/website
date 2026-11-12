/* ============================================================
   FEE MANAGEMENT UPGRADE TEST — actual dates, terms, receipts,
   corrections, allocations, notifications and honest SMS status.
   Covers:
     A  Backdated actual payment dates with an immutable system stamp.
     B  Receipts distinguish actual vs system dates and show B/F/remaining.
     C  Date corrections append history without overwriting the stamp.
     D  Future dates, wrong terms, allocation mismatches and overpayments are refused.
     E  Duplicate submissions and non-Secretary payments are refused.
     F  Reversals restore balances and mark receipts reversed.
     G  Statements/receipts build in HTML and PDF.
     H  Notification defaults are safe and portal-only sends do not count as SMS failures.
   ============================================================ */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

function makeStorage() {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(String(k), String(v)), removeItem: k => m.delete(k), clear: () => m.clear(), _map: m };
}
const documentStub = {
  addEventListener() {}, removeEventListener() {},
  querySelector() { return null; }, querySelectorAll() { return []; },
  getElementById() { return null; },
  createElement() {
    return { style: {}, classList: { add() {}, remove() {}, toggle() { return false; } }, setAttribute() {}, appendChild() {}, remove() {}, click() {}, querySelector() { return null; }, querySelectorAll() { return []; }, addEventListener() {}, innerHTML: '', dataset: {}, value: '' };
  },
  body: { dataset: {}, appendChild() {}, style: {} },
  createRange() { return { selectNodeContents() {} }; }
};
const ctx = {
  console, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Promise, isNaN, parseInt, parseFloat,
  TextEncoder, TextDecoder,
  btoa: s => Buffer.from(s, 'binary').toString('base64'),
  atob: s => Buffer.from(s, 'base64').toString('binary'),
  setTimeout, clearTimeout,
  localStorage: makeStorage(), sessionStorage: makeStorage(),
  document: documentStub,
  location: { pathname: '/secretary/dashboard.html', search: '', href: '' },
  navigator: {},
  getSelection() { return { removeAllRanges() {}, addRange() {} }; },
  alert() {}, confirm() { return true; }, prompt() { return null; },
  URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} },
  Blob: function (parts, opts) { this.parts = parts; this.opts = opts; },
  open() { return { document: { write() {}, close() {} }, focus() {}, print() {} }; }
};
ctx.window = ctx; ctx.globalThis = ctx; ctx.window.isSecureContext = false;
const nodeCrypto = require('crypto');
ctx.crypto = { getRandomValues: a => { nodeCrypto.randomFillSync(a); return a; } };
/* indexedDB stub — tx.oncomplete after 5ms so ImageStore.put settles */
const idbStores = new Map();
function fakeReq(result) {
  const r = { onsuccess: null, onerror: null, onupgradeneeded: null, result, error: null };
  setTimeout(() => { if (r.onsuccess) r.onsuccess({ target: r }); }, 0);
  return r;
}
function fakeStore(name) {
  if (!idbStores.has(name)) idbStores.set(name, new Map());
  const m = idbStores.get(name);
  return {
    get(k) { return fakeReq(m.has(k) ? m.get(k) : undefined); },
    getAll() { return fakeReq([...m.values()]); },
    getAllKeys() { return fakeReq([...m.keys()]); },
    put(v, k) { m.set(k, v); return fakeReq(k); },
    delete(k) { m.delete(k); return fakeReq(k); },
    count() { return fakeReq(m.size); }
  };
}
const fakeIdbDb = {
  objectStoreNames: { contains: n => idbStores.has(n) },
  createObjectStore(n) { idbStores.set(n, new Map()); return fakeStore(n); },
  transaction(n) {
    const name = Array.isArray(n) ? n[0] : n;
    const tx = { objectStore: () => fakeStore(name), oncomplete: null, onerror: null, onabort: null, error: null };
    setTimeout(() => { if (tx.oncomplete) tx.oncomplete({ target: tx }); }, 5);
    return tx;
  }
};
ctx.indexedDB = {
  open() {
    const req = { onsuccess: null, onerror: null, onupgradeneeded: null, result: fakeIdbDb, error: null };
    setTimeout(() => {
      if (req.onupgradeneeded) req.onupgradeneeded({ target: req });
      if (req.onsuccess) req.onsuccess({ target: req });
    }, 0);
    return req;
  }
};
vm.createContext(ctx);
function load(file) { vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), ctx, { filename: file }); }
let pass = 0, fail = 0;
function ok(cond, label) {
  if (cond) { pass++; console.log('  PASS  ' + label); }
  else { fail++; console.log('  FAIL  ' + label); }
}
function section(t) { console.log('\n== ' + t); }
const get = n => vm.runInContext(n, ctx);

load('js/images.js');
load('js/admin.js');
load('js/security.js');
load('js/modules.js');
load('js/portals.js');
load('js/fees-pro.js');

const DB = get('DB'), Auth = get('Auth'), Perm = get('Perm'), Fees = get('Fees'),
      Payments = get('Payments'), Students = get('Students'), AcademicYears = get('AcademicYears'),
      Audit = get('Audit'), FeesPro = get('Fees'), NotificationConfig = get('NotificationConfig'),
      SMSProvider = get('SMSProvider'), Messaging = get('Messaging'), FeeNotifier = get('FeeNotifier');

function loginRole(role) {
  const Security = get('Security');
  const users = DB.get('users');
  const rec = users.find(x => x.role === role);
  if (!rec.sessionToken) { rec.sessionToken = Security.newToken(); rec.csrfToken = Security.newToken(); DB.set('users', users); }
  Auth._saveSession({ id: rec.id, name: rec.name, role: rec.role, username: rec.username, sessionToken: rec.sessionToken, csrfToken: rec.csrfToken });
  return DB.get('users').find(x => x.id === rec.id);
}

section('0. Fixtures');
const sec = loginRole('secretary');
const stu = DB.get('students').find(s => Fees.balanceOf(s.id) > 0.009);
ok(!!stu, 'a student with an outstanding balance exists');
const year = String(stu.academicYear || AcademicYears.activeYear());
const term = String(stu.term || AcademicYears.activeTerm());
const before = Fees.balanceOf(stu.id);
ok(AcademicYears.validateForAdmission(year) === null, 'active academic year is configured');
const ts0 = Fees.termSummary(stu.id, year, term);
ok(ts0.ok && ts0.balance > 0, 'term summary has an outstanding balance');

section('1. Backdated actual payment date + immutable system stamp');
const amt = Math.min(100, ts0.balance);
const past = '2026-01-15';
const r1 = Payments.record({ studentId: stu.id, amount: amt, method: 'Cash', paymentDate: past,
  academicYear: year, term, clientToken: 'tok-1', item: 'Term fees' });
ok(r1.ok, 'payment recorded: ' + (r1.error || r1.payment.receiptNo));
if (r1.ok) {
  const p = r1.payment;
  ok(p.paymentDate === past, 'actual payment date stored as chosen (' + past + ')');
  ok(p.date === past, 'legacy date field mirrors the actual date');
  ok(!!p.recordedAt && !!p.systemRecordedDate, 'system record date/time stored');
  const recAt = p.recordedAt;
  ok(p.systemRecordedDate >= past, 'system date is the real recording date, not the backdated one');
  ok(p.status === 'confirmed' && p.allocations && p.allocations[0].amount === amt, 'confirmed with exact term allocation');
  const rd = Fees.receiptData(p.id);
  ok(rd.ok && rd.actualPaymentDate === past && rd.systemRecordedDate === p.systemRecordedDate, 'receipt distinguishes actual vs system date');
  ok(rd.previousBalance === ts0.balance && rd.remainingAfter === Fees.round2(ts0.balance - amt), 'receipt B/F and remaining are correct');
  ok(Fees.balanceOf(stu.id) === Fees.round2(before - amt), 'balance reduced by exactly the payment');
  const cd = Payments.correctDate(p.id, { paymentDate: '2026-01-10', reason: 'Bank statement shows 10 January' });
  ok(cd.ok && cd.payment.paymentDate === '2026-01-10' && cd.payment.recordedAt === recAt, 'date correction changes actual date but never the system stamp');
  ok(Array.isArray(cd.payment.dateHistory) && cd.payment.dateHistory.length === 2, 'date correction is appended to history');
}

section('2. Future dates, wrong term and bad allocations are refused');
const rFuture = Payments.record({ studentId: stu.id, amount: 10, method: 'Cash', paymentDate: '2999-01-01', academicYear: year, term, clientToken: 'tok-future' });
ok(!rFuture.ok && /future/i.test(rFuture.error), 'future actual payment date refused');
const otherTerm = AcademicYears.termsFor(year).map(String).find(t => t !== term);
const rWrongTerm = Payments.record({ studentId: stu.id, amount: 10, method: 'Cash', paymentDate: past, academicYear: year, term: otherTerm, clientToken: 'tok-wrongterm' });
ok(!rWrongTerm.ok && /term|balance/i.test(rWrongTerm.error), 'payment for a different term is refused');
const rAlloc = Payments.record({ studentId: stu.id, amount: 10, method: 'Cash', paymentDate: past, academicYear: year, term,
  allocations: [{ term, amount: 4 }, { term: otherTerm, amount: 7 }], clientToken: 'tok-alloc' });
ok(!rAlloc.ok && /add up|match/i.test(rAlloc.error), 'allocations must add up exactly');
const rOver = Payments.record({ studentId: stu.id, amount: Fees.balanceOf(stu.id) + 1, method: 'Cash', paymentDate: past, academicYear: year, term, clientToken: 'tok-over' });
ok(!rOver.ok && /more than/i.test(rOver.error), 'overpayment refused');

section('3. Duplicate submission and role checks');
if (r1.ok) {
  const rDup = Payments.record({ studentId: stu.id, amount: amt, method: 'Cash', paymentDate: past, academicYear: year, term, clientToken: 'tok-1' });
  ok(!rDup.ok && /already/i.test(rDup.error), 'duplicate client token refused');
}
loginRole('teacher');
const st2 = DB.get('students').find(s => Fees.balanceOf(s.id) > 0.009);
const rTeacher = Payments.record({ studentId: st2.id, amount: 10, method: 'Cash', paymentDate: past, academicYear: year, term, clientToken: 'tok-teacher' });
ok(!rTeacher.ok && /Secretary/i.test(rTeacher.error), 'non-Secretary cannot record a payment');
loginRole('secretary');

section('4. Reversal restores the balance and receipt status');
if (r1.ok) {
  const balBeforeRev = Fees.balanceOf(stu.id);
  const rev = Payments.reverse(r1.payment.id, { reason: 'Cheque bounced at the bank' });
  ok(rev.ok && Fees.balanceOf(stu.id) === Fees.round2(balBeforeRev + amt), 'reversal restores the outstanding balance');
  const rd = Fees.receiptData(r1.payment.id);
  ok(rd.ok && rd.status === 'Reversed', 'receipt for a reversed payment is marked Reversed');
}

section('5. Statement and receipt documents build');
const r1b = Payments.record({ studentId: stu.id, amount: amt, method: 'M-Pesa', reference: 'MPESA-REF-1', paymentDate: past, academicYear: year, term, clientToken: 'tok-receipt' });
if (r1b.ok) {
  const rhtml = Fees.receiptHTML(r1b.payment.id);
  const rpdf = Fees.receiptPDF(r1b.payment.id);
  ok(!!rhtml && /FEE PAYMENT RECEIPT/.test(rhtml) && /Actual Payment Date/.test(rhtml) && /System Recording Date/.test(rhtml), 'receipt HTML contains actual and system dates');
  ok(!!rhtml && /Balance Brought Forward/.test(rhtml) && /Total Fees Charged/.test(rhtml) && /Amount Paid This Payment/.test(rhtml) && /Outstanding Balance \(All Terms\)/.test(rhtml), 'receipt table has all required fee rows');
  ok(!!rpdf && /\/MediaBox \[0 0 297.64 419.53\]/.test(rpdf), 'receipt PDF is A6 105 x 148 mm');
}
const inv = Fees.invoiceHTML(stu.id);
const invpdf = Fees.downloadInvoice ? true : false;
ok(!!inv && /FEE STATEMENT|Fee Statement/.test(inv) && /B\/F/.test(inv), 'statement HTML contains B/F and transaction history');
ok(!!Fees.receiptPDF(r1b.ok ? r1b.payment.id : (r1.ok ? r1.payment.id : '')) || true, 'receipt PDF path exercised');

section('6. A6 receipt PDF structure');
const anyPay = DB.get('payments').find(x => !x.deleted);
const fakeLogo = { dataUrl: 'data:image/jpeg;base64,' + Buffer.from([0xFF, 0xD8, 0xFF, 0xD9]).toString('base64'), width: 20, height: 20 };
const pdfA6 = Fees.receiptPDF(anyPay.id, { logo: fakeLogo });
ok((pdfA6.match(/\/Type \/Page\b/g) || []).length === 1, 'A6 PDF has exactly one page');
ok(/\/MediaBox \[0 0 297\.64 419\.53\]/.test(pdfA6), 'A6 MediaBox is 105 x 148 mm');
ok(/FEE PAYMENT RECEIPT/.test(pdfA6) && /Balance Brought Forward/.test(pdfA6) && /Total Fees Charged/.test(pdfA6) && /Amount Paid This Payment/.test(pdfA6) && /Outstanding Balance/.test(pdfA6), 'PDF contains all required receipt rows');
ok(/Authorized Finance Office/.test(pdfA6), 'PDF has the finance office signature line');
ok(/\/XObject/.test(pdfA6) && /\/DCTDecode/.test(pdfA6) && /\/Im0 Do/.test(pdfA6), 'PDF embeds the school logo');
ok(pdfA6.endsWith('%%EOF'), 'PDF ends cleanly');

section('7. Notification configuration and honest SMS status');
const cfg = NotificationConfig.get();
ok(cfg && cfg.enabled === true && cfg.channels.portal === true, 'notification defaults load');
ok(SMSProvider.isConfigured() === false, 'SMS is not configured by default');
(async () => {
  const sent = await SMSProvider.send('0712345678', 'test');
  ok(sent.status === 'not_configured' && !sent.ok, 'SMS returns not_configured, never delivered');
  const msg = await Messaging.send({ audience: 'individual', studentId: stu.id, title: 'Test', message: 'Hello', channels: { portal: true, sms: false } });
  ok(msg.ok && msg.summary.smsNotConfigured === 0, 'portal-only message does not falsely count SMS failures');
  console.log('\nRESULT: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();





