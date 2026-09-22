/* ==========================================================================
   23-section-all.js — 섹션 통합 조정 (2026-09-21)

   이 파일은 난독화하지 않는다. 앞의 파일들을 건드리지 않고 바깥에서만 덧댄다.
   (22-ui-i18n-extra.js와 같은 방식 — 화면에는 한국어로 적고 I18N 표에서 영어로
   바꾼다. 앱 기본 언어가 EN이라 처음엔 영어로 보인다.)

   ① 모드 단추
      섹션 칩 줄(#gySectionBar) 위에 긴 단추 하나를 둔다.
        통합 모드  : "섹션 통합 조정" — 누르면 섹션별 조정으로 나뉜다.
        섹션별 모드: "섹션별 조정"     — 누르면 다시 통합으로 합쳐진다.
      통합 모드에서는 섹션 칩(크라운~네이프)이 비활성화되고, 맨 앞에 "전체" 칩이
      생긴다. 스타일링 칩은 섹션이 아니라 머리 전체 연출이라 그대로 쓸 수 있다.

   ② 상대값 조정
      통합 슬라이더에 보이는 값 = 6개 섹션의 평균.
      슬라이더를 움직이면, 드래그를 시작할 때의 섹션 값들을 기준으로
      움직인 만큼(Δ)을 모든 섹션에 똑같이 더한다 → 섹션 사이 차이가 유지된다.
      한 섹션이 범위 끝(0·100 등)에 먼저 닿아도, 기준값에서 다시 계산하므로
      되돌리면 원래 차이가 그대로 돌아온다.
      통합 대상: 커트 방식 · 길이 · 엘리베이션 · 텍스처라이징 · 숱 ·
                 컬 세기 · 웨이브 폭 · 컬 방향 · 전체 염색 · 페이드
      제외: 오버디렉션(템플 전용) · 커팅라인(프론트·네이프 전용) — 섹션별 모드에서.

   ③ 글로벌 컬(state._globalCurl) 동기화
      섹션 컬이 바뀌면(통합이든 섹션별이든) 글로벌 컬을 섹션 컬 평균으로 맞춘다.
      2D 비교 화면과 스타일 등록 카드가 3D와 같은 컬 세기를 쓰게 된다.
   ========================================================================== */

/* 처음 모드. true = 통합 모드로 시작, false = 예전처럼 섹션별로 시작. */
const GY_ALL_DEFAULT = true;

/* ------------------------------------------------------------------ 말 */
(function extendI18N_sectionAll() {
  if (typeof I18N === 'undefined') return;
  Object.assign(I18N, {
    '섹션 통합 조정': 'All sections',
    '섹션별 조정': 'Per section',
    '누르면 섹션별로 나눠서 조정해요': 'Tap to adjust each section separately',
    '누르면 모든 섹션을 한꺼번에 조정해요': 'Tap to adjust all sections together',
    '전체': 'All',
    '섹션 범위': 'Section range',
    '섹션마다 다름': 'Varies by section',
    '모든 섹션 · 평균값 표시': 'All sections · shows the average',
    '움직인 만큼 모든 섹션에 더해요 — 섹션 사이 차이는 그대로':
      'Adds the same amount to every section — differences between sections are kept',
    '모든 섹션에 같은 각도만큼 더해요':
      'Same degrees added to every section',
    '오버디렉션·커팅라인은 섹션 전용 값이라 섹션별 조정에서 바꿔요':
      'Overdirection and cutting line are per-section — change them in Per section',
    '머리 전체를 한 색으로 (기본 염색)': 'Whole head in one color (base dye)'
  });
  try { _i18nSubKeys = null; } catch (e) {}
})();

/* ------------------------------------------------------------------ 스타일 */
(function injectCss() {
  const css = `
  .gy-mode-btn{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;
    margin-bottom:6px;padding:11px 14px;border-radius:10px;cursor:pointer;font-family:inherit;
    background:var(--surface-2);border:1px solid var(--line);color:var(--text);text-align:left;transition:.15s;}
  .gy-mode-btn.all{border-color:var(--accent);background:#2a2318;color:var(--accent-soft);}
  .gy-mode-btn .gy-mode-title{font-size:13px;font-weight:600;}
  .gy-mode-btn .gy-mode-hint{font-size:10px;color:var(--text-muted);text-align:right;}
  .gy-chip.gy-chip-off{opacity:.3;cursor:not-allowed;pointer-events:none;}
  .gy-chip.gy-chip-all{flex-basis:100%;}
  .gy-all-range{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--text-muted);margin-top:3px;}
  `;
  const el = document.createElement('style');
  el.id = 'gy-section-all-css';
  el.textContent = css;
  document.head.appendChild(el);
})();

/* ------------------------------------------------------------------ 상태·계산 */
if (typeof state !== 'undefined' && typeof state.gyAllMode !== 'boolean') state.gyAllMode = GY_ALL_DEFAULT;

/* 통합 슬라이더로 다룰 값. min·max는 GYEOL_GROUPS 정의에서 가져온다(없으면 기본). */
const GY_ALL_PARAMS = {
  cut:  ['length', 'elevation', 'texture', 'density'],
  perm: ['curl', 'wave', 'curlDir']
};

function gyAllParamDef(key) {
  for (const g of GYEOL_GROUPS) {
    const p = (g.params || []).find(q => q.key === key);
    if (p) return p;
  }
  return { key, label: key, hint: '', min: 0, max: 100, unit: '' };
}

function gyAllValues(key) {
  return SECTION_ORDER
    .map(sec => state.sections[sec] && state.sections[sec][key])
    .filter(v => typeof v === 'number' && isFinite(v));
}

function gyAllAvg(key) {
  const vs = gyAllValues(key);
  if (!vs.length) return 0;
  return vs.reduce((a, b) => a + b, 0) / vs.length;
}

function gyAllRangeText(key) {
  const vs = gyAllValues(key);
  if (!vs.length) return '—';
  const lo = Math.round(Math.min(...vs)), hi = Math.round(Math.max(...vs));
  return lo === hi ? String(lo) : lo + '–' + hi;
}

/* 글로벌 컬 = 섹션 컬 평균 */
function gySyncGlobalCurl() {
  const vs = gyAllValues('curl');
  if (vs.length) state._globalCurl = Math.round(vs.reduce((a, b) => a + b, 0) / vs.length);
}

/* 드래그 한 번 동안의 기준값. { key, start, base:{sec:value} } */
let _gyAllDrag = null;

function gyAllBegin(key, startShown) {
  const base = {};
  for (const sec of SECTION_ORDER) {
    const v = state.sections[sec] && state.sections[sec][key];
    if (typeof v === 'number') base[sec] = v;
  }
  _gyAllDrag = { key, start: startShown, base };
}

function onGyAllSlider(key, raw, inputEl) {
  const v = parseInt(raw, 10);
  if (!isFinite(v)) return;
  if (!_gyAllDrag || _gyAllDrag.key !== key) {
    gyAllBegin(key, parseInt(inputEl.dataset.start, 10));
  }
  const p = gyAllParamDef(key);
  const delta = v - _gyAllDrag.start;
  for (const sec in _gyAllDrag.base) {
    const nv = Math.max(p.min, Math.min(p.max, _gyAllDrag.base[sec] + delta));
    state.sections[sec][key] = Math.round(nv * 1000) / 1000;
  }
  if (key === 'curl') gySyncGlobalCurl();

  const valEl = document.getElementById('gyallval-' + key);
  if (valEl) valEl.textContent = v + (p.unit || '');
  const rngEl = document.getElementById('gyallrng-' + key);
  if (rngEl) rngEl.textContent = gyAllRangeText(key);

  try { drawAdjustPreview(); } catch (e) {}
}

function onGyAllSliderEnd(key, inputEl) {
  _gyAllDrag = null;
  /* 한 섹션이 범위 끝에 붙었으면 평균이 움직인 값과 달라질 수 있으니 다시 맞춘다 */
  const shown = Math.round(gyAllAvg(key));
  inputEl.dataset.start = String(shown);
  inputEl.value = shown;
  const p = gyAllParamDef(key);
  const valEl = document.getElementById('gyallval-' + key);
  if (valEl) valEl.textContent = shown + (p.unit || '');
  SECTION_ORDER.forEach(sec => { try { updateSectionSummary(sec); } catch (e) {} });
}

/* ------------------------------------------------------------------ 통합 패널 */
function gyAllRangeCtrl(key, hintOverride) {
  const p = gyAllParamDef(key);
  const shown = Math.round(gyAllAvg(key));
  const d = document.createElement('div');
  d.className = 'gy-ctrl';
  d.innerHTML =
    '<div class="gy-ctrl-top">' +
      '<span><span class="gy-ctrl-label">' + p.label + '</span>' +
      '<span class="gy-ctrl-hint">' + (hintOverride || p.hint || '') + '</span></span>' +
      '<span class="gy-ctrl-val" id="gyallval-' + key + '">' + shown + (p.unit || '') + '</span>' +
    '</div>' +
    '<input type="range" min="' + p.min + '" max="' + p.max + '" value="' + shown + '" data-start="' + shown + '">' +
    '<div class="gy-all-range"><span>섹션 범위</span> <span id="gyallrng-' + key + '">' + gyAllRangeText(key) + '</span></div>';
  const inp = d.querySelector('input');
  inp.addEventListener('input', () => onGyAllSlider(key, inp.value, inp));
  inp.addEventListener('change', () => onGyAllSliderEnd(key, inp));
  return d;
}

function gyAllTechniqueSelect() {
  const vals = SECTION_ORDER.map(sec => (state.sections[sec] || {}).technique || 'uniform');
  const same = vals.every(v => v === vals[0]);
  const d = document.createElement('div');
  d.className = 'gy-ctrl';
  let opts = same ? '' : '<option value="" selected disabled>섹션마다 다름</option>';
  Object.keys(TECHNIQUES).forEach(k => {
    opts += '<option value="' + k + '"' + (same && vals[0] === k ? ' selected' : '') + '>' + TECHNIQUES[k].label + '</option>';
  });
  const hint = same ? TECHNIQUES[vals[0]].hint : '';
  d.innerHTML =
    '<div class="gy-ctrl-top"><span><span class="gy-ctrl-label">커트 방식</span>' +
    '<span class="gy-ctrl-hint">' + hint + '</span></span></div>' +
    '<select class="gy-select">' + opts + '</select>';
  const sel = d.querySelector('select');
  sel.onchange = () => {
    if (!TECHNIQUES[sel.value]) return;
    SECTION_ORDER.forEach(sec => { if (state.sections[sec]) state.sections[sec].technique = sel.value; });
    buildGyControls();
    try { drawAdjustPreview(); } catch (e) {}
  };
  return d;
}

function gyAllGroup(g, fillBody) {
  const collapsed = !!state.panelCollapsed[g.id];
  const wrap = document.createElement('div');
  wrap.className = 'gy-group' + (g.optional ? ' optional' : '') + (collapsed ? ' collapsed' : '');
  const head = document.createElement('div');
  head.className = 'gy-group-head';
  head.innerHTML =
    '<span class="gy-dot" style="background:' + g.color + '"></span>' +
    '<span class="gy-group-title" style="color:' + g.color + '">' + g.title + '</span>' +
    '<span class="gy-group-sub">' + g.sub + '</span>' +
    '<span class="gy-chevron">▼</span>';
  head.onclick = () => toggleGyGroup(g.id);
  wrap.appendChild(head);
  const body = document.createElement('div');
  body.className = 'gy-group-body';
  fillBody(body);
  wrap.appendChild(body);
  return wrap;
}

function buildGyAllControls(root) {
  const G = id => GYEOL_GROUPS.find(g => g.id === id);

  root.appendChild(gyAllGroup(G('cut'), body => {
    body.appendChild(gyAllTechniqueSelect());
    GY_ALL_PARAMS.cut.forEach(k => body.appendChild(gyAllRangeCtrl(k,
      k === 'elevation' ? '모든 섹션에 같은 각도만큼 더해요' : null)));
    if (typeof gyBuildFadeGroup === 'function') body.appendChild(gyBuildFadeGroup());
  }));

  root.appendChild(gyAllGroup(G('perm'), body => {
    GY_ALL_PARAMS.perm.forEach(k => body.appendChild(gyAllRangeCtrl(k)));
  }));

  root.appendChild(gyAllGroup(G('color'), body => {
    const all = gyDyeAllColor();
    const row = document.createElement('div');
    row.className = 'gy-toggle-row';
    row.innerHTML = '<div class="gy-toggle ' + (all ? 'on' : '') + '"></div>' +
      '<span class="gy-ctrl-hint">머리 전체를 한 색으로 (기본 염색)</span>';
    row.querySelector('.gy-toggle').onclick = () =>
      all ? gyClearDye('all') : gyApplyDye('all', state.globalColor || '#6B4A2E', false);
    body.appendChild(row);
    if (all) body.appendChild(gyColorEditor('all', all));
  }));

  const note = document.createElement('div');
  note.className = 'section-affects';
  note.style.cssText = 'padding-top:10px;line-height:1.6;';
  note.innerHTML = '<div>모든 섹션 · 평균값 표시</div>' +
    '<div>움직인 만큼 모든 섹션에 더해요 — 섹션 사이 차이는 그대로</div>' +
    '<div>오버디렉션·커팅라인은 섹션 전용 값이라 섹션별 조정에서 바꿔요</div>';
  root.appendChild(note);
}

/* ------------------------------------------------------------------ 모드 단추 */
function gyModeBtn() {
  let b = document.getElementById('gyModeBtn');
  if (b) return b;
  const bar = document.getElementById('gySectionBar');
  if (!bar || !bar.parentNode) return null;
  b = document.createElement('button');
  b.id = 'gyModeBtn';
  b.type = 'button';
  b.className = 'gy-mode-btn';
  b.addEventListener('click', toggleGyAllMode);
  bar.parentNode.insertBefore(b, bar);
  return b;
}

function syncGyModeBtn() {
  const b = gyModeBtn();
  if (!b) return;
  const all = !!state.gyAllMode;
  b.classList.toggle('all', all);
  b.innerHTML =
    '<span class="gy-mode-title">' + (all ? '섹션 통합 조정' : '섹션별 조정') + '</span>' +
    '<span class="gy-mode-hint">' + (all ? '누르면 섹션별로 나눠서 조정해요' : '누르면 모든 섹션을 한꺼번에 조정해요') + '</span>';
}

function toggleGyAllMode() {
  state.gyAllMode = !state.gyAllMode;
  _gyAllDrag = null;
  /* 스타일링 탭을 보고 있었으면 그대로 두고, 아니면 조정 패널을 새 모드로 */
  if (state.activePanelSection !== 'styling' && !SECTIONS[state.activePanelSection]) {
    state.activePanelSection = state.currentSection || 'crown';
  }
  buildGyPanel();
  try { drawAdjustPreview(); } catch (e) {}
}

/* 통합 모드에서 "전체" 칩: 스타일링 탭에서 통합 패널로 돌아오는 길 */
function selectGyAll() {
  state.activePanelSection = state.currentSection || 'crown';
  buildGyPanel();
  try { drawAdjustPreview(); } catch (e) {}
}

/* ------------------------------------------------------------------ 감싸기 */
(function wrapPanels() {
  const innerBar = window.buildGySectionBar;
  const innerCtrls = window.buildGyControls;
  const innerSlider = window.onGySlider;
  if (typeof innerBar !== 'function' || typeof innerCtrls !== 'function') {
    console.warn('[섹션통합] buildGySectionBar/buildGyControls가 없습니다 — 06-ui-panels.js보다 먼저 불렸습니까?');
    return;
  }

  window.buildGySectionBar = function () {
    const r = innerBar.apply(this, arguments);
    try {
      syncGyModeBtn();
      const bar = document.getElementById('gySectionBar');
      if (bar && state.gyAllMode) {
        const onStyling = state.activePanelSection === 'styling';
        bar.querySelectorAll('.gy-chip').forEach(ch => {
          if (ch.classList.contains('styling')) return;
          ch.classList.remove('active');
          ch.classList.add('gy-chip-off');
          ch.disabled = true;
          ch.onclick = null;
        });
        const allChip = document.createElement('button');
        allChip.className = 'gy-chip gy-chip-all' + (onStyling ? '' : ' active');
        allChip.innerHTML = '<span>전체</span><span class="en">ALL</span>';
        allChip.onclick = selectGyAll;
        bar.insertBefore(allChip, bar.firstChild);
      }
    } catch (e) { console.warn('[섹션통합] 칩 줄 갱신 실패:', e); }
    return r;
  };

  window.buildGyControls = function () {
    if (state.gyAllMode && state.activePanelSection !== 'styling') {
      const root = document.getElementById('gyControls');
      if (!root) return;
      root.innerHTML = '';
      try { buildGyAllControls(root); }
      catch (e) {
        console.warn('[섹션통합] 통합 패널을 못 그렸습니다 — 섹션별 패널로 대신합니다:', e);
        return innerCtrls.apply(this, arguments);
      }
      return;
    }
    return innerCtrls.apply(this, arguments);
  };

  /* 섹션별 모드에서 컬을 바꿔도 글로벌 컬을 따라가게 */
  if (typeof innerSlider === 'function') {
    window.onGySlider = function (sec, key) {
      const r = innerSlider.apply(this, arguments);
      if (key === 'curl') gySyncGlobalCurl();
      return r;
    };
  }
})();

/* 이미 조정 화면이 그려져 있으면 새 모드로 다시 그린다 */
(function initSectionAll() {
  const go = () => { try { buildGyPanel(); } catch (e) {} };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go);
  else go();
})();
