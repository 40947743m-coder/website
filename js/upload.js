/* ============================================================
   SHARED IMAGE UPLOAD HELPER
   Posts images to upload.php, which stores them in assets/.
   Used by the admin panel and the public site.
   ============================================================ */

(function () {
  'use strict';

  const script = document.currentScript;
  const scriptURL = script && script.src
    ? new URL(script.src, document.baseURI)
    : new URL('js/upload.js', document.baseURI);
  const rootURL = new URL('../', scriptURL);
  const endpoint = new URL('upload.php', rootURL).href;

  const MAX_BYTES = 8 * 1024 * 1024;
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

  function isAbsoluteLike(value) {
    return /^(?:data:|blob:|https?:|\/\/|\/)/i.test(value);
  }

  /* Turn a stored value into a URL the current page can load.
     External URLs and data URLs are returned unchanged; project-relative
     paths such as "assets/img.jpg" are resolved from the project root. */
  function assetURL(path) {
    if (!path) return '';
    const value = String(path);
    if (isAbsoluteLike(value)) return value;
    try { return new URL(value, rootURL).href; } catch (e) { return value; }
  }

  function uploadError(message, code, fallback) {
    const error = new Error(message);
    error.code = code || 'upload';
    error.fallback = !!fallback;
    return error;
  }

  function validateFile(file) {
    if (!file) throw uploadError('Please choose an image file.', 'validation', false);
    const type = String(file.type || '').toLowerCase();
    if (type && !ALLOWED_TYPES.includes(type)) {
      throw uploadError('Only JPG, PNG, GIF and WebP images are allowed.', 'validation', false);
    }
    if (file.size > MAX_BYTES) {
      throw uploadError('Images must be 8 MB or smaller.', 'validation', false);
    }
    return true;
  }

  function dataUrlToBlob(dataUrl) {
    const value = String(dataUrl || '');
    const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(value);
    if (!match) throw new Error('The image data could not be read.');
    const mime = match[1] || 'image/jpeg';
    const isBase64 = !!match[2];
    const body = match[3] || '';
    let bytes;
    if (isBase64) {
      const binary = atob(body);
      bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    } else {
      bytes = new TextEncoder().encode(decodeURIComponent(body));
    }
    return new Blob([bytes], { type: mime });
  }

  async function upload(file, options) {
    const opts = options || {};
    validateFile(file);

    const form = new FormData();
    form.append('image', file, opts.filename || file.name || 'image');

    let response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        body: form,
        headers: { Accept: 'application/json' }
      });
    } catch (e) {
      throw uploadError('Could not reach the upload service. Serve the site with PHP enabled and try again.', 'unreachable', true);
    }

    let data = null;
    try {
      data = await response.json();
    } catch (e) {
      throw uploadError('The upload service returned an invalid response. Serve the site with PHP enabled.', 'invalid_response', true);
    }

    if (!response.ok || !data || !data.ok) {
      const unavailable = [404, 405, 501, 502, 503].includes(response.status) || response.status >= 500;
      throw uploadError((data && data.error) || 'The image could not be uploaded.', 'server', unavailable);
    }

    data.url = assetURL(data.path);
    return data;
  }

  function uploadDataURL(dataUrl, filename) {
    const blob = dataUrlToBlob(dataUrl);
    return upload(blob, { filename: filename || 'image.jpg' });
  }

  window.ImageUpload = {
    endpoint: endpoint,
    rootURL: rootURL.href,
    maxBytes: MAX_BYTES,
    allowedTypes: ALLOWED_TYPES.slice(),
    assetURL: assetURL,
    validateFile: validateFile,
    dataUrlToBlob: dataUrlToBlob,
    upload: upload,
    uploadDataURL: uploadDataURL
  };
})();
