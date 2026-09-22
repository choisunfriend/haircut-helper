/* 렌더 문(10-hair-render-2d.js) + 3D 미리보기 끌기(26-hair-clump.js) 하네스 — 2026-09-22
   실행: node test/gate-drag.test.js */
const fs=require('fs'), path=require('path');
let pass=0,fail=0; const t=(n,c)=>{c?(pass++,console.log('  ok   '+n)):(fail++,console.log('  FAIL '+n));};
const J=(f)=>fs.readFileSync(path.join(__dirname,'..','js',f),'utf8');
function grab(src,name){const m=new RegExp('(^|[;}\\s])function '+name+'\\(').exec(src); if(!m) throw new Error(name);
  const i=m.index+m[1].length; let d=0,k=src.indexOf('{',i);
  for(;k<src.length;k++){ if(src[k]==='{')d++; else if(src[k]==='}'){d--; if(!d)break;} } return src.slice(i,k+1); }

console.log('── 렌더 문: 여러 단계를 한 번으로 ──');
{
  const S=J('10-hair-render-2d.js');
  // let rafId 선언부터 떼어 온다 — drawAdjustPreview가 그 변수를 쓴다
  const gate=S.slice(S.indexOf('let rafId = null;'), S.indexOf('\nfunction drawAdjustPreview()'));
  let frames=0, renders=0;
  global.currentScreen='adjust';
  global.requestAnimationFrame=(fn)=>{ frames++; fn(); return frames; };
  global.cancelAnimationFrame=()=>{};
  global.renderAdjustFrame=()=>{ renders++; };
  global.console={log(){},warn(){}};
  eval(gate+'\n'+grab(S,'drawAdjustPreview')
    +';global.RENDER_GATE=RENDER_GATE;global.withRenderGate=withRenderGate;global.drawAdjustPreview=drawAdjustPreview;'
    +'global.beginRenderGate=beginRenderGate;global.endRenderGate=endRenderGate;');
  const realLog=console.log;
  // 문 없이: 단계마다 프레임이 넘어가면 그때마다 그린다(지금 폰에서 벌어지던 일)
  RENDER_GATE.on=false; renders=0;
  for(let i=0;i<8;i++) drawAdjustPreview();
  global.console=require('console');
  console.log('       문 없이 8단계 → 그리기 '+renders+'회');
  t('(대조) 문이 없으면 단계 수만큼 그린다', renders===8);
  RENDER_GATE.on=true; renders=0;
  withRenderGate(()=>{ for(let i=0;i<8;i++) drawAdjustPreview(); }, '시험');
  console.log('       문으로 묶으면 → 그리기 '+renders+'회');
  t('<b>여러 단계를 한 번으로 묶는다</b>', renders===1);
  t('건너뛴 횟수를 센다(로그용)', RENDER_GATE.skipped>=7);
  renders=0; RENDER_GATE.skipped=0;
  t('아무도 안 그렸으면 끝나고도 안 그린다', (withRenderGate(()=>{}), renders===0));
  renders=0;
  let threw=false;
  try{ withRenderGate(()=>{ drawAdjustPreview(); throw new Error('중간 실패'); }); }catch(e){ threw=true; }
  t('중간에 예외가 나도 문이 풀리고 한 번 그린다(화면이 안 멈춘다)', threw && renders===1 && RENDER_GATE.depth===0);
  renders=0; withRenderGate(()=>{ withRenderGate(()=>{ drawAdjustPreview(); }); drawAdjustPreview(); });
  t('문 안에 문이 겹쳐도 한 번', renders===1);
  renders=0; global.currentScreen='result'; drawAdjustPreview();
  t('조정 화면이 아니면 안 그린다(예전 그대로)', renders===0); global.currentScreen='adjust';
  RENDER_GATE.on=false; renders=0; for(let i=0;i<3;i++) drawAdjustPreview();
  t('끄면 예전 동작', renders===3); RENDER_GATE.on=true;
}

console.log('── 스타일 적용이 문으로 감싸져 있나 ──');
{
  const S17=J('17a-mannequin.js');
  t('applyStyleSpecAndRender가 withRenderGate로 감쌌다', /withRenderGate\(\s*\(\)=>\s*_applyStyleSpecBody/.test(S17));
  t('본문은 그대로 떼어 냈다(단계 순서 불변)', /function _applyStyleSpecBody[\s\S]{0,600}combRefresh\(\);\s*return rep;/.test(S17));
}

console.log('── 3D 미리보기 창 끌기 ──');
{
  const S26=J('26-hair-clump.js');
  // 아주 작은 DOM 흉내 — 헤더에 붙은 pointer 처리기를 직접 부른다
  const mk=(id)=>({ id, style:{}, cls:new Set(), classList:{ contains:(c)=>false },
    _h:{}, addEventListener(n,f){ this._h[n]=f; }, setPointerCapture(){}, releasePointerCapture(){},
    getBoundingClientRect(){ return { left:this.style.left?parseFloat(this.style.left):800, top:this.style.top?parseFloat(this.style.top):500, width:172, height:222 }; } });
  const el=mk('devMini3D'), h=mk('devMini3DHeader');
  global.window={ innerWidth:1000, innerHeight:800 };
  global.document={ readyState:'complete', getElementById:(i)=> i==='devMini3D'?el : i==='devMini3DHeader'?h : null,
    addEventListener(){} };
  eval(S26.slice(S26.indexOf('const MINI3D_DRAG'))+';global.installMini3DDrag=installMini3DDrag;global.resetMini3DPos=resetMini3DPos;global.MINI3D_DRAG=MINI3D_DRAG;');
  installMini3DDrag();
  t('헤더에 손잡이가 붙는다', typeof h._h.pointerdown==='function' && h.style.cursor==='move');
  t('손가락 끌기가 스크롤로 안 넘어간다(touchAction none)', h.style.touchAction==='none');
  const down=(x,y,target)=>h._h.pointerdown({ clientX:x, clientY:y, pointerId:1, target:target||{closest:()=>null}, preventDefault(){} });
  down(820, 510);
  t('잡는 순간 right/bottom을 풀고 left/top으로 바꾼다', el.style.right==='auto' && el.style.bottom==='auto' && el.style.left==='800px');
  h._h.pointermove({ clientX:620, clientY:310, pointerId:1 });
  t('끈 만큼 따라온다 (800,500) → (600,300)', el.style.left==='600px' && el.style.top==='300px');
  h._h.pointermove({ clientX:-500, clientY:-500, pointerId:1 });
  t('왼쪽·위로 화면 밖을 안 나간다', parseFloat(el.style.left)>=MINI3D_DRAG.margin && parseFloat(el.style.top)>=MINI3D_DRAG.margin);
  h._h.pointermove({ clientX:5000, clientY:5000, pointerId:1 });
  t('오른쪽·아래로도 제목이 남는다', parseFloat(el.style.left)<=1000-172-MINI3D_DRAG.margin+0.01 && parseFloat(el.style.top)<=800-222-MINI3D_DRAG.margin+0.01);
  h._h.pointerup({ pointerId:1 });
  const before=el.style.left;
  h._h.pointermove({ clientX:100, clientY:100, pointerId:1 });
  t('놓으면 더 안 따라온다', el.style.left===before);
  el.style.left='123px'; down(820,510,{ closest:(s)=> s==='button' ? {} : null });
  t('헤더의 ⛶·✕ 버튼에서는 안 잡힌다', el.style.left==='123px');
  el.classList.contains=(c)=> c==='expanded';
  el.style.left='77px'; down(820,510);
  t('확대 상태에서는 안 옮긴다', el.style.left==='77px');
  el.classList.contains=()=>false;
  resetMini3DPos(); t('제자리로 되돌린다', el.style.left==='' && el.style.right==='');
}

console.log('\n'+pass+'/'+(pass+fail)+' 통과'+(fail?'  ← '+fail+'개 실패':''));
process.exit(fail?1:0);
