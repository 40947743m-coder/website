/* ============================================================
   IMAGE HELPERS — compression + IndexedDB storage
   Shared by public site and admin panel
   ============================================================ */

/* Compress/resize an image file in the browser, returns a data URL Promise */
function compressImage(file, maxWidth = 1400, quality = 0.82, keepPng = false) {
  return new Promise((resolve, reject) => {
    if (!file) { reject(new Error('No file selected')); return; }
    if (!file.type.startsWith('image/')) { reject(new Error('Please choose an image file')); return; }

    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        // white background for JPEG (avoids black bg on transparent images)
        if (!keepPng) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        let dataUrl;
        if (keepPng && (file.type === 'image/png' || file.type === 'image/gif' || file.type === 'image/webp')) {
          dataUrl = canvas.toDataURL('image/png');
        } else {
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Could not read that image. Try a JPG or PNG.'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Could not read the file'));
    reader.readAsDataURL(file);
  });
}

/* IndexedDB store for larger images (slider photos etc.) */
const ImageStore = {
  _db: null,
  _name: 'sta_images',
  _store: 'images',

  open() {
    return new Promise((resolve, reject) => {
      if (this._db) { resolve(this._db); return; }
      if (!window.indexedDB) { reject(new Error('IndexedDB not supported')); return; }
      const req = indexedDB.open(this._name, 1);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this._store)) db.createObjectStore(this._store);
      };
      req.onsuccess = e => { this._db = e.target.result; resolve(this._db); };
      req.onerror = e => reject(e.target.error || new Error('Could not open image database'));
    });
  },

  async put(key, dataUrl) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this._store, 'readwrite');
      tx.objectStore(this._store).put(dataUrl, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = e => reject(e.target.error || new Error('Save failed'));
    });
  },

  async get(key) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this._store, 'readonly');
      const req = tx.objectStore(this._store).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = e => reject(e.target.error || new Error('Load failed'));
    });
  },

  async del(key) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this._store, 'readwrite');
      tx.objectStore(this._store).delete(key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = e => reject(e.target.error || new Error('Delete failed'));
    });
  },

  /* All keys currently held — used to preload photo references at boot. */
  async keys() {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this._store, 'readonly');
      const req = tx.objectStore(this._store).getAllKeys();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = e => reject(e.target.error || new Error('Load failed'));
    });
  },

  /* Every stored value whose key matches a prefix. */
  async getPrefixed(prefix) {
    const keys = await this.keys();
    const out = {};
    for (const k of keys) {
      if (typeof k === 'string' && k.startsWith(prefix)) out[k] = await this.get(k);
    }
    return out;
  }
};
