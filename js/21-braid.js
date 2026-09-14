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

  log: true,
};

/* 자. 눈→턱을 FACE_RULER_CM.eyeToChin으로 나눈다 — 12a의 makeFaceProjector가
   쓰는 것과 <b>같은 자</b>다(두 벌이 되면 안 된다).
   ⚠ 재는 곳은 <b>캔버스 좌표</b>다. 랜드마크는 정규화(0~1)라 maskH를 곱하면
     이미지 px가 되는데, 정작 밧줄을 긋는 점(cpts)은 이미 화면으로 옮겨진 뒤다.
     이미지 자로 굵기를 정하면 화면이 이미지보다 작은 실기기에서 밧줄만 통째로
     굵어진다 — 10-hair-render-2d.js가 resScale로 똑같이 당한 자리다(그 배너 참고).
     그래서 렌더가 쓰는 변환(toCY)을 그대로 통과시켜 잰다. */
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
     밧줄은 굵기가 뜻이 없고, 화면엔 그럴싸하게 나와서 틀린 걸 모른다. */
function braidGeometry(angle, maskH, toCY){
  if(!BRAID.on) return null;
  const pxPerCm = braidPxPerCm(angle, maskH, toCY);
  if(!pxPerCm) return null;
  const widthPx = BRAID.widthCm * pxPerCm;
  const nodePx  = BRAID.nodeCm  * pxPerCm;
  if(!(widthPx > 1) || !(nodePx > 1)) return null;
  const nStr  = Math.max(2, Math.min(5, BRAID.strands|0));
  const tight = Math.max(0, Math.min(1, BRAID.tightness));
  // 갈래 하나의 선 굵기. 갈래끼리 살짝 겹쳐야 밧줄이 통짜로 보인다(1.15).
  const subWidth = Math.max(0.9, widthPx / nStr * 1.15);
  /* ── 진폭은 <b>남는 폭</b>에서 나온다 (첫 판 수정) ─────────────────────
     처음엔 amp = (굵기/2) x 세기로 뒀는데, 갈래 <b>선 자체의 굵기</b>를 안 셌다.
     하네스로 재 보니 갈래 중심이 ±7.15px 흔들리는데 선이 10.9px이라 밧줄
     바깥폭이 25px — 지정한 19px(1.3cm)보다 33% 굵었다. 그러면 widthCm이
     "밧줄이 이만큼 굵다"는 뜻을 잃고 아무 뜻도 없는 계수가 된다.
     바깥폭 = 2xamp + subWidth 이므로 <b>남는 폭</b>을 세기로 나눠 갖는다.
     이러면 세기가 1이어도 밧줄은 절대 widthCm을 안 넘는다(검사 ⑯이 이걸 본다). */
  const amp = Math.max(0, (widthPx - subWidth) / 2) * tight;
  return { widthPx, nodePx, pxPerCm, strands: nStr, tightness: tight, subWidth, amp };
}
/* 밧줄 하나를 ctx의 <b>현재 path에</b> 얹는다. traceSmoothPolyline과 같은 자리에
   끼우는 것이므로 beginPath/stroke는 호출부가 한다(배치 묶음을 안 깬다). */
function traceBraidPolyline(ctx, pts, geo){
  if(!pts || pts.length < 2 || !geo) return;
  // 축을 따라 누적 호길이. 마디 위상의 기준이므로 <b>화면 거리</b>로 쌓아야 한다
  // (점 개수로 쌓으면 점이 촘촘한 구간에서 마디가 잘아진다).
  const n = pts.length;
  const s = new Array(n); s[0] = 0;
  for(let i=1;i<n;i++) s[i] = s[i-1] + Math.hypot(pts[i].x-pts[i-1].x, pts[i].y-pts[i-1].y);
  const total = s[n-1] || 1;
  const skip = total * BRAID.startAtFrac;     // 뿌리 쪽 이 구간은 안 땋는다
  const amp = geo.amp;
  const k2pi = Math.PI * 2 / geo.nodePx;

  for(let k=0; k<geo.strands; k++){
    const phase = Math.PI * 2 * k / geo.strands;
    const out = new Array(n);
    for(let i=0;i<n;i++){
      const a = pts[Math.max(0,i-1)], b = pts[Math.min(n-1,i+1)];
      const tx = b.x-a.x, ty = b.y-a.y, L = Math.hypot(tx,ty) || 1;
      // 뿌리 쪽은 갈래가 아직 안 벌어졌다가 서서히 벌어진다(두피에서 튀어나오지 않게)
      const grow = s[i] <= skip ? 0 : Math.min(1, (s[i]-skip) / Math.max(1, geo.nodePx));
      const off = amp * grow * Math.sin(s[i]*k2pi + phase);
      out[i] = { x: pts[i].x + (-ty/L)*off, y: pts[i].y + (tx/L)*off };
    }
    traceSmoothPolyline(ctx, out);
  }
}

/* 로그는 렌더당 수십 번 도는 자리에서 부르므로 한 번만 찍는다.
   치수를 바꿔 다시 보고 싶으면 resetBraidLog()를 부르거나 화면을 다시 들어간다. */
let _braidLogged = false;
function resetBraidLog(){ _braidLogged = false; }
