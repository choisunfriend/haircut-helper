/* 44-i18n-offline.js — "오프라인에서도 가동됩니다" 배지의 영어 표기 (2026-11-19)

   이 파일은 난독화하지 않는다. 18-perf-i18n-boot.js의 I18N 표에 한 줄만 더한다.

   이 앱의 방식: 화면에는 한국어로 적고, I18N 표에서 영어로 바꾼다.
   index.html의 배지 글자를 영어로 고치면 한국어로 못 돌아온다.

   로드 순서: I18N을 만드는 18-perf-i18n-boot.js 뒤라면 어디든 된다.
   index.html에서는 맨 끝에 둔다.
*/
(function () {
  if (typeof I18N === 'undefined') return;
  Object.assign(I18N, {
    '오프라인에서도 가동됩니다': 'Works offline, too'
  });
}());
