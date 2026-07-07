/* ════════════════════════════════════════
   SECTION UI
════════════════════════════════════════ */
const PARAM_LABELS = {
  length:'길이', volume:'볼륨', line:'라인', blend:'연결감', layer:'레이어',
};

function buildSectionTabs(){
  const container = document.getElementById('sectionTabs');
  container.innerHTML = '';
  SECTION_ORDER.forEach(id=>{
    const sec = SECTIONS[id];
    const div = document.createElement('div');
    div.className = 'section-tab' + (state.currentSection===id?' active':'');
    div.id = 'sectab-'+id;

    // 이 섹션이 현재 뷰에 보이는지 표시
    const visHere = sec.visibleIn.includes(state.currentViewAngle);
    const viewNote = visHere ? '' : `<span style="color:var(--warn);font-size:10px;">현재 뷰에서 안 보임</span>`;

    div.innerHTML = `
      <div class="section-tab-header" onclick="selectSection('${id}')">
        <div class="section-tab-left">
          <span class="section-badge">${sec.labelEn}</span>
          <div>
            <div class="section-tab-name">${sec.label} ${viewNote}</div>
            <div class="section-tab-desc">${sec.desc}</div>
          </div>
        </div>
        <div class="section-tab-summary" id="sectab-summary-${id}"></div>
      </div>
      <div class="section-tab-body" id="sectab-body-${id}">
        ${sec.params.map(p=>`
          <div class="slider-block">
            <div class="param-label-row">
              <span class="param-label">${PARAM_LABELS[p]||p}</span>
              <span class="param-val" id="secval-${id}-${p}">${state.sections[id][p]}</span>
            </div>
            <input type="range" id="secslider-${id}-${p}" min="0" max="100"
              value="${state.sections[id][p]}"
              oninput="onSectionSlider('${id}','${p}',this.value)">
          </div>
        `).join('')}
        <div class="section-affects">영향: ${sec.visibleIn.map(v=>ANGLE_LABELS[v]).join(' · ')}</div>
      </div>`;
    container.appendChild(div);
    updateSectionSummary(id);
  });
}

function selectSection(id){
  state.currentSection = id;
  // 탭 active 토글
  SECTION_ORDER.forEach(sid=>{
    document.getElementById('sectab-'+sid)?.classList.toggle('active', sid===id);
  });
  // 해당 섹션이 보이는 뷰로 자동 전환
  const visIn = SECTIONS[id].visibleIn;
  if(!visIn.includes(state.currentViewAngle)){
    state.currentViewAngle = visIn[0];
    renderAngleSwitch('angleSwitch');
    renderAngleSwitch('angleSwitchCompare');
    drawAdjustPreview();
  }
}

function onSectionSlider(secId, param, val){
  const intVal = parseInt(val);
  // 현재 뷰에 직접 적용
  state.sections[secId][param] = intVal;
  document.getElementById(`secval-${secId}-${param}`).textContent = val;
  updateSectionSummary(secId);
  // 섹션 간 연동 (같은 뷰 안에서)
  propagateSectionChange(secId, param);
  // 뷰 간 연동 (랜드마크 매핑 기반으로 인접 뷰에 반영)
  const curAngle = state._adjustAngle || 'front';
  propagateSectionToViews(curAngle, secId, param, intVal);
  drawAdjustPreview();
}

function onGlobalCurl(val){
  state._globalCurl = parseInt(val);
  document.getElementById('val-globalCurl').textContent = val;
  drawAdjustPreview();
}

function propagateSectionChange(secId, param){
  // crown 길이 → temple 길이에 50% 반영 (연결감 유지)
  if(secId==='crown' && param==='length'){
    const crownLen = state.sections.crown.length;
    const templeBlend = state.sections.temple.blend / 100;
    const newTemple = Math.round(crownLen * (1 - templeBlend*0.4));
    state.sections.temple.length = Math.max(0, Math.min(100, newTemple));
    const tSlider = document.getElementById('secslider-temple-length');
    if(tSlider) tSlider.value = state.sections.temple.length;
    const _tv = document.getElementById('secval-temple-length'); if(_tv) _tv.textContent = state.sections.temple.length;
    updateSectionSummary('temple');
  }
  // side 길이 변경 시 occipital에 30% 반영
  if(secId==='side' && param==='length'){
    const blend = 0.3;
    state.sections.occipital.length = Math.round(
      state.sections.occipital.length * (1-blend) + state.sections.side.length * blend
    );
    const oSlider = document.getElementById('secslider-occipital-length');
    if(oSlider) oSlider.value = state.sections.occipital.length;
    const _ov = document.getElementById('secval-occipital-length'); if(_ov) _ov.textContent = state.sections.occipital.length;
    updateSectionSummary('occipital');
  }
}

function updateSectionSummary(id){
  const el = document.getElementById('sectab-summary-'+id);
  if(!el) return;
  const vals = state.sections[id];
  const sec = SECTIONS[id];
  el.textContent = sec.params.map(p=>`${PARAM_LABELS[p]||p} ${vals[p]}`).join(' · ');
}

function resetSections(){
  SECTION_ORDER.forEach(id=>{
    const sec = SECTIONS[id];
    state.sections[id] = {...sec.defaults};
    sec.params.forEach(p=>{
      const s = document.getElementById(`secslider-${id}-${p}`);
      const v = document.getElementById(`secval-${id}-${p}`);
      if(s) s.value = sec.defaults[p];
      if(v) v.textContent = sec.defaults[p];
    });
    updateSectionSummary(id);
  });
  state._globalCurl = 30;
  document.getElementById('slider-globalCurl').value = 30;
  document.getElementById('val-globalCurl').textContent = 30;
  drawAdjustPreview();
}

// 하위 호환: selectStyle에서 슬라이더 동기화
function syncSliderUI(){
  // 섹션 시스템에서는 buildSectionTabs()로 대체
  buildSectionTabs();
  document.getElementById('adjustStyleTag').textContent =
    state.selectedStyle ? state.selectedStyle.name : '스타일 미선택';
  drawAdjustPreview();
}

