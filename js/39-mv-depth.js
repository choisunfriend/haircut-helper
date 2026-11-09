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
    pathFit: true,    // (2026-11-09) ② 깊이 구간을 점마다 따로가 아니라 가닥 한 줄로 고름 — 아래 pathFit
    pathEvery: 2,     // 경로는 점 이만큼마다 재고 사이는 이어 감(빠르게)
    outCost: 1,       // 다른 사진 머리 영역 밖인 점 하나의 값
    keepCost: 0.02,   // ①(결)로 정한 깊이에서 한 칸(stepCm) 멀어질 때마다 ×칸²
    bendCost: 0.05,   // 이웃 점끼리 깊이가 한 칸 바뀔 때마다 ×칸²
    stat: null
  };
  var prevCopyDepthMid = null, prevCopyDepthFit = null;

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
    var o = [0, 0], st = { strands: 0, moved: 0, pts: 0, sumMove: 0, outB: 0, outA: 0, chk: 0, offB: 0, offA: 0, cmp: 0, path: 0, jump: 0 };

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

    /* (2026-11-09) ② 깊이 구간을 가닥 한 줄로 고름 — 사용자: "건너뛰는 걸 왜 해?"
     *  예전 ②: 다른 사진 머리 영역 밖인 점마다 따로, 지금 깊이에서 가장 가까운 "모두 머리" 깊이로 옮김.
     *    다른 사진의 머리 영역이 깊이 방향으로 두 덩어리(귀·목·얼굴로 끊긴 옆 사진 · 어깨 앞/등 뒤)인 자리에서 이웃 점이 서로 다른 덩어리를 골라
     *    한 마디(0.4cm)가 최대 11cm 직선이 됨 — 자기 사진에선 1px도 안 보이는 축이라 3D에서만 바늘로 뻗침.
     *    잰 값(디버그 1021 긴 웨이브 · 1024 짧은 남자): 사진 가닥에서 한 마디 4cm 넘게 건너뛴 자리 2366 · 730 — 100% 자기 시선축 방향.
     *  지금: 점마다 깊이 후보(±rangeCm, stepCm 간격)를 두고 가닥 전체에서 값이 가장 작은 한 줄을 고름(동적계획법).
     *    값 = 다른 사진 머리 영역 밖인 점 수(outCost) + ①(결)로 정한 깊이에서 멀어짐(keepCost) + 이웃 점끼리 깊이 바뀜(bendCost).
     *    이웃 점끼리 깊이 차이는 사진 평면 마디 길이 × maxSlope(최소 한 칸)까지만 — 건너뛸 길 자체가 없음. 뿌리(0번 점)는 제자리(예전과 같음).
     *    두 덩어리 사이에서는 앞이든 뒤든 한쪽을 끝까지 따라가고, 갈아탈 땐 비탈로 넘어감.
     *  끄기 MV_DEPTH.pathFit=false(예전 점마다) */
    function pathFit(own, X, Y, Z, t, n, wx, wy, wz) {
      var J = Math.max(1, Math.round(range / step)), NS = 2 * J + 1, sub = Math.max(1, M.pathEvery | 0), idx = [], k, i, sI, sP;
      var anyOut = false; for (k = 1; k < n; k++) if (!okAll(own, X[k] + t[k] * wx, Y[k] + t[k] * wy, Z[k] + t[k] * wz)) { anyOut = true; break; }
      if (!anyOut) return false;                                            // 다 안이면 ①의 깊이 그대로
      for (k = 0; k < n; k += sub) idx.push(k); if (idx[idx.length - 1] !== n - 1) idx.push(n - 1);
      var m = idx.length, INF = 1e30, C = new Float64Array(m * NS), B = new Int16Array(m * NS);
      for (sI = 0; sI < NS; sI++) C[sI] = sI === J ? 0 : INF;              // 뿌리 = 깊이 0
      for (i = 1; i < m; i++) {
        var k0 = idx[i - 1], k1 = idx[i], dx = X[k1] - X[k0], dy = Y[k1] - Y[k0], dz = Z[k1] - Z[k0], dw = dx * wx + dy * wy + dz * wz;
        var segp = Math.sqrt(Math.max(0, dx * dx + dy * dy + dz * dz - dw * dw)), reach = Math.max(1, Math.floor(M.maxSlope * segp / step + 1e-9));
        for (sI = 0; sI < NS; sI++) {
          var tv = (sI - J) * step, kd = (tv - t[k1]) / step, u = (okAll(own, X[k1] + tv * wx, Y[k1] + tv * wy, Z[k1] + tv * wz) ? 0 : M.outCost) + M.keepCost * kd * kd;
          var best = INF, bs = -1, lo = Math.max(0, sI - reach), hi = Math.min(NS - 1, sI + reach);
          for (sP = lo; sP <= hi; sP++) { var c = C[(i - 1) * NS + sP]; if (c >= INF) continue; c += M.bendCost * (sI - sP) * (sI - sP); if (c < best) { best = c; bs = sP; } }
          C[i * NS + sI] = bs < 0 ? INF : best + u; B[i * NS + sI] = bs;
        }
      }
      var end = -1, ec = INF; for (sI = 0; sI < NS; sI++) if (C[(m - 1) * NS + sI] < ec) { ec = C[(m - 1) * NS + sI]; end = sI; }
      if (end < 0) return false;
      var tS = new Float64Array(m); for (i = m - 1, sI = end; i >= 0; i--) { tS[i] = (sI - J) * step; sI = B[i * NS + sI]; if (sI < 0 && i > 0) return false; }
      for (i = 1; i < m; i++) { var a = idx[i - 1], b = idx[i]; for (k = a; k <= b; k++) t[k] = tS[i - 1] + (tS[i] - tS[i - 1]) * (b > a ? (k - a) / (b - a) : 1); }
      t[0] = 0; return true;
    }
    function bigJumps(P) { var c = 0; for (var k = 1; k < P.length; k++) if (Math.hypot(P[k].x - P[k - 1].x, P[k].y - P[k - 1].y, P[k].z - P[k - 1].z) * env.cm > 4) c++; return c; }
    var S = photo.strands, si;
    for (si = 0; si < S.length; si++) {
      var s = S[si]; if (!s || s.mirrored || !s.pts || s.pts.length < 4) continue;
      var own = byAng[s.srcAngle]; if (!own) continue;
      var P = s.pts, n = P.length, R0 = own.R, wx = R0[6], wy = R0[7], wz = R0[8], k, u, it;
      st.strands++;
      var X = new Float64Array(n), Y = new Float64Array(n), Z = new Float64Array(n), t = new Float64Array(n);
      for (k = 0; k < n; k++) { X[k] = P[k].x; Y[k] = P[k].y; Z[k] = P[k].z; }
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
      // ② 다른 사진들이 머리라고 본 깊이 구간 — pathFit: 가닥 한 줄로(아래) · 끄면 예전처럼 점마다 가장 가까운 자리
      if (M.pathFit) { if (pathFit(own, X, Y, Z, t, n, wx, wy, wz)) st.path++; }
      else for (k = 1; k < n; k++) {
        if (okAll(own, X[k] + t[k] * wx, Y[k] + t[k] * wy, Z[k] + t[k] * wz)) continue;
        var best = null;                         // 지금 깊이에서 가까운 쪽부터 바깥으로
        for (var j = 1; best == null && j * step <= 2 * range; j++) {
          var t1 = t[k] + j * step, t2 = t[k] - j * step;
          if (Math.abs(t1) <= range && okAll(own, X[k] + t1 * wx, Y[k] + t1 * wy, Z[k] + t1 * wz)) best = t1;
          else if (Math.abs(t2) <= range && okAll(own, X[k] + t2 * wx, Y[k] + t2 * wy, Z[k] + t2 * wz)) best = t2;
        }
        if (best != null) t[k] = best;           // 구간이 아예 없으면 결로 정한 깊이 그대로
      }
      t[0] = 0;
      for (it = 0; it < M.smooth; it++) { var pr = t[0]; for (k = 1; k < n - 1; k++) { var cur = t[k]; t[k] = (pr + 2 * cur + t[k + 1]) / 4; pr = cur; } }
      // ③ 다른 사진들과 더 맞을 때만 바꿈(재기만 하는 판정 — 스타일 규칙 아님)
      var Q = new Array(n), mx2 = 0, outB = 0, outA = 0;
      for (k = 0; k < n; k++) { Q[k] = { x: X[k] + t[k] * wx, y: Y[k] + t[k] * wy, z: Z[k] + t[k] * wz }; if (Math.abs(t[k]) > mx2) mx2 = Math.abs(t[k]);
        if (!okAll(own, X[k], Y[k], Z[k])) outB++; if (!okAll(own, Q[k].x, Q[k].y, Q[k].z)) outA++; }
      var gB = grainErr(own, P), gA = grainErr(own, Q);
      st.outB += outB; st.chk += n;
      if (gA.e * Math.max(1, gA.n) + outA <= gB.e * Math.max(1, gB.n) + outB) {
        for (k = 0; k < n; k++) { P[k].x = Q[k].x; P[k].y = Q[k].y; P[k].z = Q[k].z; }
        st.moved++; st.pts += n; st.sumMove += mx2; st.outA += outA; st.offA += gA.e; st.offB += gB.e; st.cmp++;
      } else st.outA += outB;
      st.jump += bigJumps(P);
    }
    st.ms = Math.round(now() - t0); st.cams = cams.map(function (c) { return c.angle; });
    return st;
  }

  M._beforeRegrowBuild = function (photo) {
    var G = W.REGROW;
    if (!M.on) {
      if (G && prevCopyDepthMid != null) { G.copyDepthMid = prevCopyDepthMid; prevCopyDepthMid = null; }
      if (G && prevCopyDepthFit != null) { G.copyDepthFit = prevCopyDepthFit; prevCopyDepthFit = null; }
      return;
    }
    if (!photo || !photo.strands || photo._mvDepthDone === photo) return;
    photo._mvDepthDone = photo;
    var r; try { r = run(photo); } catch (e) { r = { err: String(e && e.message || e) }; }
    M.stat = r;
    if (!r.err && r.moved > 0 && G && G.copyDepthMid !== false) { prevCopyDepthMid = G.copyDepthMid; G.copyDepthMid = false; }
    /* (2026-11-09) 그대로 그리기의 깊이 맞추기(depthFit)도 끔 — 이 단계와 같은 축(자기 시선축)·같은 기준(다른 사진 머리 영역)으로 한 번 더 옮기던 것.
     *  웨이브 1021: 이 단계 뒤에도 점 41,229개를 평균 2cm 더 옮김 · 점마다 따로 정해 뿌리 바로 다음에서 건너뜀(뿌리 → 첫 점 4cm 넘게 3,095개).
     *  깊이는 여기 한 곳에서만 정함. 끄기 MV_DEPTH.ownDepth=false(depthFit 그대로 둠) */
    if (!r.err && r.moved > 0 && G && M.ownDepth !== false && G.copyDepthFit !== false) { prevCopyDepthFit = G.copyDepthFit; G.copyDepthFit = false; }
    console.log(M.lines().join('\n'));
  };
  M.lines = function () {
    var r = M.stat; if (!r) return [TAG + ' 아직 안 함'];
    if (r.err) return [TAG + ' 건너뜀 — ' + r.err];
    var cm = (function () { try { return modelCmPerUnit(); } catch (e) { return 19; } })();
    return [TAG + ' 사진 ' + r.cams.join(',') + ' · 가닥 ' + r.strands + ' 중 옮김 ' + r.moved + ' · 자기 시선축으로 평균 ' + (r.moved ? (r.sumMove / r.moved * cm).toFixed(1) : '0') + 'cm · ' + r.ms + 'ms',
      '  다른 사진 머리 영역 밖 점 ' + (100 * r.outB / Math.max(1, r.chk)).toFixed(1) + '% → ' + (100 * r.outA / Math.max(1, r.chk)).toFixed(1) + '% · 옮긴 가닥의 다른 사진 결 어긋남(sin² 평균) ' + (r.cmp ? (r.offB / r.cmp).toFixed(3) + ' → ' + (r.offA / r.cmp).toFixed(3) : '-') +
      ' · copyDepthMid ' + (W.REGROW && W.REGROW.copyDepthMid === false ? '끔(이 단계가 대신함)' : '그대로') + ' · copyDepthFit ' + (W.REGROW && W.REGROW.copyDepthFit === false ? '끔(이 단계가 대신함 · 되돌리기 MV_DEPTH.ownDepth=false)' : '그대로') + ' · 끄기 MV_DEPTH.on=false',
      '  깊이 구간 고르기: ' + (M.pathFit ? '가닥 한 줄로(동적계획법) — 고른 가닥 ' + (r.path || 0) + ' (끄기 MV_DEPTH.pathFit=false)' : '점마다 따로(예전)') + ' · 끝난 뒤 한 마디 4cm 넘게 건너뛴 자리 ' + (r.jump || 0)];
  };
  try { console.log(TAG + ' 설치 — 사진 가닥을 자기 시선축으로만 옮겨 다른 사진들의 결·머리 영역에 맞춤 · 끄기 MV_DEPTH.on=false'); } catch (e) {}
  return M;
})();
