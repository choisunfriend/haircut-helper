/* ══════════════════════════════════════════════════════════
   11-result-screen.js — 결과 화면 · 목 합성 · AI 호출 · 음성
   원본 index.html 15028~16494행. 클래식 스크립트이므로 로드 순서가 곧
   실행 순서다 — index.html의 <script src> 순서를 바꾸지 말 것.
   ══════════════════════════════════════════════════════════ */
/* ════════════════════════════════════════
   RESULT (SCREEN 4) — 구 COMPARE 전면 교체 (2026-08-02)
   ────────────────────────────────────────
   사용자 지시(3차까지 누적):
     · "비교보기를 뜯어고친다. 정면 화면에선 정면 결과물과 추천의상을 입은 정면
        모습, 좌측에선 좌측 결과물과 좌측 모습을 보여주는 결과 화면으로."
     · "조정화면의 결과물에 3D 몸체 스냅샷 합성" · "비교 화면 없이 결과물 화면만"
     · "<b>전신상</b>이 나왔으면 좋겠고, <b>두상만 잘라냈으면</b> 좋겠고, 그래서
        지금은 <b>옷이 겹쳐</b> 있는데 그렇게 안 나왔으면 좋겠어."
     · "확대 축소가 가능하게"

   ── 왜 구조가 두 번 바뀌었나 ──
   1차 구조는 "사진을 그대로 깔고 목 아래에 의상을 덧그리기"였다. 그러면 고객이
   입고 온 옷이 사진에 남아 있어서, 아무리 지워도 <b>옷이 겹쳐 보인다</b>(실기기
   확인). 지우기를 정교하게 다듬는 건 원인이 아니라 증상을 쫓는 일이다 — 사진
   상반신을 <b>쓰지 않으면</b> 애초에 겹칠 것이 없다.
   그래서 2차 구조는 <b>오려붙이기</b>다:

     [배경] 그 사진의 배경색으로 만든 부드러운 그라데이션 — 오려낸 두상 가장자리가
            배경과 같은 색이라 이질감이 안 생긴다(사진 배경을 그대로 물려받음).
     [1] <b>두상만 오려낸다</b> — 조정 화면과 같은 렌더 경로로 그린 결과물에서
         (사람 실루엣 ∩ 자르는 선 위) ∪ (렌더된 헤어 레이어)만 남긴다. 목은
         옷깃선보다 조금 아래에서 자르고, 그 아래는 옷이 덮으므로 이음매가 안 보인다.
     [2] 추천 의상 <b>전신</b> 3D를 그 뷰 각도로 오프스크린 정사영 렌더 → 두상 아래에.
     [3] 헤어 레이어를 옷 <b>위</b>에 한 번 더 — 어깨로 내려온 머리가 옷 뒤로 숨지 않게.
     그리기 순서는 [배경]→[두상]→[의상]→[헤어]. 두상을 먼저 깔아야 목이 옷깃 뒤로
     들어간다(반대로 하면 목이 옷깃을 덮는다).

   ── 크기·위치를 무엇으로 정하나 ──
   ① 두상 배율(뷰마다) — <b>정수리~귀선</b>의 세로 길이로 잡는다. 눈~턱은 뒷모습에서
      못 재고(얼굴이 없다), 실제로 3차 실기기 로그에서 back의 사진자가 정면의 4배로
      튀어 옷깃선이 프레임 밖(877px)으로 나갔다. 정수리(실루엣 최상단)와 귀선은
      네 뷰 모두에서 재진다. 정면 실측으로 "이 사람의 정수리~귀선 = 몇 메쉬단위"를
      한 번 구해두고(getPersonScaleRef), 각 뷰는 그 자에 자기 픽셀을 맞춘다.
   ② 몸 크기 — <b>두신 비율</b>로 잡는다. 처음엔 실측 목둘레에 맞췄는데, 실기기
      로그에서 목반폭이 1.36단위로 나왔다 — 두상 폭(0.70)의 두 배다. 이유가 있다:
      computeNeckCrossSections의 맨 아래 밴드가 바로 y=-1.15이고 그 높이의 사람
      실루엣은 이미 <b>어깨</b>라서, 목이 아니라 어깨폭을 재고 있었다. 그래서 옷이
      거인처럼 커졌다. 대신 잰 두상 높이(정수리~턱)에 성인 평균 두신(FIGURE_HEADS)을
      곱해 전신 길이를 정하고, 에셋을 거기에 맞춘다 — 어깨폭은 에셋 자체 비율을 따른다.
   ③ 화면 배치 — 전신(정수리~발)이 프레임에 들어오도록 배율을 정하고 가운데 정렬.
      그 위에 사용자 확대/축소·이동(RESULT_VIEW)이 곱해진다.

   확대/축소는 래스터를 늘리는 게 아니라 <b>배율을 바꿔 다시 배치</b>한다 — 의상은
   그 배율로 3D를 다시 렌더하므로 확대해도 또렷하다(두상만 원본 해상도 한계).
════════════════════════════════════════ */

/* 실기기에서 눈으로 보고 미세 조정할 여지(자동계산이 어색할 때만 쓴다).
   scale: 자동 계산된 몸 배율에 추가로 곱하는 값.
   neckOverlapMesh: 옷깃을 목 밑동보다 이만큼(메쉬 단위, 0.08 ≈ 1.3cm) 위로 겹쳐
   그려 이음매를 옷깃 밑에 숨긴다. */
const RESULT_BODY_FIT = { scale: 1.0, offsetXMesh: 0, offsetYMesh: 0, neckOverlapMesh: 0.08, maxSnapPx: 1800 };
/* 의상 전환 UI(카탈로그 칩) 노출 여부. 지금은 AI 추천 1벌만 보여주기로 했지만
   전환 경로 자체(setResultOutfit)는 항상 살아 있다 — 나중에 제휴 상품 DB/쇼핑몰
   응답으로 OUTFIT_CATALOG 자리를 갈아끼우면 이 플래그만 켜면 된다. */
const RESULT_OUTFIT_PICKER = false;
const RESULT_NECK_MESH_Y = -1.15;  // 의상 부착 불변식(neckAttachPoint 하단)과 동일 값
/* ── 목 밑동은 <b>불변식이 아니라 잰 값</b>이어야 한다 (2026-08-30 6차) ──────
   사용자(실기기 녹화): "3D 결과보기에서 <b>계속 목이 길게 나와</b>."
   이 파일의 미해결 목록이 이미 원인을 적어 두고 있었다 —
     "buildRealNeckMesh의 neckBotY가 -1.15로 <b>하드코딩</b>이다. 그건 의상 부착
      불변식이지 목 길이가 아니다. 위 끝은 두개골에서 나오는데 아래 끝이
      고정이라, 두상이 작게 잡힌 사람일수록 목이 길어진다."
   그리고 자는 <b>이미 있다</b>: 결과화면이 쓰는 neckLenMesh(턱끝에서 NECK_LEN_CM
   8cm만큼을 이 사람의 얼굴 자로 환산). 3D 화면만 그 자를 안 쓰고 있었다.

   턱 y는 CHIN = 0.15 − 0.70·heightFactor이고 heightFactor는 0.85~1.18로 움직인다.
   메쉬단위→cm 환산자도 같이 움직인다(눈~턱 0.70·hf 단위 = 11.5cm). 그래서 고정
   −1.15까지의 거리를 cm로 재면 사람마다 <b>두 배 넘게</b> 벌어진다:
     hf 0.85 → 턱 −0.445 · 0.705단위 × 19.33cm = <b>13.6cm</b>
     hf 1.00 → 턱 −0.550 · 0.600단위 × 16.43cm = <b>9.9cm</b>
     hf 1.18 → 턱 −0.676 · 0.474단위 × 13.92cm = <b>6.6cm</b>
   <b>둥근 얼굴(hf 낮음)일수록 기린이 된다</b>. 목 길이가 얼굴 모양에 반비례하는 건
   어떤 해부학에도 없다 — 자가 없어서 생긴 값이다. 이번 손님이 그 쪽 끝이었다.
   고침: 밑동을 턱에서 NECK_LEN_CM(8cm) 내려간 자리로 잡는다 → 누구나 <b>8.0cm</b>
   (환산자가 hf에 비례하고 neckLenMesh도 hf에 비례하므로 cm는 hf와 무관해진다).

   ⚠ −1.15에는 <b>의상 메쉬가 물려 있다</b>(미해결 목록의 경고). 확인해 보니
     정렬은 이름이 아니라 <b>좌표값</b>으로 잡힌다(loadOutfitMeshFromOBJ의
     obj.position.y += (−1.15 − neckCutYScaled), 클리핑 평면, 플레이스홀더 몸통
     상단이 전부 같은 리터럴). 그래서 목만 줄이면 머리와 옷 사이가 벌어진다.
     → 리터럴을 전부 이 함수로 갈아 끼운다. 목이 짧아진 만큼 옷깃도 같이 올라온다.
   ⚠⚠ <b>"2D는 안 건드린다"가 틀렸다</b> (2026-08-30 7차, 실기기 녹화로 드러남).
     사용자: "2D 안 건드렸다고 했는데, 결과보기 사진화면에서 <b>어깨쯤에서 그
     윗부분이 날아갔어</b>. 이게 옷깃인가?" — 맞다. 옷깃과 어깨 윗부분이다.
     6차는 3D 장면만 옮기고 2D 결과는 그대로 뒀는데, <b>둘은 같은 의상 메쉬를
     공유한다</b>. 2D 결과는 그 메쉬를 renderBodySnapshot에서 <b>y = −1.15부터
     아래로</b> 오려낸다(const top). 의상을 위로 올려 놨으니 옷깃이 오리는 선
     위로 올라가 통째로 잘려 나갔다 — 화면에 <b>수평으로 싹둑</b> 잘린 어깨가 남는다.
     교훈: −1.15는 "2D의 값"이 아니라 <b>3D 몸과 2D 오리기 사이의 계약</b>이었다.
     한쪽만 옮기면 계약이 깨진다. 그래서 이제 <b>양쪽 다</b> 이 함수를 본다 —
     오리는 선·두상 내림·몸통 스케일 고정점·프레이밍이 전부 같은 출처다.
     ⓘ 부수 효과이자 자기점검: 밑동이 턱−8cm면 headDropMesh = (밑동+목길이)−턱
       = <b>0</b>이 된다. 두상을 억지로 내리던 보정이 저절로 사라진다(뷰별로 목을
       따로 실측한 경우에는 그 차이만 남는다 — 식은 그대로 유효하다).
     ⚠ RESULT_NECK_MESH_Y는 이제 <b>폴백 상수</b>로만 쓴다(랜드마크가 깨졌을 때).
   되돌리기: NECK_BOTTOM_MEASURED = false (그러면 모든 소비처가 −1.15로 돌아간다) */
const NECK_BOTTOM_MEASURED = true;
function getNeckBottomY(){
  if(!NECK_BOTTOM_MEASURED) return RESULT_NECK_MESH_Y;
  try{
    const fm = getFaceMetrics();
    const CHIN = 0.15 - 0.70 * fm.heightFactor;
    const neckLenMesh = NECK_LEN_CM * (0.70 * fm.heightFactor) / FACE_RULER_CM.eyeToChin;
    const y = CHIN - neckLenMesh;
    /* 랜드마크가 깨졌을 때를 위한 난간 — 옛 불변식 언저리를 벗어나면 안 쓴다.
       (목이 4cm나 20cm로 나오는 건 자가 아니라 사고다) */
    if(!isFinite(y) || y > -0.75 || y < -1.35) return RESULT_NECK_MESH_Y;
    return y;
  }catch(e){ return RESULT_NECK_MESH_Y; }
}
const NECK_LEN_CM        = 8.0;    // 턱끝 → 옷깃선(목 길이). 성인 평균 근사, 실기기 튜닝 지점
const FIGURE_HEADS       = 6.5;    // 전신 길이 = 두상 높이 × 이 값
/* ══════════════════════════════════════════════════════════════════
   신체 비율의 자 = <b>두상</b> (2026-09-05 사용자 지시)
   ─────────────────────────────────────────────────────────────────
   사용자: "왜 이걸 옷깃으로 봐? 우리가 지금 작업하는 게 두상이기 때문에 두상을
   기준으로 해서 신체비율을 잡도록 해." · "일반적으로 준수한 체형 있잖아."
   이어서: "조금 비현실적인 거 같아.. 10등신쯤 되는 거 같은데. 1:7 정도로."

   맞는 지적이고, 이 화면은 <b>이미 그렇게</b> 하고 있었다 — FIGURE_HEADS가 그것이다.
   3D 화면만 그 자를 안 쓰고 loadOutfitMeshFromOBJ 안의 TARGET_HEIGHT=4.0이라는
   <b>고정값</b>으로 옷을 맞추고 있었다(4.9두신). 그걸 이 함수로 통일했다.

   ── 통일한 뒤에도 화면이 8.9두신이었던 이유 ─────────────────────────────
   상수는 7.5인데 실측이 8.9였다(영상 96초: 정수리~턱 53px · 전신 474px).
   <b>두상 한 칸의 정의가 두 화면에서 달랐다.</b> crownMeshY는 정면 사진의
   <b>헤어 박스 위끝</b>이다 — 결과 화면은 사진을 그대로 합성하니 맞는 자지만,
   3D 화면의 머리는 <b>메쉬</b>고 그 헤어 꼭대기는 사진보다 낮다. 1.19배 차이였고
   7.5 × 1.19 = 8.9로 화면 숫자와 맞는다. 자가 실물보다 커서 몸이 그만큼 길어진 것이다.
   그래서 crownY를 인자로 받는다 — 3D 화면은 씬에서 잰 값을 넣고(state._model3DCrownY),
   결과 화면은 안 넣어 사진 기준을 그대로 쓴다. 두 화면이 각자 <b>자기가 그리는
   머리</b>를 잰다.
   ⚠ 7.5 → 7.0으로 내린 것은 위 자 수정과 <b>별개</b>다. 자만 고쳐도 8.9→7.5가 되고,
     7.0은 거기서 사용자가 지정한 값이다. 둘을 한 번에 바꿨으므로, 화면이 7.0이
     아니면 어느 쪽이 안 먹었는지 아래 [3D·비율] 로그로 갈린다.

   ── 7.0 → <b>6.5</b> (2026-09-05 사용자 지시) ─────────────────────────────
   사용자: "3D 결과보기에서 두신과 신체의 비율이 7.0 정도로 잘 맞춰져 있는데,
   신체를 조금만 더 키워봐도 될 거 같아. 6.5로 변경해줘."
   ⓘ <b>머리 크기는 안 바뀐다</b>. 두상은 사진 실측이 정하고(getPersonScaleRef),
     이 상수는 "그 머리 몇 개가 전신인가"만 정한다. 6.5로 내리면 전신이 짧아져
     머리 대비 몸이 <b>다부지게</b> 보이고, 프레임에 맞추는 배율(③ 화면 배치)이
     그만큼 커져 화면에서는 몸이 크게 잡힌다 — 이것이 사용자가 본 "키운다"다.
     반대로 몸을 <b>길게</b> 빼고 싶으면 이 값을 올린다(7.5~8이 패션 일러스트 쪽).
   자·경로는 한 줄도 안 건드렸다. 이 상수 하나가 결과 화면과 3D 화면 양쪽의
   단일 출처이므로(personBodyLenMesh), 두 화면이 같이 움직인다.
══════════════════════════════════════════════════════════════════ */
function personBodyLenMesh(crownY){
  const ref = getPersonScaleRef();
  if(!ref) return null;
  const crown = (typeof crownY === 'number' && isFinite(crownY)) ? crownY : ref.crownMeshY;
  const headH = crown - ref.chinMeshY;
  if(!(headH > 0.3)) return null;
  const len = headH * FIGURE_HEADS - (crown - getNeckBottomY());
  if(!(isFinite(len) && len > 0.5)) return null;
  console.log('[3D·비율] 두상 한 칸 ' + headH.toFixed(2) + '단위'
    + (crownY != null ? ' (<b>씬 실측</b> 정수리 ' + crown.toFixed(2) + ')'
                      : ' (사진 헤어박스 기준 — 결과 화면)')
    + ' · 전신 ' + (headH*FIGURE_HEADS).toFixed(2) + '단위 = ' + FIGURE_HEADS + '두신'
    + ' · 옷이 채울 길이 ' + len.toFixed(2) + '단위'
    + (crownY != null && Math.abs(crown - ref.crownMeshY) > 0.02
        ? '\n    사진 기준 정수리는 ' + ref.crownMeshY.toFixed(2) + ' — 씬과 '
          + ((crown - ref.chinMeshY) / Math.max(1e-6, ref.crownMeshY - ref.chinMeshY)).toFixed(2)
          + '배 차이. 이 배수가 곧 화면 두신이 상수에서 벗어나는 양입니다.'
        : ''));
  return len;
}
const FIGURE_FILL        = 0.94;   // 전신이 프레임 세로를 차지하는 비율(여백 6%)

/* 사용자 확대/축소·이동 상태. 각도를 바꾸거나 새 고객이면 리셋된다. */
const RESULT_VIEW = { zoom: 1, panX: 0, panY: 0, min: 0.5, max: 6 };

let _resultGen = 0;          // 비동기 렌더 세대(각도/의상이 바뀌면 오래된 진행 폐기)
let _bodySnap = null;        // 오프스크린 3D 스냅샷 렌더러(1회 생성 후 재사용)
let _personScaleRef = null;  // 이 사람의 두상 자(정면 1회 계산 후 네 뷰 공유)
let _resultScene = null;     // 마지막으로 만든 장면 재료(확대/축소 때 2D 렌더를 다시 안 하려고)

function resetResultScreenCache(){
  _personScaleRef = null;
  _resultScene = null;
  RESULT_VIEW.zoom = 1; RESULT_VIEW.panX = 0; RESULT_VIEW.panY = 0;
  if(_bodySnap){
    while(_bodySnap.group.children.length){
      const o = _bodySnap.group.children[0];
      disposeObject3D(o); _bodySnap.group.remove(o);
    }
    _bodySnap.meshKey = null; _bodySnap.body = null;
  }
}

/* ── 오프스크린 3D 렌더러 ──
   메인 3D 화면(initModel3DRenderer)과 별개의 작은 렌더러. 조명 구성은 같은 값을
   써서 같은 의상이 두 화면에서 같은 색으로 보이게 한다. 카메라는 원근이 아니라
   <b>정사영</b>(OrthographicCamera) — 그래야 "메쉬 단위 ↔ 화면 픽셀"이 상수
   배율이 되어 두상·의상이 같은 자 위에 놓인다(원근이면 깊이마다 배율이 달라짐). */
function ensureBodySnapRenderer(){
  if(_bodySnap) return _bodySnap;
  if(typeof THREE === 'undefined') return null;
  try{
    const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true, preserveDrawingBuffer:true });
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x000000, 0);
    renderer.localClippingEnabled = true; // OBJ 에셋의 목 위(에셋 자체 머리) 잘라내기 — 로더가 건 클리핑 플레인 사용
    const scene = new THREE.Scene();
    const key = new THREE.DirectionalLight(0xffffff, 0.9);  key.position.set(1.5, 2, 2);   scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.35); fill.position.set(-2, 0.5, 1); scene.add(fill);
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const group = new THREE.Group(); scene.add(group);
    /* 목은 <b>의상 그룹 밖</b>이다 (2026-08-30 8차). group은 두신 비율을 맞추려고
       배율 s로 스케일되는데, 목 길이는 두상 좌표계의 실측값이라 같이 늘어나면
       안 된다. 그래서 씬에 따로 달고 yaw만 같이 돌린다. */
    const neckGroup = new THREE.Group(); scene.add(neckGroup);
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100);
    camera.position.set(0, 0, 12);
    camera.lookAt(0, 0, 0);
    _bodySnap = { renderer, scene, camera, group, neckGroup, meshKey:null, neckKey:null, body:null };
    return _bodySnap;
  }catch(e){
    console.warn('의상 스냅샷 렌더러 생성 실패(의상 합성 생략):', e);
    return null;
  }
}

/* ══════════════════════════════════════════════════════════════════
   2D 결과의 <b>목은 3D에서, 머리는 사진에서</b> (2026-08-30 8차)
   ─────────────────────────────────────────────────────────────────
   사용자: "2D 전신상에서 의상은 3D에서 가져오고 두상은 2D에서 가져오잖아?
   그런데 계속 두상을 자르는 게 <b>거의 옷칼라까지 포함해서</b> 자른단 말야.
   목까지를 3D에서 가져오고 2D에서 두상까지만 가져오면 어때?" — 그렇게 한다.
   ("옷깃은 첨부터 계~~속 딸려왔어" — 7차의 회귀가 아니라 원래부터 있던 것이다.)

   예전 구조: 사진을 <b>옷깃보다 0.30단위 아래</b>에서 잘랐다(cutPxY = 옷깃+0.30).
   이음매를 옷깃 밑에 숨기려는 것이었는데, 그 0.30 안에 손님이 입고 온 <b>옷깃이
   같이 들어온다</b>. 턱 아래를 목 기둥 폭으로 좁혀도(buildHeadCutout의 narrow)
   목 앞쪽 옷깃은 그 폭 안에 있으므로 안 잘린다. 구조상 못 없앤다.

   새 구조: 사진은 <b>턱까지만</b> 오리고, 턱 아래 목은 3D 메쉬가 그린다.
     · 사진에 목이 없으므로 손님 옷깃이 원리적으로 못 들어온다
     · 이음매가 옷깃 밑 → <b>턱선</b>으로 옮겨간다. 대신 턱 밑은 원래 그림자가
       지는 자리라 페더로 눌린다(TURN_FEATHER).
     · 그리는 순서가 뒤집힌다 — 예전엔 [머리 → 의상]이라 의상이 사진 목을
       덮었다. 이제는 [의상+목 → 머리]라 사진 턱이 3D 목 윗단을 덮는다.
   ⚠ 3D 목의 피부색은 사진에서 잰 두피색(scalpColor)을 쓴다 — buildProceduralHead와
     <b>같은 출처</b>다. 그래도 조명이 얹히므로 턱선에 색 띠가 보일 수 있다.
     보이면 만질 곳은 NECK_TINT(밝기)와 TURN_FEATHER(번짐)다.
   되돌리기: RESULT_NECK_FROM_3D = false (예전 구조로 완전히 돌아간다) */
const RESULT_NECK_FROM_3D = true;
const RESULT_HEAD_CUT = {
  chinDrop: 0.10,   // 턱에서 이만큼(메쉬단위) 더 내려가 자른다 — 턱 그림자 안
  feather:  0.06,   // 자른 선을 이만큼 번지게(메쉬단위)
  tint:     0.94,   // 3D 목 밝기 — buildRealNeckMesh와 같은 값에서 출발
};
/* 스냅샷에 들어갈 목의 <b>윗단</b>. buildRealNeckMesh와 같은 공식을 쓴다
   (두 벌이 되면 스냅샷과 3D 화면이 서로 다른 목을 그린다). */
function getNeckTopY(){
  try{
    const PHI_MAX = HEAD_PHI_BANDS[HEAD_PHI_BANDS.length-1];
    return Math.cos(PHI_MAX) * getDisplaySkullEllipsoid().b * 1.01 + 0.15;
  }catch(e){ return 0.15; }
}
/* 스냅샷 씬에 목 메쉬를 올린다(피부색·두상이 안 바뀌면 재사용). */
function ensureResultNeckMesh(snap){
  if(!RESULT_NECK_FROM_3D || !snap || !snap.neckGroup) return;
  const css = (state.hairMasks && state.hairMasks.front && state.hairMasks.front.scalpColor) || '#E8C39E';
  /* (11차) 옷깃 구멍도 키에 넣는다 — 아래 링이 거기서 나오므로, 안 넣으면
     의상이 바뀌어도 옛 목이 그대로 남는다. */
  const g = _garmentNeckOpening;
  const key = css + '|' + getNeckTopY().toFixed(4) + '|' + getNeckBottomY().toFixed(4)
            + '|' + (g ? g.halfWidth.toFixed(4) + ',' + g.halfDepth.toFixed(4) : '-');
  if(snap.neckKey === key) return;
  while(snap.neckGroup.children.length){
    const o = snap.neckGroup.children[0];
    disposeObject3D(o); snap.neckGroup.remove(o);
  }
  try{
    let c = new THREE.Color(css);
    // buildProceduralHead와 같은 어두운 색 가드 — 머리카락 그늘을 피부색으로 읽는 경우
    if((c.r + c.g + c.b)/3 < 0.30) c = new THREE.Color('#E0B294');
    const m = buildRealNeckMesh(c);
    if(m){ snap.neckGroup.add(m); snap.neckKey = key; }
  }catch(e){ console.warn('결과화면 3D 목 생성 실패(사진 목으로 폴백):', e); }
}

/* 로드된 의상 메쉬를 정점 단위로 실측한다(스케일 1 기준, 옷깃선 아래만).
     maxAbsX/maxAbsZ — 화면 가로 폭 계산용(정면·후면은 X, 측면은 Z가 화면 가로)
     minY   — 몸 최하단(발끝)
   Box3를 안 쓰는 이유: OBJ 에셋의 머리/목 정점은 <b>지오메트리에 그대로 남아
   있고</b> 렌더 시 클리핑 플레인으로 안 보이게만 하는 것이라, Box3를 그냥 쓰면
   에셋의 머리까지 포함돼 크기·프레이밍이 전부 어긋난다. */
function measureOutfitMeshBody(obj){
  const NY = getNeckBottomY();
  let maxAbsX = 0, maxAbsZ = 0, minY = Infinity, count = 0;
  const v = new THREE.Vector3();
  obj.updateMatrixWorld(true);
  obj.traverse(child=>{
    if(!child.isMesh || !child.geometry || !child.geometry.attributes || !child.geometry.attributes.position) return;
    if(child.visible === false) return; // 에셋 자체 Hair 재질 등 숨긴 파트는 제외
    const pos = child.geometry.attributes.position;
    for(let i=0;i<pos.count;i++){
      v.fromBufferAttribute(pos, i).applyMatrix4(child.matrixWorld);
      if(v.y > NY) continue;                    // 목 위(잘려서 안 보이는 부분)는 무시
      count++;
      if(v.y < minY) minY = v.y;
      const ax = Math.abs(v.x), az = Math.abs(v.z);
      if(ax > maxAbsX) maxAbsX = ax;
      if(az > maxAbsZ) maxAbsZ = az;
    }
  });
  if(!count || !isFinite(minY)) return null;
  return { maxAbsX, maxAbsZ, minY, heightRaw: NY - minY };
}

/* 이 사람의 "두상 자". 정면 실측 랜드마크에서 한 번만 뽑아 네 뷰가 공유한다.
   전부 정면 사진의 정규화 세로(0~1)를 메쉬 단위로 환산해 담는다 —
   눈=0.15, 턱=0.15-0.70×heightFactor라는 이 앱의 기존 정의를 그대로 씀. */
function getPersonScaleRef(){
  if(_personScaleRef) return _personScaleRef;
  const lm  = state.landmarks && state.landmarks.front;
  const inf = state.hairMasks && state.hairMasks.front;
  if(!lm || !((lm.chinY - lm.eyeY) > 0.01)) return null;
  const fm = getFaceMetrics();
  const EYE = 0.15, CHIN = 0.15 - 0.70*fm.heightFactor;
  const meshPerNorm = (EYE - CHIN) / (lm.chinY - lm.eyeY); // 정면 사진 세로 1 = 몇 메쉬단위
  const box = inf ? hairBoxOf(inf) : null;
  const earMeshY   = EYE - (lm.earY - lm.eyeY) * meshPerNorm;
  const crownMeshY = box ? EYE + (lm.eyeY - box.y0) * meshPerNorm : EYE + 0.78;
  const crownToEar = crownMeshY - earMeshY;
  if(!(crownToEar > 0.15)) return null;   // 정수리가 귀보다 아래 = 앵커가 깨진 것
  /* 목 길이 — 두상을 몸 위 어디에 놓을지. 메쉬 불변식(-1.15)을 그대로 쓰면 턱~옷깃이
     0.71단위 = 13.7cm로 <b>목이 너무 길어진다</b>(-1.15는 3D 두상 안에서 목 기둥이
     끝나는 자리지 사진의 옷깃선이 아니다). 실제 턱~목밑동 8cm를 이 사람의 자로
     환산해서, 그만큼만 띄운다. headDropMesh는 그 차이(두상을 아래로 내리는 양). */
  const neckLenMesh = NECK_LEN_CM * (EYE - CHIN) / FACE_RULER_CM.eyeToChin;
  const ref = {
    earMeshY, crownMeshY, chinMeshY: CHIN,
    crownToEarMesh: crownToEar,
    headHeightMesh: Math.max(0.6, crownMeshY - CHIN),   // 정수리~턱 = 1두신
    neckLenMesh,
    headDropMesh: (getNeckBottomY() + neckLenMesh) - CHIN,
  };
  /* ── 정면 실루엣을 <b>메쉬 단위로</b> 재둔다 (2026-08-02 11차) ─────────────
     사용자: "후면은 랜드마크가 없어서 두상 형성에 기여를 안 한다. 전면과 후면의
     두상 실루엣이 거의 같으니 그걸 비교해서 후면 위치를 잡자."
     맞는 접근이다. 뒤통수 폭은 앞에서 본 폭과 같고, 정수리 높이도 같다.
     그래서 얼굴 랜드마크가 없는 뷰는 "정면에서 이 폭이 몇 단위였나"에 자를 맞춘다.
     ※ 재는 자리는 <b>박스 전체 폭이 아니라 정수리에서 조금 내려온 윗머리</b>다.
       박스 전체 폭은 긴 머리가 뒤에서 옆으로 퍼지면 앞뒤가 크게 달라진다
       (실제로 여자 후면에서 두상이 작게 나온 원인). 윗머리는 머리가 두개골에
       붙어 있어 어느 각도에서 봐도 폭이 거의 같다.
     ※ 가로 정규화 좌표는 세로와 자가 다르다(가로는 imgW, 세로는 imgH 기준) —
       사진 종횡비(w/h)를 곱해야 같은 자가 된다. fit이 비율을 유지하므로
       fit.dw/fit.dh와 같은 값이고, 그래서 fit 없이도 계산할 수 있다. */
  const aspect = (inf && inf.w > 0 && inf.h > 0) ? (inf.w / inf.h) : 1;
  ref.meshPerNorm   = meshPerNorm;
  ref.frontAspect   = aspect;
  ref.upperDepthMesh = 0.5 * crownToEar;        // 정수리에서 이만큼 내려온 자리를 잰다
  ref.hairWidthMesh  = box ? (box.x1 - box.x0) * aspect * meshPerNorm : null;  // 폴백(박스 전체)
  ref.upperWidthMesh = null;
  if(box && inf){
    const rowNorm = box.y0 + (ref.upperDepthMesh / meshPerNorm);
    const wNorm = hairWidthAtRowNorm(inf, rowNorm);
    if(wNorm != null && wNorm > 0.02) ref.upperWidthMesh = wNorm * aspect * meshPerNorm;
  }
  _personScaleRef = ref;
  return ref;
}

/* 헤어 실루엣의 <b>그 높이에서의</b> 정규화 가로폭. scalpY(위)와 hairEndY(아래)
   사이에 그 행이 들어오는 컬럼들의 좌우 끝으로 잰다. 없으면 null. */
function hairWidthAtRowNorm(maskInf, rowNorm){
  const mw = maskInf.w, mh = maskInf.h;
  const sY = maskInf.scalpY, eY = maskInf.hairEndY;
  if(!sY || !(mw > 0) || !(mh > 0)) return null;
  const row = rowNorm * mh;
  let x0 = -1, x1 = -1;
  for(let x=0; x<mw; x++){
    const sy = sY[x];
    if(!(sy >= 0)) continue;
    const ey = (eY && eY[x] >= 0) ? eY[x] : sy;
    if(row >= sy && row <= ey){ if(x0 < 0) x0 = x; x1 = x; }
  }
  return (x0 >= 0 && x1 >= x0) ? (x1 - x0 + 1) / mw : null;
}

/* 추천 의상 메쉬를 오프스크린 그룹에 올린다(의상·사람이 같으면 재사용).
   크기는 두신 비율로: 전신 = 두상 높이 × FIGURE_HEADS. 목 밑동(-1.15)을 고정점으로
   스케일하므로 옷깃 위치는 배율과 무관하게 그대로다. */
async function ensureResultBodyMesh(item, widthFactor){
  const snap = ensureBodySnapRenderer();
  const ref  = getPersonScaleRef();
  if(!snap || !item || !ref) return null;
  const key = item.id + '|' + (widthFactor||1).toFixed(3) + '|' + ref.headHeightMesh.toFixed(3);
  if(snap.meshKey === key && snap.body) return snap;

  while(snap.group.children.length){
    const o = snap.group.children[0];
    disposeObject3D(o); snap.group.remove(o);
  }
  snap.group.scale.setScalar(1); snap.group.position.set(0,0,0); snap.group.rotation.set(0,0,0);
  snap.meshKey = null; snap.body = null;

  const mesh = await loadOutfitMeshMeasured(item, widthFactor || 1);
  if(!mesh) return null;
  snap.group.add(mesh);
  ensureResultNeckMesh(snap);   // 3D 목(8차) — 의상 그룹 밖이라 배율을 안 받는다

  const m = measureOutfitMeshBody(snap.group);
  if(!m || !(m.heightRaw > 0.01)){
    console.warn('의상 메쉬 실측 실패 — 배율 보정 없이 그대로 사용');
    snap.meshKey = key;
    snap.body = { scale:1, maxAbsX:1, maxAbsZ:1, minY: getNeckBottomY() - 4 };
    ensureResultNeckMesh(snap);
    return snap;
  }
  // 전신 = 두상 높이 × 두신. 그중 옷깃 아래가 몸이 차지할 길이(personBodyLenMesh 단일 출처).
  const bodyNeed  = personBodyLenMesh() || (ref.headHeightMesh * FIGURE_HEADS - (ref.crownMeshY - getNeckBottomY()));
  const s = (bodyNeed / m.heightRaw) * (RESULT_BODY_FIT.scale || 1);
  snap.group.scale.setScalar(s);
  snap.group.position.y = getNeckBottomY() * (1 - s); // 목 밑동 고정점 스케일
  snap.body = {
    scale: s,
    maxAbsX: m.maxAbsX * s,
    maxAbsZ: m.maxAbsZ * s,
    minY: getNeckBottomY() + (m.minY - getNeckBottomY()) * s,
  };
  snap.meshKey = key;
  return snap;
}

// 이 뷰의 랜드마크(실측 → 실루엣 앵커 → 추정치). projectImagePointToHead와 동일한 순서.
function getViewLandmarksFor(angle){
  return (state.landmarks && state.landmarks[angle])
      || computeSilhouetteAnchors(angle)
      || getEstimatedLandmarks(angle);
}

/* 결과 화면의 <b>원본</b> 프레이밍 — 두상을 오려내려면 머리·목이 프레임 안에
   온전히 있어야 한다. zoomFitToHair는 확대만 하고(k>1.02) 축소는 안 해서, 가로가
   긴 창처럼 머리가 프레임보다 큰 경우엔 잘린 채로 돌려준다. 여기선 축소도 허용한다. */
function computeResultSourceFit(img, maskInf, angle, w, h){
  const base = computeFit(img.width, img.height, w, h);
  try{
    const box = maskInf ? hairBoxOf(maskInf) : null;
    if(!box) return computeFitContain(img.width, img.height, w, h);
    const lm = getViewLandmarksFor(angle);
    // 아래로는 "귀선 + (정수리~귀선)×1.6" 까지 — 목·어깨 윗부분이 들어오도록
    const earN   = (lm && lm.earY > box.y0) ? lm.earY : (box.y0 + (box.y1-box.y0)*0.45);
    const bottom = Math.max(box.y1, earN + (earN - box.y0) * 1.6);
    const x0 = Math.max(0, box.x0 - 0.06), x1 = Math.min(1, box.x1 + 0.06);
    const y0 = Math.max(0, box.y0 - 0.05), y1 = Math.min(1, bottom + 0.05);
    const spanX = (x1-x0) || 1, spanY = (y1-y0) || 1;
    const k = Math.min(w/(spanX*base.dw), h/(spanY*base.dh));
    if(!(k > 0.05) || !isFinite(k)) return base;
    const dw = base.dw*k, dh = base.dh*k;
    const cx = (x0+x1)/2, cy = (y0+y1)/2;
    return { dw, dh, dx: w/2 - cx*dw, dy: h/2 - cy*dh };
  }catch(e){
    console.warn('[결과] 원본 프레이밍 계산 실패 — 덮기로 폴백:', e);
    return base;
  }
}

/* ── 목 실측: 사진 실루엣에서 직접 (2026-08-02 9차) ────────────────────────
   턱 아래로 내려가면 사람 실루엣은 <b>좁아졌다가(목) 다시 넓어진다(어깨)</b>.
   그 최소폭 행이 이 사람의 목이다. 여기서 나오는 두 값이 결과 화면의 정렬을
   전부 결정한다:
     · 폭   — 오려낼 목 기둥의 반폭. 예전엔 고정 0.55단위(≈18cm 폭)라 어깨와
              고객이 입고 온 옷이 통째로 딸려 왔다.
     · 중심 — 몸에 붙일 <b>가로 기준점</b>. 예전엔 좌우 귀 중점을 썼는데, 옆모습에서
              귀는 목보다 앞에 있어 머리가 몸 앞으로 밀려났다.
   반환값은 전부 <b>렌더 캔버스 픽셀</b>. 실측이 사람 범위를 벗어나면 null을
   돌려주고 호출부는 예전 상수 경로로 폴백한다(조용히 틀리는 것보다 낫다). */
function measureNeckColumn(angle, fit, pxPerMesh, chinPxY, headCxPx, headWidthPx){
  const inf = state.hairMasks && state.hairMasks[angle];
  const pmRaw = inf && inf.personMask;
  const mw  = inf && inf.maskW, mh = inf && inf.maskH;
  if(!pmRaw || !(mw > 4) || !(mh > 4) || !(pxPerMesh > 1)) return null;
  /* 머리카락은 <b>빼고</b> 잰다. 긴 머리는 목·어깨를 덮어서 실루엣이 아예 안
     좁아진다 — 그대로 재면 "목 폭 = 머리 폭"이 나와 실측이 무의미해진다.
     reasonMask===1이 최종 머리카락 픽셀이라 같은 해상도에서 바로 뺄 수 있다.
     잘려나간 머리는 뒤에서 헤어 레이어를 합집합하며 그대로 되살아난다. */
  const rm = inf.reasonMask;
  if(!inf._bodyNoHairMask && rm && rm.length === pmRaw.length){
    const b = new Uint8Array(pmRaw.length);
    for(let i=0;i<b.length;i++) b[i] = (pmRaw[i] && rm[i] !== 1) ? 1 : 0;
    inf._bodyNoHairMask = b;   // 이 뷰에서 한 번만 만든다(마스크가 바뀌면 inf 자체가 새로 만들어짐)
  }
  const pm = inf._bodyNoHairMask || pmRaw;
  const toRow   = (py)=> ((py - fit.dy) / fit.dh) * mh;
  const toCol   = (px)=> ((px - fit.dx) / fit.dw) * mw;
  const rowToPy = (r)=> fit.dy + (r / mh) * fit.dh;
  const colToPx = (c)=> fit.dx + (c / mw) * fit.dw;

  const r0 = Math.max(0, Math.round(toRow(chinPxY)));
  // 턱에서 아래로 1.0단위(≈16cm)까지만 본다 — 목과 어깨 시작이 이 안에 들어온다.
  const r1 = Math.min(mh - 1, Math.round(toRow(chinPxY + pxPerMesh)));
  if(!(r1 > r0 + 2)) return null;
  const searchCols = Math.max(2, ((headWidthPx / fit.dw) * mw) / 2);

  /* 그 행에서 c를 품는 연속 구간. c가 실루엣 밖이면 좌우로 가장 가까운 구간을
     잡는다(고개가 기울어 목이 옆으로 밀린 경우). */
  const runAt = (y, c)=>{
    const base = y * mw;
    let x = Math.max(0, Math.min(mw - 1, Math.round(c)));
    if(!pm[base + x]){
      let found = -1;
      for(let d = 1; d <= searchCols; d++){
        if(x - d >= 0   && pm[base + x - d]){ found = x - d; break; }
        if(x + d < mw   && pm[base + x + d]){ found = x + d; break; }
      }
      if(found < 0) return null;
      x = found;
    }
    let l = x; while(l > 0      && pm[base + l - 1]) l--;
    let r = x; while(r < mw - 1 && pm[base + r + 1]) r++;
    return { w: r - l + 1, c: (l + r) / 2 };
  };

  let c = toCol(headCxPx);
  let min = null; const rows = [];
  for(let y = r0; y <= r1; y++){
    const run = runAt(y, c);
    if(!run) break;                      // 실루엣이 끊기면 거기까지
    rows.push({ y, w: run.w, c: run.c });
    c = run.c;                           // 다음 행은 이 행의 중심에서 이어 찾는다
    if(!min || run.w < min.w) min = { y, w: run.w, c: run.c };
  }
  if(!min || rows.length < 3) return null;
  // 어깨 시작 = 최소폭 행 아래에서 폭이 1.45배를 넘는 첫 행(없으면 탐색 끝)
  let shoulderRow = rows[rows.length-1].y;
  for(const rw of rows){ if(rw.y > min.y && rw.w > min.w * 1.45){ shoulderRow = rw.y; break; } }

  const widthMesh = ((min.w / mw) * fit.dw) / pxPerMesh;
  /* 정직성 점검 — 목 폭이 0.35~1.15단위(≈6~19cm)를 벗어나면 실루엣이 아니라
     그림자·옷·팔을 잰 것으로 본다. 그때는 null(폴백)이 맞는 답이다. */
  if(!(widthMesh > 0.35 && widthMesh < 1.15)) return null;
  return {
    cxPx: colToPx(min.c),
    halfPx: ((min.w / 2 / mw) * fit.dw),
    minPxY: rowToPy(min.y),
    shoulderPxY: rowToPy(shoulderRow),
    widthMesh,
  };
}

/* 이 뷰에서 두상의 자·기준점. 정수리~귀선(네 뷰 공통으로 재지는 유일한 세로 구간)에
   이 사람의 자를 맞춘다. 결과가 두상 실루엣 폭과 크게 어긋나면 폭 기준으로 되돌린다. */
function getViewHeadAnchor(angle, fit, maskInf){
  const ref = getPersonScaleRef();
  const lm  = getViewLandmarksFor(angle);
  if(!ref || !lm) return null;
  const box = maskInf ? hairBoxOf(maskInf) : null;
  const earN = (box && lm.earY > box.y0 + 0.01) ? lm.earY
             : (box ? box.y0 + (box.y1-box.y0)*0.45 : lm.earY);
  let pxPerMesh = null, headHalfMesh = 0.75, scaleSrc = '정수리~귀선';

  /* ── 얼굴 랜드마크가 없는 뷰(=후면)는 정면 실루엣과 맞춘다 (11차) ─────────
     사용자: "후면은 랜드마크가 없어서 두상 형성에 기여를 안 한다. 전면과 후면의
     두상 실루엣이 거의 유사하니 그걸 비교해서 후면 위치를 잡자."
     여기서 쓰던 두 값이 모두 <b>추정치</b>였다:
       · 세로 자 — earN이 실측 귀가 아니라 "실루엣의 45% 높이"라는 가정
       · 폴백 폭 — "두상 폭 ≈ 1.45단위"라는 <b>고정 상수</b>. 이 사람 실측은
                   0.92단위였으니 자가 1.58배 작게 잡히고, 그만큼 두상이
                   크게 그려졌다(후면 스크린샷의 거대한 머리가 정확히 이것).
     대신 정면에서 <b>메쉬 단위로 재둔 윗머리 폭</b>에 이 뷰의 같은 자리 폭을
     맞춘다. 박스 전체 폭이 아니라 윗머리인 이유: 긴 머리가 뒤에서 옆으로
     퍼지면 박스 폭은 앞뒤가 크게 달라지지만, 두개골에 붙은 윗머리는 어느
     각도에서 봐도 폭이 거의 같다(여자 후면에서 두상이 작아진 원인이 이것).
     세로는 <b>정수리</b>로 잡는다 — 정수리 높이는 앞뒤가 같고, 실측값이다. */
  const hasFaceLm = !!(state.landmarks && state.landmarks[angle]);
  if(box && !hasFaceLm && ref.upperWidthMesh > 0.05){
    // 폭을 잴 행이 자에 의존하므로 두 번 되풀이해 수렴시킨다(첫 추정은 박스 폭).
    pxPerMesh = ((box.x1 - box.x0) * fit.dw) / (ref.hairWidthMesh || 1.0);
    for(let it=0; it<2; it++){
      const rowNorm = box.y0 + (ref.upperDepthMesh * pxPerMesh) / fit.dh;
      const wNorm = hairWidthAtRowNorm(maskInf, rowNorm);
      if(!(wNorm > 0.02)) break;
      pxPerMesh = (wNorm * fit.dw) / ref.upperWidthMesh;
    }
    scaleSrc = '정면 윗머리 폭 대조';
  } else if(box){
    pxPerMesh = ((earN - box.y0) * fit.dh) / ref.crownToEarMesh;
    // 교차검증: 두상 실루엣 폭이 메쉬 단위로 0.6~2.6을 벗어나면 앵커가 튄 것으로 본다
    const widthMesh = ((box.x1 - box.x0) * fit.dw) / (pxPerMesh || 1);
    if(!(pxPerMesh > 1) || !isFinite(pxPerMesh) || widthMesh < 0.6 || widthMesh > 2.6){
      console.warn(`[결과] ${angle}: 정수리~귀선 자가 어긋남(두상폭 ${widthMesh.toFixed(2)}단위)`
        + ' — 정면 실루엣 폭으로 대체');
      // 고정 1.45 상수 폐기 — 이 사람 정면에서 실제로 잰 폭에 맞춘다.
      pxPerMesh = ((box.x1 - box.x0) * fit.dw) / (ref.hairWidthMesh || 1.45);
      scaleSrc = '정면 박스 폭 대조';
    }
  } else if((lm.chinY - lm.eyeY) > 0.01){
    // 헤어 실루엣(scalpY)이 아직 없는 경우 — 눈~턱 자로 폴백(정면·측면에서만 유효)
    pxPerMesh = ((lm.chinY - lm.eyeY) * fit.dh) / (0.15 - ref.chinMeshY);
    scaleSrc = '눈~턱';
  }
  if(!(pxPerMesh > 1) || !isFinite(pxPerMesh)) return null;
  if(box) headHalfMesh = Math.max(0.5, ((box.x1 - box.x0) * fit.dw) / pxPerMesh / 2);

  /* 세로·가로 기준점. 얼굴 랜드마크가 없으면 귀 위치도 추정치이므로
     <b>정수리</b>(실측)에서 이 사람의 자로 귀 높이를 역산하고, 가로는
     실루엣 중앙을 쓴다(뒤통수는 좌우 대칭이라 중앙이 곧 목 축이다). */
  const earPxY = (box && !hasFaceLm)
    ? (fit.dy + box.y0 * fit.dh + (ref.crownMeshY - ref.earMeshY) * pxPerMesh)
    : (fit.dy + earN * fit.dh);
  const earPxX = (box && !hasFaceLm)
    ? (fit.dx + ((box.x0 + box.x1) / 2) * fit.dw)
    : (fit.dx + ((lm.lEarX + lm.rEarX)/2) * fit.dw);
  const meshToPx = (m)=> earPxY + (ref.earMeshY - m) * pxPerMesh;   // 이 뷰의 세로 자
  const chinPxY   = meshToPx(ref.chinMeshY);
  const collarPxY = meshToPx(ref.chinMeshY - ref.neckLenMesh);      // 옷깃선
  // 자르는 선 = 옷깃선보다 0.30단위(≈5cm) 아래 — 그 구간은 옷이 덮으므로 안 보인다
  let cutPxY = RESULT_NECK_FROM_3D
    ? (chinPxY + RESULT_HEAD_CUT.chinDrop * pxPerMesh)   // 턱까지만(8차)
    : (collarPxY + 0.30 * pxPerMesh);

  /* ── 목 실측 (2026-08-02 9차) ─────────────────────────────────────────
     사용자: "목보다 어깨보다도 아래에서 잘렸고, 위치도 안 맞아."
     아래 세 값이 전부 <b>이 사진에서</b> 나오도록 바꾼다(상수·추정 → 실측). */
  const neck = measureNeckColumn(angle, fit, pxPerMesh, chinPxY, earPxX,
                                 headHalfMesh * 2 * pxPerMesh);
  let alignX = earPxX, alignSrc = '귀 중점';
  if(neck){
    // 귀 중점에서 0.6단위(≈10cm) 넘게 떨어지면 실측이 아니라 오탐으로 본다.
    if(Math.abs(neck.cxPx - earPxX) <= 0.6 * pxPerMesh){ alignX = neck.cxPx; alignSrc = '목 실측'; }
    else console.warn(`[결과] ${angle}: 목 중심 실측이 귀 중점에서 `
      + `${((neck.cxPx-earPxX)/pxPerMesh).toFixed(2)}단위 떨어져 있어 무시 — 귀 중점 사용`);
  }
  /* collarPxY·cutPxY·headDropMesh는 여기서 <b>기본값</b>만 잡는다. 사진 색으로
     "고객 옷이 어디서 시작하나"를 잰 뒤 fitCollarToGarment가 확정한다(10차). */
  return {
    pxPerMesh, headHalfMesh, neck, alignX, alignSrc, scaleSrc,
    earPx: { x: earPxX, y: earPxY },
    chinPxY, collarPxY, cutPxY,
    neckLenMesh: ref.neckLenMesh, headDropMesh: ref.headDropMesh,
    garmentDrop: null, garmentSrc: '미측정',
  };
}

/* ── 고객이 입고 온 옷이 어디서 시작하나 (2026-08-02 10차) ────────────────
   사용자: "아직 옷깃까지 보이게 잘려."
   9차에서 자르는 선을 어깨 시작에 맞췄지만, 진단 로그를 보니 옷깃선(턱+0.41단위
   = 8cm 고정)이 <b>어깨 시작(턱+0.19)보다 아래</b>였다. 즉 자르는 선을 아무리
   당겨도 "옷깃선 위로는 안 자른다"는 안전장치에 걸려 그 사이 셔츠가 남는다.
   진짜 고쳐야 할 것은 자르는 선이 아니라 <b>옷깃선</b>이었다 — 8cm는 성인 평균
   목 길이일 뿐, 이 사람이 <b>어떤 옷을 입고 왔는지</b>는 모르는 숫자다.
   그래서 사진에서 잰다: 목 기둥을 따라 내려가며 <b>피부가 끝나는 행</b>.
   실루엣 폭으로는 못 가른다(셔츠 깃은 목보다 넓지 않게 서 있고, 머리카락이
   목을 덮으면 아예 안 좁아진다). 색이 정답이다 — 이 뷰에서 이미 실측해둔
   피부톤(maskInf.scalpColor)과 <b>색조</b>가 다른 행이 옷이다.
   밝기가 아니라 색조로 보는 이유: 그늘진 목도 피부고, 흰 셔츠는 밝지만 무채색이다. */
function measureGarmentStartPxY(angle, fit, img, chinPxY, cxPx, halfPx, pxPerMesh){
  const inf = state.hairMasks && state.hairMasks[angle];
  if(!inf || !img || !inf.scalpColor) return null;
  const mw = inf.maskW, mh = inf.maskH;
  if(!(mw > 4) || !(mh > 4)) return null;
  const m = /(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(inf.scalpColor);
  if(!m) return null;
  const SR = +m[1], SG = +m[2], SB = +m[3];
  const ss = SR + SG + SB + 1;
  const sr = SR/ss, sg = SG/ss, sL = (SR + SG + SB) / 3 + 1;

  if(!inf._photoSmall){
    const c = document.createElement('canvas'); c.width = mw; c.height = mh;
    const cx = c.getContext('2d', { willReadFrequently:true });
    cx.drawImage(img, 0, 0, mw, mh);
    inf._photoSmall = cx.getImageData(0, 0, mw, mh).data;   // 이 뷰에서 한 번만
  }
  const d = inf._photoSmall;
  const pm = inf.personMask;

  const toRow = (py)=> ((py - fit.dy) / fit.dh) * mh;
  const toCol = (px)=> ((px - fit.dx) / fit.dw) * mw;
  const r0 = Math.max(0, Math.round(toRow(chinPxY)) + 1);
  const r1 = Math.min(mh - 1, Math.round(toRow(chinPxY + pxPerMesh)));
  const cCol = toCol(cxPx);
  const hCol = Math.max(1, (halfPx / fit.dw) * mw * 0.6);   // 목 기둥 가운데 60%만
  const x0 = Math.max(0, Math.round(cCol - hCol)), x1 = Math.min(mw - 1, Math.round(cCol + hCol));
  if(!(r1 > r0 + 4) || !(x1 > x0)) return null;

  // 턱 바로 아래 몇 줄은 턱 그림자라 피부 판정이 흔들린다 — 0.10단위(≈2cm) 아래부터 본다.
  const minRow = Math.round(toRow(chinPxY + 0.10 * pxPerMesh));
  let streak = 0, startRow = -1;
  for(let y = r0; y <= r1; y++){
    let n = 0, skin = 0;
    for(let x = x0; x <= x1; x++){
      const i = y*mw + x;
      if(pm && !pm[i]) continue;                 // 배경은 세지 않는다
      const p = i*4, r = d[p], g = d[p+1], b = d[p+2];
      const s = r + g + b + 1;
      n++;
      const dist = Math.abs(r/s - sr) + Math.abs(g/s - sg);   // 색조 거리
      const lum  = ((r + g + b) / 3 + 1) / sL;                // 밝기 비
      if(dist < 0.045 && lum > 0.45 && lum < 1.9) skin++;
    }
    if(n < 3) continue;
    const frac = skin / n;
    if(frac < 0.5){
      if(streak === 0) startRow = y;
      if(++streak >= 3 && startRow >= minRow){
        return fit.dy + (startRow / mh) * fit.dh;
      }
    } else { streak = 0; startRow = -1; }
  }
  return null;   // 자르는 창 안에서 피부가 끝나지 않았다 — 옷깃이 낮은 옷
}

/* 위 실측을 anchor에 반영한다. 옷깃선(그리고 그에 매인 두상 내림·자르는 선)은
   여기서 확정된다 — 뷰마다 사진이 다르므로 뷰마다 잰다. */
function fitCollarToGarment(angle, fit, img, anchor, ref){
  const u = anchor.pxPerMesh, chin = anchor.chinPxY;
  const halfPx = anchor.neck ? anchor.neck.halfPx : 0.55 * u;
  const cxPx   = anchor.neck ? anchor.neck.cxPx   : anchor.earPx.x;
  let drop = null, src = '없음(기본 8cm)';
  const gPx = measureGarmentStartPxY(angle, fit, img, chin, cxPx, halfPx, u);
  if(gPx != null){ drop = (gPx - chin) / u; src = '피부 끝(색)'; }
  else if(anchor.neck){
    /* 색으로 못 찾으면 실루엣이 넓어지는 자리로 폴백. 단 턱+0.20단위(≈4cm)보다
       위면 목이라기엔 너무 짧아 오탐으로 본다(9차에서 이 값이 튀어 헛짚었다). */
    const sd = (anchor.neck.shoulderPxY - chin) / u;
    if(sd >= 0.20){ drop = sd; src = '어깨 시작(폭)'; }
  }
  anchor.garmentDrop = drop;
  anchor.garmentSrc  = src;

  // 옷깃선 = 턱+8cm. 단 고객 옷이 그보다 먼저 시작하면 그 <b>위</b>로 올린다.
  let neckLen = ref.neckLenMesh;
  if(drop != null) neckLen = Math.max(0.15, Math.min(neckLen, drop - 0.02));
  anchor.neckLenMesh  = neckLen;
  anchor.headDropMesh = (getNeckBottomY() + neckLen) - ref.chinMeshY;
  anchor.collarPxY    = chin + neckLen * u;
  /* 자르는 선 — 예전엔 <b>옷깃 아래 0.30단위</b>였다. 이음매를 옷깃 밑에 숨기려던
     것인데, 그 0.30 안에 손님이 입고 온 옷깃이 같이 들어왔다(사용자: "옷깃은
     첨부터 계~~속 딸려왔어"). 이제 사진은 <b>턱까지만</b> 쓰고 그 아래 목은 3D가
     그린다 — 사진에 목이 없으니 손님 옷깃이 원리적으로 못 들어온다.
     "옷깃선 위로는 안 자른다"는 옛 규칙은 <b>3D 목이 없을 때</b>의 규칙이었다.
     이제 그 사이는 배경이 아니라 목 메쉬가 채운다. */
  if(RESULT_NECK_FROM_3D){
    anchor.cutPxY = chin + RESULT_HEAD_CUT.chinDrop * u;
  }else{
    const want = (drop != null) ? Math.min(anchor.collarPxY + 0.30*u, chin + (drop + 0.06)*u)
                                : anchor.collarPxY + 0.30*u;
    anchor.cutPxY = Math.max(anchor.collarPxY + 0.05*u, want);
  }
}

/* 사진 배경색 표본 — 오려낸 두상 뒤에 깔 그라데이션.
   그 사진의 배경을 그대로 물려받으므로, 헤어 경계나 세그멘테이션이 조금 넘쳐도
   배경끼리 만나 티가 안 난다(단색 스튜디오 배경을 새로 지어내면 다 드러난다). */
function sampleBackdrop(angle, img){
  const fallback = { top:'#26221E', bottom:'#141110' };
  try{
    const maskInf = state.hairMasks && state.hairMasks[angle];
    const pm = maskInf && maskInf.personMask;
    const mw = maskInf && maskInf.maskW, mh = maskInf && maskInf.maskH;
    if(!pm || !(mw>0) || !(mh>0) || !img) return fallback;
    const c = document.createElement('canvas'); c.width = mw; c.height = mh;
    const cx = c.getContext('2d');
    cx.drawImage(img, 0, 0, mw, mh);
    const d = cx.getImageData(0, 0, mw, mh).data;
    const acc = (y0, y1)=>{
      let r=0,g=0,b=0,n=0;
      for(let y=y0;y<y1;y++) for(let x=0;x<mw;x++){
        if(pm[y*mw+x]) continue;
        const i=(y*mw+x)*4; r+=d[i]; g+=d[i+1]; b+=d[i+2]; n++;
      }
      return n ? `rgb(${Math.round(r/n)},${Math.round(g/n)},${Math.round(b/n)})` : null;
    };
    const top = acc(0, Math.max(1, Math.round(mh*0.25)));
    const bot = acc(Math.round(mh*0.75), mh);
    return { top: top || fallback.top, bottom: bot || top || fallback.bottom };
  }catch(e){
    return fallback;
  }
}

/* ── 턱선 컷 (2026-08-31 9차) ────────────────────────────────────────────────
   사용자: "2D 전신상 화면에서 사진을 자르는데 <b>턱선을 살리면서 바로 아래를 잘라서</b>
   3D 목에다가 얹는 게 되는지 시도해봐."

   8차가 "사진은 턱까지, 목은 3D"로 구조를 바꿨는데, 자르는 선은 <b>가로 직선</b>
   하나였다(cutPxY = 턱 + 0.10단위). 사람 턱은 직선이 아니다 — 턱 끝이 가장 낮고
   하악각(귀밑)으로 갈수록 3~4cm 올라간다. 그 차이만큼:
     · 턱 <b>옆</b>은 직선이 한참 아래를 지나므로 손님 목·옷깃이 다시 들어온다
       (8차가 없애려던 바로 그것이 옆구리로 돌아온다)
     · 정면에서는 턱 밑에 <b>가로 띠</b>가 보인다. 곡면(턱)을 직선으로 자른 자국이다.

   그래서 MediaPipe 얼굴 윤곽의 <b>아래 호</b>를 그대로 따라 자른다. 자르는 양은
   8차와 같다(그 호에서 chinDrop만큼 내려간 곳) — 바꾸는 것은 <b>모양</b>뿐이라
   3D 목과의 계약(cutPxY 상한)은 그대로 지킨다.

   ⚠ 맞바꾼 것 — 하악각 아래가 높이 잘리면 그 자리를 3D 목이 못 채워 <b>배경이
     비치는 노치</b>가 생길 수 있다. 그래서 가로 직선보다 maxRiseMesh 이상은 위로
     안 올라가게 막는다(턱선 모양은 살고, 노치는 안 생기는 절충). 이 값이 이번
     변경에서 실기기로 <b>먼저 확인해야 할 숫자</b>다.
   ⚠ 후면처럼 얼굴 랜드마크가 없는 뷰는 <b>예전 가로 직선 그대로</b>다(null 반환).
     새 실패 모드를 만들지 않는다.
   되돌리기: RESULT_JAW_CUT.on = false */
const RESULT_JAW_CUT = {
  on: true,
  dropMesh: 0.04,     // 턱 호에서 이만큼(메쉬단위 ≈0.7cm)만 내려가 자른다
  maxRiseMesh: 0.34,  // 턱 호 <b>안에서만</b> — 가로 직선보다 이 이상 위로는 안 간다
};
/* 얼굴 윤곽(FACE_OVAL)의 <b>아래 호</b> — 왼쪽 귀밑 → 턱끝(152) → 오른쪽 귀밑을
   이어지는 순서로 늘어놓은 것. 위쪽(이마) 호는 자를 일이 없어 뺐다.
   152(턱끝)는 이 파일이 detectFaceLandmarks에서 chin으로 이미 쓰는 인덱스다 —
   새 인덱스를 추측하지 않고 같은 규약을 따른다. */
const JAW_ARC_IDX = [132,58,172,136,150,149,176,148,152,377,400,378,379,365,397,288,361];
/* 마스크 열마다 "이 행부터 아래는 버린다"를 담은 배열. 좌표 변환이 필요 없는 이유:
   마스크 열 = (fit.dx + u·fit.dw − fit.dx)/fit.dw·mw = u·mw 로 fit이 약분된다.

   ── 9차의 잘못 (2026-08-31 10차) ────────────────────────────────────────────
   9차는 턱 호 <b>바깥</b>을 끝점 높이로 수평 연장했다. 정면에선 표가 안 났는데
   옆모습에서 크게 틀렸다 — 그 끝점(132/361)이 귀 밑이라, 귀보다 뒤는 전부 귀
   높이에서 잘린다. 즉 <b>뒤통수 아래쪽이 통째로 날아간다</b>(실기기: 측면 결과에서
   머리 뒤가 세로로 싹둑).
   사용자: "턱 뒤쪽으로는 <b>두상타원을 기준으로</b> 남기는 게 맞는 거 같아."
   맞다. 턱 뒤에 있는 것은 턱이 아니라 두개골이고, 그 경계는 이 파일이 이미
   실측해서 들고 있다(getDisplaySkullEllipsoid). 호 바깥은 그 타원의 아래 호를
   따라간다 — 이음매에서 값이 튀지 않도록 <b>호 끝점을 지나도록 평행이동</b>해서
   붙인다(새 상수 없이 연속이 보장된다).

   덤으로 후면 뷰가 같이 고쳐진다. 후면은 얼굴 랜드마크가 원리적으로 없어서 9차엔
   null을 돌려주고 예전 가로 직선으로 떨어졌는데(실기기: 뒤통수가 <b>직사각형</b>),
   두상 타원은 각도와 무관하게 있으므로 <b>타원만으로</b> 자를 수 있다. */
function buildJawCutRows(angle, mw, mh, chinRow, cutRow, anchor, fit){
  if(!RESULT_JAW_CUT.on) return null;
  if(!anchor || !(anchor.pxPerMesh > 1) || !(mw > 4) || !(mh > 4) || !fit || !(fit.dh > 1)) return null;
  const pxPerMesh = anchor.pxPerMesh;
  const rowPerPx  = mh / fit.dh;              // 화면 px → 마스크 행
  const colPerPx  = mw / fit.dw;

  /* ── 두상 타원의 아래 호(마스크 행) ──
     축은 이 뷰의 가로 기준점(earPx.x), 세로 중심은 귀 높이 — 두개골 타원의 중심
     y=0.15가 곧 귀·눈 높이라는 것이 이 파일 전체의 규약이다. 반폭은 옆모습이면
     깊이(c), 정면/후면이면 폭(a)을 쓴다(정사영이라 그 축이 화면 가로가 된다). */
  let ellRow = null;
  try{
    const sk = getDisplaySkullEllipsoid();
    const sideView = (angle === 'left' || angle === 'right');
    const rxMesh = Math.max(0.05, sideView ? sk.c : sk.a);
    const ryMesh = Math.max(0.05, sk.b);
    const cxCol  = (anchor.earPx.x - fit.dx) * colPerPx;
    const cyRow  = (anchor.earPx.y - fit.dy) * rowPerPx;
    const rxCol  = rxMesh * pxPerMesh * colPerPx;
    const ryRow  = ryMesh * pxPerMesh * rowPerPx;
    ellRow = (x)=>{
      const u = Math.max(-1, Math.min(1, (x - cxCol) / rxCol));
      return cyRow + ryRow * Math.sqrt(Math.max(0, 1 - u*u));
    };
  }catch(e){ ellRow = null; }

  const lm  = getViewLandmarksFor(angle);
  const raw = lm && lm.rawLandmarks;
  const hasArc = !!(raw && raw.length >= 468);
  if(!hasArc && !ellRow) return null;   // 둘 다 없다 — 예전 가로 직선 그대로

  const rows = new Float32Array(mw).fill(NaN);
  let first = -1, last = -1;

  if(hasArc){
    const dropRows = RESULT_JAW_CUT.dropMesh * pxPerMesh * rowPerPx;
    const pts = [];
    for(const i of JAW_ARC_IDX){
      const p = raw[i];
      if(p) pts.push({ x: p.x * mw, y: p.y * mh + dropRows });
    }
    if(pts.length >= 4){
      /* 호를 <b>순서대로</b> 이어 래스터화하며 열마다 가장 아래 y를 남긴다.
         x로 정렬하면 옆모습에서 호가 접히는 구간이 지그재그가 된다 — "가장 아래"를
         취하면 접혀도 항상 <b>덜 자르는</b> 쪽으로 안전하게 기운다. */
      for(let j=0;j<pts.length-1;j++){
        const a = pts[j], b = pts[j+1];
        const x0 = Math.max(0, Math.floor(Math.min(a.x, b.x)));
        const x1 = Math.min(mw-1, Math.ceil(Math.max(a.x, b.x)));
        for(let x=x0; x<=x1; x++){
          const t = Math.abs(b.x - a.x) > 1e-6 ? (x - a.x)/(b.x - a.x) : 0;
          const y = a.y + (b.y - a.y) * Math.max(0, Math.min(1, t));
          if(Number.isNaN(rows[x]) || y > rows[x]) rows[x] = y;
        }
      }
      for(let x=0;x<mw;x++){ if(!Number.isNaN(rows[x])){ if(first<0) first=x; last=x; } }
      for(let x=first+1;x<last;x++) if(Number.isNaN(rows[x])) rows[x] = rows[x-1]; // 안쪽 빈 열
      /* 턱 호 <b>안에서만</b> 상승 제한. 하악각이 너무 높이 잘리면 그 자리를 3D 목이
         못 채워 배경 노치가 난다. 바깥(두상)에는 안 건다 — 거기는 노치가 아니라
         뒤통수라 타원이 곧 정답이다. */
      const rise = RESULT_JAW_CUT.maxRiseMesh * pxPerMesh * rowPerPx;
      for(let x=Math.max(0,first); x<=Math.min(mw-1,last); x++){
        if(rows[x] < cutRow - rise) rows[x] = cutRow - rise;
      }
    }
  }

  if(ellRow){
    /* 호 끝점을 지나도록 평행이동해서 잇는다(이음매에서 값이 안 튄다).
       호가 아예 없으면(후면) 이동 없이 타원 그대로. */
    const offL = (first >= 0) ? rows[first] - ellRow(first) : 0;
    const offR = (last  >= 0) ? rows[last]  - ellRow(last)  : 0;
    for(let x=0;x<mw;x++){
      if(!Number.isNaN(rows[x])) continue;
      rows[x] = ellRow(x) + (first < 0 ? 0 : (x < first ? offL : offR));
    }
  } else {
    for(let x=0;x<first;x++)     rows[x] = rows[first];
    for(let x=last+1;x<mw;x++)   rows[x] = rows[last];
  }

  // 아래로는 8차의 가로 직선(cutRow)을 절대 안 넘는다 — 그 계약은 그대로 지킨다.
  for(let x=0;x<mw;x++) if(rows[x] > cutRow) rows[x] = cutRow;
  return rows;
}

/* 두상 오려내기 — (사람 실루엣 ∩ 자르는 선 위) ∪ (렌더된 헤어 레이어).
   헤어 레이어를 합집합에 넣는 이유: 조정으로 길어진 머리는 원본 실루엣 밖으로
   나가는데, 그것도 두상의 일부다(어깨로 내려온 머리가 잘리면 안 된다). */
function buildHeadCutout(srcCanvas, angle, fit, hairLayer, cutPxY, chinPxY, neckHalfPx, neckCxPx, anchor){
  const W = srcCanvas.width, H = srcCanvas.height;
  const maskC = document.createElement('canvas'); maskC.width = W; maskC.height = H;
  const mctx = maskC.getContext('2d');

  const maskInf = state.hairMasks && state.hairMasks[angle];
  const pm = maskInf && maskInf.personMask;
  const mw = maskInf && maskInf.maskW, mh = maskInf && maskInf.maskH;
  if(pm && mw>0 && mh>0){
    // 사람 실루엣을 마스크 해상도에서 흰색으로 찍되, 자르는 선 아래는 버린다.
    const small = document.createElement('canvas'); small.width = mw; small.height = mh;
    const sctx = small.getContext('2d');
    const id = sctx.createImageData(mw, mh);
    const cutRow = ((cutPxY - fit.dy) / fit.dh) * mh;
    /* 자른 선을 살짝 흐리게. 예전엔 옷깃 밑에 숨을 자리였고, 8차부터는
       <b>턱 그림자</b> 안에서 3D 목으로 넘어가는 자리다. */
    const feather = Math.max(2, mh*0.02);
    // 턱보다 아래는 <b>목 기둥만</b> 남긴다. 그 높이의 사람 실루엣에는 이미 어깨가
    // 들어와 있어서, 그대로 오리면 고객이 입고 온 옷이 옷깃 옆으로 삐져나온다.
    // (턱 옆으로 내려온 머리는 아래에서 헤어 레이어를 합집합하며 되살아난다.)
    const chinRow = ((chinPxY - fit.dy) / fit.dh) * mh;
    const neckL = ((neckCxPx - neckHalfPx - fit.dx) / fit.dw) * mw;
    const neckR = ((neckCxPx + neckHalfPx - fit.dx) / fit.dw) * mw;
    /* (2026-08-31 9차) 턱선을 따라가는 곡선 컷. 없으면(후면 등) null이 와서
       아래 루프가 예전 가로 직선 그대로 돈다 — 위 buildJawCutRows 주석 참고. */
    const jawRows = buildJawCutRows(angle, mw, mh, chinRow, cutRow, anchor, fit);
    for(let y=0;y<mh;y++){
      let aRow = 255;
      if(y > cutRow) aRow = 0;
      else if(y > cutRow - feather) aRow = Math.round(255 * (cutRow - y)/feather);
      if(aRow === 0) continue;
      // 턱선 컷을 쓰면 턱 아래는 이미 곡선이 다 걷어내므로 목 기둥 좁히기는 안 건다.
      // (걸면 턱 <b>옆</b>이 세로로 잘려 턱선을 살리려던 목적과 정면충돌한다.)
      const narrow = !jawRows && (y > chinRow);
      for(let x=0;x<mw;x++){
        if(!pm[y*mw+x]) continue;
        if(narrow && (x < neckL || x > neckR)) continue;
        let a = aRow;
        if(jawRows){
          const jr = jawRows[x];
          if(y > jr) continue;
          else if(y > jr - feather) a = Math.min(a, Math.round(255 * (jr - y)/feather));
        }
        if(a === 0) continue;
        const i=(y*mw+x)*4;
        id.data[i]=255; id.data[i+1]=255; id.data[i+2]=255; id.data[i+3]=a;
      }
    }
    sctx.putImageData(id, 0, 0);
    mctx.imageSmoothingEnabled = true;
    mctx.drawImage(small, fit.dx, fit.dy, fit.dw, fit.dh);
  } else {
    // personMask가 없으면 자르지 못한다 — 헤어 레이어만으로는 얼굴이 빠지므로
    // 사각형 전체를 자르는 선까지 남긴다(최소한 화면이 비지 않게).
    mctx.fillStyle = '#fff';
    mctx.fillRect(0, 0, W, Math.max(0, cutPxY));
  }
  if(hairLayer) mctx.drawImage(hairLayer, 0, 0); // 합집합: 조정된 헤어

  const cut = document.createElement('canvas'); cut.width = W; cut.height = H;
  const cctx = cut.getContext('2d');
  cctx.drawImage(srcCanvas, 0, 0);
  cctx.globalCompositeOperation = 'destination-in';
  cctx.drawImage(maskC, 0, 0);
  return cut;
}

/* 이 뷰 각도로 몸을 정사영 렌더해서 스냅샷 + 그릴 위치를 돌려준다.
   yaw는 앱이 이미 쓰는 슬롯 기본각(ASSUMED_YAW_DEG)을 그대로 따른다. */
function renderBodySnapshot(snap, angle, ppm, cx, neckPxY, canvasH, headDrop){
  const yawDeg = (typeof ASSUMED_YAW_DEG !== 'undefined' && ASSUMED_YAW_DEG[angle] != null) ? ASSUMED_YAW_DEG[angle] : 0;
  snap.group.rotation.y = yawDeg * Math.PI / 180;
  snap.group.updateMatrixWorld(true);
  if(snap.neckGroup){                      // 목도 같은 각도로(스케일만 안 받는다)
    snap.neckGroup.visible = !!RESULT_NECK_FROM_3D;
    snap.neckGroup.rotation.y = snap.group.rotation.y;
    /* 목은 <b>사진 두상을 따라</b> 내려간다. 두상은 headDropMesh만큼 내려앉는데
       (손님 옷이 일찍 시작하면 옷깃선이 올라가고 그만큼 두상이 내려온다) 목이
       제자리에 있으면 턱과 목 윗단이 어긋나 이음매가 벌어진다.
       headDrop은 0 이하라서 목은 내려가기만 하고, 아래쪽은 옷깃에 가려진다. */
    snap.neckGroup.position.y = (typeof headDrop === 'number' && isFinite(headDrop)) ? headDrop : 0;
    snap.neckGroup.updateMatrixWorld(true);
  }

  const sideView = (angle === 'left' || angle === 'right');
  const halfX = Math.max(0.05, sideView ? snap.body.maxAbsZ : snap.body.maxAbsX) * 1.02;
  /* 오려내는 윗단 — 3D 목을 쓰면 <b>목 윗단</b>까지 올라간다(그래야 목이 들어온다).
     안 쓰면 예전대로 목 밑동(=옷깃선)이다. */
  const drop = (typeof headDrop === 'number' && isFinite(headDrop)) ? headDrop : 0;
  const top = RESULT_NECK_FROM_3D ? (getNeckTopY() + drop) : getNeckBottomY();
  // 캔버스 아래로 벗어나는 부분은 프러스텀에서 잘라 픽셀을 낭비하지 않는다.
  const maxDrawMeshH = (canvasH - neckPxY) / ppm;
  if(!(maxDrawMeshH > 0.05)){
    console.warn(`[결과] ${angle}: 옷깃선이 프레임 아래(${Math.round(neckPxY)}px > ${canvasH}px) — 의상이 화면에 안 들어옴`);
    return null;
  }
  const bottom = Math.max(snap.body.minY, top - maxDrawMeshH);
  if(!(top > bottom)) return null;

  const W = Math.round((halfX*2) * ppm), H = Math.round((top - bottom) * ppm);
  if(W < 8 || H < 8) return null;
  const k = Math.min(1, RESULT_BODY_FIT.maxSnapPx/Math.max(W,H));
  const rw = Math.max(8, Math.round(W*k)), rh = Math.max(8, Math.round(H*k));

  const cam = snap.camera;
  cam.left = -halfX; cam.right = halfX; cam.top = top; cam.bottom = bottom;
  cam.near = 0.01; cam.far = 100;
  cam.position.set(0, 0, 12); cam.lookAt(0, 0, 0);
  cam.updateProjectionMatrix();
  snap.renderer.setSize(rw, rh, false);
  snap.renderer.render(snap.scene, snap.camera);

  return {
    src: snap.renderer.domElement,
    x: cx - halfX*ppm,
    y: neckPxY - (RESULT_BODY_FIT.neckOverlapMesh || 0) * ppm, // 이음매를 옷깃 밑으로
    w: W, h: H,
  };
}

/* 만들어둔 재료(_resultScene)를 현재 확대/이동 상태로 배치해 그린다.
   확대·축소·드래그는 이 함수만 다시 부른다 — 2D 렌더와 오려내기는 다시 안 한다. */
function composeResult(){
  const sc = _resultScene;
  const canvas = document.getElementById('resultCanvas');
  if(!sc || !canvas || currentScreen !== 'result') return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const ref = sc.ref;

  // 배경(사진에서 물려받은 색)
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, sc.backdrop.top); g.addColorStop(1, sc.backdrop.bottom);
  ctx.setTransform(1,0,0,1,0,0);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  const bodyBot = sc.body ? sc.body.minY : (getNeckBottomY() - ref.headHeightMesh*FIGURE_HEADS*0.8);
  /* 두상은 headDropMesh만큼 내려 앉는다(목 길이 보정) — 프레이밍도 그 정수리 기준.
     (10차) 목 길이가 뷰마다 실측되므로 anchor 값이 있으면 그쪽이 우선이다. */
  const headDrop = (sc.anchor && sc.anchor.headDropMesh != null) ? sc.anchor.headDropMesh : ref.headDropMesh;
  const crownEff = ref.crownMeshY + headDrop;
  const figureH = Math.max(0.5, crownEff - bodyBot);
  const halfNeeded = Math.max(
    sc.anchor.headHalfMesh,
    sc.body ? ((sc.angle==='left'||sc.angle==='right') ? sc.body.maxAbsZ : sc.body.maxAbsX) : 0.5
  );
  const ppmFit = Math.min((H*FIGURE_FILL)/figureH, (W*0.9)/(2*halfNeeded));
  const ppm = ppmFit * RESULT_VIEW.zoom;
  const cx  = W/2 + RESULT_VIEW.panX + (RESULT_BODY_FIT.offsetXMesh||0)*ppm;
  const figTopPx = (H - figureH*ppm)/2 + RESULT_VIEW.panY;
  const meshToPx = (m)=> figTopPx + (crownEff - m) * ppm;
  sc.layout = { ppm, ppmFit, cx, figTopPx, figureH,
                headPxY: meshToPx(ref.earMeshY + headDrop) };

  const k = ppm / sc.anchor.pxPerMesh;                       // 두상 오려낸 그림의 배율
  /* 가로 정렬은 <b>목 중심</b>에 맞춘다(2026-08-02 9차). 몸은 목이 화면 cx에
     오도록 그려지므로(renderBodySnapshot: 메쉬 x=0 → cx), 사진 쪽도 목을 대야
     둘이 이어진다. 예전 기준이던 좌우 귀 중점은 옆모습에서 목보다 앞에 있어
     머리가 몸 앞으로 밀려났다(사용자: "위치도 안 맞아"). 실측 실패 시 귀 중점. */
  const headX = cx - (sc.anchor.alignX != null ? sc.anchor.alignX : sc.anchor.earPx.x) * k;
  const headY = meshToPx(ref.earMeshY + headDrop - (RESULT_BODY_FIT.offsetYMesh||0)) - sc.anchor.earPx.y * k;
  const drawHeadLike = (src)=>{
    ctx.drawImage(src, headX, headY, src.width * k, src.height * k);
  };

  ctx.imageSmoothingEnabled = true;
  /* ── 그리는 순서가 8차에 <b>뒤집혔다</b> ────────────────────────────────
     예전: [두상 → 의상]. 사진에 목·옷깃이 딸려 있으니 의상으로 <b>덮어</b> 가렸다.
     지금: [의상+목 → 두상]. 사진은 턱까지뿐이라 덮을 게 없고, 반대로 사진 턱이
     3D 목 윗단을 덮어야 이음매가 턱 그림자 안으로 들어간다. */
  const drawBody = ()=>{
    if(!(sc.snap && sc.body)) return;
    const topY = RESULT_NECK_FROM_3D ? (getNeckTopY() + headDrop) : getNeckBottomY();
    const shot = renderBodySnapshot(sc.snap, sc.angle, ppm, cx, meshToPx(topY), H, headDrop);
    if(shot) ctx.drawImage(shot.src, shot.x, shot.y, shot.w, shot.h);
  };
  if(RESULT_NECK_FROM_3D){
    drawBody();                 // [1] 의상 + 3D 목
    drawHeadLike(sc.cutout);    // [2] 사진 두상(턱까지) — 목 윗단을 덮는다
  }else{
    drawHeadLike(sc.cutout);    // [1] 오려낸 두상 (목이 옷깃 뒤로 들어가도록 먼저)
    drawBody();                 // [2] 추천 의상 전신
  }
  // [3] 헤어를 옷 위로 — 어깨에 내려온 머리가 옷 뒤로 숨지 않게
  if(sc.hairLayer) drawHeadLike(sc.hairLayer);

  const zEl = document.getElementById('resultZoomLabel');
  if(zEl) zEl.textContent = Math.round(RESULT_VIEW.zoom*100) + '%';
  /* (2026-08-29) 합성 완료 훅(_onResultComposed)은 실사 4각도 캡처만 쓰던 것이라
     그 구역과 함께 지웠다. 다시 필요해지면 여기가 그 자리다. */
}

/* 결과 화면 한 장 만들기 — 2D 결과물 렌더 → 두상 오려내기 → 배치(composeResult) */
function drawResult(){
  if(currentScreen !== 'result') return;
  const canvas = document.getElementById('resultCanvas');
  const stage  = document.getElementById('resultStage');
  if(!canvas || !stage) return;
  const pw = stage.clientWidth, ph = stage.clientHeight;
  if(pw === 0 || ph === 0){ setTimeout(()=>drawResult(), 80); return; }

  const angle = state.currentViewAngle;
  const gen = ++_resultGen;
  const badge = document.getElementById('resultViewBadge');
  if(badge) badge.textContent = ANGLE_LABELS[angle] || '';

  // [1] 조정 화면과 동일한 렌더 경로로 결과물을 그린다(원본 해상도 확보용 프레이밍).
  //     이 그림 자체는 화면에 남기지 않고, 두상만 오려내는 재료로 쓴다.
  renderFrame(canvas, angle, { resultFit:true, onDone: ({ fit, hairLayer })=>{
    if(gen !== _resultGen || currentScreen !== 'result') return;
    const rec = state.aiOutfitRecommendation;
    if(!fit){ console.warn('[결과] fit 없음 — 합성 생략:', angle); return; }

    const ref = getPersonScaleRef();
    const anchor = ref ? getViewHeadAnchor(angle, fit, state.hairMasks && state.hairMasks[angle]) : null;
    if(!ref || !anchor){
      console.warn('[결과] 두상 자 계산 실패 — 결과물만 표시:', angle);
      return;   // 렌더된 결과물이 그대로 남는다(빈 화면 방지)
    }

    // 원본 렌더를 사본으로 떠두고(캔버스는 곧 다시 그려진다) 두상만 오려낸다.
    const src = document.createElement('canvas');
    src.width = canvas.width; src.height = canvas.height;
    src.getContext('2d').drawImage(canvas, 0, 0);
    getCachedImg(angle, (img)=>{
      if(gen !== _resultGen || currentScreen !== 'result') return;
      /* 옷깃선을 이 <b>사진에</b> 맞춘다(2026-08-02 10차) — 사진을 받아야 색을
         볼 수 있으므로 여기서(getCachedImg 안에서) 잰다. anchor의
         collarPxY·cutPxY·headDropMesh가 이 호출로 확정된다. */
      fitCollarToGarment(angle, fit, img, anchor, ref);
      /* 턱 아래로 남길 <b>목 기둥</b>의 폭·중심. (2026-08-02 9차) 예전엔 고정
         0.55단위(폭 ≈18cm)를 귀 중점에 걸었다 — 목보다 훨씬 넓어서 어깨와 고객이
         입고 온 옷이 옷깃 옆으로 딸려 나왔다. 이제 실측 목 폭(여유 1.10배)을
         실측 목 중심에 건다. 실측 실패 시에만 예전 상수로 폴백. */
      const chinPxY    = anchor.chinPxY;
      const neckHalfPx = anchor.neck ? anchor.neck.halfPx * 1.10 : 0.55 * anchor.pxPerMesh;
      const neckCxPx   = anchor.neck ? anchor.neck.cxPx : anchor.earPx.x;
      const cutout = buildHeadCutout(src, angle, fit, hairLayer, anchor.cutPxY,
                                     chinPxY, neckHalfPx, neckCxPx, anchor);
      const backdrop = sampleBackdrop(angle, img);
      const finish = (snap)=>{
        if(gen !== _resultGen || currentScreen !== 'result') return;
        /* 이전 장면의 큰 캔버스를 <b>지금</b> 돌려준다 (2026-08-22).
           결과 화면은 뷰를 바꿀 때마다 화면 크기 캔버스를 두 장(오려낸 두상 +
           헤어 레이어) 새로 만든다. 참조를 놓기만 하면 GC가 올 때까지 백킹스토어가
           남아 있는데, 폰에서는 그 사이에 다음 장이 또 잡힌다 — 실기기에서
           "몇 번 왔다갔다하면 이미지가 하나도 안 뜬다"가 나온 자리다.
           ⚠ 새 장면이 확정된 <b>다음</b>에만 놓는다. 위 gen 검사에서 걸러진
             프레임은 화면에 아직 옛 장면이 걸려 있으므로 건드리면 안 된다. */
        const _old = _resultScene;
        _resultScene = { angle, ref, anchor, cutout, hairLayer, backdrop,
                         snap: snap || null, body: snap ? snap.body : null };
        if(_old && _old !== _resultScene){
          if(_old.cutout && _old.cutout !== cutout) releaseCanvas(_old.cutout);
          if(_old.hairLayer && _old.hairLayer !== hairLayer) releaseCanvas(_old.hairLayer);
        }
        composeResult();
        console.log(`[결과·정렬] ${angle} 두상자 1메쉬단위=${Math.round(anchor.pxPerMesh)}px(원본, ${anchor.scaleSrc})`
          + ` · 정수리~귀선 ${ref.crownToEarMesh.toFixed(2)}단위 · 두상높이 ${ref.headHeightMesh.toFixed(2)}단위`
          + ` · 전신 ${(ref.headHeightMesh*FIGURE_HEADS).toFixed(2)}단위`
          + (snap && snap.body ? ` · 몸 배율 ${snap.body.scale.toFixed(2)}` : ' · 의상 없음')
          + ` · 화면배율 ${_resultScene.layout ? Math.round(_resultScene.layout.ppm) : '?'}px/단위`
          + ` · 줌 ${Math.round(RESULT_VIEW.zoom*100)}%`
          /* 목 실측 한 줄 — 어긋나면 어느 숫자가 틀렸는지 바로 짚히도록.
             폭은 단위(1단위≈16cm), 나머지는 턱에서 아래로 몇 단위인지. */
          + (anchor.neck
              ? ` | 목 실측 폭 ${anchor.neck.widthMesh.toFixed(2)}단위`
                + ` · 중심 ${((anchor.neck.cxPx - anchor.earPx.x)/anchor.pxPerMesh).toFixed(2)}단위(귀 중점 대비)`
                + ` · 어깨시작 턱+${((anchor.neck.shoulderPxY - anchor.chinPxY)/anchor.pxPerMesh).toFixed(2)}`
                + ` · 가로기준 ${anchor.alignSrc}`
              : ' | 목 실측 실패 → 고정 0.55단위·귀 중점 폴백')
          + ` | 옷 시작 ${anchor.garmentSrc}`
          + (anchor.garmentDrop != null ? ` 턱+${anchor.garmentDrop.toFixed(2)}` : '')
          + ` · 옷깃 턱+${((anchor.collarPxY - anchor.chinPxY)/anchor.pxPerMesh).toFixed(2)}`
          + ` · 자름 턱+${((anchor.cutPxY - anchor.chinPxY)/anchor.pxPerMesh).toFixed(2)}`);
      };
      if(!rec){ finish(null); return; }   // 추천 도착 전 첫 렌더 — 두상만 먼저 보여준다
      ensureResultBodyMesh(rec.item, getFaceMetrics().widthFactor)
        .then(finish)
        .catch(e=>{ console.warn('의상 준비 실패(두상만 표시):', e); finish(null); });
    });
  }});
}

/* ── 확대/축소·이동 ──
   휠·핀치·드래그. 래스터를 늘리는 게 아니라 배율(ppm)을 바꿔 다시 배치하므로
   의상은 확대해도 또렷하다(3D를 그 배율로 다시 렌더). */
function resultZoomAt(nextZoom, px, py){
  const sc = _resultScene;
  const z0 = RESULT_VIEW.zoom;
  const z1 = Math.max(RESULT_VIEW.min, Math.min(RESULT_VIEW.max, nextZoom));
  if(Math.abs(z1 - z0) < 1e-4) return;
  // 버튼(+/−)처럼 기준점이 없으면 <b>머리</b>를 중심으로 확대한다 — 미용 상담에서
  // 확대해서 보고 싶은 건 화면 한가운데(허리)가 아니라 머리다.
  if(px == null && sc && sc.layout){ px = sc.layout.cx; py = sc.layout.headPxY; }
  /* (2026-08-29) 여기 있던 실사 모드 분기(가운데 정렬 + pan 배치식) 삭제 —
     결과 화면 배치가 sc.layout 한 가지뿐이라 갈라줄 이유가 없어졌다. */
  if(sc && sc.layout && px != null){
    // 커서 아래 지점이 제자리에 있도록 이동량 보정
    /* 배치식: figTopPx = (H - figureH·ppm)/2 + panY, ppm = ppmFit·zoom.
       커서(px,py) 아래 지점이 제자리에 있으려면 figTop을 r=z1/z0로 끌어당긴 뒤,
       "가운데 정렬" 항이 배율 따라 달라진 만큼을 panY에서 되돌려줘야 한다. */
    const r = z1/z0;
    const cx0 = sc.layout.cx, top0 = sc.layout.figTopPx;
    const cx1 = px - (px - cx0)*r;
    const top1 = py - (py - top0)*r;
    RESULT_VIEW.panX += (cx1 - cx0);
    RESULT_VIEW.panY += (top1 - top0) + (sc.layout.figureH * sc.layout.ppmFit * (z1 - z0))/2;
  }
  RESULT_VIEW.zoom = z1;
  composeResult();
}
function resultResetView(){
  RESULT_VIEW.zoom = 1; RESULT_VIEW.panX = 0; RESULT_VIEW.panY = 0;
  composeResult();
}
function bindResultViewGestures(){
  const stage = document.getElementById('resultStage');
  const canvas = document.getElementById('resultCanvas');
  if(!stage || stage._resultBound) return;
  stage._resultBound = true;
  const toCanvas = (e)=>{
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (canvas.width / (r.width||1)),
             y: (e.clientY - r.top)  * (canvas.height/ (r.height||1)) };
  };
  stage.addEventListener('wheel', (e)=>{
    if(currentScreen !== 'result') return;
    e.preventDefault();
    const p = toCanvas(e);
    resultZoomAt(RESULT_VIEW.zoom * (e.deltaY < 0 ? 1.12 : 1/1.12), p.x, p.y);
  }, { passive:false });

  const pts = new Map();
  let pinchStart = null, lastPan = null;
  stage.addEventListener('pointerdown', (e)=>{
    if(currentScreen !== 'result') return;
    stage.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, toCanvas(e));
    if(pts.size === 1) lastPan = toCanvas(e);
    if(pts.size === 2){
      const [a,b] = [...pts.values()];
      pinchStart = { dist: Math.hypot(a.x-b.x, a.y-b.y), zoom: RESULT_VIEW.zoom };
    }
  });
  stage.addEventListener('pointermove', (e)=>{
    if(!pts.has(e.pointerId)) return;
    const p = toCanvas(e);
    pts.set(e.pointerId, p);
    if(pts.size === 2 && pinchStart){
      const [a,b] = [...pts.values()];
      const d = Math.hypot(a.x-b.x, a.y-b.y);
      if(pinchStart.dist > 1){
        resultZoomAt(pinchStart.zoom * (d/pinchStart.dist), (a.x+b.x)/2, (a.y+b.y)/2);
      }
    } else if(pts.size === 1 && lastPan){
      RESULT_VIEW.panX += p.x - lastPan.x;
      RESULT_VIEW.panY += p.y - lastPan.y;
      lastPan = p;
      composeResult();
    }
  });
  const end = (e)=>{
    pts.delete(e.pointerId);
    if(pts.size < 2) pinchStart = null;
    if(pts.size === 0) lastPan = null;
  };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);
  stage.addEventListener('dblclick', ()=>resultResetView());
}

/* 추천 의상 카드 — 지금은 AI가 고른 1벌.
   쇼핑 링크(affiliateUrl)는 제휴 DB가 붙으면 그대로 살아나는 자리다. */
function renderOutfitCard(){
  const card = document.getElementById('outfitCard');
  const note = document.getElementById('resultOutfitNote');
  const rec  = state.aiOutfitRecommendation;
  if(!card) return;
  if(!rec || !rec.item){
    card.style.display = 'none';
    if(note) note.textContent = '의상 추천 없음';
    return;
  }
  card.style.display = 'flex';
  const it = rec.item;
  document.getElementById('outfitSwatch').style.background = it.colorHex || '#888';
  document.getElementById('outfitName').innerHTML = `${it.name}<span>${it.category}</span>`;
  document.getElementById('outfitReason').textContent = rec.reason || `${(it.tags||[]).join(' · ')}`;
  const shop = document.getElementById('outfitShop');
  if(shop){
    if(it.affiliateUrl){
      shop.href = it.affiliateUrl; shop.textContent = '쇼핑몰에서 보기 →';
      shop.classList.remove('disabled');
    } else {
      shop.removeAttribute('href'); shop.textContent = '제휴 준비중';
      shop.classList.add('disabled');
    }
  }
  if(note) note.textContent = `추천 의상 · ${it.name}`;
  renderOutfitPicker();
}

/* 의상 전환 — 지금은 화면에 안 띄우지만(RESULT_OUTFIT_PICKER=false) 경로는 살아 있다.
   나중에 제휴 상품 DB/쇼핑몰 응답이 생기면 그 목록으로 이 칩만 갈아끼우면 된다. */
function renderOutfitPicker(){
  const el = document.getElementById('outfitPicker');
  if(!el) return;
  if(!RESULT_OUTFIT_PICKER){ el.style.display='none'; return; }
  el.style.display = 'flex'; el.innerHTML = '';
  const curId = state.aiOutfitRecommendation && state.aiOutfitRecommendation.item && state.aiOutfitRecommendation.item.id;
  OUTFIT_CATALOG.forEach(o=>{
    const b = document.createElement('button');
    b.className = 'outfit-chip' + (o.id===curId ? ' on' : '');
    b.textContent = o.name;
    b.onclick = ()=>setResultOutfit(o.id);
    el.appendChild(b);
  });
}

// 외부(카탈로그 칩 / 제휴 DB / 쇼핑몰 딥링크)에서 의상을 갈아입히는 단일 진입점.
function setResultOutfit(idOrItem){
  const item = (typeof idOrItem === 'string')
    ? OUTFIT_CATALOG.find(o=>o.id===idOrItem)
    : idOrItem;
  if(!item) return;
  const prev = state.aiOutfitRecommendation;
  state.aiOutfitRecommendation = { item, reason: (prev && prev.item && prev.item.id===item.id && prev.reason) || '직접 선택한 의상' };
  renderOutfitCard();
  drawResult();
}
window.setResultOutfit = setResultOutfit;

/* 'result' 화면 진입 셋업. 의상 추천은 세션당 1회만 호출되고 캐시된다
   (3D 화면도 같은 캐시를 재사용 — 두 번 묻지 않는다). */
async function setupResultScreen(){
  unlockTab('result');
  renderAngleSwitch('angleSwitchResult');
  bindResultViewGestures();
  drawResult(); // 의상이 오기 전에도 두상부터 먼저 보여준다(화면 공백 방지)

  if(!state.aiOutfitRecommendation && state.shots && state.shots.front){
    showAI('AI가 어울리는 의상을 고르고 있어요…','헤어스타일 기반 추천 (데모)');
    try{ await recommendOutfitWithAI(); }
    catch(e){ console.warn('의상 추천 실패:', e); }
    hideAI();
  }
  if(currentScreen !== 'result') return;
  renderOutfitCard();
  drawResult();
}

window.addEventListener('resize', ()=>{ if(currentScreen==='result') drawResult(); });

/* ── (2026-08-29) 실사 생성(PHOTOREAL) 구역 삭제 ───────────────────────────
   사용자 지시: "결과화면을 photo랑 API를 통한 렌더링 두 가지를 선택하게 되어
   있는데, API는 안 쓸 거야. 그냥 PHOTO 결과만 나오게 할 거니까 정리해줘."

   지운 것: PHOTOREAL 설정 · _photoreal 캐시 · Worker 주소 정규화/설정/확인 ·
   4각도 순차 캡처(captureResultAngle) · 프롬프트 · callPhotorealAPI ·
   generatePhotoreal · drawPhotorealFrame · setPhotorealMode · renderPhotorealBar ·
   savePhotorealSheet, 그리고 결과 화면 하단의 렌더/실사 토글 바.
   같이 사라진 것: composeResult의 _onResultComposed 훅(실사 캡처 전용이었다),
   drawResult·resultZoomAt의 실사 분기, resetResultScreenCache의 캐시 비움.

   ⚠ 되살릴 때 주의: 이 경로는 브라우저에 키를 두지 않으려고 Cloudflare Worker
   프록시(gyeol_prProxy/gyeol_prToken)를 거쳤다. 코드만 되돌리면 안 되고 그
   Worker(worker.js)와 GEMINI_API_KEY가 같이 있어야 동작한다.
   ⚠ 남아 있는 AI: 결과 화면의 <b>의상 추천</b>(recommendOutfitWithAI)은 그대로다.
   이번 지시는 "결과 이미지 생성"에 대한 것이라 건드리지 않았다. */

/* ════════════════════════════════════════
   AI 호출 공통부 (구 AI ANALYSIS)
   (2026-08-29) 스타일 추천이 빠져서 이 구역에 남은 건 공통 호출부뿐이다.
════════════════════════════════════════ */
// Claude API 호출(이미지 1장 + 프롬프트 → JSON 응답)의 공통부.
// analyzeWithClaude(스타일 분석)와 recommendOutfitWithAI(의상 추천)가 fetch
// 설정·응답 블록 조립·```json 펜스 제거·JSON.parse를 글자 그대로 복제하고
// 있던 것을 통합(2026-07-18). 다른 건 프롬프트와 max_tokens뿐이라 인자로 받음.
// (2026-08-29) 호출부는 이제 recommendOutfitWithAI 하나다.
// 실패 시 예외를 그대로 던져서, 각 호출부가 이미 갖고 있는 catch가 자기
// 폴백(토스트 / 기본 의상)을 그대로 수행하게 함 — 동작 무변경.
async function callClaudeJSON({ base64, mediaType, prompt, maxTokens }){
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method:'POST',
    headers:{'Content-Type':'application/json','anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
    body: JSON.stringify({ model:'claude-sonnet-4-6', max_tokens:maxTokens, messages:[{ role:'user', content:[
      { type:'image', source:{ type:'base64', media_type:mediaType, data:base64 } },
      { type:'text', text:prompt }
    ]}]})
  });
  const data = await res.json().catch(()=>null);
  /* (2026-08-31) 응답 <b>상태를 안 보고</b> data.content를 바로 읽고 있었다.
     API가 4xx를 주면 본문은 {type:'error', error:{…}}라 content가 없고,
     `Cannot read properties of undefined (reading 'map')`이라는 <b>엉뚱한</b>
     TypeError로 터진다 — 실기기 콘솔에 401 바로 밑에 그 스택이 찍힌 자리다.
     호출부는 어차피 try/catch로 기본 항목 폴백을 하므로 동작은 같지만,
     <b>무엇이 잘못됐는지</b>가 로그에 남는 것과 안 남는 것은 다르다.
     (이 파일이 8/22에 얼굴 경로에서 겪은 것과 같은 종류 — 조용히 빠져나가면
      본 사람도 만든 사람도 원인을 모른다.) */
  if(!res.ok){
    const detail = (data && data.error && data.error.message) ? data.error.message : '';
    throw new Error(`Claude API ${res.status}${detail ? ' — ' + detail : ''}`
      + (res.status === 401 ? ' (이 파일을 로컬에서 열면 키가 없어 항상 401입니다 — 정상)' : ''));
  }
  if(!data || !Array.isArray(data.content)) throw new Error('Claude API 응답에 content가 없습니다');
  const raw = data.content.map(b=>b.text||'').join('').replace(/```json|```/g,'').trim();
  return JSON.parse(raw);
}

/* ── (2026-08-29) analyzeWithClaude(스타일 추천 AI) 삭제 ────────────────────
   사용자 지시: "스타일추천AI가 처음에 돌아가는데 일단 그 AI를 안 돌릴 거야."

   정면 사진 한 장을 Claude에 보내 얼굴형·머리색·현재 길이·추천 스타일 id를
   받아서 ① 조정 화면의 AI 분석 카드에 채우고 ② 스타일 카드에 '★ AI 추천'
   테두리를 켜던 함수였다. 두 표시 자리(.ai-card / .ai-rec)도 같이 지웠다.

   ⚠ 여기서 밟기 쉬운 함정 하나 — 스타일 화면 재진입 게이트가 `if(!aiAnalysis)`
     였다. 이 변수만 지우면 게이트가 늘 참이 되어 <b>스타일 화면에 들어갈
     때마다 4각도 세그멘테이션이 통째로 다시 돈다</b>(폰에서 수십 초). 그래서
     같은 뜻의 플래그 stylePrepDone으로 갈아끼웠다 — 재촬영·새 고객에서 함께
     초기화된다(그 두 자리가 예전에 aiAnalysis=null 하던 자리다).
   ⚠ callClaudeJSON은 <b>지우지 않았다</b>: 의상 추천(recommendOutfitWithAI)이
     같은 함수를 쓴다. */

/* ════════════════════════════════════════
   VOICE
════════════════════════════════════════ */
function toggleVoice(){
  if(listening){stopVoice();return;}
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){showToast('음성인식은 Chrome에서만 작동해요.');return;}
  recognition=new SR();
  recognition.lang=(uiLang==='en')?'en-US':'ko-KR';recognition.continuous=true;recognition.interimResults=false;
  recognition.onresult=e=>{ const t=e.results[e.results.length-1][0].transcript.trim(); handleVoiceCmd(t); };
  recognition.onerror=()=>stopVoice();
  recognition.onend=()=>{if(listening){try{recognition.start();}catch(e){}}};
  recognition.start(); listening=true;
  document.getElementById('voiceBtn').classList.add('listening');
  document.getElementById('voiceBtnLabel').textContent='듣는 중… (탭하여 종료)';
}
function stopVoice(){
  listening=false;
  if(recognition){try{recognition.stop();}catch(e){}}
  document.getElementById('voiceBtn').classList.remove('listening');
  document.getElementById('voiceBtnLabel').textContent='음성으로 조정하기';
}
function handleVoiceCmd(text){
  document.getElementById('voiceTranscript').innerHTML='인식됨: <b>"'+text+'"</b>';
  const t=text.toLowerCase().replace(/\s/g,'');   // 영어 명령도 같은 규칙으로 훑는다
  const STEP=15; let matched=false;

  // 섹션 선택
  /* (2026-08-26) 영어 키워드 추가 — 힌트 문구는 이미 'crown longer'로 번역돼
     나가는데 인식기는 ko-KR이고 키워드도 한국어뿐이라, 화면에 적힌 대로 말하면
     무조건 "못 알아들었다"가 떴다. 한국어 키워드는 그대로 둔다(둘 다 받는다). */
  const sectionMap = {
    '크라운':'crown','정수리':'crown','crown':'crown','top':'crown',
    '프론트':'front','앞머리':'front','front':'front','fringe':'front','bang':'front',
    '템플':'temple','관자':'temple','temple':'temple',
    '사이드':'side','옆머리':'side','side':'side',
    '후두부':'occipital','뒤통수':'occipital','occipital':'occipital',
    '네이프':'nape','목선':'nape','nape':'nape','neckline':'nape',
  };
  let targetSection = state.activePanelSection==='styling' ? state.currentSection : state.activePanelSection;
  let sectionSpoken = false;
  Object.entries(sectionMap).forEach(([kw,sid])=>{ if(t.includes(kw)){ targetSection=sid; sectionSpoken=true; } });
  if(sectionSpoken){ state.activePanelSection = targetSection; state.currentSection = targetSection; }

  const adj=(param,delta,min=0,max=100)=>{
    const s=state.sections[targetSection];
    if(typeof s[param]!=='number') return;
    const prev=s[param];
    s[param]=Math.max(min,Math.min(max,s[param]+delta));
    // 델타 기반 연동(래칫 버그 수정과 동일 규약) — 클램프 후 실제 변화량을 전달
    if(param==='length') propagateSectionChange(targetSection,'length',s[param]-prev);
    matched=true;
  };
  // 전 섹션 컬 일괄 조정(펌은 per-section이지만 음성은 전체 조정으로 취급)
  const adjAllCurl=(delta)=>{ SECTION_ORDER.forEach(id=>{ state.sections[id].curl=Math.max(0,Math.min(100,state.sections[id].curl+delta)); }); state._globalCurl=Math.max(0,Math.min(100,state._globalCurl+delta)); matched=true; };
  const has=arr=>arr.some(kw=>t.includes(kw));

  if(has(['길게','늘려','길이늘','더길','longer','grow'])) adj('length',STEP);
  else if(has(['짧게','줄여','길이줄','더짧','shorter','trim'])) adj('length',-STEP);
  else if(has(['볼륨추가','볼륨올','볼륨업','풍성','addvolume','morevolume','volumeup'])){ state.styling.volume=Math.min(100,state.styling.volume+STEP); matched=true; }
  else if(has(['볼륨줄','볼륨내','납작','lessvolume','volumedown','flatter'])){ state.styling.volume=Math.max(0,state.styling.volume-STEP); matched=true; }
  else if(has(['컬추가','웨이브추가','더컬','addcurl','morecurl','curlier'])) adjAllCurl(STEP);
  else if(has(['펴줘','컬줄','스트레이트','직모','straight','lesscurl'])) adjAllCurl(-STEP);
  else if(has(['다음각도','다음앵글','nextangle','nextview'])){ cycleAngle(1); matched=true; }
  else if(has(['이전각도','이전앵글','previousangle','prevangle','previousview'])){ cycleAngle(-1); matched=true; }
  else if(has(['결과','비교','완료','result','compare','done'])){ navTo('result'); matched=true; }
  else if(has(['초기화','리셋','reset'])){ resetSections(); matched=true; }
  else if(sectionSpoken){ matched=true; } // 섹션 이름만 말한 경우: 그 섹션으로 전환

  if(matched){ buildGyPanel(); drawAdjustPreview(); }
  else showToast('명령을 이해하지 못했어요: "'+text+'"');
}
function cycleAngle(dir){
  let idx=ANGLES.indexOf(state.currentViewAngle);
  idx=(idx+dir+4)%4; state.currentViewAngle=ANGLES[idx];
  try{ trimDerivedCanvases(state.currentViewAngle, '뷰 넘기기'); }catch(e){}
  renderAngleSwitches();
  drawAdjustPreview(); drawResult();
}

