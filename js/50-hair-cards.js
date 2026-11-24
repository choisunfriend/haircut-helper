// ============================================================================
// 50-hair-cards.js (2026-11-24) — 할 일 3: 사진 픽셀 띠를 3D 가닥 리본(헤어 카드)에 입힘
// ============================================================================
// ⚠ 출원 후보(「GYEOL 헤어 3D 다음 할 일」 6장) — 출원 전에는 공개 레포에 커밋하지 말 것.
//
// 왜: 3D 결과 화면의 머리는 1px 선(LineSegments) + 정점 색이라 굵기·머리결 무늬·끝 가늘어짐이 없다.
//     2D 시절 픽셀 이식(15 HAIR_QUILT)은 사진에서 결을 따라 띠를 떠 곧게 편 재료(buildHairStripPool)를
//     이미 만든다 — 그 재료를 3D 리본에 입힌다(사용자 착상: "얼굴 피부를 두상에 이식한 것처럼 헤어도 픽셀 이식").
//
// 방법(할 일 3의 1~5):
//   ① 선 → 리본: 3D 머리(adjustedHair)의 선분을 가닥으로 다시 잇고(끝점 공유), 가닥마다 카메라를 향하는
//      삼각형 띠를 만든다. 폭은 셰이더에서 시선과 결의 외적 방향으로 펼친다(돌려도 늘 정면). t = 뿌리→끝.
//   ② 아틀라스: 사진 4장(정면·좌·우·후면)의 buildHairStripPool 띠(가장 밝은 단계 = 곧게 편 원본)를
//      한 장(칸 CELL_W × CELL_H)으로 묶는다. 칸마다 평균 밝기를 재 둔다.
//   ③ 띠 배정: 가닥 뿌리를 가장 정면으로 본 사진(viewOfRoot)의 띠 중 같은 섹션 띠를 우선, 가닥마다 고정 해시로 고름.
//      띠 길이 축척은 사진 px 그대로(사진 헤어 폭 px ÷ 3D 헤어 폭) — 가닥이 띠보다 길면 띠를 반복(fract).
//   ④ 색: 정점 색(사진 되쏘기 색·염색·24/46 음영이 이미 든 값)을 그대로 쓰고, 띠에서는 <b>밝기 무늬만</b> 가져옴
//      (띠 밝기 ÷ 띠 평균 밝기). 색을 띠에서 가져오면 염색·음영과 갈라지므로(8/18 i "규칙 하나"와 같은 이유).
//      알파 = 띠 페더 × 끝 가늘어짐, 알파 테스트(정렬 없이 깊이 쓰기 — 가닥 수천 개를 매 프레임 정렬하지 않음).
//   ⑤ 범위: 3D 결과 화면만. 2D 조정 화면은 건드리지 않음(가닥 렌더 통일 때문에 꺼 둔 것).
//   선은 지우지 않고 밑에 깐다(리본 사이 틈을 선이 메움 · 끄기 HAIR_CARDS.lines='hide').
//
// 연결: 3D 머리 오브젝트가 바뀌면(장면 재구성·염색 등) 감시 타이머가 보고 다시 만든다 — 기존 파일은 안 고침.
// 못 만들면(사진 띠 없음 등) 이유를 콘솔에 한 번 찍고 선만 보임.
// 끄기: HAIR_CARDS.on=false; HAIR_CARDS.refresh() · ?cards=0 · 상태 HAIR_CARDS.lines()
// 조정: HAIR_CARDS.widthCm(리본 폭) · maxCards(리본 수 상한) · detail(무늬 세기 0~1) · alphaCut
// ============================================================================
var HAIR_CARDS = (function () {
  'use strict';
  var W = window, TAG = '[헤어 카드]';
  var HC = Object.assign({
    on: !/[?&]cards=0\b/.test(String(location.search || '')),
    widthCm: 0.45,        // 리본 폭(cm) — 사진 띠 한 장(다발)의 폭
    tipThin: 0.75,        // 끝에서 폭을 이만큼 줄임(0 = 끝까지 같은 폭)
    maxCards: 2600,       // 리본 수 상한(폰 부담) — 넘으면 고르게 솎음
    detail: 0.85,         // 사진 무늬 세기(0 = 정점 색만 · 1 = 띠 밝기 무늬 그대로)
    detailMin: 0.45, detailMax: 1.7,
    alphaCut: 0.35,       // 이보다 투명한 픽셀은 버림(페더 가장자리)
    linesMode: 'keep',    // 'keep' = 선을 밑에 깜 · 'hide' = 선 숨김
    stripPx: 8,           // 사진에서 뜨는 띠 폭(원본 px)
    CELL_W: 16, CELL_H: 256,
    pollMs: 500
  }, W.HAIR_CARDS || {});
  var ST = { built: 0, at: null, cards: 0, pts: 0, strips: 0, views: '', ms: 0, err: null, skip: null, pxPerUnit: 0 };
  var ANG = ['front', 'left', 'right', 'back'];

  function log1(k, msg) { if (ST._lk === k) return; ST._lk = k; console.warn(TAG + ' ' + msg); }
  function cmPerUnit() { try { return typeof modelCmPerUnit === 'function' ? (modelCmPerUnit() || 0) : 0; } catch (e) { return 0; } }
  function dirty() { try { if (W.GPU_DIET && W.GPU_DIET.markDirty) W.GPU_DIET.markDirty(); } catch (e) {} }
  function hairObj() { try { return model3D && model3D.headGroup ? model3D.headGroup.getObjectByName('adjustedHair') : null; } catch (e) { return null; } }

  // ---- ② 아틀라스 ----------------------------------------------------------------------------------
  var atlas = null;   // { tex, cells:[{x0,y0,w,h,meanL,hasTip,sec,view,lenPx}], byView:{front:[i…]}, key }
  function atlasKey() {
    var k = [];
    ANG.forEach(function (a) { var c = state.hairCanvases && state.hairCanvases[a]; k.push(a + ':' + (c ? (c.width + 'x' + c.height + ':' + (c._hcId || (c._hcId = Math.random().toString(36).slice(2, 8)))) : '-')); });
    return k.join('|');
  }
  function buildAtlas() {
    if (typeof buildHairStripPool !== 'function') { ST.skip = '픽셀 이식 코드(15 buildHairStripPool)가 없음'; return null; }
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
    if (!strips.length) { ST.skip = '사진에서 띠를 하나도 못 뜸(15 경고 참조)'; return null; }
    var CW = HC.CELL_W, CH = HC.CELL_H, n = strips.length;
    var cols = Math.min(n, Math.floor(2048 / CW)), rows = Math.ceil(n / cols);
    var AW = 1; while (AW < cols * CW) AW *= 2;
    var AH = 1; while (AH < rows * CH) AH *= 2;
    var cv = document.createElement('canvas'); cv.width = AW; cv.height = AH;
    var g = cv.getContext('2d', { willReadFrequently: true });
    var cells = [], byView = {};
    strips.forEach(function (s, i) {
      var c = i % cols, r = Math.floor(i / cols), x = c * CW, y = r * CH;
      var src = s.p.shades[s.p.shades.length - 1];   // 가장 밝은 단계 = 곧게 편 원본(음영은 셰이더가 함)
      try { g.drawImage(src, 0, 0, s.p.SW, s.p.SH, x, y, CW, CH); } catch (e) { return; }
      // 평균 밝기(알파 있는 픽셀만)
      var d = g.getImageData(x, y, CW, CH).data, sum = 0, nn = 0;
      for (var k = 0; k < d.length; k += 16) { if (d[k + 3] > 100) { sum += (0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2]) / 255; nn++; } }
      var cell = { x0: x / AW, y0: y / AH, w: CW / AW, h: CH / AH, meanL: nn ? Math.max(0.03, sum / nn) : 0.2, hasTip: !!s.p.hasTip, sec: s.p.sec, view: s.view, lenPx: s.p.SH };
      (byView[s.view] = byView[s.view] || []).push(cells.length);
      cells.push(cell);
    });
    var tex = new THREE.CanvasTexture(cv);
    tex.minFilter = THREE.LinearMipMapLinearFilter; tex.magFilter = THREE.LinearFilter;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping; tex.flipY = false;
    if (atlas && atlas.tex) try { atlas.tex.dispose(); } catch (e) {}
    atlas = { tex: tex, cells: cells, byView: byView, key: key, canvas: cv };
    ST.strips = cells.length; ST.views = Object.keys(byView).map(function (v) { return v + ' ' + byView[v].length; }).join(' · ');
    return atlas;
  }

  // ---- ① 선 → 가닥 ---------------------------------------------------------------------------------
  // adjustedHair 선분(a,b 짝)을 끝점이 같은 것끼리 이어 가닥으로. 색도 정점 색 그대로.
  function strandsFromLines(obj) {
    var g = obj.geometry, P = g.attributes.position, C = g.attributes.color;
    if (!P) return [];
    var pa = P.array, ca = C ? C.array : null, nSeg = P.count / 2, out = [], cur = null;
    for (var i = 0; i < nSeg; i++) {
      var a = i * 6, b = a + 3;
      var cont = cur && pa[a] === cur.lx && pa[a + 1] === cur.ly && pa[a + 2] === cur.lz;
      if (!cont) {
        cur = { p: [pa[a], pa[a + 1], pa[a + 2]], c: ca ? [ca[a], ca[a + 1], ca[a + 2]] : [0.2, 0.15, 0.1] };
        out.push(cur);
      }
      cur.p.push(pa[b], pa[b + 1], pa[b + 2]);
      cur.c.push(ca ? ca[b] : 0.2, ca ? ca[b + 1] : 0.15, ca ? ca[b + 2] : 0.1);
      cur.lx = pa[b]; cur.ly = pa[b + 1]; cur.lz = pa[b + 2];
    }
    return out.filter(function (s) { return s.p.length >= 9; });
  }

  // 사진 px ↔ 3D 단위 축척 — 정면 사진의 헤어 폭(px) ÷ 3D 헤어 폭
  function pxPerUnit(strands) {
    var minX = Infinity, maxX = -Infinity;
    strands.forEach(function (s) { for (var i = 0; i < s.p.length; i += 3) { var x = s.p[i]; if (x < minX) minX = x; if (x > maxX) maxX = x; } });
    var span = maxX - minX; if (!(span > 0)) return 0;
    var mi = state.hairMasks && (state.hairMasks.front || state.hairMasks.back);
    if (!mi || !mi.scalpY) return 0;
    var n = 0; for (var x = 0; x < mi.scalpY.length; x++) if (mi.scalpY[x] >= 0) n++;   // 15와 같은 자(헤어 캔버스 px 컬럼)
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

  // ---- 셰이더 ---------------------------------------------------------------------------------------
  var VS = [
    'attribute vec3 tangent; attribute float side; attribute vec2 st; attribute vec4 rect; attribute float meanL; attribute float along; attribute vec3 color;',
    'uniform float uWidth; uniform float uTipThin;',
    'varying vec2 vSt; varying vec4 vRect; varying float vMeanL; varying vec3 vColor; varying float vAlong;',
    'void main(){',
    '  vec4 wp = modelMatrix * vec4(position, 1.0);',
    '  vec3 T = normalize(mat3(modelMatrix) * tangent);',
    '  vec3 V = normalize(cameraPosition - wp.xyz);',
    '  vec3 S = cross(T, V); float sl = length(S); S = sl > 1e-5 ? S / sl : vec3(1.0, 0.0, 0.0);',
    '  float sc = length(modelMatrix[0].xyz);',
    '  float w = uWidth * sc * (1.0 - uTipThin * along);',
    '  wp.xyz += S * side * 0.5 * w;',
    '  vSt = st; vRect = rect; vMeanL = meanL; vColor = color; vAlong = along;',
    '  gl_Position = projectionMatrix * viewMatrix * wp;',
    '}'].join('\n');
  var FS = [
    'uniform sampler2D uAtlas; uniform float uDetail; uniform float uDMin; uniform float uDMax; uniform float uCut;',
    'varying vec2 vSt; varying vec4 vRect; varying float vMeanL; varying vec3 vColor; varying float vAlong;',
    'void main(){',
    '  vec2 uv = vRect.xy + vec2(clamp(vSt.x, 0.02, 0.98), fract(vSt.y)) * vRect.zw;',
    '  vec4 t = texture2D(uAtlas, uv);',
    '  float a = t.a * (1.0 - smoothstep(0.85, 1.0, vAlong) * 0.6);',
    '  if (a < uCut) discard;',
    '  float l = dot(t.rgb, vec3(0.2126, 0.7152, 0.0722)) / max(vMeanL, 0.03);',
    '  float d = mix(1.0, clamp(l, uDMin, uDMax), uDetail);',
    '  gl_FragColor = vec4(vColor * d, 1.0);',
    '}'].join('\n');

  // ---- 리본 만들기 ----------------------------------------------------------------------------------
  function build(obj) {
    var t0 = performance.now();
    ST.skip = null; ST.err = null;
    var A = buildAtlas(); if (!A) { log1('skip:' + ST.skip, '못 만듦 — ' + ST.skip + ' · 선만 보입니다'); return null; }
    var cmu = cmPerUnit(); if (!(cmu > 0)) { ST.skip = '3D 자(cm/단위)가 없음'; log1('skip:cm', '못 만듦 — ' + ST.skip); return null; }
    var S = strandsFromLines(obj);
    if (!S.length) { ST.skip = '3D 머리 선이 비어 있음'; return null; }
    var ppu = pxPerUnit(S); ST.pxPerUnit = ppu;
    var stride = Math.max(1, S.length / HC.maxCards);
    var pos = [], tan = [], side = [], stA = [], rect = [], mean = [], alongA = [], col = [], idx = [], v = 0, nC = 0, acc = 0;
    for (var si = 0; si < S.length; si++) {
      acc += 1; if (acc < stride) continue; acc -= stride;
      var s = S[si], p = s.p, c = s.c, n = p.length / 3;
      var cell = pickCell(A, viewOf(p[0], p[1], p[2]), si);
      // 호길이(3D) → 띠 길이 축척(사진 px). 띠가 짧으면 반복
      var arc = [0], tot = 0;
      for (var i = 1; i < n; i++) { tot += Math.hypot(p[i * 3] - p[i * 3 - 3], p[i * 3 + 1] - p[i * 3 - 2], p[i * 3 + 2] - p[i * 3 - 1]); arc.push(tot); }
      if (!(tot > 0)) continue;
      var tScale = ppu > 0 ? ppu / Math.max(4, cell.lenPx) : 1 / tot;   // 3D 단위 → 띠 몇 장
      var tOff = hash(si + 7) * 0.5;
      for (var j = 0; j < n; j++) {
        var j0 = Math.max(0, j - 1), j1 = Math.min(n - 1, j + 1);
        var tx = p[j1 * 3] - p[j0 * 3], ty = p[j1 * 3 + 1] - p[j0 * 3 + 1], tz = p[j1 * 3 + 2] - p[j0 * 3 + 2];
        var al = arc[j] / tot;
        // 끝이 든 띠는 가닥 끝을 띠 끝에 맞춤(15 tipFrac와 같은 뜻 — 잘린 자리에 원본 모발 끝)
        var tv = cell.hasTip && tScale * tot > 1 ? Math.min(0.995, 1 - (tot - arc[j]) * tScale) : (tOff + arc[j] * tScale);
        for (var k = 0; k < 2; k++) {
          pos.push(p[j * 3], p[j * 3 + 1], p[j * 3 + 2]);
          tan.push(tx, ty, tz);
          side.push(k ? 1 : -1);
          stA.push(k, tv);
          rect.push(cell.x0, cell.y0, cell.w, cell.h);
          mean.push(cell.meanL);
          alongA.push(al);
          col.push(c[j * 3], c[j * 3 + 1], c[j * 3 + 2]);
        }
        if (j > 0) { var b = v + (j - 1) * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
      }
      v += n * 2; nC++;
    }
    if (!nC) { ST.skip = '리본으로 만들 가닥이 없음'; return null; }
    var g = new THREE.BufferGeometry();
    g.setAttribute ? 0 : (g.setAttribute = g.addAttribute);
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('tangent', new THREE.Float32BufferAttribute(tan, 3));
    g.setAttribute('side', new THREE.Float32BufferAttribute(side, 1));
    g.setAttribute('st', new THREE.Float32BufferAttribute(stA, 2));
    g.setAttribute('rect', new THREE.Float32BufferAttribute(rect, 4));
    g.setAttribute('meanL', new THREE.Float32BufferAttribute(mean, 1));
    g.setAttribute('along', new THREE.Float32BufferAttribute(alongA, 1));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(v > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
    g.computeBoundingSphere();
    var m = new THREE.ShaderMaterial({
      vertexShader: VS, fragmentShader: FS, side: THREE.DoubleSide,
      uniforms: {
        uAtlas: { value: A.tex }, uWidth: { value: HC.widthCm / cmu }, uTipThin: { value: HC.tipThin },
        uDetail: { value: HC.detail }, uDMin: { value: HC.detailMin }, uDMax: { value: HC.detailMax }, uCut: { value: HC.alphaCut }
      }
    });
    var mesh = new THREE.Mesh(g, m);
    mesh.name = 'hairCards'; mesh.frustumCulled = false;
    mesh.position.copy(obj.position); mesh.quaternion.copy(obj.quaternion); mesh.scale.copy(obj.scale);
    ST.built++; ST.at = new Date().toTimeString().slice(0, 8); ST.cards = nC; ST.pts = v / 2; ST.ms = Math.round(performance.now() - t0);
    if (ST.built === 1 || ST.built % 10 === 0) console.log(TAG + ' 리본 ' + nC + '개(점 ' + (v / 2) + ') · 사진 띠 ' + ST.strips + '장(' + ST.views + ') · 폭 ' + HC.widthCm + 'cm · 축척 ' + ppu.toFixed(0) + 'px/단위 · ' + ST.ms + 'ms');
    return mesh;
  }

  // ---- 붙이기·감시 ----------------------------------------------------------------------------------
  var lastSig = '', mine = null;
  function sigOf(o) { try { var g = o.geometry; return g.uuid + ':' + (g.attributes.position ? g.attributes.position.version : 0) + ':' + (g.attributes.color ? g.attributes.color.version : 0); } catch (e) { return ''; } }
  function remove() {
    if (!mine) return;
    try { if (mine.parent) mine.parent.remove(mine); mine.geometry.dispose(); mine.material.dispose(); } catch (e) {}
    mine = null;
  }
  function apply() {
    var o = hairObj();
    if (!HC.on || !o) { if (mine && (!HC.on || !o)) { remove(); dirty(); } if (o) o.visible = true; lastSig = ''; return; }
    var sg = sigOf(o) + '|' + HC.widthCm + '|' + HC.maxCards + '|' + HC.detail + '|' + HC.linesMode;
    if (sg === lastSig && mine && mine.parent) return;
    lastSig = sg;
    remove();
    try { mine = build(o); } catch (e) { ST.err = String(e && e.message || e); console.warn(TAG + ' 만들기 실패 — 선만 보입니다', e); mine = null; }
    if (mine) { (o.parent || model3D.headGroup).add(mine); o.visible = HC.linesMode !== 'hide'; }
    else o.visible = true;
    dirty();
  }
  function tick() { try { if (typeof currentScreen !== 'undefined' && currentScreen !== 'model3d') return; apply(); } catch (e) {} }
  setInterval(tick, HC.pollMs);
  HC.refresh = function () { lastSig = ''; atlas = null; apply(); };
  HC.toggle = function (v) { HC.on = typeof v === 'boolean' ? v : !HC.on; HC.refresh(); return HC.on; };
  HC.atlasCanvas = function () { return atlas && atlas.canvas; };   // 확인용: document.body.appendChild(HAIR_CARDS.atlasCanvas())
  HC.lines = function () {
    return [TAG + ' ' + (HC.on ? '켜짐' : '꺼짐') + ' · 만든 횟수 ' + ST.built + (ST.at ? '(' + ST.at + ')' : '') + ' · 리본 ' + ST.cards + ' · 점 ' + ST.pts
      + ' · 선 ' + HC.linesMode + ' · 사진 띠 ' + ST.strips + (ST.views ? '(' + ST.views + ')' : '') + ' · ' + ST.ms + 'ms'
      + (ST.skip ? ' · 못 만든 이유: ' + ST.skip : '') + (ST.err ? ' · ⚠ ' + ST.err : '')];
  };
  // 진단 패널 끝 줄(있으면)
  try { if (typeof perfPanelLines === 'function') { var _pp = perfPanelLines; perfPanelLines = function () { var r = _pp.apply(this, arguments); try { if (Array.isArray(r)) return r.concat(HC.lines()); } catch (e) {} return r; }; } } catch (e) {}
  console.log(TAG + ' 설치 — 3D 결과 화면 머리에 사진 띠 리본을 얹습니다(선은 밑에 둠) · 끄기 HAIR_CARDS.toggle(false) · ?cards=0 · 상태 HAIR_CARDS.lines()');
  return HC;
})();
