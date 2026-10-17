/* ==========================================================================
   22-ui-i18n-extra.js — 3D 미리보기 여닫기 + 뒤늦게 붙은 말 영역본 (2026-09-20)

   이 파일은 <b>난독화하지 않는다</b>. 앞의 파일들을 건드리지 않고 바깥에서만
   덧댄다 — 18-perf-i18n-boot.js의 I18N 표에 빠진 말을 더하고, 06-ui-panels.js의
   sync3DPreviewPanel을 감싸서 켜기 단추를 같이 여닫는다.

   ① 말(I18N)
      21-body-base.js가 3D 결과 화면에 새로 그리는 단추·쪽지는 한국어로 적혀 있고,
      I18N 표에 그 말이 없어서 EN으로 두어도 한국어 그대로 남았다. 여기서 표에
      더해 주면 기존 언어 단추(EN/한국어)가 그대로 두 언어를 오간다.
      ※ 화면에 <b>한국어로 적고 표에서 영어로 바꾸는</b> 것이 이 앱의 방식이다.
        21-body-base.js 안의 글자를 영어로 고치면 한국어로 못 돌아온다.

   ② 3D 미리보기 여닫기
      예전: 조정 화면에 미리보기가 늘 떠 있고 머리의 ⛶(전체화면)만 있었다.
            끄려면 스크롤을 한참 내려 "3D 미리보기: ON" 단추를 찾아야 했다.
      지금: 머리에 ✕를 두어 그 자리에서 끄고, 끄면 같은 구석에 "3D 미리보기 켜기"
            딱지가 앉는다. 아래쪽 단추는 index.html에서 뺐다.
      토글 알맹이(state.use3DAdjust·showDevMini3D)는 06-ui-panels.js 것을 그대로 쓴다.
   ========================================================================== */

/* ------------------------------------------------------------------ ① 말 */
(function extendI18N() {
  if (typeof I18N === 'undefined') {
    console.warn('[i18n] I18N 표가 없습니다 — 18-perf-i18n-boot.js보다 먼저 불렸습니까?');
    return;
  }
  Object.assign(I18N, {
    /* 몸·옷 단추 (21-body-base.js) */
    '남자': 'Male',
    '여자': 'Female',
    '외투 ': 'Outer ',
    '고른 옷 벗기': 'Remove pick',
    '옷 고르기': 'Browse',
    '옷 닫기': 'Close shop',
    '의상 고르기': 'Choose an outfit',
    '이 옷 보기': 'View this item',

    /* 단추에 붙는 설명(title) */
    '누르면 ': 'Switch to ',
    ' 몸으로 바꿉니다': ' body',
    '고른 옷(외투)을 입었다 벗깁니다 — 벗어도 고른 옷은 기억해 둡니다':
      'Takes the picked outer layer on and off — your pick is remembered',
    '슈트·재킷을 입었다 벗깁니다 (무슨 옷인지는 추천이 정합니다)':
      'Takes the suit or jacket on and off (the recommendation picks which)',
    '쇼핑몰에서 고른 옷을 벗고 추천 의상으로 돌아갑니다':
      'Drops your pick and goes back to the recommended outfit',

    /* 옷 이름 (BODY_WARDROBE) */
    '슈트': 'Suit',
    '재킷': 'Jacket',
    '원피스 슈트': 'Dress suit',
    '청바지': 'Jeans',
    '상의 + 하의': 'Top + bottoms',
    '상의': 'Top',
    '맨몸': 'No clothes',
    ' · 고름': ' · picked',
    ' · 쇼핑몰': ' · shop',
    '몸: ': 'Body: ',

    /* 쪽지(toast)·쇼핑몰 패널 */
    ' 몸에 맞는 옷이 아니라 추천 의상으로 돌아갑니다':
      ' — not an outfit for this body, going back to the recommendation',
    '고른 옷 정보를 받지 못했습니다 (': 'Couldn’t read the picked item (',
    '옷을 불러오지 못했습니다': 'Couldn’t load that outfit',
    '쇼핑몰을 여는 중…': 'Opening the shop…',
    '쇼핑몰 페이지를 화면 안에 띄우지 못했습니다.':
      'The shop page can’t be shown inside the app.',
    '새 탭에서 열기': 'Open in a new tab',
    '닫기': 'Close',

    /* 3D 미리보기 여닫기 (index.html) */
    '3D 미리보기 켜기': 'Show 3D preview',
    '미리보기 닫기': 'Close preview',
    '확대/축소': 'Expand / shrink'
  });
  /* 표가 늘었으니 부분치환 키 목록을 다시 만들게 한다(한 번 만들면 캐시된다). */
  try { _i18nSubKeys = null; } catch (e) {}
  /* 이미 그려진 화면이 있으면 지금 말로 다시 칠한다. */
  try { if (typeof applyUiLang === 'function') applyUiLang(); } catch (e) {}
})();

/* ==========================================================================
 * (옛 46-i18n-en.js) 영어 화면에 한글로 남아 있던 글자들 (2026-10-04) — 위 ①과 같은 일. 탭 제목은 18 applyUiLang 끝.
 *
 * 왜: 번역 표(I18N — 18번·22번)가 만들어진 뒤에 붙인 화면들(360° 촬영 · 조정 3D · 다시 기르기 · 피팅 ·
 *     진단 [복사] 등)은 표에 없어서 영어 화면(EN)에서도 한글로 나왔습니다. 그 글자들을 표에 넣습니다.
 *     원문(한글)은 그대로 두므로 [EN]/[한국어] 전환은 예전처럼 됩니다.
 *
 * 규칙(기존 표와 같음): 글자 전체가 표에 있으면 그대로 바꾸고, 아니면 긴 것부터 부분 치환.
 *   한두 낱말짜리 버튼 글자는 다른 문장 속에서 잘못 바뀌지 않게 "전체가 같을 때만"(I18N_EXACT_ONLY).
 *
 * 범위: 사용자가 보는 화면 글자(버튼·안내·알림·덮개). 진단 패널 본문(개발용 숫자 줄)과 콘솔 기록은 한글 그대로.
 * ========================================================================== */
(function extendI18N_late() {
  'use strict';

  var EXACT = {                                   // 전체가 같을 때만
    '시작': 'Start', '완료': 'Done', '복사': 'Copy', '의상': 'Outfit', '보기': 'View', '자동': 'Auto',
    '전신': 'Full body', '상반신': 'Upper body', '머리': 'Head', '원본 머리': 'Your hair'
  };
  var T = {
    /* ── 360° 촬영 (45) ── */
    '🔄 360° 촬영': '🔄 360° Capture',
    '저장된 360 세트 불러오기 (': 'Load saved 360 set (',
    '내보내기': 'Export', '가져오기': 'Import',
    '다시 시작': 'Restart', '수동 찍기': 'Manual shot', '좌우 바꾸기': 'Swap left/right', '카메라 다시 열기': 'Retry camera',
    '화면을 눌러 카메라 켜기': 'Tap to start the camera',
    '카메라를 여는 중…': 'Opening the camera…',
    '손님 정면에 서서 [시작]을 누르세요. 폰은 세워서 머리를 향하게.': 'Stand in front of the client and press [Start]. Hold the phone upright, pointed at the head.',
    '15~20초에 걸쳐 한 바퀴 · 손님은 고개와 머리카락을 움직이지 않습니다 · 출발점으로 돌아오면 [완료]': 'One full circle in 15–20 seconds · the client keeps head and hair still · press [Done] when you are back at the start',
    '너무 빨라요 — 천천히 도세요': 'Too fast — walk around slowly',
    '다 찍었어요 — [완료]를 누르세요': 'All angles captured — press [Done]',
    '머리를 타원 안에 두고 천천히 한 바퀴 도세요': 'Keep the head inside the oval and walk one slow circle',
    '폰을 세워서 손님 머리를 향해 주세요': 'Hold the phone upright and point it at the client’s head',
    '각도 센서가 없습니다 — [수동 찍기]로 한 장씩 찍으세요(정면부터 한 방향으로)': 'No rotation sensor — use [Manual shot] to take one photo at a time (start at the front, keep going one way)',
    '사진이 모자랍니다 — 정면·양옆·뒤가 다 찍혀야 해요': 'Not enough photos — front, both sides and back are all needed',
    '좌우를 바꿨어요': 'Left/right swapped', '좌우를 원래대로 했어요': 'Left/right back to normal',
    '360 세트가 비어 있습니다': 'The 360 set is empty',
    '360 세트에 ': 'The 360 set has no ', ' 각도 사진이 없습니다 — 다시 찍어 주세요': ' photo — please capture again',
    '360° 사진 ': '360° set: ', '장 — 4장을 슬롯에 넣었어요': ' photos — 4 placed in the slots',
    '내보낼 360 세트가 없습니다': 'No 360 set to export', '내보내기 실패': 'Export failed',
    '360 세트 파일을 읽지 못했습니다': 'Couldn’t read the 360 set file',
    '카메라는 https 주소에서만 열 수 있습니다 — 주소가 https://로 시작하는지 확인해 주세요': 'The camera only works on https — check that the address starts with https://',
    '이 브라우저에서는 카메라를 열 수 없습니다': 'This browser can’t open the camera',
    '카메라가 끊겼습니다 — [카메라 다시 열기]를 눌러 주세요': 'The camera was disconnected — press [Retry camera]',
    '카메라 영상이 나오지 않습니다 — 다른 앱이 카메라를 쓰고 있지 않은지 확인하고 [카메라 다시 열기]를 눌러 주세요': 'No picture from the camera — make sure no other app is using it, then press [Retry camera]',
    '카메라 권한이 꺼져 있습니다 — 브라우저 주소창의 카메라 권한을 허용한 뒤 [카메라 다시 열기]를 눌러 주세요': 'Camera permission is off — allow the camera in the browser’s address bar, then press [Retry camera]',
    '쓸 수 있는 카메라를 찾지 못했습니다': 'No usable camera found',
    '카메라를 열 수 없습니다 — 다른 앱이나 탭이 카메라를 쓰고 있지 않은지 확인하고 [카메라 다시 열기]를 눌러 주세요': 'Couldn’t open the camera — make sure no other app or tab is using it, then press [Retry camera]',

    /* ── 조정 화면 3D (43) · 원본 머리 (42) ── */
    '3D 모델 준비 중…': 'Preparing the 3D model…',
    '머리 만드는 중…': 'Building hair…',
    '드래그 회전 · Shift+드래그(두 손가락) 이동 · 휠(핀치) 확대': 'Drag to rotate · Shift+drag (two fingers) to move · wheel (pinch) to zoom',
    '뿌리부터 다시 기르는 중…': 'Rebuilding your hair from the roots…',
    '다시 만드는 중…': 'Rebuilding…',
    '원본 머리 · 치수 잼 — 긴 머리 · 볼륨 ': 'Your hair · measured — long hair · volume ',
    '원본 머리 · 치수 잼 — 윗머리 ': 'Your hair · measured — top ',
    '원본 머리 · 치수 잼': 'Your hair · measured',
    'cm · 옆 ': 'cm · sides ', 'cm · 뒤 ': 'cm · back ', 'cm · 볼륨 ': 'cm · volume ', ' · 넘김 ': ' · sweep ', ' · 컬 ': ' · curl ',
    'ON: 마네킹 모드(컬·스타일링을 지운 상태에서 시작) · OFF: 사진에서 다시 기른 원본 머리(치수 잼)': 'ON: mannequin mode (starts with curl and styling cleared) · OFF: your own hair rebuilt from the photos (measured)',
    '원본 머리를 아직 못 쟀어요 — 마네킹을 끄고 잠시 기다려 주세요': 'Your hair hasn’t been measured yet — turn the mannequin off and wait a moment',
    '이 스타일 이름을 입력하세요 (원본 머리에서 잰 숫자로 등록)': 'Name this style (saved from the numbers measured on your hair)',
    '스타일로 등록했어요: ': 'Saved as a style: ',
    '원본에서 잼': 'Measured from photos',

    /* ── 조정 화면 상태 줄 (05) ── */
    '] 랜드마크 없음 — 슬롯 기본각 ': '] no landmarks — assuming slot angle ', '° 가정': '°',
    '] 랜드마크 없음 — 촬영시점 실측 사용 yaw:': '] no landmarks — using the angle measured at capture, yaw:',
    '] 포즈행렬 없음 — 근사yaw:': '] no pose matrix — approx. yaw:', '만 사용': ' only', '(근사yaw:': '(approx. yaw:',

    /* ── 3D 결과 화면 피팅 (44) ── */
    '의상 입히는 중…': 'Changing outfit…', '직접 고름': 'Picked by you',

    /* ── 진단 패널 버튼 (38) ── */
    '복사됨 ✓': 'Copied ✓', '복사 실패': 'Copy failed',
    '진단 계산 중… (스타일을 고른 뒤 처음 열 때는 몇 초 걸립니다)': 'Calculating diagnostics… (takes a few seconds the first time after picking a style)',
    '진단 실패: ': 'Diagnostics failed: ',

    /* ── 원본 대조 (옛 60 · 07b PHOTO_CHECK) ── */
    '원본 대조': 'Compare photos', '지금 화면의 머리를 원본 사진의 머리 윤곽과 겹쳐 봅니다': 'Overlay the current hair on the hair outline of the original photos'
  };

  Object.assign(I18N, T, EXACT);
  try { if (typeof I18N_EXACT_ONLY !== 'undefined') Object.keys(EXACT).forEach(function (k) { I18N_EXACT_ONLY.add(k); }); } catch (e) {}
  try { _i18nSubKeys = null; } catch (e) {}

  try { if (typeof applyUiLang === 'function') applyUiLang(); } catch (e) {}
})();

/* -------------------------------------------------- ② 3D 미리보기 여닫기 */
/* 켜기 딱지는 미리보기가 앉던 구석에 그대로 앉는다(styles.css #devMini3D와 같은 자리).
   미리보기가 꺼져 있을 때만 보이고, 누르면 예전 단추와 똑같은 일을 한다. */
function _devMini3DOpenBtn() {
  let b = document.getElementById('devMini3DOpen');
  if (b) return b;
  const host = document.getElementById('devMini3D');
  const parent = host && host.parentNode;
  if (!parent) return null;
  b = document.createElement('button');
  b.id = 'devMini3DOpen';
  b.type = 'button';
  b.textContent = '3D 미리보기 켜기';
  b.addEventListener('click', () => {
    if (typeof toggle3DAdjust === 'function') toggle3DAdjust();
  });
  parent.appendChild(b);
  return b;
}

function syncDevMini3DOpenBtn() {
  const b = _devMini3DOpenBtn();
  if (!b) return;
  const on = !!(typeof state !== 'undefined' && state && state.use3DAdjust);
  b.style.display = on ? 'none' : 'block';
}

/* 06-ui-panels.js의 sync3DPreviewPanel을 감싼다 — 알맹이는 그대로 두고
   켜기 딱지만 뒤따라 맞춘다. 미리보기를 켜고 끄는 길이 여럿이어도(단추·음성·
   navTo에서 자동으로 켜는 길) 전부 이 함수를 지나므로 한 군데만 감싸면 된다. */
(function wrapSync3DPreviewPanel() {
  const inner = window.sync3DPreviewPanel;
  if (typeof inner !== 'function') {
    console.warn('[3D미리보기] sync3DPreviewPanel이 없습니다 — 06-ui-panels.js보다 먼저 불렸습니까?');
    return;
  }
  window.sync3DPreviewPanel = function () {
    const r = inner.apply(this, arguments);
    try { syncDevMini3DOpenBtn(); } catch (e) { console.warn('[3D미리보기] 켜기 단추 갱신 실패:', e); }
    return r;
  };
})();

/* 화면이 처음 서고 나면 한 번 맞춰 둔다(조정 화면에 아직 안 들어갔을 때 대비). */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { try { syncDevMini3DOpenBtn(); } catch (e) {} });
} else {
  try { syncDevMini3DOpenBtn(); } catch (e) {}
}
