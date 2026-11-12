/* ============================================================
   ST. TERESA ACADEMY — ADMIN SYSTEM
   Data layer, auth, and all portal logic (localStorage based)
   ============================================================ */

const DB = {
  get(key, fallback = []) {
    try {
      const v = localStorage.getItem('sta_' + key);
      return v ? JSON.parse(v) : fallback;
    } catch (e) { return fallback; }
  },
  set(key, value) {
    localStorage.setItem('sta_' + key, JSON.stringify(value));
    if (window.SitePersist) window.SitePersist.schedule();
  },
  uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
};

/* ---------- SEED DEFAULT DATA ---------- */
const ACADEMIC_CLASSES = ['PP1', 'PP2', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9'];

/* The school's official classes and streams, used by Admin → Class Management.
   Kept in step with TT_DEFAULT_CLASSES in js/timetable.js. */
const OFFICIAL_CLASSES = [
  'PG X', 'PG Y', 'PG W',
  'PP1 X', 'PP1 Y', 'PP1 W',
  'PP2 X', 'PP2 Y', 'PP2 W',
  'Grade 1: Mt. Kenya', 'Grade 1: Mt. Ruwenzori', 'Grade 1: Mt. Kilimanjaro',
  'Grade 2: Mt. Kenya', 'Grade 2: Mt. Ruwenzori', 'Grade 2: Mt. Kilimanjaro',
  'Grade 3: Mt. Kenya', 'Grade 3: Mt. Ruwenzori', 'Grade 3: Mt. Kilimanjaro',
  'Grade 4: Mt. Kenya', 'Grade 4: Mt. Ruwenzori', 'Grade 4: Mt. Kilimanjaro',
  'Grade 5: Mt. Kenya', 'Grade 5: Mt. Ruwenzori', 'Grade 5: Mt. Kilimanjaro',
  'Grade 6: Mt. Kenya', 'Grade 6: Mt. Ruwenzori', 'Grade 6: Mt. Kilimanjaro',
  'Grade 7: Mwai Kibaki', 'Grade 7: Wangari Maathai',
  'Grade 8: Mwai Kibaki', 'Grade 8: Wangari Maathai',
  'Grade 9: Mwai Kibaki', 'Grade 9: Wangari Maathai'
];

/* Kindergarten 2026 teaching team. Each entry is added to staff + timetable
   teachers and the first teacher listed for a class becomes its class teacher. */
const KINDERGARTEN_TEACHERS = [
  { name: 'Emmah Wanjiru Ndonga', class: 'PG X' },
  { name: 'Irene Wambui Gachichio', class: 'PG X' },
  { name: 'Grace Wambui Gichuhi', class: 'PG Y' },
  { name: 'Pamela Muyoka Masinde', class: 'PG Y' },
  { name: 'Emmah Nyawira Maina', class: 'PP1 W' },
  { name: 'Purity Muthoni Kabiru', class: 'PP1 W' },
  { name: 'Jacinta Wanjiku Ngunyi', class: 'PP1 X' },
  { name: 'Lucy Wanjiru Miano', class: 'PP1 X' },
  { name: 'Veronicah Wangari Ndiritu', class: 'PP1 Y' },
  { name: 'Isabel Mumbi Macharia', class: 'PP1 Y' },
  { name: 'Tabitha Wamuyu Kariuki', class: 'PP2 W' },
  { name: 'Joyce Wairimu Nderitu', class: 'PP2 X' },
  { name: 'Grace Wanjiku Gitau', class: 'PP2 X' },
  { name: 'Laurisia Njeri Gacheru', class: 'PP2 Y' },
  { name: 'Emma Muthoni Muriuki', class: 'PP2 Y' }
];

/* Class teachers for Grades 1–9. The first name is the agreed class teacher
   label (e.g. "Tr. Eva"); each is added to staff and linked to the class. */
const PRIMARY_CLASS_TEACHERS = [
  { name: 'Tr. Eva', class: 'Grade 1: Mt. Kilimanjaro', level: 'Primary' },
  { name: 'Tr. Margaret', class: 'Grade 1: Mt. Kenya', level: 'Primary' },
  { name: 'Tr. Carol', class: 'Grade 1: Mt. Ruwenzori', level: 'Primary' },
  { name: 'Tr. Jacinta', class: 'Grade 2: Mt. Kilimanjaro', level: 'Primary' },
  { name: 'Tr. Gladwel', class: 'Grade 2: Mt. Kenya', level: 'Primary' },
  { name: 'Tr. Alice', class: 'Grade 2: Mt. Ruwenzori', level: 'Primary' },
  { name: 'Tr. Doris', class: 'Grade 3: Mt. Kilimanjaro', level: 'Primary' },
  { name: 'Tr. Eliza', class: 'Grade 3: Mt. Kenya', level: 'Primary' },
  { name: 'Tr. Mary', class: 'Grade 3: Mt. Ruwenzori', level: 'Primary' },
  { name: 'Tr. Elvis', class: 'Grade 4: Mt. Kilimanjaro', level: 'Primary' },
  { name: 'Tr. James', class: 'Grade 4: Mt. Kenya', level: 'Primary' },
  { name: 'Tr. Peris', class: 'Grade 4: Mt. Ruwenzori', level: 'Primary' },
  { name: 'Mr. Maina', class: 'Grade 5: Mt. Kilimanjaro', level: 'Primary' },
  { name: 'Tr. Fidelis', class: 'Grade 5: Mt. Kenya', level: 'Primary' },
  { name: 'Tr. Doreen', class: 'Grade 5: Mt. Ruwenzori', level: 'Primary' },
  { name: 'Mr. Macharia', class: 'Grade 6: Mt. Kilimanjaro', level: 'Primary' },
  { name: 'Tr. Dennis', class: 'Grade 6: Mt. Kenya', level: 'Primary' },
  { name: 'Tr. Emmanuel', class: 'Grade 6: Mt. Ruwenzori', level: 'Primary' },
  { name: 'Tr. Priscilla', class: 'Grade 7: Wangari Maathai', level: 'Junior Secondary' },
  { name: 'Mr. Kisaka', class: 'Grade 7: Mwai Kibaki', level: 'Junior Secondary' },
  { name: 'Tr. Lewis', class: 'Grade 8: Wangari Maathai', level: 'Junior Secondary' },
  { name: 'Tr. Gladys W', class: 'Grade 8: Mwai Kibaki', level: 'Junior Secondary' },
  { name: 'Tr. Korir', class: 'Grade 9: Wangari Maathai', level: 'Junior Secondary' },
  { name: 'Mrs. Mwangi', class: 'Grade 9: Mwai Kibaki', level: 'Junior Secondary' }
];
const DEFAULT_SUBJECTS = ['Mathematics', 'English', 'Kiswahili', 'Science', 'Social Studies', 'Religion', 'Art', 'Physical Education', 'Computer Science'];

const DEFAULT_ACCOUNTS = [
  { username: 'admin', password: 'admin123', role: 'admin', name: 'System Administrator', email: 'admin@stteresaacademy.edu' },
  { username: 'teacher', password: 'teacher123', role: 'teacher', name: 'Mrs. Margaret OBrien', email: 'mobrien@stteresaacademy.edu', subject: 'Mathematics' },
  { username: 'secretary', password: 'secretary123', role: 'secretary', name: 'Ms. Linda Vasquez', email: 'lvasquez@stteresaacademy.edu' },
  { username: 'student', password: 'student123', role: 'student', name: 'John Smith', email: 'jsmith@student.stteresa.edu', grade: 'Grade 10', className: 'Grade 9' },
  { username: 'headteacher', password: 'head123', role: 'headteacher', name: 'Sr. Catherine Marie', email: 'cmarie@stteresaacademy.edu' },
  { username: 'chiefexaminer', password: 'chief123', role: 'chiefexaminer', name: 'Mr. Anthony Rossi', email: 'arossi@stteresaacademy.edu', subject: 'Mathematics' },
  { username: 'storekeeper', password: 'store123', role: 'storekeeper', name: 'Mr. Peter Kamau', email: 'pkamau@stteresaacademy.edu' },
  { username: 'kitchenmanager', password: 'kitchen123', role: 'kitchenmanager', name: 'Ms. Grace Njeri', email: 'gnjeri@stteresaacademy.edu' },
    { username: 'uniformjunior', password: 'uniform123', role: 'storekeeper', name: 'Ms. Ruth Achieng', email: 'rachieng@stteresaacademy.edu', uniformDepts: ['junior_uniform'] },
    { username: 'uniformacademy', password: 'uniform123', role: 'storekeeper', name: 'Mr. Samuel Otieno', email: 'sotieno@stteresaacademy.edu', uniformDepts: ['academy_uniform'] }
];

function seedData() {
  if (!localStorage.getItem('sta_seeded')) {
    DB.set('users', DEFAULT_ACCOUNTS.map(a => ({ id: DB.uid(), ...a })));
    DB.set('students', [
      { id: DB.uid(), firstName: 'John', lastName: 'Smith', email: 'jsmith@student.stteresa.edu', grade: 'Grade 10', className: 'Grade 9', admissionNo: 'STA-2024-001', gender: 'Male', dob: '2010-05-14', parentName: 'Robert Smith', parentPhone: '(555) 201-8899', parentEmail: 'rsmith@parent.stteresa.edu', address: '42 Oak Lane, Fairfield, CT', admissionDate: '2024-08-20', status: 'active', feeBalance: 0, photo: '' },
      { id: DB.uid(), firstName: 'Emily', lastName: 'Johnson', email: 'ejohnson@student.stteresa.edu', grade: 'Grade 9', className: 'Grade 9', admissionNo: 'STA-2025-002', gender: 'Female', dob: '2011-03-22', parentName: 'Michael Johnson', parentPhone: '(555) 334-1122', parentEmail: 'mjohnson@parent.stteresa.edu', address: '18 Pine Road, Fairfield, CT', admissionDate: '2025-08-19', status: 'active', feeBalance: 12500, photo: '' }
    ]);
    DB.set('leadership', []);
    DB.set('teachers', [
      { id: DB.uid(), firstName: 'Margaret', lastName: 'OBrien', email: 'mobrien@stteresa.edu', subject: 'Mathematics', role: 'Teacher', phone: '(555) 100-2000', qualification: 'M.Ed.', status: 'active', photo: '', bio: 'M.Ed. with 28 years in Catholic education.', staffNo: 'STA-T001' },
      { id: DB.uid(), firstName: 'David', lastName: 'Chen', email: 'dchen@stteresa.edu', subject: 'Science', role: 'Teacher', phone: '(555) 100-2001', qualification: 'M.S. Engineering', status: 'active', photo: '', bio: 'M.S. in Engineering, inspiring innovators and problem-solvers.', staffNo: 'STA-T002' },
      { id: DB.uid(), firstName: 'Sarah', lastName: 'Williams', email: 'swilliams@stteresa.edu', subject: 'English', role: 'Teacher', phone: '(555) 100-2002', qualification: 'M.A. Literature', status: 'active', photo: '', bio: 'M.A. Literature, sparking a love of reading and writing.', staffNo: 'STA-T003' },
      { id: DB.uid(), firstName: 'Catherine Marie', lastName: 'Sr.', email: 'cmarie@stteresa.edu', subject: 'Religion', role: 'Campus Ministry', phone: '(555) 100-2003', qualification: 'Sister of St. Joseph', status: 'active', photo: '', bio: 'Sister of St. Joseph, guiding spiritual growth and service learning.', staffNo: 'STA-T004' },
      { id: DB.uid(), firstName: 'James', lastName: 'Whitfield', email: 'jwhitfield@stteresa.edu', subject: 'Physical Education', role: 'Athletic Director', phone: '(555) 100-2004', qualification: 'B.S. Kinesiology', status: 'active', photo: '', bio: 'Former college athlete building character through sports.', staffNo: 'STA-T005' },
      { id: DB.uid(), firstName: 'Thomas', lastName: 'Brennan', email: 'tbrennan@stteresa.edu', subject: 'Religion', role: 'Chaplain', phone: '(555) 100-2005', qualification: 'M.Div.', status: 'active', photo: '', bio: 'Pastor and spiritual father guiding our community in faith.', staffNo: 'STA-T006' },
      { id: DB.uid(), firstName: 'Anthony', lastName: 'Rossi', email: 'arossi@stteresa.edu', subject: 'Mathematics', role: 'Vice Principal, Academics', phone: '(555) 100-2006', qualification: 'M.A. Curriculum & Instruction', status: 'active', photo: '', bio: 'Championing rigorous and innovative learning.', staffNo: 'STA-T007' },
      { id: DB.uid(), firstName: 'Linda', lastName: 'Vasquez', email: 'lvasquez@stteresa.edu', subject: 'Administration', role: 'Director of Admissions', phone: '(555) 100-2007', qualification: 'M.B.A.', status: 'active', photo: '', bio: 'Welcoming families through the admissions journey.', staffNo: 'STA-T008' }
    ]);
    // seed the official classes (no class teacher assigned yet)
    const year = String(new Date().getFullYear());
    DB.set('classes', OFFICIAL_CLASSES.map((name, i) => ({
      id: DB.uid(), name, level: i + 1, academicYear: year, term: '1',
      teacherId: '', teacherName: '',
      subjects: DEFAULT_SUBJECTS.slice(),
      status: 'active', createdAt: today()
    })));
    DB.set('classAssignments', []);
    DB.set('homework', []);
    DB.set('homeworkSubmissions', []);
    DB.set('attendance', []);
    DB.set('materials', []);
    DB.set('announcements', []);
    DB.set('notifications', []);
    DB.set('auditLog', []);
    DB.set('parents', []);
    DB.set('examSchedule', []);
    DB.set('reportCards', []);
    DB.set('slider', [
      { id: DB.uid(), title: 'Welcome to St. Teresa Academy', description: 'Excellence in Catholic education since 1962', imageUrl: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1600&q=80' },
      { id: DB.uid(), title: 'Nurturing Young Minds', description: 'Pre-K through Grade 12 college preparatory programs', imageUrl: 'https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&w=1600&q=80' },
      { id: DB.uid(), title: 'Faith & Service', description: 'Forming leaders with hearts for others', imageUrl: 'https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=1600&q=80' }
    ]);
    DB.set('logo', { name: 'St. Teresa Kanyange Academy', initials: 'STK', imageUrl: '' });
    DB.set('timetable', []);
    DB.set('exams', []);
    DB.set('payments', [
      { id: DB.uid(), receiptNo: 'RCP-1001', studentName: 'John Smith', studentId: '', amount: 4200, item: 'Tuition Installment (Q1)', method: 'Card', date: '2026-09-05', recordedBy: 'secretary' },
      { id: DB.uid(), receiptNo: 'RCP-1002', studentName: 'Emily Johnson', studentId: '', amount: 300, item: 'Laboratory Fee', method: 'Cash', date: '2026-09-12', recordedBy: 'secretary' }
    ]);
    DB.set('settings', { schoolName: 'St. Teresa Kanyange Academy', motto: 'Unity is Strength', currency: 'Ksh', academicYear: year, term: '1', timezone: 'Africa/Nairobi' });
    localStorage.setItem('sta_seeded', '1');
  }
  // lightweight migration for databases seeded before these modules existed
  migrateSchoolModules();
  ensureDefaultAccounts();
}

/* Databases seeded by an older build may be missing accounts added later.
   This runs exactly ONCE per browser, so a catch-up pass can add accounts
   that older builds did not know about — after that the administrator owns
   the list and a deleted sample account stays deleted. */
function ensureDefaultAccounts() {
  if (localStorage.getItem('sta_accountsSeeded')) return;
  const users = DB.get('users');
  let changed = false;
  DEFAULT_ACCOUNTS.forEach(a => {
    if (users.some(u => u.username === a.username)) return;
    users.push({ id: DB.uid(), ...a });
    changed = true;
  });
  if (changed) DB.set('users', users);
  try { localStorage.setItem('sta_accountsSeeded', '1'); } catch (e) { /* storage full — retried next load */ }
}

function migrateSchoolModules() {
  const year = String(new Date().getFullYear());
  const ensure = (key, fallback) => { if (!localStorage.getItem('sta_' + key)) DB.set(key, fallback); };
  ensure('classes', OFFICIAL_CLASSES.map((name, i) => ({
    id: DB.uid(), name, level: i + 1, academicYear: year, term: '1',
    teacherId: '', teacherName: '', subjects: DEFAULT_SUBJECTS.slice(), status: 'active', createdAt: today()
  })));
  /* One-time reconcile the class list with the school's official streams.
     Legacy broad classes that are unused (no teacher, no students) are dropped;
     any legacy class still in use is kept. */
  if (!localStorage.getItem('sta_officialClassesSeeded')) {
    const students = DB.get('students');
    let list = DB.get('classes');
    list = list.filter(c => !(ACADEMIC_CLASSES.includes(c.name) && !c.teacherId &&
      !students.some(s => s.className === c.name && s.status === 'active')));
    const have = new Set(list.map(c => c.name));
    OFFICIAL_CLASSES.forEach((name, i) => {
      if (have.has(name)) return;
      list.push({
        id: DB.uid(), name, level: i + 1, academicYear: year, term: '1',
        teacherId: '', teacherName: '', subjects: DEFAULT_SUBJECTS.slice(),
        status: 'active', createdAt: today()
      });
    });
    DB.set('classes', list);
    try { localStorage.setItem('sta_officialClassesSeeded', '1'); } catch (e) { /* retried next load */ }
  }
  ensure('classAssignments', []);
  ensure('homework', []);
  ensure('homeworkSubmissions', []);
  ensure('attendance', []);
  ensure('materials', []);
  ensure('announcements', []);
  ensure('notifications', []);
  ensure('auditLog', []);
  ensure('parents', []);
  ensure('examSchedule', []);
  ensure('reportCards', []);
  ensure('exams', []);
  ensure('examResults', []);
  ensure('studentTransfers', []);
  // ---- new modules: timetable · approval workflow · procurement/inventory ----
  ensure('ttSubjects', []);
  ensure('ttClasses', []);
  ensure('ttClassrooms', []);
  ensure('ttTeachers', []);
  ensure('ttDivisions', []);
  ensure('ttConstraints', []);
  ensure('ttConfig', { days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], periods: [
    { id: 'p1', label: 'Lesson 1', time: '8:15–9:05', kind: 'lesson' },
    { id: 'p2', label: 'Lesson 2', time: '9:05–9:55', kind: 'lesson' },
    { id: 'p3', label: 'Lesson 3', time: '10:10–11:00', kind: 'lesson' },
    { id: 'b1', label: 'Break', time: '11:00–11:50', kind: 'break' },
    { id: 'p4', label: 'Lesson 4', time: '11:50–12:35', kind: 'lesson' },
    { id: 'p5', label: 'Lunch / Lesson 5', time: '12:35–1:25', kind: 'lesson' },
    { id: 'p6', label: 'Lesson 6', time: '1:25–2:15', kind: 'lesson' }
  ], published: false, version: 0, updatedAt: 0 });
  ensure('submissions', []);
  ensure('subCounters', {});
  ensure('invSuppliers', []);
  ensure('invItems', []);
  ensure('invMovements', []);
  ensure('invTransfers', []);
  ensure('invRequests', []);
  ensure('invOrders', []);
  ensure('invCounters', {});
  const st = DB.get('settings', {});
  if (!st.academicYear) { st.academicYear = year; st.term = st.term || '1'; }
  // older databases were seeded with a $ sign — switch them to Kenyan Shillings
  if (!st.currency || st.currency === '$') st.currency = 'Ksh';
  DB.set('settings', st);
  seedAcademicYears();
  /* ---------------------------------------------------------------
     PHOTO STORAGE MIGRATION
     Older builds stored passport photos as base64 data URLs inside the
     students array in localStorage. That hits the ~5MB quota and made
     admissions fail. Move them to IndexedDB, leaving a reference key.
     --------------------------------------------------------------- */
  migrateStudentPhotosToStore();
  migrateUniformAccountsIntoStores();
  // add className + admissionNo + photo fields to students that lack them
  const students = DB.get('students');
  let changed = false;
  students.forEach((s, i) => {
    if (!s.className) { s.className = s.grade ? (ACADEMIC_CLASSES.includes('Grade ' + s.grade) ? 'Grade ' + s.grade : s.grade) : 'Grade 1'; changed = true; }
    if (!s.admissionNo) { s.admissionNo = 'STA-' + (s.admissionDate || year).slice(0, 4) + '-' + String(i + 1).padStart(3, '0'); changed = true; }
    if (!('photo' in s)) { s.photo = ''; changed = true; }
    if (!('photoUpdatedAt' in s)) { s.photoUpdatedAt = 0; changed = true; }
    if (!('academicYear' in s)) { s.academicYear = String((s.admissionDate || year).slice(0, 4)); changed = true; }
    if (!('term' in s)) { s.term = st.term || '1'; changed = true; }
    if (!('previousSchool' in s)) { s.previousSchool = ''; changed = true; }
    if (!('parentRelationship' in s)) { s.parentRelationship = ''; changed = true; }
    if (!('parentAltPhone' in s)) { s.parentAltPhone = ''; changed = true; }
    if (!('emergencyContact' in s)) { s.emergencyContact = ''; changed = true; }
    if (!('medicalInfo' in s)) { s.medicalInfo = ''; changed = true; }
    if (!('remarks' in s)) { s.remarks = ''; changed = true; }
    if (!('category' in s)) { s.category = ''; changed = true; }
    if (!('guardian2Name' in s)) { s.guardian2Name = ''; changed = true; }
    if (!('guardian2Phone' in s)) { s.guardian2Phone = ''; changed = true; }
    if (!s.fullName) { s.fullName = ((s.firstName || '') + ' ' + (s.lastName || '')).trim(); changed = true; }
  });
  if (changed) DB.set('students', students);
  // link student login accounts to their student record (same id where possible)
  const users = DB.get('users');
  let uchanged = false;
  users.forEach(u => {
    if (u.role !== 'student') return;
    const rec = students.find(x => x.id === u.id) || students.find(x => x.email && x.email === u.email);
    if (rec && rec.id !== u.id) { u.id = rec.id; uchanged = true; }
    if (rec && rec.className && u.className !== rec.className) { u.className = rec.className; u.grade = rec.grade || rec.className; uchanged = true; }
    if (rec && rec.email && u.email !== rec.email) { u.email = rec.email; uchanged = true; }
  });
  if (uchanged) DB.set('users', users);
  seedKindergartenTeachers();
  seedPrimaryClassTeachers();
  removeParentPortalAccounts();
  ensureTeacherAccounts();
  normalizeExamData();
}

/* Add the Kindergarten 2026 teaching team to staff and timetable records and
   make the first teacher listed for each class its class teacher. Idempotent,
   so it is safe to run on every load and from the timetable portal too. */
function seedKindergartenTeachers() {
  const now = today();
  const staff = DB.get('teachers');
  const tt = DB.get('ttTeachers');
  const academicClasses = DB.get('classes');
  const ttClasses = DB.get('ttClasses');
  const leadByClass = {};
  let addedStaff = 0, addedTt = 0;

  KINDERGARTEN_TEACHERS.forEach((t, i) => {
    const parts = t.name.split(/\s+/);
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ');
    const staffNo = 'KGT-' + String(i + 1).padStart(3, '0');
    let rec = staff.find(s => teacherDisplayName(s).toLowerCase() === t.name.toLowerCase() || s.staffNo === staffNo);
    if (!rec) {
      const email = ((firstName + '.' + (parts[parts.length - 1] || '')).toLowerCase().replace(/[^a-z.]/g, '')) + '@stteresaacademy.edu';
      rec = {
        id: DB.uid(), firstName, lastName, email, subject: 'Kindergarten', role: 'Teacher',
        phone: '', qualification: '', status: 'active', photo: '', bio: '', staffNo
      };
      staff.push(rec);
      addedStaff++;
    }
    if (!leadByClass[t.class]) leadByClass[t.class] = { id: rec.id, name: t.name };

    if (!tt.some(x => String(x.name || '').toLowerCase() === t.name.toLowerCase())) {
      tt.push({
        id: DB.uid(), name: t.name,
        shortName: ((firstName[0] || '') + '. ' + (parts[parts.length - 1] || '')).trim(),
        count: 0, timeOff: [], classTeacherOf: '', approvalStatus: 'approved',
        maxWindows: 4, daysTaught: 5, exhaustionLimit: 24, minPerDay: 1, maxPerDay: 6,
        maxQuestionMarking: 60, maxFreePerDay: 3, noThreeFree: true,
        subjects: ['Kindergarten'], classes: [t.class],
        availability: {}, workingHours: '07:30–15:30', staffId: rec.id, createdAt: now
      });
      addedTt++;
    }
  });

  Object.keys(leadByClass).forEach(className => {
    const lead = leadByClass[className];
    const ac = academicClasses.find(c => c.name === className);
    if (ac && !ac.teacherId) { ac.teacherId = lead.id; ac.teacherName = lead.name; ac.assignmentDate = now; }
    const tc = ttClasses.find(c => c.name === className);
    if (tc && !tc.teacherId) { tc.teacherId = lead.id; tc.teacherName = lead.name; }
    const ttLead = tt.find(x => x.name === lead.name);
    if (ttLead && !ttLead.classTeacherOf) ttLead.classTeacherOf = className;
  });

  DB.set('teachers', staff);
  DB.set('ttTeachers', tt);
  DB.set('classes', academicClasses);
  DB.set('ttClasses', ttClasses);
  if (addedStaff || addedTt) {
    if (typeof Audit !== 'undefined') Audit.log('teachers.seed.kindergarten', addedStaff + ' staff and ' + addedTt + ' timetable teacher(s) added');
  }
  return { staff: addedStaff, timetable: addedTt };
}

/* Add the Grades 1–9 class teachers to staff and link each to their class in
   both the academic and timetable records. Idempotent; existing assignments
   made by the school are never overwritten. */
function seedPrimaryClassTeachers() {
  const now = today();
  const staff = DB.get('teachers');
  const tt = DB.get('ttTeachers');
  const academicClasses = DB.get('classes');
  const ttClasses = DB.get('ttClasses');
  let addedStaff = 0, addedTt = 0;

  PRIMARY_CLASS_TEACHERS.forEach((t, i) => {
    let rec = staff.find(s => teacherDisplayName(s).toLowerCase() === t.name.toLowerCase());
    if (!rec) {
      const email = t.name.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '') + '@stteresaacademy.edu';
      rec = {
        id: DB.uid(), firstName: t.name, lastName: '', email, subject: t.level, role: 'Teacher',
        phone: '', qualification: '', status: 'active', photo: '', bio: '',
        staffNo: 'CT-' + String(i + 1).padStart(3, '0')
      };
      staff.push(rec);
      addedStaff++;
    }

    const ac = academicClasses.find(c => c.name === t.class);
    if (ac && !ac.teacherId) { ac.teacherId = rec.id; ac.teacherName = t.name; ac.assignmentDate = now; }
    const tc = ttClasses.find(c => c.name === t.class);
    if (tc && !tc.teacherId) { tc.teacherId = rec.id; tc.teacherName = t.name; }

    let ttRec = tt.find(x => String(x.name || '').toLowerCase() === t.name.toLowerCase());
    if (!ttRec) {
      tt.push({
        id: DB.uid(), name: t.name,
        shortName: t.name,
        count: 0, timeOff: [], classTeacherOf: t.class, approvalStatus: 'approved',
        maxWindows: 4, daysTaught: 5, exhaustionLimit: 24, minPerDay: 1, maxPerDay: 6,
        maxQuestionMarking: 60, maxFreePerDay: 3, noThreeFree: true,
        subjects: [t.level], classes: [t.class],
        availability: {}, workingHours: '07:30–15:30', staffId: rec.id, createdAt: now
      });
      addedTt++;
    } else if (!ttRec.classTeacherOf) {
      ttRec.classTeacherOf = t.class;
    }
  });

  DB.set('teachers', staff);
  DB.set('ttTeachers', tt);
  DB.set('classes', academicClasses);
  DB.set('ttClasses', ttClasses);
  if (addedStaff || addedTt) {
    if (typeof Audit !== 'undefined') Audit.log('teachers.seed.primary', addedStaff + ' staff and ' + addedTt + ' timetable teacher(s) added');
  }
  return { staff: addedStaff, timetable: addedTt };
}

/* The parent portal has been retired: students use their own portal and the
   parent/guardian contact details stay on the student record. Remove any parent
   login accounts (including the old automatically-created ones) and the parent
   directory so nobody can sign in with a parent tab that no longer exists. */
function removeParentPortalAccounts() {
  const users = DB.get('users');
  const kept = users.filter(u => u.role !== 'parent');
  if (kept.length !== users.length) {
    DB.set('users', kept);
    if (typeof Audit !== 'undefined') Audit.log('accounts.parent.remove', (users.length - kept.length) + ' parent login account(s) removed');
  }
  if (DB.get('parents').length) DB.set('parents', []);
}

/* Give every teacher on the staff list a login account so the administrator
   can manage it (and reset its password) from Accounts & Security. Accounts
   are linked through teacher.accountId, so an account deleted on purpose is
   not recreated on the next load. */
function ensureTeacherAccounts() {
  const users = DB.get('users');
  const teachers = DB.get('teachers');
  const norm = s => String(s == null ? '' : s).toLowerCase()
    .replace(/\b(mr|mrs|ms|miss|tr|dr|fr|sr)\.?\b/g, ' ')
    .replace(/[^a-z0-9]/g, '');
  let added = 0;

  teachers.forEach(t => {
    if (t.accountId) return;
    const display = teacherDisplayName(t);
    const key = norm(display);
    const email = String(t.email || '').toLowerCase();
    let u = users.find(x => x.staffId && x.staffId === t.id) ||
            (key ? users.find(x => norm(x.name) === key) : null) ||
            (email ? users.find(x => String(x.email || '').toLowerCase() === email) : null);
    if (!u) {
      let base = (String(t.email || '').split('@')[0] || display).toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '.').replace(/^[._-]+|[._-]+$/g, '');
      if (!base) base = 'teacher';
      let username = base, n = 2;
      while (users.some(x => String(x.username || '').toLowerCase() === username.toLowerCase())) { username = base + n; n++; }
      u = {
        id: DB.uid(), username, password: 'teacher123', role: 'teacher', name: display,
        email: t.email || '', phone: t.phone || '', subject: t.subject || '',
        status: 'active', mustChangePassword: true, staffId: t.id,
        createdAt: new Date().toISOString()
      };
      users.push(u);
      added++;
    }
    t.accountId = u.id;
  });

  DB.set('users', users);
  DB.set('teachers', teachers);
  if (added && typeof Audit !== 'undefined') {
    Audit.log('accounts.teachers.seed', added + ' teacher account(s) created for password management');
  }
  return added;
}

/* ---------- EXAM DATA NORMALISATION (stable question/option IDs + answer keys) ----------
   Legacy exams stored `options: ['text', ...]` with `correct: <unfiltered index>`.
   Empty options were dropped AFTER the correct index was captured, so the stored
   answer key could point at the wrong option (or nothing at all) and automatic
   marking scored every answer 0. Questions are now normalised to stable option
   IDs and an explicit correctOptionId; invalid/missing keys are flagged for
   teacher review instead of silently scoring zero. */
function gradeKey(g) {
  return String(g == null ? '' : g).trim().toLowerCase().replace(/^grade\s*/, '');
}
function classNameForGrade(g) {
  const t = String(g == null ? '' : g).trim();
  if (!t) return '';
  if (/^grade/i.test(t)) return 'Grade ' + t.replace(/^grade\s*/i, '');
  if (/^(pp\d?|k|pre-?k)$/i.test(t)) return t.toUpperCase() === 'K' ? 'K' : (t.toLowerCase().startsWith('pre') ? 'Pre-K' : t.toUpperCase());
  return 'Grade ' + t;
}
function normalizeExamQuestion(raw, i) {
  const q = raw || {};
  const marks = Math.max(1, Number(q.marks || q.maxMarks || 1));
  const type = q.type === 'written' ? 'written' : 'mcq';
  const id = q.id || ('q' + (i + 1));
  let options = [];
  if (Array.isArray(q.options)) {
    options = q.options.map((o, oi) => (o && typeof o === 'object')
      ? { id: String(o.id || 'ABCD'[oi] || (oi + 1)), text: String(o.text == null ? '' : o.text).trim() }
      : { id: 'ABCD'[oi] || String(oi + 1), text: String(o == null ? '' : o).trim() });
  }
  let correctOptionId = String(q.correctOptionId || '');
  if (!correctOptionId && type === 'mcq') {
    const ci = Number(q.correct);
    if (Number.isInteger(ci) && ci >= 0 && ci < options.length) correctOptionId = options[ci].id;
  }
  // the key must point at an option that actually has text — otherwise treat it as missing
  if (correctOptionId) {
    const opt = options.find(o => o.id === correctOptionId);
    if (!opt || !opt.text) correctOptionId = '';
  }
  return { id, type, text: String(q.text || '').trim(), options, correctOptionId, marks };
}
function normalizeExamForUse(ex) {
  if (!ex) return null;
  const questions = (ex.questions || []).map((q, i) => normalizeExamQuestion(q, i));
  return Object.assign({}, ex, {
    questions,
    className: ex.className || classNameForGrade(ex.grade),
    totalMarks: questions.reduce((a, q) => a + q.marks, 0)
  });
}
function questionHasValidKey(q) {
  if (!q || q.type === 'written') return false;
  if (!q.correctOptionId) return false;
  const opt = (q.options || []).find(o => o.id === q.correctOptionId);
  return !!(opt && opt.text);
}
function examMaxMarks(ex) {
  return (ex && ex.questions ? ex.questions : []).reduce((a, q) => a + Math.max(1, Number((q && q.marks) || 1)), 0);
}
function examMatchesStudent(ex, student) {
  if (!ex || !student) return false;
  // transferred-out / withdrawn / archived / graduated students cannot sit new exams
  if (student.status && ['transferred_out', 'withdrawn', 'archived', 'graduated'].includes(student.status)) return false;
  const exClass = ex.className || classNameForGrade(ex.grade);
  if (exClass && gradeKey(exClass) === gradeKey(student.className)) return true;
  if (ex.grade != null && ex.grade !== '' && (gradeKey(ex.grade) === gradeKey(student.className) || gradeKey(ex.grade) === gradeKey(student.grade))) return true;
  return false;
}
function studentForSession(s) {
  if (!s) return {};
  return DB.get('students').find(x => x.id === s.id)
    || DB.get('students').find(x => x.email && x.email === s.email)
    || { id: s.id, firstName: String(s.name || '').split(' ')[0], lastName: String(s.name || '').split(' ').slice(1).join(' '), email: s.email || '', className: s.className || '', grade: s.grade || '', admissionNo: '' };
}
function normalizeExamData() {
  const exams = DB.get('exams');
  let changed = false;
  exams.forEach(ex => {
    const before = JSON.stringify({ q: ex.questions, c: ex.className, t: ex.totalMarks });
    ex.questions = (ex.questions || []).map((q, i) => normalizeExamQuestion(q, i));
    ex.className = ex.className || classNameForGrade(ex.grade);
    ex.totalMarks = examMaxMarks(ex);
    if (JSON.stringify({ q: ex.questions, c: ex.className, t: ex.totalMarks }) !== before) changed = true;
  });
  if (changed) DB.set('exams', exams);
  const results = DB.get('examResults');
  let rchanged = false;
  results.forEach(r => {
    const ex = exams.find(x => x.id === r.examId) || null;
    if (!r.markingStatus) {
      // legacy auto-scored attempt: treat as auto-marked; published only if the exam was published
      r.markingStatus = (ex && ex.resultsPublished) ? 'published' : 'auto_scored';
      if (r.markingStatus === 'published' && !r.publishedAt) r.publishedAt = r.date ? new Date(r.date).toISOString() : new Date().toISOString();
      rchanged = true;
    }
    if (!r.questionResponses && ex && r.answers) {
      // rebuild per-question responses from the legacy {questionIndex: optionIndex} map
      r.questionResponses = (ex.questions || []).map((q, i) => {
        const a = r.answers[i] != null ? r.answers[i] : r.answers[String(i)];
        const resp = {
          qid: q.id, type: q.type, text: q.text, maxMarks: q.marks,
          optionId: (q.type !== 'written' && Number.isInteger(Number(a)) && q.options[Number(a)]) ? q.options[Number(a)].id : '',
          answerText: q.type === 'written' ? String(a == null ? '' : a) : '',
          correctOptionId: q.correctOptionId || '', options: q.options || [],
          autoMarked: false, autoCorrect: null, needsTeacherReview: true,
          awardedMarks: null, comment: ''
        };
        if (q.type !== 'written' && questionHasValidKey(q) && resp.optionId) {
          resp.autoMarked = true;
          resp.autoCorrect = resp.optionId === q.correctOptionId;
          resp.awardedMarks = resp.autoCorrect ? q.marks : 0;
          resp.needsTeacherReview = false;
        }
        return resp;
      });
      r.maxMarks = examMaxMarks(ex);
      if (r.total != null && (r.score != null)) r.awardedLegacy = true;
      if (r.awardedMarks == null && r.questionResponses.every(x => x.awardedMarks != null)) {
        r.score = r.questionResponses.reduce((a, x) => a + x.awardedMarks, 0);
        r.percent = r.maxMarks ? Math.round((r.score / r.maxMarks) * 100) : 0;
      }
      if (r.markingStatus === 'auto_scored') r.markingStatus = r.questionResponses.some(x => x.awardedMarks == null) ? 'pending' : (ex && ex.resultsPublished ? 'published' : 'awaiting_approval');
      rchanged = true;
    }
    if (!r.markingHistory) { r.markingHistory = [{ at: r.submittedAt || r.date || today(), by: r.studentName || '', action: 'submitted', from: '', to: r.markingStatus, note: 'Migrated legacy submission record.' }]; rchanged = true; }
    if (!r.maxMarks) { r.maxMarks = r.total != null ? Number(r.total) : (ex ? examMaxMarks(ex) : 0); rchanged = true; }
  });
  if (rchanged) DB.set('examResults', results);
}
seedData();

/* ---------- UNIFIED IMAGE STORAGE (IndexedDB = no size/quota errors) ---------- */
const SITE_IMG_KEYS = ['aboutImage', 'campusImage', 'progEarly', 'progElem', 'progMiddle', 'ctaImage', 'favicon', 'logoImage'];

/* Upload to assets/ through upload.php. If the site is opened without PHP
   (for example from file:// or a plain static server), keep the old
   IndexedDB behaviour so images can still be managed. */
async function uploadOrStoreSiteImage(dataUrl, filename, localKey) {
  if (typeof ImageUpload !== 'undefined') {
    try {
      const result = await ImageUpload.uploadDataURL(dataUrl, filename);
      try { await ImageStore.del(localKey); } catch (e) { /* ignore */ }
      return { path: result.path, local: false };
    } catch (err) {
      if (!err || !err.fallback) throw err;
      toast('upload.php is unavailable, so this image was saved in browser storage. Serve the site with PHP to save into assets/.', 'info');
    }
  }
  await ImageStore.put(localKey, dataUrl);
  return { path: '', local: true };
}

async function saveSiteImageValue(key, value) {
  if (!value) { await deleteSiteImageValue(key); return ''; }
  /* Uploads are written to the project's assets/ folder by upload.php.
     Only the returned path is stored in the database. */
  if (String(value).startsWith('data:')) {
    const stored = await uploadOrStoreSiteImage(value, key + '.jpg', key);
    if (stored.local) {
      localStorage.removeItem('sta_' + key);
      return value;
    }
    DB.set(key, stored.path);
    return stored.path;
  }
  // External URL or an already-saved asset path.
  try { await ImageStore.del(key); } catch (e) { /* ignore */ }
  DB.set(key, value);
  return value;
}

async function getSiteImageValue(key) {
  try {
    const idb = await ImageStore.get(key);
    if (idb) return idb;
  } catch (e) { /* ignore */ }
  const value = DB.get(key, null);
  if (value && typeof ImageUpload !== 'undefined') return ImageUpload.assetURL(value);
  return value;
}

/* Resolve a stored asset path for display inside the admin panel. */
function siteAssetURL(path) {
  if (!path) return '';
  return typeof ImageUpload !== 'undefined' ? ImageUpload.assetURL(path) : path;
}

async function deleteSiteImageValue(key) {
  try { await ImageStore.del(key); } catch (e) { /* ignore */ }
  localStorage.removeItem('sta_' + key);
}

async function migrateLegacyImages() {
  // move any old localStorage data-URLs into IndexedDB
  for (const k of SITE_IMG_KEYS) {
    const raw = localStorage.getItem('sta_' + k);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'string' && parsed.startsWith('data:')) {
        await ImageStore.put(k, parsed);
        localStorage.removeItem('sta_' + k);
      }
    } catch (e) { /* ignore */ }
  }
  // legacy programImages object
  const piRaw = localStorage.getItem('sta_programImages');
  if (piRaw) {
    try {
      const obj = JSON.parse(piRaw);
      if (obj.early) await ImageStore.put('progEarly', obj.early);
      if (obj.elementary) await ImageStore.put('progElem', obj.elementary);
      if (obj.middlehigh) await ImageStore.put('progMiddle', obj.middlehigh);
      localStorage.removeItem('sta_programImages');
    } catch (e) { /* ignore */ }
  }
  // legacy logo.imageUrl inside sta_logo
  const lgRaw = localStorage.getItem('sta_logo');
  if (lgRaw) {
    try {
      const obj = JSON.parse(lgRaw);
      if (obj.imageUrl && String(obj.imageUrl).startsWith('data:')) {
        await ImageStore.put('logoImage', obj.imageUrl);
        obj.imageUrl = '';
        localStorage.setItem('sta_logo', JSON.stringify(obj));
      }
    } catch (e) { /* ignore */ }
  }
  // ensure leadership store exists
  if (!localStorage.getItem('sta_leadership')) DB.set('leadership', []);
}

/* ============================================================
   STUDENT PASSPORT PHOTO STORAGE
   Photos used to be stored as base64 data URLs inside the students
   array in localStorage. localStorage is capped at roughly 5MB per
   origin, so once a handful of students had photos every further
   save threw QuotaExceededError — and because the student record was
   written AFTER the login account was created, a failed upload left
   an orphaned account and a half-admitted student.

   Photos now live in IndexedDB (no practical size limit). The student
   record only keeps a safe reference key, never the image bytes.
   ============================================================ */
const PhotoStore = {
  PREFIX: 'stu_photo_',
  _cache: new Map(),
  _ready: null,

  keyFor(studentId) { return this.PREFIX + studentId; },

  /* Load every stored photo into memory once, so photoUrl() can stay
     synchronous and every existing <img> render keeps working. */
  init() {
    if (this._ready) return this._ready;
    this._ready = (async () => {
      try {
        const found = await ImageStore.getPrefixed(this.PREFIX);
        Object.keys(found).forEach(k => { if (found[k]) this._cache.set(k, found[k]); });
      } catch (e) { /* IndexedDB unavailable — photos simply will not display */ }
      return true;
    })();
    return this._ready;
  },

  async put(studentId, dataUrl) {
    const key = this.keyFor(studentId);
    try {
      await ImageStore.put(key, dataUrl);
    } catch (e) {
      return { ok: false, error: 'Could not store the photograph. ' + (e.message || 'Storage is full or unavailable.') };
    }
    this._cache.set(key, dataUrl);
    return { ok: true, key };
  },

  get(studentId) { return this._cache.get(this.keyFor(studentId)) || ''; },

  async del(studentId) {
    const key = this.keyFor(studentId);
    this._cache.delete(key);
    try { await ImageStore.del(key); } catch (e) { /* ignore */ }
  },

  /* Resolve a student record to a displayable URL (synchronous). */
  url(st) {
    if (!st) return '';
    if (st.photoKey) {
      const cached = this._cache.get(st.photoKey);
      if (cached) return cached;
    }
    /* legacy records still carry an inline data URL */
    if (st.photo && String(st.photo).startsWith('data:')) return st.photo;
    return st.photo || '';
  }
};

/* ============================================================
   UNIFORMS → STORES
   Uniform stock is managed from the Stores portal, so the separate
   `uniformstaff` role is retired. Existing accounts are folded into
   `storekeeper` once, keeping their name, e-mail and assigned depts.
   ============================================================ */
function migrateUniformAccountsIntoStores() {
  const users = DB.get('users');
  if (!Array.isArray(users) || !users.length) return;
  let changed = false;
  users.forEach(u => {
    if (u.role !== 'uniformstaff') return;
    u.role = 'storekeeper';
    u.foldedFromUniformStaff = true;
    changed = true;
  });
  if (changed) {
    DB.set('users', users);
    if (typeof Audit !== 'undefined') Audit.log('accounts.uniformFold', 'Uniform staff accounts folded into the Stores role');
    console.info('Uniform staff accounts folded into the Stores role.');
  }
}

/* Move any legacy inline base64 photos into IndexedDB, once. */
async function migrateStudentPhotosToStore() {
  const students = DB.get('students');
  if (!Array.isArray(students) || !students.length) return;
  let changed = false;
  for (const s of students) {
    if (s.photoKey) { PhotoStore._cache.set(s.photoKey, s.photo); continue; }
    if (s.photo && String(s.photo).startsWith('data:')) {
      const res = await PhotoStore.put(s.id, s.photo);
      if (res.ok) {
        s.photoKey = res.key;
        s.photo = '';                 /* reference only — never the bytes */
        s.photoUpdatedAt = s.photoUpdatedAt || Date.now();
        changed = true;
      }
    } else if (!('photoKey' in s)) {
      s.photoKey = '';
      changed = true;
    }
  }
  if (changed) {
    try { DB.set('students', students); }
    catch (e) { console.error('Student photo migration could not be saved:', e); }
  }
}

/* ============================================================
   ACADEMIC YEARS SEEDING
   Creates previous / current / next year the first time the school
   database is opened, then never touches the list again.
   ============================================================ */
function seedAcademicYears() {
  if (!localStorage.getItem('sta_academicYears')) DB.set('academicYears', []);
  const items = DB.get('academicYears');
  if (!Array.isArray(items)) { DB.set('academicYears', []); return; }
  if (items.length) {
    /* a list already exists — just make sure settings points at a real record */
    const st = DB.get('settings', {});
    if (!st.academicYearId || !items.some(y => y.id === st.academicYearId)) {
      const match = items.find(y => String(y.label) === String(st.academicYear)) || items.find(y => y.status === 'active');
      if (match) { st.academicYearId = match.id; st.academicYear = String(match.label); DB.set('settings', st); }
    }
    return;
  }
  const st = DB.get('settings', {});
  const current = String(st.academicYear || new Date().getFullYear());
  const labels = [String(Number(current) - 1), current, String(Number(current) + 1)];
  const now = new Date().toISOString();
  const seeded = labels.map(label => ({
    id: DB.uid(),
    label,
    startDate: label + '-01-01',
    endDate: label + '-12-31',
    terms: [1, 2, 3],
    defaultTerm: 1,
    status: 'active',
    notes: '',
    createdAt: now,
    updatedAt: now
  }));
  DB.set('academicYears', seeded);
  const cur = seeded.find(y => y.label === current) || seeded[1];
  st.academicYearId = cur.id;
  st.academicYear = cur.label;
  if (!st.term) st.term = '1';
  DB.set('settings', st);
}

/* ---------- LEADERSHIP DATA LAYER (enforces slot limits) ---------- */
const Leadership = {
  POSITIONS: [
    { key: 'director1', label: 'Director 1', type: 'director', max: 2 },
    { key: 'director2', label: 'Director 2', type: 'director', max: 2 },
    { key: 'headteacher', label: 'Headteacher', type: 'headteacher', max: 1 }
  ],
  list() { return DB.get('leadership'); },
  byPosition(pos) { return this.list().find(x => x.position === pos); },
  labelFor(pos) {
    const p = this.POSITIONS.find(x => x.key === pos);
    return p ? p.label : pos;
  },
  validate(data, editingId) {
    const items = this.list();
    const pos = data.position;
    const meta = this.POSITIONS.find(p => p.key === pos);
    if (!meta) return 'Invalid leadership position.';
    if (!data.name || !data.name.trim()) return 'Leader name is required.';
    const occupied = items.find(x => x.position === pos && x.id !== editingId);
    if (occupied) {
      if (pos === 'headteacher') return 'Headteacher position is already occupied. Edit or replace the existing Headteacher instead.';
      return meta.label + ' position is already occupied. Edit or replace the existing leader instead.';
    }
    const directors = items.filter(x => (x.position === 'director1' || x.position === 'director2') && x.id !== editingId);
    if (meta.type === 'director' && directors.length >= 2) {
      return 'Maximum of 2 Directors allowed. Replace an existing Director instead.';
    }
    const heads = items.filter(x => x.position === 'headteacher' && x.id !== editingId);
    if (meta.type === 'headteacher' && heads.length >= 1) {
      return 'Only one Headteacher is allowed. Replace the existing Headteacher instead.';
    }
    return null;
  },
  save(data, editingId) {
    const err = this.validate(data, editingId);
    if (err) return { ok: false, error: err };
    const items = this.list();
    if (editingId) {
      const i = items.findIndex(x => x.id === editingId);
      if (i === -1) return { ok: false, error: 'Leader not found.' };
      items[i] = { ...items[i], ...data, updatedAt: today() };
    } else {
      items.push({ id: DB.uid(), ...data, createdAt: today() });
    }
    DB.set('leadership', items);
    return { ok: true };
  },
  remove(id) {
    DB.set('leadership', this.list().filter(x => x.id !== id));
    return { ok: true };
  }
};

/* ---------- AUTH ---------- */
const Auth = {
  MIN_PASSWORD: 8,
  /* Is the security module available? (script load order guard) */
  _sec() { return (typeof Security !== 'undefined') ? Security : null; },
  _saveSession(s) { sessionStorage.setItem('sta_session', JSON.stringify(s)); },
  destroySession() { sessionStorage.removeItem('sta_session'); },

  /* Verify a candidate password against a user record.
     Supports hashed records and (temporarily) legacy plain-text ones. */
  async _checkPassword(u, password) {
    const sec = this._sec();
    if (!u) return false;
    if (sec && typeof u.passwordHash === 'string') return sec.verify(password, u.passwordHash);
    /* legacy plain-text record — compare then upgrade immediately */
    if (typeof u.password === 'string') {
      const ok = u.password === String(password == null ? '' : password);
      if (ok && sec) await sec.upgradeLegacyPassword(u, password);
      return ok;
    }
    return false;
  },

  /* Sign in. Returns { ok, user, error }. Never reveals which half failed. */
  async login(username, password, portalRole) {
    const uname = String(username == null ? '' : username).trim();
    const pw = String(password == null ? '' : password);
    const users = DB.get('users');
    const u = users.find(x => x.username === uname);
    if (!u) { await this._dummyHash(); return { ok: false, error: 'Invalid username or password. Please try again.' }; }
    if (!(await this._checkPassword(u, pw))) {
      if (typeof Audit !== 'undefined') Audit.log('auth.login.fail', 'Failed sign-in for ' + uname);
      return { ok: false, error: 'Invalid username or password. Please try again.' };
    }
    /* Password correct, so it is safe to explain why the sign-in still cannot
       proceed — a disabled account never leaks its existence to a stranger. */
    if (u.status === 'disabled') {
      if (typeof Audit !== 'undefined') Audit.log('auth.login.disabled', 'Disabled account sign-in blocked: ' + uname);
      return { ok: false, disabled: true, error: 'This account has been disabled. Contact the administrator to have it reactivated.' };
    }
    if (typeof Audit !== 'undefined') Audit.log('auth.login.success', 'Signed in: ' + uname + ' (' + u.role + ')');

    const sec = this._sec();
    /* a temporary password that has timed out can no longer be used */
    if (u.mustChangePassword && sec && sec.tempPasswordExpired(u)) {
      return { ok: false, expired: true, error: 'This temporary password has expired. Ask an administrator to issue you a new one.' };
    }
    /* the stored account is the authority — the selected tab grants nothing */
    if (portalRole && u.role !== portalRole) {
      return { ok: false, roleMismatch: true, error: 'These credentials belong to a different portal. Please select the correct portal tab and try again.' };
    }

    const s = {
      id: u.id, role: u.role, name: u.name, username: u.username,
      email: u.email || '', phone: u.phone || '', subject: u.subject || '',
      grade: u.grade || '', photo: u.photo || '',
      mustChangePassword: !!u.mustChangePassword,
      sessionToken: (sec ? (u.sessionToken || sec.newToken()) : null),
      csrfToken: (sec ? (u.csrfToken || sec.newToken()) : null),
      issuedAt: new Date().toISOString()
    };
    /* persist freshly minted tokens so the record and the session agree */
    if (sec && (!u.sessionToken || !u.csrfToken)) {
      const list = DB.get('users');
      const i = list.findIndex(x => x.id === u.id);
      if (i !== -1) { list[i].sessionToken = s.sessionToken; list[i].csrfToken = s.csrfToken; DB.set('users', list); }
    }
    this._saveSession(s);
    return { ok: true, user: u, session: s };
  },

  /* Equalises timing between an unknown username and a wrong password. */
  async _dummyHash() {
    const sec = this._sec();
    if (sec) { try { await sec.hash('timing-equaliser-' + Date.now()); } catch (e) {} }
  },

  /* live record check — the stored account decides, never the login tab */
  mustChangePassword() {
    const s = this.session();
    if (!s) return false;
    if (s.mustChangePassword) return true;
    const u = DB.get('users').find(x => x.id === s.id);
    return !!(u && u.mustChangePassword);
  },
  /* True once a temporary password has outlived its validity window. */
  tempPasswordExpired() {
    const sec = this._sec();
    if (!sec) return false;
    const s = this.session();
    if (!s) return false;
    const u = DB.get('users').find(x => x.id === s.id);
    return sec.tempPasswordExpired(u);
  },

  /* Change your own password. Requires the CURRENT password — including on
     the mandatory first-login screen, where the current one is the temporary. */
  async changePassword(currentPassword, newPassword) {
    const s = this.session();
    if (!s) return { ok: false, error: 'Please sign in again.' };
    const users = DB.get('users');
    const i = users.findIndex(x => x.id === s.id);
    if (i === -1) return { ok: false, error: 'Account not found.' };
    const u = users[i];

    const cur = String(currentPassword == null ? '' : currentPassword);
    const nxt = String(newPassword == null ? '' : newPassword).trim();
    if (!cur) return { ok: false, error: 'Please enter your current password.' };
    if (!(await this._checkPassword(u, cur))) {
      if (typeof Audit !== 'undefined') Audit.log('auth.password.change.fail', 'Wrong current password for ' + u.username);
      return { ok: false, error: 'Your current password is not correct.' };
    }
    const sec = this._sec();
    if (sec && sec.tempPasswordExpired(u) && u.mustChangePassword) {
      return { ok: false, expired: true, error: 'This temporary password has expired. Ask an administrator to issue you a new one.' };
    }
    if (sec) {
      const problem = sec.validateNewPassword(nxt);
      if (problem) return { ok: false, error: problem };
      if (await sec.verify(nxt, u.passwordHash)) return { ok: false, error: 'Your new password must be different from your current password.' };
      users[i].passwordHash = await sec.hash(nxt);
      delete users[i].password;
    } else {
      if (nxt.length < this.MIN_PASSWORD) return { ok: false, error: 'Your new password must be at least ' + this.MIN_PASSWORD + ' characters long.' };
      users[i].password = nxt;
    }
    delete users[i].mustChangePassword;
    delete users[i].tempPasswordExpiresAt;
    users[i].passwordChangedAt = new Date().toISOString();
    users[i].failedLoginCount = 0;
    /* rotate the session token so any other outstanding session dies */
    if (sec) { users[i].sessionToken = sec.newToken(); users[i].csrfToken = sec.newToken(); }
    DB.set('users', users);

    const next = { ...s, mustChangePassword: false };
    if (sec) { next.sessionToken = users[i].sessionToken; next.csrfToken = users[i].csrfToken; }
    this._saveSession(next);
    if (typeof Audit !== 'undefined') Audit.log('auth.password.change', 'Password changed for ' + u.username + ' (' + u.role + ')');
    return { ok: true };
  },

  /* CSRF token for state-changing forms. */
  csrfToken() {
    const s = this.session();
    return (s && s.csrfToken) || '';
  },
  verifyCsrf(token) {
    const s = this.session();
    if (!s || !s.csrfToken) return true;           /* module absent → no-op */
    return String(token || '') === String(s.csrfToken);
  },
  changePasswordUrl() {
    return window.location.pathname.includes('/admin/') ? 'password.html' : '../admin/password.html';
  },
  logout() {
    /* invalidate the server-side copy of the token too, not just this tab */
    const s = this.session();
    if (s) {
      const users = DB.get('users');
      const i = users.findIndex(x => x.id === s.id);
      if (i !== -1) { users[i].sessionToken = null; users[i].csrfToken = null; DB.set('users', users); }
      if (typeof Audit !== 'undefined') Audit.log('auth.logout', 'Signed out: ' + (s.username || s.id));
    }
    this.destroySession();
    // always land back on the shared login page (works from every portal folder)
    window.location.href = Auth.loginUrl();
  },
  loginUrl() {
    // from any portal subfolder → ../admin/login.html ; from the admin folder → login.html
    return window.location.pathname.includes('/admin/') ? 'login.html' : '../admin/login.html';
  },
  /* Read the session AND re-validate it against the stored account on every
     call: a password reset elsewhere, or a role change, kills it instantly. */
  session() {
    let s = null;
    try { s = JSON.parse(sessionStorage.getItem('sta_session')); } catch (e) { s = null; }
    if (!s || !s.id) return null;
    const users = DB.get('users');
    const u = users.find(x => x.id === s.id);
    if (!u || !u.sessionToken) {
      /* never issued (legacy record) → mint one; deliberately cleared → kill it */
      if (!u) { this.destroySession(); return null; }
      if (u.sessionToken === undefined && typeof Security !== 'undefined') {
        const i = users.findIndex(x => x.id === s.id);
        users[i].sessionToken = Security.newToken();
        users[i].csrfToken = Security.newToken();
        DB.set('users', users);
        s.sessionToken = users[i].sessionToken;
        s.csrfToken = users[i].csrfToken;
      } else { this.destroySession(); return null; }
    } else if (s.sessionToken !== u.sessionToken) {
      this.destroySession(); return null;
    }
    /* keep the cached copy in step with the live record */
    const live = {
      role: u.role, name: u.name, email: u.email || '', phone: u.phone || '',
      subject: u.subject || '', grade: u.grade || '', photo: u.photo || '',
      username: u.username, mustChangePassword: !!u.mustChangePassword
    };
    let dirty = false;
    for (const k in live) { if (s[k] !== live[k]) { s[k] = live[k]; dirty = true; } }
    if (dirty) this._saveSession(s);
    return s;
  },
  require(roles) {
    const s = this.session();
    if (!s) { window.location.href = Auth.loginUrl(); return null; }
    const onChangePage = window.location.pathname.includes('/admin/password.html');
    /* no bypass: any account flagged must-change is funnelled to the
       change-password screen, and an expired temporary password is refused. */
    if (this.tempPasswordExpired()) {
      if (onChangePage) return s;            /* let that page show the expiry notice */
      window.location.href = Auth.changePasswordUrl(); return null;
    }
    if (this.mustChangePassword() && !onChangePage) {
      window.location.href = Auth.changePasswordUrl();
      return null;
    }
    if (roles && !roles.includes(s.role)) { window.location.href = Auth.loginUrl(); return null; }
    return s;
  },
  redirectFor(role) {
    if (role === 'admin' || role === 'director') return '../admin/dashboard.html';
    if (role === 'headteacher') return '../headteacher/dashboard.html';
    if (role === 'chiefexaminer') return '../chiefexaminer/dashboard.html';
    if (role === 'teacher') return '../teacher/dashboard.html';
    if (role === 'secretary') return '../secretary/dashboard.html';
    if (role === 'storekeeper' || role === 'uniformstaff') return '../store/dashboard.html';
    if (role === 'kitchenmanager') return '../kitchen/dashboard.html';
    if (role === 'student') return '../student/dashboard.html';
    return 'login.html';
  }
};

/* ---------- TOASTS ---------- */
function toast(msg, type = 'success') {
  let c = document.querySelector('.toast-container');
  if (!c) { c = document.createElement('div'); c.className = 'toast-container'; document.body.appendChild(c); }
  const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info' };
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(40px)'; setTimeout(() => t.remove(), 300); }, 3200);
}

/* ---------- MODAL ---------- */
function openModal(id) { const m = document.getElementById(id); if (m) m.classList.add('show'); }
function closeModal(id) { const m = document.getElementById(id); if (m) m.classList.remove('show'); }
document.addEventListener('click', e => {
  if (e.target.classList && e.target.classList.contains('modal-overlay')) e.target.classList.remove('show');
});
/* Sidebar "Logout" links point straight at login.html, which would leave a
   live session token behind. Route them through Auth.logout() instead. */
document.addEventListener('click', e => {
  const a = e.target && e.target.closest && e.target.closest('.sidebar-footer a[href*="login.html"]');
  if (!a) return;
  e.preventDefault();
  Auth.logout();
});

/* ---------- HELPERS ---------- */
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function today() { return new Date().toISOString().slice(0, 10); }
function fmtDate(d) { if (!d) return '—'; const dt = new Date(d); return isNaN(dt) ? d : dt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); }
function money(n) {
  const cur = DB.get('settings', {}).currency;
  const sym = (!cur || cur === '$') ? 'Ksh' : cur;
  return sym + ' ' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function initials(name) { return String(name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase(); }

/* ---------- CSV / IMPORT / EXPORT HELPERS ---------- */
function csvEscape(v) {
  const s = String(v == null ? '' : v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function toCSV(headers, rows) {
  return [headers.map(csvEscape).join(',')].concat(rows.map(r => r.map(csvEscape).join(','))).join('\r\n');
}
function downloadCSV(filename, headers, rows) {
  const blob = new Blob(['\ufeff' + toCSV(headers, rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function parseCSV(text) {
  const rows = []; let row = []; let cur = ''; let q = false;
  const s = String(text || '').replace(/^\ufeff/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(c => String(c).trim() !== ''));
}
function readTextFile(file) {
  return new Promise((res, rej) => {
    if (!file) { rej(new Error('No file selected.')); return; }
    const r = new FileReader();
    r.onload = () => res(String(r.result || ''));
    r.onerror = () => rej(new Error('Could not read the file.'));
    r.readAsText(file);
  });
}
/* read a CSV <input type=file>, return rows (first row = header) */
async function readCSVInput(input) {
  const f = input && input.files && input.files[0];
  if (!f) return null;
  const rows = parseCSV(await readTextFile(f));
  if (rows.length < 2) return { error: 'The file must contain a header row and at least one data row.' };
  const header = rows[0].map(h => String(h).trim().toLowerCase().replace(/\s+/g, ''));
  return { header, rows: rows.slice(1) };
}
function csvPick(header, row, ...names) {
  for (const n of names) { const i = header.indexOf(n.toLowerCase()); if (i > -1) return String(row[i] == null ? '' : row[i]).trim(); }
  return '';
}
function csvBool(header, row, ...names) {
  const v = csvPick(header, row, ...names).toLowerCase();
  return ['yes', 'y', 'true', '1', 'on'].includes(v);
}
function csvList(header, row, ...names) {
  const v = csvPick(header, row, ...names);
  return v ? v.split(/[;|]/).map(x => x.trim()).filter(Boolean) : [];
}

/* ============================================================
   LOGIN PAGE
   ============================================================ */
const LOGIN_ROLE_USERNAMES = {
  admin: 'admin', headteacher: 'headteacher', chiefexaminer: 'chiefexaminer',
  secretary: 'secretary', teacher: 'teacher', storekeeper: 'storekeeper',
  kitchenmanager: 'kitchenmanager', student: 'student'
};
const ROLE_LABELS = {
  admin: 'Admin', headteacher: 'Headteacher', chiefexaminer: 'Chief Examiner',
  secretary: 'Secretary', teacher: 'Teacher', storekeeper: 'Stores',
  kitchenmanager: 'Kitchen', student: 'Student', uniformstaff: 'Uniforms'
};

/* Roles an administrator may grant when creating or editing an account.
   There is no parent login: parent/guardian details are kept on the student
   record only, and students use their own portal.
   - Uniform staff is absent: uniforms are managed inside the Stores portal,
     so there is a single stock-keeping account rather than three. */
const ACCOUNT_ROLES = ['admin', 'headteacher', 'chiefexaminer', 'secretary', 'teacher', 'storekeeper', 'kitchenmanager', 'student'];

/* ============================================================
   ACCOUNTS — administrator-only user management
   Create · edit · enable/disable · reset password · delete
   Duplicate usernames and e-mail addresses are refused here rather
   than at the point of login, so the list stays clean.
   ============================================================ */
const Accounts = {
  list() { return DB.get('users'); },
  get(id) { return this.list().find(u => u.id === id) || null; },
  byUsername(name) {
    const n = String(name == null ? '' : name).trim().toLowerCase();
    return this.list().find(u => String(u.username).toLowerCase() === n) || null;
  },
  byEmail(email) {
    const e = String(email == null ? '' : email).trim().toLowerCase();
    if (!e) return null;
    return this.list().find(u => String(u.email || '').toLowerCase() === e) || null;
  },

  /* Every account that collides with another on username or e-mail.
     Returns [{ field, value, accounts:[...] }, …] — used by the UI to flag
     problems that were introduced by direct edits or old seeds. */
  findDuplicates() {
    const out = [];
    const byKey = (field, pick) => {
      const map = new Map();
      this.list().forEach(u => {
        const k = String(pick(u) || '').trim().toLowerCase();
        if (!k) return;
        if (!map.has(k)) map.set(k, []);
        map.get(k).push(u);
      });
      map.forEach((arr, k) => { if (arr.length > 1) out.push({ field, value: k, accounts: arr }); });
    };
    byKey('username', u => u.username);
    byKey('email', u => u.email);
    return out;
  },

  /* Admin-only gate used by every mutator below. */
  _guard() {
    const s = Auth.session();
    if (!s || s.role !== 'admin') return { ok: false, error: 'Only the administrator can manage accounts.' };
    return null;
  },

  validate(data, editingId) {
    const username = String(data.username == null ? '' : data.username).trim();
    const name = String(data.name == null ? '' : data.name).trim();
    const role = String(data.role == null ? '' : data.role);
    const email = String(data.email == null ? '' : data.email).trim();

    if (!name) return 'Full name is required.';
    if (!username) return 'Username is required.';
    if (!/^[a-z0-9._-]{3,32}$/i.test(username)) return 'Username must be 3–32 characters and may only contain letters, numbers, dot, underscore or hyphen.';
    if (!ACCOUNT_ROLES.includes(role)) return 'Choose a valid role.';
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'That e-mail address is not valid.';

    const userDup = this.byUsername(username);
    if (userDup && userDup.id !== editingId) return 'Username "' + username + '" is already in use by ' + (userDup.name || userDup.username) + '. Choose another.';
    const mailDup = this.byEmail(email);
    if (mailDup && mailDup.id !== editingId) return 'E-mail ' + email + ' is already used by ' + (mailDup.name || mailDup.username) + '. Accounts must have their own address.';
    return null;
  },

  /* ---------- create ---------- */
  async create(data) {
    const g = this._guard(); if (g) return g;
    const err = this.validate(data, null);
    if (err) return { ok: false, error: err };
    if (!Security) return { ok: false, error: 'Security module unavailable.' };
    const res = await Security.createAccount({
      username: String(data.username).trim(),
      role: String(data.role),
      name: String(data.name).trim(),
      email: String(data.email == null ? '' : data.email).trim(),
      phone: String(data.phone == null ? '' : data.phone).trim(),
      subject: data.subject || ''
    });
    if (res.ok) Audit.log('account.create', 'Created account ' + res.user.username + ' (' + res.user.role + ')');
    return res;
  },

  /* ---------- edit profile / role / status ---------- */
  update(id, data) {
    const g = this._guard(); if (g) return g;
    const users = this.list();
    const i = users.findIndex(u => u.id === id);
    if (i === -1) return { ok: false, error: 'Account not found.' };
    const err = this.validate({ ...users[i], ...data }, id);
    if (err) return { ok: false, error: err };
    const session = Auth.session();
    const nextRole = data.role != null ? data.role : users[i].role;
    const nextStatus = data.status != null ? data.status : (users[i].status || 'active');

    /* never let the administrator lock every administrator out */
    if (users[i].role === 'admin' && (nextRole !== 'admin' || nextStatus === 'disabled')) {
      const admins = users.filter(u => u.role === 'admin' && (u.status || 'active') !== 'disabled');
      if (admins.length <= 1) return { ok: false, error: 'This is the only active administrator. Promote another account to Admin before changing this one.' };
    }
    if (session && session.id === id && (nextRole !== 'admin' || nextStatus === 'disabled')) {
      return { ok: false, error: 'You cannot change your own role or disable your own account.' };
    }

    ['name', 'email', 'phone', 'subject'].forEach(k => { if (k in data) users[i][k] = String(data[k] == null ? '' : data[k]).trim(); });
    if ('username' in data) users[i].username = String(data.username).trim();
    users[i].role = nextRole;
    users[i].status = nextStatus === 'disabled' ? 'disabled' : 'active';
    users[i].updatedAt = new Date().toISOString();
    DB.set('users', users);

    /* a role or status change takes effect immediately, even mid-session */
    if (session && session.id === id) Auth._saveSession({ ...session, role: users[i].role, name: users[i].name, email: users[i].email });

    Audit.log('account.update', 'Updated ' + users[i].username + ' → role ' + users[i].role + ', status ' + users[i].status);
    return { ok: true, user: users[i] };
  },

  /* ---------- enable / disable ---------- */
  setStatus(id, status) {
    const g = this._guard(); if (g) return g;
    if (status !== 'active' && status !== 'disabled') return { ok: false, error: 'Invalid status.' };
    return this.update(id, { status });
  },

  /* ---------- reset password ---------- */
  async resetPassword(id, reason) {
    const g = this._guard(); if (g) return g;
    const u = this.get(id);
    if (!u) return { ok: false, error: 'Account not found.' };
    return Security.issueTemporaryPassword(id, reason || 'Administrator reset');
  },

  /* ---------- delete ---------- */
  remove(id) {
    const g = this._guard(); if (g) return g;
    const users = this.list();
    const i = users.findIndex(u => u.id === id);
    if (i === -1) return { ok: false, error: 'Account not found.' };
    const target = users[i];
    const session = Auth.session();
    if (session && session.id === id) return { ok: false, error: 'You cannot delete the account you are signed in with.' };
    if (target.role === 'admin' && users.filter(u => u.role === 'admin' && (u.status || 'active') !== 'disabled').length <= 1) {
      return { ok: false, error: 'The last active administrator cannot be deleted.' };
    }
    users.splice(i, 1);
    DB.set('users', users);
    Audit.log('account.delete', 'Deleted account ' + target.username + ' (' + target.role + ')');
    return { ok: true, removed: target };
  },

  /* ---------- listing helpers for the UI ---------- */
  query(opts) {
    const o = opts || {};
    let rows = this.list().slice();
    const dupes = this.findDuplicates();
    const dupIds = new Set();
    dupes.forEach(d => d.accounts.forEach(a => dupIds.add(a.id)));

    if (o.role) rows = rows.filter(u => u.role === o.role);
    if (o.status === 'active') rows = rows.filter(u => (u.status || 'active') === 'active');
    if (o.status === 'disabled') rows = rows.filter(u => u.status === 'disabled');
    if (o.status === 'flagged') rows = rows.filter(u => dupIds.has(u.id));
    if (o.status === 'mustChange') rows = rows.filter(u => !!u.mustChangePassword);
    const q = String(o.search || '').trim().toLowerCase();
    if (q) {
      rows = rows.filter(u => [u.username, u.name, u.email, u.role, ROLE_LABELS[u.role] || u.role]
        .some(v => String(v || '').toLowerCase().includes(q)));
    }
    const sortKey = o.sort || 'username';
    rows.sort((a, b) => {
      const av = String(sortKey === 'name' ? (a.name || '') : a.username || '').toLowerCase();
      const bv = String(sortKey === 'name' ? (b.name || '') : b.username || '').toLowerCase();
      return av.localeCompare(bv);
    });
    const perPage = Math.max(5, Number(o.perPage) || 8);
    const page = Math.max(1, Number(o.page) || 1);
    const pages = Math.max(1, Math.ceil(rows.length / perPage));
    return {
      rows: rows.slice((page - 1) * perPage, page * perPage),
      total: rows.length, page: Math.min(page, pages), pages, perPage,
      duplicates: dupes,
      flaggedIds: dupIds,
      counts: {
        total: this.list().length,
        active: this.list().filter(u => (u.status || 'active') === 'active').length,
        disabled: this.list().filter(u => u.status === 'disabled').length,
        mustChange: this.list().filter(u => !!u.mustChangePassword).length,
        flagged: dupIds.size
      }
    };
  }
};

function initLogin() {
  const tabs = document.querySelectorAll('.role-tab');
  const form = document.getElementById('loginForm');
  const err = document.getElementById('loginError');
  const uname = document.getElementById('username');
  const pass = document.getElementById('password');
  let role = 'admin';

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-pressed', 'false'); });
      tab.classList.add('active');
      tab.setAttribute('aria-pressed', 'true');
      role = tab.dataset.role;
      // convenience prefill of the account name only — never a password
      uname.value = LOGIN_ROLE_USERNAMES[role] || '';
      pass.value = '';
      err.classList.remove('show');
    });
  });

  // preselect from query
  const params = new URLSearchParams(window.location.search);
  const preset = params.get('role');
  if (preset) {
    const t = document.querySelector(`.role-tab[data-role="${preset}"]`);
    if (t) t.click();
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const u = uname.value.trim();
    const p = pass.value;
    const btn = form.querySelector('.login-btn');
    if (btn) { btn.disabled = true; btn.dataset.label = btn.innerHTML; btn.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i>&nbsp; Signing in…'; }
    // the stored account is the authority — the selected tab alone grants nothing
    const res = await Auth.login(u, p, role);
    if (btn) { btn.disabled = false; if (btn.dataset.label) btn.innerHTML = btn.dataset.label; }
    pass.value = '';
    if (!res.ok) {
      err.textContent = res.error || 'Invalid username or password. Please try again.';
      err.classList.add('show');
      if (res.expired) toast('Your temporary password has expired.', 'error');
      return;
    }
    const user = res.user;
    err.classList.remove('show');
    if (user.mustChangePassword) {
      toast('You must set a new password before continuing.');
      setTimeout(() => { window.location.href = Auth.changePasswordUrl(); }, 600);
      return;
    }
    toast('Welcome back, ' + user.name + '!');
    setTimeout(() => { window.location.href = Auth.redirectFor(user.role); }, 600);
  });
}

/* ============================================================
   CHANGE PASSWORD (required after first login on a new account)
   ============================================================ */
function initChangePassword() {
  const s = Auth.session();
  if (!s) { window.location.href = Auth.loginUrl(); return; }
  const err = document.getElementById('changeError');
  const show = m => { if (err) { err.textContent = m; err.classList.add('show'); } };
  const setName = document.getElementById('changeName');
  const setRole = document.getElementById('changeRole');
  if (setName) setName.textContent = s.name || s.username;
  if (setRole) setRole.textContent = ROLE_LABELS[s.role] || s.role;

  const currentField = document.getElementById('currentPassword');
  const currentWrap = document.getElementById('currentPasswordGroup');
  const hint = document.getElementById('changeHint');
  const banner = document.getElementById('tempBanner');
  const isTemporary = !!s.mustChangePassword;

  /* explain which password is being asked for, and warn once it has lapsed */
  if (currentWrap && !isTemporary) currentWrap.style.display = 'none';
  if (hint) {
    hint.innerHTML = isTemporary
      ? 'First-time sign-in. Enter the <strong>temporary password</strong> you were given as your current password, then choose a new one of your own.'
      : 'Enter your current password, then choose a new one. You will be asked for the new password next time you sign in.';
  }
  if (banner) {
    if (isTemporary && Auth.tempPasswordExpired()) {
      banner.className = 'change-banner danger';
      banner.innerHTML = '<i class="fas fa-triangle-exclamation" aria-hidden="true"></i> This temporary password has expired. You cannot change your password with it — ask an administrator to issue you a new one. <button type="button" class="link-btn" id="bannerSignOut">Sign out</button>';
      const form0 = document.getElementById('changeForm'); if (form0) form0.style.display = 'none';
      const c0 = document.getElementById('bannerSignOut');
      if (c0) c0.addEventListener('click', ev => { ev.preventDefault(); Auth.logout(); });
    } else if (isTemporary) {
      const hrs = (typeof Security !== 'undefined') ? Security.TEMP_PASSWORD_TTL_HOURS : 72;
      banner.className = 'change-banner warn';
      banner.innerHTML = '<i class="fas fa-key" aria-hidden="true"></i> You are signing in with a temporary password. It expires in ' + hrs + ' hours, so set your own password now.';
    } else {
      banner.className = 'change-banner';
      banner.innerHTML = '<i class="fas fa-shield-halved" aria-hidden="true"></i> For your security, confirm your current password before setting a new one.';
    }
  }

  const pw = document.getElementById('newPassword');
  const meter = document.getElementById('pwMeter');
  const meterTxt = document.getElementById('pwMeterText');
  const scoreOf = v => {
    if (!v) return -1;
    let n = 0;
    if (v.length >= 8) n++;
    if (v.length >= 12) n++;
    if (/[A-Za-z]/.test(v) && /[0-9]/.test(v)) n++;
    if (/[^A-Za-z0-9]/.test(v)) n++;
    if (v.length >= 16) n++;
    return Math.min(n, 4);
  };
  const labels = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];
  const classes = ['bad', 'bad', 'warn', 'ok', 'ok'];
  if (pw && meter) {
    pw.addEventListener('input', () => {
      const v = pw.value, n = scoreOf(v);
      meter.className = 'pw-meter';
      if (n < 0) { meterTxt.textContent = 'At least ' + ((typeof Security !== 'undefined') ? Security.MIN_PASSWORD : 8) + ' characters, one letter and one number.'; meterTxt.className = 'pw-meter-text'; return; }
      meter.classList.add('on');
      meter.setAttribute('data-score', n);
      meter.style.setProperty('--pct', ((n + 1) / 5 * 100) + '%');
      meterTxt.textContent = labels[n];
      meterTxt.className = 'pw-meter-text ' + classes[n];
    });
  }

  const form = document.getElementById('changeForm');
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const cur = currentField ? currentField.value : '';
    const p1 = document.getElementById('newPassword').value;
    const p2 = document.getElementById('confirmPassword').value;
    if (err) err.classList.remove('show');
    if (isTemporary && !cur) return show('Please enter the temporary password you were given.');
    if (!isTemporary && !cur) return show('Please enter your current password.');
    if (p1 !== p2) return show('The two passwords do not match.');
    if (p1 === cur) return show('Your new password must be different from your current password.');
    const btn = form.querySelector('[type="submit"]');
    if (btn) { btn.disabled = true; btn.dataset.label = btn.innerHTML; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating…'; }
    const r = await Auth.changePassword(cur, p1);
    if (btn) { btn.disabled = false; if (btn.dataset.label) btn.innerHTML = btn.dataset.label; }
    if (!r.ok) return show(r.error);
    if (currentField) currentField.value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmPassword').value = '';
    toast('Password updated. Welcome aboard, ' + (s.name || '') + '!');
    setTimeout(() => { window.location.href = Auth.redirectFor(s.role); }, 700);
  });
  const cancel = document.getElementById('changeCancel');
  if (cancel) cancel.addEventListener('click', e => { e.preventDefault(); Auth.logout(); });
}

/* ============================================================
   ADMIN DASHBOARD
   ============================================================ */
function initAdmin() {
  const s = Auth.require(['admin', 'headteacher', 'director']);
  if (!s) return;
  renderTopbarUser(s);
  initSidebar();
  migrateLegacyImages().then(bootAdmin).catch(bootAdmin);
}

function bootAdmin() {
  loadAdminDashboard();
  initSliderSection();
  initLogoSection();
  initStudentsSection();
  initLeadershipSection();
  initTeachersSection();
  initTimetableSection();
  initPOS();
  // school-management modules (defined in modules.js)
  if (typeof initAcademicSettingsSection === 'function') initAcademicSettingsSection();
  if (typeof initClassesSection === 'function') initClassesSection();
  if (typeof initHomeworkAdminSection === 'function') initHomeworkAdminSection();
  if (typeof initAttendanceAdminSection === 'function') initAttendanceAdminSection();
  if (typeof initExamScheduleSection === 'function') initExamScheduleSection();
  if (typeof initMaterialsAdminSection === 'function') initMaterialsAdminSection();
  if (typeof initAnnouncementsSection === 'function') initAnnouncementsSection();
  if (typeof initNotificationsSection === 'function') initNotificationsSection();
  if (typeof initAuditSection === 'function') initAuditSection();
  if (typeof initAdminExamResultsSection === 'function') initAdminExamResultsSection();
  // approval workflow monitor (approvals.js) — renders when its section opens
  if (typeof window.onSectionOpen === 'function') { try { window.onSectionOpen('approvals-monitor', null); } catch (err) { console.error(err); } }
}

function renderTopbarUser(s) {
  const el = document.getElementById('userChip');
  if (el) el.innerHTML = `<div class="avatar">${initials(s.name)}</div><div class="u-details"><div class="u-name">${esc(s.name)}</div><div class="u-role">${esc(s.role)} Portal</div></div>`;
  const lb = document.getElementById('logoutBtn');
  if (lb) lb.addEventListener('click', () => Auth.logout());
  /* every portal renders its topbar through here — mount Settings once */
  if (typeof SettingsUI !== 'undefined') SettingsUI.mount(s);
}

function initSidebar() {
  const toggle = document.getElementById('menuToggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (toggle) toggle.addEventListener('click', () => { sidebar.classList.add('open'); overlay.classList.add('show'); });
  if (overlay) overlay.addEventListener('click', () => { sidebar.classList.remove('open'); overlay.classList.remove('show'); });
  document.querySelectorAll('.sidebar-nav a[data-section]').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      document.querySelectorAll('.sidebar-nav a[data-section]').forEach(x => x.classList.remove('active'));
      a.classList.add('active');
      document.querySelectorAll('.page-section').forEach(sec => sec.classList.remove('active'));
      const sec = document.getElementById('sec-' + a.dataset.section);
      if (sec) sec.classList.add('active');
      const title = a.dataset.title || a.textContent.trim();
      const th = document.getElementById('topbarTitle'); if (th) th.textContent = title;
      sidebar.classList.remove('open'); overlay.classList.remove('show');
      if (a.dataset.section === 'dashboard') loadAdminDashboard();
      if (a.dataset.section === 'pos') refreshPOSStudentSelect();
  if (a.dataset.section === 'fee-structures' && typeof FeeUI !== 'undefined') FeeUI.renderAdminStructures();
  if (a.dataset.section === 'fees' && typeof renderReviewFees === 'function') renderReviewFees();
      if (a.dataset.section === 'students') renderStudentsTable();
      if (a.dataset.section === 'leadership') renderLeadershipSlots();
      if (a.dataset.section === 'teachers') renderTeachersTable();
      if (a.dataset.section === 'timetable') renderTimetable();
      if (a.dataset.section === 'slider') renderSlider();
      if (a.dataset.section === 'academic-settings' && typeof initAcademicSettingsSection === 'function') initAcademicSettingsSection();
      if (a.dataset.section === 'classes' && typeof renderClassesGrid === 'function') renderClassesGrid();
      if (a.dataset.section === 'homework-admin' && typeof renderHomeworkAdmin === 'function') renderHomeworkAdmin();
      if (a.dataset.section === 'attendance-admin' && typeof renderAttendanceAdmin === 'function') renderAttendanceAdmin();
      if (a.dataset.section === 'exams-admin' && typeof renderExamScheduleAdmin === 'function') renderExamScheduleAdmin();
      if (a.dataset.section === 'materials-admin' && typeof renderMaterialsAdmin === 'function') renderMaterialsAdmin();
      if (a.dataset.section === 'announcements' && typeof renderAnnouncementsAdmin === 'function') renderAnnouncementsAdmin();
      if (a.dataset.section === 'audit' && typeof initAuditSection === 'function') initAuditSection();
      if (a.dataset.section === 'notifications-admin' && typeof initNotificationsSection === 'function') initNotificationsSection();
      // teacher portal refreshes
      const page = document.body ? document.body.dataset.page : '';
      if (a.dataset.section === 'homework' && typeof renderTeacherHomework === 'function' && page === 'teacher') renderTeacherHomework();
      if (a.dataset.section === 'materials' && typeof renderTeacherMaterials === 'function' && page === 'teacher') renderTeacherMaterials();
      if (a.dataset.section === 'marking' && typeof renderTeacherMarkingCentre === 'function' && page === 'teacher') renderTeacherMarkingCentre();
      if (a.dataset.section === 'my-exams' && typeof renderMyExams === 'function' && page === 'teacher') renderMyExams();
      if (a.dataset.section === 'create-exam' && typeof initExamBuilder === 'function' && page === 'teacher') renumberQuestionBlocks();
      // admin exam results approval
      if (a.dataset.section === 'exam-results' && typeof renderAdminExamResults === 'function' && page === 'admin') renderAdminExamResults();
      // student/parent portal sections render once on init (privacy-scoped, no list-all on click)
      // but refresh homework + notifications when those sections open so freshly-published work appears without a full reload
      const page2 = document.body ? document.body.dataset.page : '';
      if (page2 === 'student') {
        const stu = (typeof studentForSession === 'function') ? studentForSession(Auth.session()) : {};
        if (a.dataset.section === 'homework' && typeof renderStudentHomework === 'function') renderStudentHomework(Auth.session(), stu);
        if (a.dataset.section === 'materials' && typeof renderStudentMaterials === 'function') renderStudentMaterials(Auth.session(), stu);
        if (a.dataset.section === 'notifications' && typeof renderStudentNotifications === 'function') renderStudentNotifications(Auth.session());
        if (a.dataset.section === 'dashboard' && typeof renderStudentDashboard === 'function') renderStudentDashboard(Auth.session(), stu);
      }
      // generic hook: new modules (timetable / approvals / inventory) register their own renderers
      if (typeof window.onSectionOpen === 'function') { try { window.onSectionOpen(a.dataset.section, a); } catch (err) { console.error(err); } }
    });
  });
}

/* ---------- ADMIN: DASHBOARD ---------- */
function loadAdminDashboard() {
  const students = DB.get('students');
  const teachers = DB.get('teachers');
  const exams = DB.get('exams');
  const payments = DB.get('payments');
  const activeStudents = students.filter(x => x.status === 'active').length;
  const pending = students.filter(x => x.status === 'pending').length;
  /* "Total Collected" counts only live payments — reversed and soft-deleted
     records are excluded so the figure matches the fee ledger. */
  const livePayments = payments.filter(p => !p.reversed && !p.deleted);
  const totalFees = livePayments.reduce((a, b) => a + Number(b.amount || 0), 0);

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('admTotalStudents', students.length);
  set('admActiveStudents', activeStudents);
  set('admPending', pending);
  set('admTeachers', teachers.length);
  set('admExams', exams.length);
  set('admRevenue', money(totalFees));

  // recent students table
  const tbody = document.getElementById('recentStudentsBody');
  if (tbody) {
    const recent = [...students].reverse().slice(0, 6);
    tbody.innerHTML = recent.length ? recent.map(st => `
      <tr>
        <td><strong>${esc(st.firstName)} ${esc(st.lastName)}</strong></td>
        <td>Grade ${esc(st.grade)}</td>
        <td>${esc(st.parentName || '—')}</td>
        <td><span class="badge badge-${st.status === 'active' ? 'success' : 'warning'}">${esc(st.status)}</span></td>
        <td>${fmtDate(st.admissionDate)}</td>
      </tr>`).join('') : `<tr><td colspan="5" style="text-align:center;color:var(--text-light)">No students yet</td></tr>`;
  }

  // recent payments
  const pbody = document.getElementById('recentPaymentsBody');
  if (pbody) {
    const recent = [...livePayments].reverse().slice(0, 6);
    pbody.innerHTML = recent.length ? recent.map(p => `
      <tr>
        <td><strong>${esc(p.receiptNo)}</strong></td>
        <td>${esc(p.studentName)}</td>
        <td>${esc(p.item)}</td>
        <td>${money(p.amount)}</td>
        <td>${fmtDate(p.paymentDate || p.date)}</td>
      </tr>`).join('') : `<tr><td colspan="5" style="text-align:center;color:var(--text-light)">No payments recorded</td></tr>`;
  }

  // grade distribution chart
  const chart = document.getElementById('gradeChart');
  if (chart) {
    const grades = ['Pre-K','K','1','2','3','4','5','6','7','8','9','10','11','12'];
    const counts = grades.map(g => students.filter(x => String(x.grade) === g).length);
    const max = Math.max(...counts, 1);
    chart.innerHTML = grades.map((g, i) => {
      const h = Math.max(6, Math.round((counts[i] / max) * 140));
      return `<div class="bar-col"><div class="bar" style="height:${h}px"><span class="val">${counts[i]}</span></div><span class="bar-label">${g}</span></div>`;
    }).join('');
  }
}

/* ---------- ADMIN: PHOTO SLIDER ---------- */
function initSliderSection() {
  renderSlider();

  const form = document.getElementById('sliderForm');
  const fileInput = document.getElementById('sliderImage');
  const preview = document.getElementById('sliderPreview');
  const urlInput = document.getElementById('sliderImageUrl');
  const sizeNote = document.getElementById('sliderSizeNote');

  if (fileInput) {
    fileInput.addEventListener('change', async () => {
      const f = fileInput.files[0];
      if (!f) { preview.classList.remove('show'); if (sizeNote) sizeNote.textContent = ''; return; }
      try {
        toast('Optimizing image…', 'info');
        const dataUrl = await compressImage(f, 1600, 0.82);
        preview.src = dataUrl;
        preview.classList.add('show');
        preview.dataset.compressed = dataUrl;
        preview.dataset.filename = f.name || 'slider.jpg';
        if (sizeNote) {
          const kb = Math.round(dataUrl.length * 0.75 / 1024);
          sizeNote.textContent = `Original: ${(f.size / 1024 / 1024).toFixed(2)} MB → Optimized: ~${kb} KB`;
          sizeNote.style.color = 'var(--success)';
        }
        toast('Image optimized and ready!', 'success');
      } catch (err) {
        toast(err.message || 'Could not process that image.', 'error');
        fileInput.value = '';
        if (sizeNote) sizeNote.textContent = '';
      }
    });
  }

  if (urlInput) {
    urlInput.addEventListener('input', () => {
      if (urlInput.value.trim()) {
        preview.src = urlInput.value.trim();
        preview.classList.add('show');
        delete preview.dataset.compressed;
        if (sizeNote) { sizeNote.textContent = 'Using image URL'; sizeNote.style.color = 'var(--text-light)'; }
      }
    });
  }

  if (form) {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const title = document.getElementById('sliderTitle').value.trim();
      const desc = document.getElementById('sliderDesc').value.trim();
      const imageUrl = urlInput ? urlInput.value.trim() : '';

      if (!title) { toast('Please enter a slide title.', 'error'); return; }

      try {
        if (preview.dataset.compressed) {
          // upload to assets/ and store only the returned path
          const id = DB.uid();
          const stored = await uploadOrStoreSiteImage(
            preview.dataset.compressed,
            preview.dataset.filename || 'slider.jpg',
            id
          );
          saveSlideMeta({
            id,
            title,
            desc,
            imageUrl: stored.path,
            imageKey: stored.local ? id : ''
          });
        } else if (imageUrl) {
          saveSlideMeta({ id: DB.uid(), title, desc, imageUrl, imageKey: '' });
        } else {
          toast('Please upload an image or provide an image URL.', 'error');
        }
      } catch (err) {
        toast(err.message || 'Could not save the image.', 'error');
      }
    });
  }

  function saveSlideMeta({ id, title, desc, imageUrl, imageKey }) {
    const slides = DB.get('slider');
    slides.push({ id, title, description: desc, imageUrl, imageKey });
    DB.set('slider', slides);
    form.reset();
    if (preview) { preview.classList.remove('show'); delete preview.dataset.compressed; }
    const note = document.getElementById('sliderSizeNote');
    if (note) note.textContent = '';
    renderSlider();
    toast('Slide added to the homepage!');
    closeModal('sliderModal');
  }
}

async function renderSlider() {
  const grid = document.getElementById('sliderGrid');
  if (!grid) return;
  const slides = DB.get('slider');
  if (!slides.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><i class="fas fa-images"></i><h4>No slides yet</h4><p>Click "Add Slide" to upload your first photo.</p></div>`;
    return;
  }
  grid.innerHTML = slides.map(sl => `
    <div class="slider-item">
      <img data-slide-img="${sl.id}" src="${esc(siteAssetURL(sl.imageUrl || ''))}" alt="${esc(sl.title)}" onerror="this.style.background='linear-gradient(135deg,#0f2c4c,#1a3d5f)';this.removeAttribute('src')">
      <div class="s-item-actions">
        <button class="del" onclick="deleteSlide('${sl.id}')" title="Delete slide"><i class="fas fa-trash"></i></button>
      </div>
      <div class="s-item-info">
        <h4>${esc(sl.title)}</h4>
        <p>${esc(sl.description || 'No description')}</p>
      </div>
    </div>`).join('');

  // load IndexedDB images
  for (const sl of slides) {
    if (sl.imageKey) {
      try {
        const dataUrl = await ImageStore.get(sl.imageKey);
        const img = grid.querySelector(`[data-slide-img="${sl.id}"]`);
        if (img && dataUrl) img.src = dataUrl;
      } catch (e) { /* ignore */ }
    }
  }
}

async function deleteSlide(id) {
  if (!confirm('Delete this slide from the homepage?')) return;
  const slides = DB.get('slider');
  const slide = slides.find(x => x.id === id);
  DB.set('slider', slides.filter(x => x.id !== id));
  if (slide && slide.imageKey) {
    try { await ImageStore.del(slide.imageKey); } catch (e) { /* ignore */ }
  }
  renderSlider();
  toast('Slide deleted.', 'info');
}

/* ---------- ADMIN: LOGO & SITE IMAGES ---------- */
const DEFAULT_STORY_IMG = 'https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&w=800&q=80';
const DEFAULT_CAMPUS_IMG = 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&w=800&q=80';

/* Export / import the website content. Export before changing domain,
   then import once on the new site so nothing is lost. */
function setupSiteBackup() {
  const exportBtn = document.getElementById('siteExportBtn');
  const importFile = document.getElementById('siteImportFile');
  const status = document.getElementById('siteSyncStatus');
  if (status && window.SitePersist) {
    status.textContent = 'Server sync is active. Changes save automatically.';
  }

  if (exportBtn && !exportBtn.dataset.bound) {
    exportBtn.dataset.bound = '1';
    exportBtn.addEventListener('click', async () => {
      if (!window.SitePersist) { toast('Server sync is not available on this page.', 'error'); return; }
      try {
        const data = await SitePersist.exportAll();
        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'st-teresa-backup-' + new Date().toISOString().slice(0, 10) + '.json';
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(link.href), 1500);
        toast('Backup downloaded.', 'success');
      } catch (err) {
        toast(err.message || 'Could not export the backup.', 'error');
      }
    });
  }

  if (importFile && !importFile.dataset.bound) {
    importFile.dataset.bound = '1';
    importFile.addEventListener('change', async () => {
      const file = importFile.files[0];
      if (!file) return;
      if (!window.SitePersist) { toast('Server sync is not available on this page.', 'error'); importFile.value = ''; return; }
      if (!confirm('Import this backup and replace the current website content?')) { importFile.value = ''; return; }
      try {
        const data = JSON.parse(await file.text());
        const result = await SitePersist.importAll(data);
        toast(result.uploadedAll ? 'Backup imported and saved to the server.' : 'Backup imported, but some photos could not be uploaded.', result.uploadedAll ? 'success' : 'info');
        setTimeout(() => location.reload(), 1200);
      } catch (err) {
        toast(err.message || 'Could not import the backup.', 'error');
        importFile.value = '';
      }
    });
  }
}

async function initLogoSection() {
  setupSiteBackup();
  await renderLogo();
  await renderSiteImages();
  await renderMoreImages();

  /* --- LOGO --- */
  const form = document.getElementById('logoForm');
  const fileInput = document.getElementById('logoImage');
  const preview = document.getElementById('logoPreview');

  if (fileInput) {
    fileInput.addEventListener('change', async () => {
      const f = fileInput.files[0];
      if (!f) { preview.classList.remove('show'); return; }
      try {
        const dataUrl = await compressImage(f, 400, 0.9, true);
        preview.src = dataUrl;
        preview.classList.add('show');
        preview.dataset.compressed = dataUrl;
        toast('Logo ready to save.', 'success');
      } catch (err) {
        toast(err.message || 'Could not process that image.', 'error');
        fileInput.value = '';
      }
    });
  }

  if (form) {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const name = document.getElementById('logoName').value.trim() || 'St. Teresa Kanyange Academy';
      const initialsV = document.getElementById('logoInitials').value.trim().slice(0, 3).toUpperCase() || 'STK';
      DB.set('logo', { name, initials: initialsV });
      if (preview && preview.dataset.compressed) {
        try {
          await saveSiteImageValue('logoImage', preview.dataset.compressed);
          toast('Logo updated everywhere on the site!');
        } catch (err) {
          toast(err.message || 'Could not save the logo image.', 'error');
        }
      } else {
        toast('Logo updated!');
      }
      await renderLogo();
      if (preview) { preview.classList.remove('show'); delete preview.dataset.compressed; }
      if (fileInput) fileInput.value = '';
    });
  }

  /* --- STORY + CAMPUS IMAGES --- */
  setupSiteImageForm('story', 'aboutImage', DEFAULT_STORY_IMG);
  setupSiteImageForm('campus', 'campusImage', DEFAULT_CAMPUS_IMG);

  /* --- PROGRAM IMAGES + CTA + FAVICON --- */
  setupSimpleImageUpload('progEarlyFile', 'progEarlyUrl', 'progEarlyPreview', 'progEarly', 800);
  setupSimpleImageUpload('progElemFile', 'progElemUrl', 'progElemPreview', 'progElem', 800);
  setupSimpleImageUpload('progMiddleFile', 'progMiddleUrl', 'progMiddlePreview', 'progMiddle', 800);
  setupSimpleImageUpload('ctaFile', 'ctaUrl', 'ctaPreview', 'ctaImage', 1600);
  setupSimpleImageUpload('faviconFile', 'faviconUrl', 'faviconPreview', 'favicon', 256);

  const resetMap = { progEarlyReset: 'progEarly', progElemReset: 'progElem', progMiddleReset: 'progMiddle', ctaReset: 'ctaImage', faviconReset: 'favicon' };
  Object.keys(resetMap).forEach(id => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener('click', async () => {
      await deleteSiteImageValue(resetMap[id]);
      await renderMoreImages();
      toast('Image deleted — default restored.', 'info');
    });
  });
}

function setupSimpleImageUpload(fileId, urlId, previewId, storeKey, maxW) {
  const fileInput = document.getElementById(fileId);
  const urlInput = document.getElementById(urlId);
  const preview = document.getElementById(previewId);
  if (!fileInput || !preview) return;

  if (fileInput) {
    fileInput.addEventListener('change', async () => {
      const f = fileInput.files[0];
      if (!f) { preview.classList.remove('show'); delete preview.dataset.compressed; return; }
      try {
        const dataUrl = await compressImage(f, maxW || 1200, 0.82);
        preview.src = dataUrl;
        preview.classList.add('show');
        preview.dataset.compressed = dataUrl;
        toast('Image optimized — click Save to apply.', 'success');
      } catch (err) {
        toast(err.message || 'Could not process that image.', 'error');
        fileInput.value = '';
      }
    });
  }

  if (urlInput) {
    urlInput.addEventListener('input', () => {
      if (urlInput.value.trim()) {
        preview.src = urlInput.value.trim();
        preview.classList.add('show');
        delete preview.dataset.compressed;
      }
    });
  }

  const form = preview.closest('form');
  if (form) {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const value = preview.dataset.compressed || (urlInput ? urlInput.value.trim() : '');
      if (!value) { toast('Please upload an image or paste a URL first.', 'error'); return; }
      try {
        await saveSiteImageValue(storeKey, value);
        await renderMoreImages();
        toast('Image saved to the website!');
      } catch (err) {
        toast(err.message || 'Could not save the image. Please try again.', 'error');
      }
      form.reset();
      preview.classList.remove('show');
      delete preview.dataset.compressed;
      if (fileInput) fileInput.value = '';
    });
  }
}

async function renderMoreImages() {
  const progEarly = await getSiteImageValue('progEarly');
  const progElem = await getSiteImageValue('progElem');
  const progMiddle = await getSiteImageValue('progMiddle');
  const cta = await getSiteImageValue('ctaImage');
  const favicon = await getSiteImageValue('favicon');

  const setPreview = (id, src) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (src) { el.src = src; el.classList.add('show'); }
    else { el.classList.remove('show'); el.removeAttribute('src'); delete el.dataset.compressed; }
  };

  setPreview('progEarlyPreview', progEarly);
  setPreview('progElemPreview', progElem);
  setPreview('progMiddlePreview', progMiddle);
  setPreview('ctaPreview', cta);
  setPreview('faviconPreview', favicon);

  const status = (id, has, label) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = has
      ? `<span class="badge badge-success"><i class="fas fa-check"></i> Custom ${label} active</span>`
      : `<span class="badge badge-navy">Using default ${label}</span>`;
  };
  status('progEarlyStatus', !!progEarly, 'image');
  status('progElemStatus', !!progElem, 'image');
  status('progMiddleStatus', !!progMiddle, 'image');
  status('ctaStatus', !!cta, 'background');
  status('faviconStatus', !!favicon, 'favicon');
}

function setupSiteImageForm(prefix, storeKey, defaultImg) {
  const form = document.getElementById(prefix + 'ImageForm');
  const fileInput = document.getElementById(prefix + 'ImageFile');
  const urlInput = document.getElementById(prefix + 'ImageUrl');
  const preview = document.getElementById(prefix + 'Preview');
  const resetBtn = document.getElementById(prefix + 'ResetBtn');
  const sizeNote = document.getElementById(prefix + 'SizeNote');
  if (!form) return;

  if (fileInput) {
    fileInput.addEventListener('change', async () => {
      const f = fileInput.files[0];
      if (!f) { preview.classList.remove('show'); if (sizeNote) sizeNote.textContent = ''; return; }
      try {
        toast('Optimizing image…', 'info');
        const dataUrl = await compressImage(f, 1400, 0.82);
        preview.src = dataUrl;
        preview.classList.add('show');
        preview.dataset.compressed = dataUrl;
        if (sizeNote) {
          const kb = Math.round(dataUrl.length * 0.75 / 1024);
          sizeNote.textContent = `Original: ${(f.size / 1024 / 1024).toFixed(2)} MB → Optimized: ~${kb} KB`;
          sizeNote.style.color = 'var(--success)';
        }
        toast('Image optimized and ready!', 'success');
      } catch (err) {
        toast(err.message || 'Could not process that image.', 'error');
        fileInput.value = '';
        if (sizeNote) sizeNote.textContent = '';
      }
    });
  }

  if (urlInput) {
    urlInput.addEventListener('input', () => {
      if (urlInput.value.trim()) {
        preview.src = urlInput.value.trim();
        preview.classList.add('show');
        delete preview.dataset.compressed;
        if (sizeNote) { sizeNote.textContent = 'Using image URL'; sizeNote.style.color = 'var(--text-light)'; }
      }
    });
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    let value = '';
    if (preview.dataset.compressed) value = preview.dataset.compressed;
    else if (urlInput.value.trim()) value = urlInput.value.trim();
    else { toast('Please upload an image or provide an image URL.', 'error'); return; }
    try {
      await saveSiteImageValue(storeKey, value);
      await renderSiteImages();
      toast('Image updated on the website!');
    } catch (err) {
      toast(err.message || 'Could not save the image. Please try again.', 'error');
    }
    form.reset();
    preview.classList.remove('show');
    delete preview.dataset.compressed;
    if (sizeNote) sizeNote.textContent = '';
    if (fileInput) fileInput.value = '';
  });

  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      await deleteSiteImageValue(storeKey);
      form.reset();
      preview.classList.remove('show');
      delete preview.dataset.compressed;
      if (sizeNote) sizeNote.textContent = '';
      if (fileInput) fileInput.value = '';
      await renderSiteImages();
      toast('Deleted — showing the default image again.', 'info');
    });
  }
}

async function renderSiteImages() {
  const story = await getSiteImageValue('aboutImage');
  const campus = await getSiteImageValue('campusImage');

  const sc = document.getElementById('storyImageCurrent');
  if (sc) {
    sc.innerHTML = `
      <div class="managed-image">
        <img src="${esc(story || DEFAULT_STORY_IMG)}" alt="Current story image">
        ${story ? `<button type="button" class="img-delete-btn" onclick="removeSiteImage('aboutImage')" title="Delete — revert to default"><i class="fas fa-trash"></i> Delete</button>` : `<span class="img-default-tag">Default image</span>`}
      </div>`;
  }
  const cc = document.getElementById('campusImageCurrent');
  if (cc) {
    cc.innerHTML = `
      <div class="managed-image">
        <img src="${esc(campus || DEFAULT_CAMPUS_IMG)}" alt="Current campus image">
        ${campus ? `<button type="button" class="img-delete-btn" onclick="removeSiteImage('campusImage')" title="Delete — revert to default"><i class="fas fa-trash"></i> Delete</button>` : `<span class="img-default-tag">Default image</span>`}
      </div>`;
  }
}

async function removeSiteImage(storeKey) {
  if (!confirm('Delete this custom image and go back to the default?')) return;
  await deleteSiteImageValue(storeKey);
  await renderSiteImages();
  toast('Custom image deleted — default restored.', 'info');
}

async function renderLogo() {
  const box = document.getElementById('logoCurrent');
  if (!box) return;
  const logo = DB.get('logo', { name: 'St. Teresa Kanyange Academy', initials: 'STK' });
  const logoImage = await getSiteImageValue('logoImage');
  box.innerHTML = `
    <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
      ${logoImage
        ? `<img src="${esc(logoImage)}" alt="Logo" style="width:60px;height:60px;border-radius:50%;object-fit:cover;border:2px solid var(--gold)">`
        : `<div class="brand-mini" style="width:60px;height:60px;background:linear-gradient(135deg,var(--navy),var(--navy-light));border:2px solid var(--gold);border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--gold);font-weight:800;font-family:Georgia,serif;font-size:1.1rem">${esc(logo.initials)}</div>`}
      <div style="flex:1;min-width:180px">
        <h3 style="color:var(--navy)">${esc(logo.name)}</h3>
        <p style="font-size:0.82rem;color:var(--text-light)">Current site logo ${logoImage ? '(custom image)' : '(text crest)'}</p>
      </div>
      ${logoImage ? `<button type="button" class="btn btn-sm btn-danger" onclick="removeLogoImage()"><i class="fas fa-trash"></i> Delete Logo</button>` : ''}
    </div>`;
}

async function removeLogoImage() {
  if (!confirm('Delete the custom logo and use the text crest instead?')) return;
  await deleteSiteImageValue('logoImage');
  await renderLogo();
  const preview = document.getElementById('logoPreview');
  if (preview) { preview.classList.remove('show'); delete preview.dataset.compressed; }
  const fi = document.getElementById('logoImage');
  if (fi) fi.value = '';
  toast('Custom logo deleted — using text crest.', 'info');
}

/* ---------- ADMIN: STUDENTS ---------- */
let _admStPhotoData = '';
function initStudentsSection() {
  renderStudentsTable();
  applyFeeFieldPermission();
  // populate class dropdown from the class-management database
  const gradeSel = document.getElementById('stGrade');
  if (gradeSel) gradeSel.innerHTML = '<option value="">Select class…</option>' + ACADEMIC_CLASSES.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  // academic year dropdown + matching term list
  if (typeof fillAcademicYearSelect === 'function') {
    fillAcademicYearSelect(document.getElementById('stAcademicYear'), document.getElementById('stTerm'),
      { current: AcademicYears.activeYear(), selected: AcademicYears.activeYear(), defaultTerm: AcademicYears.activeTerm() });
  }
  // photo preview handler
  const photoInput = document.getElementById('stPhoto');
  if (photoInput && !photoInput.dataset.bound) {
    photoInput.dataset.bound = '1';
    photoInput.addEventListener('change', async () => {
      const f = photoInput.files[0];
      const pv = document.getElementById('stPhotoPreview');
      const err = (typeof validatePhotoFile === 'function') ? validatePhotoFile(f) : null;
      if (err) { toast(err, 'error'); photoInput.value = ''; _admStPhotoData = ''; if (pv) pv.innerHTML = ''; return; }
      try {
        _admStPhotoData = (typeof compressImage === 'function') ? await compressImage(f, 500, 0.85, f.type === 'image/png') : await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
        if (pv) pv.innerHTML = `<img src="${esc(_admStPhotoData)}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:2px solid var(--gold)">`;
      } catch (e) { toast('Could not read that image.', 'error'); photoInput.value = ''; _admStPhotoData = ''; if (pv) pv.innerHTML = ''; }
    });
  }
  const form = document.getElementById('studentForm');
  if (form && !form.dataset.bound) {
    form.dataset.bound = '1';
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const editingId = document.getElementById('studentEditId').value;
      const className = document.getElementById('stGrade').value;
      if (!className) { toast('Please select a class.', 'error'); return; }
      if (editingId) {
        // update permitted details via the Students module
        const payload = {
          firstName: document.getElementById('stFirstName').value.trim(),
          lastName: document.getElementById('stLastName').value.trim(),
          email: document.getElementById('stEmail').value.trim(),
          className: className, grade: className,
          academicYear: (document.getElementById('stAcademicYear') || {}).value,
          term: (document.getElementById('stTerm') || {}).value,
          gender: document.getElementById('stGender').value,
          dob: document.getElementById('stDob').value,
          category: document.getElementById('stCategory').value,
          parentName: document.getElementById('stParent').value.trim(),
          parentPhone: document.getElementById('stParentPhone').value.trim(),
          guardian2Name: document.getElementById('stGuardian2Name').value.trim(),
          guardian2Phone: document.getElementById('stGuardian2Phone').value.trim(),
          address: document.getElementById('stAddress').value.trim(),
          status: document.getElementById('stStatus').value
        };
        /* the fee balance only travels with the request when the Secretary sent it */
        if (Perm.canManageFees()) payload.feeBalance = Number(document.getElementById('stFeeBalance').value || 0);
        const r = Students.update(editingId, payload);
        if (!r.ok) { toast(r.error, 'error'); return; }
        // replace photo if a new one was chosen
        if (_admStPhotoData) {
          const pr = await Students.replacePhoto(editingId, _admStPhotoData);
          if (!pr.ok) toast(pr.error, 'error');
        }
        toast('Student updated!');
      } else {
        // admit a new student via the Students module (creates linked login + parent + photo)
        const admissionNo = (document.getElementById('stAdmissionNo') || {}).value || Students.nextAdmissionNo();
        const r = await Students.admit({
          firstName: document.getElementById('stFirstName').value.trim(),
          lastName: document.getElementById('stLastName').value.trim(),
          email: document.getElementById('stEmail').value.trim(),
          className: className, admissionNo: admissionNo,
          admissionDate: today(),
          academicYear: (document.getElementById('stAcademicYear') || {}).value || AcademicYears.activeYear(),
          term: (document.getElementById('stTerm') || {}).value || AcademicYears.activeTerm(),
          gender: document.getElementById('stGender').value,
          dob: document.getElementById('stDob').value,
          photo: _admStPhotoData,
          category: document.getElementById('stCategory').value,
          parentName: document.getElementById('stParent').value.trim(),
          parentPhone: document.getElementById('stParentPhone').value.trim(),
          guardian2Name: document.getElementById('stGuardian2Name').value.trim(),
          guardian2Phone: document.getElementById('stGuardian2Phone').value.trim(),
          address: document.getElementById('stAddress').value.trim(),
          status: document.getElementById('stStatus').value,
          /* only the Secretary may attach an opening fee amount */
          feeBalance: Perm.canManageFees() ? Number(document.getElementById('stFeeBalance').value || 0) : 0
        });
        if (!r.ok) { toast(r.error, 'error'); return; }
        toast('Student admitted! Login: ' + r.username);
        if (typeof SettingsUI !== 'undefined' && r.tempPassword) {
          SettingsUI._showTempPassword({ name: r.student.fullName, username: r.username, role: 'student' }, r.tempPassword);
        }
      }
      form.reset();
      document.getElementById('studentEditId').value = '';
      _admStPhotoData = '';
      const pv = document.getElementById('stPhotoPreview'); if (pv) pv.innerHTML = '';
      const ano = document.getElementById('stAdmissionNo'); if (ano) ano.value = '';
      closeModal('studentModal');
      renderStudentsTable();
      loadAdminDashboard();
    });
  }
}

function generateAdminAdmissionNo() {
  const el = document.getElementById('stAdmissionNo');
  const yr = document.getElementById('stAcademicYear');
  if (el) el.value = Students.nextAdmissionNo(yr && yr.value ? yr.value : undefined);
}

function renderStudentsTable(filter = '') {
  const tbody = document.getElementById('studentsBody');
  if (!tbody) return;
  let students = DB.get('students');
  if (filter) {
    const f = filter.toLowerCase();
    students = students.filter(s =>
      (s.firstName + ' ' + s.lastName).toLowerCase().includes(f) ||
      String(s.className || s.grade).toLowerCase().includes(f) ||
      (s.admissionNo || '').toLowerCase().includes(f) ||
      (s.parentName || '').toLowerCase().includes(f)
    );
  }
  tbody.innerHTML = students.length ? students.map(s => `
    <tr>
      <td><strong>${esc(s.firstName)} ${esc(s.lastName)}</strong><br><small style="color:var(--text-light)">${esc(s.admissionNo || '')} ${esc(s.email)}</small></td>
      <td>${esc(s.className || s.grade || '—')}</td>
      <td>${esc(s.parentName || '—')}<br><small style="color:var(--text-light)">${esc(s.parentPhone || '')}</small></td>
      <td>${money(s.feeBalance || 0)}</td>
      <td><span class="badge badge-${s.status === 'active' ? 'success' : s.status === 'pending' ? 'warning' : 'danger'}">${esc(s.status)}</span></td>
      <td class="table-actions">
        <button class="btn btn-xs btn-outline" onclick="editStudent('${s.id}')"><i class="fas fa-pen"></i></button>
        <button class="btn btn-xs btn-danger" onclick="deleteStudent('${s.id}')"><i class="fas fa-trash"></i></button>
      </td>
    </tr>`).join('') : `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-light)">No students found</td></tr>`;
}

function openAddStudent() {
  document.getElementById('studentForm').reset();
  document.getElementById('studentEditId').value = '';
  _admStPhotoData = '';
  const pv = document.getElementById('stPhotoPreview'); if (pv) pv.innerHTML = '';
  applyFeeFieldPermission();
  if (typeof fillAcademicYearSelect === 'function') {
    fillAcademicYearSelect(document.getElementById('stAcademicYear'), document.getElementById('stTerm'),
      { current: AcademicYears.activeYear(), selected: AcademicYears.activeYear(), defaultTerm: AcademicYears.activeTerm() });
  }
  const ano = document.getElementById('stAdmissionNo'); if (ano) ano.value = Students.nextAdmissionNo(AcademicYears.activeYear());
  document.getElementById('studentModalTitle').textContent = 'Admit New Student';
  openModal('studentModal');
}

/* Fee balance is a Secretary-only field: everyone else sees it read-only.
   The data layer enforces the same rule, this is only the interface. */
function applyFeeFieldPermission() {
  const el = document.getElementById('stFeeBalance');
  if (!el) return;
  const can = (typeof Perm !== 'undefined') && Perm.canManageFees();
  el.readOnly = !can;
  el.style.background = can ? '' : 'var(--cream)';
  el.style.cursor = can ? '' : 'not-allowed';
  const hint = document.getElementById('stFeeHint');
  if (hint) hint.innerHTML = can
    ? '<small style="color:var(--text-light)">Only the Secretary may change fee amounts.</small>'
    : '<small style="color:var(--danger,#c0392b)"><i class="fas fa-lock"></i> Read-only — only the Secretary may change fee amounts.</small>';
}

function editStudent(id) {
  const s = DB.get('students').find(x => x.id === id);
  if (!s) return;
  document.getElementById('studentEditId').value = s.id;
  document.getElementById('stFirstName').value = s.firstName || '';
  document.getElementById('stLastName').value = s.lastName || '';
  document.getElementById('stEmail').value = s.email || '';
  document.getElementById('stGrade').value = s.className || s.grade || '';
  document.getElementById('stGender').value = s.gender || '';
  document.getElementById('stDob').value = s.dob || '';
  document.getElementById('stCategory').value = s.category || '';
  document.getElementById('stParent').value = s.parentName || '';
  document.getElementById('stParentPhone').value = s.parentPhone || '';
  document.getElementById('stGuardian2Name').value = s.guardian2Name || '';
  document.getElementById('stGuardian2Phone').value = s.guardian2Phone || '';
  document.getElementById('stAddress').value = s.address || '';
  document.getElementById('stStatus').value = s.status || 'active';
  document.getElementById('stFeeBalance').value = s.feeBalance || 0;
  const ano = document.getElementById('stAdmissionNo'); if (ano) ano.value = s.admissionNo || '';
  /* Show the year the student was admitted under, even if that year has
     since been archived — otherwise the record would silently change year. */
  const yrSel = document.getElementById('stAcademicYear');
  const tmSel = document.getElementById('stTerm');
  if (typeof fillAcademicYearSelect === 'function' && yrSel) {
    const theirs = String(s.academicYear || '');
    const activeLabels = AcademicYears.forSelection().map(y => String(y.label));
    if (theirs && !activeLabels.includes(theirs)) {
      yrSel.insertAdjacentHTML('afterbegin', `<option value="${esc(theirs)}" selected>${esc(theirs)} (archived)</option>`);
    } else {
      fillAcademicYearSelect(yrSel, tmSel, { current: AcademicYears.activeYear(), selected: theirs || AcademicYears.activeYear(), defaultTerm: s.term || AcademicYears.activeTerm() });
    }
  }
  if (tmSel && s.term) tmSel.value = String(s.term);
  applyFeeFieldPermission();
  _admStPhotoData = '';
  const cur = (typeof Students !== 'undefined') ? Students.photoUrl(s) : (s.photo || '');
  const pv = document.getElementById('stPhotoPreview');
  if (pv) pv.innerHTML = cur ? `<img src="${esc(cur)}" style="width:70px;height:70px;border-radius:50%;object-fit:cover;border:2px solid var(--gold)"> <small style="color:var(--text-light)">Current photo — choose a new file to replace</small>` : '';
  document.getElementById('studentModalTitle').textContent = 'Edit Student';
  openModal('studentModal');
}

function deleteStudent(id) {
  const s = DB.get('students').find(x => x.id === id);
  if (!s) return;
  if (!Perm.canDeleteStudents()) { toast('You do not have permission to permanently delete students. Consider archiving instead.', 'error'); return; }
  const reason = prompt('Permanently delete ' + s.firstName + ' ' + s.lastName + ' (' + (s.admissionNo || '') + ')?\n\nType a reason for deletion:');
  if (!reason || !reason.trim()) { toast('Deletion cancelled — a reason is required.', 'info'); return; }
  const typed = prompt('Type the student\'s full name exactly to confirm:\n' + s.firstName + ' ' + s.lastName);
  if (typed === null) { toast('Deletion cancelled.', 'info'); return; }
  const r = Students.delete(id, reason.trim(), typed.trim());
  if (!r.ok) { toast(r.error, 'error'); return; }
  renderStudentsTable();
  loadAdminDashboard();
  toast('Student deleted. Related history preserved and logged.', 'info');
}

/* ---------- ADMIN: LEADERSHIP (Meet Our Faculty) ---------- */
function initLeadershipSection() {
  renderLeadershipSlots();

  const photoInput = document.getElementById('ldPhoto');
  const photoPreview = document.getElementById('ldPhotoPreview');
  if (photoInput && !photoInput.dataset.bound) {
    photoInput.dataset.bound = '1';
    photoInput.addEventListener('change', async () => {
      const f = photoInput.files[0];
      if (!f) { photoPreview.classList.remove('show'); delete photoPreview.dataset.compressed; return; }
      try {
        const dataUrl = await compressImage(f, 500, 0.85);
        photoPreview.src = dataUrl;
        photoPreview.classList.add('show');
        photoPreview.dataset.compressed = dataUrl;
        toast('Photo ready to save.', 'success');
      } catch (err) {
        toast(err.message || 'Could not process that photo.', 'error');
        photoInput.value = '';
      }
    });
  }

  const form = document.getElementById('leadershipForm');
  if (form && !form.dataset.bound) {
    form.dataset.bound = '1';
    form.addEventListener('submit', e => {
      e.preventDefault();
      const editingId = document.getElementById('ldEditId').value || null;
      const existing = editingId ? Leadership.list().find(x => x.id === editingId) : null;
      const data = {
        position: document.getElementById('ldPosition').value,
        name: document.getElementById('ldName').value.trim(),
        title: document.getElementById('ldTitle').value.trim(),
        bio: document.getElementById('ldBio').value.trim(),
        status: document.getElementById('ldStatus').value,
        published: document.getElementById('ldPublished').checked,
        photo: (photoPreview && photoPreview.dataset.compressed) ? photoPreview.dataset.compressed : (existing ? existing.photo || '' : '')
      };
      const res = Leadership.save(data, editingId);
      if (!res.ok) { toast(res.error, 'error'); return; }
      toast(editingId ? 'Leader updated!' : 'Leader added!');
      form.reset();
      if (photoPreview) { photoPreview.classList.remove('show'); delete photoPreview.dataset.compressed; }
      document.getElementById('ldEditId').value = '';
      closeModal('leadershipModal');
      renderLeadershipSlots();
      loadAdminDashboard();
    });
  }
}

function renderLeadershipSlots() {
  const grid = document.getElementById('leadershipSlotsGrid');
  if (!grid) return;
  const items = Leadership.list();
  grid.innerHTML = Leadership.POSITIONS.map(pos => {
    const leader = items.find(x => x.position === pos.key);
    const live = leader && leader.status !== 'inactive' && leader.published !== false;
    return `
      <div class="panel leadership-slot">
        <div class="panel-head">
          <h3><i class="fas fa-user-tie" style="color:var(--gold)"></i> ${pos.label}</h3>
          <span class="badge badge-${leader ? (live ? 'success' : 'warning') : 'danger'}">${leader ? (live ? 'Live on homepage' : 'Hidden') : 'Vacant'}</span>
        </div>
        <div class="panel-body">
          ${leader ? `
            <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
              ${leader.photo
                ? `<img src="${esc(leader.photo)}" alt="" style="width:72px;height:72px;border-radius:50%;object-fit:cover;border:2px solid var(--gold);flex-shrink:0">`
                : `<div style="width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,var(--navy),var(--navy-light));color:var(--gold);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1.1rem;flex-shrink:0">${initials(leader.name)}</div>`}
              <div style="flex:1;min-width:170px">
                <h4 style="color:var(--navy);font-size:1.05rem">${esc(leader.name)}</h4>
                <p style="font-size:0.85rem;color:var(--text-light)">${esc(leader.title || pos.label)}</p>
                ${leader.bio ? `<p style="font-size:0.8rem;color:var(--text-light);margin-top:4px">${esc(leader.bio)}</p>` : ''}
              </div>
              <div class="table-actions">
                <button class="btn btn-xs btn-outline" onclick="editLeader('${leader.id}')"><i class="fas fa-pen"></i> Edit</button>
                <button class="btn btn-xs btn-danger" onclick="deleteLeader('${leader.id}')"><i class="fas fa-trash"></i></button>
              </div>
            </div>
          ` : `
            <div style="text-align:center;padding:24px 12px;color:var(--text-light)">
              <i class="fas fa-user-plus" style="font-size:1.8rem;color:var(--border);margin-bottom:10px;display:block"></i>
              <p style="margin-bottom:14px">No one assigned to this position yet.</p>
              <button class="btn btn-primary btn-sm" onclick="openAddLeader('${pos.key}')"><i class="fas fa-plus"></i> Add ${pos.label}</button>
            </div>
          `}
        </div>
      </div>`;
  }).join('');
}

function openAddLeader(position) {
  const form = document.getElementById('leadershipForm');
  form.reset();
  document.getElementById('ldEditId').value = '';
  const posMeta = Leadership.POSITIONS.find(p => p.key === position);
  document.getElementById('ldPosition').value = position;
  document.getElementById('ldPositionLabel').value = posMeta ? posMeta.label : position;
  document.getElementById('ldPublished').checked = true;
  document.getElementById('ldPhotoPreview').classList.remove('show');
  delete document.getElementById('ldPhotoPreview').dataset.compressed;
  document.getElementById('leadershipModalTitle').textContent = 'Add ' + (posMeta ? posMeta.label : 'Leader');
  openModal('leadershipModal');
}

function editLeader(id) {
  const l = Leadership.list().find(x => x.id === id);
  if (!l) return;
  document.getElementById('ldEditId').value = l.id;
  document.getElementById('ldPosition').value = l.position;
  document.getElementById('ldPositionLabel').value = Leadership.labelFor(l.position);
  document.getElementById('ldName').value = l.name || '';
  document.getElementById('ldTitle').value = l.title || '';
  document.getElementById('ldBio').value = l.bio || '';
  document.getElementById('ldStatus').value = l.status || 'active';
  document.getElementById('ldPublished').checked = l.published !== false;
  const p = document.getElementById('ldPhotoPreview');
  if (l.photo) { p.src = l.photo; p.classList.add('show'); delete p.dataset.compressed; }
  else { p.classList.remove('show'); delete p.dataset.compressed; }
  document.getElementById('leadershipModalTitle').textContent = 'Edit ' + Leadership.labelFor(l.position);
  openModal('leadershipModal');
}

function deleteLeader(id) {
  if (!confirm('Remove this leader from the homepage? The position will become vacant.')) return;
  Leadership.remove(id);
  renderLeadershipSlots();
  loadAdminDashboard();
  toast('Leader removed. Position is now vacant.', 'info');
}

/* ---------- ADMIN: TEACHERS ---------- */
function initTeachersSection() {
  renderTeachersTable();

  const photoInput = document.getElementById('tcPhoto');
  const photoPreview = document.getElementById('tcPhotoPreview');
  if (photoInput) {
    photoInput.addEventListener('change', async () => {
      const f = photoInput.files[0];
      if (!f) { photoPreview.classList.remove('show'); delete photoPreview.dataset.compressed; return; }
      try {
        const dataUrl = await compressImage(f, 500, 0.85);
        photoPreview.src = dataUrl;
        photoPreview.classList.add('show');
        photoPreview.dataset.compressed = dataUrl;
        toast('Photo ready to save.', 'success');
      } catch (err) {
        toast(err.message || 'Could not process that photo.', 'error');
        photoInput.value = '';
      }
    });
  }

  const form = document.getElementById('teacherForm');
  if (form) {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const editingId = document.getElementById('teacherEditId').value;
      const existing = editingId ? DB.get('teachers').find(x => x.id === editingId) : null;
      const data = {
        firstName: document.getElementById('tcFirstName').value.trim(),
        lastName: document.getElementById('tcLastName').value.trim(),
        email: document.getElementById('tcEmail').value.trim(),
        subject: document.getElementById('tcSubject').value,
        role: document.getElementById('tcRole').value.trim(),
        phone: document.getElementById('tcPhone').value.trim(),
        qualification: document.getElementById('tcQualification').value.trim(),
        bio: document.getElementById('tcBio').value.trim(),
        status: document.getElementById('tcStatus').value,
        photo: (photoPreview && photoPreview.dataset.compressed) ? photoPreview.dataset.compressed : (existing ? existing.photo || '' : '')
      };
      if (!data.firstName || !data.lastName) { toast('Name is required.', 'error'); return; }
      const teachers = DB.get('teachers');
      if (editingId) {
        const i = teachers.findIndex(x => x.id === editingId);
        if (i > -1) teachers[i] = { ...teachers[i], ...data };
        DB.set('teachers', teachers);
        toast('Teacher updated!');
      } else {
        data.id = DB.uid();
        const uname = (data.firstName[0] + data.lastName).toLowerCase().replace(/[^a-z0-9]/g, '');
        const acct = await Security.createAccount({
          id: DB.uid(), username: uname, role: 'teacher',
          name: data.firstName + ' ' + data.lastName, email: data.email, subject: data.subject
        });
        if (!acct.ok) { toast(acct.error, 'error'); return; }
        teachers.push(data);
        DB.set('teachers', teachers);
        toast('Teacher added! Login: ' + uname);
        SettingsUI._showTempPassword(acct.user, acct.tempPassword);
      }
      form.reset();
      if (photoPreview) { photoPreview.classList.remove('show'); delete photoPreview.dataset.compressed; }
      document.getElementById('teacherEditId').value = '';
      closeModal('teacherModal');
      renderTeachersTable();
      loadAdminDashboard();
    });
  }
}

function teacherDisplayName(t) {
  if (!t) return '';
  if (t.lastName === 'Sr.') return 'Sr. ' + t.firstName;
  const prefix = /^(Fr|Mr|Mrs|Ms|Dr)\.?$/i.test(t.firstName) ? '' : '';
  return (t.firstName + ' ' + t.lastName).trim() + prefix;
}

function renderTeachersTable() {
  const tbody = document.getElementById('teachersBody');
  if (!tbody) return;
  const teachers = DB.get('teachers');
  tbody.innerHTML = teachers.length ? teachers.map(t => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          ${t.photo
            ? `<img src="${esc(t.photo)}" alt="" style="width:38px;height:38px;border-radius:50%;object-fit:cover;border:2px solid var(--gold)">`
            : `<div style="width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,var(--navy),var(--navy-light));color:var(--gold);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.75rem">${initials(teacherDisplayName(t))}</div>`}
          <div>
            <strong>${esc(teacherDisplayName(t))}</strong><br>
            <small style="color:var(--text-light)">${esc(t.email)}</small>
          </div>
        </div>
      </td>
      <td>${esc(t.role || '—')}<br><small style="color:var(--text-light)">${esc(t.subject || '')}</small></td>
      <td>${esc(t.qualification || '—')}</td>
      <td>${esc(t.phone || '—')}</td>
      <td><span class="badge badge-${t.status === 'active' ? 'success' : 'danger'}">${esc(t.status)}</span></td>
      <td class="table-actions">
        <button class="btn btn-xs btn-outline" onclick="editTeacher('${t.id}')"><i class="fas fa-pen"></i></button>
        <button class="btn btn-xs btn-danger" onclick="deleteTeacher('${t.id}')"><i class="fas fa-trash"></i></button>
      </td>
    </tr>`).join('') : `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-light)">No teachers yet</td></tr>`;
}

function openAddTeacher() {
  document.getElementById('teacherForm').reset();
  document.getElementById('teacherEditId').value = '';
  const p = document.getElementById('tcPhotoPreview');
  if (p) { p.classList.remove('show'); delete p.dataset.compressed; }
  document.getElementById('teacherModalTitle').textContent = 'Add New Teacher';
  openModal('teacherModal');
}

function editTeacher(id) {
  const t = DB.get('teachers').find(x => x.id === id);
  if (!t) return;
  document.getElementById('teacherEditId').value = t.id;
  document.getElementById('tcFirstName').value = t.firstName || '';
  document.getElementById('tcLastName').value = t.lastName || '';
  document.getElementById('tcEmail').value = t.email || '';
  document.getElementById('tcSubject').value = t.subject || '';
  document.getElementById('tcRole').value = t.role || '';
  document.getElementById('tcPhone').value = t.phone || '';
  document.getElementById('tcQualification').value = t.qualification || '';
  document.getElementById('tcBio').value = t.bio || '';
  document.getElementById('tcStatus').value = t.status || 'active';
  const p = document.getElementById('tcPhotoPreview');
  if (p) {
    if (t.photo) { p.src = t.photo; p.classList.add('show'); delete p.dataset.compressed; }
    else { p.classList.remove('show'); delete p.dataset.compressed; }
  }
  document.getElementById('teacherModalTitle').textContent = 'Edit Teacher';
  openModal('teacherModal');
}

function deleteTeacher(id) {
  if (!confirm('Remove this teacher?')) return;
  DB.set('teachers', DB.get('teachers').filter(x => x.id !== id));
  renderTeachersTable();
  loadAdminDashboard();
  toast('Teacher removed.', 'info');
}

/* ---------- ADMIN/SECRETARY: TIMETABLE ---------- */
/* The admin portal is READ-ONLY for timetables: only the secretary creates,
   edits, generates or publishes them. This view shows the published official
   timetable (or a clear empty state when nothing has been published). */
function initTimetableSection() {
  renderTimetable();
}

/* Kept as a no-op so any stray onclick in older markup cannot edit data.
   The legacy modal form is intentionally disabled — see the section markup. */
function openAddTimetable() {
  toast('Only the secretary can edit the timetable. This is a read-only view.', 'error');
}

function renderTimetable() {
  const wrap = document.getElementById('ttGrid');
  if (!wrap) return;
  if (typeof Timetable === 'undefined') return;
  const sel = document.getElementById('ttGrade');
  const names = Timetable.classesForGrid();
  if (sel) {
    const prev = sel.value;
    sel.innerHTML = names.length ? names.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('')
      : '<option value="">No classes</option>';
    if (prev && names.includes(prev)) sel.value = prev;
  }
  Timetable.renderReadOnlyGrid('ttGrid', { mode: 'class', value: sel ? sel.value : '' });
}

function ttAdminPrint() {
  if (typeof Timetable === 'undefined') return;
  const sel = document.getElementById('ttGrade');
  const name = sel ? sel.value : '';
  if (!name) return Timetable.printAll();
  const cls = Timetable.classes().find(c => c.name === name);
  if (cls) return Timetable.printClass(cls.id);
  Timetable.printClassView(name);
}

function _renderTimetableLegacy() {
  const wrap = document.getElementById('ttGrid');
  if (!wrap) return;
  const gradeSel = document.getElementById('ttGrade');
  const grade = gradeSel ? gradeSel.value : '10';
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const slots = [
    { id: 'p1', label: 'Lesson 1', time: '8:15–9:05' },
    { id: 'p2', label: 'Lesson 2', time: '9:05–9:55' },
    { id: 'p3', label: 'Lesson 3', time: '10:10–11:00' },
    { id: 'p4', label: 'Lesson 4', time: '11:50–12:35' },
    { id: 'p5', label: 'Lesson 5', time: '12:35–1:25' },
    { id: 'p6', label: 'Lesson 6', time: '1:25–2:15' }
  ];
  const tt = DB.get('timetable').filter(x => String(x.grade) === String(grade));

  wrap.innerHTML = `<table class="tt-table">
    <thead><tr><th>Time</th>${days.map(d => `<th>${d}</th>`).join('')}</tr></thead>
    <tbody>
      ${slots.map(sl => `
        <tr>
          <td class="tt-slot">${sl.label}<br><small style="font-weight:400;color:var(--text-light)">${sl.time}</small></td>
          ${days.map(d => {
            const e = tt.find(x => x.day === d && x.slot === sl.id);
            return `<td><div class="tt-cell" onclick="openAddTimetable('${esc(grade)}','${d}','${sl.id}')" title="Click to edit">
              ${e ? `<span class="sub">${esc(e.subject)}</span><span class="tch">${esc(e.teacher || '')}${e.room ? ' · ' + esc(e.room) : ''}</span>` : '<span class="tch" style="opacity:0.4">+</span>'}
            </div></td>`;
          }).join('')}
        </tr>`).join('')}
    </tbody>
  </table>`;
}

/* ---------- ADMIN: POS (READ-ONLY — only the Secretary records payments) ----------
   The fee catalogue now lives in the database (Fees.items()). This screen
   keeps the payment history visible to authorised staff, but every way of
   adding a payment or touching a balance is refused here AND in the data
   layer (Payments.record / Fees.*), so hiding the buttons is not the rule. */
const posCart = [];

function initPOS() {
  const canPay = (typeof Perm !== 'undefined') && Perm.canRecordPayments();

  const grid = document.getElementById('feeProductGrid');
  if (grid) {
    const items = (typeof Fees !== 'undefined') ? Fees.items() : [];
    grid.innerHTML = items.length ? items.map(it => `
      <div class="fee-product${canPay ? '' : ' fee-product-ro'}"${canPay ? ` onclick="addToCart('${it.id}')"` : ''}>
        <i class="fas ${esc(it.icon || 'fa-money-bill-wave')}${it.active === false ? ' fee-item-off' : ''}"></i>
        <h4>${esc(it.name)}${it.active === false ? ' <small>(inactive)</small>' : ''}</h4>
        <div class="price">${money(it.price)}</div>
      </div>`).join('')
      : '<p style="color:var(--text-light)">No fee items configured yet.</p>';
  }

  /* non-Secretary: show the receipt panel as a read-only notice, never a form */
  const form = document.getElementById('posForm');
  const roNote = document.getElementById('posReadOnlyNotice');
  if (form && !canPay) form.style.display = 'none';
  if (roNote) roNote.innerHTML = canPay ? '' :
    `<div class="panel-body" style="background:var(--cream);border-radius:8px;font-size:0.88rem">
       <i class="fas fa-eye"></i> <strong>Read-only.</strong> Payments are recorded by the Secretary in the Fee Collection
       POS. You can review the payment history below, but balances and transactions cannot be changed from here.
     </div>`;

  if (form && canPay && !form.dataset.bound) {
    form.dataset.bound = '1';
    form.addEventListener('submit', e => {
      e.preventDefault();
      const studentId = document.getElementById('posStudent').value;
      const method = document.getElementById('posMethod').value;
      if (!studentId) { toast('Please select a student.', 'error'); return; }
      if (!posCart.length) { toast('Cart is empty. Add fee items first.', 'error'); return; }
      const total = posCart.reduce((a, b) => a + b.price, 0);
      const r = (typeof Payments !== 'undefined') ? Payments.record({
        studentId, amount: total, method,
        item: posCart.length === 1 ? posCart[0].name : posCart.length + ' fee items',
        clientToken: 'pos_' + DB.uid()
      }) : { ok: false, error: 'Fee modules not loaded.' };
      if (!r.ok) { toast(r.error, 'error'); return; }
      toast('Payment recorded! Receipt: ' + r.payment.receiptNo);
      posCart.length = 0;
      form.reset();
      renderPOSReceipt();
      renderPaymentsTable();
      refreshPOSStudentSelect();
      loadAdminDashboard();
    });
  }

  const sSearch = document.getElementById('posStudent');
  if (sSearch && !sSearch.dataset.bound) {
    sSearch.dataset.bound = '1';
  }
  if (canPay) refreshPOSStudentSelect();

  renderPOSReceipt();
  renderPaymentsTable();
}

function refreshPOSStudentSelect() {
  const sel = document.getElementById('posStudent');
  if (!sel) return;
  const students = DB.get('students');
  const current = sel.value;
  sel.innerHTML = '<option value="">Select student…</option>' + students.map(s => `<option value="${s.id}">${esc(s.firstName)} ${esc(s.lastName)} — Grade ${esc(s.grade)}</option>`).join('');
  if (current && students.some(s => s.id === current)) sel.value = current;
}

function addToCart(id) {
  if (!Perm.canRecordPayments()) { toast('Only the Secretary may build a payment.', 'error'); return; }
  const it = (typeof Fees !== 'undefined' ? Fees.activeItems() : []).find(x => x.id === id);
  if (!it) { toast('That fee item is not active.', 'error'); return; }
  posCart.push({ ...it });
  renderPOSReceipt();
  toast(it.name + ' added to receipt.', 'info');
}

function removeFromCart(i) {
  posCart.splice(i, 1);
  renderPOSReceipt();
}

function renderPOSReceipt() {
  const body = document.getElementById('posReceiptBody');
  if (!body) return;
  const total = posCart.reduce((a, b) => a + b.price, 0);
  body.innerHTML = posCart.length
    ? posCart.map((it, i) => `<div class="r-line"><span>${esc(it.name)}</span><span style="display:flex;gap:8px;align-items:center">${money(it.price)}<button class="btn-icon btn-danger" style="width:22px;height:22px;font-size:0.65rem" onclick="removeFromCart(${i})"><i class="fas fa-xmark"></i></button></span></div>`).join('') +
      `<div class="r-total"><span>Total</span><span>${money(total)}</span></div>`
    : `<div class="empty-state" style="padding:30px 10px"><i class="fas fa-receipt" style="font-size:1.8rem"></i><h4 style="font-size:0.9rem">Cart is empty</h4><p style="font-size:0.78rem">Click a fee item to add it.</p></div>`;
}

function renderPaymentsTable() {
  const tbody = document.getElementById('paymentsBody');
  if (!tbody) return;
  const payments = DB.get('payments').filter(p => !p.reversed && !p.deleted).reverse();
  tbody.innerHTML = payments.length ? payments.map(p => `
    <tr>
      <td><strong>${esc(p.receiptNo)}</strong></td>
      <td>${esc(p.studentName)}</td>
      <td>${esc(p.item)}<br><small style="color:var(--text-light)">${esc(termLabel(p.term))} ${esc(p.academicYear || '')}</small></td>
      <td><strong>${money(p.amount)}</strong></td>
      <td>${esc(p.method)}</td>
      <td>${fmtDate(p.paymentDate || p.date)}</td>
      <td>${fmtDate(Payments.systemDateOf(p))}</td>
      <td style="white-space:nowrap">${typeof FeeProUI !== 'undefined' ? FeeProUI.receiptButtons(p.id, true) : ''}</td>
    </tr>`).join('') : `<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--text-light)">No payments yet</td></tr>`;
}

/* ============================================================
   TEACHER DASHBOARD
   ============================================================ */
function initTeacher() {
  const s = Auth.require(['teacher']);
  if (!s) return;
  renderTopbarUser(s);
  initSidebar();
  loadTeacherDashboard();
  initExamBuilder();
  renderMyExams(s);
  renderTeacherTimetable(s);
  renderTeacherStudents();
  if (typeof initTeacherModules === 'function') initTeacherModules();
  // approval workflow: submit documents + track them (approvals.js)
  if (typeof ApprovalUI !== 'undefined' && typeof ApprovalUI.initSubmitForm === 'function') ApprovalUI.initSubmitForm();
  if (typeof renderMySubmissions === 'function') renderMySubmissions();
}

function loadTeacherDashboard() {
  const s = Auth.session();
  const exams = DB.get('exams').filter(e => e.teacherId === s.id || e.teacherName === s.name);
  const students = DB.get('students');
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('tcName', s.name);
  set('tcSubject', s.subject || 'Teacher');
  set('tcExamCount', exams.length);
  set('tcStudentCount', students.length);
  set('tcGradedCount', exams.reduce((a, b) => a + (b.attempts || 0), 0));
}

/* ---------- EXAM BUILDER ---------- */
let examQuestions = [];
let questionBlockSeq = 0;

function initExamBuilder() {
  const addQBtn = document.getElementById('addQuestionBtn');
  if (addQBtn) addQBtn.addEventListener('click', () => addQuestionBlock());

  const form = document.getElementById('examForm');
  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const s = Auth.session();
      const title = document.getElementById('examTitle').value.trim();
      const subject = document.getElementById('examSubject').value;
      const grade = document.getElementById('examGrade').value;
      const date = document.getElementById('examDate').value;
      const duration = document.getElementById('examDuration').value;

      const collected = collectQuestions();
      if (!title || !subject || !grade) { toast('Please fill all required fields.', 'error'); return; }
      if (!collected.ok) { toast(collected.error, 'error'); return; }
      const questions = collected.questions;
      const totalMarks = questions.reduce((a, q) => a + q.marks, 0);

      const exams = DB.get('exams');
      const record = {
        id: DB.uid(), title, subject, grade, className: classNameForGrade(grade), date, duration, totalMarks,
        questions, teacherId: s.id, teacherName: s.name, uploadedDate: today(), attempts: 0, resultsPublished: false,
        createdByRole: s.role
      };
      /* APPROVAL GATE: an exam paper authored by a teacher is quarantined and
         queued. It is never published straight to the student portal. */
      const gated = s.role === 'teacher';
      if (gated) { record.status = 'pending'; record.approvalStatus = 'chiefexaminer'; }
      else { record.status = 'published'; record.approvalStatus = 'published'; }
      exams.push(record);
      DB.set('exams', exams);
      form.reset();
      examQuestions = [];
      document.getElementById('questionsContainer').innerHTML = '';
      if (gated) {
        const r = ApprovalGate.routeSave('exams', record, {
          docType: 'exam_paper',
          title: record.title,
          content: ApprovalGate.examSummary(record),
          className: record.className, subject: record.subject
        });
        if (!r.ok) {
          DB.set('exams', DB.get('exams').filter(x => x.id !== record.id));
          toast(r.error || 'Could not submit this exam for approval.', 'error');
          return;
        }
        DB.set('exams', DB.get('exams'));
        toast('Exam submitted for approval (' + r.approvalTrackingNo + '). Students will not see it until the Chief Examiner, Headteacher and Secretary approve it. Total marks: ' + totalMarks + '.');
        Audit.log('exam.create', record.title + ' — submitted for approval ' + r.approvalTrackingNo);
      } else {
        toast('Exam published to student portal! Total marks: ' + totalMarks + '.');
      }
      renderMyExams(s);
      loadTeacherDashboard();
    });
  }

  // preload subjects/grades
  const subSel = document.getElementById('examSubject');
  if (subSel && !subSel.options.length) {
    ['Mathematics','Science','English','Social Studies','Religion','Spanish','Art','Physical Education','Computer Science'].forEach(x => {
      subSel.innerHTML += `<option value="${x}">${x}</option>`;
    });
  }
  const gradeSel = document.getElementById('examGrade');
  if (gradeSel && !gradeSel.options.length) {
    ['Pre-K','K','1','2','3','4','5','6','7','8','9','10','11','12'].forEach(x => {
      gradeSel.innerHTML += `<option value="${x}">Grade ${x}</option>`;
    });
  }
}

function addQuestionBlock() {
  const container = document.getElementById('questionsContainer');
  if (!container) return;
  // unique radio-group name per block (duplicate names silently un-check each other,
  // which used to wipe the answer key when a question was removed and re-added)
  const qid = 'qb_' + (++questionBlockSeq) + '_' + Date.now().toString(36);
  const letters = ['A', 'B', 'C', 'D'];
  const div = document.createElement('div');
  div.className = 'question-block';
  div.dataset.qid = qid;
  div.innerHTML = `
    <div class="q-head">
      <span class="q-num">Question <span class="q-index">${container.children.length + 1}</span></span>
      <button type="button" class="q-remove" onclick="removeQuestionBlock(this)"><i class="fas fa-trash"></i></button>
    </div>
    <div class="form-grid" style="margin-bottom:12px">
      <div class="form-group" style="margin-bottom:0">
        <label>Question Type</label>
        <select class="q-type-input" onchange="toggleQuestionType(this)">
          <option value="mcq">Multiple choice (auto-marked)</option>
          <option value="written">Written / essay (teacher-marked)</option>
        </select>
      </div>
      <div class="form-group" style="margin-bottom:0">
        <label>Marks</label>
        <input type="number" class="q-marks" value="1" min="1" style="max-width:100px">
      </div>
    </div>
    <div class="form-group" style="margin-bottom:12px">
      <label>Question Text <span class="req">*</span></label>
      <textarea class="q-text-input" rows="2" placeholder="Enter your question..."></textarea>
    </div>
    <div class="q-options-wrap">
      <label style="font-size:0.8rem;font-weight:600;color:var(--navy);display:block;margin-bottom:8px">Options (select the correct answer)</label>
      ${letters.map((L, i) => `
        <div class="option-row">
          <span class="opt-letter">${L}</span>
          <input type="text" class="q-option-input" data-option-id="${L}" placeholder="Option ${L}">
          <input type="radio" name="correct_${qid}" value="${L}" ${i === 0 ? 'checked' : ''} title="Mark as correct">
        </div>`).join('')}
      <p style="font-size:0.78rem;color:var(--text-light);margin-top:6px">Fill at least two options and mark the correct one. Options left empty are ignored.</p>
    </div>
    <div class="q-written-wrap" style="display:none">
      <p style="font-size:0.85rem;color:var(--text-light);margin:0"><i class="fas fa-user-pen"></i> Students type their answer for this question. You award the marks when marking the exam.</p>
    </div>`;
  container.appendChild(div);
}

function renumberQuestionBlocks() {
  document.querySelectorAll('#questionsContainer .question-block').forEach((b, i) => {
    const n = b.querySelector('.q-num .q-index');
    if (n) n.textContent = i + 1;
  });
}

function removeQuestionBlock(btn) {
  const block = btn.closest ? btn.closest('.question-block') : null;
  if (block) block.remove();
  renumberQuestionBlocks();
}

function toggleQuestionType(sel) {
  const block = sel.closest('.question-block');
  if (!block) return;
  const opts = block.querySelector('.q-options-wrap');
  const wr = block.querySelector('.q-written-wrap');
  const written = sel.value === 'written';
  if (opts) opts.style.display = written ? 'none' : 'block';
  if (wr) wr.style.display = written ? 'block' : 'none';
}

function collectQuestions() {
  const blocks = [...document.querySelectorAll('#questionsContainer .question-block')];
  const questions = [];
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const text = block.querySelector('.q-text-input').value.trim();
    const typeSel = block.querySelector('.q-type-input');
    const type = typeSel && typeSel.value === 'written' ? 'written' : 'mcq';
    const marks = Math.max(1, Number(block.querySelector('.q-marks').value || 1));
    if (!text) return { ok: false, error: 'Question ' + (i + 1) + ' is missing its question text.' };
    if (type === 'written') {
      questions.push({ id: 'q' + (i + 1), type: 'written', text, options: [], correctOptionId: '', marks });
      continue;
    }
    // keep option IDs stable (A-D) and only keep filled options — the correct answer
    // is stored by option ID so filtering empty options can no longer shift the key
    const options = [...block.querySelectorAll('.q-option-input')]
      .map(inp => ({ id: inp.dataset.optionId || inp.getAttribute('data-option-id') || 'A', text: inp.value.trim() }))
      .filter(o => o.text);
    if (options.length < 2) return { ok: false, error: 'Question ' + (i + 1) + ': multiple-choice questions need at least two filled options.' };
    const checked = block.querySelector('input[type="radio"]:checked');
    const correctOptionId = checked ? String(checked.value) : '';
    if (!options.some(o => o.id === correctOptionId)) {
      return { ok: false, error: 'Question ' + (i + 1) + ': select the correct answer from the filled options.' };
    }
    questions.push({ id: 'q' + (i + 1), type: 'mcq', text, options, correctOptionId, marks });
  }
  if (!questions.length) return { ok: false, error: 'Add at least one question.' };
  return { ok: true, questions };
}

function renderMyExams(session) {
  const s = session || Auth.session();
  const list = document.getElementById('myExamsList');
  if (!list) return;
  const exams = DB.get('exams').filter(e => e.teacherId === s.id || e.teacherName === s.name);
  const subs = DB.get('examResults');
  list.innerHTML = exams.length ? [...exams].reverse().map(ex => {
    const exSubs = subs.filter(r => r.examId === ex.id);
    const pending = exSubs.filter(r => r.markingStatus === 'pending' || r.markingStatus === 'marking').length;
    return `
    <div class="exam-card">
      <div class="e-info">
        <h3>${esc(ex.title)}</h3>
        <div class="e-meta">
          <span><i class="fas fa-book"></i> ${esc(ex.subject)}</span>
          <span><i class="fas fa-graduation-cap"></i> ${esc(ex.className || classNameForGrade(ex.grade))}</span>
          <span><i class="fas fa-calendar"></i> ${fmtDate(ex.date)}</span>
          <span><i class="fas fa-clock"></i> ${esc(ex.duration)} min</span>
          <span><i class="fas fa-star"></i> ${esc(ex.totalMarks || examMaxMarks(ex))} marks</span>
          <span><i class="fas fa-list-ol"></i> ${ex.questions.length} questions</span>
          <span><i class="fas fa-users"></i> ${exSubs.length} submission${exSubs.length === 1 ? '' : 's'}</span>
        </div>
      </div>
      <div class="table-actions" style="flex-direction:column;align-items:stretch;gap:6px">
        ${pending ? `<span class="badge badge-warning">${pending} awaiting marking</span>` : ''}
        <button class="btn btn-sm btn-outline" onclick="previewExam('${ex.id}')"><i class="fas fa-eye"></i> Preview</button>
        <button class="btn btn-sm btn-primary" onclick="document.querySelector('[data-section=marking]') ? document.querySelector('[data-section=marking]').click() : null"><i class="fas fa-pen-ruler"></i> Marking</button>
        <button class="btn btn-sm btn-danger" onclick="deleteExam('${ex.id}')"><i class="fas fa-trash"></i></button>
      </div>
    </div>`;
  }).join('') : `<div class="empty-state"><i class="fas fa-file-lines"></i><h4>No exams published yet</h4><p>Create your first exam using the builder above.</p></div>`;
}

function deleteExam(id) {
  if (!confirm('Delete this exam?')) return;
  DB.set('exams', DB.get('exams').filter(x => x.id !== id));
  renderMyExams();
  loadTeacherDashboard();
  toast('Exam deleted.', 'info');
}

function previewExam(id) {
  const ex = normalizeExamForUse(DB.get('exams').find(x => x.id === id));
  if (!ex) return;
  const body = document.getElementById('previewExamBody');
  body.innerHTML = `
    <div class="exam-paper" style="box-shadow:none;padding:0">
      <div class="paper-head">
        <h2>${esc(ex.title)}</h2>
        <p style="color:var(--text-light)">${esc(ex.subject)} · ${esc(ex.className || classNameForGrade(ex.grade))}</p>
        <div class="paper-meta">
          <span><i class="fas fa-calendar"></i> ${fmtDate(ex.date)}</span>
          <span><i class="fas fa-clock"></i> ${esc(ex.duration)} minutes</span>
          <span><i class="fas fa-star"></i> ${esc(ex.totalMarks)} marks</span>
        </div>
      </div>
      ${ex.questions.map((q, i) => `
        <div class="exam-q">
          <div class="q-text">${i + 1}. ${esc(q.text)}<span class="q-mark">${q.marks} mark${q.marks > 1 ? 's' : ''}</span></div>
          ${q.type === 'written'
            ? `<p style="font-size:0.85rem;color:var(--text-light);margin:6px 0 0"><i class="fas fa-user-pen"></i> Written answer — marked by the teacher${questionHasValidKey(q) ? '' : ''}.</p>`
            : q.options.map((o) => `
            <div class="q-option" style="${o.id === q.correctOptionId ? 'border-color:var(--success);background:rgba(22,163,74,0.08)' : ''}">
              <span class="opt-key">${esc(o.id)}</span>
              <span>${esc(o.text)} ${o.id === q.correctOptionId ? '<i class="fas fa-check-circle" style="color:var(--success);margin-left:6px"></i>' : ''}</span>
            </div>`).join('')}
          ${q.type !== 'written' && !questionHasValidKey(q) ? `<p style="font-size:0.8rem;color:var(--danger);margin:6px 0 0"><i class="fas fa-triangle-exclamation"></i> No valid answer key — this question will require teacher marking.</p>` : ''}
        </div>`).join('')}
    </div>`;
  openModal('previewExamModal');
}

function renderTeacherTimetable() {
  const wrap = document.getElementById('tcTimetable');
  if (!wrap) return;
  if (typeof Timetable === 'undefined') return;
  const s = Auth.session();
  if (!Timetable.isPublished()) {
    wrap.innerHTML = `<div class="empty-state"><i class="fas fa-calendar"></i><h4>Timetable not published yet</h4>
      <p>The secretary is still preparing the official school timetable. Your teaching timetable will appear here as soon as it is published.</p></div>`;
    return;
  }
  const rows = Timetable.entriesForTeacher(s.name, Timetable.publishedEntries());
  if (!rows.length) {
    wrap.innerHTML = `<div class="empty-state"><i class="fas fa-calendar"></i><h4>No classes assigned</h4>
      <p>The published timetable does not currently include any lessons for you.</p></div>`;
    return;
  }
  const m = Timetable.publishedMeta();
  wrap.innerHTML =
    `<div class="tt-portal-toolbar"><button class="btn btn-outline btn-sm" onclick="ttPrintMyTimetable()"><i class="fas fa-print"></i> Print / Save as PDF</button></div>` +
    Timetable.gridHeaderHTML({ title: 'My Teaching Timetable', meta: 'Academic Year ' + esc(String(m.academicYear)) + ' · Term ' + esc(String(m.term)) + ' · ' + rows.length + ' lessons' }) +
    Timetable.buildGrid(rows, { secondary: e => [e.className || e.grade, e.room].filter(Boolean).join(' · ') });
}

function renderTeacherStudents() {
  const tbody = document.getElementById('tcStudentsBody');
  if (!tbody) return;
  const students = DB.get('students');
  tbody.innerHTML = students.length ? students.map(st => `
    <tr>
      <td><strong>${esc(st.firstName)} ${esc(st.lastName)}</strong></td>
      <td>Grade ${esc(st.grade)}</td>
      <td>${esc(st.email)}</td>
      <td><span class="badge badge-${st.status === 'active' ? 'success' : 'warning'}">${esc(st.status)}</span></td>
    </tr>`).join('') : `<tr><td colspan="4" style="text-align:center;padding:30px;color:var(--text-light)">No students enrolled</td></tr>`;
}

/* ============================================================
   SECRETARY DASHBOARD
   ============================================================ */
function initSecretary() {
  const s = Auth.require(['secretary']);
  if (!s) return;
  renderTopbarUser(s);
  initSidebar();
  // full student-management portal (defined in portals.js, uses Students module from modules.js)
  if (typeof initSecretaryPortal === 'function') {
    initSecretaryPortal();
  } else {
    // legacy fallback (only if modules.js/portals.js failed to load)
    loadSecretaryDashboard();
    initSecretaryAdmit();
    renderSecretaryRecords();
    renderSecretaryPayments();
  }
  // official timetable + publication queue (timetable.js / approvals.js / reviewportals.js)
  if (typeof initSecretaryTimetable === 'function') initSecretaryTimetable();
}

function loadSecretaryDashboard() {
  const students = DB.get('students');
  const payments = DB.get('payments');
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('secTotalStudents', students.length);
  set('secActive', students.filter(x => x.status === 'active').length);
  set('secPending', students.filter(x => x.status === 'pending').length);
  const totalCollected = payments.filter(p => !p.reversed && !p.deleted).reduce((a, b) => a + Number(b.amount || 0), 0);
  const outstanding = students.reduce((a, b) => a + Number(b.feeBalance || 0), 0);
  set('secCollected', money(totalCollected));
  set('secOutstanding', money(outstanding));

  const tbody = document.getElementById('secRecentBody');
  if (tbody) {
    const recent = [...students].reverse().slice(0, 6);
    tbody.innerHTML = recent.length ? recent.map(st => `
      <tr>
        <td><strong>${esc(st.firstName)} ${esc(st.lastName)}</strong></td>
        <td>Grade ${esc(st.grade)}</td>
        <td>${esc(st.parentName || '—')}</td>
        <td>${fmtDate(st.admissionDate)}</td>
        <td><span class="badge badge-${st.status === 'active' ? 'success' : 'warning'}">${esc(st.status)}</span></td>
      </tr>`).join('') : `<tr><td colspan="5" style="text-align:center;color:var(--text-light)">No admissions yet</td></tr>`;
  }
}

function initSecretaryAdmit() {
  const form = document.getElementById('admitForm');
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const data = {
      id: DB.uid(),
      firstName: document.getElementById('adFName').value.trim(),
      lastName: document.getElementById('adLName').value.trim(),
      email: document.getElementById('adEmail').value.trim(),
      grade: document.getElementById('adGrade').value,
      gender: document.getElementById('adGender').value,
      dob: document.getElementById('adDob').value,
      parentName: document.getElementById('adParent').value.trim(),
      parentPhone: document.getElementById('adParentPhone').value.trim(),
      address: document.getElementById('adAddress').value.trim(),
      status: 'pending',
      feeBalance: Number(document.getElementById('adFee').value || 0),
      admissionDate: today()
    };
    if (!data.firstName || !data.lastName || !data.grade) { toast('Please fill required fields.', 'error'); return; }
    /* legacy fallback path — the same fee rule applies here */
    if (data.feeBalance !== 0 && typeof Perm !== 'undefined' && !Perm.canManageFees()) {
      toast('Only the Secretary may set fee amounts.', 'error'); return;
    }

    const students = DB.get('students');
    students.push(data);
    DB.set('students', students);
    if (typeof Fees !== 'undefined') Fees.announceOpening(data);

    // create login — the user id MUST match the student record id
    const uname = (data.firstName[0] + data.lastName + data.grade).toLowerCase().replace(/[^a-z0-9]/g, '');
    const acct = await Security.createAccount({
      id: data.id, username: uname, role: 'student',
      name: data.firstName + ' ' + data.lastName, email: data.email, grade: data.grade
    });
    if (!acct.ok) { toast(acct.error, 'error'); return; }

    form.reset();
    toast('Student admitted! Login: ' + uname);
    renderSecretaryRecords();
    loadSecretaryDashboard();

    document.getElementById('admitResult').innerHTML = `
      <div style="background:var(--success-bg);color:var(--success);padding:14px 18px;border-radius:8px;font-weight:600;margin-top:16px">
        <i class="fas fa-circle-check"></i> ${esc(data.firstName)} ${esc(data.lastName)} admitted successfully.
        <br><small style="font-weight:400">Portal login: <strong>${esc(uname)}</strong> — temporary password shown below.</small>
      </div>`;
    SettingsUI._showTempPassword(acct.user, acct.tempPassword);
  });
}

function renderSecretaryRecords() {
  const tbody = document.getElementById('secRecordsBody');
  if (!tbody) return;
  const students = DB.get('students');
  tbody.innerHTML = students.length ? students.map(st => `
    <tr>
      <td><strong>${esc(st.firstName)} ${esc(st.lastName)}</strong><br><small style="color:var(--text-light)">${esc(st.email)}</small></td>
      <td>Grade ${esc(st.grade)}</td>
      <td>${esc(st.parentName || '—')}<br><small style="color:var(--text-light)">${esc(st.parentPhone || '')}</small></td>
      <td>${money(st.feeBalance || 0)}</td>
      <td><span class="badge badge-${st.status === 'active' ? 'success' : st.status === 'pending' ? 'warning' : 'danger'}">${esc(st.status)}</span></td>
      <td class="table-actions">
        ${st.status === 'pending' ? `<button class="btn btn-xs btn-success" onclick="approveStudent('${st.id}')"><i class="fas fa-check"></i> Approve</button>` : ''}
        <button class="btn btn-xs btn-outline" onclick="viewStudentRecord('${st.id}')"><i class="fas fa-eye"></i></button>
      </td>
    </tr>`).join('') : `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-light)">No student records</td></tr>`;
}

function approveStudent(id) {
  const students = DB.get('students');
  const i = students.findIndex(x => x.id === id);
  if (i > -1) { students[i].status = 'active'; DB.set('students', students); }
  renderSecretaryRecords();
  loadSecretaryDashboard();
  toast('Student approved and activated!');
}

function viewStudentRecord(id) {
  const st = DB.get('students').find(x => x.id === id);
  if (!st) return;
  const payments = DB.get('payments').filter(p => (p.studentId === id || p.studentName === (st.firstName + ' ' + st.lastName)) && !p.reversed && !p.deleted);
  const totalPaid = payments.reduce((a, b) => a + Number(b.amount || 0), 0);
  document.getElementById('viewStudentBody').innerHTML = `
    <div class="form-grid" style="margin-bottom:18px">
      <div class="form-group"><label>Full Name</label><div style="font-weight:600">${esc(st.firstName)} ${esc(st.lastName)}</div></div>
      <div class="form-group"><label>Grade</label><div style="font-weight:600">Grade ${esc(st.grade)}</div></div>
      <div class="form-group"><label>Email</label><div>${esc(st.email || '—')}</div></div>
      <div class="form-group"><label>Date of Birth</label><div>${fmtDate(st.dob)}</div></div>
      <div class="form-group"><label>Parent/Guardian</label><div>${esc(st.parentName || '—')}</div></div>
      <div class="form-group"><label>Parent Phone</label><div>${esc(st.parentPhone || '—')}</div></div>
      <div class="form-group full"><label>Address</label><div>${esc(st.address || '—')}</div></div>
      <div class="form-group"><label>Status</label><span class="badge badge-${st.status === 'active' ? 'success' : 'warning'}">${esc(st.status)}</span></div>
      <div class="form-group"><label>Fee Balance</label><div style="font-weight:800;color:var(--danger)">${money(st.feeBalance || 0)}</div></div>
    </div>
    <h4 style="color:var(--navy);margin-bottom:10px">Payment History (Total paid: ${money(totalPaid)})</h4>
    ${payments.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Receipt</th><th>Item</th><th>Amount</th><th>Date</th></tr></thead><tbody>
      ${payments.map(p => `<tr><td>${esc(p.receiptNo)}</td><td>${esc(p.item)}</td><td>${money(p.amount)}</td><td>${fmtDate(p.date)}</td></tr>`).join('')}
    </tbody></table></div>` : '<p style="color:var(--text-light)">No payments recorded for this student.</p>'}`;
  openModal('viewStudentModal');
}

function renderSecretaryPayments() {
  const tbody = document.getElementById('secPaymentsBody');
  if (!tbody) return;
  const payments = [...DB.get('payments')].reverse();
  tbody.innerHTML = payments.length ? payments.map(p => `
    <tr>
      <td><strong>${esc(p.receiptNo)}</strong></td>
      <td>${esc(p.studentName)}</td>
      <td>${esc(p.item)}</td>
      <td><strong>${money(p.amount)}</strong></td>
      <td>${esc(p.method)}</td>
      <td>${fmtDate(p.date)}</td>
    </tr>`).join('') : `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-light)">No payments recorded</td></tr>`;
}

/* ============================================================
   STUDENT DASHBOARD
   ============================================================ */
function initStudent() {
  const s = Auth.require(['student']);
  if (!s) return;
  renderTopbarUser(s);
  initSidebar();
  // full school-portal UI (defined in portals.js)
  if (typeof initStudentPortal === 'function') {
    initStudentPortal();
  } else {
    loadStudentDashboard(s);
    renderStudentExams(s);
    renderStudentTimetable(s);
    renderStudentFees(s);
  }
  // approved / published school documents (approvals.js)
  if (typeof renderStudentDocuments === 'function') renderStudentDocuments();
}

function loadStudentDashboard(s) {
  const student = studentForSession(s);
  /* APPROVAL GATE: only exams that completed the whole chain count here. */
  const exams = DB.get('exams').filter(e => examMatchesStudent(e, student) && ApprovalGate.approvedForStudents(e));
  const payments = DB.get('payments').filter(p => p.studentId === s.id || p.studentName === s.name);
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('stuName', s.name);
  set('stuGrade', student.className || ('Grade ' + s.grade));
  set('stuExamCount', exams.length);
  set('stuPaid', money(payments.reduce((a, b) => a + Number(b.amount || 0), 0)));
  set('stuBalance', money(student.feeBalance || 0));
}

function markingStatusBadge(status) {
  const label = (typeof ExamMarking !== 'undefined') ? ExamMarking.statusLabel(status) : status;
  const badge = (typeof ExamMarking !== 'undefined') ? ExamMarking.badgeFor(status) : 'warning';
  return `<span class="badge badge-${badge}">${esc(label)}</span>`;
}

function renderStudentExams(s) {
  const list = document.getElementById('stuExamList');
  if (!list) return;
  const student = studentForSession(s);
  /* APPROVAL GATE: a student never sees or starts an exam paper that has not
     completed Teacher → Chief Examiner → Headteacher → Secretary → Published. */
  const all = DB.get('exams').filter(e => examMatchesStudent(e, student));
  const exams = all.filter(e => ApprovalGate.approvedForStudents(e));
  const approvedIds = exams.map(e => e.id);
  const results = DB.get('examResults').filter(r => r.studentId === s.id && approvedIds.includes(r.examId));
  const withheld = all.length - exams.length;

  list.innerHTML = exams.length ? [...exams].reverse().map(ex => {
    const nEx = normalizeExamForUse(ex);
    const res = results.find(r => r.examId === ex.id);
    let action = `<button class="btn btn-sm btn-primary" onclick="startExam('${ex.id}')"><i class="fas fa-pen-to-square"></i> Take Exam</button>`;
    if (res) {
      if (res.markingStatus === 'published' || res.markingStatus === 'auto_scored') {
        action = `${markingStatusBadge('published')}
          <span class="badge badge-success">Score: ${res.score}/${res.maxMarks || res.total} (${res.percent}%)</span>
          <button class="btn btn-sm btn-outline" onclick="viewExamResult('${res.id}')"><i class="fas fa-eye"></i> View Result</button>`;
      } else {
        action = `${markingStatusBadge(res.markingStatus)}
          <button class="btn btn-sm btn-outline" onclick="viewExamResult('${res.id}')"><i class="fas fa-eye"></i> Submission Details</button>`;
      }
    }
    return `
    <div class="exam-card">
      <div class="e-info">
        <h3>${esc(ex.title)}</h3>
        <div class="e-meta">
          <span><i class="fas fa-book"></i> ${esc(ex.subject)}</span>
          <span><i class="fas fa-graduation-cap"></i> ${esc(nEx.className || classNameForGrade(ex.grade))}</span>
          <span><i class="fas fa-calendar"></i> ${fmtDate(ex.date)}</span>
          <span><i class="fas fa-clock"></i> ${esc(ex.duration)} min</span>
          <span><i class="fas fa-star"></i> ${esc(nEx.totalMarks)} marks</span>
          <span><i class="fas fa-list-ol"></i> ${nEx.questions.length} questions</span>
        </div>
      </div>
      <div class="table-actions" style="flex-direction:column;align-items:stretch;gap:6px">
        ${action}
      </div>
    </div>`;
  }).join('') : `<div class="empty-state"><i class="fas fa-file-lines"></i><h4>No exams available</h4><p>Exams for your grade will appear here once published.</p></div>`;
  if (withheld > 0) {
    list.innerHTML += `<p style="margin-top:14px;font-size:.85rem;color:var(--text-light)"><i class="fas fa-lock"></i> ${withheld} exam${withheld === 1 ? '' : 's'} for your grade ${withheld === 1 ? 'is' : 'are'} still going through the approval process and ${withheld === 1 ? 'is' : 'are'} not yet available.</p>`;
  }
}

let currentExam = null;
let currentAnswers = {};

function examAnswerCount(ex) {
  return ex.questions.filter((q, i) => {
    const a = currentAnswers[i];
    if (!a) return false;
    if (q.type === 'written') return !!(a.text && String(a.text).trim());
    return !!(a.optionId);
  }).length;
}

function startExam(id) {
  const raw = DB.get('exams').find(x => x.id === id);
  if (!raw) return;
  /* APPROVAL GATE: never serve an unapproved paper, even from a direct call. */
  if (!ApprovalGate.approvedForStudents(raw)) { toast('This exam has not been approved for publication yet.', 'error'); return; }
  const ex = normalizeExamForUse(raw);
  if (!ex) return;
  const s = Auth.session();
  const student = studentForSession(s);
  if (!examMatchesStudent(ex, student)) { toast('This exam is not published to your class.', 'error'); return; }
  const existing = (typeof ExamMarking !== 'undefined') ? ExamMarking.submissionFor(ex.id, s.id) : null;
  if (existing) { toast('You have already submitted this exam. Duplicate submissions are not allowed.', 'info'); return; }
  currentExam = ex;
  currentAnswers = {};
  renderExamPaper(ex);
  openModal('takeExamModal');
}

function renderExamPaper(ex) {
  document.getElementById('takeExamBody').innerHTML = `
    <div class="exam-paper">
      <div class="paper-head">
        <h2>${esc(ex.title)}</h2>
        <p style="color:var(--text-light)">${esc(ex.subject)} · ${esc(ex.className || classNameForGrade(ex.grade))}</p>
        <div class="paper-meta">
          <span><i class="fas fa-clock"></i> ${esc(ex.duration)} minutes</span>
          <span><i class="fas fa-star"></i> ${esc(ex.totalMarks)} marks</span>
        </div>
      </div>
      ${ex.questions.map((q, i) => `
        <div class="exam-q">
          <div class="q-text">${i + 1}. ${esc(q.text)}<span class="q-mark">${q.marks} mark${q.marks > 1 ? 's' : ''}</span></div>
          ${q.type === 'written'
            ? `<textarea id="wtext_${i}" rows="4" style="width:100%;margin-top:8px;padding:10px;border:2px solid var(--border);border-radius:8px;font-family:inherit;font-size:0.92rem;resize:vertical" placeholder="Type your answer here..." oninput="selectWritten(${i}, this.value)"></textarea>`
            : q.options.map((o) => `
            <div class="q-option" id="opt_${i}_${esc(o.id)}" onclick="selectOption(${i},'${esc(o.id)}')">
              <span class="opt-key">${esc(o.id)}</span>
              <span>${esc(o.text)}</span>
            </div>`).join('')}
        </div>`).join('')}
      <p style="font-size:0.82rem;color:var(--text-light);margin:12px 0 0"><i class="fas fa-circle-info"></i> Multiple-choice questions with an answer key are marked automatically. Written questions and questions without an answer key are marked by your teacher. Results are released after marking and approval.</p>
      <button class="btn btn-primary" style="width:100%;margin-top:10px" onclick="submitExam()"><i class="fas fa-paper-plane"></i> Submit Exam</button>
    </div>`;
}

function selectOption(qi, optionId) {
  currentAnswers[qi] = { optionId: String(optionId) };
  document.querySelectorAll(`[id^="opt_${qi}_"]`).forEach(el => el.classList.remove('selected'));
  const el = document.getElementById(`opt_${qi}_${optionId}`);
  if (el) el.classList.add('selected');
}

function selectWritten(qi, value) {
  currentAnswers[qi] = { text: String(value || '') };
}

function submitExam() {
  if (!currentExam) return;
  const totalQ = currentExam.questions.length;
  const answered = examAnswerCount(currentExam);
  if (answered < totalQ && !confirm(`You have answered ${answered} of ${totalQ} questions. Submit anyway?`)) return;

  const r = ExamMarking.submit(currentExam.id, currentAnswers);
  if (!r.ok) { toast(r.error, 'error'); return; }
  const sub = r.submission;
  const unmarked = ExamMarking.unmarkedCount(sub);

  document.getElementById('takeExamBody').innerHTML = `
    <div class="exam-result" style="text-align:center;padding:10px 0">
      <div style="width:86px;height:86px;border-radius:50%;background:var(--success-bg);color:var(--success);display:flex;align-items:center;justify-content:center;font-size:2.2rem;margin:0 auto 16px"><i class="fas fa-check"></i></div>
      <h3 style="color:var(--navy);margin-bottom:8px">Submission Received</h3>
      <p style="color:var(--text-light);margin-bottom:6px"><strong>${esc(sub.examTitle)}</strong></p>
      <p style="margin-bottom:6px">Your exam has been submitted successfully. Your results are awaiting teacher marking or approval.</p>
      <p style="margin-bottom:6px">${markingStatusBadge(sub.markingStatus)}</p>
      <p style="font-size:0.88rem;color:var(--text-light)">${unmarked
        ? unmarked + ' question' + (unmarked === 1 ? '' : 's') + ' will be marked by your teacher.'
        : 'All questions were marked automatically and are now awaiting approval and publication.'}</p>
      <p style="font-size:0.85rem;color:var(--text-light);margin-top:10px"><i class="fas fa-lock"></i> Marks are only shown in <strong>My Results</strong> after they have been published.</p>
      <button class="btn btn-primary" style="margin-top:20px" onclick="closeModal('takeExamModal');renderStudentExams(Auth.session())"><i class="fas fa-check"></i> Done</button>
    </div>`;
}

function renderStudentTimetable(s) {
  const wrap = document.getElementById('stuTimetable');
  if (!wrap) return;
  if (typeof Timetable === 'undefined') return;
  // A student only ever sees their OWN class timetable.
  const stu = (typeof studentForSession === 'function' ? studentForSession(s) : null) || {};
  const className = stu.className || s.className || s.grade;
  if (!Timetable.isPublished()) {
    wrap.innerHTML = `<div class="empty-state"><i class="fas fa-calendar"></i><h4>Timetable not available</h4>
      <p>Your class schedule will appear here once the secretary publishes it.</p></div>`;
    return;
  }
  const rows = Timetable.entriesForClass(className, Timetable.publishedEntries());
  if (!rows.length) {
    wrap.innerHTML = `<div class="empty-state"><i class="fas fa-calendar"></i><h4>Timetable not available</h4>
      <p>No published lessons were found for <strong>${esc(className || 'your class')}</strong>.</p></div>`;
    return;
  }
  const m = Timetable.publishedMeta();
  wrap.innerHTML =
    `<div class="tt-portal-toolbar"><button class="btn btn-outline btn-sm" onclick="ttPrintMyClass()"><i class="fas fa-print"></i> Print / Save as PDF</button></div>` +
    Timetable.gridHeaderHTML({ title: (className || 'My Class') + ' — Class Timetable', meta: 'Academic Year ' + esc(String(m.academicYear)) + ' · Term ' + esc(String(m.term)) }) +
    Timetable.buildGrid(rows, { secondary: e => [e.teacher, e.room].filter(Boolean).join(' · ') });
}

function renderStudentFees(s) {
  const tbody = document.getElementById('stuFeesBody');
  const student = (typeof studentForSession === 'function' ? studentForSession(s) : null) || DB.get('students').find(x => x.email === s.email) || {};
  const stId = student.id || s.id;
  if (!tbody) return;
  const payments = (typeof Payments !== 'undefined' && student.id) ? Payments.forStudent(student) : DB.get('payments').filter(p => p.studentId === s.id || p.studentName === s.name);
  const actions = document.getElementById('stuFeeActions');
  if (actions && stId) {
    actions.innerHTML = `
      <button class="btn btn-outline btn-sm" onclick="FeeUI.printFor('${esc(stId)}')"><i class="fas fa-print"></i> Print Statement</button>
      <button class="btn btn-primary btn-sm" onclick="FeeUI.downloadFor('${esc(stId)}')"><i class="fas fa-file-pdf"></i> Statement PDF</button>`;
  }
  tbody.innerHTML = payments.length ? payments.map(p => `
    <tr${p.reversed ? ' class="fee-item-off-row"' : ''}>
      <td><strong>${esc(p.receiptNo)}</strong>${p.reversed ? ' <span class="badge badge-warning">reversed</span>' : ''}</td>
      <td>${esc(p.item)}<br><small style="color:var(--text-light)">${esc(termLabel(p.term))} ${esc(p.academicYear || '')}</small></td>
      <td><strong>${money(p.amount)}</strong></td>
      <td>${esc(p.method)}${p.reference ? '<br><small style="color:var(--text-light)">Ref: ' + esc(p.reference) + '</small>' : ''}</td>
      <td>${fmtDate(p.paymentDate || p.date)}</td>
      <td>${fmtDate(Payments.systemDateOf(p))}</td>
      <td style="white-space:nowrap">${typeof FeeProUI !== 'undefined' ? FeeProUI.receiptButtons(p.id, true) : ''}</td>
    </tr>`).join('') : `<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text-light)">No payments recorded yet</td></tr>`;
  const bal = document.getElementById('stuBalanceRow');
  if (bal) bal.textContent = money(student.id ? Fees.balanceOf(student.id) : (student.feeBalance || 0));
  if (typeof FeeProUI !== 'undefined' && student.id) FeeProUI.renderStudentFeesPro(s, student);
}

/* ============================================================
   PAGE BOOTSTRAP
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  /* Load passport photos into memory before any portal renders, so the
     synchronous photoUrl() helper always has something to return. */
  try { await PhotoStore.init(); } catch (e) { /* non-fatal */ }
  const page = document.body.dataset.page;
  if (page === 'login') initLogin();
  else if (page === 'password') initChangePassword();
  else if (page === 'admin') initAdmin();
  else if (page === 'teacher') initTeacher();
  else if (page === 'secretary') initSecretary();
  else if (page === 'student') initStudent();
  else if (page === 'chiefexaminer' || page === 'headteacher') { if (typeof initReviewPortal === 'function') initReviewPortal(page); }
  else if (page === 'storekeeper') { if (typeof initStorePortal === 'function') initStorePortal(); }
  else if (page === 'kitchenmanager') { if (typeof initKitchenPortal === 'function') initKitchenPortal(); }
  else if (page === 'uniformstaff') { /* folded into Stores — same portal, same permissions */ if (typeof initStorePortal === 'function') initStorePortal(); }
});
