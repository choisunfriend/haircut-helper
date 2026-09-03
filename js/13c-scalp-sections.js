/* ══════════════════════════════════════════════════════════
   13c-scalp-sections.js — 겹침 정리 · 섹션=두피의 빈틈없는 분할 · 두피 경계
   원본 index.html 20828~22597행. 클래식 스크립트이므로 로드 순서가 곧
   실행 순서다 — index.html의 <script src> 순서를 바꾸지 말 것.
   ══════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════════
   겹침 정리 — 여러 뷰가 같은 두피에 겹쳐 심은 것을 실측 밀도로 되돌린다
   (2026-08-03)
   ─────────────────────────────────────────────────────────────────
   리프트는 뷰마다 그 뷰의 2,833가닥을 <b>전부</b> 심는다. 두 뷰가 같은 두피
   자리를 보면 둘 다 심는다 — 조율이 없다. 옆모습이 90°에서 벗어날수록 앞쪽이
   여러 겹으로 쌓이고, 실측 yaw가 43°/-39°였던 이번 촬영에서는 앞 반구를
   카메라 세 대가 겹쳐 봤다. 그게 "앞은 까맣고 뒤는 성근" 정체다.

   ── 어느 가닥을 버리나 ──────────────────────────────────────────
   <b>그 자리를 제일 비스듬히 본 뷰</b>의 가닥부터. 리프트가 뿌리마다 이미
   facing(=sqrt(1-u), 카메라 축에서 1, 실루엣 가장자리에서 0)을 계산해 두므로
   그대로 쓴다. 정면으로 본 뷰가 그 자리에 대해 제일 믿을 만한 관측이고,
   비스듬히 본 뷰는 같은 픽셀 폭이 훨씬 넓은 두피를 덮어 뿌리 위치가 부정확하다.
   즉 <b>버릴 것부터 버린다</b> — 무작위 솎기가 아니다.

   ── 얼마나 남기나 (사용자 지시 그대로) ──────────────────────────
   사용자: "실측된 구역은 채우기하고, 추정셀 놔두기까지 하고, 나머지 대머리
   부분은 과제로 체크해둬."
     · est=0 (실측 셀)  → 실측 밀도를 목표로 <b>과밀은 솎고 모자라면 채운다</b>
     · est=1,2 (추정 셀) → <b>손대지 않는다</b>. 이웃/전체평균으로 채운 값이라
       목표치로 쓰면 지어낸 숫자에 실측 가닥을 맞추게 된다.

   ── 기준 K를 <b>제일 촘촘한 뷰</b>에서 뽑는 이유 (2026-08-03 2차) ──────
   사용자: "back을 손 안댔어? 거기 머리가 적은데."
   맞는 지적이고, 1차 구현은 그 상태로 두면 <b>더 나빠진다</b>. 원인이 로그에 있다:
       front 마스크 18,411px · left 20,875 · right 23,170 · <b>back 47,519</b>
   후면 마스크가 정면의 <b>2.6배</b>인데, 리프트는 뷰마다 똑같이 2,833가닥을
   심는다(각 뷰의 2D 목표 개수가 고정이라서). 즉 후면은 면적당 가닥이 원래
   2.6배 성글다 — 겹침과 무관한, <b>뷰당 고정 예산</b>이 만든 성김이다.
   그런데 겹치지 않은 셀은 대부분 <b>후면</b>이다(앞은 세 뷰가 겹쳐 봤으므로).
   그래서 K를 "한 뷰만 심은 셀 전체의 중앙값"으로 잡으면 K가 곧 <b>후면의 성긴
   밀도</b>가 되고, 앞머리를 거기까지 깎아내려 머리 전체가 성글어진다.
   고침: K를 <b>뷰마다 따로</b> 내고(K_v = 그 뷰만 심은 셀들의 중앙값)
   <b>가장 큰 값</b>을 쓴다 = 제일 촘촘하게 관측된 뷰가 기준. 그러면
     · 앞 — 겹친 만큼만 솎이고, 자기 밀도 아래로는 안 깎인다
     · 뒤 — 기준에 못 미치는 만큼 <b>채워진다</b>(아래 ④)

   ── 남은 구조적 한계: 4뷰 (2026-08-03, 사용자 정리) ──────────────
   사용자: "이게 4뷰의 한계인 거 같아. MVP 기능을 다 하고 나면 360 촬영을 해서
   12장을 30도 간격으로 빼내는 게 나을 거 같아." — 동의한다. 여기서 하는 건
   <b>사후 보정</b>이다: 뷰가 넷뿐이라 앞은 세 겹으로 겹치고 뒤는 한 뷰가 2.6배
   면적을 혼자 감당하는데, 그걸 밀도로 되돌려 놓는 것일 뿐 없던 관측이 생기진
   않는다. 아래 ④의 채우기도 <b>이웃 가닥 복제</b>지 실측이 아니다.
   <b>TODO(360촬영)</b>: 30° 간격 12장이 들어오면 이 함수의 존재 이유가 대부분
   사라진다 — 뷰당 겹침이 균일해지고(어느 자리든 2~3뷰), 뷰당 마스크 면적도
   고르게 나뉘어 고정 예산 2,833이 면적당 같은 밀도가 된다. 그때 볼 자리:
     ① jobs 구성 — MIRROR_SRC(거울 채움) 자체가 필요 없어진다
     ② 뷰당 가닥 예산을 <b>마스크 면적 비례</b>로 (지금은 뷰마다 고정)
     ③ 이 함수는 est=0 셀의 미세 보정만 남기고 강도를 낮출 것

   ── 남은 과제 (2026-08-03) ─────────────────────────────────────
   <b>TODO(대머리)</b>: 닫기 반경(HAIR_IDENTITY.closeFrac=0.06 → 마스크 폭의
   6%, 지름 약 12%)보다 <b>큰</b> 민머리는 measureViewHairIdentity의 region에
   안 들어와 한 번도 안 세지고, fillUnseenRootCells의 BFS가 주변 머리 밀도로
   채운다. 즉 <b>큰 대머리일수록 오히려 사라진다</b>. 여기서는 est>0 셀을
   안 건드리므로 <b>없는 머리를 심지는 않는다</b>(오늘 기준 안전). 하지만
   "정수리가 비었다"를 3D가 재현하지도 못한다. 고칠 자리는 둘:
     ① measureViewHairIdentity — 두상 타원 안이면 마스크 밖도 실측 후보에 넣기
        (지금은 morphClose로 끌어온 만큼만 본다)
     ② fillUnseenRootCells — 실측 0 셀에 <b>둘러싸인</b> 미측정 셀은 평균이 아니라
        0 쪽으로 수렴시키기(지금은 어느 쪽이든 이웃 평균)
   그 전까지 이 함수는 대머리를 <b>모르는 채로</b> 동작한다 — 지어내지 않을 뿐이다.
══════════════════════════════════════════════════════════════════ */
const HAIR_OVERLAP = {
  on: true,            // false면 예전 동작(전부 심기) — A/B용
  minKeep: 1,          // 실측 밀도가 있는 셀은 최소 이만큼 남긴다(솎다가 구멍 내지 않게)
  minDen: 0.05,        // 이보다 옅은 실측 밀도는 K 표본에서 뺀다(0 나눗셈·과대추정 방지)
  calibMinCells: 8,    // K 표본이 이보다 적으면 못 믿는다 → 정리 건너뜀
  /* K를 <b>중앙값이 아니라 위쪽 백분위</b>로 낸다 (2026-08-03 3차, 아래 주석 참조).
     rim 셀이 표본의 아래쪽을 채우기 때문에 중앙값은 늘 과소평가가 된다. */
  calibPct: 0.75,
  minSamplesPerCell: 1,  // 주력 뷰가 이만큼은 심은 셀만 K 표본으로(빈 셀이 기준을 끌어내리지 않게)
  /* 헐 분리로 모발이 <b>두께</b>를 갖게 됐다(사용자 지적). 가닥은 두피면~헐 사이
     껍질에 t로 흩어지므로, 같은 개수라도 한 겹은 성글어 보인다. 표면 셀 하나를
     "가득 찬 것처럼" 보이게 하려면 껍질 몫만큼 더 있어야 한다. 1.0이면 예전 동작. */
  shellFill: 1.6,
  /* 안전 레일 — 이 비율 넘게 솎이면 그건 겹침이 아니라 <b>기준(K)이 틀린 것</b>이다.
     3차에서 실제로 35%가 날아갔다(사용자: "3D로 전환된 이후부터 전반적으로 성글어졌어").
     넘으면 K를 올려 다시 계산하고, 올렸다는 사실을 콘솔에 남긴다. */
  maxDropFrac: 0.20,
  headroom: 1.15,      // 목표치 여유 — 격자·투영 오차만큼은 봐준다(빡빡하면 멀쩡한 것도 깎임)
  // ── 채우기(모자란 실측 셀) ──
  fill: true,          // false면 솎기만(1차 동작)
  /* 그 셀 원본 대비 이 배수까지만 복제 — 1개에서 20개를 만들지 않게.
     (2026-08-08 #2) 3 → <b>5</b>. 균일 목표를 세워도 이 상한이 먼저 걸리면 성근 셀이
     목표에 못 닿는다(하네스: 3가닥 셀이 목표 16인데 9에서 멈춤). 5면 15까지 간다.
     ※ 원본이 1~2가닥인 셀은 5를 써도 목표에 못 닿는다 — 복제는 보간이라
       없는 것을 만들지는 않는다. 그건 정직한 한계고 로그의 "채운 셀"로 보인다.
     (2026-08-18) 위 ※의 "정직한 한계"가 <b>후두부 상단의 빈 띠</b>였다 —
       아래 fillBorrowTopUp 주석 참고. 상한 자체는 그대로 두고(한 가닥을
       스무 개로 부풀리지 않는다는 규칙은 옳다) 모자란 몫만 이웃에서 빌린다. */
  fillMaxMul: 5,
  /* ── 모자란 셀도 <b>이웃에서 빌린다</b> (2026-08-18) ───────────────────────
     사용자: "후두부 상단쪽이 한 섹션 분량만큼 비거든. 2D 원본 결 보기에서는
     괜찮은데 3D로 전환하면서부터 비어."

     8/17 c의 fillVoid는 <b>가닥이 0개인</b> 셀만 봤다. 그런데 후두부 상단은
     0이 아니라 <b>1~2개</b>다 — 수평 카메라 넷 중 그 자리를 정면으로 보는 건
     후면 한 대뿐이고, 좌/우는 자기 실루엣 rim으로 스치며, 정면은 아예 뒤편이라
     발언권이 없다(projectToCam의 lz≤0). 그래서 그 띠는 "비어 있다"가 아니라
     "성글다"로 분류돼 ③.5의 후보에서 빠지고, ④에서는 <b>자기 원본만</b>
     복제하므로 fillMaxMul(×5) 상한이 먼저 걸린다:
         원본 2가닥 · 목표 27 → 상한 10에서 멈춤 = 이웃의 37% 밀도
     한 띠 전체가 그 상태면 배경이 비친다. 이웃에서 빌리는 코드는 이미 있는데
     `if(!src.length)` 안에 갇혀 있어서 <b>원본이 0일 때만</b> 돌았다.

     왜 두상 모양을 고친 뒤에 <b>커졌나</b> — 목표치가 areaWeighted라 셀 면적에
     비례하는데(HAIR_OVERLAP.areaWeighted), 구에 가깝던 두상이 실측 비율
     (깊이>폭, 세로 늘어남)로 바뀌면서 그 자리 셀 면적이 커졌다. 원본 가닥 수는
     그대로인데 목표만 올라가니 상한과의 격차가 그만큼 벌어진다.

     ※ 지어내는 게 아니다 — 빌려온 것도 <b>이 사람의 실측 가닥</b>이고, 복제본은
       아래에서 trimStrandToOccupancy3D로 다시 다듬으므로 사진이 "여긴 머리
       없음"이라고 하면 그 자리는 여전히 안 채워진다.
     false면 예전 동작(원본 0개인 셀만 빌림). */
  fillBorrowTopUp: true,
  /* ── #2 균일 채움 (2026-08-08) ────────────────────────────────────────
     사용자: "일단은 대머리처럼 확실히 머리가 없는 곳이 아니면, 머리 전반적으로
     뿌리채움 수를 동일하게 해서 고르게 만들기." / "2는 지난 결정을 뒤집는 게 맞아.
     이번 단계를 위해 일단 특수한 경우를 빼고 일반화해서 가는 거야."

     지난 회차의 규칙(실측 셀만 손대고 추정 셀은 그대로)을 뒤집는다. 그렇게 둔
     이유는 "지어낸 밀도에 실측 가닥을 맞추지 않는다"였는데, 지금 목표는
     홍보영상용으로 <b>한 사람을 완성</b>하는 것이라 고르기가 정확성보다 앞선다.
     그리고 대머리 판정이 아직 못 믿을 상태라(큰 민머리일수록 오히려 지워지는
     TODO) 실질적으로는 "판정 없이 전부 고르게"가 된다 — 그게 이번 단계의 의도다.

     목표치를 밀도 비례가 아니라 <b>셀당 같은 수</b>로 준다. 부수 효과가 하나 있는데
     의도에 맞다: 셀 격자가 (극각 × 방위) 균등이라 정수리 셀은 적도 셀의 1/20
     면적이다. 같은 수를 주면 정수리가 면적당 20배 촘촘해진다 — 지금 비어 보이는
     바로 그 자리다.
     예외는 하나만 남긴다: <b>실측으로</b> 밀도가 0에 가까운 셀(est=0 && den<baldDen).
     추정 셀은 예외가 아니다(=채운다). */
  uniform: true,       // false면 지난 회차 동작(밀도 비례 + 추정 셀 보존)
  uniformPct: 0.75,    // 목표치 = 지금 셀당 가닥 수의 이 백분위
  /* (2026-08-08) 목표치를 <b>셀 면적에 비례</b>시킨다.
     사용자: "두상면적을 기준으로 잡아야 될 것 같고."
     맞다. 그리고 이걸 안 넣은 게 바로 앞 회차의 왜곡을 만들고 있었다 —
     격자가 (극각 × 방위) 균등이라 정수리 셀은 적도 셀의 <b>1/20 면적</b>인데
     "셀당 같은 수"를 주면 면적당으로는 20배를 몰아준 셈이 된다.
     실측이 그대로 나왔다: crown 구역 면적 10% / 실측 뿌리 <b>29%</b>(2.9배 과대),
     front 면적 7.4% / 뿌리 3%(0.4배 과소).
     false면 예전(셀당 균등) 동작. */
  areaWeighted: true,
  /* ── #3 가닥 늘리기 (2026-08-08) — <b>이 파일에서 밀도 손잡이는 여기 하나</b> ──
     사용자: "3D로 만들어 두께가 생기면서 성글어진 것들 채워야 돼."
     헐이 분리되면서 가닥이 두피면~헐 사이 껍질에 t로 흩어진다. 같은 개수라도
     한 겹은 성글어 보이므로 그만큼 더 있어야 한다. #2(고르게)와 분리해 둔 이유가
     이것 — 백분위는 "지금 있는 수"라 여기에 곱해야 실제로 늘어난다.
     화면 쪽 짝은 HAIR3D_RENDER.targetMul이다(모델을 늘려도 그리는 목표가
     그대로면 화면은 안 변한다 — 둘이 같이 움직여야 한다). */
  densityMul: 1.6,
  baldDen: 0.08,       // 실측 밀도가 이 미만인 셀만 "확실히 머리 없음" — 안 채운다
  fillRing: 2,         // 셀에 원본이 하나도 없으면 이 반경까지 이웃에서 빌린다
  /* ── (2026-08-17 c) <b>아예 비어 있던</b> 셀도 채운다 ────────────────────
     사용자: "뒷머리 상단부가 빵꾸나는데 메울 수 있겠어? 배경이 비쳐."
     ④의 채움은 inCell(가닥이 <b>하나라도</b> 있는 셀)만 돌았다. 뿌리가 0인 셀은
     맵에 키조차 없어서 shortCells에 못 들어갔고, 그래서 <b>한 덩어리로 빈 자리</b>는
     손도 못 댄 채 남았다 — 뒷머리 위쪽이 정확히 그 모양이다(2D 원본 결 보기는
     뷰별 렌더라 멀쩡한데 3D 미리보기부터 구멍이 보이는 이유도 이것: 구멍은
     리프트 결과인 모델에 있다).
     대상은 실측/추정이 "머리 있음"이라고 말하는 셀뿐이다(isBald 제외). 그리고
     복제본은 아래에서 세그멘테이션(trimStrandToOccupancy3D)으로 다시 다듬으므로,
     사진이 "여긴 머리 없음"이라고 하면 그 자리는 채워지지 않는다 — 지어내지 않는다.
     빈 자리 한가운데는 이웃도 비어 있으므로, <b>실측 셀에서 가까운 순서로</b>
     채우고 채운 셀을 다음 이웃의 원본으로 등록해 바깥에서 안으로 번져 들어간다. */
  fillVoid: true,
  /* 안전 레일 — 빈 셀 채움이 모델의 이 비율을 넘으면 멈춘다. 넘는다는 건 구멍이
     아니라 <b>모델 절반이 비어 있다</b>는 뜻이고, 그건 복제로 덮을 문제가 아니라
     리프트·포즈를 봐야 하는 문제다(로그에 남긴다). */
  voidMaxFrac: 0.25,
  fillJitter: 0.9,     // 셀 안에서 뿌리를 흔드는 폭(셀 크기 대비) — 1이면 셀 전체
};

/* ══════════════════════════════════════════════════════════════════
   #4 섹션을 <b>3D 뿌리 위치</b>에서 정한다 (2026-08-08)
   ─────────────────────────────────────────────────────────────────
   사용자: "지금 구획이 어떻게 나눠지는지는 모르겠는데, 프론트가 아예 없는 경우도
   많고 사이드는 완전 넘치고 막 이랴."
   로그가 그대로 말한다 — 같은 두피인데 <b>뷰마다 딴 섹션</b>으로 센다:
       front 뷰: crown26% front39% temple34% side<b>0%</b> occipital0% nape0%
       left  뷰: crown32% front<b>0%</b>  temple15% side17% occipital7% nape<b>29%</b>
       right 뷰: crown15% front<b>0%</b>  temple6%  side25% occipital7% nape<b>47%</b>
   정면에서 옆통수가 0%일 리 없고(보인다), 51°에서 앞머리가 0%일 리 없고,
   우측 뷰의 절반이 네이프(목선)일 리 없다.

   원인은 resolveSectionId가 <b>뷰별 2D 밴드</b>로 판정하는 것이다. 뷰마다 밴드가
   따로 있어서 한 뷰를 고치면 다른 뷰가 깨진다(코드에 12차·13차·15차 재설계 기록이
   그대로 남아 있다 — 매번 한 뷰를 고치고 다른 뷰를 깨뜨렸다).

   고침: 섹션은 <b>뷰의 성질이 아니라 두피의 성질</b>이다. 뿌리의 3D 위치
   (phi=정수리각, theta=방위각)로 정하면 어느 뷰에서 캡처했든 같은 자리는 같은
   섹션이 된다. 그리고 그 구역표는 <b>이미 있다</b> — SCALP_ZONES. 절차 생성 3D
   경로가 삭제되면서 소비자가 HEAD_PHI_BANDS만 남았을 뿐이다. 되살려 쓴다.
   ※ 지어낸 상수가 하나도 안 늘어난다. 판정 방식만 바꾼다.
══════════════════════════════════════════════════════════════════ */
const SECTION_3D = { on: true };   // false면 예전 동작(뷰별 2D 밴드 라벨을 그대로 승계)
/* (2026-08-23 정리) _angDiff — 각도 차를 ±π로 접는 헬퍼가 여기 있었는데 부르는
   곳이 한 곳도 없었다. 이 구역이 뷰별 2D 밴드에서 3D 섹션으로 옮겨 오면서 남은
   것으로 보인다. 다시 필요해지면 wrapPi로 한 줄이다. */
/* ── 크라운은 <b>잔여</b>다 (사용자 정의, 2026-08-08 재확인) ──────────────────
   "크라운을 빼고 나머지를 다 먼저 구분한 다음에 정수리 나머지 부분을 크라운으로."
   이전 구현은 크라운도 같은 점수판에 올려놓고 0.55 가중치로 <b>경쟁</b>시켰다 —
   가중치를 얼마로 잡느냐에 따라 크라운이 앞머리·옆머리를 먹는 양이 달라지는,
   근거 없는 손잡이였다. 지금은 경쟁을 없앤다:
     1) 크라운을 뺀 구역(front/temple/side/occipital/nape)만 점수로 판정
     2) 아무 구역도 안 잡은 점 중 phi가 크라운 밴드 안이면 → 크라운
     3) 그래도 남으면 최근접 구역
   결과: 크라운은 정의상 다른 구역이 안 가져간 정수리 잔여만 갖는다. 가중치
   상수 하나(0.55)가 사라지고, 겹침 구간(phi 0.55~0.60)은 방위가 맞는 front로 간다. */
/* ══════════════════════════════════════════════════════════════════
   섹션 = 두피의 <b>빈틈없는 분할</b> (2026-08-09)
   ─────────────────────────────────────────────────────────────────
   사용자: "사용자가 조정하는 건 1)뷰 2)섹션 3)슬라이더다. 섹션 단위로
   움직였을 때 결과가 나와야 한다."

   그러면 섹션은 <b>조정의 단위</b>이지 분류 결과가 아니다. 그 관점에서 예전
   구현을 재보니 문제가 하나 나왔다 — 두피 균등 샘플 6,000점 중 <b>43%</b>가
   어느 구역에도 안 들어가서 "최근접 구역"으로 억지 배정됐다. 배정 자체는
   공간적으로 이어져 있었지만(이웃 8개 중 95% 일치) <b>경계가 어디 그어질지를
   아무도 정하지 않은</b> 상태였다. 특히 얼굴 앞쪽 하단(phi>1.05, θ≈0)이
   통째로 side로 흘러들어가, 정면 뷰 뿌리의 47%가 side가 됐다.

   구역표를 점수로 겨루게 하는 구조가 원인이다. phiRange가 서로 겹치고
   (front 0.55~0.95 · temple 0.60~1.05 · occipital 0.70~1.65), 덮이지 않는
   틈이 남고, 그 틈을 최근접이 메운다. 손잡이(thetaSpread·가중치 0.4/0.6)를
   흔들면 경계가 통째로 움직인다 — 미용사한테 설명할 수 없는 경계다.

   그래서 <b>겨루기를 없애고 자른다</b>. 미용사가 실제로 섹셔닝하는 순서 그대로:
     ① 정수리를 먼저 뜬다        (phi < CROWN_PHI)
     ② 남은 것을 옆선으로 가른다 (|θ| 로 앞·옆·귀·뒤)
     ③ 목선 아래를 따로 뜬다     (phi ≥ NAPE_PHI)
   각 점은 정확히 한 구역에 속하고, 경계는 각도 하나로 말할 수 있다.
   최근접 폴백이 없어진다 — 덮이지 않는 자리가 없으므로.

   경계값은 SCALP_ZONES에서 그대로 가져온다(새 상수를 만들지 않는다):
     CROWN_PHI = crown.phiRange[1]           = 0.60
     NAPE_PHI  = nape.phiRange[0]            = 1.55
     θ 경계는 인접 구역 대표 방위의 <b>중간</b> — front(0)·temple(0.75)·
     side(1.35)·occipital(π)의 중점이라 지어낸 값이 아니다.
   ※ SCALP_ZONES 자체는 그대로 둔다 — HEAD_PHI_BANDS가 그 phiRange에서 나온다.
══════════════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════════
   두피 경계 — 뿌리가 <b>심길 수 있는 범위</b> (2026-08-09)
   ─────────────────────────────────────────────────────────────────
   사용자: "턱 아래쪽 헤어들은 후면에서 이어지는 것들이니 구분이 되어야지.
   거기에 뿌리가 잡히면 안 되니까." · "뿌리의 범위를 세그멘테이션으로 잡아서
   그런 것 같은데, 실제 심기는 구간으로 한정해야 되겠다."

   정확한 지적이고, 코드가 실제로 그러고 있었다. buildRootDensityField는
   두상 표면 셀을 전부 훑으면서 <b>그 점이 사진에서 머리카락으로 보이는가</b>만
   묻는다(probe.densityAt). 턱 아래·뺨 옆은 손님의 긴 머리가 흘러내려 덮고
   있으므로 "머리 많음"이 나오고, 그래서 <b>턱 밑 두상 표면에 뿌리가 심긴다</b>.
   거기서 자란 가닥은 그대로 아래로 떨어져 가슴까지 내려오는 커튼이 된다 —
   정면 뷰에서 얼굴을 덮던 그 검은 커튼의 정체다.

   세그멘테이션은 "머리카락이 <b>보이는</b> 자리"를 말하지 "머리카락이
   <b>나는</b> 자리"를 말하지 않는다. 후자는 사진이 아니라 해부학이 정한다:
   앞은 이마 헤어라인, 옆은 귀 언저리, 뒤는 목덜미. 그 아래로는 두피가 없다.

   경계값은 지어내지 않는다 — SCALP_ZONES의 phiRange <b>상한</b>이 이미 그 선이다:
     |θ|=0(정면)    → front.phiRange[1]  = 0.95   이마 헤어라인
     |θ|=0.75(관자) → temple.phiRange[1] = 1.05
     |θ|=1.35(귀옆) → side.phiRange[1]   = 1.75
     |θ|=π(후면)    → nape.phiRange[1]   = 2.35   목덜미
   사이는 선형 보간. 이 선 <b>아래</b> 셀은 실측을 물어보지도 않고 밀도 0으로
   못박는다(est=3, "확정 대머리") — 사진이 뭐라 하든 두피가 아니기 때문이다. */
const SCALP_LIMIT = (()=>{
  const Z = SCALP_ZONES;
  return [
    [0,                             Z.front.phiRange[1]],
    [Math.abs(Z.temple.thetas[0]),  Z.temple.phiRange[1]],
    [Math.abs(Z.side.thetas[0]),    Z.side.phiRange[1]],
    [Math.PI,                       Z.nape.phiRange[1]],
  ].sort((a,b)=>a[0]-b[0]);
})();
// est 값: 0=실측 · 1=이웃추정 · 2=전체평균 · 3=두피 밖 · 4=정수리 보강
const EST_OFFSCALP  = 3;
const EST_CROWNFILL = 4;
function scalpPhiMax(th){
  const t = Math.abs(th), P = SCALP_LIMIT;
  if(t <= P[0][0]) return P[0][1];
  for(let i=1;i<P.length;i++){
    if(t <= P[i][0]){
      const [t0,p0] = P[i-1], [t1,p1] = P[i];
      return p0 + (p1 - p0) * (t - t0) / Math.max(1e-9, t1 - t0);
    }
  }
  return P[P.length-1][1];
}
const SECTION_CUT = (()=>{
  const Z = SCALP_ZONES;
  const mid = (a, b2)=> (a + b2) / 2;
  return {
    crownPhi: Z.crown.phiRange[1],                       // 0.60
    napePhi:  Z.nape.phiRange[0],                        // 1.55
    thFront:  mid(Z.front.thetas[0], Z.temple.thetas[0]),   // 0/0.75 → 0.375
    thTemple: mid(Z.temple.thetas[0], Z.side.thetas[0]),    // 0.75/1.35 → 1.05
    thSide:   mid(Z.side.thetas[0], Z.occipital.thetas[0]), // 1.35/π   → 2.25
  };
})();
function resolveSection3D(p, CY, b){
  if(!p || !(b > 1e-6)) return null;
  const ny = Math.max(-1, Math.min(1, (p.y - CY) / b));
  const phi = Math.acos(ny);
  const th  = Math.abs(Math.atan2(p.x, p.z));   // 0=정면(+Z) · π=후면. 좌우 대칭이라 절댓값.
  const C = SECTION_CUT;
  if(phi < C.crownPhi) return 'crown';          // ① 정수리를 먼저 뜬다
  if(phi >= C.napePhi){                         // ③ 목선 아래
    /* 목선 높이인데 <b>앞쪽</b>이면 그건 목이 아니라 구레나룻·귀 앞이다 —
       네이프가 얼굴 옆까지 감싸면 네이프 슬라이더가 구레나룻을 자른다. */
    return (th > C.thTemple) ? 'nape' : 'side';
  }
  if(th <= C.thFront)  return 'front';          // ② 옆선으로 가른다
  if(th <= C.thTemple) return 'temple';
  if(th <= C.thSide)   return 'side';
  return 'occipital';
}

/* 뿌리 3D 점 → 표면 셀 번호. forEachHeadSurfaceCell의 좌표식을 그대로 역산한다
   (y=CY+b·cos(φ), x=W·sin(θ), z=D·cos(θ)) — 같은 격자에 담겨야 den/est와 맞는다. */
function headSurfaceCellOf(x, y, z, hullW, hullD, bucketOfY, CY, b, NT, NP){
  const ny = Math.max(-1, Math.min(1, b > 1e-6 ? (y - CY) / b : 0));
  let pi = Math.floor(Math.acos(ny) / Math.PI * NP);
  pi = Math.max(0, Math.min(NP-1, pi));
  const bi = bucketOfY(y);
  const Wb = Math.max(1e-6, hullW[bi]), Db = Math.max(1e-6, hullD[bi]);
  const th = Math.atan2(x / Wb, z / Db);            // 타원 종횡비를 나눠야 셀이 안 쏠린다
  let ti = Math.floor((th + Math.PI) / (2*Math.PI) * NT);
  ti = ((ti % NT) + NT) % NT;
  return pi*NT + ti;
}

/* 셀 안의 한 점을 헐 표면 좌표로. r1/r2는 0~1 흔들기(0.5,0.5면 셀 중심). */
function headSurfaceCellPoint(ci, r1, r2, hullW, hullD, bucketOfY, CY, b, NT, NP){
  const pi = (ci / NT) | 0, ti = ci % NT;
  const ny = Math.cos((pi + r1) / NP * Math.PI);
  const y  = CY + b * ny;
  const bi = bucketOfY(y);
  const th = (ti + r2) / NT * 2*Math.PI - Math.PI;
  return { x: hullW[bi]*Math.sin(th), y, z: hullD[bi]*Math.cos(th) };
}

/* 셀마다의 <b>실제 표면적</b>(평균 1로 정규화). 격자가 (극각 × 방위) 균등이라
   면적은 sin(phi)에 비례해 <b>극에서 1/20</b>까지 작아진다 — 그걸 안 보면
   "셀당 같은 수"가 곧 "정수리에 20배 몰기"가 된다(사용자 지적).
   도함수를 풀지 않고 구석점 네 개로 두 삼각형 넓이를 더해 잰다 — 좌표식은
   headSurfaceCellPoint 그대로라 격자가 어긋날 수 없다. */
function headSurfaceCellAreas(hullW, hullD, bucketOfY, CY, b, NT, NP){
  const A = new Float32Array(NT*NP);
  /* (2026-08-23 정리) P(pi,ti) — 격자 좌표로 점을 뽑는 헬퍼가 여기 있었는데
     아래 루프는 headSurfaceCellPoint를 직접 부른다. 부르는 곳이 없었다. */
  const cross = (u, v)=> Math.hypot(u.y*v.z - u.z*v.y, u.z*v.x - u.x*v.z, u.x*v.y - u.y*v.x);
  const sub = (p, q)=> ({ x:p.x-q.x, y:p.y-q.y, z:p.z-q.z });
  let sum = 0;
  for(let pi=0; pi<NP; pi++) for(let ti=0; ti<NT; ti++){
    const ci = pi*NT + ti;
    const p00 = headSurfaceCellPoint(ci, 0, 0, hullW, hullD, bucketOfY, CY, b, NT, NP);
    const p10 = headSurfaceCellPoint(ci, 1, 0, hullW, hullD, bucketOfY, CY, b, NT, NP);
    const p01 = headSurfaceCellPoint(ci, 0, 1, hullW, hullD, bucketOfY, CY, b, NT, NP);
    const p11 = headSurfaceCellPoint(ci, 1, 1, hullW, hullD, bucketOfY, CY, b, NT, NP);
    const a = 0.5*cross(sub(p10,p00), sub(p01,p00)) + 0.5*cross(sub(p10,p11), sub(p01,p11));
    A[ci] = a; sum += a;
  }
  const mean = sum / (NT*NP) || 1;
  for(let i=0;i<A.length;i++) A[i] /= mean;      // 평균 1
  return A;
}

function pruneOverlappedRoots(strands, rootField, hullW, hullD, bucketOfY, CY, b, occProbe){
  const O = HAIR_OVERLAP;
  if(!O.on || !rootField || !rootField.ok || !strands.length) return null;
  const NT = rootField.NT, NP = rootField.NP, den = rootField.den, est = rootField.est;
  // 결정적 난수 — 재구성해도 같은 결과(리프트의 seed와 같은 원칙)
  let seed = 20260803;
  const rnd = ()=>{ seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

  // ── ① 뿌리를 셀에 담는다 ──
  const inCell = new Map();      // 셀 → 가닥 인덱스 배열
  const viewsOf = new Map();     // 셀 → 그 셀에 심은 뷰 이름 Set
  for(let i=0;i<strands.length;i++){
    const p0 = strands[i].pts && strands[i].pts[0];
    if(!p0) continue;
    const ci = headSurfaceCellOf(p0.x, p0.y, p0.z, hullW, hullD, bucketOfY, CY, b, NT, NP);
    strands[i]._cell = ci;
    let arr = inCell.get(ci); if(!arr){ arr = []; inCell.set(ci, arr); }
    arr.push(i);
    let vs = viewsOf.get(ci); if(!vs){ vs = new Set(); viewsOf.set(ci, vs); }
    vs.add(strands[i].srcAngle);
  }

  /* ── ② K(밀도 1당 가닥 수) — <b>모든 실측 셀</b>에서, 그 셀의 주력 뷰 몫으로 ──

     ── 2차가 왜 35%를 날렸나 (2026-08-03 3차, 실기기 로그로 확정) ──────────
     2차는 "한 뷰가 <b>혼자</b> 심은 셀"에서만 K를 냈다. 겹침이 안 섞이니 깨끗할
     줄 알았는데, 그런 셀이 실기기에서 <b>front 16개 · left 26 · right 45</b>
     (실측 셀 1,144개 중 1.4~4%)였다. 그리고 그 셀들이 어디냐면 — 다른 카메라는
     못 보고 <b>한 대만 간신히 본 자리</b>, 즉 실루엣 rim이다. rim은 원래 뿌리가
     제일 적게 떨어지는 자리라 K가 체계적으로 과소평가된다.
     결과: K=9.4 → 목표 9.4×0.46×1.15 = <b>5.0가닥/셀</b>인데 자연 밀도는
     11,220/826 = <b>13.6가닥/셀</b>. 자연의 37%를 겨눴고, 모델이
     11,220 → 7,268 (−35%)로 깎였다. 사용자: "3D로 전환된 이후부터 전반적으로
     성글어진 거 같아."

     고침 셋:
       ① 표본을 <b>모든 실측 셀</b>로. 겹친 셀도 쓰되, 그 셀에서 <b>제일 정면으로
          본 뷰의 몫만</b> 센다(nTop). 겹침은 빠지고 표본은 1,144개가 된다.
       ② 중앙값이 아니라 <b>위쪽 백분위</b>(calibPct). rim이 표본 아래쪽을 채우므로
          중앙값은 여전히 낮게 끌린다.
       ③ 목표치에 <b>껍질 몫</b>(shellFill)을 곱한다 — 헐 분리로 가닥이 두피면~헐
          사이에 t로 흩어지므로 한 겹만 보면 성글다. 그리고 <b>주력 뷰가 그 셀에
          실제로 심은 수(nTop) 아래로는 절대 안 깎는다</b> — 그게 겹침 없는 실측이다. */
  const ratios = [], topOf = new Map(), cellCounts = [], cellCellIds = [];
  inCell.forEach((arr, ci)=>{
    /* (2026-08-08 #2) topOf는 <b>모든 셀</b>에 대해 낸다 — 균일 모드에서는 추정 셀도
       대상이라 "주력 뷰가 실제로 심은 수"라는 바닥이 거기에도 필요하다.
       K 표본(ratios)은 예전대로 실측 셀에서만 뽑는다(추정 밀도로 기준을 만들지 않는다). */
    const cnt = {}, fac = {};
    for(const i of arr){
      const v = strands[i].srcAngle;
      cnt[v] = (cnt[v]||0) + 1;
      fac[v] = Math.max(fac[v]||0, strands[i].rootFacing||0);
    }
    let best = null;
    for(const v in cnt) if(!best || fac[v] > fac[best]) best = v;   // 제일 정면으로 본 뷰
    const nTop = cnt[best] || 0;
    topOf.set(ci, nTop);
    cellCounts.push(arr.length); cellCellIds.push(ci);
    if(est[ci] === 0 && den[ci] >= O.minDen && nTop >= O.minSamplesPerCell) ratios.push(nTop / den[ci]);
  });
  if(ratios.length < O.calibMinCells){
    console.warn('[3D·겹침] 기준을 낼 실측 셀이 ' + ratios.length + '개뿐 — 정리를 건너뜁니다.');
    return { skipped:true, cleanCells:ratios.length, dropped:0, added:0 };
  }
  ratios.sort((p,q)=>p-q);
  const kBase = ratios[Math.min(ratios.length-1, Math.floor(ratios.length * O.calibPct))];

  // ── ③ 과밀한 실측 셀 솎기 — 그 자리를 제일 비스듬히 본 뷰부터 ──
  /* 목표치 = max(주력 뷰가 실제로 심은 수, K×밀도×여유×껍질몫).
     안전 레일: 솎을 양이 모델의 maxDropFrac을 넘으면 겹침이 아니라 K가 틀린 것이니
     K를 올려 다시 잰다(로그에 남긴다). */
  /* (2026-08-08 #2) 균일 목표치 — 지금 셀당 가닥 수의 uniformPct 백분위 × 껍질 몫.
     상수를 지어내지 않고 <b>이 사람의 현재 분포</b>에서 뽑는다(사람마다 자동으로 맞음). */
  const cellArea = O.areaWeighted
    ? headSurfaceCellAreas(hullW, hullD, bucketOfY, CY, b, NT, NP) : null;
  const areaOf = (ci)=> cellArea ? Math.max(0.05, cellArea[ci]) : 1;
  let uniformTarget = 0;
  if(O.uniform && cellCounts.length){
    /* 껍질 몫(shellFill)은 <b>안 곱한다</b> — base가 이미 "지금 실제로 셀에 있는 수"라
       껍질에 흩어진 결과가 포함돼 있다. 곱하면 이중 계산이 되어 목표가 26가닥/셀까지
       뛰고 모델이 두 배로 부푼다(하네스 실측). 고르게 만드는 게 #2고, 전체를 더
       빽빽하게 만드는 건 #3이다 — 두 손잡이를 섞지 않는다. */
    /* base는 "면적 1짜리 셀의 목표"가 되도록 <b>면적으로 나눠</b> 뽑는다.
       안 그러면 면적을 곱하는 순간 총량이 그만큼 부푼다(작은 셀 기준으로 잡힌 값에
       큰 셀 면적을 곱하게 되므로). */
    const cc2 = O.areaWeighted && cellArea
      ? cellCounts.map((n, i)=> n / Math.max(0.05, cellArea[cellCellIds[i]]))
      : cellCounts;
    const ccs = cc2.slice().sort((p,q)=>p-q);
    const base = ccs[Math.min(ccs.length-1, Math.floor(ccs.length * O.uniformPct))];
    uniformTarget = Math.max(O.minKeep, base * O.headroom * O.densityMul);
  }
  // 균일 모드에서 이 셀을 손대도 되나 — 실측으로 "머리 없음"이 확인된 곳만 예외
  /* 두피 밖(est=3)도 대머리다 — 오히려 <b>더 확실한</b> 대머리다(실측 밀도가
     낮은 게 아니라 애초에 두피가 아니다). 이걸 안 넣으면 채움 단계가 턱 밑에
     가닥을 다시 심는다(실기기: 채움 12,661개). */
  const isBald = (ci)=> est[ci] === EST_OFFSCALP || (est[ci] === 0 && den[ci] < O.baldDen);
  const cellTarget = (ci, k)=>{
    const top = topOf.get(ci) || 0;
    if(O.uniform){
      /* 대머리로 본 셀은 <b>통째로 손 안 댄다</b>(하네스에서 잡음). 처음엔 target=top으로
         뒀는데, top은 "주력 뷰 몫"이라 겹쳐 심긴 셀에서는 현재 수보다 작다 → 대머리를
         오히려 <b>솎아냈다</b>(768→384). 안 채우는 것과 깎는 것은 다르다. */
      if(isBald(ci)) return Infinity;
      // 면적 비례 — 작은 셀(정수리)에 같은 수를 몰아주지 않는다
      return Math.max(O.minKeep, top, Math.round(uniformTarget * areaOf(ci)));
    }
    if(est[ci] !== 0) return Infinity;                   // 예전 동작: 추정 셀은 손 안 댐
    return Math.max(O.minKeep, top, Math.round(k * den[ci] * O.headroom * O.shellFill));
  };
  const dropsFor = (k)=>{
    let d = 0;
    inCell.forEach((arr, ci)=>{
      const t2 = cellTarget(ci, k);
      if(Number.isFinite(t2) && arr.length > t2) d += arr.length - t2;
    });
    return d;
  };
  const cap = Math.round(strands.length * O.maxDropFrac);
  let K = kBase, kRaised = 0;
  while(dropsFor(K) > cap && kRaised < 12){ K *= 1.25; kRaised++; }
  /* K를 아무리 올려도 목표치는 <b>topOf</b>(주력 뷰가 실제로 심은 수) 아래로 안 내려간다 —
     그게 겹침 없는 실측이기 때문이다. 그 바닥에서도 상한을 넘으면 그건 기준 문제가
     아니라 <b>진짜로 그만큼 겹쳐 있었다</b>는 뜻이라, 조용히 겹침을 남기지 않고 알린다. */
  const railHeld = dropsFor(K) <= cap;

  let dropped = 0, thinnedCells = 0, keptEstCells = 0, baldCells = 0;
  const dropView = {};
  const shortCells = [];   // 모자란 실측 셀 — ④에서 채운다
  inCell.forEach((arr, ci)=>{
    const target = cellTarget(ci, K);
    if(!Number.isFinite(target)){                        // 손 안 대는 셀
      if(O.uniform) baldCells++; else keptEstCells++;
      return;
    }
    if(arr.length < target){ shortCells.push([ci, target, arr]); return; }
    if(arr.length === target) return;
    arr.sort((p,q)=> (strands[p].rootFacing||0) - (strands[q].rootFacing||0));
    const nDrop = arr.length - target;
    for(let k=0;k<nDrop;k++){
      const si = arr[k];
      strands[si]._drop = true;
      dropView[strands[si].srcAngle] = (dropView[strands[si].srcAngle]||0) + 1;
      dropped++;
    }
    thinnedCells++;
  });

  /* ── ③.5 <b>비어 있던</b> 셀 수집 (2026-08-17 c) ─────────────────────────
     위 루프는 inCell만 돈다 = 가닥이 하나도 없는 셀은 아예 후보가 아니었다.
     여기서 격자 전체를 훑어 "머리는 있다는데 뿌리가 0인 셀"을 shortCells에 넣는다.
     순서는 <b>실측 셀로부터의 격자 거리</b> 오름차순 — 가까운 셀부터 채우고 그
     결과를 다음 셀의 원본으로 쓰면(아래 ④에서 inCell에 등록) 빈 구역이 가장자리
     에서 안쪽으로 번져 들어간다. θ는 원통이라 감고 φ는 극이라 안 감는다
     (fillUnseenRootCells의 BFS와 같은 규약). */
  let voidCells = 0, voidCapped = false;
  if(O.fill && O.fillVoid){
    const N = NT*NP;
    const dist = new Int32Array(N).fill(-1);
    let frontier = [];
    inCell.forEach((arr, ci)=>{
      if(arr.some(i=>!strands[i]._drop)){ dist[ci] = 0; frontier.push(ci); }
    });
    let d = 0;
    while(frontier.length && d < NP + NT){
      const next = [];
      for(const ci of frontier){
        const pi = (ci/NT)|0, ti = ci%NT;
        const nb = [pi*NT + ((ti+1)%NT), pi*NT + ((ti-1+NT)%NT)];
        if(pi > 0)    nb.push((pi-1)*NT + ti);
        if(pi < NP-1) nb.push((pi+1)*NT + ti);
        for(const c2 of nb) if(dist[c2] < 0){ dist[c2] = d+1; next.push(c2); }
      }
      frontier = next; d++;
    }
    const voids = [];
    for(let ci=0; ci<N; ci++){
      if(inCell.has(ci) || dist[ci] < 0) continue;   // 이미 가닥이 있거나, 격자에서 닿지 않음
      if(isBald(ci)) continue;                        // 실측이 "머리 없음" — 안 채운다
      const t2 = cellTarget(ci, K);
      if(!Number.isFinite(t2) || t2 <= 0) continue;   // 손 안 대는 셀
      voids.push([dist[ci], ci, t2]);
    }
    voids.sort((p,q)=> p[0] - q[0]);
    let budget = Math.round(strands.length * O.voidMaxFrac);
    for(const v of voids){
      if(budget <= 0){ voidCapped = true; break; }
      /* (2026-08-18) 예산은 <b>실제로 밀어 넣은 몫</b>만 깎는다. 예전엔 잘리기 전
         목표(v[2])를 뺐다 — 마지막 셀에서 예산을 이중으로 소모해, 아직 여유가
         있는데도 안전레일이 한 셀 일찍 걸렸다. */
      const give = Math.min(v[2], budget);
      shortCells.push([v[1], give, []]);
      budget -= give; voidCells++;
    }
  }

  /* ── ④ 모자란 실측 셀 채우기 (사용자: "back을 손 안댔어? 거기 머리가 적은데") ──
     그 셀(없으면 이웃 셀)의 가닥을 복제해 셀 안 다른 자리로 <b>평행이동</b>한다.
     회전이나 재생성이 아니라 평행이동인 이유: 컬·결·길이가 그대로 보존돼야
     "같은 사람의 같은 머리"로 보인다. 복제본은 세그멘테이션으로 다시 다듬어
     머리 없는 자리로 삐져나온 것은 버린다.
     ※ 이건 <b>실측이 아니라 보간</b>이다. 근본 해결은 위 TODO(360촬영). */
  let added = 0, filledCells = 0, emptyCells = 0, clipDropped = 0, toppedUpCells = 0;
  /* 보태기 전용 예산 — 빈 셀 채움과 같은 비율 상수를 쓴다(지어낸 상수 없음) */
  let topUpBudget = Math.round(strands.length * O.voidMaxFrac), topUpCapped = false;
  const addView = {};
  if(O.fill && shortCells.length){
    const ringOf = (ci)=>{                                  // 이웃 셀에서 원본 빌리기
      const pi = (ci/NT)|0, ti = ci%NT, out = [];
      for(let dp=-O.fillRing; dp<=O.fillRing; dp++){
        const p2 = pi+dp; if(p2<0||p2>=NP) continue;
        for(let dt=-O.fillRing; dt<=O.fillRing; dt++){
          if(!dp && !dt) continue;
          out.push(p2*NT + (((ti+dt)%NT)+NT)%NT);
        }
      }
      return out;
    };
    /* 이웃 셀에서 쓸 만한 원본 가닥 목록 — 원본이 0개일 때(빌림)와 모자랄 때
       (보태기)가 같은 규칙을 써야 해서 한 곳으로 뺐다. */
    const borrowFrom = (ci)=>{
      for(const nb of ringOf(ci)){
        const na = inCell.get(nb);
        if(!na) continue;
        // (#2) 이웃에서 빌릴 때 실측/추정을 안 가린다 — 균일 채움의 취지
        const usable = na.filter(i=>!strands[i]._drop && (O.uniform || est[strands[i]._cell] === 0));
        if(usable.length) return usable;
      }
      return null;
    };
    for(const [ci, target, arr] of shortCells){
      let src = arr.filter(i=>!strands[i]._drop);
      let borrowed = false;
      if(!src.length){
        emptyCells++;
        const lent = borrowFrom(ci);
        if(!lent) continue;                                 // 빌릴 데가 없다 — 지어내지 않는다
        src = lent; borrowed = true;
      }
      const own = borrowed ? 0 : src.length;
      let cap = borrowed ? target : Math.min(target, Math.round(own * O.fillMaxMul));
      /* ── 자기 원본으로는 여기까지다 — 나머지는 이웃에서 (2026-08-18) ──────
         후두부 상단처럼 원본이 1~2가닥인 띠가 fillMaxMul 상한에 걸려 목표의
         1/3에서 멈추던 것을 막는다. 상세는 HAIR_OVERLAP.fillBorrowTopUp 주석. */
      if(!borrowed && O.fillBorrowTopUp && cap < target && topUpBudget > 0){
        const lent = borrowFrom(ci);
        if(lent){
          /* 안전 레일 — 빈 셀 채움과 <b>같은 비율</b>(voidMaxFrac)을 쓴다. 새 상수를
             만들지 않는다. 여기에 걸린다는 건 성근 셀이 모델 전체에 퍼져 있다는
             뜻이고, 그건 이 단계가 아니라 리프트·뷰 품질에서 볼 문제다. */
          const room = Math.min(target, own + topUpBudget);
          if(room > cap){
            topUpBudget -= (room - cap);
            src = src.concat(lent); cap = room; toppedUpCells++;
            if(cap < target) topUpCapped = true;
          }
        }
      }
      const want = cap - own;
      let made = 0;
      const newIdx = [];
      for(let k=0; k<want; k++){
        const s0 = strands[src[k % src.length]];
        const j = O.fillJitter;
        const tp = headSurfaceCellPoint(ci, 0.5 + (rnd()-0.5)*j, 0.5 + (rnd()-0.5)*j,
                                        hullW, hullD, bucketOfY, CY, b, NT, NP);
        const sp = headSurfaceCellPoint(s0._cell, 0.5, 0.5, hullW, hullD, bucketOfY, CY, b, NT, NP);
        const dx = tp.x - sp.x, dy = tp.y - sp.y, dz = tp.z - sp.z;
        let pts = s0.pts.map(p=>({ x:p.x+dx, y:p.y+dy, z:p.z+dz }));
        if(occProbe){
          const t2 = trimStrandToOccupancy3D(pts, occProbe, null);
          if(!t2 || t2.length < 2){ clipDropped++; continue; }  // 머리 없는 자리 — 버린다
          pts = t2;
        }
        strands.push({ pts, cols:s0.cols, sec:s0.sec, color:s0.color,
                       srcAngle:s0.srcAngle, mirrored:s0.mirrored,
                       rootFacing:s0.rootFacing, _cell:ci, _cloned:true });
        newIdx.push(strands.length - 1);
        addView[s0.srcAngle] = (addView[s0.srcAngle]||0) + 1;
        added++; made++;
      }
      /* (2026-08-17 c) 방금 채운 셀을 <b>원본으로 등록</b>한다. 빈 구역 한가운데
         셀은 이웃도 비어 있어서, 이게 없으면 가장자리 한 겹만 채우고 만다. */
      if(newIdx.length) inCell.set(ci, (inCell.get(ci) || []).concat(newIdx));
      if(made) filledCells++;
    }
  }

  const fmt = o => Object.keys(o).map(v=>v+':'+o[v]).join(' ') || '없음';
  const before = strands.length - added, after = strands.filter(s=>!s._drop).length;
  console.log('[3D·겹침] 뿌리 밀도 정리 — 솎음 ' + dropped + '개(' + fmt(dropView) + ')'
    + ' · 채움 ' + added + '개(' + fmt(addView) + ')'
    + (clipDropped ? ' · 복제 중 세그멘테이션 밖이라 버림 ' + clipDropped + '개' : '')
    + ' → 가닥 ' + before + ' → <b>' + after + '</b>개 (' + (after >= before ? '+' : '')
    + Math.round((after/before - 1)*100) + '%)'
    + ' | 과밀 셀 ' + thinnedCells + ' · 채운 셀 ' + filledCells
    + '(그중 원본 없어 이웃에서 빌림 ' + emptyCells
    + (toppedUpCells ? ' · <b>원본이 모자라 이웃에서 보탬 ' + toppedUpCells + '개</b>'
        + (topUpCapped ? ' ⚠ 안전레일(' + Math.round(O.voidMaxFrac*100) + '%) 도달 — '
            + '성근 셀이 한 띠가 아니라 모델 전체에 퍼져 있다는 뜻입니다' : '') : '') + ')'
    + (voidCells ? ' · <b>아예 비어 있던 셀 ' + voidCells + '개</b>를 새로 채움'
        + (voidCapped ? ' ⚠ 안전레일(' + Math.round(O.voidMaxFrac*100) + '%)에 걸려 중단 — '
            + '구멍이 아니라 모델이 통째로 비었다는 뜻이니 리프트·포즈를 보세요' : '') : '')
    + (O.uniform
        ? ' · <b>목표 ' + uniformTarget.toFixed(1) + '가닥/면적1셀</b>'
          + (O.areaWeighted ? '(<b>면적 비례</b> — 정수리 셀은 1/20이라 그만큼 적게)' : '(셀당 균등)')
          + ' · 밀도 손잡이 ×' + O.densityMul + ' · 대머리로 보고 안 채운 셀 ' + baldCells + '개'
        : ' · 추정 셀 ' + keptEstCells + '개는 그대로'));
  /* 기준 한 줄 — 다음에 "성글다/빽빽하다"가 오면 이 세 숫자만 보면 된다:
       자연 = 지금 모델이 실제로 갖고 있는 셀당 밀도
       목표 = 우리가 겨눈 셀당 밀도(껍질 몫 포함)
     목표가 자연보다 한참 낮으면 과하게 솎는 중, 한참 높으면 복제로 부풀리는 중. */
  /* (2026-08-18) 대머리 셀은 cellTarget이 <b>Infinity</b>(손 안 댐)를 돌려주므로
     합계에 넣으면 "목표 Infinity가닥"이 찍힌다(실기기 로그에서 잡힘). 유한한
     목표만 평균낸다 — 그래야 "자연 15.2 → 목표 18.8"처럼 비교가 성립한다. */
  let cellsWithHair = 0, sumT = 0;
  inCell.forEach((arr, ci)=>{
    if(est[ci] !== 0) return;
    const t2 = cellTarget(ci, K);
    if(!Number.isFinite(t2)) return;
    cellsWithHair++; sumT += t2;
  });
  console.log('[3D·겹침·기준] K=' + K.toFixed(1) + '가닥/밀도1'
    + ' (실측 셀 ' + ratios.length + '개의 ' + Math.round(O.calibPct*100) + '백분위'
    + (kRaised ? ', 안전레일로 ' + kRaised + '단계 상향 — 기준이 낮았다는 뜻' : '') + ')'
    + (railHeld ? '' : ' ⚠ 상향해도 상한(' + Math.round(O.maxDropFrac*100) + '%) 초과 —'
        + ' 목표가 이미 "주력 뷰 몫"까지 내려간 상태라 이건 기준 문제가 아니라 실제 겹침입니다')
    + ' · 껍질 몫 ×' + O.shellFill + '(헐 분리로 모발이 두께를 가짐)'
    + ' | 셀당 자연 ' + (before / Math.max(1, cellsWithHair)).toFixed(1)
    + ' → 목표 ' + (sumT / Math.max(1, cellsWithHair)).toFixed(1) + '가닥'
    + ' | 뷰별 마스크 대비 예산이 안 맞으면 여기가 뷰마다 흔들린다(360촬영 TODO)');
  /* ── [진단] 뿌리 격자를 <b>극각 × 방위</b>로 펼친다 (2026-08-18 b) ─────────────
     1차(같은 날 오전)는 "목표의 절반도 못 채운 셀"만 셌는데, 거기에 <b>구멍</b>이
     하나 있었다 — `if(isBald(ci)) continue`. 대머리로 <b>판정된</b> 셀은 아예
     후보에서 빠지므로, "그 자리를 대머리로 잘못 봐서 안 채웠다"는 실패 모드가
     이 진단에는 원리상 안 잡힌다. 실기기에서 후두부 상단이 계속 비는데 이 진단은
     조용했던 이유가 그것일 수 있다(대머리로 안 채운 셀이 402개였다).
     그래서 <b>제외한 것까지 전부</b> 찍는다. 그리고 방위(정면/옆/후면)로 나눈다 —
     "후두부 상단"은 극각만으로는 안 짚이고 극각×방위 한 칸이라야 짚인다.
     방위 경계는 SECTION_CUT 그대로(지어낸 값 없음). */
  {
    const EE = crownBandEdges(), NBB = EE.length - 1;
    const C2 = SECTION_CUT;
    const key = (k, s)=> k*3 + s;
    const nCell = new Int32Array(NBB*3), nOff = new Int32Array(NBB*3);
    const nBald = new Int32Array(NBB*3), nShort = new Int32Array(NBB*3);
    const have = new Float64Array(NBB*3), want = new Float64Array(NBB*3);
    for(let ci=0; ci<NT*NP; ci++){
      const pi = (ci / NT) | 0, ti = ci % NT;
      const phi = (pi + 0.5) / NP * Math.PI;
      const th  = Math.abs((ti + 0.5) / NT * 2*Math.PI - Math.PI);
      let k = 0; while(k < NBB-1 && phi >= EE[k+1]) k++;
      const s = th <= C2.thFront ? 0 : (th <= C2.thSide ? 1 : 2);
      const j = key(k, s);
      nCell[j]++;
      if(est[ci] === EST_OFFSCALP){ nOff[j]++; continue; }   // 해부학상 두피 아님 — 정상
      if(isBald(ci)){ nBald[j]++; continue; }                // "머리 없음"으로 <b>판정</b>됨
      const t2 = cellTarget(ci, K);
      if(!Number.isFinite(t2) || t2 <= 0) continue;
      const arr2 = inCell.get(ci);
      const n2 = arr2 ? arr2.filter(i=>!strands[i]._drop).length : 0;
      have[j] += n2; want[j] += t2;
      if(n2 < t2 * 0.5) nShort[j]++;
    }
    const cell = (k, s)=>{
      const j = key(k, s);
      if(!nCell[j]) return '     —    ';
      const fill = want[j] > 0 ? Math.round(100*have[j]/want[j]) : -1;
      /* 0인 항목은 아예 안 적는다 — 자리를 비워 두면 눈이 그 여백을 읽느라
         정작 봐야 할 <b>대머리</b> 숫자를 놓친다(라벨을 한 글자로 줄였던 것과 같은 실수). */
      const p = [];
      if(nOff[j])  p.push('두피밖 ' + nOff[j]);
      if(nBald[j]) p.push('<b>대머리 ' + nBald[j] + '</b>');
      if(fill >= 0) p.push('채움 ' + fill + '%');
      p.push('(' + nCell[j] + '셀)');
      return p.join(' ');
    };
    const rows = [];
    for(let k=0;k<NBB;k++){
      rows.push('phi ' + EE[k].toFixed(2) + '~' + EE[k+1].toFixed(2)
        + ' |정면 ' + cell(k,0) + ' |옆 ' + cell(k,1) + ' |<b>후면 ' + cell(k,2) + '</b>');
    }
    console.log('[3D·겹침·뿌리 격자] 두피 셀을 극각×방위로 — 숫자는 <b>셀 개수</b>입니다'
      + '\n  두피밖 = 해부학상 두피가 아닌 자리(정상, 원래 뿌리를 안 심음)'
      + '\n  <b>대머리</b> = 밀도 실측이 "여긴 머리가 없다"고 <b>판정한</b> 셀 (채움에서 제외됨)'
      + '\n  채움% = 나머지 셀이 목표 대비 얼마나 찼나\n  '
      + rows.join('\n  ')
      + '\n  후두부 상단 = phi 0.60~1.05의 <b>후면</b> 칸입니다. 읽는 법:'
      + '\n   · 그 칸이 <b>대머리</b>로 차 있으면 → 밀도 실측이 그 자리를 잘못 읽은 것'
      + ' (HAIR_OVERLAP.baldDen · [모발프로필·통합]의 평균밀도를 봅니다).'
      + '\n   · <b>대머리</b>가 0인데 채움%가 100 근처면 → 뿌리는 목표만큼 있다.'
      + ' 그런데도 화면이 비면 뿌리가 아니라 <b>가닥이 그 위를 안 지나는</b> 것이고,'
      + ' 그건 길이·결·중력 쪽입니다([3D·최종 커버리지]와 같이 봅니다).'
      + '\n   · %가 낮으면 → 채움이 모자란 것(안전레일·fillMaxMul).');
  }

  return { dropped, added, thinnedCells, filledCells, emptyCells, clipDropped, voidCells, voidCapped,
           keptEstCells, K, kBase, kRaised, cellsWithHair, cleanCells:ratios.length, toppedUpCells };
}

/* 못 본 자리 채우기 — 사용자: "안 보이는데 머리가 빽빽한 자리는 근처 밀도로
   추정해서 넣어야지?" 맞다. 덮인 두피는 원리상 못 보는데, 그 자리 대부분은
   <b>덮여 있으니까 못 보는 것</b>(=머리가 있는 것)이다. 못 잰 셀을 0으로 두면
   두상 안쪽이 통째로 대머리가 된다.
   격자 위 BFS로 실측 셀에서 바깥으로 번져나가며 이웃 평균을 넣는다(θ는 원통이라
   감고, φ는 극이라 안 감는다). 채운 셀은 est=1로 <b>표시해 둔다</b> — 실측과
   추정이 섞이면 나중에 "정수리 숱 없음"을 지어내고도 알아채지 못한다. */
function fillUnseenRootCells(f){
  const NT = f.NT, NP = f.NP, den = f.den, est = f.est;
  const N = NT*NP;
  let frontier = [];
  /* 두피 밖 셀(est=3)은 <b>씨앗으로도 안 쓴다</b>. den이 0이라 채움 대상에서는
     이미 빠지지만, 씨앗으로 두면 밀도 0이 이웃 정수리로 번져 멀쩡한 두피를
     대머리로 만든다. "모르는 곳을 채운다"와 "없는 곳을 퍼뜨린다"는 다르다. */
  for(let ci=0; ci<N; ci++) if(den[ci] >= 0 && est[ci] !== EST_OFFSCALP) frontier.push(ci);
  if(!frontier.length || frontier.length === N) return;
  let guard = 0;
  while(frontier.length && guard++ < NP + NT){
    const next = [], sum = new Float64Array(N), cnt = new Float64Array(N);
    for(const ci of frontier){
      const pi = (ci / NT) | 0, ti = ci % NT;
      const nb = [
        pi > 0    ? (pi-1)*NT + ti : -1,
        pi < NP-1 ? (pi+1)*NT + ti : -1,
        pi*NT + ((ti + 1) % NT),
        pi*NT + ((ti - 1 + NT) % NT),
      ];
      for(const nj of nb){
        if(nj < 0 || den[nj] >= 0) continue;
        if(!cnt[nj]) next.push(nj);
        sum[nj] += den[ci]; cnt[nj]++;
      }
    }
    for(const nj of next){ den[nj] = sum[nj] / cnt[nj]; est[nj] = 1; }
    frontier = next;
  }
  // 그래도 남은 자리(어느 실측과도 안 이어짐)는 전체 평균으로. 0은 안 쓴다.
  let s = 0, n = 0;
  for(let ci=0; ci<N; ci++) if(den[ci] >= 0){ s += den[ci]; n++; }
  const mean = n ? s/n : 1;
  for(let ci=0; ci<N; ci++) if(den[ci] < 0){ den[ci] = mean; est[ci] = 2; }
}

/* 뷰별 실측을 하나의 <b>뷰 독립 자산</b>으로 합친다.
   색·질감은 뷰 신뢰도(getViewPoseConfidence)로 가중 평균, 뿌리는 위 격자.
   마네킹 모드는 이것만 있으면 된다 — 사진도 형태도 필요 없다. */
function buildHairIdentity(rootField, field3D){
  const views = ANGLES.filter(a => state.hairMasks && state.hairMasks[a] && state.hairMasks[a].identity);
  if(!views.length) return null;
  const palette = [], bySection = {};
  let pW=0, pS=0, cW=0, cS=0, gW=0, gS=0, scalpR=0, scalpG=0, scalpB=0, scalpN=0;
  const secSum = {};
  views.forEach(a=>{
    const mi = state.hairMasks[a], id = mi.identity;
    let conf = 1; try{ conf = getViewPoseConfidence(a) || 0.5; }catch(e){ conf = 0.5; }
    if(mi.colorPalette) for(const c of mi.colorPalette) palette.push(c);
    if(id.pitchPx != null && id.pitchN > 20){ pS += id.pitchPx * conf; pW += conf; }
    if(id.curlDegPerPx != null && id.curlN > 20){ cS += id.curlDegPerPx * conf; cW += conf; }
    if(id.glossHiLo != null){ gS += id.glossHiLo * conf; gW += conf; }
    const sc = parseRGBTriple(mi.scalpColor);
    if(sc){ scalpR += sc.r; scalpG += sc.g; scalpB += sc.b; scalpN++; }
    if(mi.avgColorsBySection) for(const id2 in mi.avgColorsBySection){
      const c = parseRGBTriple(mi.avgColorsBySection[id2]); if(!c) continue;
      const t = secSum[id2] || (secSum[id2] = {r:0,g:0,b:0,w:0});
      t.r += c.r*conf; t.g += c.g*conf; t.b += c.b*conf; t.w += conf;
    }
  });
  for(const id2 in secSum){ const t = secSum[id2];
    bySection[id2] = `rgb(${Math.round(t.r/t.w)},${Math.round(t.g/t.w)},${Math.round(t.b/t.w)})`; }
  /* 피치 px → cm. 자는 <b>귀 간격</b>을 쓴다 — 랜드마크가 정규화 x로 직접 주는
     값이고 FACE_RULER_CM.earHalf(7cm)가 그 절반이라, 두상 타원체를 거치지 않고
     한 번에 환산된다. 지금 로그가 "가로·세로가 다른 자를 씀"이라고 경고하는
     상황이라 자를 하나만, 그것도 제일 짧은 경로로 쓰는 편이 안전하다. */
  const pitchPx = pW ? pS/pW : null;
  let pitchCm = null, pitchRuler = null;
  for(const a of (pitchPx ? views : [])){
    const lm = state.landmarks && state.landmarks[a];
    const mi = state.hairMasks[a];
    if(!lm || lm.lEarX == null || lm.rEarX == null) continue;
    const spanNx = Math.abs(lm.rEarX - lm.lEarX);
    if(!(spanNx > 0.02)) continue;                       // 측면 뷰는 귀가 겹쳐 못 씀
    // pitchPx는 분석 해상도(identity.w) 기준 — 같은 좌표계인 정규화 폭으로 환산
    const pitchNx = pitchPx / mi.identity.w;
    pitchCm = pitchNx / spanNx * (FACE_RULER_CM.earHalf * 2);
    pitchRuler = a;
    break;
  }
  const out = {
    views,
    color: {
      palette, bySection,
      scalpColor: scalpN ? `rgb(${Math.round(scalpR/scalpN)},${Math.round(scalpG/scalpN)},${Math.round(scalpB/scalpN)})` : null,
      glossHiLo: gW ? gS/gW : null,
    },
    texture: {
      pitchPx, pitchCm,
      curlDegPerPx: cW ? cS/cW : null,
      // 결 필드는 <b>인자로</b> 받는다 — state.hairField3D는 이 시점에 아직 이번
      // 리프트 값이 아니라 지난 값이다(대입이 아래에서 일어난다).
      field3D: field3D || null,
    },
    roots: {
      cells: rootField || null,
      hairline: views.reduce((o,a)=>{ const id = state.hairMasks[a].identity;
        o[a] = { top:id.hairlineTop, bot:id.hairlineBot, w:id.w, h:id.h }; return o; }, {}),
    },
  };
  const rf = rootField;
  console.log('[모발프로필·통합] 뷰 ' + views.join(',')
    + ' · 팔레트 ' + palette.length + '색'
    + ' · 가닥피치 ' + (pitchPx != null ? pitchPx.toFixed(1)+'px' : '없음')
    + (pitchCm != null ? '(≈'+pitchCm.toFixed(2)+'cm · '+pitchRuler+' 귀 자)' : '')
    + ' · 곱슬 ' + (out.texture.curlDegPerPx != null ? out.texture.curlDegPerPx.toFixed(2)+'°/px' : '없음')
    + ' · 광택 ' + (out.color.glossHiLo != null ? out.color.glossHiLo.toFixed(2) : '없음')
    + (rf ? (' · 뿌리셀 ' + rf.measured + '/' + rf.cells + ' 실측(나머지 이웃추정)'
             + ' · 평균밀도 ' + (rf.den.reduce((s,v)=>s+v,0)/rf.cells).toFixed(2)) : ' · 뿌리격자 없음'));
  return out;
}

/* ── 두피 돔 꼭대기 <b>위쪽</b> 모발 (2026-08-08) ─────────────────────────
   사용자: "저 위에 머리 삐쳐나온 거 있잖아.. 저게 후두부 정수리 부분에 있는
   머리를 저렇게 띄운 거 같은 느낌이 드네."
   확인해보니 모델에 <b>그 자리가 아예 없었다</b>. mapY는 각 뷰의 두피선 최고점
   (crownY)을 모델 yTop = CY+b(두피 돔 꼭대기)에 맞춘다. 그런데 마스크에는 그
   두피선보다 <b>위</b>에 모발이 있다 — 정수리를 덮은 모발 두께 그 자체다.
   그 점들은
     · 높이 버킷 범위가 [yBot, yTop]이라 전부 버킷 0으로 클램프되고
     · 두피 반폭 headHalf(y)는 y > CY+b에서 0이라 옆으로 감는 분기도 못 타고
     · 결국 `mz = lastZ`(마지막 깊이 유지)로 떨어져 <b>깊이가 고정된 납작한
       수직 삐침</b>이 된다.
   화면에서 정수리 위로 삐쳐 나온 그 가닥이 이것이다. 특정 뷰의 문제가 아니라
   네 뷰 모두에서 같은 일이 일어난다(아래 [진단·정수리캡] 로그로 뷰별 수치).
   고침 세 줄:
     ① 세로 범위를 모발 최상단까지 넓힌다(캡)
     ② 헐 관측을 두피선이 아니라 <b>모발 상단</b>부터 잰다
     ③ 옆감기 분기 게이트를 캡 구간에서는 두피 반폭 대신 <b>헐 반폭</b>으로
   지어낸 상수 없음 — 마스크에서 이미 재던 값을 원래 있어야 할 범위까지 재는
   것뿐이다. 캡 구간의 가로 단면은 두피가 아니라 <b>모발만</b> 자르므로
   안쪽 경계 0 ~ 헐까지 꽉 찬 원반이 맞다(층 t가 그대로 그렇게 배치된다). */
/* ── 뷰 캘리브레이션 앵커 (2026-08-09) ───────────────────────────────────
   사용자: "좌측·우측 사진에서 보면 뚜렷하고, 사실 정면도 그런데 헤어 렌더링
   위치가 틀어져 있어."
   원인은 buildHairStrandsFromPaths의 뷰 앵커였다. image→model 매핑
   mx = (px - cx)·s 의 cx·s를 <b>헤어 마스크의 좌우 끝</b>에서 뽑고 있었다.
   머리카락은 두상이 아니다 — 뒤로 흐르고 어깨로 퍼지므로 그 한가운데는
   정중시상면이 아니고, 그 폭은 두상 폭이 아니다. 옆모습일수록 크게 어긋난다.
   아래 값들은 전부 "끄면 예전 동작"이 되게 두었다. */
const VIEWCAL_ANCHOR = {
  on:        true,   // false = 예전(헤어 실루엣 bbox) 동작으로 완전 복귀
  isoScale:  true,   // 가로 자를 세로 자와 일치(정사영에서 두 배율은 같다)
  pitchFix:  true,   // 눈→턱이 pitch로 압축된 만큼 세로 자 보정
  /* 귀가 두상 중심보다 얼마나 뒤인가 — 깊이 반지름 c 대비. 해부학적으로 외이도는
     두개골 앞뒤 중앙보다 약간 뒤(≈10%). yaw가 클 때만 의미 있는 작은 항이다
     (yaw 51°·이 손님 기준 ≈8px). 0으로 두면 "귀 한가운데 = 두상 중심". */
  earDepth:  0.10,
};
const HAIR_TOP_CAP = {
  on: true,
  pct: 0.02,      // 상단 백분위 — 먼지·삐침 픽셀 한둘로 범위가 튀지 않게
  maxRise: 0.60,  // yTop 위로 허용하는 최대 상승(b 단위). 넘으면 클램프 + 경고
  warnRise: 0.35, // 이보다 크면 crownY/마스크 상단을 의심하라는 경고
};
/* ── 헐은 실루엣을 <b>감싸야</b> 한다 (2026-08-18 e) ────────────────────────────
   사용자: "원본 결 보기에서의 두상과 3D를 갔다온 두상이 차이가 있어. 갔다온
   두상이 너무 좁아져. … 미니3D 이후 적용 모두. 좁아지는 건 <b>둘레</b>가 좁아진다."
   2D 원본 결 보기는 사진 픽셀 자리에 그대로 그리므로 둘레가 곧 사진이다. 3D를
   거친 화면(2D 투영·결과보기·최종 3D·미니 3D)은 전부 <b>이 헐 단면</b>이 그릇이라,
   헐이 사진보다 작으면 네 화면이 <b>같이</b> 좁아진다 — 증상이 3D 이후 전부에서
   난다는 것 자체가 원인이 공통 그릇에 있다는 신호다.
   그 그릇이 작아지는 자리가 둘이었다:
     ① 관측 반폭을 실루엣 <b>제 한가운데</b> 기준으로 쟀다(축은 귀 앵커인데).
     ② 관측들을 <b>평균</b>냈다 — 제일 넓게 찍힌 뷰가 자기 관측보다 좁은 그릇을 받는다.
   모자란 만큼 리프트의 u>1 분기가 가닥 x를 안쪽으로 접어 넣는다(그 분기는 원래
   "진짜로 헐 밖인 가닥"을 위한 폴백이지 상시 경로가 아니다).
   ⚠ 이건 <b>헐</b>(머리카락 겉면)에만 해당한다. 두피면·두개골은 얼굴 실측에
     앵커돼 있고(getScalpEllipsoid) 여기서 한 글자도 안 건드린다 — 헐이 커지면
     그만큼 모발 두께로 잡히는 것이 맞다.
   되돌리기: on=false → 예전 동작(반스팬 + 평균)으로 정확히 복귀. */
const HAIR_HULL_FIT = {
  on: true,
  axisE: true,           // 관측 반폭을 모델 축(cx) 기준 최대거리로 — ①
  enclose: true,         // 적합을 평균이 아니라 감싸기(최댓값)로 — ②
  keepAfterSmooth: true, // 이동평균이 깎은 봉우리를 관측 요구치로 되살림
  log: true,             // [3D·헐 둘레] 진단(예전 방식과 배율 비교)
};
/* 컬럼별 모발 최상단 y(원본 해상도). reasonMask(1 = 최종 머리카락)에서 잰다. */
function hairTopYOf(maskInf){
  if(!maskInf) return null;
  if(maskInf._hairTopY) return maskInf._hairTopY;
  const rm = maskInf.reasonMask, mw = maskInf.maskW, mh = maskInf.maskH;
  if(!rm || !mw || !mh || !maskInf.w) return null;
  const small = new Float32Array(mw).fill(-1);
  for(let x=0; x<mw; x++){
    for(let y=0; y<mh; y++){ if(rm[y*mw+x] === 1){ small[x] = y; break; } }
  }
  const out = new Float32Array(maskInf.w).fill(-1);
  const kx = mw / maskInf.w, ky = maskInf.h / mh;
  for(let X=0; X<maskInf.w; X++){
    const xs = Math.min(mw-1, Math.max(0, Math.round(X * kx)));
    if(small[xs] >= 0) out[X] = small[xs] * ky;
  }
  maskInf._hairTopY = out;
  return out;
}

function buildHairStrandsFromPaths(){
  if(!state.strandPaths) return null;
  const headEll = getHeadEllipsoid();
  const a  = headEll.a;   // 두상 가로 반지름(폭)
  const b  = headEll.b;   // 두상 세로 반지름
  const cD = headEll.c;   // 두상 앞뒤 반지름(깊이)
  const CY = 0.15;                                   // 두상 중심 y (두상 메쉬와 동일)
  // (2026-07-17 통합) 고정 yaw(front:0/left:-90/right:90/back:180) 가정 제거 —
  // 실측 포즈 축(랜드마크 PnP)으로 통일. 사용자 설계: 랜드마크는 4장 연결의
  // 기준점이고, 실제 촬영은 90°가 아니라 경사(예: 24°)로 이루어짐(90°에선
  // MediaPipe 랜드마크 인식 자체가 실패). 얼굴/두상(projectImagePointToHead
  // 계열)은 이미 실측 포즈를 쓰는데 이 함수만 90°를 가정해 좌표 철학이 둘로
  // 갈라져 있었음 — 여기가 그 통합 지점.
  const poseOf = angle => ({
    yaw:   getViewYawDeg(angle)   * Math.PI/180,  // 실측→근사→셔터시점 라이브→고정 폴백 체인
    pitch: getViewPitchDeg(angle) * Math.PI/180,
    roll:  getViewRollDeg(angle)  * Math.PI/180,
  });
  /* 두피면의 높이별 반폭/반깊이 — 헐의 <b>안쪽 경계</b>이자 결측 폴백.
     (2026-08-01) 여기가 헤어 실루엣이면 헐과 같아져서 모발 두께가 0이 된다.
     두피면 타원(getScalpEllipsoid)으로 바꿔서 hull−scalp가 실제 두께가 되게 한다.
     세로 반경도 scalp.b를 써야 한다 — b를 그대로 두면 정수리에서만 두께가 0으로
     남아 "정수리 대머리"가 그대로 간다. */
  const scalpEll = getScalpEllipsoid();
  const sA = scalpEll.a, sB = scalpEll.b, sC = scalpEll.c;
  const headHalf = (y, axis) => {
    const yl = (y - CY) / sB, q = 1 - yl*yl;
    return q <= 0 ? 0 : (axis === 'w' ? sA : sC) * Math.sqrt(q);
  };

  // ── 뷰별 2D→모델 매핑 파라미터 (앵커는 v2와 동일, 스케일만 실측 yaw 반영) ──
  // 세로 앵커용 얼굴 종횡 계수(얼굴 메쉬와 동일 출처) — 실패 시 1로 폴백
  let fmW = 1, fmH = 1;
  try{ const fm = getFaceMetrics(); if(fm){ fmW = fm.widthFactor || 1; fmH = fm.heightFactor || 1; } }catch(e){}
  const views = {};
  ['front','left','right','back'].forEach(angle=>{
    const rec = state.strandPaths[angle];
    const maskInf = state.hairMasks && state.hairMasks[angle];
    if(!rec || !rec.strands || !rec.strands.length || !maskInf || !maskInf.scalpY) return;
    /* ── 슬롯-사진 불일치 뷰 배제 (2026-07-27) ────────────────────────
       실기기: 후면 슬롯에 얼굴 사진이 들어갔다(로그 `[back] ... (yaw -4°)`).
       뒷머리를 찍으면 얼굴 감지가 <b>실패</b>하는 게 정상인데 −4°로 잡혔다.
       그러면 그 뷰의 가닥이 occipital·nape 라벨을 단 채 <b>머리 앞쪽</b>에 얹힌다.
       실제 증상 세 가지가 전부 여기서 나왔다:
         · 정면에 네이프가 섞여 보임
         · 3D 미리보기에서 네이프가 앞으로 넘어옴
         · 3D 얼굴에 잡티 — 앞으로 넘어온 가닥이 얼굴 위에 찍힌 것
       ※ 처음엔 이런 뷰를 3D 복원에서 <b>배제</b>했는데 되돌렸다.
         사용자: "아냐아냐 막지마. 내가 또 밖에서 작업하고 있어서 그런거야."
         맞는 판단이다 — 밖에서 찍으면 후면이 어긋나는 일이 흔한데 그때마다
         뷰가 통째로 빠지면 결과가 더 나빠진다. 경고만 또렷이 남기고 쓴다. */
    warnViewSlotMismatch(angle);
    let xMin = Infinity, xMax = -Infinity, crownY = Infinity, validCols = 0;
    for(let x=0; x<maskInf.w; x++){
      const sy = maskInf.scalpY[x];
      if(sy >= 0){
        validCols++;
        if(x < xMin) xMin = x;
        if(x > xMax) xMax = x;
        if(sy < crownY) crownY = sy;
      }
    }
    if(!(xMax > xMin) || !isFinite(crownY)) return;
    const halfPx = (xMax - xMin) / 2;
    if(halfPx < 4) return;
    // (2026-07-17) 뷰 품질 게이트 — 실기기 피드백: "후면은 사진이 제대로 된
    // 게 없었고, 폴백이 작동 안 했네." 원인: captureStrandPathsFor는 사진이
    // 존재하기만 하면(유효 컬럼 5% 이상) 캡처를 만들어 strandPaths[angle]을
    // 채우는데, 그 캡처가 불량이어도 이 함수의 거울 폴백은 "뷰가 있다"고
    // 보고 양보해버림 → 불량 캡처가 자리만 차지하고 뒤통수가 비는 결과.
    // 게이트: 가닥 12개 미만 또는 유효 컬럼이 마스크 폭의 8% 미만이면 실측
    // 부적격으로 제외 — 헐 관측에도 안 들어가고, 자리가 비므로 아래 거울
    // 채움이 대신 들어옴. (12/8%는 실측이 아니라 "이보다 아래면 실루엣
    // 실측이라 부를 수 없다" 수준의 최소 게이트 상수 — 실기기에서 정상
    // 촬영이 걸러지면 낮출 것.)
    if(rec.strands.length < 12 || validCols < maskInf.w * 0.08){
      console.log('[3D] 뷰 품질 게이트: ' + angle + ' 실측 부적격(가닥 ' + rec.strands.length +
        '개, 유효 컬럼 ' + validCols + '/' + maskInf.w + ') — 거울 채움으로 대체');
      return;
    }
    const pose = poseOf(angle);
    const cos2 = Math.cos(pose.yaw)**2, sin2 = Math.sin(pose.yaw)**2;
    // 이 뷰 카메라에서 본 두상 투영 반폭: 타원(a,cD)을 방위각 θ에서 보면
    // E = sqrt(a²cos²θ + cD²sin²θ) — 예전 SIDE?cD:a 이분법의 연속 일반화
    // (θ=0이면 a, θ=90°면 cD로 기존과 동일하게 환원됨).
    const aH_head = Math.sqrt(a*a*cos2 + cD*cD*sin2);
    // (2026-07-17, 2차 수정) 세로 매핑 = 크라운 오프셋 + 눈/턱 실측 배율.
    // 1차 시도(눈/턱 프로젝터로 오프셋+배율 둘 다)는 실기기에서 뿌리선이
    // 목 높이 링으로 흘러내림 — 사용자: "눈기준이어서 그런거야. 출발점이
    // 저기가 되면 안되지." 정확한 지적: 머리카락의 출발점은 물리적으로
    // 두피이므로 오프셋을 눈 캘리브레이션에 맡기면 안 됨(촬영각 큰 뷰에서
    // 눈/턱 세로 간격이 원근·pitch로 압축되면 오프셋까지 통째로 틀어짐).
    // 분리: ① 오프셋 = 크라운 픽셀 → 두피 돔 꼭대기(원래 방식 — 뿌리가
    // 항상 두피에서 출발) ② 배율 = 눈/턱 프로젝터의 bY(모델단위/정규화y)
    // — 지난 턴의 "뿌리가 눈높이까지 과신장" 원인이었던 두상 폭 유래
    // 스케일(v.s)과 분리 유지. 배율도 pitch가 크면 과대해질 수 있는 한계는
    // 남지만(눈/턱 간격 압축) 오프셋이 두피에 고정되어 출발점은 불변.
    // 랜드마크 없는 뷰(후면 등)는 기존 v.s 폴백.
    /* ⚠ 이 폴백은 <b>가로에서 세로를 만든다</b>(두상 반폭 ÷ 실루엣 반폭).
       사용자 지시(2026-08-11): "세로자로 통일". 아래 lmV 분기가 눈/턱으로
       세로자를 제대로 잡으면 이 값은 덮어써지므로, 여기는 그 분기가 실패했을
       때만 남는 자리다. 그때도 <b>가로자를 쓴다</b>고 로그로 알린다 —
       조용히 가로자로 세로를 재는 게 이 파일이 겪어온 그 함정이다. */
    let sy = aH_head/halfPx, syFrom = '<b>가로 유래(폴백)</b>';
    /* 랜드마크는 <b>얼굴 실측 우선, 없으면 실루엣 앵커</b>. 후면처럼 얼굴이
       안 잡히는 뷰도 computeSilhouetteAnchors가 정면 비율을 옮겨 귀/눈/턱을
       만들어 준다(로그 [앵커·실루엣맞춤]). 예전엔 여기서 그걸 안 써서
       후면만 통째로 헤어 실루엣 자를 썼다. */
    const lmV = (state.landmarks && state.landmarks[angle])
              || (VIEWCAL_ANCHOR.on ? computeSilhouetteAnchors(angle) : null);
    if(lmV && typeof lmV.eyeY === 'number' && typeof lmV.chinY === 'number'){
      const proj = makeFaceProjector(lmV, fmW, fmH);
      if(isFinite(proj.bY) && proj.bY > 0.2 && proj.bY < 15){ // 랜드마크 붕괴(눈≈턱) 가드
        sy = proj.bY / maskInf.h; syFrom = '눈→턱(세로자)'; // 정규화 배율 → 픽셀 배율
        /* 눈→턱은 pitch만큼 <b>짧게 찍힌다</b>(정사영 cosθ). 그 짧아진 픽셀로
           나눈 배율은 그만큼 부푼다 — 되돌린다. yaw는 세로를 안 줄이므로 무관. */
        if(VIEWCAL_ANCHOR.pitchFix){
          const cp = Math.cos(pose.pitch);
          if(cp > 0.5) sy *= cp;
        }
      }
    }
    /* ── 가로 앵커·자 — 머리카락이 아니라 <b>두상</b>에 건다 (2026-08-09) ────
       예전: cx = 헤어 마스크 컬럼의 한가운데, s = 두상 반폭 ÷ 헤어 마스크 반폭.
       둘 다 <b>머리카락 실루엣</b>이 기준이라, 긴 머리가 뒤로 흐르거나 어깨로
       퍼진 뷰에서 중심이 밀리고 자가 늘어난다. 같은 로그가 이미 두 번 말하고
       있었다 — "[두상 폭 보정] 실루엣 폭 0.704 → 0.578(어깨로 흐른 머리카락을
       두상 폭으로 잡고 있었습니다)" 와 "[자 일치] 가로 13.94cm/단위 vs 세로
       19.33cm/단위 → 어긋남 0.721배(⚠ 가로·세로가 다른 자를 씀)".
       0.704 × 0.721 = 0.508 ≈ 얼굴 메쉬 반폭 0.503 — 폭 부풀림의 정체가
       <b>자 어긋남 그 자체</b>였다는 뜻이다.
       지금:
         · 자(s) — 정사영에서 가로·세로 배율은 <b>같다</b>. 세로 자(sy)를 그대로 쓴다.
                   두상은 yaw로 안 커지는데 헤어 실루엣은 커지므로, 이쪽이 각도에도 강하다.
         · 중심(cx) — 귀 두 점의 한가운데. 모델의 정중시상면(x=0)이 그 자리다.
                   귀는 두상 중심보다 조금 <b>뒤</b>에 있어서 yaw가 크면 옆으로
                   밀려 찍힌다(x=0, z=zEar 점의 투영 = sin(yaw)·zEar). 그만큼 되돌린다.
       끄려면 VIEWCAL_ANCHOR.on = false — 예전(헤어 실루엣) 동작으로 정확히 복귀. */
    let sX = aH_head/halfPx, cxUse = (xMin+xMax)/2, anchorSrc = '헤어 실루엣';
    if(VIEWCAL_ANCHOR.on && lmV && lmV.lEarX != null && lmV.rEarX != null
       && isFinite(sy) && sy > 0){
      if(VIEWCAL_ANCHOR.isoScale) sX = sy;
      const earMidPx = (lmV.lEarX + lmV.rEarX) / 2 * maskInf.w;
      const zEar = -VIEWCAL_ANCHOR.earDepth * cD;              // 귀 깊이(뒤 = 음수)
      cxUse = earMidPx - Math.sin(pose.yaw) * zEar / sX;
      anchorSrc = lmV._silhouette ? '실루엣 앵커(귀)' : '얼굴 랜드마크(귀)';
      const cxOld = (xMin+xMax)/2, sOld = aH_head/halfPx;
      console.log('[뷰캘리·앵커] ' + angle + ': 중심 x ' + cxOld.toFixed(0) + '→' + cxUse.toFixed(0) + 'px'
        + ' (' + (cxUse-cxOld >= 0 ? '+' : '') + (cxUse-cxOld).toFixed(0) + 'px, ' + anchorSrc + ')'
        + ' · 가로자 ' + sOld.toFixed(5) + '→' + sX.toFixed(5)
        + ' (×' + (sX/sOld).toFixed(3) + (VIEWCAL_ANCHOR.isoScale ? ', 세로자와 일치' : '') + ')'
        + '\n    가로/세로 자 어긋남: 이전 ' + (sOld/sy).toFixed(3) + '배 → 지금 ' + (sX/sy).toFixed(3) + '배'
        + ' (1.000이 정답 — 정사영에서 두상은 가로·세로가 같은 자로 찍힙니다)');
    } else if(VIEWCAL_ANCHOR.on){
      console.warn('[뷰캘리·앵커] ' + angle + ': 귀 앵커를 못 구해 <b>헤어 실루엣</b> 자로 폴백 —'
        + ' 이 뷰는 머리카락이 흐른 만큼 중심·폭이 밀립니다(얼굴 랜드마크/실루엣 앵커 확인).');
    }
    /* [진단] 세로자의 출처와 크라운 오프셋 (2026-08-11)
       [뿌리선 어긋남]이 74px씩 나는데 [좌표왕복]은 2.8px다 — 변환이 아니라
       <b>놓인 자리</b>가 틀렸다는 뜻이다. 그 자리는 둘 중 하나에서 온다:
         · crownY(오프셋) — 마스크에서 제일 높은 두피선 픽셀
         · sy(세로자)     — 눈→턱에서 왔나, 가로에서 왔나
       뷰별로 둘을 같이 찍어야 어느 쪽인지 갈린다. */
    console.log('[뷰캘리·세로자] ' + angle + ': 자 출처 ' + syFrom
      + ' · sy ' + sy.toFixed(5) + ' · 크라운오프셋 ' + crownY.toFixed(0) + 'px'
      + ' (마스크 높이 ' + maskInf.h + 'px, 상단에서 ' + (100*crownY/maskInf.h).toFixed(1) + '%)'
      + ' · 유효컬럼 ' + validCols);
    views[angle] = { rec, maskInf, cx:cxUse, crownY, s: sX, sy, pose, cos2, sin2 };
  });
  const names = Object.keys(views);
  if(!names.length) return null;

  // ── 1단계: 헤어 외곽 헐 실측 ──
  const NY = 64;                 // 높이 버킷 수
  const yTop = CY + b;           // 크라운(두피선 최고점) ↔ 두피 돔 꼭대기 — 뿌리 출발점 고정
  const mapY = (v, py) => yTop - (py - v.crownY) * v.sy; // 배율은 뷰별(눈/턱 실측 우선)
  let yBot = CY - b;             // 최저점: 각 뷰 hairEndY 최댓값의 모델 y 중 최솟값
  names.forEach(n=>{
    const v = views[n];
    let maxEnd = -1;
    for(let x=0; x<v.maskInf.w; x++){
      if(v.maskInf.scalpY[x] >= 0 && v.maskInf.hairEndY[x] > maxEnd) maxEnd = v.maskInf.hairEndY[x];
    }
    if(maxEnd >= 0){
      const y = mapY(v, maxEnd);
      if(y < yBot) yBot = y;
    }
  });
  /* ── 캡: 세로 범위를 모발 최상단까지 (HAIR_TOP_CAP 주석 참조) ────────────
     yTop은 <b>두피</b> 돔 꼭대기다. 모발은 그 위로 자기 두께만큼 더 있다.
     버킷 범위를 yTopH까지 넓혀야 그 구간에도 실측 헐 반폭이 생긴다. */
  let yTopH = yTop, capRiseRaw = 0;
  const capViewTop = {};
  if(HAIR_TOP_CAP.on){
    names.forEach(n=>{
      const v = views[n];
      const tY = hairTopYOf(v.maskInf);
      if(!tY) return;
      const vals = [];
      for(let x=0; x<tY.length; x++) if(tY[x] >= 0 && v.maskInf.scalpY[x] >= 0) vals.push(tY[x]);
      if(vals.length < 8) return;
      vals.sort((p,q)=>p-q);                       // 이미지 y 오름차순 = 위→아래
      const topPx = vals[Math.min(vals.length-1, Math.floor(vals.length * HAIR_TOP_CAP.pct))];
      const y = mapY(v, topPx);
      capViewTop[n] = (y - yTop) / b;
      if(y > yTopH) yTopH = y;
    });
    capRiseRaw = (yTopH - yTop) / b;
    if(capRiseRaw > HAIR_TOP_CAP.maxRise) yTopH = yTop + HAIR_TOP_CAP.maxRise * b;
  }
  const yStep = (yTopH - yBot) / (NY - 1);
  const bucketOfY = y => Math.min(NY-1, Math.max(0, Math.round((yTopH - y) / yStep)));
  // 버킷별 관측 목록: 각 뷰에서 잰 반폭 E와 그 뷰의 cos²θ/sin²θ.
  // (예전엔 정면류→W합산, 측면류→D합산의 이분법이라 24° 사진이 "90° 옆모습"
  // 으로 취급돼 깊이 실측이 통째로 왜곡됐음 — 실기기의 납작 두상 헐 원인 중 하나)
  const obs = Array.from({length:NY}, ()=>[]);
  names.forEach(n=>{
    const v = views[n];
    const minX = new Float32Array(NY).fill(Infinity);
    const maxX = new Float32Array(NY).fill(-Infinity);
    // 컬럼 스팬이 지나가는 높이 버킷마다 좌우 극값 갱신.
    // (2026-08-08) 스팬 시작을 scalpY(두피선)가 아니라 <b>모발 상단</b>으로 —
    // 헐은 정의상 모발 바깥면인데 두피선부터 재면 정수리를 덮은 모발이
    // 관측에서 통째로 빠진다(그 구간 헐이 없어서 삐침이 생겼다).
    const tYarr = HAIR_TOP_CAP.on ? hairTopYOf(v.maskInf) : null;
    for(let x=0; x<v.maskInf.w; x++){
      const sY = v.maskInf.scalpY[x], eY = v.maskInf.hairEndY[x];
      if(sY < 0 || eY < 0) continue;
      const topPx = (tYarr && tYarr[x] >= 0) ? Math.min(tYarr[x], sY) : sY;
      const b0 = bucketOfY(mapY(v, topPx));
      const b1 = bucketOfY(mapY(v, eY));
      for(let bi=Math.min(b0,b1); bi<=Math.max(b0,b1); bi++){
        if(x < minX[bi]) minX[bi] = x;
        if(x > maxX[bi]) maxX[bi] = x;
      }
    }
    for(let bi=0; bi<NY; bi++){
      if(maxX[bi] < minX[bi]) continue;
      /* ── 관측 반폭은 <b>모델 축</b>(v.cx) 기준으로 잰다 (2026-08-18 e) ────────
         예전엔 (maxX−minX)/2, 즉 실루엣 <b>제 한가운데</b> 기준 반스팬이었다.
         그런데 가닥이 실제로 놓이는 자리는 mx = (px − <b>v.cx</b>)·s 이고, v.cx는
         2026-08-09부터 실루엣 한가운데가 아니라 <b>귀 앵커</b>다(로그
         [뷰캘리·앵커]의 "중심 x …→…(+Npx)"가 그 차이다). 헐 타원은 축(x=0)에
         중심을 두므로 축에서 <b>제일 먼</b> 관측점까지를 반경으로 잡아야 그 점이
         타원 안에 들어온다. 반스팬은 축 이탈량만큼 반경을 과소평가하고, 모자란
         만큼 아래 리프트가 u>1 분기(둘레로 감기)로 떨어져 <b>x가 안쪽으로 접힌다</b>.
         실루엣이 축에 대칭이면 두 값이 같으므로 대칭 케이스는 그대로 재현된다. */
      const halfPx = (HAIR_HULL_FIT.on && HAIR_HULL_FIT.axisE)
        ? Math.max(maxX[bi] - v.cx, v.cx - minX[bi])       // 축에서 제일 먼 쪽
        : (maxX[bi] - minX[bi]) / 2;                       // 예전(반스팬)
      obs[bi].push({ E: Math.max(0, halfPx) * v.s, cos2: v.cos2, sin2: v.sin2,
                     span: (maxX[bi] - minX[bi]) / 2 * v.s, angle: n });
    }
  });
  // 관측(E,θ) → 헐 단면(W,D) 역투영. E² = W²cos²θ + D²sin²θ 를 푼다:
  // 1차 — 깊이비를 두상비율(cD/a)로 가정하고 모든 관측에서 W 추정(평균).
  // 2차 — 측면성이 충분한 관측(sin²θ>0.06, 즉 |θ|>약 14°)에서 1차 W를 대입해
  //        D를 역산, [0.35W, 1.5W]로 클램프(작은 sinθ 나눗셈의 노이즈 억제).
  // 측면성 관측이 하나도 없으면 기존 폴백(D = W×두상비율) 유지.
  const hullW = new Float32Array(NY), hullD = new Float32Array(NY);
  const rHead = cD / a;
  const _fitOld = HAIR_HULL_FIT.log ? { W:new Float32Array(NY), D:new Float32Array(NY) } : null;
  for(let bi=0; bi<NY; bi++){
    const y = yTopH - bi*yStep;
    let W = NaN, D = NaN;
    if(obs[bi].length){
      /* ── 적합은 <b>평균</b>이 아니라 <b>감쌈</b>이다 (2026-08-18 e) ──────────────
         관측 E는 그 뷰의 사진이 "여기까지 머리카락이 있다"고 말한 값이다. 평균을
         내면 제일 넓게 찍힌 뷰가 자기 관측보다 좁은 타원을 받고, 그 뷰의 바깥
         가닥이 리프트에서 안쪽으로 접힌다(u>1 분기) — 둘레가 사진보다 좁아진다.
         헐은 정의상 <b>실루엣을 감싸는 면</b>이므로 각 관측을 만족시키는 쪽이 맞다:
           · W — 정면성 높은 관측(cos²>0.9)은 E≈W이므로 그 <b>최댓값</b>이 곧 W.
                 (computeHeadCrossSections도 같은 판정으로 정면 관측을 W에 쓴다.
                  거기는 평균, 여기는 최댓값 — 여기 값은 가닥이 들어갈 <b>그릇</b>이라
                  모자라면 접히고, 남으면 그냥 빈 공간이라 비대칭이다.)
           · D — 그 W를 넣고 측면 관측에서 역산한 요구치의 <b>최댓값</b>.
         안전레일은 예전 그대로다(D의 [0.35W, 1.5W] 클램프 · 아래 두피면 하한).
         새 상수는 하나도 안 만들었다. HAIR_HULL_FIT.enclose=false면 예전 평균. */
      if(HAIR_HULL_FIT.on && HAIR_HULL_FIT.enclose){
        const front = obs[bi].filter(o=>o.cos2 > 0.9);
        W = 0;
        if(front.length) front.forEach(o=>{ if(o.E > W) W = o.E; });
        else obs[bi].forEach(o=>{ const w = o.E / Math.sqrt(o.cos2 + rHead*rHead*o.sin2); if(w > W) W = w; });
        let dReq = 0, dAny = false;
        obs[bi].forEach(o=>{
          if(o.sin2 <= DEPTH_MIN_SIN2) return;
          const d2 = (o.E*o.E - W*W*o.cos2) / o.sin2;
          if(d2 > 0){ const d = Math.sqrt(d2); if(d > dReq) dReq = d; dAny = true; }
        });
        if(dAny) D = Math.max(0.35*W, Math.min(1.5*W, dReq));
      } else {
        let wAcc = 0;
        obs[bi].forEach(o=>{ wAcc += o.E / Math.sqrt(o.cos2 + rHead*rHead*o.sin2); });
        W = wAcc / obs[bi].length;
        const dRaw = solveDepthFromObs(obs[bi], W);
        if(dRaw != null) D = Math.max(0.35*W, Math.min(1.5*W, dRaw));
      }
    }
    if(isNaN(D) && !isNaN(W)) D = W * rHead;
    if(isNaN(W)){ W = headHalf(y,'w') * 1.02; D = headHalf(y,'d') * 1.02; }
    hullW[bi] = Math.max(W, headHalf(y,'w')); // 헐은 항상 두피면 바깥
    hullD[bi] = Math.max(D, headHalf(y,'d'));
    /* [진단] 예전 방식(반스팬 + 평균)을 같은 밴드에서 나란히 계산해 둔다 —
       "얼마나 좁았나"를 배율로 말할 수 있어야 이 수정이 반증 가능해진다. */
    if(_fitOld){
      let oW = NaN, oD = NaN;
      if(obs[bi].length){
        let wAcc = 0;
        obs[bi].forEach(o=>{ wAcc += o.span / Math.sqrt(o.cos2 + rHead*rHead*o.sin2); });
        oW = wAcc / obs[bi].length;
        const dRawOld = solveDepthFromObs(obs[bi], oW, o=>o.span);
        if(dRawOld != null) oD = Math.max(0.35*oW, Math.min(1.5*oW, dRawOld));
      }
      if(isNaN(oD) && !isNaN(oW)) oD = oW * rHead;
      if(isNaN(oW)){ oW = headHalf(y,'w') * 1.02; oD = headHalf(y,'d') * 1.02; }
      _fitOld.W[bi] = Math.max(oW, headHalf(y,'w'));
      _fitOld.D[bi] = Math.max(oD, headHalf(y,'d'));
    }
  }
  for(let pass=0; pass<2; pass++){ // 마스크 노이즈 완화(이동평균 2회)
    for(let bi=1; bi<NY-1; bi++){
      hullW[bi] = (hullW[bi-1] + 2*hullW[bi] + hullW[bi+1]) / 4;
      hullD[bi] = (hullD[bi-1] + 2*hullD[bi] + hullD[bi+1]) / 4;
      if(_fitOld){
        _fitOld.W[bi] = (_fitOld.W[bi-1] + 2*_fitOld.W[bi] + _fitOld.W[bi+1]) / 4;
        _fitOld.D[bi] = (_fitOld.D[bi-1] + 2*_fitOld.D[bi] + _fitOld.D[bi+1]) / 4;
      }
    }
  }
  /* ── 평활 <b>뒤에</b> 감쌈을 다시 보장한다 (2026-08-18 e) ────────────────────
     이동평균은 봉우리를 깎는다 — 마스크 노이즈를 지우려고 넣은 것이지만, 깎인
     만큼 그 밴드는 다시 자기 관측보다 좁아지고 거기서 가닥이 접힌다. 그래서
     평활은 그대로 두되 <b>바닥</b>으로 관측 요구치를 다시 깐다: 골(관측이 없거나
     좁게 찍힌 밴드)은 평활이 올려 주고, 봉우리는 관측이 지켜 준다.
     한 밴드에서 모자라면 W·D를 <b>같은 배율</b>로 키운다 — 형상비를 보존하고,
     어느 축이 모자란지는 관측각이 이미 말해 주기 때문이다(위 적합에서 축별로
     푼 뒤 남는 잔차라 대개 1~3%다. 로그로 실제 배율을 찍는다). */
  let encMax = 1, encN = 0;
  if(HAIR_HULL_FIT.on && HAIR_HULL_FIT.keepAfterSmooth){
    for(let bi=0; bi<NY; bi++){
      if(!obs[bi].length) continue;
      let k = 1;
      obs[bi].forEach(o=>{
        const h = Math.sqrt(hullW[bi]*hullW[bi]*o.cos2 + hullD[bi]*hullD[bi]*o.sin2);
        if(h > 1e-6 && o.E/h > k) k = o.E/h;
      });
      if(k > 1 + 1e-6){ hullW[bi] *= k; hullD[bi] *= k; encN++; if(k > encMax) encMax = k; }
    }
  }
  /* [3D·헐 둘레] 이 수정이 실제로 무엇을 바꿨는지 <b>배율</b>로 남긴다.
     둘레는 라마누잔 근사로 잰다(타원 둘레의 표준 근사). 1.00배면 이 손님에게는
     예전과 같다는 뜻이고, 그때는 좁아짐의 원인이 헐이 아니라 다른 곳이다. */
  if(_fitOld){
    const per = (W,D)=>{ const h = ((W-D)*(W-D))/Math.max(1e-9,(W+D)*(W+D));
                         return Math.PI*(W+D)*(1 + 3*h/(10+Math.sqrt(4-3*h))); };
    let sNew = 0, sOld = 0, worst = 1, worstBi = -1;
    for(let bi=0; bi<NY; bi++){
      const pn = per(hullW[bi], hullD[bi]), po = per(_fitOld.W[bi], _fitOld.D[bi]);
      sNew += pn; sOld += po;
      if(po > 1e-6 && pn/po > worst){ worst = pn/po; worstBi = bi; }
    }
    console.log('[3D·헐 둘레] 감쌈 적합 ' + (sOld>1e-6 ? (sNew/sOld).toFixed(3) : '?') + '배'
      + ' (예전=반스팬+평균 기준 · 밴드 최대 ' + worst.toFixed(3) + '배'
      + (worstBi>=0 ? ' @버킷 '+worstBi+' y '+(yTopH-worstBi*yStep).toFixed(2) : '') + ')'
      + ' · 평활 뒤 되살린 밴드 ' + encN + '/' + NY + '(최대 ×' + encMax.toFixed(3) + ')'
      + ' · 축기준E ' + (HAIR_HULL_FIT.axisE ? 'ON' : 'off')
      + ' · 감쌈 ' + (HAIR_HULL_FIT.enclose ? 'ON' : 'off')
      + '\n    1.00배면 이 손님은 예전과 같다는 뜻 — 그때 두상이 좁으면 원인은 헐이 아니라 두피면·자·클립 쪽입니다.');
  }

  /* ── 1.5단계(2026-08-01 신규): 구조텐서 결정보를 두상 좌표로 통합 ──
     헐이 확정된 <b>직후</b>가 유일하게 맞는 자리다 — 결을 두상에 붙이려면 그
     자리의 표면(헐)과 법선이 있어야 하고, 가닥을 올리기 <b>전</b>이어야 올리는
     즉시 정렬해서 넣을 수 있다. 매핑(mapY/bucketOfY/hullW/hullD)을 그대로
     넘겨서 가닥과 필드가 같은 좌표에 놓이도록 한다. */
  const field3D = buildHairOrientationField3D({ views, names, hullW, hullD, bucketOfY, mapY, CY, b, NY, yStep });
  const fieldAcc = { n:0, hit:0, turn:0, turnN:0, polUsed:0, polFlip:0 };

  /* ── 1.6단계(2026-08-01 신규): 세그멘테이션을 두상 좌표로 통합 ──
     결 필드와 같은 자리에서 세운다. 헐이 있어야 표면 점을 찍을 수 있고, 가닥을
     올리기 전이어야 올리는 즉시 다듬을 수 있다. headR은 투표 가중치(정면성)를
     정규화하는 기준 반지름 — 두상 폭·깊이 중 큰 쪽. */
  const occProbe = makeHairOccupancyProbe(views, names, yTop, CY, Math.max(a, cD));
  const occAcc = { n:0, trimmed:0, dropped:0, removedPts:0 };
  /* (2026-08-03) 뿌리 밀도 격자를 <b>여기서</b> 굽는다 — 예전엔 이 함수 맨 끝
     (모발 프로필 통합)에서 구웠는데, 겹침 정리가 이 격자를 목표치로 쓰므로
     가닥을 올리기 전에 있어야 한다. 프로브만 읽는 순수 계산이라 옮겨도
     값이 같다(끝에서는 이걸 그대로 재사용한다 — 두 번 굽지 않는다). */
  let rootField = null;
  try{ rootField = buildRootDensityField(occProbe, hullW, hullD, bucketOfY, CY, b); }
  catch(e){ console.warn('뿌리 밀도 격자 실패(겹침 정리 건너뜀):', e); }

  // ── 2~4단계: 헐 깊이 + 두께 채움 + 깊이 음영 ──
  const group = new THREE.Group();
  group.name = 'hairStrands';
  // (2026-07-17) 반대편 미촬영 뷰 거울 채움 — front만 캡처된 상태에선 모든
  // 가닥의 z≥0(앞반구)이라 옆에서 보면 반쪽 껍질이 종잇장처럼 납작하게 보임
  // (실기기 스크린샷 + Node 하네스로 z분포 0~+cD 확인. 사용자: "머리가
  // 납작하게 나왔는데, 머리모양처럼 타원처럼 나오게"). 실측이 없는 뷰는
  // 맞은편 캡처(front↔back, left↔right)를 x반전·해당 yaw로 재사용해 타원
  // 전체를 덮는다 — 실측 아님(자리표시자)이라 mirrored 플래그로 표시.
  // 해당 각도 사진을 실제로 찍으면 실측이 우선되고 거울 채움은 사라짐.
  const MIRROR_SRC = { front:'back', back:'front', left:'right', right:'left' };
  const jobs = names.map(n2 => {
    const v2 = views[n2];
    return { angle:n2, v:v2, mirrored:false, yaw:v2.pose.yaw, pitch:v2.pose.pitch, roll:v2.pose.roll };
  });
  Object.keys(MIRROR_SRC).forEach(missing=>{
    if(views[missing]) return;
    const srcV = views[MIRROR_SRC[missing]];
    if(!srcV) return;
    // 거울 잡의 포즈도 실측에서 파생: 전↔후는 원본 실측 yaw+180°,
    // 좌↔우는 중앙면(x) 대칭이므로 yaw 부호 반전. roll도 대칭상 부호 반전.
    const fb = (missing === 'front' || missing === 'back');
    jobs.push({ angle:missing, v:srcV, mirrored:true,
      yaw:  fb ? srcV.pose.yaw + Math.PI : -srcV.pose.yaw,
      pitch: srcV.pose.pitch, roll: -srcV.pose.roll });
  });
  /* 가닥 솎아내기 (2026-07-27: 2 → 1)
     이 값은 <b>정규 3D 모델</b>의 밀도를 정한다. 조정 화면 되쏘기와 최종 3D 화면이
     둘 다 이 모델을 쓰므로, 여기서 버린 가닥은 어디서도 되살릴 수 없다.
     2였을 때: 2D 원본 결 보기는 2,833가닥인데 3D는 1,417개 — 절반이었다.
     사용자 우선순위: "3D 이미지가 제일 잘 나와야 돼. 최종적으로 손님한테
     보여주고 여기에 옷을 입힐 거니까." → 밀도를 원본과 맞춘다.
     ※ 저사양 기기에서 무거우면 이 값을 2로 되돌리는 게 첫 번째 폴백이다
       (조정 화면 쪽은 HAIR3D_RENDER.stride가 따로 자동 솎기를 하므로 영향 적음). */
  const STRAND_SAMPLE_3D = 1;
  let seed = 20260717;        // 결정적 난수 — 재구성해도 같은 배치(디버그 재현성)
  const rand = ()=>{ seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  // ── (10차, 3D 조정 전환 1단계) 정규 3D 모델 채집 ──
  // 이 리프트가 만드는 월드 3D 가닥을 재사용 가능한 형태로 stash — "3D가 원본,
  // 2D는 그 투영"이라는 합의 구조의 토대. 조정 화면이 이 모델을 현재 뷰 카메라로
  // 되쏘아(projectHair3DToView) 2D로 표시하게 된다. 여기선 모델 채집만; 조정
  // 연산자(길이/컬/섹션)와 렌더 배선은 다음 단계.
  const canonicalStrands = [];      // [{pts:[{x,y,z}], sec, color, srcAngle, mirrored}]
  const _sec3DHist = {};            // [진단] #4 — 3D 뿌리 기준 섹션 분포
  const _capAll = {}, _capStat = {}; // [진단] 두피 돔 위로 나간 점(정수리 삐침 출처)
  const _wrapStat = {};              // [진단] 헐 단면 밖으로 나가 x가 접힌 점(둘레 좁아짐 출처)
  const viewCal = {};               // 뷰별 image↔model 캘리브레이션(되쏘기용)
  names.forEach(n3=>{               // names = 실측(비거울) 뷰만
    const vv = views[n3];
    viewCal[n3] = { cx:vv.cx, s:vv.s, sy:vv.sy, crownY:vv.crownY,
                    yaw:vv.pose.yaw, pitch:vv.pose.pitch, roll:vv.pose.roll };
  });
  let total = 0;
  jobs.forEach(job=>{
    const angle = job.angle;
    const v = job.v;
    // 실측 포즈 회전 — projectImagePointToHead와 동일한 관례(카메라 공간
    // 좌표에 역회전 R^T 적용, "우산 헤어" 버그 수정 때 수치 검증된 방향).
    const rot = composeRotationZYX(job.yaw, job.pitch, job.roll);
    // 이 잡의 카메라 방위 성분 — 단면 반경 일반화에 사용
    const jCos2 = Math.cos(job.yaw)**2, jSin2 = Math.sin(job.yaw)**2;
    // (2026-08-03) 여기 있던 positions/colors 제거 — 선분은 겹침 정리 뒤에 한 번에 굽는다.
    const c = new THREE.Color();
    for(let si=0; si<v.rec.strands.length; si+=STRAND_SAMPLE_3D){
      const st = v.rec.strands[si];
      c.set(st.color);
      /* 점마다 다른 실측색(HAIR_PIXEL_COLOR)이 있으면 3D 미리보기도 그걸 쓴다 —
         안 그러면 2D 화면만 결이 살고 3D는 예전 단색이라 둘이 달라 보인다. */
      const stCols = st.colors && st.colors.length > 1 ? st.colors : null;
      const cSeg = stCols ? new THREE.Color() : null;
      /* ── 뿌리는 두피에서 나와야 한다 (2026-07-27, 사용자 지적) ──────────
         사용자: "시작하는 뿌리 자체가 원래보다 바깥쪽에서 시작하는데."
         정확한 지적이었다. 예전엔 `t = 0.35 + 0.65*rand()` 하나를 <b>가닥 전체</b>에
         똑같이 썼다. t는 0=두피면 ~ 1=헐(머리카락 바깥면)이므로,
           · 어떤 가닥도 두피에서 시작하지 않고(최소 35% 바깥)
           · 평균 67.5% 지점에서 <b>뿌리부터</b> 떠 있었다
         → 머리 전체가 모발 두께의 3분의 2만큼 부풀어 보인다. 시작부터 부푼 이유.

         고침: t를 가닥을 따라 <b>변하게</b> 한다. 뿌리는 두피 근처에서 출발해
         ROOT_RAMP 구간 안에 자기 층으로 올라온다. 실제 모발이 그렇다 —
         겉면을 이루는 건 그 자리에서 솟은 모발이 아니라 위에서 내려온 모발이다.
         층 자체도 전 두께를 고르게 쓴다(0.35 하한 제거) — 안쪽이 비어 있으면
         겉껍질만 남아 역시 부풀어 보인다.
         ROOT_LIFT를 0으로 두지 않은 이유: 정수리 꼭짓점은 그 자리 가닥밖에
         없어서 완전히 붙이면 그 한 점만 민머리처럼 파인다. */
      const tLayer = rand();          // 이 가닥이 눕는 층: 0=두피면, 1=헐 바깥면
      let t = hairLayerAt(tLayer, 0, 1);  // 점마다 갱신(음영 k/rim도 이 값을 쓴다)
      let lastZ = null;
      let rootFacing = 0;             // (2026-08-03) 뿌리를 이 카메라가 얼마나 정면으로 봤나
      const worldPts = []; // (10차) 정규 모델용 월드 폴리라인
      /* (2026-08-01) 점 색을 즉시 positions/colors로 밀어넣지 않고 <b>따로 모은다</b>.
         결 정렬(alignStrandPtsToField3D)은 가닥 전체를 보고 다시 걸어야 하는데,
         선분을 이미 구워버리면 정렬 결과가 3D 화면에는 반영되지 않고 canonical
         에만 들어가서 두 화면이 또 갈라진다(예전에 실제로 겪었던 그 구조). */
      const worldCols = [];
      const nSeg = Math.max(1, st.pts.length - 1);
      for(let i=0;i<st.pts.length;i++){
        t = hairLayerAt(tLayer, i, nSeg);   // 뿌리는 두피 근처 → 자기 층으로
        const p = st.pts[i];
        const mxRaw = (p.x - v.cx) * v.s;
        const mx = job.mirrored ? -mxRaw : mxRaw; // 거울 뷰는 x반전(그 방향에서 본 좌우가 맞도록)
        const my = mapY(v, p.y);
        // [진단] 두피 돔 꼭대기 위로 나간 점 — 삐침의 출처를 뷰별로 남긴다
        _capAll[job.angle] = (_capAll[job.angle] || 0) + 1;
        if(my > yTop){
          const s = _capStat[job.angle] || (_capStat[job.angle] = { pts:0, root:0, maxRise:0 });
          s.pts++; if(i === 0) s.root++;
          const rr = (my - yTop) / b; if(rr > s.maxRise) s.maxRise = rr;
        }
        const bi = bucketOfY(my);
        // 이 잡 카메라에서 본 헐/두피 단면 반경 — 예전 SIDE 이분법(폭↔깊이
        // 스왑)의 연속 일반화: 방위각 θ에서 본 타원(W,D)의 투영 반폭은
        // sqrt(W²cos²θ+D²sin²θ), 중앙(카메라 축) 코드 반깊이는 WD/반폭.
        // θ=0/90°에서 기존 값(W,D / D,W)으로 정확히 환원되고, 중간 각도
        // (실촬영 24° 등)에선 근사(코드 중심이 약간 어긋나는 회전타원 효과는
        // 무시) — projectImagePointToHead가 쓰는 것과 같은 수준의 근사.
        const Wb = hullW[bi], Db = hullD[bi];
        const aH  = Math.sqrt(Wb*Wb*jCos2 + Db*Db*jSin2);
        const aD  = (Wb*Db) / Math.max(aH, 1e-4);
        const hw = headHalf(my,'w'), hd = headHalf(my,'d');
        const aHh = Math.sqrt(hw*hw*jCos2 + hd*hd*jSin2);
        const aDh = aHh > 1e-4 ? (hw*hd) / aHh : 0;
        let px = mx, mz, facing = 0;
        const u = aH > 1e-4 ? (mx/aH)*(mx/aH) : 2;
        /* [진단·헐 접힘] u>1이면 아래에서 x가 <b>안쪽으로</b> 접힌다(둘레로 감김).
           그 분기는 "진짜로 헐 밖인 가닥"을 위한 폴백인데, 헐이 사진보다 좁으면
           평범한 가닥까지 여기로 떨어져 두상 둘레가 통째로 줄어든다 — 사용자가
           본 증상이 그것이다. 그래서 <b>얼마나</b> 접히는지를 뷰별로 센다
           (2026-08-18 e). 이 수치가 0에 가까우면 헐이 실루엣을 감싸고 있다는 뜻. */
        if(u > 1 && aH > 1e-4){
          const w = _wrapStat[job.angle] || (_wrapStat[job.angle] = { pts:0, all:0, maxOver:1, root:0 });
          w.pts++; if(i === 0) w.root++;
          const over = Math.abs(mx)/aH; if(over > w.maxOver) w.maxOver = over;
        }
        { const w = _wrapStat[job.angle] || (_wrapStat[job.angle] = { pts:0, all:0, maxOver:1, root:0 });
          w.all++; }
        if(u <= 1){
          const hullZ  = aD * Math.sqrt(1 - u);                    // 헐 바깥면 깊이
          const uh     = aHh > 1e-4 ? (mx/aHh)*(mx/aHh) : 2;
          const scalpZ = uh <= 1 ? aDh * Math.sqrt(1 - uh) : 0;    // 두피면 깊이
          mz = scalpZ + (hullZ - scalpZ) * t;                      // 실측 두께 안에 층 배치
          facing = Math.sqrt(1 - u);                               // 카메라를 향한 정도(곡률 음영용)
        } else if(headHalf(my,'w') > 1e-3 || (my > yTop && aH > 1e-3)){
          /* (2026-08-08) 캡 구간(my > yTop)에서는 두피가 없어 headHalf가 0이라
             이 분기를 못 타고 lastZ(납작한 수직 삐침)로 떨어졌다. 그 구간은
             헐 반폭 aH로 게이트한다 — 두상 아래(긴 머리 늘어짐)의 lastZ 동작은
             그대로 둔다(거긴 목을 감으면 안 되므로 기존 판단이 맞다). */
          // (2026-07-17) 단면 밖(u>1)이지만 아직 두상 높이 범위 안: 예전엔
          // lastZ 유지/림 평면(z=0)이라 가장자리 가닥이 납작한 커튼으로
          // 눌렸음. 반폭 초과분을 호길이로 환산해 타원 둘레를 따라 뒤쪽으로
          // 감아 배치("타원처럼"). 림(θ=π/2)에서 x=aH, z=0이라 위 분기와
          // 이음새 연속(림에선 scalpZ=hullZ=0이라 t와 무관하게 mz=0).
          // θ 상한 0.85π — 반대편 뒤통수 중심을 뚫고 지나가는 것 방지.
          const sgn = mx >= 0 ? 1 : -1;
          const rEdge = Math.max(1e-3, (aH + aD) / 2);            // 근사 둘레 반경
          const theta = Math.min(Math.PI * 0.85, Math.PI/2 + (Math.abs(mx) - aH) / rEdge);
          px = sgn * aH * Math.sin(theta);
          mz = aD * Math.cos(theta);
        } else if(lastZ !== null){
          mz = lastZ;    // 두상 아래(늘어짐): 마지막 깊이 유지 — 목을 감지 않게
        } else {
          mz = 0;        // 시작부터 두상 밖(가장자리 뿌리): 림 평면
        }
        lastZ = mz;
        if(i === 0) rootFacing = facing;   // 겹침 정리에서 "누구 말을 믿을지" 고를 때 쓴다
        const w3 = applyRotationTranspose3(rot, new THREE.Vector3(px, my - CY, mz));
        w3.y += CY;
        worldPts.push({ x:w3.x, y:w3.y, z:w3.z }); // (10차) 정규 모델 채집
        // 4단계 음영: 곱(층 깊이) + 가산(바깥층·정면 곡면 하이라이트, 검은 머리 대응)
        const k = 0.55 + 0.45 * t;
        const rim = 0.05 * t + 0.11 * t * facing;
        let cc = c;
        if(stCols){   // 뿌리(i=0)~끝을 조각 색에 대응시킨다
          cSeg.set(stCols[Math.min(stCols.length-1, Math.floor(i / st.pts.length * stCols.length))]);
          cc = cSeg;
        }
        worldCols.push(Math.min(1, cc.r * k + rim), Math.min(1, cc.g * k + rim), Math.min(1, cc.b * k + rim));
      }
      if(worldPts.length >= 2){
        // ── 결 정렬 — 실측 결 필드 쪽으로 진행 방향을 되돌린다 ──
        let aligned = field3D
          ? alignStrandPtsToField3D(worldPts, field3D, a, fieldAcc)
          : worldPts;
        /* ── 세그멘테이션 다듬기 — 머리카락이 없는 자리로 들어가면 거기서 끝 ──
           정렬을 <b>먼저</b> 하고 다듬는 순서인 이유: 정렬이 가닥을 움직이므로,
           움직이기 전 좌표로 판정하면 실제로 그려질 자리와 다른 곳을 검사하게 된다.
           뿌리부터 비어 있으면 가닥을 통째로 버린다(아래 continue). */
        if(occProbe){
          const trimmed = trimStrandToOccupancy3D(aligned, occProbe, occAcc);
          if(!trimmed){ total++; continue; }   // 이 가닥은 실측상 존재하지 않는다
          aligned = trimmed;
        }
        /* (2026-08-03) 선분을 <b>여기서 굽지 않는다</b>. 겹침 정리가 가닥을 솎아낸
           뒤에 구워야 화면과 모델이 같아진다 — 예전엔 여기서 바로 group에 넣어서,
           canonicalStrands에서 뺀 가닥이 3D 화면에는 그대로 남았다.
           worldCols(점당 색)를 같이 들고 간다 — 이게 있어야 나중에 구울 수 있다. */
        // (#4) 섹션은 뷰별 2D 라벨이 아니라 <b>3D 뿌리 위치</b>에서 — 위 주석 참조
        const sec3D = SECTION_3D.on ? resolveSection3D(aligned[0], CY, sB) : null;
        if(sec3D) _sec3DHist[sec3D] = (_sec3DHist[sec3D]||0) + 1;
        else _sec3DHist._miss = (_sec3DHist._miss||0) + 1;
        canonicalStrands.push({ pts:aligned, cols:worldCols, sec: sec3D || st.sec || 'crown',
          color: st.color, colors: st.colors || null,   // 조각별 실측색(없으면 null=예전 단색)
          srcAngle: angle, mirrored: job.mirrored, rootFacing });
      }
      total++;
    }
  });

  /* [진단·정수리캡] 정수리 삐침의 출처 — 뷰별로 두피 돔 위에 몇 점이 있었나 */
  {
    const parts = Object.keys(_capAll).map(n=>{
      const s = _capStat[n] || { pts:0, root:0, maxRise:0 };
      const tot = _capAll[n] || 1;
      return n + ' ' + s.pts + '/' + tot + '(' + (100*s.pts/tot).toFixed(1) + '%)'
           + ' 뿌리' + s.root + ' 최대+' + s.maxRise.toFixed(3) + 'b';
    });
    console.log('[진단·정수리캡] 두피돔 위 점: ' + (parts.join(' | ') || '없음')
      + ' · 캡 상승 ' + capRiseRaw.toFixed(3) + 'b'
      + (capRiseRaw > HAIR_TOP_CAP.maxRise ? '(→클램프 ' + HAIR_TOP_CAP.maxRise + 'b)' : '')
      + ' · 뷰별 상단 ' + (Object.keys(capViewTop).map(k=>k+' '+capViewTop[k].toFixed(2)+'b').join(' / ') || '없음'));
    if(capRiseRaw > HAIR_TOP_CAP.warnRise)
      console.warn('[진단·정수리캡] ⚠ 캡 상승 ' + capRiseRaw.toFixed(2) + 'b — 모발 두께치고 과하다. crownY(두피선 최고점) 또는 마스크 상단 의심.');
  }

  /* [진단·헐 접힘] 헐 단면 밖으로 나가 x가 안쪽으로 접힌 점 — <b>두상 둘레가
     좁아지는 양</b>을 뷰별로 재는 자리다(2026-08-18 e). 최대초과 1.10배면 그 뷰의
     제일 바깥 가닥이 사진보다 10% 안쪽에 놓였다는 뜻. 감쌈 적합이 먹으면 0%에
     가까워야 한다 — 안 줄면 원인이 헐이 아니라 v.cx(앵커)나 자(s) 쪽이다. */
  {
    const parts = Object.keys(_wrapStat).map(n=>{
      const w = _wrapStat[n];
      return n + ' ' + w.pts + '/' + w.all + '(' + (100*w.pts/Math.max(1,w.all)).toFixed(1) + '%)'
           + ' 뿌리' + w.root + ' 최대초과 ×' + w.maxOver.toFixed(3);
    });
    const worst = Object.keys(_wrapStat).reduce((m,n)=>Math.max(m, _wrapStat[n].maxOver), 1);
    console.log('[진단·헐 접힘] 헐 밖으로 나가 접힌 점: ' + (parts.join(' | ') || '없음')
      + (worst > 1.02
          ? '\n    ⚠ 헐이 실루엣을 못 감싸고 있습니다 — 그만큼 두상 둘레가 사진보다 좁게 나옵니다([3D·헐 둘레] 줄과 같이 볼 것).'
          : '\n    헐이 실루엣을 감싸고 있습니다(접힘 없음 = 3D 둘레가 사진과 일치).'));
  }

  /* ── 겹침 정리 (2026-08-03) ─────────────────────────────────────────
     사용자: "3D 미리보기를 보면 전면부에 크라운·프론트·사이드가 겹겹이 있어.
     그러니까 머리카락색깔이었어. 그런데 오히려 후면은 성글어."
     맞는 지적이고, 로그가 그대로 말한다 — 이번 촬영의 실측 yaw는
     front -1° / left 43° / right -39° / back 180°였다. 옆모습 두 장이 90°가
     아니라 40°대라 <b>앞 반구를 카메라 세 대가 겹쳐</b> 봤고, 리프트는 각 뷰의
     2,833가닥을 아무 조율 없이 전부 심는다. 결과가 관측 13,108개 → 채워진 셀
     850개(셀당 15겹)인데 표면셀은 826/1828(45%)만 머리가 있는 상태다.
     한쪽은 15겹, 절반은 빈 채로.
     ※ 촬영을 90°에 가깝게 해도 앞뒤 경계는 반드시 겹친다 — 각도 문제가 아니라
       <b>조율이 없는 것</b>이 원인이라 여기서 고친다.
     아래 pruneOverlappedRoots가 뿌리를 표면 셀에 담고, 실측 밀도를 목표로
     과밀한 셀만 솎는다. 자세한 규칙은 그 함수 주석에. */
  const pruneStat = pruneOverlappedRoots(canonicalStrands, rootField,
                                         hullW, hullD, bucketOfY, CY, b, occProbe);
  if(pruneStat && pruneStat.dropped){
    for(let i=canonicalStrands.length-1; i>=0; i--){
      if(canonicalStrands[i]._drop) canonicalStrands.splice(i, 1);
    }
  }

  // ── 선분 굽기 — 솎아낸 <b>뒤</b>에. 뷰별로 묶어 이름을 유지한다(진단용). ──
  const byJob = new Map();
  for(const s of canonicalStrands){
    const key = s.srcAngle + (s.mirrored ? '-mirror' : '');
    let e = byJob.get(key);
    if(!e){ e = { positions:[], colors:[], mirrored:s.mirrored }; byJob.set(key, e); }
    const pts = s.pts, cols = s.cols;
    for(let i=1;i<pts.length;i++){
      const p0 = pts[i-1], p1 = pts[i];
      e.positions.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
      /* 정렬·다듬기로 점 수가 줄었을 수 있다 — cols가 모자라면 마지막 색을 쓴다.
         (예전 코드는 같은 인덱스를 그냥 읽어서 undefined가 들어갈 수 있었다) */
      const ci0 = Math.min((i-1)*3, cols.length-3), ci1 = Math.min(i*3, cols.length-3);
      e.colors.push(cols[ci0], cols[ci0+1], cols[ci0+2], cols[ci1], cols[ci1+1], cols[ci1+2]);
    }
  }
  byJob.forEach((e, key)=>{
    if(!e.positions.length) return;
    const lines = makeVertexColorLines(e.positions, e.colors);
    lines.name = 'strandLines-' + key;
    lines.userData.fromPaths = true; // [진단용]
    lines.userData.mirrored = e.mirrored; // [진단용] 실측 아님(맞은편 뷰 거울 채움)
    group.add(lines);
  });
  // [진단용] '겹'(커트 레이어) 확인 — 실측 뷰 하나에서 뿌리 높이(pts[0].y)별로
  // 가닥의 세로 길이를 상/중/하 3구간 평균 내어 비교한다. 커트기법이 유니폼(기본)이면
  // 층이 거의 없어 상≈하, 원랭스면 높은 뿌리가 더 길고(끝 수렴), 인크리스면 더 짧다(확산).
  // 값은 마스크 y좌표계 기준 상대 비교용. (동작 무변경 — 읽기·로그만)
  try {
    const rj = jobs.find(j=>!j.mirrored) || jobs[0];
    const strands = rj && rj.v && rj.v.rec && rj.v.rec.strands;
    if(strands && strands.length){
      let minY=Infinity, maxY=-Infinity;
      strands.forEach(s=>{ if(s.pts && s.pts.length){ const y=s.pts[0].y; if(y<minY)minY=y; if(y>maxY)maxY=y; } });
      const span=Math.max(1e-6, maxY-minY);
      const bins=[[0,0],[0,0],[0,0]]; // [길이합, 개수] 상/중/하 뿌리
      strands.forEach(s=>{
        if(!s.pts || s.pts.length<2) return;
        const t=(s.pts[0].y - minY)/span;                       // 0=최상단 뿌리, 1=최하단
        const len=Math.abs(s.pts[s.pts.length-1].y - s.pts[0].y); // 가닥 세로 길이
        const bi = t<0.34?0 : t<0.67?1 : 2;
        bins[bi][0]+=len; bins[bi][1]++;
      });
      const mean=b=> b[1]? b[0]/b[1] : 0;
      const top=mean(bins[0]), mid=mean(bins[1]), bot=mean(bins[2]);
      const rel = bot>1e-6 ? (top-bot)/bot : 0;
      const verdict = Math.abs(rel)<0.06 ? '층 거의 없음(유니폼/기본값)'
                    : rel>0 ? '높은뿌리가 더 긺 → 수렴(원랭스/그라데이션 층 형성됨)'
                    : '높은뿌리가 더 짧음 → 확산(인크리스 롱레이어 형성됨)';
      console.log('[진단·겹] '+rj.angle+' 뿌리높이별 평균 가닥길이 상='+top.toFixed(3)
        +' 중='+mid.toFixed(3)+' 하='+bot.toFixed(3)+' (상/하차 '+(rel*100).toFixed(0)+'%) → '+verdict);
    }
  } catch(e){ /* 진단 실패는 무시 */ }

  /* [진단] #4 — 3D 뿌리 기준 섹션 분포. 뷰별 2D 분포([진단·섹션분포])와 달리
     <b>하나</b>만 나온다(섹션이 두피의 성질이므로). 어느 섹션이 0%면 그건 진짜로
     그 사람에게 없는 것이지, 뷰 때문에 안 잡힌 게 아니다. */
  if(SECTION_3D.on){
    const tot = Object.values(_sec3DHist).reduce((a,c)=>a+c,0) || 1;
    const order = ['crown','front','temple','side','occipital','nape'];
    console.log('[3D·섹션] 뿌리 3D 위치 기준 — '
      + order.map(k=>k+'=' + (_sec3DHist[k]||0) + '(' + Math.round((_sec3DHist[k]||0)/tot*100) + '%)').join(' ')
      + (_sec3DHist._miss ? ' · 구역 밖 ' + _sec3DHist._miss + '개(2D 라벨 승계)' : '')
      + '\n    ↑ 뷰별 [진단·섹션분포]와 달리 <b>하나</b>만 나옵니다 — 섹션은 뷰가 아니라 두피의 성질입니다.'
      + ' SECTION_3D.on=false 면 예전(뷰별 2D 라벨) 동작.');
  }
  console.log('[3D] 헐 기반 옮기기:', total, '가닥 (실측 뷰:', names.join(','),
    '/ 거울 채움:', jobs.filter(j=>j.mirrored).map(j=>j.angle).join(',') || '없음', ')');
  /* [진단] 결 정렬이 <b>실제로</b> 먹었는지. 이 숫자가 0이면 필드는 만들어졌는데
     가닥이 필드가 없는 자리(정수리 극/실루엣 밖)만 지나갔다는 뜻이고, 평균
     꺾임이 0.1° 수준이면 gain을 올려야 한다. 조용히 아무 일도 안 일어나는 게
     이 코드에서 제일 알아채기 어려운 실패라서 매번 찍는다. */
  if(field3D){
    console.log('[3D·결] 결 정렬 적용 — 스텝 '+fieldAcc.n+'개 중 필드 있는 자리 '
      + fieldAcc.hit + '개(' + (fieldAcc.n ? Math.round(fieldAcc.hit/fieldAcc.n*100) : 0) + '%)'
      + ' · 평균 꺾임 ' + (fieldAcc.turnN ? (fieldAcc.turn/fieldAcc.turnN*180/Math.PI).toFixed(2) : '0.00') + '°'
      + ' · 표류 허용 ' + HAIR_FIELD3D.driftRate + '×호길이(바닥 ' + (HAIR_FIELD3D.driftMin*a).toFixed(3) + ')'
      + ' · 극성 신뢰 스텝 ' + (fieldAcc.polUsed||0) + '개, 그중 되돌림 ' + (fieldAcc.polFlip||0) + '개');
    /* 원인 분리용 히스토그램 — 위 "평균 꺾임"은 정렬을 <b>하고 난 뒤</b> 값이라
       원인을 못 가린다. 이건 정렬 <b>전</b>, 필드와 올라온 가닥의 각차 분포다. */
    if(fieldAcc.polHist){
      const H = fieldAcc.polHist, tot = H.reduce((s,v)=>s+v,0) || 1;
      const tail = (H[4]+H[5]) / tot, head = (H[0]+H[1]) / tot;
      console.log('[3D·결·원인] 정렬 전 필드↔가닥 각차 (극성 확정 셀 ' + tot + '스텝, 평균 '
        + ((fieldAcc.polAngSum||0)/tot).toFixed(1) + '°)'
        + '  0-30°:' + H[0] + ' 30-60°:' + H[1] + ' 60-90°:' + H[2]
        + ' 90-120°:' + H[3] + ' 120-150°:' + H[4] + ' 150-180°:' + H[5]
        + ' → ' + (tail > 0.25 ? '뒤쪽에 몰림 = <b>극성</b> 문제(필드가 끝 방향을 반대로 앎)'
                 : head > 0.6  ? '앞쪽 한 봉우리 = <b>기하</b> 문제(두 리프트가 체계적으로 어긋남) — 극성 아님'
                 : '분포가 퍼짐 = 필드 자체가 흐림(coherence·뷰 신뢰도 쪽을 볼 것)'));
    }
    window._lastField3D = { cells: field3D.filled, obs: field3D.obs, perView: field3D.perView,
      meanCoh: +field3D.meanCoh.toFixed(3), steps: fieldAcc.n, hit: fieldAcc.hit,
      meanTurnDeg: fieldAcc.turnN ? +(fieldAcc.turn/fieldAcc.turnN*180/Math.PI).toFixed(2) : 0 };
  }
  /* [진단] 세그멘테이션 다듬기가 실제로 먹었는지. 이 세 숫자로 문턱을 판단한다:
       · 버림 0 · 자름 0  → 필드가 아무 일도 안 함(occThr가 너무 낮거나 프로브 실패)
       · 버림이 과하게 큼 → 마스크·포즈가 어긋나 실제 있는 머리를 지우는 중.
         그때는 occThr를 내리거나 offRun을 키울 것(둘 다 관대해지는 방향). */
  if(occProbe){
    const occField = buildOccupancyCellField(occProbe, hullW, hullD, bucketOfY, CY, b);
    const kept = canonicalStrands.length;
    console.log('[3D·세그] 세그멘테이션 다듬기 — 가닥 ' + total + '개 중 버림 ' + occAcc.dropped
      + '개 · 중간에서 자름 ' + occAcc.trimmed + '개(평균 '
      + (occAcc.trimmed ? (occAcc.removedPts/occAcc.trimmed).toFixed(1) : '0') + '점 제거)'
      + ' → 남은 가닥 ' + kept + '개 · 판정 ' + occAcc.n + '회'
      + (occField ? (' · 표면셀 머리있음 ' + occField.hairCells + '/' + occField.filled
          + (occField.grazing ? ' · <b>스쳐만 봐서 보류 ' + occField.grazing + '셀</b>(대부분 정수리 — 지우지 않고 통과시킴)' : '')) : ''));
    if(_grazingAbstain){
      console.log('[3D·정수리 보류] 스친 표만 있어 "머리 없음" 판정을 보류한 프로브 ' + _grazingAbstain + '회'
        + ' (기준: 제일 잘 본 뷰의 정면성 ≥ ' + HAIR_OCC3D.confidentFacing + ')'
        + ' — 이 숫자가 0이면 정수리가 비는 원인은 다른 데 있습니다.'
        + ' HAIR_OCC3D.confidentFacing=0 으로 두면 예전 동작.');
      _grazingAbstain = 0;
    }
    state.hairOcc3D = { probe: occProbe, field: occField, yTop, CY };
    /* (2026-08-01) 뿌리 밀도 격자 — 같은 프로브·같은 격자로 한 번 더 굽는다.
       마네킹 모드가 볼 자산이고, 사진 렌더도 나중에 여기서 밀도를 가져갈 수 있다. */
    try{
      // (2026-08-03) 위에서 이미 구운 격자를 그대로 쓴다 — 겹침 정리가 먼저 써야 해서
      // 앞으로 옮겼다. 두 번 굽지 않는다(같은 프로브·같은 격자라 값도 같다).
      state.hairIdentity = buildHairIdentity(rootField, field3D || null);
    }catch(e){ console.warn('모발 프로필 통합 실패(무시):', e); }
    window._lastOcc3D = { views: occProbe.cams.map(c=>c.angle), dropped: occAcc.dropped,
      trimmed: occAcc.trimmed, kept, of: total, probes: occAcc.n,
      hairCells: occField ? occField.hairCells : 0, seenCells: occField ? occField.filled : 0 };
  }
  // (10차) 정규 3D 모델 stash — 조정 화면 되쏘기(projectHair3DToView)의 소스.
  // (2026-08-01) field를 함께 stash — 되쏘기·이식 쪽에서 결을 다시 참조할 수 있게.
  state.hair3D = { strands: canonicalStrands, viewCal, yTop, CY, field: field3D || null,
                   occ: (state.hairOcc3D && state.hairOcc3D.probe) ? state.hairOcc3D : null,
                   /* (2026-08-08) 마네킹 모델이 <b>같은 격자</b>에 심으려면 이 표들이 필요하다.
                      다시 재지 않고 여기서 그대로 물려준다 — 두 모델이 다른 두상을
                      쓰면 섹션도 밀도도 어긋난다. */
                   grid: { hullW, hullD, yTopH, yBot, NY },
                   roots: rootField || null };
  state.hairField3D = field3D || null;
  return total > 0 ? group : null;
}

