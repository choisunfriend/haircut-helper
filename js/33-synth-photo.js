/* ══════════════════════════════════════════════════════════
   33-synth-photo.js — 생성 사진(AI가 그린 4장) 보정 · 테스트 기간 전용
   (2026-10-20)

   원칙: 엔진(17b REGROW 등)은 <b>실제 사진</b> 기준으로 만든다.
         생성 사진은 장마다 따로 그려서 같은 머리라도 사진끼리 결이 엇갈린다
         (실측: 두 장이 같이 읽은 걸음에서 방향 차이 중앙값 25° · p90 66°).
         그 차이를 감안해 <b>결과값만</b> 느슨하게 바꾸는 것은 전부 이 파일에 둔다.

   빼는 법: 생성 사진 테스트가 끝나면 index.html에서 이 파일의 <script> 한 줄만 지운다.
            엔진 쪽은 SYNTH_PHOTO가 없으면 원래 값(실제 사진 기준)으로 돈다.

   잠깐 끄기: 주소 끝에 ?synth=0  ·  콘솔 SYNTH_PHOTO.off() 후 다시 기르기
   다시 켜기: ?synth=1             ·  콘솔 SYNTH_PHOTO.on_() 후 다시 기르기

   여기서 바꾸는 값(엔진 기본값 → 생성 사진 값):
     REGROW.agreeDeg    30   → 50      사진끼리 이만큼 벌어져도 같은 결로 봄
     REGROW.agreeAmbig  skip → 'mean'  갈피를 못 잡으면 관성 대신 예전처럼 가중 평균
   ══════════════════════════════════════════════════════════ */
var SYNTH_PHOTO = (function () {
  'use strict';
  var W = window, TAG = '[생성 사진 보정]';
  var SET = {                       // 생성 사진일 때 덮어쓸 값 — 키: 전역 객체 이름 → { 속성: 값 }
    REGROW: { agreeDeg: 50, agreeAmbig: 'mean' }
  };
  var saved = {};                   // 덮어쓰기 전 엔진 값(끌 때 되돌림)

  function qsFlag() {
    try { var m = /[?&]synth=([01])/.exec(location.search); if (m) return m[1] === '1'; } catch (e) {}
    return null;
  }

  var S = {
    on: false,
    applied: [],                    // 진단용: 실제로 바꾼 값들
    apply: function () {
      S.applied = [];
      Object.keys(SET).forEach(function (obj) {
        var T = W[obj]; if (!T) return;
        saved[obj] = saved[obj] || {};
        Object.keys(SET[obj]).forEach(function (k) {
          if (!(k in saved[obj])) saved[obj][k] = T[k];
          T[k] = SET[obj][k];
          S.applied.push(obj + '.' + k + ' ' + saved[obj][k] + '→' + T[k]);
        });
      });
      S.on = true;
      try { console.log(TAG + ' 켜짐 — ' + S.applied.join(' · ') + ' (끄기 ?synth=0 또는 SYNTH_PHOTO.off())'); } catch (e) {}
    },
    restore: function () {
      Object.keys(saved).forEach(function (obj) {
        var T = W[obj]; if (!T) return;
        Object.keys(saved[obj]).forEach(function (k) { T[k] = saved[obj][k]; });
      });
      S.on = false; S.applied = [];
      try { console.log(TAG + ' 꺼짐 — 엔진 기본값(실제 사진 기준)으로 돌림'); } catch (e) {}
    },
    off: function () { S.restore(); return '다시 기르기를 다시 하면 반영됩니다'; },
    on_: function () { S.apply(); return '다시 기르기를 다시 하면 반영됩니다'; },
    line: function () {             // 진단 한 줄
      return TAG + ' ' + (S.on ? '켜짐 — ' + S.applied.join(' · ') : '꺼짐(실제 사진 기준)') + ' · 끄기 ?synth=0';
    }
  };

  // 테스트 기간 기본값: 켬(지금 쓰는 사진이 전부 생성 사진). 주소 ?synth=0이면 끔.
  var q = qsFlag();
  if (q !== false) S.apply();
  return S;
})();
