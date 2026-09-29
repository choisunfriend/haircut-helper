/* ==========================================================================
 * 27-perf-tune.js — 조정 화면 첫 진입(“3D 준비 중…”) 속도 개선
 *
 * 원인(프로파일): 스타일 스펙을 처음 걸 때 섹션 길이를 이분 탐색으로 푸는데,
 *   ① solveSectionLengthForTipY / ForCm 가 24번씩 반복 — 결과는 0~100 정수로 반올림하므로
 *      8번(100/256 ≈ 0.4 단위)이면 같은 답이 나옵니다. 매 반복마다 섹션 가닥 전체를 다시 계산합니다.
 *   ③ RENDER_MATCH(렌더 vs 사진 비교 로그)는 진단 전용인데 첫 프레임마다 ~0.5초 — 기본 끔.
 *   ② getFaceHalfWidthMesh 가 가닥마다(getHeadEllipsoid 경유) 불려서 랜드마크 478점을 매번 다시 투영.
 *      입력(정면 랜드마크·마스크 크기)이 같으면 값도 같으므로 기억해 둡니다.
 *
 * 끄기: PERF_TUNE.on = false (원래 함수로 동작)
 * ======================================================================== */
(function () {
  'use strict';
  var G = window;
  var PERF_TUNE = G.PERF_TUNE = { on: true, solveIters: 8, faceHalfHits: 0, faceHalfMiss: 0 };

  // ① 이분 탐색 반복 줄이기 (로직은 원본과 동일, 반복 횟수만 다름)
  var origTip = G.solveSectionLengthForTipY;
  if (typeof origTip === 'function' && typeof G.measureSectionTipY === 'function') {
    G.solveSectionLengthForTipY = function (sec, targetY, side) {
      if (!PERF_TUNE.on) return origTip.apply(this, arguments);
      if (G.measureSectionTipY(sec, 50, side) == null) return null;
      var lo = 0, hi = 100;
      for (var i = 0; i < PERF_TUNE.solveIters; i++) {
        var mid = (lo + hi) / 2, y = G.measureSectionTipY(sec, mid, side);
        if (y == null) return null;
        if (y > targetY) lo = mid; else hi = mid;
      }
      return Math.max(0, Math.min(100, Math.round((lo + hi) / 2)));
    };
  }
  var origCm = G.solveSectionLengthForCm;
  if (typeof origCm === 'function' && typeof G.measureSectionLenCm === 'function') {
    G.solveSectionLengthForCm = function (sec, targetCm, side, minRootY) {
      if (!PERF_TUNE.on) return origCm.apply(this, arguments);
      if (G.measureSectionLenCm(sec, 50, side, minRootY) == null) return null;
      var lo = 0, hi = 100;
      for (var i = 0; i < PERF_TUNE.solveIters; i++) {
        var mid = (lo + hi) / 2, v = G.measureSectionLenCm(sec, mid, side, minRootY);
        if (v == null) return null;
        if (v < targetCm) lo = mid; else hi = mid;
      }
      return Math.max(0, Math.min(100, Math.round((lo + hi) / 2)));
    };
  }

  // ② 얼굴 메쉬 반폭 기억 — 입력이 바뀌면(재촬영·새 손님) 자동으로 다시 계산
  var origFace = G.getFaceHalfWidthMesh;
  if (typeof origFace === 'function') {
    var memo = { lm: null, raw: null, w: 0, h: 0, v: 0 };
    G.getFaceHalfWidthMesh = function () {
      if (!PERF_TUNE.on) return origFace.apply(this, arguments);
      var S = (typeof state !== 'undefined') ? state : null, lm = S && S.landmarks && S.landmarks.front;
      var m = S && S.hairMasks && S.hairMasks.front;
      var raw = lm && lm.rawLandmarks, w = m && m.w || 0, h = m && m.h || 0;
      if (lm && memo.lm === lm && memo.raw === raw && memo.w === w && memo.h === h) { PERF_TUNE.faceHalfHits++; return memo.v; }
      var v = origFace.apply(this, arguments);
      memo.lm = lm; memo.raw = raw; memo.w = w; memo.h = h; memo.v = v;
      PERF_TUNE.faceHalfMiss++;
      return v;
    };
  }

  // ③ 진단 전용 비교 끄기 (필요하면 콘솔에서 RENDER_MATCH.on = true)
  try { if (typeof RENDER_MATCH !== 'undefined') RENDER_MATCH.on = false; } catch (e) {}
})();
