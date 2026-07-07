/* ════════════════════════════════════════
   FACE LANDMARKER
   yaw/pitch 계산 + 랜드마크 기반 섹션 경계 보정
════════════════════════════════════════ */
let faceLandmarker = null;
let faceLandmarkerReady = false;

async function initFaceLandmarker(){
  try{
    const { FaceLandmarker: FL, FilesetResolver: FR } = await loadVisionModule();
    if(!FL || !FR){ console.warn('FaceLandmarker API 없음'); return; }
    const fs = await FR.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/wasm'
    );
    faceLandmarker = await FL.createFromOptions(fs, {
      baseOptions:{
        modelAssetPath:'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        delegate:'GPU'
      },
      runningMode:'IMAGE', numFaces:1,
    });
    faceLandmarkerReady = true;
    console.log('Face Landmarker 준비 완료');
  } catch(e){
    faceLandmarkerReady = false;
    window.__lmDiag = 'init 실패: ' + (e && e.message ? e.message : e);
    console.warn('Face Landmarker 로드 실패:', e);
  }
}
initFaceLandmarker();

async function detectFaceLandmarks(angle){
  if(!faceLandmarkerReady || !faceLandmarker) return null;
  const dataUrl = state.shots[angle]; if(!dataUrl) return null;
  return new Promise(resolve=>{
    const img = new Image();
    img.onload = ()=>{
      try{
        const result = faceLandmarker.detect(img);
        if(!result||!result.faceLandmarks||!result.faceLandmarks.length){
          window.__lmDiag = `[${angle}] 얼굴 감지 실패 (얼굴 없음/각도 과함)`;
          console.warn(window.__lmDiag);
          resolve(null); return;
        }
        const lm = result.faceLandmarks[0];
        const nose     = lm[1];
        const lEar     = lm[234];
        const rEar     = lm[454];
        const lEye     = lm[33];
        const rEye     = lm[263];
        const chin     = lm[152];
        const forehead = lm[10];
        // 이미 468개 얼굴 랜드마크를 다 찍고 있으므로, 눈썹뿐 아니라 눈·입도
        // "박스 경계선 안쪽인지" 같은 간접 추정이 아니라 실제 그 부위 점들로
        // 직접 bounding box를 구해서, 머리카락이 절대 덮으면 안 되는 자리로
        // 얼굴제거박스와 별개로 정확히 등록해둔다. (박스 밖 관자놀이 쪽으로
        // 삐져나온 눈썹 꼬리 같은 경우를 좌표 기반으로 잡기 위함)
        const bboxOf = (idxs)=>{
          const xs = idxs.map(i=>lm[i].x), ys = idxs.map(i=>lm[i].y);
          return { minX:Math.min(...xs), maxX:Math.max(...xs), minY:Math.min(...ys), maxY:Math.max(...ys) };
        };
        const LEFT_BROW_IDX  = [70,63,105,66,107,55,65,52,53,46];
        const RIGHT_BROW_IDX = [300,293,334,296,336,285,295,282,283,276];
        const LEFT_EYE_IDX   = [33,246,161,160,159,158,157,173,133,155,154,153,145,144,163,7];
        const RIGHT_EYE_IDX  = [263,466,388,387,386,385,384,398,362,382,381,380,374,373,390,249];
        const MOUTH_IDX      = [61,185,40,39,37,0,267,269,270,409,291,375,321,405,314,17,84,181,91,146];
        const features = {
          leftBrow:  bboxOf(LEFT_BROW_IDX),
          rightBrow: bboxOf(RIGHT_BROW_IDX),
          leftEye:   bboxOf(LEFT_EYE_IDX),
          rightEye:  bboxOf(RIGHT_EYE_IDX),
          mouth:     bboxOf(MOUTH_IDX),
        };
        const browTopY = Math.min(features.leftBrow.minY, features.rightBrow.minY); // 눈썹 중 가장 위쪽 y
        const earCX    = (lEar.x + rEar.x) / 2;
        const earSpan  = Math.abs(rEar.x - lEar.x);
        const yaw      = earSpan > 0.01 ? (nose.x - earCX) / (earSpan * 0.5) : 0;
        const eyeY     = (lEye.y + rEye.y) / 2;
        const earY     = (lEar.y + rEar.y) / 2;
        const info = { yaw, foreheadY:forehead.y, eyeY, earY, chinY:chin.y, browTopY, features,
                       lEarX:lEar.x, rEarX:rEar.x };
        state.landmarks = state.landmarks || {};
        state.landmarks[angle] = info;
        resolve(info);
      } catch(e){
        window.__lmDiag = `[${angle}] detect() 예외: ` + (e && e.message ? e.message : e);
        console.warn('랜드마크 추출 실패:', e);
        resolve(null);
      }
    };
    img.onerror = ()=>resolve(null);
    img.src = dataUrl;
  });
}

// ── 랜드마크 실패 시 비율 기반 폴백 ──
// Face Landmarker 로딩/감지가 실패해도 얼굴 제거 박스, 어깨 컷오프,
// 귀·프론트 보강 로직이 완전히 꺼지지 않도록, 이 앱 촬영 가이드(얼굴을
// 프레임 중앙에 맞추는 캡처 UI) 기준의 대략적인 표준 비율로 대체한다.
// 실측 랜드마크보다는 부정확하지만, "전혀 동작 안 함"보다는 훨씬 낫다.
function getEstimatedLandmarks(angle){
  const isSideView = (angle === 'left' || angle === 'right');
  return {
    yaw: 0,
    foreheadY: 0.14,
    eyeY: 0.34,
    browTopY: 0.28, // 실측 실패 시의 대략적 추정치(eyeY보다 위, foreheadY보다 아래)
    earY: 0.40,
    chinY: 0.60,
    // 측면 사진은 얼굴이 한쪽으로 치우쳐 보이므로 귀 x좌표 범위를 좁혀
    // earSpan이 작게 나오도록 해서(> 0.08 조건 실패) 옆머리를 과도하게
    // 지우지 않는 "거의 완전 측면" 분기를 타게 한다.
    lEarX: isSideView ? 0.42 : 0.28,
    rEarX: isSideView ? 0.58 : 0.72,
  };
}

function refineSectionBoundaries(angle){
  const lm = state.landmarks && state.landmarks[angle]; if(!lm) return;
  // Y 경계: 랜드마크 기반 실제 해부학적 위치로 보정
  SECTIONS.crown.yRange     = [0,                    lm.foreheadY * 0.95];
  SECTIONS.front.yRange     = [lm.foreheadY * 0.85,  lm.eyeY * 1.05];
  SECTIONS.temple.yRange    = [lm.eyeY * 0.9,        lm.earY * 1.05];
  SECTIONS.side.yRange      = [lm.earY * 0.85,       lm.earY * 1.40];
  SECTIONS.occipital.yRange = [lm.earY * 1.10,       lm.chinY * 0.90];
  SECTIONS.nape.yRange      = [lm.chinY * 0.78,      1.0];
  const lx = Math.min(lm.lEarX, lm.rEarX);
  const rx = Math.max(lm.lEarX, lm.rEarX);
  SECTIONS.crown.xRange  = [lx * 0.3,  rx + (1-rx)*0.7];
  SECTIONS.front.xRange  = [lx * 0.55, rx + (1-rx)*0.45];
  SECTIONS.side.xRange   = [lx * 0.1,  rx + (1-rx)*0.9]; // 사이드는 넓게
  console.log('[' + angle + '] yaw=' + lm.yaw.toFixed(2) + ' 섹션 경계 보정됨');
}

/* ────────────────────────────────────────
   4장 사진 랜드마크 매핑 테이블
   공통 기준점(귀/코/눈/턱)으로 뷰 간 섹션 연동 가중치 자동 산출
──────────────────────────────────────── */
function buildViewMapping(){
  const lms = state.landmarks; // {front, left, right, back}
  if(!lms) return;

  // 각 섹션별 뷰 가중치 산출
  // 기준: 해당 뷰의 랜드마크에서 그 섹션이 이미지 어느 비율에 있는지
  // → 랜드마크가 있는 뷰는 실제 계산, 없는 뷰는 해부학 기본값 사용
  const mapping = {};

  // CROWN: 이마 위 → 4뷰 모두 100% (정수리는 어느 방향에서나 동일)
  mapping.crown = { front:1.0, left:1.0, right:1.0, back:1.0 };

  // FRONT: 앞머리 → 정면100%, 측면은 yaw 기반 연결감
  const frontYaw_l = lms.left  ? Math.abs(lms.left.yaw)  : 0.7;
  const frontYaw_r = lms.right ? Math.abs(lms.right.yaw) : 0.7;
  mapping.front = {
    front: 1.0,
    left:  Math.max(0, 1.0 - frontYaw_l * 1.2),  // 측면일수록 프론트 영향 감소
    right: Math.max(0, 1.0 - frontYaw_r * 1.2),
    back:  0.0
  };

  // TEMPLE: 측면-정면 연결부
  mapping.temple = {
    front: lms.front ? Math.min(1.0, (1.0 - Math.abs(lms.front.yaw||0)) * 0.9 + 0.2) : 0.7,
    left:  0.85,
    right: 0.85,
    back:  0.15
  };

  // SIDE: 귀 옆 → 측면 100%, 정면/후면은 귀 위치 기반
  const sideW_front = lms.front
    ? Math.max(0, Math.min(0.5, (lms.front.rEarX - lms.front.lEarX) * 0.6))
    : 0.3;
  mapping.side = { front: sideW_front, left: 1.0, right: 1.0, back: 0.45 };

  // OCCIPITAL: 후두부 → 후면100%, 측면 높음
  mapping.occipital = { front: 0.0, left: 0.75, right: 0.75, back: 1.0 };

  // NAPE: 목선 → 후면100%, 측면 일부
  mapping.nape = { front: 0.05, left: 0.55, right: 0.55, back: 1.0 };

  state.viewMapping = mapping;
  console.log('[매핑] 뷰 간 섹션 가중치 산출 완료', mapping);
}

// 슬라이더 값 변경 시 인접 뷰에 가중치 반영
function propagateSectionToViews(changedAngle, sectionId, paramKey, value){
  const mapping = state.viewMapping;
  if(!mapping || !mapping[sectionId]) return;

  const w = mapping[sectionId];
  const angles = ['front','left','right','back'];
  angles.forEach(angle=>{
    if(angle === changedAngle) return; // 변경한 뷰는 스킵
    const weight = w[angle] || 0;
    if(weight < 0.05) return; // 영향 없음

    if(!state.sections[angle]) state.sections[angle]={};
    if(!state.sections[angle][sectionId]) state.sections[angle][sectionId]={};

    // 기존값과 가중치 블렌딩 (급격한 변화 방지)
    const prev = state.sections[angle][sectionId][paramKey] ?? value;
    state.sections[angle][sectionId][paramKey] = Math.round(prev + (value - prev) * weight);
  });
}
