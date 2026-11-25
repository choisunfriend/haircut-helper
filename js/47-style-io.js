// ============================================================================
// 47-style-io.js (2026-11-24) — 스타일 손질 의뢰용 내보내기 · 불러오기
// ============================================================================
// 흐름: 미용실 사진 → 여기서 돌림 → [가닥 OBJ 내보내기] → Blender에서 보충·정리
//       → [불러오기 .obj] → 화면 확인 → 「스타일로 등록」 → [스타일 JSON 내보내기]
//       → 미용실에 파일 전달 → 미용실 [불러오기 .json] → 「미용실에 올리기」
//
// · 3D 결과 화면(#model3dViewport) 오른쪽 위: [가닥 OBJ 내보내기] [스타일 JSON 내보내기]
// · 스타일 화면 「미용실에 올리기」 옆: [불러오기] — .obj / .json 을 확장자로 구분
//
// OBJ 형식
//   · 머리: o gyeol_hair · 가닥마다 v … 다음 l i j k …(한 줄 = 가닥 하나, 첫 점 = 뿌리)
//   · 참고용 메쉬: o gyeol_ref_<이름> · v/f (두상·얼굴·몸·옷 — 불러올 때는 무시)
//   · 머리글: # gyeol-head a b c cy  (두피 타원 반지름·중심 높이, 모델 단위)
//             # gyeol-cm-per-unit k
//   · 좌표: 앱 3D 좌표 그대로(Y 위). Blender 기본 OBJ 가져오기/내보내기(Y 위 · −Z 앞)를 그대로 쓰면 되돌아옴.
// OBJ 불러오기
//   · 파일 안의 모든 l(선)을 읽음 — 폴리라인이든 Blender가 쓴 두 점짜리 모서리든 이어서 가닥으로 묶음(f 면은 무시)
//   · 두피에 가까운 끝을 뿌리로 · 머리글의 두상과 지금 두상이 다르면 두상 기준 비율로 옮김
//   · 지금 손님의 다시 기른 머리(REGROW.model) 가닥을 통째로 바꿔 끼움(가닥 속성은 뿌리가 가장 가까운 원래 가닥에서 물려받음)
//     → 마네킹을 끄고 기준을 다시 잼 → 「스타일로 등록」 하면 결 표가 이 가닥에서 뽑힘(원래 등록 경로 그대로)
// JSON
//   · { gyeol:'style', v:1, at, style:{ …STYLES의 커스텀 항목 그대로 } }
//   · 불러오면 새 id로 스타일 목록에 추가 · 저장소에 저장
// 끄기: STYLE_IO.on = false (새로고침)
// ============================================================================
var STYLE_IO = (function () {
  'use strict';
  var W = window, TAG = '[스타일 입출력]';
  var IO = Object.assign({ on: true, maxObjBytes: 200 * 1024 * 1024, maxJsonBytes: 2 * 1024 * 1024, minPts: 3 }, W.STYLE_IO || {});
  if (!IO.on) return IO;

  function L(ko, en) { try { return typeof uiLang !== 'undefined' && uiLang === 'en' ? en : ko; } catch (e) { return ko; } }
  function toast(m) { try { if (typeof showToast === 'function') return showToast(m); } catch (e) {} alert(m); }
  function stamp() { var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; }; return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()); }
  function safeName(s) { return String(s || 'style').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 60); }
  function download(name, parts, type) {
    var blob = new Blob(parts, { type: type }), a = document.createElement('a'), url = URL.createObjectURL(blob);
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { try { URL.revokeObjectURL(url); a.remove(); } catch (e) {} }, 1500);
  }
  function f5(v) { return (Math.round(v * 1e5) / 1e5).toString(); }

  // ---- 두상 기준 ---------------------------------------------------------------------------------
  function headNow() {
    var E = null, cy = 0.15;
    try { E = getScalpEllipsoid(); } catch (e) { E = null; }
    try { var m = W.REGROW && REGROW.model; if (m && isFinite(m.CY)) cy = m.CY; else if (typeof SCALP_CENTER_Y !== 'undefined') cy = +SCALP_CENTER_Y; } catch (e) {}
    if (!E || !(E.a > 0) || !(E.b > 0) || !(E.c > 0)) return null;
    return { a: E.a, b: E.b, c: E.c, cy: cy };
  }
  function cmPerUnit() { try { return typeof modelCmPerUnit === 'function' ? modelCmPerUnit() : 0; } catch (e) { return 0; } }

  // 머리 오브젝트·참고 메쉬를 headGroup 기준 좌표로
  function relMatrix(obj, root) {
    try {
      root.updateMatrixWorld(true);
      var inv = new THREE.Matrix4().getInverse ? new THREE.Matrix4().getInverse(root.matrixWorld) : new THREE.Matrix4().copy(root.matrixWorld).invert();
      return new THREE.Matrix4().multiplyMatrices(inv, obj.matrixWorld);
    } catch (e) { return null; }
  }
  function hairMatrix() {
    try { var hg = model3D && model3D.headGroup, h = hg && hg.getObjectByName('adjustedHair'); return h ? relMatrix(h, hg) : null; } catch (e) { return null; }
  }

  // ---- ① 가닥 OBJ 내보내기 ----------------------------------------------------------------------
  IO.exportObj = function () {
    var list = null;
    try { list = computeAdjustedHair3DStrands(); } catch (e) { console.warn(TAG + ' 가닥 계산 실패', e); }
    if (!list || !list.length) { toast(L('내보낼 머리가 없어요 — 3D 결과 화면에서 머리가 보일 때 눌러 주세요', 'No hair to export — open the 3D result first')); return false; }
    var H = headNow(), k = cmPerUnit(), M = hairMatrix(), v = new THREE.Vector3();
    var out = [], vi = 1, nS = 0, nP = 0;
    out.push('# GYEOL 가닥 내보내기 ' + new Date().toISOString() + '\n');
    out.push('# Blender: File > Import > Wavefront (.obj) 기본값 · 고친 뒤 같은 기본값으로 내보내기\n');
    out.push('# gyeol_hair 만 다시 불러옵니다 (gyeol_ref_* 는 참고용 메쉬)\n');
    if (H) out.push('# gyeol-head ' + [H.a, H.b, H.c, H.cy].map(f5).join(' ') + '\n');
    if (k) out.push('# gyeol-cm-per-unit ' + f5(k) + '\n');
    out.push('o gyeol_hair\n');
    var buf = [];
    for (var i = 0; i < list.length; i++) {
      var p = list[i] && list[i].pts; if (!p || p.length < 2) continue;
      var idx = [];
      for (var j = 0; j < p.length; j++) {
        var q = p[j]; if (!q || !isFinite(q.x) || !isFinite(q.y) || !isFinite(q.z)) continue;
        v.set(q.x, q.y, q.z); if (M) v.applyMatrix4(M);
        buf.push('v ' + f5(v.x) + ' ' + f5(v.y) + ' ' + f5(v.z) + '\n'); idx.push(vi++); nP++;
      }
      if (idx.length >= 2) { buf.push('l ' + idx.join(' ') + '\n'); nS++; }
      if (buf.length > 20000) { out.push(buf.join('')); buf = []; }
    }
    if (buf.length) out.push(buf.join(''));
    // 참고 메쉬 — 두상·얼굴·몸·옷(보이는 Mesh만, 머리·디버그 제외)
    var nM = 0;
    try {
      var hg = model3D && model3D.headGroup;
      if (hg) hg.traverse(function (o) {
        if (!o.isMesh || !o.visible || !o.geometry || o.name === 'adjustedHair' || o.name === 'strandEllipsoidDebug') return;
        var par = o.parent; while (par && par !== hg) { if (!par.visible || par.name === 'adjustedHair') return; par = par.parent; }
        var g = o.geometry; if (!g.isBufferGeometry && typeof THREE.BufferGeometry === 'function' && g.isGeometry) { try { g = new THREE.BufferGeometry().fromGeometry(g); } catch (e) { return; } }
        var pos = g.attributes && g.attributes.position; if (!pos) return;
        var RM = relMatrix(o, hg); if (!RM) return;
        var base = vi, lines = ['o gyeol_ref_' + safeName(o.name || ('mesh' + nM)) + '\n'];
        for (var a = 0; a < pos.count; a++) { v.set(pos.getX(a), pos.getY(a), pos.getZ(a)).applyMatrix4(RM); lines.push('v ' + f5(v.x) + ' ' + f5(v.y) + ' ' + f5(v.z) + '\n'); vi++; }
        var ix = g.index;
        if (ix) for (var b = 0; b + 2 < ix.count; b += 3) lines.push('f ' + (base + ix.getX(b)) + ' ' + (base + ix.getX(b + 1)) + ' ' + (base + ix.getX(b + 2)) + '\n');
        else for (var c = 0; c + 2 < pos.count; c += 3) lines.push('f ' + (base + c) + ' ' + (base + c + 1) + ' ' + (base + c + 2) + '\n');
        out.push(lines.join('')); nM++;
      });
    } catch (e) { console.warn(TAG + ' 참고 메쉬 내보내기 실패 — 가닥만 내보냄', e); }
    download('gyeol-hair-' + stamp() + '.obj', out, 'text/plain');
    console.log(TAG + ' OBJ 내보내기 — 가닥 ' + nS + ' · 점 ' + nP + ' · 참고 메쉬 ' + nM + (H ? '' : ' · 두상 기준 없음'));
    toast(L('가닥 ' + nS + '개를 OBJ로 내보냈어요', 'Exported ' + nS + ' strands as OBJ'));
    return true;
  };

  // ---- ② 스타일 JSON 내보내기 -------------------------------------------------------------------
  function pickStyle() {
    var st = null;
    try { st = state.selectedStyle; } catch (e) {}
    if (!(st && st.isCustom)) {
      try { var id = state.specAppliedId; if (id) st = STYLES.find(function (s) { return s.isCustom && (s.specId === id || s.id === id); }) || st; } catch (e) {}
    }
    return st && st.isCustom ? st : null;
  }
  IO.exportJson = function () {
    var st = pickStyle();
    if (!st) { toast(L('등록한 내 스타일을 먼저 고르거나 걸어 주세요', 'Pick or apply a style you saved first')); return false; }
    var data = { gyeol: 'style', v: 1, at: new Date().toISOString(), style: JSON.parse(JSON.stringify(st)) };
    var txt = JSON.stringify(data);
    download('gyeol-style-' + safeName(st.name) + '-' + stamp() + '.json', [txt], 'application/json');
    console.log(TAG + ' JSON 내보내기 — "' + st.name + '" ' + Math.round(txt.length / 1024) + 'KB');
    toast(L('"' + st.name + '" 스타일 파일을 내보냈어요 (' + Math.round(txt.length / 1024) + 'KB)', 'Exported "' + st.name + '" (' + Math.round(txt.length / 1024) + 'KB)'));
    return true;
  };

  // ---- ③-a JSON 불러오기 --------------------------------------------------------------------------
  var BAD = { '__proto__': 1, 'prototype': 1, 'constructor': 1 };
  function clean(v, d) {
    if (d > 14) throw new Error('too deep');
    if (v === null || typeof v === 'boolean' || typeof v === 'string') return v;
    if (typeof v === 'number') { if (!isFinite(v)) throw new Error('bad number'); return v; }
    if (Array.isArray(v)) return v.map(function (x) { return clean(x, d + 1); });
    if (typeof v === 'object') { var o = {}; Object.keys(v).forEach(function (k) { if (!BAD[k]) o[k] = clean(v[k], d + 1); }); return o; }
    return null;
  }
  IO.importJsonText = function (txt) {
    var data = null;
    try { data = clean(JSON.parse(txt), 0); } catch (e) { toast(L('스타일 파일을 읽지 못했어요', 'Could not read the style file')); return false; }
    var st = data && data.gyeol === 'style' ? data.style : (data && data.isCustom ? data : null);
    if (!st || typeof st !== 'object' || !st.name) { toast(L('GYEOL 스타일 파일이 아니에요', 'Not a GYEOL style file')); return false; }
    var oldId = st.id, id = 'custom-' + Date.now();
    st.id = id; st.isCustom = true;
    if (st.spec) st.specId = id; else delete st.specId;
    if (STYLES.some(function (s) { return s.isCustom && s.name === st.name; })) st.name = st.name + ' (' + L('불러옴', 'imported') + ')';
    STYLES.push(st);
    try { saveCustomStylesToStorage(); } catch (e) { console.warn(TAG + ' 저장 실패', e); }
    try { buildStyleGrid(); } catch (e) {}
    try { if (typeof selectStyle === 'function') selectStyle(id); } catch (e) {}
    console.log(TAG + ' JSON 불러오기 — "' + st.name + '" (원래 id ' + oldId + ' → ' + id + ')');
    toast(L('"' + st.name + '" 스타일을 불러왔어요', 'Imported "' + st.name + '"'));
    return true;
  };

  // ---- ③-b OBJ 불러오기 ---------------------------------------------------------------------------
  function parseObj(txt) {
    var V = [], segs = [], head = null, lines = txt.split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
      var s = lines[i];
      if (s.charCodeAt(0) === 118 && s.charCodeAt(1) === 32) {            // 'v '
        var t = s.split(/\s+/); V.push([+t[1], +t[2], +t[3]]);
      } else if (s.charCodeAt(0) === 108 && s.charCodeAt(1) === 32) {     // 'l '
        var u = s.trim().split(/\s+/), ids = [];
        for (var j = 1; j < u.length; j++) { var n = parseInt(u[j], 10); if (!isFinite(n)) continue; ids.push(n < 0 ? V.length + n : n - 1); }
        if (ids.length >= 2) segs.push(ids);
      } else if (s.indexOf('# gyeol-head ') === 0) {
        var h = s.slice(13).trim().split(/\s+/).map(Number);
        if (h.length >= 4 && h.every(isFinite)) head = { a: h[0], b: h[1], c: h[2], cy: h[3] };
      }
    }
    return { V: V, segs: segs, head: head };
  }
  // 두 점짜리 모서리(Blender)든 폴리라인이든 → 가닥(점 번호 배열)
  function chains(segs) {
    var long = [], adj = new Map(), used = new Set();
    function add(a, b) { if (a === b) return; (adj.get(a) || adj.set(a, []).get(a)).push(b); (adj.get(b) || adj.set(b, []).get(b)).push(a); }
    segs.forEach(function (s) { if (s.length > 2) long.push(s); else add(s[0], s[1]); });
    function key(a, b) { return a < b ? a + ':' + b : b + ':' + a; }
    function walk(start) {
      var c = [start], cur = start, prev = -1;
      for (;;) {
        var nb = adj.get(cur) || [], nx = -1;
        for (var i = 0; i < nb.length; i++) { if (nb[i] !== prev && !used.has(key(cur, nb[i]))) { nx = nb[i]; break; } }
        if (nx < 0) break;
        used.add(key(cur, nx)); c.push(nx); prev = cur; cur = nx;
        if ((adj.get(cur) || []).length > 2) break;                      // 갈림길에서 끊음
      }
      return c;
    }
    adj.forEach(function (nb, v) { if (nb.length !== 2) { var g = 0; while (g++ < nb.length) { var c = walk(v); if (c.length >= 2) long.push(c); else break; } } });
    adj.forEach(function (nb, v) { if (nb.some(function (w) { return !used.has(key(v, w)); })) { var c = walk(v); if (c.length >= 2) long.push(c); } });   // 고리
    return long;
  }
  function rimDist(H, p) {   // 두피 타원면까지(정규화 반지름 − 1)
    var x = p[0] / H.a, y = (p[1] - H.cy) / H.b, z = p[2] / H.c;
    return Math.abs(Math.sqrt(x * x + y * y + z * z) - 1);
  }
  IO.importObjText = function (txt) {
    var R = W.REGROW, G = R && R.model;
    if (!R || !G || !G.strands || !G.strands.length) {
      toast(L('먼저 손님 사진을 열고 조정 화면에서 원본 머리(마네킹 OFF)를 한 번 띄워 주세요', 'Open the client photos and show the original hair (mannequin OFF) first'));
      return false;
    }
    var P = parseObj(txt), Hn = headNow();
    if (!P.segs.length) { toast(L('OBJ에 선(가닥)이 없어요 — Blender에서 Curves를 Mesh로 바꾼 뒤 내보내 주세요', 'No lines in the OBJ — convert hair Curves to Mesh in Blender before export')); return false; }
    var Hf = P.head || Hn;
    var map = (P.head && Hn) ? function (p) { return [p[0] / Hf.a * Hn.a, (p[1] - Hf.cy) / Hf.b * Hn.b + Hn.cy, p[2] / Hf.c * Hn.c]; } : function (p) { return p; };
    var Minv = null; try { var M = hairMatrix(); if (M) Minv = M.getInverse ? new THREE.Matrix4().getInverse(M) : M.clone().invert(); } catch (e) { Minv = null; }
    var v3 = Minv ? new THREE.Vector3() : null;
    // 원래 가닥 — 뿌리 격자(속성 물려받기)
    var cell = 0.04, grid = new Map(), src = G.strands;
    function gk(x, y, z) { return Math.floor(x / cell) + ',' + Math.floor(y / cell) + ',' + Math.floor(z / cell); }
    src.forEach(function (s, i) { var r = s && s.pts && s.pts[0]; if (!r) return; var k = gk(r.x, r.y, r.z); (grid.get(k) || grid.set(k, []).get(k)).push(i); });
    function nearest(x, y, z) {
      var best = -1, bd = Infinity, cx = Math.floor(x / cell), cy = Math.floor(y / cell), cz = Math.floor(z / cell);
      for (var rr = 1; rr <= 4 && best < 0; rr++)
        for (var a = -rr; a <= rr; a++) for (var b = -rr; b <= rr; b++) for (var c = -rr; c <= rr; c++) {
          var L2 = grid.get((cx + a) + ',' + (cy + b) + ',' + (cz + c)); if (!L2) continue;
          for (var t = 0; t < L2.length; t++) { var r0 = src[L2[t]].pts[0], d = (r0.x - x) * (r0.x - x) + (r0.y - y) * (r0.y - y) + (r0.z - z) * (r0.z - z); if (d < bd) { bd = d; best = L2[t]; } }
        }
      if (best < 0) { for (var u = 0; u < src.length; u++) { var r1 = src[u] && src[u].pts && src[u].pts[0]; if (!r1) continue; var d1 = (r1.x - x) * (r1.x - x) + (r1.y - y) * (r1.y - y) + (r1.z - z) * (r1.z - z); if (d1 < bd) { bd = d1; best = u; } } }
      return best;
    }
    var out = [], flipped = 0, ch = chains(P.segs);
    ch.forEach(function (c) {
      if (c.length < IO.minPts) return;
      var pts = [];
      for (var i = 0; i < c.length; i++) { var q = P.V[c[i]]; if (!q || !isFinite(q[0]) || !isFinite(q[1]) || !isFinite(q[2])) continue; pts.push(q); }
      if (pts.length < IO.minPts) return;
      if (Hf && rimDist(Hf, pts[pts.length - 1]) < rimDist(Hf, pts[0])) { pts.reverse(); flipped++; }
      var o = pts.map(function (p) {
        var m = map(p);
        if (v3) { v3.set(m[0], m[1], m[2]).applyMatrix4(Minv); return { x: v3.x, y: v3.y, z: v3.z }; }
        return { x: m[0], y: m[1], z: m[2] };
      });
      var ti = nearest(o[0].x, o[0].y, o[0].z), tpl = ti >= 0 ? src[ti] : null, s = {};
      if (tpl) Object.keys(tpl).forEach(function (k) { if (k !== 'pts' && k.charAt(0) !== '_') s[k] = tpl[k]; });
      s.pts = o; s.regrown = true; s.imported = true;
      out.push(s);
    });
    if (!out.length) { toast(L('불러올 가닥이 없어요', 'No strands to import')); return false; }
    var nm = Object.assign(Object.create(Object.getPrototypeOf(G)), G);
    nm.strands = out; nm.imported = { at: new Date().toISOString(), n: out.length, from: G.strands.length };
    R.model = nm;
    R.base = null;
    try { if (typeof MANNEQUIN !== 'undefined' && MANNEQUIN.on && typeof toggleMannequin === 'function') toggleMannequin(); } catch (e) {}
    try { if (typeof ADJ_CACHE !== 'undefined' && ADJ_CACHE.bump) ADJ_CACHE.bump(); } catch (e) {}
    try { if (typeof R.refresh === 'function') R.refresh(); } catch (e) { console.warn(TAG + ' 다시 그리기 실패', e); }
    console.log(TAG + ' OBJ 불러오기 — 가닥 ' + out.length + '개로 바꿔 끼움(원래 ' + G.strands.length + ' · 뒤집은 가닥 ' + flipped + ' · 두상 ' + (P.head ? (Hn ? '비율로 옮김' : '파일 값') : '머리글 없음 — 그대로') + ')');
    toast(L('가닥 ' + out.length + '개를 불러왔어요 — 확인 후 「스타일로 등록」 하세요', 'Imported ' + out.length + ' strands — check, then save as style'));
    return true;
  };

  IO.importFile = function (file) {
    if (!file) return;
    var nm = (file.name || '').toLowerCase(), isObj = /\.obj$/.test(nm), isJson = /\.json$/.test(nm);
    if (!isObj && !isJson) { toast(L('.obj 또는 .json 파일만 불러올 수 있어요', 'Only .obj or .json files')); return; }
    if (file.size > (isObj ? IO.maxObjBytes : IO.maxJsonBytes)) { toast(L('파일이 너무 커요', 'File is too large')); return; }
    var fr = new FileReader();
    fr.onload = function () {
      try {
        if (isObj) { if (typeof showAI === 'function') showAI(L('가닥 불러오는 중…', 'Importing strands…'), ''); setTimeout(function () { try { IO.importObjText(String(fr.result)); } finally { try { hideAI(); } catch (e) {} } }, 30); }
        else IO.importJsonText(String(fr.result));
      } catch (e) { console.warn(TAG + ' 불러오기 실패', e); toast(L('불러오기에 실패했어요', 'Import failed')); }
    };
    fr.onerror = function () { toast(L('파일을 읽지 못했어요', 'Could not read the file')); };
    fr.readAsText(file);
  };

  // ---- 버튼 ---------------------------------------------------------------------------------------
  function mkBtn(id, ko, en, fn, cls) {
    var b = document.createElement('button'); b.id = id; b.type = 'button'; b.className = cls || '';
    b.textContent = L(ko, en); b.addEventListener('click', fn); return b;
  }
  function install3D() {
    var vp = document.getElementById('model3dViewport'); if (!vp || document.getElementById('styleIoBar3D')) return;
    var bar = document.createElement('div'); bar.id = 'styleIoBar3D';
    bar.style.cssText = 'position:absolute;top:10px;right:10px;z-index:20;display:flex;flex-direction:column;gap:6px;align-items:flex-end;';
    var css = 'font-size:12px;padding:6px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:rgba(40,34,30,0.85);color:#f3e9da;cursor:pointer;';
    var b1 = mkBtn('styleIoObjBtn', '가닥 OBJ 내보내기', 'Export strands (OBJ)', function () { IO.exportObj(); });
    var b2 = mkBtn('styleIoJsonBtn', '스타일 JSON 내보내기', 'Export style (JSON)', function () { IO.exportJson(); });
    b1.style.cssText = css; b2.style.cssText = css;
    bar.appendChild(b1); bar.appendChild(b2); vp.appendChild(bar);
    var dbg = document.getElementById('strandDebugToggle'); if (dbg) bar.style.top = '44px';   // 원본(개발용)의 기준면 보기 버튼 아래로
  }
  function installStyle() {
    if (document.getElementById('styleIoImportBtn')) return;
    var inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.obj,.json,application/json'; inp.style.display = 'none'; inp.id = 'styleIoFile';
    inp.addEventListener('change', function () { var f = inp.files && inp.files[0]; inp.value = ''; IO.importFile(f); });
    document.body.appendChild(inp);
    var ref = document.getElementById('salonUploadBtn');
    var b = mkBtn('styleIoImportBtn', '불러오기', 'Import', function () { inp.click(); }, ref ? ref.className : 'btn btn-ghost');
    b.title = L('.json = 스타일 파일 · .obj = 고친 가닥(손님 사진을 연 상태에서)', '.json = style file · .obj = edited strands (with client photos open)');
    if (ref && ref.parentNode) { ref.parentNode.insertBefore(b, ref.nextSibling); b.disabled = false; }
    else { var sc = document.getElementById('screen-style'); if (sc) { b.style.cssText = 'margin:6px 14px;'; sc.appendChild(b); } }
  }
  function install() { try { install3D(); } catch (e) { console.warn(TAG, e); } try { installStyle(); } catch (e) { console.warn(TAG, e); } }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
  setTimeout(install, 1500);   // 미용실 버튼이 늦게 붙는 경우
  try { if (typeof I18N === 'object' && I18N) { I18N['가닥 OBJ 내보내기'] = 'Export strands (OBJ)'; I18N['스타일 JSON 내보내기'] = 'Export style (JSON)'; I18N['불러오기'] = 'Import'; } } catch (e) {}
  console.log(TAG + ' 설치 — 3D 화면: 가닥 OBJ · 스타일 JSON 내보내기 / 스타일 화면: 불러오기(.obj·.json) · 끄기 STYLE_IO.on=false');
  return IO;
})();
