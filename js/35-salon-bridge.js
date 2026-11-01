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
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(rawId)) return reply(ev, { id: rawId, ok: false, error: '잘못된 스타일 id' });
    let spec;
    try { spec = cleanSpec(d.spec); } catch (e) { return reply(ev, { id: rawId, ok: false, error: '스타일 스펙을 읽지 못했어요: ' + e.message }); }

    const salonName = d.salon && typeof d.salon.name === 'string' ? d.salon.name.slice(0, 80) : '';
    const styleName = typeof d.name === 'string' ? d.name.slice(0, 80) : (spec.name || '미용실 스타일');
    spec.name = salonName ? salonName + ' · ' + styleName : styleName;

    const key = 'salon_' + rawId.replace(/-/g, '_');
    if (typeof STYLE_SPECS === 'undefined' || typeof applyStyleSpecAndRender !== 'function') {
      return reply(ev, { id: rawId, ok: false, error: '이 버전의 GYEOL 은 스타일 입어 보기를 지원하지 않아요' });
    }
    STYLE_SPECS[key] = spec;

    // 같은 스타일을 다시 누르면 applyStyleSpecAndRender 가 "벗기기"로 동작 → 이미 입었으면 그대로 둠
    if (state && state.specAppliedId === key) {
      toast(spec.name + ' — 이미 입고 있어요');
      if (SALON_BRIDGE.closeAfterApply) closeShopPanel();
      return reply(ev, { id: rawId, ok: true });
    }

    let res = null;
    try { res = applyStyleSpecAndRender(key); } catch (e) {
      console.warn('[미용실] 스타일 적용 실패', e);
      return reply(ev, { id: rawId, ok: false, error: '스타일을 입히다 오류가 났어요' });
    }
    if (res) {
      toast(spec.name + ' 입혔어요');
      reply(ev, { id: rawId, ok: true });
      if (SALON_BRIDGE.closeAfterApply) closeShopPanel();
    } else if (!state || !state.hair3Dneutral) {
      // 3D 머리를 아직 만드는 중 — 다 되면 17a 가 같은 스펙을 이어서 입힘
      toast('3D 머리를 준비하는 중… 끝나면 ' + spec.name + ' 을(를) 입혀요');
      reply(ev, { id: rawId, ok: true, pending: true });
      if (SALON_BRIDGE.closeAfterApply) closeShopPanel();
    } else {
      reply(ev, { id: rawId, ok: false, error: '먼저 사진을 찍거나 마네킹으로 3D 머리를 만들어 주세요' });
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
    if (fr) fr.title = '미용실 지도';
    const bar = document.querySelector('#bbShopPanel .bb-shop-bar span');
    if (bar) bar.textContent = '미용실 지도';
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
          b.textContent = salonOpen ? '미용실 닫기' : '미용실';
          b.title = '근처 미용실 지도에서 헤어스타일을 골라 입어 봅니다';
          b.addEventListener('click', () => (salonOpen ? closeShopPanel() : openSalonMap()));
          rack.appendChild(b);
          // 지도가 열려 있을 땐 「옷 닫기」 대신 「옷 고르기」로 보이게
          if (salonOpen) {
            for (const x of rack.querySelectorAll('button')) {
              if (x === b || x.textContent !== '옷 닫기') continue;
              const n = x.cloneNode(false); // 원래 「닫기」 동작을 떼어 내고 「옷 고르기」로 바꿈
              n.textContent = '옷 고르기';
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
