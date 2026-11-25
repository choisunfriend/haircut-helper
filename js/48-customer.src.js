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
  var C = Object.assign({ on: true, waitMs: 180000, minWaitMs: 800, stableMs: 1500 }, W.CUSTOMER_UI || {});
  if (!C.on) return C;
  function L(ko, en) { try { return typeof uiLang !== 'undefined' && uiLang === 'en' ? en : ko; } catch (e) { return ko; } }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  // ---- 단계: 조정을 숨기고 3D로 ------------------------------------------------------------------
  // 조정 화면에 들어가야 도는 계산이 있음 — 고른 스타일 걸기(setupAdjustScreen) · 스타일 없음이면 "다시 기르기"(REGROW)·기준 재기.
  // 다시 기르기는 조정 화면에 있을 때만 시작되고(17b _afterSetupAdjust · setTimeout 0) 폰에서 수십 초 걸림.
  // 그래서 조정 화면을 덮개 아래 그대로 열어 두고, ① 할 일이 끝났고 ② 상태가 1.5초 동안 그대로일 때 3D로 넘김.
  var origNav = W.navTo, busy = false;
  function sig() {
    var R = W.REGROW, a = [];
    try { a.push(!!state.hair3Dneutral, state.specAppliedId || '', typeof MANNEQUIN !== 'undefined' && MANNEQUIN.on ? 1 : 0); } catch (e) {}
    try { a.push(R ? [R.on ? 1 : 0, R.building ? 1 : 0, R.model ? (R.model.strands || []).length : 0, R.base ? 1 : 0].join('.') : '-'); } catch (e) {}
    try { a.push(typeof ADJ_CACHE !== 'undefined' ? ADJ_CACHE.misses : 0); } catch (e) {}
    try { var N = FLOW_SPEC.nativeState; a.push((N.id || '') + '/' + (N.pending || '')); } catch (e) {}
    return a.join('|');
  }
  function aiBusy() { try { var a = document.getElementById('aiOverlay'); return !!(a && !a.classList.contains('hidden')); } catch (e) { return false; } }
  function aiText() { try { if (!aiBusy()) return ''; var t = document.getElementById('aiOverlayText'), u = document.getElementById('aiOverlaySub'); return ((t && t.textContent) || '') + (u && u.textContent ? ' · ' + u.textContent : ''); } catch (e) { return ''; } }
  function done(pend) {
    try {
      if (!state.hair3Dneutral) return false;
      if (aiBusy()) return false;                                  // 앱 자체 진행 덮개(다시 기르기 % 등)가 떠 있으면 아직
      var R = W.REGROW;
      if (R && R.building) return false;
      if (pend) {
        if (state.specAppliedId === pend) return true;
        // 제 머리 바탕 스타일(spec.base='regrown') — 마네킹을 안 켜서 specAppliedId 대신 FLOW_SPEC.nativeState에 적힘
        var N = (typeof FLOW_SPEC !== 'undefined' && FLOW_SPEC.nativeState) || null;
        if (N && N.id === pend && !N.pending) return true;
        if (N && N.pending !== pend && N.fellBack && state.specAppliedId) return true;   // 마네킹 방식으로 떨어져 걸림
        return false;
      }
      // 스타일 없음 = 다시 기른 내 머리 + 기준까지 들어가야 끝(못 길렀으면 failedFor로 끝)
      if (R && R.on) return !!(R.model && R.src === state._hair3Dneutral && R.base) || R.failedFor === state._hair3Dneutral;
      return false;
    } catch (e) { return true; }
  }
  var cov = null;
  function cover(show, noStyle) {
    if (!cov) {
      cov = document.createElement('div'); cov.id = 'customerPrepCover';
      cov.style.cssText = 'position:fixed;inset:0;z-index:9300;background:rgba(27,24,22,0.96);color:#F3E9DA;display:none;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;';
      document.body.appendChild(cov);
      if (!document.getElementById('custSpinCss')) { var st = document.createElement('style'); st.id = 'custSpinCss'; st.textContent = '@keyframes custSpin{to{transform:rotate(360deg)}}'; document.head.appendChild(st); }
    }
    if (!show) { cov.style.display = 'none'; return; }
    cov.innerHTML = '<div style="width:44px;height:44px;border-radius:50%;border:4px solid rgba(243,233,218,.2);border-top-color:#E0A05A;animation:custSpin 1s linear infinite;"></div>'
      + '<div style="font-size:17px;font-weight:800;margin-top:18px;">' + (noStyle ? L('지금 내 머리를 3D로 만드는 중…', 'Building your current hair in 3D…') : L('스타일을 입히는 중…', 'Applying the style…')) + '</div>'
      + '<div style="font-size:13.5px;line-height:1.6;opacity:.8;margin-top:10px;max-width:340px;">'
      + (noStyle ? L('「스타일 미적용」은 지금 내 머리를 그대로 표현해요. 사진 속 머리결을 하나하나 분석하느라 시간이 오래 걸려요(기기에 따라 1분 이상). 잠시만 기다려 주세요.',
                     '“No style applied” shows your hair as it is now. Analyzing every strand in your photos takes a while (a minute or more on some devices). Please wait.')
                 : L('잠시만 기다려 주세요.', 'One moment.'))
      + '</div><div data-el style="font-size:12.5px;opacity:.7;margin-top:14px;"></div>';
    cov.style.display = 'flex';
  }
  function noStyleNow(pend) { try { return !pend && !state.specAppliedId; } catch (e) { return !pend; } }
  async function prepThen3D(self) {
    if (busy) return;
    busy = true;
    var pend = null; try { pend = state.pendingSpecId || null; } catch (e) {}
    var noStyle = noStyleNow(pend);
    cover(true, noStyle);
    try {
      await origNav.call(self, 'adjust');
      var t0 = Date.now(), last = '', since = Date.now(), elT = cov.querySelector('[data-el]');
      await sleep(C.minWaitMs);                                   // 다시 기르기가 시작될 틈(setTimeout 0 + 첫 조각)
      while (Date.now() - t0 < C.waitMs) {
        var g = sig();
        if (g !== last) { last = g; since = Date.now(); }
        if (done(pend) && Date.now() - since >= C.stableMs) break;
        if (elT) elT.textContent = aiText();   // 진행 단계만(걸린 초는 안 보임 — 저사양에서 더 길게 느껴짐)
        await sleep(200);
      }
      if (!done(pend)) console.warn(TAG + ' 준비 대기 시간 초과(' + Math.round((Date.now() - t0) / 1000) + '초) — 그대로 3D로 갑니다 · ' + sig());
      else console.log(TAG + ' 준비 끝 ' + Math.round((Date.now() - t0) / 1000) + '초 — ' + (pend ? '스타일 ' + pend : '스타일 없음(다시 기른 내 머리)') + ' · ' + sig());
    } catch (e) { console.warn(TAG + ' 조정 단계 실패 — 3D로 갑니다', e); }
    try { return await origNav.call(self, 'model3d'); }
    finally { busy = false; cover(false); }
  }
  W.navTo = async function (name) {
    var from = ''; try { from = currentScreen; } catch (e) {}
    // 스타일 화면의 [3D로 보기](= navTo('adjust')) · 아래 3D 탭을 스타일/촬영 화면에서 누른 경우 → 조정 단계를 거쳐 3D로
    if (name === 'adjust' || (name === 'model3d' && (from === 'style' || from === 'capture'))) return prepThen3D(this);
    return origNav.apply(this, arguments);
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
  /* (2026-11-25 fastcolor) 컬러 미리보기 — 사용자: "컬러 바꾸는 건 노트북에서도 버벅대네"
   *  실측: 색을 바꿀 때마다 18번 완성본을 처음부터 다시 만듦(가닥 27180 · 매번 ≈1초 · 몸 늘어뜨리기 +50~140ms).
   *  고침: 슬라이더를 끄는 동안·견본을 누른 순간에는 모양을 그대로 두고 지금 3D 머리의 정점 색만 바꿈(미리보기).
   *    염색 LUT(09 dyeLUTFor)는 사진 픽셀 밝기(OKLab L) 하나로 색을 정하므로, 처음 색일 때 정점마다 L을 떠 두고
   *    새 염색색의 LUT로 바로 칠함(기준 밝기 = 그때 색이 염색이면 그 염색색 · 아니면 사진 평균 머리색).
   *    음영·광택이 이미 섞인 색에서 뜬 L이라 정확한 결과와 조금 다를 수 있음 → 손을 떼면(onchange)·견본은 잠시 뒤 정확히 다시 만듦.
   *  다시 만들기 전에 떠 둔 원래 색을 버퍼에 되돌려 둠(같은 버퍼를 18번 캐시가 같이 쓰므로).
   *  끄기 CUSTOMER_UI.fastColor=false */
  function hairObj3D() { try { var hg = model3D && model3D.headGroup; return hg ? hg.getObjectByName('adjustedHair') : null; } catch (e) { return null; } }
  function colAttr(o) { return o && o.geometry && o.geometry.attributes && o.geometry.attributes.color; }
  function captureBase() {
    var o = hairObj3D(), ca = colAttr(o); if (!ca || o.userData._ccL || typeof rgbToOklab !== 'function') return;
    var K = ca.array, n = K.length / 3, Lb = new Uint8Array(n), memo = new Map();
    for (var i = 0; i < n; i++) {
      var key = (K[i * 3] << 16) | (K[i * 3 + 1] << 8) | K[i * 3 + 2], v = memo.get(key);
      if (v === undefined) { v = Math.max(0, Math.min(255, Math.round(rgbToOklab(K[i * 3], K[i * 3 + 1], K[i * 3 + 2]).L * 255))); memo.set(key, v); }
      Lb[i] = v;
    }
    o.userData._ccL = Lb; o.userData._ccK = new Uint8Array(K); o.userData._ccDye = curColor();
  }
  function restoreBase(o) {
    var ca = colAttr(o); if (!ca || !o.userData._ccK) return;
    ca.array.set(o.userData._ccK); ca.needsUpdate = true;
    o.userData._ccL = o.userData._ccK = null; o.userData._ccDye = undefined;
  }
  function lutNum(dyeCss, refCss) {
    var lut = dyeLUTFor(dyeCss, refCss); if (!lut) return null;
    var out = new Uint8Array(768);
    for (var i = 0; i < 256; i++) { var m = /(\d+)\D+(\d+)\D+(\d+)/.exec(lut[i]); if (m) { out[i * 3] = +m[1]; out[i * 3 + 1] = +m[2]; out[i * 3 + 2] = +m[3]; } }
    return out;
  }
  function previewColor(hex) {
    if (C.fastColor === false) return false;
    try {
      var o = hairObj3D(), ca = colAttr(o); if (!ca || !o.userData._ccL) return false;
      var K = ca.array, Lb = o.userData._ccL, base = o.userData._ccDye, i, n = Lb.length;
      if (!hex) {                                                     // 원래 색으로 — 처음이 원래 색이었을 때만 그대로 되돌림
        if (base) return false;
        K.set(o.userData._ccK);
      } else {
        if (typeof dyeLUTFor !== 'function') return false;
        var ref = base || (state.hairMasks && state.hairMasks.front && state.hairMasks.front.avgColor) || null;
        var T = lutNum(hex, ref); if (!T) return false;
        for (i = 0; i < n; i++) { var j = Lb[i] * 3; K[i * 3] = T[j]; K[i * 3 + 1] = T[j + 1]; K[i * 3 + 2] = T[j + 2]; }
      }
      ca.needsUpdate = true;
      if (o.userData._hlGeo) o.userData._hlGeo = o.geometry.uuid + ':' + ca.version;   // 46/18 빛 재질이 '모양이 바뀌었다'고 다시 입히지 않게
      return true;
    } catch (e) { return false; }
  }
  function rebuildHair() {
    // 색은 필터 단(_adjApplyFilter)에서 입혀짐 — 기하 캐시는 그대로 써도 됨(비우면 가닥을 처음부터 다시 계산)
    try {
      var hg = model3D && model3D.headGroup; if (!hg) return;
      try { restoreBase(hg.getObjectByName('adjustedHair')); } catch (eR) {}   // (fastcolor) 미리보기로 바꾼 색을 되돌린 뒤 정확히 다시 만듦
      var old = hg.getObjectByName('adjustedHair'), nu = buildAdjustedHair3DObject();
      if (!nu) return;
      if (nu === old) { try { if (typeof HAIR_LOOK !== 'undefined' && HAIR_LOOK.refresh) HAIR_LOOK.refresh(); } catch (e0) {} return; }   // (fastcolor) 처음 색으로 돌아와 캐시 그대로
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
    try { captureBase(); } catch (e) {}
    setAll(v.toUpperCase()); syncUi();
    var pv = previewColor(v.toUpperCase());
    if (fast && pv) clearTimeout(rebuildT);                  // (fastcolor) 끄는 동안은 미리보기만 — 손을 떼면(onchange) 정확히
    else scheduleRebuild(pv ? 400 : (fast ? 220 : 0));     // 견본: 바로 미리보기 → 잠시 뒤 정확히
    return true;
  };
  C.resetColor = function () { try { captureBase(); } catch (e) {} setAll(null); syncUi(); scheduleRebuild(previewColor(null) ? 400 : 0); };

  var RACK_W = 112;   // 왼쪽 옷장 버튼 줄 폭(아래 CSS로 고정) — 접힌 컬러 카드도 같은 폭
  function rackW() { return RACK_W; }
  /* 옷장 버튼 줄(21 bb-rack) 폭 고정 — 원래는 가장 긴 글자에 맞춰 늘어나서, 쇼핑몰에서 옷을 고르고 나오면
     "test1(for Woman) · 0 USD" 같은 긴 줄 때문에 버튼이 전부 넓어졌음. 긴 글자는 … 으로 자름.
     켜진 버튼(.on)이 밝은 무대에서 배경이 어둡게 덮여 글자가 안 보이던 것도 여기서 바로잡음. */
  (function () {
    if (document.getElementById('custRackCss')) return;
    var st = document.createElement('style'); st.id = 'custRackCss';
    st.textContent = '.bb-rack{width:' + RACK_W + 'px;max-width:' + RACK_W + 'px;}'
      + '.bb-rack button,.bb-rack .bb-buy{width:100%;box-sizing:border-box;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}'
      + '.soft-stage .bb-rack button.on,.bb-rack button.on{background:var(--accent);color:#1B1816;}';
    document.head.appendChild(st);
  })();
  function panel() {
    var p = document.getElementById('customerColorCard');
    if (p) return p;
    var vp = document.getElementById('model3dViewport'); if (!vp) return null;
    p = document.createElement('div'); p.id = 'customerColorCard';
    vp.appendChild(p);
    return p;
  }
  function baseCss() {
    return 'position:absolute;left:10px;bottom:12px;z-index:15;background:rgba(30,26,22,0.86);color:#f3e9da;border-radius:12px;'
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

  // 「스타일 미적용」을 고르면 오래 걸린다고 먼저 알림
  if (typeof W.selectNoStyle === 'function') {
    var sns = W.selectNoStyle;
    W.selectNoStyle = function () {
      var r = sns.apply(this, arguments);
      try { if (typeof showToast === 'function') showToast(L('지금 내 머리를 그대로 표현해요 — 분석 때문에 3D까지 시간이 오래 걸려요', 'Shows your hair as it is now — analysis makes 3D take a while')); } catch (e) {}
      return r;
    };
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
