// ============================================================================
// 00-customer-lite.js (2026-11-26) — 고객용 배포본 전용: 진단용 기록 끄기 + 다시 기르기 "쉰 시간" 재기
// ============================================================================
// · index.html에서 맨 앞(다른 js보다 먼저)에 넣음 — 각 모듈이 읽는 설정을 미리 놓아야 해서
// · 끄는 것(머리 모양에는 영향 없음 — 각 모듈 주석 기준)
//     REGROW.trace       다시 기르기 걸음 기록(가닥마다 Float32Array — 메모리·3D 보관 크기도 줄어듦)
//     GYEOL_PERF.probe   함수 시간 재기(성능 순위표)
//     CALL_PROBE.on      3D 머리 계산 호출 추적(호출마다 stack 읽기)
// · 재는 것: 다시 기르기 로그에 "사이사이 쉰 시간"이 일한 시간보다 훨씬 큼(57초 중 47초).
//     다시 기르기가 도는 동안 그 틈에 무엇이 메인 스레드를 쓰는지 재서, 끝나면 한 줄로 찍음:
//     [가벼운 고객판] 다시 기르기 틈 — 그림 프레임 ○회 ○ms · renderAdjustFrame ○회 ○ms …
// 되돌리기: index.html에서 이 줄을 빼면 예전 그대로 · 개별로 켜기 CUSTOMER_LITE.keep = ['trace'] (새로고침 전 localStorage 'custLiteKeep')
// ============================================================================
var CUSTOMER_LITE = (function () {
  'use strict';
  var W = window, TAG = '[가벼운 고객판]';
  var keep = [];
  try { keep = JSON.parse(localStorage.getItem('custLiteKeep') || '[]') || []; } catch (e) {}
  var C = { on: true, keep: keep, gap: {} };
  function off(k) { return keep.indexOf(k) < 0; }

  // ① 모듈이 읽기 전에 놓는 설정(Object.assign(기본, window.X) 방식)
  if (off('trace')) W.REGROW = Object.assign(W.REGROW || {}, { trace: false });

  // ② 틈 재기 — 다시 기르기가 도는 동안만
  function building() { try { return !!(W.REGROW && W.REGROW.building); } catch (e) { return false; } }
  var G = C.gap, wasB = false, t0 = 0;
  function add(k, ms) { var r = G[k] || (G[k] = { n: 0, ms: 0 }); r.n++; r.ms += ms; }
  function now() { try { return performance.now(); } catch (e) { return Date.now(); } }
  var rAF = W.requestAnimationFrame;
  if (typeof rAF === 'function') {
    W.requestAnimationFrame = function (cb) {
      return rAF.call(W, function (ts) {
        if (!building()) return cb(ts);
        var t = now(); try { return cb(ts); } finally { add('그림 프레임(rAF)', now() - t); }
      });
    };
  }
  var sT = W.setTimeout;
  W.setTimeout = function (fn, ms) {
    if (typeof fn !== 'function') return sT.apply(W, arguments);
    var args = Array.prototype.slice.call(arguments, 2), d = +ms || 0;
    return sT.call(W, function () {
      if (!building()) return fn.apply(this, args);
      var t = now(); try { return fn.apply(this, args); } finally { var dt = now() - t; if (dt > 8) add('타이머 작업(' + (fn.name || '이름 없음') + ')', dt); }
    }, d);
  };
  function wrapNamed(name) {
    var f = W[name]; if (typeof f !== 'function' || f.__custLite) return;
    var w = function () { if (!building()) return f.apply(this, arguments); var t = now(); try { return f.apply(this, arguments); } finally { add(name, now() - t); } };
    w.__custLite = true; W[name] = w;
  }
  function report() {
    var keys = Object.keys(G).sort(function (a, b) { return G[b].ms - G[a].ms; }).slice(0, 10);
    var tot = now() - t0;
    console.log(TAG + ' 다시 기르기 ' + Math.round(tot / 1000) + '초 동안 틈에 돈 것(포함 시간 · 겹칠 수 있음):\n' +
      (keys.length ? keys.map(function (k) { return '  ' + k + ' — ' + G[k].n + '회 · ' + Math.round(G[k].ms) + 'ms'; }).join('\n') : '  (잰 것 없음)') +
      '\n  이 값과 [다시 기르기] 줄의 "쉰 시간"을 같이 보내 주세요');
    for (var k in G) delete G[k];
  }
  function watch() { var b = building(); if (b && !wasB) { t0 = now(); for (var k in G) delete G[k]; } if (!b && wasB) sT.call(W, report, 500); wasB = b; }

  // ③ 다 읽은 뒤: 계측 끄기 + 이름 있는 함수 감싸기
  W.addEventListener('load', function () {
    try { if (off('perf') && W.GYEOL_PERF) W.GYEOL_PERF.probe = false; } catch (e) {}
    try { if (off('callProbe') && W.CALL_PROBE) W.CALL_PROBE.on = false; } catch (e) {}
    ['renderAdjustFrame', 'renderFrame', 'combRefresh', 'drawAdjustPreview', 'computeAdjustedHair3DStrands', 'buildAdjustedHair3DObject', 'renderModel3D', 'syncSliderUI', 'buildGyPanel']
      .forEach(wrapNamed);
    setInterval(watch, 100);
    console.log(TAG + ' 설치 — 끔: ' + ['trace', 'perf', 'callProbe'].filter(off).join(' · ') + ' · 다시 기르기 틈 재기 켜짐 · 되돌리기 index.html에서 00-customer-lite.js 빼기');
  });
  return C;
})();
