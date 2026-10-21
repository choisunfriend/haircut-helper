/* ══════════════════════════════════════════════════════════
   34-read-steps.js — 결 읽기 단계: 최대한 읽고 → 잘못 읽은 걸 건너기·채우기 → 마지막에 양옆과 어긋난 것만 맞춤
   (2026-10-21) 사용자: "판정보다는 일정 구간구간 단위로 읽은 흐름 그대로 그려주자"
                         "가능한 있는 그대로를 읽고, 그대로 그려내는게 뒤에 가서 꼬이지 않는 길"

   원칙: 머리 전체 판정(직모/웨이브/컬) 없음. 그 자리 앞뒤 흐름만 봄.

   ① 건너기 (04 GABOR_ORIENT.refine 바로 뒤)
      결을 따라 걸음. 직전 방향과 tol° 안으로 맞는 칸만 길을 바꿈(관성).
      안 맞는 칸이 나오면 = 끊김 후보로 모으며 휘던 대로 계속 감.
      다시 맞는 칸이 resume px(75%) 이어지면 → 모은 칸은 빛·잡무늬로 끊긴 구간 → 길 방향으로 바로잡음.
      look px를 가도 안 이어지면 → 진짜로 방향이 바뀐 것 → 그 자리 결을 새 방향으로 받아들임(손대지 않음).
      위·아래 양쪽 걸음 모두에서 끊김으로 본 칸만 바로잡음.
      거리(분석 사진 가로 800px 기준): look 40px(≈1.5cm · 미용실 조명 실측 끊김 p95) · resume 13px(≈0.5cm)
   ② 채우기 — 결을 못 읽은 칸(흐림)은 둘레 결(2배각 평균)을 한 칸씩 퍼뜨려 채움(휘어 있으면 휜 대로)
      바로잡은 칸·채운 칸은 결 또렷함을 낮춰(0.35 · 0.2) "추정"으로 남김 → 다시 기르기는 다른 사진이 제대로 읽으면 그쪽을 따름
   ③ 정렬(17b REGROW.alignStrands 앞뒤)
      머리 전체 컬 숫자로 정렬 세기를 줄이던 것(alignCurlOff)을 끔 → 이웃 결 정렬의 "그 자리 이웃 퍼짐" 기준만 남음.
      정렬 전 가닥을 보관(디버그 파일 rg0.*) · 정렬이 바꾼 양을 진단에 한 줄.
   스냅샷: 사진마다 읽은 그대로의 결(angRaw)·바로잡은 표시(est) → 디버그 파일 cam?.angRaw / cam?.est (07b)

   끄기: READ_STEPS.on=false(전부) · .bridge=false · .fill=false · .localAlign=false — 사진을 다시 분석하면 반영
   진단: [결 읽기 단계] 줄
   ══════════════════════════════════════════════════════════ */
var READ_STEPS = (function () {
  'use strict';
  var W = window, TAG = '[결 읽기 단계]';
  var S = Object.assign({
    on: true, bridge: false /* (2026-10-21b) 기본 끔 — 생성·실사 4세트에서 효과 없음(옆 결과 어긋남 그대로~약간 나빠짐). 켜기: 주소 끝 ?rsbridge=1 */, fill: true, localAlign: false /* (2026-10-21f) 기본 끔 — 곱슬도 정렬 세기 1로 펴서 끝이 늘어졌음(정렬 전→후 내려온 높이 5.1→6.2cm). 결 정렬(42번)이 이웃 퍼짐 기준이 될 때까지 예전처럼 · 켜기 ?localalign=1 */, keepSnap: true,
    base: 800,          // 아래 px 값의 기준 가로(분석 사진이 다르면 비례)
    lookPx: 40, resumePx: 13, tol: 25, minCoh: 0.08, inertia: 0.6,
    seedPx: 5, visitCap: 6, maxStepsPx: 1200, majPx: 2.5, fillIters: 120,
    estCohBridge: 0.35, estCohFill: 0.2
  }, W.READ_STEPS || {});
  try { var mQ = /[?&]rsbridge=([01])/.exec(location.search); if (mQ) S.bridge = mQ[1] === '1'; } catch (e) {}
  try { var mL = /[?&]localalign=([01])/.exec(location.search); if (mL) S.localAlign = mL[1] === '1'; } catch (e) {}
  S.byView = {};        // 사진별 스냅샷 {w,h,raw(Int8 ±127=±90°),coh(Uint8),est(Uint8: 0 읽음 1 건넘 2 채움),stats}
  S._view = null;       // 03b가 결을 읽기 직전에 넣어 줌
  S.align = null;       // 직전 정렬 통계
  S.rg0 = null;         // 정렬 전 가닥(디버그 파일용)

  function gblur(src, w, h, sig) {              // 분리 가우시안
    var r = Math.max(1, Math.ceil(2.5 * sig)), k = new Float32Array(2 * r + 1), s = 0, i, x, y;
    for (i = -r; i <= r; i++) { k[i + r] = Math.exp(-i * i / (2 * sig * sig)); s += k[i + r]; } for (i = 0; i < k.length; i++) k[i] /= s;
    var t = new Float32Array(w * h), o = new Float32Array(w * h);
    for (y = 0; y < h; y++) { var row = y * w; for (x = 0; x < w; x++) { var v = 0; for (i = -r; i <= r; i++) { var xx = x + i; if (xx < 0) xx = 0; else if (xx >= w) xx = w - 1; v += k[i + r] * src[row + xx]; } t[row + x] = v; } }
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) { var v2 = 0; for (i = -r; i <= r; i++) { var yy = y + i; if (yy < 0) yy = 0; else if (yy >= h) yy = h - 1; v2 += k[i + r] * t[yy * w + x]; } o[y * w + x] = v2; }
    return o;
  }

  /* ① 건너기 + ② 채우기 — ang(이미지 좌표, 무방향 −π/2..π/2)·coh를 그 자리에서 고침. 돌려줌: est(Uint8) · stats */
  function bridgeFill(ang, coh, mask, w, h) {
    var t0 = performance.now(), N = w * h, k = w / S.base;
    var look = Math.max(4, Math.round(S.lookPx * k)), resume = Math.max(3, Math.round(S.resumePx * k));
    var seed = Math.max(1, Math.round(S.seedPx * k)), maxSteps = Math.round(S.maxStepsPx * k), cosT = Math.cos(S.tol * Math.PI / 180);
    var i, x, y, readable = new Uint8Array(N), CA = new Float32Array(N), SA = new Float32Array(N), hair = 0;
    var wc = new Float32Array(N), ws = new Float32Array(N);
    for (i = 0; i < N; i++) {
      if (!mask[i]) continue; hair++;
      CA[i] = Math.cos(ang[i]); SA[i] = Math.sin(ang[i]);
      if (coh[i] >= S.minCoh) { readable[i] = 1; wc[i] = coh[i] * Math.cos(2 * ang[i]); ws[i] = coh[i] * Math.sin(2 * ang[i]); }
    }
    var est = new Uint8Array(N), st = { hair: hair, breaks: 0, bridgedRuns: 0, turns: 0, bridged: 0, filled: 0, oneSide: 0, look: look, resume: resume, ms: 0 };
    if (!hair) return { est: est, stats: st };
    var mC = null, mS = null;   // 진짜로 방향이 바뀐 자리의 새 방향 = 그 자리 다수 결(좁은 반경)
    if (S.bridge) { mC = gblur(wc, w, h, Math.max(1, S.majPx * k)); mS = gblur(ws, w, h, Math.max(1, S.majPx * k)); }
    var vc = new Float32Array(N), vs = new Float32Array(N), vf = new Uint16Array(N), vb = new Uint16Array(N), visit = new Uint16Array(N);
    var pend = [], resC = [];

    function trace(x0, y0, sgn) {
      var i0 = y0 * w + x0, dx = sgn * CA[i0], dy = sgn * SA[i0], px = x0 + 0.5, py = y0 + 0.5, turn = 0, res = 0, resFail = 0, kk, xi, yi, id, cx, cy, dt, c, s, nx, ny, l, j;
      pend.length = 0; resC.length = 0;
      for (kk = 0; kk < maxSteps; kk++) {
        if (pend.length || res) { c = Math.cos(turn); s = Math.sin(turn); nx = dx * c - dy * s; dy = dx * s + dy * c; dx = nx; }
        px += dx; py += dy; xi = px | 0; yi = py | 0;
        if (xi < 0 || yi < 0 || xi >= w || yi >= h) return;
        id = yi * w + xi; if (!mask[id]) return;
        if (visit[id] < 65535) visit[id]++;
        if (visit[id] > S.visitCap && !pend.length && !res) return;   // 이미 충분히 지나간 자리 — 같은 투표 반복 안 함
        var agree = false;
        if (readable[id]) { cx = CA[id]; cy = SA[id]; dt = cx * dx + cy * dy; if (dt < 0) { cx = -cx; cy = -cy; dt = -dt; } agree = dt >= cosT; }
        if (agree) {
          if (pend.length) {                                   // 끊긴 뒤 다시 맞음 — 이어지는지 확인 중
            res++; resC.push(id);
            if (res >= resume) {                               // 이어짐 → 모은 칸 = 끊김
              for (j = 0; j < pend.length; j += 3) {
                var pid = pend[j], a2 = 2 * Math.atan2(pend[j + 2], pend[j + 1]);
                vc[pid] += Math.cos(a2); vs[pid] += Math.sin(a2);
                if (sgn > 0) { if (vf[pid] < 65535) vf[pid]++; } else { if (vb[pid] < 65535) vb[pid]++; }
              }
              st.bridgedRuns++; pend.length = 0; resC.length = 0; res = 0; resFail = 0;
            }
            continue;                                          // 확인 중에는 휘던 대로
          }
          nx = S.inertia * dx + (1 - S.inertia) * cx; ny = S.inertia * dy + (1 - S.inertia) * cy; l = Math.hypot(nx, ny); nx /= l; ny /= l;
          var tt = Math.atan2(dx * ny - dy * nx, dx * nx + dy * ny); turn = 0.7 * turn + 0.3 * tt;
          dx = nx; dy = ny;
        } else {
          if (res) {                                           // 확인 중 또 어긋남
            resFail++;
            if (resFail > resume * 0.25) { for (j = 0; j < resC.length; j++) pend.push(resC[j], dx, dy); res = 0; resFail = 0; resC.length = 0; }
            continue;
          }
          if (!pend.length) st.breaks++;
          pend.push(id, dx, dy);
          if (pend.length / 3 > look) {                        // 길게 안 이어짐 → 진짜 방향 변화
            st.turns++;
            var p0 = pend[0], x1 = p0 % w, y1 = (p0 / w) | 0, aa = 0.5 * Math.atan2(mS[p0], mC[p0]);
            nx = Math.cos(aa); ny = Math.sin(aa); if (nx * dx + ny * dy < 0) { nx = -nx; ny = -ny; }
            px = x1 + 0.5; py = y1 + 0.5; dx = nx; dy = ny; turn = 0; pend.length = 0;
          }
        }
      }
    }
    if (S.bridge) {
      for (y = 0; y < h; y += seed) for (x = 0; x < w; x += seed) {
        i = y * w + x; if (!readable[i] || visit[i] >= 2) continue;
        trace(x, y, 1); trace(x, y, -1);
      }
      for (i = 0; i < N; i++) {
        if (!mask[i]) continue;
        if (vf[i] > 0 && vb[i] > 0) { ang[i] = 0.5 * Math.atan2(vs[i], vc[i]); if (coh[i] > S.estCohBridge) coh[i] = S.estCohBridge; est[i] = 1; st.bridged++; }
        else if (vf[i] > 0 || vb[i] > 0) st.oneSide++;
      }
    }
    if (S.fill) {                                              // ② 못 읽은 칸 채우기
      var C = new Float32Array(N), Sn = new Float32Array(N), known = new Uint8Array(N), todo = [], it;
      for (i = 0; i < N; i++) { if (!mask[i]) continue; if (readable[i] || est[i]) { known[i] = 1; C[i] = Math.cos(2 * ang[i]); Sn[i] = Math.sin(2 * ang[i]); } else todo.push(i); }
      for (it = 0; it < S.fillIters && todo.length; it++) {
        var next = [], add = [], q;
        for (q = 0; q < todo.length; q++) {
          i = todo[q]; x = i % w; y = (i / w) | 0; var sc = 0, ss = 0, n = 0, ddx, ddy;
          for (ddy = -1; ddy <= 1; ddy++) for (ddx = -1; ddx <= 1; ddx++) {
            var xx = x + ddx, yy = y + ddy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
            var j2 = yy * w + xx; if (known[j2]) { sc += C[j2]; ss += Sn[j2]; n++; }
          }
          if (n) add.push(i, sc / n, ss / n); else next.push(i);
        }
        for (q = 0; q < add.length; q += 3) { i = add[q]; C[i] = add[q + 1]; Sn[i] = add[q + 2]; known[i] = 1; ang[i] = 0.5 * Math.atan2(Sn[i], C[i]); coh[i] = S.estCohFill; est[i] = 2; st.filled++; }
        todo = next;
      }
    }
    st.ms = Math.round(performance.now() - t0);
    return { est: est, stats: st };
  }

  /* 04 GABOR_ORIENT.refine 뒤에 끼움 */
  function install04() {
    var GO = W.GABOR_ORIENT; if (!GO || GO._rsWrapped) return !!GO;
    var orig = GO.refine;
    GO.refine = function (f, px, mask, Wd, Hd) {
      var stA = null, stC = null, cmp = null;
      try { if (S.on && f && f.angle && mask) { stA = new Float32Array(f.angle); stC = new Float32Array(f.coherence); } } catch (e) {}   // 들어올 때 = 구조텐서
      var r = orig.apply(this, arguments);
      if (stA) {
        try {
          var ok = GO.lastWH && GO.lastWH[0] === Wd && GO.lastWH[1] === Hd, gbA = ok ? GO.lastAng : null, gbC = ok ? GO.lastConf : null, shGB = GO.last && GO.last.shape;
          cmp = compareBoth(stA, stC, gbA, gbC, mask, Wd, Hd, shGB);
          if (S.orient === 'st') { f.angle.set(stA); GO.last = { w: Wd, h: Hd, shape: cmp._shST, by: 'structure-tensor' }; }   // 다시 기르기·컬 재기에는 구조텐서
          if (S.orient === 'mix' && px) {                                   // 자리마다 사진에 가장 맞는 결
            var mx = mixField(px, mask, Wd, Hd, stA, gbA);
            f.angle.set(mx.angle); cmp.mix = mx.stats;
            try { var shM = shapeOf(mx.angle, mask, Wd, Hd, 6); try { if (typeof GO.bigWaveOf === 'function') shM.big = GO.bigWaveOf(mx.angle, mask, Wd, Hd, 6); } catch (e4) {} GO.last = { w: Wd, h: Hd, shape: shM, by: 'mix' }; cmp.shapeMix = shapeSum(shM); if (shM.big) cmp.shapeMix.big = { lines: shM.big.lines, share: shM.big.share, lamPx: shM.big.lamPx, ampPx: shM.big.ampPx }; } catch (e) {}   // (2026-10-21k) 큰 물결도(04 bigWaveOf)
          }
          if (S.keepSnap) { var w2 = Math.ceil(Wd / 2), h2 = Math.ceil(Hd / 2); cmp.snap = { w: w2, h: h2, angST: q8a(stA, 0, Wd, Hd, w2, h2), cohST: q8c(stC, Wd, Hd, w2, h2), angGB: gbA ? q8a(gbA, 0, Wd, Hd, w2, h2) : null, cohGB: gbC ? q8c(gbC, Wd, Hd, w2, h2) : null }; }
          delete cmp._shST;
        } catch (e) { cmp = { err: String(e && e.message || e) }; }
      }
      if (!S.on || !f || !f.angle || !mask) return r;
      var view = S._view || ('?' + Wd + 'x' + Hd); S._view = null;
      try {
        var N = Wd * Hd, i, raw = null, rc = null;
        if (S.keepSnap) { raw = new Int8Array(N); rc = new Uint8Array(N); for (i = 0; i < N; i++) { raw[i] = Math.max(-127, Math.min(127, Math.round(f.angle[i] / (Math.PI / 2) * 127))); rc[i] = Math.max(0, Math.min(255, Math.round(f.coherence[i] * 255))); } }
        var o = bridgeFill(f.angle, f.coherence, mask, Wd, Hd);
        f.est = o.est;
        S.byView[view] = { w: Wd, h: Hd, raw: raw, coh: rc, est: o.est, stats: o.stats, cmp: cmp, at: Date.now() };
        var s = o.stats;
        console.log(TAG + ' ' + view + ' ' + Wd + '×' + Hd + ' · 건넘 ' + pct(s.bridged, s.hair) + ' · 채움 ' + pct(s.filled, s.hair) + ' · 끊김 ' + s.breaks + '곳 중 이어져 건넌 ' + s.bridgedRuns + ' · 진짜 꺾임 ' + s.turns + ' · ' + s.ms + 'ms');
      } catch (e) { console.warn(TAG + ' 실패(읽은 그대로 둠)', e); }
      return r;
    };
    GO._rsWrapped = true; return true;
  }

  /* 17b REGROW.alignStrands 앞뒤 — 정렬 전 보관 · 머리 전체 컬로 세기 줄이기 끔 · 바꾼 양 */
  function install17b() {
    var G = W.REGROW; if (!G || typeof G.alignStrands !== 'function' || G._rsWrapped) return !!(G && G._rsWrapped);
    var orig = G.alignStrands;
    G.alignStrands = function (strands, CY, kMul) {
      if (!S.on) return orig.apply(this, arguments);
      var kIn = kMul, before = null;
      try {
        if (S.keepSnap && strands && strands.length) {
          before = new Array(strands.length);
          for (var i = 0; i < strands.length; i++) { var p = strands[i] && strands[i].pts; if (!p) continue; var a = new Float32Array(p.length * 3); for (var j = 0; j < p.length; j++) { a[j * 3] = p[j].x; a[j * 3 + 1] = p[j].y; a[j * 3 + 2] = p[j].z; } before[i] = a; }
        }
      } catch (e) { before = null; }
      if (S.localAlign) kMul = 1;                                // 머리 전체 컬 숫자로 세기를 줄이지 않음 — 이웃 퍼짐 기준만
      var r = orig.call(this, strands, CY, kMul);
      try {
        var segs = 0, moved = 0, rot = [], chS = 0;
        if (before) for (var i2 = 0; i2 < strands.length; i2++) {
          var b = before[i2], p2 = strands[i2] && strands[i2].pts; if (!b || !p2) continue;
          var ch = false, m = Math.min(b.length / 3, p2.length);
          for (var k = 1; k < m; k++) {
            var ax = b[k * 3] - b[k * 3 - 3], ay = b[k * 3 + 1] - b[k * 3 - 2], az = b[k * 3 + 2] - b[k * 3 - 1];
            var bx = p2[k].x - p2[k - 1].x, by = p2[k].y - p2[k - 1].y, bz = p2[k].z - p2[k - 1].z;
            var la = Math.hypot(ax, ay, az), lb = Math.hypot(bx, by, bz); if (!(la > 1e-9 && lb > 1e-9)) continue;
            var d = Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by + az * bz) / (la * lb)))) * 57.2958;
            segs++; if (d > 1) { moved++; ch = true; if (rot.length < 200000) rot.push(d); }
          }
          if (ch || b.length / 3 !== p2.length) chS++;
        }
        rot.sort(function (u, v) { return u - v; });
        S.align = { at: Date.now(), kIn: kIn, kUsed: kMul, strands: strands ? strands.length : 0, changed: chS, segs: segs, moved: moved,
          rotMed: rot.length ? rot[rot.length >> 1] : 0, rotP90: rot.length ? rot[Math.floor(rot.length * 0.9)] : 0 };
        S.rg0 = before;
      } catch (e) { S.align = { err: String(e && e.message || e) }; }
      return r;
    };
    G._rsWrapped = true; return true;
  }

  function pct(a, b) { return b ? (a / b * 100).toFixed(1) + '%' : '-'; }
  S.lines = function () {
    var L = [TAG + ' ' + (S.on ? '켜짐' : '꺼짐') + ' — 결 방향: ' + (S.orient === 'st' ? '구조텐서(?orient=st)' : S.orient === 'mix' ? '자리마다 사진에 가장 맞는 결(기본 · 예전 방식 ?orient=gabor)' : '방향필터(?orient=gabor)') + ' · 최대한 읽기 →건너기 ' + (S.bridge ? '켬' : '끔') + ' · 채우기 ' + (S.fill ? '켬' : '끔') + ' → 정렬(이웃 기준' + (S.localAlign ? '만 · 머리 전체 컬로 세기 안 줄임' : ' + 머리 전체 컬로 세기 줄임(예전)') + ') · 끄기 READ_STEPS.on/bridge/fill/localAlign=false'];
    Object.keys(S.byView).forEach(function (v) {
      var b = S.byView[v], s = b.stats;
      L.push('  ' + v + ' ' + b.w + '×' + b.h + ' · 머리 ' + s.hair + 'px · 건넘 ' + pct(s.bridged, s.hair) + ' · 한쪽에서만 건넘(안 고침) ' + pct(s.oneSide, s.hair) + ' · 채움 ' + pct(s.filled, s.hair) +
        ' · 끊김 ' + s.breaks + '곳 → 이어져 건넌 ' + s.bridgedRuns + ' / 진짜 꺾임 ' + s.turns + ' · 내다봄 ' + s.look + 'px · 확인 ' + s.resume + 'px · ' + s.ms + 'ms');
    });
    try { L.push('  웨이브 배수: ' + (W.READ_SHAPE && W.READ_SHAPE.waveGainAuto === false && !(W.READ_SHAPE.waveGain > 1) ? '꺼짐(읽은 흔들림 그대로 · 켜기 ?wavegain=1)' : '켜짐 ×' + (W.READ_SHAPE ? W.READ_SHAPE.waveGain : '?') + (W.READ_SHAPE && W.READ_SHAPE.waveGainAuto ? '(자동)' : ''))); } catch (e) {}
    var f1 = function (v, k) { return isFinite(v) ? (+v).toFixed(k == null ? 2 : k) : '-'; };
    Object.keys(S.byView).forEach(function (v) {
      var c = S.byView[v].cmp; if (c && c.mix) { var M = c.mix, sm = c.shapeMix || {};
        L.push('  ' + v + ' 자리마다 고른 결(mix) — ' + M.names.map(function (nm, k) { return nm + ' ' + f1(M.picked[k] * 100, 0) + '%'; }).join(' · ') +
          ' · 다 같아 고를 것 없던 칸 ' + f1(M.sameFrac * 100, 0) + '% | 사진과 맞음(고른 칸 기준 · 작을수록 좋음) 고른 결 ' + f1(M.fitBest, 3) + ' vs ' + M.names.map(function (nm, k) { return nm + ' ' + f1(M.fitMean[k], 3); }).join(' · ') +
          ' | 모양 곧은 선 ' + f1(sm.straightFrac * 100, 0) + '% · 진폭 ' + f1(sm.ampPx, 1) + 'px · 파장 ' + f1(sm.lamPx, 1) + 'px' + (sm.big ? ' · 큰 물결 선 ' + f1(sm.big.share * 100, 0) + '% · 파장 ' + f1(sm.big.lamPx, 0) + 'px · 진폭 ' + f1(sm.big.ampPx, 1) + 'px' : '') + ' · ' + M.ms + 'ms'); }
      if (!c || c.err) { if (c && c.err) L.push('  ' + v + ' 두 방식 비교 실패: ' + c.err); return; }
      var a = c.shapeST || {}, b = c.shapeGB || {};
      L.push('  ' + v + ' 구조텐서 vs 방향필터 — 결 방향 차이 중앙 ' + f1(c.dirDiffMed, 1) + '° / p90 ' + f1(c.dirDiffP90, 1) + '° · 15° 안 ' + f1(c.agree15 * 100, 0) + '%' +
        ' | 결 또렷함 평균 ' + f1(c.cohST) + ' vs ' + f1(c.cohGB) + ' (0.6↑ ' + f1(c.cohHiST * 100, 0) + '% vs ' + f1(c.cohHiGB * 100, 0) + '%)' +
        ' | 곧은 선 ' + f1(a.straightFrac * 100, 0) + '% vs ' + f1(b.straightFrac * 100, 0) + '% · 고리 ' + f1(a.loop) + ' vs ' + f1(b.loop) + ' · 파장 ' + f1(a.lamPx, 1) + ' vs ' + f1(b.lamPx, 1) + 'px · 진폭 ' + f1(a.ampPx, 1) + ' vs ' + f1(b.ampPx, 1) + 'px · 컬 수치 ' + f1(a.curlDegPx) + ' vs ' + f1(b.curlDegPx) + '°/px');
    });
    if (!Object.keys(S.byView).length) L.push('  아직 읽은 사진 없음(사진을 분석하면 찍힘)');
    var a = S.align;
    if (a && !a.err) L.push('  정렬: 받은 세기 ×' + (a.kIn == null ? '1' : (+a.kIn).toFixed(2)) + ' → 쓴 세기 ×' + (+a.kUsed || 1).toFixed(2) + ' · 바뀐 가닥 ' + a.changed + '/' + a.strands + '(' + pct(a.changed, a.strands) + ') · 1° 넘게 돌린 마디 ' + pct(a.moved, a.segs) + ' · 돌린 각 중앙값 ' + (+a.rotMed).toFixed(1) + '° / p90 ' + (+a.rotP90).toFixed(1) + '° (정렬 전 가닥은 디버그 파일 rg0.*)');
    else if (a && a.err) L.push('  정렬 통계 실패: ' + a.err);
    else L.push('  정렬: 아직 안 함(다시 기르기 뒤에 찍힘)');
    return L;
  };

  /* (2026-10-21c) 웨이브 배수 끔 — 머리 전체를 웨이브로 판정해 읽은 흔들림을 ×3으로 키우던 것(17b READ_SHAPE).
     직모도 S자로 판정돼 ×3.06이 걸려 지그재그·삐져나온 가닥이 생겼음(사용자 확인). 읽은 흐름 그대로 그림.
     다시 켜기: 주소 끝 ?wavegain=1 */
  /* (2026-10-21d) 읽기 방식 비교 — ?orient=st : 방향필터 완전히 끔(결 방향·컬 수치·웨이브 모양 모두 구조텐서 결)
                                   ?orient=gabor 또는 없음 : 지금처럼 방향필터가 방향을 덮어씀 */
  S.orient = 'mix';   // (2026-10-21h) 기본 = 자리마다 사진에 가장 맞는 결 · 예전 방식 ?orient=gabor · 구조텐서만 ?orient=st
  try { var mO = /[?&]orient=(st|gabor|mix)/.exec(location.search); if (mO) S.orient = mO[1]; } catch (e) {}
  /* (2026-10-21e) 두 방식 나란히 재기 — 사진마다 구조텐서와 방향필터가 결 방향·결 또렷함·컬/웨이브 모양·컬 수치를 각각 잼(둘 다 기록).
     다시 기르기에 넘기는 쪽만 ?orient=로 고름(st = 구조텐서 · 없음 = 방향필터). 모양 재기는 04의 shapeOf를 그대로 옮긴 사본으로 둘 다 같은 계산. */
  var GOx = W.GABOR_ORIENT || { shapeStep: 10, shapeMaxLen: 260, shapeMinLen: 40 };
  // ↓ 04-structure-tensor.js shapeOf 그대로 사본(GO → GOx)
  function shapeOf(ang, mask, Wd, Hd, rr) {
    var st = GOx.shapeStep, lines = [], x0, y0;
    function trace(x, y, sgn) {
      var P = [], pdx = 0, pdy = 0, k;
      for (k = 0; k < GOx.shapeMaxLen; k++) {
        var xi = x | 0, yi = y | 0; if (xi < rr || yi < rr || xi >= Wd - rr || yi >= Hd - rr) break;
        var id = yi * Wd + xi; if (!mask[id]) break;
        var t = ang[id], dx = Math.cos(t), dy = Math.sin(t);
        if (k === 0) { dx *= sgn; dy *= sgn; } else if (dx * pdx + dy * pdy < 0) { dx = -dx; dy = -dy; }
        if (k > 0 && dx * pdx + dy * pdy < 0.5) break;                     // 한 걸음에 60° 넘게 꺾이면(잡음) 멈춤
        P.push(x, y); x += dx; y += dy; pdx = dx; pdy = dy;
      }
      return P;
    }
    for (y0 = st; y0 < Hd - st; y0 += st) for (x0 = st; x0 < Wd - st; x0 += st) {
      if (!mask[y0 * Wd + x0]) continue;
      var a = trace(x0 + 0.5, y0 + 0.5, 1), b = trace(x0 + 0.5, y0 + 0.5, -1), P = [], i;
      for (i = b.length - 2; i >= 2; i -= 2) P.push(b[i], b[i + 1]);
      for (i = 0; i < a.length; i += 2) P.push(a[i], a[i + 1]);
      var n = P.length / 2; if (n < GOx.shapeMinLen) continue;
      // 굽은 각(4px 간격 방향 차)
      var th = [], j; for (j = 4; j < n; j += 2) th.push(Math.atan2(P[j * 2 + 1] - P[(j - 4) * 2 + 1], P[j * 2] - P[(j - 4) * 2]));
      var kap = []; for (j = 1; j < th.length; j++) { var dd = th[j] - th[j - 1]; while (dd > Math.PI) dd -= 2 * Math.PI; while (dd < -Math.PI) dd += 2 * Math.PI; kap.push(dd); }
      var sm = []; for (j = 0; j < kap.length; j++) { var s2 = 0, c2 = 0, q; for (q = Math.max(0, j - 2); q <= Math.min(kap.length - 1, j + 2); q++) { s2 += kap[q]; c2++; } sm.push(s2 / c2); }
      var sAbs = 0, sSig = 0, flips = 0, last = 0; for (j = 0; j < sm.length; j++) { sAbs += Math.abs(sm[j]); sSig += sm[j]; if (Math.abs(sm[j]) > 0.02) { var sg = sm[j] > 0 ? 1 : -1; if (last && sg !== last) flips++; last = sg; } }
      var straight = sAbs < 0.6;
      var curlDp = sm.length ? sAbs * 57.2958 / (sm.length * 2) : NaN;   // (34 추가) 컬 수치: 이 선이 1px당 굽는 각(°/px) — 두 방식을 같은 선 긋기로 비교
      var lam = flips > 0 ? 2 * n / flips : NaN;
      // 진폭: 파장 폭 이동 평균선에서 벗어난 거리
      var amp = NaN; if (isFinite(lam) && lam > 6 && lam < n) { var hw = Math.max(2, Math.round(lam / 2)), devs = []; for (j = hw; j < n - hw; j += 2) { var mx = 0, my = 0, c3 = 0, q2; for (q2 = j - hw; q2 <= j + hw; q2++) { mx += P[q2 * 2]; my += P[q2 * 2 + 1]; c3++; } devs.push(Math.hypot(P[j * 2] - mx / c3, P[j * 2 + 1] - my / c3)); } devs.sort(function (u, v) { return u - v; }); if (devs.length) amp = devs[Math.min(devs.length - 1, Math.floor(devs.length * 0.9))] / 0.988; }   // 90%(사인의 꼭대기 근처) — 뿌리 쪽 곧은 구간에 끌려 작게 재지 않게
      var cyS = 0, cxS = 0; for (j = 0; j < n; j++) { cxS += P[j * 2]; cyS += P[j * 2 + 1]; }
      lines.push({ curl: curlDp, n: n, straight: straight, loop: sAbs > 1e-6 ? Math.abs(sSig) / sAbs : 0, lam: lam, amp: amp, cx: cxS / n, cy: cyS / n });
    }
    function med(a) { a = a.filter(function (v) { return isFinite(v); }).sort(function (u, v) { return u - v; }); return a.length ? a[a.length >> 1] : NaN; }
    var bent = lines.filter(function (l) { return !l.straight; });
    // (2026-10-12i) 중앙값만이 아니라 선 하나하나를 넘김 — [머리 위→아래 자리 0~1, 가로 자리 0~1, 파장px, 진폭px, 고리 정도, 곧은 선이면 1]
    var yMn = Hd, yMx = 0, xMn = Wd, xMx = 0, q3; for (q3 = 0; q3 < Wd * Hd; q3 += 2) if (mask[q3]) { var yy3 = (q3 / Wd) | 0, xx3 = q3 - yy3 * Wd; if (yy3 < yMn) yMn = yy3; if (yy3 > yMx) yMx = yy3; if (xx3 < xMn) xMn = xx3; if (xx3 > xMx) xMx = xx3; }
    var dy3 = Math.max(1, yMx - yMn), dx3 = Math.max(1, xMx - xMn);
    var all = lines.map(function (l) { return [(l.cy - yMn) / dy3, (l.cx - xMn) / dx3, l.lam, l.amp, l.loop, l.straight ? 1 : 0]; });
    return { all: all, hairTopPx: yMn, hairBotPx: yMx, lines: lines.length, bent: bent.length, straightFrac: lines.length ? 1 - bent.length / lines.length : 1,
      loop: med(bent.map(function (l) { return l.loop; })), lamPx: med(bent.map(function (l) { return l.lam; })), ampPx: med(bent.map(function (l) { return l.amp; })),
      curlDegPx: med(lines.map(function (l) { return l.curl; })) };
  }
  /* (2026-10-21g) ?orient=mix — 자리마다 사진에 가장 맞는 결 고르기.
     후보: 구조텐서 7px(04 그대로) · 구조텐서 σ2 · 구조텐서 σ4 · 방향필터.
     판정: 그 방향을 따라 그은 9px 선의 밝기 흔들림 ÷ 수직으로 그은 9px 선의 흔들림 — 작을수록 사진의 결과 맞음(머리카락은 결을 따라 밝기가 이어짐).
     사진 15장(생성 웨이브·직모·곱슬 + 실사)에서 자리마다 고른 결이 네 세트 모두 가장 잘 맞았음(지금 방향필터 대비 5~21%). 결 또렷함은 그대로(다시 기르기 기준값이 그 값에 맞춰져 있음). */
  S.mixLh = 4; S.mixBlock = 3; S.mixSame = 8 * Math.PI / 180;   // 후보가 모두 8° 안이면 판정 생략   // 3×3마다 한 번 고름(속도 · 2×2와 결과 같음) · 1 = 픽셀마다
  function grayOf(px, N) { var g = new Float32Array(N), i, j; for (i = 0, j = 0; i < N; i++, j += 4) g[i] = (0.299 * px[j] + 0.587 * px[j + 1] + 0.114 * px[j + 2]) / 255; return g; }
  function boxH(src, dst, w, h, r) {          // 가로 상자 평균(가장자리는 끝값 반복)
    var n = 2 * r + 1, y, x, row, acc, last;
    for (y = 0; y < h; y++) {
      row = y * w; last = row + w - 1; acc = src[row] * (r + 1);
      for (x = 1; x <= r; x++) acc += src[x < w ? row + x : last];
      for (x = 0; x < w; x++) {
        dst[row + x] = acc / n;
        var xa = x + r + 1, xs = x - r;
        acc += src[xa < w ? row + xa : last] - src[xs > 0 ? row + xs : row];
      }
    }
  }
  function boxV(src, dst, w, h, r) {          // 세로 상자 평균 — 줄 단위로 더해 나감(메모리 순서대로)
    var n = 2 * r + 1, acc = new Float32Array(w), x, y, k, lastRow = (h - 1) * w;
    for (x = 0; x < w; x++) acc[x] = src[x] * (r + 1);
    for (k = 1; k <= r; k++) { var rk = (k < h ? k : h - 1) * w; for (x = 0; x < w; x++) acc[x] += src[rk + x]; }
    for (y = 0; y < h; y++) {
      var row = y * w, ya = y + r + 1, ys = y - r, ra = (ya < h ? ya : h - 1) * w, rs = (ys > 0 ? ys : 0) * w;
      for (x = 0; x < w; x++) { dst[row + x] = acc[x] / n; acc[x] += src[ra + x] - src[rs + x]; }
    }
  }
  function fblur(a, w, h, sig) {           // 상자 흐림 3번 ≈ 가우시안 σ
    var r = Math.max(1, Math.round(Math.sqrt(sig * sig * 4 + 1) / 2 - 0.5 + 0.5)), t = new Float32Array(a.length), o = new Float32Array(a), k;
    r = Math.max(1, Math.round((Math.sqrt(12 * sig * sig / 3 + 1) - 1) / 2));
    for (k = 0; k < 3; k++) { boxH(o, t, w, h, r); boxV(t, o, w, h, r); }
    return o;
  }
  function stAt(g, w, h, sig, pre) {     // 구조텐서(가우시안 창 sig, 미리 흐림 pre) → 결 방향(이미지 좌표, -π/2..π/2)
    var a = pre > 0 ? fblur(g, w, h, pre) : g, N = w * h, gx = new Float32Array(N), gy = new Float32Array(N), x, y, i;
    for (y = 1; y < h - 1; y++) for (x = 1; x < w - 1; x++) {
      i = y * w + x;
      gx[i] = (a[i - w + 1] + 2 * a[i + 1] + a[i + w + 1]) - (a[i - w - 1] + 2 * a[i - 1] + a[i + w - 1]);
      gy[i] = (a[i + w - 1] + 2 * a[i + w] + a[i + w + 1]) - (a[i - w - 1] + 2 * a[i - w] + a[i - w + 1]);
    }
    var J11 = new Float32Array(N), J22 = new Float32Array(N), J12 = new Float32Array(N);
    for (i = 0; i < N; i++) { J11[i] = gx[i] * gx[i]; J22[i] = gy[i] * gy[i]; J12[i] = gx[i] * gy[i]; }
    J11 = fblur(J11, w, h, sig); J22 = fblur(J22, w, h, sig); J12 = fblur(J12, w, h, sig);
    var o = new Float32Array(N);
    for (i = 0; i < N; i++) { var t = 0.5 * Math.atan2(2 * J12[i], J11[i] - J22[i]) + Math.PI / 2; if (t > Math.PI / 2) t -= Math.PI; o[i] = t; }
    return o;
  }
  function bil(g, w, h, x, y) {
    if (x < 0) x = 0; else if (x > w - 1.001) x = w - 1.001; if (y < 0) y = 0; else if (y > h - 1.001) y = h - 1.001;
    var x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, i = y0 * w + x0;
    return (g[i] * (1 - fx) + g[i + 1] * fx) * (1 - fy) + (g[i + w] * (1 - fx) + g[i + w + 1] * fx) * fy;
  }
  function fitAt(g, w, h, x, y, t, Lh) {   // 결 따라 흔들림 ÷ 가로질러 흔들림
    var c = Math.cos(t), s = Math.sin(t), k, pa = bil(g, w, h, x - Lh * c, y - Lh * s), pp = bil(g, w, h, x + Lh * s, y - Lh * c), va = 0, vp = 0, a, p;
    for (k = -Lh + 1; k <= Lh; k++) { a = bil(g, w, h, x + k * c, y + k * s); p = bil(g, w, h, x - k * s, y + k * c); va += Math.abs(a - pa); vp += Math.abs(p - pp); pa = a; pp = p; }
    return va / (vp + 1e-4 * 2 * Lh);
  }
  function mixField(px, mask, Wd, Hd, stA, gbA) {
    var t0 = performance.now(), N = Wd * Hd, g = grayOf(px, N), c2 = stAt(g, Wd, Hd, 2, 0.7), t1 = performance.now(), c4 = stAt(g, Wd, Hd, 4, 1.0), t2 = performance.now(), cands = [stA, c2, c4], names = ['구조텐서7px', '구조텐서σ2', '구조텐서σ4'];
    if (gbA) { cands.push(gbA); names.push('방향필터'); }
    var out = new Float32Array(stA), cnt = new Array(cands.length).fill(0), sum = new Array(cands.length).fill(0), sumBest = 0, n = 0, i, k, Lh = S.mixLh, B = Math.max(1, S.mixBlock | 0), bx, by, dx, dy, same = 0;
    // B×B 칸마다 가운데 픽셀에서 한 번 고르고, 그 칸의 픽셀은 고른 후보의 자기 값을 씀(방향은 픽셀마다 그대로)
    for (by = 0; by < Hd; by += B) for (bx = 0; bx < Wd; bx += B) {
      var cx = Math.min(Wd - 1, bx + (B >> 1)), cy = Math.min(Hd - 1, by + (B >> 1)), ci = cy * Wd + cx;
      if (!mask[ci]) { var found = -1; for (dy = 0; dy < B && found < 0; dy++) for (dx = 0; dx < B; dx++) { var jj = (by + dy) * Wd + bx + dx; if (by + dy < Hd && bx + dx < Wd && mask[jj]) { found = jj; break; } } if (found < 0) continue; ci = found; cx = ci % Wd; cy = (ci / Wd) | 0; }
      var bi = 0, bv = 1e9, v, a0 = cands[0][ci], agreeAll = true;
      for (k = 1; k < cands.length; k++) { var dd = Math.abs(cands[k][ci] - a0); if (dd > Math.PI / 2) dd = Math.PI - dd; if (dd > S.mixSame) { agreeAll = false; break; } }
      if (agreeAll) { same++; for (dy = 0; dy < B; dy++) for (dx = 0; dx < B; dx++) { if (by + dy >= Hd || bx + dx >= Wd) continue; i = (by + dy) * Wd + bx + dx; if (mask[i]) out[i] = cands[0][i]; } continue; }   // 다 같은 방향 — 고를 것 없음(구조텐서 7px 값)
      for (k = 0; k < cands.length; k++) { v = fitAt(g, Wd, Hd, cx, cy, cands[k][ci], Lh); sum[k] += v; if (v < bv) { bv = v; bi = k; } }
      cnt[bi]++; sumBest += bv; n++;
      for (dy = 0; dy < B; dy++) for (dx = 0; dx < B; dx++) { if (by + dy >= Hd || bx + dx >= Wd) continue; i = (by + dy) * Wd + bx + dx; if (mask[i]) out[i] = cands[bi][i]; }
    }
    return { angle: out, stats: { n: n, names: names, picked: cnt.map(function (c) { return n ? c / n : 0; }), fitMean: sum.map(function (v) { return n ? v / n : NaN; }), fitBest: n ? sumBest / n : NaN, sameFrac: (n + same) ? same / (n + same) : 0, ms: Math.round(performance.now() - t0), msParts: [Math.round(t1 - t0), Math.round(t2 - t1), Math.round(performance.now() - t2)] } };
  }
  function shapeSum(sh) { return sh ? { lines: sh.lines, bent: sh.bent, straightFrac: sh.straightFrac, loop: sh.loop, lamPx: sh.lamPx, ampPx: sh.ampPx, curlDegPx: sh.curlDegPx } : null; }
  function q8a(a, N, w, h, w2, h2) { var o = new Int8Array(w2 * h2), x, y; for (y = 0; y < h2; y++) for (x = 0; x < w2; x++) { var v = a[Math.min(h - 1, y * 2) * w + Math.min(w - 1, x * 2)]; while (v > Math.PI / 2) v -= Math.PI; while (v < -Math.PI / 2) v += Math.PI; o[y * w2 + x] = Math.round(v / (Math.PI / 2) * 127); } return o; }
  function q8c(a, w, h, w2, h2) { var o = new Uint8Array(w2 * h2), x, y; for (y = 0; y < h2; y++) for (x = 0; x < w2; x++) o[y * w2 + x] = Math.max(0, Math.min(255, Math.round(a[Math.min(h - 1, y * 2) * w + Math.min(w - 1, x * 2)] * 255))); return o; }
  /* 두 방식 비교 — stA/stC: 구조텐서 방향·또렷함 · gbA/gbC: 방향필터 방향·필터 반응 대비 */
  function compareBoth(stA, stC, gbA, gbC, mask, Wd, Hd, shGB) {
    var N = Wd * Hd, i, d = [], cS = 0, cG = 0, n = 0, agree15 = 0, hiS = 0, hiG = 0;
    for (i = 0; i < N; i++) {
      if (!mask[i]) continue; n++;
      cS += stC[i]; cG += gbC ? gbC[i] : 0; if (stC[i] >= 0.6) hiS++; if (gbC && gbC[i] >= 0.6) hiG++;
      if (gbA) { var dd = Math.abs(stA[i] - gbA[i]) % Math.PI; if (dd > Math.PI / 2) dd = Math.PI - dd; dd *= 57.2958; if ((i & 7) === 0) d.push(dd); if (dd <= 15) agree15++; }
    }
    d.sort(function (a, b) { return a - b; });
    var shST = null, shGB2 = null; try { shST = shapeOf(stA, mask, Wd, Hd, 6); } catch (e) {}
    try { if (gbA) shGB2 = shapeOf(gbA, mask, Wd, Hd, 6); } catch (e) {}   // 같은 사본 계산으로(컬 수치까지) — 04가 잰 값과 같은 계산
    return { n: n, dirDiffMed: d.length ? d[d.length >> 1] : NaN, dirDiffP90: d.length ? d[Math.floor(d.length * 0.9)] : NaN, agree15: n ? agree15 / n : NaN,
      cohST: n ? cS / n : NaN, cohGB: gbC && n ? cG / n : NaN, cohHiST: n ? hiS / n : NaN, cohHiGB: gbC && n ? hiG / n : NaN,
      shapeST: shapeSum(shST), shapeGB: shapeSum(shGB2 || shGB), _shST: shST };
  }
  S.waveGainOff = true;
  try { var mW = /[?&]wavegain=([01])/.exec(location.search); if (mW) S.waveGainOff = mW[1] !== '1'; } catch (e) {}
  function offWaveGain() {
    var RSx = W.READ_SHAPE; if (!RSx) return false;
    if (S.waveGainOff) { RSx.waveGainAuto = false; RSx.waveGain = 1; }
    return true;
  }
  if (!offWaveGain()) { var tw = 0, tmW = setInterval(function () { if (offWaveGain() || ++tw > 50) clearInterval(tmW); }, 200); }

  var ok04 = install04(), ok17 = install17b();
  if (!ok17) { var tries = 0, tm = setInterval(function () { if (install17b() || ++tries > 50) clearInterval(tm); }, 200); }
  console.log(TAG + ' 설치 — 04 결 읽기 뒤 건너기·채우기(' + (ok04 ? '연결' : '04 없음') + ') · 정렬 앞뒤 스냅샷(' + (ok17 ? '연결' : '17b 기다림') + ') · 진단 READ_STEPS.lines()');
  return S;
})();
