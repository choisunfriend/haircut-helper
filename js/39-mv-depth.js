/* ==========================================================================
 * 39-mv-depth.js — MV_DEPTH (2026-11-08) 사진 가닥의 깊이를 다른 사진들의 결로 맞춤
 *
 * 왜: 디버그 내보내기 4세트(짧은 남자·곱슬 숏·긴 웨이브·단발) 분석 —
 *   사진에서 읽은 가닥(lift)을 <b>자기 사진</b>에 되쏘면 결 어긋남 2~17%(읽기는 잘 됨).
 *   그런데 <b>다른 사진</b>에 쏘면 20~77% — 깊이 방향(사진 한 장으로는 모르는 축)을 어림으로 넣어서.
 *   다시 기른 머리의 노랑(결 어긋남)은 대부분 여기서 옵니다. 읽기가 아니라 2D→3D 옮기기 문제.
 *
 * 무엇: 기르기 직전, 각 사진 가닥의 점을 <b>자기 사진의 시선축으로만</b> 옮깁니다(자기 사진에 비친 모양은 1px도 안 바뀜).
 *   옮기는 양 = 다른 사진들이 그 자리에서 읽은 결과 가닥 방향이 맞도록(결 또렷함 무게 · 최소제곱)
 *             + 다른 사진들이 "머리"라고 본 깊이 구간 안에서 가장 가까운 자리.
 *   규칙·판정·스타일별 분기 없음 — 사진들끼리의 일치만 씁니다.
 *   이 구간 맞춤이 같은 일을 하던 REGROW.copyDepthMid(구간 가운데로 옮김 · 결 모름)를 대신하므로, 켜져 있으면 그것을 끕니다.
 *
 * 오프라인 재현(같은 수식, 가닥 1/3):  다른 사진에 쏜 결 어긋남 · 다른 사진 머리 영역 밖 점
 *   짧은 남자 39/38/29% → 23/28/21% · 밖 43% → 11%
 *   단발      28/59/33/20% → 25/45/33/9% · 밖 42% → 21%
 *   긴 웨이브 20/25/23/18% → 16/22/22/12% · 밖 47% → 21%
 *   곱슬 숏   71/62/57/49% → 61/50/55/47% · 밖 30% → 7%   (곱슬은 결이 4px보다 촘촘해 덜 듣습니다)
 *
 * 끄기 MV_DEPTH.on=false (다음 기르기부터 · copyDepthMid는 원래 값으로)
 * 콘솔 MV_DEPTH.lines().join("\n")
 * ========================================================================== */
var MV_DEPTH = (function () {
  'use strict';
  var W = window, TAG = '[여러 사진 깊이]';
  var M = {
    on: true,
    rangeCm: 11,      // 자기 시선축으로 앞뒤 이만큼까지 찾아봄
    stepCm: 0.9,      // 깊이 구간을 찾는 간격
    tolCm: 0.6,       // 다른 사진 머리 영역 경계 여유(PHOTO_CHECK.tolCm과 같음)
    minCoh: 0.2,      // 이보다 흐린 결은 안 씀
    lam: 0.3,         // 옮기지 않으려는 힘(클수록 덜 옮김)
    maxSlope: 1.5,    // 한 마디에서 깊이 변화 ≤ 마디 길이 × 이 값
    iters: 3,
    rootGrip: 0.3,    // 뿌리 쪽 10% 마디는 이 비율만 옮김
    smooth: 2,
    body: true,       // (2026-11-08b) 자기 사진에 보인 점은 몸에 안 가린 깊이 — 아래 bodyMin
    bodyGapCm: 0.6,   // 몸 겉면에서 이만큼 앞(머리카락 두께)
    skull: true,      // (2026-11-09) 자기 사진에 보인 점은 두상(두피 타원) 속에도 못 감 — 아래 bodyMin · 끄기 MV_DEPTH.skull=false
    skullIn: 0.98,    // 두피 타원을 이 배율로 줄인 것을 머리통으로 봄(두피에 누운 머리는 그대로)
    bodyVeto: true,   // (2026-11-09) 몸 앞 깊이를 다른 사진들이 다 "머리 없음"이라 하고 밀기 전 깊이는 맞으면 기둥을 안 따름 — run() ②
    stat: null
  };
  var prevCopyDepthMid = null;

  function now() { try { return performance.now(); } catch (e) { return Date.now(); } }
  function envNow(photo) {
    var E = (typeof getScalpEllipsoid === 'function') ? getScalpEllipsoid() : null;
    if (!photo || !E || !(E.a > 0) || !isFinite(photo.CY) || !isFinite(photo.yTop)) return null;
    var cm = 0; try { cm = (typeof modelCmPerUnit === 'function') ? modelCmPerUnit() : 0; } catch (e) {}
    var core = W.PHOTO_CHECK && W.PHOTO_CHECK._core;
    return core.mkEnv({ CY: photo.CY, yTop: photo.yTop, a: E.a, b: E.b, c: E.c, cm: cm > 0 ? cm : 19 });
  }

  function run(photo) {
    var t0 = now(), PC = W.PHOTO_CHECK, core = PC && PC._core;
    if (!core || typeof PC._cams !== 'function') return { err: 'PHOTO_CHECK 없음' };
    var env = envNow(photo); if (!env) return { err: '두상·환경 없음' };
    var cams = PC._cams().filter(function (c) { return typeof c.dirAt === 'function'; });
    if (cams.length < 2) return { err: '결 있는 사진 ' + cams.length + '장' };
    var byAng = {}; cams.forEach(function (c) { byAng[c.angle] = c; c._tolPx = Math.max(1, M.tolCm / (c.s * env.cm)); });
    var unit = 1 / env.cm, range = M.rangeCm * unit, step = M.stepCm * unit;
    var o = [0, 0], st = { strands: 0, moved: 0, pts: 0, sumMove: 0, outB: 0, outA: 0, chk: 0, offB: 0, offA: 0, cmp: 0 };

    function inHair(c, x, y, z) {               // 1 머리 · 0 밖 · -1 그 사진은 판정 못 함(가림)
      if (!core.project(c, env, x, y, z, o)) return -1;
      var r = c._tolPx, ix = o[0], iy = o[1];
      if (c.smp.at(ix, iy) > 0 || c.smp.at(ix + r, iy) > 0 || c.smp.at(ix - r, iy) > 0 || c.smp.at(ix, iy + r) > 0 || c.smp.at(ix, iy - r) > 0) return 1;
      return 0;
    }
    function okAll(own, x, y, z) {
      for (var u = 0; u < cams.length; u++) { var c = cams[u]; if (c === own) continue; if (inHair(c, x, y, z) === 0) return false; }
      return true;
    }
    function grainErr(own, P) {                 // 다른 사진에서 결과 어긋난 정도(무게 평균 sin²) · 비교 수
      var e = 0, n = 0, wsum = 0;
      for (var k = 1; k < P.length; k++) {
        var p = P[k], q = P[k - 1], mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2, mz = (p.z + q.z) / 2, dx = p.x - q.x, dy = p.y - q.y, dz = p.z - q.z;
        for (var u = 0; u < cams.length; u++) {
          var c = cams[u]; if (c === own || !core.project(c, env, mx, my, mz, o)) continue;
          var d = c.dirAt(o[0], o[1]); if (!d || !(d[1] >= M.minCoh)) continue;
          var R = c.R, ax = (R[0] * dx + R[1] * dy + R[2] * dz) / c.s, ay = (R[3] * dx + R[4] * dy + R[5] * dz) / c.sy, L2 = ax * ax + ay * ay; if (!(L2 > 1e-12)) continue;
          var cr = -Math.sin(d[0]) * ax + Math.cos(d[0]) * ay; e += d[1] * cr * cr / L2; wsum += d[1]; n++;
        }
      }
      return { e: wsum > 0 ? e / wsum : 0, n: n };
    }

    /* (2026-11-08b) 몸에 안 가린 깊이 — 사용자: 긴 웨이브 "정면 빔 34.8%" · 결과 화면에서 어깨 앞 머리가 전부 등 뒤로.
       사진 가닥의 점은 <b>자기 사진에 보인 점</b>입니다. 그 점에서 자기 카메라 쪽으로 가는 시선이 목·몸통 기둥을 지나면 그 점은 몸에 가려
       사진에 찍힐 수 없었습니다 → 깊이는 기둥에서 카메라 쪽으로 나온 자리보다 앞이어야 합니다(보인다는 사실 그대로 · 스타일 판정 아님).
       예전: 가슴 앞·등 뒤가 둘 다 "다른 사진도 머리"라 처음 깊이(대개 뒤)가 남고, 찾는 범위(±11cm)로는 어깨 반대편까지 못 감.
       기둥 = REGROW.bodyDims()(걷기 가림과 같은 목·몸통 타원 기둥). 몸통 위에 보인 머리가 없는 사진에서는 아무것도 안 바뀝니다. 끄기 MV_DEPTH.body=false */
    var BD = null; if (M.body) { try { BD = W.REGROW && typeof W.REGROW.bodyDims === 'function' ? W.REGROW.bodyDims() : null; } catch (e) { BD = null; } }
    var COLS = BD ? [{ top: BD.nTop, hw: BD.nw, hd: BD.nd }, { top: BD.tTop, hw: BD.tw, hd: BD.td }] : [], gap = M.bodyGapCm * unit;
    st.bodyOn = !!BD; st.bodyStrands = 0; st.bodyPts = 0; st.bodySum = 0; st.bodyBlkB = 0; st.bodyBlkA = 0;
    function bodyMin(wx, wy, wz, x, y, z) {    // 이 점을 시선축(+w = 카메라 쪽)으로 t만큼 옮길 때 안 가리려면 t ≥ 돌려준 값 · 상관없으면 -Infinity
      var m = -Infinity;
      for (var q = 0; q < COLS.length; q++) {
        var cc = COLS[q], ia = 1 / (cc.hw * cc.hw), ic = 1 / (cc.hd * cc.hd), A = wx * wx * ia + wz * wz * ic; if (A < 1e-12) continue;
        var B = 2 * (x * wx * ia + z * wz * ic), C = x * x * ia + z * z * ic - 1, D = B * B - 4 * A * C; if (D <= 0) continue;
        var t2 = (-B + Math.sqrt(D)) / (2 * A);                // 시선이 기둥에서 카메라 쪽으로 나오는 자리
        if (!(y + t2 * wy < cc.top)) continue;                  // 그 자리가 기둥 위 끝보다 위 = 기둥 없음
        if (t2 + gap > m) m = t2 + gap;
      }
      /* (2026-11-09) 두상: 사용자 "3D에 올릴 때 머리 속에 좌표가 가면 안 되는 거잖아" — 자기 사진에 보인 점이 머리통(두피 타원 × skullIn) 속이거나
         그 뒤(시선이 머리통을 지남)면 머리통에서 카메라 쪽으로 나온 자리보다 앞이어야 함. 몸 기둥과 같은 뜻 · 판정 아님(보인다는 사실) */
      if (M.skull && env && env.a2 > 0) {                       // env는 a2·b2·c2(제곱)만 가짐 — PHOTO_CHECK mkEnv
        var sa = Math.sqrt(env.a2) * M.skullIn, sb = Math.sqrt(env.b2) * M.skullIn, sc = Math.sqrt(env.c2) * M.skullIn, yy = y - env.CY;
        var A2 = wx * wx / (sa * sa) + wy * wy / (sb * sb) + wz * wz / (sc * sc);
        var B2 = 2 * (x * wx / (sa * sa) + yy * wy / (sb * sb) + z * wz / (sc * sc));
        var C2 = x * x / (sa * sa) + yy * yy / (sb * sb) + z * z / (sc * sc) - 1, D2 = B2 * B2 - 4 * A2 * C2;
        if (A2 > 1e-12 && D2 > 0) { var te = (-B2 + Math.sqrt(D2)) / (2 * A2); if (te > 0 && te > m) { m = te; st.skullPts = (st.skullPts || 0) + 1; } }
      }
      return m;
    }

    function skullBlocks(wx, wy, wz, x, y, z) {   // (2026-11-09) 두상 규칙은 bodyVeto로 안 풂 — 이 깊이가 머리통 속·뒤면 true
      if (!M.skull || !env || !(env.a2 > 0)) return false;
      var sa = Math.sqrt(env.a2) * M.skullIn, sb = Math.sqrt(env.b2) * M.skullIn, sc = Math.sqrt(env.c2) * M.skullIn, yy = y - env.CY;
      var A2 = wx * wx / (sa * sa) + wy * wy / (sb * sb) + wz * wz / (sc * sc), B2 = 2 * (x * wx / (sa * sa) + yy * wy / (sb * sb) + z * wz / (sc * sc));
      var C2 = x * x / (sa * sa) + yy * yy / (sb * sb) + z * z / (sc * sc) - 1, D2 = B2 * B2 - 4 * A2 * C2;
      return A2 > 1e-12 && D2 > 0 && (-B2 + Math.sqrt(D2)) / (2 * A2) > 0;
    }
    var S = photo.strands, si;
    for (si = 0; si < S.length; si++) {
      var s = S[si]; if (!s || s.mirrored || !s.pts || s.pts.length < 4) continue;
      var own = byAng[s.srcAngle]; if (!own) continue;
      var P = s.pts, n = P.length, R0 = own.R, wx = R0[6], wy = R0[7], wz = R0[8], k, u, it;
      st.strands++;
      var X = new Float64Array(n), Y = new Float64Array(n), Z = new Float64Array(n), t = new Float64Array(n);
      for (k = 0; k < n; k++) { X[k] = P[k].x; Y[k] = P[k].y; Z[k] = P[k].z; }
      var tMin = null, blkB = 0;                 // (2026-11-08b) 몸에 안 가리는 가장 뒤 깊이(점마다)
      if (COLS.length || M.skull) { tMin = new Float64Array(n); for (k = 0; k < n; k++) { tMin[k] = k === 0 ? -Infinity : bodyMin(wx, wy, wz, X[k], Y[k], Z[k]); if (tMin[k] > 0) blkB++; } }
      function tOK(k2, tv) { return !tMin || tv >= tMin[k2]; }
      // ① 결: 마디마다 깊이 변화 δ를 다른 사진 결에 맞춤(최소제곱)
      var dl = new Float64Array(n);
      for (it = 0; it < M.iters; it++) {
        var cum = 0;
        for (k = 1; k < n; k++) {
          var qx = X[k - 1] + t[k - 1] * wx, qy = Y[k - 1] + t[k - 1] * wy, qz = Z[k - 1] + t[k - 1] * wz;
          var px = X[k] + t[k] * wx, py = Y[k] + t[k] * wy, pz = Z[k] + t[k] * wz;
          var dx = px - qx, dy = py - qy, dz = pz - qz, seg = Math.sqrt(dx * dx + dy * dy + dz * dz), num = 0, den = 0;
          for (u = 0; u < cams.length; u++) {
            var c = cams[u]; if (c === own) continue;
            if (!core.project(c, env, (px + qx) / 2, (py + qy) / 2, (pz + qz) / 2, o)) continue;
            if (!(c.smp.at(o[0], o[1]) > 0)) continue;
            var d = c.dirAt(o[0], o[1]); if (!d || !(d[1] >= M.minCoh)) continue;
            var R = c.R, ax = (R[0] * dx + R[1] * dy + R[2] * dz) / c.s, ay = (R[3] * dx + R[4] * dy + R[5] * dz) / c.sy;
            var bx = (R[0] * wx + R[1] * wy + R[2] * wz) / c.s, by = (R[3] * wx + R[4] * wy + R[5] * wz) / c.sy;
            var nx = -Math.sin(d[0]), ny = Math.cos(d[0]), na = nx * ax + ny * ay, nb = nx * bx + ny * by, L2 = ax * ax + ay * ay + 1e-12;
            num += d[1] * na * nb / L2; den += d[1] * nb * nb / L2;
          }
          var del = -num / (den + M.lam), lim = M.maxSlope * seg;
          if (del > lim) del = lim; else if (del < -lim) del = -lim;
          if (k <= Math.max(1, Math.floor(n / 10))) del *= M.rootGrip;
          dl[k] = del;
        }
        for (k = 1; k < n; k++) { cum += dl[k]; t[k] += cum; }   // 마디마다 잰 뒤 한꺼번에(같은 t로 잼)
      }
      // ② 다른 사진들이 머리라고 본 깊이 구간 안에서 가장 가까운 자리
      for (k = 1; k < n; k++) {
        var tPre = t[k];
        if (tMin && t[k] < tMin[k]) t[k] = tMin[k];   // (2026-11-08b) 몸에 가린 깊이에서는 출발하지 않음
        if (okAll(own, X[k] + t[k] * wx, Y[k] + t[k] * wy, Z[k] + t[k] * wz)) continue;
        var best = null, lo = tMin && tMin[k] > -range ? tMin[k] : -range, hi = Math.max(range, lo + range);   // 범위는 몸 앞 자리부터
        for (var j = 1; best == null && j * step <= 2 * (hi - lo); j++) {
          var t1 = t[k] + j * step, t2 = t[k] - j * step;
          if (t1 <= hi && t1 >= lo && okAll(own, X[k] + t1 * wx, Y[k] + t1 * wy, Z[k] + t1 * wz)) best = t1;
          else if (t2 >= lo && t2 <= hi && okAll(own, X[k] + t2 * wx, Y[k] + t2 * wy, Z[k] + t2 * wz)) best = t2;
        }
        if (best != null) t[k] = best;           // 구간이 아예 없으면 결로 정한 깊이 그대로
        /* (2026-11-09) 몸 기둥 앞에 다른 사진이 다 "머리 없음"이라 하면 기둥이 틀린 것 — 사용자: 긴 웨이브 "뻗치는 헤어"
           디버그 0808: 기둥 겉면(몸 앞으로 민 자리)에 놓인 옆 사진 가닥 점의 41%(왼쪽)·25%(오른쪽)가 다른 사진 머리 영역에서 1cm 넘게 밖(전체 4%).
           기둥(목·몸통 타원 · 34×22cm · 어깨 없음)은 어림이라 사진 실루엣 가장자리(등 뒤로 넘어간 머리)를 "몸에 가림"으로 잘못 봄 →
           카메라 쪽으로 평균 10cm 밀려 가슴·어깨 앞 옷 위로 나옴 → 거기는 사람 픽셀이라 마지막 다듬기가 기권해서 남음.
           지금: 몸 앞 구간에 다른 사진이 머리라 한 깊이가 하나도 없고, 밀기 전 깊이는 다른 사진들과 맞으면 → 그 점은 기둥을 안 따름(사진끼리 일치가 기둥 어림보다 먼저).
           되돌리기 MV_DEPTH.bodyVeto=false */
        else if (tMin && M.bodyVeto !== false && tMin[k] > tPre && !skullBlocks(wx, wy, wz, X[k] + tPre * wx, Y[k] + tPre * wy, Z[k] + tPre * wz) && okAll(own, X[k] + tPre * wx, Y[k] + tPre * wy, Z[k] + tPre * wz)) {
          t[k] = tPre; tMin[k] = -Infinity; st.bodyVeto = (st.bodyVeto || 0) + 1;
        }
      }
      if (tMin) { blkB = 0; for (k = 1; k < n; k++) if (tMin[k] > 0) blkB++; }   // (2026-11-09) 기둥을 안 따르기로 한 점은 "몸에 가림"에서 뺌 — 아래 무조건 옮김 조건
      t[0] = 0;
      for (it = 0; it < M.smooth; it++) { var pr = t[0]; for (k = 1; k < n - 1; k++) { var cur = t[k]; t[k] = (pr + 2 * cur + t[k + 1]) / 4; pr = cur; } }
      if (tMin) {                                // (2026-11-08b) 고르기 뒤에도 몸 앞 · 위쪽 마디는 기울기 한도(maxSlope)로 이어 줌(꺾이지 않게 · 뿌리 0은 그대로)
        var bodyHit = false;
        for (k = 1; k < n; k++) if (t[k] < tMin[k]) { t[k] = tMin[k]; bodyHit = true; }
        if (bodyHit) for (k = n - 2; k >= 1; k--) {
          var sg = Math.hypot(X[k + 1] - X[k], Y[k + 1] - Y[k], Z[k + 1] - Z[k]), need = t[k + 1] - M.maxSlope * sg;
          if (t[k] < need) t[k] = need;
        }
      }
      // ③ 다른 사진들과 더 맞을 때만 바꿈(재기만 하는 판정 — 스타일 규칙 아님)
      var Q = new Array(n), mx2 = 0, outB = 0, outA = 0;
      for (k = 0; k < n; k++) { Q[k] = { x: X[k] + t[k] * wx, y: Y[k] + t[k] * wy, z: Z[k] + t[k] * wz }; if (Math.abs(t[k]) > mx2) mx2 = Math.abs(t[k]);
        if (!okAll(own, X[k], Y[k], Z[k])) outB++; if (!okAll(own, Q[k].x, Q[k].y, Q[k].z)) outA++; }
      var gB = grainErr(own, P), gA = grainErr(own, Q), blkA = 0;
      if (tMin) for (k = 1; k < n; k++) if (t[k] < tMin[k] - 1e-9) blkA++;
      st.outB += outB; st.chk += n; st.bodyBlkB += blkB;
      // 몸에 가린 점이 있던 가닥은 그대로 둘 수 없음(사진에 찍혔다는 사실과 어긋남) — 무조건 옮김
      if ((blkB > blkA) || gA.e * Math.max(1, gA.n) + outA <= gB.e * Math.max(1, gB.n) + outB) {
        if (blkB > 0) { st.bodyStrands++; st.bodyPts += blkB; st.bodySum += mx2; }
        st.bodyBlkA += blkA;
        for (k = 0; k < n; k++) { P[k].x = Q[k].x; P[k].y = Q[k].y; P[k].z = Q[k].z; }
        st.moved++; st.pts += n; st.sumMove += mx2; st.outA += outA; st.offA += gA.e; st.offB += gB.e; st.cmp++;
      } else { st.outA += outB; st.bodyBlkA += blkB; }
    }
    st.ms = Math.round(now() - t0); st.cams = cams.map(function (c) { return c.angle; });
    return st;
  }

  M._beforeRegrowBuild = function (photo) {
    var G = W.REGROW;
    if (!M.on) { if (G && prevCopyDepthMid != null) { G.copyDepthMid = prevCopyDepthMid; prevCopyDepthMid = null; } return; }
    if (!photo || !photo.strands || photo._mvDepthDone === photo) return;
    photo._mvDepthDone = photo;
    var r; try { r = run(photo); } catch (e) { r = { err: String(e && e.message || e) }; }
    M.stat = r;
    if (!r.err && r.moved > 0 && G && G.copyDepthMid !== false) { prevCopyDepthMid = G.copyDepthMid; G.copyDepthMid = false; }
    console.log(M.lines().join('\n'));
  };
  M.lines = function () {
    var r = M.stat; if (!r) return [TAG + ' 아직 안 함'];
    if (r.err) return [TAG + ' 건너뜀 — ' + r.err];
    var cm = (function () { try { return modelCmPerUnit(); } catch (e) { return 19; } })();
    return [TAG + ' 사진 ' + r.cams.join(',') + ' · 가닥 ' + r.strands + ' 중 옮김 ' + r.moved + ' · 자기 시선축으로 평균 ' + (r.moved ? (r.sumMove / r.moved * cm).toFixed(1) : '0') + 'cm · ' + r.ms + 'ms',
      '  다른 사진 머리 영역 밖 점 ' + (100 * r.outB / Math.max(1, r.chk)).toFixed(1) + '% → ' + (100 * r.outA / Math.max(1, r.chk)).toFixed(1) + '% · 옮긴 가닥의 다른 사진 결 어긋남(sin² 평균) ' + (r.cmp ? (r.offB / r.cmp).toFixed(3) + ' → ' + (r.offA / r.cmp).toFixed(3) : '-') +
      ' · copyDepthMid ' + (W.REGROW && W.REGROW.copyDepthMid === false ? '끔(이 단계가 대신함)' : '그대로') + ' · 끄기 MV_DEPTH.on=false',
      '  몸에 안 가린 깊이: ' + (!M.body ? '꺼짐' : !r.bodyOn ? '목·몸통 치수 없음(REGROW.bodyDims) — 안 함' :
        '자기 사진 시선이 목·몸통 기둥에 막히던 점 ' + r.bodyBlkB + ' → ' + r.bodyBlkA + ' · 몸 앞으로 옮긴 가닥 ' + r.bodyStrands + '(점 ' + r.bodyPts + ' · 가닥 최대 이동 평균 ' + (r.bodyStrands ? (r.bodySum / r.bodyStrands * cm).toFixed(1) : '0') + 'cm)') + ' (끄기 MV_DEPTH.body=false)' + ' · 몸 앞이 다른 사진들과 안 맞아 기둥을 안 따른 점 ' + (M.bodyVeto === false ? '꺼짐' : (r.bodyVeto || 0)) + ' (되돌리기 MV_DEPTH.bodyVeto=false)' + ' · 머리통 속·뒤라 머리통 앞으로 낸 점 ' + (!M.skull ? '꺼짐' : (r.skullPts || 0)) + ' (끄기 MV_DEPTH.skull=false)'];
  };
  try { console.log(TAG + ' 설치 — 사진 가닥을 자기 시선축으로만 옮겨 다른 사진들의 결·머리 영역에 맞춤 · 끄기 MV_DEPTH.on=false'); } catch (e) {}
  return M;
})();
