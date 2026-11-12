/* ============================================================
   ST. TERESA ACADEMY — PROFILE & SETTINGS
   Settings menu, My Profile, Edit Profile, Change Password,
   Security and (admin only) Accounts & Security.
   Loaded after admin.js + security.js. Mounts into every portal
   topbar via renderTopbarUser().
   ============================================================ */

const SettingsUI = {
  _mounted: false,
  _session: null,
  _tab: 'profile',

  /* Fields each role may edit about themselves. Students are deliberately
     restricted: no admission number, class, grade or marks may be touched. */
  _editable(role) {
    const staff = ['name', 'email', 'phone', 'photo', 'subject'];
    const map = {
      admin: staff, headteacher: staff, chiefexaminer: staff, secretary: staff,
      teacher: staff, storekeeper: staff, kitchenmanager: staff, uniformstaff: staff,
      parent: ['name', 'email', 'phone', 'photo'],
      student: ['email', 'phone', 'photo', 'address']
    };
    return map[role] || ['email', 'phone', 'photo'];
  },

  /* ---------------------------------------------------------- mount ---- */
  /* Called from renderTopbarUser() on every portal. Idempotent: if the
     topbar was re-rendered and the button vanished, it is rebuilt; if it is
     still there, only the label is refreshed (never a second copy). */
  mount(s) {
    if (!s) return;
    const host = document.querySelector('.topbar-right');
    if (!host) return;
    const existing = host.querySelector('.settings-wrap');
    if (existing) {
      this._session = s;
      this._refreshChrome();
      if (!document.getElementById('settingsModal')) this._ensureModal();
      return;
    }
    this._mounted = true;
    this._session = s;

    const wrap = document.createElement('div');
    wrap.className = 'settings-wrap';
    wrap.innerHTML = `
      <button type="button" class="settings-btn" id="settingsBtn" aria-haspopup="true"
        aria-expanded="false" title="Profile &amp; Settings">
        <i class="fas fa-gear" aria-hidden="true"></i><span class="settings-label">Settings</span>
      </button>
      <div class="settings-menu" id="settingsMenu" role="menu">
        <div class="settings-menu-head">
          <div class="avatar">${esc(initials(s.name))}</div>
          <div>
            <div class="u-name">${esc(s.name)}</div>
            <div class="u-role">${esc(ROLE_LABELS[s.role] || s.role)}</div>
          </div>
        </div>
        <button type="button" role="menuitem" data-act="profile"><i class="fas fa-id-badge"></i> My Profile</button>
        <button type="button" role="menuitem" data-act="edit"><i class="fas fa-user-pen"></i> Edit Profile</button>
        <button type="button" role="menuitem" data-act="password"><i class="fas fa-key"></i> Change Password</button>
        <button type="button" role="menuitem" data-act="security"><i class="fas fa-shield-halved"></i> Security</button>
        ${s.role === 'admin' ? '<button type="button" role="menuitem" data-act="accounts"><i class="fas fa-users-gear"></i> Accounts &amp; Security</button>' : ''}
        <div class="settings-sep"></div>
        <button type="button" role="menuitem" data-act="logout" class="danger-item"><i class="fas fa-right-from-bracket"></i> Sign Out</button>
      </div>`;
    host.insertBefore(wrap, host.firstChild);

    const btn = wrap.querySelector('#settingsBtn');
    const menu = wrap.querySelector('#settingsMenu');
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const open = menu.classList.toggle('show');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    menu.addEventListener('click', e => {
      const b = e.target.closest('button[data-act]');
      if (!b) return;
      e.stopPropagation();
      menu.classList.remove('show');
      btn.setAttribute('aria-expanded', 'false');
      if (b.dataset.act === 'logout') return Auth.logout();
      this.open(b.dataset.act);
    });
    document.addEventListener('click', () => {
      menu.classList.remove('show');
      btn.setAttribute('aria-expanded', 'false');
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { menu.classList.remove('show'); btn.setAttribute('aria-expanded', 'false'); this.close(); }
    });

    this._ensureModal();
    if (s.mustChangePassword) this._nudgeFirstLogin();
  },

  /* First login: make the change-password screen impossible to miss. */
  _nudgeFirstLogin() {
    if (window.location.pathname.includes('/admin/password.html')) return;
    toast('Please set your own password to finish setting up your account.', 'info');
  },

  /* ---------------------------------------------------------- modal ---- */
  _ensureModal() {
    if (document.getElementById('settingsModal')) return;
    const m = document.createElement('div');
    m.id = 'settingsModal';
    m.className = 'modal-overlay settings-modal';
    m.innerHTML = `
      <div class="modal settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settingsTitle">
        <div class="modal-head">
          <h3 id="settingsTitle"><i class="fas fa-gear"></i> Profile &amp; Settings</h3>
          <button type="button" class="modal-close" data-close aria-label="Close">&times;</button>
        </div>
        <div class="settings-tabs" role="tablist">
          <button type="button" role="tab" data-tab="profile">My Profile</button>
          <button type="button" role="tab" data-tab="edit">Edit Profile</button>
          <button type="button" role="tab" data-tab="password">Change Password</button>
          <button type="button" role="tab" data-tab="security">Security</button>
          <button type="button" role="tab" data-tab="accounts" hidden>Accounts</button>
        </div>
        <div class="settings-body" id="settingsBody"></div>
      </div>`;
    document.body.appendChild(m);
    m.addEventListener('click', e => {
      if (e.target === m || e.target.closest('[data-close]')) this.close();
    });
    m.querySelector('.settings-tabs').addEventListener('click', e => {
      const t = e.target.closest('button[data-tab]');
      if (t) this.open(t.dataset.tab);
    });
  },

  open(tab) {
    this._ensureModal();
    const s = Auth.session();
    if (!s) return;
    this._session = s;
    const isAdmin = s.role === 'admin';
    if (tab === 'accounts' && !isAdmin) tab = 'profile';
    this._tab = tab || 'profile';
    document.querySelectorAll('#settingsModal .settings-tabs button').forEach(b => {
      const on = b.dataset.tab === this._tab;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      if (b.dataset.tab === 'accounts') b.hidden = !isAdmin;
    });
    const body = document.getElementById('settingsBody');
    body.innerHTML = '';
    const pane = document.createElement('div');
    pane.className = 'settings-pane';
    body.appendChild(pane);
    this._pane = pane;
    const R = { profile: 'renderProfile', edit: 'renderEdit', password: 'renderPassword', security: 'renderSecurity', accounts: 'renderAccounts' }[this._tab];
    this[R](pane, s);
    document.getElementById('settingsModal').classList.add('show');
    document.body.style.overflow = 'hidden';
  },

  close() {
    const m = document.getElementById('settingsModal');
    if (m) m.classList.remove('show');
    document.body.style.overflow = '';
  },

  _live() {
    const s = this._session || Auth.session();
    return DB.get('users').find(x => x.id === (s && s.id)) || null;
  },

  /* Re-render the accounts pane in place, or reopen it if it was closed. */
  _refreshAccounts() {
    if (this._tab === 'accounts' && this._pane && document.getElementById('settingsModal')) {
      this.renderAccounts(this._pane, Auth.session());
    } else {
      this.open('accounts');
    }
  },

  /* ------------------------------------------------------- profile ---- */
  renderProfile(pane, s) {
    const u = this._live() || {};
    const editable = this._editable(s.role);
    const role = ROLE_LABELS[s.role] || s.role;
    const rows = [
      ['Username', u.username],
      ['Full name', u.name],
      ['Role', role],
      u.role === 'teacher' || u.role === 'chiefexaminer' ? ['Subject', u.subject] : null,
      ['Email', u.email],
      ['Phone', u.phone],
      u.role === 'student' ? ['Class / Grade', u.grade || u.className] : null,
      u.role === 'student' ? ['Admission No.', (DB.get('students').find(x => x.id === u.id) || {}).admissionNo] : null,
      u.role === 'student' ? ['Address', (DB.get('students').find(x => x.id === u.id) || {}).address] : null,
      ['Password last changed', u.passwordChangedAt ? fmtDate(u.passwordChangedAt) : 'Never (using a temporary password)'],
      ['Account created', u.createdAt ? fmtDate(u.createdAt) : '—']
    ].filter(Boolean);

    const locked = s.role === 'student'
      ? '<p class="pane-note"><i class="fas fa-lock"></i> Your admission number, class and academic records are managed by the school office and cannot be edited here.</p>'
      : '';

    pane.innerHTML = `
      <div class="profile-card">
        <div class="profile-photo">
          ${u.photo ? `<img src="${esc(u.photo)}" alt="">` : `<div class="avatar avatar-xl">${esc(initials(u.name))}</div>`}
          <span class="badge badge-navy">${esc(role)}</span>
        </div>
        <div class="profile-rows">
          ${rows.map(r => `<div class="profile-row"><span class="profile-k">${esc(r[0])}</span><span class="profile-v">${esc(r[1] == null || r[1] === '' ? '—' : r[1])}</span></div>`).join('')}
        </div>
      </div>
      ${locked}
      <div class="pane-actions">
        <button type="button" class="btn btn-primary" data-go="edit"><i class="fas fa-user-pen"></i> Edit Profile</button>
        <button type="button" class="btn btn-ghost" data-go="password"><i class="fas fa-key"></i> Change Password</button>
      </div>`;
    pane.querySelector('[data-go="edit"]').addEventListener('click', () => this.open('edit'));
    pane.querySelector('[data-go="password"]').addEventListener('click', () => this.open('password'));
  },

  /* ---------------------------------------------------------- edit ---- */
  renderEdit(pane, s) {
    const u = this._live() || {};
    const editable = this._editable(s.role);
    const stu = s.role === 'student' ? DB.get('students').find(x => x.id === s.id) : null;
    const can = f => editable.includes(f);

    pane.innerHTML = `
      <p class="pane-note"><i class="fas fa-circle-info"></i> Only the details below may be updated by you. Changes are recorded in the audit log.</p>
      <form id="profileForm" novalidate>
        ${can('name') ? `
        <div class="form-group">
          <label for="pfName">Full name</label>
          <input type="text" id="pfName" value="${esc(u.name || '')}" required>
        </div>` : `
        <div class="form-group">
          <label>Full name <span class="readonly-tag">school record</span></label>
          <input type="text" value="${esc(u.name || '')}" disabled>
        </div>`}
        <div class="form-group">
          <label for="pfEmail">Email address</label>
          <input type="email" id="pfEmail" value="${esc(u.email || stu?.email || '')}" required>
        </div>
        <div class="form-group">
          <label for="pfPhone">Phone number</label>
          <input type="tel" id="pfPhone" value="${esc(u.phone || stu?.parentPhone || '')}" placeholder="e.g. (555) 100-2000">
        </div>
        ${s.role === 'student' ? `
        <div class="form-group">
          <label for="pfAddress">Home address</label>
          <input type="text" id="pfAddress" value="${esc(stu?.address || '')}">
        </div>` : ''}
        ${can('subject') ? `
        <div class="form-group">
          <label for="pfSubject">Subject</label>
          <input type="text" id="pfSubject" value="${esc(u.subject || '')}">
        </div>` : ''}
        ${can('photo') ? `
        <div class="form-group">
          <label>Profile photo</label>
          <div class="photo-picker">
            <div class="profile-photo sm" id="pfPhotoPreview">
              ${u.photo ? `<img src="${esc(u.photo)}" alt="">` : `<div class="avatar">${esc(initials(u.name))}</div>`}
            </div>
            <div>
              <input type="file" id="pfPhoto" accept="image/*">
              <button type="button" class="btn btn-ghost btn-sm" id="pfPhotoClear"><i class="fas fa-trash"></i> Remove photo</button>
              <small class="field-hint">Images are resized before saving.</small>
            </div>
          </div>
          <input type="hidden" id="pfPhotoData" value="${esc(u.photo || '')}">
        </div>` : ''}
        <input type="hidden" id="pfCsrf" value="${esc(Auth.csrfToken())}">
        <div class="pane-actions">
          <button type="submit" class="btn btn-primary"><i class="fas fa-floppy-disk"></i> Save changes</button>
          <button type="button" class="btn btn-ghost" data-close>Cancel</button>
        </div>
      </form>`;

    const photoInput = pane.querySelector('#pfPhoto');
    const photoData = pane.querySelector('#pfPhotoData');
    const preview = pane.querySelector('#pfPhotoPreview');
    const setPreview = url => {
      if (!preview) return;
      preview.innerHTML = url ? `<img src="${esc(url)}" alt="">` : `<div class="avatar">${esc(initials(u.name))}</div>`;
    };
    if (photoInput) {
      photoInput.addEventListener('change', async () => {
        const f = photoInput.files && photoInput.files[0];
        if (!f) return;
        try {
          const url = (typeof compressImage === 'function')
            ? await compressImage(f, 512, 0.8, false)
            : await new Promise((res, rej) => { const r = new FileReader(); r.onload = e => res(e.target.result); r.onerror = rej; r.readAsDataURL(f); });
          photoData.value = url; setPreview(url);
          toast('Photo ready — save your changes to apply it.', 'info');
        } catch (err) { toast(err.message || 'Could not read that image.', 'error'); }
      });
    }
    const clearBtn = pane.querySelector('#pfPhotoClear');
    if (clearBtn) clearBtn.addEventListener('click', () => { photoData.value = ''; if (photoInput) photoInput.value = ''; setPreview(''); });

    pane.querySelector('[data-close]').addEventListener('click', () => this.close());

    pane.querySelector('#profileForm').addEventListener('submit', async e => {
      e.preventDefault();
      if (!Auth.verifyCsrf(pane.querySelector('#pfCsrf').value)) { toast('Your session expired. Please sign in again.', 'error'); Auth.logout(); return; }
      const users = DB.get('users');
      const i = users.findIndex(x => x.id === s.id);
      if (i === -1) return;
      const before = {};
      const setIf = (key, el, apply) => {
        if (!el) return;
        const v = String(el.value || '').trim();
        if (users[i][key] === v && !apply) return;
        before[key] = users[i][key];
        users[i][key] = v;
      };
      if (can('name')) setIf('name', pane.querySelector('#pfName'));
      const email = String(pane.querySelector('#pfEmail').value || '').trim();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast('Please enter a valid email address.', 'error');
      before.email = users[i].email; users[i].email = email;
      before.phone = users[i].phone; users[i].phone = String(pane.querySelector('#pfPhone').value || '').trim();
      if (can('subject')) setIf('subject', pane.querySelector('#pfSubject'));
      if (can('photo')) { before.photo = users[i].photo; users[i].photo = photoData.value; }
      DB.set('users', users);

      /* students: mirror the approved fields onto the school record */
      if (s.role === 'student') {
        const students = DB.get('students');
        const si = students.findIndex(x => x.id === s.id);
        if (si !== -1) {
          students[si].email = email;
          students[si].address = String((pane.querySelector('#pfAddress') || {}).value || '').trim();
          students[si].phone = users[i].phone;
          if (can('photo')) students[si].photo = users[i].photo;
          DB.set('students', students);
        }
      }

      const changed = Object.keys(before).filter(k => before[k] !== users[i][k]);
      if (changed.length && typeof Audit !== 'undefined') {
        Audit.log('profile.update', 'Updated ' + changed.join(', ') + ' on ' + users[i].username + ' (' + users[i].role + ')');
      }
      toast('Profile updated.');
      this._refreshChrome();
      this.open('edit');
    });
  },

  /* Refresh the topbar chip and the menu header in place. Re-running
     renderTopbarUser() would append a second Settings button and re-bind
     the logout listener, so never do that. */
  _refreshChrome() {
    const s = Auth.session();
    if (!s) return;
    this._session = s;
    const chip = document.getElementById('userChip');
    /* safe: the chip carries no listeners of its own (logoutBtn is separate) */
    if (chip) {
      chip.innerHTML = `<div class="avatar">${esc(initials(s.name))}</div><div class="u-details"><div class="u-name">${esc(s.name)}</div><div class="u-role">${esc(s.role)} Portal</div></div>`;
    }
    const head = document.querySelector('.settings-menu-head');
    if (head) {
      const av = head.querySelector('.avatar');
      const nm = head.querySelector('.u-name');
      const rl = head.querySelector('.u-role');
      if (av) av.textContent = initials(s.name);
      if (nm) nm.textContent = s.name;
      if (rl) rl.textContent = ROLE_LABELS[s.role] || s.role;
    }
  },

  /* ------------------------------------------------------- password ---- */
  renderPassword(pane, s) {
    const u = this._live() || {};
    const expired = u.mustChangePassword && typeof Security !== 'undefined' && Security.tempPasswordExpired(u);
    const ttl = (typeof Security !== 'undefined') ? Security.TEMP_PASSWORD_TTL_HOURS : 72;
    pane.innerHTML = `
      ${u.mustChangePassword ? (expired
        ? '<div class="change-banner danger"><i class="fas fa-triangle-exclamation"></i> Your temporary password has expired. Ask an administrator to issue a new one.</div>'
        : `<div class="change-banner warn"><i class="fas fa-key"></i> You are using a temporary password. It expires in ${ttl} hours.</div>`)
        : ''}
      <form id="modalPasswordForm" novalidate>
        <div class="form-group">
          <label for="mpCurrent">Current password</label>
          <input type="password" id="mpCurrent" autocomplete="current-password" required>
        </div>
        <div class="form-group">
          <label for="mpNew">New password</label>
          <input type="password" id="mpNew" autocomplete="new-password" minlength="8" required>
          <div class="pw-meter" id="mpMeter" data-score="0"><i></i></div>
          <small class="pw-meter-text" id="mpMeterText">At least 8 characters, one letter and one number.</small>
        </div>
        <div class="form-group">
          <label for="mpConfirm">Confirm new password</label>
          <input type="password" id="mpConfirm" autocomplete="new-password" minlength="8" required>
        </div>
        <input type="hidden" id="mpCsrf" value="${esc(Auth.csrfToken())}">
        <div class="pane-actions">
          <button type="submit" class="btn btn-primary" ${expired ? 'disabled' : ''}><i class="fas fa-key"></i> Update password</button>
          <button type="button" class="btn btn-ghost" data-close>Cancel</button>
        </div>
      </form>
      <p class="pane-note"><i class="fas fa-shield-halved"></i> Your password is stored only as a salted PBKDF2-SHA256 digest — the system never keeps the plain text, and nobody can read it back.</p>`;

    this._wireMeter(pane, '#mpNew', '#mpMeter', '#mpMeterText');
    pane.querySelector('[data-close]').addEventListener('click', () => this.close());
    pane.querySelector('#modalPasswordForm').addEventListener('submit', async e => {
      e.preventDefault();
      if (!Auth.verifyCsrf(pane.querySelector('#mpCsrf').value)) { toast('Your session expired. Please sign in again.', 'error'); Auth.logout(); return; }
      const cur = pane.querySelector('#mpCurrent').value;
      const n1 = pane.querySelector('#mpNew').value;
      const n2 = pane.querySelector('#mpConfirm').value;
      if (!cur) return toast('Please enter your current password.', 'error');
      if (n1 !== n2) return toast('The two new passwords do not match.', 'error');
      if (n1 === cur) return toast('Please choose a password different from your current one.', 'error');
      const btn = e.target.querySelector('[type="submit"]');
      btn.disabled = true;
      const r = await Auth.changePassword(cur, n1);
      btn.disabled = false;
      if (!r.ok) return toast(r.error, 'error');
      toast('Password updated. Use it the next time you sign in.');
      this.open('profile');
    });
  },

  _wireMeter(pane, inputSel, meterSel, textSel) {
    const inp = pane.querySelector(inputSel), meter = pane.querySelector(meterSel), txt = pane.querySelector(textSel);
    if (!inp || !meter) return;
    const labels = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];
    const classes = ['bad', 'bad', 'warn', 'ok', 'ok'];
    inp.addEventListener('input', () => {
      const v = inp.value;
      let n = -1;
      if (v) {
        n = 0;
        if (v.length >= 8) n++;
        if (v.length >= 12) n++;
        if (/[A-Za-z]/.test(v) && /[0-9]/.test(v)) n++;
        if (/[^A-Za-z0-9]/.test(v)) n++;
        if (v.length >= 16) n++;
        n = Math.min(n, 4);
      }
      meter.className = 'pw-meter';
      meter.removeAttribute('data-score');
      if (n < 0) { txt.textContent = 'At least ' + ((typeof Security !== 'undefined') ? Security.MIN_PASSWORD : 8) + ' characters, one letter and one number.'; txt.className = 'pw-meter-text'; return; }
      meter.classList.add('on');
      meter.setAttribute('data-score', n);
      meter.style.setProperty('--pct', ((n + 1) / 5 * 100) + '%');
      txt.textContent = labels[n];
      txt.className = 'pw-meter-text ' + classes[n];
    });
  },

  /* ------------------------------------------------------ security ---- */
  renderSecurity(pane, s) {
    const u = this._live() || {};
    const ttl = (typeof Security !== 'undefined') ? Security.TEMP_PASSWORD_TTL_HOURS : 72;
    const reqs = [
      ['Salted PBKDF2-SHA256 hashing', 'Passwords are never stored or logged in plain text.'],
      ['Temporary password expiry', `Admin-issued temporary passwords stop working after ${ttl} hours.`],
      ['Mandatory first-login change', 'A temporary password cannot be used anywhere except the change-password screen.'],
      ['Current-password confirmation', 'Changing a password always requires the current one.'],
      ['Session binding', 'Sessions are tied to a token held only by your account and are revoked on reset or sign-out.'],
      ['CSRF tokens', 'Every settings form is checked against a per-session token.'],
      ['Audit trail', 'Sign-ins, password changes and resets are recorded with a timestamp.'],
      ['No default back door', 'Account creation always issues a unique temporary password — never a shared default.']
    ];
    pane.innerHTML = `
      <div class="sec-grid">
        ${reqs.map(r => `<div class="sec-item"><i class="fas fa-circle-check"></i><div><strong>${esc(r[0])}</strong><p>${esc(r[1])}</p></div></div>`).join('')}
      </div>

      <h4 class="pane-sub">Password recovery</h4>
      <p class="pane-note"><i class="fas fa-circle-info"></i> Choose a recovery question. If you forget your password, an administrator can use your answer to verify it is really you before issuing a new temporary password.</p>
      <form id="recoveryForm" novalidate>
        <div class="form-group">
          <label for="secQuestion">Recovery question</label>
          <input type="text" id="secQuestion" list="secQuestions" value="${esc(u.recoveryQuestion || '')}" placeholder="e.g. What is your mother's maiden name?" maxlength="120">
          <datalist id="secQuestions">
            <option value="What is your mother's maiden name?">
            <option value="What street did you grow up on?">
            <option value="What is the name of your first school?">
            <option value="What is your favourite book?">
            <option value="What city were you born in?">
          </datalist>
        </div>
        <div class="form-group">
          <label for="secAnswer">Answer</label>
          <input type="text" id="secAnswer" value="" placeholder="${u.recoveryAnswerHash ? 'Leave blank to keep your current answer' : 'Type your answer'}" autocomplete="off">
          ${u.recoveryAnswerHash ? '<small class="field-hint">An answer is already saved. It is stored only as a digest.</small>' : ''}
        </div>
        <input type="hidden" id="secCsrf" value="${esc(Auth.csrfToken())}">
        <div class="pane-actions">
          <button type="submit" class="btn btn-primary"><i class="fas fa-floppy-disk"></i> Save recovery question</button>
          <button type="button" class="btn btn-ghost" id="secRevoke"><i class="fas fa-power-off"></i> Sign out other devices</button>
        </div>
      </form>

      <h4 class="pane-sub">Current session</h4>
      <div class="profile-rows">
        <div class="profile-row"><span class="profile-k">Signed in as</span><span class="profile-v">${esc(u.username)} (${esc(ROLE_LABELS[s.role] || s.role)})</span></div>
        <div class="profile-row"><span class="profile-k">Session started</span><span class="profile-v">${s.issuedAt ? new Date(s.issuedAt).toLocaleString() : '—'}</span></div>
        <div class="profile-row"><span class="profile-k">Temporary password</span><span class="profile-v">${u.mustChangePassword ? (u.tempPasswordExpiresAt ? 'Active until ' + new Date(u.tempPasswordExpiresAt).toLocaleString() : 'Active') : 'Not in use'}</span></div>
      </div>`;

    pane.querySelector('#recoveryForm').addEventListener('submit', e => {
      e.preventDefault();
      if (!Auth.verifyCsrf(pane.querySelector('#secCsrf').value)) { toast('Your session expired. Please sign in again.', 'error'); Auth.logout(); return; }
      const q = pane.querySelector('#secQuestion').value.trim();
      const a = pane.querySelector('#secAnswer').value.trim();
      if (!q) return toast('Please type a recovery question.', 'error');
      if (!a && !u.recoveryAnswerHash) return toast('Please type an answer.', 'error');
      const users = DB.get('users');
      const i = users.findIndex(x => x.id === s.id);
      if (i === -1) return;
      users[i].recoveryQuestion = q;
      if (a) users[i].recoveryAnswerHash = Security.hashSync(a.toLowerCase());
      DB.set('users', users);
      if (typeof Audit !== 'undefined') Audit.log('security.recovery', 'Recovery question set for ' + users[i].username);
      toast('Recovery question saved.');
      this.open('security');
    });

    pane.querySelector('#secRevoke').addEventListener('click', () => {
      if (!Auth.verifyCsrf(pane.querySelector('#secCsrf').value)) { toast('Your session expired. Please sign in again.', 'error'); Auth.logout(); return; }
      const users = DB.get('users');
      const i = users.findIndex(x => x.id === s.id);
      if (i === -1) return;
      users[i].sessionToken = Security.newToken();
      users[i].csrfToken = Security.newToken();
      DB.set('users', users);
      const sess = Auth.session();
      if (sess) Auth._saveSession({ ...sess, sessionToken: users[i].sessionToken, csrfToken: users[i].csrfToken });
      if (typeof Audit !== 'undefined') Audit.log('security.sessions', 'Signed out other devices for ' + users[i].username);
      toast('All other devices have been signed out.');
      this.open('security');
    });
  },

  /* ------------------------------------------------------ accounts ---- */
  /* Admin-only account management: search, filter, paging, duplicate
     detection, create, edit, enable/disable, reset password, delete. */
  _accState: { search: '', role: '', status: '', sort: 'username', page: 1, perPage: 8 },

  renderAccounts(pane, s) {
    this._pane = pane;
    if (s.role !== 'admin') { pane.innerHTML = '<p class="pane-note">Administrator access required.</p>'; return; }
    const st = this._accState;
    const r = Accounts.query(st);
    const roles = ACCOUNT_ROLES.map(x => `<option value="${x}"${st.role === x ? ' selected' : ''}>${esc(ROLE_LABELS[x] || x)}</option>`).join('');
    const statuses = [
      ['', 'All accounts'], ['active', 'Active'], ['disabled', 'Disabled'],
      ['mustChange', 'Must change password'], ['flagged', 'Duplicate flag']
    ].map(([v, l]) => `<option value="${v}"${st.status === v ? ' selected' : ''}>${esc(l)}</option>`).join('');
    const sorts = [['username', 'Username A–Z'], ['name', 'Full name A–Z']]
      .map(([v, l]) => `<option value="${v}"${st.sort === v ? ' selected' : ''}>${esc(l)}</option>`).join('');

    pane.innerHTML = `
      <p class="pane-note"><i class="fas fa-circle-info"></i> Accounts are created with a one-time temporary password that expires. Resetting an account issues a new one and signs that user out of every device.</p>

      ${r.duplicates.length ? `<div class="acc-alert"><i class="fas fa-triangle-exclamation"></i>
          <strong>${r.duplicates.length} duplicate ${r.duplicates.length === 1 ? 'value' : 'values'} found.</strong>
          ${r.duplicates.map(d => `<div>${esc(d.field)} <code>${esc(d.value)}</code> is used by ${d.accounts.map(a => esc(a.username)).join(', ')}</div>`).join('')}
        </div>` : ''}

      <div class="stats-row" style="margin-bottom:14px">
        ${[['fa-users', r.counts.total, 'Accounts'], ['fa-circle-check', r.counts.active, 'Active'],
           ['fa-ban', r.counts.disabled, 'Disabled'], ['fa-key', r.counts.mustChange, 'Must change password'],
           ['fa-copy', r.counts.flagged, 'Duplicates']]
          .map(([i, n, l]) => `<div class="stat-card"><div class="s-icon navy"><i class="fas ${i}"></i></div><div class="s-info"><div class="s-num">${n}</div><div class="s-label">${esc(l)}</div></div></div>`).join('')}
      </div>

      <div class="acc-toolbar">
        <input type="search" id="accSearch" placeholder="Search name, username, e-mail or role…" value="${esc(st.search)}" aria-label="Search accounts">
        <select id="accRole" aria-label="Filter by role"><option value="">All roles</option>${roles}</select>
        <select id="accStatus" aria-label="Filter by status">${statuses}</select>
        <select id="accSort" aria-label="Sort accounts">${sorts}</select>
        <button type="button" class="btn btn-primary btn-sm" id="accAdd"><i class="fas fa-user-plus"></i> New account</button>
      </div>

      <div class="acc-list">
        ${r.rows.length ? r.rows.map(u => {
          const flagged = r.flaggedIds.has(u.id);
          const disabled = u.status === 'disabled';
          return `
          <div class="acc-row${disabled ? ' acc-row-off' : ''}">
            <div class="avatar">${esc(initials(u.name || u.username))}</div>
            <div class="acc-main">
              <div class="acc-name">${esc(u.name || u.username)}
                <span class="badge badge-navy">${esc(ROLE_LABELS[u.role] || u.role)}</span>
                ${disabled ? '<span class="badge badge-danger">Disabled</span>' : ''}
                ${u.mustChangePassword ? '<span class="badge badge-warning">Must change password</span>' : ''}
                ${flagged ? '<span class="badge badge-danger" title="Duplicate username or e-mail"><i class="fas fa-copy"></i> Duplicate</span>' : ''}
              </div>
              <div class="acc-meta">
                <span><i class="fas fa-user"></i> ${esc(u.username)}</span>
                <span><i class="fas fa-envelope"></i> ${esc(u.email || '—')}</span>
                <span><i class="fas fa-key"></i> ${u.tempPasswordExpiresAt && u.mustChangePassword ? 'Temp expires ' + esc(new Date(u.tempPasswordExpiresAt).toLocaleString()) : (u.passwordChangedAt ? 'Changed ' + fmtDate(u.passwordChangedAt) : 'Password set')}</span>
              </div>
            </div>
            <div class="acc-actions">
              <button type="button" class="btn btn-ghost btn-sm" data-edit="${esc(u.id)}" title="Edit this account"><i class="fas fa-pen"></i> Edit</button>
              <button type="button" class="btn btn-ghost btn-sm" data-reset="${esc(u.id)}" title="Issue a new temporary password"><i class="fas fa-rotate"></i> Reset password</button>
              <button type="button" class="btn btn-ghost btn-sm" data-toggle="${esc(u.id)}" title="${disabled ? 'Re-enable this account' : 'Disable this account'}"><i class="fas ${disabled ? 'fa-unlock' : 'fa-ban'}"></i> ${disabled ? 'Enable' : 'Disable'}</button>
              <button type="button" class="btn btn-ghost btn-sm acc-danger" data-del="${esc(u.id)}" title="Delete this account"><i class="fas fa-trash"></i> Delete</button>
            </div>
          </div>`;
        }).join('') : `<p class="pane-note">No accounts match this view.</p>`}
      </div>

      ${r.total > r.perPage ? `<div class="acc-pager">
          <button type="button" class="btn btn-ghost btn-sm" data-page="${r.page - 1}" ${r.page <= 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i> Previous</button>
          <span>Page ${r.page} of ${r.pages} · ${r.total} account${r.total === 1 ? '' : 's'}</span>
          <button type="button" class="btn btn-ghost btn-sm" data-page="${r.page + 1}" ${r.page >= r.pages ? 'disabled' : ''}>Next <i class="fas fa-chevron-right"></i></button>
        </div>` : (r.total ? `<p class="pane-note" style="font-size:.8rem">${r.total} account${r.total === 1 ? '' : 's'}</p>` : '')}`;

    const rerender = () => { this._accState.page = 1; this.renderAccounts(pane, s); };
    const bind = (id, key, evt) => {
      const el = pane.querySelector('#' + id);
      if (!el) return;
      el.addEventListener(evt || 'change', () => { this._accState[key] = el.value; this._accState.page = 1; this.renderAccounts(pane, s); });
      if (evt === 'input') {
        let t = null;
        el.addEventListener('input', () => {
          clearTimeout(t);
          const v = el.value, pos = el.selectionStart;
          t = setTimeout(() => {
            this._accState.search = v; this._accState.page = 1;
            this.renderAccounts(pane, s);
            const again = pane.querySelector('#' + id);
            if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch (e) {} }
          }, 220);
        });
      }
    };
    bind('accSearch', 'search', 'input');
    bind('accRole', 'role');
    bind('accStatus', 'status');
    bind('accSort', 'sort');
    const add = pane.querySelector('#accAdd');
    if (add) add.addEventListener('click', () => this.openAccountEditor(null));

    pane.querySelectorAll('[data-reset]').forEach(b => b.addEventListener('click', () => this.resetPassword(b.dataset.reset)));
    pane.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => this.openAccountEditor(b.dataset.edit)));
    pane.querySelectorAll('[data-toggle]').forEach(b => b.addEventListener('click', () => this.toggleAccount(b.dataset.toggle)));
    pane.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => this.deleteAccount(b.dataset.del)));
    pane.querySelectorAll('[data-page]').forEach(b => b.addEventListener('click', () => {
      const p = Number(b.dataset.page);
      if (p >= 1) { this._accState.page = p; this.renderAccounts(pane, s); }
    }));
  },

  /* ---------- create / edit dialog ---------- */
  openAccountEditor(id) {
    const cur = id ? Accounts.get(id) : null;
    if (id && !cur) return toast('Account not found.', 'error');
    const old = document.getElementById('accEditorModal'); if (old) old.remove();
    const m = document.createElement('div');
    m.id = 'accEditorModal';
    m.className = 'modal-overlay show';
    const roleOpts = ACCOUNT_ROLES.map(r => `<option value="${r}"${(cur ? cur.role : 'teacher') === r ? ' selected' : ''}>${esc(ROLE_LABELS[r] || r)}</option>`).join('');
    m.innerHTML = `
      <div class="modal settings-dialog" role="dialog" aria-modal="true" aria-labelledby="accEditorTitle">
        <div class="modal-head"><h3 id="accEditorTitle"><i class="fas ${cur ? 'fa-user-pen' : 'fa-user-plus'}"></i> ${cur ? 'Edit account' : 'New account'}</h3>
          <button type="button" class="modal-close" aria-label="Close">&times;</button></div>
        <form id="accEditorForm">
          <div class="form-grid">
            <div class="form-group"><label>Full name <span class="req">*</span></label><input type="text" id="aeName" required value="${esc(cur ? cur.name || '' : '')}"></div>
            <div class="form-group"><label>Username <span class="req">*</span></label><input type="text" id="aeUsername" required value="${esc(cur ? cur.username : '')}" placeholder="e.g. jkim" ${cur ? '' : ''}><small class="field-hint">3–32 characters: letters, numbers, . _ -</small></div>
            <div class="form-group"><label>E-mail</label><input type="email" id="aeEmail" value="${esc(cur ? cur.email || '' : '')}" placeholder="name@stteresaacademy.edu"></div>
            <div class="form-group"><label>Role <span class="req">*</span></label><select id="aeRole">${roleOpts}</select></div>
            <div class="form-group"><label>Status</label><select id="aeStatus">
              <option value="active"${!cur || cur.status !== 'disabled' ? ' selected' : ''}>Active</option>
              <option value="disabled"${cur && cur.status === 'disabled' ? ' selected' : ''}>Disabled</option>
            </select></div>
            <div class="form-group"><label>Phone</label><input type="tel" id="aePhone" value="${esc(cur ? cur.phone || '' : '')}"></div>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> ${cur ? 'Save changes' : 'Create account'}</button>
            <button type="button" class="btn btn-ghost" data-cancel>Cancel</button>
          </div>
          ${cur ? '' : `<p class="pane-note" style="font-size:.8rem"><i class="fas fa-key"></i> A one-time temporary password is generated and shown once after the account is created.</p>`}
        </form>
      </div>`;
    document.body.appendChild(m);
    const close = () => m.remove();
    m.querySelector('.modal-close').addEventListener('click', close);
    m.querySelector('[data-cancel]').addEventListener('click', close);
    m.addEventListener('click', e => { if (e.target === m) close(); });
    m.querySelector('#accEditorForm').addEventListener('submit', async e => {
      e.preventDefault();
      const btn = e.target.querySelector('[type="submit"]');
      btn.disabled = true;
      const payload = {
        name: m.querySelector('#aeName').value,
        username: m.querySelector('#aeUsername').value,
        email: m.querySelector('#aeEmail').value,
        role: m.querySelector('#aeRole').value,
        status: m.querySelector('#aeStatus').value,
        phone: m.querySelector('#aePhone').value
      };
      const r = cur ? Accounts.update(cur.id, payload) : await Accounts.create(payload);
      btn.disabled = false;
      if (!r.ok) return toast(r.error, 'error');
      close();
      toast(cur ? 'Account updated.' : 'Account created.');
      if (!cur && r.tempPassword) this._showTempPassword(r.user, r.tempPassword);
      this._refreshAccounts();
    });
    setTimeout(() => { const f = m.querySelector('#aeName'); if (f) f.focus(); }, 30);
  },

  toggleAccount(id) {
    const u = Accounts.get(id);
    if (!u) return;
    const disabling = (u.status || 'active') !== 'disabled';
    if (disabling && !confirm('Disable "' + (u.name || u.username) + '"? They will be signed out and will not be able to sign in until re-enabled.')) return;
    const r = Accounts.setStatus(id, disabling ? 'disabled' : 'active');
    if (!r.ok) return toast(r.error, 'error');
    toast(disabling ? 'Account disabled.' : 'Account re-enabled.');
    this._refreshAccounts();
  },

  deleteAccount(id) {
    const u = Accounts.get(id);
    if (!u) return;
    if (!confirm('Delete the account "' + (u.name || u.username) + '" (' + (ROLE_LABELS[u.role] || u.role) + ')?\n\nThis cannot be undone. If this person still needs access, use Disable instead.')) return;
    const r = Accounts.remove(id);
    if (!r.ok) return toast(r.error, 'error');
    toast('Account deleted.');
    this._refreshAccounts();
  },

  async resetPassword(userId) {
    const users = DB.get('users');
    const target = users.find(x => x.id === userId);
    if (!target) return;
    const answer = await Security.checkRecoveryAnswerUI(target);
    if (answer === 'cancel') return;
    if (answer === 'wrong') return toast('Recovery answer does not match. Nothing was changed.', 'error');

    const res = await Security.issueTemporaryPassword(userId, 'Admin-assisted reset');
    if (!res.ok) return toast(res.error, 'error');
    this._showTempPassword(res.user, res.tempPassword);
  },

  /* The temporary password is shown exactly once and can never be recovered. */
  _showTempPassword(user, temp) {
    const old = document.getElementById('tempPwModal'); if (old) old.remove();
    const m = document.createElement('div');
    m.id = 'tempPwModal';
    m.className = 'modal-overlay show';
    m.innerHTML = `
      <div class="modal settings-dialog" role="dialog" aria-modal="true">
        <div class="modal-head"><h3><i class="fas fa-key"></i> Temporary password issued</h3></div>
        <p class="pane-note"><i class="fas fa-triangle-exclamation"></i> Copy this now — it is <strong>not recoverable</strong> once you close this window. Give it to ${esc(user.name || user.username)} over a channel you trust.</p>
        <div class="temp-pw-box">
          <code id="tempPwValue">${esc(temp)}</code>
          <button type="button" class="btn btn-primary btn-sm" id="tempPwCopy"><i class="fas fa-copy"></i> Copy</button>
        </div>
        <div class="profile-rows">
          <div class="profile-row"><span class="profile-k">Account</span><span class="profile-v">${esc(user.username)} (${esc(ROLE_LABELS[user.role] || user.role)})</span></div>
          <div class="profile-row"><span class="profile-k">Expires</span><span class="profile-v">${user.tempPasswordExpiresAt ? new Date(user.tempPasswordExpiresAt).toLocaleString() : '—'}</span></div>
          <div class="profile-row"><span class="profile-k">Rule</span><span class="profile-v">Must be changed at next sign-in</span></div>
        </div>
        <div class="pane-actions"><button type="button" class="btn btn-ghost" id="tempPwDone">Done</button></div>
      </div>`;
    document.body.appendChild(m);
    const done = () => { m.remove(); this.open('accounts'); };
    m.querySelector('#tempPwDone').addEventListener('click', done);
    m.addEventListener('click', e => { if (e.target === m) done(); });
    m.querySelector('#tempPwCopy').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(temp);
        toast('Copied to clipboard.');
      } catch (err) {
        const r = document.createRange(); r.selectNodeContents(m.querySelector('#tempPwValue'));
        const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
        toast('Press Ctrl+C to copy.');
      }
    });
  }
};

/* ============================================================
   Recovery-answer verification during an admin reset.
   Kept here rather than in the modal so it can be reused.
   ============================================================ */
Security.checkRecoveryAnswerUI = async function (target) {
  if (!target.recoveryAnswerHash) return 'ok';        /* nothing set up → no gate */
  return await new Promise(resolve => {
    const old = document.getElementById('recoveryModal'); if (old) old.remove();
    const m = document.createElement('div');
    m.id = 'recoveryModal';
    m.className = 'modal-overlay show';
    m.innerHTML = `
      <div class="modal settings-dialog" role="dialog" aria-modal="true">
        <div class="modal-head"><h3><i class="fas fa-user-shield"></i> Verify identity</h3></div>
        <p class="pane-note"><i class="fas fa-circle-info"></i> <strong>${esc(target.name || target.username)}</strong> has set a recovery question. Enter the answer to confirm this reset is requested by them.</p>
        <p class="recovery-q">${esc(target.recoveryQuestion || 'Recovery question')}</p>
        <div class="form-group">
          <label for="recAnswer">Answer</label>
          <input type="text" id="recAnswer" autocomplete="off">
        </div>
        <div class="login-error" id="recError" role="alert"></div>
        <div class="pane-actions">
          <button type="button" class="btn btn-primary" id="recGo"><i class="fas fa-check"></i> Verify &amp; reset</button>
          <button type="button" class="btn btn-ghost" id="recCancel">Cancel</button>
        </div>
      </div>`;
    document.body.appendChild(m);
    const input = m.querySelector('#recAnswer');
    const err = m.querySelector('#recError');
    input.focus();
    const finish = v => { m.remove(); resolve(v); };
    m.querySelector('#recCancel').addEventListener('click', () => finish('cancel'));
    m.addEventListener('click', e => { if (e.target === m) finish('cancel'); });
    const submit = () => {
      if (Security.checkRecoveryAnswer(target, input.value)) finish('ok');
      else { err.textContent = 'That answer does not match. Nothing was changed.'; err.classList.add('show'); input.select(); }
    };
    m.querySelector('#recGo').addEventListener('click', submit);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
  });
};
