// ============================================================================
// 48-customer.js (2026-11-24) — 고객용 배포본 전용 (원본 index.html에는 넣지 않음)
// ============================================================================
// · 단계: 촬영 → 스타일 → 3D (조정·결과 단계 없음)
//   스타일 화면 [다음 →](navTo('adjust'))은 가림막 아래에서 조정 단계를 한 번 거쳐 스펙을 건 뒤 3D로 바로 감.
//   스펙을 거는 곳이 조정 화면 진입(setupAdjustScreen)이라 그 단계를 빼면 스타일이 안 걸리기 때문.
// · 3D 결과 화면 왼쪽 아래: 컬러 카드(시술 스펙의 컬러 부분만 · 폭 1/3)
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

  // ---- 컬러 카드 ----------------------------------------------------------------------------------
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function hexOk(h) { return typeof h === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(h); }
  function colorRows() {
    var groups = [], by = {};
    try {
      SECTION_ORDER.forEach(function (id) {
        var sec = state.sections && state.sections[id]; if (!sec || !hexOk(sec.color)) return;
        var k = sec.color.toUpperCase(), lab = (SECTIONS[id] && SECTIONS[id].label) || id;
        try { if (typeof treatAppWord === 'function') lab = treatAppWord(lab); } catch (e) {}
        if (!by[k]) { by[k] = { hex: k, secs: [] }; groups.push(by[k]); }
        by[k].secs.push(lab);
      });
    } catch (e) {}
    if (!groups.length) {
      var st = null, h = null; try { st = state.selectedStyle; } catch (e) {}
      try { var sp = state.specAppliedId && typeof getStyleSpec === 'function' ? getStyleSpec(state.specAppliedId) : null; if (sp && hexOk(sp.color)) h = sp.color; } catch (e) {}
      if (!h && st && hexOk(st.colorHex)) h = st.colorHex;
      if (h) groups.push({ hex: h.toUpperCase(), secs: [] });
    }
    return groups;
  }
  function panel() {
    var p = document.getElementById('customerColorCard');
    if (p) return p;
    var vp = document.getElementById('model3dViewport'); if (!vp) return null;
    p = document.createElement('div'); p.id = 'customerColorCard';
    p.style.cssText = 'position:absolute;left:10px;bottom:12px;width:33%;max-width:300px;min-width:150px;z-index:30;'
      + 'background:rgba(30,26,22,0.82);color:#f3e9da;border-radius:12px;padding:10px 12px;font-size:12px;line-height:1.45;'
      + 'box-shadow:0 4px 18px rgba(0,0,0,0.25);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);pointer-events:auto;';
    vp.appendChild(p);
    return p;
  }
  C.refreshColor = function () {
    var p = panel(); if (!p) return;
    var g = colorRows();
    if (!g.length) { p.style.display = 'none'; return; }
    var all = g.length === 1;
    var h = '<div style="font-weight:800;font-size:13px;margin-bottom:6px;">' + esc(L('컬러', 'Color')) + '</div>';
    g.forEach(function (r) {
      h += '<div style="display:flex;align-items:center;gap:8px;margin:4px 0;">'
        + '<span style="flex:none;width:22px;height:22px;border-radius:6px;border:1px solid rgba(255,255,255,0.25);background:' + esc(r.hex) + '"></span>'
        + '<span style="min-width:0;"><b>' + esc(r.hex) + '</b>'
        + (all || !r.secs.length ? '' : '<br><span style="opacity:.75">' + esc(r.secs.join(' · ')) + '</span>') + '</span></div>';
    });
    h += '<div style="opacity:.6;font-size:11px;margin-top:6px;">' + esc(L('실제 발색은 모발 상태에 따라 달라요', 'Actual result depends on your hair')) + '</div>';
    p.innerHTML = h; p.style.display = '';
  };
  function later() { [300, 1500, 4000].forEach(function (t) { setTimeout(function () { try { if (currentScreen === 'model3d') C.refreshColor(); } catch (e) {} }, t); }); }
  if (typeof W.setupModel3DScreen === 'function') {
    var s3 = W.setupModel3DScreen;
    W.setupModel3DScreen = function () { var r = s3.apply(this, arguments); later(); return r; };
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
  try { if (typeof I18N === 'object' && I18N) { I18N['컬러'] = 'Color'; I18N['스타일을 입히는 중…'] = 'Applying the style…'; } } catch (e) {}
  console.log(TAG + ' 설치 — 촬영 → 스타일 → 3D · 3D 왼쪽 아래 컬러 카드 · 끄기 CUSTOMER_UI.on=false');
  return C;
})();
