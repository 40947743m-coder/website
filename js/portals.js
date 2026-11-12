/* ============================================================
   ST. TERESA ACADEMY — PORTAL UI LAYER
   Admin sections · Teacher sections · Student portal · Parent portal
   Loaded AFTER admin.js + modules.js
   ============================================================ */

/* ============================================================
   ADMIN: ACADEMIC YEARS
   ============================================================ */
function initAcademicSettingsSection() {
  const f = document.getElementById('academicYearForm');
  if (f && !f.dataset.bound) {
    f.dataset.bound = '1';
    f.addEventListener('submit', e => {
      e.preventDefault();
      const editingId = document.getElementById('ayEditId').value || null;
      const terms = [...document.querySelectorAll('.ayTerm:checked')].map(c => Number(c.value)).sort((a, b) => a - b);
      const data = {
        label: document.getElementById('ayLabel').value.trim(),
        startDate: document.getElementById('ayStart').value,
        endDate: document.getElementById('ayEnd').value,
        terms: terms.length ? terms : [1],
        defaultTerm: Number(document.getElementById('ayDefaultTerm').value) || (terms[0] || 1),
        status: document.getElementById('ayStatus').value,
        notes: document.getElementById('ayNotes').value
      };
      /* keep the default term inside the chosen term set */
      if (!terms.includes(data.defaultTerm)) data.defaultTerm = terms[0] || 1;

      const r = AcademicYears.save(data, editingId);
      if (!r.ok) { toast(r.error, 'error'); return; }
      /* first year created — automatically make it the school's current year */
      if (!editingId && AcademicYears.list().length === 1) AcademicYears.setActive(AcademicYears.byLabel(data.label).id);
      toast(editingId ? 'Academic year updated.' : 'Academic year created.');
      closeModal('academicYearModal');
      renderAcademicYearsTable();
    });
  }
  renderAcademicYearsTable();
}

function renderAcademicYearsTable() {
  const body = document.getElementById('ayTableBody');
  if (!body) return;
  const items = AcademicYears.list().slice().sort((a, b) => String(b.label).localeCompare(String(a.label), undefined, { numeric: true }));
  const curId = (DB.get('settings', {}) || {}).academicYearId;
  const badge = document.getElementById('ayActiveBadge');
  if (badge) badge.textContent = 'Current year: ' + AcademicYears.activeYear();

  if (!items.length) {
    body.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-light)">No academic years configured yet. Click <strong>Add Academic Year</strong> to create the first one.</td></tr>';
    return;
  }
  const todayStr = today();
  body.innerHTML = items.map(y => {
    const isCur = y.id === curId;
    const ended = y.endDate && y.endDate < todayStr;
    let statusHtml;
    if (isCur) statusHtml = '<span class="badge badge-navy">Current</span>';
    else if (ended) statusHtml = '<span class="badge badge-secondary">Ended</span>';
    else if (y.status === 'inactive') statusHtml = '<span class="badge badge-secondary">Inactive</span>';
    else statusHtml = '<span class="badge badge-success">Active</span>';

    return `<tr>
      <td><strong>${esc(y.label)}</strong>${isCur ? ' <small style="color:var(--text-light)">(default)</small>' : ''}${y.archived ? ' <small style="color:var(--text-light)">(archived)</small>' : ''}</td>
      <td>${esc(y.startDate || '')}</td>
      <td>${esc(y.endDate || '')}</td>
      <td>${(y.terms || []).map(t => 'Term ' + t).join(', ')}</td>
      <td>${statusHtml}</td>
      <td style="white-space:nowrap">
        ${isCur ? '' : `<button class="btn btn-xs btn-outline" onclick="setActiveAcademicYear('${y.id}')" title="Make this the current academic year"><i class="fas fa-star"></i> Make Current</button>`}
        <button class="btn btn-xs btn-outline" onclick="editAcademicYear('${y.id}')" title="Edit"><i class="fas fa-pen"></i></button>
        ${isCur || y.archived ? '' : `<button class="btn btn-xs btn-outline" onclick="archiveAcademicYear('${y.id}', '${esc(y.label)}')" title="Archive"><i class="fas fa-box-archive"></i></button>`}
      </td>
    </tr>`;
  }).join('');
}

function openAddAcademicYear() {
  const f = document.getElementById('academicYearForm');
  f.reset();
  document.getElementById('ayEditId').value = '';
  document.getElementById('ayModalTitle').textContent = 'Add Academic Year';
  const def = document.getElementById('ayLabel');
  if (def) def.value = String(new Date().getFullYear());
  const s = document.getElementById('ayStart'); if (s) s.value = (def.value || '') + '-01-01';
  const e = document.getElementById('ayEnd'); if (e) e.value = (def.value || '') + '-12-31';
  document.querySelectorAll('.ayTerm').forEach(c => c.checked = true);
  const d = document.getElementById('ayDefaultTerm'); if (d) d.value = '1';
  openModal('academicYearModal');
}

function editAcademicYear(id) {
  const y = AcademicYears.get(id);
  if (!y) return;
  document.getElementById('ayEditId').value = y.id;
  document.getElementById('ayLabel').value = y.label;
  document.getElementById('ayStart').value = y.startDate || '';
  document.getElementById('ayEnd').value = y.endDate || '';
  document.getElementById('ayStatus').value = y.status === 'inactive' ? 'inactive' : 'active';
  document.getElementById('ayNotes').value = y.notes || '';
  const terms = (y.terms || [1, 2, 3]).map(Number);
  document.querySelectorAll('.ayTerm').forEach(c => c.checked = terms.includes(Number(c.value)));
  const d = document.getElementById('ayDefaultTerm');
  if (d) d.value = String(terms.includes(Number(y.defaultTerm)) ? y.defaultTerm : terms[0] || 1);
  document.getElementById('ayModalTitle').textContent = 'Edit ' + y.label;
  openModal('academicYearModal');
}

function setActiveAcademicYear(id) {
  const r = AcademicYears.setActive(id);
  toast(r.ok ? 'Current academic year set to ' + r.label + '.' : r.error, r.ok ? 'success' : 'error');
  if (r.ok) renderAcademicYearsTable();
}

function archiveAcademicYear(id, label) {
  if (!confirm('Archive academic year ' + label + '? It will no longer be available for new admissions. Existing records keep the year they were created under.')) return;
  const r = AcademicYears.remove(id);
  toast(r.ok ? 'Academic year ' + label + ' archived.' : r.error, r.ok ? 'success' : 'error');
  if (r.ok) renderAcademicYearsTable();
}

/* ============================================================
   ADMIN: CLASSES
   ============================================================ */
function initClassesSection() {
  renderClassesGrid();
  fillClassSelects();

  const form = document.getElementById('classForm');
  if (form && !form.dataset.bound) {
    form.dataset.bound = '1';
    form.addEventListener('submit', e => {
      e.preventDefault();
      const editingId = document.getElementById('clsEditId').value || null;
      const subjects = [...document.querySelectorAll('#clsSubjects input:checked')].map(x => x.value);
      const data = {
        name: document.getElementById('clsName').value,
        academicYear: document.getElementById('clsYear').value,
        term: document.getElementById('clsTerm').value,
        status: document.getElementById('clsStatus').value,
        subjects
      };
      const res = Classes.save(data, editingId);
      if (!res.ok) { toast(res.error, 'error'); return; }
      toast(editingId ? 'Class updated!' : 'Class created!');
      closeModal('classModal');
      renderClassesGrid();
      fillClassSelects();
      loadAdminDashboard();
    });
  }

  const atForm = document.getElementById('assignTeacherForm');
  if (atForm && !atForm.dataset.bound) {
    atForm.dataset.bound = '1';
    atForm.addEventListener('submit', e => {
      e.preventDefault();
      const classId = document.getElementById('asgClassId').value;
      const teacherId = document.getElementById('asgTeacherId').value;
      const res = ClassTeacher.assign(classId, teacherId);
      if (!res.ok) { toast(res.error, 'error'); return; }
      toast('Class teacher assigned!');
      closeModal('assignTeacherModal');
      renderClassesGrid();
    });
  }
}

function renderClassesGrid() {
  const grid = document.getElementById('classesGrid');
  if (!grid) return;
  const yearBadge = document.getElementById('classesYearBadge');
  if (yearBadge) yearBadge.textContent = 'Academic Year ' + Classes.activeYear();
  const classes = Classes.list();
  grid.innerHTML = classes.map(c => {
    const enrolled = Classes.enrolledCount(c.id);
    const hasT = !!c.teacherId;
    const tInitials = hasT ? initials(c.teacherName) : '';
    return `
    <div class="panel class-card ${hasT ? '' : 'class-warn'}">
      <div class="panel-head">
        <h3><i class="fas fa-school" style="color:var(--gold)"></i> ${esc(c.name)}</h3>
        <span class="badge badge-${hasT ? 'success' : 'danger'}">${hasT ? 'Teacher Assigned' : 'No Class Teacher'}</span>
      </div>
      <div class="panel-body">
        <div style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap">
          <div style="flex:1;min-width:180px">
            <p style="font-size:0.85rem;color:var(--text-light);margin-bottom:4px"><i class="fas fa-calendar"></i> ${esc(c.academicYear)} · Term ${esc(c.term)}</p>
            <p style="font-size:0.85rem;color:var(--text-light);margin-bottom:4px"><i class="fas fa-user-graduate"></i> ${enrolled} student${enrolled === 1 ? '' : 's'} enrolled</p>
            <p style="font-size:0.85rem;color:var(--text-light);margin-bottom:4px"><i class="fas fa-book"></i> ${(c.subjects || []).length} subjects</p>
            ${c.assignmentDate ? `<p style="font-size:0.78rem;color:var(--text-light)"><i class="fas fa-clock"></i> Assigned ${fmtDate(c.assignmentDate)}</p>` : ''}
          </div>
          <div style="min-width:170px">
            ${hasT ? `
              <div style="display:flex;gap:10px;align-items:center">
                <div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,var(--navy),var(--navy-light));color:var(--gold);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.85rem;flex-shrink:0">${tInitials}</div>
                <div>
                  <strong style="color:var(--navy);font-size:0.9rem">${esc(c.teacherName)}</strong><br>
                  <small style="color:var(--text-light)">Class Teacher</small>
                </div>
              </div>
            ` : `
              <p style="color:var(--danger);font-size:0.85rem;font-weight:600"><i class="fas fa-triangle-exclamation"></i> No teacher assigned</p>
            `}
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">
          <button class="btn btn-sm btn-primary" onclick="openAssignTeacher('${c.id}')"><i class="fas fa-user-check"></i> ${hasT ? 'Replace Teacher' : 'Assign Teacher'}</button>
          <button class="btn btn-sm btn-outline" onclick="viewClassHistory('${c.id}')"><i class="fas fa-clock-rotate-left"></i> History</button>
          <button class="btn btn-sm btn-outline" onclick="editClass('${c.id}')"><i class="fas fa-pen"></i> Edit</button>
          <button class="btn btn-sm btn-gold" onclick="promoteClass('${c.id}')"><i class="fas fa-arrow-up"></i> Promote</button>
          ${hasT ? `<button class="btn btn-sm btn-danger" onclick="unassignTeacher('${c.id}')"><i class="fas fa-user-xmark"></i> Unassign</button>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}

function openAddClass() {
  document.getElementById('classForm').reset();
  document.getElementById('clsEditId').value = '';
  const sel = document.getElementById('clsName');
  const used = Classes.list().map(c => c.name);
  const options = (typeof OFFICIAL_CLASSES !== 'undefined') ? OFFICIAL_CLASSES : ACADEMIC_CLASSES;
  sel.innerHTML = options.map(n => `<option value="${n}" ${used.includes(n) ? 'disabled' : ''}>${n}${used.includes(n) ? ' (exists)' : ''}</option>`).join('');
  fillAcademicYearSelect(document.getElementById('clsYear'), document.getElementById('clsTerm'),
    { current: Classes.activeYear(), selected: Classes.activeYear(), defaultTerm: (AcademicYears.activeRecord() || {}).defaultTerm || DB.get('settings', {}).term || '1' });
  renderSubjectCheckboxes(DEFAULT_SUBJECTS);
  document.getElementById('classModalTitle').textContent = 'Add Class';
  openModal('classModal');
}

function editClass(id) {
  const c = Classes.get(id);
  if (!c) return;
  document.getElementById('clsEditId').value = c.id;
  const sel = document.getElementById('clsName');
  const options = (typeof OFFICIAL_CLASSES !== 'undefined') ? OFFICIAL_CLASSES : ACADEMIC_CLASSES;
  sel.innerHTML = options.map(n => `<option value="${n}" ${n === c.name ? 'selected' : ''}>${n}</option>`).join('');
  fillAcademicYearSelect(document.getElementById('clsYear'), document.getElementById('clsTerm'),
    { current: Classes.activeYear(), selected: c.academicYear, defaultTerm: c.term || '1' });
  document.getElementById('clsStatus').value = c.status || 'active';
  renderSubjectCheckboxes(c.subjects || DEFAULT_SUBJECTS);
  document.getElementById('classModalTitle').textContent = 'Edit ' + c.name;
  openModal('classModal');
}

function renderSubjectCheckboxes(selected) {
  const box = document.getElementById('clsSubjects');
  if (!box) return;
  box.innerHTML = DEFAULT_SUBJECTS.map(s => `
    <label style="display:flex;align-items:center;gap:6px;font-size:0.85rem;background:var(--cream);padding:6px 12px;border-radius:6px;cursor:pointer">
      <input type="checkbox" value="${s}" ${selected.includes(s) ? 'checked' : ''}> ${s}
    </label>`).join('');
}

function openAssignTeacher(classId) {
  const c = Classes.get(classId);
  if (!c) return;
  document.getElementById('asgClassId').value = classId;
  document.getElementById('assignTeacherTitle').textContent = 'Assign Class Teacher — ' + c.name;
  const sel = document.getElementById('asgTeacherId');
  const teachers = DB.get('teachers').filter(t => t.status !== 'inactive');
  sel.innerHTML = teachers.map(t => `<option value="${t.id}" ${c.teacherId === t.id ? 'selected' : ''}>${esc(teacherDisplayName(t))} — ${esc(t.subject || '')}</option>`).join('');
  if (!teachers.length) sel.innerHTML = '<option value="">No active teachers</option>';
  openModal('assignTeacherModal');
}

function unassignTeacher(classId) {
  if (!confirm('Remove the class teacher? The class will show a warning until reassigned.')) return;
  const res = ClassTeacher.unassign(classId);
  if (!res.ok) { toast(res.error, 'error'); return; }
  toast('Class teacher removed.', 'info');
  renderClassesGrid();
}

function promoteClass(classId) {
  const c = Classes.get(classId);
  if (!c) return;
  if (!confirm('Promote all active students in ' + c.name + ' to the next class? Their history is preserved.')) return;
  const res = Classes.promote(classId);
  if (!res.ok) { toast(res.error, 'error'); return; }
  toast(res.count + ' student(s) promoted to ' + res.next + '!');
}

function viewClassHistory(classId) {
  const c = Classes.get(classId);
  if (!c) return;
  const hist = ClassTeacher.history(classId);
  const body = document.getElementById('previewExamBody');
  if (!body) return;
  body.innerHTML = `
    <h3 style="color:var(--navy);margin-bottom:12px">Class Teacher History — ${esc(c.name)}</h3>
    ${hist.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Teacher</th><th>Assigned</th><th>Replaced</th><th>By</th></tr></thead><tbody>
      ${hist.map(h => `<tr><td>${esc(h.teacherName)}</td><td>${fmtDate(h.assignedAt)}</td><td>${h.replacedAt ? fmtDate(h.replacedAt) : '<span class="badge badge-success">Current</span>'}</td><td>${esc(h.assignedBy || '—')}</td></tr>`).join('')}
    </tbody></table></div>` : '<p style="color:var(--text-light)">No assignment history yet.</p>'}`;
  openModal('previewExamModal');
}

function fillClassSelects() {
  const classes = Classes.list();
  const opts = classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  const byId = ['attAdminClass', 'ntClass', 'annClass', 'exsClass'];
  byId.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const first = el.options[0] ? el.options[0].outerHTML : '<option value="">—</option>';
    el.innerHTML = first + opts;
  });
  const subjSel = document.getElementById('exsSubject');
  if (subjSel && !subjSel.options.length) {
    subjSel.innerHTML = DEFAULT_SUBJECTS.map(s => `<option value="${s}">${s}</option>`).join('');
  }
}

/* ============================================================
   ADMIN: HOMEWORK OVERVIEW
   ============================================================ */
function initHomeworkAdminSection() {
  renderHomeworkAdmin();
}

function renderHomeworkAdmin() {
  const tbody = document.getElementById('homeworkAdminBody');
  if (!tbody) return;
  const items = Homework.list();
  tbody.innerHTML = items.length ? items.map(h => {
    const st = Homework.statusOf(h);
    const badge = { draft: 'warning', published: 'success', active: 'success', upcoming: 'navy', overdue: 'danger', closed: 'danger' }[st] || 'navy';
    return `
    <tr>
      <td><strong>${esc(h.title)}</strong></td>
      <td>${esc(h.className)}</td>
      <td>${esc(h.subject)}</td>
      <td>${esc(h.teacherName)}</td>
      <td>${fmtDate(h.deadline)}</td>
      <td><span class="badge badge-${badge}">${st}</span></td>
      <td class="table-actions">
        ${h.status === 'draft'
          ? `<button class="btn btn-xs btn-primary" onclick="adminPublishHomework('${h.id}')"><i class="fas fa-check"></i></button>`
          : `<button class="btn btn-xs btn-outline" onclick="adminUnpublishHomework('${h.id}')"><i class="fas fa-eye-slash"></i></button>`}
        <button class="btn btn-xs btn-danger" onclick="adminDeleteHomework('${h.id}')"><i class="fas fa-trash"></i></button>
      </td>
    </tr>`;
  }).join('') : `<tr><td colspan="7" style="text-align:center;padding:36px;color:var(--text-light)">No homework set yet</td></tr>`;
}

function adminPublishHomework(id) {
  const r = Homework.publish(id);
  if (!r.ok) { toast(r.error, 'error'); return; }
  toast('Homework published to students.');
  renderHomeworkAdmin();
}

function adminUnpublishHomework(id) {
  const r = Homework.unpublish(id);
  if (!r.ok) { toast(r.error, 'error'); return; }
  toast('Homework unpublished.', 'info');
  renderHomeworkAdmin();
}

function adminDeleteHomework(id) {
  if (!confirm('Delete this homework?')) return;
  const r = Homework.remove(id);
  if (!r.ok) { toast(r.error, 'error'); return; }
  toast('Homework deleted.', 'info');
  renderHomeworkAdmin();
}

/* ============================================================
   ADMIN: ATTENDANCE
   ============================================================ */
function initAttendanceAdminSection() {
  const dateEl = document.getElementById('attAdminDate');
  const classEl = document.getElementById('attAdminClass');
  if (dateEl && !dateEl.value) dateEl.value = today();
  if (dateEl && !dateEl.dataset.bound) {
    dateEl.dataset.bound = '1';
    dateEl.addEventListener('change', renderAttendanceAdmin);
    classEl.addEventListener('change', renderAttendanceAdmin);
  }
  renderAttendanceAdmin();
}

function renderAttendanceAdmin() {
  const tbody = document.getElementById('attAdminBody');
  if (!tbody) return;
  const date = (document.getElementById('attAdminDate') || {}).value || today();
  const classId = (document.getElementById('attAdminClass') || {}).value || '';
  let recs = Attendance.list().filter(a => a.date === date);
  if (classId) recs = recs.filter(a => a.classId === classId);
  tbody.innerHTML = recs.length ? recs.map(a => `
    <tr>
      <td>${esc(a.admissionNo || '—')}</td>
      <td><strong>${esc(a.studentName)}</strong></td>
      <td>${esc(a.className)}</td>
      <td><span class="badge badge-${a.status === 'present' ? 'success' : a.status === 'absent' ? 'danger' : a.status === 'late' ? 'warning' : 'navy'}">${esc(a.status)}</span></td>
      <td>${esc(a.arrivalTime || '—')}</td>
      <td>${esc(a.remarks || '—')}</td>
      <td>${esc(a.markedBy || '—')}</td>
    </tr>`).join('') : `<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text-light)">No attendance recorded for this date</td></tr>`;

  // summary cards
  const sumBox = document.getElementById('attAdminSummary');
  if (sumBox) {
    const present = recs.filter(r => r.status === 'present').length;
    const absent = recs.filter(r => r.status === 'absent').length;
    const late = recs.filter(r => r.status === 'late').length;
    const excused = recs.filter(r => r.status === 'excused').length;
    sumBox.innerHTML = `
      <div class="stat-card"><div class="s-icon green"><i class="fas fa-check"></i></div><div class="s-info"><div class="s-num">${present}</div><div class="s-label">Present</div></div></div>
      <div class="stat-card"><div class="s-icon red"><i class="fas fa-xmark"></i></div><div class="s-info"><div class="s-num">${absent}</div><div class="s-label">Absent</div></div></div>
      <div class="stat-card"><div class="s-icon gold"><i class="fas fa-clock"></i></div><div class="s-info"><div class="s-num">${late}</div><div class="s-label">Late</div></div></div>
      <div class="stat-card"><div class="s-icon blue"><i class="fas fa-file-circle-plus"></i></div><div class="s-info"><div class="s-num">${excused}</div><div class="s-label">Excused</div></div></div>`;
  }
}

/* ============================================================
   ADMIN: EXAM SCHEDULE
   ============================================================ */
function initExamScheduleSection() {
  renderExamScheduleAdmin();
  const form = document.getElementById('examScheduleForm');
  if (form && !form.dataset.bound) {
    form.dataset.bound = '1';
    form.addEventListener('submit', e => {
      e.preventDefault();
      const editingId = document.getElementById('exsEditId').value || null;
      const classId = document.getElementById('exsClass').value;
      const cls = Classes.get(classId);
      const data = {
        title: document.getElementById('exsTitle').value.trim(),
        className: cls ? cls.name : '',
        subject: document.getElementById('exsSubject').value,
        date: document.getElementById('exsDate').value,
        startTime: document.getElementById('exsStart').value,
        endTime: document.getElementById('exsEnd').value,
        venue: document.getElementById('exsVenue').value.trim(),
        instructions: document.getElementById('exsInstructions').value.trim(),
        revisionMaterials: document.getElementById('exsRevision').value.trim(),
        status: document.getElementById('exsStatus').value
      };
      const r = ExamSchedule.save(data, editingId);
      if (!r.ok) { toast(r.error, 'error'); return; }
      toast(editingId ? 'Exam updated!' : 'Exam scheduled!');
      closeModal('examScheduleModal');
      renderExamScheduleAdmin();
    });
  }
}

function renderExamScheduleAdmin() {
  const tbody = document.getElementById('examScheduleBody');
  if (!tbody) return;
  const items = ExamSchedule.list();
  tbody.innerHTML = items.length ? items.map(e => `
    <tr>
      <td><strong>${esc(e.title)}</strong></td>
      <td>${esc(e.className)}</td>
      <td>${esc(e.subject)}</td>
      <td>${fmtDate(e.date)}</td>
      <td>${esc(e.startTime || '—')}–${esc(e.endTime || '')}</td>
      <td>${esc(e.venue || '—')}</td>
      <td><span class="badge badge-${e.status === 'draft' ? 'warning' : 'success'}">${esc(e.status)}</span></td>
      <td class="table-actions">
        <button class="btn btn-xs btn-outline" onclick="editExamSchedule('${e.id}')"><i class="fas fa-pen"></i></button>
        <button class="btn btn-xs btn-danger" onclick="deleteExamSchedule('${e.id}')"><i class="fas fa-trash"></i></button>
      </td>
    </tr>`).join('') : `<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--text-light)">No exams scheduled</td></tr>`;
}

function openAddExamSchedule() {
  document.getElementById('examScheduleForm').reset();
  document.getElementById('exsEditId').value = '';
  fillClassSelects();
  document.getElementById('examScheduleModalTitle').textContent = 'Add Exam';
  openModal('examScheduleModal');
}

function editExamSchedule(id) {
  const e = ExamSchedule.get(id);
  if (!e) return;
  fillClassSelects();
  document.getElementById('exsEditId').value = e.id;
  document.getElementById('exsTitle').value = e.title || '';
  const cls = Classes.list().find(c => c.name === e.className);
  document.getElementById('exsClass').value = cls ? cls.id : '';
  document.getElementById('exsSubject').value = e.subject || '';
  document.getElementById('exsDate').value = e.date || '';
  document.getElementById('exsStart').value = e.startTime || '';
  document.getElementById('exsEnd').value = e.endTime || '';
  document.getElementById('exsVenue').value = e.venue || '';
  document.getElementById('exsInstructions').value = e.instructions || '';
  document.getElementById('exsRevision').value = e.revisionMaterials || '';
  document.getElementById('exsStatus').value = e.status || 'scheduled';
  document.getElementById('examScheduleModalTitle').textContent = 'Edit Exam';
  openModal('examScheduleModal');
}

function deleteExamSchedule(id) {
  if (!confirm('Delete this exam from the schedule?')) return;
  const r = ExamSchedule.remove(id);
  if (!r.ok) { toast(r.error, 'error'); return; }
  toast('Exam removed.', 'info');
  renderExamScheduleAdmin();
}

/* ============================================================
   ADMIN: MATERIALS
   ============================================================ */
function initMaterialsAdminSection() { renderMaterialsAdmin(); }

function renderMaterialsAdmin() {
  const tbody = document.getElementById('materialsAdminBody');
  if (!tbody) return;
  const items = Materials.list();
  tbody.innerHTML = items.length ? items.map(m => `
    <tr>
      <td><strong>${esc(m.title)}</strong><br><small style="color:var(--text-light)">${esc(m.fileName || '')}</small></td>
      <td>${esc(m.className)}</td>
      <td>${esc(m.subject)}</td>
      <td>${esc(m.category)}</td>
      <td>${esc(m.uploadedBy)}</td>
      <td>${fmtDate(m.uploadedAt)}</td>
      <td><span class="badge badge-${m.status === 'published' ? 'success' : 'warning'}">${esc(m.status)}</span></td>
      <td class="table-actions">
        <button class="btn btn-xs btn-outline" onclick="viewMaterial('${m.id}')"><i class="fas fa-eye"></i></button>
        <button class="btn btn-xs btn-danger" onclick="adminDeleteMaterial('${m.id}')"><i class="fas fa-trash"></i></button>
      </td>
    </tr>`).join('') : `<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--text-light)">No materials uploaded</td></tr>`;
}

function adminDeleteMaterial(id) {
  if (!confirm('Delete this material?')) return;
  const r = Materials.remove(id);
  if (!r.ok) { toast(r.error, 'error'); return; }
  toast('Material deleted.', 'info');
  renderMaterialsAdmin();
}

/* ============================================================
   ADMIN: ANNOUNCEMENTS
   ============================================================ */
function initAnnouncementsSection() {
  renderAnnouncementsAdmin();
  const form = document.getElementById('announcementForm');
  if (form && !form.dataset.bound) {
    form.dataset.bound = '1';
    form.addEventListener('submit', e => {
      e.preventDefault();
      const audience = document.getElementById('annAudience').value;
      const classId = audience === 'class' ? document.getElementById('annClass').value : '';
      const cls = classId ? Classes.get(classId) : null;
      const r = Announcements.save({
        title: document.getElementById('annTitle').value,
        content: document.getElementById('annContent').value,
        classId, className: cls ? cls.name : ''
      });
      if (!r.ok) { toast(r.error, 'error'); return; }
      toast('Announcement published!');
      form.reset();
      closeModal('announcementModal');
      renderAnnouncementsAdmin();
    });
  }
}

function renderAnnouncementsAdmin() {
  const box = document.getElementById('announcementsList');
  if (!box) return;
  const items = Announcements.list();
  box.innerHTML = items.length ? items.map(a => `
    <div style="padding:14px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap">
      <div style="flex:1;min-width:200px">
        <strong style="color:var(--navy)">${esc(a.title)}</strong>
        <span class="badge badge-${a.audience === 'all' ? 'navy' : 'gold'}" style="margin-left:8px">${a.audience === 'all' ? 'School-wide' : esc(a.className)}</span>
        <p style="font-size:0.85rem;color:var(--text-light);margin-top:4px">${esc(a.content || '')}</p>
        <small style="color:var(--text-light)">By ${esc(a.createdBy)} · ${fmtDate(a.createdAt)}</small>
      </div>
      <button class="btn btn-xs btn-danger" onclick="deleteAnnouncement('${a.id}')"><i class="fas fa-trash"></i></button>
    </div>`).join('') : `<div class="empty-state"><i class="fas fa-bullhorn"></i><h4>No announcements yet</h4></div>`;
}

function openAddAnnouncement() {
  document.getElementById('announcementForm').reset();
  fillClassSelects();
  openModal('announcementModal');
}

function deleteAnnouncement(id) {
  if (!confirm('Remove this announcement?')) return;
  Announcements.remove(id);
  renderAnnouncementsAdmin();
  toast('Announcement removed.', 'info');
}

/* ============================================================
   ADMIN: NOTIFICATIONS + AUDIT
   ============================================================ */
function initNotificationsSection() {
  const form = document.getElementById('notifyForm');
  if (form && !form.dataset.bound) {
    form.dataset.bound = '1';
    fillClassSelects();
    form.addEventListener('submit', e => {
      e.preventDefault();
      const aud = document.getElementById('ntAudience').value;
      const title = document.getElementById('ntTitle').value.trim();
      const message = document.getElementById('ntMessage').value.trim();
      if (!title) { toast('Title is required.', 'error'); return; }
      let count = 0;
      if (aud === 'all-students') {
        DB.get('students').filter(s => s.status === 'active').forEach(s => { if (Notifications.send(s.id, 'student', title, message)) count++; });
      } else if (aud === 'class') {
        const cls = Classes.get(document.getElementById('ntClass').value);
        if (cls) { Notifications.notifyClass(cls.name, title, message); count = Classes.enrolledCount(cls.id); }
      }
      toast('Notification sent to ' + count + ' recipient(s).');
      form.reset();
    });
  }
}

function initAuditSection() {
  const tbody = document.getElementById('auditBody');
  if (!tbody) return;
  const logs = Audit.list(200);
  tbody.innerHTML = logs.length ? logs.map(l => `
    <tr>
      <td style="white-space:nowrap">${new Date(l.timestamp).toLocaleString()}</td>
      <td>${esc(l.userName)}</td>
      <td><span class="badge badge-navy">${esc(l.role)}</span></td>
      <td><code>${esc(l.action)}</code></td>
      <td>${esc(l.details)}</td>
    </tr>`).join('') : `<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--text-light)">No audit entries yet</td></tr>`;
}

/* ============================================================
   TEACHER: HOMEWORK, MATERIALS, ATTENDANCE
   ============================================================ */
function teacherClassOptions() {
  const s = Auth.session();
  if (!s) return [];
  const all = Classes.list();
  if (Perm.isAdmin()) return all;
  // teacher: their class-teacher class + classes where their subject is taught
  return all.filter(c => c.teacherId === s.id || (c.subjects || []).includes(s.subject || ''));
}

function initTeacherModules() {
  renderTeacherHomework();
  renderTeacherMaterials();
  initTeacherAttendance();
  initHomeworkModal();
  initMaterialModal();
  initTeacherMarking();
}

/* ============================================================
   TEACHER: EXAM MARKING CENTRE
   ============================================================ */
function initTeacherMarking() {
  renderTeacherMarkingCentre();
}

function teacherMarkingFilters(subs) {
  const fill = (id, values, labelFn) => {
    const el = document.getElementById(id);
    if (!el) return;
    const cur = el.value;
    el.innerHTML = `<option value="">All</option>` + values.map(v => `<option value="${esc(v)}">${esc(labelFn ? labelFn(v) : v)}</option>`).join('');
    if (cur && values.includes(cur)) el.value = cur;
    if (!el.dataset.bound) {
      el.dataset.bound = '1';
      el.addEventListener('change', () => renderTeacherMarkingCentre());
    }
  };
  fill('tcMkClass', [...new Set(subs.map(x => x.className).filter(Boolean))]);
  fill('tcMkSubject', [...new Set(subs.map(x => x.subject).filter(Boolean))]);
  fill('tcMkExam', [...new Set(subs.map(x => x.examTitle).filter(Boolean))]);
  fill('tcMkStatus', ExamMarking.STATUSES, v => ExamMarking.statusLabel(v));
  const dateEl = document.getElementById('tcMkDate');
  if (dateEl && !dateEl.dataset.bound) {
    dateEl.dataset.bound = '1';
    dateEl.addEventListener('change', () => renderTeacherMarkingCentre());
  }
}

function filteredTeacherSubmissions() {
  const s = Auth.session();
  if (!s) return [];
  let subs = ExamMarking.forTeacher(s.id);
  const cls = (document.getElementById('tcMkClass') || {}).value || '';
  const subject = (document.getElementById('tcMkSubject') || {}).value || '';
  const exam = (document.getElementById('tcMkExam') || {}).value || '';
  const status = (document.getElementById('tcMkStatus') || {}).value || '';
  const date = (document.getElementById('tcMkDate') || {}).value || '';
  if (cls) subs = subs.filter(x => x.className === cls);
  if (subject) subs = subs.filter(x => x.subject === subject);
  if (exam) subs = subs.filter(x => x.examTitle === exam);
  if (status) subs = subs.filter(x => x.markingStatus === status);
  if (date) subs = subs.filter(x => String(x.submittedAt || '').slice(0, 10) === date);
  return subs;
}

function renderTeacherMarkingCentre() {
  const s = Auth.session();
  if (!s || s.role !== 'teacher') return;
  const stats = ExamMarking.statsForTeacher(s.id);
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('tcMkExams', stats.exams);
  set('tcMkSubmissions', stats.submissions);
  set('tcMkPending', stats.pending);
  set('tcMkInProgress', stats.marking);
  set('tcMkAwaiting', stats.awaiting);
  set('tcMkPublished', stats.published);
  const badge = document.getElementById('tcMarkingBadge');
  if (badge) {
    const outstanding = stats.pending + stats.marking;
    badge.textContent = outstanding;
    badge.style.display = outstanding ? '' : 'none';
  }

  teacherMarkingFilters(ExamMarking.forTeacher(s.id));

  const tbody = document.getElementById('tcMarkingBody');
  if (!tbody) return;
  const subs = filteredTeacherSubmissions();
  tbody.innerHTML = subs.length ? subs.map(sub => {
    const unmarked = ExamMarking.unmarkedCount(sub);
    const canOpen = ExamMarking.canMark(sub) || ExamMarking.canView(sub);
    let actions = '';
    if (ExamMarking.canMark(sub) && !ExamMarking.isPublished(sub)) {
      actions += `<button class="btn btn-xs btn-primary" onclick="openMarkSubmission('${sub.id}')"><i class="fas fa-pen-ruler"></i> ${sub.markingStatus === 'pending' || sub.markingStatus === 'marking' ? 'Mark' : 'Review'}</button>`;
    }
    if (ExamMarking.canPublish(sub) && sub.markingStatus === 'awaiting_approval') {
      actions += `<button class="btn btn-xs btn-gold" onclick="publishSubmission('${sub.id}')"><i class="fas fa-bullhorn"></i> Publish</button>`;
    }
    if (!actions && canOpen) {
      actions = `<button class="btn btn-xs btn-outline" onclick="openMarkSubmission('${sub.id}')"><i class="fas fa-eye"></i> View</button>`;
    }
    return `
    <tr>
      <td><strong>${esc(sub.studentName)}</strong><br><small style="color:var(--text-light)">${esc(sub.admissionNo || '—')}</small></td>
      <td>${esc(sub.className || '—')}</td>
      <td><strong>${esc(sub.examTitle)}</strong>${unmarked && !ExamMarking.isPublished(sub) ? `<br><small style="color:var(--warning)">${unmarked} question${unmarked === 1 ? '' : 's'} unmarked</small>` : ''}</td>
      <td>${esc(sub.subject || '—')}</td>
      <td>${esc(fmtDate(sub.submittedAt))}<br><small style="color:var(--text-light)">${esc(String(sub.submittedAt || '').slice(11, 16))}</small></td>
      <td>${ExamMarking.isPublished(sub) || (sub.markingStatus === 'awaiting_approval') || sub.markedBy
        ? `<strong>${sub.score}</strong> / ${sub.maxMarks}<br><small style="color:var(--text-light)">${sub.percent}%</small>`
        : '<span style="color:var(--text-light)">—</span>'}</td>
      <td><span class="badge badge-${ExamMarking.badgeFor(sub.markingStatus)}">${esc(ExamMarking.statusLabel(sub.markingStatus))}</span></td>
      <td class="table-actions">${actions || '—'}</td>
    </tr>`;
  }).join('') : `<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--text-light)">No submissions match these filters</td></tr>`;
}

function openMarkSubmission(id) {
  const sub = ExamMarking.get(id);
  if (!sub) return;
  if (!ExamMarking.canMark(sub) && !ExamMarking.canView(sub)) { toast('You are not authorized to open this submission.', 'error'); return; }
  const canEdit = ExamMarking.canMark(sub) && !ExamMarking.isPublished(sub);
  const unmarked = ExamMarking.unmarkedCount(sub);
  const body = document.getElementById('markSubmissionBody');
  if (!body) return;
  body.dataset.subId = id;
  body.innerHTML = `
    <div class="form-grid" style="margin-bottom:16px">
      <div class="form-group"><label>Student</label><div style="font-weight:700">${esc(sub.studentName)}</div></div>
      <div class="form-group"><label>Admission No</label><div>${esc(sub.admissionNo || '—')}</div></div>
      <div class="form-group"><label>Class</label><div>${esc(sub.className || '—')}</div></div>
      <div class="form-group"><label>Subject</label><div>${esc(sub.subject || '—')}</div></div>
      <div class="form-group full"><label>Exam</label><div style="font-weight:700">${esc(sub.examTitle)}</div></div>
      <div class="form-group"><label>Submitted</label><div>${esc(fmtDate(sub.submittedAt))} ${esc(String(sub.submittedAt || '').slice(11, 16))}</div></div>
      <div class="form-group"><label>Marking Status</label><div><span class="badge badge-${ExamMarking.badgeFor(sub.markingStatus)}">${esc(ExamMarking.statusLabel(sub.markingStatus))}</span></div></div>
    </div>
    ${(sub.questionResponses || []).map((r, i) => {
      const keyValid = r.type !== 'written' && r.correctOptionId && (r.options || []).find(o => o.id === r.correctOptionId && o.text);
      const optText = oid => { const o = (r.options || []).find(x => x.id === oid); return o ? o.text : oid; };
      let autoBadge = '';
      if (r.type === 'written') autoBadge = `<span class="badge badge-navy">Teacher-marked question</span>`;
      else if (keyValid) autoBadge = r.autoCorrect ? `<span class="badge badge-success">Auto-marked: Correct</span>` : `<span class="badge badge-danger">Auto-marked: Incorrect</span>`;
      else autoBadge = `<span class="badge badge-warning"><i class="fas fa-triangle-exclamation"></i> No answer key — teacher review</span>`;
      return `
      <div style="border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:12px;background:var(--cream,#faf9f6)">
        <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:flex-start">
          <strong style="color:var(--navy)">Q${i + 1}. ${esc(r.text)}</strong>
          <span style="font-weight:700;color:var(--navy);white-space:nowrap">${r.awardedMarks == null ? '—' : r.awardedMarks} / ${r.maxMarks} marks</span>
        </div>
        <p style="font-size:0.85rem;margin:8px 0 4px"><strong>Student's answer:</strong> ${
          r.type === 'written'
            ? (r.answerText ? esc(r.answerText) : '<span style="color:var(--danger)">Not answered</span>')
            : (r.optionId ? esc(optText(r.optionId)) + ' (' + esc(r.optionId) + ')' : '<span style="color:var(--danger)">Not answered</span>')
        }</p>
        ${r.type !== 'written' && keyValid ? `<p style="font-size:0.85rem;margin:0 0 8px"><strong>Correct answer:</strong> ${esc(optText(r.correctOptionId))} (${esc(r.correctOptionId)})</p>` : ''}
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-top:8px">
          <div>${autoBadge}</div>
          <div style="display:flex;gap:8px;align-items:center;margin-left:auto">
            <label style="font-size:0.8rem;font-weight:600;color:var(--navy);margin:0">Marks</label>
            <input type="number" min="0" max="${r.maxMarks}" step="0.5" data-mark-qid="${esc(r.qid)}"
              value="${r.awardedMarks == null ? '' : r.awardedMarks}" placeholder="—"
              style="width:86px;padding:7px 9px;border:2px solid var(--border);border-radius:8px;font-family:inherit" ${canEdit ? '' : 'disabled'}>
            <span style="color:var(--text-light);font-size:0.85rem">/ ${r.maxMarks}</span>
          </div>
        </div>
        <input type="text" data-mark-comment="${esc(r.qid)}" value="${esc(r.comment || '')}" placeholder="Comment for this question (optional)"
          style="width:100%;margin-top:8px;padding:8px 10px;border:2px solid var(--border);border-radius:8px;font-family:inherit;font-size:0.88rem" ${canEdit ? '' : 'disabled'}>
      </div>`;
    }).join('')}
    <div class="form-group" style="margin-top:4px">
      <label>Overall Teacher Feedback</label>
      <textarea id="markFeedback" rows="3" placeholder="Feedback for the student..." ${canEdit ? '' : 'disabled'} style="width:100%;padding:10px;border:2px solid var(--border);border-radius:8px;font-family:inherit">${esc(sub.teacherFeedback || '')}</textarea>
    </div>
    <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center;border-top:1px solid var(--border);padding-top:12px;margin-top:6px">
      <div style="font-weight:800;color:var(--navy)">Total: <span id="markTotalBox">${sub.score}</span> / ${sub.maxMarks}${unmarked && !ExamMarking.isPublished(sub) ? ` <span class="badge badge-warning" style="margin-left:6px">${unmarked} question${unmarked === 1 ? '' : 's'} still unmarked</span>` : ''}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${canEdit ? `
          <button class="btn btn-outline" onclick="saveSubmissionMarks('${sub.id}', false)"><i class="fas fa-floppy-disk"></i> Save Draft</button>
          <button class="btn btn-primary" onclick="saveSubmissionMarks('${sub.id}', true)"><i class="fas fa-paper-plane"></i> Submit Marks for Approval</button>
          <button class="btn btn-gold" onclick="publishSubmission('${sub.id}')"><i class="fas fa-bullhorn"></i> Publish Results</button>` : ''}
        ${!canEdit && ExamMarking.canPublish(sub) && sub.markingStatus === 'awaiting_approval' ? `<button class="btn btn-gold" onclick="publishSubmission('${sub.id}')"><i class="fas fa-bullhorn"></i> Publish Results</button>` : ''}
        <button class="btn btn-outline" onclick="closeModal('markSubmissionModal')">${ExamMarking.isPublished(sub) ? 'Close' : 'Cancel'}</button>
      </div>
    </div>
    ${(sub.markingHistory || []).length ? `
      <details style="margin-top:12px">
        <summary style="cursor:pointer;font-weight:600;color:var(--navy);font-size:0.88rem"><i class="fas fa-clock-rotate-left"></i> Marking audit trail</summary>
        <div class="table-wrap"><table class="data-table" style="margin-top:8px">
          <thead><tr><th>When</th><th>By</th><th>Action</th><th>Change</th></tr></thead>
          <tbody>${sub.markingHistory.slice().reverse().map(h => `
            <tr><td>${esc(String(h.at || '').replace('T', ' ').slice(0, 16))}</td><td>${esc(h.by || '—')}</td><td>${esc(h.action || '')}</td><td style="font-size:0.8rem">${esc(h.note || '')}</td></tr>`).join('')}</tbody>
        </table></div>
      </details>` : ''}`;
  openModal('markSubmissionModal');
}

function collectMarkPayloadFromModal() {
  const awards = {};
  document.querySelectorAll('[data-mark-qid]').forEach(inp => {
    const qid = inp.getAttribute('data-mark-qid');
    const cEl = document.querySelector(`[data-mark-comment="${qid}"]`);
    awards[qid] = {
      marks: inp.value.trim() === '' ? null : Number(inp.value),
      comment: cEl ? cEl.value : ''
    };
  });
  const fb = document.getElementById('markFeedback');
  return { awards, feedback: fb ? fb.value : '' };
}

function recalcMarkTotalBox() {
  let total = 0;
  document.querySelectorAll('[data-mark-qid]').forEach(inp => {
    if (inp.value.trim() !== '') total += Number(inp.value) || 0;
  });
  const box = document.getElementById('markTotalBox');
  if (box) box.textContent = total;
}

function saveSubmissionMarks(subId, submitForApproval) {
  const payload = collectMarkPayloadFromModal();
  payload.submitForApproval = !!submitForApproval;
  const r = ExamMarking.saveMarks(subId, payload);
  if (!r.ok) { toast(r.error, 'error'); return false; }
  toast(submitForApproval ? 'Marks submitted for approval!' : 'Marking draft saved.');
  if (submitForApproval) closeModal('markSubmissionModal');
  else openMarkSubmission(subId); // refresh the modal with the saved state
  renderTeacherMarkingCentre();
  return true;
}

function publishSubmission(subId) {
  // persist whatever is currently on screen first, then publish
  const modal = document.getElementById('markSubmissionModal');
  if (modal && modal.classList.contains('show')) {
    const save = saveSubmissionMarks(subId, true);
    if (!save) return;
  }
  const r = ExamMarking.publish(subId);
  if (!r.ok) { toast(r.error, 'error'); return; }
  toast('Results published to the student!');
  closeModal('markSubmissionModal');
  renderTeacherMarkingCentre();
  if (typeof renderAdminExamResults === 'function' && document.body.dataset.page === 'admin') renderAdminExamResults();
}

/* ============================================================
   ADMIN: EXAM RESULTS APPROVAL
   ============================================================ */
function initAdminExamResultsSection() {
  renderAdminExamResults();
}

function renderAdminExamResults() {
  if (!Perm.isAdmin()) return;
  const stats = ExamMarking.statsAll();
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('admMkExams', stats.exams);
  set('admMkSubmissions', stats.submissions);
  set('admMkPending', stats.pending);
  set('admMkInProgress', stats.marking);
  set('admMkAwaiting', stats.awaiting);
  set('admMkPublished', stats.published);

  const tbody = document.getElementById('admExamResultsBody');
  if (!tbody) return;
  let subs = ExamMarking.list().slice().reverse();
  const cls = (document.getElementById('admMkClass') || {}).value || '';
  const status = (document.getElementById('admMkStatus') || {}).value || '';
  const examSel = (document.getElementById('admMkExam') || {}).value || '';
  if (cls) subs = subs.filter(x => x.className === cls);
  if (status) subs = subs.filter(x => x.markingStatus === status);
  if (examSel) subs = subs.filter(x => x.examTitle === examSel);

  const fill = (id, values) => {
    const el = document.getElementById(id);
    if (!el) return;
    const cur = el.value;
    el.innerHTML = `<option value="">All</option>` + values.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
    if (cur && values.includes(cur)) el.value = cur;
    if (!el.dataset.bound) { el.dataset.bound = '1'; el.addEventListener('change', renderAdminExamResults); }
  };
  fill('admMkClass', [...new Set(ExamMarking.list().map(x => x.className).filter(Boolean))]);
  fill('admMkExam', [...new Set(ExamMarking.list().map(x => x.examTitle).filter(Boolean))]);
  const stEl = document.getElementById('admMkStatus');
  if (stEl && !stEl.dataset.bound) {
    stEl.dataset.bound = '1';
    stEl.addEventListener('change', renderAdminExamResults);
  }

  tbody.innerHTML = subs.length ? subs.map(sub => `
    <tr>
      <td><strong>${esc(sub.studentName)}</strong><br><small style="color:var(--text-light)">${esc(sub.admissionNo || '—')}</small></td>
      <td>${esc(sub.className || '—')}</td>
      <td><strong>${esc(sub.examTitle)}</strong></td>
      <td>${esc(sub.subject || '—')}</td>
      <td>${esc(sub.teacherName || '—')}</td>
      <td>${esc(fmtDate(sub.submittedAt))}</td>
      <td>${sub.markedBy || sub.markingStatus === 'awaiting_approval' || ExamMarking.isPublished(sub) ? `<strong>${sub.score}</strong> / ${sub.maxMarks} <small style="color:var(--text-light)">(${sub.percent}%)</small>` : '<span style="color:var(--text-light)">—</span>'}</td>
      <td><span class="badge badge-${ExamMarking.badgeFor(sub.markingStatus)}">${esc(ExamMarking.statusLabel(sub.markingStatus))}</span></td>
      <td class="table-actions">
        <button class="btn btn-xs btn-outline" onclick="openMarkSubmission('${sub.id}')"><i class="fas fa-eye"></i> View</button>
        ${ExamMarking.canPublish(sub) && sub.markingStatus === 'awaiting_approval' ? `<button class="btn btn-xs btn-gold" onclick="publishSubmission('${sub.id}')"><i class="fas fa-bullhorn"></i> Publish</button>` : ''}
      </td>
    </tr>`).join('') : `<tr><td colspan="9" style="text-align:center;padding:30px;color:var(--text-light)">No exam submissions yet</td></tr>`;
}

function initHomeworkModal() {
  const form = document.getElementById('homeworkForm');
  if (!form || form.dataset.bound) return;
  form.dataset.bound = '1';
  fillTeacherSelects();
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const editingId = document.getElementById('hwEditId').value || null;
    let attachmentName = '', attachmentKey = '';
    const fileInput = document.getElementById('hwFile');
    if (fileInput.files[0]) {
      const f = fileInput.files[0];
      if (f.size > 8 * 1024 * 1024) { toast('File too large (max 8MB).', 'error'); return; }
      attachmentName = f.name;
      attachmentKey = 'hwfile_' + DB.uid();
      const dataUrl = await fileToDataUrl(f);
      await ImageStore.put(attachmentKey, dataUrl);
    }
    // collect every ticked class (multi-class support)
    const classIds = [...document.querySelectorAll('#hwClassChecks input[type="checkbox"]:checked')].map(cb => cb.value);
    if (!classIds.length) { toast('Please select at least one class.', 'error'); return; }
    const existing = editingId ? Homework.get(editingId) : null;
    const r = Homework.save({
      title: document.getElementById('hwTitle').value,
      classIds: classIds,
      subject: document.getElementById('hwSubject').value,
      dateAssigned: document.getElementById('hwDateAssigned').value,
      deadline: document.getElementById('hwDeadline').value,
      submissionMethod: document.getElementById('hwMethod').value,
      status: document.getElementById('hwStatus').value,
      instructions: document.getElementById('hwInstructions').value,
      attachmentName: attachmentName || (existing ? existing.attachmentName : ''),
      attachmentKey: attachmentKey || (existing ? existing.attachmentKey : '')
    }, editingId);
    if (!r.ok) { toast(r.error, 'error'); return; }
    toast(r.submittedForApproval
      ? 'Homework submitted for approval (' + r.approvalTrackingNo + '). Students will see it after the Chief Examiner, Headteacher and Secretary approve it.'
      : (editingId ? 'Homework updated!' : (document.getElementById('hwStatus').value === 'draft' ? 'Homework saved as draft.' : 'Homework published! Students in the selected classes will see it.')));
    form.reset();
    document.getElementById('hwEditId').value = '';
    document.getElementById('hwFileInfo').textContent = '';
    closeModal('homeworkModal');
    renderTeacherHomework();
  });
}

function fileToDataUrl(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

function fillTeacherSelects() {
  // homework class checkboxes (multi-class)
  const checksBox = document.getElementById('hwClassChecks');
  if (checksBox) {
    const classes = teacherClassOptions();
    checksBox.innerHTML = classes.map(c => `<label style="display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid var(--border);border-radius:8px;cursor:pointer;font-size:0.88rem"><input type="checkbox" value="${c.id}"> ${esc(c.name)}</label>`).join('');
  }
  // materials class select (single)
  const matEl = document.getElementById('matClass');
  if (matEl) {
    const classes = teacherClassOptions();
    matEl.innerHTML = classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  }
  const s = Auth.session();
  const subjOpts = DEFAULT_SUBJECTS.map(x => `<option value="${x}">${x}</option>`).join('');
  ['hwSubject', 'matSubject'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.innerHTML = subjOpts;
      if (s && s.subject && DEFAULT_SUBJECTS.includes(s.subject)) el.value = s.subject;
    }
  });
  // materials class select → update subjects to that class's list
  const matClassEl = document.getElementById('matClass');
  if (matClassEl) {
    matClassEl.onchange = () => {
      const cls = Classes.get(matClassEl.value);
      const subj = document.getElementById('matSubject');
      if (cls && subj) subj.innerHTML = (cls.subjects || DEFAULT_SUBJECTS).map(x => `<option value="${x}">${x}</option>`).join('');
    };
    if (matClassEl.value) matClassEl.dispatchEvent(new Event('change'));
  }
  const fileEl = document.getElementById('matFile');
  if (fileEl && !fileEl.dataset.bound) {
    fileEl.dataset.bound = '1';
    fileEl.addEventListener('change', () => {
      const f = fileEl.files[0];
      document.getElementById('matFileInfo').textContent = f ? f.name + ' (' + Math.round(f.size / 1024) + ' KB)' : '';
    });
  }
  const hwFile = document.getElementById('hwFile');
  if (hwFile && !hwFile.dataset.bound) {
    hwFile.dataset.bound = '1';
    hwFile.addEventListener('change', () => {
      const f = hwFile.files[0];
      document.getElementById('hwFileInfo').textContent = f ? f.name + ' (' + Math.round(f.size / 1024) + ' KB)' : '';
    });
  }
}

function openAddHomework() {
  document.getElementById('homeworkForm').reset();
  document.getElementById('hwEditId').value = '';
  document.getElementById('hwDateAssigned').value = today();
  document.getElementById('hwFileInfo').textContent = '';
  fillTeacherSelects();
  document.getElementById('homeworkModalTitle').textContent = 'Add Homework';
  openModal('homeworkModal');
}

function editHomework(id) {
  const h = Homework.get(id);
  if (!h) return;
  fillTeacherSelects();
  document.getElementById('hwEditId').value = h.id;
  document.getElementById('hwTitle').value = h.title || '';
  // tick the class checkboxes this homework was assigned to
  const ids = h.classIds || (h.classId ? [h.classId] : []);
  document.querySelectorAll('#hwClassChecks input[type="checkbox"]').forEach(cb => { cb.checked = ids.includes(cb.value); });
  document.getElementById('hwSubject').value = h.subject || '';
  document.getElementById('hwDateAssigned').value = h.dateAssigned || '';
  document.getElementById('hwDeadline').value = h.deadline || '';
  document.getElementById('hwMethod').value = h.submissionMethod || 'in-class';
  document.getElementById('hwStatus').value = h.status || 'published';
  document.getElementById('hwInstructions').value = h.instructions || '';
  document.getElementById('hwFileInfo').textContent = h.attachmentName || '';
  document.getElementById('homeworkModalTitle').textContent = 'Edit Homework';
  openModal('homeworkModal');
}

function renderTeacherHomework() {
  const tbody = document.getElementById('tcHomeworkBody');
  if (!tbody) return;
  const s = Auth.session();
  if (!s) return;
  const items = Perm.isAdmin() ? Homework.list() : Homework.forTeacher(s.id);
  tbody.innerHTML = items.length ? items.map(h => {
    const st = Homework.statusOf(h);
    const badge = { draft: 'warning', pending: 'warning', published: 'success', active: 'success', upcoming: 'navy', overdue: 'danger', closed: 'danger' }[st] || 'navy';
    const subs = DB.get('homeworkSubmissions').filter(x => x.homeworkId === h.id).length;
    const clsNames = (h.classNames && h.classNames.length) ? h.classNames.join(', ') : (h.className || '—');
    const gated = ApprovalGate.requiresApproval(h);
    const apBadge = gated
      ? `<span class="badge badge-${ApprovalGate.statusBadge(h)}">${esc(ApprovalGate.statusText(h) || 'Not submitted')}</span>${h.approvalTrackingNo ? `<br><small style="color:var(--text-light)"><code>${esc(h.approvalTrackingNo)}</code></small>` : ''}`
      : '';
    const actions = gated
      ? `<button class="btn btn-xs btn-outline" onclick="openSection('my-submissions')"><i class="fas fa-list-check"></i> Track</button>
         <button class="btn btn-xs btn-outline" onclick="editHomework('${h.id}')"><i class="fas fa-pen"></i></button>
         <button class="btn btn-xs btn-outline" onclick="printHomework('${h.id}')"><i class="fas fa-print"></i></button>
         <button class="btn btn-xs btn-danger" onclick="teacherDeleteHomework('${h.id}')"><i class="fas fa-trash"></i></button>`
      : `${h.status === 'draft'
          ? `<button class="btn btn-xs btn-primary" onclick="teacherPublishHomework('${h.id}')"><i class="fas fa-check"></i> Publish</button>`
          : `<button class="btn btn-xs btn-outline" onclick="teacherUnpublishHomework('${h.id}')"><i class="fas fa-eye-slash"></i></button>`}
         <button class="btn btn-xs btn-outline" onclick="editHomework('${h.id}')"><i class="fas fa-pen"></i></button>
         <button class="btn btn-xs btn-outline" onclick="printHomework('${h.id}')"><i class="fas fa-print"></i></button>
         <button class="btn btn-xs btn-danger" onclick="teacherDeleteHomework('${h.id}')"><i class="fas fa-trash"></i></button>`;
    return `
    <tr>
      <td><strong>${esc(h.title)}</strong>${h.attachmentName ? '<br><small style="color:var(--text-light)"><i class="fas fa-paperclip"></i> ' + esc(h.attachmentName) + '</small>' : ''}</td>
      <td>${esc(clsNames)}</td>
      <td>${esc(h.subject)}</td>
      <td>${fmtDate(h.deadline)}</td>
      <td><span class="badge badge-${badge}">${esc(st)}</span>${apBadge ? '<br>' + apBadge : ''}<br><small style="color:var(--text-light)">${subs} submission${subs === 1 ? '' : 's'}</small></td>
      <td class="table-actions">${actions}</td>
    </tr>`;
  }).join('') : `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-light)">No homework yet</td></tr>`;
}

function teacherPublishHomework(id) {
  const r = Homework.publish(id);
  if (!r.ok) { toast(r.error, 'error'); return; }
  toast('Published to students!');
  renderTeacherHomework();
}

function teacherUnpublishHomework(id) {
  Homework.unpublish(id);
  renderTeacherHomework();
  toast('Unpublished.', 'info');
}

function teacherDeleteHomework(id) {
  if (!confirm('Delete this homework?')) return;
  Homework.remove(id);
  renderTeacherHomework();
  toast('Deleted.', 'info');
}

/* ---- MATERIALS ---- */
function openUploadMaterial() {
  document.getElementById('materialForm').reset();
  document.getElementById('matFileInfo').textContent = '';
  fillTeacherSelects();
  openModal('materialModal');
}

function initMaterialModal() {
  const form = document.getElementById('materialForm');
  if (!form || form.dataset.bound) return;
  form.dataset.bound = '1';
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const f = document.getElementById('matFile').files[0];
    if (!f) { toast('Please choose a file.', 'error'); return; }
    if (f.size > 8 * 1024 * 1024) { toast('File too large (max 8MB).', 'error'); return; }
    const key = 'mat_' + DB.uid();
    try {
      const dataUrl = await fileToDataUrl(f);
      await ImageStore.put(key, dataUrl);
    } catch (err) { toast('Could not read that file.', 'error'); return; }
    const r = Materials.save({
      title: document.getElementById('matTitle').value,
      description: document.getElementById('matDescription').value,
      classId: document.getElementById('matClass').value,
      subject: document.getElementById('matSubject').value,
      category: document.getElementById('matCategory').value,
      status: document.getElementById('matStatus').value,
      expiryDate: document.getElementById('matExpiry').value,
      fileName: f.name, fileType: f.type, fileSize: f.size, fileKey: key
    });
    if (!r.ok) { toast(r.error, 'error'); return; }
    toast(r.submittedForApproval
      ? 'Material submitted for approval (' + r.approvalTrackingNo + '). Students will see it after the Chief Examiner, Headteacher and Secretary approve it.'
      : 'Material uploaded!');
    form.reset();
    document.getElementById('matFileInfo').textContent = '';
    closeModal('materialModal');
    renderTeacherMaterials();
  });
}

function renderTeacherMaterials() {
  const tbody = document.getElementById('tcMaterialsBody');
  if (!tbody) return;
  const s = Auth.session();
  if (!s) return;
  const items = Perm.isAdmin() ? Materials.list() : Materials.forTeacher(s.id);
  tbody.innerHTML = items.length ? items.map(m => `
    <tr>
      <td><strong>${esc(m.title)}</strong><br><small style="color:var(--text-light)"><i class="fas fa-file"></i> ${esc(m.fileName || '')}</small></td>
      <td>${esc(m.className)}</td>
      <td>${esc(m.subject)}</td>
      <td>${esc(m.category)}</td>
      <td>${fmtDate(m.uploadedAt)}</td>
      <td>${esc(m.status)}${ApprovalGate.inChain(m) || ApprovalGate.approvedForStudents(m)
        ? `<br><span class="badge badge-${ApprovalGate.statusBadge(m)}">${esc(ApprovalGate.statusText(m))}</span>${m.approvalTrackingNo ? `<br><small style="color:var(--text-light)"><code>${esc(m.approvalTrackingNo)}</code></small>` : ''}`
        : ''}</td>
      <td class="table-actions">
        <button class="btn btn-xs btn-outline" onclick="viewMaterial('${m.id}')"><i class="fas fa-eye"></i></button>
        <button class="btn btn-xs btn-danger" onclick="teacherDeleteMaterial('${m.id}')"><i class="fas fa-trash"></i></button>
      </td>
    </tr>`).join('') : `<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text-light)">No materials uploaded yet</td></tr>`;
}

function teacherDeleteMaterial(id) {
  if (!confirm('Delete this material?')) return;
  Materials.remove(id);
  renderTeacherMaterials();
  toast('Deleted.', 'info');
}

/* ---- ATTENDANCE ---- */
let attendanceRegister = [];

function initTeacherAttendance() {
  const classSel = document.getElementById('tcAttClass');
  const dateEl = document.getElementById('tcAttDate');
  if (!classSel) return;
  const classes = teacherClassOptions().filter(c => c.teacherId === (Auth.session() || {}).id || Perm.isAdmin());
  classSel.innerHTML = classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  if (!classes.length) classSel.innerHTML = '<option value="">No assigned classes</option>';
  if (dateEl && !dateEl.value) dateEl.value = today();
}

function loadAttendanceRegister() {
  const classId = document.getElementById('tcAttClass').value;
  const date = document.getElementById('tcAttDate').value;
  const tbody = document.getElementById('tcAttBody');
  if (!tbody) return;
  if (!classId || !date) { toast('Select a class and date.', 'error'); return; }
  if (!Perm.canMarkAttendance((Auth.session() || {}).id, classId)) { toast('You are not authorized to mark attendance for this class.', 'error'); return; }
  const students = Classes.students(classId);
  const existing = Attendance.list().filter(a => a.classId === classId && a.date === date);
  attendanceRegister = students.map(st => {
    const ex = existing.find(a => a.studentId === st.id);
    return {
      studentId: st.id, studentName: st.firstName + ' ' + st.lastName, admissionNo: st.admissionNo || '',
      status: ex ? ex.status : 'present', arrivalTime: ex ? ex.arrivalTime : '', remarks: ex ? ex.remarks : ''
    };
  });
  renderAttendanceRegister();
  const status = document.getElementById('tcAttStatus');
  if (status) status.textContent = existing.length ? 'Previously saved — editing will be logged as a correction.' : 'Not yet marked for this date.';
  if (typeof renderTeacherAttendanceSummary === 'function') renderTeacherAttendanceSummary();
  if (typeof renderTeacherAttendanceReport === 'function') renderTeacherAttendanceReport();
}

function renderAttendanceRegister() {
  const tbody = document.getElementById('tcAttBody');
  if (!tbody) return;
  tbody.innerHTML = attendanceRegister.length ? attendanceRegister.map((r, i) => `
    <tr>
      <td>${esc(r.admissionNo)}</td>
      <td><strong>${esc(r.studentName)}</strong></td>
      <td>
        <select class="att-status" data-i="${i}" style="padding:6px 10px;border:2px solid var(--border);border-radius:6px;font-size:0.82rem">
          <option value="present" ${r.status === 'present' ? 'selected' : ''}>Present</option>
          <option value="absent" ${r.status === 'absent' ? 'selected' : ''}>Absent</option>
          <option value="late" ${r.status === 'late' ? 'selected' : ''}>Late</option>
          <option value="excused" ${r.status === 'excused' ? 'selected' : ''}>Excused</option>
        </select>
      </td>
      <td><input type="time" class="att-time" data-i="${i}" value="${esc(r.arrivalTime)}" style="padding:6px;border:2px solid var(--border);border-radius:6px;font-size:0.82rem"></td>
      <td><input type="text" class="att-remarks" data-i="${i}" value="${esc(r.remarks)}" placeholder="Optional" style="padding:6px;border:2px solid var(--border);border-radius:6px;font-size:0.82rem;width:100%"></td>
    </tr>`).join('') : `<tr><td colspan="5" style="text-align:center;padding:26px;color:var(--text-light)">No students enrolled in this class</td></tr>`;
  tbody.querySelectorAll('.att-status').forEach(el => el.addEventListener('change', () => { attendanceRegister[el.dataset.i].status = el.value; }));
  tbody.querySelectorAll('.att-time').forEach(el => el.addEventListener('change', () => { attendanceRegister[el.dataset.i].arrivalTime = el.value; }));
  tbody.querySelectorAll('.att-remarks').forEach(el => el.addEventListener('change', () => { attendanceRegister[el.dataset.i].remarks = el.value; }));
}

function saveAttendanceRegister() {
  const classId = document.getElementById('tcAttClass').value;
  const date = document.getElementById('tcAttDate').value;
  if (!classId || !date || !attendanceRegister.length) { toast('Load a register first.', 'error'); return; }
  const r = Attendance.saveRegister(classId, date, attendanceRegister, (Auth.session() || {}).name);
  if (!r.ok) { toast(r.error, 'error'); return; }
  toast('Register saved! (' + r.saved + ' new' + (r.corrected ? ', ' + r.corrected + ' corrected' : '') + ')');
  const status = document.getElementById('tcAttStatus');
  if (status) status.textContent = 'Saved at ' + new Date().toLocaleTimeString();
  if (typeof renderTeacherAttendanceSummary === 'function') renderTeacherAttendanceSummary();
  if (typeof renderTeacherAttendanceReport === 'function') renderTeacherAttendanceReport();
}

/* ============================================================
   TEACHER: DASHBOARD UPGRADE
   ============================================================ */
(function enhanceTeacherDashboard() {
  const orig = window.loadTeacherDashboard;
  if (!orig) return;
  window.loadTeacherDashboard = function () {
    orig();
    const s = Auth.session();
    if (!s) return;
    const myClasses = Classes.list().filter(c => c.teacherId === s.id);
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('tcMyClassCount', myClasses.length);
    set('tcHomeworkCount', Homework.forTeacher(s.id).length);
    // inject class-teacher badge into welcome
    const p = document.querySelector('#sec-dashboard .section-head p');
    if (p && myClasses.length) p.innerHTML = 'Class Teacher of <strong>' + myClasses.map(c => esc(c.name)).join(', ') + '</strong> · Subject: <strong>' + esc(s.subject || '—') + '</strong>';
  };
})();

/* ============================================================
   STUDENT PORTAL (privacy: only own records via session.id)
   ============================================================ */
function initStudentPortal() {
  const s = Auth.session();
  if (!s || s.role !== 'student') return;
  // resolve the student record reliably (id match first, then email — user account id may differ from record id on legacy data)
  const student = studentForSession(s);
  renderStudentDashboard(s, student);
  renderStudentProfile(s, student);
  renderStudentClass(s, student);
  renderStudentHomework(s, student);
  renderStudentMaterials(s, student);
  renderStudentExamTimetable(s, student);
  renderStudentResults(s, student);
  renderStudentAttendance(s, student);
  renderStudentAnnouncements(s, student);
  renderStudentContacts(s, student);
  renderStudentNotifications(s);
  renderStudentFees(s);
  renderStudentExams(s);
  renderStudentTimetable(s);
}

function renderStudentDashboard(s, student) {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('stuName', s.name);
  set('stuClassLine', (student.className || s.className || '—') + ' · ' + (DB.get('settings', {}).academicYear || ''));
  set('stuAdmNo', student.admissionNo || '—');
  // passport photograph (with cache-busting so a replaced photo shows immediately)
  const photoBox = document.getElementById('stuDashPhoto');
  if (photoBox) {
    const url = (typeof Students !== 'undefined' && Students.photoUrl) ? Students.photoUrl(student) : (student.photo || '');
    photoBox.innerHTML = url
      ? `<img src="${esc(url)}" alt="${esc(student.firstName || '')} ${esc(student.lastName || '')}" style="width:64px;height:64px;border-radius:50%;object-fit:cover;border:2px solid var(--gold)">`
      : `<div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,var(--navy),var(--navy-light));color:var(--gold);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1.2rem">${initials(s.name)}</div>`;
  }
  const hw = Homework.forStudent(student);
  const active = hw.filter(h => ['active', 'upcoming'].includes(Homework.statusOf(h)));
  set('stuHwCount', active.length);
  const upcoming = ExamSchedule.upcoming(student);
  set('stuUpcomingExams', upcoming.length);
  const att = Attendance.summaryForStudent(s.id);
  set('stuAttPct', att.pct !== null ? att.pct + '%' : '—');
  set('stuMatCount', Materials.forStudent(student).length);
  set('stuBalance', money(student.feeBalance || 0));

  // dashboard homework list
  const hwBox = document.getElementById('stuDashHomework');
  if (hwBox) {
    hwBox.innerHTML = active.length ? active.slice(0, 5).map(h => `
      <div style="padding:8px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap">
        <div><strong style="color:var(--navy);font-size:0.9rem">${esc(h.title)}</strong><br><small style="color:var(--text-light)">${esc(h.subject)} · due ${fmtDate(h.deadline)}</small></div>
        <span class="badge badge-${Homework.statusOf(h) === 'overdue' ? 'danger' : 'success'}">${Homework.statusOf(h)}</span>
      </div>`).join('') : '<p style="color:var(--text-light);font-size:0.9rem">No active homework. Check the Homework section for all assignments.</p>';
  }
  const annBox = document.getElementById('stuDashAnnouncements');
  if (annBox) {
    const anns = Announcements.forStudent(student).slice(0, 4);
    annBox.innerHTML = anns.length ? anns.map(a => `
      <div style="padding:8px 0;border-bottom:1px solid var(--border)">
        <strong style="color:var(--navy);font-size:0.9rem">${esc(a.title)}</strong><br>
        <small style="color:var(--text-light)">${fmtDate(a.createdAt)}${a.className ? ' · ' + esc(a.className) : ''}</small>
      </div>`).join('') : '<p style="color:var(--text-light);font-size:0.9rem">No announcements yet.</p>';
  }
}

function renderStudentProfile(s, student) {
  const box = document.getElementById('stuProfileBody');
  if (!box) return;
  const photoUrl = (typeof Students !== 'undefined' && Students.photoUrl) ? Students.photoUrl(student) : (student.photo || '');
  const rows = [
    ['Full Name', student.firstName + ' ' + student.lastName],
    ['Admission Number', student.admissionNo],
    ['Class', student.className],
    ['Academic Year', student.academicYear || DB.get('settings', {}).academicYear],
    ['Term', student.term || DB.get('settings', {}).term],
    ['Gender', student.gender],
    ['Date of Birth', fmtDate(student.dob)],
    ['Admission Date', fmtDate(student.admissionDate)],
    ['Previous School', student.previousSchool],
    ['Parent / Guardian', student.parentName + (student.parentRelationship ? ' (' + student.parentRelationship + ')' : '')],
    ['Parent Phone', student.parentPhone],
    ['Address', student.address],
    ['Status', student.status]
  ];
  box.innerHTML = `
    <div style="display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap">
      <div style="text-align:center">
        ${photoUrl
          ? `<img src="${esc(photoUrl)}" alt="${esc(student.firstName || '')} ${esc(student.lastName || '')}" style="width:110px;height:110px;border-radius:50%;object-fit:cover;border:3px solid var(--gold)">`
          : `<div style="width:110px;height:110px;border-radius:50%;background:linear-gradient(135deg,var(--navy),var(--navy-light));color:var(--gold);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:2rem;margin:0 auto">${initials(s.name)}</div>`}
        <p style="font-size:0.8rem;color:var(--text-light);margin-top:8px">Photo managed by school office</p>
      </div>
      <div style="flex:1;min-width:240px">
        <table class="data-table">
          <tbody>${rows.map(r => `<tr><td style="font-weight:600;color:var(--navy);width:40%">${r[0]}</td><td>${esc(r[1] || '—')}</td></tr>`).join('')}</tbody>
        </table>
        <p style="font-size:0.8rem;color:var(--text-light);margin-top:10px"><i class="fas fa-lock"></i> Official admission details can only be changed by authorized school staff.</p>
      </div>
    </div>`;
}

function renderStudentClass(s, student) {
  const cls = Classes.byName(student.className || '');
  const card = document.getElementById('stuClassTeacherCard');
  if (card) {
    if (cls && cls.teacherId) {
      const t = DB.get('teachers').find(x => x.id === cls.teacherId) || {};
      const tName = cls.teacherName || teacherDisplayName(t);
      card.innerHTML = `
        <div class="panel">
          <div class="panel-head"><h3><i class="fas fa-user-tie" style="color:var(--gold)"></i> My Class Teacher</h3></div>
          <div class="panel-body">
            <div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap">
              ${t.photo
                ? `<img src="${esc(t.photo)}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:2px solid var(--gold)">`
                : `<div style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,var(--navy),var(--navy-light));color:var(--gold);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1.4rem;flex-shrink:0">${initials(tName)}</div>`}
              <div style="flex:1;min-width:200px">
                <h3 style="color:var(--navy)">${esc(tName)}</h3>
                <p style="color:var(--text-light);font-size:0.88rem">Class Teacher · ${esc(cls.name)}</p>
                <p style="font-size:0.85rem;margin-top:4px">${t.phone ? '<i class="fas fa-phone"></i> ' + esc(t.phone) : '<span style="color:var(--text-light)">Phone not provided</span>'}</p>
                <p style="font-size:0.85rem">${t.email ? '<i class="fas fa-envelope"></i> ' + esc(t.email) : '<span style="color:var(--text-light)">Email not provided</span>'}</p>
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                ${t.phone ? `<a class="btn btn-primary btn-sm" href="tel:${esc(t.phone)}"><i class="fas fa-phone"></i> Call</a>` : ''}
                ${t.email ? `<a class="btn btn-gold btn-sm" href="mailto:${esc(t.email)}"><i class="fas fa-envelope"></i> Email</a>` : ''}
              </div>
            </div>
          </div>
        </div>`;
    } else {
      card.innerHTML = `<div class="panel"><div class="panel-body" style="text-align:center;color:var(--text-light)"><i class="fas fa-triangle-exclamation" style="font-size:1.6rem;color:var(--gold);display:block;margin-bottom:8px"></i><p>No class teacher has been assigned yet. Please check with the school office.</p></div></div>`;
    }
  }
  const info = document.getElementById('stuClassInfo');
  if (info && cls) {
    info.innerHTML = `
      <table class="data-table">
        <tbody>
          <tr><td style="font-weight:600;color:var(--navy);width:35%">Class</td><td>${esc(cls.name)}</td></tr>
          <tr><td style="font-weight:600;color:var(--navy)">Academic Year</td><td>${esc(cls.academicYear)}</td></tr>
          <tr><td style="font-weight:600;color:var(--navy)">Term</td><td>Term ${esc(cls.term)}</td></tr>
          <tr><td style="font-weight:600;color:var(--navy)">Class Teacher</td><td>${esc(cls.teacherName || 'Not assigned')}</td></tr>
          <tr><td style="font-weight:600;color:var(--navy)">Class Size</td><td>${Classes.enrolledCount(cls.id)} students</td></tr>
          <tr><td style="font-weight:600;color:var(--navy)">Subjects Offered</td><td>${(cls.subjects || []).map(esc).join(', ')}</td></tr>
        </tbody>
      </table>`;
  }
}

function renderStudentHomework(s, student) {
  const list = document.getElementById('stuHomeworkList');
  if (!list) return;
  const items = Homework.forStudent(student);
  // subject filter
  const filter = document.getElementById('stuHwFilter');
  if (filter && filter.options.length <= 1) {
    [...new Set(items.map(h => h.subject))].forEach(sub => filter.innerHTML += `<option value="${esc(sub)}">${esc(sub)}</option>`);
    filter.addEventListener('change', () => renderStudentHomework(s, student));
  }
  const sub = filter ? filter.value : '';
  const filtered = sub ? items.filter(h => h.subject === sub) : items;
  list.innerHTML = filtered.length ? filtered.map(h => {
    const st = Homework.statusOf(h);
    const badge = { published: 'success', active: 'success', upcoming: 'navy', overdue: 'danger', closed: 'danger' }[st] || 'navy';
    const mySub = Homework.submission(h.id, s.id);
    return `
    <div class="panel" style="margin-bottom:16px">
      <div class="panel-head">
        <h3>${esc(h.title)}</h3>
        <span class="badge badge-${badge}">${st}</span>
      </div>
      <div class="panel-body">
        <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:10px">
          <span style="font-size:0.85rem;color:var(--text-light)"><i class="fas fa-book"></i> ${esc(h.subject)}</span>
          <span style="font-size:0.85rem;color:var(--text-light)"><i class="fas fa-calendar"></i> Assigned ${fmtDate(h.dateAssigned)}</span>
          <span style="font-size:0.85rem;color:var(--text-light)"><i class="fas fa-clock"></i> Due ${fmtDate(h.deadline)}</span>
          <span style="font-size:0.85rem;color:var(--text-light)"><i class="fas fa-chalkboard-teacher"></i> ${esc(h.teacherName)}</span>
        </div>
        ${h.instructions ? `<p style="font-size:0.9rem;margin-bottom:10px">${esc(h.instructions)}</p>` : ''}
        ${h.attachmentName ? `<p style="font-size:0.85rem"><i class="fas fa-paperclip"></i> ${esc(h.attachmentName)}</p>` : ''}
        <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
          ${h.attachmentKey ? `<button class="btn btn-sm btn-outline" onclick="downloadHomeworkFile('${h.id}')"><i class="fas fa-download"></i> Download Attachment</button>` : ''}
          <button class="btn btn-sm btn-outline" onclick="printHomework('${h.id}')"><i class="fas fa-print"></i> Print</button>
          ${h.submissionMethod === 'online' && st !== 'closed'
            ? (mySub
              ? `<span class="badge badge-success"><i class="fas fa-check"></i> Submitted ${fmtDate(mySub.submittedAt)}${mySub.grade ? ' · Grade: ' + esc(mySub.grade) : ''}</span>
                 ${st !== 'overdue' ? `<button class="btn btn-sm btn-outline" onclick="openSubmitHomework('${h.id}')"><i class="fas fa-rotate"></i> Resubmit</button>` : ''}`
              : `<button class="btn btn-sm btn-primary" onclick="openSubmitHomework('${h.id}')"><i class="fas fa-upload"></i> Submit Online</button>`)
            : ''}
          ${mySub && mySub.feedback ? `<div style="margin-top:10px;padding:10px;background:var(--cream);border-radius:8px;font-size:0.88rem"><strong>Teacher feedback:</strong> ${esc(mySub.feedback)}</div>` : ''}
        </div>
      </div>
    </div>`;
  }).join('') : `<div class="empty-state"><i class="fas fa-book-open"></i><h4>No homework yet</h4><p>Published homework for your class will appear here.</p></div>`;
}

function downloadHomeworkFile(hwId) {
  const h = Homework.get(hwId);
  if (!h || !h.attachmentKey) return;
  const s = Auth.session();
  /* APPROVAL GATE: the attachment is content too. */
  if (s && (s.role === 'student' || s.role === 'parent') && !ApprovalGate.approvedForStudents(h)) { toast('This homework has not been approved for publication yet.', 'error'); return; }
  const names = h.classNames || [h.className];
  if (s && s.role === 'student') {
    const stu = studentForSession(s);
    if (!stu || !names.includes(stu.className)) { toast('Not authorized.', 'error'); return; }
  } else if (s && s.role === 'parent') {
    // parent may download if any linked child is in one of the homework's classes
    const p = Parents.get(s.id);
    const kids = (p && p.childrenIds ? p.childrenIds : []).map(cid => DB.get('students').find(x => x.id === cid)).filter(Boolean);
    if (!kids.some(k => names.includes(k.className))) { toast('Not authorized.', 'error'); return; }
  }
  ImageStore.get(h.attachmentKey).then(dataUrl => {
    if (!dataUrl) { toast('File not found.', 'error'); return; }
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = (h.className + '_' + h.subject + '_' + (h.attachmentName || 'attachment')).replace(/[^a-zA-Z0-9._-]+/g, '_');
    document.body.appendChild(a);
    a.click();
    a.remove();
  }).catch(() => toast('Download failed.', 'error'));
}

/* print-friendly A4 homework view (used by teacher list + student portal) */
function printHomework(hwId) {
  const h = Homework.get(hwId);
  if (!h) return;
  const ps = Auth.session();
  if (ps && (ps.role === 'student' || ps.role === 'parent') && !ApprovalGate.approvedForStudents(h)) { toast('This homework has not been approved for publication yet.', 'error'); return; }
  const clsNames = (h.classNames && h.classNames.length) ? h.classNames.join(', ') : (h.className || '');
  const w = window.open('', '_blank', 'width=800,height=900');
  if (!w) { toast('Please allow pop-ups to print.', 'error'); return; }
  w.document.write(`<!DOCTYPE html><html><head><title>${esc(h.title)} — Homework</title>
    <style>
      @page { size: A4; margin: 18mm; }
      body { font-family: Georgia, 'Times New Roman', serif; color: #111; margin: 0; padding: 24px; line-height: 1.5; }
      .head { text-align: center; border-bottom: 3px double #1a3a6b; padding-bottom: 12px; margin-bottom: 20px; }
      .head h1 { margin: 0; color: #1a3a6b; font-size: 1.4em; }
      .head p { margin: 4px 0 0; color: #555; font-size: 0.9em; }
      h2 { color: #1a3a6b; font-size: 1.2em; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
      table { width: 100%; border-collapse: collapse; margin: 12px 0; }
      td, th { border: 1px solid #bbb; padding: 8px 10px; text-align: left; font-size: 0.92em; }
      th { background: #eef2f8; color: #1a3a6b; }
      .instructions { white-space: pre-wrap; background: #f8f8f8; border: 1px solid #ddd; padding: 14px; border-radius: 4px; margin: 12px 0; }
      .attach { margin-top: 16px; padding: 10px; border: 1px dashed #999; border-radius: 4px; font-size: 0.9em; color: #444; }
      .sign { margin-top: 50px; display: flex; gap: 60px; }
      .sign div { flex: 1; border-top: 1px solid #333; padding-top: 6px; text-align: center; font-size: 0.85em; }
      .printbtn { position: fixed; top: 12px; right: 12px; padding: 10px 18px; background: #1a3a6b; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9em; }
      @media print { .printbtn { display: none; } }
    </style></head><body>
    <button class="printbtn" onclick="window.print()">🖨 Print</button>
    <div class="head">
      <h1>ST. TERESA ACADEMY</h1>
      <p>Homework / Assignment Sheet</p>
    </div>
    <h2>${esc(h.title)}</h2>
    <table>
      <tr><th style="width:30%">Subject</th><td>${esc(h.subject)}</td></tr>
      <tr><th>Class(es)</th><td>${esc(clsNames)}</td></tr>
      <tr><th>Date Assigned</th><td>${fmtDate(h.dateAssigned)}</td></tr>
      <tr><th>Due Date</th><td>${fmtDate(h.deadline)}</td></tr>
      <tr><th>Teacher</th><td>${esc(h.teacherName)}</td></tr>
      <tr><th>Submission Method</th><td>${esc(h.submissionMethod || 'In class')}</td></tr>
      <tr><th>Status</th><td>${esc(h.status)}</td></tr>
    </table>
    ${h.instructions ? `<div><strong>Instructions:</strong><div class="instructions">${esc(h.instructions)}</div></div>` : '<p><em>No written instructions provided.</em></p>'}
    ${h.attachmentName ? `<div class="attach"><i class="fas fa-paperclip"></i> Attachment: <strong>${esc(h.attachmentName)}</strong> — download it from the portal.</div>` : ''}
    <div class="sign">
      <div>Teacher Signature</div>
      <div>Parent / Guardian Signature</div>
      <div>Date Returned</div>
    </div>
  </body></html>`);
  w.document.close();
}

function openSubmitHomework(hwId) {
  const h = Homework.get(hwId);
  if (!h) return;
  document.getElementById('submitHwTitle').textContent = 'Submit — ' + h.title;
  document.getElementById('submitHwBody').innerHTML = `
    <form id="hwSubmitForm">
      <div class="form-group">
        <label>Your Answer / Work</label>
        <textarea id="hwSubmitContent" rows="6" placeholder="Type your answer or describe your work here..."></textarea>
      </div>
      <div class="form-group">
        <label>Attach File (optional)</label>
        <input type="file" id="hwSubmitFile" accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg">
      </div>
      <div class="form-actions">
        <button type="submit" class="btn btn-primary"><i class="fas fa-paper-plane"></i> Submit</button>
        <button type="button" class="btn btn-outline" onclick="closeModal('submitHwModal')">Cancel</button>
      </div>
    </form>`;
  const form = document.getElementById('hwSubmitForm');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const s = Auth.session();
    let fileName = '', fileKey = '';
    const f = document.getElementById('hwSubmitFile').files[0];
    if (f) {
      if (f.size > 5 * 1024 * 1024) { toast('File too large (max 5MB).', 'error'); return; }
      fileKey = 'hsub_' + DB.uid();
      fileName = f.name;
      const dataUrl = await fileToDataUrl(f);
      await ImageStore.put(fileKey, dataUrl);
    }
    const r = Homework.submit(hwId, s.id, document.getElementById('hwSubmitContent').value, fileName, fileKey);
    if (!r.ok) { toast(r.error, 'error'); return; }
    toast(r.resubmitted ? 'Submission updated!' : 'Homework submitted!');
    closeModal('submitHwModal');
    renderStudentHomework(s, studentForSession(s));
  });
  openModal('submitHwModal');
}

function renderStudentMaterials(s, student) {
  const tbody = document.getElementById('stuMaterialsBody');
  if (!tbody) return;
  const items = Materials.forStudent(student);
  const filter = document.getElementById('stuMatFilter');
  if (filter && !filter.dataset.bound) {
    filter.dataset.bound = '1';
    filter.addEventListener('change', () => renderStudentMaterials(s, student));
  }
  const cat = filter ? filter.value : '';
  const filtered = cat ? items.filter(m => m.subject === cat || m.category === cat) : items;
  tbody.innerHTML = filtered.length ? filtered.map(m => `
    <tr>
      <td><strong>${esc(m.title)}</strong><br><small style="color:var(--text-light)"><i class="fas fa-file"></i> ${esc(m.fileName || '')}${m.fileSize ? ' · ' + Math.round(m.fileSize / 1024) + ' KB' : ''}</small></td>
      <td>${esc(m.subject)}</td>
      <td><span class="badge badge-navy">${esc(m.category)}</span></td>
      <td>${fmtDate(m.uploadedAt)}</td>
      <td class="table-actions">
        <button class="btn btn-xs btn-outline" onclick="viewMaterial('${m.id}')"><i class="fas fa-eye"></i> View</button>
        <button class="btn btn-xs btn-primary" onclick="downloadMaterial('${m.id}')"><i class="fas fa-download"></i> Download</button>
        <button class="btn btn-xs btn-gold" onclick="printMaterial('${m.id}')"><i class="fas fa-print"></i> Print</button>
      </td>
    </tr>`).join('') : `<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--text-light)">No learning materials available yet</td></tr>`;
}

function renderStudentExamTimetable(s, student) {
  const box = document.getElementById('stuExamSchedule');
  if (!box) return;
  const items = ExamSchedule.forStudent(student);
  box.innerHTML = items.length ? items.map(e => `
    <div class="panel" style="margin-bottom:14px">
      <div class="panel-head">
        <h3>${esc(e.title)}</h3>
        <span class="badge badge-${e.status === 'draft' ? 'warning' : e.date < today() ? 'danger' : 'success'}">${e.date < today() ? 'Completed' : 'Upcoming'}</span>
      </div>
      <div class="panel-body">
        <div style="display:flex;gap:18px;flex-wrap:wrap;margin-bottom:8px">
          <span style="font-size:0.88rem"><i class="fas fa-book" style="color:var(--gold)"></i> <strong>${esc(e.subject)}</strong></span>
          <span style="font-size:0.88rem"><i class="fas fa-calendar" style="color:var(--gold)"></i> ${fmtDate(e.date)}</span>
          ${e.startTime ? `<span style="font-size:0.88rem"><i class="fas fa-clock" style="color:var(--gold)"></i> ${esc(e.startTime)}–${esc(e.endTime || '')}</span>` : ''}
          ${e.venue ? `<span style="font-size:0.88rem"><i class="fas fa-location-dot" style="color:var(--gold)"></i> ${esc(e.venue)}</span>` : ''}
        </div>
        ${e.instructions ? `<p style="font-size:0.88rem;margin-bottom:6px"><strong>Instructions:</strong> ${esc(e.instructions)}</p>` : ''}
        ${e.revisionMaterials ? `<p style="font-size:0.85rem;color:var(--text-light)"><i class="fas fa-book-bookmark"></i> Permitted materials: ${esc(e.revisionMaterials)}</p>` : ''}
      </div>
    </div>`).join('') : `<div class="empty-state"><i class="fas fa-calendar-check"></i><h4>No exams scheduled</h4><p>The examination timetable will appear here once published.</p></div>`;
}

function renderStudentResults(s, student) {
  const tbody = document.getElementById('stuResultsBody');
  const subsBox = document.getElementById('stuSubmissionsBody');
  // all of the student's own submissions (with marking status)
  const submissions = (typeof ExamMarking !== 'undefined') ? ExamMarking.forStudent(s.id) : [];
  if (subsBox) {
    subsBox.innerHTML = submissions.length ? submissions.map(sub => `
      <div style="padding:10px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center">
        <div>
          <strong style="color:var(--navy);font-size:0.92rem">${esc(sub.examTitle)}</strong>
          <p style="font-size:0.83rem;color:var(--text-light);margin:2px 0 0">${esc(sub.subject || '')}${sub.className ? ' · ' + esc(sub.className) : ''} · submitted ${esc(fmtDate(sub.submittedAt))}</p>
          ${ExamMarking.isPublished(sub) ? '' : `<p style="font-size:0.83rem;margin:4px 0 0"><i class="fas fa-circle-info" style="color:var(--gold)"></i> Submission received — your results are awaiting teacher marking or approval.</p>`}
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <span class="badge badge-${ExamMarking.badgeFor(sub.markingStatus)}">${esc(ExamMarking.statusLabel(sub.markingStatus))}</span>
          <button class="btn btn-xs btn-outline" onclick="viewExamResult('${sub.id}')"><i class="fas fa-eye"></i> Details</button>
        </div>
      </div>`).join('') : '<p style="color:var(--text-light);font-size:0.9rem">You have not submitted any online exams yet.</p>';
  }
  if (tbody) {
    const results = Results.publishedForStudent(s.id);
    const exams = DB.get('exams');
    tbody.innerHTML = results.length ? results.map(r => {
      const ex = exams.find(x => x.id === r.examId) || {};
      const maxMarks = r.maxMarks || r.total || 0;
      return `
      <tr>
        <td><strong>${esc(r.examTitle)}</strong></td>
        <td>${esc(r.subject || ex.subject || '—')}</td>
        <td>${r.score}/${maxMarks}</td>
        <td><strong>${r.percent}%</strong></td>
        <td><span class="badge badge-${r.percent >= 50 ? 'success' : 'danger'}">${Results.gradeFor(r.percent)}</span></td>
        <td>${esc(ExamMarking.statusLabel(r.markingStatus || 'published'))}</td>
        <td>${fmtDate(r.publishedAt || r.date)}</td>
        <td><button class="btn btn-xs btn-outline" onclick="viewExamResult('${r.id}')"><i class="fas fa-eye"></i> View</button></td>
      </tr>`;
    }).join('') : `<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--text-light)">No published results yet — submitted exams appear above until your teacher publishes them.</td></tr>`;
  }
  const rcBox = document.getElementById('stuReportCards');
  if (rcBox) {
    const cards = Results.reportCardFor(s.id) || [];
    rcBox.innerHTML = cards.length ? cards.map(rc => `
      <div style="padding:12px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center">
        <div>
          <strong style="color:var(--navy)">Term ${esc(rc.term)} · ${esc(rc.academicYear)}</strong>
          <p style="font-size:0.85rem;color:var(--text-light)">Average: ${esc(rc.average)}% · Grade ${esc(rc.grade)} · Published ${fmtDate(rc.publishedAt)}</p>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-sm btn-outline" onclick="viewReportCard('${rc.id}')"><i class="fas fa-eye"></i> View</button>
          <button class="btn btn-sm btn-gold" onclick="printReportCard('${rc.id}')"><i class="fas fa-print"></i> Print</button>
        </div>
      </div>`).join('') : '<p style="color:var(--text-light)">No report cards published yet.</p>';
  }
}

/* detailed exam result view (students see their own only) */
function viewExamResult(id) {
  const sub = ExamMarking.get(id);
  if (!sub) return;
  if (!ExamMarking.canView(sub)) { toast('Not authorized.', 'error'); return; }
  /* APPROVAL GATE: marks of an exam that never completed the chain stay hidden. */
  const published = ExamMarking.isPublished(sub) && ApprovalGate.approvedForStudents(ExamMarking.examOf(sub));
  const body = document.getElementById('resultDetailBody');
  if (!body) return;
  if (!published && !Perm.isStaff()) {
    body.innerHTML = `
      <div style="text-align:center;padding:26px 10px">
        <div style="width:76px;height:76px;border-radius:50%;background:var(--warning-bg,var(--cream));color:var(--warning,#8a6d10);display:flex;align-items:center;justify-content:center;font-size:1.9rem;margin:0 auto 14px"><i class="fas fa-hourglass-half"></i></div>
        <h3 style="color:var(--navy);margin-bottom:8px">Submission Received</h3>
        <p style="margin-bottom:8px">Your exam has been submitted successfully. Your results are awaiting teacher marking or approval.</p>
        <p style="margin-bottom:12px"><span class="badge badge-${ExamMarking.badgeFor(sub.markingStatus)}">${esc(ExamMarking.statusLabel(sub.markingStatus))}</span></p>
        <p style="font-size:0.86rem;color:var(--text-light)"><strong>${esc(sub.examTitle)}</strong> · ${esc(sub.subject || '')} · submitted ${esc(fmtDate(sub.submittedAt))}</p>
        <p style="font-size:0.84rem;color:var(--text-light);margin-top:12px"><i class="fas fa-lock"></i> Marks and answers are shown here after your teacher publishes the results.</p>
        <button class="btn btn-primary" style="margin-top:16px" onclick="closeModal('resultDetailModal')">Close</button>
      </div>`;
    openModal('resultDetailModal');
    return;
  }
  const optText = (r, oid) => { const o = (r.options || []).find(x => x.id === oid); return o ? o.text : (oid || ''); };
  body.innerHTML = `
    <div class="form-grid" style="margin-bottom:16px">
      <div class="form-group full"><label>Exam</label><div style="font-weight:800;color:var(--navy);font-size:1.05rem">${esc(sub.examTitle)}</div></div>
      <div class="form-group"><label>Subject</label><div>${esc(sub.subject || '—')}</div></div>
      <div class="form-group"><label>Class</label><div>${esc(sub.className || '—')}</div></div>
      <div class="form-group"><label>Student</label><div>${esc(sub.studentName)}${sub.admissionNo ? ' · ' + esc(sub.admissionNo) : ''}</div></div>
      <div class="form-group"><label>Submitted</label><div>${esc(fmtDate(sub.submittedAt))}</div></div>
      <div class="form-group"><label>Marks Awarded</label><div style="font-weight:800;color:var(--navy);font-size:1.1rem">${sub.score} / ${sub.maxMarks}</div></div>
      <div class="form-group"><label>Percentage</label><div style="font-weight:800">${sub.percent}% (${Results.gradeFor(sub.percent)})</div></div>
      <div class="form-group"><label>Result Status</label><div><span class="badge badge-${ExamMarking.badgeFor(sub.markingStatus)}">${esc(ExamMarking.statusLabel(sub.markingStatus))}</span></div></div>
      <div class="form-group"><label>Published</label><div>${sub.publishedAt ? esc(fmtDate(sub.publishedAt)) : '—'}</div></div>
      ${sub.teacherFeedback ? `<div class="form-group full"><label>Teacher's Feedback</label><div style="padding:12px;background:var(--cream,#faf9f6);border-radius:8px">${esc(sub.teacherFeedback)}</div></div>` : ''}
    </div>
    <h4 style="color:var(--navy);margin-bottom:10px"><i class="fas fa-list-ol"></i> Question Breakdown</h4>
    ${(sub.questionResponses || []).map((r, i) => {
      const correct = r.autoCorrect === true || (r.awardedMarks != null && r.awardedMarks >= r.maxMarks && r.type !== 'written' && r.optionId);
      const wrong = r.type !== 'written' && r.optionId && r.awardedMarks === 0 && r.correctOptionId;
      return `
      <div style="border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
          <strong style="color:var(--navy)">Q${i + 1}. ${esc(r.text)}</strong>
          <span style="font-weight:700">${r.awardedMarks == null ? '—' : r.awardedMarks} / ${r.maxMarks}</span>
        </div>
        <p style="font-size:0.86rem;margin:8px 0 0"><strong>Your answer:</strong> ${
          r.type === 'written'
            ? (r.answerText ? esc(r.answerText) : '<span style="color:var(--danger)">Not answered</span>')
            : (r.optionId ? esc(optText(r, r.optionId)) : '<span style="color:var(--danger)">Not answered</span>')
        }</p>
        ${r.type !== 'written' && r.correctOptionId ? `<p style="font-size:0.86rem;margin:4px 0 0"><strong>Correct answer:</strong> ${esc(optText(r, r.correctOptionId))}</p>` : ''}
        <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
          ${r.autoMarked ? (r.autoCorrect ? '<span class="badge badge-success"><i class="fas fa-check"></i> Correct</span>' : '<span class="badge badge-danger"><i class="fas fa-xmark"></i> Incorrect</span>') : `<span class="badge badge-navy"><i class="fas fa-user-pen"></i> Marked by teacher</span>`}
          ${r.comment ? `<span class="badge badge-gold"><i class="fas fa-comment"></i> ${esc(r.comment)}</span>` : ''}
        </div>
      </div>`;
    }).join('')}
    <div style="display:flex;justify-content:flex-end;margin-top:14px">
      <button class="btn btn-outline" onclick="closeModal('resultDetailModal')">Close</button>
    </div>`;
  openModal('resultDetailModal');
}

function viewReportCard(rcId) {
  const rc = DB.get('reportCards').find(x => x.id === rcId);
  if (!rc) return;
  const s = Auth.session();
  if (s && s.role === 'student' && rc.studentId !== s.id) { toast('Not authorized.', 'error'); return; }
  const body = document.getElementById('reportCardBody');
  body.innerHTML = reportCardHTML(rc);
  openModal('reportCardModal');
}

function reportCardHTML(rc) {
  return `
    <div id="reportCardPrintArea">
      <div style="text-align:center;margin-bottom:18px;border-bottom:2px solid var(--gold);padding-bottom:12px">
        <h2 style="color:var(--navy)">ST. TERESA ACADEMY</h2>
        <p style="color:var(--text-light)">Student Report Card — Term ${esc(rc.term)}, ${esc(rc.academicYear)}</p>
      </div>
      <table class="data-table" style="margin-bottom:16px">
        <tbody>
          <tr><td style="font-weight:600;width:30%">Student</td><td>${esc(rc.studentName)}</td></tr>
          <tr><td style="font-weight:600">Class</td><td>${esc(rc.className)}</td></tr>
          <tr><td style="font-weight:600">Average</td><td><strong>${esc(rc.average)}%</strong> — Grade ${esc(rc.grade)}</td></tr>
        </tbody>
      </table>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Subject</th><th>Marks</th><th>Grade</th><th>Teacher Comment</th></tr></thead>
        <tbody>${(rc.subjects || []).map(sub => `
          <tr><td>${esc(sub.subject)}</td><td>${esc(sub.marks)}/${esc(sub.outOf || 100)}</td><td>${esc(sub.grade || Results.gradeFor(Number(sub.marks)))}</td><td>${esc(sub.comment || '')}</td></tr>`).join('')}
        </tbody>
      </table></div>
      ${rc.classTeacherComment ? `<p style="margin-top:14px"><strong>Class Teacher:</strong> ${esc(rc.classTeacherComment)}</p>` : ''}
      ${rc.headteacherComment ? `<p style="margin-top:8px"><strong>Headteacher:</strong> ${esc(rc.headteacherComment)}</p>` : ''}
      <p style="margin-top:16px;font-size:0.8rem;color:var(--text-light);text-align:center">Published ${fmtDate(rc.publishedAt)} · Approved by ${esc(rc.approvedBy || 'Administration')}</p>
    </div>
    <div style="margin-top:16px;display:flex;gap:10px;justify-content:flex-end">
      <button class="btn btn-gold" onclick="window.print()"><i class="fas fa-print"></i> Print</button>
    </div>`;
}

function printReportCard(rcId) {
  const rc = DB.get('reportCards').find(x => x.id === rcId);
  if (!rc) return;
  printHTML('Report Card — ' + rc.studentName + ' Term ' + rc.term, reportCardHTML(rc).replace(/<div style="margin-top:16px;[\s\S]*?<\/div>$/, ''));
}

function renderStudentAttendance(s, student) {
  const sumBox = document.getElementById('stuAttSummary');
  const tbody = document.getElementById('stuAttendanceBody');
  if (!sumBox || !tbody) return;
  const att = Attendance.summaryForStudent(s.id);
  sumBox.innerHTML = `
    <div class="stat-card"><div class="s-icon green"><i class="fas fa-check"></i></div><div class="s-info"><div class="s-num">${att.present}</div><div class="s-label">Present</div></div></div>
    <div class="stat-card"><div class="s-icon red"><i class="fas fa-xmark"></i></div><div class="s-info"><div class="s-num">${att.absent}</div><div class="s-label">Absent</div></div></div>
    <div class="stat-card"><div class="s-icon gold"><i class="fas fa-clock"></i></div><div class="s-info"><div class="s-num">${att.late}</div><div class="s-label">Late</div></div></div>
    <div class="stat-card"><div class="s-icon blue"><i class="fas fa-file-circle-plus"></i></div><div class="s-info"><div class="s-num">${att.excused}</div><div class="s-label">Excused</div></div></div>
    <div class="stat-card"><div class="s-icon navy"><i class="fas fa-percent"></i></div><div class="s-info"><div class="s-num">${att.pct !== null ? att.pct + '%' : '—'}</div><div class="s-label">Attendance Rate</div></div></div>`;
  const recs = Attendance.forStudent(s.id);
  tbody.innerHTML = recs.length ? recs.slice(0, 60).map(a => `
    <tr>
      <td>${fmtDate(a.date)}</td>
      <td><span class="badge badge-${a.status === 'present' ? 'success' : a.status === 'absent' ? 'danger' : a.status === 'late' ? 'warning' : 'navy'}">${esc(a.status)}</span></td>
      <td>${esc(a.arrivalTime || '—')}</td>
      <td>${esc(a.remarks || '—')}</td>
    </tr>`).join('') : `<tr><td colspan="4" style="text-align:center;padding:30px;color:var(--text-light)">No attendance records yet</td></tr>`;
}

function renderStudentAnnouncements(s, student) {
  const box = document.getElementById('stuAnnouncementsList');
  if (!box) return;
  const items = Announcements.forStudent(student);
  box.innerHTML = items.length ? items.map(a => `
    <div style="padding:14px 0;border-bottom:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <strong style="color:var(--navy)">${esc(a.title)}</strong>
        <span class="badge badge-${a.audience === 'all' ? 'navy' : 'gold'}">${a.audience === 'all' ? 'School-wide' : esc(a.className)}</span>
      </div>
      <p style="font-size:0.9rem;margin-top:6px">${esc(a.content || '')}</p>
      <small style="color:var(--text-light)">By ${esc(a.createdBy)} · ${fmtDate(a.createdAt)}</small>
    </div>`).join('') : '<p style="color:var(--text-light)">No announcements yet.</p>';
}

function renderStudentContacts(s, student) {
  const box = document.getElementById('stuContacts');
  if (!box) return;
  const settings = DB.get('settings', {});
  const cls = Classes.byName(student.className || '');
  const parts = [];
  // class teacher
  if (cls && cls.teacherId) {
    const t = DB.get('teachers').find(x => x.id === cls.teacherId) || {};
    parts.push(contactCard('Class Teacher', cls.teacherName || teacherDisplayName(t), t.role || 'Class Teacher', t.phone, t.email, t.photo, (t.subject || '')));
  }
  // leadership
  Leadership.list().filter(l => l.status !== 'inactive' && l.published !== false).forEach(l => {
    parts.push(contactCard(Leadership.labelFor(l.position), l.name, l.title || Leadership.labelFor(l.position), l.phone || settings.phone, l.email || settings.email, l.photo, ''));
  });
  // school general
  parts.push(`
    <div class="panel">
      <div class="panel-head"><h3><i class="fas fa-school" style="color:var(--gold)"></i> School Office</h3></div>
      <div class="panel-body">
        <p><i class="fas fa-phone" style="color:var(--gold);width:20px"></i> +254 700 131515</p>
        <p><i class="fas fa-envelope" style="color:var(--gold);width:20px"></i> saintlykids@gmail.com</p>
      </div>
    </div>`);
  box.innerHTML = parts.join('');
}

function contactCard(role, name, title, phone, email, photo, extra) {
  return `
    <div class="panel" style="margin-bottom:14px">
      <div class="panel-head"><h3><i class="fas fa-user-tie" style="color:var(--gold)"></i> ${esc(role)}</h3></div>
      <div class="panel-body">
        <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
          ${photo
            ? `<img src="${esc(photo)}" style="width:64px;height:64px;border-radius:50%;object-fit:cover;border:2px solid var(--gold)">`
            : `<div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,var(--navy),var(--navy-light));color:var(--gold);display:flex;align-items:center;justify-content:center;font-weight:800;flex-shrink:0">${initials(name)}</div>`}
          <div style="flex:1;min-width:180px">
            <strong style="color:var(--navy)">${esc(name)}</strong>
            <p style="font-size:0.85rem;color:var(--text-light)">${esc(title)}${extra ? ' · ' + esc(extra) : ''}</p>
            <p style="font-size:0.85rem">${phone ? '<i class="fas fa-phone"></i> ' + esc(phone) : '<span style="color:var(--text-light)">Phone not provided</span>'}</p>
            <p style="font-size:0.85rem">${email ? '<i class="fas fa-envelope"></i> ' + esc(email) : '<span style="color:var(--text-light)">Email not provided</span>'}</p>
          </div>
          <div style="display:flex;gap:8px">
            ${phone ? `<a class="btn btn-sm btn-primary" href="tel:${esc(phone)}"><i class="fas fa-phone"></i> Call</a>` : ''}
            ${email ? `<a class="btn btn-sm btn-gold" href="mailto:${esc(email)}"><i class="fas fa-envelope"></i> Email</a>` : ''}
          </div>
        </div>
      </div>
    </div>`;
}

function renderStudentNotifications(s) {
  const box = document.getElementById('stuNotificationsList');
  const badge = document.getElementById('stuNotifBadge');
  if (!box) return;
  const items = Notifications.forUser(s.id);
  const unread = items.filter(n => !n.read).length;
  if (badge) { badge.textContent = unread; badge.style.display = unread ? '' : 'none'; }
  box.innerHTML = items.length ? items.map(n => `
    <div style="padding:12px 0;border-bottom:1px solid var(--border);display:flex;gap:12px;align-items:flex-start;${n.read ? 'opacity:0.65' : ''}">
      <i class="fas ${n.type === 'alert' ? 'fa-triangle-exclamation' : n.type === 'success' ? 'fa-circle-check' : 'fa-circle-info'}" style="color:${n.type === 'alert' ? 'var(--danger)' : n.type === 'success' ? 'var(--success)' : 'var(--gold)'};margin-top:3px"></i>
      <div style="flex:1">
        <strong style="color:var(--navy);font-size:0.92rem">${esc(n.title)}</strong>
        <p style="font-size:0.85rem;color:var(--text-light)">${esc(n.message || '')}</p>
        <small style="color:var(--text-light)">${new Date(n.createdAt).toLocaleString()}</small>
        ${/^fee/.test(String(n.category || '')) ? `<div style="margin-top:6px"><button class="btn btn-xs btn-outline" onclick="studentOpenFees()"><i class="fas fa-receipt"></i> View fee account</button></div>` : ''}
      </div>
      ${!n.read ? `<button class="btn btn-xs btn-outline" onclick="studentMarkRead('${n.id}')"><i class="fas fa-check"></i></button>` : ''}
    </div>`).join('') : '<p style="color:var(--text-light)">No notifications.</p>';
}

function studentOpenFees() {
  const link = document.querySelector('.sidebar-nav a[data-section="fees"]');
  if (link) link.click();
}

function studentMarkRead(id) {
  Notifications.markRead(id);
  const s = Auth.session();
  renderStudentNotifications(s);
}

function studentMarkAllRead() {
  const s = Auth.session();
  if (s) Notifications.markAllRead(s.id);
  renderStudentNotifications(s);
  toast('All notifications marked as read.');
}
/* ============================================================
   ADMIN: DASHBOARD UPGRADE (extra stats)
   ============================================================ */
(function enhanceAdminDashboard() {
  const orig = window.loadAdminDashboard;
  window.loadAdminDashboard = function () {
    if (typeof orig === 'function') orig();
    if (!document.getElementById('admTotalStudents')) return;
    const classes = Classes.list();
    const unassigned = ClassTeacher.unassignedClasses();
    const attToday = Attendance.list().filter(a => a.date === today());
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('admTotalClasses', classes.length);
    set('admUnassigned', unassigned.length);
    set('admAttMarked', attToday.length);
    // augment chart labels to the 11 classes
    const chart = document.getElementById('gradeChart');
    if (chart) {
      const students = DB.get('students');
      const max = Math.max(...classes.map(c => Classes.enrolledCount(c.id)), 1);
      chart.innerHTML = classes.map(c => {
        const n = Classes.enrolledCount(c.id);
        const h = Math.max(6, Math.round((n / max) * 140));
        return `<div class="bar-col"><div class="bar" style="height:${h}px"><span class="val">${n}</span></div><span class="bar-label">${esc(c.name.replace('Grade ', ''))}</span></div>`;
      }).join('');
    }
  };
})();

/* ============================================================
   SECRETARY PORTAL — student management, admissions, photos,
   transfers, archive, print (uses Students module from modules.js)
   ============================================================ */
let _adPhotoData = '';      // compressed data-URL of the admission photo
let _replacePhotoData = '';
let _replacePhotoStudentId = '';
let _stuManagePage = 1;
const STU_PAGE_SIZE = 10;

function initSecretaryPortal() {
  const s = Auth.session();
  if (!s || s.role !== 'secretary') return;
  loadSecretaryDashboard();
  initSecretaryAdmit();
  initSecretaryStudentManagement();
  renderSecretaryPayments();
  if (typeof FeeUI !== 'undefined') FeeUI.init();
  // sidebar section refreshes
  document.querySelectorAll('.sidebar-nav a[data-section]').forEach(a => {
    a.addEventListener('click', () => {
      const sec = a.dataset.section;
      if (sec === 'dashboard') loadSecretaryDashboard();
      if (sec === 'students') { _stuManagePage = 1; renderStudentManagement(); }
      if (sec === 'admit') initSecretaryAdmit();
      if (sec === 'payments') renderSecretaryPayments();
      if (sec === 'fee-structures' && typeof FeeUI !== 'undefined') { FeeUI.renderItems(); FeeUI.renderClassStructures(); }
      if (sec === 'student-fees' && typeof FeeUI !== 'undefined') FeeUI.renderStudentList((document.getElementById('secFeeSearch') || {}).value || '');
      if (sec === 'pos' && typeof FeeUI !== 'undefined') FeeUI.posRender();
    });
  });
}

function loadSecretaryDashboard() {
  const stats = (typeof Students !== 'undefined') ? Students.stats() : { total: 0, active: 0, pending: 0, newlyAdmitted: 0, transferredInClass: 0, transferredOut: 0, withdrawnArchived: 0, byClass: {} };
  const payments = DB.get('payments');
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('secActiveStudents', stats.active);
  set('secNewAdmitted', stats.newlyAdmitted);
  set('secPending', stats.pending);
  set('secTransferredIn', stats.transferredInClass);
  set('secTransferredOut', stats.transferredOut);
  set('secWithdrawnArchived', stats.withdrawnArchived);

  const byClassBox = document.getElementById('secByClass');
  if (byClassBox) {
    const entries = Object.entries(stats.byClass || {});
    byClassBox.innerHTML = entries.length
      ? `<div style="display:flex;flex-wrap:wrap;gap:8px">${entries.map(([cn, n]) => `<span class="badge badge-navy" style="font-size:0.82rem;padding:6px 10px">${esc(cn)}: ${n}</span>`).join('')}</div>`
      : '<p style="color:var(--text-light)">No active students yet.</p>';
  }

  const tbody = document.getElementById('secRecentBody');
  if (tbody) {
    const recent = [...Students.list()].reverse().slice(0, 6);
    tbody.innerHTML = recent.length ? recent.map(st => `
      <tr>
        <td>${studentThumb(st)}</td>
        <td><strong>${esc(st.firstName)} ${esc(st.lastName)}</strong></td>
        <td>${esc(st.admissionNo || '—')}</td>
        <td>${esc(st.className || '—')}</td>
        <td>${fmtDate(st.admissionDate)}</td>
        <td><span class="badge badge-${statusBadge(st.status)}">${esc(st.status || 'active')}</span></td>
      </tr>`).join('') : `<tr><td colspan="6" style="text-align:center;color:var(--text-light)">No admissions yet</td></tr>`;
  }
}

function statusBadge(status) {
  return { active: 'success', pending: 'warning', transferred_out: 'danger', graduated: 'navy', withdrawn: 'danger', archived: 'danger' }[status] || 'warning';
}

function studentThumb(st) {
  const url = (typeof Students !== 'undefined' && Students.photoUrl) ? Students.photoUrl(st) : (st.photo || '');
  if (url) return `<img src="${esc(url)}" alt="" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:1px solid var(--gold)">`;
  return `<div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,var(--navy),var(--navy-light));color:var(--gold);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.7rem">${initials(st.firstName + ' ' + st.lastName)}</div>`;
}

/* ---------- photo validation + compression (shared) ---------- */
const PHOTO_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
function validatePhotoFile(f) {
  if (!f) return 'No file selected.';
  if (!PHOTO_TYPES.includes(f.type)) return 'Unsupported file type. Please choose a JPG, JPEG, PNG or WebP image.';
  if (f.size > PHOTO_MAX_BYTES) return 'Image too large (max 5MB).';
  return null;
}
async function compressPhotoFile(f) {
  // compressImage lives in images.js; falls back to plain data-URL if unavailable
  if (typeof compressImage === 'function') {
    return compressImage(f, 500, 0.85, f.type === 'image/png');
  }
  return fileToDataUrl(f);
}

/* ---------- ACADEMIC YEAR DROPDOWN (shared by every admission form) ----------
   Fills the year <select> from the school's configured academic years and
   keeps the term <select> in step with whichever year is chosen. */
function fillAcademicYearSelect(yearEl, termEl, opts) {
  if (!yearEl) return;
  const o = opts || {};
  const years = (typeof AcademicYears !== 'undefined') ? AcademicYears.forSelection() : [];
  if (!years.length) {
    yearEl.innerHTML = '<option value="">No academic years configured</option>';
    yearEl.disabled = true;
    if (o.hintEl) o.hintEl.innerHTML = '<span style="color:var(--danger)">No academic years are configured. An administrator must add one under Academic Settings.</span>';
    return;
  }
  yearEl.disabled = false;
  yearEl.innerHTML = years.map(y =>
    `<option value="${esc(y.label)}"${y.label === String(o.selected) ? ' selected' : ''}>${esc(y.label)}${y.label === String(o.current) ? ' — current' : ''}</option>`
  ).join('');
  if (o.hintEl) {
    const cur = String(o.current || '');
    o.hintEl.textContent = 'Configured years: ' + years.map(y => y.label).join(', ') + '. Current default is ' + cur + '.';
  }
  const syncTerms = () => {
    if (!termEl) return;
    const terms = (typeof AcademicYears !== 'undefined') ? AcademicYears.termsFor(yearEl.value) : [1, 2, 3];
    const prev = termEl.value;
    termEl.innerHTML = terms.map(t => `<option value="${esc(String(t))}">Term ${esc(String(t))}</option>`).join('');
    termEl.value = terms.map(String).includes(prev) ? prev : String(o.defaultTerm || terms[0] || 1);
  };
  syncTerms();
  yearEl.onchange = syncTerms;
}

/* ---------- ADMIT ---------- */
function initSecretaryAdmit() {
  const form = document.getElementById('admitForm');
  if (!form || form.dataset.bound) return;
  form.dataset.bound = '1';
  // populate class options from the class-management database
  const clsSel = document.getElementById('adClass');
  if (clsSel) clsSel.innerHTML = '<option value="">Select class…</option>' + Classes.list().map(c => `<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('');
  // academic year dropdown + matching terms + admission date
  const st = DB.get('settings', {});
  const curYear = (typeof AcademicYears !== 'undefined') ? AcademicYears.activeYear() : (st.academicYear || String(new Date().getFullYear()));
  const curRec = (typeof AcademicYears !== 'undefined') ? AcademicYears.activeRecord() : null;
  fillAcademicYearSelect(
    document.getElementById('adAcademicYear'),
    document.getElementById('adTerm'),
    { current: curYear, selected: curYear, defaultTerm: curRec ? curRec.defaultTerm : (st.term || '1'), hintEl: document.getElementById('adYearHint') }
  );
  const dt = document.getElementById('adAdmissionDate'); if (dt) dt.value = today();
  const ano = document.getElementById('adAdmissionNo'); if (ano && !ano.value) ano.value = Students.nextAdmissionNo(curYear);
  // photo preview
  const photoInput = document.getElementById('adPhoto');
  if (photoInput && !photoInput.dataset.bound) {
    photoInput.dataset.bound = '1';
    photoInput.addEventListener('change', async () => {
      const f = photoInput.files[0];
      const pv = document.getElementById('adPhotoPreview');
      if (!f) { _adPhotoData = ''; if (pv) pv.innerHTML = ''; return; }
      const err = validatePhotoFile(f);
      if (err) { toast(err, 'error'); photoInput.value = ''; _adPhotoData = ''; if (pv) pv.innerHTML = ''; return; }
      if (pv) pv.innerHTML = `<div class="upload-progress"><i class="fas fa-spinner fa-spin"></i> Processing photograph…</div>`;
      try {
        _adPhotoData = await compressPhotoFile(f);
        if (pv) pv.innerHTML = `
          <div class="photo-preview">
            <img src="${esc(_adPhotoData)}" alt="Passport photograph preview">
            <div class="photo-preview-meta">
              <strong>${esc(f.name)}</strong>
              <small>${(f.size / 1024).toFixed(0)} KB → compressed ready to save</small>
              <span class="badge badge-success"><i class="fas fa-circle-check"></i> Ready</span>
              <button type="button" class="btn btn-xs btn-outline" id="adPhotoClear"><i class="fas fa-xmark"></i> Choose a different photo</button>
            </div>
          </div>`;
        const clr = document.getElementById('adPhotoClear');
        if (clr) clr.addEventListener('click', () => { photoInput.value = ''; _adPhotoData = ''; if (pv) pv.innerHTML = ''; photoInput.click(); });
      } catch (e) {
        toast('Could not read that image. Try a JPG, PNG or WebP under 5MB.', 'error');
        photoInput.value = ''; _adPhotoData = ''; if (pv) pv.innerHTML = '';
      }
    });
  }
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const yearSel = document.getElementById('adAcademicYear');
    const termSel = document.getElementById('adTerm');
    const data = {
      firstName: document.getElementById('adFName').value.trim(),
      lastName: document.getElementById('adLName').value.trim(),
      email: document.getElementById('adEmail').value.trim(),
      className: document.getElementById('adClass').value,
      admissionNo: document.getElementById('adAdmissionNo').value.trim(),
      admissionDate: document.getElementById('adAdmissionDate').value || today(),
      academicYear: yearSel.value,
      term: termSel.value,
      gender: document.getElementById('adGender').value,
      dob: document.getElementById('adDob').value,
      previousSchool: document.getElementById('adPreviousSchool').value,
      status: document.getElementById('adStatus').value,
      category: document.getElementById('adCategory').value || 'Day Scholar',
      remarks: document.getElementById('adRemarks').value,
      photo: _adPhotoData,
      parentName: document.getElementById('adParent').value.trim(),
      parentRelationship: document.getElementById('adParentRelationship').value,
      parentPhone: document.getElementById('adParentPhone').value.trim(),
      parentAltPhone: document.getElementById('adParentAltPhone').value.trim(),
      parentEmail: document.getElementById('adParentEmail').value.trim(),
      guardian2Name: document.getElementById('adGuardian2Name').value.trim(),
      guardian2Phone: document.getElementById('adGuardian2Phone').value.trim(),
      address: document.getElementById('adAddress').value.trim(),
      emergencyContact: document.getElementById('adEmergency').value.trim(),
      medicalInfo: document.getElementById('adMedical').value,
      feeBalance: Number(document.getElementById('adFee').value || 0)
    };
    /* --- clear, field-level validation (mirrors the data-layer rules) --- */
    const problems = [];
    if (!data.firstName) problems.push('First name is required.');
    if (!data.lastName) problems.push('Last name is required.');
    if (!data.className) problems.push('Please select the class.');
    if (!data.admissionNo) problems.push('Admission number is required.');
    if (!data.academicYear) problems.push('Please select an academic year.');
    else if (typeof AcademicYears !== 'undefined') {
      const yErr = AcademicYears.validateForAdmission(data.academicYear);
      if (yErr) problems.push(yErr);
      const allowed = AcademicYears.termsFor(data.academicYear).map(String);
      if (!allowed.includes(String(data.term))) problems.push('Term ' + data.term + ' is not configured for academic year ' + data.academicYear + '. Allowed: ' + allowed.map(t => 'Term ' + t).join(', ') + '.');
    }
    if (problems.length) { problems.forEach(p => toast(p, 'error')); return; }

    const btn = form.querySelector('[type="submit"]');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Admitting…'; }
    const r = await Students.admit(data);
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-user-check"></i> Admit Student'; }
    if (!r.ok) {
      /* Keep everything already typed so nothing has to be re-entered. */
      toast(r.error, 'error');
      return;
    }
    // success
    toast('Student admitted successfully!');
    form.reset();
    _adPhotoData = '';
    const pv = document.getElementById('adPhotoPreview'); if (pv) pv.innerHTML = '';
    // repopulate defaults
    initSecretaryAdmitResetDefaults();
    loadSecretaryDashboard();
    renderStudentManagement();
    document.getElementById('admitResult').innerHTML = `
      <div style="background:var(--success-bg);color:var(--success);padding:14px 18px;border-radius:8px;font-weight:600;margin-top:16px">
        <i class="fas fa-circle-check"></i> ${esc(r.student.fullName)} admitted successfully.
        <br><small style="font-weight:400">Admission No: <strong>${esc(r.student.admissionNo)}</strong> · Class: <strong>${esc(r.student.className)}</strong> · Admission Date: <strong>${fmtDate(r.student.admissionDate)}</strong></small>
        <br><small style="font-weight:400">Student portal login: <strong>${esc(r.username)}</strong> — temporary password shown below</small>
        <br><button class="btn btn-xs btn-outline" style="margin-top:8px" onclick="viewStudentRecord('${r.student.id}')"><i class="fas fa-eye"></i> View Student Profile</button>
      </div>`;
    /* temporary passwords are generated, shown once, and never stored in plain text */
    if (typeof SettingsUI !== 'undefined') {
      if (r.tempPassword) SettingsUI._showTempPassword({ name: r.student.fullName, username: r.username, role: 'student' }, r.tempPassword);
    }
  });
}
function initSecretaryAdmitResetDefaults() {
  const st = DB.get('settings', {});
  const curYear = (typeof AcademicYears !== 'undefined') ? AcademicYears.activeYear() : (st.academicYear || String(new Date().getFullYear()));
  const curRec = (typeof AcademicYears !== 'undefined') ? AcademicYears.activeRecord() : null;
  fillAcademicYearSelect(
    document.getElementById('adAcademicYear'),
    document.getElementById('adTerm'),
    { current: curYear, selected: curYear, defaultTerm: curRec ? curRec.defaultTerm : (st.term || '1'), hintEl: document.getElementById('adYearHint') }
  );
  const ano = document.getElementById('adAdmissionNo'); if (ano) ano.value = Students.nextAdmissionNo(curYear);
  const dt = document.getElementById('adAdmissionDate'); if (dt) dt.value = today();
}
/* Admission number always follows the year currently chosen on the form. */
function generateAdmissionNo() {
  const sel = document.getElementById('adAcademicYear');
  const year = sel && sel.value ? sel.value : (typeof AcademicYears !== 'undefined' ? AcademicYears.activeYear() : DB.get('settings', {}).academicYear);
  const el = document.getElementById('adAdmissionNo');
  if (el) el.value = Students.nextAdmissionNo(year);
}
function resetAdmitForm() {
  setTimeout(() => {
    _adPhotoData = '';
    const pv = document.getElementById('adPhotoPreview'); if (pv) pv.innerHTML = '';
    initSecretaryAdmitResetDefaults();
  }, 0);
}

/* ---------- STUDENT MANAGEMENT TABLE ---------- */
function initSecretaryStudentManagement() {
  const clsSel = document.getElementById('stuFilterClass');
  if (clsSel && clsSel.options.length <= 1) {
    clsSel.innerHTML = '<option value="">All Classes</option>' + ACADEMIC_CLASSES.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  }
  const search = document.getElementById('stuSearch');
  const fClass = document.getElementById('stuFilterClass');
  const fStatus = document.getElementById('stuFilterStatus');
  const reset = () => { _stuManagePage = 1; renderStudentManagement(); };
  if (search && !search.dataset.bound) {
    search.dataset.bound = '1';
    search.addEventListener('input', reset);
    fClass.addEventListener('change', reset);
    fStatus.addEventListener('change', reset);
  }
  renderStudentManagement();
}

function filteredStudents() {
  const q = (document.getElementById('stuSearch')?.value || '').toLowerCase();
  const fc = document.getElementById('stuFilterClass')?.value || '';
  const fs = document.getElementById('stuFilterStatus')?.value || '';
  return Students.list().filter(st => {
    if (fc && st.className !== fc) return false;
    if (fs && st.status !== fs) return false;
    if (q) {
      const hay = ((st.firstName || '') + ' ' + (st.lastName || '') + ' ' + (st.admissionNo || '') + ' ' + (st.parentName || '') + ' ' + (st.parentPhone || '')).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function renderStudentManagement() {
  const tbody = document.getElementById('stuManageBody');
  if (!tbody) return;
  const all = filteredStudents();
  const totalPages = Math.max(1, Math.ceil(all.length / STU_PAGE_SIZE));
  if (_stuManagePage > totalPages) _stuManagePage = totalPages;
  const start = (_stuManagePage - 1) * STU_PAGE_SIZE;
  const page = all.slice(start, start + STU_PAGE_SIZE);
  const s = Auth.session();
  tbody.innerHTML = page.length ? page.map(st => `
    <tr>
      <td>${studentThumb(st)}</td>
      <td>${esc(st.admissionNo || '—')}</td>
      <td><strong>${esc(st.firstName)} ${esc(st.lastName)}</strong>${st.email ? '<br><small style="color:var(--text-light)">' + esc(st.email) + '</small>' : ''}</td>
      <td>${esc(st.className || '—')}</td>
      <td>${fmtDate(st.admissionDate)}</td>
      <td>${esc(st.parentName || '—')}${st.parentPhone ? '<br><small style="color:var(--text-light)">' + esc(st.parentPhone) + '</small>' : ''}</td>
      <td><span class="badge badge-${statusBadge(st.status)}">${esc(st.status || 'active')}</span></td>
      <td class="table-actions">
        <button class="btn btn-xs btn-outline" title="View" onclick="viewStudentRecord('${st.id}')"><i class="fas fa-eye"></i></button>
        <button class="btn btn-xs btn-outline" title="Replace Photo" onclick="openReplacePhoto('${st.id}')"><i class="fas fa-camera"></i></button>
        <button class="btn btn-xs btn-outline" title="Transfer Class" onclick="openTransferClass('${st.id}')"><i class="fas fa-right-left"></i></button>
        <button class="btn btn-xs btn-outline" title="Transfer Out" onclick="openTransferOut('${st.id}')"><i class="fas fa-plane-departure"></i></button>
        <button class="btn btn-xs btn-outline" title="History" onclick="openHistory('${st.id}')"><i class="fas fa-clock-rotate-left"></i></button>
        <button class="btn btn-xs btn-outline" title="Print Admission" onclick="openPrintAdmission('${st.id}')"><i class="fas fa-print"></i></button>
        <button class="btn btn-xs btn-warning" title="Archive" onclick="openArchive('${st.id}')"><i class="fas fa-box-archive"></i></button>
        ${Perm.canDeleteStudents() ? `<button class="btn btn-xs btn-danger" title="Delete" onclick="openDelete('${st.id}')"><i class="fas fa-trash"></i></button>` : ''}
      </td>
    </tr>`).join('') : `<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--text-light)">No students match the current filters</td></tr>`;
  const count = document.getElementById('stuManageCount');
  if (count) count.textContent = all.length ? `Showing ${start + 1}–${Math.min(start + STU_PAGE_SIZE, all.length)} of ${all.length} students` : 'No students';
  const pager = document.getElementById('stuManagePager');
  if (pager) {
    let html = '';
    if (_stuManagePage > 1) html += `<button class="btn btn-xs btn-outline" onclick="_stuManagePage--;renderStudentManagement()"><i class="fas fa-chevron-left"></i></button>`;
    html += `<span style="padding:4px 10px;font-size:0.8rem;color:var(--text-light)">Page ${_stuManagePage} / ${totalPages}</span>`;
    if (_stuManagePage < totalPages) html += `<button class="btn btn-xs btn-outline" onclick="_stuManagePage++;renderStudentManagement()"><i class="fas fa-chevron-right"></i></button>`;
    pager.innerHTML = html;
  }
}

/* ---------- VIEW / PRINT ---------- */
function viewStudentRecord(id) {
  const st = Students.get(id);
  if (!st) return;
  const payments = DB.get('payments').filter(p => p.studentId === id || p.studentName === (st.firstName + ' ' + st.lastName));
  const totalPaid = payments.reduce((a, b) => a + Number(b.amount || 0), 0);
  const photoUrl = Students.photoUrl(st);
  const rows = [
    ['Full Name', st.firstName + ' ' + st.lastName],
    ['Admission Number', st.admissionNo],
    ['Class', st.className],
    ['Student Category', st.category],
    ['Academic Year', st.academicYear],
    ['Term', st.term],
    ['Email', st.email],
    ['Gender', st.gender],
    ['Date of Birth', fmtDate(st.dob)],
    ['Admission Date', fmtDate(st.admissionDate)],
    ['Previous School', st.previousSchool],
    ['Parent/Guardian', st.parentName + (st.parentRelationship ? ' (' + st.parentRelationship + ')' : '')],
    ['Parent Phone', st.parentPhone],
    ['Alt Phone', st.parentAltPhone],
    ['Parent Email', st.parentEmail],
    ['Second Parent/Guardian', st.guardian2Name],
    ['Second Guardian Phone', st.guardian2Phone],
    ['Address', st.address],
    ['Emergency Contact', st.emergencyContact],
    ['Medical Info', st.medicalInfo],
    ['Status', st.status],
    ['Fee Balance', money(st.feeBalance || 0)],
    ['Remarks', st.remarks]
  ];
  document.getElementById('viewStudentBody').innerHTML = `
    <div style="display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap;margin-bottom:18px">
      <div style="text-align:center">
        ${photoUrl ? `<img src="${esc(photoUrl)}" style="width:110px;height:110px;border-radius:50%;object-fit:cover;border:3px solid var(--gold)">` : `<div style="width:110px;height:110px;border-radius:50%;background:linear-gradient(135deg,var(--navy),var(--navy-light));color:var(--gold);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:2rem;margin:0 auto">${initials(st.firstName + ' ' + st.lastName)}</div>`}
      </div>
      <div style="flex:1;min-width:240px">
        <table class="data-table"><tbody>${rows.map(r => `<tr><td style="font-weight:600;color:var(--navy);width:40%">${r[0]}</td><td>${esc(r[1] || '—')}</td></tr>`).join('')}</tbody></table>
      </div>
    </div>
    <h4 style="color:var(--navy);margin-bottom:10px">Payment History (Total paid: ${money(totalPaid)})</h4>
    ${payments.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Receipt</th><th>Item</th><th>Amount</th><th>Date</th></tr></thead><tbody>${payments.map(p => `<tr><td>${esc(p.receiptNo)}</td><td>${esc(p.item)}</td><td>${money(p.amount)}</td><td>${fmtDate(p.date)}</td></tr>`).join('')}</tbody></table></div>` : '<p style="color:var(--text-light)">No payments recorded for this student.</p>'}`;
  openModal('viewStudentModal');
}

function openPrintAdmission(id) {
  const st = Students.get(id);
  if (!st) return;
  const photoUrl = Students.photoUrl(st);
  const rows = [
    ['Full Name', st.firstName + ' ' + st.lastName],
    ['Admission Number', st.admissionNo],
    ['Class Admitted To', st.className],
    ['Academic Year', st.academicYear],
    ['Term', st.term],
    ['Admission Date', fmtDate(st.admissionDate)],
    ['Date of Birth', fmtDate(st.dob)],
    ['Gender', st.gender],
    ['Previous School', st.previousSchool || '—'],
    ['Parent/Guardian', st.parentName + (st.parentRelationship ? ' (' + st.parentRelationship + ')' : '')],
    ['Parent Phone', st.parentPhone],
    ['Address', st.address],
    ['Status', st.status]
  ];
  document.getElementById('printBody').innerHTML = `
    <div style="font-family:Georgia,serif;color:#111">
      <div style="text-align:center;border-bottom:3px double var(--navy);padding-bottom:12px;margin-bottom:16px">
        <h2 style="margin:0;color:var(--navy)">ST. TERESA ACADEMY</h2>
        <p style="margin:4px 0 0;color:#555">Official Admission Details</p>
      </div>
      <div style="display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap">
        ${photoUrl ? `<img src="${esc(photoUrl)}" style="width:100px;height:100px;border-radius:6px;object-fit:cover;border:2px solid #333">` : ''}
        <table style="flex:1;min-width:260px;border-collapse:collapse">
          <tbody>${rows.map(r => `<tr><td style="padding:6px 10px 6px 0;font-weight:700;border-bottom:1px solid #ddd;width:40%">${r[0]}</td><td style="padding:6px 0;border-bottom:1px solid #ddd">${esc(r[1] || '—')}</td></tr>`).join('')}</tbody>
        </table>
      </div>
      <div style="margin-top:40px;display:flex;gap:60px">
        <div style="flex:1;border-top:1px solid #333;padding-top:6px;text-align:center;font-size:0.85rem">Registrar Signature</div>
        <div style="flex:1;border-top:1px solid #333;padding-top:6px;text-align:center;font-size:0.85rem">Date</div>
      </div>
    </div>`;
  openModal('printModal');
}

/* ---------- REPLACE PHOTO ---------- */
function openReplacePhoto(id) {
  const st = Students.get(id);
  if (!st) return;
  _replacePhotoStudentId = id;
  _replacePhotoData = '';
  document.getElementById('replacePhotoName').textContent = st.firstName + ' ' + st.lastName + ' (' + (st.admissionNo || '') + ')';
  document.getElementById('replacePhotoFile').value = '';
  const cur = Students.photoUrl(st);
  document.getElementById('replacePhotoPreview').innerHTML = cur ? `<p style="font-size:0.82rem;color:var(--text-light);margin-bottom:4px">Current photo:</p><img src="${esc(cur)}" style="width:90px;height:90px;border-radius:50%;object-fit:cover;border:2px solid var(--gold)">` : '<p style="font-size:0.82rem;color:var(--text-light)">No photograph on record (placeholder will show in the portal).</p>';
  const input = document.getElementById('replacePhotoFile');
  input.onchange = async () => {
    const f = input.files[0];
    const err = validatePhotoFile(f);
    if (err) { toast(err, 'error'); input.value = ''; _replacePhotoData = ''; return; }
    try {
      _replacePhotoData = await compressPhotoFile(f);
      document.getElementById('replacePhotoPreview').innerHTML = `<p style="font-size:0.82rem;color:var(--text-light);margin-bottom:4px">New photo preview:</p><img src="${esc(_replacePhotoData)}" style="width:90px;height:90px;border-radius:50%;object-fit:cover;border:2px solid var(--gold)">`;
    } catch (e) {
      toast('Could not read that image.', 'error');
      input.value = ''; _replacePhotoData = '';
    }
  };
  openModal('replacePhotoModal');
}
async function saveReplacePhoto() {
  if (!_replacePhotoData) { toast('Choose a new photograph first.', 'error'); return; }
  const btn = document.querySelector('#replacePhotoModal [data-save]');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…'; }
  const r = await Students.replacePhoto(_replacePhotoStudentId, _replacePhotoData);
  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Save Photograph'; }
  if (!r.ok) { toast(r.error, 'error'); return; }
  toast('Photograph updated.');
  closeModal('replacePhotoModal');
  renderStudentManagement();
  loadSecretaryDashboard();
}

/* Remove the photograph and its stored bytes. The student keeps the record;
   only the image goes, so the placeholder portrait shows instead. */
async function removeStudentPhoto() {
  const id = _replacePhotoStudentId;
  const st = Students.get(id);
  if (!st) { toast('That student record could not be found.', 'error'); return; }
  const who = (st.firstName || '') + ' ' + (st.lastName || '');
  if (!confirm('Remove the photograph for ' + who + '?')) return;
  const r = await Students.removePhoto(id);
  if (!r.ok) { toast(r.error, 'error'); return; }
  toast('Photograph removed.');
  closeModal('replacePhotoModal');
  renderStudentManagement();
  loadSecretaryDashboard();
}

/* ---------- TRANSFER CLASS ---------- */
function openTransferClass(id) {
  const st = Students.get(id);
  if (!st) return;
  document.getElementById('trClassStudentId').value = id;
  const infoBox = document.getElementById('trClassInfo') || document.getElementById('transferClassInfo');
  if (infoBox) infoBox.textContent = st.firstName + ' ' + st.lastName + ' (' + (st.admissionNo || '') + ')';
  document.getElementById('trClassCurrent').value = st.className || '—';
  const dest = document.getElementById('trClassDest');
  dest.innerHTML = '<option value="">Select destination…</option>' + ACADEMIC_CLASSES.filter(c => c !== st.className).map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  document.getElementById('trClassDate').value = today();
  const st2 = DB.get('settings', {});
  document.getElementById('trClassYear').value = st2.academicYear || String(new Date().getFullYear());
  if (st2.term) document.getElementById('trClassTerm').value = st2.term;
  document.getElementById('trClassReason').value = '';
  document.getElementById('trClassRemarks').value = '';
  document.getElementById('transferClassForm').onsubmit = e => {
    e.preventDefault();
    if (!confirm('Transfer ' + st.firstName + ' ' + st.lastName + ' from ' + st.className + ' to ' + dest.value + '?')) return;
    const r = Students.transferClass(id, {
      toClass: dest.value,
      effectiveDate: document.getElementById('trClassDate').value,
      academicYear: document.getElementById('trClassYear').value,
      term: document.getElementById('trClassTerm').value,
      reason: document.getElementById('trClassReason').value.trim(),
      remarks: document.getElementById('trClassRemarks').value.trim()
    });
    if (!r.ok) { toast(r.error, 'error'); return; }
    toast('Transfer recorded: ' + r.fromClass + ' → ' + r.toClass);
    closeModal('transferClassModal');
    renderStudentManagement();
    loadSecretaryDashboard();
  };
  openModal('transferClassModal');
}

/* ---------- TRANSFER OUT ---------- */
function openTransferOut(id) {
  const st = Students.get(id);
  if (!st) return;
  document.getElementById('trOutStudentId').value = id;
  document.getElementById('transferOutName').textContent = st.firstName + ' ' + st.lastName + ' (' + (st.admissionNo || '') + ') — ' + st.className;
  document.getElementById('trOutDate').value = today();
  document.getElementById('trOutSchool').value = '';
  document.getElementById('trOutReason').value = '';
  document.getElementById('trOutRemarks').value = '';
  document.getElementById('transferOutForm').onsubmit = e => {
    e.preventDefault();
    if (!confirm('Transfer ' + st.firstName + ' ' + st.lastName + ' OUT of the school? This changes their status to Transferred Out.')) return;
    const r = Students.transferOut(id, {
      effectiveDate: document.getElementById('trOutDate').value,
      destinationSchool: document.getElementById('trOutSchool').value.trim(),
      reason: document.getElementById('trOutReason').value.trim(),
      remarks: document.getElementById('trOutRemarks').value.trim()
    });
    if (!r.ok) { toast(r.error, 'error'); return; }
    toast('Student transferred out. Historical records preserved.');
    closeModal('transferOutModal');
    renderStudentManagement();
    loadSecretaryDashboard();
  };
  openModal('transferOutModal');
}

/* ---------- ARCHIVE ---------- */
function openArchive(id) {
  const st = Students.get(id);
  if (!st) return;
  document.getElementById('archStudentId').value = id;
  document.getElementById('archiveInfo').textContent = 'Archiving: ' + st.firstName + ' ' + st.lastName + ' (' + (st.admissionNo || '') + ') — ' + st.className + ' — Status: ' + st.status;
  document.getElementById('archReason').value = '';
  document.getElementById('archiveForm').onsubmit = e => {
    e.preventDefault();
    const reason = document.getElementById('archReason').value.trim();
    if (!reason) { toast('A reason is required.', 'error'); return; }
    if (!confirm('Archive ' + st.firstName + ' ' + st.lastName + '? They will be hidden from active lists but records are preserved.')) return;
    const r = Students.archive(id, reason);
    if (!r.ok) { toast(r.error, 'error'); return; }
    toast('Student archived.');
    closeModal('archiveModal');
    renderStudentManagement();
    loadSecretaryDashboard();
  };
  openModal('archiveModal');
}

/* ---------- DELETE (admin only) ---------- */
function openDelete(id) {
  const st = Students.get(id);
  if (!st) return;
  if (!Perm.canDeleteStudents()) { toast('You do not have permission to delete students.', 'error'); return; }
  document.getElementById('delStudentId').value = id;
  document.getElementById('deleteInfo').textContent = 'Deleting: ' + st.firstName + ' ' + st.lastName + ' (' + (st.admissionNo || '') + ') — ' + st.className + ' — Status: ' + st.status;
  document.getElementById('delReason').value = '';
  document.getElementById('delConfirmName').value = '';
  document.getElementById('deleteForm').onsubmit = e => {
    e.preventDefault();
    const reason = document.getElementById('delReason').value.trim();
    const typed = document.getElementById('delConfirmName').value.trim();
    const r = Students.delete(id, reason, typed);
    if (!r.ok) { toast(r.error, 'error'); return; }
    toast('Student deleted. Related history preserved and logged.', 'info');
    closeModal('deleteModal');
    renderStudentManagement();
    loadSecretaryDashboard();
  };
  openModal('deleteModal');
}

/* ---------- HISTORY ---------- */
function openHistory(id) {
  const st = Students.get(id);
  if (!st) return;
  const hist = Students.history(id);
  const actionLabel = { admit: 'Admission', transfer_class: 'Class Transfer', transfer_out: 'Transfer Out', archive: 'Archived', withdraw: 'Withdrawn', delete: 'Deleted' };
  const rowsHtml = hist.length ? hist.map(h => {
    let detail = '';
    if (h.action === 'admit') detail = 'Admitted to ' + esc(h.className || '') + ' (' + esc(h.admissionNo || '') + ')';
    else if (h.action === 'transfer_class') detail = esc(h.fromClass || '') + ' → <strong>' + esc(h.toClass || '') + '</strong> (eff. ' + fmtDate(h.effectiveDate) + ')' + (h.reason ? ' · Reason: ' + esc(h.reason) : '');
    else if (h.action === 'transfer_out') detail = 'Left effective ' + fmtDate(h.effectiveDate) + (h.destinationSchool ? ' → ' + esc(h.destinationSchool) : '') + (h.reason ? ' · Reason: ' + esc(h.reason) : '');
    else detail = esc(h.reason || '');
    return `<tr><td>${fmtDate(h.at)}</td><td><span class="badge badge-navy">${actionLabel[h.action] || esc(h.action)}</span></td><td>${detail}</td><td>${esc(h.byName || '—')}<br><small style="color:var(--text-light)">${esc(h.role || '')}</small></td></tr>`;
  }).join('') : '';
  document.getElementById('historyBody').innerHTML = `
    <div style="margin-bottom:14px"><strong>${esc(st.firstName)} ${esc(st.lastName)}</strong> · ${esc(st.admissionNo || '')} · ${esc(st.className || '')}</div>
    <div class="table-wrap"><table class="data-table">
      <thead><tr><th>Date</th><th>Action</th><th>Details</th><th>By</th></tr></thead>
      <tbody>${rowsHtml || '<tr><td colspan="4" style="text-align:center;color:var(--text-light)">No history yet</td></tr>'}</tbody>
    </table></div>`;
  openModal('historyModal');
}

/* ---------- PAYMENTS ---------- */
function renderSecretaryPayments() {
  const tbody = document.getElementById('secPaymentsBody');
  if (!tbody) return;
  const can = Perm.canRecordPayments();
  const payments = DB.get('payments').filter(p => !p.deleted).reverse();
  tbody.innerHTML = payments.length ? payments.map(p => `
    <tr${p.reversed ? ' class="fee-item-off-row"' : ''}>
      <td><strong>${esc(p.receiptNo)}</strong>${p.reversed ? ' <span class="badge badge-warning">reversed</span>' : ''}</td>
      <td>${esc(p.studentName)}</td>
      <td>${esc(p.item)}<br><small style="color:var(--text-light)">${esc(termLabel(p.term))} ${esc(p.academicYear || '')}</small></td>
      <td><strong>${money(p.amount)}</strong></td>
      <td>${esc(p.method)}</td>
      <td>${fmtDate(p.paymentDate || p.date)}</td>
      <td>${fmtDate(Payments.systemDateOf(p))}<br><small style="color:var(--text-light)">${esc(Payments.verifyRef(p))}</small></td>
      <td>${esc(p.reference || '—')}</td>
      <td style="white-space:nowrap">
        ${typeof FeeProUI !== 'undefined' ? FeeProUI.receiptButtons(p.id, true) : ''}
        ${can ? `<button class="btn btn-xs btn-outline" title="Correct actual date" onclick="FeeProUI.openDateCorrection('${esc(p.id)}')"><i class="fas fa-calendar-pen"></i></button><button class="btn btn-xs btn-outline" onclick="FeeUI.openDelete('payment','${esc(p.id)}')"><i class="fas fa-trash"></i></button>` : ''}
      </td>
    </tr>`).join('') : `<tr><td colspan="9" style="text-align:center;padding:30px;color:var(--text-light)">No payments recorded</td></tr>`;
}

/* ============================================================
   FEE MANAGEMENT UI — FeeUI
   All three levels: school fee items, class fee structures and
   individual student charges. Every control here only *requests*
   a change; the data layer (Fees.* / Payments.*) is what actually
   refuses the action for anyone who is not the Secretary.
   ============================================================ */
const FeeUI = {
  _accountId: null,
  _posCart: [],
  _posLast: null,
  _adjustTarget: null,
  _payTarget: null,
  _payToken: null,

  /* ---------- shared lookups ---------- */
  classOptions(selected) {
    const set = [];
    const push = n => { if (n && !set.includes(n)) set.push(n); };
    (typeof ACADEMIC_CLASSES !== 'undefined' ? ACADEMIC_CLASSES : []).forEach(push);
    Classes.list().forEach(c => push(c.name));
    DB.get('students').forEach(s => push(s.className || s.grade));
    return set.map(c => `<option value="${esc(c)}"${String(c) === String(selected || '') ? ' selected' : ''}>${esc(c)}</option>`).join('');
  },
  yearOptions(selected) {
    const years = AcademicYears.forSelection();
    const list = years.length ? years : [{ label: AcademicYears.activeYear() }];
    let out = list.map(y => `<option value="${esc(y.label)}"${String(y.label) === String(selected || '') ? ' selected' : ''}>${esc(y.label)}</option>`).join('');
    const raw = String(selected || '');
    if (raw && !list.some(y => String(y.label) === raw)) {
      out = `<option value="${esc(raw)}" selected>${esc(raw)}</option>` + out;
    }
    return out;
  },
  /* Payments may be backdated into a completed year, so every CONFIGURED
     year is selectable here (unlike admission, which uses active years only). */
  paymentYearOptions(selected) {
    const all = AcademicYears.list().slice().sort((a, b) => String(b.label).localeCompare(String(a.label), undefined, { numeric: true }));
    const list = all.length ? all : [{ label: AcademicYears.activeYear() }];
    let out = list.map(y => `<option value="${esc(y.label)}"${String(y.label) === String(selected || '') ? ' selected' : ''}>${esc(y.label)}${y.status !== 'active' ? ' (closed)' : ''}</option>`).join('');
    const raw = String(selected || '');
    if (raw && !list.some(y => String(y.label) === raw)) out = `<option value="${esc(raw)}" selected>${esc(raw)}</option>` + out;
    return out;
  },

  /* =========================================================
     LEVEL 1 — SCHOOL FEE ITEMS
     ========================================================= */
  renderItems(tbodyId) {
    const tbody = document.getElementById(tbodyId || 'secFeeItemsBody');
    if (!tbody) return;
    const can = Perm.canManageFees();
    const items = Fees.items();
    tbody.innerHTML = items.length ? items.map(it => `
      <tr class="${it.active === false ? 'fee-item-off-row' : ''}">
        <td><strong>${esc(it.name)}</strong></td>
        <td>${money(it.price)}</td>
        <td><span class="badge badge-${it.active === false ? 'warning' : 'success'}">${it.active === false ? 'Inactive' : 'Active'}</span></td>
        <td>${esc(it.updatedAt ? fmtDate(it.updatedAt) : fmtDate(it.createdAt))}<br><small style="color:var(--text-light)">${esc(it.updatedBy || it.createdBy || '')}</small></td>
        <td style="white-space:nowrap">
          ${can ? `
            <button class="btn btn-xs btn-outline" onclick="FeeUI.editItem('${esc(it.id)}')"><i class="fas fa-pen"></i></button>
            <button class="btn btn-xs btn-outline" onclick="FeeUI.toggleItem('${esc(it.id)}')"><i class="fas fa-${it.active === false ? 'play' : 'pause'}"></i></button>
            <button class="btn btn-xs btn-danger" onclick="FeeUI.deleteItem('${esc(it.id)}')"><i class="fas fa-trash"></i></button>`
            : '<span style="color:var(--text-light);font-size:0.78rem">Read-only</span>'}
        </td>
      </tr>`).join('')
      : `<tr><td colspan="5" style="text-align:center;padding:26px;color:var(--text-light)">No fee items yet.</td></tr>`;
  },

  editItem(id) {
    if (!Perm.canManageFees()) { toast('Only the Secretary may manage fee items.', 'error'); return; }
    const it = id ? Fees.getItem(id) : null;
    document.getElementById('feeItemTitle').textContent = it ? 'Edit Fee Item' : 'Add Fee Item';
    document.getElementById('fiEditId').value = it ? it.id : '';
    document.getElementById('fiName').value = it ? it.name : '';
    document.getElementById('fiPrice').value = it ? it.price : '';
    openModal('feeItemModal');
  },
  toggleItem(id) {
    const it = Fees.getItem(id);
    if (!it) return;
    const r = Fees.setItemActive(id, it.active === false);
    toast(r.ok ? (it.name + (it.active === false ? ' activated.' : ' deactivated.')) : r.error, r.ok ? 'success' : 'error');
    if (r.ok) FeeUI.refreshAll();
  },
  deleteItem(id) {
    const it = Fees.getItem(id);
    if (!it) return;
    if (!confirm('Delete the fee item "' + it.name + '"? Class structures that already used it keep their own copy of the amount.')) return;
    const r = Fees.removeItem(id);
    toast(r.ok ? 'Fee item deleted.' : r.error, r.ok ? 'success' : 'error');
    if (r.ok) FeeUI.refreshAll();
  },
  bindItemForm() {
    const f = document.getElementById('feeItemForm');
    if (!f || f.dataset.bound) return;
    f.dataset.bound = '1';
    f.addEventListener('submit', e => {
      e.preventDefault();
      const editingId = document.getElementById('fiEditId').value || '';
      const r = Fees.saveItem({
        name: document.getElementById('fiName').value,
        price: document.getElementById('fiPrice').value
      }, editingId || undefined);
      toast(r.ok ? 'Fee item saved.' : r.error, r.ok ? 'success' : 'error');
      if (r.ok) { closeModal('feeItemModal'); FeeUI.refreshAll(); }
    });
  },

  /* =========================================================
     LEVEL 2 — CLASS FEE STRUCTURES
     ========================================================= */
  renderClassStructures(tbodyId) {
    const tbody = document.getElementById(tbodyId || 'secClassFeesBody');
    if (!tbody) return;
    const can = Perm.canManageFees();
    const list = Fees.classStructures();
    tbody.innerHTML = list.length ? list.map(s => `
      <tr class="${s.active === false ? 'fee-item-off-row' : ''}">
        <td><strong>${esc(s.className)}</strong></td>
        <td>${esc(s.academicYear)}</td>
        <td>${s.term ? 'Term ' + esc(s.term) : 'All terms'}</td>
        <td>${s.items.map(i => esc(i.name)).join(', ')}</td>
        <td>${money(s.total)}</td>
        <td><span class="badge badge-${s.active === false ? 'warning' : 'success'}">${s.active === false ? 'Inactive' : 'Active'}</span></td>
        <td style="white-space:nowrap">
          ${can ? `
            <button class="btn btn-xs btn-outline" onclick="FeeUI.billStructure('${esc(s.id)}')"><i class="fas fa-bolt"></i></button>
            <button class="btn btn-xs btn-outline" title="Bulk invoice for this class" onclick="FeeUI.printClassInvoices('${esc(s.id)}')"><i class="fas fa-file-invoice-dollar"></i></button>
            <button class="btn btn-xs btn-outline" onclick="FeeUI.editClassStructure('${esc(s.id)}')"><i class="fas fa-pen"></i></button>
            <button class="btn btn-xs btn-outline" onclick="FeeUI.toggleClassStructure('${esc(s.id)}')"><i class="fas fa-${s.active === false ? 'play' : 'pause'}"></i></button>
            <button class="btn btn-xs btn-danger" onclick="FeeUI.removeClassStructure('${esc(s.id)}')"><i class="fas fa-trash"></i></button>`
            : '<span style="color:var(--text-light);font-size:0.78rem">Read-only</span>'}
        </td>
      </tr>`).join('')
      : `<tr><td colspan="7" style="text-align:center;padding:26px;color:var(--text-light)">No class fee structures yet. Add one to bill a class for a given year and term.</td></tr>`;
  },

  editClassStructure(id) {
    if (!Perm.canManageFees()) { toast('Only the Secretary may manage class fee structures.', 'error'); return; }
    const s = id ? Fees.getClassStructure(id) : null;
    document.getElementById('classFeeTitle').textContent = s ? 'Edit Class Fee Structure' : 'Add Class Fee Structure';
    document.getElementById('cfEditId').value = s ? s.id : '';
    const cls = document.getElementById('cfClass');
    cls.innerHTML = '<option value="">Select class…</option>' + FeeUI.classOptions(s ? s.className : '');
    const yr = document.getElementById('cfYear');
    yr.innerHTML = FeeUI.yearOptions(s ? s.academicYear : AcademicYears.activeYear());
    document.getElementById('cfTerm').value = s ? String(s.term || '') : String(AcademicYears.activeTerm());
    const host = document.getElementById('cfLines');
    const lines = s ? s.items.slice() : [];
    const build = () => {
      host.innerHTML = Fees.items().map(it => {
        const line = lines.find(l => l.feeItemId === it.id || l.name === it.name) || null;
        const amt = line ? line.amount : '';
        return `<label class="cf-line" data-fee="${esc(it.id)}">
          <input type="checkbox" class="cf-on" ${line ? 'checked' : ''}>
          <span class="cf-name">${esc(it.name)}${it.active === false ? ' <small>(inactive)</small>' : ''}</span>
          <input type="number" class="cf-amt" min="0" step="0.01" value="${amt}" ${line ? '' : 'disabled'} placeholder="0.00">
        </label>`;
      }).join('') || '<p style="color:var(--text-light)">No fee items exist yet — add a fee item first.</p>';
    };
    build();
    host.onchange = e => {
      const row = e.target.closest('.cf-line');
      if (!row) return;
      if (e.target.classList.contains('cf-on')) {
        const amtInput = row.querySelector('.cf-amt');
        amtInput.disabled = !e.target.checked;
        if (e.target.checked && !amtInput.value) {
          const it = Fees.getItem(row.dataset.fee);
          amtInput.value = it ? it.price : '';
        }
      }
      let total = 0;
      host.querySelectorAll('.cf-line').forEach(r => {
        if (r.querySelector('.cf-on').checked) total += Number(r.querySelector('.cf-amt').value || 0);
      });
      document.getElementById('cfTotal').textContent = money(total);
    };
    host.oninput = e => { if (e.target.classList.contains('cf-amt')) host.onchange(e); };
    let t = 0;
    host.querySelectorAll('.cf-line').forEach(r => { if (r.querySelector('.cf-on').checked) t += Number(r.querySelector('.cf-amt').value || 0); });
    document.getElementById('cfTotal').textContent = money(t);
    openModal('classFeeModal');
  },
  toggleClassStructure(id) {
    const s = Fees.getClassStructure(id);
    if (!s) return;
    const r = Fees.setClassStructureActive(id, s.active === false);
    toast(r.ok ? (s.className + ' structure ' + (s.active === false ? 'activated' : 'deactivated') + '.') : r.error, r.ok ? 'success' : 'error');
    if (r.ok) FeeUI.refreshAll();
  },
  removeClassStructure(id) {
    const s = Fees.getClassStructure(id);
    if (!s) return;
    if (!confirm('Delete the fee structure for ' + s.className + ' (' + s.academicYear + ')? Charges already billed to students are untouched.')) return;
    const r = Fees.removeClassStructure(id);
    toast(r.ok ? 'Fee structure deleted.' : r.error, r.ok ? 'success' : 'error');
    if (r.ok) FeeUI.refreshAll();
  },
  bindClassForm() {
    const f = document.getElementById('classFeeForm');
    if (!f || f.dataset.bound) return;
    f.dataset.bound = '1';
    f.addEventListener('submit', e => {
      e.preventDefault();
      const items = [];
      document.querySelectorAll('#cfLines .cf-line').forEach(row => {
        if (!row.querySelector('.cf-on').checked) return;
        items.push({ feeItemId: row.dataset.fee, amount: Number(row.querySelector('.cf-amt').value || 0) });
      });
      const editingId = document.getElementById('cfEditId').value || '';
      const r = Fees.saveClassStructure({
        className: document.getElementById('cfClass').value,
        academicYear: document.getElementById('cfYear').value,
        term: document.getElementById('cfTerm').value,
        items
      }, editingId || undefined);
      toast(r.ok ? 'Class fee structure saved.' : r.error, r.ok ? 'success' : 'error');
      if (r.ok) { closeModal('classFeeModal'); FeeUI.refreshAll(); }
    });
  },

  /* =========================================================
     LEVEL 3 — INDIVIDUAL STUDENT FEES
     ========================================================= */
  renderStudentList(query) {
    const tbody = document.getElementById('secFeeStudentsBody');
    if (!tbody) return;
    const q = String(query || '').trim().toLowerCase();
    let list = DB.get('students').filter(s => s.status !== 'archived' && s.status !== 'withdrawn');
    if (q) list = list.filter(s =>
      String(s.fullName || (s.firstName + ' ' + s.lastName)).toLowerCase().includes(q) ||
      String(s.admissionNo || '').toLowerCase().includes(q) ||
      String(s.className || s.grade || '').toLowerCase().includes(q));
    list = list.slice(0, 100);
    const canPay = Perm.canRecordPayments();
    tbody.innerHTML = list.length ? list.map(s => {
      const total = Fees.chargeTotal(s.id);
      const paid = Payments.paymentTotal(s);
      const bal = Fees.balanceOf(s.id);
      const status = Payments.statusOf(s);
      return `
      <tr>
        <td>${studentThumb(s)}</td>
        <td>${esc(s.admissionNo || '-')}</td>
        <td>${esc(s.className || s.grade || '-')}</td>
        <td>${money(total)}</td>
        <td>${money(paid)}</td>
        <td><strong>${money(bal)}</strong></td>
        <td><span class="badge badge-${Payments.statusClass(s)}">${esc(status)}</span></td>
        <td style="white-space:nowrap">
          ${canPay ? `<button class="btn btn-xs btn-primary" onclick="FeeUI.openPayment('${esc(s.id)}')"><i class="fas fa-money-bill-wave"></i> Record Payment</button>` : ''}
          <button class="btn btn-xs btn-outline" onclick="FeeUI.openAccount('${esc(s.id)}')"><i class="fas fa-folder-open"></i> Open</button>
        </td>
      </tr>`;
    }).join('')
      : `<tr><td colspan="8" style="text-align:center;padding:26px;color:var(--text-light)">No students match that search.</td></tr>`;
  },

  openAccount(id) {
    const st = Students.get(id);
    if (!st) { toast('Student not found.', 'error'); return; }
    if (!Perm.canViewStudentFee(id)) { toast('You are not authorised to view this fee account.', 'error'); return; }
    FeeUI._accountId = id;
    const box = document.getElementById('secFeeAccount');
    if (!box) return;
    box.style.display = '';
    document.getElementById('secFeeAccountName').textContent = st.fullName;
    document.getElementById('secFeeAccountMeta').textContent =
      'Admission No: ' + (st.admissionNo || '-') + ' · Class: ' + (st.className || st.grade || '-') +
      ' · ' + (st.academicYear || '-') + ' · Term ' + (st.term || '-');
    const refresh = () => {
      document.getElementById('feeAcctCharges').textContent = money(Fees.chargeTotal(id));
      document.getElementById('feeAcctPaid').textContent = money(Payments.paymentTotal(st));
      document.getElementById('feeAcctBalance').textContent = money(Fees.balanceOf(id));

      const ch = Fees.chargesFor(id).slice().reverse();
      const canFee = Perm.canManageFees();
      document.getElementById('secFeeChargesBody').innerHTML = ch.length ? ch.map(c => `
        <tr>
          <td>${fmtDate(c.createdAt)}</td>
          <td>${esc(c.item)}</td>
          <td><span class="badge badge-navy">${esc(c.source)}</span></td>
          <td>${esc(termLabel(c.term || st.term || '1'))} ${esc(c.academicYear || st.academicYear || '')}</td>
          <td>${esc(c.reason || '-')}</td>
          <td>${esc(c.createdBy || '-')}</td>
          <td style="text-align:right"><strong>${money(c.amount)}</strong></td>
          <td style="white-space:nowrap">${canFee ? `<button class="btn btn-xs btn-outline" onclick="FeeUI.openDelete('charge','${esc(c.id)}')"><i class="fas fa-trash"></i> Delete</button>` : ''}</td>
        </tr>`).join('')
        : '<tr><td colspan="8" style="text-align:center;padding:22px;color:var(--text-light)">No charges yet.</td></tr>';

      const pay = Payments.forStudent(st).slice().reverse();
      const canPay2 = Perm.canRecordPayments();
      document.getElementById('secFeePaymentsBody').innerHTML = pay.length ? pay.map(p => `
        <tr${p.reversed ? ' class="fee-item-off-row"' : ''}>
          <td><strong>${esc(p.receiptNo)}</strong>${p.reversed ? ' <span class="badge badge-warning">reversed</span>' : ''}</td>
          <td>${fmtDate(p.paymentDate || p.date)}</td>
          <td>${fmtDate(Payments.systemDateOf(p))}<br><small style="color:var(--text-light)">${esc(Payments.verifyRef(p))}</small></td>
          <td>${esc(p.item)}${p.reference ? '<br><small style="color:var(--text-light)">Ref: ' + esc(p.reference) + '</small>' : ''}<br><small style="color:var(--text-light)">${esc(termLabel(p.term))} ${esc(p.academicYear || '')}</small></td>
          <td>${esc(p.method)}</td>
          <td>${esc(p.recordedByName || p.recordedBy || '-')}</td>
          <td style="text-align:right"><strong>${money(p.amount)}</strong></td>
          <td style="white-space:nowrap">
            ${typeof FeeProUI !== 'undefined' ? FeeProUI.receiptButtons(p.id, true) : `<button class="btn btn-xs btn-outline" onclick="FeeUI.printReceipt('${esc(p.id)}')"><i class="fas fa-print"></i></button>`}
            ${canPay2 ? `<button class="btn btn-xs btn-outline" title="Correct actual payment date" onclick="FeeProUI.openDateCorrection('${esc(p.id)}')"><i class="fas fa-calendar-pen"></i></button><button class="btn btn-xs btn-outline" onclick="FeeUI.openDelete('payment','${esc(p.id)}')"><i class="fas fa-trash"></i></button>` : ''}
          </td>
        </tr>`).join('')
        : '<tr><td colspan="8" style="text-align:center;padding:22px;color:var(--text-light)">No payments yet.</td></tr>';
      if (typeof FeeProUI !== 'undefined') FeeProUI.renderAccountExtras(id);
    };
    refresh();
    FeeUI._refreshAccount = refresh;
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  billStructure(structureId) {
    if (!Perm.canManageFees()) { toast('Only the Secretary may bill class fees.', 'error'); return; }
    let sid = structureId;
    if (!sid) {
      const st = FeeUI._accountId ? Students.get(FeeUI._accountId) : null;
      if (!st) { toast('Open a student account first.', 'error'); return; }
      const s = Fees.structureFor(st.className, st.academicYear, st.term);
      if (!s) { toast('No class fee structure matches this student’s class, year and term.', 'error'); return; }
      sid = s.id;
    }
    const r = Fees.billStructure(sid, FeeUI._accountId && !structureId ? [FeeUI._accountId] : undefined);
    if (!r.ok) { toast(r.error, 'error'); return; }
    toast('Billed ' + r.billed + ' student(s) at ' + money(r.total) + (r.skipped ? ' (' + r.skipped + ' already billed — no double charge)' : ''), 'success');
    if (FeeUI._accountId) FeeUI.openAccount(FeeUI._accountId);
    FeeUI.renderStudentList(document.getElementById('secFeeSearch').value);
  },

  openAdjust() {
    if (!Perm.canManageFees()) { toast('Only the Secretary may adjust fees.', 'error'); return; }
    const st = FeeUI._accountId ? Students.get(FeeUI._accountId) : null;
    if (!st) { toast('Open a student account first.', 'error'); return; }
    FeeUI._adjustTarget = st.id;
    document.getElementById('feeAdjStudent').textContent =
      st.fullName + ' · ' + (st.admissionNo || '-') + ' · balance ' + money(Fees.balanceOf(st.id));
    document.getElementById('feeAdjustForm').reset();
    const termEl = document.getElementById('faTerm');
    const terms = Fees.termsForYear(st.academicYear || AcademicYears.activeYear());
    const cur = String(st.term || AcademicYears.activeTerm() || terms[0] || '1');
    termEl.innerHTML = terms.map(t => `<option value="${esc(t)}">${esc(termLabel(t))}</option>`).join('');
    termEl.value = terms.includes(cur) ? cur : terms[0];
    openModal('feeAdjustModal');
  },
  bindAdjustForm() {
    const f = document.getElementById('feeAdjustForm');
    if (!f || f.dataset.bound) return;
    f.dataset.bound = '1';
    f.addEventListener('submit', e => {
      e.preventDefault();
      const r = Fees.adjust(FeeUI._adjustTarget, {
        amount: Number(document.getElementById('faAmount').value),
        term: document.getElementById('faTerm').value,
        item: document.getElementById('faItem').value,
        reason: document.getElementById('faReason').value
      });
      toast(r.ok ? 'Adjustment recorded. New balance: ' + money(r.balance) : r.error, r.ok ? 'success' : 'error');
      if (r.ok) { closeModal('feeAdjustModal'); FeeUI.openAccount(FeeUI._adjustTarget); FeeUI.renderStudentList(document.getElementById('secFeeSearch').value); }
    });
  },

  /* ---------- record a payment against one student ---------- */
  openPayment(id) {
    if (!Perm.canRecordPayments()) { toast('Only the Secretary may record payments.', 'error'); return; }
    const st = Students.get(id);
    if (!st) { toast('Student not found.', 'error'); return; }
    FeeUI._payTarget = st.id;
    /* one token per form session so a double-click cannot post twice */
    FeeUI._payToken = 'sp_' + DB.uid();
    const bal = Fees.balanceOf(st.id);
    const nameEl = document.getElementById('payStudentName');
    if (nameEl) nameEl.textContent = st.fullName + ' · ' + (st.admissionNo || '-') + ' · ' + (st.className || st.grade || '-');
    const balEl = document.getElementById('payStudentBalance');
    if (balEl) balEl.textContent = money(bal);
    const totalEl = document.getElementById('payStudentTotal');
    if (totalEl) totalEl.textContent = money(Fees.chargeTotal(st.id));
    const paidEl = document.getElementById('payStudentPaid');
    if (paidEl) paidEl.textContent = money(Payments.paymentTotal(st));
    const amtEl = document.getElementById('payAmount');
    if (amtEl) { amtEl.value = ''; amtEl.max = bal > 0 ? String(bal) : '0'; }
    const refEl = document.getElementById('payReference');
    if (refEl) refEl.value = '';
    const mEl = document.getElementById('payMethod');
    if (mEl) mEl.value = 'Cash';
    const info = document.getElementById('payFormInfo');
    if (info) info.innerHTML = bal <= 0
      ? '<i class="fas fa-circle-check"></i> This student has no outstanding balance — nothing to pay.'
      : '';
    /* actual payment date defaults to the school's current date */
    const dtEl = document.getElementById('payDate');
    if (dtEl) { dtEl.value = schoolToday(); dtEl.max = schoolToday(); }
    const sysEl = document.getElementById('paySystemDate');
    if (sysEl) sysEl.textContent = fmtDate(schoolNow().date) + ' · ' + schoolNow().time + ' (' + schoolTimeZone() + ')';
    const yearEl = document.getElementById('payYear');
    if (yearEl) yearEl.innerHTML = FeeUI.paymentYearOptions(st.academicYear || AcademicYears.activeYear());
    FeeUI.syncPaymentTerms(st.term);
    FeeUI.renderPaymentTermHint();
    openModal('paymentModal');
    if (amtEl) amtEl.focus();
  },
  syncPaymentTerms(selected) {
    const yearEl = document.getElementById('payYear');
    const termEl = document.getElementById('payTerm');
    if (!termEl) return;
    const terms = (typeof AcademicYears !== 'undefined') ? AcademicYears.termsFor(yearEl ? yearEl.value : '') : [1, 2, 3];
    const cur = selected != null ? String(selected) : termEl.value;
    termEl.innerHTML = terms.map(t => `<option value="${esc(String(t))}">${esc(termLabel(String(t)))}</option>`).join('');
    termEl.value = terms.map(String).includes(cur) ? cur : String(terms[0] || '1');
  },
  renderPaymentTermHint() {
    const box = document.getElementById('payTermHint');
    if (!box) return;
    const id = FeeUI._payTarget;
    const yearEl = document.getElementById('payYear');
    const termEl = document.getElementById('payTerm');
    if (!id || !yearEl || !termEl) return;
    const ts = Fees.termSummary(id, yearEl.value, termEl.value);
    box.innerHTML = ts.ok
      ? `${esc(termLabel(termEl.value))} ${esc(yearEl.value)} — charged <strong>${money(ts.charged)}</strong> · paid <strong>${money(ts.paid)}</strong> · term balance <strong>${money(ts.balance)}</strong> · total outstanding (all terms) <strong>${money(Fees.balanceOf(id))}</strong>`
      : '';
  },
  bindPaymentForm() {
    const f = document.getElementById('paymentForm');
    if (!f || f.dataset.bound) return;
    f.dataset.bound = '1';
    const yearEl = document.getElementById('payYear');
    const termEl = document.getElementById('payTerm');
    if (yearEl) yearEl.addEventListener('change', () => { FeeUI.syncPaymentTerms(); FeeUI.renderPaymentTermHint(); });
    if (termEl) termEl.addEventListener('change', FeeUI.renderPaymentTermHint);
    const amtEl = document.getElementById('payAmount');
    if (amtEl) amtEl.addEventListener('input', FeeUI.renderPaymentTermHint);
    f.addEventListener('submit', e => {
      e.preventDefault();
      if (!Perm.canRecordPayments()) { toast('Only the Secretary may record payments.', 'error'); return; }
      const id = FeeUI._payTarget;
      const st = id ? Students.get(id) : null;
      if (!st) { toast('Student not found.', 'error'); return; }
      const amount = Number(document.getElementById('payAmount').value);
      const method = document.getElementById('payMethod').value;
      const reference = document.getElementById('payReference').value;
      const paymentDate = (document.getElementById('payDate') || {}).value || schoolToday();
      const academicYear = (document.getElementById('payYear') || {}).value || st.academicYear;
      const term = (document.getElementById('payTerm') || {}).value || st.term;
      if (!isFinite(amount) || amount <= 0) { toast('Enter a payment amount greater than zero.', 'error'); return; }
      if (!paymentDate) { toast('Choose the actual date the money was paid.', 'error'); return; }
      if (paymentDate > schoolToday()) { toast('The actual payment date cannot be in the future.', 'error'); return; }
      const owed = Fees.balanceOf(id);
      if (amount > owed + 0.009) { toast('Amount is more than the outstanding balance of ' + money(owed < 0 ? 0 : owed) + '.', 'error'); return; }
      const r = Payments.record({
        studentId: id, amount, method, reference, paymentDate, academicYear, term,
        item: 'Fee payment', clientToken: FeeUI._payToken
      });
      if (!r.ok) { toast(r.error, 'error'); return; }
      /* the record is saved; now refresh everything on screen from the DB */
      toast('Payment saved. Receipt ' + r.payment.receiptNo + '. Remaining balance ' + money(r.balance) + ' (' + r.status + ').');
      FeeUI._payToken = null;
      closeModal('paymentModal');
      FeeUI.renderStudentList((document.getElementById('secFeeSearch') || {}).value || '');
      if (FeeUI._accountId === id) FeeUI.openAccount(id);
      if (typeof loadSecretaryDashboard === 'function') loadSecretaryDashboard();
      if (typeof renderSecretaryPayments === 'function') renderSecretaryPayments();
      if (typeof FeeProUI !== 'undefined') FeeProUI.afterPayment(r);
    });
  },
  /* print one saved payment's receipt */
  printReceipt(paymentId) {
    const p = Payments.get(paymentId);
    if (!p) { toast('Payment not found.', 'error'); return; }
    if (!Perm.canViewStudentFee(p.studentId)) { toast('You are not authorised to view this receipt.', 'error'); return; }
    Fees.printReceipt(paymentId);
  },
  downloadReceipt(paymentId) {
    if (typeof FeeProUI !== 'undefined') FeeProUI.downloadReceipt(paymentId);
  },

  /* ---------- soft delete a payment or a charge (Secretary only) ---------- */
  openDelete(kind, id) {
    if (kind === 'payment' && !Perm.canRecordPayments()) { toast('Only the Secretary may delete payments.', 'error'); return; }
    if (kind === 'charge' && !Perm.canManageFees()) { toast('Only the Secretary may delete fee charges.', 'error'); return; }
    let info = '';
    if (kind === 'payment') {
      const p = Payments.get(id);
      if (!p) { toast('Payment not found.', 'error'); return; }
      info = 'Payment <strong>' + esc(p.receiptNo) + '</strong> of <strong>' + money(p.amount) +
        '</strong> (' + esc(p.method) + ') for <strong>' + esc(p.studentName) + '</strong> on ' + fmtDate(p.paymentDate || p.date) + '.';
    } else {
      const c = Fees.charges().find(x => x.id === id);
      if (!c) { toast('Charge not found.', 'error'); return; }
      info = 'Charge <strong>"' + esc(c.item) + '"</strong> of <strong>' + money(c.amount) +
        '</strong> recorded ' + fmtDate(c.createdAt) + '.';
    }
    document.getElementById('feeDeleteKind').value = kind;
    document.getElementById('feeDeleteId').value = id;
    document.getElementById('feeDeleteInfo').innerHTML = info +
      '<br><small style="color:var(--text-light)">This is a soft delete: the record is kept for the audit trail and the student\'s balance is recalculated.</small>';
    document.getElementById('feeDeleteReason').value = '';
    openModal('feeDeleteModal');
  },
  bindDeleteForm() {
    const f = document.getElementById('feeDeleteForm');
    if (!f || f.dataset.bound) return;
    f.dataset.bound = '1';
    f.addEventListener('submit', e => {
      e.preventDefault();
      const kind = document.getElementById('feeDeleteKind').value;
      const id = document.getElementById('feeDeleteId').value;
      const reason = document.getElementById('feeDeleteReason').value;
      const r = kind === 'payment' ? Payments.softDelete(id, { reason }) : Fees.removeCharge(id, { reason });
      if (!r.ok) { toast(r.error, 'error'); return; }
      toast('Deleted. ' + (r.balance == null ? '' : 'Balance now ' + money(r.balance) + '.'));
      closeModal('feeDeleteModal');
      FeeUI.renderStudentList((document.getElementById('secFeeSearch') || {}).value || '');
      renderSecretaryPayments();
      FeeUI.posRender();
      if (FeeUI._accountId) FeeUI.openAccount(FeeUI._accountId);
      if (typeof loadSecretaryDashboard === 'function') loadSecretaryDashboard();
    });
  },

  /* ---------- invoices ---------- */
  printInvoice() {
    if (!FeeUI._accountId) { toast('Open a student account first.', 'error'); return; }
    Fees.printInvoice(FeeUI._accountId);
  },
  downloadInvoice() {
    if (!FeeUI._accountId) { toast('Open a student account first.', 'error'); return; }
    Fees.downloadInvoice(FeeUI._accountId);
  },
  printClassInvoices(structureId) {
    if (!Perm.canManageFees()) { toast('Only the Secretary may print class invoices.', 'error'); return; }
    Fees.printClassInvoices(structureId);
  },
  /* invoice for an account the viewer is allowed to see (student self / parent / staff) */
  printFor(id) {
    if (!Perm.canViewStudentFee(id)) { toast('You are not authorised to view this fee account.', 'error'); return; }
    Fees.printInvoice(id);
  },
  downloadFor(id) {
    if (!Perm.canViewStudentFee(id)) { toast('You are not authorised to view this fee account.', 'error'); return; }
    Fees.downloadInvoice(id);
  },

  /* =========================================================
     SECRETARY FEE COLLECTION POS
     ========================================================= */
  posRender() {
    const can = Perm.canRecordPayments();
    const grid = document.getElementById('secFeeProductGrid');
    if (grid) {
      const items = Fees.items();
      grid.innerHTML = items.length ? items.map(it => `
        <div class="fee-product${can && it.active !== false ? '' : ' fee-product-ro'}"${can && it.active !== false ? ` onclick="FeeUI.posAdd('${esc(it.id)}')"` : ''}>
          <i class="fas ${esc(it.icon || 'fa-money-bill-wave')}${it.active === false ? ' fee-item-off' : ''}"></i>
          <h4>${esc(it.name)}${it.active === false ? ' <small>(inactive)</small>' : ''}</h4>
          <div class="price">${money(it.price)}</div>
        </div>`).join('')
        : '<p style="color:var(--text-light)">No fee items configured yet.</p>';
    }
    const sel = document.getElementById('secPosStudent');
    if (sel && can) {
      const cur = sel.value;
      sel.innerHTML = '<option value="">Select student…</option>' + DB.get('students')
        .filter(s => s.status !== 'archived' && s.status !== 'withdrawn')
        .map(s => `<option value="${esc(s.id)}">${esc(s.fullName || (s.firstName + ' ' + s.lastName))} — ${esc(s.className || s.grade || '')}</option>`).join('');
      if (cur) sel.value = cur;
    }
    const tb = document.getElementById('secPosPaymentsBody');
    if (tb) {
      const payments = DB.get('payments').filter(p => !p.deleted).slice().reverse().slice(0, 12);
      tb.innerHTML = payments.length ? payments.map(p => `
        <tr${p.reversed ? ' class="fee-item-off-row"' : ''}>
          <td><strong>${esc(p.receiptNo)}</strong></td>
          <td>${esc(p.studentName)}</td>
          <td>${esc(p.item)}</td>
          <td><strong>${money(p.amount)}</strong></td>
          <td>${esc(p.method)}</td>
          <td>${fmtDate(p.paymentDate || p.date)}</td>
          <td style="white-space:nowrap">${typeof FeeProUI !== 'undefined' ? FeeProUI.receiptButtons(p.id, true) : ''}${can ? `<button class="btn btn-xs btn-outline" onclick="FeeUI.openDelete('payment','${esc(p.id)}')"><i class="fas fa-trash"></i></button>` : ''}</td>
        </tr>`).join('')
        : '<tr><td colspan="7" style="text-align:center;padding:26px;color:var(--text-light)">No payments recorded</td></tr>';
    }
    FeeUI.posReceipt();
  },
  posAdd(id) {
    if (!Perm.canRecordPayments()) { toast('Only the Secretary may build a payment.', 'error'); return; }
    const it = Fees.activeItems().find(x => x.id === id);
    if (!it) { toast('That fee item is not active.', 'error'); return; }
    FeeUI._posCart.push({ ...it });
    FeeUI.posReceipt();
    toast(it.name + ' added to receipt.', 'info');
  },
  posRemove(i) {
    FeeUI._posCart.splice(i, 1);
    FeeUI.posReceipt();
  },
  posReceipt() {
    const body = document.getElementById('secPosReceiptBody');
    if (!body) return;
    const cart = FeeUI._posCart;
    const total = cart.reduce((a, b) => a + b.price, 0);
    body.innerHTML = cart.length
      ? cart.map((it, i) => `<div class="r-line"><span>${esc(it.name)}</span><span style="display:flex;gap:8px;align-items:center">${money(it.price)}<button type="button" class="btn-icon btn-danger" style="width:22px;height:22px;font-size:0.65rem" onclick="FeeUI.posRemove(${i})"><i class="fas fa-xmark"></i></button></span></div>`).join('') +
        `<div class="r-total"><span>Total</span><span>${money(total)}</span></div>`
      : `<div class="empty-state" style="padding:30px 10px"><i class="fas fa-receipt" style="font-size:1.8rem"></i><h4 style="font-size:0.9rem">Cart is empty</h4><p style="font-size:0.78rem">Click a fee item to add it.</p></div>`;
  },
  posStudentInfo() {
    const box = document.getElementById('secPosStudentInfo');
    if (!box) return;
    const id = document.getElementById('secPosStudent').value;
    const st = id ? Students.get(id) : null;
    if (!st) { box.style.display = 'none'; box.innerHTML = ''; return; }
    box.style.display = '';
    const ts = Fees.termSummary(st.id, st.academicYear || AcademicYears.activeYear(), st.term || AcademicYears.activeTerm());
    box.innerHTML = `<strong>${esc(st.fullName)}</strong><br>${esc(st.admissionNo || '')} · ${esc(st.className || st.grade || '')}
      · Charges ${money(Fees.chargeTotal(st.id))} · Paid ${money(Payments.paymentTotal(st))}
      · Balance <strong>${money(Fees.balanceOf(st.id))}</strong><br>
      <small>${esc(termLabel(ts.term))} ${esc(ts.academicYear)}: charged ${money(ts.charged)} · paid ${money(ts.paid)} · term balance <strong>${money(ts.balance)}</strong></small>`;
    const dtEl = document.getElementById('secPosDate');
    if (dtEl) { if (!dtEl.value) dtEl.value = schoolToday(); dtEl.max = schoolToday(); }
    const sys = document.getElementById('secPosSystemDate');
    if (sys) sys.textContent = fmtDate(schoolNow().date) + ' · ' + schoolNow().time + ' (' + schoolTimeZone() + ')';
    const yEl = document.getElementById('secPosYear');
    if (yEl) yEl.innerHTML = FeeUI.paymentYearOptions(st.academicYear || AcademicYears.activeYear());
    const tEl = document.getElementById('secPosTerm');
    if (tEl) {
      const terms = AcademicYears.termsFor(yEl ? yEl.value : st.academicYear);
      tEl.innerHTML = terms.map(t => `<option value="${esc(String(t))}">${esc(termLabel(String(t)))}</option>`).join('');
      tEl.value = terms.map(String).includes(String(st.term)) ? String(st.term) : String(terms[0] || 1);
    }
    const refEl = document.getElementById('secPosReference');
    if (refEl && !refEl.value) refEl.value = '';
  },
  bindPos() {
    const form = document.getElementById('secPosForm');
    if (form && !form.dataset.bound) {
      form.dataset.bound = '1';
      form.addEventListener('submit', e => {
        e.preventDefault();
        const studentId = document.getElementById('secPosStudent').value;
        const method = document.getElementById('secPosMethod').value;
        const paymentDate = (document.getElementById('secPosDate') || {}).value || schoolToday();
        const academicYear = (document.getElementById('secPosYear') || {}).value;
        const term = (document.getElementById('secPosTerm') || {}).value;
        const reference = (document.getElementById('secPosReference') || {}).value || '';
        if (!studentId) { toast('Please select a student.', 'error'); return; }
        if (!FeeUI._posCart.length) { toast('Cart is empty. Add fee items first.', 'error'); return; }
        if (paymentDate > schoolToday()) { toast('The actual payment date cannot be in the future.', 'error'); return; }
        const total = FeeUI._posCart.reduce((a, b) => a + b.price, 0);
        const r = Payments.record({
          studentId, amount: total, method, paymentDate, academicYear, term, reference,
          item: FeeUI._posCart.length === 1 ? FeeUI._posCart[0].name : FeeUI._posCart.length + ' fee items',
          clientToken: 'pos_' + DB.uid()
        });
        if (!r.ok) { toast(r.error, 'error'); return; }
        FeeUI._posLast = { studentId, method, total, items: FeeUI._posCart.slice(), payment: r.payment, balance: r.balance };
        toast('Payment recorded! Receipt: ' + r.payment.receiptNo);
        FeeUI._posCart.length = 0;
        form.reset();
        FeeUI.posRender();
        FeeUI.posStudentInfo();
        if (typeof loadSecretaryDashboard === 'function') loadSecretaryDashboard();
        renderSecretaryPayments();
        FeeUI.refreshStudentFeeTables();
        if (typeof FeeProUI !== 'undefined') FeeProUI.afterPayment(r);
      });
    }
    const sel = document.getElementById('secPosStudent');
    if (sel && !sel.dataset.bound) {
      sel.dataset.bound = '1';
      sel.addEventListener('change', FeeUI.posStudentInfo);
    }
    const yEl = document.getElementById('secPosYear');
    if (yEl && !yEl.dataset.bound) {
      yEl.dataset.bound = '1';
      yEl.addEventListener('change', () => {
        const tEl = document.getElementById('secPosTerm');
        if (!tEl) return;
        const terms = (typeof AcademicYears !== 'undefined') ? AcademicYears.termsFor(yEl.value) : [1, 2, 3];
        const cur = tEl.value;
        tEl.innerHTML = terms.map(t => `<option value="${esc(String(t))}">${esc(termLabel(String(t)))}</option>`).join('');
        tEl.value = terms.map(String).includes(cur) ? cur : String(terms[0] || 1);
      });
    }
  },
  receiptHTML(rec) {
    if (!rec) return '';
    const id = typeof rec === 'string' ? rec : (rec.payment && rec.payment.id);
    return id ? Fees.receiptHTML(id) : '';
  },
  printLastReceipt() {
    if (!FeeUI._posLast) { toast('Record a payment first.', 'error'); return; }
    const id = FeeUI._posLast.payment && FeeUI._posLast.payment.id;
    if (!id) { toast('Receipt not available.', 'error'); return; }
    Fees.printReceipt(id);
  },
  async downloadLastReceipt() {
    const rec = FeeUI._posLast;
    if (!rec || !rec.payment || !rec.payment.id) { toast('Record a payment first.', 'error'); return; }
    const logo = await logoForPDF();
    const body = Fees.receiptPDF(rec.payment.id, { logo });
    if (!body) { toast('Receipt not available.', 'error'); return; }
    downloadPDFFile('Receipt-' + String(rec.payment.receiptNo || rec.payment.id).replace(/[^A-Za-z0-9-]/g, '') + '.pdf', body, 'application/pdf');
    Audit.log('payment.receipt.download', rec.payment.receiptNo + ' · ' + rec.payment.studentName);
  },

  /* ---------- read-only structures view for staff ---------- */
  renderAdminStructures() {
    const host = document.getElementById('admFeeStructures');
    if (!host) return;
    const can = Perm.canManageFees();
    host.innerHTML = `
      <div class="panel" style="margin-bottom:18px">
        <div class="panel-head"><h3><i class="fas fa-layer-group" style="color:var(--gold)"></i> Class Fee Structures</h3>
          ${can ? `<button class="btn btn-xs btn-primary" onclick="FeeUI.editClassStructure('')"><i class="fas fa-plus"></i> Add</button>` : '<small style="color:var(--text-light)">Read-only</small>'}
        </div>
        <div class="panel-body table-wrap">
          <table class="data-table">
            <thead><tr><th>Class</th><th>Academic Year</th><th>Term</th><th>Lines</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody id="secClassFeesBody"></tbody>
          </table>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h3><i class="fas fa-tags" style="color:var(--gold)"></i> School Fee Items</h3>
          ${can ? `<button class="btn btn-xs btn-primary" onclick="FeeUI.editItem('')"><i class="fas fa-plus"></i> Add</button>` : '<small style="color:var(--text-light)">Read-only</small>'}
        </div>
        <div class="panel-body table-wrap">
          <table class="data-table">
            <thead><tr><th>Fee Item</th><th>Amount</th><th>Status</th><th>Last Updated</th><th>Actions</th></tr></thead>
            <tbody id="secFeeItemsBody"></tbody>
          </table>
        </div>
      </div>`;
    FeeUI.bindItemForm();
    FeeUI.bindClassForm();
    FeeUI.renderClassStructures('secClassFeesBody');
    FeeUI.renderItems('secFeeItemsBody');
  },

  refreshStudentFeeTables() {
    const acc = document.getElementById('secFeeAccount');
    if (acc && FeeUI._accountId && acc.style.display !== 'none' && typeof FeeUI._refreshAccount === 'function') FeeUI._refreshAccount();
    const q = document.getElementById('secFeeSearch');
    if (q) FeeUI.renderStudentList(q.value);
  },

  refreshAll() {
    FeeUI.renderItems();
    FeeUI.renderClassStructures();
    FeeUI.refreshStudentFeeTables();
    FeeUI.posRender();
    const adm = document.getElementById('admFeeStructures');
    if (adm && adm.innerHTML.trim()) FeeUI.renderAdminStructures();
    if (typeof initPOS === 'function') initPOS();
  },

  init() {
    if (typeof Fees === 'undefined') return;
    FeeUI.bindItemForm();
    FeeUI.bindClassForm();
    FeeUI.bindAdjustForm();
    FeeUI.bindPaymentForm();
    FeeUI.bindDeleteForm();
    FeeUI.bindPos();

    const search = document.getElementById('secFeeSearch');
    if (search && !search.dataset.bound) {
      search.dataset.bound = '1';
      search.addEventListener('input', () => FeeUI.renderStudentList(search.value));
    }
    const rev = document.getElementById('reversePaymentForm');
    if (rev && !rev.dataset.bound) {
      rev.dataset.bound = '1';
      rev.addEventListener('submit', e => {
        e.preventDefault();
        const r = Payments.reverse(document.getElementById('revPaymentId').value, { reason: document.getElementById('revReason').value });
        toast(r.ok ? 'Payment reversed. Balance now ' + money(r.balance) : r.error, r.ok ? 'success' : 'error');
        if (r.ok) { closeModal('reversePaymentModal'); FeeUI.refreshAll(); renderSecretaryPayments(); }
      });
    }

    FeeUI.renderItems();
    FeeUI.renderClassStructures();
    FeeUI.renderStudentList('');
    FeeUI.posRender();
    const adm = document.getElementById('admFeeStructures');
    if (adm) FeeUI.renderAdminStructures();
  }
};
