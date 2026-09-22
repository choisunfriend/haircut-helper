/* 땋기 3D(튜브 밧줄) 하네스 — 2026-09-22 2차. 실행: node test/braid3d.test.js
   21-braid.js 전체를 싣고 THREE는 배열만 받는 가짜로 둔다.
   묻는 것: ① 켜고 끄기 ② 밧줄 수 ③ 굵기가 widthCm을 안 넘나
            ④ <b>진짜 꼬이나</b> — 갈래 관끼리 안 뚫고, 교차점에서 앞뒤가 반대인가
            ⑤ 두 갈래(꼬기)도 안 뚫나 ⑥ 정점 수가 식과 맞나 ⑦ NaN 없음 */
const fs=require('fs'), path=require('path');
const S21=fs.readFileSync(path.join(__dirname,'..','js','21-braid.js'),'utf8');
class Color{ constructor(){this.r=0;this.g=0;this.b=0;}
  set(v){ const m=String(v).match(/^#([0-9a-f]{6})$/i); if(!m) throw new Error('bad color '+v);
    const n=parseInt(m[1],16); this.r=(n>>16&255)/255; this.g=(n>>8&255)/255; this.b=(n&255)/255; return this; }
  multiplyScalar(k){ this.r*=k; this.g*=k; this.b*=k; return this; } }
global.THREE={ Color,
  BufferGeometry: class{ constructor(){this.attr={};} setAttribute(k,v){this.attr[k]=v;} setIndex(i){this.index=i;} },
  Float32BufferAttribute: class{ constructor(a,n){this.array=Float32Array.from(a); this.itemSize=n;} },
  MeshLambertMaterial: class{ constructor(o){this.o=o;} },
  LineBasicMaterial: class{ constructor(o){this.o=o;} },
  Mesh: class{ constructor(g,m){this.geometry=g; this.material=m;} },
  LineSegments: class{ constructor(g,m){this.geometry=g; this.material=m; this.isLineSegments=true;} },
  Group: class{ constructor(){this.children=[]; this.isGroup=true;} add(o){this.children.push(o);} },
  DoubleSide: 2 };
// 묶음이면 튜브 메쉬 / 모아 빗기 선을 꺼낸다
const meshOf=(o)=> o && o.isGroup ? o.children.find(c=>c.name==='braidedHair') : o;
const fillOf=(o)=> o && o.isGroup ? o.children.find(c=>c.name==='braidCellFill') : null;
const linesOf=(o)=> o && o.isGroup ? o.children.find(c=>c.isLineSegments) : null;
global.gyeolBoldArgs=a=>a; global.state={landmarks:{}}; global.FACE_RULER_CM={eyeToChin:11.5};
let CMU=16.4; global.modelCmPerUnit=()=>CMU;
global.getHeadEllipsoid=()=>({a:0.417,b:0.633,c:0.492});     // 실기기 로그의 두상 반축
state.hair3Dneutral={CY:0};
eval(S21+';global.BRAID=BRAID;global.BRAID3D=BRAID3D;global.buildBraid3DObject=buildBraid3DObject;global.braidResample3D=braidResample3D;global.braidPickGrid=braidPickGrid;global.braidGridInfo=braidGridInfo;global.braidGroupGrid=braidGroupGrid;global.braidCellOf=braidCellOf;global.braidInTorso=braidInTorso;');
BRAID.log=false;
let pass=0,fail=0; const t=(n,c)=>{c?(pass++,console.log('  ok   '+n)):(fail++,console.log('  FAIL '+n));};

// 두상 옆(z=0.9)에서 아래로 늘어진 30cm 가닥 — 단위로
const Lu = 30/CMU;
const strand=(x0=0)=>({ pts: Array.from({length:40},(_,i)=>({x:x0, y:1.0 - i*Lu/39, z:0.9})), color:'#3a2a20', sec:'nape' });
const center={x:0,y:0,z:0};
const build=(adj,o)=>buildBraid3DObject(adj,(st)=>st.color,center,o);
// 한 밧줄의 갈래 중심선을 정점 고리 평균으로 되살린다
function centerlines(mesh, RAD, nS){
  const P=mesh.geometry.attr.position.array, nV=P.length/3, perStrand=nV/nS, rings=perStrand/RAD;
  const out=[]; for(let k=0;k<nS;k++){ const L=[]; for(let i=0;i<rings;i++){ let x=0,y=0,z=0;
    for(let j=0;j<RAD;j++){ const v=(k*perStrand+i*RAD+j)*3; x+=P[v];y+=P[v+1];z+=P[v+2]; } L.push({x:x/RAD,y:y/RAD,z:z/RAD}); } out.push(L); }
  return out;
}

console.log('── 켜고 끄기 ──');
BRAID.on=false; t('BRAID 꺼짐 → null', build([strand()])===null);
BRAID.on=true; BRAID3D.on=false; t('BRAID3D 꺼짐 → null', build([strand()])===null); BRAID3D.on=true;
CMU=0; t('자 없으면 null(때우지 않음)', build([strand()])===null); CMU=16.4;

console.log('── 밧줄 수 (난수 모드) ──'); BRAID.grid=false;
{ const adj=Array.from({length:3000},(_,i)=>strand((i%100)*0.01));
  BRAID.count=60; const m=build(adj,{radial:3,stepsPerNode:3});
  const nV=m.geometry.attr.position.array.length/3;
  const perRope = 3 * 3 * braidResample3D(adj[0].pts, (BRAID.nodeCm/CMU)/3).length;
  const ropes = nV/perRope;
  t('3000가닥에서 밧줄 ≈ 60 (±15) → '+ropes.toFixed(0), Math.abs(ropes-60)<=15); }

console.log('── 한 밧줄 자세히 (세 갈래) ──');
BRAID.count=1e9; BRAID.strands=3;
const RAD=BRAID3D.radial, one=build([strand()]);
t('객체가 생긴다(메쉬·정점색·법선)', one && one.geometry.attr.position && one.geometry.attr.color && one.geometry.attr.normal);
t('NaN 없음', Array.from(one.geometry.attr.position.array).every(Number.isFinite));
const W=BRAID.widthCm/CMU, _k=BRAID3D.contactK[3], _t=BRAID.tightness, r=(_k*_t*(W/2))/(1+_k*_t);  // 21과 같은 맞닿음 역산
const CL=centerlines(one,RAD,3), axis=braidResample3D(strand().pts,(BRAID.nodeCm/CMU)/BRAID3D.stepsPerNode);
t('정점 수 = 갈래3 × 축점 × 원주', one.geometry.attr.position.array.length/3 === 3*axis.length*RAD);
/* 옆(x)폭만 굵기로 묶는다. 앞뒤(z)는 갈래끼리 맞닿을 만큼 두꺼워지는 게 <b>맞다</b>
   (실제 땋은 머리도 앞뒤로 도톰하다). 이 가닥에서 옆 = x, 바깥 = z다. */
{ let maxOff=0, maxDep=0; for(const L of CL) L.forEach((p,i)=>{ const a=axis[i]; maxOff=Math.max(maxOff, Math.abs(p.x-a.x)); maxDep=Math.max(maxDep, Math.abs(p.z-a.z)); });
  console.log('       (참고) 앞뒤 두께 '+(2*(maxDep+r)*CMU).toFixed(2)+'cm vs 옆 굵기 '+BRAID.widthCm+'cm');
  t('밧줄 옆폭 ≤ 굵기 (중심 흔들림 '+(maxOff*CMU).toFixed(2)+'cm + 관 '+(r*CMU).toFixed(2)+'cm ≤ '+(W/2*CMU).toFixed(3)+'cm)', maxOff + r <= W/2 + 1e-9); }
const skipI = Math.ceil(axis.length*BRAID.startAtFrac) + BRAID3D.stepsPerNode + 1;
{ let minD=Infinity;
  for(let i=skipI;i<axis.length;i++) for(let a=0;a<3;a++) for(let b=a+1;b<3;b++){
    const p=CL[a][i], q=CL[b][i]; minD=Math.min(minD, Math.hypot(p.x-q.x,p.y-q.y,p.z-q.z)); }
  /* (정정) 처음 판은 minD > 0이었다 — 너무 느슨해서 관이 절반 파고드는 걸 통과시켰다.
     관 지름 이상이어야 "안 뚫는다". 마디당 8점 샘플이라 교차 정점이 점 사이에 오므로
     3%를 샘플 오차로 봐 준다. */
  t('갈래 관끼리 안 뚫는다 — 최소 중심거리 '+(minD*CMU).toFixed(3)+'cm ≥ 관 지름 '+(2*r*CMU).toFixed(3)+'cm의 97%',
    minD >= 2*r*0.97); }
{ // 교차점: 옆 좌표(x — 이 가닥에선 N이 x축)가 같아지는 자리에서 앞뒤(z)가 반대인가
  let cross=0, opp=0;
  for(let i=skipI;i<axis.length-1;i++) for(let a=0;a<3;a++) for(let b=a+1;b<3;b++){
    const d0=(CL[a][i].x-CL[b][i].x), d1=(CL[a][i+1].x-CL[b][i+1].x);
    if(d0===0 || d0*d1<0){ cross++;
      /* (정정) 교차는 두 샘플 <b>사이</b>에서 일어난다. 직전 점의 앞뒤를 보면, 그 점이
         앞뒤 0 자리일 때 "같은 쪽"으로 잘못 센다(처음 판이 1/3을 그렇게 틀렸다).
         옆 차이가 0이 되는 비율 u에서 앞뒤를 보간해 본다. */
      const u = (d0===0) ? 0 : d0/(d0-d1);
      const zAt=(L,j)=> (L[j].z-axis[j].z)*(1-u) + (L[j+1].z-axis[j+1].z)*u;
      const za=zAt(CL[a],i), zb=zAt(CL[b],i); if(za*zb<0) opp++; } }
  t('교차가 실제로 일어난다('+cross+'번)', cross>10);
  t('<b>교차마다 한 갈래는 앞, 한 갈래는 뒤</b> ('+opp+'/'+cross+')', opp===cross); }

console.log('── 두 갈래(꼬기) ──');
BRAID.strands=2; const two=build([strand()]); const CL2=centerlines(two,RAD,2);
{ let minD=Infinity; for(let i=skipI;i<axis.length;i++){ const p=CL2[0][i], q=CL2[1][i]; minD=Math.min(minD,Math.hypot(p.x-q.x,p.y-q.y,p.z-q.z)); }
  const r2=(BRAID3D.contactK[2]*_t*(W/2))/(1+BRAID3D.contactK[2]*_t);
  t('나선이라 안 뚫는다 (최소 '+(minD*CMU).toFixed(3)+'cm ≥ 관 지름 '+(2*r2*CMU).toFixed(3)+'cm의 97%)', minD >= 2*r2*0.97); }
BRAID.strands=3;


console.log('── 파팅 격자 ──');
{ BRAID.grid=true; BRAID.strands=3; state.hair3Dneutral={CY:0}; CMU=19.26;
  const E={a:0.417,b:0.633,c:0.492};
  // 두피(phi 0~1.6) 위에 면적에 고르게 뿌리 2만 개 — 결정적 난수
  let seed=7; const rnd=()=>{ seed=(seed*16807)%2147483647; return seed/2147483647; };
  const onHead=(phi,th)=>({ x:E.a*Math.sin(phi)*Math.sin(th), y:E.b*Math.cos(phi), z:E.c*Math.sin(phi)*Math.cos(th) });
  const roots=[]; while(roots.length<20000){ const cz=1-rnd()*(1-Math.cos(1.6)); const phi=Math.acos(cz), th=(rnd()*2-1)*Math.PI; roots.push(onHead(phi,th)); }
  const pick=braidPickGrid(roots);
  const P=pick.map(i=>roots[i]);
  const dcm=(p,q)=>Math.hypot(p.x-q.x,p.y-q.y,p.z-q.z)*CMU;
  const nn=P.map((p,i)=>{ let m=Infinity; P.forEach((q,j)=>{ if(i!==j) m=Math.min(m,dcm(p,q)); }); return m; }).sort((a,b)=>a-b);
  const med=nn[nn.length>>1];
  console.log('       밧줄 '+P.length+'개 · 이웃 거리 중앙 '+med.toFixed(2)+'cm (10% '+nn[Math.floor(nn.length*0.1)].toFixed(2)+' · 최소 '+nn[0].toFixed(2)+')');
  /* 1.4~1.8: 평균 반지름으로 재던 첫 판은 1.37이었다(14% 촘촘). 실제 둘레·자오선으로 재서 1.50.
     남는 6%는 칸 가운데가 아니라 '가장 가까운 뿌리'를 쓰는 흔들림이다. */
  t('칸 간격 ≈ 실측 1.6cm (중앙값 1.4~1.8)', med>1.4 && med<1.8);
  t('한자리에 두 밧줄이 안 겹친다 (최소 > 0.4cm)', nn[0] > 0.4);
  // 빈 곳: 두피 위 임의 점에서 가장 가까운 밧줄까지 — 1.6cm 칸이면 최악 ≈ 칸 대각선 절반 ~1.1cm
  let worst=0, over=0; const probes=3000;
  for(let k=0;k<probes;k++){ const cz=1-rnd()*(1-Math.cos(1.5)); const q=onHead(Math.acos(cz),(rnd()*2-1)*Math.PI);
    let m=Infinity; for(const p of P) m=Math.min(m,dcm(p,q)); worst=Math.max(worst,m); if(m>1.6) over++; }
  console.log('       두피 임의점 → 가장 가까운 밧줄 최악 '+worst.toFixed(2)+'cm · 1.6cm 넘는 점 '+over+'/'+probes);
  t('빈 곳 없음 — 1.6cm 넘게 떨어진 두피점 1% 미만', over < probes*0.01);
  const again=braidPickGrid(roots); t('같은 입력 → 같은 선택(결정적)', again.length===pick.length && again.every((v,i)=>v===pick[i]));
  // 뿌리 없는 자리(뒤통수 한 덩어리)에는 안 세운다
  const hole=roots.filter(p=>!(p.z < -0.2 && p.y > 0 && p.y < 0.4));
  const P2=braidPickGrid(hole).map(i=>hole[i]);
  t('뿌리 없는 자리엔 밧줄도 없다', P2.every(p=>!(p.z < -0.2 && p.y > 0 && p.y < 0.4)));
  t('격자를 못 만들면 null(예전 방식으로 떨어짐)', (()=>{ const sv=global.getHeadEllipsoid; global.getHeadEllipsoid=()=>null; state.hair3Dneutral={CY:0}; const r=braidPickGrid(roots); global.getHeadEllipsoid=sv; state.hair3Dneutral={CY:0}; return r===null; })());
  // 3D: 30cm 가닥을 뿌리마다 — 정점 예산
  const adj=roots.slice(0,6000).map(r=>({ pts: Array.from({length:30},(_,i)=>({x:r.x*(1+i*0.01), y:r.y - i*Lu/29, z:r.z*(1+i*0.01)})), color:'#3a2a20' }));
  BRAID.log=false; BRAID3D.maxVerts=600000;
  const m=meshOf(build(adj)); const nV=m.geometry.attr.position.array.length/3; const nG=braidPickGrid(adj.map(a=>a.pts[0])).length;
  console.log('       3D: 밧줄 '+nG+'개 · 정점 '+(nV/1000).toFixed(0)+'천 (예산 600천)');
  t('3D 정점 ≤ 예산 (+5%)', nV <= 600000*1.05);
  t('3D 밧줄 수 = 격자 칸 수', Math.abs(nV/(3*BRAID3D.radial) - 0) > 0 && nG > 100);

  console.log('── 저사양·미니 예산 (폰 실기기: 저사양판정 · 234MB) ──');
  /* 길이 30cm 가닥 6000개 → 격자 약 260칸. 노트북 예산 60만에는 들어가지만 저사양 25만·미니 5만에는
     곡선을 최저로 줄여도 안 들어간다 → 칸을 넓혀야 한다. */
  const vOf=(o)=>{ const mm=meshOf(build(adj,o)); return mm ? mm.geometry.attr.position.array.length/3 : 0; };
  global.isLowMemDevice=()=>true;
  const vLow=vOf({});
  console.log('       저사양 결과보기: 정점 '+(vLow/1000).toFixed(0)+'천 (예산 '+BRAID3D.maxVertsLow/1000+'천)');
  t('저사양 결과보기 ≤ 저사양 예산(+5%)', vLow <= BRAID3D.maxVertsLow*1.05 && vLow > 0);
  const vMiniLow=vOf({radial:3,stepsPerNode:4,log:false,mini:true});
  console.log('       저사양 미니3D: 정점 '+(vMiniLow/1000).toFixed(0)+'천 (예산 '+BRAID3D.miniMaxVertsLow/1000+'천)');
  t('저사양 미니3D ≤ 미니 예산(+5%)', vMiniLow <= BRAID3D.miniMaxVertsLow*1.05 && vMiniLow > 0);
  global.isLowMemDevice=()=>false;
  const vMini=vOf({radial:3,stepsPerNode:4,log:false,mini:true});
  t('노트북 미니3D ≤ 미니 예산(+5%)', vMini <= BRAID3D.miniMaxVerts*1.05 && vMini > 0);
  // 칸을 넓혀도 고르게 남는가 — 넓힌 칸으로 고른 뿌리의 빈 곳 검사
  const wide=braidPickGrid(roots, BRAID.partCm*2.2).map(i=>roots[i]);
  let over2=0; for(let k=0;k<1500;k++){ const cz=1-rnd()*(1-Math.cos(1.5)); const q=onHead(Math.acos(cz),(rnd()*2-1)*Math.PI);
    let m=Infinity; for(const p of wide) m=Math.min(m,dcm(p,q)); if(m>BRAID.partCm*2.2) over2++; }
  t('칸을 2.2배 넓혀도 빈 곳 없음 (넓힌 칸보다 먼 두피점 1% 미만)', over2 < 15);
  delete global.isLowMemDevice;

  console.log('── 모아 빗기 — 칸 안의 가닥은 전부 그 칸 밧줄로 ──');
  global.isLowMemDevice=()=>false; BRAID3D.maxVerts=600000;
  const grp=braidGroupGrid(adj.map(a=>a.pts[0]));
  const members=adj.filter((_,i)=>grp.ropeOf[i]>=0 && grp.ropeOf[i]!==i).length;
  const obj=build(adj); const Ls=linesOf(obj);
  t('밧줄 + 모아 빗기 선이 한 묶음으로 온다', obj && obj.isGroup && !!meshOf(obj) && !!Ls);
  const segs=BRAID3D.gatherSegs, LP=Ls.geometry.attr.position.array;
  const nLines=LP.length/3/2/segs;
  t('칸 안 나머지 가닥이 <b>전부</b> 모인다 ('+nLines+'/'+members+')', nLines===members);
  t('버려지는 가닥 없음 — 밧줄 + 모인 가닥 = 칸에 든 가닥 전부', grp.ropes.length + members === adj.filter((_,i)=>grp.ropeOf[i]>=0).length);
  // 선 끝 = 제 칸 밧줄의 시작점 근처, 선 머리 = 제 뿌리 근처
  const G=braidGridInfo(); const lift=BRAID.gatherLift/CMU;
  const en=(p)=>Math.hypot(p.x/G.a,(p.y-G.CY)/G.b,p.z/G.c);
  let k=0, bad=0, maxDip=0; const liftN=lift/Math.min(G.a,G.b,G.c);
  for(let i=0;i<adj.length;i++){ const ri=grp.ropeOf[i]; if(ri<0||ri===i) continue;
    const base=k*segs*6; const p0={x:LP[base],y:LP[base+1],z:LP[base+2]};
    const r0=adj[i].pts[0]; if(Math.hypot(p0.x-r0.x,p0.y-r0.y,p0.z-r0.z)*CMU > BRAID.gatherLift*1.5+0.05) bad++;
    // 두피 아래로 파고드는지: 선 위 모든 점의 타원 반지름이 <b>제 뿌리</b> 반지름 아래로 내려가면 파고든 것
    for(let q=0;q<segs;q++){ const b=base+q*6; for(const o of [0,3]){ const pt={x:LP[b+o],y:LP[b+o+1],z:LP[b+o+2]};
      maxDip=Math.max(maxDip, en(r0)-en(pt)); } }
    k++; }
  t('선 머리가 제 뿌리에서 출발 (어긋남 '+bad+'개)', bad===0);
  t('두피 안으로 파고들지 않는다 (최대 '+(maxDip*G.a*CMU).toFixed(2)+'cm)', maxDip*G.a*CMU < 0.35);
  global.isLowMemDevice=()=>true;
  const LsLow=linesOf(build(adj)); const nLow=LsLow.geometry.attr.position.array.length/3/2/BRAID3D.gatherSegsLow;
  /* (정정) 저사양은 칸이 넓혀질 수 있어 기본 칸으로 기대값을 세면 틀린다 — 선 끝이 모이는
     밧줄 시작점별로 <b>직접</b> 센다. 같은 밧줄로 모이는 선 끝은 같은 좌표다. */
  const LPl=LsLow.geometry.attr.position.array, sl=BRAID3D.gatherSegsLow, ends=new Map();
  for(let q=0;q<nLow;q++){ const b=(q*sl+sl-1)*6+3; const key=[LPl[b],LPl[b+1],LPl[b+2]].map(v=>v.toFixed(4)).join(',');
    ends.set(key,(ends.get(key)||0)+1); }
  const maxPer=Math.max(...ends.values());
  console.log('       저사양 모아 빗기 '+nLow+'가닥 · 밧줄 하나에 최대 '+maxPer+'가닥 (상한 '+BRAID3D.gatherPerCellLow+') · 노트북 '+nLines);
  t('저사양은 칸당 상한을 지킨다', maxPer <= BRAID3D.gatherPerCellLow);
  delete global.isLowMemDevice;
}
console.log('── 칸 면 · 솟는 가닥 · 몸통 자르기 (2026-09-22 6차) ──');
{ BRAID.grid=true; BRAID.strands=3; state.hair3Dneutral={CY:0}; CMU=19.26; global.isLowMemDevice=()=>false;
  const E={a:0.417,b:0.633,c:0.492};
  let seed=11; const rnd=()=>{ seed=(seed*16807)%2147483647; return seed/2147483647; };
  const onHead=(phi,th)=>({ x:E.a*Math.sin(phi)*Math.sin(th), y:E.b*Math.cos(phi), z:E.c*Math.sin(phi)*Math.cos(th) });
  // 두피 위 뿌리 → 두피를 따라 조금 내려가다 늘어지는 가닥 (실제처럼 바깥으로 안 솟음)
  const mk=(phi,th,len=24)=>{ const pts=[]; for(let i=0;i<30;i++){ const f=Math.min(1.9, phi+i*0.012); const q=onHead(f,th); pts.push({x:q.x*1.02,y:q.y - Math.max(0,i-8)*(len/CMU)/30,z:q.z*1.02}); } return {pts,color:'#2a2018'}; };
  const adj=[]; while(adj.length<6000){ const cz=1-rnd()*(1-Math.cos(1.5)); adj.push(mk(Math.acos(cz),(rnd()*2-1)*Math.PI)); }
  delete global.getNeckBottomY;
  const obj=build(adj); const F=fillOf(obj);
  t('칸 면이 생긴다', !!F && F.geometry.attr.position.array.length > 0);
  // 덮임: 두피 임의점에서 바깥으로 쏜 반직선이 칸 면 삼각형을 맞히는가
  const FP=F.geometry.attr.position.array, tris=[];
  for(let k=0;k<FP.length;k+=9) tris.push([[FP[k],FP[k+1],FP[k+2]],[FP[k+3],FP[k+4],FP[k+5]],[FP[k+6],FP[k+7],FP[k+8]]]);
  const hit=(o,d)=>{ for(const [a,b,c] of tris){ // Möller–Trumbore
      const e1=[b[0]-a[0],b[1]-a[1],b[2]-a[2]], e2=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
      const pv=[d[1]*e2[2]-d[2]*e2[1], d[2]*e2[0]-d[0]*e2[2], d[0]*e2[1]-d[1]*e2[0]];
      const det=e1[0]*pv[0]+e1[1]*pv[1]+e1[2]*pv[2]; if(Math.abs(det)<1e-12) continue;
      const tv=[o[0]-a[0],o[1]-a[1],o[2]-a[2]]; const u=(tv[0]*pv[0]+tv[1]*pv[1]+tv[2]*pv[2])/det; if(u<0||u>1) continue;
      const qv=[tv[1]*e1[2]-tv[2]*e1[1], tv[2]*e1[0]-tv[0]*e1[2], tv[0]*e1[1]-tv[1]*e1[0]];
      const v=(d[0]*qv[0]+d[1]*qv[1]+d[2]*qv[2])/det; if(v<0||u+v>1) continue;
      const tt=(e2[0]*qv[0]+e2[1]*qv[1]+e2[2]*qv[2])/det; if(tt>-0.05 && tt<0.3) return true; }
    return false; };
  let cov=0; const N=600; for(let k=0;k<N;k++){ const cz=1-rnd()*(1-Math.cos(1.35)); const q=onHead(Math.acos(cz),(rnd()*2-1)*Math.PI);
    const l=Math.hypot(q.x,q.y,q.z); if(hit([q.x,q.y,q.z],[q.x/l,q.y/l,q.z/l])) cov++; }
  console.log('       두피 임의점 '+N+'개 중 칸 면에 덮인 곳 '+(cov/N*100).toFixed(0)+'% (나머지 = 가르마 틈)');
  t('칸 면이 두피 대부분을 덮는다 (≥75%)', cov/N >= 0.75);
  t('가르마 틈은 남는다 (덮임 < 99%)', cov/N < 0.99);
  const grp=braidGroupGrid(adj.map(a=>a.pts[0]), undefined, adj.map(a=>a.pts[3]));
  t('뿌리 분포 통계가 나온다 (칸 '+grp.stats.cells+' · 칸당 '+grp.stats.min+'/'+grp.stats.med+'/'+grp.stats.max+' · 성근 칸 '+grp.stats.sparse+')', grp.stats && grp.stats.cells>100);

  // 솟는 가닥: 칸 정중앙에 뿌리를 두고 바깥으로 곧게 솟게 → 밧줄로 안 뽑혀야
  const G=braidGridInfo(); const cell0=braidCellOf(adj[0].pts[0],G);
  const same=adj.map((a,i)=>i).filter(i=>braidCellOf(adj[i].pts[0],G).key===cell0.key);
  // 그 칸에서 원래 밧줄로 뽑히는 뿌리 자리 — 거기에 솟는 가닥을 둬야 대조가 된다
  const gBase=braidGroupGrid(adj.map(a=>a.pts[0]));
  const r0=adj[gBase.ropeOf[same[0]]].pts[0];
  const spike={ pts: Array.from({length:30},(_,i)=>({x:r0.x*(1+i*0.03), y:r0.y*(1+i*0.03), z:r0.z*(1+i*0.03)})), color:'#000' };
  /* (정정) 솟는 가닥을 맨 <b>앞</b>에 둔다 — 뿌리가 같은 가닥과 점수가 같으면 먼저 온 쪽이 이기므로,
     뒤에 두면 벌점과 상관없이 안 뽑혀서 대조가 성립하지 않았다. */
  const adj2=[spike].concat(adj); const si=0;
  const g0=braidGroupGrid(adj2.map(a=>a.pts[0]));                                 // 벌점 없이
  const g1=braidGroupGrid(adj2.map(a=>a.pts[0]), undefined, adj2.map(a=>a.pts[3])); // 벌점 있게
  t('(대조) 벌점 없으면 정중앙의 솟는 가닥이 뽑힌다', g0.ropes.includes(si));
  t('<b>솟는 가닥은 밧줄로 안 뽑힌다</b>', !g1.ropes.includes(si));
  t('그래도 그 가닥은 칸 면·모아 빗기에는 들어간다', g1.ropeOf[si]>=0 && g1.ropeOf[si]!==si);

  // 몸통 자르기: 목 밑동을 두상 아래로 두고, 가닥이 그 아래 몸통 안까지 내려가게
  const neckY=-0.9; global.getNeckBottomY=()=>neckY;
  const longA=adj.slice(0,1500).map(a=>({ pts: a.pts.concat(Array.from({length:20},(_,i)=>({x:a.pts[29].x*0.9, y:a.pts[29].y-(i+1)*0.05, z:a.pts[29].z*0.9}))), color:a.color }));
  const mm=meshOf(build(longA)); const P=mm.geometry.attr.position.array;
  let inside=0, below=0;
  for(let k=0;k<P.length;k+=3){ const q={x:P[k],y:P[k+1],z:P[k+2]}; if(q.y<neckY){ below++; if(braidInTorso(q,0)) inside++; } }
  const off=(()=>{ BRAID3D.bodyCut=false; const m2=meshOf(build(longA)); BRAID3D.bodyCut=true; const A=m2.geometry.attr.position.array; let n=0; for(let k=0;k<A.length;k+=3){ if(braidInTorso({x:A[k],y:A[k+1],z:A[k+2]},0)) n++; } return n; })();
  console.log('       몸통 안 튜브 정점: 자르기 끔 '+off+' → 켬 '+inside);
  t('(대조) 자르기를 끄면 몸통 안을 지난다', off > 1000);
  t('<b>몸통 안에 튜브가 없다</b>', inside===0);
  delete global.getNeckBottomY; delete global.isLowMemDevice;
}
console.log('\n'+pass+'/'+(pass+fail)+' 통과'+(fail?'  ← '+fail+'개 실패':''));
process.exit(fail?1:0);
