/* ════════════════════════════════════════
   RENDER / CANVAS
   - 이미지 캐시로 매번 new Image() 방지
   - hairCanvas 없으면 SVG 선 오버레이로 폴백
════════════════════════════════════════ */
const imgCache = {}; // angle → HTMLImageElement (loaded)

function getCachedImg(angle, cb){
  const url = state.shots[angle];
  if(!url){ cb(null); return; }
  if(imgCache[angle] && imgCache[angle].src.endsWith(url.slice(-20))){
    cb(imgCache[angle]); return;
  }
  const img = new Image();
  img.onload = ()=>{ imgCache[angle]=img; cb(img); };
  img.onerror = ()=>cb(null);
  img.src = url;
}

function drawImgOnCanvas(ctx, img, w, h){
  const {dw,dh,dx,dy} = computeFit(img.width, img.height, w, h);
  ctx.drawImage(img,dx,dy,dw,dh);
  return {dw,dh,dx,dy};
}

// fit 계산만 하고 실제로 그리지는 않음 (베이스를 원본 대신 baseC로 바로 그릴 때 사용)
function computeFit(imgW, imgH, w, h){
  const ir=imgW/imgH, cr=w/h;
  let dw,dh,dx,dy;
  if(ir>cr){dh=h;dw=h*ir;dx=(w-dw)/2;dy=0;}
  else{dw=w;dh=w/ir;dx=0;dy=(h-dh)/2;}
  return {dw,dh,dx,dy};
}

function syncCanvasSize(canvas){
  const rect=canvas.getBoundingClientRect();
  if(rect.width>0&&rect.height>0){canvas.width=rect.width;canvas.height=rect.height;}
}

// 핵심 렌더 함수
// 마스크 디버그 버튼 상태 동기화 (toggleMaskDebug/toggleRawDebug 양쪽에서 공용으로 사용)
function syncMaskDebugBtn(){
  const btn = document.getElementById('maskDebugToggle');
  if(btn){
    btn.classList.toggle('on', state.debugShowMask);
    btn.textContent = state.debugShowMask ? '가닥 보기' : '마스크 보기';
  }
}
// 마스크 디버그 토글: hairMaskBuf 실루엣을 색으로 채워서 그대로 보여줌(가닥 렌더링 대신)
// — 세그멘테이션이 실제로 어디를 "머리카락"으로 잡았는지(과잉/누락) 눈으로 바로 확인하기 위함
function toggleMaskDebug(){
  state.debugShowMask = !state.debugShowMask;
  if(state.debugShowMask) state.debugShowRaw = false; // 두 디버그 뷰는 동시에 켤 수 없음
  syncMaskDebugBtn();
  const rawBtn = document.getElementById('rawDebugToggle');
  if(rawBtn) rawBtn.classList.toggle('on', state.debugShowRaw);
  renderFrame(document.getElementById('adjustCanvas'), state.currentViewAngle);
}

// 원본 결 보기 토글: 스타일/슬라이더 값을 무시하고 전 섹션을 중립값
// (길이 50=원본 인식 길이 그대로, 볼륨 50, 컬 0)으로 렌더링해서
// "스타일 적용 전, 결방향 인식 자체가 얼마나 자연스러운지"만 순수하게 확인하기 위함.
// 실제 state.sections/selectedStyle은 건드리지 않고 화면 표시만 임시로 바꿈.
function toggleRawDebug(){
  state.debugShowRaw = !state.debugShowRaw;
  if(state.debugShowRaw) state.debugShowMask = false; // 두 디버그 뷰는 동시에 켤 수 없음
  const btn = document.getElementById('rawDebugToggle');
  if(btn){
    btn.classList.toggle('on', state.debugShowRaw);
    btn.textContent = state.debugShowRaw ? '스타일 보기' : '원본 결 보기';
  }
  syncMaskDebugBtn();
  const tag = document.getElementById('adjustStyleTag');
  if(tag){
    tag.textContent = state.debugShowRaw
      ? '원본 결 (스타일 미적용)'
      : (state.selectedStyle ? state.selectedStyle.name : '스타일 미선택');
  }
  renderFrame(document.getElementById('adjustCanvas'), state.currentViewAngle);
}

// 얼굴제거박스 진단 토글: 랜드마크 기반으로 계산된 "얼굴 영역 제거 박스"의
// 실제 경계(사각형 테두리)를 화면에 얹어서, 사진마다 각지게 나타나는 블록
// 아티팩트가 이 박스와 위치·모양이 일치하는지 눈으로 바로 확인하기 위함.
// 다른 디버그 뷰(마스크 보기/원본 결 보기)와 동시에 켤 수 있음 — 순수 오버레이라서 충돌 없음.
function toggleFaceBoxDebug(){
  state.debugShowFaceBox = !state.debugShowFaceBox;
  const btn = document.getElementById('faceBoxDebugToggle');
  if(btn) btn.classList.toggle('on', state.debugShowFaceBox);
  const maskInf = state.hairMasks[state.currentViewAngle];
  if(state.debugShowFaceBox && maskInf && maskInf.faceBoxDiag){
    console.log('[진단] 얼굴제거박스', state.currentViewAngle, maskInf.faceBoxDiag);
  } else if(state.debugShowFaceBox){
    console.log('[진단] 얼굴제거박스 없음(이 각도엔 박스가 적용되지 않음)', state.currentViewAngle);
  }
  renderFrame(document.getElementById('adjustCanvas'), state.currentViewAngle);
}

// 얼굴제거박스 테두리를 실제 화면 좌표로 변환해서 그림 (0~1 비율 → fit 기준 픽셀)
function drawFaceBoxDebugOverlay(ctx, fit, maskInf){
  if(!maskInf || !maskInf.faceBoxDiag) return;
  const b = maskInf.faceBoxDiag;
  const rx = fit.dx + b.xLeft * fit.dw;
  const ry = fit.dy + b.yTop  * fit.dh;
  const rw = (b.xRight - b.xLeft) * fit.dw;
  const rh = (b.yBottom - b.yTop) * fit.dh;
  ctx.save();
  ctx.strokeStyle = '#00e5ff';
  ctx.lineWidth = 3;
  ctx.setLineDash([8,6]);
  ctx.strokeRect(rx, ry, rw, rh);
  ctx.setLineDash([]);
  ctx.fillStyle = '#00e5ff';
  ctx.font = '11px JetBrains Mono, monospace';
  ctx.fillText(b.lmEstimated ? '얼굴박스(추정 랜드마크)' : '얼굴박스(실측 랜드마크)', rx, Math.max(12, ry - 4));
  ctx.restore();
}

function renderFrame(canvas, angle){
  syncCanvasSize(canvas);
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  if(w===0||h===0){ setTimeout(()=>renderFrame(canvas,angle),50); return; }

  getCachedImg(angle, (img)=>{
    ctx.clearRect(0,0,w,h);

    const hairC   = state.hairCanvases[angle];
    const baseC   = state.baseCanvases[angle];
    const maskInf = state.hairMasks[angle];

    if(state.debugShowMask && hairC && maskInf){
      // ── 마스크 디버그 뷰 ──
      // 가닥 렌더링을 완전히 건너뛰고, 원본 사진 위에 최종 결과만 단색으로 보여주는 대신,
      // "왜 이렇게 됐는지"를 색으로 구분해서 보여준다: 빨강=최종 머리카락,
      // 회색=얼굴박스라서 제외, 파랑=눈썹/눈/입 가드라서 제외.
      const fit = computeFit(img.width, img.height, w, h);
      ctx.drawImage(img, fit.dx, fit.dy, fit.dw, fit.dh); // 원본 사진 그대로

      ctx.save();
      ctx.globalAlpha = 0.6;
      if(maskInf.reasonCanvas){
        ctx.drawImage(maskInf.reasonCanvas, fit.dx, fit.dy, fit.dw, fit.dh);
      } else {
        // reasonCanvas가 없는 예전 캐시 데이터 대비 폴백: 기존 단색 방식
        const maskOverlay = document.createElement('canvas');
        maskOverlay.width = hairC.width; maskOverlay.height = hairC.height;
        const mCtx = maskOverlay.getContext('2d');
        mCtx.drawImage(hairC, 0, 0);
        mCtx.globalCompositeOperation = 'source-in';
        mCtx.fillStyle = '#ff2d55';
        mCtx.fillRect(0, 0, maskOverlay.width, maskOverlay.height);
        ctx.drawImage(maskOverlay, fit.dx, fit.dy, fit.dw, fit.dh);
      }
      ctx.restore();
      if(state.debugShowFaceBox) drawFaceBoxDebugOverlay(ctx, fit, maskInf);
      return;
    }

    if(hairC && baseC && maskInf && maskInf.scalpY){
      // ── 세그멘테이션 성공 ──
      // 레이어 순서:
      // [1] baseC (원본에서 머리카락 영역이 진짜로 지워진 베이스) → 얼굴·배경만
      // [2] 헤어컬러 언더코트 (마스크 실루엣을 평균 헤어컬러로 채움, 가닥 사이 빈틈 방지)
      // [3] 새 가닥 (scalpY 기반, 자유롭게 아래로 뻗음)
      // [4] 컬러 오버레이

      const fit = computeFit(img.width, img.height, w, h);

      // 이전 버그: 원본 img를 먼저 통째로 그린 뒤 baseC(머리 부분 투명)를
      // source-over로 덮었는데, 투명 픽셀은 source-over에서 아무 효과가 없어서
      // 원본 머리카락이 전혀 안 지워지고 그대로 남아있었음(가닥은 그 위에 얹히기만 함).
      // → baseC 자체를 베이스로 바로 그려서 머리카락 영역을 실제로 비운다.
      ctx.drawImage(baseC, fit.dx, fit.dy, fit.dw, fit.dh);

      // 헤어컬러 언더코트: hairC(원본 머리카락 픽셀, 마스크 실루엣 alpha)를
      // source-in으로 평균 헤어컬러 단색 채움 → 새 가닥이 성기게 그려진 틈새로
      // "원본 사진의 실제 머리카락"이 아니라 밋밋한 단색이 비치게 해서,
      // 새로 생성된 가닥의 실제 커버리지를 눈으로 정확히 판단할 수 있게 함
      const avgColor = maskInf.avgColor;
      const undercoat = document.createElement('canvas');
      undercoat.width = hairC.width; undercoat.height = hairC.height;
      const uCtx = undercoat.getContext('2d');
      uCtx.drawImage(hairC, 0, 0);
      uCtx.globalCompositeOperation = 'source-in';
      uCtx.fillStyle = avgColor;
      uCtx.fillRect(0, 0, undercoat.width, undercoat.height);
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.drawImage(undercoat, fit.dx, fit.dy, fit.dw, fit.dh);
      ctx.restore();

      // 원본 결 보기(debugShowRaw): 실제 state.sections/selectedStyle은 그대로 두고,
      // 화면에 넘기는 값만 중립값으로 덮어씀 — 길이 50(=원본 인식 길이 그대로),
      // 볼륨 50, 컬 0(순수 결방향만 따라감), 색상은 스타일 틴트 대신 실제 인식된 평균 헤어컬러.
      const rawMode = state.debugShowRaw;
      const {curl,volume,thickness} = rawMode
        ? {curl:0, volume:50, thickness:50}
        : state.sliders[angle];
      const sectionsForRender = rawMode
        ? Object.fromEntries(Object.entries(state.sections).map(([id,s])=>[id, {...s, length:50}]))
        : state.sections;
      const maskW = maskInf.w, maskH = maskInf.h;
      const scalpY   = maskInf.scalpY;
      const hairEndY = maskInf.hairEndY;

      const validCount = Array.from(scalpY).filter(y=>y>=0).length;

      if(validCount > maskW * 0.05){
        // 가닥 오버레이 — origLen 이내는 hairCanvas 마스크로 clip, 연장분은 clip 없음(drawHairStrands 내부에서 처리)
        drawHairStrands(ctx, fit, scalpY, hairEndY, maskW, maskH, hairC, {
          curl, volume, thickness,
          angle, sections: sectionsForRender, // 컬럼별로 섹션을 판정해 길이를 다르게 적용하기 위함
          color: rawMode ? maskInf.avgColor : ((state.selectedStyle ? state.selectedStyle.colorHex : null) || maskInf.avgColor),
          orientation: maskInf.orientation,       // 결방향 컬럼 샘플 (축소해상도 좌표)
          orientMaskW: maskInf.maskW,              // 결방향 필드가 계산된 축소 해상도 폭
          orientMaskH: maskInf.maskH,              // 결방향 필드가 계산된 축소 해상도 높이
        });

        // 컬러 오버레이 (원본 결 보기 모드에서는 스킵 — 스타일 미적용 상태를 그대로 보여줘야 함)
        if(state.selectedStyle && !rawMode){
          ctx.save();
          ctx.globalCompositeOperation='multiply';
          ctx.globalAlpha=0.15;
          ctx.fillStyle=state.selectedStyle.colorHex;
          const minScalpY = Math.min(...Array.from(scalpY).filter(y=>y>=0));
          const maxHairY  = Math.max(...Array.from(hairEndY).filter(y=>y>=0));
          const top    = fit.dy + (minScalpY/maskH)*fit.dh;
          const bottom = fit.dy + (maxHairY/maskH)*fit.dh * (0.6 + (state.sections.crown.length/100)*1.0);
          ctx.fillRect(fit.dx, top, fit.dw, bottom - top);
          ctx.restore();
        }
      }
      if(state.debugShowFaceBox) drawFaceBoxDebugOverlay(ctx, fit, maskInf);

    } else if(img){
      // ── 세그멘테이션 없음: 원본만 표시 (SVG 폴백 제거) ──
      drawImgOnCanvas(ctx, img, w, h);
    } else {
      ctx.fillStyle='#211D19'; ctx.fillRect(0,0,w,h);
      ctx.fillStyle='#52483D'; ctx.font='13px Inter'; ctx.textAlign='center';
      ctx.fillText('이 각도의 사진이 없습니다', w/2, h/2);
    }
  });
}

/* ────────────────────────────────────────
   가닥 렌더링
   - 2단계 clip: 원본 인식 길이(origLen) 이내는 hairCanvas(마스크)로 clip해서
     마스크 밖으로 절대 안 나감 / 슬라이더로 늘어난 연장분만 clip 없이 자유롭게
   - 두피 라인(scalpY)에서 출발, 길이·컬·볼륨 슬라이더 반영
   - 미용 "섹션" 개념: 굵은 면 레이어 + 가는 가닥 레이어 혼합
──────────────────────────────────────── */
function drawHairStrands(ctx, fit, scalpY, hairEndY, maskW, maskH, hairCanvas, opts){
  const {curl, volume, thickness, color, orientation, orientMaskW, orientMaskH, angle, sections} = opts;

  const curlAmt     = (curl/100) * fit.dw * 0.07;
  const alpha       = 0.45 + (thickness/100) * 0.40;

  // 길이 슬라이더가 높을 때(특히 정면 프론트) 가닥이 이마 라인을 넘어
  // 눈·안경·턱까지 뚫고 내려가는 과확장을 막기 위한 상한.
  // maskH(축소 해상도 이미지 전체 높이)의 1.15배까지만 허용 — 화면 밖까지
  // 늘어나는 극단적인 경우를 방지하면서도 "길게" 설정한 효과는 유지.
  const maxStrandLen = maskH * 1.15;

  const validCols = [];
  for(let x=0; x<maskW; x++){
    if(scalpY[x] >= 0) validCols.push(x);
  }
  if(validCols.length === 0) return;

  // ── 보간: validCols 안에서 hairEndY/scalpY -1인 열을 인접 유효값으로 채움 ──
  const iScalpY   = new Float32Array(maskW).fill(-1);
  const iHairEndY = new Float32Array(maskW).fill(-1);
  for(let x=0;x<maskW;x++){ iScalpY[x]=scalpY[x]; iHairEndY[x]=hairEndY[x]; }
  // forward pass
  let lS=-1, lE=-1;
  for(let x=0;x<maskW;x++){
    if(iScalpY[x]>=0)   lS=iScalpY[x];   else if(lS>=0) iScalpY[x]=lS;
    if(iHairEndY[x]>=0) lE=iHairEndY[x]; else if(lE>=0) iHairEndY[x]=lE;
  }
  // backward pass
  let fS=-1, fE=-1;
  for(let x=maskW-1;x>=0;x--){
    if(iScalpY[x]>=0)   fS=iScalpY[x];   else if(fS>=0) iScalpY[x]=fS;
    if(iHairEndY[x]>=0) fE=iHairEndY[x]; else if(fE>=0) iHairEndY[x]=fE;
  }

  // curl 방향 기준: 마스크 실제 수평 중심
  const maskCX = validCols.reduce((a,b)=>a+b,0) / validCols.length;

  // ── 컬럼별 길이 변화량(절대값, px): 슬라이더 50 = 원본 길이 그대로.
  // 슬라이더 1칸당 변화량이 원본 길이(origLen)와 무관하게 항상 동일하도록
  // "배율" 대신 "덧셈"으로 계산 — 크라운(긴 부위)이든 사이드(짧은 부위)든
  // 슬라이더를 같은 칸수만큼 움직이면 같은 만큼만 길이가 변함.
  const lenDeltaCache = new Float32Array(maskW).fill(NaN);
  // 슬라이더 1칸(0~100)당 변화량 = 이미지 높이(maskH)의 0.6% — 튜닝 필요시 이 상수만 조정
  const LENGTH_STEP_PER_UNIT = maskH * 0.006;
  function lengthDeltaFor(ix){
    const cx = Math.min(maskW-1, Math.max(0, Math.round(ix)));
    if(!Number.isNaN(lenDeltaCache[cx])) return lenDeltaCache[cx];
    const ny = iScalpY[cx] >= 0 ? iScalpY[cx]/maskH : 0.15;
    const nx = cx/maskW;
    const secId = (sections && angle) ? resolveSectionId(angle, nx, ny) : 'crown';
    const lenParam = (sections && sections[secId] && typeof sections[secId].length==='number')
      ? sections[secId].length : 50;
    const delta = (lenParam - 50) * LENGTH_STEP_PER_UNIT;
    lenDeltaCache[cx] = delta;
    return delta;
  }

  const toCanvasX = (ix) => fit.dx + (ix / maskW) * fit.dw;
  const toCanvasY = (iy) => fit.dy + (iy / maskH) * fit.dh;

  // scalpY 좌표계(maskW,maskH) → orientation 필드 좌표계(orientMaskW,orientMaskH) 변환 비율
  const hasOrientation = !!(orientation && orientMaskW && orientMaskH);
  const ox = hasOrientation ? orientMaskW / maskW : 1;
  const oy = hasOrientation ? orientMaskH / maskH : 1;

  const cw = ctx.canvas.width, ch = ctx.canvas.height;

  // ── 2단계 clip 구조 ──
  // baseOffscreen: 원본 인식 길이(origLen) 구간 → 나중에 hairCanvas(실제 세그멘테이션
  //   마스크)로 destination-in clip을 걸어서, 실제 인식된 머리카락 영역 밖(얼굴·안경·배경
  //   등)으로는 절대 못 나가게 함. "지금 이 사람의 실제 머리 모양"을 그대로 보여주는 단계.
  // extOffscreen: 슬라이더로 origLen을 넘겨서 늘어난 구간(연장분)만 → clip 없이 자유롭게
  //   그림. "스타일링 시뮬레이션으로 늘려본" 부분이라 원본 마스크 밖으로 나가는 게 정상.
  // 보폭(한 스텝의 물리적 이동 거리)을 고정값으로 둔다 — 더 이상 목표 길이(targetLen)에
  // 비례해서 커지지 않는다. 이렇게 해야 origLen까지 가는 구간이 delta(슬라이더로 늘린 양)와
  // 무관하게 항상 "같은 지점에서, 같은 보폭으로, 같은 물리적 위치의 결방향을 샘플링"하게 되어
  // 원본 결 보기 때와 스타일 적용 때의 base 구간 경로가 완전히 일치한다.
  // (기존엔 STEPS=14로 고정하고 stepLen=targetLen/14로 역산해서, delta가 커질수록 보폭 자체가
  //  커져 origLen 구간마저 원본과 다른 경로로 재계산되는 문제가 있었음)
  const STRAND_STEP_LEN = maskH * 0.025;

  const baseOffscreen = document.createElement('canvas');
  baseOffscreen.width = cw; baseOffscreen.height = ch;
  const baseCtx = baseOffscreen.getContext('2d');
  baseCtx.lineCap  = 'round';
  baseCtx.lineJoin = 'round';

  const extOffscreen = document.createElement('canvas');
  extOffscreen.width = cw; extOffscreen.height = ch;
  const extCtx = extOffscreen.getContext('2d');
  extCtx.lineCap  = 'round';
  extCtx.lineJoin = 'round';

  // base/ext 두 컨텍스트에 동일한 스타일(굵기·투명도·색상)을 한 번에 적용하기 위한 헬퍼
  function setStyle(prop, val){ baseCtx[prop] = val; extCtx[prop] = val; }

  /**
   * traceStrand: 시작점(ix,sy_img)에서 목표 길이(targetLen)만큼
   * 결방향 필드를 따라 작은 스텝으로 전진하며 경로를 추적한다.
   * 결방향 데이터가 없거나 coherence가 낮은 구간에서는 자연스러운
   * 약한 흔들림(curlAmt 기반)으로 보강하여 완전히 끊기지 않게 한다.
   * @returns canvas 좌표계 점 배열 [{x,y}, ...] (길이 steps+1, steps는 목표 길이에 따라 가변)
   */
  function traceStrand(ix, sy_img, targetLen_img, jitterSeed){
    const stepLen = STRAND_STEP_LEN; // 고정 보폭 — targetLen_img에서 역산하지 않음
    const steps = Math.max(2, Math.round(targetLen_img / stepLen));
    const pts = [{x:ix, y:sy_img}]; // 마스크 좌표계(maskW,maskH 기준)로 누적
    // baseDir: curl/wiggle을 얹기 전, "결방향만" 반영한 순수 진행방향.
    // 다음 스텝의 orientation 블렌딩 기준(연속성 유지)으로 이것만 이어받는다.
    // → curl 보정을 여기 포함시켜 이어받으면 매 스텝 같은 방향으로 계속
    //   꺾이는 게 누적되어(부호가 안 바뀌는 sideDir 특성상) 긴 가닥일수록
    //   결국 옆으로 거의 수평이 되어 뻗어나가는 문제가 있었음.
    let baseDir = Math.PI/2;

    for(let s=0; s<steps; s++){
      const cur = pts[pts.length-1];
      let dir = baseDir;

      // 처음 2스텝은 orientation 필드 참조를 건너뜀.
      // 이유: 모든 가닥이 scalpY(두피 경계선) 바로 위에서 출발하는데,
      // 그 경계 픽셀 자체가 "머리카락↔배경" 급격한 명암차 경계라
      // Structure Tensor가 이 경계선 자체를 결로 착각해서 가로 방향을
      // 결방향으로 잘못 계산함. 그 결과 모든 가닥이 시작하자마자
      // 옆으로 꺾여서, 뷰 각도와 무관하게 두피 경계 높이에 가로
      // "빗살 띠"가 생기는 근본 원인이었음.
      // → 경계에서 살짝 벗어난 뒤(2스텝, 자연스러운 아래방향 진행)부터
      //   결방향을 신뢰하고 따라가도록 함.
      if(hasOrientation && s >= 2){
        const sample = sampleOrientation(orientation, cur.x*ox, orientMaskW, cur.y*oy);
        if(sample.coherence > 0.12){
          // sample.angle은 atan2 좌표계(0=+x축/가로, ±PI/2=+y축 방향/세로)로 계산된
          // "결의 방향" 그 자체이며, cos/sin을 취하면 바로 진행 단위벡터가 된다.
          // 단, 결방향은 선분이라 180도 모호성이 있음(angle과 angle+PI가 동일한 결)
          // → 고정된 "아래쪽" 기준이 아니라 baseDir과 더 가까운 쪽을 선택해야
          //   수평에 가까운 결(0도 경계)에서 지그재그 튐이 생기지 않음
          let targetDir = sample.angle;
          let deltaCheck = targetDir - baseDir;
          while(deltaCheck > Math.PI) deltaCheck -= Math.PI*2;
          while(deltaCheck < -Math.PI) deltaCheck += Math.PI*2;
          if(Math.abs(deltaCheck) > Math.PI/2){
            // 반대 표현(targetDir+PI)이 baseDir에 더 가까움 → 그쪽 채택
            targetDir += Math.PI;
          }
          // coherence가 높을수록 결방향을 강하게 따름, 낮으면 이전 방향 유지 비중↑
          const w = Math.min(1, sample.coherence * 1.3);
          // 각도를 보간 (최단 회전 방향으로)
          let delta = targetDir - baseDir;
          while(delta > Math.PI) delta -= Math.PI*2;
          while(delta < -Math.PI) delta += Math.PI*2;
          dir = baseDir + delta * w;
        } else {
          // 결방향을 못 믿는 구간(coherence 낮음 — 대부분 마스크 밖 ext 구간에서 발생).
          // "중력"으로 명명: 실제 머리카락도 뿌리 쪽은 결방향(웨이브·컬)을 유지하지만
          // 끝으로 갈수록 자체 무게 때문에 점점 아래로 처짐. 그래서 이 복원력을
          // 상수로 고정하지 않고 진행할수록(s/steps↑) 커지게 해서, 마스크를 막
          // 벗어난 시점의 baseDir이 대각선이어도 끝에 가서는 결국 아래쪽으로
          // 붙잡히도록 함. (예전엔 0.15 고정이라 대각선 방향을 거의 그대로
          // 유지한 채 곧게 뻗어나가 눈썹을 가로지르는 등의 문제가 있었음)
          let restore = Math.PI/2 - baseDir;
          while(restore > Math.PI) restore -= Math.PI*2;
          while(restore < -Math.PI) restore += Math.PI*2;
          // TEST: 얼굴박스 사각 블록 원인 검증용 임시 스위치. true면 중력 복원력을 0으로 만들어
          // ext 구간이 baseDir(결방향)을 그대로 유지하게 함. 블록이 옅어지면 중력이 증폭 원인 확정.
          // → 검증 완료, 원인 아니었음. clamp만으로는 대각선 처짐을 못 막아 중력 복원.
          const DEBUG_DISABLE_GRAVITY = false;
          const gravityPull = DEBUG_DISABLE_GRAVITY ? 0 : (0.15 + (s/steps) * 0.35); // 시작 0.15 → 끝 0.5
          dir = baseDir + restore * gravityPull;
        }
      }

      // 방향 상한(clamp): 결방향 오판·중력 부족 등 어떤 이유로든 진행 방향이
      // 아래(PI/2) 기준 좌우 60도를 넘어서지 못하게 강제. 눈썹을 가로지르거나
      // 배경으로 옆·위로 새는 걸 구조적으로 막는 안전장치.
      const MAX_DIR_DEVIATION = Math.PI/3; // 60도
      let devFromDown = dir - Math.PI/2;
      while(devFromDown > Math.PI) devFromDown -= Math.PI*2;
      while(devFromDown < -Math.PI) devFromDown += Math.PI*2;
      if(devFromDown > MAX_DIR_DEVIATION) dir = Math.PI/2 + MAX_DIR_DEVIATION;
      else if(devFromDown < -MAX_DIR_DEVIATION) dir = Math.PI/2 - MAX_DIR_DEVIATION;

      baseDir = dir; // 다음 스텝 기준은 curl 적용 전 방향으로 저장 (누적 방지)

      // curl 슬라이더 + 자연스러운 미세 흔들림 추가 (완전 직선 방지)
      // — 이번 스텝의 "이동"에만 적용하고 baseDir에는 반영하지 않으므로 누적되지 않음
      // wiggleGrowth: 진행할수록(s/steps) 흔들림 폭을 키운다. 가닥 개수(numSections/numMid/numFine)는
      // 길이와 무관하게 고정인데, 가닥이 길어질수록(scaledLen↑) 같은 개수가 더 넓은 영역에 퍼져서
      // 가닥 사이 간격이 벌어지고 "세로줄"처럼 분리되어 보이는 문제가 있었음. 시작 지점 근처는
      // 기존과 거의 동일하게 촘촘히 유지하고, 끝으로 갈수록 좌우로 더 크게 흔들리게 해서
      // 인접 가닥끼리 자연스럽게 겹치도록(overlap) 만들어 그 틈을 시각적으로 메운다.
      const wiggleGrowth = 1 + (s/steps) * 1.8;
      const wiggle = (Math.sin((s+jitterSeed)*0.9) * 0.12 + (Math.random()-0.5)*0.10) * wiggleGrowth;
      // curl: 기존엔 가닥 전체에 걸쳐 한 번만 크게 휘는 반원(sin 반 주기) 형태라, 결방향(orientation)과
      // 충돌하면 갑자기 옆으로 삐져나가는 모양이 생겼음. 파마머리/라면 면발처럼 일정한 파장으로
      // 완만하게 반복되는 웨이브로 변경 — curl 슬라이더는 진폭(구불거림 정도)만 조절.
      const CURL_WAVELENGTH_STEPS = 6; // 몇 스텝마다 한 번 파동이 반복되는지 — 값을 낮추면 더 자잘하게, 높이면 더 완만하게
      const curlPhase = (s / CURL_WAVELENGTH_STEPS) * Math.PI * 2;
      const curlComponent = Math.sin(curlPhase + jitterSeed) * (curl/100) * 0.07;
      const travelDir = dir + curlComponent + wiggle;

      // 실제 전진: travelDir은 "이미지 평면에서의 각도"이며 y축 기준 아래가 양수
      const dx = Math.cos(travelDir) * stepLen;
      const dy = Math.sin(travelDir) * stepLen;
      pts.push({x: cur.x + dx, y: cur.y + dy});
    }

    return pts;
  }

  // 마스크 좌표(이미지 픽셀 기준) 점 배열 → 캔버스 좌표로 변환
  function toCanvasPts(pts){
    return pts.map(p => ({ x: toCanvasX(p.x), y: toCanvasY(p.y) }));
  }

  // 점 배열을 부드러운 곡선으로 그림 (quadratic 중간점 보간) — 대상 컨텍스트를 인자로 받음
  function strokePolyline(targetCtx, cPts){
    if(cPts.length < 2) return;
    targetCtx.beginPath();
    targetCtx.moveTo(cPts[0].x, cPts[0].y);
    for(let i=1;i<cPts.length-1;i++){
      const mx = (cPts[i].x + cPts[i+1].x)/2;
      const my = (cPts[i].y + cPts[i+1].y)/2;
      targetCtx.quadraticCurveTo(cPts[i].x, cPts[i].y, mx, my);
    }
    const last = cPts[cPts.length-1];
    targetCtx.lineTo(last.x, last.y);
    targetCtx.stroke();
  }

  // delta(슬라이더로 실제 늘린 양)와 고정 보폭(STRAND_STEP_LEN)을 기준으로 base/ext 분할
  // 지점을 계산. delta<=0(늘리지 않았거나 줄인 경우)이면 무조건 전체 clip(base) — origLen
  // (원본)보다 짧은 최소 길이 하한선(maskH*0.02) 보정 때문에 scaledLen이 origLen보다 커지는
  // 경우가 있어도, 그건 "슬라이더로 늘린 것"이 아니므로 clip 밖으로 나가면 안 됨.
  // (원본 결 보기처럼 delta가 항상 0인 상태에서는 이 덕분에 예외 없이 전부 마스크 안에 있음)
  // totalSteps는 실제로 traceStrand가 생성한 점 개수-1(가변) — 이걸 넘겨받아 clamp한다.
  function splitIndexFor(delta, origLen, totalSteps){
    if(delta <= 0) return totalSteps;
    return Math.min(Math.round(origLen / STRAND_STEP_LEN), totalSteps);
  }

  // 가닥 하나를 그림: origLen까지는 base(clip 대상), 그 이후 연장분은 ext(clip 없음)로 나눠서 그림.
  // 보폭이 고정(STRAND_STEP_LEN)이므로, origLen까지의 경로는 delta 값과 무관하게
  // 원본 결 보기 때와 항상 동일하다 — split은 그 경로를 어디서 자를지만 정한다.
  function drawStrand(ix, sy_img, scaledLen, origLen, delta, jitterSeed, strokeStyleVal){
    const pts = traceStrand(ix, sy_img, scaledLen, jitterSeed);
    const cPts = toCanvasPts(pts);
    const splitIdx = splitIndexFor(delta, origLen, pts.length - 1);
    setStyle('strokeStyle', strokeStyleVal);
    strokePolyline(baseCtx, cPts.slice(0, splitIdx+1));
    if(splitIdx < cPts.length-1){
      strokePolyline(extCtx, cPts.slice(splitIdx)); // splitIdx 지점을 공유해서 선이 끊기지 않게 이어줌
    }
  }

  // 가닥 레이어 하나를 그리는 공용 헬퍼 — "굵은 섹션/중간 가닥/잔 가닥" 3개 레이어가
  // 개수·굵기·지터 폭만 다르고 구조는 동일해서(컬럼 선택 → 원본길이 계산 → 늘린 길이
  // 계산 → drawStrand 호출) 반복문 자체를 파라미터화해서 하나로 합침.
  function drawStrandLayer(cfg){
    const {
      count, alphaMul, lineWidth, pickCol, endYFallbackRatio,
      lenScale, startXJitter, startYJitter, jitterSeedFn, tintRange
    } = cfg;
    setStyle('globalAlpha', alpha * alphaMul);
    setStyle('lineWidth', lineWidth);
    for(let i=0; i<count; i++){
      const ix = pickCol(i);
      const sy_img = iScalpY[ix]; if(sy_img < 0) continue;
      const ey_img = iHairEndY[ix] >= 0 ? iHairEndY[ix] : sy_img + maskH*endYFallbackRatio;
      const origLen = Math.max(ey_img - sy_img, maskH*0.05);
      const delta = lengthDeltaFor(ix);
      const scaledLen = Math.min(lenScale(origLen, delta), maxStrandLen);
      const startX = ix + startXJitter();
      const startY = startYJitter ? sy_img + startYJitter() : sy_img;
      const jitterSeed = jitterSeedFn(i);
      const [tMin, tRange] = tintRange;
      drawStrand(startX, startY, scaledLen, origLen, delta, jitterSeed, tintColor(color, tMin+Math.random()*tRange));
    }
  }

  // ── 레이어 1: 굵은 섹션 (40~80개) ──
  const numSections = Math.round(40 + (volume/100) * 20);
  drawStrandLayer({
    count: numSections,
    alphaMul: 0.55,
    lineWidth: 3 + (volume/100) * 3,
    pickCol: (i)=> validCols[Math.floor((i/numSections)*validCols.length)],
    endYFallbackRatio: 0.40,
    lenScale: (origLen, delta)=> Math.max(origLen + delta, maskH*0.02),
    startXJitter: ()=> (Math.random()-0.5)*(maskW/numSections)*1.5,
    jitterSeedFn: (i)=> i,
    tintRange: [0.70, 0.35],
  });

  // ── 레이어 2: 중간 가닥 (200~450개) ──
  const numMid = Math.round(200 + (volume/100) * 250);
  drawStrandLayer({
    count: numMid,
    alphaMul: 0.55,
    lineWidth: 1.5 + (thickness/100) * 1.5,
    pickCol: ()=> validCols[Math.floor(Math.random()*validCols.length)],
    endYFallbackRatio: 0.38,
    lenScale: (origLen, delta)=> Math.max(origLen + delta, maskH*0.02) * (0.85+Math.random()*0.3),
    startXJitter: ()=> (Math.random()-0.5)*maskW*0.008,
    jitterSeedFn: (i)=> i*0.618,
    tintRange: [0.72, 0.45],
  });

  // ── 레이어 3: 잔 가닥 (200~400개) ──
  const numFine = Math.round(200 + (volume/100) * 200);
  drawStrandLayer({
    count: numFine,
    alphaMul: 0.35,
    lineWidth: 0.4 + (thickness/100) * 0.6,
    pickCol: ()=> validCols[Math.floor(Math.random()*validCols.length)],
    endYFallbackRatio: 0.35,
    lenScale: (origLen, delta)=> Math.max(origLen + delta, maskH*0.02) * (0.7+Math.random()*0.5),
    startXJitter: ()=> (Math.random()-0.5)*maskW*0.012,
    startYJitter: ()=> (Math.random()-0.5)*maskH*0.01,
    jitterSeedFn: (i)=> i*0.382,
    tintRange: [0.65, 0.55],
  });

  // ── 2단계 합성 ──
  // [1] base: origLen 이내 구간 → hairCanvas(실제 세그멘테이션 마스크)로 destination-in
  //     clip을 걸어서, 인식된 머리카락 영역 밖(얼굴·안경·배경)으로는 절대 안 나가게 함.
  // [2] ext: origLen을 넘겨 슬라이더로 늘어난 구간 → clip 없이 그대로.
  //     (짧게 줄인 경우엔 애초에 ext 구간 자체가 안 그려지므로 자연히 문제 없음)
  function compositeLayers(){
    const maskAlpha = document.createElement('canvas');
    maskAlpha.width = cw; maskAlpha.height = ch;
    maskAlpha.getContext('2d').drawImage(hairCanvas, fit.dx, fit.dy, fit.dw, fit.dh);

    baseCtx.save();
    baseCtx.globalCompositeOperation = 'destination-in';
    baseCtx.drawImage(maskAlpha, 0, 0);
    baseCtx.restore();

    ctx.save();
    ctx.globalAlpha = 1;
    ctx.drawImage(baseOffscreen, 0, 0);
    ctx.drawImage(extOffscreen, 0, 0);
    ctx.restore();
  }
  compositeLayers();
}
function tintColor(hex, bright){
  // hex 또는 rgb() 문자열을 받아 밝기 조정
  let r=42,g=27,b=18;
  if(hex.startsWith('#')){
    const n=parseInt(hex.slice(1),16);
    r=(n>>16)&255; g=(n>>8)&255; b=n&255;
  } else {
    const m=hex.match(/\d+/g);
    if(m&&m.length>=3){r=+m[0];g=+m[1];b=+m[2];}
  }
  return `rgb(${Math.min(255,Math.round(r*bright))},${Math.min(255,Math.round(g*bright))},${Math.min(255,Math.round(b*bright))})`;
}

let rafId = null;
function drawAdjustPreview(){
  if(currentScreen!=='adjust') return;
  if(rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(()=>{
    renderFrame(document.getElementById('adjustCanvas'), state.currentViewAngle);
    rafId = null;
  });
}

