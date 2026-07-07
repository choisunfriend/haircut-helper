/* ════════════════════════════════════════
   HAIR SEGMENTATION
   1차: MediaPipe ImageSegmenter (hair_segmentation 모델)
   2차 폴백: TF.js SelfieSegmentation + HSV hair 필터
════════════════════════════════════════ */
let segmenterReady = false;
let segmenterError = false;
let mpImageSegmenter = null; // MediaPipe Tasks Vision segmenter

async function initSegmenter(){
  // ── 1차: MediaPipe Tasks Vision (hair segmentation) ──
  try{
    const { FilesetResolver: FR, ImageSegmenter: IS } = await loadVisionModule();
    const vision = await FR.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/wasm'
    );
    mpImageSegmenter = await IS.createFromOptions(vision, {
      baseOptions:{
        modelAssetPath:'https://storage.googleapis.com/mediapipe-models/image_segmenter/hair_segmenter/float32/1/hair_segmenter.tflite',
        // GPU delegate가 특정 기기/브라우저 조합에서 카테고리 인덱스를 뒤섞는
        // 알려진 버그가 있음(google-ai-edge/mediapipe#6142, iOS Safari 사례지만
        // 같은 계열). hair_segmenter는 background=0/hair=1 2클래스라 이 버그에
        // 걸리면 hair 픽셀이 전부 0px로 나옴 — 실제로 겪은 증상과 일치.
        // CPU delegate가 느리지만 훨씬 안정적이라 정확도 우선으로 전환.
        delegate:'CPU',
      },
      // categoryMask는 0.5 argmax로 배경/머리카락을 딱 잘라 판정해서, 새치처럼
      // 저채도인 경계 픽셀이 배경 쪽으로 떨어져 커버리지가 낮게 나오는 문제가 있었음
      // (실측: 전체의 6%만 머리카락으로 판정). confidenceMask(0~1 확률값)를 받아서
      // 임계값을 직접 조정할 수 있게 변경.
      outputCategoryMask: false,
      outputConfidenceMasks: true,
      runningMode: 'IMAGE',
    });
    segmenter = mpImageSegmenter;
    segmenterReady = true;
    state.segmenterType = 'MediaPipe';
    console.log('MediaPipe Hair Segmenter 준비 완료');
    return;
  } catch(e){
    window.__segDiag = (e && e.name ? e.name + ': ' : '') + (e && e.message ? e.message : String(e));
    console.warn('MediaPipe Hair Segmenter 실패, TF.js 폴백:', e);
  }

  // ── 2차 폴백: TF.js SelfieSegmentation ──
  try{
    await tf.ready();
    await tf.setBackend('webgl');
    segmenter = await bodySegmentation.createSegmenter(
      bodySegmentation.SupportedModels.MediaPipeSelfieSegmentation,
      { runtime:'tfjs', modelType:'general' }
    );
    segmenterReady = true;
    state.segmenterType = 'TF.js';
    console.log('TF.js SelfieSegmentation 폴백 준비 완료');
  } catch(e){
    console.warn('모든 Segmenter 로드 실패:', e);
    segmenter = null;
    segmenterError = true;
    state.segmenterType = '실패';
  }
}
initSegmenter();

/* ────────────────────────────────────────
   헤어 마스크 추출
   - MediaPipe hair_segmenter: category mask에서 hair(=1) 픽셀 추출
   - TF.js fallback: 사람 마스크 + HSV 색상 필터로 hair 근사
──────────────────────────────────────── */
// ── 개발 스위치: 랜드마크 기반 후처리(얼굴제거박스/어깨컷오프/귀·프론트 보강) ──
// MediaPipe가 window.FilesetResolver 버그로 계속 TF.js로 폴백되던 동안 쌓인 패치들이라,
// 실제 MediaPipe hair_segmenter 마스크 특성에 맞춰 검증된 적이 없음.
// MediaPipe가 정상 동작하는 지금, 일단 다 끄고 순수 MediaPipe 마스크 + 최소 노이즈 정리만
// 확인한 뒤, 실제로 필요한 것만 골라 다시 켠다.
const ENABLE_LANDMARK_POSTPROCESS = true;

async function extractHairMask(angle){
  const dataUrl = state.shots[angle];
  if(!dataUrl || !segmenter) return false;

  return new Promise(resolve=>{
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = async()=>{
      try{
        const maxDim = 512;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);

        const srcC = document.createElement('canvas');
        srcC.width=w; srcC.height=h;
        const srcCtx = srcC.getContext('2d');
        srcCtx.drawImage(img, 0, 0, w, h);
        const srcPixels = srcCtx.getImageData(0,0,w,h).data;

        // 마스크 버퍼 (0=background, 255=hair) — 축소 해상도에서 작업
        let hairMaskBuf = new Uint8Array(w * h);
        // 디버그용 "왜 이렇게 됐는지" 코드 — 0:미해당, 1:최종 머리카락, 2:얼굴박스로 제외,
        // 3:눈썹/눈/입 가드로 제외. "마스크 보기"에서 색을 다르게 표시하기 위함.
        const reasonMask = new Uint8Array(w * h);

        // ── STEP 1: 세그멘테이션 — MediaPipe 우선, 실패 시 TF.js 폴백 ──
        // hairMaskBuf를 채우는 역할만 담당 (이후 단계에서 후처리)
        async function runSegmentation(){
        if(mpImageSegmenter){
          // ── MediaPipe hair_segmenter path (confidenceMask 기반) ──
          // categoryMask(0.5 argmax)보다 관대한 기준으로 저채도 경계 픽셀(새치 등)을
          // 더 살리기 위해, index 1(hair) 확률맵을 직접 임계값 비교로 판정한다.
          // 기준치를 낮출수록 더 많이 잡히지만 배경 오탐도 늘어날 수 있음 — 실측
          // 데이터 보면서 조정할 예정.
          const HAIR_CONFIDENCE_THRESHOLD = 0.5; // 원상복구: 관대했던 0.3 → categoryMask argmax와 동등한 0.5로 되돌림
          const result = mpImageSegmenter.segment(srcC);
          const hairConf = result.confidenceMasks[1]; // 0=background, 1=hair
          const confArr = hairConf.getAsFloat32Array();
          // 진단: 확률 분포 요약 (평균/최대값) — 전체적으로 확률이 낮게 나오면
          // 임계값을 더 낮춰야 한다는 신호
          let confSum=0, confMax=0, aboveCount=0;
          for(let i=0;i<confArr.length;i++){
            const c = confArr[i];
            confSum += c; if(c>confMax) confMax=c;
            const isHair = c >= HAIR_CONFIDENCE_THRESHOLD;
            if(isHair) aboveCount++;
            hairMaskBuf[i] = isHair ? 255 : 0;
          }
          window.__maskValueDiag = `avg:${(confSum/confArr.length).toFixed(3)},max:${confMax.toFixed(3)},≥${HAIR_CONFIDENCE_THRESHOLD}:${aboveCount}`;
          hairConf.close();
        } else {
          // ── TF.js SelfieSegmentation 폴백 ──
          const segs = await segmenter.segmentPeople(srcC, {
            multiSegmentation: false,
            segmentBodyParts: false,
          });
          // TF.js 사람 마스크 + HSV hair 색상 필터 (마스크 실패시 상단 영역 HSV만 사용)
          let personMaskData = null;
          if(segs && segs.length>0){
            try{
              const binaryMask = await bodySegmentation.toBinaryMask(
                segs,
                {r:255,g:255,b:255,a:255},
                {r:0,g:0,b:0,a:0},
                false, 0.5
              );
              personMaskData = binaryMask.data;
            } catch(e){ personMaskData = null; }
          }

          // 사람 마스크가 있으면 마스크 내에서, 없으면 상단 60% 전체에서 HSV 필터
          const topLimit = Math.round(h * 0.60);
          for(let i=0;i<w*h;i++){
            const iy = Math.floor(i/w);
            const inRegion = personMaskData
              ? personMaskData[i*4+3] > 128
              : iy < topLimit;
            if(inRegion){
              const r=srcPixels[i*4], g=srcPixels[i*4+1], b=srcPixels[i*4+2];
              if(isHairColor(r,g,b)) hairMaskBuf[i]=255;
            }
          }
        }
        } // runSegmentation
        await runSegmentation();

        // ── STEP 2: 배경 오탐 제거 — 사람 머리 영역 바깥은 무조건 제외 ──
        // confidenceMask 임계값을 관대하게 낮췄더니(0.3), 벽/천장 경계선처럼
        // 배경의 강한 선형 경계가 낮은 확신도로 "머리카락"으로 오탐되어 화면
        // 전체 폭에 걸쳐 일직선 가닥이 뻗어나가는 문제가 실제로 확인됨.
        // 이건 "얼굴을 정교하게 지운다"는 세밀한 보정이 아니라 "사람이 있을 리
        // 없는 먼 배경만 제외한다"는 훨씬 느슨한 가드라서, ENABLE_LANDMARK_POSTPROCESS
        // 플래그(세밀한 재구성 로직들)와 별개로 항상 켜둔다.
        function applyBackgroundGuard(){
          const lmGuard = state.landmarks && state.landmarks[angle];
          if(lmGuard){
            const beforeCount = hairMaskBuf.reduce((a,v)=>a+(v>0?1:0),0);
            const earSpan = Math.abs(lmGuard.rEarX - lmGuard.lEarX);
            const cx = (lmGuard.lEarX + lmGuard.rEarX) / 2;
            const marginX = Math.max(earSpan * 2.2, 0.28); // 측면 등 earSpan이 작을 때 최소 마진 보장
            const xLeft  = Math.max(0, cx - marginX);
            const xRight = Math.min(1, cx + marginX);
            const yTop    = Math.max(0, lmGuard.foreheadY - 0.25);
            const yBottom = Math.min(1, lmGuard.chinY + 0.55); // 목·어깨까지 여유
            const xS = Math.round(xLeft*w), xE = Math.round(xRight*w);
            const yS = Math.round(yTop*h), yE = Math.round(yBottom*h);
            for(let y=0;y<h;y++){
              for(let x=0;x<w;x++){
                if(x<xS || x>=xE || y<yS || y>=yE) hairMaskBuf[y*w+x]=0;
              }
            }
            const afterCount = hairMaskBuf.reduce((a,v)=>a+(v>0?1:0),0);
            window.__bgGuardDiag = `${beforeCount}→${afterCount}(-${beforeCount-afterCount})`;
          }
        } // applyBackgroundGuard
        applyBackgroundGuard();

        // ── 이하 랜드마크 기반 후처리는 세그멘터 종류(MediaPipe/TF.js)와
        // 무관하게 항상 적용한다. (이전엔 TF.js 폴백 분기 안에만 있어서,
        // MediaPipe 1차 세그멘터가 성공하면 얼굴제거박스·어깨컷오프·
        // 귀/프론트 보강이 전부 스킵되는 구조적 버그가 있었음)

        // ── 얼굴 영역 제거: 랜드마크 기반 동적 박스 ──
        // 기존 고정 좌표(가로 25~75%) 박스는 "얼굴이 항상 화면 중앙"이라고 가정해서
        // 측면(좌/우) 사진에서는 얼굴이 한쪽으로 치우쳐 있어 반대쪽 옆머리까지 같이 지워버렸음.
        // Face Landmarker로 실제 눈/귀/턱 위치를 알면 그 범위에 맞춰서만 지운다.
        // 실측 랜드마크가 있으면 그대로, 없으면 비율 기반 추정치로 대체
        // (이전엔 랜드마크 실패 시 이 블록 전체가 꺼지고 보수적 고정 박스로만
        // 폴백했는데, 그러면 아래의 귀/프론트 보강·동적 어깨컷오프까지
        // 전부 같이 무효화됨 → 항상 lm이 존재하도록 바꿔서 그 문제를 없앰)
        const lmReal = state.landmarks && state.landmarks[angle];
        const lm = lmReal || getEstimatedLandmarks(angle);
        const lmEstimated = !lmReal;
        // 얼굴제거박스가 실제로 지운 픽셀을 별도 기록 — 아래 귀/프론트 보강 단계에서
        // "원래부터 머리카락이 아니었던 곳"과 절대 혼동하지 않고 재채움을 막기 위함
        const faceExcludeMask = new Uint8Array(w*h);
        // [진단용] 얼굴제거박스의 실제 좌표(0~1 비율)와 사용된 랜드마크 값을 기록.
        // 화면의 각진 블록 아티팩트가 이 박스와 일치하는지 "얼굴박스 보기" 토글로 확인하기 위함.
        let faceBoxDiag = null;

        // ── STEP 3: 얼굴 영역 제거 — 랜드마크 기반 동적 박스 ──
        function applyFaceBoxRemoval(){
          const yTop    = Math.max(0, lm.foreheadY * 0.95);
          const yBottom = Math.min(1, lm.chinY * 1.05); // 턱 끝을 넘어서까지 (기존 0.92는 턱 라인이 박스 밖에 남는 문제)
          const earSpan = Math.abs(lm.rEarX - lm.lEarX);
          let xLeft, xRight;
          if(earSpan > 0.08){
            // 양쪽 귀가 충분히 떨어져 보이는 경우 (정면~약한 측면): 귀 안쪽만 지움
            xLeft  = Math.min(lm.lEarX, lm.rEarX) + earSpan*0.18; // 옆(턱 모서리·관자놀이) 여유 확대 (기존 0.12)
            xRight = Math.max(lm.lEarX, lm.rEarX) - earSpan*0.18;
          } else {
            // 거의 완전 측면(반대쪽 귀가 가려져 earSpan이 비정상적으로 작음):
            // 화면 폭 35%의 좁은 범위만 안전하게 제거 (얼굴 중심부 추정, 옆머리는 보존)
            const cx = (lm.lEarX + lm.rEarX) / 2;
            xLeft  = cx - 0.20; // 측면 턱 라인까지 포함하도록 확대 (기존 0.175)
            xRight = cx + 0.20;
          }
          const yS = Math.round(yTop*h), yE = Math.round(yBottom*h);
          const xS = Math.round(Math.max(0,xLeft)*w), xE = Math.round(Math.min(1,xRight)*w);
          for(let y=yS; y<yE; y++){
            for(let x=xS; x<xE; x++){
              if(x>=0&&x<w&&y>=0&&y<h){
                const idx=y*w+x;
                if(hairMaskBuf[idx]===255) reasonMask[idx]=2;
                hairMaskBuf[idx]=0; faceExcludeMask[idx]=1;
              }
            }
          }
          faceBoxDiag = {
            xLeft: Math.max(0,xLeft), xRight: Math.min(1,xRight), yTop, yBottom,
            lmEstimated,
            foreheadY: lm.foreheadY, chinY: lm.chinY, lEarX: lm.lEarX, rEarX: lm.rEarX, earSpan
          };
        } // applyFaceBoxRemoval

        // ── STEP 4: 얼굴 부위별 정밀 가드 (눈썹·눈·입) ──
        // 위 얼굴제거박스의 x범위(관자놀이 쪽 여유 때문에 좁게 잡힘) 밖으로
        // 삐져나온 부위(특히 측면 사진에서 관자놀이 쪽 눈썹 꼬리)도 좌표 기반으로
        // 별도 제외한다. "이 사람은 앞머리가 짧다/길다" 같은 헤어스타일 가정과
        // 무관하게, 실제 그 부위 랜드마크만 갖고 판단하므로 모든 헤어스타일에 동일 적용됨.
        // 랜드마크 추정 폴백(getEstimatedLandmarks)에는 features가 없으므로 자동 스킵됨
        // — 대략적 비율 추정치로 눈썹 위치까지 지어내는 건 오히려 부정확할 수 있어서.
        function applyFeatureGuard(){
        if(lm.features){
          for(const key of Object.keys(lm.features)){
            const f = lm.features[key];
            const fw = f.maxX - f.minX, fh = f.maxY - f.minY;
            const mx = fw * 0.35 + 0.006, my = fh * 0.5 + 0.006; // 랜드마크가 실제 부위보다 살짝 안쪽으로 잡히는 오차 보정 여유
            const xS = Math.round(Math.max(0, f.minX - mx) * w);
            const xE = Math.round(Math.min(1, f.maxX + mx) * w);
            const yS = Math.round(Math.max(0, f.minY - my) * h);
            const yE = Math.round(Math.min(1, f.maxY + my) * h);
            // 사각형이 아니라 타원으로 — 눈썹/눈/입은 실제로 길쭉한 타원에 가까운
            // 모양이라, 각진 사각형으로 자르면 결과물(특히 원본 결 디버그 뷰)에서
            // 눈에 띄게 인위적인 홈처럼 보였음. 중심·반지름 기준 타원 판정으로 교체.
            const cx = (xS+xE)/2, cy = (yS+yE)/2;
            const rx = Math.max(1,(xE-xS)/2), ry = Math.max(1,(yE-yS)/2);
            for(let y=yS; y<yE; y++){
              const ny = (y-cy)/ry;
              for(let x=xS; x<xE; x++){
                const nx = (x-cx)/rx;
                if(nx*nx + ny*ny > 1) continue; // 타원 밖은 건드리지 않음
                if(x>=0&&x<w&&y>=0&&y<h){
                  const idx=y*w+x;
                  if(hairMaskBuf[idx]===255) reasonMask[idx]=3;
                  hairMaskBuf[idx]=0; faceExcludeMask[idx]=1;
                }
              }
            }
          }
        }
        } // applyFeatureGuard

        // ── STEP 5: 목·어깨 제거 — 랜드마크(chinY) 기반 동적 컷오프 ──
        // 기존 고정 70% 라인은 턱이 그보다 위/아래로 짧게 잡히는 얼굴에서
        // 어깨선(옷)이 70% 안쪽에 들어와 회색 티셔츠 그림자가 머리카락으로 오인됨.
        // 턱 끝(chinY)에서 목 길이만큼(약 1.35배) 아래를 컷오프 라인으로 잡아
        // 얼굴 크기에 비례해서 어깨선을 더 정확히 배제한다.
        function applyShoulderCutoff(){
          const shoulderCutoffY = Math.max(Math.round(h*0.45), Math.min(Math.round(h*0.85), Math.round(lm.chinY * 1.35 * h)));
          for(let y=shoulderCutoffY; y<h; y++){
            for(let x=0;x<w;x++) hairMaskBuf[y*w+x]=0;
          }
        } // applyShoulderCutoff

        // ── STEP 6: 옆머리·앞머리 빈 부분 보강 (귀/프론트 밴드 완화 색상 필터) ──
        // 밝은 조명을 받은 잔머리(v>=0.55, 저채도)는 기존 isHairColor 3번 조건 경계에
        // 걸려 누락되는 경우가 있음. 화면 전체가 아니라 "귀 주변 영역"에서만
        // 완화된 기준을 추가 적용해서, 과확장(옷/목까지 번지는 문제) 재발 없이
        // 옆머리(관자놀이~귀 주변) 빈 구간만 보강한다.
        // (이전: 밴드가 너무 넓어서(가로 14%, 아래로 귀높이*1.55) 뺨·턱선 피부가
        // isHairColorRelaxed에 걸려 같이 채워지는 문제가 실사진에서 계속 발생.
        // 밴드를 귀 바로 옆·바로 아래로만 좁혀서 보수적으로 만듦)
        function reinforceEarAndFrontBands(){
          // 연결성 제약: 색만 머리카락과 비슷한 "고립된" 뺨/턱 피부(그늘 등)가
          // 기존에 검출된 머리카락과 붙어있지 않은데도 그냥 채워지는 문제가
          // 실사진(측면)에서 계속 발생함 — 턱선까지 갈색으로 이어짐.
          // 보강 시작 전 시점의 마스크를 넉넉히 dilate해서 "실제 머리카락과
          // 인접한 범위"만 성장 허용 영역으로 만들고, 이 영역 밖은 색이 맞아도
          // 채우지 않는다. (진짜 잔머리는 기존 머리카락 경계에 붙어있으므로 안전)
          const growAllowEar = dilate(hairMaskBuf, w, h, 4);
          // 안경다리가 지나가는 바로 이 귀 밴드 영역에서, 색 조건(isHairColorRelaxed)만으로
          // 채우면 안경테의 저채도·중간밝기가 잔머리 색과 같은 조건을 통과해버리는 문제가
          // 있었음(가능성2). 색이 맞아도 국소 밝기 분산(hasHairTexture)이 낮으면 —
          // 즉 안경처럼 매끈한 재질이면 — 채우지 않도록 텍스처 조건을 추가로 요구한다.
          const grayForTexture = toGrayscale(srcPixels, w, h);
          let earBandTextureRejected = 0;

          const earXs = [lm.lEarX, lm.rEarX].filter(v=>typeof v==='number');
          const bandHalfW = 0.09; // 14% → 9%: 뺨 쪽으로 번지지 않는 귀 바로 옆 폭만
          const yTopBand = Math.max(0, lm.eyeY - 0.08) * h;  // 관자놀이 위쪽까지 포함
          const yBotBand = Math.min(1, lm.earY * 1.22) * h;  // 1.55 → 1.22: 턱선까지 안 내려가게 귀 바로 아래까지만
          for(const ex of earXs){
            const xS = Math.round(Math.max(0, ex - bandHalfW) * w);
            const xE = Math.round(Math.min(1, ex + bandHalfW) * w);
            for(let y=Math.round(yTopBand); y<Math.round(yBotBand); y++){
              for(let x=xS; x<xE; x++){
                if(x<0||x>=w||y<0||y>=h) continue;
                const i = y*w+x;
                if(hairMaskBuf[i]>0) continue; // 이미 잡힌 픽셀은 스킵
                if(faceExcludeMask[i]) continue; // 얼굴로 판정해 지운 픽셀은 재채움 금지
                if(!growAllowEar[i]) continue; // 기존 머리카락과 붙어있지 않은 고립 영역은 스킵
                const r=srcPixels[i*4], g=srcPixels[i*4+1], b=srcPixels[i*4+2];
                if(!isHairColorRelaxed(r,g,b)) continue;
                if(!hasHairTexture(grayForTexture, w, h, x, y, 2)){ earBandTextureRejected++; continue; }
                hairMaskBuf[i]=255;
              }
            }
          }
          window.__earBandTextureDiag = earBandTextureRejected;
          // 귀 밴드 안에서만 국소 dilate+closing으로 드문드문 잡힌 픽셀을 면으로 연결
          // (화면 전체에 적용하면 과확장 재발 위험 → 밴드 영역에만 한정)
          const bandMask = new Uint8Array(w*h);
          for(const ex of earXs){
            const xS = Math.round(Math.max(0, ex - bandHalfW) * w);
            const xE = Math.round(Math.min(1, ex + bandHalfW) * w);
            for(let y=Math.round(yTopBand); y<Math.round(yBotBand); y++){
              for(let x=xS; x<xE; x++){
                if(x>=0&&x<w&&y>=0&&y<h) bandMask[y*w+x]=hairMaskBuf[y*w+x];
              }
            }
          }
          const bandClosed = morphClose(dilate(bandMask, w, h, 1), w, h, 1); // 2 → 1: 좁은 밴드 밖(뺨)으로 번지는 것 방지
          // 프론트와 동일한 이유로, closing이 새로 채운 픽셀만 텍스처 재검증
          // (안경다리처럼 매끈한 재질이 인접 잔머리에 붙어 다시 이어지는 것 방지)
          let bandClosedTextureRejected = 0;
          for(let i=0;i<w*h;i++){
            if(bandClosed[i]>0 && !faceExcludeMask[i]){
              if(bandMask[i]>0){ hairMaskBuf[i]=255; continue; }
              const x = i % w, y = (i / w) | 0;
              if(hasHairTexture(grayForTexture, w, h, x, y, 2)) hairMaskBuf[i]=255;
              else bandClosedTextureRejected++;
            }
          }
          window.__bandClosedTextureDiag = bandClosedTextureRejected;

          // ── 프론트(앞머리) 라인 보강: 이마 경계 쪽 잔머리도 같은 방식으로 ──
          // 여기도 동일하게, 귀 밴드 보강까지 끝난 시점의 마스크를 기준으로
          // "기존 머리카락과 인접한 곳만" 성장 허용 (고립된 이마 피부 오탐 방지)
          // 실측 결과 귀 밴드 쪽 텍스처 제외는 거의 작동하지 않았고(8px),
          // 실제 눈썹~안경 위쪽 렌즈 영역이 덮이는 문제는 이 프론트 밴드 범위와 겹쳤음.
          // 눈썹도 안경 상단 프레임과 마찬가지로 이 밴드 y범위에 걸리므로, 같은 텍스처
          // 조건을 여기에도 동일하게 적용한다. 하단 경계는 "눈 위 몇 %" 식 고정 비율이
          // 아니라 실제 눈썹 랜드마크(browTopY) 바로 위에서 멈추게 한다 — 앞머리가 짧아서
          // 눈썹 위에서 끝나는 사람을 기준으로 고정 비율을 잡으면, 앞머리가 길어 눈썹을
          // 덮는 사람은 그 아래 실제 머리카락 보강까지 막히게 됨. 눈썹 좌표를 직접 쓰면
          // 헤어스타일에 대한 가정 없이 눈썹만 정확히 피해간다.
          const growAllowFront = dilate(hairMaskBuf, w, h, 4);
          const fxS = Math.round(Math.max(0, Math.min(lm.lEarX, lm.rEarX) + Math.abs(lm.rEarX-lm.lEarX)*0.15) * w);
          const fxE = Math.round(Math.min(1, Math.max(lm.lEarX, lm.rEarX) - Math.abs(lm.rEarX-lm.lEarX)*0.15) * w);
          const fyTop = Math.max(0, lm.foreheadY * 0.85) * h;
          const fyBot = Math.min(1, lm.browTopY != null ? lm.browTopY : lm.eyeY * 0.92) * h;
          const frontBandMask = new Uint8Array(w*h);
          let frontBandTextureRejected = 0;
          for(let y=Math.round(fyTop); y<Math.round(fyBot); y++){
            for(let x=fxS; x<fxE; x++){
              if(x<0||x>=w||y<0||y>=h) continue;
              const i = y*w+x;
              if(hairMaskBuf[i]===0 && !faceExcludeMask[i] && growAllowFront[i]){
                const r=srcPixels[i*4], g=srcPixels[i*4+1], b=srcPixels[i*4+2];
                if(isHairColorRelaxed(r,g,b)){
                  if(hasHairTexture(grayForTexture, w, h, x, y, 2)) hairMaskBuf[i]=255;
                  else frontBandTextureRejected++;
                }
              }
              frontBandMask[i] = faceExcludeMask[i] ? 0 : hairMaskBuf[i];
            }
          }
          window.__frontBandTextureDiag = frontBandTextureRejected;
          const frontClosed = morphClose(dilate(frontBandMask, w, h, 2), w, h, 2);
          // closing(dilate+erode)은 순수 형태 연산이라 텍스처 검사를 다시 하지 않음 —
          // 그래서 눈썹(정당하게 통과)과 붙어있던 안경테 픽셀(텍스처로 걸러졌던 것)이
          // 틈 메우기 과정에서 다시 이어붙는 문제가 있었음. closing이 "새로 추가한" 픽셀만
          // (원래 frontBandMask에는 없던 픽셀) 텍스처를 한 번 더 검증해서 재유입을 막는다.
          let frontClosedTextureRejected = 0;
          for(let i=0;i<w*h;i++){
            if(frontClosed[i]>0 && !faceExcludeMask[i]){
              if(frontBandMask[i]>0){ hairMaskBuf[i]=255; continue; } // 이미 검증된 픽셀
              const x = i % w, y = (i / w) | 0;
              if(hasHairTexture(grayForTexture, w, h, x, y, 2)) hairMaskBuf[i]=255;
              else frontClosedTextureRejected++;
            }
          }
          window.__frontClosedTextureDiag = frontClosedTextureRejected;
        } // reinforceEarAndFrontBands

        // ── STEP 3~6 실행: 랜드마크 기반 후처리 (플래그로 일괄 on/off) ──
        if(ENABLE_LANDMARK_POSTPROCESS){
          applyFaceBoxRemoval();
          applyFeatureGuard();
          applyShoulderCutoff();
          reinforceEarAndFrontBands();
        }

        // ── STEP 7: 마스크 후처리 — 컬럼 내 작은 구멍만 채움 (과확장 없이 노이즈 정리만) ──
        // 이전: earY 기반 하단 dilate + HSV 보강이 머리카락을 옷/목까지 과도하게 확장시켜 되돌림
        // 사이드 하단 인식 문제는 결방향 인식(structure tensor) 작업 이후 별도로 재검토
        function cleanupMask(){
          hairMaskBuf = fillColumnGaps(hairMaskBuf, w, h, 6);
          hairMaskBuf = morphClose(hairMaskBuf, w, h, 3);
          // 본체 머리카락과 이어지지 않은 고립된 작은 오탐 덩어리(안경테, 눈썹, 옷깃 등)
          // 제거 — 가장 큰 덩어리 면적의 3% 미만인 컴포넌트는 버림
          hairMaskBuf = keepLargestComponents(hairMaskBuf, w, h, 0.03);
        }
        cleanupMask();

        // ── STEP 8: 진단 로그 문자열 조립 ──
        function buildDiagLog(){
          const pixelCount = hairMaskBuf.filter(v=>v>0).length;
          const lmDiagPart = lmEstimated ? `추정${window.__lmDiag ? '('+window.__lmDiag+')' : ''}` : '실측';
          const segFailPart = (state.segmenterType !== 'MediaPipe' && window.__segDiag) ? ` | MP실패:${window.__segDiag}` : '';
          const maskValPart = (state.segmenterType === 'MediaPipe' && window.__maskValueDiag) ? ` | 마스크값:${window.__maskValueDiag}` : '';
          const bgGuardPart = window.__bgGuardDiag ? ` | 배경가드:${window.__bgGuardDiag}` : '';
          const texRejPart = window.__earBandTextureDiag ? ` | 귀밴드질감제외:${window.__earBandTextureDiag}px` : '';
          const frontTexRejPart = window.__frontBandTextureDiag ? ` | 프론트밴드질감제외:${window.__frontBandTextureDiag}px` : '';
          const frontClosedTexRejPart = window.__frontClosedTextureDiag ? ` | 프론트닫기질감제외:${window.__frontClosedTextureDiag}px` : '';
          const bandClosedTexRejPart = window.__bandClosedTextureDiag ? ` | 귀닫기질감제외:${window.__bandClosedTextureDiag}px` : '';
          state._diagLog = `세그멘터:${state.segmenterType||'?'} | 마스크픽셀:${pixelCount}px | 랜드마크:${lmDiagPart}${segFailPart}${maskValPart}${bgGuardPart}${texRejPart}${frontTexRejPart}${frontClosedTexRejPart}${bandClosedTexRejPart}`;
        }
        buildDiagLog();

        // ── STEP 9: 결방향 인식 (Structure Tensor) ──
        // 축소 해상도(w,h)에서 계산 → 컬럼별 샘플로 다운샘플해 저장
        // (가닥 렌더링 시 매번 풀 계산하지 않고 가벼운 보간만 하도록)
        let orientationColSamples = null;
        function computeOrientation(){
          try{
            // Structure Tensor는 강한 명암 경계(edge)를 만나면 그 edge의 접선 방향을
            // "결방향"으로 오인하는 특성이 있음. hairMaskBuf 그대로 넘기면 머리카락↔
            // 배경/얼굴 경계(마스크 테두리) 자체가 그렇게 오인식되어, 그 경계 근처를
            // 지나가는 가닥들이 전부 그 경계 방향(주로 거의 수평)으로 꺾여버리고,
            // 그 뒤로는 (마스크 밖이라 결방향 데이터가 없으니) 그 방향을 그대로 유지한 채
            // 계속 뻗어나가서 옆으로 뻗은 "빗살" 형태가 됨 — 렌더링 쪽에서 시작점만
            // 2스텝 건너뛰는 것으로는 못 막았던, 경로 중간에 재발하는 동일한 문제.
            // → 경계에서 안쪽으로 살짝 침식(erode)한 마스크로만 결방향을 계산해서
            //   경계 픽셀 자체가 결방향 계산에 아예 들어가지 않게 함.
            const orientErodeR = Math.max(3, Math.round(w*0.004));
            const orientMaskBuf = erode(hairMaskBuf, w, h, orientErodeR);
            const {angle: angleField, coherence: coherenceField} = computeHairOrientationField(srcPixels, orientMaskBuf, w, h);
            orientationColSamples = buildColumnOrientationSamples(angleField, coherenceField, orientMaskBuf, w, h, 12);
          }catch(e){
            console.warn('결방향 인식 실패, 기본 직선 모드로 폴백:', e);
            orientationColSamples = null;
          }
        }
        computeOrientation();

        // ── STEP 10: 두피(scalpY)·모발끝(hairEndY) 라인 추출 후 원본 해상도로 스케일업 ──
        function computeScalpAndEndLines(){
          // 축소 해상도에서 (blur 없는 clean mask에서 column별 최상단 픽셀)
          const scalpY_small   = new Float32Array(w).fill(-1);
          const hairEndY_small = new Float32Array(w).fill(-1);
          for(let x=0;x<w;x++){
            for(let y=0;y<h;y++){
              if(hairMaskBuf[y*w+x] > 0){
                if(scalpY_small[x]<0) scalpY_small[x]=y;
                hairEndY_small[x]=y;
              }
            }
          }

          // ── hairEndY_small: 양끝 -1 열을 인접 유효값으로 보간 채우기 ──
          // (forward pass)
          let lastValidEnd = -1;
          for(let x=0;x<w;x++){
            if(hairEndY_small[x]>=0) lastValidEnd=hairEndY_small[x];
            else if(lastValidEnd>=0) hairEndY_small[x]=lastValidEnd;
          }
          // (backward pass — 앞쪽 -1 채우기)
          let firstValidEnd = -1;
          for(let x=w-1;x>=0;x--){
            if(hairEndY_small[x]>=0) firstValidEnd=hairEndY_small[x];
            else if(firstValidEnd>=0) hairEndY_small[x]=firstValidEnd;
          }
          // scalpY_small은 보간하지 않음 — 두피 "시작점"은 실제 세그멘테이션 마스크가
          // 있는 컬럼에서만 나와야 함(옆 컬럼 값을 복사해 배경/천장 컬럼까지 가짜
          // 시작점을 만들면 그 자리에 가닥이 심어지는 문제가 있었음). hairEndY만
          // 보간(끝점은 추정용이라 허용)하고, scalpY는 마스크 없는 컬럼에서 -1 그대로 둔다.

          // ── earY 기반 hairEndY 강제 연장 로직 제거 ──
          // (실제 마스크에 없는 영역까지 끌어올려 옷/목까지 머리카락이 그려지는 원인이었음)
          // 사이드 하단 인식 개선은 결방향 인식 도입 후 별도로 재검토

          // 원본 해상도로 스케일업
          const invScale = 1/scale;
          const scalpY   = new Float32Array(img.width).fill(-1);
          const hairEndY = new Float32Array(img.width).fill(-1);
          for(let X=0;X<img.width;X++){
            const xSmall = Math.min(w-1, Math.round(X*scale));
            // scalpY와 hairEndY를 독립적으로 대입 — scalpY_small이 -1(마스크 없는 컬럼)이어도
            // hairEndY_small은 보간되어 유효할 수 있으므로, 하나의 조건으로 묶지 않는다.
            if(scalpY_small[xSmall]>=0){
              scalpY[X] = scalpY_small[xSmall] * invScale;
            }
            if(hairEndY_small[xSmall]>=0){
              hairEndY[X] = hairEndY_small[xSmall] * invScale;
            }
          }
          return {scalpY, hairEndY};
        }
        const {scalpY, hairEndY} = computeScalpAndEndLines();

        // ── STEP 11: 결과 캔버스 합성 (마스크/진단/hair/base 캔버스 + 평균 헤어컬러) ──
        function buildOutputCanvases(){
          const maskC = document.createElement('canvas');
          maskC.width=w; maskC.height=h;
          const mCtx = maskC.getContext('2d');
          const mImg = mCtx.createImageData(w,h);
          for(let i=0;i<w*h;i++){
            mImg.data[i*4]=mImg.data[i*4+1]=mImg.data[i*4+2]=255;
            mImg.data[i*4+3]=hairMaskBuf[i];
          }
          mCtx.putImageData(mImg,0,0);

          // ── 진단용 색상코드 마스크 캔버스 (reasonMask → RGBA) ──
          // 1:최종 머리카락(빨강) 2:얼굴박스로 제외(회색) 3:눈썹/눈/입 가드로 제외(파랑) 0:투명
          const reasonC = document.createElement('canvas');
          reasonC.width=w; reasonC.height=h;
          const rCtx = reasonC.getContext('2d');
          const rImg = rCtx.createImageData(w,h);
          const REASON_COLORS = { 1:[255,45,85], 2:[136,136,136], 3:[51,136,255] };
          for(let i=0;i<w*h;i++){
            const code = reasonMask[i];
            const col = REASON_COLORS[code];
            if(col){
              rImg.data[i*4]=col[0]; rImg.data[i*4+1]=col[1]; rImg.data[i*4+2]=col[2];
              rImg.data[i*4+3]=255;
            } // code 0이면 알파 0으로 남음(투명, 초기값 그대로)
          }
          rCtx.putImageData(rImg,0,0);

          const fullMaskC = document.createElement('canvas');
          fullMaskC.width=img.width; fullMaskC.height=img.height;
          fullMaskC.getContext('2d').drawImage(maskC,0,0,img.width,img.height);

          // ── hairCanvas: 원본에서 hair 마스크 영역만 ──
          const hairC = document.createElement('canvas');
          hairC.width=img.width; hairC.height=img.height;
          const hCtx = hairC.getContext('2d');
          hCtx.drawImage(img,0,0);
          hCtx.save();
          hCtx.globalCompositeOperation='destination-in';
          hCtx.drawImage(fullMaskC,0,0);
          hCtx.restore();

          // ── baseCanvas: 원본에서 hair 영역 제거 ──
          const baseC = document.createElement('canvas');
          baseC.width=img.width; baseC.height=img.height;
          const bCtx = baseC.getContext('2d');
          bCtx.drawImage(img,0,0);
          bCtx.save();
          bCtx.globalCompositeOperation='destination-out';
          bCtx.drawImage(fullMaskC,0,0);
          bCtx.restore();

          // ── 헤어 색상 샘플링 ──
          const hairPixelData = hCtx.getImageData(0,0,img.width,img.height).data;
          let rSum=0,gSum=0,bSum=0,cnt=0;
          for(let i=0;i<img.width*img.height;i++){
            if(hairPixelData[i*4+3]>128){
              rSum+=hairPixelData[i*4]; gSum+=hairPixelData[i*4+1]; bSum+=hairPixelData[i*4+2]; cnt++;
            }
          }
          const avgHairColor = cnt>0
            ? `rgb(${Math.round(rSum/cnt)},${Math.round(gSum/cnt)},${Math.round(bSum/cnt)})`
            : '#2A1B12';

          return {hairC, baseC, reasonC, avgHairColor};
        }

        // 최종 확정: 지금 시점에 hairMaskBuf===255인 픽셀은 전부 "최종 머리카락"(1)으로
        // 표시 — 귀/프론트 밴드 보강으로 나중에 다시 채워진 픽셀도 여기서 포함됨.
        // (버그 수정: 예전엔 이 대입이 buildOutputCanvases() 호출 "다음"에 실행돼서,
        // reasonC 캔버스가 이미 다 그려진 뒤였음 — 그래서 마스크 보기에서 빨강(최종
        // 머리카락)이 절대 보이지 않고 회색/파랑 제외 표시만 보이는 문제가 있었음.
        // reasonC를 만들기 "전"에 최종 확정을 끝내야 마스크 보기에 빨강이 정상적으로 나옴.)
        for(let i=0;i<w*h;i++){ if(hairMaskBuf[i]===255) reasonMask[i]=1; }

        const {hairC, baseC, reasonC, avgHairColor} = buildOutputCanvases();

        state.hairCanvases[angle] = hairC;
        state.baseCanvases[angle] = baseC;
        state.hairMasks[angle]    = {
          scalpY, hairEndY, w:img.width, h:img.height, avgColor:avgHairColor,
          // 결방향 필드는 축소 해상도(maskW,maskH) 좌표계로 저장됨 — 사용 시 비율 변환 필요
          orientation: orientationColSamples,
          maskW: w, maskH: h,
          reasonMask, // [진단용] 0:미해당 1:최종 머리카락 2:얼굴박스로 제외 3:눈썹/눈/입 가드로 제외
          reasonCanvas: reasonC, // [진단용] 위 코드를 색으로 미리 구운 작은 캔버스(w×h, 축소 해상도)
          faceBoxDiag // [진단용] 얼굴제거박스 좌표/사용 랜드마크 — "얼굴박스 보기" 토글에서 사용
        };
        console.log('[진단] extractHairMask 완료', angle, 'faceBoxDiag=', faceBoxDiag);
        resolve(true);
      }catch(e){
        console.warn('extractHairMask 실패:', angle, e);
        resolve(false);
      }
    };
    img.src = dataUrl;
  });
}

/* ────────────────────────────────────────
   유틸: HSV hair 색상 판별 (어두운 갈색~흑색 계열)
──────────────────────────────────────── */
// hueDegrees: RGB에서 hue(0~360)만 계산하는 공용 헬퍼.
// isHairColor / isHairColorRelaxed 양쪽에서 동일하게 쓰던 공식을 하나로 통합.
function hueDegrees(r,g,b,maxC,minC){
  const hRaw=maxC>0?( maxC===r?((g-b)/(maxC-minC+0.001))%6
                    : maxC===g?((b-r)/(maxC-minC+0.001))+2
                    :           ((r-g)/(maxC-minC+0.001))+4 )*60 : 0;
  return (hRaw+360)%360;
}
function isHairColor(r,g,b){
  // 흑발·갈색·금발·회색·백발(새치) 모두 인식
  const maxC=Math.max(r,g,b), minC=Math.min(r,g,b);
  const v=maxC/255;
  const s=maxC>0?(maxC-minC)/maxC:0;

  // 1) 흑발·어두운 색
  if(v<0.55) return true;

  // 2) 채도 있는 갈색/적갈색/금발 (hue 0~50 또는 300~360)
  if(s>0.15 && v<0.80){
    const hh=hueDegrees(r,g,b,maxC,minC);
    if(hh<50||hh>300) return true;
  }

  // 3) 회색·새치·백발: 저채도이면서 밝기 0.55~0.90 구간
  //    (순수 흰색 v>0.90 및 밝은 피부색 제외)
  if(s<0.18 && v>=0.55 && v<0.90) return true;

  return false;
}

// isHairColorRelaxed: isHairColor보다 완화된 기준.
// 화면 전체가 아니라 귀 주변(옆머리) 좁은 영역에서만 보조로 사용.
// 밝은 조명을 받은 잔머리(하이라이트 진 가는 머리카락)는 채도가 낮으면서도
// 밝기가 0.90 근처까지 올라가 기존 조건(v<0.90)에서 누락되는 경우가 많아
// 밝기 상한을 완화하되, 순수 배경/피부와 헷갈리지 않도록 채도 조건은 더 좁게 유지.
function isHairColorRelaxed(r,g,b){
  const maxC=Math.max(r,g,b), minC=Math.min(r,g,b);
  const v=maxC/255;
  const s=maxC>0?(maxC-minC)/maxC:0;

  // 저채도 밝은 잔머리 (기존보다 밝기 상한 확장, 흰 배경과 구분 위해 채도 하한 살짝 요구)
  if(s<0.15 && v>=0.55 && v<0.94) return true;

  // 채도 있는 갈색/적갈색 계열, 밝기 상한 확장
  if(s>0.12 && v<0.88){
    const hh=hueDegrees(r,g,b,maxC,minC);
    if(hh<55||hh>295) return true;
  }

  return false;
}

// hasHairTexture: 국소(5x5 기본) 밝기 분산으로 "결이 있는 재질(머리카락)" vs
// "매끈한 재질(안경테 등)"을 구분한다.
// 안경다리/렌즈테는 통짜 플라스틱·금속이라 작은 창 안에서 밝기가 거의 균일(분산 낮음).
// 반대로 실제 머리카락은 가는 결 하나하나가 서로 다른 밝기를 가져 국소 분산이 큼
// (흑발이든 백발이든 색과 무관하게 성립하는 재질 특성).
// isHairColorRelaxed는 색만 보므로, 색이 맞아도 이 텍스처 조건을 통과 못하면
// 안경/매끈한 표면으로 간주해 제외한다.
// TEXTURE_VAR_THRESHOLD는 실측 없이 잡은 초기값 — 조명이 아주 평평한 사진에서
// 진짜 머리카락까지 걸러질 위험이 있어 추후 실측 데이터로 재조정 필요.
const TEXTURE_VAR_THRESHOLD = 30; // 밝기(0~255) 분산 기준, 표준편차로는 약 5.5
function hasHairTexture(gray, w, h, x, y, radius){
  radius = radius || 2; // 기본 5x5 윈도우
  const xs=Math.max(0,x-radius), xe=Math.min(w-1,x+radius);
  const ys=Math.max(0,y-radius), ye=Math.min(h-1,y+radius);
  let sum=0, sumSq=0, count=0;
  for(let ny=ys; ny<=ye; ny++){
    const row=ny*w;
    for(let nx=xs; nx<=xe; nx++){
      const v=gray[row+nx];
      sum+=v; sumSq+=v*v; count++;
    }
  }
  if(count===0) return true; // 창을 못 만들면(경계) 보수적으로 통과시킴
  const mean = sum/count;
  const variance = sumSq/count - mean*mean;
  return variance >= TEXTURE_VAR_THRESHOLD;
}

/* ────────────────────────────────────────
   유틸: 모폴로지 연산 (마스크 품질 향상)
──────────────────────────────────────── */
// separable 모폴로지 연산 공용 헬퍼 (dilate/erode가 공유)
// 저사양 기기 성능을 위해 brute-force 대신 가로→세로 1차원 패스로 처리
// 연산량 O(w*h*r^2) → O(w*h*r) 로 대폭 감소
// dilating=true: 팽창(경계 밖은 클램프, 하나라도 켜지면 255)
// dilating=false: 침식(경계 밖은 배경으로 취급, 하나라도 꺼지면 0)
function morphSeparable(buf, w, h, radius, dilating){
  if(radius<=0) return new Uint8Array(buf);
  const tmp = new Uint8Array(w*h);
  for(let y=0;y<h;y++){
    const row=y*w;
    for(let x=0;x<w;x++){
      let v = dilating?0:255;
      if(dilating){
        const xs=Math.max(0,x-radius), xe=Math.min(w-1,x+radius);
        for(let nx=xs;nx<=xe;nx++){ if(buf[row+nx]>0){ v=255; break; } }
      } else {
        const xs=x-radius, xe=x+radius;
        for(let nx=xs;nx<=xe;nx++){ if(nx<0||nx>=w||buf[row+nx]===0){ v=0; break; } }
      }
      tmp[row+x]=v;
    }
  }
  const out = new Uint8Array(w*h);
  for(let x=0;x<w;x++){
    for(let y=0;y<h;y++){
      let v = dilating?0:255;
      if(dilating){
        const ys=Math.max(0,y-radius), ye=Math.min(h-1,y+radius);
        for(let ny=ys;ny<=ye;ny++){ if(tmp[ny*w+x]>0){ v=255; break; } }
      } else {
        const ys=y-radius, ye=y+radius;
        for(let ny=ys;ny<=ye;ny++){ if(ny<0||ny>=h||tmp[ny*w+x]===0){ v=0; break; } }
      }
      out[y*w+x]=v;
    }
  }
  return out;
}

// dilate: 마스크를 radius 픽셀만큼 팽창 (사이드 하단 경계 확장)
function dilate(buf, w, h, radius){
  return morphSeparable(buf, w, h, radius, true);
}

// erode: 마스크를 radius 픽셀만큼 침식 (노이즈 제거)
function erode(buf, w, h, radius){
  return morphSeparable(buf, w, h, radius, false);
}

// closing = dilate → erode: 구멍 채우기 (사이드 하단 단절 구간 연결)
function morphClose(buf, w, h, radius){
  return erode(dilate(buf, w, h, radius), w, h, radius);
}

// fillColumnGaps: 각 열에서 마스크 픽셀 사이 빈 구간을 채움
// (머리카락이 희박하게 감지된 열에서 위아래 사이 구멍 메우기)
function fillColumnGaps(buf, w, h, maxGap){
  const out = new Uint8Array(buf);
  for(let x=0;x<w;x++){
    let lastOn=-1;
    for(let y=0;y<h;y++){
      if(buf[y*w+x]>0){
        if(lastOn>=0 && (y-lastOn-1)<=maxGap){
          for(let fy=lastOn+1;fy<y;fy++) out[fy*w+x]=255;
        }
        lastOn=y;
      }
    }
  }
  return out;
}

// keepLargestComponents: 마스크를 8방향 연결 요소로 분리하고, 가장 큰 덩어리(주로
// "실제 머리") 대비 일정 비율보다 작은 고립된 섬은 지워버린다.
// 배경/옷깃/안경테 등을 얇게 오탐한 작은 덩어리가 본체 머리카락과 이어지지 않은 채
// 따로 떠 있는 경우, scalpY는 "마스크만 있으면 유효 컬럼"으로 인정하기 때문에
// 그 위에도 정상적으로 가닥이 심어져 "머리에서 떨어진 덩어리"로 보이는 문제가 있었음.
// minRatio: 최대 덩어리 면적 대비 이 비율보다 작은 컴포넌트는 제거 (기본 3%)
function keepLargestComponents(buf, w, h, minRatio){
  const n = w*h;
  const labels = new Int32Array(n).fill(-1);
  const areas = [];
  const stack = new Int32Array(n); // BFS/DFS용 스택 (최악의 경우 전체 픽셀)
  let nextLabel = 0;
  for(let start=0; start<n; start++){
    if(buf[start]===0 || labels[start]>=0) continue;
    let sp = 0;
    stack[sp++] = start;
    labels[start] = nextLabel;
    let area = 0;
    while(sp>0){
      const p = stack[--sp];
      area++;
      const px = p % w, py = (p - px) / w;
      // 8방향 이웃
      for(let dy=-1; dy<=1; dy++){
        for(let dx=-1; dx<=1; dx++){
          if(dx===0 && dy===0) continue;
          const nx = px+dx, ny = py+dy;
          if(nx<0||nx>=w||ny<0||ny>=h) continue;
          const np = ny*w+nx;
          if(buf[np]>0 && labels[np]<0){
            labels[np] = nextLabel;
            stack[sp++] = np;
          }
        }
      }
    }
    areas.push(area);
    nextLabel++;
  }
  if(areas.length <= 1) return buf; // 덩어리가 하나뿐이면(또는 없으면) 그대로
  const maxArea = Math.max(...areas);
  const threshold = maxArea * minRatio;
  const out = new Uint8Array(n);
  for(let i=0;i<n;i++){
    const lbl = labels[i];
    if(lbl>=0 && areas[lbl] >= threshold) out[i] = buf[i];
  }
  return out;
}

