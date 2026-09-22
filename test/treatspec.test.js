/* 시술 스펙(25-treatment-spec.js) 하네스 — 2026-09-22. 실행: node test/treatspec.test.js
   측정 함수(16의 measureSectionTipY/LenCm)는 가짜로 둔다 — 여기서 보는 건 <b>번역</b>이다:
   끝 높이 → "눈썹 위 1cm", 슬라이더 → 자르는 양, 좌우 차, 더 길게는 안 된다는 경고. */
const fs=require('fs'), path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','js','25-treatment-spec.js'),'utf8');
let pass=0,fail=0; const t=(n,c)=>{c?(pass++,console.log('  ok   '+n)):(fail++,console.log('  FAIL '+n));};

// ── 가짜 세상: 모델 1단위 = 20cm, 얼굴 기준점은 모델 높이로 곧장(toMeshY = 1 − v)
const CMU=20;
global.document={ readyState:'complete', getElementById:()=>null, querySelector:()=>null,
  createElement:()=>({style:{},appendChild(){}}), head:{appendChild(){}}, body:{appendChild(){}} };
global.modelCmPerUnit=()=>CMU;
const LM={ foreheadY:0.20, browTopY:0.30, eyeY:0.35, chinY:0.70, features:{ mouth:{minY:0.58,maxY:0.62} } };
global.getFaceMetrics=()=>({ lm:LM, projector:{ toMeshY:(v)=>1-v } });
global.getNeckBottomY=()=>1-0.85;                       // 어깨 = 모델 0.15
global.SECTION_ORDER=['front','side','nape'];
global.SECTIONS={ front:{label:'프론트',defaults:{length:50}}, side:{label:'사이드',defaults:{length:50}}, nape:{label:'네이프',defaults:{length:50}} };
global.TECHNIQUES={ onelength:{label:'원랭스'}, graduation:{label:'그라데이션'} };
global.GYEOL_STYLING_PARAMS=[{key:'sweep',label:'넘김',min:-100,max:100,left:'앞으로',right:'뒤로',neutral:0},
                             {key:'volume',label:'뿌리 볼륨',min:0,max:100,left:'눌러줌',right:'세움',neutral:50}];
global.guardMm=(g)=>g*3;
global.state={ hair3Dneutral:{strands:[1]}, sections:{
  front:{length:30, technique:'onelength', elevation:0},
  side:{length:50, technique:'graduation', elevation:45},
  nape:{length:70} }, styling:{sweep:72, volume:52}, fade:{enabled:true,guard:2,height:65,taper:80,disc:0}, _globalCurl:0 };
// 가짜 측정: 길이 = 슬라이더×0.4cm, 끝 높이는 섹션·뷰별로 정해 둔다
const TIP={ front:{'*':1-0.30+0.05}, side:{'*':1-0.70, left:1-0.70, right:1-0.70-0.10}, nape:{'*':1-0.85-0.30} };
global.measureSectionLenCm=(id,v)=>v*0.4;
global.measureSectionTipY=(id,v,view)=>TIP[id][view||'*'];
eval(src+';global.treatTipWords=treatTipWords;global.treatFaceLadder=treatFaceLadder;global.buildTreatmentSpec=buildTreatmentSpec;global.treatmentSpecHTML=treatmentSpecHTML;global.TREAT_SPEC=TREAT_SPEC;');

console.log('── 끝 높이 → 얼굴 기준 말 ──');
const L=treatFaceLadder();
t('기준점 7개(헤어라인·눈썹·눈·입·턱·어깨·가슴)', L.length===7 && L.map(x=>x.name).join(',')==='헤어라인,눈썹,눈,입,턱,어깨,가슴');
t('위에서 아래 순서', L.every((x,i)=>i===0||L[i-1].y>=x.y));
t('눈썹보다 1cm 위 → "눈썹 위 1.0cm"', treatTipWords(L[1].y+1/CMU, L, CMU)==='눈썹 위 1.0cm');
t('턱 딱 거기 → "턱선"', treatTipWords(L[4].y+0.3/CMU, L, CMU)==='턱선');
t('어깨 3cm 아래 → "어깨 아래 3.0cm"', treatTipWords(L[5].y-3/CMU, L, CMU)==='어깨 아래 3.0cm');
t('두 기준점 한가운데면 아래쪽 기준("○○ 위")', treatTipWords((L[0].y+L[1].y)/2, L, CMU).startsWith('눈썹 위'));
t('가슴은 추정이라고 적는다', /가슴\(추정\)/.test(treatTipWords(L[6].y, L, CMU)));
t('기준점이 없으면 null(지어내지 않음)', treatTipWords(0.5, null, CMU)===null);

console.log('── 섹션 줄 ──');
const S=buildTreatmentSpec();
const R=Object.fromEntries(S.rows.map(r=>[r.id,r]));
t('프론트: 끝 = 눈썹 위 1.0cm (끝 높이 가짜값 그대로 번역)', R.front.tip==='눈썹 위 1.0cm');
t('프론트: 지금 20cm → 목표 12cm → 8cm 자름', Math.abs(R.front.nowCm-20)<1e-9 && Math.abs(R.front.goalCm-12)<1e-9 && Math.abs(R.front.cutCm-8)<1e-9);
t('기법은 참고로 라벨 그대로(원랭스 · 0°)', R.front.tech==='원랭스' && R.front.elev===0);
/* (정정) 우측 끝(모델 0.20)은 턱(0.30)보다 어깨(0.15)에 가깝다 — "어깨 위 1cm"가 맞는 번역이다. */
t('사이드: 좌우 끝이 2cm 다르면 좌/우를 따로', R.side.lr && R.side.lr.left==='턱선' && R.side.lr.right==='어깨 위 1.0cm');
t('네이프: 슬라이더가 기본보다 길면 자르는 양이 음수', R.nape.cutCm < 0);
const H=treatmentSpecHTML(S);
t('더 길게는 안 된다고 적는다(익스텐션 별도)', /지금보다 길게는 안 됩니다/.test(H));
t('스타일링은 기본에서 벗어난 것만 — 넘김 뒤로 72% (볼륨 52는 안 적음)', /넘김 — 뒤로 72%/.test(H) && !/뿌리 볼륨/.test(H));
t('페이드 가드를 mm로', /가드 2 \(6\.0mm\)/.test(H));
t('앱이 모르는 것을 적는다', /앱이 모르는 것/.test(H));
t('컬 0이면 펌 칸을 안 만든다', !/컬 세기/.test(H));
state._globalCurl=40; t('컬이 있으면 펌 칸', /컬 세기 40/.test(treatmentSpecHTML(buildTreatmentSpec()))); state._globalCurl=0;
global.BRAID={on:true,partCm:1.6,widthCm:0.85,strands:3};
t('땋기가 켜져 있으면 파팅·굵기를 적는다', /3갈래 땋기 · 파팅 칸 1\.6cm · 가닥 굵기 0\.85cm/.test(treatmentSpecHTML(buildTreatmentSpec())));
delete global.BRAID;
state.hair3Dneutral=null; t('3D 모델이 없으면 null', buildTreatmentSpec()===null); state.hair3Dneutral={strands:[1]};
global.getFaceMetrics=()=>{ throw new Error('no face'); };
const S2=buildTreatmentSpec();
t('얼굴을 못 찾으면 cm만 — 경고 문구', S2 && !S2.ladderOk && /얼굴 기준 길이를 못 적습니다/.test(treatmentSpecHTML(S2)));
t('얼굴 없을 때 끝 말은 비운다(지어내지 않음)', S2.rows.every(r=>r.tip===null));

console.log('\n'+pass+'/'+(pass+fail)+' 통과'+(fail?'  ← '+fail+'개 실패':''));
process.exit(fail?1:0);
