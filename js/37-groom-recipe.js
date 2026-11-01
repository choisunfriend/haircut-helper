// ============================================================================
// 37-groom-recipe.js (2026-11-01) — 빗질 · 가닥 지우기를 스타일에 "명령"으로 저장하고 다시 실행
// ============================================================================
// 스타일 스펙(커트·펌·스타일링 값)은 다른 손님 두상에 맞춰 다시 만들어지지만,
// 빗질(COMB3D)과 가닥 지우기(ERASE_STRAND)는 "그 손님 머리의 그 자리"에 대한 기록이라 그대로는 못 옮깁니다.
// 그래서 저장할 때 두상 기준 위치(두상 중심 · 반지름으로 나눈 값)로 바꿔 spec.groom 에 넣고,
// 다른 머리에 스타일을 입힐 때 그 두상 크기로 되돌려 같은 자리에 다시 빗질·지우기를 합니다.
// 화면에는 과정이 안 보이고 결과만 보입니다.
//
//   spec.groom = { v:1, comb:"<base64>", erase:"<base64>" }
//     comb  : 빗질 획들 — [종류 u8(0 결정리·1 넘기기) · 세기 u16 · 점 수 u16 · 방향 i16×3 · (점 i16×3 + 무게 f32)×n] …
//     erase : 지운 가닥 뿌리 — i16×3 × n
//     위치는 두상 기준 좌표 × 10000 (두상 반지름 = 10000)
//
// · 스타일 등록(원래 기능 두 곳: registerCurrentAsStyle · REGROW.register)이 저장할 때 붙임 — saveCustomStylesToStorage 를 감쌈
// · 등록할 때 다듬은 3D 화면을 찍어 st.thumb 로 둠 → 「미용실에 올리기」 썸네일
// · 입힐 때: applyStyleSpec 을 감싸 스펙을 입힌 직후 groom 을 다시 실행
// · 끄기: GROOM_RECIPE.on = false
// ============================================================================
var GROOM_RECIPE = (function () {
  'use strict';
  var G = { on: true, maxCombBytes: 180000, maxErase: 200, thumbPx: 320 };
  var Q = 10000;

  // ---- 두상 기준 좌표 ------------------------------------------------------------------------
  function head() {
    var E = null;
    try { E = getHeadEllipsoid(); } catch (e) { E = null; }
    var cy = typeof SCALP_CENTER_Y !== 'undefined' ? +SCALP_CENTER_Y : 0;
    if (!E || !(E.a > 0) || !(E.b > 0) || !(E.c > 0)) return null;
    return { a: E.a, b: E.b, c: E.c, cy: cy };
  }
  function toNorm(H, x, y, z) { return [x / H.a, (y - H.cy) / H.b, z / H.c]; }
  function fromNorm(H, u, v, w) { return [u * H.a, v * H.b + H.cy, w * H.c]; }
  function q16(v) { v = Math.round(v * Q); return v < -32767 ? -32767 : v > 32767 ? 32767 : v; }

  // ---- base64 <-> bytes ----------------------------------------------------------------------
  function toB64(u8) {
    var s = '';
    for (var i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function fromB64(b) {
    var s = atob(b), u8 = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
    return u8;
  }

  // ---- 빗질 획 → bytes -----------------------------------------------------------------------
  function encodeComb(H) {
    if (typeof COMB3D === 'undefined') return null;
    var list = [];
    (COMB3D.samples || []).forEach(function (s) { list.push([0, s]); });
    (COMB3D.sweeps || []).forEach(function (s) { list.push([1, s]); });
    if (!list.length) return null;
    // 점이 너무 많으면 고르게 솎음(획 모양은 유지)
    var totalPts = 0;
    list.forEach(function (it) { totalPts += it[1].m || 0; });
    var est = list.length * 13 + totalPts * 10;
    var step = est > G.maxCombBytes ? Math.ceil(est / G.maxCombBytes) : 1;
    var parts = [], size = 0;
    list.forEach(function (it) {
      var s = it[1], m = s.m || 0, d = s.dabs;
      if (!d || !m) return;
      var keep = [];
      for (var i = 0; i < m; i += step) keep.push(i);
      var buf = new ArrayBuffer(13 + keep.length * 10), dv = new DataView(buf), o = 0;
      dv.setUint8(o, it[0]); o += 1;
      dv.setUint16(o, Math.max(0, Math.min(65535, Math.round((s.k || 0) * 1000))), true); o += 2;
      dv.setUint16(o, keep.length, true); o += 2;
      // 방향은 두상 크기 비율로 바꾼 뒤 단위 벡터로
      var dn = toNorm({ a: H.a, b: H.b, c: H.c, cy: 0 }, s.dx || 0, s.dy || 0, s.dz || 0);
      var L = Math.hypot(dn[0], dn[1], dn[2]) || 1;
      dv.setInt16(o, q16(dn[0] / L), true); o += 2;
      dv.setInt16(o, q16(dn[1] / L), true); o += 2;
      dv.setInt16(o, q16(dn[2] / L), true); o += 2;
      for (var j = 0; j < keep.length; j++) {
        var b = keep[j] * 4, p = toNorm(H, d[b], d[b + 1], d[b + 2]);
        dv.setInt16(o, q16(p[0]), true); o += 2;
        dv.setInt16(o, q16(p[1]), true); o += 2;
        dv.setInt16(o, q16(p[2]), true); o += 2;
        dv.setFloat32(o, d[b + 3] || 0, true); o += 4;
      }
      parts.push(new Uint8Array(buf)); size += buf.byteLength;
    });
    if (!size) return null;
    var all = new Uint8Array(size), at = 0;
    parts.forEach(function (p) { all.set(p, at); at += p.length; });
    return toB64(all);
  }

  function decodeComb(b64, H) {
    var u8 = fromB64(b64), dv = new DataView(u8.buffer), o = 0, out = { samples: [], sweeps: [] }, g = 1;
    var dirH = { a: H.a, b: H.b, c: H.c, cy: 0 };
    while (o + 13 <= u8.length) {
      var kind = dv.getUint8(o); o += 1;
      var k = dv.getUint16(o, true) / 1000; o += 2;
      var n = dv.getUint16(o, true); o += 2;
      var dx = dv.getInt16(o, true) / Q, dy = dv.getInt16(o + 2, true) / Q, dz = dv.getInt16(o + 4, true) / Q; o += 6;
      if (o + n * 10 > u8.length) break;
      var dabs = new Float32Array(n * 4);
      for (var j = 0; j < n; j++) {
        var p = fromNorm(H, dv.getInt16(o, true) / Q, dv.getInt16(o + 2, true) / Q, dv.getInt16(o + 4, true) / Q);
        dabs[j * 4] = p[0]; dabs[j * 4 + 1] = p[1]; dabs[j * 4 + 2] = p[2];
        dabs[j * 4 + 3] = dv.getFloat32(o + 6, true);
        o += 10;
      }
      var dd = fromNorm(dirH, dx, dy, dz), L = Math.hypot(dd[0], dd[1], dd[2]) || 1;
      var smp = { dabs: dabs, m: n, dx: dd[0] / L, dy: dd[1] / L, dz: dd[2] / L, k: k, g: g++ };
      (kind === 1 ? out.sweeps : out.samples).push(smp);
    }
    return out;
  }

  function encodeErase(H) {
    if (typeof ERASE_STRAND === 'undefined' || !ERASE_STRAND.exportRoots) return null;
    var roots = ERASE_STRAND.exportRoots().slice(0, G.maxErase);
    if (!roots.length) return null;
    var buf = new ArrayBuffer(roots.length * 6), dv = new DataView(buf);
    roots.forEach(function (r, i) {
      var p = toNorm(H, r.x, r.y, r.z);
      dv.setInt16(i * 6, q16(p[0]), true); dv.setInt16(i * 6 + 2, q16(p[1]), true); dv.setInt16(i * 6 + 4, q16(p[2]), true);
    });
    return toB64(new Uint8Array(buf));
  }
  function decodeErase(b64, H) {
    var u8 = fromB64(b64), dv = new DataView(u8.buffer), out = [];
    for (var o = 0; o + 6 <= u8.length; o += 6) {
      var p = fromNorm(H, dv.getInt16(o, true) / Q, dv.getInt16(o + 2, true) / Q, dv.getInt16(o + 4, true) / Q);
      out.push({ x: p[0], y: p[1], z: p[2] });
    }
    return out;
  }

  // ---- 지금 다듬은 상태 → groom ----------------------------------------------------------------
  G.capture = function () {
    var H = head(); if (!H) return null;
    var g = { v: 1 }, comb = null, erase = null;
    try { comb = encodeComb(H); } catch (e) { console.warn('[다듬기 저장] 빗질 저장 실패', e); }
    try { erase = encodeErase(H); } catch (e) { console.warn('[다듬기 저장] 지우기 저장 실패', e); }
    if (comb) g.comb = comb;
    if (erase) g.erase = erase;
    return (comb || erase) ? g : null;
  };

  // ---- groom → 지금 머리에 다시 실행 (화면에는 결과만) -------------------------------------------
  G.replay = function (groom) {
    if (!G.on || !groom || typeof groom !== 'object') return false;
    var H = head(); if (!H) return false;
    try {
      // 빗질은 "지금 3D 머리"에 붙어 있어 머리가 바뀌면 지워짐 → 먼저 지금 머리로 맞춰 둔 뒤 넣음
      if (typeof COMB3D !== 'undefined') {
        try { void state.hair3Dneutral; } catch (e) { /* 무시 */ }
        if (COMB3D._beforeCompute) COMB3D._beforeCompute();
        COMB3D.samples.length = 0; COMB3D.sweeps.length = 0;
        if (typeof groom.comb === 'string' && groom.comb) {
          var c = decodeComb(groom.comb, H);
          Array.prototype.push.apply(COMB3D.samples, c.samples);
          Array.prototype.push.apply(COMB3D.sweeps, c.sweeps);
        }
        if (COMB3D.refresh) COMB3D.refresh();
      }
    } catch (e) { console.warn('[다듬기 실행] 빗질 실패', e); }
    try {
      if (typeof ERASE_STRAND !== 'undefined' && ERASE_STRAND.importRoots) {
        ERASE_STRAND.importRoots(typeof groom.erase === 'string' && groom.erase ? decodeErase(groom.erase, H) : []);
      }
    } catch (e) { console.warn('[다듬기 실행] 지우기 실패', e); }
    return true;
  };

  // ---- 다듬은 3D 화면 사진 ---------------------------------------------------------------------
  G.snapshot = function () {
    try {
      var m = model3D && model3D.initialized ? model3D : null;
      if (!m) return null;
      m.renderer.render(m.scene, m.camera);           // 바로 그려서 읽음(그림판 버퍼가 비기 전에)
      var src = m.renderer.domElement;
      if (!src.width || !src.height) return null;
      var px = G.thumbPx, side = Math.min(src.width, src.height);
      var c = document.createElement('canvas'); c.width = c.height = px;
      var g = c.getContext('2d');
      g.fillStyle = '#e8e2d8'; g.fillRect(0, 0, px, px);
      g.drawImage(src, (src.width - side) / 2, (src.height - side) / 2, side, side, 0, 0, px, px);
      var url = c.toDataURL('image/jpeg', 0.75);
      return url.length < 120000 ? url : null;
    } catch (e) { return null; }
  };

  // ---- 걸기 ① 스타일 등록 때 groom · 사진 붙이기 -----------------------------------------------
  var known = new Set();
  function markKnown() { try { STYLES.forEach(function (s) { if (s && s.id) known.add(s.id); }); } catch (e) { /* 무시 */ } }
  markKnown();
  if (typeof loadCustomStylesFromStorage === 'function') {
    var _load = loadCustomStylesFromStorage;
    loadCustomStylesFromStorage = function () { // eslint-disable-line no-global-assign
      var r = _load.apply(this, arguments); markKnown(); return r;
    };
  }
  if (typeof saveCustomStylesToStorage === 'function') {
    var _save = saveCustomStylesToStorage;
    saveCustomStylesToStorage = function () { // eslint-disable-line no-global-assign
      try {
        if (G.on) STYLES.forEach(function (st) {
          if (!st || !st.isCustom || known.has(st.id)) return;
          known.add(st.id);                              // 방금 등록한 스타일 — 지금 다듬은 상태를 붙임
          if (st.spec && typeof st.spec === 'object') {
            var groom = G.capture();
            if (groom) st.spec.groom = groom;
          }
          var shot = G.snapshot();
          if (shot) st.thumb = shot;
        });
      } catch (e) { console.warn('[다듬기 저장] 실패', e); }
      return _save.apply(this, arguments);
    };
  }

  // ---- 걸기 ② 스펙을 입힌 직후 groom 실행 ------------------------------------------------------
  if (typeof applyStyleSpec === 'function') {
    var _apply = applyStyleSpec;
    applyStyleSpec = function (id) { // eslint-disable-line no-global-assign
      var r = _apply.apply(this, arguments);
      try {
        if (r && G.on) {
          var sp = typeof getStyleSpec === 'function' ? getStyleSpec(id) : null;
          if (sp && sp.groom) { G.replay(sp.groom); r.groom = true; }
          else {
            // 다듬기가 없는 스타일로 바꾸면 이전 스타일의 지우기는 남기지 않음(빗질은 원래 흐름이 지움)
            if (typeof ERASE_STRAND !== 'undefined' && ERASE_STRAND.importRoots) ERASE_STRAND.importRoots([]);
          }
        }
      } catch (e) { console.warn('[다듬기 실행] 실패', e); }
      return r;
    };
  }

  G.encodeComb = encodeComb; G.decodeComb = decodeComb; G.head = head;
  return G;
})();
