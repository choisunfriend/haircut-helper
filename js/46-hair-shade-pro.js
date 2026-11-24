/* ==========================================================================
 * 46-hair-shade-pro.js — HAIR_SHADE_PRO (2026-11-24) 3D 헤어 후보정 ① 밀도 음영 ② 실시간 2중 빛 띠
 *
 * 왜: 24 shadeHairObject가 이미 "안쪽 가닥 어둡게 + 결 하이라이트"를 정점 색에 굽는다.
 *   한계 두 가지 —
 *   · 안쪽 판정이 두상에서의 거리(방사 깊이)뿐이라, 가닥이 실제로 빽빽한 곳
 *     (목덜미·귀 뒤·층 안쪽)이 따로 어두워지지 않는다.
 *   · 빛 띠를 색에 구워 두어서 3D를 돌려도 띠가 안 움직인다(플라스틱/점토 느낌).
 *
 * 무엇:
 *   ① 밀도 음영(간이 deep opacity) — 헤어 선분을 격자에 쌓아 밀도를 만들고, 칸마다
 *      빛 쪽으로 걸어가며 가려지는 양을 더해 투과율 T = exp(-k·Σ밀도)를 구한다.
 *      정점 색 × (min + (1-min)·T). 가닥 단위가 아니라 칸 단위라 가볍다.
 *   ② 실시간 2중 빛 띠(Kajiya-Kay 계열) — 선분 방향(hairTangent)을 정점 속성으로 넣고
 *      LineBasicMaterial 셰이더에 띠 두 개를 더한다.
 *        1차 띠: 흰빛, 좁고 결 쪽으로 조금 이동
 *        2차 띠: 머리색으로 물든 넓은 띠, 반대쪽으로 이동
 *      빛은 시점 기준(머리 위·앞)이라 3D를 돌리면 띠가 머리 위를 흐른다.
 *      ①의 투과율(hairOcc)을 띠에도 곱해서 안쪽 가닥은 반짝이지 않는다.
 *   ②가 켜지면 24의 구운 하이라이트(spec)는 그 호출 동안 0으로 둔다(이중 광택 방지).
 *
 * 자리: buildAdjustedHair3DObjectBase 맨 바깥(24 음영 래퍼 바깥). 24보다 늦게 로드되므로
 *   여기서 감싸면 순서가 [46 → 24 → 원본]이 된다. 땋기(튜브 Mesh)는 건드리지 않는다.
 *
 * 끄기: HAIR_SHADE_PRO.on=false (전체) · .density.on=false · .bands.on=false — 다음 3D 만들기부터
 * 콘솔: HAIR_SHADE_PRO.status()
 * ========================================================================== */
var HAIR_SHADE_PRO = (function () {
  'use strict';
  var W = window, TAG = '[헤어 음영+]';
  var H = {
    on: true,
    density: {
      /* (11-24) 기본 끔 — 사용자: "칸 때문에 이전부터 문제가 많았는데, 칸을 쓰지 않고 결을 읽게 해두지 않았어?"
         가닥은 38(RAW_TRACE)이 사진 결을 칸·평균 없이 그대로 읽어 만든다. 이 밀도 격자는 거기에 새로 칸을 들인 것이라
         직모 정수리에 네모 얼룩을 냈다. 안쪽 어둡게는 13b 깊이층 음영(두피 0 → 헐 1)이 이미 가닥마다 하고 있다.
         다시 켜기 HAIR_SHADE_PRO.density.on=true (흐림·삼선형 보간은 남겨 둠) */
      on: false,
      grid: 40,        // 긴 축 칸 수(나머지 축은 비율대로)
      k: 0.22,         // 정규화 밀도 1칸당 흡수
      min: 0.5,        // 가장 깊은 곳 밝기 하한
      startCells: 1.5, // 자기 칸은 건너뛰고 이만큼 밖에서부터 셈
      blur: 1,         // (11-24) 투과율 격자 3×3×3 흐림 횟수 — 칸 경계가 네모 얼룩으로 보이던 것
      light: [0.25, 0.9, 0.35]   // 머리 좌표계 빛 방향(위·앞) — 밀도 음영용
    },
    bands: {
      on: true,
      light: [0.35, 0.75, 0.55], // 시점 좌표계 빛(카메라 기준 오른쪽 위 앞)
      // (11-24) 띠 넓힘 — pow1 90·k1 0.30은 곱슬에서 점점이 흰 조각, 직모에서도 가는 흰 선. 넓고 약하게
      shift1: 0.10, pow1: 28, k1: 0.14,   // 1차: 흰빛
      shift2: -0.14, pow2: 12, k2: 0.30,  // 2차: 머리색, 넓음
      smoothSeg: 5,     // (11-24) 빛 띠용 결 방향을 가닥 따라 ±5마디 평균 — 곱슬 마디마다 띠가 켜졌다 꺼지는 것 막음(모양은 그대로)
      kd: 0.35          // 결 방향 확산(가닥이 빛과 나란하면 살짝 어둡게) 섞는 정도
    },
    _last: null
  };

  /* ── ① 밀도 음영 ───────────────────────────────────────────────── */
  function densityOcclusion(P) {
    var D = H.density, n = P.count;
    var mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (var i = 0; i < n; i++) {
      var x = P.getX(i), y = P.getY(i), z = P.getZ(i);
      if (x < mn[0]) mn[0] = x; if (y < mn[1]) mn[1] = y; if (z < mn[2]) mn[2] = z;
      if (x > mx[0]) mx[0] = x; if (y > mx[1]) mx[1] = y; if (z > mx[2]) mx[2] = z;
    }
    var ext = [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]];
    var big = Math.max(ext[0], ext[1], ext[2]);
    if (!(big > 0)) return null;
    var cs = big / D.grid;
    var nx = Math.max(2, Math.ceil(ext[0] / cs) + 1), ny = Math.max(2, Math.ceil(ext[1] / cs) + 1), nz = Math.max(2, Math.ceil(ext[2] / cs) + 1);
    var cells = new Float32Array(nx * ny * nz);
    function idx(x, y, z) {
      var ix = Math.min(nx - 1, Math.max(0, ((x - mn[0]) / cs) | 0));
      var iy = Math.min(ny - 1, Math.max(0, ((y - mn[1]) / cs) | 0));
      var iz = Math.min(nz - 1, Math.max(0, ((z - mn[2]) / cs) | 0));
      return (iz * ny + iy) * nx + ix;
    }
    // 선분 길이를 가운데 칸에 쌓는다(LineSegments: 정점 2개 = 선분 1개)
    for (var s = 0; s + 1 < n; s += 2) {
      var ax = P.getX(s), ay = P.getY(s), az = P.getZ(s), bx = P.getX(s + 1), by = P.getY(s + 1), bz = P.getZ(s + 1);
      var len = Math.hypot(bx - ax, by - ay, bz - az);
      cells[idx((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2)] += len;
    }
    // 정규화: 비어 있지 않은 칸의 90백분위를 1로
    var nz2 = [];
    for (var c = 0; c < cells.length; c++) if (cells[c] > 0) nz2.push(cells[c]);
    if (!nz2.length) return null;
    nz2.sort(function (a, b) { return a - b; });
    var ref = nz2[Math.min(nz2.length - 1, Math.floor(nz2.length * 0.9))] || 1;
    for (c = 0; c < cells.length; c++) cells[c] = Math.min(2, cells[c] / ref);
    // 칸별 투과율: 빛 쪽으로 걸어가며 밀도 합
    var L = D.light, ll = Math.hypot(L[0], L[1], L[2]); L = [L[0] / ll, L[1] / ll, L[2] / ll];
    var trans = new Float32Array(cells.length);
    var maxSteps = nx + ny + nz;
    for (var iz = 0; iz < nz; iz++) for (var iy = 0; iy < ny; iy++) for (var ix = 0; ix < nx; ix++) {
      var ci = (iz * ny + iy) * nx + ix;
      if (cells[ci] <= 0) { trans[ci] = 1; continue; }
      var px = ix + 0.5 + L[0] * D.startCells, py = iy + 0.5 + L[1] * D.startCells, pz = iz + 0.5 + L[2] * D.startCells, sum = 0;
      for (var st = 0; st < maxSteps; st++) {
        var jx = px | 0, jy = py | 0, jz = pz | 0;
        if (px < 0 || py < 0 || pz < 0 || jx >= nx || jy >= ny || jz >= nz) break;
        sum += cells[(jz * ny + jy) * nx + jx];
        px += L[0]; py += L[1]; pz += L[2];
      }
      trans[ci] = Math.exp(-D.k * sum);
    }
    /* (11-24) 네모 얼룩 고침: ① 투과율 격자를 흐리고 ② 정점에서 <b>삼선형 보간</b>으로 읽는다.
       예전엔 정점이 든 칸 값을 그대로 써서(최근접) 칸 경계(≈머리 폭/40)마다 밝기가 계단으로 끊겨
       직모 정수리에 회색 네모가 보였다. */
    for (var b = 0; b < (D.blur | 0); b++) {
      var t2 = new Float32Array(trans.length);
      for (iz = 0; iz < nz; iz++) for (iy = 0; iy < ny; iy++) for (ix = 0; ix < nx; ix++) {
        var sm = 0, cn = 0;
        for (var dz = -1; dz <= 1; dz++) for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
          var qx = ix + dx, qy = iy + dy, qz = iz + dz;
          if (qx < 0 || qy < 0 || qz < 0 || qx >= nx || qy >= ny || qz >= nz) continue;
          var qi = (qz * ny + qy) * nx + qx;
          if (cells[qi] <= 0) continue;   // 빈 칸(투과 1)은 섞지 않음 — 가장자리가 하얗게 뜨지 않게
          sm += trans[qi]; cn++;
        }
        var ci2 = (iz * ny + iy) * nx + ix;
        t2[ci2] = cn ? sm / cn : trans[ci2];
      }
      trans = t2;
    }
    function tri(x, y, z) {
      var fx = Math.min(nx - 1.001, Math.max(0, (x - mn[0]) / cs - 0.5)), fy = Math.min(ny - 1.001, Math.max(0, (y - mn[1]) / cs - 0.5)), fz = Math.min(nz - 1.001, Math.max(0, (z - mn[2]) / cs - 0.5));
      var x0 = fx | 0, y0 = fy | 0, z0 = fz | 0, ax = fx - x0, ay = fy - y0, az = fz - z0, v = 0, w = 0;
      for (var k = 0; k < 8; k++) {
        var X = x0 + (k & 1), Y = y0 + ((k >> 1) & 1), Z = z0 + ((k >> 2) & 1);
        var ww = ((k & 1) ? ax : 1 - ax) * (((k >> 1) & 1) ? ay : 1 - ay) * (((k >> 2) & 1) ? az : 1 - az);
        var ii = (Z * ny + Y) * nx + X;
        if (cells[ii] <= 0) continue;
        v += trans[ii] * ww; w += ww;
      }
      return w > 1e-6 ? v / w : trans[idx(x, y, z)];
    }
    var occ = new Float32Array(n);
    for (i = 0; i < n; i++) occ[i] = D.min + (1 - D.min) * tri(P.getX(i), P.getY(i), P.getZ(i));
    return { occ: occ, grid: [nx, ny, nz] };
  }

  /* ── ② 실시간 2중 빛 띠 ────────────────────────────────────────── */
  function tangents(P) {
    var n = P.count, t = new Float32Array(n * 3);
    for (var s = 0; s + 1 < n; s += 2) {
      var tx = P.getX(s + 1) - P.getX(s), ty = P.getY(s + 1) - P.getY(s), tz = P.getZ(s + 1) - P.getZ(s);
      var l = Math.hypot(tx, ty, tz) || 1;
      tx /= l; ty /= l; tz /= l;
      t[s * 3] = t[s * 3 + 3] = tx; t[s * 3 + 1] = t[s * 3 + 4] = ty; t[s * 3 + 2] = t[s * 3 + 5] = tz;
    }
    /* (11-24) 가닥 따라 ±smoothSeg 마디 평균 — 선분 끝점이 다음 선분 시작점과 같으면 같은 가닥 */
    var R = H.bands.smoothSeg | 0, nSeg = n >> 1;
    if (R > 0 && nSeg > 1) {
      var o = new Float32Array(t.length), st = 0;
      for (var g = 1; g <= nSeg; g++) {
        var brk = g === nSeg || P.getX(2 * g) !== P.getX(2 * g - 1) || P.getY(2 * g) !== P.getY(2 * g - 1) || P.getZ(2 * g) !== P.getZ(2 * g - 1);
        if (!brk) continue;
        for (var a = st; a < g; a++) {
          var sx = 0, sy = 0, sz = 0;
          for (var q = Math.max(st, a - R); q <= Math.min(g - 1, a + R); q++) { sx += t[q * 6]; sy += t[q * 6 + 1]; sz += t[q * 6 + 2]; }
          var sl = Math.hypot(sx, sy, sz);
          if (sl < 1e-6) { sx = t[a * 6]; sy = t[a * 6 + 1]; sz = t[a * 6 + 2]; sl = 1; }
          o[a * 6] = o[a * 6 + 3] = sx / sl; o[a * 6 + 1] = o[a * 6 + 4] = sy / sl; o[a * 6 + 2] = o[a * 6 + 5] = sz / sl;
        }
        st = g;
      }
      t = o;
    }
    return t;
  }

  function installBands(obj) {
    var B = H.bands, L = B.light, ll = Math.hypot(L[0], L[1], L[2]);
    var mat = obj.material.clone();
    mat.onBeforeCompile = function (sh) {
      sh.uniforms.uHL = { value: new THREE.Vector3(L[0] / ll, L[1] / ll, L[2] / ll) };
      sh.uniforms.uHB1 = { value: new THREE.Vector3(B.shift1, B.pow1, B.k1) };
      sh.uniforms.uHB2 = { value: new THREE.Vector3(B.shift2, B.pow2, B.k2) };
      sh.uniforms.uHKd = { value: B.kd };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec3 hairTangent;\nattribute float hairOcc;\nvarying vec3 vHT;\nvarying vec3 vHV;\nvarying float vHO;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvHT = normalize((modelViewMatrix * vec4(hairTangent, 0.0)).xyz);\nvHV = -mvPosition.xyz;\nvHO = hairOcc;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uHL; uniform vec3 uHB1; uniform vec3 uHB2; uniform float uHKd;\nvarying vec3 vHT; varying vec3 vHV; varying float vHO;\n'
          + 'float hairBand(float d, vec3 b){ float x = clamp(d + b.x, -1.0, 1.0); return pow(sqrt(max(0.0, 1.0 - x*x)), b.y) * b.z; }')
        .replace('gl_FragColor = vec4( outgoingLight, diffuseColor.a );',
          'vec3 hT = normalize(vHT); vec3 hV = normalize(vHV); vec3 hH = normalize(uHL + hV);\n'
          + 'float hD = dot(hT, hH); float hDl = dot(hT, uHL);\n'
          + 'float hDiff = mix(1.0, sqrt(max(0.0, 1.0 - hDl*hDl)), uHKd);\n'
          + 'outgoingLight = outgoingLight * hDiff + vHO * vHO * (vec3(hairBand(hD, uHB1)) + hairBand(hD, uHB2) * diffuseColor.rgb * 1.6);\n'
          + 'gl_FragColor = vec4( outgoingLight, diffuseColor.a );');
      if (sh.fragmentShader.indexOf('hairBand(hD') < 0) console.warn(TAG + ' 셰이더 끼울 자리를 못 찾음 — 빛 띠 없이 그림(three 버전 확인)');
    };
    mat.customProgramCacheKey = function () { return 'hairShadePro1'; };
    obj.material = mat;
  }

  function apply(obj) {
    if (!obj || !obj.isLineSegments || !obj.geometry) return obj;
    var g = obj.geometry, P = g.attributes.position, C = g.attributes.color;
    if (!P || !C || P.count < 4) return obj;
    var t0 = performance.now(), info = { verts: P.count };
    var occ = null;
    if (H.density.on) {
      var r = densityOcclusion(P);
      if (r) {
        occ = r.occ; info.grid = r.grid.join('×');
        var c = C.array;
        for (var i = 0; i < P.count; i++) { c[i * 3] *= occ[i]; c[i * 3 + 1] *= occ[i]; c[i * 3 + 2] *= occ[i]; }
        C.needsUpdate = true;
      }
    }
    if (H.bands.on) {
      if (!occ) { occ = new Float32Array(P.count); occ.fill(1); }
      g.setAttribute('hairTangent', new THREE.BufferAttribute(tangents(P), 3));
      g.setAttribute('hairOcc', new THREE.BufferAttribute(occ, 1));
      installBands(obj);
      info.bands = true;
    }
    info.ms = Math.round(performance.now() - t0);
    H._last = info;
    console.log(TAG + ' 정점 ' + info.verts + (info.grid ? ' · 밀도 격자 ' + info.grid : '') + (info.bands ? ' · 빛 띠 2개' : '') + ' · ' + info.ms + 'ms');
    return obj;
  }

  function install() {
    var name = 'buildAdjustedHair3DObjectBase', f = W[name];
    if (typeof f !== 'function') { console.warn(TAG + ' ' + name + ' 없음 — 건너뜀'); return; }
    if (f.__hspWrapped) return;
    var w = function () {
      if (!H.on || typeof THREE === 'undefined') return f.apply(this, arguments);
      // 실시간 빛 띠가 켜지면 24의 구운 하이라이트는 이번 호출 동안 끈다(이중 광택 방지)
      var SB = W.STYLE_BASE, sh = SB && ((SB.active && SB.active.shade) || SB.shade), old = null;
      if (H.bands.on && sh && typeof sh.spec === 'number') { old = sh.spec; sh.spec = 0; }
      var obj;
      try { obj = f.apply(this, arguments); } finally { if (old !== null) sh.spec = old; }
      try { return apply(obj); } catch (e) { console.warn(TAG + ' 실패 — 원래 그림 유지', e); return obj; }
    };
    w.__hspWrapped = true; w.__sbWrapped = f.__sbWrapped;
    W[name] = w;
    console.log(TAG + ' 설치 — 밀도 음영 + 실시간 빛 띠 2개 · 끄기 HAIR_SHADE_PRO.on=false');
  }

  H.status = function () { return JSON.stringify({ on: H.on, density: H.density.on, bands: H.bands.on, last: H._last }); };
  H._apply = apply;   // 점검용
  install();
  return H;
})();
