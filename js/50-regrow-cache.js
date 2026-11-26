// ============================================================================
// 50-regrow-cache.js (2026-11-26) — 3D 보관: 카메라 맞춤 · 다시 기르기 결과를 기기에 보관
// ============================================================================
// 사용자: "저장된 사진으로 돌리면 … 카메라 맞추고 다시 기르기 하는 단계들 매번 하면 지루하잖아"
// · 처음(보관 없음): 지금과 똑같이 만든 뒤, 끝나면 결과를 IndexedDB('stylepeek-regrow-cache')에 보관
//     - VIEW_FIX.fix(사진마다 맞춘 카메라 양) · VIEW_SEAM.yaw(이음새로 고친 옆 사진 각도)
//     - 다시 기른 가닥(점은 Float32Array로 묶음) · 굴곡 장 · 통계
// · 같은 사진 세트로 다시: 맞춘 카메라 값을 먼저 넣어 중립 3D를 한 번만 만들고(맞추기·다시 만들기 생략),
//     다시 기르기 대신 보관한 가닥을 바로 씀 → 몇 초
// · 사진 세트 하나만 보관(새 세트를 만들면 덮어씀) — 보통 5~15MB
// · 사진 지문 = 원본 사진(확대 전 _zoomFrom 우선)의 길이 + 고르게 뽑은 글자의 FNV 해시(동기 · 빠름)
// 끄기: REGROW_CACHE.on = false (새로고침) · 비우기: REGROW_CACHE.clear()
// ============================================================================
var REGROW_CACHE = (function () {
  'use strict';
  var W = window, TAG = '[3D 보관]', DB = 'stylepeek-regrow-cache', STORE = 'sets', KEY = 'last', VER = 1;
  var C = Object.assign({ on: true, maxStrands: 60000 }, W.REGROW_CACHE || {});
  C.stats = { hit: 0, miss: 0, saved: 0, lastMs: 0, err: null };
  if (!C.on || typeof indexedDB === 'undefined') return C;

  var entry = null, ready = null, active = null, savedFor = null;

  // ---- IndexedDB -------------------------------------------------------------------------------
  function open() {
    return new Promise(function (ok, no) {
      try {
        var r = indexedDB.open(DB, 1);
        r.onupgradeneeded = function () { r.result.createObjectStore(STORE); };
        r.onsuccess = function () { ok(r.result); };
        r.onerror = function () { no(r.error); };
      } catch (e) { no(e); }
    });
  }
  function tx(mode, fn) {
    return open().then(function (db) {
      return new Promise(function (ok, no) {
        var t = db.transaction(STORE, mode), q = fn(t.objectStore(STORE));
        t.oncomplete = function () { db.close(); ok(q && q.result); };
        t.onerror = t.onabort = function () { db.close(); no(t.error); };
      });
    });
  }
  ready = tx('readonly', function (s) { return s.get(KEY); }).then(function (e) {
    entry = e && e.v === VER ? e : null;
    if (entry) console.log(TAG + ' 보관된 3D 있음 — 가닥 ' + entry.n + '개 · ' + mb(entry.bytes) + 'MB');
  }).catch(function (e) { C.stats.err = String(e && e.message || e); });

  // ---- 사진 지문 -------------------------------------------------------------------------------
  function angles() { try { return ANGLES; } catch (e) { return ['front', 'left', 'right', 'back']; } }
  function fnv(s) {
    var h = 0x811c9dc5, n = s.length, step = Math.max(1, Math.floor(n / 6000)), i;
    for (i = 0; i < n; i += step) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    for (i = Math.max(0, n - 200); i < n; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(36);
  }
  function photoKey() {
    var parts = [];
    try {
      angles().forEach(function (a) {
        var s = (state._zoomFrom && state._zoomFrom[a]) || (state.shots && state.shots[a]);
        if (typeof s === 'string' && s.length) parts.push(a + ':' + s.length + ':' + fnv(s));
      });
    } catch (e) {}
    return parts.length ? parts.join('|') : null;
  }
  function masksNow() { var m = {}; try { angles().forEach(function (a) { if (state.hairMasks && state.hairMasks[a]) m[a] = state.hairMasks[a]; }); } catch (e) {} return m; }
  function mb(b) { return Math.round((b || 0) / 1e5) / 10; }

  // ---- 안전한 복사(함수·DOM 빼고 · 순환 막기) ------------------------------------------------------
  function plain(v, depth, seen) {
    if (v == null || typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return v;
    if (typeof v === 'function' || depth > 6) return undefined;
    if (ArrayBuffer.isView(v)) return v.slice ? v.slice() : v;
    if (typeof v !== 'object') return undefined;
    if (typeof Node !== 'undefined' && v instanceof Node) return undefined;
    if (seen.indexOf(v) >= 0) return undefined;
    seen.push(v);
    var o;
    if (Array.isArray(v)) { o = new Array(v.length); for (var i = 0; i < v.length; i++) o[i] = plain(v[i], depth + 1, seen); }
    else { o = {}; for (var k in v) { if (!Object.prototype.hasOwnProperty.call(v, k)) continue; var x = plain(v[k], depth + 1, seen); if (x !== undefined) o[k] = x; } }
    seen.pop();
    return o;
  }

  // ---- 가닥 묶기 / 풀기 --------------------------------------------------------------------------
  function pack(strands) {
    var n = strands.length, nPts = 0, i, j, s;
    for (i = 0; i < n; i++) nPts += strands[i].pts ? strands[i].pts.length : 0;
    var P = new Float32Array(nPts * 3), off = new Uint32Array(n + 1), meta = new Array(n), k = 0, extra = false;
    for (i = 0; i < n; i++) {
      s = strands[i]; off[i] = k / 3;
      var pts = s.pts || [];
      for (j = 0; j < pts.length; j++) {
        var p = pts[j]; P[k++] = p.x; P[k++] = p.y; P[k++] = p.z;
        if (!extra && j === 0) { for (var pk in p) if (pk !== 'x' && pk !== 'y' && pk !== 'z') { extra = true; break; } }
      }
      var m = {};
      for (var key in s) { if (key === 'pts' || !Object.prototype.hasOwnProperty.call(s, key)) continue; var x = plain(s[key], 0, []); if (x !== undefined) m[key] = x; }
      meta[i] = m;
    }
    off[n] = k / 3;
    if (extra) console.warn(TAG + ' 가닥 점에 x·y·z 말고 다른 값이 있음 — 보관본에서는 빠집니다');
    return { P: P, off: off, meta: meta };
  }
  function unpack(pk) {
    var n = pk.meta.length, out = new Array(n), P = pk.P, off = pk.off;
    for (var i = 0; i < n; i++) {
      var s = pk.meta[i], a = off[i], b = off[i + 1], pts = new Array(b - a);
      for (var j = a; j < b; j++) pts[j - a] = { x: P[j * 3], y: P[j * 3 + 1], z: P[j * 3 + 2] };
      s.pts = pts; out[i] = s;
    }
    return out;
  }

  // ---- 보관 ------------------------------------------------------------------------------------
  function save(G, photo) {
    var key = photoKey(); if (!key || savedFor === G.model) return;
    if (typeof VIEW_FIX !== 'undefined' && VIEW_FIX.on && !(VIEW_FIX.isDone() && VIEW_FIX.fitDone())) return;   // 카메라 맞추기가 끝난 결과만
    var model = G.model; if (!model || !model.strands || !model.strands.length || model.strands.length > C.maxStrands) return;
    savedFor = model;
    var t0 = Date.now();
    try {
      var vf = {}, vs = {};
      if (typeof VIEW_FIX !== 'undefined') Object.keys(VIEW_FIX.fix || {}).forEach(function (a) { var f = VIEW_FIX.fix[a]; vf[a] = { dp: f.dp || 0, ds: f.ds || 1, dcx: f.dcx || 0, dcy: f.dcy || 0 }; });
      if (typeof VIEW_SEAM !== 'undefined') Object.keys(VIEW_SEAM.yaw || {}).forEach(function (a) { vs[a] = VIEW_SEAM.yaw[a].deg; });
      var pk = pack(model.strands);
      var e = {
        v: VER, key: key, at: Date.now(), n: model.strands.length, vf: vf, vs: vs, pk: pk,
        rgInfo: plain(model.rgInfo, 0, []), waveField: plain(model.waveField, 0, []), stats: plain(G.stats, 0, []),
        bytes: pk.P.byteLength + pk.off.byteLength + pk.meta.length * 120
      };
      tx('readwrite', function (s) { return s.put(e, KEY); }).then(function () {
        entry = e; C.stats.saved++;
        console.log(TAG + ' 보관함 — 가닥 ' + e.n + '개 · 약 ' + mb(e.bytes) + 'MB · ' + (Date.now() - t0) + 'ms (다음엔 같은 사진이면 바로 3D)');
      }).catch(function (err) { savedFor = null; C.stats.err = String(err && err.message || err); console.warn(TAG + ' 보관 실패(용량?) — 다음에도 새로 만듭니다', err); });
    } catch (err) { savedFor = null; C.stats.err = String(err && err.message || err); console.warn(TAG + ' 보관 준비 실패', err); }
  }

  // ---- 꺼내 쓰기 ① 중립 3D 전에: 맞춘 카메라 값 넣기 ------------------------------------------------------
  function prime() {
    active = null;
    if (!entry) return false;
    var key = photoKey();
    if (!key || key !== entry.key) { C.stats.miss++; return false; }
    var m = masksNow(); if (!Object.keys(m).length) return false;
    try {
      if (typeof VIEW_FIX !== 'undefined' && VIEW_FIX.on) {
        VIEW_FIX.fix = {};
        Object.keys(entry.vf).forEach(function (a) { if (m[a]) { var f = entry.vf[a]; VIEW_FIX.fix[a] = { mask: m[a], dp: f.dp, ds: f.ds, dcx: f.dcx, dcy: f.dcy }; } });
        VIEW_FIX.doneMasks = m; VIEW_FIX.fitMasks = Object.assign({}, m); VIEW_FIX.fitLast = '보관한 값(' + TAG + ')';
      }
      if (typeof VIEW_SEAM !== 'undefined') {
        VIEW_SEAM.yaw = {};
        Object.keys(entry.vs).forEach(function (a) { if (m[a]) VIEW_SEAM.yaw[a] = { deg: entry.vs[a], mask: m[a] }; });
      }
    } catch (e) { console.warn(TAG + ' 카메라 값 넣기 실패 — 새로 만듭니다', e); return false; }
    active = { key: key, t0: Date.now() };
    console.log(TAG + ' 같은 사진 — 맞춘 카메라 값을 넣고 중립 3D를 한 번만 만듭니다');
    return true;
  }

  // ---- 꺼내 쓰기 ② 다시 기르기 대신 보관한 가닥 ----------------------------------------------------------
  function useCached(G, cb) {
    var photo = state._hair3Dneutral;
    if (!active || !entry || !photo || !photo.strands || !photo.strands.length || entry.key !== active.key || photoKey() !== entry.key) return false;
    var t0 = Date.now(), strands;
    try { strands = unpack(entry.pk); } catch (e) { console.warn(TAG + ' 가닥 풀기 실패 — 새로 기릅니다', e); active = null; return false; }
    var model = {
      strands: strands, viewCal: photo.viewCal, yTop: photo.yTop, CY: photo.CY, field: photo.field || null, occ: photo.occ || null,
      grid: photo.grid, roots: photo.roots, mannequin: false, regrown: true, rgInfo: entry.rgInfo || null, waveField: entry.waveField || null,
      surf: null, fromCache: true
    };
    photo._camFitDone = photo;
    G.model = model; G.src = photo; G.building = false; G.failedFor = null; G.lastErr = null;
    if (entry.stats) G.stats = entry.stats;
    savedFor = model;
    try { if (G.applyBaseline) G.applyBaseline(); } catch (e) { console.warn(TAG + ' 기준 값 넣기 실패', e); }
    try { if (typeof ADJ_CACHE !== 'undefined' && ADJ_CACHE.bump) ADJ_CACHE.bump(); } catch (e) {}
    try { if (typeof combRefresh === 'function') combRefresh(); else if (typeof renderAdjustFrame === 'function') renderAdjustFrame(); } catch (e) {}
    C.stats.hit++; C.stats.lastMs = Date.now() - active.t0;
    console.log(TAG + ' 보관한 가닥 ' + strands.length + '개를 씀 — 카메라 맞춤·다시 기르기 건너뜀 · 풀기 ' + (Date.now() - t0) + 'ms · 사진→3D ' + C.stats.lastMs + 'ms');
    // active는 남겨 둠 — 사진 3D가 다시 걸려(같은 사진 세트) 모델이 비워져도 다시 보관본을 씀. 새 중립 3D(prime)에서 다시 정함
    if (cb) setTimeout(function () { cb(true); }, 0);
    return true;
  }

  // ---- 끼워 넣기 ------------------------------------------------------------------------------------
  function install() {
    var G = W.REGROW;
    if (!G || typeof G.build !== 'function' || typeof W.buildNeutralHair3D !== 'function') { console.warn(TAG + ' REGROW/buildNeutralHair3D를 못 찾아 꺼짐'); return; }
    var nb = W.buildNeutralHair3D;
    W.buildNeutralHair3D = function () { try { prime(); } catch (e) { active = null; } return nb.apply(this, arguments); };
    if (typeof VIEW_SEAM !== 'undefined' && typeof VIEW_SEAM._wrap === 'function') {
      var sw = VIEW_SEAM._wrap;
      VIEW_SEAM._wrap = function (core, cb) { if (active) return core(cb); return sw.apply(this, arguments); };   // 이음새 재기·다시 만들기 생략
    }
    var gb = G.build;
    G.build = function (cb, opt) {
      var fn = typeof cb === 'function' ? cb : null;
      // 이미 보관본을 걸어 둔 같은 사진이면 다시 기르지 않음(조정 화면 진입·refresh 등이 한 번 더 부름)
      try { if (G.model && G.model.fromCache && G.src === state._hair3Dneutral) { if (fn) setTimeout(function () { fn(true); }, 0); return; } } catch (e) {}
      if (active && !G.building && useCached(G, fn)) return;
      return gb.apply(this, arguments);
    };
    if (typeof G.applyBaseline === 'function') {
      var ab = G.applyBaseline;
      G.applyBaseline = function () {
        var r = ab.apply(this, arguments);
        try { var ph = state._hair3Dneutral; if (G.model && !G.model.fromCache && G.src === ph && savedFor !== G.model) setTimeout(function () { if (G.model && G.src === state._hair3Dneutral) save(G, ph); }, 1500); } catch (e) {}
        return r;
      };
    }
    console.log(TAG + ' 설치 — 같은 사진이면 카메라 맞춤·다시 기르기를 보관본으로 · 끄기 REGROW_CACHE.on=false · 비우기 REGROW_CACHE.clear()');
  }

  C.clear = function () { entry = null; savedFor = null; return tx('readwrite', function (s) { return s.clear(); }).then(function () { console.log(TAG + ' 비움'); }); };
  C.ready = function () { return ready; };
  C.lines = function () { return [TAG + ' ' + (entry ? '보관 있음(가닥 ' + entry.n + ' · ' + mb(entry.bytes) + 'MB · ' + new Date(entry.at).toLocaleString() + ')' : '보관 없음') + ' · 씀 ' + C.stats.hit + ' · 새로 ' + C.stats.miss + ' · 보관 ' + C.stats.saved + (C.stats.lastMs ? ' · 마지막 ' + C.stats.lastMs + 'ms' : '') + (C.stats.err ? ' · ⚠ ' + C.stats.err : '')]; };
  install();
  return C;
})();
