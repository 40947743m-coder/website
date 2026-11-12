/* ============================================================
   SERVER PERSISTENCE
   Keeps the site content saved on the server (data/site-data.json
   through api.php) instead of only in one browser.

   - On every page load the saved content is loaded from the server
     into localStorage, so visitors and staff all see the same data.
   - When the admin panel saves something, the content is mirrored
     back to the server automatically.
   ============================================================ */
(function () {
  'use strict';

  var PREFIX = 'sta_';
  var script = document.currentScript;
  var scriptURL = script && script.src
    ? new URL(script.src, document.baseURI)
    : new URL('js/persist.js', document.baseURI);
  var API = new URL('../api.php', scriptURL).href;

  function parse(raw) {
    try { return JSON.parse(raw); } catch (e) { return undefined; }
  }

  /* Load saved content from the server (synchronous so it is ready
     before the rest of the page scripts run). */
  function loadFromServer() {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', API + '?t=' + Date.now(), false);
      xhr.send(null);
      if (xhr.status !== 200) return null;
      var res = parse(xhr.responseText);
      if (!res || !res.ok || !res.data || typeof res.data !== 'object') return null;
      return res.data;
    } catch (e) {
      return null;
    }
  }

  function hydrate(data) {
    if (!data || typeof data !== 'object') return;
    Object.keys(data).forEach(function (key) {
      if (key === '__images') return;
      try { localStorage.setItem(PREFIX + key, JSON.stringify(data[key])); } catch (e) { /* quota */ }
    });
  }

  /* Build a snapshot of everything currently saved in this browser. */
  function snapshot() {
    var out = {};
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (!key || key.indexOf(PREFIX) !== 0) continue;
        var value = parse(localStorage.getItem(key));
        if (value !== undefined) out[key.slice(PREFIX.length)] = value;
      }
    } catch (e) { /* ignore */ }
    return out;
  }

  function post(data, async) {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', API, async !== false);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(JSON.stringify(data));
      if (async === false) return xhr.status >= 200 && xhr.status < 300;
      return true;
    } catch (e) {
      return false;
    }
  }

  var timer = null;

  function schedule() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () {
      timer = null;
      post(snapshot(), true);
    }, 500);
  }

  function pushNow() {
    if (timer) { clearTimeout(timer); timer = null; }
    return post(snapshot(), false);
  }

  /* Export everything, including photos still held in IndexedDB. */
  async function exportAll() {
    var data = snapshot();
    var images = {};
    if (window.ImageStore) {
      try {
        var keys = await ImageStore.keys();
        for (var i = 0; i < keys.length; i++) {
          var value = await ImageStore.get(keys[i]);
          if (value) images[keys[i]] = value;
        }
      } catch (e) { /* ignore */ }
    }
    data.__images = images;
    return data;
  }

  /* Import data exported from another browser. Photos are uploaded to
     assets/ and the references are rewritten so every visitor can see them. */
  async function importAll(data) {
    if (!data || typeof data !== 'object') throw new Error('Invalid backup file.');

    var images = data.__images && typeof data.__images === 'object' ? data.__images : {};
    delete data.__images;

    var pathByKey = {};
    var uploadedAll = true;
    if (window.ImageStore && window.ImageUpload) {
      var keys = Object.keys(images);
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        try {
          var stored = await ImageStore.put(key, images[key]);
          var result = await ImageUpload.uploadDataURL(images[key], key + '.jpg');
          pathByKey[key] = result.path;
        } catch (e) {
          uploadedAll = false;
        }
      }
    }

    function rewrite(value) {
      if (!value || typeof value !== 'object') return value;
      if (Array.isArray(value)) return value.map(rewrite);
      var copy = {};
      Object.keys(value).forEach(function (k) { copy[k] = rewrite(value[k]); });
      if (copy.imageKey && pathByKey[copy.imageKey] && !copy.imageUrl) {
        copy.imageUrl = pathByKey[copy.imageKey];
        delete copy.imageKey;
      }
      return copy;
    }

    Object.keys(data).forEach(function (key) {
      try { localStorage.setItem(PREFIX + key, JSON.stringify(rewrite(data[key]))); } catch (e) { /* quota */ }
    });

    await pushNow();
    return { uploadedAll: uploadedAll };
  }

  hydrate(loadFromServer());

  window.addEventListener('pagehide', function () {
    if (timer) pushNow();
  });

  window.SitePersist = {
    api: API,
    schedule: schedule,
    push: pushNow,
    exportAll: exportAll,
    importAll: importAll,
    hasServer: function () { return loadFromServer() !== null; }
  };
})();
