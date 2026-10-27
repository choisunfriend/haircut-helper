/* ==========================================================================
 * 30-saved-photos.js — Save the 4 capture photos on this device and reuse them next time
 *
 * · Leaving the capture screen (Next →) asks: "Save these photos on this device for next time?"
 * · Yes → the 4 photos are stored in this browser's IndexedDB (on the phone only, never uploaded).
 * · Next visit → a "Use saved photos" button appears on the capture screen; tapping it loads them
 *   into the 4 slots exactly as if they had just been taken/uploaded (face check runs again).
 * · "Delete saved" removes them from the device.
 * ======================================================================== */
(function () {
  'use strict';
  var G = window;
  var DB = 'gyeol-saved-photos', STORE = 'shots', KEY = 'last';

  /* ── IndexedDB (tiny wrapper; every call fails soft) ─────────────────── */
  function openDB() {
    return new Promise(function (res, rej) {
      try {
        var r = indexedDB.open(DB, 1);
        r.onupgradeneeded = function () { r.result.createObjectStore(STORE); };
        r.onsuccess = function () { res(r.result); };
        r.onerror = function () { rej(r.error); };
      } catch (e) { rej(e); }
    });
  }
  function tx(mode, fn) {
    return openDB().then(function (db) {
      return new Promise(function (res, rej) {
        var t = db.transaction(STORE, mode), st = t.objectStore(STORE), out = fn(st);
        t.oncomplete = function () { res(out && out.result !== undefined ? out.result : undefined); db.close(); };
        t.onerror = function () { rej(t.error); db.close(); };
      });
    });
  }
  var getSaved = function () { return tx('readonly', function (s) { return s.get(KEY); }).catch(function () { return null; }); };
  var putSaved = function (v) { return tx('readwrite', function (s) { return s.put(v, KEY); }); };
  var delSaved = function () { return tx('readwrite', function (s) { return s.delete(KEY); }).catch(function () {}); };

  /* ── helpers ─────────────────────────────────────────────────────────── */
  function currentShots() {
    var out = {}, n = 0;
    (typeof ANGLES !== 'undefined' ? ANGLES : ['front', 'left', 'right', 'back']).forEach(function (a) {
      var s = state.shots && state.shots[a];
      if (s) { out[a] = s; n++; }
    });
    return n ? out : null;
  }
  function sig(shots) {
    if (!shots) return '';
    return Object.keys(shots).sort().map(function (a) { var s = shots[a]; return a + ':' + s.length + ':' + s.slice(-40); }).join('|');
  }
  var savedSig = null, askedSig = null;

  /* ── modal ───────────────────────────────────────────────────────────── */
  function ask(title, body, yes, no) {
    return new Promise(function (resolve) {
      var wrap = document.createElement('div');
      wrap.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;' +
        'background:rgba(0,0,0,.55);padding:16px;';
      wrap.innerHTML =
        '<div role="dialog" aria-modal="true" style="max-width:340px;width:100%;background:#221c16;color:#f3eadf;border:1px solid #3a332b;' +
        'border-radius:14px;padding:18px 16px 14px;font:14px/1.45 system-ui,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.4)">' +
        '<div style="font-weight:700;font-size:16px;margin-bottom:6px">' + title + '</div>' +
        '<div style="opacity:.85;margin-bottom:14px">' + body + '</div>' +
        '<div style="display:flex;gap:8px">' +
        '<button type="button" data-v="0" class="btn btn-ghost" style="flex:1;padding:10px">' + no + '</button>' +
        '<button type="button" data-v="1" class="btn btn-primary" style="flex:1;padding:10px">' + yes + '</button>' +
        '</div></div>';
      wrap.addEventListener('click', function (e) {
        var v = e.target && e.target.getAttribute && e.target.getAttribute('data-v');
        if (v == null) return;
        document.body.removeChild(wrap);
        resolve(v === '1');
      });
      document.body.appendChild(wrap);
    });
  }
  function toast(msg) { try { if (typeof showToast === 'function') showToast(msg); } catch (e) {} }

  /* ── 1. Ask to save when leaving the capture screen ──────────────────── */
  var nav = G.navTo;
  if (typeof nav === 'function') {
    G.navTo = async function (screen) {
      var args = arguments, self = this;
      try {
        var from = (typeof currentScreen !== 'undefined') ? currentScreen : null;
        if (screen === 'style' && from === 'capture') {
          var shots = currentShots(), s = sig(shots);
          if (shots && s !== savedSig && s !== askedSig) {
            askedSig = s;
            var yes = await ask('Save photos for next time?',
              'Save these photos on this device so you can reuse them next time without taking them again. ' +
              'They stay on this phone only and are never uploaded.',
              'Yes, save', 'No thanks');
            if (yes) {
              try {
                await putSaved({ shots: shots, at: Date.now() });
                savedSig = s; toast('Photos saved on this device');
                refreshButtons(true);
              } catch (e) { console.warn('[Saved photos] save failed', e); toast('Could not save photos (storage full or blocked)'); }
            }
          }
        }
      } catch (e) { console.warn('[Saved photos]', e); }
      return nav.apply(self, args);
    };
  }

  /* ── 2. "Use saved photos" button on the capture screen ──────────────── */
  function loadSaved() {
    getSaved().then(function (rec) {
      if (!rec || !rec.shots) { toast('No saved photos'); refreshButtons(false); return; }
      var angles = Object.keys(rec.shots);
      angles.forEach(function (a) {
        state.shots[a] = rec.shots[a];
        ['hairCanvases', 'hairMasks', 'baseCanvases'].forEach(function (k) { if (state[k]) state[k][a] = null; });
        ['landmarks', 'captureLmStatus', 'capturePose', 'poseEars'].forEach(function (k) { if (state[k]) state[k][a] = null; });
      });
      try { stylePrepDone = false; } catch (e) {}
      try { state.currentCaptureIndex = 3; } catch (e) {}
      try { updateAngleUI(); } catch (e) {}
      angles.forEach(function (a) { try { checkCaptureLandmarks(a); } catch (e) {} });
      savedSig = sig(currentShots());
      var d = new Date(rec.at);
      toast('Loaded saved photos (' + d.toLocaleDateString() + ')');
    });
  }
  function refreshButtons(has) {
    var row = document.querySelector('#screen-capture .cap-btns');
    if (!row) return;
    var box = document.getElementById('savedPhotoRow');
    if (!has) { if (box) box.remove(); return; }
    if (box) return;
    box = document.createElement('div');
    box.id = 'savedPhotoRow';
    box.style.cssText = 'display:flex;gap:6px;margin-top:6px;';
    box.innerHTML =
      '<button type="button" class="btn" id="useSavedBtn" style="flex:3;font-size:12px;padding:9px 8px;font-weight:700;background:rgba(212,146,74,.14);color:#E8B77C;border:1.5px solid #D4924A;border-radius:10px;">📁 Use saved photos</button>' +
      '<button type="button" class="btn" id="delSavedBtn" style="flex:1;font-size:11px;padding:9px 6px;background:rgba(200,70,70,.10);color:#E08A8A;border:1px solid rgba(224,138,138,.55);border-radius:10px;">Delete saved</button>';
    row.parentNode.insertBefore(box, row.nextSibling);
    document.getElementById('useSavedBtn').onclick = loadSaved;
    document.getElementById('delSavedBtn').onclick = function () {
      ask('Delete saved photos?', 'The saved photos will be removed from this device.', 'Delete', 'Cancel').then(function (y) {
        if (!y) return;
        delSaved().then(function () { savedSig = null; refreshButtons(false); toast('Saved photos deleted'); });
      });
    };
  }

  function init() {
    if (typeof indexedDB === 'undefined') return;
    getSaved().then(function (rec) {
      if (rec && rec.shots) { savedSig = sig(rec.shots); refreshButtons(true); }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
