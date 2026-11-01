// ============================================================================
// 35-salon-bridge.js (2026-11-01) — 마켓플레이스 "미용실 지도" ↔ GYEOL 헤어스타일 입어 보기
// ============================================================================
// · 3D 화면 아래 옷장 줄(bodyGarmentRack)에 「미용실」 버튼을 붙임 → 쇼핑몰 패널(iframe)을 /salons 로 엶
// · 지도에서 미용실의 스타일을 고르면 마켓플레이스가 보냄:
//     { type: "gyeol-style", id, name, gender, salon: { id, name }, spec }
//   spec 은 STYLE_SPECS 와 같은 형식(cut·perm·styling·color …). 순수 데이터만 통과시킨 뒤
//   STYLE_SPECS["salon_<id>"] 로 등록하고 applyStyleSpecAndRender 로 3D 머리에 입힘.
// · 결과를 돌려줌: { type: "gyeol-style-result", id, ok, pending?, error? }  (보낸 창·출처로만)
// · 끄기: SALON_BRIDGE.on = false
// 21-body-base.js(BODY_SHOP·openShopPanel·closeShopPanel·buildBodyGarmentRack),
// 16-style-spec-diag.js(STYLE_SPECS), 17a-mannequin.js(applyStyleSpecAndRender) 다음에 불러야 함.
// ============================================================================
const SALON_BRIDGE = { on: true, path: '/salons', closeAfterApply: true, maxBytes: 16 * 1024 };
// 앱 언어(uiLang)를 따름 — 영어: en · 한국어: ko
function salonL(ko, en) { try { return typeof uiLang !== 'undefined' && uiLang === 'en' ? en : ko; } catch (e) { return ko; } }

(function () {
  if (typeof window === 'undefined' || typeof BODY_SHOP === 'undefined') return;

  let shopOrigin = '';
  let shopUrl = '';
  try {
    const u = new URL(BODY_SHOP.pageUrl, location.href);
    shopOrigin = u.origin;
    shopUrl = u.href;
  } catch (e) { return; }
  const salonUrl = shopOrigin + SALON_BRIDGE.path;
  let salonOpen = false;

  // ---- 스펙 정리: 마켓플레이스 src/lib/salons-db.ts cleanSpec 과 같은 규칙 --------------------
  const BAD = new Set(['__proto__', 'prototype', 'constructor']);
  function clean(v, depth) {
    if (depth > 6) throw new Error('too deep');
    if (v === null || typeof v === 'boolean') return v;
    if (typeof v === 'number') { if (!isFinite(v)) throw new Error('bad number'); return v; }
    if (typeof v === 'string') { if (v.length > 120) throw new Error('long string'); return v; }
    if (Array.isArray(v)) { if (v.length > 64) throw new Error('long array'); return v.map(x => clean(x, depth + 1)); }
    if (typeof v === 'object') {
      const out = {};
      for (const k of Object.keys(v)) {
        if (BAD.has(k) || !/^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(k)) throw new Error('bad key ' + k);
        out[k] = clean(v[k], depth + 1);
      }
      return out;
    }
    throw new Error('not data');
  }
  function cleanSpec(raw) {
    const spec = clean(raw, 0);
    if (!spec || typeof spec !== 'object' || Array.isArray(spec)) throw new Error('스펙이 객체가 아닙니다');
    if (!spec.cut || typeof spec.cut !== 'object') throw new Error('스펙에 cut 이 없습니다');
    if (spec.color !== undefined && !/^#[0-9A-Fa-f]{6}$/.test(String(spec.color))) delete spec.color;
    if (JSON.stringify(spec).length > SALON_BRIDGE.maxBytes) throw new Error('스펙이 너무 큽니다');
    return spec;
  }

  function reply(ev, msg) {
    try { if (ev.source) ev.source.postMessage(Object.assign({ type: 'gyeol-style-result' }, msg), ev.origin); } catch (e) { /* 창이 닫힘 */ }
  }

  function toast(t) { if (typeof bodyToast === 'function') bodyToast(t); }

  // ---- 메시지 받기 ----------------------------------------------------------------------------
  window.addEventListener('message', ev => {
    if (!SALON_BRIDGE.on || ev.origin !== shopOrigin) return;
    let d = ev.data;
    if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { return; } }
    if (!d || d.type !== 'gyeol-style') return;

    const rawId = String(d.id || '');
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(rawId)) return reply(ev, { id: rawId, ok: false, error: salonL('잘못된 스타일 id', 'Invalid style id') });
    let spec;
    try { spec = cleanSpec(d.spec); } catch (e) { return reply(ev, { id: rawId, ok: false, error: salonL('스타일 스펙을 읽지 못했어요: ', 'Could not read the style: ') + e.message }); }

    const salonName = d.salon && typeof d.salon.name === 'string' ? d.salon.name.slice(0, 80) : '';
    const styleName = typeof d.name === 'string' ? d.name.slice(0, 80) : (spec.name || salonL('미용실 스타일', 'Salon style'));
    spec.name = salonName ? salonName + ' · ' + styleName : styleName;

    const key = 'salon_' + rawId.replace(/-/g, '_');
    if (typeof STYLE_SPECS === 'undefined' || typeof applyStyleSpecAndRender !== 'function') {
      return reply(ev, { id: rawId, ok: false, error: salonL('이 버전의 GYEOL 은 스타일 입어 보기를 지원하지 않아요', 'This GYEOL version cannot try on styles') });
    }
    STYLE_SPECS[key] = spec;

    // 같은 스타일을 다시 누르면 applyStyleSpecAndRender 가 "벗기기"로 동작 → 이미 입었으면 그대로 둠
    if (state && state.specAppliedId === key) {
      toast(spec.name + salonL(' — 이미 입고 있어요', ' — already on'));
      if (SALON_BRIDGE.closeAfterApply) closeShopPanel();
      return reply(ev, { id: rawId, ok: true });
    }

    let res = null;
    try { res = applyStyleSpecAndRender(key); } catch (e) {
      console.warn('[미용실] 스타일 적용 실패', e);
      return reply(ev, { id: rawId, ok: false, error: salonL('스타일을 입히다 오류가 났어요', 'Something went wrong while applying the style') });
    }
    if (res) {
      toast(salonL(spec.name + ' 입혔어요', 'Applied ' + spec.name));
      reply(ev, { id: rawId, ok: true });
      if (SALON_BRIDGE.closeAfterApply) closeShopPanel();
    } else if (!state || !state.hair3Dneutral) {
      // 3D 머리를 아직 만드는 중 — 다 되면 17a 가 같은 스펙을 이어서 입힘
      toast(salonL('3D 머리를 준비하는 중… 끝나면 ' + spec.name + ' 을(를) 입혀요', 'Preparing the 3D head… ' + spec.name + ' will be applied when ready'));
      reply(ev, { id: rawId, ok: true, pending: true });
      if (SALON_BRIDGE.closeAfterApply) closeShopPanel();
    } else {
      reply(ev, { id: rawId, ok: false, error: salonL('먼저 사진을 찍거나 마네킹으로 3D 머리를 만들어 주세요', 'Take a photo or build the mannequin 3D head first') });
    }
  });

  // ---- 「미용실」 버튼 · 지도 패널 --------------------------------------------------------------
  function openSalonMap() {
    if (typeof openShopPanel !== 'function') return false;
    if (document.getElementById('bbShopPanel')) closeShopPanel();
    BODY_SHOP.pageUrl = salonUrl; // openShopPanel 이 iframe src 로 씀
    salonOpen = true;
    const ok = openShopPanel();
    const fr = document.getElementById('bbShopFrame');
    if (fr) fr.title = salonL('미용실 지도', 'Salon map');
    const bar = document.querySelector('#bbShopPanel .bb-shop-bar span');
    if (bar) bar.textContent = salonL('미용실 지도', 'Salon map');
    if (typeof buildBodyGarmentRack === 'function') buildBodyGarmentRack();
    return ok;
  }
  window.openSalonMap = openSalonMap;

  if (typeof closeShopPanel === 'function') {
    const _close = closeShopPanel;
    closeShopPanel = function () { // eslint-disable-line no-global-assign
      salonOpen = false;
      BODY_SHOP.pageUrl = shopUrl; // 「옷 고르기」는 다시 /shop
      return _close.apply(this, arguments);
    };
  }

  if (typeof buildBodyGarmentRack === 'function') {
    const _build = buildBodyGarmentRack;
    buildBodyGarmentRack = function () { // eslint-disable-line no-global-assign
      const r = _build.apply(this, arguments);
      try {
        const rack = document.getElementById('bodyGarmentRack');
        if (SALON_BRIDGE.on && rack && !rack.querySelector('.bb-salon-btn')) {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'bb-salon-btn' + (salonOpen ? ' on' : '');
          b.textContent = salonOpen ? salonL('미용실 닫기', 'Close salons') : salonL('미용실', 'Salons');
          b.title = salonL('근처 미용실 지도에서 헤어스타일을 골라 입어 봅니다', 'Find salons nearby and try their hairstyles');
          b.addEventListener('click', () => (salonOpen ? closeShopPanel() : openSalonMap()));
          rack.appendChild(b);
          // 지도가 열려 있을 땐 「옷 닫기」 대신 「옷 고르기」로 보이게
          if (salonOpen) {
            for (const x of rack.querySelectorAll('button')) {
              if (x === b || !/^(옷 닫기|Close clothes)$/.test(x.textContent.trim())) continue;
              const n = x.cloneNode(false); // 원래 「닫기」 동작을 떼어 내고 「옷 고르기」로 바꿈
              n.textContent = salonL('옷 고르기', 'Browse clothes');
              n.classList.remove('on');
              n.addEventListener('click', () => { closeShopPanel(); openShopPanel(); });
              x.replaceWith(n);
            }
          }
        }
      } catch (e) { /* 버튼만 못 붙임 */ }
      return r;
    };
  }
})();

// ============================================================================
// (2026-11-01) 「미용실에 올리기」 — 스타일 화면 아래쪽(← 촬영 · 삭제 · 조정하기 →) 줄의 버튼
// ============================================================================
// · 디자이너가 앱에서 등록한 스타일(isCustom · spec 있음)을 고르면 켜짐 → 누르면 마켓플레이스에 올림
//   (스타일 등록은 원래 기능 registerCurrentAsStyle → buildSpecFromCurrent 가 cm 스펙을 만듦)
// · 새 창: 마켓플레이스 /admin/salons/upload#d=<base64url JSON { spec, thumb }>
//   (#뒤는 서버로 안 감 · 로그인 전이면 로그인 거쳐 그대로 돌아옴)
// · spec.gyeol = { app:'gyeol', v:1, at } — 마켓플레이스는 이 표시가 있는 스펙만 받음
// · 앱 기본 스타일(레이어드 보브 등)은 못 올림 — 디자이너가 직접 만든 것만
// ============================================================================
const SALON_UPLOAD = { path: '/admin/salons/upload', thumbPx: 320, thumbQuality: 0.72 };

function _salonUploadable(st) {
  return !!(st && st.isCustom && st.spec && typeof st.spec === 'object' && st.spec.cut);
}

function syncSalonUploadBtn() {
  const btn = document.getElementById('salonUploadBtn');
  if (!btn) return;
  const st = typeof state !== 'undefined' ? state.selectedStyle : null;
  btn.disabled = !_salonUploadable(st);
  btn.textContent = salonL('✂ 미용실에 올리기', '✂ Upload to salon');
  btn.title = st && !st.isCustom
    ? salonL('앱 기본 스타일은 올릴 수 없어요 — 직접 만들어 등록한 스타일을 골라 주세요', 'Built-in styles cannot be uploaded — pick a style you made and saved')
    : st && !st.spec
      ? salonL('3D 준비 전에 등록한 스타일이라 올릴 수 없어요 — 3D 화면을 연 뒤 다시 등록해 주세요', 'This style was saved before 3D was ready — open 3D and save it again')
      : salonL('고른 내 스타일을 내 미용실 헤어스타일로 올립니다 (미용실 관리자 로그인 필요)', 'Upload the selected style to your salon (salon admin login needed)');
}

// 손질 화면 캔버스를 작은 JPEG 로 — 지금 그 스타일이 걸려 있을 때만 (아니면 null → 머리색 견본으로 표시)
function _styleThumb(st) {
  try {
    if (!st || !state.specAppliedId || state.specAppliedId !== st.specId) return null;
    const src = document.getElementById('adjustCanvas');
    if (!src || !src.width || !src.height) return null;
    const px = SALON_UPLOAD.thumbPx, side = Math.min(src.width, src.height);
    const c = document.createElement('canvas');
    c.width = c.height = px;
    const g = c.getContext('2d');
    g.fillStyle = '#1b1816'; g.fillRect(0, 0, px, px);
    g.drawImage(src, (src.width - side) / 2, (src.height - side) / 2, side, side, 0, 0, px, px);
    const url = c.toDataURL('image/jpeg', SALON_UPLOAD.thumbQuality);
    return url.length < 120000 ? url : null;
  } catch (e) { return null; }
}

function _b64url(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function _salonNotice(msg) {
  if (typeof showToast === 'function') showToast(msg); else alert(msg);
}

function uploadStyleToSalon() {
  const st = typeof state !== 'undefined' ? state.selectedStyle : null;
  if (!_salonUploadable(st)) { _salonNotice(salonL('직접 만들어 등록한 스타일을 먼저 골라 주세요', 'Pick a style you made and saved first')); return false; }
  const spec = JSON.parse(JSON.stringify(st.spec));
  spec.name = String(st.name || spec.name || '').slice(0, 80);
  if (!spec.color && typeof st.colorHex === 'string' && /^#[0-9A-Fa-f]{6}$/.test(st.colorHex)) spec.color = st.colorHex.toUpperCase();
  spec.gyeol = { app: 'gyeol', v: 1, at: new Date().toISOString() };
  if (JSON.stringify(spec).length > SALON_BRIDGE.maxBytes) { _salonNotice(salonL('스타일 정보가 너무 커서 올릴 수 없어요', 'This style is too large to upload')); return false; }
  let origin = '';
  try { origin = new URL(BODY_SHOP.pageUrl, location.href).origin; } catch (e) { return false; }
  const payload = _b64url(JSON.stringify({ spec: spec, thumb: _styleThumb(st) }));
  const w = window.open(origin + SALON_UPLOAD.path + '#d=' + payload, '_blank');
  if (!w) { _salonNotice(salonL('팝업이 막혔어요 — 팝업을 허용하고 다시 눌러 주세요', 'Pop-up blocked — allow pop-ups and try again')); return false; }
  try { w.opener = null; } catch (e) { /* 무시 */ }
  return true;
}
window.uploadStyleToSalon = uploadStyleToSalon;

// 스타일을 고를 때마다(삭제 버튼과 같은 때) 같이 켜고 끔 · 언어를 바꿔도 다시 그림
(function () {
  if (typeof syncStyleDeleteBtn === 'function') {
    const _sync = syncStyleDeleteBtn;
    syncStyleDeleteBtn = function () { // eslint-disable-line no-global-assign
      const r = _sync.apply(this, arguments);
      try { syncSalonUploadBtn(); } catch (e) { /* 무시 */ }
      return r;
    };
  }
  if (typeof buildStyleGrid === 'function') {
    const _grid = buildStyleGrid;
    buildStyleGrid = function () { // eslint-disable-line no-global-assign
      const r = _grid.apply(this, arguments);
      try { syncSalonUploadBtn(); } catch (e) { /* 무시 */ }
      return r;
    };
  }
  document.addEventListener('click', e => {
    if (e.target && e.target.closest && e.target.closest('[onclick*="setLang"], [onclick*="toggleLang"], #langToggle, .lang-btn')) setTimeout(() => {
      syncSalonUploadBtn();
      if (document.getElementById('bodyGarmentRack') && typeof buildBodyGarmentRack === 'function') buildBodyGarmentRack();
    }, 0);
  }, true);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', syncSalonUploadBtn); else syncSalonUploadBtn();
})();
