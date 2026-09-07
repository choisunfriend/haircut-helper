/* ══════════════════════════════════════════════════════════
   01-face-landmarker.js — 얼굴 랜드마크 실측 · 포즈 행렬 · 섹션 경계 보정
   원본 index.html 4782~5156행. 클래식 스크립트이므로 로드 순서가 곧
   실행 순서다 — index.html의 <script src> 순서를 바꾸지 말 것.
   ══════════════════════════════════════════════════════════ */
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
      // outputFacialTransformationMatrixes: MediaPipe가 내부적으로 캐노니컬(표준) 3D
      // 얼굴 모델을 감지된 얼굴에 맞추는 변환(회전+이동) 행렬을 계산해서 넘겨줌 —
      // 이게 사실상 우리가 직접 구현하려던 PnP(Perspective-n-Point) 포즈 추정을
      // MediaPipe가 이미 해주는 것. 이 행렬에서 yaw/pitch/roll을 뽑아 4장 사진의
      // 실측 촬영 각도를 공통 좌표계(0도=정면 기준) 위에 놓는 데 사용한다.
      outputFacialTransformationMatrixes: true,
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

/* ── 후면 귀 앵커 (2026-07-26, PoseLandmarker 연결) ────────────────────
   문제: 후면은 FaceLandmarker가 원리적으로 실패한다(검출기가 얼굴 박스를 못 찾으면
        468점 회귀가 아예 안 돌고, 234/454는 얼굴 메쉬가 통째로 맞아야 나오는
        윤곽점이라 "귀만" 뽑을 수 없다). 실기기 로그로도 원본·확대·크롭 3회가
        매번 전부 실패 — 반면 좌/우는 크롭 재시도로 살아났다(얼굴이 일부라도
        보이면 크롭이 구제, 전혀 안 보이면 어떤 크롭도 못 구제).
   결과: 후면만 다른 자를 쓰고 있었다. 정면·좌·우는 귀 랜드마크(234/454)를
        기준점으로 쓰는데 후면은 "어깨 직전 가장 넓은 가로선"을 귀로 간주.
   해법: PoseLandmarker(검출기가 얼굴이 아니라 '사람'을 찾으므로 뒤에서도 동작)의
        귀 7·8번을 후면 사진에도 돌려서 실측 귀 좌표를 얻는다. 이러면 네 장이
        모두 "귀"라는 같은 해부학적 기준점을 공유한다.
        ※ 후면 슬롯에선 이미 라이브 가이드용으로 로드돼 있어 추가 다운로드 0.
        ※ 가려진 귀라 위치는 추정값이다 — 정면 윤곽점만큼 정밀하진 않지만
          간접 추정(최대폭 행)보다는 낫고, 무엇보다 기준이 같아진다. */
async function detectBackEarsByPose(angle){
  try{
    const dataUrl = state.shots[angle]; if(!dataUrl) return null;
    await ensurePoseLandmarker();
    if(poseLandmarkerState !== 'ready' || !posePoseLandmarker) return null;
    const img = await new Promise((res)=>{ const im=new Image(); im.onload=()=>res(im); im.onerror=()=>res(null); im.src=dataUrl; });
    if(!img) return null;
    let r = null;
    try{ r = posePoseLandmarker.detect(img); }catch(e){ return null; }
    const pts = r && r.landmarks && r.landmarks[0];
    if(!pts || pts.length < 13) return null;
    const lE = pts[7], rE = pts[8];
    if(!lE || !rE) return null;
    const span = Math.abs(rE.x - lE.x);
    if(!(span > 0.02)) return null;              // 완전 옆모습 등 — 못 씀
    /* 타당성 검사 (2026-07-26 추가)
       뒤에서는 양쪽 귀가 모두 가려져 있어서, PoseLandmarker가 두 점을 뒤통수
       한가운데로 붕괴시키는 경우가 있다(실측 로그: 간격 3.5% — 귀 위치가 아님).
       그 값을 앵커로 쓰면 두상 폭이 통째로 줄어든다(0.504 → 0.470, 세로/폭 1.50→1.66).
       같은 사진 안의 어깨 너비와 비율로 보면 촬영 거리·프레이밍이 상쇄된다.
       사람의 귀 간격 ÷ 어깨 너비 ≈ 0.35~0.45 → 넉넉하게 0.20~0.80만 통과시킨다. */
    const sL = pts[11], sR = pts[12];
    const shoulderW = (sL && sR) ? Math.abs(sR.x - sL.x) : 0;
    if(shoulderW > 0.05){
      const rel = span / shoulderW;
      if(rel < 0.20 || rel > 0.80){
        console.log(`[${angle}] 포즈 귀 간격 비정상 — 어깨 대비 ${(rel*100).toFixed(0)}% (정상 20~80%). 앵커로 쓰지 않고 실루엣으로 폴백`);
        return null;
      }
    }
    return { lEarX: Math.min(lE.x, rE.x), rEarX: Math.max(lE.x, rE.x),
             earY: (lE.y + rE.y) / 2, span, shoulderW,
             shoulderY: (pts[11] && pts[12]) ? (pts[11].y + pts[12].y)/2 : null };
  }catch(e){ console.warn('후면 귀 앵커 실패:', e); return null; }
}

async function detectFaceLandmarks(angle){
  if(!faceLandmarkerReady || !faceLandmarker) return null;
  const dataUrl = state.shots[angle]; if(!dataUrl) return null;
  return new Promise(resolve=>{
    const img = new Image();
    img.onload = ()=>{
      try{
        // ── 감지 재시도 사다리 (2026-07-26 추가) ──
        // 한 번 실패했다고 바로 포기하면 그 뷰 전체가 추정치로 떨어져 3D가 망가진다.
        // MediaPipe가 경사 각도에서 놓치는 원인은 대개 "얼굴이 프레임 대비 작다"라
        // 확대·크롭한 사본으로 다시 넣으면 붙는 경우가 많다. 좌우 반전 사본은 쓰지
        // 않는다(랜드마크 인덱스의 좌/우 의미가 뒤집혀 lEarX/rEarX 규약이 깨짐).
        // 좌표는 정규화(0~1)라, 크롭·확대는 아래 map()의 1차식으로 정확히 되돌아온다.
        const IW = img.naturalWidth || img.width, IH = img.naturalHeight || img.height;
        const attempts = [
          { name:'원본',          sx:0,        sy:0,        sw:IW,      sh:IH,      scale:1 },
          { name:'2배확대',       sx:0,        sy:0,        sw:IW,      sh:IH,      scale:2 },
          { name:'중앙크롭확대',  sx:IW*0.15,  sy:IH*0.08,  sw:IW*0.70, sh:IH*0.84, scale:2 },
        ];
        let result = null, mapPt = null, via = null;
        for(const at of attempts){
          const s = Math.max(1, Math.min(at.scale, 1800/at.sw, 1800/at.sh));
          let src, m;
          if(at.sw === IW && at.sh === IH && s === 1){
            src = img; m = null;                       // 원본 그대로 — 좌표 변환 불필요
          } else {
            const cv = document.createElement('canvas');
            cv.width = Math.round(at.sw*s); cv.height = Math.round(at.sh*s);
            const cx = cv.getContext('2d');
            cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = 'high';
            cx.drawImage(img, at.sx, at.sy, at.sw, at.sh, 0, 0, cv.width, cv.height);
            src = cv;
            m = p => ({ x:(at.sx + p.x*at.sw)/IW, y:(at.sy + p.y*at.sh)/IH, z:p.z*(at.sw/IW) });
          }
          let r = null;
          try{ r = faceLandmarker.detect(src); }catch(e){ r = null; }
          if(r && r.faceLandmarks && r.faceLandmarks.length){ result = r; mapPt = m; via = at.name; break; }
        }
        if(!result){
          window.__lmDiag = `[${angle}] 얼굴 감지 실패 (원본·확대·크롭 3회 모두 실패 — 각도 과함/조명)`;
          console.warn(window.__lmDiag);
          resolve(null); return;
        }
        if(via !== '원본') console.log(`[${angle}] 랜드마크 감지: 원본 실패 → '${via}' 재시도로 성공`);
        const lm = mapPt ? result.faceLandmarks[0].map(mapPt) : result.faceLandmarks[0];
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
        // ── 실측 3D 포즈(PnP 결과) ──
        // outputFacialTransformationMatrixes로 받은 4x4 변환행렬에서 회전만
        // 뽑아 yaw/pitch/roll을 "도" 단위로 계산. earSpan 비율로 어림하던
        // 기존 yaw(-1~1)보다 훨씬 정확하고, 4장 사진을 하나의 공통 각도
        // 좌표계(0도=정면 기준) 위에 놓을 수 있게 해준다.
        let poseYawDeg = null, posePitchDeg = null, poseRollDeg = null;
        if(result.facialTransformationMatrixes && result.facialTransformationMatrixes.length){
          try{
            const pose = decomposePoseMatrix(result.facialTransformationMatrixes[0].data);
            poseYawDeg   = pose.yawRad   * 180/Math.PI;
            posePitchDeg = pose.pitchRad * 180/Math.PI;
            poseRollDeg  = pose.rollRad  * 180/Math.PI;
          }catch(e){ console.warn('포즈 행렬 분해 실패:', e); }
        }
        const info = { yaw, foreheadY:forehead.y, eyeY, earY, chinY:chin.y, browTopY, features,
                       lEarX:lEar.x, rEarX:rEar.x, poseYawDeg, posePitchDeg, poseRollDeg,
                       detectVia: via,   // 어느 재시도 단계에서 잡혔는지(진단용)
                       // 468개 랜드마크 원본(x,y,z) 전부 저장 — 지금까지는 이 중 10여 개
                       // 이름 붙은 점만 뽑아 쓰고 나머지(코 돌출·광대·턱선 등 실제 입체
                       // 정보)는 버리고 있었음. buildRealFaceMesh()가 이걸로 진짜 3D
                       // 얼굴 메쉬(FACE_MESH_TRI_V/VT/UV, MediaPipe 공식 토폴로지)를 만듦.
                       rawLandmarks: lm.map(p=>({x:p.x, y:p.y, z:p.z})) };
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

// facialTransformationMatrixes[0].data: 16개 값의 column-major 4x4 변환행렬
// (MediaPipe 캐노니컬 얼굴 모델 → 감지된 얼굴로의 변환, 사실상 PnP 결과).
// column-major이므로 data[col*4+row]가 수학적 행렬 표기 M[row][col]에 해당.
// 회전 성분(3x3)만 뽑아 표준 Tait-Bryan(Y-X-Z) 순서로 yaw/pitch/roll(라디안)을
// 분해한다. yaw = Y축 회전(고개를 좌우로 돌리는 것 = 우리가 4장 정렬에 쓸 값).
function decomposePoseMatrix(data){
  const m = (r,c)=> data[c*4+r];
  const r00=m(0,0), r10=m(1,0), r20=m(2,0);
  const r11=m(1,1), r12=m(1,2), r21=m(2,1), r22=m(2,2);
  const sy = Math.sqrt(r00*r00 + r10*r10);
  const singular = sy < 1e-6; // 짐벌락(거의 완전 위/아래를 보는 극단적 경우) 방지
  let yaw, pitch, roll;
  if(!singular){
    yaw   = Math.atan2(-r20, sy);
    pitch = Math.atan2(r21, r22);
    roll  = Math.atan2(r10, r00);
  } else {
    yaw   = Math.atan2(-r20, sy);
    pitch = Math.atan2(-r12, r11);
    roll  = 0;
  }
  return { yawRad: yaw, pitchRad: pitch, rollRad: roll };
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

  // ── 두정선(Parietal Ridge / Crest Area) — 진짜 미용 기준선 도입 ──
  // 미용 교재(Milady's Cosmetology 등) 정의: "귀 위쪽 손가락 3개 너비 지점에서
  // 시작해 템플~크라운 하단까지 이어지는, 머리에서 가장 넓은 둘레선". 이 선을
  // 기준으로 위(Interior, 머리카락이 "눕는" 쪽)는 크라운/프론트, 아래(Exterior,
  // "늘어지는" 쪽)는 템플/사이드/후두부로 나뉨 — 실제 미용사가 두상을 나눌 때
  // 쓰는 물리적 기준이 이거임. 예전엔 이 개념 자체가 코드에 없어서 크라운 경계를
  // 엉뚱하게(이마 높이 기준) 잡고 있었음.
  // 실제 3D 스캔이 없어 정확한 cm 측정은 불가능 — 귀(earY)~이마 랜드마크
  // (foreheadY, MediaPipe 인덱스10=헤어라인 부근) 사이를 귀 쪽에서 40% 지점으로
  // 근사(경험적 근사치, "3 손가락 너비"를 비율로 환산한 것 — 실사진 검증 후
  // 재조정 필요할 수 있음).
  const parietalRidgeY = lm.earY - (lm.earY - lm.foreheadY) * 0.40;

  // Y 경계: 랜드마크 기반 실제 해부학적 위치로 보정
  // crown(정수리): Apex~두정선 사이(Interior 전체) — 예전엔 이마 높이 기준으로
  // 잘못 잡아서 실제 크라운 영역 대부분(두정선까지)이 빠져 있었음.
  SECTIONS.crown.yRange     = [0,                     parietalRidgeY];
  // front(프론트): 이마 헤어라인~눈썹 사이의 좁은 밴드 — 미용 용어로는 정확히
  // "Fringe(뱅)"에 더 가까움. crown과는 별개로, 그 안쪽의 더 좁은 중심 밴드.
  SECTIONS.front.yRange     = [lm.foreheadY * 0.85,   lm.browTopY * 1.05];
  // temple(템플): 두정선 바로 아래(귀 위/앞)의 좁은 영역 — 두정선을 상단 기준으로 씀
  SECTIONS.temple.yRange    = [parietalRidgeY * 0.97,  lm.earY * 1.05];
  // side("사이드", 정식 미용 용어는 아니고 편의상 이름 — 실제로는 두정선 아래
  // Exterior 영역 전체를 뜻함): 두정선부터 시작해야 크라운과 안 겹치고 이어짐.
  SECTIONS.side.yRange      = [parietalRidgeY,         lm.earY * 1.40];
  // occipital(후두부): 귀~후두골(정확한 랜드마크가 없어 chinY 기반 근사 유지)까지
  SECTIONS.occipital.yRange = [lm.earY * 1.10,         lm.chinY * 0.90];
  // nape(네이프): 후두골 아래~목선
  SECTIONS.nape.yRange      = [lm.chinY * 0.78,        1.0];

  const lx = Math.min(lm.lEarX, lm.rEarX);
  const rx = Math.max(lm.lEarX, lm.rEarX);
  SECTIONS.crown.xRange  = [lx * 0.3,  rx + (1-rx)*0.7];
  SECTIONS.front.xRange  = [lx * 0.55, rx + (1-rx)*0.45];
  SECTIONS.side.xRange   = [lx * 0.1,  rx + (1-rx)*0.9]; // 사이드는 넓게
  // 렌더마다 호출되므로 기본은 조용히 — 상세 모드에서만 출력(2026-07-22 로그 정리)
  if(window.DIAG_VERBOSE) console.log('[' + angle + '] yaw=' + lm.yaw.toFixed(2) + ' 섹션 경계 보정됨(두정선 y=' + parietalRidgeY.toFixed(3) + ')');
}

/* ────────────────────────────────────────
   4장 사진 랜드마크 매핑 테이블
   공통 기준점(귀/코/눈/턱)으로 뷰 간 섹션 연동 가중치 자동 산출
──────────────────────────────────────── */
// 뷰(angle)의 포즈 출처 등급 — 아래 getViewYawDeg(각도)와 getViewPoseConfidence
// (신뢰도)가 똑같은 3단 분기를 각자 복제하고 있던 것을 하나로 모음(2026-07-18).
// 둘이 같은 판정을 공유해야 "각도는 실측인데 신뢰도는 폴백값" 같은 어긋남이
// 구조적으로 불가능해짐. 등급:
// 1) 'pnp'    — MediaPipe 포즈 행렬(outputFacialTransformationMatrixes) 실측. 가장 정확
// 2) 'approx' — 랜드마크는 있으나 포즈 행렬 없음(구버전 API 등) → 귀 간격 비율 근사(yaw*90)
// 3) 'live'   — 저장 사진에선 감지 실패했지만, 셔터를 누르기 직전 실시간 가이드가
//               같은 얼굴을 같은 PnP로 실측해둔 각도가 있음 → 그 값을 그대로 사용
//               (2026-07-26 추가, 아래 CAPTURE POSE 주석 참고)
// 4) 'none'   — 실측도 라이브 값도 없는 뷰(주로 얼굴이 안 보이는 후면) → 촬영 슬롯 기준각 가정
// (2026-07-26 부호 수정) left/right가 서로 반대로 들어가 있었음. 이 파일의 규약은
// "yaw 양수 = 사진 속 얼굴이 오른쪽을 봄"이고, 저장 사진은 미러라 좌측면 촬영이
// 양수로 나온다 — 실기기 실측 로그가 그대로 증명(정면0.2/좌31/우-25, 21°/-31°).
// 랜드마크가 잡히면 실측(poseYawDeg)이 우선이라 평소엔 안 쓰이지만, 감지 실패 시
// 폴백으로 쓰여 측면 앞/뒤(템플↔후두부)를 뒤집던 값.
const ASSUMED_YAW_DEG = { front:0, left:90, right:-90, back:180 };

/* ── (2026-07-26) 촬영 시점 라이브 포즈 폴백 ──────────────────────────────
   사용자 지시: "랜드마크 감지가 안 되었을 때도 yaw값 버리지 말고 그냥 쓰게
   바꿔줘. 지금은 90으로 반환하는 걸로 알고 있거든."
   맞는 지적이었다. 실시간 촬영 가이드(liveEvaluateFrame)는 셔터 직전까지
   매 프레임 같은 faceLandmarker로 PnP 포즈를 뽑아 "좌측 47°" 같이 화면에
   띄우고 있는데, 정작 셔터를 누른 뒤 저장 사진에서 감지가 실패하면 그 실측
   47°를 통째로 버리고 ASSUMED_YAW_DEG(±90°)로 떨어졌다. 90°는 이 파일이
   교훈 E로 이미 "쓰면 안 된다"고 기록해둔 값(실제 촬영은 24~55° 경사)이라,
   버려진 실측값보다 훨씬 나쁜 추정으로 대체하고 있던 셈.
   → 셔터를 누르는 순간의 라이브 포즈를 state.capturePose[angle]에 저장해두고
     (captureCurrentAngle), 저장 사진 감지가 실패하면 이 값을 쓴다.
   주의: 라이브 값은 카메라 원본 기준이고 저장 사진은 미러(scale(-1,1))다.
        저장에는 미러 보정을 끝낸 값만 넣는다(yaw·roll 부호 반전, pitch 유지 —
        아래 mirrorSign 처리, 거울 잡 포즈 유도(8240행 부근)와 같은 규칙).  */
const CAPTURE_POSE_MAX_AGE = 1500; // ms. 셔터 시점과 이만큼 이내의 라이브 측정만 신뢰

function getCapturePose(angle){
  const cp = state.capturePose && state.capturePose[angle];
  if(cp && typeof cp.yawDeg === 'number' && !Number.isNaN(cp.yawDeg)) return cp;
  return null;
}

function getViewPoseSource(angle){
  const lm = state.landmarks && state.landmarks[angle];
  if(lm && typeof lm.poseYawDeg === 'number' && !Number.isNaN(lm.poseYawDeg)) return { tier:'pnp', lm };
  if(lm && typeof lm.yaw === 'number') return { tier:'approx', lm };
  const cap = getCapturePose(angle);
  if(cap) return { tier:'live', lm, cap };
  // 후면처럼 얼굴이 원리적으로 안 잡히는 뷰라도, PoseLandmarker 귀 앵커가 있으면
  // 다른 뷰와 같은 기준점(귀)을 공유한다 — 각도는 슬롯 기본값이지만 위치 실측은
  // 있으므로 신뢰도를 'none'보다 높게 준다(2026-07-26).
  if(state.poseEars && state.poseEars[angle]) return { tier:'poseEar', lm };
  return { tier:'none', lm };
}

// 뷰(angle)의 실측 좌우 회전각(도).
function getViewYawDeg(angle){
  const { tier, lm, cap } = getViewPoseSource(angle);
  if(tier === 'pnp') return lm.poseYawDeg;
  if(tier === 'approx') return lm.yaw * 90;
  if(tier === 'live') return cap.yawDeg;
  // 'poseEar'는 위치 실측일 뿐 각도 실측이 아니다 — 각도는 슬롯 기본값 유지(아래 폴백).
  return ASSUMED_YAW_DEG[angle] ?? 0;
}

// pitch/roll도 같은 폴백 체인을 탄다. 예전엔 랜드마크가 없으면 그냥 0으로
// 두었는데(포즈 회전이 yaw만 남음), 라이브 실측이 있으면 셋 다 쓰는 게 맞다.
/* (2026-08-23 중복 통합) 두 함수가 필드 이름만 다른 <b>같은 폴백 체인</b>이었다.
   체인은 "저장본 실측 > 촬영 시점 실측 > 0"이고, 한쪽만 고치면 pitch와 roll이
   서로 다른 규칙으로 폴백하게 된다. 이름 있는 두 함수는 <b>그대로 남긴다</b> —
   부르는 곳이 여럿이고, 무엇을 재는지는 이름이 말해 주는 게 맞다. */
function getViewPoseDeg(angle, lmKey, capKey){
  const lm = state.landmarks && state.landmarks[angle];
  if(lm && typeof lm[lmKey] === 'number' && !Number.isNaN(lm[lmKey])) return lm[lmKey];
  const cap = getCapturePose(angle);
  return (cap && typeof cap[capKey] === 'number') ? cap[capKey] : 0;
}
function getViewPitchDeg(angle){ return getViewPoseDeg(angle, 'posePitchDeg', 'pitchDeg'); }
function getViewRollDeg(angle){  return getViewPoseDeg(angle, 'poseRollDeg',  'rollDeg');  }

// (2026-07-22 정리) 뷰 간 섹션 가중치 매핑(angularWeight/buildViewMapping/
// propagateSectionToViews)은 flat 섹션 모델 도입 후 유일 소비자가 사라져
// 죽은 코드가 됨(섹션 값은 state.sections[secId] 하나라 뷰마다 자동 적용) — 제거.

