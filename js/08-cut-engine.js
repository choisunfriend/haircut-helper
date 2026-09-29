/* ══════════════════════════════════════════════════════════
   08-cut-engine.js — 공용 계산 유틸 · 커트 연산 · 길이 슬라이더 범위
   원본 index.html 12406~12903행. 클래식 스크립트이므로 로드 순서가 곧
   실행 순서다 — index.html의 <script src> 순서를 바꾸지 말 것.
   ══════════════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════════════════════
   공용 계산 유틸 — 해시·각도·좌표변환·폴리라인·색
   특정 구역에 속하지 않고 2D/3D 양쪽에서 쓰이는 작은 순수 함수들.
   hashFract(가닥별 안정 난수) / wrapPi(±π 접기) / makeImgToCanvas(좌표 매핑)
   / strokeSmoothPolyline(부드러운 선) / gyShade(hex 밝기).
   ════════════════════════════════════════════════════════════════ */
// 컬럼별(ix 기준) 스타일 파라미터 계산 4종을 묶어서 만들어주는 팩토리.
// 4개 함수(lengthRatioFor/colorForSection/curlMultFor/frontDirBiasFor)
// 전부 원래 drawHairStrands 안의 중첩 함수였던 것을 그대로 옮긴 것 —
// 로직·주석·캐시 방식 전부 변경 없음, 감싸는 함수 경계만 바뀜.
// ── 공용 유틸(2026-07-22 중복 통합) ──
// 결정적 의사난수 fract(sin(x)·43758.5453) — 프레임마다 같은 값이 나와 화면
// 깜빡임(shimmer) 방지. pseudoRandForCol/결불연속 임계/슬라이스 스태거가 각자
// 인라인하던 동일 해시를 하나로. 인자를 그대로 넘기므로 산술 결과 완전 동일.
function hashFract(x){ const v = Math.sin(x) * 43758.5453; return v - Math.floor(v); }
// 각도를 (-π, π]로 접기 — "최단 회전 방향"을 구할 때 쓰는 관용구.
// 파일 곳곳(결 추종 보간·중력 복원·이탈 후 수렴·가르마 각거리)에 while 2줄로
// 5번 복제돼 있던 것을 통합(2026-07-26). 동작 동일.
function wrapPi(a){
  while(a >  Math.PI) a -= Math.PI*2;
  while(a < -Math.PI) a += Math.PI*2;
  return a;
}
// 마스크(이미지) 좌표 → 캔버스 좌표 매핑 팩토리 — drawHairStrands(toCanvasX/Y)와
// projectHair3DToView(toCX/toCY)가 글자 그대로 같던 두 클로저를 통합.
function makeImgToCanvas(fit, maskW, maskH){
  return {
    toX: (ix) => fit.dx + (ix / maskW) * fit.dw,
    toY: (iy) => fit.dy + (iy / maskH) * fit.dh,
  };
}
// 점 배열({x,y})을 quadratic 중간점 보간으로 부드럽게 스트로크(현재 ctx 스타일 사용).
// drawHairStrands의 strokePolyline과 projectHair3DToView의 인라인 루프가 글자
// 그대로 같던 것을 통합 — beginPath→moveTo→중간점 곡선→마지막 lineTo→stroke.
function strokeSmoothPolyline(ctx, pts){
  if(pts.length < 2) return;
  ctx.beginPath();
  traceSmoothPolyline(ctx, pts);
  ctx.stroke();
}
// 위와 같은 곡선을 "경로만" 쌓는다(beginPath/stroke 없음) — 여러 가닥을 한
// beginPath에 몰아넣고 stroke를 1회로 줄이는 슬라이스 배치용(2026-07-26).
// off를 주면 진행 방향의 수직으로 그만큼 밀어낸 사본을 그린다(다발 속 가닥 배치).
function traceSmoothPolyline(ctx, pts, off){
  if(!pts || pts.length < 2) return;
  const P = off ? offsetPolyline(pts, off) : pts;
  ctx.moveTo(P[0].x, P[0].y);
  for(let i=1;i<P.length-1;i++){
    const mx = (P[i].x + P[i+1].x)/2;
    const my = (P[i].y + P[i+1].y)/2;
    ctx.quadraticCurveTo(P[i].x, P[i].y, mx, my);
  }
  const last = P[P.length-1];
  ctx.lineTo(last.x, last.y);
}
// 폴리라인을 진행 방향의 수직으로 off px 평행이동한 사본
function offsetPolyline(pts, off){
  const out = new Array(pts.length);
  for(let i=0;i<pts.length;i++){
    const a = pts[Math.max(0,i-1)], b = pts[Math.min(pts.length-1,i+1)];
    const tx = b.x-a.x, ty = b.y-a.y, L = Math.hypot(tx,ty) || 1;
    out[i] = { x: pts[i].x + (-ty/L)*off, y: pts[i].y + (tx/L)*off };
  }
  return out;
}

// gyeol 색 밝기 조정 유틸(hex 전용) — 섹션별 컬러/스타일링 광택(finish)에 사용.
// hex가 아니면(rgb() 실측색 등) 원본을 그대로 돌려줌.
function gyShade(hex, amt){
  if(typeof hex!=='string' || hex[0] !== '#' || hex.length < 7) return hex;
  const n=parseInt(hex.slice(1,7),16);
  if(Number.isNaN(n)) return hex;
  let r=(n>>16)+amt, g=((n>>8)&255)+amt, b=(n&255)+amt;
  r=Math.max(0,Math.min(255,r)); g=Math.max(0,Math.min(255,g)); b=Math.max(0,Math.min(255,b));
  return '#'+((r<<16)|(g<<8)|b).toString(16).padStart(6,'0');
}

/* ════════════════════════════════════════════════════════════════
   커트 연산 — 섹션 파라미터 → 컬럼별 길이·레이어·색 해석
   시술각(elevation)·기법(technique)·페이드를 "이 뿌리 컬럼의 길이 배율"과
   "레이어 델타"로 바꾸는 곳. createColumnStyleResolvers가 그 단일 출처이며,
   가닥을 그리는 쪽(drawHairStrands)은 여기서 받은 함수만 호출한다.
   ════════════════════════════════════════════════════════════════ */
// 커트 겹 강도(끝점 수렴/확산 최대치를 rootSpan의 몇 배로 볼지) — 튜닝 지점.
const CUT_LAYER_GAIN = 0.5;
// 길이 슬라이더 1칸당 길이 배율 변화 — 2D 렌더(createColumnStyleResolvers)와
// 3D 조정 엔진(gy3d*)이 반드시 같은 감도를 써야 두 경로의 결과가 일치하므로
// 전역 단일 출처로 승격(2026-07-22). 값·의미는 기존 RATIO_PER_UNIT 그대로.
const LENGTH_RATIO_PER_UNIT = 0.018; // (9차) 0.012→0.018: 실기기 "길이 변화가 너무 조금" — 슬라이더 1칸당 변화 +50%
/* ── 길이 배율 하한 (2026-07-26 버그 수정) ────────────────────────────
   증상: 길이 슬라이더를 30 → 24로 "더 짧게" 내리면 머리가 갑자기 원래 길이로
        돌아왔다(실기기에서 사용자가 감지, 점검 하네스로 재현·특정).
   원인: ratio = 1 + (v - 기본값)×0.018 이 슬라이더 25 아래에서 음수가 되고
        Math.max(0, …)이 그걸 0으로 만드는데, lengthStrand3D의 가드가
        !(ratio > 0) → return pts, 즉 0을 "길이 0"이 아니라 "조정 안 함"으로
        해석해 원본을 그대로 돌려줬다. 2D 경로(createColumnStyleResolvers)도
        같은 식이라 같은 증상이 있었다.
   수정: 하한을 0이 아니라 작은 양수로. 슬라이더 하단은 "더 짧아지지 않는"
        평평한 구간이 되지만 뒤집히지는 않는다(단조 보장).
   ※ 감도(0.018)는 실기기 튜닝값이라 건드리지 않았다. 하단 평평한 구간까지
     없애려면 기본값 아래쪽 기울기를 (1-MIN)/기본값으로 다시 잡아야 하는데,
     그건 전 구간 손맛이 바뀌는 변경이라 별도 판단이 필요하다. */
/* ── 깊이 복원의 조건수 가중 (2026-07-26) ──────────────────────────────
   d² = (E² − W²cos²θ) / sin²θ 는 θ가 작을수록 1/sin²θ 로 오차가 증폭된다.
   실루엣 관측 E의 2% 오차가 복원 깊이 오차로 얼마나 커지는지(정답 D=0.90):
     15° → ±0.18   25° → ±0.07   35° → ±0.04   45° → ±0.03
   즉 얕은 각도의 관측은 "틀린 게 아니라 못 믿을" 값인데, 예전엔 sin²>0.06(≈14°)만
   넘으면 모두 같은 무게로 평균해서 얕은 뷰 하나가 깊이를 통째로 흔들 수 있었다.
   (사용자 보고: "각도가 40도는 넘어야 되나봐, 3D 이미지가 또 깨졌어" — 맞는 관찰)
   → 관측 무게에 sin²θ를 곱한다. 45°는 20°보다 4배 무겁게 반영되고, 얕은 뷰는
     버리지 않되 영향이 자연히 작아진다. 쓸 만한 각도가 아예 없으면 기존 폴백. */
const DEPTH_MIN_SIN2 = 0.06;   // 이보다 얕으면(≈14°) 아예 제외 — 수치적으로 무의미
// 깊이 관측 하나의 무게: 신뢰도 × 조건수(sin²θ). 2D/3D 두 복원 경로의 단일 출처.
function depthObsWeight(sin2, confidence){ return (confidence == null ? 1 : confidence) * sin2; }
/* ── 깊이 역산 (2026-08-23 중복 통합) ──────────────────────────────────
   D² = (E² − W²cos²θ) / sin²θ 를 측면성 충분한 관측에서 가중평균한다.
   이 식이 파일에 <b>세 벌</b> 있었다 — getHeadCrossSections · 헐 피팅 ·
   그 옆의 "예전 방식" 진단. 세 곳 다 같은 여섯 줄인데, 셋째는 E 대신 span을
   본다(그게 예전 방식과 지금을 가르는 유일한 차이라서 진단이 성립한다).
   같은 식이 세 벌이면 한 곳만 고쳐도 나머지 둘이 조용히 다른 값을 낸다 —
   특히 셋째는 <b>비교 대상</b>이라 갈라지면 진단 자체가 거짓이 된다.
   ⚠ 클램프는 <b>안 넣는다</b>. 부르는 세 곳의 하한이 다르고(0.5W / 0.35W),
     그건 각자 근거가 있는 안전레일이라 여기서 통일하면 동작이 바뀐다.
   반환: 가중평균한 D. 쓸 만한 관측이 하나도 없으면 null(호출부가 폴백한다). */
function solveDepthFromObs(list, W, valOf){
  let dAcc = 0, dW = 0;
  for(const o of list){
    if(o.sin2 <= DEPTH_MIN_SIN2) continue;
    const E = valOf ? valOf(o) : o.E;
    const d2 = (E*E - W*W*o.cos2) / o.sin2;
    if(d2 > 0){ const w = depthObsWeight(o.sin2, o.confidence); dAcc += Math.sqrt(d2)*w; dW += w; }
  }
  return dW ? dAcc/dW : null;
}
const LENGTH_RATIO_MIN = 0.05; // 두피에 붙은 최소 길이(=삭발 수준). 0이면 위 버그가 재발한다.
/* ══════════════════════════════════════════════════════════════════
   길이 슬라이더 범위 — <b>재고 나서</b> 옮겼다 (2026-08-26)
   ─────────────────────────────────────────────────────────────────
   사용자: "다섯 섹션 전부 슬라이더 범위 끝에 붙어 있었다 → 이 경우는 <b>슬라이더
   범위 조절</b>해야지. 어느 부분까지가 범위 조절해서 가능한지."
   맞는 말이라 <b>먼저 쟀다</b>(h_range.js, 합성 두상 540가닥, 스타일링 중립):

     섹션      ratio가 주는 범위    <b>실제로 나오는 범위</b>
     crown     0.05 ~ 1.36          0.48 ~ 1.16
     front     0.05 ~ 1.36          0.71 ~ 1.07
     temple    0.05 ~ 1.36          0.78 ~ 1.07
     side      0.05 ~ 1.36          0.75 ~ 1.15
     occipital 0.05 ~ 1.36          0.46 ~ 1.23
     nape      0.05 ~ 2.17          <b>1.00 ~ 1.00</b>  ← 아예 안 먹는다

   ── 두 가지가 <b>서로 다른 원인</b>으로 좁았다 ────────────────────────
   ① <b>짧아지는 쪽</b>은 슬라이더 문제가 <b>아니다</b>. ratio는 0.05까지 열려
      있는데 실제로는 0.46이 바닥이다. 병목은 cutRatioForStrand의 시술각 식이다:
          L = Ltip + (Lref − Ltip) × elevT
      Lref는 ratio를 타지만 <b>Ltip은 안 탄다</b>(그 가닥이 가이드 높이까지 가는
      호길이라 슬라이더와 무관하다). elevT가 작으면 L이 Ltip에 붙어 버린다.
      실측 — len0에서 시술각만 바꿨을 때 나오는 길이:
          elev0 19.1cm · elev30 12.9cm · elev45 9.0cm · <b>elev90 0.98cm</b>
      즉 <b>짧게 자르는 손잡이는 시술각</b>이고, 그건 미용 이론 그대로다
      (시술각을 세워야 위층이 짧아진다). 범위를 넓힐 게 아니라 <b>프리셋이
      시술각을 제대로 쓰면</b> 된다. 슬라이더 하한은 손대지 않는다.
   ② <b>길어지는 쪽</b>은 진짜로 슬라이더 문제였다. 기본값이 80이라 위로 20칸,
      0.018×20 = <b>1.36배</b>가 천장이었다. 기본값을 <b>50</b>으로 옮기면 위아래가
      50칸씩 되고 천장이 <b>1.9배</b>가 된다.
   ⚠ 기본값을 옮겨도 <b>첫 화면 그림은 안 바뀐다</b> — baseLen == len이면 ratio가
     정확히 1이라(사진 그대로) 80→80이든 50→50이든 같은 값이다. 바뀌는 것은
     슬라이더 손잡이의 <b>위치</b>와 위쪽 여유뿐이다.
   ⚠ 2026-07-22 5차가 "프리셋 length 절대값 해석이 바뀐다"고 경고해 둔 항목은
     <b>지금은 해당 없다</b>. 그때는 프리셋이 슬라이더 값을 직접 적었지만, 지금은
     applyStyleSpec이 tipAt·lenCm으로 <b>역산</b>하므로 기본값이 옮겨가면 이분탐색이
     알아서 다른 슬라이더 값을 찾는다. 스펙 파일은 한 글자도 안 고쳐도 된다.
   ⚠ nape이 <b>0/50/100에서 전부 같은 길이</b>로 나온 것은 이 수정과 별개의
     미해결 항목이다 — 위 ①의 극단(Ltip이 L을 통째로 지배)으로 보이지만
     확인 전이다. 하네스에 그대로 남겨 뒀다(h_range.js).
══════════════════════════════════════════════════════════════════ */
// 섹션 길이 슬라이더 → 길이 배율. 2D/3D 두 경로의 단일 출처(감도·하한·기본값 해석 공유).
function sectionLengthRatio(secId, lenParam){
  const d = SECTIONS[secId] && SECTIONS[secId].defaults;
  const baseLen = (d && typeof d.length === 'number') ? d.length : 50;
  const len = (typeof lenParam === 'number') ? Math.max(0, Math.min(100, lenParam)) : baseLen;
  // 기본값 위: 실기기에서 튜닝한 감도(0.018/칸) 그대로 — 길이는 위로 열려 있다.
  if(len >= baseLen || baseLen <= 0) return 1 + (len - baseLen) * LENGTH_RATIO_PER_UNIT;
  // 기본값 아래: 0에서 MIN, 기본값에서 1이 되도록 선형 매핑.
  // 같은 0.018을 아래쪽에도 쓰면 슬라이더 25 아래가 전부 하한에 눌려 죽고
  // (사용자: "길이가 갑자기 늘어난다"), 그 사각지대를 벗어나는 순간 급증한다.
  // 짧아지는 쪽은 두피라는 물리적 바닥이 있어 위쪽과 감도가 달라도 된다.
  return LENGTH_RATIO_MIN + (1 - LENGTH_RATIO_MIN) * (len / baseLen);
}
// 기법 → 커트 축(0=원랭스 … 1=유니폼 … 2=인크리스). 시술각(elevation)이 ±로 미세 조정.
const CUT_TECH_AXIS = { onelength:0, graduation:0.5, uniform:1, increase:1.6 };
// 뿌리 위치 → 겹 길이 델타(px). createColumnStyleResolvers의 cutLayerDeltaFor에서 쓰던
// 순수 계산을 분리 — 시술각/기법이 만드는 레이어(끝점 재분포)를 rootSpan 물리 스케일로 계산.
//   sec: 해당 섹션 파라미터(technique/elevation), rootY: 이 컬럼 뿌리의 세로 위치(px),
//   rootSpan: 뷰 전체 뿌리 세로 범위, maxRootY: 가장 낮은(아웃라인) 뿌리의 y.
// 반환: 양수=수렴(원랭스/무게선), 0=유니폼(무변화), 음수=확산(인크리스/롱레이어).
function computeCutLayerDelta(sec, rootY, rootSpan, maxRootY){
  if(!sec) return 0;
  const tech = sec.technique || 'uniform';
  const elev = (typeof sec.elevation === 'number') ? sec.elevation : 45;
  const techBase = (CUT_TECH_AXIS[tech] !== undefined) ? CUT_TECH_AXIS[tech] : 1;
  // 시술각 45°=중립. 높을수록 축을 유니폼/인크리스 쪽(레이어↑), 낮을수록 원랭스 쪽(무게↑).
  const axis = Math.max(0, Math.min(2, techBase + ((elev - 45) / 90) * 0.6));
  const w = 1 - axis; // +1(수렴/원랭스) … 0(유니폼) … -1(확산/인크리스)
  if(w === 0) return 0;
  // rootT: 뿌리 높이(1=정수리쪽 높은 뿌리, 0=아웃라인 낮은 뿌리).
  const rootT = Math.max(0, Math.min(1, (maxRootY - rootY) / rootSpan));
  // 원랭스(w>0): 높은 뿌리(rootT↑)를 더 길게 → 끝 수렴. 인크리스(w<0): 높은 뿌리를 짧게.
  return rootSpan * rootT * w * CUT_LAYER_GAIN;
}

/* ══════════════════════════════════════════════════════════════════
   2D 조정 엔진을 <b>끈다</b> — 조정은 3D 한 벌이다 (2026-09-01 6차)
   ─────────────────────────────────────────────────────────────────
   사용자: "이거 2D 투영 있잖아.. 내가 볼 땐 <b>2D 자체에 조정 엔진이 있어</b>.
   그런데 3D를 기준으로 모든 조정이 짜여 있기 때문에, <b>3D를 단순 투영하는
   걸로 바꾸는 게</b> 좋을 거 같아."
   맞다. 조정 경로는 2026-07-26에 3D 하나로 단일화했는데 <b>이 벌을 안 지웠다</b>.
   createColumnStyleResolvers 안에 길이 배율(lengthRatioFor) · 겹 델타
   (cutLayerDeltaFor) · 앞머리 방향(frontDirBiasFor) · 컬 · 웨이브 · 텍스처가
   통째로 남아 있다. "투영 실패 폴백"이라는 명분이었지만, 결과는 <b>같은
   손잡이를 읽는 조정기가 두 벌</b>이다.
   내가 line을 3D로 옮기면서 "이제 두 벌이므로 폴백에서만 밑단이 다르게 나온다,
   정리는 다음 사안"이라고 적었다. 그 다음 사안이 여기다.

   ── 끄는 방법: <b>출력이 아니라 입력</b>을 중립으로 ─────────────────────
   리졸버마다 "중립값이 뭐냐"를 내가 정해 주면 그게 <b>세 번째 벌</b>이 된다
   (이 파일이 반복해서 당한 그것). 대신 <b>중립 입력</b>을 넣어 각 리졸버가
   자기 정의대로 항등을 내게 한다:
     technique uniform · elevation 45 → computeCutLayerDelta의 w = 0 → 델타 0
     length = 그 섹션 defaults.length → sectionLengthRatio = <b>정확히 1</b>
     texture 0 · curl 0 · wave 50 · curlDir 0 · line 50 · density 100
     styling 전부 중립(neutralStyling)
   수식을 안 건드리므로 "중립이 정말 항등인가"를 <b>하네스로 잴 수 있다</b>.

   ⚠ 색(colorForSection)은 <b>안 끈다</b>. 색은 기하가 아니고, 중립 캡처가
     사진에서 실측한 섹션별 색을 그대로 받아야 한다. 끄면 캡처가 색을 잃는다.
   ⚠ drawHairStrands는 살아 있다 — ⓐ 중립 캡처 ⓑ 원본 결 보기 ⓒ 투영 실패
     폴백. ⓐ는 <b>조정 전</b>을 잡는 것이라 조정기가 없는 게 오히려 맞고,
     ⓑ는 이름 그대로 원본이다. ⓒ에서 조정이 빠지는 건 손실이지만, 그 대가로
     "두 벌이 갈라진다"가 사라진다. ⓒ가 실제로 도는지는 아래 폴백 카운터가
     센다 — 안 돌면 손실도 0이다.
   되돌리기: CUT2D_ENGINE.on = true
══════════════════════════════════════════════════════════════════ */
const CUT2D_ENGINE = { on: false };
/* 겹 정렬 키 — true면 <b>뿌리 깊이</b>(길이를 바꿔도 안 튄다), false면 예전
   평균 깊이. projectHair3DToView의 6차 주석 참고. */
/* bigSpan — "이 가닥은 깊이 스칼라 하나로 대표할 수 없다"의 문턱. 가닥의 깊이
   폭을 두상 깊이 반경(c)으로 나눈 값이고, 0.5면 <b>가닥 하나가 두상 앞뒤의
   절반을 가로지른다</b>는 뜻이다. 왜 0.5인가 — 이건 실측이 아니라 <b>기하가
   주는 눈금</b>이다. 뿌리에서 곧게 떨어지는 가닥은 폭이 0에 수렴하고, 두상을
   반 바퀴 감아 도는 가닥이라야 c의 절반을 넘는다. 즉 0.5는 "돌아 나왔다"의
   경계이지 튜닝값이 아니다. 실기기 [깊이 폭] 표가 이 문턱에서 갈리지 않으면
   (전부 0%거나 전부 100%면) 그때 표를 보고 옮긴다. */
const DEPTH_SORT = { byRoot: true, bigSpan: 0.5 };
/* 겹 정렬 동점 처리 (2026-09-09 4차) — 자세한 근거는 15-project-3d.js의
   projected.sort 배너. 깊이가 tieBand 안으로 비면 뿌리가 <b>높은</b> 가닥을
   나중에 그린다(=위에 얹는다). 정수리 가닥이 옆·후두부 밑에 깔리던 자리다.
   tieBand는 두상 깊이반경 대비 — 키우면 더 많은 쌍이 높이로 정렬된다. */
/* topSections: 깊이보다 <b>위</b>에 있는 1차 키 — 여기 든 섹션은 맨 나중에
   그린다(= 제일 위에 보인다). 2026-09-12, 15-project-3d.js 정렬부 배너 참고.
   빈 배열이면 예전 동작 그대로. */
const LAYER_SORT = { tieByRootHeight: true, tieBand: 0.25, topSections: ['crown'] };
const PROJ_FALLBACK = { n: 0, lastAngle: null };   // ⓒ가 실제로 도는가
function neutralSectionsForRender(){
  const out = {};
  for(const id in SECTIONS){
    const d = (SECTIONS[id] && SECTIONS[id].defaults) || {};
    out[id] = { technique:'uniform', elevation:45, texture:0, density:100,
                curl:0, wave:50, curlDir:0, line:50, color:null,
                overdirection:0,
                length: (typeof d.length === 'number') ? d.length : 50 };
  }
  return out;
}

function createColumnStyleResolvers({ maskW, maskH, iScalpY, sections, angle, color, avgColorsBySection, styling }){
  /* 조정은 3D 한 벌이다(위 배너). 입력을 중립으로 갈아 끼우면 아래 수식은
     한 줄도 안 고친 채 항등이 된다 — 되돌리기가 스위치 하나로 끝난다. */
  if(!CUT2D_ENGINE.on){
    sections = neutralSectionsForRender();
    styling  = (typeof neutralStyling === 'function') ? neutralStyling() : null;
  }
  // 컬럼 인덱스 클램프 [0, maskW-1] — makeColumnResolver/colorForSection이 각자
  // 인라인하던 동일 식을 통합(중복 제거, 동작 동일).
  const clampCol = (ix) => Math.min(maskW-1, Math.max(0, Math.round(ix)));
  // ── 컬럼별 길이 배율: 슬라이더 50 = 원본 길이(origLen) 그대로(ratio=1).
  // 기존엔 "덧셈"(절대 px, origLen과 무관하게 항상 같은 양만큼 변화)이었으나,
  // 이 방식은 origLen이 작은 부위(사이드/네이프처럼 세그멘테이션이 짧게 잡힌 곳)에서
  // 같은 절대값이 상대적으로 훨씬 크게 작용해 그 부위만 원래 세그멘테이션 형태를
  // 벗어나 툭 튀어나오는 문제가 있었음. → "배율"로 바꿔서 origLen에 비례하게 늘리고
  // 줄여, 세그멘테이션이 잡은 원래 형태(비율)를 그대로 유지한 채 커지고 작아지게 함.
  // (짧은 부위는 짧은 만큼, 긴 부위는 긴 만큼 — 같은 비율로 변화)
  // TODO: 배율 방식으로 모양을 먼저 잡은 뒤, 조정 단계에서 슬라이더 감도(RATIO_PER_UNIT)를
  // 다시 튜닝할 예정 — 지금은 형태 검증이 우선.
  // ── 컬럼별 값 리졸버 공통 골격(2026-07-18 통합) ──
  // lengthRatioFor/curlMultFor/frontDirBiasFor가 "ix→컬럼 클램프 → Float32Array
  // +NaN 캐시 조회 → ny/nx 정규화 → resolveSectionId" 5줄을 각자 복제하고
  // 있던 것을 팩토리로 통합. compute(secId,cx,nx,ny)만 리졸버마다 다름.
  // 캐시 타입(Float32Array)과 "첫 호출은 계산값(float64), 이후는 캐시값
  // (float32)을 반환"하는 기존 특성까지 그대로 유지 — 동작 무변경.
  // ※ colorForSection은 제외: 모양은 같아 보여도 avgColorsBySection이 없으면
  //   섹션 해석 자체를 건너뛰고, 섹션 판정 조건도 (sections && angle)이 아니라
  //   (angle)이라 로직이 실제로 다름.
  function makeColumnResolver(compute){
    // ── 뿌리 실좌표 기반 판정(2026-07-22) ──
    // 예전엔 캐시가 "컬럼당 1값"(Float32Array)이었고 섹션 판정도 컬럼의 두피
    // 최상단선(iScalpY)만 사용 — 루트 확산 레이어가 귀 옆/목덜미 깊이에 심은
    // 뿌리조차 전부 "실루엣 꼭대기 기준 섹션"으로 먹혀서, 측면 뷰에서 사실상
    // 모든 가닥이 side 하나로 뭉쳤음("사이드만 조정하면 전체가 움직인다"의 원인).
    // 이제 호출부(drawStrandLayer)가 실제 뿌리 좌표로 판정한 secId/rootNy를
    // 넘겨주면 그대로 쓰고(캐시 키를 컬럼×섹션×뿌리깊이 1% 양자화로 확장),
    // 안 넘기는 기존 호출부는 예전과 동일하게 최상단선 판정으로 폴백한다.
    const cache = {};
    return function(ix, secIdOpt, rootNyOpt){
      const cx = clampCol(ix);
      const nx = cx/maskW;
      const ny = (typeof rootNyOpt === 'number')
        ? rootNyOpt
        : (iScalpY[cx] >= 0 ? iScalpY[cx]/maskH : 0.15);
      const secId = secIdOpt || ((sections && angle) ? resolveSectionId(angle, nx, ny) : 'crown');
      const key = secId + ':' + cx + ':' + ((ny*100)|0); // 깊이 의존 값(페이드/겹 델타) 때문에 ny도 키에 포함
      const hit = cache[key];
      if(hit !== undefined) return hit;
      const v = compute(secId, cx, nx, ny);
      cache[key] = v;
      return v;
    };
  }

  // 슬라이더 감도 재조정(2026-07-13): 이전엔 0.04였는데, 50 기준 ±1칸당
  // 4%씩 움직여서 슬라이더 0~25 구간 전체가 배율 0(완전히 클램프)으로
  // 뭉개지고, 반대쪽은 최대 3배까지 튀는 극단적인 감도였음(실기기 피드백:
  // "크라운 길이가 너무 훅훅 바뀐다"). 0~100 전체 범위가 고르게 반응하고
  // 극단값도 다루기 쉬운 폭(0.4배~1.6배)이 되도록 계수를 낮춤 — 죽은구간 없음.
  // 컬럼 위치(cx) 기반 결정적 의사난수 — Math.random() 대신 써서 매 프레임(재렌더) 마다
  // 같은 컬럼이 다른 값을 받아 화면이 깜빡이는(shimmer) 것을 방지. seed로 서로 다른
  // 패턴(네이프용/사이드용)을 만들어 두 효과가 같은 자리에서 안 겹치게 함.
  function pseudoRandForCol(cx, seed){ return hashFract(cx*seed); }
  const lengthRatioFor = makeColumnResolver((secId, cx, nx, ny)=>{
    const lenParam = (sections && sections[secId] && typeof sections[secId].length==='number')
      ? sections[secId].length : 50;
    // ── 배율 기준점 수정(2026-07-22 5차): "기본값 = 원본 커트" ──
    // 예전엔 50=원본(ratio 1) 고정이라, 섹션 기본값이 80(설계 의도: "커트지 새
    // 스타일이 아니니 원본에 가깝게")인 상태에서 기본 렌더가 이미 1.36×로 늘어나
    // 있었음 — 실기기 "머리가 내려와 있는 것 같다"의 원인. 기준점을 각 섹션의
    // 기본값(defaults.length)으로 바꿔서, 슬라이더가 기본 위치면 사진 그대로
    // (ratio=1), 내리면 원본보다 짧게, 올리면 길게 — 미용사 직관과 일치.
    // (프리셋 스타일의 length 절대값 해석도 이 기준으로 바뀜 — 프리셋 강도는
    // 추후 재튜닝 대상으로 기록)
    let ratio = sectionLengthRatio(secId, lenParam);
    // 커트기법(원랭스/그라데이션/유니폼/인크리스)에 의한 "뿌리높이별 겹" 분포는
    // 여기(길이 슬라이더 배율)가 아니라 cutLayerDeltaFor(아래)에서 px 단위로 더한다.
    // 겹은 root 위치에 따른 끝점 재분포이므로, 단순 길이배율과 분리해야 지오메트리가
    // 정확하다(섹션 경계와 무관하게 뷰 전체 두피선 기준으로 연속적으로 계산).

    // ── ②nape.line(스퀘어/라운드/테이퍼): 컬럼별 길이 배율에 추가 변조 ──
    // 스퀘어(0)일수록 배율을 1(=원본 길이 그대로, 변화 없음)쪽으로 당겨서 끝이
    // 뭉툭하고 균일하게 보이게. 테이퍼(100)일수록 컬럼마다 배율을 크게 들쭉날쭉
    // 흔들어서 끝이 성글게 갈라지는(가늘어지는) 느낌을 냄. 50(라운드)이면 무변화.
    if(secId === 'nape' && sections.nape && typeof sections.nape.line === 'number'){
      const t = (sections.nape.line - 50) / 50; // -1(스퀘어) ~ 0(라운드) ~ +1(테이퍼)
      if(t > 0){
        const jitterRange = t * 0.5;
        const pr = pseudoRandForCol(cx, 12.9898);
        ratio *= (1 - jitterRange*0.5 + pr*jitterRange);
      } else if(t < 0){
        const flatten = -t; // 0~1
        ratio = ratio*(1-flatten) + 1*flatten;
      }
    }

    // ── ③엘리베이션(시술각, 크라운/사이드/후두부 공통): 컬럼별 길이 배율에 편차 추가 ──
    // 실제 기법: 시술각이 높을수록(90°에 가까울수록=레이어 강하게) 그라데이션이
    // 강해져서 인접 컬럼끼리 길이 편차가 커짐("짧은 가닥·긴 가닥이 섞인" 레이어드
    // 텍스처). 0°(원랭스)면 무변화 — 예전엔 이 효과가 side.layer 하나에만 있었는데,
    // 엘리베이션은 크라운/사이드/후두부 셋 다에 있는 파라미터라 셋 다 반영.
    const ELEV_SEED = { crown:31.719, side:78.233, occipital:55.123 };
    if(ELEV_SEED[secId] && sections[secId] && typeof sections[secId].elevation === 'number'){
      const elevT = Math.max(0, Math.min(1, sections[secId].elevation / 90)); // 0~1
      if(elevT > 0){
        const jitterRange = elevT * 0.55;
        const pr = pseudoRandForCol(cx, ELEV_SEED[secId]);
        ratio *= (1 - jitterRange*0.5 + pr*jitterRange);
      }
    }

    // ── 페이드/테이퍼(클리퍼, 길이 기준 — 엘리베이션과 완전히 별개) ──
    // 실제 기법: 가드 번호(0~8, 1단위=1/8인치)로 구레나룻/목선 쪽부터 점점
    // 짧아지게 블렌딩. 섹션의 세로 범위 안에서 "하단(구레나룻/목선 쪽)에
    // 얼마나 가까운가"를 진행률로 보고, 페이드 존 안이면 목표 비율을 가드
    // 길이 쪽으로 끌어당김. front/crown은 실제로도 클리퍼 페이드 대상이
    // 아니라서 적용 안 함(FADE_SECTIONS에 없는 섹션은 무조건 통과).
    const FADE_SECTIONS = { temple:1, side:1, occipital:1, nape:1 };
    if(state.fade && state.fade.enabled && FADE_SECTIONS[secId] && SECTIONS[secId]){
      const yr = SECTIONS[secId].yRange;
      const span = (yr[1]-yr[0]) || 0.001;
      // progressFromBottom: 0=섹션 맨 아래(구레나룻/목선에 가장 가까움), 1=섹션 맨 위
      const progressFromBottom = 1 - (ny - yr[0]) / span;
      const fadeHeightT = state.fade.height / 100;
      if(progressFromBottom < fadeHeightT){
        const guardRatio = state.fade.guard / 8; // 0(스킨)~1(가드8=거의 정상길이)
        const blendZone = Math.max(0.02, (state.fade.blendWidth/100) * fadeHeightT);
        const localT = Math.min(1, Math.max(0, progressFromBottom / blendZone)); // 0=완전 가드길이, 1=정상 복귀
        ratio = ratio*localT + guardRatio*(1-localT);
      }
    }

    ratio = Math.max(0, ratio);
    return ratio;
  });

  /* ────────────────────────────────────────────────────────────────
     커트 지오메트리 (겹의 밑바탕) — 뿌리 위치 → 모발 길이 → 끝점 재분포
     ────────────────────────────────────────────────────────────────
     실제 커트에서 "겹(레이어)"은 뿌리 높이가 다른 가닥들의 끝점이 어디에
     떨어지느냐로 생긴다. 미용사는 시술각(elevation)으로 이걸 조작한다:
       · 원랭스(시술각 0°)  : 높은 뿌리일수록 길어야 같은 바닥선에 떨어짐
                              → 끝점이 한 선으로 수렴 = 무게선(weight line)
       · 유니폼(90°)        : 모든 뿌리가 두상에서 같은 길이 → 끝점이 뿌리선과
                              평행하게 두상 따라감(레이어 균일, 무게선 없음)
       · 그라데이션(그 사이) : 부분 수렴 → 중간에 무게가 쌓임
       · 인크리스(오버디렉션): 낮은 뿌리일수록 길어짐 → 롱레이어(끝 확산)
     이를 뷰 전체 두피선(root)의 세로 범위 rootSpan을 물리 스케일로 삼아
     px 단위 길이 델타로 계산한다. 섹션 경계와 무관하게 연속적(실제 두상에서
     겹은 부위 경계에서 끊기지 않는다). 유니폼(w≈0)이면 델타 0 = 기존 렌더 유지.
     ──────────────────────────────────────────────────────────────── */
  // 뷰 전체 뿌리(두피선) 세로 범위 — 겹 지오메트리의 물리 스케일.
  let _minRootY = Infinity, _maxRootY = -Infinity;
  for(let x=0; x<maskW; x++){
    const y = iScalpY[x];
    if(y >= 0){ if(y < _minRootY) _minRootY = y; if(y > _maxRootY) _maxRootY = y; }
  }
  const rootSpan = Math.max(1, _maxRootY - _minRootY);
  // 컬럼별 겹 길이 델타(px) — scaledLen에 더한다. 양수=수렴(끝을 아래로 늘려 무게선),
  // 음수=확산(끝을 위로 당겨 롱레이어). 실제 계산은 순수 함수 computeCutLayerDelta로
  // 분리(독립 테스트·재사용 가능). depthScale은 호출부(drawStrandLayer)에서 곱한다.
  const cutLayerDeltaFor = makeColumnResolver((secId, cx, nx, ny)=>
    computeCutLayerDelta(sections && sections[secId], ny * maskH, rootSpan, _maxRootY));

  // ── 섹션별 헤어 색상(avgColorsBySection) ──
  // 사용자 요청: "부위별로 인식되는 컬러 쓰는 거 가능하냐" — avgColorsBySection이
  // 있으면(스타일 미적용 모드) 뿌리 컬럼의 섹션에 맞는 실측 색을, 없으면
  // (염색 스타일 선택됨 등) 기존처럼 균일한 color를 그대로 반환.
  // ── gyeol 스타일링 광택(finish) — 전 가닥 색을 밝기 보정 ──
  // finish 50=무변화, 100=밝게(윤기), 0=어둡게(매트). hex 색에만 적용.
  const _glossAmt = (()=> {
    const f = (styling && typeof styling.finish==='number') ? styling.finish : 50;
    return Math.round(((f-50)/50) * 22); // ±22
  })();
  const colorForSectionCache = {};
  function colorForSection(ix, secIdOpt){
    // (2026-07-22) 뿌리 기반 섹션 판정 연동: 호출부가 실제 뿌리로 판정한 secId를
    // 넘기면 그걸 쓰고(캐시 키에 섹션 포함), 안 넘기면 기존 최상단선 판정 유지.
    const cx = clampCol(ix);
    const ny = iScalpY[cx] >= 0 ? iScalpY[cx]/maskH : 0.15;
    const nx = cx/maskW;
    const secId = secIdOpt || ((angle) ? resolveSectionId(angle, nx, ny) : 'crown');
    const cKey = secId + ':' + cx;
    if(colorForSectionCache[cKey] !== undefined) return colorForSectionCache[cKey];
    let result = color;
    // ★ gyeol 섹션별 컬러(발레아쥬 등) — 섹션에 color가 지정돼 있으면 최우선.
    //   염색 스타일(selectedStyle) 미선택일 때만 avgColorsBySection가 오므로,
    //   섹션 컬러는 그와 무관하게 항상 우선 적용(미용사가 명시적으로 지정한 값).
    if(sections && sections[secId] && sections[secId].color){
      result = sections[secId].color;
    } else if(avgColorsBySection){
      result = avgColorsBySection[secId] || color;
    }
    if(_glossAmt !== 0) result = gyShade(result, _glossAmt);
    colorForSectionCache[cKey] = result;
    return result;
  }

  // ── gyeol 섹션별 컬 세기(절대값 0~100) ──
  // 예전엔 "전역컬 대비 %배율"이었으나, gyeol UI는 섹션별 컬을 절대 진폭으로
  // 다루므로 여기서 절대값을 그대로 돌려줌(0=스트레이트, 100=최대 컬).
  // traceStrandPath가 (curlAmt/100)로 진폭을 직접 계산한다.
  const curlAmtFor = makeColumnResolver((secId)=>
    (sections && sections[secId] && typeof sections[secId].curl === 'number')
      ? sections[secId].curl : 30);
  // ── gyeol 섹션별 웨이브 폭(로드 사이즈 0~100, 기본 50=중립) ──
  // 파장(촘촘/느슨)만 조절. 전역 state.waveWidth를 섹션값으로 대체.
  const waveWidthFor = makeColumnResolver((secId)=>
    (sections && sections[secId] && typeof sections[secId].wave === 'number')
      ? sections[secId].wave
      : (typeof state.waveWidth==='number'? state.waveWidth : 50));
  // ── gyeol 섹션별 텍스처라이징(0~100) ── drawStrand 끝단 트림에 사용.
  // 하위호환: 전역 state.texturing과 섹션 texture 중 큰 값을 적용.
  const textureFor = makeColumnResolver((secId)=>{
    const secTex = (sections && sections[secId] && typeof sections[secId].texture==='number') ? sections[secId].texture : 0;
    const glob = (typeof state.texturing==='number') ? state.texturing : 0;
    return Math.max(secTex, glob);
  });


  // 뿌리가 심긴 컬럼(strand의 시작 ix)이 front 섹션이면, line 슬라이더 값에 따라
  // 진행방향(travelDir)에 지속적인 각도 바이어스를 더한다(curlComponent/wiggle과
  // 동일한 additive 방식 — traceStrand의 결방향 추종/중력 로직은 그대로 두고
  // "성향"만 얹는 것이라 결방향이 뚜렷한 구간에선 자연스럽게 실측 결이 우선함).
  // line<50: 아래로 더 라운드지게(양의 바이어스=아래쪽으로 더 꺾임)
  // line=50: 바이어스 없음(기존과 동일)
  // line>50: 위로 넘기는 느낌(음의 바이어스=위쪽으로 꺾임)
  const frontDirBiasFor = makeColumnResolver((secId)=>{
    if(secId === 'front' && sections.front && typeof sections.front.line === 'number'){
      const upness = (sections.front.line - 50) / 50; // -1(라운드) ~ 0(스트레이트) ~ +1(위로)
      return -upness * 0.55; // atan2 좌표계: 각도가 작아질수록(음수 방향) 위쪽(-y)에 가까워짐
    }
    return 0;
  });

  /* (2026-09-29) 모발 상태 보정을 마지막에 얹는다 — 아래 "모발 상태" 절의 hairConditionResolvers.
     예전엔 31-side-part-perm.js가 이 함수를 통째로 감쌌다(동작 동일, 가장 바깥 한 겹). */
  return hairConditionResolvers({ lengthRatioFor, cutLayerDeltaFor, colorForSection, curlAmtFor, waveWidthFor, textureFor, frontDirBiasFor });
}

/* ══════════════════════════════════════════════════════════════════════════
   모발 상태 (HAIR_CONDITIONS) — 2026-09-29 추가, 옛 js/31-side-part-perm.js 1·2·4절
   ──────────────────────────────────────────────────────────────────────────
   같은 슬라이더 값이라도 <b>모발 상태에 따라 결과가 달라지게</b> 한다.
     · 길이 슬라이더 = 당겨서 편 실제 커트 길이. 보이는 길이 = 편 길이 × 컬 수축률
     · 펌 컬 세기 = 펌 약 세기 × 모발의 펌 흡수율 + 원래 곱슬기
     · 짧게 자를수록 무게가 빠져 컬이 더 살아난다(곱슬일수록 크게)
     · 섹션별 컬 배율(스타일이 지정) — 가르마펌은 옆·뒷머리를 다운펌처럼 눌러 둔다
   상태는 미용사가 고르지 않는다. 스타일을 걸 때(16 applyStyleSpec) 렌더된 3D 가닥의
   잔굴곡을 재서 정한다(hairAutoDetectCondition). 결과는 조정 패널 맨 위 한 줄(06).
   섹션별 실제 컬을 스펙에 굽는 일(hairBakeSectionCurls)은 16-style-spec-diag.js에 있다.
   이 절의 전역 이름은 옛 파일이 window에 내보내던 이름을 그대로 쓴다(콘솔 점검용).
   ══════════════════════════════════════════════════════════════════════════ */

/* 모발 상태 표
   naturalCurl  : 펌 없이도 있는 곱슬기 (0~100)
   permTake     : 펌 약 세기가 실제 컬로 나오는 비율 (굵은 직모는 잘 안 나옴, 손상모는 잘 나옴)
   shrinkMax    : 컬 100일 때 보이는 길이가 줄어드는 최대 비율 (0.5 = 절반 길이로 보임)
   weightRelease: 짧게 잘랐을 때 컬이 살아나는 정도
   volumeGain   : 층(elevation)을 냈을 때 부피가 커지는 정도
   ※ 자동 판정은 straight · wavy · curly 셋만 낸다. straight_coarse · damaged는 콘솔에서
     state.hairCondition = 'damaged' 처럼 직접 넣을 때만 쓰인다(자동 판정을 끈 뒤). */
const HAIR_CONDITIONS = {
  straight_coarse: { label: 'Straight (coarse)', naturalCurl: 0,  permTake: 0.75, shrinkMax: 0.40, weightRelease: 0.10, volumeGain: 0.9 },
  straight:        { label: 'Straight',      naturalCurl: 0,  permTake: 0.90, shrinkMax: 0.45, weightRelease: 0.15, volumeGain: 1.0 },
  wavy:            { label: 'Wavy',    naturalCurl: 30, permTake: 1.00, shrinkMax: 0.50, weightRelease: 0.35, volumeGain: 1.2 },
  curly:           { label: 'Curly',      naturalCurl: 60, permTake: 1.00, shrinkMax: 0.55, weightRelease: 0.55, volumeGain: 1.45 },
  damaged:         { label: 'Damaged (bleached / over-permed)', naturalCurl: 10, permTake: 1.15, shrinkMax: 0.50, weightRelease: 0.25, volumeGain: 1.1 }
};
const HAIR_CONDITION_CFG = {
  enabled: true,
  // 3D 가닥 시뮬레이션이 이미 컬로 길이를 줄여 그린다면 false로 두어 이중 수축을 막으세요.
  applyShrink2D: true,
  shrinkExp: 1.3          // 수축 곡선 지수 — 1보다 크면 약한 컬에서는 거의 안 줄고 강한 컬에서 확 준다
};
/* 스타일별 섹션 컬 배율 — 지금 걸린 스타일(state._activeSpecId)에만 적용된다.
   가르마펌: 옆·뒤는 다운펌 느낌으로 눌림(0 = 원래 곱슬기의 60%만 남고 펌 컬은 0). */
const HAIR_SECTION_CURL_SCALE = {
  side_part_perm: { front: 1.0, crown: 0.85, temple: 0.35, side: 0.0, occipital: 0.3, nape: 0.0 }
};
window.HAIR_CONDITIONS = HAIR_CONDITIONS;
window.HAIR_CONDITION_CFG = HAIR_CONDITION_CFG;

function hairCond(){
  return HAIR_CONDITIONS[(typeof state !== 'undefined' && state && state.hairCondition)] || HAIR_CONDITIONS.straight;
}
function hairClamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
function hairSectionCurlScale(sec){
  const m = HAIR_SECTION_CURL_SCALE[typeof state !== 'undefined' && state && state._activeSpecId];
  return m && typeof m[sec] === 'number' ? m[sec] : 1;
}
/** 섹션의 실제 컬(0~100): 펌 약 세기 → 마무리(드라이) → 모발 상태 → 섹션 배율 → 커트 길이에 따른 무게 해방.
    permCurl    : 젖은 상태 펌 약 세기(스펙의 permBase.curl)
    rawLenRatio : 기본 길이 대비 비율(1 = 그대로). 짧을수록 weightRelease 만큼 컬이 산다 */
function hairEffectiveCurl(permCurl, sec, rawLenRatio){
  const c = hairCond();
  const scale = hairSectionCurlScale(sec);
  const spec = (typeof STYLE_SPECS !== 'undefined' && typeof state !== 'undefined' && state) ? STYLE_SPECS[state._activeSpecId] : null;
  // 드라이 마무리 후 남는 컬 비율(spec.finishCurl). 젖은 머리(hairFinish==='wet')면 그대로
  if (spec && typeof spec.finishCurl === 'number' && state.hairFinish !== 'wet') permCurl *= spec.finishCurl;
  // 펌 컬과 원래 곱슬기는 단순 합이 아니라 겹쳐서 커짐: 1-(1-a)(1-b)
  const a = hairClamp(permCurl * c.permTake * scale / 100, 0, 1);
  const b = hairClamp(c.naturalCurl * (0.6 + 0.4 * scale) / 100, 0, 1);
  let curl = (1 - (1 - a) * (1 - b)) * 100;
  const shorter = hairClamp(1 - rawLenRatio, 0, 1);          // 기본 길이 대비 얼마나 짧아졌나
  curl *= 1 + c.weightRelease * shorter;
  return hairClamp(curl, 0, 100);
}
/** 컬 때문에 보이는 길이가 줄어드는 비율 (직모 1.0) */
function hairShrinkFactor(curl){
  return 1 - hairCond().shrinkMax * Math.pow(curl / 100, HAIR_CONDITION_CFG.shrinkExp);
}
/** 커트 길이 cm(편 길이) → 보이는 길이 cm. UI 표시용(지금은 호출처 없음 — 콘솔·향후 스펙 패널용) */
function hairVisibleLengthCm(stretchedCm, permCurl, sec, rawLenRatio){
  return stretchedCm * hairShrinkFactor(hairEffectiveCurl(permCurl, sec, rawLenRatio == null ? 1 : rawLenRatio));
}
/* 2D 리졸버 보정 — createColumnStyleResolvers가 반환 직전에 부른다.
   · 컬: 손대지 않는다. 섹션 curl은 applyStyleSpec 단계(16 hairBakeSectionCurls)에서 이미
     모발 상태·섹션 배율이 들어간 값이라 2D/3D가 같은 숫자를 본다.
   · 길이: 컬만큼 보이는 길이가 줄어든다(applyShrink2D).
   · 층 부피: 모발 상태의 volumeGain을 컬이 셀수록 더 세게(0.5 + curl/200 = 0.5~1.0배) 건다. */
function hairConditionResolvers(r){
  if (!HAIR_CONDITION_CFG.enabled || !r) return r;
  const baseLen = r.lengthRatioFor, baseCurl = r.curlAmtFor, baseLayer = r.cutLayerDeltaFor;
  r.lengthRatioFor = (x, sec, y) => {
    const raw = baseLen(x, sec, y);
    return HAIR_CONDITION_CFG.applyShrink2D ? raw * hairShrinkFactor(baseCurl(x, sec, y)) : raw;
  };
  r.cutLayerDeltaFor = (x, sec, y) => {
    const d = baseLayer(x, sec, y);
    return d * (1 + (hairCond().volumeGain - 1) * (0.5 + baseCurl(x, sec, y) / 200));
  };
  return r;
}
window.hairEffectiveCurl = hairEffectiveCurl;
window.hairVisibleLengthCm = hairVisibleLengthCm;

/* ── 모발 상태 자동 판정 (렌더된 헤어에서) ─────────────────────────────────
   미용사가 고르지 않는다. 지금 화면에 그려지는 3D 가닥(마네킹/시술 후 렌더)의
   굴곡을 재서 직모·웨이브·곱슬을 정한다.
     wiggle = Σ(이웃 마디 사이 꺾임) − (처음 마디↔끝 마디 꺾임)
              → 큰 흐름(중력·두상 따라 휨)은 빼고 잔굴곡만 남긴다
     cm 당 각도로 환산: < wavyDeg 직모 · < curlyDeg 웨이브 · 그 이상 곱슬
   가닥 sample개를 고르게 뽑아 중앙값을 쓴다(20개 미만이면 판정 안 함 = 이전 값 유지).
   끄기: HAIR_AUTO_COND.on = false (그러면 state.hairCondition을 손으로 넣은 값이 유지된다) */
const HAIR_AUTO_COND = { on: true, cmPerUnit: 19.3, sample: 600, wavyDeg: 12, curlyDeg: 45 };
window.HAIR_AUTO_COND = HAIR_AUTO_COND;
function hairAngleBetween(u, v){
  const lu = Math.hypot(u.x, u.y, u.z), lv = Math.hypot(v.x, v.y, v.z);
  if (!(lu > 1e-9 && lv > 1e-9)) return 0;
  return Math.acos(hairClamp((u.x * v.x + u.y * v.y + u.z * v.z) / (lu * lv), -1, 1));
}
function hairMeasureRenderedCurl(){
  // 중립 3D 모델(state.hair3Dneutral)이 있으면 그걸, 없으면 지금 그려진 state.hair3D를 잰다
  const m = typeof state !== 'undefined' && state && (state.hair3Dneutral || state.hair3D);
  const S = m && m.strands;
  if (!S || !S.length) return null;
  const step = Math.max(1, Math.floor(S.length / HAIR_AUTO_COND.sample));
  const vals = [];
  for (let i = 0; i < S.length; i += step) {
    const P = S[i].pts;
    if (!P || P.length < 5) continue;
    let arc = 0, turn = 0, first = null, prev = null;
    for (let k = 1; k < P.length; k++) {
      const d = { x: P[k].x - P[k - 1].x, y: P[k].y - P[k - 1].y, z: P[k].z - P[k - 1].z };
      arc += Math.hypot(d.x, d.y, d.z);
      if (prev) turn += hairAngleBetween(prev, d);
      if (!first) first = d;
      prev = d;
    }
    const arcCm = arc * HAIR_AUTO_COND.cmPerUnit;
    if (arcCm < 2) continue;                                   // 너무 짧은 가닥은 판정 불가
    const wiggle = Math.max(0, turn - hairAngleBetween(first, prev)) * 180 / Math.PI;
    vals.push(wiggle / arcCm);
  }
  if (vals.length < 20) return null;
  vals.sort((x, y) => x - y);
  return { degPerCm: vals[vals.length >> 1], n: vals.length };
}
function hairAutoDetectCondition(reason){
  if (!HAIR_AUTO_COND.on) return state.hairCondition;
  const r = hairMeasureRenderedCurl();
  if (!r) return state.hairCondition;
  const c = r.degPerCm < HAIR_AUTO_COND.wavyDeg ? 'straight' : r.degPerCm < HAIR_AUTO_COND.curlyDeg ? 'wavy' : 'curly';
  state.hairCondition = c;
  state._hairCondAuto = { cond: c, degPerCm: r.degPerCm, n: r.n };    // 06 gyShowHairCondition이 읽음
  console.log('[모발상태·자동] ' + (reason || '') + ' 렌더 가닥 ' + r.n + '개 잔굴곡 중앙값 ' + r.degPerCm.toFixed(1) +
    '°/cm → <b>' + HAIR_CONDITIONS[c].label + '</b> (기준 직모<' + HAIR_AUTO_COND.wavyDeg + ' · 웨이브<' + HAIR_AUTO_COND.curlyDeg +
    ') · 끄기 HAIR_AUTO_COND.on=false');
  return c;
}
window.hairAutoDetectCondition = hairAutoDetectCondition;
