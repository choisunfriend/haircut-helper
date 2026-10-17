/* ══════════════════════════════════════════════════════════
   09-strand-dye.js — 가닥 경로 추적 · 라인 정돈 · 가닥 성질/색 · 염색 LUT
   원본 index.html 12904~13785행. 클래식 스크립트이므로 로드 순서가 곧
   실행 순서다 — index.html의 <script src> 순서를 바꾸지 말 것.
   ══════════════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════════════════════
   STRAND TRACING — 결 필드를 따라가는 가닥 경로 생성
   traceStrandPath: 뿌리에서 출발해 결방향(orientation field)을 따라 전진하며
   경로를 만든다. 결이 약한 구간은 중력으로 대체하고, 마스크 이탈점과 결 불연속
   (겹 끝)을 실측해 기록한다. 스타일링은 여기 없다 — 3D 연산자 전담.
   ════════════════════════════════════════════════════════════════ */
  /**
   * traceStrand: 시작점(ix,sy_img)에서 목표 길이(targetLen)만큼
   * 결방향 필드를 따라 작은 스텝으로 전진하며 경로를 추적한다.
   * 결방향 데이터가 없거나 coherence가 낮은 구간에서는 자연스러운
   * 약한 흔들림(curlAmt 기반)으로 보강하여 완전히 끊기지 않게 한다.
   * @returns canvas 좌표계 점 배열 [{x,y}, ...] (길이 steps+1, steps는 목표 길이에 따라 가변)
   * Canvas API를 쓰지 않고 좌표 배열만 반환하는 순수 함수라(ctx 인자가
   * 아예 없음) drawHairStrands에서 분리해도 Node에서 독립 검증 가능함 —
   * env는 호출부(drawHairStrands)가 한 번만 만들어 넘겨주는 고정값 묶음.
   */
// ── (7차) 결 불연속 종결 튜닝 상수 ──
// 겹층 커트에서 "위 겹이 끝나는 선(헴)"은 사진의 결 필드에 방향 급변/신뢰도
// 급락으로 남는다. 추적 중 그 증거를 점수로 누적해 임계(가닥별 랜덤 스태거)를
// 넘으면 실측 겹 끝으로 종결 — 관통 가닥(꼭대기 뿌리→마스크 끝 한 가닥) 문제의
// 실측 기반 해법. 긴 생머리는 결이 연속이라 점수가 안 쌓여 안 끊김.
const FLOW_DISC = {
  dirJump: 0.7,   // 방향 급변 판정(rad, ≈40°) — 웨이브의 완만한 회전은 미달
  dipRatio: 0.45, // 신뢰도 급락 판정: 현재 신뢰도 < EMA×이 비율
  dipMin: 0.2,    // EMA가 이보다 강했을 때만 "급락"으로 침(원래 약한 결은 무시)
  // 하네스 튜닝(겹 헴 폭이 2~3스텝으로 짧은 케이스): 급락 2회면 대부분 임계 도달,
  // 1회 단독(고립 노이즈)으론 미달하도록 — wDip×2 > thrMin+thrSpan, wDip < thrMin.
  wDir: 0.6, wDip: 0.65, // 이벤트당 점수
  thrMin: 0.75, thrSpan: 0.55, // 가닥별 임계 = thrMin + rand×thrSpan (끝선 스태거)
};
var _trCtx = null, _trSample = null;
var _trImports = {
  sin: Math.sin, cos: Math.cos, atan2: Math.atan2,
  rnd: function () { return Math.random(); },
  oriSample: function (x, y) {
    var e = _trCtx; _trSample = sampleOrientation(e.orientation, x, e.orientMaskW, y);
    return _trSample ? +_trSample.coherence : NaN;
  },
  oriAngle: function () { return _trSample ? +_trSample.angle : NaN; },
  oriFx: function () { return _trSample ? +_trSample.fx : NaN; },
  oriFy: function () { return _trSample ? +_trSample.fy : NaN; },
  oriFc: function () { return _trSample ? +_trSample.fc : NaN; },
  pol: function (ang) { return flowPolarityFor(ang, _trSample) | 0; },
  maskAt: function (x, y) { return _trCtx.maskAt(x, y) ? 1 : 0; },
  hyp3: Math.hypot
};

/* 슬라이스 합의 컷 — 가닥별 확정 점 수. 계산은 core.wasm */
function _spSliceLens(pending, maskW, maskH, stepLen, maxLen, textureFor){
  const n = pending.length, out = new Array(n);
  const C = window.__SPCORE, X = C && C.ready ? C.x : null;
  if(!X || n > X.sliceMax()){ for(let i=0;i<n;i++) out[i] = pending[i].probe.length; return out; }
  const secId = new Map(); let sid = 0;
  const I = new Float64Array(X.memory.buffer, X.sliceInPtr(), n * 9);
  for(let i=0, o=0; i<n; i++, o+=9){
    const p = pending[i];
    let k = secId.get(p.rootSec); if(k === undefined){ k = sid++; secId.set(p.rootSec, k); }
    I[o]=k; I[o+1]=p.rootX; I[o+2]=p.rootNy; I[o+3]=p.hemIdx; I[o+4]=p.ratio; I[o+5]=p.layerDelta;
    I[o+6]=p.strandMult; I[o+7]=textureFor(p.ix, p.rootSec); I[o+8]=p.probe.length;
  }
  const r = X.sliceLens(n, maskW, maskH, stepLen, maxLen);
  if(r < 0){ for(let i=0;i<n;i++) out[i] = pending[i].probe.length; return out; }
  const O = new Int32Array(X.memory.buffer, X.sliceOutPtr(), n);
  for(let i=0;i<n;i++) out[i] = O[i];
  return out;
}

function traceStrandPath(ix, sy_img, targetLen_img, jitterSeed, env, rootSec, stopAtExit){
  const C = window.__SPCORE, X = C && C.ready ? C.x : null;
  const { hasOrientation, orientation, orientMaskW, ox, oy, STRAND_STEP_LEN, frontDirBiasFor, curlAmtFor, waveWidthFor, maskAt } = env;
  const frontBias = frontDirBiasFor(ix, rootSec);
  const curlAmt = curlAmtFor(ix, rootSec);
  const waveT = (waveWidthFor(ix, rootSec)) / 100;
  if(!X){
    /* core 준비 전(페이지 열자마자 몇백 ms) — 곧게 내린 경로만. 실제 촬영 분석은 이보다 한참 뒤다. */
    const steps = Math.max(2, Math.round(targetLen_img / STRAND_STEP_LEN)), pts = [];
    for(let s=0; s<=steps; s++) pts.push({ x: ix, y: sy_img + s * STRAND_STEP_LEN });
    pts.maskExitIdx = pts.length - 1; pts.flowEndIdx = null;
    return pts;
  }
  const thr = FLOW_DISC.thrMin + hashFract((jitterSeed + ix) * 12.9898) * FLOW_DISC.thrSpan;
  _trCtx = { orientation, orientMaskW, maskAt }; _trSample = null;
  let n;
  try{
    n = X.trace(ix, sy_img, targetLen_img, jitterSeed, STRAND_STEP_LEN, frontBias, curlAmt, waveT,
      hasOrientation ? 1 : 0, (HAIR_FLOW.on && HAIR_FLOW.applyTo2D) ? 1 : 0, HAIR_FLOW.minConf, HAIR_FLOW.maxTurn2D,
      maskAt ? 1 : 0, stopAtExit ? 1 : 0, thr,
      FLOW_DISC.dirJump, FLOW_DISC.dipRatio, FLOW_DISC.dipMin, FLOW_DISC.wDir, FLOW_DISC.wDip, ox, oy);
  } finally { _trCtx = null; _trSample = null; }
  if(n < 0){ const pts = [{x:ix, y:sy_img}]; pts.maskExitIdx = 0; pts.flowEndIdx = null; return pts; }
  const B = new Float64Array(X.memory.buffer, X.tracePtr(), n * 2), pts = new Array(n);
  for(let i=0, q=0; i<n; i++, q+=2) pts[i] = { x: B[q], y: B[q+1] };
  if(env.flowAcc){ env.flowAcc.n += X.traceAccN(); env.flowAcc.byFlow += X.traceAccFlow(); }
  pts.maskExitIdx = X.traceExitIdx();
  const fe = X.traceFlowEndIdx();
  pts.flowEndIdx = fe >= 0 ? fe : null;
  return pts;
}

/* ════════════════════════════════════════
   LINE CLEANUP (정돈층) — 1D 라인 정돈 단일 출처 (설계문서 §6)
   대상: hairEndY/scalpY 처럼 "컬럼(x)별 y픽셀"인 1D 라인(-1 = 결측).
   기존에 STEP10(computeScalpAndEndLines)과 가닥뿌리 보간 두 곳에 forward/
   backward 보간이 복제돼 있던 것을 여기로 흡수(단일 출처, 복제 금지).
   ⚠ 좌표계 경계: 이 헬퍼는 1D 라인 전용이다. 목/두상 밴드(phi·frac별 반경
     배열: fillBandsWithNearestNeighbor / NECK_STEP_MAX)와 두상 세로반경
     5퍼센타일 픽은 좌표계·자료구조·목적이 달라 여기로 묶지 않는다. 겉보기만
     "라인 정돈"이라고 억지로 합치는 것은 colorForSection 통합 실수의 재현이다
     (2단계 클램프는 NECK_STEP_MAX의 "개념"만 계승하고 코드는 공유 안 함).
   4단계(설계문서): ①빈곳 보간 ②이상치 클램프 ③스무딩 ④(약)대칭.
════════════════════════════════════════ */
// ① 빈 곳 보간: -1 열을 인접 유효값으로 forward/backward 채움.
//    (기존 두 곳의 보간 loop과 값이 완전히 동일함을 Node 교차검증으로 확인.)
function fillLine1D(arr){
  const n = arr.length;
  let last = -1;
  for(let i=0;i<n;i++){ if(arr[i]>=0) last=arr[i]; else if(last>=0) arr[i]=last; }
  let first = -1;
  for(let i=n-1;i>=0;i--){ if(arr[i]>=0) first=arr[i]; else if(first>=0) arr[i]=first; }
  return arr;
}
// ② 이상치 클램프: 좌우 window 이웃 median 대비 maxDev 이상 튀면 눌러줌.
//    median 기반이라 스파이크 하나에 안 휩쓸림. maxDev는 유효값 (p90-p10)*k로
//    자동 스케일(해상도별 하드코딩 픽셀값 회피). 유효값<5면 손대지 않음(보수적).
function clampLineOutliers1D(arr, opts){
  const win = (opts&&opts.window)||3;
  const k   = (opts&&opts.k)||0.35;
  const n = arr.length;
  const valid = [];
  for(let i=0;i<n;i++) if(arr[i]>=0) valid.push(arr[i]);
  if(valid.length < 5) return arr;
  const sorted = valid.slice().sort((a,b)=>a-b);
  const p10 = sorted[Math.floor(sorted.length*0.10)];
  const p90 = sorted[Math.floor(sorted.length*0.90)];
  const maxDev = Math.max(1e-6, (p90 - p10) * k);
  const out = arr.slice();
  const w = [];
  for(let i=0;i<n;i++){
    if(arr[i]<0) continue;
    w.length=0;
    for(let j=Math.max(0,i-win); j<=Math.min(n-1,i+win); j++){
      if(j!==i && arr[j]>=0) w.push(arr[j]);
    }
    if(w.length<2) continue;
    w.sort((a,b)=>a-b);
    const med = w[Math.floor(w.length/2)];
    const dev = arr[i]-med;
    if(dev >  maxDev) out[i] = med + maxDev;
    else if(dev < -maxDev) out[i] = med - maxDev;
  }
  for(let i=0;i<n;i++) arr[i]=out[i];
  return arr;
}
// ③ 스무딩: 유효값 구간 가우시안 가중 이동평균(결측 -1은 제외해 경계로 안 끌어들임).
//    선형 구간은 편향 없이 보존됨(Node 검증).
function smoothLine1D(arr, opts){
  const radius = (opts&&opts.radius)||2;
  const n = arr.length;
  const sigma = Math.max(0.5, radius/2);
  const wts = [];
  for(let d=-radius; d<=radius; d++) wts.push(Math.exp(-(d*d)/(2*sigma*sigma)));
  const out = arr.slice();
  for(let i=0;i<n;i++){
    if(arr[i]<0) continue;
    let acc=0, wsum=0;
    for(let d=-radius; d<=radius; d++){
      const j=i+d; if(j<0||j>=n) continue;
      if(arr[j]<0) continue;
      const wt=wts[d+radius]; acc+=arr[j]*wt; wsum+=wt;
    }
    if(wsum>0) out[i]=acc/wsum;
  }
  for(let i=0;i<n;i++) arr[i]=out[i];
  return arr;
}
// ④ 좌우 대칭 보정(약): 대칭 뷰에서 한쪽만 튀면 반대쪽 미러값과 약하게 평균.
//    개성 뭉갤 위험 커서 기본 비활성(blend=0). MVP 단계 호출부에선 켜지 않는다.
function symmetrize1D(arr, opts){
  const blend = (opts&&opts.blend)||0;
  if(blend<=0) return arr;
  const n=arr.length;
  const out=arr.slice();
  for(let i=0;i<n;i++){
    const m=n-1-i;
    if(arr[i]>=0 && arr[m]>=0) out[i]=arr[i]*(1-blend)+arr[m]*blend;
  }
  for(let i=0;i<n;i++) arr[i]=out[i];
  return arr;
}
// 편의 래퍼: 4단계 파이프라인. opts로 단계 on/off(기본 fill+clamp+smooth, 대칭 off).
//   예) cleanupLine1D(arr)                       → 보간+클램프+스무딩
//       cleanupLine1D(arr,{clamp:false,smooth:false}) → 보간만(기존 동작과 동일)
function cleanupLine1D(arr, opts){
  opts = opts || {};
  if(opts.fill  !== false) fillLine1D(arr);
  if(opts.clamp !== false) clampLineOutliers1D(arr, opts.clampOpts);
  if(opts.smooth!== false) smoothLine1D(arr, opts.smoothOpts);
  if(opts.symmetryBlend) symmetrize1D(arr, {blend:opts.symmetryBlend});
  return arr;
}

/* ══════════════════════════════════════════════════════════════════
   가닥 성질 — <b>단일 출처</b> (2026-08-02)
   ─────────────────────────────────────────────────────────────────
   사용자: "원본 결 보기의 헤어가닥으로 통일해줘 — 레이어 개별 가닥 ~2000개,
            그거 말하는 거야."
   두 화면이 <b>같은 3D 가닥을 다른 규칙으로</b> 그리고 있었다:
     · 원본 결 보기(drawHairStrands) — 굵기·개수·틴트가 다른 4레이어를 겹쳐
       가닥 <b>하나당 선 하나</b>로 ~2,830개.
     · 스타일 적용 후(projectHair3DToView) — 가닥 하나를 <b>다발</b>(서브라인 4개,
       폭 고정 0.7 CSS px)로 그려 1,400다발. 기하는 같은데 그리는 규칙이 달라
       가닥 성질(굵기·밀도·명암 분포)이 서로 달라 보였다.
   고침: 가닥 성질을 여기 <b>한 곳</b>에 두고 두 경로가 같이 읽는다.
   값은 지금까지 drawHairStrands 안에 하드코딩돼 있던 것 그대로다 — 원본 결
   보기의 그림은 바뀌지 않고, 3D 투영 쪽이 이 규칙으로 끌려온다.

   layers[] — 원본 결 보기의 레이어 0~3(루트확산·굵은섹션·중간·잔가닥)
     base/gain/src : 굵기 = (base + (src슬라이더/100)×gain) × widthScale
     c0/c1         : 개수 = c0 + (volume/100)×c1   (개수는 4레이어 모두 볼륨 연동)
     tint          : [하한, 폭] — 가닥 밝기 = 하한 + rand×폭
   ══════════════════════════════════════════════════════════════════ */
const HAIR_STRAND_LOOK = {
  resBase: 705,        // 굵기 튜닝 기준 캔버스 폭(fit.dw가 이보다 작으면 비례 축소)
  minSafeWidth: 0.9,   // sub-pixel 방지 하한(해상도 무관 — 캔버스 렌더링의 물리 제약)
  thin: 0.48,          // 전역 가닥 굵기 배율(가늘게/굵게는 이 값 하나로)
  undercoatMul: 2.2,   // 가닥 경로를 따라 까는 두피색 바탕의 굵기 배수
  layers: [
    // id,          굵기 base/gain/슬라이더,      개수 c0/c1,   틴트[하한, 폭]
    { id:'root',    base:0.5,  gain:0.28, src:'thickness', c0:830, c1:590, tint:[0.68,0.55] },
    { id:'section', base:0.65, gain:0.6,  src:'volume',    c0:85,  c1:49,  tint:[0.70,0.55] },
    { id:'mid',     base:0.48, gain:0.33, src:'thickness', c0:460, c1:490, tint:[0.72,0.60] },
    { id:'fine',    base:0.5,  gain:0.28, src:'thickness', c0:595, c1:595, tint:[0.65,0.75] },
  ],
};
/* ══════════════════════════════════════════════════════════════════
   가닥 색 — <b>가닥마다 자기 경로 위의 원본 픽셀</b> (2026-08-17)
   ─────────────────────────────────────────────────────────────────
   사용자: "난 가닥마다 저 픽셀을 다 대입시키길 바랬는데, 헤어가 너무 많으니까
            슬라이스 단위로 헤어간격을 두면서 하니까 이상해졌어."

   ── 지금까지 무엇이 빠져 있었나 ──────────────────────────────────
   캡처가 저장하는 건 가닥당 색 <b>하나</b>였다(capturedStrands의 color).
   pts는 수십 개인데 색은 스칼라 하나라, <b>한 가닥 안에서 뿌리부터 끝까지
   색이 안 변한다</b>. 실제 머리는 뿌리가 어둡고 중간에 광택 띠가 지나가고
   끝이 밝다 — 그 세로 변화가 통째로 없었다. 가닥 2,830개가 서로 다른 색이어도
   각각은 색연필처럼 균일해서, 기하를 아무리 맞춰도 합성처럼 보인 이유가 이것.

   ── 픽셀 이식(hairQuilt)이 왜 이걸 못 고쳤나 ──────────────────────
   색이 안 되니 사진 조각을 통째로 붙이는 우회로였다. 그래서 <b>띠 단위</b>가
   됐고, 띠 경계와 간격이 남았다(증상을 쫓은 것). 가닥은 이미 자기 경로를 갖고
   있으므로 사진을 자를 필요가 없다 — 그 길 위의 픽셀을 읽으면 된다. 가닥이
   두상을 촘촘히 덮고 있어서 정의상 틈이 생기지 않는다.

   ── 한계(정직하게) ───────────────────────────────────────────────
   · 길이를 <b>늘리면</b> 원본에 없는 구간이라 가져올 픽셀이 없다 → 끝 색을 이어 쓴다.
     자르는 쪽은 문제없다(앞부분만 쓰면 되므로).
   · 사진의 조명이 색에 구워진다. 지금도 그렇지만, 조명을 새로 만들어 주진 않는다.

   segments — 가닥 하나를 몇 조각으로 나눠 칠할지. 1이면 예전과 완전히 같다.
     캔버스는 선 하나에 색 하나뿐이라 조각을 나눠야 색이 변한다. 조각을 늘릴수록
     충실하지만 stroke 횟수가 비례해 는다(가닥 ~2,830개 × segments).
   blend  — 실측 픽셀색 비중. 나머지는 기존 계산색이라, 레이어별 틴트(굵은 가닥은
     밝게 등)가 완전히 사라지지 않고 남는다.
   ══════════════════════════════════════════════════════════════════ */
const HAIR_PIXEL_COLOR = {
  on: true,
  segments: 6,     // 1 = 예전 동작(가닥당 단색)
  blend: 0.85,
  /* (2026-08-17 b) 3D 투영도 <b>원본 결 보기와 같은 방식</b>으로 색을 정한다.
     true  = 되쏜 가닥이 지나는 <b>지금 이 뷰</b>의 원본 픽셀을 읽는다(권장).
     false = 중립 캡처 때 구운 조각색을 그대로 쓴다(되쏘기 전 좌표에서 읽은 색). */
  reproject: true,
  /* 실측 픽셀색에 가닥별 밝기 지터(strandTint)를 섞을지. 사진이 이미 자기
     명암을 갖고 있으므로 기본 false — 켜면 사진 위에 지어낸 명암이 한 겹 더
     얹혀 "색연필" 느낌이 돌아온다. 마무리 질감(윤기/매트)의 전체 밝기(baseMul)는
     false여도 그대로 적용된다. */
  jitter: false,
};

/* ══════════════════════════════════════════════════════════════════════
   염색(HAIR_DYE) — <b>사진의 명암은 남기고 색만 바꾼다</b> (2026-09-02)
   ─────────────────────────────────────────────────────────────────────
   사용자: "최종 품질을 고품질로 갈 거야. 모질은 머리카락 픽셀을 잘라서 하니까
   어느 정도 보장되고 … <b>염색 색깔을 고품질로</b> 구현하려고 해. 시스템 부하에
   문제가 안 되는 범위에서 최고 품질로. 색상은 뭐든 다 가능하게."

   ── 지금까지 왜 나빴나 (코드로 확인한 것) ────────────────────────────
   ① _adjApplyFilter ⑩이 염색이 걸리면 <b>조각색을 버렸다</b>
      (colors: sec.color ? null : srcColors). 즉 뿌리 어두움·광택 띠·끝 밝음 —
      2026-08-17에 애써 넣은 그 실측 명암이 염색하는 순간 통째로 사라졌다.
   ② 그래도 화면이 아주 단색은 아니었는데, sampleProjectedStrandColors가
      <b>photo 0.85 + 염색 0.15</b>로 섞고 있었기 때문이다. 그래서 검은 머리에
      금발을 얹으면 여전히 검고(85%가 사진), 색은 15%만 비친다.
      두 증상이 반대 방향이라 서로를 가려 왔다.
   ③ 섞는 자리가 <b>sRGB 선형 보간</b>이다. sRGB는 지각 균등이 아니라, 중간색이
      실제보다 어둡고 <b>채도가 빠진다</b>(회색 쪽으로 가로지른다).

   ── 무엇이 옳은 모델인가 ──────────────────────────────────────────────
   실제 염색은 색소를 <b>얹는</b> 것이지 사진을 덮는 것이 아니다. 그 사람 머리의
   <b>명암 구조</b>(어디가 밝고 어디가 어두운가)는 조명·모발 굵기·큐티클이 정한
   그 사람의 성질이고 염색 뒤에도 그대로 남는다. 바뀌는 것은 <b>색상과 채도</b>다.
   그래서 <b>밝기 구조는 사진에서 · 색은 염색에서</b> 가져온다.

   자는 OKLab을 쓴다. 지각 균등이라 L을 곱해도 색상이 안 틀어지고, 채도 조작이
   눈에 보이는 만큼과 맞는다. HSL은 안 된다 — L이 밝기가 아니라 그냥 (max+min)/2라
   노랑과 파랑이 같은 L에서 밝기가 두 배 차이 난다.

   ── 하는 일 (조각 하나당) ────────────────────────────────────────────
     Lp = 사진 픽셀의 OKLab L
     s  = Lp / Lref            ← 이 뷰 평균 헤어색 대비 <b>상대</b> 밝기 = 명암 구조
     L' = Ld × s^shadingGamma  ← 염색색의 밝기에 그 구조를 곱한다
     하이라이트 탈색: L'가 Ld보다 밝은 만큼 채도를 뺀다. 실제 모발 하이라이트는
       정반사라 <b>무채색</b>이다 — 이걸 안 하면 광택 띠가 형광 색으로 뜬다.
   lift(탈색)는 Lref를 낮춰 잡는 것과 같으므로 별도 항으로 두지 않고
   liftTo로 <b>목표 밝기를 직접</b> 지정할 수 있게만 열어 둔다(0이면 안 씀).

   ── 부하: <b>사실상 0</b> ────────────────────────────────────────────
   위 식은 결과가 오직 Lp(0~255)에만 달려 있다 — 염색색과 Lref가 고정이면
   나머지는 상수다. 그래서 <b>256칸 LUT 한 벌</b>을 만들어 두고 조각마다
   배열 인덱싱 한 번만 한다. 만드는 비용은 색을 바꿀 때 256회뿐이고, 그리는
   비용은 프레임당 0이다(4천 가닥 × 6조각 = 2만4천 회가 전부 인덱싱).
   LUT는 (염색색, Lref, 설정) 서명으로 캐시한다 — 이 파일의 다른 캐시와 같은 규약.
   ⚠ 서명에 안 들어간 값이 결과를 바꾸면 색을 바꿔도 화면이 안 바뀐다.
     그래서 서명은 <b>손으로</b> 적지 않고 DYE_KEYS를 순회해서 만든다.
   되돌리기: HAIR_DYE.on = false → 예전 blend 경로 그대로.
   ══════════════════════════════════════════════════════════════════════ */
const HAIR_DYE = {
  on: true,
  /* 사진 명암 구조를 얼마나 살릴지. 1=그대로, 0=완전 단색(예전 염색과 같아짐).
     1보다 크면 대비가 과장된다(비추천, 사진에 없는 명암을 지어내는 것). */
  shading: 1.0,
  /* s = Lp/Lref 에 걸리는 감마. 1이면 비율 그대로. 1보다 작으면 어두운 쪽이
     덜 어두워진다 — 검은 머리에 밝은 색을 얹을 때 뿌리가 새까맣게 남는 것을
     완화한다. 0.85는 실측이 아니라 <b>초안</b>이다(tipAt과 같은 자격). */
  shadingGamma: 0.85,
  /* 하이라이트가 무채색으로 빠지는 정도(0=색 그대로, 1=완전 흰색까지).
     실제 모발 정반사는 조명색이라 무채색에 가깝다. */
  glossDesat: 0.55,
  /* 명암 구조의 아래·위 한계. 사진 노이즈가 s를 극단으로 끌고 가는 것을 막는다. */
  sMin: 0.35, sMax: 1.85,
  /* 0이 아니면 <b>목표 밝기를 직접</b> 지정(0~1, OKLab L). 탈색·하이라이트용.
     0이면 염색색 자신의 L을 목표로 쓴다. */
  liftTo: 0,
  /* 채도 배율. 1이면 염색색 그대로. 실제 발색이 모자라면 여기서 올린다. */
  chroma: 1.0,
  /* 밝은 쪽 포화 세기. 클수록 하이라이트가 빨리 1에 붙는다. 위 매핑 주석 참고. */
  highlightK: 1.1,
};
const DYE_KEYS = ['shading','shadingGamma','glossDesat','sMin','sMax','liftTo','chroma','highlightK'];

/* ── sRGB ↔ 선형 ↔ OKLab (Björn Ottosson) ────────────────────────────
   상수를 여기 한 번만 적는다. 두 벌이 되면 갈라진다. */
/* 0~255 → 선형. <b>256칸 표</b>로 미리 굽는다 — 조각마다 pow()를 세 번 부르면
   하네스 실측으로 2.4만 조각에 36ms가 나왔다(프레임 예산을 통째로 먹는다).
   표로 바꾸면 같은 일이 1ms대다. 값은 아래 식과 <b>같은 식</b>으로 굽는다. */
function _srgbToLinRaw(c){ c/=255; return c<=0.04045 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); }
const _SRGB_LIN = (()=>{ const t = new Float64Array(256);
  for(let i=0;i<256;i++) t[i] = _srgbToLinRaw(i); return t; })();
function _srgbToLin(c){ return _SRGB_LIN[c & 255]; }
function _linToSrgb(c){
  const v = c<=0.0031308 ? c*12.92 : 1.055*Math.pow(Math.max(0,c), 1/2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(v*255)));
}
function rgbToOklab(r,g,b){
  /* 표를 쓰므로 정수 채널이어야 한다. 호출부가 소수를 줄 수 있어 여기서 접는다. */
  const R=_SRGB_LIN[Math.max(0,Math.min(255,Math.round(r)))],
        G=_SRGB_LIN[Math.max(0,Math.min(255,Math.round(g)))],
        B=_SRGB_LIN[Math.max(0,Math.min(255,Math.round(b)))];
  const l=Math.cbrt(0.4122214708*R + 0.5363325363*G + 0.0514459929*B);
  const m=Math.cbrt(0.2119034982*R + 0.6806995451*G + 0.1073969566*B);
  const s=Math.cbrt(0.0883024619*R + 0.2817188376*G + 0.6299787005*B);
  return { L:0.2104542553*l + 0.7936177850*m - 0.0040720468*s,
           a:1.9779984951*l - 2.4285922050*m + 0.4505937099*s,
           b:0.0259040371*l + 0.7827717662*m - 0.8086757660*s };
}
function oklabToRgb(L,a,b){
  const l_=L + 0.3963377774*a + 0.2158037573*b;
  const m_=L - 0.1055613458*a - 0.0638541728*b;
  const s_=L - 0.0894841775*a - 1.2914855480*b;
  const l=l_*l_*l_, m=m_*m_*m_, s=s_*s_*s_;
  return [ _linToSrgb( 4.0767416621*l - 3.3077115913*m + 0.2309699292*s),
           _linToSrgb(-1.2684380046*l + 2.6097574011*m - 0.3413193965*s),
           _linToSrgb(-0.0041960863*l - 0.7034186147*m + 1.7076147010*s) ];
}

/* 어떤 CSS 색이든 {r,g,b}로. '#rgb'/'#rrggbb'/'rgb()'/'rgba()'/색이름 전부.
   색이름은 브라우저에게 물어본다(1회 캐시) — "색상은 뭐든 다 가능하게". */
const _cssColorCache = new Map();
function cssToRGB(css){
  if(!css) return null;
  if(_cssColorCache.has(css)) return _cssColorCache.get(css);
  let out = null;
  const s = String(css).trim();
  let m = /^#([0-9a-f]{3})$/i.exec(s);
  if(m){ const h=m[1]; out={ r:parseInt(h[0]+h[0],16), g:parseInt(h[1]+h[1],16), b:parseInt(h[2]+h[2],16) }; }
  if(!out && (m = /^#([0-9a-f]{6})$/i.exec(s))){
    const n=parseInt(m[1],16); out={ r:(n>>16)&255, g:(n>>8)&255, b:n&255 };
  }
  if(!out && (m = /^rgba?\(([^)]+)\)$/i.exec(s))){
    const p=m[1].split(',').map(x=>parseFloat(x));
    if(p.length>=3 && p.every(v=>isFinite(v))) out={ r:p[0]|0, g:p[1]|0, b:p[2]|0 };
  }
  if(!out && typeof document !== 'undefined'){
    /* 색이름·hsl()·oklch() 등은 브라우저가 이미 파서를 갖고 있다. 새로 만들지 않는다.
       ⚠ 실패해도 예외를 내지 않는다 — 색 하나 때문에 렌더가 죽으면 안 된다. */
    try{
      const c = document.createElement('canvas'); c.width=c.height=1;
      const x = c.getContext('2d');
      x.fillStyle = '#000'; x.fillStyle = s;
      if(x.fillStyle !== '#000' || /^(black|#000000|#000)$/i.test(s)){
        x.fillRect(0,0,1,1);
        const p = x.getImageData(0,0,1,1).data;
        out = { r:p[0], g:p[1], b:p[2] };
      }
    }catch(e){}
  }
  /* (2026-09-03) 상한을 둔다 — 자유 색상 <b>텍스트 입력</b>이 생기면서 타이핑
     도중의 미완성 문자열("#ff2", "oklch(0.7 0.")이 전부 키가 된다. 예전엔
     스와치·프리셋뿐이라 키가 열 몇 개로 끝났고 상한이 필요 없었다.
     LRU까지는 필요 없다(만드는 비용이 캔버스 1픽셀이다) — 넘치면 비운다. */
  if(_cssColorCache.size > 512) _cssColorCache.clear();
  _cssColorCache.set(css, out);
  return out;
}
/* 어떤 CSS 색이든 <b>#rrggbb</b>로 접는다. 못 읽는 문자열이면 null.
   왜 접는가: ① 스와치·<input type=color>·캐시 서명이 전부 같은 표기를 봐야
   "같은 색인데 다르게 적힌" 두 값이 캐시 미스를 내지 않는다 ② cssToRGB가
   어차피 8비트 RGB로 내려주므로(캔버스 1픽셀) 접어서 잃는 것이 없다.
   ⚠ 그래서 입력은 뭐든 받되(hsl·oklch·색이름) 저장은 hex 한 벌이다. */
function gyNormalizeColor(css){
  const c = cssToRGB(css);
  if(!c) return null;
  const h = n => ('0' + Math.max(0, Math.min(255, Math.round(n))).toString(16)).slice(-2);
  return '#' + h(c.r) + h(c.g) + h(c.b);
}

/* ── OKLCH 좌표 ↔ 색 (2026-09-03) ──────────────────────────────────────
   드래그 손잡이가 서는 축이다. <b>엔진과 같은 자</b>를 쓴다 — HAIR_DYE가
   OKLab에서 L(밝기)·C(채도)·hue로 일하므로(dyeLUTFor), 손잡이도 그 축이어야
   "밝기를 올린 만큼 밝아진다"가 화면과 맞는다.
   ⚠ HSL로 만들면 안 된다. 9/2 배너에 적은 그대로 — HSL의 L은 밝기가 아니라
     (max+min)/2라 노랑과 파랑이 같은 L에서 밝기가 두 배 차이 난다. 채도
     손잡이를 돌렸을 때 눈에 보이는 만큼과 안 맞는다.
   ⚠ 새 변환식을 만들지 않는다 — rgbToOklab/oklabToRgb를 그대로 부른다.
     여기에 행렬을 또 적으면 그게 두 번째 벌이다(작업원칙 3). */
function gyToOklch(css){
  const c = cssToRGB(css);
  if(!c) return null;
  const o = rgbToOklab(c.r, c.g, c.b);
  let h = Math.atan2(o.b, o.a) * 180 / Math.PI;
  if(h < 0) h += 360;
  return { L: o.L, C: Math.hypot(o.a, o.b), h };
}
/* OKLCH → hex + <b>모니터가 실제로 낸 좌표</b>.
   OKLCH는 sRGB 밖의 색도 가리킬 수 있다(채도를 끝까지 올리면 대부분 밖이다).
   그 몫은 화면에서 잘려 나가는데, 그러면 <b>슬라이더는 올라가는데 화면은
   안 변하는</b> 구간이 생긴다 — 사용자가 말한 "모니터와 실제 차이"가 화면
   안에서 먼저 나타나는 자리다. 그래서 잘렸으면 잘렸다고 돌려준다.
   ⚠ 판정에 새 식을 쓰지 않는다. 접힌 hex를 <b>다시 읽어</b>(왕복) 요청한
     좌표와 벌어진 만큼이 못 낸 몫이다 — 두 함수가 같은 값을 내야 하는
     관계를 그대로 시험에 쓰는 것과 같은 방식(작업원칙 2). */
function gyFromOklch(L, C, hDeg){
  const r = hDeg * Math.PI / 180;
  const rgb = oklabToRgb(L, Math.cos(r) * C, Math.sin(r) * C);
  const back = rgbToOklab(rgb[0], rgb[1], rgb[2]);
  const gotC = Math.hypot(back.a, back.b);
  const hx = n => ('0' + n.toString(16)).slice(-2);
  return { hex: '#' + hx(rgb[0]) + hx(rgb[1]) + hx(rgb[2]),
           gotL: back.L, gotC,
           /* 0.01은 눈금이다 — 채도 슬라이더 한 칸(0.005)보다 크게 잡아
              반올림 잡음으로 경고가 깜빡이지 않게 한다. */
           clipped: (Math.abs(back.L - L) > 0.01) || (Math.abs(gotC - C) > 0.01) };
}
/* 화면에 적을 <b>색 넘버</b>. hex는 저장되는 값이고, oklch는 지금 슬라이더가
   서 있는 좌표다 — 둘 다 적는다(hex만 적으면 어느 축을 얼마나 돌렸는지 못 옮긴다). */
function gyColorNumbers(css){
  const o = gyToOklch(css);
  const hex = gyNormalizeColor(css);
  if(!o || !hex) return null;
  return { hex: hex.toUpperCase(),
           oklch: 'oklch(' + (o.L * 100).toFixed(1) + '% ' + o.C.toFixed(3) + ' ' + o.h.toFixed(0) + ')',
           L: o.L, C: o.C, h: o.h };
}

/* (염색색, 기준 밝기) → 256칸 LUT. 인덱스는 사진 픽셀의 <b>OKLab L × 255</b>.
   값은 'rgb(r,g,b)' 문자열 — 그리는 쪽이 그대로 fillStyle에 넣는다. */
const DYE_LUT = { map: new Map(), max: 24, hits: 0, misses: 0 };
function dyeLUTFor(dyeCss, refCss){
  const D = HAIR_DYE;
  const sig = dyeCss + '|' + (refCss || '-') + '|' + DYE_KEYS.map(k=>D[k]).join(',');
  const hit = DYE_LUT.map.get(sig);
  if(hit){ DYE_LUT.hits++; return hit; }
  DYE_LUT.misses++;
  const dc = cssToRGB(dyeCss);
  if(!dc) return null;
  const dye = rgbToOklab(dc.r, dc.g, dc.b);
  const rc  = cssToRGB(refCss);
  /* 기준 밝기 — 이 뷰에서 <b>실측한</b> 평균 헤어색의 L. 없으면 염색색 자신의 L을
     쓴다(그러면 s=1 근처가 되어 사진 대비만 남는다, 안전한 폴백). */
  let Lref = rc ? rgbToOklab(rc.r, rc.g, rc.b).L : dye.L;
  if(!(Lref > 0.02)) Lref = 0.02;              // 새까만 머리에서 0으로 나누지 않는다
  const Ltarget = (D.liftTo > 0) ? D.liftTo : dye.L;
  const C = Math.hypot(dye.a, dye.b) * D.chroma;
  const hue = Math.atan2(dye.b, dye.a);
  const ca = Math.cos(hue), cb = Math.sin(hue);
  const lut = new Array(256);
  for(let i=0;i<256;i++){
    const Lp = i/255;
    let s = Lp / Lref;
    s = 1 + (s - 1) * D.shading;                       // 명암 구조 세기
    s = Math.max(D.sMin, Math.min(D.sMax, s));
    if(D.shadingGamma !== 1) s = Math.pow(s, D.shadingGamma);
    /* ── 어두운 쪽은 곱하고, 밝은 쪽은 <b>눌러서</b> 1에 수렴시킨다 ──────────
       처음엔 L = Ltarget × s 하나로 썼다가 하네스가 잡았다 — Ltarget이 0.72인
       밝은 염색색에서는 s가 1.4만 돼도 L이 1을 넘어 <b>중간톤부터 흰색으로
       포화</b>했고, 그러면 하이라이트 탈색이 걸릴 자리 자체가 없어진다
       (시험 두 개가 같은 값 0.034로 나온 게 그 증거였다).
       밝은 쪽을 지수 포화로 바꾸면 s가 아무리 커도 1을 안 넘고, Ltarget과 1
       사이의 여유가 <b>하이라이트가 살 자리</b>로 남는다. 어두운 쪽은 바닥이
       0이라 그런 문제가 없어 곱셈 그대로 둔다(뿌리 어두움이 그대로 산다). */
    let L;
    if(s <= 1){
      L = Ltarget * s;
    } else {
      L = Ltarget + (1 - Ltarget) * (1 - Math.exp(-D.highlightK * (s - 1)));
    }
    L = Math.max(0, Math.min(1, L));
    /* 하이라이트 탈색 — 목표보다 밝아진 만큼 채도를 뺀다(정반사는 무채색). */
    let k = 1;
    if(L > Ltarget && Ltarget < 1){
      k = 1 - D.glossDesat * Math.min(1, (L - Ltarget) / (1 - Ltarget));
    }
    const c = C * k;
    const [r,g,b] = oklabToRgb(L, ca*c, cb*c);
    lut[i] = 'rgb(' + r + ',' + g + ',' + b + ')';
  }
  DYE_LUT.map.set(sig, lut);
  while(DYE_LUT.map.size > DYE_LUT.max) DYE_LUT.map.delete(DYE_LUT.map.keys().next().value);
  return lut;
}
/* 사진 RGB → LUT 인덱스(OKLab L). 조각마다 도는 자리라 여기만 실제 계산이다. */
function dyeIndexOf(r,g,b){
  const L = rgbToOklab(r,g,b).L;
  return Math.max(0, Math.min(255, Math.round(L*255)));
}

/* srcPixels(RGBA)에서 알파를 버리고 RGB만 담는다. maskW×maskH×3. */
function packPhotoRGB(srcPixels, w, h){
  const n = w*h, out = new Uint8Array(n*3);
  for(let i=0, j=0, p=0; i<n; i++, j+=3, p+=4){
    out[j] = srcPixels[p]; out[j+1] = srcPixels[p+1]; out[j+2] = srcPixels[p+2];
  }
  return out;
}

/* <b>이미지 좌표</b>(x,y — 가닥 경로·되쏜 점이 쓰는 그 좌표계)의 원본 색.
   범위 밖이면 null(호출부가 기존 색으로 폴백).
   ⚠ 2026-08-17 b 고침 — photoRGB는 <b>축소 해상도</b>(maskW×maskH, 긴 변 1200
   상한)에 담겨 있는데 여기서 이미지 좌표를 그대로 인덱스로 썼다. 사진이
   1200px보다 크면(요즘 폰 사진은 거의 다) 좌표가 어긋나 왼쪽 위 일부만 읽히고
   나머지는 범위 밖 → null → sampleStrandColors가 통째로 null을 돌려
   <b>단색 경로로 조용히 되돌아가고 있었다</b>. 결방향 필드가 ox/oy로 환산해
   쓰는 것과 같은 환산을 여기서도 한다(orientMaskW 주석 참조). */
function photoRGBAt(maskInf, x, y){
  const buf = maskInf && maskInf.photoRGB;
  if(!buf) return null;
  const w = maskInf.maskW, h = maskInf.maskH;
  const sx = w / Math.max(1, maskInf.w || w), sy = h / Math.max(1, maskInf.h || h);
  const xi = (x * sx) | 0, yi = (y * sy) | 0;
  if(xi < 0 || yi < 0 || xi >= w || yi >= h) return null;
  const j = (yi*w + xi)*3;
  return [buf[j], buf[j+1], buf[j+2]];
}

/* 이 <b>이미지 좌표</b>가 원본 사진에서 실제로 머리카락으로 판정된 자리인가.
   reasonMask(1=최종 머리카락)를 그대로 본다 — 되쏜 가닥이 얼굴·배경 위로 넘어간
   구간에서 피부색·배경색을 머리색으로 퍼오는 것을 막는 유일한 장치다.
   마스크가 없으면(마네킹 등) true — 새 실패 모드를 만들지 않는다. */
function isHairPixelAt(maskInf, x, y){
  const rm = maskInf && maskInf.reasonMask;
  if(!rm) return true;
  const w = maskInf.maskW, h = maskInf.maskH;
  const sx = w / Math.max(1, maskInf.w || w), sy = h / Math.max(1, maskInf.h || h);
  const xi = (x * sx) | 0, yi = (y * sy) | 0;
  if(xi < 0 || yi < 0 || xi >= w || yi >= h) return false;
  return rm[yi*w + xi] === 1;
}

/* ── core.wasm 로더 (14c 컬 번들과 같이 씀) ─────────────────────────── */
(function () {
  if (typeof window === 'undefined' || window.__SPCORE) return;
  var C = window.__SPCORE = { ready: false, x: null, waiters: [] };
  var url = (window.STYLEPEEK_WASM_URL || 'js/core.wasm') + '?v=' + (window.STYLEPEEK_WASM_V || '1');
  var imp = { env: { abort: function () { throw new Error('core abort'); }, seed: function () { return Date.now(); } } };
  var env = imp.env; for (var k in _trImports) env[k] = _trImports[k];
  var go = function (r) { C.x = r.instance.exports; C.ready = true; var w = C.waiters.splice(0); for (var i = 0; i < w.length; i++) try { w[i](C.x); } catch (e) {} };
  var slow = function () { return fetch(url).then(function (x) { return x.arrayBuffer(); }).then(function (b) { return WebAssembly.instantiate(b, imp); }).then(go); };
  try {
    (WebAssembly.instantiateStreaming ? WebAssembly.instantiateStreaming(fetch(url), imp).then(go).catch(slow) : slow())
      .catch(function (e) { console.warn('[core] load failed', e); });
  } catch (e) { console.warn('[core] unsupported', e); }
})();

var _pxSlots = new WeakMap(), _pxSlotOwner = [], _pxTick = 0, _pxUse = [];
function _pxSlotFor(X, maskInf) {
  var buf = maskInf.photoRGB, sl = _pxSlots.get(buf);
  if (sl != null && _pxSlotOwner[sl] === buf) { _pxUse[sl] = ++_pxTick; return sl; }
  var best = 0;
  for (var i = 0; i < 8; i++) { if (_pxSlotOwner[i] == null) { best = i; break; } if ((_pxUse[i] || 0) < (_pxUse[best] || 0)) best = i; }
  var w = maskInf.maskW | 0, h = maskInf.maskH | 0, rm = maskInf.reasonMask;
  if (!(w > 0 && h > 0) || buf.length < w * h * 3) return -1;
  X.imgAlloc(best, w, h, rm ? 1 : 0);
  new Uint8Array(X.memory.buffer, X.imgRgbPtr(best), w * h * 3).set(buf.subarray ? buf.subarray(0, w * h * 3) : buf);
  if (rm) {
    var mv = new Uint8Array(X.memory.buffer, X.imgMaskPtr(best), w * h);
    for (var k = 0; k < w * h; k++) mv[k] = rm[k] === 1 ? 1 : 0;
  }
  _pxSlots.set(buf, best); _pxSlotOwner[best] = buf; _pxUse[best] = ++_pxTick;
  return best;
}
/* 조각별 [실측?, r, g, b] — 계산은 core.wasm. 못 쓰면 null */
function _pxSample(maskInf, pts, K, mode, fb) {
  var C = window.__SPCORE, X = C && C.ready ? C.x : null;
  if (!X || !pts || pts.length > X.ptsMax()) return null;
  var slot = _pxSlotFor(X, maskInf);
  if (slot < 0) return null;
  var P = new Float64Array(X.memory.buffer, X.ptsPtr(), pts.length * 2);
  for (var i = 0, o = 0; i < pts.length; i++) { P[o++] = pts[i].x; P[o++] = pts[i].y; }
  var hit = X.sample(slot, pts.length, K, +maskInf.w || 0, +maskInf.h || 0, mode,
    fb ? 1 : 0, HAIR_PIXEL_COLOR.blend, fb ? fb.r : 0, fb ? fb.g : 0, fb ? fb.b : 0);
  if (hit < 0) return null;
  return { hit: hit, r: new Float64Array(X.memory.buffer, X.resPtr(), K * 4) };
}

/* 가닥 경로를 따라 색을 읽어 segments개로 묶는다. 반환: css 색 배열 / null(단색 경로) */
function sampleStrandColors(maskInf, pts, fallbackCss){
  if(!HAIR_PIXEL_COLOR.on || !maskInf || !maskInf.photoRGB) return null;
  const K = Math.max(1, HAIR_PIXEL_COLOR.segments|0);
  if(K < 2 || !pts || pts.length < 2) return null;
  const fb = parseRGBTriple(fallbackCss);
  const S = _pxSample(maskInf, pts, K, 0, fb);
  if(!S || !S.hit) return null;
  const out = new Array(K);
  let lastCss = fallbackCss;
  for(let k=0; k<K; k++){
    const o = k*4;
    if(!S.r[o]){ out[k] = lastCss; continue; }
    lastCss = out[k] = `rgb(${S.r[o+1]},${S.r[o+2]},${S.r[o+3]})`;
  }
  let first = -1;
  for(let k=0; k<K; k++){ if(out[k] !== fallbackCss){ first = k; break; } }
  for(let k=0; k<first; k++) out[k] = out[first];
  return out;
}

function sampleProjectedStrandColors(maskInf, ipts, baked, fallbackCss, dyeCss){
  if(!HAIR_PIXEL_COLOR.on || !maskInf || !maskInf.photoRGB) return baked;
  const K = Math.max(1, HAIR_PIXEL_COLOR.segments|0);
  if(K < 2 || !ipts || ipts.length < 2) return baked;
  const lut = (HAIR_DYE.on && dyeCss) ? dyeLUTFor(dyeCss, maskInf.avgHairColor) : null;
  const fb = parseRGBTriple(lut ? null : fallbackCss);
  const S = _pxSample(maskInf, ipts, K, 1, lut ? null : fb);
  if(!S || !S.hit) return baked;
  const out = new Array(K), got = new Array(K).fill(false);
  let lastCss = null;
  for(let k=0; k<K; k++){
    const o = k*4;
    if(!S.r[o]){
      out[k] = lut ? (lastCss || dyeCss) : ((baked && baked[k]) || lastCss || fallbackCss);
      continue;
    }
    got[k] = true;
    if(lut){ lastCss = out[k] = lut[dyeIndexOf(S.r[o+1], S.r[o+2], S.r[o+3])]; continue; }
    lastCss = out[k] = `rgb(${S.r[o+1]},${S.r[o+2]},${S.r[o+3]})`;
  }
  let first = 0;
  while(first < K && !got[first]) first++;
  for(let k=0; k<first; k++){ if(!(baked && baked[k])) out[k] = out[first]; }
  return out;
}

/* ── <b>3D 가닥</b>에 조각색을 굽는다 — 2D와 같은 규칙, 좌표만 3D (2026-08-18 i) ──
   사용자: "원본결보기와 마네킹 모드 적용 안 한 스타일 보기에서는 헤어결이
   원본 헤어에서 채취한 픽셀로 가닥을 렌더링한 건데, <b>마네킹 모드에서는 그게
   적용이 안 돼</b>. 적용해야 돼." / "3D는 모든 결과를 앞에서 조정한 거에 따르는 거야."

   왜 안 됐나 — 조각색(colors)은 <b>촬영 가닥</b>이 2D 캡처 때 자기 경로 위에서
   읽어 온 값이다. 마네킹 가닥은 사진에서 온 게 아니라 격자에 새로 심은 것이라
   읽어 올 경로가 애초에 없었다(그래서 [3D] 로그가 "원본 픽셀색 0개(=0%)").
   2D 투영 화면만 멀쩡해 보였던 이유도 여기 있다 — 그쪽은 매 프레임
   sampleProjectedStrandColors로 <b>되쏘아 다시 읽으니</b> 마네킹이든 아니든 같다.
   색이 갈라진 자리는 되쏘기가 없는 곳, 즉 <b>최종 3D 화면</b>이었다.

   그래서 되쏘기를 3D 쪽에도 준다: 가닥을 자기 뷰로 투영해 그 자리 원본 픽셀을
   읽는다. 규칙(조각 수·중앙 표본·blend·마스크 밖 폴백)은 sampleProjectedStrandColors
   <b>그대로</b>다 — 다른 건 "어느 뷰로 되쏘는가"뿐이라 여기서 정한다.
   뷰 선택은 viewOfRoot(뿌리가 제일 크게 보이는 뷰) — 스타일링·역산이 이미 쓰는
   판정이라 새로 만들지 않는다. 마스크·캘리브레이션이 없으면 baked를 그대로
   돌려준다(새 실패 모드를 만들지 않는다). */
function bakeStrandColors3D(pts, model, angle, fallbackCss, baked, dyeCss){
  if(!HAIR_PIXEL_COLOR.on || !pts || pts.length < 2 || !model) return baked || null;
  const cal = model.viewCal && model.viewCal[angle];
  const mi  = state.hairMasks && state.hairMasks[angle];
  if(!cal || !mi || !mi.photoRGB) return baked || null;
  const ipts = new Array(pts.length);
  for(let i=0;i<pts.length;i++){
    const pr = project3DPointToView(pts[i], cal, model.yTop, model.CY);
    ipts[i] = { x: pr.ix, y: pr.iy };
  }
  /* (2026-09-05) dyeCss를 <b>같이 넘긴다</b> — 사용자: "전체염색을 넣으면 2D 조정
     화면은 변하는데 3D 결과보기에서 뒤쪽이랑 정수리는 안 바뀐다."
     원인이 여기 인자 하나였다. 이 함수는 되쏘아 읽은 <b>사진 픽셀</b>을 돌려주는데,
     염색은 그 픽셀을 LUT로 바꾸는 단계(sampleProjectedStrandColors의 5번째 인자)에서
     걸린다. 그 인자를 안 넘기니 LUT가 안 만들어지고 사진색이 그대로 나왔다.
     그래서 <b>사진에 머리가 있는 자리</b>(뒤통수·정수리)만 원래 색으로 남고,
     머리가 없는 자리(이마 앞머리·늘린 구간)는 폴백이 염색색이라 바뀌어 보였다 —
     "앞은 되는데 뒤는 안 된다"의 정체가 이 갈림이다.
     2D 투영은 처음부터 st.dye를 넘기고 있었다(15-project-3d.js). 두 경로가 같은
     함수를 부르면서 인자만 달랐던 것이라, 규칙을 하나로 되돌리는 수정이다. */
  return sampleProjectedStrandColors(mi, ipts, baked || null, fallbackCss, dyeCss);
}

/* 이 뷰에서 "원본 결 보기가 그리는 가닥 묶음"을 그대로 계산해 준다.
   → 레이어별 굵기 w · 개수 n · 틴트 범위. 두 렌더러가 이 함수 하나만 본다. */
function hairStrandRoles(fitDw, volume, thickness){
  const L = HAIR_STRAND_LOOK;
  const widthScale = (fitDw / L.resBase) * L.thin;
  return L.layers.map(x=>({
    id: x.id,
    w: Math.max(L.minSafeWidth, (x.base + (((x.src==='volume') ? volume : thickness)/100) * x.gain) * widthScale),
    n: x.c0 + (volume/100) * x.c1,
    tint: x.tint,
  }));
}

