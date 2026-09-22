/* ══════════════════════════════════════════════════════════════════════════
   땋기 — 가닥 하나를 <b>밧줄</b>로 긋는다 (2026-09-13 사용자 지시)
   ─────────────────────────────────────────────────────────────────────────
   사용자: "머리를 땋는 게 가능하냐고 묻는거지 난" · "우리는 시술을 하는 거라서,
   붙이는 건 익스텐션이라는 별도의 시술이 들어가야 하고. 땋는건 손님 머리 길이 기준"

   ── 그래서 이 파일이 <b>안 하는</b> 것 ────────────────────────────────────
   길이를 안 건드린다. 땋기는 자르는 것도 붙이는 것도 아니라서, 커트 엔진
   (08-cut-engine.js의 lengthRatioFor·cutLayerDeltaFor)에 손을 대지 않는다.
   손님 머리 길이 그대로 땋는다 — 익스텐션은 별개 시술이므로 여기 범위 밖이다.
   ⚠ 그래서 참고 이미지처럼 허리까지 오는 길이는 <b>이 파일로 안 나온다</b>.
     그건 붙인 것이고, 붙이는 것은 아직 이 앱에 없는 시술이다.

   ── 이 파일이 하는 것: <b>긋는 법</b> 하나 ────────────────────────────────
   기존 렌더는 가닥을 곡선 하나에 균일한 두께로 긋는다(traceSmoothPolyline).
   땋은 머리는 그 자리에 여러 갈래가 서로 감긴 모양이 들어가야 한다. 축을 따라
   호길이 s를 쌓으면서, 갈래 k를 법선 방향으로
       offset = (굵기/2) × 세기 × sin(2π·s/마디 + 2πk/갈래수)
   만큼 밀어 긋는다. 갈래끼리 위상이 어긋나 있으므로 서로 교차하고, 그 교차가
   곧 땋은 무늬다. 축 계산·법선은 offsetPolyline(08)이 이미 쓰는 것과 같은 식이다.

   ⚠ 지금은 <b>앞뒤 가림이 없다</b>. 진짜 땋은 머리는 교차점에서 한 갈래가 다른
     갈래를 가린다. 그걸 하려면 갈래를 depth(=cos 위상) 부호로 쪼개 뒤→앞 순서로
     따로 그어야 하는데, 15-project-3d.js의 그리기가 색·굵기별로 <b>묶어서</b>
     한 번에 stroke하는 구조라(배치) 쪼개면 그 묶음이 깨진다. 두 갈래 꼬기는
     가림이 없어도 밧줄로 보이므로 먼저 이대로 내고, 부족하면 그때 배치를 건드린다.
     되돌리기/끄기: BRAID.on = false
   ══════════════════════════════════════════════════════════════════════════ */
const BRAID = {
  on: false,            // 스타일이 켠다(applyStyleSpec). 기본은 꺼짐 — 기존 렌더 불변

  /* ── 치수: <b>cm로 적는다</b> ──────────────────────────────────────────
     이 저장소가 tipAt을 버리고 lenCm으로 간 것과 같은 이유다(12b "길이를 cm로"
     배너). 마디와 굵기는 시술자가 정하는 절대 치수라 손님 두상으로 역산할 게
     없다 — 자만 있으면 그대로 화면 px가 된다.

     ⚠ 아래 두 값의 출처: 사용자가 제미나이로 만든 <b>목표 이미지</b>를 재서 나왔다.
       실제 시술 치수가 아니라 "그 그림이 그렇게 그려졌다"는 뜻이다. 폼파두르
       lenCm을 "초안이지 실측이 아니다"라고 적어 둔 것과 같은 자격이다.
       재는 법: 눈→턱 11.5cm(FACE_RULER_CM.eyeToChin)로 자를 만들고(14.6px/cm),
         굵기 — 이웃한 가닥의 밝은 능선 사이 거리. 중앙값 20.0px = 1.37cm.
                기울어진 가닥을 가로로 잘라 약 6% 과대평가되므로 <b>1.3cm</b>로 적는다.
         마디 — 가닥을 따라가며 나타나는 마디 사이 거리. 기울기 −10°에서 가장
                규칙적이었고 13.0px = <b>0.89cm</b>.
     ⚠ 처음엔 자기상관으로 쟀는데 가로·세로 둘 다 정확히 8px이 나왔다 —
       땋은 마디가 아니라 <b>JPEG 8×8 블록</b>을 문 것이었다. 블러로 그걸 죽였더니
       이번엔 탐색 하한에 붙었다(뚜렷한 주기 봉우리가 없어 argmax가 경계를 집음).
       그래서 자기상관을 버리고 능선 사이 거리를 직접 세는 쪽으로 바꿨다.
       <b>주기를 자동으로 찾는 방법은 이 이미지에서 두 번 다 실패했다</b> —
       다음에 다시 잴 일이 있으면 능선 쪽부터 시작할 것. */
  /* ⚠ 아래 기본값은 <b>실제 레게 파마 사진 3장</b>에서 잰 값이다(2026-09-13 2차).
       1차는 제미나이가 만든 그림에서 쟀고 <b>세 가지가 틀렸다</b> — 갈래 수(2→3),
       굵기(1.3→0.85cm), 마디(0.89→0.70cm). 생성 이미지가 레게 파마를
       <b>두 갈래 꼬기로 그려 놨던 것</b>이고, 나는 그걸 실물인 양 쟀다.
       실측 절차와 표본 수는 STYLE_SPECS.reggae_twist.braid 배너에 적어 뒀다.
     ⚠ 자가 <b>거칠다</b>. 정수리 뷰라 눈→턱(FACE_RULER_CM)을 못 쓰고 머리
       가로폭 15.0cm(성인 두개폭 평균)를 썼는데, 개인차 ±1cm에 원근까지 얹힌다.
       소수 둘째 자리까지 믿지 말 것.
     ⚠ <b>중심 간격은 굵기가 아니다</b>. 두피가 보이는 스타일에서는
       중심간격 = 가닥 + 두피틈이다(②에서 0.85 + 0.75 = 파팅 칸 1.60cm).
       1차에서 이걸 안 나눠서 굵기를 부풀렸다. */
  widthCm: 0.85,        // 가닥(밧줄) 굵기 — ② 박스 브레이드 실측(17.0px/20.0px·cm, 표본 440)
  nodeCm:  0.70,        // 한 마디 = 갈래가 한 바퀴 도는 길이 — ② 실측 중앙값

  /* 갈래 수. 실제 사진 ②③은 전부 <b>세 갈래 땋기</b>다(확대하면 갈매기 교차가
     뚜렷하다). 두 갈래 꼬기(트위스트)로 바꾸려면 2로 두면 된다 — 위상이
     자동으로 벌어진다. */
  strands: 3,

  /* 땋는 세기 0~1 — 갈래가 축에서 얼마나 벌어지나. 1이면 굵기의 절반까지 벌어져
     갈래가 밧줄 바깥선에 닿는다. 바짝 땋을수록 작다. 0.78은 <b>초안</b>이다
     (이미지에서 못 잰 값 — 갈래 경계가 뭉개져 있어 능선으로 안 잡힌다). */
  tightness: 0.78,

  /* 뿌리에서 이만큼(가닥 길이 대비) 내려온 뒤부터 땋는다. 0이면 두피에서 바로.
     두피에 붙여 땋는 것(콘로우)이 아니라 늘어뜨려 땋는 것이므로 0보다 크다. */
  startAtFrac: 0.06,

  /* 화면에 그릴 밧줄 개수. 땋으면 가닥이 <b>묶이므로</b> 수가 확 준다 —
     이 값을 안 낮추면 잔가닥 수천 개가 각자 밧줄이 돼서 뭉개진다.
     ⚠ 60은 <b>초안</b>이다. 두상 넓이 ÷ 굵기²로 계산해 봤더니 350쯤 나왔는데,
       실제 박스 브레이드는 60~120이다 — 파팅 칸이 밧줄 굵기보다 크기 때문이다.
       계산이 실물과 안 맞으므로 계산을 안 쓴다. 실기기에서 보고 고칠 자리다
       (layered_bob_hush의 tipAt이 두 번 고쳐진 것과 같은 절차). */
  count: 60,

  /* ── 파팅 격자 (2026-09-22 3차) ─────────────────────────────────────────
     사용자: "세갈래로 그냥 하고, 파팅 격자 추가해." · "어차피 머리카락은 뿌리가
     여기저기 있으니, 저 모양 따라할 수 있겠지?"
     실기기 로그: 3D 밧줄 63개(count 60) — 두피가 군데군데 통째로 비었다. 원인 둘:
       ① count 60은 위 ⚠대로 <b>초안</b>이었고 실물보다 적다.
       ② 밧줄을 <b>난수</b>로 골랐다 — 어떤 자리엔 몰리고 어떤 자리엔 하나도 없다.
     실제 박스 브레이드는 두피를 <b>칸(파팅)</b>으로 나누고 칸마다 한 가닥씩 땋는다.
     그래서 개수를 정하지 않고 <b>칸 크기</b>를 정한다. 칸이 곧 개수다.
     partCm 1.60 — 지어낸 값이 아니다. 위 BRAID 배너 ②의 실측
       <b>중심간격 = 가닥 0.85 + 두피틈 0.75 = 1.60cm</b> 그대로다(같은 사진, 같은 자).
     칸은 두상 타원체 위 극각 줄 × 줄마다 둘레에 맞춘 개수, 줄마다 반 칸 엇갈림
     (벽돌 쌓기 — 박스 브레이드의 흔한 파팅). 칸마다 <b>칸 가운데에 제일 가까운 뿌리</b>
     하나를 밧줄로 쓴다. 뿌리가 없는 칸(두피 밖·대머리 판정 칸)은 비운다.
     grid=false면 예전(count·난수)으로 돌아간다. */
  grid: true,
  partCm: 1.60,

  /* 모아 빗기(2026-09-22 5차) — 칸 안의 나머지 가닥을 두피 위로 밧줄 시작점까지 긋는다.
     gather=false면 3차처럼 밧줄만(칸 안이 두피로 비어 보인다).
     gatherLift — 두피에서 띄우는 높이(cm). 빗어 붙인 머리는 두피에 눕지만 0이면 두피면과
       깊이가 겹쳐 깜빡인다. 0.12는 초안(모발 몇 가닥 두께). */
  gather: true,
  gatherLift: 0.12,

  /* (2026-09-22) 두피 밑칠 — 가닥 <b>뿌리 쪽 이 비율</b>만 두피색으로 깐다.
     땋으면 가닥이 묶여서 밧줄 사이로 <b>두피(파팅)</b>가 보인다. 밑칠을 안 하면
     그 틈으로 머리를 지운 채움 배경이 비친다. 끝까지 깔면 어깨 위에 두피색
     띠가 생기므로 뿌리 쪽만. 0.3은 <b>초안</b>이다(두상 위에 누운 구간 ≈ 가닥의
     앞 30%로 봤다 — 긴 머리일수록 이 비율은 작아져야 맞다). 끄기: 0 */
  scalpFrac: 0.3,

  /* 밧줄 몸통 — 갈래 셋 밑에 밧줄 굵기로 한 번 깐다. 갈래 사이 골이 배경이 아니라
     <b>어두운 머리색</b>으로 보여야 땋은 무늬가 산다. 곱은 가닥색에 곱하는 밝기. */
  bodyDark: 0.55,

  log: true,
};

/* 스펙이 BRAID 값을 덮어쓴 뒤 <b>다른 스타일</b>로 가면 그 값이 남는다(다음 땋기
   스타일이 앞 스타일의 굵기를 물려받는다). 그래서 기본값을 한 벌 떠 두고,
   applyStyleSpec이 매번 여기서부터 다시 건다. */
const BRAID_DEFAULTS = Object.assign({}, BRAID);

/* ══ 자 (2026-09-22 교체) — <b>3D 모델의 자</b>를 쓴다 ═════════════════════
   처음 판은 이 뷰의 눈→턱을 쟀다(braidPxPerCm, 아래에 남겨 둠). 붙여 보니
   <b>후면 뷰에 얼굴이 없다</b> — 랜드마크가 없어서 자가 null이 되고, 땋은 머리를
   제일 잘 보여 주는 뷰에서만 밧줄이 안 나온다. 추정 랜드마크(getEstimatedLandmarks)로
   때우면 굵기가 뜻을 잃는다(이 파일의 원칙: 적당한 값으로 때우지 않는다).
   그래서 자를 <b>뷰가 아니라 모델</b>에서 가져온다:
     cm/단위  = faceRulerCmPerUnit(getFaceMetrics()).y — 12a가 두상·목을 짓는 그 자.
                정면 눈→턱(FACE_RULER_CM.eyeToChin)에서 나오므로 <b>같은 자</b>다.
     px/단위  = 이 뷰의 세로 보정 1/cal.sy를 화면 변환(toCY)에 통과시킨 것.
                project3DPointToView의 iy = crownY + (yTop − my)/cal.sy 그대로다.
   두 개를 나누면 px/cm. 네 뷰가 한 모델을 공유하므로 <b>후면도 같은 굵기</b>가 된다.
   ⚠ 세로로 잰 이유: 가로(cal.s)는 yaw에 따라 줄어든다(측면 압축). 세로는 안 준다.
   ⚠ 자를 못 만들면 여전히 null — 호출부는 평소 렌더로 간다. */
function braidPxPerCm3D(cal, toCY){
  try{
    if(!cal || !(cal.sy > 0) || typeof toCY !== 'function') return null;
    const pxPerUnit = Math.abs(toCY(1 / cal.sy) - toCY(0));
    let cmPerUnit = null;
    if(typeof faceRulerCmPerUnit === 'function' && typeof getFaceMetrics === 'function'){
      const r = faceRulerCmPerUnit(getFaceMetrics());
      if(r && r.y > 0) cmPerUnit = r.y;
    }
    if(!(pxPerUnit > 0) || !(cmPerUnit > 0)) return null;
    return pxPerUnit / cmPerUnit;
  }catch(e){ return null; }
}

/* (옛 판) 이 뷰의 눈→턱으로 재는 자. 후면에서 null이라 본선에서 뺐다.
   정면에서 두 자가 같은 값을 내는지 대조할 때 쓴다 — 콘솔:
     braidPxPerCm('front', maskH, toCY) vs braidPxPerCm3D(cal, toCY) */
function braidPxPerCm(angle, maskH, toCY){
  try{
    const lm = state.landmarks && state.landmarks[angle];
    if(!lm || typeof lm.eyeY !== 'number' || typeof lm.chinY !== 'number') return null;
    const f = (typeof toCY === 'function') ? toCY : (v)=>v;
    const spanPx = Math.abs(f(lm.chinY * maskH) - f(lm.eyeY * maskH));
    if(!(spanPx > 1)) return null;
    return spanPx / FACE_RULER_CM.eyeToChin;
  }catch(e){ return null; }
}

/* 이 뷰에서 쓸 밧줄 치수(px). 자를 못 만들면 null — 호출부는 평소 렌더로 간다.
   ⚠ px/cm를 못 구했을 때 <b>적당한 값으로 때우지 않는다</b>. 자 없이 그린
     밧줄은 굵기가 뜻이 없고, 화면엔 그럴싸하게 나와서 틀린 걸 모른다.
   (2026-09-22) 인자를 자(pxPerCm) 하나로 바꿨다 — 자를 어디서 재는지는 호출부 몫. */
function braidGeometry(pxPerCm){
  if(!BRAID.on) return null;
  if(!(pxPerCm > 0)) return null;
  const widthPx = BRAID.widthCm * pxPerCm;
  const nodePx  = BRAID.nodeCm  * pxPerCm;
  if(!(widthPx > 1) || !(nodePx > 1)) return null;
  const nStr  = Math.max(2, Math.min(5, BRAID.strands|0));
  const tight = Math.max(0, Math.min(1, BRAID.tightness));
  // 갈래 하나의 선 굵기. 갈래끼리 살짝 겹쳐야 밧줄이 통짜로 보인다(1.15).
  const subWidth = Math.max(0.9, widthPx / nStr * 1.15);
  /* ── 진폭은 <b>남는 폭</b>에서 나온다 (첫 판 수정) ─────────────────────
     바깥폭 = 2×amp + subWidth 이므로 남는 폭을 세기로 나눠 갖는다.
     이러면 세기가 1이어도 밧줄은 절대 widthCm을 안 넘는다. */
  const amp = Math.max(0, (widthPx - subWidth) / 2) * tight;
  return { widthPx, nodePx, pxPerCm, strands: nStr, tightness: tight, subWidth, amp };
}

/* 가닥 전체(cpts)의 누적 호길이. 마디 위상의 기준이므로 <b>화면 거리</b>로 쌓는다
   (점 개수로 쌓으면 점이 촘촘한 구간에서 마디가 잘아진다). */
function braidArcLengths(pts){
  const n = pts.length, s = new Array(n); s[0] = 0;
  for(let i=1;i<n;i++) s[i] = s[i-1] + Math.hypot(pts[i].x-pts[i-1].x, pts[i].y-pts[i-1].y);
  return s;
}

/* 밧줄 하나를 ctx의 <b>현재 path에</b> 얹는다. traceSmoothPolyline과 같은 자리에
   끼우는 것이므로 beginPath/stroke는 호출부가 한다.
   (2026-09-22) i0·i1·sAll을 받는다 — 가닥이 얼굴 게이트 등으로 <b>구간(runs)</b>으로
   끊겨 그려지는데, 구간마다 호길이를 0부터 다시 세면 끊긴 자리마다 마디 위상이 튀고
   뿌리 쪽 "안 땋는 구간"이 가닥 중간에 또 생긴다. 호길이는 <b>가닥 전체</b>로 세고,
   그리는 것만 구간으로 한다. */
function traceBraidPolyline(ctx, pts, geo, i0, i1, sAll){
  if(!pts || pts.length < 2 || !geo) return;
  const n = pts.length;
  const a0 = (i0 == null) ? 0 : Math.max(0, i0|0);
  const a1 = (i1 == null) ? n-1 : Math.min(n-1, i1|0);
  if(a1 - a0 < 1) return;
  const s = sAll || braidArcLengths(pts);
  const total = s[n-1] || 1;
  const skip = total * BRAID.startAtFrac;     // 뿌리 쪽 이 구간은 안 땋는다
  const amp = geo.amp;
  const k2pi = Math.PI * 2 / geo.nodePx;

  for(let k=0; k<geo.strands; k++){
    const phase = Math.PI * 2 * k / geo.strands;
    const out = [];
    for(let i=a0;i<=a1;i++){
      const a = pts[Math.max(0,i-1)], b = pts[Math.min(n-1,i+1)];
      const tx = b.x-a.x, ty = b.y-a.y, L = Math.hypot(tx,ty) || 1;
      // 뿌리 쪽은 갈래가 아직 안 벌어졌다가 서서히 벌어진다(두피에서 튀어나오지 않게)
      const grow = s[i] <= skip ? 0 : Math.min(1, (s[i]-skip) / Math.max(1, geo.nodePx));
      const off = amp * grow * Math.sin(s[i]*k2pi + phase);
      out.push({ x: pts[i].x + (-ty/L)*off, y: pts[i].y + (tx/L)*off });
    }
    traceSmoothPolyline(ctx, out);
  }
}

/* ══ 3D 투영 렌더에 끼우는 자리 (2026-09-22) ═══════════════════════════════
   15-project-3d.js의 projectHair3DToView가 가닥을 다 투영·정렬한 뒤 부른다.
   true를 돌려주면 <b>평소 그리기(밑칠·배치)를 건너뛴다</b> — 땋은 머리는 잔가닥이
   밧줄로 묶인 것이라, 잔가닥을 그 위에 또 그리면 밧줄이 묻힌다.
   false면(꺼짐·자 없음·가닥 없음) 아무것도 안 그렸으니 평소대로 간다.

   ── 밧줄을 <b>몇 개</b> 긋나 ──────────────────────────────────────────
   BRAID.count는 <b>두상 전체</b> 개수다. 한 뷰에는 그중 보이는 것만 나와야 하므로
     이 뷰 개수 = count × (이 뷰에 보이는 가닥 ÷ 계산한 가닥)
   으로 줄인다. 고르는 것은 가닥 고유 난수 hb(15가 가닥 인덱스로 뽑는 결정적 값) —
   슬라이더를 흔들어도 같은 가닥이 계속 밧줄이 된다(반짝이지 않는다).
   ⚠ hb는 공간적으로 고르지 않다(뭉치는 자리가 생긴다). 파팅 칸처럼 격자로 고르려면
     뿌리 위치로 칸을 나눠 칸마다 하나씩 뽑아야 한다 — 실기기에서 뭉쳐 보이면 그때.

   ── 순서 ─────────────────────────────────────────────────────────────
   projected는 이미 뒤→앞(+크라운 맨 위)으로 정렬돼 있다. 밧줄을 <b>그 순서대로
   하나씩</b> 긋는다 — 60개 × 갈래 3 = 180 stroke라 배치 없이도 싸고, 밧줄끼리의
   앞뒤 가림이 맞는다. 밧줄 <b>안</b>의 갈래끼리 가림은 여전히 없다(파일 머리 ⚠). */
function braidDrawProjected(ctx, projected, info){
  if(!BRAID.on || !projected || !projected.length || !info) return false;
  const pxPerCm = braidPxPerCm3D(info.cal, info.toCY);
  const geo = braidGeometry(pxPerCm);
  if(!geo){
    if(BRAID.log && !_braidLogged){
      _braidLogged = true;
      console.warn('[땋기] 자를 못 만들어 평소 렌더로 그립니다 — cal.sy·faceRulerCmPerUnit 확인');
    }
    return false;
  }
  const calcN = Math.max(1, info.calcN || projected.length);
  /* 파팅 격자 — 3D와 같은 braidPickGrid. 15가 넘기는 p.r3(뿌리 3D 좌표)로 칸을 정한다.
     고르는 후보가 "이 뷰에 보이는 가닥"뿐이라 3D와 칸은 같고 칸 안의 가닥은 다를 수
     있다(2D는 솎은 가닥이라). 가르마 자리는 같다. */
  let ropes = null, how = 'hash', grp2 = null;
  if(BRAID.grid && projected.some(p => p.r3)){
    grp2 = braidGroupGrid(projected.map(p => p.r3), undefined, projected.map(p => p.r3n));
    const ix = grp2 && grp2.ropes;
    if(ix && ix.length){ ropes = ix.map(i => projected[i]).filter(p => p.cpts && p.cpts.length > 2); how = 'grid'; }
  }
  if(how !== 'grid'){
    const want = Math.max(1, Math.round(BRAID.count * projected.length / calcN));
    const keepFrac = Math.min(1, want / projected.length);
    ropes = projected.filter(p => p.hb < keepFrac && p.cpts && p.cpts.length > 2);
  }
  /* 뒤→앞 순서 유지 — projected가 이미 정렬돼 있으므로 그 순서로 되돌린다
     (격자는 Map 순서라 섞인다). */
  const order = new Map(projected.map((p,i)=>[p,i]));
  ropes.sort((a,b)=> order.get(a) - order.get(b));

  const tintOf = (typeof info.tint === 'function') ? info.tint : (()=>1);
  const colOf = (p)=> (p.colors && p.colors.length) ? p.colors[Math.floor(p.colors.length / 2)] : (p.color || '#1a1a1a');

  // ① 두피 밑칠 — <b>모든</b> 보이는 가닥의 뿌리 쪽만(파팅이 두피로 보이게)
  if(BRAID.scalpFrac > 0){
    ctx.strokeStyle = (info.maskInf && info.maskInf.scalpColor) || 'rgb(224,178,148)';
    ctx.lineWidth = Math.max(1, geo.widthPx * 0.6);
    ctx.beginPath();
    for(const p of projected){
      const lim = Math.max(1, Math.floor((p.cpts.length - 1) * BRAID.scalpFrac));
      for(const [s0,e0] of p.runs){
        const e1 = Math.min(e0, lim);
        if(e1 > s0) traceSmoothPolyline(ctx, p.cpts.slice(s0, e1 + 1));
      }
    }
    ctx.stroke();
  }

  /* ①′ 모아 빗기(2026-09-22 5차) — 3D와 같은 규칙: 칸 안의 나머지 가닥을 제 뿌리에서
     그 칸 밧줄의 시작점(호길이 startAtFrac)까지 긋는다. 2D는 화면 좌표라 두피를 따라 휠
     필요가 없다(투영된 두피 위의 직선이 곧 두피 위다 — 정사영). 굵기는 가닥 원래 굵기. */
  let gathered = 0, cellsFilled = 0;
  if(BRAID.gather && how === 'grid' && grp2){
    const anchorOf = new Map();
    const anchor = (p)=>{
      if(anchorOf.has(p)) return anchorOf.get(p);
      const sA = braidArcLengths(p.cpts), tot = sA[sA.length-1] || 0;
      let k = 0; while(k < sA.length-1 && sA[k] < tot * BRAID.startAtFrac) k++;
      const a = p.cpts[k]; anchorOf.set(p, a); return a;
    };
    const byCol = new Map();
    for(let i=0;i<projected.length;i++){
      const ri = grp2.ropeOf[i];
      if(ri < 0 || ri === i) continue;
      const p = projected[i], rp = projected[ri];
      if(!p.cpts || !p.cpts.length || !rp.cpts || rp.cpts.length < 2) continue;
      if(!p.runs || !p.runs.length || p.runs[0][0] !== 0) continue;   // 뿌리가 가려진 가닥은 안 긋는다
      const col = bundleTintColor(colOf(p), tintOf(p.hb));
      let arr = byCol.get(col); if(!arr){ arr = []; byCol.set(col, arr); }
      arr.push([p.cpts[0], anchor(rp)]);
      gathered++;
    }
    /* 칸 면(3D와 같은 규칙) — 칸 안 뿌리(화면 좌표)의 볼록 껍질 + 밧줄 시작점을 머리색으로 채운다.
       화면에서는 이미 투영된 점이라 껍질을 바로 구하면 된다. 모인 선은 그 위에 긋는다. */
    if(BRAID3D.cellFill){
      const cells = new Map();
      for(let i=0;i<projected.length;i++){
        const ri = grp2.ropeOf[i]; if(ri < 0) continue;
        const p = projected[i]; if(!p.cpts || !p.cpts.length || !p.runs || !p.runs.length || p.runs[0][0] !== 0) continue;
        let a = cells.get(ri); if(!a){ a = []; cells.set(ri, a); } a.push(p.cpts[0]);
      }
      const cr = (o,a,b)=> (a.x-o.x)*(b.y-o.y) - (a.y-o.y)*(b.x-o.x);
      for(const [ri, P0] of cells){
        const rp = projected[ri]; if(!rp.cpts || rp.cpts.length < 2) continue;
        const P = P0.concat([anchor(rp)]).sort((a,b)=> a.x - b.x || a.y - b.y);
        if(P.length < 3) continue;
        const lo = [], hi = [];
        for(const q of P){ while(lo.length >= 2 && cr(lo[lo.length-2], lo[lo.length-1], q) <= 0) lo.pop(); lo.push(q); }
        for(let k=P.length-1;k>=0;k--){ const q = P[k]; while(hi.length >= 2 && cr(hi[hi.length-2], hi[hi.length-1], q) <= 0) hi.pop(); hi.push(q); }
        const hull = lo.slice(0, -1).concat(hi.slice(0, -1));
        if(hull.length < 3) continue;
        ctx.fillStyle = bundleTintColor(colOf(rp), tintOf(rp.hb) * BRAID3D.cellShade);
        ctx.beginPath(); ctx.moveTo(hull[0].x, hull[0].y);
        for(let k=1;k<hull.length;k++) ctx.lineTo(hull[k].x, hull[k].y);
        ctx.closePath(); ctx.fill();
        cellsFilled++;
      }
    }
    ctx.lineWidth = Math.max(0.9, geo.subWidth * 0.35);
    for(const [c, segs] of byCol){
      ctx.strokeStyle = c; ctx.beginPath();
      for(const [a, b] of segs){ ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
      ctx.stroke();
    }
  }

  // ② 밧줄 — 뒤에서 앞으로 하나씩
  for(const p of ropes){
    const base = colOf(p), t = tintOf(p.hb);
    const sAll = braidArcLengths(p.cpts);
    // 몸통 — 갈래 사이 골을 어두운 머리색으로 메운다
    ctx.strokeStyle = bundleTintColor(base, t * BRAID.bodyDark);
    ctx.lineWidth = geo.widthPx * 0.9;
    ctx.beginPath();
    for(const [s0,e0] of p.runs) traceSmoothPolyline(ctx, p.cpts.slice(s0, e0 + 1));
    ctx.stroke();
    // 갈래
    ctx.strokeStyle = bundleTintColor(base, t);
    ctx.lineWidth = geo.subWidth;
    ctx.beginPath();
    for(const [s0,e0] of p.runs) traceBraidPolyline(ctx, p.cpts, geo, s0, e0, sAll);
    ctx.stroke();
  }

  if(BRAID.log && !_braidLogged){
    _braidLogged = true;
    console.log(...gyeolBoldArgs(['[땋기] 자 <b>' + pxPerCm.toFixed(1) + 'px/cm</b>(3D 모델 자)'
      + ' · 밧줄 굵기 ' + BRAID.widthCm + 'cm = ' + geo.widthPx.toFixed(1) + 'px'
      + ' · 마디 ' + BRAID.nodeCm + 'cm = ' + geo.nodePx.toFixed(1) + 'px'
      + ' · 갈래 ' + geo.strands + '(선 ' + geo.subWidth.toFixed(1) + 'px, 진폭 ±' + geo.amp.toFixed(1) + 'px)'
      + '\n    이 뷰 밧줄 <b>' + ropes.length + '개</b>'
      + (how === 'grid' ? '(파팅 격자 ' + BRAID.partCm + 'cm 칸)' : '(난수 · 두상 전체 목표 ' + BRAID.count + ')')
      + ' · 보이는 가닥 ' + projected.length + '/' + calcN
      + ' · 두피 밑칠 뿌리 ' + Math.round(BRAID.scalpFrac * 100) + '%'
      + ' · 모아 빗기 ' + gathered + '가닥 · 칸 면 ' + cellsFilled + '칸'
      + '\n    다시 보기: resetBraidLog() 후 화면 갱신 · 끄기: BRAID.on = false']));
  }
  return true;
}

/* 로그는 렌더당 수십 번 도는 자리에서 부르므로 한 번만 찍는다.
   치수를 바꿔 다시 보고 싶으면 resetBraidLog()를 부르거나 화면을 다시 들어간다. */
let _braidLogged = false;
function resetBraidLog(){ _braidLogged = false; }

/* ══════════════════════════════════════════════════════════════════════════
   3D 결과보기의 밧줄 (2026-09-22 2차) — <b>튜브 메쉬</b>로 짓는다
   ─────────────────────────────────────────────────────────────────────────
   사용자: "2D에만 나오면 뭘해. 3D결과보기가 최종 창인데.."
   맞다. 1차는 조정 화면(15의 2D 캔버스)에만 끼웠고, 최종 창인 3D 결과보기
   (14 buildAdjustedHair3DObject → 18 setupModel3DScreen)는 그대로였다.

   ── 왜 선이 아니라 <b>튜브</b>인가 ───────────────────────────────────────
   3D 결과보기의 머리는 LineSegments + LineBasicMaterial이다. WebGL의 선은
   <b>굵기가 항상 1px</b>이다(linewidth는 대부분의 브라우저에서 무시된다). 그래서
   2D처럼 "굵은 선으로 긋기"가 3D에서는 성립하지 않는다 — 0.85cm 밧줄을 1px 선
   세 개로 그으면 화면엔 가는 선 세 줄이 흔들릴 뿐이다(방금 본 그 화면과 같다).
   갈래마다 반지름 있는 관을 세운다.

   ── 3D에서는 <b>앞뒤 가림이 공짜다</b> ───────────────────────────────────
   2D판 머리의 ⚠(교차점에서 한 갈래가 다른 갈래를 가려야 하는데 못 한다)가
   여기서는 풀린다. 갈래를 옆으로만이 아니라 <b>앞뒤로도</b> 흔들면
       옆   = A · sin(t + φk)
       앞뒤 = D · sin(2(t + φk))      (세 갈래 땋기의 표준 궤적 — 8자 모양)
   교차하는 두 갈래의 앞뒤가 늘 반대 부호라 <b>실제로 위아래로 지나간다</b>.
   그리는 순서는 깊이 버퍼가 정한다. 두 갈래(꼬기)는 이 식이면 교차점에서
   앞뒤가 같아져 관이 서로 뚫고 지나가므로 나선(cos, sin)으로 따로 둔다.

   ── 자 ──────────────────────────────────────────────────────────────
   modelCmPerUnit(17b — 스펙 역산이 lenCm을 푸는 그 자)을 먼저 쓰고, 없으면
   faceRulerCmPerUnit(12a). 2D판의 braidPxPerCm3D와 같은 출처(3D 모델)다.

   ── 무게 ────────────────────────────────────────────────────────────
   밧줄 60 × 갈래 3 × (길이/마디×stepsPerNode) × 원주 radial 정점이다.
   30cm 머리면 대략 정점 30만. 한 메쉬로 합쳐 <b>드로우콜 1</b>로 그린다
   (12b 배너: 가닥 하나당 Mesh 하나면 드로우콜이 가닥 수만큼 된다).
   폰에서 무거우면 BRAID3D.radial·stepsPerNode부터 내린다.
   되돌리기/끄기: BRAID3D.on = false (2D판과 별개로 끈다)
   ══════════════════════════════════════════════════════════════════════════ */
const BRAID3D = {
  on: true,            // BRAID.on이 켜져 있을 때만 의미가 있다(스타일이 켠다)
  radial: 5,           // 관 원주 정점 수(5면 오각 관 — 조명이 있어 둥글게 보인다)
  stepsPerNode: 8,     // 마디 하나를 몇 점으로 긋나(낮으면 갈래가 각진다)
  /* ── 관 굵기와 앞뒤 진폭 — <b>맞닿게</b> 역산한다 (2026-09-22, 하네스로 두 번 고침) ──
     1차: 갈래 관 반지름을 2D와 같은 식(굵기/갈래 × 1.15 ÷ 2)으로, 앞뒤 진폭을 옆의 1/2로.
          하네스: 교차점 앞뒤 간격 0.17cm < 관 지름 0.33cm — 관이 <b>절반 파고듦</b>.
     2차: 앞뒤 진폭만 키웠다 → 여전히 파고듦(최소거리 0.25cm).
          식으로 재 보니 세 갈래 궤적에서 갈래 간 최소 거리는 앞뒤를 아무리 키워도
          <b>옆 진폭(A)의 1.21배</b>에서 멈춘다. 그런데 관 지름이 A의 1.59배였다 —
          치수가 처음부터 겹칠 수밖에 없었다.
     원인은 2D에서 물려받은 1.15(갈래 선을 일부러 겹쳐 밧줄을 통짜로 보이게)다.
     3D에서 통짜로 보이는 건 <b>겹침이 아니라 맞닿음</b>이다. 그래서 3D는
       관 반지름 r = contactK · A,  A = 세기 · (굵기/2 − r)   → r를 닫힌 식으로 푼다
     contactK: 갈래 수별 "최소거리 ÷ A ÷ 2" — 3갈래 0.58(최소거리 1.19A @ D/A 1.5에 여유),
               2갈래 나선은 두 관이 늘 2A 떨어져 1.0. 4·5갈래는 식을 안 풀었다(초안). */
  contactK:   { 2: 1.0, 3: 0.58, 4: 0.40, 5: 0.30 },
  depthRatio: 1.5,     // 3갈래 앞뒤 진폭 ÷ 옆 진폭 — 최소거리가 포화(1.19A)에 닿는 자리
  strandShade: [1.0, 0.86, 0.93],   // 갈래별 밝기 — 셋이 같은 색이면 교차가 안 읽힌다(초안)
  /* 정점 예산 (2026-09-22 3차). 파팅 격자로 밧줄이 60 → 두피 면적÷칸(약 200)으로
     늘면 정점도 세 배 넘게 는다(실기기: 63개에 29.6만). 예산을 넘을 것 같으면
     <b>먼저 마디당 점</b>(최저 4), <b>그다음 원주</b>(최저 3)를 줄인다 — 밧줄 개수는
     안 줄인다(그게 파팅이다). 60만은 초안: 폰에서 버벅이면 내린다. */
  maxVerts: 600000,
  /* 저사양(isLowMemDevice — 기기메모리 ≤4GB 또는 코어 ≤4) 예산 (2026-09-22 4차).
     실기기(폰): 진단 [성능·메모리] "JS힙 190MB · 캔버스 52MB → 약 234MB · <b>저사양판정</b>" 상태에서
     조정 화면이 느려지고 화면 녹화가 길어지면 꺼졌다. 앱은 이미 저사양으로 판정하고 있었는데
     땋기만 그 판정을 안 보고 노트북과 같은 60만을 썼다. 25만은 초안(노트북 54만의 절반 아래). */
  maxVertsLow: 250000,
  /* 미니 3D(17b)는 슬라이더마다 다시 짓는 진단 창이라 따로 묶는다. 초안. */
  miniMaxVerts: 80000, miniMaxVertsLow: 50000,
  /* 모아 빗기 선 — 1px 선(LineSegments)이라 튜브보다 훨씬 싸다. 그래도 가닥 2만 개를 다
     그으면 폰에서 부담이라 칸당 상한을 둔다. null = 전부. 한 선을 몇 토막으로 휘나(두피를 따라). */
  gatherPerCell: null, gatherPerCellLow: 14, gatherPerCellMini: 6,
  gatherSegs: 5, gatherSegsLow: 3,
  /* 칸 면(2026-09-22 6차) — 모인 머리를 1px 선으로만 그었더니 칸당 75가닥이 모여도 선 사이로
     두피가 훤히 보였다(실기기 3D). 빗어 모은 머리는 <b>면</b>처럼 칸을 덮는다. 칸 안 뿌리들의
     외곽(볼록 껍질)과 밧줄 시작점을 잇는 머리색 면을 깔고, 선은 그 위에 결로 남긴다.
     이웃 칸 면 사이 좁은 틈(뿌리 간격만큼)이 가르마 선이 된다. 밝기는 밧줄색 × cellShade(초안). */
  cellFill: true, cellShade: 0.8,
  /* 몸통 자르기(2026-09-22 6차) — 실기기 3D: 가슴에 검은 조각이 점선처럼 찍혔다. 3D는 머리카락이
     몸을 피하지 않고 옷 <b>안</b>을 지나간다(원래 머리는 1px 선이라 뚫는 자리가 안 보였다).
     밧줄은 굵고 옆으로 흔들려서 옷 표면 바로 밑을 지나다 흔들릴 때마다 밖으로 삐져나왔다.
     원래 머리처럼 "몸 안에서 안 보이게" 하려면 몸통에 들어가는 지점에서 밧줄을 끝낸다.
     몸통 = getNeckBottomY()(목 밑동)에서 시작하는 원뿔대 — 13a 자리표시자 치수(윗반지름 0.50 ·
     아랫반지름 0.92 · 높이 1.15, 모델 단위)를 쓴다. 측정 의상은 모양이 달라 근사다(초안).
     여유 = 밧줄 반폭 — 표면 바로 밖을 지나는 밧줄도 끊어야 삐져나오지 않는다. */
  bodyCut: true, torsoTopR: 0.50, torsoBotR: 0.92, torsoH: 1.15,
};
/* 이 점이 몸통(원뿔대 + 여유) 안인가. 몸통 정보가 없으면(미니 3D 등) 늘 false. */
function braidInTorso(p, margin){
  if(!BRAID3D.bodyCut || typeof getNeckBottomY !== 'function') return false;
  let top; try{ top = getNeckBottomY(); }catch(e){ return false; }
  /* 위쪽에도 같은 여유 — 목 밑동 바로 위를 지나는 밧줄도 관 반폭만큼 아래로 내려와
     몸통 윗면을 뚫는다(하네스: 자르기 켜도 튜브 정점 127개가 몸통 안). */
  if(!isFinite(top) || p.y >= top + (margin || 0)) return false;
  const t = Math.min(1, (top - p.y) / BRAID3D.torsoH);
  const R = BRAID3D.torsoTopR + t * (BRAID3D.torsoBotR - BRAID3D.torsoTopR);
  return Math.hypot(p.x, p.z) < R + (margin || 0);
}
/* 이번 호출의 정점 예산. opts.maxVerts가 있으면 그것, 없으면 기기에 따라. */
function braidVertBudget(O, mini){
  if(O && O.maxVerts != null) return O.maxVerts;
  const low = (typeof isLowMemDevice === 'function') && isLowMemDevice();
  if(mini) return low ? BRAID3D.miniMaxVertsLow : BRAID3D.miniMaxVerts;
  return low ? BRAID3D.maxVertsLow : BRAID3D.maxVerts;
}

/* ══ 파팅 격자 — 2D·3D가 <b>같은 함수</b>로 밧줄 뿌리를 고른다 ═════════════════
   두 화면이 각자 고르면 같은 손님인데 조정 화면과 3D의 가르마가 달라진다
   (이 저장소가 반복해서 겪은 "한 값을 두 곳이 각자 정함"). 그래서 칸 정의는
   여기 한 곳이고, 호출부는 "뿌리 3D 좌표 목록"만 넘긴다.
   칸 좌표는 두상 타원체(getHeadEllipsoid, 중심 (0, CY, 0)) 위의 극각 φ·방위 θ다.
     줄 — 정수리에서 내려오는 <b>자오선 호길이</b> s(φ)를 partCm마다 끊는다.
     칸 — 그 줄의 <b>실제 타원 둘레</b>(반축 a·sinφ, c·sinφ — 라마누잔 근사)를 partCm로 나눈다.
   ── (2026-09-22 3차 안에서 고침) 처음엔 두 길이를 <b>평균 반지름</b> 하나로 쟀다.
      하네스(실기기 두상 반축)에서 밧줄 간격 중앙값이 1.37cm — 실측 1.60보다 14% 촘촘했다.
      반축이 0.417/0.633/0.492로 달라서 평균 반지름이 옆·정수리 곡률과 안 맞은 것이다.
      실측 간격을 쓰기로 한 이상 오차를 남기면 그 값을 쓴 의미가 없어서, 실제 길이로 잰다.
   ⚠ 자오선 길이는 가로 반지름을 (a+c)/2로 둔 평균 자오선이다. 앞뒤(c)와 옆(a)의
     자오선은 조금 다르다 — 남는 오차는 하네스 로그의 간격 중앙값으로 본다. */
function _braidRingLen(ra, rc){                     // 타원 둘레(라마누잔 II)
  const h = Math.pow(ra - rc, 2) / Math.pow(ra + rc || 1e-9, 2);
  return Math.PI * (ra + rc) * (1 + 3*h / (10 + Math.sqrt(4 - 3*h)));
}
function braidGridInfo(partOverride){
  const m = state && state.hair3Dneutral;
  if(!m) return null;
  const part = (partOverride > 0) ? partOverride : BRAID.partCm;
  // 칸 크기별로 한 벌씩(예산 때문에 넓힌 칸이 기본 칸 캐시를 덮지 않게)
  const cache = m._braidGrids || (m._braidGrids = {});
  if(cache[part]) return cache[part];
  let E = null;
  try{ E = (typeof getHeadEllipsoid === 'function') ? getHeadEllipsoid() : null; }catch(e){}
  const cmu = braidCmPerUnit3D();
  if(!E || !(E.a > 0) || !(E.b > 0) || !(E.c > 0) || !(cmu > 0) || !(part > 0)) return null;
  // 자오선 호길이 표 s(φ) (cm) — φ 0~π를 N칸
  const N = 720, rh = (E.a + E.c) / 2, S = new Float64Array(N + 1);
  for(let k=1;k<=N;k++){
    const f0 = Math.PI*(k-1)/N, f1 = Math.PI*k/N;
    const dx = rh*(Math.sin(f1) - Math.sin(f0)), dy = E.b*(Math.cos(f1) - Math.cos(f0));
    S[k] = S[k-1] + Math.hypot(dx, dy) * cmu;
  }
  const G = { part, a:E.a, b:E.b, c:E.c, CY: isFinite(m.CY) ? m.CY : 0, cmu, N, S };
  cache[part] = G;               // 모델 한 벌에 한 번(다시 지으면 새 모델이라 저절로 새로 잰다)
  return G;
}
function _braidArcAt(G, phi){                     // s(φ) 보간
  const x = Math.max(0, Math.min(G.N, phi / Math.PI * G.N)), k = Math.min(G.N - 1, Math.floor(x));
  return G.S[k] + (G.S[k+1] - G.S[k]) * (x - k);
}
function _braidPhiAt(G, s){                       // s(φ)의 역 — 이분 탐색
  let lo = 0, hi = G.N;
  while(hi - lo > 1){ const mid = (lo + hi) >> 1; if(G.S[mid] < s) lo = mid; else hi = mid; }
  const d = (G.S[hi] - G.S[lo]) || 1;
  return Math.PI * (lo + (s - G.S[lo]) / d) / G.N;
}
/* 뿌리 하나가 들어가는 칸과, 칸 가운데까지 거리(cm²). */
function braidCellOf(p, G){
  const ux = p.x / G.a, uy = (p.y - G.CY) / G.b, uz = p.z / G.c;
  const n = Math.hypot(ux, uy, uz) || 1;
  const phi = Math.acos(Math.max(-1, Math.min(1, uy / n)));
  const th  = Math.atan2(ux, uz);                          // −π~π, 0 = 정면
  const s   = _braidArcAt(G, phi);
  const row = Math.floor(s / G.part);
  const phiMid = _braidPhiAt(G, (row + 0.5) * G.part);
  const sp = Math.max(1e-4, Math.sin(phiMid));
  const ring = _braidRingLen(G.a * sp, G.c * sp) * G.cmu;  // 이 줄의 실제 둘레(cm)
  const ncol = Math.max(1, Math.round(ring / G.part));
  const shift = (row & 1) ? 0.5 : 0;                        // 벽돌 쌓기: 홀수 줄 반 칸
  const u = ((th + Math.PI) / (2 * Math.PI)) * ncol - shift;
  const col = ((Math.floor(u) % ncol) + ncol) % ncol;
  const du = u - Math.floor(u) - 0.5;                       // 칸 가운데에서 몇 칸
  const dS = s - (row + 0.5) * G.part, dT = du * (ring / ncol);
  return { key: row * 4096 + col, d2: dS*dS + dT*dT, row, col };
}
/* 뿌리 목록에서 칸마다 하나씩 — 고른 인덱스 배열을 돌려준다. 못 만들면 null. */
function braidPickGrid(roots, partOverride){
  const G = braidGridInfo(partOverride);
  if(!G || !roots || !roots.length) return null;
  const best = new Map();
  for(let i=0;i<roots.length;i++){
    const p = roots[i];
    if(!p || !isFinite(p.x) || !isFinite(p.y) || !isFinite(p.z)) continue;
    const c = braidCellOf(p, G);
    const b = best.get(c.key);
    if(!b || c.d2 < b.d2) best.set(c.key, { i, d2: c.d2 });
  }
  const out = []; for(const v of best.values()) out.push(v.i);
  return out;
}

/* ══ 칸 묶기 — 칸 안의 <b>모든</b> 가닥을 그 칸의 밧줄에 붙인다 (2026-09-22 5차) ══════
   사용자(실제 박스 브레이드 사진을 보며): "내가 말한 건 땋은 머리가 촘촘해야 된다는 게
   아니라, 빈틈에 머리카락은 다 있어야 된다는 얘기였어. 구획을 나눈 다음에 거기에 있는
   머리가닥들은 다 땋는 머리에 사용한다는 거지."
   3차까지는 칸마다 뿌리 <b>하나</b>만 밧줄로 쓰고 나머지 가닥은 버렸다 — 그래서 칸 안이
   통째로 두피였다. 실제로는 칸 안의 머리를 전부 빗어 모아 땋으므로, 칸은 <b>모인 결</b>로
   덮이고 두피는 칸 사이 <b>가르마 선</b>에서만 보인다.
   돌려주는 것: ropes = 칸마다 밧줄이 될 인덱스, ropeOf[i] = i번 가닥이 붙는 밧줄 인덱스(없으면 -1). */
function braidGroupGrid(roots, partOverride, nexts){
  const G = braidGridInfo(partOverride);
  if(!G || !roots || !roots.length) return null;
  const keys = new Array(roots.length);
  const best = new Map(), count = new Map();
  for(let i=0;i<roots.length;i++){
    const p = roots[i];
    if(!p || !isFinite(p.x) || !isFinite(p.y) || !isFinite(p.z)) continue;
    const c = braidCellOf(p, G);
    keys[i] = c.key;
    count.set(c.key, (count.get(c.key) || 0) + 1);
    /* (2026-09-22 6차) <b>솟는 가닥은 밧줄로 안 뽑는다</b>. 실기기 3D: 정수리에서 밧줄 하나가
       더듬이처럼 위로 뻗었다 — 칸 가운데에 제일 가까운 뿌리만 봤더니, 그 뿌리의 가닥이 두피
       바깥으로 곧게 솟는 가닥이었다. nexts[i] = 그 가닥의 뿌리 다음 점(1~2cm 아래)이 있으면,
       뿌리→다음 점이 두피 바깥(타원체 반지름 방향)으로 향하는 정도(cos)를 벌점으로 준다.
       cos 0.5(60°보다 가파름)부터 칸 크기만큼 벌점 — 그런 가닥은 칸에 다른 가닥이 있는 한 안 뽑힌다. */
    let pen = 0;
    const q = nexts && nexts[i];
    if(q && isFinite(q.x)){
      const nx = p.x / (G.a*G.a), ny = (p.y - G.CY) / (G.b*G.b), nz = p.z / (G.c*G.c);
      const nl = Math.hypot(nx, ny, nz) || 1;
      const dx = q.x - p.x, dy = q.y - p.y, dz = q.z - p.z, dl = Math.hypot(dx, dy, dz) || 1;
      const out = (dx*nx + dy*ny + dz*nz) / (nl * dl);
      if(out > 0.5) pen = (out - 0.5) * 4 * G.part * G.part;
    }
    const sc = c.d2 + pen;
    const b = best.get(c.key);
    if(!b || sc < b.d2) best.set(c.key, { i, d2: sc });
  }
  const ropeOf = new Int32Array(roots.length).fill(-1);
  for(let i=0;i<roots.length;i++){ if(keys[i] === undefined) continue; const b = best.get(keys[i]); if(b) ropeOf[i] = b.i; }
  const ropes = []; for(const v of best.values()) ropes.push(v.i);
  /* 칸 통계 — 사용자: "뿌리가 고루 퍼져서 나 있진 않은가봐. 뿌리 분포 확인이 필요한 건지…"
     칸마다 몇 가닥이 들었나(최소·중앙·최대)와, 1~2가닥뿐인 성근 칸 수. 성근 칸이 많으면
     뿌리 분포 문제, 고르면 그리기 문제다. */
  const cs = [...count.values()].sort((a,b)=>a-b);
  const stats = cs.length ? { cells: cs.length, min: cs[0], med: cs[cs.length>>1], max: cs[cs.length-1],
                              sparse: cs.filter(v => v <= 2).length } : null;
  return { ropes, ropeOf, stats };
}

/* 3D 자: cm/단위. 못 구하면 null(때우지 않는다 — 2D판과 같은 원칙). */
function braidCmPerUnit3D(){
  try{
    if(typeof modelCmPerUnit === 'function'){ const v = modelCmPerUnit(); if(v > 0) return v; }
  }catch(e){}
  try{
    if(typeof faceRulerCmPerUnit === 'function' && typeof getFaceMetrics === 'function'){
      const r = faceRulerCmPerUnit(getFaceMetrics()); if(r && r.y > 0) return r.y;
    }
  }catch(e){}
  return null;
}

/* 가닥 하나의 축을 호길이 등간격으로 다시 찍는다(3D). 마디 위상이 점 간격에
   안 끌려가게 하는 것 — 2D판 braidArcLengths와 같은 이유다. */
function braidResample3D(pts, step){
  // 누적 호길이를 먼저 쌓고, s = 0, step, 2·step … 자리를 선분 안에서 보간한다.
  const P = pts.filter(p=> p && isFinite(p.x) && isFinite(p.y) && isFinite(p.z));
  if(P.length < 2 || !(step > 0)) return [];
  const S = [0];
  for(let i=1;i<P.length;i++) S.push(S[i-1] + Math.hypot(P[i].x-P[i-1].x, P[i].y-P[i-1].y, P[i].z-P[i-1].z));
  const total = S[S.length-1];
  const out = []; let seg = 1;
  for(let s=0; s<=total + 1e-12; s+=step){
    while(seg < P.length-1 && S[seg] < s) seg++;
    const a = P[seg-1], b = P[seg], d = (S[seg] - S[seg-1]) || 1;
    const u = Math.max(0, Math.min(1, (s - S[seg-1]) / d));
    out.push({ x:a.x+(b.x-a.x)*u, y:a.y+(b.y-a.y)*u, z:a.z+(b.z-a.z)*u, s });
  }
  return out;
}

/* 땋은 머리 3D 객체. adj = computeAdjustedHair3DStrands()의 결과(전 뷰, 조정 반영),
   colorOf(st, i) = 그 가닥의 대표색(css). 못 지으면 null → 호출부는 평소 선으로.
   center = 밧줄 "바깥쪽"을 정할 두상 중심({x,y,z}).
   opts = { radial, stepsPerNode, log } — BRAID3D를 이 호출에서만 덮는다.
     미니 3D(17b)는 슬라이더마다 다시 짓는 진단 창이라 가볍게 부른다. */
function buildBraid3DObject(adj, colorOf, center, opts){
  const O = opts || {};
  if(typeof THREE === 'undefined' || !BRAID.on || !BRAID3D.on || !adj || !adj.length) return null;
  const cmPerUnit = braidCmPerUnit3D();
  if(!(cmPerUnit > 0)){
    console.warn('[땋기·3D] 자(cm/단위)를 못 만들어 평소 머리로 그립니다');
    return null;
  }
  const W  = BRAID.widthCm / cmPerUnit;            // 밧줄 굵기(단위)
  const L  = BRAID.nodeCm  / cmPerUnit;            // 마디
  const nS = Math.max(2, Math.min(5, BRAID.strands|0));
  const tight = Math.max(0, Math.min(1, BRAID.tightness));
  /* 맞닿음 역산(위 BRAID3D 배너): r = k·A, A = tight·(W/2 − r) → r = k·tight·(W/2) / (1 + k·tight).
     세기가 0이면 A=0 → r=0이 되므로, 그때는 갈래가 한 줄로 겹친 굵기(W/2)로 둔다. */
  const k  = BRAID3D.contactK[nS] || 0.3;
  const r  = tight > 0 ? (k * tight * (W/2)) / (1 + k * tight) : W/2;
  const A  = Math.max(0, (W/2 - r)) * tight;       // 옆 진폭: 바깥폭 = 2A + 2r ≤ W
  const D  = A * BRAID3D.depthRatio;
  let spn = Math.max(3, (O.stepsPerNode != null ? O.stepsPerNode : BRAID3D.stepsPerNode)|0);
  let RAD = Math.max(3, (O.radial != null ? O.radial : BRAID3D.radial)|0);
  const C = center || { x:0, y:0, z:0 };

  /* 밧줄로 쓸 가닥 — 파팅 격자(칸마다 하나). 격자를 못 만들면(두상 타원체·자 없음)
     예전처럼 인덱스 해시로 count만큼(결정적: 다시 지어도 같은 가닥). */
  let pick = null, how = 'hash', grp = null;
  const rootsAll = adj.map(st => st && st.pts && st.pts[0]);
  const nextsAll = adj.map(st => st && st.pts && st.pts[Math.min(3, st.pts.length - 1)]);
  if(BRAID.grid){
    grp = braidGroupGrid(rootsAll, undefined, nextsAll);
    pick = grp && grp.ropes;
    if(pick && pick.length) how = 'grid';
  }
  if(how !== 'grid'){
    const frac = Math.min(1, BRAID.count / adj.length);
    const hash = (i)=>{ const v = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
    pick = []; for(let i=0;i<adj.length;i++) if(hash(i) < frac) pick.push(i);
  }

  // 정점 예산 — 고른 밧줄의 호길이 합으로 미리 센다
  let arcSum = 0;
  for(const si of pick){ const pp = adj[si] && adj[si].pts; if(!pp) continue;
    for(let i=1;i<pp.length;i++) arcSum += Math.hypot(pp[i].x-pp[i-1].x, pp[i].y-pp[i-1].y, pp[i].z-pp[i-1].z) || 0; }
  const estV = ()=> (arcSum / (L / spn)) * nS * RAD;
  const spn0 = spn, RAD0 = RAD;
  const budget = braidVertBudget(O, !!O.mini);
  while(estV() > budget && spn > 4) spn--;
  while(estV() > budget && RAD > 3) RAD--;
  /* 그래도 넘으면 마디당 3점까지 — 밧줄 수는 끝까지 안 줄인다(그게 파팅이다).
     3점이면 갈래가 삼각 톱니처럼 꺾이지만, 폰이 꺼지는 것보다 낫다. */
  while(estV() > budget && spn > 3) spn--;
  /* 마지막 수단 — <b>칸을 넓힌다</b>. 밧줄을 아무거나 빼면 그 자리가 비지만, 칸을 키우면
     간격만 넓어지고 여전히 고르다. 넓힌 배율 = √(넘친 비율) (개수는 칸 크기의 제곱에 반비례).
     결과보기에서 이게 걸리면 로그에 몇 cm 칸이 됐는지 찍는다 — 파팅 간격이 바뀐 것이라서. */
  let partUsed = BRAID.partCm;
  if(estV() > budget && how === 'grid'){
    const want = BRAID.partCm * Math.sqrt(estV() / budget) * 1.05;
    const g2 = braidGroupGrid(rootsAll, want, nextsAll);
    const p2 = g2 && g2.ropes;
    if(p2 && p2.length){
      grp = g2;
      arcSum = 0;
      for(const si of p2){ const pp = adj[si] && adj[si].pts; if(!pp) continue;
        for(let i=1;i<pp.length;i++) arcSum += Math.hypot(pp[i].x-pp[i-1].x, pp[i].y-pp[i-1].y, pp[i].z-pp[i-1].z) || 0; }
      pick = p2; partUsed = want;
    }
  }
  const step = L / spn;
  const pos = [], nor = [], col = [], idx = [];
  const colr = new THREE.Color();
  let ropes = 0, verts = 0, bodyCutN = 0;
  const ringCos = [], ringSin = [];
  for(let j=0;j<RAD;j++){ ringCos.push(Math.cos(2*Math.PI*j/RAD)); ringSin.push(Math.sin(2*Math.PI*j/RAD)); }

  for(const si of pick){
    const st = adj[si];
    if(!st || !st.pts || st.pts.length < 3) continue;
    let ax = braidResample3D(st.pts, step);
    /* 몸통 자르기 — 뿌리 쪽부터 따라가다 몸통(+밧줄 반폭)에 처음 들어가는 점에서 끝낸다.
       미니 3D는 몸통이 없어 안 자른다. */
    if(!O.mini && BRAID3D.bodyCut){
      const cutAt = ax.findIndex(q => braidInTorso(q, W/2));
      if(cutAt >= 0){ ax = ax.slice(0, cutAt); bodyCutN++; }
    }
    if(ax.length < 4) continue;
    const total = ax[ax.length-1].s || 1;
    const skip = total * BRAID.startAtFrac;
    let base = '#1a1a1a';
    try{ base = colorOf ? (colorOf(st, si) || base) : (st.color || base); }catch(e){}
    ropes++;

    // 축의 틀(T 접선 · N 옆 · B 바깥) — 바깥 = 두상 중심에서 멀어지는 쪽
    const F = ax.map((p,i)=>{
      const a = ax[Math.max(0,i-1)], b = ax[Math.min(ax.length-1,i+1)];
      let tx=b.x-a.x, ty=b.y-a.y, tz=b.z-a.z; const tl=Math.hypot(tx,ty,tz)||1; tx/=tl; ty/=tl; tz/=tl;
      let ox=p.x-C.x, oy=p.y-C.y, oz=p.z-C.z;
      // N = T × out
      let nx=ty*oz-tz*oy, ny=tz*ox-tx*oz, nz=tx*oy-ty*ox; let nl=Math.hypot(nx,ny,nz);
      if(nl < 1e-9){ nx=1; ny=0; nz=0; nl=1; }       // 바깥과 접선이 나란하면 아무 옆이나
      nx/=nl; ny/=nl; nz/=nl;
      // B = N × T (바깥쪽 성분)
      const bx=ny*tz-nz*ty, by=nz*tx-nx*tz, bz=nx*ty-ny*tx;
      return { tx,ty,tz, nx,ny,nz, bx,by,bz };
    });

    for(let k=0;k<nS;k++){
      const phi = 2*Math.PI*k/nS;
      const shade = BRAID3D.strandShade[k % BRAID3D.strandShade.length] || 1;
      try{ colr.set(base); }catch(e){ colr.set('#1a1a1a'); }
      colr.multiplyScalar(shade);
      const startV = verts;
      // 갈래 중심선
      const cen = ax.map((p,i)=>{
        const f = F[i];
        const grow = p.s <= skip ? 0 : Math.min(1, (p.s - skip) / L);
        const t = 2*Math.PI*p.s/L + phi;
        let side, dep;
        if(nS === 2){ side = A*Math.cos(t); dep = A*Math.sin(t); }        // 꼬기 = 나선
        else        { side = A*Math.sin(t); dep = D*Math.sin(2*t); }       // 땋기 = 8자
        side *= grow; dep *= grow;
        return { x: p.x + f.nx*side + f.bx*dep, y: p.y + f.ny*side + f.by*dep, z: p.z + f.nz*side + f.bz*dep };
      });
      // 관 — 원주는 축의 N·B 평면에 세운다(갈래 기울기는 작아서 이걸로 충분하다)
      for(let i=0;i<cen.length;i++){
        const f = F[i], q = cen[i];
        for(let j=0;j<RAD;j++){
          const ex = f.nx*ringCos[j] + f.bx*ringSin[j];
          const ey = f.ny*ringCos[j] + f.by*ringSin[j];
          const ez = f.nz*ringCos[j] + f.bz*ringSin[j];
          pos.push(q.x + ex*r, q.y + ey*r, q.z + ez*r);
          nor.push(ex, ey, ez);
          col.push(colr.r, colr.g, colr.b);
          verts++;
        }
      }
      for(let i=0;i<cen.length-1;i++){
        for(let j=0;j<RAD;j++){
          const a = startV + i*RAD + j, b = startV + i*RAD + (j+1)%RAD;
          const c = a + RAD, d = b + RAD;
          idx.push(a, c, b,  b, c, d);
        }
      }
    }
  }
  if(!ropes || !pos.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal',   new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color',    new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = 'braidedHair';

  /* ── 모아 빗기 선 (2026-09-22 5차) ──────────────────────────────────
     칸 안의 나머지 가닥(ropeOf[i] = 그 칸 밧줄)을 <b>제 뿌리 → 밧줄 시작점</b>까지 두피를 따라
     긋는다. 시작점 = 밧줄 축에서 땋기가 시작되는 호길이(startAtFrac)의 자리 — 거기서부터
     갈래가 벌어지므로, 모인 머리가 그 점으로 들어가야 밧줄 "안으로" 들어간 것처럼 보인다.
     두피를 따라가게: 두 끝을 직선으로 잇고 각 점을 두상 타원체 기준 반지름으로 다시 편다
     (직선 그대로면 두피 안으로 파고든다). 선이 1px이라 한 칸에 수십 개가 모여야 결로 읽힌다. */
  let gatherN = 0, gatherV = 0, gatherObj = null;
  if(BRAID.gather && how === 'grid' && grp){
    const G = braidGridInfo(partUsed);
    const low = (typeof isLowMemDevice === 'function') && isLowMemDevice();
    const cap = O.mini ? BRAID3D.gatherPerCellMini : (low ? BRAID3D.gatherPerCellLow : BRAID3D.gatherPerCell);
    const segs = Math.max(2, (low || O.mini) ? BRAID3D.gatherSegsLow : BRAID3D.gatherSegs);
    const lift = BRAID.gatherLift / cmPerUnit;
    const enorm = (p)=> Math.hypot(p.x / G.a, (p.y - G.CY) / G.b, p.z / G.c) || 1;
    const anchorOf = new Map();        // 밧줄마다 시작점 한 번만
    const anchor = (ri)=>{
      if(anchorOf.has(ri)) return anchorOf.get(ri);
      const ax = braidResample3D(adj[ri].pts, L / 4);
      const total = ax.length ? ax[ax.length-1].s : 0;
      let a = ax[0] || adj[ri].pts[0];
      for(const q of ax){ if(q.s >= total * BRAID.startAtFrac){ a = q; break; } }
      anchorOf.set(ri, a); return a;
    };
    const perCell = new Map();
    const lp = [], lc = [];
    for(let i=0;i<adj.length;i++){
      const ri = grp.ropeOf[i];
      if(ri < 0 || ri === i || !adj[i] || !adj[i].pts || !adj[i].pts[0]) continue;
      if(cap != null){ const n = perCell.get(ri) || 0; if(n >= cap) continue; perCell.set(ri, n + 1); }
      const r0 = adj[i].pts[0], a = anchor(ri);
      const n0 = enorm(r0), n1 = enorm(a);
      let base = '#1a1a1a';
      try{ base = colorOf ? (colorOf(adj[i], i) || base) : (adj[i].color || base); }catch(e){}
      try{ colr.set(base); }catch(e){ colr.set('#1a1a1a'); }
      let prev = null;
      for(let k=0;k<=segs;k++){
        const t = k / segs;
        const q = { x: r0.x + (a.x - r0.x)*t, y: r0.y + (a.y - r0.y)*t, z: r0.z + (a.z - r0.z)*t };
        /* 두피를 따라 — 반지름(타원체 정규화)을 양 끝 사이로 펴고, 두피 위로 lift만큼.
           ⚠ 뿌리 높이(n0) 아래로는 안 내려간다 (하네스로 잡음): 가닥이 뿌리에서 곧장 아래로
           떨어지면 밧줄 시작점이 두피 <b>안쪽</b>에 있고(n1 < n0), 그대로 펴면 선이 머리 속으로
           1cm 넘게 파고들었다. 빗어 붙인 머리는 두피 위에 눕는다 — 그 자리에서는 끝점이
           두피 높이로 떠서 밧줄 시작점보다 조금 위에서 만난다(밧줄 관이 그 틈을 덮는다). */
        const want = Math.max(n0 + (n1 - n0) * t, n0), now = enorm(q), k2 = want / now;
        const dx = q.x * k2, dy = (q.y - G.CY) * k2, dz = q.z * k2;
        const dl = Math.hypot(dx, dy, dz) || 1;
        const pt = { x: dx + dx/dl*lift, y: G.CY + dy + dy/dl*lift, z: dz + dz/dl*lift };
        if(prev){ lp.push(prev.x, prev.y, prev.z, pt.x, pt.y, pt.z); lc.push(colr.r, colr.g, colr.b, colr.r, colr.g, colr.b); gatherV += 2; }
        prev = pt;
      }
      gatherN++;
    }
    if(lp.length){
      const lg = new THREE.BufferGeometry();
      lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
      lg.setAttribute('color',    new THREE.Float32BufferAttribute(lc, 3));
      gatherObj = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true }));
      gatherObj.name = 'braidGather';
    }
  }
  /* ── 칸 면 (2026-09-22 6차) ────────────────────────────────────────
     칸마다: 칸 안 뿌리들을 칸 가운데의 접평면에 눕혀 볼록 껍질을 구하고, 껍질 둘레의 각 변과
     밧줄 시작점을 잇는 삼각형을 깐다. 한 점에서 볼록 다각형의 모든 변으로 부채를 펴면
     그 합집합이 "다각형 + 그 점"의 볼록 껍질이다 — 칸 전체와, 칸에서 밧줄로 들어가는 목까지
     한 번에 덮인다. 점은 두피 위로 lift만큼 띄운다(선보다 살짝 아래 — 선이 결로 위에 보이게).
     칸 1.6cm에 두상 반지름 8cm면 평면 삼각형이 두피 곡면 밑으로 처지는 양이 0.04cm라
     lift(0.12cm) 안에 든다. 양면 재질(뒤집힌 부채도 보이게). */
  let fillN = 0, fillObj = null;
  if(BRAID3D.cellFill && how === 'grid' && grp){
    const G = braidGridInfo(partUsed);
    const liftF = BRAID.gatherLift * 0.6 / cmPerUnit;
    const radial = (p)=>{ const dx = p.x, dy = p.y - G.CY, dz = p.z, l = Math.hypot(dx, dy, dz) || 1; return { x: dx/l, y: dy/l, z: dz/l }; };
    const up = (p, h)=>{ const n = radial(p); return { x: p.x + n.x*h, y: p.y + n.y*h, z: p.z + n.z*h }; };
    const members = new Map();
    for(let i=0;i<adj.length;i++){
      const ri = grp.ropeOf[i]; if(ri < 0 || !adj[i] || !adj[i].pts || !adj[i].pts[0]) continue;
      let a = members.get(ri); if(!a){ a = []; members.set(ri, a); } a.push(adj[i].pts[0]);
    }
    const fp = [], fc = [];
    for(const [ri, roots] of members){
      if(roots.length < 3) continue;
      // 칸 가운데와 접평면 기저
      let cx = 0, cy = 0, cz = 0; for(const r of roots){ cx += r.x; cy += r.y; cz += r.z; }
      cx /= roots.length; cy /= roots.length; cz /= roots.length;
      const n = radial({ x:cx, y:cy, z:cz });
      let u = { x: -n.z, y: 0, z: n.x }; let ul = Math.hypot(u.x, u.y, u.z);
      if(ul < 1e-6){ u = { x:1, y:0, z:0 }; ul = 1; }
      u = { x:u.x/ul, y:u.y/ul, z:u.z/ul };
      const v = { x: n.y*u.z - n.z*u.y, y: n.z*u.x - n.x*u.z, z: n.x*u.y - n.y*u.x };
      const P = roots.map(r => ({ r, s: (r.x-cx)*u.x + (r.y-cy)*u.y + (r.z-cz)*u.z, t: (r.x-cx)*v.x + (r.y-cy)*v.y + (r.z-cz)*v.z }));
      // 볼록 껍질(모노톤 체인)
      P.sort((a,b)=> a.s - b.s || a.t - b.t);
      const cr = (o,a,b)=> (a.s-o.s)*(b.t-o.t) - (a.t-o.t)*(b.s-o.s);
      const lo = [], hi = [];
      for(const q of P){ while(lo.length >= 2 && cr(lo[lo.length-2], lo[lo.length-1], q) <= 0) lo.pop(); lo.push(q); }
      for(let k=P.length-1;k>=0;k--){ const q = P[k]; while(hi.length >= 2 && cr(hi[hi.length-2], hi[hi.length-1], q) <= 0) hi.pop(); hi.push(q); }
      const hull = lo.slice(0, -1).concat(hi.slice(0, -1));
      if(hull.length < 3) continue;
      // 부채 꼭짓점 = 밧줄 시작점(모아 빗기와 같은 자리). 모아 빗기가 꺼져 있으면 칸 가운데.
      let apex;
      if(typeof anchor === 'function'){ apex = anchor(ri); }
      else { const ax = braidResample3D(adj[ri].pts, L/4), tot = ax.length ? ax[ax.length-1].s : 0;
             apex = ax.find(q => q.s >= tot * BRAID.startAtFrac) || ax[0] || adj[ri].pts[0]; }
      const A = up(apex, liftF);
      let base = '#1a1a1a';
      try{ base = colorOf ? (colorOf(adj[ri], ri) || base) : (adj[ri].color || base); }catch(e){}
      try{ colr.set(base); }catch(e){ colr.set('#1a1a1a'); }
      colr.multiplyScalar(BRAID3D.cellShade);
      for(let k=0;k<hull.length;k++){
        const h0 = up(hull[k].r, liftF), h1 = up(hull[(k+1) % hull.length].r, liftF);
        fp.push(A.x, A.y, A.z, h0.x, h0.y, h0.z, h1.x, h1.y, h1.z);
        for(let z=0;z<3;z++) fc.push(colr.r, colr.g, colr.b);
      }
      fillN++;
    }
    if(fp.length){
      const fg = new THREE.BufferGeometry();
      fg.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3));
      fg.setAttribute('color',    new THREE.Float32BufferAttribute(fc, 3));
      if(typeof fg.computeVertexNormals === 'function') fg.computeVertexNormals();
      fillObj = new THREE.Mesh(fg, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
      fillObj.name = 'braidCellFill';
    }
  }


  if(BRAID.log && O.log !== false){
    console.log(...gyeolBoldArgs(['[땋기·3D] 자 ' + cmPerUnit.toFixed(2) + 'cm/단위'
      + ' · 밧줄 <b>' + ropes + '개</b>'
      + (how === 'grid'
          ? (partUsed > BRAID.partCm + 1e-9
              ? '(파팅 격자 <b>' + partUsed.toFixed(2) + 'cm로 넓힘</b> — 실측 ' + BRAID.partCm + 'cm로는 예산 초과)'
              : '(파팅 격자 ' + BRAID.partCm + 'cm 칸)')
          : '(난수 · 목표 ' + BRAID.count + ' — 격자 못 만듦)')
      + ' × 갈래 ' + nS
      + ' · 굵기 ' + BRAID.widthCm + 'cm · 마디 ' + BRAID.nodeCm + 'cm'
      + ' · 관 반지름 ' + (r*cmPerUnit).toFixed(2) + 'cm'
      + '\n    모아 빗기 <b>' + gatherN + '가닥</b>(선 정점 ' + (gatherV/1000).toFixed(0) + '천 — 1px 선이라 튜브 예산과 별개)'
      + ' · 칸 면 ' + fillN + '칸'
      + (grp && grp.stats ? '\n    [뿌리 분포] 칸 ' + grp.stats.cells + '개 · 칸당 가닥 최소 ' + grp.stats.min + ' / 중앙 ' + grp.stats.med + ' / 최대 ' + grp.stats.max
          + ' · 1~2가닥뿐인 성근 칸 <b>' + grp.stats.sparse + '</b>개'
          + ' — 성근 칸이 많으면 뿌리 분포 문제, 적은데 두피가 비면 그리기 문제' : '')
      + (bodyCutN ? '\n    몸통에 들어가는 밧줄 ' + bodyCutN + '개를 들어가는 자리에서 끝냄(원래 머리처럼 몸 안은 안 보임 · 끄기 BRAID3D.bodyCut=false)' : '')
      + '\n    정점 <b>' + (verts/1000).toFixed(0) + '천</b> · 삼각형 ' + (idx.length/3/1000).toFixed(0) + '천 · 드로우콜 1'
      + ' · 예산 ' + (budget/1000) + '천' + ((typeof isLowMemDevice === 'function' && isLowMemDevice()) ? '(저사양)' : '')
      + ((spn !== spn0 || RAD !== RAD0) ? ' · <b>예산에 맞춰 줄임</b>: 마디당 ' + spn0 + '→' + spn + '점 · 원주 ' + RAD0 + '→' + RAD : '')
      + ' — 폰에서 무거우면 BRAID3D.maxVerts를 내린다']));
  }
  if(!gatherObj && !fillObj) return mesh;
  const grpObj = new THREE.Group();
  grpObj.name = 'braidedHairGroup';
  grpObj.add(mesh);
  if(fillObj) grpObj.add(fillObj);
  if(gatherObj) grpObj.add(gatherObj);
  return grpObj;
}
