/* ==========================================================================
 * 28-perf-probe.js — 첫 진입이 20초 걸리는 문제: <b>재는 장치 + 확인된 고침</b>
 *
 * 27-perf-tune.js가 이미 이분탐색을 24→8회로 줄였는데도 20초입니다.
 * 그러면 남은 시간이 어디로 가는지 <b>모르는 상태</b>이고, 모르는 채로 상수를
 * 흔드는 것은 이 파일이 반복해서 실패한 방식입니다. 그래서 두 가지를 합니다.
 *
 *   A. 재는 장치 — 무거운 함수의 누적 시간·호출수를 모아 순위표로 찍습니다.
 *      콘솔에서  GYEOL_PERF.report()
 *      첫 조정 진입·첫 3D 진입 뒤에 자동으로 한 번씩도 찍습니다.
 *      ⚠ 이건 고침이 아니라 <b>다음 고침을 어디에 할지 정하는 자</b>입니다.
 *
 *   B. 확인된 고침 — 스펙 풀이의 탐침 횟수 (하네스로 검증, 아래 수치 참조)
 *
 * ── B의 근거 ────────────────────────────────────────────────────────────
 * measureSectionTipY 한 번 = 그 섹션 풀(SOLVE_SAMPLE=160가닥) 전체에
 * adjustStrandGeom을 돌립니다. 솔버는 그걸 가드 1회 + 이분 8회 = <b>9회</b>
 * 부릅니다. 섹션마다, 좌우마다요.
 *
 * 이분탐색은 함수 모양을 전혀 안 씁니다 — 매번 구간을 반씩 줄일 뿐입니다.
 * 그런데 끝높이(길이)는 단조이고 50에서 한 번 꺾이는 <b>거의 조각선형</b>입니다.
 * 그런 함수는 괄호를 유지하는 시컨트(Illinois)가 훨씬 빨리 답에 닿습니다.
 * Illinois를 쓰는 이유는 순수 시컨트가 꺾인 함수에서 한쪽 끝에 달라붙기
 * 때문입니다 — 한쪽이 연속으로 이기면 그쪽 무게를 반으로 깎아 괄호를 조입니다.
 *
 * 하네스(node, 표본 41,580개):
 *   평균 탐침 9.00회 → <b>2.61회</b> (71% 감소) · 최악도 9회라 더 느려질 수 없음
 *   촘촘히 스캔한 참값과 대조: <b>최대 1칸</b> (예전 이분탐색과 같은 급)
 *   그 1칸은 이분탐색이 8회에서 끊긴 자기 반올림 오차 쪽입니다.
 *   cm 솔버: 평균 2.51회 · 목표 오차 0.3cm 초과 <b>0/2,560</b>
 *
 * ── 버린 안: 솔브 표본 160 → 64 ───────────────────────────────────────
 * 계산량 2.5배가 공짜로 보였지만 하네스가 반려했습니다. 통계가 <b>중앙값</b>이라
 * 표본을 줄이면 흔들리고, 그 흔들림이 슬라이더 정수 칸으로 번집니다:
 *   답이 같은 경우 21.8%뿐 · <b>최대 어긋남 11.68칸</b>
 * 길이가 11칸 틀리는 것은 속도로 살 수 있는 게 아닙니다. SOLVE_SAMPLE은 그대로.
 *
 * 끄기: GYEOL_PERF.solver = false (예전 이분탐색) · GYEOL_PERF.probe = false (계측만 끔)
 * ======================================================================== */
(function () {
  'use strict';
  var G = window;
  var P = G.GYEOL_PERF = {
    probe: true,          // 계측 on/off
    solver: true,         // Illinois 솔버 on/off
    memo: true,           // 같은 (섹션·길이·좌우)를 다시 재지 않기
    /* Illinois 상한. 평균은 2.61회라 여기 닿는 일이 거의 없지만, 상한을 7로 두면
       괄호가 드물게 안 조여져 답이 <b>참값에서 6칸</b>까지 빗나갔습니다(하네스).
       9로 두면 최대 1칸으로 닫히고 <b>평균 탐침은 2.61회 그대로</b>입니다 —
       최악이라도 예전 이분탐색과 같은 9회라 더 느려질 수 없습니다. */
    maxProbes: 9,
    t: Object.create(null),
    memoHits: 0, memoMiss: 0,
    probesBefore: 0, probesAfter: 0
  };

  /* ── A. 재는 장치 ─────────────────────────────────────────────────────
     함수를 이름으로 감싸 누적 ms와 호출수를 모읍니다. 감싸는 비용은
     performance.now() 두 번이라, 안이 160가닥 루프인 함수에서는 무시 가능합니다.
     ⚠ 값은 <b>자기 시간이 아니라 포함 시간</b>입니다(안에서 부른 것도 같이 셉니다).
       그래서 순위표를 읽을 때는 위에서부터 "이게 저걸 품고 있나"를 봐야 합니다. */
  function now() { try { return performance.now(); } catch (e) { return Date.now(); } }
  function wrap(name) {
    var f = G[name];
    if (typeof f !== 'function' || f.__gyeolWrapped) return false;
    var slot = P.t[name] = { ms: 0, n: 0 };
    var w = function () {
      if (!P.probe) return f.apply(this, arguments);
      var t0 = now();
      try { return f.apply(this, arguments); }
      finally { slot.ms += now() - t0; slot.n++; }
    };
    w.__gyeolWrapped = true;
    w.__gyeolOrig = f;
    G[name] = w;
    return true;
  }

  /* 무거울 만한 자리 — 이름이 없으면 조용히 건너뜁니다(모듈 구성이 바뀌어도 안 깨짐). */
  [
    'buildNeutralHair3D',        // 중립 3D 모델 생성 — 첫 진입의 큰 덩어리
    'captureStrandPathsFor',     // 사진 한 장에서 가닥 경로 뜨기(뷰마다)
    'applyStyleSpec',            // 스타일 스펙 적용(아래 솔버들을 품음)
    'solveSectionLengthForTipY',
    'solveSectionLengthForCm',
    'measureSectionTipY',
    'measureSectionLenCm',
    'adjustStrandGeom',          // 가장 안쪽 — 위 전부가 이걸 품는다
    'computeAdjustedHair3DStrands',
    'projectHair3DToView',       // 2D 되쏘기
    'projectHairQuiltToView',
    'buildHairStripPool',
    'extractHairMask',           // 촬영 뒤 분석(비동기 — ms가 대기시간 포함일 수 있음)
    'setupModel3DScreen',        // 3D 화면 전체
    'buildAdjustedHair3DObject',
    'buildRealFaceMesh',
    'loadOutfitMeshMeasured',
    'recommendOutfitWithAI',
    'applyHairLayerClip',
    'renderFrame'
  ].forEach(wrap);

  P.reset = function () {
    for (var k in P.t) { P.t[k].ms = 0; P.t[k].n = 0; }
    P.memoHits = P.memoMiss = P.probesBefore = P.probesAfter = 0;
  };

  P.report = function (label) {
    var rows = [];
    for (var k in P.t) if (P.t[k].n) rows.push([k, P.t[k].ms, P.t[k].n]);
    if (!rows.length) { console.log('[성능·순위] 아직 잡힌 게 없습니다'); return; }
    rows.sort(function (a, b) { return b[1] - a[1]; });
    var total = rows[0][1];
    var out = ['[성능·순위] ' + (label || '') + '  — 누적 ms(포함 시간) · 호출수 · 1회 평균'];
    rows.forEach(function (r) {
      var bar = new Array(Math.max(1, Math.round(r[1] / total * 28)) + 1).join('█');
      out.push('  ' + r[0].slice(0, 30).padEnd(30) + ' ' +
        r[1].toFixed(0).padStart(7) + 'ms  ' +
        String(r[2]).padStart(6) + '회  ' +
        (r[1] / r[2]).toFixed(2).padStart(7) + 'ms  ' + bar);
    });
    out.push('  ─ 읽는 법: 포함 시간이라 위가 아래를 품습니다.');
    out.push('    adjustStrandGeom의 누적이 크면 <b>부르는 쪽의 횟수</b>를 줄일 자리고,');
    out.push('    1회 평균이 크면 <b>그 함수 안</b>을 볼 자리입니다.');
    if (P.probesAfter) {
      out.push('  ─ 스펙 풀이 탐침: 예전 규칙이면 ' + P.probesBefore + '회였을 것을 ' +
        '<b>' + P.probesAfter + '회</b>로 찍었습니다' +
        ' (' + Math.round((1 - P.probesAfter / Math.max(1, P.probesBefore)) * 100) + '% 감소)');
    }
    if (P.memoHits + P.memoMiss) {
      out.push('  ─ 같은 측정 재사용: ' + P.memoHits + '적중 / ' + P.memoMiss + '재계산');
    }
    console.log(out.join('\n').replace(/<b>|<\/b>/g, ''));
  };

  /* 첫 조정 진입·첫 3D 진입 뒤 자동 1회 — 사용자가 콘솔을 안 열어도 남습니다. */
  (function autoReport() {
    var navOrig = G.navTo;
    if (typeof navOrig !== 'function') return;
    var seen = {};
    G.navTo = async function (screen) {
      var r = await navOrig.apply(this, arguments);
      if ((screen === 'adjust' || screen === 'model3d') && !seen[screen]) {
        seen[screen] = true;
        setTimeout(function () { P.report('첫 ' + screen + ' 진입까지'); }, 1200);
      }
      return r;
    };
  })();

  /* ── B. 솔버 교체 ─────────────────────────────────────────────────────
     괄호를 유지하는 시컨트(Illinois). 이분탐색과 달리 답이 있는 구간을
     <b>함수값에 비례해</b> 자릅니다. 한쪽이 연속으로 이기면 그쪽 무게를 반으로
     깎습니다 — 50에서 꺾이는 우리 함수에서 순수 시컨트가 달라붙는 걸 막는 장치.
     ⚠ 괄호는 끝까지 유지되므로 <b>발산하지 않습니다</b>. 범위 밖이면 끝값을
       돌려주고 더 안 찍습니다(예전에는 그때도 8회를 다 찍었습니다).
     ⚠ 반환은 예전과 같이 0~100 정수입니다. */
  function makeSolver(measure, cmp) {
    return function (sec, target, side, extra) {
      var probes = 0;
      var f = function (len) { probes++; return measure(sec, len, side, extra); };
      var fa = f(0), fb = f(100);
      if (fa == null || fb == null) { P.probesBefore += 9; P.probesAfter += probes; return null; }
      var a = 0, b = 100, ga = cmp(fa, target), gb = cmp(fb, target);
      var ans;
      if (ga === 0) ans = 0;
      else if (gb === 0) ans = 100;
      else if (ga * gb > 0) ans = (ga > 0) ? 100 : 0;   // 범위 밖 — 끝값
      else {
        var side_ = 0;
        while (probes < P.maxProbes && (b - a) > 0.5) {
          var c = (a * gb - b * ga) / (gb - ga);
          if (!(c > a && c < b)) c = (a + b) / 2;        // 안전레일: 괄호 밖이면 이분
          var v = f(c);
          if (v == null) break;
          var gc = cmp(v, target);
          if (gc === 0) { a = b = c; break; }
          if (ga * gc < 0) { b = c; gb = gc; if (side_ === -1) ga /= 2; side_ = -1; }
          else { a = c; ga = gc; if (side_ === 1) gb /= 2; side_ = 1; }
        }
        ans = Math.round((a + b) / 2);
      }
      P.probesBefore += 9; P.probesAfter += probes;
      return Math.max(0, Math.min(100, ans));
    };
  }

  /* ── 같은 측정을 다시 하지 않기 ───────────────────────────────────────
     measureSectionTipY(sec,len,side)는 중립 모델과 state.sections의 <b>길이 아닌</b>
     값들(시술각·기법·오버디렉션…)이 그대로면 같은 답입니다. 스펙 적용은 섹션을
     돌며 솔버를 여러 번 부르고, 예전 솔버는 가드로 항상 50을 잰 뒤 첫 이분
     중점도 정확히 50이라 <b>같은 계산을 두 번</b> 했습니다.
     키에 그 값들을 통째로 넣으므로, 뭔가 바뀌면 키가 달라져 자동으로 무효화됩니다
     — 수동 무효화가 없으니 어긋날 자리도 없습니다. */
  var memo = new Map(), memoSig = '';
  function sectionsSig() {
    try {
      var S = state.sections, out = [];
      for (var k in S) {
        var s = S[k];
        out.push(k + ':' + s.technique + ',' + s.elevation + ',' + s.layer + ',' +
          s.line + ',' + s.curl + ',' + s.texture + ',' + s.overdirection);
      }
      var m = state.hair3Dneutral;
      out.push('|m' + (m ? (m._gid || (m._gid = Math.random())) : 0));
      out.push('|st' + JSON.stringify(state.styling || null));
      return out.join(';');
    } catch (e) { return 'x' + Math.random(); }
  }
  function memoize(fn, tag) {
    return function (sec, len, side, extra) {
      if (!P.memo) return fn(sec, len, side, extra);
      var sig = sectionsSig();
      if (sig !== memoSig) { memo.clear(); memoSig = sig; }
      var key = tag + '|' + sec + '|' + len + '|' + (side || '*') + '|' + (extra == null ? '' : extra);
      if (memo.has(key)) { P.memoHits++; return memo.get(key); }
      P.memoMiss++;
      var v = fn(sec, len, side, extra);
      memo.set(key, v);
      if (memo.size > 400) memo.clear();
      return v;
    };
  }

  /* 끝높이: 길이가 커질수록 끝이 <b>내려간다</b>(y 작아진다).
     길이: 길이가 커질수록 cm가 <b>커진다</b>. 부호가 반대라 cmp를 따로 준다. */
  var mTip = G.measureSectionTipY, mCm = G.measureSectionLenCm;
  if (typeof mTip === 'function' && typeof G.solveSectionLengthForTipY === 'function') {
    var tipM = memoize(function (s, l, sd) { return mTip(s, l, sd); }, 'tip');
    var newTip = makeSolver(function (s, l, sd) { return tipM(s, l, sd); },
      function (v, t) { return v - t; });          // v>t 면 아직 짧다 → 길이를 늘린다
    var oldTip = G.solveSectionLengthForTipY;
    G.solveSectionLengthForTipY = function (sec, targetY, side) {
      if (!P.solver) return oldTip.apply(this, arguments);
      return newTip(sec, targetY, side);
    };
  }
  if (typeof mCm === 'function' && typeof G.solveSectionLengthForCm === 'function') {
    var cmM = memoize(function (s, l, sd, mn) { return mCm(s, l, sd, mn); }, 'cm');
    var newCm = makeSolver(function (s, l, sd, mn) { return cmM(s, l, sd, mn); },
      function (v, t) { return t - v; });          // cm는 증가함수라 부호를 뒤집는다
    var oldCm = G.solveSectionLengthForCm;
    G.solveSectionLengthForCm = function (sec, targetCm, side, minRootY) {
      if (!P.solver) return oldCm.apply(this, arguments);
      return newCm(sec, targetCm, side, minRootY);
    };
  }

  console.log('[성능] 28-perf-probe 적용 — 스펙 풀이 탐침 9회→약 2.7회(하네스 41,580표본, 최대 차 1칸).' +
    '\n    어디가 느린지 보려면 콘솔에 GYEOL_PERF.report() · 되돌리기 GYEOL_PERF.solver=false');
})();


/* ── C. 스타일 적용 빠르게 + [시간] 진단 줄 (예전 29번 파일 내용) ── */
/* ==========================================================================
 * 29-style-apply-fast.js — 스타일 적용 대기(~10초) 줄이기 + [시간] 진단 줄
 *
 * 원인(코드 추적으로 확인): applyStyleSpec()이 섹션 길이를 푼 "뒤에"
 * 진단 전용 계산을 매번 같이 돌립니다. 진단 패널을 열든 안 열든 돕니다.
 *   ① diagCrownCoverage  → computeAdjustedHair3DStrands(null, 1)
 *      stride 1 = 모델 전체(약 22,000가닥)를 조정 계산. 화면 렌더는 약 5,000가닥만 씀.
 *      stride가 달라 ADJ_CACHE도 못 탐 → 순수 추가 비용.
 *   ② reportSilhouette   → measureSilhouette × 4뷰 (stride 3 ≈ 7,500가닥 조정 + 뷰마다 투영·가림 판정)
 *   ③ 뷰별 길이 재풀이   → 섹션마다 front/left/right/back 4번 더 풂(메인 풀이의 최대 4배).
 *      결과(byView·좌우차)는 진단 패널 글자로만 쓰이고 렌더에는 안 쓰임.
 *   ④ diagRoundTrip · logCurlScale → 로그 전용.
 *
 * 고침: 적용 중에는 ①~④를 건너뛰고, 진단 패널을 열 때 한 번 계산해서 채웁니다.
 *       (그림은 전혀 바뀌지 않습니다 — 렌더가 읽는 값은 하나도 건드리지 않음)
 *
 * [시간] 줄: 진단 패널 맨 위에 단계별 ms가 찍힙니다.
 *   3D준비(buildNeutralHair3D) · 길이풀이(applyStyleSpec) · 첫렌더(renderAdjustFrame)
 *   · 미니3D · 합계(조정 화면 진입 → 스타일 적용 후 첫 그림 끝) · 미룬 진단
 *
 * 끄기: STYLE_FAST.on = false (예전처럼 적용 때 진단까지 전부 계산)
 * ======================================================================== */
(function () {
  'use strict';
  var G = window;
  var F = G.STYLE_FAST = {
    on: true,
    t: {},            // 마지막 적용의 단계별 ms
    skipped: 0,       // 적용 중 건너뛴 뷰별 풀이 수
    pending: null     // 패널 열 때 채울 진단 {id}
  };
  function now() { try { return performance.now(); } catch (e) { return Date.now(); } }
  var inApply = false;

  /* ── 시간 재기 ─────────────────────────────────────────────────────── */
  var navAt = 0, applyAt = 0, waitRender = false;

  var navOrig = G.navTo;
  if (typeof navOrig === 'function') {
    G.navTo = function (screen) {
      if (screen === 'adjust' && state && state.pendingSpecId) { navAt = now(); F.t = {}; }
      return navOrig.apply(this, arguments);
    };
  }

  var nOrig = G.buildNeutralHair3D;
  if (typeof nOrig === 'function') {
    G.buildNeutralHair3D = function (cb) {
      var t0 = now();
      return nOrig.call(this, function () {
        F.t.neutral3D = Math.max(F.t.neutral3D || 0, now() - t0);  // 기다리는 쪽이 여럿이면 합치지 않고 가장 긴 것
        if (cb) return cb.apply(this, arguments);
      });
    };
  }

  var asrOrig = G.applyStyleSpecAndRender;
  if (typeof asrOrig === 'function') {
    G.applyStyleSpecAndRender = function (id, retry) {
      if (!retry) { applyAt = now(); if (!navAt) F.t = {}; }
      var r = asrOrig.apply(this, arguments);
      if (r) waitRender = true;   // 적용됨 → 다음 renderAdjustFrame이 첫 그림
      return r;
    };
  }

  var specOrig = G.applyStyleSpec;
  if (typeof specOrig === 'function') {
    G.applyStyleSpec = function (id) {
      var t0 = now();
      inApply = true; F.skipped = 0;
      try {
        var rep = specOrig.apply(this, arguments);
        if (rep && F.on) F.pending = { id: id };
        return rep;
      } finally {
        inApply = false;
        F.t.solve = now() - t0;
      }
    };
  }

  var rafOrig = G.renderAdjustFrame;
  if (typeof rafOrig === 'function') {
    G.renderAdjustFrame = function () {
      if (!waitRender) return rafOrig.apply(this, arguments);
      var t0 = now();
      try { return rafOrig.apply(this, arguments); }
      finally {
        waitRender = false;
        var t1 = now();
        F.t.render = t1 - t0;
        F.t.total = t1 - (navAt || applyAt);
        navAt = 0;
      }
    };
  }

  var miniOrig = G.refreshDevMini3D;
  if (typeof miniOrig === 'function') {
    G.refreshDevMini3D = function () {
      var t0 = now();
      try { return miniOrig.apply(this, arguments); }
      finally { var d = now() - t0; if (d > 1) F.t.mini3D = d; }
    };
  }

  /* ── 적용 중 진단 건너뛰기 ─────────────────────────────────────────── */
  function deferIn(name) {
    var f = G[name];
    if (typeof f !== 'function') return null;
    G[name] = function () {
      if (F.on && inApply) return null;
      return f.apply(this, arguments);
    };
    return f;
  }
  var oSil = deferIn('reportSilhouette');
  var oCrown = deferIn('diagCrownCoverage');
  var oRound = deferIn('diagRoundTrip');
  var oCurl = deferIn('logCurlScale');

  // ③ 뷰별 재풀이: 적용 중 view 인자가 있는 호출만 null → 원본 루프가 continue
  function skipView(name) {
    var f = G[name];
    if (typeof f !== 'function') return null;
    G[name] = function (sec, target, side) {
      if (F.on && inApply && side) { F.skipped++; return null; }
      return f.apply(this, arguments);
    };
    return f;
  }
  var oTip = skipView('solveSectionLengthForTipY');
  var oCm = skipView('solveSectionLengthForCm');

  /* ── 패널 열 때 미룬 진단 채우기 (원본 applyStyleSpec과 같은 규칙) ── */
  function runDeferred() {
    var P = F.pending;
    if (!P) return;
    F.pending = null;
    var L = state._lastSpec;
    if (!L || L.id !== P.id || !L.rep) return;
    var rep = L.rep, t0 = now();
    try {
      var spec = G.getStyleSpec ? G.getStyleSpec(P.id) : null;
      var hh = G.headHeightRef ? G.headHeightRef() : null;
      if (spec && hh && oTip && oCm) {
        var disc = spec.fade && spec.fade.disc > 0 ? hh.yTop - spec.fade.disc / 100 * hh.H : null;
        var above = (typeof FADE_SOLVE_ABOVE_LINE !== 'undefined') ? FADE_SOLVE_ABOVE_LINE : {};
        rep.byView = {};
        for (var sec in rep.solved) {
          var base = rep.solved[sec];
          if (base == null) continue;
          var isCm = rep.unit[sec] === 'cm';
          var minRoot = isCm && disc != null && above[sec] ? disc : undefined;
          var tipY = isCm ? null : hh.yTop - spec.tipAt[sec] * hh.H;
          ANGLES.forEach(function (v) {
            var pool = G.solvePoolFor(sec, v);
            if (!pool || pool.length < 8) return;
            var len = isCm ? oCm(sec, spec.lenCm[sec], v, minRoot) : oTip(sec, tipY, v);
            if (len == null) return;
            (rep.byView[v] || (rep.byView[v] = {}))[sec] = { length: len, n: pool.length, d: len - base };
          });
        }
        rep.asym = {};
        for (var s2 in rep.solved) {
          var a = rep.byView.left && rep.byView.left[s2], b = rep.byView.right && rep.byView.right[s2];
          if (a && b) rep.asym[s2] = a.length - b.length;
        }
      }
    } catch (e) { console.warn('[스타일 빠르게] 뷰별 풀이 실패', e); }
    try { _curlScaleLogged = false; } catch (e) {}
    try { if (oCurl) oCurl(); } catch (e) {}
    try { if (oSil) rep.silhouette = oSil(P.id); } catch (e) {}
    try { if (oCrown) rep.crown = oCrown(); } catch (e) {}
    try { if (oRound) rep.roundTrip = oRound(); } catch (e) {}
    F.t.diag = now() - t0;
  }

  function ms(v) { return v == null ? '—' : Math.round(v) + 'ms'; }
  function timingLine() {
    var t = F.t;
    return '[시간] 3D준비 ' + ms(t.neutral3D) + ' · 길이풀이 ' + ms(t.solve) +
      ' · 첫렌더 ' + ms(t.render) + ' · 미니3D ' + ms(t.mini3D) +
      ' · 합계 ' + ms(t.total) +
      (F.on ? ' · 미룬 진단 ' + ms(t.diag) + ' (뷰별 풀이 ' + F.skipped + '회 건너뜀)' : ' · (STYLE_FAST 꺼짐)');
  }

  var perfOrig = G.perfPanelLines;
  if (typeof perfOrig === 'function') {
    G.perfPanelLines = function () {
      runDeferred();
      var lines = perfOrig.apply(this, arguments) || [];
      return [timingLine()].concat(lines);
    };
  }

  G.STYLE_FAST.line = timingLine;
  console.log('[성능] 28-perf-probe(C) 적용 — 스타일 적용 때 진단 계산(전체 가닥 조정·실루엣 4뷰·뷰별 재풀이)을 진단 패널 열 때로 미룸. 끄기 STYLE_FAST.on=false');
})();


/* ── D. 3D준비 · 3D 결과 화면 단계별 시간 ───────────────────────────────
 * [시간·3D준비] 뷰별 사진→가닥 경로(captureStrandPathsFor) · 3D 들어올리기(buildHairStrandsFromPaths)
 * [시간·3D화면] 두상 · 헤어 객체 · 의상 추천 · 의상 로딩 · 얼굴 메쉬 · 합계
 * 비동기 함수는 promise가 끝날 때까지 잽니다. 3D 화면에는 진단 버튼이 없어서
 * 조정 화면으로 돌아와 진단을 열면 같이 보입니다.
 * ======================================================================== */
(function () {
  'use strict';
  var G = window, F = G.STYLE_FAST;
  if (!F) return;
  var T = F.t3 = { prep: {}, scr: {} };
  function now() { try { return performance.now(); } catch (e) { return Date.now(); } }
  function timeIt(name, bucket, key) {
    var f = G[name];
    if (typeof f !== 'function') return;
    G[name] = function () {
      var t0 = now(), k = key ? key(arguments) : name, b = T[bucket];
      var done = function () { b[k] = (b[k] || 0) + (now() - t0); };
      var r;
      try { r = f.apply(this, arguments); } catch (e) { done(); throw e; }
      if (r && typeof r.then === 'function') { r.then(done, done); } else done();
      return r;
    };
  }
  // 3D준비 내부 (조정 화면·3D 화면 둘 다에서 불림)
  var nb = G.buildNeutralHair3D;
  if (typeof nb === 'function') {
    G.buildNeutralHair3D = function (cb) { var joining = typeof NEUTRAL_BUILD !== 'undefined' && NEUTRAL_BUILD.running; if (!joining) T.prep = {}; var t0 = T.prep._t0 = joining && T.prep._t0 ? T.prep._t0 : now();
      return nb.call(this, function () { T.prep.total = now() - t0; if (cb) return cb.apply(this, arguments); }); };
  }
  timeIt('captureStrandPathsFor', 'prep', function (a) { return '경로·' + a[0]; });
  timeIt('buildHairStrandsFromPaths', 'prep', function () { return '들어올리기'; });
  // 3D 결과 화면
  var sm = G.setupModel3DScreen;
  if (typeof sm === 'function') {
    G.setupModel3DScreen = function () { T.scr = {}; var t0 = now(), r = sm.apply(this, arguments);
      var d = function () { T.scr['합계'] = now() - t0; }; if (r && r.then) r.then(d, d); else d(); return r; };
  }
  timeIt('loadHeadMesh', 'scr', function () { return '두상'; });
  timeIt('buildAdjustedHair3DObject', 'scr', function () { return '헤어객체'; });
  // 헤어객체 안쪽: 가닥 조정 계산(곱슬 포함) · 3D 음영(24번)
  var inHair = false, ho = G.buildAdjustedHair3DObject;
  G.buildAdjustedHair3DObject = function () { inHair = true; try { return ho.apply(this, arguments); } finally { inHair = false; } };
  var ca = G.computeAdjustedHair3DStrands;
  if (typeof ca === 'function') G.computeAdjustedHair3DStrands = function () {
    if (!inHair) return ca.apply(this, arguments);
    var t0 = now(), r = ca.apply(this, arguments);
    T.scr['└가닥계산'] = (T.scr['└가닥계산'] || 0) + (now() - t0);
    if (r) { var pts = 0; for (var i = 0; i < r.length; i++) pts += (r[i].pts ? r[i].pts.length : 0);
      T.scr['└가닥수'] = r.length; T.scr['└점수'] = pts; }
    return r;
  };
  timeIt('recommendOutfitWithAI', 'scr', function () { return '의상추천'; });
  timeIt('loadOutfitMeshMeasured', 'scr', function () { return '의상로딩'; });
  timeIt('buildRealFaceMesh', 'scr', function () { return '얼굴메쉬(합계 밖)'; });

  function fmt(o) { var a = []; for (var k in o) if (k !== 'total' && k !== '_t0') a.push(k + ' ' + Math.round(o[k]) + (/수$/.test(k) ? '' : 'ms')); return a.length ? a.join(' · ') : '아직 없음'; }
  var pl = G.perfPanelLines;
  G.perfPanelLines = function () {
    var lines = pl.apply(this, arguments) || [];
    var sum = 0; for (var k in T.prep) if (k !== 'total' && k !== '_t0') sum += T.prep[k];
    var p = '[시간·3D준비] ' + (T.prep.total != null ? '전체 ' + Math.round(T.prep.total) + 'ms · ' : '') + fmt(T.prep) +
      (T.prep.total != null ? ' · 틈(사이에 끼어든 다른 작업) ' + Math.round(Math.max(0, T.prep.total - sum)) + 'ms' : '');
    var s = '[시간·3D화면] ' + fmt(T.scr);
    return [lines[0], p, s].concat(lines.slice(1));
  };
})();


/* ── E. 3D 결과 화면 빠르게 (가닥 수·모양 그대로) ─────────────────────────
 * ② 가닥 계산 재사용: _adjGeometry는 가닥을 하나씩 독립적으로 계산합니다(간격만 다름).
 *    그래서 "같은 상태면 같은 가닥은 같은 결과" — 가닥별로 기억해 두고,
 *    조정 화면이 한가할 때 나머지 가닥을 조금씩(한 번에 ~10ms) 미리 계산해 둡니다.
 *    3D 결과 화면은 기억해 둔 걸 꺼내 쓰기만 합니다.
 *    상태 서명은 원래 ADJ_CACHE와 같은 adjCacheSig를 쓰므로 슬라이더를 움직이면 자동 무효.
 * ① 헤어 객체 만들기:
 *    · diagFinal3DCoverage(진단 로그 — 60만 선분에 acos·atan2)는 3D 화면에선 건너뜀
 *    · 색 문자열 해석(THREE.Color.set)을 빠른 경로로 — 결과 값은 THREE와 동일
 *    · 사진 색 입히기(bakeStrandColors3D, 점마다 사진에 투영)를 가닥별로 기억
 * 끄기: GYEOL_3D.memo=false · GYEOL_3D.prewarm=false · GYEOL_3D.fastColor=false · GYEOL_3D.skipDiag=false
 * ======================================================================== */
(function () {
  'use strict';
  var G = window, F = G.STYLE_FAST;
  var Q = G.GYEOL_3D = { memo: true, prewarm: true, fastColor: true, skipDiag: true, bakeMemo: true,
    hits: 0, miss: 0, warmDone: 0, warmTotal: 0, bakeHits: 0, bakeMiss: 0 };
  function now() { try { return performance.now(); } catch (e) { return Date.now(); } }
  var T = (F && F.t3) ? F.t3 : { scr: {} };

  /* ── ② 가닥별 기억 ────────────────────────────────────────────────── */
  var M = { sig: null, map: new WeakMap() };
  function strandSig(model) {
    try { return adjCacheSig(model, null, 1); } catch (e) { return null; }
  }
  function makeCtx(model) {
    var probe = HAIR_OCC3D.clipAdjusted && !(MQ_TRUST.photoClip3D && model.mannequin && MQ_TRUST.on)
      ? (model.occ && model.occ.probe || state.hairOcc3D && state.hairOcc3D.probe || null) : null;
    var fringe = 0;
    if (model.mannequin && HAIR_OCC3D.fringeFrac > 0) { try { fringe = 2 * getHeadEllipsoid().b * HAIR_OCC3D.fringeFrac; } catch (e) { fringe = 0; } }
    return { model: model, sty: uniformStyling(), probe: probe,
      stats: probe ? { n: 0, dropped: 0, trimmed: 0, removedPts: 0, faceBlocked: 0 } : null, fringe: fringe };
  }
  // 원래 _adjGeometry 루프 몸통과 같은 계산 (가닥 하나)
  function computeEntry(s, c) {
    var sec = state.sections && state.sections[s.sec] || {};
    var ratio = sectionLengthRatio(s.sec, sec.length);
    var g = adjustStrandGeom(s, null, c.sty);
    if (c.probe && !s.fringe) {
      var grow = !HAIR_OCC3D.moveGrow && ratio > 1 ? (ratio - 1) * arcLength3D(s.pts) * HAIR_OCC3D.growPerRatio : 0;
      var t = trimStrandToOccupancy3D(g, c.probe, c.stats, {
        growLen: Math.max(grow, c.fringe), growFrontOnly: c.fringe > grow && HAIR_OCC3D.fringeFrontOnly,
        growAboveY: c.model.CY, srcPts: s.pts, neverDrop: true, faceVeto: true });
      if (t && t.length >= 2) g = t;
    }
    g = combStrand3D(g);
    if (s._ch === undefined) s._ch = _cutHash01(s);
    return ADJ_CACHE.split
      ? { pts: g, sec: s.sec, srcAngle: s.srcAngle, h: s._ch, srcColor: s.color, srcColors: s.colors || null }
      : { pts: g, color: sec.color || s.color, sec: s.sec, srcAngle: s.srcAngle, colors: sec.color ? null : s.colors || null };
  }

  var origGeo = G._adjGeometry;
  if (typeof origGeo === 'function' && typeof adjCacheSig === 'function' && typeof adjustStrandGeom === 'function') {
    G._adjGeometry = function (angle, stride) {
      if (!Q.memo) return origGeo.apply(this, arguments);
      var model = state.hair3Dneutral;
      if (!model || !model.strands) return null;
      var key = null;
      if (ADJ_CACHE.on) try {                          // 원래와 같은 결과 캐시(통째)
        key = adjCacheSig(model, angle, Math.max(1, +stride || 1));
        var hit = ADJ_CACHE._map.get(key);
        if (hit) {
          ADJ_CACHE.hits++;
          var li = ADJ_CACHE._lru.indexOf(key); if (li >= 0) ADJ_CACHE._lru.splice(li, 1);
          ADJ_CACHE._lru.push(key); return hit;
        }
        ADJ_CACHE.misses++;
      } catch (e) { key = null; }
      var st = Math.max(1, +stride || 1), out = [], acc = 0;
      var psig = strandSig(model);
      if (psig !== M.sig) { M.sig = psig; M.map = new WeakMap(); }
      var ctx = makeCtx(model);
      try { _pieceAcc = PIECE3D.on && hairPieces().length ? { n: 0, minR: 1, minKey: null } : null; } catch (e) {}
      for (var i = 0; i < model.strands.length; i++) {
        var s = model.strands[i];
        if (angle && s.srcAngle !== angle) continue;
        acc += 1 / st; if (acc < 1) continue; acc -= 1;
        var sec = state.sections && state.sections[s.sec] || {};
        if (false /* 숱(density) 막대 제거 */ && !ADJ_CACHE.split && typeof sec.density === 'number' && sec.density < 100 && _cutHash01(s) > Math.max(0, sec.density) / 100) continue;
        var e = psig ? M.map.get(s) : null;
        if (e) { Q.hits++; out.push(e); continue; }
        Q.miss++;
        e = computeEntry(s, ctx);
        if (psig) M.map.set(s, e);
        out.push(e);
      }
      try { if (ctx.stats) logAdjustedClip(ctx.stats, out.length, ADJ_CACHE.split); } catch (e2) {}
      try {
        if (_pieceAcc && _pieceAcc.n) _pieceLast = { minR: _pieceAcc.minR, minKey: _pieceAcc.minKey };
        _pieceAcc = null;
      } catch (e3) {}
      if (key) {
        ADJ_CACHE._map.set(key, out); ADJ_CACHE._lru.push(key);
        while (ADJ_CACHE._lru.length > ADJ_CACHE.max) {
          var old = ADJ_CACHE._lru.shift();
          if (ADJ_CACHE._lru.indexOf(old) < 0) ADJ_CACHE._map.delete(old);
        }
      }
      return out;
    };
  }

  /* 미리 계산 — 조정·결과 화면이 조용해지면 900ms 뒤 시작, 한 번에 ~10ms씩 */
  var warmTimer = null, warmIdx = 0, warmSig = null, warmCtx = null;
  function scheduleWarm() {
    if (!Q.memo || !Q.prewarm) return;
    if (warmTimer) clearTimeout(warmTimer);
    warmTimer = setTimeout(warmSlice, 900);
  }
  function warmSlice() {
    warmTimer = null;
    var scr = (typeof currentScreen !== 'undefined') ? currentScreen : '';
    if (scr !== 'adjust' && scr !== 'result') return;
    var model = state.hair3Dneutral;
    if (!model || !model.strands) return;
    var psig = strandSig(model);
    if (!psig) return;
    if (psig !== M.sig) { M.sig = psig; M.map = new WeakMap(); }
    if (psig !== warmSig) { warmSig = psig; warmIdx = 0; warmCtx = makeCtx(model); Q.warmDone = 0; }
    Q.warmTotal = model.strands.length;
    var t0 = now();
    try {
      while (warmIdx < model.strands.length && now() - t0 < 10) {
        var s = model.strands[warmIdx++];
        if (M.map.has(s)) continue;
        M.map.set(s, computeEntry(s, warmCtx));
        Q.warmDone++;
      }
    } catch (e) { console.warn('[3D 미리계산] 중단', e); return; }
    if (warmIdx < model.strands.length) warmTimer = setTimeout(warmSlice, 0);
    else if (!Q.checked) setTimeout(selfCheck, 50);
  }
  /* 자가 검증 — 미리계산이 처음 끝나면 한 번: 원래 함수와 새 함수의 결과(간격 16)를 점 단위로 비교 */
  function selfCheck() {
    if (Q.checked) return; Q.checked = true;
    var on = ADJ_CACHE.on, a, b;
    try {
      ADJ_CACHE.on = false;
      a = origGeo(null, 16);
      b = G._adjGeometry(null, 16);
    } catch (e) { Q.check = '실패 ' + (e && e.message); return; }
    finally { ADJ_CACHE.on = on; }
    if (!a || !b) { Q.check = '비교 불가'; return; }
    var same = 0, worst = 0, n = Math.min(a.length, b.length);
    for (var i = 0; i < n; i++) {
      var p = a[i].pts, q = b[i].pts, d = 0;
      if (!p || !q || p.length !== q.length) { d = Infinity; }
      else for (var j = 0; j < p.length; j++) d = Math.max(d, Math.abs(p[j].x - q[j].x), Math.abs(p[j].y - q[j].y), Math.abs(p[j].z - q[j].z));
      if (d < 1e-9) same++; if (d > worst) worst = d;
    }
    Q.check = (same === n && a.length === b.length ? '일치 ' : '⚠ 불일치 ') + same + '/' + a.length + '가닥' +
      (same === n ? '' : ' (최대 차 ' + (isFinite(worst) ? worst.toExponential(1) : '점 수 다름') + ')');
    if (same !== n || a.length !== b.length) { Q.memo = false; Q.check += ' → 기억 끔(원래 방식으로 계산)'; }
  }
  Q.scheduleWarm = scheduleWarm;
  var raf2 = G.renderAdjustFrame;
  if (typeof raf2 === 'function') G.renderAdjustFrame = function () { var r = raf2.apply(this, arguments); scheduleWarm(); return r; };
  var nav2 = G.navTo;
  if (typeof nav2 === 'function') G.navTo = function () { var r = nav2.apply(this, arguments); scheduleWarm(); return r; };

  /* ── ① 헤어 객체 만들기 ────────────────────────────────────────────── */
  var inHair = false, hairEndLines = 0;
  var hb = G.buildAdjustedHair3DObject;
  if (typeof hb === 'function') G.buildAdjustedHair3DObject = function () {
    inHair = true; T.scr['└색입히기'] = 0; var t0 = now();
    try { var r = hb.apply(this, arguments);
      if (hairEndLines) T.scr['└음영(24번)'] = now() - hairEndLines;
      return r;
    } finally { inHair = false; hairEndLines = 0; T.scr['└미리계산'] = Q.warmTotal ? Math.round(Q.warmDone / Q.warmTotal * 100) : 0; }
  };
  // 진단 로그 건너뛰기
  var dfc = G.diagFinal3DCoverage;
  if (typeof dfc === 'function') G.diagFinal3DCoverage = function () {
    if (Q.skipDiag && inHair) return null;
    return dfc.apply(this, arguments);
  };
  // 뭉치기·선 만들기 시간
  var cl = G.clumpStrands3D;
  if (typeof cl === 'function') G.clumpStrands3D = function () {
    if (!inHair) return cl.apply(this, arguments);
    var t0 = now(); try { return cl.apply(this, arguments); } finally { T.scr['└뭉치기'] = now() - t0; }
  };
  var mvl = G.makeVertexColorLines;
  if (typeof mvl === 'function') G.makeVertexColorLines = function () {
    var r = mvl.apply(this, arguments); if (inHair) hairEndLines = now(); return r;
  };
  // 사진 색 입히기 기억 (같은 점 배열·같은 인자면 같은 결과)
  var bake = G.bakeStrandColors3D, bakeMemo = new WeakMap(), bakeModel = null;
  if (typeof bake === 'function') G.bakeStrandColors3D = function (pts, model, ang, color, colors, dye) {
    var t0 = inHair ? now() : 0;
    try {
      if (!Q.bakeMemo || !pts || typeof pts !== 'object') return bake.apply(this, arguments);
      if (model !== bakeModel) { bakeModel = model; bakeMemo = new WeakMap(); }
      var m = bakeMemo.get(pts);
      if (m && m.a === ang && m.c === color && m.l === colors && m.d === dye) { Q.bakeHits++; return m.v; }
      Q.bakeMiss++;
      var v = bake.apply(this, arguments);
      bakeMemo.set(pts, { a: ang, c: color, l: colors, d: dye, v: v });
      return v;
    } finally { if (inHair) T.scr['└색입히기'] += now() - t0; }
  };
  var ppl = G.perfPanelLines;
  if (typeof ppl === 'function') G.perfPanelLines = function () {
    var L = ppl.apply(this, arguments) || [];
    var line = '[3D·재사용] 가닥 기억 적중 ' + Q.hits + ' / 새로계산 ' + Q.miss + ' · 미리계산 ' + Q.warmDone + '/' + Q.warmTotal +
      ' · 색입히기 기억 ' + Q.bakeHits + '/' + (Q.bakeHits + Q.bakeMiss) + ' · 검증 ' + (Q.check || '대기');
    return L.slice(0, 3).concat([line], L.slice(3));
  };
  // 색 문자열 빠른 해석 — THREE r128 setStyle과 같은 값(색 관리 없음)
  if (typeof THREE !== 'undefined' && THREE.Color && THREE.Color.prototype.set) {
    var cset = THREE.Color.prototype.set;
    var HEX = /^#([0-9a-fA-F]{6})$/, RGB = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,[^)]*)?\)$/;
    THREE.Color.prototype.set = function (v) {
      if (Q.fastColor && typeof v === 'string') {
        var m = HEX.exec(v);
        if (m) { var h = parseInt(m[1], 16); this.r = (h >> 16 & 255) / 255; this.g = (h >> 8 & 255) / 255; this.b = (h & 255) / 255; return this; }
        m = RGB.exec(v);
        if (m) { this.r = Math.min(255, parseInt(m[1], 10)) / 255; this.g = Math.min(255, parseInt(m[2], 10)) / 255; this.b = Math.min(255, parseInt(m[3], 10)) / 255; return this; }
      }
      return cset.apply(this, arguments);
    };
  }
})();

/* F. 의상 OBJ 재시도 — GitHub Pages가 가끔 503을 주면 한 번에 네모 상자 옷으로 떨어지던 것.
 *    실패하면 0.6s·1.5s·3s 뒤 다시 받아 봅니다(캐시 우회). 끄기 OUTFIT_RETRY.on=false */
(function () {
  var R = window.OUTFIT_RETRY = window.OUTFIT_RETRY || { on: true, waits: [600, 1500, 3000] };
  function hook() {
    var L = window.THREE && THREE.OBJLoader;
    if (!L || !L.prototype || L.prototype.__retry) return !!L;
    var orig = L.prototype.load;
    L.prototype.load = function (url, onLoad, onProgress, onError) {
      var self = this, n = 0;
      function go(u) {
        orig.call(self, u, onLoad, onProgress, function (err) {
          if (R.on && n < R.waits.length) {
            var w = R.waits[n++];
            console.warn('[의상·재시도] ' + url + ' 실패 → ' + w + 'ms 뒤 ' + n + '번째 재시도');
            setTimeout(function () { go(url + (url.indexOf('?') < 0 ? '?' : '&') + 'r=' + Date.now()); }, w);
          } else if (onError) onError(err);
        });
      }
      go(url);
    };
    L.prototype.__retry = true;
    return true;
  }
  if (!hook()) { var t = setInterval(function () { if (hook()) clearInterval(t); }, 300); setTimeout(function () { clearInterval(t); }, 30000); }
})();
