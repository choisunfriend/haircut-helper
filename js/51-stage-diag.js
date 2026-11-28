/* ==========================================================================
 * 51-stage-diag.js — STAGE_DIAG (2026-11-28) 단계별 좌표 진단: 어느 단계에서 사진 자리가 틀어지나
 *
 * 왜 (사용자): "정렬하는 여러 단계와 그리는 단계까지 많은 단계를 거치는데, 그 과정에 제대로 된 위치가
 *   훼손될 수 있단 말이야 … 사진맞추기나 카메라 한번 맞춘 상태에서의 좌표값들이 정확할 수도 있다는 거지."
 *
 * 무엇: 같은 손님의 가닥을 단계마다 꺼내 <b>사진마다 그 카메라로 되쏘아</b> 사진과 비교합니다.
 *   단계  lift   — 중립 모델(state.hair3Dneutral) = 사진 가닥을 3D로 올린 직후(결 정렬·다듬기·겹침 정리 포함)
 *         geom-noclip — 시술 기하 직후, 조정 후 재클립(사진 머리 영역 밖 자르기) 전
 *         geom   — 시술 기하(adjustStrandGeom: 펴기·길이·컬·볼륨…) 직후
 *         core   — 마감 일부(땋기·광택) 직후
 *         final  — 화면에 그리는 최종(어깨·몸통·얼굴 비키기·빗질·원본 대조 모두 지난 뒤)
 *         final@draw — final 을 <b>그릴 때 쓰는 카메라</b>(calForDraw: 옆 yaw 보정·가로 밀기)로 되쏜 것
 *   숫자(사진마다 · 자기 사진 = 그 가닥을 읽은 사진, 다른 사진 = 카메라를 향한 쪽 점만)
 *         밖%   — 사진의 머리 영역(03a reasonMask) 밖에 떨어진 점
 *         거리  — 가장 가까운 <b>사진 가닥 점</b>까지 px(중앙값 · 90%) · 40px 넘으면 40으로 셈
 *         결°   — 그 자리 사진 가닥 방향과의 차이(0~90° · 중앙값)
 *   자기 사진 숫자가 lift → final 로 가며 커지면 그 사이 단계가 사진 자리를 망가뜨린 것.
 *   다른 사진 숫자가 lift 부터 크면 깊이(사진 한 장으로는 모르는 축)를 잘못 넣은 것(39 MV_DEPTH 몫).
 *   스타일을 안 건 상태(스타일 미적용)에서 재야 "시술이라서 바뀐 것"과 "망가진 것"이 섞이지 않습니다.
 *
 * 쓰는 법(3D 결과가 나온 뒤 콘솔):
 *   STAGE_DIAG.run()          → 표 출력 · STAGE_DIAG.last 에 숫자
 *   STAGE_DIAG.csv()          → 점 하나당 한 줄 CSV 내려받기(stage,view,own,strand,pt,x,y,z,ix,iy,inMask,nearPx,dirDeg)
 *   STAGE_DIAG.maxRows = 150000  CSV 줄 상한(넘으면 가닥을 건너뛰며 담음)
 * 계산만 합니다 — 모델·화면은 바꾸지 않습니다(각 단계 함수를 한 번씩 다시 부름 · 수 초 걸릴 수 있음).
 * ========================================================================== */
/* ==========================================================================
 * STAGE_TAG (2026-11-28) 점 꼬리표 — 3D 점마다 "어느 사진 · 몇 번째 가닥 · 몇 번째 점"에서 왔는지
 *   사용자: "점을 고칠 때 새로 만들지 말고 … 좌표 추가하고 빼는 방식으로 해서 꼬리표를 살려 가면 되잖아."
 *   붙이는 곳: 13c buildHairStrandsFromPaths(사진 가닥을 3D로 올리는 그 점) · 넘기는 곳: 13b 결 정렬 …(하나씩 늘림)
 *   규칙: 점을 옮기거나 새로 찍는 단계는 원래 점의 t 를 그대로 넘긴다. 사이에 끼운 점은 가까운 쪽 t, 사진에 없던 점은 t 없음.
 *   ⚠ 모델 점을 그 자리에서 고치지(덮어쓰지) 않는다 — 중립 모델은 슬라이더를 움직일 때마다 다시 쓰는 원료라,
 *     덮어쓰면 시술이 틱마다 겹쳐 쌓인다. 새 점을 만들되 t 를 넘겨받는 것이 "꼬리표를 살려 가는" 방법이다.
 *   값: 뷰번호×1e8 + (fine?5e7:0) + 가닥번호×1000 + 점번호   (가닥 < 5만 · 점 < 1000)
 * ========================================================================== */
var STAGE_TAG = (function () {
  'use strict';
  var T = { on: true, views: [], lifted: null };
  T.make = function (angle, si, i, fine) {
    if (i >= 1000 || si >= 50000) return undefined;
    var vi = T.views.indexOf(angle); if (vi < 0) { T.views.push(angle); vi = T.views.length - 1; }
    return vi * 1e8 + (fine ? 5e7 : 0) + si * 1000 + i;
  };
  T.decode = function (t) {
    if (typeof t !== 'number' || !isFinite(t)) return null;
    var vi = Math.floor(t / 1e8), r = t - vi * 1e8, fine = r >= 5e7; if (fine) r -= 5e7;
    return { angle: T.views[vi], si: Math.floor(r / 1000), i: Math.round(r % 1000), fine: fine };
  };
  /* 그 점이 원래 있던 사진 자리(px) */
  T.imgOf = function (t) {
    var d = T.decode(t); if (!d || !d.angle) return null;
    var paths = (state.neutralStrandPaths && state.neutralStrandPaths[d.angle]) ? state.neutralStrandPaths : state.strandPaths;
    var rec = paths && paths[d.angle], st = rec && rec.strands && rec.strands[d.si]; if (!st) return null;
    var P = d.fine ? st.fine : st.pts, p = P && P[d.i];
    return p ? { angle: d.angle, x: p.x, y: p.y } : null;
  };

  /* (2026-11-28b) 꼬리표 이어 주기 — 디버그 2248: lift 100% → 다시 기른 가닥(rg) 0.006% · 화면(draw) 0.005%.
   *   다시 기르기의 옮겨 그리기(copyFromStrands)는 t 를 넘겼지만, 그 뒤 가닥마다 거는 잔결 걷어내기(denoiseStrand)·
   *   마지막 다듬기(finalClip: 눕히기·낮추기·가시 눕히기)·깊이 고르게가 점을 <b>새로 만들며</b> t 를 버렸다.
   *   조정 단계(adjustStrandGeom·어깨·몸통·얼굴 비키기…)도 같다. 단계마다 고치는 대신 단계 <b>경계</b>에서 이어 준다.
   *   규칙: 점 수가 같으면 같은 번호 · 다르면 뿌리에서 잰 호길이가 같은 자리(앞 가닥 길이를 넘은 점 = 새로 기른 점 = 꼬리표 없음).
   *   이미 t 가 있는 점은 안 건드림 · 원래 점 객체는 안 바꿈(조각·캐시를 같이 쓰는 점이 있어 새 객체로 바꿔 끼움).
   *   끄기 STAGE_TAG.carryOn=false */
  T.carryOn = true;
  function arcs(P) { var a = new Float64Array(P.length), i; for (i = 1; i < P.length; i++) a[i] = a[i - 1] + Math.hypot(P[i].x - P[i - 1].x, P[i].y - P[i - 1].y, P[i].z - P[i - 1].z); return a; }
  T.carry = function (src, dst, mode) {
    if (!T.on || !T.carryOn || !src || !dst || src === dst || !src.length || !dst.length) return dst;
    var anySrc = false, i; for (i = 0; i < src.length; i++) if (src[i] && src[i].t !== undefined) { anySrc = true; break; }
    if (!anySrc) return dst;
    var out = null, byIdx = mode === 'index' || (mode !== 'arc' && src.length === dst.length), aS = null, aD = null, j = 0, tol = 0;
    if (!byIdx) { aS = arcs(src); aD = arcs(dst); tol = src.length > 1 ? 0.75 * aS[aS.length - 1] / (src.length - 1) : 0; }
    for (i = 0; i < dst.length; i++) {
      var q = dst[i]; if (!q || q.t !== undefined) continue;
      var s = null;
      if (byIdx) { if (i < src.length) s = src[i]; }
      else {
        var sd = aD[i]; if (sd > aS[aS.length - 1] + tol) continue;         // 앞 가닥보다 길어진 자리 — 사진에 없던 점
        while (j < aS.length - 1 && Math.abs(aS[j + 1] - sd) <= Math.abs(aS[j] - sd)) j++;
        s = src[j];
      }
      if (!s || s.t === undefined) continue;
      if (!out) { out = dst.slice(); for (var k in dst) if (!/^\d+$/.test(k)) out[k] = dst[k]; }   // _rgKeep 같은 꼬리 속성도
      out[i] = Object.assign({}, q, { t: s.t });
    }
    return out || dst;
  };
  /* 가닥 목록 → 가닥 목록 단계(같은 순서·같은 수일 때만) */
  T.carryList = function (prev, next) {
    if (!T.on || !T.carryOn || !prev || !next || prev === next || prev.length !== next.length) return next;
    for (var i = 0; i < next.length; i++) {
      var a = prev[i], b = next[i]; if (!a || !b || !a.pts || !b.pts || a.pts === b.pts) continue;
      var np = T.carry(a.pts, b.pts); if (np !== b.pts) { if (b === a) b = next[i] = Object.assign({}, b); b.pts = np; }
    }
    return next;
  };
  /* 단계별 꼬리표 남은% 기록 — 어느 단계에서 떨어지는지(진단 패널 · 콘솔 STAGE_TAG.trailLines()) */
  T.trail = {};
  T.audit = function (name, list) {
    if (!T.on || !list) return list;
    var n = 0, h = 0, i, k, P;
    for (i = 0; i < list.length; i += 3) { P = list[i] && (list[i].pts || list[i]); if (!P || !P.length) continue; for (k = 0; k < P.length; k++) { n++; if (P[k] && P[k].t !== undefined) h++; } }
    T.trail[name] = { n: n, pct: n ? 100 * h / n : NaN, strands: list.length };
    return list;
  };
  T.trailLines = function () {
    var L = ['[꼬리표·단계] 남은% (가닥 셋에 하나 표본)'];
    Object.keys(T.trail).forEach(function (k) { var r = T.trail[k]; L.push('  ' + k + ': ' + (isFinite(r.pct) ? r.pct.toFixed(1) : '-') + '% · 가닥 ' + r.strands + ' · 점 ' + r.n); });
    return L;
  };
  return T;
})();

var STAGE_DIAG = (function () {
  'use strict';
  var W = window, TAG = '[단계 진단]';
  var D = {
    on: true,
    capPx: 40,        // 가까운 사진 가닥을 찾는 최대 거리(px)
    cell: 8,          // 찾기 칸 크기(px)
    facingMin: -0.15, // 다른 사진: 카메라를 향한 정도(cos)가 이 이상인 점만
    maxRows: 150000,
    last: null,
  };

  function paths() { return state.neutralStrandPaths || state.strandPaths || {}; }   // 3D의 원료(중립 캡처) — 화면용 경로가 아님
  function views() {
    var sp = paths(), hm = state.hairMasks || {}, out = [];
    Object.keys(sp).forEach(function (a) {
      var rec = sp[a], m = hm[a];
      if (rec && rec.strands && rec.strands.length && m && m.reasonMask && m.w) out.push(a);
    });
    return out;
  }

  /* 사진 가닥 점 → 칸 격자(점 좌표 + 그 점의 결 방향) */
  function photoGrid(angle) {
    var rec = paths()[angle], m = state.hairMasks[angle], C = D.cell;
    var gw = Math.ceil(m.w / C) + 1, gh = Math.ceil(m.h / C) + 1, cells = new Map();
    rec.strands.forEach(function (st) {
      var P = (st.fine && st.fine.length >= 2) ? st.fine : st.pts;
      if (!P || P.length < 2) return;
      for (var i = 0; i < P.length; i++) {
        var a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)];
        var dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
        var k = Math.floor(P[i].y / C) * gw + Math.floor(P[i].x / C);
        var arr = cells.get(k); if (!arr) cells.set(k, arr = []);
        arr.push(P[i].x, P[i].y, dx / l, dy / l);
      }
    });
    return { cells: cells, gw: gw, gh: gh, m: m };
  }
  function nearest(g, x, y) {
    var C = D.cell, cx = Math.floor(x / C), cy = Math.floor(y / C), R = Math.ceil(D.capPx / C);
    var best = D.capPx * D.capPx, bd = null;
    for (var r = 0; r <= R; r++) {
      for (var j = cy - r; j <= cy + r; j++) for (var i = cx - r; i <= cx + r; i++) {
        if (Math.max(Math.abs(i - cx), Math.abs(j - cy)) !== r || i < 0 || j < 0 || i >= g.gw || j >= g.gh) continue;
        var arr = g.cells.get(j * g.gw + i); if (!arr) continue;
        for (var q = 0; q < arr.length; q += 4) {
          var d2 = (arr[q] - x) * (arr[q] - x) + (arr[q + 1] - y) * (arr[q + 1] - y);
          if (d2 < best) { best = d2; bd = [arr[q + 2], arr[q + 3]]; }
        }
      }
      if (bd && (r * C) * (r * C) > best) break;   // 더 바깥 칸은 더 가까울 수 없음
    }
    return { d: Math.sqrt(best), dir: bd };
  }
  function inMask(m, ix, iy) {
    var mx = Math.floor(ix * m.maskW / m.w), my = Math.floor(iy * m.maskH / m.h);
    if (mx < 0 || my < 0 || mx >= m.maskW || my >= m.maskH) return 0;
    return m.reasonMask[my * m.maskW + mx] === 1 ? 1 : 0;
  }
  function median(a) { if (!a.length) return NaN; a.sort(function (x, y) { return x - y; }); return a[Math.floor(a.length / 2)]; }
  function pct(a, p) { if (!a.length) return NaN; return a[Math.min(a.length - 1, Math.floor(a.length * p))]; }

  function stages(model) {
    var S = [];
    if (STAGE_TAG.lifted && STAGE_TAG.lifted.length) S.push(['lift0', STAGE_TAG.lifted, false]);   // 올린 직후(다시 기르기 전)
    S.push(['lift', model.strands, false]);
    var g = function (name, fn, draw) { try { var r = fn(); if (r && r.length) S.push([name, r, draw]); } catch (e) { console.warn(TAG + ' ' + name + ' 단계 실패', e); } };
    /* (2026-11-28) 재클립 전 — 조정 후 재클립(17b HAIR_OCC3D.clipAdjusted)만 잠깐 끄고 같은 계산. 캐시는 잠깐 끔(재클립 여부가 서명에 없음) */
    if (typeof _adjGeometry === 'function' && typeof HAIR_OCC3D !== 'undefined' && HAIR_OCC3D.clipAdjusted) {
      var oc = HAIR_OCC3D.clipAdjusted, ca = (typeof ADJ_CACHE !== 'undefined') ? ADJ_CACHE.on : null, keepClip = D.lastClip;
      try { HAIR_OCC3D.clipAdjusted = false; if (ca !== null) ADJ_CACHE.on = false; g('geom-noclip', function () { return _adjGeometry(null, 1); }); }
      finally { HAIR_OCC3D.clipAdjusted = oc; if (ca !== null) ADJ_CACHE.on = ca; D.lastClip = keepClip; }
    }
    if (typeof _adjGeometry === 'function') g('geom', function () { return _adjGeometry(null, 1); });
    if (typeof _adjComputeCore === 'function') g('core', function () { return _adjComputeCore(null, 1); });
    if (typeof computeAdjustedHair3DStrands === 'function') {
      var fin = null;
      g('final', function () { return (fin = computeAdjustedHair3DStrands(null, 1)); });
      if (fin && fin.length) S.push(['final@draw', fin, true]);
    }
    return S;
  }

  /* 한 단계 × 한 사진. rows 가 있으면 CSV 줄을 쌓음 */
  function measure(stageName, strands, angle, model, g, useDraw, rows, every) {
    var cal = useDraw && typeof calForDraw === 'function' ? calForDraw(model, angle) : (model.viewCal && model.viewCal[angle]);
    if (!cal) return null;
    var R = composeRotationZYX(cal.yaw, cal.pitch || 0, cal.roll || 0), CY = model.CY;
    var acc = { own: { n: 0, out: 0, d: [], dir: [] }, other: { n: 0, out: 0, d: [], dir: [] } }, tg = { n: 0, has: 0, d: [] };
    for (var si = 0; si < strands.length; si++) {
      var st = strands[si], P = st.pts; if (!P || P.length < 2) continue;
      var own = st.srcAngle === angle && !st.mirrored, A = own ? acc.own : acc.other;
      var keep = rows && si % every === 0;
      var prev = null;
      for (var i = 0; i < P.length; i++) {
        var p = P[i];
        if (!own) {   // 다른 사진: 카메라를 향한 쪽만(뒤통수가 얼굴 위로 비치지 않게)
          var lz = R[6] * p.x + R[7] * (p.y - CY) + R[8] * p.z, rr = Math.hypot(p.x, p.y - CY, p.z) || 1;
          if (lz / rr < D.facingMin) { prev = null; continue; }
        }
        var pr = project3DPointToView(p, cal, model.yTop, CY);
        /* 꼬리표: 이 사진에서 온 점이면 <b>제 원래 사진 점</b>까지의 거리(가장 가까운 아무 가닥이 아니라) */
        var src = null;
        if (own) { tg.n++; if (p.t !== undefined) { tg.has++; src = STAGE_TAG.imgOf(p.t); if (src && src.angle === angle) tg.d.push(Math.hypot(pr.ix - src.x, pr.iy - src.y)); else src = null; } }
        var im = inMask(g.m, pr.ix, pr.iy), nb = nearest(g, pr.ix, pr.iy), dd = null;
        if (prev && nb.dir) {
          var vx = pr.ix - prev.ix, vy = pr.iy - prev.iy, l = Math.hypot(vx, vy);
          if (l > 0.5) { var c = Math.abs((vx * nb.dir[0] + vy * nb.dir[1]) / l); dd = Math.acos(Math.min(1, c)) * 180 / Math.PI; A.dir.push(dd); }
        }
        A.n++; if (!im) A.out++; A.d.push(nb.d);
        if (keep && rows.length < D.maxRows) rows.push([stageName, angle, own ? 1 : 0, si, i, p.x.toFixed(5), p.y.toFixed(5), p.z.toFixed(5),
          pr.ix.toFixed(1), pr.iy.toFixed(1), im, nb.d.toFixed(1), dd == null ? '' : dd.toFixed(1),
          p.t === undefined ? '' : p.t, src ? src.x.toFixed(1) : '', src ? src.y.toFixed(1) : ''].join(','));
        prev = pr;
      }
    }
    function sum(A) { var d = A.d.slice().sort(function (x, y) { return x - y; }); return { n: A.n, outPct: A.n ? 100 * A.out / A.n : NaN, dMed: median(d), d90: pct(d, 0.9), dirMed: median(A.dir.slice()) }; }
    var td = tg.d.slice().sort(function (x, y) { return x - y; });
    return { own: sum(acc.own), other: sum(acc.other), tag: { keepPct: tg.n ? 100 * tg.has / tg.n : NaN, dMed: median(td), d90: pct(td, 0.9), n: td.length } };
  }

  D.run = function (opts) {
    opts = opts || {};
    var model = state.hair3Dneutral;
    if (!model || !model.strands || !model.viewCal) { console.warn(TAG + ' 3D 결과가 아직 없습니다 — 사진을 찍고 3D 화면까지 간 뒤 다시'); return null; }
    var vs = views(); if (!vs.length) { console.warn(TAG + ' 사진 가닥·머리 영역이 없습니다'); return null; }
    var t0 = performance.now(), S = stages(model), grids = {}, res = {}, rows = opts.rows || null;
    vs.forEach(function (a) { grids[a] = photoGrid(a); });
    var totalPts = 0; S.forEach(function (s) { s[1].forEach(function (st) { totalPts += st.pts ? st.pts.length : 0; }); });
    var every = rows ? Math.max(1, Math.ceil(totalPts * vs.length / D.maxRows)) : 1;
    S.forEach(function (s) {
      res[s[0]] = {};
      vs.forEach(function (a) { res[s[0]][a] = measure(s[0], s[1], a, model, grids[a], s[2], rows, every); });
    });
    var f = function (v, k) { return isFinite(v) ? v.toFixed(k) : '-'; };
    var lines = [TAG + ' ' + (W.state && state.styleId ? '스타일 ' + state.styleId : '') + ' · ' + Math.round(performance.now() - t0) + 'ms',
      '  단계        사진    | 꼬리표: 남은%  제자리 거리 중앙/90% | 자기 사진: 밖%  거리 중앙/90%  결°   | 다른 사진: 밖%  거리 중앙/90%  결°'];
    S.forEach(function (s) {
      vs.forEach(function (a) {
        var r = res[s[0]][a]; if (!r) return;
        lines.push('  ' + (s[0] + '          ').slice(0, 11) + ' ' + (a + '      ').slice(0, 7) + ' | '
          + f(r.tag.keepPct, 0) + '%  ' + f(r.tag.dMed, 1) + '/' + f(r.tag.d90, 1) + 'px | '
          + f(r.own.outPct, 1) + '%  ' + f(r.own.dMed, 1) + '/' + f(r.own.d90, 1) + 'px  ' + f(r.own.dirMed, 0) + '°  (' + r.own.n + '점)'
          + '  | ' + f(r.other.outPct, 1) + '%  ' + f(r.other.dMed, 1) + '/' + f(r.other.d90, 1) + 'px  ' + f(r.other.dirMed, 0) + '°  (' + r.other.n + '점)');
      });
    });
    var c = D.lastClip;
    lines.push(c ? ('  [3D·클립] 조정 후 재클립 — 가닥 ' + c.kept + (c.preDensity ? '개(숱치기 전)' : '개') + ' 중 자름 ' + c.trimmed + '개(평균 '
        + (c.trimmed ? (c.removedPts / c.trimmed).toFixed(1) : '0') + '점 제거) · 얼굴침범 차단 ' + c.faceBlocked + '개 · '
        + (c.growN ? '여유 받은 가닥 ' + c.growN + '개' : '여유 0(시술 변위 없음)') + ' · 판정 ' + c.n + '회' + (c.on ? '' : ' · OFF')
        + ' — geom-noclip ↔ geom 차이가 이 단계 몫')
      : '  [3D·클립] 조정 후 재클립 기록 없음(아직 계산 전이거나 꺼짐)');
    lines.push('  꼬리표 남은% 이 어느 단계에서 뚝 떨어지면 그 단계가 점을 새로 만들며 꼬리표를 버린 것 — 그 단계를 고칠 차례');
    lines.push('  제자리 거리 = 그 점이 원래 사진에서 있던 자리와의 차이(lift0 은 0 이어야 함 · 0 이 아니면 진단 자체를 의심)');
    lines.push('  읽는 법: 자기 사진 숫자가 lift 에서 작고 뒤에서 커지면 그 사이 단계가 원인 · final@draw 만 커지면 그리는 카메라 보정 탓 · 다른 사진이 lift 부터 크면 깊이 탓');
    if (!opts.quiet) console.log(lines.join('\n'));
    D.last = { stages: res, lines: lines, every: every };
    return D.last;
  };

  /* (2026-11-28) 진단정보 패널(18 perfPanelLines 맨 위)에 꼬리표 표를 늘 싣는다 — 콘솔 입력 없이 [복사]로 나가게.
     같은 모델이면 다시 계산하지 않음(수 초 걸림). 줄: 단계 · 꼬리표 남은% · 제자리 거리(자기 사진 px) 중앙/90% */
  var _pk = null, _pl = null;
  D.panelLines = function () {
    var m = state.hair3Dneutral; if (!m || !m.strands) return ['[꼬리표] 3D 모델 전 — 3D 화면까지 가면 찍힘'];
    var key = m.strands.length + '/' + (STAGE_TAG.lifted ? STAGE_TAG.lifted.length : 0) + '/' + (state.styleId || '') + '/' + (D.lastClip ? D.lastClip.at : 0);
    if (key === _pk && _pl) return _pl;
    var r = null; try { r = D.run({ quiet: true }); } catch (e) { return ['[꼬리표] 계산 실패 ' + (e && e.message)]; }
    if (!r) return ['[꼬리표] 계산 못 함(사진 가닥·머리 영역 없음)'];
    var f = function (v, k) { return isFinite(v) ? v.toFixed(k) : '-'; }, L = ['[꼬리표] 단계별 — 꼬리표 남은% · 자기 원래 사진 점과의 거리 px(중앙/90%) · 사진별 front/left/right/back'];
    Object.keys(r.stages).forEach(function (st) {
      var row = r.stages[st], parts = [];
      Object.keys(row).forEach(function (a) { var t = row[a] && row[a].tag; if (t) parts.push(a + ' ' + f(t.keepPct, 0) + '% ' + f(t.dMed, 1) + '/' + f(t.d90, 1)); });
      L.push('  ' + st + ': ' + parts.join(' · '));
    });
    if (D.lastClip) L.push('  재클립 자름 ' + D.lastClip.trimmed + '/' + D.lastClip.kept);
    try { STAGE_TAG.trailLines().forEach(function (l) { L.push(l); }); } catch (eTr) {}
    _pk = key; _pl = L; return L;
  };

  D.csv = function () {
    var rows = [];
    if (!D.run({ rows: rows })) return;
    var head = 'stage,view,own,strand,pt,x,y,z,ix,iy,inMask,nearPx,dirDeg,tag,srcIx,srcIy\n';
    var blob = new Blob([head + rows.join('\n')], { type: 'text/csv' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'stage-diag-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '') + '.csv';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    console.log(TAG + ' CSV ' + rows.length + '줄' + (D.last.every > 1 ? ' (가닥 ' + D.last.every + '개마다 하나씩)' : '') + ' 내려받음');
  };

  return D;
})();
