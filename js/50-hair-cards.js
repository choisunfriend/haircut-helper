// ============================================================================
// 50-hair-cards.js (2026-11-24 v4) — 할 일 3: 사진 픽셀 띠를 3D 가닥 리본(헤어 카드)에 입힘
// ============================================================================
// ⚠ 출원 후보(「GYEOL 헤어 3D 다음 할 일」 6장) — 출원 전에는 공개 레포에 커밋하지 말 것.
//
// v1(되돌림)에서 생긴 문제와 v2의 대응
//   · "이상하다" — 띠의 밝기를 띠 평균으로 나눠 0.45~1.7배로 곱했다. 띠마다 사진 조명·두피 비침이
//     달라서 리본마다 얼룩이 생겼다.
//       → 띠를 <b>고역 통과</b>(픽셀 밝기 ÷ 길이 방향 이동평균)한 "결 무늬"만 쓴다. 넓은 밝기 변화는
//         버리고 올 사이 명암만 남긴다. 범위도 0.78~1.12로 좁히고, 밝은 쪽은 거의 안 올린다.
//   · "머리 경계가 벗겨진다" — 헤어라인·가르마 근처 띠에는 머리카락 사이로 비친 <b>두피 픽셀</b>이 섞여
//     있는데, 그게 1.7배 밝아져 살색 반점이 됐다. 또 알파 discard로 리본에 구멍이 났다.
//       → 띠마다 밝기 상위(p85·중앙값×1.2 초과)를 잘라내고, 불투명 비율이 낮은 행은 버린 뒤 가까운
//         행으로 메운다(텍스처 전체 불투명). 리본은 <b>discard 없음</b> — 끝 가늘어짐은 모양으로만.
//         뿌리 쪽 12%와 끝 10%는 무늬를 0으로 줄여 경계에서는 원래 선 색 그대로.
//   · 선과 리본이 같은 깊이 → z-fighting 반짝임
//       → 리본에 polygonOffset(앞으로 당김). 선은 밑에 그대로 둬서 리본 사이 틈을 메운다.
//   · 리본이 화면에서 1px보다 가늘어지면 선보다 덜 덮는다 → 화면 최소 폭(uMinPx) 보장.
//
// 방법(할 일 3의 1~5)
//   ① 선 → 리본: adjustedHair 선분을 끝점 공유로 가닥으로 잇고, 가닥마다 카메라를 향하는 띠(시점 공간에서
//      결 × 시선 방향으로 펼침). t = 뿌리→끝.
//   ② 아틀라스: 사진 4장의 buildHairStripPool 띠(가장 밝은 단계 = 곧게 편 원본)를 위처럼 정리해
//      R 채널에 "결 무늬"(0.5+무늬)로 굽는다. 한 장 텍스처.
//   ③ 띠 배정: 가닥 뿌리를 가장 정면으로 본 사진(viewOfRoot)의 띠에서 고정 해시로. 길이 축척은 사진 px 그대로
//      (정면 헤어 폭 px ÷ 3D 헤어 폭). 길면 반복.
//   ④ 색·음영: 색은 정점 색(사진 되쏘기·염색·24/46 음영이 든 값) × 결 무늬. 46(HAIR_SHADE_PRO)의 빛 띠가
//      켜져 있으면 같은 식(같은 설정값)으로 리본에서도 계산 — 리본이 선을 덮어도 빛 띠가 사라지지 않음.
//   ⑤ 범위: 3D 결과 화면만. 2D 조정 화면·기존 파일은 안 고침(감시 타이머로 붙임).
//
// 끄기: HAIR_CARDS.toggle(false) · ?cards=0     상태: HAIR_CARDS.lines()
// 조정 후 HAIR_CARDS.refresh(): widthCm · maxCards · detail · dMin/dMax · minPx
// 확인: document.body.appendChild(HAIR_CARDS.atlasCanvas())  (회색 = 무늬 없음)
// ============================================================================
var HAIR_CARDS = (function () {
  'use strict';
  var W = window, TAG = '[헤어 카드]';
  var HC = Object.assign({
    on: !/[?&]cards=0\b/.test(String(location.search || '')),
    widthCm: 0.35,       // 리본 폭(cm)
    tipThin: 0.8,        // 끝에서 폭을 이만큼 줄임
    rootThin: 0.4,       // 뿌리에서 폭을 이만큼 줄였다가 첫 8%에서 회복(헤어라인 또렷하게)
    minPx: 1.2,          // 화면 최소 폭(px) — 선(1px)보다 덜 덮지 않게
    maxCards: 3000,      // 리본 수 상한 — 넘으면 고르게 솎음(선이 밑에 있어 틈은 안 생김)
    detail: 0.9,         // 결 무늬 세기(0 = 정점 색 그대로)
    dMin: 0.78, dMax: 1.12,
    rootFade: 0.12, tipFade: 0.10,
    edgeDark: 0.15,      // 리본 폭 방향 가장자리 살짝 어둡게(원통 느낌)
    bandMul: 0,          // (v4) 리본 위 인공 빛 띠 세기(46 값 × 이것). 기본 0 = 사진 픽셀 명암만. v2(=1)에서 곱슬 가닥이 군데군데 하얗게 뜸
    bandTint: 0.55,      // (v3) 1차 띠를 머리색 쪽으로 섞는 비율(0 = 순백)
    stripPx: 8, CELL_W: 16, CELL_H: 256,
    hiPass: 14,          // 고역 통과 이동평균 반경(행)
    minRowCover: 0.7,    // 이 비율보다 불투명 픽셀이 적은 행은 버림
    minValidFrac: 0.35,  // 쓸 수 있는 행이 이보다 적은 띠는 버림
    pollMs: 500
  }, W.HAIR_CARDS || {});
  var ST = { built: 0, at: null, cards: 0, pts: 0, strips: 0, dropped: 0, views: '', ms: 0, err: null, skip: null, ppu: 0 };
  var ANG = ['front', 'left', 'right', 'back'];
  var _lk = '';
  function log1(k, msg) { if (_lk === k) return; _lk = k; console.warn(TAG + ' ' + msg); }
  function cmPerUnit() { try { return typeof modelCmPerUnit === 'function' ? (modelCmPerUnit() || 0) : 0; } catch (e) { return 0; } }
  function dirty() { try { if (W.GPU_DIET && W.GPU_DIET.markDirty) W.GPU_DIET.markDirty(); } catch (e) {} }
  function hairObj() { try { return (typeof model3D !== 'undefined' && model3D && model3D.headGroup) ? model3D.headGroup.getObjectByName('adjustedHair') : null; } catch (e) { return null; } }

  // ---- ② 아틀라스 ---------------------------------------------------------------------------------
  var atlas = null;
  function atlasKey() {
    return ANG.map(function (a) {
      var c = state.hairCanvases && state.hairCanvases[a];
      return a + ':' + (c ? (c.width + 'x' + c.height + ':' + (c._hcId || (c._hcId = Math.random().toString(36).slice(2, 8)))) : '-');
    }).join('|');
  }
  // 한 칸(띠 1장)을 결 무늬로 정리. 반환: {v0,v1} 쓸 행 범위(0~1) · 못 쓰면 null
  function cleanCell(g, x, y, CW, CH) {
    var img = g.getImageData(x, y, CW, CH), d = img.data;
    var L = new Float32Array(CW * CH), ok = new Uint8Array(CW * CH), rowOk = new Uint8Array(CH), all = [];
    for (var r = 0; r < CH; r++) {
      var cov = 0;
      for (var c = 0; c < CW; c++) {
        var i = r * CW + c, k = i * 4;
        if (d[k + 3] > 200) { L[i] = (0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2]) / 255; ok[i] = 1; cov++; all.push(L[i]); }
      }
      rowOk[r] = cov >= CW * HC.minRowCover ? 1 : 0;
    }
    if (all.length < CW * CH * HC.minValidFrac) return null;
    all.sort(function (a, b) { return a - b; });
    var med = all[all.length >> 1], lo = all[Math.floor(all.length * 0.08)], hi = Math.min(all[Math.floor(all.length * 0.85)], med * 1.2 + 0.01);
    // 가장 긴 연속 유효 행 구간
    var bs = -1, bl = 0, s = -1;
    for (r = 0; r <= CH; r++) {
      if (r < CH && rowOk[r]) { if (s < 0) s = r; }
      else if (s >= 0) { if (r - s > bl) { bl = r - s; bs = s; } s = -1; }
    }
    if (bl < CH * HC.minValidFrac) return null;
    // 행 평균(클램프 후) → 길이 방향 이동평균 → 무늬 = 픽셀 / 이동평균
    var rowM = new Float32Array(CH);
    for (r = bs; r < bs + bl; r++) {
      var sm = 0, n = 0;
      for (c = 0; c < CW; c++) { i = r * CW + c; if (ok[i]) { sm += Math.min(hi, Math.max(lo, L[i])); n++; } }
      rowM[r] = n ? sm / n : med;
    }
    var R = HC.hiPass, base = new Float32Array(CH);
    for (r = bs; r < bs + bl; r++) {
      var a0 = Math.max(bs, r - R), a1 = Math.min(bs + bl - 1, r + R), t = 0;
      for (var q = a0; q <= a1; q++) t += rowM[q];
      base[r] = Math.max(0.02, t / (a1 - a0 + 1));
    }
    for (r = 0; r < CH; r++) {
      var rr = Math.min(bs + bl - 1, Math.max(bs, r));   // 범위 밖 행은 가까운 행으로 메움
      for (c = 0; c < CW; c++) {
        var si = rr * CW + c, di = (r * CW + c) * 4;
        var v = ok[si] ? Math.min(hi, Math.max(lo, L[si])) / base[rr] : 1;   // 구멍 = 무늬 없음
        var e = Math.round(Math.min(255, Math.max(0, (v - 0.5) * 255)));    // 0.5~1.5 → 0~255
        d[di] = d[di + 1] = d[di + 2] = e; d[di + 3] = 255;
      }
    }
    g.putImageData(img, x, y);
    return { v0: bs / CH, v1: (bs + bl) / CH };
  }
  function buildAtlas() {
    if (typeof buildHairStripPool !== 'function') { ST.skip = '15 buildHairStripPool 없음'; return null; }
    var key = atlasKey();
    if (atlas && atlas.key === key) return atlas;
    var strips = [];
    ANG.forEach(function (a) {
      var mi = state.hairMasks && state.hairMasks[a];
      if (!mi) return;
      var pool = null;
      try { pool = buildHairStripPool(a, mi, HC.stripPx); } catch (e) { console.warn(TAG + ' ' + a + ' 띠 뜨기 실패', e); }
      if (pool && pool.length) pool.forEach(function (p) { strips.push({ p: p, view: a }); });
    });
    if (!strips.length) { ST.skip = '사진에서 띠를 못 뜸(15 경고 참조)'; return null; }
    var CW = HC.CELL_W, CH = HC.CELL_H, n = strips.length;
    var cols = Math.min(n, Math.floor(2048 / CW)), rows = Math.ceil(n / cols);
    var AW = 1; while (AW < cols * CW) AW *= 2;
    var AH = 1; while (AH < rows * CH) AH *= 2;
    var cv = document.createElement('canvas'); cv.width = AW; cv.height = AH;
    var g = cv.getContext('2d', { willReadFrequently: true });
    g.fillStyle = 'rgb(128,128,128)'; g.fillRect(0, 0, AW, AH);
    var cells = [], byView = {}, slot = 0, dropped = 0;
    strips.forEach(function (s) {
      var x = (slot % cols) * CW, y = Math.floor(slot / cols) * CH;
      var src = s.p.shades[s.p.shades.length - 1];
      g.clearRect(x, y, CW, CH);
      try { g.drawImage(src, 0, 0, s.p.SW, s.p.SH, x, y, CW, CH); } catch (e) { dropped++; return; }
      var vr = cleanCell(g, x, y, CW, CH);
      if (!vr) { g.fillStyle = 'rgb(128,128,128)'; g.fillRect(x, y, CW, CH); dropped++; return; }
      slot++;
      (byView[s.view] = byView[s.view] || []).push(cells.length);
      cells.push({ x0: x / AW, y0: (y + vr.v0 * CH) / AH, w: CW / AW, h: (vr.v1 - vr.v0) * CH / AH, view: s.view, lenPx: Math.max(4, s.p.SH * (vr.v1 - vr.v0)) });
    });
    if (!cells.length) { ST.skip = '쓸 만한 띠가 없음(전부 두피 비침·구멍)'; return null; }
    var tex = new THREE.CanvasTexture(cv);
    tex.minFilter = THREE.LinearMipMapLinearFilter; tex.magFilter = THREE.LinearFilter;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping; tex.flipY = false;
    if (atlas && atlas.tex) try { atlas.tex.dispose(); } catch (e) {}
    atlas = { tex: tex, cells: cells, byView: byView, key: key, canvas: cv };
    ST.strips = cells.length; ST.dropped = dropped;
    ST.views = Object.keys(byView).map(function (v) { return v + ' ' + byView[v].length; }).join(' · ');
    return atlas;
  }

  // ---- ① 선 → 가닥 --------------------------------------------------------------------------------
  function strandsFromLines(obj) {
    var g = obj.geometry, P = g.attributes.position, C = g.attributes.color, O = g.attributes.hairOcc;
    if (!P) return [];
    var pa = P.array, ca = C ? C.array : null, oa = O ? O.array : null, nSeg = P.count >> 1, out = [], cur = null;
    function push(s, vi) {
      s.p.push(pa[vi * 3], pa[vi * 3 + 1], pa[vi * 3 + 2]);
      if (ca) s.c.push(ca[vi * 3], ca[vi * 3 + 1], ca[vi * 3 + 2]); else s.c.push(0.2, 0.15, 0.1);
      s.o.push(oa ? oa[vi] : 1);
    }
    for (var i = 0; i < nSeg; i++) {
      var a = i * 2, b = a + 1;
      var cont = cur && pa[a * 3] === cur.lx && pa[a * 3 + 1] === cur.ly && pa[a * 3 + 2] === cur.lz;
      if (!cont) { cur = { p: [], c: [], o: [] }; out.push(cur); push(cur, a); }
      push(cur, b);
      cur.lx = pa[b * 3]; cur.ly = pa[b * 3 + 1]; cur.lz = pa[b * 3 + 2];
    }
    return out.filter(function (s) { return s.p.length >= 9; });
  }
  function pxPerUnit(S) {
    var minX = Infinity, maxX = -Infinity;
    S.forEach(function (s) { for (var i = 0; i < s.p.length; i += 3) { var x = s.p[i]; if (x < minX) minX = x; if (x > maxX) maxX = x; } });
    var span = maxX - minX; if (!(span > 0)) return 0;
    var mi = state.hairMasks && (state.hairMasks.front || state.hairMasks.back);
    if (!mi || !mi.scalpY) return 0;
    var n = 0; for (var x = 0; x < mi.scalpY.length; x++) if (mi.scalpY[x] >= 0) n++;
    return n > 0 ? n / span : 0;
  }
  function hash(i) { var x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); }
  function viewOf(x, y, z) {
    try { if (typeof viewOfRoot === 'function') return viewOfRoot({ x: x, y: y, z: z }); } catch (e) {}
    return Math.abs(x) > Math.abs(z) ? (x > 0 ? 'left' : 'right') : (z > 0 ? 'front' : 'back');
  }
  function pickCell(A, view, i) {
    var L = A.byView[view] || A.byView.front || A.byView.back || A.byView[Object.keys(A.byView)[0]];
    return A.cells[L[Math.floor(hash(i) * L.length) % L.length]];
  }

  // ---- 셰이더 -------------------------------------------------------------------------------------
  var VS = [
    'attribute vec3 tangent; attribute float side; attribute vec2 st; attribute vec4 rect; attribute float along; attribute vec3 color; attribute float occ;',
    'uniform float uWidth; uniform float uTipThin; uniform float uRootThin; uniform float uMinPx; uniform float uViewH;',
    'varying vec2 vSt; varying vec4 vRect; varying vec3 vColor; varying float vAlong; varying float vOcc; varying vec3 vT; varying vec3 vV;',
    'void main(){',
    '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
    '  vec3 T = normalize(mat3(modelViewMatrix) * tangent);',
    '  vec3 V = normalize(-mv.xyz);',
    '  vec3 S = cross(T, V); float sl = length(S); S = sl > 1e-5 ? S / sl : vec3(1.0, 0.0, 0.0);',
    '  float sc = length(modelMatrix[0].xyz);',
    '  float shape = (1.0 - uTipThin * along) * (1.0 - uRootThin * (1.0 - smoothstep(0.0, 0.08, along)));',
    '  float w = uWidth * sc * shape;',
    '  float perPx = 2.0 * max(1e-4, -mv.z) / (projectionMatrix[1][1] * uViewH);',
    '  w = max(w, uMinPx * perPx * mix(1.0, 0.7, along));',
    '  mv.xyz += S * side * 0.5 * w;',
    '  vSt = st; vRect = rect; vColor = color; vAlong = along; vOcc = occ; vT = T; vV = -mv.xyz;',
    '  gl_Position = projectionMatrix * mv;',
    '}'].join('\n');
  var FS = [
    'uniform sampler2D uAtlas; uniform float uDetail; uniform float uDMin; uniform float uDMax; uniform float uRootFade; uniform float uTipFade; uniform float uEdge;',
    'uniform float uBands; uniform float uBandMul; uniform float uBandTint; uniform vec3 uHL; uniform vec3 uHB1; uniform vec3 uHB2; uniform float uHKd;',
    'varying vec2 vSt; varying vec4 vRect; varying vec3 vColor; varying float vAlong; varying float vOcc; varying vec3 vT; varying vec3 vV;',
    'float hairBand(float d, vec3 b){ float x = clamp(d + b.x, -1.0, 1.0); return pow(sqrt(max(0.0, 1.0 - x*x)), b.y) * b.z; }',
    'void main(){',
    '  vec2 uv = vRect.xy + vec2(clamp(vSt.x, 0.03, 0.97), fract(vSt.y)) * vRect.zw;',
    '  float m = 0.5 + texture2D(uAtlas, uv).r;',
    '  float fade = smoothstep(0.0, uRootFade, vAlong) * (1.0 - smoothstep(1.0 - uTipFade, 1.0, vAlong));',
    '  float d = mix(1.0, clamp(m, uDMin, uDMax), uDetail * fade);',
    '  float ex = abs(vSt.x * 2.0 - 1.0);',
    '  vec3 col = vColor * d * (1.0 - uEdge * ex * ex);',
    '  if (uBands > 0.5) {',
    '    vec3 hT = normalize(vT); vec3 hV = normalize(vV); vec3 hH = normalize(uHL + hV);',
    '    float hD = dot(hT, hH); float hDl = dot(hT, uHL);',
    '    vec3 w1 = mix(vec3(1.0), clamp(vColor * 2.2, 0.0, 1.0), uBandTint);',
    '    col = col * mix(1.0, sqrt(max(0.0, 1.0 - hDl*hDl)), uHKd) + uBandMul * (1.0 - ex * ex) * vOcc * vOcc * d * (w1 * hairBand(hD, uHB1) + hairBand(hD, uHB2) * vColor * 1.6);',
    '  }',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'].join('\n');

  function bandUniforms() {
    var P = W.HAIR_SHADE_PRO, B = P && P.on && P.bands && P.bands.on ? P.bands : null;
    var L = B ? B.light : [0, 1, 0], ll = Math.hypot(L[0], L[1], L[2]) || 1;
    return {
      uBands: { value: B ? 1 : 0 }, uBandMul: { value: HC.bandMul }, uBandTint: { value: HC.bandTint },
      uHL: { value: new THREE.Vector3(L[0] / ll, L[1] / ll, L[2] / ll) },
      uHB1: { value: new THREE.Vector3(B ? B.shift1 : 0, B ? B.pow1 : 1, B ? B.k1 : 0) },
      uHB2: { value: new THREE.Vector3(B ? B.shift2 : 0, B ? B.pow2 : 1, B ? B.k2 : 0) },
      uHKd: { value: B ? B.kd : 0 }
    };
  }

  // ---- 리본 만들기 --------------------------------------------------------------------------------
  function build(obj) {
    var t0 = performance.now();
    ST.skip = null; ST.err = null;
    if (!obj.isLineSegments) { ST.skip = '선 머리가 아님(땋기 등)'; return null; }
    var A = buildAtlas(); if (!A) { log1('skip:' + ST.skip, '못 만듦 — ' + ST.skip + ' · 선만 보입니다'); return null; }
    var cmu = cmPerUnit(); if (!(cmu > 0)) { ST.skip = '3D 자(cm/단위) 없음'; log1('skip:cm', '못 만듦 — ' + ST.skip); return null; }
    var S = strandsFromLines(obj);
    if (!S.length) { ST.skip = '3D 머리 선이 비어 있음'; return null; }
    var ppu = pxPerUnit(S); ST.ppu = ppu;
    var stride = Math.max(1, S.length / HC.maxCards);
    var pos = [], tan = [], side = [], stA = [], rect = [], alongA = [], col = [], occ = [], idx = [], v = 0, nC = 0, acc = 0;
    for (var si = 0; si < S.length; si++) {
      acc += 1; if (acc < stride) continue; acc -= stride;
      var s = S[si], p = s.p, c = s.c, o = s.o, n = p.length / 3;
      var cell = pickCell(A, viewOf(p[0], p[1], p[2]), si);
      var arc = [0], tot = 0;
      for (var i = 1; i < n; i++) { tot += Math.hypot(p[i * 3] - p[i * 3 - 3], p[i * 3 + 1] - p[i * 3 - 2], p[i * 3 + 2] - p[i * 3 - 1]); arc.push(tot); }
      if (!(tot > 0)) continue;
      var tScale = ppu > 0 ? ppu / cell.lenPx : 1 / tot;
      var tOff = hash(si + 7);
      for (var j = 0; j < n; j++) {
        var j0 = Math.max(0, j - 1), j1 = Math.min(n - 1, j + 1);
        var tx = p[j1 * 3] - p[j0 * 3], ty = p[j1 * 3 + 1] - p[j0 * 3 + 1], tz = p[j1 * 3 + 2] - p[j0 * 3 + 2];
        var al = arc[j] / tot, tv = tOff + arc[j] * tScale;
        for (var k = 0; k < 2; k++) {
          pos.push(p[j * 3], p[j * 3 + 1], p[j * 3 + 2]);
          tan.push(tx, ty, tz); side.push(k ? 1 : -1); stA.push(k, tv);
          rect.push(cell.x0, cell.y0, cell.w, cell.h); alongA.push(al);
          col.push(c[j * 3], c[j * 3 + 1], c[j * 3 + 2]); occ.push(o[j]);
        }
        if (j > 0) { var b = v + (j - 1) * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
      }
      v += n * 2; nC++;
    }
    if (!nC) { ST.skip = '리본으로 만들 가닥이 없음'; return null; }
    var g = new THREE.BufferGeometry();
    var set = function (nm, arr, k) { var at = new THREE.Float32BufferAttribute(arr, k); if (g.setAttribute) g.setAttribute(nm, at); else g.addAttribute(nm, at); };
    set('position', pos, 3); set('tangent', tan, 3); set('side', side, 1); set('st', stA, 2);
    set('rect', rect, 4); set('along', alongA, 1); set('color', col, 3); set('occ', occ, 1);
    g.setIndex(v > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
    g.computeBoundingSphere();
    var u = Object.assign({
      uAtlas: { value: A.tex }, uWidth: { value: HC.widthCm / cmu }, uTipThin: { value: HC.tipThin }, uRootThin: { value: HC.rootThin },
      uMinPx: { value: HC.minPx }, uViewH: { value: 800 },
      uDetail: { value: HC.detail }, uDMin: { value: HC.dMin }, uDMax: { value: HC.dMax },
      uRootFade: { value: HC.rootFade }, uTipFade: { value: HC.tipFade }, uEdge: { value: HC.edgeDark }
    }, bandUniforms());
    var m = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, side: THREE.DoubleSide, uniforms: u,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
    var mesh = new THREE.Mesh(g, m);
    mesh.name = 'hairCards'; mesh.frustumCulled = false;
    var tmpV = THREE.Vector2 ? new THREE.Vector2() : null;
    mesh.onBeforeRender = function (renderer) {
      try { var sz = renderer.getDrawingBufferSize ? renderer.getDrawingBufferSize(tmpV) : null; u.uViewH.value = (sz && sz.y) || renderer.domElement.height || 800; } catch (e) {}
    };
    mesh.position.copy(obj.position); mesh.quaternion.copy(obj.quaternion); mesh.scale.copy(obj.scale);
    ST.built++; ST.at = new Date().toTimeString().slice(0, 8); ST.cards = nC; ST.pts = v / 2; ST.ms = Math.round(performance.now() - t0);
    if (ST.built === 1 || ST.built % 10 === 0) console.log(TAG + ' 리본 ' + nC + '/' + S.length + '가닥(점 ' + (v / 2) + ') · 사진 띠 ' + ST.strips + '장(' + ST.views + ', 버림 ' + ST.dropped + ') · 폭 ' + HC.widthCm + 'cm · 축척 ' + ppu.toFixed(0) + 'px/단위 · 빛 띠 ' + (u.uBands.value ? '켬' : '끔') + ' · ' + ST.ms + 'ms');
    return mesh;
  }

  // ---- 붙이기·감시 --------------------------------------------------------------------------------
  var lastSig = '', mine = null;
  function sigOf(o) { try { var g = o.geometry; return o.uuid + ':' + g.uuid + ':' + (g.attributes.position ? g.attributes.position.version : 0) + ':' + (g.attributes.color ? g.attributes.color.version : 0); } catch (e) { return ''; } }
  function remove() {
    if (!mine) return;
    try { if (mine.parent) mine.parent.remove(mine); mine.geometry.dispose(); mine.material.dispose(); } catch (e) {}
    mine = null;
  }
  function apply() {
    var o = hairObj();
    if (!HC.on || !o) { if (mine) { remove(); dirty(); } lastSig = ''; return; }
    var sg = sigOf(o) + '|' + [HC.widthCm, HC.maxCards, HC.detail, HC.dMin, HC.dMax, HC.minPx, HC.bandMul, HC.bandTint].join(',');
    if (sg === lastSig && mine && mine.parent) {
      mine.visible = o.visible;
      mine.position.copy(o.position); mine.quaternion.copy(o.quaternion); mine.scale.copy(o.scale);
      return;
    }
    lastSig = sg;
    remove();
    try { mine = build(o); } catch (e) { ST.err = String(e && e.message || e); console.warn(TAG + ' 만들기 실패 — 선만 보입니다', e); mine = null; }
    if (mine) { (o.parent || model3D.headGroup).add(mine); mine.visible = o.visible; }
    dirty();
  }
  function tick() { try { if (typeof currentScreen !== 'undefined' && currentScreen !== 'model3d') return; apply(); } catch (e) {} }
  setInterval(tick, HC.pollMs);
  HC.refresh = function () { lastSig = ''; atlas = null; _lk = ''; apply(); };
  HC.toggle = function (v) { HC.on = typeof v === 'boolean' ? v : !HC.on; HC.refresh(); return HC.on; };
  HC.atlasCanvas = function () { return atlas && atlas.canvas; };
  HC.lines = function () {
    return [TAG + ' ' + (HC.on ? '켜짐' : '꺼짐') + ' · 만든 횟수 ' + ST.built + (ST.at ? '(' + ST.at + ')' : '') + ' · 리본 ' + ST.cards + ' · 점 ' + ST.pts
      + ' · 사진 띠 ' + ST.strips + (ST.views ? '(' + ST.views + ')' : '') + ' 버림 ' + ST.dropped + ' · ' + ST.ms + 'ms'
      + (ST.skip ? ' · 못 만든 이유: ' + ST.skip : '') + (ST.err ? ' · ⚠ ' + ST.err : '')];
  };
  try { if (typeof perfPanelLines === 'function') { var _pp = perfPanelLines; perfPanelLines = function () { var r = _pp.apply(this, arguments); try { if (Array.isArray(r)) return r.concat(HC.lines()); } catch (e) {} return r; }; } } catch (e) {}
  console.log(TAG + ' 설치(v2) — 3D 결과 화면 머리에 사진 결 무늬 리본(선은 밑에 둠) · 끄기 HAIR_CARDS.toggle(false) · ?cards=0');
  return HC;
})();
