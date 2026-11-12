/* ============================================================
   ST. TERESA ACADEMY — CENTRALIZED APPROVAL WORKFLOW
   Teacher → Chief Examiner → Headteacher → Secretary → Publish
   Loaded AFTER admin.js + modules.js + portals.js
   ============================================================ */

const Submissions = {
  TYPES: [
    { id: 'exam_paper', label: 'Examination Paper', icon: 'fa-file-pen' },
    { id: 'exam_schedule', label: 'Examination Schedule', icon: 'fa-calendar-check' },
    { id: 'marking_scheme', label: 'Marking Scheme', icon: 'fa-list-check' },
    { id: 'student_marks', label: 'Student Marks', icon: 'fa-clipboard-user' },
    { id: 'exam_results', label: 'Examination Results', icon: 'fa-star' },
    { id: 'homework', label: 'Homework / Assignment', icon: 'fa-book-open' },
    { id: 'notes', label: 'Notes / Learning Material', icon: 'fa-folder-open' },
    { id: 'announcement', label: 'Announcement / Notice', icon: 'fa-bullhorn' },
    { id: 'message', label: 'Message to Students', icon: 'fa-comment-dots' },
    { id: 'other', label: 'Other Authorized Document', icon: 'fa-file-lines' }
  ],
  STATUS: {
    draft: { label: 'Draft', badge: 'navy' },
    chiefexaminer: { label: 'Pending Chief Examiner', badge: 'warning' },
    headteacher: { label: 'Pending Headteacher', badge: 'info' },
    secretary: { label: 'Pending Secretary', badge: 'gold' },
    approved_final: { label: 'Approved — Final', badge: 'success' },
    rejected: { label: 'Rejected — Returned for Correction', badge: 'danger' },
    published: { label: 'Published', badge: 'success' },
    withdrawn: { label: 'Withdrawn', badge: 'danger' }
  },
  /* Standard reasons a reviewer picks from when returning a document.
     A free-text detail is always collected alongside. */
  REJECT_REASONS: [
    'Content does not match the syllabus',
    'Missing or incomplete sections',
    'Formatting / layout not up to standard',
    'Wrong class or subject selected',
    'Errors in questions, answers or marks',
    'Confidential content must not be published',
    'Duplicate of an existing document',
    'Needs Headteacher / management input',
    'Other (see details)'
  ],
  STAGES: ['chiefexaminer', 'headteacher', 'secretary'],

  list() { return DB.get('submissions'); },
  get(id) { return this.list().find(s => s.id === id); },
  statusLabel(st) { return (this.STATUS[st] || { label: st }).label; },
  statusBadge(st) { return (this.STATUS[st] || { badge: 'navy' }).badge; },
  typeLabel(t) { const x = this.TYPES.find(y => y.id === t); return x ? x.label : t; },
  typeIcon(t) { const x = this.TYPES.find(y => y.id === t); return x ? x.icon : 'fa-file-lines'; },

  nextTrackingNo() {
    const counters = DB.get('subCounters', {});
    const year = new Date().getFullYear();
    const key = String(year);
    counters[key] = (counters[key] || 0) + 1;
    DB.set('subCounters', counters);
    return 'STA/SUB/' + year + '/' + String(counters[key]).padStart(4, '0');
  },

  /* ---------- VISIBILITY (server-side style enforcement) ---------- */
  canView(sub) {
    const s = Auth.session();
    if (!s || !sub) return false;
    if (s.role === 'admin' || s.role === 'director') return true;
    if (s.role === 'secretary') return true;
    if (s.role === 'chiefexaminer' || s.role === 'headteacher') return true;
    if (s.role === 'teacher') return sub.submittedById === s.id;
    if (s.role === 'student') return sub.status === 'published' && (sub.publishTarget === 'student' || sub.publishTarget === 'both');
    if (s.role === 'parent') return sub.status === 'published' && (sub.publishTarget === 'student' || sub.publishTarget === 'both');
    return false;
  },
  /* the actor must own the stage the submission is sitting on */
  canAct(sub) {
    const s = Auth.session();
    if (!s || !sub) return false;
    if (sub.status === 'rejected') return s.role === 'teacher' && sub.submittedById === s.id;
    if (sub.status === 'draft') return s.role === 'teacher' && sub.submittedById === s.id;
    if (sub.status === 'approved_final') return s.role === 'secretary';
    if (!Perm.canApproveStage(sub.status)) return false;
    // a teacher may never act on their own submission
    if (sub.submittedById === s.id && s.role === 'teacher') return false;
    return true;
  },
  canPublish(sub) {
    const s = Auth.session();
    return !!s && sub.status === 'approved_final' && s.role === 'secretary';
  },

  /* ---------- CREATE / RESUBMIT ---------- */
  create(data) {
    if (!Perm.canSubmitDocuments()) return { ok: false, error: 'You are not authorized to submit documents.' };
    const s = Auth.session();
    const err = this.validate(data);
    if (err) return { ok: false, error: err };
    const now = new Date().toISOString();
    const sub = {
      id: DB.uid(),
      trackingNo: this.nextTrackingNo(),
      title: data.title.trim(),
      docType: data.docType,
      classId: data.classId || '',
      className: data.className || '',
      subject: data.subject || '',
      term: data.term || DB.get('settings', {}).term || '1',
      academicYear: data.academicYear || DB.get('settings', {}).academicYear || String(new Date().getFullYear()),
      content: data.content || '',
      fileName: data.fileName || '',
      fileKey: data.fileKey || '',
      /* which live record this submission controls — the ApprovalGate reads and
         writes it, so the content item can never be released without this
         submission completing the whole chain. */
      linkedCollection: data.linkedCollection || '',
      linkedId: data.linkedId || '',
      linkedKey: data.linkedKey || '',
      status: 'chiefexaminer',
      version: 1,
      submittedById: s.id, submittedByName: s.name, submittedByRole: s.role,
      submittedAt: now, updatedAt: now,
      history: [{ stage: 'chiefexaminer', action: 'submit', byId: s.id, byName: s.name, byRole: s.role, comment: 'Submitted for review (version 1).', at: now }],
      chiefExaminer: null, headteacher: null, secretary: null,
      publishTarget: '', publishedAt: '', publishedBy: '', scheduledAt: '', withdrawnAt: '', withdrawReason: ''
    };
    const list = this.list();
    list.push(sub);
    DB.set('submissions', list);
    Audit.log('submission.create', sub.trackingNo + ' · ' + sub.title + ' (' + this.typeLabel(sub.docType) + ')');
    this._notifyStage(sub, 'chiefexaminer', 'Submission received — awaiting Chief Examiner review',
      '"' + sub.title + '" (' + sub.trackingNo + ') was submitted by ' + sub.submittedByName + ' and is now awaiting Chief Examiner review.');
    this._notify(sub.submittedById, 'Submission Received',
      'Your document "' + sub.title + '" (' + sub.trackingNo + ') has been received and is awaiting Chief Examiner review. Next action: Chief Examiner review.', 'success');
    return { ok: true, submission: sub };
  },
  validate(d) {
    if (!d.title || !d.title.trim()) return 'Document title is required.';
    if (!d.docType) return 'Select a document type.';
    if (!d.className) return 'Select the class this document belongs to.';
    if (!d.subject) return 'Select the subject.';
    if (!d.content && !d.fileKey) return 'Attach a file or write the document content.';
    return null;
  },

  /* stage: chiefexaminer | headteacher | secretary | publish */
  _notifyStage(sub, stage, title, message) {
    const role = stage === 'publish' ? 'secretary' : stage;
    DB.get('users').filter(u => u.role === role).forEach(u => Notifications.send(u.id, role, title, message, 'info'));
  },
  _notify(userId, title, message, type) {
    if (!userId) return;
    Notifications.send(userId, 'teacher', title, message, type || 'info');
  },
  _record(sub, action, stage, comment) {
    const s = Auth.session();
    sub.history = sub.history || [];
    sub.history.push({ stage, action, byId: s ? s.id : '', byName: s ? s.name : 'system', byRole: s ? s.role : 'system', comment: comment || '', at: new Date().toISOString() });
    sub.updatedAt = new Date().toISOString();
  },

  /* ---------- DECISIONS ----------
     decision: 'approve' | 'reject'
     reasonCode: one of REJECT_REASONS, required when rejecting        */
  decide(id, decision, comment, reasonCode) {
    const sub = this.get(id);
    if (!sub) return { ok: false, error: 'Submission not found.' };
    const s = Auth.session();
    if (!s) return { ok: false, error: 'Please sign in.' };
    const stage = sub.status;
    if (!Perm.canApproveStage(stage)) return { ok: false, error: 'This submission is not awaiting your review (current stage: ' + this.statusLabel(stage) + ').' };
    if (sub.submittedById === s.id && s.role === 'teacher') return { ok: false, error: 'You cannot approve your own submission.' };
    if (!['approve', 'reject'].includes(decision)) return { ok: false, error: 'Invalid decision.' };

    if (decision === 'reject') {
      const code = String(reasonCode || '').trim();
      const detail = String(comment || '').trim();
      if (!code) return { ok: false, error: 'Choose the reason the document is being returned.' };
      if (!this.REJECT_REASONS.includes(code)) return { ok: false, error: 'Unrecognised rejection reason.' };
      if (code === 'Other (see details)' && !detail) return { ok: false, error: 'Describe the reason in the comment box.' };
    }

    const nextStage = stage === 'chiefexaminer' ? 'headteacher' : stage === 'headteacher' ? 'secretary' : 'approved_final';
    const rec = {
      decision,
      comment: (comment || '').trim(),
      reasonCode: decision === 'reject' ? String(reasonCode || '').trim() : '',
      byId: s.id, byName: s.name, at: new Date().toISOString()
    };
    sub[stage === 'chiefexaminer' ? 'chiefExaminer' : stage === 'headteacher' ? 'headteacher' : 'secretary'] = rec;

    if (decision === 'reject') {
      sub.status = 'rejected';
      sub.rejectedAtStage = stage;
      this._record(sub, 'reject', stage, rec.reasonCode + (rec.comment ? ' — ' + rec.comment : ''));
      Audit.log('submission.reject', sub.trackingNo + ' rejected at ' + stage + ' by ' + s.name + ' — [' + rec.reasonCode + '] ' + rec.comment);
      this._notify(sub.submittedById, 'Submission Rejected — Returned for Correction',
        '"' + sub.title + '" (' + sub.trackingNo + ') was rejected by the ' + stage + '. Reason: ' + rec.reasonCode + '.' + (rec.comment ? ' ' + rec.comment : '') + ' Next action: correct and resubmit as version ' + ((sub.version || 1) + 1) + '.', 'error');
      DB.get('users').filter(u => u.role === 'secretary').forEach(u => Notifications.send(u.id, 'secretary', 'Submission Rejected', sub.trackingNo + ' was rejected at the ' + stage + ' stage and will not reach the Secretary until corrected.', 'info'));
    } else {
      sub.status = nextStage;
      if (nextStage === 'approved_final') {
        sub.finalApproved = true;
        sub.finalApprovedAt = rec.at;
        sub.finalApprovedBy = s.name;
      }
      this._record(sub, 'approve', stage, rec.comment || 'Approved.');
      Audit.log('submission.approve', sub.trackingNo + ' approved at ' + stage + ' by ' + s.name);
      if (nextStage && nextStage !== 'approved_final') {
        this._notifyStage(sub, nextStage, 'Submission forwarded to the ' + (nextStage === 'secretary' ? 'Secretary' : 'Headteacher'),
          '"' + sub.title + '" (' + sub.trackingNo + ') was approved by the ' + stage + ' and is now awaiting ' + (nextStage === 'secretary' ? 'Secretary' : 'Headteacher') + ' review.');
        this._notify(sub.submittedById, 'Approved by the ' + (stage === 'chiefexaminer' ? 'Chief Examiner' : 'Headteacher'),
          '"' + sub.title + '" (' + sub.trackingNo + ') was approved and forwarded to the ' + (nextStage === 'secretary' ? 'Secretary for final review' : 'Headteacher') + '. Next action: ' + (nextStage === 'secretary' ? 'Secretary final review' : 'Headteacher review') + '.', 'success');
      } else if (nextStage === 'approved_final') {
        this._notify(sub.submittedById, 'Approved — Final', '"' + sub.title + '" (' + sub.trackingNo + ') has completed all three approval stages and is marked Approved — Final. Next action: Secretary publication.', 'success');
      }
    }
    this._save(sub);
    /* push the stage onto the linked content record so students never see it early */
    ApprovalGate.applyStage(sub);
    return { ok: true, submission: sub };
  },

  /* ---------- SECRETARY PUBLICATION ---------- */
  publish(id, target, scheduledAt) {
    const sub = this.get(id);
    if (!sub) return { ok: false, error: 'Submission not found.' };
    if (!Perm.canPublishDocuments()) return { ok: false, error: 'Only the Secretary has final publishing authority.' };
    if (sub.status !== 'approved_final') {
      return { ok: false, error: 'Cannot publish: this document has not completed all mandatory approval stages (current: ' + this.statusLabel(sub.status) + '). Record the Secretary\u2019s final approval first.' };
    }
    if (!target) return { ok: false, error: 'Choose the portal to publish to.' };
    const s = Auth.session();
    const now = new Date().toISOString();
    sub.status = 'published';
    sub.publishTarget = target;
    sub.scheduledAt = scheduledAt || '';
    sub.publishedAt = now;
    sub.publishedBy = s.name;
    sub.secretary = { decision: 'publish', comment: 'Approved and published to the ' + target + ' portal.', byId: s.id, byName: s.name, at: now };
    this._record(sub, 'publish', 'secretary', 'Published to ' + target + ' portal' + (scheduledAt ? ' (scheduled ' + scheduledAt + ')' : ''));
    this._save(sub);
    /* THE RELEASE POINT — this is the only way teacher content reaches students. */
    ApprovalGate.applyPublished(sub);
    Audit.log('submission.publish', sub.trackingNo + ' published to ' + target + ' portal by ' + s.name);
    this._notify(sub.submittedById, 'Document Published', '"' + sub.title + '" (' + sub.trackingNo + ') has been published to the ' + target + ' portal.', 'success');
    if (target === 'student' || target === 'both') {
      DB.get('users').filter(u => u.role === 'student').forEach(u => Notifications.send(u.id, 'student', 'New School Document Published', '"' + sub.title + '" (' + sub.subject + ') is now available under School Documents.'));
    }
    if (target === 'staff' || target === 'both') {
      DB.get('users').filter(u => ['teacher', 'admin', 'headteacher', 'chiefexaminer', 'secretary'].includes(u.role)).forEach(u => Notifications.send(u.id, 'teacher', 'New Staff Document Published', '"' + sub.title + '" (' + sub.trackingNo + ') is now available.'));
    }
    return { ok: true, submission: sub };
  },
  unpublish(id, reason) {
    const sub = this.get(id);
    if (!sub) return { ok: false, error: 'Submission not found.' };
    if (!Perm.canPublishDocuments()) return { ok: false, error: 'Only the Secretary can withdraw a published document.' };
    if (sub.status !== 'published') return { ok: false, error: 'Only published documents can be withdrawn.' };
    if (!(reason || '').trim()) return { ok: false, error: 'A reason is required to withdraw a published document.' };
    const s = Auth.session();
    sub.status = 'withdrawn';
    sub.withdrawnAt = new Date().toISOString();
    sub.withdrawnBy = s.name;
    sub.withdrawReason = reason.trim();
    this._record(sub, 'unpublish', 'secretary', reason.trim());
    this._save(sub);
    /* withdrawal re-quarantines the linked content */
    ApprovalGate.applyWithdrawn(sub);
    Audit.log('submission.unpublish', sub.trackingNo + ' withdrawn by ' + s.name + ' — ' + reason.trim());
    this._notify(sub.submittedById, 'Document Withdrawn', '"' + sub.title + '" (' + sub.trackingNo + ') was withdrawn from publication. Reason: ' + reason.trim(), 'error');
    return { ok: true, submission: sub };
  },
  /* ---------- DELETE A SUBMISSION ----------
     A teacher may delete only their own submission; the administrator/director
     may delete any. Deleting a live (published/withdrawn) submission first pulls
     its linked content back out of the portals so nothing is left published. */
  remove(id) {
    const s = Auth.session();
    const sub = this.get(id);
    if (!sub) return { ok: false, error: 'Submission not found.' };
    if (!s) return { ok: false, error: 'Not signed in.' };
    const isOwner = sub.submittedById === s.id;
    const isAdmin = s.role === 'admin' || s.role === 'director';
    if (!isOwner && !isAdmin) return { ok: false, error: 'You can only delete your own submissions.' };
    if (sub.status === 'published' || sub.status === 'withdrawn') {
      try { ApprovalGate.applyWithdrawn(sub); } catch (e) { /* no linked content — nothing to retract */ }
    }
    DB.set('submissions', this.list().filter(x => x.id !== id));
    Audit.log('submission.delete', sub.trackingNo + ' · ' + sub.title + ' deleted by ' + s.name + (isOwner ? ' (owner)' : ' (admin)'));
    return { ok: true };
  },
  rejectBySecretary(id, comment, reasonCode) {
    const sub = this.get(id);
    if (!sub) return { ok: false, error: 'Submission not found.' };
    if (!Perm.canApproveStage('secretary') || !['secretary', 'approved_final'].includes(sub.status)) return { ok: false, error: 'This document is not awaiting your review.' };
    const code = String(reasonCode || '').trim();
    const detail = String(comment || '').trim();
    if (!code) return { ok: false, error: 'Choose the reason the document is being returned.' };
    if (!this.REJECT_REASONS.includes(code)) return { ok: false, error: 'Unrecognised rejection reason.' };
    if (code === 'Other (see details)' && !detail) return { ok: false, error: 'Describe the reason in the comment box.' };
    sub.status = 'rejected';
    sub.rejectedAtStage = 'secretary';
    sub.finalApproved = false;
    sub.secretary = { decision: 'reject', comment: detail, reasonCode: code, byId: Auth.session().id, byName: Auth.session().name, at: new Date().toISOString() };
    this._record(sub, 'reject', 'secretary', code + (detail ? ' — ' + detail : ''));
    this._save(sub);
    ApprovalGate.applyStage(sub);
    Audit.log('submission.reject', sub.trackingNo + ' rejected at secretary stage — [' + code + '] ' + detail);
    this._notify(sub.submittedById, 'Returned for Correction by the Secretary',
      '"' + sub.title + '" (' + sub.trackingNo + ') was returned for correction. Reason: ' + code + '.' + (detail ? ' ' + detail : '') + ' Next action: correct and resubmit as version ' + ((sub.version || 1) + 1) + '.', 'error');
    return { ok: true, submission: sub };
  },

  /* ---------- RESUBMIT AFTER REJECTION ---------- */
  resubmit(id, data) {
    const sub = this.get(id);
    if (!sub) return { ok: false, error: 'Submission not found.' };
    const s = Auth.session();
    if (!s || sub.submittedById !== s.id) return { ok: false, error: 'Only the original submitter can resubmit this document.' };
    if (sub.status !== 'rejected') return { ok: false, error: 'Only rejected documents can be resubmitted.' };
    const merged = { ...sub, ...data };
    const err = this.validate(merged);
    if (err) return { ok: false, error: err };
    const now = new Date().toISOString();
    const newVersion = (Number(sub.version) || 1) + 1;
    Object.assign(sub, {
      title: data.title.trim(), docType: data.docType, classId: data.classId || '', className: data.className || '',
      subject: data.subject || '', term: data.term || sub.term, academicYear: data.academicYear || sub.academicYear,
      content: data.content != null ? data.content : sub.content,
      fileName: data.fileName != null ? data.fileName : sub.fileName,
      fileKey: data.fileKey != null ? data.fileKey : sub.fileKey,
      version: newVersion,
      status: 'chiefexaminer', submittedAt: now, updatedAt: now,
      rejectedAtStage: '',
      finalApproved: false, finalApprovedAt: '', finalApprovedBy: '',
      chiefExaminer: null, headteacher: null, secretary: null,
      publishTarget: '', publishedAt: '', publishedBy: ''
    });
    this._record(sub, 'resubmit', 'chiefexaminer', 'Corrected and resubmitted as version ' + newVersion + '.');
    this._save(sub);
    ApprovalGate.applyStage(sub);
    Audit.log('submission.resubmit', sub.trackingNo + ' corrected and resubmitted as v' + newVersion + ' by ' + s.name);
    this._notifyStage(sub, 'chiefexaminer', 'Resubmitted document awaiting Chief Examiner review',
      '"' + sub.title + '" (' + sub.trackingNo + ', v' + newVersion + ') was corrected and resubmitted by ' + s.name + '.');
    return { ok: true, submission: sub };
  },

  _save(sub) {
    const list = this.list();
    const i = list.findIndex(x => x.id === sub.id);
    if (i === -1) list.push(sub); else list[i] = sub;
    DB.set('submissions', list);
  },

  /* ---------- QUERIES ---------- */
  pendingFor(stage) { return this.list().filter(s => s.status === stage).reverse(); },
  forUser(userId) { return this.list().filter(s => s.submittedById === userId).reverse(); },
  publishedForAudience(target) {
    return this.list().filter(s => s.status === 'published' && (s.publishTarget === target || s.publishTarget === 'both')).reverse();
  },
  reviewedBy(userId) {
    return this.list().filter(s => (s.history || []).some(h => h.byId === userId && ['approve', 'reject', 'publish', 'unpublish'].includes(h.action))).reverse();
  },
  historyOf(sub) { return (sub.history || []).slice().reverse(); },
  statsFor(stageFilter) {
    const all = this.list();
    const mine = stageFilter ? all.filter(s => s.status === stageFilter) : all;
    const pendingAll = this.STAGES.reduce((n, st) => n + all.filter(s => s.status === st).length, 0);
    return {
      chiefexaminer: all.filter(s => s.status === 'chiefexaminer').length,
      headteacher: all.filter(s => s.status === 'headteacher').length,
      secretary: all.filter(s => s.status === 'secretary').length,
      approved_final: all.filter(s => s.status === 'approved_final').length,
      rejected: all.filter(s => s.status === 'rejected').length,
      published: all.filter(s => s.status === 'published').length,
      withdrawn: all.filter(s => s.status === 'withdrawn').length,
      pending: pendingAll,
      total: all.length,
      mine: mine.length
    };
  },
  /* Count of documents sitting on a stage — drives the sidebar badges. */
  pendingCount(stage) { return this.list().filter(s => s.status === stage).length; },
  /* Documents the signed-in reviewer still has to act on. */
  myPendingCount() {
    const s = Auth.session();
    if (!s || !this.STAGES.includes(s.role)) return 0;
    return this.list().filter(sub => sub.status === s.role && sub.submittedById !== s.id).length;
  }
};

/* ============================================================
   APPROVAL UI (shared by teacher, chief examiner, headteacher,
   secretary, admin and student portals)
   ============================================================ */
const ApprovalUI = {
  escape: esc,

  badge(status) {
    return `<span class="badge badge-${Submissions.statusBadge(status)}">${esc(Submissions.statusLabel(status))}</span>`;
  },

  /* Generic pending/action table.
     opts: { stage, containerId, showSubmitter, canDecide } */
  renderQueue(containerId, opts) {
    const box = document.getElementById(containerId);
    if (!box) return;
    const stage = opts.stage;
    let items = Submissions.list().filter(s => !opts.filter || opts.filter(s));
    const statusFilter = (document.getElementById(opts.filterId || '') || {}).value || '';
    const typeFilter = (document.getElementById(opts.typeFilterId || '') || {}).value || '';
    const search = ((document.getElementById(opts.searchId || '') || {}).value || '').toLowerCase();
    if (statusFilter) items = items.filter(s => s.status === statusFilter);
    if (typeFilter) items = items.filter(s => s.docType === typeFilter);
    if (search) items = items.filter(s => (s.title + ' ' + s.trackingNo + ' ' + s.className + ' ' + s.subject + ' ' + s.submittedByName).toLowerCase().includes(search));

    if (!items.length) {
      box.innerHTML = `<div class="empty-state"><i class="fas fa-inbox"></i><h4>Nothing here yet</h4><p>${esc(opts.emptyText || 'No submissions match this view.')}</p></div>`;
      return;
    }
    box.innerHTML = `<div class="table-wrap"><table class="data-table">
      <thead><tr>
        <th>Tracking No</th><th>Document</th><th>Type</th><th>Class / Subject</th>
        ${opts.showSubmitter ? '<th>Submitted By</th>' : ''}
        <th>Submitted</th><th>Status</th><th>Actions</th>
      </tr></thead>
      <tbody>${items.map(sub => {
        const acts = ApprovalUI.actionButtons(sub, opts);
        return `<tr>
          <td><code>${esc(sub.trackingNo)}</code></td>
          <td><strong>${esc(sub.title)}</strong> <span class="badge badge-navy" title="Version">v${esc(String(sub.version || 1))}</span>${sub.fileName ? `<br><small style="color:var(--text-light)"><i class="fas fa-paperclip"></i> ${esc(sub.fileName)}</small>` : ''}${sub.scheduledAt && sub.status === 'published' ? `<br><small style="color:var(--text-light)"><i class="fas fa-clock"></i> Scheduled ${esc(sub.scheduledAt)}</small>` : ''}${sub.status === 'rejected' && (sub.secretary || sub.headteacher || sub.chiefExaminer) ? `<br><small style="color:var(--danger)"><i class="fas fa-rotate-left"></i> ${esc((sub.secretary && sub.secretary.reasonCode) || (sub.headteacher && sub.headteacher.reasonCode) || (sub.chiefExaminer && sub.chiefExaminer.reasonCode) || 'Returned for correction')}</small>` : ''}</td>
          <td><span class="badge badge-navy"><i class="fas ${Submissions.typeIcon(sub.docType)}"></i> ${esc(Submissions.typeLabel(sub.docType))}</span></td>
          <td>${esc(sub.className || '—')}<br><small style="color:var(--text-light)">${esc(sub.subject || '')} · T${esc(sub.term)} ${esc(sub.academicYear)}</small></td>
          ${opts.showSubmitter ? `<td>${esc(sub.submittedByName)}<br><small style="color:var(--text-light)">${esc(sub.submittedByRole)}</small></td>` : ''}
          <td>${fmtDate(sub.submittedAt)}<br><small style="color:var(--text-light)">${esc(String(sub.submittedAt || '').slice(11, 16))}</small></td>
          <td>${ApprovalUI.badge(sub.status)}</td>
          <td class="table-actions">${acts}</td>
        </tr>`;
      }).join('')}</tbody></table></div>
      <p style="font-size:.8rem;color:var(--text-light);margin-top:8px">${items.length} record(s)</p>`;
  },

  actionButtons(sub, opts) {
    const s = Auth.session() || {};
    let out = `<button class="btn btn-xs btn-outline" onclick="ApprovalUI.preview('${sub.id}')" title="Preview"><i class="fas fa-eye"></i></button>`;
    const canSeeActions = opts && opts.stage ? (sub.status === opts.stage && Perm.canApproveStage(opts.stage)) : false;
    if (canSeeActions && s.id !== sub.submittedById) {
      out += `<button class="btn btn-xs btn-success" onclick="ApprovalUI.decidePrompt('${sub.id}','approve')" title="Approve"><i class="fas fa-check"></i></button>
              <button class="btn btn-xs btn-danger" onclick="ApprovalUI.decidePrompt('${sub.id}','reject')" title="Reject / Return for correction"><i class="fas fa-xmark"></i></button>`;
    }
    if (sub.status === 'secretary' && Perm.canPublishDocuments()) {
      out += `<button class="btn btn-xs btn-success" onclick="ApprovalUI.preview('${sub.id}')" title="Record final approval"><i class="fas fa-stamp"></i></button>`;
    }
    if (sub.status === 'approved_final' && Perm.canPublishDocuments()) {
      out += `<button class="btn btn-xs btn-gold" onclick="ApprovalUI.publishPrompt('${sub.id}')" title="Publish"><i class="fas fa-bullhorn"></i></button>`;
    }
    if (sub.status === 'published' && Perm.canPublishDocuments()) {
      out += `<button class="btn btn-xs btn-outline" onclick="ApprovalUI.unpublishPrompt('${sub.id}')" title="Withdraw publication"><i class="fas fa-eye-slash"></i></button>`;
    }
    if (sub.status === 'rejected' && s.id === sub.submittedById) {
      out += `<button class="btn btn-xs btn-primary" onclick="ApprovalUI.openResubmit('${sub.id}')" title="Correct & Resubmit"><i class="fas fa-paper-plane"></i></button>`;
    }
    return out;
  },

  /* ---------- PREVIEW ---------- */
  async preview(id) {
    const sub = Submissions.get(id);
    if (!sub) return;
    if (!Submissions.canView(sub)) return toast('You are not authorized to view this document.', 'error');
    const body = document.getElementById('approvalPreviewBody');
    if (!body) return;
    document.getElementById('approvalPreviewTitle').textContent = sub.trackingNo + ' — ' + sub.title;
    const hist = Submissions.historyOf(sub);
    const fileBox = sub.fileKey
      ? `<div style="margin-top:6px"><a href="#" class="btn btn-sm btn-outline" onclick="event.preventDefault();ApprovalUI.download('${sub.id}')"><i class="fas fa-download"></i> Download ${esc(sub.fileName || 'attachment')}</a></div>`
      : '';
    body.innerHTML = `
      <div class="form-grid" style="margin-bottom:14px">
        <div class="form-group"><label>Tracking Number</label><div><code>${esc(sub.trackingNo)}</code></div></div>
        <div class="form-group"><label>Version</label><div><span class="badge badge-navy">v${esc(String(sub.version || 1))}</span></div></div>
        <div class="form-group"><label>Status</label><div>${ApprovalUI.badge(sub.status)}</div></div>
        <div class="form-group"><label>Document Type</label><div>${esc(Submissions.typeLabel(sub.docType))}</div></div>
        ${sub.linkedCollection ? `<div class="form-group full"><label>Controls Live Record</label><div><span class="badge badge-navy">${esc(sub.linkedCollection)}</span> <small style="color:var(--text-light)">— this portal item stays hidden from students until you publish.</small></div></div>` : ''}
        <div class="form-group"><label>Class</label><div>${esc(sub.className || '—')}</div></div>
        <div class="form-group"><label>Subject</label><div>${esc(sub.subject || '—')}</div></div>
        <div class="form-group"><label>Term / Year</label><div>Term ${esc(sub.term)} · ${esc(sub.academicYear)}</div></div>
        <div class="form-group"><label>Submitted By</label><div>${esc(sub.submittedByName)} <small style="color:var(--text-light)">(${esc(sub.submittedByRole)})</small></div></div>
        <div class="form-group"><label>Submitted</label><div>${esc(String(sub.submittedAt || '').replace('T', ' ').slice(0, 16))}</div></div>
        ${sub.rejectedAtStage ? `<div class="form-group"><label>Returned At Stage</label><div><span class="badge badge-danger">${esc(sub.rejectedAtStage)}</span></div></div>` : ''}
        ${sub.finalApproved ? `<div class="form-group"><label>Final Approval</label><div><span class="badge badge-success"><i class="fas fa-stamp"></i> Approved — Final</span><br><small style="color:var(--text-light)">${esc(sub.finalApprovedBy || '')} ${esc(String(sub.finalApprovedAt || '').replace('T', ' ').slice(0, 16))}</small></div></div>` : ''}
        ${sub.status === 'published' ? `<div class="form-group"><label>Published</label><div>${esc(String(sub.publishedAt || '').replace('T', ' ').slice(0, 16))} by ${esc(sub.publishedBy || '')}</div></div>` : ''}
        ${sub.status === 'published' ? `<div class="form-group"><label>Portal</label><div><span class="badge badge-success">${esc(sub.publishTarget)}</span></div></div>` : ''}
        ${sub.status === 'withdrawn' ? `<div class="form-group full"><label>Withdrawal Reason</label><div style="color:var(--danger)">${esc(sub.withdrawReason || '')} — ${esc(sub.withdrawnBy || '')}</div></div>` : ''}
      </div>
      ${sub.content ? `<div style="border:1px solid var(--border);border-radius:10px;padding:14px;background:var(--cream);white-space:pre-wrap;font-size:.92rem;margin-bottom:12px">${esc(sub.content)}</div>` : ''}
      ${fileBox}
      ${sub.chiefExaminer ? ApprovalUI.decisionBox('Chief Examiner', sub.chiefExaminer) : ''}
      ${sub.headteacher ? ApprovalUI.decisionBox('Headteacher', sub.headteacher) : ''}
      ${sub.secretary ? ApprovalUI.decisionBox('Secretary', sub.secretary) : ''}
      <h4 style="color:var(--navy);margin:16px 0 8px"><i class="fas fa-clock-rotate-left"></i> Approval History</h4>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Date &amp; Time</th><th>Stage</th><th>Action</th><th>By</th><th>Comment</th></tr></thead>
        <tbody>${hist.length ? hist.map(h => `<tr>
          <td style="white-space:nowrap">${esc(String(h.at || '').replace('T', ' ').slice(0, 16))}</td>
          <td><span class="badge badge-navy">${esc(h.stage)}</span></td>
          <td><span class="badge badge-${h.action === 'approve' || h.action === 'publish' ? 'success' : h.action === 'reject' || h.action === 'unpublish' ? 'danger' : 'info'}">${esc(h.action)}</span></td>
          <td>${esc(h.byName)}<br><small style="color:var(--text-light)">${esc(h.byRole || '')}</small></td>
          <td style="font-size:.83rem">${esc(h.comment || '—')}</td>
        </tr>`).join('') : '<tr><td colspan="5" style="text-align:center;color:var(--text-light)">No history</td></tr>'}</tbody>
      </table></div>
      <div id="approvalActBox" style="margin-top:16px;border-top:1px solid var(--border);padding-top:14px">
        ${ApprovalUI.stageActions(sub)}
      </div>`;
    openModal('approvalPreviewModal');
  },

  decisionBox(role, d) {
    if (!d) return '';
    const good = d.decision === 'approve' || d.decision === 'publish';
    const reason = d.reasonCode ? `<p style="font-size:.87rem;margin:6px 0 0"><strong>${esc(d.reasonCode)}</strong>${d.comment ? ' — ' + esc(d.comment) : ''}</p>` : `<p style="font-size:.87rem;margin:6px 0 0">${esc(d.comment || '')}</p>`;
    return `<div style="border-left:4px solid var(--${good ? 'success' : 'danger'});background:${good ? 'var(--success-bg)' : 'var(--danger-bg)'};padding:10px 14px;border-radius:8px;margin-bottom:10px">
      <strong style="color:var(--${good ? 'success' : 'danger'})">${esc(role)} — ${esc(String(d.decision || '').toUpperCase())}</strong>
      <span style="float:right;font-size:.8rem;color:var(--text-light)">${esc(d.byName || '')} · ${esc(String(d.at || '').replace('T', ' ').slice(0, 16))}</span>
      ${reason}
    </div>`;
  },

  /* Standard rejection reason picker shared by every review stage. */
  reasonSelect() {
    return `<div class="form-group" style="margin-top:10px">
      <label>Reason for returning <span class="req">*</span> <small style="font-weight:400;color:var(--text-light)">(required when rejecting)</small></label>
      <select id="approvalReason" style="width:100%;padding:10px;border:2px solid var(--border);border-radius:8px;font-family:inherit;background:var(--white)">
        <option value="">Choose a reason…</option>
        ${Submissions.REJECT_REASONS.map(r => `<option value="${esc(r)}">${esc(r)}</option>`).join('')}
      </select></div>`;
  },

  stageActions(sub) {
    const s = Auth.session() || {};
    if (sub.status === 'rejected' && s.id === sub.submittedById) {
      const lastReason = (sub.secretary && sub.secretary.reasonCode) || (sub.headteacher && sub.headteacher.reasonCode) || (sub.chiefExaminer && sub.chiefExaminer.reasonCode) || '';
      return `<p style="font-size:.88rem;color:var(--danger);margin-bottom:8px"><i class="fas fa-triangle-exclamation"></i> This document was returned for correction${lastReason ? ' — <strong>' + esc(lastReason) + '</strong>' : ''}.</p>
        <p style="font-size:.84rem;color:var(--text-light);margin-bottom:10px">Resubmitting starts the approval process again from the Chief Examiner as version <strong>v${(Number(sub.version) || 1) + 1}</strong>.</p>
        <button class="btn btn-primary" onclick="ApprovalUI.openResubmit('${sub.id}')"><i class="fas fa-paper-plane"></i> Correct &amp; Resubmit</button>`;
    }
    if (['chiefexaminer', 'headteacher'].includes(sub.status) && Perm.canApproveStage(sub.status) && s.id !== sub.submittedById) {
      return `<div class="form-group"><label>Review Comment</label>
        <textarea id="approvalComment" rows="2" placeholder="Optional for approval — required for rejection…" style="width:100%;padding:10px;border:2px solid var(--border);border-radius:8px;font-family:inherit"></textarea></div>
        ${ApprovalUI.reasonSelect()}
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
          <button class="btn btn-success" onclick="ApprovalUI.decide('${sub.id}','approve')"><i class="fas fa-check"></i> Approve &amp; Forward</button>
          <button class="btn btn-danger" onclick="ApprovalUI.decide('${sub.id}','reject')"><i class="fas fa-xmark"></i> Reject / Return for Correction</button>
          <button class="btn btn-outline" onclick="closeModal('approvalPreviewModal')">Close</button>
        </div>`;
    }
    if (sub.status === 'secretary' && Perm.canPublishDocuments()) {
      return `<p style="font-size:.88rem;margin-bottom:10px"><i class="fas fa-circle-info"></i> Chief Examiner and Headteacher approvals are complete. Record your <strong>final approval</strong> to release the document for publication.</p>
        <div class="form-group"><label>Review Comment</label>
          <textarea id="approvalComment" rows="2" placeholder="Optional for approval…" style="width:100%;padding:10px;border:2px solid var(--border);border-radius:8px;font-family:inherit"></textarea></div>
        ${ApprovalUI.reasonSelect()}
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
          <button class="btn btn-success" onclick="ApprovalUI.decide('${sub.id}','approve')"><i class="fas fa-stamp"></i> Approve — Final</button>
          <button class="btn btn-danger" onclick="ApprovalUI.secretaryReject('${sub.id}')"><i class="fas fa-rotate-left"></i> Return for Correction</button>
          <button class="btn btn-outline" onclick="closeModal('approvalPreviewModal')">Close</button>
        </div>`;
    }
    if (sub.status === 'approved_final' && Perm.canPublishDocuments()) {
      return `<p style="font-size:.88rem;color:var(--success);margin-bottom:10px"><i class="fas fa-circle-check"></i> <strong>Approved — Final</strong> by ${esc(sub.finalApprovedBy || 'the Secretary')}${sub.finalApprovedAt ? ' on ' + esc(String(sub.finalApprovedAt).replace('T', ' ').slice(0, 16)) : ''}. Ready to publish.</p>
        <div class="form-group"><label>Publication Note</label>
          <textarea id="approvalComment" rows="2" placeholder="Optional note recorded with the publication…" style="width:100%;padding:10px;border:2px solid var(--border);border-radius:8px;font-family:inherit"></textarea></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
          <button class="btn btn-gold" onclick="ApprovalUI.publishPrompt('${sub.id}')"><i class="fas fa-bullhorn"></i> Publish Now</button>
          <button class="btn btn-primary" onclick="ApprovalUI.schedulePrompt('${sub.id}')"><i class="fas fa-clock"></i> Schedule Publication</button>
          <button class="btn btn-danger" onclick="ApprovalUI.secretaryReject('${sub.id}')"><i class="fas fa-rotate-left"></i> Return for Correction</button>
          <button class="btn btn-outline" onclick="closeModal('approvalPreviewModal')">Close</button>
        </div>`;
    }
    if (sub.status === 'published' && Perm.canPublishDocuments()) {
      return `<p style="font-size:.88rem;color:var(--success);margin-bottom:10px"><i class="fas fa-circle-check"></i> Published to the <strong>${esc(sub.publishTarget)}</strong> portal on ${esc(String(sub.publishedAt || '').replace('T', ' ').slice(0, 16))} by ${esc(sub.publishedBy)}.</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-outline" onclick="window.print()"><i class="fas fa-print"></i> Print Preview</button>
          <button class="btn btn-danger" onclick="ApprovalUI.unpublishPrompt('${sub.id}')"><i class="fas fa-eye-slash"></i> Withdraw Publication</button>
        </div>`;
    }
    return `<p style="font-size:.86rem;color:var(--text-light)">No actions available to you at this stage.</p>`;
  },

  /* ---------- ACTIONS ---------- */
  _reason() { const el = document.getElementById('approvalReason'); return el ? el.value : ''; },
  decide(id, decision) {
    const commentEl = document.getElementById('approvalComment');
    const comment = commentEl ? commentEl.value : '';
    const reason = this._reason();
    if (decision === 'reject') {
      if (!reason) return toast('Choose the reason the document is being returned.', 'error');
      if (reason === 'Other (see details)' && !comment.trim()) return toast('Describe the reason in the comment box.', 'error');
    }
    const r = Submissions.decide(id, decision, comment, reason);
    if (!r.ok) return toast(r.error, 'error');
    closeModal('approvalPreviewModal');
    if (decision === 'approve') {
      toast(r.submission.status === 'approved_final' ? 'Approved — Final. The document is ready for publication.' : 'Approved and forwarded to the next stage.', 'success');
    } else {
      toast('Returned for correction: ' + reason, 'info');
    }
    ApprovalUI.refreshAll();
  },
  decidePrompt(id, decision) {
    const sub = Submissions.get(id);
    if (!sub) return;
    if (decision === 'approve') {
      if (!confirm('Approve "' + sub.title + '" (' + sub.trackingNo + ')?')) return;
      const r = Submissions.decide(id, 'approve', '', '');
      if (!r.ok) return toast(r.error, 'error');
      toast(r.submission.status === 'approved_final' ? 'Approved — Final.' : 'Approved and forwarded.');
    } else {
      ApprovalUI.preview(id);
      setTimeout(() => { const t = document.getElementById('approvalReason'); if (t) t.focus(); }, 350);
      return;
    }
    ApprovalUI.refreshAll();
  },
  secretaryReject(id) {
    const commentEl = document.getElementById('approvalComment');
    const comment = commentEl ? commentEl.value : '';
    const reason = this._reason();
    if (!reason) return toast('Choose the reason the document is being returned.', 'error');
    if (reason === 'Other (see details)' && !comment.trim()) return toast('Describe the reason in the comment box.', 'error');
    const r = Submissions.rejectBySecretary(id, comment, reason);
    if (!r.ok) return toast(r.error, 'error');
    closeModal('approvalPreviewModal');
    toast('Returned to the teacher for correction: ' + reason, 'info');
    ApprovalUI.refreshAll();
  },
  publishPrompt(id) {
    const sub = Submissions.get(id);
    if (!sub) return;
    if (!Perm.canPublishDocuments()) return toast('Only the Secretary can publish.', 'error');
    if (sub.status !== 'approved_final') return toast('Record the Secretary\u2019s final approval first (current: ' + Submissions.statusLabel(sub.status) + ').', 'error');
    const target = prompt('Publish to which portal?\nType: student, staff or both', 'student');
    if (!target) return;
    const t = target.trim().toLowerCase();
    if (!['student', 'staff', 'both'].includes(t)) return toast('Invalid portal choice.', 'error');
    if (!confirm('Publish "' + sub.title + '" (' + sub.trackingNo + ') to the ' + t + ' portal?')) return;
    const r = Submissions.publish(id, t, '');
    if (!r.ok) return toast(r.error, 'error');
    closeModal('approvalPreviewModal');
    toast('Document published successfully.');
    ApprovalUI.refreshAll();
  },
  schedulePrompt(id) {
    const sub = Submissions.get(id);
    if (sub.status !== 'approved_final') return toast('Not awaiting publication.', 'error');
    const when = prompt('Scheduled publication date and time (YYYY-MM-DD HH:MM):', new Date(Date.now() + 86400000).toISOString().slice(0, 16).replace('T', ' '));
    if (!when) return;
    const target = prompt('Publish to which portal? student / staff / both', 'student');
    if (!target) return;
    const r = Submissions.publish(id, target.trim().toLowerCase(), when.trim());
    if (!r.ok) return toast(r.error, 'error');
    closeModal('approvalPreviewModal');
    toast('Publication scheduled for ' + when.trim() + '.');
    ApprovalUI.refreshAll();
  },
  unpublishPrompt(id) {
    const sub = Submissions.get(id);
    if (!sub) return;
    const reason = prompt('Reason for withdrawing "' + sub.title + '" from publication:');
    if (!reason || !reason.trim()) return toast('A recorded reason is required.', 'error');
    const r = Submissions.unpublish(id, reason);
    if (!r.ok) return toast(r.error, 'error');
    closeModal('approvalPreviewModal');
    toast('Document withdrawn from publication.', 'info');
    ApprovalUI.refreshAll();
  },
  openResubmit(id) {
    const sub = Submissions.get(id);
    if (!sub) return;
    if (sub.status !== 'rejected') return toast('Only rejected documents can be resubmitted.', 'error');
    if (!document.getElementById('subEditId')) return toast('The submission form is not available on this page.', 'error');
    document.getElementById('subEditId').value = id;
    const fill = (i, v) => { const el = document.getElementById(i); if (el) el.value = v || ''; };
    fill('subTitle', sub.title); fill('subType', sub.docType); fill('subClass', sub.classId);
    fill('subSubject', sub.subject); fill('subTerm', sub.term); fill('subYear', sub.academicYear); fill('subContent', sub.content);
    const info = document.getElementById('subFileInfo'); if (info) info.textContent = sub.fileName ? 'Current file: ' + sub.fileName : '';
    closeModal('approvalPreviewModal');
    const sec = document.getElementById('sec-submit-doc');
    if (sec) {
      document.querySelectorAll('.page-section').forEach(x => x.classList.remove('active'));
      sec.classList.add('active');
      document.querySelectorAll('.sidebar-nav a[data-section]').forEach(a => a.classList.toggle('active', a.dataset.section === 'submit-doc'));
      const th = document.getElementById('topbarTitle'); if (th) th.textContent = 'Correct & Resubmit Document';
    }
    toast('Correct the fields, then press Resubmit.', 'info');
  },
  async download(id) {
    const sub = Submissions.get(id);
    if (!sub) return;
    if (!Submissions.canView(sub)) return toast('Not authorized.', 'error');
    if (!sub.fileKey) return toast('No attachment.', 'error');
    try {
      const dataUrl = await ImageStore.get(sub.fileKey);
      if (!dataUrl) return toast('Attachment could not be loaded.', 'error');
      const a = document.createElement('a');
      a.href = dataUrl; a.download = (sub.fileName || sub.trackingNo.replace(/\//g, '-') + '.txt');
      document.body.appendChild(a); a.click(); a.remove();
      Audit.log('submission.download', sub.trackingNo + ' downloaded');
    } catch (e) { toast('Download failed.', 'error'); }
  },

  /* ---------- FORM (teacher / secretary submit page) ---------- */
  initSubmitForm() {
    const form = document.getElementById('subForm');
    if (!form || form.dataset.bound) return;
    form.dataset.bound = '1';
    fillSubmissionSelects();
    const cls = document.getElementById('subClass');
    if (cls) cls.addEventListener('change', fillSubmissionSubjectOptions);
    const file = document.getElementById('subFile');
    if (file) file.addEventListener('change', () => {
      const info = document.getElementById('subFileInfo');
      const f = file.files[0];
      if (info) info.textContent = f ? f.name + ' (' + Math.max(1, Math.round(f.size / 1024)) + ' KB)' : '';
    });
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const editingId = document.getElementById('subEditId').value || null;
      const data = ApprovalUI.collect();
      let fileName = '', fileKey = '';
      const fileInput = document.getElementById('subFile');
      if (fileInput && fileInput.files[0]) {
        const f = fileInput.files[0];
        if (f.size > 8 * 1024 * 1024) return toast('File too large (max 8MB).', 'error');
        const allowed = /\.(pdf|docx?|xlsx?|pptx?|txt|csv|jpg|jpeg|png|webp)$/i.test(f.name);
        if (!allowed) return toast('Unsupported file type.', 'error');
        fileName = f.name;
        fileKey = 'sub_' + DB.uid();
        toast('Uploading attachment…', 'info');
        try { await ImageStore.put(fileKey, await fileToDataUrl(f)); }
        catch (err) { return toast('File upload failed. Try a smaller file.', 'error'); }
      }
      data.fileName = fileName; data.fileKey = fileKey;
      let r;
      if (editingId) {
        r = Submissions.resubmit(editingId, data);
        if (r.ok) document.getElementById('subEditId').value = '';
      } else {
        r = Submissions.create(data);
      }
      if (!r.ok) return toast(r.error, 'error');
      form.reset();
      const info = document.getElementById('subFileInfo'); if (info) info.textContent = '';
      toast(editingId ? 'Document corrected and resubmitted — now awaiting Chief Examiner review.' : 'Document submitted — tracking number ' + r.submission.trackingNo);
      ApprovalUI.refreshAll();
    });
  },
  collect() {
    const classId = document.getElementById('subClass').value;
    const cls = Classes.get(classId);
    return {
      title: document.getElementById('subTitle').value.trim(),
      docType: document.getElementById('subType').value,
      classId,
      className: cls ? cls.name : (document.getElementById('subClass').selectedOptions[0] || {}).text || '',
      subject: document.getElementById('subSubject').value,
      term: document.getElementById('subTerm').value,
      academicYear: document.getElementById('subYear').value,
      content: document.getElementById('subContent').value.trim()
    };
  },

  /* ---------- SIDEBAR PENDING-COUNT BADGES ---------- */
  refreshBadges() {
    const show = (id, n) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = n;
      el.style.display = n > 0 ? '' : 'none';
    };
    try {
      const stats = Submissions.statsFor();
      const s = Auth.session();
      show('badge-approvals', stats.pending);
      show('badge-publishqueue', s && s.role === 'secretary' ? stats.secretary + stats.approved_final : 0);
      show('badge-mysubs', Submissions.myPendingCount());
    } catch (e) { console.error(e); }
  },

  /* ---------- REFRESH ALL KNOWN VIEWS ---------- */
  refreshAll() {
    try {
      const call = (fn, ...a) => { if (typeof fn === 'function') { try { fn(...a); } catch (e) { console.error(e); } } };
      call(window.renderMySubmissions);
      call(window.renderApprovalMonitor);
      call(window.renderPublishQueue);
      call(window.renderStudentDocuments);
      call(window.renderReviewDashboard);
      call(window.renderSubmissionStats);
      const d = document.body ? document.body.dataset.page : '';
      if (d === 'student' && typeof renderStudentDocuments === 'function') renderStudentDocuments();
      ApprovalUI.refreshBadges();
    } catch (e) { console.error(e); }
  }
};

/* ---------- helpers used by the forms ---------- */
function fillSubmissionSelects() {
  const clsSel = document.getElementById('subClass');
  if (clsSel) {
    const first = clsSel.options[0] ? clsSel.options[0].outerHTML : '<option value="">Select class…</option>';
    clsSel.innerHTML = first + Classes.list().map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  }
  const typeSel = document.getElementById('subType');
  if (typeSel && !typeSel.options.length) {
    typeSel.innerHTML = Submissions.TYPES.map(t => `<option value="${t.id}">${esc(t.label)}</option>`).join('');
  }
  const year = document.getElementById('subYear');
  if (year && !year.value) year.value = DB.get('settings', {}).academicYear || String(new Date().getFullYear());
  fillSubmissionSubjectOptions();
}
function fillSubmissionSubjectOptions() {
  const clsSel = document.getElementById('subClass');
  const subj = document.getElementById('subSubject');
  if (!clsSel || !subj) return;
  const cls = Classes.get(clsSel.value);
  const list = (cls && cls.subjects && cls.subjects.length) ? cls.subjects : DEFAULT_SUBJECTS;
  const cur = subj.value;
  subj.innerHTML = list.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
  if (list.includes(cur)) subj.value = cur;
}

/* ---------- TEACHER: MY SUBMISSIONS ---------- */
function renderMySubmissions() {
  const s = Auth.session();
  const box = document.getElementById('subMineBody');
  if (!box || !s) return;
  const mine = Submissions.forUser(s.id);
  const stats = {
    total: mine.length,
    pending: mine.filter(x => ['chiefexaminer', 'headteacher', 'secretary'].includes(x.status)).length,
    rejected: mine.filter(x => x.status === 'rejected').length,
    published: mine.filter(x => x.status === 'published').length
  };
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('subStatTotal', stats.total); set('subStatPending', stats.pending);
  set('subStatRejected', stats.rejected); set('subStatPublished', stats.published);
  if (!mine.length) {
    box.innerHTML = `<div class="empty-state"><i class="fas fa-paper-plane"></i><h4>No submissions yet</h4><p>Use "Submit for Approval" to send examination papers, marks, results, notes and other documents through the approval chain.</p></div>`;
    return;
  }
  box.innerHTML = `<div class="table-wrap"><table class="data-table">
    <thead><tr><th>Tracking No</th><th>Document</th><th>Type</th><th>Class / Subject</th><th>Submitted</th><th>Status</th><th>Next Action</th><th></th></tr></thead>
    <tbody>${mine.map(sub => `<tr>
      <td><code>${esc(sub.trackingNo)}</code></td>
      <td><strong>${esc(sub.title)}</strong> <span class="badge badge-navy" title="Version">v${esc(String(sub.version || 1))}</span></td>
      <td><span class="badge badge-navy"><i class="fas ${Submissions.typeIcon(sub.docType)}"></i> ${esc(Submissions.typeLabel(sub.docType))}</span></td>
      <td>${esc(sub.className || '—')}<br><small style="color:var(--text-light)">${esc(sub.subject || '')}</small></td>
      <td>${fmtDate(sub.submittedAt)}</td>
      <td>${ApprovalUI.badge(sub.status)}</td>
      <td style="font-size:.83rem">${esc(ApprovalUI.nextAction(sub))}</td>
      <td class="table-actions">
        <button class="btn btn-xs btn-outline" onclick="ApprovalUI.preview('${sub.id}')" title="Preview"><i class="fas fa-eye"></i></button>
        ${sub.status === 'rejected' ? `<button class="btn btn-xs btn-primary" onclick="ApprovalUI.openResubmit('${sub.id}')"><i class="fas fa-paper-plane"></i> Resubmit</button>` : ''}
        <button class="btn btn-xs btn-danger" onclick="deleteSubmission('${sub.id}')" title="Delete this submission"><i class="fas fa-trash"></i> Delete</button>
      </td>
    </tr>`).join('')}</tbody></table></div>`;
}
/* Delete a submission from the teacher's own list (data layer re-checks). */
function deleteSubmission(id) {
  const sub = (typeof Submissions !== 'undefined') ? Submissions.get(id) : null;
  if (!sub) { toast('Submission not found.', 'error'); return; }
  const live = sub.status === 'published';
  const msg = live
    ? 'Delete "' + sub.title + '" (' + sub.trackingNo + ')?\n\nIt is currently published — deleting it will also remove it from the student portal.\nThis cannot be undone.'
    : 'Delete "' + sub.title + '" (' + sub.trackingNo + ')?\n\nThis cannot be undone.';
  if (!confirm(msg)) return;
  const r = Submissions.remove(id);
  if (!r.ok) { toast(r.error, 'error'); return; }
  toast('Submission deleted.');
  if (typeof renderMySubmissions === 'function') renderMySubmissions();
  if (typeof renderApprovalMonitor === 'function' && document.getElementById('admSubBody')) renderApprovalMonitor();
}
ApprovalUI.nextAction = function (sub) {
  if (sub.status === 'draft') return 'You must submit this document.';
  if (sub.status === 'chiefexaminer') return 'Awaiting Chief Examiner review (v' + (sub.version || 1) + ').';
  if (sub.status === 'headteacher') return 'Chief Examiner approved — awaiting Headteacher review.';
  if (sub.status === 'secretary') return 'Headteacher approved — awaiting Secretary final approval.';
  if (sub.status === 'approved_final') return 'Approved — Final. Awaiting Secretary publication.';
  if (sub.status === 'rejected') return 'Returned for correction — correct and resubmit as v' + ((Number(sub.version) || 1) + 1) + '.';
  if (sub.status === 'published') return 'Published on ' + String(sub.publishedAt || '').slice(0, 16).replace('T', ' ') + ' to the ' + sub.publishTarget + ' portal.';
  if (sub.status === 'withdrawn') return 'Withdrawn from publication: ' + (sub.withdrawReason || '');
  return '—';
};

/* ---------- ADMIN / MONITOR ---------- */
function renderApprovalMonitor() {
  const stSel = document.getElementById('admSubStatus');
  if (stSel && stSel.options.length < 2) {
    stSel.innerHTML = '<option value="">All Statuses</option>' +
      Object.keys(Submissions.STATUS).map(k => `<option value="${k}">${esc(Submissions.statusLabel(k))}</option>`).join('');
  }
  const tpSel = document.getElementById('admSubType');
  if (tpSel && tpSel.options.length < 2) {
    tpSel.innerHTML = '<option value="">All Types</option>' + Submissions.TYPES.map(t => `<option value="${t.id}">${esc(t.label)}</option>`).join('');
  }
  ['admSubStatus', 'admSubType', 'admSubSearch'].forEach(id => {
    const el = document.getElementById(id);
    if (!el || el.dataset.bound) return;
    el.dataset.bound = '1';
    el.addEventListener('input', renderApprovalMonitor);
    el.addEventListener('change', renderApprovalMonitor);
  });
  const box = document.getElementById('admSubBody');
  if (!box) return;
  const stats = Submissions.statsFor();
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('admSubTotal', stats.total); set('admSubChief', stats.chiefexaminer);
  set('admSubHead', stats.headteacher); set('admSubSec', stats.secretary);
  set('admSubPublished', stats.published); set('admSubRejected', stats.rejected);
  ApprovalUI.renderQueue('admSubBody', {
    filter: () => true, showSubmitter: true, emptyText: 'No documents have been submitted yet.',
    filterId: 'admSubStatus', typeFilterId: 'admSubType', searchId: 'admSubSearch'
  });
}

/* ---------- STUDENT: PUBLISHED DOCUMENTS ---------- */
function renderStudentDocuments() {
  const box = document.getElementById('stuDocsBody');
  if (!box) return;
  const srch = document.getElementById('stuDocsSearch');
  if (srch && !srch.dataset.bound) {
    srch.dataset.bound = '1';
    srch.addEventListener('input', renderStudentDocuments);
  }
  const s = Auth.session();
  if (!s) return;
  let docs = Submissions.publishedForAudience('student').concat(Submissions.publishedForAudience('both'));
  docs = docs.filter(d => Submissions.canView(d));
  const search = ((document.getElementById('stuDocsSearch') || {}).value || '').toLowerCase();
  if (search) docs = docs.filter(d => (d.title + ' ' + d.subject + ' ' + d.className).toLowerCase().includes(search));
  if (!docs.length) {
    box.innerHTML = `<div class="empty-state"><i class="fas fa-folder-open"></i><h4>No published documents</h4><p>Approved examination timetables, papers, results, homework and notes appear here once the Secretary publishes them.</p></div>`;
    return;
  }
  box.innerHTML = docs.map(d => `
    <div style="display:flex;gap:14px;align-items:flex-start;padding:14px 0;border-bottom:1px solid var(--border);flex-wrap:wrap">
      <div style="width:42px;height:42px;border-radius:10px;background:rgba(15,44,76,.08);color:var(--navy);display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="fas ${Submissions.typeIcon(d.docType)}"></i></div>
      <div style="flex:1;min-width:220px">
        <strong style="color:var(--navy)">${esc(d.title)}</strong>
        <span class="badge badge-success" style="margin-left:6px">Published</span>
        <p style="font-size:.85rem;color:var(--text-light);margin:4px 0">${esc(Submissions.typeLabel(d.docType))} · ${esc(d.subject)} · ${esc(d.className || 'All classes')} · Term ${esc(d.term)} ${esc(d.academicYear)}</p>
        <small style="color:var(--text-light)">Published ${fmtDate(d.publishedAt)} by ${esc(d.publishedBy)} · <code>${esc(d.trackingNo)}</code></small>
      </div>
      <div class="table-actions">
        <button class="btn btn-sm btn-outline" onclick="ApprovalUI.preview('${d.id}')"><i class="fas fa-eye"></i> Preview</button>
        ${d.fileKey ? `<button class="btn btn-sm btn-primary" onclick="ApprovalUI.download('${d.id}')"><i class="fas fa-download"></i> Download</button>` : ''}
      </div>
    </div>`).join('');
}

/* ---------- SIDEBAR HOOK ---------- */
window.onSectionOpen = (function (prev) {
  return function (section, anchor) {
    if (typeof prev === 'function') { try { prev(section, anchor); } catch (e) { console.error(e); } }
    try {
      if (section === 'submit-doc' && typeof ApprovalUI.initSubmitForm === 'function') ApprovalUI.initSubmitForm();
      if (section === 'my-submissions' && typeof renderMySubmissions === 'function') renderMySubmissions();
      if (section === 'approvals-monitor' && typeof renderApprovalMonitor === 'function') renderApprovalMonitor();
      if (section === 'publish-queue' && typeof renderPublishQueue === 'function') renderPublishQueue();
      if (section === 'school-documents' && typeof renderStudentDocuments === 'function') renderStudentDocuments();
      if (['ce-queue', 'ce-reviewed'].includes(section) && typeof renderChiefExaminerQueue === 'function') renderChiefExaminerQueue();
      if (['ht-queue', 'ht-reviewed'].includes(section) && typeof renderHeadteacherQueue === 'function') renderHeadteacherQueue();
      ApprovalUI.refreshBadges();
    } catch (e) { console.error(e); }
  };
})(window.onSectionOpen);

/* ---------- LEGACY CONTENT ENROLMENT ----------
   Anything a teacher authored before the gate existed has no verifiable
   approval history. Quarantine it from the student portal and enrol it in the
   queue so authorized staff can walk it through the chain. Idempotent. */
try {
  if (typeof ApprovalGate !== 'undefined' && typeof Submissions !== 'undefined') ApprovalGate.migrate();
} catch (e) {
  console.error('Approval-gate migration skipped:', e);
}
