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
  return CY - MQ_FRINGE.tipFaceFrac * faceH;
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
  const target = src.strands.length;
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
function combStrand3D(pts){
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
  };
}
function clearStyleSpec(){
  const s = state._specUndo;
  state._specUndo = null;
  state.specAppliedId = null;
  if(s){
    state.sections = s.sections;
    state.stylingByView = s.stylingByView;
  }
  if(typeof buildGyPanel === 'function') buildGyPanel();
  const tag = document.getElementById('adjustStyleTag');
  if(tag) tag.textContent = (state.selectedStyle && state.selectedStyle.name) || '스타일 미선택';
  console.log('[스타일스펙] 해제 — 걸기 직전 값으로 되돌림' + (s ? '' : ' (되돌릴 스냅샷이 없어 현재 값 유지)'));
  combRefresh();
  return null;
}
function applyStyleSpecAndRender(id, _retried){
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
  const undo = snapshotForSpec();          // 걸기 <b>직전</b> 상태 — 해제하면 여기로 돌아온다
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
  if(MANNEQUIN.on){
    MANNEQUIN.on = false;
    syncMannequinBtn();
    combRefresh();
  } else {
    mannequinReset();
  }
}

// (11차) 중립 3D 모델에 섹션별 조정 연산자(길이·컬)를 적용해 "조정된 월드 가닥"을
// 반환. 미니뷰(3D)와 조정창 투영(2D)이 같은 소스를 쓰게 하는 단일 출처.
// srcAngleFilter를 주면 그 뷰 캡처 가닥만(뷰별 투영 시 교차뷰 잡음 방지).
/* stride: 조정 연산을 적용할 가닥 간격(1=전부). 조정 화면은 어차피 일부만
   그리는데 전 가닥에 길이·컬·중력·가르마·넘김·볼륨·결흐름을 다 돌리면
   그 계산이 렌더 비용의 대부분이 된다(실측: 밀도 2배 → 시간 2배, 그린 다발
   수는 그대로였음). 그릴 것만 계산하도록 호출부가 간격을 넘긴다. */
