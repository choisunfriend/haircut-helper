// ============================================================================
// 48-customer.js (2026-11-24) — 고객용 배포본 전용 (원본 index.html에는 넣지 않음)
// ============================================================================
// · 단계: 촬영 → 스타일 → 3D (조정·결과 단계 없음)
//   스타일 화면 [다음 →](navTo('adjust'))은 가림막 아래에서 조정 단계를 한 번 거쳐 스펙을 건 뒤 3D로 바로 감.
//   스펙을 거는 곳이 조정 화면 진입(setupAdjustScreen)이라 그 단계를 빼면 스타일이 안 걸리기 때문.
// · 3D 결과 화면 왼쪽 아래: 헤어 컬러 카드 — 접으면 옆 버튼 폭(색 하나) · 펼치면 스와치·밝기/채도/색상·원래 색
// · 디자이너 기능 숨김: 「미용실에 올리기」
// 끄기: CUSTOMER_UI.on = false (새로고침)
// ============================================================================
var CUSTOMER_UI = (function () {
  'use strict';
  var W = window, TAG = '[고객용]';
  var C = Object.assign({ on: true, waitMs: 30000, settleMs: 400 }, W.CUSTOMER_UI || {});
  if (!C.on) return C;
  function L(ko, en) { try { return typeof uiLang !== 'undefined' && uiLang === 'en' ? en : ko; } catch (e) { return ko; } }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  // ---- 단계: 조정을 숨기고 3D로 ------------------------------------------------------------------
  var origNav = W.navTo, busy = false;
  function ready(pend) {
    try {
      if (!state.hair3Dneutral) return false;
      if (typeof REGROW !== 'undefined' && REGROW.building) return false;
      if (pend && state.specAppliedId !== pend) return false;
      return true;
    } catch (e) { return true; }
  }
  W.navTo = async function (name) {
    if (name !== 'adjust') return origNav.apply(this, arguments);
    if (busy) return;
    busy = true;
    var pend = null; try { pend = state.pendingSpecId || null; } catch (e) {}
    try {
      if (typeof showAI === 'function') showAI(L('스타일을 입히는 중…', 'Applying the style…'), L('잠시만 기다려 주세요', 'One moment'));
      await origNav.call(this, 'adjust');
      var t0 = Date.now();
      while (Date.now() - t0 < C.waitMs && !ready(pend)) await sleep(150);
      if (!ready(pend)) console.warn(TAG + ' 스타일 적용 대기 시간 초과 — 그대로 3D로 갑니다');
      await sleep(C.settleMs);
    } catch (e) { console.warn(TAG + ' 조정 단계 실패 — 3D로 갑니다', e); }
    finally { busy = false; try { if (typeof hideAI === 'function') hideAI(); } catch (e) {} }
    return origNav.call(this, 'model3d');
  };

  // ---- 헤어 컬러 카드 (접힘 = 색 하나 · 펼침 = 조정) ----------------------------------------------
  // 조정 화면 컬러 그룹(06 gyColorEditor)의 "머리 전체" 부분만 고객용으로 — 스와치 + 밝기·채도·색상(OKLCH) + 원래 색.
  // 색은 sec.color(섹션 여섯 개)에 그대로 적음 → 3D 머리 오브젝트만 다시 만들어 바꿔 끼움(장면 전체를 다시 만들지 않음).
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function hexOk(h) { return typeof h === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(h); }
  var open = false, rebuildT = 0;
  var AX = [
    { k: 'L', ko: '밝기', en: 'Lightness', min: 0, max: 100, step: 0.5, get: function (o) { return o.L * 100; } },
    { k: 'C', ko: '채도', en: 'Vividness', min: 0, max: 0.3, step: 0.005, get: function (o) { return o.C; } },
    { k: 'h', ko: '색상', en: 'Hue', min: 0, max: 360, step: 1, get: function (o) { return o.h; } }
  ];
  function curColor() {   // 지금 걸린 색(섹션마다 다르면 첫 색) · 없으면 null
    try { for (var i = 0; i < SECTION_ORDER.length; i++) { var s = state.sections[SECTION_ORDER[i]]; if (s && hexOk(s.color)) return s.color.toUpperCase(); } } catch (e) {}
    return null;
  }
  function mixed() {
    var c = null, m = false;
    try { SECTION_ORDER.forEach(function (id) { var s = state.sections[id], v = s && s.color ? String(s.color).toUpperCase() : ''; if (c === null) c = v; else if (c !== v) m = true; }); } catch (e) {}
    return m;
  }
  function shownColor() {   // 아무 색도 안 걸렸으면 사진 머리 평균색(표시용)
    var c = curColor(); if (c) return c;
    try { var a = state.hairMasks && state.hairMasks.front && state.hairMasks.front.avgColor; if (hexOk(a)) return a.toUpperCase(); } catch (e) {}
    return '#6B4A2E';
  }
  function rebuildHair() {
    // 색은 필터 단(_adjApplyFilter)에서 입혀짐 — 기하 캐시는 그대로 써도 됨(비우면 가닥을 처음부터 다시 계산)
    try {
      var hg = model3D && model3D.headGroup; if (!hg) return;
      var old = hg.getObjectByName('adjustedHair'), nu = buildAdjustedHair3DObject();
      if (!nu) return;
      if (old) {
        nu.position.copy(old.position); nu.quaternion.copy(old.quaternion); nu.scale.copy(old.scale); nu.visible = old.visible;
        var par = old.parent || hg; par.remove(old); par.add(nu);
        try { old.geometry && old.geometry.dispose(); } catch (e) {}
      } else hg.add(nu);
      try { if (typeof HAIR_LOOK !== 'undefined' && HAIR_LOOK.refresh) HAIR_LOOK.refresh(); } catch (e) {}
    } catch (e) { console.warn(TAG + ' 머리 색 다시 그리기 실패', e); }
  }
  function scheduleRebuild(ms) { clearTimeout(rebuildT); rebuildT = setTimeout(rebuildHair, ms); }
  function setAll(hex) {
    try { SECTION_ORDER.forEach(function (id) { if (state.sections[id]) state.sections[id].color = hex; }); if (hex) state.globalColor = hex; } catch (e) {}
  }
  C.setColor = function (css, fast) {
    var v = (typeof gyNormalizeColor === 'function') ? gyNormalizeColor(css) : (hexOk(css) ? css : null);
    if (!v) return false;
    setAll(v.toUpperCase()); syncUi(); scheduleRebuild(fast ? 220 : 0); return true;
  };
  C.resetColor = function () { setAll(null); syncUi(); scheduleRebuild(0); };

  function rackW() {
    try { var b = document.querySelector('#bodyGarmentRack button, #bodyGarmentRack .bb-btn, #bodyGarmentRack > *'); if (b && b.offsetWidth > 40) return b.offsetWidth; } catch (e) {}
    return 96;
  }
  function panel() {
    var p = document.getElementById('customerColorCard');
    if (p) return p;
    var vp = document.getElementById('model3dViewport'); if (!vp) return null;
    p = document.createElement('div'); p.id = 'customerColorCard';
    vp.appendChild(p);
    return p;
  }
  function baseCss() {
    return 'position:absolute;left:10px;bottom:12px;z-index:30;background:rgba(30,26,22,0.86);color:#f3e9da;border-radius:12px;'
      + 'font-size:12px;line-height:1.4;box-shadow:0 4px 18px rgba(0,0,0,0.25);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);';
  }
  function render() {
    var p = panel(); if (!p) return;
    var hex = shownColor(), dyed = !!curColor();
    if (!open) {
      p.style.cssText = baseCss() + 'width:' + rackW() + 'px;padding:8px 10px;cursor:pointer;';
      p.innerHTML = '<div style="font-weight:800;margin-bottom:5px;">' + esc(L('헤어 컬러', 'Hair color')) + ' ▴</div>'
        + '<div style="display:flex;align-items:center;gap:6px;"><span style="flex:none;width:18px;height:18px;border-radius:5px;border:1px solid rgba(255,255,255,0.3);background:' + esc(hex) + '"></span>'
        + '<span style="font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(dyed ? (mixed() ? L('섹션별', 'Mixed') : hex) : L('원래 색', 'Natural')) + '</span></div>';
      p.onclick = function () { open = true; render(); };
      return;
    }
    p.onclick = null;
    p.style.cssText = baseCss() + 'width:min(320px, calc(100% - 20px));padding:12px 14px;max-height:calc(100% - 24px);overflow-y:auto;';
    var o = (typeof gyToOklch === 'function' ? gyToOklch(hex) : null) || { L: 0.45, C: 0.05, h: 60 };
    var h = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">'
      + '<b style="font-size:14px;">' + esc(L('헤어 컬러', 'Hair color')) + '</b>'
      + '<button type="button" data-cc="close" style="background:none;border:none;color:#f3e9da;font-size:16px;cursor:pointer;padding:2px 6px;">▾</button></div>';
    h += '<div style="display:flex;flex-wrap:wrap;gap:7px;margin-bottom:10px;">';
    (typeof GYEOL_COLORS !== 'undefined' ? GYEOL_COLORS : []).forEach(function (c) {
      var on = dyed && c.toUpperCase() === hex;
      h += '<span data-cc-sw="' + esc(c) + '" style="width:28px;height:28px;border-radius:7px;cursor:pointer;background:' + esc(c) + ';border:2px solid ' + (on ? '#E8A65E' : 'rgba(255,255,255,0.2)') + ';"></span>';
    });
    h += '</div>';
    AX.forEach(function (a) {
      h += '<div style="margin:6px 0;"><div style="display:flex;justify-content:space-between;opacity:.85;"><span>' + esc(L(a.ko, a.en)) + '</span></div>'
        + '<input type="range" data-cc-ax="' + a.k + '" min="' + a.min + '" max="' + a.max + '" step="' + a.step + '" value="' + a.get(o) + '" style="width:100%;accent-color:#C98B4F;"></div>';
    });
    h += '<div style="display:flex;align-items:center;gap:8px;margin-top:8px;">'
      + '<span data-cc-chip style="flex:none;width:24px;height:24px;border-radius:6px;border:1px solid rgba(255,255,255,0.3);background:' + esc(hex) + '"></span>'
      + '<b data-cc-hex style="flex:1;">' + esc(dyed ? hex : L('원래 색', 'Natural')) + '</b>'
      + '<button type="button" data-cc="reset" style="font-size:11px;padding:5px 9px;border-radius:8px;border:1px solid rgba(255,255,255,0.25);background:transparent;color:#f3e9da;cursor:pointer;">' + esc(L('원래 색으로', 'Reset')) + '</button></div>';
    h += '<div style="opacity:.6;font-size:11px;margin-top:8px;">' + esc(L('화면 색은 참고용이에요 — 실제 발색은 모발 상태에 따라 달라요', 'Screen color is a guide — actual results depend on your hair')) + '</div>';
    p.innerHTML = h;
    p.querySelector('[data-cc="close"]').onclick = function (e) { e.stopPropagation(); open = false; render(); };
    p.querySelector('[data-cc="reset"]').onclick = function () { C.resetColor(); render(); };
    Array.prototype.forEach.call(p.querySelectorAll('[data-cc-sw]'), function (s) { s.onclick = function () { C.setColor(s.getAttribute('data-cc-sw')); render(); }; });
    function compose(fast) {
      var v = {}; Array.prototype.forEach.call(p.querySelectorAll('[data-cc-ax]'), function (i) { v[i.getAttribute('data-cc-ax')] = +i.value; });
      if (typeof gyFromOklch !== 'function') return;
      var r = gyFromOklch(v.L / 100, v.C, v.h);
      C.setColor(r.hex, fast);
    }
    Array.prototype.forEach.call(p.querySelectorAll('[data-cc-ax]'), function (i) {
      i.oninput = function () { compose(true); };
      i.onchange = function () { compose(false); };
    });
  }
  function syncUi() {   // 슬라이더를 다시 만들지 않고 넘버·칩만(드래그 중 손에서 안 놓치게)
    var p = document.getElementById('customerColorCard'); if (!p) return;
    var hex = shownColor(), dyed = !!curColor();
    var chip = p.querySelector('[data-cc-chip]'), t = p.querySelector('[data-cc-hex]');
    if (chip) chip.style.background = hex;
    if (t) t.textContent = dyed ? hex : L('원래 색', 'Natural');
    if (!open) render();
  }
  C.refreshColor = function () { open = false; render(); };
  function later() { [300, 1500, 4000].forEach(function (t) { setTimeout(function () { try { if (currentScreen === 'model3d' && !open) render(); } catch (e) {} }, t); }); }
  if (typeof W.setupModel3DScreen === 'function') {
    var s3 = W.setupModel3DScreen;
    W.setupModel3DScreen = function () { var r = s3.apply(this, arguments); open = false; later(); return r; };
  }
  if (typeof W.applyStyleSpecAndRender === 'function') {
    var ap = W.applyStyleSpecAndRender;
    W.applyStyleSpecAndRender = function () { var r = ap.apply(this, arguments); later(); return r; };
  }

  // ---- 디자이너 기능 숨김 ------------------------------------------------------------------------
  function hide() {
    ['salonUploadBtn', 'nav-adjust', 'nav-result', 'treatSpecBtnAdjust', 'treatSpecBtn3D', 'strandDebugToggle', 'diagInfoToggle', 'segStatus'].forEach(function (id) {
      var el = document.getElementById(id); if (el) el.style.display = 'none';
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hide); else hide();
  setTimeout(hide, 1500);
  try { var mo = new MutationObserver(function () { var b = document.getElementById('salonUploadBtn'); if (b && b.style.display !== 'none') b.style.display = 'none'; }); mo.observe(document.body, { childList: true, subtree: true }); } catch (e) {}
  try { if (typeof I18N === 'object' && I18N) { I18N['헤어 컬러'] = 'Hair color'; I18N['원래 색으로'] = 'Reset'; I18N['원래 색'] = 'Natural'; I18N['← 스타일'] = '← Style'; I18N['스타일을 입히는 중…'] = 'Applying the style…'; } } catch (e) {}
  console.log(TAG + ' 설치 — 촬영 → 스타일 → 3D · 3D 왼쪽 아래 컬러 카드 · 끄기 CUSTOMER_UI.on=false');
  return C;
})();
