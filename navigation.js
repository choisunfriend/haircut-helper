/* ════════════════════════════════════════
   COMPARE
════════════════════════════════════════ */
function drawCompare(){
  if(currentScreen!=='compare') return;
  const angle = state.currentViewAngle;
  const pane  = document.getElementById('comparePane');
  const baseC = document.getElementById('compareBaseCanvas');
  const topC  = document.getElementById('compareTopCanvas');
  const clip  = document.getElementById('compareClip');

  const pw = pane.clientWidth, ph = pane.clientHeight;
  if(pw===0||ph===0){ setTimeout(()=>drawCompare(),80); return; }
  baseC.width=pw; baseC.height=ph;
  topC.width=pw;  topC.height=ph;
  topC.style.width=pw+'px'; topC.style.height=ph+'px';

  const div = document.getElementById('compareDivider');
  if(!div.style.left||div.style.left==='0px') div.style.left='50%';
  const pct = parseFloat(div.style.left)||50;
  clip.style.width = pct+'%';

  getCachedImg(angle,(img)=>{
    const ctx = baseC.getContext('2d');
    ctx.clearRect(0,0,pw,ph);
    if(img) drawImgOnCanvas(ctx,img,pw,ph);
  });

  renderFrame(topC, angle);
}

function positionCompareTop(){ drawCompare(); }

// divider drag
const divider=document.getElementById('compareDivider');
const clip=document.getElementById('compareClip');
let dragging=false;
divider.addEventListener('pointerdown',e=>{dragging=true;e.preventDefault();});
window.addEventListener('pointerup',()=>{dragging=false;});
window.addEventListener('pointermove',e=>{
  if(!dragging) return;
  const pane=document.getElementById('comparePane');
  const rect=pane.getBoundingClientRect();
  let pct=((e.clientX-rect.left)/rect.width)*100;
  pct=Math.max(4,Math.min(96,pct));
  divider.style.left=pct+'%'; clip.style.width=pct+'%';
});
window.addEventListener('resize',positionCompareTop);

