/* 땋기(21-braid.js) 하네스 — 2026-09-22. 실행: node test/braid.test.js
   파일에서 함수를 그대로 뽑아 돌린다(08 traceSmoothPolyline · 15 bundleTintColor/parseColorRGB 포함).
   캔버스는 호출을 기록하는 가짜다 — 모양이 예쁜지는 못 본다(실기기에서 볼 것). */
const fs=require('fs');
const path=require('path'); const JS=path.join(__dirname,'..','js'); const J=f=>fs.readFileSync(path.join(JS,f),'utf8');
function grab(src,name){const i=src.indexOf('\nfunction '+name+'(');if(i<0)throw new Error(name);
  let j=src.indexOf('{',i),d=0,k=j;for(;k<src.length;k++){if(src[k]==='{')d++;else if(src[k]==='}'){d--;if(!d)break;}}return src.slice(i,k+1);}
const S08=J('08-cut-engine.js'),S15=J('15-project-3d.js'),S16=J('16-style-spec-diag.js'),S21=J('21-braid.js');
global.state={landmarks:{}}; global.FACE_RULER_CM={eyeToChin:11.5,earHalf:7};
global.gyeolBoldArgs=a=>a; let CMU=16.4;
global.faceRulerCmPerUnit=()=>({x:CMU,y:CMU}); global.getFaceMetrics=()=>({});
const SPC=fs.readdirSync(JS).map(f=>J(f)).find(x=>x.includes('\nfunction parseColorRGB('));
eval([grab(S08,'traceSmoothPolyline'),grab(S15,'bundleTintColor'),grab(SPC,'parseColorRGB')].join('\n'));
try{ eval(grab(S15,'quantizeStrokeColor')); }catch(e){}
global.traceSmoothPolyline=traceSmoothPolyline; global.bundleTintColor=bundleTintColor;
// 21 전체를 싣는다(const/let 포함) — 전역으로 꺼내기 위해 끝에 노출
eval(S21+'\n;global.braidPickGrid=braidPickGrid;global.BRAID=BRAID;global.BRAID_DEFAULTS=BRAID_DEFAULTS;global.braidGeometry=braidGeometry;global.braidPxPerCm3D=braidPxPerCm3D;global.traceBraidPolyline=traceBraidPolyline;global.braidDrawProjected=braidDrawProjected;global.braidArcLengths=braidArcLengths;global.resetBraidLog=resetBraidLog;');
let pass=0,fail=0;const t=(n,c)=>{c?(pass++,console.log('  ok   '+n)):(fail++,console.log('  FAIL '+n));};
// 기록하는 가짜 ctx
function mkCtx(){const c={ops:[],strokes:[],cur:null,lineWidth:1,strokeStyle:'#000',
  beginPath(){this.cur=[];}, moveTo(x,y){this.cur.push([x,y]);}, lineTo(x,y){this.cur.push([x,y]);},
  quadraticCurveTo(a,b,x,y){this.cur.push([x,y]);}, bezierCurveTo(a,b,c2,d,x,y){this.cur.push([x,y]);},
  stroke(){this.strokes.push({w:this.lineWidth,col:this.strokeStyle,n:this.cur.length,pts:this.cur});}};return c;}
const cal={sy:0.02}, toCY=v=>v*0.5;     // 단위→이미지 50px → 캔버스 25px
const vert=(x,n=60,len=300)=>Array.from({length:n},(_,i)=>({x, y:i*len/(n-1)}));

console.log('── 자: 3D 모델 자(후면에서도) ──');
const ppc=braidPxPerCm3D(cal,toCY);
t('px/cm = (1/sy→toCY) ÷ cm/단위 = 25/16.4', Math.abs(ppc-25/16.4)<1e-9);
t('cal 없으면 null(때우지 않음)', braidPxPerCm3D(null,toCY)===null);
CMU=0; t('cm/단위 없으면 null', braidPxPerCm3D(cal,toCY)===null); CMU=16.4;

console.log('── 치수 ──');
BRAID.on=false; t('꺼져 있으면 치수 없음', braidGeometry(20)===null);
BRAID.on=true;
const g=braidGeometry(20);
t('굵기 0.85cm@20px/cm = 17px', Math.abs(g.widthPx-17)<1e-9);
t('마디 0.70cm = 14px', Math.abs(g.nodePx-14)<1e-9);
t('갈래 3', g.strands===3);
t('바깥폭(2·진폭+선) <= 굵기', 2*g.amp+g.subWidth <= g.widthPx+1e-9);
BRAID.tightness=1; const g1=braidGeometry(20);
t('세기 1이어도 굵기를 안 넘는다', 2*g1.amp+g1.subWidth <= g1.widthPx+1e-9); BRAID.tightness=0.78;

console.log('── 구간이 끊겨도 마디 위상이 이어진다 ──');
{ const pts=vert(100); const sAll=braidArcLengths(pts);
  const c1=mkCtx(); c1.beginPath(); traceBraidPolyline(c1,pts,g,0,59,sAll); c1.stroke();
  const c2=mkCtx(); c2.beginPath(); traceBraidPolyline(c2,pts,g,0,29,sAll); traceBraidPolyline(c2,pts,g,30,59,sAll); c2.stroke();
  // 갈래 0의 30번째 점 이후 모양이 같아야 한다 → 오프셋 계산을 직접 비교
  const offAt=(i0,i)=>{ const c=mkCtx(); c.beginPath(); traceBraidPolyline(c,pts,g,i0,59,sAll); c.stroke(); return c.strokes[0].pts; };
  const full=offAt(0), tail=offAt(30);
  // tail은 갈래 3개가 이어 붙은 것이라 첫 갈래의 끝 x만 비교
  const maxDx=(A,B)=>{let m=0;for(let k=0;k<3;k++){const a=A[A.length-1-k], b=B[B.length-1-k]; m=Math.max(m,Math.abs(a[0]-b[0]));} return m;};
  t('끝점 위치가 구간 분할과 무관', maxDx(full,tail) < 1e-6);
  t('갈래가 축에서 실제로 벌어진다', full.some(p=>Math.abs(p[0]-100)>1)); }
{ // 뿌리 startAtFrac 구간은 안 벌어진다
  const pts=vert(100); const c=mkCtx(); c.beginPath(); traceBraidPolyline(c,pts,g,0,59); c.stroke();
  const firstPts=c.strokes[0].pts.slice(0,2);
  t('뿌리에서는 축 위(두피에서 안 튀어나옴)', firstPts.every(p=>Math.abs(p[0]-100)<1e-6)); }

console.log('── 3D 렌더에 끼우기 ──');
const mkProj=(N)=>Array.from({length:N},(_,i)=>({cpts:vert(10+i*3), runs:[[0,59]], hb:(i*0.618034)%1, color:'#3a2a20', colors:null, w:1, sec:'crown'}));
{ const P=mkProj(500);
  BRAID.on=false; const c0=mkCtx(); t('꺼지면 false·아무것도 안 그림', braidDrawProjected(c0,P,{cal,toCY,calcN:1000})===false && c0.strokes.length===0);
  BRAID.on=true; resetBraidLog(); const c=mkCtx(); const r=braidDrawProjected(c,P,{cal,toCY,calcN:1000,tint:()=>1});
  t('켜지면 true(평소 그리기 건너뜀)', r===true);
  const ropes=(c.strokes.length-1)/2;   // 밑칠 1 + 밧줄마다(몸통+갈래) 2
  t('밧줄 수 ≈ 60 × 500/1000 = 30 (±8)', Math.abs(ropes-30)<=8);
  const gg=braidGeometry(braidPxPerCm3D(cal,toCY));
  t('몸통 선 = 굵기 × 0.9', c.strokes.some(s=>Math.abs(s.w-gg.widthPx*0.9)<1e-9));
  t('갈래 선 = subWidth', c.strokes.some(s=>Math.abs(s.w-gg.subWidth)<1e-9));
  t('몸통이 갈래보다 어둡다', (()=>{const b=c.strokes[1].col, s=c.strokes[2].col; const L=x=>{const m=x.match(/\d+/g).map(Number);return m[0]+m[1]+m[2];}; return L(b)<L(s);})());
  const cx=mkCtx(); t('자 없으면 false(평소 렌더로)', braidDrawProjected(cx,P,{cal:null,toCY,calcN:1000})===false && cx.strokes.length===0); }

console.log('── 2D도 파팅 격자로 고른다 ──');
{ global.getHeadEllipsoid=()=>({a:0.417,b:0.633,c:0.492}); global.modelCmPerUnit=()=>19.26;
  state.hair3Dneutral={CY:0}; BRAID.on=true; BRAID.grid=true; resetBraidLog();
  // 두피 위 뿌리를 가진 가닥 3000개 — r3가 3D 뿌리, cpts는 아무 선
  let seed=3; const rnd=()=>{ seed=(seed*16807)%2147483647; return seed/2147483647; };
  const P=Array.from({length:3000},(_,i)=>{ const cz=1-rnd()*(1-Math.cos(1.5)), phi=Math.acos(cz), th=(rnd()*2-1)*Math.PI;
    return { r3:{x:0.417*Math.sin(phi)*Math.sin(th), y:0.633*Math.cos(phi), z:0.492*Math.sin(phi)*Math.cos(th)},
             cpts:vert(i%400), runs:[[0,59]], hb:rnd(), color:'#3a2a20', colors:null, w:1, sec:'crown' }; });
  const c=mkCtx(); const r=braidDrawProjected(c,P,{cal,toCY,calcN:3000,tint:()=>1});
  const ropes=(c.strokes.length-1)/2;
  const G=braidPickGrid(P.map(p=>p.r3)).length;
  t('2D 밧줄 수 = 격자 칸 수('+G+')', r===true && ropes===G);
  t('격자 칸이 난수 목표(60)보다 훨씬 많다', G > 150);
  state.hair3Dneutral=null; }
console.log('── 스타일 걸기/풀기 ──');
{ const blk=S16.slice(S16.indexOf("  if(typeof BRAID !== 'undefined'){"), S16.indexOf("rep.braid = BRAID.on ? { ...sp.braid } : null;\n  }")+50);
  const run=(sp)=>{const rep={}; eval(blk); return rep;};
  const i0=S16.indexOf('  reggae_twist: {'); let j=S16.indexOf('{',i0),d=0,k=j;
  for(;k<S16.length;k++){ if(S16[k]==='{')d++; else if(S16[k]==='}'){d--; if(!d)break;} }
  const SPECS={ reggae_twist: eval('('+S16.slice(j,k+1)+')') };
  const sp=SPECS.reggae_twist;
  t('스펙에 길이(lenCm·tipAt)가 없다 = 손님 길이 그대로', !sp.lenCm && !sp.tipAt && Object.keys(sp.cut).length===0);
  BRAID.on=false; run(sp); t('땋기 스펙을 걸면 켜진다', BRAID.on===true && BRAID.strands===3);
  BRAID.widthCm=9; run({name:'x'}); t('다른 스펙을 걸면 꺼진다', BRAID.on===false);
  t('앞 스펙 값이 안 남는다(기본값 복원)', BRAID.widthCm===BRAID_DEFAULTS.widthCm);
  run(sp); const S17=J('17a-mannequin.js');
  t('해제(clearStyleSpec)가 끄는 줄이 있다', /clearStyleSpec[\s\S]{0,400}BRAID\.on = false/.test(S17)); }

console.log('\n'+pass+'/'+(pass+fail)+' 통과'+(fail?'  ← '+fail+'개 실패':''));
process.exit(fail?1:0);
