/* ════════════════════════════════════════
   CAPTURE
════════════════════════════════════════ */
const video = document.getElementById('video');
const camOffMsg = document.getElementById('camOffMsg');
let cameraStream = null;

async function initCamera(){
  try{
    cameraStream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:1280},height:{ideal:1920}},audio:false});
    video.srcObject=cameraStream;
    video.style.display='block';
    camOffMsg.style.display='none';
  }catch(e){
    camOffMsg.innerHTML='카메라에 접근할 수 없습니다.<br><span style="font-size:11px;">아래 "업로드" 버튼을 이용해주세요.</span>';
    camOffMsg.style.display='';
  }
}
initCamera();

function updateAngleUI(){
  ANGLES.forEach((a,i)=>{
    const card=document.getElementById('card-'+a);
    const seg=document.getElementById('seg'+i);
    const thumb=document.getElementById('thumb-'+a);
    const chk=document.getElementById('chk-'+a);
    const isCurrent = i===state.currentCaptureIndex;
    const hasShot = !!state.shots[a];
    card.className='angle-item'+(isCurrent?' current':'');
    chk.textContent = hasShot?'✓':'';
    thumb.innerHTML = hasShot?`<img src="${state.shots[a]}">`:'';
    // dial
    const okColor='#8FA888', activeColor='#C98A4B', lineColor='#3A332B';
    seg.style.stroke = hasShot?okColor:(isCurrent?activeColor:lineColor);
  });
  const doneCount=ANGLES.filter(a=>state.shots[a]).length;
  document.getElementById('dialCenter').textContent=doneCount+'/4';
  const curAngle=ANGLES[state.currentCaptureIndex];
  document.getElementById('captureHint').textContent=HINTS[curAngle];
  document.getElementById('capHintSmall').textContent=ANGLE_LABELS[curAngle]+ ' 촬영';
  document.getElementById('toStyleBtn').disabled=doneCount<1;
  // show/hide preview
  const shot=state.shots[curAngle];
  const sp=document.getElementById('shotPreview');
  if(shot){sp.src=shot;sp.style.display='block';video.style.display='none';}
  else{sp.style.display='none';if(cameraStream)video.style.display='block';}
}
updateAngleUI();

function jumpToAngle(i){ state.currentCaptureIndex=i; updateAngleUI(); }

function captureCurrentAngle(){
  const angle=ANGLES[state.currentCaptureIndex];
  if(state.shots[angle]){ retakeCurrent(); return; }
  if(video.style.display!=='none' && video.videoWidth){
    const c=document.createElement('canvas');
    c.width=video.videoWidth; c.height=video.videoHeight;
    const ctx=c.getContext('2d');
    ctx.translate(c.width,0); ctx.scale(-1,1); // mirror
    ctx.drawImage(video,0,0);
    state.shots[angle]=c.toDataURL('image/jpeg',0.85);
    // auto advance
    if(state.currentCaptureIndex<3) state.currentCaptureIndex++;
    updateAngleUI();
  } else { showToast('카메라가 준비되지 않았어요.'); }
}

function retakeCurrent(){
  const angle=ANGLES[state.currentCaptureIndex];
  state.shots[angle]=null; state.hairCanvases[angle]=null; state.hairMasks[angle]=null; state.baseCanvases[angle]=null;
  aiAnalysis=null;
  updateAngleUI();
}

function handleFileUpload(e){
  const file=e.target.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=ev=>{
    state.shots[ANGLES[state.currentCaptureIndex]]=ev.target.result;
    if(state.currentCaptureIndex<3) state.currentCaptureIndex++;
    updateAngleUI();
  };
  reader.readAsDataURL(file);
  e.target.value='';
}

