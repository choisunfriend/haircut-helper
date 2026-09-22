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
