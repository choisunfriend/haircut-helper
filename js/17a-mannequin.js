/* ══════════════════════════════════════════════════════════
   17a-mannequin.js — 마네킹 헤어 · 마네킹 앞머리 · 얼굴 프로필 · 시술모드
   원본 index.html 26569~27618행. 클래식 스크립트이므로 로드 순서가 곧
   실행 순서다 — index.html의 <script src> 순서를 바꾸지 말 것.
   ══════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════════
   마네킹 헤어 — 촬영 가닥을 쓰지 않고 <b>새로 심는다</b> (2026-08-08)
   ─────────────────────────────────────────────────────────────────
   촬영 가닥 모델은 가닥 하나하나의 모양·길이·존재 여부가 전부 그 사진의
   세그멘테이션 결과다. 그래서 길이를 늘리면 추적 경로가 향하던 방향으로 뻗고
   (얼굴을 가로지르고), 뷰마다 다른 자리에서 없던 게 튀어나온다.

   마네킹 모델은 사진에서 <b>특성만</b> 가져온다:
     · 뿌리 — 실측 뿌리밀도 격자(rootField.den)에 <b>면적 비례</b>로 심는다.
              밀도 0인 셀(헤어라인 아래·대머리)에는 아예 안 심으므로 헤어라인이
              실측 그대로 나온다. 총 개수는 촬영 모델과 같게 맞춘다.
     · 섹션 — 뿌리의 3D 위치로 resolveSection3D. 뷰와 무관하게 딱 나뉜다.
     · 길이 — 그 섹션 촬영 가닥 호길이의 <b>중앙값</b>(사용자 선택: 고객 실측 길이).
     · 모양 — 두피 법선으로 나와 rootRamp 구간에서 중력으로 넘어가고, 두상에
              닿으면 타원체 표면으로 밀려 미끄러진다(사용자 선택).
     · 색   — 그 섹션 촬영 가닥의 실측 색에서 뽑는다.
   컬은 0이다 — 초기화 상태니까. 펌은 이 위에 얹는다.

   지어낸 상수: rootRamp / clearance / segments 셋뿐이고, 길이·밀도·색·섹션·
   두상 반경은 전부 실측에서 온다.
══════════════════════════════════════════════════════════════════ */
const MANNEQUIN = {
  on: false,
  segments: 22,      // 가닥당 마디 수(촬영 가닥의 점 수와 비슷한 수준)
  /* 뿌리에서 법선 → 중력으로 넘어가는 구간. (2026-08-09) <b>길이 비율에서
     고정 거리로</b> 바뀌었다 — 거리는 실측 모발 두께(헐−두피)를 그대로 쓴다.
     rootRampMax는 그 두께가 가닥 길이보다 클 때(아주 짧은 커트)의 상한일 뿐. */
  rootRampMax: 0.25,
  clearance: 1.004,  // 두피에서 살짝 띄워 시작(정확히 표면이면 첫 밀어냄이 불안정)
  /* 섹션 길이 = 촬영 가닥 호길이의 이 백분위 (2026-08-09: 0.5 중앙값 → 1.0 최댓값)
     사용자 지정. 이유가 <b>시술의 방향성</b>에 있다: 커트는 <b>빼는</b> 일이다.
     중앙값으로 심으면 그 섹션 가닥의 절반이 손님 실제 머리보다 짧게 시작하고,
     그 부족분은 커트로 되돌릴 수 없다(늘리는 건 자르기가 아니고, 실제로
     CUT3D.maxRatio가 1.8에서 막는다). 그래서 역산이 슬라이더 상한에 붙었다 —
     실기기에서 crown 100(오차 24.9%)이 정확히 그 모습이었다.
     최댓값으로 심으면 모든 가닥이 <b>실측 최장</b>에서 시작하므로 어떤 목표
     길이든 빼기만으로 도달한다. 마네킹 초기 상태가 "아직 안 자른 머리"라는
     정의와도 맞는다. 대가는 초기 길이가 실제보다 길어 보이는 것인데, 시술
     전 상태라 그게 맞다. */
  lenPct: 1.0,
  minLen: 0.02,
  baldDen: 0.08,     // 이보다 밀도가 낮은 셀은 안 심는다(HAIR_OVERLAP과 같은 기준)
  layerLo: 0.15, layerHi: 1.0,  // 가닥이 타고 흐르는 껍질 위치(모발 두께 안)
  spread: 0.7,       // 두상에 닿아 있는 동안 바깥으로 퍼지는 정도(정수리 갇힘 방지)
};
/* ══════════════════════════════════════════════════════════════════
   마네킹 앞머리 — <b>심을 게 없으면 프론트·크라운에서 내린다</b> (2026-09-02 3차)
   ─────────────────────────────────────────────────────────────────
   사용자: "앞머리 심긴 거 <b>거꾸로</b> 된 거부터 고쳐. … 원래 헤어라인 따라서
   심어야 되는 건 심고, <b>심을 게 없으면 프론트와 크라운 섹션에서 일부 앞머리로
   내려줘</b>."

   ── 화면에 보이던 게 <b>앞머리가 아니었다</b> ────────────────────────────
   눈두덩 위에 뜬 두 개의 쐐기는 심긴 앞머리가 아니라 <b>뿌리 없는 꼬리 토막</b>이다.
   이마를 지나는 구간이 잘려 나가고, 옆머리 높이에서 사진 마스크가 1인 자리만
   남아 그 조각이 공중에 떠 있었다. 그래서 방향이 뿌리→끝이 아니라 끝만 보여
   <b>거꾸로</b>로 보이고 본체와 따로 놀았다. 즉 고칠 것은 "뒤집힌 가닥"이 아니라
   <b>애초에 앞머리가 없다</b>는 것이다.

   ── 왜 없었나: 이 손님은 <b>앞머리가 없다</b> ───────────────────────────
   원본 사진이 이마가 드러난 가르마 머리다. 마네킹 뿌리는 실측 밀도 격자
   (rf.den > baldDen)로 심으므로 헤어라인 위에만 심긴다 — <b>여기까지는 맞다</b>
   (헤어라인이 실측 그대로 나오는 근거가 이것이라 안 건드린다). 문제는 그 뿌리에서
   난 가닥이 이마 앞으로 <b>못 내려간다</b>는 것이고, 막는 문턱이 셋이었다:
     ① _adjGeometry 재클립의 growAboveY = CY — 여유를 <b>눈 위까지만</b> 준다
     ② trimStrandToOccupancy3D의 faceVeto — "머리는 늘어나도 얼굴은 못 덮는다"
     ③ buildHairClipMask — 늘림 여유에서 <b>얼굴 타원을 destination-out</b>
   하나만 열면 다른 데서 다시 잘린다. mannequinClipGrowPx 주석이 이미 그 경고를
   적어 뒀다("두 클립이 다른 폭을 열면 3D에서 살아남은 앞머리가 화면에서 다시
   지워져 아무것도 안 바뀐 것처럼 보인다"). 그래서 <b>셋 다</b> 연다 — 단
   fringe 표시가 붙은 가닥에만. 나머지 가닥의 동작은 비트 단위로 그대로다.

   ── "심을 게 없으면"을 <b>재서</b> 정한다 ──────────────────────────────
   손님에게 이미 앞머리가 있으면 이 연산자는 <b>돌면 안 된다</b>(있는 머리 위에
   또 얹으면 숱만 두 배가 된다). 판정은 지어내지 않고 이미 있는 점유 프로브에
   묻는다 — 이마 앞면을 표본으로 훑어 occ ≥ occThr인 비율이 haveFringeFrac을
   넘으면 "이미 있다"로 보고 아무것도 안 심는다. 새 측정기가 아니라 리프트가
   쓰는 그 프로브다(작업원칙 1).

   ── 지어낸 값 셋 (전부 <b>초안</b> — tipAt과 같은 자격) ────────────────
   · tipFaceFrac 0.35 — 끝이 눈→턱의 35% 지점, 곧 <b>광대</b>(사용자 지정).
     자는 makeFaceProjector와 같다(눈 y=CY, 턱 y=CY−0.70·heightFactor).
   · frontFrac 0.60 / crownFrac 0.15 — 내릴 뿌리의 비율. 시스루 뱅이 아니라
     보통 뱅 기준이고, 크라운은 헤어라인에 가까운 앞쪽 띠만 걸린다.
   · bulge 0.35 — 이마에서 앞으로 뜨는 정도. 0이면 이마에 달라붙어 두피에
     칠한 것처럼 보이고, 크게 하면 차양처럼 뜬다.
   되돌리기: MQ_FRINGE.on = false (①②③ 면제가 한꺼번에 닫히고 예전 그림) */
const MQ_FRINGE = {
  on: true,
  /* 끝 높이 = 눈에서 눈→턱의 이 비율만큼 아래.
     (2026-09-02 4차) 0.35(광대) → <b>0</b>(눈높이). 사용자: "눈높이 정도에서
     일자로 되게 정리해줘." 자는 그대로 makeFaceProjector(EYE = CY)다. */
  tipFaceFrac:    0.0,
  /* 앞머리 라인을 <b>가닥 종류와 무관하게</b> 먹인다 (2026-09-02 4차).
     화면에 남아 있던 "중간의 긴 머리"는 앞머리 가닥이 아니었다 — 앞머리로
     안 뽑힌 나머지 40%가 growMannequinStrand로 두상을 타고 내려와 얼굴 앞을
     가로질러 턱 밑까지 떨어진 것이다. 앞머리만 눈높이에 맞추면 그 옆으로
     안 잘린 가닥이 계속 흘러내려 <b>일자가 안 된다</b>. 실제 시술도 뱅은
     "뽑은 가닥만"이 아니라 <b>그 선을 넘는 것 전부</b>를 자른다.
     lineHalfX: 얼굴 앞을 지나는가의 판정 폭(두상 반너비 대비). 이보다 바깥은
     옆머리 커튼이라 안 건드린다. */
  lineHalfX:      0.95,
  /* 앞머리 선의 <b>길이 감도</b>와 <b>바닥</b> (2026-09-02 6차).
     · lineGain — 선이 중립(눈높이)에서 벗어나는 폭. 1.0이면 5차 그대로인데
       실기기에서 상단이 인중까지 내려왔다(사용자: "길이값 최고로 하면 얼굴
       사라지는 건 여전"). 비율 자체를 건드리면 커트 길이가 같이 바뀌므로
       <b>선에만</b> 감쇠를 건다 — 머리는 길어지되 앞머리가 얼굴을 삼키지 않는다.
     · lineFloorFaceFrac — 선이 내려갈 수 있는 최저. 눈에서 눈→턱의 이 비율.
       0.40은 대략 <b>코끝</b>이다. 이 아래로는 앞머리가 아니라 커튼이 된다.
       감마가 아니라 <b>하드 클램프</b>인 이유: 감마는 어디서 멈추는지 모르고,
       여기서 알아야 하는 것은 정확히 "얼굴이 남는가"다.
     되돌리기: lineGain = 1, lineFloorFaceFrac = 0 (5차 동작) */
  lineGain:          0.75,
  lineFloorFaceFrac: 0.40,
  /* ── 크라운은 <b>자기 선</b>을 쓴다 · 눈썹 (2026-09-05 사용자 지시) ─────────
     사용자: "마네킹모드에서 크라운 섹션 헤어가닥이 너무 내려와 있는데, 눈썹
     높이 정도로 조정해줘."
     지금까지 선은 <b>하나</b>였다(프론트가 주인, 크라운 지분 0.20 — fringeLineY
     배너). 그래서 크라운 가닥이 프론트와 같은 눈높이까지 내려왔고, 뿌리가 더
     뒤에 있는 만큼 얼굴 앞을 <b>길게</b> 가로질러 화면에서 제일 무겁게 보인다.
     실제 시술도 크라운을 앞으로 당겨 자를 때는 프론트보다 <b>짧게</b> 둔다 —
     그래야 위층이 뜨고 앞머리에 층이 생긴다. 그래서 크라운만 선을 하나 더 긋는다.
     ⚠ "일자가 깨진다"는 fringeLineY의 경고는 <b>여전히 유효</b>하다. 그건
       가닥마다 제 비율을 쓰지 말라는 말이고, 여기서 늘어난 선은 <b>섹션당
       하나</b>다(프론트 한 줄 · 크라운 한 줄). 프론트끼리는 여전히 일자다.
     · crownLine    — 끄면 예전처럼 프론트와 한 선을 쓴다(되돌리기 스위치)
     · crownRiseFrac 0.18 — 눈(CY)에서 <b>위로</b> E.b의 이 비율 = 눈썹.
       새 자가 아니라 mannequinHasFringe가 이미 쓰던 yBrow의 그 값이다
       (이제 양쪽이 mqBrowY 하나를 본다 — 두 벌이 되지 않게).
     · crownAllAround — <b>크라운은 앞머리만이 아니다</b>(2026-09-05 2차 지시:
       "크라운은 앞머리만 말하는 게 아니야. 크라운 전체적으로 눈썹라인 위로").
       1차에서는 선을 그어 놓고 <b>얼굴 앞을 지나는 가닥만</b> 잘랐다
       (mqTrimAtFringeLine의 c.z > faceZ · |x| ≤ halfX 게이트). 그래서 크라운
       중에서도 관자 옆이나 뒤로 흘러내린 가닥은 그대로 남아, 화면에서는
       "크라운이 여전히 길다"로 보인다 — 선은 걸렸는데 <b>절반에만</b> 걸린 것이다.
       이 스위치를 켜면 크라운 가닥은 방향을 안 보고 눈썹 선에서 잘린다.
       ⚠ 뒤로 떨어지는 크라운도 같이 잘린다 — 크라운 섹션이 통째로 <b>눈썹 위
         길이</b>가 된다는 뜻이고, 그게 이번 지시다. 뒤는 남기고 싶어지면 이
         스위치를 끄면 1차(얼굴 앞만) 동작으로 돌아간다.
     · crownFloorBrow — 크라운 선이 <b>눈썹 밑으로는 안 내려간다</b>. 길이
       슬라이더를 최대로 올려도 마찬가지다("눈썹라인 위로"가 상한이 아니라
       <b>경계</b>라는 뜻). 짧게 줄이는 쪽은 그대로 살아 있어 헤어라인까지
       올라간다 — 슬라이더 전 구간이 죽지 않는다(3차의 실패를 안 되풀이한다). */
  crownLine:          true,
  crownRiseFrac:      0.18,
  crownAllAround:     true,
  crownFloorBrow:     true,
  frontFrac:      0.60,   // front 뿌리 중 앞머리로 내릴 비율
  crownFrac:      0.15,   // crown 뿌리 중 앞머리로 내릴 비율
  crownThFrac:    0.60,   // crown은 |θ|가 thFront의 이 배 안(=앞쪽 띠)일 때만 후보
  bulge:          0.35,   // 이마 앞으로 뜨는 정도(뿌리~끝 거리 대비)
  converge:       1.00,   // 끝이 중앙 쪽으로 모이는 정도(1이면 안 모임)
  haveFringeFrac: 0.30,   // 이마 앞 표본 중 이 비율 이상이 "머리 있음"이면 안 심는다
  minLen:         0.05,   // 뿌리~끝 거리가 이보다 짧으면 앞머리로 안 친다
};
/* 이 손님에게 <b>이미 앞머리가 있는가</b>. 점유 프로브에 묻는다(새 자 없음).
   프로브가 없으면 null — 모르면 안 심는다(모르는 것을 지어내지 않는다). */
function mannequinHasFringe(src){
  const probe = (src && src.occ && src.occ.probe)
             || (state.hairOcc3D && state.hairOcc3D.probe) || null;
  if(!probe || !probe.at) return null;
  let E = null, S = null;
  try{ E = getHeadEllipsoid(); S = getScalpEllipsoid(); }catch(e){ return null; }
  if(!E || !S) return null;
  const CY = (src && src.CY != null) ? src.CY : SCALP_CENTER_Y;
  const yEye = CY;                                   // 이마 아래쪽 띠(눈썹~눈)
  const yBrow = mqBrowY(CY, E);
  if(yBrow == null) return null;                     // 눈썹 자를 못 세우면 모르는 것이다
  let n = 0, hit = 0;
  for(let iy=0; iy<3; iy++){
    const y = yEye + (yBrow - yEye) * (iy/2);
    const ny = Math.max(-1, Math.min(1, (y - CY) / E.b));
    const rz = E.c * Math.sqrt(Math.max(0, 1 - ny*ny));
    for(let ix=-2; ix<=2; ix++){
      const x = E.a * 0.30 * ix / 2;
      const r = probe.at(x, y, rz * 1.02);
      if(!r) continue;
      n++; if(r.occ >= HAIR_OCC3D.occThr) hit++;
    }
  }
  if(!n) return null;
  return (hit / n) >= MQ_FRINGE.haveFringeFrac;
}
/* 앞머리 끝이 올 모델 y — 눈(CY)에서 눈→턱의 tipFaceFrac만큼 아래.
   자는 makeFaceProjector와 <b>같은 것</b>을 쓴다(EYE=CY, 눈~턱=0.70·heightFactor).
   얼굴 계측을 못 얻으면 두상 높이 자로 폴백한다. */
function mqFringeTipY(CY){
  let faceH = null;
  try{ const fm = getFaceMetrics(); if(fm && fm.heightFactor > 0) faceH = 0.70 * fm.heightFactor; }catch(e){}
  if(!(faceH > 0)){
    try{ const E = getHeadEllipsoid(); if(E && E.b > 0) faceH = 0.70 * (E.b / 0.633); }catch(e){}
  }
  if(!(faceH > 0)) return null;
  const y = CY - MQ_FRINGE.tipFaceFrac * faceH;
  /* (2026-10-01 · 옛 31-hippie-wave-eyeguard ⓐ) 심는 앞머리 끝 — 스타일 스펙이 걸린 동안(마네킹)
     스타일이 정한 앞머리 길이(tipAt.front) 높이에 심는다. 프로필이 MQ_FRINGE.tipFaceFrac을 직접 정하면 그 값.
     스펙 목표를 못 읽으면 눈높이 대신 눈썹~윗눈꺼풀(EYE_GUARD.defaultTipFaceFrac). */
  if(!eyeGuardActive() || eyeGuardProfileSetsTip()) return y;
  const g = eyeGuardGeom();
  const t = eyeGuardFrontTarget();
  let ref = null;
  try{ ref = eyeGuardSafeHeadRef(); }catch(e){}
  if(t != null && ref) return ref.yTop - t * ref.H;
  return g ? CY - EYE_GUARD.defaultTipFaceFrac * g.fh : y;
}

/* ══ 앞머리 눈 가림 — EYE_GUARD · FACE_COVER_CHECK (2026-10-01 · 옛 31-hippie-wave-eyeguard.js) ══
   스타일 스펙을 적용하면 applyStyleSpecAndRender → mannequinReset()이 마네킹을 켜고 앞머리는 MQ_FRINGE 규칙으로
   심기/잘립니다. 여기서 네 가지가 겹쳐 앞머리가 눈을 덮었습니다.
     a. MQ_FRINGE.tipFaceFrac 기본값 0 = 심는 앞머리 끝이 "눈높이"(CY) 그 자체.          → mqFringeTipY(위)
     b. fringeLineY()의 바닥(lineFloorFaceFrac 0.4) = 눈 아래로 눈~턱의 40%까지 허용.
     c. 길이 역산(solveSectionLengthForTipY → measureSectionTipY → adjustStrandGeom) 동안 fringeLineY()가
        "시험 길이"가 아닌 state.sections[sec].length(이전 값)를 읽음 → 역산 때 본 선과 확정 길이로 다시 그린 선이
        달라 결과가 더 내려감.                                                           → adjustStrandGeom(17b)
     d. 스펙 tipAt.front 0.46~0.52 — headHeightRef 기준 0.5 = 두상 타원 중심 = 눈높이(눈썹 ≈ 0.41, 윗눈꺼풀 ≈ 0.465).
        즉 목표 자체가 눈 위/눈 한가운데였음.                                            → STYLE_TUNES(아래) · 24 applyStyleSpec
     + 역산 뒤에 도는 after(컬 줄이기)·sweep(앞으로 넘김)·gravityDroop이 끝을 더 내림.
   [2026-10-01 제거] 앞머리선 바닥 강제(fringeLineY 클램프)·눈 상자 트림(eyeBoxTrim)·front 옆선 상한 트림(frontSideCap).
     원칙: 렌더 단계에서 가닥을 몰래 자르지 않는다. 얼굴을 가리면 그 스타일의 길이(tipAt)·커트·가르마·넘김으로 고친다.
     대신 FACE_COVER_CHECK가 최종 가닥이 얼굴(눈 상자)에 들어가는지 세기만 하고 어느 섹션을 고칠지 알려준다
     (computeAdjustedHair3DStrands 끝 · 17b). */
var EYE_GUARD = {
  on: true,
  // 얼굴 계측 단위: faceH = 눈~턱 길이(_mqFaceH). 음수 = 눈 위.
  defaultTipFaceFrac: -0.14, // 프로필이 tipFaceFrac을 안 정했을 때 심는 앞머리 끝(눈썹과 윗눈꺼풀 사이)
  fixSolveLength: true,      // 역산 중 fringeLineY가 시험 길이를 쓰게(17b adjustStrandGeom)
  // 아래 값은 FACE_COVER_CHECK(검사 전용)가 쓰는 얼굴 상자 — 자르는 데 쓰지 않음
  boxTopFaceFrac: -0.06,     // 상자 윗선(윗눈꺼풀)
  boxBotFaceFrac: 0.3,       // 상자 아랫선(광대)
  boxHalfXFrac: 0.75,        // 얼굴 반폭 대비 상자 반폭
  zBackFrac: 0.22
};
/* 스타일별 수치 보정(데이터). 눈높이(0.5)에 걸려 있던 기존 스펙 목표를 눈썹~눈꺼풀로.
   제한이 아니라 스타일 값 자체를 고친 것 — 스타일 적용 때(24 applyStyleSpec) specPatch 뒤에 덮는다. */
var STYLE_TUNES = {
  layered_bob_hush:    { tipAt: { front: 0.45 } },  // 원래 0.52(specPatch)
  wavy_bob_seethrough: { tipAt: { front: 0.44 } },  // 원래 0.5
  side_part_perm:      { tipAt: { front: 0.43 } }   // 원래 0.46
};
/* 모든 스타일 공통 기본값(히피펌에서 효과 본 것) — 프로필이 직접 정하면 그 값이 우선. 스타일 적용 때 건다.
   · MANNEQUIN.lenPct 0.9 : 섹션 최장(어깨·옷 따라간 이상치) 대신 90백분위 → 긴 끄트머리 방지
   · MQ_FRINGE.crownAllAround false : 크라운을 뒤까지 눈썹선에서 자르지 않음 → 크라운 역산 "못 풂" 방지 */
var STYLE_COMMON_DEFAULTS = {
  on: true,
  MANNEQUIN: { lenPct: 0.9 },
  MQ_FRINGE: { crownAllAround: false }
};
/* 얼굴 가림 검사 — 스타일 적용 후 첫 최종 결과(computeAdjustedHair3DStrands)에서 한 번, 섹션별로 센다(자르지 않음) */
var FACE_COVER_CHECK = {
  on: true,
  warnFrac: 0.01,    // 섹션 가닥의 1% 넘게 들어가면 경고
  last: null,
  pendingId: null
};
/* headHeightRef()는 첫 줄에서 state.hair3Dneutral 게터를 읽는다. 마네킹이 비어 있으면 게터가 buildMannequinHair3D()를
   부르고, 빌드가 앞머리를 심느라 mqFringeTipY를 부르면 다시 headHeightRef → 게터 → 빌드 … 무한 재귀(사이드파트 멈춤의 원인).
   같은 식을 게터를 거치지 않고 계산한다(마네킹 CY = 원본 CY). */
function eyeGuardSafeHeadRef(){
  if(typeof state === 'undefined' || !state) return null;
  const h = state.hair3Dmannequin || state._hair3Dneutral;
  let E = null;
  try{ E = getHeadEllipsoid(); }catch(e){}
  if(!h || !E || !(E.b > 1e-6)) return null;
  const CY = h.CY != null ? h.CY : (typeof SCALP_CENTER_Y !== 'undefined' ? SCALP_CENTER_Y : 0.15);
  return { yTop: CY + E.b, H: 2 * E.b };
}
/* 스타일이 스스로 정한 앞머리 길이(tipAt.front). 적용 중이면 그 id(EYE_GUARD._applying), 아니면 걸린 스타일 */
function eyeGuardFrontTarget(){
  const id = EYE_GUARD._applying || (typeof state !== 'undefined' && state && state.specAppliedId) || null;
  let spec = null;
  try{ spec = id ? getStyleSpec(id) : null; }catch(e){}
  if(!spec || spec.eyeGuard === false || !spec.tipAt || typeof spec.tipAt.front !== 'number') return null;
  return spec.tipAt.front;
}
function eyeGuardActive(){ return EYE_GUARD.on && typeof MANNEQUIN !== 'undefined' && !!MANNEQUIN.on && eyeGuardFrontTarget() != null; }
function eyeGuardProfileSetsTip(){
  const p = window.STYLE_BASE && window.STYLE_BASE.active;
  return !!(p && p.config && p.config.MQ_FRINGE && typeof p.config.MQ_FRINGE.tipFaceFrac === 'number');
}
/* 얼굴 상자 기하 — 모델·얼굴 프로필이 바뀔 때만 다시 계산(EYE_GUARD._geo = null로 비움) */
function eyeGuardGeom(){
  if(typeof state === 'undefined' || !state) return null;
  const h = state._hair3Dneutral || null;
  let prof = null;
  try{ prof = typeof getFaceProfile === 'function' ? getFaceProfile() : null; }catch(e){}
  const memo = EYE_GUARD._geo;
  if(memo && memo.h === h && memo.prof === prof) return memo.v;
  let v = null;
  try{
    const E = getHeadEllipsoid();
    if(E && E.a > 0 && E.b > 0 && E.c > 0){
      const CY = h && isFinite(h.CY) ? h.CY : (typeof SCALP_CENTER_Y !== 'undefined' ? SCALP_CENTER_Y : 0.15);
      const fh = typeof _mqFaceH === 'function' ? _mqFaceH(CY, E) : E.b / 0.633 * 0.7;
      if(fh > 0){
        const halfX = prof && prof.halfX > 0 ? prof.halfX : E.a * 0.95;
        v = { E, CY, fh, prof,
              topY: CY - EYE_GUARD.boxTopFaceFrac * fh,
              botY: CY - EYE_GUARD.boxBotFaceFrac * fh,
              xHalf: halfX * EYE_GUARD.boxHalfXFrac,
              zBack: EYE_GUARD.zBackFrac * E.c };
      }
    }
  }catch(e){ v = null; }
  EYE_GUARD._geo = { h, prof, v };
  return v;
}
/* 가닥 하나가 얼굴 상자(윗눈꺼풀~광대, 눈 폭, 얼굴 앞)에 들어가는지 — 검사만 함 */
function eyeGuardCoversFace(pts, g){
  if(!pts || pts.length < 2 || !g) return false;
  for(let i=1; i<pts.length; i++){
    const p = pts[i];
    if(!(p.y < g.topY) || !(p.y > g.botY) || !(Math.abs(p.x) < g.xHalf)) continue;
    const zf = g.prof ? g.prof.zAt(p.y) : g.E.c;
    if(p.z > zf - g.zBack) return true;
  }
  return false;
}
/* 스타일 적용 때 공통 기본값을 건다(24 applyStyleSpec 앞) — 프로필이 정한 키는 건드리지 않음 */
function eyeGuardApplyCommonDefaults(id){
  const CD = STYLE_COMMON_DEFAULTS;
  if(!CD.on) return;
  const sb = window.STYLE_BASE, cfg = (sb && sb.active && sb.active.config) || {};
  const tgt = { MANNEQUIN: typeof MANNEQUIN !== 'undefined' ? MANNEQUIN : null,
                MQ_FRINGE: typeof MQ_FRINGE !== 'undefined' ? MQ_FRINGE : null };
  let rebuild = false; const set = [];
  for(const obj in tgt){
    if(!tgt[obj] || !CD[obj]) continue;
    for(const key in CD[obj]){
      if(cfg[obj] && key in cfg[obj]) continue;          // 프로필이 정함
      if(tgt[obj][key] === CD[obj][key]) continue;
      tgt[obj][key] = CD[obj][key];
      set.push(obj + '.' + key + '=' + CD[obj][key]);
      if(obj === 'MANNEQUIN') rebuild = true;           // 길이 원료가 바뀜 → 뿌리 다시 심기
    }
  }
  if(rebuild && typeof state !== 'undefined' && state) state.hair3Dmannequin = null;
  if(set.length) console.log('[앞머리 길이] 공통 기본값 ' + id + ': ' + set.join(' · ') + ' (끄기 STYLE_COMMON_DEFAULTS.on=false)');
}
/* 얼굴 가림 검사 — computeAdjustedHair3DStrands(17b) 끝에서 부른다 */
function faceCoverCheck(out){
  if(!FACE_COVER_CHECK.on || !FACE_COVER_CHECK.pendingId || !out || !out.length) return;
  const id = FACE_COVER_CHECK.pendingId;
  FACE_COVER_CHECK.pendingId = null;          // 스타일 적용 후 첫 최종 결과에서 한 번만
  try{
    const g = eyeGuardGeom();
    if(!g) return;
    const by = {}, n = {};
    for(let i=0; i<out.length; i++){
      const sgm = out[i], sec = sgm.sec || '?';
      n[sec] = (n[sec] || 0) + 1;
      if(eyeGuardCoversFace(sgm.pts, g)) by[sec] = (by[sec] || 0) + 1;
    }
    const bad = [];
    for(const k in by) if(by[k] / n[k] > FACE_COVER_CHECK.warnFrac) bad.push(k + ' ' + by[k] + '/' + n[k]);
    FACE_COVER_CHECK.last = { id, by, n, bad, at: Date.now() };
    if(bad.length) console.warn('[얼굴 가림] ' + id + ' — 얼굴을 덮는 섹션: ' + bad.join(' · ') +
      '\n    → 자르지 않았습니다. 이 스타일 스펙에서 해당 섹션의 tipAt을 줄이거나(짧게),' +
      ' 가르마(partAmt)·넘김(sweep)·curlDir·overdirection으로 얼굴 밖으로 보내세요.');
    else console.log('[얼굴 가림] ' + id + ' — 얼굴 가림 없음');
  }catch(e){ console.warn('[얼굴 가림] 검사 실패', e); }
}
/* ── 얼굴 비우기 (2026-10-13) ──────────────────────────────────────────────
   사용자(영상 19:30, 긴 곱슬 · 마네킹 초기화 OFF = 원본 머리): "마네킨 모드 안 한 뒤로 계속 가닥이랑 얼굴에 가시같이 생겨."
   원본 머리는 사진에서 읽은 가닥 모양을 마네킹 뿌리로 옮겨 심는데(READ_SHAPE), 옆머리 뿌리가 가까운 앞쪽 가닥 모양을 받으면
   그 길이 얼굴 앞을 가로지릅니다. 위 EYE_GUARD는 스타일이 정한 앞머리 길이에만 걸리고, 원본 머리에는 걸리는 장치가 없었습니다.
   고침: 얼굴 상자(눈썹~턱 · 얼굴 폭 · 얼굴 앞면) 안으로 들어간 가닥은 그 가닥을 통째로 옆으로 밀어 얼굴 밖에 둡니다
   (자르지 않음 · 들어가기 전 몇 점은 서서히 따라 밀어서 꺾이지 않게). 원본 머리일 때만(등록 스타일은 앞머리를 스펙이 정함 — EYE_GUARD 몫).
   자리: computeAdjustedHair3DStrands(17b) 어깨 단계 다음. 끄기 FACE_CLEAR.on=false */
var FACE_CLEAR = {
  on: true,
  topFaceFrac: -0.28,   // 상자 윗선 = 눈썹 근처(얼굴 단위 faceH = 눈~턱, 음수 = 눈 위) — 짧은 앞머리는 이 위에서 끝남
  botFaceFrac: 1.0,     // 상자 아랫선 = 턱
  halfXFrac: 0.8,       // 얼굴 반폭 대비 상자 반폭
  zBackFrac: 0.3,       // 얼굴 앞면에서 이만큼 안쪽까지를 "얼굴 앞"으로 봄(타원체 c 대비)
  ramp: 4,              // 들어가기 전 이 점 수만큼 서서히 밀기
  stats: { strands: 0, moved: 0 }
};
function faceClearGeom(){
  const g = eyeGuardGeom();
  if(!g) return null;
  const halfX = g.prof && g.prof.halfX > 0 ? g.prof.halfX : g.E.a * 0.95;
  return { E: g.E, prof: g.prof,
           topY: g.CY - FACE_CLEAR.topFaceFrac * g.fh, botY: g.CY - FACE_CLEAR.botFaceFrac * g.fh,
           xHalf: halfX * FACE_CLEAR.halfXFrac, zBack: FACE_CLEAR.zBackFrac * g.E.c };
}
function faceClearAll(out){
  if(!FACE_CLEAR.on || !out || !out.length) return out;
  // 원본 머리일 때만 — 마네킹 + 잰 값(58 ORIG_MQ의 '__original__') 또는 마네킹 OFF(다시 기른 사진 가닥).
  // 등록 스타일은 앞머리 길이를 스펙이 정하므로(EYE_GUARD 몫) 건드리지 않음.
  let orig = false;
  try{ orig = state.specAppliedId === '__original__' || (typeof MANNEQUIN !== 'undefined' && !MANNEQUIN.on); }catch(e){ orig = false; }
  if(!orig) return out;
  let g = null;
  try{ g = faceClearGeom(); }catch(e){ g = null; }
  if(!g) return out;
  let res = null, moved = 0;
  for(let i=0; i<out.length; i++){
    const sgm = out[i], p = sgm && sgm.pts;
    if(!p || p.length < 2) continue;
    // 뿌리 쪽으로 비킴 — 얼굴 상자에 들어간 점이 모두 그쪽 경계 밖에 오도록 가닥을 통째로 옆으로(모양은 그대로)
    const side = p[0].x < 0 ? -1 : 1;
    let need = 0, first = -1;
    for(let k=1; k<p.length; k++){
      const q = p[k];
      if(!(q.y < g.topY) || !(q.y > g.botY) || !(Math.abs(q.x) < g.xHalf)) continue;
      const zf = g.prof ? g.prof.zAt(q.y) : g.E.c;
      if(!(q.z > zf - g.zBack)) continue;
      if(first < 0) first = k;
      const d = side > 0 ? g.xHalf - q.x : q.x + g.xHalf;
      if(d > need) need = d;
    }
    if(first < 0) continue;
    const np = p.slice(), r0 = Math.max(1, first - FACE_CLEAR.ramp);
    for(let k=r0; k<np.length; k++){
      const w = k >= first ? 1 : (k - r0 + 1) / (first - r0 + 1);
      const s2 = w * w * (3 - 2 * w), q = np[k];
      np[k] = { x: q.x + side * need * s2, y: q.y, z: q.z };
    }
    if(!res) res = out.slice();
    res[i] = Object.assign({}, sgm, { pts: np });
    moved++;
  }
  FACE_CLEAR.stats.strands = out.length; FACE_CLEAR.stats.moved = moved;
  return res || out;
}
/* 눈썹 높이 — 이 파일의 <b>유일한</b> 눈썹 자. 원래 mannequinHasFringe가 이마
   표본을 뜨려고 안에서 쓰던 식(CY + 0.18·E.b)을 그대로 꺼낸 것이고, 이제
   크라운 앞머리 선도 같은 것을 본다. 자가 두 벌이 되면 "눈썹"이 화면 두 군데서
   다른 높이가 된다 — 그래서 상수까지 MQ_FRINGE로 올렸다. */
function mqBrowY(CY, E){
  if(!E || !(E.b > 0)) return null;
  return CY + MQ_FRINGE.crownRiseFrac * E.b;
}
/* 크라운 앞머리 끝이 올 모델 y — 중립(길이비율 1)에서 <b>눈썹</b>.
   크라운 선을 끄면 프론트와 같은 tip(눈높이)으로 떨어진다. */
function mqCrownTipY(CY, E){
  if(!MQ_FRINGE.crownLine) return mqFringeTipY(CY);
  const y = mqBrowY(CY, E);
  return (y != null) ? y : mqFringeTipY(CY);
}
/* 이 뿌리를 앞머리로 내릴 것인가. 결정적 해시라 다시 심어도 같은 가닥이 걸린다. */
function mqFringePicks(rp, sec, ci, k){
  if(!MQ_FRINGE.on) return false;
  const th = Math.abs(Math.atan2(rp.x, rp.z));
  let frac = 0;
  if(sec === 'front') frac = MQ_FRINGE.frontFrac;
  else if(sec === 'crown' && th <= SECTION_CUT.thFront * MQ_FRINGE.crownThFrac) frac = MQ_FRINGE.crownFrac;
  if(!(frac > 0)) return false;
  return hashFract(ci * 0.6180339887 + k * 0.7548776662 + 3.71) < frac;
}
/* 앞머리 한 가닥 — 뿌리(헤어라인)에서 <b>이마 앞으로 넘겨</b> 광대까지 내린다.
   ── 왜 growMannequinStrand를 안 쓰나 ─────────────────────────────────
   저쪽은 "법선으로 조금 나갔다가 중력, 두상에 닿으면 타원체로 밀어내기"다.
   이마에서 그 규칙을 그대로 돌리면 가닥이 <b>두개골 표면을 타고</b> 내려가
   얼굴 안쪽으로 들어간다(그리고 그 자리는 사진에 머리가 없어 통째로 잘린다).
   실제 뱅은 두피에서 나와 <b>이마를 타지 않고 앞으로 떨어진다</b> — 그래서
   밀어내기를 안 쓰고 뿌리→끝 곡선을 직접 그린다.
   길이는 그 섹션 실측 호길이 L에서 <b>못 넘어간다</b> — 커트는 빼는 일이고,
   없는 길이를 만들지 않는다(MANNEQUIN.lenPct 주석과 같은 규칙). */
function growFringeStrand(rp, d0, tipY, L, colors){
  const F = MQ_FRINGE, N = MANNEQUIN.segments;
  if(!(tipY != null) || !(L > F.minLen)) return null;
  const drop = rp.y - tipY;
  if(!(drop > F.minLen)) return null;                       // 뿌리가 이미 광대 아래
  const end = { x: rp.x * F.converge, y: tipY, z: Math.abs(rp.z) + drop * F.bulge };
  const span = Math.hypot(end.x-rp.x, end.y-rp.y, end.z-rp.z);
  if(!(span > 1e-6)) return null;
  /* 뿌리에서 <b>두피 법선</b>으로 나가다 끝점 쪽으로 눕는다 — 뿌리 각도가
     두피와 이어져야 "심긴" 것으로 보인다(안 그러면 또 뿌리 없는 토막이 된다). */
  /* ── 법선 들림에서 <b>세로 성분을 뺀다</b> (하네스가 잡았다) ────────────────
     뿌리에서 두피 법선으로 나가게 두면, 이마 헤어라인의 법선은 <b>앞 + 위</b>라
     첫 마디가 뿌리보다 <b>올라간다</b>. 그러면 가닥이 위로 갔다 내려오고,
     그게 화면에서 정확히 사용자가 말한 <b>"거꾸로"</b>로 보인다 — 고치려던
     증상을 작게 다시 만드는 셈이다. 뱅이 두피에서 나오는 방향은 위가 아니라
     <b>앞</b>이므로 법선의 가로·깊이 성분만 쓴다(세로는 중력이 정한다).
     ⚠ 눈으로는 못 잡았을 자리다. 단조 검사가 잡았다. */
  const nh = Math.hypot(d0.x, d0.z);
  const dOut = (nh > 1e-6) ? { x: d0.x/nh, y: 0, z: d0.z/nh } : { x: 0, y: 0, z: 1 };
  const build = (reach)=>{
    const out = [{ x: rp.x, y: rp.y, z: rp.z }];
    for(let i=1;i<=N;i++){
      const t = (i/N) * reach;
      const e = t*t*(3 - 2*t);                              // 부드러운 눕힘
      const ramp = Math.min(1, t*3);
      const bx = rp.x + (end.x-rp.x)*e, by = rp.y + (end.y-rp.y)*e, bz = rp.z + (end.z-rp.z)*e;
      const nOut = span * 0.10 * (1-e) * ramp;              // 뿌리 쪽만 앞으로 살짝 들림
      out.push({ x: bx + dOut.x*nOut, y: by, z: bz + dOut.z*nOut });
    }
    return out;
  };
  let reach = Math.min(1, L / span);                        // 실측 길이가 모자라면 덜 내려온다
  let pts = build(reach);
  /* 앞으로 부푼 몫이 호길이에 얹히므로 span만으로는 <b>실측 길이를 넘을 수 있다</b>
     (하네스: 0.306 vs 0.297). 한 번 재서 그만큼 당긴다 — 커트는 빼는 일이고,
     없는 길이를 만들지 않는다(MANNEQUIN.lenPct 주석과 같은 규칙). */
  const arc0 = arcLength3D(pts);
  if(arc0 > L && arc0 > 1e-9) pts = build(reach * (L / arc0));
  const color = (colors && colors.length) ? colors[(_mqRand()*colors.length)|0] : '#2B2320';
  return { pts, sec: null, color, srcAngle: null, rootFacing: 0, mannequin: true, fringe: true };
}
/* ══════════════════════════════════════════════════════════════════
   얼굴 프로필 — <b>측면 사진의 얼굴선</b> (2026-09-03)
   ─────────────────────────────────────────────────────────────────
   사용자: \"코앞을 지나는 라인이 하나 설정되어 있는데 그게 잘못설정된 거 같아.
   2D측면사진의 얼굴라인(두상타원이 아닌)을 확인해서 그 라인으로 새로 지정해야 돼.\"
   맞다. mqTrimAtFringeLine의 \"얼굴 앞인가\" 판정은 두 인자 <b>둘 다 두상 타원</b>이었다:
     · Math.abs(c.x) > halfX — halfX = E.a × 0.95, 곧 <b>헐</b>(머리카락 겉면)의
       반너비다. 파일 실측이 그대로 말한다: 헐 a=0.704 vs <b>얼굴 실측 0.503</b>
       (한쪽당 2.8cm). 0.95를 곱해도 얼굴보다 33% 넓다.
     · c.z > 0 — 기준면이 <b>두상 중심</b>이라 앞쪽 반구면 전부 \"얼굴 앞\"이다.
       실제 얼굴 표면은 z=0이 아니다([얼굴 입체감] 코끝 0.639 · 이마 0.285,
       두상 깊이 c=0.541). 즉 선이 얼굴보다 <b>넓고 얕게</b> 서 있었다.
   그래서 관자놀이 옆 커튼과 반대쪽 사이드가 같이 잘리는데 정작 코앞은 못 지킨다.

   ── 자를 어디서 가져오나: <b>이미 있는 것만</b> ───────────────────────────
   측면 사진에서는 앞뒤 깊이가 이미지의 좌우 위치로 <b>직접</b> 나타난다. 이
   원리와 그 구현(projectImagePointToHead)은 이 파일이 헤어 뿌리에 이미 쓰고
   있다. 새로 만드는 것은 없고, 정중선(midsagittal) 랜드마크를 그 함수에 통과
   시켜 \"높이 → 얼굴 앞면 z\" 곡선 하나로 모을 뿐이다.
   ⚠ 깊이맵(computeFullProfileDepthMap)은 <b>안 쓴다</b>(사용자 지시 — 필요한지
     확인하고 쓴다). 그건 async·정면 사진 의존이라 이 경로가 그 실패 모드를
     떠안게 된다. 여기서 필요한 건 468정점이 아니라 <b>선 하나</b>다.

   ── 정직한 한계 ──────────────────────────────────────────────────────
   측면이 덜 돌아간 사진에서는 projectImagePointToHead가 사실상 <b>두상 타원면</b>을
   돌려준다(PROFILE_YAW_GATE 배너가 재어 둔 그것 — 이 손님 right는 yaw 40.9°다).
   그래도 지금보다 낫다: 그때도 선이 z=0(중심면)이 아니라 <b>표면</b>에 서기
   때문이다. 코 돌출까지 살아나는 건 각도가 충분할 때다. 그러니 이 곡선은
   \"실측이면 실측, 아니면 타원면\"이고 어느 쪽인지 진단에 찍는다 — 좋아 보이는데
   실은 타원면이더라, 를 나중에 못 가리면 안 된다.
   되돌리기: FACE_PROFILE.on = false (c.z > 0 · halfX = E.a×lineHalfX 그대로) */
const FACE_PROFILE = {
  on: true,
  /* MediaPipe 정중선 정점 — <b>추측하지 않는다</b>. 이마(10)·미간(168)·코끝(1)·
     턱(152)은 이 파일이 detectFaceLandmarks/PROFILE_DEPTH_ANCHORS에서 이미
     쓰는 검증된 인덱스이고, 나머지는 그 사이를 잇는 같은 정중선 위의 점이다. */
  midline: [10, 151, 9, 8, 168, 6, 197, 195, 5, 4, 1, 19, 94, 2, 164, 0, 13, 14, 17, 18, 200, 199, 175, 152],
  bands: 12,        // 높이 구간 수 — 선 하나를 표현하는 데 이 이상은 잡음이다
  src: null,        // [진단] 'side'(실측) | 'ellipsoid'(폴백) | null
  n: 0,             // [진단] 실제로 곡선에 들어간 정점 수
};
let _faceProfileCache = null;
/* 이 손님의 얼굴 프로필. 반환 {zAt(meshY), halfX, src} — zAt은 그 높이에서
   얼굴 <b>앞면</b>의 두상 로컬 z. 못 만들면 null(호출부가 예전 동작).
   ⚠ 캐시 키를 state.landmarks <b>객체</b>로 잡으면 안 된다 — 그 객체는 한 번
     만들어지고 detectFaceLandmarks가 [angle]에 <b>제자리로</b> 채워 넣으므로
     참조가 영영 안 바뀐다. 재촬영해도 옛 프로필을 계속 쓰게 된다. 뷰별 lm
     객체는 매번 새로 만들어지므로 그 셋을 본다. */
function getFaceProfile(){
  if(!FACE_PROFILE.on) return null;
  const L = state.landmarks || {};
  const key = [L.left, L.right, L.front];
  if(_faceProfileCache && _faceProfileCache._key.every((o,i)=>o === key[i]))
    return _faceProfileCache.v;
  let v = null;
  try{ v = buildFaceProfile(); }catch(e){ v = null; }
  _faceProfileCache = { _key: key, v };
  return v;
}
function buildFaceProfile(){
  let fm; try{ fm = getFaceMetrics(); }catch(e){ return null; }
  if(!fm) return null;
  let E; try{ E = getHeadEllipsoid(); }catch(e){ return null; }
  if(!E || !(E.b > 0) || !(E.c > 0)) return null;
  const CY = 0.15;
  /* 폭 — 헐이 아니라 <b>얼굴</b>의 반너비. makeFaceProjector가 귀 반간격을
     메쉬 단위로 옮기는 그 식(EAR_MESH_X)이 곧 얼굴 자다. 두 벌이 되지 않도록
     상수를 다시 적지 않고 투영기에서 읽는다: 귀 x를 통과시키면 ±EAR_MESH_X다. */
  let faceHalfX = 0;
  try{
    const lmF = fm.lm, pr = fm.projector;
    if(lmF && pr && lmF.lEarX != null && lmF.rEarX != null){
      faceHalfX = Math.abs(pr.toMeshX(Math.max(lmF.lEarX, lmF.rEarX)));
    }
  }catch(e){}
  if(!(faceHalfX > 0)) faceHalfX = E.a * MQ_FRINGE.lineHalfX;   // 못 재면 예전 값

  // ── 측면 사진에서 정중선을 두상 좌표로 올린다 ──
  const yTop = CY + E.b, yBot = CY - E.b, span = Math.max(1e-6, yTop - yBot);
  const NB = Math.max(4, FACE_PROFILE.bands|0);
  const zMax = new Array(NB).fill(-Infinity);
  let nHit = 0;
  for(const angle of ['left','right']){
    const lmS = state.landmarks && state.landmarks[angle];
    if(!lmS || !lmS.rawLandmarks || lmS.rawLandmarks.length < 468) continue;
    let conf = 0; try{ conf = getViewPoseConfidence(angle); }catch(e){}
    if(conf < 0.5) continue;                     // 어림 각도로는 선을 안 긋는다
    for(const idx of FACE_PROFILE.midline){
      const p = lmS.rawLandmarks[idx];
      if(!p) continue;
      let w = null;
      try{ w = projectImagePointToHead(angle, p.x, p.y, fm.widthFactor, fm.heightFactor); }catch(e){}
      if(!w || !isFinite(w.z) || !isFinite(w.y)) continue;
      const b = Math.min(NB-1, Math.max(0, Math.floor((yTop - w.y) / span * NB)));
      /* 좌·우가 같은 높이를 보면 <b>더 앞</b>을 쓴다 — 얼굴 앞면을 찾는 것이고,
         한쪽 사진이 덜 돌아가 얕게 나왔다고 코를 뒤로 당기면 안 된다. */
      if(w.z > zMax[b]) zMax[b] = w.z;
      nHit++;
    }
  }
  /* 빈 밴드는 <b>지어내지 않고</b> 가장 가까운 실측을 잇는다 — 이 파일의
     fillBandsWithNearestNeighbor와 같은 원칙(원칙 (1)). 하나도 없으면 타원면. */
  const measured = zMax.some(z=>z > -Infinity);
  const zs = new Array(NB);
  const ellZAt = (my)=>{
    const yl = (my - CY) / E.b;
    return E.c * Math.sqrt(Math.max(0, 1 - Math.min(1, yl*yl)));
  };
  for(let b=0;b<NB;b++){
    if(zMax[b] > -Infinity){ zs[b] = zMax[b]; continue; }
    if(!measured){ zs[b] = ellZAt(yTop - (b+0.5)/NB*span); continue; }
    let lo=b, hi=b;
    while(lo>=0 && zMax[lo]===-Infinity) lo--;
    while(hi<NB && zMax[hi]===-Infinity) hi++;
    zs[b] = (lo>=0 && hi<NB) ? (zMax[lo]+zMax[hi])/2 : (lo>=0 ? zMax[lo] : zMax[hi]);
  }
  FACE_PROFILE.src = measured ? 'side' : 'ellipsoid';
  FACE_PROFILE.n = nHit;
  return {
    src: FACE_PROFILE.src,
    halfX: faceHalfX,
    /* 밴드 사이는 선형 보간 — 프로필은 연속이고, 계단으로 두면 그 높이에서
       가닥이 갑자기 걸리거나 빠진다(무게선이 톱니가 되는 것과 같은 이유). */
    zAt(my){
      const t = (yTop - my) / span * NB - 0.5;
      if(t <= 0) return zs[0];
      if(t >= NB-1) return zs[NB-1];
      const i = Math.floor(t), f = t - i;
      return zs[i]*(1-f) + zs[i+1]*f;
    },
  };
}

/* 앞머리 라인 — 얼굴 앞으로 내려온 가닥을 <b>그 높이에서 일자로</b> 자른다.
   ── 왜 가닥을 고르지 않고 선으로 자르나 ─────────────────────────────
   앞머리는 "어느 가닥이냐"가 아니라 <b>어느 높이냐</b>로 정해진다. 뽑힌 가닥만
   짧게 하면 안 뽑힌 이웃이 그 사이로 흘러내려 화면에서는 그냥 <b>긴 머리 몇
   가닥</b>으로 보인다. 가위는 선을 긋고, 그 선을 넘은 것은 무엇이든 잘린다.
   ⚠ 길이를 <b>만들지 않는다</b>. 자르기만 한다(MANNEQUIN.lenPct 주석과 같은 규칙).
   ⚠ 옆·뒤로 흐르는 머리는 안 건드린다 — z>0(앞쪽)이면서 두상 너비 안일 때만.
   되돌리기: MQ_FRINGE.lineHalfX = 0 */
function mqTrimAtFringeLine(pts, tipY, E, allAround){
  if(!(tipY != null) || !pts || pts.length < 2) return pts;
  /* (2026-09-03) 폭·깊이 둘 다 <b>측면 사진의 얼굴선</b>에서 온다 — 위 배너.
     프로필을 못 만들면 예전 두 값(헐 반너비 · z=0)으로 그대로 떨어진다. */
  const prof = getFaceProfile();
  const halfX = (prof && prof.halfX > 0)
              ? prof.halfX
              : ((E && E.a > 0 && MQ_FRINGE.lineHalfX > 0) ? E.a * MQ_FRINGE.lineHalfX : 0);
  if(!(halfX > 0) && !allAround) return pts;
  for(let i=1;i<pts.length;i++){
    const a = pts[i-1], c = pts[i];
    if(!(a.y >= tipY && c.y < tipY)) continue;        // 이 마디에서 선을 넘는다
    /* (2026-09-05) allAround면 <b>방향을 안 본다</b> — 크라운 배너 참고.
       기본(프론트)은 예전 그대로 얼굴 앞을 지나는 가닥만 자른다. */
    if(!allAround){
      // 얼굴 <b>앞면</b>보다 앞인가. 예전엔 두상 중심(0)이라 앞쪽 반구 전체가 걸렸다.
      const faceZ = prof ? prof.zAt(c.y) : 0;
      if(!(c.z > faceZ) || Math.abs(c.x) > halfX) continue; // 얼굴 앞이 아니면 통과
    }
    const t = (a.y - tipY) / Math.max(1e-9, a.y - c.y);
    const out = pts.slice(0, i);
    out.push({ x: a.x + (c.x-a.x)*t, y: tipY, z: a.z + (c.z-a.z)*t });
    return (out.length >= 2) ? out : pts;             // 뿌리 한 점만 남기지는 않는다
  }
  return pts;
}
/* 앞머리 선이 <b>지금</b> 어느 높이인가 — 길이 슬라이더가 정한다 (2026-09-02 5차).
   ── 3차의 잘못 ────────────────────────────────────────────────────
   3차는 이 선을 <b>심을 때 고정 y로</b> 그었다. 그러니 선이 바닥이자 천장이
   돼서, 길이를 아무리 내려도 가닥이 여전히 그 선까지 닿아 앞머리가 눈썹에
   붙박이가 됐다(사용자: "아무리 줄여도 눈썹이 한계"). 앞머리 길이는 고정
   높이가 아니라 <b>커트 결과</b>다 — 그래서 자를 때마다 다시 긋는다.
   ── 자 ───────────────────────────────────────────────────────────
   위 끝은 이마 헤어라인이다. 지어내지 않고 SCALP_ZONES.front의 phiRange 상한을
   그대로 읽는다 — SCALP_LIMIT이 "두피가 여기까지"라고 이미 정한 그 선이다.
   아래 끝은 비율 1(중립)에서 mqFringeTipY, 곧 <b>눈높이</b>다.
     선 = 헤어라인 − (헤어라인 − 눈높이) × 길이비율
   비율 0.05면 헤어라인 바로 아래(거의 안 남김), 1이면 눈, 1.8이면 광대 근처.
   단조이고, 슬라이더 전 구간이 살아 있고, 얼굴을 <b>덮는 데까지는 못 간다</b>.
   ── 누구의 비율인가: <b>프론트가 주인, 크라운이 거든다</b> ─────────────
   앞머리는 프론트 섹션의 물건이라 선은 하나여야 한다(가닥마다 자기 섹션 비율을
   쓰면 크라운 앞머리와 프론트 앞머리가 다른 높이에서 잘려 일자가 깨진다).
   다만 사용자: "크라운이 프론트와 같이 움직이니 올라가졌네. 그런데 크라운이
   <b>덜 움직일 정도면</b> 길이변화배율을 조금 조정해야 될 거 같아."
   맞다 — 크라운도 앞머리에 뿌리를 대고 있으니 지분이 0은 아니다. 지분은
   지어내지 않고 <b>실제로 내려 심는 비율</b>에서 읽는다:
       crownFrac / (frontFrac + crownFrac) = 0.15 / 0.75 = <b>0.20</b>
   MQ_FRINGE 값을 바꾸면 지분도 따라 움직인다(두 벌이 안 된다). */
function fringeLineY(sec){
  if(!MQ_FRINGE.on || !(MQ_FRINGE.lineHalfX > 0)) return null;
  const m = state.hair3Dneutral;
  if(!m || !m.mannequin) return null;
  const CY = (m.CY != null) ? m.CY : SCALP_CENTER_Y;
  let E = null; try{ E = getHeadEllipsoid(); }catch(e){ return null; }
  if(!E || !(E.b > 1e-6)) return null;
  const S = state.sections || {};
  const yHair = CY + E.b * Math.cos(SCALP_ZONES.front.phiRange[1]);   // 이마 헤어라인
  /* ── 크라운은 <b>자기 선</b>이다 (2026-09-05, MQ_FRINGE.crownLine 배너) ────
     중립 끝이 눈썹이고, 비율도 지분 섞기 없이 크라운 것만 쓴다 — 프론트가
     주인인 선에 크라운이 얹혀 있던 게 곧 "너무 내려와 있다"의 원인이었다.
     감쇠(lineGain)와 자르는 함수(mqTrimAtFringeLine)는 공유하지만, <b>얼굴 앞
     게이트는 안 쓴다</b>(crownAllAround) — 2차 지시가 "크라운 전체"였다.
     ⓘ 바닥이 눈썹이라, 길이 슬라이더는 크라운을 <b>짧게</b>만 움직인다.
       길게 빼는 쪽이 필요해지면 crownFloorBrow를 끈다. */
  const isCrown = (sec === 'crown') && MQ_FRINGE.crownLine;
  if(isCrown){
    const tipC = mqCrownTipY(CY, E);
    if(tipC == null) return null;
    let rc = sectionLengthRatio('crown', (S.crown || {}).length);
    rc = 1 + (rc - 1) * MQ_FRINGE.lineGain;
    const yc = yHair - (yHair - tipC) * Math.max(0, rc);
    /* 바닥 = <b>눈썹</b> 그 자체. 길이를 최대로 올려도 눈썹 밑으로는 안 간다
       (crownFloorBrow 배너). 자는 tipC와 같은 mqBrowY라 두 벌이 되지 않는다. */
    if(MQ_FRINGE.crownFloorBrow){
      const floorC = mqBrowY(CY, E);
      if(floorC != null && yc < floorC) return floorC;
    }
    return yc;
  }
  const tip0 = mqFringeTipY(CY);
  if(tip0 == null) return null;
  const rF = sectionLengthRatio('front', (S.front || {}).length);
  const rC = sectionLengthRatio('crown', (S.crown || {}).length);
  /* 크라운 지분은 <b>크라운이 이 선을 탈 때만</b> 의미가 있다. 자기 선이
     생긴 뒤에도 지분을 남겨 두면, 크라운 슬라이더가 크라운 선과 프론트 선을
     <b>동시에</b> 움직여 "크라운만 올렸는데 앞머리도 따라 올라간다"가 된다.
     그래서 crownLine이 켜져 있으면 프론트 선은 순수하게 프론트 것이다. */
  const share = MQ_FRINGE.crownLine ? 0
              : MQ_FRINGE.crownFrac / Math.max(1e-9, MQ_FRINGE.frontFrac + MQ_FRINGE.crownFrac);
  let r = rF * (1 - share) + rC * share;
  r = 1 + (r - 1) * MQ_FRINGE.lineGain;                              // 선에만 감쇠
  const y = yHair - (yHair - tip0) * Math.max(0, r);
  /* 바닥 — 눈~턱의 lineFloorFaceFrac 아래로는 안 내려간다. 자는 mqFringeTipY와
     같은 것이라 두 벌이 되지 않는다(tip0 = CY − tipFaceFrac × 눈~턱). */
  if(MQ_FRINGE.lineFloorFaceFrac > 0 && MQ_FRINGE.tipFaceFrac !== MQ_FRINGE.lineFloorFaceFrac){
    const faceH = (CY - tip0) / Math.max(1e-9, MQ_FRINGE.tipFaceFrac || 1);
    const floorY = (MQ_FRINGE.tipFaceFrac > 0)
      ? CY - MQ_FRINGE.lineFloorFaceFrac * faceH
      : CY - MQ_FRINGE.lineFloorFaceFrac * _mqFaceH(CY, E);
    if(floorY != null && y < floorY) return floorY;
  }
  return y;
}
/* 눈~턱 — mqFringeTipY와 <b>같은 자</b>(tipFaceFrac이 0이면 tip0에서 역산이
   안 되므로 여기서 직접 잰다. 식은 mqFringeTipY 그대로다). */
function _mqFaceH(CY, E){
  try{ const fm = getFaceMetrics(); if(fm && fm.heightFactor > 0) return 0.70 * fm.heightFactor; }catch(e){}
  return (E && E.b > 0) ? 0.70 * (E.b / 0.633) : 0;
}
let _mqSeed = 20260808;
const _mqRand = ()=>{ _mqSeed = (_mqSeed * 1103515245 + 12345) & 0x7fffffff; return _mqSeed / 0x7fffffff; };
/* 타원체 안이면 표면으로 방사 밀어내기. 밖이면 그대로 — 두상 미끄러짐의 전부다. */
function ellipsoidPushOut(p, a, b, c, CY){
  const x = p.x, y = p.y - CY, z = p.z;
  const f = (x*x)/(a*a) + (y*y)/(b*b) + (z*z)/(c*c);
  if(f >= 1 || !(f > 0)) return p;
  const s = 1 / Math.sqrt(f);
  return { x: x*s, y: CY + y*s, z: z*s };
}
function growMannequinStrand(ci, NT, NP, S, E, CY, L, colors){
  if(!(L > MANNEQUIN.minLen)) return null;
  const M = MANNEQUIN;
  const pi = (ci / NT) | 0, ti = ci % NT;
  const phi = (pi + _mqRand()) / NP * Math.PI;
  const th  = (ti + _mqRand()) / NT * 2*Math.PI - Math.PI;
  const sp = Math.sin(phi), cp = Math.cos(phi);
  const K = M.clearance;
  const aR = S.a*K, bR = S.b*K, cR = S.c*K;
  let p = { x: aR*sp*Math.sin(th), y: CY + bR*cp, z: cR*sp*Math.cos(th) };
  // 두피 법선(타원체 그래디언트)
  const d0 = _v3norm({ x: p.x/(aR*aR), y: (p.y-CY)/(bR*bR), z: p.z/(cR*cR) });
  // 이 가닥이 타고 흐를 껍질 — 두피~헤어 바깥면 사이. 다 같은 면에 붙으면
  // 껍데기 한 장이 되어 부피가 안 산다(리프트의 tLayer와 같은 취지).
  const layer = M.layerLo + (M.layerHi - M.layerLo) * _mqRand();
  const kx = (1 + layer*(E.a/Math.max(1e-6,S.a) - 1)) * K;
  const ky = (1 + layer*(E.b/Math.max(1e-6,S.b) - 1)) * K;
  const kz = (1 + layer*(E.c/Math.max(1e-6,S.c) - 1)) * K;
  const cA = S.a*kx, cB = S.b*ky, cC = S.c*kz;
  const N = M.segments, step = L / N;
  /* ── 법선 구간은 <b>고정 거리</b>다 (2026-08-09) ─────────────────────────
     사용자: "맨 꼭대기 빼고는 거의 잡혔다."

     rootRamp가 <b>길이 비율</b>(0.14×L)이었다. 긴 머리일수록 뿌리에서 두피
     법선 방향으로 <b>더 길게</b> 선다는 뜻이다. 이 손님 크라운은 L=2.78
     (모델단위 1 ≈ 17.5cm이니 약 48cm)이라 0.39단위 ≈ <b>6.8cm를 수직으로
     솟았다가</b> 꺾인다. 정수리에서 법선은 곧 <b>위</b>라, 꼭짓점 가닥이 전부
     위로 뻗치고 그 아래 두피가 드러난다. 렌더 맨 위에 보이던 삐죽삐죽이 그것이다.

     실제 모발은 길이와 무관하게 모낭에서 <b>몇 mm</b> 나오다 눕는다. 그 거리는
     이미 실측돼 있다 — 두피면과 헤어 바깥면(헐)의 간격, 곧 <b>모발 두께</b>
     ([두피면] 옆 1.1cm · 위 0.7cm). 그 거리만큼만 법선으로 가고 눕는다.
     짧은 머리(스포츠컷)는 두께보다 짧을 수 있으므로 길이의 일부로 한 번 더 막는다. */
  const pHull = { x: E.a*sp*Math.sin(th), y: CY + E.b*cp, z: E.c*sp*Math.cos(th) };
  const thick = Math.hypot(pHull.x - p.x, pHull.y - p.y, pHull.z - p.z);
  const rampLen = Math.max(1e-4, Math.min(thick, L * M.rootRampMax));
  const pts = [ { x:p.x, y:p.y, z:p.z } ];
  /* 접촉 중 <b>바깥 방향</b> — 이 뿌리의 방위각. 두상에 닿아 있는 동안만 섞는다.
     없으면 정수리에서 가닥이 갇힌다: 꼭짓점에서 중력으로 한 발 내려가면 타원체
     안이고, 방사 밀어내기의 방향이 바로 <b>위</b>라 제자리로 되돌아온다(하네스에서
     200개 중 13개가 뿌리보다 위에서 끝났다). 실제로도 정수리 가마의 머리는
     아래가 아니라 <b>사방으로 퍼지며</b> 내려간다 — 그 방향이 이것이다. */
  const outw = { x: Math.sin(th), y: 0, z: Math.cos(th) };
  let contact = false;
  for(let i=1;i<=N;i++){
    const t = Math.min(1, (i*step) / rampLen);          // 법선 → 중력 (고정 거리)
    const sx = contact ? M.spread : 0;
    const dir = _v3norm({ x: d0.x*(1-t) + outw.x*sx,
                          y: d0.y*(1-t) - t,
                          z: d0.z*(1-t) + outw.z*sx });
    p = { x: p.x + dir.x*step, y: p.y + dir.y*step, z: p.z + dir.z*step };
    const q = ellipsoidPushOut(p, cA, cB, cC, CY);       // 두상 미끄러짐
    contact = (q !== p);
    p = q;
    pts.push({ x:p.x, y:p.y, z:p.z });
  }
  const color = (colors && colors.length) ? colors[(_mqRand()*colors.length)|0] : '#2B2320';
  return { pts, sec: null, color, srcAngle: null, rootFacing: 0, mannequin: true };
}
function buildMannequinHair3D(){
  // (옛 51) 사진 모델에 뿌리밀도 격자가 없으면 균일 격자를 넣고 시작(13b ROOTS_FALLBACK)
  try{ ROOTS_FALLBACK.ensureRoots(state._hair3Dneutral || state.hair3D); }catch(e){}
  const src = state._hair3Dneutral || state.hair3D;
  if(!src || !src.strands || !src.strands.length) return null;
  const G = src.grid, rf = src.roots;
  if(!G || !rf || !rf.ok){ console.warn('[마네킹] 격자/뿌리밀도가 없어 못 심음'); return null; }
  const NT = rf.NT, NP = rf.NP, CY = src.CY, b = rf.b;
  const S = getScalpEllipsoid(), E = getHeadEllipsoid();
  const yStep = (G.yTopH - G.yBot) / (G.NY - 1);
  const bucketOfY = y => Math.min(G.NY-1, Math.max(0, Math.round((G.yTopH - y) / yStep)));
  const areas = headSurfaceCellAreas(G.hullW, G.hullD, bucketOfY, CY, b, NT, NP);

  // ── 섹션별 실측 길이·색 (촬영 가닥에서 뽑는다 — 여기가 "특성만 가져온다"의 실체) ──
  /* 길이는 섹션 <b>× 뷰</b>로 잰다. 섹션 하나로 뭉치면 좌우 비대칭이 중앙값에
     흡수돼 사라진다 — 하네스에서 오른쪽을 8% 길게 넣은 모델이 좌우 완전히
     같은 마네킹으로 나왔다. 손님의 좌우 길이 차이는 지워야 할 스타일링이
     아니라 <b>실측 특성</b>이라 남긴다(표본이 모자란 칸은 섹션 전체로 폴백). */
  const byS = {}, byV = {}, allLen = [];
  for(const st of src.strands){
    const s = st.sec || 'crown';
    const o = byS[s] || (byS[s] = { len:[], col:[] });
    const L = arcLength3D(st.pts);
    o.len.push(L); allLen.push(L);
    if(st.color) o.col.push(st.color);
    const vk = s + '|' + viewOfRoot(st.pts[0]);
    (byV[vk] || (byV[vk] = [])).push(L);
  }
  const pick = (arr, q)=>{ if(!arr.length) return 0; const a = arr.slice().sort((p1,p2)=>p1-p2);
                           return a[Math.min(a.length-1, Math.floor(a.length*q))]; };
  const secLen = {}, secCol = {}, viewLen = {};
  /* 최댓값으로 심으므로 <b>이상치 하나가 섹션 전체를 정한다</b> — 세그멘테이션이
     어깨로 흘러내린 머리를 한 가닥이라도 따라갔으면 그 섹션이 통째로 그만큼
     길어진다. 막지는 않는다(사용자 지정이 최장이고, 커트가 빼면 된다). 대신
     중앙값 대비 몇 배인지 <b>찍는다</b> — 3배를 넘으면 길이가 아니라 추적 오류다. */
  const 이상치 = [];
  for(const s in byS){
    secLen[s] = pick(byS[s].len, MANNEQUIN.lenPct);
    secCol[s] = byS[s].col;
    const med = pick(byS[s].len, 0.5);
    if(med > 0 && secLen[s] / med > 3) 이상치.push(s + ' 최장 ' + secLen[s].toFixed(3)
      + ' = 중앙값 ' + med.toFixed(3) + '의 ' + (secLen[s]/med).toFixed(1) + '배');
  }
  if(이상치.length) console.warn('[마네킹·길이 이상치] ' + 이상치.join(' · ')
    + '\n    최장 가닥이 중앙값의 3배를 넘습니다 — 세그멘테이션이 어깨/옷을 머리로 따라갔을 가능성. MANNEQUIN.lenPct를 0.95 등으로 낮추면 이상치를 뺍니다.');
  /* ── 뷰별 길이는 <b>섹션 중앙값 근처</b>에서만 믿는다 (2026-08-09) ──────────
     실기기 로그: crown|front 0.496 · crown|left 0.456 · crown|right 1.269 ·
     crown|back 1.973 — 같은 정수리인데 뷰끼리 <b>4배</b>가 벌어졌다.
     사람 머리가 그렇게 안 생겼다. 이건 비대칭이 아니라 <b>측정</b>이다: 촬영
     가닥의 호길이는 그 뷰의 카메라가 어디까지 봤고 세그멘테이션이 어디서
     끊었는지에 좌우된다(정면에서 정수리는 마스크 위쪽에서 잘려 짧게 잡힌다).
     그 값을 그대로 심으면 같은 섹션 안에 0.46짜리와 1.97짜리가 섞이고, 커트가
     유니폼으로 길이를 맞추려 하면 짧은 가닥은 <b>3배로 늘여야</b> 한다 —
     늘린 가닥은 마지막 방향으로 뻗으므로 얼굴을 가로지른다. 실기기에서 본
     "머리가 얼굴을 덮는 성긴 실타래"의 기하학적 원인이 여기다.

     그렇다고 뷰별 측정을 버리면 진짜 좌우 비대칭도 같이 버린다(원래 이걸
     남기려고 만든 코드다). 그래서 <b>폭을 정한다</b>: 실제 커트에서 좌우
     길이차는 커봐야 ±1/3이다(그 이상이면 손님이 먼저 안다). 그 밖은 측정
     잡음으로 보고 섹션 중앙값 쪽으로 끌어당긴다. 버리는 게 아니라 <b>가두는</b>
     것이라, 8% 비대칭 같은 진짜 신호는 그대로 통과한다. */
  const MIN_VIEW_N = 12;
  const VIEW_LEN_TOL = 1/3;
  const clampedTxt = [];
  for(const k in byV){
    if(byV[k].length < MIN_VIEW_N) continue;
    const raw = pick(byV[k], MANNEQUIN.lenPct);
    const base = secLen[k.split('|')[0]];
    if(!(base > 0)){ viewLen[k] = raw; continue; }
    const v = Math.max(base*(1 - VIEW_LEN_TOL), Math.min(base*(1 + VIEW_LEN_TOL), raw));
    if(Math.abs(v - raw) > 1e-6) clampedTxt.push(k + ' ' + raw.toFixed(3) + '→' + v.toFixed(3));
    viewLen[k] = v;
  }
  if(clampedTxt.length) console.log('[마네킹·뷰별길이 가둠] 섹션 중앙값 ±33% 밖 '
    + clampedTxt.length + '칸 — ' + clampedTxt.join(' · ')
    + '\n    ↑ 많이 뜨면 그 섹션은 뷰마다 다르게 잘리고 있다는 뜻(세그멘테이션·마스크 경계 확인). MANNEQUIN 뷰별길이 자체를 끄려면 MIN_VIEW_N을 크게.');
  const fbLen = pick(allLen, MANNEQUIN.lenPct);
  const lenFor = (sec, view)=> viewLen[sec + '|' + view] || secLen[sec] || fbLen;

  // ── 셀별 심을 개수: 밀도 × 면적. 총합은 촬영 모델과 같게(브레젠험 누산) ──
  const nCell = NT*NP;
  const w = new Float64Array(nCell);
  let wSum = 0, planted = 0, baldCells = 0, pxColored = 0;
  let offScalpCells = 0;
  for(let ci=0; ci<nCell; ci++){
    // 두피 밖은 밀도 0이라 아래 조건에 자동으로 걸리지만, 이유를 따로 센다
    if(rf.est && rf.est[ci] === EST_OFFSCALP){ offScalpCells++; baldCells++; continue; }
    const d = rf.den[ci];
    if(!(d > MANNEQUIN.baldDen)){ baldCells++; continue; }
    w[ci] = d * (areas ? areas[ci] : 1);
    wSum += w[ci];
  }
  if(!(wSum > 0)){ console.warn('[마네킹] 뿌리밀도가 전부 0'); return null; }
  // (2026-10-04 360shot · 48-strand-budget) 심을 가닥 수 = STRAND_BUDGET.total(3만)이 켜져 있으면 그 값, 아니면 사진 가닥 수
  const target = (window.STRAND_BUDGET && window.STRAND_BUDGET.on !== false && window.STRAND_BUDGET.total > 0) ? window.STRAND_BUDGET.total : src.strands.length;
  const out = [];
  let acc = 0;
  const secHist = {};
  /* 앞머리를 내릴지는 <b>심기 전에 한 번만</b> 정한다(프로브 표본 15점).
     hasFringe가 null이면 모르는 것이라 안 심는다 — 모르면 지어내지 않는다. */
  const hasFringe = MQ_FRINGE.on ? mannequinHasFringe(src) : null;
  const fringeTipY = MQ_FRINGE.on ? mqFringeTipY(CY) : null;
  let crownTipY = fringeTipY;                                                    // 크라운은 눈썹
  if(MQ_FRINGE.on){ const _ct = mqCrownTipY(CY, E); if(_ct != null) crownTipY = _ct; }
  const needFringe = (hasFringe === false) && (fringeTipY != null);
  let fringeN = 0;
  for(let ci=0; ci<nCell; ci++){
    if(!w[ci]) continue;
    acc += w[ci] / wSum * target;
    const n = Math.floor(acc); acc -= n;
    for(let k=0;k<n;k++){
      // 섹션은 뿌리를 심어 봐야 안다 — 임시로 길이를 모르는 채 뿌리만 먼저 잡는다
      const pi = (ci / NT) | 0, ti = ci % NT;
      const phi = (pi + 0.5) / NP * Math.PI, th = (ti + 0.5) / NT * 2*Math.PI - Math.PI;
      const rp = { x: S.a*Math.sin(phi)*Math.sin(th), y: CY + S.b*Math.cos(phi),
                   z: S.c*Math.sin(phi)*Math.cos(th) };
      const sec = resolveSection3D(rp, CY, S.b) || 'crown';
      const view = viewOfRoot(rp);
      /* 앞머리 — "심을 게 없으면 프론트·크라운에서 내린다"(위 MQ_FRINGE 배너).
         needFringe가 false(이미 앞머리 있음)거나 null(모름)이면 안 걸린다. */
      let st = null;
      if(needFringe && mqFringePicks(rp, sec, ci, k)){
        const d0 = _v3norm({ x: rp.x/(S.a*S.a), y: (rp.y-CY)/(S.b*S.b), z: rp.z/(S.c*S.c) });
        /* 크라운은 <b>눈썹</b>까지만 내려 심는다 (2026-09-05). 심을 때 길게
           내려놓고 자를 때만 올리면, 커트 전(중립) 그림에서 크라운이 여전히
           눈까지 내려와 보인다 — 사용자가 본 게 그 상태다. */
        const tipHere = (sec === 'crown') ? crownTipY : fringeTipY;
        st = growFringeStrand(rp, d0, tipHere, lenFor(sec, view), secCol[sec] || secCol.crown);
        if(st) fringeN++;
      }
      if(!st) st = growMannequinStrand(ci, NT, NP, S, E, CY, lenFor(sec, view), secCol[sec] || secCol.crown);
      if(!st) continue;
      st.sec = sec;
      st.srcAngle = view;
      /* 조각별 원본 픽셀색 — 마네킹도 <b>사진에서 결을 가져온다</b>(2026-08-18 i).
         가닥을 자기 뷰로 되쏘아 그 자리 픽셀을 읽는다. 못 읽으면 null이라
         예전처럼 가닥당 단색으로 떨어진다(새 실패 모드 없음). */
      st.colors = bakeStrandColors3D(st.pts, src, view, st.color, null);
      if(st.colors) pxColored++;
      secHist[sec] = (secHist[sec]||0) + 1;
      out.push(st); planted++;
    }
  }
  const lenTxt = Object.keys(secLen).map(s=>s+' '+secLen[s].toFixed(3)).join(' · ');
  const vTxt = Object.keys(viewLen).sort().map(k=>k+' '+viewLen[k].toFixed(3)).join(' · ');
  console.log('[마네킹] 가닥 ' + planted + '개(촬영 ' + target + '개 기준) · 심은 셀 '
    + (nCell - baldCells) + '/' + nCell
    + '(두피 밖 ' + offScalpCells + ' · 밀도 0 ' + (baldCells - offScalpCells) + ')'
    + ' · 섹션 ' + Object.keys(secHist).map(s=>s+' '+secHist[s]+'('+Math.round(100*secHist[s]/planted)+'%)').join(' ')
    + ' · 섹션길이(중앙값) ' + lenTxt
    /* [진단] 조각별 원본 픽셀색을 실제로 구운 가닥 비율(2026-08-18 i).
       0%면 마스크·photoRGB·캘리브레이션 중 하나가 없다는 뜻이고, 그때 최종 3D는
       예전처럼 가닥당 단색이 된다 — [3D]의 "원본 픽셀색 N개"와 같은 숫자여야 한다. */
    + ' · 원본 픽셀색 ' + pxColored + '개(=' + (planted ? Math.round(pxColored/planted*100) : 0) + '%)'
    /* [진단·앞머리] 셋을 한 줄에 — <b>왜 안 내려왔는지</b>를 화면에서 바로 가른다.
       · 이미 있음  → 손님에게 앞머리가 있어 안 심은 것(정상)
       · 모름       → 점유 프로브가 없다. 안 심는 게 맞고, 원인은 리프트 쪽이다
       · 0개        → 판정은 내렸는데 한 가닥도 안 났다 = 뿌리가 광대보다 아래거나
                      실측 길이가 minLen 미만. 그때 볼 값은 tipFaceFrac다. */
    + '\n[마네킹·앞머리] ' + (hasFringe == null ? '<b>모름</b>(점유 프로브 없음 — 안 심음)'
        : hasFringe ? '손님에게 <b>이미 있음</b> — 안 심음'
        : (fringeTipY == null ? '<b>끝높이 못 잼</b>(얼굴 계측 없음) — 안 심음'
           : '내려 심음 <b>' + fringeN + '개</b> · 끝 y=' + fringeTipY.toFixed(3)
             + '(눈에서 눈~턱의 ' + Math.round(MQ_FRINGE.tipFaceFrac*100) + '%'
             + (MQ_FRINGE.tipFaceFrac <= 0.01 ? ' = 눈높이' : '') + ')'

             + ' · front ' + Math.round(MQ_FRINGE.frontFrac*100) + '% / crown ' + Math.round(MQ_FRINGE.crownFrac*100) + '%'
             /* [진단·크라운선] 눈썹 선이 실제로 걸렸는지. 크라운 끝 y가 눈높이(CY)와
                같으면 crownLine이 꺼졌거나 mqBrowY가 null로 떨어진 것이다. */
             + (MQ_FRINGE.crownLine && crownTipY != null
                 ? ' · 크라운 끝 y=' + crownTipY.toFixed(3)
                   + '(눈 위 ' + (E && E.b > 0 ? Math.round((crownTipY - CY)/E.b*100) : '?') + '% of E.b = <b>눈썹</b>)'
                 : ' · 크라운 <b>프론트와 같은 선</b>')))
    + (vTxt ? ('\n[마네킹·뷰별길이] ' + vTxt) : ''));
  return { strands: out, viewCal: src.viewCal, yTop: src.yTop, CY: src.CY,
           field: null, occ: null, grid: G, roots: rf, mannequin: true };
}

/* ══════════════════════════════════════════════════════════════════
   #5 시술모드 — 빗질한 자리에 머리가 <b>남는다</b>
   ─────────────────────────────────────────────────────────────────
   사용자: "시술모드 — 마네킹처럼 리셋, 자유롭게 움직이는 머리(빗질·쓸어넘김이
   유지됨)". 기존 스타일링(넘김/가르마/볼륨/결흐름)은 <b>머리 전체</b>에 한
   방향으로 걸리는 슬라이더다. 실제 시술은 그렇지 않다 — 빗을 댄 자리만,
   댄 방향으로 움직이고, 손을 떼면 거기 있다.

   설계 — 스트로크 목록이 아니라 <b>변위장</b>:
   빗질 한 획을 그대로 목록에 쌓고 가닥마다 전부 훑으면 비용이
   (획 수 × 가닥 수 × 점 수)로 커진다(획 200개면 6천만 회). 대신 두상+모발을
   감싸는 성긴 3D 격자(N³)에 변위를 <b>누적</b>해 두고, 가닥은 자기 점에서
   삼선형 보간으로 한 번만 읽는다 — 획을 아무리 그어도 적용 비용이 일정하다.
   획 목록(strokes)은 되돌리기·재굽기용으로만 남긴다.

   두 가지 물리 규칙만 지킨다(나머지는 손대지 않는다):
     · 뿌리는 두피에 박혀 있다 — 뿌리 쪽 gripFrom 구간은 거의 안 움직인다
     · 머리카락 <b>길이는 변하지 않는다</b> — 변위 후 원래 마디 길이로 다시 걷는다
       (안 하면 빗질할수록 머리가 늘어난다)
══════════════════════════════════════════════════════════════════ */
const COMB = {
  on: false,          // 시술모드 ON/OFF
  radiusPx: 64,       // 브러시 반경(캔버스 백킹 px) — 화면 확대에 따라 자동 환산
  falloff: 1.6,       // 거리 감쇠 지수
  gripFrom: 0.18,     // 이 비율까지의 뿌리 구간은 붙잡혀 있다
  maxStrokes: 4000,
  N: 32,              // 변위장 격자 한 변
  minMovePx: 4,       // 이만큼 움직여야 한 획으로 친다
  strokes: [], grid: null, box: null, _proj: null,
  // 획들이 실제로 건드린 범위(AABB). 대부분의 가닥은 여기 밖이라 6번 비교로
  // 통째로 건너뛴다 — 이게 없으면 안 움직이는 가닥까지 8모서리 보간을 돈다
  // (실측: 16,000가닥 442ms → 이 컷으로 대부분 제거).
  bmin: null, bmax: null,
  maxDisp: 0,        // 변위장의 최대 크기(모델 단위) — 클립 여유 계산에 쓴다
};
/* 격자 상자 — 중립 모델의 실제 점 범위에서 잡는다(지어낸 크기 아님). */
function combEnsureBox(){
  if(COMB.box) return COMB.box;
  const m = state.hair3Dneutral;
  if(!m || !m.strands || !m.strands.length) return null;
  let x0=Infinity,y0=Infinity,z0=Infinity,x1=-Infinity,y1=-Infinity,z1=-Infinity;
  const step = Math.max(1, Math.floor(m.strands.length/400));
  for(let i=0;i<m.strands.length;i+=step){
    for(const p of m.strands[i].pts){
      if(p.x<x0)x0=p.x; if(p.x>x1)x1=p.x;
      if(p.y<y0)y0=p.y; if(p.y>y1)y1=p.y;
      if(p.z<z0)z0=p.z; if(p.z>z1)z1=p.z;
    }
  }
  if(!isFinite(x0)) return null;
  const pad = 0.3 * Math.max(x1-x0, y1-y0, z1-z0);
  COMB.box = { x0:x0-pad, y0:y0-pad, z0:z0-pad, x1:x1+pad, y1:y1+pad, z1:z1+pad };
  return COMB.box;
}
function combGrid(){
  if(COMB.grid) return COMB.grid;
  if(!combEnsureBox()) return null;
  COMB.grid = new Float32Array(COMB.N * COMB.N * COMB.N * 3);
  return COMB.grid;
}
/* 획 하나를 격자에 뿌린다(누적). r은 모델 단위 반경. */
function combSplat(p, d, r){
  const g = combGrid(), B = COMB.box, N = COMB.N;
  if(!g || !B || !(r > 0)) return;
  const sx = (B.x1-B.x0)/(N-1), sy = (B.y1-B.y0)/(N-1), sz = (B.z1-B.z0)/(N-1);
  /* 격자 재구성 감쇠 보정 — 획을 격자에 뿌린 뒤 <b>같은 자리</b>에서 읽으면
     셀 평균이라 명령한 값이 그대로 안 나온다(실측 0.68배). 그러면 머리가
     커서보다 30% 뒤처져 따라온다. 그 비율을 지금 여기서 계산해 나눠 준다 —
     "몇 배" 상수를 지어내는 게 아니라 <b>바로 아래 splat과 combSampleInto의
     역함수</b>다(하네스에서 왕복 오차 <1%로 확인). */
  {
    const fx = (p.x-B.x0)/sx, fy = (p.y-B.y0)/sy, fz = (p.z-B.z0)/sz;
    const i = Math.min(N-2, Math.max(0, Math.floor(fx)));
    const j = Math.min(N-2, Math.max(0, Math.floor(fy)));
    const k = Math.min(N-2, Math.max(0, Math.floor(fz)));
    const tx = fx-i, ty = fy-j, tz = fz-k;
    let att = 0;
    for(let dk=0; dk<2; dk++) for(let dj=0; dj<2; dj++) for(let di=0; di<2; di++){
      const w = (di?tx:1-tx) * (dj?ty:1-ty) * (dk?tz:1-tz);
      if(!w) continue;
      const dist = Math.hypot(B.x0+(i+di)*sx-p.x, B.y0+(j+dj)*sy-p.y, B.z0+(k+dk)*sz-p.z);
      if(dist < r) att += w * Math.pow(1 - dist/r, COMB.falloff);
    }
    if(att > 0.15) d = { x:d.x/att, y:d.y/att, z:d.z/att };
  }
  if(!COMB.bmin){ COMB.bmin = {x:Infinity,y:Infinity,z:Infinity}; COMB.bmax = {x:-Infinity,y:-Infinity,z:-Infinity}; }
  COMB.bmin.x = Math.min(COMB.bmin.x, p.x-r); COMB.bmax.x = Math.max(COMB.bmax.x, p.x+r);
  COMB.bmin.y = Math.min(COMB.bmin.y, p.y-r); COMB.bmax.y = Math.max(COMB.bmax.y, p.y+r);
  COMB.bmin.z = Math.min(COMB.bmin.z, p.z-r); COMB.bmax.z = Math.max(COMB.bmax.z, p.z+r);
  const i0 = Math.max(0, Math.floor((p.x-r-B.x0)/sx)), i1 = Math.min(N-1, Math.ceil((p.x+r-B.x0)/sx));
  const j0 = Math.max(0, Math.floor((p.y-r-B.y0)/sy)), j1 = Math.min(N-1, Math.ceil((p.y+r-B.y0)/sy));
  const k0 = Math.max(0, Math.floor((p.z-r-B.z0)/sz)), k1 = Math.min(N-1, Math.ceil((p.z+r-B.z0)/sz));
  for(let i=i0;i<=i1;i++){
    const gx = B.x0 + i*sx;
    for(let j=j0;j<=j1;j++){
      const gy = B.y0 + j*sy;
      for(let k=k0;k<=k1;k++){
        const gz = B.z0 + k*sz;
        const dist = Math.hypot(gx-p.x, gy-p.y, gz-p.z);
        if(dist > r) continue;
        const w = Math.pow(1 - dist/r, COMB.falloff);
        const o = ((k*N + j)*N + i) * 3;
        g[o] += d.x*w; g[o+1] += d.y*w; g[o+2] += d.z*w;
        // 클립 여유(combClipGrowPx)가 쓸 "빗질한 최대 거리" — 여기서 공짜로 잰다
        const mag = Math.hypot(g[o], g[o+1], g[o+2]);
        if(mag > COMB.maxDisp) COMB.maxDisp = mag;
      }
    }
  }
}
function combSampleInto(p, out){
  const g = COMB.grid, B = COMB.box, N = COMB.N;
  out.x = out.y = out.z = 0;
  if(!g || !B) return out;
  const fx = (p.x-B.x0)/(B.x1-B.x0)*(N-1), fy = (p.y-B.y0)/(B.y1-B.y0)*(N-1), fz = (p.z-B.z0)/(B.z1-B.z0)*(N-1);
  if(fx < 0 || fy < 0 || fz < 0 || fx > N-1 || fy > N-1 || fz > N-1) return out;
  const i = Math.min(N-2, Math.floor(fx)), j = Math.min(N-2, Math.floor(fy)), k = Math.min(N-2, Math.floor(fz));
  const tx = fx-i, ty = fy-j, tz = fz-k;
  for(let dk=0; dk<2; dk++) for(let dj=0; dj<2; dj++) for(let di=0; di<2; di++){
    const w = (di?tx:1-tx) * (dj?ty:1-ty) * (dk?tz:1-tz);
    if(!w) continue;
    const o = (((k+dk)*N + (j+dj))*N + (i+di)) * 3;
    out.x += g[o]*w; out.y += g[o+1]*w; out.z += g[o+2]*w;
  }
  return out;
}
function combRebake(){
  COMB.grid = null; COMB.bmin = COMB.bmax = null; COMB.maxDisp = 0;
  if(!COMB.strokes.length) return;
  combGrid();
  /* 재굽기는 원래 명령값(s.d)으로 다시 뿌려야 한다 — combSplat이 감쇠 보정을
     또 걸므로, 저장은 <b>보정 전</b> 값이어야 왕복이 맞는다(그래서 splat은
     인자 d를 지역 변수로만 바꾸고 호출자의 객체는 안 건드린다). */
  for(const s of COMB.strokes) combSplat(s.p, s.d, s.r);
}
function combClear(){ COMB.strokes.length = 0; COMB.grid = null; COMB.bmin = COMB.bmax = null; COMB.maxDisp = 0; }
function combUndo(){
  if(!COMB.strokes.length) return;
  // 한 번의 드래그는 여러 획으로 쌓이므로 <b>드래그 단위</b>로 되돌린다.
  const id = COMB.strokes[COMB.strokes.length-1].g;
  while(COMB.strokes.length && COMB.strokes[COMB.strokes.length-1].g === id) COMB.strokes.pop();
  combRebake();
  combRefresh();
}
/* 변위장을 가닥에 적용 — 뿌리 고정 + 길이 보존 */
const _combTmp = {x:0,y:0,z:0};
/* 가닥 하나 빗질 — 2D 획 격자(아래 combStrand3DGrid) 다음 (옛 53) 3D 빗질·넘기기(COMB3D) */
function combStrand3D(pts){
  // (옛 55) 곱슬이면 3D 빗질은 정렬 대신 자르기 — 여기서는 빗질 표본을 잠깐 감춤(FLY_TRIM)
  return FLY_TRIM._comb(() => COMB3D._apply(combStrand3DGrid(pts)));
}
function combStrand3DGrid(pts){
  if(!COMB.grid || !pts || pts.length < 2) return pts;
  // 획이 닿은 범위 밖이면 통째로 건너뛴다(대부분의 가닥이 여기서 끝난다)
  const lo = COMB.bmin, hi = COMB.bmax;
  if(lo){
    let hit = false;
    for(let i=0;i<pts.length;i++){
      const p = pts[i];
      if(p.x>=lo.x && p.x<=hi.x && p.y>=lo.y && p.y<=hi.y && p.z>=lo.z && p.z<=hi.z){ hit = true; break; }
    }
    if(!hit) return pts;
  }
  const n = pts.length - 1;
  const moved = new Array(pts.length);
  let any = false;
  for(let i=0;i<pts.length;i++){
    const p = pts[i];
    combSampleInto(p, _combTmp);
    const t = i/n;
    const grip = t <= COMB.gripFrom ? (t/COMB.gripFrom) : 1;
    if(_combTmp.x || _combTmp.y || _combTmp.z) any = true;
    moved[i] = { x:p.x + _combTmp.x*grip, y:p.y + _combTmp.y*grip, z:p.z + _combTmp.z*grip };
  }
  if(!any) return pts;
  /* 길이 보존 — 옮겨진 곡선의 <b>접선</b>을 따라 원래 마디 길이로 다시 걷는다.
     (목표점을 향해 걷는 방식은 곡선이 줄어들면 앞질러 나가 지그재그가 된다 —
      straightenStrand3D에서 실측으로 확인한 그 함정. 같은 형태를 쓴다.) */
  const out = [moved[0]];
  for(let i=1;i<pts.length;i++){
    const L = Math.hypot(pts[i].x-pts[i-1].x, pts[i].y-pts[i-1].y, pts[i].z-pts[i-1].z);
    const a = out[i-1];
    let dx = moved[i].x-moved[i-1].x, dy = moved[i].y-moved[i-1].y, dz = moved[i].z-moved[i-1].z;
    const d = Math.hypot(dx,dy,dz) || 1;
    out.push({ x:a.x + dx/d*L, y:a.y + dy/d*L, z:a.z + dz/d*L });
  }
  return out;
}

/* ==========================================================================
 * COMB3D (옛 53-comb3d.js) — 3D 조정 화면의 빗질: 쓰다듬은 방향으로 결을 정렬
 *
 * 자리: 17a, combStrand3D 바로 뒤. 원래 함수에서 부르는 곳 —
 *   · combStrand3D 끝(격자 빗질 combStrand3DGrid 다음) COMB3D._apply
 *   · computeAdjustedHair3DStrands(17b) 앞뒤 _beforeCompute/_afterCompute · adjFilterSig 꼬리표
 *   · activateScreen(05)·toggleMannequin·mannequinReset(17a)·renderAdjustFrame(07b) 끝 버튼 맞춤, model3dApplyView(18) 끝 붓 크기
 *   · perfPanelLines(18) 끝 줄
 *
 * 왜 (2026-10-05 · 사용자): "원본 다시 만들기 결과는 괜찮은데 주변에 삐죽 튀어나온 잔머리가 있다. 원장들이 저 정도만 나와도
 *   괜찮긴 한데 손질은 가능해야 한다. 예전의 빗(comb) 기능을 다시 써 보자 — 예전에는 2D 화면이라 어려웠는데 지금은 확대·이동이
 *   되니까. 잔머리 부분을 결 방향으로 빗질하듯 쓰다듬으면 잔머리들의 결이 정렬되게."
 *
 * 예전 빗(17a COMB)과 다른 점:
 *   예전 것은 "밀기"입니다 — 쓰다듬은 만큼 그 자리의 머리를 통째로 옮기는 변위장. 잔머리와 그 밑의 머리가 같이 밀려서
 *   튀어나온 각도는 그대로 남습니다. 그리고 2D 화면 전용이라 3D 조정 화면(43)에서는 버튼을 숨겨 두었습니다.
 *   이번 것은 "정렬"입니다 — 붓 안을 지나는 가닥 마디의 방향을 쓰다듬은 방향으로 돌립니다(마디 길이는 그대로).
 *   이미 그 방향인 머리는 거의 안 변하고, 엇나간 잔머리만 눕습니다. 붓을 지난 뒤쪽은 모양 그대로 따라 옮겨집니다.
 *   ※ (2026-10-05e) 실제로는 몸통 머리까지 손가락 방향으로 돌아 머리가 쓸려 나갔습니다 → 지금은 "그 자리 머리의 결"에 맞춥니다(아래 e 참고).
 *
 * 어떻게:
 *   · [빗질] 버튼(조정 화면 왼쪽 위 · 3D 조정일 때만 보임)을 켜면 한 손가락 드래그가 회전 대신 빗질이 됩니다.
 *     두 손가락(이동·확대), 휠, Shift+드래그(이동), 확대 막대, 앞/옆/뒤 탭은 그대로 됩니다. 회전하려면 빗질을 끄거나 탭을 누릅니다.
 *   · 붓이 닿는 자리 = 손가락 아래에서 카메라에 가장 가까운 가닥 점(겉머리). 그 점을 중심으로 한 공(반지름 = 화면의 radiusPx)
 *     안의 가닥만 바뀝니다 — 머리 반대편은 안 건드립니다. 그래서 확대하면 붓이 작아져 세밀하게 됩니다.
 *   · 빗질은 "공간에 남는 표본"(중심·방향·반지름)으로 저장하고, 성긴 3D 격자(방향 장)에 칠해 둡니다. 가닥을 만들 때마다
 *     (17b _adjGeometry → combStrand3D 자리) 지나가는 칸의 방향으로 마디를 돌립니다. 그래서 길이·컬 슬라이더를 움직여도
 *     빗질한 자리는 남고, 빗질을 많이 해도 느려지지 않습니다. 같은 자리를 다시 빗으면 새 방향이 옛 방향을 덮습니다.
 *     뿌리 쪽 gripFrom 구간은 덜 움직입니다(뿌리는 두피에 붙어 있음).
 *   · [↶] = 마지막 한 획 되돌리기. 머리 모델이 바뀌면(다른 사진 · 마네킹 켬/끔 · 다시 기르기) 빗질은 지웁니다.
 *
 * (2026-10-05b) 폰에서 써 본 뒤 — 사용자: "정확히 어떻게 써야 할지 잘 안 잡힌다. 뿌리 기준으로 건드려야 하나? 빗질은 뜬 부분·헝클어진
 *   부분을 보고 거기를 정렬하는 것. 적용되는 구간을 정확히 알 수 있게 작은 빗 모양 하나 올려놔도 좋겠다."
 *   실측(진단): 획 68 · 표본 904 · 바뀐 가닥 5895/10000 · 다시 그리기 426ms. 화면에서는 손가락에 가려 어디가 바뀌는지 안 보였고,
 *   100% 근처에서는 붓(3cm 상한)이 화면에서 반지름 12px쯤이라 손가락보다 작았습니다. 빗은 자리에 잔물결(지그재그)도 생겼습니다.
 *   ① 빗 표시 — 붓이 닿는 자리에 점선 원(= 실제로 바뀌는 범위)과 작은 빗 그림을 띄웁니다. 빗살이 가리키는 쪽 = 머리가 눕는 방향.
 *      터치에서는 손가락에 가리지 않게 빗을 손가락 위쪽 touchOffset px에 둡니다(바뀌는 자리도 거기 — 손가락이 아니라 빗이 닿는 곳).
 *      빗질을 켜면 화면 가운데에 빗이 먼저 보이고, 마우스는 올려놓기만 해도 따라다닙니다.
 *   ② 잔물결 없애기 — 방향을 손가락의 직전 몇 px이 아니라 지나온 길 dirLagPx 뒤의 점에서 지금 점으로 잡고(손떨림 제거),
 *      가닥에 적용한 뒤 이웃 마디끼리 방향을 한 번 고르게 합니다.
 *   ③ 쓰다듬는 동안 다시 그리는 간격을 120 → 250ms(폰에서 한 번 그리는 데 0.4초라 계속 밀렸음). 손을 떼면 바로 한 번 더 그립니다.
 *   쓰는 법: 뿌리와는 상관없습니다. 뜬 머리·헝클어진 자리에 빗(원)을 올리고, 눕히고 싶은 방향으로 쓸어 주면 원 안의 겉머리만 그 방향으로 눕습니다.
 *
 * (2026-10-05c) 화면에 보이는 대로 빗기 — 사용자: "눈에 보이는 가닥을 정리하려고 빗을 움직이는데 3D로는 그 위치가 아닌 것 같다.
 *   뒤에만 빗질했는데 앞으로 돌려 보니 앞이 엉망이 됐다. 목 주변 가닥은 어떻게 정리할지 모르겠다. 2D로 보고 빗질한다는 걸 적용해야."
 *   예전: 붓 = "손가락 아래에서 카메라에 가장 가까운 가닥 점 하나"를 중심으로 한 3cm 공. 그런데
 *        · 윤곽 가장자리나 목 옆 틈에서는 가까운 쪽 머리가 없어서 반대편(앞머리) 점이 잡혔고 → 뒤에서 빗었는데 앞이 바뀜
 *        · 공은 그 한 점 주변만 덮어서, 원 안에 보이는데 깊이가 다른 가닥(튀어나온 잔머리)은 안 바뀜
 *   지금: 붓 = 화면의 원 그 자체. 원 안에 "보이는" 가닥 점(카메라 쪽 절반 — 두상 가운데보다 depthMargin 넘게 뒤에 있는 점은 제외)을
 *        전부 찾아, 그 점들이 있는 3D 자리마다 작게(dab) 방향을 칠합니다. 깊이가 서로 달라도 원 안에 보이면 다 빗깁니다.
 *        두상 반대편은 원 안에 겹쳐 보여도 건드리지 않습니다.
 *        칠하는 자리 = 그 점이 "빗기 전에 있던 자리". 가닥에 적용할 때 빗기 전 자리에서 방향 장을 읽기 때문입니다 —
 *        지금 보이는 자리에 칠하면, 이미 한 번 빗어서 옮겨진 가닥은 다음 빗질이 닿지 않았습니다(합성 테스트에서 확인).
 *        그래서 적용 결과에 빗기 전 점 배열(_pre)을 달아 두고, 50번(어깨)도 그 표시를 넘겨줍니다.
 *
 * (2026-10-05e) 빗으면 머리가 빠지던 것 — 사용자(영상): "comb 기능을 적용하면서 수정하고 있는데 머리가 빠진다."
 *   영상: 옆에서 보고 귀 높이에서 머리 끝까지 두 번 쓸어내리니 목 앞 옆머리가 사라지고 목이 드러남 · 아래에 꺾인 가닥이 삐져나옴.
 *   원인 ① 원 안의 "모든" 가닥 마디를 손가락 방향과 똑같이 돌렸습니다(여러 번 겹치면 세기 1). 손가락은 결과 정확히 나란할 수 없어서
 *          (영상에서는 20°쯤 뒤로 기움) 이미 가지런한 몸통 머리까지 그 각도로 돌고, 붓을 지난 아래쪽은 통째로 따라 옮겨져 옆머리 전체가 뒤로 쓸려 갔습니다.
 *          재현(이 파일 그대로 · 합성 머리 3,368가닥 · 같은 동작): 끝이 1cm 넘게 옮겨진 몸통 가닥 892(중앙 3.6cm · 최대 7.1cm) · 목 앞 옆머리 31%만 남음.
 *          정수리를 지나 쓸면 더 심했습니다(984~1,822가닥 · 최대 40cm) — 가르마·가마 양쪽 머리가 한쪽으로 넘어감.
 *        ② 손가락 방향은 화면 평면 안의 방향이라 둥근 두상에서는 두피 속을 향합니다. 정면·뒤에서 쓸면 가닥이 두상 속에 묻혔습니다(609~953가닥).
 *   지금: "결 따라 빗기"(grain) — 가닥을 손가락 방향이 아니라 그 자리 머리의 결에 맞춥니다.
 *     · 결 격자: 붓을 댈 때, 빗기 전 가닥들의 "큰 방향"(앞뒤 flowSmooth를 이은 현)을 flowCell 칸마다 더해 둡니다(42번 결 정렬과 같은 생각).
 *       빗기 전 자리로 만들므로 빗질을 해도 안 바뀌고, 머리 모양(길이·컬)이 바뀌면 다시 읽습니다.
 *     · 가닥에 적용할 때 마디마다 목표를 따로 정합니다:
 *         제 무리(이 가닥과 flowOwn° 안쪽으로 같이 흐르는 이웃이 충분함)가 있으면 그 결 → 몸통 머리는 사실상 제자리. 가르마 양쪽·겹친 층도 각자 제 쪽 결.
 *         제 무리가 없으면(= 잔머리) 손가락 쪽으로 흐르는 이웃의 결 → 이웃 전체의 결 → 주변에 머리가 없으면 두상 쪽으로 flowReach칸 들어가며 찾음 → 그래도 없으면 손가락 방향.
 *         결이 갈려 어느 쪽인지 정할 수 없는 자리의 잔머리는 그대로 둡니다.
 *     · 마디 하나가 아니라 가닥의 큰 방향이 목표에서 벗어난 만큼만 돌립니다(tolFrom° 안쪽은 안 건드림 · tolFull° 이상은 세기만큼).
 *       회전을 마디에 그대로 적용하므로 잔 컬·웨이브는 모양 그대로 남습니다(예전: 빗은 자리는 직모가 됨).
 *     · 두상·목: 다시 이을 때 두상 속으로 가는 마디는 면을 타고 눕히고, 목 기둥(42번 neckPush) 속 점은 밖으로. 빗기 전부터 안쪽이던 점(뿌리)은 그대로.
 *     · 그래서 손가락 방향은 "어느 쪽 결인가"를 고를 때와 주변에 머리가 없는 잔머리에만 쓰입니다. 결을 가로질러 쓸어도 머리가 넘어가지 않습니다(넘기기는 스타일 쪽에서).
 *   같은 합성 테스트: 영상 동작 → 옮겨진 몸통 가닥 0 · 목 앞 옆머리 100% · 정수리 → 0 · 두상 속 가닥 0 · 마디 길이 오차 0%.
 *     윤곽 밖으로 삐죽 나온 잔머리(정면에서 가장자리를 쓸어내림): 결에서 벗어난 각 중앙 89° → 6~10°.
 *   끄기: COMB3D.grain=false(손가락 방향 그대로) · COMB3D.collide=false 후 COMB3D.refresh()
 *
 * (2026-10-05f) 다듬을수록 더 흐트러지던 것 — 사용자(영상·진단): "comb 테스트 중인데 머리를 다듬을수록 더 흐트러진다."
 *   진단: 획 11 · 표본 217 · 바뀐 가닥 6102/9999(제 무리의 결로 본 마디 37,866). 영상: 가장자리를 쓸 때마다 가닥이 몸통과 나란히 윤곽 밖에 떠서 남고, 더 빗으면 더 늘어남.
 *   원인 ① 몸통 머리까지 돌렸습니다. 실제 머리는 다발이 비스듬히 엇갈려(굽이) 결에서 tolFrom° 넘게 벗어난 마디가 많은데, 그 마디만 골라 돌리면
 *          나갔다 돌아오던 균형이 깨져 그 아래 꼬리가 통째로 옆으로 밀립니다. 밀린 가닥은 결과는 나란해서 다시 빗어도 안 들어갑니다.
 *          재현(합성 머리 29,000가닥 · 굽이 있음 · 영상과 같은 동작 33획): 0.2cm 넘게 옮겨진 가닥 6,976 · 윤곽 밖에 그려진 가닥 길이 1,323 → 1,655cm
 *          (굽이를 1.8배로 하면 1,443 → 14,241cm). 굽이가 없는 매끈한 머리(예전 합성 테스트)에서는 안 나타났습니다.
 *        ② 50번(어깨)이 몸통에 닿은 가닥에 "빗기 전 자리"(_pre)를 안 달아서, 안 빗은 가닥은 어깨에 얹힌 뒤 자리로, 빗은 가닥은 얹히기 전 자리로 결·붓 자리를 읽었습니다.
 *   지금: · flyOnly — 몸통 머리 속 마디는 안 돌립니다. 몸통 밖으로 뜬 구간(주변 3×3×3칸 가닥 수가 적은 자리)만 결 쪽으로 돌립니다.
 *         · anchor — 빗기 전 자리가 몸통 속이던 점은 밀려도 anchorLen 안에 제자리로 돌아옵니다(잔머리 꼬리는 안 붙듦 → 그대로 눕음).
 *         · pullIn — 붓이 닿은 마디가 몸통 밖에 떠 있으면 몸통 쪽으로 조금 기울입니다(결과 나란한 채 떠 있는 가닥도 붙음).
 *         · 50번: 몸통에 닿은 가닥에 언제나 _pre(어깨 전 자리)를 답니다.
 *   같은 테스트: 옮겨진 가닥 664 · 윤곽 밖 길이 1,323 → 856cm(굽이 1.8배: 1,443 → 1,024cm) · 획을 더할수록 줄어듦.
 *   대신: 몸통 겉면에 붙어서 엇갈린 다발은 이제 빗어도 안 펴집니다(예전 동작: COMB3D.flyOnly=false). 붙들기 끄기: COMB3D.anchor=false 후 COMB3D.refresh()
 *
 * (2026-10-05g) 빗어도 잔머리가 거의 그대로이던 것 — 사용자(영상·진단): "comb 기능 다듬는 중. 좀 더 결을 잘 탈 수 있게."
 *   진단: 획 16 · 표본 288 · 바뀐 가닥 881/9999. 영상: 윤곽 옆에 뜬 가닥을 따라 여러 번 쓸어내려도 거의 그대로 · 뾰족하게 솟은 자리도 남음.
 *   재현(합성 머리 1만 가닥 · 잔머리 172 · 가장자리를 26획): 뒤에서 본 가장자리 밖 잔머리 길이 715 → 634cm(붓이 칠한 잔머리 점 571 중 504가 그대로).
 *   원인 ① 몸통 판정이 4cm 상자(결 칸 3×3×3)의 가닥 수라, 겉면에서 1~2cm 뜬 잔머리는 "몸통 속"으로 잡혀 flyOnly에 걸려 안 돌았습니다.
 *        ② 가닥이 pickStrands(8000)보다 많으면 붓 자리 찾기가 건너뛰며 씀(9,999가닥 → 둘 중 하나) → 건너뛴 가닥이 혼자 뜬 잔머리면 붓에 아예 안 걸림.
 *        ③ 결과 나란한 채 떠 있는 가닥은 pullIn(≈ 17°)만큼만 기울고, 결을 거슬러 솟은 마디는 세기만큼만 돌아 옆으로 삐죽 나온 채 남음.
 *   지금: "겉면 타기"(surf) —
 *     · 몸통 겉면 거리장: 잔칸(0.65cm)마다 지나는 가닥 수로 몸통 칸을 정하고(기준 밀도는 자리마다 · 얇은 한 겹도 몸통), 칸마다 몸통까지의 거리를 구해 둠.
 *       마디의 세기 = 붓이 칠한 세기 × 겉면에서 뜬 정도(flyFrom~flyFull). 몸통 속 마디는 0 → 몸통은 그대로.
 *     · 다시 걷기(applySurf): 세기가 있는 첫 마디부터, 지금까지 이어 온 자리에서 가장 가까운 겉면의 결을 읽어 그쪽으로 돌림(방향만 바꿈 · 마디 길이 그대로).
 *       떠 있으면 뜬 만큼 겉면 쪽으로 방향을 틂(settle · 누르는 계산이 아니라 방향을 트는 것). 결을 거슬러 선 마디는 통째로 결 방향으로. 뾰족한 꺾임은 폄(relax).
 *     · 붓: 건너뛰는 가닥도 뜬 점은 전부 붓 자리 찾기에 넣고, 자리가 dabMax를 넘어도 뜬 점의 자리는 안 버림.
 *     · 붙들기(anchor)는 옆으로 밀린 몫만 되돌림(가닥을 따라 내려간 몫까지 되돌리면 길이가 남아 가닥이 접혔음).
 *   끄기: COMB3D.surf=false 후 COMB3D.refresh() → (f)까지의 동작과 점 단위로 같음(합성 테스트에서 확인).
 *
 * (2026-10-05h) 벗어난 자리까지 거슬러 올라가기 — 사용자: "빗이 쓸어내리는 방향으로 디렉션을 바꾸고 주변 가닥과 나란히 정렬되면 되지 않나.
 *   결과 나란한데 떠 있다는 건 스트랜드 범위를 벗어난 것 → ①(벗어나는 구간)까지 포함해서 작업해 봐."
 *   잔머리 한 가닥 = ① 몸통에서 바깥으로 비스듬히 나가는 몇 마디 + ② 그 자리에서 결과 나란히 늘어진 긴 구간. 눈에 띄는 건 ②라서 ②를 빗는데,
 *   ②는 이미 결과 나란해서 방향 정렬로는 돌릴 것이 없고, 어긋난 ①은 붓이 안 닿은 위쪽에 있습니다.
 *   지금: reachBack — 붓이 뜬 구간에 닿으면 그 가닥을 뿌리 쪽으로 거슬러 올라가, 뜬 구간 전체와 ①(몸통 속에서 시작됐으면 결에서 divAngle° 넘게 벗어난 마디까지)을
 *        같은 세기로 정렬합니다. ①이 결대로 돌면 ②는 모양 그대로 몸통 쪽으로 따라 들어옵니다. 결대로 가는 몸통 마디부터는 마디마다 lead배로 줄어 곧 멈춤.
 *        잔머리 구간의 허용 각도 따로(flyTol 0~6° — 몸통은 이미 "뜬 정도"로 빠지므로 조금만 어긋나도 맞춤).
 *   합성 테스트(①보다 한참 아래의 ②만 6획): 가장자리 밖 잔머리 715cm → 예전 676 · 방향 정렬만(reachBack=false, settle=0) 654 · ①까지(settle=0) 178 · ①까지 + settle 78.
 *     전체 26획: 715 → 42cm(방향 정렬 + ①만으로는 149) · 건드린 잔머리의 최대 꺾임 p90 135° → 51° · 0.2cm 넘게 옮겨진 몸통 가닥 346/9,828(1cm 넘게 60 —
 *     겉면에서 0.5~1.8cm 떠 있던 겉층이 안쪽으로 내려앉은 것) · 새로 45° 넘게 꺾인 몸통 가닥 0 · 두상 속 점 0 · 마디 길이 오차 0%.
 *     몸통 위만 쓸면 0.2cm 넘게 옮겨진 가닥 4~69(1cm 넘게 0~4) · 같은 획을 두 번 해도 결과 같음 · 되돌리기하면 빗기 전 배열 그대로.
 *   끄기: COMB3D.reachBack=false(붓이 칠한 마디만) · COMB3D.settle=0(방향 정렬만 — 겉면 쪽으로 안 틂) 후 COMB3D.refresh()
 *   대신: 솟은 자리가 펴지면 그만큼 가닥이 아래로 내려가 밑단 아래로 1~2cm 나오는 끝이 생길 수 있습니다(길이는 안 바꿈).
 *         결 읽기에 거리장 만들기가 더해져 머리 모양이 바뀐 뒤 첫 빗질 때 한 번 더 걸립니다(합성 1만 가닥: 45 → 180ms쯤).
 *
 * (2026-10-05i) 뒤만 빗었는데 목·얼굴 앞으로 가닥이 나옴 — 사용자(폰 영상·진단): "이전보다 나아진 건 맞는데 그래도 뜨는 건 있네. 흔히 쓰는 빗처럼 빗겨지길 바라는데
 *   그렇게까진 안 되네. 뒤만 빗었는데 목덜미와 얼굴로 튀어나온 가닥들 — 두상 뚫은 거지?"
 *   폰 실측(h): 12획 · 표본 168 → 바뀐 가닥 2,378/9,999 · 세기가 걸린 마디 22,911(그중 붓이 안 닿았는데 거슬러 올라가 넣은 마디 14,934) · 붓 자리 찾기 준비 32 → 464ms.
 *   결과 화면: 뺨·턱을 가로지르는 가닥, 목 앞에서 지그재그로 꺾인 가닥(f까지의 영상에는 없던 것 — h가 만든 문제).
 *   원인(코드로 확인한 것 — 실제 가닥 데이터로 한 가닥씩 추적한 것은 아님):
 *     ① 붓이 깊이를 안 가렸음: 원 안이면 두상 가운데 깊이(+depthMargin)까지 전부 칠함. 뒤에서 빗으면 겉의 뒷머리 뒤에 겹쳐 있던 옆머리·목 옆 속머리·얼굴 옆 머리까지 칠해짐.
 *        f까지는 그 점들이 "몸통"이라 아무 일도 없었지만, g부터는 속머리가 성겨서 "뜬 점"으로 잡힘.
 *     ② 거슬러 올라가기(h)가 가닥을 만들 때 "붓이 안 칠한 마디"로도 세기를 퍼뜨림 → 그 가닥의 뜬 구간 전체(화면에 안 보이던 쪽 포함)가 움직임.
 *     ③ 겉면 쪽으로 트는 방향이 "가장 가까운 숱 많은 자리"였는데, 목 옆·얼굴 옆 가닥에게는 그게 목·얼굴 건너편 머리일 수 있음 → 가닥이 목·얼굴을 가로질러 감
 *        (목은 neckPush가 밀어내 지그재그, 얼굴은 두피 타원체 밖이라 막는 것이 없음).
 *     ④ "빽빽한 몸통에서 2cm 넘게 떨어진 자리에 2가닥이 같이 지나가면 몸통"(g의 얇은 자리 규칙) → 같이 뜬 잔머리 묶음이 몸통이 되어 안 빗김("그래도 뜨는 건 있네"의 한 원인으로 추정).
 *   지금:
 *     · 보이는 겉층만 빗음(depthLayer): 화면 칸(visCell px)마다 카메라에 가장 가까운 머리보다 2.5cm 넘게 뒤에 있는 점은 붓에 안 걸림 — 빗이 닿는 겉만.
 *     · 거슬러 올라가기는 붓 쪽에서: 붓에 "직접 걸린" 가닥만, 그 가닥을 따라 뿌리 쪽으로 칠함(뜬 점은 계속 · 몸통 속으로 reachIn점 · 카메라 반대편으로 넘어가면 멈춤).
 *       가닥을 만들 때는 칠해진 마디에만 세기를 올림(안 칠한 자리로 안 번짐).
 *     · 겉면 쪽으로 트는 것은: 내려앉을 자리가 두상 축 건너편이 아니고, 거기까지 가는 길이 두상·목 속을 안 지나고, settleReach(3cm) 안일 때만.
 *     · 안전 상한(maxMove): 어떤 점도 빗기 전 자리에서 6cm보다 멀리 안 감.
 *     · 몸통 = 두꺼운 속이 있는 덩어리와 이어진 칸(+ 두피 가까이 붙은 얇은 한 겹). 멀리 뜬 잔머리 묶음은 잔머리.
 *     · 결이 갈리는 자리(가르마·가마)에 뜬 가닥은 그대로 두지 않고 빗 방향으로 눕힘(partFinger).
 *     · 뜬 점 표시는 머리 모양이 바뀔 때 한 번만 계산(붓 자리 찾기 준비가 다시 수십 ms).
 *   합성 테스트(1만 가닥 + 목 + 목 옆 속머리·얼굴 옆 가닥 260개를 넣은 머리 · 뒤에서 아래쪽을 10획): 그 260가닥 중 0.5cm 넘게 옮겨진 가닥 — h 16개 → 지금 0개.
 *     바뀐 가닥 수 h 1,519 → 지금 760. 가장자리 26획: 가장자리 밖 잔머리 715 → 56cm(h 42 · f 634) · ②만 6획: 98cm(h 78 · f 676) · 몸통 위만 쓸면 0.2cm 넘게 옮겨진 가닥 3~21.
 *     합성 머리에서는 영상처럼 "얼굴을 가로지르는" 데까지는 재현하지 못했습니다(가려진 가닥이 움직이는 것까지만 재현) — 폰에서 확인이 필요합니다.
 *   끄기: COMB3D.depthLayer=0(깊이 안 가림) · COMB3D.reachBack=false · COMB3D.settle=0 · COMB3D.maxMove=0 · COMB3D.partFinger=false · 전부 예전으로 COMB3D.surf=false
 *
 * (2026-10-07j) 빗어 넘기기 — 사용자: "빗 기능을 가닥뿐만 아니라 머리 뭉치의 결도 변화시킬 수 있도록 해야 돼 — 말 그대로 '빗어 넘기기'도 할 수 있게.
 *   최소한의 수정부터 시작하지만, 꼭 필요할 거야." (다른 손님 스타일을 얹은 뒤 윗머리가 뜨는데 빗으로는 못 고쳤음)
 *   지금까지의 빗(정리)은 일부러 몸통 머리를 안 건드립니다(e·f). 그래서 뭉치째 방향을 바꿀 방법이 없었습니다.
 *   [넘기기] 버튼(빗질 버튼 옆)을 켜고 쓸면, 원 안에 보이는 머리(겉에서 sweepDepth 깊이까지 · 몸통 포함)가 쓴 방향으로 돕니다:
 *     · 획은 정리 획과 따로 모읍니다(C.sweeps · 방향 장도 따로). 가닥을 만들 때 정리(또는 곱슬의 가위 — 55번)를 먼저 하고 그 위에 넘기기를 겁니다.
 *       그래서 [빗질]은 예전과 한 점도 다르지 않고, 곱슬머리(55번이 빗을 가위로 바꾼 상태)에서도 넘기기는 듣습니다.
 *     · 마디가 아니라 가닥의 큰 방향(앞뒤 flowSmooth를 이은 현)을 쓴 방향으로 돌립니다 → 컬·웨이브는 모양 그대로 통째로 돕니다. 마디 길이도 그대로.
 *     · 뿌리 쪽 sweepGrip 구간은 덜 돕니다. 붓을 지난 아래쪽은 모양 그대로 따라 옮겨집니다(더 넘기려면 이어서 쓸어 주면 됨).
 *     · 쓴 방향은 화면 평면의 방향이라, 두피 가까이에서는 두상 면을 타는 방향으로 눕혀서 씁니다(sweepWrap) — 옆으로 쓸면 머리가 허공으로 뻗지 않고 두상을 감아 넘어감.
 *       두상·목 속으로는 못 들어갑니다(정리와 같은 막기). 얼굴 쪽은 안 막습니다(일부러 보내는 경우가 있으므로).
 *     · ↶는 정리·넘기기 가운데 마지막 한 획을 되돌립니다. 등록 스타일에는 아직 안 들어갑니다(이 손님 화면에서만).
 *   끄기: COMB3D.sweep=false 후 COMB3D.refresh() · 넘긴 것만 지우기: COMB3D.clearSweeps()
 *
 * (2026-10-08k) 넘기기 세기 조절 — 사용자: "sweep 좋네. 좀 센 느낌도 있긴 한데 … sweep을 켤 때 강도 조절할 수 있도록 했으면 좋겠어."
 *   [넘기기]를 켜면 버튼 옆에 세기 막대(1~10)가 나옵니다. 세기 = "한 번 쓸 때 얼마나 넘어가나"(표본 하나의 세기 sweepStrength). 여러 번 쓸면 쌓여서 끝까지 넘어갑니다.
 *   붓 하나가 같은 칸을 여러 번 칠하므로 표본 세기와 체감은 비례하지 않습니다 → 막대는 0.03~0.6을 같은 비율로 나눔(붓 가운데가 한 획에 도는 정도 — 합성 계산):
 *     1(0.03) ≈ 25% · 3(0.06) ≈ 50% · 5(0.11) ≈ 75% · 7(0.22) ≈ 95% · 10(0.6 — 지금까지의 값) = 100%(가장자리 가까이까지).
 *   기본은 7(예전 10보다 조금 약하게 — 붓 가운데는 한 획에 거의 넘어가고 가장자리는 덜 딸려 감). 고른 값은 이 기기에 기억합니다. 이미 그은 획은 안 바뀝니다(그은 뒤부터).
 *   콘솔: COMB3D.setSweepLevel(1~10)
 *
 * 아직 안 되는 것 / 알아둘 것:
 *   · 등록 스타일에는 들어가지 않습니다(이 손님 화면에서만).
 *   · 쓰다듬는 동안 머리는 liveMs마다 다시 그립니다(가닥이 많으면 반 박자 늦게 따라옴).
 *   · 화면 쪽으로 곧장 튀어나온 잔머리는 화면에서 점으로 보여 붓에 조금만 걸립니다 — 옆에서 보이게 돌려 놓고 빗는 편이 잘 됩니다.
 *   · [빗질](정리)로는 머리를 다른 방향으로 넘길 수 없습니다(결 정렬만) — 넘기려면 [넘기기](j). 결이 갈리는 자리(가르마 바로 위)의 잔머리는 안 눕는 경우가 있습니다.
 *
 * 끄기: COMB3D.enabled=false; COMB3D.refresh() · 지우기: COMB3D.clear()
 * ========================================================================== */
var COMB3D = (function () {
  'use strict';
  var W = window, TAG = '[빗질 3D]';
  var C = Object.assign({
    enabled: true,
    on: false,          // 빗질 모드(버튼)
    radiusPx: 30,       // 붓 반지름(화면 px)
    maxRadius: 0.16,    // 붓 반지름 상한(모델 단위 ≈ 3cm) — 축소해 놓고 빗어도 한 번에 머리 전체가 눕지 않게
    cell: 0.025,        // 방향 장 격자 칸(모델 단위 ≈ 0.45cm)
    pickPx: 22,         // 손가락 아래 이 안쪽에서 가장 가까운(카메라 쪽) 가닥 점을 붓 중심으로
    strength: 0.6,      // 한 표본이 방향을 돌리는 세기(0~1) — 여러 번 쓰다듬으면 쌓임
    falloff: 1.4,       // 붓 가장자리로 갈수록 약하게
    gripFrom: 0.12,     // 가닥의 앞 12%(뿌리 쪽)는 덜 움직임
    spacing: 0.35,      // 붓 반지름의 이 비율만큼 움직일 때마다 표본 하나
    minMovePx: 3,
    maxSamples: 1500,
    dab: 0.045,         // 보이는 점마다 칠하는 작은 공의 반지름(모델 단위 ≈ 0.8cm)
    dabCell: 0.03,      // 보이는 점을 이 크기의 3D 칸마다 하나로 줄임(≈ 0.5cm)
    dabMax: 1500,       // 표본 하나가 칠하는 자리 수 상한(넘으면 건너뛰며 고름)
    depthMargin: 0.2,   // 두상 가운데보다 이만큼(≈ 3.5cm) 넘게 뒤에 있는 점은 안 빗음(반대편 머리)
    liveMs: 250,        // 쓰다듬는 동안 다시 그리는 간격
    dirLagPx: 22,       // 방향 = 지나온 길에서 이만큼 뒤의 점 → 지금 점(손떨림 제거)
    touchOffset: 52,    // 터치: 빗을 손가락 위쪽 이 px에 둠(손가락에 안 가리게) · 0 = 손가락 바로 아래
    indicator: true,    // 빗 표시(점선 원 + 빗 그림)
    // (2026-10-05e) 결 따라 빗기 — 가닥을 손가락 방향이 아니라 "그 자리 머리의 결"에 맞춤. 손가락 방향은 결이 갈리는 자리에서 어느 쪽 결인지 고를 때와, 주변에 머리가 없는 잔머리에만 씀
    grain: true,
    flowCell: 0.07,     // 결을 읽는 칸(모델 단위 ≈ 1.3cm · 42번 결 정렬과 같은 크기) — 그 칸과 이웃 칸(3×3×3)을 지나는 가닥들의 큰 방향
    flowSmooth: 0.2,    // 가닥의 "큰 방향"을 재는 길이(앞뒤로 ≈ 3.7cm씩) — 이보다 잔 컬·웨이브는 방향으로 안 침(그래서 빗어도 안 펴짐)
    flowMin: 24,        // 이웃 칸들에 가닥이 적어도 이만큼은 지나가야 "머리가 있다"고 봄(가닥 8000개 기준 · 적으면 비례해서 낮춤)
    flowNear: 2,        // 그리고 몸통 머리의 보통 칸(가닥이 가장 많이 사는 밀도) 가닥 수의 이 배수는 돼야 함 — 겉으로 뜬 잔머리들끼리의 방향이 결이 되지 않게
    flowDense: 0.2,     // 보통 칸의 이 비율 넘게 빽빽한 칸 = 몸통 머리(그 칸의 결과 나란한 마디는 바로 통과)
    flowShare: 1,       // 이웃 머리 가운데 이 가닥과 같은 쪽으로 흐르는 무리가 (flowNear 기준의) 이 비율은 돼야 "제 무리"로 침
    flowOwn: 55,        // 도: 이 가닥의 큰 방향에서 이 안쪽으로 흐르는 이웃 = 제 무리(가르마 양쪽·겹친 층은 각자 제 무리를 따름 → 안 움직임)
    flowFinger: 60,     // 도: 제 무리가 없는 가닥(잔머리)은, 손가락 방향에서 이 안쪽으로 흐르는 이웃 머리의 결을 따름
    flowCoh: 0.6,       // 그것도 없으면 이웃 전체의 결 — 결집도(평균 벡터 길이)가 이보다 낮으면(결이 갈리는 자리) 안 건드림
    flowReach: 3,       // 주변에 머리가 없으면(겉면 밖으로 멀리 뜬 꼬리) 두상 쪽으로 이 칸 수까지 들어가며 결을 찾음 · 그래도 없으면 손가락 방향
    tolFrom: 12, tolFull: 28,  // 도: 가닥의 큰 방향이 목표에서 이 안쪽으로만 벗어나 있으면 안 건드림 · 이 이상이면 세기만큼 돌림(사이는 서서히)
    collide: true,      // 빗은 가닥이 두상·목 안으로 못 들어가게
    // (2026-10-05f) 몸통 머리는 제자리에 — 빗은 뒤 아래쪽이 통째로 밀려 윤곽 밖으로 나가던 것을 막음(머리말 f 참고)
    anchor: true,
    flyOnly: true,      // 몸통 밖으로 뜬 구간(잔머리)만 돌림 — 몸통 속 마디는 결에서 벗어나 있어도 그대로(끄면 몸통의 엇갈린 다발도 펴지만 아래쪽이 밀림)
    anchorLen: 0.13,    // 밀린 가닥이 제자리로 돌아오는 길이(모델 단위 ≈ 2.5cm) — 짧을수록 단단히 붙듦
    bodyFull: 8,        // 주변(3×3×3칸) 가닥 수가 보통 칸의 이 배수면 "몸통 머리 속"(flowNear배 이하는 몸통 밖 = 잔머리 · 사이는 서서히)
    pullIn: 0.3,        // 몸통 밖에 뜬 채로 빗긴 마디를 몸통 쪽으로 기울이는 정도(≈ 17°) · 0 = 끔
    headLift: 1.02,     // 두피 타원체의 이 배수 껍질 밖에 둠(42번 다시 기르기와 같은 값)
    // (2026-10-05g) 겉면 타기 — 몸통인지 잔머리인지를 "몸통 겉면에서 얼마나 떠 있나"(잔칸 거리장)로 가리고, 빗은 잔머리를 겉면까지 내려 앉힘(머리말 g 참고)
    surf: true,
    surfThr: 0.3,       // 잔칸(flowCell의 절반 ≈ 0.65cm)을 지나는 가닥 수가 몸통 보통 칸의 이 비율은 돼야 "빽빽한 몸통"
    surfNbr: 6,         // 몸통 후보: 둘레 26칸 중 이만큼은 같이 기준을 넘어야 함(한 줄로 지나가는 잔머리 묶음 제외)
    surfCore: 12,       // 몸통의 "속": 둘레 26칸 중 이만큼이 후보인 칸. 속과 이어진 후보만 몸통
    surfHead: 1.15,     // 속과 안 이어진 후보라도 두상 타원체의 이 배수 안(≈ 두피에서 1.5cm)에 있으면 몸통(이마·옆의 얇은 한 겹)
    flyFrom: 0.02, flyFull: 0.05,     // 겉면(가장 바깥 몸통 칸의 가운데)에서 이만큼(≈ 0.4cm) 안쪽은 몸통(안 돌림) · 이만큼(≈ 0.95cm) 넘게 뜨면 온전히 잔머리(사이는 서서히)
    depthLayer: 0.13,   // (i) 붓에 걸리는 깊이: 화면의 그 자리에서 카메라에 가장 가까운 머리보다 이만큼(≈ 2.5cm) 넘게 뒤에 있는 점은 안 빗음(겉층만) · 0 = 예전처럼 두상 가운데 깊이까지 전부
    visCell: 4,         // 그 "가장 가까운 깊이"를 재는 화면 칸(px)
    partFinger: true,   // (i) 결이 갈리는 자리(가르마·가마)에 뜬 가닥은 빗 방향으로 눕힘(예전: 그대로 둠 → 정수리에 뜬 고리가 남음)
    reachIn: 4,         // 거슬러 올라갈 때 몸통 속으로 들어간 뒤 더 칠하는 점 수(벗어나기 시작한 마디가 몸통 속에 있음)
    reachBack: true,    // (h) 붓이 뜬 구간에만 닿아도 그 가닥이 몸통에서 벗어난 자리까지 거슬러 올라가 같이 정렬(머리말 h 참고) · false = 붓이 칠한 마디만
    divAngle: 15,       // 도: 거슬러 올라갈 때, 몸통 속 마디가 그 자리 결에서 이 넘게 벗어나 있으면 아직 "벗어나는 구간"으로 봄
    flyTol: 0, flyTolFull: 6,   // 도: 겉면 타기에서 쓰는 허용 각 — 몸통은 "겉면에서 뜬 정도"로 이미 빼므로, 잔머리 구간은 조금만 벗어나도 맞춤(tolFrom/tolFull은 surf=false일 때만)
    lead: 0.6,          // 잔머리가 몸통에서 벗어나기 시작하는 마디(아직 겉면 근처)도 뒤 마디 세기의 이 비율만큼 같이 돌림 — 꺾여 나가는 자리가 남지 않게
    settle: 0.7,        // 빗긴 마디가 겉면보다 떠 있으면 한 마디에 이만큼(마디 길이의 배수 ≈ 35°)까지 겉면 쪽으로 내려 앉힘 · 0 = 끔
    maxMove: 0.32,      // (i) 안전 상한: 어떤 점도 빗기 전 자리에서 이만큼(≈ 6cm)보다 멀리 안 감 · 0 = 끔
    settleReach: 0.16,  // (i) 겉면에서 이만큼(≈ 3cm)보다 멀리 뜬 마디는 겉면 쪽으로 안 틂 — 멀리 있는 숱 많은 자리로 끌려가지 않게(방향 정렬·①은 그대로)
    settleGain: 0.6,    // 한 마디에 뜬 거리의 이 비율씩 다가감(1 = 한 번에 — 겉면의 들쭉날쭉을 그대로 따라 잔물결이 생김)
    ease: 0.5,          // 목표 방향에 직전 마디 방향을 이만큼 섞음(잔물결 제거) · 0 = 끔
    relax: 2,           // 빗긴 구간의 뾰족한 꺾임을 고르게 펴는 횟수(마디 길이는 그대로) · 0 = 끔
    pickStrands: 8000,  // 붓 자리 찾기에 쓰는 가닥 수 상한(넘으면 건너뛰며 씀)
    // (2026-10-07j) 빗어 넘기기 — 원 안의 머리(몸통 포함)를 쓴 방향으로 돌림(머리말 j 참고)
    sweep: true,
    mode: 'tidy',       // 'tidy' = 정리(잔머리를 결에 맞춤 — 지금까지의 빗) · 'sweep' = 넘기기
    sweepStrength: 0.6, // 한 표본이 돌리는 세기(겹쳐 쓸면 1까지 쌓임) — (k) 세기 막대가 정함(sweepLevel)
    sweepLevel: 7,      // (k) 세기 막대 1~10 → sweepStrength 0.03~0.6(같은 비율로)
    sweepGrip: 0.12,    // 가닥의 앞 12%(뿌리 쪽)는 덜 돎
    sweepTol: 3,        // 도: 큰 방향이 쓴 방향에서 이 안쪽이면 안 건드림
    sweepDepth: 0.2,    // 넘기기 붓에 걸리는 깊이(≈ 3.8cm — 뭉치의 속까지 같이 넘어가게 · 정리는 depthLayer 2.5cm)
    sweepWrap: true,    // 두피 가까이에서는 쓴 방향을 두상 면을 타는 방향으로 눕혀 씀
    wrapNear: 1.15, wrapFar: 1.5   // 두피 타원체의 이 배수 안쪽은 온전히 면을 탐 · 이 배수 밖은 쓴 방향 그대로(사이는 서서히)
  }, W.COMB3D || {});
  C.sweeps = [];        // (j) 넘기기 표본 — 모양은 samples와 같음
  if (C.mode !== 'sweep') C.mode = 'tidy';
  C.samples = [];       // {dabs: Float32Array[x,y,z,w …], m, dx,dy,dz, k, g}
  var S = C.stats = { strokes: 0, touched: 0, _t: 0, ms: 0, pickMs: 0, pickPts: 0, pickFly: 0, pickHidden: 0, reached: 0, dabs: 0, seen: 0, tOwn: 0, tSide: 0, tAll: 0, tReach: 0, tFinger: 0, tSkip: 0, _to: 0, _ts: 0, _ta: 0, _tr: 0, _tf: 0, _tk: 0, pushed: 0, neck: 0, _pu: 0, _nk: 0, anch: 0, pin: 0, _an: 0, _pi: 0, fly: 0, _fl: 0, up: 0, _up: 0, clamp: 0, _cl: 0, surfRef: 0, surfCells: 0, flowRef: 0, flowCells: 0, flowMs: 0, err: null };
  var ver = 0, gid = 0, modelRef = null;
  S._sw = 0; S._swp = 0; S.swept = 0; S.sweptPush = 0; S.sweepStrokes = 0;

  function now() { try { return performance.now(); } catch (e) { return Date.now(); } }
  function scr() { try { return currentScreen; } catch (e) { return ''; } }
  function m3() { try { return (model3D && model3D.initialized) ? model3D : null; } catch (e) { return null; } }
  function a3on() { try { return !!(W.ADJUST3D && W.ADJUST3D.on); } catch (e) { return false; } }
  function usable() { return !!(C.enabled && a3on() && scr() === 'adjust' && m3()); }

  /* ────────────────────────────────────────────────────────────────────────
   * ① 적용 — 표본을 "방향 장"(성긴 3D 격자)에 칠해 두고, 가닥은 지나가는 칸의 방향으로 돌림
   *    처음에는 표본을 하나씩 순서대로 가닥에 적용했는데(표본 223개 · 가닥 2천 개에 150ms, 표본 10배면 1.2초),
   *    표본 수만큼 느려져서 격자로 바꿨습니다 — 가닥 하나당 점 수만큼만 조회하므로 빗질을 많이 해도 느려지지 않습니다.
   *    칸의 값 V = 방향들의 섞인 벡터(새 빗질이 옛 것을 a만큼 덮음). |V| = 그 칸의 세기(반대 방향 빗질은 서로 지움).
   * ────────────────────────────────────────────────────────────────────── */
  var F = null, fDone = 0, fEpoch = 0, epoch = 0;     // F: 격자 · fDone: 격자에 칠한 표본 수 · epoch: 되돌리기/지우기 때 올림
  var OFF = 512, SPAN = 1024;
  function newField() { return { map: new Map(), V: new Float32Array(3 * 4096), n: 0, mn: [Infinity, Infinity, Infinity], mx: [-Infinity, -Infinity, -Infinity] }; }
  function splatPoint(f, x, y, z, r, k, dx, dy, dz) {
    var cell = C.cell, r2 = r * r, x0 = Math.floor((x - r) / cell), x1 = Math.floor((x + r) / cell), y0 = Math.floor((y - r) / cell), y1 = Math.floor((y + r) / cell),
      z0 = Math.floor((z - r) / cell), z1 = Math.floor((z + r) / cell), a, b, c, key, i, d2, w, V;
    if (x0 < -OFF || y0 < -OFF || z0 < -OFF || x1 >= OFF || y1 >= OFF || z1 >= OFF) return;
    for (c = z0; c <= z1; c++) { var ez = (c + 0.5) * cell - z;
      for (b = y0; b <= y1; b++) { var ey = (b + 0.5) * cell - y;
        for (a = x0; a <= x1; a++) { var ex = (a + 0.5) * cell - x;
          d2 = ex * ex + ey * ey + ez * ez; if (d2 >= r2) continue;
          w = k * Math.min(1, 1.6 * (1 - Math.sqrt(d2) / r)); if (w < 0.004) continue;      // 가운데는 고르게, 가장자리만 약하게
          key = (a + OFF) + SPAN * ((b + OFF) + SPAN * (c + OFF));
          i = f.map.get(key);
          if (i === undefined) {
            i = f.n++; f.map.set(key, i);
            if (i * 3 + 3 > f.V.length) { var nv = new Float32Array(f.V.length * 2); nv.set(f.V); f.V = nv; }
          }
          V = f.V; i *= 3;
          V[i] = V[i] * (1 - w) + dx * w; V[i + 1] = V[i + 1] * (1 - w) + dy * w; V[i + 2] = V[i + 2] * (1 - w) + dz * w;
        }
      }
    }
    if (x - r < f.mn[0]) f.mn[0] = x - r; if (y - r < f.mn[1]) f.mn[1] = y - r; if (z - r < f.mn[2]) f.mn[2] = z - r;
    if (x + r > f.mx[0]) f.mx[0] = x + r; if (y + r > f.mx[1]) f.mx[1] = y + r; if (z + r > f.mx[2]) f.mx[2] = z + r;
  }
  function splat(f, s) {
    var D = s.dabs, m = s.m, j, r = C.dab;
    for (j = 0; j < m; j++) splatPoint(f, D[j * 4], D[j * 4 + 1], D[j * 4 + 2], r, s.k * D[j * 4 + 3], s.dx, s.dy, s.dz);
  }
  function syncField() {
    var n = C.samples.length;
    if (!F || fEpoch !== epoch || fDone > n) { F = newField(); fDone = 0; fEpoch = epoch; }
    for (; fDone < n; fDone++) splat(F, C.samples[fDone]);
    return n ? F : null;
  }
  var F2 = null, f2Done = 0, f2Epoch = 0;             // (j) 넘기기 방향 장
  function syncSweep() {
    var n = C.sweeps.length;
    if (!F2 || f2Epoch !== epoch || f2Done > n) { F2 = newField(); f2Done = 0; f2Epoch = epoch; }
    for (; f2Done < n; f2Done++) splat(F2, C.sweeps[f2Done]);
    return n ? F2 : null;
  }
  /* 두상(두피 타원체 · 가운데 높이) — 가닥마다 다시 재지 않게 잠깐 기억(47번과 같은 방식) */
  var headMemo = null, headAt = -1e9, headKey = null;
  function headShape() {
    var key = null, t = now();
    try { key = state._hair3Dneutral || state.hair3Dneutral || null; } catch (e) {}
    if (headMemo !== null && key === headKey && t - headAt < 400) return headMemo || null;
    var E = null, cy = 0;
    try { E = (typeof getScalpEllipsoid === 'function') ? getScalpEllipsoid() : getHeadEllipsoid(); } catch (e) { E = null; }
    try { var m = state.hair3Dneutral; if (m && isFinite(m.CY)) cy = m.CY; else if (typeof SCALP_CENTER_Y !== 'undefined') cy = SCALP_CENTER_Y; } catch (e) {}
    headMemo = (E && E.a > 0 && E.b > 0 && E.c > 0 && isFinite(cy)) ? { a2: E.a * E.a, b2: E.b * E.b, c2: E.c * E.c, cy: cy } : false;
    headAt = t; headKey = key;
    return headMemo || null;
  }
  var buf = new Float64Array(4 * 256), rbuf = new Float64Array(3 * 256), wbuf = new Float64Array(256), pbuf = new Float64Array(256), kbuf = new Int32Array(256);
  var DEG = Math.PI / 180;
  /* 그 자리에서 이 가닥이 따를 결 → GT(길이 1). 제 칸과 이웃 칸(3×3×3)의 머리를 봄.
     돌려주는 값: 1 = 제 무리(이 가닥과 같은 쪽으로 흐르는 이웃) · 2 = 손가락 쪽으로 흐르는 이웃 · 3 = 이웃 전체 · 0 = 주변에 머리가 없음 · −1 = 결이 갈려 정할 수 없음
     (s = 이 가닥의 큰 방향 · f = 손가락 방향 · cOwn/cFin = 같은 쪽으로 치는 각의 cos) */
  /* (2026-10-05f) 그 자리가 몸통 머리 속인가: 0 = 밖(잔머리 자리) … 1 = 속 */
  /* (2026-10-05g) 몸통 겉면까지의 거리(모델 단위 · 몸통 속 = 0) — 잔칸 거리장을 세 방향으로 이어 읽음 */
  function distAt(d, x, y, z) {
    var u = (x - d.x0) * d.inv - 0.5, v = (y - d.y0) * d.inv - 0.5, w = (z - d.z0) * d.inv - 0.5, i = Math.floor(u), j = Math.floor(v), k = Math.floor(w);
    if (i < 0 || j < 0 || k < 0 || i >= d.mx - 1 || j >= d.my - 1 || k >= d.mz - 1) return d.far;
    var fu = u - i, fv = v - j, fk = w - k, D = d.D, o = i + d.mx * (j + d.my * k), sy = d.mx, sz = d.mx * d.my;
    var c00 = D[o] + (D[o + 1] - D[o]) * fu, c10 = D[o + sy] + (D[o + sy + 1] - D[o + sy]) * fu, c01 = D[o + sz] + (D[o + sz + 1] - D[o + sz]) * fu, c11 = D[o + sz + sy] + (D[o + sz + sy + 1] - D[o + sz + sy]) * fu;
    c00 += (c10 - c00) * fv; c01 += (c11 - c01) * fv;
    return c00 + (c01 - c00) * fk;
  }
  /* 그 자리에서 몸통 쪽(거리가 줄어드는 쪽) 방향 → DG(길이 1). 돌려주는 값 = 기울기 크기(0이면 방향 없음) */
  var DG = new Float64Array(3);
  function towardBody(d, x, y, z) {
    var h = d.h, gx = distAt(d, x - h, y, z) - distAt(d, x + h, y, z), gy = distAt(d, x, y - h, z) - distAt(d, x, y + h, z), gz = distAt(d, x, y, z - h) - distAt(d, x, y, z + h), l = Math.sqrt(gx * gx + gy * gy + gz * gz);
    if (!(l > 1e-9)) return 0;
    DG[0] = gx / l; DG[1] = gy / l; DG[2] = gz / l; return l / (2 * h);
  }
  function bodyAt(fw, x, y, z) {
    var a = Math.floor((x - fw.x0) * fw.inv), b = Math.floor((y - fw.y0) * fw.inv), c = Math.floor((z - fw.z0) * fw.inv);
    if (a < 0 || b < 0 || c < 0 || a >= fw.nx || b >= fw.ny || c >= fw.nz) return 0;
    var v = (fw.GA[a + fw.nx * (b + fw.ny * c)] - fw.bLo) / (fw.bHi - fw.bLo);
    return v <= 0 ? 0 : v >= 1 ? 1 : v * v * (3 - 2 * v);
  }
  var GT = new Float64Array(3);
  function grainAt(fw, x, y, z, sx, sy, sz, fx, fy, fz, cOwn, cFin) {
    var ci = Math.floor((x - fw.x0) * fw.inv), cj = Math.floor((y - fw.y0) * fw.inv), ck = Math.floor((z - fw.z0) * fw.inv), a, b, c, o, gn, gm, gx, gy, gz, l;
    var ox = 0, oy = 0, oz = 0, on = 0, px = 0, py = 0, pz = 0, pn = 0, ax = 0, ay = 0, az = 0, an = 0, GN = fw.GN, GM = fw.GM, GX = fw.GX, GY = fw.GY, GZ = fw.GZ, nx = fw.nx, ny = fw.ny, nz = fw.nz;
    for (c = ck - 1; c <= ck + 1; c++) { if (c < 0 || c >= nz) continue;
      for (b = cj - 1; b <= cj + 1; b++) { if (b < 0 || b >= ny) continue;
        for (a = ci - 1; a <= ci + 1; a++) { if (a < 0 || a >= nx) continue;
          o = a + nx * (b + ny * c); gn = GN[o]; if (!gn) continue;
          an += gn; gm = GM[o]; if (!(gm > 1e-6)) continue;
          gx = GX[o]; gy = GY[o]; gz = GZ[o]; ax += gx; ay += gy; az += gz;
          if (gx * sx + gy * sy + gz * sz > cOwn * gm) { ox += gx; oy += gy; oz += gz; on += gn; }
          if (gx * fx + gy * fy + gz * fz > cFin * gm) { px += gx; py += gy; pz += gz; pn += gn; }
        }
      }
    }
    if (an < fw.near) return 0;
    var need = fw.near * C.flowShare;
    if (on >= need) { l = Math.sqrt(ox * ox + oy * oy + oz * oz); if (l > 1e-6) { GT[0] = ox / l; GT[1] = oy / l; GT[2] = oz / l; return 1; } }
    if (pn >= need) { l = Math.sqrt(px * px + py * py + pz * pz); if (l > 1e-6) { GT[0] = px / l; GT[1] = py / l; GT[2] = pz / l; return 2; } }
    l = Math.sqrt(ax * ax + ay * ay + az * az);
    if (l > 1e-6 && l / an >= C.flowCoh) { GT[0] = ax / l; GT[1] = ay / l; GT[2] = az / l; return 3; }
    return -1;
  }
  /* ────────────────────────────────────────────────────────────────────────
   * (2026-10-05g) 겉면 타기 — 붓이 칠한 "잔머리 구간"을 몸통 겉면 위의 결을 따라 다시 걷게 함
   *   마디마다: 세기 = 붓이 칠한 세기 × 그 마디가 (빗기 전에) 몸통 겉면에서 뜬 정도.  몸통 속 마디는 세기 0 → 그대로.
   *   세기가 있는 마디는, 지금까지 다시 이어 온 자리(q)에서 가장 가까운 몸통 겉면의 결을 읽어 그쪽으로 돌리고,
   *   q가 겉면보다 떠 있으면 뜬 만큼 겉면 쪽으로 방향을 틉니다(한 마디에 settle×길이까지). 그래서 빗긴 구간은 겉면에 내려앉아 결을 탑니다.
   *   붓이 안 닿은 뒤쪽은 빗기 전 방향 그대로 이어집니다(모양 그대로 따라 옮겨짐).
   * ────────────────────────────────────────────────────────────────────── */
  function applySurf(g, f, FW) {
    var SF = FW.DF, n = g.length, last = n - 1, cell = C.cell, map = f.map, V = f.V, U = buf, CB = rbuf, WB = wbuf, PB = pbuf, KB = kbuf;
    var i, p, q0, a, b, c, k, w, t, vx, vy, vz, sx, sy, sz, sl, len, L = 0, lo = n, hi = 0, dv;
    var px = g[0].x, py = g[0].y, pz = g[0].z, d0 = SF.d0, dW = 1 / (SF.d1 - SF.d0);
    // ① 마디 방향·길이
    for (i = 1; i < n; i++) {
      p = g[i];
      sx = p.x - px; sy = p.y - py; sz = p.z - pz; len = Math.sqrt(sx * sx + sy * sy + sz * sz);
      if (len > 1e-9) { U[i * 4] = sx / len; U[i * 4 + 1] = sy / len; U[i * 4 + 2] = sz / len; } else { U[i * 4] = 0; U[i * 4 + 1] = -1; U[i * 4 + 2] = 0; }
      U[i * 4 + 3] = len; L += len;
      px = p.x; py = p.y; pz = p.z;
    }
    // ② 세기: 붓이 칠한 세기(PB) × 겉면에서 뜬 정도 → WB
    for (i = 1; i < n; i++) {
      WB[i] = 0; PB[i] = 0; KB[i] = -1;
      if (!(U[i * 4 + 3] > 1e-9)) continue;
      p = g[i]; q0 = g[i - 1];
      sx = (p.x + q0.x) * 0.5; sy = (p.y + q0.y) * 0.5; sz = (p.z + q0.z) * 0.5;
      a = Math.floor(sx / cell) + OFF; b = Math.floor(sy / cell) + OFF; c = Math.floor(sz / cell) + OFF;
      if (a < 0 || b < 0 || c < 0 || a >= SPAN || b >= SPAN || c >= SPAN) continue;
      k = map.get(a + SPAN * (b + SPAN * c));
      if (k === undefined) continue;
      vx = V[k * 3]; vy = V[k * 3 + 1]; vz = V[k * 3 + 2]; w = Math.sqrt(vx * vx + vy * vy + vz * vz);
      if (!(w > 0.01)) continue;
      t = i / last; if (t < C.gripFrom) w *= t / C.gripFrom;
      if (w > 1) w = 1;
      KB[i] = k; PB[i] = w;
      if (C.flyOnly) { dv = (distAt(SF, sx, sy, sz) - d0) * dW; w *= dv <= 0 ? 0 : dv >= 1 ? 1 : dv * dv * (3 - 2 * dv); }
      WB[i] = w;
    }
    // 잔머리가 몸통에서 벗어나기 시작하는 마디(아직 겉면 근처라 세기가 0에 가까움)도 같이 — 안 그러면 꺾여 나가는 자리가 그대로 남음
    if (C.reachBack) {
      // (2026-10-05h) 벗어난 자리까지 거슬러 올라가기 — 붓이 뜬 구간(②: 몸통 밖에서 결과 나란히 늘어진 부분)에만 닿아도,
      //   그 가닥이 몸통에서 벗어나기 시작한 구간(①: 바깥으로 비스듬히 나간 몇 마디)까지 같은 세기로 정렬함.
      //   ①이 결대로 돌면 그 뒤는 모양 그대로 몸통 쪽으로 따라 들어옴. 몸통 속으로 들어가면 마디마다 lead배로 줄어 곧 멈춤(뿌리 쪽 gripFrom은 그대로 적용).
      var carry = 0, kc = -1, fb, gm, uv, cDiv = Math.cos(Math.max(1, C.divAngle) * DEG);
      for (i = last; i >= 1; i--) {
        w = WB[i];
        if (w > carry) { carry = w; kc = KB[i]; continue; }
        if (!(carry > 0.05) || !(U[i * 4 + 3] > 1e-9)) continue;
        if (!(PB[i] > 0.01)) { carry *= 0.5; continue; }                   // (i) 붓이 칠한 마디에만(거슬러 올라가는 칠은 붓 쪽에서 그 가닥을 따라 함) — 안 칠한 자리로는 안 번짐
        p = g[i]; q0 = g[i - 1];
        dv = (distAt(SF, (p.x + q0.x) * 0.5, (p.y + q0.y) * 0.5, (p.z + q0.z) * 0.5) - d0) * dW; fb = dv > 0;
        if (!fb) {
          // 몸통 속: 이 마디가 아직 그 자리 결에서 벗어나 있으면(= ①이 몸통 속에서 시작된 부분) 줄이지 않고 계속 올라감. 결대로 가는 마디부터는 마디마다 lead배로 줄여 곧 멈춤
          a = Math.floor(((p.x + q0.x) * 0.5 - FW.x0) * FW.inv); b = Math.floor(((p.y + q0.y) * 0.5 - FW.y0) * FW.inv); c = Math.floor(((p.z + q0.z) * 0.5 - FW.z0) * FW.inv); k = 0;
          if (a >= 0 && b >= 0 && c >= 0 && a < FW.nx && b < FW.ny && c < FW.nz) {
            a += FW.nx * (b + FW.ny * c);
            if (FW.GN[a] >= FW.dense && FW.GM[a] >= 0.85 * FW.GN[a] && FW.GX[a] * U[i * 4] + FW.GY[a] * U[i * 4 + 1] + FW.GZ[a] * U[i * 4 + 2] < cDiv * FW.GM[a]) k = 1;
          }
          if (!k) carry *= C.lead;
        }
        t = i / last; gm = t < C.gripFrom ? t / C.gripFrom : 1; uv = carry * gm;
        if (uv > w) { WB[i] = uv; if (KB[i] < 0) KB[i] = kc; S._up++; }
      }
    } else if (C.lead > 0) for (i = last - 1; i >= 1; i--) { w = WB[i + 1] * C.lead; if (w > PB[i]) w = PB[i]; if (w > WB[i]) WB[i] = w; }
    for (i = 1; i < n; i++) if (WB[i] > 0.01) { if (i < lo) lo = i; hi = i; }
    if (lo > hi) return g;
    // ③ 큰 방향(앞뒤 hw 마디를 이은 현 가운데 이 마디와 가장 나란한 것) — 잔 컬·웨이브는 모양 그대로 통째로 돌리려고
    var hw = L > 0 ? Math.round(C.flowSmooth / (L / last)) : 1; if (!(hw >= 1)) hw = 1; else if (hw > 16) hw = 16;
    var A, B, ax, ay, az, tx, ty, tz, cl, dot, th;
    for (i = lo; i <= hi; i++) {
      if (!(WB[i] > 0.01)) continue;
      p = g[i]; q0 = g[i - 1];
      A = g[i - 1 - hw < 0 ? 0 : i - 1 - hw]; B = g[i + hw > last ? last : i + hw];
      ax = U[i * 4]; ay = U[i * 4 + 1]; az = U[i * 4 + 2];
      sx = B.x - A.x; sy = B.y - A.y; sz = B.z - A.z; sl = Math.sqrt(sx * sx + sy * sy + sz * sz);
      if (sl > 1e-9) { sx /= sl; sy /= sl; sz /= sl; dot = sx * ax + sy * ay + sz * az; } else { sx = ax; sy = ay; sz = az; dot = 1; }
      tx = p.x - A.x; ty = p.y - A.y; tz = p.z - A.z; cl = Math.sqrt(tx * tx + ty * ty + tz * tz);
      if (cl > 1e-9) { th = (tx * ax + ty * ay + tz * az) / cl; if (th > dot) { dot = th; sx = tx / cl; sy = ty / cl; sz = tz / cl; } }
      tx = B.x - q0.x; ty = B.y - q0.y; tz = B.z - q0.z; cl = Math.sqrt(tx * tx + ty * ty + tz * tz);
      if (cl > 1e-9) { th = (tx * ax + ty * ay + tz * az) / cl; if (th > dot) { dot = th; sx = tx / cl; sy = ty / cl; sz = tz / cl; } }
      CB[i * 3] = sx; CB[i * 3 + 1] = sy; CB[i * 3 + 2] = sz;
    }
    // ④ 다시 걷기 — 처음 세기가 있는 마디부터 끝까지
    var t0 = Math.max(0, C.flyTol) * DEG, t1 = Math.max(t0 + 1e-3, C.flyTolFull * DEG), cOwn = Math.cos(C.flowOwn * DEG), cFin = Math.cos(C.flowFinger * DEG), reach = Math.max(0, C.flowReach | 0);
    var HD = headShape(), HDc = C.collide ? HD : null, NK = null, lift = C.headLift > 0 ? C.headLift : 1.02, yCap = (HD ? HD.cy : 0.15) + 0.3, dT = d0 * 0.5;
    var a2 = 1, b2 = 1, c2 = 1, hcy = 0, K0 = Math.cos(40 * DEG), K1 = Math.cos(80 * DEG), NKs = null, PT = { x: 0, y: 0, z: 0 }, mvMax = C.maxMove > 0 ? C.maxMove : 0;
    try { NKs = (W.REGROW && typeof W.REGROW.neckPush === 'function') ? W.REGROW.neckPush : null; } catch (e6) { NKs = null; }
    if (HDc) { a2 = HDc.a2; b2 = HDc.b2; c2 = HDc.c2; hcy = HDc.cy; try { NK = (W.REGROW && typeof W.REGROW.neckPush === 'function') ? W.REGROW.neckPush : null; } catch (e3) { NK = null; } }
    var out = new Array(n), qx = g[lo - 1].x, qy = g[lo - 1].y, qz = g[lo - 1].z, ex, ey, ez, moved = 0;
    var lx = 0, ly = 0, lz = 0, hasL = false, de, gl, bx, by, bz, steer, mpx, mpy, mpz, fx, fy, fz, fl, code, hh, nx, ny, nz, nl, cin, gd, gpl, kk, du, wr, fr, ang, cx, cy, cz, cs, sn, kd, o, pt, r, yy, ee, flr, dn, e02;
    if (lo > 1) { lx = U[(lo - 1) * 4]; ly = U[(lo - 1) * 4 + 1]; lz = U[(lo - 1) * 4 + 2]; hasL = U[(lo - 1) * 4 + 3] > 1e-9; }
    for (i = 0; i < lo; i++) out[i] = g[i];
    for (i = lo; i < n; i++) {
      ax = U[i * 4]; ay = U[i * 4 + 1]; az = U[i * 4 + 2]; len = U[i * 4 + 3];
      w = i <= hi ? WB[i] : 0;
      if (w > 0.01 && len > 1e-9) {
        S._fl++;
        k = KB[i] * 3; fx = V[k]; fy = V[k + 1]; fz = V[k + 2]; fl = Math.sqrt(fx * fx + fy * fy + fz * fz); fx /= fl; fy /= fl; fz /= fl;      // 손가락 방향
        // 지금 자리(q)에서 몸통 겉면까지: 거리 de · 방향 b
        de = distAt(SF, qx, qy, qz); steer = false; mpx = qx; mpy = qy; mpz = qz; gl = 0;
        if (de > 1e-4 && de < SF.far && (gl = towardBody(SF, qx, qy, qz)) > 0.2) {
          bx = DG[0]; by = DG[1]; bz = DG[2];
          // (i) 가장 가까운 몸통이 두상·목 건너편이면(목 옆·얼굴 옆에 늘어진 가닥에게 "가장 가까운 숱 많은 자리"가 반대쪽 머리일 때) 그쪽은 못 감:
          //     내려앉을 자리가 두상 축의 반대편이거나, 거기까지 가는 길(가운데·끝)이 두상 속·목 속이면 이 마디는 제자리의 결만 봄.
          //     h에서는 이 확인 없이 틀어서, 가닥이 목·얼굴을 가로질러 앞으로 나왔습니다(사용자 영상).
          sx = qx + bx * de; sy = qy + by * de; sz = qz + bz * de; hh = 1;
          if (qx * sx + qz * sz < 0) hh = 0;
          else if (HD) {
            yy = sy - HD.cy; if (sx * sx / HD.a2 + yy * yy / HD.b2 + sz * sz / HD.c2 < 1) hh = 0;
            else { yy = (qy + sy) * 0.5 - HD.cy; if ((qx + sx) * (qx + sx) * 0.25 / HD.a2 + yy * yy / HD.b2 + (qz + sz) * (qz + sz) * 0.25 / HD.c2 < 1) hh = 0; }
          }
          if (hh && NKs) { try { PT.x = sx; PT.y = sy; PT.z = sz; if (NKs(PT) !== PT) hh = 0; else { PT.x = (qx + sx) * 0.5; PT.y = (qy + sy) * 0.5; PT.z = (qz + sz) * 0.5; if (NKs(PT) !== PT) hh = 0; } } catch (e5) {} }
          if (!hh) gl = 0;
          else { mpx = sx; mpy = sy; mpz = sz; }                           // 결은 내려앉을 자리(겉면)에서 읽음
          // 두상 안쪽이 아닌 쪽(옆·바깥)에 있는 몸통으로는 안 당김 — 얇은 앞머리·머리 끝이 옆의 숱 많은 쪽으로 쏠리지 않게
          nx = -qx; ny = qy > yCap ? yCap - qy : 0; nz = -qz; nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
          cin = nl > 1e-6 ? (bx * nx + by * ny + bz * nz) / nl : 1;
          steer = hh === 1 && C.settle > 0 && de > dT && de <= C.settleReach && cin > 0.2;      // settleReach보다 멀리 뜬 가닥은 안 당김(방향만 맞춤)
        }
        // 이 가닥이 따를 결: 제 무리(지금까지 걸어온 방향과 같이 흐르는 이웃) → 손가락 쪽 이웃 → 이웃 전체 → (주변에 머리가 없으면) 두상 쪽에서 찾음 → 손가락 방향
        if (hasL) { sx = lx; sy = ly; sz = lz; } else { sx = CB[i * 3]; sy = CB[i * 3 + 1]; sz = CB[i * 3 + 2]; }
        code = grainAt(FW, mpx, mpy, mpz, sx, sy, sz, fx, fy, fz, cOwn, cFin);
        if (code === 0) {
          // 겉면 자리의 머리가 성기면(머리 끝·가장자리) 몸통 속으로 더 들어가며 찾음: 몸통 쪽 방향을 알면 그쪽으로, 모르면 두상 쪽으로
          for (hh = 1; hh <= reach; hh++) {
            if (gl > 0.2) { cx = bx; cy = by; cz = bz; cl = 1; }
            else { cx = -mpx; cy = (mpy < yCap ? 0 : yCap - mpy); cz = -mpz; cl = Math.sqrt(cx * cx + cy * cy + cz * cz); if (!(cl > 1e-6)) break; }
            mpx += cx / cl * FW.fc; mpy += cy / cl * FW.fc; mpz += cz / cl * FW.fc;
            code = grainAt(FW, mpx, mpy, mpz, sx, sy, sz, fx, fy, fz, cOwn, cFin);
            if (code !== 0) { if (code > 0) code = 4; break; }
          }
        }
        // 머리 끝: 끝내 결을 못 찾았고 몸통이 이 마디의 뒤쪽(지나온 쪽)에만 있으면 밑단 아래로 늘어진 끝 — 옆에 기댈 결이 없으니 그대로 둠(손가락 방향으로 꺾지 않음)
        if (code === 0 && gl > 0.2 && bx * ax + by * ay + bz * az < -0.6) code = -2;
        if (code === -1) { S._tk++; if (C.partFinger) code = 0; }          // −1: 결이 갈리는 자리(가르마·가마) — 뜬 가닥은 빗이 지나가는 방향을 따름(빗으로 넘기는 쪽). partFinger=false면 그대로 둠
        if (code < 0) {}
        else {
          if (code === 0) { tx = fx; ty = fy; tz = fz; S._tf++; }
          else { tx = GT[0]; ty = GT[1]; tz = GT[2]; if (code === 1) S._to++; else if (code === 2) S._ts++; else if (code === 3) S._ta++; else S._tr++; }
          hh = 0;
          if (steer) {                                                     // 뜬 만큼 겉면 쪽으로 틂(결과 나란한 채 떠 있는 가닥도 내려앉음). 결과 나란한 쪽(머리 끝 아래·위)으로는 안 당김
            gd = bx * tx + by * ty + bz * tz; cx = bx - gd * tx; cy = by - gd * ty; cz = bz - gd * tz; gpl = Math.sqrt(cx * cx + cy * cy + cz * cz);
            if (gpl > 0.3) {
              kk = C.settleGain * (de - dT) / len; if (kk > C.settle) kk = C.settle; kk *= (cin >= 0.6 ? 1 : (cin - 0.2) / 0.4) / gpl;      // 한 번에 다 내리면 겉면 칸의 들쭉날쭉을 따라 잔물결이 생김 → 뜬 거리의 settleGain배씩
              tx += cx * kk; ty += cy * kk; tz += cz * kk; sl = Math.sqrt(tx * tx + ty * ty + tz * tz); tx /= sl; ty /= sl; tz /= sl; S._pi++; hh = 1;
            }
          }
          if (hasL && C.ease > 0 && lx * tx + ly * ty + lz * tz > 0) {       // 목표를 직전 마디 방향과 섞어 고르게(칸마다 결·거리가 조금씩 달라 생기는 잔물결 제거)
            tx += lx * C.ease; ty += ly * C.ease; tz += lz * C.ease; sl = Math.sqrt(tx * tx + ty * ty + tz * tz); tx /= sl; ty /= sl; tz /= sl;
          }
          du = ax * tx + ay * ty + az * tz;
          if (du < 0) {
            // 결을 거슬러 선 마디(뾰족하게 솟은 잔머리): 반만 돌리면 옆으로 삐죽 나온 채 남음 → 세기가 웬만하면 결 방향으로 통째로, 약하면 그대로
            wr = w <= 0.15 ? 0 : w >= 0.4 ? 1 : (w - 0.15) / 0.25; wr = wr * wr * (3 - 2 * wr);
            if (wr > 0.5) { sx = ax * (1 - wr) + tx * wr; sy = ay * (1 - wr) + ty * wr; sz = az * (1 - wr) + tz * wr; sl = Math.sqrt(sx * sx + sy * sy + sz * sz); if (sl > 0.2) { ax = sx / sl; ay = sy / sl; az = sz / sl; } else { ax = tx; ay = ty; az = tz; } }
          } else {
            // 큰 방향이 목표에서 벗어난 만큼 돌림(tolFrom° 안쪽은 그대로) — 회전을 마디에 그대로 적용하므로 잔 컬은 남음
            sx = CB[i * 3]; sy = CB[i * 3 + 1]; sz = CB[i * 3 + 2];
            if (sx * ax + sy * ay + sz * az < 0.5) { sx = ax; sy = ay; sz = az; }      // 현이 이 마디와 60° 넘게 다르면(꺾이는 자리) 마디 자체를 기준으로
            dot = sx * tx + sy * ty + sz * tz; if (dot > 1) dot = 1; else if (dot < -1) dot = -1;
            th = Math.acos(dot);
            if (th > t0 || (hh && th > 0.01)) {                              // 겉면 쪽으로 트는 중이면 허용 각 없이(안 그러면 겉면 0.3~0.5cm 앞에서 멈춤)
              fr = (hh || th >= t1) ? 1 : (th - t0) / (t1 - t0); if (fr < 1) fr = fr * fr * (3 - 2 * fr);
              ang = th * fr * w;
              cx = sy * tz - sz * ty; cy = sz * tx - sx * tz; cz = sx * ty - sy * tx; cl = Math.sqrt(cx * cx + cy * cy + cz * cz);
              if (ang >= 0.003 && cl > 1e-4) {                               // 축 둘레로 ang만큼(로드리게스)
                cx /= cl; cy /= cl; cz /= cl; cs = Math.cos(ang); sn = Math.sin(ang); kd = (cx * ax + cy * ay + cz * az) * (1 - cs);
                sx = ax * cs + (cy * az - cz * ay) * sn + cx * kd; sy = ay * cs + (cz * ax - cx * az) * sn + cy * kd; sz = az * cs + (cx * ay - cy * ax) * sn + cz * kd;
                ax = sx; ay = sy; az = sz;
              }
            }
          }
        }
        // 빗긴 구간에 남은 뾰족한 꺾임 펴기: 바로 앞 마디와 40° 넘게 꺾이면 앞 마디 쪽으로(80° 이상이면 relax×세기만큼). 완만한 굽이·컬은 그대로
        if (C.relax > 0 && hasL) {
          dot = ax * lx + ay * ly + az * lz;
          if (dot < K0) {
            fr = dot <= K1 ? 1 : (K0 - dot) / (K0 - K1); fr = fr * fr * (3 - 2 * fr) * w * (C.relax > 1 ? 1 : C.relax);
            sx = ax + (lx - ax) * fr; sy = ay + (ly - ay) * fr; sz = az + (lz - az) * fr; sl = Math.sqrt(sx * sx + sy * sy + sz * sz);
            if (sl > 0.2) { ax = sx / sl; ay = sy / sl; az = sz / sl; }
          }
        }
      }
      ex = qx + ax * len; ey = qy + ay * len; ez = qz + az * len;
      o = g[i];
      if (mvMax > 0 && len > 1e-9) {
        // (i) 안전 상한 — 어떤 점도 빗기 전 자리에서 maxMove(≈ 6cm)보다 멀리 가지 않음. 넘으면 그 안으로 당기고 마디 길이를 다시 맞춤.
        //     빗 한 번에 가닥이 두상·목을 돌아 반대편으로 넘어가는 일을 막는 마지막 울타리(정상적인 눕힘은 몇 cm 안).
        sx = ex - o.x; sy = ey - o.y; sz = ez - o.z; e02 = sx * sx + sy * sy + sz * sz;
        if (e02 > mvMax * mvMax) {
          kk = mvMax / Math.sqrt(e02); tx = o.x + sx * kk - qx; ty = o.y + sy * kk - qy; tz = o.z + sz * kk - qz; sl = Math.sqrt(tx * tx + ty * ty + tz * tz);
          if (sl > 1e-9) { ex = qx + tx / sl * len; ey = qy + ty / sl * len; ez = qz + tz / sl * len; S._cl++; }
        }
      }
      if (C.anchor && len > 1e-9) {
        // 붙들기 — 빗기 전 자리가 몸통 속이던 점은 제자리 쪽으로(앞에서 잔머리 구간이 눕으면서 뒤쪽 몸통 구간이 따라 밀린 것을 되돌림).
        //   안쪽(두상 쪽)으로 들어간 것은 안 되돌림 — 겉면에 내려앉히는 것과 싸우지 않게. 잔머리(몸통 밖이던 점)는 붙들지 않음.
        sx = ex - o.x; sy = ey - o.y; sz = ez - o.z; e02 = sx * sx + sy * sy + sz * sz;
        if (e02 > 1e-10) {
          dv = (distAt(SF, o.x, o.y, o.z) - d0) * dW; dv = dv <= 0 ? 1 : dv >= 1 ? 0 : 1 - dv * dv * (3 - 2 * dv);
          if (dv > 0 && !(w > 0.01)) {
            kk = len / (C.anchorLen > 0.01 ? C.anchorLen : 0.13); if (kk > 0.5) kk = 0.5; kk *= dv;
            // 가닥을 따라 밀린 몫(앞에서 솟은 자리가 펴지면 뒤쪽은 그만큼 아래로 내려감)은 되돌리지 않음 — 되돌리면 길이가 남아 가닥이 접힘. 옆으로 밀린 몫만.
            dot = sx * U[i * 4] + sy * U[i * 4 + 1] + sz * U[i * 4 + 2]; sx -= dot * U[i * 4]; sy -= dot * U[i * 4 + 1]; sz -= dot * U[i * 4 + 2];
            tx = ex - sx * kk - qx; ty = ey - sy * kk - qy; tz = ez - sz * kk - qz; sl = Math.sqrt(tx * tx + ty * ty + tz * tz);
            if (sl > 1e-9) { ex = qx + tx / sl * len; ey = qy + ty / sl * len; ez = qz + tz / sl * len; S._an++; }
          }
        }
      }
      if (HDc && len > 1e-9) {
        // 두상: 빗기 전부터 겉면보다 안쪽이던 점(뿌리 등)은 그 깊이까지만 허용
        yy = o.y - hcy; flr = Math.sqrt(o.x * o.x / a2 + yy * yy / b2 + o.z * o.z / c2); if (flr > lift) flr = lift;
        yy = ey - hcy; ee = Math.sqrt(ex * ex / a2 + yy * yy / b2 + ez * ez / c2);
        if (ee < flr - 1e-6) {
          yy = qy - hcy; nx = qx / a2; ny = yy / b2; nz = qz / c2; nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
          if (nl > 1e-9) {
            nx /= nl; ny /= nl; nz /= nl; tx = (ex - qx) / len; ty = (ey - qy) / len; tz = (ez - qz) / len; dn = tx * nx + ty * ny + tz * nz;
            if (dn < 0) {                                                  // 안쪽 성분을 빼고 면을 타고 눕힘
              tx -= dn * nx; ty -= dn * ny; tz -= dn * nz; sl = Math.sqrt(tx * tx + ty * ty + tz * tz);
              if (sl < 0.35) { q0 = g[i - 1]; tx = (o.x - q0.x) / len; ty = (o.y - q0.y) / len; tz = (o.z - q0.z) / len; dn = tx * nx + ty * ny + tz * nz; if (dn < 0) { tx -= dn * nx; ty -= dn * ny; tz -= dn * nz; } sl = Math.sqrt(tx * tx + ty * ty + tz * tz); }
              if (sl > 1e-3) { ex = qx + tx / sl * len; ey = qy + ty / sl * len; ez = qz + tz / sl * len; }
            }
          }
          yy = ey - hcy; ee = Math.sqrt(ex * ex / a2 + yy * yy / b2 + ez * ez / c2);
          if (ee < flr - 1e-6 && ee > 1e-9) {                              // 안전망: 겉면으로 밀어내고 마디 길이를 다시 맞춤
            kk = flr / ee; ex *= kk; ey = hcy + yy * kk; ez *= kk;
            tx = ex - qx; ty = ey - qy; tz = ez - qz; sl = Math.sqrt(tx * tx + ty * ty + tz * tz);
            if (sl > 1e-9) { ex = qx + tx / sl * len; ey = qy + ty / sl * len; ez = qz + tz / sl * len; }
          }
          S._pu++;
        }
      }
      pt = { x: ex, y: ey, z: ez };
      if (NK && len > 1e-9) {
        try {
          r = NK(pt);
          if (r && r !== pt && NK(o) === o) {
            tx = r.x - qx; ty = r.y - qy; tz = r.z - qz; sl = Math.sqrt(tx * tx + ty * ty + tz * tz);
            if (sl > 1e-9) { pt = { x: qx + tx / sl * len, y: qy + ty / sl * len, z: qz + tz / sl * len }; S._nk++; }
          }
        } catch (e4) {}
      }
      if (len > 1e-9) { lx = (pt.x - qx) / len; ly = (pt.y - qy) / len; lz = (pt.z - qz) / len; hasL = true; }
      sx = pt.x - o.x; sy = pt.y - o.y; sz = pt.z - o.z; e02 = sx * sx + sy * sy + sz * sz; if (e02 > moved) moved = e02;
      qx = pt.x; qy = pt.y; qz = pt.z;
      out[i] = pt;
    }
    if (!(moved > 1e-12)) return g;                                        // 닿았지만 이미 결대로 누워 있던 가닥
    S._t++;
    try { out._pre = g._pre || g; } catch (e2) {}
    return out;
  }
  function applySamples(g) {
    if (!C.enabled || !C.samples.length || !g || g.length < 2) return g;
    var f = syncField(); if (!f || !f.n) return g;
    var n = g.length, i, p, mn = f.mn, mx = f.mx, any = false;
    for (i = 0; i < n; i++) { p = g[i]; if (p.x >= mn[0] && p.x <= mx[0] && p.y >= mn[1] && p.y <= mx[1] && p.z >= mn[2] && p.z <= mx[2]) { any = true; break; } }
    if (!any) return g;
    if (buf.length < n * 4) { buf = new Float64Array(n * 4 + 128); rbuf = new Float64Array(n * 3 + 96); wbuf = new Float64Array(n + 32); pbuf = new Float64Array(n + 32); kbuf = new Int32Array(n + 32); }
    if (C.grain && C.surf && flowMemo && flowMemo.flow && flowMemo.flow.DF) return applySurf(g, f, flowMemo.flow);      // (g) 겉면 타기
    var cell = C.cell, map = f.map, V = f.V, last = n - 1, changed = false, U = buf, R = rbuf;          // U: 마디 i(점 i−1 → i)의 [ux,uy,uz,길이] · R: 그 마디를 돌릴 회전(축×각)
    var px = g[0].x, py = g[0].y, pz = g[0].z, lo = n, hi = 0, L = 0, len, sx, sy, sz, sl;
    // ① 마디 방향·길이
    for (i = 1; i < n; i++) {
      p = g[i];
      sx = p.x - px; sy = p.y - py; sz = p.z - pz; len = Math.sqrt(sx * sx + sy * sy + sz * sz);
      if (len > 1e-9) { U[i * 4] = sx / len; U[i * 4 + 1] = sy / len; U[i * 4 + 2] = sz / len; } else { U[i * 4] = 0; U[i * 4 + 1] = -1; U[i * 4 + 2] = 0; }
      U[i * 4 + 3] = len; L += len;
      px = p.x; py = p.y; pz = p.z;
    }
    // ② 마디마다: 그 칸의 목표 방향 쪽으로 가닥의 "큰 방향"(앞뒤 hw 마디를 이은 현)을 돌리는 회전을 구함.
    //    마디 하나의 방향이 아니라 큰 방향을 보므로 — 이미 나란한 머리는 안 움직이고(tolFrom 안쪽), 잔 컬·웨이브는 모양 그대로 통째로 돕니다.
    var hw = L > 0 ? Math.round(C.flowSmooth / (L / last)) : 1; if (!(hw >= 1)) hw = 1; else if (hw > 16) hw = 16;
    var t0 = Math.max(0, C.tolFrom) * DEG, t1 = Math.max(t0 + 1e-3, C.tolFull * DEG);
    var A, B, q0, a, b, c, k, vx, vy, vz, vl, w, t, tx, ty, tz, dot, th, fr, ang, cx, cy, cz, cl, ax, ay, az;
    // 결 격자(붓을 댈 때 빗기 전 가닥들로 만들어 둔 것). 없으면(grain=false) 손가락 방향이 그대로 목표.
    var FW = (C.grain && flowMemo && flowMemo.flow) ? flowMemo.flow : null, HD0 = null, code, hh, mpx, mpy, mpz, o0, gnn, gmm, reach = Math.max(0, C.flowReach | 0);
    var WB = wbuf, AFW = (C.anchor && flowMemo && flowMemo.flow && flowMemo.flow.GA) ? flowMemo.flow : null;
    var cT0 = Math.cos(t0), cOwn = Math.cos(C.flowOwn * DEG), cFin = Math.cos(C.flowFinger * DEG), yCap = 0.45;
    if (FW) { HD0 = headShape(); yCap = (HD0 ? HD0.cy : 0.15) + 0.3; }
    for (i = 1; i < n; i++) {
      R[i * 3] = 0; R[i * 3 + 1] = 0; R[i * 3 + 2] = 0; WB[i] = 0;
      if (!(U[i * 4 + 3] > 1e-9)) continue;
      p = g[i]; q0 = g[i - 1];
      a = Math.floor((p.x + q0.x) * 0.5 / cell) + OFF; b = Math.floor((p.y + q0.y) * 0.5 / cell) + OFF; c = Math.floor((p.z + q0.z) * 0.5 / cell) + OFF;
      if (a < 0 || b < 0 || c < 0 || a >= SPAN || b >= SPAN || c >= SPAN) continue;
      k = map.get(a + SPAN * (b + SPAN * c));
      if (k === undefined) continue;
      k *= 3; vx = V[k]; vy = V[k + 1]; vz = V[k + 2]; vl = Math.sqrt(vx * vx + vy * vy + vz * vz); w = vl;
      if (!(w > 0.01)) continue;
      t = i / last; if (t < C.gripFrom) w *= t / C.gripFrom;
      if (w > 1) w = 1;
      if (AFW && C.flyOnly) { w *= 1 - bodyAt(AFW, (p.x + q0.x) * 0.5, (p.y + q0.y) * 0.5, (p.z + q0.z) * 0.5); if (!(w > 0.01)) continue; }   // 몸통 머리 속 마디는 안 돌림 — 몸통 밖으로 뜬 구간만
      WB[i] = w;
      if (AFW && C.pullIn > 0 && bodyAt(AFW, p.x, p.y, p.z) < 0.5) { changed = true; if (i < lo) lo = i; if (i > hi) hi = i; }   // 몸통 밖에 뜬 마디 — 결과 나란해도 몸통 쪽으로 붙임
      // 큰 방향 = 뒤쪽 현(i−1−hw → i) · 앞쪽 현(i−1 → i+hw) · 가운데 현 중 이 마디와 가장 나란한 것.
      //   가운데 현만 쓰면 잔머리가 꺾여 나가는 자리에서 꺾이기 전(몸통)과 후(삐죽 나온 꼬리)가 섞여, 몸통 쪽은 괜히 돌고 꼬리는 덜 돕니다.
      A = g[i - 1 - hw < 0 ? 0 : i - 1 - hw]; B = g[i + hw > last ? last : i + hw];
      ax = U[i * 4]; ay = U[i * 4 + 1]; az = U[i * 4 + 2];
      sx = B.x - A.x; sy = B.y - A.y; sz = B.z - A.z; sl = Math.sqrt(sx * sx + sy * sy + sz * sz);
      if (sl > 1e-9) { sx /= sl; sy /= sl; sz /= sl; dot = sx * ax + sy * ay + sz * az; } else { sx = ax; sy = ay; sz = az; dot = 1; }
      tx = p.x - A.x; ty = p.y - A.y; tz = p.z - A.z; cl = Math.sqrt(tx * tx + ty * ty + tz * tz);
      if (cl > 1e-9) { th = (tx * ax + ty * ay + tz * az) / cl; if (th > dot) { dot = th; sx = tx / cl; sy = ty / cl; sz = tz / cl; } }
      tx = B.x - q0.x; ty = B.y - q0.y; tz = B.z - q0.z; cl = Math.sqrt(tx * tx + ty * ty + tz * tz);
      if (cl > 1e-9) { th = (tx * ax + ty * ay + tz * az) / cl; if (th > dot) { dot = th; sx = tx / cl; sy = ty / cl; sz = tz / cl; } }
      tx = vx / vl; ty = vy / vl; tz = vz / vl;                            // 손가락 방향
      if (FW) {
        // 목표 = 이 자리 머리의 결. 가닥마다 따로 정함: 제 무리가 있으면 그 결(가르마 양쪽·겹친 층은 각자 제 쪽 → 몸통 머리는 안 움직임),
        //   제 무리가 없는 가닥(잔머리)은 손가락 쪽으로 흐르는 이웃의 결 → 이웃 전체의 결 → (주변에 머리가 없으면) 두상 쪽으로 들어가며 찾고 → 손가락 방향.
        mpx = (p.x + q0.x) * 0.5; mpy = (p.y + q0.y) * 0.5; mpz = (p.z + q0.z) * 0.5;
        a = Math.floor((mpx - FW.x0) * FW.inv); b = Math.floor((mpy - FW.y0) * FW.inv); c = Math.floor((mpz - FW.z0) * FW.inv);
        if (a >= 0 && b >= 0 && c >= 0 && a < FW.nx && b < FW.ny && c < FW.nz) {      // 빠른 길: 빽빽하고 결이 뚜렷한 칸에서 그 결과 나란한 마디 = 몸통 머리 → 통과
          o0 = a + FW.nx * (b + FW.ny * c); gnn = FW.GN[o0]; gmm = FW.GM[o0];
          if (gnn >= FW.dense && gmm >= 0.85 * gnn && FW.GX[o0] * sx + FW.GY[o0] * sy + FW.GZ[o0] * sz >= cT0 * gmm) continue;
        }
        code = grainAt(FW, mpx, mpy, mpz, sx, sy, sz, tx, ty, tz, cOwn, cFin);
        if (code === 0) {
          for (hh = 1; hh <= reach; hh++) {
            cx = -mpx; cy = (mpy < yCap ? 0 : yCap - mpy); cz = -mpz; cl = Math.sqrt(cx * cx + cy * cy + cz * cz); if (!(cl > 1e-6)) break;
            mpx += cx / cl * FW.fc; mpy += cy / cl * FW.fc; mpz += cz / cl * FW.fc;
            code = grainAt(FW, mpx, mpy, mpz, sx, sy, sz, tx, ty, tz, cOwn, cFin);
            if (code !== 0) { if (code > 0) code = 4; break; }
          }
        }
        if (code < 0) { S._tk++; continue; }                               // 결이 갈리는 자리(가르마·가마)의 잔머리 — 어느 쪽인지 정할 수 없어 그대로 둠
        if (code === 0) S._tf++;                                           // 주변에 머리가 없음 → 손가락 방향
        else { tx = GT[0]; ty = GT[1]; tz = GT[2]; if (code === 1) S._to++; else if (code === 2) S._ts++; else if (code === 3) S._ta++; else S._tr++; }
      }
      dot = sx * tx + sy * ty + sz * tz; if (dot > 1) dot = 1; else if (dot < -1) dot = -1;
      th = Math.acos(dot);
      if (th <= t0) continue;                                              // 이미 그 방향 — 안 건드림
      fr = th >= t1 ? 1 : (th - t0) / (t1 - t0); if (fr < 1) fr = fr * fr * (3 - 2 * fr);
      ang = th * fr * w; if (ang < 0.003) continue;
      cx = sy * tz - sz * ty; cy = sz * tx - sx * tz; cz = sx * ty - sy * tx; cl = Math.sqrt(cx * cx + cy * cy + cz * cz);
      if (cl < 1e-4) {                                                     // 목표와 거의 정반대 — 아무 수직축으로
        if (Math.abs(sx) < 0.9) { cx = 0; cy = sz; cz = -sy; } else { cx = -sz; cy = 0; cz = sx; }
        cl = Math.sqrt(cx * cx + cy * cy + cz * cz); if (!(cl > 1e-9)) continue;
      }
      ang /= cl; R[i * 3] = cx * ang; R[i * 3 + 1] = cy * ang; R[i * 3 + 2] = cz * ang;
      changed = true; if (i < lo) lo = i; if (i > hi) hi = i;
    }
    if (!changed) return g;
    // ③ 회전을 이웃 마디끼리 한 번 고르게 — 칸마다 방향이 조금씩 달라 생기는 잔물결을 없앰(방향이 아니라 회전을 고르게 하므로 컬은 그대로)
    var s0 = Math.max(1, lo - 1), s1 = Math.min(last, hi + 1), o0x, o0y, o0z, c0x, c0y, c0z, j;
    j = (s0 > 1 ? s0 - 1 : s0) * 3; o0x = R[j]; o0y = R[j + 1]; o0z = R[j + 2];
    for (i = s0; i <= s1; i++) {
      j = i * 3; c0x = R[j]; c0y = R[j + 1]; c0z = R[j + 2];
      if (i < last) { R[j] = (o0x + 2 * c0x + R[j + 3]) * 0.25; R[j + 1] = (o0y + 2 * c0y + R[j + 4]) * 0.25; R[j + 2] = (o0z + 2 * c0z + R[j + 5]) * 0.25; }
      else { R[j] = (o0x + 3 * c0x) * 0.25; R[j + 1] = (o0y + 3 * c0y) * 0.25; R[j + 2] = (o0z + 3 * c0z) * 0.25; }
      o0x = c0x; o0y = c0y; o0z = c0z;
    }
    // ④ 다시 잇기 — 바뀐 첫 마디부터 끝까지(그 앞은 빗기 전과 같은 점). 마디 길이는 그대로.
    //    두상·목 안으로는 못 들어감: 빗기 전부터 겉면보다 안쪽이던 점(뿌리 등)은 그 깊이까지만 허용.
    var out = new Array(n), HD = C.collide ? headShape() : null, NK = null, lift = C.headLift > 0 ? C.headLift : 1.02;
    var a2 = 1, b2 = 1, c2 = 1, hcy = 0, kx, ky, kz, cs, sn, kd, ex, ey, ez, ee, fl, o, kk, pt, r, yy, nx, ny, nz, nl, dn;
    if (HD) { a2 = HD.a2; b2 = HD.b2; c2 = HD.c2; hcy = HD.cy; try { NK = (W.REGROW && typeof W.REGROW.neckPush === 'function') ? W.REGROW.neckPush : null; } catch (e3) { NK = null; } }
    for (i = 0; i < s0; i++) out[i] = g[i];
    var qx = g[s0 - 1].x, qy = g[s0 - 1].y, qz = g[s0 - 1].z;
    for (i = s0; i < n; i++) {
      ax = U[i * 4]; ay = U[i * 4 + 1]; az = U[i * 4 + 2]; len = U[i * 4 + 3];
      if (i <= s1) {
        kx = R[i * 3]; ky = R[i * 3 + 1]; kz = R[i * 3 + 2]; ang = Math.sqrt(kx * kx + ky * ky + kz * kz);
        if (ang > 1e-5) {                                                  // 축 k 둘레로 ang만큼 돌림(로드리게스)
          kx /= ang; ky /= ang; kz /= ang; cs = Math.cos(ang); sn = Math.sin(ang); kd = (kx * ax + ky * ay + kz * az) * (1 - cs);
          tx = ax * cs + (ky * az - kz * ay) * sn + kx * kd; ty = ay * cs + (kz * ax - kx * az) * sn + ky * kd; tz = az * cs + (kx * ay - ky * ax) * sn + kz * kd;
          ax = tx; ay = ty; az = tz;
        }
      }
      ex = qx + ax * len; ey = qy + ay * len; ez = qz + az * len;
      if (AFW && len > 1e-9) {
        // (2026-10-05f) ⓐ 붙들기 — 빗기 전 자리가 몸통 속이던 점은 제자리 쪽으로 되돌림.
        //    두상 바깥쪽(겉으로 뜨는) 성분은 언제나, 옆으로 밀린 성분은 새 자리가 몸통을 벗어날 때만. 잔머리(몸통 밖이던 점)는 붙들지 않음 → 그대로 눕음.
        o = g[i]; var e0x = ex - o.x, e0y = ey - o.y, e0z = ez - o.z, e02 = e0x * e0x + e0y * e0y + e0z * e0z, bo = 0, bn = 1;
        if (e02 > 1e-10) {
          bo = bodyAt(AFW, o.x, o.y, o.z);
          if (bo > 0) {
            var kap = len / (C.anchorLen > 0.01 ? C.anchorLen : 0.13); if (kap > 0.5) kap = 0.5; kap *= bo;
            nx = o.x; ny = o.y > yCap ? o.y - yCap : 0; nz = o.z; nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
            if (nl > 1e-9) { nx /= nl; ny /= nl; nz /= nl; } else { nx = 0; ny = 1; nz = 0; }
            bn = bodyAt(AFW, ex, ey, ez);
            var en = e0x * nx + e0y * ny + e0z * nz, kt = kap * (1 - bn), ktU = C.flyOnly ? kap : (WB[i] > 0.01 ? kt : Math.max(kt, kap * 0.5));   // 붓이 안 닿은 구간은 옆으로 밀린 것도 서서히 제자리로
            var cxx = -(en * nx * kap + (e0x - en * nx) * ktU), cyy = -(en * ny * kap + (e0y - en * ny) * ktU), czz = -(en * nz * kap + (e0z - en * nz) * ktU);
            var cmag = Math.sqrt(cxx * cxx + cyy * cyy + czz * czz), cmax = 0.5 * len; if (cmag > cmax) { cxx *= cmax / cmag; cyy *= cmax / cmag; czz *= cmax / cmag; }
            tx = ex + cxx - qx; ty = ey + cyy - qy; tz = ez + czz - qz; sl = Math.sqrt(tx * tx + ty * ty + tz * tz);
            if (sl > 1e-9) { ex = qx + tx / sl * len; ey = qy + ty / sl * len; ez = qz + tz / sl * len; S._an++; }
          }
        }
        // ⓑ 몸통 쪽으로 — 붓이 닿은 마디가 몸통 밖에 떠 있고, 두상 쪽으로 flowReach칸 안에 몸통이 있으면 그쪽으로 기울임(나란히 뜬 채 남지 않게)
        if (C.pullIn > 0 && WB[i] > 0.01 && bo < 0.5) {
          bn = bodyAt(AFW, ex, ey, ez);
          if (bn < 1) {
            nx = -ex; ny = ey > yCap ? yCap - ey : 0; nz = -ez; nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
            if (nl > 1e-6) {
              nx /= nl; ny /= nl; nz /= nl; var found = false, hq;
              for (hq = 1; hq <= reach + 1; hq++) if (bodyAt(AFW, ex + nx * AFW.fc * hq, ey + ny * AFW.fc * hq, ez + nz * AFW.fc * hq) >= 0.5) { found = true; break; }
              if (found) {
                var pk2 = C.pullIn * WB[i] * (1 - bn);
                tx = (ex - qx) / len + nx * pk2; ty = (ey - qy) / len + ny * pk2; tz = (ez - qz) / len + nz * pk2; sl = Math.sqrt(tx * tx + ty * ty + tz * tz);
                if (sl > 1e-9) { ex = qx + tx / sl * len; ey = qy + ty / sl * len; ez = qz + tz / sl * len; S._pi++; }
              }
            }
          }
        }
      }
      if (HD && len > 1e-9) {
        o = g[i]; yy = o.y - hcy;
        fl = Math.sqrt(o.x * o.x / a2 + yy * yy / b2 + o.z * o.z / c2); if (fl > lift) fl = lift;
        yy = ey - hcy; ee = Math.sqrt(ex * ex / a2 + yy * yy / b2 + ez * ez / c2);
        if (ee < fl - 1e-6) {
          // 이 마디가 두상 속으로 들어감 → 발(직전 점)에서 안쪽 성분을 빼고 면을 타고 눕힘(볼록한 면이라 면을 따라 한 걸음 가면 밖)
          yy = qy - hcy; nx = qx / a2; ny = yy / b2; nz = qz / c2; nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
          if (nl > 1e-9) {
            nx /= nl; ny /= nl; nz /= nl; dn = ax * nx + ay * ny + az * nz;
            if (dn < 0) {
              tx = ax - dn * nx; ty = ay - dn * ny; tz = az - dn * nz; sl = Math.sqrt(tx * tx + ty * ty + tz * tz);
              if (sl < 0.35) {                                             // 두피에 거의 수직으로 누른 방향(눕힐 쪽이 없음) → 이 마디는 빗기 전 방향으로
                q0 = g[i - 1]; tx = (o.x - q0.x) / len; ty = (o.y - q0.y) / len; tz = (o.z - q0.z) / len;
                dn = tx * nx + ty * ny + tz * nz; if (dn < 0) { tx -= dn * nx; ty -= dn * ny; tz -= dn * nz; }
                sl = Math.sqrt(tx * tx + ty * ty + tz * tz);
              }
              if (sl > 1e-3) { ex = qx + tx / sl * len; ey = qy + ty / sl * len; ez = qz + tz / sl * len; }
            }
          }
          // 안전망: 그래도 속이면 겉면으로 밀어내고 마디 길이를 다시 맞춤
          yy = ey - hcy; ee = Math.sqrt(ex * ex / a2 + yy * yy / b2 + ez * ez / c2);
          if (ee < fl - 1e-6 && ee > 1e-9) {
            kk = fl / ee; ex *= kk; ey = hcy + yy * kk; ez *= kk;
            tx = ex - qx; ty = ey - qy; tz = ez - qz; sl = Math.sqrt(tx * tx + ty * ty + tz * tz);
            if (sl > 1e-9) { ex = qx + tx / sl * len; ey = qy + ty / sl * len; ez = qz + tz / sl * len; }
          }
          S._pu++;
        }
      }
      pt = { x: ex, y: ey, z: ez };
      if (NK && len > 1e-9) {                                              // 목 기둥 — 빗기 전에 밖에 있던 점만 · 밀어낸 뒤 마디 길이를 다시 맞춤
        try {
          r = NK(pt);
          if (r && r !== pt && NK(g[i]) === g[i]) {
            tx = r.x - qx; ty = r.y - qy; tz = r.z - qz; sl = Math.sqrt(tx * tx + ty * ty + tz * tz);
            if (sl > 1e-9) { pt = { x: qx + tx / sl * len, y: qy + ty / sl * len, z: qz + tz / sl * len }; S._nk++; }
          }
        } catch (e4) {}
      }
      qx = pt.x; qy = pt.y; qz = pt.z;
      out[i] = pt;
    }
    S._t++;
    try { out._pre = g._pre || g; } catch (e2) {}                         // 빗기 전 자리(붓은 여기에 칠함 — 아래 buildPick 참고)
    return out;
  }
  C._apply = applySamples;
  /* 진단용: 그 자리 칸에 칠해진 목표 방향 × 세기(없으면 null) */
  C._cell = function (x, y, z) {
    var f = syncField(); if (!f) return null;
    var k = f.map.get((Math.floor(x / C.cell) + OFF) + SPAN * ((Math.floor(y / C.cell) + OFF) + SPAN * (Math.floor(z / C.cell) + OFF)));
    return k === undefined ? null : [f.V[k * 3], f.V[k * 3 + 1], f.V[k * 3 + 2]];
  };

  /* 진단용: 그 자리가 몸통 겉면에서 얼마나 떠 있나(모델 단위 · 몸통 속 0 · 거리장이 없으면 null) */
  C._dist = function (x, y, z) { return (flowMemo && flowMemo.flow && flowMemo.flow.DF) ? distAt(flowMemo.flow.DF, x, y, z) : null; };

  /* ────────────────────────────────────────────────────────────────────────
   * (2026-10-07j) 빗어 넘기기 — cur: 지금 점(정리까지 한 것) · pre: 빗기 전 점(붓은 여기에 칠함 → 방향 장도 여기서 읽음)
   *   마디마다 가닥의 큰 방향을 쓴 방향으로 돌리는 회전을 구해(세기 = 칠해진 세기 × 뿌리 잡기) 이웃끼리 한 번 고르게 한 뒤 다시 이음.
   *   몸통·잔머리를 안 가립니다(넘기기는 뭉치째 돌리는 것). 두상·목 속으로는 못 들어감.
   * ────────────────────────────────────────────────────────────────────── */
  function applySweep(cur, pre) {
    if (!C.enabled || !C.sweep || !C.sweeps.length || !cur || cur.length < 2) return cur;
    var f = syncSweep(); if (!f || !f.n) return cur;
    var n = cur.length, i, p, q0, mn = f.mn, mx = f.mx, any = false;
    if (!pre || pre.length !== n) pre = cur;
    for (i = 0; i < n; i++) { p = pre[i]; if (p.x >= mn[0] && p.x <= mx[0] && p.y >= mn[1] && p.y <= mx[1] && p.z >= mn[2] && p.z <= mx[2]) { any = true; break; } }
    if (!any) return cur;
    if (buf.length < n * 4) { buf = new Float64Array(n * 4 + 128); rbuf = new Float64Array(n * 3 + 96); wbuf = new Float64Array(n + 32); pbuf = new Float64Array(n + 32); kbuf = new Int32Array(n + 32); }
    var cell = C.cell, map = f.map, V = f.V, last = n - 1, U = buf, R = rbuf, changed = false, lo = n, hi = 0, L = 0;
    var px = cur[0].x, py = cur[0].y, pz = cur[0].z, sx, sy, sz, sl, len;
    for (i = 1; i < n; i++) {
      p = cur[i]; sx = p.x - px; sy = p.y - py; sz = p.z - pz; len = Math.sqrt(sx * sx + sy * sy + sz * sz);
      if (len > 1e-9) { U[i * 4] = sx / len; U[i * 4 + 1] = sy / len; U[i * 4 + 2] = sz / len; } else { U[i * 4] = 0; U[i * 4 + 1] = -1; U[i * 4 + 2] = 0; }
      U[i * 4 + 3] = len; L += len; px = p.x; py = p.y; pz = p.z;
    }
    var hw = L > 0 ? Math.round(C.flowSmooth / (L / last)) : 1; if (!(hw >= 1)) hw = 1; else if (hw > 16) hw = 16;
    var HD = headShape(), a2 = 1, b2 = 1, c2 = 1, hcy = 0, wn = C.wrapNear, wf = Math.max(C.wrapFar, wn + 1e-3), grip = C.sweepGrip, tol = Math.max(0, C.sweepTol) * DEG;
    if (HD) { a2 = HD.a2; b2 = HD.b2; c2 = HD.c2; hcy = HD.cy; }
    var a, b, c, k, vx, vy, vz, vl, w, t, tx, ty, tz, A, B, dot, th, ang, cx, cy, cz, cl, nx, ny, nz, nl, dn, ee, yy, kk, mxx, myy, mzz;
    for (i = 1; i < n; i++) {
      R[i * 3] = 0; R[i * 3 + 1] = 0; R[i * 3 + 2] = 0;
      if (!(U[i * 4 + 3] > 1e-9)) continue;
      p = pre[i]; q0 = pre[i - 1];
      a = Math.floor((p.x + q0.x) * 0.5 / cell) + OFF; b = Math.floor((p.y + q0.y) * 0.5 / cell) + OFF; c = Math.floor((p.z + q0.z) * 0.5 / cell) + OFF;
      if (a < 0 || b < 0 || c < 0 || a >= SPAN || b >= SPAN || c >= SPAN) continue;
      k = map.get(a + SPAN * (b + SPAN * c)); if (k === undefined) continue;
      k *= 3; vx = V[k]; vy = V[k + 1]; vz = V[k + 2]; vl = Math.sqrt(vx * vx + vy * vy + vz * vz); w = vl;
      if (!(w > 0.01)) continue;
      t = i / last; if (grip > 0 && t < grip) w *= t / grip;
      if (w > 1) w = 1;
      tx = vx / vl; ty = vy / vl; tz = vz / vl;
      p = cur[i]; q0 = cur[i - 1];
      if (HD && C.sweepWrap) {                                            // 두피 가까이: 쓴 방향에서 두상 면에 수직인 몫을 뺌(면을 타고 넘어가게)
        mxx = (p.x + q0.x) * 0.5; myy = (p.y + q0.y) * 0.5 - hcy; mzz = (p.z + q0.z) * 0.5;
        ee = Math.sqrt(mxx * mxx / a2 + myy * myy / b2 + mzz * mzz / c2);
        if (ee < wf) {
          nx = mxx / a2; ny = myy / b2; nz = mzz / c2; nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
          if (nl > 1e-9) {
            nx /= nl; ny /= nl; nz /= nl; kk = ee <= wn ? 1 : (wf - ee) / (wf - wn); dn = (tx * nx + ty * ny + tz * nz) * kk;
            sx = tx - dn * nx; sy = ty - dn * ny; sz = tz - dn * nz; sl = Math.sqrt(sx * sx + sy * sy + sz * sz);
            if (sl < 0.2) continue;                                       // 두피에 거의 수직으로 쓴 것 — 눕힐 쪽이 없음
            tx = sx / sl; ty = sy / sl; tz = sz / sl;
          }
        }
      }
      A = cur[i - 1 - hw < 0 ? 0 : i - 1 - hw]; B = cur[i + hw > last ? last : i + hw];
      sx = B.x - A.x; sy = B.y - A.y; sz = B.z - A.z; sl = Math.sqrt(sx * sx + sy * sy + sz * sz);
      if (sl > 1e-9) { sx /= sl; sy /= sl; sz /= sl; } else { sx = U[i * 4]; sy = U[i * 4 + 1]; sz = U[i * 4 + 2]; }
      dot = sx * tx + sy * ty + sz * tz; if (dot > 1) dot = 1; else if (dot < -1) dot = -1;
      th = Math.acos(dot); if (th <= tol) continue;
      ang = th * w; if (ang < 0.003) continue;
      cx = sy * tz - sz * ty; cy = sz * tx - sx * tz; cz = sx * ty - sy * tx; cl = Math.sqrt(cx * cx + cy * cy + cz * cz);
      if (cl < 1e-4) {                                                     // 거의 정반대 — 두상 바깥을 지나 돌게(두상이 없으면 아무 수직축)
        nx = p.x; ny = HD ? p.y - hcy : 0; nz = p.z;
        cx = sy * nz - sz * ny; cy = sz * nx - sx * nz; cz = sx * ny - sy * nx; cl = Math.sqrt(cx * cx + cy * cy + cz * cz);
        if (cl < 1e-6) { if (Math.abs(sx) < 0.9) { cx = 0; cy = sz; cz = -sy; } else { cx = -sz; cy = 0; cz = sx; } cl = Math.sqrt(cx * cx + cy * cy + cz * cz); }
        if (!(cl > 1e-9)) continue;
      }
      ang /= cl; R[i * 3] = cx * ang; R[i * 3 + 1] = cy * ang; R[i * 3 + 2] = cz * ang;
      changed = true; if (i < lo) lo = i; if (i > hi) hi = i;
    }
    if (!changed) return cur;
    var s0 = Math.max(1, lo - 1), s1 = Math.min(last, hi + 1), o0x, o0y, o0z, c0x, c0y, c0z, j;
    j = (s0 > 1 ? s0 - 1 : s0) * 3; o0x = R[j]; o0y = R[j + 1]; o0z = R[j + 2];
    for (i = s0; i <= s1; i++) {                                           // 회전을 이웃 마디끼리 한 번 고르게(잔물결 제거 · 컬은 그대로)
      j = i * 3; c0x = R[j]; c0y = R[j + 1]; c0z = R[j + 2];
      if (i < last) { R[j] = (o0x + 2 * c0x + R[j + 3]) * 0.25; R[j + 1] = (o0y + 2 * c0y + R[j + 4]) * 0.25; R[j + 2] = (o0z + 2 * c0z + R[j + 5]) * 0.25; }
      else { R[j] = (o0x + 3 * c0x) * 0.25; R[j + 1] = (o0y + 3 * c0y) * 0.25; R[j + 2] = (o0z + 3 * c0z) * 0.25; }
      o0x = c0x; o0y = c0y; o0z = c0z;
    }
    var out = new Array(n), CH = (C.collide && HD) ? HD : null, NK = null, lift = C.headLift > 0 ? C.headLift : 1.02;
    var ax, ay, az, kx, ky, kz, cs, sn, kd, ex, ey, ez, fl, o, pt, r;
    if (CH) { try { NK = (W.REGROW && typeof W.REGROW.neckPush === 'function') ? W.REGROW.neckPush : null; } catch (e3) { NK = null; } }
    for (i = 0; i < s0; i++) out[i] = cur[i];
    var qx = cur[s0 - 1].x, qy = cur[s0 - 1].y, qz = cur[s0 - 1].z;
    for (i = s0; i < n; i++) {
      ax = U[i * 4]; ay = U[i * 4 + 1]; az = U[i * 4 + 2]; len = U[i * 4 + 3];
      if (i <= s1) {
        kx = R[i * 3]; ky = R[i * 3 + 1]; kz = R[i * 3 + 2]; ang = Math.sqrt(kx * kx + ky * ky + kz * kz);
        if (ang > 1e-5) {
          kx /= ang; ky /= ang; kz /= ang; cs = Math.cos(ang); sn = Math.sin(ang); kd = (kx * ax + ky * ay + kz * az) * (1 - cs);
          tx = ax * cs + (ky * az - kz * ay) * sn + kx * kd; ty = ay * cs + (kz * ax - kx * az) * sn + ky * kd; tz = az * cs + (kx * ay - ky * ax) * sn + kz * kd;
          ax = tx; ay = ty; az = tz;
        }
      }
      ex = qx + ax * len; ey = qy + ay * len; ez = qz + az * len;
      if (CH && len > 1e-9) {                                              // 두상 속으로는 못 들어감 — 넘기기 전부터 안쪽이던 점(뿌리 등)은 그 깊이까지만
        o = cur[i]; yy = o.y - hcy;
        fl = Math.sqrt(o.x * o.x / a2 + yy * yy / b2 + o.z * o.z / c2); if (fl > lift) fl = lift;
        yy = ey - hcy; ee = Math.sqrt(ex * ex / a2 + yy * yy / b2 + ez * ez / c2);
        if (ee < fl - 1e-6) {
          yy = qy - hcy; nx = qx / a2; ny = yy / b2; nz = qz / c2; nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
          if (nl > 1e-9) {
            nx /= nl; ny /= nl; nz /= nl; dn = ax * nx + ay * ny + az * nz;
            if (dn < 0) {
              tx = ax - dn * nx; ty = ay - dn * ny; tz = az - dn * nz; sl = Math.sqrt(tx * tx + ty * ty + tz * tz);
              if (sl > 1e-3) { ex = qx + tx / sl * len; ey = qy + ty / sl * len; ez = qz + tz / sl * len; }
            }
          }
          yy = ey - hcy; ee = Math.sqrt(ex * ex / a2 + yy * yy / b2 + ez * ez / c2);
          if (ee < fl - 1e-6 && ee > 1e-9) {
            kk = fl / ee; ex *= kk; ey = hcy + yy * kk; ez *= kk;
            tx = ex - qx; ty = ey - qy; tz = ez - qz; sl = Math.sqrt(tx * tx + ty * ty + tz * tz);
            if (sl > 1e-9) { ex = qx + tx / sl * len; ey = qy + ty / sl * len; ez = qz + tz / sl * len; }
          }
          S._swp++;
        }
      }
      pt = { x: ex, y: ey, z: ez };
      if (NK && len > 1e-9) {
        try {
          r = NK(pt);
          if (r && r !== pt && NK(cur[i]) === cur[i]) {
            tx = r.x - qx; ty = r.y - qy; tz = r.z - qz; sl = Math.sqrt(tx * tx + ty * ty + tz * tz);
            if (sl > 1e-9) pt = { x: qx + tx / sl * len, y: qy + ty / sl * len, z: qz + tz / sl * len };
          }
        } catch (e4) {}
      }
      qx = pt.x; qy = pt.y; qz = pt.z; out[i] = pt;
    }
    S._sw++;
    try { out._pre = cur._pre || pre; } catch (e2) {}
    return out;
  }
  C._sweep = applySweep;

  /* combStrand3D(17a) 끝 — r = 격자 빗질까지 끝난 가닥 */
  C._apply = function (r) {
    if (!C.samples.length && !C.sweeps.length) return r;
    var o = r;
    if (C.samples.length) { try { o = applySamples(r); } catch (e) { S.err = String(e && e.message || e); o = r; } }
    if (C.sweeps.length) { try { o = applySweep(o, r); } catch (e) { S.err = String(e && e.message || e); } }      // (j) 정리 다음에 넘기기 — 방향 장은 빗기 전 자리(r)에서 읽음
    return o;
  };
  /* 머리 모델이 바뀌면 빗질을 지움(다른 사진 · 마네킹 켬/끔 · 다시 기르기) */
  function checkModel() {
    var m = null; try { m = state.hair3Dneutral; } catch (e) {}
    if (m !== modelRef) { modelRef = m; if (C.samples.length || C.sweeps.length) { C.samples.length = 0; C.sweeps.length = 0; ver++; epoch++; syncBtn(); } }
  }
  /* computeAdjustedHair3DStrands(17b) 맨 앞 — 돌려준 시각을 끝의 _afterCompute에 넘김 */
  C._beforeCompute = function () {
    try { checkModel(); S._t = 0; S._pu = 0; S._nk = 0; S._an = 0; S._pi = 0; S._fl = 0; S._up = 0; S._cl = 0; S._to = S._ts = S._ta = S._tr = S._tf = S._tk = 0; S._sw = 0; S._swp = 0; } catch (e) {}
    return now();
  };
  C._afterCompute = function (out, view, stride, t0) {
    var arguments_ = [view, stride];
    try {                                                                 // 빗질이 있는데 머리 모양(길이·컬 등)이 바뀌었으면 결을 다시 읽어 둠(전체 목록을 만든 호출에서만)
      if (C.grain && C.samples.length && out && out.length && !arguments_[0] && !(arguments_[1] > 1) && modelRef) {
        var fmB = flowMemo; flowGrid(out, Math.max(1, Math.ceil(out.length / C.pickStrands)), modelRef);
        if (fmB && fmB !== flowMemo && typeof ADJ_CACHE !== 'undefined' && ADJ_CACHE.bump) ADJ_CACHE.bump();      // 방금 목록은 옛 결로 만든 것 → 다음 호출에서 새로
      }
    } catch (eF) {}
    if (S._sw > 0) { S.swept = S._sw; S.sweptPush = S._swp; if (!(S._t > 0)) S.ms = now() - t0; } else if (!C.sweeps.length) { S.swept = 0; S.sweptPush = 0; }
    if (S._t > 0 || S._tk > 0) { S.touched = S._t; S.ms = now() - t0; S.pushed = S._pu; S.neck = S._nk; S.anch = S._an; S.pin = S._pi; S.fly = S._fl; S.up = S._up; S.clamp = S._cl; S.tOwn = S._to; S.tSide = S._ts; S.tAll = S._ta; S.tReach = S._tr; S.tFinger = S._tf; S.tSkip = S._tk; }          // 캐시에서 나온 호출은 세지 않음
    return out;
  };
  // 서명 — 빗질이 바뀌면 미리 만든 헤어도 다시
  C._sigTail = function () { return '|cb' + ver; };   // adjFilterSig(17b) 끝
  function redraw() {
    try { if (typeof ADJ_CACHE !== 'undefined' && ADJ_CACHE.bump) ADJ_CACHE.bump(); } catch (e) {}
    try { if (scr() === 'adjust' && typeof renderAdjustFrame === 'function') renderAdjustFrame(); } catch (e) {}
  }
  C.refresh = function () { ver++; epoch++; redraw(); syncBtn(); };
  C.clear = function () { if (!C.samples.length && !C.sweeps.length) return; C.samples.length = 0; C.sweeps.length = 0; ver++; epoch++; S.strokes = 0; S.sweepStrokes = 0; redraw(); syncBtn(); };
  C.clearSweeps = function () { if (!C.sweeps.length) return; C.sweeps.length = 0; ver++; epoch++; S.sweepStrokes = 0; redraw(); syncBtn(); };
  C.undo = function () {                    // 정리·넘기기 가운데 마지막 한 획
    var ga = C.samples.length ? C.samples[C.samples.length - 1].g : -1, gb = C.sweeps.length ? C.sweeps[C.sweeps.length - 1].g : -1;
    if (ga < 0 && gb < 0) return;
    var A = gb > ga ? C.sweeps : C.samples, g = Math.max(ga, gb);
    while (A.length && A[A.length - 1].g === g) A.pop();
    ver++; epoch++; redraw(); syncBtn();
  };

  /* ────────────────────────────────────────────────────────────────────────
   * ② 붓 자리 찾기 — 화면의 손가락 아래에서 카메라에 가장 가까운 가닥 점
   * ────────────────────────────────────────────────────────────────────── */
  function hairObject() {
    var m = m3(), found = null; if (!m) return null;
    m.headGroup.traverse(function (o) { if (!found && (o.isLineSegments || o.isLine) && o.geometry) found = o; });
    return found || m.headGroup;
  }
  /* ── 결 격자 ── 빗기 전 가닥들의 "큰 방향"(앞뒤 flowSmooth를 이은 현)을 자리(flowCell 칸)마다 가닥당 한 번씩 더해 둠.
     빗기 전 자리로 만들기 때문에 빗질을 해도 안 바뀝니다 → 머리 모양(모델·길이·컬)이 그대로면 다시 만들지 않고 씀. */
  var flowMemo = null;
  /* (2026-10-05g) 거리 변환(앞·뒤 두 번 훑기 · 이웃 26칸): 값이 0인 칸(몸통)까지의 거리를 칸마다 구함. 격자 가장자리 한 겹은 건드리지 않음(늘 빈 칸 — 여유 한 칸을 두고 만든 격자) */
  function chamfer(D, mx, my, mz, h) {
    var w1 = h, w2 = h * 1.41421356, w3 = h * 1.7320508, sxy = mx * my, pass, sg, ia, ib, ic, o, v, t, r0, r1, r2;
    for (pass = 0; pass < 2; pass++) {
      sg = pass ? -1 : 1;
      for (ic = pass ? mz - 2 : 1; ic >= 1 && ic <= mz - 2; ic += sg) for (ib = pass ? my - 2 : 1; ib >= 1 && ib <= my - 2; ib += sg) {
        r0 = mx * (ib + my * ic); r1 = r0 - sg * sxy; r2 = r0 - sg * mx;
        for (ia = pass ? mx - 2 : 1; ia >= 1 && ia <= mx - 2; ia += sg) {
          o = r0 + ia; v = D[o]; if (v === 0) continue;
          // 이미 훑은 쪽 13칸: 앞 층 9칸 + 같은 층 앞 줄 3칸 + 같은 줄 앞 1칸
          o = r1 + ia;
          t = D[o] + w1; if (t < v) v = t;
          t = D[o - 1] + w2; if (t < v) v = t; t = D[o + 1] + w2; if (t < v) v = t; t = D[o - mx] + w2; if (t < v) v = t; t = D[o + mx] + w2; if (t < v) v = t;
          t = D[o - mx - 1] + w3; if (t < v) v = t; t = D[o - mx + 1] + w3; if (t < v) v = t; t = D[o + mx - 1] + w3; if (t < v) v = t; t = D[o + mx + 1] + w3; if (t < v) v = t;
          o = r2 + ia;
          t = D[o] + w1; if (t < v) v = t; t = D[o - 1] + w2; if (t < v) v = t; t = D[o + 1] + w2; if (t < v) v = t;
          t = D[r0 + ia - sg] + w1; if (t < v) v = t;
          D[r0 + ia] = v;
        }
      }
    }
  }
  function flowGrid(list, stepS, model) {
    var t0 = now(), i, k, pp, q, np, acc = 0, fpStep = Math.max(1, Math.floor(list.length / 97));
    for (i = 0; i < list.length; i += fpStep) {                                    // 지문: 가닥 몇 개의 끝점(빗기 전)과 점 수
      pp = list[i].pts; if (!pp || !pp.length) continue; if (pp._pre && pp._pre.length === pp.length) pp = pp._pre;
      q = pp[pp.length - 1]; acc += q.x * 1.3 + q.y * 2.1 + q.z * 3.7 + pp.length;
    }
    var fp = list.length + ':' + stepS + ':' + acc.toFixed(4) + ':' + C.flowCell + ':' + C.flowSmooth + ':' + C.flowMin + ':' + C.flowNear + ':' + C.flowDense + ':' + (C.surf ? C.surfThr + '/' + C.surfNbr + '/' + C.surfCore + '/' + C.surfHead + '/' + C.flyFrom + '/' + C.flyFull : 'x');
    if (flowMemo && flowMemo.fp === fp && flowMemo.model === model) return flowMemo.flow;
    if (flowMemo && flowMemo.flow) { ver++; S.flowRebuilt = (S.flowRebuilt || 0) + 1; }      // 머리 모양이 바뀌어 결을 다시 읽음 → 빗질 결과도 다음에 다시 계산
    var fc = C.flowCell > 0.01 ? C.flowCell : 0.07, b0x = Infinity, b0y = Infinity, b0z = Infinity, b1x = -Infinity, b1y = -Infinity, b1z = -Infinity, used = 0;
    for (i = 0; i < list.length; i += stepS) {
      pp = list[i].pts; if (!pp) continue; if (pp._pre && pp._pre.length === pp.length) pp = pp._pre;
      used++;
      for (k = 0; k < pp.length; k += 2) { q = pp[k]; if (q.x < b0x) b0x = q.x; if (q.x > b1x) b1x = q.x; if (q.y < b0y) b0y = q.y; if (q.y > b1y) b1y = q.y; if (q.z < b0z) b0z = q.z; if (q.z > b1z) b1z = q.z; }
    }
    var flow = null;
    if (b1x >= b0x && isFinite(b0x + b1x + b0y + b1y + b0z + b1z)) {
      var cyF = isFinite(model.CY) ? model.CY : 0, lim = 64 * fc;                   // 멀리 튄 점 하나 때문에 격자가 커지지 않게(두상 가운데에서 ±64칸)
      b0x = Math.max(b0x, -lim) - fc; b1x = Math.min(b1x, lim) + fc; b0y = Math.max(b0y, cyF - lim) - fc; b1y = Math.min(b1y, cyF + lim) + fc; b0z = Math.max(b0z, -lim) - fc; b1z = Math.min(b1z, lim) + fc;
      var nx = Math.floor((b1x - b0x) / fc) + 1, ny = Math.floor((b1y - b0y) / fc) + 1, nz = Math.floor((b1z - b0z) / fc) + 1, nn = nx * ny * nz;
      if (nx > 0 && ny > 0 && nz > 0) {
        var GX = new Float32Array(nn), GY = new Float32Array(nn), GZ = new Float32Array(nn), GN = new Uint16Array(nn), GL = new Int32Array(nn).fill(-1), inv = 1 / fc;
        var hw, arc, na, u0, u1, qa, qb, fx, fy, fz, fl, gi, gj, gk, gc, stride;
        for (i = 0; i < list.length; i += stepS) {
          pp = list[i].pts; if (!pp) continue; if (pp._pre && pp._pre.length === pp.length) pp = pp._pre;
          np = pp.length; if (np < 2) continue;
          arc = 0; na = np - 1 < 8 ? np - 1 : 8; u0 = pp[0];                        // 마디 길이는 앞쪽 몇 마디로 어림
          for (k = 1; k <= na; k++) { u1 = pp[k]; arc += Math.sqrt((u1.x - u0.x) * (u1.x - u0.x) + (u1.y - u0.y) * (u1.y - u0.y) + (u1.z - u0.z) * (u1.z - u0.z)); u0 = u1; }
          arc /= na;
          hw = arc > 0 ? Math.round(C.flowSmooth / arc) : 1; if (!(hw >= 1)) hw = 1; else if (hw > 16) hw = 16;
          stride = arc > 0 ? Math.floor(fc * 0.8 / arc) : 1; if (!(stride >= 1)) stride = 1; else if (stride > 6) stride = 6;   // 칸보다 촘촘히 찍을 필요 없음
          for (k = 0; k < np; k += stride) {
            q = pp[k];
            gi = (q.x - b0x) * inv | 0; gj = (q.y - b0y) * inv | 0; gk = (q.z - b0z) * inv | 0;
            if (!(q.x >= b0x && q.y >= b0y && q.z >= b0z && gi < nx && gj < ny && gk < nz)) continue;
            gc = gi + nx * (gj + ny * gk); if (GL[gc] === i) continue;              // 가닥당·칸당 한 번
            qa = pp[k - hw < 0 ? 0 : k - hw]; qb = pp[k + hw >= np ? np - 1 : k + hw];
            fx = qb.x - qa.x; fy = qb.y - qa.y; fz = qb.z - qa.z; fl = Math.sqrt(fx * fx + fy * fy + fz * fz); if (!(fl > 1e-9)) continue;
            GL[gc] = i; if (GN[gc] < 65535) GN[gc]++; GX[gc] += fx / fl; GY[gc] += fy / fl; GZ[gc] += fz / fl;
          }
        }
        // 몸통 머리의 보통 밀도 = 가닥 점이 가장 많이 사는 칸의 가닥 수(칸을 가닥 수로 가중한 중앙값) — 겉으로 뜬 잔머리 칸(1~몇 가닥)에 끌려가지 않음
        var gv = [], gs = 0, ga = 0, ref = 1; for (k = 0; k < nn; k++) if (GN[k]) { gv.push(GN[k]); gs += GN[k]; }
        gv.sort(function (x, y) { return x - y; });
        for (k = 0; k < gv.length; k++) { ga += gv[k]; if (ga * 2 >= gs) { ref = gv[k]; break; } }
        var mn = Math.max(6, Math.round(C.flowMin * Math.min(1, used / 8000)));
        var GM = new Float32Array(nn); for (k = 0; k < nn; k++) if (GN[k]) GM[k] = Math.sqrt(GX[k] * GX[k] + GY[k] * GY[k] + GZ[k] * GZ[k]);
        // (2026-10-05f) 몸통 격자: 칸마다 이웃 3×3×3칸의 가닥 수(축마다 한 번씩 더함)
        var GA = new Float32Array(nn), GT2 = new Float32Array(nn), ia, ib, ic, oo, sm;
        for (ic = 0; ic < nz; ic++) for (ib = 0; ib < ny; ib++) for (ia = 0; ia < nx; ia++) { oo = ia + nx * (ib + ny * ic); sm = GN[oo]; if (ia > 0) sm += GN[oo - 1]; if (ia < nx - 1) sm += GN[oo + 1]; GT2[oo] = sm; }
        for (ic = 0; ic < nz; ic++) for (ib = 0; ib < ny; ib++) for (ia = 0; ia < nx; ia++) { oo = ia + nx * (ib + ny * ic); sm = GT2[oo]; if (ib > 0) sm += GT2[oo - nx]; if (ib < ny - 1) sm += GT2[oo + nx]; GA[oo] = sm; }
        for (ic = 0; ic < nz; ic++) for (ib = 0; ib < ny; ib++) for (ia = 0; ia < nx; ia++) { oo = ia + nx * (ib + ny * ic); sm = GA[oo]; if (ic > 0) sm += GA[oo - nx * ny]; if (ic < nz - 1) sm += GA[oo + nx * ny]; GT2[oo] = sm; }
        var nearV = Math.max(mn, C.flowNear * ref);
        // (2026-10-05g) 몸통 겉면 거리장 — 잔칸(결 칸의 절반)마다 지나는 가닥 수를 세어 "몸통 칸"을 정하고, 칸마다 가장 가까운 몸통 칸까지의 거리를 구해 둠.
        //   예전 몸통 판정(둘레 3×3×3 결 칸 = 4cm 상자의 가닥 수)은 겉면에서 1~2cm 뜬 잔머리도 몸통으로 봐서 안 빗겼습니다.
        var DF = null;
        if (C.surf) {
          var h = fc * 0.5, hinv = 1 / h, mx = nx * 2, my = ny * 2, mz = nz * 2, mm = mx * my * mz;
          if (mm > 0 && mm <= 3e6) {
            var FN = new Uint16Array(mm), FL = new Int32Array(mm).fill(-1), sub, tq, px0, py0, pz0, sgl, fo, fx0, fy0, fz0;
            for (i = 0; i < list.length; i += stepS) {
              pp = list[i].pts; if (!pp) continue; if (pp._pre && pp._pre.length === pp.length) pp = pp._pre;
              np = pp.length;
              for (k = 0; k < np; k++) {
                q = pp[k]; sub = 0;
                if (k + 1 < np) { u1 = pp[k + 1]; px0 = u1.x - q.x; py0 = u1.y - q.y; pz0 = u1.z - q.z; sgl = Math.sqrt(px0 * px0 + py0 * py0 + pz0 * pz0); sub = Math.floor(sgl / (h * 0.9)); if (sub > 12) sub = 12; }
                for (tq = 0; tq <= sub; tq++) {                               // 마디가 잔칸보다 길면 사이도 찍음
                  fx0 = sub ? q.x + px0 * tq / (sub + 1) : q.x; fy0 = sub ? q.y + py0 * tq / (sub + 1) : q.y; fz0 = sub ? q.z + pz0 * tq / (sub + 1) : q.z;
                  gi = (fx0 - b0x) * hinv | 0; gj = (fy0 - b0y) * hinv | 0; gk = (fz0 - b0z) * hinv | 0;
                  if (!(fx0 >= b0x && fy0 >= b0y && fz0 >= b0z && gi < mx && gj < my && gk < mz)) continue;
                  fo = gi + mx * (gj + my * gk); if (FL[fo] === i) continue;      // 가닥당·칸당 한 번
                  FL[fo] = i; if (FN[fo] < 65535) FN[fo]++;
                }
              }
            }
            FL = null;
            var fv2 = [], fs2 = 0, fa2 = 0, refF = 1; for (k = 0; k < mm; k++) if (FN[k]) { fv2.push(FN[k]); fs2 += FN[k]; }
            fv2.sort(function (x, y) { return x - y; });
            for (k = 0; k < fv2.length; k++) { fa2 += fv2[k]; if (fa2 * 2 >= fs2) { refF = fv2[k]; break; } }
            var thrF = Math.max(2, Math.round(C.surfThr * refF)), BM = new Uint8Array(mm), sxy = mx * my, bodyCells = 0, nbNeed = Math.max(0, C.surfNbr | 0), cnt, da, db, dc;
            // 기준 밀도는 자리마다: 둘레 ±2칸(≈ 3.3cm 상자)에서 "가닥 점이 보통 겪는 밀도"(Σ수²/Σ수) × surfThr.
            //   머리 전체의 한 값으로 자르면 정수리처럼 층이 얇은 자리의 겉층이 잔머리로 잡히고(빗으면 몸통이 움직임),
            //   낮춰 잡으면 숱 많은 자리 곁에 둘씩 뜬 가닥이 몸통으로 잡힙니다(빗어도 안 눕음) — 둘 다 합성 테스트에서 확인.
            var v1, v2, cF, a0, a1, b0, b1, c0, c1, ro;
            for (ic = 0; ic < mz; ic++) for (ib = 0; ib < my; ib++) for (ia = 0; ia < mx; ia++) {
              oo = ia + mx * (ib + my * ic); if (FN[oo] < 2) continue;              // 후보 칸에서만 셈
              a0 = ia > 2 ? ia - 2 : 0; a1 = ia < mx - 3 ? ia + 2 : mx - 1; b0 = ib > 2 ? ib - 2 : 0; b1 = ib < my - 3 ? ib + 2 : my - 1; c0 = ic > 2 ? ic - 2 : 0; c1 = ic < mz - 3 ? ic + 2 : mz - 1; v1 = 0; v2 = 0;
              for (dc = c0; dc <= c1; dc++) for (db = b0; db <= b1; db++) { ro = mx * (db + my * dc); for (da = a0; da <= a1; da++) { cF = FN[ro + da]; v1 += cF; v2 += cF * cF; } }
              if (FN[oo] * v1 >= C.surfThr * v2) BM[oo] = 1;
            }
            // (2026-10-05i) 몸통 = "두꺼운 속이 있는 덩어리"와 이어진 칸.
            //   ① 후보: 위 기준을 넘고 둘레 26칸 중 surfNbr칸 이상이 같이 넘는 칸(한 줄로 지나가는 잔머리 묶음은 이웃이 2~4칸뿐이라 빠짐)
            //   ② 속: 둘레에 surfCore칸 이상이 후보인 칸. 속에서 출발해 후보를 따라(2칸 틈은 건너) 번져 닿는 칸이 몸통.
            //   ③ 안 닿은 후보 가운데 두상 겉면 가까이(타원체 surfHead배 안) 붙어 있는 칸도 몸통(이마·옆머리의 얇은 한 겹).
            //   h에서는 "빽빽한 몸통에서 2cm 넘게 떨어진 자리에 2가닥이 같이 지나가면 몸통"이라 했는데, 그러면 멀리 뜬 잔머리 묶음이 몸통이 되어 빗어도 그대로였습니다(사용자: "그래도 뜨는 건 있네").
            var DD = new Float32Array(mm), BIG = 1e6, NBc = new Uint8Array(mm), nCore = Math.max(1, C.surfCore | 0), stack = [], sp, o2, HDs = headShape(), ev, hN = C.surfHead > 1 ? C.surfHead : 1.15, yv, xv, zv;
            for (ic = 0; ic < mz; ic++) for (ib = 0; ib < my; ib++) for (ia = 0; ia < mx; ia++) {
              oo = ia + mx * (ib + my * ic); DD[oo] = BIG; if (!BM[oo]) continue;
              cnt = 0;
              for (dc = -1; dc <= 1; dc++) { if (ic + dc < 0 || ic + dc >= mz) continue;
                for (db = -1; db <= 1; db++) { if (ib + db < 0 || ib + db >= my) continue;
                  for (da = -1; da <= 1; da++) { if (ia + da < 0 || ia + da >= mx || (!da && !db && !dc)) continue; if (BM[oo + da + mx * db + sxy * dc]) cnt++; } } }
              NBc[oo] = cnt;
            }
            for (k = 0; k < mm; k++) if (BM[k] && NBc[k] >= nCore) { BM[k] = 3; stack.push(k); }      // 속
            while (stack.length) {
              oo = stack.pop(); ia = oo % mx; ib = ((oo - ia) / mx) % my; ic = (oo - ia - mx * ib) / sxy;
              for (dc = -2; dc <= 2; dc++) { if (ic + dc < 0 || ic + dc >= mz) continue;
                for (db = -2; db <= 2; db++) { if (ib + db < 0 || ib + db >= my) continue;
                  for (da = -2; da <= 2; da++) { if (ia + da < 0 || ia + da >= mx) continue;
                    o2 = oo + da + mx * db + sxy * dc; if (BM[o2] === 1 && NBc[o2] >= nbNeed) { BM[o2] = 3; stack.push(o2); } } } }
            }
            for (ic = 0; ic < mz; ic++) for (ib = 0; ib < my; ib++) for (ia = 0; ia < mx; ia++) {
              oo = ia + mx * (ib + my * ic); if (!BM[oo]) continue;
              if (BM[oo] !== 3) {
                if (!HDs) { if (NBc[oo] < nbNeed) continue; }                       // 두상 모양을 모르면 후보는 다 몸통(예전처럼)
                else {
                  if (NBc[oo] < 2) continue;
                  xv = b0x + (ia + 0.5) * h; yv = b0y + (ib + 0.5) * h - HDs.cy; zv = b0z + (ic + 0.5) * h; ev = Math.sqrt(xv * xv / HDs.a2 + yv * yv / HDs.b2 + zv * zv / HDs.c2);
                  if (!(ev <= hN)) continue;
                }
              }
              DD[oo] = 0; bodyCells++;
            }
            NBc = null;
            if (bodyCells) {
              chamfer(DD, mx, my, mz, h);
              var farD = 8 * h; for (k = 0; k < mm; k++) if (DD[k] > farD) DD[k] = farD;
              DF = { D: DD, h: h, inv: hinv, x0: b0x, y0: b0y, z0: b0z, mx: mx, my: my, mz: mz, far: farD - 1e-6, d0: Math.max(0, C.flyFrom), d1: Math.max(C.flyFrom + 1e-3, C.flyFull), ref: refF, thr: thrF, cells: bodyCells };
            }
          }
        }
        flow = { DF: DF, fc: fc, inv: inv, x0: b0x, y0: b0y, z0: b0z, nx: nx, ny: ny, nz: nz, GX: GX, GY: GY, GZ: GZ, GN: GN, GM: GM, GA: GT2, bLo: nearV, bHi: Math.max(nearV * 1.5, C.bodyFull * ref), ref: ref, cells: gv.length, dense: Math.max(2, C.flowDense * ref), near: nearV };
      }
    }
    flowMemo = { fp: fp, model: model, flow: flow };
    S.flowRef = flow ? flow.ref : 0; S.flowCells = flow ? flow.cells : 0; S.surfRef = flow && flow.DF ? flow.DF.ref : 0; S.surfCells = flow && flow.DF ? flow.DF.cells : 0; S.flowMs = now() - t0;
    return flow;
  }
  /* (2026-10-05i) 점마다 "몸통 겉면에서 떠 있나" 표시 — 빗기 전 자리로 재므로 머리 모양(결 격자)이 그대로면 다시 안 잼.
     예전(h)에는 붓을 댈 때마다 건너뛰는 가닥의 모든 점을 두 번씩 쟀습니다(폰 실측: 붓 자리 찾기 준비 32 → 464ms). */
  var floatMemo = null;
  function floatFlags(list, DF) {
    var fm = flowMemo, i, k, pp, tot = 0, off = new Int32Array(list.length + 1);
    for (i = 0; i < list.length; i++) { off[i] = tot; pp = list[i].pts; if (pp) tot += pp.length; }
    off[list.length] = tot;
    if (floatMemo && floatMemo.fm === fm && floatMemo.n === list.length && floatMemo.tot === tot) return floatMemo;
    var F = new Uint8Array(tot), o = 0, d0 = DF.d0, cnt = 0;
    for (i = 0; i < list.length; i++) {
      pp = list[i].pts; if (!pp) continue; if (pp._pre && pp._pre.length === pp.length) pp = pp._pre;
      for (k = 0; k < pp.length; k++, o++) if (distAt(DF, pp[k].x, pp[k].y, pp[k].z) > d0) { F[o] = 1; cnt++; }
    }
    floatMemo = { fm: fm, n: list.length, tot: tot, F: F, off: off, cnt: cnt };
    return floatMemo;
  }
  var pick = null;
  function buildPick() {
    var m = m3(); if (!m) return null;
    var t0 = now(), model = null; try { model = state.hair3Dneutral; } catch (e) {}
    if (!model || !model.strands || !model.strands.length) return null;
    var list = null;
    try { list = computeAdjustedHair3DStrands(); } catch (e) { list = null; }      // 화면에 그린 것과 같은 목록(이미 계산돼 있음)
    if (!list || !list.length) return null;
    var stepS = Math.max(1, Math.ceil(list.length / C.pickStrands));
    var obj = hairObject(), cam = m.camera, cv = m.renderer.domElement, rect = cv.getBoundingClientRect();
    m.scene.updateMatrixWorld(true); cam.updateMatrixWorld(true);
    var M = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse).multiply(obj.matrixWorld), e = M.elements;
    if (C.grain) { try { flowGrid(list, stepS, model); } catch (eF) { S.err = String(eF && eF.message || eF); } }      // (2026-10-05e) 결 격자 준비(머리 모양이 그대로면 다시 안 만듦)
    // (2026-10-05g) 가닥이 pickStrands보다 많으면 건너뛰며 쓰는데(조정 화면 9,999가닥 → 둘 중 하나), 건너뛴 가닥이 혼자 뜬 잔머리면 붓에 아예 안 걸렸습니다
    //   → 건너뛰는 가닥도 "몸통 겉면에서 뜬 점"은 전부 붓 자리 찾기에 넣습니다.
    var DFp = (C.surf && C.grain && flowMemo && flowMemo.flow && flowMemo.flow.DF) ? flowMemo.flow.DF : null, FM = null, total = 0, i, k, extra = 0, o;
    if (DFp) { try { FM = floatFlags(list, DFp); } catch (eG) { FM = null; DFp = null; S.err = String(eG && eG.message || eG); } }
    for (i = 0; i < list.length; i++) {
      if (!list[i].pts) continue;
      if (i % stepS === 0) { total += list[i].pts.length; continue; }
      if (FM) for (o = FM.off[i], k = FM.off[i + 1]; o < k; o++) total += FM.F[o];
    }
    var SX = new Float32Array(total), SY = new Float32Array(total), SW = new Float32Array(total), PX = new Float32Array(total), PY = new Float32Array(total), PZ = new Float32Array(total);
    var SI = FM ? new Int32Array(total) : null, SK = FM ? new Int32Array(total) : null, FL = FM ? new Uint8Array(total) : null;
    var cell = Math.max(8, C.pickPx), gw = Math.ceil(rect.width / cell) + 1, gh = Math.ceil(rect.height / cell) + 1, head = new Int32Array(gw * gh).fill(-1), next = new Int32Array(total), n = 0;
    for (i = 0; i < list.length; i++) {
      var pts = list[i].pts; if (!pts) continue;
      var whole = i % stepS === 0; if (!whole && !FM) continue;
      var pre = (pts._pre && pts._pre.length === pts.length) ? pts._pre : pts;      // 빗질로 옮겨지기 전 자리
      o = FM ? FM.off[i] : 0;
      for (k = 0; k < pts.length; k++) {
        if (!whole) { if (!FM.F[o + k]) continue; extra++; }                        // 건너뛰는 가닥은 뜬 점만
        var p = pts[k], w = e[3] * p.x + e[7] * p.y + e[11] * p.z + e[15];
        if (!(w > 1e-6)) continue;
        var sx = ((e[0] * p.x + e[4] * p.y + e[8] * p.z + e[12]) / w * 0.5 + 0.5) * rect.width, sy = (1 - ((e[1] * p.x + e[5] * p.y + e[9] * p.z + e[13]) / w * 0.5 + 0.5)) * rect.height;
        if (sx < 0 || sy < 0 || sx >= rect.width || sy >= rect.height) continue;
        var b = (sy / cell | 0) * gw + (sx / cell | 0);
        SX[n] = sx; SY[n] = sy; SW[n] = w; PX[n] = pre[k].x; PY[n] = pre[k].y; PZ[n] = pre[k].z; next[n] = head[b]; head[b] = n;
        if (FM) { SI[n] = i; SK[n] = k; FL[n] = FM.F[o + k]; }
        n++;
      }
    }
    // 화면 → 모델 방향: 카메라의 오른쪽·위 벡터를 머리 객체 좌표로
    var inv = new THREE.Matrix4().copy(obj.matrixWorld).invert();
    var right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0).transformDirection(inv), up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1).transformDirection(inv);
    // 두상 가운데의 깊이 — 이보다 depthMargin 넘게 뒤에 있는 점은 반대편 머리
    var cyH = isFinite(model.CY) ? model.CY : 0, wC = e[7] * cyH + e[15], wMax = wC + C.depthMargin;
    // (2026-10-05i) 보이는 겉층만 — 화면의 visCell px 칸마다 카메라에 가장 가까운 점의 깊이를 재고, 그보다 depthLayer(≈ 2.5cm) 넘게 뒤에 있는 점은 붓에 안 걸림.
    //   예전에는 원 안이면 두상 가운데 깊이까지 전부 걸렸습니다 → 뒤에서 빗는데 그 뒤에 겹쳐 있던 옆머리·목 옆 머리·얼굴 옆 머리까지 칠해짐(사용자 영상: "뒤만 빗었는데 목덜미와 얼굴로 가닥이 튀어나옴").
    var VIS = null, hidden = 0;
    var dLay = (C.mode === 'sweep' && C.sweep) ? C.sweepDepth : C.depthLayer;      // (j) 넘기기는 뭉치의 속까지
    if (FM && dLay > 0) {
      var vc = Math.max(2, C.visCell), vw = Math.ceil(rect.width / vc) + 1, vh = Math.ceil(rect.height / vc) + 1, ZM = new Float32Array(vw * vh).fill(Infinity), vi;
      for (i = 0; i < n; i++) { vi = (SY[i] / vc | 0) * vw + (SX[i] / vc | 0); if (SW[i] < ZM[vi]) ZM[vi] = SW[i]; }
      VIS = new Uint8Array(n);
      for (i = 0; i < n; i++) { if (SW[i] <= ZM[(SY[i] / vc | 0) * vw + (SX[i] / vc | 0)] + dLay) VIS[i] = 1; else if (SW[i] <= wMax) hidden++; }
    }
    S.pickMs = now() - t0; S.pickPts = n; S.pickFly = extra; S.pickHidden = hidden;
    return { sweep: (C.mode === 'sweep' && C.sweep), DF: DFp, FM: FM, list: list, e: e, wMax: wMax, SX: SX, SY: SY, SW: SW, PX: PX, PY: PY, PZ: PZ, SI: SI, SK: SK, FL: FL, VIS: VIS, head: head, next: next, cell: cell, gw: gw, gh: gh, rect: rect, right: right, up: up,
      perPx: function (w) { return 2 * w * Math.tan(cam.fov * Math.PI / 360) / rect.height; } };
  }
  function pickAt(pk, x, y, rad) {
    var c = pk.cell, bx = x / c | 0, by = y / c | 0, span = Math.ceil(rad / c), best = -1, bw = Infinity, r2 = rad * rad, a, b, i, VIS = pk.VIS;
    for (b = by - span; b <= by + span; b++) { if (b < 0 || b >= pk.gh) continue;
      for (a = bx - span; a <= bx + span; a++) { if (a < 0 || a >= pk.gw) continue;
        for (i = pk.head[b * pk.gw + a]; i >= 0; i = pk.next[i]) {
          if (pk.SW[i] > pk.wMax || (VIS && !VIS[i])) continue;            // 반대편 머리 · 겉층 뒤에 가린 머리
          var dx = pk.SX[i] - x, dy = pk.SY[i] - y; if (dx * dx + dy * dy > r2) continue;
          if (pk.SW[i] < bw) { bw = pk.SW[i]; best = i; }
        }
      }
    }
    return best;
  }
  /* 화면의 원(반지름 rad px) 안에 보이는 가닥 점 전부 → [x,y,z,가중] 묶음. 너무 많으면 건너뛰며 고름 */
  var gatherBuf = new Int32Array(8192);
  function gather(pk, x, y, rad) {
    var c = pk.cell, bx = x / c | 0, by = y / c | 0, span = Math.ceil(rad / c), r2 = rad * rad, a, b, i, n = 0, VIS = pk.VIS;
    for (b = by - span; b <= by + span; b++) { if (b < 0 || b >= pk.gh) continue;
      for (a = bx - span; a <= bx + span; a++) { if (a < 0 || a >= pk.gw) continue;
        for (i = pk.head[b * pk.gw + a]; i >= 0; i = pk.next[i]) {
          if (pk.SW[i] > pk.wMax || (VIS && !VIS[i])) continue;
          var dx = pk.SX[i] - x, dy = pk.SY[i] - y; if (dx * dx + dy * dy > r2) continue;
          if (n >= gatherBuf.length) { var nb = new Int32Array(gatherBuf.length * 2); nb.set(gatherBuf); gatherBuf = nb; }
          gatherBuf[n++] = i;
        }
      }
    }
    if (!n) return null;
    // 3D 칸(dabCell)마다 점 하나만 — 머리가 빽빽한 자리와 혼자 떠 있는 잔머리가 같은 세기로 칠해지게(점 수에 비례하지 않게)
    //   uniq 값 = [x, y, z, 가중, 꼭 남길 자리인가(뜬 점·거슬러 올라간 점)]
    var dc = C.dabCell, uniq = new Map(), k, key, wgt, ddx, ddy, prev, FL = pk.FL, nf = 0, touched = null, tv;
    function put(px, py, pz, wg, keep) {
      key = (Math.floor(px / dc) + 2048) + 4096 * ((Math.floor(py / dc) + 2048) + 4096 * (Math.floor(pz / dc) + 2048));
      prev = uniq.get(key);
      if (prev === undefined) { uniq.set(key, [px, py, pz, wg, keep]); if (keep) nf++; }
      else { if (wg > prev[3]) { prev[0] = px; prev[1] = py; prev[2] = pz; prev[3] = wg; } if (keep && !prev[4]) { prev[4] = 1; nf++; } }
    }
    for (k = 0; k < n; k++) {
      i = gatherBuf[k];
      ddx = pk.SX[i] - x; ddy = pk.SY[i] - y; wgt = Math.pow(1 - Math.sqrt(ddx * ddx + ddy * ddy) / rad, C.falloff);
      put(pk.PX[i], pk.PY[i], pk.PZ[i], wgt, FL ? FL[i] : 0);
      if (FL && FL[i] && C.reachBack && !pk.sweep) {                                    // 붓에 걸린 뜬 점 → 그 가닥을 기억(가장 끝 쪽 점 · 가장 큰 가중)
        if (!touched) touched = new Map();
        tv = touched.get(pk.SI[i]);
        if (tv === undefined) touched.set(pk.SI[i], [pk.SK[i], wgt]); else { if (pk.SK[i] > tv[0]) tv[0] = pk.SK[i]; if (wgt > tv[1]) tv[1] = wgt; }
      }
    }
    // (2026-10-05i) 벗어난 자리까지 거슬러 올라가기 — 붓에 "직접 걸린" 가닥만, 칠할 때 그 가닥을 따라 뿌리 쪽으로:
    //   뜬 점은 계속, 몸통 속으로 들어가면 reachIn점 더 가고 멈춤. 카메라 반대편(두상 가운데보다 뒤)으로 넘어가면 멈춤.
    //   (h에서는 가닥을 만들 때 붓이 안 닿은 자리까지 세기를 퍼뜨려서, 옆 가닥·반대편까지 번졌습니다 — 폰 실측: 12획에 9,999가닥 중 2,378가닥이 바뀜)
    var reached = 0;
    if (touched && pk.FM) {
      var e = pk.e, FMF = pk.FM.F, FMo = pk.FM.off, lim = Math.max(0, C.reachIn | 0);
      touched.forEach(function (v, si) {
        var pts = pk.list[si].pts, pre = (pts._pre && pts._pre.length === pts.length) ? pts._pre : pts, o = FMo[si], inB = 0, j, p;
        for (j = v[0] - 1; j >= 1; j--) {
          p = pts[j]; if (e[3] * p.x + e[7] * p.y + e[11] * p.z + e[15] > pk.wMax) break;
          if (FMF[o + j]) inB = 0; else if (++inB > lim) break;
          put(pre[j].x, pre[j].y, pre[j].z, v[1], 1); reached++;
        }
      });
    }
    // 자리가 dabMax보다 많으면 건너뛰며 고름 — 뜬 점·거슬러 올라간 점은 전부 남기고 몸통 속 점만 건너뜀
    var m0 = uniq.size, step = 1, j = 0, q = 0;
    if (m0 > C.dabMax) step = Math.max(1, Math.ceil((m0 - nf) / Math.max(1, C.dabMax - nf)));
    var D = new Float32Array((nf + Math.ceil((m0 - nf) / step) + 1) * 4);
    uniq.forEach(function (v) {
      if (!v[4] && (q++ % step)) return;
      D[j * 4] = v[0]; D[j * 4 + 1] = v[1]; D[j * 4 + 2] = v[2]; D[j * 4 + 3] = v[3]; j++;
    });
    return { dabs: D, m: j, seen: n, reached: reached };
  }

  /* ────────────────────────────────────────────────────────────────────────
   * ③ 손가락 — 빗질 모드에서 한 손가락 드래그
   * ────────────────────────────────────────────────────────────────────── */
  var stroke = null, pass = false, ptrs = new Map(), synth = false, liveT = 0, liveTimer = null;
  function onCanvas(e) { var m = m3(); return !!(m && e.target === m.renderer.domElement && m.container && m.container.id === 'adjust3dHost'); }
  function live() {
    if (liveTimer) return;
    var wait = Math.max(0, C.liveMs - (now() - liveT));
    liveTimer = setTimeout(function () { liveTimer = null; liveT = now(); redraw(); }, wait);
  }
  /* 지나온 길에서 dirLagPx 뒤의 점 → 지금 점 = 빗질 방향(화면) */
  function lagDir(st, x, y) {
    var tr = st.trail, n = tr.length, acc = 0, i;
    for (i = n - 2; i >= 0; i -= 2) {
      acc += Math.hypot((i + 2 < n ? tr[i + 2] : x) - tr[i], (i + 3 < n ? tr[i + 3] : y) - tr[i + 1]);
      if (acc >= C.dirLagPx) break;
    }
    if (i < 0) i = 0;
    return [x - tr[i], y - tr[i + 1]];
  }
  function addSample(x, y) {
    var st = stroke, pk = st.pk; if (!pk) return;
    var mvx = x - st.lx, mvy = y - st.ly, mv = Math.sqrt(mvx * mvx + mvy * mvy);
    if (mv < C.minMovePx) return;
    var ld = lagDir(st, x, y);
    st.trail.push(x, y); if (st.trail.length > 240) st.trail.splice(0, 120);
    var ll = Math.hypot(ld[0], ld[1]) || 1;                               // 방향만(길이 1) — 직전 방향과 섞어 손떨림을 한 번 더 누름
    if (st.vx === 0 && st.vy === 0) { st.vx = ld[0] / ll; st.vy = ld[1] / ll; }
    else { st.vx = st.vx * 0.7 + ld[0] / ll * 0.3; st.vy = st.vy * 0.7 + ld[1] / ll * 0.3; }
    // 원의 크기: 원 안에서 가장 가까운 점의 깊이로(상한 maxRadius)
    var i = pickAt(pk, x, y, C.radiusPx);
    if (i >= 0) st.w = pk.SW[i];
    var rPx = st.w > 0 ? Math.min(C.maxRadius, C.radiusPx * pk.perPx(st.w)) / pk.perPx(st.w) : null;
    showMark(x, y, rPx, Math.atan2(st.vy, st.vx));
    st.lx = x; st.ly = y;
    if (rPx == null) return;                                              // 아직 머리 위를 지난 적 없음
    var dx = pk.right.x * st.vx - pk.up.x * st.vy, dy = pk.right.y * st.vx - pk.up.y * st.vy, dz = pk.right.z * st.vx - pk.up.z * st.vy, dl = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (!(dl > 1e-9)) return;
    if (st.has && Math.hypot(x - st.sx, y - st.sy) < C.spacing * rPx) return;        // 원 반지름의 spacing만큼 움직일 때마다 한 번
    var gth = gather(pk, x, y, rPx);
    if (!gth) return;                                                     // 원 안에 보이는 머리가 없음
    if (C.samples.length + C.sweeps.length >= C.maxSamples) { if (!st.full) { st.full = true; try { showToast(lang() === 'ko' ? '빗질이 너무 많아요 — ↶로 되돌리거나 지워 주세요' : 'Too many comb strokes — undo or clear some'); } catch (e) {} } return; }
    if (pk.sweep) C.sweeps.push({ dabs: gth.dabs, m: gth.m, dx: dx / dl, dy: dy / dl, dz: dz / dl, k: C.sweepStrength, g: st.g });      // (j) 넘기기 획은 따로
    else C.samples.push({ dabs: gth.dabs, m: gth.m, dx: dx / dl, dy: dy / dl, dz: dz / dl, k: C.strength, g: st.g });
    st.sx = x; st.sy = y; st.has = true; st.n++; S.dabs = gth.m; S.seen = gth.seen; S.reached = gth.reached || 0;
    ver++; live();
  }
  function endStroke() {
    var st = stroke; stroke = null;
    if (!st) return;
    if (st.n) { if (st.sweep) S.sweepStrokes = (S.sweepStrokes || 0) + 1; else S.strokes++; if (liveTimer) { clearTimeout(liveTimer); liveTimer = null; } redraw(); }
    syncBtn();
  }
  function onDown(e) {
    if (synth || !C.on || !usable() || !onCanvas(e)) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
    if (pass) return;
    if (stroke) {                           // 두 번째 손가락 — 빗질을 멈추고 두 손가락을 화면 조작(이동·확대)에 넘김
      var first = stroke.id, fp = ptrs.get(first);
      endStroke(); pass = true;
      if (fp) { try { synth = true; e.target.dispatchEvent(new PointerEvent('pointerdown', { pointerId: first, clientX: fp.x, clientY: fp.y, bubbles: true, isPrimary: true, button: 0, pointerType: fp.type || 'touch' })); } catch (x) {} synth = false; }
      return;
    }
    if (e.button !== 0 || e.shiftKey) return;        // Shift+드래그·가운데/오른쪽 버튼 = 이동(그대로)
    var pk = null; try { pk = buildPick(); } catch (x) { S.err = String(x && x.message || x); }
    if (!pk) return;
    var rc = pk.rect, oy = e.pointerType === 'touch' ? C.touchOffset : 0, x0 = e.clientX - rc.left, y0 = e.clientY - rc.top - oy;
    stroke = { sweep: !!pk.sweep, id: e.pointerId, pk: pk, oy: oy, lx: x0, ly: y0, vx: 0, vy: 0, trail: [x0, y0], has: false, n: 0, g: ++gid, cx: 0, cy: 0, cz: 0, sx: 0, sy: 0, sz: 0, w: 0 };
    var i0 = pickAt(pk, x0, y0, C.radiusPx);
    if (i0 >= 0) stroke.w = pk.SW[i0];
    showMark(x0, y0, i0 >= 0 ? Math.min(C.maxRadius, C.radiusPx * pk.perPx(pk.SW[i0])) / pk.perPx(pk.SW[i0]) : null, null);
    e.stopPropagation();
  }
  function onMove(e) {
    if (ptrs.has(e.pointerId)) { var q = ptrs.get(e.pointerId); q.x = e.clientX; q.y = e.clientY; }
    if (!stroke && C.on && !pass && e.pointerType === 'mouse' && usable() && onCanvas(e)) {      // 마우스: 올려놓기만 해도 빗이 따라다님
      var r0 = e.target.getBoundingClientRect(); showMark(e.clientX - r0.left, e.clientY - r0.top, null, null);
    }
    if (!stroke || e.pointerId !== stroke.id) return;
    e.stopPropagation();
    var rc = stroke.pk.rect, oy = stroke.oy, ev = (typeof e.getCoalescedEvents === 'function') ? e.getCoalescedEvents() : null;
    if (ev && ev.length > 1) { for (var i = 0; i < ev.length; i++) addSample(ev[i].clientX - rc.left, ev[i].clientY - rc.top - oy); }
    else addSample(e.clientX - rc.left, e.clientY - rc.top - oy);
  }
  function onUp(e) {
    ptrs.delete(e.pointerId);
    if (stroke && e.pointerId === stroke.id) endStroke();
    if (!ptrs.size) pass = false;
  }
  document.addEventListener('pointerdown', onDown, true);
  W.addEventListener('pointermove', onMove, true);
  W.addEventListener('pointerup', onUp, true);
  W.addEventListener('pointercancel', onUp, true);

  /* ────────────────────────────────────────────────────────────────────────
   * 빗 표시 — 점선 원(실제로 바뀌는 범위) + 작은 빗(빗살이 가리키는 쪽 = 머리가 눕는 방향)
   * ────────────────────────────────────────────────────────────────────── */
  var mark = null, markR = 14;
  function restRadiusPx() {                 // 붓 자리를 아직 못 찾았을 때: 머리 가운데 깊이 기준
    try {
      var m = m3(), rect = m.renderer.domElement.getBoundingClientRect(), dist = MODEL3D_VIEW.base ? MODEL3D_VIEW.base.dist / MODEL3D_VIEW.zoom : m.camera.position.length();
      var pp = 2 * dist * Math.tan(m.camera.fov * Math.PI / 360) / rect.height;
      return Math.min(C.maxRadius, C.radiusPx * pp) / pp;
    } catch (e) { return C.radiusPx; }
  }
  function ensureMark() {
    var m = m3(); if (!m || !m.container || m.container.id !== 'adjust3dHost') return null;
    if (mark && mark.parentNode === m.container) return mark;
    mark = document.createElement('div'); mark.id = 'comb3dMark';
    mark.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;z-index:5;pointer-events:none;display:none;';
    mark.innerHTML = '<svg width="120" height="120" viewBox="-60 -60 120 120" style="position:absolute;left:-60px;top:-60px;overflow:visible">' +
      '<circle id="comb3dRing" r="14" fill="rgba(201,135,74,0.10)" stroke="#fff" stroke-width="2.5" opacity="0.9"/>' +
      '<circle id="comb3dRing2" r="14" fill="none" stroke="#c9874a" stroke-width="1.5" stroke-dasharray="4 3"/>' +
      '<g id="comb3dGlyph"><g transform="translate(0,0)">' +
      '<rect x="-13" y="-8" width="26" height="6" rx="2" fill="#c9874a" stroke="#1a1410" stroke-width="1"/>' +
      [-10.5, -7, -3.5, 0, 3.5, 7, 10.5].map(function (x) { return '<rect x="' + (x - 0.9) + '" y="-2.5" width="1.8" height="10" rx="0.8" fill="#c9874a" stroke="#1a1410" stroke-width="0.6"/>'; }).join('') +
      '</g></g></svg>';
    m.container.appendChild(mark);
    return mark;
  }
  /* (x,y) = 그림판 안 좌표 · rPx = 실제 반지름(px · null이면 직전 값) · ang = 빗질 방향(rad · null이면 아래) */
  function showMark(x, y, rPx, ang) {
    if (!C.indicator) return;
    var el = ensureMark(); if (!el) return;
    if (rPx != null && isFinite(rPx)) markR = Math.max(4, rPx);
    el.style.display = 'block';
    el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
    try {
      el.querySelector('#comb3dRing').setAttribute('r', markR.toFixed(1)); el.querySelector('#comb3dRing2').setAttribute('r', markR.toFixed(1));
      // 빗살이 진행 방향을 가리키게(빗 그림은 빗살이 +y) — 화면 각도 ang에서 90° 뺌
      var deg = ang == null ? 0 : ang * 180 / Math.PI - 90;
      el.querySelector('#comb3dGlyph').setAttribute('transform', 'rotate(' + deg.toFixed(1) + ')');
    } catch (e) {}
  }
  function hideMark() { if (mark) mark.style.display = 'none'; }
  function restMark() {                      // 빗질을 켰을 때: 화면 가운데에 빗을 보여 둠
    try {
      var m = m3(); if (!m || !C.on) { hideMark(); return; }
      var rect = m.renderer.domElement.getBoundingClientRect();
      showMark(rect.width / 2, rect.height / 2, restRadiusPx(), null);
    } catch (e) {}
  }
  C._mark = function () { return mark; };

  /* ────────────────────────────────────────────────────────────────────────
   * ④ 버튼
   * ────────────────────────────────────────────────────────────────────── */
  function lang() { try { return uiLang === 'ko' ? 'ko' : 'en'; } catch (e) { return 'ko'; } }
  var btn = null, undoBtn = null, sweepBtn = null, kWrap = null, kRange = null, kLabel = null;
  var K_LO = 0.03, K_HI = 0.6, K_KEY = 'gyeol_sweepLevel';
  function levelToK(lv) { lv = Math.max(1, Math.min(10, +lv || 7)); return +(K_LO * Math.pow(K_HI / K_LO, (lv - 1) / 9)).toFixed(3); }
  C.setSweepLevel = function (lv, keep) {
    lv = Math.max(1, Math.min(10, Math.round(+lv || 7)));
    C.sweepLevel = lv; C.sweepStrength = levelToK(lv);
    if (!keep) { try { localStorage.setItem(K_KEY, String(lv)); } catch (e) {} }
    try { if (kRange) kRange.value = String(lv); if (kLabel) kLabel.textContent = (lang() === 'ko' ? '세기 ' : 'Strength ') + lv; } catch (e) {}
    return C.sweepStrength;
  };
  function syncBtn() {
    try {
      if (!btn) return;
      var show = C.enabled && a3on(), sw = C.on && C.mode === 'sweep' && C.sweep;
      btn.style.display = show ? '' : 'none';
      btn.classList.toggle('on', !!C.on && !sw);
      btn.textContent = (C.on && !sw) ? '빗질 ON' : '빗질 OFF';
      if (sweepBtn) { sweepBtn.style.display = show && C.sweep ? '' : 'none'; sweepBtn.classList.toggle('on', !!sw); sweepBtn.textContent = sw ? '넘기기 ON' : '넘기기 OFF'; }
      if (kWrap) kWrap.style.display = show && sw ? 'inline-flex' : 'none';
      undoBtn.style.display = show && C.on ? '' : 'none';
      undoBtn.disabled = !(C.samples.length || C.sweeps.length);
      if (mark) { var r2 = mark.querySelector('#comb3dRing2'); if (r2) r2.setAttribute('stroke', sw ? '#3b82c4' : '#c9874a'); }
      var m = m3(); if (m && m.container && m.container.id === 'adjust3dHost') m.renderer.domElement.style.cursor = C.on ? 'crosshair' : '';
    } catch (e) {}
  }
  C.toggle = function (v, mode) {           // mode: 'tidy'(기본) | 'sweep' — 다른 쪽이 켜져 있으면 그쪽으로 바꿈
    mode = (mode === 'sweep' && C.sweep) ? 'sweep' : 'tidy';
    if (v == null) v = !(C.on && C.mode === mode);
    if (stroke) endStroke();
    C.on = !!v; if (C.on) C.mode = mode;
    syncBtn();
    if (C.on && mode === 'sweep') {
      restMark(); syncBtn();
      try { showToast(lang() === 'ko' ? '넘기고 싶은 머리에 빗(원)을 올리고 보낼 방향으로 쓸어 주세요 — 원 안의 머리가 뭉치째 그 방향으로 넘어갑니다 · 이어서 쓸면 더 넘어가요 · ↶ 되돌리기'
        : 'Put the comb (circle) on the hair and stroke the way you want it to go — the whole bundle inside the circle turns that way · keep stroking to carry it further · ↶ undo'); } catch (e) {}
    } else if (C.on) {
      restMark(); syncBtn();
      try { showToast(lang() === 'ko' ? '뜬 머리에 빗(원)을 올리고 결대로 쓸어 주세요 — 주변 머리의 결에 맞춰 눕습니다 · 빗은 손가락 조금 위에 있어요 · 두 손가락: 이동·확대'
        : 'Put the comb (circle) on the flyaways and sweep along the hair — they lie down into the surrounding flow · the comb sits just above your finger · two fingers: move / zoom'); } catch (e) {}
    } else hideMark();
  };
  try {
    var bar = document.querySelector('#screen-adjust .mode-bar'), mq = document.getElementById('mannequinBtn');
    if (bar) {
      btn = document.createElement('button'); btn.id = 'comb3dBtn'; btn.type = 'button';
      if (mq && mq.className) btn.className = mq.className;
      btn.title = '켜면 한 손가락 드래그가 빗질이 됩니다 — 잔머리를 결 방향으로 쓰다듬어 눕힙니다';
      btn.addEventListener('click', function () { C.toggle(); });
      undoBtn = document.createElement('button'); undoBtn.id = 'comb3dUndoBtn'; undoBtn.type = 'button';
      if (mq && mq.className) undoBtn.className = mq.className;
      undoBtn.textContent = '↶'; undoBtn.title = '마지막 빗질 한 획 되돌리기';
      undoBtn.addEventListener('click', function () { C.undo(); });
      sweepBtn = document.createElement('button'); sweepBtn.id = 'comb3dSweepBtn'; sweepBtn.type = 'button';
      if (mq && mq.className) sweepBtn.className = mq.className;
      sweepBtn.title = '켜면 한 손가락 드래그가 빗어 넘기기가 됩니다 — 원 안의 머리가 뭉치째 쓴 방향으로 넘어갑니다';
      sweepBtn.addEventListener('click', function () { C.toggle(null, 'sweep'); });
      // (k) 넘기기 세기 막대 — 넘기기를 켰을 때만 보임
      kWrap = document.createElement('span'); kWrap.id = 'comb3dSweepK';
      kWrap.style.cssText = 'display:none;align-items:center;gap:5px;vertical-align:middle;padding:2px 8px;border-radius:999px;background:rgba(30,25,21,0.82);color:#f3e9da;font-size:11px;line-height:1;white-space:nowrap;';
      kLabel = document.createElement('span');
      kRange = document.createElement('input'); kRange.type = 'range'; kRange.min = '1'; kRange.max = '10'; kRange.step = '1';
      kRange.style.cssText = 'width:84px;height:22px;margin:0;accent-color:#3b82c4;touch-action:pan-x;';
      kRange.title = '넘기기 세기 — 한 번 쓸 때 얼마나 넘어가나(여러 번 쓸면 쌓임)';
      kRange.addEventListener('input', function () { C.setSweepLevel(kRange.value); });
      ['pointerdown', 'touchstart', 'mousedown'].forEach(function (ev) { kWrap.addEventListener(ev, function (e) { e.stopPropagation(); }); });
      kWrap.appendChild(kLabel); kWrap.appendChild(kRange);
      var lv0 = C.sweepLevel; try { var sv = parseInt(localStorage.getItem(K_KEY), 10); if (sv >= 1 && sv <= 10) lv0 = sv; } catch (e) {}
      C.setSweepLevel(lv0, true);
      bar.appendChild(btn); bar.appendChild(sweepBtn); bar.appendChild(kWrap); bar.appendChild(undoBtn);
      syncBtn();
    }
  } catch (e) { console.warn(TAG + ' 버튼 만들기 실패', e); }
  try {
    if (typeof I18N !== 'undefined') {
      Object.assign(I18N, { '빗질 ON': 'Comb ON', '빗질 OFF': 'Comb OFF', '넘기기 ON': 'Sweep ON', '넘기기 OFF': 'Sweep OFF', '넘기기 세기 — 한 번 쓸 때 얼마나 넘어가나(여러 번 쓸면 쌓임)': 'Sweep strength — how far one stroke turns the hair (repeat strokes add up)',
        '켜면 한 손가락 드래그가 빗어 넘기기가 됩니다 — 원 안의 머리가 뭉치째 쓴 방향으로 넘어갑니다': 'When on, a one-finger drag sweeps — the whole bundle inside the circle turns the way you stroke',
        '켜면 한 손가락 드래그가 빗질이 됩니다 — 잔머리를 결 방향으로 쓰다듬어 눕힙니다': 'When on, a one-finger drag combs — stroke flyaways along the hair flow to lay them down',
        '마지막 빗질 한 획 되돌리기': 'Undo the last comb stroke' });
      try { _i18nSubKeys = null; } catch (e) {}
      try { if (typeof applyUiLang === 'function') applyUiLang(); } catch (e) {}
    }
  } catch (e) {}
  // 화면·모드가 바뀌면 버튼 맞춤 · 조정 화면을 떠나면 빗질 모드는 끔
  /* activateScreen(05)·toggleMannequin·mannequinReset(17a) 끝 — 조정 화면을 떠나면 빗질 모드 끔 · 버튼 맞춤 */
  C._afterUi = function (name, arg0) {
    try { if (name === 'activateScreen' && arg0 !== 'adjust' && C.on) { C.on = false; if (stroke) endStroke(); hideMark(); } syncBtn(); } catch (e) {}
  };
  /* model3dApplyView(18) 끝 — 확대가 바뀌면 붓 원 크기 */
  C._afterApplyView = function () {
    try { if (C.on && !stroke && mark && mark.style.display !== 'none') { markR = Math.max(4, restRadiusPx()); mark.querySelector('#comb3dRing').setAttribute('r', markR.toFixed(1)); mark.querySelector('#comb3dRing2').setAttribute('r', markR.toFixed(1)); } } catch (e) {}
  };
  C._syncBtn = function () { try { syncBtn(); } catch (e) {} };   // renderAdjustFrame(07b) 끝

  /* ────────────────────────────────────────────────────────────────────────
   * ⑤ 진단
   * ────────────────────────────────────────────────────────────────────── */
  C._panelLines = function () {   // perfPanelLines(18) 끝
    var L = [];
    try {
      L.push(TAG + ' ' + (C.enabled ? (C.on ? '켜짐(빗질 모드)' : '대기') : '꺼짐') + ' · 획 ' + S.strokes + ' · 표본 ' + C.samples.length + '/' + C.maxSamples +
        ' · 넘기기 ' + (C.sweep ? (C.on && C.mode === 'sweep' ? '켜짐' : '대기') + ' — 세기 ' + C.sweepLevel + '/10(표본 세기 ' + C.sweepStrength + ') · 획 ' + (S.sweepStrokes || 0) + ' · 표본 ' + C.sweeps.length + ' · 직전에 넘어간 가닥 ' + (S.swept || 0) + '(두상에 막혀 눕힌 마디 ' + (S.sweptPush || 0) + ') · 방향 장 ' + (F2 ? F2.n : 0) + '칸' : '꺼짐(COMB3D.sweep=false)') +
        ' · 직전에 바뀐 가닥 ' + S.touched + ' · 가닥 만들기 ' + Math.round(S.ms) + 'ms(빗질 포함) · 붓 자리 찾기 준비 ' + Math.round(S.pickMs) + 'ms(점 ' + S.pickPts + ') · 직전 표본이 칠한 점 ' + S.dabs + '(원 안에 보인 점 ' + S.seen + ')' +
        ' · 방향 장 ' + (F ? F.n : 0) + '칸 · 붓 ' + C.radiusPx + 'px(상한 ' + C.maxRadius + ' · 지금 화면에서 ' + Math.round(markR) + 'px) · 세기 ' + C.strength + ' · 터치 빗 위치 손가락 위 ' + C.touchOffset + 'px' + (S.err ? ' · ⚠ ' + S.err : ''));
      L.push('  결 따라 빗기 ' + (C.grain ? (flowMemo && flowMemo.flow ? '켜짐 — 결 칸 ' + S.flowCells + ' · 몸통 머리 보통 밀도 칸당 ' + S.flowRef + '가닥 · 결 읽기 ' + Math.round(S.flowMs) + 'ms' : '켜짐(아직 결을 안 읽음 — 빗을 대면 읽음)') : '꺼짐(손가락 방향 그대로)') +
        ' · 직전에 본 마디의 목표: 제 무리의 결 ' + S.tOwn + ' / 손가락 쪽 이웃의 결 ' + S.tSide + ' / 이웃 전체의 결 ' + S.tAll + ' / 두상 쪽에서 찾은 결 ' + S.tReach + ' / 손가락 방향(주변에 머리 없음) ' + S.tFinger + ' / 결이 갈려 그대로 둠 ' + S.tSkip +
        ' · 허용 각 ' + C.tolFrom + '~' + C.tolFull + '° · ' + (C.collide ? '두상에 막혀 눕힌 마디 ' + S.pushed + ' / 목 밖으로 민 점 ' + S.neck : '두상 막기 꺼짐') +
        ' · ' + (C.anchor ? '몸통 붙들기 켜짐 — 제자리로 되돌린 점 ' + S.anch + ' / 몸통 쪽으로 기울인 마디 ' + S.pin : '몸통 붙들기 꺼짐'));
      L.push('  겉면 타기 ' + (C.surf ? (flowMemo && flowMemo.flow && flowMemo.flow.DF ? '켜짐 — 몸통 칸 ' + S.surfCells + '(잔칸 보통 밀도 ' + S.surfRef + '가닥) · 뜬 점 ' + (floatMemo ? floatMemo.cnt + '/' + floatMemo.tot : '-') +
        ' · 직전에 세기가 걸린 잔머리 마디 ' + S.fly + ' · 그중 거슬러 올라가 세기를 올린 마디 ' + S.up + (C.reachBack ? '(직전 표본이 가닥을 따라 올라가며 칠한 점 ' + S.reached + ')' : '(거슬러 올라가기 꺼짐)') +
        ' · 겉면 쪽으로 튼 마디 ' + S.pin + (C.settle > 0 ? '' : '(꺼짐 — 방향 정렬만)') + ' · 6cm 상한에 걸린 점 ' + S.clamp +
        ' · 붓 자리 찾기: 따로 넣은 뜬 점 ' + (S.pickFly || 0) + ' / 겉층 뒤라 뺀 점 ' + (S.pickHidden || 0) + (C.depthLayer > 0 ? '' : '(깊이 안 가림)') : (C.grain ? '켜짐(아직 거리장 없음 — 빗을 대면 만듦)' : '꺼짐(결 따라 빗기가 꺼져 있음)')) : '꺼짐(예전 방식)'));
    } catch (e) {}
    return L;
  };

  console.log(TAG + ' 설치 — 3D 조정 화면에서 [빗질]을 켜고 잔머리를 결 방향으로 쓰다듬으면 그 방향으로 눕습니다 · [넘기기]를 켜고 쓸면 원 안의 머리가 뭉치째 그 방향으로 넘어갑니다. 지우기 COMB3D.clear() · 되돌리기 COMB3D.undo()');
  return C;
})();

/* ==========================================================================
 * FLY_TRIM (옛 55-fly-trim.js) — 곱슬머리의 잔머리는 "정렬"이 아니라 "잘라내기"
 *
 * 자리: 17a, COMB3D 바로 뒤. combStrand3D 맨 바깥(곱슬이면 3D 빗질 정렬 건너뜀) · computeAdjustedHair3DStrands(17b) 마감 FLY_TRIM._apply · adjFilterSig 꼬리표 · initModel3DRenderer·setupModel3DScreen(18)·activateScreen(05) 끝 결과 화면 선분 거르기 연결 · perfPanelLines(18) 끝 줄
 *
 * 왜 (2026-10-06 · 사용자, 곱슬 손님 영상): "컬은 빗질을 하면 저렇게 뻗친다. 결 정렬이 아니니까 잔머리들을 삭제하는 방법으로 할까.
 *   그리고 3D 결과 보기에서는 렌더링 과정에서 또 잔머리들이 생긴다. 그건 못 막잖아."
 *   · 곱슬머리는 가닥이 원래 엇갈려 있어서 "이웃과 나란히"가 맞지 않습니다. 53번 빗질(결 정렬)을 하면 감긴 가닥이 펴져서 곧게 뻗칩니다.
 *   · 3D 결과 화면은 가닥을 전부(예: 29,987) 그리고 조정 화면은 일부(PC 25,000 · 폰 10,000)만 그립니다. 조정 화면에 안 보이던 가닥의
 *     삐져나온 끝이 결과 화면에서 새로 보입니다 — 눈으로 보고 빗을 수가 없던 가닥들입니다.
 *
 * 무엇을 (컬이 있는 머리에서만 — 섹션 컬 평균이 minCurl 이상):
 *   ① 자동 정리 — 가닥을 다 만든 뒤(컬까지 건 최종 모양), 가닥이 빽빽한 "몸통"을 칸(cell ≈ 1.3cm)으로 찾고,
 *      몸통에서 한 칸 넘게 벗어난 채로 끝난 꼬리(길이 minTail 이상)와, 몸통 밖으로 maxOut 넘게 나갔다 돌아오는 고리를 그 자리에서 잘라 냅니다.
 *      조정 화면과 3D 결과 화면이 같은 규칙을 거치므로, 결과 화면에서만 새로 보이던 잔머리도 같이 정리됩니다.
 *   ② 빗 = 가위 — 컬이 있는 머리에서는 53번 빗질이 가닥을 돌리지 않게 하고(기록된 획은 그대로 둠), 빗이 지나간 자리에서
 *      몸통 밖으로 나온 부분을 여유 없이 잘라 냅니다. ↶(되돌리기)는 53번 것이 그대로 듣습니다.
 *   직모(컬 평균 < minCurl)는 아무것도 안 바꿉니다 — 빗질은 예전처럼 결 정렬입니다.
 *
 * (2026-10-06b) ③ 3D 결과 화면: 그려지는 선분에서 잔머리를 아예 뺌 — 사용자: "3D 결과 보기로 넘어가는 타이밍의 최종 화면은 잔머리들을
 *   아예 제거할 수 있는 방법을 모색해 봐."
 *   결과 화면의 헤어는 가닥 목록을 만든 뒤에도 다듬기(36)·다발 묶기(37 — 가닥을 다발 대표 쪽으로 70% 당김)를 더 거치고, 가닥도 전부 그립니다.
 *   그래서 가닥 목록 단계에서 손질해도 그 뒤에 새로 삐져나오는 것이 생깁니다. → 맨 마지막, "화면에 올라간 선분"에서 거릅니다(직모·곱슬 모두):
 *     · 결과 화면을 그릴 때 헤어 선분 묶음(LineSegments)을 찾아 한 번만 처리(같은 묶음은 다시 안 함 · 새로 만들어지면 다시).
 *     · 칸(finalCellCm ≈ 0.8cm)마다 그 칸을 지나는 머리카락 길이를 더함 → "가닥 몇 개가 지나가나"로 환산.
 *     · 몸통 = 가닥 finalHi개 이상(또는 보통 칸의 finalFrac) 지나는 칸에서 시작해, finalLo개 이상 지나는 이웃 칸으로 이어진 덩어리(finalDilate로 둘레를 더 남길 수 있음).
 *     · 나머지 칸에 있는 선분은 길이 0으로 접어 안 보이게 함(버퍼 크기·그리기 범위는 안 건드림 — 버퍼를 재사용하는 37번과 안 부딪히게).
 *   조정 화면의 머리는 그대로입니다(빗질·확인용). 끄기: FLY_TRIM.final=false
 *   ⚠ 일부러 성기게 낸 머리(시스루 앞머리·잔머리 연출)도 "가닥 finalLo개 미만이 지나는 자리"면 같이 빠집니다.
 *
 * ⚠ 합성 머리로만 확인했습니다. 몸통 판정(칸에 가닥 minStrands개 · 중앙값의 frac)은 어림값이라 숱이 성근 자리(앞머리 끝·목덜미)가
 *   같이 잘릴 수 있습니다 — 진단 [잔머리 정리] 줄에 자른 가닥 수와 길이가 찍힙니다.
 *
 * 끄기: FLY_TRIM.on=false; FLY_TRIM.refresh() · 자동만 끄기 FLY_TRIM.auto=false · 빗-가위만 끄기 FLY_TRIM.brush=false
 * ========================================================================== */
var FLY_TRIM = (function () {
  'use strict';
  var W = window, TAG = '[잔머리 정리]';
  var F = Object.assign({
    on: true, auto: false, brush: true,   // (2026-10-10) auto 끔 — 사용자: "제한을 두면 안 돼". 결을 잡고 있어 뜨는 머리가 없으니, 몸통 밖으로 나간 컬 고리·꼬리를 저절로 자르지 않음(떨어진 타래가 잘려 나가던 것). 빗질로 쓸 때만 자름. 예전대로 FLY_TRIM.auto=true
    minCurl: 30,        // 섹션 컬 평균이 이 이상일 때만
    cell: 0.07,         // 몸통을 보는 칸(모델 단위 ≈ 1.3cm)
    minStrands: 3,      // 칸을 지나는 가닥이 이만큼은 돼야 몸통
    frac: 0.12,         // …그리고 (가닥이 있는 칸들의) 중앙값의 이 비율 이상
    refStrands: 10000,  // minStrands의 기준 가닥 수 — 더 많이 그릴 때는 비례해서 올림(조정 화면과 결과 화면이 같은 모양을 자르게)
    minTail: 0.08,      // 몸통(한 칸 여유) 밖에서 끝난 꼬리가 이 길이(≈ 1.5cm) 이상이면 자름
    maxOut: 0.16,       // 몸통 밖으로 이 길이(≈ 3cm) 넘게 나갔다 돌아오는 고리도 나간 자리에서 자름
    brushBack: 0.25,    // 빗-가위: 그 뒤로 몸통 안에 있는 점이 이 비율을 넘으면 꼬리가 아니라 몸통 머리로 보고 안 자름
    keepPts: 3,         // 가닥은 최소 이 점 수는 남김
    // (2026-10-06b) ③ 3D 결과 화면의 선분 거르기
    final: true,
    finalCellCm: 0.8,   // 칸 크기(cm)
    finalLo: 4,         // 가닥 이만큼은 지나가야 몸통에 이어 붙음
    finalHi: 10,        // 몸통의 씨앗: 가닥 이만큼 이상 지나는 칸
    finalFrac: 0.2,     // …또는 보통 칸(머리 있는 칸의 중앙값)의 이 비율 이상
    finalDilate: 0,     // 몸통 둘레로 이 칸 수까지는 남김(0 = 몸통 칸만 · 1이면 둘레 0.8cm의 잔 삐침은 남음)
    finalMinSegs: 20000 // 선분이 이보다 적은 묶음은 머리가 아니라고 보고 안 건드림(핀·장식 등)
  }, W.FLY_TRIM || {});
  var S = F.stats = { curly: false, curl: 0, strands: 0, autoCut: 0, loopCut: 0, brushCut: 0, cutLen: 0, cells: 0, body: 0, thr: 0, ms: 0, err: null };
  var ver = 0, EMPTY = [];

  function now() { try { return performance.now(); } catch (e) { return Date.now(); } }
  function avgCurl() {
    try { var k, n = 0, s = 0; for (k in state.sections) { var c = +state.sections[k].curl; if (isFinite(c)) { s += c; n++; } } return n ? s / n : 0; } catch (e) { return 0; }
  }
  function curly() { return !!(F.on && avgCurl() >= F.minCurl); }
  F.curly = curly;

  /* ② 컬이 있는 머리에서는 53번 빗질(돌리기)을 건너뜀 — 획은 그대로 두고, 자르기는 아래 pass가 함 */
  F._comb = function (run) {   // combStrand3D(17a) 맨 바깥 — run = 안쪽 빗질
    var C = W.COMB3D;
    if (!(F.brush && C && C.samples && C.samples.length && curly())) return run();
    var keep = C.samples; C.samples = EMPTY;
    try { return run(); } finally { C.samples = keep; }
  };

  var memo = new WeakMap();
  function pass(list) {
    S.curl = Math.round(avgCurl()); S.curly = curly();
    if (!S.curly || !list || !list.length) return list;
    var C = W.COMB3D, nSm = (F.brush && C && C.samples) ? C.samples.length : 0;
    var hit = memo.get(list); if (hit && hit.ver === ver && hit.nSm === nSm) return hit.out;
    var t0 = now(), n = list.length, i, k, p, e, cell = F.cell;
    var mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (i = 0; i < n; i++) { p = list[i] && list[i].pts; if (!p) continue; for (k = 0; k < p.length; k++) { var q = p[k];
      if (q.x < mn[0]) mn[0] = q.x; if (q.y < mn[1]) mn[1] = q.y; if (q.z < mn[2]) mn[2] = q.z; if (q.x > mx[0]) mx[0] = q.x; if (q.y > mx[1]) mx[1] = q.y; if (q.z > mx[2]) mx[2] = q.z; } }
    if (!isFinite(mn[0])) return list;
    var nx = Math.min(160, Math.floor((mx[0] - mn[0]) / cell) + 3), ny = Math.min(200, Math.floor((mx[1] - mn[1]) / cell) + 3), nz = Math.min(160, Math.floor((mx[2] - mn[2]) / cell) + 3);
    var ox = mn[0] - cell, oy = mn[1] - cell, oz = mn[2] - cell, N = nx * ny * nz, cnt = new Uint16Array(N), last = new Int32Array(N).fill(-1);
    function idx(q) { var a = Math.floor((q.x - ox) / cell), b = Math.floor((q.y - oy) / cell), c = Math.floor((q.z - oz) / cell); return (a < 0 || b < 0 || c < 0 || a >= nx || b >= ny || c >= nz) ? -1 : a + nx * (b + ny * c); }
    for (i = 0; i < n; i++) { p = list[i] && list[i].pts; if (!p) continue; for (k = 0; k < p.length; k++) { var id = idx(p[k]); if (id >= 0 && last[id] !== i) { last[id] = i; if (cnt[id] < 65535) cnt[id]++; } } }
    var nz0 = [], j; for (j = 0; j < N; j++) if (cnt[j]) nz0.push(cnt[j]);
    nz0.sort(function (a, b) { return a - b; });
    var med = nz0.length ? nz0[nz0.length >> 1] : 0, thr = Math.max(F.minStrands * Math.max(1, n / F.refStrands), F.frac * med);
    var B = new Uint8Array(N), D = new Uint8Array(N), nb = 0, sx = 1, sy = nx, sz = nx * ny;
    for (j = 0; j < N; j++) if (cnt[j] >= thr) { B[j] = 1; nb++; }
    for (j = 0; j < N; j++) if (B[j]) { D[j] = 1; if (j - sx >= 0) D[j - sx] = 1; if (j + sx < N) D[j + sx] = 1; if (j - sy >= 0) D[j - sy] = 1; if (j + sy < N) D[j + sy] = 1; if (j - sz >= 0) D[j - sz] = 1; if (j + sz < N) D[j + sz] = 1; }
    S.cells = nz0.length; S.body = nb; S.thr = thr;
    // 빗이 지나간 칸
    var P = null;
    if (nSm) {
      P = new Uint8Array(N);
      var rr = Math.max(1, Math.round((C.dab > 0 ? C.dab : 0.045) / cell)), si, a, b, c;      // 칠한 점 둘레 한 칸
      for (si = 0; si < C.samples.length; si++) {
        var sm = C.samples[si], dd = sm && sm.dabs, m = sm && sm.m; if (!dd || !m) continue;
        for (k = 0; k < m; k++) {
          var cx = Math.floor((dd[k * 4] - ox) / cell), cy = Math.floor((dd[k * 4 + 1] - oy) / cell), cz = Math.floor((dd[k * 4 + 2] - oz) / cell);
          for (c = cz - rr; c <= cz + rr; c++) { if (c < 0 || c >= nz) continue; for (b = cy - rr; b <= cy + rr; b++) { if (b < 0 || b >= ny) continue; for (a = cx - rr; a <= cx + rr; a++) { if (a < 0 || a >= nx) continue; P[a + nx * (b + ny * c)] = 1; } } }
        }
      }
    }
    var out = new Array(n), aC = 0, lC = 0, bC = 0, cutLen = 0;
    for (i = 0; i < n; i++) {
      e = list[i]; p = e && e.pts; out[i] = e;
      if (!p || p.length <= F.keepPts) continue;
      var m2 = p.length, cut = m2, why = 0, runStart = -1, runLen = 0, id2;
      for (k = 1; k < m2; k++) {
        id2 = idx(p[k]);
        if (P && k >= F.keepPts && id2 >= 0 && P[id2] && !B[id2]) {
          // 빗이 지나간 자리에서 몸통 밖: 여기서부터 끝까지 거의 몸통 밖이면(= 삐져나온 꼬리) 자름. 다시 몸통으로 들어가는 가닥(성근 칸을 지나는 몸통 머리)은 그대로
          var inB = 0, kk, idk; for (kk = k + 1; kk < m2; kk++) { idk = idx(p[kk]); if (idk >= 0 && B[idk]) inB++; }
          if (inB <= F.brushBack * (m2 - k)) { cut = k; why = 3; break; }
        }
        if (!F.auto) continue;
        if (id2 < 0 || !D[id2]) {
          if (runStart < 0) { runStart = k; runLen = 0; }
          runLen += Math.hypot(p[k].x - p[k - 1].x, p[k].y - p[k - 1].y, p[k].z - p[k - 1].z);
          if (runLen >= F.maxOut && k < m2 - 1) { cut = Math.max(F.keepPts, runStart); why = 2; break; }   // 멀리 나간 고리
        } else runStart = -1;
      }
      if (cut === m2 && F.auto && runStart >= 0 && runLen >= F.minTail) { cut = Math.max(F.keepPts, runStart); why = 1; }   // 밖에서 끝난 꼬리
      if (cut >= m2) continue;
      for (k = cut; k < m2; k++) cutLen += Math.hypot(p[k].x - p[k - 1].x, p[k].y - p[k - 1].y, p[k].z - p[k - 1].z);
      var np = p.slice(0, cut);
      try { np._pre = (p._pre && p._pre.length === p.length) ? p._pre.slice(0, cut) : np; } catch (e2) {}
      var ne = Object.assign({}, e, { pts: np });
      try { if (e.colors && e.colors.length === p.length) ne.colors = e.colors.slice(0, cut); if (e.srcColors && e.srcColors.length === p.length) ne.srcColors = e.srcColors.slice(0, cut); } catch (e3) {}
      out[i] = ne;
      if (why === 1) aC++; else if (why === 2) lC++; else bC++;
    }
    S.strands = n; S.autoCut = aC; S.loopCut = lC; S.brushCut = bC; S.cutLen = cutLen; S.ms = now() - t0;
    memo.set(list, { ver: ver, nSm: nSm, out: out });
    return out;
  }
  F._pass = pass;

  F._apply = function (list) {   // computeAdjustedHair3DStrands(17b) 마감
    try { return pass(list); } catch (e) { S.err = String(e && e.message || e); return list; }
  };
  F._sigTail = function () { return '|ft' + ver + (curly() ? 'c' : 's'); };   // adjFilterSig(17b) 끝
  F.refresh = function () {
    ver++;      // 결과 화면의 묶음도 다음에 그릴 때 다시 거름(이미 접은 선분은 되살아나지 않음 — 머리를 다시 만들어야 돌아옴)
    try { if (typeof ADJ_CACHE !== 'undefined' && ADJ_CACHE.bump) ADJ_CACHE.bump(); } catch (e) {}
    try { if (typeof renderAdjustFrame === 'function') renderAdjustFrame(); } catch (e) {}
  };
  /* ────────────────────────────────────────────────────────────────────────
   * ③ 3D 결과 화면 — 그려지는 선분에서 잔머리 빼기
   * ────────────────────────────────────────────────────────────────────── */
  var FS = F.finalStats = { runs: 0, segs: 0, removed: 0, cells: 0, body: 0, lo: 0, hi: 0, ms: 0, objs: 0, err: null };
  /* pos: [x0,y0,z0, x1,y1,z1, …] 선분 nSeg개. 몸통 밖 선분을 길이 0으로 접음. 돌려주는 값: 접은 선분 수 */
  F.filterSegments = function (pos, nSeg, cmPerUnit) {
    var t0 = now(), cm = cmPerUnit > 0 ? cmPerUnit : 16.4, cell = F.finalCellCm / cm, i, j;
    var mnx = Infinity, mny = Infinity, mnz = Infinity, mxx = -Infinity, mxy = -Infinity, mxz = -Infinity, x, y, z;
    for (i = 0; i < nSeg * 2; i++) { x = pos[i * 3]; y = pos[i * 3 + 1]; z = pos[i * 3 + 2]; if (!(x === x)) continue;
      if (x < mnx) mnx = x; if (x > mxx) mxx = x; if (y < mny) mny = y; if (y > mxy) mxy = y; if (z < mnz) mnz = z; if (z > mxz) mxz = z; }
    if (!isFinite(mnx)) return 0;
    var nx, ny, nz, N;
    for (;;) { nx = Math.floor((mxx - mnx) / cell) + 3; ny = Math.floor((mxy - mny) / cell) + 3; nz = Math.floor((mxz - mnz) / cell) + 3; N = nx * ny * nz; if (N <= 2500000) break; cell *= 1.26; }
    var ox = mnx - cell, oy = mny - cell, oz = mnz - cell, inv = 1 / cell, half = cell * 0.5, G = new Float32Array(N);
    function cid(px, py, pz) { return Math.floor((px - ox) * inv) + nx * (Math.floor((py - oy) * inv) + ny * Math.floor((pz - oz) * inv)); }
    var ax, ay, az, bx, by, bz, len, ns, k, t;
    for (i = 0; i < nSeg; i++) {
      j = i * 6; ax = pos[j]; ay = pos[j + 1]; az = pos[j + 2]; bx = pos[j + 3]; by = pos[j + 4]; bz = pos[j + 5];
      len = Math.sqrt((bx - ax) * (bx - ax) + (by - ay) * (by - ay) + (bz - az) * (bz - az));
      if (!(len > 1e-9)) continue;
      ns = Math.ceil(len / half); if (ns > 64) ns = 64;
      for (k = 0; k < ns; k++) { t = (k + 0.5) / ns; G[cid(ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t)] += len / ns; }
    }
    var nzv = []; for (i = 0; i < N; i++) if (G[i] > 0) nzv.push(G[i]);
    if (!nzv.length) return 0;
    nzv.sort(function (p, q) { return p - q; });
    var med = nzv[nzv.length >> 1], lo = F.finalLo * cell, hi = Math.max(F.finalHi * cell, F.finalFrac * med);
    // 몸통: 씨앗(hi 이상)에서 lo 이상인 이웃(26방향)으로 번짐
    var B = new Uint8Array(N), stack = [], nb = 0, a, b, c, da, db, dc, q2, sxy = nx * ny;
    for (i = 0; i < N; i++) if (G[i] >= hi) { B[i] = 1; stack.push(i); nb++; }
    while (stack.length) {
      i = stack.pop(); c = (i / sxy) | 0; b = ((i - c * sxy) / nx) | 0; a = i - c * sxy - b * nx;
      for (dc = -1; dc <= 1; dc++) { if (c + dc < 0 || c + dc >= nz) continue; for (db = -1; db <= 1; db++) { if (b + db < 0 || b + db >= ny) continue; for (da = -1; da <= 1; da++) { if (a + da < 0 || a + da >= nx) continue;
        q2 = (a + da) + nx * ((b + db) + ny * (c + dc)); if (!B[q2] && G[q2] >= lo) { B[q2] = 1; stack.push(q2); nb++; } } } }
    }
    var K = B, r;
    for (r = 0; r < (F.finalDilate | 0); r++) {
      var K2 = new Uint8Array(K);
      for (i = 0; i < N; i++) if (K[i]) { if (i - 1 >= 0) K2[i - 1] = 1; if (i + 1 < N) K2[i + 1] = 1; if (i - nx >= 0) K2[i - nx] = 1; if (i + nx < N) K2[i + nx] = 1; if (i - sxy >= 0) K2[i - sxy] = 1; if (i + sxy < N) K2[i + sxy] = 1; }
      K = K2;
    }
    var removed = 0;
    for (i = 0; i < nSeg; i++) {
      j = i * 6; ax = pos[j]; ay = pos[j + 1]; az = pos[j + 2]; bx = pos[j + 3]; by = pos[j + 4]; bz = pos[j + 5];
      if (ax === bx && ay === by && az === bz) continue;
      if (!K[cid((ax + bx) * 0.5, (ay + by) * 0.5, (az + bz) * 0.5)]) { pos[j + 3] = ax; pos[j + 4] = ay; pos[j + 5] = az; removed++; }
    }
    FS.runs++; FS.segs = nSeg; FS.removed = removed; FS.cells = nzv.length; FS.body = nb; FS.lo = lo / cell; FS.hi = hi / cell; FS.ms = now() - t0;
    return removed;
  };
  function scr() { try { return currentScreen; } catch (e) { return ''; } }
  /* 결과 화면에 올라가 있는 헤어 선분 묶음을 찾아 아직 안 거른 것만 거름 */
  F.sweepScene = function () {
    if (!F.on || !F.final) return 0;
    var m = null; try { m = (model3D && model3D.initialized) ? model3D : null; } catch (e) { m = null; }
    if (!m || !m.headGroup || typeof m.headGroup.traverse !== 'function') return 0;
    var cm = 16.4, done = 0; try { cm = modelCmPerUnit() || 16.4; } catch (e) {}
    m.headGroup.traverse(function (o) {
      try {
        if (!o || !o.isLineSegments || !o.geometry || o.geometry.index) return;
        var g = o.geometry, at = g.attributes && g.attributes.position; if (!at || !at.array || at.itemSize !== 3) return;
        var nSeg = Math.floor(at.count / 2); if (nSeg < F.finalMinSegs) return;
        var ud = g.userData || (g.userData = {});
        if (ud._ftArr === at.array && ud._ftVer === at.version && ud._ftCfg === ver) return;      // 이미 거른 묶음
        F.filterSegments(at.array, nSeg, cm);
        at.needsUpdate = true;
        ud._ftArr = at.array; ud._ftVer = at.version; ud._ftCfg = ver; done++;
      } catch (e) { FS.err = String(e && e.message || e); }
    });
    if (done) FS.objs = done;
    return done;
  };
  function patchRender() {
    try {
      var m = (model3D && model3D.initialized) ? model3D : null; if (!m || !m.renderer || m.renderer.__ft) return;
      var r = m.renderer, orig = r.render; r.__ft = true;
      r.render = function () {
        if (F.on && F.final && scr() === 'model3d') { try { F.sweepScene(); } catch (e) { FS.err = String(e && e.message || e); } }
        return orig.apply(this, arguments);
      };
    } catch (e) {}
  }
  /* initModel3DRenderer·setupModel3DScreen(18)·activateScreen(05) 끝 — r = 그 함수가 돌려준 값(Promise면 끝난 뒤 한 번 더) */
  F._patchRender = function (r) {
    try { patchRender(); if (r && typeof r.then === 'function') r.then(patchRender, function () {}); } catch (e) {}
  };

  F._panelLines = function () {   // perfPanelLines(18) 끝
    var L = [];
    try {
      var cm = 16.4; try { cm = modelCmPerUnit() || 16.4; } catch (e) {}
      var cutN = S.autoCut + S.loopCut + S.brushCut;
      L.push(TAG + ' ' + (!F.on ? '꺼짐' : !S.curly ? '대기 — 컬 평균 ' + S.curl + ' < ' + F.minCurl + ' (직모는 빗질 = 결 정렬 그대로)' :
        '켜짐(컬 평균 ' + S.curl + ') · 직전 가닥 ' + S.strands + '개 중 자른 것 ' + cutN + '개 — 밖에서 끝난 꼬리 ' + S.autoCut + ' · 멀리 나간 고리 ' + S.loopCut + ' · 빗이 지나간 자리 ' + S.brushCut +
        ' · 자른 길이 평균 ' + (cutN ? (S.cutLen / cutN * cm).toFixed(1) : '0') + 'cm · 몸통 칸 ' + S.body + '/' + S.cells + '(기준 가닥 ' + S.thr.toFixed(1) + '개) · ' + Math.round(S.ms) + 'ms' +
        ' · 이 머리에서는 빗 = 가위(53번 결 정렬은 건너뜀)') + (S.err ? ' · ⚠ ' + S.err : ''));
      L.push('  3D 결과 화면 선분 거르기: ' + (!F.on || !F.final ? '꺼짐' : !FS.runs ? '켜짐 · 아직 결과 화면을 안 그림' :
        '켜짐 · 직전 묶음 선분 ' + FS.segs + '개 중 뺀 것 ' + FS.removed + '개(' + (FS.removed / Math.max(1, FS.segs) * 100).toFixed(1) + '%) · 머리 있는 칸 ' + FS.cells + ' 중 몸통 ' + FS.body +
        ' · 기준: 가닥 ' + FS.lo.toFixed(1) + '개 이상 이어진 칸(씨앗 ' + FS.hi.toFixed(1) + '개) · ' + Math.round(FS.ms) + 'ms · 처리한 횟수 ' + FS.runs) + (FS.err ? ' · ⚠ ' + FS.err : ''));
    } catch (e) {}
    return L;
  };
  console.log(TAG + ' 설치 — 컬이 있는 머리(섹션 컬 평균 ' + F.minCurl + ' 이상)는 몸통에서 벗어난 잔머리를 잘라 내고, 빗질도 정렬 대신 자르기로 동작합니다. 끄기 FLY_TRIM.on=false 후 FLY_TRIM.refresh()');
  return F;
})();
function combRefresh(){
  if(typeof drawAdjustPreview === 'function') drawAdjustPreview();
  if(typeof refreshDevMini3D === 'function') refreshDevMini3D();
  const b = document.getElementById('combUndoBtn');
  if(b) b.disabled = !COMB.strokes.length;
}
/* 화면 좌표 → 지금 보이는 가닥 중 가장 가까운 점(3D). 역투영을 새로 만들지
   않고 <b>렌더가 쓰는 정투영</b>을 그대로 되돌려 쓴다 — 두 경로가 갈라지지 않게. */
function combPickAnchor(px, py){
  const P = COMB._proj, m = state.hair3Dneutral;
  if(!P || !m || !m.strands || !m.strands.length) return null;
  const adj = computeAdjustedHair3DStrands(null, Math.max(1, m.strands.length/900));
  if(!adj || !adj.length) return null;
  let best = null, bd = Infinity;
  /* "보이는"의 뜻을 렌더와 같게 맞춘다 (2026-08-18 h) — 정면에서 목 옆으로 나온
     뒷머리는 이제 화면에 그려지므로, 빗질도 그걸 집을 수 있어야 한다. */
  const occ = makeViewOccluder(P.cal);
  for(const st of adj){
    for(const q of st.pts){
      const pr = project3DPointToView(q, P.cal, P.yTop, P.CY);
      if(!viewPointVisible(pr, occ, state.hairMasks && state.hairMasks[P.angle])) continue;   // 가려진 자리의 가닥은 못 집는다
      const dx = P.toCX(pr.ix) - px, dy = P.toCY(pr.iy) - py;
      const d2 = dx*dx + dy*dy;
      if(d2 < bd){ bd = d2; best = q; }
    }
  }
  return best ? { x:best.x, y:best.y, z:best.z, dist:Math.sqrt(bd) } : null;
}
/* 캔버스 이동량 → 월드 변위. 화면 드래그이므로 <b>카메라 상면</b>에 놓는다:
   이미지 x는 모델 x(cal.s), 이미지 y는 모델 y(cal.sy, 부호 반대), 깊이 0.
   그 다음 이 뷰의 실측 포즈로 되돌린다(리프트가 쓰는 것과 같은 R^T). */
function combDeltaToWorld(dxPx, dyPx){
  const P = COMB._proj;
  if(!P) return null;
  const dIx = dxPx / Math.max(1e-6, P.pxScale), dIy = dyPx / Math.max(1e-6, P.pxScale);
  const rot = composeRotationZYX(P.cal.yaw, P.cal.pitch, P.cal.roll);
  const v = applyRotationTranspose3(rot, new THREE.Vector3(dIx * P.cal.s, -dIy * P.cal.sy, 0));
  return { x:v.x, y:v.y, z:v.z };
}
function combRadiusModel(){
  const P = COMB._proj;
  if(!P) return 0;
  return (COMB.radiusPx / Math.max(1e-6, P.pxScale)) * P.cal.s;
}
let _combGroup = 0;
function combStrokeFromDrag(anchor, dxPx, dyPx){
  const d = combDeltaToWorld(dxPx, dyPx), r = combRadiusModel();
  if(!d || !(r > 0)) return null;
  COMB.strokes.push({ p:{x:anchor.x,y:anchor.y,z:anchor.z}, d, r, g:_combGroup });
  if(COMB.strokes.length > COMB.maxStrokes) COMB.strokes.shift();
  combSplat(anchor, d, r);
  return d;
}
/* 빗질(COMB)은 <b>주차</b>다 (2026-08-08). 엔진(변위장·길이보존·되돌리기)은
   검증까지 끝났지만, 사용자가 말한 시술모드는 "빗질할 수 있는 모드"가 아니라
   <b>마네킹 초기화 상태</b>였다. UI를 붙이지 않으므로 COMB.on은 계속 false이고
   빗질 경로는 한 번도 안 탄다(비용 0). 나중에 필요하면 버튼 하나만 다시 달면 된다. */
/* (2026-08-25) 주차 해제 — 조정화면 모드바에 버튼을 달았다. 위 "주차" 주석의
   "나중에 필요하면 버튼 하나만 다시 달면 된다"가 이것이다. 엔진은 안 건드렸다. */
function toggleCombMode(){
  COMB.on = !COMB.on;
  syncCombBtn();
  combRefresh();
}
function syncCombBtn(){
  /* (2026-08-30) 손잡이가 스타일링 패널로 옮겨가면서 값 딱지(gyst-comb)가 하나
     늘었다. 다른 슬라이더가 전부 그 자리에 현재 값을 찍으므로 빗질만 비워 두면
     "지금 켜져 있나"를 패널에서 못 읽는다. */
  const v = document.getElementById('gyst-comb');
  if(v) v.textContent = COMB.on ? 'ON' : 'OFF';
  const b = document.getElementById('combBtn');
  if(!b) return;
  b.classList.toggle('on', COMB.on);
  b.textContent = COMB.on ? '빗질 ON' : '빗질 OFF';
}
/* 마네킹 리셋 — 시술을 <b>깨끗한 바닥</b>에서 시작하기 위한 초기화.
     · 스타일링(넘김·볼륨·결흐름·가르마) 전부 중립
     · 빗질 삭제
     · 손님 머리에 구워져 있는 웨이브를 편다(생머리)
   커트·펌·컬러는 <b>시술 결과</b>라 건드리지 않는다 — 되돌리려면 '초기화'. */
function mannequinReset(){
  // (옛 42) 다시 기르기를 끄고, 조정 화면에서 껐다 켠 거면 마네킹에서 쓰던 값을 되돌림(17b REGROW)
  const _rg = REGROW._beforeMqReset();
  // (옛 41) 마네킹을 다시 켜면 '원본 3D 그대로' 모드는 의미가 없으므로 같이 끔(17b ORIG_ASIS)
  if(typeof ORIG_ASIS !== 'undefined') ORIG_ASIS._onMannequinReset();
  state.stylingByView = neutralStylingByView();
  combClear();
  /* (2026-08-30 2차) 획만 지우고 <b>모드는 안 껐다</b>. "깨끗한 바닥에서 시작한다"는
     이 함수의 뜻에 빗질 모드가 켜진 채로 남는 건 안 맞는다 — 리셋한 다음 화면을
     짚으면 바로 다시 빗어진다. 모드도 같이 되돌린다. */
  COMB.on = false; syncCombBtn();
  MANNEQUIN.on = true;
  state.hair3Dmannequin = null;   // 다시 심는다(길이·밀도 출처가 바뀌었을 수 있다)
  syncMannequinBtn();
  if(typeof buildGyControls === 'function') buildGyControls();
  combRefresh();
  // (옛 42) 패널·태그 정리, 껐을 때 걸려 있던 스타일 다시 걸기
  REGROW._afterMqReset(_rg);
  COMB3D._afterUi('mannequinReset');    // (옛 53) 빗질 버튼 맞춤
}
function syncMannequinBtn(){
  const b = document.getElementById('mannequinBtn');
  if(!b) return;
  b.classList.toggle('on', MANNEQUIN.on);
  b.textContent = MANNEQUIN.on ? '마네킹 초기화 ON' : '마네킹 초기화 OFF';
  /* 마네킹을 끄면 스펙도 더는 "적용 중"이 아니다(손님 원래 머리로 돌아간 것).
     (2026-08-29 2차) 버튼 눌린 표시를 끄던 줄은 버튼이 없어져서 같이 뺐다.
     specAppliedId를 비우는 건 그대로 — 다시 걸 때 토글 해제로 새는 걸 막는다. */
  if(!MANNEQUIN.on){
    state.specAppliedId = null;
    state._specUndo = null;
  }
  if(typeof ORIG_MQ !== 'undefined') ORIG_MQ._btnTail();   // (옛 58) 원본 머리를 보는 중이면 OFF 표시(17b)
  if(typeof STYLE_PATHS !== 'undefined') STYLE_PATHS.btnSync();   // (옛 69) 스타일 길이 든 스타일도 OFF 표시(17b)
}
/* 켜면 마네킹 모델(절차 생성)로, 끄면 촬영 가닥 모델로 돌아간다.
   스타일링은 끌 때 되돌리지 않는다 — 끄는 건 "손님 원래 머리 보기"지
   "리셋"이 아니다. */
/* 스펙 적용 + 화면 갱신. 시술은 마네킹 상태에서 시작하는 게 원칙이라 꺼져 있으면 켠다.
   (2026-08-09) 중립 모델이 아직 없으면 예전엔 console.warn 한 줄 찍고 <b>조용히</b>
   끝났다 — 조정 화면에 막 들어온 순간(리프트는 120ms 뒤에 시작한다)에 누르면
   버튼이 먹지 않은 것처럼 보였고, 그게 "적용이 안 된다"로 읽혔다. 이제 모델을
   만들고 나서 다시 건다(한 번만 재시도한다 — 실패가 반복되면 원인은 다른 데 있다). */
/* ── 스펙은 <b>껐다 켤 수 있어야 한다</b> (2026-08-09) ──────────────────────
   사용자: "레이어드 보브 버튼 적용은 되는데 꺼지질 않아."
   맞다. 누를 때마다 다시 걸기만 했다. 그러면 <b>비교를 못 한다</b> — 스펙이
   뭘 바꿨는지 보려면 끄고 켜 봐야 하는데 그 길이 없었다.

   되돌릴 때 기본값으로 리셋하지 <b>않는다</b>. 미용사가 스펙을 걸기 전에 이미
   손으로 만져 둔 값이 있을 수 있고, 그걸 기본값으로 밀어버리면 "껐다"가 아니라
   "지웠다"가 된다. 걸기 직전 상태를 통째로 찍어 두고 그대로 돌려놓는다.
   (마네킹 ON/OFF는 건드리지 않는다 — 그건 별개 손잡이다.) */
/* (2026-08-29 2차) 여기 잠깐 있던 SPEC_BUTTONS/syncSpecButtons/specBtnEl 삭제 —
   모드바의 스펙 버튼 두 개가 없어졌으니 잡을 대상이 없다. 그 지도가 고쳤던 버그
   (버튼이 늘었는데 세 곳이 specBtn 하나만 잡던 것)는 버튼이 사라지며 함께 소멸.
   지금 "무엇이 걸려 있는가"를 말하는 자리는 미리보기 딱지(adjustStyleTag) 하나다. */
function snapshotForSpec(){
  return {
    sections: JSON.parse(JSON.stringify(state.sections)),
    stylingByView: JSON.parse(JSON.stringify(state.stylingByView || neutralStylingByView())),
    fade: state.fade ? JSON.parse(JSON.stringify(state.fade)) : null,   // (2026-09-16) 해제하면 클리퍼도 걸기 직전으로
  };
}
function clearStyleSpec(){
  const s = state._specUndo;
  state._specUndo = null;
  state.specAppliedId = null;
  // 땋기도 걸기 직전으로 — 스냅샷에 안 들어가는 전역이라 여기서 직접 끈다(2026-09-22)
  if(typeof BRAID !== 'undefined') BRAID.on = false;
  if(s){
    state.sections = s.sections;
    state.stylingByView = s.stylingByView;
    if(s.fade && state.fade) Object.assign(state.fade, s.fade);
  }
  if(typeof buildGyPanel === 'function') buildGyPanel();
  const tag = document.getElementById('adjustStyleTag');
  if(tag) tag.textContent = (state.selectedStyle && state.selectedStyle.name) || '스타일 미선택';
  console.log('[스타일스펙] 해제 — 걸기 직전 값으로 되돌림' + (s ? '' : ' (되돌릴 스냅샷이 없어 현재 값 유지)'));
  combRefresh();
  try{ ADJ_CACHE.bump(); }catch(e){}   // (옛 57) 로드 배수가 풀렸으니 캐시도
  FLOW_SPEC._afterClear();            // (옛 59) 걸린 결 표 잊기
  return null;
}
function applyStyleSpecAndRender(id, _retried){
  // (옛 59) 마네킹 없이 만든 스타일(spec.base === 'regrown')은 마네킹을 켜지 않고 제 머리 위에(17b FLOW_SPEC)
  { const f = FLOW_SPEC._asr(id); if(f.handled) return f.value; }
  // 같은 스펙을 다시 누르면 <b>해제</b>다(토글).
  if(state.specAppliedId === id) return clearStyleSpec();
  if(!MANNEQUIN.on) mannequinReset();
  if(!state.hair3Dneutral){
    if(_retried || typeof buildNeutralHair3D !== 'function'){
      console.warn('[스타일스펙] 3D 모델을 못 만들었다 — 촬영/세그멘테이션부터 확인할 것');
      return null;
    }
    /* (2026-08-29 2차) 진행 표시를 <b>버튼 라벨에서 미리보기 딱지로</b> 옮겼다.
       버튼이 없어졌기 때문이기도 하지만, 이제 이 경로는 미용사가 누르는 게
       아니라 조정 화면에 들어오면 <b>저절로</b> 도는 자리라서 그렇다 —
       아무 표시가 없으면 몇 초 동안 "왜 스타일이 안 걸렸지"로 읽힌다. */
    const tag0 = document.getElementById('adjustStyleTag');
    if(tag0) tag0.textContent = '3D 준비 중…';
    buildNeutralHair3D(()=>{ applyStyleSpecAndRender(id, true); });
    return null;
  }
  /* 스타일 적용은 여러 단계가 순차로 돈다 — 단계마다 다시 그리지 않게 <b>문</b>으로 묶는다
     (10-hair-render-2d.js의 RENDER_GATE 배너). 끝에 한 번만 그린다. */
  const undo = snapshotForSpec();          // 걸기 <b>직전</b> 상태 — 해제하면 여기로 돌아온다
  const rep = (typeof withRenderGate === 'function')
    ? withRenderGate(()=> _applyStyleSpecBody(id, undo), '스타일 적용')
    : _applyStyleSpecBody(id, undo);
  return rep;
}
function _applyStyleSpecBody(id, undo){
  const rep = applyStyleSpec(id);
  if(!rep) return null;
  state._specUndo = undo;
  state.specAppliedId = id;
  if(typeof buildGyPanel === 'function') buildGyPanel();
  else if(typeof buildGyControls === 'function') buildGyControls();
  /* 걸렸다는 걸 화면이 말해 준다 — 값이 들어갔는지 콘솔을 봐야 알던 것을 없앤다. */
  const tag = document.getElementById('adjustStyleTag');
  if(tag) tag.textContent = rep.name || '스타일 스펙 적용';
  combRefresh();
  return rep;
}
function toggleMannequin(){
  const _mqWas = MANNEQUIN.on;   // (옛 64) 끝에서 씀
  // (옛 58) 버튼 = 원본 머리(마네킹 + 잰 스펙) ↔ 맨 마네킹(17b ORIG_MQ). 마네킹이 꺼져 있을 때만 아래 원래 흐름
  const _om = ORIG_MQ._beforeToggle();
  if(_om === 'handled'){ toggleMannequinBareCheck(_mqWas); return; }
  // (옛 42) 마네킹을 끌 때 마네킹에서 쓰던 값을 기억(17b REGROW)
  const _rgWasOn = REGROW._beforeToggleMq();
  if(MANNEQUIN.on){
    MANNEQUIN.on = false;
    syncMannequinBtn();
    combRefresh();
  } else {
    mannequinReset();
  }
  // (옛 42) 마네킹을 껐으면 다시 기른 원본 머리로
  REGROW._afterToggleMq(_rgWasOn);
  COMB3D._afterUi('toggleMannequin');   // (옛 53) 빗질 버튼 맞춤
  if(_om === 'inner') ORIG_MQ._syncBtn();
  toggleMannequinBareCheck(_mqWas);
}
/* (2026-10-10e · 옛 64) 마네킹 ON = 언제나 맨 마네킹(컬 0 · 쫙 편 머리).
   사용자: "뽀글이라도 마네킨 모드를 켰을 때는 완전히 쫙 펴져야지."
   원인: 원본 머리를 "마네킹+스펙"으로 못 올리고 다시 기른 가닥으로 보여 주던 손님(곱슬 여자분 등)은 마네킹을 켤 때
   58번의 초기화(bare)를 안 타고 17·42번 길로만 켜져서, 42번이 넣어 둔 잰 컬이 섹션에 그대로 남음 → 마네킹에 웨이브. */
function toggleMannequinBareCheck(was){
  try{
    if(!was && MANNEQUIN.on && typeof ORIG_MQ !== 'undefined' && typeof ORIG_MQ.bare === 'function'){
      let left = 0; try{ Object.keys(state.sections || {}).forEach(k => { if((state.sections[k].curl || 0) > 0) left++; }); }catch(e){}
      if(left || state._globalCurl){ ORIG_MQ.bare(); console.log('[64] 마네킹 켬 — 남아 있던 컬 지움(섹션 ' + left + '곳) → 맨 마네킹'); }
    }
  }catch(e){ console.warn('[64] 맨 마네킹 맞추기 실패', e); }
}

// (11차) 중립 3D 모델에 섹션별 조정 연산자(길이·컬)를 적용해 "조정된 월드 가닥"을
// 반환. 미니뷰(3D)와 조정창 투영(2D)이 같은 소스를 쓰게 하는 단일 출처.
// srcAngleFilter를 주면 그 뷰 캡처 가닥만(뷰별 투영 시 교차뷰 잡음 방지).
/* stride: 조정 연산을 적용할 가닥 간격(1=전부). 조정 화면은 어차피 일부만
   그리는데 전 가닥에 길이·컬·중력·가르마·넘김·볼륨·결흐름을 다 돌리면
   그 계산이 렌더 비용의 대부분이 된다(실측: 밀도 2배 → 시간 2배, 그린 다발
   수는 그대로였음). 그릴 것만 계산하도록 호출부가 간격을 넘긴다. */

/* ══ 정수리 숱 채움 · 숱 손잡이 (2026-10-01 · 옛 31-hippie-wave-eyeguard.js) ══
   ⚠ crownFill은 마네킹 뿌리 고르게(mannequinEvenRoots) 뒤에 붙는 단계인데, 이 판(360shot 9/22e 기준)에는 그 함수가 없어
     실제로는 안 돈다(예전 파일도 "mannequinEvenRoots 없음 — 건너뜀"을 찍고 넘어갔다). 9/30 haircut-helper의
     mannequinEvenRoots를 다시 들이면 그 끝에서 crownFill(h)을 부르면 된다. setCrownFill·setHairDensity는 콘솔 손잡이. */
// ── 정수리 숱 채움: CROWN_FILL ──
// ROOT_EVEN은 "셀 면적 × 옆·뒤 중앙값 × boost(×frontBoost)"를 목표로 셀을 채웁니다.
//   · 정수리 셀은 극각 격자라 면적이 아주 작아(로그: 정수리 셀 1/20) 배수를 올려도 목표 자체가 작고,
//   · frontBoost는 방위 56° 안(앞쪽)만 봅니다 — 정수리 한가운데는 앞/옆/뒤 셀이 뒤섞인 자리,
//   · 이미 목표를 채운 셀은 건너뜁니다(frontMinFill).
//   · 그리고 이 값들은 마네킹을 다시 만들 때만 반영됩니다(콘솔에서 값만 바꾸면 그대로).
// 여기서는 두피 타원면의 "실제 면적"으로 밀도를 다시 재서, 정수리 칸이 옆·뒤 기준 밀도 × mul보다
// 성기면 가장 가까운 가닥을 복제해 채웁니다.
var CROWN_FILL = {
  on: true,
  mul: 1.0,        // 정수리 목표 밀도 = 옆·뒤 기준 × mul  (setCrownFill(1.5) 로 올림)
  phiMax: 0.75,    // 정수리로 볼 범위(극각, rad)
  NP: 24, NT: 32,  // 면적 재는 격자
  maxAddFrac: 0.6, // 전체 가닥 대비 추가 상한
  maxSrcDist: 2.5  // 복제 원본이 칸 크기의 몇 배 이내여야 하나(멀면 대머리 자리로 보고 안 채움)
};

function crownFill(h) {
  if (!CROWN_FILL.on || !h || !h.strands || !h.strands.length) return h;
  var S = null;
  try { S = getScalpEllipsoid(); } catch (e) {}
  if (!S) return h;
  var CY = isFinite(h.CY) ? h.CY : (typeof SCALP_CENTER_Y !== 'undefined' ? SCALP_CENTER_Y : 0.15);
  var NP = CROWN_FILL.NP, NT = CROWN_FILL.NT, dP = Math.PI / NP, dT = 2 * Math.PI / NT;
  function pos(ph, th) {
    return { x: S.a * Math.sin(ph) * Math.sin(th), y: CY + S.b * Math.cos(ph), z: S.c * Math.sin(ph) * Math.cos(th) };
  }
  function area(ip, it) { // 칸 중심에서 |r_phi × r_theta| dphi dtheta
    var ph = (ip + 0.5) * dP, th = (it + 0.5) * dT - Math.PI, e = 1e-4;
    var p0 = pos(ph, th), p1 = pos(ph + e, th), p2 = pos(ph, th + e);
    var ax = p1.x - p0.x, ay = p1.y - p0.y, az = p1.z - p0.z, bx = p2.x - p0.x, by = p2.y - p0.y, bz = p2.z - p0.z;
    var cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
    return Math.sqrt(cx * cx + cy * cy + cz * cz) / (e * e) * dP * dT;
  }
  function cellOf(p) {
    var ph = Math.acos(Math.max(-1, Math.min(1, (p.y - CY) / S.b)));
    var th = Math.atan2(p.x / S.a, p.z / S.c);
    var ip = Math.min(NP - 1, Math.floor(ph / dP)), it = Math.min(NT - 1, Math.floor((th + Math.PI) / dT));
    return ip * NT + it;
  }
  var bins = new Array(NP * NT);
  for (var i = 0; i < h.strands.length; i++) {
    var st0 = h.strands[i];
    if (!st0 || !st0.pts || !st0.pts.length) continue;
    var c = cellOf(st0.pts[0]);
    (bins[c] || (bins[c] = [])).push(st0);
  }
  // 기준: 극각 0.9~1.6(옆·뒤 중간 높이), 가닥 있는 칸의 면적당 밀도 중앙값
  var ref = [];
  for (var ip = 0; ip < NP; ip++) {
    var phc = (ip + 0.5) * dP;
    if (phc < 0.9 || phc > 1.6) continue;
    for (var it = 0; it < NT; it++) {
      var b = bins[ip * NT + it];
      if (b && b.length >= 3) ref.push(b.length / area(ip, it));
    }
  }
  if (ref.length < 8) return h;
  ref.sort(function (a, b) { return a - b; });
  var refD = ref[ref.length >> 1] * CROWN_FILL.mul;
  var cap = Math.round(h.strands.length * CROWN_FILL.maxAddFrac);
  var added = 0, cells = 0, skipped = 0, seed = 97531;
  function rnd() { seed = seed * 1103515245 + 12345 & 2147483647; return seed / 2147483647; }
  for (ip = 0; ip < NP && added < cap; ip++) {
    if ((ip + 0.5) * dP > CROWN_FILL.phiMax) break;
    for (it = 0; it < NT && added < cap; it++) {
      var A = area(ip, it), have = (bins[ip * NT + it] || []).length, want = Math.round(refD * A);
      if (have >= want) continue;
      // 복제 원본 후보: 이 칸 + 이웃 칸
      var pool = [];
      for (var dp = -1; dp <= 1; dp++) for (var dt = -1; dt <= 1; dt++) {
        var jp = ip + dp; if (jp < 0 || jp >= NP) continue;
        var bb = bins[jp * NT + ((it + dt) % NT + NT) % NT];
        if (bb) pool = pool.concat(bb);
      }
      if (!pool.length) { skipped++; continue; }
      var cellSize = Math.sqrt(A);
      cells++;
      for (var k = have; k < want && added < cap; k++) {
        var q = pos((ip + rnd()) * dP, (it + rnd()) * dT - Math.PI);
        var best = null, bd = Infinity;
        for (var m = 0; m < pool.length; m++) {
          var r = pool[m].pts[0], d = (r.x - q.x) * (r.x - q.x) + (r.y - q.y) * (r.y - q.y) + (r.z - q.z) * (r.z - q.z);
          if (d < bd) { bd = d; best = pool[m]; }
        }
        if (!best || Math.sqrt(bd) > CROWN_FILL.maxSrcDist * cellSize + 1e-6) { skipped++; break; }
        var r0 = best.pts[0], ox = q.x - r0.x, oy = q.y - r0.y, oz = q.z - r0.z;
        var nw = Object.assign({}, best, {
          pts: best.pts.map(function (p) { return { x: p.x + ox, y: p.y + oy, z: p.z + oz }; }),
          _crownAdded: true
        });
        if (best.colors && best.colors.slice) nw.colors = best.colors.slice();
        h.strands.push(nw);
        added++;
      }
    }
  }
  console.log('[앞머리 길이] [정수리 채움] 기준 밀도(옆·뒤 중앙) ×' + CROWN_FILL.mul + ' · 모자란 칸 ' + cells +
    '개에 ' + added + '가닥 추가' + (skipped ? ' · 원본이 멀어 건너뛴 칸 ' + skipped : '') +
    ' · 끄기 CROWN_FILL.on=false');
  return h;
}

function setCrownFill(k) {
  CROWN_FILL.mul = Math.max(0.5, Math.min(3, +k || 1));
  if (typeof state !== 'undefined' && state) state.hair3Dmannequin = null;
  try { if (typeof ADJ_CACHE !== 'undefined') ADJ_CACHE.bump(); } catch (e) {}
  try { if (typeof combRefresh === 'function') combRefresh(); } catch (e) {}
  return CROWN_FILL.mul;
}

// ── 숱 손잡이: setHairDensity(1.5) ──
// 3D 뿌리 수(ROOT_EVEN.boost·maxAddFrac)와 2D 화면에 그리는 가닥 상한(HAIR3D_RENDER.targetMul)을
// 같이 올립니다. 2D 정면 화면은 "원본 결 보기 가닥 수 × targetMul"에서 잘리므로
// 뿌리만 늘리면 3D에서만 빽빽해지고 2D에서는 솎기만 늘어납니다.
var _hairDensityBase = null;
function setHairDensity(k) {
  k = Math.max(0.5, Math.min(3, +k || 1));
  var re = window.ROOT_EVEN;
  var hr = typeof HAIR3D_RENDER !== 'undefined' ? HAIR3D_RENDER : null;
  if (!_hairDensityBase) _hairDensityBase = {
    boost: re ? re.boost : 1.2, maxAdd: re ? re.maxAddFrac : 1.2, mul: hr ? hr.targetMul : 1.5
  };
  if (re) { re.boost = _hairDensityBase.boost * k; re.maxAddFrac = _hairDensityBase.maxAdd * k; }
  if (hr) hr.targetMul = _hairDensityBase.mul * k;
  if (typeof state !== 'undefined' && state) state.hair3Dmannequin = null;             // 뿌리 다시 심기
  try { if (typeof ADJ_CACHE !== 'undefined') ADJ_CACHE.bump(); } catch (e) {}
  EYE_GUARD._geo = null;
  try { if (typeof combRefresh === 'function') combRefresh(); } catch (e) {}
  console.log('[앞머리 길이] 숱 ×' + k + ' — ROOT_EVEN.boost ' + (re && re.boost.toFixed(2)) +
    ' · maxAddFrac ' + (re && re.maxAddFrac.toFixed(2)) + ' · HAIR3D_RENDER.targetMul ' +
    (hr && hr.targetMul.toFixed(2)) + ' (되돌리기 setHairDensity(1))');
  return k;
}

console.log('[앞머리 길이] 설치 — 앞머리 기본 끝 ' + EYE_GUARD.defaultTipFaceFrac + ' · 가닥 자르기 없음(얼굴 가림은 FACE_COVER_CHECK가 검사만 함)');
