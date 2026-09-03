/* ══════════════════════════════════════════════════════════
   10-hair-render-2d.js — 4레이어 가닥 렌더 · 레이어 클립 · 밀도 지도
   원본 index.html 13786~15027행. 클래식 스크립트이므로 로드 순서가 곧
   실행 순서다 — index.html의 <script src> 순서를 바꾸지 말 것.
   ══════════════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════════════════════
   HAIR RENDER — 4레이어 가닥 렌더 + 2단계 합성
   위 커트 연산(리졸버)과 가닥 추적(traceStrandPath)을 받아 실제 캔버스에 그린다.
   레이어 0~3(루트확산·굵은섹션·중간·잔가닥)을 같은 drawStrandLayer로 찍고,
   마스크 안(base)과 연장분(ext)을 따로 그린 뒤 마지막에 합성한다.
   조정 경로가 3D로 통일된 뒤로는 (1)중립 캡처 (2)원본 결 보기 (3)폴백 용도.
   ════════════════════════════════════════════════════════════════ */
function drawHairStrands(ctx, fit, scalpY, hairEndY, maskW, maskH, hairCanvas, opts){
  // 머리색 오버라이드 — 전역 FORCED_HAIR_COLOR(파일 상단, STYLES 위 선언)로
  // 통일됨(기존 지역 스위치 FORCE_BLACK_HAIR를 승격). 실측 색(평균색/섹션색/
  // 팔레트)을 전부 무시하고 단색으로 렌더. 언더코트(두피색)는 그대로.
  // 캡처되는 가닥 색도 여기서 덮이므로 캡처 경로 기반 3D도 같은 색.
  // 원복하려면 전역 상수만 null로.
  if(FORCED_HAIR_COLOR && opts){
    opts = Object.assign({}, opts, { color:FORCED_HAIR_COLOR, avgColorsBySection:null, colorPalette:null });
  }
  const {curl, volume, thickness, color, avgColorsBySection, colorPalette, orientation, orientMaskW, orientMaskH, angle, sections, capturePaths} = opts;
  // gyeol 스타일링(전역 마무리) — 원본 결 보기 등에서 중립으로 넘기기 위해 opts로 받음.
  const stylingForRender = opts.styling || state.styling || neutralStyling();
  // (2026-07-14, 옮기기 전환 1단계) 이 렌더에서 그린 가닥 경로(마스크 좌표계
  // 점들 + 최종 색)를 저장할 배열 — 3D가 "함수로 새로 만드는" 대신 이 완성된
  // 경로를 그대로 3D 좌표로 들어올리기 위함(사용자 설계: "2D 렌더링 완료되고
  // 나면 가상 3D 좌표에 점들을 다 옮겨서 가상 렌더링").
  const capturedStrands = capturePaths ? [] : null;
  // 실측 색 팔레트 사용 가능 여부(원본 모드 + 팔레트 존재) — 가닥 색을
  // "평균색×틴트" 대신 실제 픽셀 색 분포에서 뽑음(원본과 색감 일치 목적).
  const usePalette = Array.isArray(colorPalette) && colorPalette.length > 0;

  const alpha       = 1; // 가닥은 완전 불투명 — 굵기 효과는 lineWidth로만 반영하고
                         // 투명도로는 절대 조절하지 않음 (반투명이면 살색 언더코트와
                         // 섞여 회색빛으로 보임)

  // 해상도 비례 스케일: 아래 각 레이어의 lineWidth 기본값들은 "실제 렌더링되는 캔버스가
  // 705px 폭일 때" 눈으로 보고 튜닝됐음. ctx.lineWidth는 캔버스 픽셀 공간(=fit.dw 기준)
  // 에서 적용되는 값인데, 가닥 좌표 자체는 toCanvasX/Y가 (fit.dw/maskW) 비율로 이미
  // maskW(세그멘테이션 처리 해상도, 최대 768) → fit.dw(실제 화면 표시 폭, 폰 CSS 폭
  // 기준이라 보통 380~430px 수준)로 압축해서 그린다.
  // 버그 수정: 예전엔 resScale을 maskW/705로 계산했는데, 이건 "촬영 해상도"만 반영하고
  // "실제로 화면에 얼마나 작게 그려지는지"(fit.dw)는 전혀 반영을 안 함 — 그 결과 fit.dw가
  // maskW보다 훨씬 작은 실기기(예: fit.dw≈400, maskW≈768)에서는 좌표는 절반 이하로
  // 압축되는데 선 굵기는 거의 그대로(resScale≈768/705≈1.09)라 상대적으로 훨씬 굵어
  // 보였음(스크린샷에서 보인 마커펜 같은 뭉툭한 가닥의 직접 원인). → 실제 캔버스 렌더
  // 폭(fit.dw) 기준으로 스케일해야 좌표 압축 비율과 굵기가 항상 같이 움직인다.
  /* (2026-08-23 정리) 굵기 계산이 여기 <b>두 벌</b>로 남아 있었다.
     RES_BASE · resScale · MIN_SAFE_WIDTH · STRAND_THIN · widthScale 다섯 줄이
     선언만 되고 아무도 안 읽었다 — 2026-08-02에 굵기 계산을 hairStrandRoles로
     빼면서(아래 LOOK_ROLES) 이쪽 사본이 남은 것이다. 지운 이유와 값의 근거는
     그대로 HAIR_STRAND_LOOK · hairStrandRoles에 살아 있다:
       · minSafeWidth 0.9px — 1px 미만이면 브라우저가 알파를 낮춰 흐리게 그리므로
         해상도 배율과 <b>같이 줄면 안 되고</b> 배율 적용 뒤에 하한으로 건다
       · thin 0.48 — "비교 보기에서 보면 좀 더 가늘어져야 돼"(2026-07-16)
     ⚠ 이 함수는 3D 투영이 실패했을 때의 <b>폴백</b>이라 평소엔 안 탄다. 그래서
       두 벌이 갈라져도 화면에 안 나타났다 — 이 파일이 반복해서 겪은 그 모양이다. */
  // 레이어 0~3의 굵기·개수·틴트 — 3D 투영 렌더와 같은 출처(HAIR_STRAND_LOOK)에서 계산.
  // 아래 drawStrandLayer 호출부가 이 값을 그대로 쓴다(예전 하드코딩 값과 동일).
  const LOOK_ROLES = hairStrandRoles(fit.dw, volume, thickness);
  const [L_ROOT, L_SECTION, L_MID, L_FINE] = LOOK_ROLES;

  // 길이 슬라이더가 높을 때(특히 정면 프론트) 가닥이 이마 라인을 넘어
  // 눈·안경·턱까지 뚫고 내려가는 과확장을 막기 위한 상한.
  // maskH(축소 해상도 이미지 전체 높이)의 1.15배까지만 허용 — 화면 밖까지
  // 늘어나는 극단적인 경우를 방지하면서도 "길게" 설정한 효과는 유지.
  const maxStrandLen = maskH * 1.15;

  // 버그 수정: validCols(가닥 뿌리를 심을 수 있는 후보 컬럼)가 "보간 전" 원본 scalpY만
  // 기준으로 만들어져 있었음. 세그멘테이션이 국소적으로 실패한 좁은 구간(예: 이마 중앙에
  // 생기는 V자 notch, 안경다리에 가려진 관자놀이 등)은 scalpY[x]=-1이라 애초에 후보에서
  // 빠져서 어떤 레이어도 거기 뿌리를 못 심었음 — "가닥이 부족한 게 아니라 아예 심을
  // 자리 자체가 없었던" 문제. → 양옆 유효 컬럼 사이 간격이 좁으면(=국소적 인식 실패로
  // 판단) 보간값으로 메워서 후보에 포함시킴. 단, 진짜로 머리가 없는 넓은 영역(배경,
  // 얼굴 등)까지 메워버리면 안 되므로 간격 상한(MAX_GAP_PX)을 둬서, 그보다 넓은 gap은
  // 기존처럼 그대로 배제.
  const leftValidX = new Int32Array(maskW).fill(-1);
  const rightValidX = new Int32Array(maskW).fill(-1);
  { let lv=-1; for(let x=0;x<maskW;x++){ if(scalpY[x]>=0) lv=x; leftValidX[x]=lv; } }
  { let rv=-1; for(let x=maskW-1;x>=0;x--){ if(scalpY[x]>=0) rv=x; rightValidX[x]=rv; } }
  const MAX_GAP_PX = maskW * 0.08; // 마스크 폭의 8% 이내 gap만 "국소 인식 실패"로 보고 메움
  const validCols = [];
  for(let x=0; x<maskW; x++){
    if(scalpY[x] >= 0){ validCols.push(x); continue; }
    const lx = leftValidX[x], rx = rightValidX[x];
    if(lx>=0 && rx>=0 && (rx-lx) <= MAX_GAP_PX) validCols.push(x);
  }
  if(validCols.length === 0) return;

  // ── 보간+정돈(정돈층 §6): 위 STEP10과 복제였던 forward/backward 보간을
  //   cleanupLine1D 단일 출처로 통합.
  //   · iScalpY  = 보간만(clamp/smooth 끔). 가닥 뿌리를 심는 라인이라 위치를
  //     흔들면 안 됨 → 기존 동작을 그대로 보존(Node 교차검증으로 값 동일 확인).
  //   · iHairEndY = 4단계(보간+클램프+스무딩). 모발끝선은 정돈해도 뿌리에 영향
  //     없고, 튀는 끝가닥/톱니를 줄여준다.
  const iScalpY   = new Float32Array(maskW).fill(-1);
  const iHairEndY = new Float32Array(maskW).fill(-1);
  for(let x=0;x<maskW;x++){ iScalpY[x]=scalpY[x]; iHairEndY[x]=hairEndY[x]; }
  cleanupLine1D(iScalpY, {clamp:false, smooth:false}); // 보간만 = 기존과 동일
  cleanupLine1D(iHairEndY);                            // 보간+클램프+스무딩

  // curl 방향 기준으로 쓰이던 마스크 수평 중심(maskCX) 계산은 더 이상 사용되지 않아 제거됨

  // ── 컬럼별 스타일 파라미터 계산(길이 배율/색상/컬 배율/프론트 방향 바이어스) ──
  // 예전엔 이 4개 함수(lengthRatioFor/colorForSection/curlMultFor/frontDirBiasFor)가
  // 전부 이 안에 중첩 정의돼 있었음. Canvas API를 안 쓰는 순수 계산이라
  // createColumnStyleResolvers(위에서 정의)로 옮겨도 동작이 완전히 같음을 Node에서
  // 검증했음 — 세부 로직/버그수정 이력 주석은 그 함수 정의부에 그대로 남아있음.
  const { lengthRatioFor, cutLayerDeltaFor, colorForSection, curlAmtFor, waveWidthFor, textureFor, frontDirBiasFor } = createColumnStyleResolvers({
    maskW, maskH, iScalpY, sections, angle, color, avgColorsBySection, styling: stylingForRender
  });

  const { toX: toCanvasX, toY: toCanvasY } = makeImgToCanvas(fit, maskW, maskH); // 공용 좌표 매핑(중복 통합)

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

  /* 이 두 장도 <b>호출마다</b> 새로 만들고 있었다(2026-08-22). 화면 크기 그대로라
     한 장에 10MB 안팎이고, 원본 결 보기/폴백 경로가 돌 때마다 20MB가 새로 잡혔다.
     둘 다 마지막에 ctx로 합성하고 버리는 값이라 풀에서 돌려 쓴다.
     ※ 풀은 비워서 주므로(clearRect) "지난 프레임 자국"은 안 남는다 — 예전에도
       매번 새 캔버스였으니 그 점에서 동작이 같다. lineCap/lineJoin은 컨텍스트
       속성이라 매번 다시 세팅한다(풀이 상태를 되돌려 놓기 때문에 필수다). */
  const baseOffscreen = scratchCanvas('dhsBase', cw, ch);
  const baseCtx = baseOffscreen.getContext('2d');
  baseCtx.lineCap  = 'round';
  baseCtx.lineJoin = 'round';

  const extOffscreen = scratchCanvas('dhsExt', cw, ch);
  const extCtx = extOffscreen.getContext('2d');
  extCtx.lineCap  = 'round';
  extCtx.lineJoin = 'round';

  // (6차) 스타일 기록 헬퍼: 즉시 그리지 않고(섹션 스택 순서로 나중에 일괄 스트로크)
  // 레이어가 설정하는 굵기/투명도를 op에 실어 보내기 위한 현재값 추적.
  const curStyle = { width: 1, alpha: 1 };
  function setStyle(prop, val){
    if(prop === 'lineWidth') curStyle.width = val;
    else if(prop === 'globalAlpha') curStyle.alpha = val;
    else { baseCtx[prop] = val; extCtx[prop] = val; }
  }

  // traceStrand: 결방향 필드를 따라 가닥 경로 한 가닥을 생성 — 실제 로직은
  // Canvas API를 안 쓰는 순수 함수 traceStrandPath(위에서 정의)로 옮겼고,
  // 여기서는 호출 시점에 고정되는 값들(env)만 한 번 묶어서 넘겨준다.
  // (6차) maskAt 추가: 결을 따라가며 "사진의 헤어 마스크를 벗어나는 지점"을
  // 실측하기 위한 알파 샘플러(isRealHairAt — 함수 선언 호이스팅으로 참조 가능).
  // (2026-07-26) styling·가르마 투영기 제거 — 스타일링은 3D 연산자 전담.
  // 이 경로는 "사진 결 그대로" 렌더만 한다(중립 캡처 / 원본 결 보기 / 폴백).
  // flowAcc: [진단] 180° 모호성을 <b>측정된 극성</b>으로 푼 비율. 0%면 흐름장이
  // 없거나 전부 능선(애매)이라는 뜻 — 예전 동작과 같다는 신호다.
  const flowAcc = { n:0, byFlow:0 };
  const strandEnv = { hasOrientation, orientation, orientMaskW, ox, oy, STRAND_STEP_LEN, frontDirBiasFor, curlAmtFor, waveWidthFor, maskAt: isRealHairAt, flowAcc };
  function traceStrand(ix, sy_img, targetLen_img, jitterSeed, rootSec, stopAtExit){
    return traceStrandPath(ix, sy_img, targetLen_img, jitterSeed, strandEnv, rootSec, stopAtExit);
  }

  // 마스크 좌표(이미지 픽셀 기준) 점 배열 → 캔버스 좌표로 변환
  function toCanvasPts(pts){
    return pts.map(p => ({ x: toCanvasX(p.x), y: toCanvasY(p.y) }));
  }

  // 부드러운 폴리라인은 공용 strokeSmoothPolyline(top-level)로 통합 — 여기선 별칭.
  const strokePolyline = strokeSmoothPolyline;

  // ── (6차) 실측 길이 드로잉 — "실제 헤어 길이와 결을 확인하면서 그리기" ──
  // 예전 drawStrand는 "컬럼의 실루엣 세로 높이(origLen)"를 목표 길이로 썼음 —
  // 즉 실제 가닥이 결을 따라 어디서 끝나는지는 확인하지 않았다(사용자 지적).
  // 이제 각 가닥은: ① 실측 결 필드를 따라 추적하며 사진의 헤어 마스크를 벗어나는
  // 지점(maskExitIdx)을 실측 → 그 호장이 이 가닥의 "실측 중립 길이" ② 섹션 조정
  // 배율은 그 실측 길이에 곱해짐 ③ base/ext clip 분할점도 컬럼 높이가 아니라
  // 가닥별 실측 이탈점. 4~5차의 섹션 헴 캡(가정값)은 실측과 상충하므로 렌더에서
  // 제거(gySectionHemCapNy는 3D 헴라인 단계 재사용 위해 보존).
  // 즉시 그리지 않고 op로 기록 → 섹션 스택 순서로 일괄 스트로크(아래 참조).
  const drawOps = []; // {sec, cPts, splitIdx, color, width, alpha}
  let _flowCutN = 0, _strandN = 0; // [진단용] 결 불연속으로 종결된 가닥 수
  // ── (8차) 슬라이스 단위 커트 — 1패스는 실측만 수집, 확정은 슬라이스 합의 후 ──
  // 사용자 설계: "실제 커트할 때 손에 몇 가닥씩 잡아 슬라이스 단위로 자르듯,
  // 가닥 몇 개씩 모아 슬라이스 너비로." 가닥별 독립 실측(7차)은 이웃 끝이 제각각
  // 흩어져 "결이 뚝뚝 끊겨 보이고 층 느낌이 약한" 문제가 있었음 → 같은 뿌리
  // 구역(섹션×가로 슬라이스 폭×깊이 밴드)의 가닥들을 한 슬라이스로 묶고,
  // 헴(끝선)을 슬라이스 실측의 중앙값으로 합의. 구성 가닥은 자기 결 경로를
  // 그대로 따르되 끝만 헴±소폭 스태거로 정렬 — 실제 커트의 패널과 동일.
  const pendingStrands = []; // 1패스 수집: 슬라이스 합의 후 확정(아래 finalize)
  function drawStrand(startX, startY, ix, rootSec, rootNy, depthScale, strandMult, jitterSeed, strokeStyleVal){
    // 조정 배율(섹션 길이 슬라이더 — 기본값=원본이라 기본 상태선 ratio=1)
    const rawRatio = lengthRatioFor(ix, rootSec, rootNy);
    const ratio = 1 + (rawRatio - 1) * depthScale;
    const layerDelta = cutLayerDeltaFor(ix, rootSec, rootNy) * depthScale;
    // 목표가 실측보다 짧은 게 확실하면(줄이는 조정) 마스크 이탈 즉시 추적 중단(성능)
    const stopAtExit = (strandMult * ratio <= 1.0 && layerDelta <= 0);
    // ① 실측: 결 필드를 따라 추적, 마스크 이탈점 + 결 불연속(겹 끝) 기록
    const probe = traceStrand(startX, startY, maxStrandLen, jitterSeed, rootSec, stopAtExit);
    const exitIdx = (typeof probe.maskExitIdx === 'number') ? probe.maskExitIdx : probe.length - 1;
    // (7차) 실측 끝 = 마스크 이탈점과 결 불연속(겹 끝) 중 먼저 오는 쪽.
    const flowIdx = (typeof probe.flowEndIdx === 'number') ? probe.flowEndIdx : null;
    const hemIdx = Math.max(1, (flowIdx !== null) ? Math.min(exitIdx, flowIdx) : exitIdx);
    if(flowIdx !== null && flowIdx < exitIdx) _flowCutN++;
    _strandN++;
    pendingStrands.push({ probe, exitIdx, hemIdx, ix, rootSec: rootSec || 'crown', rootX: startX, rootNy,
                          ratio, layerDelta, strandMult, strokeStyleVal,
                          width: curStyle.width, alpha: curStyle.alpha });
  }

  // 슬라이스 합의 + 가닥 확정(목표 길이 계산 → 캡처/op 생성) — 레이어 4개가 모두
  // pendingStrands를 채운 뒤 1회 실행. 슬라이스 폭은 실제 커트 감각(1~2cm)의 근사.
  function finalizeStrandsWithSlices(){
    const SLICE_W = Math.max(4, maskW * 0.03);      // 가로 슬라이스 폭(마스크 폭의 3%)
    const sliceMap = {};
    pendingStrands.forEach(p=>{
      // 슬라이스 = 섹션 × 가로 폭 × 뿌리 깊이 밴드(10%) — 같은 패널에서 난 가닥들
      const key = p.rootSec + '|' + Math.floor(p.rootX / SLICE_W) + '|' + Math.floor(p.rootNy * 10);
      (sliceMap[key] = sliceMap[key] || []).push(p);
    });
    Object.values(sliceMap).forEach(members=>{
      // 헴 합의: 실측(마스크 이탈/결 불연속)의 중앙값 — 고립된 조기 종결(노이즈)이
      // 슬라이스 전체를 흔들지 않고, 진짜 겹 끝이면 다수가 동의해 헴이 됨.
      const hems = members.map(m=>m.hemIdx).sort((a,b)=>a-b);
      const hemMed = hems[Math.floor(hems.length / 2)];
      members.forEach(m=>{ m.sliceHemIdx = hemMed; });
    });
    pendingStrands.forEach(p=>{
      const hemLen = Math.max(maskH * 0.03, p.sliceHemIdx * STRAND_STEP_LEN);
      // 슬라이스가 길이의 주도권을 가지므로 가닥별 랜덤 배율은 60% 축소(질감만 남김)
      const multEff = 1 + (p.strandMult - 1) * 0.4;
      // 헴 주변 ±8% 스태거(결정적 의사난수 — 프레임 간 흔들림 방지)
      const sliceJit = 0.92 + hashFract(p.rootX * 17.23 + p.rootNy * 91.7) * 0.16;
      let targetLen;
      if(p.ratio >= 1){
        // 연장: 패널 균일 성장 — 슬라이스 전체가 같은 양(hemLen×(ratio-1))만큼 자람.
        // 예전(개별 배율×ratio 곱)은 배율 큰 소수 가닥만 유독 길어져 "낙수 가닥"이 됐음.
        // (9차) 연장 이득 1.6배 — 늘리는 쪽 변화가 약하다는 실기기 피드백. 균일
        // 성장이라 이득을 키워도 뻗침(편차 증가)이 아니라 슬라이스가 통째로 길어짐.
        targetLen = hemLen * multEff * sliceJit + hemLen * (p.ratio - 1) * 1.6 + p.layerDelta;
      } else {
        targetLen = hemLen * multEff * sliceJit * p.ratio + p.layerDelta;
      }
      const texAmt = textureFor(p.ix, p.rootSec);
      if(texAmt > 0){
        targetLen *= (1 - Math.random() * (texAmt / 100) * 0.35); // 끝단 무작위 트림
      }
      targetLen = Math.max(maskH * 0.02, Math.min(targetLen, maxStrandLen));
      const nPts = Math.max(2, Math.min(p.probe.length, Math.round(targetLen / STRAND_STEP_LEN) + 1));
      const pts = p.probe.slice(0, nPts);
      /* 이 가닥이 지나가는 자리의 <b>원본 픽셀색</b>을 뿌리→끝 순서로 읽어 둔다.
         실측이 하나도 없으면 null이라 아래 렌더가 예전처럼 단색으로 간다. */
      const pxColors = sampleStrandColors(opts.maskInf, pts, p.strokeStyleVal);
      // 완성 경로 캡처(3D 리프트 소스) — 색·뿌리 기반 섹션 포함, 2D와 정의상 일치.
      if(capturedStrands){
        capturedStrands.push({ pts, color: p.strokeStyleVal, colors: pxColors, sec: p.rootSec });
      }
      // clip 분할: 실측 마스크 이탈점까지=base(마스크 clip), 그 너머(연장분)=ext(자유)
      const splitIdx = Math.min(p.exitIdx, pts.length - 1);
      drawOps.push({ sec: p.rootSec, cPts: toCanvasPts(pts), splitIdx,
                     color: p.strokeStyleVal, colors: pxColors, width: p.width, alpha: p.alpha });
    });
  }

  // ── 실제 인식된 머리카락 마스크 안인지 검사 ──
  // 루트 확산 레이어(아래 "레이어 0")에서 두피 최상단선(scalpY)보다 더 깊은 지점에
  // 가닥 뿌리를 심을 때, 그 지점이 허공이나 피부 위가 아니라 실제 세그멘테이션이
  // 인식한 머리카락 픽셀 안인지 확인하기 위함 — 아니면 가닥이 이마 중간 등에서
  // 갑자기 시작되는 오류가 생길 수 있음.
  // 매 프레임 최초 호출 시 hairCanvas를 축소 해상도(orientMaskW/H, 이미 결방향
  // 계산용으로 만들어둔 것과 동일 크기)로 1회만 샘플링해서 캐시 — 매 가닥마다
  // 원본 해상도 getImageData를 부르지 않도록 함.
  let _hairSampleData = null, _hairSampleW = 0, _hairSampleH = 0, _hairSampleFailed = false;
  function isRealHairAt(x_img, y_img){
    if(_hairSampleData === null && !_hairSampleFailed){
      _hairSampleW = orientMaskW || Math.max(1, Math.round(maskW*0.5));
      _hairSampleH = orientMaskH || Math.max(1, Math.round(maskH*0.5));
      try{
        const sc = document.createElement('canvas');
        sc.width = _hairSampleW; sc.height = _hairSampleH;
        const sctx = sc.getContext('2d');
        sctx.drawImage(hairCanvas, 0, 0, _hairSampleW, _hairSampleH);
        _hairSampleData = sctx.getImageData(0,0,_hairSampleW,_hairSampleH).data;
      }catch(e){ _hairSampleFailed = true; }
    }
    if(!_hairSampleData) return true; // 샘플링 실패 시 항상 허용(안전 폴백 — 검증 없이 기존처럼 동작)
    const sx = Math.round((x_img/maskW) * _hairSampleW);
    const sy = Math.round((y_img/maskH) * _hairSampleH);
    if(sx<0||sx>=_hairSampleW||sy<0||sy>=_hairSampleH) return false;
    return _hairSampleData[(sy*_hairSampleW+sx)*4+3] > 40;
  }

  // 가닥 레이어 하나를 그리는 공용 헬퍼 — "굵은 섹션/중간 가닥/잔 가닥" 3개 레이어가
  // 개수·굵기·지터 폭만 다르고 구조는 동일해서(컬럼 선택 → 원본길이 계산 → 늘린 길이
  // 계산 → drawStrand 호출) 반복문 자체를 파라미터화해서 하나로 합침.
  // rootDepthFrac(옵션): 지정하면 두피 최상단선(scalpY) 대신 그보다 (hairEndY 방향으로)
  // 더 깊은 지점에서 가닥을 출발시킴 — 실제 머리처럼 여러 깊이에 뿌리를 둔 느낌을 내기
  // 위함(루트 확산 레이어 전용). 미지정 시 기존 3개 레이어와 완전히 동일하게 동작.
  // ── 레이어 공통값(2026-07-26 중복 통합) ──
  // 4개 레이어가 글자 그대로 같은 lenScale/pickCol을 각자 적어두고 있었다.
  // 값이 같으므로 한 곳에서 정의하고 참조만 한다(동작 동일).
  const PICK_RANDOM_COL = ()=> validCols[Math.floor(Math.random()*validCols.length)];
  /* (2026-08-23 정리) layerWidth — 굵기 식을 한 곳으로 모으려고 만들었다는 주석이
     달려 있었는데(2026-07-26), 정작 네 레이어는 각자 cfg.lineWidth를 받아 쓰고
     이 헬퍼를 <b>한 번도 안 불렀다</b>. 통합하려던 대상은 이미 cfg로 통합돼
     있었으니 이 줄만 남았던 것이다. */
  function drawStrandLayer(cfg){
    const {
      count, alphaMul, lineWidth, pickCol, endYFallbackRatio,
      lenMult, startXJitter, startYJitter, jitterSeedFn, tintRange, rootDepthFrac
    } = cfg;
    setStyle('globalAlpha', alpha * alphaMul);
    setStyle('lineWidth', lineWidth);
    for(let i=0; i<count; i++){
      const ix = pickCol(i);
      const sy_top = iScalpY[ix]; if(sy_top < 0) continue;
      const ey_img = iHairEndY[ix] >= 0 ? iHairEndY[ix] : sy_top + maskH*endYFallbackRatio;
      let sy_img = sy_top;
      // depthScale: 이 가닥의 시작점이 두피선(frac=0)에서 얼마나 깊이(ey_img 방향으로)
      // 파고들었는지에 따라 길이 배율(ratio)의 "1에서 벗어난 정도"를 비례 축소하는 계수.
      // 기본 1(=두피선 레이어와 동일하게 ratio 변화량 전량 반영).
      let depthScale = 1;
      if(rootDepthFrac){
        const frac = Math.max(0, Math.min(0.9, rootDepthFrac()));
        const candidateY = sy_top + (ey_img - sy_top) * frac;
        // 후보 지점이 실제 마스크 안일 때만 채택, 아니면 원래 두피선으로 안전하게 폴백
        if(frac > 0 && isRealHairAt(ix, candidateY)){
          sy_img = candidateY;
          // 루트 확산 레이어가 두피선보다 훨씬 깊은 지점에서 출발해 origLen(남은 길이)
          // 자체가 짧은데, ratio 기반으로 바뀐 지금은 origLen에 비례하므로 예전(delta
          // 절대값 방식)만큼 극단적이진 않지만, 그래도 깊이가 깊을수록 배율 변화를
          // 줄여서 두피선 근처 대비 과도하게 요동치지 않도록 유지.
          depthScale = 1 - frac * 0.3; // (4차) 겹 스택에선 깊은 뿌리=아래 겹(사이드/네이프)이 조정 주체라 감쇠를 약하게
        }
      }
      // ── 섹션 판정: "기준은 뿌리"(4차, 사용자 교정 — 미용 이론 그대로) ──
      // (6차) 길이는 여기서 계산하지 않는다: drawStrand가 결 필드를 따라 추적하며
      // 마스크 이탈점을 "실측"하고, 그 실측 길이에 섹션 조정 배율을 곱한다.
      // 4~5차의 origLen(컬럼 세로높이)/헴 캡 기반 길이 모델은 실측으로 대체·폐기.
      const rootNy = sy_img / maskH;
      const rootSec = (sections && angle) ? resolveSectionId(angle, ix/maskW, rootNy) : 'crown';
      // 레이어별 길이 배율(끝단이 층층이 어긋나는 자연스러운 스태거) — 실측 길이에 곱해짐
      const strandMult = lenMult ? lenMult() : 1;
      const startX = ix + startXJitter();
      const startY = startYJitter ? sy_img + startYJitter() : sy_img;
      const jitterSeed = jitterSeedFn(i);
      const [tMin, tRange] = tintRange;
      // 가닥 색: 실측 팔레트가 있으면(원본 모드) 실제 픽셀 색에서 하나를 뽑아
      // 미세 틴트(±6%)만 — 원본의 "어두운 다수+밝은 새치 소수" 분포 그대로.
      // 팔레트가 없으면(염색 스타일 등) 기존처럼 섹션 평균색×층별 틴트.
      // (2026-07-17) FORCED_HAIR_COLOR 활성 시 틴트 상한을 1.06으로 클램프 —
      // tintColor는 bright>1일 때 흰색을 가산 혼합하는데(검은 머리에서도
      // 하이라이트가 보이게 하려던 이전 수정), tintRange 상한(최대 1.4)이
      // #141414에 얹히면 델타 0.4×1.8 가산으로 가닥이 회백색이 돼버림
      // (실기기 스크린샷: "머리가 검정색 안나왔어" — 검정 사이 흰 가닥 다수).
      // 1.06이면 미세한 윤기만 남고 검정 유지. 어두운 쪽(tMin~1)은 그대로.
      const brightRaw = usePalette ? (0.94 + Math.random()*0.12) : (tMin + Math.random()*tRange);
      const bright = FORCED_HAIR_COLOR ? Math.min(1.06, brightRaw) : brightRaw;
      const strokeCol = usePalette
        ? tintColor(colorPalette[Math.floor(Math.random()*colorPalette.length)], bright)
        : tintColor(colorForSection(ix, rootSec), bright);
      drawStrand(startX, startY, ix, rootSec, rootNy, depthScale, strandMult, jitterSeed, strokeCol);
    }
  }

  // ── 레이어 0: 루트 확산 레이어 (110~190개) ──
  // 기존 3개 레이어는 전부 두피 최상단선(scalpY) "한 줄"에서만 출발해서, 그 줄
  // 아래로 인식된 머리 영역(hairEndY까지)이 짧은 컬럼(옆머리 아래쪽, 프로필 하단
  // 등)에서는 가닥이 금방 끝나버려 비어 보이는 문제가 있었음. 실제 머리는 두피
  // 전체에 뿌리가 흩어져 있어서 시작 높이 자체가 제각각인데, 지금까지는 "출발선"이
  // 하나뿐이라 그 아래를 다른 가닥으로 못 채우고 있었던 것.
  // → rootDepthFrac으로 두피선~모발끝 사이 임의 깊이에서 추가로 뿌리를 심어, 옆/하단처럼
  //   원래 짧게 끊기던 구간을 다른 깊이의 가닥들이 겹쳐서 메우도록 함. 다른 레이어보다
  //   먼저 그려서 그 위에 레이어 1~3이 덮이게 하고, 두께는 잔가닥과 비슷하게 얇게 유지.
  // 버그 수정: 기존 Math.sqrt(Math.random())*0.55는 주석에 "얕은 쪽에 몰리게"라 적혀
  // 있었지만 실제로는 sqrt(균등분포)라 반대로 "깊은 쪽(0.55에 가까운 값)"에 밀도가 더
  // 쏠리는 공식이었음 + 최대 깊이도 0.55로 막혀 있어 두피선~모발끝의 아래쪽 45%는
  // 애초에 뿌리를 못 심었음. 정수리(얕은 지점)만 계속 밀집되고 중간·아래는 비어
  // 보이는 원인 중 하나 → 특정 깊이에 쏠리지 않는 균등분포로 바꾸고, 최대 깊이를
  // 0.55→0.8로 넓혀서 중간·아래쪽까지 뿌리가 실제로 닿도록 함.
  // 개수 1.6배 상향: 굵기를 0.367배로 줄인 만큼(테스트 결과 "듬성듬성해짐" 확인됨)
  // 가닥 사이 빈틈을 메우기 위한 보정. 완전 보정(1/0.367≈2.7배)까지는 안 가고
  // 우선 중간 지점(1.6배)부터 테스트.
  // sub-pixel 렌더링 문제 수정: 0.22~0.51px는 1px 미만이라 브라우저가 "더 얇게"가
  // 아니라 알파를 낮춰 흐릿하게 그려버림(캔버스가 sub-pixel 굵기를 실제로 표현 못 함).
  // 1px 근처로 최소굵기를 올려서 흐려지는 걸 막고, 대신 개수를 더 늘려 밀도로 보완.
  const numRootScatter = Math.round(L_ROOT.n); // 2026-07-14 증량(460+330→×1.8): 굵기 하향 커버리지 보상 — 사용자 합의
  drawStrandLayer({
    count: numRootScatter,
    alphaMul: 1.0,
    // 705px 기준 튜닝값 → 실제 해상도(resScale)에 비례 스케일 + sub-pixel 방지 하한
    lineWidth: L_ROOT.w, // 2026-07-14 굵기 하향 → 2026-07-16 전역 STRAND_THIN 추가 하향
    pickCol: PICK_RANDOM_COL,
    endYFallbackRatio: 0.35,
    // 균등분포 → 제곱분포로 변경: 두피선(frac=0) 근처에 확률이 더 실리고 꼬리가 길게
    // 빠지는 형태(Math.pow(Math.random(),2))라, 실제 헤어라인 밀도는 유지하면서
    // 중간·아래쪽까지 여전히 뿌리가 퍼짐. 균등분포일 때 두피선 근처 밀도가 과소해져
    // "정수리가 빈다"는 오버코렉션이 발생했던 것에 대한 수정.
    rootDepthFrac: ()=> Math.pow(Math.random(), 1.1) * 0.8, // (4차) 제곱편향→준균등: 겹 스택에선 아래 겹(사이드/네이프)도 자기 뿌리로 커버해야 함
    lenMult: ()=> 0.6+Math.random()*0.4, // 랜덤 배율 분리(중립 길이 계산과 공유 — 동작 동일)
    startXJitter: ()=> (Math.random()-0.5)*maskW*0.01,
    jitterSeedFn: (i)=> i*0.271,
    tintRange: L_ROOT.tint,
  });

  // ── 레이어 1: 굵은 섹션 (38~60개) ──
  // 가닥을 불투명하게 바꾸면서 밀도를 다시 소폭 상향 (30~48 → 38~60).
  // 개수 1.6배 상향 — 위 레이어0과 동일한 이유
  const numSections = Math.round(L_SECTION.n); // 2026-07-14 증량(61+35→×1.4): 굵은 레이어는 뭉침 방지 위해 소폭만
  drawStrandLayer({
    count: numSections,
    alphaMul: 1.0, // 형태를 잡는 가장 굵은 레이어 — 완전 불투명하게 해서 밑의 살색이 안 비치게
    // 705px 기준 튜닝값 → 해상도 비례 스케일
    lineWidth: L_SECTION.w, // 2026-07-14 굵기 하향 → 2026-07-16 전역 STRAND_THIN 추가 하향
    pickCol: (i)=> validCols[Math.floor((i/numSections)*validCols.length)],
    endYFallbackRatio: 0.40,
    // 한 줄(scalpY) 제한 해제: 다른 레이어처럼 두피선~모발끝 사이에 깊이를 분산시켜서,
    // 이 레이어 전체가 정수리 한 줄에 몰려 밀도가 뭉치는 걸 방지.
    rootDepthFrac: ()=> Math.pow(Math.random(), 1.1) * 0.6, // (4차) 제곱편향→준균등(겹 스택 커버리지)
    startXJitter: ()=> (Math.random()-0.5)*(maskW/numSections)*1.5,
    jitterSeedFn: (i)=> i,
    tintRange: L_SECTION.tint,
  });

  // ── 레이어 2: 중간 가닥 (160~330개) ──
  // 개수 1.6배 상향 — 위와 동일한 이유
  const numMid = Math.round(L_MID.n); // 2026-07-14 증량(256+272→×1.8)
  drawStrandLayer({
    count: numMid,
    alphaMul: 1.0,
    // 705px 기준 튜닝값 → 해상도 비례 스케일 + sub-pixel 방지 하한
    lineWidth: L_MID.w, // 2026-07-14 굵기 하향 → 2026-07-16 전역 STRAND_THIN 추가 하향
    pickCol: PICK_RANDOM_COL,
    endYFallbackRatio: 0.38,
    rootDepthFrac: ()=> Math.pow(Math.random(), 1.1) * 0.7, // 한 줄 제한 해제, (4차) 준균등 — 겹 스택 커버리지
    lenMult: ()=> 0.85+Math.random()*0.3, // 랜덤 배율 분리(중립 길이 계산과 공유 — 동작 동일)
    startXJitter: ()=> (Math.random()-0.5)*maskW*0.008,
    jitterSeedFn: (i)=> i*0.618,
    tintRange: L_MID.tint,
  });

  // ── 레이어 3: 잔 가닥 (160~320개) ──
  // 이 레이어가 가장 밝은 하이라이트(tintRange 상단)를 담당 — 완전 불투명(alphaMul 1.0)으로
  // 그려서 하이라이트가 살색에 묻히지 않고 또렷하게 도드라짐.
  // 개수 1.6배 상향 — 위와 동일한 이유
  // sub-pixel 문제 수정 + 개수 추가 상향 — 위 레이어0과 동일한 이유.
  // 이 레이어는 하이라이트(밝은 톤) 담당이라 흐려지면 머리 전체 광택감이 죽는
  // 영향이 가장 커서 우선적으로 손봄.
  const numFine = Math.round(L_FINE.n); // 2026-07-14 증량(330+330→×1.8)
  drawStrandLayer({
    count: numFine,
    alphaMul: 1.0,
    // 705px 기준 튜닝값 → 해상도 비례 스케일 + sub-pixel 방지 하한
    lineWidth: L_FINE.w, // 2026-07-14 굵기 하향 → 2026-07-16 전역 STRAND_THIN 추가 하향
    pickCol: PICK_RANDOM_COL,
    endYFallbackRatio: 0.35,
    rootDepthFrac: ()=> Math.pow(Math.random(), 1.1) * 0.85, // 한 줄 제한 해제 — 잔가닥은 가장 넓게 분산, (4차) 준균등
    lenMult: ()=> 0.7+Math.random()*0.5, // 랜덤 배율 분리(중립 길이 계산과 공유 — 동작 동일)
    startXJitter: ()=> (Math.random()-0.5)*maskW*0.012,
    startYJitter: ()=> (Math.random()-0.5)*maskH*0.01,
    jitterSeedFn: (i)=> i*0.382,
    tintRange: L_FINE.tint,
  });

  // ── (6차) 섹션 스택 드로잉 — "세그멘테이션 통짜 페인팅" 폐지 ──
  // 사용자 지적: "세그멘테이션 전체를 처음에 그려버리잖아 — 실제랑 완전히 다르다."
  // ① 언더코트: 마스크 실루엣을 통째로 두피색으로 칠하던 것(renderFrame에서 제거)
  //    대신, "실제 가닥 경로"를 두피색 굵은 획으로 먼저 깔아 가닥 사이 빈틈만 메움
  //    — 조정으로 헤어 모양이 바뀌면 바탕도 그대로 따라간다(통짜 실루엣 잔상 없음).
  // ② 가닥 스트로크를 섹션 스택 순서(네이프→후두부→템플→사이드→프론트→크라운)로
  //    일괄 실행 — 아래 겹 위에 위 겹이 쌓이는 실제 구조. 같은 섹션 안에서는
  //    생성 순서(레이어 0→3)가 유지된다(Array.sort는 안정 정렬).
  finalizeStrandsWithSlices(); // (8차) 슬라이스 합의 → drawOps/캡처 확정

  const SECTION_STACK = { nape:0, occipital:1, temple:2, side:3, front:4, crown:5 };
  drawOps.sort((a,b)=> (SECTION_STACK[a.sec] ?? 2) - (SECTION_STACK[b.sec] ?? 2));
  function strokeOp(op, color, widthMul, baseOnly){
    const bPts = op.cPts.slice(0, op.splitIdx + 1);
    baseCtx.strokeStyle = color; baseCtx.lineWidth = op.width * widthMul; baseCtx.globalAlpha = op.alpha;
    strokePolyline(baseCtx, bPts);
    if(!baseOnly && op.splitIdx < op.cPts.length - 1){
      extCtx.strokeStyle = color; extCtx.lineWidth = op.width * widthMul; extCtx.globalAlpha = op.alpha;
      strokePolyline(extCtx, op.cPts.slice(op.splitIdx)); // 분할점 공유로 선이 안 끊기게
    }
  }
  /* 가닥 하나를 조각으로 나눠 <b>조각마다 다른 색</b>으로 긋는다.
     캔버스는 선 하나에 색이 하나뿐이라 이 방법 말고는 한 가닥 안에서 색을 못 바꾼다.
     ⚠ 조각은 <b>끝점을 공유</b>해야 한다(end = 다음 조각의 start). 공유를 안 하면
       조각 사이에 1px 틈이 생겨 가닥이 점선처럼 끊긴다.
     base/ext 분할은 기존과 같은 규칙을 그대로 따른다 — 마스크 클립 경계가 색 때문에
     달라지면 "세그멘테이션 밖에는 안 그린다"가 깨진다. */
  function strokeOpColored(op, widthMul){
    const n = op.cPts.length;
    const K = op.colors.length;
    for(let k=0; k<K; k++){
      const i0 = Math.round(k     * (n-1) / K);
      const i1 = Math.round((k+1) * (n-1) / K);
      if(i1 <= i0) continue;
      const seg = op.cPts.slice(i0, i1 + 1);          // 끝점 공유
      const col = op.colors[k];
      // 조각이 분할점을 걸치면 양쪽에 나눠 긋는다(경계에서 잘려 사라지지 않게)
      if(i1 <= op.splitIdx){
        baseCtx.strokeStyle = col; baseCtx.lineWidth = op.width*widthMul; baseCtx.globalAlpha = op.alpha;
        strokePolyline(baseCtx, seg);
      } else if(i0 >= op.splitIdx){
        extCtx.strokeStyle = col; extCtx.lineWidth = op.width*widthMul; extCtx.globalAlpha = op.alpha;
        strokePolyline(extCtx, seg);
      } else {
        const cut = op.splitIdx - i0;
        baseCtx.strokeStyle = col; baseCtx.lineWidth = op.width*widthMul; baseCtx.globalAlpha = op.alpha;
        strokePolyline(baseCtx, seg.slice(0, cut + 1));
        extCtx.strokeStyle = col; extCtx.lineWidth = op.width*widthMul; extCtx.globalAlpha = op.alpha;
        strokePolyline(extCtx, seg.slice(cut));
      }
    }
  }
  const scalpUnderCol = opts.scalpColor || 'rgb(224,178,148)';
  // 언더코트는 base(마스크 안)만 — 연장 구간까지 두피색 굵은 획을 깔면
  // 얼굴/배경 위에 살구톤 밑줄이 비쳐 보임(8차, 실기기 스크린샷 대응).
  drawOps.forEach(op => strokeOp(op, scalpUnderCol, 2.2, true)); // 언더코트 패스(가닥 추종 바탕)
  // 실제 가닥 패스(섹션 스택 순서). 실측 색이 있으면 조각별로, 없으면 예전처럼 단색.
  // 언더코트는 두피색 한 가지라 조각낼 이유가 없다 — stroke 횟수를 괜히 늘리지 않는다.
  drawOps.forEach(op => op.colors ? strokeOpColored(op, 1) : strokeOp(op, op.color, 1, false));

  // [진단용] 결 불연속 종결 비율 — 겹층 커트면 두 자릿수 %가 정상, 긴 생머리면 낮아야 함.
  // 매 렌더 랜덤으로 숫자가 흔들리므로 10% 버킷이 바뀔 때만 출력(스팸 방지).
  if(angle && _strandN > 0){
    const pct = Math.round(_flowCutN / _strandN * 100);
    window._lastDiscLog = window._lastDiscLog || {};
    // (8차) 각도당 최초 1회만 출력 — 버킷 방식(round→floor)은 어떤 경계값이든
    // 렌더마다 난수로 값이 튀면 뚫림(실기기에서 19↔20% 진동으로 40회 반복 확인).
    // 비율은 렌더 간 거의 안 변하므로 1회면 충분, 추가 확인은 DIAG_VERBOSE로.
    if(!(angle in window._lastDiscLog) || window.DIAG_VERBOSE){
      window._lastDiscLog[angle] = true;
      console.log('[진단·결단] '+angle+' 가닥 '+_strandN+'개 중 결불연속(겹 끝) 종결 '+_flowCutN+'개('+pct+'%)'
        + ' · 극성 판정 '+(flowAcc.n ? Math.round(flowAcc.byFlow/flowAcc.n*100) : 0)+'% 측정('
        + flowAcc.byFlow+'/'+flowAcc.n+') 나머지 연속성');
    }
    // 콘솔 없이도 화면 진단창에서 볼 수 있게 보관
    window._lastDisc = window._lastDisc || {};
    window._lastDisc[angle] = { n:_strandN, cut:_flowCutN, pct };
  }

  // ── 2단계 합성 ──
  // [1] base: 실측 이탈점 이내 구간 → hairCanvas(실제 세그멘테이션 마스크)로 destination-in
  //     clip을 걸어서, 인식된 머리카락 영역 밖(얼굴·안경·배경)으로는 절대 안 나가게 함.
  // [2] ext: 실측 이탈점을 넘겨 슬라이더로 늘어난 구간 → clip 없이 그대로.
  //     (짧게 줄인 경우엔 애초에 ext 구간 자체가 안 그려지므로 자연히 문제 없음)
  /* ── 클립 마스크: 팽창(dilate) → <b>닫기(close)</b> (2026-08-01) ────────────
     원래 의도: "이마 중앙 notch 같은 국소 인식 실패 구간"을 메우는 것. 방법은
     블러 후 낮은 문턱으로 다시 하드 마스크화 — 이건 형태학의 <b>팽창</b>이고,
     구멍만 메우는 게 아니라 <b>바깥 경계도 같이 밀어낸다</b>.

     실측(Chromium, 1200px 캔버스, 현행 값 blur 18px·문턱 25):
       경계 x=599 → <b>622</b>   ... 마스크 바깥 23px까지 머리카락을 칠할 수 있었다.
     사용자 지적("원본 결 보기에서도 세그멘테이션을 침범한 가닥들이 있다")의
     원인 중 하나가 정확히 이것이다. 세그멘테이션은 잘 잡혔는데 <b>클립이 헐거웠다</b>.

     고침: 팽창 다음에 같은 반경으로 <b>침식</b>을 한 번 더 건다(= 닫기 연산).
     구멍은 팽창 단계에서 이미 메워져 되돌아오지 않고, 바깥 경계만 제자리로 온다.
       원본 599 → 닫기 후 <b>599</b> · 노치 메움 ✓ · 구멍 메움 ✓ · 바깥 615px 투명 ✓
     비용은 블러+문턱 패스 한 번(렌더당 1회).

     ── 이 팽창이 화면에서 <b>얼마나</b> 컸는가 (2026-08-01 2차 실측) ──
     사용자: "원본 결 보기에서 두상부분이 다 없어지네?" 놀랄 만한 변화라 정면
     헤어 마스크 근사(두상 타원 − 얼굴 타원)로 다시 쟀다:
       팽창 후 면적 = 원본의 <b>1.46배</b> · 닫기 후 0.99배 · 아래 합집합 1.01배
     즉 예전 클립은 마스크 면적의 <b>46%</b>를 덤으로 칠하고 있었다. 이마 위처럼
     <b>얇은 띠</b>에서는 양쪽 23px가 띠 두께에 맞먹어서, 그 덤이 사라지면
     "가득 찼다 → 비었다"로 보인다. 중요한 건 <b>마스크 안쪽 잉크는 두 방식이 똑같다</b>는
     점이다(둘 다 원본 마스크의 상위집합이라 안쪽을 깎지 않는다). 그러니 지금 비어
     보이는 크라운은 원래도 마스크 <b>안</b>에는 그만큼밖에 안 그려지고 있었고,
     예전엔 마스크 <b>밖</b> 23px 후광이 그걸 가려 주고 있었던 것이다.
     → 후광을 되살리는 건 "세그멘테이션 밖에는 안 그린다"는 방향과 정면으로 어긋난다.
       크라운이 자기 마스크 안에서 제대로 그려지게 하는 게 진짜 고칠 거리다(별건).

     안전장치: 가우시안 블러+문턱은 <b>진짜</b> 형태학 연산이 아니라 근사라,
     아주 얇은 구조에서는 침식이 과할 수 있다. 형태학의 닫기는 정의상 원본을
     항상 포함하므로(A ⊆ close(A)) 마지막에 <b>원본 마스크와 합집합</b>을 취해
     그 성질을 강제한다 — 이러면 이 코드가 마스크 안쪽을 잃는 일은 원리적으로 없다. */
  const HAIR_CLIP = (window.HAIR_CLIP = window.HAIR_CLIP || {
    close:   true,   // false면 예전 동작(팽창만, 면적 1.46배) — A/B 확인용
    gapFrac: 0.015,  // 메울 구멍의 크기(캔버스 폭 대비) — 예전 팽창 반경과 동일
    loThr:   25,     // 팽창 문턱(낮을수록 크게 부풂)
    hiThr:   230,    // 침식 문턱 — 255-loThr이면 팽창량과 정확히 상쇄(대칭 닫기)
    /* 클립을 <b>의도적으로</b> 조금 넉넉하게 하고 싶을 때의 여유(캔버스 폭 대비).
       0 = 세그멘테이션 그대로. 예전 동작이 사실상 0.019였다(23/1200).
       올리면 커버리지가 늘고 침범도 같이 는다 — 모르고 23px을 쓰던 것과 달리
       여기서는 <b>알고</b> 고르는 값이다. 0.004면 약 5px. */
    growFrac: 0,
  });
  /* 여기도 호출마다 화면 크기 캔버스를 새로 잡았다(2026-08-22). 한 번의
     compositeLayers에서 2~3장이다. 풀을 쓰되 <b>호출 순서마다 다른 키</b>를 준다 —
     두 번째 패스가 첫 번째 결과를 <b>읽으면서</b> 쓰기 때문에 같은 키를 주면
     자기 입력을 지운다. (이걸 놓치면 클립이 조용히 망가진다.) */
  let _thrN = 0;
  function thresholdPass(srcCanvas, blurPx, thr, drawFit){
    const c = scratchCanvas('dhsThr' + (_thrN++), cw, ch);
    const x = c.getContext('2d');
    x.filter = `blur(${blurPx}px)`;
    if(drawFit) x.drawImage(srcCanvas, fit.dx, fit.dy, fit.dw, fit.dh);
    else x.drawImage(srcCanvas, 0, 0);
    x.filter = 'none';
    const d = x.getImageData(0,0,cw,ch);
    for(let i=3;i<d.data.length;i+=4) d.data[i] = d.data[i] > thr ? 255 : 0;
    x.putImageData(d,0,0);
    return c;
  }
  let _strictMaskCache = null;
  function strictMaskCanvas(){   // 팽창 없는 진짜 세그멘테이션(진단·비교용)
    if(_strictMaskCache) return _strictMaskCache;
    const c = scratchCanvas('dhsStrict', cw, ch);   // 위 패스들과 <b>다른</b> 키
    c.getContext('2d').drawImage(hairCanvas, fit.dx, fit.dy, fit.dw, fit.dh);
    return (_strictMaskCache = c);
  }
  function compositeLayers(){
    const blurPx = Math.max(3, fit.dw * HAIR_CLIP.gapFrac);
    const dilated = thresholdPass(hairCanvas, blurPx, HAIR_CLIP.loThr, true);
    let maskAlpha = HAIR_CLIP.close
      ? thresholdPass(dilated, blurPx, HAIR_CLIP.hiThr, false)   // 닫기(팽창→침식)
      : dilated;                                                 // 예전 동작(팽창만)
    if(HAIR_CLIP.close){
      // 닫기는 정의상 원본을 포함해야 한다 — 근사 오차로 얇은 데가 깎이는 일이 없도록 강제
      const ux = maskAlpha.getContext('2d');
      ux.drawImage(strictMaskCanvas(), 0, 0);
      // 의도적 여유(기본 0). 0이면 아무 일도 안 한다.
      if(HAIR_CLIP.growFrac > 0){
        maskAlpha = thresholdPass(maskAlpha, Math.max(1, fit.dw * HAIR_CLIP.growFrac), HAIR_CLIP.loThr, false);
      }
    }

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
  measureMaskLeak(baseOffscreen, extOffscreen, strictMaskCanvas(), cw, ch, angle);

  // (옮기기 1단계) 이 각도의 최신 완성 경로를 저장 — 슬라이더 조정 등으로
  // 다시 그릴 때마다 덮어써서 항상 "지금 화면에 보이는 그 가닥들"이 유지됨.
  if(capturedStrands && angle){
    state.strandPaths = state.strandPaths || {};
    state.strandPaths[angle] = { strands: capturedStrands, maskW, maskH };
  }
}
/* ── [진단] 마스크 밖으로 새어나간 잉크 측정 (2026-08-01) ─────────────────
   "세그멘테이션을 침범했다"는 눈으로만 판단하던 것을 숫자로 바꾼다. 그리지 않으면
   개선했는지 나빠졌는지 매번 실기기 스크린샷을 봐야 하고, 그러면 문턱을 짐작으로
   흔들게 된다.

   재는 방법: 완성된 두 레이어(base=클립됨, ext=자유)의 잉크 픽셀 중 <b>팽창 없는
   진짜 세그멘테이션</b> 밖에 있는 비율. 전체 해상도로 재면 getImageData가 무거워서
   가로 320px로 줄여서 잰다(비율이라 축소해도 값이 거의 같다).

   해석:
     · base 누출 — 클립 마스크가 헐거움(닫기 연산 이전엔 여기가 컸다)
     · ext  누출 — 가닥 경로 자체가 마스크를 넘어감. 중립 상태에서 0이어야 정상이고,
       길이를 늘리면 당연히 올라간다(일부러 사진보다 길게 만드는 것이므로).      */
/* ══════════════════════════════════════════════════════════════════
   헤어 레이어 클립 — "세그멘테이션 밖에는 안 그린다" (2026-08-01)
   ─────────────────────────────────────────────────────────────────
   비교자(①)가 결정을 내려줬다. 네 뷰 전부 <b>마스크 채움 98~100%</b>인데
   <b>밖으로 샘 9~49%</b>다. 즉 안 그려서 생긴 문제가 아니라 넘쳐서 생긴 문제고,
   그러면 클립이 정답이다. (채움이 낮았다면 클립은 독이었다 — 안 그려진 곳을
   더 지우는 꼴이니까. 그래서 ①을 먼저 한 것이다.)

   레이어에 거는 이유: 예전엔 2D의 base에만 destination-in이 걸려 있었고
   ext(연장층)와 3D 경로 둘(이식·가닥투영)은 클립이 아예 없었다. 세 경로를 각각
   고치는 대신 헤어 레이어 하나에 걸면 전부 한 번에 덮인다.

   ── 늘린 머리는 나가는 게 맞다 ──────────────────────────────────
   길이를 키우면 원본 마스크 밖으로 나가는 게 <b>정상</b>이다. 그래서 조정된
   길이 비율만큼 클립 마스크를 키운다. 중립(ratio=1)이면 여유 0 = 마스크 그대로.
   이 구분을 안 하면 컬·길이가 다시 죽는다(예전에 한 번 겪었다).       */
const HAIR_LAYER_CLIP = {
  on: true,          // false면 예전 동작(3D 경로 클립 없음) — A/B용
  gapFrac: 0.015,    // 구멍 메우기 반경(캔버스 폭 대비) — 2D 클립과 같은 값
  loThr: 25, hiThr: 230,
  growPerRatio: 0.5, // (길이비율-1) × 캔버스 높이 × 이 값 만큼 클립을 키운다
};
/* ── 이 마스크가 <b>프레임마다</b> 처음부터 다시 만들어지고 있었다 (2026-08-22) ──
   한 번 부를 때 화면 크기(예: 1080×1400) 캔버스를 2~3장 새로 잡고, 그 위에
   블러를 두 번 걸고, getImageData·putImageData로 150만 픽셀을 두 번 훑는다.
   폰에서 캔버스 블러는 특히 비싸다. 그런데 이 마스크는 <b>같은 뷰·같은 여유</b>면
   결과가 같다 — 슬라이더를 안 건드리고 뷰만 다시 그리는 프레임에서는 통째로
   같은 그림을 다시 만들고 있었던 셈이다.
   두 가지를 건다(둘 다 결과 그림은 동일):
     ① 중간 캔버스를 풀에서 재사용 — 장당 10MB짜리 신규 할당이 사라진다
     ② 서명(뷰·크기·프레이밍·여유·마스크 세대)이 같으면 지난 결과를 그대로 준다
   ②의 결과 캔버스는 <b>풀과 별도로</b> 들고 있어야 한다. 풀에 두면 다음 호출의
   중간 단계가 덮어쓴다 — 캐시가 캐시를 깨는 모양이 된다.
   되돌리기: CLIP_MASK_CACHE.on = false */
const CLIP_MASK_CACHE = { on: true, sig: '', canvas: null, hits: 0, misses: 0 };
function buildHairClipMask(hairCanvas, fit, cw, ch, growPx, angle){
  const _sig = CLIP_MASK_CACHE.on
    ? [angle||'-', cw, ch, Math.round(fit.dx), Math.round(fit.dy),
       Math.round(fit.dw), Math.round(fit.dh), Math.round(growPx*4),
       hairCanvas.width, hairCanvas.height, canvasGid(hairCanvas),
       /* 클립 상수도 서명에 넣는다 — 콘솔에서 이 값을 만져 놓고 "안 바뀐다"고
          헤매는 일이 없도록. 값이 안 변하면 문자열도 안 변하니 비용은 0이다. */
       HAIR_LAYER_CLIP.gapFrac, HAIR_LAYER_CLIP.loThr,
       HAIR_LAYER_CLIP.hiThr, HAIR_LAYER_CLIP.on ? 1 : 0].join(',')
    : null;
  if(_sig && _sig === CLIP_MASK_CACHE.sig && CLIP_MASK_CACHE.canvas
     && CLIP_MASK_CACHE.canvas.width === cw && CLIP_MASK_CACHE.canvas.height === ch){
    CLIP_MASK_CACHE.hits++;
    return CLIP_MASK_CACHE.canvas;
  }
  if(_sig) CLIP_MASK_CACHE.misses++;
  let _passN = 0;
  const pass = (src, blurPx, thr, drawFit)=>{
    const c = scratchCanvas('clipPass' + (_passN++), cw, ch);
    const x = c.getContext('2d', { willReadFrequently:true });
    x.filter = `blur(${blurPx}px)`;
    if(drawFit) x.drawImage(src, fit.dx, fit.dy, fit.dw, fit.dh); else x.drawImage(src, 0, 0);
    x.filter = 'none';
    const d = x.getImageData(0,0,cw,ch);
    for(let i=3;i<d.data.length;i+=4) d.data[i] = d.data[i] > thr ? 255 : 0;
    x.putImageData(d,0,0); return c;
  };
  const _keep = (out)=>{
    if(!_sig) return out;
    let k = CLIP_MASK_CACHE.canvas;
    if(!k){ k = CLIP_MASK_CACHE.canvas = document.createElement('canvas'); CANVAS_POOL.made++; }
    if(k.width !== cw || k.height !== ch){ k.width = cw; k.height = ch; }
    const kx = k.getContext('2d');
    kx.setTransform(1,0,0,1,0,0); kx.globalCompositeOperation = 'source-over';
    kx.clearRect(0,0,cw,ch); kx.drawImage(out, 0, 0);
    CLIP_MASK_CACHE.sig = _sig;
    return k;
  };
  const C = HAIR_LAYER_CLIP;
  const r = Math.max(3, fit.dw * C.gapFrac);
  const dil = pass(hairCanvas, r, C.loThr, true);
  const closed = pass(dil, r, C.hiThr, false);
  // 닫기는 정의상 원본을 포함해야 한다 — 근사 오차로 얇은 데가 깎이지 않게 합집합
  closed.getContext('2d').drawImage(hairCanvas, fit.dx, fit.dy, fit.dw, fit.dh);
  if(growPx <= 0.5) return _keep(closed);
  const grown = pass(closed, growPx, C.loThr, false);
  /* ── 늘림 여유는 얼굴 위로 안 간다 (2026-08-01) ────────────────────────
     3D 재클립과 <b>같은</b> 타원(getViewFaceEllipse)을 쓴다. 두 경로가 다른
     얼굴을 보면 화면과 3D가 또 어긋난다.
     지우고 나서 closed를 다시 얹는 순서인 이유: 여유 <b>없을 때</b>의 클립
     (=사용자가 "잘 잡아놨다"고 한 그 동작)을 반드시 포함해야 한다. 뺨 옆에
     실제로 있던 머리는 closed 안에 있으므로 그대로 살아난다. */
  /* ── 문턱 ③-b — 앞머리는 <b>얼굴 위로 오는 게 정의</b>다 (2026-09-02 3차) ────
     아래 destination-out은 "늘림 여유가 얼굴을 덮지 않게" 하는 장치인데,
     내려 심은 앞머리에는 그게 그대로 <b>이마를 지우는 규칙</b>이 된다.
     그래서 앞머리가 실제로 심긴 모델에서만 이 한 줄을 건너뛴다. 앞머리가
     없는 모델(손님에게 이미 있음·촬영 가닥 모델)에서는 예전 그대로다.
     ⚠ 여는 대가: 이 뷰에서 얼굴 위 여유가 통째로 열린다. 그래도 3D 쪽
       faceVeto는 <b>fringe가 아닌 가닥에는 그대로</b> 걸려 있으므로, 얼굴을
       가로지를 수 있는 가닥은 앞머리로 심은 것뿐이다. */
  const fe = (angle && !mqFringeActive()) ? getViewFaceEllipse(angle) : null;
  if(fe){
    const g = grown.getContext('2d');
    g.save();
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = '#000';
    g.beginPath();
    g.ellipse(fit.dx + fe.cx*fit.dw, fit.dy + fe.cy*fit.dh,
              fe.rx*fit.dw, fe.ry*fit.dh, 0, 0, Math.PI*2);
    g.fill();
    g.restore();
    g.drawImage(closed, 0, 0);       // 여유 없을 때의 클립은 무조건 포함
  }
  return _keep(grown);
}
/* 조정으로 <b>늘린</b> 만큼의 여유(px). 중립이면 0. */
/* 빗질이 마스크 밖으로 밀어낸 최대 거리를 캔버스 px로. 변위장의 최대 크기를
   그대로 쓰므로(COMB.maxDisp) "빗은 만큼"이 정확히 여유가 된다.
   상한은 캔버스 폭의 25% — 실수로 화면 끝까지 끈 한 획이 클립을 통째로
   무력화하지 않도록 하는 안전선(넘으면 그 이상은 클립이 잡는다). */
function combClipGrowPx(fit, angle, rawMode){
  if(rawMode || !COMB.maxDisp) return 0;
  const m = state.hair3Dneutral, cal = m && m.viewCal && m.viewCal[angle];
  const mi = state.hairMasks && state.hairMasks[angle];
  if(!cal || !mi || !(cal.s > 0) || !(mi.w > 0)) return 0;
  const px = (COMB.maxDisp / cal.s) * (fit.dw / mi.w);   // 모델 → 원본px → 캔버스px
  return Math.max(0, Math.min(px, fit.dw * 0.25));
}
function hairClipGrowPx(fit, rawMode){
  if(rawMode) return 0;
  let maxRatio = 1;
  try{
    for(const id in (state.sections||{})){
      const r = sectionLengthRatio(id, state.sections[id].length);
      if(isFinite(r) && r > maxRatio) maxRatio = r;
    }
  }catch(e){}
  return Math.max(0, (maxRatio - 1)) * fit.dh * HAIR_LAYER_CLIP.growPerRatio;
}
/* 마네킹 시술 중의 여유(px) — 3D 재클립의 fringeFrac과 <b>같은 거리</b>를 화면
   px로 환산한다 (2026-08-09). 두 클립이 다른 폭을 열면 3D에서 살아남은 앞머리가
   화면에서 다시 지워져 아무것도 안 바뀐 것처럼 보인다.
   환산은 combClipGrowPx와 같은 경로(모델 → 원본px → 캔버스px)를 쓴다. */
/* 이 모델에 <b>내려 심은 앞머리</b>가 실제로 들어 있는가 (2026-09-02 3차).
   플래그가 아니라 가닥을 세서 본다 — MQ_FRINGE.on을 켜 놨어도 손님에게 이미
   앞머리가 있으면 한 가닥도 안 심었고, 그때는 클립을 열 이유가 없다.
   ("화면 라벨은 상태가 아니다" — 2026-09-01 4차와 같은 규칙.) */
function mqFringeActive(){
  const m = state.hair3Dneutral;
  if(!MQ_FRINGE.on || !m || !m.mannequin || !m.strands) return false;
  if(m._fringeN === undefined){
    let n = 0; for(const s of m.strands){ if(s.fringe){ n++; if(n > 8) break; } }
    m._fringeN = n;
  }
  return m._fringeN > 0;
}
function mannequinClipGrowPx(fit, angle, rawMode){
  if(rawMode) return 0;
  const m = state.hair3Dneutral;
  if(!m || !m.mannequin) return 0;
  const cal = m.viewCal && m.viewCal[angle];
  const mi = state.hairMasks && state.hairMasks[angle];
  if(!cal || !mi || !(cal.s > 0) || !(mi.w > 0)) return 0;
  let b = 0; try{ b = getHeadEllipsoid().b || 0; }catch(e){ return 0; }
  /* ── 문턱 ③ — 여유는 <b>앞머리가 내려온 만큼</b>이다 (2026-09-02 3차) ──────
     예전엔 fringeFrac 하나로 정했다. 이제 앞머리 끝 높이를 실제로 정해 놓고
     심으므로(mqFringeTipY), 여유도 그 <b>실제 낙차</b>에서 나와야 한다 —
     3D에서 살아남은 앞머리가 화면에서 다시 지워지는 것을 막는 것이 이 함수의
     원래 목적이고(위 배너), 두 값이 갈리면 정확히 그 사고가 난다. */
  let mesh = 2 * b * HAIR_OCC3D.fringeFrac;
  if(mqFringeActive()){
    const CY = (m.CY != null) ? m.CY : SCALP_CENTER_Y;
    const tipY = mqFringeTipY(CY);
    if(tipY != null) mesh = Math.max(mesh, (CY + 0.18 * b) - tipY);
  }
  if(!(mesh > 0)) return 0;
  const px = (mesh / cal.s) * (fit.dw / mi.w);
  return Math.max(0, Math.min(px, fit.dw * 0.25));
}
function applyHairLayerClip(layer, hairCanvas, fit, cw, ch, rawMode, angle){
  if(!HAIR_LAYER_CLIP.on || !hairCanvas) return 0;
  /* (#5 수정, 2026-08-08) 처음엔 빗질이 있으면 클립을 <b>통째로 껐다</b>.
     그러면 빗질이 안 지워지긴 하는데, 클립이 하던 일 전부가 같이 사라져서
     가닥이 얼굴 위로 마구 그려진다(사용자 실기기: 시술모드 켜고 클릭 한 번에
     머리가 얼굴을 덮는 성긴 실타래가 됨). 클립은 "마스크 밖 금지" 하나가
     아니라 렌더 모양을 잡아 주는 장치다 — 끄는 게 아니라 <b>빗질한 만큼만
     넓힌다</b>. 길이를 늘렸을 때 growPerRatio로 여유를 주는 것과 같은 처리다. */
  /* 길이 여유와 시술 여유는 <b>큰 쪽</b>(같은 "밖으로 나갈 권리"라 더하면 이중),
     빗질 여유는 <b>더한다</b>(가닥을 물리적으로 더 밀어낸 별개의 변위). */
  const grow = Math.max(hairClipGrowPx(fit, rawMode), mannequinClipGrowPx(fit, angle, rawMode))
             + combClipGrowPx(fit, angle, rawMode);
  const mask = buildHairClipMask(hairCanvas, fit, cw, ch, grow, rawMode ? null : angle);
  const x = layer.getContext('2d');
  x.save();
  x.globalCompositeOperation = 'destination-in';
  x.drawImage(mask, 0, 0);
  x.restore();
  return grow;
}

/* 화면에 실제로 보이는 폭. 헤어를 오프스크린 <b>레이어</b>에 그리게 되면서
   getBoundingClientRect()가 0을 돌려주는 경우가 생겼다(DOM에 없는 캔버스).
   그대로 두면 다발 폭 역산의 pxRatio가 3 → 1로 바뀌어 렌더가 통째로 달라진다.
   레이어에는 원본 캔버스를 _sizeRef로 물려서 같은 값을 보게 한다. */
function displayWidthOf(canvas){
  const ref = (canvas && canvas._sizeRef) || canvas;
  try{ return ref.getBoundingClientRect().width || ref.width; }catch(e){ return canvas.width; }
}

/* ══════════════════════════════════════════════════════════════════
   렌더 ↔ 원본 사진 비교자 (2026-08-01)
   ─────────────────────────────────────────────────────────────────
   사용자: "세그멘테이션에서 제외하는 것과, 원본 결이 나오면 일단 원본사진헤어와
   맞춰서 비교하는 게 나을까"

   비교가 먼저다. 이번 세션이 그걸 반복해서 증명했다 — <b>잰 것</b>은 전부 바로
   범인을 찍었고(팽창 23px, 두께 0~3mm, 법선 오차 34°), <b>짐작한 것</b>은 두 번 다
   틀렸다(귀 랜드마크, 뿌리 램프). 그런데 정작 제일 중요한 질문 "렌더된 결이
   사진의 결과 같은가"는 한 번도 직접 안 쟀다. 3D 필드의 coherence(0.786)는
   "네 뷰가 서로 동의하나"이지 "사진과 같나"가 아니다.

   그리고 클립을 먼저 걸면 안 되는 이유가 있다. [진단·침범]이 말하는 마스크 밖
   잉크는 대부분 <b>연장층</b>이다(front 767px 중 클립층 37px). 경로가 틀려서
   나가는 것이지 그리기가 헐거워서가 아니다. 클립만 걸면 그 21%가 사라져서
   <b>틀린 이유로 맞아 보이게</b> 되고, 스타일링으로 길이를 늘리는 순간 같은
   틀림이 그대로 돌아온다(그때는 클립을 걸 수도 없다 — 길게 자른 머리는 원본
   마스크 밖으로 나가는 게 맞으니까).

   재는 것 세 가지(뷰당):
     ① 실루엣 IoU — 그린 헤어 ∩ 마스크 / ∪. 밖으로 샌 것과 <b>안 그린 곳</b>
        (정수리!)이 한 숫자에 같이 잡힌다.
     ② 결 일치 — 렌더 결과에 <b>같은 구조텐서</b>를 돌려서 나온 각도를, 사진에서
        뽑아 둔 결 필드와 비교. 양쪽 coherence를 곱해 가중 평균 각오차.
        사진과 렌더에 완전히 같은 자를 대는 것이라 사과 대 사과다.
     ③ 밀도 — 단계별 격자 지도(measureStageDensity)로 분리
   전부 320px로 줄여서 잰다(비율이라 축소해도 값이 거의 같고, 렌더당 1회).
══════════════════════════════════════════════════════════════════ */
/* fillBlur/fillThr: 실루엣을 재려면 가닥을 <b>영역</b>으로 메워야 한다.
   헤어는 설계상 틈이 있는 가는 선이라(다발 폭 3.6px, 틈 0.5px) 픽셀 IoU를 그대로
   재면 실루엣 일치가 아니라 <b>선 밀도</b>가 나온다 — 하네스에서 렌더가 마스크를
   정확히 덮었는데도 IoU 0.125가 나왔다. 알파를 살짝 번지게 한 뒤 문턱을 걸어
   "머리카락이 있는 구역"으로 바꿔서 잰다. 밀도는 아래 3×3에서 따로 본다. */
/* ══════════════════════════════════════════════════════════════════
   단계별 밀도 지도 — "어느 단계에서 사라지는가" (2026-08-01)
   ─────────────────────────────────────────────────────────────────
   사용자: "비는 곳을 알면 채우는 방식이라는 거지?" → 아니다. 채우면 증상만
   사라진다(클립 팽창 23px이 정확히 그 실수였고, 몇 주를 먹었다).
   지도의 목적은 <b>원인을 가르는 것</b>이고, 비는 데는 두 종류다:
     A. 3D 모델에 가닥이 애초에 없다  → 뿌리를 심는 게 맞다(진짜 채우기)
     B. 가닥은 있는데 화면까지 못 온다 → 채우면 안 된다. 배선(컬링·솎기·띠 폴백)을 고쳐야 한다
   이걸 가르려면 <b>같은 격자</b>로 파이프라인 세 지점을 재야 한다:
     ① 캡처   — state.neutralStrandPaths(3D의 원료. 원본 결 보기와 같은 계산)
     ② 3D     — state.hair3Dneutral의 월드 가닥을 이 뷰로 되쏜 것
     ③ 화면   — 실제로 그려진 잉크
   ①이 비면 A, ①은 찼는데 ③이 비면 B. 사이(②)에서 빠지면 리프트가 범인이다.

   값은 <b>90퍼센타일 기준 지수</b>다(제일 진한 축 = 100). 절대 개수는 단계마다 단위가
   달라서(점 개수 vs 픽셀) 비교가 안 되지만, 지수로 만들면 <b>모양</b>이 비교된다.
══════════════════════════════════════════════════════════════════ */
const DENSITY_MAP = { on: true, G: 5 };   // G×G 격자(마스크 바운딩박스 기준)
function _densGrid(G){ return { cnt:new Float64Array(G*G), area:new Float64Array(G*G) }; }
/* 칸마다 (개수 ÷ 마스크 면적)을 구한 뒤 <b>90퍼센타일</b>을 100으로 잡아 지수화.
   ※ 처음엔 중앙값 기준이었는데 하네스에서 무너졌다 — 빈 칸이 절반을 넘으면
     중앙값이 0이 되고, 0으로 나눌 수 없으니 <b>전 칸이 0</b>으로 찍혔다.
     "오른쪽 절반이 비었다"를 재려고 만든 지도가 정확히 그 상황에서 눈이 머는
     꼴이었다. 90퍼센타일은 빈 칸이 많아도 안 무너지고, 이상치 한 칸에도
     최댓값 기준만큼 휘둘리지 않는다. */
function _densIndex(g, G){
  const v = new Array(G*G).fill(-1), vals=[];
  for(let i=0;i<G*G;i++){ if(g.area[i] > 0){ const d = g.cnt[i]/g.area[i]; v[i]=d; vals.push(d); } }
  vals.sort((a,b)=>a-b);
  const ref = vals.length ? vals[Math.min(vals.length-1, Math.floor(vals.length*0.9))] : 0;
  return v.map(d => d < 0 ? null : (ref > 1e-12 ? Math.round(d/ref*100) : 0));
}
function _densRow(idx, G){
  const rows=[];
  for(let r=0;r<G;r++){
    rows.push(Array.from({length:G}, (_,c)=>{
      const v = idx[r*G+c];
      return v===null ? '  ·' : String(Math.min(999,v)).padStart(3);
    }).join(' '));
  }
  return rows.join(' | ');
}
/* 마스크 바운딩박스 + 칸별 마스크 면적(이미지 좌표 기준). 세 단계가 이걸 공유한다.
   (2026-08-23 정리) 둘째 인자 angle을 받기만 하고 본문에서 한 번도 안 읽었다 —
   호출부 두 곳도 같이 정리했다. 뷰가 필요해지면 maskInf에 이미 들어 있다. */
function _densFrame(maskInf){
  const mi = maskInf;
  const rm = mi.reasonMask, MW = mi.maskW, MH = mi.maskH;
  if(!rm || !MW || !MH) return null;
  let x0=MW, x1=-1, y0=MH, y1=-1;
  for(let y=0;y<MH;y++) for(let x=0;x<MW;x++) if(rm[y*MW+x]===1){
    if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; }
  if(x1<x0||y1<y0) return null;
  const G = DENSITY_MAP.G;
  const bw=(x1-x0+1)/G, bh=(y1-y0+1)/G;
  const area = new Float64Array(G*G);
  for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++) if(rm[y*MW+x]===1){
    const c=Math.min(G-1,Math.floor((x-x0)/bw)), r=Math.min(G-1,Math.floor((y-y0)/bh));
    area[r*G+c]++;
  }
  // 이미지(mi.w/h) 좌표 → 칸 인덱스
  const sx = MW/mi.w, sy = MH/mi.h;
  const cellOf = (ix, iy)=>{
    const mx = ix*sx, my = iy*sy;
    if(mx<x0||mx>x1||my<y0||my>y1) return -1;
    const c=Math.min(G-1,Math.floor((mx-x0)/bw)), r=Math.min(G-1,Math.floor((my-y0)/bh));
    return r*G+c;
  };
  return { G, area, cellOf };
}
function measureStageDensity(angle, maskInf, inkCells){
  if(!DENSITY_MAP.on || !angle) return null;
  try{
    const F = _densFrame(maskInf);
    if(!F) return null;
    const G = F.G;
    // ── ① 캡처(3D 원료) ──
    const cap = _densGrid(G); cap.area = F.area;
    const rec = (state.neutralStrandPaths && state.neutralStrandPaths[angle])
             || (state.strandPaths && state.strandPaths[angle]);
    if(rec && rec.strands) for(const st of rec.strands){
      for(const p of st.pts){ const i=F.cellOf(p.x,p.y); if(i>=0) cap.cnt[i]++; }
    }
    // ── ② 3D 모델을 이 뷰로 되쏜 것 ──
    const three = _densGrid(G); three.area = F.area;
    const model = state.hair3Dneutral;
    const cal = model && model.viewCal && model.viewCal[angle];
    if(cal){
      const R = composeRotationZYX(cal.yaw, cal.pitch, cal.roll);
      const CY = model.CY, yTop = model.yTop;
      for(const st of model.strands){
        for(const p of st.pts){
          const wy = p.y - CY;
          const lz = R[6]*p.x + R[7]*wy + R[8]*p.z;
          if(lz <= 0) continue;                     // 카메라를 등진 점(화면에 안 옴)
          const lx = R[0]*p.x + R[1]*wy + R[2]*p.z;
          const ly = R[3]*p.x + R[4]*wy + R[5]*p.z;
          const i = F.cellOf(lx/cal.s + cal.cx, cal.crownY + (yTop - (ly + CY))/cal.sy);
          if(i>=0) three.cnt[i]++;
        }
      }
    }
    // ── ③ 화면 잉크(호출부가 같은 격자로 세어 넘겨준다) ──
    const scr = _densGrid(G); scr.area = F.area;
    if(inkCells) for(let i=0;i<G*G;i++) scr.cnt[i] = inkCells[i];
    const res = { G, capture:_densIndex(cap,G), model:_densIndex(three,G), screen:_densIndex(scr,G),
                  capN: rec && rec.strands ? rec.strands.length : 0,
                  srcNeutral: !!(state.neutralStrandPaths && state.neutralStrandPaths[angle]) };
    window._lastDensity = window._lastDensity || {}; window._lastDensity[angle] = res;
    console.log(`[밀도] ${angle} ${G}×${G} · 중앙값=100 · ·=마스크 없음`
      + ` (원료 ${res.capN}가닥${res.srcNeutral?'':' ※중립캡처 없어 현재 캡처로 대체'})`);
    console.log('        ① 캡처 ' + _densRow(res.capture, G));
    console.log('        ② 3D   ' + _densRow(res.model, G));
    console.log('        ③ 화면 ' + _densRow(res.screen, G));
    return res;
  }catch(e){ console.warn('[밀도] 실패', e); return null; }
}

const RENDER_MATCH = { on: true, w: 320, inkAlpha: 24, minCoh: 0.05,
                       fillBlur: 0.012, fillThr: 20,
                       everyFrame: false };  // true면 예전 동작(매 프레임 재계산)
let _matchLogged = {};
/* ── <b>한 번만 찍는 진단이 매 프레임 계산되고 있었다</b> (2026-08-22) ────────
   아래 함수는 캔버스 4개(320×H)를 새로 만들고, getImageData 3번, 블러 2패스,
   W×H 픽셀 루프를 돈다. 그런데 결과는 `_matchLogged[angle]` 때문에 <b>뷰당 한 번</b>만
   출력된다 — 즉 두 번째 프레임부터는 계산해 놓고 버린다. 렌더 루프 안에 있는
   진단이고, 폰에서는 블러 필터가 특히 비싸다.
   같은 조건을 <b>계산 앞</b>으로 옮긴다. 로그가 안 나갈 프레임이면 아예 안 잰다.
   ※ 반환값을 쓰는 곳이 생기면 이 게이트가 그때 걸린다 — 그래서 지금 호출부를
     확인했다: renderFrame 한 곳이고 반환값을 버린다(2026-08-22 확인).
   되돌리기: RENDER_MATCH.everyFrame = true */
function measureRenderVsPhoto(layerCanvas, maskInf, fit, cw, ch, angle, clipGrow){
  if(!RENDER_MATCH.on || !angle || !maskInf) return null;
  if(!RENDER_MATCH.everyFrame && (angle in _matchLogged) && !window.DIAG_VERBOSE) return null;
  try{
    const W = Math.min(RENDER_MATCH.w, cw), H = Math.max(1, Math.round(ch * W / cw));
    let _grN = 0;
    const grab = (src, fitDraw)=>{
      const c = scratchCanvas('mrvpGrab' + (_grN++), W, H);
      const x = c.getContext('2d', { willReadFrequently:true });
      if(fitDraw) x.drawImage(src, fit.dx*W/cw, fit.dy*H/ch, fit.dw*W/cw, fit.dh*H/ch);
      else x.drawImage(src, 0, 0, W, H);
      return x.getImageData(0,0,W,H).data;
    };
    const L = grab(layerCanvas, false);                                   // 렌더된 헤어(레이어)
    const hairC = state.hairCanvases && state.hairCanvases[angle];
    if(!hairC) return null;
    const M = grab(hairC, true);                                          // 원본 세그멘테이션
    /* 실루엣 비교용 — 가닥 사이 틈을 메워 "머리카락이 있는 구역"으로.
       ※ 처음엔 <b>블러 한 번</b>이었는데 사용자 지적으로 고쳤다:
         "비교를 원본사진이랑 하는 거 맞지? 원본사진이 번질리는 없잖아."
         정확하다. 마스크는 이미 꽉 찬 영역이라 안 번지는데 렌더만 번지게 하면
         <b>한쪽만 부푼 채로</b> 비교하는 셈이다. 그 편향이 그대로 숫자에 남았다 —
         하네스에서 렌더가 마스크와 완전히 일치할 때도 "밖으로 샘 3~5%"가 떴는데,
         그게 블러가 바깥으로 밀어낸 양이었다(바닥값이 아니라 편향이었다).
       고침: 팽창 → 침식(닫기). 가닥 사이 틈은 메워지고 <b>바깥 경계는 제자리</b>다.
       클립 마스크에서 쓴 것과 같은 연산이라 양쪽이 같은 자를 쓰게 된다. */
    const F = (()=>{
      const r = Math.max(1.5, W*RENDER_MATCH.fillBlur);
      let _pN = 0;   // 두 번째 패스가 첫 번째를 읽으므로 키가 달라야 한다
      const pass = (src, thr)=>{
        const c = scratchCanvas('mrvpPass' + (_pN++), W, H);
        const x = c.getContext('2d', { willReadFrequently:true });
        x.filter = `blur(${r}px)`; x.drawImage(src, 0, 0, W, H); x.filter='none';
        const d = x.getImageData(0,0,W,H);
        for(let i=3;i<d.data.length;i+=4) d.data[i] = d.data[i] > thr ? 255 : 0;
        x.putImageData(d,0,0); return c;
      };
      const dil = pass(layerCanvas, RENDER_MATCH.fillThr);      // 팽창(틈 메움)
      const closed = pass(dil, 255 - RENDER_MATCH.fillThr);      // 침식(경계 복귀)
      // 닫기는 원본을 포함해야 한다 — 얇은 가닥이 침식에 지워지지 않게 합집합
      closed.getContext('2d').drawImage(layerCanvas, 0, 0, W, H);
      return closed.getContext('2d').getImageData(0,0,W,H).data;
    })();

    // ── ① 실루엣 IoU (메운 렌더 vs 마스크) ──
    let inter=0, uni=0, inkIn=0, inkOut=0, maskOnly=0;
    const ink = new Uint8Array(W*H), msk = new Uint8Array(W*H), fil = new Uint8Array(W*H);
    for(let i=0;i<W*H;i++){
      const a = L[i*4+3] > RENDER_MATCH.inkAlpha;
      const f = F[i*4+3] > RENDER_MATCH.fillThr;
      const m = M[i*4+3] > 40;
      ink[i]=a?1:0; msk[i]=m?1:0; fil[i]=f?1:0;
      if(f&&m){ inter++; inkIn++; } else if(f){ inkOut++; } else if(m){ maskOnly++; }
      if(f||m) uni++;
    }
    const iou = uni ? inter/uni : 0;

    // ── ② 결 일치 — 렌더에 같은 구조텐서를 돌린다 ──
    // 알파를 밝기로 쓴다(가닥 패턴이 곧 알파). 투명 배경과의 경계 잡음을 피하려고
    // 마스크는 잉크 자체로 준다.
    const px = new Uint8ClampedArray(W*H*4);
    for(let i=0;i<W*H;i++){ const a=L[i*4+3]; px[i*4]=px[i*4+1]=px[i*4+2]=a; px[i*4+3]=255; }
    const mbuf = new Uint8Array(W*H);
    for(let i=0;i<W*H;i++) mbuf[i] = ink[i] ? 255 : 0;
    const R = computeHairOrientationField(px, mbuf, W, H);
    // 사진 쪽은 이미 뽑아 둔 컬럼 샘플에서 읽는다(같은 필드, 같은 정의)
    const ow = maskInf.maskW || maskInf.w, oh = maskInf.maskH || maskInf.h;
    let wsum=0, esum=0, n=0;
    for(let y=0;y<H;y++) for(let x=0;x<W;x++){
      const i=y*W+x;
      if(!ink[i] || !msk[i]) continue;                                    // 둘 다 있는 자리에서만
      const cr = R.coherence[i]; if(!(cr >= RENDER_MATCH.minCoh)) continue;
      // 레이어 픽셀 → 원본 이미지 좌표 → 결 필드 좌표
      const ix = (x*cw/W - fit.dx) / fit.dw * maskInf.w;
      const iy = (y*ch/H - fit.dy) / fit.dh * maskInf.h;
      if(ix<0||iy<0||ix>=maskInf.w||iy>=maskInf.h) continue;
      const o = sampleOrientation(maskInf.orientation, ix*(ow/maskInf.w), ow, iy*(oh/maskInf.h));
      if(!o || !(o.coherence >= RENDER_MATCH.minCoh)) continue;
      // 결은 180° 주기 — 각차를 [0, 90°]로 접는다
      let d = Math.abs(R.angle[i] - o.angle) % Math.PI;
      if(d > Math.PI/2) d = Math.PI - d;
      const w = cr * o.coherence;
      esum += d*w; wsum += w; n++;
    }
    const grainDeg = wsum ? (esum/wsum)*180/Math.PI : null;

    /* ── ③ 실채움 + 밀도 격자로 넘길 잉크 집계 ──
       (2026-08-01 교정) 예전 '채움%'는 <b>번지게 한</b> 렌더로 쟀다. 그러면 얇게라도
       닿기만 하면 100%가 나와서 "정수리가 성기다"를 전혀 못 잡는다(실기기 네 뷰가
       전부 98~100%였다). 실루엣 판정은 번진 값이 맞지만, "안이 부실한가"는
       <b>원본 잉크</b>로 재야 한다. 둘 다 찍는다. */
    let rawIn=0;
    for(let i=0;i<W*H;i++) if(msk[i] && ink[i]) rawIn++;
    const maskPx = (()=>{ let c=0; for(let i=0;i<W*H;i++) if(msk[i]) c++; return c; })();
    // 밀도 격자(단계별 비교용) — measureStageDensity와 <b>같은 격자</b>를 쓰려면
    // 이미지 좌표로 되돌려 세야 한다.
    let inkCells = null;
    try{
      const F = _densFrame(maskInf);
      if(F){
        inkCells = new Float64Array(F.G*F.G);
        for(let y=0;y<H;y++) for(let x=0;x<W;x++){
          const i=y*W+x; if(!ink[i] || !msk[i]) continue;
          const ix = (x*cw/W - fit.dx) / fit.dw * maskInf.w;
          const iy = (y*ch/H - fit.dy) / fit.dh * maskInf.h;
          const ci = F.cellOf(ix, iy); if(ci>=0) inkCells[ci]++;
        }
      }
    }catch(e){}
    const res = { iou:+iou.toFixed(3), grainDeg: grainDeg!=null ? +grainDeg.toFixed(1) : null,
                  grainPx:n, inkIn, inkOut, maskOnly, inkCells,
                  fill: (inkIn+maskOnly) ? +(inkIn/(inkIn+maskOnly)*100).toFixed(1) : 0,
                  rawFill: maskPx ? +(rawIn/maskPx*100).toFixed(1) : 0,
                  leak: (inkIn+inkOut) ? +(inkOut/(inkIn+inkOut)*100).toFixed(1) : 0 };
    window._lastMatch = window._lastMatch || {}; window._lastMatch[angle] = res;
    if(!(angle in _matchLogged) || window.DIAG_VERBOSE){
      _matchLogged[angle] = true;
      console.log(`[비교] ${angle} 실루엣 IoU ${res.iou}`
        + ` · 덮음 ${res.fill}%(번짐) · <b>실채움 ${res.rawFill}%</b>(원본 잉크) · 밖으로 샘 ${res.leak}%`
        + ` · 결 일치 ${res.grainDeg!=null ? res.grainDeg+'°' : '-'}(${n}px)`
        + ` · 클립 ${HAIR_LAYER_CLIP.on ? (clipGrow > 0.5 ? '여유 '+Math.round(clipGrow)+'px(길이 늘림)' : 'ON') : 'OFF'}`);
      measureStageDensity(angle, maskInf, res.inkCells);
    }
    return res;
  }catch(e){ console.warn('[비교] 실패', e); return null; }
}
function resetRenderMatchLog(){ _matchLogged = {}; }

const MASK_LEAK_W = 320;
let _leakLogged = {};
/* measureRenderVsPhoto와 <b>같은 모양의 낭비</b>였다(2026-08-22): 캔버스 3장 +
   getImageData 3번 + 픽셀 루프를 매 호출 돌면서, 출력은 뷰당 한 번뿐이다.
   같은 조건을 계산 앞으로 올린다. 반환값을 쓰는 곳이 없는 것도 확인했다
   (호출부 1곳, 값 버림). 되돌리기: window.DIAG_VERBOSE = true */
function measureMaskLeak(baseOff, extOff, strictMask, cw, ch, angle){
  if(!angle) return null;
  if((angle in _leakLogged) && !window.DIAG_VERBOSE) return null;
  try{
    const w = Math.min(MASK_LEAK_W, cw), h = Math.max(1, Math.round(ch * w / cw));
    let _smN = 0;
    const small = (src)=>{
      const c = scratchCanvas('leak' + (_smN++), w, h);
      const x = c.getContext('2d', { willReadFrequently:true });
      x.drawImage(src, 0, 0, w, h);
      return x.getImageData(0,0,w,h).data;
    };
    const M = small(strictMask), B = small(baseOff), E = small(extOff);
    let bIn=0, bOut=0, eIn=0, eOut=0;
    for(let i=3;i<M.length;i+=4){
      const inMask = M[i] > 40;
      if(B[i] > 24){ inMask ? bIn++ : bOut++; }
      if(E[i] > 24){ inMask ? eIn++ : eOut++; }
    }
    const tot = bIn+bOut+eIn+eOut;
    const res = { base:{ inside:bIn, outside:bOut }, ext:{ inside:eIn, outside:eOut },
                  leakPct: tot ? +((bOut+eOut)/tot*100).toFixed(2) : 0 };
    window._lastMaskLeak = window._lastMaskLeak || {};
    window._lastMaskLeak[angle] = res;
    // 각도당 1회만(슬라이더 드래그 도배 방지). DIAG_VERBOSE면 매번.
    if(!(angle in _leakLogged) || window.DIAG_VERBOSE){
      _leakLogged[angle] = true;
      console.log('[진단·침범] '+angle+' 마스크 밖 잉크 '+res.leakPct+'%'
        + ' (클립층 '+bOut+'px, 연장층 '+eOut+'px / 마스크 안 '+(bIn+eIn)+'px)');
    }
    return res;
  }catch(e){ return null; }
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
  // 버그 수정: 기존엔 r*bright 처럼 순수 곱셈으로 밝기를 조정했는데, 이러면
  // 검정/짙은 갈색처럼 원래 값이 0에 가까운 색은 bright를 0.65~1.2로 바꿔도
  // 결과가 거의 그대로라 가닥끼리 색 차이가 안 생기고 다 뭉쳐 보였음
  // (예: 30*0.65=19.5, 30*1.2=36 — 육안으로 거의 차이 없음).
  // → 밝게 할 땐(bright>1) 흰색 쪽으로 섞어서(additive) 어두운 색에서도
  //   확실한 하이라이트가 생기게 하고, 어둡게 할 땐(bright<1) 기존처럼 곱셈 유지.
  const delta = bright - 1; // 대략 -0.35 ~ +0.2
  function mix(c){
    if(delta >= 0) return c + (255-c) * Math.min(1, delta*1.8);
    return c * bright;
  }
  return `rgb(${Math.min(255,Math.round(mix(r)))},${Math.min(255,Math.round(mix(g)))},${Math.min(255,Math.round(mix(b)))})`;
}

let rafId = null;
function drawAdjustPreview(){
  if(currentScreen!=='adjust') return;
  if(rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(()=>{
    renderAdjustFrame();
    rafId = null;
  });
}

