/* ============================================================
   ST. TERESA ACADEMY — SECURITY MODULE
   Password hashing (PBKDF2-SHA256), temporary passwords,
   session tokens and CSRF protection.
   Loaded AFTER admin.js (needs DB, esc) and BEFORE portal code.
   ============================================================ */

const Security = {
  /* PBKDF2 iterations. Lower than a server would use because this is a
     browser-only demo, but far above a bare hash. */
  ITERATIONS: 50000,
  HASH_PREFIX: 'pbkdf2',
  /* How long a temporary password stays valid (hours). Configurable here. */
  TEMP_PASSWORD_TTL_HOURS: 72,
  MIN_PASSWORD: 8,

  /* ---------- base64 helpers (byte-safe) ---------- */
  _b64(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  },
  _unb64(str) {
    const bin = atob(str);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  },

  _randomBytes(n) {
    const b = new Uint8Array(n);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(b);
    else for (let i = 0; i < n; i++) b[i] = Math.floor(Math.random() * 256);
    return b;
  },

  /* ---------- SHA-256 (pure JS fallback) ----------
     crypto.subtle needs a secure context (https/localhost). The school may
     open these pages straight from disk, so a working fallback matters. */
  _sha256Fallback() {
    if (this.__sha) return this.__sha;
    const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
      0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
      0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
      0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
      0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
      0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
      0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
      0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
    const rotr = (x, n) => (x >>> n) | (x << (32 - n));

    function sha256(bytes) {
      const len = bytes.length;
      const bitLen = len * 8;
      const withOne = len + 1;
      const total = withOne + 8;
      const blocks = Math.ceil(total / 64);
      const buf = new Uint8Array(blocks * 64);
      buf.set(bytes);
      buf[len] = 0x80;
      const dv = new DataView(buf.buffer);
      dv.setUint32(blocks * 64 - 4, bitLen >>> 0, false);
      dv.setUint32(blocks * 64 - 8, Math.floor(bitLen / 4294967296), false);

      const H = new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
      const w = new Uint32Array(64);
      for (let b = 0; b < blocks; b++) {
        const off = b * 64;
        for (let t = 0; t < 16; t++) w[t] = dv.getUint32(off + t * 4, false);
        for (let t = 16; t < 64; t++) {
          const s0 = rotr(w[t-15],7) ^ rotr(w[t-15],18) ^ (w[t-15] >>> 3);
          const s1 = rotr(w[t-2],17) ^ rotr(w[t-2],19) ^ (w[t-2] >>> 10);
          w[t] = (w[t-16] + s0 + w[t-7] + s1) >>> 0;
        }
        let [a,bb,c,d,e,f,g,h] = H;
        for (let t = 0; t < 64; t++) {
          const S1 = rotr(e,6) ^ rotr(e,11) ^ rotr(e,25);
          const ch = (e & f) ^ (~e & g);
          const t1 = (h + S1 + ch + K[t] + w[t]) >>> 0;
          const S0 = rotr(a,2) ^ rotr(a,13) ^ rotr(a,22);
          const maj = (a & bb) ^ (a & c) ^ (bb & c);
          const t2 = (S0 + maj) >>> 0;
          h = g; g = f; f = e; e = (d + t1) >>> 0;
          d = c; c = bb; bb = a; a = (t1 + t2) >>> 0;
        }
        H[0]=(H[0]+a)>>>0; H[1]=(H[1]+bb)>>>0; H[2]=(H[2]+c)>>>0; H[3]=(H[3]+d)>>>0;
        H[4]=(H[4]+e)>>>0; H[5]=(H[5]+f)>>>0; H[6]=(H[6]+g)>>>0; H[7]=(H[7]+h)>>>0;
      }
      const out = new Uint8Array(32);
      const odv = new DataView(out.buffer);
      for (let i = 0; i < 8; i++) odv.setUint32(i * 4, H[i], false);
      return out;
    }

    function hmacSha256(keyBytes, msgBytes) {
      let key = keyBytes;
      if (key.length > 64) key = sha256(key);
      const ipad = new Uint8Array(64 + msgBytes.length);
      const opad = new Uint8Array(64 + 32);
      for (let i = 0; i < 64; i++) {
        const kb = i < key.length ? key[i] : 0;
        ipad[i] = kb ^ 0x36;
        opad[i] = kb ^ 0x5c;
      }
      ipad.set(msgBytes, 64);
      const inner = sha256(ipad);
      opad.set(inner, 64);
      return sha256(opad);
    }

    function pbkdf2(passwordBytes, saltBytes, iterations, dkLen) {
      const hLen = 32;
      const blocks = Math.ceil(dkLen / hLen);
      const out = new Uint8Array(blocks * hLen);
      for (let i = 1; i <= blocks; i++) {
        const blockSalt = new Uint8Array(saltBytes.length + 4);
        blockSalt.set(saltBytes, 0);
        blockSalt[saltBytes.length]     = (i >>> 24) & 0xff;
        blockSalt[saltBytes.length + 1] = (i >>> 16) & 0xff;
        blockSalt[saltBytes.length + 2] = (i >>> 8) & 0xff;
        blockSalt[saltBytes.length + 3] = i & 0xff;
        let u = hmacSha256(passwordBytes, blockSalt);
        const t = Uint8Array.from(u);
        for (let j = 1; j < iterations; j++) {
          u = hmacSha256(passwordBytes, u);
          for (let k = 0; k < hLen; k++) t[k] ^= u[k];
        }
        out.set(t, (i - 1) * hLen);
      }
      return out.slice(0, dkLen);
    }

    this.__sha = { sha256, hmacSha256, pbkdf2 };
    return this.__sha;
  },

  /* ---------- core: hash + verify (async) ---------- */
  async hash(password) {
    const pw = String(password == null ? '' : password);
    const salt = this._randomBytes(16);
    const iterations = this.ITERATIONS;
    let dk;
    if (typeof crypto !== 'undefined' && crypto.subtle && window.isSecureContext) {
      const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
      const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, 256);
      dk = new Uint8Array(bits);
    } else {
      dk = this._sha256Fallback().pbkdf2(new TextEncoder().encode(pw), salt, iterations, 32);
    }
    return this.HASH_PREFIX + '$' + iterations + '$' + this._b64(salt) + '$' + this._b64(dk);
  },

  async verify(password, stored) {
    if (!stored || typeof stored !== 'string') return false;
    const parts = stored.split('$');
    if (parts.length !== 4 || parts[0] !== this.HASH_PREFIX) return false;
    const iterations = parseInt(parts[1], 10);
    if (!iterations || iterations < 1000) return false;
    let salt, expected;
    try { salt = this._unb64(parts[2]); expected = this._unb64(parts[3]); } catch (e) { return false; }
    const pw = String(password == null ? '' : password);
    let dk;
    if (typeof crypto !== 'undefined' && crypto.subtle && window.isSecureContext) {
      const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
      const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, expected.length * 8);
      dk = new Uint8Array(bits);
    } else {
      dk = this._sha256Fallback().pbkdf2(new TextEncoder().encode(pw), salt, iterations, expected.length);
    }
    if (dk.length !== expected.length) return false;
    let diff = 0;                       /* constant-time compare */
    for (let i = 0; i < dk.length; i++) diff |= dk[i] ^ expected[i];
    return diff === 0;
  },

  /* ---------- password strength ---------- */
  validateNewPassword(pw) {
    const s = String(pw == null ? '' : pw);
    if (s.length < this.MIN_PASSWORD) return 'Your new password must be at least ' + this.MIN_PASSWORD + ' characters long.';
    if (!/[A-Za-z]/.test(s) || !/[0-9]/.test(s)) return 'Your new password must contain at least one letter and one number.';
    return null;
  },

  /* ---------- temporary passwords ----------
     Unique, securely generated, shown to the admin exactly once. */
  /* Unbiased character pick — rejects the short tail of a byte so every
     character of the alphabet is equally likely. */
  _pickChar(set) {
    const limit = 256 - (256 % set.length);
    for (;;) {
      const b = this._randomBytes(1)[0];
      if (b < limit) return set[b % set.length];
    }
  },

  generateTempPassword() {
    /* I/l/1, O/0 and similar are left out so a password can be read aloud. */
    const lowers = 'abcdefghijkmnopqrstuvwxyz';
    const uppers = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const digits = '23456789';
    const all = lowers + uppers + digits;
    const from = (set, n) => { let s = ''; for (let i = 0; i < n; i++) s += this._pickChar(set); return s; };
    /* guarantee one of each class first, then shuffle so the order leaks nothing */
    const chars = (from(lowers, 1) + from(uppers, 1) + from(digits, 1) + from(all, 9)).split('');
    const rnd = this._randomBytes(chars.length * 2);
    for (let i = chars.length - 1, k = 0; i > 0; i--, k++) {
      const j = ((rnd[k * 2] << 8) | rnd[k * 2 + 1]) % (i + 1);
      const tmp = chars[i]; chars[i] = chars[j]; chars[j] = tmp;
    }
    return chars.join('');
  },

  tempPasswordExpiryDate(from) {
    const base = from ? new Date(from) : new Date();
    return new Date(base.getTime() + this.TEMP_PASSWORD_TTL_HOURS * 3600 * 1000).toISOString();
  },

  tempPasswordExpired(user) {
    if (!user || !user.tempPasswordExpiresAt) return false;
    return new Date(user.tempPasswordExpiresAt).getTime() < Date.now();
  },

  /* ---------- session / CSRF tokens ---------- */
  newToken() {
    return this._b64(this._randomBytes(24));
  },

  /* ---------- account helpers ---------- */

  /* Issue a brand-new temporary password for an existing user record.
     Returns the plaintext temporary password (admin must copy it now —
     it is never retrievable again) and the updated user object. */
  async issueTemporaryPassword(userId, reason) {
    const users = DB.get('users');
    const i = users.findIndex(u => u.id === userId);
    if (i === -1) return { ok: false, error: 'Account not found.' };
    const temp = this.generateTempPassword();
    users[i].passwordHash = await this.hash(temp);
    delete users[i].password;                    /* never keep plain text */
    users[i].mustChangePassword = true;
    users[i].tempPasswordExpiresAt = this.tempPasswordExpiryDate();
    users[i].passwordResetAt = new Date().toISOString();
    /* rotate tokens so every outstanding session for this account dies */
    users[i].sessionToken = this.newToken();
    users[i].csrfToken = this.newToken();
    DB.set('users', users);
    const s = Auth.session();
    if (typeof Audit !== 'undefined') {
      Audit.log('auth.password.reset',
        'Temporary password issued for ' + users[i].username + ' (' + users[i].role + ')' +
        (reason ? ' — ' + reason : ''));
    }
    return { ok: true, tempPassword: temp, user: users[i] };
  },

  /* Create a brand new account that MUST change its password on first login.
     Returns the temporary password exactly once. */
  async createAccount(fields) {
    if (!fields || !fields.username || !fields.role) return { ok: false, error: 'Username and role are required.' };
    const users = DB.get('users');
    if (users.some(u => u.username === fields.username)) return { ok: false, error: 'That username is already taken.' };
    const temp = this.generateTempPassword();
    const rec = {
      id: fields.id || DB.uid(),
      username: fields.username,
      passwordHash: await this.hash(temp),
      role: fields.role,
      name: fields.name || '',
      email: fields.email || '',
      phone: fields.phone || '',
      subject: fields.subject || '',
      grade: fields.grade || '',
      className: fields.className || '',
      photo: '',
      createdAt: new Date().toISOString(),
      mustChangePassword: true,
      tempPasswordExpiresAt: this.tempPasswordExpiryDate()
    };
    if (fields.uniformDepts) rec.uniformDepts = fields.uniformDepts;
    if (fields.childrenIds) rec.childrenIds = fields.childrenIds;
    users.push(rec);
    DB.set('users', users);
    if (typeof Audit !== 'undefined') Audit.log('auth.account.create', 'Account created for ' + rec.username + ' (' + rec.role + ')');
    return { ok: true, tempPassword: temp, user: rec };
  },

  /* Transparently upgrade any legacy plain-text password to a hash.
     Called after login with the correct password, and by migratePasswords(). */
  async upgradeLegacyPassword(user, plainPassword) {
    if (!user || typeof user.password === 'undefined') return;
    const users = DB.get('users');
    const i = users.findIndex(u => u.id === user.id);
    if (i === -1) return;
    users[i].passwordHash = await this.hash(plainPassword != null ? plainPassword : users[i].password);
    delete users[i].password;
    DB.set('users', users);
    delete user.password;
    user.passwordHash = users[i].passwordHash;
  },

  /* One-shot migration: hash every plain-text password still sitting in the
     store. Safe to call repeatedly — already-hashed accounts are skipped. */
  async migratePasswords() {
    const users = DB.get('users');
    if (!Array.isArray(users)) return;
    let changed = false;
    for (let i = 0; i < users.length; i++) {
      if (typeof users[i].password !== 'undefined') {
        users[i].passwordHash = await this.hash(users[i].password);
        delete users[i].password;
        changed = true;
      }
      /* default accounts are already trusted — do not force a password change */
      if (users[i].mustChangePassword === undefined && users[i].role) {
        const def = DEFAULT_ACCOUNTS.find(a => a.username === users[i].username);
        if (def) users[i].mustChangePassword = false;
      }
    }
    if (changed) DB.set('users', users);
  },

  /* Password recovery: the user's recorded recovery answer, if any. */
  setRecovery(userId, question, answer) {
    const users = DB.get('users');
    const i = users.findIndex(u => u.id === userId);
    if (i === -1) return { ok: false, error: 'Account not found.' };
    users[i].recoveryQuestion = String(question || '').trim();
    users[i].recoveryAnswerHash = answer ? this.hashSync(String(answer).trim().toLowerCase()) : '';
    DB.set('users', users);
    return { ok: true };
  },

  /* Synchronous digest used only for recovery answers (not passwords). */
  hashSync(str) {
    const { sha256 } = this._sha256Fallback();
    const bytes = new TextEncoder().encode(String(str).toLowerCase());
    return this._b64(sha256(bytes));
  },

  checkRecoveryAnswer(user, answer) {
    if (!user || !user.recoveryAnswerHash) return false;
    return user.recoveryAnswerHash === this.hashSync(String(answer || '').trim().toLowerCase());
  }
};

/* ============================================================
   BOOTSTRAP — hash any legacy plain-text passwords once.
   ============================================================ */
(async function secureBootstrap() {
  try {
    if (typeof DB !== 'undefined' && typeof DB.get === 'function') await Security.migratePasswords();
  } catch (e) { console.error('Password migration failed:', e); }
})();
