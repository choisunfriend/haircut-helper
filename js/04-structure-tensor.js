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

  return {angle, coherence};
}

// 결방향 필드를 컬럼별 대표값으로 다운샘플 (가닥 렌더링에서 빠르게 참조하기 위함)
// 각 컬럼(x)에서 머리카락 마스크가 있는 y구간을 일정 간격으로 샘플링해 평균 방향 산출
function buildColumnOrientationSamples(angleField, coherenceField, maskBuf, w, h, samplesPerCol, flow){
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

