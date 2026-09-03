/* ══════════════════════════════════════════════════════════
   03a-hair-mask.js — 헤어 세그멘테이션 · 모발 프로필 실측 · 마스크 추출
   원본 index.html 5923~6511행. 클래식 스크립트이므로 로드 순서가 곧
   실행 순서다 — index.html의 <script src> 순서를 바꾸지 말 것.
   ══════════════════════════════════════════════════════════ */
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
const _segmenterInitPromise = initSegmenter();

// ── 목/어깨 실루엣 실측용 바디 세그멘터(2026-07-14 추가) ──
// 사용자 요청: "헤어추출과정에서 잠시 제외했다가 추출끝나면 포함시키면
// 되겠네" — 목·어깨 영역이 헤어 마스크에서는 계속 제외돼야 맞지만(피부/옷이
// 머리카락 색상 판정을 오염시키므로), 그 사람의 실제 목 폭·두께를 재려면
// 완전히 별개의 "사람 실루엣"마스크가 하나 더 필요함. 위 `segmenter`
// 전역변수는 MediaPipe hair_segmenter(성공 시, background/hair 2클래스뿐 —
// 피부 여부는 알 수 없음) 아니면 TF.js MediaPipeSelfieSegmentation(실패
// 폴백 시에만) 둘 중 하나만 들어있어서, 대부분의 경우(=MediaPipe 성공 시)엔
// "사람 전체 실루엣" 마스크 자체가 아예 안 만들어짐. 그래서 `segmenter`와는
// 별개로 `bodySegmenter`를 만들어 항상(성공/실패 경로와 무관하게) 사람
// 전체 실루엣을 얻는다 — 라이브러리(tf.js, body-segmentation)는 이미
// <head>에서 조건 없이 항상 로드되고 있으므로(위 STEP1 주석 참고) 새 외부
// 의존성 추가는 아님, 모델 인스턴스만 하나 더 만드는 것.
// 예외: 헤어 폴백 경로가 이미 같은 모델(MediaPipeSelfieSegmentation)을
// `segmenter`로 로드해뒀다면 중복 로드하지 않고 그대로 재사용한다.
let bodySegmenter = null;
async function initBodySegmenter(){
  await _segmenterInitPromise; // state.segmenterType이 확정될 때까지 대기
  if(state.segmenterType === 'TF.js' && segmenter){
    bodySegmenter = segmenter; // 이미 로드된 같은 모델 재사용
    console.log('목 실측용 바디 세그멘터: 헤어 폴백 모델 재사용');
    return;
  }
  try{
    await tf.ready();
    await tf.setBackend('webgl');
    bodySegmenter = await bodySegmentation.createSegmenter(
      bodySegmentation.SupportedModels.MediaPipeSelfieSegmentation,
      { runtime:'tfjs', modelType:'general' }
    );
    console.log('목 실측용 바디 세그멘터 준비 완료');
  } catch(e){
    // ⚠ 정직한 한계: 이게 실패하면(구형 브라우저·메모리 부족 등) 목은 실측이
    // 아니라 예전 고정 반지름(0.42~0.5*widthFactor)으로 자동 폴백됨
    // (computeNeckCrossSections 참고) — 헤어/얼굴 등 나머지 기능엔 영향 없음.
    console.warn('목 실측용 바디 세그멘터 로드 실패(목은 기존 고정값으로 폴백):', e);
    bodySegmenter = null;
  }
}
initBodySegmenter();

/* ────────────────────────────────────────
   헤어 마스크 추출
   - MediaPipe hair_segmenter: category mask에서 hair(=1) 픽셀 추출
   - TF.js fallback: 사람 마스크 + HSV 색상 필터로 hair 근사
──────────────────────────────────────── */
// ── 개발 스위치: 랜드마크 기반 후처리(얼굴제거박스/어깨컷오프/귀·프론트 보강) ──
// MediaPipe가 window.FilesetResolver 버그로 계속 TF.js로 폴백되던 동안 쌓인 패치들이라,
// 실제 MediaPipe hair_segmenter 마스크 특성에 맞춰 검증된 적이 없음.
// 테스트 결과: MediaPipe 마스크에서 결이 살아있는 것을 확인 — 이 패치들은 TF.js 마스크
// 기준으로 튜닝된 것이라 MediaPipe에는 불필요/역효과였음.
// → MediaPipe가 정상 동작 중일 때는 이 후처리를 끄고, TF.js 폴백으로 떨어졌을 때만 켠다.
const ENABLE_LANDMARK_POSTPROCESS = true;

// 픽셀 RGB 합계(sumR/sumG/sumB)와 샘플 개수(cnt)로부터 평균 rgb() 문자열을 만든다.
// 두피/피부색 샘플링 3곳(이마 밴드 직접 샘플, reason=2 기반, 헤어라인 위 컬럼 샘플)에서
// "합산 후 rgb(...) 문자열로 변환" 로직이 그대로 반복되던 것을 하나로 합침.
// minCount 이하 샘플이면(신뢰할 수 없는 소수 샘플) null 반환 — 호출부는 그대로 폴백으로 넘어감.
function avgRGBString(sumR, sumG, sumB, cnt, minCount){
  if(cnt <= (minCount||0)) return null;
  return `rgb(${Math.round(sumR/cnt)},${Math.round(sumG/cnt)},${Math.round(sumB/cnt)})`;
}

/* ══════════════════════════════════════════════════════════════════
   모발 프로필(hairIdentity) 실측 — 형태와 무관하게 남는 세 가지 (2026-08-01)
   ─────────────────────────────────────────────────────────────────
   사용자: "마네킹 머리처럼 아무런 스타일도 없는 통짜 머리에서 시술·조정하는 걸
   하나 더 추가할 거라고. 그럼 무슨 정보가 중요하겠어. 색, 헤어질감, 그리고
   뿌리정보(얼마나 촘촘한가, 성근가, 대머리인 부분이 있는가)이겠지. 사진의
   헤어를 렌더링한 거에서 건드려도 마찬가지지 — 어차피 시술·조정에 들어가면
   원래 헤어의 형태는 뭉개지기 때문에 저 3가지가 획득·유지되어야 한다고."

   맞다. 그리고 지금 코드는 셋 중 <b>색만</b> 제대로 갖고 있었다:
     · 색   — avgColor·avgColorsBySection·colorPalette(512)·scalpColor ✓
     · 질감 — 방향(structure tensor)은 있는데 <b>재질이 없다</b>. 가닥 굵기는
              전부 튜닝 상수(0.48/0.5/0.6)이고 곱슬기는 사용자 입력이다.
     · 뿌리 — scalpY(뷰별 2D 컬럼선)뿐. 촘촘함·성근함·대머리는 아무도 안 잰다.

   여기서 <b>원본 픽셀이 살아 있을 때</b>(extractHairMask 안) 나머지 둘을 잰다.
   나가면 srcPixels가 사라져서 사진을 다시 읽어야 한다 — 그래서 여기다.

   ── 뿌리 밀도를 재는 방법 ──────────────────────────────────────────
   덮인 두피는 카메라가 못 본다. 직접 잴 수 있는 건 <b>가닥 사이로 비치는
   두피</b>뿐이고, 그게 정확히 "성근가"의 정의다. 그래서:
     머리 영역 안의 픽셀을 실측한 두 색(머리색·두피색) 중 <b>가까운 쪽</b>으로
     나누고, 머리색 쪽 비율 = 밀도.
   마스크 소속으로 안 세고 <b>색으로</b> 세는 이유: 앞단 cleanupMask가
   fillColumnGaps(6)·morphClose(3)로 작은 구멍을 이미 메워버려서, 마스크만
   보면 성근 자리가 빽빽해 보인다. 색은 그 처리에 안 지워진다.
   "머리 영역"은 마스크를 닫고 <b>바깥으로 한 번 더 부풀린</b> 것이다 —
   안 부풀리면 정수리 대머리가 아예 영역 밖이라 측정 자체가 안 된다(제일
   중요한 걸 못 재게 된다). 대신 얼굴박스(reason 2)·눈썹눈입 가드(reason 3)·
   배경(personMask 0)은 뺀다. personMask가 없으면 배경을 두피로 오인하므로
   부풀리기를 포기한다(정직한 폴백 — 못 재는 것보다 낫지만 지어내진 않는다).
══════════════════════════════════════════════════════════════════ */
const HAIR_IDENTITY = {
  on: true,
  gridN: 48,           // 뿌리 밀도 격자 — 마스크 폭 방향 셀 수(세로는 종횡비로)
  /* 닫기 반경 — <b>머리에 둘러싸인 대머리</b>를 영역 안으로 끌어들이는 값이다.
     반경 r인 닫기는 폭 2r까지의 구멍을 메우므로, 0.06×1200px=72px → 지름
     144px(사진 폭의 12%)까지의 정수리 숱빠짐이 측정 대상이 된다. 이 값이
     작으면 제일 중요한 자리를 <b>영역 밖</b>이라 조용히 안 재고 넘어간다. */
  closeFrac: 0.06,
  growFrac: 0.02,      // 바깥 테두리로 부풀리는 반경(경계에 걸친 숱빠짐 포착)
  minCellFrac: 0.25,   // 셀 넓이의 이 비율만큼 실제로 못 봤으면 "안 잼"(-1) — 지어내지
                       // 않는다. 절대 픽셀수로 두면 해상도를 바꿀 때 조용히 의미가
                       // 달라진다(1200px에선 헐겁고 작은 사진에선 전부 미측정).
  pitchSamples: 500,   // 가닥 피치 실측 표본 수
  pitchLen: 24,        // 결에 <b>수직</b>으로 훑는 프로파일 길이(px)
  minCoherence: 0.15,  // 이보다 흐린 자리는 피치·곱슬 표본에서 제외
  curlStep: 6,         // 곱슬 곡률 — 결 방향으로 이만큼 가서 각도가 얼마나 꺾이나(px)
  /* ── 광택을 두피로 세지 않는다 (2026-08-18 f) ─────────────────────────────
     8/18 d가 <b>재기만</b> 하고 판정식은 일부러 안 건드렸다("먼저 재고 알린다").
     그 측정이 실기기에서 답을 냈다 — left 76% · right 68% · back 66%가
     <b>두피색보다 밝은</b> 픽셀이었다. 즉 이 뷰들의 "숱 없음"은 대부분 두피가
     아니라 <b>광택 띠</b>다. front는 37%라 경고가 안 떴고, 그래서 정면만 멀쩡했다.
     가르는 기준은 8/18 d가 이미 이름 붙인 그것 하나다 — 가닥 사이로 비치는
     <b>진짜</b> 두피는 그늘이라 두피색보다 <b>어둡고</b>, 하이라이트는 <b>밝다</b>.
     ※ 왜 <b>조건부</b>인가: 8/18 c에서 확인된 "진짜 대머리를 읽어내는 능력"을
       지우면 안 된다. 그 케이스(front, 37%)에서는 이 보정이 아예 안 돈다.
       판정을 뒤집는 것은 <b>그 뷰의 측정 자체가 광택에 지배당했을 때</b>뿐이고,
       기준값 0.5는 새로 만든 게 아니라 8/18 d의 경고가 이미 쓰던 그 값이다. */
  glossAsHair: true,   // false면 8/18 d 이전 동작(광택도 두피로 셈)
  glossFixFrac: 0.5,   // "두피로 센 픽셀 중 두피색보다 밝은 것"이 이 비율 이상인 뷰만 보정
};

function parseRGBTriple(css){
  if(!css) return null;
  let m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(css);
  if(m) return { r:+m[1], g:+m[2], b:+m[3] };
  m = /^#([0-9a-fA-F]{6})$/.exec(String(css).trim());
  if(m){ const v = parseInt(m[1],16); return { r:(v>>16)&255, g:(v>>8)&255, b:v&255 }; }
  return null;
}
function lumaOf(r,g,b){ return 0.299*r + 0.587*g + 0.114*b; }

/* 한 뷰의 모발 프로필 실측. 순수 계산(캔버스 API 안 씀)이라 Node로 검증 가능. */
function measureViewHairIdentity(o){
  const C = HAIR_IDENTITY;
  const { srcPixels, maskBuf, w, h, reasonMask, personMask, orientation, colorPalette } = o;
  const skin = parseRGBTriple(o.scalpColorCss);
  const hair = parseRGBTriple(o.hairColorCss);
  const out = { w, h, density:null, pitchPx:null, pitchN:0, curlDegPerPx:null, curlN:0,
                glossHiLo:null, glossStd:null, hairlineTop:null, hairlineBot:null };
  if(!C.on) return out;

  // ── ① 뿌리 밀도 — 머리 영역 안에서 "머리색 쪽" 픽셀의 비율 ──
  if(skin && hair){
    const rC = Math.max(2, Math.round(w * C.closeFrac));
    let region = morphClose(maskBuf, w, h, rC);
    // 배경을 두피로 오인할 위험이 없을 때만 바깥으로 부풀린다(대머리 포착).
    const grown = personMask ? dilate(region, w, h, Math.max(2, Math.round(w * C.growFrac))) : null;
    if(grown) region = grown;
    const GW = C.gridN, GH = Math.max(1, Math.round(C.gridN * h / w));
    const hairN = new Float32Array(GW*GH), skinN = new Float32Array(GW*GH);
    // [진단] "두피"로 센 픽셀의 정체 추적 — 아래 glossN 주석 참고
    const skinLuma = lumaOf(skin.r, skin.g, skin.b), hairLuma = lumaOf(hair.r, hair.g, hair.b);
    let glossN = 0, skinPixN = 0, skinPixLuma = 0;
    /* 셀별 광택/두피 픽셀 수 — 판정을 <b>셀 단위</b>로 내리기 위해 모은다.
       (2026-08-18 g) 처음엔 뷰 전체 평균 하나로 판정했는데, 광택은 <b>국소</b>다:
       실기기에서 front는 전체 37%(경고선 아래)라 보정이 안 걸렸는데 정수리만
       듬성했다. 뷰 평균은 이마·옆·아래의 멀쩡한 픽셀에 희석되므로, 띠가 앉은
       칸 하나는 80%여도 전체는 37%로 나온다. 재는 단위와 현상의 단위를 맞춘다. */
    const glossCell = new Float32Array(GW*GH), skinCell = new Float32Array(GW*GH);
    for(let y=0; y<h; y++){
      const gy = Math.min(GH-1, (y / h * GH) | 0) * GW;
      for(let x=0; x<w; x++){
        const i = y*w + x;
        if(!region[i]) continue;
        if(reasonMask && (reasonMask[i] === 2 || reasonMask[i] === 3)) continue; // 얼굴·눈썹눈입
        if(personMask && personMask[i] !== 1) continue;                          // 배경
        const p = i*4, R = srcPixels[p], G = srcPixels[p+1], B = srcPixels[p+2];
        const dS = (R-skin.r)*(R-skin.r) + (G-skin.g)*(G-skin.g) + (B-skin.b)*(B-skin.b);
        const dH = (R-hair.r)*(R-hair.r) + (G-hair.g)*(G-hair.g) + (B-hair.b)*(B-hair.b);
        const gi = gy + Math.min(GW-1, (x / w * GW) | 0);
        if(dH <= dS) hairN[gi]++;
        else {
          skinN[gi]++;
          /* [진단] 이 "두피" 픽셀이 정말 두피인가, <b>광택</b>인가 (2026-08-18)
             사용자: "대부분 귀 위로는 다 숱이 좀 약했어."
             귀 위(정수리·후두부 상단)는 곧게 뻗은 머리의 <b>광택 띠</b>가 앉는
             자리다. 검은 머리에 흰 하이라이트가 얹히면 그 픽셀은 머리색보다
             두피색에 가까워져 <b>숱 없음</b>으로 세어진다 — 실제로는 제일 건강한
             자리인데. 실측이 맞는지 틀리는지를 여기서 한 번에 가른다:
             가닥 사이로 비치는 <b>진짜</b> 두피는 그늘에 있어 노출된 살보다
             <b>어둡다</b>. 하이라이트는 반대로 <b>밝다</b>. 그래서 두피로 센
             픽셀의 밝기를 두피색·머리색과 나란히 보면 정체가 드러난다. */
          const isGloss = lumaOf(R,G,B) > skinLuma;
          if(isGloss){ glossN++; glossCell[gi]++; }
          skinCell[gi]++;
          skinPixN++; skinPixLuma += lumaOf(R,G,B);
        }
      }
    }
    /* ── 광택 몫을 되돌린다 — <b>이 뷰가 광택에 지배당했을 때만</b> (2026-08-18 f) ──
       위 순회는 "머리색보다 두피색에 가까운 픽셀"을 두피로 셌다. 검은 머리 위의
       흰 하이라이트는 정의상 그 조건을 만족하므로 광택 띠가 통째로 "숱 없음"이
       된다. 그 띠가 앉는 자리가 하필 <b>귀 위</b>(정수리·후두부 상단)라, 마네킹이
       그 셀들을 대머리로 보고 <b>안 심고</b>, 결과가 가운데만 남은 좁은 머리가 된다.
       진짜 두피는 그늘이라 두피색보다 어둡다 — 밝은 쪽만 머리로 되돌린다.
       조건부인 이유는 위 HAIR_IDENTITY 주석 참조(진짜 대머리 판정을 지우지 않기 위함). */
    const glossFrac = skinPixN ? glossN/skinPixN : 0;
    /* ── 판정을 <b>칸마다</b> 내린다 (2026-08-18 g) ────────────────────────────
       사용자: "머리 상단부는 저렇게 숱이 듬성듬성해. 저것도 그럼 머리 상단부는
       밝기가 더 밝아서 그런 거 아냐?"
       실기기 로그가 그 질문에 힘을 싣는다 — 정수리를 재는 뷰는 <b>front</b>인데
       front는 전체 37%라 8/18 f의 보정이 <b>안 걸렸고</b>, 그러면서 광택 P90/P10은
       3.42로 네 뷰 중 <b>제일 높다</b>. 광택은 국소인데 판정은 뷰 평균이었다:
       이마·볼·아래쪽의 멀쩡한 픽셀이 정수리 띠를 희석해 37%로 만든다.
       그래서 같은 규칙(밝기)·같은 기준(0.5)을 <b>셀 단위</b>로 옮긴다. 새 상수 없음.
       ※ 여기서 중요한 건 대머리 칸만이 아니다 — 목표 가닥수는 밀도에 <b>비례</b>하므로
         (cellTarget ∝ density × 면적), 광택이 밀도를 0.9→0.35로 낮추면 대머리
         판정에 안 걸리고도 그 칸에 심는 가닥이 <b>3분의 1</b>이 된다. 격자가
         "채움 98%"라고 말해도 그건 <b>깎인 목표</b>의 98%다. 정수리가 듬성한
         것이 정확히 이 모양이다.
       표본이 적은 칸(두피로 센 픽셀 8개 미만 — minN의 바닥값과 같은 8)은 자기
       비율을 믿을 수 없으므로 뷰 전체 비율로 판정한다(= 8/18 f 동작). */
    const minSkinCell = 8;
    const movedCell = new Float32Array(GW*GH);
    let glossFixed = false, glossMoved = 0, fixedCells = 0;
    if(C.glossAsHair){
      for(let gi=0; gi<GW*GH; gi++){
        const s = skinCell[gi], g = glossCell[gi];
        if(!s || !g) continue;
        const share = (s >= minSkinCell) ? (g / s) : glossFrac;
        if(share < C.glossFixFrac) continue;
        hairN[gi] += g; skinN[gi] -= g; movedCell[gi] = g; glossMoved += g; fixedCells++;
      }
      glossFixed = fixedCells > 0;
    }
    const val = new Float32Array(GW*GH), wgt = new Float32Array(GW*GH);
    const minN = Math.max(8, (w/GW) * (h/GH) * C.minCellFrac);
    let measured = 0, baldBefore = 0, baldAfter = 0, denBefore = 0, denAfter = 0;
    /* [진단] 이미지 세로 3등분 — <b>상단(정수리)</b>이 정말 광택 지배인지 숫자로.
       뷰 평균 하나로는 이 질문에 답할 수 없다는 게 이번 건의 교훈이라 밴드로 남긴다. */
    const bandN = 3, bSkin = new Float64Array(bandN), bGloss = new Float64Array(bandN),
          bFixed = new Float64Array(bandN), bDenB = new Float64Array(bandN),
          bDenA = new Float64Array(bandN), bCells = new Float64Array(bandN);
    for(let gi=0; gi<GW*GH; gi++){
      const n = hairN[gi] + skinN[gi];
      wgt[gi] = n;
      if(n >= minN){ val[gi] = hairN[gi] / n; measured++; }
      else val[gi] = -1;              // 표본 부족 = 안 잼(뒤에서 이웃으로 채움)
      /* [진단] 이 보정이 <b>대머리 칸을 몇 개</b> 되돌렸나 + <b>밀도를 얼마나</b>
         올렸나. 0.08은 아래 소비자(HAIR_OVERLAP.baldDen · MANNEQUIN.baldDen)가
         쓰는 그 기준값이다 — 여기서 새로 정하는 게 아니라 같은 선으로 세어 보인다.
         밀도 평균을 같이 찍는 이유: 대머리 칸이 0이어도 밀도가 깎여 있으면
         목표 가닥수가 그만큼 준다(위 주석). 그게 "듬성함"의 실제 크기다. */
      const bi = Math.min(bandN-1, Math.floor((gi / GW | 0) / GH * bandN));
      bSkin[bi] += skinCell[gi]; bGloss[bi] += glossCell[gi];
      if(movedCell[gi] > 0) bFixed[bi]++;
      if(n >= minN){
        const mv = movedCell[gi];
        const vOld = n > 0 ? (hairN[gi] - mv) / n : 0;   // 옮겨도 n(총 표본)은 그대로다
        if(val[gi] < 0.08) baldAfter++;
        if(vOld    < 0.08) baldBefore++;
        denAfter += val[gi]; denBefore += vOld;
        bDenA[bi] += val[gi]; bDenB[bi] += vOld; bCells[bi]++;
      }
    }
    out.density = { GW, GH, val, wgt, measured, cells: GW*GH, grown: !!grown,
                    skinPixN, glossFrac,
                    skinPixLuma: skinPixN ? skinPixLuma/skinPixN : 0,
                    skinLuma, hairLuma, glossFixed, glossMoved, fixedCells,
                    baldBefore, baldAfter,
                    denBefore: measured ? denBefore/measured : 0,
                    denAfter:  measured ? denAfter/measured  : 0,
                    bands: Array.from({length:bandN}, (_,i)=>({
                      glossShare: bSkin[i] ? bGloss[i]/bSkin[i] : 0,
                      fixedCells: bFixed[i],
                      denBefore: bCells[i] ? bDenB[i]/bCells[i] : 0,
                      denAfter:  bCells[i] ? bDenA[i]/bCells[i] : 0 })) };
  }

  // ── ② 가닥 피치 + ③ 곱슬 곡률 — 결 <b>수직</b> 프로파일과 결 <b>방향</b> 각도차 ──
  /* 피치를 "굵기"라고 부르지 않는 이유: 머리카락 한 올은 0.07mm라 1200px
     사진에서 픽셀 아래다. 여기서 재는 건 눈에 보이는 <b>가닥 다발의 간격</b>이고,
     렌더러가 실제로 필요로 하는 값도 그쪽이다(bundle 폭). */
  if(orientation){
    const pitches = [], curls = [];
    const lumaAt = (x, y)=>{
      if(x<0||y<0||x>=w||y>=h) return -1;
      const p = ((y|0)*w + (x|0))*4;
      return lumaOf(srcPixels[p], srcPixels[p+1], srcPixels[p+2]);
    };
    // 마스크 픽셀을 결정적 스트라이드로 뽑는다(재실행해도 같은 값 — 팔레트와 같은 원칙)
    let total = 0;
    for(let i=0;i<w*h;i++) if(maskBuf[i] > 128) total++;
    const stride = Math.max(1, Math.floor(total / Math.max(1, C.pitchSamples)));
    let seen = 0;
    const half = C.pitchLen >> 1;
    for(let i=0; i<w*h; i++){
      if(maskBuf[i] <= 128) continue;
      if((seen++ % stride) !== 0) continue;
      const x = i % w, y = (i / w) | 0;
      const s = sampleOrientation(orientation, x, w, y);
      if(!s || s.coherence < C.minCoherence) continue;
      const ca = Math.cos(s.angle), sa = Math.sin(s.angle);
      // 피치 — 결에 수직(-sin, cos)으로 훑어 밝기 극대점 간격을 잰다
      const prof = [];
      for(let k=-half; k<=half; k++){
        const v = lumaAt(Math.round(x - sa*k), Math.round(y + ca*k));
        if(v < 0){ prof.length = 0; break; }
        prof.push(v);
      }
      if(prof.length >= 7){
        let mean = 0; for(const v of prof) mean += v; mean /= prof.length;
        let sd = 0; for(const v of prof) sd += (v-mean)*(v-mean); sd = Math.sqrt(sd/prof.length);
        if(sd > 2){                       // 완전히 평평한 곳(하이라이트 없음)은 제외
          const peaks = [];
          for(let k=1; k<prof.length-1; k++){
            if(prof[k] >= prof[k-1] && prof[k] > prof[k+1] && prof[k] > mean + sd*0.3) peaks.push(k);
          }
          if(peaks.length >= 2){
            let gap = 0; for(let k=1;k<peaks.length;k++) gap += peaks[k]-peaks[k-1];
            pitches.push(gap / (peaks.length-1));
          }
        }
      }
      // 곱슬 — 결 방향으로 curlStep만큼 가서 각도가 얼마나 꺾이나(도/px)
      const nx = x + ca*C.curlStep, ny = y + sa*C.curlStep;
      if(nx>=0 && ny>=0 && nx<w && ny<h && maskBuf[((ny|0)*w + (nx|0))] > 128){
        const s2 = sampleOrientation(orientation, nx, w, ny);
        if(s2 && s2.coherence >= C.minCoherence){
          let d = s2.angle - s.angle;                 // 결은 선분이라 180° 주기
          while(d >  Math.PI/2) d -= Math.PI;
          while(d < -Math.PI/2) d += Math.PI;
          curls.push(Math.abs(d) * 180/Math.PI / C.curlStep);
        }
      }
    }
    const median = arr=>{ if(!arr.length) return null; const a = arr.slice().sort((p,q)=>p-q);
                          return a[a.length>>1]; };
    out.pitchPx = median(pitches); out.pitchN = pitches.length;
    out.curlDegPerPx = median(curls); out.curlN = curls.length;
  }

  // ── ④ 광택 대비 — 실측 팔레트의 명도 분포(어두운 다수 / 밝은 소수) ──
  if(colorPalette && colorPalette.length >= 16){
    const L = [];
    for(const css of colorPalette){ const c = parseRGBTriple(css); if(c) L.push(lumaOf(c.r,c.g,c.b)); }
    if(L.length >= 16){
      L.sort((a,b)=>a-b);
      const p10 = L[Math.floor(L.length*0.10)], p90 = L[Math.floor(L.length*0.90)];
      let m=0; for(const v of L) m+=v; m/=L.length;
      let sd=0; for(const v of L) sd+=(v-m)*(v-m); sd=Math.sqrt(sd/L.length);
      out.glossHiLo = (p90 + 1) / (p10 + 1);
      out.glossStd  = sd;
    }
  }

  // ── ⑤ 헤어라인 — 머리카락이 <b>피부와 맞닿은</b> 경계(배경과 닿은 데는 제외) ──
  /* 마네킹에서 제일 먼저 티나는 자리이고, 사진에서 유일하게 직접 보이는
     고신뢰 뿌리 정보다(덮여 있지 않으니까). 컬럼별 위/아래 접점 하나씩. */
  {
    const top = new Float32Array(w).fill(-1), bot = new Float32Array(w).fill(-1);
    const isSkin = (i)=>{
      if(maskBuf[i] > 128) return false;
      if(reasonMask && reasonMask[i] === 2) return true;          // 얼굴박스 피부
      if(personMask && personMask[i] !== 1) return false;         // 배경
      if(!skin || !hair) return false;
      const p = i*4, R = srcPixels[p], G = srcPixels[p+1], B = srcPixels[p+2];
      const dS = (R-skin.r)*(R-skin.r) + (G-skin.g)*(G-skin.g) + (B-skin.b)*(B-skin.b);
      const dH = (R-hair.r)*(R-hair.r) + (G-hair.g)*(G-hair.g) + (B-hair.b)*(B-hair.b);
      return dS < dH;
    };
    const R = 3;
    for(let x=0; x<w; x++){
      let first=-1, last=-1;
      for(let y=0;y<h;y++){ if(maskBuf[y*w+x] > 128){ if(first<0) first=y; last=y; } }
      if(first < 0) continue;
      for(let k=1;k<=R;k++){ const y=first-k; if(y>=0 && isSkin(y*w+x)){ top[x]=first; break; } }
      for(let k=1;k<=R;k++){ const y=last+k;  if(y< h && isSkin(y*w+x)){ bot[x]=last;  break; } }
    }
    out.hairlineTop = top; out.hairlineBot = bot;
  }
  return out;
}

/* ════════════════════════════════════════════════════════════════
   extractHairMask(angle) — 목차
   내부는 STEP별 중첩 함수로 나뉘어 있고, 그중 <b>사진 한 장에만 의존하는</b>
   뒤쪽 세 단계는 최상위 함수로 빼냈다(2026-08-02): 아래 STEP 10·11 참고.
   나머지 STEP은 마스크 버퍼를 <b>제자리에서 고쳐 쓰는</b> 단계들이라, 클로저
   밖으로 빼면 버퍼·해상도·랜드마크를 통째로 넘겨야 해서 그대로 뒀다.
   STEP 1  (~1313) 세그멘테이션 — MediaPipe 우선, 실패 시 TF.js 폴백
   STEP 1.5(~1345, 2026-07-14 추가) 목/어깨 실루엣용 사람 전체 마스크 —
            헤어 마스크와 별개 목적(피부 포함 여부), bodySegmenter 사용,
            실패해도 헤어/얼굴 파이프라인엔 영향 없음
   STEP 2  (~1374) 배경 오탐 제거 — 사람 머리 영역 바깥 무조건 제외
   STEP 3  (~1428) 얼굴 영역 제거 — 랜드마크 기반 동적 박스
   STEP 4  (~1463) 얼굴 부위별 정밀 가드(눈썹·눈·입)
   STEP 5  (~1501) 목·어깨 제거 — chinY 기반 동적 컷오프
   STEP 6  (~1513) 옆머리·앞머리 빈 부분 보강(귀/프론트 밴드 완화 색상 필터)
   STEP 7  (~1644) 마스크 후처리 — 컬럼 내 작은 구멍만 채움
   STEP 8  (~1656) 진단 로그 문자열 조립
   STEP 9  (~1671) 결방향 인식(Structure Tensor)
   STEP 10 두피(scalpY)·모발끝(hairEndY) 라인 추출 + 원본 해상도 스케일업
           → 최상위 extractScalpAndEndLines()
   STEP 11 결과물 — 역할이 둘이라 둘로 나눔:
           → buildHairViewCanvases()      마스크/진단/hair/base 캔버스 (그리기용)
           → measureHairColorsFromMask()  평균색·섹션별 색·실측 팔레트 (재기용)
════════════════════════════════════════════════════════════════ */
/* ── 두피선·모발끝선 추출 (2026-08-02 분리) ───────────────────────
   extractHairMask의 STEP 10을 그대로 떼어낸 것. 마스크 버퍼 하나를 받아
   컬럼별 시작/끝 y를 뽑고 원본 해상도로 되돌린다 — 사진·세그멘터·상태를
   전혀 안 보는 순수 계산이라, 큰 클로저 안에 있을 이유가 없었다. */
function extractScalpAndEndLines(hairMaskBuf, w, h, fullWidth, scale){

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

  // ── hairEndY_small 정돈(정돈층 §6): 빈곳 보간 + 이상치 클램프 + 스무딩 ──
  // 예전엔 forward/backward 보간만 수동으로 했고, 그 코드가 아래 가닥뿌리
  // 보간과 복제돼 있었음 → cleanupLine1D 단일 출처로 흡수. 추가로 클램프/
  // 스무딩이 모발끝선의 스파이크·톱니를 정돈해 "튀는 가닥/지저분한 끝선"을
  // 줄인다(보간만 하던 부분은 값이 완전히 동일함을 Node 교차검증으로 확인).
  cleanupLine1D(hairEndY_small);
  // scalpY_small은 보간하지 않음 — 두피 "시작점"은 실제 세그멘테이션 마스크가
  // 있는 컬럼에서만 나와야 함(옆 컬럼 값을 복사해 배경/천장 컬럼까지 가짜
  // 시작점을 만들면 그 자리에 가닥이 심어지는 문제가 있었음). hairEndY만
  // 보간(끝점은 추정용이라 허용)하고, scalpY는 마스크 없는 컬럼에서 -1 그대로 둔다.

  // ── earY 기반 hairEndY 강제 연장 로직 제거 ──
  // (실제 마스크에 없는 영역까지 끌어올려 옷/목까지 머리카락이 그려지는 원인이었음)
  // 사이드 하단 인식 개선은 결방향 인식 도입 후 별도로 재검토

  // 원본 해상도로 스케일업
  const invScale = 1/scale;
  const scalpY   = new Float32Array(fullWidth).fill(-1);
  const hairEndY = new Float32Array(fullWidth).fill(-1);
  for(let X=0;X<fullWidth;X++){
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

/* ══════════════════════════════════════════════════════════════════
   스크래치 캔버스 풀 (2026-08-22)
   ─────────────────────────────────────────────────────────────────
   실기기(갤럭시 A15) 세 번째 녹화에서 <b>모든 캔버스가 백지</b>가 됐다.
   UI는 초당 5~7회 갱신되며 멀쩡히 동작했으니 JS가 죽은 게 아니다 —
   크롬이 메모리 압박에 캔버스 백킹스토어를 회수한 모양이다.
   원인 쪽을 보면, 이 파일엔 document.createElement('canvas')가 48곳이고
   그중 여럿이 <b>렌더 함수 안</b>에 있다. 1080×2400 한 장이 약 10MB이고
   백킹스토어는 GC가 늦게 돌려준다 — 그리는 족족 10MB씩 쌓이는 구조다.

   ── 두 가지를 준다 ────────────────────────────────────────────────
   ① scratchCanvas(key, w, h) — 같은 자리(key)는 <b>같은 캔버스를 다시 쓴다</b>.
      크기가 같으면 clearRect만 하고(재할당 없음), 다르면 그때만 다시 잡는다.
      ⚠ 규칙: <b>호출부가 캔버스를 들고 있으면 쓰면 안 된다.</b> 다음 프레임이
        같은 캔버스를 덮어쓴다. 들고 있는 곳(결과 화면 _resultScene.hairLayer)은
        예전대로 새로 만든다 — 그래서 아래 renderFrame이 onDone 유무로 가른다.
   ② 카운터 — 지금까지 만든 수·재사용 수·풀이 쥔 픽셀MB. 예전 [성능]의
      캔버스 수는 document.getElementsByTagName('canvas')라 <b>DOM에 붙은 것만</b>
      셌다. 정작 위험한 오프스크린은 안 세지고 있었다(계측이 틀렸던 자리).
   되돌리기: CANVAS_POOL.on = false (전부 예전처럼 새로 만든다)
══════════════════════════════════════════════════════════════════ */
/* 얼굴 재질·조명 스위치 (2026-08-22) — 근거는 buildRealFaceMesh 주석 참고.
     unlit      : 사진이 들어간 얼굴 면에 장면 조명을 <b>안</b> 건다(사진에 이미 있다)
     lightScale : 절차적 두개골·목 조명의 총 배율. 1.0이면 예전(합계 1.8배, 잘림).
                  0.55면 합계 ≈0.99로 알베도를 안 넘어 <b>음영이 살아난다</b>. */
const FACE_MAT = { unlit: true, lightScale: 0.55 };
const CANVAS_POOL = { on: true, release: true, made: 0, reused: 0, _pool: new Map() };
function scratchCanvas(key, w, h){
  w = Math.max(1, w|0); h = Math.max(1, h|0);
  if(!CANVAS_POOL.on){
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    CANVAS_POOL.made++; return c;
  }
  let c = CANVAS_POOL._pool.get(key);
  if(!c){ c = document.createElement('canvas'); CANVAS_POOL._pool.set(key, c); CANVAS_POOL.made++; }
  else CANVAS_POOL.reused++;
  if(c.width !== w || c.height !== h){ c.width = w; c.height = h; return c; }
  /* 크기가 같으면 재할당 없이 비운다. width 대입은 컨텍스트 상태까지 초기화하지만
     백킹스토어를 새로 잡으므로(=우리가 피하려는 바로 그것) 손으로 되돌린다. */
  const x = c.getContext('2d');
  x.setTransform(1,0,0,1,0,0);
  x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
  try{ x.filter = 'none'; }catch(e){}
  x.clearRect(0, 0, w, h);
  return c;
}
/* 다 쓴 <b>일회용</b> 캔버스의 백킹스토어를 지금 돌려준다. GC를 기다리면
   폰에서는 그 사이에 다음 장이 또 잡힌다.
   ⚠ 아직 누가 보고 있는 캔버스에 부르면 그 자리가 <b>빈 화면</b>이 된다 —
     부르는 쪽이 "이건 확실히 끝난 것"임을 알 때만 쓴다.
   되돌리기: CANVAS_POOL.release = false */
function releaseCanvas(c){
  if(!c || !CANVAS_POOL.release) return;
  try{ c.width = 0; c.height = 0; }catch(e){}
}
/* 캔버스 <b>개체</b>를 식별한다. 재촬영으로 마스크 캔버스가 새로 만들어지면
   크기·뷰가 같아도 다른 그림이므로, 캐시 서명이 그걸 반드시 봐야 한다.
   (처음엔 크기만 봤는데, 그러면 같은 폰으로 다시 찍은 사진에 옛 마스크가 붙는다.) */
let _canvasGidSeq = 0;
function canvasGid(c){
  if(!c) return 0;
  if(!c._gid) c._gid = ++_canvasGidSeq;
  return c._gid;
}
function canvasPoolMB(){
  let px = 0;
  try{ CANVAS_POOL._pool.forEach(c=>{ px += (c.width||0) * (c.height||0); }); }catch(e){}
  return px * 4 / 1048576;
}

