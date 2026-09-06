/* ══════════════════════════════════════════════════════════
   15-project-3d.js — 3D→2D 투영 · 미니 3D · 3D 결과 화면 · 픽셀 이식
   원본 index.html 24199~25456행. 클래식 스크립트이므로 로드 순서가 곧
   실행 순서다 — index.html의 <script src> 순서를 바꾸지 말 것.
   ══════════════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════════════════════
   3D → 2D 투영 · 미니 3D 미리보기 · 3D 결과 화면
   projectHair3DToView: 조정된 3D 가닥을 그 뷰 카메라로 되쏴 조정 화면에 그림.
   initDevMini3D/refreshDevMini3D: 우하단 미니 3D 패널.
   initModel3DRenderer 이하: 최종 3D 결과 화면(두상+헤어+의상).
   ════════════════════════════════════════════════════════════════ */
// ── (10차) 3D 조정 전환 — 3D→2D 되쏘기(투영) ──
// 월드 3D 점 → 특정 뷰 카메라의 이미지(mask) 좌표 + 깊이. buildHairStrandsFromPaths
// 리프트(w3 = R^T·(px,my-CY,mz)+CY)의 정확한 역: local = R·(world-CY),
// ix = px/s+cx, iy = crownY+(yTop-my)/sy. R·R^T=I라 같은 뷰 왕복은 수학적으로 정확
// (Node 하네스로 검증). depth(mz)는 painter's 정렬용.
function project3DPointToView(world, cal, yTop, CY){
  const R = composeRotationZYX(cal.yaw, cal.pitch, cal.roll); // row-major 9 (forward)
  const wy = world.y - CY;
  const lx = R[0]*world.x + R[1]*wy + R[2]*world.z;
  const ly = R[3]*world.x + R[4]*wy + R[5]*world.z;
  const lz = R[6]*world.x + R[7]*wy + R[8]*world.z;
  const my = ly + CY;
  return {
    ix: lx / cal.s + cal.cx,
    iy: cal.crownY + (yTop - my) / cal.sy,
    depth: lz, // 카메라 축 성분 — 정렬 부호는 렌더에서 실측 조정
    /* 뷰 좌표를 그대로 들려 보낸다 (2026-08-18 h) — 가림 판정(makeViewOccluder)이
       두상·목 실루엣과 대조하려면 이미지 좌표가 아니라 <b>모델 단위의 뷰 좌표</b>가
       필요하다. 여기서 이미 계산돼 있으니 다시 구하면 그게 복제다.
       lx=뷰 가로 · ly=뷰 세로(두상 중심 CY 기준) · my=메쉬 Y(=ly+CY, iy가 쓰는 그 값). */
    lx, ly, my,
  };
}

// (11차 3단계) 조정된 3D 모델을 현재 뷰로 되쏘아 조정창 2D 캔버스에 그린다(baseC 위).
// 소스는 중립 모델(viewCal)+조정 연산자(computeAdjustedHair3DStrands). 대상 뷰 캡처
// 가닥만(srcAngle 필터) 투영해 교차뷰 잡음 없이 "그 뷰의 머리 = 3D 조정 결과의 투영".
// painter's 깊이 정렬로 겉겹이 속겹을 덮는 가림이 3D 실제 z 기준으로 정확해짐.
/* ── 다발 렌더 상수 (2026-07-26, render-test.html 하네스에서 눈으로 맞춘 값) ──
   왜 바꿨나: 이전 렌더는 "가닥마다 단색 불투명 0.7px 선 1회 + 두피색 언더코트"
   였다. 실제 스케일로 따지면 1px ≈ 0.5mm라서
     · 머리카락 한 올 0.07mm = 0.14px  → 애초에 그릴 수 없다(알파로만 존재)
     · 사진에서 보이는 결 다발 1~3mm = 2~6px
   즉 0.7px는 한 올의 5배이면서 다발의 1/3~1/8인 중간지대였고, 게다가 불투명
   단색이라 "펜으로 그은 선"으로 보였다. 그리고 2D 캡처 때 가닥마다 실측한
   색(st.color)을 여기서 통째로 버리고 있었다(단색 hairCol).

   그래서 렌더 단위를 "다발"로 올린다:
     · 다발 안에 가닥을 여러 개, 사이에 <틈>을 두고 배치 → 틈으로 뒤가 비쳐서
       밝기가 만들어진다. alpha로 낮추면 머리색이 회색으로 떠버린다(사용자 확인).
     · 가닥 색은 실측 팔레트 색 그대로(불투명), 다발 속에서만 미세 틴트로 분산.
     · (슬라이스 × 양자화 색)으로 묶어 beginPath/stroke를 1회씩만 — 하네스 실측
       stroke 2,800회 → 320회, 40회 평균 42.0ms → 36.6ms.
   모든 치수는 "기존 가닥 굵기 W0" 대비 배율이라 해상도가 달라져도 비율 유지.
   ※ 값 튜닝 손잡이는 전부 여기 한 곳. count(다발 수)는 stride로 조절한다. */
const HAIR3D_RENDER = {
  /* ── (2026-08-02) 가닥 렌더 전환 — 아래 "다발" 값들의 현재 위치 ──────────
     projectHair3DToView(스타일 적용 후 조정 화면)는 이제 다발이 아니라 <b>가닥
     하나당 선 하나</b>로 그린다. 굵기·개수·틴트 범위는 HAIR_STRAND_LOOK(원본 결
     보기와 같은 출처)에서 온다. 그래서 아래 다발 전용 값들(bundleSpanMax, sub,
     gap, minGapCss, minSubCss, maxSubCss, minSubW, targetBundles)은 <b>픽셀 이식
     경로(projectHairQuiltToView)에서만</b> 쓰인다 — 지우지 않은 이유가 그것이다.
     가닥 렌더에서 쓰는 건 targetStrands · colVar · quant · undercoat · stride뿐. */
  /* 그릴 가닥 수. null = 원본 결 보기가 같은 뷰에 그리는 수와 <b>동일</b>(권장,
     볼륨 50에서 ≈2,830). 숫자를 넣으면 그 값으로 고정한다(성능이 아쉬울 때 1,800
     정도로 내리면 밀도만 옅어지고 가닥 성질은 그대로 유지된다). */
  targetStrands: null,
  // 다발 폭 = 그 뷰의 헤어 실루엣 가로폭 × 이 값.
  // 왜 절대 px가 아니라 실루엣 비율인가: 하네스는 340px 캔버스에서 눈으로 맞췄고
  // 앱 조정창은 705px 안팎이라, 절대 px로 옮기면 다발이 절반 크기로 들어간다
  // (실측: W0 기준으로 옮겼더니 5.2px — 하네스의 12px에 해당하는 자리였음).
  // 투영 결과에서 실루엣 폭을 직접 재서 비율로 환산하면 촬영 거리·프레이밍·
  // 캔버스 크기가 전부 상쇄된다. 0.0272 = 하네스 실측(다발 7.4px ÷ 실루엣 272px).
  /* (2026-07-27 실기기 교정) 0.0272 → 0.014.
     사용자: "다발 폭이 안 줄어들었어. 꼭 갈퀴처럼 보여."
     맞다. 로그가 그대로 말해준다 — 비례값 7.4px인데 실제 10.8px로 그리고 있었다.
     아래 grow가 "가닥 5개를 다 넣으려면 자리가 필요하다"며 다발을 넓힌 결과다.
     넓은 다발에 이빨 5개가 벌어져 있으니 갈퀴다. 폭 자체를 줄이고, 넓히기도 끈다. */
  /* (2026-07-27 3차) 실루엣 비율은 이제 <b>상한</b>으로만 쓴다.
     이전엔 다발 폭 = 실루엣 × 비율이었는데, 실루엣 폭이 뷰마다 달라(255~413px)
     같은 사람인데도 좌측만 가닥 3개, 나머지는 2개가 됐다(사용자 지적).
     다발 크기는 <b>화면에서 보이는 크기</b>로 정해야 뷰가 달라도 같은 결이 된다
     → 아래 sub·minSubCss·minGapCss로 폭을 역산하고, 이 값은 "실루엣의 이만큼은
     넘지 마라"는 안전선으로만 쓴다(아주 작게 찍힌 뷰에서 다발이 머리를 덮는 것 방지). */
  bundleSpanMax: 0.06,
  /* 다발 안 가닥 수. 사용자: "다발폭을 좀 넓게 가자면 한 3~4개짜리 폭으로 가서
     틈을 조금 줄여보는 게 시도해 볼만할 거 같고" — 3으로 두고 틈을 좁힌다. */
  sub:    4,
  gap:    0.25,     // 틈 비율 — 가닥 폭 = 간격 × (1 - gap)
  colVar: 0.45,     // 다발 속 색 분산(미세 틴트 폭)
  /* 다발 수 손잡이. null이면 자동(아래 설명), 숫자면 그 값으로 고정.
     자동 규칙 — 화면 해상도 때문에 다발을 비례값보다 넓혀야 했다면, 넓힌
     배수만큼 다발 수를 줄여서 "총 잉크량"을 하네스에서 맞춘 수준으로 유지한다.
     이걸 안 하면 넓어진 다발끼리 겹쳐서 서로의 틈을 메워버리고, 결국 통짜
     덩어리가 된다(실기기 스크린샷의 그 상태 — 틈은 계산상 있었지만 옆 다발이
     덮고 있었다). 늘리려면 STRAND_SAMPLE_3D를 2→1로(모델 재생성, 약 2배). */
  stride: null,
  /* 자동 솎기 목표 = <b>뷰당 그릴 다발 수</b>.
     처음엔 "가로 겹침(다발수×폭÷실루엣폭)"을 목표로 잡았다. 총 잉크를 보존하는
     규칙이라 다발이 넓어지면 개수가 자동으로 줄었는데, 그게 틀렸다.
     사용자: "다발 수는 줄어들면 안 돼. 폭을 넓히면서 비는 곳을 메우는 작업하는
     거니까." 맞는 지적이다 — 폭을 넓히는 목적이 <b>빈 곳을 메우는 것</b>인데
     개수를 같이 줄이면 메워지지 않고 제자리걸음이 된다.
     그래서 개수를 고정하고 폭만 움직이게 한다. 이제 폭을 넓히면 덮는 면적이
     그대로 늘어난다. (겹침이 과해지면 그때 이 수를 내리면 된다.) */
  targetBundles: 1400,
  /* 두피색 언더코트(가닥 경로를 따라 굵기 ×2.2로 먼저 깔아 가닥 사이 빈틈만 메움).
     다발 렌더 시절엔 끔이 사용자 선택이었다(다발 사이로 뒤가 비쳐야 밝기가 났다).
     (2026-08-02) 가닥 렌더로 오면서 원본 결 보기와 같은 규칙으로 <b>켠다</b> —
     원본 결 보기가 바로 이 언더코트 위에 가닥을 얹은 그림이고, 끄면 가닥 사이로
     <b>원본 사진의 머리</b>가 그대로 비쳐서 성질이 달라진다. 끄려면 false. */
  /* (2026-08-08 #3) 화면에 그릴 목표를 원본 결 보기 대비 이 배수로. 1.0이면 예전 동작.
     모델 쪽 짝은 HAIR_OVERLAP.densityMul — <b>둘 다 올려야</b> 실제로 빽빽해진다
     (모델만 올리면 화면 목표에서 잘리고, 화면만 올리면 모델에 재료가 없다). */
  targetMul: 1.5,
  undercoat: true,
  // 하한은 백킹 픽셀이 아니라 "화면에 실제로 보이는 CSS 픽셀" 기준(아래 설명 참조)
  /* (2026-07-26 2차 상향) 0.7/0.9로는 부족했다. 캔버스 1200px를 화면 390px로
     줄여 그리는 과정에서 상자필터로 평균이 나는데, 선과 틈이 각각 1 CSS px
     안팎이면 그 평균에 뭉개져 회색 띠 하나가 된다(실기기: 서브가닥이 아니라
     뭉텅이로 보임). 축소를 견디려면 선·틈 모두 1 CSS px를 넘겨야 한다.
     사용자 요청("틈을 좀 늘려봐야 될 거 같애") 반영. */
  /* 가닥 사이 틈(화면 기준). 1.6 → 1.2 → <b>0.2</b>(사용자 지정).
     0.2에서는 가닥 3개가 거의 붙어 하나의 획으로 보였다. 사용자: "가닥을 하나
     늘려서 폭을 늘림으로 비는 공간을 좀 더 메울 필요가 있겠어. 틈을 0.3px로 해서
     가는 가닥이 표시날 때까지 한번 올려보게." → 가닥 4개 · 틈 0.3px.
     다발 폭은 (4-1)×(0.7+0.3) = 3.0px로 자동으로 따라 넓어진다.
     (2026-07-27 2차) 0.3 → <b>0.5</b>(사용자 지정). 다발 폭도 3.0 → 3.6px로
     따라 넓어진다 — 틈만 늘리는 게 아니라 빈 곳을 더 덮는 방향. */
  minGapCss: 0.5,
  /* (2026-07-27 사용자 지정) 1.1 → 0.7 — 획을 더 가늘게.
     주의: 이 값이면 다발 전체가 1.8px라 안에 든 가닥 3개가 화면에서 분리되지
     않는다(= 가는 획 하나). 의도된 방향이다 — "이 헤어 방식이 좀 부드럽게
     나오면 폭을 조금씩 늘려보려고". 늘릴 때는 이 값과 minGapCss를 같이 올리면
     다발 폭이 자동으로 따라 커진다(폭은 둘에서 역산됨). */
  minSubCss: 0.7,   // 가닥 폭의 화면상 최소 크기
  /* 가닥 폭 상한 — 이게 없으면 다발이 넓어질 때 가닥까지 같이 굵어졌다.
     subW = min(간격×(1-gap), 간격-최소틈) 이라 간격이 넓으면 굵은 획이 된다.
     머리카락 다발 하나는 화면에서 1~1.5px면 충분하고, 그 이상은 붓자국이 된다. */
  maxSubCss: 1.3,
  // 자리가 모자라 서브라인이 다 안 들어갈 때 다발을 최대 몇 배까지 넓혀도 되는지.
  // 사용자: "다발묶음이 투명해져서 표현이 안 되면 다발을 더 굵게 해도 괜찮은데,
  //          다발만 표현되니까 두껍게 할 수도 없고"
  //          → (2026-07-27 3차) grow 개념 자체를 없앴다. 다발 폭을 실루엣에서
  //          유도하지 않고 sub·가닥폭·틈으로 <b>역산</b>하게 바꿔서, "넓힐지 말지"를
  //          판단할 일이 아예 없어졌다(폭이 곧 원하는 결과의 정의가 됨).
  minSubW: 0.35,    // 가닥 폭 절대 하한
  /* 배치용 색 양자화 간격. 20은 검은 머리에서 너무 거칠었다 — 실측: 마무리 질감을
     매트↔윤기로 끝까지 움직여도 어두운 쪽 가닥들이 전부 같은 버킷(0,0,20)으로
     떨어져 화면이 한 픽셀도 안 바뀌었다(검은 머리는 밝기 차가 rgb 2~3 수준).
     8이면 그 차이가 살아난다. 묶음 수는 조금 늘지만 슬라이스 배치가 흡수한다. */
  quant:  8,
};
/* ══════════════════════════════════════════════════════════════════
   헤어 픽셀 이식 (2026-07-27, 사용자 제안)
   ─────────────────────────────────────────────────────────────────
   사용자: "같은 사람 얼굴 피부를 두상에 이식한 것처럼 동일인의 헤어도
            픽셀 이식이 되겠냐고 작업해보자고 한 거지. 함수로 렌더하려니까
            복잡하잖아."

   구멍 메움(pickSkinPatch)이 통했던 이유가 그대로 적용된다 — <b>소스와 대상이
   같은 사람·같은 조명·같은 카메라</b>라 색과 명암을 맞출 필요가 없다.
   헤어는 조건이 오히려 더 좋다: ① 자기 유사성이 극단적으로 높고(같은 가닥
   패턴이 머리 전체에 반복) ② 지배적 변수가 <b>방향</b> 하나인데 그 결필드를
   이미 뽑아 두었고 ③ 머리가 두상을 감으면서 온갖 각도의 소스가 사진 안에 있다.

   기법: 방향장 유도 텍스처 합성(이미지 퀼팅 계열). 학습 없이 함수로 된다.
     ① 원본 사진의 헤어 영역에서 <b>또렷한(coherence 높은)</b> 정사각 패치를 뜬다.
        각 패치에 그 자리의 결 각도를 기록한다.
     ② 3D 모델을 되쏘아 가닥 경로를 얻고, 각 점에서 화면상 진행 방향을 구한다.
     ③ 패치를 (목표각 − 패치각)만큼 <b>회전</b>시켜 그 자리에 찍는다.
     ④ 가장자리를 페더링해 이음매를 지우고, 깊이로 어둡게 해 안쪽 겹을 만든다.

   알려진 약점 두 가지(1차에서는 손대지 않는다):
     · <b>모발 끝</b> — 자른 길이는 영역 경계로 표현되는데 소스에는 원본 길이의
       끝밖에 없다. 중립 재현에서는 안 드러나고, 조정을 걸면 드러난다.
     · <b>가려졌던 안쪽</b> — 넘기거나 갈라서 속이 드러나면 소스가 없다.
       깊이 음영으로 근사할 뿐이다.
══════════════════════════════════════════════════════════════════ */
const HAIR_QUILT = {
  unit: 'bundle',      // 'strand' | 'bundle' | 'slice' — 잘라 붙일 단위
  /* 단위별 띠 폭(화면 CSS px). <b>다발 렌더 상수와 무관한 자기 숫자</b>다 —
     이식에는 서브가닥이 없고, 원본 3.6px를 통째로 자르면 진짜 올들이 그 안에
     이미 들어 있다. 3.6은 지금까지 눈으로 맞춰온 다발 폭을 이어받은 값. */
  widthCss: { strand: 0.7, bundle: 3.6, slice: 14.4 },
  widthMul: 1.0,       // 위 폭 대비 배율(미세 조정용)
  strips:  28,         // 소스 띠 개수(많을수록 반복이 덜 보이고 준비가 느려짐)
  stripStep: 3,        // 원본에서 결을 따라가는 보폭(원본 px)
  stripMax: 90,        // 띠 한 장의 최대 단계 수
  stripMin: 6,         // 이보다 짧게 끊기면 소스로 못 씀
  minCoh:  0.10,       // 이만큼 또렷한 자리에서만 뜬다(실기기 평균 0.28, 40%가 0.1 미만)
  /* 조각내기 — 곧은 구간은 한 번에 그린다. 고정 길이로 잘게 쪼갰더니 가닥 하나에
     22조각이 나와 실기기 밀도(1,400줄)에서 3만 번을 그리게 됐다(합성 실측 209ms).
     방향이 이만큼 꺾일 때만 새 조각을 시작하면 대부분의 가닥이 서너 조각이 된다. */
  segTurn: 0.14,       // 조각을 나누는 방향 변화(rad, ≈8°)
  segMaxPx: 46,        // 한 조각의 최대 길이(캔버스 px)
  segMinPx: 6,         // 한 조각의 최소 길이
  /* 띠 끝의 이 비율을 <b>모발 끝</b>으로 따로 쓴다(짧게 자를 때 가운데를 들어내고
     끝은 원본의 끝을 가져다 붙임). 코드로는 아래 sy 계산의 삼항 하나뿐이다.
     <b>0으로 두면 이 동작이 꺼지고</b> "그냥 그 길이만큼 잘라 씀"이 된다 —
     끝 처리가 오히려 어색하면 0으로 내려서 판단할 것. */
  tipFrac: 0.22,
  shade:   4,          // 깊이 음영 단계
  shadeMin: 0.60,      // 제일 안쪽 겹 밝기
  edgeFeather: 0.14,   // 띠 양옆 페더(폭 대비) — 계단만 없앨 정도로 얇게.
                       // 크게 하면 띠끼리 번져서 <b>틈이 사라진다</b>
};

/* ── 소스 띠 뜨기 ──────────────────────────────────────────────────
   원본 사진의 뿌리에서 출발해 <b>결을 따라가며</b> 다발 폭만큼의 띠를 떠서
   곧게 펴 저장한다(unwarp). 굽은 머리카락을 곧게 편 "재료"가 된다.

       원본의 굽은 결 ──╮                    ┌──┐
                        ╰──╮        →        │  │  ← 곧게 편 띠
                           ╰──╮              │  │     폭 = 다발 폭
                                             └──┘
   마스크를 벗어나며 끝난 띠에는 <b>진짜 모발 끝</b>이 들어 있다(hasTip).
   그래서 짧게 자를 때 끝을 지어낼 필요가 없다 — 원본의 끝을 가져다 붙인다.
   폭은 그릴 때 결정되므로(다발 폭 ÷ 화면배율) 폭별로 캐시한다. */
const _quiltPool = {};
function buildHairStripPool(angle, maskInf, swSrc){
  const hairC = state.hairCanvases && state.hairCanvases[angle];
  if(!hairC || !maskInf || !maskInf.orientation || !maskInf.scalpY) return null;
  const key = angle + '|' + swSrc;
  const cached = _quiltPool[key];
  if(cached && cached.src === hairC) return cached.pool;

  const Q = HAIR_QUILT;
  const W = hairC.width, H = hairC.height;
  const hctx = hairC.getContext('2d', { willReadFrequently:true });
  const alpha = hctx.getImageData(0, 0, W, H).data;         // 한 번만 읽는다
  const opaque = (x, y)=>{
    const xi = x|0, yi = y|0;
    if(xi < 0 || yi < 0 || xi >= W || yi >= H) return false;
    return alpha[(yi*W + xi)*4 + 3] > 128;
  };
  const ow = maskInf.maskW || W, oh = maskInf.maskH || H;
  const sxr = ow / W, syr = oh / H;
  const angAt = (x, y)=> sampleOrientation(maskInf.orientation, x*sxr, ow, y*syr);

  // ── 출발점: 마스크가 있는 컬럼을 고르게 훑어 뿌리에서 시작 ──
  const cols = [];
  for(let x=0;x<W;x++) if(maskInf.scalpY[x] >= 0) cols.push(x);
  if(cols.length < 4) return null;

  const raw = [];
  /* [진단] 왜 띠를 못 떴는지 알아야 한다. 실기기에서 "픽셀 이식을 켰는데 똑같다"가
     나왔는데, 조용히 false를 돌려 기존 가닥 렌더로 폴백한 것이 원인이었다.
     실패할 때 <b>이유와 숫자</b>를 남긴다 — 그래야 문턱을 짐작으로 안 흔든다. */
  const rej = { coh:0, short:0, dark:0, ok:0 };
  let tries = 0, srcKind = '결필드';

  /* ── ① 이미 캡처해 둔 <b>2D 가닥 경로</b>를 그대로 소스로 쓴다 (2026-07-27 2차) ──
     처음엔 결필드를 따라 직접 걸었는데, coherence가 낮으면 걷질 못해 띠가 안 떠졌다.
     그런데 coherence는 "사진이 흐리다"가 아니라 <b>그 자리에 일관된 방향이 있나</b>이다
     (구조텐서 고유값 비 (λ1-λ2)/(λ1+λ2), 대비와 무관한 정규화 값).
     검은 머리가 평평하게 찍히면 방향 정보 자체가 없어서 낮게 나온다 — 사진 탓이 아니다.
     그리고 우리는 이미 그 답을 갖고 있다: captureStrandPathsFor가 뽑아 둔 2,833개의
     <b>가닥 경로</b>. 그게 곧 "이 앱이 이해한 머리카락이 지나가는 길"이다.
     그 길을 따라 띠를 뜨면 걷기도, 방향 애매함도, 문턱도 필요 없다. */
  const rec = state.strandPaths && state.strandPaths[angle];
  if(rec && rec.strands && rec.strands.length){
    srcKind = '캡처 가닥 경로';
    const N = rec.strands.length;
    tries = Math.min(N, Q.strips * 8);
    for(let t=0; t<tries; t++){
      const sp = rec.strands[Math.floor(t * (N - 1) / Math.max(1, tries - 1))];
      const pts = sp && sp.pts;
      if(!pts || pts.length < 3){ rej.short++; continue; }
      const steps = []; let left = false, run = 0, cohSum = 0, cohN = 0;
      for(let i=0; i<pts.length && steps.length < Q.stripMax; i++){
        const P = pts[i];
        if(!opaque(P.x, P.y)){ left = true; break; }       // 마스크를 벗어남 = 모발 끝
        const A = pts[Math.max(0, i-1)], B = pts[Math.min(pts.length-1, i+1)];
        steps.push({ x:P.x, y:P.y, a: Math.atan2(B.y-A.y, B.x-A.x) });
        if(i > 0) run += Math.hypot(P.x-pts[i-1].x, P.y-pts[i-1].y);
        /* 방향은 경로가 주므로 coherence가 <b>필요하지는</b> 않다. 다만 어느 띠를
           고를지의 <b>품질 점수</b>로는 여전히 쓴다 — coherence가 높다는 건 그
           자리에서 올과 올이 실제로 구분돼 보인다는 뜻이라, 결이 든 소스다.
           (사용자: "그 중에서 coherence가 뚜렷한 걸 가져온다는 거지?") */
        if((i % 3) === 0){ const o = angAt(P.x, P.y); if(o){ cohSum += o.coherence; cohN++; } }
      }
      if(steps.length < Q.stripMin){ rej.short++; continue; }
      rej.ok++;
      // 행 높이는 실제 점 간격 — 띠의 길이 축척이 원본과 맞아야 한다
      raw.push({ steps, hasTip: left, coh: cohN ? cohSum/cohN : 0, sec: sp.sec || 'crown',
                 stepPx: Math.max(1, run / (steps.length - 1)) });
    }
  }

  /* ── ② 폴백: 캡처 경로가 없으면 결필드를 직접 걷는다 ── */
  if(!raw.length){
    srcKind = '결필드 직접 걷기';
    tries = Math.min(cols.length, Q.strips * 8);
    for(let t=0; t<tries; t++){
      const x0 = cols[Math.floor(t * (cols.length - 1) / Math.max(1, tries - 1))];
      // 두피선 바로 위는 마스크 가장자리라 반투명일 수 있다 — 불투명해질 때까지 조금 내려간다
      let px = x0 + 0.5, py = maskInf.scalpY[x0] + 1.5;
      let guard = 0;
      while(!opaque(px, py) && guard++ < 12) py += 2;
      if(!opaque(px, py)){ rej.dark++; continue; }
      const o0 = angAt(px, py);
      if(!o0 || o0.coherence < Q.minCoh){ rej.coh++; continue; }
      let a = o0.angle;
      if(Math.sin(a) < 0) a += Math.PI;                      // 뿌리에서 아래로 내려가는 쪽
      const steps = [];
      let cohSum = 0, left = false;
      for(let i=0; i<Q.stripMax; i++){
        if(!opaque(px, py)){ left = true; break; }
        steps.push({ x:px, y:py, a });
        const o = angAt(px, py);
        if(o){
          let na = o.angle;                                  // 결은 180° 주기 — 이어지는 쪽으로
          while(na - a >  Math.PI/2) na -= Math.PI;
          while(na - a < -Math.PI/2) na += Math.PI;
          a = na; cohSum += o.coherence;
        }
        px += Math.cos(a) * Q.stripStep;
        py += Math.sin(a) * Q.stripStep;
      }
      if(steps.length < Q.stripMin){ rej.short++; continue; }
      rej.ok++;
      raw.push({ steps, hasTip: left, coh: cohSum / steps.length, sec: 'crown', stepPx: Q.stripStep });
    }
  }
  if(!raw.length){
    console.warn(`[${angle}] 헤어 띠를 하나도 못 떴다 — 시도 ${tries}회 중`
      + ` 결이 흐려서 ${rej.coh} · 시작점이 투명해서 ${rej.dark} · 너무 짧아서 ${rej.short}`
      + ` (소스: ${srcKind}, 문턱: 또렷함 ${Q.minCoh}, 최소 ${Q.stripMin}단계)`);
    _quiltPool[key] = { src: hairC, pool: null }; return null;
  }
  /* ── 고르기: 또렷한 것 우선, 단 <b>섹션마다 골고루</b> ──────────────
     coherence 순으로만 뽑으면 제일 또렷한 한 구역(대개 광이 도는 자리)에서
     전부 나와서 머리 전체가 그 한 곳처럼 보인다. 실제로는 크라운과 네이프의
     빛·색이 다르다. 그래서 섹션별로 나눠 각자 상위를 뽑고, 남는 자리만 전체
     상위로 채운다. 그리고 붙일 때도 <b>같은 섹션 띠를 우선</b>해서 쓴다. */
  const scoreOf = r => (r.hasTip ? 0.15 : 0) + r.coh;   // 끝이 든 띠에 약간 가산
  raw.sort((p, q)=> scoreOf(q) - scoreOf(p));
  const bySec = new Map();
  for(const r of raw){ if(!bySec.has(r.sec)) bySec.set(r.sec, []); bySec.get(r.sec).push(r); }
  const quota = Math.max(1, Math.ceil(Q.strips / Math.max(1, bySec.size)));
  const picked = [], seen = new Set();
  for(const arr of bySec.values())
    for(let i=0;i<Math.min(quota, arr.length) && picked.length<Q.strips;i++){
      picked.push(arr[i]); seen.add(arr[i]);
    }
  for(const r of raw){ if(picked.length>=Q.strips) break; if(!seen.has(r)) picked.push(r); }

  // ── 곧게 펴서 굽기 (폭 swSrc × 길이 steps×행높이), 깊이 음영 단계별로 ──
  const SW = Math.max(2, swSrc | 0);
  const pool = [];
  for(let k=0; k<picked.length; k++){
    const r = picked[k];
    const rowH = r.stepPx || Q.stripStep;                    // 소스마다 점 간격이 다르다
    const SH = Math.max(2, Math.round(r.steps.length * rowH));
    const flat = document.createElement('canvas'); flat.width = SW; flat.height = SH;
    const fx = flat.getContext('2d');
    for(let i=0; i<r.steps.length; i++){
      const s = r.steps[i];
      fx.save();
      fx.beginPath(); fx.rect(0, i*rowH, SW, rowH + 1); fx.clip();
      // 원본의 (s.x,s.y)·방향 s.a 를 띠의 (SW/2, 이 행)·+y 로 보낸다
      fx.translate(SW/2, i*rowH + rowH/2);
      fx.rotate(Math.PI/2 - s.a);
      fx.translate(-s.x, -s.y);
      fx.drawImage(hairC, 0, 0);
      fx.restore();
    }
    // 양옆만 살짝 페더 — 틈은 살려야 하므로 얇게
    const fw = Math.max(0.5, SW * Q.edgeFeather);
    const g = fx.createLinearGradient(0, 0, SW, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(Math.min(0.49, fw/SW), 'rgba(0,0,0,1)');
    g.addColorStop(Math.max(0.51, 1 - fw/SW), 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    fx.globalCompositeOperation = 'destination-in';
    fx.fillStyle = g; fx.fillRect(0, 0, SW, SH);

    const shades = [];
    for(let s2=0; s2<Q.shade; s2++){
      const bright = Q.shadeMin + (1 - Q.shadeMin) * (Q.shade===1 ? 1 : s2/(Q.shade-1));
      if(bright >= 1){ shades.push(flat); continue; }
      const cv = document.createElement('canvas'); cv.width = SW; cv.height = SH;
      const cx2 = cv.getContext('2d');
      cx2.drawImage(flat, 0, 0);
      cx2.globalCompositeOperation = 'source-atop';
      cx2.fillStyle = `rgba(0,0,0,${(1-bright).toFixed(3)})`;
      cx2.fillRect(0, 0, SW, SH);
      shades.push(cv);
    }
    pool.push({ shades, SW, SH, hasTip: r.hasTip, sec: r.sec, coh: r.coh });
  }
  _quiltPool[key] = { src: hairC, pool };
  const cohs = pool.map(q=>q.coh);
  console.log(`[${angle}] 헤어 띠 — ${pool.length}장 채택(소스: ${srcKind}, 후보 ${raw.length}/${tries}시도,`
    + ` 탈락: 흐림 ${rej.coh}·투명 ${rej.dark}·짧음 ${rej.short}) · 폭 ${SW}원본px`
    + ` · 길이 ${Math.round(pool.reduce((s,q)=>s+q.SH,0)/pool.length)}원본px`
    + ` · 모발 끝 포함 ${pool.filter(q=>q.hasTip).length}장`
    + ` · 또렷함 ${Math.max(...cohs).toFixed(2)}~${Math.min(...cohs).toFixed(2)}`
    + ` · 섹션 ${[...new Set(pool.map(q=>q.sec))].join(',')}`);
  return pool;
}

/* ── 붙이기 ────────────────────────────────────────────────────────
   3D 가닥을 되쏘아 얻은 경로를 따라 띠를 <b>다시 휘어</b> 이어 붙인다.
   조각마다 그 지점의 진행 방향으로 회전시키므로, 결국 "무늬가 있는 붓칠"이다.

   길이를 줄이면 <b>가운데를 들어낸다</b> — 몸통은 띠의 앞에서, 끝은 띠의 끝에서
   가져온다. 실제로 머리를 자르는 것과 같은 조작이고, 그래서 잘린 자리에
   원본의 진짜 모발 끝이 온다(지어낸 페이드가 아니라).                     */
/* 폴백 사유를 <b>소리내어</b> 남긴다. 조용히 false를 돌리면 기존 가닥 렌더가
   대신 그려서 화면이 <b>똑같아 보이고</b>, 켠 사람은 "안 바뀌는데?"만 알게 된다
   (실기기에서 실제로 그랬다). 같은 사유는 한 번만 찍는다. */
let _quiltFailKey = '';
/* (2026-08-01) 예전엔 디버그 토글이 켜졌을 때만 화면 라벨(#adjustStyleTag)에
   이식 상태를 덮어썼다. 이제 이식이 기본 경로라서 그 문구를 그대로 두면
   일반 사용자에게 항상 진단 텍스트가 보인다 — 라벨은 스타일 이름으로 두고,
   상태는 콘솔과 window._lastQuiltDiag에만 남긴다.
   화면에서 확인하고 싶으면 '진단정보' 버튼을 쓰거나
   window.__quiltTagDebug = true로 켜면 된다. */
function setQuiltTag(txt){
  if(!window.__quiltTagDebug) return;
  const el = document.getElementById('adjustStyleTag');
  if(el) el.textContent = txt;
}
function quiltFail(angle, why){
  const k = angle + '|' + why;
  if(k !== _quiltFailKey){ _quiltFailKey = k;
    console.warn(`[${angle}] 픽셀 이식을 못 해서 <b>가닥 렌더로 폴백</b> — ${why}`); }
  setQuiltTag('픽셀 이식 실패 → 가닥 렌더 (' + why + ')');
  return false;
}
function projectHairQuiltToView(ctx, fit, angle, maskInf){
  const model = state.hair3Dneutral;
  if(!model || !model.viewCal || !model.viewCal[angle])
    return quiltFail(angle, '이 뷰의 3D 캘리브레이션이 없음');
  const src = model.strands;
  if(!src || !src.length) return quiltFail(angle, '3D 모델에 가닥이 없음');
  if(!state.hairCanvases || !state.hairCanvases[angle])
    return quiltFail(angle, '원본 헤어 이미지가 없음(소스를 못 뜸)');
  if(!maskInf.orientation) return quiltFail(angle, '결필드가 없음');
  const Q = HAIR_QUILT, R = HAIR3D_RENDER;
  const cal = model.viewCal[angle];
  const { toX: toCX, toY: toCY } = makeImgToCanvas(fit, maskInf.w, maskInf.h);

  /* ── 띠 폭 (2026-07-27 2차, 사용자 지적으로 분리) ──────────────────
     처음엔 다발 렌더의 공식 `(가닥 수-1)×(가닥폭+틈)`으로 역산했다. 그런데
     그 공식은 <b>선을 그을 때</b>의 것이다 — "0.7px 선 4개를 0.5px 틈으로
     늘어놓으면 3.6px"이라는 뜻이니까.
     이식에는 서브가닥 개념이 없다. 원본 머리카락 3.6px를 <b>통째로</b> 잘라
     붙이면 그 안에 진짜 올들이 이미 들어 있다(사용자: "원본헤어를 3.6px를
     통째로 잘라서 이어붙이면 되지 서브가닥 4개는 뭐야?"). 맞는 지적이라
     폭을 자기 숫자로 독립시킨다 — 3.6은 지금까지 맞춰온 값이라 그대로
     이어받되, 이제 다발 렌더 상수가 바뀌어도 따라 움직이지 않는다. */
  const cssW = (ctx.canvas && ctx.canvas.getBoundingClientRect)
    ? (displayWidthOf(ctx.canvas) || ctx.canvas.width) : ctx.canvas.width;
  const pxRatio = Math.max(1, (ctx.canvas.width || fit.dw) / Math.max(1, cssW)); // 백킹px / CSS px
  const wCss = Q.widthCss[Q.unit];
  const drawW = Math.max(1, (typeof wCss === 'number' ? wCss : Q.widthCss.bundle) * pxRatio * Q.widthMul);

  const pxScale = Math.max(1e-6, fit.dw / Math.max(1, maskInf.w));  // 원본px → 캔버스px
  const pool = buildHairStripPool(angle, maskInf, Math.round(drawW / pxScale));
  if(!pool || !pool.length) return quiltFail(angle, '소스 띠를 하나도 못 뜸(위 경고 참조)');

  const stride = Math.max(1, src.length / Math.max(1, R.targetBundles));   // (#3) 실수 허용
  const adj = computeAdjustedHair3DStrands(null, stride);
  if(!adj || !adj.length) return quiltFail(angle, '조정된 가닥이 비어 있음');

  // ── 투영 + 호길이 ──
  const lanes = [];
  const occ = makeViewOccluder(cal);   // 가림 판정(두상·목 그림자) — 뷰당 1회
  /* 얼굴 게이트도 <b>가닥 렌더와 같은 규칙</b>으로 건다 (2026-09-04). 8/18 i가
     "한쪽만 고치면 이식 모드에서만 뒷머리가 목 앞에 얹힌다"고 적어 둔 그 자리다. */
  const faceSil = (FACE_GATE.on && !(MQ_TRUST.faceGate && mqGeomTrusted()))
    ? makeFaceSilhouette(angle, maskInf.w, maskInf.h) : null;   // 마네킹이면 닫는다(MQ_TRUST)
  let dMin = Infinity, dMax = -Infinity;
  for(const st of adj){
    const pts = st.pts, cp = []; let dsum = 0, dmax = -Infinity, vis = 0;
    const vpt = []; const ipts = []; let rootDepth = 0;
    for(let i=0;i<pts.length;i++){
      const pr = project3DPointToView(pts[i], cal, model.yTop, model.CY);
      if(i===0) rootDepth = pr.depth;
      cp.push({ x: toCX(pr.ix), y: toCY(pr.iy) });
      ipts.push({ x: pr.ix, y: pr.iy });
      dsum += pr.depth; if(pr.depth > dmax) dmax = pr.depth;
      const v = viewPointVisible(pr, occ, maskInf);
      vpt.push(v); if(v) vis++;
    }
    vis -= applyFaceGate(vpt, ipts, faceSil, rootDepth);
    const depth = dsum / pts.length;
    if(!strandFacesCamera(dsum, pts.length, dmax, vis)) continue;   // 이 각도에서 안 보이는 가닥
    /* 가려진 구간은 <b>띠도 안 붙인다</b> (2026-08-18 i) — 가닥 렌더와 같은 규칙.
       한쪽만 고치면 이식 모드에서만 뒷머리가 목 앞에 얹힌다(두 경로가 갈라진다). */
    const runs = VIEW_CULL.trimHidden ? visibleRuns(vpt) : [[0, cp.length-1]];
    for(const [s,e] of runs){
      const seg = cp.slice(s, e+1);
      if(seg.length < 2) continue;
      const cum = [0];
      for(let i=1;i<seg.length;i++) cum.push(cum[i-1] + Math.hypot(seg[i].x-seg[i-1].x, seg[i].y-seg[i-1].y));
      const total = cum[cum.length-1];
      if(total < Q.segMinPx) continue;
      if(depth < dMin) dMin = depth; if(depth > dMax) dMax = depth;
      lanes.push({ cp: seg, cum, total, depth, sec: st.sec || 'crown' });
    }
  }
  if(!lanes.length) return quiltFail(angle, '이 각도에서 앞을 향한 가닥이 없음');
  lanes.sort((a,b)=> a.depth - b.depth);                       // 뒤부터 — 앞이 위에 덮임

  /* 폴리라인을 <b>방향이 꺾이는 곳에서만</b> 자른다. 곧은 구간은 한 조각으로
     그려서 draw 횟수를 크게 줄인다(고정 길이 분할 대비 5~6배). */
  const cutSegments = (L)=>{
    const cp = L.cp, cum = L.cum, out = [];
    let i0 = 0;
    let a0 = Math.atan2(cp[1].y-cp[0].y, cp[1].x-cp[0].x);
    for(let i=1;i<cp.length;i++){
      const a = Math.atan2(cp[i].y-cp[i-1].y, cp[i].x-cp[i-1].x);
      const turned = Math.abs(Math.atan2(Math.sin(a-a0), Math.cos(a-a0)));
      const run = cum[i] - cum[i0];
      const last = (i === cp.length-1);
      if(last || ((turned > Q.segTurn || run > Q.segMaxPx) && run > Q.segMinPx)){
        out.push({ i0, i1:i, s0:cum[i0], len:cum[i]-cum[i0] });
        i0 = i; a0 = a;
      }
    }
    return out;
  };

  /* 붙일 때는 <b>같은 섹션에서 뜬 띠</b>를 쓴다 — 크라운과 네이프는 빛도 색도
     다르다. 그 섹션 띠가 없으면 전체 풀에서 아무거나 쓴다(폴백). */
  const poolBySec = new Map();
  for(const q of pool){ if(!poolBySec.has(q.sec)) poolBySec.set(q.sec, []); poolBySec.get(q.sec).push(q); }

  const span = (dMax > dMin) ? (dMax - dMin) : 1;
  let seed = 20260727, segs = 0, sameSec = 0;
  const rnd = ()=>{ seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  for(const L of lanes){
    const sub = poolBySec.get(L.sec);
    if(sub && sub.length) sameSec++;
    const from = (sub && sub.length) ? sub : pool;
    const p = from[(rnd() * from.length) | 0];
    const lvl = Math.max(0, Math.min(Q.shade-1, Math.round((L.depth - dMin) / span * (Q.shade-1))));
    const img = p.shades[lvl];
    const tipSrc  = p.SH * Q.tipFrac;
    const bodySrc = Math.max(1, p.SH - tipSrc);
    const srcTotal = L.total / pxScale;                        // 목표 길이를 원본 단위로
    const tipUse  = Math.min(tipSrc, srcTotal * 0.5);
    const bodyUse = srcTotal - tipUse;                         // 여기까지는 몸통, 그 뒤는 끝
    for(const g of cutSegments(L)){
      const u = g.s0 / pxScale;                                // 원본 단위 진행량
      // 가운데를 들어낸다: 몸통은 띠 앞에서(길면 되감기), 끝은 띠 끝에서
      const sy = (u < bodyUse) ? (u % bodySrc) : (bodySrc + (u - bodyUse));
      if(sy >= p.SH) break;
      const h = Math.min(g.len / pxScale, p.SH - sy);
      if(h <= 0) break;
      const A = L.cp[g.i0], B = L.cp[g.i1];
      ctx.save();
      ctx.translate((A.x+B.x)/2, (A.y+B.y)/2);
      ctx.rotate(Math.atan2(B.y-A.y, B.x-A.x) - Math.PI/2);    // 띠의 +y를 진행 방향으로
      /* 그리는 길이는 <b>경로의 길이</b>여야 한다. 소스 길이(h)로 그렸더니
         띠 끝에서 h가 잘릴 때 그만큼 경로에 <b>구멍</b>이 났다(합성 샘플에서 흰
         네모로 보였음). 소스가 모자라면 조금 늘어나는 편이 낫다. */
      const dh = g.len * 1.08;                                 // 조각끼리 살짝 겹쳐 이음매를 지운다
      ctx.drawImage(img, 0, sy, p.SW, h, -drawW/2, -dh/2, drawW, dh);
      ctx.restore();
      segs++;
    }
  }
  ctx.restore();
  logQuiltRender(angle, { pool: pool.length, lanes: lanes.length, segs, drawW, unit: Q.unit,
                          swSrc: pool[0].SW, tips: pool.filter(q=>q.hasTip).length, sameSec });
  setQuiltTag(`픽셀 이식 · 띠 ${pool.length}장(끝 ${pool.filter(q=>q.hasTip).length}) · 폭 ${drawW.toFixed(1)}px`);
  return true;
}
let _quiltLogKey = '';
function logQuiltRender(angle, m){
  const key = angle + '|' + m.pool + '|' + m.unit + '|' + m.swSrc;
  window._lastQuiltDiag = window._lastQuiltDiag || {};
  window._lastQuiltDiag[angle] = { pool:m.pool, lanes:m.lanes, segs:m.segs,
                                   drawW:+m.drawW.toFixed(2), unit:m.unit, swSrc:m.swSrc,
                                   tips:m.tips, sameSec:m.sameSec };
  if(key === _quiltLogKey) return;
  _quiltLogKey = key;
  console.log(`[${angle}] 헤어 이식 — 띠 ${m.pool}장(끝 포함 ${m.tips}) · 단위 ${m.unit}`
    + ` 폭 ${m.drawW.toFixed(1)}px(원본 ${m.swSrc}px) · ${m.lanes}줄 · 조각 ${m.segs}개`
    + ` · 같은 섹션 띠를 쓴 줄 ${m.sameSec}/${m.lanes}`);
}

function projectHair3DToView(ctx, fit, angle, maskInf){
  const model = state.hair3Dneutral;
  if(!model || !model.viewCal || !model.viewCal[angle]) return false;
  const cal = model.viewCal[angle];
  const { toX: toCX, toY: toCY } = makeImgToCanvas(fit, maskInf.w, maskInf.h);
  /* (#5) 시술모드 빗질이 화면 좌표 ↔ 3D를 왕복하려면 <b>지금 이 프레임의</b>
     투영 문맥이 필요하다. 렌더가 이미 들고 있는 것을 그대로 남긴다 — 빗질이
     자기 투영식을 따로 만들면 두 경로가 갈라진다(이 파일이 겪어온 그 패턴). */
  COMB._proj = { angle, cal, yTop: model.yTop, CY: model.CY, toCX, toCY,
                 pxScale: fit.dw / Math.max(1, maskInf.w) };
  const R = HAIR3D_RENDER;

  // ── 투영 + 슬라이스 키 ──
  // 슬라이스 정의는 2D의 finalizeStrandsWithSlices와 같다(섹션 × 가로 3% × 깊이 10%).
  // 같은 패널에서 난 가닥들이 한 묶음이 되므로, 묶어서 그려도 깊이 순서가 눈에
  // 띄게 어긋나지 않는다(슬라이스끼리는 아래에서 평균 깊이로 정렬).
  const SLICE_W = Math.max(4, maskInf.w * 0.03);

  /* ── 2패스로 나눈 이유 (2026-07-27 성능 실측) ──
     처음엔 전 가닥을 투영한 뒤 배치 단계에서만 솎았다. 그런데 실측해 보니
     2,833가닥 중 <b>135개만 그리는데도</b> 97.6ms가 걸렸다 — 비용이 그리기가
     아니라 <b>투영</b>에 있었고, 솎기가 그 비용을 하나도 못 줄이고 있었다.
     (밀도를 2배로 올리면 시간도 정확히 2배 — 그린 다발 수는 그대로인데도.)
     그래서 순서를 바꾼다:
       1패스 — 성긴 표본(16개당 1개)으로 <b>실루엣 가로폭만</b> 잰다.
                폭은 전체 윤곽이라 표본으로도 거의 같은 값이 나온다.
       2패스 — 그 폭으로 다발 크기·솎기를 정하고, <b>실제로 그릴 가닥만</b> 투영한다.
     이러면 비용이 "그리는 다발 수"에 비례하게 되어 밀도를 올려도 안 무거워진다. */
  // 1패스는 <b>중립</b> 가닥으로 잰다 — 조정 연산을 돌리기 전이라 공짜에 가깝다.
  // 길이를 크게 줄이면 실루엣이 조금 좁아지지만, spanX는 다발 굵기만 정하는
  // 값이라 그 정도 오차는 그림에 안 나타난다(대신 조정할 때마다 다발 굵기가
  // 들썩이지 않아 오히려 안정적이다).
  /* ── 왜 <b>모든 뷰</b>의 가닥을 쓰는가 (2026-07-27) ──
     예전엔 `srcAngle === angle`로 그 뷰에서 캡처한 가닥만 그렸다("교차뷰 잡음
     방지"). 그런데 3D 모델은 네 뷰에서 올린 11,332가닥인데 조정 화면은 그중
     한 뷰치(2,833)만 쓰니, <b>3D 화면은 머리가 꽉 차는데 2D는 반만 차 보였다</b>
     (사용자 지적: "2D화면은 반만 쓰던가? 3D이미지는 머리 다 채워졌던데").
     옆통수·뒤통수를 덮는 가닥이 통째로 빠져 있었던 것이다.
     이제 전 뷰를 후보로 쓰고, 대신 <b>카메라를 등진 가닥을 버린다</b>(depth 컬링).
     "그 뷰에서 찍은 것만"이 아니라 "이 각도에서 보이는 것만"이 옳은 기준이다 —
     뒤통수 가닥도 옆에서 보면 보여야 하고, 앞머리도 뒤에서 보면 안 보여야 한다. */
  const src = model.strands;
  if(!src || !src.length) return false;
  const PROBE_STEP = Math.max(1, Math.floor(src.length / 180)); // 표본 ~180가닥
  /* 프로브도 렌더와 <b>같은 판정</b>을 써야 예산(그릴 개수)이 안 어긋난다 —
     같은 occ를 만들어 아래 2패스까지 그대로 쓴다. */
  const occ = makeViewOccluder(cal);
  /* ── (2026-09-04) 얼굴 실루엣 — 사용자 설계 "얼굴 반대편 라인" ──────────
     두개골 타원(occ)과 달리 이건 <b>이 사진에서 실측된</b> 얼굴 위치다.
     반대쪽(뿌리가 카메라 반대편)에서 난 가닥이 이 안으로 들어오면 안 그린다.
     프로브와 본 렌더가 <b>같은 판정</b>을 써야 예산이 안 어긋나므로 여기서
     한 번 만들어 둘 다 쓴다(occ와 같은 자리·같은 이유). */
  const faceSil = (FACE_GATE.on && !(MQ_TRUST.faceGate && mqGeomTrusted()))
    ? makeFaceSilhouette(angle, maskInf.w, maskInf.h) : null;   // 마네킹이면 닫는다(MQ_TRUST)
  /* ── 이 프로브는 <b>조정과 무관하다</b> (2026-08-23) ────────────────────────
     위 주석이 이미 적어 둔 대로 1패스는 <b>중립</b> 가닥으로 잰다. 그래서 이
     루프가 읽는 것은 전부 프레임 사이에 안 변하는 값이다 — 중립 모델(개체),
     그 뷰의 캘리브레이션(cal), 화면 프레이밍(fit), 마스크, 두개골 타원.
     슬라이더를 돌려도 결과가 <b>정의상 같은데</b> 매 프레임 180가닥 × 32점 =
     5,760회 투영 + 가림판정을 다시 돌고 있었다.
     서명이 같으면 지난 값을 그대로 준다. ADJ_CACHE와 같은 원리이고, 같은 이유로
     서명은 <b>손으로</b> 적는다(이 루프가 읽는 것을 여기 한 곳에 모아 둬야
     나중에 새 입력이 생길 때 이 목록도 같이 고치게 된다).
     ⚠ 두개골 타원(getDisplaySkullEllipsoid)은 콘솔에서 만질 수 있으므로 값을
       직접 서명에 넣는다 — 안 넣으면 만져 놓고 "안 바뀐다"고 헤매게 된다.
     되돌리기: MOBILE_PERF.probeCache = false */
  let spanX, frontFrac_;
  let _pSig = null;
  if(MOBILE_PERF.probeCache){
    try{
      let ea = 0, eb = 0, ec = 0;
      try{ const E = getDisplaySkullEllipsoid(); if(E){ ea = E.a; eb = E.b; ec = E.c; } }catch(e){}
      _pSig = [angle, model._gid || (model._gid = ++_canvasGidSeq), src.length, PROBE_STEP,
               Math.round(fit.dx), Math.round(fit.dy), Math.round(fit.dw), Math.round(fit.dh),
               /* 예전엔 canvasGid(maskInf.reasonCanvas)로 "마스크가 바뀌었나"를 봤다.
                  reasonCanvas가 지연 생성으로 바뀌면서(2026-08-23) 평소엔 null이라
                  이 자리가 늘 0이 된다 — 서명이 마스크 교체를 <b>못 보게</b> 된다.
                  maskInf 자체의 gid로 바꾼다. 새 extract는 새 maskInf를 만들고,
                  마스크 보기를 켜도 maskInf는 그대로라 오히려 더 정확한 대리값이다. */
               maskInf.w, maskInf.h, canvasGid(maskInf),
               (cal.yaw||0).toFixed(5), (cal.pitch||0).toFixed(5), (cal.roll||0).toFixed(5),
               (model.yTop||0).toFixed(5), (model.CY||0).toFixed(5),
               ea.toFixed(5), eb.toFixed(5), ec.toFixed(5),
               /* 얼굴 게이트를 콘솔에서 껐다 켰다 하면 프로브도 다시 돌아야 한다 */
               (FACE_GATE.on ? 1:0), FACE_GATE.inset, FACE_GATE.chinExtend, FACE_GATE.rootEps
              ].join(',');
    }catch(e){ _pSig = null; }
  }
  const _pHit = _pSig ? PROBE_CACHE.map.get(_pSig) : null;
  if(_pHit){
    PROBE_CACHE.hits++;
    spanX = _pHit.spanX; frontFrac_ = _pHit.frontFrac;
  } else {
    if(_pSig) PROBE_CACHE.misses++;
    let pMinX = Infinity, pMaxX = -Infinity, pN = 0, pFront = 0;
    for(let si=0; si<src.length; si+=PROBE_STEP){
      const pts = src[si].pts;
      let dsum = 0, dmax = -Infinity, vis = 0, far = false;
      for(let i=0;i<pts.length;i++){
        const pr = project3DPointToView(pts[i], cal, model.yTop, model.CY);
        // 0번 점이 뿌리다 — 여기서 이 가닥이 <b>반대쪽</b>인지 한 번 정한다
        if(i===0) far = !!faceSil && strandIsFarSide(pr.depth);
        const x = toCX(pr.ix);
        if(x < pMinX) pMinX = x; if(x > pMaxX) pMaxX = x;
        dsum += pr.depth; if(pr.depth > dmax) dmax = pr.depth;
        if(viewPointVisible(pr, occ, maskInf)
           && !(far && faceSil.covers(pr.ix, pr.iy))) vis++;
      }
      pN++; if(strandFacesCamera(dsum, pts.length, dmax, vis)) pFront++;
    }
    spanX = (pMaxX > pMinX) ? (pMaxX - pMinX) : fit.dw;
    frontFrac_ = pN ? Math.max(0.05, pFront / pN) : 0.5;
    if(_pSig){
      PROBE_CACHE.map.set(_pSig, { spanX, frontFrac: frontFrac_ });
      /* 값 두 개짜리 항목이라 메모리는 사실상 0이다. 그래도 무한히 쌓게 두지
         않는다 — 뷰 4개 × 확대단계 몇 개면 충분하다. */
      while(PROBE_CACHE.map.size > PROBE_CACHE.max){
        PROBE_CACHE.map.delete(PROBE_CACHE.map.keys().next().value);
      }
    }
  }
  /* [진단·투영 실루엣] 사용자가 실제로 비교하는 그 두 가지를 <b>같은 자로</b> 잰다
     (2026-08-18 e): "원본 결 보기"(=사진 마스크 실루엣)의 가로폭과, 3D를 갔다온
     투영의 가로폭. 1.00배면 두 화면의 두상이 같은 크기다. 0.9배면 10% 좁다는 뜻이고,
     그 값은 [진단·헐 접힘]의 최대초과와 짝이 맞아야 한다(원인이 헐일 때). */
  if(!window._projSilLogged) window._projSilLogged = {};
  if(!window._projSilLogged[angle]){
    window._projSilLogged[angle] = true;
    /* 원본 폭은 <b>리프트가 쓰는 것과 같은 판정</b>(scalpY>=0 = 두피선이 있는 컬럼)으로
       잰다. 처음엔 hairEndY도 OR로 넣었다가 캔버스 전체 폭이 찍혔다 — hairEndY는
       두피선이 없는 컬럼(어깨로 흐른 머리·배경)에도 값이 있어서 실루엣이 아니라
       그림 전체를 재고 있었다(front 1404px = 캔버스 폭 그 자체였던 이유). */
    let mnX = Infinity, mxX = -Infinity;
    if(maskInf.scalpY){
      for(let x=0; x<maskInf.w; x++){
        if(maskInf.scalpY[x] >= 0){ if(x < mnX) mnX = x; if(x > mxX) mxX = x; }
      }
    }
    if(mxX > mnX){
      const rawW = toCX(mxX) - toCX(mnX);
      console.log('[진단·투영 실루엣] ' + angle + ': 3D 투영 폭 ' + spanX.toFixed(0) + 'px'
        + ' vs 원본 결(마스크) 폭 ' + rawW.toFixed(0) + 'px'
        + ' → ' + (rawW > 1e-6 ? (spanX/rawW).toFixed(3) : '?') + '배'
        + ' (1.00 = 두 화면의 두상 크기 일치)');
    }
  }
  /* 이 각도에서 <b>앞을 향한</b> 가닥의 비율. 아래 컬링으로 버려질 양을 미리
     알아야 목표 개수를 맞출 수 있다. 뷰가 두상을 정면으로 보면 절반쯤이지만,
     모델이 한쪽에 몰려 있으면 1에 가까울 수도 있어 고정 계수로는 못 맞춘다
     (실측: 2배로 가정했더니 전부 앞을 향한 모델에서 2배를 그려 84ms가 나왔다).
     ※ 값 자체는 위 프로브가 낸 것 그대로다 — 캐시가 걸려도 같은 숫자다. */
  const frontFrac = frontFrac_;

  /* ── 가닥 성질 = <b>원본 결 보기와 동일</b> (2026-08-02) ─────────────────
     예전엔 여기서 <b>다발 치수</b>를 계산했다 — 가닥 하나를 서브라인 4개짜리
     다발로 그리려니 폭·틈·개수를 화면 CSS 픽셀에서 역산해야 했고, 그래서 같은
     3D 가닥인데도 원본 결 보기와 굵기·밀도·명암 분포가 서로 달랐다.
     사용자: "원본 결 보기의 헤어가닥 — 레이어 개별 가닥 ~2000개, 그걸로 통일해줘."
     그래서 다발을 버리고 <b>가닥 하나당 선 하나</b>로 돌아간다. 굵기·개수·틴트는
     HAIR_STRAND_LOOK(원본 결 보기와 <b>같은 출처</b>)에서 그대로 가져온다.
       · 굵기 — 레이어 4종(루트확산·굵은섹션·중간·잔가닥)의 굵기를 개수 비율대로
                가닥에 배정. 굵은 획과 잔가닥이 섞여야 "결"로 보인다.
       · 개수 — 원본 결 보기가 이 뷰에 그리는 수(볼륨 50에서 ≈2,830)를 목표로 솎기.
       · 배정 — Math.random이 아니라 <b>가닥 인덱스 해시</b>(결정적). 슬라이더를
                움직여도 같은 가닥은 같은 굵기·밝기를 유지한다(프레임 간 반짝임 방지).
     비용: 서브라인이 사라져 draw 호출이 가닥당 4회 → 1회. 개수를 2배로 늘려도
     그리기 비용은 예전보다 낮다(지배적인 비용은 아래 투영 쪽이다). */
  const sld = (state.sliders && state.sliders[angle]) || {};
  const volume    = (typeof sld.volume    === 'number') ? sld.volume    : 50;
  const thickness = (typeof sld.thickness === 'number') ? sld.thickness : 50;
  const roles    = hairStrandRoles(fit.dw, volume, thickness);
  const rawTotal = roles.reduce((s,r)=> s + r.n, 0);   // 원본 결 보기가 이 뷰에 그리는 가닥 수
  // 레이어 배정용 누적분포(원본의 레이어별 개수 비율 그대로)
  const roleCum = [];
  { let acc = 0; for(const r of roles){ acc += r.n / rawTotal; roleCum.push(acc); } }
  const roleOf = (h)=>{
    for(let k=0;k<roleCum.length;k++){ if(h < roleCum[k]) return k; }
    return roles.length - 1;
  };
  /* 화면 표시 배율 — 굵기 하한은 원본 결 보기와 같이 <b>백킹 픽셀</b> 기준
     (MIN_SAFE_WIDTH)이라 여기서는 진단 표시용으로만 쓴다. CSS 픽셀 하한을
     따로 두면 그게 곧 원본 결 보기와의 차이가 되므로 두지 않는다. */
  const cssW  = (ctx.canvas && ctx.canvas.getBoundingClientRect)
    ? (displayWidthOf(ctx.canvas) || ctx.canvas.width) : ctx.canvas.width;
  const unit  = Math.max(1, (ctx.canvas.width || fit.dw) / Math.max(1, cssW)); // 백킹px / CSS px

  // 뒤를 향한 가닥이 버려질 만큼 후보를 더 잡는다(비율은 위에서 실측).
  // targetStrands가 null이면 "원본 결 보기와 같은 개수"(권장) — 숫자를 넣으면 그 값.
  /* (#3) 화면에 그릴 목표 개수. 예전엔 <b>원본 결 보기와 같은 수</b>(rawTotal)로 고정이라,
     모델을 아무리 늘려도 화면은 그 수에서 멈췄다 — 모델 쪽 손잡이(HAIR_OVERLAP.densityMul)와
     짝이 되는 화면 쪽 손잡이가 없었다. targetMul로 그 상한을 연다.
     ※ 3D는 껍질에 흩어져 있어 같은 개수면 2D보다 성글어 보인다. 그 몫이 여기다. */
  const targetStrands = (R.targetStrands == null)
    ? rawTotal * (R.targetMul || 1)
    : R.targetStrands;
  const wantCand = Math.max(1, targetStrands / frontFrac);
  const stride  = (R.stride == null)
    ? Math.max(1, Math.min(32, src.length / wantCand))   // (#3) 반올림 제거 — 누산기가 받는다
    : Math.max(1, +R.stride || 1);

  // ── 2패스: 그릴 가닥만 조정 연산 + 투영 ──
  const _perfT0 = (typeof performance !== 'undefined') ? performance.now() : 0;
  const adj = computeAdjustedHair3DStrands(null, stride);
  const _perfT1 = (typeof performance !== 'undefined') ? performance.now() : 0;
  if(!adj || !adj.length) return false;
  diagAdjSourceStamp('2D투영', adj);   // 3D 화면과 같은 자로 재서 도장(위 ADJ_STAMP 배너)
  const projected = [];
  /* [진단] 뿌리선 어긋남 — "머리가 원본보다 바깥에서 시작한다"를 <b>재는</b> 장치.
     되쏜 가닥의 뿌리가 그 컬럼의 원본 두피선(scalpY)보다 위에 찍히면 음수다.
     추측으로 계수를 흔들지 않기 위해 만든다(이 문제로 두 번 헛짚었다). */
  const rootDev = [];
  const projected0 = [];
  let pxN = 0;   // [진단] 조각별 원본 픽셀색을 실제로 얻은 가닥 수
  let hidPts = 0, hidAll = 0;   // [진단] 가려져서 안 그린 점 / 그린 가닥의 전체 점(8/18 i)
  let faceCut = 0, faceCutStrands = 0;   // [진단] 얼굴 게이트가 지운 점 / 걸린 가닥(2026-09-04)
  /* [진단] 끊긴 가닥(2026-09-06) — 보이는 구간이 <b>둘 이상</b>으로 쪼개진 가닥만
     골라 그 구멍을 누가 냈는지 센다. 화면의 "떠 있는 조각"이 정확히 이것이다. */
  const _gap = GAP_DIAG.on ? newGapAcc() : null;
  /* ── [진단] 정수리는 <b>어느 단계에서</b> 사라지는가 (2026-08-18 k) ──────────
     사용자: "두정부에 숱이 없어. 그래서 중간가르마 자체가 안되는듯."
     로그가 서로 다른 말을 하고 있었다 — [3D·겹침·뿌리 격자]는 정수리를 93~100%
     채웠다 하고 [정수리 커버리지]는 "보임 100%"라는데 [최종 커버리지]는 12‰,
     [밀도] ③화면의 <b>맨 윗줄은 네 뷰 전부 0</b>이다(①캡처 윗줄엔 값이 있다).
     그 사이에 낀 단계가 <b>가닥 단위 컬링</b>과 <b>점 단위 트리밍</b>이라 여기서
     정수리만 따로 센다. 셋 다 멀쩡하면 남는 건 그리기(굵기·순서·두개골 구)다.
     경계 0.55는 지어낸 값이 아니라 위 두 진단이 이미 쓰는 첫 밴드의 상한이다. */
  const CROWN_BAND = 0.55;
  let cwN = 0, cwDrop = 0, cwPts = 0, cwVis = 0;
  /* ── [진단] 가닥의 <b>깊이 폭</b> — 화가 알고리즘이 표현할 수 있는가 (2026-09-05)
     ─────────────────────────────────────────────────────────────────────
     사용자: "뿌리가 뒤통수이고 끝은 뺨 앞으로 나오는 경우는 디렉션이 잘못
     잡힌 거 아냐?"

     맞다. 그래서 이 표는 <b>정렬 얘기가 아니라 방향 얘기</b>다. 겹 순서는
     가닥당 스칼라 하나(depth)로 정하는데, 그 하나로 대표가 되려면 가닥 안에서
     깊이가 별로 안 변해야 한다. 곧게 떨어지는 머리는 그렇다 — 끝이 뿌리 바로
     아래라 폭이 거의 0이다. 폭이 크게 나오는 정당한 경우는 <b>앞으로 넘긴</b>
     것(앞머리·가르마)과 두상을 벗어나 앞으로 흘러내리는 긴 머리뿐이다.
     그 외에 폭이 크면 그건 정렬의 한계가 아니라 <b>리프트나 결 정렬이 방향을
     잘못 잡은 것</b>이고, 겹 순서를 고쳐도 안 고쳐진다.

     그래서 <b>섹션별로</b> 나눈다 — 어느 칸이 튀느냐가 곧 어느 버그냐다:
       front·crown이 크다      → 정상(앞머리·가르마). 남는 건 정렬 방식.
       occipital·nape가 크다   → <b>방향 오류</b>. buildHairStrandsFromPaths의
                                 두상 밖 z 결정, 또는 alignStrandPtsToField3D.
     자는 지어내지 않는다 — 두상 자신의 <b>깊이 반경</b>(c)으로 나눈다. 1.0이면
     "가닥 하나가 두상 앞뒤를 통째로 가로지른다"는 뜻이라 눈금이 말이 된다. */
  const _spanBySec = {};
  let _spanC = 1;
  try{ const E = getHeadEllipsoid(); if(E && E.c > 1e-6) _spanC = E.c; }catch(e){}
  const _rootPhi = (p)=> Math.atan2(Math.hypot(p.x, p.z), p.y - model.CY);
  for(let si=0; si<adj.length; si++){
    const st = adj[si];
    const pts = st.pts; let dsum=0, dmax=-Infinity, dmin=Infinity, vis=0; const cpts=[];
    /* 되쏜 <b>이미지 좌표</b>도 같이 들고 간다 — 원본 픽셀색을 여기서 읽기
       때문(sampleProjectedStrandColors). 캔버스 좌표(cpts)로는 못 읽는다:
       photoRGB는 사진 좌표계에 있다. */
    const ipts=[];
    const vpt=[];              // 점별 보임 — 그리기도 이 판정으로 자른다(8/18 i)
    const rsn=_gap ? [] : null; // [진단] 점별 사유 코드(GAP_REASON) — GAP_DIAG.on일 때만
    let rootIx = 0, rootIy = 0;
    let rootDepth = 0;
    for(let i=0;i<pts.length;i++){
      const pr = project3DPointToView(pts[i], cal, model.yTop, model.CY);
      if(i===0){ rootIx = pr.ix; rootIy = pr.iy; rootDepth = pr.depth; }
      cpts.push({ x: toCX(pr.ix), y: toCY(pr.iy) });
      ipts.push({ x: pr.ix, y: pr.iy });
      dsum += pr.depth; if(pr.depth > dmax) dmax = pr.depth;
      if(pr.depth < dmin) dmin = pr.depth;   // (2026-09-05) 깊이 폭 진단 — 아래 _spanBySec
      const v = viewPointVisible(pr, occ, maskInf);
      /* [진단] 이 점을 <b>어느 문</b>이 지웠나. 판정 직후에 읽어야 한다
         (GAP_DIAG.reason은 스크래치 한 칸을 돌려 쓴다). */
      if(rsn) rsn.push(GAP_DIAG.reason);
      vpt.push(v); if(v) vis++;
    }
    /* ── (2026-09-04) 얼굴 실루엣 게이트 ──────────────────────────────────
       사용자: "측면에서 반대편 사이드헤어가 얼굴 위로 지나가. 얼굴에
       가려지는 부분은 안 보여야 하고, 얼굴 반대편으로 넘어가야 한다."
       위 판정(viewPointVisible)이 통과시킨 점 중, <b>뿌리가 카메라
       반대쪽</b>인 가닥이 얼굴 안에 찍힌 것만 지운다. 지우기만 하고
       되살리지 않는다 — 가까운 쪽 앞머리는 예전 그대로 얼굴을 덮는다.
       ⚠ (2026-09-06) 여기 있던 "가닥은 얼굴 앞에서 사라졌다가 반대편
       윤곽선 너머에서 <b>다시 나온다</b>"는 설명은 <b>정면 전용</b>이었다.
       측면에서 볼록껍질의 반대편 윤곽선은 <b>코</b>이고 그 너머는 허공이라,
       다시 나온 꼬리가 얼굴 옆에 떠 있는 조각이 됐다(사용자: "사이드·템플이
       뜯겨져 있듯이 중간에 빈 곳"). 이제 applyFaceGate가 <b>처음 막힌
       자리에서 끊는다</b> — 근거와 되돌리기는 그 함수 배너 참조.
       되돌리기: FACE_GATE.on = false · FACE_GATE.cutTail = false */
    const _fcut = applyFaceGate(vpt, ipts, faceSil, rootDepth, rsn);
    if(_fcut){ vis -= _fcut; faceCut += _fcut; faceCutStrands++; }
    /* ── (2026-09-01 6차) 정렬 키를 <b>뿌리 깊이</b>로 ────────────────────────
       사용자: "그 <b>len 변화분은 적은데</b>, 뒤집어지고 난리가 나는 건 변화에
       대한 <b>2D 투영 문제</b>가 맞아. <b>3D는 괜찮아</b>."
       여기가 그 자리다. 평균 깊이(dsum/pts.length)를 겹 정렬 키로 쓰고 있었다.
       가닥을 짧게 자르면 <b>꼬리가 사라지고</b>, 꼬리는 두상을 감아 돌아 z가
       뿌리와 크게 다르다 → 평균이 <b>불연속으로 튄다</b> → 그 가닥이 정렬에서
       한 번에 건너뛴다 → 겹이 뒤집힌다. 길이를 조금 움직였는데 화면이 난리가
       나는 게 정확히 이 모양이다.
       측면에서 최악인 것도 맞아떨어진다 — 가닥을 따라 z가 가장 크게 변하는
       뷰가 측면이다. 정면·후면은 z 변화가 작아 평균이 잘 안 튄다.
       미니3D가 멀쩡한 이유도 같다 — 거기는 진짜 3D라 <b>화가 알고리즘 자체가
       없다</b>. 스칼라 하나로 겹을 정하는 건 2D 투영만 한다.

       ── 왜 <b>뿌리</b>인가 ────────────────────────────────────────────
       가닥이 앞에 있냐 뒤에 있냐는 <b>어디서 나느냐</b>가 정한다. 뒤통수에서
       난 머리는 길든 짧든 옆머리 뒤다. 길이는 그 순서를 바꾸지 않는다.
       그리고 뿌리는 커트가 <b>건드리지 않는 유일한 점</b>이라, 길이를 어떻게
       움직여도 정렬 키가 <b>정확히 그대로</b>다 — 튈 수가 없다.
       ⓘ dsum·dmax는 계속 쓴다(다른 판정이 읽는다). 바꾼 건 정렬 키 하나다.
       되돌리기: DEPTH_SORT.byRoot = false */
    const depth = DEPTH_SORT.byRoot ? rootDepth : (dsum / pts.length);
    /* 보이냐 마느냐는 strandFacesCamera 단일 출처(위 "뷰 컬링" 구역). 평균으로
       자르던 것이 후면 정수리를 통째로 날렸고, 깊이 부호로 자르던 것이 정면에서
       목 옆 뒷머리를 통째로 날렸다(2026-08-18 h). 지금은 <b>가림</b>으로 본다. */
    const isCrown = _rootPhi(pts[0]) < CROWN_BAND;
    if(isCrown){ cwN++; cwPts += pts.length; cwVis += vis; }
    if(!strandFacesCamera(dsum, pts.length, dmax, vis)){ if(isCrown) cwDrop++; continue; }
    if(maskInf.scalpY){
      const cx0 = Math.round(rootIx);
      const sY = (cx0 >= 0 && cx0 < maskInf.w) ? maskInf.scalpY[cx0] : -1;
      if(sY >= 0) rootDev.push(rootIy - sY);   // 음수 = 원본 두피선보다 위(바깥)
      else projected0.push(1);                 // 원본에 머리가 없는 컬럼에 찍힘
    }
    /* 레이어 배정·밝기 지터 — 가닥 인덱스에서 뽑는 결정적 난수(hashFract).
       원본 결 보기는 Math.random을 쓰지만 거긴 매 프레임 가닥을 새로 심는다.
       여기선 <b>같은 가닥</b>이 프레임마다 다시 그려지므로, 난수를 인덱스에
       묶어야 슬라이더를 잡고 흔들 때 가닥이 반짝이지 않는다. */
    const rid  = roleOf(hashFract(si * 0.7548776662 + 11.13));
    /* 색 = <b>이 가닥이 지금 지나는 자리</b>의 원본 픽셀(원본 결 보기와 같은 규칙).
       reproject=false면 중립 캡처 때 구운 색을 그대로 쓴다(예전 동작). */
    const bakedCols = (st.colors && st.colors.length > 1) ? st.colors : null;
    const pxCols = HAIR_PIXEL_COLOR.reproject
      ? sampleProjectedStrandColors(maskInf, ipts, bakedCols, st.color, st.dye)
      : bakedCols;
    if(pxCols) pxN++;
    /* 가려진 구간은 안 그린다(8/18 i). 전부 보이면 runs는 [[0, n−1]] 하나라
       예전과 같은 그림이고, 목·얼굴 뒤로 넘어간 구간만 빠진다. */
    const runs = VIEW_CULL.trimHidden ? visibleRuns(vpt) : [[0, cpts.length-1]];
    if(!runs.length) continue;                  // 판정상 남았지만 그릴 구간이 없다
    if(_gap) tallyStrandGaps(_gap, runs, vpt, rsn, ipts, st.sec || 'crown');
    hidPts += (pts.length - vis); hidAll += pts.length;
    /* 폭은 <b>그리기로 결정된</b> 가닥만 센다 — 컬링·트리밍으로 빠진 것까지 세면
       화면에 없는 가닥이 표를 흔든다. */
    {
      const sc = st.sec || 'crown';
      const e = _spanBySec[sc] || (_spanBySec[sc] = { n:0, sum:0, big:0, max:0 });
      const sp = (dmax - dmin) / _spanC;
      e.n++; e.sum += sp; if(sp > e.max) e.max = sp;
      if(sp >= DEPTH_SORT.bigSpan) e.big++;
    }
    projected.push({
      cpts, runs, depth, color: st.color, colors: pxCols,
      w: roles[rid].w,                            // 레이어(굵기) 배정
      /* 굵기가 같은 레이어끼리는 한 묶음으로 그린다(키를 굵기로 잡는 이유).
         MIN_SAFE_WIDTH(0.9px) 하한에 걸리면 네 레이어가 같은 굵기가 되는데 —
         원본 결 보기도 그 해상도에서는 정확히 그렇게 그려진다 — 그때 묶음이
         넷으로 쪼개지면 stroke 횟수만 늘고 그림은 같다. */
      wk: roles[rid].w.toFixed(2),
      hb: hashFract(si * 0.3183098862 + 4.77),    // 밝기 지터(0~1)
      slice: (st.sec||'crown') + '|' + Math.floor(rootIx / SLICE_W)
             + '|' + Math.floor((rootIy / Math.max(1, maskInf.h)) * 10),
    });
  }
  if(!projected.length) return false;
  /* ── (2026-09-01 4차) 투영이 <b>세로로 늘리는가</b> ────────────────────────
     사용자가 미니3D와 2D 캔버스를 같은 프레임에 나란히 놓고 짚었다:
     앞머리가 미니3D에서는 <b>눈썹 위</b>인데 2D 캔버스에서는 <b>코까지</b> 온다.
     둘은 computeAdjustedHair3DStrands를 <b>같은 프레임에 각자 부른</b> 결과라
     길이가 다를 수 없다. 그러면 남는 것은 <b>투영</b>이다.
     ── 자 ── 배율에 무관해야 두 화면을 비교할 수 있으므로 <b>두상 폭으로 나눈다</b>:
       모델쪽  호길이 중앙값 ÷ 두상 폭(2a)
       화면쪽  투영 호길이 중앙값 ÷ 투영 두상 폭(spanX)
     둘의 비가 늘어남 배율이다. 1.00이면 투영이 정직하고, 1.6이면 세로가 60%
     늘어났다는 뜻이다(그러면 눈썹 앞머리가 코까지 온다 — 사용자가 본 그것).
     ⚠ 완전히 1.00일 수는 없다 — 원근·기울기(yaw/pitch)가 있고, 컬링으로 표본이
       달라진다. 그래서 <b>판정선을 1.15</b>로 둔다(두상 높이의 15%면 눈썹→눈 밑).
     비용: 이미 만들어진 cpts를 훑는다(가닥당 점 몇 개). */
  try{
    const _pl = [];
    for(const p of projected){
      const c = p.cpts; if(!c || c.length < 2) continue;
      let L = 0;
      for(let i=1;i<c.length;i++) L += Math.hypot(c[i].x-c[i-1].x, c[i].y-c[i-1].y);
      _pl.push(L);
    }
    if(_pl.length){
      _pl.sort((a,b)=>a-b);
      const pxMed = _pl[(_pl.length*0.5)|0];
      let modelW = 0; try{ const E = getHeadEllipsoid(); if(E) modelW = 2*E.a; }catch(e){}
      const S = state._adjStamp && state._adjStamp['2D투영'];
      const cmPer = modelCmPerUnit();
      /* 2D 도장이 이미 재 둔 호길이(cm)를 모델 단위로 되돌려 쓴다 — 자를 두 벌
         만들지 않는다(이 파일이 반복해서 갈라진 자리). */
      const modelLen = (S && cmPer) ? (S.lenCm / cmPer) : null;
      if(modelLen && modelW > 1e-9 && spanX > 1e-9){
        const stretch = (pxMed / spanX) / (modelLen / modelW);
        (state._projStretch || (state._projStretch = {}))[angle] =
          { stretch:+stretch.toFixed(3), pxMed:+pxMed.toFixed(0), spanX:+spanX.toFixed(0),
            modelRatio:+(modelLen/modelW).toFixed(3), n:_pl.length };
      }
    }
  }catch(e){}
  projected.sort((a,b)=> a.depth - b.depth); // 뒤(작은 depth)부터 → 앞이 위에 덮임
  /* 슬라이더를 잡고 흔들면 이 줄이 초당 수십 번 나간다. 폰의 console.log는
     공짜가 아니라(문자열 조립 + 원격 콘솔 버퍼) 재는 행위가 재려는 대상을
     느리게 만든다. PERF.minGapMs 간격으로만 찍는다 — 값 자체는 그대로다. */
  if(PERF.on && perfCanLog()){
    const t2 = performance.now();
    let pts = 0; for(const st of adj) pts += st.pts.length;
    console.log('[성능·' + angle + '] 조정연산 <b>' + (_perfT1-_perfT0).toFixed(0) + 'ms</b>'
      + ' · 투영 ' + (t2-_perfT1).toFixed(0) + 'ms'
      + ' · 가닥 ' + adj.length + '개/점 ' + (pts/1000).toFixed(0) + '천개'
      + ' · ' + adjCacheLine()
      + perfLine()
      + '\n    JS힙이 뷰를 오갈 때마다 <b>계단처럼</b> 오르면 누수(가닥 객체·캔버스),'
      + ' 평평한데 ms만 크면 순수 계산량입니다. PERF.on=false로 끕니다.');
  }
  logStrandRender(angle, { spanX, unit, cssW, roles, rawTotal, targetStrands, pxN,
                           stride, total: src.length, drawn: projected.length,
                           hidPts, hidAll, faceCut, faceCutStrands, gap: _gap,
                           faceSil: faceSil ? { w: Math.round(faceSil.w), h: Math.round(faceSil.h),
                                                yTop: faceSil.yTop, yBot: faceSil.yBot, dir: faceSil.dir,
                                                fit: faceSil.fit } : null,
                           crown: { n: cwN, drop: cwDrop, pts: cwPts, vis: cwVis },
                           rootDev: summarizeRootDev(rootDev, projected0.length, maskInf),
                           spanBySec: _spanBySec, spanC: _spanC });

  // 다발 속 미세 틴트 — 가닥마다 다른 색을 주되 팔레트 색에서 벗어나진 않게.
  // FORCED_HAIR_COLOR(검정 지정 등)일 땐 상한 1.06 — tintColor가 bright>1에서
  // 흰색을 가산 혼합하므로 검은 머리에 회백색 가닥이 섞이는 것을 막는다(기존 규칙).
  const forced = (typeof FORCED_HAIR_COLOR!=='undefined' && FORCED_HAIR_COLOR);
  /* 마무리 질감(finish) — 3D 이식 (2026-07-27)
     이건 형태가 아니라 <b>빛</b>이라 3D 연산자가 아니라 렌더에서 낸다.
     윤기(>50) = 다발 안 가닥끼리 밝기 차가 커져 하이라이트 줄이 생김 + 전체 살짝 밝게.
     매트(<50) = 가닥끼리 밝기가 고르게 눌려 광택 줄이 사라짐.
     실제 왁스/에센스를 발랐을 때 보이는 차이가 딱 이 "가닥 간 명암 대비"다. */
  // (2026-07-27) 스타일링이 뷰별이 됐으므로 광택도 <b>그리는 뷰</b>의 값을 쓴다.
  const finSty = (state.stylingByView && state.stylingByView[angle]) || state.styling;
  const finRaw = (finSty && typeof finSty.finish === 'number') ? finSty.finish : 50;
  const fin = (Math.max(0, Math.min(100, finRaw)) - 50) / 50;   // -1(매트) ~ +1(윤기)
  /* 계수는 실측으로 정했다: 0.8/0.04로는 윤기 쪽이 중립과 구분이 안 됐다
     (검은 머리 + 색 양자화 20단계에 묻혀 같은 버킷으로 떨어짐). 매트 쪽만
     반응하고 윤기 쪽은 무반응인 반쪽 손잡이였다. */
  // 0 아래로 내려가면 명암 순서가 <b>뒤집힌다</b>(밝아야 할 가닥이 어두워짐).
  // fin*1.6이라 fin<-0.63에서 음수가 됐다 — 매트를 끝까지 내리면 그렇게 됐다.
  const varMul  = Math.max(0, 1 + fin * 1.6);                    // 가닥 간 명암 대비
  const baseMul = 1 + fin * 0.10;                                // 전체 밝기
  /* 왜 tintColor를 안 쓰고 여기서 따로 만드는가(2026-07-27 실측):
     tintColor는 bright>1에서 <b>흰색을 가산 혼합</b>한다. 검은 머리(#111)에
     1.3을 주면 rgb(140,140,148), 1.5면 거의 흰색이라 윤기가 아니라 "검정 사이
     흰 가닥"이 된다(예전 실기기 지적). 그래서 상한을 걸었더니 이번엔 반대로
     윤기 쪽이 <b>한 픽셀도 안 변했다</b> — 어두운 쪽으로 낼 수도 없었다.
     #111에서 밝기를 0.84↔0.69로 흔들어봐야 rgb 14↔12, 눈에도 안 보이고
     양자화 버킷도 같다. 즉 검은 머리는 <b>내릴 여지가 없다</b>.
     → 자체 틴트로 교체. 어두운 쪽은 곱셈, 밝은 쪽은 <b>회색 쪽으로 완만히</b>
       올린다(흰색이 아니라 게인 160). #111 기준 1.5배여도 rgb 99 정도라
       "검은 머리에 윤기"로 보이지 흰 가닥이 되지 않는다. */
  /* (2026-08-02) 예전엔 다발 안 <b>서브라인 위치</b>(k)로 밝기를 갈랐다 — 다발이
     없어졌으니 이제 <b>가닥별</b> 밝기 지터로 낸다. 폭(colVar×0.35×varMul)은
     그대로라 마무리 질감(윤기↔매트) 손잡이의 반응 크기도 예전과 같다.
     가닥 고유 색(st.color)은 중립 캡처 때 원본 결 보기의 틴트가 이미 구워져
     있으므로, 여기서 더하는 건 <b>마무리 질감</b> 몫뿐이다(이중 틴트 방지). */
  const strandTint = (h)=> Math.max(0.45, Math.min(1.55,
    baseMul + (h - 0.5) * 2 * R.colVar * 0.35 * varMul));
  window._lastTint = { fin, varMul, baseMul, forced: !!forced,   // [진단용]
    tint: [strandTint(0), strandTint(0.5), strandTint(1)] };

  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalAlpha = 1;

  /* ── 언더코트 — 원본 결 보기와 같은 규칙 ────────────────────────────────
     원본 결 보기는 "가닥 경로를 따라 두피색 굵은 획(굵기 ×2.2)을 먼저 깔아
     가닥 사이 빈틈만 메운다". 다발 렌더에선 다발 폭 ×1.15였는데(그리고 기본
     꺼짐이라 가닥 사이로 원본 사진의 머리가 비쳤다), 이제 원본 결 보기와
     같은 배수를 쓴다. 끄려면 HAIR3D_RENDER.undercoat = false. */
  if(R.undercoat){
    ctx.strokeStyle = (maskInf.scalpColor) || 'rgb(224,178,148)';
    const und = new Map();  // 굵기별로 묶어야 lineWidth를 한 번만 바꾼다
    for(const p of projected){
      if(!und.has(p.wk)) und.set(p.wk, []);
      und.get(p.wk).push(p);
    }
    for(const arr of und.values()){
      ctx.lineWidth = arr[0].w * HAIR_STRAND_LOOK.undercoatMul;
      ctx.beginPath();
      // 언더코트도 <b>보이는 구간</b>만 — 안 그러면 두피색 획이 목·얼굴 위에 남는다
      for(const p of arr) for(const [s,e] of p.runs) traceSmoothPolyline(ctx, p.cpts.slice(s, e+1));
      ctx.stroke();
    }
  }

  // ── 가닥 배치: (슬라이스 × 양자화 색 × 굵기) 한 묶음 = beginPath/stroke 1회 ──
  // 색을 양자화하지 않으면 가닥마다 색이 미세하게 달라 배치가 전혀 안 된다.
  // 굵기를 키에 넣는 이유: 한 묶음 안에서 lineWidth는 하나뿐이라서.
  const batch = new Map();   // key → { col, w, depth, n, items:[cpts] }
  const push = (key, q, p, cpts)=>{
    let e = batch.get(key);
    if(!e){ e = { col: q, w: p.w, depth: 0, n: 0, items: [] }; batch.set(key, e); }
    e.items.push(cpts); e.depth += p.depth; e.n++;
  };
  for(const p of projected){
    const tint = strandTint(p.hb);
    /* 조각별 실측색이 있으면 <b>조각을 각각</b> 묶는다. 배치 키에 색이 이미
       들어 있으므로, 조각이 늘어도 같은 색끼리는 여전히 한 번에 그려진다
       (stroke 횟수가 조각 수만큼 곱해지지 않는 이유). 조각은 끝점을 공유해야
       가닥이 점선으로 끊기지 않는다 — 2D의 strokeOpColored와 같은 규약. */
    if(p.colors && p.colors.length > 1){
      const n = p.cpts.length, K = p.colors.length;
      /* 실측 픽셀색은 사진이 이미 자기 명암(뿌리 어두움·광택 띠·끝 밝음)을
         갖고 있다 — 그 위에 가닥별 밝기 지터를 또 얹으면 사진의 결이 지워지고
         "색연필" 느낌이 돌아온다. 마무리 질감의 <b>전체</b> 밝기(baseMul)만 태운다.
         예전 동작으로 되돌리려면 HAIR_PIXEL_COLOR.jitter = true. */
      const pxTint = HAIR_PIXEL_COLOR.jitter ? tint : baseMul;
      for(let k=0; k<K; k++){
        const i0 = Math.round(k*(n-1)/K), i1 = Math.round((k+1)*(n-1)/K);
        if(i1 <= i0) continue;
        const q = quantizeStrokeColor(bundleTintColor(p.colors[k], pxTint), R.quant);
        /* 조각(색) × 구간(보임)의 교집합만 그린다(8/18 i). 조각 경계식(i0/i1)은
           buildAdjustedHair3DObject·strokeOpColored와 글자 그대로 같게 둔다. */
        for(const [s,e] of p.runs){
          const a = Math.max(i0, s), b = Math.min(i1, e);
          if(b > a) push(p.slice + '|' + q + '|' + p.wk, q, p, p.cpts.slice(a, b + 1));
        }
      }
    } else {
      const q = quantizeStrokeColor(bundleTintColor(p.color || '#1a1a1a', tint), R.quant);
      for(const [s,e] of p.runs) push(p.slice + '|' + q + '|' + p.wk, q, p, p.cpts.slice(s, e+1));
    }
  }
  // 배치끼리도 평균 깊이 순으로 — 슬라이스 단위 painter's 정렬 유지
  const keys = Array.from(batch.values()).sort((a,b)=> a.depth/a.n - b.depth/b.n);
  for(const e of keys){
    ctx.strokeStyle = e.col;
    ctx.lineWidth = e.w;
    ctx.beginPath();
    for(const cpts of e.items) traceSmoothPolyline(ctx, cpts);
    ctx.stroke();
  }
  /* [진단] 얼굴 라인 보기 — FACE_GATE.debug=true 후 다시 그리면 게이트가
     실제로 어디를 얼굴로 보고 있는지 그대로 보인다. 값을 짐작으로 흔들지
     않기 위한 장치다(이 파일이 반복해서 필요로 했던 그것). */
  if(FACE_GATE.debug && faceSil){
    ctx.save();
    ctx.strokeStyle = 'rgba(0,255,180,0.9)'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for(let y=faceSil.yTop; y<=faceSil.yBot; y+=2){
      const l = faceSil.lo[y], h = faceSil.hi[y];
      if(!(h > l)) continue;
      ctx.moveTo(toCX(l + faceSil.inset), toCY(y));
      ctx.lineTo(toCX(h - faceSil.inset), toCY(y));
    }
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
  return true;
}
/* 다발 렌더 진단 — 같은 값이면 다시 찍지 않는다(슬라이더 드래그마다 콘솔 도배 방지).
   "왜 서브라인이 안 보이지"를 실기기에서 바로 판정할 수 있는 숫자만 남긴다:
   틈이 CSS 픽셀로 몇 픽셀인지가 핵심(1 아래면 화면에서 사라진다). */
/* 뿌리선 어긋남 요약 — 되쏜 뿌리가 원본 두피선보다 얼마나 위(바깥)에 찍히나.
   중앙값을 쓴다(평균은 늘어진 몇 가닥에 끌려간다). 단위는 마스크 픽셀. */
function summarizeRootDev(devs, offMask, maskInf){
  if(!devs.length) return null;
  const s = devs.slice().sort((a,b)=>a-b);
  const q = f => s[Math.min(s.length-1, Math.floor(s.length*f))];
  const above = devs.filter(v=>v < -2).length;
  return { med:q(0.5), p10:q(0.10), p90:q(0.90), above, n:devs.length,
           offMask, h: maskInf.h };
}
let _bundleLogKey = '';
/* 가닥 렌더 진단 (2026-08-02, 다발 렌더 진단을 대체) — 같은 설정이면 다시 찍지
   않는다(슬라이더 드래그마다 콘솔 도배 방지). 이제 볼 숫자는 "다발 폭·틈"이
   아니라 <b>레이어별 굵기와 개수가 원본 결 보기와 같은가</b>이다. */
function logStrandRender(angle, m){
  const css = v => (v / m.unit).toFixed(2);
  const wList = m.roles.map(r=> r.id + ' ' + r.w.toFixed(2) + 'px(화면 ' + css(r.w) + ')').join(' · ');
  const key = angle + '|' + wList + '|' + m.stride;
  // 화면 진단창에서 읽을 수 있게 항상 보관(콘솔을 못 보는 상황 대비)
  window._lastStrandDiag = window._lastStrandDiag || {};
  window._lastStrandDiag[angle] = {
    headCss: +css(m.spanX), unit: +m.unit.toFixed(2),
    drawn: m.drawn, total: m.total, stride: m.stride, pxN: m.pxN,
    hidPct: m.hidAll ? +(m.hidPts/m.hidAll*100).toFixed(1) : 0,
    rawTotal: Math.round(m.rawTotal), target: Math.round(m.targetStrands),
    roles: m.roles.map(r=>({ id:r.id, w:+r.w.toFixed(2), wCss:+css(r.w), n:Math.round(r.n) })),
    rootDev: m.rootDev,
    spanBySec: m.spanBySec,
  };
  if(key === _bundleLogKey) return;
  _bundleLogKey = key;
  if(m.rootDev){
    const d = m.rootDev;
    console.log(`[${angle}] 뿌리선 어긋남 — 중앙값 ${d.med.toFixed(0)}px`
      + ` (10~90% ${d.p10.toFixed(0)}~${d.p90.toFixed(0)}px, 마스크 높이 ${d.h}px)`
      + ` · 원본 두피선보다 <b>위</b>(바깥)에 찍힌 뿌리 ${d.above}/${d.n}개`
      + (d.offMask ? ` · 원본에 머리가 없는 컬럼 ${d.offMask}개` : ``)
      + ` ← 음수일수록 머리가 바깥에서 시작한다는 뜻`);
  }
  if(m.spanBySec){
    /* [깊이 폭] 겹 순서는 가닥당 스칼라 하나로 정한다 — 그게 대표가 되는지를 잰다.
       읽는 법은 <b>어느 섹션이 큰가</b>다. 위 _spanBySec 구역 주석 참고. */
    const rows = ['crown','front','temple','side','occipital','nape']
      .map(k => [k, m.spanBySec[k]]).filter(r => r[1] && r[1].n);
    if(rows.length){
      const line = rows.map(([k,e]) =>
        k + ' ' + (e.big ? '<b>' + Math.round(100*e.big/e.n) + '%</b>' : '0%')
          + '(평균 ' + (e.sum/e.n).toFixed(2) + ' 최대 ' + e.max.toFixed(2) + ' · ' + e.n + '가닥)'
      ).join('\n      ');
      const bad = rows.filter(([k,e]) => (k === 'occipital' || k === 'nape') && e.big/e.n > 0.15);
      console.log(`[${angle}] 깊이 폭 — 가닥 하나가 앞뒤로 얼마나 걸쳐 있나`
        + ` (두상 깊이반경 ${m.spanC.toFixed(2)}로 나눈 값 · 굵은 %가 ${DEPTH_SORT.bigSpan} 넘는 비율)`
        + `\n      ${line}`
        + `\n    front·crown이 크면 정상입니다 — 앞으로 넘긴 머리라 원래 앞뒤로 걸칩니다.`
        + ` 남는 문제는 <b>겹 순서</b>고, 볼 자리는 slice 키와 정렬 단위입니다.`
        + `\n    occipital·nape가 크면 <b>방향 오류</b>입니다 — 뒤통수에서 난 머리가 앞으로 나올 이유가 없습니다.`
        + ` 겹 순서를 고쳐도 안 고쳐지고, 볼 자리는 buildHairStrandsFromPaths의 두상 밖 z 결정과 alignStrandPtsToField3D입니다.`
        + (bad.length ? `\n    ⚠ ${bad.map(r=>r[0]).join('·')} 가 문턱을 넘었습니다 — 정렬이 아니라 방향부터 보십시오.` : ``));
    }
  }
  console.log(
    `[${angle}] 가닥 렌더(원본 결 보기와 동일 규칙) — 헤어폭 ${m.spanX.toFixed(0)}px(화면 ${css(m.spanX)}) · `
    + `표시배율 1/${m.unit.toFixed(1)} · 굵기 ${wList} · `
    + `가닥 ${m.drawn}개 그림(원본 픽셀색 ${m.pxN||0}개`
    + `${m.drawn ? ' = ' + Math.round((m.pxN||0)/m.drawn*100) + '%' : ''}) / 목표 ${Math.round(m.targetStrands)}개`
    + `(원본 결 보기 ${Math.round(m.rawTotal)}개 ×${(m.targetStrands/Math.max(1,m.rawTotal)).toFixed(2)}, `
    + `모델 ${m.total}개 중 솎기 ${(+m.stride).toFixed(2)}, 앞면만)`
    /* [진단] 가림 트리밍(2026-08-18 i) — 그린 가닥의 점 중 <b>몸에 가려서</b> 안
       그린 비율. 0%면 트리밍이 아무 일도 안 한 것(=8/18 h와 같은 그림)이고,
       정면에서 20~40%면 뒷머리가 목·얼굴 뒤를 지나던 구간이 걷힌 것이다.
       100%에 가까우면 그림자가 과하다(두개골 대신 헐을 쓰고 있는지 의심). */
    + (m.crown && m.crown.n ? `\n    [정수리 단계] 뿌리 phi<0.55 가닥 ${m.crown.n}개 · 컬링에서 버림 ${m.crown.drop}개(${Math.round(m.crown.drop/m.crown.n*100)}%)`
        + ` · 남은 가닥의 점 보임 ${Math.round(m.crown.vis/Math.max(1,m.crown.pts)*100)}%(${m.crown.vis}/${m.crown.pts})`
        + `\n      버림%가 크면 <b>컬링</b>(VIEW_CULL.mode='anyFacing'로 확인), 점 보임%가 낮으면 <b>가림 판정</b>(두개골 그림자에 가닥이 묻힘 — 정수리는 가닥이 두피에 붙어 있어 그림자 안에 들어갑니다),`
        + ` 둘 다 멀쩡한데 화면이 비면 <b>그리기</b>입니다(HAIR_SCALP3D.drawInset으로 두개골 구를 안쪽으로).` : '')
    + (m.hidAll ? ` · 가림 트리밍 ${Math.round(m.hidPts/m.hidAll*100)}%(점 ${m.hidPts}/${m.hidAll})`
                : ``)
    /* [진단] 얼굴 게이트(2026-09-04) — <b>반대편에서 난 가닥이 얼굴 위에 얼마나
       찍히고 있었나</b>. 0이면 게이트가 아무 일도 안 한 것이고(라인을 못 만들었거나
       반대편 가닥이 원래 얼굴에 안 닿았거나), 측면에서 수백 점이 지워지면 그게
       사용자가 보던 "얼굴 위를 지나가는 반대편 사이드"다.
       라인이 null이면 그 뷰에 얼굴 랜드마크가 없다는 뜻(후면 등) — 정상이다. */
    + (m.faceSil
        ? `\n    [얼굴 게이트] 라인 폭 ${m.faceSil.w}px · 행 ${m.faceSil.yTop}~${m.faceSil.yBot}`
          + ` · 얼굴방향 ${m.faceSil.dir > 0 ? '오른쪽' : '왼쪽'}`
          + ` · 지운 점 ${m.faceCut}${m.hidAll ? '(' + (100*m.faceCut/m.hidAll).toFixed(1) + '%)' : ''}`
          + ` · 걸린 가닥 ${m.faceCutStrands}개`
          + (m.faceSil.fit
              ? `\n      정합 ${m.faceSil.fit.used ? '적용' : '<b>거부</b>(안전레일)'}`
                + ` — 평행이동 (${m.faceSil.fit.tx.toFixed(1)}, ${m.faceSil.fit.ty.toFixed(1)})px`
                + ` · 배율 ${m.faceSil.fit.s.toFixed(3)} · 잔차 ${m.faceSil.fit.rms.toFixed(1)}px (표본 ${m.faceSil.fit.n})`
              : `\n      정합 없음(사진 좌표 그대로 — FACE_GATE.align='none'이거나 왕복 실패)`)
          + `\n      끄기: FACE_GATE.on=false · 라인 보기: FACE_GATE.debug=true 후 슬라이더 살짝`
        : `\n    [얼굴 게이트] 이 뷰는 얼굴 라인 없음(랜드마크 미검출 — 후면이면 정상)`)
    /* [진단] 끊긴 가닥(2026-09-06) — 위 숫자들이 "얼마나 지웠나"라면 이건
       "그래서 <b>화면이 뜯겼나</b>"다. 문이 여섯이라 눈으로는 못 가르므로
       구멍마다 범인을 적는다. 근거·되돌리기는 14의 GAP_DIAG·MQ_TRUST 배너. */
    + gapDiagText(m.gap, m.drawn)
  );
}
/* 다발 렌더 전용 틴트 — 어두운 쪽은 곱셈, 밝은 쪽은 회색 쪽으로 완만히.
   tintColor(전역)와 달리 흰색을 섞지 않아서 검은 머리에서도 색이 안 뜬다.
   게인 160 = 밝기 1.5에서 +80 → #111이 rgb(97,97,97) 정도의 광택 회색. */
const BUNDLE_SHEEN_GAIN = 160;
/* ── 색 문자열 → r,g,b (2026-08-23 중복 통합) ──────────────────────────
   bundleTintColor와 quantizeStrokeColor가 <b>같은 여덟 줄</b>을 각자 적고
   있었다. 값이 같으니 화면은 같지만, 한쪽에 rgba()나 3자리 #abc를 받게
   고치는 순간 다른 쪽만 26,26,26으로 떨어진다 — 이 파일이 반복해서 겪은
   "두 벌이 되면 반드시 갈라진다"의 자리다.
   ※ 폴백 26,26,26(=#1a1a1a)은 예전 두 함수가 쓰던 값 그대로다. */
function parseColorRGB(col){
  let r=26, g=26, b=26;
  if(typeof col === 'string' && col.charCodeAt(0) === 35){        // '#rrggbb'
    const n = parseInt(col.slice(1), 16);
    r=(n>>16)&255; g=(n>>8)&255; b=n&255;
  } else if(typeof col === 'string'){                             // 'rgb(r,g,b)'
    const mm = col.match(/\d+/g);
    if(mm && mm.length>=3){ r=+mm[0]; g=+mm[1]; b=+mm[2]; }
  }
  return { r, g, b };
}
function bundleTintColor(col, m){
  const { r, g, b } = parseColorRGB(col);
  if(m <= 1){
    return 'rgb(' + Math.round(r*m) + ',' + Math.round(g*m) + ',' + Math.round(b*m) + ')';
  }
  const lift = (m - 1) * BUNDLE_SHEEN_GAIN;
  const c = v => Math.min(255, Math.round(v + lift));
  return 'rgb(' + c(r) + ',' + c(g) + ',' + c(b) + ')';
}
// 'rgb(r,g,b)' / '#rrggbb' → step 간격으로 반올림한 'rgb(r,g,b)'.
// 배치 묶음 수를 유한하게 만들기 위한 색 양자화(가닥마다 다른 미세 틴트를 흡수).
function quantizeStrokeColor(col, step){
  const { r, g, b } = parseColorRGB(col);
  const q = v => Math.min(255, Math.round(v/step)*step);
  return 'rgb(' + q(r) + ',' + q(g) + ',' + q(b) + ')';
}

// ── (10차) 개발용 3D 검증 미니뷰 ──
// 최종 UX에선 조정 화면에서 3D를 숨기지만, 개발 중엔 "조정이 3D에서 제대로
// 일어나는지" 눈으로 봐야 함(사용자 지적). 정규 3D 모델(state.hair3D)을 직접
// 렌더하는 경량·독립 THREE 뷰 — 메인 3D 화면(model3D 싱글턴)과 충돌 안 함.
// 드래그 회전 + 탭 확대. 조정 시 refreshDevMini3D로 실시간 갱신.
// (12차) 미니뷰 섹션 구분색 — 크라운=호박, 프론트=파랑, 템플=핑크, 사이드=초록,
// 후두부=보라, 네이프=주황. 어느 부위가 어느 섹션인지 3D에서 즉시 확인.
const SECTION_COLORS = {
  crown:'#e6b93c', front:'#3ca6e6', temple:'#e64c8c',
  side:'#3ce67a', occipital:'#a860e6', nape:'#e67a3c'
};
let devMini3D = null;
function initDevMini3D(){
  if(devMini3D || typeof THREE === 'undefined') return devMini3D;
  const wrap = document.getElementById('devMini3DCanvasWrap');
  if(!wrap) return null;
  const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
  const w = wrap.clientWidth||150, h = wrap.clientHeight||150;
  renderer.setSize(w, h);
  wrap.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, w/h, 0.01, 100);
  camera.position.set(0, 0.15, 3);
  scene.add(new THREE.AmbientLight(0xffffff, 0.9));
  const group = new THREE.Group();
  scene.add(group);
  // 두상 기준 와이어(방향 감 잡기용) — 반투명 구
  let headWire = null;
  try {
    const he = getHeadEllipsoid();
    const g = new THREE.SphereGeometry(1, 16, 12);
    const m = new THREE.MeshBasicMaterial({ color:0x2a2620, wireframe:true, transparent:true, opacity:0.4 }); // 밝은 미니뷰 배경 대비용 어두운 와이어
    headWire = new THREE.Mesh(g, m);
    // (2026-08-01) 와이어는 <b>두피면</b> 크기로 — 예전엔 헤어 실루엣 크기라
    // 미리보기 두상이 머리카락 겉면만큼 커 보였다(사용자: "3D미리보기는 두상이 커").
    // (2026-08-17 c) 그 판정을 getDisplaySkullEllipsoid로 옮겼다 — 최종 3D 화면과
    // <b>같은 두개골</b>이어야 두 화면이 갈라지지 않는다(갈라져 있던 것이 이번 버그).
    const hwE = getDisplaySkullEllipsoid();
    headWire.scale.set(hwE.a, hwE.b, hwE.c);
    headWire.position.y = 0.15;
    group.add(headWire);
    // (10차 보강) 앞면(코) 마커 — 처음 봤을 때 어디가 앞인지 모르겠다는 피드백.
    // 얼굴 정면(+Z)에 액센트색 원뿔을 코처럼 붙임(그룹에 추가돼 함께 회전).
    // 코가 보이면 앞, 안 보이면 뒤 → 방향이 직관적으로 잡힘.
    const noseG = new THREE.ConeGeometry(he.a*0.18, he.c*0.5, 12);
    const noseM = new THREE.MeshBasicMaterial({ color:0xC98A4B });
    const nose = new THREE.Mesh(noseG, noseM);
    nose.rotation.x = Math.PI/2;            // 원뿔 축 +Y → +Z(정면)로
    nose.position.set(0, 0.06, he.c*0.98);  // 얼굴 높이·앞면 표면
    group.add(nose);
    // 앞면 라벨 대용 작은 텍스트 스프라이트("앞") — 코 위에 살짝
    try {
      const lc = document.createElement('canvas'); lc.width=64; lc.height=32;
      const lx = lc.getContext('2d');
      lx.fillStyle='#C98A4B'; lx.font='bold 22px sans-serif'; lx.textAlign='center'; lx.textBaseline='middle';
      lx.fillText('앞', 32, 16);
      const tex = new THREE.CanvasTexture(lc);
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map:tex, transparent:true }));
      spr.scale.set(0.22, 0.11, 1);
      spr.position.set(0, 0.22, he.c*1.05);
      group.add(spr);
    } catch(e){}
  } catch(e){}
  let dragging=false, lastX=0, lastY=0, autoRot=true;
  const dom = renderer.domElement;
  dom.addEventListener('pointerdown', e=>{ dragging=true; autoRot=false; lastX=e.clientX; lastY=e.clientY; e.preventDefault(); });
  window.addEventListener('pointerup', ()=>{ dragging=false; });
  window.addEventListener('pointermove', e=>{
    if(!dragging || !devMini3D) return;
    group.rotation.y += (e.clientX-lastX)*0.01;
    group.rotation.x += (e.clientY-lastY)*0.01;
    lastX=e.clientX; lastY=e.clientY;
  });
  devMini3D = { renderer, scene, camera, group, headWire, strandObj:null, fieldObj:null, occObj:null, raf:null, autoRot:()=>autoRot };
  /* 패널이 닫혀 있어도 이 루프는 <b>계속 돌고 있었다</b> (2026-08-22).
     display:none이어도 rAF는 멈추지 않으므로 GPU는 매 프레임 안 보이는 장면을
     그린다. 폰에서는 이게 곧 발열·배터리·다른 캔버스와의 메모리 경쟁이다.
     rAF 자체는 살려 둔다(패널을 다시 열 때 재시작 로직이 필요 없게) —
     비싼 render 호출만 건너뛴다. */
  /* ── 그런데 <b>보여도</b> 똑같은 그림을 계속 그리고 있었다 (2026-08-23) ──
     8/22에 "안 보이면 건너뛴다"를 넣었는데, 화면녹화를 다시 재니 패널이 보이는
     22초 동안 화면이 <b>초당 60회</b> 갱신되면서 미니뷰 픽셀 변화량은 0.04였다
     (잡음 수준 = 같은 그림). 손가락으로 한 번 돌리면 autoRot이 꺼지는데, 그
     뒤로는 회전도 안 하고 장면도 안 바뀌는데 render만 3,600번 돌았다.
     폰에서 이건 곧 발열·배터리 + 조정화면 렌더와의 GPU 경쟁이다.
     규칙: <b>바뀔 이유가 있을 때만</b> 그린다.
       · 자동회전 중 — 매 프레임 바뀐다(예전 그대로)
       · 드래그 중 / 방금 드래그가 끝났을 때
       · refreshDevMini3D가 형상을 다시 만들었을 때(markDirty)
       · 크기 변화 등 외부 요인 — 안전하게 0.5초에 한 번은 그냥 그린다
     그림이 바뀌는 프레임은 예전과 <b>한 장도 안 다르다</b>. 안 바뀌는 프레임만
     건너뛴다. 되돌리기: MOBILE_PERF.miniDirty = false */
  devMini3D._dirty = true;
  devMini3D.markDirty = ()=>{ if(devMini3D) devMini3D._dirty = true; };
  let _lastDrawAt = 0;
  function animate(){
    devMini3D.raf = requestAnimationFrame(animate);
    if(!devMini3DVisible()) return;
    if(autoRot){ group.rotation.y += 0.005; devMini3D._dirty = true; }
    if(dragging) devMini3D._dirty = true;
    if(MOBILE_PERF.miniDirty){
      const now = (typeof performance !== 'undefined') ? performance.now() : Date.now();
      if(!devMini3D._dirty && (now - _lastDrawAt) < 500) return;
      _lastDrawAt = now;
    }
    devMini3D._dirty = false;
    renderer.render(scene, camera);
  }
  animate();
  return devMini3D;
}

