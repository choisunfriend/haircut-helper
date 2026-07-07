/* ════════════════════════════════════════
   STYLE SELECT
════════════════════════════════════════ */
function buildStyleGrid(){
  const grid=document.getElementById('styleGrid');
  grid.innerHTML='';
  STYLES.forEach(st=>{
    const card=document.createElement('div');
    card.className='style-card'; card.id='style-'+st.id;
    card.onclick=()=>selectStyle(st.id);
    card.innerHTML=`
      <div class="style-icon-box">${styleIconSVG(st)}</div>
      <div class="name">${st.name}</div>
      <div class="tags">${st.tags}</div>
      <div class="ai-rec">★ AI 추천</div>`;
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
  // 스타일 파라미터를 섹션 기본값으로 변환
  const st = state.selectedStyle;
  state.sections.crown.length    = st.length;
  state.sections.crown.volume    = st.volume;
  state.sections.front.length    = Math.round(st.length * 0.85); // 앞머리는 약간 짧게
  state.sections.front.line      = 50;
  state.sections.temple.length   = Math.round(st.length * 0.80);
  state.sections.temple.blend    = 50;
  state.sections.side.length     = Math.round(st.length * 0.90);
  state.sections.side.layer      = st.curl > 40 ? 40 : 20;
  state.sections.occipital.length= st.length;
  state.sections.occipital.volume= st.volume;
  state.sections.nape.length     = Math.round(st.length * 0.60);
  state.sections.nape.line       = 50;
  state._globalCurl = st.curl;
  syncSliderUI();
}
buildStyleGrid();

