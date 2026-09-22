/* 3D 다발 모으기(26-hair-clump.js) 하네스 — 2026-09-22. 실행: node test/clump.test.js */
const fs=require('fs'), path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','js','26-hair-clump.js'),'utf8');
let pass=0,fail=0; const t=(n,c)=>{c?(pass++,console.log('  ok   '+n)):(fail++,console.log('  FAIL '+n));};
const CMU=19.3; global.modelCmPerUnit=()=>CMU;
eval(src+';global.HAIR_CLUMP3D=HAIR_CLUMP3D;global.clumpStrands3D=clumpStrands3D;global._clumpArc=_clumpArc;global._clumpAt=_clumpAt;');
HAIR_CLUMP3D.log=false;

// 두피 위 뿌리 4000개(정수리 반구) + 가닥마다 제멋대로 흔들리는 웨이브 25cm — 결정적 난수
let seed=5; const rnd=()=>{ seed=(seed*16807)%2147483647; return seed/2147483647; };
const adj=[];
for(let n=0;n<4000;n++){
  const phi=Math.acos(1-rnd()*0.8), th=(rnd()*2-1)*Math.PI, R=0.45;
  const r={x:R*Math.sin(phi)*Math.sin(th), y:R*Math.cos(phi), z:R*Math.sin(phi)*Math.cos(th)};
  const ph=rnd()*6.28, amp=(0.4+rnd()*0.4)/CMU, L=(20+rnd()*10)/CMU;   // 가닥마다 위상·진폭·길이 다름
  const pts=[]; for(let i=0;i<40;i++){ const s=i/39*L; pts.push({x:r.x+amp*Math.sin(s*CMU/2.5+ph)*Math.min(1,s*CMU/3), y:r.y-s, z:r.z*1.02}); }
  adj.push({pts, color:'#221a14'});
}
const snap=JSON.stringify(adj.slice(0,50));
const out=clumpStrands3D(adj);

console.log('── 기본 ──');
t('새 배열을 돌려준다(원본 배열 아님)', out!==adj && out.length===adj.length);
t('원본 가닥은 한 점도 안 바뀐다(조정 캐시 보호)', JSON.stringify(adj.slice(0,50))===snap);
t('NaN 없음', out.every(s=>s.pts.every(p=>isFinite(p.x)&&isFinite(p.y)&&isFinite(p.z))));
t('뿌리는 그대로(두피에서 안 뜬다)', out.every((s,i)=>s.pts[0].x===adj[i].pts[0].x && s.pts[0].y===adj[i].pts[0].y && s.pts[0].z===adj[i].pts[0].z));

// 다발 재구성(모듈과 같은 칸 규칙)으로 대표를 찾아, 가닥 가운데(12cm)에서 대표까지 거리 전/후
const cell=HAIR_CLUMP3D.cellCm/CMU, groups=new Map();
adj.forEach((s,i)=>{ const r=s.pts[0]; const k=[r.x,r.y,r.z].map(v=>Math.floor(v/cell)).join(','); (groups.get(k)||groups.set(k,[]).get(k)).push(i); });
let before=0, after=0, n=0, lenRatioMax=0, tailBack=0, tailN=0;
for(const [key,g] of groups){ if(g.length<2) continue;
  const kk=key.split(',').map(Number), c=kk.map(v=>(v+0.5)*cell);
  let lead=g[0],bd=1e9; for(const i of g){ const r=adj[i].pts[0]; const d=(r.x-c[0])**2+(r.y-c[1])**2+(r.z-c[2])**2; if(d<bd){bd=d;lead=i;} }
  const LP=adj[lead].pts, LS=_clumpArc(LP);
  for(const i of g){ if(i===lead) continue;
    const S0=_clumpArc(adj[i].pts), S1=_clumpArc(out[i].pts), s=12/CMU;
    if(s>S0[S0.length-1]||s>LS[LS.length-1]) continue;
    const q=_clumpAt(LP,LS,s), a=_clumpAt(adj[i].pts,S0,s), b=_clumpAt(out[i].pts,S0,s);   // 같은 점 번호 자리
    before+=Math.hypot(a.x-q.x,a.y-q.y,a.z-q.z); after+=Math.hypot(b.x-q.x,b.y-q.y,b.z-q.z); n++;
    lenRatioMax=Math.max(lenRatioMax, Math.abs(S1[S1.length-1]/S0[S0.length-1]-1));
    // 대표보다 tailCm 넘게 긴 가닥: 끝점이 제 자리로 돌아왔나
    if(S0[S0.length-1] > LS[LS.length-1] + (HAIR_CLUMP3D.tailCm+0.5)/CMU){ const e0=adj[i].pts.at(-1), e1=out[i].pts.at(-1); tailN++; if(Math.hypot(e0.x-e1.x,e0.y-e1.y,e0.z-e1.z)<1e-9) tailBack++; }
  } }
const ratio=after/before;
console.log('       다발 안 가닥 '+n+'개 · 12cm 지점 대표까지 평균 '+(before/n*CMU).toFixed(2)+'cm → '+(after/n*CMU).toFixed(2)+'cm (×'+ratio.toFixed(2)+')');
t('다발로 모인다 — 대표까지 거리가 (1 − pull) 배 근처(0.25~0.35)', ratio>0.25 && ratio<0.35);
t('완전히 한 줄로 합치지 않는다(거리 > 0)', after>0);
t('가닥 길이 변화 최대 '+(lenRatioMax*100).toFixed(1)+'% (< 15%)', lenRatioMax<0.15);
t('대표보다 긴 가닥 끝은 제 길로 돌아간다 ('+tailBack+'/'+tailN+')', tailN>0 && tailBack===tailN);
HAIR_CLUMP3D.on=false; t('끄면 원본 배열 그대로', clumpStrands3D(adj)===adj); HAIR_CLUMP3D.on=true;
global.modelCmPerUnit=()=>null; t('자를 못 만들면 원본 그대로(때우지 않음)', clumpStrands3D(adj)===adj);

console.log('\n'+pass+'/'+(pass+fail)+' 통과'+(fail?'  ← '+fail+'개 실패':''));
process.exit(fail?1:0);
