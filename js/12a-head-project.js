/* ══════════════════════════════════════════════════════════
   12a-head-project.js — 얼굴 계측 · 이미지↔두상 좌표 투영 · 두상/목/얼굴 메쉬
   원본 index.html 16495~17717행. 클래식 스크립트이므로 로드 순서가 곧
   실행 순서다 — index.html의 <script src> 순서를 바꾸지 말 것.
   ══════════════════════════════════════════════════════════ */
/* ════════════════════════════════════════
   3D 두상 (2단계 프로토타입)
   ────────────────────────────────────────
   방향: 지금은 절차적(procedural) 도형으로 두상을 대충 근사해서 화면에
   띄우지만, 코드 구조는 처음부터 "진짜 3D 두상 파일(.glb)로 교체 가능"
   하게 짜둠 — HEAD_MESH_SOURCE.type을 'gltf'로 바꾸고 url만 넣으면
   loadHeadMesh()가 알아서 GLTFLoader 경로를 타도록 분기되어 있음.
   실제 진짜 메시가 생기기 전까지는 procedural 분기만 쓰임.
════════════════════════════════════════ */
const HEAD_MESH_SOURCE = {
  type: 'procedural', // 'procedural' | 'gltf' — 나중에 실제 두상 파일 생기면 'gltf'+url로 교체
  url: null,           // 예: '/assets/generic_head.glb'
};

let model3D = null; // { renderer, scene, camera, headGroup, hairMesh, animId, initialized, container }
// setupModel3DScreen()이 호출될 때마다 +1. 사진 데칼은 비동기로 로드되므로,
// 로드 도중 화면을 벗어났다 다시 들어와 headGroup이 통째로 재구성된 경우
// 오래된 데칼 Promise가 새 headGroup에 잘못 붙는 걸 이 번호로 막는다.
let model3DGeneration = 0;

function clamp(v,lo,hi){ return Math.max(lo, Math.min(hi, v)); }

/* ════════════════════════════════════════════════════════════════
   얼굴 계측 · 이미지↔두상 좌표 투영기
   getFaceMetrics(실측 종횡비) / makeFaceProjector(이미지 정규좌표 ↔ 메쉬 좌표).
   얼굴·두상·목·헤어가 전부 이 두 개를 기준점으로 공유한다 — 여기가 어긋나면
   전부 따로 논다(상단 3D 좌표 규약 참고).
   ════════════════════════════════════════════════════════════════ */
// state.landmarks.front + state.hairMasks.front(실제 캡처 픽셀 크기)로
// "이 사람 얼굴이 대략 얼마나 갸름한지/넓은지"를 실측해서 절차적 두상의
// 가로/세로 스케일 보정 계수를 뽑는다. 랜드마크 정규화좌표는 각각 이미지
// 가로/세로 기준이라 그대로 비율 비교하면 안 되고 실제 픽셀 폭/높이를
// 곱해줘야 진짜 종횡비가 나옴. 오검출로 두상이 그로테스크하게 찌그러지는
// 걸 막기 위해 배율 범위를 좁게 clamp.
function getFaceMetrics(){
  const lm = (state.landmarks && state.landmarks.front) || getEstimatedLandmarks('front');
  const imgW = (state.hairMasks && state.hairMasks.front && state.hairMasks.front.w) || 1;
  const imgH = (state.hairMasks && state.hairMasks.front && state.hairMasks.front.h) || 1;

  const faceHeightPx = Math.max(1, (lm.chinY - lm.browTopY) * imgH);
  const faceWidthPx  = Math.max(1, Math.abs(lm.rEarX - lm.lEarX) * imgW);
  const aspect = faceHeightPx / faceWidthPx; // 클수록 갸름한 얼굴, 작을수록 둥근/넓은 얼굴

  const BASELINE_ASPECT = 1.55; // 기존 고정 스케일(0.78/0.85)이 암묵적으로 가정하던 기준 비율
  const ratio = clamp(aspect / BASELINE_ASPECT, 0.72, 1.38);
  const widthFactor  = clamp(1/Math.sqrt(ratio), 0.85, 1.18);
  const heightFactor = clamp(Math.sqrt(ratio), 0.85, 1.18);

  const projector = makeFaceProjector(lm, widthFactor, heightFactor);
  return { lm, imgW, imgH, widthFactor, heightFactor, projector };
}

// 이미지 정규화좌표(0~1) → 두상 로컬(x,y) 근사 변환. "눈높이/턱높이" 두
// 기준점을 두상 로컬 y좌표 두 지점(EYE_MESH_Y/CHIN_MESH_Y)에 맞추는 아핀
// 변환 하나로 세로를, "좌/우 귀" 두 기준점을 ±EAR_MESH_X에 맞추는 아핀
// 변환 하나로 가로를 처리. 진짜 카메라 캘리브레이션이 아니라 "실측 비율에
// 대략 맞는 자리" 수준 근사 — 이 파이프라인 전체가 원래 이 수준(procedural
// placeholder)이라 과설계하지 않음. widthFactor/heightFactor는
// getFaceMetrics()가 이미 반영한 두상 스케일과 같은 값을 받아 기준점 자체가
// 두상 크기에 맞춰 같이 움직이게 한다.
/* 투영기가 쓰는 <b>실측 기준자</b>(성인 평균, cm). 메쉬 단위는 이 두 값으로만
   실제 길이에 묶인다 — 아래 [두상 cm 환산] 진단이 같은 상수를 써서 되짚는다. */
const FACE_RULER_CM = { eyeToChin: 11.5, earHalf: 7.0 };
function makeFaceProjector(lm, widthFactor, heightFactor){
  const EYE_MESH_Y = 0.15; // headMesh.position.y와 동일(구 적도 = 이 높이)
  const CHIN_MESH_Y = 0.15 - 0.70*heightFactor;
  const denomY = (lm.chinY - lm.eyeY) || 0.001;
  const bY = (EYE_MESH_Y - CHIN_MESH_Y) / denomY;
  const aY = EYE_MESH_Y + bY * lm.eyeY;
  const toMeshY = (v)=> aY - bY * v;

  /* ── 가로·세로 스케일 일치 (2026-07-26 4차, 실기기 비례 오류 수정) ──────
     증상: 두상이 사람 비례가 아니다. 세로/폭 = 1.04인데 사람은 1.48
          (얼굴이 넙대대하고 머리가 앞뒤로만 긴 형태).
     원인: 이 투영기가 세로와 가로를 서로 다른 기준으로 정규화하고 있었다.
          세로 — 눈→턱(실제 ≈11.5cm)을 0.70 단위로  → 0.0609 단위/cm
          가로 — 귀 반간격(실제 ≈7.0cm)을 0.6396 단위로 → 0.0914 단위/cm
          같은 1cm가 가로에서 1.50배 크게 잡힌다. 그래서 가로로 재는 모든 값
          (얼굴 폭·두상 폭·헤어 헐 폭)이 함께 부풀었다.
     검증: 사람 세로/폭 1.48 ÷ 스케일오차 1.44 = 1.03 ≈ 실측 1.04 — 정확히 일치.
     수정: 가로 기준을 세로 기준에서 유도한다. 눈→턱이 0.70단위면 귀 반간격은
          0.70 × (7.0/11.5) = 0.426단위여야 한다. 이제 두 축이 같은 자를 쓴다.
     ※ 되돌리려면 EAR_MESH_X를 예전 식(0.78×wf×0.82)으로 바꾸면 된다.

     ── (2026-08-11) 위 수정을 <b>같은 줄이 도로 깨뜨리고 있었다</b> ──────────
     식 끝에 `× (widthFactor / heightFactor)`가 붙어 있었다. (EYE−CHIN)이
     0.70·hf이므로 전개하면 hf가 <b>약분돼 사라진다</b>:
         EAR_MESH_X = 0.70·hf × (7/11.5) × (wf/hf) = 0.4261 × <b>wf</b>
     세로는 hf 자, 가로는 wf 자가 되어 두 축이 다시 다른 자를 쓴다. 어긋남은
     정확히 hf/wf = r(=aspect/BASELINE_ASPECT)이고, 실기기 로그의
     "[자 일치] … 어긋남 0.721배"가 바로 이 값이다(r의 하한 클램프 0.72).

     왜 이게 치명적인가 — wf·hf는 <b>일부러 서로 반대로</b> 움직이게 만든 값이다
     (wf=1/√r, hf=√r). 즉 "얼굴이 둥그니 두상을 넓게"라는 모양 보정이 먹는
     순간 <b>자가 반드시 어긋난다</b>. 두 요구를 동시에 만족할 수 없는 구조였다.
     사용자 지적: "사람마다 비례가 다른데 계속 같은 값을 적용하면 당연히 자가
     달라지지. 그걸 매번 실측에서 잡아야지."

     그래서 꼬리표를 뗀다. 그러면 EAR_MESH_X = 0.4261·hf가 되어 <b>어떤
     얼굴이든</b> 가로·세로 cm/단위가 16.43/hf로 자동 일치한다(hf가 양쪽에
     똑같이 걸리므로). 모양 보정은 사라지지 않는다 — 두상 a·b·c는 어차피
     실루엣/두피선 <b>실측</b>에서 나오고, 투영기가 등방이 되어야 그 실측이
     한 자로 나온다. 즉 모양을 가정에서 빼고 실측에 맡기는 방향이다.

     남는 가정은 "귀반간격:눈→턱 = 7:11.5"(성인 평균)뿐인데, 이건 성격이
     다르다 — 편차가 가로·세로에 <b>똑같이</b> 걸리므로 두상이 조금 크거나
     작아질 뿐 <b>모양은 안 찌그러진다</b>. 실루엣 지표(W/H·폭 프로파일)는
     바운딩박스로 나누므로 크기 오차는 상쇄되고 모양 오차만 남는다.

     ⚠ widthFactor 인자는 이제 이 함수에서 안 쓴다. 시그니처는 유지한다 —
       호출부 세 곳이 getFaceMetrics의 같은 쌍을 넘기고 있어서, 인자를 빼면
       "어느 값을 넘겨야 하는가"가 호출부마다 갈릴 여지가 생긴다.
     되돌리려면 `* (widthFactor / heightFactor)`를 다시 붙이면 된다. */
  const EYE_TO_CHIN_CM = FACE_RULER_CM.eyeToChin, EAR_HALF_CM = FACE_RULER_CM.earHalf;
  const EAR_MESH_X = (EYE_MESH_Y - CHIN_MESH_Y) * (EAR_HALF_CM / EYE_TO_CHIN_CM);
  const lx = Math.min(lm.lEarX, lm.rEarX), rx = Math.max(lm.lEarX, lm.rEarX);
  const denomX = (rx - lx) || 0.001;
  const bX = (2*EAR_MESH_X) / denomX;
  const toMeshX = (u)=> (u - lx) * bX - EAR_MESH_X;

  return { toMeshX, toMeshY, bX, bY }; // EAR_MESH_X는 외부에서 안 읽어 반환 목록에서 제외
}
/* 메쉬 1단위가 몇 cm인가 — 축별로. (2026-08-11 단일 출처로 통합)
   위 EAR_MESH_X·CHIN_MESH_Y 식을 <b>그대로</b> 뒤집은 것이다. 진단 로그 세 곳이
   각자 이 식을 손으로 복제하고 있었는데, 그게 위험한 이유가 이번에 실제로 드러났다:
   EAR_MESH_X에서 wf를 떼는 순간 복제본들은 옛 식(wf)을 그대로 들고 있어서
   <b>고쳐진 뒤에도 "어긋남 0.721배"를 계속 찍는다</b> — 고친 사람이 안 고쳐졌다고
   믿게 만드는 종류의 오류다(파일 작업원칙 (3) 단일 출처).
   x와 y가 <b>같은 값</b>이어야 정상이다. 다르면 투영기가 축마다 다른 자를 쓴다는 뜻. */
function faceRulerCmPerUnit(fm){
  const hf = (fm && fm.heightFactor) || 1;
  let spanY = 0.70 * hf;                                                  // 눈→턱 (단위)
  let earX  = spanY * (FACE_RULER_CM.earHalf / FACE_RULER_CM.eyeToChin);  // 귀 반간격 (단위)
  /* 가능하면 <b>투영기에 직접 물어본다</b>. 식을 다시 쓰면 그 순간 또 복제본이
     되어, 투영기가 바뀌어도 이 진단은 옛날 말을 계속 하게 된다(방금 그 일이
     났다). 실제 toMeshX/toMeshY에 랜드마크를 넣어 나온 <b>결과</b>로 재면
     투영기가 어떻게 바뀌든 이 검사는 항상 참말을 한다. */
  const lm = fm && fm.lm, p = fm && fm.projector;
  if(p && lm && typeof p.toMeshX === 'function' && typeof p.toMeshY === 'function'
     && lm.lEarX != null && lm.rEarX != null && lm.eyeY != null && lm.chinY != null){
    const sy = p.toMeshY(lm.eyeY) - p.toMeshY(lm.chinY);
    const sx = (p.toMeshX(Math.max(lm.lEarX, lm.rEarX)) - p.toMeshX(Math.min(lm.lEarX, lm.rEarX))) / 2;
    if(sy > 1e-6 && sx > 1e-6){ spanY = sy; earX = sx; }
  }
  return { x: FACE_RULER_CM.earHalf / earX, y: FACE_RULER_CM.eyeToChin / spanY };
}

/* ════════════════════════════════════════════════════════════════
   두상·목·얼굴 메쉬 생성
   실측 단면(아래 구역)과 투영기를 받아 실제 Three.js 지오메트리를 만든다.
   buildProceduralHead(두상 돔) / buildRealNeckMesh(목) / 얼굴 메쉬.
   ════════════════════════════════════════════════════════════════ */
// 절차적 두상: 타원(스케일된 구)으로 두상 근사. 이전엔 비율·피부색·이목구비
// 위치가 전부 눈대중 고정값이었는데, 이제 getFaceMetrics()가 뽑아낸 실측
// 종횡비/좌표 변환(projector)과 실제 두피색(skinColorCss)을 반영해서 "이
// 사람 사진에서 뽑을 수 있는 정보는 최대한 쓴" 근사치로 만든다. 여전히
// 진짜 3D 스캔은 아니고 절차적 근사(placeholder)라는 성격 자체는 그대로.
// 두상 본체(실측 종횡비 반영한 타원). buildProceduralHead()에서 분리됨(로직 동일).
// ── 실측 단면 기반 두상 메쉬(2026-07-14, 타원체 완전 제거) ──
// 사용자 지시: "기존 타원체는 지워, 중간이 허공이어도 일단은 상관없어".
// 고정 타원체(SphereGeometry.scale)를 없애고, scalpPointToWorld(이미
// computeHeadCrossSections의 실측 단면 데이터를 쓰도록 교체됨)를 (phi,theta)
// 격자로 촘촘히 샘플링해서 실제 메쉬를 만든다. widthFactor/heightFactor
// 인자는 scalpPointToWorld 내부에서 getFaceMetrics()로 같은 값을 다시
// 가져오므로(호출부 buildProceduralHead도 같은 faceMetrics에서 뽑은 값이라
// 불일치 없음) 여기선 직접 안 씀 — 시그니처만 호환성 위해 유지.
// PHI_MAX는 HEAD_PHI_BANDS(실측 데이터가 있는 범위, 네이프 부근)까지만 —
// 그 아래(목)는 이번엔 안 채움(사용자: "중간이 허공이어도 상관없다").
// 2026-07-14 정리: buildHeadMesh(phi 링)와 buildRealNeckMesh(높이 링)가
// "row(위상/높이) × theta 격자를 사각형당 삼각형 2개로 잇는" 완전히 같은
// 인덱스 수식(권취 방향 포함)을 각자 만들고 있었음 — 정점 좌표 계산과는
// 무관한 순수 정수 인덱스 공식이라 동작 차이 없이 하나로 합침.
function buildRingGridIndices(rowSteps, thetaSteps){
  const indices = [];
  for(let ri=0; ri<rowSteps; ri++){
    for(let ti=0; ti<thetaSteps; ti++){
      const a = ri*(thetaSteps+1)+ti;
      const b = a + (thetaSteps+1);
      const c = a+1;
      const d = b+1;
      indices.push(a,b,c, b,d,c);
    }
  }
  return indices;
}

// ── 실측 단면 기반 목 메쉬 ──
// extractHairMask STEP 1.5의 personMask(사람 전체 실루엣) + computeNeckCrossSections
// 로 뽑은 그 사람 실측 목 단면(높이별 halfWidth/halfDepth)을 써서, 여러 높이
// 링을 쌓아 BufferGeometry로 연결해 짓는다.
// CylinderGeometry는 원형(가로=세로)만 가능해서 폐기 — 목은 보통 좌우 폭과
// 앞뒤 깊이가 다른데(원형이 아님) 이게 바로 실측으로 얻을 수 있는 정보라
// 커스텀 지오메트리로 바꿈.
// 상수의 출처로만 남겨두고(computeNeckCrossSections 최후 폴백 참고), 함수
// 자체는 나중 참고용으로 삭제하지 않음(이 파일의 기존 관례).
/* ── 목은 <b>옷깃에서 올라온다</b> (2026-08-31 11차) ──────────────────────────
   사용자: "3D결과보기도 두상에서 목을 뽑을 게 아니고, 의상라인에서 체형을 잡았으니까
   거기서 좀 더 자연스럽게 올리는 게 나을 거 같아. 어차피 굵거나 가늘거나 원기둥
   형태라서 실제 목 형태랑은 차이가 있어."

   옛 구조는 목의 <b>양쪽 끝이 다 머리</b>였다 — 폭·깊이를 두개골 반경 대비
   22~55% / 22~70%로 클램프했다(headA·headC). 머리가 크면 목이 굵어진다는 뜻인데
   해부학적으로 목은 뼈와 어깨에 붙지 두상 크기에 비례하지 않는다. 게다가 그 실측
   자체가 머리카락 섞인 실루엣이라(11차에서 별도 수정) 긴 머리 손님은 비율이
   1.0으로 나와 항상 상한에 붙었다 — 그게 "턱만큼 굵은 원기둥"의 정체다.

   새 구조: 목의 <b>기준은 옷깃 구멍</b> 하나다.
     · 아래 링 = 의상 메쉬의 목 구멍 실측(measureGarmentNeckOpening) × inset
       의상은 이미 이 사람 체형(두신 비율)으로 맞춰져 있으므로, 그 구멍이 곧
       이 사람의 목 밑동이다. 새로 재지 않고 이미 있는 값을 읽는다.
     · 위 링 = 아래 링 × 해부학적 테이퍼(사용자 지시: "3번은 해부학적 비율로 해")
     · 앞으로 기울인다 — 사람 목은 수직이 아니다. 원기둥과 실물의 차이 중 절반이 이것.
     · 뒤쪽을 부풀린다 — 승모근이 붙어 단면이 앞뒤 비대칭이다. 나머지 절반이 이것.

   ⚠ y 좌표 계약(getNeckTopY / getNeckBottomY / y=−1.15)은 <b>한 글자도 안 건드린다.</b>
     8/30에 그 계약의 한쪽만 옮겼다가 옷깃이 통째로 날아간 기록이 있다. 이번에
     바꾸는 것은 그 사이의 <b>단면·기울기·재질</b>뿐이다.
   ⚠ 의상보다 목이 <b>먼저</b> 만들어진다(setupModel3DScreen 순서). 그래서 첫 빌드는
     아래 폴백(예전 실측 경로)으로 서고, 의상이 도착하면 refitNeckToGarment가
     다시 짓는다. 의상이 끝내 없으면 폴백 그대로 — 새 실패 모드가 아니다.
   되돌리기: NECK_SHAPE.fromGarment = false (예전 두개골 클램프 경로로 복귀) */
const NECK_SHAPE = {
  /* ── 목도 <b>두상 자</b>로 (2026-09-05 사용자 지시) ──────────────────────
     사용자: "일반적으로 준수한 체형 있잖아.. 목도 어차피 옷메쉬에 걸려 있는
     거니 같이 잡아."

     그래서 목 단면을 옷깃에서 뽑던 것을 끊는다. 12차가 이미 "옷깃은 어떤 옷을
     입었느냐에 따라 얼마든지 넓어질 수 있지만 목은 아니다"라고 적어 놓고도,
     그 판단을 <b>난간</b>으로만 걸고 값 자체는 옷깃에서 계속 가져오고 있었다.

     ── 실기기에서 무엇이 났나 ──────────────────────────────────────────
     이 손님은 옷깃 실측이 아예 실패했다([3D·목] 옷깃 구멍 실측 실패 → 폴백).
     그래서 실제로 돈 건 폴백 클램프였는데 거기 상한이 비대칭이었다:
         폭   0.55 × a(두개골 반폭)
         깊이 0.70 × c(두개골 반깊이)
     계수도 크고 c > a라 두 배가 곱해진다. 사용자가 본 "폭은 그나마 괜찮은데
     앞뒤로 너무 넓다"가 이 두 줄이다. 0.55와 0.70이 왜 다른지는 근거가 없었다.

     ── 고침 ────────────────────────────────────────────────────────────
     성인 목 밑동 치수를 <b>cm로</b> 적고, 이 파일의 유일한 자
     (faceRulerCmPerUnit)로 환산한다. NECK_LEN_CM(8.0)이 이미 쓰는 방식 그대로다.
     그러면 폭과 깊이가 <b>같은 종류의 값</b>이 되어 비대칭이 생길 수가 없고,
     숫자가 실물과 대조 가능해진다(둘레 ≈ π×(W+D)/2 ≈ 35cm).
     되돌리기: fromGarment = true. */
  fromGarment: false,
  baseWCm:  11.5,  // 목 밑동 좌우 폭(cm) — 성인 평균. 난간 9~13의 한가운데
  baseDCm:  11.0,  // 〃 앞뒤 깊이(cm). 목은 거의 원통이라 폭과 비슷하다 — 이게 빠져 있었다
  inset:    0.86,  // (fromGarment=true일 때만) 옷깃 구멍보다 이만큼 안쪽
  taperW:   0.74,  // 위 폭 ÷ 아래 폭 (목은 위로 갈수록 좁다)
  taperD:   0.80,  // 위 깊이 ÷ 아래 깊이
  tiltZ:    0.09,  // 위 링을 앞으로(+Z), 목 길이 대비 — 약 5°
  napeFull: 1.20,  // 아래쪽 <b>뒤통수 쪽</b> 부풀림(승모근). 위로 갈수록 1로 수렴
  unlit:    true,  // 얼굴과 같은 기준 — 아래 주석 참고
  shadeRear: 0.78, // 무조명이라 형태가 안 보이므로 정점색으로 뒤쪽을 어둡게
  shadeTop:  0.90, // 턱 밑은 원래 그림자다 — 위쪽을 살짝 어둡게 해 이음매를 눌러 준다
  /* ── 해부학적 난간 (2026-08-31 12차) ────────────────────────────────────
     11차는 옷깃 실측 하나만 믿었다. 그런데 그 실측이 <b>구멍이 아니라 테두리</b>를
     쟀다(아래 measureGarmentNeckOpening 주석). 그 결과 실기기에서 목이 얼굴보다
     넓은 <b>갓등</b>이 됐다 — 사용자: "목은 해부학적으로 어느 정도 굵기 이상
     안 주는 게 좋을 거 같아."
     이제 값 자체가 cm라 난간은 <b>자가 튄 경우</b>(얼굴 랜드마크가 깨져 환산이
     이상할 때)만 잡는다. 자주 걸리면 그건 목이 아니라 자를 봐야 한다는 신호다.
     cm ↔ 메쉬단위 환산은 faceRulerCmPerUnit — 이 파일의 유일한 자다. */
  minBaseCm: 9.0,   // 목 밑동 <b>폭</b> 하한(cm)
  maxBaseCm: 13.0,  // 〃 상한
};
/* 의상 메쉬의 <b>목 구멍</b> — 옷깃선(getNeckBottomY) 바로 아래 얇은 층의 가로/깊이.
   loadOutfitMesh가 에셋의 목 밑동을 정확히 그 y에 맞춰 놓으므로, 그 바로 밑을
   자르면 나오는 단면이 옷깃 구멍이다. measureOutfitMeshBody(어깨·발끝을 재는
   기존 함수)와 <b>다른 것을 재므로</b> 따로 둔다 — 저쪽은 최대 폭, 이쪽은 구멍이다. */
let _garmentNeckOpening = null;   // { halfWidth, halfDepth } (목 메쉬와 같은 좌표계)
function measureGarmentNeckOpening(obj){
  if(!obj) return null;
  const NY = getNeckBottomY();
  const slab = 0.10;              // 옷깃 바로 아래 이 두께만(두꺼우면 어깨가 들어온다)
  /* ⚠ 11차의 잘못 — 여기서 max|x|를 썼다. 구멍을 재려면 <b>안쪽</b> 경계를 봐야
     하는데 max는 그 층에서 가장 <b>바깥</b> 정점, 즉 옷깃의 겉테두리(어깨 쪽)를
     준다. 그래서 목 밑동이 옷 어깨폭만큼 벌어져 갓등이 됐다.
     구멍 반지름은 축에서 가까운 쪽이므로 <b>하위 백분위</b>로 잡는다 — 최솟값은
     스트레이 정점 하나에 0으로 무너지니 쓰지 않는다. */
  const xs = [], zs = [];
  const v = new THREE.Vector3();
  obj.updateMatrixWorld(true);
  obj.traverse(child=>{
    if(!child.isMesh || child.visible === false) return;
    const pos = child.geometry && child.geometry.attributes && child.geometry.attributes.position;
    if(!pos) return;
    for(let i=0;i<pos.count;i++){
      v.fromBufferAttribute(pos, i).applyMatrix4(child.matrixWorld);
      if(v.y > NY || v.y < NY - slab) continue;
      xs.push(Math.abs(v.x)); zs.push(Math.abs(v.z));
    }
  });
  if(xs.length < 24) return null;
  const pct = (arr, p)=>{ arr.sort((a,b)=>a-b); return arr[Math.floor(arr.length*p)]; };
  let maxX = pct(xs, 0.15), maxZ = pct(zs, 0.15);
  /* 정직성 점검 — 반폭이 0.15~0.75단위를 벗어나면 옷깃이 아니라 어깨나 소매를
     잰 것이다. 그때는 null(폴백)이 맞는 답이다. 어차피 아래에서 cm 난간이 한 번 더
     받지만, <b>왜</b> 그 값이 나왔는지는 여기서 갈라야 로그에 남는다. */
  if(!(maxX > 0.15 && maxX < 0.75)) return null;
  if(!(maxZ > 0.10 && maxZ < 0.80)) maxZ = maxX * 0.82;   // 깊이만 이상하면 비율로
  return { halfWidth: maxX, halfDepth: maxZ };
}

function buildRealNeckMesh(skinColor){
  /* ── 톤은 <b>얼굴을 따라간다</b> (2026-08-31 11차) ──────────────────────────
     사용자: "톤 같은 경우는 얼굴 톤을 따라가는 게 당연히 자연스럽지."
     8/22에 얼굴을 MeshBasicMaterial(무조명)로 바꿨다 — 사진에 촬영 조명이 이미
     구워져 있는데 장면 조명을 또 걸면 밝은 피부가 255에 잘려 납작해지기 때문이다.
     그런데 <b>목은 그때 같이 안 옮겼다.</b> 사진 얼굴(무조명)과 장면 조명을 받는
     목이 턱선에서 만나니 색이 끊긴다 — 8/30 배너가 예고한 "턱선에 색 띠" 그대로이고,
     실기기에서 얼굴은 밝고 목만 어두운 갈색으로 나온 것이 이것이다.
     같은 판단이 두 곳에 있고 한쪽만 옮겨진, 이 파일의 단골 모양이다.
     고침: 목도 무조명으로. 대신 조명이 없으면 원기둥이 <b>납작한 색면</b>이 되므로,
     형태감을 정점색으로 구워 넣는다(아래 shadeRear/shadeTop).
     되돌리기: NECK_SHAPE.unlit = false */
  const neckColor = skinColor.clone();
  const neckMat = NECK_SHAPE.unlit
    ? new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true })
    : new THREE.MeshStandardMaterial({ color: neckColor.clone().multiplyScalar(0.94), roughness: 0.85 });

  const RING_STEPS = 8, THETA_STEPS = 24; // THETA_STEPS=24는 예전 CylinderGeometry 세그먼트 수와 동일하게 유지
  const PHI_MAX = HEAD_PHI_BANDS[HEAD_PHI_BANDS.length-1];
  /* ── 이음매는 <b>그려지는 두개골</b>을 따라간다 (2026-08-17 c) ──────────────
     headPhiToMeshY는 <b>헐</b>의 세로 반경(computeHeadVerticalRadius)으로 Y를
     낸다. 두개골 구가 헐 크기였을 땐 그게 곧 두개골 표면이라 목 윗링이 구
     안쪽(정규화 높이 cos(PHI_MAX)≈-0.70)에 얌전히 박혔다. 그런데 위에서
     두개골을 두피면 크기로 줄였으므로, 이 식을 그대로 두면 구 바닥
     (0.15-b_scalp)이 목 윗링보다 <b>위</b>로 올라와 목과 머리 사이가 벌어진다.
     그래서 같은 <b>정규화 높이</b>를 그려지는 두개골의 반경에 다시 적용한다 —
     새 상수를 만드는 게 아니라 기준면만 바꾸는 것이라 위치 관계는 그대로다.
     ⚠ headPhiToMeshY 자체는 안 건드린다. 그건 실측 밴드(두상 단면·목 단면)가
       헤어 실루엣 위에서 재는 자라서 헐이 맞다 — 표시용과 실측용은 다르다. */
  const skullD = getDisplaySkullEllipsoid();
  const neckTopY = Math.cos(PHI_MAX) * skullD.b * 1.01 + 0.15;
  const neckBotY = getNeckBottomY(); // 턱에서 8cm — 예전엔 -1.15 고정이었다(배너 참고)

  // (2026-07-17) "원뿔(전등갓) 목" 수정 — personMask 실측에 어깨/턱이 섞이면
  /* (2026-09-05) 여기 있던 headA·headC 클램프(폭 22~55%·깊이 22~70%)를 지웠다 —
     그 비대칭이 이번에 고친 "앞뒤로 넓은 목"의 원인이었고, 밑동을 cm로 내는 지금은
     부르는 곳이 없다. 원칙 (4)에 따라 주석으로 박제하지 않고 지운다. */
  const clamp = (v,lo,hi)=>Math.min(hi, Math.max(lo, v));

  /* 옷깃 실측이 있으면 그것만 쓴다 — 아래 링이 곧 옷깃 구멍이고, 위 링은 거기서
     해부학적 비율로 좁힌 값이다(머리는 어느 쪽에도 안 들어온다). 없으면 예전
     실측·클램프 경로로 폴백. */
  const G = NECK_SHAPE.fromGarment ? _garmentNeckOpening : null;
  let baseW = G ? G.halfWidth * NECK_SHAPE.inset : null;
  let baseD = G ? G.halfDepth * NECK_SHAPE.inset : null;
  /* cm → 메쉬단위 환산자. 옷깃 경로든 두상 경로든 둘 다 이 자를 쓴다. */
  let cmPerUnit = 16.4;
  try{ const r = faceRulerCmPerUnit(getFaceMetrics()); if(r && r.x > 1) cmPerUnit = r.x; }catch(e){}
  if(!G){
    /* ── 두상 자로 목을 낸다 (2026-09-05) — 위 NECK_SHAPE 배너 참고 ──────────
       폭과 깊이를 <b>같은 방식</b>으로 낸다. 예전 폴백은 폭 0.55×a · 깊이 0.70×c로
       계수도 축도 달라서, 앞뒤로만 부푸는 목이 나왔다. */
    baseW = (NECK_SHAPE.baseWCm / 2) / cmPerUnit;
    baseD = (NECK_SHAPE.baseDCm / 2) / cmPerUnit;
  }
  /* 난간 — 자가 튀었을 때만 잡힌다(옷깃 경로에서는 옷이 넓어지는 것도 잡는다). */
  {
    const loHalf = (NECK_SHAPE.minBaseCm/2) / cmPerUnit;
    const hiHalf = (NECK_SHAPE.maxBaseCm/2) / cmPerUnit;
    const capped = clamp(baseW, loHalf, hiHalf);
    if(Math.abs(capped - baseW) > 1e-4){
      console.log('[3D·목] 밑동 폭 ' + (baseW*2*cmPerUnit).toFixed(1) + 'cm → 난간으로 '
        + (capped*2*cmPerUnit).toFixed(1) + 'cm (허용 ' + NECK_SHAPE.minBaseCm + '~'
        + NECK_SHAPE.maxBaseCm + 'cm). ' + (G
          ? '옷깃 실측이 구멍이 아니라 테두리를 재고 있는 것.'
          : '값은 cm 상수인데 난간에 걸렸다 = <b>환산자가 튀었다</b>. 얼굴 랜드마크를 보십시오.'));
      baseD *= (capped / baseW);
      baseW = capped;
    }
  }
  console.log('[3D·목] 밑동 ' + (baseW*2*cmPerUnit).toFixed(1) + '×' + (baseD*2*cmPerUnit).toFixed(1)
    + 'cm (폭×깊이) · 기준 ' + (G ? '옷깃 실측' : '<b>두상 자</b>(cm 상수 ÷ 얼굴 환산자 '
    + cmPerUnit.toFixed(1) + 'cm/단위)') + ' · 둘레 약 '
    + (Math.PI * (baseW + baseD) * cmPerUnit).toFixed(0) + 'cm');
  const neckLen = Math.max(1e-4, neckTopY - neckBotY);

  const positions = [];
  const colors = [];
  const cBase = skinColor.clone();
  for(let ri=0; ri<=RING_STEPS; ri++){
    const t = ri/RING_STEPS;                 // 0 = 위(턱), 1 = 아래(옷깃)
    const y = neckTopY + t*(neckBotY-neckTopY);
    /* 위(턱)로 갈수록 좁아지는 테이퍼. 예전엔 옷깃이 없으면 이 자리에서
       interpolateNeckCrossSection(사진 실측)을 폭 0.55×a · 깊이 0.70×c로 클램프해
       썼는데, 그 비대칭이 곧 "앞뒤로 넓은 목"이었다(위 배너). 이제 밑동을 cm로
       내므로 두 경로가 하나다 — 실측 단면은 자기 축이 뭔지 못 밝혀서 뺐다. */
    const halfWidth = baseW * (NECK_SHAPE.taperW + (1-NECK_SHAPE.taperW)*t);
    const halfDepth = baseD * (NECK_SHAPE.taperD + (1-NECK_SHAPE.taperD)*t);
    // 앞으로 기울임 — 위 링일수록(t=0) 앞으로. 사람 목은 수직이 아니다.
    const cz = NECK_SHAPE.tiltZ * neckLen * (1 - t);
    // 승모근 — 아래쪽 뒤편만 부풀린다(위로 갈수록 1로 수렴).
    const nape = 1 + (NECK_SHAPE.napeFull - 1) * t;
    for(let ti=0; ti<=THETA_STEPS; ti++){
      const theta = -Math.PI + (2*Math.PI)*(ti/THETA_STEPS);
      // scalpPointToWorld와 동일한 관례: theta=0에서 z(깊이) 최대, theta=π/2에서 x(폭) 최대
      const ct = Math.cos(theta), st = Math.sin(theta);
      const x = st * halfWidth;
      const z = ct * halfDepth * (ct < 0 ? nape : 1) + cz;
      positions.push(x, y, z);
      /* 무조명이라 형태가 스스로 안 드러난다 — 정점색으로 최소한의 입체감을 굽는다.
         앞(ct=1)이 제일 밝고 뒤가 어둡다. 위(턱 밑)는 원래 그림자 지는 자리라
         살짝 눌러서 사진 턱과의 이음매를 덮는다. */
      const face = (ct + 1) / 2;                                   // 0=뒤, 1=앞
      const k = (NECK_SHAPE.shadeRear + (1-NECK_SHAPE.shadeRear)*face)
              * (NECK_SHAPE.shadeTop + (1-NECK_SHAPE.shadeTop)*t);
      colors.push(cBase.r*k, cBase.g*k, cBase.b*k);
    }
  }
  const indices = buildRingGridIndices(RING_STEPS, THETA_STEPS); // buildHeadMesh와 동일한 인덱스 패턴(권취 방향도 동일) — 공용 함수로 정리
  // 바닥 캡: 두상 쪽(윗단)은 buildHeadMesh 최하단 링과 y가 같아 맞물리므로
  // 캡 불필요. 아랫단(어깨쪽, neckAttachPoint)은 지금 화면(두상+목 단독
  // 테스트 — 아직 의상이 안 붙음)에서 뻥 뚫린 구멍으로 보이는 것을 막기
  // 위해 중심점 하나를 추가해 부채꼴로 막는다. 3단계에서 의상이 이 위에
  // 씌워지면 이 캡은 안 보이게 됨(문제 없음).
  const bottomCenterIdx = positions.length/3;
  positions.push(0, neckBotY, 0);
  // 정점색 배열은 position과 <b>길이가 같아야</b> 한다 — 캡 중심도 한 벌 넣는다.
  colors.push(cBase.r*NECK_SHAPE.shadeRear, cBase.g*NECK_SHAPE.shadeRear, cBase.b*NECK_SHAPE.shadeRear);
  const bottomRingStart = RING_STEPS*(THETA_STEPS+1);
  for(let ti=0; ti<THETA_STEPS; ti++){
    indices.push(bottomRingStart+ti, bottomCenterIdx, bottomRingStart+ti+1);
  }

  const neckGeo = new THREE.BufferGeometry();
  neckGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  neckGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));
  neckGeo.setIndex(indices);
  neckGeo.computeVertexNormals();
  const neckMesh = new THREE.Mesh(neckGeo, neckMat);
  neckMesh.name = 'neckAttachPoint'; // 3단계에서 의상 메시 정렬 기준점 — buildNeckMesh와 동일한 이름 유지
  return neckMesh;
}

// 절차적 두상: 타원(스케일된 구)으로 두상 근사. getFaceMetrics()가 뽑아낸 실측
// 종횡비/좌표 변환(projector)과 실제 두피색(skinColorCss)을 반영해서 "이 사람
// 사진에서 뽑을 수 있는 정보는 최대한 쓴" 근사치로 만든다. 여전히 진짜 3D
// 스캔은 아니고 절차적 근사(placeholder)라는 성격 자체는 그대로.
// (2026-07-12: 너무 길어서 다루기 힘들다는 지적으로 두상/목/귀/이목구비 4개
// 함수로 분리 — 각 부위 로직 자체는 한 글자도 안 바꾸고 그대로 옮김.)
function buildProceduralHead(skinColorCss){ // faceMetrics 인자 제거 — 내부에서 getFaceMetrics()로 다시 얻음
  const group = new THREE.Group();
  let skinColor = new THREE.Color(skinColorCss || '#E8C39E');
  // (2026-07-17) "검은 베레모"의 어두운 색 원인 방지: 샘플링된 두피색이
  // 지나치게 어두우면(머리카락 픽셀이 섞여 샘플된 경우) 살구톤으로 폴백 —
  // 두상이 헤어처럼 검게 칠해지는 것을 막음.
  if((skinColor.r + skinColor.g + skinColor.b) / 3 < 0.30) skinColor = new THREE.Color('#E0B294');
  const headMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.85, metalness: 0 });

  // (2026-07-17) "검은 베레모" 수정 — 기존 buildHeadMesh(실루엣 실측 단면
  // 스택)는 상부 단면 실측에 머리카락 실루엣이 섞여 두상 윗부분이 헤어
  // 폭만큼 옆으로 퍼졌음(베레모 모양의 진짜 원인). 두개골 표시는 헤어
  // 가닥·헐이 기준으로 쓰는 것과 동일한 실측 타원체(적도 반폭 a, 세로 b,
  // 반깊이 cD, 중심 y=0.15)로 교체 — 헤어 헐이 정의상 이 면 바깥에 있으므로
  // 두개골이 헤어 밖으로 삐져나올 수 없음. buildHeadMesh 함수 자체는
  // 이 파일 관례대로 참고용으로 남김(호출만 제거).
  /* (2026-08-17 c) getHeadEllipsoid() → getDisplaySkullEllipsoid().
     위 2026-07-17 주석의 "헤어 헐이 정의상 이 면 바깥에 있으므로 두개골이
     헤어 밖으로 삐져나올 수 없음"은 <b>그때는</b> 맞았다 — 그 시점엔 두피면이
     따로 없어서 헐과 두개골이 같은 값이었기 때문이다(그게 곧 "한 껍질" 문제).
     2026-08-01에 getScalpEllipsoid가 생기며 둘이 갈라졌는데 이 줄만 헐에
     남아 있었고, 그래서 최종 3D에서 살구색 구가 모발 겉면까지 부풀어
     가닥을 통째로 삼켰다. 상세는 getDisplaySkullEllipsoid 주석. */
  /* (2026-08-18) 그리는 구만 <b>뿌리 면 안쪽</b>으로 — 근거는 HAIR_SCALP3D.drawInset
     주석. 여기 scale에만 곱한다: getDisplaySkullEllipsoid가 돌려주는 값 자체를
     줄이면 얼굴 기준면·목 이음매까지 딸려 움직인다(8/17 c가 겪은 방식). */
  const skull = getDisplaySkullEllipsoid();
  const kIn = (HAIR_SCALP3D.applyToHead && HAIR_SCALP3D.drawInset > 0)
            ? HAIR_SCALP3D.drawInset : 1;
  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 36), headMat);
  headMesh.scale.set(skull.a*kIn, skull.b*kIn, skull.c*kIn);
  headMesh.position.set(0, 0.15, 0);
  headMesh.name = 'skullEllipsoid';
  group.add(headMesh);
  /* [진단] 그리는 구가 뿌리 면보다 얼마나 안쪽인가 — 이 여유가 0이면 가닥이
     구와 같은 평면이라 z-fighting으로 묻힌다(2026-08-18). 모발 두께와 나란히
     찍어서 "너무 파고들지도, 붙지도 않았는가"를 한 줄로 본다. */
  try{
    const hull = getHeadEllipsoid();
    const gapW = skull.a*(1-kIn), gapT = skull.b*(1-kIn);
    console.log('[3D·두개골 여유] 그리는 구 ×' + kIn
      + ' → 뿌리 면과의 틈 옆 ' + gapW.toFixed(4) + ' · 위 ' + gapT.toFixed(4) + ' 모델단위'
      + ' | 모발 두께 옆 ' + (hull.a-skull.a).toFixed(4) + ' · 위 ' + (hull.b-skull.b).toFixed(4)
      + '\n    틈이 0이면 <b>가닥이 구에 묻힙니다</b>(후두부 상단이 제일 먼저 — 거기가'
      + ' 가닥이 두피를 접선으로 제일 길게 타고 가는 자리라서).'
      + ' 틈이 모발 두께에 근접하면 반대로 구가 너무 안쪽이라 가닥 사이로 배경이 비칩니다.'
      + ' HAIR_SCALP3D.drawInset=1 로 두면 예전 동작.');
  }catch(e){}

  // 버그 수정(2026-07-14, 계속) → 재추가(같은 날, 실측 목 메쉬로 교체):
  // 실기기 피드백 "목이랑 그 위쪽으로 연결된 부위가 중간에 버티고 있어서
  // 걸린다, 저기에 의지하고 있는 게 없다"를 받고 한 번은 완전히 뺐었음
  // (buildNeckMesh가 고정 반지름 원통이라 "아무 근거 없이 뜬 막대"처럼
  // 보였던 게 진짜 원인 — neckAttachPoint 자체가 문제가 아니라 실측 없는
  // 임의 형태였던 게 문제). 이후 사용자 요청: "목과 잠깐 배제해놓은
  // 안면부위들 3D에 적용해줘" — extractHairMask STEP 1.5(personMask)로
  // 그 사람 실제 목/어깨 실루엣을 재서 buildRealNeckMesh(위, 실측 단면
  // 기반)로 교체 재추가. 이제는 "아무 근거 없이 뜬 막대"가 아니라 그 사람
  // 사진에서 실측한 폭/깊이를 반영한 형태라 다시 붙여도 된다는 판단.
  // buildOutfitPlaceholderMesh 등 나머지 코드는 neckMesh 객체를 직접
  // 참조하지 않고 고정 좌표(y=-1.15)만 쓰므로(코드 전수 확인 완료) 이
  // 교체는 3단계 의상 부착 로직에 영향 없음.
  // ⚠ 정직한 한계: 아직 실기기 재확인 전. personMask 실측이 실패한
  // 경우(bodySegmenter 로드 실패 등) computeNeckCrossSections의 최후
  // 폴백(예전 고정 반지름)으로 자동 전환되므로 최악의 경우에도 예전
  // 수준으로만 돌아갈 뿐 깨지지는 않지만, 실측이 잘 됐을 때와 폴백일 때
  // 시각적 차이가 있는지는 실기기에서 확인 필요.
  const neckMesh = buildRealNeckMesh(skinColor);
  group.add(neckMesh);

  // 버그 수정(2026-07-14): 귀 메쉬 제거 — "얼굴이랑 뒤통수 사이에 살구색
  // 덩어리가 붙어있다"는 실기기 피드백의 정체가 이거였음. buildEarMeshes는
  // 오늘/어제 작업(실측 두상 단면, 얼굴 랜드마크 메쉬)과 무관하게 훨씬 예전
  // (3D 처음 만들 때)부터 있던 코드로, 실측 귀 형태가 아니라 임의로 뭉갠
  // 작은 구 두 개일 뿐이고 Z좌표도 고정값(0.02, 앞뒤 거의 정중앙)이라
  // 위치도 부정확했음. 실측 기반이 아닌 임의 덩어리라 위치를 고치는 대신
  // 제거하는 쪽으로 결정(사용자 승인).
  // buildEarMeshes(widthFactor, heightFactor, projector, lm, headMat).forEach(ear=>group.add(ear));

  // (2026-07-17 정리) 절차적 이목구비(buildFaceDetailGroup)는 씬에 추가되지
  // 않는 그룹을 만들어 visible만 껐다 켜던 완전한 잔재라 함수째 삭제 —
  // 얼굴은 buildRealFaceMesh(실측 468 랜드마크)/buildFacePhotoDecal(폴백)이 담당.
  return { group, headMesh };
}

function loadImageAsync(src){
  return new Promise((resolve,reject)=>{
    const img = new Image();
    img.onload = ()=>resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// 실측 촬영 사진(state.shots.front) 자체를 두상 앞면에 얇게 띄운 평면에
// 입혀서 "그 사람 얼굴처럼 보이는" 효과를 낸다. 구면에 직접 UV 투영하는
// 진짜 텍스처 매핑은 왜곡·이음새 위험이 커서 채택하지 않음 — 대신 캔버스
// 상에서 destination-in + radial gradient로 가장자리를 페더 처리해 두상
// 피부색과 하드엣지 없이 섞이게 함. 위치/크기는 makeFaceProjector와 동일한
// 실측 기준점(눈/귀/턱)으로 정렬하므로 촬영 각도·얼굴 크기가 달라도 자동
// 정렬됨. 알려진 한계: 평면이라 옆모습으로 회전하면 거의 안 보임(정면
// 전용 효과) — 나중에 진짜 두상 3D 스캔(.glb)으로 바뀌면 이 로직 자체가
// 통째로 필요 없어짐.
/* ── 진짜 3D 얼굴 메쉬(2026-07-13 착수, 같은 날 재작업) ──
   지적: "얼굴이 중요하지" — 지금까지 buildFacePhotoDecal()은 평면 사진 한
   장을 두상 표면에 살짝 띄운 것(그래서 옆에서 보면 거의 안 보임). 실제로는
   MediaPipe가 468개 랜드마크 전부에 x,y,z(깊이)를 주는데 그중 10여 개
   이름 붙은 점만 뽑아 쓰고 나머지는 버리고 있었음. 여기서부터 실제로
   468개 전부와, MediaPipe 공식 삼각형 연결정보(FACE_MESH_TRI_V, 위쪽에서
   canonical_face_model.obj를 직접 받아 파싱)를 써서 그 사람 실제 얼굴
   입체 형태를 반영한 진짜 3D 메쉬를 만든다.
   UV(텍스처 좌표)는 FACE_MESH_UV(캐노니컬 모델 자체의 uv — 표준 "얼굴 펼침"
   참조 텍스처용, 우리처럼 그 사람 실제 사진을 그대로 씌우는 경우엔 안 맞음)
   대신, 각 랜드마크 "자기 자신의 이미지 좌표"를 그대로 UV로 씀.

   ── 재작업(같은 날, 실기기 확인 후) ──
   1차 버전은 깊이(z)를 "고정 상수(Z_BASE) + 실측 굴곡"으로만 계산했는데,
   실기기에서 얼굴 전체가 두상(타원체)에서 한참 동떨어져 붕 뜬 채로 나옴
   — 미세 보정 문제가 아니라 애초에 "두상이 실제로 어디 있는지"와 무관한
   임의의 상수를 썼던 게 근본 원인("추정하지 말고 두상 좌표값을 직접
   비교해서 위치를 잡아라"는 지적).
   해결: buildHeadMesh가 두상을 만드는 실제 수식 — 단위구를
   (0.78·wf, 1·hf, 0.85·wf)로 스케일한 타원체, y로 0.15 이동 — 을 그대로
   가져와서, 각 랜드마크의 실측 (x,y) 위치에서 "그 타원체 표면이 실제로
   어디 있는지"(surfaceZ)를 역산(귀 배치 buildEarMeshes가 이미 같은
   방식으로 표면 반경을 역산하던 것과 동일한 원리, 다만 여기선 X,Y 둘 다
   고려한 완전한 버전). 그 다음 "얼굴을 두상 위에 별도로 얹는" 대신,
   "경계(귀·이마 언저리)에서는 두상 표면에 정확히 붙고, 중심(코 등)으로
   갈수록 실측 굴곡이 살아나게 이어붙이는" 방식으로 재설계 — 사용자 지시:
   "얼굴메쉬와 헤어입체이미지도 결국 조합할 거니, 지금의 타원형 두상
   한 덩어리처럼 취급되게 하라". 경계 필터링에 이미 쓰던 타원(0=중심,
   1=경계)의 거리 제곱을 그대로 블렌드 가중치로 재사용(경계에서 정확히
   0이 되어 두상 표면값과 매끄럽게 이어짐, 새 파라미터 추가 없음):
     surfaceZ(그 점의 실제 두상 표면 위치) + blendWeight(중심=1~경계=0) × reliefZ(실측 굴곡)
   ※ 그래도 남는 한계: reliefZ 자체의 부호/배율(Z_SIGN/Z_DEPTH_SCALE)은
   MediaPipe 공식 문서 기준으로 정한 것이라 브라우저에서 실제로 렌더링해
   봐야 최종 확인 가능. */
/* 얼굴이 <b>어떻게</b> 붙었는지의 기록 (2026-08-22). 스틸 한 장으로는 입체 메쉬와
   평면 데칼을 못 가른다 — 돌려 봐야 안다. 그래서 숫자로 남긴다.
   진단정보 패널 맨 위에 같이 찍는다(폰엔 콘솔이 없다). */
/* (2026-08-31) 세 칸 추가 — sideYaw/reliefGain/reliefCm.
   "판때기" 진단에 필요한 것은 <b>얼마나 평평한가</b>가 아니라 <b>왜 평평한가</b>였다.
   zRange만 보면 원인이 ① 측면 실측이 굴곡을 덮어썼다 ② 굴곡 자체가 작다 중
   어느 쪽인지 못 가른다 — 그래서 그 둘을 각각 숫자로 남긴다. */
const FACE_BUILD = { path: '-', why: '', zRange: null, zMin: null, zMax: null,
                     sideHits: 0, ellA: null, ellC: null,
                     sideYaw: {}, reliefGain: null, reliefCm: null, cmPerUnit: null };
async function buildRealFaceMesh(faceMetrics){
  FACE_BUILD.sideYaw = {}; FACE_BUILD.reliefGain = null;
  FACE_BUILD.reliefCm = null; FACE_BUILD.cmPerUnit = null;
  const lm = faceMetrics.lm;
  const src = state.shots && state.shots.front;
  // rawLandmarks가 없으면(폴백 추정 랜드마크 등, 예전 세션 캐시 데이터 포함)
  // 스킵 — 호출부에서 buildFacePhotoDecal로 자동 대체됨(신규 실패 모드 아님).
  /* ⚠ 여태 여기서 <b>조용히</b> 빠져나갔다. 그러면 화면엔 평면 데칼이 걸리는데
     로그도 화면 표시도 없어서, 사용자는 "3D 얼굴"을 보고 있다고 믿게 된다.
     이유를 남기고 나간다. */
  if(!src){ FACE_BUILD.path = 'decal'; FACE_BUILD.why = '정면 사진 없음';
            console.warn('[얼굴] 입체 메쉬 스킵 — 정면 사진 없음 → 평면 데칼'); return null; }
  if(!lm.rawLandmarks || lm.rawLandmarks.length < 468){
    FACE_BUILD.path = 'decal';
    FACE_BUILD.why = '랜드마크 원본 ' + (lm.rawLandmarks ? lm.rawLandmarks.length : 0) + '개(468 필요)';
    console.warn('[얼굴] 입체 메쉬 스킵 — ' + FACE_BUILD.why + ' → <b>평면 데칼</b>');
    return null;
  }

  let img;
  try{ img = await loadImageAsync(src); }
  catch(e){ FACE_BUILD.path = 'decal'; FACE_BUILD.why = '사진 로드 실패';
            console.warn('실제 얼굴 메쉬용 이미지 로드 실패:', e); return null; }

  const raw = lm.rawLandmarks;
  const vertCount = 468;
  const projector = faceMetrics.projector;
  const widthFactor = faceMetrics.widthFactor, heightFactor = faceMetrics.heightFactor;

  // 얼굴 메쉬 Z(깊이)는 두상 타원 방정식 ellipsoidZ로 구한다 — getHeadEllipsoid의
  // 반경(a,b,c)을 쓰므로 두상 돔·헤어 투영면과 정확히 같은 표면 위에 얹힌다
  // (얼굴-두피 경계가 어긋나지 않는 이유). 이 방정식은 머리카락 유무와 무관하게
  // 모든 (x,y)에서 정의되므로 턱처럼 실측이 없는 높이에서도 특이값이 안 생긴다.
  // ※ 교훈(좌표 규약 참고): front 얼굴 메쉬에는 실측 회전을 적용하지 않는다 —
  //   두상 시스템 전체가 front를 곧 월드 기준으로 취급하므로, 여기에 회전을
  //   또 걸면 이중 적용이 돼 "코가 목 위 막대기 끝에 매달린" 회귀가 났었다.
    const { a: ELL_A, b: ELL_B, c: ELL_C } = getHeadEllipsoid();
  // 얼굴 전용 타원 폭: 전역 ELL_A는 두상 적도(이 사람은 턱 높이라 좁게 잡힘)에서
  // 나오는데, 얼굴 메쉬는 관자놀이까지 그보다 넓게 퍼진다. ELL_A가 얼굴보다 좁으면
  // 얼굴 바깥 정점이 ellipsoidZ의 "타원 밖(inside>1)" 분기로 빠져 z≈0(평평한 옆벽)이
  // 돼 옆으로 펼쳐진다(실기기 증상). → 얼굴의 실제 최대 폭(아래 pre-pass에서 측정)까지
  // 폭을 넓혀 얼굴이 곡면을 타고 감기게 한다. 전역 두상/스컬/헤어 투영은 그대로 유지.
  // (12차) 얼굴 타원 폭을 두상 폭 쪽으로 얼마나 되돌릴지 — 아래 widened 주석 참고.
  // ⚠ const는 TDZ가 있어 <b>쓰는 곳보다 위</b>에 있어야 한다(같은 함수 스코프다).
  const FACE_WIDTH_FIT = { blend: 1.0 };
  let ellAForFace = ELL_A;
  function ellipsoidZ(localX, yLocal){
    const inside = (localX/ellAForFace)*(localX/ellAForFace) + (yLocal/ELL_B)*(yLocal/ELL_B);
    return ELL_C * Math.sqrt(Math.max(0.02, 1 - Math.min(1, inside))); // 완전히 벗어난 점도 살짝의 표면값은 갖게(0 방지)
  }

  // 깊이(z) 굴곡 부호: MediaPipe 공식 문서 기준 "z가 작을수록(더 음수) 카메라에
  // 가까움" — 우리 좌표계는 +Z가 보는 사람 쪽이라 이론상 -1이 맞음. 이전
  // 세션엔 옛 headSurfaceZ 기준 실기기 테스트에서 "코가 함몰돼 보인다"며 1로
  // 뒤집었었는데, 이번엔 그 자리를 ellipsoidZ로 교체한 뒤 실기기에서 정반대로
  // "코가 안으로 들어갔다"는 피드백 — 즉 부호가 맞는 함수가 바뀌었으므로
  // 이론값(-1)으로 되돌림.
  /* 얼굴 z 보정 스위치 (2026-08-18 k-4) — matchBaseline은 frontEstimatedZOf 주석 참고. */
  const FACE_Z_FIX = { matchBaseline: true };
  const Z_SIGN = -1;
  const Z_DEPTH_SCALE = 1.0; // 굴곡이 너무 약하거나 세면 조정

  /* ── 얼굴을 <b>그려지는 두개골</b> 위로 (2026-08-17 c) ────────────────────
     위에서 두개골 구를 헐(머리카락 겉면) → 두피면으로 줄였다. 얼굴 z의 <b>기준면</b>은
     여전히 ELL_C(헐 깊이)라서, 그대로 두면 얼굴만 모발 두께만큼(실기기 환산 약 3.6cm)
     앞에 뜬 채 남는다 — 두개골을 고치다가 얼굴을 띄우는 새 버그를 만드는 셈이다.
     그래서 <b>기준면 성분만</b> 같은 비율로 옮긴다:
         localZ = ellipsoidZ×k + 굴곡 + 측면보정      (k = 두개골 깊이 / 헐 깊이)
     · 기준면만 곱하는 이유 — 굴곡(MediaPipe relief)과 측면 실측 보정은 "기준면에서
       얼마나 벗어났는가"라는 <b>잔차</b>다. 잔차까지 k배 하면 코가 29% 납작해진다
       (이 파일의 미해결 목록에 "얼굴이 평평"이 이미 있다 — 그 반대로 가야 한다).
     · frontEstimatedZOf는 <b>안 건드린다</b>. 거기서 나오는 deltaZ는 realZ와 같은
       헐 기준에서 뺀 잔차라, 여기서 k를 안 태워야 잔차의 의미가 유지된다.
       (만약 ellipsoidZ 자체를 줄였다면 deltaZ가 정확히 그만큼 커져서 측면 실측이
        있는 정점 222/468개만 도로 헐로 끌려간다 — 얼굴이 두 조각으로 찢어진다.)
     · ELL_A/ELL_B는 그대로 둔다. ELL_B를 두피면 세로로 줄이면 턱 정점의
       (yLocal/ELL_B)가 1에 닿아 ellipsoidZ가 0 바닥으로 붕괴한다(=위 주석의
       "옆벽 splay"가 세로로 재현). 폭 확장 로직과 같은 이유로 손대지 않는다.
     applyToHead=false면 k=1 — 예전과 <b>산술까지 동일</b>하다. */
  let FACE_Z_TO_SKULL = 1;
  try{
    const _sk = getDisplaySkullEllipsoid();
    if(_sk && ELL_C > 1e-6 && _sk.c > 0) FACE_Z_TO_SKULL = _sk.c / ELL_C;
  }catch(e){}

  // ── 경계 타원(얼굴 중심~바깥) — 필터링과 블렌드 가중치 둘 다에 재사용 ──
  // 귀·관자놀이처럼 정면 사진에서 옆으로 많이 꺾인 부분은 원근 때문에 아주
  // 좁은 픽셀 폭에 눌려 찍히므로, 잘 찍힌 얼굴 중심부만 메쉬로 살린다.
  const eyeCX = ((lm.features?.leftEye ? (lm.features.leftEye.minX+lm.features.leftEye.maxX)/2 : 0.5)
               + (lm.features?.rightEye ? (lm.features.rightEye.minX+lm.features.rightEye.maxX)/2 : 0.5)) / 2;
  const boundCX = lm.features ? eyeCX : 0.5;
  const boundTopY = (lm.browTopY ?? 0.28) * 0.90;
  const boundBotY = (lm.chinY ?? 0.60) * 1.10;
  const boundCY = (boundTopY + boundBotY) / 2;
  const boundRY = Math.max(0.05, (boundBotY - boundTopY) / 2 * 1.08);
  const boundRX = Math.max(0.05, Math.abs((lm.rEarX ?? 0.78) - (lm.lEarX ?? 0.22)) * 0.56 * 1.08);
  function distSqFromBound(idx){
    const p = raw[idx];
    const dx = (p.x - boundCX) / boundRX, dy = (p.y - boundCY) / boundRY;
    return dx*dx + dy*dy; // 0=정중앙, 1=경계선 위, 1보다 크면 경계 밖
  }
  function inFaceBound(idx){ return distSqFromBound(idx) <= 1; }

  // ── 얼굴 전용 타원 폭 확정 (splay 방지) ──
  // 실제 메쉬에 들어가는(경계 안) 정점들의 localX 최대치를 재서, ELL_A가 그보다
  // 좁으면 얼굴 폭(+3% 여유)까지 넓힌다. 이러면 모든 얼굴 정점이 타원 안(inside≤1)에
  // 들어와 곡면을 타고 감긴다. yLocal도 세로로 벗어나면 같은 옆벽이 생기므로 함께 반영.
  {
    let faceMaxX = 0, faceMaxY = 0;
    for(let i=0;i<vertCount;i++){
      if(!inFaceBound(i)) continue;
      const p = raw[i];
      const lx = Math.abs(projector.toMeshX(p.x));
      const ly = Math.abs(projector.toMeshY(p.y) - 0.15);
      if(lx > faceMaxX) faceMaxX = lx;
      if(ly > faceMaxY) faceMaxY = ly;
    }
    /* ── 얼굴이 두상보다 <b>넓은 타원</b>에 감긴다 (2026-08-31 12차) ───────────
       사용자: "폼파두르 적용 버전을 보니까 얼굴이 원래 두상타원에서 좀 뜨네."
       원인은 이 줄이다. 얼굴 메쉬는 여기서 넓힌 ellAForFace에 감기는데, 실제로
       <b>그려지는</b> 두개골·두피·헤어 투영은 전부 원래 ELL_A를 쓴다(바로 아래
       주석이 "전역 두상/스컬/헤어 투영은 그대로 유지"라고 스스로 적어 놨다).
       두 면이 다르면 얼굴이 두상 실루엣 밖으로 부풀어 <b>뜬 것처럼</b> 보인다 —
       한 값(두상 폭)을 두 곳이 각자 쓰는, 이 파일 작업원칙 (3)의 위반이다.

       지금 당장 ELL_A로 되돌리면 <b>옆벽 splay</b>가 되살아난다(관자놀이 정점이
       타원 밖으로 나가 z가 바닥쳐 옆으로 펼쳐진다 — 위 주석의 그 증상). 그래서
       두 실패 사이를 잇는 손잡이를 둔다:
         blend = 1 → 지금까지와 <b>산술까지 동일</b>(얼굴 폭까지 넓힘, splay 없음, 뜸)
         blend = 0 → 두상과 같은 폭(안 뜸, splay 위험)
       실기기에서 뜨는 정도를 보고 이 숫자 하나만 내리면 된다. 근본 해결은 두상
       폭 자체를 얼굴 실측까지 넓히는 것인데, 그건 헤어 투영·두피면까지 같이
       움직이는 일이라 별도 항목으로 둔다. */
    const widened = ELL_A + (Math.max(ELL_A, faceMaxX * 1.03) - ELL_A) * FACE_WIDTH_FIT.blend;
    console.log('[진단·얼굴폭] ELL_A(두상 적도폭)='+ELL_A.toFixed(3)
      +' | 얼굴 실제 최대폭='+faceMaxX.toFixed(3)
      +' → 얼굴 타원폭='+widened.toFixed(3)
      +(widened>ELL_A+1e-4 ? ' (넓혀서 splay 방지)' : ' (변화 없음)')
      +' | 얼굴 최대세로='+faceMaxY.toFixed(3)+' vs ELL_B='+ELL_B.toFixed(3));
    ellAForFace = widened;
  }

  // ── 좌/우 측면 사진 기반 코/턱/이마 깊이(Z) 실측 보정(2026-07-14 추가) ──
  // 사용자 요청: "측면 사진의 z값등의 정보를 이용해서 안면세부조정하는 기능을
  // 추가해봐" — 이전 세션에 "좌/우 사진으로 깊이 실측 보정(추천)"으로 골라
  // 뒀다가 목/정수리 버그가 우선순위에서 앞서 미뤄뒀던 바로 그 작업.
  // 배경: 위 reliefZLocal(=Z_SIGN*p.z*...)은 front 사진 한 장에서 MediaPipe가
  // 추정한 z값을 쓰는데, 이건 모노큘러(단안) 추정치라 "코가 실제로 얼마나
  // 튀어나왔는지" 같은 절대 돌출량은 원래 부정확하기로 알려져 있음(2D 이미지
  // 한 장만으로는 깊이가 근본적으로 모호함 — 이게 정면 얼굴 사진만으로 깊이를
  // 재는 것의 이론적 한계).
  // 반면 좌/우 측면 사진에서는 다름 — 카메라를 옆에서 보고 있으니 얼굴의
  // 앞뒤 깊이(코가 얼마나 앞으로 나왔는지)가 이미지의 좌우 위치로 "직접"
  // 나타남(정면에서는 안 보이던 정보가 옆에서는 보임). 이 원리는 이미
  // projectImagePointToHead(헤어 가닥 뿌리를 좌/우 실측 회전으로 투영하는,
  // 이미 실기기로 확인된 함수)가 쓰고 있는 것과 동일 — 그 함수를 그대로
  // 재사용해서 "코끝·턱끝·이마" 세 지점(이 파일이 이미 detectFaceLandmarks
  // 에서 nose/chin/forehead로 쓰는 바로 그 랜드마크 인덱스 1/152/10 — 새
  // 인덱스를 추측하지 않고 이미 검증된 것만 사용)의 좌/우 사진 속 실제
  // 위치를 실측 회전으로 월드 좌표까지 투영해서 "실측 Z"를 얻는다.
  // 이 실측 Z와, 지금 이 함수가 정면 사진만으로 그 같은 지점에 매기고 있는
  // Z(=ellipsoidZ+reliefZLocal) 사이의 차이(deltaZ)를 계산해서, 그 지점
  // 주변에만(가우시안 감쇠) 국소적으로 더해준다 — 코 하나만 실측이 어긋나도
  // 얼굴 전체가 아니라 코 주변만 밀리게.
  // ⚠ 정직한 한계: (1) 좌/우 사진 둘 다 없거나 포즈 신뢰도가 낮으면(옆모습이
  // 잘 안 찍혔거나 랜드마크 감지 실패) 그 지점은 조용히 보정을 건너뛰고
  // 기존 방식 그대로 씀 — 실패해도 깨지지 않음. (2) 그림자·안경·헤어 등으로
  // 측면 랜드마크 자체가 부정확할 수 있어, 위 목(neck) 버그 때와 같은
  // 이유로 deltaZ를 ±0.6*ELL_C로 clamp해서 오탐이 코를 스파이크처럼
  // 튀어나오게 만드는 것을 막음. (3) 아직 실기기 재확인 전.
  const PROFILE_DEPTH_ANCHORS = [
    { idx: 1,   label: '코끝' },   // detectFaceLandmarks의 nose=lm[1]과 동일 인덱스
    { idx: 152, label: '턱끝' },   // 〃 chin=lm[152]
    { idx: 10,  label: '이마' },   // 〃 forehead=lm[10]
  ];
  const PROFILE_DEPTH_FALLOFF_SIGMA = 0.18; // 보정 영향 반경(메쉬 로컬 단위) — ELL_A(대략 0.3~0.4)의 절반 수준

  // ── (2026-07-19) 측면 실측 깊이를 얼굴 "전체 정점"으로 확장 ──
  // 사용자 지적: outputFacialTransformationMatrix(실측 회전)를 헤어에는 4장
  // 전부 적용하면서 얼굴은 front 단안 z만 쓰고 측면 실측은 코·턱·이마 3점에만
  // 쓰고 있었음 — "안 쓸 거면 헤어처럼 전체를 같은 방식으로 통합하면 연결부위
  // 문제가 없다". 그 통합의 올바른 형태: front 자체엔 회전을 걸지 않되(막대기
  // 버그 방지 — front는 월드 기준 유지), 깊이(z)만은 465개 나머지 정점도
  // 좌/우 측면 실측(projectImagePointToHead, 헤어와 동일 경로)으로 받아온다.
  // 안전장치는 3앵커 버전과 동일하게 전 정점에 적용:
  //   · 측면 신뢰도<0.5(어림 각도)면 그 뷰 스킵
  //   · 측면 투영이 타원 밖(귀 너머 등)이면 그 정점 스킵(null 반환)
  //   · 좌/우가 크게 어긋나면(오탐) 그 정점 스킵
  //   · deltaZ는 ±0.6*ELL_C로 clamp(스파이크 방지)
  //   · 측면 실측이 없는 정점은 조용히 front 방식 유지(실패해도 안 깨짐)
  // 3앵커 방식(가우시안 확산)과 달리 정점별 직접 실측이라, 실측이 있는
  // 정점은 그 값을 직접 쓰고 없는 정점만 front로 폴백 — 확산 겹침이 없다.
  // 반환: 정점 idx → deltaZ 맵(Float32Array, NaN=측면 실측 없음→front 유지).
  const USE_FULL_PROFILE_DEPTH = true; // 문제 생기면 false로 → 기존 3앵커 방식
  let _fullProfileHitCount = 0; // [진단용] 측면 실측이 실제 적용된 정점 수
  /* ── (2026-07-26 중복 통합) 측면 실측 깊이 공통 로직 ──────────────────
     computeFullProfileDepthMap(전 정점)과 computeProfileDepthCorrections(3앵커)이
     "정면 추정 Z 계산 → 좌/우 실측 Z 수집 → 모순 검사 → 신뢰도 가중 평균"이라는
     같은 절차를 각자 복제하고 있었다. 식·상수·판정 임계 전부 동일했으므로 아래
     3개로 뽑아 양쪽이 같이 쓴다. 동작 변경 없음.
     ※ usableSideViews는 루프 중 state가 안 바뀌므로 한 번만 구해 공유해도 동일. */
  /* ── 측면 깊이를 <b>믿을 수 있는 각도</b>인가 (2026-08-31) ────────────────────
     여태 이 게이트는 getViewPoseConfidence만 봤다. 그런데 그 값이 말하는 것은
     "포즈 행렬이 PnP로 풀렸는가"이지 "<b>깊이를 잴 만큼 돌아갔는가</b>"가 아니다 —
     정면에 가까운 사진도 랜드마크만 잘 잡히면 신뢰도가 그냥 1.00으로 나온다.
     (이 손님 실기기 로그: left yaw <b>26.7°</b> 신뢰도 1.00 / right <b>−22.2°</b> 신뢰도 1.00.)

     그 각도에서 projectImagePointToHead가 돌려주는 z는 사실상 <b>두상 타원면 그 자체</b>다.
     옆으로 안 돌아갔으니 사진에 새 깊이 정보가 없고, 함수는 이미지 점을 두상 표면에
     쏘아 맞히는 일을 할 뿐이기 때문이다. 그런데 아래 합성은 실측이 있는 정점의 z를
     그 값으로 <b>덮어쓴다</b>(map[i] = 실측Z − 정면Z 를 더하면 최종 z = 실측Z).
     결과 — 코·이마 굴곡이 통째로 지워지고 얼굴이 타원면에 밀착한 <b>가면</b>이 된다.
     실기기에서 "얼굴이 판때기로 나온다"고 보이던 것이 바로 이것이다.
     경계 안 정점 468개 중 측면 실측이 걸리는 것이 200개 넘으므로, 얼굴 한가운데가
     통째로 이 경로를 탄다.

     이 파일은 <b>이미 알고 있었다</b> — 아래 [얼굴 z·항별] 로그 문구에 "깊이를
     재려면 80~90°가 필요합니다"라고 적어 놓고, 정작 게이트는 각도를 안 봤다.
     한쪽(로그)만 고쳐지고 다른 쪽(판정)은 안 고쳐진, 이 파일의 단골 모양이다.

     고침: 각도로 한 번 더 거른다. 35° 미만이면 그 뷰는 깊이용으로 아예 안 쓰고,
     35~55°는 선형으로 깎아 <b>부분만</b> 반영한다.
     ※ 상한을 55°로 잡은 이유(사용자 지적, 8/31): "45도 이상 되면 좀만 더 돌아가도
       <b>반대편 얼굴이 안 보여서</b>" — 즉 이 앱이 실제로 받을 수 있는 측면 사진은
       45°언저리가 천장이다. 이론상 이상적인 80~90°를 상한으로 잡으면 신뢰도가
       <b>영원히 1에 못 닿아</b> 게이트가 사실상 항상 걸린 것과 같아진다. 잴 수 있는
       범위 안에서 눈금을 매겨야 그 안의 차이가 의미를 갖는다.
     걸러진 경우 그 정점은 조용히 front 방식(타원면+굴곡)을 유지한다 — 예전에도
     측면이 없으면 그렇게 동작했으므로 새 실패 모드가 아니다.
     되돌리기: PROFILE_YAW_GATE.on = false */
  const PROFILE_YAW_GATE = { on: true, minDeg: 35, fullDeg: 55 };
  let _profileTrust = 0;   // [진단용] 실제로 먹은 측면 깊이 신뢰도(0~1)
  function usableSideViews(){
    const sides = ['left','right'].map(angle=>{
      const lmSide = state.landmarks && state.landmarks[angle];
      if(!lmSide || !lmSide.rawLandmarks || lmSide.rawLandmarks.length < 468) return null;
      const confidence = getViewPoseConfidence(angle);
      if(confidence < 0.5) return null;   // 어림 각도로는 이 보정에 부적합
      const yawAbs = Math.abs(getViewYawDeg(angle));
      const trust = PROFILE_YAW_GATE.on
        ? clamp((yawAbs - PROFILE_YAW_GATE.minDeg)
                / Math.max(1e-6, PROFILE_YAW_GATE.fullDeg - PROFILE_YAW_GATE.minDeg), 0, 1)
        : 1;
      FACE_BUILD.sideYaw[angle] = { yawAbs, trust };   // 진단 패널이 읽어 간다
      if(trust <= 0) return null;   // 이 각도로는 깊이를 못 잰다 → front 유지
      return { angle, raw: lmSide.rawLandmarks, confidence, trust };
    }).filter(Boolean);
    /* 가중평균은 신뢰도를 정규화해 버리므로(합으로 나눈다) trust를 confidence에
       섞으면 사라진다. 그래서 <b>보정량 자체</b>에 곱할 스칼라로 따로 들고 있는다. */
    _profileTrust = sides.reduce((m,s)=>Math.max(m, s.trust), 0);
    return sides;
  }
  /* 정면 사진만으로 매겼을 Z(비교 기준) + 그 지점의 메쉬 로컬 좌표
     ── ⚠ 이 값은 <b>아래 합성식과 글자 그대로 같아야</b> 한다 (2026-08-18 k-4) ──
     측면 보정은 절대값이 아니라 <b>차</b>로 저장된다: map[i] = 실측Z − frontZ.
     그리고 합성은 localZ = 기준면 + 굴곡 + map[i] 다. 그래서 여기서 뺀 기준과
     저기서 더하는 기준이 <b>같을 때만</b> localZ = 실측Z가 된다.
     그런데 2026-08-17 c가 합성식에만 FACE_Z_TO_SKULL(=두개골깊이/헐깊이)을
     곱하고 <b>이쪽은 안 곱했다</b>. 그러면 측면으로 잰 정점이
         실측Z − 타원면z×(1−k)
     에 앉는다. k=0.871이면 얼굴 한가운데(타원면z≈0.5)에서 <b>1.25cm 함몰</b>이다.
     실기기 로그의 "이마가 두상 표면보다 안쪽"이 이 몫이다.
     한 값(기준면)을 두 곳이 각자 쓰다가 한쪽만 고쳐진 것 — 작업원칙 (3) 그 자체이고,
     이 파일이 2026-08-09에 앵커/관측으로 똑같이 겪은 모양이다.
     되돌리기: FACE_Z_FIX.matchBaseline = false */
  function frontEstimatedZOf(p){
    const localX = projector.toMeshX(p.x);
    const yLocal = projector.toMeshY(p.y) - 0.15;
    const dx = (p.x - boundCX) / boundRX, dy = (p.y - boundCY) / boundRY;
    const frontBlend = Math.max(0, 1 - (dx*dx+dy*dy));   // distSqFromBound와 같은 식(확인함)
    const kBase = FACE_Z_FIX.matchBaseline ? FACE_Z_TO_SKULL : 1;
    return { localX, yLocal,
             frontZ: ellipsoidZ(localX, yLocal) * kBase + frontBlend * (Z_SIGN * p.z * projector.bX * Z_DEPTH_SCALE) };
  }
  // 좌/우 실측 Z의 신뢰도 가중 평균. 둘이 모순되거나 쓸 값이 없으면 null.
  // (좌/우가 서로 부호가 다르거나 크게 어긋나면 평균이 둘 다 못 믿는 값을 만든다 —
  //  "둘 다 안 믿는다"가 "잘못 합친 값을 믿는다"보다 안전)
  function sideMeasuredZ(idx, sides){
    const perView = [];
    for(const s of sides){
      const sidePt = s.raw[idx];
      if(!sidePt) continue;
      const world = projectImagePointToHead(s.angle, sidePt.x, sidePt.y, widthFactor, heightFactor);
      if(!world) continue;              // 타원 밖 → 이 뷰선 실측 불가
      perView.push({ z: world.z, confidence: s.confidence });
    }
    if(!perView.length) return null;
    if(perView.length === 2){
      const [a,b] = perView;
      const disagree = Math.abs(a.z - b.z) > 1.2*ELL_C || (a.z*b.z < 0 && Math.abs(a.z)>0.15*ELL_C && Math.abs(b.z)>0.15*ELL_C);
      if(disagree) return null;
    }
    const wSum = perView.reduce((s,v)=>s+v.confidence, 0);
    const zSum = perView.reduce((s,v)=>s+v.z*v.confidence, 0);
    return zSum / wSum;
  }
  function computeFullProfileDepthMap(){
    const map = new Float32Array(vertCount).fill(NaN);
    const sides = usableSideViews();
    if(!sides.length) return map; // 쓸 만한 측면 없음 → 전부 front 폴백
    for(let i=0;i<vertCount;i++){
      if(distSqFromBound(i) > 1) continue; // 얼굴 경계 밖(뺨 끝·귀)은 front 유지(측면서도 원근으로 뭉개짐)
      const realZ = sideMeasuredZ(i, sides);
      if(realZ === null) continue;         // 측면 실측 없음/모순 → front 유지(NaN)
      // (2026-08-31) 각도 신뢰도만큼만 반영 — 위 PROFILE_YAW_GATE 주석 참고.
      map[i] = clamp((realZ - frontEstimatedZOf(raw[i]).frontZ) * _profileTrust,
                     -0.6*ELL_C, 0.6*ELL_C);
      _fullProfileHitCount++;
    }
    return map;
  }
  function computeProfileDepthCorrections(){
    const out = [];
    const sides = usableSideViews();
    if(!sides.length) return out; // 좌/우 둘 다 없거나 신뢰도 낮음 — 보정 없이 기존 방식 유지
    PROFILE_DEPTH_ANCHORS.forEach(anchor=>{
      const { localX, yLocal, frontZ } = frontEstimatedZOf(raw[anchor.idx]);
      const realZ = sideMeasuredZ(anchor.idx, sides);
      if(realZ === null) return;    // 실측 불가/좌우 모순 — 이 지점은 보정 건너뜀
      out.push({ idx: anchor.idx, localX, yLocal,
                 // (2026-08-31) 전체맵과 <b>같은</b> 신뢰도 계수를 쓴다(두 경로가
                 // 갈리면 얼굴에 또 단차가 생긴다 — 아래 "세로 2줄" 항목 참고).
                 deltaZ: clamp((realZ - frontZ) * _profileTrust, -0.6*ELL_C, 0.6*ELL_C) });
    });
    return out;
  }
  const profileDepthCorrections = computeProfileDepthCorrections();
  const fullProfileDepthMap = USE_FULL_PROFILE_DEPTH ? computeFullProfileDepthMap() : null;
  /* 코끝(1)·턱(152)·이마(10)·미간(168)·왼뺨(234) 다섯 자리만 항별로 들여다본다.
     전 정점을 찍으면 로그가 못 읽을 만큼 길어지고, 이 다섯이면 앞뒤가 갈린다. */
  const _ZDBG = { 1:null, 152:null, 10:null, 168:null, 234:null };

  /* ── 굴곡 배율을 <b>cm 자</b>로 맞춘다 (2026-08-31) ──────────────────────────
     Z_DEPTH_SCALE = 1.0은 "MediaPipe z를 그대로 쓴다"는 뜻인데, MediaPipe의 z는
     <b>축척이 정의돼 있지 않다</b>(공식 문서도 "x와 대략 같은 축척"까지만 말한다).
     사람·촬영거리·모델 버전마다 진폭이 달라서 상수 하나로는 어떤 손님은 코가 서고
     어떤 손님은 안 선다 — 위 게이트를 고쳐 굴곡이 <b>지워지지 않게</b> 만들어도,
     남은 굴곡이 원래 작으면 화면은 여전히 판때기다.

     그래서 상수를 고정하지 말고 <b>결과를 재서</b> 맞춘다. 경계 안 정점의 굴곡
     분포에서 (상위 2% − 중앙값)을 "코가 뺨보다 얼마나 나왔나"로 보고,
     faceRulerCmPerUnit이 주는 cm/단위로 환산해서 목표(성인 평균 코 돌출 ≈2.0cm)에
     못 미치면 그만큼만 키운다.
     · <b>줄이지는 않는다</b>(gain ≥ 1) — 원래 충분히 나온 얼굴을 이 보정이 뭉개면
       안 된다. 이 함수가 고치려는 증상은 "평평하다" 한 방향뿐이다.
     · 상한 3배 — 잡티·안경 반사로 z가 튀는 얼굴에서 코가 폭발하는 것을 막는 안전선.
     · 중앙값을 기준으로 삼는 이유: 평균은 코 하나에 끌려간다. 얼굴 대부분은
       뺨·이마라 중앙값이 곧 "굴곡 0인 면"이다.
     ⚠ 이 배율은 <b>굴곡 항에만</b> 걸린다. 기준면(타원면)에 걸면 두상 자체가
       앞뒤로 늘어나 두피·헤어 투영면과 어긋난다(FACE_Z_TO_SKULL 주석과 같은 이유).
     되돌리기: FACE_RELIEF_FIX.on = false */
  const FACE_RELIEF_FIX = { on: true, targetCm: 2.0, maxGain: 3.0 };
  let reliefGain = 1, _reliefCmBefore = null;
  if(FACE_RELIEF_FIX.on){
    const rs = [];
    for(let i=0;i<vertCount;i++){
      if(!inFaceBound(i)) continue;
      rs.push(Z_SIGN * raw[i].z * projector.bX * Z_DEPTH_SCALE);
    }
    if(rs.length > 20){
      rs.sort((a,b)=>a-b);
      const med = rs[Math.floor(rs.length*0.50)];
      const hi  = rs[Math.floor(rs.length*0.98)];
      let cmPerUnit = 16.4;                       // 자 계산 실패 시 이 파일의 통상값
      try{ const r = faceRulerCmPerUnit(faceMetrics); if(r && r.x > 1) cmPerUnit = r.x; }catch(e){}
      _reliefCmBefore = Math.max(0, hi - med) * cmPerUnit;
      if(_reliefCmBefore > 0.05){
        reliefGain = clamp(FACE_RELIEF_FIX.targetCm / _reliefCmBefore, 1, FACE_RELIEF_FIX.maxGain);
      }
    }
  }

  const positions = new Float32Array(vertCount*3);
  const uvs = new Float32Array(vertCount*2);
  for(let i=0;i<vertCount;i++){
    const p = raw[i];
    // localX/yLocal: 두상 중심(0, 0.15, 0) 기준 로컬 좌표(회전 전) — projectImagePointToHead
    // 와 동일하게 "그 뷰가 정면이라고 가정했을 때"의 평면좌표를 먼저 구한다.
    const localX = projector.toMeshX(p.x);
    const yLocal = projector.toMeshY(p.y) - 0.15;
    const surfaceZLocal = ellipsoidZ(localX, yLocal);
    // (2026-08-31) reliefGain — 위 FACE_RELIEF_FIX 주석 참고. 기본값은 1이라
    // 그 스위치를 끄면 예전과 <b>산술까지 동일</b>하다.
    const reliefZLocal = Z_SIGN * p.z * projector.bX * Z_DEPTH_SCALE * reliefGain;
    // 블렌드: 경계(distSq=1)에서 0(=타원 표면값 그대로, 이음새 없이 밀착),
    // 중심(distSq=0)에서 1(=실측 굴곡 전부 반영). 필터링에 쓰는 것과 같은
    // 타원이라 딱 경계선에서 자연스럽게 표면값과 일치함.
    const blendWeight = Math.max(0, 1 - distSqFromBound(i));
    // 좌/우 측면 실측 보정. 전체맵(USE_FULL_PROFILE_DEPTH)에 이 정점의 직접
    // 실측이 있으면 그 값을 그대로 쓰고(정점별 실측 우선), 없으면 기존 3앵커
    // 가우시안 확산으로 폴백 — 확산은 실측이 아예 없던 정점을 코/턱/이마
    // 실측의 "번짐"으로 근사하던 것이므로, 직접 실측이 있으면 확산보다 정확.
    /* ⚠ 미해결 (2026-07-27, 세부작업으로 미룸) — 얼굴에 <b>세로로 진한 띠 2줄</b>.
       사용자: "안에서 작업할 때도 세로로 좀 진한 부분이 있었어. 2군데 정도."
       (밖에서 찍을 때 생기는 흩뿌린 잡티와는 다른, 이전부터 있던 증상이다.)
       원인은 바로 아래 분기다. 정점마다 깊이 보정을 <b>두 가지 다른 공식</b>으로
       구한다 — 측면에서 직접 실측된 정점은 그 값을 그대로, 아닌 정점은 3앵커
       가우시안 확산으로. 두 값이 경계에서 이어지지 않아 <b>깊이에 단차</b>가 생기고,
       그 주름이 빛을 다르게 받아 띠로 보인다.
       실측 정점은 좌·우 측면 사진이 볼 수 있는 영역이라, 그 경계가 양 볼을 따라
       세로로 내려온다 → 정확히 "세로 2줄"(로그: 측면 실측 기여 정점 222/468).
       고칠 방향: 분기로 값을 고르지 말고 <b>보정값 배열을 먼저 다 만든 뒤</b>
       메쉬 인접(FACE_MESH_TRI_V로 만든 이웃 관계)으로 몇 회 라플라시안 평활을
       걸어 단차를 녹인다. 어느 쪽이 실측인지 구분할 필요 없이 경계만 부드러워진다. */
    let profileCorrectionZ = 0;
    if(fullProfileDepthMap && !Number.isNaN(fullProfileDepthMap[i])){
      profileCorrectionZ = fullProfileDepthMap[i];
    } else {
      for(let k=0;k<profileDepthCorrections.length;k++){
        const c = profileDepthCorrections[k];
        const ddx = localX - c.localX, ddy = yLocal - c.yLocal;
        const w = Math.exp(-(ddx*ddx+ddy*ddy) / (2*PROFILE_DEPTH_FALLOFF_SIGMA*PROFILE_DEPTH_FALLOFF_SIGMA));
        profileCorrectionZ += w * c.deltaZ;
      }
    }
    // (2026-08-17 c) 기준면만 두개골로 옮긴다 — 근거는 위 FACE_Z_TO_SKULL 주석.
    const baseTerm = surfaceZLocal * FACE_Z_TO_SKULL;
    const reliefTerm = blendWeight * reliefZLocal;
    const localZ = baseTerm + reliefTerm + profileCorrectionZ;
    /* [진단] 세 항을 따로 남긴다 — "코가 나온 건가 이마가 들어간 건가"를
       눈이 아니라 숫자로 가른다. 타원면z와의 차가 곧 함몰/돌출 깊이다. */
    if(_ZDBG[i] !== undefined) _ZDBG[i] = { surf: surfaceZLocal, base: baseTerm,
      relief: reliefTerm, prof: profileCorrectionZ, z: localZ,
      measured: !!(fullProfileDepthMap && !Number.isNaN(fullProfileDepthMap[i])) };
    // front는 회전 없이 그대로 월드 좌표로 씀 — 위 되돌림 항목 참고(회전을
    // 걸면 코처럼 튀어나온 점이 지렛대처럼 크게 밀려서 "막대기에 매달린"
    // 모양이 됨. 나머지 두상 시스템도 front 자신의 실측 회전은 쓰지 않음).
    positions[i*3+0] = localX;
    positions[i*3+1] = yLocal + 0.15; // 중심 오프셋 복원
    positions[i*3+2] = localZ;
    uvs[i*2+0] = p.x;
    uvs[i*2+1] = 1 - p.y; // 이미지 y(아래로 증가) → UV v(위로 증가) 반전
  }
  const filteredTriV = [];
  for(let t=0; t<FACE_MESH_TRI_V.length; t+=3){
    const a=FACE_MESH_TRI_V[t], b=FACE_MESH_TRI_V[t+1], c=FACE_MESH_TRI_V[t+2];
    if(inFaceBound(a) && inFaceBound(b) && inFaceBound(c)){
      filteredTriV.push(a,b,c);
    }
  }

  // [진단용] 얼굴 입체감 수치 — 경계 안(inFaceBound) 정점들의 z 범위.
  // 평평하면 zRange가 작고, 입체적이면 큼. 코끝(1)·턱(152)·이마(10) 개별 z도.
  {
    let zMin=Infinity, zMax=-Infinity;
    for(let i=0;i<vertCount;i++){
      if(!inFaceBound(i)) continue;
      const z = positions[i*3+2];
      if(z<zMin) zMin=z; if(z>zMax) zMax=z;
    }
    const zAt = idx => positions[idx*3+2].toFixed(3);
    /* ── 이 값을 <b>화면에서도</b> 볼 수 있어야 한다 (2026-08-22) ────────────────
       사용자: "그게 아니라 정면 사진이 <b>평면으로 걸려</b> 있었던 거야."
       나는 스크린샷만 보고 "얼굴이 한 덩어리로 붙었다 = 좋아졌다"고 읽었는데,
       사용자는 돌려 보고 <b>평면</b>이라는 걸 알았다. 정면 스틸로는 못 가른다.
       그리고 지금 이 파일은 두 경로 중 <b>어느 쪽이 실제로 화면에 올라갔는지</b>를
       아무 데도 안 남긴다 — buildRealFaceMesh가 null을 반환하면 호출부가 조용히
       평면 데칼로 바꿔 달고 끝이다. 그래서 <b>본 사람도 만든 사람도</b> 모른다.
       두 가지를 기록한다:
         path   — 실제로 붙은 것이 입체 메쉬인가 평면 데칼인가
         zRange — 메쉬라면 얼마나 <b>입체</b>인가. 이게 0에 가까우면 메쉬인데도
                  평면이라는 뜻이고, 그때 원인은 ellipsoidZ 붕괴다(두상 폭이
                  얼굴보다 좁으면 관자놀이 정점이 타원 밖으로 나가 z가 바닥친다 —
                  두상 폭 하한 문제와 <b>같은 뿌리</b>). */
    FACE_BUILD.path = 'mesh';
    FACE_BUILD.zRange = zMax - zMin;
    FACE_BUILD.zMin = zMin; FACE_BUILD.zMax = zMax;
    FACE_BUILD.sideHits = _fullProfileHitCount || 0;
    FACE_BUILD.ellA = ellAForFace; FACE_BUILD.ellC = ELL_C;
    FACE_BUILD.why = '';
    // (2026-08-31) 원인 구분용 — 위 FACE_BUILD 선언부 주석 참고.
    FACE_BUILD.reliefGain = reliefGain;
    FACE_BUILD.reliefCm   = (_reliefCmBefore != null) ? _reliefCmBefore * reliefGain : null;
    try{ FACE_BUILD.cmPerUnit = faceRulerCmPerUnit(faceMetrics).x; }catch(e){}
    console.log(`[얼굴 입체감] z범위=${(zMax-zMin).toFixed(3)} (min${zMin.toFixed(3)}~max${zMax.toFixed(3)}) | 코끝=${zAt(1)} 턱=${zAt(152)} 이마=${zAt(10)}`);
    console.log(`[얼굴 측면보정] 전체정점 실측=${USE_FULL_PROFILE_DEPTH ? '켜짐' : '꺼짐(3앵커만)'} | 측면 실측 기여 정점=${_fullProfileHitCount||0}개`);
    /* ── [얼굴 z·항별] 세 항을 따로 찍는다 (2026-08-18 k-4) ─────────────────
       사용자: "정면얼굴을 측면과 z값 대조해서 조금 더 낫게 만들어보자."
       그러려면 먼저 <b>어느 항이 얼마나 미는지</b>가 보여야 한다. 눈으로는
       "코가 크다"로 보이지만 숫자로는 <b>이마가 들어간</b> 것일 수 있다 —
       실제로 그랬다(이마가 타원면보다 안쪽). 그 판별을 이 줄이 한다. */
    const _NM = { 1:'코끝', 152:'턱', 10:'이마', 168:'미간', 234:'왼뺨' };
    const _rows = [];
    for(const k in _ZDBG){
      const d = _ZDBG[k]; if(!d) continue;
      const surfK = d.surf * FACE_Z_TO_SKULL;
      _rows.push('  ' + (_NM[k]||k) + (d.measured ? ' [측면실측]' : ' [정면추정]')
        + ' 타원면 ' + d.surf.toFixed(3) + ' → 기준 ' + d.base.toFixed(3)
        + ' | 굴곡 ' + (d.relief>=0?'+':'') + d.relief.toFixed(3)
        + ' | 측면보정 ' + (d.prof>=0?'+':'') + d.prof.toFixed(3)
        + ' = <b>' + d.z.toFixed(3) + '</b>'
        + '  (타원면 대비 ' + (d.z - d.surf >= 0 ? '+' : '') + (d.z - d.surf).toFixed(3)
        + (d.z < d.surf ? ' 함몰' : ' 돌출') + ')');
    }
    if(_rows.length){
      console.log('[얼굴 z·항별] 기준면계수 FACE_Z_TO_SKULL=' + FACE_Z_TO_SKULL.toFixed(3)
        + ' · 기준 맞춤 ' + (FACE_Z_FIX.matchBaseline ? '<b>ON</b>' : 'OFF(예전)') + '\n' + _rows.join('\n')
        + '\n  읽는 법 — [측면실측] 정점은 최종 z가 <b>실측 z와 같아야</b> 합니다(차를 더하는 구조라서).'
        + ' 그런데 기준 맞춤이 OFF면 타원면z×(1−k)만큼 <b>일괄 함몰</b>합니다(k=' + FACE_Z_TO_SKULL.toFixed(3)
        + '이면 얼굴 한가운데서 약 ' + ((1-FACE_Z_TO_SKULL)*0.5*19.33).toFixed(1) + 'cm).'
        + '\n  ON인데도 함몰이 남으면 그건 <b>측면 각도</b> 문제입니다 — 이 손님은 yaw 34°/−31°라'
        + ' 실루엣 가장자리가 코·이마가 아니라 뺨입니다(깊이를 재려면 80~90°가 필요).');
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(new THREE.BufferAttribute(new Uint32Array(filteredTriV), 1));
  geo.computeVertexNormals();

  const MAX_DIM = 1024;
  let dw=img.width, dh=img.height;
  if(Math.max(dw,dh) > MAX_DIM){ const s=MAX_DIM/Math.max(dw,dh); dw=Math.round(dw*s); dh=Math.round(dh*s); }
  const canvas = document.createElement('canvas');
  canvas.width=dw; canvas.height=dh;
  canvas.getContext('2d').drawImage(img,0,0,dw,dh);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  /* ══════════════════════════════════════════════════════════════
     얼굴이 <b>뜬다</b> — 사진에 조명을 한 번 더 걸고 있었다 (2026-08-22)
     ─────────────────────────────────────────────────────────────
     사용자(새 남자 사진): "3D에서 얼굴이 뜨네."
     결과 화면에서 얼굴 중앙선을 세로로 훑어 재 봤다:
       이마·콧대  RGB(255,255,255)  ← <b>완전히 날아간 흰색</b>
       목        RGB(254,211,176)  ← 빨강이 254에 붙어 아예 평평
     사진 텍스처에는 <b>촬영 당시의 조명이 이미 들어 있다.</b> 그런데 이 메쉬가
     MeshStandardMaterial이라 장면 조명(키 0.9 + 필 0.35 + 앰비언트 0.55)을
     한 번 더 받는다. 밝은 피부는 곱해지는 순간 255를 넘어 잘리고, 잘리면
     얼굴의 굴곡이 통째로 사라져 <b>납작한 흰 가면</b>이 된다 — 화장이 뜬 그 모양이다.

     ⚠ 폴백 경로(buildFacePhotoDecal)는 <b>이미 MeshBasicMaterial</b>(무조명)을
       쓰고 있었다. 같은 판단이 두 곳에 있고 한쪽만 맞았던, 이 파일의 단골 모양이다.
     고침: 사진이 들어간 면은 조명을 안 받는다. 절차적 두개골·목은 자기 조명이
     필요하므로 그대로 둔다(그쪽은 구운 빛이 없다).
     되돌리기: FACE_MAT.unlit = false */
  const mat = FACE_MAT.unlit
    ? new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide })
    : new THREE.MeshStandardMaterial({ map: texture, roughness:0.8, metalness:0, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'realFaceMesh';
  return mesh;
}

async function buildFacePhotoDecal(faceMetrics){
  const src = state.shots && state.shots.front;
  // 실측 랜드마크 없인 정렬 기준점이 없어 위치가 부정확해짐 — 추정치로
  // 억지로 배치하면 오히려 더 어색해서, 이 경우엔 스킵하고 절차적
  // 이목구비(faceDetailGroup)를 그대로 보여주는 쪽이 낫다고 판단.
  if(!src || !state.landmarks || !state.landmarks.front) return null;

  let img;
  try{ img = await loadImageAsync(src); }
  catch(e){ console.warn('데칼용 이미지 로드 실패:', e); return null; }

  const MAX_DECAL_DIM = 512; // 원본 캡처(최대 1024)보다 작게 — 데칼은 성능보다 정렬이 중요하지 해상도는 이 정도로 충분
  let dw = img.width, dh = img.height;
  if(Math.max(dw,dh) > MAX_DECAL_DIM){ const s = MAX_DECAL_DIM/Math.max(dw,dh); dw=Math.round(dw*s); dh=Math.round(dh*s); }

  const canvas = document.createElement('canvas');
  canvas.width = dw; canvas.height = dh;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, dw, dh);

  const lm = faceMetrics.lm;
  if(!lm.features) return null; // features bbox 없으면(폴백 랜드마크) 페더 중심도 못 잡음

  const eyeCX = (
    (lm.features.leftEye.minX + lm.features.leftEye.maxX)/2 +
    (lm.features.rightEye.minX + lm.features.rightEye.maxX)/2
  ) / 2;
  const cx = eyeCX * dw;
  // 세로 범위는 일부러 browTopY(눈썹 위) 아래로만 잡는다 — 그 위(이마~헤어라인)는
  // 앞머리/잔머리가 걸쳐 있을 확률이 높은 영역이라, 거기까지 사진을 그대로 오려
  // 붙이면 실제 사용자 사진에서 이마에 어두운 머리카락 얼룩이 번져 보이는
  // 사고가 나기 쉬움(합성 테스트 이미지로 재현·확인함). 대신 눈썹선을 상단
  // 경계로 고정해 어떤 헤어스타일/앞머리 사진이 와도 항상 안전하게 동작.
  const topY = lm.browTopY * dh;
  const botY = lm.chinY * dh * 1.06; // 턱 아래 살짝 여유
  const cy = (topY + botY) / 2;
  const halfH = (botY - topY) / 2;
  const ry = Math.max(4, halfH * 0.92); // 상단이 browTopY보다 살짝 더 안쪽에 오도록 여유
  const rx = Math.max(4, Math.abs(lm.rEarX - lm.lEarX) * dw * 0.56);

  ctx.globalCompositeOperation = 'destination-in';
  const grad = ctx.createRadialGradient(cx, cy, Math.min(rx,ry)*0.35, cx, cy, Math.max(rx,ry));
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.7, 'rgba(255,255,255,0.9)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI*2); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  // 캔버스 전체(=사진 전체, 배경/어깨/여백 포함)를 그대로 평면 텍스처로 쓰면
  // 두상보다 훨씬 큰 평면이 나옴(사진 속 얼굴이 프레임의 일부만 차지하므로).
  // 페더 타원을 살짝 여유 있게 감싸는 만큼만 잘라내서, 평면 크기가 항상
  // "얼굴 크기"에 비례하게(=두상 크기와 같은 축척으로) 만든다.
  const cropHalfW = rx * 1.05, cropHalfH = ry * 1.15;
  const cropX0 = Math.max(0, cx - cropHalfW), cropY0 = Math.max(0, cy - cropHalfH);
  const cropX1 = Math.min(dw, cx + cropHalfW), cropY1 = Math.min(dh, cy + cropHalfH);
  const cropW = Math.max(1, Math.round(cropX1 - cropX0)), cropH = Math.max(1, Math.round(cropY1 - cropY0));

  const faceCanvas = document.createElement('canvas');
  faceCanvas.width = cropW; faceCanvas.height = cropH;
  faceCanvas.getContext('2d').drawImage(canvas, cropX0, cropY0, cropW, cropH, 0, 0, cropW, cropH);

  const texture = new THREE.CanvasTexture(faceCanvas);
  texture.needsUpdate = true;

  // 두상 로컬 좌표계에서 픽셀당 월드유닛 크기 — 세로 기준점(눈~턱) 아핀변환의
  // 기울기(bY)를 그대로 재사용해 크롭된 얼굴 영역을 두상과 같은 축척으로 배치.
  const worldPerPixel = faceMetrics.projector.bY / dh;
  const planeW = cropW * worldPerPixel;
  const planeH = cropH * worldPerPixel;

  const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(planeW, planeH), mat);
  plane.name = 'facePhotoDecal';
  /* 여기까지 왔다는 건 <b>평면</b>이 화면에 걸린다는 뜻이다. 확정 시점에 기록한다
     (위 스킵 지점에서 이미 적었더라도, 실제로 붙은 것이 이것임을 여기서 확정). */
  FACE_BUILD.path = 'decal';
  if(!FACE_BUILD.why) FACE_BUILD.why = '입체 메쉬가 null을 반환';
  FACE_BUILD.zRange = 0;   // 평면이므로 정의상 0
  plane.position.set(
    faceMetrics.projector.toMeshX((cropX0+cropX1)/2 / dw),
    faceMetrics.projector.toMeshY((cropY0+cropY1)/2 / dh),
    /* (2026-08-17 c) 0.92*widthFactor는 두상이 고정 상수 타원(0.85*wf)이던 시절의
       값이라, 실측 두상이 생긴 뒤로는 근거 없는 숫자로 남아 있었다. 그리는 두개골의
       실제 깊이 바로 앞에 놓는다 — 두개골이 두피면으로 줄어든 지금은 특히,
       이 상수를 두면 데칼만 허공에 뜬다. 실측 실패 시에만 옛 값으로 폴백. */
    (()=>{ try{ return getDisplaySkullEllipsoid().c * 1.02; }
           catch(e){ return 0.92 * faceMetrics.widthFactor; } })()
  );
  return plane;
}

/* ── 스캘프(두피) 좌표계 ──
   phi: 정수리(top)=0에서 목쪽으로 갈수록 커지는 극각(라디안). 0=정수리,
   π/2(1.57)=귀 높이(적도), π(3.14)=턱 밑. 대략 0~2.5 사용.
   theta: 정면(+Z 방향)=0 기준 방위각. +/- 로 좌우 대칭, π=정후면.
   실측 헤어라인 데이터가 아니라 "6개 섹션이 두상 어디쯤 위치하는지"를
   대략적으로 근사한 배치표 — 진짜 헤어라인 인식 데이터가 3D에도 연동되면
   교체될 자리표시자였음. (2026-07-17 정리: 이 배치표를 쓰던 절차 생성 3D
   경로는 삭제됨 — 지금 이 표의 유일한 살아있는 소비자는 HEAD_PHI_BANDS
   (phiRange들에서 두상 단면 측정 밴드를 파생, 아래 참고). 단일 출처 원칙
   때문에 표 자체는 유지.)
   ※ 버그 수정 이력(theta): center±spread를 섹션마다 눈대중으로 잡다 보니
   side(최대 약 78°)와 occipital/nape(최소 약 120°) 사이 약 42° 구간에
   어느 섹션도 안 걸치는 빈 틈이 있었음 — 실기기 스크린샷에서 "귀 뒤쪽
   대각선으로 대머리 띠"가 그대로 보임. 아래 값은 각 섹션 경계가 서로
   살짝씩 겹치도록(빈틈 없이) 다시 계산한 것 — 오른쪽 반원(0~180°) 기준
   front 0~39°, temple 26~60°, side 51~103°, occipital/nape 94~180°로
   이어지게 함(왼쪽은 자동 대칭). */
/* ── MediaPipe 공식 캐노니컬 얼굴 메쉬 토폴로지(2026-07-13 추가) ──
   진짜 3D 얼굴 메쉬 구축용. MediaPipe 공식 저장소(github.com/google-ai-edge/
   mediapipe, mediapipe/modules/face_geometry/data/canonical_face_model.obj)
   에서 직접 받아서 파싱: 정점 468개(=랜드마크 인덱스와 1:1 대응), UV좌표
   468개, 삼각형 898개. 정점 위치 자체(v 라인)는 "캐노니컬(범용) 얼굴 형태"
   라 그 사람 얼굴이 아니라서 안 씀 — 여기 쓰는 건 UV(468개)와 삼각형
   연결정보(v/vt 인덱스 쌍, 898*3=2694개)뿐. 실제 정점 위치는 그 사람
   본인의 랜드마크 감지 결과(state.landmarks.front.rawLandmarks)로 매 실행
   시 새로 채움 — buildRealFaceMesh() 참고. */
