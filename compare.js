/* ════════════════════════════════════════
   ANGLE SWITCH
════════════════════════════════════════ */
function renderAngleSwitch(targetId){
  const el=document.getElementById(targetId); if(!el) return; el.innerHTML='';
  ANGLES.forEach(a=>{
    const btn=document.createElement('button');
    btn.textContent=ANGLE_LABELS[a];
    btn.className=state.currentViewAngle===a?'on':'';
    btn.onclick=()=>{
      state.currentViewAngle=a;
      renderAngleSwitch('angleSwitch'); renderAngleSwitch('angleSwitchCompare');
      syncSliderUI(); drawAdjustPreview(); drawCompare();
    };
    el.appendChild(btn);
  });
}

