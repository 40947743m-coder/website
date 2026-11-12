/* ============================================================
   ST. TERESA ACADEMY — SCHOOL MANAGEMENT MODULES (v2)
   Classes · Class Teachers · Homework · Attendance · Materials
   Announcements · Notifications · Parents · Audit · Results
   Loaded AFTER admin.js (uses DB, Auth, toast, helpers)
   ============================================================ */

/* ---------- AUTHORITATIVE SCHOOL CLOCK ----------
   Every money record is stamped with the school's configured timezone, not
   the browser's local clock. The user cannot change either value from the
   form or the API: only this function writes the recording timestamp. */
function schoolTimeZone() {
  const st = DB.get('settings', {});
  return st.timezone || 'Africa/Nairobi';
}
function schoolNow() {
  const tz = schoolTimeZone();
  const now = new Date();
  let date, time;
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }).formatToParts(now).reduce((a, p) => { a[p.type] = p.value; return a; }, {});
    date = parts.year + '-' + parts.month + '-' + parts.day;
    time = parts.hour + ':' + parts.minute + ':' + parts.second;
  } catch (e) {
    date = now.toISOString().slice(0, 10);
    time = now.toISOString().slice(11, 19);
  }
  return { iso: now.toISOString(), date, time, timeZone: tz };
}
function schoolToday() { return schoolNow().date; }
function isIsoDate(d) { return /^\d{4}-\d{2}-\d{2}$/.test(String(d || '')) && !isNaN(new Date(String(d) + 'T12:00:00').getTime()); }
function termLabel(t) { return t ? 'Term ' + t : 'All Terms'; }

/* ---------- PERMISSIONS (data-layer checks = "server-side") ---------- */
const Perm = {
  session() { return Auth.session(); },
  isAdmin() { const s = Auth.session(); return s && (s.role === 'admin' || s.role === 'headteacher' || s.role === 'director'); },
  isSuper() { const s = Auth.session(); return s && s.role === 'admin'; },
  isTeacher() { const s = Auth.session(); return s && s.role === 'teacher'; },
  isStudent() { const s = Auth.session(); return s && s.role === 'student'; },
  isParent() { const s = Auth.session(); return s && s.role === 'parent'; },
  isStaff() { const s = Auth.session(); return s && ['admin', 'headteacher', 'director', 'teacher', 'secretary'].includes(s.role); },
  canManageClasses() { return this.isSuper(); },
  canManageAcademicYears() { return this.isSuper(); },
  canAssignTeachers() { return this.isSuper(); },
  canViewAllStudents() { return this.isStaff(); },
  canMarkAttendance(teacherId, classId) {
    const s = Auth.session();
    if (!s) return false;
    if (this.isAdmin() || s.role === 'secretary') return true;
    if (s.role !== 'teacher') return false;
    const cls = Classes.get(classId);
    if (cls && cls.teacherId === s.id) return true;
    const tt = DB.get('timetable').find(x => x.teacherId === s.id || x.teacher === s.name);
    return !!(tt && cls && String(tt.grade) === cls.name);
  },
  canManageHomework(teacherId) {
    const s = Auth.session();
    if (!s) return false;
    if (this.isAdmin()) return true;
    return s.role === 'teacher' && s.id === teacherId;
  },
  canManageMaterials(teacherId) {
    const s = Auth.session();
    if (!s) return false;
    if (this.isAdmin()) return true;
    return s.role === 'teacher' && s.id === teacherId;
  },
  canAdmitStudents() { const s = Auth.session(); return !!s && (this.isAdmin() || s.role === 'secretary'); },
  canEditStudents() { const s = Auth.session(); return !!s && (this.isAdmin() || s.role === 'secretary'); },
  canManageStudentPhotos() { const s = Auth.session(); return !!s && (this.isAdmin() || s.role === 'secretary'); },
  canTransferStudents() { const s = Auth.session(); return !!s && (this.isAdmin() || s.role === 'secretary'); },
  canArchiveStudents() { const s = Auth.session(); return !!s && (this.isAdmin() || s.role === 'secretary'); },
  canDeleteStudents() { const s = Auth.session(); return !!s && (this.isAdmin() || s.role === 'secretary'); },
  canPrintAdmission() { const s = Auth.session(); return !!s && (this.isAdmin() || s.role === 'secretary'); },
  /* ---- new roles ---- */
  isChiefExaminer() { const s = Auth.session(); return s && s.role === 'chiefexaminer'; },
  isHeadteacher() { const s = Auth.session(); return s && s.role === 'headteacher'; },
  isStorekeeper() { const s = Auth.session(); return s && s.role === 'storekeeper'; },
  isKitchenManager() { const s = Auth.session(); return s && s.role === 'kitchenmanager'; },
  isUniformStaff() { const s = Auth.session(); return s && s.role === 'uniformstaff'; },
  /* ---- timetable: ONLY the secretary may create/edit official timetables ---- */
  canManageTimetable() { const s = Auth.session(); return !!s && s.role === 'secretary'; },
  /* ---- fees: ONLY the Secretary may create/edit/delete a fee amount,
         apply class fee structures, adjust a student's fees, or record,
         correct or reverse a payment. Everyone else is read-only. ---- */
  canManageFees() { const s = Auth.session(); return !!s && s.role === 'secretary'; },
  canRecordPayments() { const s = Auth.session(); return !!s && s.role === 'secretary'; },
  /* Messaging: the Secretary runs the school messaging centre; administrators
     may review it. Students/parents never send. */
  canSendMessages() { const s = Auth.session(); return !!s && (s.role === 'secretary' || this.isAdmin()); },
  canManageNotificationSettings() { const s = Auth.session(); return !!s && (s.role === 'secretary' || this.isAdmin()); },
  /* Provider credentials are system-wide security settings: administrators only. */
  canManageSmsProvider() { return this.isSuper(); },
  canViewFeeRecords() { const s = Auth.session(); return !!s && (this.isStaff() || this.isChiefExaminer()); },
  canViewStudentFee(studentId) {
    const s = Auth.session();
    if (!s) return false;
    if (this.isStaff() || this.isChiefExaminer()) return true;
    if (s.role === 'student') {
      if (s.id === studentId) return true;
      /* a student's login account may be keyed separately from the student
         record — match on the school email so they can still see their own */
      const st = (typeof Students !== 'undefined') ? Students.get(studentId) : null;
      return !!(st && s.email && String(st.email || '').toLowerCase() === String(s.email).toLowerCase());
    }
    if (s.role === 'parent') {
      const p = Parents.get(s.id);
      return !!(p && p.childrenIds && p.childrenIds.includes(studentId));
    }
    return false;
  },
  canViewTimetable() { const s = Auth.session(); return !!s && (this.isStaff() || s.role === 'chiefexaminer' || s.role === 'storekeeper' || s.role === 'kitchenmanager' || s.role === 'uniformstaff'); },
  /* ---- approval workflow: strict stage ownership (no bypassing) ---- */
  canSubmitDocuments() { const s = Auth.session(); return !!s && (s.role === 'teacher' || this.isAdmin() || s.role === 'secretary'); },
  canApproveStage(stage) {
    const s = Auth.session();
    if (!s) return false;
    if (stage === 'chiefexaminer') return s.role === 'chiefexaminer';
    if (stage === 'headteacher') return s.role === 'headteacher';
    if (stage === 'secretary' || stage === 'publish') return s.role === 'secretary';
    return false;
  },
  canMonitorApprovals() { return this.isSuper() || this.isChiefExaminer() || this.isHeadteacher(); },
  canPublishDocuments() { const s = Auth.session(); return !!s && s.role === 'secretary'; },
  /* ---- inventory: department-scoped, enforced at the data layer ---- */
  canManageInventory(dept) {
    const s = Auth.session();
    if (!s) return false;
    if (this.isSuper()) return true;
    if (dept === 'store') return s.role === 'storekeeper';
    if (dept === 'kitchen') return s.role === 'kitchenmanager';
    if (dept === 'junior_uniform' || dept === 'academy_uniform') {
      // uniform stock is managed by dedicated uniform staff or the Stores account
      if (s.role === 'storekeeper') return true;
      if (s.role !== 'uniformstaff') return false;
      return Array.isArray(s.uniformDepts) ? s.uniformDepts.includes(dept) : false;
    }
    return false;
  },
  canViewInventory(dept) { const s = Auth.session(); return !!s && (this.isSuper() || s.role === 'secretary' || this.canManageInventory(dept)); },
  canProcure() { const s = Auth.session(); return !!s && (s.role === 'storekeeper' || this.isSuper()); },
  canConfirmKitchenReceipt() { const s = Auth.session(); return !!s && s.role === 'kitchenmanager'; },
  canSendStoreTransfer() { const s = Auth.session(); return !!s && (s.role === 'storekeeper' || this.isSuper()); },
  canManageUsers() { return this.isSuper(); },
  canViewStudentRecords(studentId) {
    const s = Auth.session();
    if (!s) return false;
    if (this.isAdmin() || s.role === 'secretary') return true;
    if (s.role === 'student') return s.id === studentId;
    if (s.role === 'parent') {
      const p = Parents.get(s.id);
      return !!(p && p.childrenIds && p.childrenIds.includes(studentId));
    }
    if (s.role === 'teacher') return true; // teachers see enrolled students in their classes only (filtered at call site)
    return false;
  }
};

/* ============================================================
   APPROVAL GATE — the single choke point for student/parent visibility.
   Rule: EVERY item a teacher authors (exam papers, marks, results,
   notes, homework, announcements, messages, notices, schedules,
   attachments and images) reaches the Student Portal only after
   Teacher → Chief Examiner → Headteacher → Secretary → Published.
   Enforced in the data layer, so no page, URL or direct call can
   bypass it. Submissions lives in approvals.js (loaded later), so it
   is referenced lazily and the gate fails CLOSED when it is absent.
   ============================================================ */
const ApprovalGate = {
  /* collections whose contents are released to students / parents */
  GATED: ['materials', 'homework', 'announcements', 'exams', 'examSchedule'],

  /* ---- who authored this record (resolves legacy rows too) ---- */
  authorRole(rec) {
    if (!rec) return '';
    if (rec.createdByRole) return rec.createdByRole;
    if (rec.uploadedByRole) return rec.uploadedByRole;
    const users = DB.get('users');
    for (const id of [rec.uploadedById, rec.createdById, rec.teacherId, rec.ownerId]) {
      if (!id) continue;
      const u = users.find(x => x.id === id);
      if (u && u.role) return u.role;
    }
    for (const n of [rec.createdBy, rec.uploadedBy, rec.teacherName, rec.ownerName]) {
      if (!n) continue;
      const u = users.find(x => x.name === n);
      if (u && u.role) return u.role;
    }
    return '';
  },

  /* Teacher-authored content is always gated. Records whose author cannot be
     verified are quarantined too (fail closed, never fail open) until
     authorized staff review them. */
  requiresApproval(rec) {
    if (!rec) return true;
    const role = this.authorRole(rec);
    return !role || role === 'teacher';
  },

  /* THE GATE. True only when a teacher record has walked the whole chain and
     been published. Non-teacher content keeps its existing release semantics. */
  approvedForStudents(rec) {
    if (!rec) return false;
    if (!this.requiresApproval(rec)) return true;
    return rec.status === 'published' && rec.approvalStatus === 'published';
  },

  /* is the record still somewhere inside the approval chain? */
  inChain(rec) {
    return !!(rec && ['chiefexaminer', 'headteacher', 'secretary', 'approved_final', 'rejected'].includes(rec.approvalStatus));
  },

  /* short human label for the staff/teacher UI */
  statusText(rec) {
    if (!rec) return '';
    if (rec.approvalStatus === 'published') return 'Published to students';
    if (rec.approvalStatus === 'approved_staff') return 'Approved (staff only)';
    if (rec.approvalStatus === 'rejected') return 'Returned for correction';
    if (rec.approvalStatus === 'withdrawn') return 'Withdrawn from publication';
    if (rec.approvalStatus === 'chiefexaminer') return 'Awaiting Chief Examiner';
    if (rec.approvalStatus === 'headteacher') return 'Awaiting Headteacher';
    if (rec.approvalStatus === 'secretary') return 'Awaiting Secretary';
    return '';
  },
  statusBadge(rec) {
    if (!rec) return 'navy';
    if (rec.approvalStatus === 'published') return 'success';
    if (rec.approvalStatus === 'approved_staff') return 'navy';
    if (rec.approvalStatus === 'rejected') return 'danger';
    if (rec.approvalStatus === 'withdrawn') return 'danger';
    if (rec.approvalStatus === 'chiefexaminer') return 'warning';
    if (rec.approvalStatus === 'headteacher') return 'info';
    if (rec.approvalStatus === 'secretary') return 'gold';
    return 'navy';
  },

  /* fields a teacher save path stamps on a freshly created record */
  pendingFields(rec) {
    const s = Auth.session() || {};
    rec.createdByRole = s.role || '';
    rec.status = 'pending';
    rec.approvalStatus = 'chiefexaminer';
    rec.approvalSubmittedAt = new Date().toISOString();
    return rec;
  },

  /* does this stored record belong to that submission? */
  matches(sub, rec) {
    if (!sub || !rec) return false;
    if (rec.approvalId && sub.id && rec.approvalId === sub.id) return true;
    if (sub.linkedId && rec.id && rec.id === sub.linkedId) return true;
    if (sub.linkedKey && sub.linkedId && rec[sub.linkedKey] && rec[sub.linkedKey] === sub.linkedId) return true;
    return false;
  },

  /* ---------- readable preview of an exam for the reviewers ---------- */
  examSummary(ex) {
    const qs = (ex.questions || []).map((q, i) => {
      const text = (q.text || '').trim();
      const marks = Math.max(1, Number(q.marks || 1));
      const opts = (q.options || []).map((o, j) => '   ' + String.fromCharCode(65 + j) + '. ' + (o.text || o)).join('\n');
      const key = q.type === 'written' ? '' : '\n   Answer: ' + (q.correctOptionId || '?');
      return (i + 1) + '. [' + marks + ' mark' + (marks > 1 ? 's' : '') + '] ' + text + (opts ? '\n' + opts : '') + key;
    }).join('\n\n');
    return (ex.subject || '') + ' · ' + (ex.className || classNameForGrade(ex.grade)) +
      '\nDuration: ' + (ex.duration || '') + ' minutes · Total marks: ' + (ex.totalMarks || 0) +
      '\nDate: ' + (ex.date || '') + '\n\n' + (qs || 'No questions recorded.');
  },

  /* ---------- create the linked approval submission for a teacher record ----------
     The submission copies the file key (same IndexedDB blob) and the content, so
     reviewers preview exactly what students will receive. Nothing is duplicated. */
  submit(coll, rec, meta) {
    meta = meta || {};
    if (typeof Submissions === 'undefined') {
      return { ok: false, error: 'The approval workflow is unavailable, so this cannot be submitted for review.' };
    }
    if (rec && rec.approvalId) {
      const existing = Submissions.get(rec.approvalId);
      if (existing && existing.status !== 'withdrawn') return { ok: true, submission: existing, reused: true };
    }
    rec = rec || {};
    const payload = {
      title: meta.title || rec.title || 'Untitled document',
      docType: meta.docType || 'other',
      classId: meta.classId != null ? meta.classId : (rec.classId || (rec.classIds || [])[0] || ''),
      className: meta.className || rec.className || (rec.classNames || []).join(', ') || 'All classes',
      subject: meta.subject || rec.subject || 'General',
      content: meta.content != null ? meta.content : (rec.content || rec.instructions || ''),
      fileName: meta.fileName || rec.fileName || rec.attachmentName || '',
      fileKey: meta.fileKey || rec.fileKey || rec.attachmentKey || '',
      term: rec.term || '', academicYear: rec.academicYear || '',
      linkedCollection: coll,
      linkedId: meta.linkedId || rec.id || '',
      linkedKey: meta.linkedKey || ''
    };
    const r = Submissions.create(payload);
    if (r.ok && rec) { rec.approvalId = r.submission.id; rec.approvalTrackingNo = r.submission.trackingNo; }
    return r;
  },

  /* ---------- teacher save path ----------
     Stamps the pending fields, then either refreshes the submission that is
     still inside the chain, or opens a fresh version (edit of already published
     content re-enters review). Non-teachers are untouched. Returns { ok }. */
  routeSave(coll, rec, meta) {
    const s = Auth.session() || {};
    if (s.role !== 'teacher' || !rec) return { ok: true };
    meta = meta || {};
    const cur = (rec.approvalId && typeof Submissions !== 'undefined') ? Submissions.get(rec.approvalId) : null;
    if (cur && !['published', 'withdrawn', 'rejected'].includes(cur.status)) {
      if (meta.title != null) cur.title = meta.title;
      if (meta.content != null) cur.content = meta.content;
      if (meta.fileName != null) cur.fileName = meta.fileName;
      if (meta.fileKey != null) cur.fileKey = meta.fileKey;
      if (meta.className != null) cur.className = meta.className;
      if (meta.subject != null) cur.subject = meta.subject;
      cur.updatedAt = new Date().toISOString();
      Submissions._save(cur);
      rec.status = 'pending';
      rec.approvalStatus = cur.status;
      return { ok: true, reused: true, approvalTrackingNo: cur.trackingNo };
    }
    if (cur) { rec.approvalId = ''; rec.approvalTrackingNo = ''; }
    const r = this.submit(coll, rec, meta);
    if (!r.ok) return r;
    rec.status = 'pending';
    const now = (rec.approvalId && typeof Submissions !== 'undefined') ? Submissions.get(rec.approvalId) : null;
    rec.approvalStatus = now ? now.status : 'chiefexaminer';
    return { ok: true, approvalTrackingNo: rec.approvalTrackingNo };
  },

  /* ---------- propagate a submission's stage onto the linked record(s) ---------- */
  applyStage(sub) {
    if (!sub || !sub.linkedCollection) return null;
    const items = DB.get(sub.linkedCollection) || [];
    let hit = null;
    items.forEach(rec => {
      if (!this.matches(sub, rec)) return;
      rec.approvalId = sub.id;
      rec.approvalTrackingNo = sub.trackingNo;
      rec.approvalStatus = sub.status;
      hit = rec;
    });
    if (hit) DB.set(sub.linkedCollection, items);
    return hit;
  },

  /* Secretary published the submission → release the linked content. */
  applyPublished(sub) {
    if (!sub || !sub.linkedCollection) return [];
    const items = DB.get(sub.linkedCollection) || [];
    const toStudents = sub.publishTarget === 'student' || sub.publishTarget === 'both';
    const next = toStudents ? 'published' : 'approved_staff';
    const now = new Date().toISOString();
    const released = [];
    items.forEach(rec => {
      if (!this.matches(sub, rec)) return;
      rec.approvalId = sub.id;
      rec.approvalTrackingNo = sub.trackingNo;
      rec.approvalStatus = next;
      rec.approvedAt = now;
      rec.approvedBy = sub.publishedBy || '';
      if (toStudents && sub.linkedCollection !== 'examResults') rec.status = 'published';
      if (sub.linkedCollection === 'examResults') this._releaseResult(rec, sub, now);
      released.push(rec);
    });
    if (released.length) DB.set(sub.linkedCollection, items);
    if (toStudents) released.forEach(rec => this.announce(sub, rec));
    return released;
  },

  /* Withdraw publication → re-quarantine the linked content. */
  applyWithdrawn(sub) {
    if (!sub || !sub.linkedCollection) return null;
    const items = DB.get(sub.linkedCollection) || [];
    let hit = null;
    items.forEach(rec => {
      if (!this.matches(sub, rec)) return;
      rec.approvalStatus = 'withdrawn';
      if (this.requiresApproval(rec) && rec.status === 'published') rec.status = 'pending';
      hit = rec;
    });
    if (hit) DB.set(sub.linkedCollection, items);
    return hit;
  },

  _releaseResult(rec, sub, now) {
    if (rec.markingStatus === 'published') return;
    const prev = rec.markingStatus;
    rec.markingStatus = 'published';
    rec.publishedAt = now;
    rec.publishedBy = sub.publishedBy || '';
    rec.approvedBy = sub.publishedBy || '';
    (rec.markingHistory = rec.markingHistory || []).push({ at: now, by: sub.publishedBy || '', action: 'published', from: prev, to: 'published', note: 'Results released through the approval workflow (' + sub.trackingNo + ').' });
  },

  /* Fire the student/parent notifications that were suppressed at save time. */
  announce(sub, rec) {
    const coll = sub.linkedCollection;
    const title = rec.title || sub.title || '';
    if (coll === 'materials') {
      Notifications.notifyClass(rec.className, 'New Study Material', title + (rec.subject ? ' (' + rec.subject + ')' : '') + ' is now available.');
    } else if (coll === 'homework') {
      (rec.classNames || [rec.className]).forEach(cn => { if (cn) Notifications.notifyClass(cn, 'New Homework: ' + title, (rec.subject || '') + ' - due ' + (rec.deadline || 'soon') + '.'); });
    } else if (coll === 'announcements') {
      const msg = rec.content || '';
      if (rec.classId) {
        const cls = Classes.get(rec.classId);
        if (cls) Notifications.notifyClass(cls.name, 'Announcement: ' + title, msg);
      } else {
        DB.get('students').filter(x => x.status === 'active').forEach(st => Notifications.send(st.id, 'student', 'Announcement: ' + title, msg));
        DB.get('parents').forEach(p => Notifications.send(p.id, 'parent', 'Announcement: ' + title, msg));
      }
    } else if (coll === 'examSchedule') {
      Notifications.notifyClass(rec.className, 'Exam Scheduled: ' + title, (rec.subject || '') + ' on ' + (rec.date || '') + (rec.venue ? ' at ' + rec.venue : '') + '.');
    } else if (coll === 'examResults') {
      Notifications.send(rec.studentId, 'student', 'Results Published', 'Your results for ' + (rec.examTitle || title) + ' are now available.');
      const parent = DB.get('parents').find(p => (p.childrenIds || []).includes(rec.studentId));
      if (parent) Notifications.send(parent.id, 'parent', 'Results Published', (rec.studentName || 'Your child') + "'s results for " + (rec.examTitle || title) + ' are now available.');
    }
  },

  /* ---------- migration: quarantine + enrol pre-existing teacher content ----------
     Idempotent. Nothing is deleted — records simply stop being student-visible
     until authorized staff walk them through the chain. */
  migrate() {
    if (typeof Submissions === 'undefined') return;
    const plans = [
      { coll: 'materials', docType: 'notes', contentOf: r => r.description || '', classOf: r => r.className, subjectOf: r => r.subject, fileOf: r => [r.fileName || '', r.fileKey || ''] },
      { coll: 'homework', docType: 'homework', contentOf: r => r.instructions || '', classOf: r => (r.classNames || [r.className]).filter(Boolean).join(', '), subjectOf: r => r.subject, fileOf: r => [r.attachmentName || '', r.attachmentKey || ''] },
      { coll: 'announcements', docType: 'announcement', contentOf: r => r.content || '', classOf: r => r.className || 'All classes', subjectOf: r => 'Announcements', fileOf: () => ['', ''] },
      { coll: 'examSchedule', docType: 'exam_schedule', contentOf: r => (r.instructions || '') + (r.revisionMaterials ? '\nRevision materials: ' + r.revisionMaterials : ''), classOf: r => r.className, subjectOf: r => r.subject, fileOf: () => ['', ''] },
      { coll: 'exams', docType: 'exam_paper', contentOf: r => this.examSummary(r), classOf: r => r.className || classNameForGrade(r.grade), subjectOf: r => r.subject, fileOf: () => ['', ''] }
    ];
    plans.forEach(plan => {
      const items = DB.get(plan.coll) || [];
      let changed = false;
      items.forEach(rec => {
        if (rec.approvalId && Submissions.get(rec.approvalId)) return;
        if (!this.requiresApproval(rec)) return;
        const file = plan.fileOf(rec) || ['', ''];
        const r = this.submit(plan.coll, rec, {
          title: rec.title || 'Untitled document',
          docType: plan.docType,
          className: plan.classOf(rec) || 'All classes',
          subject: plan.subjectOf(rec) || 'General',
          content: plan.contentOf(rec) || (file[1] ? '(Attachment: ' + file[0] + ')' : ''),
          fileName: file[0], fileKey: file[1]
        });
        if (!r.ok) return;
        rec.approvalId = r.submission.id;
        rec.approvalTrackingNo = r.submission.trackingNo;
        rec.createdByRole = rec.createdByRole || this.authorRole(rec) || 'teacher';
        rec.status = 'pending';
        rec.approvalStatus = r.submission.status;
        rec.approvalSubmittedAt = r.submission.submittedAt;
        rec.approvalMigrated = true;
        changed = true;
      });
      if (changed) DB.set(plan.coll, items);
    });
  }
};

/* ---------- AUDIT LOG ---------- */
const Audit = {
  log(action, details) {
    const s = Auth.session();
    const logs = DB.get('auditLog');
    logs.push({ id: DB.uid(), userId: s ? s.id : '', userName: s ? s.name : 'system', role: s ? s.role : 'system', action, details: details || '', timestamp: new Date().toISOString() });
    if (logs.length > 500) logs.splice(0, logs.length - 500);
    DB.set('auditLog', logs);
  },
  list(limit) {
    if (!Perm.isSuper()) return [];
    const logs = DB.get('auditLog');
    return limit ? logs.slice(-limit).reverse() : logs.slice().reverse();
  }
};

/* ---------- ACADEMIC YEARS (Module 0) ----------
   Configurable list of academic years the school operates across.
   The admission form picks from this list instead of a hard-coded value;
   changing the default year NEVER rewrites an existing student record. */
const AcademicYears = {
  list() { return DB.get('academicYears'); },
  active() { return this.list().filter(y => y.status === 'active'); },
  get(id) { return this.list().find(y => y.id === id); },
  byLabel(label) {
    const l = String(label == null ? '' : label).trim();
    return this.list().find(y => String(y.label) === l) || null;
  },

  /* The school's configured current academic year (label string). */
  activeYear() {
    const st = DB.get('settings', {});
    if (st.academicYearId) {
      const rec = this.get(st.academicYearId);
      if (rec) return String(rec.label);
    }
    if (st.academicYear) return String(st.academicYear);
    return String(new Date().getFullYear());
  },
  activeRecord() {
    const st = DB.get('settings', {});
    return (st.academicYearId && this.get(st.academicYearId)) || this.byLabel(this.activeYear()) || null;
  },
  /* The term that belongs to the currently configured year. */
  activeTerm() {
    const rec = this.activeRecord();
    const st = DB.get('settings', {});
    const t = String(rec && rec.defaultTerm ? rec.defaultTerm : (st.term || '1'));
    return t;
  },

  /* Years a member of staff may choose on the admission form.
     Active years only, newest first. */
  forSelection() {
    return this.active().slice().sort((a, b) => String(b.label).localeCompare(String(a.label), undefined, { numeric: true }));
  },

  validate(data, editingId) {
    const label = String(data.label == null ? '' : data.label).trim();
    if (!label) return 'Academic year is required.';
    if (!/^\d{4}$/.test(label)) return 'Academic year must be a 4-digit year (for example 2026).';
    const items = DB.get('academicYears');
    const dup = items.find(y => String(y.label) === label && y.id !== editingId);
    if (dup) return 'Academic year ' + label + ' already exists. Edit it instead of creating a duplicate.';
    if (data.startDate && data.endDate && data.endDate < data.startDate) return 'The end date must be on or after the start date.';
    const terms = Array.isArray(data.terms) ? data.terms.map(Number) : [1, 2, 3];
    if (!terms.length) return 'At least one term is required.';
    return null;
  },

  /* Admin-only create / edit. `editingId` present = update. */
  save(data, editingId) {
    if (!Perm.canManageAcademicYears()) return { ok: false, error: 'Only the administrator can manage academic years.' };
    const err = this.validate(data, editingId);
    if (err) return { ok: false, error: err };
    const items = DB.get('academicYears');
    const label = String(data.label).trim();
    const terms = (Array.isArray(data.terms) ? data.terms : [1, 2, 3]).map(Number).filter(n => n >= 1).sort((a, b) => a - b);
    const rec = {
      label,
      startDate: data.startDate || (label + '-01-01'),
      endDate: data.endDate || (label + '-12-31'),
      terms,
      defaultTerm: Number(data.defaultTerm) || terms[0] || 1,
      status: data.status === 'inactive' ? 'inactive' : 'active',
      notes: String(data.notes || '').trim(),
      updatedAt: new Date().toISOString()
    };
    if (editingId) {
      const i = items.findIndex(y => y.id === editingId);
      if (i === -1) return { ok: false, error: 'Academic year not found.' };
      items[i] = { ...items[i], ...rec };
    } else {
      items.push({ id: DB.uid(), ...rec, createdAt: new Date().toISOString() });
    }
    DB.set('academicYears', items);
    Audit.log(editingId ? 'academicYear.update' : 'academicYear.create', label + ' (' + rec.status + ')');
    return { ok: true };
  },

  /* Point the school at a different current year. Existing student records
     keep the year stored on them — this only changes the default. */
  setActive(id) {
    if (!Perm.canManageAcademicYears()) return { ok: false, error: 'Only the administrator can change the current academic year.' };
    const items = DB.get('academicYears');
    const i = items.findIndex(y => y.id === id);
    if (i === -1) return { ok: false, error: 'Academic year not found.' };
    items[i].status = 'active';
    DB.set('academicYears', items);
    const st = DB.get('settings', {});
    st.academicYearId = items[i].id;
    st.academicYear = String(items[i].label);
    st.term = String(items[i].defaultTerm || '1');
    DB.set('settings', st);
    Audit.log('academicYear.activate', 'Current academic year set to ' + items[i].label);
    return { ok: true, label: String(items[i].label) };
  },

  setStatus(id, status) {
    if (!Perm.canManageAcademicYears()) return { ok: false, error: 'Only the administrator can change academic years.' };
    const items = DB.get('academicYears');
    const i = items.findIndex(y => y.id === id);
    if (i === -1) return { ok: false, error: 'Academic year not found.' };
    if (status !== 'active' && status !== 'inactive') return { ok: false, error: 'Invalid status.' };
    const st = DB.get('settings', {});
    if (status === 'inactive' && st.academicYearId === items[i].id) {
      return { ok: false, error: 'This is the current academic year. Activate another year first, then deactivate this one.' };
    }
    items[i].status = status;
    items[i].updatedAt = new Date().toISOString();
    DB.set('academicYears', items);
    Audit.log(status === 'active' ? 'academicYear.activate' : 'academicYear.deactivate', items[i].label);
    return { ok: true };
  },

  /* Archive rather than delete, so history that references the year stays valid. */
  remove(id) {
    if (!Perm.canManageAcademicYears()) return { ok: false, error: 'Permission denied.' };
    const items = DB.get('academicYears');
    const i = items.findIndex(y => y.id === id);
    if (i === -1) return { ok: false, error: 'Academic year not found.' };
    const st = DB.get('settings', {});
    if (st.academicYearId === items[i].id) return { ok: false, error: 'The current academic year cannot be archived. Set another year as current first.' };
    items[i].status = 'inactive';
    items[i].archived = true;
    DB.set('academicYears', items);
    Audit.log('academicYear.archive', items[i].label);
    return { ok: true };
  },

  /* "Server-side" validation used by every admission path. */
  validateForAdmission(label) {
    const l = String(label == null ? '' : label).trim();
    if (!l) return 'Academic year is required.';
    const rec = this.byLabel(l);
    if (!rec) return 'Academic year ' + l + ' is not configured. An administrator must add it under Academic Settings before it can be used.';
    if (rec.status !== 'active') return 'Academic year ' + l + ' is deactivated and cannot be used for new admissions.';
    return null;
  },

  termsFor(label) {
    const rec = this.byLabel(label);
    const terms = rec && Array.isArray(rec.terms) && rec.terms.length ? rec.terms : [1, 2, 3];
    return terms;
  }
};

/* ---------- CLASSES (Module 1) ---------- */
const Classes = {
  list() { return DB.get('classes').filter(c => c.status !== 'archived'); },
  get(id) { return DB.get('classes').find(c => c.id === id); },
  byName(name) { return this.list().find(c => c.name === name); },
  activeYear() { return (typeof AcademicYears !== 'undefined') ? AcademicYears.activeYear() : (DB.get('settings', {}).academicYear || String(new Date().getFullYear())); },
  validate(data, editingId) {
    const items = DB.get('classes');
    if (!data.name || !data.name.trim()) return 'Class name is required.';
    const allowed = (typeof OFFICIAL_CLASSES !== 'undefined') ? OFFICIAL_CLASSES : ACADEMIC_CLASSES;
    if (!allowed.includes(data.name) && !ACADEMIC_CLASSES.includes(data.name)) return 'Invalid class. Choose one of: ' + allowed.join(', ') + '.';
    const dup = items.find(c => c.name === data.name && String(c.academicYear) === String(data.academicYear) && c.id !== editingId && c.status !== 'archived');
    if (dup) return 'A "' + data.name + '" class already exists for ' + data.academicYear + '. Edit it instead of creating a duplicate.';
    return null;
  },
  save(data, editingId) {
    if (!Perm.canManageClasses()) return { ok: false, error: 'Only the administrator can manage classes.' };
    const err = this.validate(data, editingId);
    if (err) return { ok: false, error: err };
    const items = DB.get('classes');
    if (editingId) {
      const i = items.findIndex(c => c.id === editingId);
      if (i === -1) return { ok: false, error: 'Class not found.' };
      items[i] = { ...items[i], ...data, updatedAt: today() };
    } else {
      items.push({ id: DB.uid(), ...data, createdAt: today() });
    }
    DB.set('classes', items);
    Audit.log(editingId ? 'class.update' : 'class.create', data.name + ' (' + data.academicYear + ')');
    return { ok: true };
  },
  remove(id) {
    if (!Perm.canManageClasses()) return { ok: false, error: 'Permission denied.' };
    const items = DB.get('classes');
    const i = items.findIndex(c => c.id === id);
    if (i === -1) return { ok: false, error: 'Class not found.' };
    items[i].status = 'archived';
    DB.set('classes', items);
    Audit.log('class.archive', items[i].name);
    return { ok: true };
  },
  students(classId) {
    const cls = this.get(classId);
    if (!cls) return [];
    return DB.get('students').filter(s => s.className === cls.name && s.status === 'active');
  },
  enrolledCount(classId) { return this.students(classId).length; },
  hasTeacher(classId) { const c = this.get(classId); return !!(c && c.teacherId); },
  /* promote students to next class, preserving history */
  promote(classId) {
    if (!Perm.canManageClasses()) return { ok: false, error: 'Permission denied.' };
    const cls = this.get(classId);
    if (!cls) return { ok: false, error: 'Class not found.' };
    const official = (typeof OFFICIAL_CLASSES !== 'undefined') ? OFFICIAL_CLASSES : ACADEMIC_CLASSES;
    let nextName = null;
    const legacyIdx = ACADEMIC_CLASSES.indexOf(cls.name);
    if (legacyIdx !== -1) {
      if (legacyIdx >= ACADEMIC_CLASSES.length - 1) return { ok: false, error: cls.name + ' has no next class to promote into.' };
      nextName = ACADEMIC_CLASSES[legacyIdx + 1];
    } else {
      /* Stream classes: keep the stream, move up one grade (e.g. Grade 1:
         Mt. Kenya → Grade 2: Mt. Kenya). */
      const gm = /^Grade\s+(\d+)\s*:\s*(.+)$/i.exec(cls.name);
      if (gm) {
        const target = 'Grade ' + (Number(gm[1]) + 1) + ': ' + gm[2].trim();
        if (official.includes(target) || this.byName(target)) nextName = target;
      } else {
        const pm = /^(PG|PP1|PP2)\s+(.+)$/i.exec(cls.name);
        if (pm) {
          const prefix = pm[1].toUpperCase();
          if (prefix === 'PP2') {
            nextName = official.find(n => /^Grade 1:/i.test(n)) || null;
          } else {
            const target = (prefix === 'PG' ? 'PP1 ' : 'PP2 ') + pm[2].trim();
            if (official.includes(target) || this.byName(target)) nextName = target;
          }
        }
      }
      if (!nextName) return { ok: false, error: cls.name + ' has no next class to promote into.' };
    }
    const students = DB.get('students');
    let count = 0;
    students.forEach(s => {
      if (s.className === cls.name && s.status === 'active') {
        s.previousClass = cls.name;
        s.className = nextName;
        s.grade = nextName;
        count++;
      }
    });
    DB.set('students', students);
    Audit.log('class.promote', cls.name + ' → ' + nextName + ' (' + count + ' students)');
    return { ok: true, count, next: nextName };
  }
};

/* ---------- CLASS TEACHER ASSIGNMENT (Module 2) ---------- */
const ClassTeacher = {
  assign(classId, teacherId) {
    if (!Perm.canAssignTeachers()) return { ok: false, error: 'Only the administrator can assign class teachers.' };
    const cls = Classes.get(classId);
    if (!cls) return { ok: false, error: 'Class not found.' };
    const teachers = DB.get('teachers');
    const t = teachers.find(x => x.id === teacherId && x.status !== 'inactive');
    if (!t) return { ok: false, error: 'Teacher not found or inactive.' };
    const name = teacherDisplayName(t);
    const classes = DB.get('classes');
    const ci = classes.findIndex(c => c.id === classId);
    if (ci === -1) return { ok: false, error: 'Class not found.' };
    // record history before replacing
    if (classes[ci].teacherId) {
      const hist = DB.get('classAssignments');
      const old = hist.find(h => h.classId === classId && !h.replacedAt);
      if (old) old.replacedAt = today();
      DB.set('classAssignments', hist);
    }
    classes[ci].teacherId = t.id;
    classes[ci].teacherName = name;
    classes[ci].assignmentDate = today();
    DB.set('classes', classes);
    const hist = DB.get('classAssignments');
    hist.push({ id: DB.uid(), classId, className: cls.name, teacherId: t.id, teacherName: name, assignedAt: today(), assignedBy: (Auth.session() || {}).name || '', replacedAt: '' });
    DB.set('classAssignments', hist);
    Audit.log('class.teacher.assign', name + ' → ' + cls.name);
    // notify students in the class
    Notifications.notifyClass(cls.name, 'Class Teacher Assigned', 'Your new class teacher is ' + name + '.');
    return { ok: true };
  },
  unassign(classId) {
    if (!Perm.canAssignTeachers()) return { ok: false, error: 'Permission denied.' };
    const classes = DB.get('classes');
    const ci = classes.findIndex(c => c.id === classId);
    if (ci === -1) return { ok: false, error: 'Class not found.' };
    const hist = DB.get('classAssignments');
    const old = hist.find(h => h.classId === classId && !h.replacedAt);
    if (old) old.replacedAt = today();
    DB.set('classAssignments', hist);
    const clsName = classes[ci].name;
    classes[ci].teacherId = '';
    classes[ci].teacherName = '';
    DB.set('classes', classes);
    Audit.log('class.teacher.unassign', clsName);
    return { ok: true };
  },
  history(classId) {
    return DB.get('classAssignments').filter(h => h.classId === classId).reverse();
  },
  unassignedClasses() { return Classes.list().filter(c => !c.teacherId); }
};

/* ---------- NOTIFICATIONS (Module 14) ---------- */
const Notifications = {
  send(userId, role, title, message, type, meta) {
    const list = DB.get('notifications');
    // avoid duplicates: same user+title within 1 hour
    const cutoff = Date.now() - 3600000;
    const recent = list.find(n => n.userId === userId && n.title === title && new Date(n.createdAt).getTime() > cutoff);
    if (recent) return false;
    const rec = { id: DB.uid(), userId, role, title, message, type: type || 'info', read: false, createdAt: new Date().toISOString() };
    if (meta && typeof meta === 'object') rec.meta = { ...meta };
    list.push(rec);
    DB.set('notifications', list);
    return true;
  },
  notifyClass(className, title, message, type) {
    DB.get('students').filter(s => s.className === className && s.status === 'active').forEach(s => {
      this.send(s.id, 'student', title, message, type);
      // also notify linked parents
      const p = DB.get('parents').find(x => x.childrenIds && x.childrenIds.includes(s.id));
      if (p) this.send(p.id, 'parent', title + ' (' + className + ')', message, type);
    });
  },
  forUser(userId) {
    return DB.get('notifications').filter(n => n.userId === userId).reverse();
  },
  unreadCount(userId) { return this.forUser(userId).filter(n => !n.read).length; },
  markRead(id) {
    const list = DB.get('notifications');
    const n = list.find(x => x.id === id);
    if (n) { n.read = true; DB.set('notifications', list); }
  },
  markAllRead(userId) {
    const list = DB.get('notifications');
    list.forEach(n => { if (n.userId === userId) n.read = true; });
    DB.set('notifications', list);
  }
};

/* ---------- STUDENTS (admissions, transfers, archive, photos) ---------- */
const StudentStatuses = {
  ACTIVE: 'active', PENDING: 'pending', TRANSFERRED_OUT: 'transferred_out',
  GRADUATED: 'graduated', WITHDRAWN: 'withdrawn', ARCHIVED: 'archived'
};
/* A class is valid if it is one of the legacy broad classes or one of the
   official streams (which is what the admission/transfer dropdowns offer). */
function isKnownClassName(name) {
  const n = String(name == null ? '' : name).trim();
  if (!n) return false;
  if (ACADEMIC_CLASSES.includes(n)) return true;
  if (typeof OFFICIAL_CLASSES !== 'undefined' && OFFICIAL_CLASSES.includes(n)) return true;
  try { return Classes.list().some(c => c.name === n); } catch (e) { return false; }
}
const Students = {
  list() { return DB.get('students'); },
  get(id) { return this.list().find(s => s.id === id); },
  byAdmissionNo(no) {
    const val = String(no || '').trim().toUpperCase();
    return this.list().find(s => String(s.admissionNo || '').trim().toUpperCase() === val);
  },
  isActive(s) {
    return !!s && [StudentStatuses.ACTIVE, StudentStatuses.PENDING].includes(s.status || StudentStatuses.ACTIVE);
  },
  nextAdmissionNo(year) {
    const y = String(year || new Date().getFullYear());
    const nums = this.list()
      .map(s => String(s.admissionNo || ''))
      .filter(n => n.startsWith('STA-' + y + '-'))
      .map(n => parseInt(n.split('-')[2], 10) || 0);
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    return 'STA-' + y + '-' + String(next).padStart(3, '0');
  },
  admissionNoTaken(no, exceptId) {
    const val = String(no || '').trim().toUpperCase();
    if (!val) return false;
    return this.list().some(s => String(s.admissionNo || '').trim().toUpperCase() === val && s.id !== exceptId);
  },
  validateAdmission(data, editingId) {
    if (!data.firstName || !String(data.firstName).trim()) return 'Student full name (first name) is required.';
    if (!data.lastName || !String(data.lastName).trim()) return 'Student full name (last name) is required.';
    if (!data.className || !isKnownClassName(data.className)) return 'Please select a valid class admitted to.';
    if (!data.admissionNo || !String(data.admissionNo).trim()) return 'Admission number is required.';
    if (this.admissionNoTaken(data.admissionNo, editingId)) return 'Admission number ' + data.admissionNo + ' is already in use. Choose a unique number.';
    return null;
  },
  async admit(data) {
    if (!Perm.canAdmitStudents()) return { ok: false, error: 'Only the secretary or administrator can admit students.' };
    /* ---- only the Secretary may attach a fee amount to a new student ---- */
    if (Number(data.feeBalance || 0) !== 0 && !Perm.canManageFees()) {
      return { ok: false, error: 'Only the Secretary may set fee amounts. Leave the fee balance at zero and ask the Secretary to bill the student.' };
    }
    const err = this.validateAdmission(data);
    if (err) return { ok: false, error: err };
    /* "Server-side" validation of the chosen academic year.
       A caller that passes nothing gets the school's current year; a caller
       that passes an empty or unknown value is told so plainly. */
    const rawYear = data.academicYear;
    const yearLabel = String(rawYear === undefined || rawYear === null ? AcademicYears.activeYear() : rawYear).trim();
    const yearErr = AcademicYears.validateForAdmission(yearLabel);
    if (yearErr) return { ok: false, error: yearErr };
    const yearRec = AcademicYears.byLabel(yearLabel);
    const rawTerm = data.term;
    const termChosen = String(rawTerm === undefined || rawTerm === null ? AcademicYears.activeTerm() : rawTerm).trim() || '1';
    const allowedTerms = AcademicYears.termsFor(yearLabel).map(String);
    if (!allowedTerms.includes(termChosen)) {
      return { ok: false, error: 'Term ' + termChosen + ' is not configured for academic year ' + yearLabel + '. Allowed: ' + allowedTerms.map(t => 'Term ' + t).join(', ') + '.' };
    }

    const student = {
      id: DB.uid(),
      firstName: String(data.firstName).trim(),
      lastName: String(data.lastName).trim(),
      fullName: (String(data.firstName).trim() + ' ' + String(data.lastName).trim()),
      email: (data.email || '').trim(),
      grade: data.className,
      className: data.className,
      admissionNo: String(data.admissionNo).trim(),
      admissionDate: data.admissionDate || today(),
      academicYear: yearLabel,
      academicYearId: yearRec ? yearRec.id : '',
      term: termChosen,
      gender: data.gender || '',
      dob: data.dob || '',
      previousSchool: data.previousSchool || '',
      status: data.status === StudentStatuses.PENDING ? StudentStatuses.PENDING : StudentStatuses.ACTIVE,
      category: data.category === 'Boarder' ? 'Boarder' : 'Day Scholar',
      remarks: data.remarks || '',
      photo: '',
      photoKey: '',
      photoUpdatedAt: 0,
      parentName: data.parentName || '',
      parentRelationship: data.parentRelationship || '',
      parentPhone: data.parentPhone || '',
      parentAltPhone: data.parentAltPhone || '',
      parentEmail: data.parentEmail || '',
      guardian2Name: data.guardian2Name || '',
      guardian2Phone: data.guardian2Phone || '',
      address: data.address || '',
      emergencyContact: data.emergencyContact || '',
      medicalInfo: data.medicalInfo || '',
      feeBalance: Number(data.feeBalance || 0),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    /* Store the photograph BEFORE writing any record. If this fails nothing
       has been persisted, so the admission stops cleanly with the rest of
       the form data still on screen. */
    if (data.photo) {
      const pr = await PhotoStore.put(student.id, data.photo);
      if (!pr.ok) return { ok: false, error: pr.error, keepPhoto: true };
      student.photoKey = pr.key;
      student.photoUpdatedAt = Date.now();
    }

    /* Write the student record FIRST. Only once it is safely stored do we
       create the login account, so a failed save can never leave an
       orphaned account behind. */
    const students = this.list();
    students.push(student);
    try {
      DB.set('students', students);
    } catch (saveErr) {
      await PhotoStore.del(student.id);
      return { ok: false, error: 'Could not save the student record: ' + (saveErr.message || 'browser storage is full.') + ' No account was created.' };
    }

    const uname = this._uniqueUsername((student.firstName[0] + student.lastName + student.className).toLowerCase().replace(/[^a-z0-9]/g, ''));
    const acct = await Security.createAccount({
      id: student.id, username: uname, role: 'student',
      name: student.fullName, email: student.email, grade: student.className, className: student.className
    });
    if (!acct.ok) {
      /* roll the student record back so nothing is half-created */
      DB.set('students', DB.get('students').filter(x => x.id !== student.id));
      await PhotoStore.del(student.id);
      return { ok: false, error: acct.error };
    }
    this._recordHistory(student.id, 'admit', { className: student.className, admissionNo: student.admissionNo, academicYear: yearLabel, term: termChosen });
    /* register any opening balance in the fee ledger (no-op when it is zero) */
    if (typeof Fees !== 'undefined') Fees.announceOpening(student);
    Audit.log('student.admit', student.fullName + ' (' + student.admissionNo + ' → ' + student.className + ', ' + yearLabel + ' T' + termChosen + ')');
    Notifications.send(student.id, 'student', 'Welcome to St. Teresa Academy', 'Your admission is complete. Class: ' + student.className + '. Your portal username is "' + uname + '". Use the temporary password issued by the school office, then set your own password at first sign-in.');
    return { ok: true, student, username: uname, tempPassword: acct.tempPassword };
  },
  update(id, data) {
    if (!Perm.canEditStudents()) return { ok: false, error: 'Permission denied.' };
    const students = this.list();
    const i = students.findIndex(s => s.id === id);
    if (i === -1) return { ok: false, error: 'Student not found.' };
    if (data.admissionNo && this.admissionNoTaken(data.admissionNo, id)) return { ok: false, error: 'Admission number already in use.' };
    const before = { ...students[i] };
    /* class transfer through the edit form */
    if ('className' in data || 'grade' in data) {
      const newClass = String(data.className || data.grade || '').trim();
      if (!isKnownClassName(newClass)) return { ok: false, error: 'Please select a valid class.' };
      students[i].className = newClass;
      students[i].grade = newClass;
    }
    /* academic year / term may be corrected, but only against configured years */
    if ('academicYear' in data || 'term' in data) {
      const yl = String('academicYear' in data ? data.academicYear : students[i].academicYear || '').trim();
      const yErr = AcademicYears.validateForAdmission(yl);
      if (yErr) return { ok: false, error: yErr };
      const tl = String('term' in data ? data.term : students[i].term || '1').trim() || '1';
      const allowedTerms = AcademicYears.termsFor(yl).map(String);
      if (!allowedTerms.includes(tl)) return { ok: false, error: 'Term ' + tl + ' is not configured for academic year ' + yl + '.' };
      students[i].academicYear = yl;
      const yRec = AcademicYears.byLabel(yl);
      students[i].academicYearId = yRec ? yRec.id : '';
      students[i].term = tl;
    }
    const allowed = ['firstName', 'lastName', 'email', 'gender', 'dob', 'previousSchool', 'remarks', 'category', 'parentName', 'parentRelationship', 'parentPhone', 'parentAltPhone', 'parentEmail', 'guardian2Name', 'guardian2Phone', 'address', 'emergencyContact', 'medicalInfo'];
    allowed.forEach(k => { if (k in data) students[i][k] = data[k]; });
    /* ---- fee balance is NOT an ordinary editable field ----
       Only the Secretary may change it, and it must go through the
       fee ledger so charges, payments and balance stay consistent. */
    if ('feeBalance' in data) {
      const next = Fees.round2(Number(data.feeBalance || 0));
      const prev = Fees.round2(Number(students[i].feeBalance || 0));
      if (next !== prev && !Perm.canManageFees()) {
        return { ok: false, error: 'Only the Secretary may change a student’s fee balance.' };
      }
      if (next !== prev) {
        students[i].fullName = (students[i].firstName + ' ' + students[i].lastName).trim();
        students[i].updatedAt = new Date().toISOString();
        DB.set('students', students);
        const adj = Fees.adjust(id, {
          amount: Fees.round2(next - prev),
          item: 'Balance corrected from student record',
          reason: String(data.feeReason || 'Adjusted from the student record form.')
        });
        if (!adj.ok) return adj;
        return { ok: true, student: Students.get(id) };
      }
    }
    if (data.status && Object.values(StudentStatuses).includes(data.status)) students[i].status = data.status;
    students[i].fullName = (students[i].firstName + ' ' + students[i].lastName).trim();
    students[i].updatedAt = new Date().toISOString();
    DB.set('students', students);
    // keep the portal account name/email in sync
    const users = DB.get('users');
    const u = users.find(x => x.id === id);
    if (u) { u.name = students[i].fullName; u.email = students[i].email; DB.set('users', users); }
    Audit.log('student.update', students[i].fullName + ' (' + students[i].admissionNo + ')');
    return { ok: true, student: students[i] };
  },
  async replacePhoto(id, dataUrl) {
    if (!Perm.canManageStudentPhotos()) return { ok: false, error: 'Permission denied.' };
    if (!dataUrl || !/^data:image\//.test(dataUrl)) return { ok: false, error: 'Invalid photograph data.' };
    const students = this.list();
    const st = students.find(s => s.id === id);
    if (!st) return { ok: false, error: 'Student not found.' };
    /* store the bytes first — only update the record once it is safely held */
    const pr = await PhotoStore.put(id, dataUrl);
    if (!pr.ok) return { ok: false, error: pr.error };
    st.photoKey = pr.key;
    st.photo = '';
    st.photoUpdatedAt = Date.now();
    st.updatedAt = new Date().toISOString();
    try {
      DB.set('students', students);
    } catch (e) {
      return { ok: false, error: 'The photograph was stored but the student record could not be saved: ' + (e.message || 'browser storage is full.') };
    }
    Audit.log('student.photo.replace', st.fullName + ' (' + st.admissionNo + ')');
    return { ok: true, photoUpdatedAt: st.photoUpdatedAt };
  },
  async removePhoto(id) {
    if (!Perm.canManageStudentPhotos()) return { ok: false, error: 'Permission denied.' };
    const students = this.list();
    const st = students.find(s => s.id === id);
    if (!st) return { ok: false, error: 'Student not found.' };
    await PhotoStore.del(id);
    st.photo = '';
    st.photoKey = '';
    st.photoUpdatedAt = 0;
    DB.set('students', students);
    Audit.log('student.photo.remove', st.fullName + ' (' + st.admissionNo + ')');
    return { ok: true };
  },
  transferClass(id, opts) {
    if (!Perm.canTransferStudents()) return { ok: false, error: 'Permission denied.' };
    const students = this.list();
    const st = students.find(s => s.id === id);
    if (!st) return { ok: false, error: 'Student not found.' };
    if (!opts || !opts.toClass || !isKnownClassName(opts.toClass)) return { ok: false, error: 'Destination class is invalid.' };
    if (opts.toClass === st.className) return { ok: false, error: 'Student is already in ' + opts.toClass + '.' };
    if (!opts.effectiveDate) return { ok: false, error: 'Effective transfer date is required.' };
    const fromClass = st.className;
    st.previousClass = fromClass;
    st.className = opts.toClass;
    st.grade = opts.toClass;
    st.updatedAt = new Date().toISOString();
    DB.set('students', students);
    // keep the login account's class in sync (id preserved)
    const users = DB.get('users');
    const u = users.find(x => x.id === id);
    if (u) { u.grade = opts.toClass; u.className = opts.toClass; DB.set('users', users); }
    this._recordHistory(id, 'transfer_class', {
      fromClass, toClass: opts.toClass, effectiveDate: opts.effectiveDate,
      academicYear: opts.academicYear || DB.get('settings', {}).academicYear || '',
      term: opts.term || DB.get('settings', {}).term || '', reason: opts.reason || '', remarks: opts.remarks || ''
    });
    Audit.log('student.transfer_class', st.fullName + ': ' + fromClass + ' → ' + opts.toClass + ' (eff. ' + opts.effectiveDate + ')');
    Notifications.send(id, 'student', 'Class Transfer Confirmed', 'You have been transferred from ' + fromClass + ' to ' + opts.toClass + ' effective ' + opts.effectiveDate + '.');
    const p = DB.get('parents').find(x => x.childrenIds && x.childrenIds.includes(id));
    if (p) Notifications.send(p.id, 'parent', 'Class Transfer (' + st.fullName + ')', st.fullName + ' moved from ' + fromClass + ' to ' + opts.toClass + ' effective ' + opts.effectiveDate + '.');
    return { ok: true, fromClass, toClass: opts.toClass };
  },
  transferOut(id, opts) {
    if (!Perm.canTransferStudents()) return { ok: false, error: 'Permission denied.' };
    if (!opts || !opts.effectiveDate) return { ok: false, error: 'Effective leaving date is required.' };
    const students = this.list();
    const st = students.find(s => s.id === id);
    if (!st) return { ok: false, error: 'Student not found.' };
    const fromClass = st.className;
    st.status = StudentStatuses.TRANSFERRED_OUT;
    st.updatedAt = new Date().toISOString();
    DB.set('students', students);
    // remove the login from active use (keep the account record for history)
    const users = DB.get('users');
    const u = users.find(x => x.id === id);
    if (u) { u.status = 'transferred_out'; DB.set('users', users); }
    this._recordHistory(id, 'transfer_out', {
      fromClass, effectiveDate: opts.effectiveDate, destinationSchool: opts.destinationSchool || '',
      reason: opts.reason || '', remarks: opts.remarks || ''
    });
    Audit.log('student.transfer_out', st.fullName + ' (' + st.admissionNo + ') left ' + (opts.destinationSchool || 'school') + ' eff. ' + opts.effectiveDate);
    const p = DB.get('parents').find(x => x.childrenIds && x.childrenIds.includes(id));
    if (p) Notifications.send(p.id, 'parent', 'Transfer Out (' + st.fullName + ')', st.fullName + ' was transferred out effective ' + opts.effectiveDate + '.');
    return { ok: true };
  },
  archive(id, reason) {
    if (!Perm.canArchiveStudents()) return { ok: false, error: 'Permission denied.' };
    if (!reason || !String(reason).trim()) return { ok: false, error: 'A reason is required to archive a student.' };
    const students = this.list();
    const st = students.find(s => s.id === id);
    if (!st) return { ok: false, error: 'Student not found.' };
    st.status = StudentStatuses.ARCHIVED;
    st.updatedAt = new Date().toISOString();
    DB.set('students', students);
    this._recordHistory(id, 'archive', { reason: String(reason).trim() });
    Audit.log('student.archive', st.fullName + ' (' + st.admissionNo + '): ' + reason);
    return { ok: true };
  },
  withdraw(id, reason) {
    if (!Perm.canArchiveStudents()) return { ok: false, error: 'Permission denied.' };
    if (!reason || !String(reason).trim()) return { ok: false, error: 'A reason is required to withdraw a student.' };
    const students = this.list();
    const st = students.find(s => s.id === id);
    if (!st) return { ok: false, error: 'Student not found.' };
    st.status = StudentStatuses.WITHDRAWN;
    st.updatedAt = new Date().toISOString();
    DB.set('students', students);
    this._recordHistory(id, 'withdraw', { reason: String(reason).trim() });
    Audit.log('student.withdraw', st.fullName + ' (' + st.admissionNo + '): ' + reason);
    return { ok: true };
  },
  /* safe delete: secretary or admin, checks related records, never silently wipes history */
  delete(id, reason, typedName) {
    if (!Perm.canDeleteStudents()) return { ok: false, error: 'You do not have permission to permanently delete students.' };
    const st = this.get(id);
    if (!st) return { ok: false, error: 'Student not found.' };
    if (!reason || !String(reason).trim()) return { ok: false, error: 'A reason is required before deleting a student.' };
    if (String(typedName || '').trim() !== String(st.firstName + ' ' + st.lastName).trim()) return { ok: false, error: 'Type the student\'s full name exactly to confirm deletion.' };
    const related = {
      attendance: DB.get('attendance').filter(a => a.studentId === id).length,
      examResults: DB.get('examResults').filter(r => r.studentId === id).length,
      payments: DB.get('payments').filter(p => p.studentId === id).length,
      homeworkSubmissions: DB.get('homeworkSubmissions').filter(h => h.studentId === id).length
    };
    // remove the login account
    DB.set('users', DB.get('users').filter(u => u.id !== id));
    // remove the student record itself
    DB.set('students', this.list().filter(s => s.id !== id));
    // keep attendance/results/payments history (do NOT delete) — log the removal instead
    Audit.log('student.delete', st.fullName + ' (' + st.admissionNo + ') deleted. Reason: ' + reason + '. Preserved history — attendance:' + related.attendance + ' results:' + related.examResults + ' payments:' + related.payments + ' submissions:' + related.homeworkSubmissions + '.');
    return { ok: true, related };
  },
  history(studentId) {
    return DB.get('studentTransfers').filter(h => h.studentId === studentId).reverse();
  },
  _recordHistory(studentId, action, detail) {
    const s = Auth.session();
    const list = DB.get('studentTransfers');
    list.push({
      id: DB.uid(), studentId, action,
      byId: s ? s.id : '', byName: s ? s.name : 'system', role: s ? s.role : 'system',
      at: new Date().toISOString(),
      ...detail
    });
    DB.set('studentTransfers', list);
  },
  _uniqueUsername(base) {
    const users = DB.get('users');
    let uname = base || 'user';
    let i = 1;
    while (users.some(u => u.username === uname)) { uname = base + i; i++; }
    return uname;
  },
  /* photo URL resolved from the IndexedDB-backed store.
     Data URLs still held inline on legacy records are returned untouched. */
  photoUrl(st) {
    if (!st) return '';
    return (typeof PhotoStore !== 'undefined') ? PhotoStore.url(st) : (st.photo || '');
  },
  /* dashboard/report stats used by the secretary portal */
  stats() {
    const students = this.list();
    const transfers = DB.get('studentTransfers');
    const byClass = {};
    students.filter(s => s.status === StudentStatuses.ACTIVE).forEach(s => { byClass[s.className || 'Unassigned'] = (byClass[s.className || s.grade || 'Unassigned'] || 0) + 1; });
    const month = today().slice(0, 7);
    return {
      total: students.length,
      active: students.filter(s => s.status === StudentStatuses.ACTIVE).length,
      pending: students.filter(s => s.status === StudentStatuses.PENDING).length,
      newlyAdmitted: students.filter(s => String(s.admissionDate || '').slice(0, 7) === month).length,
      transferredInClass: transfers.filter(h => h.action === 'transfer_class').length,
      transferredOut: students.filter(s => s.status === StudentStatuses.TRANSFERRED_OUT).length + transfers.filter(h => h.action === 'transfer_out').length,
      withdrawnArchived: students.filter(s => [StudentStatuses.WITHDRAWN, StudentStatuses.ARCHIVED].includes(s.status)).length,
      byClass
    };
  }
};

/* ---------- HOMEWORK (Module 5) ---------- */
const Homework = {
  list() { return DB.get('homework'); },
  get(id) { return this.list().find(h => h.id === id); },
  statusOf(h) {
    if (h.status === 'draft') return 'draft';
    if (h.status === 'closed') return 'closed';
    const now = new Date();
    const assigned = h.dateAssigned ? new Date(h.dateAssigned) : now;
    const deadline = h.deadline ? new Date(h.deadline + 'T23:59:59') : null;
    if (deadline && now > deadline) return 'overdue';
    if (assigned > now) return 'upcoming';
    return 'active';
  },
  validate(data, editingId) {
    if (!data.title || !data.title.trim()) return 'Homework title is required.';
    if (!data.classIds || !data.classIds.length) return 'Please select at least one class.';
    if (!data.subject) return 'Please select a subject.';
    if (!data.dateAssigned) return 'Date assigned is required.';
    if (data.deadline && data.dateAssigned && data.deadline < data.dateAssigned) return 'Deadline cannot be before the assigned date.';
    return null;
  },
  save(data, editingId) {
    const s = Auth.session();
    if (!s) return { ok: false, error: 'Not signed in.' };
    if (!Perm.isAdmin() && s.role !== 'teacher') return { ok: false, error: 'Only teachers and administrators can set homework.' };
    const err = this.validate(data, editingId);
    if (err) return { ok: false, error: err };
    // resolve + authorise every selected class (multi-class support)
    const classIds = (data.classIds || []).filter(Boolean);
    const resolved = [];
    for (const cid of classIds) {
      const cls = Classes.get(cid);
      if (!cls) return { ok: false, error: 'Class not found.' };
      if (s.role === 'teacher') {
        const isClassTeacher = cls.teacherId === s.id;
        const teachesSubject = (cls.subjects || []).includes(data.subject);
        if (!isClassTeacher && !teachesSubject) return { ok: false, error: 'You are not authorized to set homework for ' + cls.name + ' ' + data.subject + '.' };
      }
      resolved.push(cls);
    }
    const st = DB.get('settings', {});
    const items = DB.get('homework');
    /* APPROVAL GATE: teacher-authored homework is quarantined and queued.
       Students never see it until the Secretary publishes it. */
    const gated = s.role === 'teacher';
    const prevRec = editingId ? items.find(h => h.id === editingId) : null;
    const record = {
      classIds: resolved.map(c => c.id),
      classNames: resolved.map(c => c.name),
      classId: resolved[0].id, className: resolved[0].name,
      subject: data.subject,
      title: data.title.trim(), instructions: (data.instructions || '').trim(),
      dateAssigned: data.dateAssigned, deadline: data.deadline || '',
      academicYear: data.academicYear || st.academicYear || String(new Date().getFullYear()),
      term: data.term || st.term || '',
      submissionMethod: data.submissionMethod || 'in-class',
      createdByRole: s.role,
      status: gated ? 'pending' : (data.status === 'draft' ? 'draft' : 'published'),
      approvalStatus: gated ? 'chiefexaminer' : (data.status === 'draft' ? 'draft' : 'published'),
      attachmentName: data.attachmentName || '', attachmentKey: data.attachmentKey || '',
      teacherId: s.role === 'teacher' ? s.id : (data.teacherId || s.id),
      teacherName: s.role === 'teacher' ? s.name : (data.teacherName || s.name),
      createdAt: new Date().toISOString()
    };
    if (editingId) {
      const i = items.findIndex(h => h.id === editingId);
      if (i === -1) return { ok: false, error: 'Homework not found.' };
      if (items[i].teacherId !== s.id && !Perm.isAdmin()) return { ok: false, error: 'You can only edit your own homework.' };
      // an edit to already-published content re-enters the chain from the start
      if (gated && prevRec && prevRec.approvalStatus === 'published') {
        record.approvalId = '';
        record.approvalTrackingNo = '';
        record.approvalStatus = 'chiefexaminer';
      } else if (gated && prevRec) {
        record.approvalId = prevRec.approvalId || '';
        record.approvalTrackingNo = prevRec.approvalTrackingNo || '';
        record.approvalStatus = prevRec.approvalStatus || 'chiefexaminer';
      }
      items[i] = { ...items[i], ...record, updatedAt: new Date().toISOString() };
    } else {
      record.id = DB.uid();
      items.push(record);
    }
    DB.set('homework', items);
    if (gated) {
      const saved = items.find(h => h.id === (editingId || record.id));
      const r = ApprovalGate.routeSave('homework', saved, {
        docType: 'homework',
        title: saved.title,
        content: saved.instructions || ('Homework set for ' + saved.subject + '. Deadline: ' + (saved.deadline || 'TBC') + '.'),
        fileName: saved.attachmentName || '', fileKey: saved.attachmentKey || '',
        className: (saved.classNames || []).join(', '), subject: saved.subject
      });
      if (!r.ok) {
        if (!editingId) DB.set('homework', items.filter(x => x.id !== record.id));
        return { ok: false, error: r.error || 'Could not submit this homework for approval.' };
      }
      DB.set('homework', items);
      Audit.log(editingId ? 'homework.update' : 'homework.create', saved.title + ' (' + saved.classNames.join(', ') + ') - submitted for approval ' + r.approvalTrackingNo);
      return { ok: true, submittedForApproval: true, approvalTrackingNo: r.approvalTrackingNo };
    }
    if (record.status === 'published') {
      resolved.forEach(cls => Notifications.notifyClass(cls.name, 'New Homework: ' + record.title, record.subject + ' — due ' + (record.deadline || 'soon') + '.'));
    }
    Audit.log(editingId ? 'homework.update' : 'homework.create', record.title + ' (' + record.classNames.join(', ') + ')');
    return { ok: true };
  },
  publish(id) {
    const s = Auth.session();
    const items = DB.get('homework');
    const h = items.find(x => x.id === id);
    if (!h) return { ok: false, error: 'Not found.' };
    if (!Perm.canManageHomework(h.teacherId)) return { ok: false, error: 'Permission denied.' };
    /* APPROVAL GATE: a teacher may never press Publish themselves. */
    if (ApprovalGate.requiresApproval(h)) {
      return { ok: false, error: 'Teacher content cannot be published directly. It is released only after Chief Examiner, Headteacher and Secretary approval. Current status: ' + (ApprovalGate.statusText(h) || 'not submitted for approval') + '.' };
    }
    h.status = 'published';
    h.updatedAt = new Date().toISOString();
    DB.set('homework', items);
    const names = h.classNames || [h.className];
    names.forEach(cn => Notifications.notifyClass(cn, 'New Homework: ' + h.title, h.subject + ' — due ' + (h.deadline || 'soon') + '.'));
    Audit.log('homework.publish', h.title + ' (' + names.join(', ') + ')');
    return { ok: true };
  },
  unpublish(id) {
    const items = DB.get('homework');
    const h = items.find(x => x.id === id);
    if (!h) return { ok: false, error: 'Not found.' };
    if (!Perm.canManageHomework(h.teacherId)) return { ok: false, error: 'Permission denied.' };
    h.status = 'draft';
    h.updatedAt = new Date().toISOString();
    DB.set('homework', items);
    return { ok: true };
  },
  remove(id) {
    const items = DB.get('homework');
    const h = items.find(x => x.id === id);
    if (!h) return { ok: false, error: 'Not found.' };
    if (!Perm.canManageHomework(h.teacherId)) return { ok: false, error: 'Permission denied.' };
    if (h.attachmentKey) { try { ImageStore.del(h.attachmentKey); } catch (e) {} }
    DB.set('homework', items.filter(x => x.id !== id));
    Audit.log('homework.delete', h.title);
    return { ok: true };
  },
  /* STUDENT: only published homework for their current class (multi-class aware) */
  forStudent(student) {
    if (!student || !student.className) return [];
    if (!Students.isActive(student)) return [];
    const sk = typeof gradeKey === 'function' ? gradeKey(student.className) : String(student.className || '').toLowerCase();
    return this.list().filter(h => {
      if (h.status !== 'published') return false;
      if (!ApprovalGate.approvedForStudents(h)) return false;
      const names = h.classNames || [h.className];
      return names.some(n => (typeof gradeKey === 'function' ? gradeKey(n) : String(n || '').toLowerCase()) === sk);
    }).reverse();
  },
  forClass(classId) {
    return this.list().filter(h => h.classId === classId).reverse();
  },
  forTeacher(teacherId) {
    return this.list().filter(h => h.teacherId === teacherId).reverse();
  },
  submit(homeworkId, studentId, content, fileName, fileKey) {
    const s = Auth.session();
    if (!s || s.role !== 'student' || s.id !== studentId) return { ok: false, error: 'Permission denied.' };
    const h = this.get(homeworkId);
    if (!h || h.status !== 'published') return { ok: false, error: 'Homework not available.' };
    if (!ApprovalGate.approvedForStudents(h)) return { ok: false, error: 'Homework not available.' };
    if (h.submissionMethod !== 'online') return { ok: false, error: 'This homework is not accepting online submissions.' };
    const subs = DB.get('homeworkSubmissions');
    const existing = subs.find(x => x.homeworkId === homeworkId && x.studentId === studentId);
    if (existing) {
      existing.previousAttempts = (existing.previousAttempts || 0) + 1;
      existing.content = content || '';
      existing.fileName = fileName || '';
      existing.fileKey = fileKey || existing.fileKey || '';
      existing.submittedAt = new Date().toISOString();
      existing.status = 'submitted';
      DB.set('homeworkSubmissions', subs);
      return { ok: true, resubmitted: true };
    }
    subs.push({
      id: DB.uid(), homeworkId, studentId, studentName: s.name,
      className: h.className, subject: h.subject,
      content: content || '', fileName: fileName || '', fileKey: fileKey || '',
      submittedAt: new Date().toISOString(), status: 'submitted', feedback: '', grade: ''
    });
    DB.set('homeworkSubmissions', subs);
    return { ok: true };
  },
  submission(homeworkId, studentId) {
    return DB.get('homeworkSubmissions').find(x => x.homeworkId === homeworkId && x.studentId === studentId);
  },
  submissionsFor(homeworkId) {
    const s = Auth.session();
    const h = this.get(homeworkId);
    if (!h) return [];
    if (!Perm.isAdmin() && !(s && s.role === 'teacher' && s.id === h.teacherId)) return [];
    return DB.get('homeworkSubmissions').filter(x => x.homeworkId === homeworkId);
  },
  gradeSubmission(submissionId, grade, feedback) {
    const s = Auth.session();
    const subs = DB.get('homeworkSubmissions');
    const sub = subs.find(x => x.id === submissionId);
    if (!sub) return { ok: false, error: 'Not found.' };
    const h = this.get(sub.homeworkId);
    if (!Perm.canManageHomework(h ? h.teacherId : '')) return { ok: false, error: 'Permission denied.' };
    sub.grade = grade;
    sub.feedback = feedback || '';
    sub.status = 'graded';
    DB.set('homeworkSubmissions', subs);
    Notifications.send(sub.studentId, 'student', 'Homework Graded', h ? h.title + ': ' + grade : 'Your submission was graded.');
    return { ok: true };
  }
};

/* ---------- ATTENDANCE (Module 10) ---------- */
const Attendance = {
  list() { return DB.get('attendance'); },
  /* guard: students/parents never get the full register */
  forClassDate(classId, date) {
    const s = Auth.session();
    if (!s) return [];
    if (s.role === 'student' || s.role === 'parent') return [];
    if (!Perm.canMarkAttendance('', classId) && !Perm.isAdmin()) {
      // teachers who are not the class teacher still shouldn't see full register unless authorized
      const cls = Classes.get(classId);
      if (!(s.role === 'teacher' && cls && cls.teacherId === s.id)) return [];
    }
    return this.list().filter(a => a.classId === classId && a.date === date);
  },
  forStudent(studentId) {
    // students and their parents only see their own records
    const s = Auth.session();
    if (!s) return [];
    if (s.role === 'student' && s.id !== studentId) return [];
    if (s.role === 'parent') {
      const p = Parents.get(s.id);
      if (!p || !p.childrenIds.includes(studentId)) return [];
    } else if (s.role !== 'student' && !Perm.isAdmin() && s.role !== 'secretary' && s.role !== 'teacher') {
      return [];
    }
    return this.list().filter(a => a.studentId === studentId).reverse();
  },
  saveRegister(classId, date, records, markedBy) {
    const s = Auth.session();
    if (!s) return { ok: false, error: 'Not signed in.' };
    if (!Perm.canMarkAttendance(s.id, classId)) return { ok: false, error: 'You are not authorized to mark attendance for this class.' };
    if (!date) return { ok: false, error: 'Date is required.' };
    if (!records || !records.length) return { ok: false, error: 'No students to mark.' };
    const cls = Classes.get(classId);
    if (!cls) return { ok: false, error: 'Class not found.' };
    const items = DB.get('attendance');
    let saved = 0, corrected = 0;
    const validStatuses = ['present', 'absent', 'late', 'excused'];
    records.forEach(r => {
      if (!r.studentId || !validStatuses.includes(r.status)) return;
      const existing = items.find(a => a.studentId === r.studentId && a.date === date);
      if (existing) {
        if (existing.status !== r.status || existing.remarks !== (r.remarks || '')) {
          existing.auditTrail = existing.auditTrail || [];
          existing.auditTrail.push({ by: s.name, at: new Date().toISOString(), from: existing.status, to: r.status, reason: r.reason || 'Correction' });
          corrected++;
        }
        existing.status = r.status;
        existing.arrivalTime = r.arrivalTime || '';
        existing.remarks = r.remarks || '';
        existing.markedBy = s.name;
        existing.markedAt = new Date().toISOString();
      } else {
        items.push({
          id: DB.uid(), classId, className: cls.name, date,
          studentId: r.studentId, studentName: r.studentName || '', admissionNo: r.admissionNo || '',
          status: r.status, arrivalTime: r.arrivalTime || '', remarks: r.remarks || '',
          markedBy: s.name, markedAt: new Date().toISOString(), auditTrail: []
        });
        saved++;
        // notify parent on absence/lateness
        if (r.status === 'absent' || r.status === 'late') {
          const stu = DB.get('students').find(x => x.id === r.studentId);
          if (stu) {
            const p = DB.get('parents').find(x => x.childrenIds && x.childrenIds.includes(stu.id));
            if (p) Notifications.send(p.id, 'parent', 'Attendance Alert: ' + stu.firstName, stu.firstName + ' was marked ' + r.status + ' on ' + date + '.', 'alert');
          }
        }
      }
    });
    DB.set('attendance', items);
    Audit.log('attendance.save', cls.name + ' ' + date + ' (' + saved + ' new, ' + corrected + ' corrected)');
    return { ok: true, saved, corrected };
  },
  /* reports */
  summaryForStudent(studentId, month) {
    let recs = this.list().filter(a => a.studentId === studentId);
    if (month) recs = recs.filter(a => a.date.slice(0, 7) === month);
    const total = recs.length;
    const present = recs.filter(a => a.status === 'present').length;
    const absent = recs.filter(a => a.status === 'absent').length;
    const late = recs.filter(a => a.status === 'late').length;
    const excused = recs.filter(a => a.status === 'excused').length;
    // school rule: attended = present + late; percentage = attended / (present+late+absent) — excused excluded from denominator
    const required = present + late + absent;
    const pct = required ? Math.round(((present + late) / required) * 100) : null;
    return { total, present, absent, late, excused, pct };
  },
  summaryForClass(classId, date) {
    const recs = this.list().filter(a => a.classId === classId && (!date || a.date === date));
    return {
      present: recs.filter(a => a.status === 'present').length,
      absent: recs.filter(a => a.status === 'absent').length,
      late: recs.filter(a => a.status === 'late').length,
      excused: recs.filter(a => a.status === 'excused').length,
      marked: recs.length
    };
  },
  unmarkedToday() {
    if (!Perm.isAdmin()) return [];
    const date = today();
    return Classes.list().filter(c => {
      const recs = this.list().filter(a => a.classId === c.id && a.date === date);
      return recs.length === 0 && Classes.enrolledCount(c.id) > 0;
    });
  }
};

/* ---------- LEARNING MATERIALS (Module 17) ---------- */
const Materials = {
  list() { return DB.get('materials'); },
  get(id) { return this.list().find(m => m.id === id); },
  save(data) {
    const s = Auth.session();
    if (!s) return { ok: false, error: 'Not signed in.' };
    if (!Perm.isAdmin() && s.role !== 'teacher') return { ok: false, error: 'Only teachers and administrators can upload materials.' };
    if (!data.title || !data.title.trim()) return { ok: false, error: 'Title is required.' };
    if (!data.classId) return { ok: false, error: 'Please select a class.' };
    if (!data.subject) return { ok: false, error: 'Please select a subject.' };
    if (!data.fileKey && !data.fileName) return { ok: false, error: 'Please upload a document.' };
    const cls = Classes.get(data.classId);
    if (!cls) return { ok: false, error: 'Class not found.' };
    if (s.role === 'teacher' && cls.teacherId !== s.id && !(cls.subjects || []).includes(data.subject)) {
      return { ok: false, error: 'You are not authorized to upload materials for ' + cls.name + '.' };
    }
    /* APPROVAL GATE: a teacher upload is quarantined and queued for review.
       Students never see it until the Secretary publishes it. */
    const gated = s.role === 'teacher';
    const items = DB.get('materials');
    const record = {
      id: DB.uid(), title: data.title.trim(), description: (data.description || '').trim(),
      classId: data.classId, className: cls.name, subject: data.subject,
      category: data.category || 'notes',
      fileName: data.fileName || '', fileType: data.fileType || '', fileSize: data.fileSize || 0, fileKey: data.fileKey || '',
      createdByRole: s.role,
      uploadedBy: s.name, uploadedById: s.id,
      uploadedAt: new Date().toISOString(),
      status: gated ? 'pending' : (data.status === 'draft' ? 'draft' : 'published'),
      approvalStatus: gated ? 'chiefexaminer' : (data.status === 'draft' ? 'draft' : 'published'),
      expiryDate: data.expiryDate || ''
    };
    items.push(record);
    DB.set('materials', items);
    if (gated) {
      const r = ApprovalGate.submit('materials', record, {
        docType: 'notes',
        content: record.description || ('Attachment: ' + record.fileName),
        fileName: record.fileName, fileKey: record.fileKey
      });
      if (!r.ok) {
        DB.set('materials', DB.get('materials').filter(x => x.id !== record.id));
        return { ok: false, error: r.error || 'Could not submit this material for approval.' };
      }
      DB.set('materials', DB.get('materials'));
      Audit.log('material.upload', data.title + ' → ' + cls.name + ' (submitted for approval ' + record.approvalTrackingNo + ')');
      return { ok: true, submittedForApproval: true, approvalTrackingNo: record.approvalTrackingNo };
    }
    if (data.status !== 'draft') Notifications.notifyClass(cls.name, 'New Study Material', data.title + ' (' + data.subject + ') is now available.');
    Audit.log('material.upload', data.title + ' → ' + cls.name);
    return { ok: true };
  },
  remove(id) {
    const s = Auth.session();
    const items = DB.get('materials');
    const m = items.find(x => x.id === id);
    if (!m) return { ok: false, error: 'Not found.' };
    if (!Perm.isAdmin() && !(s && s.role === 'teacher' && s.id === m.uploadedById)) return { ok: false, error: 'Permission denied.' };
    DB.set('materials', items.filter(x => x.id !== id));
    if (m.fileKey) { try { ImageStore.del(m.fileKey); } catch (e) {} }
    Audit.log('material.delete', m.title);
    return { ok: true };
  },
  /* STUDENT: only APPROVED, published, non-expired materials for their current class */
  forStudent(student) {
    if (!student || !student.className) return [];
    if (!Students.isActive(student)) return [];
    const now = new Date().toISOString().slice(0, 10);
    const sk = typeof gradeKey === 'function' ? gradeKey(student.className) : String(student.className || '').toLowerCase();
    return this.list().filter(m => m.status === 'published' && ApprovalGate.approvedForStudents(m) && (!m.expiryDate || m.expiryDate >= now) && (typeof gradeKey === 'function' ? gradeKey(m.className) : String(m.className || '').toLowerCase()) === sk).reverse();
  },
  forClass(classId) { return this.list().filter(m => m.classId === classId).reverse(); },
  forTeacher(teacherId) { return this.list().filter(m => m.uploadedById === teacherId).reverse(); },
  async fileData(m) {
    if (!m || !m.fileKey) return null;
    /* APPROVAL GATE: the raw attachment is content too — students and parents
       may not reach an unapproved teacher file, even by calling this directly. */
    const s = Auth.session();
    if (s && (s.role === 'student' || s.role === 'parent') && !ApprovalGate.approvedForStudents(m)) return null;
    return ImageStore.get(m.fileKey);
  },
  safeFileName(m) {
    const base = ((m.className || 'Class') + '_' + (m.subject || 'Subject') + '_' + (m.title || 'Document')).replace(/[^a-zA-Z0-9]+/g, '_').replace(/_+$/, '');
    const ext = m.fileName && m.fileName.includes('.') ? m.fileName.slice(m.fileName.lastIndexOf('.')) : '';
    return base + ext;
  }
};

/* ---------- ANNOUNCEMENTS (Module 14) ---------- */
const Announcements = {
  list() { return DB.get('announcements').filter(a => a.status !== 'archived').reverse(); },
  save(data) {
    const s = Auth.session();
    if (!s || !Perm.isStaff()) return { ok: false, error: 'Permission denied.' };
    if (!data.title || !data.title.trim()) return { ok: false, error: 'Title is required.' };
    const items = DB.get('announcements');
    /* APPROVAL GATE: teacher-authored announcements (and any message, notice or
       noticeboard item a teacher writes) are quarantined and queued. Nothing is
       broadcast to students or parents until the Secretary publishes it. */
    const gated = s.role === 'teacher';
    const record = {
      id: DB.uid(), title: data.title.trim(), content: (data.content || '').trim(),
      classId: data.classId || '', className: data.className || '',
      audience: data.classId ? 'class' : 'all',
      createdByRole: s.role,
      createdBy: s.name, createdAt: new Date().toISOString(),
      status: gated ? 'pending' : 'published',
      approvalStatus: gated ? 'chiefexaminer' : 'published'
    };
    items.push(record);
    DB.set('announcements', items);
    if (gated) {
      const r = ApprovalGate.routeSave('announcements', record, {
        docType: 'announcement',
        title: record.title,
        content: record.content || '(No message body.)',
        className: record.className || 'All classes',
        subject: 'Announcements'
      });
      if (!r.ok) {
        DB.set('announcements', DB.get('announcements').filter(x => x.id !== record.id));
        return { ok: false, error: r.error || 'Could not submit this announcement for approval.' };
      }
      DB.set('announcements', DB.get('announcements'));
      Audit.log('announcement.create', data.title + ' (submitted for approval ' + record.approvalTrackingNo + ')');
      return { ok: true, submittedForApproval: true, approvalTrackingNo: record.approvalTrackingNo };
    }
    if (data.classId) {
      const cls = Classes.get(data.classId);
      if (cls) Notifications.notifyClass(cls.name, 'Announcement: ' + data.title, data.content || '');
    } else {
      DB.get('students').filter(x => x.status === 'active').forEach(st => Notifications.send(st.id, 'student', 'Announcement: ' + data.title, data.content || ''));
      DB.get('parents').forEach(p => Notifications.send(p.id, 'parent', 'Announcement: ' + data.title, data.content || ''));
    }
    Audit.log('announcement.create', data.title);
    return { ok: true };
  },
  remove(id) {
    if (!Perm.isStaff()) return { ok: false, error: 'Permission denied.' };
    DB.set('announcements', DB.get('announcements').map(a => a.id === id ? { ...a, status: 'archived' } : a));
    return { ok: true };
  },
  forStudent(student) {
    if (!student) return [];
    /* APPROVAL GATE: only content that has completed the whole chain. */
    return this.list().filter(a => a.status !== 'pending' && ApprovalGate.approvedForStudents(a) && (a.audience === 'all' || a.className === student.className));
  }
};

/* ---------- PARENTS (Module 8) ---------- */
const Parents = {
  list() { return DB.get('parents'); },
  get(id) { return this.list().find(p => p.id === id); },
  byEmail(email) { return this.list().find(p => p.email === email); },
  children(parentId) {
    const p = this.get(parentId);
    if (!p) return [];
    const ids = p.childrenIds || [];
    return DB.get('students').filter(s => ids.includes(s.id));
  },
  async save(data, editingId) {
    if (!Perm.isSuper() && !(Perm.isStaff() && Auth.session().role === 'secretary')) return { ok: false, error: 'Permission denied.' };
    if (!data.name || !data.name.trim()) return { ok: false, error: 'Parent name is required.' };
    if (!data.email || !data.email.trim()) return { ok: false, error: 'Email is required.' };
    const items = DB.get('parents');
    const dup = items.find(p => p.email === data.email && p.id !== editingId);
    if (dup) return { ok: false, error: 'A parent with this email already exists.' };
    if (editingId) {
      const i = items.findIndex(p => p.id === editingId);
      if (i === -1) return { ok: false, error: 'Parent not found.' };
      items[i] = { ...items[i], ...data, updatedAt: today() };
      delete items[i].password;
      DB.set('parents', items);
    } else {
      const id = DB.uid();
      const uname = (data.name || 'parent').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
      const base = uname + (items.length ? String(items.length + 1) : '');
      const users = DB.get('users');
      let username = base, n = 1;
      while (users.some(u => u.username === username)) { username = base + n; n++; }
      const acct = await Security.createAccount({
        id, username, role: 'parent', name: data.name.trim(), email: data.email.trim(), phone: data.phone || ''
      });
      if (!acct.ok) return { ok: false, error: acct.error };
      /* the directory record never holds a password — only the user record does */
      items.push({
        id, name: data.name.trim(), email: data.email.trim(), phone: data.phone || '',
        username, childrenIds: data.childrenIds || [], status: data.status || 'active', createdAt: today()
      });
      DB.set('parents', items);
      return { ok: true, login: username, username, tempPassword: acct.tempPassword, account: acct.user };
    }
    Audit.log('parent.update', data.name);
    return { ok: true };
  },
  linkChild(parentId, studentId) {
    if (!Perm.isSuper()) return { ok: false, error: 'Permission denied.' };
    const items = DB.get('parents');
    const p = items.find(x => x.id === parentId);
    if (!p) return { ok: false, error: 'Parent not found.' };
    p.childrenIds = p.childrenIds || [];
    if (!p.childrenIds.includes(studentId)) p.childrenIds.push(studentId);
    DB.set('parents', items);
    return { ok: true };
  },
  unlinkChild(parentId, studentId) {
    if (!Perm.isSuper()) return { ok: false, error: 'Permission denied.' };
    const items = DB.get('parents');
    const p = items.find(x => x.id === parentId);
    if (!p) return { ok: false, error: 'Parent not found.' };
    p.childrenIds = (p.childrenIds || []).filter(id => id !== studentId);
    DB.set('parents', items);
    return { ok: true };
  },
  remove(id) {
    if (!Perm.isSuper()) return { ok: false, error: 'Permission denied.' };
    DB.set('parents', DB.get('parents').filter(p => p.id !== id));
    DB.set('users', DB.get('users').filter(u => !(u.role === 'parent' && u.id === id)));
    return { ok: true };
  }
};

/* ---------- EXAM SCHEDULE + RESULTS (Module 6) ---------- */
const ExamSchedule = {
  list() { return DB.get('examSchedule'); },
  get(id) { return this.list().find(e => e.id === id); },
  save(data, editingId) {
    const s = Auth.session();
    if (!s || (!Perm.isAdmin() && s.role !== 'teacher' && s.role !== 'secretary')) return { ok: false, error: 'Permission denied.' };
    if (!data.title || !data.title.trim()) return { ok: false, error: 'Exam name is required.' };
    if (!data.className) return { ok: false, error: 'Class is required.' };
    if (!data.subject) return { ok: false, error: 'Subject is required.' };
    if (!data.date) return { ok: false, error: 'Date is required.' };
    const items = DB.get('examSchedule');
    const st = DB.get('settings', {});
    /* APPROVAL GATE: a teacher-authored timetable entry is quarantined and queued. */
    const gated = s.role === 'teacher';
    const record = {
      title: data.title.trim(), className: data.className, subject: data.subject,
      date: data.date, startTime: data.startTime || '', endTime: data.endTime || '',
      venue: data.venue || '', instructions: data.instructions || '',
      revisionMaterials: data.revisionMaterials || '',
      academicYear: data.academicYear || st.academicYear || '', term: data.term || st.term || '',
      createdByRole: s.role,
      status: gated ? 'pending' : (data.status || 'scheduled'),
      approvalStatus: gated ? 'chiefexaminer' : (data.status === 'draft' ? 'draft' : 'published'),
      createdBy: s.name, createdAt: new Date().toISOString()
    };
    if (editingId) {
      const i = items.findIndex(e => e.id === editingId);
      if (i === -1) return { ok: false, error: 'Not found.' };
      const prevRec = items[i];
      if (gated) {
        if (prevRec.approvalStatus === 'published') {
          record.approvalId = ''; record.approvalTrackingNo = ''; record.approvalStatus = 'chiefexaminer';
        } else {
          record.approvalId = prevRec.approvalId || '';
          record.approvalTrackingNo = prevRec.approvalTrackingNo || '';
          record.approvalStatus = prevRec.approvalStatus || 'chiefexaminer';
        }
      }
      items[i] = { ...items[i], ...record, updatedAt: new Date().toISOString() };
    } else {
      record.id = DB.uid();
      items.push(record);
    }
    DB.set('examSchedule', items);
    if (gated) {
      const saved = items.find(e => e.id === (editingId || record.id));
      const r = ApprovalGate.routeSave('examSchedule', saved, {
        docType: 'exam_schedule',
        title: saved.title,
        content: (saved.subject || '') + ' — ' + (saved.className || '') + '\nDate: ' + saved.date + ' ' + (saved.startTime || '') + (saved.endTime ? '–' + saved.endTime : '') +
          (saved.venue ? '\nVenue: ' + saved.venue : '') + (saved.instructions ? '\n' + saved.instructions : '') +
          (saved.revisionMaterials ? '\nRevision materials: ' + saved.revisionMaterials : '')
      });
      if (!r.ok) {
        if (!editingId) DB.set('examSchedule', items.filter(x => x.id !== record.id));
        return { ok: false, error: r.error || 'Could not submit this schedule for approval.' };
      }
      DB.set('examSchedule', items);
      Audit.log(editingId ? 'examschedule.update' : 'examschedule.create', saved.title + ' (submitted for approval ' + r.approvalTrackingNo + ')');
      return { ok: true, submittedForApproval: true, approvalTrackingNo: r.approvalTrackingNo };
    }
    if (record.status !== 'draft') {
      Notifications.notifyClass(record.className, 'Exam Scheduled: ' + record.title, record.subject + ' on ' + record.date + (record.venue ? ' at ' + record.venue : '') + '.');
    }
    Audit.log(editingId ? 'examschedule.update' : 'examschedule.create', record.title);
    return { ok: true };
  },
  remove(id) {
    const s = Auth.session();
    if (!s || (!Perm.isAdmin() && s.role !== 'teacher' && s.role !== 'secretary')) return { ok: false, error: 'Permission denied.' };
    DB.set('examSchedule', DB.get('examSchedule').filter(e => e.id !== id));
    return { ok: true };
  },
  forStudent(student) {
    if (!student) return [];
    return this.list()
      .filter(e => e.className === student.className && e.status !== 'draft' && ApprovalGate.approvedForStudents(e))
      .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
  },
  upcoming(student) {
    const todayStr = today();
    return this.forStudent(student).filter(e => e.date >= todayStr);
  }
};

const Results = {
  /* examResults = auto-scored MCQ attempts (existing). reportCards = term summaries. */
  forStudent(studentId) {
    const s = Auth.session();
    if (!s) return [];
    if (s.role === 'student') return s.id === studentId ? DB.get('examResults').filter(r => r.studentId === studentId && this._visibleToStudent(r)).reverse() : [];
    if (s.role === 'parent') {
      const p = Parents.get(s.id);
      if (!p || !p.childrenIds.includes(studentId)) return [];
      return DB.get('examResults').filter(r => r.studentId === studentId && this._visibleToStudent(r)).reverse();
    } else if (!Perm.isAdmin() && s.role !== 'secretary' && s.role !== 'teacher') return [];
    return DB.get('examResults').filter(r => r.studentId === studentId).reverse();
  },
  /* APPROVAL GATE: a student/parent may only see results belonging to an exam
     that completed the whole approval chain, and only once marked published. */
  _visibleToStudent(r) {
    const ex = DB.get('exams').find(x => x.id === r.examId);
    if (!ex || !ApprovalGate.approvedForStudents(ex)) return false;
    return r.markingStatus === 'published' || r.markingStatus === 'auto_scored' || !!ex.resultsPublished;
  },
  publishExamResults(examId) {
    if (!Perm.isAdmin()) return { ok: false, error: 'Only the administrator can publish results.' };
    const exams = DB.get('exams');
    const ex = exams.find(x => x.id === examId);
    if (!ex) return { ok: false, error: 'Exam not found.' };
    ex.resultsPublished = true;
    ex.publishedAt = new Date().toISOString();
    DB.set('exams', exams);
    const now = new Date().toISOString();
    DB.get('examResults').filter(r => r.examId === examId).forEach(r => {
      Notifications.send(r.studentId, 'student', 'Results Published', 'Your results for ' + ex.title + ' are now available.');
      // keep submission records in sync with the exam-level publication
      if (r.markingStatus !== 'published') {
        r.markingStatus = 'published';
        r.publishedAt = now;
        r.publishedBy = (Auth.session() || {}).name || '';
        (r.markingHistory = r.markingHistory || []).push({ at: now, by: r.publishedBy, action: 'published', from: 'exam_publish', to: 'published', note: 'Results published for the whole exam.' });
      }
    });
    DB.set('examResults', DB.get('examResults'));
    Audit.log('results.publish', ex.title);
    return { ok: true };
  },
  /* students only see results after authorized publication */
  publishedForStudent(studentId) {
    const s = Auth.session();
    if (!s) return [];
    if (s.role === 'student' && s.id !== studentId) return [];
    if (s.role === 'parent') {
      const p = Parents.get(s.id);
      if (!p || !p.childrenIds.includes(studentId)) return [];
    } else if (s.role !== 'student' && !Perm.isAdmin() && s.role !== 'secretary' && s.role !== 'teacher') return [];
    const exams = DB.get('exams');
    return DB.get('examResults').filter(r => {
      if (r.studentId !== studentId) return false;
      const ex = exams.find(x => x.id === r.examId);
      /* APPROVAL GATE: results of an exam that never completed the chain — and
         results with no exam at all — stay restricted until staff review. */
      if (!ex || !ApprovalGate.approvedForStudents(ex)) return false;
      const published = r.markingStatus === 'published' || r.markingStatus === 'auto_scored' || !!ex.resultsPublished;
      return !!published;
    }).reverse();
  },
  gradeFor(percent) {
    if (percent >= 80) return 'A';
    if (percent >= 70) return 'B';
    if (percent >= 60) return 'C';
    if (percent >= 50) return 'D';
    return 'E';
  },
  saveReportCard(data) {
    if (!Perm.isAdmin()) return { ok: false, error: 'Only the administrator can approve report cards.' };
    if (!data.studentId || !data.term) return { ok: false, error: 'Student and term are required.' };
    const items = DB.get('reportCards');
    const existing = items.find(r => r.studentId === data.studentId && r.term === data.term && r.academicYear === data.academicYear);
    const record = {
      studentId: data.studentId, studentName: data.studentName || '',
      className: data.className || '', academicYear: data.academicYear || '', term: data.term,
      subjects: data.subjects || [], average: data.average || 0, grade: data.grade || '',
      classTeacherComment: data.classTeacherComment || '', headteacherComment: data.headteacherComment || '',
      status: 'published', publishedAt: new Date().toISOString(), approvedBy: (Auth.session() || {}).name || ''
    };
    if (existing) {
      Object.assign(existing, record);
    } else {
      record.id = DB.uid();
      items.push(record);
    }
    DB.set('reportCards', items);
    Notifications.send(data.studentId, 'student', 'Report Card Published', 'Your ' + data.term + ' report card is now available.');
    const p = DB.get('parents').find(x => x.childrenIds && x.childrenIds.includes(data.studentId));
    if (p) Notifications.send(p.id, 'parent', 'Report Card Published', (data.studentName || 'Your child') + "'s report card is now available.");
    Audit.log('reportcard.publish', data.studentName + ' ' + data.term);
    return { ok: true };
  },
  reportCardFor(studentId) {
    const s = Auth.session();
    if (!s) return null;
    if (s.role === 'student' && s.id !== studentId) return null;
    if (s.role === 'parent') {
      const p = Parents.get(s.id);
      if (!p || !p.childrenIds.includes(studentId)) return null;
    } else if (s.role !== 'student' && !Perm.isAdmin() && s.role !== 'secretary' && s.role !== 'teacher') return null;
    return DB.get('reportCards').filter(r => r.studentId === studentId && r.status === 'published').reverse();
  }
};

/* ---------- EXAM SUBMISSIONS & MARKING (Module 6b) ----------
   examResults doubles as the submission + marking + publication record.
   Workflow: submitted → pending (needs teacher marks) / awaiting_approval
   (fully auto-marked) → marking (draft saved) → awaiting_approval → published */
const ExamMarking = {
  STATUSES: ['pending', 'marking', 'awaiting_approval', 'pending_approval', 'published'],
  list() { return DB.get('examResults'); },
  get(id) { return this.list().find(r => r.id === id); },
  statusLabel(status) {
    return ({
      pending: 'Pending Teacher Marking',
      marking: 'Marking in Progress',
      awaiting_approval: 'Marks Awaiting Approval',
      pending_approval: 'Awaiting Publication Approval',
      published: 'Published',
      auto_scored: 'Published'
    })[status] || 'Pending Teacher Marking';
  },
  badgeFor(status) {
    return ({ pending: 'warning', marking: 'info', awaiting_approval: 'navy', pending_approval: 'gold', published: 'success', auto_scored: 'success' })[status] || 'warning';
  },
  examOf(sub) { return DB.get('exams').find(x => x.id === sub.examId) || {}; },
  isPublished(sub) { return !!sub && (sub.markingStatus === 'published' || sub.markingStatus === 'auto_scored'); },
  unmarkedCount(sub) { return (sub.questionResponses || []).filter(q => q.awardedMarks === null || q.awardedMarks === undefined).length; },
  /* ---------- permissions (enforced at the data layer) ---------- */
  canMark(sub) {
    const s = Auth.session();
    if (!s || !sub) return false;
    if (Perm.isAdmin()) return true;
    if (s.role !== 'teacher') return false;
    const ex = this.examOf(sub);
    return ex.teacherId === s.id || ex.teacherName === s.name;
  },
  canView(sub) {
    const s = Auth.session();
    if (!s || !sub) return false;
    if (s.role === 'student') return sub.studentId === s.id;
    if (s.role === 'parent') {
      const p = Parents.get(s.id);
      return !!(p && (p.childrenIds || []).includes(sub.studentId));
    }
    if (Perm.isAdmin() || s.role === 'secretary') return true;
    if (s.role === 'teacher') return this.canMark(sub);
    return false;
  },
  canPublish(sub) {
    const s = Auth.session();
    if (!s || !sub) return false;
    if (Perm.isAdmin()) return true;
    const ex = this.examOf(sub);
    return s.role === 'teacher' && (ex.teacherId === s.id || ex.teacherName === s.name);
  },
  /* ---------- scoped lists ---------- */
  forTeacher(teacherId) {
    const s = Auth.session();
    if (!s) return [];
    if (Perm.isAdmin()) return this.list().slice().reverse();
    if (s.role !== 'teacher') return [];
    if (teacherId && teacherId !== s.id) return [];
    return this.list().filter(sub => {
      const ex = this.examOf(sub);
      return ex.teacherId === s.id || ex.teacherName === s.name;
    }).reverse();
  },
  forStudent(studentId) {
    const s = Auth.session();
    if (!s) return [];
    if (s.role === 'student') return s.id === studentId ? this.list().filter(r => r.studentId === studentId).reverse() : [];
    if (s.role === 'parent') {
      const p = Parents.get(s.id);
      return (p && (p.childrenIds || []).includes(studentId)) ? this.list().filter(r => r.studentId === studentId).reverse() : [];
    }
    if (Perm.isAdmin() || s.role === 'secretary' || s.role === 'teacher') return this.list().filter(r => r.studentId === studentId).reverse();
    return [];
  },
  submissionFor(examId, studentId) {
    return this.list().find(r => r.examId === examId && r.studentId === studentId) || null;
  },
  /* ---------- automatic marking of a single question ---------- */
  evaluateQuestion(q, answer) {
    const maxMarks = Math.max(1, Number(q.marks || 1));
    const resp = {
      qid: q.id, type: q.type === 'written' ? 'written' : 'mcq', text: q.text,
      maxMarks, optionId: '', answerText: '',
      correctOptionId: q.type === 'written' ? '' : (q.correctOptionId || ''),
      options: (q.options || []).map(o => ({ id: o.id, text: o.text })),
      autoMarked: false, autoCorrect: null, needsTeacherReview: false,
      awardedMarks: null, comment: ''
    };
    if (answer && answer.optionId) resp.optionId = String(answer.optionId);
    if (answer && answer.text) resp.answerText = String(answer.text).trim();
    if (resp.type === 'written') { resp.needsTeacherReview = true; return resp; }
    const keyOk = !!(resp.correctOptionId && (resp.options.find(o => o.id === resp.correctOptionId) || {}).text);
    // missing/invalid answer key → flag for teacher review, never award a silent zero
    if (!keyOk) { resp.needsTeacherReview = true; return resp; }
    resp.autoMarked = true;
    resp.autoCorrect = !!resp.optionId && resp.optionId === resp.correctOptionId;
    resp.awardedMarks = resp.autoCorrect ? maxMarks : 0;
    return resp;
  },
  /* ---------- STUDENT: submit an exam (one attempt only) ---------- */
  submit(examId, answers) {
    const s = Auth.session();
    if (!s || s.role !== 'student') return { ok: false, error: 'Only signed-in students can submit exams.' };
    const exam = DB.get('exams').find(x => x.id === examId);
    if (!exam) return { ok: false, error: 'Exam not found.' };
    const student = studentForSession(s);
    if (!examMatchesStudent(exam, student)) return { ok: false, error: 'This exam is not published to your class.' };
    if (!ApprovalGate.approvedForStudents(exam)) return { ok: false, error: 'This exam has not been approved for publication yet.' };
    const existing = this.submissionFor(examId, s.id);
    if (existing) return { ok: false, error: 'You have already submitted this exam. Duplicate submissions are not allowed.' };
    const questions = (exam.questions || []).map((q, i) => normalizeExamQuestion(q, i));
    if (!questions.length) return { ok: false, error: 'This exam has no questions.' };
    const questionResponses = questions.map((q, i) => this.evaluateQuestion(q, answers ? answers[i] : null));
    const maxMarks = questionResponses.reduce((a, r) => a + r.maxMarks, 0);
    const autoMarks = questionResponses.reduce((a, r) => a + (r.awardedMarks == null ? 0 : r.awardedMarks), 0);
    const needsMarking = questionResponses.some(r => r.awardedMarks == null);
    const now = new Date().toISOString();
    const sub = {
      id: DB.uid(), examId: exam.id, examTitle: exam.title,
      subject: exam.subject || '', className: exam.className || student.className || '',
      grade: exam.grade || student.grade || '', teacherId: exam.teacherId || '', teacherName: exam.teacherName || '',
      studentId: s.id,
      studentName: (student.firstName && student.lastName) ? (student.firstName + ' ' + student.lastName) : s.name,
      admissionNo: student.admissionNo || '',
      answers: answers || {}, questionResponses,
      maxMarks, autoMarks, score: autoMarks, percent: maxMarks ? Math.round((autoMarks / maxMarks) * 100) : 0,
      markingStatus: needsMarking ? 'pending' : 'awaiting_approval',
      autoMarkedComplete: !needsMarking,
      teacherFeedback: '', submittedAt: now, date: today(),
      markedBy: '', markedAt: '', approvedBy: '', publishedAt: '', publishedBy: '',
      markingHistory: [{ at: now, by: s.name, action: 'submitted', from: '', to: needsMarking ? 'pending' : 'awaiting_approval', note: 'Student submitted the exam.' }]
    };
    const results = this.list();
    results.push(sub);
    DB.set('examResults', results);
    const exams = DB.get('exams');
    const ei = exams.findIndex(x => x.id === exam.id);
    if (ei > -1) { exams[ei].attempts = (exams[ei].attempts || 0) + 1; DB.set('exams', exams); }
    if (exam.teacherId) {
      Notifications.send(exam.teacherId, 'teacher', 'Exam Submission: ' + exam.title,
        sub.studentName + ' (' + (sub.className || 'class') + ') submitted — ' + (needsMarking ? 'pending marking.' : 'auto-marked, awaiting publication.'));
    }
    Audit.log('exam.submit', exam.title + ' — ' + sub.studentName + ' (' + (needsMarking ? 'pending marking' : 'auto-marked') + ')');
    return { ok: true, submission: sub };
  },
  /* ---------- TEACHER: award marks, comments and feedback ---------- */
  saveMarks(subId, payload) {
    const s = Auth.session();
    if (!s) return { ok: false, error: 'Not signed in.' };
    const items = this.list();
    const sub = items.find(x => x.id === subId);
    if (!sub) return { ok: false, error: 'Submission not found.' };
    if (!this.canMark(sub)) return { ok: false, error: 'You are not authorized to mark this submission.' };
    if (this.isPublished(sub)) return { ok: false, error: 'Published results can no longer be edited.' };
    const now = new Date().toISOString();
    const awards = payload.awards || {};
    const changes = [];
    (sub.questionResponses || []).forEach(r => {
      const a = awards[r.qid];
      if (!a) return;
      // an empty/absent award keeps the question unmarked — never silently award zero
      if (a.marks === null || a.marks === undefined || a.marks === '') return;
      const next = Math.max(0, Math.min(Number(r.maxMarks), Number(a.marks)));
      if (Number.isNaN(next)) return;
      if (r.awardedMarks !== next) changes.push(r.qid + ' ' + (r.awardedMarks == null ? 'unmarked' : r.awardedMarks) + ' → ' + next);
      r.awardedMarks = next;
      r.comment = String(a.comment || '').trim();
      r.markedBy = s.name;
      r.markedAt = now;
      r.needsTeacherReview = false;
    });
    sub.teacherFeedback = String(payload.feedback || '').trim();
    sub.score = (sub.questionResponses || []).reduce((acc, r) => acc + (Number(r.awardedMarks) || 0), 0);
    sub.percent = sub.maxMarks ? Math.round((sub.score / sub.maxMarks) * 100) : 0;
    sub.markedBy = s.name;
    sub.markedAt = now;
    const prevStatus = sub.markingStatus;
    sub.markingStatus = payload.submitForApproval ? 'awaiting_approval' : 'marking';
    (sub.markingHistory = sub.markingHistory || []).push({
      at: now, by: s.name,
      action: payload.submitForApproval ? 'submitted_for_approval' : 'draft_saved',
      from: prevStatus, to: sub.markingStatus,
      note: changes.length ? changes.join('; ') : (payload.submitForApproval ? 'Marks submitted for approval.' : 'Marking draft saved.')
    });
    DB.set('examResults', items);
    Audit.log('exam.mark', sub.examTitle + ' — ' + sub.studentName + ' (' + sub.score + '/' + sub.maxMarks + ', ' + ExamMarking.statusLabel(sub.markingStatus) + ')');
    return { ok: true, submission: sub };
  },
  /* ---------- TEACHER/ADMIN: publish results to the student ----------
     The administrator keeps direct publication (management is chain authority).
     A TEACHER'S publish is quarantined and queued: the whole exam's results
     become one submission that must walk Chief Examiner → Headteacher →
     Secretary → Publish before any student sees a mark. */
  publish(subId) {
    const s = Auth.session();
    if (!s) return { ok: false, error: 'Not signed in.' };
    const items = this.list();
    const sub = items.find(x => x.id === subId);
    if (!sub) return { ok: false, error: 'Submission not found.' };
    if (!this.canPublish(sub)) return { ok: false, error: 'Only the exam teacher or the administrator can publish results.' };
    if (this.unmarkedCount(sub) > 0) return { ok: false, error: 'Some questions still have no marks. Award marks for every question before publishing.' };
    if (s.role !== 'teacher') {
      const now = new Date().toISOString();
      const prev = sub.markingStatus;
      sub.markingStatus = 'published';
      sub.publishedAt = now;
      sub.publishedBy = s.name;
      sub.approvedBy = s.name;
      (sub.markingHistory = sub.markingHistory || []).push({ at: now, by: s.name, action: 'published', from: prev, to: 'published', note: 'Results published to the student (' + sub.score + '/' + sub.maxMarks + ').' });
      DB.set('examResults', items);
      Notifications.send(sub.studentId, 'student', 'Results Published', 'Your results for ' + sub.examTitle + ' are now available.');
      const parent = DB.get('parents').find(p => (p.childrenIds || []).includes(sub.studentId));
      if (parent) Notifications.send(parent.id, 'parent', 'Results Published', (sub.studentName || 'Your child') + "'s results for " + sub.examTitle + ' are now available.');
      Audit.log('exam.publish', sub.examTitle + ' — ' + sub.studentName + ' (' + sub.score + '/' + sub.maxMarks + ')');
      return { ok: true, submission: sub };
    }
    /* ---- APPROVAL GATE: teacher route ---- */
    const exam = this.examOf(sub);
    const prevStatus = sub.markingStatus;
    const batch = Submissions.list().find(x =>
      x.linkedCollection === 'examResults' && x.linkedKey === 'examId' && x.linkedId === sub.examId &&
      ['chiefexaminer', 'headteacher', 'secretary', 'approved_final'].includes(x.status));
    if (!batch) {
      const r = ApprovalGate.submit('examResults', sub, {
        linkedKey: 'examId', linkedId: sub.examId,
        docType: 'exam_results',
        title: 'Exam Results: ' + (exam.title || sub.examTitle) + ' — ' + (exam.className || sub.className),
        className: exam.className || sub.className || 'All classes',
        subject: exam.subject || sub.subject || 'General',
        content: this.resultsSummary(sub.examId)
      });
      if (!r.ok) return { ok: false, error: r.error || 'Could not submit these results for approval. Nothing was published.' };
    } else if (!sub.approvalId) {
      sub.approvalId = batch.id;
      sub.approvalTrackingNo = batch.trackingNo;
    }
    sub.markingStatus = 'pending_approval';
    (sub.markingHistory = sub.markingHistory || []).push({
      at: new Date().toISOString(), by: s.name, action: 'submitted_for_approval', from: prevStatus, to: 'pending_approval',
      note: 'Results queued for Chief Examiner, Headteacher and Secretary approval.'
    });
    DB.set('examResults', items);
    Audit.log('exam.publish.request', sub.examTitle + ' — results submitted for approval (' + (sub.approvalTrackingNo || '') + ')');
    return { ok: true, submittedForApproval: true, approvalTrackingNo: sub.approvalTrackingNo, submission: sub };
  },
  /* readable marks sheet attached to the approval submission */
  resultsSummary(examId) {
    const ex = DB.get('exams').find(x => x.id === examId) || {};
    const subs = this.list().filter(r => r.examId === examId);
    if (!subs.length) return 'No submissions recorded yet.';
    const lines = subs.map(r => (r.studentName || 'Unknown') + ' (' + (r.admissionNo || '') + '): ' + r.score + '/' + r.maxMarks + ' — ' + r.percent + '% [' + this.statusLabel(r.markingStatus) + ']');
    return (ex.title || 'Exam') + ' — ' + (ex.className || '') + ' ' + (ex.subject || '') + '\n\n' + lines.join('\n');
  },
  /* ---------- dashboard summary ---------- */
  statsForTeacher(teacherId) {
    const s = Auth.session();
    const subs = this.forTeacher(teacherId);
    const exams = DB.get('exams').filter(e => e.teacherId === teacherId || (s && e.teacherName === s.name));
    return {
      exams: exams.length,
      submissions: subs.length,
      pending: subs.filter(x => x.markingStatus === 'pending').length,
      marking: subs.filter(x => x.markingStatus === 'marking').length,
      awaiting: subs.filter(x => x.markingStatus === 'awaiting_approval').length,
      published: subs.filter(x => this.isPublished(x)).length
    };
  },
  statsAll() {
    const subs = this.list();
    return {
      exams: DB.get('exams').length,
      submissions: subs.length,
      pending: subs.filter(x => x.markingStatus === 'pending').length,
      marking: subs.filter(x => x.markingStatus === 'marking').length,
      awaiting: subs.filter(x => x.markingStatus === 'awaiting_approval').length,
      published: subs.filter(x => this.isPublished(x)).length
    };
  }
};

/* ---------- PRINT / DOWNLOAD HELPERS (Module 17) ---------- */
/* Build a real, dependency-free PDF from [text, size, bold] rows.
   Output is pure ASCII so string length === byte length, which keeps
   the xref byte offsets exact. */
const PDFDoc = {
  _esc(t) {
    return String(t == null ? '' : t)
      .replace(/[^\x20-\x7E]/g, c => ({ '\u2014': '-', '\u2013': '-', '\u2019': "'", '\u2018': "'", '\u201C': '"', '\u201D': '"', '\u00B7': '-', '\u00A0': ' ' }[c] || ' '))
      .replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  },
  build(rows, opts) {
    const PAGE_H = 842, MARGIN_X = 50, BOTTOM = 56, LEAD_BASE = 15;
    const logo = opts && opts.logo;
    let logoBytes = '', logoW = 0, logoH = 0;
    if (logo && logo.dataUrl) {
      try {
        const b64 = String(logo.dataUrl).split(',')[1] || '';
        logoW = Number(logo.width) || 0;
        logoH = Number(logo.height) || 0;
        if (b64 && logoW && logoH) logoBytes = atob(b64);
      } catch (e) { logoBytes = ''; }
    }
    const TOP = logoBytes ? 792 - (logoH + 16) : 792;
    const pages = [];
    let cur = [], y = TOP;
    (rows || []).forEach(r => {
      const text = this._esc(r[0]);
      const size = Number(r[1]) || 10;
      const lead = LEAD_BASE + Math.max(0, size - 10);
      if (y - lead < BOTTOM && text) { pages.push(cur); cur = []; y = TOP; }
      cur.push({ text, size, bold: !!r[2], y });
      y -= lead;
    });
    if (cur.length) pages.push(cur);
    if (!pages.length) pages.push([{ text: ' ', size: 10, bold: false, y: TOP }]);

    const objs = [];
    const add = s => { objs.push(s); return objs.length; };   // 1-based object numbers
    const catalogId = add('');                                  // filled after pages known
    const pagesId = add('');
    const fontRegular = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    const fontBold = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    const logoId = logoBytes ? add(`<< /Type /XObject /Subtype /Image /Width ${logoW} /Height ${logoH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logoBytes.length} >>\nstream\n${logoBytes}\nendstream`) : 0;
    const imgCmd = logoBytes ? `q ${logoW} 0 0 ${logoH} ${595 - MARGIN_X - logoW} ${792 - logoH} cm /Im0 Do Q\n` : '';
    const pageIds = pages.map(lines => {
      const content = imgCmd + lines.map(l =>
        `BT /${l.bold ? 'F2' : 'F1'} ${l.size} Tf 1 0 0 1 ${MARGIN_X} ${l.y} Tm (${l.text}) Tj ET`
      ).join('\n');
      const contentId = add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
      const xobj = logoId ? ` /XObject << /Im0 ${logoId} 0 R >>` : '';
      return add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 ${PAGE_H}] /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >>${xobj} >> /Contents ${contentId} 0 R >>`);
    });
    objs[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
    objs[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map(id => id + ' 0 R').join(' ')}] /Count ${pageIds.length} >>`;

    let out = '%PDF-1.4\n';
    const offsets = [];
    objs.forEach((o, i) => { offsets[i] = out.length; out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
    const xrefAt = out.length;
    out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
    offsets.forEach(o => { out += String(o).padStart(10, '0') + ' 00000 n \n'; });
    out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefAt}\n%%EOF`;
    return out;
  },

  _textWidth(s, size, bold) {
    return String(s || '').length * (Number(size) || 7) * (bold ? 0.54 : 0.5);
  },

  _wrapText(s, maxWidth, size, bold) {
    const factor = (Number(size) || 7) * (bold ? 0.54 : 0.5);
    const maxChars = Math.max(6, Math.floor((Number(maxWidth) || 60) / factor));
    const words = String(s == null ? '' : s).split(/\s+/).filter(Boolean);
    const lines = [];
    let cur = '';
    const splitLong = w => {
      let rest = w;
      while (rest.length > maxChars) { lines.push(rest.slice(0, maxChars)); rest = rest.slice(maxChars); }
      return rest;
    };
    words.forEach(word => {
      const w = splitLong(word);
      if (!w) return;
      if (cur && (cur + ' ' + w).length > maxChars) { lines.push(cur); cur = w; }
      else cur = cur ? cur + ' ' + w : w;
    });
    if (cur) lines.push(cur);
    return lines.length ? lines : [''];
  },

  _serialize(objs, catalogId, pagesId) {
    let out = '%PDF-1.4\n';
    const offsets = [];
    objs.forEach((o, i) => { offsets[i] = out.length; out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
    const xrefAt = out.length;
    out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
    offsets.forEach(o => { out += String(o).padStart(10, '0') + ' 00000 n \n'; });
    out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefAt}\n%%EOF`;
    return out;
  },

  /* A6 (105 x 148 mm) professional fee receipt. */
  buildA6Receipt(m, logo) {
    const W = 297.64, H = 419.53, M = 15, R = W - M;
    const NAVY = '0.06 0.17 0.30', TEXT = '0.12 0.13 0.15', MUTED = '0.40 0.43 0.47';
    const GOLD = '0.79 0.64 0.15', BORDER = '0.70 0.75 0.81';
    const cmds = [];
    const line = (x1, y1, x2, y2, w, c) => cmds.push(`${c || BORDER} RG ${w || 0.5} w ${x1} ${y1} m ${x2} ${y2} l S`);
    const fill = (x, y, w, h, c) => cmds.push(`${c} rg ${x} ${y} ${w} ${h} re f`);
    const text = (s, x, y, size, bold, color, align) => {
      const str = String(s == null ? '' : s);
      let xx = x;
      if (align === 'right') xx = x - this._textWidth(str, size, bold);
      else if (align === 'center') xx = x - this._textWidth(str, size, bold) / 2;
      cmds.push(`BT /${bold ? 'F2' : 'F1'} ${size || 7} Tf ${color || NAVY} rg ${xx} ${y} Td (${this._esc(str)}) Tj ET`);
    };

    let imgBytes = '', imgW = 0, imgH = 0;
    if (logo && logo.dataUrl) {
      try {
        const b64 = String(logo.dataUrl).split(',')[1] || '';
        const nw = Number(logo.width) || 0, nh = Number(logo.height) || 0;
        if (b64 && nw && nh) {
          const sc = Math.min(38 / nw, 38 / nh);
          imgW = nw * sc; imgH = nh * sc; imgBytes = atob(b64);
        }
      } catch (e) { imgBytes = ''; imgW = 0; imgH = 0; }
    }

    const top = H - M;
    if (imgBytes) cmds.push(`q ${imgW.toFixed(2)} 0 0 ${imgH.toFixed(2)} ${M} ${(top - imgH).toFixed(2)} cm /Im0 Do Q`);
    const textX = imgBytes ? M + 44 : M;
    const maxHead = R - textX;
    let y = top - 9;
    this._wrapText(m.schoolName, maxHead, 10.5, true).forEach((l, i) => text(l, textX, y - i * 11, 10.5, true, NAVY));
    y -= this._wrapText(m.schoolName, maxHead, 10.5, true).length * 11;
    const contactLine = [m.address, m.contact].filter(Boolean).join(' · ');
    if (contactLine) {
      const ls = this._wrapText(contactLine, maxHead, 6.1, false);
      ls.forEach((l, i) => text(l, textX, y - i * 7.5, 6.1, false, MUTED));
      y -= ls.length * 7.5;
    }
    if (m.motto) { text(m.motto, textX, y - 7.5, 6.1, false, NAVY); y -= 7.5; }
    const headBottom = Math.min(y - 3, imgBytes ? top - imgH - 4 : y - 3);
    line(M, headBottom, R, headBottom, 1.1, GOLD);

    y = headBottom - 11;
    text('FEE PAYMENT RECEIPT', M, y, 8.5, true, NAVY);
    text('Receipt No. ' + m.receiptNo, R, y, 7.4, true, TEXT, 'right');
    text(m.status, R, y - 9.5, 6.2, true, m.reversed ? '0.69 0 0.13' : '0.10 0.50 0.22', 'right');
    y -= 16;

    const rows = [
      ['Student', m.studentName],
      ['Admission No.', m.admissionNo],
      ['Class', m.className],
      ['Academic Year / Term', m.academicYear + ' · ' + m.term],
      ['Actual Payment Date', m.paymentDate],
      ['System Recording Date', m.systemDate],
      ['Payment Method', m.method + (m.reference ? ' · Ref: ' + m.reference : '')]
    ];
    const labelW = 100, cellPad = 4;
    line(M, y, R, y, 0.5, BORDER);
    rows.forEach(row => {
      const labelLines = this._wrapText(row[0], labelW - cellPad * 2, 6.6, true);
      const valLines = this._wrapText(row[1], (R - M - labelW) - cellPad * 2, 6.6, false);
      const n = Math.max(labelLines.length, valLines.length);
      const h = Math.max(15, n * 7.8 + 6.5);
      fill(M, y - h, labelW, h, '0.93 0.95 0.98');
      labelLines.forEach((l, i) => text(l, M + cellPad, y - 8.6 - i * 7.8, 6.6, true, NAVY));
      valLines.forEach((l, i) => text(l, M + labelW + cellPad, y - 8.6 - i * 7.8, 6.6, false, TEXT));
      line(M, y - h, R, y - h, 0.5, BORDER);
      line(M + labelW, y, M + labelW, y - h, 0.5, BORDER);
      y -= h;
    });

    y -= 8;
    const headerH = 16;
    fill(M, y - headerH, R - M, headerH, '0.86 0.91 0.96');
    text('Description', M + cellPad, y - 10.2, 6.9, true, NAVY);
    text('Amount (' + m.currency + ')', R - cellPad, y - 10.2, 6.9, true, NAVY, 'right');
    line(M, y - headerH, R, y - headerH, 0.6, BORDER);
    y -= headerH;

    const feeRows = [
      ['Balance Brought Forward', money(m.previousBalance), ''],
      ['Total Fees Charged', money(m.termCharged), ''],
      ['Amount Paid This Payment', money(m.amount), 'paid'],
      ['Total Amount Paid (This Term)', money(m.termPaid), ''],
      ['Outstanding Balance (All Terms)', money(m.outstanding), 'total']
    ];
    feeRows.forEach(r => {
      const h = 17.5;
      if (r[2] === 'paid') fill(M, y - h, R - M, h, '0.96 0.98 1');
      else if (r[2] === 'total') fill(M, y - h, R - M, h, '0.93 0.95 0.98');
      text(r[0], M + cellPad, y - 11.3, 6.9, r[2] !== '', TEXT);
      text(r[1], R - cellPad, y - 11.3, 6.9, r[2] !== '', TEXT, 'right');
      line(M, y - h, R, y - h, 0.5, BORDER);
      y -= h;
    });

    y -= 12;
    const confirm = m.reversed ? 'This payment has been reversed.' : 'Payment received with thanks. This is a system-generated receipt.';
    this._wrapText(confirm, R - M, 6.4, true).forEach((l, i) => text(l, M, y - i * 8, 6.4, true, NAVY));
    y -= this._wrapText(confirm, R - M, 6.4, true).length * 8 + 3;
    const meta = 'Receipt generated: ' + m.generated + ' · Verification ref: ' + m.verifyRef;
    this._wrapText(meta, R - M, 5.6, false).forEach((l, i) => text(l, M, y - i * 7, 5.6, false, MUTED));

    const sigY = Math.max(M + 20, y - 26);
    line(R - 82, sigY, R, sigY, 0.6, '0.25 0.25 0.25');
    text('Authorized Finance Office', R - 41, sigY - 8, 5.8, false, MUTED, 'center');
    this._wrapText('Actual payment date is when money was received; system recording date is when it was entered. Keep this receipt for your records.', R - M, 5.1, false)
      .forEach((l, i) => text(l, M, M + 8 - i * 6.2, 5.1, false, MUTED));

    const content = cmds.join('\n');
    const objs = [];
    const add = s => { objs.push(s); return objs.length; };
    const catalogId = add('');
    const pagesId = add('');
    const f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    const f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    const logoId = imgBytes ? add(`<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imgBytes.length} >>\nstream\n${imgBytes}\nendstream`) : 0;
    const contentId = add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    const xobj = logoId ? ` /XObject << /Im0 ${logoId} 0 R >>` : '';
    const pageId = add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >>${xobj} >> /Contents ${contentId} 0 R >>`);
    objs[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
    objs[pagesId - 1] = `<< /Type /Pages /Kids [${pageId} 0 R] /Count 1 >>`;
    return this._serialize(objs, catalogId, pagesId);
  }
};

function downloadTextFile(fileName, content, mime) {
  try {
    const blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) {} }, 4000);
    return true;
  } catch (e) { toast('Download failed.', 'error'); return false; }
}

function assetURL(rel) {
  try { return new URL(rel, document.baseURI).href; } catch (e) { return rel; }
}

/* Saves a PDF that contains binary image data without UTF-8 corruption. */
function downloadPDFFile(fileName, binary, mime) {
  try {
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i) & 0xff;
    const blob = new Blob([bytes], { type: mime || 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) {} }, 4000);
    return true;
  } catch (e) { toast('Download failed.', 'error'); return false; }
}

/* Rasterises the school logo to JPEG so it can be embedded in the PDF. */
async function logoForPDF() {
  try {
    const src = await schoolLogoForPrint();
    const img = await new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error('logo'));
      im.src = src;
    });
    const nw = img.naturalWidth || img.width || 0;
    const nh = img.naturalHeight || img.height || 0;
    if (!nw || !nh) return null;
    const scale = Math.min(1, 220 / nw, 140 / nh);
    const w = Math.max(1, Math.round(nw * scale));
    const h = Math.max(1, Math.round(nh * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return { dataUrl: canvas.toDataURL('image/jpeg', 0.9), width: w, height: h };
  } catch (e) { return null; }
}

/* The logo uploaded by the administrator wins; otherwise use the site crest. */
async function schoolLogoForPrint() {
  try {
    if (typeof getSiteImageValue === 'function') {
      const custom = await getSiteImageValue('logoImage');
      if (custom) return custom;
    }
  } catch (e) { /* ignore */ }
  const lg = DB.get('logo', null);
  if (lg && lg.imageUrl) return lg.imageUrl;
  return assetURL('../images/favicon.svg');
}

function schoolBrandHTML(logoUrl) {
  const school = DB.get('settings', {});
  const contact = [school.phone ? 'Tel: ' + school.phone : '', school.email || ''].filter(Boolean).join(' · ');
  return `<div style="display:flex;align-items:center;gap:16px;border-bottom:3px solid #c9a227;padding-bottom:12px;margin-bottom:14px">
    <img src="${esc(logoUrl || assetURL('../images/favicon.svg'))}" alt="School logo" style="width:76px;height:76px;object-fit:contain;flex:0 0 auto">
    <div style="min-width:0">
      <div style="font-size:1.35rem;font-weight:700;color:#0f2c4c;line-height:1.15">${esc(school.schoolName || 'St. Teresa Kanyange Academy')}</div>
      ${school.address ? `<div style="font-size:0.84rem;color:#555">${esc(school.address)}</div>` : ''}
      ${contact ? `<div style="font-size:0.84rem;color:#555">${esc(contact)}</div>` : ''}
      ${school.motto ? `<div style="font-size:0.8rem;color:#777;font-style:italic">${esc(school.motto)}</div>` : ''}
    </div>
  </div>`;
}

function receiptCSS(forPrint) {
  return `
    .rcpt{font-family:Arial,Helvetica,sans-serif;color:#111;background:#fff;border:1.5pt solid #0f2c4c;border-radius:2mm;padding:3mm 3.5mm;box-sizing:border-box;display:flex;flex-direction:column;${forPrint ? 'width:95mm;height:137mm;page-break-inside:avoid;break-inside:avoid' : 'max-width:360px;margin:0 auto'}}
    .rcpt-head{display:flex;gap:3mm;align-items:center;border-bottom:2pt solid #c9a227;padding-bottom:2mm}
    .rcpt-logo{width:16mm;height:16mm;object-fit:contain;flex:0 0 auto}
    .rcpt-brand{flex:1;min-width:0}
    .rcpt-school{font-size:10.5pt;font-weight:700;color:#0f2c4c;line-height:1.1;text-transform:uppercase}
    .rcpt-contact{font-size:6.4pt;color:#555;line-height:1.3}
    .rcpt-motto{font-size:6.4pt;color:#0f2c4c;font-style:italic;line-height:1.3}
    .rcpt-titlerow{display:flex;justify-content:space-between;align-items:flex-start;gap:2mm;margin:2mm 0 1.5mm}
    .rcpt-title{font-size:8pt;font-weight:700;letter-spacing:.4pt;color:#0f2c4c}
    .rcpt-receiptno{text-align:right;font-size:6.8pt;color:#333;line-height:1.3}
    .rcpt-status{font-size:6.2pt;font-weight:700;color:#1a7f37}
    .rcpt-status.is-reversed{color:#b00020}
    .rcpt-details{width:100%;border-collapse:collapse;font-size:6.8pt;table-layout:fixed;margin-bottom:2mm}
    .rcpt-details th,.rcpt-details td{border:0.5pt solid #c3cbd4;padding:1mm 1.4mm;vertical-align:top;word-wrap:break-word;overflow-wrap:anywhere;line-height:1.25}
    .rcpt-details th{width:38%;text-align:left;background:#eef3f8;color:#0f2c4c;font-weight:700}
    .rcpt-fees{width:100%;border-collapse:collapse;font-size:6.9pt;table-layout:fixed}
    .rcpt-fees th,.rcpt-fees td{border:0.5pt solid #c3cbd4;padding:1.1mm 1.4mm;line-height:1.25;word-wrap:break-word;overflow-wrap:anywhere}
    .rcpt-fees thead th{background:#dce8f3;color:#0f2c4c;font-weight:700;text-align:left}
    .rcpt-fees .num{width:34%;text-align:right;white-space:nowrap}
    .rcpt-fees td.num{text-align:right;font-variant-numeric:tabular-nums}
    .rcpt-fees tr.is-paid td{font-weight:700;background:#f4f8fc}
    .rcpt-fees tr.is-total td{font-weight:700;background:#eef3f8}
    .rcpt-foot{margin-top:auto;padding-top:2mm;display:flex;flex-direction:column;gap:1mm}
    .rcpt-confirm{font-size:6.8pt;color:#0f2c4c;font-weight:700}
    .rcpt-meta{font-size:6pt;color:#666;line-height:1.3;word-wrap:break-word;overflow-wrap:anywhere}
    .rcpt-sign{align-self:flex-end;width:38mm;margin-top:3mm;text-align:center}
    .rcpt-sigline{border-top:0.7pt solid #333;margin-bottom:0.8mm}
    .rcpt-siglabel{font-size:6.2pt;color:#333}
    .rcpt-note{font-size:5.8pt;color:#777;line-height:1.3}
    .rcpt-spacer{flex:1 1 auto}
  `;
}

/* A6 receipt page used by the Print Receipt button. */
function receiptSheetDocument(title, logo, bodyHTML) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${esc(title)}</title>
  <style>
    @page{size:105mm 148mm;margin:5mm}
    *{box-sizing:border-box}
    html,body{margin:0;padding:0;background:#fff}
    body{font-family:Arial,Helvetica,sans-serif;color:#111;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    ${receiptCSS(true)}
  </style></head><body>
  ${bodyHTML}
  <script>window.onload=function(){setTimeout(function(){window.print()},350)}<\/script>
  </body></html>`;
}

function printReceiptSheet(title, buildSlips) {
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) { toast('Please allow pop-ups to print.', 'error'); return; }
  const write = logo => {
    let slips = '';
    try { slips = typeof buildSlips === 'function' ? buildSlips(logo) : String(buildSlips || ''); } catch (e) { slips = ''; }
    if (!slips) { try { w.close(); } catch (e) {} return; }
    w.document.write(receiptSheetDocument(title, logo, slips));
    w.document.close();
  };
  schoolLogoForPrint().then(write).catch(() => write(assetURL('../images/favicon.svg')));
}

function printPageDocument(title, bodyHTML, opts) {
  const heading = opts && opts.hideHeading ? '' : `<h1>St. Teresa Kanyange Academy — ${esc(title)}</h1>`;
  const school = DB.get('settings', {});
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${esc(title)}</title>
  <style>
    body{font-family:Georgia,'Times New Roman',serif;color:#111;margin:40px;line-height:1.5}
    h1{color:#0f2c4c;border-bottom:3px solid #c9a227;padding-bottom:8px;font-size:1.4rem}
    h2{color:#0f2c4c;font-size:1.1rem;margin-top:1.2em}
    table{width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92rem}
    th,td{border:1px solid #999;padding:7px 10px;text-align:left}
    th{background:#eef2f6;font-weight:700}
    .meta{color:#555;font-size:0.85rem;margin-bottom:18px}
    .footer{margin-top:32px;padding-top:10px;border-top:1px solid #ccc;font-size:0.78rem;color:#666;text-align:center}
    @media print{body{margin:15mm}}
  </style></head><body>
  ${heading}
  ${bodyHTML}
  <div class="footer">Printed ${new Date().toLocaleString()} · ${esc(school.schoolName || 'St. Teresa Kanyange Academy')} · ${esc(school.motto || 'Unity is Strength')}</div>
  <script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script>
  </body></html>`;
}

function printHTML(title, bodyHTML, opts) {
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) { toast('Please allow pop-ups to print.', 'error'); return; }
  w.document.write(printPageDocument(title, bodyHTML, opts));
  w.document.close();
}

/* Opens the window immediately (so pop-up blockers allow it), then loads
   the uploaded school logo before writing the document. */
function printHTMLWithLogo(title, buildBody, opts) {
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) { toast('Please allow pop-ups to print.', 'error'); return; }
  const write = logo => {
    let body = '';
    try { body = buildBody(logo); } catch (e) { body = ''; }
    if (!body) { try { w.close(); } catch (e) {} return; }
    w.document.write(printPageDocument(title, body, opts));
    w.document.close();
  };
  schoolLogoForPrint().then(write).catch(() => write(assetURL('../images/favicon.svg')));
}

async function downloadMaterial(materialId) {
  const m = Materials.get(materialId);
  if (!m) { toast('Material not found.', 'error'); return; }
  // permission: student must own the class material AND it must be approved
  const s = Auth.session();
  if (s && s.role === 'student') {
    if (!ApprovalGate.approvedForStudents(m)) { toast('This document has not been approved for publication yet.', 'error'); return; }
    const stu = studentForSession(s);
    if (!stu || stu.className !== m.className) { toast('You are not authorized to download this file.', 'error'); return; }
  }
  if (s && s.role === 'parent' && !ApprovalGate.approvedForStudents(m)) { toast('This document has not been approved for publication yet.', 'error'); return; }
  if (!m.fileKey) { toast('No file attached.', 'error'); return; }
  try {
    const dataUrl = await ImageStore.get(m.fileKey);
    if (!dataUrl) { toast('File could not be loaded.', 'error'); return; }
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = Materials.safeFileName(m);
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast('Downloading ' + a.download);
  } catch (e) {
    toast('Download failed.', 'error');
  }
}

function viewMaterial(materialId) {
  const m = Materials.get(materialId);
  if (!m) return;
  const s = Auth.session();
  if (s && (s.role === 'student' || s.role === 'parent') && !ApprovalGate.approvedForStudents(m)) { toast('This document has not been approved for publication yet.', 'error'); return; }
  if (s && s.role === 'student') {
    const stu = studentForSession(s);
    if (!stu || stu.className !== m.className) { toast('Not authorized.', 'error'); return; }
  }
  Materials.fileData(m).then(dataUrl => {
    const body = document.getElementById('materialViewBody');
    if (!body) return;
    const isImage = m.fileType && m.fileType.startsWith('image/');
    body.innerHTML = `
      <div style="margin-bottom:14px">
        <h3 style="color:var(--navy)">${esc(m.title)}</h3>
        <p style="color:var(--text-light);font-size:0.88rem">${esc(m.subject)} · ${esc(m.className)} · ${esc(m.category)} · Uploaded ${fmtDate(m.uploadedAt)}</p>
        ${m.description ? `<p style="margin-top:8px">${esc(m.description)}</p>` : ''}
        <p style="font-size:0.82rem;color:var(--text-light);margin-top:6px"><i class="fas fa-file"></i> ${esc(m.fileName || 'file')} ${m.fileSize ? '(' + Math.round(m.fileSize / 1024) + ' KB)' : ''}</p>
      </div>
      ${dataUrl
        ? (isImage
          ? `<img src="${dataUrl}" alt="" style="max-width:100%;border-radius:8px">`
          : (m.fileType === 'application/pdf'
            ? `<embed src="${dataUrl}" type="application/pdf" style="width:100%;height:65vh;border-radius:8px">`
            : `<div style="padding:30px;text-align:center;background:var(--cream);border-radius:8px"><i class="fas fa-file" style="font-size:3rem;color:var(--border);display:block;margin-bottom:10px"></i><p>Preview not available for this file type.</p><p style="font-size:0.85rem;color:var(--text-light)">Use Download to save it and open with a compatible app.</p></div>`))
        : `<div class="empty-state"><i class="fas fa-file"></i><h4>File not available</h4></div>`}
      <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap">
        <button class="btn btn-primary" onclick="downloadMaterial('${m.id}')"><i class="fas fa-download"></i> Download</button>
        <button class="btn btn-gold" onclick="printMaterial('${m.id}')"><i class="fas fa-print"></i> Print</button>
      </div>`;
    openModal('materialViewModal');
  }).catch(() => toast('Could not load file.', 'error'));
}

async function printMaterial(materialId) {
  const m = Materials.get(materialId);
  if (!m) return;
  const s = Auth.session();
  if (s && (s.role === 'student' || s.role === 'parent') && !ApprovalGate.approvedForStudents(m)) { toast('This document has not been approved for publication yet.', 'error'); return; }
  const dataUrl = await Materials.fileData(m);
  const isImage = m.fileType && m.fileType.startsWith('image/');
  const meta = `<div class="meta">${esc(m.subject)} · ${esc(m.className)} · ${esc(m.category)} · ${fmtDate(m.uploadedAt)}${m.description ? ' — ' + esc(m.description) : ''}</div>`;
  if (dataUrl && isImage) {
    printHTML(m.title, meta + `<img src="${dataUrl}" style="max-width:100%">`);
  } else if (dataUrl && m.fileType === 'application/pdf') {
    const w = window.open(dataUrl, '_blank');
    if (w) setTimeout(() => { try { w.print(); } catch (e) {} }, 800);
    else toast('Please allow pop-ups to print.', 'error');
  } else {
    // text / unknown: print the metadata + instructions
    printHTML(m.title, meta + `<p><strong>File:</strong> ${esc(m.fileName || 'attachment')}</p><p>This document is available for download from the portal.</p>`);
  }
}


/* ============================================================
   FEES & PAYMENTS — three levels of fee management, ONE owner.

   1. SCHOOL FEE STRUCTURE   (feeItems)          — the old hard-coded
      FEE_ITEMS list, now stored in the database.
   2. CLASS FEE STRUCTURES   (classFeeStructures) — per class, per
      academic year, per term.
   3. INDIVIDUAL STUDENT FEES (feeCharges)        — billed class fees
      plus authorised individual adjustments.

   RULE: only the Secretary may create, edit, delete or apply any fee
   amount, and only the Secretary may record, correct or reverse a
   payment. Headteacher / Chief Examiner / teachers / other staff are
   READ-ONLY, students and parents may only read their own account.

   Every check below lives in the DATA LAYER so no page, URL or direct
   call can bypass it — the interface only mirrors these rules.

   Balance invariant maintained everywhere:
       student.feeBalance === sum(active charges) - sum(active payments)
   The migration makes that true for pre-existing data without changing
   a single stored balance or payment.
   ============================================================ */
const Fees = {
  /* the original hard-coded POS list — used ONLY to seed feeItems once */
  DEFAULT_ITEMS: [
    { id: 'tuition', name: 'Tuition Fee', price: 4200, icon: 'fa-graduation-cap' },
    { id: 'admission', name: 'Admission Fee', price: 500, icon: 'fa-file-signature' },
    { id: 'lab', name: 'Laboratory Fee', price: 300, icon: 'fa-flask' },
    { id: 'library', name: 'Library Fee', price: 150, icon: 'fa-book' },
    { id: 'transport', name: 'Transport Fee', price: 800, icon: 'fa-bus' },
    { id: 'uniform', name: 'Uniform Fee', price: 220, icon: 'fa-tshirt' },
    { id: 'sports', name: 'Sports Fee', price: 180, icon: 'fa-futbol' },
    { id: 'exam', name: 'Exam Fee', price: 120, icon: 'fa-pen' },
    { id: 'activity', name: 'Activity Fee', price: 250, icon: 'fa-palette' },
    { id: 'meal', name: 'Meal Plan', price: 650, icon: 'fa-utensils' }
  ],
  round2(n) { return Math.round((Number(n) || 0) * 100) / 100; },

  /* ---------------------------------------------------------
     LEVEL 1 — SCHOOL-WIDE FEE STRUCTURE
     --------------------------------------------------------- */
  items() { return DB.get('feeItems'); },
  activeItems() { return this.items().filter(i => i.active !== false); },
  getItem(id) { return this.items().find(i => i.id === id) || null; },

  saveItem(data, editingId) {
    if (!Perm.canManageFees()) return { ok: false, error: 'Only the Secretary may create or edit school fee items.' };
    const name = String(data.name || '').trim();
    const price = Number(data.price);
    if (!name) return { ok: false, error: 'Fee name is required.' };
    if (!isFinite(price) || price < 0) return { ok: false, error: 'Fee amount must be zero or more.' };
    const items = this.items();
    if (items.some(i => i.name.toLowerCase() === name.toLowerCase() && i.id !== editingId)) {
      return { ok: false, error: 'A fee item called "' + name + '" already exists.' };
    }
    const who = (Auth.session() || {}).name || '';
    if (editingId) {
      const i = items.findIndex(x => x.id === editingId);
      if (i === -1) return { ok: false, error: 'Fee item not found.' };
      items[i] = { ...items[i], name, price, icon: data.icon || items[i].icon || 'fa-money-bill-wave', updatedAt: today(), updatedBy: who };
    } else {
      items.push({ id: DB.uid(), name, price, icon: data.icon || 'fa-money-bill-wave', active: true, createdAt: today(), createdBy: who });
    }
    DB.set('feeItems', items);
    Audit.log(editingId ? 'fee.item.update' : 'fee.item.create', name + ' = ' + money(price));
    return { ok: true };
  },

  setItemActive(id, active) {
    if (!Perm.canManageFees()) return { ok: false, error: 'Only the Secretary may activate or deactivate fee items.' };
    const items = this.items();
    const i = items.findIndex(x => x.id === id);
    if (i === -1) return { ok: false, error: 'Fee item not found.' };
    items[i].active = !!active;
    items[i].updatedAt = today();
    items[i].updatedBy = (Auth.session() || {}).name || '';
    DB.set('feeItems', items);
    Audit.log('fee.item.' + (active ? 'activate' : 'deactivate'), items[i].name);
    return { ok: true };
  },

  removeItem(id) {
    if (!Perm.canManageFees()) return { ok: false, error: 'Only the Secretary may delete fee items.' };
    const items = this.items();
    const i = items.findIndex(x => x.id === id);
    if (i === -1) return { ok: false, error: 'Fee item not found.' };
    const gone = items[i];
    items.splice(i, 1);
    DB.set('feeItems', items);
    Audit.log('fee.item.delete', gone.name + ' (' + money(gone.price) + ') — class structures that already used it keep their own copy of the amount.');
    return { ok: true };
  },

  /* ---------------------------------------------------------
     LEVEL 2 — CLASS FEE STRUCTURES (class + year + term)
     --------------------------------------------------------- */
  classStructures() { return DB.get('classFeeStructures'); },
  getClassStructure(id) { return this.classStructures().find(s => s.id === id) || null; },

  saveClassStructure(data, editingId) {
    if (!Perm.canManageFees()) return { ok: false, error: 'Only the Secretary may create or modify class fee structures.' };
    const className = String(data.className || '').trim();
    if (!className) return { ok: false, error: 'Please select a class.' };
    const known = ACADEMIC_CLASSES.includes(className) || Classes.list().some(c => c.name === className);
    if (!known) return { ok: false, error: 'Unknown class "' + className + '". Choose a configured class.' };
    const academicYear = String(data.academicYear || '').trim() || AcademicYears.activeYear();
    const yErr = AcademicYears.validateForAdmission(academicYear);
    if (yErr) return { ok: false, error: yErr };
    const term = String(data.term || '').trim();
    if (term && !['1', '2', '3'].includes(term)) return { ok: false, error: 'Term must be 1, 2, 3, or blank for "all terms".' };
    const raw = Array.isArray(data.items) ? data.items : [];
    const items = [];
    raw.forEach(it => {
      const amt = this.round2(Number(it && it.amount));
      if (!isFinite(amt) || amt < 0) return;
      const src = it.feeItemId ? this.getItem(it.feeItemId) : null;
      const nm = String((src && src.name) || (it && it.name) || '').trim();
      if (!nm) return;
      items.push({ feeItemId: it.feeItemId || '', name: nm, amount: amt });
    });
    if (!items.length) return { ok: false, error: 'Add at least one fee line with an amount of zero or more.' };
    const total = this.round2(items.reduce((a, i2) => a + i2.amount, 0));
    const list = this.classStructures();
    if (list.some(s => s.className === className && String(s.academicYear) === String(academicYear) && String(s.term || '') === term && s.id !== editingId)) {
      return { ok: false, error: 'A fee structure for ' + className + ', ' + academicYear + (term ? ', Term ' + term : ' (all terms)') + ' already exists. Edit that one instead of creating a duplicate.' };
    }
    const who = (Auth.session() || {}).name || '';
    if (editingId) {
      const i = list.findIndex(s => s.id === editingId);
      if (i === -1) return { ok: false, error: 'Fee structure not found.' };
      list[i] = { ...list[i], className, academicYear, term, items, total, updatedAt: today(), updatedBy: who };
    } else {
      list.push({ id: DB.uid(), className, academicYear, term, items, total, active: true, createdAt: today(), createdBy: who });
    }
    DB.set('classFeeStructures', list);
    Audit.log(editingId ? 'fee.class.update' : 'fee.class.create',
      className + ' · ' + academicYear + (term ? ' · Term ' + term : ' · all terms') + ' = ' + money(total));
    return { ok: true };
  },

  setClassStructureActive(id, active) {
    if (!Perm.canManageFees()) return { ok: false, error: 'Only the Secretary may activate or deactivate class fee structures.' };
    const list = this.classStructures();
    const i = list.findIndex(s => s.id === id);
    if (i === -1) return { ok: false, error: 'Fee structure not found.' };
    list[i].active = !!active;
    DB.set('classFeeStructures', list);
    Audit.log('fee.class.' + (active ? 'activate' : 'deactivate'), list[i].className + ' ' + list[i].academicYear);
    return { ok: true };
  },

  removeClassStructure(id) {
    if (!Perm.canManageFees()) return { ok: false, error: 'Only the Secretary may delete class fee structures.' };
    const list = this.classStructures();
    const i = list.findIndex(s => s.id === id);
    if (i === -1) return { ok: false, error: 'Fee structure not found.' };
    const gone = list[i];
    list.splice(i, 1);
    DB.set('classFeeStructures', list);
    Audit.log('fee.class.delete', gone.className + ' ' + gone.academicYear + ' — already-billed student charges are untouched.');
    return { ok: true };
  },

  /* the structure that applies to a student: exact term first, then "all terms" */
  structureFor(className, academicYear, term) {
    const list = this.classStructures().filter(s => s.className === className && s.active !== false);
    const yr = String(academicYear == null ? '' : academicYear);
    let m = list.find(s => String(s.academicYear) === yr && String(s.term || '') === String(term == null ? '' : term));
    if (!m) m = list.find(s => String(s.academicYear) === yr && !s.term);
    return m || null;
  },
  structureTotal(className, academicYear, term) {
    const s = this.structureFor(className, academicYear, term);
    return s ? s.total : 0;
  },

  /* ---------------------------------------------------------
     LEVEL 3 — INDIVIDUAL STUDENT CHARGES + ADJUSTMENTS
     --------------------------------------------------------- */
  charges() { return DB.get('feeCharges'); },
  chargesFor(studentId) { return this.charges().filter(c => c.studentId === studentId && !c.reversed && !c.deleted); },
  chargeTotal(studentId) { return this.round2(this.chargesFor(studentId).reduce((a, c) => a + Number(c.amount || 0), 0)); },

  /* Secretary-only soft delete of one charge/adjustment. The row is kept
     (marked deleted, never removed) so the audit trail survives, and the
     student balance is recomputed from the remaining live records. */
  removeCharge(chargeId, data) {
    if (!Perm.canManageFees()) return { ok: false, error: 'Only the Secretary may delete fee charges.' };
    const charges = this.charges();
    const i = charges.findIndex(c => c.id === chargeId);
    if (i === -1) return { ok: false, error: 'Charge not found.' };
    if (charges[i].deleted) return { ok: false, error: 'This charge has already been deleted.' };
    const s = Auth.session();
    const reason = String((data && data.reason) || '').trim();
    charges[i].deleted = true;
    charges[i].deletedById = s ? s.id : '';
    charges[i].deletedBy = s ? s.name : 'system';
    charges[i].deletedByRole = s ? s.role : 'system';
    charges[i].deletedAt = new Date().toISOString();
    charges[i].deleteReason = reason;
    DB.set('feeCharges', charges);
    const bal = this.syncBalance(charges[i].studentId);
    Audit.log('fee.charge.delete', charges[i].item + ' · ' + money(charges[i].amount) +
      ' · student ' + charges[i].studentId + (reason ? ' — ' + reason : '') + ' · balance now ' + money(bal));
    if (typeof FeeNotifier !== 'undefined' && FeeNotifier.onBalanceChange) {
      try { FeeNotifier.onBalanceChange(charges[i].studentId, { trigger: 'charge_deleted', before: this.round2(bal - Number(charges[i].amount || 0)), after: bal }); } catch (e) {}
    }
    return { ok: true, charge: charges[i], balance: bal };
  },

  _addCharge(ch) {
    const s = Auth.session();
    const charges = this.charges();
    charges.push({
      id: DB.uid(), createdAt: new Date().toISOString(), reversed: false,
      createdBy: s ? s.name : 'system', createdByRole: s ? s.role : 'system', ...ch
    });
    DB.set('feeCharges', charges);
    return this.syncBalance(ch.studentId);
  },

  /* Secretary-only individual adjustment; a reason is mandatory so every
     change carries an audit trail. Positive = extra charge, negative = waiver. */
  adjust(studentId, data) {
    if (!Perm.canManageFees()) return { ok: false, error: 'Only the Secretary may adjust a student’s fees.' };
    const st = Students.get(studentId);
    if (!st) return { ok: false, error: 'Student not found.' };
    const amount = this.round2(Number(data && data.amount));
    if (!isFinite(amount) || amount === 0) return { ok: false, error: 'Enter a non-zero fee amount.' };
    const reason = String((data && data.reason) || '').trim();
    if (reason.length < 5) return { ok: false, error: 'A reason of at least 5 characters is required for every fee adjustment.' };
    const academicYear = String((data && data.academicYear) || st.academicYear || AcademicYears.activeYear());
    const term = String((data && data.term) || st.term || AcademicYears.activeTerm() || '1');
    if (!this.termsForYear(academicYear).includes(term)) {
      return { ok: false, error: 'Term ' + term + ' is not part of academic year ' + academicYear + '.' };
    }
    const label = String((data && data.item) || '').trim() || (amount > 0 ? 'Individual fee adjustment' : 'Fee waiver / concession');
    this._addCharge({
      studentId, className: st.className, academicYear, term,
      source: 'individual', item: label, amount, reason
    });
    const after = this.balanceOf(studentId);
    Audit.log('fee.adjust', st.fullName + ' · ' + (amount > 0 ? '+' : '') + money(amount) + ' · ' + label + ' · ' + termLabel(term) + ' ' + academicYear + ' — ' + reason);
    if (typeof FeeNotifier !== 'undefined' && FeeNotifier.onBalanceChange) {
      try { FeeNotifier.onBalanceChange(studentId, { trigger: 'adjustment', before: this.round2(after - amount), after, year: academicYear, term }); } catch (e) {}
    }
    return { ok: true, balance: after };
  },

  /* Bill a class fee structure to its students. Idempotent: a student who
     already carries a live charge for this structure is skipped, so
     pressing the button twice can never double-charge anyone. */
  billStructure(structureId, onlyStudentIds) {
    if (!Perm.canManageFees()) return { ok: false, error: 'Only the Secretary may bill class fees to students.' };
    const s = this.getClassStructure(structureId);
    if (!s) return { ok: false, error: 'Fee structure not found.' };
    if (s.active === false) return { ok: false, error: 'This fee structure is deactivated. Activate it before billing.' };
    const filter = Array.isArray(onlyStudentIds) ? onlyStudentIds : null;
    const targets = DB.get('students').filter(st =>
      st.className === s.className &&
      st.status !== 'archived' && st.status !== 'withdrawn' &&
      (!s.academicYear || String(st.academicYear) === String(s.academicYear) || !st.academicYear) &&
      (!filter || filter.includes(st.id))
    );
    let billed = 0, skipped = 0;
    targets.forEach(st => {
      if (this.charges().some(c => c.studentId === st.id && c.ref === s.id && !c.reversed && !c.deleted)) { skipped++; return; }
      this._addCharge({
        studentId: st.id, className: s.className, academicYear: s.academicYear, term: s.term,
        source: 'class', ref: s.id, item: s.className + ' fees' + (s.term ? ' — Term ' + s.term : ''),
        amount: s.total, reason: 'Class fee structure ' + s.academicYear + (s.term ? ', Term ' + s.term : '')
      });
      billed++;
    });
    Audit.log('fee.bill.class', s.className + ' · ' + s.academicYear + (s.term ? ' · Term ' + s.term : '') +
      ' — billed ' + billed + ' student(s) at ' + money(s.total) + (skipped ? ' (' + skipped + ' already billed, skipped)' : ''));
    return { ok: true, billed, skipped, total: s.total };
  },

  /* the charge recorded when a student is admitted with an opening balance */
  announceOpening(st) {
    if (!st || st.feeLedgerV) return;
    const students = DB.get('students');
    const i = students.findIndex(x => x.id === st.id);
    if (i === -1) return;
    students[i].feeLedgerV = 1;
    DB.set('students', students);
    const opening = this.round2(Number(st.feeBalance || 0));
    if (!opening) return;
    this._addCharge({
      studentId: st.id, className: st.className, academicYear: st.academicYear, term: st.term,
      source: 'legacy', item: 'Opening balance', amount: opening,
      reason: 'Balance carried into the fee ledger at admission.'
    });
  },

  /* ---------------------------------------------------------
     BALANCE — the single place feeBalance is ever written
     --------------------------------------------------------- */
  balanceOf(studentId) {
    const st = Students.get(studentId);
    if (!st) return 0;
    return this.round2(this.chargeTotal(studentId) - Payments.paymentTotal(st));
  },
  syncBalance(studentId) {
    const students = DB.get('students');
    const i = students.findIndex(s => s.id === studentId);
    if (i === -1) return 0;
    const bal = this.balanceOf(studentId);
    students[i].feeBalance = bal;
    DB.set('students', students);
    return bal;
  },

  /* ---------------------------------------------------------
     TERM-AWARE LEDGER
     Charges and payments are reported against the academic year
     and term they belong to. A Term 1 payment can never settle a
     Term 2 balance. Historical rows that predate the term fields
     fall back to the student's own year/term, so no stored money
     is moved or re-allocated by this code.
     --------------------------------------------------------- */
  _chargeYear(c, st) {
    return String(c.academicYear || (st && st.academicYear) || AcademicYears.activeYear());
  },
  _chargeTerm(c, st) {
    return String(c.term || (st && st.term) || AcademicYears.activeTerm() || '1');
  },
  paymentYear(p, st) {
    return String(p.academicYear || (st && st.academicYear) || AcademicYears.activeYear());
  },
  paymentTerm(p, st) {
    return String(p.term || (st && st.term) || AcademicYears.activeTerm() || '1');
  },
  /* How much of one payment belongs to a given year/term. Explicit
     allocations win; otherwise the whole payment belongs to its term. */
  paymentAllocationFor(p, st, year, term) {
    if (!p || p.reversed || p.deleted) return 0;
    if (String(this.paymentYear(p, st)) !== String(year)) return 0;
    if (Array.isArray(p.allocations) && p.allocations.length) {
      return this.round2(p.allocations
        .filter(a => String(a.term) === String(term) && String(a.academicYear || this.paymentYear(p, st)) === String(year))
        .reduce((sum, a) => sum + Number(a.amount || 0), 0));
    }
    return String(this.paymentTerm(p, st)) === String(term) ? this.round2(p.amount) : 0;
  },
  termsForYear(year) {
    try {
      const terms = AcademicYears.termsFor(year);
      return terms && terms.length ? terms.map(String) : ['1', '2', '3'];
    } catch (e) { return ['1', '2', '3']; }
  },
  termSummary(studentId, year, term) {
    const st = Students.get(studentId);
    const y = String(year || (st && st.academicYear) || AcademicYears.activeYear());
    const t = String(term || (st && st.term) || '1');
    if (!st) return { ok: false, error: 'Student not found.' };
    const charges = this.chargesFor(studentId).filter(c =>
      this._chargeYear(c, st) === y && this._chargeTerm(c, st) === t);
    const payments = Payments.forStudent(st, false).filter(p =>
      this.paymentAllocationFor(p, st, y, t) > 0);
    const charged = this.round2(charges.reduce((a, c) => a + Number(c.amount || 0), 0));
    const paid = this.round2(payments.reduce((a, p) => a + this.paymentAllocationFor(p, st, y, t), 0));
    const adjustments = this.round2(charges.filter(c => c.source === 'individual').reduce((a, c) => a + Number(c.amount || 0), 0));
    return {
      ok: true, student: st, academicYear: y, term: t,
      charged, paid, adjustments,
      balance: this.round2(charged - paid),
      charges, payments
    };
  },
  yearSummary(studentId, year) {
    const st = Students.get(studentId);
    if (!st) return { ok: false, error: 'Student not found.' };
    const y = String(year || st.academicYear || AcademicYears.activeYear());
    const terms = this.termsForYear(y).map(t => this.termSummary(studentId, y, t));
    const totalCharged = this.round2(terms.reduce((a, x) => a + x.charged, 0));
    const totalPaid = this.round2(terms.reduce((a, x) => a + x.paid, 0));
    return {
      ok: true, student: st, academicYear: y, terms,
      totalCharged, totalPaid,
      totalBalance: this.round2(totalCharged - totalPaid),
      totalOutstanding: this.balanceOf(studentId)
    };
  },
  /* Total money owed across EVERY term and academic year, never just the
     current term. This is the figure a reminder or a statement must show. */
  totalOutstanding(studentId) { return this.balanceOf(studentId); },
  openingBalance(studentId) {
    const st = Students.get(studentId);
    if (!st) return 0;
    return this.round2(this.chargesFor(studentId)
      .filter(c => c.source === 'legacy')
      .reduce((a, c) => a + Number(c.amount || 0), 0));
  },

  /* ---------------------------------------------------------
     STATEMENT / INVOICE (read-only for the account holder)
     --------------------------------------------------------- */
  statement(studentId) {
    if (!Perm.canViewStudentFee(studentId)) return { ok: false, error: 'You are not authorised to view this fee account.' };
    const st = Students.get(studentId);
    if (!st) return { ok: false, error: 'Student not found.' };
    const charges = this.chargesFor(studentId).slice().reverse();
    const payments = Payments.forStudent(st).slice().reverse();
    const summary = this.yearSummary(studentId, st.academicYear || AcademicYears.activeYear());
    return {
      ok: true, student: st,
      charges, payments,
      chargeTotal: this.chargeTotal(studentId),
      paymentTotal: Payments.paymentTotal(st),
      balance: this.balanceOf(studentId),
      openingBalance: this.openingBalance(studentId),
      terms: summary.terms,
      academicYear: summary.academicYear,
      structure: this.structureFor(st.className, st.academicYear, st.term)
    };
  },

  /* Receipt data — only a real, saved, confirmed payment can produce one. */
  receiptData(paymentId) {
    const p = Payments.get(paymentId);
    if (!p) return { ok: false, error: 'Payment not found.' };
    if (p.deleted) return { ok: false, error: 'This payment record has been deleted and cannot be receipted.' };
    if (!Perm.canViewStudentFee(p.studentId)) return { ok: false, error: 'You are not authorised to view this receipt.' };
    const st = Students.get(p.studentId) || {};
    const year = this.paymentYear(p, st);
    const term = this.paymentTerm(p, st);
    const ts = this.termSummary(st.id, year, term);
    const amount = this.round2(p.amount);
    const stamp = new Date(p.recordedAt || p.createdAt || p.date || 0).getTime();
    /* balance immediately before this payment, in recording order */
    const paidBefore = this.round2(Payments.forStudent(st, false)
      .filter(x => x.id !== p.id && this.paymentAllocationFor(x, st, year, term) > 0)
      .filter(x => {
        const t2 = new Date(x.recordedAt || x.createdAt || x.date || 0).getTime();
        return t2 < stamp || (t2 === stamp && String(x.id) < String(p.id));
      })
      .reduce((a, x) => a + this.paymentAllocationFor(x, st, year, term), 0));
    const previousBalance = this.round2(ts.charged - paidBefore);
    return {
      ok: true, payment: p, student: st, academicYear: year, term,
      termCharged: ts.charged,
      termPaid: ts.paid,
      previousBalance,
      amount,
      remainingAfter: this.round2(previousBalance - amount),
      currentTermBalance: ts.balance,
      totalOutstanding: this.balanceOf(st.id),
      actualPaymentDate: p.paymentDate || p.date,
      systemRecordedDate: Payments.systemDateOf(p),
      systemRecordedTime: Payments.systemTimeOf(p),
      status: p.reversed ? 'Reversed' : 'Confirmed',
      verifyRef: p.verifyRef || Payments.verifyRef(p)
    };
  },

  receiptModel(r, logoUrl) {
    const p = r.payment, st = r.student;
    const school = DB.get('settings', {});
    const contact = [school.phone ? 'Tel: ' + school.phone : '', school.email || ''].filter(Boolean).join(' · ');
    return {
      schoolName: school.schoolName || 'St. Teresa Kanyange Academy',
      address: school.address || '',
      contact,
      motto: school.motto || 'Unity is Strength',
      currency: school.currency || 'KSh',
      logo: logoUrl || assetURL('../images/favicon.svg'),
      receiptNo: p.receiptNo || '—',
      status: r.status,
      reversed: !!p.reversed,
      studentName: st.fullName || p.studentName || '—',
      admissionNo: st.admissionNo || '—',
      className: st.className || st.grade || '—',
      academicYear: r.academicYear,
      term: termLabel(r.term),
      paymentDate: fmtDate(r.actualPaymentDate),
      systemDate: fmtDate(r.systemRecordedDate) + (r.systemRecordedTime ? ' ' + r.systemRecordedTime : ''),
      method: p.method || '—',
      reference: p.reference || '',
      recordedBy: p.recordedByName || p.recordedBy || '—',
      verifyRef: r.verifyRef || '—',
      amount: r.amount,
      previousBalance: r.previousBalance,
      termCharged: r.termCharged,
      termPaid: r.termPaid,
      outstanding: r.totalOutstanding,
      generated: new Date().toLocaleString()
    };
  },

  receiptBodyHTML(r, logoUrl) {
    const m = this.receiptModel(r, logoUrl);
    const row = (label, value) => `<tr><th>${esc(label)}</th><td>${esc(value)}</td></tr>`;
    return `
      <div class="rcpt">
        <div class="rcpt-head">
          <img class="rcpt-logo" src="${esc(m.logo)}" alt="School logo">
          <div class="rcpt-brand">
            <div class="rcpt-school">${esc(m.schoolName)}</div>
            ${m.address ? `<div class="rcpt-contact">${esc(m.address)}</div>` : ''}
            ${m.contact ? `<div class="rcpt-contact">${esc(m.contact)}</div>` : ''}
            <div class="rcpt-motto">${esc(m.motto)}</div>
          </div>
        </div>
        <div class="rcpt-titlerow">
          <div class="rcpt-title">FEE PAYMENT RECEIPT</div>
          <div class="rcpt-receiptno">Receipt No. <strong>${esc(m.receiptNo)}</strong>
            <div class="rcpt-status${m.reversed ? ' is-reversed' : ''}">${esc(m.status)}</div>
          </div>
        </div>
        <table class="rcpt-details">
          <tbody>
            ${row('Student', m.studentName)}
            ${row('Admission No.', m.admissionNo)}
            ${row('Class', m.className)}
            ${row('Academic Year / Term', m.academicYear + ' · ' + m.term)}
            ${row('Actual Payment Date', m.paymentDate)}
            ${row('System Recording Date', m.systemDate)}
            ${row('Payment Method', m.method + (m.reference ? ' · Ref: ' + m.reference : ''))}
          </tbody>
        </table>
        <table class="rcpt-fees">
          <thead><tr><th>Description</th><th class="num">Amount (${esc(m.currency)})</th></tr></thead>
          <tbody>
            <tr><td>Balance Brought Forward</td><td class="num">${money(m.previousBalance)}</td></tr>
            <tr><td>Total Fees Charged</td><td class="num">${money(m.termCharged)}</td></tr>
            <tr class="is-paid"><td>Amount Paid This Payment</td><td class="num">${money(m.amount)}</td></tr>
            <tr><td>Total Amount Paid (This Term)</td><td class="num">${money(m.termPaid)}</td></tr>
            <tr class="is-total"><td>Outstanding Balance (All Terms)</td><td class="num">${money(m.outstanding)}</td></tr>
          </tbody>
        </table>
        <div class="rcpt-foot">
          <div class="rcpt-confirm">${m.reversed ? 'This payment has been reversed.' : 'Payment received with thanks. This is a system-generated receipt.'}</div>
          <div class="rcpt-meta">Receipt generated: ${esc(m.generated)} · Verification ref: ${esc(m.verifyRef)}</div>
          <div class="rcpt-sign">
            <div class="rcpt-sigline"></div>
            <div class="rcpt-siglabel">Authorized Finance Office</div>
          </div>
          <div class="rcpt-note">Actual payment date is when money was received; system recording date is when it was entered. Keep this receipt for your records.</div>
        </div>
      </div>`;
  },

  receiptHTML(paymentId, logoUrl) {
    const r = this.receiptData(paymentId);
    if (!r.ok) { toast(r.error, 'error'); return ''; }
    return `<style>${receiptCSS(false)}</style>` + this.receiptBodyHTML(r, logoUrl);
  },

  printReceipt(paymentId) {
    printReceiptSheet('Fee Payment Receipt', logo => {
      const r = this.receiptData(paymentId);
      if (!r.ok) return '';
      return this.receiptBodyHTML(r, logo);
    });
  },

  receiptPDF(paymentId, opts) {
    const r = this.receiptData(paymentId);
    if (!r.ok) return null;
    return PDFDoc.buildA6Receipt(this.receiptModel(r), opts && opts.logo);
  },

  invoiceHTML(studentId, logoUrl) {
    const s = this.statement(studentId);
    if (!s.ok) { toast(s.error, 'error'); return ''; }
    const st = s.student;
    const generated = new Date();
    const bf = s.openingBalance;
    /* Legacy opening charges are presented as the B/F line, not repeated as
       a term charge. Payments and the overall balance still include them. */
    const legacyByTerm = {};
    s.charges.forEach(c => {
      if (c.source !== 'legacy') return;
      const k = this._chargeYear(c, st) + '|' + this._chargeTerm(c, st);
      legacyByTerm[k] = this.round2((legacyByTerm[k] || 0) + Number(c.amount || 0));
    });
    const termRows = s.terms.map(t => {
      const legacy = legacyByTerm[t.academicYear + '|' + t.term] || 0;
      return `
      <tr>
        <td>${esc(t.termLabel || termLabel(t.term))}</td>
        <td style="text-align:right">${money(this.round2(t.charged - legacy))}</td>
        <td style="text-align:right">${money(Math.abs(t.adjustments))}</td>
        <td style="text-align:right">${money(t.paid)}</td>
        <td style="text-align:right"><strong>${money(this.round2(t.balance - legacy))}</strong></td>
      </tr>`;
    }).join('');
    const tx = [];
    s.charges.forEach(c => {
      if (c.source === 'legacy') return;
      tx.push({ ts: new Date(c.createdAt || 0).getTime(), actual: c.createdAt, system: c.createdAt, receipt: '—',
        desc: c.item, remarks: c.reason || c.source || '', year: this._chargeYear(c, st), term: this._chargeTerm(c, st),
        charge: Number(c.amount || 0) || 0, payment: 0 });
    });
    s.payments.forEach(p => {
      const alloc = Array.isArray(p.allocations) && p.allocations.length
        ? p.allocations.map(a => termLabel(a.term) + ' ' + money(a.amount)).join(', ')
        : termLabel(this.paymentTerm(p, st));
      tx.push({ ts: new Date(p.recordedAt || p.createdAt || p.date || 0).getTime(),
        actual: p.paymentDate || p.date, system: Payments.systemDateOf(p),
        receipt: p.receiptNo, desc: 'Payment received — ' + (p.item || 'Fees'),
        remarks: (p.reference ? 'Ref: ' + p.reference + ' · ' : '') + (p.method || '') + ' · Allocation: ' + alloc,
        year: this.paymentYear(p, st), term: this.paymentTerm(p, st),
        charge: 0, payment: Number(p.amount || 0) || 0, reversed: !!p.reversed });
    });
    tx.sort((a, b) => a.ts - b.ts);
    let run = bf;
    const rows = tx.map(t => {
      run = this.round2(run + t.charge - (t.reversed ? 0 : t.payment));
      return `<tr${t.reversed ? ' style="opacity:.55"' : ''}>
        <td>${esc(fmtDate(t.actual))}</td>
        <td>${esc(fmtDate(t.system))}</td>
        <td>${esc(t.receipt)}</td>
        <td>${esc(t.desc)}${t.reversed ? ' (reversed)' : ''}</td>
        <td>${esc(t.year)} · ${esc(termLabel(t.term))}</td>
        <td>${esc(t.remarks || '—')}</td>
        <td style="text-align:right">${t.charge ? money(t.charge) : '—'}</td>
        <td style="text-align:right">${t.payment && !t.reversed ? money(t.payment) : (t.reversed ? money(0) : '—')}</td>
        <td style="text-align:right"><strong>${money(run)}</strong></td>
      </tr>`;
    }).join('');
    return `
      ${schoolBrandHTML(logoUrl)}
      <div class="meta">
        Student: <strong>${esc(st.fullName)}</strong> · Admission No: <strong>${esc(st.admissionNo || '—')}</strong>
        · Category: <strong>${esc(st.category || 'Day Scholar')}</strong><br>
        Class: <strong>${esc(st.className || st.grade || '—')}</strong> · Academic Year: <strong>${esc(s.academicYear)}</strong>
        · Current Term: <strong>${esc(st.term || '—')}</strong><br>
        Opening balance B/F: <strong>${money(bf)}</strong> · Statement generated: <strong>${esc(generated.toLocaleString())}</strong>
        ${st.guardian2Name ? '<br>Second Parent/Guardian: <strong>' + esc(st.guardian2Name) + '</strong>' + (st.guardian2Phone ? ' · ' + esc(st.guardian2Phone) : '') : ''}
      </div>
      <h2>Fee Statement — Term by Term</h2>
      <table>
        <thead><tr><th>Term</th><th style="text-align:right">Fees Charged</th><th style="text-align:right">Adjustments</th><th style="text-align:right">Payments Received</th><th style="text-align:right">Balance</th></tr></thead>
        <tbody>${termRows || `<tr><td colspan="5" style="text-align:center">No terms configured.</td></tr>`}</tbody>
        <tfoot>
          <tr><th>Totals</th><th style="text-align:right">${money(bf + s.terms.reduce((a, t) => a + t.charged - (legacyByTerm[t.academicYear + '|' + t.term] || 0), 0))}</th><th style="text-align:right">${money(s.terms.reduce((a, t) => a + Math.abs(t.adjustments), 0))}</th><th style="text-align:right">${money(s.terms.reduce((a, t) => a + t.paid, 0))}</th><th style="text-align:right">${money(s.balance)}</th></tr>
        </tfoot>
      </table>
      <h2>Transaction History</h2>
      <table>
        <thead><tr><th>Actual Date</th><th>System Date</th><th>Receipt No.</th><th>Description</th><th>Year / Term</th><th>Remarks</th><th style="text-align:right">Charges</th><th style="text-align:right">Payments</th><th style="text-align:right">Balance</th></tr></thead>
        <tbody>
          <tr><td>—</td><td>—</td><td>—</td><td><strong>Balance Brought Forward (B/F)</strong></td><td>—</td><td>Opening balance</td><td style="text-align:right">—</td><td style="text-align:right">—</td><td style="text-align:right"><strong>${money(bf)}</strong></td></tr>
          ${rows || '<tr><td colspan="9" style="text-align:center">No transactions recorded yet.</td></tr>'}
        </tbody>
        <tfoot>
          <tr><th colspan="6">Totals</th><th style="text-align:right">${money(bf + this.round2(tx.reduce((a, t) => a + t.charge, 0)))}</th><th style="text-align:right">${money(this.round2(tx.reduce((a, t) => a + (t.reversed ? 0 : t.payment), 0)))}</th><th style="text-align:right">${money(s.balance)}</th></tr>
        </tfoot>
      </table>
      <h2>Total outstanding across all terms: ${money(s.balance)}</h2>
      <p style="font-size:0.82rem">The balance shown for a term is that term's own balance. The total outstanding is the sum of every term and any opening balance. Remarks: ${esc(st.remarks || 'No additional remarks.')} · Generated ${esc(generated.toLocaleString())}.</p>`;
  },

  printInvoice(studentId) {
    printHTMLWithLogo('Fee Statement / Invoice', logo => this.invoiceHTML(studentId, logo), { hideHeading: true });
  },

  /* Bulk invoice for every active student in a class structure. */
  classInvoiceHTML(structureId, logoUrl) {
    if (!Perm.canManageFees()) { toast('Only the Secretary may print class invoices.', 'error'); return ''; }
    const s = this.getClassStructure(structureId);
    if (!s) { toast('Fee structure not found.', 'error'); return ''; }
    const generated = new Date();
    const students = DB.get('students').filter(st =>
      st.className === s.className &&
      st.status !== 'archived' && st.status !== 'withdrawn' && st.status !== 'transferred_out' &&
      (!s.academicYear || String(st.academicYear) === String(s.academicYear) || !st.academicYear)
    );
    let totals = { charges: 0, paid: 0, balance: 0 };
    const rows = students.map(st => {
      const charges = this.chargeTotal(st.id);
      const paid = Payments.paymentTotal(st);
      const balance = this.balanceOf(st.id);
      totals.charges = this.round2(totals.charges + charges);
      totals.paid = this.round2(totals.paid + paid);
      totals.balance = this.round2(totals.balance + balance);
      return `<tr>
        <td>${esc(st.admissionNo || '—')}</td>
        <td>${esc(st.fullName)}</td>
        <td>${esc(st.category || '—')}</td>
        <td style="text-align:right">${money(charges)}</td>
        <td style="text-align:right">${money(paid)}</td>
        <td style="text-align:right"><strong>${money(balance)}</strong></td>
      </tr>`;
    }).join('');
    return `
      ${schoolBrandHTML(logoUrl)}
      <div class="meta">
        Class: <strong>${esc(s.className)}</strong> · Academic Year: <strong>${esc(s.academicYear)}</strong> · Term: <strong>${s.term ? 'Term ' + esc(s.term) : 'All terms'}</strong><br>
        Fee structure total: <strong>${money(s.total)}</strong> · Students billed: <strong>${students.length}</strong><br>
        System date: <strong>${esc(generated.toLocaleString())}</strong>
      </div>
      <h2>Class Invoice — ${esc(s.className)}</h2>
      <table>
        <thead><tr><th>Admission No.</th><th>Student</th><th>Category</th><th style="text-align:right">Charges</th><th style="text-align:right">Paid</th><th style="text-align:right">Balance</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="6" style="text-align:center">No active students in this class.</td></tr>'}</tbody>
        <tfoot><tr><th colspan="3">Totals</th><th style="text-align:right">${money(totals.charges)}</th><th style="text-align:right">${money(totals.paid)}</th><th style="text-align:right">${money(totals.balance)}</th></tr></tfoot>
      </table>
      <p style="font-size:0.82rem">Generated automatically on ${esc(generated.toLocaleString())}.</p>`;
  },

  printClassInvoices(structureId) {
    printHTMLWithLogo('Class Invoices', logo => this.classInvoiceHTML(structureId, logo), { hideHeading: true });
  },

  /* real, dependency-free PDF download of the same statement */
  async downloadInvoice(studentId) {
    const s = this.statement(studentId);
    if (!s.ok) { toast(s.error, 'error'); return; }
    const st = s.student;
    const school = DB.get('settings', {});
    const logo = await logoForPDF();
    const bf = s.openingBalance;
    const legacyByTerm = {};
    s.charges.forEach(c => {
      if (c.source !== 'legacy') return;
      const k = this._chargeYear(c, st) + '|' + this._chargeTerm(c, st);
      legacyByTerm[k] = this.round2((legacyByTerm[k] || 0) + Number(c.amount || 0));
    });
    const rows = [
      ['FEE STATEMENT', 17, true],
      [school.schoolName || 'St. Teresa Academy', 11, false],
      [school.address || school.motto || 'Unity is Strength', 9, false],
      ['', 9, false],
      ['Student: ' + st.fullName, 11, true],
      ['Admission No: ' + (st.admissionNo || '-') + '   Class: ' + (st.className || st.grade || '-') + '   Category: ' + (st.category || 'Day Scholar'), 10, false],
      ['Academic Year: ' + (s.academicYear || '-') + '   Current Term: ' + (st.term || '-'), 10, false],
      ['Opening balance B/F: ' + money(bf) + '   Generated: ' + new Date().toLocaleString(), 9, false],
      ['', 8, false],
      ['TERM-BY-TERM SUMMARY', 12, true],
      ['Term        Charged          Adjustments      Paid             Balance', 9, true]
    ];
    s.terms.forEach(t => {
      const legacy = legacyByTerm[t.academicYear + '|' + t.term] || 0;
      rows.push([pad(termLabel(t.term), 12) + pad(money(this.round2(t.charged - legacy)), 17) + pad(money(Math.abs(t.adjustments)), 17) + pad(money(t.paid), 17) + money(this.round2(t.balance - legacy)), 9, false]);
    });
    rows.push(['Total outstanding (all terms): ' + money(s.balance), 11, true], ['', 8, false],
      ['TRANSACTION HISTORY (actual payment date vs system recording date)', 11, true],
      ['Actual      System      Receipt       Description                 Term  Charges        Payments', 8, true]);
    const tx = [];
    s.charges.forEach(c => { if (c.source === 'legacy') return; tx.push({ ts: new Date(c.createdAt || 0).getTime(), actual: c.createdAt, system: c.createdAt, receipt: '-', desc: c.item, term: this._chargeTerm(c, st), charge: Number(c.amount || 0), payment: 0 }); });
    s.payments.forEach(p => tx.push({ ts: new Date(p.recordedAt || p.createdAt || p.date || 0).getTime(), actual: p.paymentDate || p.date, system: Payments.systemDateOf(p), receipt: p.receiptNo, desc: (p.item || 'Fees') + (p.reversed ? ' (reversed)' : ''), term: this.paymentTerm(p, st), charge: 0, payment: p.reversed ? 0 : Number(p.amount || 0) }));
    tx.sort((a, b) => a.ts - b.ts);
    if (!tx.length) rows.push(['No transactions recorded yet.', 9, false]);
    tx.forEach(t => rows.push([
      pad(fmtDate(t.actual), 12) + pad(fmtDate(t.system), 12) + pad(String(t.receipt), 14) + pad(String(t.desc).slice(0, 28), 28) + pad(termLabel(t.term), 6) + pad(t.charge ? money(t.charge) : '-', 15) + (t.payment ? money(t.payment) : '-'), 8, false
    ]));
    rows.push(['', 8, false], ['BALANCE DUE: ' + money(s.balance), 14, true],
      ['Generated ' + new Date().toLocaleString() + ' - ' + (school.schoolName || 'St. Teresa Academy'), 8, false]);
    downloadPDFFile('Fee-Statement-' + String(st.admissionNo || st.id).replace(/[^A-Za-z0-9-]/g, '') + '.pdf',
      PDFDoc.build(rows, { logo }), 'application/pdf');
    Audit.log('fee.statement.download', st.fullName + ' (' + (st.admissionNo || st.id) + ') balance ' + money(s.balance));
  },

  /* ---------------------------------------------------------
     MIGRATION — runs once, touches no stored balance
     --------------------------------------------------------- */
  migrate() {
    const ensure = (key, fallback) => { if (!localStorage.getItem('sta_' + key)) DB.set(key, fallback); };
    /* (1) School fee catalogue seeded ONCE from the old hard-coded list.
           Catalogue rows only — a student's balance is never written here,
           so converting FEE_ITEMS cannot double-charge anybody. */
    ensure('feeItems', this.DEFAULT_ITEMS.map(i => ({ ...i, active: true, createdAt: today(), createdBy: 'migration' })));
    ensure('classFeeStructures', []);
    ensure('feeCharges', []);
    ensure('messageLog', []);

    /* (2) Attach legacy payments to their student by name (all fields kept).
           Add the missing term fields WITHOUT moving any money: a legacy
           payment is assigned to its student's own year/term. */
    const students = DB.get('students');
    const payments = DB.get('payments');
    let pChanged = false;
    payments.forEach(p => {
      if (!p.studentId) {
        const want = String(p.studentName || '').trim().toLowerCase();
        if (want) {
          const hits = students.filter(st => String(st.fullName || (st.firstName + ' ' + st.lastName)).trim().toLowerCase() === want);
          if (hits.length === 1) { p.studentId = hits[0].id; pChanged = true; }
        }
      }
      const st = students.find(x => x.id === p.studentId);
      if (st && !p.academicYear) { p.academicYear = String(st.academicYear || AcademicYears.activeYear()); pChanged = true; }
      if (st && !p.term) { p.term = String(st.term || AcademicYears.activeTerm() || '1'); pChanged = true; }
      if (!p.paymentDate) { p.paymentDate = p.date || ''; pChanged = true; }
      if (!p.recordedAt && p.date) { p.recordedAt = String(p.date) + 'T12:00:00.000Z'; pChanged = true; }
      if (!p.systemRecordedDate) { p.systemRecordedDate = p.date || String(p.recordedAt || '').slice(0, 10); pChanged = true; }
      if (!p.status) { p.status = p.reversed ? 'reversed' : 'confirmed'; pChanged = true; }
    });
    if (pChanged) DB.set('payments', payments);

    /* Legacy charges get their student's year/term so the term report can
       show them, without changing the amount charged. */
    const legacyCharges = DB.get('feeCharges');
    let cChanged = false;
    legacyCharges.forEach(c => {
      const st = students.find(x => x.id === c.studentId);
      if (!st) return;
      if (!c.academicYear) { c.academicYear = String(st.academicYear || AcademicYears.activeYear()); cChanged = true; }
      if (!c.term) { c.term = String(st.term || AcademicYears.activeTerm() || '1'); cChanged = true; }
    });
    if (cChanged) DB.set('feeCharges', legacyCharges);

    /* (3) One opening charge per student so that
           charges - payments reproduces the PRE-EXISTING feeBalance exactly. */
    let sChanged = false;
    const studentsNow = DB.get('students');
    studentsNow.forEach(st => {
      if (st.feeLedgerV) return;
      const paid = Payments.paymentTotal(st);
      const opening = this.round2(Number(st.feeBalance || 0) + paid);
      if (opening !== 0) {
        const s = Auth.session();
        const charges = DB.get('feeCharges');
        charges.push({
          id: DB.uid(), studentId: st.id, className: st.className, academicYear: st.academicYear, term: st.term,
          source: 'legacy', item: 'Opening balance brought forward', amount: opening,
          reason: 'Migrated from the pre-existing fee balance — no balance was reset or re-charged.',
          createdAt: new Date().toISOString(), reversed: false,
          createdBy: 'migration', createdByRole: s ? s.role : 'system'
        });
        DB.set('feeCharges', charges);
      }
      studentsNow[studentsNow.findIndex(x => x.id === st.id)].feeLedgerV = 1;
      sChanged = true;
    });
    if (sChanged) DB.set('students', studentsNow);
  }
};

/* ---------- PAD helper used by the PDF invoice ---------- */
function pad(s, n) { s = String(s == null ? '' : s); return s.length >= n ? s.slice(0, n - 1) + ' ' : s + ' '.repeat(n - s.length); }

/* ============================================================
   PAYMENTS — ONLY the Secretary may record, correct or reverse.
   Duplicate submissions are rejected by client token, and every
   payment is stamped with the staff account that recorded it.
   ============================================================ */
const Payments = {
  list() { return DB.get('payments'); },
  get(id) { return this.list().find(p => p.id === id) || null; },
  /* All payments that belong to a student. Deleted rows are always hidden
     (soft-deleted records stay in storage for the audit trail). Reversed rows
     are included by default so history/invoices can still show them, but they
     never count towards the amount paid. Pass includeReversed=false to hide. */
  forStudent(st, includeReversed = true) {
    if (!st) return [];
    const name = String(st.fullName || (st.firstName + ' ' + st.lastName) || '').trim().toLowerCase();
    return this.list().filter(p =>
      (p.studentId === st.id || (!p.studentId && String(p.studentName || '').trim().toLowerCase() === name)) &&
      !p.deleted &&
      (includeReversed || !p.reversed));
  },
  paymentTotal(st) { return Fees.round2(this.forStudent(st, false).reduce((a, p) => a + Number(p.amount || 0), 0)); },
  /* Outstanding balance (total fees charged minus everything actually paid). */
  balanceFor(st) {
    if (typeof Fees !== 'undefined' && Fees.balanceOf) return Fees.balanceOf(st.id);
    const charges = (typeof Fees !== 'undefined' && Fees.chargeTotal) ? Fees.chargeTotal(st.id) : Number(st.feeBalance || 0);
    return Fees.round2(charges - this.paymentTotal(st));
  },
  /* Human status shown next to the balance. Never says "Fully Paid" unless
     the outstanding balance really is zero. */
  statusOf(st) {
    const charges = (typeof Fees !== 'undefined' && Fees.chargeTotal) ? Fees.chargeTotal(st.id) : Number(st.feeBalance || 0);
    const paid = this.paymentTotal(st);
    const bal = this.balanceFor(st);
    if (bal <= 0.009) return charges > 0 ? 'Fully Paid' : (paid > 0 ? 'Fully Paid' : 'No Fees Due');
    return paid > 0 ? 'Partially Paid' : 'Unpaid';
  },
  statusClass(st) {
    const s = this.statusOf(st);
    return s === 'Fully Paid' ? 'success' : s === 'Partially Paid' ? 'warning' : s === 'Unpaid' ? 'danger' : 'navy';
  },
  METHODS: ['Cash', 'M-Pesa', 'KCB Bank', 'Equity Bank', 'Family Bank', 'Bank Transfer', 'Cheque', 'Card'],
  nextReceiptNo() {
    const nums = this.list()
      .map(p => /^RCP-(\d+)$/.exec(String(p.receiptNo || '')))
      .filter(Boolean).map(m => parseInt(m[1], 10));
    let n = (nums.length ? Math.max.apply(null, nums) : 1000) + 1;
    let no = 'RCP-' + n;
    while (this.list().some(p => p.receiptNo === no)) { n++; no = 'RCP-' + n; }
    return no;
  },
  /* The system recording date is derived from the immutable recordedAt
     stamp in the school timezone. It is never taken from the form. */
  systemDateOf(p) {
    if (!p) return '';
    if (p.systemRecordedDate) return p.systemRecordedDate;
    if (!p.recordedAt) return p.date || '';
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: schoolTimeZone(), year: 'numeric', month: '2-digit', day: '2-digit'
      }).format(new Date(p.recordedAt));
    } catch (e) { return String(p.recordedAt).slice(0, 10); }
  },
  systemTimeOf(p) {
    if (!p) return '';
    if (p.systemRecordedTime) return p.systemRecordedTime;
    if (!p.recordedAt) return '';
    try {
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: schoolTimeZone(), hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      }).format(new Date(p.recordedAt));
    } catch (e) { return String(p.recordedAt).slice(11, 19); }
  },
  verifyRef(p) {
    const base = String((p && (p.receiptNo || p.id)) || '') + '|' + String((p && p.recordedAt) || '') + '|' + String((p && p.amount) || '');
    let h = 0;
    for (let i = 0; i < base.length; i++) { h = ((h << 5) - h + base.charCodeAt(i)) | 0; }
    return 'STA-' + (h >>> 0).toString(36).toUpperCase().padStart(6, '0');
  },
  _referenceRequired(method) {
    try {
      const cfg = (typeof NotificationConfig !== 'undefined') ? NotificationConfig.get() : DB.get('notificationSettings', {});
      if (!cfg || cfg.requireReference === false) return false;
      return !!(cfg.requireReference && /mpesa|m-pesa|bank|cheque|card/i.test(String(method || '')));
    } catch (e) { return false; }
  },
  _transaction(fn) {
    const paySnap = JSON.stringify(DB.get('payments'));
    const stuSnap = JSON.stringify(DB.get('students'));
    try { return fn(); }
    catch (e) {
      try { DB.set('payments', JSON.parse(paySnap)); DB.set('students', JSON.parse(stuSnap)); } catch (e2) {}
      return { ok: false, error: 'The payment could not be saved. Nothing was changed. ' + (e && e.message ? e.message : '') };
    }
  },

  record(data) {
    if (!Perm.canRecordPayments()) return { ok: false, error: 'Only the Secretary may record payments.' };
    const s = Auth.session();
    const st = Students.get(data && data.studentId);
    if (!st) return { ok: false, error: 'Student not found.' };
    const d = data || {};
    /* ---- authoritative clock: the browser cannot supply this ---- */
    const now = schoolNow();
    const amount = Fees.round2(Number(d.amount));
    if (!isFinite(amount) || amount <= 0) return { ok: false, error: 'Payment amount must be greater than zero.' };
    /* ---- actual payment date: chosen by the Secretary, today or earlier ---- */
    const payDate = String(d.paymentDate || d.actualPaymentDate || '').trim() || now.date;
    if (!isIsoDate(payDate)) return { ok: false, error: 'Enter a valid actual payment date (YYYY-MM-DD).' };
    if (payDate > now.date) return { ok: false, error: 'The actual payment date cannot be in the future. Use ' + now.date + ' or an earlier date.' };
    /* ---- academic year + term are mandatory ---- */
    const rawYear = String(d.academicYear || st.academicYear || AcademicYears.activeYear()).trim();
    /* A payment may legitimately be recorded against a completed (inactive)
       academic year, so require a CONFIGURED year rather than an active one. */
    if (!rawYear) return { ok: false, error: 'Academic year is required.' };
    if (!AcademicYears.byLabel(rawYear)) {
      return { ok: false, error: 'Academic year ' + rawYear + ' is not configured. An administrator must add it under Academic Settings before fees can be recorded against it.' };
    }
    const term = String(d.term || st.term || AcademicYears.activeTerm()).trim();
    const allowedTerms = AcademicYears.termsFor(rawYear).map(String);
    if (!allowedTerms.includes(term)) {
      return { ok: false, error: 'Term ' + term + ' is not configured for ' + rawYear + '. Choose one of: ' + allowedTerms.map(t => 'Term ' + t).join(', ') + '.' };
    }
    /* ---- allocations: a payment may cover more than one term, but the
       Secretary must say how it is split and the parts must add up ---- */
    let allocations = null;
    if (Array.isArray(d.allocations) && d.allocations.length) {
      allocations = [];
      let sum = 0;
      for (const a of d.allocations) {
        const at = String((a && a.term) || '').trim();
        const av = Fees.round2(Number(a && a.amount));
        if (!allowedTerms.includes(at)) return { ok: false, error: 'Invalid allocation term "' + at + '".' };
        if (!isFinite(av) || av <= 0) return { ok: false, error: 'Every term allocation must be greater than zero.' };
        allocations.push({ academicYear: rawYear, term: at, amount: av });
        sum += av;
      }
      if (Math.abs(Fees.round2(sum) - amount) > 0.009) {
        return { ok: false, error: 'The term allocations add up to ' + money(sum) + ' but the payment is ' + money(amount) + '. They must match exactly.' };
      }
      /* Every part must settle that term's own balance. A Term 1 payment can
         never be used to clear a Term 2 debt (or vice versa). */
      for (const a of allocations) {
        const ts = Fees.termSummary(st.id, rawYear, a.term);
        if (!ts.ok) return { ok: false, error: ts.error };
        if (a.amount > ts.balance + 0.009) {
          return { ok: false, error: 'The ' + money(a.amount) + ' allocated to ' + termLabel(a.term) + ' is more than that term\'s outstanding balance of ' + money(ts.balance < 0 ? 0 : ts.balance) + '. A payment cannot settle another term\'s fees.' };
        }
      }
    } else {
      /* No explicit split: the whole payment belongs to the chosen term, so it
         must not exceed that term's balance. */
      const ts = Fees.termSummary(st.id, rawYear, term);
      if (!ts.ok) return { ok: false, error: ts.error };
      if (amount > ts.balance + 0.009) {
        return { ok: false, error: 'That is more than ' + termLabel(term) + '\'s outstanding balance of ' + money(ts.balance < 0 ? 0 : ts.balance) + '. Choose the correct term or split the payment across terms (overpayments are not allowed).' };
      }
    }
    /* ---- overpayments are never silently accepted ---- */
    if (!d.allowOverpay) {
      const owed = this.balanceFor(st);
      if (amount > owed + 0.009) {
        return { ok: false, error: 'That is more than the outstanding balance of ' + money(owed < 0 ? 0 : owed) + '. Enter ' + money(owed < 0 ? 0 : owed) + ' or less (overpayments are not allowed).' };
      }
    }
    const token = String(d.clientToken || '').trim();
    if (!token) return { ok: false, error: 'Missing payment token — reload the page and try again.' };
    const all = this.list();
    if (all.some(p => p.clientToken && p.clientToken === token)) {
      return { ok: false, error: 'This payment has already been recorded (duplicate submission rejected).' };
    }
    const method = String(d.method || 'Cash').trim() || 'Cash';
    const item = String(d.item || 'Fee payment').trim() || 'Fee payment';
    const reference = String(d.reference || '').trim();
    if (this._referenceRequired(method) && !reference) {
      return { ok: false, error: 'A transaction reference is required for ' + method + ' payments.' };
    }
    if (reference) {
      const dupRef = all.find(p => !p.deleted && !p.reversed &&
        String(p.reference || '').trim().toLowerCase() === reference.toLowerCase() &&
        String(p.method || '').toLowerCase() === method.toLowerCase());
      if (dupRef) return { ok: false, error: 'Reference ' + reference + ' has already been used for ' + method + ' payment ' + dupRef.receiptNo + '.' };
    }

    const result = this._transaction(() => {
      const rec = {
        id: DB.uid(), receiptNo: this.nextReceiptNo(),
        studentId: st.id, studentName: st.fullName || (st.firstName + ' ' + st.lastName),
        item, amount, method,
        date: payDate, paymentDate: payDate,
        academicYear: rawYear, term: term,
        allocations: allocations || [{ academicYear: rawYear, term: term, amount }],
        reference: reference,
        recordedById: s.id, recordedByName: s.name, recordedByRole: s.role,
        recordedBy: s.role,
        recordedAt: now.iso, systemRecordedDate: now.date, systemRecordedTime: now.time,
        timezone: now.timeZone,
        dateHistory: [{ at: now.iso, byId: s.id, byName: s.name, from: payDate, to: payDate, reason: 'Initial recording', initial: true }],
        status: 'confirmed', reversed: false, deleted: false,
        clientToken: token
      };
      rec.verifyRef = this.verifyRef(rec);
      const list = this.list();
      list.push(rec);
      DB.set('payments', list);
      const balance = Fees.syncBalance(st.id);
      Audit.log('payment.record', rec.receiptNo + ' · ' + rec.studentName + ' · ' + money(amount) +
        ' · actual ' + payDate + ' · recorded ' + now.date + ' ' + now.time + ' (' + now.timeZone + ')' +
        ' · ' + method + (reference ? ' · ref ' + reference : '') + ' · term ' + term + ' ' + rawYear + ' · balance now ' + money(balance));
      if (typeof FeeNotifier !== 'undefined' && FeeNotifier.onBalanceChange) {
        try {
          FeeNotifier.onBalanceChange(st.id, { trigger: 'payment', before: Fees.round2(balance + amount), after: balance, paymentId: rec.id, year: rawYear, term });
        } catch (e) { console.error('Fee notification skipped:', e); }
      }
      return { ok: true, payment: rec, balance, student: Students.get(st.id), status: this.statusOf(st) };
    });
    return result;
  },

  /* Authorised correction of the ACTUAL payment date. The original
     recording timestamp is never touched; who/when/why is appended. */
  correctDate(paymentId, data) {
    if (!Perm.canRecordPayments()) return { ok: false, error: 'Only the Secretary may correct a payment date.' };
    const newDate = String((data && data.paymentDate) || '').trim();
    const reason = String((data && data.reason) || '').trim();
    if (!isIsoDate(newDate)) return { ok: false, error: 'Enter a valid actual payment date (YYYY-MM-DD).' };
    if (reason.length < 5) return { ok: false, error: 'A reason of at least 5 characters is required to correct a payment date.' };
    const now = schoolNow();
    if (newDate > now.date) return { ok: false, error: 'The actual payment date cannot be in the future.' };
    const all = this.list();
    const i = all.findIndex(p => p.id === paymentId);
    if (i === -1) return { ok: false, error: 'Payment not found.' };
    if (all[i].deleted) return { ok: false, error: 'This payment has been deleted.' };
    const s = Auth.session();
    const from = all[i].paymentDate || all[i].date;
    if (String(from) === newDate) return { ok: false, error: 'The payment already has that actual date.' };
    all[i].dateHistory = Array.isArray(all[i].dateHistory) ? all[i].dateHistory : [];
    all[i].dateHistory.push({ at: now.iso, byId: s.id, byName: s.name, role: s.role, from, to: newDate, reason });
    all[i].paymentDate = newDate;
    all[i].date = newDate;
    all[i].dateCorrectedAt = now.iso;
    all[i].dateCorrectedBy = s.name;
    all[i].dateCorrectionReason = reason;
    DB.set('payments', all);
    Audit.log('payment.date.correct', all[i].receiptNo + ' · ' + from + ' → ' + newDate + ' — ' + reason + ' (recorded ' + (all[i].recordedAt || '') + ' was not changed)');
    return { ok: true, payment: all[i] };
  },

  /* authorised correction: the record is kept and marked, never deleted */
  reverse(paymentId, data) {
    if (!Perm.canRecordPayments()) return { ok: false, error: 'Only the Secretary may reverse a payment.' };
    const reason = String((data && data.reason) || '').trim();
    if (reason.length < 5) return { ok: false, error: 'A reason of at least 5 characters is required to reverse a payment.' };
    const all = this.list();
    const i = all.findIndex(p => p.id === paymentId);
    if (i === -1) return { ok: false, error: 'Payment not found.' };
    if (all[i].reversed) return { ok: false, error: 'This payment has already been reversed.' };
    const s = Auth.session();
    all[i].reversed = true;
    all[i].reversedBy = s.name;
    all[i].reversedById = s.id;
    all[i].reversalReason = reason;
    all[i].reversedAt = new Date().toISOString();
    DB.set('payments', all);
    const stId = all[i].studentId || (DB.get('students').find(x => String(x.fullName || '').toLowerCase() === String(all[i].studentName || '').toLowerCase()) || {}).id;
    if (stId) Fees.syncBalance(stId);
    Audit.log('payment.reverse', all[i].receiptNo + ' · ' + money(all[i].amount) + ' · ' + all[i].studentName + ' — ' + reason);
    if (stId && typeof FeeNotifier !== 'undefined' && FeeNotifier.onBalanceChange) {
      const after = Fees.balanceOf(stId);
      try { FeeNotifier.onBalanceChange(stId, { trigger: 'reversal', before: Fees.round2(after - Number(all[i].amount || 0)), after }); } catch (e) {}
    }
    return { ok: true, payment: all[i], balance: stId ? Fees.balanceOf(stId) : null };
  },

  /* Secretary-only soft delete: the record is kept (marked deleted) so the
     audit trail survives, and the student's balance is recomputed from the
     payments that remain live. Deleted rows no longer appear in totals or
     histories. */
  softDelete(paymentId, data) {
    if (!Perm.canRecordPayments()) return { ok: false, error: 'Only the Secretary may delete payments.' };
    const all = this.list();
    const i = all.findIndex(p => p.id === paymentId);
    if (i === -1) return { ok: false, error: 'Payment not found.' };
    if (all[i].deleted) return { ok: false, error: 'This payment has already been deleted.' };
    const s = Auth.session();
    const reason = String((data && data.reason) || '').trim();
    all[i].deleted = true;
    all[i].deletedById = s.id;
    all[i].deletedBy = s.name;
    all[i].deletedByRole = s.role;
    all[i].deletedAt = new Date().toISOString();
    all[i].deleteReason = reason;
    DB.set('payments', all);
    const stId = all[i].studentId || (DB.get('students').find(x => String(x.fullName || '').toLowerCase() === String(all[i].studentName || '').toLowerCase()) || {}).id;
    const bal = stId ? Fees.syncBalance(stId) : null;
    Audit.log('payment.delete', all[i].receiptNo + ' · ' + money(all[i].amount) + ' · ' + all[i].studentName +
      (reason ? ' — ' + reason : '') + (bal == null ? '' : ' · balance now ' + money(bal)));
    if (stId && typeof FeeNotifier !== 'undefined' && FeeNotifier.onBalanceChange) {
      try { FeeNotifier.onBalanceChange(stId, { trigger: 'payment_deleted', before: Fees.round2(bal - Number(all[i].amount || 0)), after: bal }); } catch (e) {}
    }
    return { ok: true, payment: all[i], balance: bal };
  }
};

try { Fees.migrate(); } catch (e) { console.error('Fee migration skipped:', e); }