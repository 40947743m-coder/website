/* ============================================================
   ST. TERESA ACADEMY — SECRETARY TIMETABLE MODULE
   Subjects · Classes · Classrooms · Teachers · Grid · Generator
   Loaded AFTER admin.js + modules.js + portals.js
   Only the secretary may create/edit official timetables.
   ============================================================ */

/* Canonical period/day defaults, modelled on the reference class timetable
   (ten numbered lesson periods Monday–Friday, with a lunch break column).
   Existing installs keep whatever they already stored; migrateConfig() only
   upgrades a config that is still at the original 7-period default. */
const TT_DEFAULT_PERIODS = [
  { id: 'p1', label: 'Lesson 1', time: '8:15-8:55', kind: 'lesson' },
  { id: 'p2', label: 'Lesson 2', time: '8:55-9:35', kind: 'lesson' },
  { id: 'p3', label: 'Lesson 3', time: '9:35-10:15', kind: 'lesson' },
  { id: 'p4', label: 'Lesson 4', time: '10:15-10:45', kind: 'lesson' },
  { id: 'p5', label: 'Lesson 5', time: '10:45-11:25', kind: 'lesson' },
  { id: 'p6', label: 'Lesson 6', time: '11:25-12:05', kind: 'lesson' },
  { id: 'p7', label: 'Lesson 7', time: '12:05-12:45', kind: 'lesson' },
  { id: 'p8', label: 'Lesson 8', time: '12:45-13:25', kind: 'lesson' },
  { id: 'b1', label: 'Lunch', time: '13:25-14:00', kind: 'break' },
  { id: 'p9', label: 'Lesson 9', time: '14:00-14:40', kind: 'lesson' },
  { id: 'p10', label: 'Lesson 10', time: '14:40-15:20', kind: 'lesson' }
];

/* The school's official classes and streams. Seeded into ttClasses when the
   secretary's timetable is initialised and the list is still empty. */
const TT_DEFAULT_CLASSES = [
  { name: 'PG X', shortName: 'PG X' },
  { name: 'PG Y', shortName: 'PG Y' },
  { name: 'PG W', shortName: 'PG W' },
  { name: 'PP1 X', shortName: 'PP1 X' },
  { name: 'PP1 Y', shortName: 'PP1 Y' },
  { name: 'PP1 W', shortName: 'PP1 W' },
  { name: 'PP2 X', shortName: 'PP2 X' },
  { name: 'PP2 Y', shortName: 'PP2 Y' },
  { name: 'PP2 W', shortName: 'PP2 W' },
  { name: 'Grade 1: Mt. Kenya', shortName: '1M' },
  { name: 'Grade 1: Mt. Ruwenzori', shortName: '1R' },
  { name: 'Grade 1: Mt. Kilimanjaro', shortName: '1K' },
  { name: 'Grade 2: Mt. Kenya', shortName: '2M' },
  { name: 'Grade 2: Mt. Ruwenzori', shortName: '2R' },
  { name: 'Grade 2: Mt. Kilimanjaro', shortName: '2K' },
  { name: 'Grade 3: Mt. Kenya', shortName: '3M' },
  { name: 'Grade 3: Mt. Ruwenzori', shortName: '3R' },
  { name: 'Grade 3: Mt. Kilimanjaro', shortName: '3K' },
  { name: 'Grade 4: Mt. Kenya', shortName: '4M' },
  { name: 'Grade 4: Mt. Ruwenzori', shortName: '4R' },
  { name: 'Grade 4: Mt. Kilimanjaro', shortName: '4K' },
  { name: 'Grade 5: Mt. Kenya', shortName: '5M' },
  { name: 'Grade 5: Mt. Ruwenzori', shortName: '5R' },
  { name: 'Grade 5: Mt. Kilimanjaro', shortName: '5K' },
  { name: 'Grade 6: Mt. Kenya', shortName: '6M' },
  { name: 'Grade 6: Mt. Ruwenzori', shortName: '6R' },
  { name: 'Grade 6: Mt. Kilimanjaro', shortName: '6K' },
  { name: 'Grade 7: Mwai Kibaki', shortName: '7M' },
  { name: 'Grade 7: Wangari Maathai', shortName: '7W' },
  { name: 'Grade 8: Mwai Kibaki', shortName: '8M' },
  { name: 'Grade 8: Wangari Maathai', shortName: '8W' },
  { name: 'Grade 9: Mwai Kibaki', shortName: '9M' },
  { name: 'Grade 9: Wangari Maathai', shortName: '9W' }
];
const TT_DEFAULT_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const TT_DAYS_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TT_LEGACY_PERIOD_IDS = ['p1', 'p2', 'p3', 'b1', 'p4', 'p5', 'p6'];

const Timetable = {
  /* ---------- CONFIG ---------- */
  config() {
    return DB.get('ttConfig', {
      days: TT_DEFAULT_DAYS.slice(),
      saturday: false,
      periods: TT_DEFAULT_PERIODS.map(p => ({ ...p })),
      published: false, version: 0, updatedAt: 0
    });
  },
  /* One-time additive upgrade of the original 7-period default. Existing
     lessons only reference p1–p6/b1, which survive, so nothing is lost. */
  migrateConfig() {
    if (!localStorage.getItem('sta_ttConfigV2')) {
      let cfg = null;
      try { cfg = JSON.parse(localStorage.getItem('sta_ttConfig') || 'null'); } catch (e) { cfg = null; }
      if (cfg && Array.isArray(cfg.periods)) {
        const ids = cfg.periods.map(p => p.id);
        const isLegacy = ids.length === TT_LEGACY_PERIOD_IDS.length && TT_LEGACY_PERIOD_IDS.every(id => ids.includes(id));
        if (isLegacy) {
          cfg = {
            ...cfg,
            periods: TT_DEFAULT_PERIODS.map(p => ({ ...p })),
            days: Array.isArray(cfg.days) && cfg.days.length ? cfg.days : TT_DEFAULT_DAYS.slice(),
            saturday: !!cfg.saturday,
            updatedAt: Date.now()
          };
          DB.set('ttConfig', cfg);
        } else {
          if (typeof cfg.saturday !== 'boolean') { cfg.saturday = false; DB.set('ttConfig', cfg); }
        }
      }
    }
    /* One-time rename of the old "Period N" labels to "Lesson N". */
    if (!localStorage.getItem('sta_ttLessonLabels')) {
      let cur = null;
      try { cur = JSON.parse(localStorage.getItem('sta_ttConfig') || 'null'); } catch (e) { cur = null; }
      if (cur && Array.isArray(cur.periods)) {
        let renamed = false;
        cur.periods = cur.periods.map(p => {
          const m = /^Period\s+(\d+)$/i.exec(String(p.label || ''));
          if (m) { renamed = true; return { ...p, label: 'Lesson ' + m[1] }; }
          return p;
        });
        if (renamed) DB.set('ttConfig', cur);
      }
      try { localStorage.setItem('sta_ttLessonLabels', '1'); } catch (e) { /* retried next load */ }
    }
    try { localStorage.setItem('sta_ttConfigV2', '1'); } catch (e) { /* quota — retried next load */ }
  },
  saveConfig(patch) {
    if (!Perm.canManageTimetable()) return { ok: false, error: 'Only the secretary can change timetable settings.' };
    const cfg = { ...this.config(), ...patch, updatedAt: Date.now() };
    DB.set('ttConfig', cfg);
    Audit.log('timetable.config', 'Timetable settings updated');
    return { ok: true, config: cfg };
  },
  /* Validate a full periods array before it is saved (used by the settings UI). */
  validatePeriods(periods) {
    if (!Array.isArray(periods) || !periods.length) return 'At least one lesson slot is required.';
    const ids = new Set();
    for (const p of periods) {
      if (!p || !p.id) return 'Every lesson slot needs an id.';
      if (ids.has(p.id)) return 'Duplicate lesson slot id: ' + p.id;
      ids.add(p.id);
      if (!String(p.label || '').trim()) return 'Every lesson slot needs a label.';
      if (p.kind !== 'lesson' && p.kind !== 'break') return 'Slot kind must be "lesson" or "break".';
    }
    if (!periods.some(p => p.kind === 'lesson')) return 'At least one lesson is required.';
    return null;
  },
  /* Replace the whole periods list (secretary only). Existing entries that
     reference a removed period are reported so the secretary can regenerate. */
  savePeriods(periods) {
    if (!Perm.canManageTimetable()) return { ok: false, error: 'Only the secretary can change lessons.' };
    const err = this.validatePeriods(periods);
    if (err) return { ok: false, error: err };
    const keep = new Set(periods.map(p => p.id));
    const orphaned = this.entries().filter(e => !keep.has(e.slot)).length;
    const cfg = { ...this.config(), periods: periods.map(p => ({ ...p })), updatedAt: Date.now() };
    DB.set('ttConfig', cfg);
    Audit.log('timetable.config.periods', periods.length + ' slot(s) configured' + (orphaned ? '; ' + orphaned + ' lesson(s) now reference a removed lesson' : ''));
    return { ok: true, orphaned };
  },
  saveDays(days, saturday) {
    if (!Perm.canManageTimetable()) return { ok: false, error: 'Only the secretary can change teaching days.' };
    const clean = (Array.isArray(days) ? days : []).filter(d => TT_DAYS_ORDER.includes(d));
    if (!clean.length) return { ok: false, error: 'At least one teaching day is required.' };
    // keep canonical order
    const ordered = TT_DAYS_ORDER.filter(d => clean.includes(d));
    const cfg = { ...this.config(), days: ordered, saturday: !!saturday, updatedAt: Date.now() };
    DB.set('ttConfig', cfg);
    Audit.log('timetable.config.days', ordered.join(', ') + (saturday ? ' (Saturday enabled)' : ''));
    return { ok: true };
  },
  days() { return this.config().days; },
  periods() { return this.config().periods; },
  lessonPeriods() { return this.periods().filter(p => p.kind === 'lesson'); },
  period(id) { return this.periods().find(p => p.id === id); },
  periodLabel(id) { const p = this.period(id); return p ? p.label : id; },

  /* ---------- DATA ---------- */
  subjects() { return DB.get('ttSubjects'); },
  classes() { return DB.get('ttClasses'); },
  rooms() { return DB.get('ttClassrooms'); },
  ttTeachers() { return DB.get('ttTeachers'); },
  divisions() { return DB.get('ttDivisions'); },
  constraints() { return DB.get('ttConstraints'); },
  entries() { return DB.get('timetable'); },

  guard() {
    if (!Perm.canManageTimetable()) return 'Only authorized secretaries can modify the official timetable.';
    return null;
  },

  /* ---------- SUBJECTS ---------- */
  validateSubject(d, id) {
    if (!d.name || !d.name.trim()) return 'Subject name is required.';
    if (!d.shortName || !d.shortName.trim()) return 'Subject short name is required.';
    if (!(Number(d.count) > 0)) return 'Subject count (lessons per week) must be at least 1.';
    const dup = this.subjects().find(s => s.name.trim().toLowerCase() === d.name.trim().toLowerCase() && s.id !== id);
    if (dup) return 'A subject named "' + d.name + '" already exists.';
    return null;
  },
  saveSubject(d, id) {
    const g = this.guard(); if (g) return { ok: false, error: g };
    const err = this.validateSubject(d, id); if (err) return { ok: false, error: err };
    const list = this.subjects();
    const rec = {
      id: id || DB.uid(),
      name: d.name.trim(), shortName: d.shortName.trim(),
      count: Math.max(1, Number(d.count) || 1),
      timeOff: d.timeOff || [], distribution: d.distribution || 'spread',
      homeworkPrep: !!d.homeworkPrep, questionMarking: !!d.questionMarking,
      updatedAt: today()
    };
    if (id) {
      const i = list.findIndex(s => s.id === id);
      if (i === -1) return { ok: false, error: 'Subject not found.' };
      list[i] = { ...list[i], ...rec };
    } else {
      rec.createdAt = today();
      list.push(rec);
    }
    DB.set('ttSubjects', list);
    Audit.log(id ? 'timetable.subject.update' : 'timetable.subject.create', rec.name + ' (' + rec.count + ' lessons/week)');
    return { ok: true };
  },
  removeSubject(id) {
    const g = this.guard(); if (g) return { ok: false, error: g };
    const used = this.entries().some(e => e.subjectId === id);
    if (used) return { ok: false, error: 'This subject already has timetable lessons. Clear or regenerate the timetable before removing it.' };
    const list = this.subjects();
    const s = list.find(x => x.id === id);
    if (!s) return { ok: false, error: 'Subject not found.' };
    DB.set('ttSubjects', list.filter(x => x.id !== id));
    Audit.log('timetable.subject.remove', s.name);
    return { ok: true };
  },

  /* ---------- CLASSES ---------- */
  validateClass(d, id) {
    if (!d.name || !d.name.trim()) return 'Class name is required.';
    const dup = this.classes().find(c => c.name.trim().toLowerCase() === d.name.trim().toLowerCase() && c.id !== id);
    if (dup) return 'A class named "' + d.name + '" already exists.';
    if (Number(d.minPerDay) > 0 && Number(d.maxPerDay) > 0 && Number(d.minPerDay) > Number(d.maxPerDay))
      return 'Minimum lessons per day cannot exceed the maximum.';
    return null;
  },
  saveClass(d, id) {
    const g = this.guard(); if (g) return { ok: false, error: g };
    const err = this.validateClass(d, id); if (err) return { ok: false, error: err };
    const list = this.classes();
    const teacher = d.teacherId ? DB.get('teachers').find(t => t.id === d.teacherId) : null;
    const rec = {
      id: id || DB.uid(),
      name: d.name.trim(), shortName: (d.shortName || d.name).trim(),
      count: Number(d.count) || 0,
      timeOff: d.timeOff || [],
      arriveSecondPeriod: !!d.arriveSecondPeriod,
      prepRequired: !!d.prepRequired,
      sameFinish: !!d.sameFinish,
      lunchBreak: d.lunchBreak || '',
      maxQuestionMarking: Number(d.maxQuestionMarking) || 0,
      teacherId: d.teacherId || '',
      teacherName: teacher ? teacherDisplayName(teacher) : (d.teacherName || ''),
      fixedClassTeacherTime: d.fixedClassTeacherTime || '',
      startPeriod: d.startPeriod || '',
      endPeriod: d.endPeriod || '',
      minPerDay: Number(d.minPerDay) || 1,
      maxPerDay: Number(d.maxPerDay) || 6,
      lessonInterval: Number(d.lessonInterval) || 0,
      daysPerWeek: Number(d.daysPerWeek) || 5,
      customText: d.customText || '',
      grade: d.grade || d.name,
      subjectIds: d.subjectIds || [],
      size: Number(d.size) || 0,
      updatedAt: today()
    };
    if (id) {
      const i = list.findIndex(c => c.id === id);
      if (i === -1) return { ok: false, error: 'Class not found.' };
      list[i] = { ...list[i], ...rec };
    } else {
      rec.createdAt = today();
      list.push(rec);
    }
    DB.set('ttClasses', list);
    Audit.log(id ? 'timetable.class.update' : 'timetable.class.create', rec.name);
    return { ok: true };
  },
  removeClass(id) {
    const g = this.guard(); if (g) return { ok: false, error: g };
    const cls = this.classes().find(c => c.id === id);
    if (!cls) return { ok: false, error: 'Class not found.' };
    const enrolled = DB.get('students').filter(s => s.className === cls.name && s.status === 'active').length;
    if (enrolled) return { ok: false, error: cls.name + ' has ' + enrolled + ' enrolled student(s). A class with students cannot be removed.' };
    const lessons = this.entries().filter(e => e.classId === id).length;
    if (lessons) return { ok: false, error: cls.name + ' already has ' + lessons + ' timetable lesson(s). Regenerate or clear the timetable first.' };
    const teachers = this.ttTeachers().filter(t => (t.classTeacherOf || '') === cls.name).length;
    if (teachers) return { ok: false, error: cls.name + ' has an assigned class teacher. Unassign the class teacher first.' };
    if (!confirm('Remove the timetable class "' + cls.name + '"?')) return { ok: false, error: 'Cancelled.' };
    DB.set('ttClasses', this.classes().filter(c => c.id !== id));
    Audit.log('timetable.class.remove', cls.name);
    return { ok: true };
  },
  /* Add the school's official classes/streams that are not already present
     (safe to run repeatedly; existing classes are left untouched). */
  seedClasses() {
    const list = this.classes();
    const have = new Set(list.map(c => String(c.name || '').trim().toLowerCase()));
    const additions = TT_DEFAULT_CLASSES.filter(c => !have.has(c.name.toLowerCase()));
    if (!additions.length) return 0;
    additions.forEach(c => {
      list.push({
        id: DB.uid(), name: c.name, shortName: c.shortName, count: 0,
        timeOff: [], arriveSecondPeriod: false, prepRequired: false, sameFinish: false,
        lunchBreak: '', maxQuestionMarking: 0, teacherId: '', teacherName: '',
        fixedClassTeacherTime: '', startPeriod: '', endPeriod: '', minPerDay: 1,
        maxPerDay: 6, lessonInterval: 0, daysPerWeek: 5, customText: '',
        grade: c.name, subjectIds: [], size: 0, updatedAt: today(), createdAt: today()
      });
    });
    DB.set('ttClasses', list);
    Audit.log('timetable.class.seed', additions.length + ' default class(es) added');
    return additions.length;
  },

  /* ---------- CLASSROOMS ---------- */
  saveRoom(d, id) {
    const g = this.guard(); if (g) return { ok: false, error: g };
    if (!d.name || !d.name.trim()) return { ok: false, error: 'Classroom name is required.' };
    const list = this.rooms();
    const dup = list.find(r => r.name.trim().toLowerCase() === d.name.trim().toLowerCase() && r.id !== id);
    if (dup) return { ok: false, error: 'A classroom named "' + d.name + '" already exists.' };
    const rec = {
      id: id || DB.uid(),
      name: d.name.trim(), shortName: (d.shortName || d.name).trim(),
      capacity: Number(d.capacity) || 0,
      timeOff: d.timeOff || [],
      type: d.type || 'Standard Classroom',
      building: d.building || '',
      allowShared: !!d.allowShared,
      updatedAt: today()
    };
    if (id) {
      const i = list.findIndex(r => r.id === id);
      if (i === -1) return { ok: false, error: 'Classroom not found.' };
      list[i] = { ...list[i], ...rec };
    } else { rec.createdAt = today(); list.push(rec); }
    DB.set('ttClassrooms', list);
    Audit.log(id ? 'timetable.room.update' : 'timetable.room.create', rec.name);
    return { ok: true };
  },
  removeRoom(id) {
    const g = this.guard(); if (g) return { ok: false, error: g };
    const used = this.entries().some(e => e.roomId === id);
    if (used) return { ok: false, error: 'This classroom is used by the current timetable. Regenerate the timetable before removing it.' };
    const list = this.rooms();
    const r = list.find(x => x.id === id);
    if (!r) return { ok: false, error: 'Classroom not found.' };
    if (!confirm('Remove the classroom "' + r.name + '"?')) return { ok: false, error: 'Cancelled.' };
    DB.set('ttClassrooms', list.filter(x => x.id !== id));
    Audit.log('timetable.room.remove', r.name);
    return { ok: true };
  },
  removeAllRooms() {
    const g = this.guard(); if (g) return { ok: false, error: g };
    if (!Perm.isSuper() && !Perm.canManageTimetable()) return { ok: false, error: 'Not authorized.' };
    if (this.entries().length) return { ok: false, error: 'Clear or regenerate the timetable first — classrooms are in use.' };
    if (!confirm('Remove ALL classrooms? This cannot be undone.')) return { ok: false, error: 'Cancelled.' };
    if (prompt('Type REMOVE ALL to confirm permanent deletion of every classroom record.') !== 'REMOVE ALL')
      return { ok: false, error: 'Confirmation text did not match. Nothing was removed.' };
    const n = this.rooms().length;
    DB.set('ttClassrooms', []);
    Audit.log('timetable.room.remove_all', n + ' classrooms removed');
    return { ok: true, removed: n };
  },

  /* ---------- TEACHERS ---------- */
  syncTeachersFromStaff() {
    const g = this.guard(); if (g) return { ok: false, error: g };
    const existing = this.ttTeachers();
    const staff = DB.get('teachers').filter(t => t.status !== 'inactive');
    let added = 0;
    staff.forEach(t => {
      const name = teacherDisplayName(t);
      if (existing.some(x => x.name === name)) return;
      existing.push({
        id: DB.uid(), name, shortName: (t.firstName || '').slice(0, 1) + '. ' + (t.lastName || ''),
        count: 0, timeOff: [], classTeacherOf: '', approvalStatus: 'approved',
        maxWindows: 4, daysTaught: 5, exhaustionLimit: 24, minPerDay: 1, maxPerDay: 6,
        maxQuestionMarking: 60, maxFreePerDay: 3, noThreeFree: true,
        subjects: t.subject ? [t.subject] : [], classes: [],
        availability: {}, workingHours: '07:30–15:30', staffId: t.id, createdAt: today()
      });
      added++;
    });
    DB.set('ttTeachers', existing);
    Audit.log('timetable.teacher.import', added + ' teacher(s) imported from staff records');
    return { ok: true, added };
  },
  saveTeacher(d, id) {
    const g = this.guard(); if (g) return { ok: false, error: g };
    if (!d.name || !d.name.trim()) return { ok: false, error: 'Teacher name is required.' };
    const list = this.ttTeachers();
    const rec = {
      id: id || DB.uid(),
      name: d.name.trim(), shortName: d.shortName || '',
      count: Number(d.count) || 0,
      timeOff: d.timeOff || [],
      classTeacherOf: d.classTeacherOf || '',
      approvalStatus: d.approvalStatus || 'approved',
      maxWindows: Number(d.maxWindows) || 0,
      daysTaught: Number(d.daysTaught) || 5,
      exhaustionLimit: Number(d.exhaustionLimit) || 24,
      minPerDay: Number(d.minPerDay) || 0,
      maxPerDay: Number(d.maxPerDay) || 6,
      maxQuestionMarking: Number(d.maxQuestionMarking) || 0,
      maxFreePerDay: Number(d.maxFreePerDay) || 0,
      noThreeFree: !!d.noThreeFree,
      subjects: d.subjects || [], classes: d.classes || [],
      availability: d.availability || {},
      workingHours: d.workingHours || '07:30–15:30',
      updatedAt: today()
    };
    if (id) {
      const i = list.findIndex(t => t.id === id);
      if (i === -1) return { ok: false, error: 'Teacher not found.' };
      list[i] = { ...list[i], ...rec };
    } else { rec.createdAt = today(); list.push(rec); }
    DB.set('ttTeachers', list);
    Audit.log(id ? 'timetable.teacher.update' : 'timetable.teacher.create', rec.name);
    return { ok: true };
  },
  removeTeacher(id) {
    const g = this.guard(); if (g) return { ok: false, error: g };
    const used = this.entries().some(e => e.teacherId === id);
    if (used) return { ok: false, error: 'This teacher already has lessons in the current timetable. Regenerate first.' };
    const list = this.ttTeachers();
    const t = list.find(x => x.id === id);
    if (!t) return { ok: false, error: 'Teacher not found.' };
    DB.set('ttTeachers', list.filter(x => x.id !== id));
    Audit.log('timetable.teacher.remove', t.name);
    return { ok: true };
  },

  /* ---------- ENTRIES ---------- */
  entriesFor(kind, id) {
    const key = kind === 'class' ? 'classId' : kind === 'teacher' ? 'teacherId' : 'roomId';
    return this.entries().filter(e => e[key] === id);
  },
  saveEntry(entry) {
    const g = this.guard(); if (g) return { ok: false, error: g };
    if (!entry.subject || !entry.day || !entry.slot) return { ok: false, error: 'Day, lesson and subject are required.' };
    if (!this.days().includes(entry.day)) return { ok: false, error: 'Invalid day.' };
    const per = this.period(entry.slot);
    if (!per) return { ok: false, error: 'Invalid lesson.' };
    if (per.kind !== 'lesson') return { ok: false, error: per.label + ' is not a lesson.' };
    const list = this.entries();
    const clash = list.find(e => e.id !== entry.id && e.day === entry.day && e.slot === entry.slot &&
      ((e.classId && e.classId === entry.classId) || (e.teacherId && e.teacherId === entry.teacherId) || (e.roomId && e.roomId === entry.roomId)));
    if (clash) {
      const who = e => e.classId === entry.classId ? 'the class' : e.teacherId === entry.teacherId ? 'the teacher' : 'the classroom';
      return { ok: false, error: 'Clash: ' + who(clash) + ' is already booked at ' + this.periodLabel(entry.slot) + ' on ' + entry.day + '.' };
    }
    if (entry.id) {
      const i = list.findIndex(e => e.id === entry.id);
      if (i === -1) { entry.id = DB.uid(); list.push(entry); } else list[i] = { ...list[i], ...entry };
    } else { entry.id = DB.uid(); entry.createdAt = new Date().toISOString(); list.push(entry); }
    DB.set('timetable', list);
    Audit.log('timetable.entry.save', (entry.subject || '') + ' · ' + (entry.grade || '') + ' · ' + entry.day + ' ' + this.periodLabel(entry.slot));
    return { ok: true };
  },
  removeEntry(id) {
    const g = this.guard(); if (g) return { ok: false, error: g };
    const list = this.entries();
    const e = list.find(x => x.id === id);
    if (!e) return { ok: false, error: 'Lesson not found.' };
    DB.set('timetable', list.filter(x => x.id !== id));
    Audit.log('timetable.entry.remove', (e.subject || '') + ' · ' + (e.grade || '') + ' · ' + e.day + ' ' + this.periodLabel(e.slot));
    return { ok: true };
  },
  clearAll() {
    const g = this.guard(); if (g) return { ok: false, error: g };
    if (!confirm('Clear the entire timetable? This cannot be undone.')) return { ok: false, error: 'Cancelled.' };
    const n = this.entries().length;
    DB.set('timetable', []);
    const cfg = this.config(); DB.set('ttConfig', { ...cfg, published: false, updatedAt: Date.now() });
    Audit.log('timetable.clear', n + ' lesson(s) removed; timetable unpublished');
    return { ok: true, removed: n };
  },

  /* ============================================================
     AUTOMATIC GENERATION
     ============================================================ */
  generate() {
    const g = this.guard(); if (g) return { ok: false, error: g };
    // never silently overwrite an existing draft or published timetable
    if (this.entries().length && typeof confirm === 'function' &&
      !confirm('Generating will replace the current timetable (' + this.entries().length + ' lessons). Continue?')) {
      return { ok: false, error: 'Cancelled — the existing timetable was kept.' };
    }
    const cfg = this.config();
    const days = cfg.days;
    const lessonPeriods = cfg.periods.filter(p => p.kind === 'lesson');
    const subjects = this.subjects();
    const classes = this.classes();
    const rooms = this.rooms();
    const teachers = this.ttTeachers();

    if (!classes.length) return { ok: false, error: 'Add timetable classes first.' };
    if (!subjects.length) return { ok: false, error: 'Add timetable subjects first.' };
    if (!teachers.length) return { ok: false, error: 'Add or import teachers first.' };

    const warnings = [];
    const entries = [];
    const clsBusy = {};      // classId|day|slot
    const teacherBusy = {};  // teacherId|day|slot
    const roomBusy = {};     // roomId|day|slot
    const key = (a, b, c) => a + '|' + b + '|' + c;
    const teacherLoad = {};  // teacherId|day -> count
    const teacherTotal = {}; // teacherId -> count
    const dayCount = {};     // classId|day -> count
    const subjectLast = {};  // classId|subjectId|day -> last slot index

    const slotIndex = {};
    cfg.periods.forEach((p, i) => slotIndex[p.id] = i);

    // order classes smallest first so constrained classes get slots
    const ordered = classes.slice().sort((a, b) => (a.size || 0) - (b.size || 0));

    ordered.forEach(cls => {
      const classSubjects = subjects.filter(s => !cls.subjectIds.length || cls.subjectIds.includes(s.id));
      if (!classSubjects.length) {
        warnings.push(cls.name + ': no timetable subjects are assigned to this class — no lessons placed.');
        return;
      }
      // build the wish list of lessons
      const wish = [];
      classSubjects.forEach(s => { for (let i = 0; i < Math.max(1, Number(s.count) || 1); i++) wish.push(s); });
      wish.sort((a, b) => (b.count || 1) - (a.count || 1));

      // eligible days
      const eligibleDays = days.slice(0, Math.max(1, Math.min(days.length, cls.daysPerWeek || days.length)));

      wish.forEach(sub => {
        let placed = false;
        const attempts = [];
        eligibleDays.forEach(day => {
          lessonPeriods.forEach(p => {
            if ((cls.timeOff || []).includes(p.id)) return;
            if ((sub.timeOff || []).includes(p.id)) return;
            if (cls.lunchBreak && p.id === cls.lunchBreak) return;
            if (cls.arriveSecondPeriod && p.id === lessonPeriods[0].id) return;
            if (cls.startPeriod && slotIndex[p.id] < slotIndex[cls.startPeriod]) return;
            if (cls.endPeriod && slotIndex[p.id] > slotIndex[cls.endPeriod]) return;
            if (clsBusy[key(cls.id, day, p.id)]) return;
            // lesson interval: same subject must not sit adjacent
            const prev = subjectLast[cls.id + '|' + sub.id + '|' + day];
            if (prev != null && cls.lessonInterval > 0 && Math.abs(slotIndex[p.id] - prev) <= cls.lessonInterval) return;
            attempts.push({ day, period: p });
          });
        });

        // score: fewest lessons for the class that day, then fewest for candidate teachers, then period order
        attempts.sort((a, b) => {
          const ca = dayCount[cls.id + '|' + a.day] || 0;
          const cb = dayCount[cls.id + '|' + b.day] || 0;
          if (ca !== cb) return ca - cb;
          return slotIndex[a.period.id] - slotIndex[b.period.id];
        });

        for (const attempt of attempts) {
          const { day, period } = attempt;
          const perDay = dayCount[cls.id + '|' + day] || 0;
          if (perDay >= cls.maxPerDay) continue;

          // ---- teachers ----
          const candidates = teachers.filter(t => {
            if (t.approvalStatus && t.approvalStatus !== 'approved') return false;
            if ((t.subjects || []).length && !t.subjects.includes(sub.name) && !t.subjects.includes(sub.shortName)) return false;
            if ((t.classes || []).length && !t.classes.includes(cls.name)) return false;
            if ((t.timeOff || []).includes(period.id)) return false;
            if (teacherBusy[key(t.id, day, period.id)]) return false;
            const load = teacherLoad[t.id + '|' + day] || 0;
            if (t.maxPerDay && load >= t.maxPerDay) return false;
            if (t.daysTaught && t.daysTaught < days.indexOf(day) + 1) return false;
            if (t.exhaustionLimit && (teacherTotal[t.id] || 0) >= t.exhaustionLimit) return false;
            return true;
          });
          candidates.sort((a, b) => (teacherLoad[a.id + '|' + day] || 0) - (teacherLoad[b.id + '|' + day] || 0)
            || (teacherTotal[a.id] || 0) - (teacherTotal[b.id] || 0));
          const teacher = candidates[0];
          if (!teacher) continue;

          // ---- classrooms ----
          const roomCandidates = rooms.filter(r => {
            if ((r.timeOff || []).includes(period.id)) return false;
            if (roomBusy[key(r.id, day, period.id)] && !r.allowShared) return false;
            if (r.capacity && cls.size && r.capacity < cls.size) return false;
            if (r.allowShared && roomBusy[key(r.id, day, period.id)]) return false;
            return true;
          }).sort((a, b) => (a.capacity || 999) - (b.capacity || 999));
          const room = roomCandidates[0];
          if (!room && rooms.length) continue;

          // place it
          const entry = {
            id: DB.uid(), classId: cls.id, grade: cls.name, className: cls.name,
            day, slot: period.id, subjectId: sub.id, subject: sub.name, subjectShort: sub.shortName,
            teacherId: teacher.id, teacher: teacher.name,
            roomId: room ? room.id : '', room: room ? room.name : '',
            createdAt: new Date().toISOString()
          };
          entries.push(entry);
          clsBusy[key(cls.id, day, period.id)] = true;
          teacherBusy[key(teacher.id, day, period.id)] = true;
          if (room) roomBusy[key(room.id, day, period.id)] = true;
          teacherLoad[teacher.id + '|' + day] = (teacherLoad[teacher.id + '|' + day] || 0) + 1;
          teacherTotal[teacher.id] = (teacherTotal[teacher.id] || 0) + 1;
          dayCount[cls.id + '|' + day] = (dayCount[cls.id + '|' + day] || 0) + 1;
          subjectLast[cls.id + '|' + sub.id + '|' + day] = slotIndex[period.id];
          placed = true;
          break;
        }

        if (!placed) {
          warnings.push(cls.name + ': could not place ' + sub.name + ' — no teacher or classroom available in an eligible period.');
        }
      });

      // minimum lessons per day check
      eligibleDays.forEach(day => {
        const n = dayCount[cls.id + '|' + day] || 0;
        if (n < cls.minPerDay) warnings.push(cls.name + ' on ' + day + ' has only ' + n + ' lesson(s); the configured minimum is ' + cls.minPerDay + '.');
      });

      // class-teacher fixed time
      if (cls.fixedClassTeacherTime && cls.teacherId) {
        const parts = String(cls.fixedClassTeacherTime).split('@');
        const day = parts[0], slot = parts[1];
        if (day && slot && !clsBusy[key(cls.id, day, slot)]) {
          const t = teachers.find(x => x.id === cls.teacherId) || teachers.find(x => x.name === cls.teacherName);
          const room = rooms.find(r => !roomBusy[key(r.id, day, slot)]) || rooms[0];
          if (t && !teacherBusy[key(t.id, day, slot)]) {
            entries.push({
              id: DB.uid(), classId: cls.id, grade: cls.name, className: cls.name,
              day, slot, subjectId: '', subject: 'Class Teacher Session', subjectShort: 'CT',
              teacherId: t.id, teacher: t.name, roomId: room ? room.id : '', room: room ? room.name : '',
              createdAt: new Date().toISOString()
            });
            clsBusy[key(cls.id, day, slot)] = true; teacherBusy[key(t.id, day, slot)] = true;
            if (room) roomBusy[key(room.id, day, slot)] = true;
          } else {
            warnings.push(cls.name + ': the required class-teacher period (' + day + ' ' + this.periodLabel(slot) + ') is unavailable.');
          }
        }
      }
    });

    // global checks: three free periods in a day
    teachers.forEach(t => {
      if (!t.noThreeFree) return;
      days.forEach(day => {
        const load = teacherLoad[t.id + '|' + day] || 0;
        const free = lessonPeriods.length - load;
        if (load > 0 && free >= 3) warnings.push(t.name + ' has ' + free + ' free periods on ' + day + ' (three-free-period rule).');
      });
    });

    // teacher working-hours sanity: nothing outside first/last lesson
    if (!entries.length) return { ok: false, error: 'No lessons could be placed. Check subjects, teachers, classrooms and time-off settings.', warnings };

    DB.set('timetable', entries);
    const cfg2 = { ...cfg, published: false, version: (cfg.version || 0) + 1, updatedAt: Date.now() };
    DB.set('ttConfig', cfg2);
    Audit.log('timetable.generate', entries.length + ' lesson(s) generated, ' + warnings.length + ' warning(s)');
    return { ok: true, placed: entries.length, warnings, version: cfg2.version };
  },

  /* ---------- CONFLICT SCAN (shown to the secretary) ---------- */
  conflicts() {
    const out = [];
    const list = this.entries();
    const seen = {};
    list.forEach(e => {
      const k = e.day + '|' + e.slot;
      ['classId', 'teacherId', 'roomId'].forEach(f => {
        if (!e[f]) return;
        const kk = f + '|' + e[f] + k;
        if (seen[kk]) out.push('Duplicate booking: ' + (e[f === 'classId' ? 'grade' : f === 'teacherId' ? 'teacher' : 'room']) + ' — ' + e.day + ' ' + this.periodLabel(e.slot));
        seen[kk] = true;
      });
    });
    const cfg = this.config();
    list.forEach(e => {
      const p = this.period(e.slot);
      if (!p || p.kind !== 'lesson') out.push(e.subject + ' (' + e.grade + ') is scheduled in a non-lesson period: ' + this.periodLabel(e.slot));
      if (!this.days().includes(e.day)) out.push('Entry on unknown day: ' + e.day);
    });
    return out;
  },

  /* ---------- ACADEMIC CONTEXT (snapshot on publish) ---------- */
  academicContext() {
    const year = (typeof AcademicYears !== 'undefined' && AcademicYears.activeYear)
      ? AcademicYears.activeYear()
      : (DB.get('settings', {}).academicYear || String(new Date().getFullYear()));
    const term = (typeof AcademicYears !== 'undefined' && AcademicYears.activeTerm)
      ? AcademicYears.activeTerm()
      : (DB.get('settings', {}).term || '1');
    return { academicYear: year, term };
  },

  /* ---------- ARCHIVE (version history) ---------- */
  archives() { return DB.get('ttArchive'); },
  snapshot(label) {
    const list = this.archives();
    const ctx = this.academicContext();
    const cfg = this.config();
    list.unshift({
      id: DB.uid(),
      label: label || ('v' + (cfg.version || 0)),
      version: cfg.version || 0,
      publishedAt: cfg.publishedAt || new Date().toISOString(),
      publishedBy: cfg.publishedBy || ((Auth.session() || {}).name || ''),
      archivedAt: new Date().toISOString(),
      archivedBy: (Auth.session() || {}).name || '',
      academicYear: ctx.academicYear, term: ctx.term,
      classCount: new Set(this.entries().map(e => e.classId || e.grade)).size,
      lessonCount: this.entries().length,
      entries: this.entries()
    });
    while (list.length > 20) list.pop();
    DB.set('ttArchive', list);
    return list[0];
  },
  listArchives() { return this.archives(); },
  /* Snapshot the currently published timetable, then pull it back to draft. */
  archive() {
    if (!Perm.canManageTimetable()) return { ok: false, error: 'Only the secretary can archive the timetable.' };
    if (!this.entries().length) return { ok: false, error: 'There is no timetable to archive.' };
    if (!this.isPublished()) return { ok: false, error: 'Only a published timetable can be archived. Publish it first, or unpublish and clear it.' };
    const snap = this.snapshot();
    const cfg = this.config();
    DB.set('ttConfig', { ...cfg, published: false, updatedAt: Date.now() });
    Audit.log('timetable.archive', 'Timetable v' + snap.version + ' archived (' + snap.lessonCount + ' lessons)');
    return { ok: true, snapshot: snap };
  },
  /* Load an archived version back into the working draft (secretary only). */
  restoreArchive(id) {
    if (!Perm.canManageTimetable()) return { ok: false, error: 'Only the secretary can restore an archived timetable.' };
    const a = this.archives().find(x => x.id === id);
    if (!a) return { ok: false, error: 'Archived timetable not found.' };
    if (!confirm('Restore "' + a.label + '" into the working draft? The current draft will be replaced.')) return { ok: false, error: 'Cancelled.' };
    DB.set('timetable', (a.entries || []).map(e => ({ ...e })));
    const cfg = this.config();
    DB.set('ttConfig', { ...cfg, published: false, version: (cfg.version || 0) + 1, updatedAt: Date.now() });
    Audit.log('timetable.restore', 'Restored archive ' + a.label + ' (' + (a.entries || []).length + ' lessons) as draft');
    return { ok: true };
  },
  deleteArchive(id) {
    if (!Perm.canManageTimetable()) return { ok: false, error: 'Only the secretary can delete archived timetables.' };
    const a = this.archives().find(x => x.id === id);
    if (!a) return { ok: false, error: 'Archived timetable not found.' };
    if (!confirm('Permanently delete archived timetable "' + a.label + '"? This cannot be undone.')) return { ok: false, error: 'Cancelled.' };
    DB.set('ttArchive', this.archives().filter(x => x.id !== id));
    Audit.log('timetable.archive.delete', a.label);
    return { ok: true };
  },

  /* ---------- PUBLISH ---------- */
  publish() {
    if (!Perm.canManageTimetable()) return { ok: false, error: 'Only the secretary can publish the official timetable.' };
    if (!this.entries().length) return { ok: false, error: 'Generate a timetable before publishing.' };
    const c = this.conflicts();
    if (c.length) return { ok: false, error: 'Resolve timetable conflicts first (' + c.length + ' found).' };
    const ctx = this.academicContext();
    const cfg = this.config();
    const version = (cfg.version || 0) + 1;
    const publishedAt = new Date().toISOString();
    const publishedBy = (Auth.session() || {}).name || '';
    DB.set('ttConfig', {
      ...cfg, published: true, version,
      updatedAt: Date.now(), publishedAt, publishedBy,
      academicYear: ctx.academicYear, term: ctx.term,
      classCount: new Set(this.entries().map(e => e.classId || e.grade)).size,
      lessonCount: this.entries().length
    });
    Audit.log('timetable.publish', 'Official timetable published (v' + version + ', ' + this.entries().length + ' lessons, ' + ctx.academicYear + ' term ' + ctx.term + ')');
    DB.get('users').filter(u => u.role === 'teacher').forEach(u => Notifications.send(u.id, 'teacher', 'Official Timetable Published', 'The school timetable has been published. Open "My Timetable" to view or print it.'));
    DB.get('students').filter(u => u.role === 'student').forEach(u => Notifications.send(u.id, 'student', 'Timetable Published', 'The official class timetable is now available under "My Timetable".'));
    return { ok: true, version };
  },
  unpublish() {
    if (!Perm.canManageTimetable()) return { ok: false, error: 'Only the secretary can unpublish the timetable.' };
    const cfg = this.config();
    DB.set('ttConfig', { ...cfg, published: false, updatedAt: Date.now() });
    Audit.log('timetable.unpublish', 'Official timetable unpublished');
    return { ok: true };
  },
  isPublished() { return !!this.config().published; },
  /* Only the secretary ever sees a draft. Every other role — admin,
     headteacher, chief examiner, teacher, student, store, kitchen — sees the
     published official timetable and nothing else. */
  canViewEntries() { return this.isPublished() || Perm.canManageTimetable(); },
  /* Read-only portals: the official entries, or [] if not published. */
  publishedEntries() { return this.isPublished() ? this.entries() : []; },
  publishedMeta() {
    const cfg = this.config();
    const ctx = this.academicContext();
    return {
      published: !!cfg.published,
      version: cfg.version || 0,
      academicYear: cfg.academicYear || ctx.academicYear,
      term: cfg.term || ctx.term,
      publishedAt: cfg.publishedAt || '',
      publishedBy: cfg.publishedBy || '',
      classCount: cfg.classCount || 0,
      lessonCount: cfg.lessonCount || 0
    };
  },

  /* ============================================================
     SHARED GRID BUILDER
     Produces the reference-layout timetable: days down the left,
     numbered periods across the top with their times, and lessons that
     occupy the same subject/teacher/room across consecutive periods
     merged into a single spanning cell.
     ============================================================ */
  dayAbbr(d) {
    return ({ Monday: 'Mo', Tuesday: 'Tu', Wednesday: 'We', Thursday: 'Th', Friday: 'Fr', Saturday: 'Sa' })[d] || String(d).slice(0, 2);
  },
  _matchKey(e) {
    return (e.subjectId || e.subject || '') + '#' + (e.teacherId || e.teacher || '') + '#' + (e.roomId || e.room || '');
  },
  /* entries: array (already filtered). opts:
     { days, periods, editable, onAdd(day,pid), includeBreaks, secondary(e) } */
  buildGrid(entries, opts) {
    opts = opts || {};
    const cfg = this.config();
    const days = opts.days || cfg.days;
    const periods = opts.periods || cfg.periods;
    const editable = !!opts.editable;
    const secondary = opts.secondary || null;
    const has = (day, pid) => entries.find(e => e.day === day && e.slot === pid && e.kind !== 'break');
    const matchRun = (day, startIdx) => {
      const first = has(day, periods[startIdx].id);
      if (!first) return 0;
      const key = this._matchKey(first);
      let n = 1;
      for (let j = startIdx + 1; j < periods.length; j++) {
        if (periods[j].kind !== 'lesson') break;
        const nxt = has(day, periods[j].id);
        if (!nxt || this._matchKey(nxt) !== key) break;
        n++;
      }
      return n;
    };

    const head = '<tr><th class="tt-ref-corner"><span class="tt-ref-pn">Day</span></th>' +
      periods.map(p => p.kind === 'break'
        ? `<th class="tt-ref-break"><span class="tt-ref-pn">${esc(p.label)}</span><span class="tt-ref-pt">${esc(p.time || '')}</span></th>`
        : `<th><span class="tt-ref-pn">${esc(p.label)}</span><span class="tt-ref-pt">${esc(p.time || '')}</span></th>`).join('') +
      '</tr>';

    const rows = days.map(day => {
      let tds = '';
      for (let i = 0; i < periods.length; i++) {
        const p = periods[i];
        if (p.kind === 'break') { tds += '<td class="tt-ref-breakcell"></td>'; continue; }
        const e = has(day, p.id);
        if (!e) {
          tds += `<td class="tt-ref-empty">${editable && opts.onAdd ? `<button class="tt-ref-add" onclick="${opts.onAdd(day, p.id)}" title="Add lesson">+</button>` : ''}</td>`;
          continue;
        }
        const run = matchRun(day, i);
        const sec = secondary ? secondary(e) : [e.teacher, e.room].filter(Boolean).join(' · ');
        const btns = editable
          ? `<span class="tt-ref-btns"><button class="tt-ref-btn" onclick="ttEditEntry('${e.id}')" title="Adjust"><i class="fas fa-pen"></i></button>` +
            `<button class="tt-ref-btn danger" onclick="ttDeleteEntry('${e.id}')" title="Remove"><i class="fas fa-trash"></i></button></span>`
          : '';
        tds += `<td class="tt-ref-cellwrap" colspan="${run}"><div class="tt-ref-cell">
          <span class="tt-ref-sub">${esc(e.subject || e.subjectShort || '')}</span>
          ${sec ? `<span class="tt-ref-meta">${esc(sec)}</span>` : ''}
          ${btns}</div></td>`;
        i += run - 1;
      }
      return `<tr><th class="tt-ref-day" title="${esc(day)}">${esc(this.dayAbbr(day))}</th>${tds}</tr>`;
    }).join('');

    return `<div class="tt-ref-scroll"><table class="tt-ref"><thead>${head}</thead><tbody>${rows}</tbody></table></div>`;
  },
  /* On-screen / print header block shared by every portal. */
  gridHeaderHTML(opts) {
    const m = this.publishedMeta();
    const meta = opts.meta || ('Academic Year ' + esc(String(m.academicYear)) + ' · Term ' + esc(String(m.term)));
    const logo = DB.get('logo', {});
    const logoImg = logo.imageUrl ? `<img src="${esc(logo.imageUrl)}" alt="" style="height:52px;width:auto">` : '';
    return `<div class="tt-ref-head">
      ${logoImg}
      <div class="tt-ref-head-c">
        <div class="tt-ref-school">ST. TERESA ACADEMY</div>
        <div class="tt-ref-title">${esc(opts.title || 'School Timetable')}</div>
        <div class="tt-ref-sub">${meta}</div>
      </div>
      <div class="tt-ref-head-r">
        ${opts.statusBadge === false ? '' : (m.published ? `<span class="badge badge-success">Published · v${m.version}</span>` : '<span class="badge badge-warning">Draft</span>')}
      </div>
    </div>`;
  },

  /* ============================================================
     PRINTING (browser print / Save as PDF)
     ============================================================ */
  _printDoc(title, bodyHTML) {
    const w = window.open('', '_blank', 'width=1100,height=800');
    if (!w) { toast('Please allow pop-ups to print.', 'error'); return; }
    const logo = DB.get('logo', {});
    const logoImg = logo.imageUrl ? `<img src="${esc(logo.imageUrl)}" alt="" style="height:54px">` : '';
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${esc(title)}</title>
    <style>
      @page{size:A4 landscape;margin:8mm}
      *{box-sizing:border-box}
      body{font-family:Arial,Helvetica,sans-serif;color:#000;margin:0;padding:8px}
      .hdr{display:flex;align-items:center;justify-content:space-between;gap:14px;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:10px}
      .hdr .sch{font-size:1.15rem;font-weight:800;letter-spacing:.5px}
      .hdr .tt{font-size:.9rem;font-weight:600}
      .hdr .mt{font-size:.78rem;color:#333}
      table.tt-ref{width:100%;border-collapse:collapse;table-layout:fixed;font-size:.62rem}
      table.tt-ref th,table.tt-ref td{border:1px solid #000;padding:2px;text-align:center;vertical-align:middle;overflow:hidden}
      table.tt-ref thead th{background:#f1f1f1;font-weight:700}
      .tt-ref-day{width:34px;background:#f1f1f1;font-weight:800;font-size:.85rem}
      .tt-ref-corner{width:34px;background:#f1f1f1}
      .tt-ref-pn{display:block;font-weight:700;font-size:.66rem;line-height:1.1}
      .tt-ref-pt{display:block;font-size:.52rem;color:#222;line-height:1.1}
      .tt-ref-sub{display:block;font-weight:700;font-size:.66rem;line-height:1.12;word-break:break-word}
      .tt-ref-meta{display:block;font-size:.5rem;color:#333;line-height:1.05}
      .tt-ref-breakcell{background:repeating-linear-gradient(45deg,#f5f5f5,#f5f5f5 5px,#ececec 5px,#ececec 10px)}
      .tt-ref-break{background:#eaeaea}
      .tt-ref-empty{background:#fff}
      .foot{margin-top:10px;font-size:.6rem;color:#333;display:flex;justify-content:space-between}
      .draft{text-align:center;font-weight:800;color:#b00;border:1px solid #b00;padding:3px;margin:6px 0;font-size:.72rem}
    </style></head><body>
    <div class="hdr">${logoImg || ''}<div><div class="sch">ST. TERESA ACADEMY</div><div class="tt">${esc(title)}</div><div class="mt" id="ttDocMeta"></div></div><div class="mt">${logo.name || ''}</div></div>
    ${bodyHTML}
    <div class="foot"><span>Timetable generated ${new Date().toLocaleDateString()}</span><span>St. Teresa Academy · Unity is Strength</span></div>
    <script>window.onload=function(){setTimeout(function(){window.print()},350)}<\/script>
    </body></html>`);
    w.document.close();
  },
  _printBody(entries, title, meta, secondary) {
    const m = this.publishedMeta();
    const draft = m.published ? '' : '<div class="draft">DRAFT — NOT YET PUBLISHED</div>';
    return draft + this.buildGrid(entries, { secondary });
  },
  printAll() {
    const entries = this.entries();
    if (!this.canViewEntries()) return toast('The timetable has not been published yet.', 'error');
    if (!entries.length) return toast('There is no timetable to print yet.', 'error');
    const m = this.publishedMeta();
    const cls = this.classes();
    // one printed page per class keeps the layout readable
    const groups = cls.length
      ? cls.map(c => ({ name: c.name, rows: entries.filter(e => e.classId === c.id || e.grade === c.name || e.className === c.name) })).filter(g => g.rows.length)
      : [{ name: 'All Classes', rows: entries }];
    const body = groups.map(g =>
      `<div style="page-break-after:always"><div style="text-align:center;font-weight:800;font-size:.95rem;margin:4px 0">${esc(g.name)}</div>${this.buildGrid(g.rows, { secondary: e => [e.teacher, e.room].filter(Boolean).join(' · ') })}</div>`).join('');
    this._printDoc('Whole School Timetable',
      `<div class="mt" style="text-align:center;font-size:.72rem;margin-bottom:6px">Academic Year ${esc(String(m.academicYear))} · Term ${esc(String(m.term))} · ${entries.length} lessons</div>${body}`);
    Audit.log('timetable.print', 'Whole-school timetable printed');
  },
  printClass(id) {
    const cls = this.classes().find(c => c.id === id);
    if (!cls) return toast('Class not found.', 'error');
    if (!this.canViewEntries()) return toast('The timetable has not been published yet.', 'error');
    const entries = this.entries().filter(e => e.classId === id || e.grade === cls.name || e.className === cls.name);
    if (!entries.length) return toast('No lessons scheduled for this class.', 'error');
    const m = this.publishedMeta();
    this._printDoc(cls.name + ' Timetable',
      `<div class="mt" style="text-align:center;font-size:.72rem;margin-bottom:6px">Academic Year ${esc(String(m.academicYear))} · Term ${esc(String(m.term))}</div>` +
      this._printBody(entries, cls.name, '', e => [e.teacher, e.room].filter(Boolean).join(' · ')));
    Audit.log('timetable.print', 'Class timetable: ' + cls.name);
  },
  printTeacher(id) {
    const t = this.ttTeachers().find(x => x.id === id);
    if (!t) return toast('Teacher not found.', 'error');
    if (!this.canViewEntries()) return toast('The timetable has not been published yet.', 'error');
    const entries = this.entries().filter(e => e.teacherId === id || e.teacher === t.name);
    if (!entries.length) return toast('No lessons scheduled for this teacher.', 'error');
    const m = this.publishedMeta();
    this._printDoc(t.name + ' — Teaching Timetable',
      `<div class="mt" style="text-align:center;font-size:.72rem;margin-bottom:6px">Academic Year ${esc(String(m.academicYear))} · Term ${esc(String(m.term))} · ${entries.length} lessons</div>` +
      this._printBody(entries, t.name, '', e => [e.className || e.grade, e.room].filter(Boolean).join(' · ')));
    Audit.log('timetable.print', 'Teacher timetable: ' + t.name);
  },
  printRoom(id) {
    const r = this.rooms().find(x => x.id === id);
    if (!r) return toast('Classroom not found.', 'error');
    if (!this.canViewEntries()) return toast('The timetable has not been published yet.', 'error');
    const entries = this.entries().filter(e => e.roomId === id || e.room === r.name);
    if (!entries.length) return toast('No lessons scheduled in this classroom.', 'error');
    const m = this.publishedMeta();
    this._printDoc(r.name + ' — Classroom Timetable',
      `<div class="mt" style="text-align:center;font-size:.72rem;margin-bottom:6px">${esc(r.building || '')} · ${entries.length} lessons</div>` +
      this._printBody(entries, r.name, '', e => [e.className || e.grade, e.teacher].filter(Boolean).join(' · ')));
    Audit.log('timetable.print', 'Classroom timetable: ' + r.name);
  },
  /* Used by teacher / student / read-only portals. */
  printTeacherView(teacherName) {
    const rows = this.entriesForTeacher(teacherName, this.publishedEntries());
    if (!rows.length) return toast('Your timetable has not been published yet.', 'error');
    const m = this.publishedMeta();
    this._printDoc('My Teaching Timetable',
      `<div class="mt" style="text-align:center;font-size:.72rem;margin-bottom:6px">${esc(teacherName)} · Academic Year ${esc(String(m.academicYear))} · Term ${esc(String(m.term))}</div>` +
      this._printBody(rows, 'Teaching Timetable', '', e => [e.className || e.grade, e.room].filter(Boolean).join(' · ')));
    Audit.log('timetable.print', 'Teaching timetable (self): ' + teacherName);
  },
  printClassView(className) {
    const entries = this.publishedEntries().filter(e => e.className === className || e.grade === className);
    if (!entries.length) return toast('Your class timetable has not been published yet.', 'error');
    const m = this.publishedMeta();
    this._printDoc(className + ' — Class Timetable',
      `<div class="mt" style="text-align:center;font-size:.72rem;margin-bottom:6px">Academic Year ${esc(String(m.academicYear))} · Term ${esc(String(m.term))}</div>` +
      this._printBody(entries, className + ' Class Timetable', '', e => [e.teacher, e.room].filter(Boolean).join(' · ')));
    Audit.log('timetable.print', 'Class timetable (self): ' + className);
  },

  /* ============================================================
     READ-ONLY VIEW HELPERS (published timetable only)
     ============================================================ */
  classesForGrid() {
    const seen = {};
    const out = [];
    this.entries().forEach(e => { const n = e.className || e.grade; if (n && !seen[n]) { seen[n] = 1; out.push(n); } });
    this.classes().forEach(c => { if (!seen[c.name]) { seen[c.name] = 1; out.push(c.name); } });
    return out.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  },
  teachersForGrid() {
    const seen = {}; const out = [];
    this.entries().forEach(e => { if (e.teacher && !seen[e.teacher]) { seen[e.teacher] = 1; out.push(e.teacher); } });
    this.ttTeachers().forEach(t => { if (!seen[t.name]) { seen[t.name] = 1; out.push(t.name); } });
    return out.sort();
  },
  entriesForClass(className, source) {
    const rows = source || this.publishedEntries();
    return rows.filter(e => e.className === className || e.grade === className);
  },
  entriesForTeacher(name, source) {
    const rows = source || this.publishedEntries();
    return rows.filter(e => e.teacher === name);
  },
  /* Render a read-only published grid into a container element, with an
     optional class/teacher selector. Used by admin/head/chief/store/kitchen. */
  renderReadOnlyGrid(containerId, opts) {
    opts = opts || {};
    const wrap = document.getElementById(containerId);
    if (!wrap) return;
    const m = this.publishedMeta();
    if (!this.isPublished()) {
      wrap.innerHTML = `<div class="empty-state"><i class="fas fa-calendar-days"></i>
        <h4>The timetable has not been published yet</h4>
        <p>The secretary is still preparing the official school timetable. It will appear here as soon as it is published.</p></div>`;
      return;
    }
    const entries = this.publishedEntries();
    const mode = opts.mode || 'class';
    const names = mode === 'teacher' ? this.teachersForGrid() : this.classesForGrid();
    const current = (opts.value && names.includes(opts.value)) ? opts.value : (names[0] || '');
    const rows = mode === 'teacher' ? this.entriesForTeacher(current, entries) : this.entriesForClass(current, entries);
    const secondary = mode === 'teacher'
      ? (e => [e.className || e.grade, e.room].filter(Boolean).join(' · '))
      : (e => [e.teacher, e.room].filter(Boolean).join(' · '));
    const title = current ? (mode === 'teacher' ? current + ' — Teaching Timetable' : current + ' — Class Timetable') : 'School Timetable';
    wrap.innerHTML =
      this.gridHeaderHTML({ title, meta: 'Academic Year ' + esc(String(m.academicYear)) + ' · Term ' + esc(String(m.term)) }) +
      (rows.length ? this.buildGrid(rows, { secondary }) :
        `<div class="empty-state" style="margin-top:12px"><i class="fas fa-calendar"></i><h4>No lessons scheduled</h4><p>There are no published lessons for <strong>${esc(current || 'this view')}</strong>.</p></div>`);
  },

  /* ---------- IMPORT ---------- */
  async importSubjects(input) {
    const g = this.guard(); if (g) return { ok: false, error: g };
    const csv = await readCSVInput(input);
    if (csv.error) return { ok: false, error: csv.error };
    let added = 0, skipped = 0;
    csv.rows.forEach(r => {
      const name = csvPick(csv.header, r, 'subjectname', 'name', 'subject');
      const shortName = csvPick(csv.header, r, 'subjectshortname', 'shortname', 'short') || name.slice(0, 4).toUpperCase();
      const count = Number(csvPick(csv.header, r, 'subjectcount', 'count', 'lessons')) || 1;
      const timeOff = csvList(csv.header, r, 'timeoff', 'unavailableperiods');
      if (!name) { skipped++; return; }
      const res = this.saveSubject({
        name, shortName, count, timeOff,
        homeworkPrep: csvBool(csv.header, r, 'homeworkpreparationrequired', 'homeworkprep'),
        questionMarking: csvBool(csv.header, r, 'questionmarkingrequired', 'questionmarking'),
        distribution: csvPick(csv.header, r, 'lessondistribution', 'distribution') || 'spread'
      });
      if (res.ok) added++; else skipped++;
    });
    Audit.log('timetable.subject.import', added + ' imported, ' + skipped + ' skipped');
    return { ok: true, added, skipped };
  },
  async importTeachers(input) {
    const g = this.guard(); if (g) return { ok: false, error: g };
    const csv = await readCSVInput(input);
    if (csv.error) return { ok: false, error: csv.error };
    let added = 0;
    csv.rows.forEach(r => {
      const name = csvPick(csv.header, r, 'teachername', 'name', 'teacher');
      if (!name) return;
      const res = this.saveTeacher({
        name, shortName: csvPick(csv.header, r, 'teachershortname', 'shortname') || name,
        subjects: csvList(csv.header, r, 'assignedsubjects', 'subjects'),
        classes: csvList(csv.header, r, 'assignedclasses', 'classes'),
        timeOff: csvList(csv.header, r, 'timeoff', 'unavailableperiods'),
        maxPerDay: Number(csvPick(csv.header, r, 'maximumlessonsperday', 'maxperday')) || 6,
        minPerDay: Number(csvPick(csv.header, r, 'minimumlessonsperday', 'minperday')) || 1,
        maxFreePerDay: Number(csvPick(csv.header, r, 'maximumfreeperiodsperday', 'maxfreeperday')) || 3,
        maxWindows: Number(csvPick(csv.header, r, 'maximumnumberoffreeperiods', 'maxwindows')) || 4,
        daysTaught: Number(csvPick(csv.header, r, 'numberofdaystaught', 'daystaught')) || 5,
        exhaustionLimit: Number(csvPick(csv.header, r, 'teacherworkloadexhaustionlimit', 'exhaustionlimit')) || 24,
        noThreeFree: csvBool(csv.header, r, 'preventthreefreeperiods', 'nothreefree')
      });
      if (res.ok) added++;
    });
    Audit.log('timetable.teacher.import_csv', added + ' imported');
    return { ok: true, added };
  },
  async importRooms(input) {
    const g = this.guard(); if (g) return { ok: false, error: g };
    const csv = await readCSVInput(input);
    if (csv.error) return { ok: false, error: csv.error };
    let added = 0;
    csv.rows.forEach(r => {
      const name = csvPick(csv.header, r, 'classroomname', 'name', 'classroom');
      if (!name) return;
      const res = this.saveRoom({
        name, shortName: csvPick(csv.header, r, 'shortname') || name,
        capacity: Number(csvPick(csv.header, r, 'classroomcount', 'capacity', 'count')) || 0,
        type: csvPick(csv.header, r, 'classroomtype', 'type') || 'Standard Classroom',
        building: csvPick(csv.header, r, 'buildingorlocation', 'building', 'location'),
        timeOff: csvList(csv.header, r, 'timeoff', 'unavailableperiods'),
        allowShared: csvBool(csv.header, r, 'allowshared', 'shared')
      });
      if (res.ok) added++;
    });
    Audit.log('timetable.room.import', added + ' imported');
    return { ok: true, added };
  }
};

/* ============================================================
   SECRETARY TIMETABLE UI
   ============================================================ */
let _ttSelected = { subjects: null, classes: null, rooms: null, teachers: null };
let _ttGridMode = 'class';

function ttPeriodChecks(selected, idPrefix) {
  return Timetable.periods().map(p => `
    <label style="display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid var(--border);border-radius:8px;cursor:pointer;font-size:0.83rem;background:var(--cream)">
      <input type="checkbox" name="${idPrefix}" value="${p.id}" ${selected.includes(p.id) ? 'checked' : ''}> ${esc(p.label)}
    </label>`).join('');
}
function ttChecked(name) {
  return [...document.querySelectorAll(`input[name="${name}"]:checked`)].map(x => x.value);
}

function fillTtEntrySelects() {
  const day = document.getElementById('tteeDay');
  const per = document.getElementById('tteePeriod');
  if (day && !day.options.length) day.innerHTML = Timetable.days().map(d => `<option value="${d}">${d}</option>`).join('');
  if (per && !per.options.length) per.innerHTML = Timetable.lessonPeriods().map(p => `<option value="${p.id}">${esc(p.label)}</option>`).join('');
}
function ttSyncStaff() {
  const r = Timetable.syncTeachersFromStaff();
  if (!r.ok) return toast(r.error, 'error');
  toast((r.added || 0) + ' teacher(s) imported from staff records.', r.added ? 'success' : 'info');
  renderTtTeachers(); fillTtSelects(); renderTtGrid();
}

function initSecretaryTimetable() {
  Timetable.migrateConfig();
  Timetable.seedClasses();
  if (typeof seedKindergartenTeachers === 'function') { try { seedKindergartenTeachers(); } catch (e) { console.error(e); } }
  if (typeof seedPrimaryClassTeachers === 'function') { try { seedPrimaryClassTeachers(); } catch (e) { console.error(e); } }
  fillTtEntrySelects();
  bindTtForm('ttSubjectForm', collectTtSubject, 'ttSubjectModal');
  bindTtForm('ttClassForm', collectTtClass, 'ttClassModal');
  bindTtForm('ttRoomForm', collectTtRoom, 'ttRoomModal');
  bindTtForm('ttTeacherForm', collectTtTeacher, 'ttTeacherModal');
  renderTtSubjects(); renderTtClasses(); renderTtRooms(); renderTtTeachers();
  fillTtSelects(); renderTtGrid();
  renderTtSettings(); renderTtArchive();
}

/* ---------- LESSONS & DAYS SETTINGS (secretary only) ---------- */
let _ttPeriodDraft = null;

function renderTtSettings(reset) {
  const box = document.getElementById('ttSettingsBody');
  if (!box) return;
  const cfg = Timetable.config();
  if (reset || !_ttPeriodDraft) _ttPeriodDraft = cfg.periods.map(p => ({ ...p }));
  const daysBox = document.getElementById('ttDaysBox');
  if (daysBox) {
    daysBox.innerHTML = TT_DAYS_ORDER.map(d => {
      const allowed = d !== 'Saturday' || true;
      const checked = cfg.days.includes(d);
      const dis = (d === 'Saturday' && !checked) ? '' : '';
      return `<label class="tt-daycheck"><input type="checkbox" name="ttDay" value="${d}" ${checked ? 'checked' : ''} ${dis}> ${d}${d === 'Saturday' ? ' <small>(optional)</small>' : ''}</label>`;
    }).join('') + `<label class="tt-daycheck"><input type="checkbox" id="ttSaturdayToggle" ${cfg.saturday ? 'checked' : ''}> Enable Saturday teaching</label>`;
  }
  box.innerHTML = `
    <div class="table-wrap"><table class="data-table">
      <thead><tr><th>Order</th><th>Label</th><th>Start–End</th><th>Type</th><th></th></tr></thead>
      <tbody>${_ttPeriodDraft.map((p, i) => `<tr>
        <td>${i + 1}</td>
        <td><input class="tt-inp" value="${esc(p.label)}" oninput="ttPeriodEdit(${i},'label',this.value)"></td>
        <td><input class="tt-inp" value="${esc(p.time || '')}" placeholder="8:15–8:55" oninput="ttPeriodEdit(${i},'time',this.value)"></td>
        <td><select class="tt-inp" onchange="ttPeriodEdit(${i},'kind',this.value)">
          <option value="lesson" ${p.kind === 'lesson' ? 'selected' : ''}>Lesson</option>
          <option value="break" ${p.kind === 'break' ? 'selected' : ''}>Break / Lunch</option>
        </select></td>
        <td class="table-actions">
          <button class="btn btn-xs btn-outline" onclick="ttPeriodMove(${i},-1)" ${i === 0 ? 'disabled' : ''}><i class="fas fa-arrow-up"></i></button>
          <button class="btn btn-xs btn-outline" onclick="ttPeriodMove(${i},1)" ${i === _ttPeriodDraft.length - 1 ? 'disabled' : ''}><i class="fas fa-arrow-down"></i></button>
          <button class="btn btn-xs btn-danger" onclick="ttPeriodRemove(${i})"><i class="fas fa-trash"></i></button>
        </td>
      </tr>`).join('')}</tbody>
    </table></div>
    <div class="tt-settings-actions">
      <button class="btn btn-outline btn-sm" onclick="ttPeriodAdd('lesson')"><i class="fas fa-plus"></i> Add lesson</button>
      <button class="btn btn-outline btn-sm" onclick="ttPeriodAdd('break')"><i class="fas fa-mug-hot"></i> Add break</button>
      <button class="btn btn-primary btn-sm" onclick="ttSaveSettings()"><i class="fas fa-floppy-disk"></i> Save lessons &amp; days</button>
      <button class="btn btn-outline btn-sm" onclick="renderTtSettings(true)"><i class="fas fa-rotate-left"></i> Reset changes</button>
    </div>`;
}

function ttPeriodEdit(i, k, v) { if (_ttPeriodDraft[i]) _ttPeriodDraft[i][k] = v; }
function ttPeriodAdd(kind) {
  _ttPeriodDraft = _ttPeriodDraft || Timetable.config().periods.map(p => ({ ...p }));
  const n = _ttPeriodDraft.length + 1;
  const lessonCount = _ttPeriodDraft.filter(p => p.kind === 'lesson').length + (kind === 'lesson' ? 1 : 0);
  _ttPeriodDraft.push(kind === 'break'
    ? { id: 'b' + DB.uid(), label: 'Break', time: '', kind: 'break' }
    : { id: 'p' + DB.uid(), label: 'Lesson ' + lessonCount, time: '', kind: 'lesson' });
  renderTtSettings();
}
function ttPeriodRemove(i) {
  if (!_ttPeriodDraft || _ttPeriodDraft.length <= 1) return;
  _ttPeriodDraft.splice(i, 1);
  renderTtSettings();
}
function ttPeriodMove(i, dir) {
  const j = i + dir;
  if (j < 0 || j >= _ttPeriodDraft.length) return;
  const t = _ttPeriodDraft[i]; _ttPeriodDraft[i] = _ttPeriodDraft[j]; _ttPeriodDraft[j] = t;
  renderTtSettings();
}
function ttSaveSettings() {
  if (!Perm.canManageTimetable()) return toast('Only the secretary can change timetable settings.', 'error');
  const days = [...document.querySelectorAll('input[name="ttDay"]:checked')].map(x => x.value);
  const saturday = !!(document.getElementById('ttSaturdayToggle') || {}).checked;
  const rDays = Timetable.saveDays(days, saturday);
  if (!rDays.ok) return toast(rDays.error, 'error');
  const rPer = Timetable.savePeriods(_ttPeriodDraft);
  if (!rPer.ok) return toast(rPer.error, 'error');
  _ttPeriodDraft = null;
  toast('Timetable lessons and days saved.' + (rPer.orphaned ? ' ' + rPer.orphaned + ' lesson(s) referenced a removed lesson — regenerate.' : ''));
  renderTtSettings(); fillTtEntrySelects(); fillTtSelects(); renderTtGrid(); renderTtClassFormSelects();
}
/* Refresh any period <select>s inside the class modal after a settings change. */
function renderTtClassFormSelects() {
  const pOpts = Timetable.lessonPeriods().map(p => `<option value="${p.id}">${esc(p.label)}</option>`).join('');
  ['ttcStart', 'ttcEnd', 'ttcLunch'].forEach(i => { const el = document.getElementById(i); if (el) el.innerHTML = '<option value="">—</option>' + pOpts; });
}

/* ---------- TIMETABLE VERSION ARCHIVE (secretary only) ---------- */
function renderTtArchive() {
  const box = document.getElementById('ttArchiveBody');
  if (!box) return;
  const list = Timetable.listArchives();
  box.innerHTML = list.length ? `<div class="table-wrap"><table class="data-table">
    <thead><tr><th>Version</th><th>Academic Year</th><th>Term</th><th>Lessons</th><th>Classes</th><th>Published</th><th>Archived</th><th></th></tr></thead>
    <tbody>${list.map(a => `<tr>
      <td><strong>${esc(a.label)}</strong></td>
      <td>${esc(String(a.academicYear || ''))}</td>
      <td>${esc(String(a.term || ''))}</td>
      <td>${a.lessonCount || (a.entries || []).length}</td>
      <td>${a.classCount || '—'}</td>
      <td>${a.publishedAt ? esc(new Date(a.publishedAt).toLocaleDateString()) : '—'}<br><small>${esc(a.publishedBy || '')}</small></td>
      <td>${a.archivedAt ? esc(new Date(a.archivedAt).toLocaleString()) : '—'}</td>
      <td class="table-actions">
        <button class="btn btn-xs btn-outline" onclick="ttRestoreArchive('${a.id}')" title="Restore as draft"><i class="fas fa-rotate-left"></i></button>
        <button class="btn btn-xs btn-danger" onclick="ttDeleteArchive('${a.id}')" title="Delete"><i class="fas fa-trash"></i></button>
      </td>
    </tr>`).join('')}</tbody></table></div>`
    : `<div class="empty-state"><i class="fas fa-box-archive"></i><h4>No archived timetables yet</h4>
        <p>Every time you archive a published timetable, a restorable snapshot is kept here (the last 20).</p></div>`;
}
function ttArchiveNow() {
  const r = Timetable.archive();
  if (!r.ok) return toast(r.error, 'error');
  toast('Timetable archived. A restorable snapshot was saved.');
  renderTtArchive(); renderTtGrid();
}
function ttRestoreArchive(id) {
  const r = Timetable.restoreArchive(id);
  if (!r.ok) return toast(r.error, 'error');
  toast('Archived timetable restored into the draft.');
  renderTtArchive(); renderTtGrid(); renderTtTeachers();
}
function ttDeleteArchive(id) {
  const r = Timetable.deleteArchive(id);
  if (!r.ok) return toast(r.error, 'error');
  toast('Archived timetable deleted.', 'info');
  renderTtArchive();
}

function bindTtForm(formId, collector, modalId) {
  const form = document.getElementById(formId);
  if (!form || form.dataset.bound) return;
  form.dataset.bound = '1';
  form.addEventListener('submit', e => {
    e.preventDefault();
    const r = collector();
    if (!r.ok) { toast(r.error, 'error'); return; }
    toast(form.dataset.editingId ? 'Saved!' : 'Created!');
    form.reset(); delete form.dataset.editingId;
    closeModal(modalId);
    renderTtSubjects(); renderTtClasses(); renderTtRooms(); renderTtTeachers(); renderTtGrid(); fillTtSelects();
  });
}

function fillTtSelects() {
  const specs = [
    { id: 'ttgClass', all: 'All classes', opts: Timetable.classes().map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('') },
    { id: 'ttgTeacher', all: 'All teachers', opts: Timetable.ttTeachers().map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('') },
    { id: 'ttgRoom', all: 'All classrooms', opts: Timetable.rooms().map(r => `<option value="${r.id}">${esc(r.name)}</option>`).join('') }
  ];
  specs.forEach(sp => {
    const el = document.getElementById(sp.id);
    if (!el) return;
    const prev = el.value; // keep the secretary's chosen filter across re-renders
    el.innerHTML = `<option value="">${sp.all}</option>` + sp.opts;
    if (prev && [...el.options].some(o => o.value === prev)) el.value = prev;
    else el.value = '';
  });
  const staffOpts = DB.get('teachers').filter(t => t.status !== 'inactive').map(t => `<option value="${t.id}">${esc(teacherDisplayName(t))}</option>`).join('');
  const ctSel = document.getElementById('ttcTeacherId');
  if (ctSel) ctSel.innerHTML = '<option value="">— None —</option>' + staffOpts;
  const subjBox = document.getElementById('ttcSubjects');
  if (subjBox) subjBox.innerHTML = Timetable.subjects().map(s => `<label style="display:inline-flex;align-items:center;gap:6px;padding:5px 9px;border:1px solid var(--border);border-radius:8px;font-size:0.82rem;background:var(--cream)"><input type="checkbox" name="ttcSubject" value="${s.id}"> ${esc(s.name)}</label>`).join('');
}

/* ---------- SUBJECTS ---------- */
function renderTtSubjects() {
  const tbody = document.getElementById('ttSubjectsBody');
  if (!tbody) return;
  const items = Timetable.subjects();
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('ttSubjectCount', items.length);
  set('ttLessonTotal', items.reduce((a, s) => a + Number(s.count || 0), 0));
  tbody.innerHTML = items.length ? items.map(s => `
    <tr ${_ttSelected.subjects === s.id ? 'style="background:rgba(201,162,39,.12)"' : ''}>
      <td><strong>${esc(s.name)}</strong></td>
      <td><code>${esc(s.shortName)}</code></td>
      <td>${s.count}</td>
      <td>${(s.timeOff || []).map(p => Timetable.periodLabel(p)).join(', ') || '<span style="color:var(--text-light)">—</span>'}</td>
      <td>${esc(s.distribution || 'spread')}</td>
      <td>${s.homeworkPrep ? '<span class="badge badge-success">Yes</span>' : '<span class="badge badge-navy">No</span>'}</td>
      <td>${s.questionMarking ? '<span class="badge badge-warning">Yes</span>' : '<span class="badge badge-navy">No</span>'}</td>
      <td class="table-actions">
        <button class="btn btn-xs btn-outline" onclick="ttEditSubject('${s.id}')"><i class="fas fa-pen"></i></button>
        <button class="btn btn-xs btn-danger" onclick="ttRemoveSubject('${s.id}')"><i class="fas fa-trash"></i></button>
      </td>
    </tr>`).join('') : `<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--text-light)">No timetable subjects yet — add or import subjects.</td></tr>`;
}

function openTtSubject(id) {
  const form = document.getElementById('ttSubjectForm');
  form.reset();
  delete form.dataset.editingId;
  document.getElementById('ttSubjectTitle').textContent = id ? 'Edit Subject' : 'New Subject';
  if (id) {
    const s = Timetable.subjects().find(x => x.id === id);
    if (!s) return;
    form.dataset.editingId = id;
    document.getElementById('ttsName').value = s.name;
    document.getElementById('ttsShort').value = s.shortName;
    document.getElementById('ttsCount').value = s.count;
    document.getElementById('ttsDist').value = s.distribution || 'spread';
    document.getElementById('ttsHomework').checked = !!s.homeworkPrep;
    document.getElementById('ttsMarking').checked = !!s.questionMarking;
    document.getElementById('ttsTimeOff').innerHTML = ttPeriodChecks(s.timeOff || [], 'ttsTimeOff');
  } else {
    document.getElementById('ttsCount').value = 4;
    document.getElementById('ttsTimeOff').innerHTML = ttPeriodChecks([], 'ttsTimeOff');
  }
  openModal('ttSubjectModal');
}
function ttEditSubject(id) { _ttSelected.subjects = id; openTtSubject(id); }
function collectTtSubject() {
  const form = document.getElementById('ttSubjectForm');
  return Timetable.saveSubject({
    name: document.getElementById('ttsName').value,
    shortName: document.getElementById('ttsShort').value,
    count: document.getElementById('ttsCount').value,
    distribution: document.getElementById('ttsDist').value,
    homeworkPrep: document.getElementById('ttsHomework').checked,
    questionMarking: document.getElementById('ttsMarking').checked,
    timeOff: ttChecked('ttsTimeOff')
  }, form.dataset.editingId || null);
}
function ttRemoveSubject(id) {
  if (!confirm('Remove this subject?')) return;
  const r = Timetable.removeSubject(id);
  if (!r.ok) return toast(r.error, 'error');
  toast('Subject removed.', 'info');
  renderTtSubjects(); renderTtGrid(); fillTtSelects();
}

/* ---------- CLASSES ---------- */
function renderTtClasses() {
  const tbody = document.getElementById('ttClassesBody');
  if (!tbody) return;
  const items = Timetable.classes();
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('ttClassCount', items.length);
  tbody.innerHTML = items.length ? items.map(c => `
    <tr>
      <td><strong>${esc(c.name)}</strong><br><small style="color:var(--text-light)">${esc(c.shortName || '')}</small></td>
      <td>${c.count || DB.get('students').filter(s => s.className === c.name && s.status === 'active').length}</td>
      <td>${(c.timeOff || []).map(p => Timetable.periodLabel(p)).join(', ') || '—'}</td>
      <td>${c.minPerDay}–${c.maxPerDay}<br><small style="color:var(--text-light)">${c.daysPerWeek} days/wk</small></td>
      <td>${c.teacherName ? esc(c.teacherName) : '<span class="badge badge-danger">None</span>'}</td>
      <td>${esc(c.customText || '—')}</td>
      <td class="table-actions">
        <button class="btn btn-xs btn-primary" onclick="ttManageLessons('${c.id}')"><i class="fas fa-book-open"></i></button>
        <button class="btn btn-xs btn-outline" onclick="ttEditClass('${c.id}')"><i class="fas fa-pen"></i></button>
        <button class="btn btn-xs btn-outline" onclick="Timetable.printClass('${c.id}')"><i class="fas fa-print"></i></button>
        <button class="btn btn-xs btn-danger" onclick="ttRemoveClass('${c.id}')"><i class="fas fa-trash"></i></button>
      </td>
    </tr>`).join('') : `<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text-light)">No timetable classes yet.</td></tr>`;
}

function openTtClass(id) {
  const form = document.getElementById('ttClassForm');
  form.reset();
  delete form.dataset.editingId;
  document.getElementById('ttClassTitle').textContent = id ? 'Edit Class' : 'New Class';
  fillTtSelects();
  document.getElementById('ttcSubjects').innerHTML = Timetable.subjects().map(s => `<label style="display:inline-flex;align-items:center;gap:6px;padding:5px 9px;border:1px solid var(--border);border-radius:8px;font-size:0.82rem;background:var(--cream)"><input type="checkbox" name="ttcSubject" value="${s.id}"> ${esc(s.name)}</label>`).join('');
  const pOpts = Timetable.lessonPeriods().map(p => `<option value="${p.id}">${esc(p.label)}</option>`).join('');
  ['ttcStart', 'ttcEnd', 'ttcLunch'].forEach(i => { const el = document.getElementById(i); if (el) el.innerHTML = '<option value="">—</option>' + pOpts; });
  const daysOpts = Timetable.days().map(d => `<option value="${d}">${d}</option>`).join('');
  const fixed = document.getElementById('ttcFixedDay'); if (fixed) fixed.innerHTML = '<option value="">— Not required —</option>' + daysOpts;
  const fixedP = document.getElementById('ttcFixedPeriod'); if (fixedP) fixedP.innerHTML = '<option value="">— Not required —</option>' + pOpts;
  if (id) {
    const c = Timetable.classes().find(x => x.id === id);
    if (!c) return;
    form.dataset.editingId = id;
    const val = (i, v) => { const el = document.getElementById(i); if (el) el.value = v || ''; };
    val('ttcName', c.name); val('ttcShort', c.shortName); val('ttcCount', c.count);
    val('ttcSize', c.size); val('ttcTeacherId', c.teacherId);
    val('ttcMaxMarking', c.maxQuestionMarking); val('ttcStart', c.startPeriod); val('ttcEnd', c.endPeriod);
    val('ttcMin', c.minPerDay); val('ttcMax', c.maxPerDay); val('ttcInterval', c.lessonInterval);
    val('ttcDays', c.daysPerWeek); val('ttcText', c.customText); val('ttcGrade', c.grade);
    val('ttcLunch', c.lunchBreak);
    if (c.fixedClassTeacherTime) {
      const p = String(c.fixedClassTeacherTime).split('@');
      const fd = document.getElementById('ttcFixedDay'); if (fd) fd.value = p[0] || '';
      const fp = document.getElementById('ttcFixedPeriod'); if (fp) fp.value = p[1] || '';
    }
    document.getElementById('ttcArrive2').checked = !!c.arriveSecondPeriod;
    document.getElementById('ttcPrep').checked = !!c.prepRequired;
    document.getElementById('ttcSameFinish').checked = !!c.sameFinish;
    document.getElementById('ttcTimeOff').innerHTML = ttPeriodChecks(c.timeOff || [], 'ttcTimeOff');
    document.querySelectorAll('input[name="ttcSubject"]').forEach(cb => cb.checked = (c.subjectIds || []).includes(cb.value));
  } else {
    document.getElementById('ttcMin').value = 3;
    document.getElementById('ttcMax').value = 6;
    document.getElementById('ttcDays').value = 5;
    document.getElementById('ttcCount').value = 0;
    document.getElementById('ttcTimeOff').innerHTML = ttPeriodChecks([], 'ttcTimeOff');
    const fp = document.getElementById('ttcFixedPeriod');
    if (fp) fp.innerHTML = '<option value="">— Not required —</option>' + Timetable.lessonPeriods().map(p => `<option value="${p.id}">${esc(p.label)}</option>`).join('');
  }
  const fp2 = document.getElementById('ttcFixedPeriod');
  if (fp2 && !fp2.options.length) fp2.innerHTML = '<option value="">— Not required —</option>' + Timetable.lessonPeriods().map(p => `<option value="${p.id}">${esc(p.label)}</option>`).join('');
  openModal('ttClassModal');
}
function ttEditClass(id) { openTtClass(id); }
function collectTtClass() {
  const form = document.getElementById('ttClassForm');
  const fd = document.getElementById('ttcFixedDay').value;
  const fp = document.getElementById('ttcFixedPeriod').value;
  return Timetable.saveClass({
    name: document.getElementById('ttcName').value,
    shortName: document.getElementById('ttcShort').value,
    count: document.getElementById('ttcCount').value,
    size: document.getElementById('ttcSize').value,
    teacherId: document.getElementById('ttcTeacherId').value,
    maxQuestionMarking: document.getElementById('ttcMaxMarking').value,
    startPeriod: document.getElementById('ttcStart').value,
    endPeriod: document.getElementById('ttcEnd').value,
    minPerDay: document.getElementById('ttcMin').value,
    maxPerDay: document.getElementById('ttcMax').value,
    lessonInterval: document.getElementById('ttcInterval').value,
    daysPerWeek: document.getElementById('ttcDays').value,
    customText: document.getElementById('ttcCustomText') ? document.getElementById('ttcCustomText').value : document.getElementById('ttcText').value,
    grade: document.getElementById('ttcGrade').value || document.getElementById('ttcName').value,
    lunchBreak: document.getElementById('ttcLunch').value,
    arriveSecondPeriod: document.getElementById('ttcArrive2').checked,
    prepRequired: document.getElementById('ttcPrep').checked,
    sameFinish: document.getElementById('ttcSameFinish').checked,
    fixedClassTeacherTime: (fd && fp) ? fd + '@' + fp : '',
    timeOff: ttChecked('ttcTimeOff'),
    subjectIds: ttChecked('ttcSubject')
  }, form.dataset.editingId || null);
}
function ttRemoveClass(id) {
  const r = Timetable.removeClass(id);
  if (!r.ok) return toast(r.error, 'error');
  toast('Class removed.', 'info');
  renderTtClasses(); renderTtGrid(); fillTtSelects();
}

/* ---------- CLASSROOMS ---------- */
function renderTtRooms() {
  const tbody = document.getElementById('ttRoomsBody');
  if (!tbody) return;
  const items = Timetable.rooms();
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('ttRoomCount', items.length);
  tbody.innerHTML = items.length ? items.map(r => `
    <tr>
      <td><strong>${esc(r.name)}</strong><br><small style="color:var(--text-light)">${esc(r.shortName || '')}</small></td>
      <td>${r.capacity || '—'}</td>
      <td>${esc(r.type)}</td>
      <td>${esc(r.building || '—')}</td>
      <td>${(r.timeOff || []).map(p => Timetable.periodLabel(p)).join(', ') || '—'}</td>
      <td>${r.allowShared ? '<span class="badge badge-info">Shared allowed</span>' : '<span class="badge badge-navy">Exclusive</span>'}</td>
      <td class="table-actions">
        <button class="btn btn-xs btn-primary" onclick="ttManageRoomLessons('${r.id}')"><i class="fas fa-book-open"></i></button>
        <button class="btn btn-xs btn-outline" onclick="ttEditRoom('${r.id}')"><i class="fas fa-pen"></i></button>
        <button class="btn btn-xs btn-outline" onclick="Timetable.printRoom('${r.id}')"><i class="fas fa-print"></i></button>
        <button class="btn btn-xs btn-danger" onclick="ttRemoveRoom('${r.id}')"><i class="fas fa-trash"></i></button>
      </td>
    </tr>`).join('') : `<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text-light)">No classrooms yet.</td></tr>`;
}
function openTtRoom(id) {
  const form = document.getElementById('ttRoomForm');
  form.reset();
  delete form.dataset.editingId;
  document.getElementById('ttRoomTitle').textContent = id ? 'Edit Classroom' : 'New Classroom';
  document.getElementById('ttrTimeOff').innerHTML = ttPeriodChecks(id ? (Timetable.rooms().find(r => r.id === id) || {}).timeOff || [] : [], 'ttrTimeOff');
  if (id) {
    const r = Timetable.rooms().find(x => x.id === id);
    if (!r) return;
    form.dataset.editingId = id;
    document.getElementById('ttrName').value = r.name;
    document.getElementById('ttrShort').value = r.shortName || '';
    document.getElementById('ttrCap').value = r.capacity || '';
    document.getElementById('ttrType').value = r.type || '';
    document.getElementById('ttrBuilding').value = r.building || '';
    document.getElementById('ttrShared').checked = !!r.allowShared;
  }
  openModal('ttRoomModal');
}
function ttEditRoom(id) { openTtRoom(id); }
function collectTtRoom() {
  const form = document.getElementById('ttRoomForm');
  return Timetable.saveRoom({
    name: document.getElementById('ttrName').value,
    shortName: document.getElementById('ttrShort').value,
    capacity: document.getElementById('ttrCap').value,
    type: document.getElementById('ttrType').value,
    building: document.getElementById('ttrBuilding').value,
    allowShared: document.getElementById('ttrShared').checked,
    timeOff: ttChecked('ttrTimeOff')
  }, form.dataset.editingId || null);
}
function ttRemoveRoom(id) {
  const r = Timetable.removeRoom(id);
  if (!r.ok) return toast(r.error, 'error');
  toast('Classroom removed.', 'info');
  renderTtRooms(); renderTtGrid(); fillTtSelects();
}
function ttRemoveAllRooms() {
  const r = Timetable.removeAllRooms();
  if (!r.ok) return toast(r.error, 'error');
  toast(r.removed + ' classroom(s) removed.', 'info');
  renderTtRooms(); renderTtGrid();
}

/* ---------- TEACHERS ---------- */
function renderTtTeachers() {
  const tbody = document.getElementById('ttTeachersBody');
  if (!tbody) return;
  const items = Timetable.ttTeachers();
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('ttTeacherCount', items.length);
  tbody.innerHTML = items.length ? items.map(t => {
    const lessons = Timetable.entriesFor('teacher', t.id).length;
    return `
    <tr>
      <td><strong>${esc(t.name)}</strong><br><small style="color:var(--text-light)">${esc(t.shortName || '')}</small></td>
      <td>${(t.subjects || []).map(s => `<span class="badge badge-navy">${esc(s)}</span>`).join(' ') || '—'}</td>
      <td>${(t.classes || []).map(c => esc(c)).join(', ') || '—'}</td>
      <td>${t.minPerDay}–${t.maxPerDay}<br><small style="color:var(--text-light)">limit ${t.exhaustionLimit}/wk</small></td>
      <td>${(t.timeOff || []).map(p => Timetable.periodLabel(p)).join(', ') || '—'}</td>
      <td>${lessons ? `<span class="badge badge-success">${lessons} lessons</span>` : '<span class="badge badge-navy">0</span>'}</td>
      <td class="table-actions">
        <button class="btn btn-xs btn-primary" onclick="ttManageTeacherLessons('${t.id}')"><i class="fas fa-book-open"></i></button>
        <button class="btn btn-xs btn-outline" onclick="ttEditTeacher('${t.id}')"><i class="fas fa-pen"></i></button>
        <button class="btn btn-xs btn-outline" onclick="Timetable.printTeacher('${t.id}')"><i class="fas fa-print"></i></button>
        <button class="btn btn-xs btn-danger" onclick="ttRemoveTeacher('${t.id}')"><i class="fas fa-trash"></i></button>
      </td>
    </tr>`;
  }).join('') : `<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text-light)">No teachers — use "Import Teachers" to pull from staff records.</td></tr>`;
}
function openTtTeacher(id) {
  const form = document.getElementById('ttTeacherForm');
  form.reset();
  delete form.dataset.editingId;
  document.getElementById('ttTeacherTitle').textContent = id ? 'Edit Teacher' : 'New Teacher';
  document.getElementById('tttSubjects').innerHTML = Timetable.subjects().map(s => `<label style="display:inline-flex;align-items:center;gap:6px;padding:5px 9px;border:1px solid var(--border);border-radius:8px;font-size:0.82rem;background:var(--cream)"><input type="checkbox" name="tttSubject" value="${esc(s.name)}"> ${esc(s.name)}</label>`).join('');
  document.getElementById('tttClasses').innerHTML = Timetable.classes().map(c => `<label style="display:inline-flex;align-items:center;gap:6px;padding:5px 9px;border:1px solid var(--border);border-radius:8px;font-size:0.82rem;background:var(--cream)"><input type="checkbox" name="tttClass" value="${esc(c.name)}"> ${esc(c.name)}</label>`).join('');
  document.getElementById('tttTimeOff').innerHTML = ttPeriodChecks([], 'tttTimeOff');
  if (id) {
    const t = Timetable.ttTeachers().find(x => x.id === id);
    if (!t) return;
    form.dataset.editingId = id;
    const val = (i, v) => { const el = document.getElementById(i); if (el) el.value = v == null ? '' : v; };
    val('tttName', t.name); val('tttShort', t.shortName); val('tttCount', t.count);
    val('tttApproval', t.approvalStatus); val('tttWindows', t.maxWindows); val('tttDays', t.daysTaught);
    val('tttExhaust', t.exhaustionLimit); val('tttMin', t.minPerDay); val('tttMax', t.maxPerDay);
    val('tttMarking', t.maxQuestionMarking); val('tttFree', t.maxFreePerDay); val('tttHours', t.workingHours);
    val('tttClassTeacherOf', t.classTeacherOf);
    document.getElementById('tttNoThree').checked = !!t.noThreeFree;
    document.getElementById('tttTimeOff').innerHTML = ttPeriodChecks(t.timeOff || [], 'tttTimeOff');
    document.querySelectorAll('input[name="tttSubject"]').forEach(cb => cb.checked = (t.subjects || []).includes(cb.value));
    document.querySelectorAll('input[name="tttClass"]').forEach(cb => cb.checked = (t.classes || []).includes(cb.value));
  } else {
    document.getElementById('tttApproval').value = 'approved';
    document.getElementById('tttMax').value = 6;
    document.getElementById('tttMin').value = 1;
    document.getElementById('tttDays').value = 5;
    document.getElementById('tttExhaust').value = 24;
    document.getElementById('tttWindows').value = 4;
    document.getElementById('tttFree').value = 3;
    document.getElementById('tttNoThree').checked = true;
  }
  openModal('ttTeacherModal');
}
function ttEditTeacher(id) { openTtTeacher(id); }
function collectTtTeacher() {
  const form = document.getElementById('ttTeacherForm');
  const coSel = document.getElementById('tttClassTeacherOf');
  return Timetable.saveTeacher({
    name: document.getElementById('tttName').value,
    shortName: document.getElementById('tttShort').value,
    count: document.getElementById('tttCount').value,
    approvalStatus: document.getElementById('tttApproval').value,
    maxWindows: document.getElementById('tttWindows').value,
    daysTaught: document.getElementById('tttDays').value,
    exhaustionLimit: document.getElementById('tttExhaust').value,
    minPerDay: document.getElementById('tttMin').value,
    maxPerDay: document.getElementById('tttMax').value,
    maxQuestionMarking: document.getElementById('tttMarking').value,
    maxFreePerDay: document.getElementById('tttFree').value,
    noThreeFree: document.getElementById('tttNoThree').checked,
    workingHours: document.getElementById('tttHours').value,
    classTeacherOf: coSel ? coSel.value : '',
    subjects: ttChecked('tttSubject'),
    classes: ttChecked('tttClass'),
    timeOff: ttChecked('tttTimeOff')
  }, form.dataset.editingId || null);
}
function ttRemoveTeacher(id) {
  const r = Timetable.removeTeacher(id);
  if (!r.ok) return toast(r.error, 'error');
  toast('Teacher removed.', 'info');
  renderTtTeachers(); renderTtGrid(); fillTtSelects();
}

/* ---------- LESSON / TIME-OFF MANAGEMENT ---------- */
function ttManageLessons(classId) {
  const cls = Timetable.classes().find(c => c.id === classId);
  if (!cls) return;
  openLessonManager('class', cls.id, cls.name);
}
function ttManageRoomLessons(roomId) {
  const r = Timetable.rooms().find(x => x.id === roomId);
  if (!r) return;
  openLessonManager('room', r.id, r.name);
}
function ttManageTeacherLessons(teacherId) {
  const t = Timetable.ttTeachers().find(x => x.id === teacherId);
  if (!t) return;
  openLessonManager('teacher', t.id, t.name);
}

function openLessonManager(kind, id, name) {
  const body = document.getElementById('ttLessonManagerBody');
  if (!body) return;
  body.dataset.kind = kind; body.dataset.id = id;
  document.getElementById('ttLessonManagerTitle').textContent = 'Lessons — ' + name;
  renderLessonManager();
  openModal('ttLessonModal');
}
function renderLessonManager() {
  const body = document.getElementById('ttLessonManagerBody');
  if (!body) return;
  const kind = body.dataset.kind, id = body.dataset.id;
  const list = Timetable.entriesFor(kind, id).sort((a, b) => Timetable.days().indexOf(a.day) - Timetable.days().indexOf(b.day));
  const addBar = `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;align-items:flex-end">
      <div class="form-group" style="margin:0"><label>Day</label>
        <select id="lmDay">${Timetable.days().map(d => `<option>${d}</option>`).join('')}</select></div>
      <div class="form-group" style="margin:0"><label>Lesson</label>
        <select id="lmPeriod">${Timetable.lessonPeriods().map(p => `<option value="${p.id}">${esc(p.label)}</option>`).join('')}</select></div>
      <div class="form-group" style="margin:0"><label>Subject</label>
        <select id="lmSubject">${Timetable.subjects().map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></div>
      <button class="btn btn-primary btn-sm" onclick="lessonManagerAdd()"><i class="fas fa-plus"></i> Add Lesson</button>
      <button class="btn btn-outline btn-sm" onclick="Timetable.print${kind === 'class' ? 'Class' : kind === 'teacher' ? 'Teacher' : 'Room'}('${id}')"><i class="fas fa-print"></i> Print</button>
    </div>`;
  body.innerHTML = addBar + (list.length ? `<div class="table-wrap"><table class="data-table">
    <thead><tr><th>Day</th><th>Lesson</th><th>Subject</th><th>Teacher</th><th>Classroom</th><th></th></tr></thead>
    <tbody>${list.map(e => `<tr>
      <td>${esc(e.day)}</td><td>${esc(Timetable.periodLabel(e.slot))}</td><td><strong>${esc(e.subject)}</strong></td>
      <td>${esc(e.teacher || '—')}</td><td>${esc(e.room || '—')}</td>
      <td class="table-actions"><button class="btn btn-xs btn-danger" onclick="lessonManagerRemove('${e.id}')"><i class="fas fa-trash"></i></button></td>
    </tr>`).join('')}</tbody></table></div>`
    : `<div class="empty-state"><i class="fas fa-calendar"></i><h4>No lessons yet</h4><p>Add a lesson above or use automatic generation.</p></div>`) +
    `<div id="lmTimeOffBox" style="margin-top:18px;border-top:1px solid var(--border);padding-top:14px">
      <h4 style="color:var(--navy);margin-bottom:8px"><i class="fas fa-ban"></i> Time Off / Unavailable Lessons</h4>
      <div id="lmTimeOffChecks" style="display:flex;gap:8px;flex-wrap:wrap">${ttPeriodChecks(currentTimeOff(kind, id), 'lmTimeOff')}</div>
      <button class="btn btn-primary btn-sm" style="margin-top:10px" onclick="lessonManagerSaveTimeOff()"><i class="fas fa-floppy-disk"></i> Save Time Off</button>
    </div>`;
}
function currentTimeOff(kind, id) {
  if (kind === 'class') return (Timetable.classes().find(c => c.id === id) || {}).timeOff || [];
  if (kind === 'room') return (Timetable.rooms().find(r => r.id === id) || {}).timeOff || [];
  return (Timetable.ttTeachers().find(t => t.id === id) || {}).timeOff || [];
}
function lessonManagerAdd() {
  const body = document.getElementById('ttLessonManagerBody');
  const kind = body.dataset.kind, id = body.dataset.id;
  const subjectId = document.getElementById('lmSubject').value;
  const sub = Timetable.subjects().find(s => s.id === subjectId);
  if (!sub) return toast('Add subjects first.', 'error');
  let classId = '', grade = '', teacherId = '', teacher = '', roomId = '', room = '';
  if (kind === 'class') {
    const c = Timetable.classes().find(x => x.id === id);
    classId = id; grade = c ? c.name : '';
    const t = Timetable.ttTeachers().find(x => (x.subjects || []).includes(sub.name)) || Timetable.ttTeachers()[0];
    if (t) { teacherId = t.id; teacher = t.name; }
    const r = Timetable.rooms()[0];
    if (r) { roomId = r.id; room = r.name; }
  } else if (kind === 'teacher') {
    const t = Timetable.ttTeachers().find(x => x.id === id);
    teacherId = id; teacher = t ? t.name : '';
    const c = Timetable.classes()[0];
    if (c) { classId = c.id; grade = c.name; }
    const r = Timetable.rooms()[0];
    if (r) { roomId = r.id; room = r.name; }
  } else {
    const r = Timetable.rooms().find(x => x.id === id);
    roomId = id; room = r ? r.name : '';
    const c = Timetable.classes()[0];
    if (c) { classId = c.id; grade = c.name; }
    const t = Timetable.ttTeachers()[0];
    if (t) { teacherId = t.id; teacher = t.name; }
  }
  const res = Timetable.saveEntry({
    id: '', classId, grade, day: document.getElementById('lmDay').value,
    slot: document.getElementById('lmPeriod').value, subjectId, subject: sub.name,
    teacherId, teacher, roomId, room
  });
  if (!res.ok) return toast(res.error, 'error');
  toast('Lesson added.');
  renderLessonManager(); renderTtGrid(); renderTtTeachers();
}
function lessonManagerRemove(id) {
  const r = Timetable.removeEntry(id);
  if (!r.ok) return toast(r.error, 'error');
  toast('Lesson removed.', 'info');
  renderLessonManager(); renderTtGrid(); renderTtTeachers();
}
function lessonManagerSaveTimeOff() {
  const body = document.getElementById('ttLessonManagerBody');
  const kind = body.dataset.kind, id = body.dataset.id;
  const timeOff = ttChecked('lmTimeOff');
  let res;
  if (kind === 'class') {
    const c = Timetable.classes().find(x => x.id === id);
    res = Timetable.saveClass({ ...c, timeOff }, id);
  } else if (kind === 'room') {
    const r = Timetable.rooms().find(x => x.id === id);
    res = Timetable.saveRoom({ ...r, timeOff }, id);
  } else {
    const t = Timetable.ttTeachers().find(x => x.id === id);
    res = Timetable.saveTeacher({ ...t, timeOff }, id);
  }
  if (!res.ok) return toast(res.error, 'error');
  toast('Time off saved.');
  renderTtSubjects(); renderTtClasses(); renderTtRooms(); renderTtTeachers(); renderTtGrid();
}

/* ---------- GRID ---------- */
/* Plain-English version of the "DRAFT — NOT YET PUBLISHED" stamp used on printouts */
function ttDraftNote() {
  return `<div style="background:var(--warning-bg);color:var(--warning);padding:12px 14px;border-radius:8px;font-size:0.86rem;margin-bottom:12px;line-height:1.55">
    <strong><i class="fas fa-triangle-exclamation"></i> DRAFT — not yet published.</strong>
    This timetable is still being prepared, so only the secretary and leadership can see it and every printed copy is stamped
    <em>&ldquo;DRAFT — NOT YET PUBLISHED&rdquo;</em>. Press <strong>Publish</strong> to release it to teachers, students and parents;
    <strong>Unpublish</strong> pulls it back into draft.
  </div>`;
}

/* Which of the three views (Class / Teacher / Classroom) is active and what it is filtered to */
function ttGridScope() {
  const mode = _ttGridMode;
  const val = k => { const el = document.getElementById(k); return el ? el.value : ''; };
  if (mode === 'teacher') {
    const t = Timetable.ttTeachers().find(x => x.id === val('ttgTeacher'));
    return { mode, id: t ? t.id : '', label: t ? t.name : '' };
  }
  if (mode === 'room') {
    const r = Timetable.rooms().find(x => x.id === val('ttgRoom'));
    return { mode, id: r ? r.id : '', label: r ? r.name : '' };
  }
  const c = Timetable.classes().find(x => x.id === val('ttgClass'));
  return { mode: 'class', id: c ? c.id : '', label: c ? c.name : '' };
}

/* Whole-school fallback grid (a cell may hold several classes' lessons). */
function buildMultiGrid(rows, editable) {
  const cfg = Timetable.config();
  const head = '<tr><th class="tt-ref-corner"><span class="tt-ref-pn">Day</span></th>' + cfg.periods.map(p => p.kind === 'break'
    ? `<th class="tt-ref-break"><span class="tt-ref-pn">${esc(p.label)}</span><span class="tt-ref-pt">${esc(p.time || '')}</span></th>`
    : `<th><span class="tt-ref-pn">${esc(p.label)}</span><span class="tt-ref-pt">${esc(p.time || '')}</span></th>`).join('') + '</tr>';
  const body = cfg.days.map(day => {
    const tds = cfg.periods.map(p => {
      if (p.kind === 'break') return '<td class="tt-ref-breakcell"></td>';
      const list = rows.filter(e => e.day === day && e.slot === p.id);
      if (!list.length) return `<td class="tt-ref-empty">${editable ? `<button class="tt-ref-add" onclick="ttAddToCell('${day}','${p.id}')" title="Add lesson">+</button>` : ''}</td>`;
      return '<td class="tt-ref-cellwrap">' + list.map(e => `<div class="tt-ref-cell sm"><span class="tt-ref-sub">${esc(e.subject)}</span><span class="tt-ref-meta">${esc(e.className || e.grade || '')}${e.teacher ? ' · ' + esc(e.teacher) : ''}</span>${editable ? `<span class="tt-ref-btns"><button class="tt-ref-btn" onclick="ttEditEntry('${e.id}')" title="Adjust"><i class="fas fa-pen"></i></button><button class="tt-ref-btn danger" onclick="ttDeleteEntry('${e.id}')" title="Remove"><i class="fas fa-trash"></i></button></span>` : ''}</div>`).join('') + '</td>';
    }).join('');
    return `<tr><th class="tt-ref-day" title="${esc(day)}">${esc(Timetable.dayAbbr(day))}</th>${tds}</tr>`;
  }).join('');
  return `<div class="tt-ref-scroll"><table class="tt-ref"><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
}

function renderTtGrid() {
  const wrap = document.getElementById('ttFullGrid');
  if (!wrap) return;
  const cfg = Timetable.config();
  const canEdit = Perm.canManageTimetable();
  const pub = document.getElementById('ttPublishState');
  if (pub) pub.innerHTML = cfg.published
    ? '<span class="badge badge-success"><i class="fas fa-circle-check"></i> Published · v' + cfg.version + '</span>'
    : '<span class="badge badge-warning"><i class="fas fa-triangle-exclamation"></i> Draft — not published</span>';

  const emptyState = html => `<div class="empty-state"><i class="fas fa-calendar-days"></i>${html}</div>`;

  // read-only portals are promised "the published timetable" — never a draft
  if (!canEdit && !Timetable.isPublished()) {
    wrap.innerHTML = emptyState(`<h4>The timetable has not been published yet</h4>
      <p>The secretary is still preparing the official school timetable. It will appear here as soon as it is published.</p>`);
    return;
  }

  const scope = ttGridScope();
  // the secretary works on the live draft; every other role sees only published lessons
  const source = canEdit ? Timetable.entries() : Timetable.publishedEntries();
  let rows = source;
  if (scope.id) {
    if (scope.mode === 'class') rows = rows.filter(e => e.classId === scope.id || e.grade === scope.label || e.className === scope.label);
    else if (scope.mode === 'teacher') rows = rows.filter(e => e.teacherId === scope.id || e.teacher === scope.label);
    else rows = rows.filter(e => e.roomId === scope.id || e.room === scope.label);
  }
  const modeLabel = scope.mode === 'class' ? 'Class' : scope.mode === 'teacher' ? 'Teacher' : 'Classroom';
  const title = scope.label ? scope.label + ' — ' + modeLabel + ' Timetable' : 'Whole School Timetable';
  const note = cfg.published ? '' : ttDraftNote();

  const header = Timetable.gridHeaderHTML({
    title,
    meta: 'Academic Year ' + esc(String(Timetable.academicContext().academicYear)) + ' · Term ' + esc(String(Timetable.academicContext().term))
  });

  if (!rows.length) {
    wrap.innerHTML = header + note + (source.length
      ? emptyState(`<h4>Nothing scheduled here yet</h4>
          <p>No lesson matched <strong>${esc(scope.label || 'this view')}</strong>. Choose another ${esc(modeLabel.toLowerCase())}, switch back to &ldquo;All&rdquo;, or regenerate the timetable after checking subjects, teachers and classrooms.</p>`)
      : emptyState(`<h4>No lessons scheduled yet</h4>
          <p>Configure subjects, classes, classrooms and teachers, then press <strong>Generate Timetable</strong>.</p>`));
    return;
  }

  let grid;
  if (scope.id) {
    const secondary = scope.mode === 'class'
      ? (e => [e.teacher, e.room].filter(Boolean).join(' · '))
      : scope.mode === 'teacher'
        ? (e => [e.className || e.grade, e.room].filter(Boolean).join(' · '))
        : (e => [e.className || e.grade, e.teacher].filter(Boolean).join(' · '));
    grid = Timetable.buildGrid(rows, { editable: canEdit, secondary, onAdd: (d, p) => `ttAddToCell('${d}','${p}')` });
  } else {
    grid = buildMultiGrid(rows, canEdit);
  }

  wrap.innerHTML = `${header}${note}${grid}
    <p style="font-size:0.8rem;color:var(--text-light);margin-top:8px">${cfg.days.length} days · ${cfg.periods.filter(p => p.kind === 'lesson').length} lessons · ${rows.length} lesson(s) shown · ${cfg.published ? 'published v' + cfg.version : 'draft'}${canEdit ? '' : ' · read-only'}</p>`;
}

function ttGridMode(m) {
  _ttGridMode = m;
  document.querySelectorAll('[data-ttmode]').forEach(b => {
    const on = b.dataset.ttmode === m;
    b.classList.toggle('btn-primary', on);
    b.classList.toggle('btn-outline', !on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  document.querySelectorAll('[data-ttfilter]').forEach(el => el.style.display = (el.dataset.ttfilter === m ? '' : 'none'));
  renderTtGrid();
}
function ttAddToCell(day, slot) {
  const body = document.getElementById('ttEditEntryBody');
  if (!body) return;
  fillTtEntrySelects();
  body.dataset.entryId = '';
  document.getElementById('tteeTitle').textContent = 'Add Lesson';
  document.getElementById('tteeDay').value = day;
  document.getElementById('tteePeriod').value = slot;
  document.getElementById('tteeClass').innerHTML = '<option value="">—</option>' + Timetable.classes().map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  document.getElementById('tteeSubject').innerHTML = Timetable.subjects().map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
  document.getElementById('tteeTeacher').innerHTML = '<option value="">—</option>' + Timetable.ttTeachers().map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
  document.getElementById('tteeRoom').innerHTML = '<option value="">—</option>' + Timetable.rooms().map(r => `<option value="${r.id}">${esc(r.name)}</option>`).join('');
  document.getElementById('tteeNote').value = '';
  // carry the active Class / Teacher / Classroom filter into the form
  const scope = ttGridScope();
  const set = (id, v) => { const el = document.getElementById(id); if (el && v) el.value = v; };
  if (scope.mode === 'class') set('tteeClass', scope.id);
  else if (scope.mode === 'teacher') set('tteeTeacher', scope.id);
  else set('tteeRoom', scope.id);
  openModal('ttEditEntryModal');
}
function ttEditEntry(id) {
  const e = Timetable.entries().find(x => x.id === id);
  if (!e) return;
  ttAddToCell(e.day, e.slot);
  document.getElementById('ttEditEntryBody').dataset.entryId = id;
  document.getElementById('tteeTitle').textContent = 'Adjust Lesson';
  const idOf = (arr, name) => { const m = arr.find(x => x.name === name); return m ? m.id : ''; };
  const set = (i, v) => { const el = document.getElementById(i); if (el && v) el.value = v; };
  set('tteeClass', e.classId || idOf(Timetable.classes(), e.grade || e.className));
  set('tteeSubject', e.subjectId || idOf(Timetable.subjects(), e.subject));
  set('tteeTeacher', e.teacherId || idOf(Timetable.ttTeachers(), e.teacher));
  set('tteeRoom', e.roomId || idOf(Timetable.rooms(), e.room));
  set('tteeDay', e.day); set('tteePeriod', e.slot);
}
function ttSaveEntryFromModal() {
  const body = document.getElementById('ttEditEntryBody');
  const classId = document.getElementById('tteeClass').value;
  const subjectId = document.getElementById('tteeSubject').value;
  const teacherId = document.getElementById('tteeTeacher').value;
  const roomId = document.getElementById('tteeRoom').value;
  const sub = Timetable.subjects().find(s => s.id === subjectId);
  const cls = Timetable.classes().find(c => c.id === classId);
  const tch = Timetable.ttTeachers().find(t => t.id === teacherId);
  const rm = Timetable.rooms().find(r => r.id === roomId);
  const res = Timetable.saveEntry({
    id: body.dataset.entryId || '',
    classId, grade: cls ? cls.name : '',
    day: document.getElementById('tteeDay').value,
    slot: document.getElementById('tteePeriod').value,
    subjectId, subject: sub ? sub.name : '',
    teacherId, teacher: tch ? tch.name : '',
    roomId, room: rm ? rm.name : ''
  });
  if (!res.ok) return toast(res.error, 'error');
  toast('Timetable saved.');
  closeModal('ttEditEntryModal');
  renderTtGrid(); renderTtTeachers();
}
function ttDeleteEntry(id) {
  if (!confirm('Remove this lesson from the official timetable?')) return;
  const r = Timetable.removeEntry(id);
  if (!r.ok) return toast(r.error, 'error');
  toast('Lesson removed.', 'info');
  renderTtGrid(); renderTtTeachers();
}

/* ---------- GENERATE / PUBLISH / IMPORT ---------- */
function ttGenerate() {
  if (!Perm.canManageTimetable()) return toast('Only the secretary can generate the timetable.', 'error');
  const res = Timetable.generate();
  if (!res.ok) return toast(res.error, 'error');
  const box = document.getElementById('ttGenReport');
  if (box) box.innerHTML = `
    <div style="background:var(--success-bg);color:var(--success);padding:12px 14px;border-radius:8px;font-weight:600;margin-bottom:${res.warnings.length ? '10px' : '0'}">
      <i class="fas fa-circle-check"></i> ${res.placed} lesson(s) generated (version ${res.version}). Review, adjust, then publish.
    </div>
    ${res.warnings.length ? `<div style="background:var(--warning-bg);color:var(--warning);padding:12px 14px;border-radius:8px;font-size:0.86rem">
      <strong><i class="fas fa-triangle-exclamation"></i> ${res.warnings.length} warning(s) — impossible or conflicting constraints:</strong>
      <ul style="margin:6px 0 0 18px">${res.warnings.slice(0, 40).map(w => `<li>${esc(w)}</li>`).join('')}</ul></div>` : ''}`;
  toast('Timetable generated: ' + res.placed + ' lessons.');
  renderTtGrid(); renderTtTeachers(); renderTtClasses();
}
function ttPublish() {
  const res = Timetable.publish();
  if (!res.ok) return toast(res.error, 'error');
  toast('Official timetable published to teachers and students.');
  renderTtGrid();
}
function ttUnpublish() {
  const res = Timetable.unpublish();
  if (!res.ok) return toast(res.error, 'error');
  toast('Timetable unpublished.', 'info');
  renderTtGrid();
}
function ttClear() {
  const r = Timetable.clearAll();
  if (!r.ok) return toast(r.error, 'error');
  toast('Timetable cleared.', 'info');
  renderTtGrid(); renderTtTeachers();
}
function ttPrintScope() {
  const scope = ttGridScope();
  if (!scope.id) return Timetable.printAll();
  if (scope.mode === 'teacher') return Timetable.printTeacher(scope.id);
  if (scope.mode === 'room') return Timetable.printRoom(scope.id);
  return Timetable.printClass(scope.id);
}
/* Argument-free print handlers for the teacher / student portals — avoids
   injecting a user's name (which may contain an apostrophe) into an onclick. */
function ttPrintMyTimetable() {
  const s = Auth.session();
  if (!s) return;
  Timetable.printTeacherView(s.name);
}
function ttPrintMyClass() {
  const s = Auth.session();
  if (!s) return;
  const stu = (typeof studentForSession === 'function' ? studentForSession(s) : null) || {};
  Timetable.printClassView(stu.className || s.className || s.grade);
}
async function ttImport(kind, inputId) {
  const input = document.getElementById(inputId);
  if (!input || !input.files[0]) return toast('Choose a CSV file first.', 'error');
  let res;
  if (kind === 'subjects') res = await Timetable.importSubjects(input);
  else if (kind === 'teachers') res = await Timetable.importTeachers(input);
  else res = await Timetable.importRooms(input);
  if (!res.ok) return toast(res.error, 'error');
  toast((res.added || 0) + ' record(s) imported' + (res.skipped ? ', ' + res.skipped + ' skipped' : '') + '.');
  input.value = '';
  renderTtSubjects(); renderTtTeachers(); renderTtRooms(); renderTtClasses(); renderTtGrid(); fillTtSelects();
}
function ttExportSubjects() {
  const rows = Timetable.subjects().map(s => [s.name, s.shortName, s.count, (s.timeOff || []).join('|'), s.distribution, s.homeworkPrep ? 'Yes' : 'No', s.questionMarking ? 'Yes' : 'No']);
  if (!rows.length) return toast('Nothing to export.', 'info');
  downloadCSV('st-teresa-timetable-subjects.csv',
    ['Subject Name', 'Subject Short Name', 'Subject Count', 'Time Off', 'Lesson Distribution', 'Homework Preparation Required', 'Question Marking Required'], rows);
}
function ttExportTemplate(kind) {
  if (kind === 'subjects') downloadCSV('tt-subjects-template.csv',
    ['Subject Name', 'Subject Short Name', 'Subject Count', 'Time Off', 'Lesson Distribution', 'Homework Preparation Required', 'Question Marking Required'],
    [['Mathematics', 'MATH', 6, 'b1', 'spread', 'Yes', 'Yes']]);
  else if (kind === 'teachers') downloadCSV('tt-teachers-template.csv',
    ['Teacher Name', 'Teacher Short Name', 'Assigned Subjects', 'Assigned Classes', 'Time Off', 'Minimum Lessons Per Day', 'Maximum Lessons Per Day', 'Maximum Free Periods Per Day', 'Days Taught', 'Exhaustion Limit', 'Prevent Three Free Periods'],
    [['Mrs. Margaret OBrien', 'M. OBrien', 'Mathematics', 'Grade 1|Grade 2', '', 1, 6, 3, 5, 24, 'Yes']]);
  else downloadCSV('tt-classrooms-template.csv',
    ['Classroom Name', 'Short Name', 'Classroom Count', 'Classroom Type', 'Building or Location', 'Time Off', 'Allow Shared Use'],
    [['Lab 1', 'L1', 32, 'Laboratory', 'Science Block', '', 'No']]);
}

/* ---------- ROUTING HOOK ---------- */
window.onSectionOpen = (function (prev) {
  return function (section, anchor) {
    if (typeof prev === 'function') { try { prev(section, anchor); } catch (e) { console.error(e); } }
    try {
      if (section === 'tt-subjects') renderTtSubjects();
      if (section === 'tt-classes') renderTtClasses();
      if (section === 'tt-rooms') renderTtRooms();
      if (section === 'tt-teachers') renderTtTeachers();
      if (section === 'tt-grid') { fillTtSelects(); renderTtGrid(); }
      if (section === 'tt-settings') renderTtSettings();
      if (section === 'tt-archive') renderTtArchive();
    } catch (e) { console.error(e); }
  };
})(window.onSectionOpen);
