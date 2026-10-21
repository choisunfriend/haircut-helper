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
    on: true, bridge: false /* (2026-10-21b) 기본 끔 — 생성·실사 4세트에서 효과 없음(옆 결과 어긋남 그대로~약간 나빠짐). 켜기: 주소 끝 ?rsbridge=1 */, fill: true, localAlign: true, keepSnap: true,
    base: 800,          // 아래 px 값의 기준 가로(분석 사진이 다르면 비례)
    lookPx: 40, resumePx: 13, tol: 25, minCoh: 0.08, inertia: 0.6,
    seedPx: 5, visitCap: 6, maxStepsPx: 1200, majPx: 2.5, fillIters: 120,
    estCohBridge: 0.35, estCohFill: 0.2
  }, W.READ_STEPS || {});
  try { var mQ = /[?&]rsbridge=([01])/.exec(location.search); if (mQ) S.bridge = mQ[1] === '1'; } catch (e) {}
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
      var r = orig.apply(this, arguments);
      if (!S.on || !f || !f.angle || !mask) return r;
      var view = S._view || ('?' + Wd + 'x' + Hd); S._view = null;
      try {
        var N = Wd * Hd, i, raw = null, rc = null;
        if (S.keepSnap) { raw = new Int8Array(N); rc = new Uint8Array(N); for (i = 0; i < N; i++) { raw[i] = Math.max(-127, Math.min(127, Math.round(f.angle[i] / (Math.PI / 2) * 127))); rc[i] = Math.max(0, Math.min(255, Math.round(f.coherence[i] * 255))); } }
        var o = bridgeFill(f.angle, f.coherence, mask, Wd, Hd);
        f.est = o.est;
        S.byView[view] = { w: Wd, h: Hd, raw: raw, coh: rc, est: o.est, stats: o.stats, at: Date.now() };
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
    var L = [TAG + ' ' + (S.on ? '켜짐' : '꺼짐') + ' — 최대한 읽기 → 건너기 ' + (S.bridge ? '켬' : '끔') + ' · 채우기 ' + (S.fill ? '켬' : '끔') + ' → 정렬(이웃 기준' + (S.localAlign ? '만 · 머리 전체 컬로 세기 안 줄임' : ' + 머리 전체 컬로 세기 줄임(예전)') + ') · 끄기 READ_STEPS.on/bridge/fill/localAlign=false'];
    Object.keys(S.byView).forEach(function (v) {
      var b = S.byView[v], s = b.stats;
      L.push('  ' + v + ' ' + b.w + '×' + b.h + ' · 머리 ' + s.hair + 'px · 건넘 ' + pct(s.bridged, s.hair) + ' · 한쪽에서만 건넘(안 고침) ' + pct(s.oneSide, s.hair) + ' · 채움 ' + pct(s.filled, s.hair) +
        ' · 끊김 ' + s.breaks + '곳 → 이어져 건넌 ' + s.bridgedRuns + ' / 진짜 꺾임 ' + s.turns + ' · 내다봄 ' + s.look + 'px · 확인 ' + s.resume + 'px · ' + s.ms + 'ms');
    });
    try { L.push('  웨이브 배수: ' + (W.READ_SHAPE && W.READ_SHAPE.waveGainAuto === false && !(W.READ_SHAPE.waveGain > 1) ? '꺼짐(읽은 흔들림 그대로 · 켜기 ?wavegain=1)' : '켜짐 ×' + (W.READ_SHAPE ? W.READ_SHAPE.waveGain : '?') + (W.READ_SHAPE && W.READ_SHAPE.waveGainAuto ? '(자동)' : ''))); } catch (e) {}
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
