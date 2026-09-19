/* ══════════════════════════════════════════════════════════
   07a-render-canvas.js — 각도 전환 · 캔버스 렌더 · 지워진 자리 메움 · 경계 배경
   원본 index.html 10381~11385행. 클래식 스크립트이므로 로드 순서가 곧
   실행 순서다 — index.html의 <script src> 순서를 바꾸지 말 것.
   ══════════════════════════════════════════════════════════ */
/* ════════════════════════════════════════
   ANGLE SWITCH
════════════════════════════════════════ */
function renderAngleSwitch(targetId){
  const el=document.getElementById(targetId); if(!el) return; el.innerHTML='';
  ANGLES.forEach(a=>{
    const btn=document.createElement('button');
    btn.textContent=ANGLE_LABELS[a];
    btn.className=state.currentViewAngle===a?'on':'';
    btn.onclick=()=>{
      state.currentViewAngle=a;
      try{ trimDerivedCanvases(a, '뷰 전환'); }catch(e){}   // 안 보는 뷰의 파생 캔버스 반납
      bindStylingToCurrentView();   // 스타일링 슬라이더는 뷰마다 따로다
      renderAngleSwitches();
      updateSegStatus();
      syncSliderUI(); drawAdjustPreview(); drawResult();
    };
    el.appendChild(btn);
  });
}
// 조정/결과 화면 두 각도 스위치를 함께 다시 그리는 헬퍼 — 이 둘을 나란히 호출하는
// 코드가 여러 곳에 그대로 반복되던 것을 하나로 합침
function renderAngleSwitches(){
  renderAngleSwitch('angleSwitch');
  renderAngleSwitch('angleSwitchResult');
}

/* ════════════════════════════════════════
   RENDER / CANVAS
   - 이미지 캐시로 매번 new Image() 방지
   - hairCanvas 없으면 SVG 선 오버레이로 폴백
════════════════════════════════════════ */
const imgCache = {}; // angle → HTMLImageElement (loaded)

function getCachedImg(angle, cb){
  const url = state.shots[angle];
  if(!url){ cb(null); return; }
  if(imgCache[angle] && imgCache[angle].src.endsWith(url.slice(-20))){
    cb(imgCache[angle]); return;
  }
  const img = new Image();
  img.onload = ()=>{ imgCache[angle]=img; cb(img); };
  img.onerror = ()=>cb(null);
  img.src = url;
}

// fit 계산만 하고 실제로 그리지는 않음 (베이스를 원본 대신 baseC로 바로 그릴 때 사용)
// 이건 <b>덮기</b>(cover) — 캔버스를 꽉 채우고 넘치는 쪽은 잘라낸다.
function computeFit(imgW, imgH, w, h){
  const ir=imgW/imgH, cr=w/h;
  let dw,dh,dx,dy;
  if(ir>cr){dh=h;dw=h*ir;dx=(w-dw)/2;dy=0;}
  else{dw=w;dh=w/ir;dx=0;dy=(h-dh)/2;}
  return {dw,dh,dx,dy};
}
/* <b>담기</b>(contain) — 사진 전체가 캔버스 안에 들어오게. 결과 화면 전용.
   (2026-08-02) 실기기(가로가 긴 데스크톱 창)에서 발견: 세로 사진을 cover로 깔면
   가로를 채우느라 세로가 캔버스보다 훨씬 커져서 <b>목·어깨가 프레임 아래로
   잘려나간다</b> — 조정 화면은 어차피 머리만 보면 되니 문제가 안 됐지만, 결과
   화면은 목 아래 의상이 주인공이라 그 구간이 안 보이면 아무것도 안 한 것처럼
   보인다(실제 증상: "조정 화면과 똑같이 나온다"). 결과 화면만 담기로 바꾼다. */
function computeFitContain(imgW, imgH, w, h){
  const ir=imgW/imgH, cr=w/h;
  let dw,dh,dx,dy;
  if(ir>cr){dw=w;dh=w/ir;dx=0;dy=(h-dh)/2;}
  else{dh=h;dw=h*ir;dx=(w-dw)/2;dy=0;}
  return {dw,dh,dx,dy};
}

/* 투명 구멍을 주변 색으로 메운 사본을 만든다(작은 해상도).
   알고리즘: 투명 픽셀 중 "불투명 이웃이 있는" 것부터 그 이웃들의 평균색으로
   채우고, 채워진 픽셀은 다음 회차에서 이웃 역할을 한다 — 경계에서 안쪽으로
   물이 스미듯 번진다. 구멍 반지름만큼 회차를 돌면 완전히 메워진다.
   (거리변환·인페인팅의 아주 단순한 형태. 바탕으로만 쓰므로 이 정도면 충분하다.) */
/* 이 뷰의 사진이 그 슬롯에 맞는지 <b>알리기만</b> 한다(배제하지 않음).
   얼굴 실측 각도로만 판정 — 얼굴이 안 잡힌 뷰는 근거가 없으니 조용히 넘어간다
   (후면은 원래 안 잡히는 게 정상이다). */
const SLOT_YAW_MIN_BACK = 120;  // 후면인데 이보다 정면에 가까우면 뒷머리 사진이 아님
const SLOT_YAW_MIN_SIDE = 15;   // 측면인데 이보다 정면에 가까우면 옆머리 정보가 없음
function warnViewSlotMismatch(angle){
  const lm = state.landmarks && state.landmarks[angle];
  const yaw = (lm && typeof lm.poseYawDeg === 'number') ? lm.poseYawDeg : null;
  if(yaw === null) return;                           // 실측 없음 — 판정 불가
  const a = Math.abs(yaw);
  let bad = null;
  if(angle === 'back'){
    if(a < SLOT_YAW_MIN_BACK) bad = `얼굴이 ${a.toFixed(0)}°로 잡힘 — 뒷머리 사진이 아님`;
  } else if(angle === 'left' || angle === 'right'){
    const want = LIVE_YAW_TARGET[angle];
    if(want && a > SLOT_YAW_MIN_SIDE && (yaw >= 0) !== (want.max > 0)) bad = `반대쪽 옆얼굴(yaw ${yaw.toFixed(0)}°)`;
    else if(a <= SLOT_YAW_MIN_SIDE) bad = `거의 정면(yaw ${yaw.toFixed(0)}°)`;
  } else if(angle === 'front'){
    if(a > 45) bad = `정면 슬롯인데 yaw ${yaw.toFixed(0)}°`;
  }
  if(bad){
    console.warn(`[슬롯 불일치] ${angle} — ${bad}.`
      + ` 이 뷰의 가닥이 반대편(예: 후면 라벨이 앞머리 자리)에 얹혀 3D에서 섞여 보일 수 있습니다.`
      + ` 배제하지 않고 그대로 씁니다 — 다시 촬영하면 정상화됩니다.`);
  }
}

/* ══════════════════════════════════════════════════════════════════
   지워진 머리카락 자리 메우기 (2026-07-27 2차)
   ─────────────────────────────────────────────────────────────────
   baseC는 원본에서 머리카락을 destination-out으로 지운 그림이라, 조정으로
   가닥이 비켜난 자리는 투명 구멍이 되고 페이지 배경(검정)이 비친다.
   그 구멍을 메운 배경을 만들어 baseC 밑에 깐다.

   ── 사용자 설계(2026-07-27) ──
   "피부색 경계는 세그멘테이션이 아니라 두상으로 우리가 잡는 영역으로 잡아야겠네.
     그 외는 목은 신체부위로 잡힐 테니까."
   맞다. 채울 자리는 헤어 세그멘테이션 안이지만, <b>피부로 다뤄야 하는 범위</b>는
   두상이다. 긴 머리가 어깨까지 내려오면 그 구멍은 옷·배경이지 피부가 아니다.
     · 두상 안  → 피부: 주변색 + <b>실제 피부 결</b>, 피부톤 편향 ON
     · 두상 밖  → 주변색만(결 없음), 편향 OFF
   ※ 사람/배경 구분(personMask)은 <b>쓰지 않는다</b> — 둘 다 "주변색만"으로
     처리가 같아서 넣어도 그림이 안 바뀐다. 목에도 결을 넣고 싶어지면
     그때 personMask를 조건에 더하면 된다(자리는 아래 headAt 한 곳).

   ── 왜 두 해상도인가 ──
   색·명암(저주파)은 번지는 계산이라 회차가 구멍 반지름만큼 필요하다 → 160px에서
   싸게 만든다. 반면 피부 결(고주파)은 확대하면 뭉개지므로 <b>원본 해상도</b>에서
   한 번 더한다. 결을 이어붙이는 게 아니라 "색은 주변에서, 결만 실제 피부에서"
   가져오는 방식이라 아무리 넓은 면을 채워도 이음매가 안 생긴다.
══════════════════════════════════════════════════════════════════ */
const HOLE_FILL = {
  lowW: 160,      // 저주파(색·명암) 계산 해상도
  outW: 1200,     // 최종 배경 해상도 상한(피부 결이 보이는 해상도)
                  // (2026-08-10) 900→1200. 두상 <b>밖</b>(어깨·옷·배경)까지 여기서
                  // 제대로 메우게 되면서, 확대해 깔 때 뭉개지면 그게 그대로 "유령"으로 보인다.
  patch: 72,      // 피부 표본 한 변(출력 해상도 기준)
  texture: 1.0,   // 결 세기(1=패치 그대로)
  skinBoost: 3,   // 피부색 이웃 가중(두상 안에서만)
  skinTol: 110,
  /* ── 살 색 격자 (2026-09-12) — 패치 타일링을 대체한다 ──────────────────
     사용자: "얼굴 전체를 갖다넣어서 눈이 나오게 하지 말고, 3D 결과보기
     이마채우기처럼 주변부 픽셀을 가져와서 심어."
     8/11에 "이마 표본만 쓴다"로 한 번 고쳤는데도 눈이 남은 이유는 <b>고른
     자리</b>가 아니라 <b>쓰는 방식</b>에 있었다. 어느 자리에서 뜨든 결국
     patch 한 장(72px)을 구멍 전체에 거울 타일로 까는 구조라, 그 한 장에 뭐가
     섞이면 화면에 그게 수십 번 찍힌다. 이 손님은 앞머리가 이마를 통째로 덮어
     이마 후보 여섯이 전부 탈락한다 — 구조가 그대로면 또 같은 일이 난다.
     12a의 SCALP_SKIN이 이미 같은 문제를 자리별 색으로 풀었다(정점마다 제
     자리의 살을 집고, 살이 아니면 가장 가까운 살로 번진 값을 집는다).
     여기도 똑같이 한다: 두상 안 격자에 살 색을 모으고 → 빈 칸을 이웃으로
     번지게 하고 → 구멍 픽셀마다 <b>제 자리</b> 색을 집는다. 타일이 없으니
     반복될 무늬 자체가 없다.
     되돌리기: HOLE_FILL.skinField.on = false (8/11 타일 방식으로 복귀) */
  skinField: {
    on: true,
    gridX: 48, gridY: 64,   // 격자 해상도(두상 타원 위)
    darkPct: 0.38,          // 이 백분위보다 어두우면 살이 아니다(눈·눈썹·입·머리경계)
    fillPasses: 96,         // 빈 칸을 이웃 평균으로 번지게 = "가장 가까운 살"
    minCells: 0.08,         // 살이 이보다 적게 잡히면 안 쓴다(폴백이 낫다)
    detail: 0.55,           // 결(고주파)만 얹는 세기. 색은 전부 격자가 정한다
    flatTol: 16,            // 표본 고주파 표준편차 상한 — 넘으면 눈·눈썹이라 결도 안 쓴다
  },
  /* ── 두상 <b>밖</b>도 주변색으로 (2026-09-14) ────────────────────────────
     사용자(긴머리 여성 후면): "2D 조정화면 뒷머리 부분, 거기는 색메움이 반영이
     안되었나봐. 머리를 줄이니까 많이 드러나는데, <b>눈모양이 가득해</b>."

     ── 눈모양의 정체는 타일이 아니라 mirrorDetail이다 ────────────────────
     8/11·9/12에 고친 것은 <b>패치 타일링</b>이었는데, 후면에 남은 것은 다른
     함수다. mirrorDetail은 구멍 경계를 기준으로 <b>바깥 픽셀을 안으로 반사</b>해
     고주파를 가져온다 — 눈 옆이 구멍이면 눈 윤곽이 구멍 안으로 접혀 들어가고,
     4방향으로 도니까 여러 번 찍힌다. 색칠된 눈이 아니라 <b>윤곽선</b>이다.

     ── 왜 후면에만 남았나 ────────────────────────────────────────────────
     이식 루프가 `if(v2 > 1) continue; // 두상 밖`으로 <b>타원 안만</b> 돈다.
     mirrorDetail은 그보다 앞 단계(RENDER_PLATE)에서 <b>타원과 무관하게</b>
     전체에 돈다. 그래서 타원 안은 나중에 살 격자가 덮어써서 깨끗하고, 타원
     <b>밖</b>은 mirrorDetail 결과가 그대로 최종이 된다.
     긴 머리를 줄이면 드러나는 자리가 대부분 타원 밖이라 후면에서만 크게 보였고,
     짧은 머리 남성은 거의 다 타원 안이라 안 보였다. 뷰의 문제가 아니라
     <b>구멍이 타원 밖이냐</b>의 문제였다(후면에 랜드마크가 없는 것과는 별개다 —
     headEllipseFor는 헤어 실루엣 밴드로 서므로 후면에도 타원은 있다).

     ── 고침: 밖에는 <b>밖의</b> 주변색을 쓴다 ────────────────────────────
     안쪽(살 격자)을 밖으로 넓히지 <b>않는다</b>. 드러난 자리는 두피가 아니라
     목·어깨·옷·배경이라, 살색으로 메우면 어깨 옆 허공에 살색 덩어리가 생긴다
     (예전 로그의 "유령 덩어리"가 그것이다).
     대신 같은 3패스 구조를 <b>타원 밖 픽셀로 따로</b> 세운다 — 씨앗이 옷이면
     옷색, 배경이면 배경색, 목이면 목 살색이 <b>가장 가까운 것</b>으로 번져 온다.
     살 격자와 달리 darkPct(어두운 것 거르기)를 <b>안 쓴다</b>: 여기서 찾는 것은
     살이 아니라 "이 자리에 원래 뭐가 있었나"라서, 검은 니트를 걸러내면 안 된다.
     ⓘ 이 격자가 덮어쓰므로 타원 밖에서는 mirrorDetail 결과가 버려진다 —
       눈 윤곽이 사라지는 자리가 바로 거기다. 대신 그 구역은 결 없이 평평해진다.
       니트 짜임까지 살리려면 detailMix를 올린다(0이면 완전히 평평).
     되돌리기: HOLE_FILL.outerField.on = false (예전처럼 mirrorDetail 결과가 남는다) */
  outerField: {
    on: true,
    gridX: 64, gridY: 80,   // 격자 해상도(캔버스 전체 위 — 타원이 아니다)
    fillPasses: 160,        // 밖은 구멍이 크다(어깨까지) — 안쪽보다 넉넉히
    minCells: 0.04,         // 씨앗이 이보다 적으면 안 쓴다(폴백이 낫다)
    detailMix: 0.35,        // 메운 자리에 남길 고주파 비율. 0 = 완전히 평평
  },
  dirW: [0.4, 1.0, 2.6], // 위/가운데/아래 이웃 가중 — 살색이 두피로 타고 올라오게
  /* ── 두피 이식 (2026-08-03) ────────────────────────────────────────
     사용자: "머리두피면을 보면 까맣게 보여. 저기 채워지지 않은 자리는 헤어
     세그멘테이션 바깥쪽의 <b>이마 피부 픽셀</b>을 가져와서 옮겨심는 구조가
     있을거야. 그걸 연결해줘."
     맞다 — 구조는 이미 있었다(pickSkinPatch). 다만 <b>결(고주파)만</b> 얹고
     있었다: 그 자리의 <b>색</b>은 여전히 이웃 전파(fillHolesLowRes)가 정했고,
     정수리 근처는 이웃이 거의 전부 <b>배경(벽)</b>이라 흰 벽이, 뒤통수·목덜미
     쪽은 지워진 머리 경계의 어두운 값이 번져 들어왔다. 결만 얹어봐야 그 위에
     찍히는 미세 명암일 뿐이라 "두피면이 까맣다/허옇다"가 그대로 남는다.
     고침: 두상 안 구멍은 <b>색까지 이마 표본에서 가져온다</b>. 번져 들어온
     색은 색으로 안 쓰고 <b>밝기만</b>, 그것도 아래 범위로 <b>제한해서</b> 받는다
     (그늘은 남기되 벽의 흰색·머리의 검정으로는 절대 못 가게).
     ※ 소스와 대상이 같은 사람·같은 조명·같은 카메라라 색을 맞출 필요가 없다 —
       이게 원래 구멍 메움이 통했던 이유고, 그대로 적용된다. */
  graft: {
    on: true,          // false면 예전 동작(결만 얹기) — A/B용
    shadeMin: 0.72,    // 받아들일 밝기 배율 하한(제일 어두운 안쪽 겹)
    shadeMax: 1.12,    // 〃 상한(정수리 하이라이트) — 벽의 흰색이 여기서 잘린다
    edgeFeather: 0.14, // 두상 타원 가장자리 페더(반경 대비) — 이식이 뚝 끊기지 않게
    flatMix: 0.85,     // 표본을 못 떴을 때 두피색 쪽으로 끌어당기는 비율
  },
  /* ── 두상 안 잔재 회수 (2026-09-14) ──────────────────────────────────
     사용자: "adjust 후면사진 <b>타원 이내</b>인데 눈모양이 메워졌어. 다른
     부위들에 이식한 피부이식픽셀로 메워줘."
     원인 — 이식 루프의 첫 줄이 `if(!hole[...]) continue;`다. 즉 <b>헤어 마스크가
     지운 자리만</b> 메운다. 후면 사진에서 세그멘테이션이 놓친 머리 뭉치는
     지워지지 않아 <b>불투명</b>이고, 그래서 hole이 아니라 이식 대상에서 빠진다.
     더 나쁜 건 그게 인페인팅의 "아는 픽셀"로 쓰인다는 점이다 — dirW가 아래쪽
     이웃을 2.6배로 보므로 그 검정이 <b>아래로 길게 끌려</b> 내려간다. 화면에
     보이는 눈동자 + 속눈썹처럼 번진 자국이 정확히 그 스윕 자국이다.
     고침 — 두상 타원 <b>안</b>에서 "성한 살"보다 뚜렷하게 어두운 불투명 픽셀을
     구멍으로 <b>승격</b>시킨다. 승격은 인페인팅 <b>전</b>에 해야 한다(씨앗에서
     빼야 아래로 안 번진다). 그러면 그 자리는 다른 부위와 똑같은 경로 —
     살 격자(색) + 이마 표본(결) — 로 메워진다.
     ⚠ 정면·측면은 이목구비가 정당하게 타원 안에 있으므로 <b>얼굴 랜드마크가
       잡힌 뷰에서는 절대 돌지 않는다</b>(아래 게이트). 후면은 로그가 늘
       "landmarks none"이라 이 경로만 탄다. */
  residue: {
    on: true,
    /* ── 후면: 밝기가 아니라 <b>머리색</b>으로 잡는다 (2026-09-14 2차) ──────────
       사용자: "후면 타원 안에 아직 눈모양이 남아 있다. 전면·측면에 적용한
       피부 픽셀 이식을 후면 타원 안에도 똑같이 적용해라."
       1차(밝기 중앙값 × darkRatio)로는 후면에서 회수가 <b>취소</b>된다.
       긴 머리 후면은 타원 안 \"성한 살\"이 애초에 거의 없고(대부분 지운 구멍),
       세그가 놓친 머리 뭉치가 그 적은 표본의 절반 이상을 차지하기 때문에
       maxFrac(25%) 안전장치에 걸려 통째로 손을 안 댄다 — 그래서 눈처럼 보이는
       스윕 자국이 전면·측면과 달리 후면에만 남았다.
       고침: 머리 평균색(maskInf.avgColor, 구멍 마스크가 이미 쓰는 그 값)과
       가까운 불투명 픽셀은 <b>밝기와 무관하게</b> 잔재로 본다. 색으로 잡은 것은
       근거가 분명하므로 maxFrac 취소 대상에서 뺀다(밝기로만 잡은 것은 그대로
       maxFrac을 적용해 정면 얼굴 오작동을 막는다).
       되돌리기: HOLE_FILL.residue.byHair = false */
    byHair: true,
    hairTol: 78,       // 머리 평균색과의 채널당 평균 거리 한계(0~255) — 넘으면 살로 본다
    darkRatio: 0.80,   // 두상 안 살 밝기 중앙값 대비 이 배율보다 어두우면 <b>심지</b>
    softRatio: 0.93,   // 심지에 <b>붙어 있을 때만</b> 같이 데려갈 반그늘 상한(이력)
    growPx: 3,         // 어두운 심지만 지우면 둘레 흐린 띠가 남는다 — 부풀려 잡는다
    minSample: 400,    // 살 표본이 이보다 적으면 중앙값을 못 믿는다 → 손 안 댐
    maxFrac: 0.25,     // 성한 살 면적의 이 비율을 넘게 잡히면 판정 실패로 보고 취소
  },
  /* ── 얼굴 없는 뷰: 타원 안을 통째로 <b>이식</b>한다 (2026-09-14 3차) ──────────
     사용자: "뒷면 두상 타원 내 메움도 정면·측면처럼 <b>피부픽셀 이식</b>으로
     바꿔줘. 사람 눈 안 들어가게."

     ── 왜 2차(잔재 회수)로 부족했나 — 두 군데가 어긋나 있었다 ─────────────
     ① <b>승격이 화면에 반영되지 않았다.</b> markSkinResidue는 <b>축소한 사본</b>
        (downsampleFlagsMax의 결과)에만 OR 했다. 화면은 [메움 배경] 위에
        <b>baseC 정리본</b>을 얹어 만드는데, 그 정리본은 캐시된 <b>원본 해상도</b>
        마스크(getHoleMask)로 오려낸다. 사본만 고쳤으니 정리본은 그 자리를 여전히
        "성한 픽셀"로 보고 <b>원본 머리 잔재를 그대로 덮어 그렸다</b> — 아래에서
        아무리 곱게 메워도 위에 눈자국이 다시 올라온 것이다.
     ② <b>색·밝기를 그 사진에서 가져왔다.</b> 후면 타원 안은 성한 살이 거의 없어
        살 격자(skinField)의 씨앗이 결국 <b>세그가 놓친 머리 뭉치</b>다. 이식
        분기로 가도 밝기(sh)를 od에서 읽으니 스윕 자국이 <b>음영</b>으로 되살아난다.
        어느 쪽이든 원본의 어두운 무늬가 형태로 남는다.

     ── 고침: 얼굴 랜드마크가 없는 뷰는 타원 안을 <b>전부</b> 이식면으로 본다 ──
     후면 두상 타원 안에는 지워야 할 것(머리)과 두피뿐이고, <b>있어야 하는</b>
     어두운 자리(눈·눈썹·콧구멍)가 없다. 그러니 "어디가 잔재인지" 고를 이유가
     없다 — 타원 안을 통째로 구멍으로 넘기고, 색·결을 <b>다른 뷰 이마 표본</b>에서
     가져와 심는다. 그 위에 새 헤어가 그려지므로 두피가 통째로 새 것이어도 된다.
     · 구멍 승격을 <b>원본 해상도 마스크에도</b> 반영하고 baseC 정리본 캐시를
       무효화한다(위 ①). 이제 위에 얹히는 그림에서도 그 자리가 비워진다.
     · 색은 od를 <b>한 방울도</b> 안 쓴다. 표본 평균색 + 완만한 구면 음영뿐이라
       눈 모양이 들어올 경로 자체가 없다(위 ②).
     · 결은 표본 고주파를 쓰되 <b>이마 표본이고 평평할 때만</b>이다
       (skinField.flatTol) — 눈·눈썹은 고주파가 커서 여기서 걸린다.
     ⚠ 정면·측면은 랜드마크가 잡히므로 이 경로가 <b>절대</b> 돌지 않는다.
       거기는 이목구비가 정당하게 타원 안에 있다(지우면 얼굴이 사라진다).
     되돌리기: HOLE_FILL.facelessFill.on = false (2차 잔재 회수 동작으로 복귀) */
  /* ── 메움 색을 <b>얼굴 색</b>에 붙인다 (2026-09-16) ──────────────────────────
     사용자: "얼굴 색이랑 좀 더 가깝게 칠하고."
     녹화 프레임을 재 보니(HSV) 얼굴 볼 H23 S29 V85 · 이마 H26 S22 V86인데
     메움은 정면 관자놀이 <b>V70</b>(15%p 어두움) · 측면 귀 뒤 <b>S41</b>(12%p 진함)이었다.
     색조는 같고 밝기·채도만 갈렸다. 원인은 살 격자의 <b>씨앗 자리</b>다 — 타원 안에서
     구멍이 아닌 살은 대개 머리카락 경계 바로 옆(그늘진 관자·턱선·귀 뒤)이라, 번져
     나온 색이 얼굴 가운데보다 어둡고 진하다.
     고침: 얼굴 가운데 띠(눈썹~턱, 살색으로 보이는 픽셀의 밝기 50~88백분위 평균)를
     기준색으로 잡고, 격자 색을 그쪽으로 mix만큼 당긴다. 밝기 차는 shadeMin~Max
     안에서만 살려 그늘 결은 남긴다.
     되돌리기: HOLE_FILL.faceTone.on = false */
  faceTone: { on: true, mix: 0.75, shadeMin: 0.90, shadeMax: 1.04,
              loPct: 0.50, hiPct: 0.88, minSamples: 150 },
  /* ── 살색은 <b>두개골 안</b>에만 (2026-09-16) ────────────────────────────────
     사용자: "배경하고의 경계를 잘 잡으면, 두상밖으로 살색이 칠해지는 게 좀 덜 해질거 같아."
     지금 살 구역은 headEllipseFor — <b>헤어 실루엣</b> 밴드로 선 타원이다(폭 ×0.92).
     긴 머리 측면은 뒤로 흐른 머리까지 실루엣이라 타원이 뒤통수 뒤 허공까지 덮고,
     그 안의 구멍이 전부 살색이 됐다(측면 귀 뒤 반투명 살색 원판).
     고침: 3D 두개골(getDisplaySkullEllipsoid)을 <b>이 뷰의 viewCal로 되쏜 실루엣</b>을
     살 구역으로 쓴다. 헤어를 그리는 바로 그 투영이라 새 가닥의 뿌리와 살 경계가
     같은 자리에 선다. 타원 안이어도 두개골 밖인 구멍은 살이 아니라 <b>주변색 격자</b>
     (배경·옷)로 메우고, 경계는 featherFrac만큼 부드럽게 넘긴다.
     viewCal이 아직 없으면(모델 준비 전) 예전 타원 동작 그대로다 — 모델이 생기면
     캐시 서명이 바뀌어 한 번 다시 굽는다.
     되돌리기: HOLE_FILL.skullClip.on = false */
  /* ── 얼굴 없는 뷰(후면)는 <b>자르지 않는다</b> (2026-09-16 2차) ────────────────
     사용자: "후면 2D에서 두상타원 아랫부분이 투명하게 노출되는데 그냥 다 메움으로 되었으면 좋겠어."
     후면에는 얼굴 랜드마크가 없어 viewCal이 <b>실루엣 앵커</b>로 선다(로그: 뷰정렬 폭 ×0.87,
     실루엣맞춤 잔차 7.4% ⚠ 헐거움). 그 자로 되쏜 두개골은 사진의 두상보다 작고 위로 떠서,
     타원 <b>아랫부분</b>(뒤통수 아래·목덜미 위)이 "두개골 밖"으로 판정돼 주변색 격자 = 벽색으로
     칠해졌다(로그: 타원 안인데 두개골 밖이라 주변색으로 메운 픽셀 back 18934 · front 9049).
     벽색이라 화면에선 <b>구멍이 뚫린 것</b>처럼 보인다.
     skullClip이 막으려던 것은 긴 머리 <b>측면</b>에서 뒤로 흐른 머리까지 타원이 덮는 경우다.
     후면 타원 안은 전부 두피·지울 머리라 살 구역을 줄일 이유가 없다 — 타원 그대로 메운다.
     되돌리기: HOLE_FILL.skullClip.faceless = true (후면도 두개골 실루엣으로 자름) */
  skullClip: { on: true, grow: 1.04, featherFrac: 0.010, nPhi: 28, nTheta: 56, faceless: false },
  /* ── 얼굴 없는 뷰의 타원이 <b>어깨폭</b>이던 것 (2026-09-19) ──────────────────
     사용자: "후면에 보면 두상타원만 메우라고 했는데, 2D보면 무슨 불상처럼 목부터 경계까지 다 메워져 있어."
     타원의 nxMin/nxMax는 sectionBandsFor가 <b>scalpY가 있는 모든 컬럼</b>에서 뽑는다.
     긴 생머리는 어깨까지 흘러내린 컬럼에도 scalpY가 서므로, 후면에서 그 폭이 곧
     <b>머리카락 전체 폭</b>(≈어깨폭)이 된다 — ×0.92로 좁혀도 두개골보다 한참 넓다.
     그 타원 전체가 살색이 되고, 목 기둥도 반폭이 rx×halfK라 같이 벌어져서
     "목부터 경계까지" 살색 원판이 된다.
     정면·측면은 랜드마크가 있어 이 경로를 안 탄다(거기는 얼굴이 정당하게 타원 안이다).
     고침: 랜드마크가 없는 뷰에 한해 가로 반경을 <b>두상 비율</b>로 묶는다 —
     rx_px ≤ ry_px × maxAspect. 머리 가로폭 ÷ (정수리~목덜미) ≈ 0.9라 0.95는 여유 있는 상한이고,
     실루엣이 이미 좁으면(짧은 머리) min이라 아무 것도 안 바뀐다.
     ⚠ skullClip.faceless는 <b>계속 false</b>다 — 두개골로 자르면 2차 때처럼 타원 아래가
       다시 벽색으로 뚫린다. 여기서는 자르는 게 아니라 타원 자체를 두상 크기로 세운다.
     되돌리기: HOLE_FILL.headEllipse.facelessMaxAspect = null (실루엣 폭 그대로) */
  headEllipse: { facelessMaxAspect: 0.95 },
  facelessFill: {
    on: true,
    shrink: 0.97,      // 타원을 이 비율까지만 칠한다(타원이 조금 어긋나도 밖으로 안 샘)
    edgeShade: 0.12,   // 가장자리로 갈수록 살짝 어둡게 — 평평한 스티커처럼 안 보이게
    detail: 0.55,      // 이마 표본 고주파 세기(평평한 표본일 때만)
    /* ── 타원 아래가 <b>배경으로 비치던 것</b> (2026-09-16 3차) ─────────────────
       사용자: "2D 결과보기 후면에 두상타원 아래쪽이 투명하게 노출되어 있어. 그거까지 메워졌으면."
       2차(skullClip.faceless=false)로 두개골 자르기는 풀렸는데 녹화에서 그대로였다.
       프레임을 재 보니 원인은 둘이었다.
         ① <b>페더가 반경 비율</b>(graft.edgeFeather 0.14)이다 — r 0.86~1에서 이식이 인페인팅
            배경(=벽색)으로 선형으로 넘어간다. 타원 아래는 경계가 비스듬히 지나가 그
            띠가 세로로 길게 늘어져, 살이 <b>반투명</b>하게 벽에 녹는 것처럼 보였다
            (녹화 실측: 같은 열에서 살 126,110,97 → 30px 사이에 벽 219,220,225).
         ② 타원이 <b>뒤통수에서 끝난다</b>. 긴 머리를 지운 목덜미·목 자리는 타원 밖이라
            주변색 격자(벽)로 메워졌다 — 머리 밑으로 배경이 뚫려 보인다.
       고침: 얼굴 없는 뷰만 ① 페더를 <b>px 고정 폭</b>(featherFrac×출력폭)으로 얇게,
       ② 타원 아래에 <b>목 기둥</b>을 붙여 합집합을 같은 이식면으로 칠한다. 목 기둥은
       원래 머리였던 자리(hole)만 칠한다 — 사진에 보이던 옷·어깨는 안 건드린다.
       되돌리기: HOLE_FILL.facelessFill.cover = false (2차 동작) */
    cover: true,
    featherFrac: 0.010,   // 가장자리 페더 폭 = 출력폭 × 이 값(px 고정 — 아래쪽만 길게 늘어지지 않게)
    neck: { on: true,
            halfK: 0.60,  // 목 반폭 = 타원 rx × 이 값(rx는 헤어 실루엣×0.92라 두개골보다 넓다)
            lenK: 0.90,   // 타원 바닥에서 목 길이 = ry × 이 값(≈ 목 8~10cm)
            fadeK: 0.30,  // 그 아래 사라지는 구간 = ry × 이 값
            flare: 0.18 },// 아래로 갈수록 이만큼 넓어짐(승모근 쪽)
  },
};

/* 얼굴 없는 뷰의 이식 덮개 가중치(0~1, ow×oh) — 타원(px 페더) ∪ 목 기둥.
   반환 null이면 예전 동작. nNeck = 타원 밖인데 목 기둥이라 칠할 자리 수(구멍만). */
function buildFacelessCover(ow, oh, ell, hole){
  const FF = HOLE_FILL.facelessFill;
  if(!FF || !FF.cover || !ell) return null;
  const Rx = ell.rx*ow, Ry = ell.ry*oh, cxP = ell.cx*ow, cyP = ell.cy*oh;
  if(!(Rx > 2 && Ry > 2)) return null;
  const fp = Math.max(1.5, ow * (FF.featherFrac || 0.01));
  const N = FF.neck || {};
  const neckOn = !!N.on;
  const botP = cyP + Ry, lenP = (N.lenK||0)*Ry, fadeP = Math.max(1, (N.fadeK||0)*Ry);
  const w = new Float32Array(ow*oh);
  let nNeck = 0;
  for(let y=0; y<oh; y++){
    const dy = (y+0.5) - cyP;
    // 목 기둥 세로 가중(타원 가운데 아래부터)
    let wy = 0, half = 0;
    if(neckOn && dy >= 0){
      const below = (y+0.5) - botP;
      wy = below <= lenP ? 1 : Math.max(0, 1 - (below - lenP)/fadeP);
      const t = lenP > 0 ? Math.max(0, Math.min(1, below/lenP)) : 0;
      half = (N.halfK||0) * Rx * (1 + (N.flare||0)*t);
    }
    for(let x=0; x<ow; x++){
      const dx = (x+0.5) - cxP;
      const r = Math.sqrt((dx/Rx)*(dx/Rx) + (dy/Ry)*(dy/Ry));
      let we = 0;
      if(r < 1){
        const rp = Math.sqrt(dx*dx + dy*dy);
        const dist = r > 1e-6 ? (1 - r) * rp / r : Infinity;   // 광선 따라 경계까지 px
        we = Math.min(1, dist / fp);
      }
      let wn = 0;
      if(wy > 0){
        const ex = half - Math.abs(dx);
        if(ex > 0) wn = Math.min(1, ex / fp) * wy;
      }
      const p = y*ow + x;
      w[p] = we > wn ? we : wn;
      if(r >= 1 && wn > 0.002 && hole && hole[p]) nNeck++;
    }
  }
  w.nNeck = nNeck;
  return w;
}

/* 이식용 피부 표본 — 뷰별로 뜨고, 못 뜨면 <b>다른 뷰에서 뜬 것</b>을 재사용한다.
   후면처럼 얼굴이 아예 없는 뷰가 정확히 이 경우다(로그: "back 얼굴 감지 실패").
   같은 사람·같은 조명·같은 카메라라 뷰가 달라도 색을 맞출 필요가 없다. */
let _skinGraft = null;   // { rgb:Uint8ClampedArray(size*size*3), hi:Float32Array, size, lum, src }
const _fieldLogged = {}, _graftLogged = {};   // 뷰당 1회 로그 표시(재촬영 때 resetSkinGraft가 푼다)
function resetSkinGraft(){
  _skinGraft = null;
  /* (2026-09-12) 뷰당 1회 로그 표시도 같이 푼다 — 안 그러면 재촬영 뒤에
     격자가 못 서도 경고가 안 뜬다(예전에 이런 자리를 여러 번 놓쳤다). */
  for(const k in _fieldLogged) delete _fieldLogged[k];
  for(const k in _graftLogged) delete _graftLogged[k];
  for(const k in _residueLogged) delete _residueLogged[k];   // (2026-09-14) 잔재회수 진단도 같이
  for(const k in _facelessLogged) delete _facelessLogged[k]; // (2026-09-14 3차) 전면이식 진단도 같이
  for(const k in _skullClipLogged) delete _skullClipLogged[k]; // (2026-09-16) 두상경계 진단도 같이
}

// 뷰의 두상 영역(정규 좌표) — 정수리~턱을 감싸는 타원. 없으면 null.
const _headEllipseCapLogged = {};
function headEllipseFor(angle){
  const b = sectionBandsFor(angle);
  if(!b) return null;
  const top = b.headTopY;
  const bot = (typeof b.chinLineY === 'number') ? b.chinLineY : b.napeTopY;
  if(!(bot > top)) return null;
  const cx = (b.nxMin + b.nxMax) / 2;
  // 실루엣에는 머리숱이 포함돼 있어 두개골보다 넓다 — 조금 좁혀 잡는다.
  let rx = Math.max(0.02, (b.nxMax - b.nxMin) / 2 * 0.92);
  const ry = (bot - top) / 2;
  /* (2026-09-19) 얼굴 없는 뷰는 실루엣 폭이 어깨폭이라 두상 비율로 묶는다 — 위 headEllipse 배너.
     rx·ry는 정규화 좌표(가로는 폭, 세로는 높이 기준)라 px로 비교하려면 사진 비율을 곱해야 한다. */
  const maxAspect = HOLE_FILL.headEllipse && HOLE_FILL.headEllipse.facelessMaxAspect;
  const hasFace = !!(typeof state !== 'undefined' && state.landmarks && state.landmarks[angle]);
  if(!hasFace && maxAspect > 0){
    const img = (typeof imgCache !== 'undefined') ? imgCache[angle] : null;
    const iw = img && (img.naturalWidth || img.width), ih = img && (img.naturalHeight || img.height);
    if(iw && ih){
      const rxMax = ry * maxAspect * (ih / iw);
      if(rx > rxMax){
        if(!_headEllipseCapLogged[angle]){
          _headEllipseCapLogged[angle] = true;
          console.log('[메움·두상타원] ' + angle + ': 실루엣 rx ' + rx.toFixed(3)
            + ' → 두상 상한 ' + rxMax.toFixed(3) + ' (×' + maxAspect + ')');
        }
        rx = rxMax;
      }
    }
  }
  return { cx, cy: (top + bot) / 2, rx, ry };
}

/* 얼굴에서 깨끗한 피부 표본을 찾는다(불투명 + 피부색에 가까운 정사각 영역).

   ── 후보 자리 (2026-08-03 수정) ────────────────────────────────────
   주석은 예전부터 "볼 → 턱 → <b>이마</b>"라고 적혀 있었는데 후보 좌표에는
   <b>이마가 아예 없었다</b> — dy가 전부 0 이상(=두상 중심보다 아래)이라
   제일 위가 dy 0.10, 눈 언저리였다. 이식 대상이 <b>두피</b>인데 표본을 볼·턱에서
   뜨면 그림자·수염·턱선 명암이 같이 따라온다. 두피 바로 옆에 붙어 있고 결이
   가장 비슷한 <b>이마</b>(dy 음수 = 중심보다 위)를 후보에 넣고 우대한다.
   ※ 이마 밴드는 앞머리가 걸치기 쉬운 자리라 구멍(투명)이 섞이면 아래
     "불투명 98%" 조건에서 자동으로 탈락한다 — 우대해도 안전하다. */
const SKIN_PATCH_CANDS = [
  // [dx, dy, 우대점수] — 두상 타원 중심 기준(dy<0 = 위쪽 = 이마)
  [ 0.00, -0.28, 0.25], [-0.28, -0.24, 0.22], [ 0.28, -0.24, 0.22],
  [ 0.00, -0.16, 0.20], [-0.40, -0.10, 0.15], [ 0.40, -0.10, 0.15],
  [ 0.00,  0.15, 0.05], [-0.35,  0.10, 0.05], [ 0.35,  0.10, 0.05],
  [-0.55,  0.35, 0.00], [ 0.55,  0.35, 0.00], [-0.50, 0.60, 0.00],
  [ 0.50,  0.60, 0.00], [ 0.00,  0.70, 0.00],
];
function pickSkinPatch(ctx, W, H, ell, skinRGB, size){
  if(!ell) return null;
  const cands = [];
  for(const [dx, dy, bonus] of SKIN_PATCH_CANDS){
    const px = Math.round((ell.cx + ell.rx*dx) * W - size/2);
    const py = Math.round((ell.cy + ell.ry*dy) * H - size/2);
    if(px < 0 || py < 0 || px+size > W || py+size > H) continue;
    const d = ctx.getImageData(px, py, size, size).data;
    let opaque=0, near=0;
    for(let i=0;i<d.length;i+=4){
      if(d[i+3] < 200) continue;
      opaque++;
      const dist = Math.abs(d[i]-skinRGB[0]) + Math.abs(d[i+1]-skinRGB[1]) + Math.abs(d[i+2]-skinRGB[2]);
      if(dist < HOLE_FILL.skinTol) near++;
    }
    const total = size*size;
    if(opaque < total*0.98) continue;            // 구멍이 섞이면 못 씀
    // score = 순수 "피부다움"(합격 판정용), rank = 거기에 이마 우대를 얹은 정렬 키.
    // 우대점수로 <b>합격선을 넘기지는 않게</b> 둘을 분리한다(머리카락 패치 방지).
    /* dy<0 = 이마. 어느 자리에서 떴는지를 <b>들고 나간다</b> (2026-08-11).
       여태 이 정보를 버려서, 로그가 어느 후보가 뽑혔든 "이마 표본"이라고 찍었다.
       그래서 눈 언저리에서 떠 와도 아무도 몰랐다. */
    cands.push({ px, py, dx, dy, forehead: dy < 0, score: near/total, rank: near/total + bonus });
  }
  if(!cands.length) return null;
  cands.sort((a,b)=> b.rank - a.rank);
  const best = cands.find(c => c.score > 0.5);   // 절반도 피부색이 아니면 못 씀
  return best || null;
}

/* ── 살 색 격자 (2026-09-12) ─────────────────────────────────────────
   두상 타원 안에서 <b>구멍이 아니고 충분히 밝은</b> 픽셀만 모아 격자 평균을
   내고, 빈 칸을 이웃으로 번지게 한다. 구멍 픽셀은 나중에 제 자리 색을 집는다.
   눈·눈썹·입은 darkPct 아래로 떨어져 애초에 안 들어오고, 그 자리는 번지기가
   주변 살로 메운다 — 12a SCALP_SKIN의 3패스와 같은 구조다.
   od는 <b>고치기 전</b> 픽셀이어야 한다(이식 루프보다 먼저 부를 것). */
/* 타원 밖 구멍에 주변색을 칠한다. 고주파는 detailMix만큼 남긴다 —
   0이면 완전히 평평하고, 올리면 니트 짜임·배경 입자가 조금 돌아온다.
   ⚠ mirrorDetail이 넣은 고주파에는 <b>눈 윤곽</b>이 섞여 있을 수 있다.
     detailMix를 올린다는 것은 그것도 같이 돌아온다는 뜻이다(그래서 기본이 낮다). */
/* 두개골 실루엣 가중치(0~1, ow×oh). viewCal이 없으면 null — 호출부는 예전 타원 동작. */
function skullClipCal(angle){
  const S = HOLE_FILL.skullClip;
  if(!S || !S.on || typeof state === 'undefined') return null;
  if(!S.faceless && !(state.landmarks && state.landmarks[angle])) return null;   // 얼굴 없는 뷰 = 타원 그대로(위 배너)
  const m = state.hair3Dneutral;
  const vc = m && m.viewCal;
  if(!vc || !vc[angle]) return null;
  const cal = (typeof calForDraw === 'function') ? calForDraw(m, angle) : vc[angle];   // 그리기와 같은 자
  if(!cal || !isFinite(cal.s) || !isFinite(cal.sy) || !isFinite(cal.cx)) return null;
  return { m, cal };
}
function skullClipSig(angle){
  const k = skullClipCal(angle);
  if(!k) return 'none';
  const S = HOLE_FILL.skullClip;
  return [k.cal.cx.toFixed(1), k.cal.s.toFixed(5), k.cal.sy.toFixed(5), (k.cal.yaw||0).toFixed(3),
          S.grow, S.featherFrac].join('|');
}
function buildSkullClipWeight(angle, ow, oh, imgW, imgH){
  const k = skullClipCal(angle);
  if(!k || !(imgW > 0) || !(imgH > 0)) return null;
  if(typeof getDisplaySkullEllipsoid !== 'function' || typeof project3DPointToView !== 'function') return null;
  const S = HOLE_FILL.skullClip;
  let sk; try{ sk = getDisplaySkullEllipsoid(); }catch(e){ return null; }
  if(!sk || !(sk.a > 0) || !(sk.b > 0) || !(sk.c > 0)) return null;
  const CY = (k.m.CY != null) ? k.m.CY : 0.15;
  const a = sk.a*S.grow, b = sk.b*S.grow, c = sk.c*S.grow;
  const pts = [];
  for(let i=0; i<=S.nPhi; i++){
    const phi = i / S.nPhi * Math.PI;
    for(let j=0; j<S.nTheta; j++){
      const th = j / S.nTheta * 2*Math.PI;
      const w = { x: a*Math.sin(phi)*Math.sin(th), y: CY + b*Math.cos(phi), z: c*Math.sin(phi)*Math.cos(th) };
      const pr = project3DPointToView(w, k.cal, k.m.yTop, CY);
      if(!isFinite(pr.ix) || !isFinite(pr.iy)) continue;
      pts.push([pr.ix / imgW * ow, pr.iy / imgH * oh]);
    }
  }
  if(pts.length < 8) return null;
  // 정사영 타원체의 실루엣은 볼록 — 볼록 껍질이면 충분하다
  pts.sort((p,q)=> p[0]-q[0] || p[1]-q[1]);
  const cross = (o,p,q)=> (p[0]-o[0])*(q[1]-o[1]) - (p[1]-o[1])*(q[0]-o[0]);
  const lo = [], up = [];
  for(const p of pts){ while(lo.length>=2 && cross(lo[lo.length-2], lo[lo.length-1], p) <= 0) lo.pop(); lo.push(p); }
  for(let i=pts.length-1;i>=0;i--){ const p=pts[i]; while(up.length>=2 && cross(up[up.length-2], up[up.length-1], p) <= 0) up.pop(); up.push(p); }
  const hull = lo.slice(0,-1).concat(up.slice(0,-1));
  if(hull.length < 3) return null;
  const mc = document.createElement('canvas'); mc.width = ow; mc.height = oh;
  const mx = mc.getContext('2d', { willReadFrequently:true });
  const fpx = Math.max(1, ow * S.featherFrac);
  mx.filter = 'blur(' + fpx.toFixed(1) + 'px)';
  mx.fillStyle = '#fff';
  mx.beginPath(); mx.moveTo(hull[0][0], hull[0][1]);
  for(let i=1;i<hull.length;i++) mx.lineTo(hull[i][0], hull[i][1]);
  mx.closePath(); mx.fill();
  mx.filter = 'none';
  const d = mx.getImageData(0, 0, ow, oh).data;
  const wgt = new Float32Array(ow*oh);
  let nIn = 0;
  for(let p=0, i=3; p<wgt.length; p++, i+=4){ wgt[p] = d[i]/255; if(d[i] > 127) nIn++; }
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(const q of hull){ if(q[0]<minX)minX=q[0]; if(q[0]>maxX)maxX=q[0]; if(q[1]<minY)minY=q[1]; if(q[1]>maxY)maxY=q[1]; }
  wgt.nIn = nIn;
  wgt.box = { x0:minX/ow, x1:maxX/ow, y0:minY/oh, y1:maxY/oh };
  return wgt;
}

/* 얼굴 가운데 띠의 기준 살색 [r,g,b] 또는 null. 랜드마크가 없는 뷰는 null. */
function faceToneRefFor(od, ow, oh, hole, ell, angle){
  const T = HOLE_FILL.faceTone;
  if(!T || !T.on || !ell || typeof state === 'undefined') return null;
  const lm = state.landmarks && state.landmarks[angle];
  if(!lm) return null;
  const y0 = (typeof lm.browTopY === 'number') ? lm.browTopY : ell.cy - ell.ry*0.4;
  const y1 = (typeof lm.chinY === 'number') ? lm.chinY : ell.cy + ell.ry*0.6;
  if(!(y1 > y0)) return null;
  const step = Math.max(1, Math.round(Math.min(ow, oh) / 200));
  const L = [], R = [], Gc = [], B = [];
  for(let y=Math.max(0,Math.floor(y0*oh)); y<Math.min(oh,Math.ceil(y1*oh)); y+=step){
    const v = ((y+0.5)/oh - ell.cy)/ell.ry, v2 = v*v;
    if(v2 > 1) continue;
    for(let x=0; x<ow; x+=step){
      const u = ((x+0.5)/ow - ell.cx)/ell.rx;
      if(u*u + v2 > 0.81) continue;              // 가장자리(머리 경계 그늘)는 안 본다
      if(hole[y*ow+x]) continue;
      const i = (y*ow+x)*4;
      if(od[i+3] < 200) continue;
      const r = od[i], g = od[i+1], b = od[i+2];
      if(!(r > g && g >= b*0.92 && r - b > 18)) continue;   // 살색처럼 보이는 것만(흰 벽·검은 눈썹 제외)
      L.push(0.299*r + 0.587*g + 0.114*b); R.push(r); Gc.push(g); B.push(b);
    }
  }
  if(L.length < T.minSamples) return null;
  const idx = L.map((_,i)=>i).sort((p,q)=> L[p]-L[q]);
  const iA = Math.floor(idx.length*T.loPct), iB = Math.max(iA+1, Math.floor(idx.length*T.hiPct));
  let r=0,g=0,b=0,n=0;
  for(let k=iA;k<iB;k++){ const i=idx[k]; r+=R[i]; g+=Gc[i]; b+=B[i]; n++; }
  if(!n) return null;
  const ref = [r/n, g/n, b/n];
  ref.samples = L.length;
  return ref;
}
const _skullClipLogged = {};
function logSkullClipOnce(angle, skullW, tone, nBg, ow, oh){
  if(_skullClipLogged[angle]) return;
  _skullClipLogged[angle] = true;
  const toneTxt = tone ? ('rgb(' + tone.map(v=>Math.round(v)).join(',') + ') · 표본 ' + tone.samples
                          + ' · 당김 ' + Math.round(HOLE_FILL.faceTone.mix*100) + '%')
                       : '<b>없음</b>(랜드마크 없음/표본 부족 — 격자 색 그대로)';
  console.log(...gyeolBoldArgs(['[메움·두상경계] ' + angle
    + ' · 살 구역 ' + (skullW ? '<b>두개골 되쏜 실루엣</b>(' + skullW.nIn + 'px, ×' + HOLE_FILL.skullClip.grow + ')'
                              : (!HOLE_FILL.skullClip.faceless && !(state.landmarks && state.landmarks[angle])
                                   ? '헤어 실루엣 타원(<b>얼굴 없는 뷰 — 두개골로 안 자르고 타원 안을 전부 메움</b>)'
                                   : '헤어 실루엣 타원(viewCal 없음 — 예전 동작)'))
    + ' · 타원 안인데 두개골 밖이라 주변색으로 메운 픽셀 ' + nBg
    + '\n    얼굴 기준색 ' + toneTxt
    + '\n    되돌리기: HOLE_FILL.skullClip.on=false · HOLE_FILL.faceTone.on=false']));
}

function paintOuterHoles(od, ow, oh, hole, ell, outer){
  const mixK = Math.max(0, Math.min(1, HOLE_FILL.outerField.detailMix));
  const c = [0,0,0];
  let n = 0;
  for(let y=0; y<oh; y++){
    const ny = (y + 0.5)/oh;
    const v = ell ? (ny - ell.cy)/ell.ry : 9;
    const v2 = v*v;
    for(let x=0; x<ow; x++){
      const p = y*ow + x;
      if(!hole[p]) continue;
      const nx = (x + 0.5)/ow;
      if(ell){
        const u = (nx - ell.cx)/ell.rx;
        if(u*u + v2 <= 1) continue;            // 두상 안 — 살 격자가 이미 칠했다
      }
      outer.at(nx, ny, c);
      const i = p*4;
      /* 고주파만 남긴다: (현재 − 그 자리 평균)이 결이고, 색은 격자가 정한다.
         평균을 od에서 다시 구하지 않고 격자 값을 쓰는 이유는, od가 이미
         mirrorDetail로 오염돼 있어 거기서 평균을 내면 오염이 색으로 승격된다. */
      for(let ch=0; ch<3; ch++){
        const detail = mixK > 0 ? (od[i+ch] - c[ch]) * mixK : 0;
        od[i+ch] = Math.max(0, Math.min(255, c[ch] + detail));
      }
      od[i+3] = 255;
      n++;
    }
  }
  return n;
}

let _outerFieldLogged = {};
function logOuterFieldOnce(angle, outer, nPix, ow, oh, why){
  if(_outerFieldLogged[angle]) return;
  _outerFieldLogged[angle] = true;
  if(!outer){
    console.log('[메움·두상밖] ' + angle + ' — 주변색 격자 <b>못 세움</b>'
      + (why ? '(' + why + ')' : '(씨앗 부족)') + ' → 예전처럼 mirrorDetail 결과가 남습니다.');
    return;
  }
  console.log(...gyeolBoldArgs(['[메움·두상밖] ' + angle + ' · 격자 ' + outer.GX + '×' + outer.GY
    + ' · 씨앗 ' + outer.seeded + '칸 → 번져서 ' + outer.filled + '칸(' + outer.passes + '회)'
    + ' · 칠한 픽셀 <b>' + nPix + '</b>/' + (ow*oh)
    + (why ? ' · ' + why : '')
    + '\n    두상 <b>밖</b>(목·어깨·옷·배경)은 살색이 아니라 <b>제 자리 주변색</b>으로 메웁니다.'
    + ' 여기가 예전에 mirrorDetail의 거울 결이 그대로 남아 <b>눈 윤곽</b>이 반복되던 자리입니다.'
    + '\n    칠한 픽셀이 0이면 구멍이 전부 두상 안이라는 뜻이고(짧은 머리), 크면 긴 머리를 줄인 것입니다.'
    + '\n    되돌리기: HOLE_FILL.outerField.on=false']));
}

/* 타원 <b>밖</b> 주변색 격자 — 위 HOLE_FILL.outerField 배너 참고.
   살 격자와 같은 3패스지만 두 가지가 다르다:
     · 씨앗을 <b>타원 밖</b>에서만 모은다(안쪽 살이 어깨로 새어 나오면 안 된다)
     · 어두운 것을 <b>안 거른다</b>(검은 니트도 정답이다 — 찾는 게 살이 아니다)
   격자 좌표는 타원이 아니라 <b>캔버스 전체</b> 기준이라, ell이 null이어도 선다. */
function buildOuterField(od, ow, oh, hole, ell, skullW){
  const F = HOLE_FILL.outerField;
  if(!F || !F.on) return null;
  const GX = Math.max(4, F.gridX|0), GY = Math.max(4, F.gridY|0);
  const step = Math.max(1, Math.round(Math.min(ow, oh) / 220));
  const r = new Float32Array(GX*GY), g = new Float32Array(GX*GY), b = new Float32Array(GX*GY);
  const n = new Float32Array(GX*GY);
  const isOutside = (x, y)=>{
    if(!ell) return true;
    // (2026-09-16) 타원 안이어도 두개골 밖이면 배경·옷 씨앗이다
    if(skullW && skullW[y*ow + x] < 0.2) return true;
    const u = ((x+0.5)/ow - ell.cx)/ell.rx, v = ((y+0.5)/oh - ell.cy)/ell.ry;
    return u*u + v*v > 1;
  };
  let seeded = 0;
  for(let y=0; y<oh; y+=step) for(let x=0; x<ow; x+=step){
    if(hole[y*ow + x]) continue;                 // 지운 자리는 씨앗이 아니다
    if(!isOutside(x, y)) continue;               // 두상 안은 살 격자가 맡는다
    const i = (y*ow+x)*4;
    if(od[i+3] < 200) continue;
    const k = Math.min(GY-1, Math.floor(y/oh*GY))*GX + Math.min(GX-1, Math.floor(x/ow*GX));
    r[k]+=od[i]; g[k]+=od[i+1]; b[k]+=od[i+2]; n[k]++;
  }
  for(let i=0;i<GX*GY;i++){ if(n[i] > 0){ r[i]/=n[i]; g[i]/=n[i]; b[i]/=n[i]; n[i]=1; seeded++; } }
  if(seeded < GX*GY*F.minCells) return null;
  let filled = seeded, passes = 0;
  for(; passes<F.fillPasses; passes++){
    let changed = 0;
    const nr=r.slice(), ng=g.slice(), nb=b.slice(), nn=n.slice();
    for(let gy=0; gy<GY; gy++) for(let gx=0; gx<GX; gx++){
      const i = gy*GX+gx;
      if(n[i] > 0) continue;
      let sr=0,sg=0,sb=0,k=0;
      if(gx>0    && n[i-1] >0){ sr+=r[i-1];  sg+=g[i-1];  sb+=b[i-1];  k++; }
      if(gx<GX-1 && n[i+1] >0){ sr+=r[i+1];  sg+=g[i+1];  sb+=b[i+1];  k++; }
      if(gy>0    && n[i-GX]>0){ sr+=r[i-GX]; sg+=g[i-GX]; sb+=b[i-GX]; k++; }
      if(gy<GY-1 && n[i+GX]>0){ sr+=r[i+GX]; sg+=g[i+GX]; sb+=b[i+GX]; k++; }
      if(k){ nr[i]=sr/k; ng[i]=sg/k; nb[i]=sb/k; nn[i]=1; changed++; }
    }
    if(!changed) break;
    r.set(nr); g.set(ng); b.set(nb); n.set(nn);
    filled += changed;
  }
  return {
    GX, GY, r, g, b, seeded, filled, passes,
    at(nx, ny, out){
      const fx = Math.min(this.GX-1, Math.max(0, nx*this.GX - 0.5));
      const fy = Math.min(this.GY-1, Math.max(0, ny*this.GY - 0.5));
      const x0 = Math.floor(fx), y0 = Math.floor(fy);
      const x1 = Math.min(this.GX-1, x0+1), y1 = Math.min(this.GY-1, y0+1);
      const tx = fx-x0, ty = fy-y0;
      const I = (xx,yy)=> yy*this.GX + xx;
      const mix = A => A[I(x0,y0)]*(1-tx)*(1-ty) + A[I(x1,y0)]*tx*(1-ty)
                     + A[I(x0,y1)]*(1-tx)*ty     + A[I(x1,y1)]*tx*ty;
      out[0]=mix(this.r); out[1]=mix(this.g); out[2]=mix(this.b);
      return out;
    },
  };
}

/* 두상 타원 안을 통째로 구멍으로 넘긴다(얼굴 없는 뷰 전용).
   해상도와 무관하게 <b>정규 좌표</b>로 계산하므로, 출력 해상도 사본과 원본
   해상도 마스크 양쪽에 같은 모양으로 찍을 수 있다 — 둘이 어긋나면 위에 얹히는
   baseC가 그 차이만큼 원본 머리 잔재를 다시 덮어 그린다(그게 2차의 실패였다). */
function markEllipseHole(hole, w, h, ell, shrink){
  if(!ell) return 0;
  const k = (shrink > 0 ? shrink : 1);
  const k2 = k*k;
  let n = 0;
  for(let y=0; y<h; y++){
    const v = ((y+0.5)/h - ell.cy)/ell.ry, v2 = v*v;
    if(v2 > k2) continue;
    for(let x=0; x<w; x++){
      const u = ((x+0.5)/w - ell.cx)/ell.rx;
      if(u*u + v2 > k2) continue;
      const p = y*w + x;
      if(!hole[p]){ hole[p] = 1; n++; }
    }
  }
  return n;
}

/* 두상 안에 남은 "살이 아닌 불투명 덩어리"를 구멍으로 승격시킨다.
   holeA — 원본을 출력 해상도로 다시 그린 RGBA(구멍은 알파 0).
   hole  — 승격 결과를 여기에 직접 OR 한다(이 함수가 유일한 부작용).
   반환   { n, cut, med, cancelled } — 진단용. 안 돈 경우 null. */
function markSkinResidue(holeA, ow, oh, hole, ell, angle, hairRGB){
  const R = HOLE_FILL.residue;
  if(!R || !R.on || !ell) return null;
  const useHair = !!(R.byHair && hairRGB);
  /* 게이트 — 얼굴이 잡힌 뷰는 눈·눈썹·콧구멍이 <b>있어야 하는</b> 어두운 자리다.
     여기서 한 번이라도 헷갈리면 정면 얼굴을 살색으로 밀어버린다. */
  if(typeof state !== 'undefined' && state.landmarks && state.landmarks[angle]){
    return { n: 0, gated: true };
  }
  const step = Math.max(1, Math.round(Math.min(ow, oh) / 220));
  const inEll = (x, y, v2)=>{ const u = ((x+0.5)/ow - ell.cx)/ell.rx; return u*u + v2 <= 1; };

  // ① 두상 안 "성한 살"의 밝기 중앙값 — 구멍(지운 머리)은 살이 아니므로 뺀다
  const lums = [];
  for(let y=0; y<oh; y+=step){
    const v = ((y+0.5)/oh - ell.cy)/ell.ry, v2 = v*v;
    if(v2 > 1) continue;
    for(let x=0; x<ow; x+=step){
      if(!inEll(x, y, v2)) continue;
      const p = y*ow + x;
      if(hole[p]) continue;
      const i = p*4;
      if(holeA[i+3] < 200) continue;
      lums.push(0.299*holeA[i] + 0.587*holeA[i+1] + 0.114*holeA[i+2]);
    }
  }
  /* 표본이 얇아도 <b>머리색 경로는 돈다</b> — 긴 머리 후면은 타원 안이 거의 다
     구멍이라 표본이 원래 얇다. 여기서 돌려보내면 후면만 영영 안 고쳐진다.
     밝기 기준(med/cut)만 못 세우는 것이므로, 그건 끄고 색으로만 간다. */
  const thin = lums.length < R.minSample;
  if(thin && !useHair) return { n: 0, thin: lums.length };
  lums.sort((a,b)=>a-b);
  const med = thin ? 0 : lums[lums.length >> 1];
  const cut = thin ? -1 : med * R.darkRatio;      // -1 = 밝기로는 아무것도 안 잡음
  const soften = thin ? -1 : med * R.softRatio;

  // ② 어두운 잔재 표시
  const mark = new Uint8Array(ow*oh);   // 심지(확실히 어두움)
  const soft = new Uint8Array(ow*oh);   // 반그늘(애매함 — 심지에 붙어 있을 때만 쓴다)
  let n = 0, area = 0, nHair = 0, nDark = 0;
  for(let y=0; y<oh; y++){
    const v = ((y+0.5)/oh - ell.cy)/ell.ry, v2 = v*v;
    if(v2 > 1) continue;
    for(let x=0; x<ow; x++){
      if(!inEll(x, y, v2)) continue;
      const p = y*ow + x;
      if(hole[p]) continue;
      const i = p*4;
      if(holeA[i+3] < 200) continue;
      area++;                                   // 분모는 <b>성한 살</b>만(구멍은 뺀다)
      const L = 0.299*holeA[i] + 0.587*holeA[i+1] + 0.114*holeA[i+2];
      /* ⓐ 머리색이면 밝기와 무관하게 잔재다 — 이게 후면을 살리는 줄이다.
         (같은 사진·같은 조명이라 avgColor와의 거리만으로 충분하다. 구멍
          마스크의 테두리 회수가 이미 같은 판정을 쓰고 있다.) */
      if(useHair){
        const dH = (Math.abs(holeA[i]-hairRGB[0]) + Math.abs(holeA[i+1]-hairRGB[1])
                  + Math.abs(holeA[i+2]-hairRGB[2])) / 3;
        if(dH <= R.hairTol){ mark[p] = 1; n++; nHair++; continue; }
      }
      if(L < cut){ mark[p] = 1; n++; nDark++; }
      else if(L < soften) soft[p] = 1;
    }
  }
  if(!n) return { n: 0, med, cut, thin: thin ? lums.length : null };
  /* ③ 안전장치 — 사진이 통째로 어둡거나 타원이 잘못 잡히면 여기서 절반이
     걸린다. 그건 "잔재"가 아니라 판정 실패다 — 손대지 않는 편이 낫다.
     단 <b>머리색으로 잡은 몫은 분자에서 뺀다</b>: 그건 "어두워서"가 아니라
     "머리색이라서" 잡힌 것이고, 후면은 그 몫이 원래 절반을 넘는다(그래서
     1차 때 통째로 취소돼 눈자국이 남았다). 밝기로만 잡은 몫에만 한계를 건다. */
  if(area && nDark/area > R.maxFrac){
    if(nHair){                                   // 색 근거는 살리고 밝기 몫만 버린다
      // 밝기로만 잡은 픽셀을 되돌린다
      for(let y=0; y<oh; y++){
        const v = ((y+0.5)/oh - ell.cy)/ell.ry, v2 = v*v;
        if(v2 > 1) continue;
        for(let x=0; x<ow; x++){
          const p = y*ow+x; if(!mark[p]) continue;
          const i = p*4;
          const dH = useHair ? (Math.abs(holeA[i]-hairRGB[0]) + Math.abs(holeA[i+1]-hairRGB[1])
                              + Math.abs(holeA[i+2]-hairRGB[2]))/3 : 999;
          if(dH > R.hairTol) mark[p] = 0;
        }
      }
      n = nHair;
    } else return { n: 0, med, cut, cancelled: n, frac: n/area };
  }

  /* ④ 번짐 — 눈자국은 심지(검정)보다 <b>흐린 띠</b>가 훨씬 넓다. 심지만 지우면
     그 띠가 고스란히 남아 여전히 눈처럼 보인다. 그렇다고 임계를 올리면 정수리
     그늘·목덜미 그늘까지 먹는다. 그래서 <b>이력(hysteresis)</b>으로 간다:
     심지를 몇 px 부풀린 범위 <b>안에서만</b> 반그늘(soften 미만)을 같이 데려간다.
     심지에서 떨어져 있는 그늘은 그냥 그늘이므로 건드리지 않는다. */
  const grow = Math.max(1, Math.round(R.growPx * ow / 900));
  const near = mark.slice();
  dilateFlags(near, ow, oh, grow);
  for(let p=0; p<mark.length; p++) if(near[p] && soft[p]) mark[p] = 1;
  dilateFlags(mark, ow, oh, grow);   // 최종 경계 한 겹 — 이식이 뚝 끊기지 않게
  let total = 0;
  for(let y=0; y<oh; y++){
    const v = ((y+0.5)/oh - ell.cy)/ell.ry, v2 = v*v;
    if(v2 > 1) continue;
    for(let x=0; x<ow; x++){
      const p = y*ow + x;
      if(!mark[p] || hole[p]) continue;
      if(!inEll(x, y, v2)) continue;   // 부풀림이 타원 밖으로 새지 않게
      hole[p] = 1; total++;
    }
  }
  return { n: total, core: n, med, cut, area, nHair, nDark, thin: thin ? lums.length : null };
}

/* [진단] 얼굴 없는 뷰 전면 이식 — 뷰당 1회.
   "후면에 아직 눈모양이 보인다"가 다시 오면 이 한 줄로 갈린다:
     · 안 돎(표본 없음) → 정면을 다시 찍어 이마 표본을 확보해야 한다
     · 돌았는데 baseC 0 → 원본 해상도 마스크 동기화가 깨진 것(위에 원본이 덮인다)
     · 돌았고 둘 다 큼  → 이식은 먹었다. 남은 무늬는 타원 <b>밖</b>이다(outerField) */
const _facelessLogged = {};
function logFacelessOnce(angle, diag, graft, noFace, ell, ow, oh){
  if(!angle || _facelessLogged[angle]) return;
  _facelessLogged[angle] = true;
  const FF = HOLE_FILL.facelessFill;
  if(!FF || !FF.on) return;
  if(!noFace) return;                       // 정면·측면 — 이 경로는 원래 안 돈다
  if(!ell){ console.warn(`[전면이식] ${angle}: 두상 타원이 없어 못 돕니다(섹션 밴드 미확보)`); return; }
  if(!diag){
    console.warn(...gyeolBoldArgs([`[전면이식] ${angle}: <b>안 돌았습니다</b> — 이마 표본이 없습니다`
      + `(이 뷰엔 얼굴이 없고, 다른 뷰에서 보관된 이마 표본도 없음)`
      + `\n      정면을 다시 찍어 이마가 드러나면 그 표본이 후면으로 넘어옵니다.`]));
    return;
  }
  console.log(...gyeolBoldArgs([`[전면이식] ${angle}: 얼굴 랜드마크 없음 → 두상 타원 안(${(FF.shrink*100)|0}%)을`
    + ` <b>통째로 이식면</b>으로 넘겼습니다 · 메움판 ${diag.nIn}px 승격 / baseC ${diag.nBase}px 승격`
    + ` · ${ow}×${oh}`
    + (diag.nNeck != null ? `\n      덮개: 페더 px 고정(${((FF.featherFrac||0)*ow).toFixed(1)}px) · 타원 아래 <b>목 기둥 ${diag.nNeck}px</b> 추가 이식`
                            + ` (되돌리기 HOLE_FILL.facelessFill.cover=false)` : '')
    + `\n      색은 이마 표본 평균 rgb(${graft && graft.mean ? graft.mean.join(',') : '?'})`
    + `(출처 ${graft ? graft.src : '?'}) + 구면 음영 ${(FF.edgeShade*100)|0}%,`
    + ` 이 뷰 사진의 픽셀은 <b>색으로도 밝기로도 안 씁니다</b> — 눈모양이 들어올 경로가 없습니다.`
    + `\n      되돌리기: HOLE_FILL.facelessFill.on=false`]));
  if(diag.hadHm && !diag.nBase){
    console.warn(`[전면이식] ${angle}: baseC 승격이 0입니다 — 위에 얹히는 그림이 그 자리를 안 비웁니다.`
      + ` 원본 머리 잔재가 이식면을 덮어 눈자국이 남을 수 있습니다(구멍 마스크 동기화 확인).`);
  }
}

/* [진단] 잔재 회수 — 뷰당 1회. */
const _residueLogged = {};
function logSkinResidueOnce(angle, diag, ow, oh){
  if(!angle || _residueLogged[angle]) return;
  _residueLogged[angle] = true;
  if(!diag) return;                                   // 꺼짐/타원 없음
  if(diag.gated){
    console.log(`[잔재회수] ${angle}: 건너뜀 — 얼굴 랜드마크가 있는 뷰(이목구비를 지우면 안 된다)`);
    return;
  }
  if(diag.thin != null && !diag.n){
    console.log(`[잔재회수] ${angle}: 밝기 기준 없음 — 두상 안 살 표본 ${diag.thin}px < ${HOLE_FILL.residue.minSample}`
      + ` · 머리색 경로도 못 잡음(머리 평균색이 없거나 hairTol ${HOLE_FILL.residue.hairTol} 밖)`);
    return;
  }
  if(diag.cancelled){
    console.log(...gyeolBoldArgs([`[잔재회수] ${angle}: <b>취소</b> — 성한 살의 ${(diag.frac*100).toFixed(1)}%가 어둡게 잡혔다`
      + `(한계 ${(HOLE_FILL.residue.maxFrac*100)|0}%) · 잔재가 아니라 판정 실패로 봅니다(사진이 어둡거나 타원이 어긋남)`]));
    return;
  }
  if(!diag.n){
    console.log(`[잔재회수] ${angle}: 없음 — 두상 안이 전부 살 밝기(중앙값 ${diag.med != null ? diag.med.toFixed(0) : '?'} · 기준 ${diag.cut != null ? diag.cut.toFixed(0) : '?'})`);
    return;
  }
  console.log(...gyeolBoldArgs([`[잔재회수] ${angle}: 살 중앙값 ${diag.med.toFixed(0)} · 기준 ${diag.cut.toFixed(0)}(×${HOLE_FILL.residue.darkRatio}) →`
    + ` 심지 ${diag.core}px(머리색 ${diag.nHair||0} · 밝기 ${diag.nDark||0}) → 부풀려 <b>${diag.n}px 승격</b>`
    + ` = 두상 안의 ${(100*diag.n/Math.max(1,diag.area)).toFixed(1)}% · ${ow}×${oh}`
    + `\n      이 자리는 이제 다른 부위와 <b>같은 경로</b>로 메워집니다(살 격자 색 + 이마 표본 결).`]));
}

function buildSkinField(od, ow, oh, hole, ell){
  const F = HOLE_FILL.skinField;
  if(!F || !F.on || !ell) return null;
  const GX = Math.max(4, F.gridX|0), GY = Math.max(4, F.gridY|0);
  const step = Math.max(1, Math.round(Math.min(ow, oh) / 220));

  // 1패스 — 두상 안 성한 픽셀의 밝기 분포에서 "살의 하한"을 정한다
  const lums = [];
  for(let y=0; y<oh; y+=step){
    const v = ((y+0.5)/oh - ell.cy)/ell.ry, v2 = v*v;
    if(v2 > 1) continue;
    for(let x=0; x<ow; x+=step){
      const u = ((x+0.5)/ow - ell.cx)/ell.rx;
      if(u*u + v2 > 1) continue;
      if(hole[y*ow + x]) continue;                 // 지운 머리 자리 — 살이 아니다
      const i = (y*ow+x)*4;
      if(od[i+3] < 200) continue;
      lums.push(0.299*od[i] + 0.587*od[i+1] + 0.114*od[i+2]);
    }
  }
  if(lums.length < 200) return null;
  lums.sort((a,b)=>a-b);
  const darkCut = lums[Math.floor(lums.length * F.darkPct)];

  // 2패스 — 격자 칸마다 살 픽셀 평균
  const r = new Float32Array(GX*GY), g = new Float32Array(GX*GY), b = new Float32Array(GX*GY);
  const n = new Float32Array(GX*GY);
  const gxOf = x => Math.min(GX-1, Math.max(0, Math.floor(((x+0.5)/ow - (ell.cx-ell.rx)) / (2*ell.rx) * GX)));
  const gyOf = y => Math.min(GY-1, Math.max(0, Math.floor(((y+0.5)/oh - (ell.cy-ell.ry)) / (2*ell.ry) * GY)));
  for(let y=0; y<oh; y+=step){
    const v = ((y+0.5)/oh - ell.cy)/ell.ry, v2 = v*v;
    if(v2 > 1) continue;
    for(let x=0; x<ow; x+=step){
      const u = ((x+0.5)/ow - ell.cx)/ell.rx;
      if(u*u + v2 > 1) continue;
      if(hole[y*ow + x]) continue;
      const i = (y*ow+x)*4;
      if(od[i+3] < 200) continue;
      if(0.299*od[i] + 0.587*od[i+1] + 0.114*od[i+2] < darkCut) continue;   // 이목구비
      const k = gyOf(y)*GX + gxOf(x);
      r[k]+=od[i]; g[k]+=od[i+1]; b[k]+=od[i+2]; n[k]++;
    }
  }
  let filled = 0;
  for(let i=0;i<GX*GY;i++){ if(n[i] > 0){ r[i]/=n[i]; g[i]/=n[i]; b[i]/=n[i]; n[i]=1; filled++; } }
  const seeded = filled;
  if(filled < GX*GY*F.minCells) return null;

  /* 3패스 — 번지기. 빈 칸을 채워진 이웃 평균으로 메우기를 반복하면 결과가
     "가장 가까운 살"이 된다(거리변환을 따로 짜지 않아도 같은 순서로 퍼진다).
     앞머리가 이마를 덮어 위쪽이 통째로 비어 있어도, 아래 살에서 위로 올라온다 —
     사용자가 말한 "이마채우기"가 여기서 그대로 일어난다. */
  let passes = 0;
  for(; passes<F.fillPasses; passes++){
    let changed = 0;
    const nr=r.slice(), ng=g.slice(), nb=b.slice(), nn=n.slice();
    for(let gy=0; gy<GY; gy++) for(let gx=0; gx<GX; gx++){
      const i = gy*GX+gx;
      if(n[i] > 0) continue;
      let sr=0,sg=0,sb=0,k=0;
      if(gx>0    && n[i-1] >0){ sr+=r[i-1];  sg+=g[i-1];  sb+=b[i-1];  k++; }
      if(gx<GX-1 && n[i+1] >0){ sr+=r[i+1];  sg+=g[i+1];  sb+=b[i+1];  k++; }
      if(gy>0    && n[i-GX]>0){ sr+=r[i-GX]; sg+=g[i-GX]; sb+=b[i-GX]; k++; }
      if(gy<GY-1 && n[i+GX]>0){ sr+=r[i+GX]; sg+=g[i+GX]; sb+=b[i+GX]; k++; }
      if(k){ nr[i]=sr/k; ng[i]=sg/k; nb[i]=sb/k; nn[i]=1; changed++; }
    }
    if(!changed) break;
    r.set(nr); g.set(ng); b.set(nb); n.set(nn);
    filled += changed;
  }

  return {
    GX, GY, seeded, filled, passes, cells: GX*GY,
    /* 격자 <b>밖</b>이면 안으로 물린다 — 정수리(타원 위끝 근처)는 그래서
       두상에서 제일 위에 있는 살을 집는다. */
    at(nx, ny, out){
      const fx = Math.min(GX-1, Math.max(0, (nx - (ell.cx-ell.rx)) / (2*ell.rx) * GX - 0.5));
      const fy = Math.min(GY-1, Math.max(0, (ny - (ell.cy-ell.ry)) / (2*ell.ry) * GY - 0.5));
      const x0 = fx|0, y0 = fy|0;
      const x1 = Math.min(GX-1, x0+1), y1 = Math.min(GY-1, y0+1);
      const tx = fx-x0, ty = fy-y0;
      const i00=y0*GX+x0, i10=y0*GX+x1, i01=y1*GX+x0, i11=y1*GX+x1;
      const bl = (a0,a1,a2,a3)=> (a0*(1-tx)+a1*tx)*(1-ty) + (a2*(1-tx)+a3*tx)*ty;
      out[0] = bl(r[i00],r[i10],r[i01],r[i11]);
      out[1] = bl(g[i00],g[i10],g[i01],g[i11]);
      out[2] = bl(b[i00],b[i10],b[i01],b[i11]);
      return out;
    }
  };
}

/* 이마 표본을 떠서 "이식 재료"로 만든다.
     rgb — 패치 원본 픽셀(색 + 결). 이식은 이걸 통째로 옮겨 심는다.
     hi  — 패치 − 흐린 패치 = 결만(예전 동작 A/B용으로 남겨둔다).
     lum — 패치 평균 밝기. 대상 자리의 밝기를 이 값 대비 배율로 환산할 때 기준. */
function buildSkinGraft(hctx, ow, oh, ell, skinRGB, size, angle){
  const patch = pickSkinPatch(hctx, ow, oh, ell, skinRGB, size);
  if(!patch) return null;
  const pc = document.createElement('canvas'); pc.width = size; pc.height = size;
  const pctx = pc.getContext('2d', { willReadFrequently:true });
  pctx.drawImage(hctx.canvas, patch.px, patch.py, size, size, 0, 0, size, size);
  const sharp = pctx.getImageData(0, 0, size, size).data;
  /* 흐린 판 — 색·밝기는 여기 다 들어있으므로 빼고 나면 결(모공·잔털·미세 명암)만 남는다. */
  const bs = Math.max(2, size >> 3);
  const bc = document.createElement('canvas'); bc.width = bs; bc.height = bs;
  const bctx = bc.getContext('2d', { willReadFrequently:true });
  bctx.imageSmoothingEnabled = true;
  bctx.drawImage(pc, 0, 0, bs, bs);
  pctx.clearRect(0, 0, size, size);
  pctx.drawImage(bc, 0, 0, size, size);
  const blur = pctx.getImageData(0, 0, size, size).data;

  const rgb = new Uint8ClampedArray(size*size*3);
  const hi  = new Float32Array(size*size*3);
  let lumSum = 0;
  for(let i=0, k=0; i<sharp.length; i+=4, k+=3){
    rgb[k]   = sharp[i];   hi[k]   = sharp[i]   - blur[i];
    rgb[k+1] = sharp[i+1]; hi[k+1] = sharp[i+1] - blur[i+1];
    rgb[k+2] = sharp[i+2]; hi[k+2] = sharp[i+2] - blur[i+2];
    lumSum += 0.299*sharp[i] + 0.587*sharp[i+1] + 0.114*sharp[i+2];
  }
  /* 고주파 표준편차 — 이마 살결은 작고, 눈·눈썹·속눈썹은 크다. 색을 격자가
     맡게 된 뒤(2026-09-12) 패치에 남은 역할은 <b>결</b> 하나뿐이라, 결로도
     이목구비가 새어나오지 않게 여기서 세기를 재 둔다(HOLE_FILL.skinField.flatTol). */
  let d2 = 0;
  for(let k=0; k<hi.length; k++) d2 += hi[k]*hi[k];
  const det = Math.sqrt(d2 / hi.length);
  /* 평균색 — 두피색(scalpColor)이 없는 뷰(후면)에서 그 대신 쓴다. */
  let mr=0, mg=0, mb=0;
  for(let k=0; k<rgb.length; k+=3){ mr+=rgb[k]; mg+=rgb[k+1]; mb+=rgb[k+2]; }
  const np = size*size;
  return { rgb, hi, size, lum: lumSum / np, det, src: angle || '?', at: patch,
           mean: [Math.round(mr/np), Math.round(mg/np), Math.round(mb/np)],
           forehead: !!patch.forehead, dy: patch.dy };
}

// 저해상도 이웃 전파 — 투명 픽셀을 주변 색으로 채운다(두상 안에서만 피부톤 편향).
function fillHolesLowRes(srcCanvas, w, h, skinRGB, ell){
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently:true });
  ctx.drawImage(srcCanvas, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  const OPAQUE = 200;
  const inHead = (x, y)=>{
    if(!ell) return false;
    const nx = (x + 0.5)/w, ny = (y + 0.5)/h;
    const u = (nx - ell.cx)/ell.rx, v = (ny - ell.cy)/ell.ry;
    return u*u + v*v <= 1;
  };
  const MAX_PASS = Math.ceil(Math.hypot(w, h));
  for(let pass=0; pass<MAX_PASS; pass++){
    const fill = [];
    for(let y=0; y<h; y++){
      for(let x=0; x<w; x++){
        const i = (y*w+x)*4;
        if(d[i+3] >= OPAQUE) continue;
        const head = skinRGB && inHead(x, y);
        let r=0,g=0,b=0,n=0;
        for(let dy=-1; dy<=1; dy++){
          const yy = y+dy; if(yy<0||yy>=h) continue;
          for(let dx=-1; dx<=1; dx++){
            const xx = x+dx; if(xx<0||xx>=w||(dx===0&&dy===0)) continue;
            const j = (yy*w+xx)*4;
            if(d[j+3] < OPAQUE) continue;
            let ww = HOLE_FILL.dirW[dy+1];
            if(head){
              const dist = Math.abs(d[j]-skinRGB[0]) + Math.abs(d[j+1]-skinRGB[1]) + Math.abs(d[j+2]-skinRGB[2]);
              ww *= 1 + HOLE_FILL.skinBoost * Math.max(0, 1 - dist / HOLE_FILL.skinTol);
            }
            r+=d[j]*ww; g+=d[j+1]*ww; b+=d[j+2]*ww; n+=ww;
          }
        }
        if(n) fill.push(i, r/n, g/n, b/n);
      }
    }
    if(!fill.length) break;
    for(let k=0; k<fill.length; k+=4){
      const i = fill[k];
      d[i]=fill[k+1]; d[i+1]=fill[k+2]; d[i+2]=fill[k+3]; d[i+3]=255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/* ══════════════════════════════════════════════════════════════════
   렌더링 경계 배경 (2026-08-10)
   ─────────────────────────────────────────────────────────────────
   증상(사용자): "렌더링 주변에 <b>다른 마스크들이 겹쳐</b> 있어."
   결과 사진에서 새 헤어 바깥으로 <b>원래 머리 실루엣 모양</b>의 뿌연 회색·살구색
   덩어리와, 그 덩어리를 따라 도는 <b>검은 톱니 테두리</b>가 같이 보인다.
   원인은 둘이고, 둘 다 "지운 자리를 어떻게 메우느냐"에 있다.

   [원인 1] 검은 톱니 테두리 = <b>반투명 머리카락 테두리 잔상</b>
     baseC는 원본에서 머리 마스크를 destination-out으로 지운 그림이다. 마스크를
     작은 세그멘테이션 해상도에서 원본 크기로 <b>확대</b>해 지우기 때문에 경계
     픽셀의 알파가 0도 255도 아닌 중간값이 된다. 그 자리엔 <b>검은 머리색이
     반쯤 남는다</b>. 구멍 메움은 알파 200 이상을 "원래 있던 픽셀"로 보고 안
     건드렸으므로(옛 코드 holeA[i+3] >= 200), 그 반투명 머리 테두리는 끝까지
     살아남아 메운 배경 <b>위에</b> 얹혔다 — 화면의 톱니 윤곽이 정확히 이것이다.
     → 고침: 알파 250 미만을 전부 구멍으로 보고, 거기서 몇 px 더 <b>부풀려</b>
       지운다. 테두리를 살릴 이유가 없다 — 어차피 새 헤어가 덮거나 배경이다.

   [원인 2] 뿌연 덩어리 = <b>160px 확산 결과를 확대</b>한 것
     메움은 160px로 줄여 이웃 평균을 반복 전파(fillHolesLowRes)한 뒤 900px로
     늘려 썼다. 두상 <b>안</b>은 그 위에 이마 표본을 이식하니 티가 안 났지만,
     두상 <b>밖</b>(어깨·옷·창밖 배경)은 "손대지 않음"이라 그 뭉갠 회색이
     그대로 남는다. 긴 머리를 지운 자리가 통째로 그 상태다.
     → 고침: 두상 밖도 <b>출력 해상도에서</b> 메운다. 방식은 확산 평균이 아니라
       <b>방향성 인페인팅</b> — 구멍의 각 픽셀에서 상·하·좌·우로 나가 처음
       만나는 "아는 픽셀"을 찾고, 거리의 역제곱으로 섞는다.
       배경은 행 방향으로 대체로 균일하므로(창틀·니트 짜임·벽) 좌우에서 오는
       색이 가깝고 강하게 잡혀, 스웨터 자리는 스웨터로 창 자리는 창으로 메워진다.
       마지막에 주변에서 잰 만큼의 미세 잡티를 얹어 "너무 매끈해서 티 나는"
       면을 없앤다.

   ※ 새 라이브러리를 안 쓴 이유: 인페인팅 한 번이 아니라 <b>뷰마다 매번</b>
     돌아야 하고(4뷰 × 조정할 때마다), 위 두 사정(행 균일 배경 + 이미 있는
     두상 이식)이면 4방향 스윕으로 충분하다. 스윕은 픽셀당 상수시간이다.
══════════════════════════════════════════════════════════════════ */
const RENDER_PLATE = {
  on: true,          // false면 예전 동작(테두리 잔상 + 160px 확산) — A/B용
  alphaHole: 250,    // 이 알파 미만은 전부 구멍(=반투명 머리 테두리도 구멍)
  dilatePx: 3,       // 구멍 부풀림(원본 해상도 px) — 마스크 확대로 생긴 반투명 띠 제거용
  featherPx: 1.0,    // 깎은 자리와 원본 사이 경계 부드럽게(px)
  power: 2.0,        // 방향성 인페인팅 가중 = 1/거리^power
  relax: 8,          // 스윕 뒤 구멍만 3×3 평균 회차(빗살무늬 제거) — 0이면 끔
  grain: 0.55,       // 거울 결을 못 가져왔을 때 얹는 잡티 세기(0=끔)
  /* ── 남은 머리 테두리 걷어내기 (2026-08-10 2차) ────────────────────────
     사용자: "블러 시도는 좋은데, 그 이전에 <b>겹친 마스크 자체가 제거되지</b>
     않았어."
     맞다. 1차에서는 알파가 애매한 <b>몇 px</b>만 구멍으로 넘겼는데, 실제로
     남아 있던 건 그게 아니었다 — MediaPipe 헤어 마스크가 <b>진짜 머리보다 작게</b>
     잡혀서, 지운 자리 둘레에 <b>원본 머리카락이 온전한 알파 255로</b> 10~20px씩
     띠로 남아 있다. 그 띠는 "아는 픽셀"이라 지워지지도 않고, 더 나쁘게는
     인페인팅이 <b>그 어두운 머리색을 정답으로 보고 안쪽으로 퍼뜨렸다</b>.
     후면 목덜미의 검은 얼룩이 정확히 그것이다(메운 면이 회색 108, 니트는 170).
     고침: 구멍 둘레에서 <b>머리색에 가까운 픽셀만</b> 골라 최대 maxPx까지
     한 겹씩 구멍으로 넘긴다. 색으로 거르므로 니트·피부·배경은 안 먹는다.
     ※ 반경을 상한으로 묶는 이유: 금발처럼 머리색이 배경색과 가까우면 색만으로는
       못 멈춘다. 상한이 안전장치다. 로그의 "테두리 회수"가 크게 튀면 tol을 줄일 것. */
  rim: { on: true, tol: 96, minPx: 4, maxPx: 18 },
  /* 눈·눈썹 보호 — 위 buildHoleMask/featureGuardMask 배너. padX·padY는 랜드마크 박스
     반경에 곱하는 값(03a STEP 4 가드의 1.35/1.5보다 조금 넉넉), padAbs는 정규화 좌표로 더하는 여유.
     되돌리기: RENDER_PLATE.eyeGuard.on = false */
  eyeGuard: { on: true, padX: 1.45, padY: 1.60, padAbs: 0.008 },
  /* 거울 결 — 메운 면이 <b>매끈해서</b> 티가 나는 문제. 색·명암은 인페인팅이 만든
     것을 그대로 쓰고, <b>고주파(니트 짜임·배경 입자)만</b> 경계 건너편에서 거울로
     비춰 가져온다. 두상 안에서 이미 쓰는 "색은 주변, 결은 실제 피부" 방식과 같다. */
  detail: 0.75,      // 거울 결 세기(0=끔 — 매끈해도 좋으면 0)
  detailBlurPx: 2,   // 이 반경보다 <b>고운 것만</b> 결로 본다. 키우면 선반 선 같은
                     // 큰 구조까지 거울로 넘어와 겹쳐 보인다(오프라인 테스트로 확인).
};

/* 플래그 팽창 — 분리형 슬라이딩 최대값(가로 한 번, 세로 한 번). O(픽셀). */
function dilateFlags(flags, w, h, r){
  if(!(r > 0)) return flags;
  const tmp = new Uint8Array(w*h);
  for(let y=0; y<h; y++){
    const row = y*w;
    let cnt = 0;
    for(let x=0; x<=Math.min(r, w-1); x++) cnt += flags[row+x];
    for(let x=0; x<w; x++){
      tmp[row+x] = cnt > 0 ? 1 : 0;
      const add = x+r+1, sub = x-r;
      if(add < w) cnt += flags[row+add];
      if(sub >= 0) cnt -= flags[row+sub];
    }
  }
  for(let x=0; x<w; x++){
    let cnt = 0;
    for(let y=0; y<=Math.min(r, h-1); y++) cnt += tmp[y*w+x];
    for(let y=0; y<h; y++){
      flags[y*w+x] = cnt > 0 ? 1 : 0;
      const add = y+r+1, sub = y-r;
      if(add < h) cnt += tmp[add*w+x];
      if(sub >= 0) cnt -= tmp[sub*w+x];
    }
  }
  return flags;
}

/* 구멍 둘레의 <b>남은 머리카락</b>을 색으로 골라 구멍에 편입한다.
   한 겹씩(= 1px씩) 바깥으로 나가며, 구멍에 닿아 있고 색이 머리색에 가까운
   픽셀만 넘긴다. 색 조건이 있어 니트·피부·배경에서는 저절로 멈춘다.
   d: baseC의 RGBA (구멍은 알파 0, 남은 머리는 알파 255 + 원본 머리색). */
function growHairRim(hole, d, w, h, hair, tol, maxIter){
  let added = 0;
  for(let it=0; it<maxIter; it++){
    const add = [];
    for(let y=0; y<h; y++){
      for(let x=0; x<w; x++){
        const p = y*w+x;
        if(hole[p]) continue;
        const adj = (x>0 && hole[p-1]) || (x<w-1 && hole[p+1])
                 || (y>0 && hole[p-w]) || (y<h-1 && hole[p+w]);
        if(!adj) continue;
        const i = p*4;
        if(d[i+3] < 250) continue;
        const dist = Math.abs(d[i]-hair[0]) + Math.abs(d[i+1]-hair[1]) + Math.abs(d[i+2]-hair[2]);
        if(dist <= tol) add.push(p);
      }
    }
    if(!add.length) break;
    for(let k=0; k<add.length; k++) hole[add[k]] = 1;
    added += add.length;
  }
  return added;
}

/* 플래그 축소 — 한 칸이라도 구멍이면 구멍(최대값 풀링).
   메움 배경은 원본보다 작은 해상도에서 만들 수 있는데, 평균으로 줄이면
   가장자리 한 겹이 "구멍 아님"으로 살아나 그 자리에 다시 테두리가 생긴다. */
function downsampleFlagsMax(src, sw, sh, dw, dh){
  if(sw === dw && sh === dh) return src.slice();
  const out = new Uint8Array(dw*dh);
  for(let y=0; y<dh; y++){
    const y0 = Math.floor(y*sh/dh), y1 = Math.max(y0+1, Math.floor((y+1)*sh/dh));
    for(let x=0; x<dw; x++){
      const x0 = Math.floor(x*sw/dw), x1 = Math.max(x0+1, Math.floor((x+1)*sw/dw));
      let v = 0;
      for(let yy=y0; yy<y1 && !v; yy++){
        for(let xx=x0; xx<x1; xx++){ if(src[yy*sw+xx]){ v=1; break; } }
      }
      out[y*dw+x] = v;
    }
  }
  return out;
}

/* 이 뷰에서 "메워야 할 자리"의 <b>단 하나의</b> 정의 — baseC에 붙여 캐시한다.
   테두리 정리(baseC)와 메움 배경(fillC)이 <b>같은</b> 구멍을 봐야 한다.
   서로 1px이라도 어긋나면 그 틈으로 원본 머리색이 실선처럼 남는다. */
/* ── 구멍이 <b>반대쪽 눈</b>을 먹던 것 (2026-09-19) ────────────────────────────
   사용자: "측면캔버스에서 반대쪽 눈에도 메움이 있어."
   03a STEP 4가 눈썹·눈·입을 reason 3으로 가드해서 <b>머리 마스크</b>에는 눈이 없다.
   그런데 여기 buildHoleMask는 그 구멍을 dilatePx만큼 넓히고, 다시 growHairRim이
   머리색과 가까운 픽셀을 최대 rimIter겹 빨아들인다. 3/4 측면에서 반대쪽 눈은
   머리카락 경계에 붙어 있고 속눈썹·눈동자가 머리색 판정을 통과하므로, 03a가
   빼 둔 자리가 여기서 되돌아와 살색으로 칠해졌다.
   고침: 랜드마크의 눈·눈썹 박스를 보호 타원으로 만들고, <b>넓히기·회수가 새로 넣은</b>
   픽셀만 그 안에서 되돌린다. 원래부터 구멍이던 자리(진짜 머리카락이 눈을 덮은 경우)는
   그대로 둬야 한다 — 안 그러면 그 자리에 지워진 머리색이 실선으로 남는다.
   여유는 03a 가드(가로 ×1.35 · 세로 ×1.5)보다 조금 넉넉하게 잡는다.
   되돌리기: RENDER_PLATE.eyeGuard.on = false */
function featureGuardMask(angle, w, h){
  const G = RENDER_PLATE.eyeGuard;
  if(!G || !G.on || !angle) return null;
  const lm = (typeof state !== 'undefined') && state.landmarks && state.landmarks[angle];
  const F = lm && lm.features;
  if(!F) return null;
  const g = new Uint8Array(w*h);
  let n = 0;
  for(const key of ['leftEye', 'rightEye', 'leftBrow', 'rightBrow']){
    const b = F[key];
    if(!b) continue;
    const bw = b.maxX - b.minX, bh = b.maxY - b.minY;
    const cx = (b.minX + b.maxX)/2 * w, cy = (b.minY + b.maxY)/2 * h;
    const rx = Math.max(1, (bw/2 * G.padX + G.padAbs) * w);
    const ry = Math.max(1, (bh/2 * G.padY + G.padAbs) * h);
    const x0 = Math.max(0, Math.floor(cx-rx)), x1 = Math.min(w, Math.ceil(cx+rx));
    const y0 = Math.max(0, Math.floor(cy-ry)), y1 = Math.min(h, Math.ceil(cy+ry));
    for(let y=y0; y<y1; y++){
      const dy = (y+0.5-cy)/ry;
      for(let x=x0; x<x1; x++){
        const dx = (x+0.5-cx)/rx;
        if(dx*dx + dy*dy <= 1 && !g[y*w+x]){ g[y*w+x]=1; n++; }
      }
    }
  }
  return n ? g : null;
}
function buildHoleMask(baseC, maskInf){
  const w = baseC.width, h = baseC.height;
  const d = baseC.getContext('2d').getImageData(0, 0, w, h).data;
  const hole = new Uint8Array(w*h);
  let n0 = 0;
  for(let p=0, i=3; p<hole.length; p++, i+=4){ if(d[i] < RENDER_PLATE.alphaHole){ hole[p]=1; n0++; } }
  const hole0 = hole.slice();   // (2026-09-19) 넓히기 전 원본 구멍 — 눈 보호가 여기까진 안 건드린다
  dilateFlags(hole, w, h, Math.max(1, Math.round(RENDER_PLATE.dilatePx)));
  let nRim = 0, rimIter = 0;
  const R = RENDER_PLATE.rim;
  let hair = null;
  const m = maskInf && maskInf.avgColor && String(maskInf.avgColor).match(/\d+/g);
  if(m && m.length >= 3) hair = [+m[0], +m[1], +m[2]];
  if(R.on && hair && n0){
    rimIter = Math.max(R.minPx, Math.min(R.maxPx, Math.round(h*0.035)));
    nRim = growHairRim(hole, d, w, h, hair, R.tol, rimIter);
  }
  /* (2026-09-19) 눈·눈썹 자리에서 넓히기·회수가 새로 넣은 구멍만 되돌린다 — 위 eyeGuard 배너.
     baseC._view는 getHoleFillCanvas가 달아 둔다(구멍 마스크는 baseC에 캐시되고
     buildCleanBaseCanvas도 같은 것을 쓰므로, 뷰 이름은 제일 먼저 부르는 쪽에서 붙인다). */
  let nGuard = 0;
  const guard = featureGuardMask(baseC._view, w, h);
  if(guard){
    for(let p=0; p<hole.length; p++){
      if(guard[p] && hole[p] && !hole0[p]){ hole[p]=0; nGuard++; }
    }
    if(!_eyeGuardLogged[baseC._view]){
      _eyeGuardLogged[baseC._view] = true;
      console.log('[렌더경계·눈보호] ' + baseC._view + ': 넓히기·회수가 먹은 눈·눈썹 ' + nGuard + 'px 되돌림'
        + (nGuard ? '' : ' (이 뷰는 애초에 안 먹었음)'));
    }
  }
  return { hole, w, h, n0, nRim, rimIter, hair, nGuard };
}
const _eyeGuardLogged = {};
function getHoleMask(baseC, maskInf){
  if(!baseC) return null;
  if(baseC._holeMask) return baseC._holeMask;
  let hm = null;
  try{ hm = buildHoleMask(baseC, maskInf); }
  catch(e){ console.warn('구멍 마스크 생성 실패:', e); }
  baseC._holeMask = hm;
  return hm;
}

/* 방향성 인페인팅 — 구멍 픽셀마다 ←→↑↓ 네 방향으로 처음 만나는 "아는 픽셀"을
   거리 역제곱으로 섞는다. 스윕 4번, 픽셀당 상수시간.
   d: RGBA Uint8ClampedArray(w*h*4) — 구멍 자리는 여기서 덮어쓴다.
   hole: Uint8Array(w*h) 1=구멍. */
function inpaintDirectional(d, hole, w, h, power){
  const n = w*h;
  const acc = new Float32Array(n*3), wsum = new Float32Array(n);
  const P = (power > 0) ? power : 2;
  const put = (p, dist, r, g, b)=>{
    const ww = 1 / Math.pow(dist, P);
    acc[p*3] += r*ww; acc[p*3+1] += g*ww; acc[p*3+2] += b*ww; wsum[p] += ww;
  };
  // ← 왼쪽에서 오른쪽
  for(let y=0; y<h; y++){
    let lx = -1, r=0, g=0, b=0;
    for(let x=0; x<w; x++){
      const p = y*w+x;
      if(!hole[p]){ lx = x; r = d[p*4]; g = d[p*4+1]; b = d[p*4+2]; continue; }
      if(lx >= 0) put(p, x-lx, r, g, b);
    }
  }
  // → 오른쪽에서 왼쪽
  for(let y=0; y<h; y++){
    let lx = -1, r=0, g=0, b=0;
    for(let x=w-1; x>=0; x--){
      const p = y*w+x;
      if(!hole[p]){ lx = x; r = d[p*4]; g = d[p*4+1]; b = d[p*4+2]; continue; }
      if(lx >= 0) put(p, lx-x, r, g, b);
    }
  }
  // ↓ 위에서 아래
  for(let x=0; x<w; x++){
    let ly = -1, r=0, g=0, b=0;
    for(let y=0; y<h; y++){
      const p = y*w+x;
      if(!hole[p]){ ly = y; r = d[p*4]; g = d[p*4+1]; b = d[p*4+2]; continue; }
      if(ly >= 0) put(p, y-ly, r, g, b);
    }
  }
  // ↑ 아래에서 위
  for(let x=0; x<w; x++){
    let ly = -1, r=0, g=0, b=0;
    for(let y=h-1; y>=0; y--){
      const p = y*w+x;
      if(!hole[p]){ ly = y; r = d[p*4]; g = d[p*4+1]; b = d[p*4+2]; continue; }
      if(ly >= 0) put(p, ly-y, r, g, b);
    }
  }
  let filled = 0, unreached = 0;
  for(let p=0; p<n; p++){
    if(!hole[p]) continue;
    const s = wsum[p];
    if(s > 0){
      d[p*4]   = acc[p*3]  /s;
      d[p*4+1] = acc[p*3+1]/s;
      d[p*4+2] = acc[p*3+2]/s;
      filled++;
    } else unreached++;
    d[p*4+3] = 255;   // 메운 배경은 언제나 불투명(검정 비침 방지)
  }
  return { filled, unreached };
}

/* 줄무늬 지우기 — 4방향 스윕만 쓰면 넓은 구멍 <b>안쪽</b>에서 가로/세로 어느
   방향이 이기느냐가 픽셀마다 갈려 빗살무늬가 생긴다(테스트로 확인됨).
   구멍 픽셀만 골라 3×3 평균을 몇 번 돌리면 그 무늬가 사라진다 — 경계에 붙은
   구멍 픽셀은 매번 <b>아는 픽셀</b> 쪽으로 다시 당겨지므로, 가장자리 색은
   그대로 두고 안쪽만 매끄럽게 이어진다(라플라스 메움과 같은 수렴).
   스윕 결과가 이미 정답에 가까운 출발점이라 회차가 조금이면 된다. */
function relaxHoles(d, hole, w, h, iters){
  const n = w*h;
  if(!(iters > 0)) return;
  const buf = new Float32Array(n*3);
  for(let it=0; it<iters; it++){
    for(let p=0; p<n; p++){ buf[p*3]=d[p*4]; buf[p*3+1]=d[p*4+1]; buf[p*3+2]=d[p*4+2]; }
    for(let y=0; y<h; y++){
      for(let x=0; x<w; x++){
        const p = y*w+x;
        if(!hole[p]) continue;
        let r=0,g=0,b=0,c=0;
        for(let dy=-1; dy<=1; dy++){
          const yy=y+dy; if(yy<0||yy>=h) continue;
          for(let dx=-1; dx<=1; dx++){
            const xx=x+dx; if(xx<0||xx>=w) continue;
            const q=(yy*w+xx)*3;
            r+=buf[q]; g+=buf[q+1]; b+=buf[q+2]; c++;
          }
        }
        if(!c) continue;
        d[p*4]=r/c; d[p*4+1]=g/c; d[p*4+2]=b/c;
      }
    }
  }
}

/* 거울 결 — 메운 면에 <b>실제 사진의 결</b>을 얹는다.
   인페인팅은 색·명암(저주파)은 잘 잇지만 결과가 유리처럼 매끈해서, 니트 짜임과
   배경 입자가 살아 있는 주변과 붙여 놓으면 그 매끈함만으로 "여기 메웠다"가 보인다.
   구멍 픽셀마다 <b>가장 가까운 경계</b>를 찾아 그 건너편(거울 대칭 위치)의
   고주파(원본 − 흐린 원본)를 가져와 더한다. 저주파는 인페인팅 것을 그대로 쓰므로
   큰 구조가 복제되지 않고 <b>결만</b> 옮겨온다.
   blurD: 같은 그림을 detailBlurPx로 흐린 것. 둘의 차가 곧 결이다. */
function mirrorDetail(d, blurD, hole, w, h, strength){
  const n = w*h;
  const bestD = new Float32Array(n).fill(Infinity);
  const srcI  = new Int32Array(n).fill(-1);
  const cand = (p, dist, q)=>{ if(dist < bestD[p]){ bestD[p]=dist; srcI[p]=q; } };
  // ← : 왼쪽 경계 lx, 거울 위치 lx-(x-lx)
  for(let y=0; y<h; y++){
    let lx=-1;
    for(let x=0; x<w; x++){
      const p=y*w+x;
      if(!hole[p]){ lx=x; continue; }
      if(lx<0) continue;
      const dist=x-lx, mx=lx-dist;
      if(mx>=0) cand(p, dist, y*w+mx);
    }
  }
  // →
  for(let y=0; y<h; y++){
    let lx=-1;
    for(let x=w-1; x>=0; x--){
      const p=y*w+x;
      if(!hole[p]){ lx=x; continue; }
      if(lx<0) continue;
      const dist=lx-x, mx=lx+dist;
      if(mx<w) cand(p, dist, y*w+mx);
    }
  }
  // ↓
  for(let x=0; x<w; x++){
    let ly=-1;
    for(let y=0; y<h; y++){
      const p=y*w+x;
      if(!hole[p]){ ly=y; continue; }
      if(ly<0) continue;
      const dist=y-ly, my=ly-dist;
      if(my>=0) cand(p, dist, my*w+x);
    }
  }
  // ↑
  for(let x=0; x<w; x++){
    let ly=-1;
    for(let y=h-1; y>=0; y--){
      const p=y*w+x;
      if(!hole[p]){ ly=y; continue; }
      if(ly<0) continue;
      const dist=ly-y, my=ly+dist;
      if(my<h) cand(p, dist, my*w+x);
    }
  }
  let used = 0;
  for(let p=0; p<n; p++){
    if(!hole[p]) continue;
    const q = srcI[p];
    if(q < 0 || hole[q]) continue;       // 거울 자리가 또 구멍이면 결을 못 가져온다
    for(let ch=0; ch<3; ch++){
      const hf = d[q*4+ch] - blurD[q*4+ch];
      d[p*4+ch] = Math.max(0, Math.min(255, d[p*4+ch] + hf*strength));
    }
    used++;
  }
  return used;
}

/* 메운 면에 잡티 얹기 — 인페인팅 결과는 완전히 매끈해서, 사진 잡티가 있는
   주변과 붙여 놓으면 그 매끈함 자체가 "여기 메웠다"고 알려준다.
   세기는 지어내지 않고 <b>주변 아는 픽셀의 가로 이웃 차이</b>에서 실측한다.
   난수는 픽셀 좌표 해시(결정적) — 다시 그려도 무늬가 안 바뀌어 깜빡임이 없다. */
function addGrainToHoles(d, hole, w, h, strength){
  let sum = 0, n = 0;
  for(let y=1; y<h-1; y+=3){
    for(let x=1; x<w-2; x+=3){
      const p = y*w+x;
      if(hole[p] || hole[p+1]) continue;
      const l1 = 0.299*d[p*4]   + 0.587*d[p*4+1]   + 0.114*d[p*4+2];
      const l2 = 0.299*d[p*4+4] + 0.587*d[p*4+5]   + 0.114*d[p*4+6];
      sum += Math.abs(l1-l2); n++;
    }
  }
  if(!n) return 0;
  const sigma = Math.min(6, (sum/n) * 0.8) * strength;
  if(sigma < 0.3) return 0;
  for(let p=0; p<w*h; p++){
    if(!hole[p]) continue;
    let s = (Math.imul(p, 2654435761)) >>> 0;
    s ^= s >>> 15; s = Math.imul(s, 2246822519) >>> 0; s ^= s >>> 13;
    const nz = ((s & 1023)/1023 - 0.5) * 2 * sigma;
    d[p*4]   = Math.max(0, Math.min(255, d[p*4]   + nz));
    d[p*4+1] = Math.max(0, Math.min(255, d[p*4+1] + nz));
    d[p*4+2] = Math.max(0, Math.min(255, d[p*4+2] + nz));
  }
  return sigma;
}

/* baseC 테두리 정리 — 반투명 머리 잔상(검은 톱니 윤곽)을 <b>완전히</b> 떨군다.
   알파 250 미만은 전부 버리고 몇 px 더 깎은 뒤, 그 경계만 살짝 페더링한다.
   깎여 나간 자리는 아래 깔린 메움 배경이 이미 채우고 있으므로 구멍이 안 생긴다. */
function buildCleanBaseCanvas(baseC, maskInf){
  const w = baseC.width, h = baseC.height;
  if(!w || !h) return baseC;
  const hm = getHoleMask(baseC, maskInf);
  if(!hm || !hm.n0) return baseC;
  const hole = hm.hole;

  const mc = document.createElement('canvas'); mc.width = w; mc.height = h;
  const mx = mc.getContext('2d');
  const md = mx.createImageData(w, h);
  for(let p=0; p<hole.length; p++){
    const i = p*4;
    md.data[i] = md.data[i+1] = md.data[i+2] = 255;
    md.data[i+3] = hole[p] ? 0 : 255;
  }
  mx.putImageData(md, 0, 0);

  const out = document.createElement('canvas'); out.width = w; out.height = h;
  const ox = out.getContext('2d');
  ox.drawImage(baseC, 0, 0);
  ox.globalCompositeOperation = 'destination-in';
  if(RENDER_PLATE.featherPx > 0) ox.filter = `blur(${RENDER_PLATE.featherPx}px)`;
  ox.drawImage(mc, 0, 0);
  ox.filter = 'none';
  ox.globalCompositeOperation = 'source-over';
  out._holePx = hm.n0 + hm.nRim;
  return out;
}

/* 테두리 정리한 baseC — baseC 객체에 붙여 캐시(baseC가 새로 만들어지면 자동 무효). */
function getCleanBaseCanvas(baseC, maskInf){
  if(!baseC) return baseC;
  if(!RENDER_PLATE.on) return baseC;
  if(baseC._cleanBase) return baseC._cleanBase;
  let c = baseC;
  try{ c = buildCleanBaseCanvas(baseC, maskInf) || baseC; }
  catch(e){ console.warn('베이스 테두리 정리 실패(원본 사용):', e); c = baseC; }
  baseC._cleanBase = c;
  return c;
}

/* 최종 배경 생성. skinColor가 없으면 결 없이 색만 채운다(안전 폴백). */
function buildHoleFillCanvas(srcCanvas, skinColor, ell, angle, holeMaskInfo){
  const sw = srcCanvas.width, sh = srcCanvas.height;
  if(!sw || !sh) return null;
  let skinRGB = null;
  if(skinColor){
    const m = String(skinColor).match(/\d+/g);
    if(m && m.length>=3) skinRGB = [+m[0], +m[1], +m[2]];
  }
  /* 두피색이 없는 뷰(후면: 얼굴 미검출)는 보관된 이마 표본의 평균색으로 대신한다.
     같은 사람·같은 조명·같은 카메라라 뷰가 달라도 색을 맞출 필요가 없다.
     아래 저주파 전파·바탕칠까지 이 값이 쓰이게 <b>여기서</b> 채운다. */
  if(!skinRGB && _skinGraft && _skinGraft.mean) skinRGB = _skinGraft.mean.slice();
  const lw = Math.max(16, Math.min(HOLE_FILL.lowW, sw));
  const lh = Math.max(16, Math.round(sh * (lw / sw)));
  const low = fillHolesLowRes(srcCanvas, lw, lh, skinRGB, ell);

  const ow = Math.max(32, Math.min(HOLE_FILL.outW, sw));
  const oh = Math.max(32, Math.round(sh * (ow / sw)));
  const out = document.createElement('canvas'); out.width = ow; out.height = oh;
  const octx = out.getContext('2d', { willReadFrequently:true });
  octx.imageSmoothingEnabled = true;
  /* ── 이 캔버스는 <b>반드시 불투명</b>해야 한다 (2026-08-02 12차) ────────────
     사용자: "아직 베이스C 안 깔리는 거 같아. 까매."
     11차에서 "메움 배경이 <b>없을 때</b>"의 검정은 막았는데, 메움 배경이
     <b>있는데 그 안에 투명이 남은</b> 경우가 남아 있었다. low(저해상도 전파)는
     이웃이 전부 투명한 구멍(예: 마스크가 프레임 가장자리에 닿아 씨앗이 없는
     자리)을 못 채우고, 그 투명이 여기로 그대로 확대돼 넘어온다. 그 위에 얹히는
     baseC도 같은 자리가 투명이니 결국 페이지 배경(검정)이 비친다.
     그래서 <b>먼저 두피색으로 한 번 칠하고</b> 그 위에 low를 얹는다. low가
     채운 자리는 그대로고, 못 채운 자리만 두피색이 된다 — 검정은 못 나온다. */
  octx.fillStyle = skinRGB ? `rgb(${skinRGB[0]},${skinRGB[1]},${skinRGB[2]})` : 'rgb(224,178,148)';
  octx.fillRect(0, 0, ow, oh);
  octx.drawImage(low, 0, 0, ow, oh);           // 저주파(색·명암) — 아래 스윕이 못 닿는 자리의 안전망

  // 어디가 구멍인지(=원본이 투명했던 자리) 출력 해상도로 다시 읽는다
  const hc = document.createElement('canvas'); hc.width = ow; hc.height = oh;
  const hctx = hc.getContext('2d', { willReadFrequently:true });
  hctx.drawImage(srcCanvas, 0, 0, ow, oh);
  const holeA = hctx.getImageData(0, 0, ow, oh).data;

  /* ── 이마 표본을 <b>여기서</b> 먼저 뜬다 (2026-09-14 3차) ──────────────────
     예전엔 인페인팅·잔재 회수를 다 끝낸 뒤에 떴다. 그런데 얼굴 없는 뷰는
     "표본이 있느냐"로 <b>구멍을 어디까지 넓힐지</b>가 갈린다(facelessFill) —
     표본이 없으면 타원을 비워봐야 메울 재료가 없어 단색 오벌이 된다.
     그래서 판단에 필요한 순서대로 앞으로 옮긴다. 표본은 hctx(=원본을 출력
     해상도로 다시 그린 것)에서 뜨므로, 아래 어떤 수정보다 앞에 와도 값이 같다. */
  const size = Math.min(Math.max(24, Math.round(HOLE_FILL.patch * ow / 900)), ow>>1, oh>>1);
  /* ── 이마 표본 확보 ─────────────────────────────────────────────
     이 뷰에서 뜬다 → 못 뜨면 다른 뷰(대개 정면)에서 뜬 것을 쓴다.
     정면 표본은 늘 최신으로 보관한다(얼굴이 가장 크게·정면으로 나오는 뷰). */
  /* ── 이마가 아니면 <b>남의 이마</b>를 쓴다 (2026-08-11) ────────────────────
     사용자: "이마에서 픽셀만 떼어와서 심으라고 했는데 눈까지 떼어왔어?"
     맞다. SKIN_PATCH_CANDS는 14자리인데 이마(dy<0)는 위 6개뿐이고 나머지는
     볼·턱·목이다. 이마는 <b>우대점수</b>일 뿐 필수가 아니었다. 그런데 우대는
     합격선을 못 넘기게 일부러 분리해 놨으므로, 이마가 떨어지면 우대는 못 구한다.

     그리고 이 손님처럼 <b>앞머리가 이마를 통째로 덮으면</b> 그 자리는 원본 머리를
     지운 뒤라 투명이고, "불투명 98%" 조건에서 이마 후보 여섯이 <b>전부</b> 탈락한다.
     남는 최상위가 dy +0.10~0.15 — 위 주석이 "눈 언저리"라고 적어둔 바로 그 줄이다.
     떠온 24px 패치를 46px 주기 거울 타일로 만 픽셀에 깔므로, 그 안에 눈이 있으면
     화면에 눈이 수십 번 찍힌다(사용자가 본 "실루엣 둘레의 눈동자").

     고침 — 우선순위를 <b>위치</b>로 정한다:
       ① 이 뷰의 이마 표본        ② 보관된 다른 뷰의 이마 표본
       ③ 이 뷰의 비이마 표본      ④ 없음 → 단색 피부(아래 flatMix)
     ③이 ②보다 뒤인 게 이번 변경의 핵심이다. 예전엔 자기 뷰 것이 있으면 그게
     눈이어도 무조건 이겼다(`if(!graft) graft = _skinGraft` — null일 때만 빌림).
     실제로 우측만 자기 것(눈)을 쓰고 좌·후면은 정면 이마를 빌려 썼다.
     ④는 눈 무늬가 반복되느니 단색이 낫다는 판단이다 — 없는 정보를 지어내는 것보다
     "여기는 모른다"가 화면에서도 덜 틀린다. */
  const own = buildSkinGraft(hctx, ow, oh, ell, skinRGB, size, angle);
  // 보관은 <b>이마 표본만</b> 한다. 눈 표본을 보관하면 다른 뷰까지 오염된다.
  if(own && own.forehead && (!_skinGraft || angle === 'front' || _skinGraft.src !== 'front')) _skinGraft = own;
  /* ── dy<0(이마)만으로는 모자란다 (2026-08-11 2차) ────────────────────────
     실기기: 우측만 `이마 dy-0.10 · 평균밝기 102`, 나머지 뷰는 `dy-0.28 · 139`.
     dy−0.10은 이마 후보 <b>여섯 중 제일 아래</b>(관자놀이 쪽)라 머리카락 경계·
     그늘이 섞이기 쉽다. 통과는 했는데 27% 어두웠고, 화면에는 그 어두운 무늬가
     타일로 반복됐다. 그래서 밝기로 한 번 더 거른다 — 보관된 이마 표본보다
     <b>뚜렷하게 어두우면</b> 내 것을 버리고 보관본을 쓴다.
     기준 0.85는 "조명 차이"와 "다른 것이 섞임"을 가르는 자리로 잡았다(실측
     139 대 102 = 0.73이 걸리고, 뷰 간 정상 조명차 ±10%는 안 걸린다). */
  const GRAFT_DARK_TOL = 0.85;
  let ownUsable = !!(own && own.forehead), darkRejected = null;
  if(ownUsable && _skinGraft && _skinGraft.forehead && _skinGraft !== own
     && _skinGraft.lum > 1 && own.lum / _skinGraft.lum < GRAFT_DARK_TOL){
    darkRejected = own; ownUsable = false;
  }
  let graft = null;
  if(ownUsable) graft = own;                                  // ①
  else if(_skinGraft && _skinGraft.forehead) graft = _skinGraft; // ②
  else graft = null;                                          // ③은 안 쓴다 → ④ 단색
  const graftRejected = (own && !own.forehead) ? own : darkRejected;

  /* ── 렌더링 경계 배경 (2026-08-10) ────────────────────────────────
     ① 원본 픽셀을 출력 해상도로 얹는다 — 인페인팅이 참조할 "아는 픽셀".
        (예전엔 low를 확대한 뿌연 값이 유일한 참조였다.)
     ② 알파 250 미만 + 몇 px 부풀림 = 구멍. 반투명 머리 테두리가 여기 포함되어
        검은 톱니 윤곽이 사라진다.
     ③ 4방향 스윕으로 메우고 주변에서 잰 만큼 잡티를 얹는다.
     두상 안은 아래 이식 루프가 색까지 다시 덮으므로, 여기 결과는 두상 <b>밖</b>
     (어깨·옷·배경)에서 그대로 최종이 된다 — 유령 덩어리가 없어지는 자리다. */
  /* ── 얼굴 없는 뷰 판정 (2026-09-14 3차) ────────────────────────────────
     랜드마크가 없다 = 이 뷰의 타원 안에 <b>있어야 하는</b> 이목구비가 없다
     = 타원 안 전체가 두피이거나 지울 머리다. 후면이 늘 이 경우다.
     표본(graft)이 없으면 메울 재료가 없으니 켜지 않는다 — 살색 단색 오벌이
     원본보다 나을 게 없다. 그때는 예전 경로(잔재 회수)로 간다. */
  const FF = HOLE_FILL.facelessFill;
  const noFace = !(typeof state !== 'undefined' && state.landmarks && state.landmarks[angle]);
  const faceless = !!(FF && FF.on && ell && graft && graft.mean && noFace);

  let plateDiag = null, residueDiag = null, facelessDiag = null;
  let hole = new Uint8Array(ow*oh);
  if(RENDER_PLATE.on){
    octx.drawImage(srcCanvas, 0, 0, ow, oh);   // ① 아는 픽셀(구멍은 투명이라 안 덮임)
    /* 구멍 정의는 <b>테두리 정리와 같은 것</b>을 쓴다(getHoleMask). 원본 해상도에서
       한 번 만들어(알파 + 부풀림 + 머리색 테두리 회수) 여기로 축소해 온다.
       두 곳에서 따로 재면 1px 어긋난 자리에 원본 머리색이 실선으로 남는다. */
    const hm = getHoleMask(srcCanvas, holeMaskInfo);
    if(hm) hole = downsampleFlagsMax(hm.hole, hm.w, hm.h, ow, oh);
    else { for(let p=0, i=3; p<hole.length; p++, i+=4) hole[p] = holeA[i] < RENDER_PLATE.alphaHole ? 1 : 0; }
    if(faceless){
      /* 타원 안을 통째로 구멍으로 넘긴다. 이게 "어디가 잔재인지 고르기"를
         대신한다 — 고를 필요가 없으면 고르다 틀릴 일도 없다.
         ⚠ 승격은 <b>두 군데</b>에 해야 한다:
           ① 여기(출력 해상도 사본) — 아래 이식 루프가 칠할 자리
           ② hm.hole(원본 해상도, 캐시) — 위에 얹히는 baseC 정리본이 오려낼 자리
         ②를 빼먹은 것이 2차에서 눈자국이 그대로 남은 직접 원인이다. 정리본은
         이미 만들어져 캐시돼 있을 수 있으므로 같이 무효화한다. */
      const nIn = markEllipseHole(hole, ow, oh, ell, FF.shrink);
      let nBase = 0;
      if(hm){
        nBase = markEllipseHole(hm.hole, hm.w, hm.h, ell, FF.shrink);
        if(nBase) try{ srcCanvas._cleanBase = null; }catch(e){}
      }
      facelessDiag = { nIn, nBase, hadHm: !!hm };
    } else {
      /* 잔재 회수는 <b>반드시 인페인팅 앞</b>이다. 뒤로 가면 검정이 이미 아래로
         끌려 내려간 뒤라, 승격해봐야 그 자국을 다시 참조해 메우게 된다. */
      residueDiag = markSkinResidue(holeA, ow, oh, hole, ell, angle, hm && hm.hair);
    }
    const pimg = octx.getImageData(0, 0, ow, oh), pd = pimg.data;
    const res = inpaintDirectional(pd, hole, ow, oh, RENDER_PLATE.power); // ②
    relaxHoles(pd, hole, ow, oh, RENDER_PLATE.relax);                     // ③ 빗살무늬 제거
    /* ④ 거울 결 — 흐린 판을 한 장 떠서 고주파를 경계 건너편에서 가져온다. */
    let nDetail = 0, sigma = 0;
    if(RENDER_PLATE.detail > 0){
      const bc = document.createElement('canvas'); bc.width = ow; bc.height = oh;
      const bx = bc.getContext('2d', { willReadFrequently:true });
      octx.putImageData(pimg, 0, 0);
      bx.filter = `blur(${RENDER_PLATE.detailBlurPx}px)`;
      bx.drawImage(out, 0, 0);
      bx.filter = 'none';
      const blurD = bx.getImageData(0, 0, ow, oh).data;
      nDetail = mirrorDetail(pd, blurD, hole, ow, oh, RENDER_PLATE.detail);
    }
    if(!nDetail) sigma = addGrainToHoles(pd, hole, ow, oh, RENDER_PLATE.grain);
    octx.putImageData(pimg, 0, 0);
    plateDiag = { sigma, detail: nDetail,
                  rim: hm ? hm.nRim : 0, rimIter: hm ? hm.rimIter : 0,
                  hair: hm ? hm.hair : null, ...res };
  } else {
    for(let p=0, i=3; p<hole.length; p++, i+=4) hole[p] = holeA[i] < 200 ? 1 : 0;
    if(faceless){
      facelessDiag = { nIn: markEllipseHole(hole, ow, oh, ell, FF.shrink), nBase: 0, hadHm: false };
    } else {
      const hairInf = holeMaskInfo && holeMaskInfo.avgColor && String(holeMaskInfo.avgColor).match(/\d+/g);
      residueDiag = markSkinResidue(holeA, ow, oh, hole, ell, angle,
        (hairInf && hairInf.length>=3) ? [+hairInf[0], +hairInf[1], +hairInf[2]] : null);
    }
  }
  logRenderPlateOnce(angle, plateDiag, ow, oh);
  logSkinResidueOnce(angle, residueDiag, ow, oh);
  if(!ell) logFacelessOnce(angle, facelessDiag, graft, noFace, ell, ow, oh);   // 타원이 있으면 덮개 수를 알고 난 뒤(아래)에 찍는다

  /* ⚠ 예전엔 여기서 <b>바로 돌아갔다</b>. 그러면 타원 밖(어깨·배경)은 물론이고
     타원 자체가 없는 경우까지 mirrorDetail 결과가 그대로 최종이 된다 —
     위 outerField 배너가 말한 눈 윤곽이 남는 자리다. 이제 밖은 밖대로 메우고
     간다. 안쪽(살 격자·이식)만 skinRGB·ell이 있을 때 돈다. */
  /* ── 두피색이 없다고 <b>타원 안까지</b> 포기하지 않는다 (2026-09-14 2차) ──────
     후면은 얼굴이 안 잡혀 scalpColor가 비는 경우가 있다. 예전엔 그러면 여기서
     바로 돌아가서 <b>타원 밖만</b> 메우고 끝났다 — 전면·측면에 적용한 살 격자
     + 이마 표본 이식이 후면 타원 안에서만 통째로 건너뛰어졌고, 그 자리엔
     mirrorDetail이 접어 넣은 눈 윤곽이 그대로 남았다(사용자가 본 그것).
     살 격자는 skinRGB가 없어도 선다 — 색을 <b>자리</b>에서 가져오기 때문이다.
     못 서는 경우를 위해 보관된 이마 표본의 평균색을 두피색 대신 쓴다.
     이제 <b>타원이 없을 때만</b> 밖으로 빠진다. */
  const _oimgEarly = (!ell) ? octx.getImageData(0, 0, ow, oh) : null;
  if(_oimgEarly){
    const od0 = _oimgEarly.data;
    const outer0 = buildOuterField(od0, ow, oh, hole, ell);
    const n0 = outer0 ? paintOuterHoles(od0, ow, oh, hole, ell, outer0) : 0;
    if(outer0) octx.putImageData(_oimgEarly, 0, 0);
    logOuterFieldOnce(angle, outer0, n0, ow, oh, '두상 타원 없음');
    return out;
  }


  const G = HOLE_FILL.graft;
  // 거울 반복(ping-pong)으로 타일링 — 같은 무늬가 줄줄이 반복되는 티가 안 난다
  const mirror = (v, n)=>{ const p = 2*n - 2; let m = ((v % p) + p) % p; return m < n ? m : p - m; };
  const oimg = octx.getImageData(0, 0, ow, oh), od = oimg.data;
  const T = HOLE_FILL.texture;
  const gs = graft ? graft.size : 0;
  let nGraft = 0, nFlat = 0;
  /* ── 색은 격자에서, 결만 패치에서 (2026-09-12) ──────────────────────
     반드시 이식 루프 <b>전에</b> 만든다 — od를 고치기 시작하면 그 결과가
     표본으로 되먹여져서 색이 스스로 끌려간다. */
  const F = HOLE_FILL.skinField;
  /* 얼굴 없는 뷰에서는 살 격자를 <b>아예 안 세운다</b> (2026-09-14 3차).
     격자는 "이 사진의 이 자리에 있던 살"을 쓰는 방식인데, 후면 타원 안에는
     그 살이 없다 — 씨앗으로 잡히는 것은 세그가 놓친 머리 뭉치뿐이라, 격자를
     세우면 그 어두운 무늬가 <b>색</b>으로 승격돼 눈자국이 다시 그려진다.
     타원을 통째로 구멍으로 넘긴 뒤라 어차피 씨앗이 없어 null이 나오지만,
     테두리 한 겹으로 격자가 서는 일이 없도록 여기서 못을 박는다. */
  const field = faceless ? null : buildSkinField(od, ow, oh, hole, ell);
  /* 결은 패치가 평평할 때만 쓴다. 격자가 색을 맡으므로 결이 없어도 그림은
     성립한다 — 눈 무늬가 반복되느니 매끈한 편이 낫다(8/11과 같은 판단).
     얼굴 없는 뷰(이식 전면 적용)에서도 같은 잣대를 그대로 쓴다: 표본이 평평하지
     않으면(=눈·눈썹이 섞였으면) 결을 통째로 버리고 색만 심는다. */
  const useDetail = !!((field || faceless) && graft && F && F.detail > 0
                       && (graft.det == null || graft.det <= F.flatTol));
  const _fc = [0,0,0];
  const fieldDrop = !!(field && graft && !useDetail);
  /* 타원 <b>밖</b> 구멍 — 반드시 이식 루프 전에 만든다(od가 고쳐지기 전 픽셀이
     씨앗이어야 한다). 실제 칠하기는 아래 루프가 끝난 뒤 한 번에 한다. */
  /* (2026-09-16) 살 구역 = 두개골 되쏜 실루엣 · 살 색 = 얼굴 기준색 쪽으로 — 위 skullClip·faceTone 배너 */
  let skullW = null;
  try{ skullW = buildSkullClipWeight(angle, ow, oh, sw, sh); }
  catch(e){ console.warn('[메움·두상경계] 두개골 실루엣 실패(타원 그대로):', e && e.message); }
  const tone = faceToneRefFor(od, ow, oh, hole, ell, angle);
  const FT = HOLE_FILL.faceTone;
  const outer = buildOuterField(od, ow, oh, hole, ell, skullW);
  const clipBg = !!(skullW && outer);
  const _bg = [0,0,0];
  const bgMixK = Math.max(0, Math.min(1, HOLE_FILL.outerField.detailMix));
  /* 두개골 밖 자리의 바탕색 — clipBg면 주변색 격자(+약한 결), 아니면 예전처럼 od 그대로 */
  const bgAt = (i, nx, ny)=>{
    if(!clipBg){ _bg[0]=od[i]; _bg[1]=od[i+1]; _bg[2]=od[i+2]; return _bg; }
    outer.at(nx, ny, _bg);
    for(let ch=0; ch<3; ch++) _bg[ch] = Math.max(0, Math.min(255, _bg[ch] + (od[i+ch]-_bg[ch])*bgMixK));
    return _bg;
  };
  let nBg = 0;
  /* (2026-09-16 3차) 얼굴 없는 뷰 — 타원(px 페더) ∪ 목 기둥 덮개. 위 facelessFill.cover 배너.
     밖 구멍(주변색)을 <b>먼저</b> 칠해 두고, 덮개가 그 위에 살을 얹는다(목 기둥은 타원 밖이라
     나중에 칠하면 주변색이 살을 덮어쓴다). 비-얼굴 뷰는 안/밖이 겹치지 않아 순서 무관. */
  const cover = faceless ? buildFacelessCover(ow, oh, ell, hole) : null;
  let nOuterEarly = -1;
  if(cover && outer){ nOuterEarly = paintOuterHoles(od, ow, oh, hole, ell, outer); }
  if(cover && facelessDiag) facelessDiag.nNeck = cover.nNeck;
  for(let y=0; y<oh; y++){
    const ny = (y + 0.5)/oh, v = (ny - ell.cy)/ell.ry, v2 = v*v;
    if(v2 > 1 && !cover) continue;             // 두상 밖 — 아래 paintOuterHoles가 맡는다(덮개가 있으면 목 기둥까지)
    const py = gs ? mirror(y, gs) : 0;
    for(let x=0; x<ow; x++){
      const i = (y*ow+x)*4;
      // 원래 있던 픽셀은 안 건드림. 기준을 holeA 알파에서 <b>부풀린 구멍 플래그</b>로
      // 바꾼 이유: 반투명 머리 테두리(알파 200~250)가 예전엔 "있던 픽셀"로 통과해
      // 두피 위에 검은 실선으로 남았다 — 그 자리도 이식 대상이어야 한다.
      if(!hole[y*ow + x]) continue;
      const nx = (x + 0.5)/ow, u = (nx - ell.cx)/ell.rx;
      const r2 = u*u + v2;
      if(r2 > 1 && !cover) continue;           // 두상 밖 — 아래 paintOuterHoles가 맡는다
      /* 두상 경계 페더 — 이식이 타원 선에서 뚝 끊기면 그 자리에 테두리가 생긴다.
         바깥 몇 %에서 원래(전파된) 색으로 서서히 넘긴다. */
      let wgt = 1;
      if(G.edgeFeather > 0){
        const r = Math.sqrt(r2);
        if(r > 1 - G.edgeFeather) wgt = Math.max(0, (1 - r) / G.edgeFeather);
      }
      if(cover){
        wgt = cover[y*ow + x];                   // px 고정 페더 · 목 기둥 포함
        if(wgt <= 0.002) continue;               // 덮개 밖 — 주변색(이미 칠함) 그대로
      }
      const bg = bgAt(i, nx, ny);
      if(skullW){
        wgt *= skullW[y*ow + x];
        if(wgt <= 0.002){                        // 두개골 밖 — 살이 아니다
          od[i] = bg[0]; od[i+1] = bg[1]; od[i+2] = bg[2]; od[i+3] = 255;
          nBg++;
          continue;
        }
      }
      if(faceless){
        /* ── 얼굴 없는 뷰: 순수 이식 (2026-09-14 3차) ─────────────────────
           od를 <b>한 방울도</b> 쓰지 않는다. 색도 밝기도 안 쓴다 — 후면 타원
           안의 od는 지운 머리 경계가 사방으로 끌려간 스윕 자국이라, 색으로
           쓰면 얼룩이 되고 <b>밝기로만</b> 써도 그 얼룩이 음영으로 되살아난다
           (그게 "눈모양"의 정체다. 형태가 남는 경로를 하나도 안 남긴다).
           대신 심는 것은 셋뿐이다:
             · 색   — 이마 표본의 평균색(같은 사람·같은 조명이라 그대로 맞는다)
             · 음영 — 타원 중심에서 멀수록 살짝 어둡게(구면). 사진과 무관한
                      기하학이라 무늬가 생길 수 없다.
             · 결   — 이마 표본의 고주파. 평평한 표본일 때만(useDetail).
           결과는 "이마 피부를 뒤통수에 통째로 옮겨 심은" 면이 된다. 그 위에
           새 헤어가 그려지므로 두피가 균일해도 어색하지 않다. */
        const shade = 1 - FF.edgeShade * Math.min(1, r2);   // 목 기둥(r2>1)은 가장자리 음영에서 멈춘다
        const gk = useDetail ? (mirror(x, gs)*gs + py) * 3 : 0;
        for(let ch = 0; ch < 3; ch++){
          const skinPx = graft.mean[ch] * shade
                       + (useDetail ? graft.hi[gk+ch] * T * FF.detail : 0);
          od[i+ch] = Math.max(0, Math.min(255, bg[ch]*(1-wgt) + skinPx*wgt));
        }
        od[i+3] = 255;
        nGraft++;
        continue;
      }
      if(field){
        /* ── 자리별 색 (2026-09-12) ──────────────────────────────────
           타일이 없으므로 반복될 무늬 자체가 없다. 번져 들어온 od는 색으로도
           <b>밝기로도</b> 안 쓴다 — 정수리는 벽, 목덜미는 지운 머리라 둘 다
           살이 아니다(12a SCALP_SKIN이 unlit인 것과 같은 이유).
           ⚠ 이 분기가 graft 유무보다 <b>앞</b>인 게 핵심이다. 앞머리가 이마를
             통째로 덮은 손님은 이마 후보 여섯이 전부 탈락해 표본이 없고, 예전엔
             그대로 단색(flatMix)으로 떨어졌다. 격자는 표본이 없어도 선다 —
             색을 <b>표본</b>이 아니라 <b>자리</b>에서 가져오기 때문이다. */
        field.at(nx, ny, _fc);
        if(tone){
          /* 얼굴 기준색 쪽으로 당긴다 — 밝기 차는 좁은 범위에서만 살린다 */
          const Lf = 0.299*_fc[0] + 0.587*_fc[1] + 0.114*_fc[2];
          const Lr = 0.299*tone[0] + 0.587*tone[1] + 0.114*tone[2];
          const shT = Lr > 1 ? Math.max(FT.shadeMin, Math.min(FT.shadeMax, Lf / Lr)) : 1;
          for(let ch=0; ch<3; ch++) _fc[ch] = _fc[ch]*(1-FT.mix) + tone[ch]*shT*FT.mix;
        }
        const gk = useDetail ? (mirror(x, gs)*gs + py) * 3 : 0;
        for(let ch = 0; ch < 3; ch++){
          const skinPx = _fc[ch] + (useDetail ? graft.hi[gk+ch] * T * F.detail : 0);
          od[i+ch] = Math.max(0, Math.min(255, bg[ch]*(1-wgt) + skinPx*wgt));
        }
        nGraft++;
        continue;
      }
      if(!graft){
        /* 표본을 아예 못 떴을 때 — 최소한 <b>두피색 쪽으로</b> 끌어당긴다.
           벽의 흰색·머리의 검정이 그대로 남는 것보다 낫다(검정은 답이 아니다). */
        const m = G.flatMix * wgt;
        const FB = tone || skinRGB || [224,178,148];   // 두피색도 표본도 없을 때(후면)의 최후 폴백
        od[i]   = bg[0]*(1-m) + FB[0]*m;
        od[i+1] = bg[1]*(1-m) + FB[1]*m;
        od[i+2] = bg[2]*(1-m) + FB[2]*m;
        nFlat++;
        continue;
      }
      const k = (mirror(x, gs)*gs + py) * 3;
      if(!G.on){
        // 예전 동작(A/B) — 결만 얹는다. 색은 이웃 전파가 정한 그대로.
        od[i]   = Math.max(0, Math.min(255, od[i]   + graft.hi[k]  *T));
        od[i+1] = Math.max(0, Math.min(255, od[i+1] + graft.hi[k+1]*T));
        od[i+2] = Math.max(0, Math.min(255, od[i+2] + graft.hi[k+2]*T));
        continue;
      }
      /* ── 이식 ──
         이 자리에 번져 들어온 색(od)은 <b>색으로 안 쓴다</b>. 정수리 근처면
         벽(흰색), 뒤통수·목덜미면 지워진 머리 경계(검정)라 둘 다 두피가 아니다.
         쓰는 건 <b>밝기 하나</b>고, 그마저 shadeMin~shadeMax로 잘라서 받는다 —
         그늘·하이라이트는 남되 흰 벽/검정으로는 못 간다.
         색과 결은 전부 이마 표본에서 온다. */
      const lum = 0.299*od[i] + 0.587*od[i+1] + 0.114*od[i+2];
      let sh = graft.lum > 1 ? lum / graft.lum : 1;
      sh = Math.max(G.shadeMin, Math.min(G.shadeMax, sh));
      for(let ch = 0; ch < 3; ch++){
        const skinPx = graft.rgb[k+ch] * sh;
        od[i+ch] = Math.max(0, Math.min(255, bg[ch]*(1-wgt) + skinPx*wgt));
      }
      nGraft++;
    }
  }
  logSkullClipOnce(angle, skullW, tone, nBg, ow, oh);
  logFacelessOnce(angle, facelessDiag, graft, noFace, ell, ow, oh);
  const nOuter = (nOuterEarly >= 0) ? nOuterEarly : (outer ? paintOuterHoles(od, ow, oh, hole, ell, outer) : 0);
  octx.putImageData(oimg, 0, 0);
  logOuterFieldOnce(angle, outer, nOuter, ow, oh, null);
  logSkinFieldOnce(angle, field, graft, useDetail, ow, oh);
  logSkinGraftOnce(angle, graft, nGraft, nFlat, ow, oh, graftRejected);
  return out;
}

/* [진단] 렌더링 경계 배경 — 뷰당 1회.
   "주변에 마스크가 겹쳐 보인다"는 신고가 다시 오면 이 한 줄로 갈린다:
     · 채움 0px      → RENDER_PLATE.on이 꺼졌거나 구멍 판정이 안 됨
     · 미도달 큰 값  → 마스크가 프레임 가장자리에 닿아 사방이 전부 구멍(=촬영 문제)
     · 잡티 0        → 주변이 이미 매끈(합성 배경) — 정상 */
const _plateLogged = {};
function logRenderPlateOnce(angle, diag, ow, oh){
  if(!angle || _plateLogged[angle]) return;
  _plateLogged[angle] = true;
  if(!diag){ console.log(`[렌더경계] ${angle}: 꺼짐(RENDER_PLATE.on=false) — 예전 동작(160px 확산 + 테두리 잔상)`); return; }
  const px = ow*oh;
  const holePx = diag.filled + diag.unreached;
  console.log(...gyeolBoldArgs([`[렌더경계] ${angle}: 구멍 ${holePx}px (${((holePx/px)*100).toFixed(1)}% of ${ow}×${oh})`
    + ` · <b>테두리 회수 ${diag.rim}px</b>(머리색 ${diag.hair ? 'rgb('+diag.hair.join(',')+')' : '없음'}, 최대 ${diag.rimIter}겹)`
    + ` · 방향성 채움 ${diag.filled}px · 미도달 ${diag.unreached}px`
    + ` · 거울 결 ${diag.detail}px` + (diag.detail ? '' : ` (못 가져와 잡티 σ ${diag.sigma.toFixed(2)}로 대체)`)
    + ` — 두상 밖(어깨·옷·배경)은 이 값이 최종입니다`]));
  if(diag.rim === 0){
    console.warn(`[렌더경계] ${angle}: 테두리 회수가 0입니다 — 마스크 밖에 남은 머리색 픽셀이 없다는 뜻이거나,`
      + ` 머리색(avgColor)이 없어 색 판정을 못 한 것입니다. 겹친 마스크가 계속 보이면 RENDER_PLATE.rim.tol을 키우세요.`);
  } else if(diag.rim > holePx * 0.5){
    console.warn(`[렌더경계] ${angle}: 테두리 회수가 구멍의 절반을 넘습니다(${diag.rim}/${holePx})`
      + ` — 머리색이 옷/배경과 가까워 색 판정이 번지고 있을 수 있습니다. RENDER_PLATE.rim.tol을 줄이세요.`);
  }
}

/* [진단] 살 색 격자 — 뷰당 1회. "눈이 보인다"가 다시 오면 여기서 갈린다:
     · 꺼짐/못 섬  → 타일 방식으로 떨어진 것(예전 동작) — 그러면 눈이 날 수 있다
     · 섰는데 눈   → 결(고주파)로 샌 것 → flatTol을 낮춘다
     · 씨앗 칸이 적음 → 두상 안이 거의 다 구멍(앞머리·롱헤어) — 번지기 의존도가 큼 */
function logSkinFieldOnce(angle, field, graft, useDetail, ow, oh){
  if(!angle || _fieldLogged[angle]) return;
  _fieldLogged[angle] = true;
  const F = HOLE_FILL.skinField;
  if(!F || !F.on){ console.log(`[살색격자] ${angle}: 꺼짐(HOLE_FILL.skinField.on=false) — 패치 타일 방식`); return; }
  if(!field){
    console.warn(...gyeolBoldArgs([`[살색격자] ${angle}: <b>못 섰습니다</b> — 두상 안 성한 픽셀이 모자랍니다`
      + ` · 패치 타일 방식으로 떨어집니다(그 패치에 눈이 있으면 화면에 반복됩니다)`]));
    return;
  }
  console.log(...gyeolBoldArgs([`[살색격자] ${angle}: ${field.GX}×${field.GY}칸 · 살로 잡힌 씨앗 ${field.seeded}칸`
    + ` → 번지기 ${field.passes}회로 <b>${field.filled}/${field.cells}칸</b>`
    + ` · 색은 전부 <b>자리에서</b> 옵니다(타일 없음)`
    + `\n      결: ` + (!graft ? '표본 없음 — 색만(격자는 표본 없이도 섭니다)'
        : useDetail ? `패치 고주파 σ${graft.det.toFixed(1)} ≤ ${F.flatTol} → <b>얹습니다</b>(세기 ${F.detail})`
        : `패치 고주파 σ${graft.det.toFixed(1)} > ${F.flatTol} → <b>버립니다</b>(눈·눈썹이 결로 샙니다)`)]));
}

/* [진단] 두피 이식이 실제로 먹었는지 — 뷰당 1회. 까맣게 보인다는 신고가 오면
   여기 숫자 하나로 "안 심었다 / 심었는데 다른 이유"가 갈린다. */
function logSkinGraftOnce(angle, graft, nGraft, nFlat, ow, oh, rejected){
  if(!angle || _graftLogged[angle]) return;
  _graftLogged[angle] = true;
  const px = ow*oh;
  /* 표본이 <b>어디서</b> 왔는지 적는다 (2026-08-11). 예전엔 어느 후보가 뽑혔든
     "이마 표본"이라고 찍어서, 눈 언저리에서 떠 와도 로그로는 알 수 없었다. */
  const where = g => (g.dy == null) ? '위치?' : (g.forehead ? '이마' : '<b>이마 아님</b>')
                     + ' dy' + (g.dy > 0 ? '+' : '') + g.dy.toFixed(2);
  console.log(`[두피이식] ${angle}: `
    + (graft
        ? `표본 ${graft.size}px · ${where(graft)} · 출처 ${graft.src}${graft.src!==angle?'(다른 뷰 재사용)':''}`
          + ` · 평균밝기 ${graft.lum.toFixed(0)}`
        : `표본 없음 → 두피색 단색 ${Math.round(HOLE_FILL.graft.flatMix*100)}% 혼합`)
    + ` · 이식 ${nGraft}px${nFlat?`(단색 ${nFlat}px)`:''}`
    + ` = 두상 안 구멍 ${(100*(nGraft+nFlat)/px).toFixed(1)}% of ${ow}×${oh}`);
  if(rejected) console.warn(`[두피이식] ${angle}: 이 뷰에서 뜬 표본이 ${where(rejected)}`
    + (rejected.forehead ? ` <b>인데 너무 어두워</b>` : `라`) + ` 버렸습니다`
    + ` (평균밝기 ${rejected.lum != null ? rejected.lum.toFixed(0) : '?'}).`
    + `\n    앞머리가 이마를 덮으면 이마 후보 6자리가 "불투명 98%"에서 전부 탈락하고 눈 언저리로 내려갑니다.`
    + ` 그 패치를 ${graft ? '다른 뷰 이마로 대체했습니다' : '쓰지 않고 단색으로 갔습니다'}.`);
}

// 뷰별 1회 생성 후 캐시. 두상 판정에 sectionBandsFor가 필요해서 렌더 시점에 만든다.
/* 메움 배경이 없어서 두피색 단색으로 때웠다는 것을 뷰당 한 번만 알린다.
   (2026-08-02 10차) 이 경고가 뜨면 원인은 아래 셋 중 하나다:
     ① headEllipseFor(angle)이 null — 섹션 밴드(정수리/턱선)가 아직 없음
     ② pickSkinPatch 실패 — 얼굴에서 깨끗한 피부 정사각형을 못 찾음
     ③ buildHoleFillCanvas 예외 */
const _holeFillWarned = {};
function warnHoleFillOnce(angle){
  if(_holeFillWarned[angle]) return;
  _holeFillWarned[angle] = true;
  const ell = (typeof headEllipseFor === 'function') ? headEllipseFor(angle) : null;
  console.warn(`[메움] ${angle}: 구멍 메움 배경이 없어 두피색 단색으로 대체했다`
    + ` (두상 타원 ${ell ? '있음' : '없음'}). 세그멘테이션 안이 검게 비치는 증상의 원인 자리.`);
}

function getHoleFillCanvas(angle, baseC, maskInf){
  if(!baseC) return null;
  /* (2026-09-19) 구멍 마스크가 눈·눈썹 랜드마크를 보려면 이 캔버스가 어느 뷰인지 알아야 한다.
     buildHoleMask·buildCleanBaseCanvas는 뷰를 안 받는데, 07b에서 이 함수가 둘보다 먼저 불린다. */
  if(!baseC._view) baseC._view = angle;
  const cached = state.baseFillCanvases && state.baseFillCanvases[angle];
  /* (2026-09-16) 서명에 두개골 실루엣(viewCal)을 넣는다 — 모델이 메움보다 늦게 서므로
     안 넣으면 타원으로 구운 첫 메움이 끝까지 남는다 */
  /* (2026-09-16) 이마 표본(_skinGraft)의 유무도 서명에 넣는다. 실기기(남성): 후면이
     정면보다 <b>먼저</b> 구워져 "[전면이식] back: 이마 표본 없음 → 단색 85%"로 캐시됐고,
     정면이 표본을 뜬 뒤에도 그 단색 메움이 끝까지 남았다. */
  const sig = skullClipSig(angle) + '|graft:' + (_skinGraft ? (_skinGraft.src || 'y') : 'none');
  if(cached && cached._src === baseC && cached._skullSig === sig) return cached;
  if(cached && cached._src === baseC && cached._skullSig !== sig){
    delete _skullClipLogged[angle];
    delete _facelessLogged[angle]; delete _graftLogged[angle];
    try{ baseC._cleanBase = null; }catch(e){}
  }
  let c = null;
  try{
    c = buildHoleFillCanvas(baseC, maskInf && maskInf.scalpColor, headEllipseFor(angle), angle, maskInf);
  }catch(e){ console.warn('구멍 메움 배경 생성 실패:', angle, e); }
  if(c){ c._src = baseC; c._skullSig = skullClipSig(angle) + '|graft:' + (_skinGraft ? (_skinGraft.src || 'y') : 'none');   // 굽는 중에 이 뷰가 표본을 세웠으면 그 뒤 서명으로(헛 재굽기 방지)
      if(state.baseFillCanvases) state.baseFillCanvases[angle] = c; }
  return c;
}

/* ── 조정 화면 머리 확대 (2026-07-26) ─────────────────────────────────
   사용자 상황: "노트북으로 작업하고 있어서 어쩔 수 없어. 정수리까지 나오려면."
   맞다 — 노트북 웹캠으로 정수리까지 담으려면 뒤로 물러날 수밖에 없고, 그러면
   머리가 프레임의 20%밖에 안 된다. 진단 로그 기준 <b>머리 전체가 화면에서 142px</b>.
   여기에 결을 그리는 건 우표 크기에 머리카락을 그리는 것과 같아서, 렌더를
   아무리 손봐도 한계가 있다(다발 5개 × 0.7px + 틈 0.9px = 다발 하나가 화면
   4.5px — 머리가 142px이면 다발 30개면 머리가 꽉 찬다).
   촬영은 못 바꾸니 <b>보는 쪽</b>을 바꾼다: 조정 화면만 머리에 맞춰 확대한다.
   가닥은 벡터로 다시 그려지니 확대해도 선명하고, 배경 사진만 부드러워진다
   (baseC는 어차피 머리카락이 지워진 얼굴·배경이라 손해가 작다).
   ※ fit이 "배율 + 평행이동"이라 확대는 dw/dh/dx/dy만 바꾸면 된다 —
     makeImgToCanvas·가닥 투영·마스크 clip이 전부 fit을 통하므로 자동으로 따라온다.
   ※ 재구성(3D)에는 전혀 관여하지 않는다. 순수하게 표시 배율만. */
