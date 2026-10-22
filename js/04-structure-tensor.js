/* ══════════════════════════════════════════════════════════
   04-structure-tensor.js — 구조텐서 결방향 인식 · 결 극성
   원본 index.html 7833~8139행. 클래식 스크립트이므로 로드 순서가 곧
   실행 순서다 — index.html의 <script src> 순서를 바꾸지 말 것.
   ══════════════════════════════════════════════════════════ */
/* ════════════════════════════════════════
   STRUCTURE TENSOR: 머리카락 결방향 인식
   ────────────────────────────────────────
   원리: 각 픽셀에서 Sobel 그래디언트(Ix, Iy)를 구하고,
   구조텐서 J = [[Ix², IxIy], [IxIy, Iy²]] 를 박스블러로 평균낸 뒤
   고유벡터 분석으로 "결 방향"(가장 변화가 적은 방향)을 추출한다.
   머리카락은 가는 선이 한 방향으로 나란히 흐르는 텍스처라
   그래디언트가 결방향에 수직으로 강하게 나타나므로,
   그 그래디언트의 수직 방향 = 머리카락이 흐르는 방향이 된다.
════════════════════════════════════════ */

// 그레이스케일 변환 (luma)
function toGrayscale(pixels, w, h){
  const gray = new Float32Array(w*h);
  for(let i=0;i<w*h;i++){
    const pi=i*4;
    gray[i] = 0.299*pixels[pi] + 0.587*pixels[pi+1] + 0.114*pixels[pi+2];
  }
  if(typeof SEG_ORIENT !== 'undefined') SEG_ORIENT._noteGray(pixels, w, h, gray);   // (옛 64) 영역 다시 찾기가 쓸 사진 기억
  return gray;
}

// Sobel 그래디언트 (가로 Ix, 세로 Iy)
function sobelGradients(gray, w, h){
  const Ix = new Float32Array(w*h);
  const Iy = new Float32Array(w*h);
  for(let y=1;y<h-1;y++){
    for(let x=1;x<w-1;x++){
      const i = y*w+x;
      // Sobel X 커널
      const gx =
        -1*gray[(y-1)*w+(x-1)] + 1*gray[(y-1)*w+(x+1)] +
        -2*gray[y*w+(x-1)]     + 2*gray[y*w+(x+1)] +
        -1*gray[(y+1)*w+(x-1)] + 1*gray[(y+1)*w+(x+1)];
      // Sobel Y 커널
      const gy =
        -1*gray[(y-1)*w+(x-1)] - 2*gray[(y-1)*w+x] - 1*gray[(y-1)*w+(x+1)] +
         1*gray[(y+1)*w+(x-1)] + 2*gray[(y+1)*w+x] + 1*gray[(y+1)*w+(x+1)];
      Ix[i]=gx; Iy[i]=gy;
    }
  }
  return {Ix, Iy};
}

// 박스 블러 (구조텐서 성분 평균화용, separable)
function boxBlur(buf, w, h, radius){
  if(radius<=0) return new Float32Array(buf);
  const tmp = new Float32Array(w*h);
  const out = new Float32Array(w*h);
  const norm = 1/(radius*2+1);
  // 가로
  for(let y=0;y<h;y++){
    const row=y*w;
    let sum=0;
    for(let x=-radius;x<=radius;x++){ sum += buf[row + Math.min(w-1,Math.max(0,x))]; }
    for(let x=0;x<w;x++){
      tmp[row+x] = sum*norm;
      const xOut = x-radius, xIn = x+radius+1;
      sum += buf[row + Math.min(w-1,Math.max(0,xIn))] - buf[row + Math.min(w-1,Math.max(0,xOut))];
    }
  }
  // 세로
  for(let x=0;x<w;x++){
    let sum=0;
    for(let y=-radius;y<=radius;y++){ sum += tmp[Math.min(h-1,Math.max(0,y))*w+x]; }
    for(let y=0;y<h;y++){
      out[y*w+x] = sum*norm;
      const yOut=y-radius, yIn=y+radius+1;
      sum += tmp[Math.min(h-1,Math.max(0,yIn))*w+x] - tmp[Math.min(h-1,Math.max(0,yOut))*w+x];
    }
  }
  return out;
}

/**
 * computeHairOrientationField
 * 머리카락 마스크 영역에서 결방향 필드를 계산한다.
 * @param pixels  원본 이미지 RGBA Uint8ClampedArray (w*h*4)
 * @param maskBuf 머리카락 마스크 (0 또는 255, w*h)
 * @param w,h     이미지 크기
 * @returns {angle: Float32Array, coherence: Float32Array}
 *   angle[i]: 해당 픽셀에서 머리카락이 흐르는 방향 (라디안, -PI/2~PI/2 범위, 0=수직 아래방향 기준)
 *   coherence[i]: 0~1, 방향성이 얼마나 뚜렷한지 (1=결이 또렷, 0=무방향/노이즈)
 */
/* ══════════════════════════════════════════════════════════════════
   결에 <b>극성</b>을 준다 — 뿌리에서 끝으로 (2026-08-01)
   ─────────────────────────────────────────────────────────────────
   사용자: "결방향을 더 강화하고, 뿌리와 끝점 체크를 더 잘하는 방식으로는 안 되나?
   클립을 걸어도 결방향이 (실제와는 다르게) 마스크 안쪽을 향하게 되면, 조정할 때
   또 이상하게 조정이 된단 말야."

   정확한 지적이다. 지금 파이프라인 어디에도 "머리카락은 뿌리에서 끝으로 흐른다"는
   정보가 <b>없다</b>:
     · computeHairOrientationField는 structure tensor라 결과가 [-π/2, π/2] —
       <b>선분의 방위</b>이지 방향이 아니다. angle과 angle+π가 같은 값이다.
     · traceStrandPath는 그 모호성을 "직전 진행 방향과 가까운 쪽"으로 푼다.
       즉 <b>이미 가던 쪽</b>을 고른다. 시작값은 baseDir=π/2(그냥 아래)로 박혀 있다.
     · alignStrandPtsToField3D도 `if(f·d < 0) f = -f` — 역시 <b>가던 쪽</b>에 맞춘다.
   그래서 한번 안쪽으로 틀어진 가닥은 필드가 <b>교정해 주는 게 아니라 굳혀 준다</b>.
   클립은 그렇게 잘못 뻗은 결과를 잘라낼 뿐이라, 자르고 나서 조정하면 또 이상해진다.

   ── 극성을 어디서 얻는가 ────────────────────────────────────────────
   지어내지 않고 <b>마스크 기하</b>에서 잰다. 두피 쪽 경계(위쪽 이웃이 마스크가
   아닌 마스크 픽셀 = 모발이 시작하는 선)에서 거리장을 굽고, 그 <b>기울기</b>를
   쓴다. 거리는 뿌리에서 멀어질수록 커지므로 기울기는 언제나 <b>뿌리 반대쪽</b>,
   즉 모발 끝 쪽을 가리킨다. 옆머리처럼 가로로 흐르는 결에서도 맞는다(거리는
   아래로만이 아니라 결을 따라 늘어난다).

   기울기 크기가 곧 확신도다. 능선(거리장 마루 = 두 방향에서 같은 거리)에서는
   기울기가 0에 가까워지는데, 거기는 <b>실제로</b> 극성이 애매한 자리다.
   그런 곳에서는 예전 규칙(연속성)으로 돌아간다 — 모르는 것을 지어내지 않는다.

   ※ "그냥 아래(+y)를 기준으로 쓰면 되지 않나"를 먼저 생각했는데 틀렸다. 정수리
     결은 화면에서 거의 수평이라 아래와의 내적이 0 근처 — 부호가 노이즈로 정해진다.
     거리장 기울기는 그 자리에서도 바깥을 정확히 가리킨다.
══════════════════════════════════════════════════════════════════ */
const HAIR_FLOW = {
  on: true,            // false면 예전 동작(연속성으로만 극성 결정) — A/B용
  /* ── 2D 추적에는 안 건다 (2026-08-01, 사용자 확인) ────────────────────
     사용자: "3D가 그렇다는 거야? 원본결은 거의 맞아."
     맞다. 실기기 로그도 그렇게 말한다 — front 실루엣 IoU 0.968 · 실채움 98.9%
     · 결 일치 16.7°. 2D 추적(traceStrandPath)은 잘 돌고 있다.
     그러면 거기 손대는 건 <b>고칠 게 없는 곳을 흔드는 것</b>이다. 흐름장은
     3D 필드에 극성을 싣는 용도로만 쓰고, 2D 부호 규칙은 예전 그대로 둔다.
     (아래 코드는 남겨 둔다 — 2D가 틀어질 때 켜서 확인할 수 있게. 기본 꺼짐.) */
  applyTo2D: false,
  chamferPasses: 2,    // 전/후방 체임퍼 반복 — 오목한 실루엣에서 거리가 돌아 들어가게
  smoothR: 2,          // 기울기 내기 전 거리장 평활 반경(체임퍼 계단 노이즈 제거)
  minConf: 0.30,       // 기울기 크기가 이 미만이면 극성 미확정 → 예전 규칙으로
  /* 흐름이 <b>결 축과 거의 수직</b>이면 내적이 0 근처라 부호가 노이즈로 정해진다.
     (Node 하네스에서 잡았다: 가로로 흐르는 구간의 위쪽 경계도 씨앗이 되어 흐름이
     아래를 가리키는데, 결은 가로다 → 내적 0. 그대로 뒀으면 극성이 동전 던지기가
     되어 지금보다 나빠질 뻔했다.) 흐름이 결에 대해 의견을 가질 때만 쓴다. */
  minAlign: 0.35,      // |흐름·결| 이 미만이면 미확정(약 ±70° 밖) → 예전 규칙으로
  min3DPol: 0.35,      // 3D 셀 극성 일관도가 이 이상이면 필드 극성을 신뢰
  maxTurnAlign: 0.25,  // 필드 극성이 진행 방향과 90° 넘게 어긋날 때 한 스텝 정렬 상한
                       // (그대로 0.85를 먹이면 가닥이 제자리에서 접혀 핀이 생긴다)
  maxTurn2D: 0.25,     // 위와 같은 뜻의 2D판 — 스텝당 최대 45°까지만 되돌린다
};

/* 이 흐름이 이 결의 <b>부호를 정할 수 있는가</b>.
     +1 = angle 그대로  ·  -1 = angle+π  ·  0 = 모름(예전 규칙으로)
   부호를 정하는 유일한 출구라, 2D 추적과 3D 필드 적재가 같은 함수를 쓴다. */
function flowPolarityFor(angle, s){
  if(!HAIR_FLOW.on || !s || !(s.fc >= HAIR_FLOW.minConf)) return 0;
  const d = Math.cos(angle)*(s.fx||0) + Math.sin(angle)*(s.fy||0);
  if(Math.abs(d) < HAIR_FLOW.minAlign) return 0;
  return d < 0 ? -1 : 1;
}

/* 뿌리 거리장 → 단위 흐름 벡터(fx,fy) + 확신도(fc). 마스크만 보는 순수 계산. */
function buildRootFlowField(maskBuf, w, h){
  const N = w*h, INF = 1e9;
  const d = new Float32Array(N);
  for(let y=0; y<h; y++) for(let x=0; x<w; x++){
    const i = y*w + x;
    if(maskBuf[i] <= 128){ d[i] = INF; continue; }
    d[i] = (y === 0 || maskBuf[i-w] <= 128) ? 0 : INF;   // 두피 쪽 경계 = 씨앗
  }
  const A = 1, B = Math.SQRT2;
  for(let pass=0; pass<HAIR_FLOW.chamferPasses; pass++){
    for(let y=1; y<h; y++) for(let x=1; x<w-1; x++){
      const i = y*w + x; if(maskBuf[i] <= 128) continue;
      let v = d[i];
      if(d[i-1]   + A < v) v = d[i-1]   + A;
      if(d[i-w]   + A < v) v = d[i-w]   + A;
      if(d[i-w-1] + B < v) v = d[i-w-1] + B;
      if(d[i-w+1] + B < v) v = d[i-w+1] + B;
      d[i] = v;
    }
    for(let y=h-2; y>=0; y--) for(let x=w-2; x>=1; x--){
      const i = y*w + x; if(maskBuf[i] <= 128) continue;
      let v = d[i];
      if(d[i+1]   + A < v) v = d[i+1]   + A;
      if(d[i+w]   + A < v) v = d[i+w]   + A;
      if(d[i+w+1] + B < v) v = d[i+w+1] + B;
      if(d[i+w-1] + B < v) v = d[i+w-1] + B;
      d[i] = v;
    }
  }
  // 씨앗과 안 이어진 덩어리(고립 마스크)는 거리가 무한 — 0으로 눕혀 기울기 0이 되게
  for(let i=0;i<N;i++) if(d[i] >= INF) d[i] = 0;
  const ds = boxBlur(d, w, h, HAIR_FLOW.smoothR);
  const fx = new Float32Array(N), fy = new Float32Array(N), fc = new Float32Array(N);
  let conf = 0, inMask = 0;
  for(let y=1; y<h-1; y++) for(let x=1; x<w-1; x++){
    const i = y*w + x; if(maskBuf[i] <= 128) continue;
    inMask++;
    const gx = (ds[i+1] - ds[i-1]) * 0.5, gy = (ds[i+w] - ds[i-w]) * 0.5;
    const g = Math.hypot(gx, gy);
    if(!(g > 1e-6)) continue;
    fx[i] = gx/g; fy[i] = gy/g; fc[i] = Math.min(1, g);
    if(fc[i] >= HAIR_FLOW.minConf) conf++;
  }
  return { fx, fy, fc, inMask, conf };
}

function computeHairOrientationField(pixels, maskBuf, w, h){
  const gray = toGrayscale(pixels, w, h);
  const {Ix, Iy} = sobelGradients(gray, w, h);

  // 구조텐서 성분: Jxx=Ix², Jyy=Iy², Jxy=IxIy
  const n = w*h;
  const Jxx = new Float32Array(n);
  const Jyy = new Float32Array(n);
  const Jxy = new Float32Array(n);
  for(let i=0;i<n;i++){
    Jxx[i] = Ix[i]*Ix[i];
    Jyy[i] = Iy[i]*Iy[i];
    Jxy[i] = Ix[i]*Iy[i];
  }

  // 박스블러로 국소 평균 (윈도우 반경 3 ≈ 머리카락 다발 굵기 정도)
  const blurR = 3;
  const JxxB = boxBlur(Jxx, w, h, blurR);
  const JyyB = boxBlur(Jyy, w, h, blurR);
  const JxyB = boxBlur(Jxy, w, h, blurR);

  const angle = new Float32Array(n);
  const coherence = new Float32Array(n);

  for(let i=0;i<n;i++){
    if(maskBuf[i]===0) continue; // 머리카락 영역만 계산
    const jxx=JxxB[i], jyy=JyyB[i], jxy=JxyB[i];

    // 구조텐서의 고유값으로 coherence 계산
    const trace = jxx+jyy;
    const diff  = jxx-jyy;
    const disc  = Math.sqrt(diff*diff + 4*jxy*jxy);
    const lambda1 = (trace+disc)/2; // 큰 고유값 (그래디언트가 가장 강한 방향)
    const lambda2 = (trace-disc)/2; // 작은 고유값 (결방향, 변화가 가장 적은 방향)

    coherence[i] = (lambda1+lambda2) > 1e-6 ? (lambda1-lambda2)/(lambda1+lambda2) : 0;

    // 그래디언트가 가장 강한 방향(고유벡터, 결에 수직)을 구한 뒤 90도 회전 → 결방향
    // 2*theta = atan2(2*Jxy, Jxx-Jyy)  (구조텐서 표준 공식)
    const gradDir = 0.5 * Math.atan2(2*jxy, diff);
    let hairDir = gradDir + Math.PI/2; // 결방향 = 그래디언트 방향 + 90도

    // -PI/2 ~ PI/2 범위로 정규화 (선분이라 180도 주기성을 가짐)
    while(hairDir > Math.PI/2)  hairDir -= Math.PI;
    while(hairDir < -Math.PI/2) hairDir += Math.PI;

    angle[i] = hairDir;
  }

  // (옛 66 2026-10-11b) 방향을 가는 선 필터(가버 묶음)로 다시 읽음 — 아래 GABOR_ORIENT
  const f = {angle, coherence};
  GABOR_ORIENT.refine(f, pixels, maskBuf, w, h);
  // (옛 42) 컬 곡률·진폭·타래 조각·나선을 재 둠 — measureViewHairIdentity(03a)가 붙임
  if(typeof REGROW !== 'undefined') REGROW._afterOrientField(f, pixels, maskBuf, w, h);
  return f;
}
/* GABOR_ORIENT (옛 66-gabor-orient.js) — 결 읽기를 방향 필터(가버 묶음)로 (2026-10-11b)
 * 사용자: "어차피 차이가 없으면 방향필터로 가두면 실사사진갔을 때 효과를 볼거잖아?"
 * 지금(04번): 구조 텐서 — 주변 7×7 밝기 기울기를 평균 내서 방향을 구함. 직모엔 맞지만 가는 가닥·곱슬에선 여러 방향이 섞여 흐려짐.
 * 바꾼 것: 머리카락 한 올 굵기에 맞춘 "가는 선 필터"를 n방향(기본 16)으로 돌려 대 보고, 가장 크게 반응한 방향을 그 자리의 결로.
 *   그 뒤 믿을 만한(반응이 뚜렷한) 자리의 결로 둘레를 한 번 다듬음(이중각 평균). 머리 영역(mask) 픽셀만 계산.
 *   생성 사진(머리 영역 400px 남짓)에서는 지금 방식과 방향 차이 중앙값 4~6°(같은 결과) — 실사 고해상도에서 한 올 단위 결이 잡히는 쪽.
 *   coherence(결의 또렷함)는 뒤쪽 문턱값들이 지금 방식에 맞춰져 있어 04번 값을 그대로 씀. 방향(angle)만 바꿈.
 * (2026-10-12c) 시간 줄이기 — 사용자: "끝까지 건너뛰지 않고 가는 게 낫겠다. 그 횟수를 줄여서 시간을 줄이자."
 *   픽셀은 전부 계산(stride 1) · 방향 16 → 12(가장 센 방향과 양옆 반응으로 사이 각을 어림 interp) · 필터 칸 중 0에 가까운 칸(최대의 2% 미만)은 빼고 곱함(prune).
 *   합성 무늬(직모·웨이브·곱슬)에서 약 1.9배 빠르고 결 방향 차이 중앙 0.6~1.1° · 컬·웨이브 측정값(직선 판정·기울기·파장·진폭)은 거의 같음. 8방향 이하는 웨이브 기울기가 57° → 67°로 달라져 안 씀.
 *   예전대로: GABOR_ORIENT.n=16; .interp=false; .prune=0
 * 이 파일은 42번보다 먼저 올려야 함(42번이 이 함수를 감싸서 컬을 잼). 끄기 GABOR_ORIENT.on=false
 * 자리: 04 computeHairOrientationField 끝에서 GABOR_ORIENT.refine(f, …) · 03a measureViewHairIdentity 결과에 waveShape(GABOR_ORIENT.last.shape)
 */
var GABOR_ORIENT = (function () {
  var W = window, TAG = '[결 방향 필터]';
  var GO = Object.assign({ on: true, replace: true, stride: 1, prune: 0.02, interp: true, n: 12, lambda: 4, refine: true, stats: { calls: 0, ms: 0, px: 0, dMed: null } }, W.GABOR_ORIENT || {});
  var KC = {};
  function kernels(lam, n) {
    var key = lam + '|' + n; if (KC[key]) return KC[key];
    var sig = lam * 0.5, r = Math.max(2, Math.ceil(3 * sig)), sz = 2 * r + 1, gam = 0.5, out = [], k, x, y;
    for (k = 0; k < n; k++) {
      var t = k * Math.PI / n, ct = Math.cos(t), st = Math.sin(t), K = new Float32Array(sz * sz), sum = 0, i = 0;
      for (y = -r; y <= r; y++) for (x = -r; x <= r; x++) {
        var xr = x * ct + y * st, yr = -x * st + y * ct;
        var v = Math.exp(-(xr * xr + gam * gam * yr * yr) / (2 * sig * sig)) * Math.cos(2 * Math.PI * xr / lam);
        K[i++] = v; sum += v;
      }
      var mean = sum / (sz * sz); for (i = 0; i < K.length; i++) K[i] -= mean;
      out.push(K);
    }
    return (KC[key] = { K: out, r: r, sz: sz });
  }
  function sparse(KK, Wd) {                                               // (2026-10-12c) 필터 칸 중 값이 거의 0인 칸(가장 큰 값의 prune 미만)을 빼 둠 — 모든 픽셀을 계산하되 곱셈 수를 줄임
    if (!(GO.prune > 0)) return null;
    var key = 'sp' + GO.prune + '|' + Wd; if (KK[key]) return KK[key];
    var out = [], r = KK.r, sz = KK.sz, k, x, y;
    for (k = 0; k < KK.K.length; k++) {
      var K = KK.K[k], mx = 0, i, o = [], w = [], drop = 0;
      for (i = 0; i < K.length; i++) if (Math.abs(K[i]) > mx) mx = Math.abs(K[i]);
      for (y = -r, i = 0; y <= r; y++) for (x = -r; x <= r; x++, i++) { if (Math.abs(K[i]) >= GO.prune * mx) { o.push(y * Wd + x); w.push(K[i]); } else drop += K[i]; }
      var fix = drop / w.length; for (i = 0; i < w.length; i++) w[i] += fix;      // 뺀 칸의 합을 남은 칸에 고르게(합 0 유지 — 밝기만 다른 자리에 반응하지 않게)
      out.push({ o: Int32Array.from(o), w: Float32Array.from(w) });
    }
    KK.taps = out[0].o.length;
    return (KK[key] = out);
  }
  function gray(px, n) { var g = new Float32Array(n), i, j; for (i = 0, j = 0; i < n; i++, j += 4) g[i] = (0.299 * px[j] + 0.587 * px[j + 1] + 0.114 * px[j + 2]) / 255; return g; }
  function blur(a, Wd, Hd, sig) {                                          // 가우시안(분리) — 다듬기용
    var r = Math.max(1, Math.ceil(2.5 * sig)), k = new Float32Array(2 * r + 1), s = 0, i, x, y;
    for (i = -r; i <= r; i++) { k[i + r] = Math.exp(-i * i / (2 * sig * sig)); s += k[i + r]; } for (i = 0; i < k.length; i++) k[i] /= s;
    var t = new Float32Array(Wd * Hd), o = new Float32Array(Wd * Hd);
    for (y = 0; y < Hd; y++) for (x = 0; x < Wd; x++) { var v = 0; for (i = -r; i <= r; i++) { var xx = x + i; if (xx < 0) xx = 0; else if (xx >= Wd) xx = Wd - 1; v += k[i + r] * a[y * Wd + xx]; } t[y * Wd + x] = v; }
    for (y = 0; y < Hd; y++) for (x = 0; x < Wd; x++) { var v2 = 0; for (i = -r; i <= r; i++) { var yy = y + i; if (yy < 0) yy = 0; else if (yy >= Hd) yy = Hd - 1; v2 += k[i + r] * t[yy * Wd + x]; } o[y * Wd + x] = v2; }
    return o;
  }
  /* (2026-10-11b) 결을 따라 선을 그어 모양을 잼 — 사용자: "방향필터가 있는데 이거 구분해서 해야돼?"
   *  선마다: 굽는 방향이 번갈아 바뀌면 S자(웨이브), 한쪽으로만 계속 굽으면 고리(컬). 고리 정도 = |굽은 각의 합| ÷ 굽은 각 크기의 합(0 = S자 · 1 = 고리)
   *  파장 = 선 길이 × 2 ÷ 굽는 방향이 바뀐 횟수 · 진폭 = 선이 제 평균선(파장 폭)에서 벗어난 거리의 90% 값 ÷ 0.988   (사진 px) */
  GO.shapeStep = 10; GO.shapeMaxLen = 260; GO.shapeMinLen = 40;
  function shapeOf(ang, mask, Wd, Hd, rr) {
    var st = GO.shapeStep, lines = [], x0, y0;
    function trace(x, y, sgn) {
      var P = [], pdx = 0, pdy = 0, k;
      for (k = 0; k < GO.shapeMaxLen; k++) {
        var xi = x | 0, yi = y | 0; if (xi < rr || yi < rr || xi >= Wd - rr || yi >= Hd - rr) break;
        var id = yi * Wd + xi; if (!mask[id]) break;
        var t = ang[id], dx = Math.cos(t), dy = Math.sin(t);
        if (k === 0) { dx *= sgn; dy *= sgn; } else if (dx * pdx + dy * pdy < 0) { dx = -dx; dy = -dy; }
        if (k > 0 && dx * pdx + dy * pdy < 0.5) break;                     // 한 걸음에 60° 넘게 꺾이면(잡음) 멈춤
        P.push(x, y); x += dx; y += dy; pdx = dx; pdy = dy;
      }
      return P;
    }
    for (y0 = st; y0 < Hd - st; y0 += st) for (x0 = st; x0 < Wd - st; x0 += st) {
      if (!mask[y0 * Wd + x0]) continue;
      var a = trace(x0 + 0.5, y0 + 0.5, 1), b = trace(x0 + 0.5, y0 + 0.5, -1), P = [], i;
      for (i = b.length - 2; i >= 2; i -= 2) P.push(b[i], b[i + 1]);
      for (i = 0; i < a.length; i += 2) P.push(a[i], a[i + 1]);
      var n = P.length / 2; if (n < GO.shapeMinLen) continue;
      // 굽은 각(4px 간격 방향 차)
      var th = [], j; for (j = 4; j < n; j += 2) th.push(Math.atan2(P[j * 2 + 1] - P[(j - 4) * 2 + 1], P[j * 2] - P[(j - 4) * 2]));
      var kap = []; for (j = 1; j < th.length; j++) { var dd = th[j] - th[j - 1]; while (dd > Math.PI) dd -= 2 * Math.PI; while (dd < -Math.PI) dd += 2 * Math.PI; kap.push(dd); }
      var sm = []; for (j = 0; j < kap.length; j++) { var s2 = 0, c2 = 0, q; for (q = Math.max(0, j - 2); q <= Math.min(kap.length - 1, j + 2); q++) { s2 += kap[q]; c2++; } sm.push(s2 / c2); }
      var sAbs = 0, sSig = 0, flips = 0, last = 0; for (j = 0; j < sm.length; j++) { sAbs += Math.abs(sm[j]); sSig += sm[j]; if (Math.abs(sm[j]) > 0.02) { var sg = sm[j] > 0 ? 1 : -1; if (last && sg !== last) flips++; last = sg; } }
      var straight = sAbs < 0.6;
      var lam = flips > 0 ? 2 * n / flips : NaN;
      // 진폭: 파장 폭 이동 평균선에서 벗어난 거리
      var amp = NaN; if (isFinite(lam) && lam > 6 && lam < n) { var hw = Math.max(2, Math.round(lam / 2)), devs = []; for (j = hw; j < n - hw; j += 2) { var mx = 0, my = 0, c3 = 0, q2; for (q2 = j - hw; q2 <= j + hw; q2++) { mx += P[q2 * 2]; my += P[q2 * 2 + 1]; c3++; } devs.push(Math.hypot(P[j * 2] - mx / c3, P[j * 2 + 1] - my / c3)); } devs.sort(function (u, v) { return u - v; }); if (devs.length) amp = devs[Math.min(devs.length - 1, Math.floor(devs.length * 0.9))] / 0.988; }   // 90%(사인의 꼭대기 근처) — 뿌리 쪽 곧은 구간에 끌려 작게 재지 않게
      var cyS = 0, cxS = 0; for (j = 0; j < n; j++) { cxS += P[j * 2]; cyS += P[j * 2 + 1]; }
      lines.push({ n: n, straight: straight, loop: sAbs > 1e-6 ? Math.abs(sSig) / sAbs : 0, lam: lam, amp: amp, cx: cxS / n, cy: cyS / n });
    }
    function med(a) { a = a.filter(function (v) { return isFinite(v); }).sort(function (u, v) { return u - v; }); return a.length ? a[a.length >> 1] : NaN; }
    var bent = lines.filter(function (l) { return !l.straight; });
    // (2026-10-12i) 중앙값만이 아니라 선 하나하나를 넘김 — [머리 위→아래 자리 0~1, 가로 자리 0~1, 파장px, 진폭px, 고리 정도, 곧은 선이면 1]
    var yMn = Hd, yMx = 0, xMn = Wd, xMx = 0, q3; for (q3 = 0; q3 < Wd * Hd; q3 += 2) if (mask[q3]) { var yy3 = (q3 / Wd) | 0, xx3 = q3 - yy3 * Wd; if (yy3 < yMn) yMn = yy3; if (yy3 > yMx) yMx = yy3; if (xx3 < xMn) xMn = xx3; if (xx3 > xMx) xMx = xx3; }
    var dy3 = Math.max(1, yMx - yMn), dx3 = Math.max(1, xMx - xMn);
    var all = lines.map(function (l) { return [(l.cy - yMn) / dy3, (l.cx - xMn) / dx3, l.lam, l.amp, l.loop, l.straight ? 1 : 0]; });
    return { all: all, hairTopPx: yMn, hairBotPx: yMx, lines: lines.length, bent: bent.length, straightFrac: lines.length ? 1 - bent.length / lines.length : 1,
      loop: med(bent.map(function (l) { return l.loop; })), lamPx: med(bent.map(function (l) { return l.lam; })), ampPx: med(bent.map(function (l) { return l.amp; })) };
  }
  // 사진마다 identity에 붙임(42번의 컬 재기와 같은 자리)
  /* computeHairOrientationField(04) 끝에서 부름 — 04가 구한 방향(f.angle)을 방향 필터 값으로 바꿈 */
  GO.refine = function (f, px, mask, Wd, Hd) {
    if (!GO.on || !f || !f.angle || !px || px.length < Wd * Hd * 4 || !mask) return f;
    try {
      var t0 = performance.now(), N = Wd * Hd, g = gray(px, N), KK = kernels(GO.lambda, GO.n), r = KK.r, sz = KK.sz, n = GO.n;
      var SP = sparse(KK, Wd), RV = new Float32Array(n), ang = new Float32Array(N), conf = new Float32Array(N), idx, x, y, k, i, j, cnt = 0;
      var sd = (GO.refine && GO.stride > 1) ? (GO.stride | 0) : 1;         // 다듬기를 끄면 메울 방법이 없으니 전부 계산
      for (y = r; y < Hd - r; y += sd) for (x = r; x < Wd - r; x += sd) {
        idx = y * Wd + x; if (!mask[idx]) continue;
        var best = -1, bk = 0, sumR = 0;
        for (k = 0; k < n; k++) {
          var v = 0;
          if (SP) { var so = SP[k].o, sw = SP[k].w, sn = so.length; for (i = 0; i < sn; i++) v += sw[i] * g[idx + so[i]]; }   // 0에 가까운 칸은 빼고 곱함
          else { var K = KK.K[k], ki = 0; for (j = -r; j <= r; j++) { var row = (y + j) * Wd + x - r; for (i = 0; i < sz; i++) v += K[ki++] * g[row + i]; } }
          v = v < 0 ? -v : v; RV[k] = v; sumR += v; if (v > best) { best = v; bk = k; }
        }
        var bo = 0;
        if (GO.interp) { var vL = RV[(bk + n - 1) % n], vR = RV[(bk + 1) % n], den = vL - 2 * best + vR; if (den < -1e-12) { bo = 0.5 * (vL - vR) / den; if (bo > 0.5) bo = 0.5; else if (bo < -0.5) bo = -0.5; } }   // 가장 센 방향과 양옆 반응으로 사이 각을 어림(방향 수를 줄여도 각이 계단지지 않게)
        ang[idx] = (bk + bo) * Math.PI / n + Math.PI / 2; conf[idx] = best > 1e-9 ? (best - sumR / n) / best : 0; cnt++;
      }
      if (GO.refine) {                                                   // 믿을 만한 자리의 결로 둘레를 한 번 다듬음
        var C2 = new Float32Array(N), S2 = new Float32Array(N);
        for (idx = 0; idx < N; idx++) if (mask[idx]) { C2[idx] = Math.cos(2 * ang[idx]) * conf[idx]; S2[idx] = Math.sin(2 * ang[idx]) * conf[idx]; }
        C2 = blur(C2, Wd, Hd, GO.lambda * 0.6); S2 = blur(S2, Wd, Hd, GO.lambda * 0.6);
        for (idx = 0; idx < N; idx++) if (mask[idx]) { if (sd > 1 && C2[idx] === 0 && S2[idx] === 0) { ang[idx] = f.angle[idx]; } else ang[idx] = 0.5 * Math.atan2(S2[idx], C2[idx]); }   // 둘레에 계산한 자리가 하나도 없으면(가장자리 한 줄) 예전 방식 값
      }
      try { GO.last = { w: Wd, h: Hd, shape: shapeOf(ang, mask, Wd, Hd, r) }; } catch (e2) { GO.last = null; }
      GO.lastAng = ang; GO.lastConf = conf; GO.lastWH = [Wd, Hd];   // (2026-10-21) 34 결 읽기 단계가 구조텐서와 나란히 기록하려고 꺼내 둠(방향필터 방향 · 필터 반응 대비 = 방향필터의 결 또렷함)
      var A = f.angle, diffs = [];
      for (idx = 0; idx < N; idx++) {
        if (!mask[idx] || (idx % Wd) < r || (idx % Wd) >= Wd - r || idx < r * Wd || idx >= (Hd - r) * Wd) continue;
        var a = ang[idx]; while (a > Math.PI / 2) a -= Math.PI; while (a <= -Math.PI / 2) a += Math.PI;
        if ((idx & 63) === 0) { var dd = Math.abs(a - A[idx]); if (dd > Math.PI / 2) dd = Math.PI - dd; diffs.push(dd * 57.3); }
        if (GO.replace !== false) A[idx] = a;                               // 방향만 바꿈(coherence는 04번 값) · (2026-10-11c) replace=false면 결 읽기는 예전 방식 그대로(모양 재기만)
      }
      diffs.sort(function (p, q) { return p - q; });
      GO.stats.calls++; GO.stats.ms = Math.round(performance.now() - t0); GO.stats.px = cnt; GO.stats.dMed = diffs.length ? diffs[diffs.length >> 1] : null;
      console.log(TAG + ' ' + Wd + '×' + Hd + ' · 머리 픽셀 ' + cnt + ' · ' + n + '방향 · ' + GO.stats.ms + 'ms · 예전 방식과 방향 차이 중앙 ' + (GO.stats.dMed != null ? GO.stats.dMed.toFixed(1) + '°' : '-'));
    } catch (e) { console.warn(TAG + ' 실패 — 예전 방식 그대로', e); }
    return f;
  };
  console.log(TAG + ' 설치 — 사진 결을 ' + GO.n + '방향 가는 선 필터로 읽음(파장 ' + GO.lambda + 'px) · 끄기 GABOR_ORIENT.on=false');
  return GO;
})();

// 결방향 필드를 컬럼별 대표값으로 다운샘플 (가닥 렌더링에서 빠르게 참조하기 위함)
// 각 컬럼(x)에서 머리카락 마스크가 있는 y구간을 일정 간격으로 샘플링해 평균 방향 산출
function buildColumnOrientationSamples(angleField, coherenceField, maskBuf, w, h, samplesPerCol, flow){
  // (옛 64) 결을 3px마다 촘촘히 저장(SEG_ORIENT.dense) — 아래는 예전 방식(세로줄마다 samplesPerCol곳)
  if(typeof SEG_ORIENT !== 'undefined'){ const d = SEG_ORIENT._denseCols(angleField, coherenceField, maskBuf, w, h, samplesPerCol, flow); if(d) return d; }
  // colSamples[x] = [{y, angle, coherence, fx, fy, fc}, ...]  (y 오름차순)
  // fx,fy = 뿌리→끝 흐름 단위벡터(극성) · fc = 그 확신도. flow가 없으면 전부 0.
  const colSamples = new Array(w);
  for(let x=0;x<w;x++){
    const samples=[];
    let ys=[];
    for(let y=0;y<h;y++){ if(maskBuf[y*w+x]>0) ys.push(y); }
    if(ys.length===0){ colSamples[x]=samples; continue; }
    const step = Math.max(1, Math.floor(ys.length/samplesPerCol));
    for(let k=0;k<ys.length;k+=step){
      const y=ys[k], i=y*w+x;
      samples.push({y, angle:angleField[i], coherence:coherenceField[i],
                    fx: flow ? flow.fx[i] : 0, fy: flow ? flow.fy[i] : 0,
                    fc: flow ? flow.fc[i] : 0});
    }
    colSamples[x]=samples;
  }
  return colSamples;
}

// 특정 (x,y) 근방의 결방향을 컬럼 샘플에서 보간해서 반환 (가닥 그릴 때 사용)
function sampleOrientation(colSamples, x, w, y){
  // (옛 64) 촘촘히 저장된 사진은 위아래·옆 줄을 섞어 읽음(SEG_ORIENT)
  if(typeof SEG_ORIENT !== 'undefined'){ const r = SEG_ORIENT._sample(colSamples, x, w, y); if(r) return r; }
  const col = colSamples[Math.max(0,Math.min(w-1,Math.round(x)))];
  if(!col || col.length===0) return {angle:0, coherence:0};
  // y에 가장 가까운 두 샘플을 찾아 선형보간
  let lo=null, hi=null;
  for(let s of col){
    if(s.y<=y) lo=s;
    if(s.y>=y && !hi) hi=s;
  }
  if(lo && hi && lo!==hi){
    const t=(y-lo.y)/(hi.y-lo.y || 1);
    // 결방향은 "선분"이라 180도 주기성을 가짐 (+89도와 -89도는 사실상 같은 결).
    // hi.angle을 그대로 선형보간하면 -PI/2/+PI/2 경계를 넘나들 때 값이
    // 엉뚱하게 0(수평)으로 꺾여서, 뷰와 무관하게 고정된 높이에 가로 빗살
    // 아티팩트가 생김. hi.angle을 lo.angle과 가장 가까운 표현으로 맞춘 뒤 보간한다.
    let hiAngle = hi.angle;
    let diff = hiAngle - lo.angle;
    while(diff > Math.PI/2)  { hiAngle -= Math.PI; diff = hiAngle - lo.angle; }
    while(diff < -Math.PI/2) { hiAngle += Math.PI; diff = hiAngle - lo.angle; }
    /* 극성 벡터는 <b>벡터로</b> 섞는다 — 각도로 섞으면 360° 주기라 ±π 경계에서
       또 튄다(위 angle이 180° 때문에 겪은 것과 같은 함정, 한 바퀴 더 큰 버전). */
    const fx = (lo.fx||0) + (((hi.fx||0)) - (lo.fx||0))*t;
    const fy = (lo.fy||0) + (((hi.fy||0)) - (lo.fy||0))*t;
    const fl = Math.hypot(fx, fy);
    return {
      angle: lo.angle + diff*t,
      coherence: lo.coherence + (hi.coherence-lo.coherence)*t,
      fx: fl > 1e-6 ? fx/fl : 0, fy: fl > 1e-6 ? fy/fl : 0,
      // 섞으면서 서로 반대면 길이가 줄어든다 — 그 감쇠를 확신도에 그대로 반영
      fc: ((lo.fc||0) + (((hi.fc||0)) - (lo.fc||0))*t) * fl,
    };
  }
  return lo || hi || {angle:0, coherence:0, fx:0, fy:0, fc:0};
}

/* SEG_ORIENT (옛 64-seg-orient.js) — 머리 영역 다시 찾기 + 결 촘촘히 읽기 (2026-10-10b)
 *
 * ① 결 촘촘히 — 사용자: "그 예측 구간에서 튀는 게 생길 수도 있나?"
 *   지금(04번): 사진 세로줄마다 그 줄의 머리 픽셀 중 12곳만 결을 저장하고, 꺼낼 때 가장 가까운 줄 하나에서 위아래 두 점 사이를 직선으로 메움.
 *     단발 옆머리 줄이면 2~3cm마다 한 점 → 가마·가르마가 뭉개지고, 줄마다 점 자리가 달라 옆으로 걸을 때 결이 튀고,
 *     머리-피부-머리로 끊긴 줄은 틈을 건너 메움.
 *   지금: 결은 이미 모든 픽셀에서 계산돼 있음(버리고 있었음) → orientStepPx(3)픽셀마다 저장.
 *     꺼낼 때: 위아래 두 점은 바로 찾아감(점이 많아져도 빠름) · 옆 줄 둘을 섞음(결은 두 배 각으로 섞어 ±90° 경계에서 안 튐)
 *     · 틈(머리가 끊긴 자리)은 건너지 않고 "모름"(또렷함 0) — 기르는 쪽이 직전 방향을 이어 감.
 *     예전에 저장된 사진(12곳)은 예전처럼 메움(틈 규칙은 촘촘한 줄에만).
 * ② 머리 영역 다시 찾기 — 사용자: "세그멘테이션에서 빠지는 헤어들이 간혹 있거든? 크게 한번 잡고 나서 내부 헤어와 비슷한 것 재탐색하는 게 있나?"
 *   지금(03b번): 영역을 4픽셀 넓혀 "일반적인 머리색 + 결 무늬"면 넣음 → 이 손님 머리색이 아니라 일반 규칙이라 광택·밝은 머리·그림자에서 빠짐.
 *   지금: 영역이 정해진 직후(가장 큰 덩어리만 남긴 뒤)
 *     1) 가장자리를 깎은 안쪽 = "확실한 머리" → 이 손님 머리색을 배움(보통 머리 + 밝은 광택 두 무리, 밝기·색 성분의 평균과 퍼짐)
 *     2) 경계 바깥 띠(사진 폭의 segBand) 안에서, 기존 머리와 이어져 있고 · 이 손님 머리색에 들고 · 결 무늬가 있는 픽셀을 넣음(번져 나감)
 *     3) 머리 안의 구멍(바깥과 안 이어진 빈자리, 머리 넓이의 holeMax 이하)은 이 손님 머리색이거나 같은 색 성분에 더 밝으면(광택) 채움 — 광택을 두피로 센 자리
 *   이어진 것만 넣으므로 멀리 있는 비슷한 색(옷·배경)은 안 들어옴.
 * 끄기: SEG_ORIENT.dense=false · SEG_ORIENT.regrow=false (사진을 새로 분석할 때부터)
 * 넣는 자리: index.html에서 63-hair-look.js 다음. 사진을 분석하는 순간에 적용되므로 "저장한 사진 쓰기"로 불러온 사진에는 안 걸림 — 새로 찍거나 다시 분석.
 * 자리: 04, 파일 끝. 원래 함수에서 부르는 곳 —
 *   · buildColumnOrientationSamples · sampleOrientation · toGrayscale(04) — ① 결 촘촘히
 *   · keepLargestComponents(03b) 끝 — ② 머리 영역 다시 찾기 · fillUnseenRootCells(13c) 끝 — ③ 뿌리 고르게
 *   · adjustStrandGeom(17b) 맨 바깥 끝 — ④ 페이드를 원본 머리에도 · adjFilterSig 꼬리표 · perfPanelLines(18) 끝 줄
 *   (같은 파일에 있던 얼굴 막음 끄기는 13b HAIR_OCC3D.faceVeto 기본값, 맨 마네킹 맞추기는 17a toggleMannequin, 페이드 높이 구역은 17b FADE_ZONE)
 */
var SEG_ORIENT = (function () {
  'use strict';
  var W = window, TAG = '[영역·결 보강]';
  var SO = Object.assign({
    dense: true, orientStepPx: 3, gapK: 3, blendCols: true,
    regrow: true, segBand: 0.02, coreErode: 0.006, colorK: 2.6, glossQ: 0.85, texR: 2, holeMax: 0.15, cohMin: 0.5, minCore: 400
  }, W.SEG_ORIENT || {});
  var S = SO.stats = { views: [], dense: 0, samples: 0, err: null };

  /* ---------------- ① 결 촘촘히 ---------------- */
  /* buildColumnOrientationSamples(04) 맨 앞 — 촘촘히 저장한 줄들(아니면 null → 원래 본문) */
  SO._denseCols = function (angle, coh, mask, Wd, Hd, n, extra) {
    if (!SO.dense) return null;
    try {
      var step = Math.max(1, SO.orientStepPx | 0), cols = new Array(Wd), x, y, k, list, run, cnt = 0;
      for (x = 0; x < Wd; x++) {
        list = []; run = -1e9;
        for (y = 0; y < Hd; y++) {
          k = y * Wd + x; if (!(mask[k] > 0)) continue;
          if (y - run >= step) {
            list.push({ y: y, angle: angle[k], coherence: coh[k], fx: extra ? extra.fx[k] : 0, fy: extra ? extra.fy[k] : 0, fc: extra ? extra.fc[k] : 0 });
            run = y; cnt++;
          }
        }
        list._dense = step; cols[x] = list;
      }
      S.dense++; S.samples += cnt; if (S.dense <= 4) console.log(TAG + ' 결 촘촘히 저장 — ' + Wd + '×' + Hd + ' · 점 ' + cnt + '개(' + step + 'px마다)');
      return cols;
    } catch (e) { S.err = '결 저장: ' + (e && e.message || e); return null; }
  };
  function at1(col, Y) {                       // 한 줄에서 Y 자리의 결 — 위아래 두 점(바로 찾아감) · 틈은 안 건넘
    var n = col.length; if (!n) return null;
    var lo = 0, hi = n - 1, m;
    if (Y <= col[0].y) { return col._dense && col[0].y - Y > col._dense * SO.gapK ? null : col[0]; }
    if (Y >= col[n - 1].y) { return col._dense && Y - col[n - 1].y > col._dense * SO.gapK ? null : col[n - 1]; }
    while (hi - lo > 1) { m = (lo + hi) >> 1; if (col[m].y <= Y) lo = m; else hi = m; }
    var a = col[lo], b = col[hi];
    if (col._dense && b.y - a.y > col._dense * SO.gapK) {        // 머리가 끊긴 자리 — 가까운 쪽이 가까우면 그것, 아니면 모름
      if (Y - a.y <= col._dense * 1.5) return a; if (b.y - Y <= col._dense * 1.5) return b; return null;
    }
    var t = (Y - a.y) / ((b.y - a.y) || 1), ba = b.angle, d = ba - a.angle;
    while (d > Math.PI / 2) { ba -= Math.PI; d = ba - a.angle; }
    while (d < -Math.PI / 2) { ba += Math.PI; d = ba - a.angle; }
    var fx = (a.fx || 0) + ((b.fx || 0) - (a.fx || 0)) * t, fy = (a.fy || 0) + ((b.fy || 0) - (a.fy || 0)) * t, fl = Math.hypot(fx, fy);
    return { angle: a.angle + d * t, coherence: a.coherence + (b.coherence - a.coherence) * t, fx: fl > 1e-6 ? fx / fl : 0, fy: fl > 1e-6 ? fy / fl : 0, fc: ((a.fc || 0) + ((b.fc || 0) - (a.fc || 0)) * t) * fl };
  }
  var NONE = { angle: 0, coherence: 0, fx: 0, fy: 0, fc: 0 };
  /* sampleOrientation(04) 맨 앞 — 촘촘히 저장된 사진이면 그 값(아니면 null → 원래 본문) */
  SO._sample = function (ori, X, Wd, Y) {
    if (!ori) return null;
    var x0 = Math.max(0, Math.min(Wd - 1, Math.round(X))), c0 = ori[x0];
    if (!c0 || !c0._dense) return null;   // 예전 방식으로 저장된 사진
    if (!SO.blendCols) return at1(c0, Y) || NONE;
    var xf = Math.max(0, Math.min(Wd - 1, X)), xa = Math.floor(xf), xb = Math.min(Wd - 1, xa + 1), t = xf - xa;
    var A = ori[xa] ? at1(ori[xa], Y) : null, B = (xb !== xa && ori[xb]) ? at1(ori[xb], Y) : null;
    if (!A && !B) return NONE; if (!A) return B; if (!B || t < 1e-3) return A; if (t > 0.999) return B;
    var wa = (1 - t) * (A.coherence + 1e-3), wb = t * (B.coherence + 1e-3);
    var cx = wa * Math.cos(2 * A.angle) + wb * Math.cos(2 * B.angle), sy = wa * Math.sin(2 * A.angle) + wb * Math.sin(2 * B.angle);
    var ang = 0.5 * Math.atan2(sy, cx);
    var fx = (1 - t) * (A.fx || 0) + t * (B.fx || 0), fy = (1 - t) * (A.fy || 0) + t * (B.fy || 0), fl = Math.hypot(fx, fy);
    return { angle: ang, coherence: (1 - t) * A.coherence + t * B.coherence, fx: fl > 1e-6 ? fx / fl : 0, fy: fl > 1e-6 ? fy / fl : 0, fc: ((1 - t) * (A.fc || 0) + t * (B.fc || 0)) * fl };
  };

  /* ---------------- ② 머리 영역 다시 찾기 ---------------- */
  var last = null;                                   // 03b가 영역을 만들 때 넘긴 사진(RGBA)
  SO._noteGray = function (rgba, Wd, Hd, g) {   // toGrayscale(04) 끝 — 03b가 영역을 만들 때 넘긴 사진 기억
    try { if (rgba && rgba.length === Wd * Hd * 4) last = { rgba: rgba, W: Wd, H: Hd, gray: g }; } catch (e) {}
  };
  // (2026-10-10b) 03b가 toGrayscale을 늘 부르는 건 아니어서(실측: 다시 찾기가 한 번도 안 걸림) — 캔버스에서 픽셀을 읽을 때도 기억
  try {
    var CR = W.CanvasRenderingContext2D && W.CanvasRenderingContext2D.prototype, origGID = CR && CR.getImageData;
    if (origGID) CR.getImageData = function (sx, sy, sw, sh) {
      var im = origGID.apply(this, arguments);
      try { if (im && im.data && im.width * im.height * 4 === im.data.length && im.width >= 64 && im.height >= 64) lastGID = { rgba: im.data, W: im.width, H: im.height, gray: null }; } catch (e) {}
      return im;
    };
  } catch (e) {}
  var lastGID = null, noImg = 0;
  function feats(r, g, b) { return [0.299 * r + 0.587 * g + 0.114 * b, r - g, g - b]; }
  function stats(list) {
    var n = list.length / 3, m = [0, 0, 0], v = [0, 0, 0], i, j;
    for (i = 0; i < n; i++) for (j = 0; j < 3; j++) m[j] += list[i * 3 + j];
    for (j = 0; j < 3; j++) m[j] /= Math.max(1, n);
    for (i = 0; i < n; i++) for (j = 0; j < 3; j++) { var d = list[i * 3 + j] - m[j]; v[j] += d * d; }
    for (j = 0; j < 3; j++) v[j] = Math.max(j === 0 ? 36 : 9, v[j] / Math.max(1, n));
    return { m: m, s: v.map(Math.sqrt), n: n };
  }
  function inModel(md, f, k) { var d = 0, j; for (j = 0; j < 3; j++) { var z = (f[j] - md.m[j]) / md.s[j]; d += z * z; } return d <= k * k * 3; }
  function regrowMask(M, im) {
    var Wd = im.W, Hd = im.H, N = Wd * Hd, rgba = im.rgba, i, x, y, k;
    var er = Math.max(2, Math.round(Wd * SO.coreErode)), core = typeof W.erode === 'function' ? W.erode(M, Wd, Hd, er) : M;
    // 1) 이 손님 머리색
    var L = [], all = [];
    for (i = 0; i < N; i += 2) if (core[i] > 0) { var f = feats(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]); all.push(f); L.push(f[0]); }
    if (all.length < SO.minCore) return { M: M, note: '확실한 머리가 적어 건너뜀(' + all.length + ')' };
    L.sort(function (a, b) { return a - b; });
    var lq = L[Math.floor(L.length * SO.glossQ)], base = [], glos = [];
    all.forEach(function (f) { (f[0] <= lq ? base : glos).push(f[0], f[1], f[2]); });
    var mB = stats(base), mG = glos.length >= 30 ? stats(glos) : null;
    function hairLike(p) { var f = feats(rgba[p * 4], rgba[p * 4 + 1], rgba[p * 4 + 2]); return inModel(mB, f, SO.colorK) || (mG && inModel(mG, f, SO.colorK)); }
    function holeLike(p) {                         // 사방이 머리인 구멍 — 같은 색 성분인데 더 밝음(광택 띠)도 머리로
      var f = feats(rgba[p * 4], rgba[p * 4 + 1], rgba[p * 4 + 2]);
      return f[0] >= mB.m[0] - mB.s[0] && Math.abs(f[1] - mB.m[1]) <= SO.colorK * mB.s[1] + 0.25 * Math.max(0, f[0] - mB.m[0]) * Math.abs(mB.m[1]) / Math.max(1, mB.m[0]) + 6
        && Math.abs(f[2] - mB.m[2]) <= SO.colorK * mB.s[2] + 0.25 * Math.max(0, f[0] - mB.m[0]) * Math.abs(mB.m[2]) / Math.max(1, mB.m[0]) + 6;
    }
    var gray = im.gray || (typeof origGray === 'function' ? origGray(rgba, Wd, Hd) : null);
    function cohAt(p) {                            // 결 무늬가 한 방향으로 또렷한가(구조 텐서, 5×5) — 머리카락은 높고, 잡음·민무늬는 낮음
      if (!gray) return 1; var px = p % Wd, py = (p / Wd) | 0, r = 2, jxx = 0, jyy = 0, jxy = 0, xx, yy;
      if (px < r + 1 || py < r + 1 || px >= Wd - r - 1 || py >= Hd - r - 1) return 0;
      for (yy = py - r; yy <= py + r; yy++) for (xx = px - r; xx <= px + r; xx++) {
        var k2 = yy * Wd + xx, gx = (gray[k2 + 1] - gray[k2 - 1]) * 0.5, gy = (gray[k2 + Wd] - gray[k2 - Wd]) * 0.5;
        jxx += gx * gx; jyy += gy * gy; jxy += gx * gy;
      }
      var tr = jxx + jyy; if (tr < 1e-6) return 0;
      return Math.sqrt((jxx - jyy) * (jxx - jyy) + 4 * jxy * jxy) / tr;
    }
    function tex(p) {
      if (gray && cohAt(p) < SO.cohMin) return false;
      if (!gray || typeof W.hasHairTexture !== 'function') return true; return W.hasHairTexture(gray, Wd, Hd, p % Wd, (p / Wd) | 0, SO.texR);
    }
    var out = new Uint8Array(N); for (i = 0; i < N; i++) out[i] = M[i] > 0 ? 255 : 0;
    // 2) 경계 바깥 띠로 번져 나감(이어진 것만)
    var band = Math.max(3, Math.round(Wd * SO.segBand)), dil = typeof W.dilate === 'function' ? W.dilate(M, Wd, Hd, band) : null, added = 0;
    if (dil) {
      var q = new Int32Array(N), qh = 0, qt = 0, seen = new Uint8Array(N);
      for (y = 1; y < Hd - 1; y++) for (x = 1; x < Wd - 1; x++) { k = y * Wd + x; if (out[k] && (!out[k - 1] || !out[k + 1] || !out[k - Wd] || !out[k + Wd])) { q[qt++] = k; seen[k] = 1; } }
      while (qh < qt) {
        var p = q[qh++], px = p % Wd, py = (p / Wd) | 0, nb = [p - 1, p + 1, p - Wd, p + Wd], j2;
        for (j2 = 0; j2 < 4; j2++) {
          var c = nb[j2]; if (c < 0 || c >= N || seen[c]) continue;
          var cx2 = c % Wd; if (Math.abs(cx2 - px) > 1) continue;
          seen[c] = 1;
          if (out[c] || !dil[c]) continue;
          if (hairLike(c) && tex(c)) { out[c] = 255; added++; if (qt < N) q[qt++] = c; }
        }
      }
    }
    // 3) 안쪽 구멍(바깥과 안 이어진 빈자리) — 작은 것만, 이 손님 머리색이면
    var reach = new Uint8Array(N), st2 = [], filled = 0, holes = 0;
    for (x = 0; x < Wd; x++) { st2.push(x, (Hd - 1) * Wd + x); } for (y = 0; y < Hd; y++) { st2.push(y * Wd, y * Wd + Wd - 1); }
    while (st2.length) { var e = st2.pop(); if (e < 0 || e >= N || reach[e] || out[e]) continue; reach[e] = 1; var ex = e % Wd; if (ex > 0) st2.push(e - 1); if (ex < Wd - 1) st2.push(e + 1); st2.push(e - Wd, e + Wd); }
    var mArea = 0; for (i = 0; i < N; i++) if (M[i] > 0) mArea++;
    var lab = new Int32Array(N), cap = SO.holeMax * mArea;
    for (i = 0; i < N; i++) {
      if (out[i] || reach[i] || lab[i]) continue;
      holes++; var comp = [], st3 = [i]; lab[i] = holes;
      while (st3.length) { var h = st3.pop(); comp.push(h); var hx = h % Wd, nn = [hx > 0 ? h - 1 : -1, hx < Wd - 1 ? h + 1 : -1, h - Wd, h + Wd]; for (var j3 = 0; j3 < 4; j3++) { var c3 = nn[j3]; if (c3 < 0 || c3 >= N || out[c3] || reach[c3] || lab[c3]) continue; lab[c3] = holes; st3.push(c3); } }
      if (comp.length > cap) continue;
      comp.forEach(function (h2) { if (hairLike(h2) || holeLike(h2)) { out[h2] = 255; filled++; } });
    }
    var before = 0, after = 0; for (i = 0; i < N; i++) { if (M[i] > 0) before++; if (out[i]) after++; }
    return { M: out, added: added, filled: filled, before: before, after: after, model: { L: Math.round(mB.m[0]), Ls: Math.round(mB.s[0]), gloss: mG ? Math.round(mG.m[0]) : null } };
  }
  SO._regrowMask = function (R, Wd, Hd, frac) {   // keepLargestComponents(03b) 끝 — R = 큰 덩어리만 남긴 영역
    if (!SO.regrow || frac !== 0.03) return R;
    var im = (last && last.W === Wd && last.H === Hd) ? last : (lastGID && lastGID.W === Wd && lastGID.H === Hd) ? lastGID : null;
    if (!im) { noImg++; if (noImg <= 4) console.log(TAG + ' 머리 영역 다시 찾기 — 이 사진의 픽셀을 못 찾아 건너뜀(' + Wd + '×' + Hd + ')'); return R; }
    try {
      var t0 = performance.now(), r = regrowMask(R, im);
      var info = { ms: Math.round(performance.now() - t0), added: r.added || 0, filled: r.filled || 0, before: r.before || 0, after: r.after || 0, model: r.model || null, note: r.note || '' };
      S.views.push(info); if (S.views.length > 8) S.views.shift();
      console.log(TAG + ' 머리 영역 다시 찾기 — ' + (r.note || ('경계 밖에서 넣은 픽셀 ' + info.added + ' · 안쪽 구멍 채움 ' + info.filled + ' · 영역 ' + info.before + ' → ' + info.after + 'px(+' + ((info.after / Math.max(1, info.before) - 1) * 100).toFixed(1) + '%) · 이 손님 머리색 밝기 ' + (r.model ? r.model.L + '±' + r.model.Ls + (r.model.gloss != null ? ' · 광택 ' + r.model.gloss : '') : '-') + ' · ' + info.ms + 'ms')));
      last = null; lastGID = null;
      if (r.M === R) return R;
      // 원래 배열 형식에 맞춰 돌려줌
      var out = new (R.constructor || Uint8Array)(R.length); for (var i = 0; i < R.length; i++) out[i] = r.M[i] ? (R[i] > 0 ? R[i] : 255) : 0;
      return out;
    } catch (e) { S.err = '영역: ' + (e && e.message || e); console.warn(TAG + ' 영역 다시 찾기 실패', e); return R; }
  };

  /* ---------------- ③ 뿌리 고르게 (2026-10-10b) ----------------
   * 사용자: "roots 켜서 찍었는데 비는 곳들이 자꾸 나와. 듬성듬성하거나 대머리로 판정된 곳이 아니면 뿌리가 균일하게 채워져야 될 것 같아"
   * 실측(남자분): 머리가 있는 칸 안에 밀도 0.15 미만 칸이 섬처럼 박혀 있음 — 옆머리 귀 위 세로 띠, 뒤 정수리 옆 덩어리, 맨 위.
   *   사진의 광택·그림자를 "숱 없음"으로 센 자리(로그의 광택 보정이 다 못 되돌린 것)로 보임.
   * 지금: 뿌리 밀도를 다 만든 직후(13b/13c의 fillUnseenRootCells 뒤) — 머리가 있는 칸(두피 밖 아님) 중 밀도가 보통(잰 칸의 중앙값)의 rootLow 미만인 칸을
   *   이어진 덩어리로 묶어, 덩어리 넓이(실제 두피 넓이 — 정수리 꼭대기 칸은 작음)가 머리 넓이의 rootBaldArea 미만이면 보통의 rootFill배로 채움.
   *   그보다 큰 덩어리이면서 거의 비어 있으면(평균 rootBaldDen 미만) 진짜 빈 자리(대머리·M자)로 보고 그대로 둠.
   */
  Object.assign(SO, Object.assign({ rootFix: true, rootLow: 0.6, rootFill: 0.95, rootBaldArea: 0.04, rootBaldDen: 0.12 }, W.SEG_ORIENT_ROOT || {}));
  S.roots = [];
  SO._fillRoots = function (ro, r) {   // fillUnseenRootCells(13c) 끝
    if (!SO.rootFix) return r;
    try {
      var NT = ro.NT, NP = ro.NP, den = ro.den, est = ro.est, N = NT * NP, OFFv = typeof EST_OFFSCALP !== 'undefined' ? EST_OFFSCALP : 3, i;
      if (!den || !est) return r;
      var area = new Float64Array(N), meas = [], hairA = 0;
      for (i = 0; i < N; i++) { var row = (i / NT) | 0; area[i] = Math.sin((row + 0.5) / NP * Math.PI); if (est[i] !== OFFv && den[i] >= 0) { hairA += area[i]; if (est[i] === 0) meas.push(den[i]); } }
      if (meas.length < 20) return r;
      meas.sort(function (a, b) { return a - b; });
      var base = meas[meas.length >> 1], low = base * SO.rootLow, lab = new Int32Array(N), nl = 0, filled = 0, kept = 0, keptCells = 0;
      for (i = 0; i < N; i++) {
        if (lab[i] || est[i] === OFFv || !(den[i] < low)) continue;
        nl++; var comp = [], st = [i]; lab[i] = nl;
        while (st.length) {
          var c = st.pop(); comp.push(c); var cr = (c / NT) | 0, cc = c % NT;
          var nb = [cr > 0 ? c - NT : -1, cr < NP - 1 ? c + NT : -1, cr * NT + (cc + 1) % NT, cr * NT + (cc - 1 + NT) % NT];
          for (var j = 0; j < 4; j++) { var q = nb[j]; if (q < 0 || lab[q] || est[q] === OFFv || !(den[q] < low)) continue; lab[q] = nl; st.push(q); }
        }
        var A = 0, dsum = 0; comp.forEach(function (c2) { A += area[c2]; dsum += den[c2] * area[c2]; });
        if (A >= SO.rootBaldArea * hairA && dsum / Math.max(1e-9, A) < SO.rootBaldDen) { kept++; keptCells += comp.length; continue; }
        comp.forEach(function (c2) { den[c2] = Math.max(den[c2], base * SO.rootFill); filled++; });
      }
      var info = { base: +base.toFixed(2), filled: filled, groups: nl, keptGroups: kept, keptCells: keptCells };
      S.roots.push(info); if (S.roots.length > 4) S.roots.shift();
      console.log(TAG + ' 뿌리 고르게 — 보통 밀도 ' + info.base + ' · 낮은 칸 덩어리 ' + nl + '개 중 채운 칸 ' + filled + ' · 넓고 비어 있어 그대로 둔 덩어리 ' + kept + '개(' + keptCells + '칸 — 대머리·M자로 봄) · 끄기 SEG_ORIENT.rootFix=false');
    } catch (e) { S.err = '뿌리: ' + (e && e.message || e); }
    return r;
  };

  /* ---------------- ④ 페이드가 다시 기른 머리·결 표 머리에도 먹게 (2026-10-10c) ----------------
   * 사용자: "페이드가 왜 안 먹어? 직접 조정해도 안 먹어"
   * 원인: 페이드(17b fadeCutLen)는 마네킹 가닥을 자르는 길에만 들어 있음. 원본 머리(다시 기른 가닥 · 결 표대로 만든 가닥)는
   *   42·59번이 따로 모양을 만들어서 그 길을 안 지나감 → 토글·슬라이더를 움직여도 그대로.
   * 지금: 가닥 모양이 다 만들어진 뒤(맨 바깥) 같은 페이드 식으로 길이를 한 번 더 누름. 이미 잘린 가닥(마네킹 길)은 식이 "지금 길이와 페이드 길이 중 짧은 쪽"이라 그대로. */
  SO.fadeAll = true; S.fadeCut = 0; var FADE_SECS = { temple: 1, side: 1, occipital: 1, nape: 1 };
  SO._fadeAll = function (st, out) {   // adjustStrandGeom(17b) 맨 바깥 끝
    try {
      if (!SO.fadeAll || !out || out.length < 2 || !st || !st.pts || !st.sec) return out;
      if (!FADE_SECS[st.sec]) return out;                                   // 앱의 페이드와 같은 구역만(관자·옆·후두·목덜미)
      var fd = state.fade; if (!fd || !fd.enabled || typeof W.fadeCutLen !== 'function' || typeof W.sectionCutGuide !== 'function') return out;
      var sl = state.sections && state.sections[st.sec] ? state.sections[st.sec].length : 50;
      var gd = W.sectionCutGuide(st.sec, sl); if (!gd) return out;
      var L = 0, i; for (i = 1; i < out.length; i++) L += Math.hypot(out[i].x - out[i - 1].x, out[i].y - out[i - 1].y, out[i].z - out[i - 1].z);
      if (!(L > 1e-6)) return out;
      var Lf = W.fadeCutLen(st, gd, L);
      if (!(Lf < L * 0.995)) return out;
      var acc = 0, res = [out[0]];
      for (i = 1; i < out.length; i++) {
        var d = Math.hypot(out[i].x - out[i - 1].x, out[i].y - out[i - 1].y, out[i].z - out[i - 1].z);
        if (acc + d >= Lf) { var t = (Lf - acc) / Math.max(1e-9, d); res.push({ x: out[i - 1].x + (out[i].x - out[i - 1].x) * t, y: out[i - 1].y + (out[i].y - out[i - 1].y) * t, z: out[i - 1].z + (out[i].z - out[i - 1].z) * t }); break; }
        acc += d; res.push(out[i]);
      }
      if (res.length < 2) res.push(out[1]);
      for (var k in out) if (!/^\d+$/.test(k)) { try { res[k] = out[k]; } catch (e) {} }   // 붙어 있던 표시(_pre 등)
      S.fadeCut++;
      return res;
    } catch (e) { return out; }
  };
  SO._sigTail = function () {   // adjFilterSig(17b) 끝
    try { var fd = state.fade; return '|fdA' + (SO.fadeAll && fd && fd.enabled ? [fd.height, fd.guard, fd.taper, fd.blendWidth, fd.disc].join(',') : 0); } catch (e) { return ''; }
  };

  SO.lines = function () {
    var L = [TAG + ' 결 촘촘히 ' + (SO.dense ? '켜짐(' + SO.orientStepPx + 'px마다 · 옆 줄 섞기 ' + (SO.blendCols ? '켬' : '끔') + ' · 저장한 사진 ' + S.dense + '장 · 점 ' + S.samples + ')' : '꺼짐') +
      ' · 영역 다시 찾기 ' + (SO.regrow ? '켜짐' : '꺼짐') + ' · 페이드(원본 머리에도) ' + (SO.fadeAll ? '켜짐(자른 가닥 ' + S.fadeCut + ')' : '꺼짐') + ' · 뿌리 고르게 ' + (SO.rootFix ? '켜짐' + (S.roots.length ? '(채운 칸 ' + S.roots[S.roots.length - 1].filled + ')' : '') : '꺼짐') + (S.err ? ' · ⚠ ' + S.err : '')];
    S.views.forEach(function (v, i) { L.push('  사진 ' + (i + 1) + ': ' + (v.note || ('+' + v.added + ' · 구멍 ' + v.filled + ' · ' + v.before + '→' + v.after + 'px · ' + v.ms + 'ms'))); });
    return L;
  };
  console.log(TAG + ' 설치 — 사진 결을 ' + SO.orientStepPx + 'px마다 저장(예전: 세로줄마다 12곳) · 머리 영역을 이 손님 머리색·결 무늬로 다시 찾음. 새로 분석하는 사진부터 적용 · 끄기 SEG_ORIENT.dense=false / .regrow=false');
  return SO;
})();
