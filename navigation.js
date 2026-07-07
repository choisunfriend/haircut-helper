/* ════════════════════════════════════════
   HELPERS
════════════════════════════════════════ */
function showAI(text,sub){
  document.getElementById('aiOverlayText').textContent=text;
  document.getElementById('aiOverlaySub').textContent=sub;
  document.getElementById('aiOverlay').classList.remove('hidden');
}
function hideAI(){ document.getElementById('aiOverlay').classList.add('hidden'); }

let toastTimer;
function showToast(msg){
  const el=document.getElementById('toast');
  el.textContent=msg; el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>el.classList.remove('show'),2800);
}

function startNewCustomer(){
  aiAnalysis=null;
  ANGLES.forEach(a=>{state.shots[a]=null;state.hairCanvases[a]=null;state.hairMasks[a]=null;state.baseCanvases[a]=null;});
  state.landmarks = {};
  state.selectedStyle=null; state.currentCaptureIndex=0; state.currentSection='crown';
  // 섹션 초기화
  SECTION_ORDER.forEach(id=>{
    state.sections[id] = {...SECTIONS[id].defaults};
  });
  state._globalCurl = 30;
  document.getElementById('aiAnalysisCard').style.display='none';
  document.querySelectorAll('.style-card').forEach(c=>c.classList.remove('ai-recommended','selected'));
  document.getElementById('toAdjustBtn').disabled=true;
  ['style','adjust','compare'].forEach(id=>{ const t=document.getElementById('nav-'+id); if(t) t.disabled=true; });
  updateAngleUI();
  navTo('capture');
}
