// ============================================================================
// 49-onboarding.js (2026-11-24) — 고객용 배포본 전용: 첫 실행 안내 + 도움말(?)
// ============================================================================
// · 표지(앱을 열 때마다 — [건너뛰기]·[다음부터 보지 않기] 전까지): 넘겨 보는 5장(소개 · 기본 촬영 · 360° 촬영 · 스타일→3D · 사진과 개인정보) → [시작하기]에서 카메라를 켬
//   (index.html 맨 앞 인라인 스크립트가 window.__deferCam을 세우면 05의 시작 때 initCamera()를 건너뜀)
//   [건너뛰기]·[다음부터 보지 않기]를 누르면 localStorage 'gyeol.onboard' = '1' — 다음부터 안 띄움([시작하기]는 기억 안 함)
// · 표지(2026-11-25): 소개 5장을 [건너뛰기]·[다음부터 보지 않기]로 끈 뒤에도 앱을 열 때마다 1장짜리 표지(앱 이름 · [시작하기] · [📖 사용 설명서] · 처음 안내 다시 보기 · ©)가 나옴 — [시작하기]에서 카메라를 켬
//   (index.html의 __deferCam은 늘 true — 표지 뒤에서 카메라가 먼저 켜지지 않게)
// · 사용 설명서: 도움말 [사용 설명서] — 단계별 실제 화면(AI 생성 인물) + 설명. 촬영·360·스타일·3D·컬러·옷(쇼핑몰)·미용실 맵·개인정보
// · 도움말: 헤더 언어 버튼 옆 [?] — 지금 화면(촬영·스타일·3D)에 맞는 설명 + "처음 안내 다시 보기"
// · 언어: 앱 언어(uiLang — 기기 지역 언어로 시작, 버튼으로 바꾸면 기억)를 따름. 바꾸면 열린 창도 다시 그림
// · 그림: 실루엣 SVG(코드 안) — 사진 없음
// 끄기: ONBOARD.on = false (새로고침)
// ============================================================================
var ONBOARD = (function () {
  'use strict';
  var W = window, TAG = '[첫 안내]', KEY = 'gyeol.onboard';
  var O = Object.assign({ on: true }, W.ONBOARD || {});
  if (!O.on) { try { if (W.__deferCam && typeof initCamera === 'function') initCamera(); } catch (e) {} return O; }
  function en() { try { return typeof uiLang !== 'undefined' && uiLang === 'en'; } catch (e) { return false; } }
  function L(ko, e) { return en() ? e : ko; }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function seen() { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } }
  function markSeen() { try { localStorage.setItem(KEY, '1'); } catch (e) {} }

  // ---- 실루엣 그림 ----------------------------------------------------------------------------------
  var INK = '#E8D9C6', SOFT = 'rgba(232,217,198,0.35)', ACC = '#E0A05A', HAIR = '#5A3E2B';
  // 머리(옆모습·정면·뒷모습) — 단순 실루엣
  function headFront(x, y, s) {
    return '<g transform="translate(' + x + ',' + y + ') scale(' + s + ')">'
      + '<path d="M-34,-6 C-36,-44 -14,-62 0,-62 C14,-62 36,-44 34,-6 C38,14 32,36 26,44 L-26,44 C-32,36 -38,14 -34,-6Z" fill="' + HAIR + '"/>'
      + '<ellipse cx="0" cy="-4" rx="24" ry="31" fill="' + INK + '"/>'
      + '<path d="M-26,-14 C-22,-40 22,-40 26,-14 C14,-28 -14,-28 -26,-14Z" fill="' + HAIR + '"/>'
      + '<rect x="-10" y="24" width="20" height="22" fill="' + INK + '"/>'
      + '<path d="M-44,72 C-40,52 -20,44 0,44 C20,44 40,52 44,72Z" fill="' + INK + '"/></g>';
  }
  function headSide(x, y, s, flip) {
    return '<g transform="translate(' + x + ',' + y + ') scale(' + (flip ? -s : s) + ',' + s + ')">'
      + '<path d="M-30,-10 C-32,-46 -6,-62 8,-60 C30,-56 38,-34 32,-6 C30,16 22,40 -4,44 L-30,40 C-36,24 -34,6 -30,-10Z" fill="' + HAIR + '"/>'
      + '<path d="M2,-36 C22,-36 30,-20 30,-6 L36,6 L30,10 C30,22 24,30 12,30 L-2,30 C-12,20 -12,-26 2,-36Z" fill="' + INK + '"/>'
      + '<rect x="-6" y="24" width="18" height="22" fill="' + INK + '"/>'
      + '<path d="M-40,72 C-36,52 -16,44 4,44 C24,44 38,52 42,72Z" fill="' + INK + '"/></g>';
  }
  function headBack(x, y, s) {
    return '<g transform="translate(' + x + ',' + y + ') scale(' + s + ')">'
      + '<rect x="-10" y="24" width="20" height="22" fill="' + INK + '"/>'
      + '<path d="M-44,72 C-40,52 -20,44 0,44 C20,44 40,52 44,72Z" fill="' + INK + '"/>'
      + '<path d="M-34,-6 C-36,-44 -14,-62 0,-62 C14,-62 36,-44 34,-6 C36,16 30,34 22,40 C10,44 -10,44 -22,40 C-30,34 -36,16 -34,-6Z" fill="' + HAIR + '"/>'
      + '<path d="M0,-58 C-4,-30 -2,10 0,38" stroke="rgba(0,0,0,0.25)" stroke-width="2" fill="none"/></g>';
  }
  function phone(x, y, s, rot) {
    return '<g transform="translate(' + x + ',' + y + ') rotate(' + (rot || 0) + ') scale(' + s + ')">'
      + '<rect x="-14" y="-24" width="28" height="48" rx="5" fill="#2A2420" stroke="' + ACC + '" stroke-width="2.5"/>'
      + '<circle cx="0" cy="-17" r="2.4" fill="' + ACC + '"/></g>';
  }
  function svg(inner) { return '<svg viewBox="0 0 320 200" width="100%" style="max-height:200px;display:block;margin:0 auto;" xmlns="http://www.w3.org/2000/svg">' + inner + '</svg>'; }
  // 실제 앱 화면(예시) — 사진 속 인물은 AI로 만든 가상 인물. 캡션에 늘 적음
  var SHOT_DIR = 'assets/onboard/';
  function cap() { return '<div style="font-size:11px;opacity:.6;text-align:center;margin-top:6px;">' + esc(L('예시 화면 · 사진 속 인물은 AI로 만든 가상 인물이에요', 'Example screens · the person shown is AI-generated')) + '</div>'; }
  function shots(names, h) {
    return '<div style="display:flex;gap:10px;justify-content:center;">' + names.map(function (n) {
      return '<img src="' + SHOT_DIR + n + '.jpg" alt="" style="max-height:' + (h || 230) + 'px;max-width:' + (names.length > 1 ? '48%' : '78%') + ';border-radius:12px;border:1px solid rgba(243,233,218,.2);object-fit:cover;object-position:top;">';
    }).join('') + '</div>' + cap();
  }
  O.shots = shots;
  var ART = {
    intro: function () {
      return svg(
        '<ellipse cx="160" cy="186" rx="70" ry="8" fill="rgba(0,0,0,0.25)"/>'
        + headFront(160, 108, 1.15)
        + '<path d="M78,92 A86,30 0 0 0 242,92" fill="none" stroke="' + ACC + '" stroke-width="3" stroke-dasharray="7 6"/>'
        + '<path d="M236,82 L246,93 L232,98" fill="none" stroke="' + ACC + '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'
        + '<text x="160" y="30" text-anchor="middle" font-size="18" font-weight="800" fill="' + ACC + '">3D</text>'
        + '<path d="M60,40 l4,10 l10,4 l-10,4 l-4,10 l-4,-10 l-10,-4 l10,-4Z" fill="' + ACC + '" opacity=".8"/>'
        + '<path d="M262,138 l3,7 l7,3 l-7,3 l-3,7 l-3,-7 l-7,-3 l7,-3Z" fill="' + ACC + '" opacity=".6"/>');
    },
    four: function () {
      var lab = en() ? ['Front', 'Left', 'Right', 'Back'] : ['정면', '왼쪽', '오른쪽', '뒤'];
      var xs = [44, 122, 200, 278], h = [headFront, function (x, y, s) { return headSide(x, y, s, true); }, function (x, y, s) { return headSide(x, y, s, false); }, headBack];
      var g = '';
      for (var i = 0; i < 4; i++) {
        g += '<rect x="' + (xs[i] - 34) + '" y="22" width="68" height="128" rx="10" fill="none" stroke="' + SOFT + '" stroke-width="2"/>'
          + h[i](xs[i], 92, 0.62)
          + '<text x="' + xs[i] + '" y="174" text-anchor="middle" font-size="14" font-weight="700" fill="' + INK + '">' + esc(lab[i]) + '</text>'
          + '<circle cx="' + (xs[i] + 24) + '" cy="34" r="8" fill="' + ACC + '"/><text x="' + (xs[i] + 24) + '" y="38.5" text-anchor="middle" font-size="11" font-weight="800" fill="#1B1816">' + (i + 1) + '</text>';
      }
      return svg(g);
    },
    orbit: function () {
      // 위에서 내려다본 그림: 가운데 머리(정수리) · 둘레 점선 · 폰이 원을 따라 돎
      var g = '<ellipse cx="160" cy="104" rx="118" ry="78" fill="none" stroke="' + ACC + '" stroke-width="3" stroke-dasharray="8 7"/>'
        // 어깨 + 머리(위에서)
        + '<ellipse cx="160" cy="112" rx="44" ry="17" fill="' + INK + '" opacity=".9"/>'
        + '<circle cx="160" cy="104" r="24" fill="' + HAIR + '"/>'
        + '<path d="M160,80 l-6,-9 l12,0Z" fill="' + INK + '"/>'   // 코 방향(정면)
        + phone(160, 26, 0.9, 180)
        + phone(278, 104, 0.8, 0)
        + phone(42, 104, 0.8, 0)
        + '<path d="M196,30 A118,78 0 0 1 246,48" fill="none" stroke="' + INK + '" stroke-width="3.5" stroke-linecap="round"/>'
        + '<path d="M234,38 L247,49 L231,54" fill="none" stroke="' + INK + '" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>'
        + '<text x="160" y="196" text-anchor="middle" font-size="13" font-weight="700" fill="' + INK + '">' + esc(L('15~20초에 천천히 한 바퀴', 'One slow circle · 15–20 s')) + '</text>';
      return svg(g);
    },
    style: function () {
      var g = '';
      for (var r = 0; r < 2; r++) for (var c = 0; c < 2; c++) {
        var x = 30 + c * 44, y = 40 + r * 58, on = r === 0 && c === 1;
        g += '<rect x="' + x + '" y="' + y + '" width="38" height="50" rx="7" fill="' + (on ? 'rgba(224,160,90,0.25)' : 'rgba(255,255,255,0.06)') + '" stroke="' + (on ? ACC : SOFT) + '" stroke-width="2"/>'
          + '<path d="M' + (x + 8) + ',' + (y + 30) + ' C' + (x + 8) + ',' + (y + 8) + ' ' + (x + 30) + ',' + (y + 8) + ' ' + (x + 30) + ',' + (y + 30) + ' L' + (x + 30) + ',' + (y + 40) + ' L' + (x + 8) + ',' + (y + 40) + 'Z" fill="' + HAIR + '"/>';
      }
      g += '<path d="M130,104 L172,104" stroke="' + ACC + '" stroke-width="4" stroke-linecap="round"/><path d="M162,94 L174,104 L162,114" fill="none" stroke="' + ACC + '" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>';
      g += headFront(236, 92, 0.85)
        + '<path d="M196,140 A42,12 0 0 0 276,140" fill="none" stroke="' + ACC + '" stroke-width="2.5" stroke-dasharray="5 5"/>';
      ['#2B2016', '#8B5A2B', '#C89860', '#7A3B4A'].forEach(function (col, i) { g += '<circle cx="' + (206 + i * 20) + '" cy="178" r="7" fill="' + col + '" stroke="' + INK + '" stroke-width="1.5"/>'; });
      return svg(g);
    },
    privacy: function () {
      return svg(
        phone(160, 100, 2.6, 0)
        + '<path d="M160,74 L184,84 L184,102 C184,118 172,128 160,132 C148,128 136,118 136,102 L136,84Z" fill="' + ACC + '"/>'
        + '<path d="M149,103 L157,111 L172,95" fill="none" stroke="#1B1816" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>'
        + '<path d="M70,70 L100,90 M70,130 L100,110 M250,70 L220,90 M250,130 L220,110" stroke="' + SOFT + '" stroke-width="3" stroke-linecap="round"/>');
    }
  };

  // ---- 안내 장 ------------------------------------------------------------------------------------
  function slides() {
    return [
      { art: 'intro', t: L('내 머리에 스타일을 입혀 보세요', 'Try hairstyles on your own head'),
        b: L('사진 몇 장으로 내 두상을 3D로 만들고, 헤어스타일을 입혀서 돌려 보며 확인해요.', 'A few photos turn into a 3D model of your head. Put on hairstyles and turn it around to see every side.') },
      { art: 'four', shot: ['capture'], t: L('기본 촬영 — 4장', 'Basic photos — 4 shots'),
        b: L('정면 · 왼쪽 · 오른쪽 · 뒤를 한 장씩 찍어요.<br>· 밝은 곳에서, 머리 전체가 화면에 들어오게<br>· 머리를 묶거나 모자를 쓰지 않은 상태로<br>· 뒷모습은 누가 찍어 주거나 사진을 올려도 돼요',
             'Take one photo each from the front, left, right and back.<br>· In good light, with your whole head in frame<br>· Hair down, no hat<br>· Someone can take the back photo, or you can upload one') },
      { art: 'orbit', t: L('더 정밀하게 — 360° 촬영', 'More accurate — 360° capture'),
        b: L('도와줄 사람이 폰을 들고 내 주위를 한 바퀴 돌면, 각도마다 가장 선명한 사진을 자동으로 골라요.<br>· 찍는 사람: 내 정면에서 [시작] → 머리를 화면 타원 안에 두고 15~20초 동안 천천히 한 바퀴 → 출발점에서 [끝내기]<br>· 찍히는 사람: 고개와 머리카락을 움직이지 마세요<br>촬영 화면의 「🔄 360° 촬영」 버튼으로 시작해요.',
             'A helper holds the phone and walks once around you; the sharpest photo at each angle is picked automatically.<br>· Helper: start in front of you with [Start] → keep your head inside the oval → one slow circle in 15–20 s → [Finish] back at the start<br>· You: keep your head and hair still<br>Start with the “🔄 360° Capture” button on the photo screen.') },
      { art: 'style', shot: ['model3d', 'map'], t: L('스타일 고르고 3D로 보기', 'Pick a style, see it in 3D'),
        b: L('스타일을 고르면 3D 두상에 입혀서 보여 줘요. 손가락으로 돌려 보고, 왼쪽 아래 「헤어 컬러」로 색을 바꾸고, 「맵에서 고르기」로 그 스타일을 하는 미용실이나 어울리는 옷을 파는 가게를 찾아요.<br>· 「스타일 미적용」은 지금 내 머리를 그대로 3D로 보여 줘요. 머리결을 하나하나 분석해서 시간이 오래 걸려요.',
             'Pick a style and it goes onto your 3D head. Turn it with your finger, change the color with “Hair color” at the bottom left, and find salons or clothing stores with “Pick on map”.<br>· “No style applied” shows your current hair as it is in 3D. It analyzes every strand, so it takes a while.') },
      { art: 'privacy', t: L('사진은 이 기기 안에서만', 'Your photos stay on this device'),
        b: L('찍은 사진은 이 기기 안에서만 분석하고, 서버로 보내지 않아요. 다음 화면에서 카메라 사용을 허용해 주세요.',
             'Photos are analyzed only on this device and are never uploaded. Please allow camera access on the next screen.') }
    ];
  }

  var ov = null, idx = 0;
  function css() {
    if (document.getElementById('onboardStyle')) return;
    var st = document.createElement('style'); st.id = 'onboardStyle';
    st.textContent = '#onboardOv{position:fixed;inset:0;z-index:9500;background:#1B1816;color:#F3E9DA;display:flex;flex-direction:column;'
      + 'padding:max(14px,env(safe-area-inset-top,0px)) 18px max(16px,env(safe-area-inset-bottom,0px));font-family:inherit;}'
      + '#onboardOv .ob-top{display:flex;justify-content:space-between;min-height:32px;}'
      + '#onboardOv .ob-skip,#onboardOv .ob-never{background:none;border:none;color:rgba(243,233,218,.7);font-size:14px;padding:6px 4px;cursor:pointer;}'
      + '#onboardOv .ob-never{font-size:12.5px;text-decoration:underline;color:rgba(243,233,218,.55);}'
      + '#onboardOv .ob-body{flex:1;display:flex;flex-direction:column;justify-content:center;max-width:460px;width:100%;margin:0 auto;overflow-y:auto;}'
      + '#onboardOv h2{font-size:21px;font-weight:800;margin:18px 0 10px;line-height:1.35;}'
      + '#onboardOv .ob-text{font-size:14.5px;line-height:1.65;color:rgba(243,233,218,.88);}'
      + '#onboardOv .ob-dots{display:flex;justify-content:center;gap:7px;margin:14px 0;}'
      + '#onboardOv .ob-dots i{width:7px;height:7px;border-radius:50%;background:rgba(243,233,218,.25);}'
      + '#onboardOv .ob-dots i.on{background:#E0A05A;width:20px;border-radius:4px;}'
      + '#onboardOv .ob-nav{display:flex;gap:10px;max-width:460px;width:100%;margin:0 auto;}'
      + '#onboardOv .ob-nav button{flex:1;padding:14px;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;}'
      + '#onboardOv .ob-prev{background:transparent;border:1px solid rgba(243,233,218,.25);color:#F3E9DA;}'
      + '#onboardOv .ob-next{flex:2 !important;background:#C98B4F;border:none;color:#1B1816;}'
      + '#helpBtn{margin-left:6px;width:30px;height:30px;border-radius:50%;border:1px solid rgba(243,233,218,.3);background:transparent;color:#F3E9DA;font-weight:800;font-size:15px;cursor:pointer;flex:none;}'
      + '#helpOv{position:fixed;inset:0;z-index:9600;background:rgba(10,8,6,.72);display:flex;align-items:flex-end;justify-content:center;}'
      + '#helpOv .hp-sheet{background:#FBF8F4;color:#1E1A16;width:100%;max-width:520px;max-height:85%;overflow-y:auto;border-radius:16px 16px 0 0;'
      + 'padding:18px 18px max(18px,env(safe-area-inset-bottom,0px));font-size:14px;line-height:1.6;}'
      + '#helpOv h3{margin:0 0 6px;font-size:17px;} #helpOv h4{margin:14px 0 4px;font-size:14px;color:#8C5A2B;}'
      + '#helpOv ul{margin:4px 0;padding-left:18px;} #helpOv .hp-row{display:flex;gap:8px;margin-top:16px;}'
      + '#helpOv .hp-row button{flex:1;padding:11px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;border:1px solid #D9CDBF;background:#fff;color:#1E1A16;}'
      + '#helpOv .hp-row .hp-close{background:#C98B4F;border:none;}';
    document.head.appendChild(st);
  }
  function draw() {
    var S = slides(), s = S[idx], last = idx === S.length - 1;
    ov.innerHTML = '<div class="ob-top"><button class="ob-never" type="button">' + esc(L('다음부터 보지 않기', 'Don’t show again')) + '</button>'
      + '<button class="ob-skip" type="button">' + esc(last ? '' : L('건너뛰기', 'Skip')) + '</button></div>'
      + '<div class="ob-body">' + (s.shot ? shots(s.shot, s.shot.length > 1 ? 250 : 260) : ART[s.art]()) + '<h2>' + esc(s.t) + '</h2><div class="ob-text">' + s.b + '</div></div>'
      + '<div class="ob-dots">' + S.map(function (_, i) { return '<i class="' + (i === idx ? 'on' : '') + '"></i>'; }).join('') + '</div>'
      + '<div class="ob-nav">' + (idx > 0 ? '<button class="ob-prev" type="button">' + esc(L('이전', 'Back')) + '</button>' : '')
      + '<button class="ob-next" type="button">' + esc(last ? L('시작하기', 'Get started') : L('다음', 'Next')) + '</button></div>';
    ov.querySelector('.ob-skip').onclick = function () { if (!last) finish(true); };
    ov.querySelector('.ob-never').onclick = function () { finish(true); };
    var pv = ov.querySelector('.ob-prev'); if (pv) pv.onclick = function () { idx--; draw(); };
    ov.querySelector('.ob-next').onclick = function () { if (last) finish(false); else { idx++; draw(); } };
  }
  // 옆으로 밀어 넘기기
  function swipe(el) {
    var x0 = null;
    el.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    el.addEventListener('touchend', function (e) {
      if (x0 == null) return; var dx = e.changedTouches[0].clientX - x0; x0 = null;
      var n = slides().length;
      if (dx < -50 && idx < n - 1) { idx++; draw(); } else if (dx > 50 && idx > 0) { idx--; draw(); }
    }, { passive: true });
  }
  O.show = function (from) {
    css(); idx = from || 0;
    if (!ov) { ov = document.createElement('div'); ov.id = 'onboardOv'; document.body.appendChild(ov); swipe(ov); }
    ov.style.display = 'flex'; draw();
  };
  var camStarted = false;
  function startCam() {
    if (camStarted) return; camStarted = true;
    try { if (typeof cameraStream !== 'undefined' && cameraStream) return; } catch (e) {}   // (11-25) 05가 이미 켰으면 다시 안 켬(두 번 열림 방지)
    try { if (W.__deferCam && typeof initCamera === 'function') initCamera(); } catch (e) { console.warn(TAG + ' 카메라 시작 실패', e); }
  }
  /* 표지는 [건너뛰기]·[다음부터 보지 않기]를 누를 때까지 앱을 열 때마다 나옴(사용자 지정 11-24).
     [시작하기]로 끝까지 본 것만으로는 기억하지 않음. */
  function finish(remember) {
    if (remember) markSeen();
    if (ov) ov.style.display = 'none';
    try { closeHelp(); } catch (e) {}
    startCam();
  }

  // ---- 도움말 ------------------------------------------------------------------------------------
  function helpShots(names) {
    return '<div style="background:#1B1816;border-radius:12px;padding:10px;margin:8px 0 4px;color:#F3E9DA;">' + shots(names, 200) + '</div>';
  }
  function helpHTML() {
    var scr = 'capture'; try { scr = currentScreen || 'capture'; } catch (e) {}
    var h = '<h3>' + esc(L('도움말', 'Help')) + '</h3>';
    if (scr === 'capture') {
      h += helpShots(['capture']);
      h += '<h4>' + esc(L('기본 촬영 (4장)', 'Basic photos (4)')) + '</h4><ul>'
        + '<li>' + L('정면 → 왼쪽 → 오른쪽 → 뒤 순서로 촬영 버튼을 눌러요.', 'Press the shutter for front → left → right → back.') + '</li>'
        + '<li>' + L('머리 전체가 화면에 들어오게, 밝은 곳에서 찍어요.', 'Keep your whole head in frame, in good light.') + '</li>'
        + '<li>' + L('마음에 안 들면 「재촬영」, 갤러리 사진은 「업로드」.', 'Use “Retake” to redo, “Upload” for a gallery photo.') + '</li>'
        + '<li>' + L('4장을 다 찍으면 「다음→」으로 스타일을 골라요.', 'After 4 photos, tap “Next→” to pick a style.') + '</li></ul>'
        + '<h4>' + esc(L('360° 촬영 (더 정밀하게)', '360° capture (more accurate)')) + '</h4><ul>'
        + '<li>' + L('도와줄 사람이 필요해요. 「🔄 360° 촬영」을 누르면 뒤 카메라가 열려요.', 'You need a helper. “🔄 360° Capture” opens the back camera.') + '</li>'
        + '<li>' + L('찍는 사람은 내 정면에서 [시작] → 머리를 타원 안에 두고 15~20초 동안 천천히 한 바퀴 → 출발점에서 [끝내기].', 'The helper starts in front of you with [Start] → keeps your head in the oval → walks one slow circle in 15–20 s → [Finish] back at the start.') + '</li>'
        + '<li>' + L('찍는 동안 고개와 머리카락을 움직이지 마세요.', 'Keep your head and hair still while it records.') + '</li>'
        + '<li>' + L('왼쪽·오른쪽이 바뀌어 보이면 「좌우 바꾸기」.', 'If left and right look swapped, tap “Swap left/right”.') + '</li></ul>'
        + '<h4>' + esc(L('카메라가 안 켜질 때', 'Camera won’t start')) + '</h4><ul>'
        + '<li>' + L('기기 설정에서 이 앱의 카메라 권한을 켜 주세요.', 'Turn on camera permission for this app in your device settings.') + '</li>'
        + '<li>' + L('다른 앱이 카메라를 쓰고 있으면 닫고 다시 열어 주세요.', 'Close other apps using the camera, then try again.') + '</li></ul>';
    } else if (scr === 'style') {
      h += '<h4>' + esc(L('스타일 고르기', 'Picking a style')) + '</h4><ul>'
        + '<li>' + L('카드를 눌러 스타일을 고르고 「3D로 보기 →」를 눌러요.', 'Tap a card to pick a style, then “View in 3D →”.') + '</li>'
        + '<li>' + L('3D로 입히는 데 몇 초 걸려요(기기에 따라 더 걸릴 수 있어요).', 'Putting it on in 3D takes a few seconds (longer on some devices).') + '</li>'
        + '<li>' + L('「스타일 미적용」은 지금 내 머리를 그대로 표현해요. 사진 속 머리결을 분석하느라 시간이 오래 걸려요(기기에 따라 1분 이상).', '“No style applied” shows your hair as it is now. Analyzing your photos takes a while (a minute or more on some devices).') + '</li>'
        + '<li>' + L('사진을 다시 찍으려면 「← 촬영」.', 'To retake photos, tap “← Capture”.') + '</li></ul>';
    } else {
      h += helpShots(['model3d', 'map']);
      h += '<h4>' + esc(L('3D 보기', '3D view')) + '</h4><ul>'
        + '<li>' + L('한 손가락으로 끌면 돌아가요. 두 손가락으로 벌리면 확대, 두 손가락으로 끌면 이동.', 'Drag with one finger to turn. Pinch to zoom, drag with two fingers to move.') + '</li>'
        + '<li>' + L('오른쪽 아래 ↺로 처음 보기로 돌아가요.', '↺ at the bottom right resets the view.') + '</li></ul>'
        + '<h4>' + esc(L('헤어 컬러', 'Hair color')) + '</h4><ul>'
        + '<li>' + L('왼쪽 아래 「헤어 컬러」를 누르면 펼쳐져요. 색 견본을 누르거나 밝기·채도·색상을 움직여요.', 'Tap “Hair color” at the bottom left. Pick a swatch or move lightness, vividness and hue.') + '</li>'
        + '<li>' + L('「원래 색으로」는 염색 전 머리색. 화면 색은 참고용이에요.', '“Reset” goes back to your natural color. Screen color is only a guide.') + '</li></ul>'
        + '<h4>' + esc(L('옷 · 미용실 · 옷가게', 'Outfits · salons · stores')) + '</h4><ul>'
        + '<li>' + L('「옷 고르기」로 옷을 바꿔 입혀 봐요. 위쪽 Hair pin으로 머리핀도.', 'Change outfits with “Pick clothes”; try hair pins at the top.') + '</li>'
        + '<li>' + L('「맵에서 고르기」로 근처 미용실·옷가게를 찾고, 그 가게의 헤어스타일이나 옷을 입어 봐요.', 'Use “Pick on map” to find nearby salons and clothing stores, and try on their styles or clothes.') + '</li></ul>';
    }
    h += '<div class="hp-row" style="margin-top:12px;"><button type="button" class="hp-manual" style="background:#1B1816;color:#F3E9DA;border:none;">📖 ' + esc(L('사용 설명서 (전체 화면 보기)', 'Full user guide')) + '</button></div>';
    h += '<div class="hp-row"><button type="button" class="hp-again">' + esc(L('처음 안내 다시 보기', 'Show intro again')) + '</button>'
      + '<button type="button" class="hp-close">' + esc(L('닫기', 'Close')) + '</button></div>';
    return h;
  }

  // ---- 사용 설명서(단계별 실제 화면 + 설명) ---------------------------------------------------------
  function img(n) { return '<img src="' + SHOT_DIR + n + '.jpg" alt="" style="width:100%;border-radius:10px;border:1px solid #E2D6C8;display:block;">'; }
  function row(names) {
    return '<div style="display:grid;grid-template-columns:repeat(' + names.length + ',1fr);gap:8px;margin:8px auto 4px;' + (names.length === 1 ? 'max-width:62%;' : '') + '">'
      + names.map(function (n) { return '<div>' + img(n.f) + (n.c ? '<div style="font-size:11.5px;color:#6E6258;text-align:center;margin-top:4px;">' + esc(n.c) + '</div>' : '') + '</div>'; }).join('') + '</div>';
  }
  function aiNote() { return '<div style="font-size:11px;color:#9A8E84;margin:2px 0 6px;">' + esc(L('예시 화면 · 사진 속 인물은 AI로 만든 가상 인물이에요', 'Example screens · the person shown is AI-generated')) + '</div>'; }
  function sec(n, title, body) {
    return '<section style="margin:18px 0 8px;"><h4 style="margin:0 0 6px;font-size:15px;color:#8C5A2B;">' + n + '. ' + esc(title) + '</h4>' + body + '</section>';
  }
  function ul(items) { return '<ul style="margin:4px 0;padding-left:18px;">' + items.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul>'; }
  function manualHTML() {
    var h = '<h3 style="margin:0 0 4px;font-size:19px;">' + esc(L('사용 설명서', 'User guide')) + '</h3>'
      + '<div style="font-size:12.5px;color:#7A6F66;">' + esc(L('촬영 → 스타일 → 3D 순서로 진행해요.', 'Go from photos → style → 3D.')) + '</div>';
    h += sec(1, L('기본 촬영 (4장)', 'Basic photos (4)'),
      row([{ f: 'capture', c: L('촬영 화면', 'Photo screen') }]) + aiNote()
      + ul([L('정면 → 왼쪽 → 오른쪽 → 뒤 순서로 가운데 촬영 버튼을 눌러요. 위의 작은 사진 4칸에 체크가 생겨요.', 'Press the shutter for front → left → right → back. The 4 thumbnails get a check.'),
            L('화면의 점선 타원 안에 머리 전체가 들어오게, 밝은 곳에서 찍어요. 머리는 풀고 모자는 벗어요.', 'Keep your whole head inside the dotted oval, in good light, hair down, no hat.'),
            L('잘못 찍었으면 「재촬영」, 갤러리 사진은 「업로드」. 뒷모습은 누가 찍어 주면 더 좋아요.', 'Use “Retake” to redo, “Upload” for gallery photos. Someone can take the back photo for you.'),
            L('4장을 다 찍으면 「다음→」.', 'After 4 photos, tap “Next →”.')]));
    h += sec(2, L('더 정밀하게: 360° 촬영', 'More accurate: 360° capture'),
      '<div style="background:#1B1816;border-radius:10px;padding:6px;margin:8px 0;">' + ART.orbit() + '</div>'
      + ul([L('도와줄 사람이 필요해요. 촬영 화면 아래 「🔄 360° 촬영」을 누르면 뒤 카메라가 열려요.', 'You need a helper. “🔄 360° Capture” under the photo screen opens the back camera.'),
            L('찍는 사람은 내 정면에 서서 [시작] → 머리를 화면 타원 안에 두고 15~20초 동안 천천히 한 바퀴 → 출발점에서 [끝내기].', 'The helper stands in front of you, taps [Start], keeps your head in the oval, walks one slow circle in 15–20 s, and taps [Finish] back at the start.'),
            L('찍히는 사람은 고개와 머리카락을 움직이지 않아요. 각도마다 가장 선명한 사진을 앱이 골라요.', 'Keep your head and hair still. The app picks the sharpest photo at each angle.'),
            L('왼쪽·오른쪽이 바뀌어 보이면 「좌우 바꾸기」.', 'If left and right look swapped, tap “Swap left/right”.')]));
    h += sec(3, L('스타일 고르기', 'Pick a style'),
      ul([L('카드를 눌러 스타일을 고르고 「3D로 보기 →」를 눌러요. 3D로 입히는 동안 잠시 기다려 주세요.', 'Tap a style card, then “View in 3D →”. Wait a moment while it is applied.'),
          L('「스타일 미적용」은 지금 내 머리를 그대로 3D로 보여 줘요. 사진 속 머리결을 하나하나 분석해서 시간이 오래 걸려요(기기에 따라 1분 이상).', '“No style applied” shows your hair as it is now in 3D. It analyzes every strand, so it takes a while (a minute or more on some devices).')]));
    h += sec(4, L('3D로 보기', 'View in 3D'),
      row([{ f: 'model3d', c: L('3D 결과', '3D result') }, { f: 'maptry', c: L('다른 스타일 입힌 모습', 'Another style') }]) + aiNote()
      + ul([L('한 손가락으로 끌면 돌아가요. 두 손가락으로 벌리면 확대, 두 손가락으로 끌면 이동. 오른쪽 아래 ↺로 처음 보기.', 'Drag to turn, pinch to zoom, two-finger drag to move. ↺ at the bottom right resets the view.'),
          L('위쪽 「Hair pin」으로 머리핀을 꽂아 봐요.', 'Try hair pins with “Hair pin” at the top.'),
          L('왼쪽 「남자/여자」로 몸을 바꾸고, 「외투」로 겉옷을 입고 벗어요.', 'Switch the body with “Man/Woman” and put the jacket on or off with “Jacket”.')]));
    h += sec(5, L('헤어 컬러', 'Hair color'),
      ul([L('3D 화면 왼쪽 아래 「헤어 컬러」를 누르면 펼쳐져요.', 'Tap “Hair color” at the bottom left of the 3D screen.'),
          L('색 견본을 누르거나 밝기·채도·색상을 움직이면 3D 머리 색이 바뀌어요. 색 번호도 함께 보여요.', 'Pick a swatch or move lightness, vividness and hue; the 3D hair changes and the color number is shown.'),
          L('「원래 색으로」는 염색 전 머리색이에요. 화면 색은 참고용이고, 실제 발색은 모발 상태에 따라 달라요.', '“Reset” returns to your natural color. Screen color is a guide; real results depend on your hair.')]));
    h += sec(6, L('옷 고르기 (쇼핑몰)', 'Pick clothes (shop)'),
      row([{ f: 'shoplist', c: L('① 상품 고르기', '① Pick an item') }, { f: 'shopdetail', c: L('② 「입어 보기」', '② “Try on”') }, { f: 'shopresult', c: L('③ 입힌 모습', '③ Wearing it') }]) + aiNote()
      + ul([L('「옷 고르기」를 누르면 쇼핑몰이 열려요. 상품을 누르고 「입어 보기」를 누르면 3D 몸에 입혀져요.', 'Tap “Pick clothes” to open the shop. Open an item and tap “Try on” to put it on the 3D body.'),
          L('입은 옷은 왼쪽 줄에 이름이 생기고, 「고른 옷 벗기」로 벗어요. 쇼핑몰은 위 ✕로 닫아요.', 'The item appears in the left column; “Clear picks” removes it. Close the shop with ✕.')]));
    h += sec(7, L('맵에서 고르기 (미용실 · 옷가게)', 'Pick on map (salons · stores)'),
      row([{ f: 'mapview', c: L('① 지도에서 가게 찾기', '① Stores on the map') }, { f: 'map', c: L('② 스타일·옷 「입어 보기」', '② “Try on” a style or item') }, { f: 'maptry', c: L('③ 내 두상에 입힌 모습', '③ On your head') }]) + aiNote()
      + ul([L('「맵에서 고르기」를 누르면 미용실과 옷가게가 표시된 지도가 열려요. 주소나 동네로 검색하고, 「미용실」·「옷가게」 중 원하는 종류만 골라 볼 수 있어요.', 'Tap “Pick on map” to open a map of salons and clothing stores. Search by address or area, or filter to “Salons” or “Clothing stores”.'),
          L('미용실을 누르면 그 미용실 헤어스타일과 가격·시간이 나와요. 「입어 보기」를 누르면 내 3D 두상에 그 스타일이 입혀져요.', 'Tap a salon to see its styles with price and time. “Try on” puts that style on your 3D head.'),
          L('옷가게를 누르면 그 가게의 옷과 가격이 나와요. 「입어 보기」를 누르면 3D 몸에 그 옷이 입혀져요.', 'Tap a clothing store to see its items and prices. “Try on” puts the item on your 3D body.')]));
    h += sec(8, L('사진과 개인정보', 'Photos and privacy'),
      ul([L('찍은 사진은 이 기기 안에서만 분석하고 서버로 보내지 않아요.', 'Photos are analyzed only on this device and never uploaded.'),
          L('「새로 시작」을 누르면 처음부터 다시 찍을 수 있어요.', 'Tap “Start over” to take new photos.')]));
    h += '<div style="font-size:11px;color:#8A7F76;line-height:1.55;margin-top:22px;border-top:1px solid #E2D6C8;padding-top:10px;">' + bizInfo() + '</div>';
    h += '<div class="hp-row"><button type="button" class="hp-again">' + esc(L('표지 다시 보기', 'Show intro')) + '</button>'
      + '<button type="button" class="hp-close">' + esc(L('닫기', 'Close')) + '</button></div>';
    return h;
  }
  var mode = 'help';
  O.manual = function () { mode = 'manual'; O.help(); };
  var hov = null;
  function closeHelp() { if (hov) hov.style.display = 'none'; mode = 'help'; }
  O.help = function () {
    css();
    if (!hov) { hov = document.createElement('div'); hov.id = 'helpOv'; hov.addEventListener('click', function (e) { if (e.target === hov) closeHelp(); }); document.body.appendChild(hov); }
    hov.innerHTML = '<div class="hp-sheet">' + (mode === 'manual' ? manualHTML() : helpHTML()) + '</div>';
    var mb = hov.querySelector('.hp-manual'); if (mb) mb.onclick = function () { O.manual(); hov.querySelector('.hp-sheet').scrollTop = 0; };
    hov.querySelector('.hp-close').onclick = closeHelp;
    hov.querySelector('.hp-again').onclick = function () { closeHelp(); O.show(0); };
    hov.style.display = 'flex';
  };
  function installHelp() {
    css();
    if (document.getElementById('helpBtn')) return;
    var lb = document.getElementById('langToggle'); if (!lb || !lb.parentNode) return;
    var b = document.createElement('button'); b.id = 'helpBtn'; b.type = 'button'; b.textContent = '?';
    b.setAttribute('aria-label', 'Help'); b.title = 'Help / 도움말';
    b.addEventListener('click', O.help);
    lb.parentNode.insertBefore(b, lb.nextSibling);
  }
  // 언어를 바꾸면 열린 창도 그 언어로
  document.addEventListener('click', function (e) {
    if (e.target && e.target.closest && e.target.closest('#langToggle')) setTimeout(function () {
      if (ov && ov.style.display !== 'none') draw();
      if (hov && hov.style.display !== 'none') O.help();
    }, 0);
  }, true);

  // ---- 표지(11-25) — 소개 5장을 '다음부터 보지 않기'로 끈 뒤에도 앱을 열 때마다 나옴: 앱 이름 · [시작하기] · [사용 설명서] ----
  var cov = null;
  /* (11-25) 사업자 정보 · 통신판매중개자 고지(전자상거래법 제20조 — 초기 화면에서 미리 알림) — 표지 맨 아래 · 사용 설명서 맨 아래 */
  function bizInfo() {
    return esc(L('YL Company는 통신판매중개자로서 거래 당사자가 아니며, 입점 판매자가 등록한 상품·서비스 정보와 거래에 대한 책임은 각 판매자에게 있습니다.',
                 'YL Company is a mail-order broker, not a party to transactions; each listed seller is responsible for its products, services and transactions.'))
      + '<br>' + esc(L('상호 YL Company · 대표 이영조 · 사업자등록번호 484-21-02064 · 통신판매업 신고 제2025-경북구미-0728호',
                       'YL Company · CEO Lee Youngjo · Business reg. 484-21-02064 · Mail-order reg. 2025-Gyeongbuk Gumi-0728'))
      + '<br>' + esc(L('경북 구미시 신시로16길 141, 101동 1006호 · choisunfriend@gmail.com',
                       '101-1006, 141 Sinsi-ro 16-gil, Gumi-si, Gyeongbuk, Korea · choisunfriend@gmail.com'))
      + '<br>© 2026 YL Company. All rights reserved. · <a href="privacy.html" target="_blank" rel="noopener" style="color:inherit;">' + esc(L('개인정보처리방침', 'Privacy policy')) + '</a>';
  }
  function drawCover() {
    cov.innerHTML = '<div class="ob-body" style="text-align:center;">' + ART.intro()
      + '<div style="font-family:Fraunces,serif;font-size:28px;font-weight:600;color:#E0A05A;margin-top:14px;">Today\'s Stylepeek</div>'
      + '<h2 style="margin:10px 0 6px;">' + esc(L('내 머리에 스타일을 입혀 보세요', 'Try hairstyles on your own head')) + '</h2>'
      + '<div class="ob-text">' + esc(L('사진 몇 장으로 내 두상을 3D로 만들고, 헤어스타일을 입혀서 돌려 보며 확인해요.', 'A few photos turn into a 3D model of your head. Put on hairstyles and turn it around to see every side.')) + '</div></div>'
      + '<div class="ob-nav" style="flex-direction:column;">'
      + '<button class="ob-next" type="button" style="flex:none !important;">' + esc(L('시작하기', 'Get started')) + '</button>'
      + '<button class="ob-prev ob-man" type="button">📖 ' + esc(L('사용 설명서', 'User guide')) + '</button>'
      + '<button class="ob-never ob-intro" type="button" style="align-self:center;">' + esc(L('처음 안내 다시 보기', 'Show intro again')) + '</button></div>'
      + '<div style="font-size:10.5px;opacity:.5;text-align:center;margin-top:10px;line-height:1.5;">' + bizInfo() + '</div>';
    cov.querySelector('.ob-next').onclick = function () { cov.style.display = 'none'; startCam(); };
    cov.querySelector('.ob-man').onclick = function () { O.manual(); };
    cov.querySelector('.ob-intro').onclick = function () { cov.style.display = 'none'; O.show(0); };
  }
  O.cover = function () {
    css();
    if (!cov) { cov = document.createElement('div'); cov.id = 'onboardOv'; cov.className = 'ob-cover'; document.body.appendChild(cov); }
    cov.style.display = 'flex'; drawCover();
  };
  document.addEventListener('click', function (e) {
    if (e.target && e.target.closest && e.target.closest('#langToggle')) setTimeout(function () { if (cov && cov.style.display !== 'none') drawCover(); }, 0);
  }, true);

  function boot() {
    installHelp();
    if (!seen()) O.show(0); else O.cover();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  try {
    if (typeof I18N === 'object' && I18N) {
      I18N['찍는 사람은 내 정면에 서서 [시작]을 누르세요. 폰은 세워서 머리를 향하게.'] = 'Helper: stand in front of the person and press [Start]. Hold the phone upright, pointed at the head.';
      I18N['15~20초에 걸쳐 한 바퀴 · 찍히는 사람은 고개와 머리카락을 움직이지 않습니다 · 출발점으로 돌아오면 [끝내기]'] = 'One full circle in 15–20 seconds · keep head and hair still · press [Finish] back at the start';
    }
  } catch (e) {}
  console.log(TAG + ' 설치 — 첫 실행 안내 ' + (seen() ? '(이미 봄)' : '(띄움)') + ' · 헤더 [?] 도움말 · 다시 보기 ONBOARD.show() · 끄기 ONBOARD.on=false');
  return O;
})();
