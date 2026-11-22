/* ══════════════════════════════════════════════════════════════════
   콘솔 굵은 글씨 (2026-09-09 · 2026-09-12 고침) — 로그의 <b> 처리
   ─────────────────────────────────────────────────────────────────
   이 앱의 로그 문자열에는 <b>…</b>가 146군데 들어 있다. 원래는 <b>폰용</b>이다
   — 폰엔 F12가 없어서 같은 문자열을 화면의 '진단정보' 패널에도 띄우는데,
   그쪽은 2026-08-31에 textContent → innerHTML로 바꿔서 제대로 굵어진다
   (07b-render-compare.js:581 주석이 그 기록이다).
   고치다 만 쪽이 <b>콘솔</b>이다. console.log는 HTML을 모르니 태그가 그대로
   찍혀서, 두 달치 로그가 <b>누가 장난쳐 놓은 것처럼</b> 보였다. 실제로 그랬다.

   ⚠ 9/09에 <b>console.log를 통째로 감쌌다가 9/12에 되돌렸다.</b> 감싸면
     DevTools 소스 링크가 전부 이 파일로 바뀐다 — 녹화에서 [되쏘기보정] 옆이
     15-project-3d.js:484 가 아니라 01-face-landmarker.js:68 로 찍혔다.
     Chrome은 console.log를 <b>직접 부른 프레임</b>을 찍으므로 래퍼로는 피할 수
     없다. 두 달째 그 링크로 코드를 찾아다니는 판에 굵은 글씨와 바꿀 게 아니었다.
   그래서 래퍼 대신 <b>호출부에서 펼친다</b>: console.log(...gyeolBoldArgs([…]))
   console.log를 부르는 자리가 원래 파일이라 링크가 산다.
   %c는 이미 쓰는 자리가 있어서(빌드 배너) 스타일 인자를 세어 가며 끼워 넣는다.
   %c 말고 다른 서식(%s·%d·%o)이 섞인 줄은 <b>건드리지 않고 태그만 뗀다</b> —
   인자 짝이 밀리면 로그가 통째로 망가지는데, 그건 굵게 만드는 것보다 나쁘다.
   끄기: window.GYEOL_LOG_BOLD = false  (그러면 예전처럼 태그가 그대로 보인다)
══════════════════════════════════════════════════════════════════ */
/* <b>…</b>가 든 인자 배열을 console이 알아듣는 %c 배열로 바꿔 돌려준다. */
function gyeolBoldArgs(args){
  const BOLD = ';font-weight:700', THIN = ';font-weight:400';
  const G = (typeof window !== 'undefined') ? window
          : (typeof globalThis !== 'undefined') ? globalThis : {};
  const fmt = args[0];
  if(G.GYEOL_LOG_BOLD === false) return args;
  if(typeof fmt !== 'string' || fmt.indexOf('<b>') < 0) return args;

  /* %c 말고 다른 서식이 있으면 인자 짝을 못 믿는다 — 태그만 뗀다.
     실제 지정자만 본다. 예전엔 /%[^c%]/였는데 "<b>50%</b>" 의 %< 까지
     서식으로 세서 멀쩡한 줄이 안 굵어졌다. */
  if(/%[sdifoOj]/.test(fmt)){
    return [fmt.replace(/<\/?b>/g, '')].concat(args.slice(1));
  }

  const nStyles = (fmt.match(/%c/g) || []).length;
  const styles  = args.slice(1, 1 + nStyles);
  const rest    = args.slice(1 + nStyles);

  let out = '', outStyles = [], base = '', bold = false, si = 0, i = 0;
  const emit = () => { out += '%c'; outStyles.push(base + (bold ? BOLD : THIN)); };

  while(i < fmt.length){
    if(fmt.startsWith('%c', i)){ base = String(styles[si++] || ''); emit(); i += 2; continue; }
    if(fmt.startsWith('<b>', i)){ bold = true;  emit(); i += 3; continue; }
    if(fmt.startsWith('</b>', i)){ bold = false; emit(); i += 4; continue; }
    /* 다음 표식까지 한 번에 옮긴다 — %는 %%로 escape해야 자리가 안 밀린다 */
    let next = fmt.length;
    for(const t of ['%c', '<b>', '</b>']){
      const p = fmt.indexOf(t, i);
      if(p >= 0 && p < next) next = p;
    }
    out += fmt.slice(i, next).replace(/%/g, '%%');
    i = next;
  }
  return [out].concat(outStyles, rest);
}


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
        /* (2026-10-25c) 메모리 — 사용자: "얼굴 분석할 때 램 많이 쓰나봐 자꾸 녹화가 꺼져"
           ① 확대 사본 상한 1800 → FACE_LM_MAXPX(1200)px · 쓴 사본은 바로 반납(cv.width=0)
           ② 얼굴이 나올 수 없는 뒷모습(뒤 칸 · 360 추가 사진 중 ±120° 바깥)은 재시도 없이 원본 한 번만 */
        const backish = angle === 'back' || /^vm?(1[2-9]\d|180)$/.test(String(angle));
        const attempts = backish ? [
          { name:'원본',          sx:0,        sy:0,        sw:IW,      sh:IH,      scale:1 },
        ] : [
          { name:'원본',          sx:0,        sy:0,        sw:IW,      sh:IH,      scale:1 },
          { name:'2배확대',       sx:0,        sy:0,        sw:IW,      sh:IH,      scale:2 },
          { name:'중앙크롭확대',  sx:IW*0.15,  sy:IH*0.08,  sw:IW*0.70, sh:IH*0.84, scale:2 },
        ];
        const LMAX = (typeof window !== 'undefined' && window.FACE_LM_MAXPX > 0) ? window.FACE_LM_MAXPX : 1200;
        let result = null, mapPt = null, via = null;
        for(const at of attempts){
          const s = Math.max(1, Math.min(at.scale, LMAX/at.sw, LMAX/at.sh));
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
          if(src !== img){ try{ src.width = 0; src.height = 0; }catch(e){} }   // (2026-10-25c) 확대 사본 바로 반납
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
        let poseYawDeg = null, posePitchDeg = null, poseRollDeg = null, poseTzCm = null;
        if(result.facialTransformationMatrixes && result.facialTransformationMatrixes.length){
          try{
            const pose = decomposePoseMatrix(result.facialTransformationMatrixes[0].data);
            poseYawDeg   = pose.yawRad   * 180/Math.PI;
            posePitchDeg = pose.pitchRad * 180/Math.PI;
            poseRollDeg  = pose.rollRad  * 180/Math.PI;
            try{ const _md = result.facialTransformationMatrixes[0].data; if(isFinite(_md[14])) poseTzCm = -_md[14]; }catch(e){}   // (2026-11-10) 얼굴까지 거리(cm · MediaPipe 캐노니컬 카메라) — 두피 원근 보정(12b)
          }catch(e){ console.warn('포즈 행렬 분해 실패:', e); }
        }
        const info = { yaw, foreheadY:forehead.y, eyeY, earY, chinY:chin.y, browTopY, features,
                       lEarX:lEar.x, rEarX:rEar.x, poseYawDeg, posePitchDeg, poseRollDeg, poseTzCm,
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

/* (2026-10-25c) 360 세트 정면 고르기용 가벼운 얼굴 재기 — 긴 변 maxSide(640)px 사본에 한 번만(재시도 없음) · 사본은 바로 반납 · state는 안 건드림.
   돌려줌: null(못 찾음) | { yaw(도 · 얼굴 실측), ecN(눈→턱 ÷ 사진 높이 = 얼굴 크기) } */
function quickFaceLandmarks(url, maxSide){
  if(!faceLandmarkerReady || !faceLandmarker || !url) return Promise.resolve(null);
  return new Promise(resolve=>{
    const img = new Image();
    img.onload = ()=>{
      let cv = null;
      try{
        const IW = img.naturalWidth || img.width, IH = img.naturalHeight || img.height, k = Math.min(1, (maxSide || 640) / Math.max(IW, IH));
        cv = document.createElement('canvas'); cv.width = Math.max(8, Math.round(IW * k)); cv.height = Math.max(8, Math.round(IH * k));
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        let r = null; try{ r = faceLandmarker.detect(cv); }catch(e){ r = null; }
        if(!r || !r.faceLandmarks || !r.faceLandmarks.length){ resolve(null); return; }
        const lm = r.faceLandmarks[0];
        let yaw = null;
        if(r.facialTransformationMatrixes && r.facialTransformationMatrixes.length){ try{ yaw = decomposePoseMatrix(r.facialTransformationMatrixes[0].data).yawRad * 180 / Math.PI; }catch(e){} }
        if(yaw == null){ const nose = lm[1], le = lm[234], re = lm[454], sp = Math.abs(re.x - le.x); yaw = sp > 0.01 ? (nose.x - (le.x + re.x) / 2) / (sp * 0.5) * 60 : 0; }
        const ecN = lm[152].y - (lm[33].y + lm[263].y) / 2;
        resolve({ yaw: yaw, ecN: ecN > 0 ? ecN : 0, n: lm.length });
      }catch(e){ resolve(null); }
      finally{ if(cv){ cv.width = 0; cv.height = 0; } }
    };
    img.onerror = ()=>resolve(null);
    img.src = url;
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
/* ── 포즈 yaw를 <b>출처에서</b> 고치는 스위치 (2026-09-09 2차) ──────────────────
   기본값 off. 켜면 이 함수의 출력이 바뀌므로 <b>리프트·되쏘기·두상 치수</b>가
   전부 같이 따라간다 — 그게 요점이다.

   왜 여기인가. 9/07이 "측면 PnP가 실제보다 덜 돈다"를 발견하고 <b>그리기에만</b>
   보정을 걸었다가, 그게 리프트와 어긋나 전단을 만들었고(빌드 55에서 되돌림),
   되돌리고 나니 이번엔 마네킹 가닥이 덜 돌아 보인다. 두 증상은 같은 뿌리다:
   <b>cal.yaw가 실제 각도가 아니다.</b> 한쪽에서만 고치면 반드시 다른 쪽이 깨진다.
   PnP가 51°인데 사람이 60°로 돌아 있으면, 그리기만 틀린 게 아니라
   getHeadEllipsoid가 실루엣 폭을 나눌 때 쓰는 각도도 틀린 것이다.

   ⚠ 9/07 3차가 여기를 건드렸다가 되돌렸다("오히려 더 쏠렸어"). 그때 빠진 것은
     <b>재는 장치</b>다. yaw를 키우면 실루엣 폭의 일부가 깊이로 귀속돼 머리통이
     좁고 깊어지는데, 얼마나 그러는지를 아무도 안 쟀다. 그래서 이번엔 켜는
     순간 [포즈 보정·치수] 로그가 a(폭)·c(깊이)의 before/after를 같이 찍는다.
     그 숫자를 보고 판단할 것 — 눈으로 다시 켰다 껐다 하지 말 것.
   켜기: POSE_YAW_FIX.on = true  (모델을 다시 만들어야 반영된다 — 뷰 재진입) */
const YAW_MIRROR = { on: true, used: {} };   // (2026-10-27a) 아래 _rawViewYawDeg
/* ── (2026-11-09) 옆 사진 각도 — 얼굴 감지가 실패하면 거울 대신 <b>그 사진에서 잼</b>(PoseLandmarker 3D 코·귀) ─────────
   사용자: "실제로 사진을 재측정해서 채우는 걸 넣는게 나은거 같아. 반대쪽을 갖다 붙이니까 각도가 안맞아."
   디버그 1208(긴 웨이브): 오른쪽 얼굴 감지 실패 → 왼쪽 52.5°를 거울로 −52.5° → 사진 대조 오른쪽만 넘침 9.3% · R +5.3cm.
   ⚠ 실루엣 맞춤(정면·뒤 머리 영역으로 만든 덩어리를 옆 사진에 비춰 겹침 최대)은 이 데이터에서 실패 — 정면·뒤만으로는 깊이가 안 정해져
     두 손님 모두 어느 쪽이든 16°(범위 끝)를 고름. 그래서 사진 자체의 해부학 기준점을 씀.
   잼: PoseLandmarker(뒤 사진 귀 앵커에 이미 쓰는 그 모델 — 얼굴이 아니라 '사람'을 찾으므로 많이 돈 옆모습에서도 나옴)의 worldLandmarks(m · 카메라 축)
     ⓐ 코 − 두 귀 가운데 = 얼굴 앞 방향 → yaw = atan2(x, −z) · ⓑ 왼귀 − 오른귀 = 귀 축 → yaw = atan2(z, x). 둘이 25° 안이면 코 2 : 귀 1로 섞음, 아니면 코만.
   검증: 얼굴이 감지된(pnp) 반대쪽 사진에도 같은 걸 돌려 <b>배율 k = 실측 ÷ 포즈</b>를 잼(포즈가 덜·더 돌려 읽는 버릇). k가 0.7~1.4 밖이거나
     부호가 실측과 반대면 그 포즈 값을 안 믿고 예전(거울)로. 반대쪽 실측이 없으면 k=1 · 'unchecked' 표시.
   tier는 'none' 그대로(신뢰도 판정은 안 바꿈) — 각도만 바뀜. 끄기 SIDE_POSE_YAW.on=false (예전 거울) */
const SIDE_POSE_YAW = { on: true, minK: 0.7, maxK: 1.4, mixMaxDeg: 25, minDeg: 12, maxDeg: 88, byAngle: {}, used: {}, _k: null };
SIDE_POSE_YAW.fromWorld = function(w, lm){
  if(!w || w.length < 9) return null;
  const vis = (i)=> (lm && lm[i] && typeof lm[i].visibility === 'number') ? lm[i].visibility : 1;
  const N = w[0], L = w[7], R = w[8];
  if(!N || !L || !R) return null;
  if(vis(0) < 0.3) return null;
  const mx = (L.x + R.x)/2, mz = (L.z + R.z)/2;
  const fx = N.x - mx, fz = N.z - mz;
  if(!(Math.hypot(fx, fz) > 1e-4)) return null;
  const yNose = Math.atan2(fx, -fz) * 180 / Math.PI;
  const ex = L.x - R.x, ez = L.z - R.z;
  const yEar = Math.hypot(ex, ez) > 1e-4 ? Math.atan2(ez, ex) * 180 / Math.PI : null;
  let deg = yNose, how = '코';
  if(yEar != null && Math.abs(yEar - yNose) <= SIDE_POSE_YAW.mixMaxDeg){ deg = (2 * yNose + yEar) / 3; how = '코·귀'; }
  return { deg, yNose, yEar, how, vis: Math.min(vis(0), Math.max(vis(7), vis(8))) };
};
/* 사진 한 장 — 결과는 사진(dataUrl)과 묶어 둠(재촬영·삭제되면 자동으로 무효) */
SIDE_POSE_YAW.measure = async function(angle){
  try{
    if(!SIDE_POSE_YAW.on || (angle !== 'left' && angle !== 'right')) return null;
    const shot = _sidePoseShot(angle); if(!shot) return null;   // 키우기 전 원본(포즈는 몸·어깨가 보여야 잘 나옴)
    const have = SIDE_POSE_YAW.byAngle[angle]; if(have && have.shot === shot) return have;
    if(typeof ensurePoseLandmarker !== 'function') return null;
    await ensurePoseLandmarker();
    if(typeof poseLandmarkerState === 'undefined' || poseLandmarkerState !== 'ready' || !posePoseLandmarker) return null;
    const img = await new Promise(res=>{ const im = new Image(); im.onload = ()=>res(im); im.onerror = ()=>res(null); im.src = shot; });
    if(!img || _sidePoseShot(angle) !== shot) return null;
    let r = null; try{ r = posePoseLandmarker.detect(img); }catch(e){ r = null; }
    const w = r && r.worldLandmarks && r.worldLandmarks[0], lm = r && r.landmarks && r.landmarks[0];
    const m = SIDE_POSE_YAW.fromWorld(w, lm);
    const rec = { shot, m, at: Date.now() };
    SIDE_POSE_YAW.byAngle[angle] = rec;
    console.log('[각도 포즈] ' + angle + (m ? ' 포즈 yaw ' + m.deg.toFixed(1) + '° (' + m.how + ' · 코 ' + m.yNose.toFixed(1) + '°' + (m.yEar != null ? ' · 귀 ' + m.yEar.toFixed(1) + '°' : '') + ' · 보임 ' + m.vis.toFixed(2) + ')' : ' 포즈 못 잼(사람·코·귀 없음)'));
    return rec;
  }catch(e){ console.warn('[각도 포즈] 실패', e); return null; }
};
/* 이 칸의 사진 원본 — 03b 머리 키우기가 state.shots를 잘라 키운 사본으로 바꾸므로 그때는 키우기 전 사진(_zoomFrom)이 원본 */
function _sidePoseShot(angle){
  const cur = state.shots && state.shots[angle]; if(!cur) return null;
  try{ if(state._zoomedShot && state._zoomedShot[angle] === cur && state._zoomFrom && state._zoomFrom[angle]) return state._zoomFrom[angle]; }catch(e){}
  return cur;
}
function _sidePoseRec(angle){
  const r = SIDE_POSE_YAW.byAngle[angle];
  return (r && r.m && r.shot === _sidePoseShot(angle)) ? r.m : null;
}
/* 얼굴 감지 뒤 부름(05 촬영·업로드 검사 끝 · 03b 분석 단계) — 옆 사진 하나라도 얼굴이 없으면 그 사진과 반대쪽(배율 검증용)을 잼.
   둘 다 얼굴이 있으면 아무것도 안 함(포즈 모델을 안 띄움). 같은 사진은 한 번만 잼. */
SIDE_POSE_YAW.afterFace = async function(angle){
  try{
    if(!SIDE_POSE_YAW.on || (angle !== 'left' && angle !== 'right')) return;
    const opp = angle === 'left' ? 'right' : 'left';
    const noFace = (a)=> !!(state.shots && state.shots[a]) && !(state.landmarks && state.landmarks[a]);
    if(noFace(angle)){ await SIDE_POSE_YAW.measure(angle); if(state.shots && state.shots[opp]) await SIDE_POSE_YAW.measure(opp); }
    else if(noFace(opp)){ await SIDE_POSE_YAW.measure(angle); await SIDE_POSE_YAW.measure(opp); }
  }catch(e){}
};
/* _rawViewYawDeg 폴백 — 실측 없는 옆 사진의 각도(없으면 null) */
SIDE_POSE_YAW.yawFor = function(angle, measuredYawOf){
  if(!SIDE_POSE_YAW.on) return null;
  const me = _sidePoseRec(angle); if(!me) return null;
  const sign = angle === 'left' ? 1 : -1;
  const opp = angle === 'left' ? 'right' : 'left', om = _sidePoseRec(opp), oy = measuredYawOf(opp);
  let k = 1, note = '반대쪽 검증 없음(unchecked)';
  if(om && typeof oy === 'number' && Math.abs(oy) >= 10){
    if(Math.sign(om.deg) !== Math.sign(oy) || Math.abs(om.deg) < 5){ SIDE_POSE_YAW._note = opp + ' 포즈 ' + om.deg.toFixed(1) + '° vs 실측 ' + oy.toFixed(1) + '° 부호/크기 안 맞음 — 포즈 안 믿음'; return null; }
    k = Math.abs(oy) / Math.abs(om.deg);
    if(k < SIDE_POSE_YAW.minK || k > SIDE_POSE_YAW.maxK){ SIDE_POSE_YAW._note = opp + ' 배율 ×' + k.toFixed(2) + ' (허용 ' + SIDE_POSE_YAW.minK + '~' + SIDE_POSE_YAW.maxK + ') — 포즈 안 믿음'; return null; }
    note = opp + ' 실측 ' + oy.toFixed(1) + '° ÷ 포즈 ' + om.deg.toFixed(1) + '° = ×' + k.toFixed(2);
  }
  if(Math.sign(me.deg) !== sign){ SIDE_POSE_YAW._note = angle + ' 포즈 ' + me.deg.toFixed(1) + '° — 슬롯 방향과 반대 · 안 믿음'; return null; }
  const deg = sign * Math.max(SIDE_POSE_YAW.minDeg, Math.min(SIDE_POSE_YAW.maxDeg, Math.abs(me.deg) * k));
  const key = angle + '|' + deg.toFixed(1);
  if(SIDE_POSE_YAW._k !== key){
    SIDE_POSE_YAW._k = key;
    const mir = (typeof oy === 'number') ? (-oy).toFixed(1) + '°' : '없음';
    try{ console.log('[각도 포즈] ' + angle + ' 얼굴 실측 없음 → 포즈 ' + me.deg.toFixed(1) + '° × ' + k.toFixed(2) + ' = <b>' + deg.toFixed(1) + '°</b> (' + note + ' · 거울이었다면 ' + mir + ' · 끄기 SIDE_POSE_YAW.on=false)'); }catch(e){}
  }
  SIDE_POSE_YAW.used[angle] = { deg, k, pose: me.deg, note };
  return deg;
};
const POSE_YAW_FIX = { on: false, from: 'nose' };   // 'nose'(랜드마크 실측) | 'gain'(상수배)
function getViewYawDeg(angle){
  const raw = _rawViewYawDeg(angle);
  if(!POSE_YAW_FIX.on) return raw;
  if(typeof correctedViewYawDeg !== 'function') return raw;
  const fixed = correctedViewYawDeg(raw, angle, POSE_YAW_FIX.from);
  if(fixed !== raw && POSE_YAW_FIX._k !== angle + '|' + fixed){
    POSE_YAW_FIX._k = angle + '|' + fixed;
    console.log(...gyeolBoldArgs(['[포즈 보정·출처] ' + angle + ': yaw ' + raw.toFixed(1) + '° → ' + fixed.toFixed(1) + '°'
      + '\n    이 값은 <b>리프트·되쏘기·두상 치수</b>가 같이 씁니다 — 전단은 안 생기지만'
      + ' getHeadEllipsoid의 a(폭)·c(깊이)가 같이 움직입니다.'
      + ' 9/07이 여기서 되돌린 이유가 그것이고, 그때 없던 것이 <b>재는 장치</b>입니다:'
      + ' [진단·투영 실루엣] 배율과 아래 두상 치수 로그를 켜기 전/후로 비교하세요.'
      + ' 끄기: POSE_YAW_FIX.on = false']));
  }
  return fixed;
}
function _rawViewYawDeg(angle){
  const { tier, lm, cap } = getViewPoseSource(angle);
  if(tier === 'pnp') return lm.poseYawDeg;
  if(tier === 'approx') return lm.yaw * 90;
  if(tier === 'live') return cap.yawDeg;
  // 'poseEar'는 위치 실측일 뿐 각도 실측이 아니다 — 각도는 슬롯 기본값 유지(아래 폴백).
  /* (2026-10-27a) 옆 사진 하나만 실측이 없으면 반대쪽 실측 각도를 거울로 씀(±90° 대신).
     디버그 1012(긴 웨이브): 오른쪽 감지 실패 → −90° → 그 사진 윤곽이 엉뚱한 자리를 비춰 다시 기르기 가닥을 멈춤(카메라가 틀린 것이지 결 읽기 문제가 아님).
     실제 촬영은 24~55° 경사라 반대쪽 실측이 ±90°보다 훨씬 가까움. 신뢰도 등급(tier)은 'none' 그대로 — 다른 곳의 판정은 안 바뀜.
     끄기 YAW_MIRROR.on=false */
  /* (2026-11-09) 거울보다 먼저 — 이 사진에서 포즈로 잰 각도(위 SIDE_POSE_YAW) */
  if (angle === 'left' || angle === 'right') {
    try {
      const measuredOf = (a) => { const s = getViewPoseSource(a); return s.tier === 'pnp' ? s.lm.poseYawDeg : s.tier === 'approx' ? s.lm.yaw * 90 : s.tier === 'live' ? s.cap.yawDeg : null; };
      const py = SIDE_POSE_YAW.yawFor(angle, measuredOf);
      if (typeof py === 'number' && isFinite(py)) { if (YAW_MIRROR.used) delete YAW_MIRROR.used[angle]; return py; }
      if (SIDE_POSE_YAW.used) delete SIDE_POSE_YAW.used[angle];
    } catch (e) {}
  }
  if (YAW_MIRROR.on && (angle === 'left' || angle === 'right')) {
    const opp = angle === 'left' ? 'right' : 'left', os = getViewPoseSource(opp);
    let oy = null;
    if (os.tier === 'pnp') oy = os.lm.poseYawDeg; else if (os.tier === 'approx') oy = os.lm.yaw * 90; else if (os.tier === 'live') oy = os.cap.yawDeg;
    if (typeof oy === 'number' && !Number.isNaN(oy) && Math.abs(oy) >= 10) {
      if (YAW_MIRROR._k !== angle + '|' + oy) { YAW_MIRROR._k = angle + '|' + oy; try { console.log('[각도 거울] ' + angle + ' 실측 없음 → ' + opp + ' 실측 ' + oy.toFixed(1) + '°를 거울로 ' + (-oy).toFixed(1) + '° (예전 ' + ASSUMED_YAW_DEG[angle] + '° · 끄기 YAW_MIRROR.on=false)'); } catch (e) {} }
      YAW_MIRROR.used[angle] = -oy;
      return -oy;
    }
  }
  if (YAW_MIRROR.used) delete YAW_MIRROR.used[angle];
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

