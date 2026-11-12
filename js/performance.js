/* ============================================================
   ST. TERESA ACADEMY — ATTENDANCE OVERVIEW & CLASS PERFORMANCE
   Professional class/school attendance monitoring and class
   performance tracking with automatic teacher feedback.

   Loaded AFTER modules.js (uses Attendance, Classes, Students,
   ExamMarking, Perm, DB, Auth, toast, esc, today, printHTML).

   Design rules (mirrors timetable.js):
   • Permission is enforced in the DATA LAYER first, then the UI.
   • No sample/hardcoded numbers — every figure is computed from
     real stored records.
   • Only FINALIZED (published) examination results count.
   • Adding this file never mutates or removes existing features.
   ============================================================ */

/* ============================================================
   1. AUTOMATIC FEEDBACK MESSAGES
   These are the fixed, verbatim strings used for automatic
   class-performance feedback. They are intentionally
   constructive and never humiliating. Adjust the wording here
   and the whole system follows.
   ============================================================ */
const PERF_MESSAGES = {
  below: "Your class performance is below the expected target or has declined compared with the previous examination. Please pull up your socks, identify areas where learners are struggling, and work together to improve results in the next assessment.",
  good: "Congratulations! Your class performance is improving or has met the school's expected target. Keep up the excellent work, continue supporting your learners, and maintain this positive progress.",
  stable: "Your class performance remains stable compared with the previous examination. Continue supporting your learners, identify areas for improvement, and work towards achieving even better results in the next assessment.",
  none: 'No feedback',
  noData: 'No finalized examination results are available for this class yet. Automatic feedback will appear once examination results are published.'
};

/* Default school targets. The administrator may change these. */
const PERF_TARGET_DEFAULTS = { passMark: 50, targetAverage: 60, improvementThreshold: 5, declineThreshold: 5 };

/* ============================================================
   2. PERMISSIONS (data-layer checks = "server-side")
   ============================================================ */
Object.assign(Perm, {
  /* Only the top administrator may change school performance targets. */
  canManagePerformanceTargets() { return this.isSuper(); },
  /* Staff (admin, headteacher, director, teacher, secretary) plus the
     chief examiner may view performance analytics. */
  canViewPerformance() {
    const s = Auth.session();
    return !!s && (this.isStaff() || s.role === 'chiefexaminer');
  },
  /* School-wide attendance summaries: administrators + secretary. */
  canViewSchoolAttendance() {
    const s = Auth.session();
    return !!s && (this.isAdmin() || s.role === 'secretary');
  },
  /* A teacher may view/mark attendance only for their own class or a
     class where they teach their subject. */
  canViewClassAttendance(classId) {
    const s = Auth.session();
    if (!s) return false;
    if (this.isAdmin() || s.role === 'secretary') return true;
    if (s.role !== 'teacher') return false;
    const c = Classes.get(classId);
    if (!c) return false;
    if (c.teacherId === s.id) return true;
    return Array.isArray(c.subjects) && c.subjects.includes(s.subject || '');
  }
});

/* ============================================================
   3. ATTENDANCE — reporting helpers (additive only)
   ============================================================ */
Object.assign(Attendance, {
  /* Aggregate for one class on one date (enrolled total included). */
  dayStats(classId, date) {
    const cls = Classes.get(classId);
    const total = cls ? Classes.enrolledCount(classId) : 0;
    const recs = this.list().filter(a => a.classId === classId && a.date === date);
    const present = recs.filter(a => a.status === 'present').length;
    const absent = recs.filter(a => a.status === 'absent').length;
    const late = recs.filter(a => a.status === 'late').length;
    const excused = recs.filter(a => a.status === 'excused').length;
    const required = present + late + absent;
    const pct = required ? Math.round(((present + late) / required) * 100) : null;
    return { classId, date, className: cls ? cls.name : '', teacherName: cls ? (cls.teacherName || '') : '', total, marked: recs.length, present, absent, late, excused, pct };
  },
  /* Aggregate over an inclusive date range. */
  rangeStats(classId, from, to) {
    const cls = Classes.get(classId);
    const total = cls ? Classes.enrolledCount(classId) : 0;
    const recs = this.list().filter(a => a.classId === classId && a.date >= from && a.date <= to);
    const present = recs.filter(a => a.status === 'present').length;
    const absent = recs.filter(a => a.status === 'absent').length;
    const late = recs.filter(a => a.status === 'late').length;
    const excused = recs.filter(a => a.status === 'excused').length;
    const required = present + late + absent;
    const pct = required ? Math.round(((present + late) / required) * 100) : null;
    return { classId, from, to, className: cls ? cls.name : '', teacherName: cls ? (cls.teacherName || '') : '', total, marked: recs.length, present, absent, late, excused, pct };
  },
  /* Per-date series for a class across a range (dates with records only). */
  seriesForClass(classId, from, to) {
    const dates = [...new Set(this.list().filter(a => a.classId === classId && a.date >= from && a.date <= to).map(a => a.date))].sort();
    return dates.map(d => this.dayStats(classId, d));
  },
  /* Students flagged absent or late within a range (optionally one class). */
  absenteeList(from, to, classId) {
    return this.list()
      .filter(a => (a.status === 'absent' || a.status === 'late') && a.date >= from && a.date <= to && (!classId || a.classId === classId))
      .sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : 0));
  },
  /* School-wide per-class daily snapshot. */
  schoolOverview(date) {
    return Classes.list().map(c => this.dayStats(c.id, date));
  },
  /* A packaged report for a class over daily / weekly / monthly scope. */
  reportForClass(classId, mode, refDate) {
    const date = refDate || today();
    const from = mode === 'weekly' ? addDaysISO(date, -6) : mode === 'monthly' ? date.slice(0, 7) + '-01' : date;
    const to = date;
    const totals = this.rangeStats(classId, from, to);
    const series = this.seriesForClass(classId, from, to);
    const absentees = this.absenteeList(from, to, classId);
    return { mode: mode || 'daily', from, to, totals, series, absentees };
  }
});

/* small local date helpers (do not clash with anything global) */
function addDaysISO(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d)) return dateStr;
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function attRangeBounds(mode, refDate) {
  const date = refDate || today();
  const from = mode === 'weekly' ? addDaysISO(date, -6) : mode === 'monthly' ? date.slice(0, 7) + '-01' : date;
  return { from, to: date };
}

/* ============================================================
   4. PERFORMANCE TARGETS (school policy settings)
   ============================================================ */
const PerformanceTargets = {
  get() {
    const cfg = (DB.get('settings', {}) || {}).performanceTargets || {};
    return Object.assign({}, PERF_TARGET_DEFAULTS, cfg);
  },
  save(patch) {
    if (!Perm.canManagePerformanceTargets()) return { ok: false, error: 'Only the administrator can change performance targets.' };
    const next = Object.assign({}, this.get(), patch || {});
    const num = v => Math.max(0, Math.min(100, Number(v)));
    next.passMark = num(next.passMark);
    next.targetAverage = num(next.targetAverage);
    next.improvementThreshold = num(next.improvementThreshold);
    next.declineThreshold = num(next.declineThreshold);
    if ([next.passMark, next.targetAverage, next.improvementThreshold, next.declineThreshold].some(v => isNaN(v))) {
      return { ok: false, error: 'All targets must be valid numbers.' };
    }
    const settings = DB.get('settings', {});
    settings.performanceTargets = next;
    DB.set('settings', settings);
    if (typeof Audit !== 'undefined') Audit.log('performance.targets', 'passMark=' + next.passMark + ' targetAverage=' + next.targetAverage + ' improve=' + next.improvementThreshold + ' decline=' + next.declineThreshold);
    return { ok: true, targets: next };
  }
};

/* ============================================================
   5. CLASS PERFORMANCE (finalized exams only)
   ============================================================ */
const ClassPerformance = {
  targets() { return PerformanceTargets.get(); },
  _published(r) {
    if (typeof ExamMarking !== 'undefined' && ExamMarking.isPublished(r)) return true;
    const ex = DB.get('exams').find(x => x.id === r.examId);
    return !!(ex && ex.resultsPublished);
  },
  _exam(r) { return DB.get('exams').find(x => x.id === r.examId) || {}; },
  _className(r) {
    if (r.className) return r.className;
    const ex = this._exam(r);
    if (ex.className) return ex.className;
    const stu = DB.get('students').find(s => s.id === r.studentId);
    return stu ? stu.className : '';
  },
  _year(r) {
    const ex = this._exam(r);
    const d = ex.date || r.submittedAt || r.date || '';
    const m = String(d).slice(0, 4);
    return /^\d{4}$/.test(m) ? m : '';
  },
  /* All published results matching an optional filter. */
  finalized(filter) {
    if (!Perm.canViewPerformance()) return [];
    filter = filter || {};
    const self = this;
    return DB.get('examResults').filter(r => {
      if (r.percent == null || r.percent === '') return false;
      if (!self._published(r)) return false;
      if (filter.className && self._className(r) !== filter.className) return false;
      if (filter.subject && (r.subject || '') !== filter.subject) return false;
      if (filter.examId && r.examId !== filter.examId) return false;
      if (filter.academicYear && self._year(r) !== String(filter.academicYear)) return false;
      return true;
    });
  },
  _stats(results) {
    const t = this.targets();
    if (!results.length) return { count: 0, average: null, passRate: null, passed: 0, failed: 0 };
    const sum = results.reduce((a, r) => a + Number(r.percent || 0), 0);
    const passed = results.filter(r => Number(r.percent || 0) >= t.passMark).length;
    const failed = results.length - passed;
    return {
      count: results.length,
      average: Math.round((sum / results.length) * 10) / 10,
      passed, failed,
      passRate: Math.round((passed / results.length) * 100)
    };
  },
  /* Every finalized assessment grouped by exam, oldest → newest. */
  examList(filter) {
    const results = this.finalized(filter);
    const groups = {};
    const self = this;
    results.forEach(r => {
      const key = r.examId || ('__' + (r.examTitle || r.subject || 'exam'));
      if (!groups[key]) {
        const ex = self._exam(r);
        groups[key] = {
          examId: r.examId, title: r.examTitle || ex.title || 'Examination',
          subject: r.subject || ex.subject || '', className: self._className(r),
          date: ex.date || String(r.submittedAt || r.date || '').slice(0, 10), results: []
        };
      }
      groups[key].results.push(r);
    });
    return Object.values(groups)
      .map(g => Object.assign(g, this._stats(g.results)))
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  },
  _trend(delta) {
    const t = this.targets();
    if (delta == null) return 'stable';
    if (delta >= t.improvementThreshold) return 'improving';
    if (delta <= -t.declineThreshold) return 'declining';
    return 'stable';
  },
  collectionSummary(results) {
    const st = this._stats(results);
    if (!results.length) return Object.assign(st, { trend: 'stable', delta: null, latestExam: null, previousExam: null, subjects: [] });
    const exams = this.examList({});
    const latest = exams[exams.length - 1] || null;
    const prev = exams[exams.length - 2] || null;
    const delta = (latest && prev) ? Math.round((latest.average - prev.average) * 10) / 10 : null;
    return Object.assign(st, { trend: this._trend(delta), delta, latestExam: latest, previousExam: prev });
  },
  classSummary(className, extra) {
    const filter = Object.assign({ className }, extra || {});
    const results = this.finalized(filter);
    const base = this._stats(results);
    const exams = this.examList(filter);
    const latest = exams[exams.length - 1] || null;
    const prev = exams[exams.length - 2] || null;
    const delta = (latest && prev) ? Math.round((latest.average - prev.average) * 10) / 10 : null;
    const subjectsMap = {};
    results.forEach(r => { const sub = r.subject || 'Unspecified'; (subjectsMap[sub] = subjectsMap[sub] || []).push(r); });
    const subjects = Object.keys(subjectsMap).map(sub => {
      const list = subjectsMap[sub];
      const exs = this.examList(Object.assign({}, filter, { subject: sub }));
      const exLatest = exs[exs.length - 1] || null;
      const exPrev = exs[exs.length - 2] || null;
      const st = this._stats(list);
      const d = (exLatest && exPrev) ? Math.round((exLatest.average - exPrev.average) * 10) / 10 : null;
      return {
        subject: sub, average: st.average, passRate: st.passRate, passed: st.passed, failed: st.failed, count: st.count,
        latestExam: exLatest ? exLatest.title : '', latestDate: exLatest ? exLatest.date : '',
        previousAverage: exPrev ? exPrev.average : null, delta: d, trend: this._trend(d)
      };
    }).sort((a, b) => (b.average || 0) - (a.average || 0));
    const cls = Classes.byName(className);
    return {
      className, teacherName: cls ? (cls.teacherName || '') : '',
      students: cls ? Classes.enrolledCount(cls.id) : 0,
      average: base.average, passRate: base.passRate, passed: base.passed, failed: base.failed, count: base.count,
      exams: exams.length, subjects,
      latestExam: latest, previousExam: prev,
      currentAverage: latest ? latest.average : null,
      previousAverage: prev ? prev.average : null,
      delta, trend: this._trend(delta)
    };
  },
  schoolSummaries(filter) {
    filter = filter || {};
    let classes = Classes.list();
    if (filter.className) classes = classes.filter(c => c.name === filter.className);
    const extra = {};
    if (filter.subject) extra.subject = filter.subject;
    if (filter.academicYear) extra.academicYear = filter.academicYear;
    return classes
      .map(c => this.classSummary(c.name, extra))
      .filter(s => s.count > 0 || filter.className);
  },
  /* Automatic feedback chosen from class performance vs school targets. */
  feedback(summary) {
    if (!summary || summary.average == null) return { level: 'none', message: PERF_MESSAGES.noData, average: null, delta: null, trend: 'stable' };
    const t = this.targets();
    const avg = summary.average;
    const delta = summary.delta;
    const meets = avg >= t.targetAverage;
    const improving = delta != null && delta >= t.improvementThreshold;
    const declining = delta != null && delta <= -t.declineThreshold;
    let level;
    if (declining || (!meets && !improving)) level = 'below';
    else if (improving) level = 'good';
    else level = 'stable';
    return { level, message: PERF_MESSAGES[level] || PERF_MESSAGES.stable, average: avg, delta, trend: summary.trend };
  },
  /* Labels used by filters/exports. */
  years() {
    if (!Perm.canViewPerformance()) return [];
    return [...new Set(DB.get('examResults').filter(r => this._published(r)).map(r => this._year(r)).filter(Boolean))].sort().reverse();
  },
  subjects() {
    if (!Perm.canViewPerformance()) return [];
    return [...new Set(DB.get('examResults').filter(r => this._published(r)).map(r => r.subject).filter(Boolean))].sort();
  }
};

/* ============================================================
   6. SHARED UI HELPERS
   ============================================================ */
function _val(id) { const el = document.getElementById(id); return el ? el.value : ''; }
function _setHTML(id, html) { const el = document.getElementById(id); if (el) el.innerHTML = html; }
function _fillSelect(id, values, placeholder, keep) {
  const el = document.getElementById(id);
  if (!el) return;
  const cur = keep === false ? '' : el.value;
  el.innerHTML = `<option value="">${esc(placeholder)}</option>` + values.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
  if (cur && values.includes(cur)) el.value = cur;
}
function perfStatCard(num, label, color, icon) {
  return `<div class="stat-card"><div class="s-icon ${color}"><i class="fas ${icon}"></i></div>
    <div class="s-info"><div class="s-num">${num}</div><div class="s-label">${esc(label)}</div></div></div>`;
}
function trendBadge(trend) {
  const map = {
    improving: ['success', 'fa-arrow-trend-up', 'Improving'],
    declining: ['danger', 'fa-arrow-trend-down', 'Declining'],
    stable: ['navy', 'fa-minus', 'Stable']
  };
  const m = map[trend] || map.stable;
  return `<span class="badge badge-${m[0]}"><i class="fas ${m[1]}"></i> ${m[2]}</span>`;
}
function feedbackBadge(level) {
  const map = {
    below: ['danger', 'Needs Support'],
    good: ['success', 'Good Progress'],
    stable: ['navy', 'Stable'],
    none: ['warning', 'No Data']
  };
  const m = map[level] || map.none;
  return `<span class="badge badge-${m[0]}">${m[1]}</span>`;
}
function deltaText(delta) {
  if (delta == null) return '<span style="color:var(--text-light)">—</span>';
  const sign = delta > 0 ? '+' : '';
  const color = delta > 0 ? 'var(--success, #1a7f4b)' : delta < 0 ? 'var(--danger, #c0392b)' : 'var(--text-light)';
  return `<strong style="color:${color}">${sign}${delta}</strong>`;
}

/* ============================================================
   7. MANAGEMENT: ATTENDANCE OVERVIEW
   ============================================================ */
function renderAttendanceOverview() {
  const tbody = document.getElementById('attOvBody');
  if (!tbody) return;
  const summary = document.getElementById('attOvSummary');
  const absBox = document.getElementById('attOvAbsentees');
  const note = document.getElementById('attOvAbsentNote');

  if (!Perm.canViewSchoolAttendance()) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:26px;color:var(--text-light)">You are not authorized to view school-wide attendance.</td></tr>';
    if (summary) summary.innerHTML = '';
    if (absBox) absBox.innerHTML = '';
    return;
  }

  // populate filters
  const dateEl = document.getElementById('attOvDate');
  if (dateEl && !dateEl.value) dateEl.value = today();
  _fillSelect('attOvClass', Classes.list().map(c => c.name), 'All classes');

  const date = _val('attOvDate') || today();
  const mode = _val('attOvRange') || 'daily';
  const classFilter = _val('attOvClass');
  const bounds = attRangeBounds(mode, date);
  const scope = classFilter ? [Classes.byName(classFilter)].filter(Boolean) : Classes.list();
  const rows = scope.map(c => Attendance.rangeStats(c.id, bounds.from, bounds.to)).filter(r => r.total > 0);

  const totals = rows.reduce((a, r) => ({
    total: a.total + r.total, present: a.present + r.present, absent: a.absent + r.absent,
    late: a.late + r.late, excused: a.excused + r.excused
  }), { total: 0, present: 0, absent: 0, late: 0, excused: 0 });
  const required = totals.present + totals.late + totals.absent;
  const overallPct = required ? Math.round(((totals.present + totals.late) / required) * 100) : null;

  if (summary) {
    summary.innerHTML =
      perfStatCard(totals.present, 'Present', 'green', 'fa-user-check') +
      perfStatCard(totals.absent, 'Absent', 'red', 'fa-user-xmark') +
      perfStatCard(totals.late, 'Late', 'gold', 'fa-clock') +
      perfStatCard(totals.excused, 'Excused', 'blue', 'fa-notes-medical') +
      perfStatCard(overallPct == null ? '—' : overallPct + '%', 'Attendance Rate', 'navy', 'fa-percent');
  }

  const periodLabel = mode === 'daily' ? 'on ' + date : 'from ' + bounds.from + ' to ' + bounds.to;
  tbody.innerHTML = rows.length ? rows.map(r => `
    <tr>
      <td><strong>${esc(r.className)}</strong></td>
      <td>${esc(r.teacherName || '—')}</td>
      <td>${r.total}${r.marked === 0 ? ' <span class="badge badge-warning">Not marked</span>' : ''}</td>
      <td>${r.present}</td>
      <td>${r.absent ? `<span class="perf-absent">${r.absent}</span>` : '0'}</td>
      <td>${r.late}</td>
      <td>${r.excused}</td>
      <td>${r.pct == null ? '<span style="color:var(--text-light)">—</span>' : `<strong>${r.pct}%</strong>`}</td>
    </tr>`).join('') :
    `<tr><td colspan="8" style="text-align:center;padding:26px;color:var(--text-light)">No classes found.</td></tr>`;

  if (note) note.textContent = periodLabel;
  if (absBox) {
    const absentees = Attendance.absenteeList(bounds.from, bounds.to, classFilter ? (Classes.byName(classFilter) || {}).id : '');
    absBox.innerHTML = absentees.length ? `
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Date</th><th>Student</th><th>Adm. No</th><th>Class</th><th>Status</th><th>Marked By</th></tr></thead>
        <tbody>${absentees.map(a => `
          <tr>
            <td>${esc(a.date)}</td>
            <td><strong>${esc(a.studentName)}</strong></td>
            <td>${esc(a.admissionNo || '—')}</td>
            <td>${esc(a.className || '—')}</td>
            <td>${a.status === 'absent' ? '<span class="badge badge-danger">Absent</span>' : '<span class="badge badge-gold">Late</span>'}</td>
            <td>${esc(a.markedBy || '—')}</td>
          </tr>`).join('')}</tbody></table></div>` :
      '<p style="color:var(--text-light)">No absences or late arrivals recorded for this period.</p>';
  }
  window._attOverview = { mode, date, rows, totals, overallPct };
}

function printAttendanceOverview() {
  const data = window._attOverview;
  if (!data) { renderAttendanceOverview(); return printAttendanceOverview(); }
  if (!Perm.canViewSchoolAttendance()) { toast('Not authorized.', 'error'); return; }
  const body = `<h2>Attendance Summary — ${esc(data.mode)}${data.mode === 'daily' ? ' (' + esc(data.date) + ')' : ''}</h2>
    <table><thead><tr><th>Class</th><th>Class Teacher</th><th>Enrolled</th><th>Present</th><th>Absent</th><th>Late</th><th>Excused</th><th>Attendance %</th></tr></thead>
    <tbody>${data.rows.map(r => `<tr><td>${esc(r.className)}</td><td>${esc(r.teacherName || '—')}</td><td>${r.total}</td><td>${r.present}</td><td>${r.absent}</td><td>${r.late}</td><td>${r.excused}</td><td>${r.pct == null ? '—' : r.pct + '%'}</td></tr>`).join('')}</tbody>
    <tfoot><tr><th>School Total</th><th></th><th></th><th>${data.totals.present}</th><th>${data.totals.absent}</th><th>${data.totals.late}</th><th>${data.totals.excused}</th><th>${data.overallPct == null ? '—' : data.overallPct + '%'}</th></tr></tfoot></table>`;
  printHTML('Attendance Overview', body);
}

/* ============================================================
   8. MANAGEMENT: CLASS PERFORMANCE BOARD
   ============================================================ */
function renderPerformanceBoard() {
  const tbody = document.getElementById('perfBody');
  if (!tbody) return;
  if (!Perm.canViewPerformance()) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:26px;color:var(--text-light)">You are not authorized to view performance analytics.</td></tr>';
    return;
  }
  _fillSelect('perfClass', Classes.list().map(c => c.name), 'All classes');
  _fillSelect('perfSubject', ClassPerformance.subjects(), 'All subjects');
  _fillSelect('perfYear', ClassPerformance.years(), 'All years');

  const className = _val('perfClass');
  const subject = _val('perfSubject');
  const year = _val('perfYear');
  const summaries = ClassPerformance.schoolSummaries({ className, subject, academicYear: year }).filter(s => s.count > 0);

  const schoolAvg = summaries.length ? Math.round(summaries.reduce((a, s) => a + s.average, 0) / summaries.length * 10) / 10 : null;
  const passRate = summaries.length ? Math.round(summaries.reduce((a, s) => a + s.passRate, 0) / summaries.length) : null;
  const needSupport = summaries.filter(s => ClassPerformance.feedback(s).level === 'below').length;

  _setHTML('perfSummary',
    perfStatCard(schoolAvg == null ? '—' : schoolAvg + '%', 'School Average', 'navy', 'fa-chart-line') +
    perfStatCard(passRate == null ? '—' : passRate + '%', 'Average Pass Rate', 'green', 'fa-square-check') +
    perfStatCard(summaries.length, 'Classes Monitored', 'blue', 'fa-school') +
    perfStatCard(needSupport, 'Classes Needing Support', 'red', 'fa-triangle-exclamation'));

  renderPerformanceTargetsPanel();

  tbody.innerHTML = summaries.length ? summaries.map(s => {
    const fb = ClassPerformance.feedback(s);
    return `<tr>
      <td><strong>${esc(s.className)}</strong></td>
      <td>${esc(s.teacherName || '—')}</td>
      <td>${s.students}</td>
      <td>${s.exams}</td>
      <td>${s.average}%</td>
      <td>${s.passRate}%</td>
      <td>${trendBadge(s.trend)}${s.delta != null ? ' ' + deltaText(s.delta) : ''}</td>
      <td><span class="perf-feedback perf-feedback-${fb.level}">${feedbackBadge(fb.level)} ${esc(fb.message)}</span></td>
    </tr>`;
  }).join('') : `<tr><td colspan="8" style="text-align:center;padding:26px;color:var(--text-light)">No finalized examination results match the selected filters yet.</td></tr>`;
  window._perfBoard = { summaries, schoolAvg, passRate };
}

function renderPerformanceTargetsPanel() {
  const box = document.getElementById('perfTargetsPanel');
  if (!box) return;
  if (!Perm.canManagePerformanceTargets()) { box.innerHTML = ''; return; }
  const t = PerformanceTargets.get();
  box.innerHTML = `<div class="panel">
    <div class="panel-head"><h3><i class="fas fa-bullseye" style="color:var(--gold)"></i> School Performance Targets</h3></div>
    <div class="panel-body">
      <div class="form-grid">
        <div class="form-group"><label>Pass Mark (%)</label><input type="number" id="ptPass" min="0" max="100" value="${t.passMark}"></div>
        <div class="form-group"><label>Target Average (%)</label><input type="number" id="ptTarget" min="0" max="100" value="${t.targetAverage}"></div>
        <div class="form-group"><label>Improvement Threshold (points)</label><input type="number" id="ptImprove" min="0" max="100" value="${t.improvementThreshold}"></div>
        <div class="form-group"><label>Decline Threshold (points)</label><input type="number" id="ptDecline" min="0" max="100" value="${t.declineThreshold}"></div>
      </div>
      <div class="form-actions">
        <button class="btn btn-primary" onclick="savePerformanceTargets()"><i class="fas fa-save"></i> Save Targets</button>
      </div>
    </div>
  </div>`;
}

function savePerformanceTargets() {
  const r = PerformanceTargets.save({
    passMark: _val('ptPass'), targetAverage: _val('ptTarget'),
    improvementThreshold: _val('ptImprove'), declineThreshold: _val('ptDecline')
  });
  if (!r.ok) { toast(r.error, 'error'); return; }
  toast('Performance targets saved.');
  renderPerformanceBoard();
}

function printPerformanceBoard() {
  const data = window._perfBoard;
  if (!data) { renderPerformanceBoard(); return printPerformanceBoard(); }
  if (!Perm.canViewPerformance()) { toast('Not authorized.', 'error'); return; }
  const t = PerformanceTargets.get();
  const body = `<h2>Class Performance &amp; Automatic Feedback</h2>
    <div class="meta">Pass mark: ${t.passMark}% · Target average: ${t.targetAverage}% · School average: ${data.schoolAvg == null ? '—' : data.schoolAvg + '%'} · Average pass rate: ${data.passRate == null ? '—' : data.passRate + '%'}</div>
    <table><thead><tr><th>Class</th><th>Class Teacher</th><th>Students</th><th>Exams</th><th>Average</th><th>Pass Rate</th><th>Trend</th><th>Feedback</th></tr></thead>
    <tbody>${data.summaries.map(s => `<tr><td>${esc(s.className)}</td><td>${esc(s.teacherName || '—')}</td><td>${s.students}</td><td>${s.exams}</td><td>${s.average}%</td><td>${s.passRate}%</td><td>${s.trend}</td><td>${esc(ClassPerformance.feedback(s).message)}</td></tr>`).join('')}</tbody></table>`;
  printHTML('Class Performance', body);
}

/* ============================================================
   9. TEACHER: CLASS PERFORMANCE DASHBOARD
   ============================================================ */
function renderClassPerformance() {
  const sel = document.getElementById('cpClass');
  if (!sel) return;
  const s = Auth.session();
  if (!Perm.canViewPerformance()) {
    _setHTML('cpSummary', '');
    _setHTML('cpFeedback', '');
    _setHTML('cpSubjects', '');
    _setHTML('cpExams', '');
    return;
  }
  const classes = Classes.list().filter(c => c.teacherId === s.id);
  if (!classes.length) {
    sel.innerHTML = '<option value="">No class assigned</option>';
    _setHTML('cpSummary', '');
    _setHTML('cpFeedback', `<div class="panel"><div class="panel-body" style="color:var(--text-light)">You are not currently assigned as a class teacher, so there is no class performance dashboard to display. Please contact the administrator.</div></div>`);
    _setHTML('cpSubjects', ''); _setHTML('cpExams', '');
    return;
  }
  const cur = sel.value;
  sel.innerHTML = classes.map(c => `<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('');
  if (cur && classes.some(c => c.name === cur)) sel.value = cur;
  const className = sel.value || classes[0].name;
  const summary = ClassPerformance.classSummary(className);
  const fb = ClassPerformance.feedback(summary);

  _setHTML('cpSummary',
    perfStatCard(summary.average == null ? '—' : summary.average + '%', 'Class Average', 'navy', 'fa-chart-line') +
    perfStatCard(summary.passRate == null ? '—' : summary.passRate + '%', 'Pass Rate', 'green', 'fa-square-check') +
    perfStatCard(summary.passed, 'Passed', 'blue', 'fa-check') +
    perfStatCard(summary.failed, 'Failed', 'red', 'fa-xmark') +
    perfStatCard(summary.students, 'Students', 'gold', 'fa-users'));

  const cmp = (summary.latestExam && summary.previousExam)
    ? `<p style="margin:8px 0"><strong>${esc(summary.previousExam.title)}</strong> (${esc(summary.previousExam.date)}): ${summary.previousAverage}% &nbsp;→&nbsp; <strong>${esc(summary.latestExam.title)}</strong> (${esc(summary.latestExam.date)}): ${summary.currentAverage}% &nbsp; ${deltaText(summary.delta)}</p>`
    : '<p style="margin:8px 0;color:var(--text-light)">Not enough finalized examinations to compare with a previous examination.</p>';
  _setHTML('cpFeedback', `<div class="panel">
      <div class="panel-head"><h3><i class="fas fa-comment-dots" style="color:var(--gold)"></i> Automatic Teacher Feedback — ${esc(className)}</h3>${trendBadge(summary.trend)}</div>
      <div class="panel-body">
        <div class="perf-feedback perf-feedback-${fb.level}">${feedbackBadge(fb.level)} <strong>${esc(fb.message)}</strong></div>
        ${cmp}
        <small style="color:var(--text-light)">Based only on finalized (published) examination results. Target average: ${ClassPerformance.targets().targetAverage}%, pass mark: ${ClassPerformance.targets().passMark}%.</small>
      </div>
    </div>`);

  _setHTML('cpSubjects', summary.subjects.length ? summary.subjects.map(sub => `
    <tr>
      <td><strong>${esc(sub.subject)}</strong></td>
      <td>${esc(sub.latestExam || '—')}</td>
      <td>${sub.average == null ? '—' : sub.average + '%'}</td>
      <td>${sub.previousAverage == null ? '—' : sub.previousAverage + '%'}</td>
      <td>${deltaText(sub.delta)}</td>
      <td>${sub.passRate == null ? '—' : sub.passRate + '%'}</td>
      <td>${sub.passed}</td>
      <td>${sub.failed}</td>
      <td>${trendBadge(sub.trend)}</td>
    </tr>`).join('') :
    '<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--text-light)">No finalized subject results yet.</td></tr>');

  const exams = summary.exams ? ClassPerformance.examList({ className }) : [];
  _setHTML('cpExams', exams.length ? exams.slice().reverse().map(ex => `
    <tr>
      <td><strong>${esc(ex.title)}</strong></td>
      <td>${esc(ex.subject || '—')}</td>
      <td>${esc(ex.date || '—')}</td>
      <td>${ex.average == null ? '—' : ex.average + '%'}</td>
      <td>${ex.passRate == null ? '—' : ex.passRate + '%'}</td>
      <td>${ex.count}</td>
    </tr>`).join('') :
    '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-light)">No finalized examinations yet.</td></tr>');

  window._cpData = { className, summary, fb };
}

function printClassPerformance() {
  const d = window._cpData;
  if (!d) { renderClassPerformance(); return printClassPerformance(); }
  const s = d.summary;
  const body = `<h2>${esc(d.className)} — Class Performance</h2>
    <div class="meta">Class Teacher: ${esc(s.teacherName || '—')} · Students: ${s.students} · Finalized Exams: ${s.exams}</div>
    <table><tbody>
      <tr><th>Class Average</th><td>${s.average == null ? '—' : s.average + '%'}</td><th>Pass Rate</th><td>${s.passRate == null ? '—' : s.passRate + '%'}</td></tr>
      <tr><th>Passed</th><td>${s.passed}</td><th>Failed</th><td>${s.failed}</td></tr>
      <tr><th>Trend</th><td colspan="3">${s.trend}</td></tr>
    </tbody></table>
    <h2>Subject Breakdown</h2>
    <table><thead><tr><th>Subject</th><th>Average</th><th>Pass Rate</th><th>Passed</th><th>Failed</th><th>Trend</th></tr></thead>
    <tbody>${s.subjects.map(x => `<tr><td>${esc(x.subject)}</td><td>${x.average == null ? '—' : x.average + '%'}</td><td>${x.passRate == null ? '—' : x.passRate + '%'}</td><td>${x.passed}</td><td>${x.failed}</td><td>${x.trend}</td></tr>`).join('')}</tbody></table>
    <h2>Automatic Feedback</h2><p>${esc(d.fb.message)}</p>`;
  printHTML('Class Performance', body);
}

/* ============================================================
   10. TEACHER: CLASS-TEACHER DASHBOARD + ATTENDANCE EXTRAS
   ============================================================ */
function goMarkAttendance(classId) {
  const link = document.querySelector('.sidebar-nav a[data-section="attendance"]');
  if (link) link.click();
  const sel = document.getElementById('tcAttClass');
  if (sel && classId) sel.value = classId;
  const dateEl = document.getElementById('tcAttDate');
  if (dateEl && !dateEl.value) dateEl.value = today();
  if (typeof loadAttendanceRegister === 'function') loadAttendanceRegister();
}

function renderTeacherDashboardExtras() {
  const s = Auth.session();
  if (!s || s.role !== 'teacher') return;
  const date = today();
  const myClasses = Classes.list().filter(c => c.teacherId === s.id);

  // Class-teacher panel
  const panel = document.getElementById('tcClassTeacherPanel');
  if (panel) {
    if (!myClasses.length) {
      panel.innerHTML = `<div class="panel"><div class="panel-head"><h3><i class="fas fa-chalkboard-user" style="color:var(--gold)"></i> My Class</h3></div>
        <div class="panel-body" style="color:var(--text-light)">You are not currently assigned as a class teacher. Contact the administrator if this is an error.</div></div>`;
    } else {
      panel.innerHTML = myClasses.map(cls => {
        const st = Attendance.dayStats(cls.id, date);
        const students = Classes.students(cls.id);
        const rows = students.length ? students.map(x => {
          const rec = Attendance.list().find(a => a.classId === cls.id && a.date === date && a.studentId === x.id);
          const status = rec ? rec.status : 'unmarked';
          const badge = status === 'present' ? '<span class="badge badge-success">Present</span>'
            : status === 'absent' ? '<span class="badge badge-danger">Absent</span>'
              : status === 'late' ? '<span class="badge badge-gold">Late</span>'
                : status === 'excused' ? '<span class="badge badge-info">Excused</span>'
                  : '<span class="badge badge-warning">Not marked</span>';
          return `<tr><td>${esc(x.admissionNo || '—')}</td><td><strong>${esc(x.firstName + ' ' + x.lastName)}</strong></td><td>${badge}</td></tr>`;
        }).join('') : '<tr><td colspan="3" style="text-align:center;padding:22px;color:var(--text-light)">No students enrolled in this class.</td></tr>';

        return `<div class="panel">
          <div class="panel-head"><h3><i class="fas fa-chalkboard-user" style="color:var(--gold)"></i> My Class — ${esc(cls.name)}</h3>
            <button class="btn btn-primary" onclick="goMarkAttendance('${cls.id}')"><i class="fas fa-clipboard-check"></i> Mark Attendance</button></div>
          <div class="panel-body">
            <div class="stats-row" style="margin-bottom:14px">
              ${perfStatCard(st.total, 'Students', 'navy', 'fa-users')}
              ${perfStatCard(st.present, 'Present Today', 'green', 'fa-user-check')}
              ${perfStatCard(st.absent, 'Absent Today', 'red', 'fa-user-xmark')}
              ${perfStatCard(st.late, 'Late Today', 'gold', 'fa-clock')}
              ${perfStatCard(st.pct == null ? '—' : st.pct + '%', 'Attendance Today', 'blue', 'fa-percent')}
            </div>
            <div class="table-wrap" style="max-height:320px;overflow:auto">
              <table class="data-table"><thead><tr><th>Adm. No</th><th>Student</th><th>Today (${esc(date)})</th></tr></thead><tbody>${rows}</tbody></table>
            </div>
          </div>
        </div>`;
      }).join('');
    }
  }

  // Performance feedback widget
  const perfPanel = document.getElementById('tcDashPerfPanel');
  if (perfPanel) {
    if (!myClasses.length) { perfPanel.innerHTML = ''; }
    else {
      perfPanel.innerHTML = myClasses.map(cls => {
        const summary = ClassPerformance.classSummary(cls.name);
        const fb = ClassPerformance.feedback(summary);
        return `<div class="panel">
          <div class="panel-head"><h3><i class="fas fa-chart-line" style="color:var(--gold)"></i> Class Performance — ${esc(cls.name)}</h3>${trendBadge(summary.trend)}</div>
          <div class="panel-body">
            <div class="stats-row" style="margin-bottom:12px">
              ${perfStatCard(summary.average == null ? '—' : summary.average + '%', 'Class Average', 'navy', 'fa-chart-line')}
              ${perfStatCard(summary.passRate == null ? '—' : summary.passRate + '%', 'Pass Rate', 'green', 'fa-square-check')}
              ${perfStatCard(summary.exams, 'Finalized Exams', 'blue', 'fa-file-lines')}
            </div>
            <div class="perf-feedback perf-feedback-${fb.level}">${feedbackBadge(fb.level)} ${esc(fb.message)}</div>
            <div style="margin-top:10px"><a href="#" class="btn btn-outline" onclick="event.preventDefault();document.querySelector('[data-section=class-performance]').click()"><i class="fas fa-arrow-right"></i> View Full Class Performance</a></div>
          </div>
        </div>`;
      }).join('');
    }
  }
}

/* Teacher attendance section: summary + reports + quick actions. */
function initTeacherAttendanceExtra() {
  const s = Auth.session();
  if (!s || s.role !== 'teacher') return;
  const dateEl = document.getElementById('tcAttDate');
  if (dateEl && !dateEl.value) dateEl.value = today();
  renderTeacherAttendanceSummary();
  renderTeacherAttendanceReport();
}

function renderTeacherAttendanceSummary() {
  const box = document.getElementById('tcAttSummaryRow');
  if (!box) return;
  const classId = _val('tcAttClass') || ((document.querySelector('#tcAttClass option') || {}).value || '');
  const date = _val('tcAttDate') || today();
  if (!classId) { box.innerHTML = ''; return; }
  if (!Perm.canViewClassAttendance(classId)) { box.innerHTML = ''; return; }
  const st = Attendance.dayStats(classId, date);
  box.innerHTML =
    perfStatCard(st.total, 'Students', 'navy', 'fa-users') +
    perfStatCard(st.present, 'Present', 'green', 'fa-user-check') +
    perfStatCard(st.absent, 'Absent', 'red', 'fa-user-xmark') +
    perfStatCard(st.late, 'Late', 'gold', 'fa-clock') +
    perfStatCard(st.pct == null ? '—' : st.pct + '%', 'Attendance', 'blue', 'fa-percent');
}

function markAllPresent() {
  if (!attendanceRegister || !attendanceRegister.length) { toast('Load a register first.', 'error'); return; }
  attendanceRegister.forEach(r => { if (!r.status) r.status = 'present'; r.status = 'present'; });
  if (typeof renderAttendanceRegister === 'function') renderAttendanceRegister();
  toast('All students marked present. Adjust any exceptions before saving.', 'info');
}

function renderTeacherAttendanceReport() {
  const box = document.getElementById('tcAttReport');
  if (!box) return;
  const classId = _val('tcAttClass');
  const date = _val('tcAttDate') || today();
  const mode = _val('tcAttPeriod') || 'daily';
  if (!classId) { box.innerHTML = '<p style="color:var(--text-light)">Select a class to view attendance reports.</p>'; return; }
  if (!Perm.canViewClassAttendance(classId)) { box.innerHTML = '<p style="color:var(--text-light)">You are not authorized to view attendance for this class.</p>'; return; }
  const report = Attendance.reportForClass(classId, mode, date);
  const t = report.totals;
  const periodLabel = mode === 'daily' ? 'on ' + report.to : 'from ' + report.from + ' to ' + report.to;
  box.innerHTML = `
    <div class="stats-row" style="margin:12px 0">
      ${perfStatCard(t.present, 'Present', 'green', 'fa-user-check')}
      ${perfStatCard(t.absent, 'Absent', 'red', 'fa-user-xmark')}
      ${perfStatCard(t.late, 'Late', 'gold', 'fa-clock')}
      ${perfStatCard(t.excused, 'Excused', 'blue', 'fa-notes-medical')}
      ${perfStatCard(t.pct == null ? '—' : t.pct + '%', 'Attendance Rate', 'navy', 'fa-percent')}
    </div>
    <p style="color:var(--text-light);font-size:.85rem">Showing the ${esc(mode)} report ${esc(periodLabel)}.</p>
    ${report.absentees.length ? `<div class="table-wrap" style="max-height:300px;overflow:auto"><table class="data-table">
      <thead><tr><th>Date</th><th>Student</th><th>Adm. No</th><th>Status</th><th>Remarks</th></tr></thead>
      <tbody>${report.absentees.map(a => `<tr><td>${esc(a.date)}</td><td><strong>${esc(a.studentName)}</strong></td><td>${esc(a.admissionNo || '—')}</td>
        <td>${a.status === 'absent' ? '<span class="badge badge-danger">Absent</span>' : '<span class="badge badge-gold">Late</span>'}</td><td>${esc(a.remarks || '—')}</td></tr>`).join('')}</tbody>
    </table></div>` : '<p style="color:var(--text-light)">No absences or late arrivals in this period.</p>'}`;
}

/* ============================================================
   11. ADMIN DASHBOARD WIDGET
   ============================================================ */
function renderAdminAttendanceWidget() {
  const box = document.getElementById('adminAttWidget');
  if (!box) return;
  if (!Perm.canViewSchoolAttendance()) { box.innerHTML = ''; return; }
  const date = today();
  const rows = Attendance.schoolOverview(date).filter(r => r.total > 0);
  const totals = rows.reduce((a, r) => ({ present: a.present + r.present, absent: a.absent + r.absent, late: a.late + r.late }), { present: 0, absent: 0, late: 0 });
  const required = totals.present + totals.late + totals.absent;
  const pct = required ? Math.round(((totals.present + totals.late) / required) * 100) : null;
  const notMarked = rows.filter(r => r.marked === 0).length;
  box.innerHTML = `<div class="panel">
    <div class="panel-head"><h3><i class="fas fa-clipboard-check" style="color:var(--gold)"></i> Attendance Today (${esc(date)})</h3>
      <button class="btn btn-sm btn-outline" onclick="document.querySelector('[data-section=att-overview]').click()"><i class="fas fa-arrow-right"></i> Full Overview</button></div>
    <div class="panel-body">
      <div class="stats-row">
        ${perfStatCard(totals.present, 'Present', 'green', 'fa-user-check')}
        ${perfStatCard(totals.absent, 'Absent', 'red', 'fa-user-xmark')}
        ${perfStatCard(totals.late, 'Late', 'gold', 'fa-clock')}
        ${perfStatCard(pct == null ? '—' : pct + '%', 'Attendance Rate', 'navy', 'fa-percent')}
        ${perfStatCard(notMarked, 'Classes Not Marked', 'red', 'fa-triangle-exclamation')}
      </div>
    </div></div>`;
}

/* ============================================================
   12. HEADTEACHER DASHBOARD WIDGET
   ============================================================ */
function renderHeadteacherAttendanceWidget() {
  const box = document.getElementById('rvAttDash');
  if (!box) return;
  if (!Perm.canViewSchoolAttendance() && !Perm.isHeadteacher()) { box.innerHTML = ''; return; }
  const date = today();
  const rows = Attendance.schoolOverview(date).filter(r => r.total > 0);
  const totals = rows.reduce((a, r) => ({ present: a.present + r.present, absent: a.absent + r.absent, late: a.late + r.late }), { present: 0, absent: 0, late: 0 });
  const required = totals.present + totals.late + totals.absent;
  const pct = required ? Math.round(((totals.present + totals.late) / required) * 100) : null;
  box.innerHTML = `<div class="panel">
    <div class="panel-head"><h3><i class="fas fa-clipboard-check" style="color:var(--gold)"></i> Attendance &amp; Performance Snapshot (${esc(date)})</h3></div>
    <div class="panel-body">
      <div class="stats-row">
        ${perfStatCard(totals.present, 'Present Today', 'green', 'fa-user-check')}
        ${perfStatCard(totals.absent, 'Absent Today', 'red', 'fa-user-xmark')}
        ${perfStatCard(totals.late, 'Late Today', 'gold', 'fa-clock')}
        ${perfStatCard(pct == null ? '—' : pct + '%', 'Attendance Rate', 'navy', 'fa-percent')}
      </div>
    </div></div>`;
}

/* ============================================================
   13. SECTION ROUTING HOOKS
   ============================================================ */
window.onSectionOpen = (function (prev) {
  return function (section, anchor) {
    if (typeof prev === 'function') { try { prev(section, anchor); } catch (e) { console.error(e); } }
    try {
      const page = document.body ? document.body.dataset.page : '';
      if (section === 'dashboard') {
        if (page === 'teacher') renderTeacherDashboardExtras();
        if (page === 'admin') renderAdminAttendanceWidget();
        if (page === 'headteacher') renderHeadteacherAttendanceWidget();
      }
      if (section === 'attendance') initTeacherAttendanceExtra();
      if (section === 'class-performance') renderClassPerformance();
      if (section === 'att-overview') renderAttendanceOverview();
      if (section === 'performance') renderPerformanceBoard();
    } catch (e) { console.error(e); }
  };
})(window.onSectionOpen);

/* Keep the teacher/admin dashboards fresh: wrap the loaders (after portals.js). */
(function () {
  if (typeof window.loadTeacherDashboard === 'function') {
    const orig = window.loadTeacherDashboard;
    window.loadTeacherDashboard = function () {
      orig.apply(this, arguments);
      try { renderTeacherDashboardExtras(); } catch (e) { console.error(e); }
    };
  }
  if (typeof window.loadAdminDashboard === 'function') {
    const orig = window.loadAdminDashboard;
    window.loadAdminDashboard = function () {
      orig.apply(this, arguments);
      try { renderAdminAttendanceWidget(); } catch (e) { console.error(e); }
    };
  }
})();

/* Render initial widgets once the portal has built itself. */
document.addEventListener('DOMContentLoaded', function () {
  setTimeout(function () {
    try {
      const page = document.body ? document.body.dataset.page : '';
      if (page === 'teacher') renderTeacherDashboardExtras();
      if (page === 'admin') renderAdminAttendanceWidget();
      if (page === 'headteacher') renderHeadteacherAttendanceWidget();
    } catch (e) { console.error(e); }
  }, 0);
});
