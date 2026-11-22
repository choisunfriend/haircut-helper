/* ==========================================================================
 * 45-mask-cache.js — 저장된 사진은 머리 추출(세그멘테이션·랜드마크·결 읽기)을 한 번만
 *
 * 사용자: "사진이 저장돼서 한번 머리추출단계를 거친 사진들은 다음번에 그 과정 없이 바로 스타일로"
 *
 * · 사진마다(원본 사진 지문 = SHA-256) 추출 결과를 이 기기 IndexedDB('gyeol-mask-cache')에 보관.
 *   보관하는 것 = extractHairMaskCore가 만드는 것 전부:
 *     state.shots(머리 키운 사진) · _zoomFrom/_zoomedShot/_zoomXform · landmarks · hairCanvases · baseCanvases ·
 *     hairMasks(identity·결·photoRGB·personMask …) · SUBJECT_ZOOM.stats · SIDE_POSE_YAW.byAngle · 타래 조각(REGROW clumps)
 * · 보관은 [저장된 사진](30)에 들어 있는 사진만 — 사용자가 "저장"을 고르지 않은 사진의 분석은 기기에 남기지 않음.
 *   "Delete saved"를 누르면 분석도 같이 지움.
 * · 스타일로 넘어갈 때(runStyleAnalysisPipeline 바깥 단계) 4장 모두 보관본이 있으면 → 모델 기다림·추출 없이 바로 복원.
 *   일부만 있으면 → 원래 파이프라인을 돌리되 보관본이 있는 각도는 extractHairMask 바깥 단계에서 복원으로 대신.
 * · 분석 코드가 바뀌면 VER를 올릴 것(예전 보관본은 버려짐). 해상도(INPUT_RES.maxDim)·세그 기준(segthr)도 지문에 들어감.
 * · 360 추가 사진(VIEWS360)은 보관하지 않음 — 3D를 만들기 직전 VIEWS360._build가 원래대로 분석함.
 *
 * 끄기: MASK_CACHE.on=false · 진단 MASK_CACHE.stats · 지우기 MASK_CACHE.clear()
 * ========================================================================== */
var MASK_CACHE = (function () {
  'use strict';
  var W = window, TAG = '[분석 보관]';
  var VER = 'mc1';
  var DB = 'gyeol-mask-cache', STORE = 'views';
  var M = Object.assign({ on: true }, W.MASK_CACHE || {});
  var S = M.stats = { hits: 0, misses: 0, saved: 0, fast: 0, lastMs: 0 };
  var allowed = {};          // key → true : 저장된 사진의 지문(이것만 기기에 남김)
  var pending = {};          // key → 직렬화된 기록(이번 세션에 추출했지만 아직 저장 허락 전)
  var allowReady = Promise.resolve();

  function angles() { try { return ANGLES; } catch (e) { return ['front', 'left', 'right', 'back']; } }

  /* ── IndexedDB ───────────────────────────────────────────────────────── */
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
        var t, out;
        try { t = db.transaction(STORE, mode); out = fn(t.objectStore(STORE)); } catch (e) { db.close(); rej(e); return; }
        t.oncomplete = function () { res(out && out.result !== undefined ? out.result : undefined); db.close(); };
        t.onerror = function () { rej(t.error); db.close(); };
        t.onabort = function () { rej(t.error); db.close(); };
      });
    });
  }
  function dbGet(k) { return tx('readonly', function (s) { return s.get(k); }).catch(function () { return null; }); }
  function dbPut(k, v) { return tx('readwrite', function (s) { return s.put(v, k); }); }
  function dbKeys() { return tx('readonly', function (s) { return s.getAllKeys(); }).catch(function () { return []; }); }
  function dbDel(k) { return tx('readwrite', function (s) { return s.delete(k); }).catch(function () {}); }

  /* ── 사진 지문 ───────────────────────────────────────────────────────── */
  function origShot(a) {
    var s = state.shots && state.shots[a];
    try { if (s && state._zoomedShot && state._zoomedShot[a] === s && state._zoomFrom && state._zoomFrom[a]) return state._zoomFrom[a]; } catch (e) {}
    return s || null;
  }
  function settingsTag() {
    var r = '', t = '';
    try { r = INPUT_RES.maxDim; } catch (e) {}
    try { t = /[?&]segthr=([0-9.]+)/.exec(location.search); t = t ? t[1] : (typeof W.SEG_THRESH === 'number' ? W.SEG_THRESH : ''); } catch (e) {}
    return VER + '|' + r + '|' + t;
  }
  var hashMemo = new Map();
  function keyOf(angle, shot) {
    if (!shot) return Promise.resolve(null);
    var memo = hashMemo.get(shot);
    var p = memo || (function () {
      try {
        if (W.crypto && crypto.subtle && W.TextEncoder) {
          return crypto.subtle.digest('SHA-256', new TextEncoder().encode(shot)).then(function (buf) {
            return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
          });
        }
      } catch (e) {}
      var n = shot.length, m = n >> 1;                       // 보안 컨텍스트가 아니면(crypto.subtle 없음) 거친 지문
      return Promise.resolve('w' + n + ':' + shot.slice(m, m + 48) + ':' + shot.slice(-64));
    })();
    if (!memo) { hashMemo.set(shot, p); if (hashMemo.size > 32) hashMemo.delete(hashMemo.keys().next().value); }
    return p.then(function (h) { return settingsTag() + '|' + angle + '|' + h; });
  }

  /* ── 직렬화: 캔버스 → PNG Blob, 그 밖에 복제 못 하는 것(이미지·함수·WebGL)은 뺌 ── */
  function isCanvas(v) {
    return (typeof HTMLCanvasElement !== 'undefined' && v instanceof HTMLCanvasElement) ||
           (typeof OffscreenCanvas !== 'undefined' && v instanceof OffscreenCanvas);
  }
  function canvasBlob(c) {
    if (!c.width || !c.height) return Promise.resolve(null);
    if (c.convertToBlob) return c.convertToBlob({ type: 'image/png' });
    return new Promise(function (res) { try { c.toBlob(function (b) { res(b); }, 'image/png'); } catch (e) { res(null); } });
  }
  function pack(root) {
    var seen = new Map(), jobs = [];
    function walk(v) {
      if (v === null || typeof v !== 'object') return typeof v === 'function' || typeof v === 'symbol' ? undefined : v;
      if (seen.has(v)) return seen.get(v);
      if (isCanvas(v)) {
        var ph = { __cv: null, w: v.width, h: v.height };
        seen.set(v, ph);
        jobs.push(canvasBlob(v).then(function (b) { ph.__cv = b; }));
        return ph;
      }
      if (ArrayBuffer.isView(v) || v instanceof ArrayBuffer || v instanceof Date || v instanceof RegExp ||
          (typeof Blob !== 'undefined' && v instanceof Blob) || (typeof ImageData !== 'undefined' && v instanceof ImageData)) { seen.set(v, v); return v; }
      if (Array.isArray(v)) { var arr = []; seen.set(v, arr); for (var i = 0; i < v.length; i++) arr[i] = walk(v[i]); return arr; }
      if (v instanceof Map) { var mp = new Map(); seen.set(v, mp); v.forEach(function (x, k) { mp.set(k, walk(x)); }); return mp; }
      var proto = Object.getPrototypeOf(v);
      if (proto !== Object.prototype && proto !== null) { seen.set(v, undefined); return undefined; }   // DOM·WebGL·클래스 인스턴스
      var o = {}; seen.set(v, o);
      Object.keys(v).forEach(function (k) { var x = walk(v[k]); if (x !== undefined) o[k] = x; });
      return o;
    }
    var out = walk(root);
    return Promise.all(jobs).then(function () { return out; });
  }
  function blobToCanvas(ph) {
    var c = document.createElement('canvas'); c.width = ph.w || 1; c.height = ph.h || 1;
    if (!ph.__cv) return Promise.resolve(c);
    var draw = function (im) { c.getContext('2d').drawImage(im, 0, 0); try { im.close && im.close(); } catch (e) {} return c; };
    if (W.createImageBitmap) return createImageBitmap(ph.__cv).then(draw);
    return new Promise(function (res) {
      var url = URL.createObjectURL(ph.__cv), im = new Image();
      im.onload = function () { draw(im); URL.revokeObjectURL(url); res(c); };
      im.onerror = function () { URL.revokeObjectURL(url); res(c); };
      im.src = url;
    });
  }
  function unpack(root) {
    var seen = new Map(), jobs = [];
    function walk(v, set) {
      if (v === null || typeof v !== 'object') return v;
      if (seen.has(v)) { var got = seen.get(v); if (got && got.__pending) got.__pending.push(set); return got && got.__pending ? null : got; }
      if (v.__cv !== undefined && 'w' in v && 'h' in v && Object.keys(v).length === 3) {
        var slot = { __pending: [set] }; seen.set(v, slot);
        jobs.push(blobToCanvas(v).then(function (c) { seen.set(v, c); slot.__pending.forEach(function (fn) { fn(c); }); }));
        return null;
      }
      if (ArrayBuffer.isView(v) || v instanceof ArrayBuffer || v instanceof Date || v instanceof RegExp ||
          (typeof Blob !== 'undefined' && v instanceof Blob) || (typeof ImageData !== 'undefined' && v instanceof ImageData)) return v;
      if (Array.isArray(v)) { var arr = []; seen.set(v, arr); v.forEach(function (x, i) { arr[i] = walk(x, function (c) { arr[i] = c; }); }); return arr; }
      if (v instanceof Map) { var mp = new Map(); seen.set(v, mp); v.forEach(function (x, k) { mp.set(k, walk(x, function (c) { mp.set(k, c); })); }); return mp; }
      var o = {}; seen.set(v, o);
      Object.keys(v).forEach(function (k) { o[k] = walk(v[k], function (c) { o[k] = c; }); });
      return o;
    }
    var out = walk(root, function () {});
    return Promise.all(jobs).then(function () { return out; });
  }

  /* ── 한 각도: 추출 결과 뜨기 / 되돌리기 ───────────────────────────────── */
  function pick(obj, a) { try { return obj && obj[a] != null ? obj[a] : null; } catch (e) { return null; } }
  function capture(angle) {
    var mi = pick(state.hairMasks, angle);
    if (!mi || !pick(state.hairCanvases, angle)) return Promise.resolve(null);
    var shot = state.shots[angle], zoomed = !!(state._zoomedShot && state._zoomedShot[angle] === shot);
    var clumps = null; try { if (typeof REGROW !== 'undefined' && REGROW.clumpsFor) clumps = REGROW.clumpsFor(angle); } catch (e) {}
    var zs = null; try { zs = SUBJECT_ZOOM.stats[angle] || null; } catch (e) {}
    var sp = null; try { sp = SIDE_POSE_YAW.byAngle[angle] || null; } catch (e) {}
    return pack({
      ver: VER, at: Date.now(), angle: angle,
      shot: shot, zoomed: zoomed,
      zoomFrom: zoomed ? pick(state._zoomFrom, angle) : null,
      zoomXform: zoomed ? pick(state._zoomXform, angle) : null,
      landmarks: pick(state.landmarks, angle),
      hairCanvas: state.hairCanvases[angle],
      baseCanvas: pick(state.baseCanvases, angle),
      hairMask: mi,
      zoomStat: zs, sidePose: sp, clumps: clumps
    });
  }
  function restore(angle, rec) {
    return unpack(rec).then(function (r) {
      var orig = origShot(angle);
      if (r.zoomed && r.zoomFrom) {
        state._zoomFrom = state._zoomFrom || {}; state._zoomedShot = state._zoomedShot || {}; state._zoomXform = state._zoomXform || {};
        state._zoomFrom[angle] = orig || r.zoomFrom;          // 지금 칸에 든 원본 문자열을 그대로(지문 비교가 문자열 동일성으로 됨)
        state.shots[angle] = r.shot;
        state._zoomedShot[angle] = r.shot;
        if (r.zoomXform) { r.zoomXform.url = r.shot; state._zoomXform[angle] = r.zoomXform; }
      }
      state.landmarks = state.landmarks || {};
      state.landmarks[angle] = r.landmarks || null;
      state.hairCanvases[angle] = r.hairCanvas;
      state.baseCanvases[angle] = r.baseCanvas;
      if (state.baseFillCanvases) state.baseFillCanvases[angle] = null;
      if (r.hairMask) r.hairMask.reasonCanvas = null;
      state.hairMasks[angle] = r.hairMask;
      try { if (r.zoomStat) SUBJECT_ZOOM.stats[angle] = r.zoomStat; } catch (e) {}
      try { if (r.sidePose) { r.sidePose.shot = orig || r.sidePose.shot; SIDE_POSE_YAW.byAngle[angle] = r.sidePose; } } catch (e) {}
      try { if (r.clumps && r.hairMask && r.hairMask.identity && REGROW.clumpsSet) REGROW.clumpsSet(r.hairMask.identity, r.clumps); } catch (e) {}
      try { if (state._lmWant) state._lmWant[angle] = false; } catch (e) {}
      try { if (typeof face2DOf === 'function' && r.landmarks) face2DOf(angle); } catch (e) {}
      return true;
    });
  }
  function lookup(angle) {
    var shot = origShot(angle);
    return keyOf(angle, shot).then(function (k) {
      if (!k) return null;
      if (pending[k]) return { key: k, rec: pending[k] };
      return dbGet(k).then(function (rec) { return rec && rec.ver === VER ? { key: k, rec: rec } : null; });
    }).catch(function () { return null; });
  }
  function remember(angle, key) {
    return capture(angle).then(function (rec) {
      if (!rec) return;
      pending[key] = rec;
      return allowReady.then(function () { if (allowed[key]) return persist(key); });
    }).catch(function (e) { console.warn(TAG + ' 뜨기 실패', angle, e); });
  }
  function persist(key) {
    var rec = pending[key]; if (!rec) return Promise.resolve();
    return dbPut(key, rec).then(function () { S.saved++; delete pending[key]; },
      function (e) { console.warn(TAG + ' 기기에 저장 실패(용량?)', e); });
  }

  /* ── extractHairMask(03b) 바깥 단계 — 보관본이 있으면 추출 대신 복원 ──── */
  var baseExtract = W.extractHairMask;
  if (typeof baseExtract === 'function') {
    W.extractHairMask = function (angle) {
      var self = this, args = arguments;
      if (!M.on || typeof indexedDB === 'undefined') return baseExtract.apply(self, args);
      var origKey = null;
      return lookup(angle).then(function (hit) {
        if (hit) {
          return restore(angle, hit.rec).then(function () { S.hits++; console.log(TAG + ' ' + angle + ' 보관된 분석으로 대신(추출 안 함)'); return true; },
            function (e) { console.warn(TAG + ' 복원 실패 — 다시 추출', e); return null; });
        }
        return null;
      }).then(function (done) {
        if (done) return done;
        S.misses++;
        return keyOf(angle, origShot(angle)).then(function (k) {
          origKey = k;
          return baseExtract.apply(self, args);
        }).then(function (ok) {
          if (ok && origKey) remember(angle, origKey);       // 뒤에서(기다리지 않음)
          return ok;
        });
      });
    };
  }

  /* ── runStyleAnalysisPipeline(05) 바깥 단계 — 4장 모두 보관본이면 모델·추출 없이 바로 ── */
  var basePipe = W.runStyleAnalysisPipeline;
  if (typeof basePipe === 'function') {
    W.runStyleAnalysisPipeline = async function () {
      var self = this, args = arguments;
      if (M.on && typeof indexedDB !== 'undefined') {
        try {
          var t0 = performance.now();
          var list = angles().filter(function (a) { return state.shots && state.shots[a]; });
          if (list.length) {
            var hits = await Promise.all(list.map(lookup));
            if (hits.every(Boolean)) {
              for (var i = 0; i < list.length; i++) await restore(list[i], hits[i].rec);
              list.forEach(function (a) { try { if (state.landmarks && state.landmarks[a]) refineSectionBoundaries(a); } catch (e) {} });
              stylePrepDone = true;
              S.fast++; S.hits += list.length; S.lastMs = Math.round(performance.now() - t0);
              console.log(TAG + ' 저장된 사진 ' + list.length + '장 — 보관된 분석으로 바로 스타일로(' + S.lastMs + 'ms)');
              try { if (typeof showToast === 'function') showToast('Using saved analysis — skipped hair extraction'); } catch (e) {}
              return;
            }
          }
        } catch (e) { console.warn(TAG + ' 빠른 길 실패 — 원래대로 분석', e); }
      }
      return basePipe.apply(self, args);
    };
  }

  /* ── 저장된 사진(30)과 묶기 ──────────────────────────────────────────── */
  /* 이 사진들(각도→dataURL, 원본)의 분석만 기기에 남김. 다른 보관본은 지움(저장된 세트는 하나뿐) */
  M.keep = function (shots) {
    allowReady = (async function () {
      var keys = {};
      for (var a in shots) { if (shots[a]) { var k = await keyOf(a, shots[a]); if (k) keys[k] = true; } }
      allowed = keys;
      for (var pk in pending) if (allowed[pk]) await persist(pk);
      var have = await dbKeys();
      for (var i = 0; i < have.length; i++) if (!allowed[have[i]]) await dbDel(have[i]);
    })().catch(function (e) { console.warn(TAG + ' 묶기 실패', e); });
    return allowReady;
  };
  M.clear = function () {
    allowed = {}; pending = {};
    allowReady = tx('readwrite', function (s) { return s.clear(); }).catch(function () {});
    return allowReady;
  };
  M._origShot = origShot;
  M._panelLine = function () {
    return TAG + ' ' + (M.on ? '켜짐' : '꺼짐') + ' · 바로 넘어감 ' + S.fast + '회(직전 ' + S.lastMs + 'ms) · 각도 복원 ' + S.hits + ' · 추출 ' + S.misses + ' · 기기에 저장 ' + S.saved;
  };

  console.log(TAG + ' 설치 — 저장된 사진은 머리 추출 결과를 기기에 보관해 다음엔 바로 스타일로. 끄기 MASK_CACHE.on=false');
  return M;
})();
