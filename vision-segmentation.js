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
function buildColumnOrientationSamples(angleField, coherenceField, maskBuf, w, h, samplesPerCol){
  // colSamples[x] = [{y, angle, coherence}, ...]  (y 오름차순)
  const colSamples = new Array(w);
  for(let x=0;x<w;x++){
    const samples=[];
    let ys=[];
    for(let y=0;y<h;y++){ if(maskBuf[y*w+x]>0) ys.push(y); }
    if(ys.length===0){ colSamples[x]=samples; continue; }
    const step = Math.max(1, Math.floor(ys.length/samplesPerCol));
    for(let k=0;k<ys.length;k+=step){
      const y=ys[k], i=y*w+x;
      samples.push({y, angle:angleField[i], coherence:coherenceField[i]});
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
    return {
      angle: lo.angle + diff*t,
      coherence: lo.coherence + (hi.coherence-lo.coherence)*t
    };
  }
  return lo || hi || {angle:0, coherence:0};
}

