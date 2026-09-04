/* ══════════════════════════════════════════════════════════
   06-ui-panels.js — 스타일 선택 · 섹션 UI · 조정 패널 · 염색 손잡이 · 레시피
   원본 index.html 9177~10380행. 클래식 스크립트이므로 로드 순서가 곧
   실행 순서다 — index.html의 <script src> 순서를 바꾸지 말 것.
   ══════════════════════════════════════════════════════════ */
/* ════════════════════════════════════════
   STYLE SELECT
════════════════════════════════════════ */
function buildStyleGrid(){
  const grid=document.getElementById('styleGrid');
  grid.innerHTML='';

  // ── "스타일 미적용" 특수 카드 ──
  // 프리셋을 하나도 안 고르고, 실제 촬영된 결(원본)을 조정화면에서 바로
  // 직접 만지고 싶을 때. selectStyle()의 예전 ROADMAP 메모("스타일 미적용
  // 직접편집 정식 모드로 승격")를 실제로 구현한 것 — 각 섹션을 자기 기본값
  // (SECTIONS[id].defaults)으로, 전역 컬은 0(원본 결방향만 따라가도록)으로
  // 초기화하고 바로 조정화면으로 넘어갈 수 있게 함.
  const noneCard=document.createElement('div');
  noneCard.className='style-card style-card-none'; noneCard.id='style-none';
  noneCard.onclick=()=>selectNoStyle();
  noneCard.innerHTML=`
    <div class="style-icon-box" style="display:flex;align-items:center;justify-content:center;font-size:28px;opacity:0.6;">✂️</div>
    <div class="name">스타일 미적용</div>
    <div class="tags">결원본 직접 조정</div>`;
  grid.appendChild(noneCard);

  STYLES.forEach(st=>{
    const card=document.createElement('div');
    card.className='style-card'; card.id='style-'+st.id;
    card.onclick=()=>selectStyle(st.id);
    card.innerHTML=`
      <div class="style-icon-box">${styleIconSVG(st)}</div>
      <div class="name">${st.name}</div>
      <div class="tags">${st.tags}</div>`;
    grid.appendChild(card);
  });
}
function styleIconSVG(st){
  let s=''; const n=14;
  for(let i=0;i<n;i++){
    const t=i/(n-1), x=20+t*60;
    const amp=(st.curl/100)*14, len=16+(st.length/100)*50;
    const mx=x+Math.sin(t*6)*amp, ex=x+Math.sin(t*6+1)*amp*1.3;
    s+=`<path d="M ${x} 16 Q ${mx} ${16+len*0.5} ${ex} ${16+len}" stroke="${st.colorHex}" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.9"/>`;
  }
  return `<svg viewBox="0 0 100 90" width="100%" height="100%"><circle cx="50" cy="12" r="9" fill="#3A332B"/>${s}</svg>`;
}
function selectStyle(id){
  state.selectedStyle=STYLES.find(s=>s.id===id);
  document.querySelectorAll('.style-card').forEach(c=>c.classList.remove('selected'));
  document.getElementById('style-'+id).classList.add('selected');
  document.getElementById('toAdjustBtn').disabled=false;
  const st = state.selectedStyle;

  /* ── (2026-08-29) 스펙 스타일 카드 ──────────────────────────────────────
     조정 화면 모드바의 '레이어드 보브'/'페이드 폼파두르' 버튼과 <b>같은 것</b>을
     스타일 화면에서 고르게 한 것이다. 값을 여기서 채우지 않는 이유는 위 STYLES
     주석 참고 — 역산에 3D 중립 모델이 필요한데 이 화면엔 아직 없다.

     applyStyleSpec은 "마네킹 상태 위에 커트를 얹는다"를 전제로 한다(시술 순서:
     커트 → 펌 → 염색 → 스타일링). 그래서 selectNoStyle과 <b>똑같이</b> 초기화한
     다음 스펙을 예약한다 — 손님 머리에 남아 있던 컬·스타일링 위에 얹으면 역산이
     그 위에서 풀려서 스펙대로 안 나온다. */
  if(st.specId){
    resetSections();       // 섹션 기본값 + 스타일링 중립
    state._globalCurl = 0;
    SECTION_ORDER.forEach(sid=>{ state.sections[sid].curl = 0; });
    mannequinReset();      // 손님 웨이브 펴기 + 빗질 삭제
    state.pendingSpecId = st.specId;
    syncSliderUI();
    return;
  }
  state.pendingSpecId = null;   // 다른 카드를 고르면 예약은 취소된다

  if(st.sections){
    // ── 커스텀 등록 스타일("현재 모델을 스타일로 등록하기"로 만든 것) ──
    // length/curl/volume 대표값에서 섹션별로 역산하는 기존 방식 대신,
    // 등록 당시 실제 섹션별 조정값을 그대로 복원한다(그래서 등록한 그
    // 모습 그대로 다시 불러와짐).
    SECTION_ORDER.forEach(sid=>{
      if(st.sections[sid]){
        // 예전(gyeol 이식 전)에 저장된 커스텀 스타일 하위호환: 누락된 신규 필드는
        // 해당 섹션 기본값으로 채워서 UI/렌더가 깨지지 않게 함.
        state.sections[sid] = { ...SECTIONS[sid].defaults, ...st.sections[sid] };
      }
    });
    /* (2026-07-27) 스타일링이 뷰별로 바뀌었다. 예전에 저장된 스타일은 전역
       한 벌이므로 네 뷰에 <b>같은 값</b>을 채워 예전 모습 그대로 복원한다
       (네 뷰가 같으면 섞기 가중치 합이 1이라 결과가 정확히 일치한다). */
    if(st.stylingByView){
      state.stylingByView = neutralStylingByView();
      for(const a of ANGLES) if(st.stylingByView[a])
        state.stylingByView[a] = { ...neutralStyling(), ...st.stylingByView[a] };
      bindStylingToCurrentView();
    } else if(st.styling){
      const one = { ...neutralStyling(), ...st.styling };
      state.stylingByView = {}; for(const a of ANGLES) state.stylingByView[a] = { ...one };
      bindStylingToCurrentView();
    }
    state._globalCurl = (typeof st.globalCurl === 'number') ? st.globalCurl : 30;
  } else {
    // ── 기본 프리셋: length/curl/volume 대표값에서 섹션별 값 파생 ──
    // volume(0~100, STYLES 프리셋 정의값) → elevation(0~90°) 환산해서 사용.
    const elevFromVolume = Math.round((st.volume/100) * 90);
    // gyeol 이식 후 컬은 섹션별 절대값(0~100) — 프리셋 대표 curl을 전 섹션에 균일 적용.
    const presetCurl = Math.max(0, Math.min(100, st.curl));
    state.sections.crown.length     = st.length;
    state.sections.crown.elevation  = elevFromVolume;
    state.sections.crown.curl       = presetCurl;
    state.sections.front.length     = Math.round(st.length * 0.85); // 앞머리는 약간 짧게
    state.sections.front.line       = 50;
    state.sections.front.curl       = presetCurl;
    state.sections.temple.length    = Math.round(st.length * 0.80);
    state.sections.temple.overdirection = 50;
    state.sections.temple.curl      = presetCurl;
    state.sections.side.length      = Math.round(st.length * 0.90);
    state.sections.side.elevation   = st.curl > 40 ? 35 : 18; // 컬 강한 스타일일수록 사이드도 시술각↑(레이어감)
    state.sections.side.curl        = presetCurl;
    state.sections.occipital.length = st.length;
    state.sections.occipital.elevation = elevFromVolume;
    state.sections.occipital.curl   = presetCurl;
    state.sections.nape.length      = Math.round(st.length * 0.60);
    state.sections.nape.line        = 50;
    state.sections.nape.curl        = presetCurl;
    state._globalCurl = st.curl;
  }
  syncSliderUI();
}

/* "스타일 미선택" = <b>마네킹 초기화 상태</b> (2026-08-08, 사용자 정의)
   ─────────────────────────────────────────────────────────────────
   사용자: "내가 말하는 시술모드라는 거는 머리에 컬이랑 스타일링을 다 없애고
   마네킹 초기화 상태로 만들어놓는 걸 말하는 거야. 처음에 스타일 선택안함을
   누르고 들어가면 머리가 초기화상태가 되도록."
   이유는 시술 순서다 — 커트 → 펌 → 염색 → 스타일링인데, 시작할 때 이미 컬과
   스타일링이 들어가 있으면 그 위에 또 얹는 꼴이라 시술이 복잡해진다.

   그래서 여기서 <b>세 가지</b>를 모두 0으로 만든다:
     ① 섹션 파라미터 기본값 + 전 섹션 컬 0        (예전부터 하던 것)
     ② 스타일링(넘김·볼륨·결흐름·가르마) 중립     (resetSections가 처리)
     ③ 손님 머리에 <b>구워져 있는</b> 웨이브 펴기 (BASE_RESET.straighten)
   ③이 빠져 있었다. ①②는 우리 슬라이더를 되돌리는 것뿐이고, 손님의 웨이브는
   슬라이더가 아니라 캡처된 가닥 좌표 자체에 들어 있다(사진 결 필드를 따라
   그린 경로를 3D로 올린 것이라 곱슬 1.08°/px 같은 실측 굴곡이 그대로 있다).
   ③까지 해야 진짜 "마네킹 상태"가 된다. */
function selectNoStyle(){
  state.selectedStyle = null;
  state.pendingSpecId = null;   // (2026-08-29) 스펙 카드 예약도 취소
  document.querySelectorAll('.style-card').forEach(c=>c.classList.remove('selected'));
  const noneCard = document.getElementById('style-none');
  if(noneCard) noneCard.classList.add('selected');
  document.getElementById('toAdjustBtn').disabled = false;
  resetSections();       // ① 섹션별 기본값 + ② 스타일링 중립
  state._globalCurl = 0; // 하위호환 플래그
  // "원본 결" 취지: 펌 없이 실측 결방향만 따라가도록 전 섹션 컬을 0으로.
  SECTION_ORDER.forEach(id=>{ state.sections[id].curl = 0; });
  mannequinReset();      // ③ 손님 웨이브 펴기 + 빗질 삭제
  syncSliderUI();
}
/* 프리셋 스타일을 고르면 초기화 상태를 <b>풀지 않는다</b>. 시술 순서상
   커트·펌은 편 머리 위에 얹는 게 맞고, 손님 원래 컬로 돌아가고 싶으면
   조정 화면의 '손님 원래 컬' 버튼으로 되돌린다. */
loadCustomStylesFromStorage(); // 이전 세션에 등록해둔 커스텀 스타일 복원 — 반드시 buildStyleGrid()보다 먼저 실행돼야 함
buildStyleGrid();

/* ════════════════════════════════════════
   SECTION UI
════════════════════════════════════════ */
const PARAM_LABELS = {
  length:'길이', line:'커팅라인', elevation:'엘리베이션(시술각)', overdirection:'크라운 연동비율',
  // 아래 3개는 새 파라미터로 교체되기 전 이름 — 예전에 저장된 커스텀 스타일
  // (localStorage)이 혹시 이 이름으로 된 섹션 데이터를 갖고 있어도 라벨이
  // 깨지지 않도록 유지(하위 호환, 화면에 나올 일은 거의 없음).
  volume:'볼륨', blend:'연결감', layer:'레이어',
};

// gyeol 패널의 특정 섹션 파라미터 UI(값 라벨 + 슬라이더 위치)를 state와 동기화.
// 연동(propagateSectionChange)으로 "지금 안 만지고 있는" 섹션 값이 바뀌었을 때 사용.
function syncGyParamUI(secId, key){
  const v = state.sections[secId][key];
  const unit = GY_UNIT[key] || '';
  const valEl = document.getElementById(`gyval-${secId}-${key}`);
  if(valEl) valEl.textContent = Math.round(v) + unit;
  const rangeEl = document.getElementById(`gyrange-${secId}-${key}`);
  if(rangeEl) rangeEl.value = v;
}

function propagateSectionChange(secId, param, delta){
  // ── 래칫(누적 수렴) 버그 수정(2026-07-22) ──
  // 예전엔 "절대값 가중평균"(temple = temple×(1-r) + crown×r)을 슬라이더 input
  // 이벤트마다 반복 적용했음. 드래그 한 번에 이벤트가 수십 번 발생하므로 매
  // 틱마다 블렌딩이 중첩돼, 드래그가 끝나면 연동 섹션이 원래 값과 무관하게
  // 크라운/사이드 값에 거의 수렴해버림 — "사이드만 조정했는데 뒤(후두부)까지
  // 전부 움직인다"의 두 번째 원인. → "변화량(delta)×연동비율"만 더하는 방식으로
  // 변경: 이벤트가 몇 번 쪼개져 오든 합산 결과는 (총 변화량×비율)로 동일해서
  // 드래그 속도/횟수에 영향을 받지 않는다. 값은 반올림 없이 실수로 누적하고
  // 표시할 때만 반올림(1틱 delta=1처럼 작은 변화가 반올림에 먹히지 않도록).
  if(typeof delta !== 'number' || delta === 0) return;
  /* ── 크라운→템플 <b>값 전파를 걷어냈다</b> (2026-09-02 4차) ────────────────
     사용자: "크라운을 건드렸는데 왼쪽 템플이 움직이고, 템플을 조정하는데
     오른쪽 템플은 안 움직여."

     오버디렉션이 <b>두 군데에 동시에</b> 걸려 있었다:
       배선 1 (여기)            — state.sections.temple.length 를 직접 굴린다
       배선 2 (cutRatioForStrand ③) — 기하에서 템플 L을 크라운 가이드로 당긴다
     같은 연동이 두 번 곱해지니 크라운 20칸에 템플이 실질 30칸어치 움직였고,
     무엇보다 <b>손도 안 댄 슬라이더가 저 혼자 굴러가는</b> 그림이 됐다.

     둘 중 남길 것은 <b>배선 2</b>다. 미용에서 오버디렉션은 "관자 머리를 크라운
     쪽으로 빗어 올려 <b>거기서 자른다</b>"는 <b>시술</b>이지, 관자 슬라이더 눈금을
     옮기는 일이 아니다. 슬라이더는 사용자가 지시한 값이고 연동이 덮어쓸 것이
     아니다 — 값은 값대로 두고 <b>자르는 기하에서만</b> 섞는다.
     ⚠ 되돌릴 일이 있어도 여기를 되살리지 말고 배선 2의 od를 올릴 것. 두 벌이
       되는 순간 다시 곱해진다(이 파일이 반복해서 당한 자리다).
     side→occipital은 성격이 다르다(오버디렉션이 아니라 측면↔후면 이음새이고
     기하 쪽에 짝이 없다) — 그대로 둔다. */
  // side 길이 변경 시 occipital에 변화량의 30% 반영(측면↔후면 연결 자연스럽게)
  if(secId==='side' && param==='length'){
    state.sections.occipital.length = Math.round(Math.max(0, Math.min(100,
      state.sections.occipital.length + delta * 0.3)) * 1000) / 1000; // FP 잔재만 제거(0.001 스냅)
    syncGyParamUI('occipital', 'length');
    updateSectionSummary('occipital');
  }
}

function updateSectionSummary(id){
  const el = document.getElementById('sectab-summary-'+id);
  if(!el) return;
  const vals = state.sections[id];
  const sec = SECTIONS[id];
  el.textContent = sec.params.map(p=>{
    const unit = (sec.paramMeta && sec.paramMeta[p] && sec.paramMeta[p].unit) || '';
    // 연동값은 실수로 누적되므로 표시할 때만 반올림
    const v = (typeof vals[p]==='number') ? Math.round(vals[p]) : vals[p];
    return `${PARAM_LABELS[p]||p} ${v}${unit}`;
  }).join(' · ');
}

function resetSections(){
  SECTION_ORDER.forEach(id=>{ state.sections[id] = {...SECTIONS[id].defaults}; });
  /* 바탕 염색도 같이 지운다 — defaults의 color:null이 섹션 색만 지우고
     state.dyeAll이 남으면, 다음 gyResolveDye에서 색이 <b>혼자 되살아난다</b>. */
  state.dyeAll = null;
  state.stylingByView = neutralStylingByView();
  bindStylingToCurrentView();
  state._globalCurl = 30;
  buildGyPanel();
  drawAdjustPreview();
}

// 3D 미리보기 패널 토글.
// (2026-07-26) 의미가 바뀌었다. 예전엔 이 버튼이 "조정을 3D로 할지 2D로 할지"를
// 정하는 경로 스위치였는데, 이제 조정 경로는 3D 하나뿐이라(renderFrame의
// canProject에서 플래그 게이트 제거) 이 버튼은 미니 3D 패널을 보여줄지만 정한다.
// state.use3DAdjust는 그 패널 표시 상태를 뜻하는 이름으로 남아 있음.
function toggle3DAdjust(){
  state.use3DAdjust = !state.use3DAdjust;
  const btn = document.getElementById('btn3dEngine');
  if(btn) btn.textContent = '3D 미리보기: ' + (state.use3DAdjust ? 'ON' : 'OFF');
  if(state.use3DAdjust){
    showDevMini3D(true);              // 미니뷰 패널 표시(초기화)
    // 중립 3D 모델은 조정 경로가 이미 쓰고 있어 대개 준비돼 있음. 없으면 1회 생성.
    if(state.hair3Dneutral){ refreshDevMini3D(); drawAdjustPreview(); }
    else buildNeutralHair3D(()=>{ refreshDevMini3D(); drawAdjustPreview(); });
  } else {
    showDevMini3D(false);             // 패널만 닫음 — 조정 경로는 그대로 3D
  }
}

/* ════════════════════════════════════════════════════════════════
   gyeol 2D 설계 패널 빌더 (조정 화면)
   섹션칩 → 커트/펌/컬러 공정그룹 + 스타일링 마무리 탭.
   상태는 index의 state.sections / state.styling 을 직접 읽고 쓴다.
   변경 시 drawAdjustPreview()로 실측 세그 렌더를 즉시 갱신.
   ════════════════════════════════════════════════════════════════ */
// 패널을 그릴 때마다 현재 뷰의 스타일링을 물린다(뷰별 스타일링 — 2026-07-27).
// 각도 탭 전환 외에 화면 진입·리셋 경로에서도 어긋나지 않게 하는 단일 지점.
function buildGyPanel(){ bindStylingToCurrentView(); buildGySectionBar(); buildGyControls(); }

function buildGySectionBar(){
  const bar = document.getElementById('gySectionBar');
  if(!bar) return;
  bar.innerHTML = '';
  SECTION_ORDER.forEach(id=>{
    const sec = SECTIONS[id];
    const b = document.createElement('button');
    b.className = 'gy-chip' + (state.activePanelSection===id ? ' active' : '');
    const visHere = sec.visibleIn.includes(state.currentViewAngle);
    const dim = visHere ? '' : ' style="opacity:.55"';
    b.innerHTML = `<span${dim}>${sec.label}</span><span class="en">${sec.labelEn}</span>`;
    b.onclick = ()=> selectGySection(id);
    bar.appendChild(b);
  });
  // 스타일링(마무리) 칩 — 섹션과 별개인 머리 전체 연출
  const sb = document.createElement('button');
  sb.className = 'gy-chip styling' + (state.activePanelSection==='styling' ? ' active' : '');
  sb.innerHTML = `스타일링<span class="en">FINISH</span>`;
  sb.onclick = ()=> selectGySection('styling');
  bar.appendChild(sb);
}

function selectGySection(id){
  state.activePanelSection = id;
  if(id !== 'styling'){
    state.currentSection = id; // 하위호환(음성 등에서 참조)
    // 해당 섹션이 안 보이는 뷰면, 잘 보이는 뷰로 자동 전환
    const visIn = SECTIONS[id].visibleIn;
    if(!visIn.includes(state.currentViewAngle)){
      state.currentViewAngle = visIn[0];
      renderAngleSwitches();
      updateSegStatus();
    }
  }
  buildGyPanel();
  drawAdjustPreview();
}

// 섹션 슬라이더 공통 핸들러 — length는 섹션/뷰 연동(propagate)까지 수행.
function onGySlider(secId, key, val){
  const num = parseInt(val, 10);
  // 연동(propagate)이 "변화량" 기반이 되도록 이전 값을 먼저 확보(래칫 버그 수정)
  const prev = (typeof state.sections[secId][key] === 'number') ? state.sections[secId][key] : num;
  state.sections[secId][key] = num;
  const valEl = document.getElementById(`gyval-${secId}-${key}`);
  if(valEl){
    const unit = GY_UNIT[key] || '';
    valEl.textContent = num + unit;
  }
  if(key === 'length'){
    propagateSectionChange(secId, 'length', num - prev); // 크라운→템플 등 flat 연동(렌더가 읽음) — 델타 기반
    // propagateSectionToViews(뷰별 값 블렌딩) 제거: state.sections[angle][sectionId](뷰별
    // 중첩)에 쓰던 값을 렌더러는 안 읽어(flat state.sections[secId]만 읽음) 사실상 죽은
    // 계산이었고, 섹션 값이 flat 하나라 모든 뷰의 해당 섹션 가닥에 자동 적용된다(=뷰 간
    // 일관성은 flat 모델이 이미 보장). 뒷단계 3D 조정도 "섹션 하나=값 하나"라 불필요.
  }
  // [진단용] 조정이 실제로 상태에 기록되고 렌더가 재요청되는지 추적. rawMode가 true면
  // 모든 섹션 값이 중립화돼 조정이 화면에 안 나타남 → 이 로그로 즉시 판별.
  // (2026-07-22) 슬라이더 틱마다 찍혀 콘솔이 넘치던 것 → 상세 모드에서만 출력.
  if(window.DIAG_VERBOSE) console.log('[진단·조정] '+secId+'.'+key+'='+num+' | 저장확인='+state.sections[secId][key]+' | rawMode='+state.debugShowRaw+' | 현재화면='+currentScreen);
  drawAdjustPreview();
}
const GY_UNIT = { length:'%', elevation:'°', texture:'%', density:'%', curl:'%', wave:'%', overdirection:'%' };

// 커트기법 변경
function onGyTechnique(secId, tech){
  state.sections[secId].technique = tech;
  buildGyControls(); // hint 갱신
  drawAdjustPreview();
}

/* ══════════════════════════════════════════════════════════════════
   염색 손잡이 (2026-09-03) — <b>어떤 색이든, 머리 전체에도</b>
   ─────────────────────────────────────────────────────────────────
   사용자: "염색 색깔을 <b>어떤 색이든</b> 가능하게 만들어줘."

   엔진(HAIR_DYE)은 9/2에 이미 어떤 색이든 받게 됐고 cssToRGB도 뭐든 읽는다.
   막혀 있던 것은 <b>입구</b> 두 곳이다:
     ① 색을 넣는 자리가 <b>"이 섹션만 다른 색(발레아쥬)"</b> 하나뿐이었다.
        기본 염색은 머리 <b>전체</b>가 한 색인데, 그걸 하려면 섹션 여섯 개를
        하나씩 켜고 하나씩 골라야 했다 — 조작 6번. 제품 방향("현장에서
        걸리는 시간")에 정면으로 어긋나는 자리다.
     ② 넣을 수 있는 표기가 <b>hex뿐</b>이었다(스와치 11개 + input type=color).
        엔진은 색이름·rgb()·hsl()·oklch()를 전부 읽는데 화면에 그 입구가 없었다.
   그래서 <b>범위(scope)</b>와 <b>표기</b> 두 축을 다 연다. 엔진·LUT·캐시
   서명은 한 줄도 안 건드렸다 — 여기서 정해지는 건 sec.color 문자열뿐이다.

   ⚠ 저장은 <b>#rrggbb 한 벌</b>로 접는다(gyNormalizeColor). 같은 색이 다르게
     적히면 adjFilterSig가 다른 서명이 되어 필터 캐시가 헛돈다.
   ⚠ 드래그 중에는 <b>패널을 다시 그리지 않는다</b>(live=true). 예전 코드는
     oninput마다 buildGyControls()를 불렀고, 그러면 지금 잡고 있는
     <input type=color>가 DOM에서 통째로 교체된다 — 데스크톱에서 열려 있던
     색 선택기가 손에서 닫혔다. 9/2 배너의 확인항목 ⓓ가 바로 이 자리다.
   되돌리기: gyBuildColorBody에서 ①블록(전체 염색)만 빼면 예전 화면.
   ══════════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════════════
   염색 모델을 <b>두 층</b>으로 나눈다 (2026-09-04)
   ─────────────────────────────────────────────────────────────────
   사용자: "머리 전체에도 할 수 있고 섹션에도 할 수 있도록 구분해뒀는데
   <b>토글 하나를 켜면 둘 다 켜지고</b> 머리 전체에는 염색이 안 돼."

   원인은 <b>진실을 sec.color 여섯 개에만 둔 것</b>이었다. 9/3에는 그게
   "플래그와 실제가 갈라지지 않는다"는 이유로 옳아 보였는데, 갈라지지 않는
   대신 <b>두 손잡이가 한 값을 공유</b>하게 됐다:
     · 전체를 켜면 여섯 섹션이 다 칠해진다 → 섹션 토글도 켜짐으로 보인다.
     · 그 상태에서 <b>아래쪽</b>(섹션) 슬라이더를 잡고 색을 돌리면 그 섹션만
       바뀐다 → 여섯이 더 이상 같은 색이 아니므로 전체 토글이 <b>꺼진다</b>.
       화면에는 똑같이 생긴 조합기가 둘이라 어느 쪽을 잡았는지 알 수가 없다.
       이것이 "머리 전체에는 염색이 안 된다"의 정체다 — 걸리기는 걸리는데
       바로 다음 조작에서 조용히 풀린다.
   시술로 보면 이 둘은 애초에 <b>다른 공정</b>이다. 전체 염색은 바탕이고,
   발레아쥬는 그 위에 부분으로 얹는 것이다. 그래서 모델도 두 층으로 둔다:

     state.dyeAll          — 바탕(머리 전체). 없으면 null.
     sec.colorOwn          — 이 섹션만의 색. 없으면 null.
     sec.color (파생)      — colorOwn ?? dyeAll.  ← <b>엔진이 읽는 값</b>

   ⚠ 엔진은 한 줄도 안 건드린다. sec.color의 뜻("이 섹션을 칠할 색")도 그대로다.
     바뀐 건 그 값을 <b>누가 정하느냐</b>뿐이라, adjFilterSig·colorForSection·
     _adjApplyFilter는 예전 그대로 동작한다(colorOwn은 그쪽에서 안 읽는다).
   ⚠ 밖에서 sec.color를 직접 쓰는 자리가 아직 있다(applyStyleSpec의 sp.color).
     그래서 패널을 그릴 때마다 gyAdoptDyeModel()로 <b>다시 읽어들인다</b> —
     플래그와 실제가 갈라지던 그 사고를 여기 한 곳에서 막는다.
   되돌리기: 이 구역과 gyBuildColorBody만 9/3판으로 되돌리면 된다.
   ══════════════════════════════════════════════════════════════════ */

/* 두 층 → sec.color(파생)를 다시 계산한다. 색을 바꾸는 모든 길이 여기를 지난다. */
function gyResolveDye(){
  for(const id of SECTION_ORDER){
    const s = state.sections[id];
    if(!s) continue;
    s.color = s.colorOwn || state.dyeAll || null;
  }
}
/* 밖에서 sec.color가 바뀌었으면(스타일 스펙 등) 두 층으로 다시 읽어들인다.
   판정은 <b>파생값과 실제가 같은가</b> 하나뿐이다 — 같으면 우리가 쓴 것이므로
   그대로 두고, 다르면 지금 화면에 걸린 색이 진실이므로 그쪽을 받아들인다.
   여섯이 모두 같은 색이면 바탕(전체)으로, 아니면 각 섹션만의 색으로 본다. */
function gyAdoptDyeModel(){
  if(state.dyeAll === undefined) state.dyeAll = null;
  const eq = (a,b)=> (a||'').toLowerCase() === (b||'').toLowerCase();
  let same = true;
  for(const id of SECTION_ORDER){
    const s = state.sections[id];
    if(!s) continue;
    if(!eq(s.color, s.colorOwn || state.dyeAll || null)){ same = false; break; }
  }
  if(same) return;
  let uni = null, allSame = true;
  for(const id of SECTION_ORDER){
    const v = (state.sections[id] && state.sections[id].color) || null;
    if(!v){ allSame = false; break; }
    if(uni === null) uni = v; else if(!eq(uni, v)){ allSame = false; break; }
  }
  if(allSame && uni){
    state.dyeAll = uni;
    for(const id of SECTION_ORDER) if(state.sections[id]) state.sections[id].colorOwn = null;
  } else {
    state.dyeAll = null;
    for(const id of SECTION_ORDER) if(state.sections[id]) state.sections[id].colorOwn = state.sections[id].color || null;
  }
  gyResolveDye();
}
/* 그 범위에 <b>직접 걸린</b> 색(파생값이 아니다). scope='all' | 섹션id.
   토글 켜짐·스와치 활성·슬라이더 되읽기가 전부 이 함수 하나를 본다 —
   여기가 갈라지면 "켜졌는데 안 걸린 색"이 다시 생긴다. */
function gyDyeColorOf(scope){
  if(scope === 'all') return state.dyeAll || null;
  return (state.sections[scope] && state.sections[scope].colorOwn) || null;
}
/* 하위호환 — 예전 이름으로 부르는 자리가 남아 있어도 같은 뜻이다. */
function gyDyeAllColor(){ return state.dyeAll || null; }
/* 색 하나를 범위에 건다. scope = 'all'(머리 전체 바탕) | 섹션id(그 섹션만의 색).
   live=true면 패널을 안 다시 그린다(드래그 중) — 표시만 gySyncColorUI가 맞춘다.
   반환: 색을 읽었으면 true, 못 읽는 문자열이면 false(호출부가 빨간 테두리). */
function gyApplyDye(scope, css, live){
  const v = gyNormalizeColor(css);
  if(v === null) return false;
  if(scope === 'all'){
    state.dyeAll = v;
    /* ── 전체 염색은 <b>섹션 색까지 밀어버린다</b> (2026-09-04 2차) ──────────
       사용자: "전체 염색으로 다시 칠하면 변경된 섹션까지 다시 한꺼번에
       변하게 해줘. 그 섹션만 안 변하면 사용자가 헷갈려."
       9/4 1차에서는 덮어쓰기 우선순위(colorOwn ?? dyeAll)만 두고 섹션 색을
       살려 뒀다 — 시술 순서로는 그쪽이 맞지만, 화면에서는 <b>전체를 칠했는데
       한 군데만 안 변하는</b> 모양이 된다. 미용사 눈에 그건 규칙이 아니라
       고장이다. "전체"라고 적힌 손잡이는 전체를 해야 한다.
       ⚠ 그래서 발레아쥬는 <b>전체 다음</b>에 넣어야 한다(실제 시술 순서와 같다).
       ⚠ 되돌리기: 이 루프만 지우면 1차 동작(섹션 색이 살아남는다)으로 간다.
          우선순위 식(colorOwn ?? dyeAll)은 그대로 두므로 엔진은 무관하다.
       ☐ 다음에 볼 것: 전체를 칠할 때 지워지는 섹션 색이 있으면 되돌리기
          한 번(토스트의 "실행취소")을 주는 게 맞다. 지금은 지우고 끝이라,
          공들여 넣은 발레아쥬를 실수로 날리면 되찾을 길이 없다. */
    for(const id of SECTION_ORDER) if(state.sections[id]) state.sections[id].colorOwn = null;
  } else if(state.sections[scope]){
    state.sections[scope].colorOwn = v;
  } else return false;
  gyResolveDye();
  state.globalColor = v;              // 다음에 토글을 켤 때 기본으로 뜰 색
  if(live) gySyncColorUI(); else buildGyControls();
  drawAdjustPreview();
  return true;
}
/* 범위의 색을 <b>끈다</b>. 전체를 끄면 섹션 색(발레아쥬)은 <b>남는다</b> —
   바탕을 지우는 것과 부분 염색을 지우는 것은 다른 일이다. */
function gyClearDye(scope){
  if(scope === 'all') state.dyeAll = null;
  else if(state.sections[scope]) state.sections[scope].colorOwn = null;
  gyResolveDye();
  buildGyControls();
  drawAdjustPreview();
}
/* 드래그 조합기의 세 축. 범위를 여기 <b>한 곳</b>에만 적는다 — 슬라이더·눈금·
   되읽기가 전부 이 표를 본다.
   ⚠ 채도 상한 0.37은 지어낸 값이 아니다: OKLCH에서 sRGB로 낼 수 있는 채도의
     최대가 밝은 자홍 근처에서 0.32 언저리다. 조금 넘겨 두는 이유는 <b>모니터가
     못 내는 구간을 손잡이에 보여 주기</b> 위해서다(gyFromOklch의 clipped) —
     끝까지 밀면 "화면 밖"이라고 뜨는 게 맞고, 잘라 두면 그 사실을 아예 못 본다. */
const GY_OKLCH_AXES = [
  { key:'L', label:'밝기',  hint:'레벨 — 뿌리 어두움과 겨루는 축', min:0, max:100, step:0.5,
    left:'검정', right:'백금', get:o=>+(o.L * 100).toFixed(1) },
  { key:'C', label:'채도',  hint:'0=무채색(애쉬) · 높을수록 원색', min:0, max:0.37, step:0.005,
    left:'애쉬', right:'원색', get:o=>+o.C.toFixed(3) },
  { key:'h', label:'색상',  hint:'0°빨강 · 90°노랑 · 150°초록 · 250°파랑', min:0, max:360, step:1,
    left:'0°', right:'360°', get:o=>Math.round(o.h) },
];
/* 지금 이 범위의 슬라이더 세 개가 가리키는 색을 읽어 건다.
   슬라이더에서 직접 읽는 이유 — 색을 hex로 접었다가 되읽으면 8비트 양자화로
   C·h가 조금씩 흔들려서, 드래그 중에 <b>손대지 않은 축이 혼자 움직인다</b>. */
function gyComposeDye(scope, commit){
  const wrap = document.getElementById('gyControls');
  if(!wrap) return;
  const v = {};
  for(const ax of GY_OKLCH_AXES){
    const el = wrap.querySelector('input[data-dye-axis="' + ax.key + '"][data-dye-scope="' + scope + '"]');
    if(!el) return;
    v[ax.key] = parseFloat(el.value);
  }
  const r = gyFromOklch(v.L / 100, v.C, v.h);
  gyApplyDye(scope, r.hex, !commit);
}
/* 색 넘버를 클립보드로. 현장에서 이 화면을 보고 <b>옮겨 적는</b> 것이 실제
   쓰임이라, hex와 oklch 좌표를 같이 준다.
   ⚠ 실패해도 조용히 넘긴다(권한 없는 브라우저·http). 화면에는 이미 떠 있으니
     복사가 안 돼도 손으로 적으면 된다 — 색 하나 때문에 예외를 던지지 않는다. */
function gyCopyColorNumber(scope){
  const cur = gyDyeColorOf(scope);
  const n = cur && gyColorNumbers(cur);
  if(!n) return;
  const s = n.hex + '  ' + n.oklch;
  try{
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(s).then(()=> showToast('색 넘버 복사됨 · ' + n.hex), ()=>{});
      return;
    }
  }catch(e){}
  showToast('색 넘버 · ' + n.hex);
}
/* 패널을 <b>다시 그리지 않고</b> 색 표시만 맞춘다(드래그용).
   data-dye-scope가 붙은 것만 본다 — 다른 손잡이는 건드리지 않는다.
   ⚠ 지금 포커스가 있는 입력은 값을 덮지 않는다(잡고 있는 슬라이더·타이핑 중인 칸).
     특히 슬라이더는 이걸 안 지키면 hex 양자화만큼 손 밑에서 값이 튄다. */
function gySyncColorUI(){
  const wrap = document.getElementById('gyControls');
  if(!wrap) return;
  wrap.querySelectorAll('[data-dye-scope]').forEach(el=>{
    const scope = el.getAttribute('data-dye-scope');
    const cur = gyDyeColorOf(scope);
    if(el.classList.contains('gy-sw')){
      const c = el.getAttribute('data-dye-color') || '';
      el.classList.toggle('active', !!cur && cur.toLowerCase() === c.toLowerCase());
    } else if(el.hasAttribute('data-dye-readout')){
      gyRenderColorNumber(el, scope, cur);
    } else if(el.hasAttribute('data-dye-axisval')){
      const ax = GY_OKLCH_AXES.find(a=>a.key === el.getAttribute('data-dye-axisval'));
      const sl = wrap.querySelector('input[data-dye-axis="' + (ax && ax.key) + '"][data-dye-scope="' + scope + '"]');
      if(ax && sl) el.textContent = (ax.key === 'L') ? (+sl.value).toFixed(1) + '%'
                                  : (ax.key === 'h') ? sl.value + '°' : (+sl.value).toFixed(3);
    } else if(document.activeElement !== el){
      if(el.hasAttribute('data-dye-axis')){
        const ax = GY_OKLCH_AXES.find(a=>a.key === el.getAttribute('data-dye-axis'));
        const o = cur && gyToOklch(cur);
        if(ax && o) el.value = ax.get(o);
      } else if(el.classList.contains('gy-color-text')) el.value = cur || '';
      else if(cur) el.value = cur;
    }
  });
}
/* 색 넘버 줄 — 칩 + hex + oklch + <b>화면 밖</b> 표시.
   "화면 밖"이 뜨는 조건은 gyFromOklch의 왕복 판정이다. 이게 사용자가 말한
   "모니터와 실제 차이"의 화면 안쪽 절반이다 — 모니터가 못 내는 색을 고르면
   <b>화면은 더 이상 안 변하는데 번호는 계속 올라간다</b>. 그 사실을 적어 준다. */
function gyRenderColorNumber(el, scope, cur){
  if(!cur){ el.innerHTML = ''; el.style.display = 'none'; return; }
  el.style.display = '';
  const n = gyColorNumbers(cur);
  if(!n){ el.innerHTML = ''; return; }
  /* 슬라이더가 요청한 좌표와 화면이 실제로 낸 좌표를 견준다. 슬라이더가 아직
     없으면(스와치·텍스트로 들어온 색) 견줄 요청이 없으므로 경고도 없다. */
  let clipped = false;
  const wrap = document.getElementById('gyControls');
  const sl = wrap && wrap.querySelector('input[data-dye-axis="C"][data-dye-scope="' + scope + '"]');
  if(sl){
    const lEl = wrap.querySelector('input[data-dye-axis="L"][data-dye-scope="' + scope + '"]');
    const hEl = wrap.querySelector('input[data-dye-axis="h"][data-dye-scope="' + scope + '"]');
    if(lEl && hEl) clipped = gyFromOklch(parseFloat(lEl.value) / 100, parseFloat(sl.value), parseFloat(hEl.value)).clipped;
  }
  el.innerHTML = '<span class="gy-color-chip" style="background:' + n.hex + '"></span>'
    + '<span class="gy-color-hex">' + n.hex + '</span>'
    + '<span class="gy-color-oklch">' + n.oklch + '</span>'
    + (clipped ? '<span class="gy-color-gamut">화면 밖</span>' : '');
}
// 하위호환 — 예전 이름으로 부르는 자리가 남아 있어도 같은 일을 한다.
function onGyColorToggle(secId){
  if(gyDyeColorOf(secId)) gyClearDye(secId);
  else gyApplyDye(secId, state.globalColor || '#6B4A2E', false);
}
function onGyColorPick(secId, hex){ gyApplyDye(secId, hex, false); }

// 공정그룹 접힘 토글
function toggleGyGroup(gid){
  state.panelCollapsed[gid] = !state.panelCollapsed[gid];
  buildGyControls();
}

// ── 페이드/테이퍼(클리퍼) — gyeol 구성에는 없지만 실 시술 기법이라 커트 계열
//    섹션(템플·사이드·후두부·네이프)에서 선택적 그룹으로 유지. state.fade는 전역. ──
/* ── (2026-09-01) 이름이 <b>뜻과 갈라졌다</b> ──────────────────────────────
   원래 이 목록은 두 가지를 동시에 했다: ⓐ 페이드 슬라이더를 어느 섹션에 띄울지
   ⓑ 스펙 역산 때 "가위 목표를 디스커넥션 라인 <b>위</b>로 제한할" 섹션이 어디인지.
   ⓐ는 이번에 없앴다(스포츠머리 — fadeCutLen 주석 참고). 남은 건 ⓑ뿐이라
   이름도 ⓑ로 바꾼다. 한 이름이 두 뜻을 가지면 한쪽을 고칠 때 다른 쪽이
   조용히 따라 움직인다 — 이 파일이 반복해서 당한 자리다.
   ⚠ ⓑ까지 전 섹션으로 열지 <b>않는다</b>. 폼파두르 스펙이 지금 이 네 섹션
     기준으로 풀려 있고(crown·front는 lenCm을 전체 풀로 푼다), 여기를 같이
     열면 검증된 프리셋의 역산 결과가 바뀐다. 열려면 스펙을 다시 재고 나서다. */
const FADE_SOLVE_ABOVE_LINE = { temple:1, side:1, occipital:1, nape:1 };
function onGyFadeToggle(){
  state.fade.enabled = !state.fade.enabled;
  buildGyControls();
  drawAdjustPreview();
}
function onGyFadeSlider(param, val){
  const num = parseInt(val, 10);
  const prev = state.fade[param];
  state.fade[param] = num;
  const el = document.getElementById('gyfade-'+param);
  if(el) el.textContent = num + (param==='guard' ? '' : '%');
  /* disc가 0을 <b>넘나들 때만</b> 패널을 다시 그린다 — 높이·블렌딩의 흐림 표시가
     따라와야 하기 때문. 드래그 중 매 틱마다 다시 그리면 슬라이더 잡은 손가락이
     떨어지므로(이 파일이 겪은 그 문제) 경계를 지날 때 한 번만 한다. */
  if(param === 'disc' && (prev > 0) !== (num > 0)) buildGyControls();
  drawAdjustPreview();
}

// 스타일링(마무리) 슬라이더
function onGyStyling(key, val){
  const num = parseInt(val, 10);
  /* 가르마(위치·세기)는 뷰별 값이 아니다 — PART_VIEW_LOCK 배너 참고.
     나머지 키는 예전 그대로 state.styling(=현재 뷰) 한 벌에만 쓴다. */
  if(PART_VIEW_LOCK.on && PART_VIEW_LOCK.keys[key]){
    bindStylingToCurrentView();                 // 그릇 보장(뷰 전환 직후 대비)
    for(const a of ANGLES){
      if(!state.stylingByView[a]) state.stylingByView[a] = neutralStyling();
      state.stylingByView[a][key] = num;
    }
  } else {
    state.styling[key] = num;
  }
  const el = document.getElementById(`gyst-${key}`);
  if(el){
    const pm = GYEOL_STYLING_PARAMS.find(p=>p.key===key);
    el.textContent = (num>0 && pm && pm.min<0 ? '+' : '') + num;
  }
  drawAdjustPreview();
}

// ── gyeol 컨트롤 하위 빌더들 ──
// buildGyControls가 너무 길어(스타일링탭+커트/펌/컬러 그룹+페이드+안내를 한 함수에서 다 처리)
// 재사용/가독성이 나빠, 각 조각을 "요소를 반환하는" 순수 빌더로 분리. 반환 요소를
// buildGyControls가 같은 순서로 append하므로 생성되는 DOM은 이전과 완전히 동일하다.

/* 이 파라미터를 이 섹션에 띄워도 되나 — onlySec이 있으면 그 섹션에서만.
   (2026-08-26) 읽는 쪽이 섹션을 가리는 파라미터를 전 섹션에 띄우면
   <b>만져도 아무 일이 안 나는 손잡이</b>가 생긴다. 목록 한 곳에서 거른다.
   (2026-09-01) 배열도 받는다 — line은 front·nape 둘이다(cutRatioForStrand ③-b). */
function gyParamAppliesTo(pm, secId){
  if(!pm.onlySec) return true;
  return Array.isArray(pm.onlySec) ? pm.onlySec.indexOf(secId) >= 0 : pm.onlySec === secId;
}
// 단일 슬라이더 컨트롤(.gy-ctrl) — 커트/펌 파라미터 공용.
function gyBuildRangeCtrl(secId, pm, hint){
  const sec = state.sections[secId];
  const cur = (typeof sec[pm.key] === 'number') ? sec[pm.key] : 0;
  const c = document.createElement('div'); c.className = 'gy-ctrl';
  // input에 id 부여(gyrange-…): 연동(propagateSectionChange)이 다른 섹션 값을
  // 바꿨을 때 syncGyParamUI가 슬라이더 위치까지 동기화할 수 있게 함.
  c.innerHTML = `<div class="gy-ctrl-top">
            <span><span class="gy-ctrl-label">${pm.label}</span><span class="gy-ctrl-hint">${hint}</span></span>
            <span class="gy-ctrl-val" id="gyval-${secId}-${pm.key}">${Math.round(cur)}${pm.unit}</span>
          </div>
          <input type="range" min="${pm.min}" max="${pm.max}" value="${cur}" id="gyrange-${secId}-${pm.key}"
            oninput="onGySlider('${secId}','${pm.key}',this.value)">`;
  return c;
}

// 커트 방식(기법) 선택 드롭다운 — 커트 그룹 맨 위.
function gyBuildTechniqueSelect(secId, sec){
  if(!sec.technique || !TECHNIQUES[sec.technique]) sec.technique = 'uniform';
  const tw = document.createElement('div'); tw.className = 'gy-ctrl';
  let opts = '';
  Object.keys(TECHNIQUES).forEach(k=>{
    opts += `<option value="${k}" ${sec.technique===k?'selected':''}>${TECHNIQUES[k].label}</option>`;
  });
  tw.innerHTML = `<div class="gy-ctrl-top">
            <span><span class="gy-ctrl-label">커트 방식</span><span class="gy-ctrl-hint">${TECHNIQUES[sec.technique].hint}</span></span>
          </div>
          <select class="gy-select">${opts}</select>`;
  const selEl = tw.querySelector('select');
  selEl.onchange = ()=> onGyTechnique(secId, selEl.value);
  return tw;
}

/* 색을 고르는 한 벌 — 스와치 + <b>드래그 조합기</b> + 아무 CSS 색 문자열.
   범위(scope)만 다르고 생김새·동작은 같아서 <b>한 함수</b>로 만든다. 두 벌로
   적으면 한쪽만 고쳐질 자리다(작업원칙 3).

   ── (2026-09-03 2차) OS 피커를 <b>드래그 조합기로 바꿨다</b> ────────────
   사용자: "색을 <b>드래그 조합으로 생성</b>해서 만드는 입력도 있어야 될 거
   같은데… 모니터와 실제 차이를 감안해서, 드래그 조합으로 색을 생성하면
   <b>해당 색 넘버가 뜨도록</b>."
   <input type=color>는 <b>모달</b>이다 — 열면 화면(머리)이 가려지고, 닫아야
   결과가 보인다. 염색은 "돌리면서 머리를 본다"가 전부인 조작이라 이 파일의
   다른 손잡이(전부 <input type=range>)와 같은 자리에 있어야 한다.
   그리고 피커는 <b>번호를 안 준다</b> — 미용사가 옮겨 적을 수 있어야 한다.
   ⚠ 둘 다 두지 않는다. 같은 일을 하는 손잡이가 둘이면 어느 쪽이 진짜인지
     모르게 된다(작업원칙 3). 되살리려면 이 함수에 <input type=color> 한 줄만
     다시 붙이면 된다 — 엔진 쪽은 손댈 것이 없다.
   ⚠ 축은 <b>OKLCH</b>다(gyFromOklch 주석). HSL로 만들면 채도 손잡이가 눈과
     안 맞는다.
   ⚠ 텍스트 칸은 남긴다 — 조합기는 hex로 접히지만, 현장에서 받아 적어 둔
     색을 <b>그대로 붙여넣는</b> 입구는 따로 있어야 한다(hsl·oklch·색이름). */
function gyColorEditor(scope, cur, title){
  const box = document.createElement('div');
  box.style.cssText = 'display:flex;flex-direction:column;gap:9px;'
    + 'border-left:2px solid var(--line);padding-left:9px;margin-left:2px;';

  /* 어느 범위의 조합기인지 <b>머리에 적는다</b>. 전체와 섹션을 같이 켜면 똑같이
     생긴 조합기가 둘이 되는데, 이름표가 없어서 아래쪽(섹션)을 잡고 돌리고는
     "전체 염색이 안 된다"고 보였다 — 이번 수정의 나머지 절반이다. */
  if(title){
    const h = document.createElement('div');
    h.className = 'gy-ctrl-label';
    h.style.cssText = 'font-size:11px;opacity:.85;';
    h.textContent = title;
    box.appendChild(h);
  }

  // ⓐ 스와치 — 자주 쓰는 것을 빨리 집는 용도지 <b>가능한 색의 목록이 아니다</b>.
  const sw = document.createElement('div'); sw.className = 'gy-swatches';
  GYEOL_COLORS.forEach(c=>{
    const s = document.createElement('div');
    s.className = 'gy-sw' + ((cur && cur.toLowerCase() === c.toLowerCase()) ? ' active' : '');
    s.style.background = c;
    s.setAttribute('data-dye-scope', scope);
    s.setAttribute('data-dye-color', c);
    s.onclick = ()=> gyApplyDye(scope, c, false);
    sw.appendChild(s);
  });
  box.appendChild(sw);

  // ⓑ 색 넘버 — 칩 + hex + oklch 좌표. 탭하면 복사된다(현장에서 옮겨 적는다).
  const out = document.createElement('div');
  out.className = 'gy-color-out';
  out.setAttribute('data-dye-scope', scope);
  out.setAttribute('data-dye-readout', '1');
  out.title = '탭하면 색 넘버가 복사됩니다';
  out.onclick = ()=> gyCopyColorNumber(scope);
  box.appendChild(out);

  // ⓒ 드래그 조합기 — 밝기·채도·색상 세 축(OKLCH)
  const base = gyToOklch(cur || state.globalColor || '#6B4A2E')
               || { L:0.45, C:0.05, h:60 };
  GY_OKLCH_AXES.forEach(ax=>{
    const c = document.createElement('div'); c.className = 'gy-ctrl';
    const v = ax.get(base);
    c.innerHTML = `<div class="gy-ctrl-top">
        <span><span class="gy-ctrl-label">${ax.label}</span><span class="gy-ctrl-hint">${ax.hint}</span></span>
        <span class="gy-ctrl-val" data-dye-scope="${scope}" data-dye-axisval="${ax.key}"></span>
      </div>
      <input type="range" min="${ax.min}" max="${ax.max}" step="${ax.step}" value="${v}"
        data-dye-scope="${scope}" data-dye-axis="${ax.key}">
      <div class="gy-ends"><span>${ax.left}</span><span>${ax.right}</span></div>`;
    const inp = c.querySelector('input');
    /* 드래그 중(input)에는 live=true — 패널을 다시 그리면 잡고 있는 슬라이더가
       DOM에서 교체되어 손에서 놓친다. 색은 <b>필터 단</b>이라 점을 하나도 안
       만들어 드래그마다 그려도 싸다(2026-08-23 3차의 2단 분리). */
    inp.oninput  = ()=> gyComposeDye(scope, false);
    inp.onchange = ()=> gyComposeDye(scope, true);
    box.appendChild(c);
  });

  // ⓓ 아무 CSS 색 문자열 — 색이름·rgb()·hsl()·oklch()까지 그대로 받는다.
  const trow = document.createElement('div'); trow.className = 'gy-toggle-row';
  const txt = document.createElement('input');
  txt.type = 'text'; txt.className = 'gy-color-text';
  txt.value = cur || '';
  txt.placeholder = '#FF2D95 · hotpink · hsl(320 90% 55%) · oklch(.7 .2 20)';
  txt.spellcheck = false; txt.autocomplete = 'off';
  txt.setAttribute('autocapitalize', 'off');
  txt.setAttribute('data-dye-scope', scope);
  /* 타이핑 중에는 <b>읽히는지만</b> 표시한다(빨간 테두리). 글자마다 색을 걸면
     "#f"가 잠깐 걸리고 화면이 번쩍인다 — 확정은 change/Enter다. */
  txt.oninput = ()=>{
    const s = txt.value.trim();
    txt.classList.toggle('bad', s !== '' && gyNormalizeColor(s) === null);
  };
  txt.onchange = ()=>{
    const s = txt.value.trim();
    if(s === ''){ gyClearDye(scope); return; }      // 비우면 원래 사진 색으로
    if(!gyApplyDye(scope, s, false)) txt.classList.add('bad');
  };
  txt.onkeydown = (e)=>{ if(e.key === 'Enter'){ e.preventDefault(); txt.blur(); } };
  trow.appendChild(txt);
  box.appendChild(trow);

  /* ⚠ 여기서 gySyncColorUI()를 부르면 <b>아무 일도 안 일어난다</b> — 이 box는
     아직 #gyControls 밖이고, 그 함수는 #gyControls 안만 훑는다. 그래서 색 넘버
     줄과 축 눈금이 첫 표시에서 늘 비어 있었다(드래그를 한 번 해야 나타났다).
     첫 표시는 <b>붙인 뒤</b> buildGyControls 끝에서 한 번 한다. */
  return box;
}

/* 컬러 그룹 본문 — ① 머리 전체 염색 ② 이 섹션만(발레아쥬).
   순서가 이것인 이유: 기본 염색은 <b>전체</b>이고 발레아쥬가 예외다.
   예전에는 예외만 화면에 있어서, 전체를 칠하려면 섹션 여섯 개를 돌아야 했다. */
function gyBuildColorBody(body, secId, sec){
  gyAdoptDyeModel();          // 밖에서 색이 바뀌었으면(스타일 스펙 등) 먼저 읽어들인다

  // ── ① 머리 전체(바탕) ────────────────────────────────────────────
  const allCur = gyDyeColorOf('all');
  const tAll = document.createElement('div'); tAll.className = 'gy-toggle-row';
  tAll.innerHTML = `<div class="gy-toggle ${allCur?'on':''}"></div>
        <span class="gy-ctrl-hint">머리 전체를 한 색으로 (기본 염색)</span>`;
  tAll.querySelector('.gy-toggle').onclick = ()=>
    allCur ? gyClearDye('all') : gyApplyDye('all', state.globalColor || '#6B4A2E', false);
  body.appendChild(tAll);
  if(allCur) body.appendChild(gyColorEditor('all', allCur, '머리 전체 색'));

  body.appendChild(Object.assign(document.createElement('div'), { className:'gy-color-sep' }));

  // ── ② 이 섹션만 ────────────────────────────────────────────
  /* 이 토글은 <b>이 섹션만의 색</b>만 본다(colorOwn). 전체를 켜서 sec.color가
     찬 것과는 무관하다 — 9/3판이 sec.color를 봐서 둘이 같이 켜졌다. */
  const own = gyDyeColorOf(secId);
  const secName = (SECTIONS[secId] && SECTIONS[secId].label) || secId;
  const t = document.createElement('div'); t.className = 'gy-toggle-row';
  t.innerHTML = `<div class="gy-toggle ${own?'on':''}"></div>
        <span class="gy-ctrl-hint">${secName}만 다른 색 적용 (발레아쥬 등)</span>`;
  t.querySelector('.gy-toggle').onclick = ()=> own ? gyClearDye(secId) : gyApplyDye(secId, state.globalColor || '#6B4A2E', false);
  body.appendChild(t);
  if(own) body.appendChild(gyColorEditor(secId, own, secName + '만의 색'));

  /* 지금 이 섹션에 <b>실제로</b> 걸린 색을 한 줄로 적는다. 조합기가 둘이면
     "내가 지금 무엇을 돌리고 있나"가 흐려지는데, 그게 이번 버그의 절반이었다.
     ⚠ "덮어쓴다"고 적는다 — 색은 <b>섞이지 않는다</b>. 섹션 색이 있으면 그 색
       하나로 칠하고, 없으면 전체 색으로 칠한다(colorOwn ?? dyeAll). */
  if(allCur || own){
    const note = document.createElement('div');
    note.className = 'gy-ctrl-hint';
    note.style.cssText = 'display:flex;align-items:center;gap:6px;padding-top:2px;';
    note.innerHTML = `<span class="gy-color-chip" style="background:${sec.color}"></span>`
      + (own ? `${secName}은 이 색으로 칠해집니다`
                 + (allCur ? ' — 전체 색을 다시 칠하면 여기도 같이 바뀝니다' : '')
             : `${secName}에는 머리 전체 색이 칠해집니다`);
    body.appendChild(note);
  }
}

// 공정 그룹(커트/펌/컬러) 하나를 통째로 만든다(헤드 + 본문).
function gyBuildProcessGroup(grp, secId, sec){
  const collapsed = !!state.panelCollapsed[grp.id];
  const g = document.createElement('div');
  g.className = 'gy-group' + (grp.optional ? ' optional' : '') + (collapsed ? ' collapsed' : '');

  const head = document.createElement('div');
  head.className = 'gy-group-head';
  head.innerHTML = `<span class="gy-dot" style="background:${grp.color}"></span>
      <span class="gy-group-title" style="color:${grp.color}">${grp.title}</span>
      <span class="gy-group-sub">${grp.sub}</span>
      <span class="gy-chevron">▼</span>`;
  head.onclick = ()=> toggleGyGroup(grp.id);
  g.appendChild(head);

  const body = document.createElement('div');
  body.className = 'gy-group-body';

  if(grp.id === 'color'){
    gyBuildColorBody(body, secId, sec);
  } else {
    if(grp.id === 'cut') body.appendChild(gyBuildTechniqueSelect(secId, sec));
    grp.params.forEach(pm=>{
      if(!gyParamAppliesTo(pm, secId)) return;   // 읽는 쪽이 안 보는 섹션엔 안 띄운다
      const hint = (grp.id==='cut' && pm.key==='elevation') ? '시술각(기법 강도 스케일)' : pm.hint;
      body.appendChild(gyBuildRangeCtrl(secId, pm, hint));
    });
    /* ── (2026-09-01) 페이드는 <b>커트 안</b>이다 ────────────────────────────
       사용자 지시: "그것도 <b>커트 섹션에</b> 슬라이드로 만들어."
       여태 커트 그룹의 <b>형제</b>로 붙어 있었다(buildGyControls가 따로 append).
       그런데 클리퍼는 별개 공정이 아니라 <b>커트의 일부</b>다 — 가위로 형태를
       잡고 같은 커트 안에서 기계가 들어간다(applyStyleSpec이 "가위 → 클리퍼"
       순서를 지키는 것과 같은 사실). 커트 그룹을 접으면 페이드도 같이 접히는
       게 맞고, 지금은 커트를 접어도 페이드만 남아 떠 있었다.
       ⓘ (2026-09-01 2차) <b>모든 섹션</b>에 띄운다. 예전엔 하단 네 섹션만
         띄우면서 "크라운·프론트는 fadeCutLen이 반려하니 무반응 손잡이가 된다"고
         적었는데, 사용자가 그 전제를 바로잡았다 — <b>스포츠머리</b>가 있으니
         정수리도 클리퍼 구역이다. 그래서 반려하던 줄을 엔진에서 없앴고
         (fadeCutLen 주석), 이제 어느 섹션에서 켜도 실제로 먹는다.
         state.fade는 전역 한 벌이라 어느 탭에서 켜든 같은 값이다(그게 맞다 —
         클리퍼 가드는 머리 전체에 하나다). */
    if(grp.id === 'cut') body.appendChild(gyBuildFadeGroup());
  }
  g.appendChild(body);
  return g;
}

// 페이드/테이퍼(클리퍼) 그룹 — 커트 계열 섹션에서만 호출. 전역 state.fade 조작.
function gyBuildFadeGroup(){
  const on = !!state.fade.enabled;
  const fg = document.createElement('div');
  fg.className = 'gy-group optional';
  const fh = document.createElement('div');
  fh.className = 'gy-group-head static';
  fh.innerHTML = `<span class="gy-dot" style="background:var(--gy-cut)"></span>
      <span class="gy-group-title" style="color:var(--gy-cut)">페이드</span>
      <span class="gy-group-sub">클리퍼 · 하단 그라데이션</span>`;
  fg.appendChild(fh);
  const fb = document.createElement('div');
  fb.className = 'gy-group-body';
  const tr = document.createElement('div'); tr.className = 'gy-toggle-row';
  tr.innerHTML = `<div class="gy-toggle ${on?'on':''}"></div>
      <span class="gy-ctrl-hint">템플·사이드·후두부·네이프 하단(구레나룻·목선)에 적용</span>`;
  tr.querySelector('.gy-toggle').onclick = onGyFadeToggle;
  fb.appendChild(tr);
  if(on){
    /* ── (2026-09-01) 디스커넥션이 <b>켜져 있으면</b> 두 손잡이는 안 쓰인다 ────
       fadeCutLen을 읽어 보면 disc > 0일 때 꼭대기는 라인이고 bw = DISC3D.minBand라
       height·blendWidth가 <b>계산에 안 들어간다</b>(discLineV 배너에 그렇게 적혀
       있다). 그런데 슬라이더는 멀쩡히 움직였다 — 이 파일이 반복해서 당한
       "만져도 아무 일이 안 나는 손잡이"다. 지우지는 않는다(disc를 0으로 되돌리면
       다시 쓰이는 폴백값이라 값이 보여야 한다). 흐리게 하고 <b>왜</b>를 적는다. */
    const discOn = (state.fade.disc > 0);
    const fadeParams = [
      {key:'guard', label:'가드 번호', hint:'0=스킨 · 8=1인치', min:0, max:8},
      /* ── 디스커넥션을 손잡이로 (2026-09-01) ────────────────────────────────
         사용자: "페이드 같은 경우는 일단 조작슬라이드를 만들지 말라고 했었는데,
         그것도 커트 섹션에 슬라이드로 만들어."
         2026-08-26에 이 값을 넣으면서 스키마 주석에 "슬라이더를 안 만든다 —
         미용사가 만질 값이 아니다"라고 적었다. 그건 taper에 대해 같은 말을
         적었다가 <b>변명이었다</b>고 스스로 정정한 것과 정확히 같은 자리다.
         디스커넥션은 "윗머리와 사이드를 <b>끊을지 이을지</b>"이고, 그건 미용사가
         고르는 시술이다(끊으면 폼파두르·언더컷, 이으면 테이퍼드 컷).
         그리고 이 손잡이가 없으면 <b>폼파두르를 손으로 만들 수 없다</b> —
         taper_fade_pomp가 disc 21을 걸고, 그게 이 컷의 절반이다.
         0 = 안 씀(높이·블렌딩이 페이드 꼭대기를 정한다 · 예전 동작)
         21 = 레퍼런스 실측(측면 뷰) · 값이 클수록 라인이 <b>아래로</b> 내려간다
         ⚠ 두상높이 정규화다(0=정수리, 100=두상 바닥). 섹션 안 %가 아니라
           <b>손님이 누구든 같은 자리</b>를 가리킨다 — DISC3D 배너의 요지. */
      {key:'disc', label:'디스커넥션', hint:'0=안 씀 · 윗머리와 끊기는 라인(두상높이)', min:0, max:100},
      {key:'height', label:'페이드 높이', hint: discOn ? '디스커넥션이 켜져 있어 안 쓰임' : '로우~하이', min:0, max:100, dim:discOn},
      {key:'blendWidth', label:'블렌딩 폭', hint: discOn ? '디스커넥션이 켜져 있어 안 쓰임' : '테이퍼 레버', min:0, max:100, dim:discOn},
      /* ── 테이퍼를 손잡이로 (2026-08-26) ────────────────────────────────
         사용자: "블록이랑 테이퍼 중에 골라야 되는 건데 적용 안 했다는 거야?"
         적용은 했다(프리셋 taper_fade_pomp가 80을 건다). 안 한 것은 <b>미용사가
         고를 방법</b>이었고, 그걸 "프리셋에 딸린 성질"이라고 적은 건 근거가 아니라
         변명이었다. 블록 페이드와 테이퍼 페이드는 <b>미용사가 고르는 시술</b>이다.
         0 = 블록(가드 하나로 균일 — 2026-08-26 이전의 동작)
         100 = 완전 테이퍼(맨 아래가 스킨까지 닫히고 위로 올라가며 열린다) */
      {key:'taper', label:'테이퍼', hint:'0=블록(균일) · 100=아래가 스킨까지', min:0, max:100},
    ];
    fadeParams.forEach(fp=>{
      const cur = state.fade[fp.key];
      const unit = fp.key==='guard' ? '' : '%';
      const c = document.createElement('div'); c.className = 'gy-ctrl';
      if(fp.dim) c.style.opacity = '.45';   // 값은 보이되 지금은 안 쓰인다는 표시(위 주석)
      c.innerHTML = `<div class="gy-ctrl-top">
            <span><span class="gy-ctrl-label">${fp.label}</span><span class="gy-ctrl-hint">${fp.hint}</span></span>
            <span class="gy-ctrl-val" id="gyfade-${fp.key}">${cur}${unit}</span>
          </div>
          <input type="range" min="${fp.min}" max="${fp.max}" value="${cur}"
            oninput="onGyFadeSlider('${fp.key}',this.value)">`;
      fb.appendChild(c);
    });
  }
  fg.appendChild(fb);
  return fg;
}

/* ══════════════════════════════════════════════════════════════════
   섹션 레시피 — <b>슬라이더 옆에 목표 숫자를 적는다</b> (2026-09-01)
   ─────────────────────────────────────────────────────────────────
   사용자 지시: "슬라이드 직접 조작해서 해당 모델들 만들 수 있도록 <b>슬라이드
   수치 확인하고 조정해줘</b>."

   여태 STYLE_SPECS는 <b>버튼이 읽는 값</b>이었다. 미용사가 손으로 같은 머리를
   만들려면 시술각 85·질감 45·숱 88 같은 숫자를 어디서도 볼 수 없었다 —
   스펙은 파일 안에만 있고, 화면에는 "레이어드 보브" 버튼 하나뿐이었다.
   그래서 스펙을 <b>지금 만지고 있는 섹션의 슬라이더 옆</b>으로 끌어온다.

   ── 길이만 성격이 다르다 ─────────────────────────────────────────
   나머지는 스펙에 적힌 숫자가 곧 슬라이더 숫자다(시술각·질감·숱·컬·웨이브).
   그런데 <b>길이</b>는 아니다. 스펙이 적는 건 lenCm(절대 cm) 또는 tipAt(끝
   높이)이고, 슬라이더는 <b>손님 원래 길이의 비율</b>이다(sectionLengthRatio).
   같은 62가 머리 긴 손님과 짧은 손님에게 다른 결과가 된다 — 파일 상단이
   "프리셋을 슬라이더 값으로 적으면 안 된다"고 못 박아 둔 그 이유다.
   그래서 여기서 <b>이 손님에 대해</b> 푼다: applyStyleSpec이 쓰는 것과 같은
   solveSectionLengthForCm / solveSectionLengthForTipY를 그대로 부른다.
   두 벌로 적으면 갈라지는 그 자리라, 새 이분탐색을 만들지 않는다.

   ⚠ 이분탐색은 24회 × 표본 160가닥이다. 패널은 섹션을 바꿀 때마다 다시
     그려지므로 <b>캐시한다</b>(키 = 스펙id|섹션|3D모델 세대). 안 하면 진단이
     렌더 비용을 만드는 모양이 되고, 그건 8/22에 걷어낸 것이다.
══════════════════════════════════════════════════════════════════ */
const RECIPE_STYLES = ['layered_bob_hush', 'taper_fade_pomp'];
/* 이 스펙이 이 섹션에서 요구하는 <b>길이 슬라이더 값</b>. 못 풀면 null.
   반환은 {v, unit, target} — unit은 'cm' | 'tip' | 'clipper'. */
function recipeLengthFor(specId, secId){
  const sp = STYLE_SPECS[specId];
  const m = state.hair3Dneutral;
  if(!sp || !m || !m.strands || !m.strands.length) return null;
  const cache = m._recipeCache || (m._recipeCache = {});
  const key = specId + '|' + secId;
  if(key in cache) return cache[key];
  let out = null;
  try{
    const byCm = !!(sp.lenCm && sp.lenCm[secId] != null);
    if(byCm){
      /* applyStyleSpec과 <b>같은 규칙</b>: 디스커넥션이 있는 스펙이면 페이드
         섹션의 가위 목표는 라인 위에만 해당한다(아래는 클리퍼가 정한다). */
      const R = headHeightRef();
      const discY = (R && sp.fade && sp.fade.disc > 0) ? (R.yTop - (sp.fade.disc/100) * R.H) : null;
      const aboveY = (discY != null && FADE_SOLVE_ABOVE_LINE[secId]) ? discY : undefined;
      const v = solveSectionLengthForCm(secId, sp.lenCm[secId], undefined, aboveY);
      out = (v == null)
        ? (aboveY != null ? { v:null, unit:'clipper', target: sp.lenCm[secId] } : null)
        : { v, unit:'cm', target: sp.lenCm[secId] };
    } else if(sp.tipAt && sp.tipAt[secId] != null){
      const R = headHeightRef();
      if(R){
        const v = solveSectionLengthForTipY(secId, R.yTop - sp.tipAt[secId] * R.H);
        if(v != null) out = { v, unit:'tip', target: sp.tipAt[secId] };
      }
    }
  }catch(e){ out = null; }
  return (cache[key] = out);
}
/* 이 스펙의 <b>이 섹션만</b> 지금 상태에 건다. 프리셋 버튼과 달리 다른 섹션·
   스타일링·페이드를 안 건드린다 — 손으로 만드는 도중에 한 구역만 기준을
   맞춰 보고 싶을 때가 실제 시술에서 늘 있다(가이드라인을 다시 잡는 것). */
function applyRecipeSection(specId, secId){
  const sp = STYLE_SPECS[specId];
  if(!sp || !state.sections[secId]) return;
  if(sp.cut && sp.cut[secId]) Object.assign(state.sections[secId], sp.cut[secId]);
  if(sp.perm){ state.sections[secId].curl = sp.perm.curl; state.sections[secId].wave = sp.perm.wave; }
  const L = recipeLengthFor(specId, secId);
  if(L && L.v != null) state.sections[secId].length = L.v;
  buildGyControls();
  updateSectionSummary(secId);
  drawAdjustPreview();
  showToast(sp.name.split('·')[0].trim() + ' · ' + SECTIONS[secId].label + ' 값으로 맞췄어요'
            + (L && L.v != null ? ' (길이 ' + L.v + ')' : ' (길이는 3D 모델 준비 후)'));
}
/* 이 섹션의 스펙 수치표. 접힘 상태는 다른 그룹과 같은 그릇을 쓴다. */
function gyBuildRecipeNote(secId){
  const collapsed = !!state.panelCollapsed.recipe;
  const g = document.createElement('div');
  g.className = 'gy-group optional' + (collapsed ? ' collapsed' : '');
  const head = document.createElement('div');
  head.className = 'gy-group-head';
  head.innerHTML = `<span class="gy-dot" style="background:var(--accent)"></span>
      <span class="gy-group-title" style="color:var(--accent-soft)">스펙 수치</span>
      <span class="gy-group-sub">이 섹션을 손으로 맞출 때의 목표값</span>
      <span class="gy-chevron">▼</span>`;
  head.onclick = ()=> toggleGyGroup('recipe');
  g.appendChild(head);
  const body = document.createElement('div');
  body.className = 'gy-group-body';
  /* 접혀 있으면 <b>본문을 아예 안 만든다</b>. 안 그러면 섹션 탭을 누를 때마다
     보이지도 않는 표를 위해 이분탐색이 두 번 돈다 — 진단이 렌더 비용을 만드는
     그 모양(8/22에 걷어낸 것)이다. 펴는 순간 toggleGyGroup이 다시 그린다. */
  if(collapsed){ g.appendChild(body); return g; }
  RECIPE_STYLES.forEach(sid=>{
    const sp = STYLE_SPECS[sid];
    if(!sp) return;
    const cut = (sp.cut && sp.cut[secId]) || null;
    const row = document.createElement('div');
    row.className = 'gy-ctrl';
    const bits = [];
    if(cut){
      if(cut.technique && TECHNIQUES[cut.technique]) bits.push('방식 ' + TECHNIQUES[cut.technique].label);
      const L = recipeLengthFor(sid, secId);
      /* 길이는 <b>목표와 슬라이더 값을 같이</b> 적는다. 슬라이더 숫자만 적으면
         다음 손님에게 그대로 옮겨 적고 싶어지는데, 그게 금지된 그 짓이다. */
      if(!L)                       bits.push('길이 —(3D 준비 후)');
      else if(L.unit === 'clipper')bits.push('길이 (클리퍼 구역)');
      else if(L.unit === 'cm')     bits.push('<b>길이 ' + L.v + '</b>(목표 ' + L.target + 'cm)');
      else                         bits.push('<b>길이 ' + L.v + '</b>(끝높이 ' + L.target + ')');
      if(cut.elevation != null) bits.push('시술각 ' + cut.elevation + '°');
      if(cut.texture   != null) bits.push('질감 ' + cut.texture + '%');
      if(cut.density   != null) bits.push('숱 ' + cut.density + '%');
      if(cut.overdirection != null && secId === 'temple') bits.push('오버디렉션 ' + cut.overdirection + '%');
      if(cut.line != null && (secId === 'front' || secId === 'nape'))
        bits.push('커팅라인 ' + cut.line + (cut.line === 50 ? '(라운드)' : cut.line < 50 ? '(스퀘어쪽)' : '(테이퍼쪽)'));
      if(sp.perm) bits.push('컬 ' + sp.perm.curl + '% · 웨이브 ' + sp.perm.wave + '%');
      if(sp.color) bits.push('색 ' + sp.color);
      /* 페이드는 전역이지만 <b>이 섹션이 페이드 구역일 때만</b> 적는다 —
         크라운에 가드 번호를 적으면 거기서 먹는 줄 알게 된다. */
      /* 페이드는 <b>전역</b>이라 어느 섹션에서 켜든 같은 값이다. 예전엔 하단 네
         섹션에서만 적었는데, 클리퍼가 전 섹션에 들어가게 된 지금(스포츠머리)
         크라운에서만 이 줄이 사라지면 "여기선 안 먹는다"로 잘못 읽힌다. */
      if(sp.fade){
        bits.push(sp.fade.enabled
          ? '페이드 가드 ' + sp.fade.guard + '(' + guardMm(sp.fade.guard).toFixed(1) + 'mm)'
            + (sp.fade.disc > 0 ? ' · 디스커넥션 ' + sp.fade.disc + '%' : ' · 높이 ' + sp.fade.height + '%')
            + (sp.fade.taper > 0 ? ' · 테이퍼 ' + sp.fade.taper + '%' : ' · 블록')
          : '페이드 없음');
      }
    } else {
      bits.push('이 스펙에 이 섹션 값이 없습니다(기본값 그대로)');
    }
    row.innerHTML = `<div class="gy-ctrl-top">
        <span><span class="gy-ctrl-label">${sp.name.split('·')[0].trim()}</span></span>
      </div>
      <div class="gy-ctrl-hint" style="line-height:1.6;">${bits.join(' · ')}</div>`;
    if(cut){
      const b = document.createElement('button');
      b.className = 'btn btn-ghost';
      b.style.cssText = 'font-size:11px;padding:6px 8px;margin-top:6px;width:100%;';
      b.textContent = '이 섹션만 이 값으로 맞추기';
      b.onclick = ()=> applyRecipeSection(sid, secId);
      row.appendChild(b);
    }
    body.appendChild(row);
  });
  /* 스타일링은 섹션이 아니라 머리 전체다 — 여기 적으면 섹션마다 같은 줄이
     여섯 번 반복된다. 스타일링 탭에서 따로 적는다(buildGyStylingControls). */
  const tip = document.createElement('div');
  tip.className = 'section-affects';
  tip.style.cssText = 'padding-top:8px;line-height:1.6;';
  tip.innerHTML = '길이는 <b>손님 원래 길이의 비율</b>이라 스펙의 cm·끝높이를 이 손님에게 풀어서 낸 값입니다 — '
    + '다른 손님에게 그대로 옮겨 적지 마세요. 넘김·볼륨·가르마 등 <b>머리 전체 연출</b>은 스타일링 탭에 있습니다.';
  body.appendChild(tip);
  g.appendChild(body);
  return g;
}

// 이 섹션이 영향을 주는 뷰 안내.
function gyBuildAffectsNote(secId){
  const note = document.createElement('div');
  note.className = 'section-affects';
  note.style.paddingTop = '10px';
  note.textContent = '영향: ' + SECTIONS[secId].visibleIn.map(v=>ANGLE_LABELS[v]).join(' · ');
  return note;
}

function buildGyControls(){
  const wrap = document.getElementById('gyControls');
  if(!wrap) return;
  wrap.innerHTML = '';

  // 스타일링(마무리) 탭
  if(state.activePanelSection === 'styling'){
    buildGyStylingControls(wrap);
    return;
  }

  const secId = state.activePanelSection;
  const sec = state.sections[secId];

  /* 페이드는 gyBuildProcessGroup(커트)이 <b>본문 안에서</b> 붙인다(2026-09-01) —
     여기서 형제로 또 붙이면 두 벌이 생긴다. */
  GYEOL_GROUPS.forEach(grp => wrap.appendChild(gyBuildProcessGroup(grp, secId, sec)));
  wrap.appendChild(gyBuildRecipeNote(secId));
  wrap.appendChild(gyBuildAffectsNote(secId));
  gySyncColorUI();   // 색 넘버·축 눈금 첫 표시 — DOM에 붙은 <b>뒤</b>여야 한다(gyColorEditor 끝 주석)
}

function buildGyStylingControls(wrap){
  const g = document.createElement('div'); g.className = 'gy-group';
  g.innerHTML = `<div class="gy-group-head static">
      <span class="gy-dot" style="background:var(--accent)"></span>
      <span class="gy-group-title" style="color:var(--accent-soft)">스타일링</span>
      <span class="gy-group-sub">머리 전체 마무리 연출</span></div>`;
  const body = document.createElement('div'); body.className = 'gy-group-body';
  GYEOL_STYLING_PARAMS.forEach(pm=>{
    if(pm.hidden) return;          // 프리셋만 쓰는 값 — 미용사가 만질 손잡이가 아니다(위 목록 주석)
    const v = (typeof state.styling[pm.key]==='number') ? state.styling[pm.key] : 0;
    const c = document.createElement('div'); c.className = 'gy-ctrl';
    c.innerHTML = `<div class="gy-ctrl-top">
        <span class="gy-ctrl-label">${pm.label}</span>
        <span class="gy-ctrl-val" id="gyst-${pm.key}">${v>0&&pm.min<0?'+':''}${v}</span>
      </div>
      <input type="range" min="${pm.min}" max="${pm.max}" value="${v}"
        oninput="onGyStyling('${pm.key}',this.value)">
      <div class="gy-ends"><span>${pm.left}</span><span>${pm.right}</span></div>`;
    body.appendChild(c);
  });
  /* ── 빗질(COMB) 손잡이를 <b>UI에서 뺐다</b> (2026-08-30 3차) ────────────────
     사용자: "빗질 버튼은 없애면 되고, <b>내부 코드는 일단 놔둬</b>."
     8/30에 캔버스 모드바 → 슬라이더 묶음으로 <b>옮겼던</b> 그 버튼이다. 같은 날
     화면 터치로 획을 만드는 경로까지 뺐으므로(bindAdjustViewGestures) 버튼만
     남으면 켜도 아무 일이 안 일어난다 — 눌러도 안 되는 손잡이가 제일 나쁘다.
     ⚠ 지운 것은 <b>이 붙임 하나</b>다. toggleCombMode·syncCombBtn·combUndo와
       엔진(combSplat·combStrand3D·combRebake…)은 전부 그대로 살아 있다.
       되돌리려면 여기에 예전 cb 블록만 다시 붙이면 된다(엔진은 손댈 것 없음).
     ⚠ syncCombBtn()은 계속 부른다 — 안에서 getElementById가 없으면 조용히
       빠지므로 안전하고, 버튼을 되살렸을 때 켜짐 표시가 저절로 따라온다. */
  g.appendChild(body);
  wrap.appendChild(g);
  /* ── (2026-09-01) 스타일링도 <b>목표 숫자</b>를 옆에 둔다 ────────────────
     폼파두르의 절반이 여기 있다(스펙 주석: "이 컷의 절반은 여기 있다" —
     sweep 81 · volume 70 · part 83 · partAmt 92 · sleek 100). 커트만 맞추고
     스타일링을 안 만지면 그냥 짧은 커트가 되지 폼파두르가 안 된다. */
  wrap.appendChild(gyBuildStylingRecipeNote());
  syncCombBtn();      // 버튼이 없으면 조용히 빠진다(되살렸을 때를 위해 남긴다)
}

/* 스타일링 스펙 수치표 — 섹션 레시피와 같은 그릇·같은 접힘 키를 쓴다.
   여기 값은 <b>그대로 슬라이더 숫자</b>다(커트의 길이와 달리 손님에 안 걸린다).
   그래서 역산이 없고, 스펙에 적힌 수를 그대로 옮긴다. */
function gyBuildStylingRecipeNote(){
  const collapsed = !!state.panelCollapsed.recipe;
  const g = document.createElement('div');
  g.className = 'gy-group optional' + (collapsed ? ' collapsed' : '');
  const head = document.createElement('div');
  head.className = 'gy-group-head';
  head.innerHTML = `<span class="gy-dot" style="background:var(--accent)"></span>
      <span class="gy-group-title" style="color:var(--accent-soft)">스펙 수치</span>
      <span class="gy-group-sub">스타일링 목표값 — 그대로 슬라이더 숫자</span>
      <span class="gy-chevron">▼</span>`;
  head.onclick = ()=> toggleGyGroup('recipe');
  g.appendChild(head);
  const body = document.createElement('div');
  body.className = 'gy-group-body';
  RECIPE_STYLES.forEach(sid=>{
    const sp = STYLE_SPECS[sid];
    if(!sp || !sp.styling) return;
    const row = document.createElement('div'); row.className = 'gy-ctrl';
    /* 목록 순서로 돈다 — 스펙에 없는 키는 <b>중립값</b>이라는 뜻이고, 그걸
       "안 적혀 있음"이 아니라 숫자로 보여야 손으로 재현할 수 있다. */
    const bits = GYEOL_STYLING_PARAMS.map(pm=>{
      const has = (sp.styling[pm.key] != null);
      const v = has ? sp.styling[pm.key] : (typeof pm.neutral === 'number' ? pm.neutral : 0);
      return pm.label + ' ' + ((v > 0 && pm.min < 0) ? '+' : '') + v + (has ? '' : '(중립)');
    });
    row.innerHTML = `<div class="gy-ctrl-top">
        <span><span class="gy-ctrl-label">${sp.name.split('·')[0].trim()}</span></span>
      </div>
      <div class="gy-ctrl-hint" style="line-height:1.6;">${bits.join(' · ')}</div>`;
    const b = document.createElement('button');
    b.className = 'btn btn-ghost';
    b.style.cssText = 'font-size:11px;padding:6px 8px;margin-top:6px;width:100%;';
    b.textContent = '스타일링만 이 값으로 맞추기';
    b.onclick = ()=>{
      /* 가르마는 네 뷰가 같아야 한다(PART_VIEW_LOCK 배너) — applyStyleSpec과
         같이 <b>네 뷰 전부</b>에 넣는다. 한 뷰만 넣으면 옆·뒤에서 선이 흐려진다. */
      state.stylingByView = neutralStylingByView();
      for(const a of ANGLES) Object.assign(state.stylingByView[a], sp.styling);
      bindStylingToCurrentView();
      buildGyControls();
      drawAdjustPreview();
      showToast(sp.name.split('·')[0].trim() + ' 스타일링 값으로 맞췄어요');
    };
    row.appendChild(b);
    body.appendChild(row);
  });
  g.appendChild(body);
  return g;
}

/* ── 현재 조정 상태를 새 스타일로 등록 ──
   "조정을 다 마친 결과물이 그 자체로 하나의 스타일이 될 수도 있다"는 요청.
   기존 STYLES 프리셋은 length/curl/volume 대표값 하나로 6개 섹션 값을
   역산해서 만드는 구조라, 그 방식으로는 지금까지 세밀하게 만진 섹션별
   조정(예: 프론트만 짧게, 네이프는 테이퍼 등)이 다 뭉개짐. 그래서 커스텀
   등록 스타일은 st.sections(섹션별 값 전체 스냅샷)를 따로 갖고, selectStyle()
   이 st.sections 존재 여부로 두 방식을 분기해서 처리(위 selectStyle 참고).
   localStorage에 저장해서 새로고침/재방문해도 등록한 스타일이 남아있게 함
   (이 파일은 사용자가 직접 배포하는 정적 사이트라 클로드 아티팩트의
   localStorage 금지 규정과 무관 — 일반 웹사이트라 브라우저 저장소 사용 가능). */
function registerCurrentAsStyle(){
  const name = prompt(tUI('이 스타일 이름을 입력하세요 (예: "오늘 손님 스타일")'), '');
  if(!name || !name.trim()) return; // 취소 또는 빈 입력이면 등록 안 함
  const newStyle = {
    id: 'custom-' + Date.now(),
    name: name.trim(),
    tags: '커스텀',
    isCustom: true,
    sections: JSON.parse(JSON.stringify(state.sections)), // 섹션별 값 전체 깊은 복사
    styling: JSON.parse(JSON.stringify(state.styling)),    // (하위호환) 현재 뷰 값
    stylingByView: JSON.parse(JSON.stringify(state.stylingByView || {})), // 뷰별 스타일링 스냅샷
    globalCurl: state._globalCurl,
    // 아래 3개는 스타일 카드 아이콘(styleIconSVG)이 참조하는 대표값 —
    // 실제 렌더링은 sections를 그대로 쓰지만, 그리드에서의 미리보기 아이콘용으로 채워둠.
    // volume은 이제 elevation(0~90°) 기반이라 0~100 스케일로 환산해서 채움.
    length: state.sections.crown.length,
    curl: state._globalCurl,
    volume: Math.round(((state.sections.crown.elevation ?? 45) / 90) * 100),
    colorHex: (state.selectedStyle && state.selectedStyle.colorHex)
      || (state.hairMasks.front && state.hairMasks.front.avgColor)
      || '#2A1B12',
  };
  STYLES.push(newStyle);
  saveCustomStylesToStorage();
  buildStyleGrid();
  showToast(`"${newStyle.name}" 스타일로 등록했어요`);
}

function saveCustomStylesToStorage(){
  try{
    const customs = STYLES.filter(s=>s.isCustom);
    localStorage.setItem('gyeol_customStyles', JSON.stringify(customs));
  }catch(e){ console.warn('커스텀 스타일 저장 실패(용량 초과 등):', e); }
}
function loadCustomStylesFromStorage(){
  try{
    const raw = localStorage.getItem('gyeol_customStyles');
    if(!raw) return;
    const customs = JSON.parse(raw);
    if(Array.isArray(customs)){
      customs.forEach(c=>{
        if(c && c.id && !STYLES.find(s=>s.id===c.id)) STYLES.push(c);
      });
    }
  }catch(e){ console.warn('커스텀 스타일 불러오기 실패:', e); }
}
// loadCustomStylesFromStorage()는 buildStyleGrid() 초기 호출 전에 이미 실행됨(위쪽 참고)

// 하위 호환: selectStyle에서 슬라이더 동기화
function syncSliderUI(){
  // gyeol 패널로 대체 — 뷰 전환 시 섹션칩/컨트롤 재구성(현재 뷰 가시성 표시 갱신)
  buildGyPanel();
  const tag = document.getElementById('adjustStyleTag');
  if(tag) tag.textContent = state.selectedStyle ? state.selectedStyle.name : '스타일 미선택';
  drawAdjustPreview();
}

