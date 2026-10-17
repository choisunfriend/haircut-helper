/* ══════════════════════════════════════════════════════════
   13b-lift-fields.js — 3D 리프트 · 결(orientation) 필드 · 모발 점유 필드
   원본 index.html 19768~20827행. 클래식 스크립트이므로 로드 순서가 곧
   실행 순서다 — index.html의 <script src> 순서를 바꾸지 말 것.
   ══════════════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════════════════════
   3D 리프트 — 2D 캡처 가닥을 두상 좌표로 올리기
   캡처된 2D 가닥 경로(state.strandPaths)를 뷰별 실측 포즈로 3D 두상 공간에
   옮겨 state.hair3D를 만든다. 조정 파이프라인의 입력(중립 모델)이 여기서 나온다.
   ════════════════════════════════════════════════════════════════ */
// (2026-07-17 재작성 v3) "헤어도 두상처럼 4장 실루엣으로 깎는다" — 사용자
// 지적: "두상이 실측해서 입체로 나온다면, 그 위에 얹혀지는 헤어가닥의 점들도
// 다 3D좌표(입체)에 찍힐 수 있을 거 아니야?" / "사진 4장의 실루엣으로 폭·깊이
// 재는 과정을 헤어도 거쳐야지." 합의된 4단계:
//   1단계 — 헤어 외곽 헐(hull) 깎기: 높이별로 정면/후면 마스크에서 헤어
//     반폭(W), 좌/우측 마스크에서 헤어 반깊이(D)를 실측(소스는 이미 저장된
//     scalpY~hairEndY 컬럼 스팬 — 새 세그멘테이션 없음). 두상 단면 깎기와
//     동일 발상, 소스만 두상 실루엣 → 헤어 마스크.
//   2단계 — 가닥 점의 깊이(z)를 전역 타원체 대신 그 높이의 실측 헐 단면
//     타원(W(y), D(y))에서 읽음. 단면 밖(늘어짐)은 마지막 깊이 유지(기존).
//   3단계 — 두께(부피): 같은 높이의 두피면(두상 타원)과 헐 사이 간격이 곧
//     실측 헤어 두께 — 가닥마다 결정적 난수 t∈[0.35,1]로 그 간격 안에 배치
//     (0=두피, 1=헐 바깥면). 지어낸 상수가 아니라 실측 간격 안에서만 흩뿌림.
//   4단계 — 깊이 음영: 안쪽 층(t 작음)은 어둡게, 바깥층·카메라를 향한
//     곡면일수록 밝게(가산 성분 포함 — 검은 머리에서도 곡률이 보이도록).
//     LineBasicMaterial이 무조명이라 정점 색으로 직접 음영을 구움.
// 매핑 앵커는 v2와 동일(두피선 최고점↔두상 꼭대기, 두피선 반폭↔두상 반지름).
// (2026-07-17 좌표 축 통합으로 갱신) "뷰별 고정 yaw만, 포즈 미사용"이던
// 서술은 폐기 — 이제 뷰별 실측 포즈(getViewYawDeg 폴백 체인 + pitch/roll)를
// 쓰고, 헐 실측도 관측(E,θ) 역투영으로 일반화됨. 상세는 함수 본문 주석과
// 파일 상단 개발로그 "좌표 축 통합" 항목 참고.
/* 모발 깊이층 — 0=두피면, 1=헐(모발 바깥면). 가닥을 따라 변한다.
   뿌리는 두피 근처(LIFT)에서 나와 RAMP 구간 안에 자기 층(tLayer)으로 올라온다.
   LIFT를 0으로 두지 않는 이유는 정수리 꼭짓점이 한 점만 파이는 것을 막기 위함.
   상세한 배경은 아래 buildHairStrandsFromPaths 안의 주석 참조. */
/* LIFT 0.10 → 0 (2026-07-27 2차, 사용자: "뿌리 시작점 함수는 원본결이랑
   똑같으면 될 거 같아"). 0이면 뿌리가 두피면 위에 정확히 놓인다 = 2D 원본 결
   보기의 뿌리와 같은 자리. 정수리 꼭짓점이 모발 두께만큼 낮아지는 부작용은
   감수한다 — 실기기에서 "머리가 바깥에서 시작한다"가 계속 더 큰 문제였다. */
/* (2026-08-01) legacy 스위치 추가 — 사용자가 "제대로 나왔다"고 지목한 예전 파일과
   <b>이 부분만</b> 다르다는 것이 diff로 확인됐다. 예전 파일(2026-07-27 이전):
       const t = 0.35 + 0.65 * rand();   // 가닥 전체에 같은 값, 범위 [0.35, 1]
   지금: tLayer = rand()(범위 [0,1])를 뿌리에서 RAMP 구간에 걸쳐 올려 씀.
   바꾼 이유는 "뿌리가 두피에서 나와야 한다"(머리 전체가 모발 두께의 2/3만큼
   부풀어 보였다)였는데, 그 교정이 과했을 가능성이 있다 — 예전은 두께의 바깥
   65%에만 가닥이 있었고 지금은 뿌리 쪽이 두피면에 눌러앉는다. 헐과 두피면의
   실측 간격이 좁으면(지금이 그렇다) 지금 방식은 거의 한 껍질로 모인다.
   추론으로 정하지 말고 실기기에서 눈으로 비교하라고 스위치를 남긴다:
       HAIR_ROOT.legacy = true; rebuildHair3D();
   ※ legacy면 예전 식과 <b>수식까지 동일</b>하다(LIFT/RAMP 무시). */
const HAIR_ROOT = { LIFT: 0, RAMP: 0.22, legacy: false, legacyMin: 0.35 };
function hairLayerAt(tLayer, i, n){
  if(HAIR_ROOT.legacy) return HAIR_ROOT.legacyMin + (1 - HAIR_ROOT.legacyMin) * tLayer;
  const root = tLayer * HAIR_ROOT.LIFT;
  const f = Math.min(1, Math.max(0, (i / Math.max(1, n)) / HAIR_ROOT.RAMP));
  return root + (tLayer - root) * f;
}

/* ── 콘솔용: 3D 모델을 <b>처음부터</b> 다시 만든다 (2026-08-01) ─────────────
   A/B를 하려면 스위치를 바꾼 뒤 캐시를 전부 버려야 한다. 안 그러면 state.
   hair3Dneutral이 그대로 남아 "바꿨는데 화면이 똑같다"가 된다(이 코드베이스에서
   반복해서 겪은 실패 방식이라 아예 헬퍼로 만들어 둔다).
     rebuildHair3D()                      — 현재 설정으로 재생성
     HAIR_FIELD3D.on=false; rebuildHair3D()  — 결 정렬 빼고
     HAIR_OCC3D.on=false;  rebuildHair3D()  — 세그멘테이션 다듬기 빼고
     HAIR_ROOT.legacy=true; rebuildHair3D() — 예전 층 배치로            */
function rebuildHair3D(){
  state.hair3D = null; state.hair3Dneutral = null;
  state.hairField3D = null; state.hairOcc3D = null;
  _headCrossSectionCache = null; _headVerticalRadiusCache = null;
  _headEllipsoidLogged = false; _scalpLogged = false;
  for(const k in _viewMaskCache) delete _viewMaskCache[k];
  resetRenderMatchLog();   // A/B마다 비교 숫자를 새로 찍는다
  console.log('[재생성] 3D 캐시 비움 — 결정렬 ' + (HAIR_FIELD3D.on?'ON':'OFF')
    + ' · 세그다듬기 ' + (HAIR_OCC3D.on?'ON':'OFF')
    + ' · 층배치 ' + (HAIR_ROOT.legacy?('legacy(≥'+HAIR_ROOT.legacyMin+')'):'현행(뿌리램프)'));
  try{ buildNeutralHair3D(()=>{ refreshDevMini3D(); renderAdjustFrame(); }); }
  catch(e){ console.warn('[재생성] 실패', e); }
}

/* ══════════════════════════════════════════════════════════════════
   3D 결(orientation) 필드 — 구조텐서 결정보를 두상 좌표로 통합 (2026-08-01)
   ─────────────────────────────────────────────────────────────────
   사용자 지적: "헤어세그멘테이션은 잘 잡혀 있고 원본 결 렌더링도 괜찮은데,
   3D를 거쳐서 오는 스타일 렌더링이 헤어결이 안 좋아. structure tensor에서 받는
   결정보가 3D 통합 과정에서 안 잡혀 있는 것 같아."

   맞는 지적이다. 지금까지 결정보(computeHairOrientationField)는 <b>2D에서만</b>
   쓰였다:
     · traceStrandPath가 결을 따라 걸어서 2D 가닥 경로를 만든다 → 여기까지는 좋다
     · buildHairStrandsFromPaths가 그 경로를 3D로 <b>올린다</b>
   그런데 올리는 순간 결은 사라진다. 남는 건 점들의 좌표뿐이고, 그 점들은
     ① 헐 단면 타원으로 깊이를 <b>지어서</b> 붙이고(mz),
     ② 실루엣 밖(u>1)에서는 둘레를 따라 <b>감아 붙이고</b>,
     ③ 안 찍힌 뷰는 맞은편을 <b>거울로 채우고</b>,
     ④ 되쏠 때는 네 뷰 가닥을 <b>전부</b> 한 화면에 겹친다.
   ①~④가 전부 방향을 흐트러뜨리는 조작인데, 그 뒤에 "원래 결은 이랬다"고
   말해 줄 데이터가 3D 쪽에는 하나도 없었다. 그래서 되쏜 경로가 사진의 결과
   따로 놀고, 픽셀 이식은 그 경로를 그대로 따라가니 결이 엉킨 그림이 된다.

   여기서 만드는 것: <b>두상 표면에 붙은 3D 결 필드</b>.
     1) 네 뷰의 구조텐서 결각도를, 가닥이 아니라 <b>필드 그대로</b> 두상 좌표로
        올린다. 화면 방향 d(2D)는 그 자리 헐 표면의 <b>접평면</b> 위에서 유일하게
        3D 접선 T로 복원된다 —  T = d + λẑ,  T·N = 0  (N=표면 법선).
        시선과 나란한 성분 하나만 모르는데, 접평면 구속이 그 하나를 정해 준다.
     2) 방향은 부호가 없는 <b>선분</b>(180° 주기)이라 평균을 내면 안 된다.
        2D 구조텐서가 쓰는 것과 같은 방법을 3D로 올려서 — 관측마다 T⊗T(3×3
        대칭 텐서)를 가중 누적하고, 최대 고유벡터를 대표 방향으로 쓴다.
        고유값 비 (λ1−λ2)/(λ1+λ2+λ3)가 곧 <b>3D coherence</b>다.
     3) 네 뷰가 같은 셀을 보면 자연히 <b>융합</b>된다(텐서 합이 곧 융합).
        서로 다른 방향을 말하면 이방성이 떨어져 coherence가 낮아지고,
        아래 정렬에서 자동으로 약하게 먹는다 — 억지로 한쪽을 고르지 않는다.
   그리고 이 필드로 3D 가닥의 진행 방향을 <b>실측 쪽으로 되돌린다</b>
   (alignStrandPtsToField3D). 뿌리는 두피 실측이라 건드리지 않고, 원래 경로에서
   멀어지는 양에도 상한을 둔다(누적 표류 방지).

   ※ 이번 작업은 <b>결정보만</b> 다룬다. 세그멘테이션(마스크)을 3D에 통합해
     "가닥이 머리 밖으로 새는 것"을 막는 건 다음 단계 — 사용자 지시대로 순서를
     나눴다("복잡하니까 일단 결정보부터").
══════════════════════════════════════════════════════════════════ */
const HAIR_FIELD3D = {
  on:      true,   // 끄면 예전 동작(결 미반영)으로 즉시 복귀 — A/B 확인용
  NT:      64,     // 방위각(θ) 셀 수 — 두상 한 바퀴를 이만큼 나눔(5.6°)
  NP:      32,     // 세로 셀 수 — 정수리~아래를 <b>극각</b> 균등 분할(fieldCellIndex 주석 참고)
  stepX:   2,      // 관측 채집 x 보폭(마스크 원본 px)
  ySamples: 28,    // 컬럼마다 두피선~모발끝을 이만큼 나눠 표본
  minCoh:  0.05,   // 이보다 흐린 자리는 관측으로 안 씀(실기기 평균 0.28)
  minFacing: 0.20, // |표면 법선의 시선 성분| 하한. 실루엣 근처(법선⊥시선)에서는
                   // 아래 λ가 발산해서 방향이 아무 값이나 된다 — 아예 안 받는다.
  smooth:  2,      // 텐서 영역 이동평균 횟수(빈 셀 메움 — 텐서는 선형이라 평균 가능)
  minCells: 24,    // 이보다 적게 채워지면 필드로 취급하지 않음(조용히 미적용)
  /* ── 적용 세기 ──────────────────────────────────────────────────
     정렬 세기 = min(maxAlign, 3D coherence × gain). coherence가 곧 "이 자리에서
     네 뷰가 얼마나 같은 말을 하는가"라, 애매한 곳은 저절로 약하게 먹는다.
     결이 덜 잡히면 gain을 올리고, 머리가 한 방향으로 쏠려 보이면 내린다.
     ※ 하네스 스윕(15° 틀어 심은 가닥을 되돌리는 잔차):
         gain 1.0/0.50 → 9.5°   1.4/0.70 → 5.9°   <b>2.0/0.85 → 3.2°</b>
         3.0/0.95 → 2.3°   4.0/1.00 → 2.2°
       2.0 위로는 거의 안 줄어든다(필드 자체 정확도 ≈2°가 바닥). 그래서 2.0. */
  gain:     2.0,
  maxAlign: 0.85,  // 한 스텝에서 실측 방향 쪽으로 최대 이만큼(1=실측을 그대로 따름)
  rootHold: 0.12,  // 가닥 앞 이 비율 구간은 세기를 0→1로 서서히(뿌리 실측 보존)
  /* ── 표류 허용치(leash) ────────────────────────────────────────
     이건 <b>모양을 정하는 값이 아니라 폭주 방지선</b>이다. 허용치를 거리 고정으로
     두면 안 된다 — 각도 오차 θ를 길이 L에 걸쳐 고치면 옆으로 벌어지는 양이
     대략 L·sinθ라, 고정 거리는 <b>긴 가닥일수록</b> 더 세게 조인다(= 정수리에서
     내려오는 긴 머리는 아예 못 고침). 그래서 지금까지 간 <b>호길이에 비례</b>해서
     허용한다: driftRate 0.5 ≈ "평균 30°까지는 고쳐도 된다".
     driftMin은 짧은 가닥이 시작부터 조이지 않게 하는 바닥값(두상 반폭 대비). */
  driftRate: 0.50,
  driftMin:  0.06,
  restore:   0.55, // 허용치에 닿았을 때 방향을 원래 경로 쪽으로 섞는 비율
};

/* 3×3 대칭행렬 고유분해(Jacobi). m = [xx, yy, zz, xy, xz, yz].
   반환 l=[λ1≥λ2≥λ3], v=최대 고유벡터(단위). Node 하네스로 검증:
   한 방향에 노이즈를 얹은 200개 관측 → 복원 dot 0.9999, 이방성 0.99 /
   완전 등방 500개 → 이방성 0.008. */
function eigenSym3(m){
  const a=[[m[0],m[3],m[4]],[m[3],m[1],m[5]],[m[4],m[5],m[2]]];
  const v=[[1,0,0],[0,1,0],[0,0,1]];
  for(let sweep=0;sweep<16;sweep++){
    const off=a[0][1]*a[0][1]+a[0][2]*a[0][2]+a[1][2]*a[1][2];
    if(off<1e-20) break;
    for(let p=0;p<2;p++) for(let q=p+1;q<3;q++){
      if(Math.abs(a[p][q])<1e-18) continue;
      const th=(a[q][q]-a[p][p])/(2*a[p][q]);
      const t=(th>=0?1:-1)/(Math.abs(th)+Math.sqrt(th*th+1));
      const c=1/Math.sqrt(t*t+1), s=t*c;
      for(let k=0;k<3;k++){ const kp=a[k][p],kq=a[k][q]; a[k][p]=c*kp-s*kq; a[k][q]=s*kp+c*kq; }
      for(let k=0;k<3;k++){ const pk=a[p][k],qk=a[q][k]; a[p][k]=c*pk-s*qk; a[q][k]=s*pk+c*qk; }
      for(let k=0;k<3;k++){ const kp=v[k][p],kq=v[k][q]; v[k][p]=c*kp-s*kq; v[k][q]=s*kp+c*kq; }
    }
  }
  const ev=[a[0][0],a[1][1],a[2][2]];
  let i0=0; if(ev[1]>ev[i0])i0=1; if(ev[2]>ev[i0])i0=2;
  let i2=0; if(ev[1]<ev[i2])i2=1; if(ev[2]<ev[i2])i2=2;
  if(i0===i2) i2=(i0+1)%3;
  const i1=3-i0-i2;
  return { l:[ev[i0],ev[i1],ev[i2]], v:[v[0][i0],v[1][i0],v[2][i0]] };
}

/* 두상 표면의 한 점 → 필드 셀 인덱스.
   θ = atan2(x, z)(얼굴↔뒤통수를 가르는 축), 세로는 <b>극각</b> acos(y/b)를 균등
   분할한다.
   ※ 처음엔 y를 균등 분할했다(구면 등면적이라 셀 크기가 고르다는 이유). 하네스로
     재보니 정수리 근처 오차가 평균 34°까지 튀었다 — 결방향은 정수리로 갈수록
     y에 대해 <b>급격히</b> 꺾여서(극에서 특이점), y 균등 셀 하나가 서로 다른
     방향을 뭉뚱그려 평균이 뭉개진다. 극각 균등이면 극 근처에서 y 간격이 저절로
     촘촘해져 그 구간이 살아난다(아래 하네스 수치 참고). */
function fieldCellIndex(F, x, y, z, CY, b){
  const th = Math.atan2(x, z);                                  // -π..π
  let ti = Math.floor((th + Math.PI) / (2*Math.PI) * F.NT);
  ti = ((ti % F.NT) + F.NT) % F.NT;
  const ny = Math.max(-1, Math.min(1, (y - CY) / Math.max(1e-6, b)));
  let pi = Math.floor(Math.acos(ny) / Math.PI * F.NP);
  pi = Math.max(0, Math.min(F.NP-1, pi));
  return pi * F.NT + ti;
}

/* ── 필드 만들기 ──────────────────────────────────────────────────
   env는 buildHairStrandsFromPaths의 내부 상태를 그대로 받는다(같은 매핑을 써야
   가닥과 필드가 같은 좌표에 놓인다 — 여기서 매핑을 다시 쓰면 그 순간 어긋난다). */
function buildHairOrientationField3D(env){
  const F = HAIR_FIELD3D;
  if(!F.on) return null;
  const { views, names, hullW, hullD, bucketOfY, mapY, CY, b, NY, yStep } = env;
  const NT=F.NT, NP=F.NP, NC=NT*NP;
  const Txx=new Float64Array(NC), Tyy=new Float64Array(NC), Tzz=new Float64Array(NC),
        Txy=new Float64Array(NC), Txz=new Float64Array(NC), Tyz=new Float64Array(NC),
        Wsum=new Float64Array(NC);
  // 극성 누적(부호 있는 평균 벡터) — 텐서와 <b>나란히</b> 쌓는다
  const Pxa=new Float64Array(NC), Pya=new Float64Array(NC), Pza=new Float64Array(NC),
        Pw=new Float64Array(NC);
  const Nobs=new Int32Array(NC);
  const perView = {};
  let totalObs = 0;

  names.forEach(n=>{
    const v = views[n];
    const mi = v.maskInf;
    if(!mi || !mi.orientation){ perView[n]=0; return; }
    const ow = mi.maskW || mi.w, oh = mi.maskH || mi.h;
    const sxr = ow / mi.w, syr = oh / mi.h;
    const rot = composeRotationZYX(v.pose.yaw, v.pose.pitch, v.pose.roll);
    const jCos2 = v.cos2, jSin2 = v.sin2;
    let used = 0;
    for(let x=0; x<mi.w; x+=F.stepX){
      const sY = mi.scalpY[x], eY = mi.hairEndY[x];
      if(sY < 0 || !(eY > sY)) continue;
      const mx = (x - v.cx) * v.s;
      for(let k=0;k<F.ySamples;k++){
        const y = sY + (eY - sY) * (k + 0.5) / F.ySamples;
        const o = sampleOrientation(mi.orientation, x*sxr, ow, y*syr);
        if(!o || !(o.coherence >= F.minCoh)) continue;
        // ── 이 표본이 두상 어디에 붙는가 — 리프트와 <b>같은</b> 매핑 ──
        const my = mapY(v, y);
        const bi = bucketOfY(my);
        const Wb = hullW[bi], Db = hullD[bi];
        const aH = Math.sqrt(Wb*Wb*jCos2 + Db*Db*jSin2);
        if(!(aH > 1e-4)) continue;
        const aD = (Wb*Db) / aH;
        const u = (mx/aH)*(mx/aH);
        if(u > 1) continue;               // 실루엣 밖(감아 붙이는 구간) — 방향 신뢰 못함
        const mz = aD * Math.sqrt(1-u);   // 결이 실제로 보이는 면 = 헐 바깥면
        /* ── 표면 법선 (카메라 정렬 좌표) ────────────────────────────
           헐은 "높이 y마다 반지름이 다른 타원 단면을 쌓은 것"이다:
             F = (x/aH(y))² + (z/aD(y))² − 1 = 0
           이 면의 법선은 x·z 성분만이 아니라 <b>단면이 높이에 따라 줄어드는 항</b>
           (aH', aD')이 세로 성분으로 들어간다.
             N = ( x/aH², −(x²·aH'/aH³ + z²·aD'/aD³), z/aD² )

           ※ 처음엔 세로 항을 (y−CY)/b² 로 놓았다("국소 타원체 근사"). 하네스에서
             정수리 쪽 결 오차가 34°로 튀길래 해상도(NT/NP)를 두 배씩 올려 봤는데
             전혀 안 줄어서 다시 봤더니, 근사가 아니라 <b>틀린 식</b>이었다.
             그 자리 <b>단면 반지름</b> aH(y)를 마치 타원체의 <b>반축</b>인 것처럼
             썼기 때문이다. 정수리로 갈수록 aH(y)→0이라 x/aH²가 발산해서, 법선이
             위가 아니라 <b>카메라 쪽</b>을 가리켰다. 그러면 minFacing 게이트도
             무력화되고(정수리를 정면에서 잘 본다고 착각) 접평면도 틀린다.
             해상도로 안 고쳐지는 오차는 대개 이런 식으로 식이 틀린 경우다. */
        const bi0 = Math.max(0, bi-1), bi1 = Math.min(NY-1, bi+1);
        const dySpan = (bi1 - bi0) * yStep;   // 버킷 인덱스는 y가 내려갈수록 커진다
        const Wp = dySpan > 1e-9 ? (hullW[bi0] - hullW[bi1]) / dySpan : 0;
        const Dp = dySpan > 1e-9 ? (hullD[bi0] - hullD[bi1]) / dySpan : 0;
        const aHp = (Wb*Wp*jCos2 + Db*Dp*jSin2) / aH;
        const aDp = (Wp*Db + Wb*Dp) / aH - (Wb*Db) * aHp / (aH*aH);
        let nx = mx/(aH*aH);
        let nz = aD > 1e-6 ? mz/(aD*aD) : 0;
        let ny = -( mx*mx*aHp/(aH*aH*aH) + (aD > 1e-6 ? mz*mz*aDp/(aD*aD*aD) : 0) );
        const nl = Math.hypot(nx,ny,nz); if(!(nl>1e-9)) continue;
        nx/=nl; ny/=nl; nz/=nl;
        if(nz < F.minFacing) continue;    // 실루엣·정수리 — 깊이 성분 발산
        // ── 화면 결각도 → 카메라 정렬 좌표 방향 ──
        // 이미지 y는 아래로 증가하고 mapY는 뒤집으므로 세로 성분에 -를 붙인다.
        // 가로/세로 축척도 다르므로(s, sy) 각각 곱해야 각이 보존된다.
        /* ── 극성을 실어 올린다 (2026-08-01) ─────────────────────────────
           아래 텐서 누적(T⊗T)은 <b>정의상</b> 부호를 지운다 — 그래서 3D 필드가
           무방향이 됐고, alignStrandPtsToField3D가 "가던 쪽"에 맞출 수밖에
           없었다. 텐서는 방향의 <b>품질</b>을 재는 데 그대로 쓰고, 극성은
           평균 벡터로 <b>따로</b> 쌓는다(선형이라 그냥 더하면 된다).
           여기서 이미지 평면 방향의 부호를 정해 두면 T의 부호가 따라온다
           (lam도 dx,dy에 선형이라 같이 뒤집힌다). */
        let dx = Math.cos(o.angle) * v.s;
        let dy = -Math.sin(o.angle) * v.sy;
        const oPol = flowPolarityFor(o.angle, o);
        if(oPol < 0){ dx=-dx; dy=-dy; }
        // ── 접평면으로 들어올리기: T = d + λẑ,  T·N = 0 ──
        const lam = -(dx*nx + dy*ny) / nz;
        let tx=dx, ty=dy, tz=lam;
        const tl = Math.hypot(tx,ty,tz); if(!(tl>1e-9)) continue;
        tx/=tl; ty/=tl; tz/=tl;
        // ── 두상(월드) 좌표로 ──
        const T = applyRotationTranspose3(rot, new THREE.Vector3(tx,ty,tz));
        const P = applyRotationTranspose3(rot, new THREE.Vector3(mx, my-CY, mz));
        const ci = fieldCellIndex(F, P.x, P.y+CY, P.z, CY, b);
        // 가중치 = 결의 또렷함 × 정면성(비스듬히 보이는 면일수록 각이 눌린다)
        const w = o.coherence * nz;
        Txx[ci]+=w*T.x*T.x; Tyy[ci]+=w*T.y*T.y; Tzz[ci]+=w*T.z*T.z;
        Txy[ci]+=w*T.x*T.y; Txz[ci]+=w*T.x*T.z; Tyz[ci]+=w*T.y*T.z;
        // 극성 — 벡터 그대로(부호 살아 있음). 뷰마다 반대로 보면 서로 상쇄되어
        // 길이가 줄고, 그 길이가 곧 "극성이 얼마나 일관된가"가 된다.
        if(oPol !== 0){
          Pxa[ci]+=w*T.x; Pya[ci]+=w*T.y; Pza[ci]+=w*T.z; Pw[ci]+=w;
        }
        Wsum[ci]+=w; Nobs[ci]++; used++;
      }
    }
    perView[n] = used; totalObs += used;
  });

  let filled = 0;
  for(let i=0;i<NC;i++) if(Nobs[i]) filled++;
  if(filled < F.minCells){
    console.warn('[3D·결] 결 필드를 만들 관측이 부족하다 — 채워진 셀 '+filled+'/'+NC
      +' (관측 '+totalObs+'개). 결 정렬을 건너뛴다.');
    return null;
  }

  // ── 텐서 영역 이동평균 — 빈 셀 메움 + 마스크 노이즈 완화 ──
  // 방향을 평균 내면 180° 주기 때문에 틀리지만, <b>텐서</b>는 선형이라 그냥 더해도 된다.
  // θ는 원통이라 감아서(wrap), 세로는 끝에서 잘라서(clamp) 이웃을 잡는다.
  // 극성 벡터도 같이 평활한다 — 벡터 합도 선형이라 텐서와 같은 이유로 평균 가능.
  const bufs=[Txx,Tyy,Tzz,Txy,Txz,Tyz,Wsum,Pxa,Pya,Pza,Pw];
  for(let pass=0; pass<F.smooth; pass++){
    const cp = bufs.map(bf=>Float64Array.from(bf));
    for(let pi=0; pi<NP; pi++) for(let ti=0; ti<NT; ti++){
      const ci = pi*NT+ti;
      for(let bIdx=0;bIdx<bufs.length;bIdx++){
        let acc=0, wn=0;
        for(let dp=-1; dp<=1; dp++){
          const pj = Math.max(0, Math.min(NP-1, pi+dp));
          for(let dt=-1; dt<=1; dt++){
            const tj = ((ti+dt) % NT + NT) % NT;
            const wk = (dp===0&&dt===0) ? 4 : ((dp===0||dt===0) ? 2 : 1);
            acc += cp[bIdx][pj*NT+tj]*wk; wn += wk;
          }
        }
        bufs[bIdx][ci] = acc/wn;
      }
    }
  }

  // ── 셀마다 대표 방향 + 3D coherence 굽기 ──
  const dir = new Float32Array(NC*3);
  const coh = new Float32Array(NC);
  const pol = new Float32Array(NC);          // 극성 일관도 0~1 (0=모름 → 예전 동작)
  let cohSum=0, cohN=0, polSum=0, polN=0;
  for(let i=0;i<NC;i++){
    const W = Wsum[i];
    if(!(W > 1e-9)) continue;
    const e = eigenSym3([Txx[i]/W, Tyy[i]/W, Tzz[i]/W, Txy[i]/W, Txz[i]/W, Tyz[i]/W]);
    const tr = e.l[0]+e.l[1]+e.l[2];
    if(!(tr > 1e-9)) continue;
    const c = Math.max(0, Math.min(1, (e.l[0]-e.l[1]) / tr));
    const vl = Math.hypot(e.v[0], e.v[1], e.v[2]); if(!(vl>1e-9)) continue;
    let vx=e.v[0]/vl, vy=e.v[1]/vl, vz=e.v[2]/vl;
    /* 고유벡터는 부호가 없다(±v 둘 다 해). 그 부호를 극성 평균벡터로 정한다.
       |P|/W가 1에 가까우면 모든 관측이 같은 쪽을 가리켰다는 뜻이고, 0에
       가까우면 뷰마다 반대라 <b>모른다</b>는 뜻이다 — 그때는 안 쓴다. */
    const PW = Pw[i];
    if(PW > 1e-9){
      const px=Pxa[i]/PW, py=Pya[i]/PW, pz=Pza[i]/PW;
      const pl = Math.hypot(px,py,pz);
      if(pl > 1e-9){
        if(vx*px + vy*py + vz*pz < 0){ vx=-vx; vy=-vy; vz=-vz; }
        pol[i] = Math.min(1, pl);
        polSum += pol[i]; polN++;
      }
    }
    dir[i*3]=vx; dir[i*3+1]=vy; dir[i*3+2]=vz;
    coh[i]=c; cohSum+=c; cohN++;
  }
  const field = { NT, NP, dir, coh, pol, CY, b, filled, obs:totalObs, perView,
                  meanCoh: cohN ? cohSum/cohN : 0,
                  meanPol: polN ? polSum/polN : 0, polCells: polN, ok:true };
  console.log('[3D·결] 결 필드 통합 — 관측 '+totalObs+'개('
    + names.map(n=>n+':'+(perView[n]||0)).join(' ') + ') → 셀 '+filled+'/'+NC
    + ' 채움, 평균 3D 또렷함 '+field.meanCoh.toFixed(3)
    + ' · 극성 있는 셀 '+polN+'/'+filled+' (평균 일관도 '+field.meanPol.toFixed(2)+')');
  return field;
}

/* 두상 좌표 한 점의 결방향. 이웃 셀 4개를 부호 맞춰 섞어서 셀 경계의 각짐을 없앤다
   (텐서를 다시 분해하면 정확하지만 점마다 하기엔 비싸다 — 스무딩을 이미 했으므로
   벡터 혼합으로 충분하다). 반환 방향은 <b>부호 없음</b>: 쓰는 쪽에서 진행 방향과
   내적이 양수가 되도록 뒤집어 쓴다. */
function sampleHairField3D(field, p){
  if(!field || !field.ok) return null;
  const NT=field.NT, NP=field.NP;
  const th = Math.atan2(p.x, p.z);
  const tf = (th + Math.PI) / (2*Math.PI) * NT - 0.5;
  const ny = Math.max(-1, Math.min(1, (p.y - field.CY) / Math.max(1e-6, field.b)));
  const pf = Math.max(0, Math.min(NP-1.001, Math.acos(ny) / Math.PI * NP - 0.5));
  const t0 = Math.floor(tf), p0 = Math.floor(pf);
  const ft = tf - t0, fp = pf - p0;
  let ax=0, ay=0, az=0, ac=0, aw=0, ap=0, sx=0, sy=0, sz=0, best=-1;
  for(let dp=0; dp<=1; dp++) for(let dt=0; dt<=1; dt++){
    const pj = Math.max(0, Math.min(NP-1, p0+dp));
    const tj = (((t0+dt) % NT) + NT) % NT;
    const ci = pj*NT + tj;
    const c = field.coh[ci];
    if(!(c > 0)) continue;
    const w = ((dt? ft : 1-ft) * (dp? fp : 1-fp)) * c;   // 또렷한 셀에 더 무게
    if(!(w > 0)) continue;
    let vx=field.dir[ci*3], vy=field.dir[ci*3+1], vz=field.dir[ci*3+2];
    if(best < 0){ sx=vx; sy=vy; sz=vz; best=c; }          // 부호 기준(첫 유효 셀)
    if(vx*sx + vy*sy + vz*sz < 0){ vx=-vx; vy=-vy; vz=-vz; }
    ax+=vx*w; ay+=vy*w; az+=vz*w; ac+=c*w; aw+=w;
    ap += (field.pol ? field.pol[ci] : 0) * w;
  }
  if(!(aw > 0)) return null;
  const l = Math.hypot(ax,ay,az);
  if(!(l > 1e-9)) return null;
  // pol: 이 방향의 <b>부호</b>를 믿어도 되는 정도. 0이면 예전처럼 진행 방향에 맞춰 쓴다.
  return { x:ax/l, y:ay/l, z:az/l, coh: ac/aw, pol: ap/aw };
}

/* ── 3D 가닥을 결 필드에 정렬 ──────────────────────────────────────
   가닥을 <b>다시 걷는다</b>. 뿌리는 그대로 두고, 스텝마다 원래 진행 방향을
   실측 결방향 쪽으로 (세기만큼) 돌린 뒤 <b>같은 길이</b>만큼 나아간다.
   길이는 보존되므로 커트 길이(실측)는 안 흔들린다.

     원래 3D 경로 ╲                실측 결 ↓            정렬 후 ╲
                  ╲___              ↓                          ╲
                      ╲             ↓                           ╲

   두 가지 안전장치:
     · 뿌리 램프(rootHold) — 앞부분은 세기를 0에서 올린다. 뿌리 좌표는 두피
       실측이라 여기가 흔들리면 머리가 통째로 뜬 것처럼 보인다.
     · 표류 되돌림(drift/restore) — 스텝마다 오차가 쌓이면 가닥이 머리에서
       떨어져 나간다. 원래 경로에서 멀어질수록 <b>방향에</b> 복원력을 섞는다.

   ※ 복원력을 <b>위치 클램프</b>로 짰다가 되돌렸다(2026-08-01, Node 하네스에서 발견).
     "원래 점에서 maxDrift 넘으면 그 거리로 당긴다"로 짰더니, 수평으로 잘못 심은
     가닥을 넣었을 때 스텝마다 58° 씩 아래로 꺾이는데도 <b>끝 방향이 그대로 수평</b>
     이었다. 당연했다 — 매 스텝 원래 경로 옆 일정 거리로 끌어다 놓으니, 결과는
     "원래 경로를 통째로 평행이동한 것"이 되고 방향은 하나도 안 바뀐다.
     정렬이 <b>정확히 상쇄되는</b> 형태라 로그(꺾임 58°)만 보면 잘 되는 것처럼
     보이는 게 특히 나빴다. 복원은 위치가 아니라 방향에 걸어야 한다.
   필드 방향은 헐 접평면 위에 있으므로 이 적분은 대체로 표면을 따라 흐른다
   (= 머리에서 뜨지 않는다). 그게 접평면으로 들어올린 이유이기도 하다. */
function alignStrandPtsToField3D(pts, field, headA, acc){
  if(!field || !field.ok || !pts || pts.length < 3) return pts;
  const F = HAIR_FIELD3D;
  const out = [ { x:pts[0].x, y:pts[0].y, z:pts[0].z } ];
  const nSeg = pts.length - 1;
  let arc = 0;                                   // 지금까지 간 호길이 — 허용치의 기준
  for(let i=1;i<pts.length;i++){
    const prev = out[i-1];
    let dx = pts[i].x - pts[i-1].x, dy = pts[i].y - pts[i-1].y, dz = pts[i].z - pts[i-1].z;
    const seg = Math.hypot(dx,dy,dz);
    if(seg > 1e-9){
      dx/=seg; dy/=seg; dz/=seg;
      const f = sampleHairField3D(field, prev);
      if(acc) acc.n++;
      if(f && f.coh > 0){
        if(acc) acc.hit++;
        let fx=f.x, fy=f.y, fz=f.z;
        /* ── 부호를 누가 정하는가 (2026-08-01) ─────────────────────────
           예전: 무조건 <b>진행 쪽</b>으로 뒤집었다. 그러면 필드는 잘못 가는
                 가닥에게 영원히 "그쪽이 맞다"고 답한다 — 교정 능력이 0이다.
           지금: 필드가 극성을 아는 자리(pol≥min3DPol)에서는 <b>필드 쪽</b>을
                 따른다. 모르는 자리에서만 예전처럼 진행 쪽에 맞춘다. */
        const trustPol = HAIR_FLOW.on && f.pol >= HAIR_FLOW.min3DPol;
        const agree = fx*dx + fy*dy + fz*dz;
        /* [진단] 필드와 <b>올라온 가닥</b>이 얼마나 어긋나 있나 — 뒤집기 <b>전</b>에 잰다.
           이 히스토그램 하나로 원인이 갈린다:
             · 150~180°에 몰림  → 극성 문제(필드가 끝 방향을 반대로 앎)
             · 0~60°에 한 봉우리 → 기하 문제(두 리프트가 체계적으로 어긋남).
               평균 꺾임 24°는 정렬이 매 스텝 85%씩 그 차이를 따라간 결과일 뿐이다.
           극성이 확정된 셀에서만 센다 — 아닌 셀은 부호가 애초에 임의값이라
           각도를 재 봐야 동전 던지기 분포가 나온다(그걸 근거로 삼으면 안 된다). */
        if(acc && trustPol){
          const ang = Math.acos(Math.max(-1, Math.min(1, agree))) * 180/Math.PI;
          acc.polHist = acc.polHist || new Array(6).fill(0);
          acc.polHist[Math.min(5, (ang/30)|0)]++;
          acc.polAngSum = (acc.polAngSum||0) + ang;
        }
        let reversed = false;
        if(trustPol){ if(agree < 0) reversed = true; }        // 필드가 "반대로 가는 중"이라 함
        else if(agree < 0){ fx=-fx; fy=-fy; fz=-fz; }         // 결은 선분 — 진행 쪽으로
        const ramp = Math.min(1, (i/nSeg) / Math.max(1e-6, F.rootHold));
        let al = Math.min(F.maxAlign, f.coh * F.gain) * ramp;
        /* 되돌릴 때는 천천히. 한 스텝에 0.85를 먹이면 가닥이 제자리에서 접혀
           핀이 생긴다(정렬 로그의 평균 꺾임만 커지고 형태는 망가진다). */
        if(reversed){ al = Math.min(al, F.maxTurnAlign != null ? F.maxTurnAlign : HAIR_FLOW.maxTurnAlign);
                      if(acc) acc.polFlip = (acc.polFlip||0) + 1; }
        if(acc && trustPol) acc.polUsed = (acc.polUsed||0) + 1;
        let nx = dx + (fx-dx)*al, ny = dy + (fy-dy)*al, nz = dz + (fz-dz)*al;
        const nl = Math.hypot(nx,ny,nz);
        if(nl > 1e-9){
          nx/=nl; ny/=nl; nz/=nl;
          if(acc){ acc.turn += Math.acos(Math.max(-1, Math.min(1, nx*dx+ny*dy+nz*dz))); acc.turnN++; }
          dx=nx; dy=ny; dz=nz;
        }
      }
      // ── 표류 되돌림(방향) — 허용치를 넘어서면 원래 경로 쪽으로 방향을 섞는다 ──
      // 허용치의 절반부터 서서히 들어와 허용치에서 최대. 위치를 잡아채지 않으므로
      // 정렬이 상쇄되지 않고, 대신 표류가 어느 선에서 <b>평형</b>을 이룬다.
      const allow = Math.max(F.driftMin * headA, F.driftRate * arc);
      const ex = pts[i-1].x - prev.x, ey = pts[i-1].y - prev.y, ez = pts[i-1].z - prev.z;
      const el = Math.hypot(ex,ey,ez);
      if(el > allow*0.5 && allow > 1e-9){
        const pull = Math.min(1, (el/allow - 0.5) * 2) * F.restore;
        let nx = dx + (ex/el - dx)*pull, ny = dy + (ey/el - dy)*pull, nz = dz + (ez/el - dz)*pull;
        const nl = Math.hypot(nx,ny,nz);
        if(nl > 1e-9){ dx=nx/nl; dy=ny/nl; dz=nz/nl; }
      }
    }
    arc += seg;
    out.push({ x: prev.x + dx*seg, y: prev.y + dy*seg, z: prev.z + dz*seg });
  }
  return out;
}

/* ══════════════════════════════════════════════════════════════════
   3D 모발 점유(occupancy) 필드 — 헤어 세그멘테이션을 두상 좌표로 통합 (2026-08-01)
   ─────────────────────────────────────────────────────────────────
   결(orientation)에 이어 <b>세그멘테이션</b>을 3D로 올린다. 결 필드가 "이 자리
   머리카락이 <b>어느 방향</b>으로 흐르나"였다면, 이건 "이 자리에 머리카락이
   <b>있기는 한가</b>"이다.

   왜 필요한가 — 지금 3D 모델은 세그멘테이션을 <b>모른다</b>:
     · 리프트는 헐 단면으로 깊이를 지어 붙인다. 마스크에 구멍(가르마·정수리 노출·
       민머리)이 있어도 헐은 그냥 매끈한 타원이라 그 구멍이 사라진다.
     · 안 찍힌 뷰는 맞은편을 <b>거울</b>로 채운다. 반대쪽에 머리가 없어도 채운다.
     · 되쏠 때는 네 뷰 가닥을 전부 겹쳐 그린다. 그 뷰 마스크 밖으로 나가도 막는 게
       깊이 컬링뿐이다(스크린샷에서 결이 얼굴 위로 넘어온 이유).
   즉 "머리카락이 없는 자리"라는 정보가 3D 어디에도 없었다.

   방법 — 실루엣 카빙(shape-from-silhouette)의 표면판.
   3D 점 P를 네 실측 뷰로 <b>되쏘아</b> 각 뷰의 헤어 마스크를 찍어 본다.
     · 그 카메라 반대편(depth ≤ 0)인 뷰는 발언권 없음 — 그 뷰가 보는 건 앞쪽 머리다.
     · 앞쪽인 뷰는 정면성(depth)에 비례한 <b>가중치</b>로 투표. 실루엣 근처에서
       비스듬히 스치는 뷰는 약하게 센다(마스크 경계 오차가 그대로 들어오므로).
     · 점유도 = Σ(가중치 × 마스크) / Σ(가중치).
   엄격한 AND(한 뷰라도 배경이면 깎기)를 안 쓴 이유: 뷰가 4장뿐이고 포즈·마스크에
   오차가 있어서 AND는 실제 있는 머리까지 지운다. 가중 투표는 "그 자리를 제일 잘
   보는 뷰의 말"을 자연히 크게 듣는다 — 옆머리는 측면 뷰가, 뒤통수는 후면 뷰가.

   쓰는 곳(이번 턴):
     · 리프트에서 <b>가닥을 다듬는다</b>. 점유가 없는 구간으로 들어가면 거기서 자른다.
       뿌리부터 없으면 가닥을 통째로 버린다(거울 채움이 민머리에 심는 것 차단).
   다음 턴: 되쏘기(projectHair3DToView / projectHairQuiltToView)에서 같은 프로브로
   화면 클립 — 사용자 지시 "세그멘테이션 영역 밖에서는 렌더링이 안 되게".
══════════════════════════════════════════════════════════════════ */
const HAIR_OCC3D = {
  on:       true,  // 끄면 예전 동작(세그멘테이션 미반영)으로 즉시 복귀 — A/B 확인용
  alphaThr: 40,    // 이 알파 이상이면 그 픽셀은 머리카락(2D isRealHairAt와 같은 기준)
  minFacing: 0.12, // 정면성이 이 미만인 뷰는 투표에서 뺀다(실루엣 스치기)
  occThr:   0.35,  // 점유도가 이 미만이면 "머리카락 없음"
  minSeen:  0.15,  // 투표 가중치 합이 이 미만이면 판단 보류(아무도 제대로 못 봄 → 통과)
  /* (2026-08-08) <b>제일 잘 본 뷰 하나</b>가 이 정면성을 넘어야 "머리 없음"으로 지울 수 있다.
     스친 표는 여러 개 합쳐져도 지울 권한이 없다 — 정수리가 정확히 그 자리다(위 at() 주석).
     0으로 두면 예전 동작(합만 보기). 값 감각: 적도 정면 w=1.0, 정수리 근처 w≈0.4. */
  confidentFacing: 0.40,
  offRun:   3,     // 연속 이만큼 비어야 자른다(마스크 구멍·경계 노이즈 관용 —
                   // 2D traceStrandPath의 _offRun과 같은 발상, 같은 값)
  skipRoot: 2,     // 뿌리 쪽 이 개수는 검사 안 함(두피 경계는 항상 애매하다)
  minPts:   3,     // 이보다 짧게 남으면 가닥을 통째로 버린다
  // 진단 격자(미니 3D 시각화 + 다음 턴 캐시용). 결 필드와 같은 파라미터화.
  NT: 64, NP: 32,

  /* ── 조정 후 재클립 (2026-08-01) ─────────────────────────────────────
     사용자: "클립으로 헤어세그멘테이션 넘어가는 부분을 잘 잡아놨는데,
     3D 미리보기에서는 클립이 안 먹었어."
     맞다. 위 다듬기는 <b>리프트할 때 한 번</b>만 돈다(buildHairStrandsFromPaths).
     그런데 미니 3D와 최종 3D 화면이 그리는 것은 그 결과가 아니라
     computeAdjustedHair3DStrands가 <b>연산자를 얹은 뒤</b>의 가닥이다:
       길이 → 컬 → 중력 → 가르마 → 넘김 → 볼륨 → 결흐름
     이 일곱 연산자가 전부 점을 <b>움직인다</b>. 다듬을 때 마스크 안이던 점이
     움직여서 밖으로 나가면 아무도 안 잡는다. 2D는 그리고 나서 destination-in을
     걸기 때문에 언제 움직였든 상관없이 잡혔고, 3D만 못 잡고 있었다.
     → 연산자를 다 얹은 <b>다음에</b> 같은 프로브로 한 번 더 다듬는다.
        판정 기준(occThr·offRun·minSeen)은 리프트 때와 <b>같은 자</b>를 쓴다.

     두 가지가 리프트 때와 다르다:
     ① 늘린 머리는 나가는 게 맞다 — 2D의 hairClipGrowPx와 같은 발상.
        2D는 캔버스 높이 비례로 클립 마스크를 키우지만, 3D는 <b>그 가닥이
        실제로 늘어난 호길이</b>만큼 여유를 준다((비율-1)×원래 호길이).
        더 정확하고(가닥마다 다름) 자를 하나 덜 쓴다. 중립이면 여유 0.
     ② 여기서는 가닥을 <b>버리지 않는다</b>(neverDrop). 뿌리에 머리가 없는
        가닥은 리프트 때 이미 걸러졌다. 조정 후 뿌리가 마스크를 벗어났다면
        그건 "머리가 없다"가 아니라 볼륨·가르마가 뿌리를 <b>들어올린</b>
        것이므로, 통째로 지우면 볼륨 슬라이더가 머리를 삭제하게 된다.
        2D도 이럴 때 밖으로 나간 부분만 지우지 가닥을 없애지 않는다. */
  clipAdjusted: true,  // false면 예전 동작(조정 후 클립 없음) — A/B용
  growPerRatio: 1.0,   // (길이비율-1) × 원래 호길이 × 이 값 = 마스크 밖 허용 길이(moveGrow=false일 때만)

  /* ── 여유를 <b>시술이 실제로 움직인 거리</b>로 (2026-08-18 i, 사용자 지시) ──
     사용자: "미용시술을 하고 나면 원래 앞머리가 없었던 사람에게 뱅 시술을
     해주기도 하고, 직모였던 사람에게 컬을 시술하면 공간적으로 더 차지하게
     되는 게 당연한데." / "아예 이 방향으로 가자. 컬까지."

     맞다. 위 growPerRatio는 <b>길이</b>만 여유로 인정한다. 그런데 조정 연산자는
     일곱이고(길이·컬·중력·가르마·넘김·볼륨·결흐름) 그중 여섯은 여유를 1도 안
     만든다. 그래서 직모에 컬을 넣으면 부푼 만큼이 <b>시술 전 직모 실루엣</b>에
     그대로 잘렸다. 뱅도 같다 — 마네킹일 때만 fringeFrac에 얹혀 겨우 살아 있었고
     마네킹을 끄면 이마에서 전멸했다.

     고침은 새 상수가 아니라 <b>이미 손에 있는 두 좌표의 차</b>다:
         여유(i) = |조정후 가닥[i] − 중립 가닥[i]|
     · 아무 시술도 안 했으면 변위 0 → 예전과 <b>완전히 같은 동작</b>(회귀 없음)
     · 길이를 늘리면 끝이 움직인 만큼 = (비율−1)×호길이 → growPerRatio를 자동 포함
     · 컬·볼륨·아웃컬은 부푼 만큼 <b>그만큼만</b> — 방향 제한이 필요 없다
       (앞쪽만 여는 식의 방향 게이트는 컬에 대해 틀린 답이다: 컬은 옆으로 분다)
     · 얼굴 거부(faceVeto)는 그대로 위에 남는다 — "머리는 늘어나도 얼굴은 못 덮는다"
     false로 두면 예전 동작(growPerRatio 길이 여유). */
  moveGrow: true,

  /* ── 늘림 여유의 <b>방향</b> 제한 — 얼굴 위로는 안 넘어간다 (2026-08-01) ──
     사용자: "프론트 길이를 늘린 건데, 늘리면 저렇게 나타나서 침범하게 된다고."
     맞다. 위 growPerRatio는 <b>크기</b>만 맞고 <b>방향</b>이 빠져 있었다.
     길이 93%면 비율 1.77 → 여유 = 0.77 × 호길이 ≈ 두상 반폭만큼이다. 그 여유가
     사방으로 열려 있으니, 관자놀이에서 안쪽을 향하던 가닥이 그대로 뺨을 가로지른다.
     로그가 정확히 그 상태였다: "자름 0개 · 판정 117759회" — 다 통과.

     크기는 맞다(늘어난 호길이만큼 마스크 밖으로 나가는 게 물리적으로 옳다).
     고칠 것은 <b>어디로</b> 나가느냐다: 아래·바깥으로 나가는 건 머리가 길어진
     것이고, 얼굴을 가로지르는 건 아니다.
     얼굴 영역은 랜드마크 박스(귀 사이 × 눈썹→턱)를 타원으로 쓴다. reasonMask의
     얼굴박스(2)를 쓰지 않는 이유: 그건 ENABLE_LANDMARK_POSTPROCESS && 세그멘터가
     MediaPipe가 <b>아닐</b> 때만 채워진다. 지금은 MediaPipe가 성공하므로 실기기
     로그의 faceBoxDiag가 전부 null이다 — 있지도 않은 신호에 기댈 뻔했다.

     ※ 이 거부는 <b>여유 구간에만</b> 건다. 원래 마스크 안(=사진에 실제로 머리가
        있던 자리, 뺨 옆 머리 등)은 점유 판정으로 이미 통과하므로 영향 없다. */
  faceVeto: false,   // (2026-10-10d · 옛 64) 끔 — 사용자: "최소화하는거는 이제 점점 없애라는 얘기야. 튀어나오는 가닥들 어차피 3D결과보기에 갔다가 나오면 잘리긴 하니까." 되돌리기 HAIR_OCC3D.faceVeto=true
  faceMaxYaw: 60,   // 이보다 옆으로 돌아간 뷰는 귀 간격이 무너져 박스를 안 쓴다
  faceInset: 0.10,  // 귀 간격 대비 좌우 안쪽 여백(귀는 얼굴보다 넓다)
  faceThr: 0.5,     // 가중 투표가 이 이상이면 "얼굴 위"로 본다

  /* ── 시술 여유 — 앞머리가 앉을 자리만 연다 (2026-08-09) ──────────────────
     사용자: "레이어드 보브를 눌러도 제대로 적용이 안 돼."

     역산은 멀쩡했다(끝높이 오차 두상높이 대비 1% 안쪽). 지워지고 있었던 것이다.
     재클립의 여유(growLen)는 <b>길이비율이 1을 넘을 때만</b> 생긴다. 그런데
     레이어드 보브는 전 섹션을 <b>짧게</b> 자르므로 여유가 정확히 0이고, 판정
     기준은 <b>손님의 원래 머리 실루엣</b>이다:
       · 앞머리(시스루 뱅) — 원래 사진엔 이마에 머리카락이 없다 → 뿌리 토막만 남고 전멸
       · 아웃컬(flow +38) — 바깥으로 뒤집힌 끝이 원래 실루엣 밖 → 잘림
     스타일의 정의적 특징 두 개가 <b>둘 다</b> 지워졌다.

     ※ 1차 수정은 여기서 "마네킹은 사진 가닥이 아니니 실루엣으로 자를 근거가
        없다"며 클립을 <b>통째로</b> 놓아 줬다. 실기기에서 틀린 것으로 판명났다 —
        left 밖으로 샘 58.4%(IoU 0.404) · right 45.8%. 논리는 맞았지만 전제가
        틀렸다: 마네킹 기하는 <b>혼자 설 만큼 정확하지 않다</b>(뿌리선 어긋남
        중앙값 36~89px, 뷰별 크라운 길이 0.46~1.97로 4배 차이). 실루엣 클립이
        그 오차를 가려 주고 있었고, 걷어내니 머리가 얼굴을 덮었다.
     그래서 <b>여는 폭을 정한다</b>. 앞머리가 필요로 하는 자리는 이마 하나이고,
     그건 잴 수 있다 — 헤어라인(두상높이 0.23)에서 눈썹(0.45)까지 <b>0.22</b>다.
     그만큼만 연다. 아래쪽 한계는 여유가 알아서 못 넘는다: 얼굴 타원이 눈썹에서
     시작하므로 여유 구간이 눈썹에 닿는 순간 거부된다(faceVeto). 즉 "앞머리는
     이마까지, 얼굴은 못 덮는다"가 상수 하나 없이 나온다.
     0으로 두면 예전 동작(마네킹도 여유 0).

     ── (2026-08-18 i) 이 여유는 <b>앞쪽에만</b> 연다 ─────────────────────────
     위 문단이 스스로 말하듯 이 여유가 여는 자리는 <b>이마</b> 하나다. 그런데
     구현은 방향 제한이 없어서 옆·뒤로도 똑같이 열려 있었고, 마네킹 중립 상태
     (=시술 전, 변위 0이라 moveGrow가 아무 여유도 안 주는 상태)에서 옆·뒤 가닥이
     실루엣 밖으로 두상높이의 4분의 1만큼 뻗었다 — 사용자가 본 측면의 삐죽삐죽이다.
     그래서 두상 로컬 z>0(앞쪽 반구)에서만 이 <b>바닥값</b>을 준다. 상수는 안 늘고
     좌표 부호 하나로 끝난다. 시술로 부푸는 몫은 방향과 무관하게 moveGrow가
     따로 주므로, 이 제한이 컬·볼륨을 막지 않는다(그게 8/18 i의 핵심 분업이다). */
  fringeFrac: 0.25,
  fringeFrontOnly: true,   // false면 예전 동작(사방으로 열림)
};

/* 뷰별 얼굴 타원(정규화 [0,1] 이미지 좌표). 2D 클립과 3D 재클립이 <b>같은</b>
   영역을 쓰도록 한 곳에서만 만든다. 랜드마크가 없거나 옆으로 많이 돌아간 뷰는
   null — 거부를 아예 안 건다(모르는 것으로 지우지 않는다). */
/* ── 얼굴 타원이 <b>얼굴 위에 없었다</b> (2026-09-05) ────────────────────────
   증상: 측면 뷰에서 사이드·템플 머리가 <b>동그랗게</b> 뜯겨 나가고, 남은 머리가
        턱선에서 끊겨 단발이 된다. 마네킹을 켜면 3D에서도 같은 자리가 없다.

   ── 같은 원인 하나다 ─────────────────────────────────────────────────
   이 타원은 두 곳이 쓴다. ① buildHairClipMask의 destination-out(2D) ②
   trimStrandToOccupancy3D의 faceVeto(3D 기하). 그래서 타원이 엉뚱한 자리에
   있으면 2D는 <b>지워지고</b> 3D는 <b>잘린다</b> — 사용자가 본 두 증상이 정확히
   그 둘이다. 마네킹을 끄면 3D가 멀쩡한 것도 설명된다: 촬영 가닥은 원본 실루엣
   안이라 여유 구간에 안 들어가고, faceVeto는 <b>여유 구간에만</b> 걸린다.
   반대로 마네킹 가닥은 전부 여유 구간이라 그대로 얻어맞는다.

   ── 자를 잘못 댔다 ───────────────────────────────────────────────────
   예전 식은 얼굴 좌우를 <b>귀 사이</b>(lm[234]~lm[454])로 잡고 그 중점을
   얼굴 중심으로 썼다. 이건 정면에서만 맞는다. 두상을 반지름 R의 구로 두고
   yaw θ만큼 돌리면
       귀 두 점의 투영 x = ±R·cosθ  → 중점은 언제나 <b>두상 중심</b>
       얼굴(코)의 투영 x = +R·sinθ
   즉 얼굴은 sinθ만큼 앞으로 나가는데 타원은 <b>제자리에</b> 남는다. θ=50°면
   얼굴은 0.77R에 있고 타원은 [−0.58R, +0.58R]을 덮는다 — <b>얼굴을 거의 비껴
   나가서 뒤통수 쪽 옆머리를 덮는다</b>. 화면의 동그란 구멍이 그 타원이고,
   타원 아래끝이 chinY라 옆머리가 딱 턱선에서 끊겨 단발이 된다.
   진단칩의 근사yaw가 이미 그 값을 적고 있었다: left 1.76 · right −1.53
   (= 코가 귀 반간격의 1.5~1.8배만큼 밖에 있다는 뜻이고, 정면이면 0이다).

   ── 고침: 얼굴 폭을 <b>실측 얼굴 점들</b>로 잰다 ─────────────────────────
   랜드마크 468점은 이미 저장돼 있다(lm.rawLandmarks). 그 투영 x의 최소·최대가
   곧 <b>그 뷰에서 보이는 얼굴 폭</b>이고, 얼굴과 함께 돌아간다. 새 상수도 새
   측정기도 없다 — hairlineVsFaceRatio가 쓰는 그 자다(12b, "얼굴 반폭").
   ※ 정면에서는 <b>비트 단위로 예전과 같다</b>: 정면 투영에서 468점의 x 극값이
     바로 lm[234]/lm[454](=lEarX/rEarX)라서 fx0/fx1이 lx/rx와 같은 값이 된다.
     달라지는 것은 얼굴이 돌아간 뷰뿐이고, 거기서만 타원이 얼굴을 따라간다.
   되돌리기: FACE_ELLIPSE_HULL = false */
const FACE_ELLIPSE_HULL = true;
function getViewFaceEllipse(angle){
  if(!HAIR_OCC3D.faceVeto) return null;
  /* 마네킹 기하는 깊이 판정이 정확하므로 이 타원이 할 일이 없다 — 오히려
     9/05 배너가 적어 둔 "사이드·템플이 동그랗게 뜯긴다"가 여기서 난다.
     되돌리기: MQ_TRUST.faceEllipse = false (MQ_TRUST 배너) */
  if(MQ_TRUST.faceEllipse && mqGeomTrusted()) return null;
  const lm = state.landmarks && state.landmarks[angle];
  if(!lm || lm.chinY == null) return null;
  let yaw = 0; try{ yaw = Math.abs(getViewYawDeg(angle) || 0); }catch(e){}
  if(yaw > HAIR_OCC3D.faceMaxYaw) return null;
  const yTop = (lm.browTopY != null ? lm.browTopY : lm.eyeY);
  if(!(lm.chinY > yTop)) return null;

  let lx = Infinity, rx = -Infinity;
  const raw = FACE_ELLIPSE_HULL ? lm.rawLandmarks : null;
  if(raw && raw.length >= 468){
    for(let i=0;i<raw.length;i++){
      const x = raw[i].x;
      if(x < lx) lx = x;
      if(x > rx) rx = x;
    }
  } else if(FACE_ELLIPSE_HULL && lm.features){
    /* 원본 468점이 없는 세션(예전 캐시)에서는 이름 붙은 부위 상자로 대신한다 —
       눈썹·눈·입은 전부 <b>얼굴 앞면</b>이라 역시 얼굴을 따라 돈다. */
    const F = lm.features;
    for(const k of ['leftBrow','rightBrow','leftEye','rightEye','mouth']){
      const b = F[k]; if(!b) continue;
      if(b.minX < lx) lx = b.minX;
      if(b.maxX > rx) rx = b.maxX;
    }
  }
  if(!(rx - lx > 0.02)){
    // 아무것도 못 쟀을 때만 예전 귀 기준으로 폴백(모르는 것으로 지우지 않는다)
    if(lm.lEarX == null || lm.rEarX == null) return null;
    lx = Math.min(lm.lEarX, lm.rEarX); rx = Math.max(lm.lEarX, lm.rEarX);
    if(!(rx - lx > 0.02)) return null;
  }
  const inset = (rx - lx) * HAIR_OCC3D.faceInset;
  return { cx:(lx+rx)/2, cy:(yTop+lm.chinY)/2,
           rx:Math.max(1e-4, (rx-lx)/2 - inset), ry:Math.max(1e-4, (lm.chinY-yTop)/2) };
}

/* 뷰별 헤어 마스크 샘플러 — 축소 알파를 1회만 만들어 캐시.
   reasonMask(1=최종 머리카락)가 있으면 그걸 쓴다 — 이미 축소 해상도로 메모리에
   있어서 getImageData가 아예 필요 없다. 없으면 hairCanvas 알파를 축소해 샘플링. */
const _viewMaskCache = {};
function getViewMaskSampler(angle){
  const mi = state.hairMasks && state.hairMasks[angle];
  const hairC = state.hairCanvases && state.hairCanvases[angle];
  if(!mi) return null;
  const cached = _viewMaskCache[angle];
  if(cached && cached.mi === mi) return cached.s;
  const iw = mi.w, ih = mi.h;
  let W, H, hit;
  if(mi.reasonMask && mi.maskW && mi.maskH){
    W = mi.maskW; H = mi.maskH;
    const rm = mi.reasonMask;
    hit = (x, y)=> rm[y*W + x] === 1 ? 1 : 0;
  } else if(hairC){
    W = Math.max(8, mi.maskW || Math.round(iw*0.5));
    H = Math.max(8, mi.maskH || Math.round(ih*0.5));
    let data;
    try{
      const sc = document.createElement('canvas'); sc.width=W; sc.height=H;
      const sx = sc.getContext('2d', { willReadFrequently:true });
      sx.drawImage(hairC, 0, 0, W, H);
      data = sx.getImageData(0,0,W,H).data;
    }catch(e){ return null; }
    hit = (x, y)=> data[(y*W + x)*4 + 3] > HAIR_OCC3D.alphaThr ? 1 : 0;
  } else return null;
  const s = {
    W, H,
    // 마스크 원본(mi.w/h) 좌표 → 0(없음) / 1(머리카락)
    at(ix, iy){
      const x = (ix / iw * W) | 0, y = (iy / ih * H) | 0;
      if(x < 0 || y < 0 || x >= W || y >= H) return 0;   // 화면 밖 = 머리카락 아님
      return hit(x, y);
    },
  };
  _viewMaskCache[angle] = { mi, s };
  return s;
}

/* 뷰별 <b>뿌리 밀도</b> 샘플러 — 위 마스크 샘플러의 짝. 마스크 샘플러가
   "머리카락이 있나(0/1)"를 돌려주는 자리에서, 이건 "얼마나 촘촘한가(0~1)"를
   돌려준다. 안 잰 셀은 -1 — 0(대머리)과 <b>구분</b>해야 한다. 0으로 뭉개면
   못 본 자리를 전부 대머리로 만든다. (2026-08-01) */
const _viewDensCache = {};
function getViewDensitySampler(angle){
  const mi = state.hairMasks && state.hairMasks[angle];
  const d  = mi && mi.identity && mi.identity.density;
  if(!d) return null;
  const cached = _viewDensCache[angle];
  if(cached && cached.mi === mi) return cached.s;
  const iw = mi.w, ih = mi.h, GW = d.GW, GH = d.GH, val = d.val;
  const s = {
    at(ix, iy){
      const x = (ix / iw * GW) | 0, y = (iy / ih * GH) | 0;
      if(x < 0 || y < 0 || x >= GW || y >= GH) return -1;
      return val[y*GW + x];
    },
  };
  _viewDensCache[angle] = { mi, s };
  return s;
}

/* 실측 뷰들로 "이 3D 점에 머리카락이 있나"를 판정하는 프로브.
   project3DPointToView와 <b>같은 식</b>을 쓰되 회전행렬을 뷰마다 한 번만 만든다
   (그 함수는 호출마다 composeRotationZYX를 새로 조립해서, 점 수십만 개에 쓰면
   그 조립이 비용의 대부분이 된다). */
let _grazingAbstain = 0;   // [진단] 스친 표만 있어 판단 보류한 횟수(정수리 진단용)
function makeHairOccupancyProbe(views, names, yTop, CY, headR){
  // (옛 52) 360 세트의 추가 사진(카메라 맞춘 것)을 형태 계산에 더하고, 이상한 기준 사진은 뺌(아래 VIEWS360)
  { const v = VIEWS360._probeArgs(views, names, yTop, CY); if(v){ views = v[0]; names = v[1]; } }
  if(!HAIR_OCC3D.on) return null;
  const O = HAIR_OCC3D;
  const cams = [];
  names.forEach(n=>{
    const v = views[n];
    const smp = getViewMaskSampler(n);
    if(!v || !smp) return;
    const mi = state.hairMasks && state.hairMasks[n];
    cams.push({ angle:n, R: composeRotationZYX(v.pose.yaw, v.pose.pitch, v.pose.roll),
                cx:v.cx, s:v.s, sy:v.sy, crownY:v.crownY, smp,
                dsmp: getViewDensitySampler(n),      // (2026-08-01) 뿌리 밀도용
                fell: getViewFaceEllipse(n),         // (2026-08-01) 늘림 여유 거부 영역
                iw: mi ? mi.w : 0, ih: mi ? mi.h : 0 });
  });
  if(!cams.length) return null;
  const invR = 1 / Math.max(1e-6, headR);
  /* 두상 3D 점 → 그 카메라의 이미지 좌표 (2026-08-02 통합).
     아래 세 프로브(at/densityAt/faceAt)가 이 여섯 줄을 글자 그대로 복제하고
     있었다 — 회전 적용, 카메라 뒤편 컷, 정면도 가중치 w, 이미지 좌표 환산.
     보이지 않으면(뒤편·너무 비스듬) null.
     결과를 매번 새 객체로 담으면 셀×카메라 수만큼(수십만 회) 할당이 생기므로
     호출 즉시 소비되는 스크래치 객체 하나를 돌려 쓴다. */
  const _proj = { w:0, ix:0, iy:0 };
  const projectToCam = (c, px, wy, pz)=>{
    const R = c.R;
    const lz = R[6]*px + R[7]*wy + R[8]*pz;
    if(lz <= 0) return null;                       // 이 카메라 뒤편 — 발언권 없음
    const w = Math.min(1, lz * invR);              // 정면일수록 크게
    if(w < O.minFacing) return null;
    const lx = R[0]*px + R[1]*wy + R[2]*pz;
    const ly = R[3]*px + R[4]*wy + R[5]*pz;
    _proj.w = w;
    _proj.ix = lx / c.s + c.cx;
    _proj.iy = c.crownY + (yTop - (ly + CY)) / c.sy;
    return _proj;
  };
  return {
    cams, nCam: cams.length,
    /* 같은 카메라·같은 식으로 <b>밀도</b>를 묻는다. 회전행렬을 공유하려고
       별도 프로브를 만들지 않고 여기 얹었다. 안 잰 뷰(-1)는 투표에서 빠지고,
       아무 뷰도 못 재면 seen=0 — 그 셀은 "모름"으로 남는다. */
    densityAt(px, py, pz){
      let wSum = 0, dSum = 0, wBest = 0;
      const wy = py - CY;
      for(let i=0;i<cams.length;i++){
        const c = cams[i]; if(!c.dsmp) continue;
        const p = projectToCam(c, px, wy, pz);
        if(!p) continue;
        const d = c.dsmp.at(p.ix, p.iy);
        if(d < 0) continue;                 // 그 뷰에서는 안 잰 자리
        if(p.w > wBest) wBest = p.w;        // 제일 정면으로 본 뷰의 정면성
        wSum += p.w; dSum += p.w * d;
      }
      /* wBest를 같이 돌려준다 — at()이 "스친 표로는 지우지 않는다"에 쓰는 것과
         같은 값이다. 밀도 쪽도 같은 기준으로 믿을지 말지를 정해야 한다. */
      return wSum > 0 ? { density: dSum/wSum, seen: wSum, wBest }
                      : { density: -1, seen: 0, wBest: 0 };
    },
    /* 이 3D 점이 <b>얼굴 위</b>에 있나 — 늘림 여유를 막는 데만 쓴다.
       얼굴 타원이 있는 뷰만 투표하고, 없으면 0(안 막음). */
    faceAt(px, py, pz){
      let wSum = 0, fSum = 0;
      const wy = py - CY;
      for(let i=0;i<cams.length;i++){
        const c = cams[i]; if(!c.fell || !c.iw) continue;
        const p = projectToCam(c, px, wy, pz);     // 뒤편이면 가릴 얼굴도 없다
        if(!p) continue;
        const nx = p.ix / c.iw, ny = p.iy / c.ih;
        const dx = (nx - c.fell.cx) / c.fell.rx, dy = (ny - c.fell.cy) / c.fell.ry;
        wSum += p.w; if(dx*dx + dy*dy <= 1) fSum += p.w;
      }
      return wSum > 0 ? fSum/wSum : 0;
    },
    /* ── 스친 표만으로는 지우지 않는다 (2026-08-08) ────────────────────────
       사용자: "후면 정수리는 여전히 좀 빈다."
       원인이 여기였다. 정수리는 <b>네 카메라가 전부 스치듯</b> 본다 — 수평 카메라
       넷의 축이 전부 정수리 접선 방향이라 어느 하나도 제대로 못 본다. 그런데
       기존 판정은 <b>가중치 합</b>만 봤다: 스친 표 넷(각 w≈0.15)이 합쳐지면
       0.6 > minSeen(0.15)이라 "충분히 봤다"가 되고, 그 표들로 occ를 낸다.
       그 자리에서 각 뷰는 마스크 <b>맨 윗줄</b>을 찍는데 거기는 1~2px만 어긋나도
       마스크 밖이라 "머리 없음"(0)이 나온다 → occ가 낮게 나옴 → 정수리를
       지나는 가닥이 잘린다(실측: 자름 1,147개 · 평균 9.7점 제거).
       고침: 합이 아니라 <b>제일 잘 본 뷰 하나</b>가 기준을 넘어야 지울 수 있다.
       아무도 제대로 못 봤으면 판단 보류 — 이 함수가 원래 내세운 규칙
       ("모르는 것을 지우지는 않는다")을 스친 표에도 적용하는 것뿐이다. */
    at(px, py, pz){
      let wSum = 0, hSum = 0, wBest = 0;
      const wy = py - CY;
      for(let i=0;i<cams.length;i++){
        const p = projectToCam(cams[i], px, wy, pz);
        if(!p) continue;
        if(p.w > wBest) wBest = p.w;
        wSum += p.w; hSum += p.w * cams[i].smp.at(p.ix, p.iy);
      }
      if(wSum <= O.minSeen) return { occ: 1, seen: wSum, abstain: 1 };
      if(O.confidentFacing > 0 && wBest < O.confidentFacing){
        _grazingAbstain++;                       // [진단] 스친 표만 있어 보류한 횟수
        return { occ: 1, seen: wSum, abstain: 2, wBest };
      }
      return { occ: hSum/wSum, seen: wSum, wBest };
    },
  };
}

/* ==========================================================================
 * VIEWS360 (옛 52-views360.js) — 360° 세트의 나머지 사진을 "형태 계산"에 넣기
 *
 * 자리: 13b, makeHairOccupancyProbe 바로 뒤. 원래 함수에서 부르는 곳 —
 *   · makeHairOccupancyProbe 맨 앞: 추가 사진(카메라 맞춘 것)을 views/names에 더함(VIEWS360._probeArgs)
 *   · extractHairMask(03b 바깥 단계): 뒤 사진 추출이 끝나면 나머지 사진 분석(VIEWS360._extract)
 *   · buildNeutralHair3D(17b 바깥 단계): 3D를 만들기 직전에 한 번 더(VIEWS360._build)
 *   · SHOT360.applySet(05) 앞뒤: 세트 지문·센서 각도를 포즈로
 *   · perfPanelLines(18) 끝 줄
 *
 * 왜 (2026-10-05 · 사용자): "사진 4장은 보여주기 위해서 4장인 거고, 전체 14장은 렌더링 전에 형태를 만드는 계산에 쓰는 것."
 *   45번(360° 촬영)은 14장을 뽑아 놓고 4장(정면·좌45·우45·후면)만 흐름에 넣었고, 나머지는 state.shots360에 들고만 있었습니다.
 *   그래서 360으로 찍어도 형태 계산은 4장짜리와 같았습니다(진짜 옆모습이 없어 뒤통수 두께를 못 재고, 귀 뒤·뒤통수 옆의 결도 못 읽음).
 *
 * 무엇을:
 *   ① 분석 — 기존 4장의 머리 추출이 끝난 직후(분석 모델이 올라와 있는 동안) 나머지 사진도 같은 extractHairMask로 분석합니다.
 *      결과(머리 마스크·결 방향·숱 격자)는 state.hairMasks['v90'] 같은 키로 들어갑니다(v90 = 손님 왼쪽 90°, vm90 = 오른쪽 90°).
 *      화면·슬롯·2D 조정은 그대로 4장입니다(state.shots에는 넣지 않음 · 사진 원본과 캔버스는 분석 뒤 버림).
 *   ② 카메라 맞추기 — 얼굴이 안 보이는 각도가 대부분이라 얼굴 랜드마크 없이 맞춥니다.
 *        방향   = 촬영 때 센서 각도(정면으로 고른 장의 센서 각도 ↔ 정면 얼굴 실측 yaw를 맞춤). 얼굴이 잡힌 사진은 얼굴 실측 yaw.
 *                 고개 숙임·기울임은 0.
 *        배율   = 얼굴이 잡힌 사진: 정면 배율 × (정면의 눈→턱 픽셀 ÷ 이 사진의 눈→턱 픽셀).
 *                 얼굴이 없는 사진: 정면 배율 × (정면의 "정수리→어깨선" 픽셀 ÷ 이 사진의 "정수리→어깨선" 픽셀) — 세로 길이는 돌아도 안 변한다는 가정.
 *                 어깨선이 안 잡히는 사진(옆모습은 어깨가 안 벌어짐)은 "정수리→목 밑동"으로 같은 계산.
 *                 둘 다 못 찾으면 믿는 이웃 각도 사이를 보간.
 *        가로 중심 = 정수리 아래 얕은 깊이(머리 높이의 capDepth)에서 머리 윤곽을 가로지른 선의 가운데.
 *        세로 기준 = 머리 맨 위(기존 4장과 같은 규칙).
 *   ③ 넣기 — 13b makeHairOccupancyProbe(점유 프로브)를 만들 때 추가 카메라를 같이 넣습니다. 프로브의 카메라를 읽는 계산이
 *      전부 14장을 보게 됩니다: 점유(머리 영역) 판정 · 뿌리밀도 · 다시 기르기(42)의 머리 영역 투표·두께 재기·결 읽기 · 마네킹 앞머리 판정.
 *      사진 가닥 들어올리기(13c)와 2D 화면은 예전대로 4장입니다.
 *      합성 장면(뒤통수 아래가 불룩한 단발 · 14방향)으로 본 효과: 다시 기르기 방식의 두께 재기 — 직접 잰 칸 244 → 415(/796),
 *      두께 오차 중앙값 3.1cm → 0.4cm. 점유 판정(probe.at)은 "그 자리를 정면으로 보는 사진"의 가중 평균이라 사진 수로는 거의 안 변합니다.
 *   ④ 진단 [360 뷰] — 어느 사진이 들어갔고 어느 사진을 왜 뺐는지.
 *
 * (2026-10-05b) 계산을 망칠 수 있는 사진은 뺀다 — 사용자: "계산에 오류날 수 있는 사진은 빼고 하도록."
 *   실측(혼자 팔을 돌려 찍은 세트): 센서 각도는 "폰이 돈 각도"라 몸이 같이 돌면 머리 둘레 각도와 안 맞습니다. +30·+45·+60°가 거의 같은
 *   정면 얼굴이었고, −30~−90°는 아래에서 올려다본 근접 사진, 180°는 머리가 화면 가장자리에 걸렸습니다. 그대로 넣었더니
 *   두께 중앙값 2.5 → 0.3cm(두께 0으로 잰 칸 6 → 728), 안 심은 뿌리 13 → 4741 — 머리가 두상에 납작하게 붙었습니다.
 *   두께는 "윤곽선을 보는 사진이 전부 머리라고 해야" 인정하므로 한 장만 틀려도 그 방향이 깎입니다. 그래서 의심스러우면 뺍니다.
 *   사진마다 보는 것(하나라도 걸리면 그 사진은 안 씀):
 *     · 머리가 화면에 다 들어왔나 — 머리 윗선이 좌우 가장자리(edgeFrac)에 닿거나 맨 위가 잘리면 뺌
 *     · 배율을 믿을 수 있나 — 얼굴이 잡힌 사진은 얼굴 자(눈→턱 길이 · 앱의 정면 세로 자와 같은 자)로 잼.
 *       얼굴이 없는 사진은 몸 자(어깨선/목 밑동)인데, 얼굴이 잡힌 사진들에서 몸 자가 얼굴 자와 rulerTol 안으로 맞을 때만 믿음
 *       (실측 세트: 어깨선 자는 1.00, 얼굴 자는 1.47 — 팔을 들고 찍으면 어깨선이 안 맞음). 못 믿으면 얼굴 없는 사진은 전부 뺌.
 *       비가 범위 밖이면 뺌. 못 잰 사진은 믿는 이웃 둘 사이일 때만 보간
 *     · 올려다보거나 내려다봤나 — 얼굴 실측 pitch가 정면과 pitchTol 넘게 다르면 뺌
 *     · 머리 크기가 말이 되나 — 머리 윗선 폭 ÷ 그 각도의 두상 폭이 qLo~qHi 밖이면 뺌(너무 가깝거나 먼 사진)
 *     · 두피가 머리 안에 들어오나(옆·뒤 사진만 — yaw 75° 이상) — 맞춘 카메라로 두피(머리 나는 자리)를 사진에 되쏘면 머리 마스크 안에
 *       떨어져야 함(agreeMin). 앞쪽 사진은 이마 헤어라인이 사람마다 달라 이 검사가 안 맞으므로 얼굴 값들로만 봄
 *     · 센서 각도 = 얼굴 각도인가 — 얼굴이 잡힌 사진은 얼굴 실측 yaw와 yawTol 넘게 다르면 뺌. 얼굴이 보여야 할 각도(faceMustDeg 이내)인데
 *       얼굴을 못 찾아도 뺌
 *   세트 전체: 얼굴로 확인한 사진 중 어긋난 것이 2장 이상이고 절반 이상이면, 얼굴로 확인할 수 없는 옆·뒤 사진의 센서 각도도 못 믿으므로
 *     추가 사진을 전부 안 씁니다(4장으로 계산).
 *   기준 4장(좌·우·후면)도 360 세트에서 온 것이면 같은 눈으로 보되, 빼지는 않고 진단에 ⚠만 띄웁니다(gateBase=false).
 *     (2026-10-05c) 처음에는 프로브에서 뺐는데, 실측에서 더 나빠졌습니다: 후면 사진은 여전히 사진 가닥을 만드는데(13c 들어올리기)
 *     프로브에서 후면이 빠지니 그 가닥을 다듬어 줄 점유 판정이 없어져 뒷가닥이 20cm로 길어졌고(끝 1.72 · 가시 87%),
 *     "긴 머리"로 판정돼 짧은 머리가 어깨까지 내려왔습니다. 기준 사진은 들어올리기와 프로브가 같은 사진을 봐야 합니다.
 *     얼굴 각도를 못 잰 좌·우·후면은 가정값(±90°·180°) 대신 센서 각도를 씁니다(state.capturePose).
 *   ⚠ 문턱값은 합성 장면과 실패 세트 한 벌로 잡은 것입니다. 진단 [360 뷰]에 사진마다 값과 뺀 이유가 찍힙니다.
 *
 * (2026-10-05d) 촬영 안내 — 사용자: "흔들렸는지, 각도가 중간에 어긋났는지 내용을 알려 주고, 더 나은 품질을 원하시면 다시 찍어 주세요 정도."
 *   문제가 보인 사진이 있으면 화면 아래에 안내 카드를 한 번 띄웁니다.
 *   뜨는 시점(2026-10-05e · 사용자: "분석까지 기다렸는데 바로 다시 찍으라면 어이없다 — 결과물을 보면서 선택하게"):
 *     분석 직후가 아니라, 조정 화면에서 첫 머리가 다 그려진 뒤(분석 덮개가 내려가고 · 다시 기르기가 끝나고 · 1초쯤 그대로일 때).
 *     카드는 화면 아래쪽에만 떠서 위의 3D 머리는 그대로 보입니다.
 *   종류: 머리가 화면 밖으로 나감 · 흔들림(선명도가 세트 중앙값의 blurFrac 미만) · 각도가 어긋남(센서 각도 ≠ 얼굴 각도, 얼굴이 보여야 하는데 안 보임)
 *         · 거리가 달라짐(배율을 못 맞춤) · 폰 높이가 달라짐(올려다봄/내려다봄). 어느 방향 사진인지와 한 줄 요령을 같이 보여 줍니다.
 *   기준 4장(정면·양옆·뒤)에 문제가 있으면 "결과가 부정확할 수 있다"고 따로 알립니다(기준 사진은 빼지 않으므로).
 *   [다시 찍기] = 촬영 화면으로 · [그대로 진행] = 닫기. 흔들린 사진은 안내만 하고 계산에서는 빼지 않습니다.
 *   끄기: VIEWS360.advise=false · 다시 보기: VIEWS360.showAdvice(true)
 *
 * 아직 안 하는 것: 얼굴 옆 깊이에 추가 사진 쓰기 · 고개 숙임/기울임 보정 · 원근(가까운 쪽이 크게 찍히는 것).
 *
 * 끄기: VIEWS360.on=false 후 사진을 다시 분석. 걸러내기만 끄기: VIEWS360.gate=false. 특정 사진 빼기: VIEWS360.skip=['v90'].
 * ========================================================================== */
var VIEWS360 = (function () {
  'use strict';
  var W = window, TAG = '[360 뷰]';
  var X = Object.assign({
    on: true,
    shoulderK: 1.6,     // 어깨선 A = 사람 윤곽 폭이 그 위쪽 폭 중앙값의 이 배수를 넘는 첫 줄(13a 실루엣 앵커와 같은 규칙)
    neckK: 1.25, neckMax: 0.8,    // 목 밑동 B = 목(가장 좁은 줄 · 머리 최대 폭의 neckMax 미만) 아래로 폭이 목의 neckK배를 넘기 직전 줄
    capDepth: 0.12,     // 가로 중심을 재는 깊이(정수리→어깨선 높이 대비)
    ratioLo: 0.7, ratioHi: 1.4,   // 배율 비가 이 밖이면 못 믿음
    minCols: 0.08,      // 머리 윗선이 잡힌 열이 사진 폭의 이만큼은 돼야 씀
    skip: [],           // 빼고 싶은 뷰 키(예: ['v90'])
    // (2026-10-05b) 걸러내기
    gate: true,
    gateBase: false,    // 기준 좌·우·후면을 프로브에서 빼기 — 끔(들어올리기와 프로브가 어긋나 더 나빠짐 · 머리말 2026-10-05c). ⚠만 띄움
    edgeFrac: 0.02,     // 머리 윗선이 좌우 가장자리 이 안쪽(사진 폭 대비)에 닿으면 "화면 밖"
    interpMaxGap: 130,  // 배율 보간: 양쪽 이웃(직접 잰 뷰) 사이 각도가 이보다 넓으면 안 믿음
    qLo: 0.75, qHi: 2.3,   // 머리 윗선 반폭 ÷ 그 각도의 두상 반폭
    agreeMin: 0.75, agreeFromDeg: 75,   // 두피 되쏘기(옆·뒤 사진만 — yaw가 agreeFromDeg 이상): 이 비율 이상이어야
    yawTol: 18,         // 센서 각도 ↔ 얼굴 실측 yaw 허용 차(도)
    pitchTol: 15,       // 얼굴 실측 pitch가 정면과 이만큼 넘게 다르면 뺌(올려다보거나 내려다본 사진)
    faceMustDeg: 55,    // 이 각도 안쪽이면 얼굴이 잡혀야 함
    setBadMin: 2, setBadFrac: 0.34,  // 얼굴로 확인한 사진 중 어긋난 것이 이만큼이면 세트의 센서 각도를 안 믿음
    faceRatioLo: 0.77, faceRatioHi: 1.6,  // 얼굴 자(눈→턱)로 잰 배율 비의 허용 범위(정면보다 30% 넘게 가깝거나 60% 넘게 멀면 뺌 — 원근이 달라짐)
    rulerTol: 0.12,     // 어깨선·목 밑동 자가 얼굴 자와 이 안쪽으로 맞아야 그 자를 믿음(얼굴이 잡힌 사진들에서 확인)
    // (2026-10-05d) 촬영 안내
    advise: true,
    blurFrac: 0.5       // 선명도가 세트 중앙값의 이 비율 미만이면 "흔들림"
  }, W.VIEWS360 || {});
  X.views = {}; X.order = []; X.ref = null; X.busy = false; X.setFp = null; X.fp = null; X.forSet = null; X.note = ''; X.last = null; X.advisePending = false;

  var BASE = ['front', 'left', 'right', 'back'];
  function tail(u) { return typeof u === 'string' ? u.length + ':' + u.slice(-24) : ''; }
  function fpNow() { try { return BASE.map(function (a) { return tail(state.shots && state.shots[a]); }).join('|'); } catch (e) { return ''; } }
  function wrapDeg(d) { d = ((d + 180) % 360 + 360) % 360 - 180; return d === -180 ? 180 : d; }
  function keyOf(deg) { var d = Math.round(wrapDeg(deg)); return 'v' + (d < 0 ? 'm' + (-d) : d); }
  function nearest(frames, deg, maxOff) {
    var best = null, bd = 1e9;
    frames.forEach(function (f) { var d = Math.abs(wrapDeg(f.deg - deg)); if (d < bd) { bd = d; best = f; } });
    return best && bd <= maxOff ? best : null;
  }
  /* 45번 applySet과 같은 규칙으로 4장을 고름 */
  function picks(set) { return { front: nearest(set.frames, 0, 20), left: nearest(set.frames, 45, 25), right: nearest(set.frames, -45, 25), back: nearest(set.frames, 180, 35) }; }
  function isExtraKey(k) { return /^vm?\d+$/.test(k); }

  /* ────────────────────────────────────────────────────────────────────────
   * 사진 한 장에서 카메라 맞추기에 쓸 치수 재기
   * ────────────────────────────────────────────────────────────────────── */
  /* 사람 윤곽: 맨 윗줄 · 어깨선(마스크 줄 번호). 못 찾으면 -1
     어깨선 A = 윤곽 폭이 그 위쪽 폭 중앙값의 shoulderK배를 넘는 첫 줄(앞·뒤에서 잘 잡힘)
     목 밑동 B = 머리 가장 넓은 줄 아래에서 가장 좁은 줄(목)을 찾고, 그 아래로 폭이 목 폭의 neckK배를 넘기 직전 줄
                (옆모습은 어깨가 안 벌어져 A가 안 잡힘 — 목은 옆에서도 보임. 머리가 목을 덮으면 B가 안 잡힘) */
  function personStats(pm, mw, mh) {
    var out = { top: -1, shoulder: -1, neckBase: -1 };
    if (!pm || !(mw > 8) || !(mh > 8)) return out;
    var y, x, l, r, cnt, widths = [], rows = [], sorted, med;
    for (y = 0; y < mh; y++) {
      l = -1; r = -1; cnt = 0;
      for (x = 0; x < mw; x++) if (pm[y * mw + x]) { if (l < 0) l = x; r = x; cnt++; }
      if (out.top < 0) { if (cnt >= 3) out.top = y; else continue; }
      var wd = l < 0 ? 0 : r - l + 1;
      rows.push(wd);
      if (out.shoulder < 0 && wd > 0) {
        if (widths.length > 8) {
          sorted = widths.slice().sort(function (a, b) { return a - b; }); med = sorted[sorted.length >> 1];
          if (wd > med * X.shoulderK) out.shoulder = y;
        }
        if (out.shoulder < 0) widths.push(wd);
      }
    }
    var n = rows.length, i, wmax = 0, imax = 0, lim = Math.min(n, Math.round((out.shoulder >= 0 ? out.shoulder - out.top : n) * 0.6));   // 머리 구간만
    for (i = 0; i < lim; i++) if (rows[i] > wmax) { wmax = rows[i]; imax = i; }
    if (wmax > 8) {
      var wmin = wmax, imin = -1;
      for (i = imax + 1; i < n; i++) {
        if (rows[i] > 0 && rows[i] < wmin) { wmin = rows[i]; imin = i; }
        if (imin >= 0 && rows[i] > wmin * X.neckK) break;
      }
      if (imin >= 0 && wmin < wmax * X.neckMax && i < n) out.neckBase = out.top + i - 1;
    }
    return out;
  }
  /* 머리 윗선(scalpY)에서: 좌우 끝 · 맨 위 · 정수리 아래 얕은 깊이의 가로 중심 */
  function measure(mi) {
    if (!mi || !mi.scalpY || !(mi.w > 8) || !(mi.h > 8)) return null;
    var sY = mi.scalpY, w = mi.w, x, minX = Infinity, maxX = -Infinity, crown = Infinity, valid = 0;
    for (x = 0; x < w; x++) { var v = sY[x]; if (v >= 0) { valid++; if (x < minX) minX = x; if (x > maxX) maxX = x; if (v < crown) crown = v; } }
    if (!(maxX > minX) || !isFinite(crown)) return null;
    var mw = mi.maskW || w, mh = mi.maskH || mi.h, ky = mi.h / mh;
    var ps = personStats(mi.personMask, mw, mh);
    var top = ps.top >= 0 ? ps.top * ky : -1, sh = ps.shoulder >= 0 ? ps.shoulder * ky : -1, nb = ps.neckBase >= 0 ? ps.neckBase * ky : -1;
    var H = (top >= 0 && sh > top) ? sh - top : 0, HB = (top >= 0 && nb > top) ? nb - top : 0;
    var depth = X.capDepth * (H > 0 ? H : HB > 0 ? HB : (maxX - minX));
    var cl = Infinity, cr = -Infinity;
    for (x = 0; x < w; x++) if (sY[x] >= 0 && sY[x] <= crown + depth) { if (x < cl) cl = x; if (x > cr) cr = x; }
    return { w: w, h: mi.h, minX: minX, maxX: maxX, hw: (maxX - minX) / 2, crown: crown, valid: valid, top: top, shoulder: sh, H: H, neckBase: nb, HB: HB,
      capCx: cr >= cl ? (cl + cr) / 2 : (minX + maxX) / 2 };
  }
  X._measure = measure;
  /* 머리가 화면에 다 들어왔나. 문제 있으면 사유 문자열 */
  function frameProblem(m) {
    if (!m) return '머리 윗선을 못 잡음';
    if (m.hw < 4 || m.valid < m.w * X.minCols) return '머리 윗선이 거의 안 잡힘';
    var e = Math.max(1, X.edgeFrac * m.w);
    if (m.minX <= e || m.maxX >= m.w - 1 - e) return '머리가 화면 ' + (m.minX <= e ? '왼쪽' : '오른쪽') + ' 가장자리에 걸림';
    if (m.crown <= 1) return '머리 맨 위가 화면 밖';
    return '';
  }

  /* ────────────────────────────────────────────────────────────────────────
   * ① 나머지 사진 분석
   * ────────────────────────────────────────────────────────────────────── */
  function dropKey(k) {
    ['shots', 'hairCanvases', 'baseCanvases', 'baseFillCanvases', 'strandPaths', 'landmarks', 'captureLmStatus', 'capturePose', 'poseEars'].forEach(function (n) {
      try { if (state[n] && k in state[n]) delete state[n][k]; } catch (e) {}
    });
    try { if (typeof imgCache !== 'undefined' && imgCache[k]) delete imgCache[k]; } catch (e) {}
  }
  function clearViews() {
    try { Object.keys(state.hairMasks || {}).forEach(function (k) { if (isExtraKey(k)) delete state.hairMasks[k]; }); } catch (e) {}
    Object.keys(X.views).forEach(dropKey);
    X.views = {}; X.order = []; X.ref = null; X.fp = null; X.forSet = null;
  }
  X.clear = clearViews;
  /* 지금 4장이 360 세트에서 온 그대로인가 */
  function setLive() { try { return !!(state.shots360 && state.shots360.frames && X.setFp && X.setFp === fpNow()); } catch (e) { return false; } }
  function active() { return !!(X.on && setLive() && X.forSet === state.shots360 && X.fp === fpNow() && X.order.length); }
  X.active = active;

  X.extractOne = function (key) { return extractHairMaskCore(key); };   // 테스트에서 바꿔 끼울 수 있게 · 바깥 단계(54 등) 없이 추출만   // 테스트에서 바꿔 끼울 수 있게
  function faceOf(lm) {
    if (!lm || typeof lm.poseYawDeg !== 'number' || !isFinite(lm.poseYawDeg)) return null;
    var ecN = (typeof lm.chinY === 'number' && typeof lm.eyeY === 'number') ? lm.chinY - lm.eyeY : 0;
    return { yaw: lm.poseYawDeg, pitch: (typeof lm.posePitchDeg === 'number' && isFinite(lm.posePitchDeg)) ? lm.posePitchDeg : null, ecN: ecN > 0.01 ? ecN : 0 };
  }
  /* 얼굴 실측({yaw, pitch, ecN = 눈→턱 ÷ 사진 높이}). 얼굴 인식을 못 돌렸으면 undefined · 돌렸는데 못 찾았으면 null */
  X.canFace = function () { try { return !!(faceLandmarkerReady && faceLandmarker && typeof detectFaceLandmarks === 'function'); } catch (e) { return false; } };
  X.faceOne = function (key) {
    if (!X.canFace()) return Promise.resolve(undefined);
    return Promise.resolve(detectFaceLandmarks(key)).then(function (lm) { return faceOf(lm); }, function () { return undefined; });
  };

  function bodyRatio(ref, m) {            // 어깨선 → 목 밑동 순. {r, src, bad}
    var r = 0, src = '';
    if (ref && ref.H > 0 && m && m.H > 0) { r = ref.H / m.H; src = '어깨선'; }
    else if (ref && ref.HB > 0 && m && m.HB > 0) { r = ref.HB / m.HB; src = '목 밑동'; }
    if (!(r > 0)) return { r: null, src: '', bad: '' };
    if (r >= X.ratioLo && r <= X.ratioHi) return { r: r, src: src, bad: '' };
    return { r: null, src: src, bad: src + ' 비가 범위 밖(' + r.toFixed(2) + ')' };
  }
  /* 배율 비
       얼굴이 잡힌 뷰 = 얼굴 자(눈→턱 길이: 정면 ÷ 이 사진). 앱의 정면 세로 자와 같은 자라 가장 믿을 만함.
       얼굴이 없는 뷰 = 몸 자(어깨선 → 목 밑동). 단, 얼굴이 잡힌 사진들에서 몸 자가 얼굴 자와 rulerTol 안으로 맞을 때만 믿음
                       (실측: 팔을 든 셀카 세트에서 어깨선 자가 1.00이라 했지만 얼굴 자는 1.47이었음).
       못 잰 뷰 = 믿는 이웃 둘 사이 보간. */
  function fillRatios() {
    var ref = X.ref, rf = X.refFace, errs = [];
    X.order.forEach(function (k) {
      var v = X.views[k], b = bodyRatio(ref, v.m);
      v.rb = b.r; v.rbSrc = b.src; v.rbBad = b.bad;
      v.rfa = (rf && rf.ec > 0 && v.ec > 0) ? rf.ec / v.ec : null;
      if (v.rfa != null) { if (v.rb != null) errs.push(Math.abs(v.rb / v.rfa - 1)); else if (v.rbBad) errs.push(1); }
    });
    ['left', 'right'].forEach(function (a) {           // 기준 좌·우도 검증 표본으로
      try {
        var mi = state.hairMasks && state.hairMasks[a], fa = faceOf(state.landmarks && state.landmarks[a]);
        if (!mi || !fa || !(fa.ecN > 0) || !rf || !(rf.ec > 0)) return;
        var b = bodyRatio(ref, measure(mi)), r2 = rf.ec / (fa.ecN * mi.h);
        if (b.r != null) errs.push(Math.abs(b.r / r2 - 1)); else if (b.bad) errs.push(1);
      } catch (e) {}
    });
    errs.sort(function (x, y) { return x - y; });
    var med = errs.length ? errs[errs.length >> 1] : null;
    X.bodyRuler = { n: errs.length, med: med, ok: med == null || med <= X.rulerTol };
    var known = [{ deg: 0, r: 1 }];
    X.order.forEach(function (k) {
      var v = X.views[k]; v.ratio = null; v.ratioSrc = ''; v.ratioBad = '';
      if (v.rfa != null) {
        v.ratio = v.rfa; v.ratioSrc = '눈→턱(얼굴)';
        if (v.rfa >= X.faceRatioLo && v.rfa <= X.faceRatioHi) known.push({ deg: v.deg, r: v.rfa });
        else v.ratioBad = '얼굴 자 비가 범위 밖(' + v.rfa.toFixed(2) + ')';
      } else if (v.rb != null) {
        v.ratio = v.rb; v.ratioSrc = v.rbSrc;
        if (X.bodyRuler.ok) known.push({ deg: v.deg, r: v.rb });
        else v.ratioBad = '이 세트에서는 ' + v.rbSrc + ' 자가 얼굴 자와 안 맞음(얼굴이 잡힌 ' + X.bodyRuler.n + '장에서 중앙 오차 ' + Math.round(X.bodyRuler.med * 100) + '%)';
      } else if (v.rbBad) { v.ratioSrc = v.rbBad; v.ratioBad = v.rbBad; }
    });
    X.order.forEach(function (k) {
      var v = X.views[k]; if (v.ratio != null) return;
      var lo = null, hi = null, dl = 1e9, dh = 1e9;
      known.forEach(function (q) {
        var d = wrapDeg(q.deg - v.deg);
        if (d <= 0 && -d < dl) { dl = -d; lo = q; }
        if (d >= 0 && d < dh) { dh = d; hi = q; }
      });
      var pre = v.ratioSrc ? v.ratioSrc + ' → ' : '';
      if (!v.ratioBad && lo && hi && lo !== hi && dl + dh > 0 && dl + dh <= X.interpMaxGap) { v.ratio = (lo.r * dh + hi.r * dl) / (dl + dh); v.ratioSrc = pre + '이웃 보간'; }
      else {
        var g = lo && hi ? (dl <= dh ? lo : hi) : (lo || hi);
        v.ratio = g ? g.r : ((ref && ref.h > 0 && v.m && v.m.h > 0) ? ref.h / v.m.h : 1);
        v.ratioSrc = pre + (g ? '가까운 뷰 값' : '같은 거리 가정');
        if (!v.ratioBad) v.ratioBad = '배율을 직접 못 재고 보간할 이웃도 없음';
      }
    });
  }

  X.prepare = function () {
    if (X.busy) return X.busy;
    var set = state.shots360;
    if (!X.on || !set || !set.frames || !setLive()) return Promise.resolve(false);
    if (X.forSet === set && X.fp === fpNow()) return Promise.resolve(true);
    clearViews();
    var p = picks(set), used = [p.front, p.left, p.right, p.back], seen = {}, list = [];
    set.frames.forEach(function (f) {
      if (!f || !f.url || used.indexOf(f) >= 0) return;
      var k = keyOf(f.deg); if (seen[k] || X.skip.indexOf(k) >= 0) return;
      seen[k] = true; list.push({ key: k, deg: wrapDeg(f.deg), url: f.url });
    });
    list.sort(function (a, b) { return a.deg - b.deg; });
    X.degFront = p.front ? wrapDeg(p.front.deg) : 0;
    X.baseDeg = { front: X.degFront, left: p.left ? wrapDeg(p.left.deg) : 45, right: p.right ? wrapDeg(p.right.deg) : -45, back: p.back ? wrapDeg(p.back.deg) : 180 };
    try { X.ref = measure(state.hairMasks && state.hairMasks.front); } catch (e) { X.ref = null; }
    X.faceWasReady = X.canFace();            // 카드를 띄울 때는 분석 모델이 이미 내려가 있으므로 지금 값을 기억
    X.refFace = null;
    try { var ff = faceOf(state.landmarks && state.landmarks.front); if (ff && X.ref) X.refFace = { yaw: ff.yaw, pitch: ff.pitch, ec: ff.ecN * X.ref.h }; } catch (e) {}
    var cap = (typeof capShotDataURL === 'function') ? capShotDataURL : function (u) { return Promise.resolve(u); };
    var t0 = Date.now(), okN = 0, i = 0, fp0 = fpNow();
    function one() {
      if (i >= list.length) return Promise.resolve();
      var it = list[i++], faceYaw;
      try { if (typeof showAI === 'function') showAI('360° 사진 분석 중… ' + i + '/' + list.length, Math.round(it.deg) + '° 사진'); } catch (e) {}
      return cap(it.url).then(function (u) {
        state.shots[it.key] = u;
        return X.faceOne(it.key);
      }).then(function (fy) {
        faceYaw = fy;
        return X.extractOne(it.key);
      }).then(function (ok) {
        var mi = state.hairMasks && state.hairMasks[it.key], m = null;
        if (ok && mi) { try { m = measure(mi); } catch (e) { m = null; } }
        if (m) {
          // 가볍게: 형태 계산에 쓰는 것만 남김
          ['photoRGB', 'personMask', 'reasonCanvas', 'avgColorsBySection', 'colorPalette', 'faceBoxDiag'].forEach(function (n) { try { mi[n] = null; } catch (e) {} });
          mi._x360 = true;
          var fc = faceYaw && typeof faceYaw === 'object' ? faceYaw : null;
          X.views[it.key] = { key: it.key, deg: it.deg, m: m, cal: null, ratio: null, ratioSrc: '', ratioBad: '', why: '', kind: '',
            face: fc, faceYaw: fc ? fc.yaw : faceYaw, ec: fc && fc.ecN > 0 ? fc.ecN * m.h : 0 };
          X.order.push(it.key); okN++;
        } else {
          try { if (state.hairMasks) delete state.hairMasks[it.key]; } catch (e) {}
          console.warn(TAG + ' ' + it.key + '(' + Math.round(it.deg) + '°) 분석 실패 — 이 사진은 안 씁니다');
        }
        dropKey(it.key);
      }, function (e) {
        try { if (state.hairMasks) delete state.hairMasks[it.key]; } catch (x) {}
        dropKey(it.key);
        console.warn(TAG + ' ' + it.key + ' 분석 중 오류 — 안 씁니다', e);
      }).then(one);
    }
    X.busy = one().then(function () {
      X.busy = false;
      if (fpNow() !== fp0) { clearViews(); console.warn(TAG + ' 분석하는 사이 사진이 바뀌어 버립니다'); return false; }
      fillRatios();
      X.forSet = set; X.fp = fp0;
      X.note = '추가 ' + list.length + '장 중 ' + okN + '장 분석 · ' + (Date.now() - t0) + 'ms';
      console.log(TAG + ' ' + X.note + ' — ' + X.order.map(function (k) { var v = X.views[k]; return k + ' ×' + v.ratio.toFixed(3) + '(' + v.ratioSrc + ')'; }).join(' · '));
      try { var A = X.advice(); if (A && A.items.length) console.warn(TAG + ' 촬영 안내 — ' + A.items.map(function (it) { return Math.round(it.deg) + '°' + (it.base ? '(기준)' : '') + ' ' + it.kind + ': ' + it.why; }).join(' · ')); } catch (e) {}
      X.advisePending = true; watchAdvice();          // 카드는 첫 렌더가 끝난 뒤에(아래 watchAdvice)
      return okN > 0;
    }, function (e) { X.busy = false; console.warn(TAG + ' 준비 실패', e); return false; });
    return X.busy;
  };

  /* 4장 추출이 끝난 직후(모델이 올라와 있는 동안) 이어서 — extractHairMask(03b) 바깥 단계. run = 안쪽 추출 */
  X._extract = function (angle, run) {
    var p = run();
    if (angle !== 'back' || !p || typeof p.then !== 'function') return p;
    return p.then(function (r) {
      var go = false; try { go = X.on && setLive() && !(X.forSet === state.shots360 && X.fp === fpNow()); } catch (e) {}
      if (!go) { try { if (!setLive() && X.order.length) clearViews(); } catch (e) {} return r; }
      return Promise.resolve(X.prepare()).then(function () { return r; }, function () { return r; });
    });
  };
  /* 세트를 넣은 순간의 4장 지문 — 이후 4장이 바뀌면(다른 손님 사진) 추가 사진은 안 씀.
     얼굴 각도를 못 재는 좌·우·후면은 가정값(±90°·180°) 대신 센서 각도를 쓰게 촬영 포즈로 넣어 둠(01 getViewPoseSource의 'live' 단계).
     SHOT360.applySet(05) 맨 앞 _beforeApplySet · 결과로 _afterApplySet */
  X._beforeApplySet = function () { clearViews(); X.setFp = null; };
  X._afterApplySet = function (set, ok) {
    if (!ok) return ok;
    X.setFp = fpNow();
    try {
      var p = picks(set), d0 = p.front ? wrapDeg(p.front.deg) : 0;
      state.capturePose = state.capturePose || {};
      ['left', 'right', 'back'].forEach(function (a) {
        if (!p[a]) return;
        state.capturePose[a] = { yawDeg: wrapDeg(p[a].deg - d0), pitchDeg: 0, rollDeg: 0, _x360: true };
      });
    } catch (e) { console.warn(TAG + ' 센서 각도를 포즈로 넣기 실패', e); }
    return ok;
  };
  /* 3D를 만들기 직전에 한 번 더(추출 때 못 했으면) — buildNeutralHair3D(17b) 바깥 단계. build = 안쪽 */
  X._build = function (build) {
    var need = false;
    try { need = X.on && setLive() && !(X.forSet === state.shots360 && X.fp === fpNow()); } catch (e) {}
    if (!need) { try { if (!setLive() && X.order.length) clearViews(); } catch (e) {} return build(); }
    var hasModel = false; try { hasModel = !!segmenter; } catch (e) {}
    if (!hasModel) { X.note = '분석 모델이 내려가 있어 추가 사진을 분석하지 못함 — 4장으로만 계산'; console.warn(TAG + ' ' + X.note); return build(); }
    Promise.resolve(X.prepare()).then(function () { build(); }, function () { build(); });
  };

  /* ────────────────────────────────────────────────────────────────────────
   * ② 카메라 맞추기 + 걸러내기 → ③ 프로브에 넣기
   * ────────────────────────────────────────────────────────────────────── */
  /* 맞춘 카메라로 두피(머리 나는 자리 · 그 사진 쪽을 향한 면)를 사진에 되쏘았을 때 머리 마스크 안에 떨어지는 비율 */
  function scalpAgree(cal, mi, yTop, CY) {
    var Es = null; try { Es = getScalpEllipsoid(); } catch (e) {}
    if (!Es || !cal || !mi || !mi.reasonMask) return null;
    var R = composeRotationZYX(cal.pose.yaw, cal.pose.pitch || 0, cal.pose.roll || 0);
    var mw = mi.maskW || mi.w, mh = mi.maskH || mi.h, kx = mw / mi.w, ky = mh / mi.h, mk = mi.reasonMask;
    var a2 = Es.a * Es.a, b2 = Es.b * Es.b, c2 = Es.c * Es.c, NP = 16, NT = 40, r, c, n = 0, hit = 0;
    function hairAt(ix, iy) {
      var x = Math.round(ix * kx), y = Math.round(iy * ky), dx, dy, xx, yy;
      for (dy = -2; dy <= 2; dy += 2) for (dx = -2; dx <= 2; dx += 2) {
        xx = x + dx; yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < mw && yy < mh && mk[yy * mw + xx] === 1) return true;
      }
      return false;
    }
    for (r = 1; r < NP; r++) for (c = 0; c < NT; c++) {
      var ph = (r + 0.5) / NP * (Math.PI * 0.75), th = (c + 0.5) / NT * 2 * Math.PI - Math.PI, lim = Math.PI;
      try { lim = scalpPhiMax(th); } catch (e) {}
      if (ph > lim - 0.06) continue;                                     // 두피 경계 안쪽만
      var x = Es.a * Math.sin(ph) * Math.sin(th), y = Es.b * Math.cos(ph), z = Es.c * Math.sin(ph) * Math.cos(th);
      var nx = x / a2, ny = y / b2, nz = z / c2, nl = Math.hypot(nx, ny, nz) || 1;
      if ((R[6] * nx + R[7] * ny + R[8] * nz) / nl < 0.5) continue;       // 그 사진 쪽을 향한 면만
      var ix = (R[0] * x + R[1] * y + R[2] * z) / cal.s + cal.cx, iy = cal.crownY + (yTop - ((R[3] * x + R[4] * y + R[5] * z) + CY)) / cal.sy;
      n++;
      if (ix >= 0 && iy >= 0 && ix < mi.w && iy < mi.h && hairAt(ix, iy)) hit++;
    }
    return n >= 12 ? hit / n : null;
  }
  X._scalpAgree = scalpAgree;

  function headHalfWidthAt(yaw) {
    var E = null; try { E = getHeadEllipsoid(); } catch (e) {}
    if (!E) return 0;
    var cs = Math.cos(yaw), sn = Math.sin(yaw);
    return Math.sqrt(E.a * E.a * cs * cs + E.c * E.c * sn * sn);
  }
  /* 보정(정면 배율) 없이도 알 수 있는 문제. {kind, why} — kind: frame(화면 밖) · dist(거리/배율) · angle(각도) · height(폰 높이) */
  function precheck(v, frontYawDeg) {
    var m = v.m, fp = frameProblem(m);
    if (fp) return { kind: 'frame', why: fp };
    if (v.ratioBad) return { kind: 'dist', why: v.ratioBad };
    var yawS = wrapDeg(v.deg - (X.degFront || 0)) + (frontYawDeg || 0);
    if (typeof v.faceYaw === 'number' && Math.abs(wrapDeg(v.faceYaw - yawS)) > X.yawTol) return { kind: 'angle', why: '센서 각도와 얼굴 각도가 다름(센서 ' + yawS.toFixed(0) + '° · 얼굴 ' + v.faceYaw.toFixed(0) + '°)' };
    if (v.face && v.face.pitch != null && X.refFace && X.refFace.pitch != null && Math.abs(v.face.pitch - X.refFace.pitch) > X.pitchTol) return { kind: 'height', why: '올려다보거나 내려다본 사진(고개 각도 ' + v.face.pitch.toFixed(0) + '° · 정면 ' + X.refFace.pitch.toFixed(0) + '°)' };
    if (v.faceYaw === null && Math.abs(yawS) <= X.faceMustDeg) return { kind: 'angle', why: '얼굴이 보여야 할 각도(' + yawS.toFixed(0) + '°)인데 얼굴을 못 찾음' };
    return { kind: '', why: '' };
  }
  /* 추가 사진 한 장: 카메라 + 뺄 이유(없으면 '') */
  function calFor(v, viewCal, yTop, CY, ctx) {
    var f = viewCal && viewCal.front, m = v.m, out = { cal: null, why: '', kind: '' };
    v.q = null; v.agree = null; v.yawSensor = null;
    if (!f || !(f.sy > 0) || !f.pose) { out.why = '정면 보정 없음'; return out; }
    var basic = !m || m.hw < 4 || m.valid < m.w * X.minCols;
    if (basic) { out.why = frameProblem(m); out.kind = 'frame'; return out; }
    if (!(v.ratio > 0)) { out.why = '배율 없음'; out.kind = 'dist'; return out; }
    var sy = f.sy * v.ratio;
    if (!isFinite(sy) || !(sy > 0)) { out.why = '배율 계산 실패'; out.kind = 'dist'; return out; }
    var frontYaw = (f.pose.yaw || 0) * 180 / Math.PI, yawS = wrapDeg(v.deg - (X.degFront || 0)) + frontYaw;   // 센서 기준 yaw(도)
    v.yawSensor = yawS;
    var yawDeg = (typeof v.faceYaw === 'number') ? v.faceYaw : yawS;                          // 얼굴이 잡혔으면 얼굴 실측
    var cal = { pose: { yaw: yawDeg * Math.PI / 180, pitch: 0, roll: 0 }, cx: m.capCx, s: sy, sy: sy, crownY: m.crown, x360: true };
    out.cal = cal;
    var A = headHalfWidthAt(cal.pose.yaw); v.q = A > 0 ? m.hw * sy / A : null;
    try { v.agree = scalpAgree(cal, state.hairMasks[v.key], yTop, CY); } catch (e) { v.agree = null; }
    if (!X.gate) return out;
    var pre = precheck(v, frontYaw);
    if (pre.why) { out.why = pre.why; out.kind = pre.kind; }
    else if (v.q != null && (v.q < X.qLo || v.q > X.qHi)) { out.kind = 'dist'; out.why = '머리 크기가 안 맞음(두상 폭의 ' + v.q.toFixed(2) + '배 — ' + (v.q > X.qHi ? '너무 가깝게 찍혔거나 배율이 틀림' : '너무 멀거나 머리가 잘림') + ')'; }
    else if (Math.abs(wrapDeg(yawDeg)) >= X.agreeFromDeg && v.agree != null && v.agree < ctx.thr) { out.kind = 'angle'; out.why = '두피가 머리 영역 밖으로 나감(맞음 ' + Math.round(v.agree * 100) + '% < ' + Math.round(ctx.thr * 100) + '%)'; }
    return out;
  }
  /* 기준 좌·우·후면(360 세트에서 온 것): 프로브에서 뺄 이유 */
  function baseProblem(name, viewCal, yTop, CY, ctx) {
    var mi = state.hairMasks && state.hairMasks[name], cal = viewCal[name], info = { name: name, agree: null, why: '' };
    if (!mi || !cal) return info;
    var m = null; try { m = measure(mi); } catch (e) {}
    var fp = frameProblem(m); if (fp) { info.why = fp; return info; }
    var yawDeg = cal.pose.yaw * 180 / Math.PI, lm = null, canFace = false;
    try { lm = state.landmarks && state.landmarks[name]; canFace = X.canFace(); } catch (e) {}
    var hasFace = !!(lm && typeof lm.poseYawDeg === 'number');
    if (canFace && !hasFace && Math.abs(wrapDeg(yawDeg)) <= X.faceMustDeg && name !== 'back') { info.why = '얼굴이 보여야 할 각도(' + yawDeg.toFixed(0) + '°)인데 얼굴을 못 찾음'; return info; }
    if (hasFace || Math.abs(wrapDeg(yawDeg)) < X.agreeFromDeg) return info;   // 앞쪽 사진은 두피 되쏘기를 안 봄(이마 헤어라인이 사람마다 달라 안 맞음)
    try { info.agree = scalpAgree(cal, mi, yTop, CY); } catch (e) {}
    if (info.agree != null && info.agree < ctx.thr) info.why = '두피가 머리 영역 밖으로 나감(맞음 ' + Math.round(info.agree * 100) + '% < ' + Math.round(ctx.thr * 100) + '%)';
    return info;
  }

  /* makeHairOccupancyProbe(13b) 맨 앞 — 추가 사진을 넣거나 기준 사진을 뺀 [views, names]를 돌려줌(바꿀 것 없으면 null) */
  X._probeArgs = function (viewCal, names, yTop, CY) {
    X.last = { used: [], dropped: [], base: (names || []).slice(), baseDropped: [], baseWarn: [], baseInfo: {}, setBad: '', thr: null, agreeFront: null };
    try {
      if (active() && viewCal && viewCal.front) {
        var L = X.last, vc = Object.assign({}, viewCal), nm = names.slice();
        var ctx = { thr: X.agreeMin };
        L.thr = ctx.thr;
        // 추가 사진 평가
        var res = {};
        X.order.forEach(function (k) {
          var v = X.views[k]; v.cal = null; v.why = '';
          if (X.skip.indexOf(k) >= 0) { v.why = '사용자가 뺌(skip)'; return; }
          if (!(state.hairMasks && state.hairMasks[k])) { v.why = '마스크 없음'; return; }
          res[k] = calFor(v, viewCal, yTop, CY, ctx); v.why = res[k].why; v.kind = res[k].kind;
        });
        // 세트 전체: 얼굴로 확인한 사진 중 센서 각도가 어긋난 것
        var checked = 0, bad = 0;
        X.order.forEach(function (k) {
          var v = X.views[k]; if (v.yawSensor == null || v.faceYaw === undefined) return;
          if (typeof v.faceYaw === 'number') { checked++; if (Math.abs(wrapDeg(v.faceYaw - v.yawSensor)) > X.yawTol) bad++; }
          else if (Math.abs(v.yawSensor) <= X.faceMustDeg) { checked++; bad++; }
        });
        ['left', 'right'].forEach(function (a) {                                  // 기준 좌·우: 센서 각도 ↔ 얼굴 실측
          try {
            var lm = state.landmarks && state.landmarks[a], sd = X.baseDeg && X.baseDeg[a];
            if (sd == null || !viewCal[a]) return;
            var ys = wrapDeg(sd - (X.degFront || 0)) + (viewCal.front.pose.yaw || 0) * 180 / Math.PI;
            if (lm && typeof lm.poseYawDeg === 'number') { checked++; if (Math.abs(wrapDeg(lm.poseYawDeg - ys)) > X.yawTol) bad++; }
            else if (X.canFace() && Math.abs(ys) <= X.faceMustDeg) { checked++; bad++; }
          } catch (e) {}
        });
        if (X.gate && bad >= X.setBadMin && bad >= checked * X.setBadFrac) {
          L.setBad = '얼굴로 확인한 ' + checked + '장 중 ' + bad + '장의 센서 각도가 실제와 달라, 확인할 수 없는 옆·뒤 사진의 각도도 믿을 수 없음 — 추가 사진을 전부 안 씀';
          X.order.forEach(function (k) { var v = X.views[k]; if (!v.why) { v.why = '세트의 센서 각도를 못 믿음'; v.kind = 'angle'; } });
        }
        X.order.forEach(function (k) {
          var v = X.views[k], r = res[k];
          if (v.why || !r || !r.cal) { L.dropped.push(k); return; }
          v.cal = r.cal; vc[k] = r.cal; nm.push(k); L.used.push(k);
        });
        // 기준 좌·우·후면
        if (X.gate) ['left', 'right', 'back'].forEach(function (a) {
          var j = nm.indexOf(a); if (j < 0) return;
          var bi = baseProblem(a, viewCal, yTop, CY, ctx); L.baseInfo[a] = bi;
          if (bi.why && X.gateBase) { nm.splice(j, 1); L.baseDropped.push(a); }
          else if (bi.why) L.baseWarn.push(a);
        });
        console.log(TAG + ' 형태 계산: 기준 ' + nm.filter(function (n) { return BASE.indexOf(n) >= 0; }).join(',') + ' + 추가 ' + L.used.length + '장(' + (L.used.join(',') || '없음') + ')' +
          (L.dropped.length ? ' · 뺀 추가 사진 ' + L.dropped.map(function (k) { return k + '[' + X.views[k].why + ']'; }).join(' ') : '') +
          (L.baseDropped.length ? ' · 뺀 기준 사진 ' + L.baseDropped.map(function (a) { return a + '[' + L.baseInfo[a].why + ']'; }).join(' ') : '') +
          (L.baseWarn.length ? ' · ⚠ 의심스러운 기준 사진(그대로 씀) ' + L.baseWarn.map(function (a) { return a + '[' + L.baseInfo[a].why + ']'; }).join(' ') : '') +
          (L.setBad ? ' · ⚠ ' + L.setBad : ''));
        if (L.used.length || L.baseDropped.length) return [vc, nm];
      }
    } catch (e) { console.warn(TAG + ' 추가 사진 넣기 실패 — 4장으로만 계산', e); if (X.last) { X.last.used = []; X.last.baseDropped = []; } }
    return null;
  };

  /* ────────────────────────────────────────────────────────────────────────
   * 촬영 안내 — 어떤 사진에 무슨 문제가 있었나(분석 직후 · 보정 전에 알 수 있는 것)
   * ────────────────────────────────────────────────────────────────────── */
  var KINDS = ['frame', 'blur', 'angle', 'dist', 'height'];
  var TXT = {
    ko: {
      title: '촬영 안내',
      intro: function (n, t) { return t + '장 중 ' + n + '장에서 문제가 보였어요.'; },
      frame: ['머리가 화면 밖으로 나감', '머리 전체가 타원 안에 들어오게 해 주세요.'],
      blur: ['흔들림', '조금 더 천천히 돌아 주세요.'],
      angle: ['각도가 어긋남', '손님은 가만히 있고, 폰이 머리 둘레를 돌아야 해요.'],
      dist: ['거리가 달라짐', '처음과 같은 거리를 유지해 주세요(어깨까지 보이게).'],
      height: ['폰 높이가 달라짐', '폰을 처음과 같은 높이로 들어 주세요.'],
      base: function (l) { return '기준 사진(' + l + ')에 문제가 있어 결과가 부정확할 수 있어요.'; },
      extra: function (n) { return '문제가 있는 추가 사진 ' + n + '장은 빼고 계산합니다.'; },
      setBad: '돌면서 찍은 각도를 믿을 수 없어 추가 사진은 쓰지 않습니다.',
      redo: '더 나은 품질을 원하시면 다시 찍어 주세요.',
      again: '다시 찍기', go: '그대로 진행', more: function (n) { return ' 외 ' + n + '장'; },
      front: '정면', back: '뒤', left: function (d) { return '왼쪽 ' + d + '°'; }, right: function (d) { return '오른쪽 ' + d + '°'; }
    },
    en: {
      title: 'Capture check',
      intro: function (n, t) { return n + ' of ' + t + ' photos had a problem.'; },
      frame: ['Head went out of the frame', 'Keep the whole head inside the oval.'],
      blur: ['Motion blur', 'Walk around a little more slowly.'],
      angle: ['Angle drifted', 'The client stays still; the phone circles the head.'],
      dist: ['Distance changed', 'Keep the same distance as at the start (shoulders in view).'],
      height: ['Phone height changed', 'Hold the phone at the same height as at the start.'],
      base: function (l) { return 'The key photos (' + l + ') have a problem, so the result may be inaccurate.'; },
      extra: function (n) { return n + ' extra photo' + (n > 1 ? 's' : '') + ' with problems will be left out of the calculation.'; },
      setBad: 'The capture angles cannot be trusted, so the extra photos are not used.',
      redo: 'For better quality, please shoot again.',
      again: 'Shoot again', go: 'Continue', more: function (n) { return ' +' + n + ' more'; },
      front: 'front', back: 'back', left: function (d) { return 'left ' + d + '°'; }, right: function (d) { return 'right ' + d + '°'; }
    }
  };
  function lang() { try { return uiLang === 'ko' ? 'ko' : 'en'; } catch (e) { return 'ko'; } }
  function degLabel(deg, T) { var d = Math.round(wrapDeg(deg)); return d === 0 ? T.front : Math.abs(d) === 180 ? T.back : d > 0 ? T.left(d) : T.right(-d); }
  /* {total, items:[{deg, base, kind, why}], baseBad:[deg], extraBad:n} — 세트가 없거나 분석 전이면 null */
  X.advice = function () {
    var set = null; try { set = state.shots360; } catch (e) {}
    if (!set || !set.frames || !setLive() || X.forSet !== set) return null;
    var p = picks(set), items = [], seen = {}, frontYaw = X.refFace ? X.refFace.yaw : 0;
    function add(deg, base, kind, why) { var k = Math.round(wrapDeg(deg)) + ':' + kind; if (seen[k]) return; seen[k] = true; items.push({ deg: wrapDeg(deg), base: base, kind: kind, why: why }); }
    // 흔들림
    var sh = set.frames.map(function (f) { return f.sharp; }).filter(function (x) { return x > 0; }).sort(function (a, b) { return a - b; });
    var med = sh.length ? sh[sh.length >> 1] : 0;
    var baseFrames = [p.front, p.left, p.right, p.back];
    if (med > 0) set.frames.forEach(function (f) { if (f.sharp > 0 && f.sharp < med * X.blurFrac) add(f.deg, baseFrames.indexOf(f) >= 0, 'blur', '선명도 ' + f.sharp + ' (세트 중앙값 ' + med + ')'); });
    // 기준 4장
    BASE.forEach(function (a) {
      var f = p[a]; if (!f) return;
      var mi = state.hairMasks && state.hairMasks[a], m = null; try { m = measure(mi); } catch (e) {}
      var fp = mi ? frameProblem(m) : '';
      if (fp) { add(f.deg, true, 'frame', fp); return; }
      var lm = null; try { lm = state.landmarks && state.landmarks[a]; } catch (e) {}
      var hasFace = !!(lm && typeof lm.poseYawDeg === 'number'), ys = wrapDeg(f.deg - (X.degFront || 0)) + frontYaw;
      var couldFace = X.faceWasReady || X.canFace();
      if (a === 'front') { if (couldFace && !hasFace) add(f.deg, true, 'angle', '정면 사진에서 얼굴을 못 찾음'); return; }
      if (a === 'back') return;
      if (hasFace && Math.abs(wrapDeg(lm.poseYawDeg - ys)) > X.yawTol) add(f.deg, true, 'angle', '센서 각도와 얼굴 각도가 다름(센서 ' + ys.toFixed(0) + '° · 얼굴 ' + lm.poseYawDeg.toFixed(0) + '°)');
      else if (couldFace && !hasFace && Math.abs(ys) <= X.faceMustDeg) add(f.deg, true, 'angle', '얼굴이 보여야 할 각도(' + ys.toFixed(0) + '°)인데 얼굴을 못 찾음');
      else if (hasFace && typeof lm.posePitchDeg === 'number' && X.refFace && X.refFace.pitch != null && Math.abs(lm.posePitchDeg - X.refFace.pitch) > X.pitchTol) add(f.deg, true, 'height', '올려다보거나 내려다본 사진');
    });
    // 추가 사진
    var extraBad = 0;
    X.order.forEach(function (k) {
      var v = X.views[k], pre = v.why ? { kind: v.kind, why: v.why } : precheck(v, frontYaw);
      if (pre.why && pre.kind) { add(v.deg, false, pre.kind, pre.why); extraBad++; }
    });
    var baseBad = []; items.forEach(function (it) { if (it.base && it.kind !== 'blur' && baseBad.indexOf(it.deg) < 0) baseBad.push(it.deg); });
    var bad = {}; items.forEach(function (it) { bad[Math.round(it.deg)] = 1; });
    return { total: set.frames.length, bad: Object.keys(bad).length, items: items, baseBad: baseBad, extraBad: extraBad, setBad: !!(X.last && X.last.setBad) };
  };
  X.adviceText = function (lg) {
    var A = X.advice(); if (!A || !A.items.length) return null;
    var T = TXT[lg || lang()], lines = [];
    KINDS.forEach(function (kd) {
      var its = A.items.filter(function (it) { return it.kind === kd; }); if (!its.length) return;
      its.sort(function (a, b) { return (b.base ? 1 : 0) - (a.base ? 1 : 0) || Math.abs(a.deg) - Math.abs(b.deg); });
      var lab = its.slice(0, 4).map(function (it) { return degLabel(it.deg, T); }).join(', ') + (its.length > 4 ? T.more(its.length - 4) : '');
      lines.push({ head: T[kd][0], where: lab, tip: T[kd][1] });
    });
    var notes = [];
    if (A.baseBad.length) notes.push(T.base(A.baseBad.map(function (d) { return degLabel(d, T); }).join(', ')));
    if (A.setBad) notes.push(T.setBad); else if (A.extraBad) notes.push(T.extra(A.extraBad));
    return { title: T.title, intro: T.intro(A.bad, A.total), lines: lines, notes: notes, redo: T.redo, again: T.again, go: T.go };
  };
  /* 첫 머리가 다 그려졌나: 촬영·스타일 화면이 아니고 · 분석 덮개가 내려갔고 · 3D 만들기/다시 기르기가 끝났음 */
  function adviceReady() {
    try {
      if (typeof currentScreen === 'undefined' || currentScreen === 'capture' || currentScreen === 'style') return false;
      var ov = document.getElementById('aiOverlay'); if (ov && !ov.classList.contains('hidden')) return false;
      try { if (typeof NEUTRAL_BUILD !== 'undefined' && NEUTRAL_BUILD.running) return false; } catch (e) {}
      var photo = state._hair3Dneutral; if (!photo || !photo.strands || !photo.strands.length) return false;
      var RG = W.REGROW, mq = false; try { mq = !!MANNEQUIN.on; } catch (e) {}
      if (RG && RG.building) return false;
      if (RG && RG.on && !mq && RG.failedFor !== photo && !(RG.model && RG.src === photo)) return false;    // 다시 기르기가 아직 안 끝남
      return true;
    } catch (e) { return false; }
  }
  X._adviceReady = adviceReady;
  var advTimer = null, advOk = 0;
  function stopWatch() { if (advTimer) { clearInterval(advTimer); advTimer = null; } }
  function watchAdvice() {
    if (advTimer) return;
    advOk = 0;
    advTimer = setInterval(function () {
      if (!X.advisePending || !X.advise || !setLive()) { stopWatch(); return; }
      if (!adviceReady()) { advOk = 0; return; }
      if (++advOk < 2) return;                          // 두 번 연속(≈1초) 그대로일 때
      stopWatch(); X.advisePending = false;
      try { X.showAdvice(false); } catch (e) {}
    }, 500);
  }
  X.hideAdvice = function () { var el = document.getElementById('views360Advice'); if (el && el.parentNode) el.parentNode.removeChild(el); };
  /* 안내 카드. force=true면 이미 본 세트라도 다시 */
  X.showAdvice = function (force) {
    try {
      if (!X.advise && !force) return false;
      if (!force && X.advisedFp === X.fp) return false;
      var t = X.adviceText(); X.hideAdvice();
      if (!t) return false;
      X.advisedFp = X.fp;
      var esc = function (x) { return String(x).replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }); };
      var el = document.createElement('div'); el.id = 'views360Advice';
      el.style.cssText = 'position:fixed;left:50%;bottom:calc(84px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);width:min(440px,calc(100vw - 24px));max-height:62vh;overflow:auto;z-index:9000;' +
        'background:#221c16;color:#f2e8da;border:1px solid #c9874a;border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.55);padding:14px 16px 12px;font:14px/1.5 system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;';
      el.innerHTML = '<div style="font-weight:700;font-size:15px;color:#e6a468;margin-bottom:4px">' + esc(t.title) + '</div>' +
        '<div style="margin-bottom:8px">' + esc(t.intro) + '</div>' +
        t.lines.map(function (l) {
          return '<div style="margin:0 0 8px"><div><b>' + esc(l.head) + '</b> <span style="opacity:.75">— ' + esc(l.where) + '</span></div><div style="opacity:.85;font-size:13px">' + esc(l.tip) + '</div></div>';
        }).join('') +
        t.notes.map(function (n) { return '<div style="font-size:13px;opacity:.85;margin:0 0 4px">' + esc(n) + '</div>'; }).join('') +
        '<div style="margin:8px 0 10px;font-weight:600">' + esc(t.redo) + '</div>' +
        '<div style="display:flex;gap:8px"><button type="button" id="views360AdviceAgain" style="flex:1;padding:10px 8px;border-radius:10px;border:1px solid #c9874a;background:transparent;color:#e6a468;font:inherit;font-weight:600">' + esc(t.again) + '</button>' +
        '<button type="button" id="views360AdviceGo" style="flex:1;padding:10px 8px;border-radius:10px;border:0;background:#c9874a;color:#1a1410;font:inherit;font-weight:700">' + esc(t.go) + '</button></div>';
      document.body.appendChild(el);
      document.getElementById('views360AdviceGo').onclick = function () { X.hideAdvice(); };
      document.getElementById('views360AdviceAgain').onclick = function () {
        X.hideAdvice();
        try { if (typeof navTo === 'function') navTo('capture'); } catch (e) {}
        try { if (W.SHOT360 && typeof W.SHOT360.open === 'function') W.SHOT360.open(); } catch (e) {}
      };
      return true;
    } catch (e) { console.warn(TAG + ' 안내 카드 실패', e); return false; }
  };

  /* ────────────────────────────────────────────────────────────────────────
   * ④ 진단
   * ────────────────────────────────────────────────────────────────────── */
  X.lines = function () {
    var L = [], set = null; try { set = state.shots360; } catch (e) {}
    if (!X.on) return [TAG + ' 꺼짐'];
    if (!set || !set.frames) return [TAG + ' 켜짐 · 360 세트 없음(4장으로 계산)'];
    if (!setLive()) return [TAG + ' 켜짐 · 360 세트(' + set.frames.length + '장)가 있지만 지금 4장이 그 세트의 것이 아님 — 추가 사진 안 씀'];
    var la = X.last, used = la ? la.used : [];
    L.push(TAG + ' 켜짐 · 세트 ' + set.frames.length + '장 · ' + (X.note || '아직 분석 전') +
      ' · 형태 계산에 넣은 추가 사진 ' + used.length + '장' + (la && la.dropped.length ? ' · 뺀 추가 사진 ' + la.dropped.length + '장' : '') +
      (la && la.baseDropped.length ? ' · 뺀 기준 사진 ' + la.baseDropped.join(',') : '') +
      (la && la.baseWarn && la.baseWarn.length ? ' · ⚠ 의심스러운 기준 사진 ' + la.baseWarn.join(',') + '(그대로 씀 — 다시 찍는 것이 좋음)' : '') + (X.gate ? '' : ' · 걸러내기 꺼짐') +
      (la ? '' : ' (3D를 아직 안 만듦)'));
    if (la && la.setBad) L.push('  ⚠ ' + la.setBad);
    try { var ad = X.advice(); if (ad) L.push('  촬영 안내(화면 카드) — ' + (ad.items.length ? ad.items.map(function (it) { return Math.round(it.deg) + '°' + (it.base ? '(기준)' : '') + ' ' + it.kind; }).join(' · ') : '문제 없음') + (X.advise ? '' : ' · 카드 꺼짐')); } catch (e) {}
    if (X.bodyRuler) L.push('  배율 자 — 얼굴이 잡힌 사진은 눈→턱 · 없는 사진은 어깨선/목 밑동: ' + (X.bodyRuler.n ? '얼굴 자와 대조 ' + X.bodyRuler.n + '장 · 중앙 오차 ' + Math.round(X.bodyRuler.med * 100) + '% → ' + (X.bodyRuler.ok ? '믿음' : '⚠ 못 믿음(얼굴 없는 사진은 뺌)') : '대조할 얼굴 사진이 없어 그대로 씀'));
    if (!X.order.length) return L;
    L.push('  뷰: 센서각 → 쓴 yaw(얼굴 실측이 있으면 그 값) · 배율(정면 대비 · 출처) · 머리크기(두상 폭 대비) · 두피 맞음(옆·뒤 ' + X.agreeFromDeg + '° 이상만 봄 · 문턱 ' + Math.round(X.agreeMin * 100) + '%) → 넣음/뺌');
    X.order.forEach(function (k) {
      var v = X.views[k];
      L.push('   ' + k + ' ' + Math.round(v.deg) + '°' + (v.yawSensor != null ? ' → ' + (typeof v.faceYaw === 'number' ? '얼굴 ' + v.faceYaw.toFixed(0) + '°(센서 ' + v.yawSensor.toFixed(0) + '°)' : v.yawSensor.toFixed(0) + '°' + (v.faceYaw === null ? '(얼굴 못 찾음)' : '')) : '') +
        ' · ×' + (v.ratio != null ? v.ratio.toFixed(3) : '?') + ' ' + v.ratioSrc +
        (v.q != null ? ' · 크기 ' + v.q.toFixed(2) : '') + (v.agree != null ? ' · 맞음 ' + Math.round(v.agree * 100) + '%' : '') +
        ' · cx ' + Math.round(v.m.capCx) + '/' + v.m.w + ' · 위 ' + Math.round(v.m.crown) + 'px' +
        (v.cal ? ' → 넣음' : ' → 뺌: ' + (v.why || '아직 평가 전')));
    });
    if (la && la.baseInfo) {
      var bl = ['left', 'right', 'back'].filter(function (a) { return la.baseInfo[a]; }).map(function (a) {
        var bi = la.baseInfo[a], out = la.baseDropped.indexOf(a) >= 0;
        return a + (bi.agree != null ? ' 맞음 ' + Math.round(bi.agree * 100) + '%' : '') + (bi.why ? (out ? ' → 형태 계산에서 뺌: ' : ' → ⚠ 의심(그대로 씀): ') + bi.why : ' → 괜찮음');
      });
      if (bl.length) L.push('  기준 사진 — ' + bl.join(' · '));
    }
    return L;
  };
  console.log(TAG + ' 설치 — 360 세트의 나머지 사진을 형태 계산(점유·뿌리밀도·다시 기르기)에 넣습니다(의심스러운 사진은 뺌). 콘솔: VIEWS360.lines().join("\\n")');
  return X;
})();

/* 가닥을 점유 필드로 다듬기.
   뿌리에서 걸어가다 "머리카락 없음"이 연속 offRun번 나오면 거기서 자른다.
   뿌리부터 없으면 null을 돌려 <b>가닥을 통째로 버리게</b> 한다 — 거울 채움이
   민머리·가르마 자리에 가닥을 심는 것이 이 경로로 걸러진다. */
function trimStrandToOccupancy3D(pts, probe, acc, opts){
  if(REGROW._skipTrim(opts)) return pts;   // (옛 42) 뒤로 늘어뜨린 가닥(_rgKeep)은 다듬지 않음
  const O = HAIR_OCC3D;
  if(!probe || !pts || pts.length < 3) return pts;
  const growLen  = (opts && opts.growLen > 0) ? opts.growLen : 0;   // 마스크 밖 허용 호길이(바닥값)
  const frontOnlyGrow = !!(opts && opts.growFrontOnly);             // 그 바닥값을 앞쪽에만 줄지
  /* 그 바닥값(마네킹 앞머리 자리)의 <b>아래 한계</b>. 눈높이(=CY)다 — 앞머리가
     앉는 곳은 이마이고, 이마는 눈 위다(makeFaceProjector가 눈높이를 y=CY로 잡는다).
     z>0만으로 막으면 <b>뺨</b>까지 앞쪽이라, 측면 뷰에서 볼을 덮는 가닥이 이 여유를
     타고 살아남는다 — 실기기 측면에서 얼굴이 가려지던 몫의 하나다(2026-08-18 j). */
  const growAboveY = (opts && typeof opts.growAboveY === 'number') ? opts.growAboveY : -Infinity;
  const neverDrop = !!(opts && opts.neverDrop);
  /* 시술 변위 여유 — 조정 전(중립) 가닥을 같이 받으면 점마다
     |조정후 − 중립|을 여유로 쓴다(HAIR_OCC3D.moveGrow 주석 참조).
     점 개수가 달라질 수 있으므로(길이 연산자) <b>비율</b>로 대응시킨다. */
  const srcPts = (O.moveGrow && opts && opts.srcPts && opts.srcPts.length >= 2) ? opts.srcPts : null;
  /* ⚠ 같은 번호끼리 빼면 <b>커트가 여유를 만든다</b> (2026-08-18 j, 실기기에서 잡힘).
     길이를 줄이면 점 j는 뿌리 쪽으로 미끄러지므로 번호쌍 거리가 커진다 — 실기기
     로그의 "여유 받은 가닥 819개(평균 <b>1.009</b> 모델단위)"가 그것이다(≈17cm!).
     그런데 커트는 <b>빼는</b> 일이라 새 자리를 하나도 안 만든다. 그래서 거리를
     <b>중립 가닥 자체까지의 거리</b>로 잰다:
         여유(j) = min_k |조정후[j] − 중립[k]|
     · 커트 — 남은 점이 옛 곡선 <b>위에</b> 그대로 있다 → 0 (여유 없음, 옳다)
     · 길이 늘림 — 옛 끝 너머로 나간 만큼 (예전 growPerRatio와 같은 뜻)
     · 컬·볼륨·아웃컬 — 옛 곡선에서 <b>벗어난</b> 만큼 = 새로 차지한 공간
     점(마디)까지의 거리라 선분까지의 거리보다 최대 마디 절반만큼 크게 나온다 —
     여유를 조금 후하게 주는 쪽이라 안전한 방향이고, 계산이 절반이다. */
  const dispAt = srcPts
    ? (j)=>{
        const p = pts[j];
        let best = Infinity;
        for(let k=0;k<srcPts.length;k++){
          const q = srcPts[k];
          const dx = p.x-q.x, dy = p.y-q.y, dz = p.z-q.z;
          const d2 = dx*dx + dy*dy + dz*dz;
          if(d2 < best) best = d2;
        }
        return Math.sqrt(best);
      }
    : null;
  let off = 0, cut = -1;
  for(let i=Math.min(O.skipRoot, pts.length-1); i<pts.length; i++){
    const p = pts[i];
    const r = probe.at(p.x, p.y, p.z);
    if(acc) acc.n++;
    if(r.occ >= O.occThr){ off = 0; continue; }
    off++;
    if(off >= O.offRun){ cut = i - off + 1; break; }
  }
  if(cut < 0) return pts;
  /* 늘린 만큼의 여유 — 경계에서 바로 자르지 않고 growLen 호길이만큼 더 간다.
     2D에서 클립 마스크를 growPx만큼 부풀리는 것과 같은 뜻이다(밖으로 나가는
     가닥에 대해서는 "마스크를 키운다" = "경계 통과 후 그만큼 더 그린다"). */
  if(growLen > 0 || dispAt){
    const veto = !!(opts && opts.faceVeto) && HAIR_OCC3D.faceVeto && probe.faceAt;
    /* 여유의 크기 = 잘릴 구간에서 <b>시술이 가장 많이 움직인 거리</b>.
       왜 점별 변위를 그때그때 쓰지 않는가 — 경계 자체도 같이 밀려나기 때문이다.
       길이를 1.5배로 늘리면 점 j는 j×(1−1/1.5)만큼 움직이는데, 경계에서 재는
       "밖으로 나간 호길이"는 그보다 빨리 는다. 점별로 비교하면 늘린 머리를
       중간에서 잘라 버린다(하네스에서 예전 규칙 2.00 → 1.50으로 줄었다).
       최댓값을 예산으로 쓰면 순수 길이 시술에서 (비율−1)×호길이 = <b>예전
       growPerRatio와 정확히 같은 값</b>이 나오고, 컬·볼륨은 부푼 만큼이 나온다. */
    let dispMax = 0;
    if(dispAt) for(let j=Math.max(1,cut); j<pts.length; j++){ const d = dispAt(j); if(d > dispMax) dispMax = d; }
    let extra = 0, j = Math.max(1, cut), blocked = false, maxAllow = 0;
    while(j < pts.length){
      const p0 = pts[j-1], p1 = pts[j];
      /* 이 점에 허용된 여유 — <b>시술 변위</b>와 바닥값 중 큰 쪽.
         바닥값(마네킹 기하 오차 보정)은 fringeFrontOnly면 앞쪽 반구에만 준다. */
      const floor = (frontOnlyGrow && !(p1.z > 0 && p1.y >= growAboveY)) ? 0 : growLen;
      const allow = Math.max(floor, dispMax);
      if(allow > maxAllow) maxAllow = allow;
      if(!(extra < allow)) break;
      // 여유는 아래·바깥으로만 열려 있다. 얼굴을 가로지르려 하면 거기서 끝.
      if(veto && probe.faceAt(p1.x, p1.y, p1.z) >= O.faceThr){ blocked = true; break; }
      extra += Math.hypot(p1.x-p0.x, p1.y-p0.y, p1.z-p0.z);
      j++;
    }
    if(acc && maxAllow > 0){ acc.growN = (acc.growN||0) + 1; acc.growSum = (acc.growSum||0) + maxAllow; }
    cut = j;
    if(blocked){ if(acc) acc.faceBlocked = (acc.faceBlocked||0) + 1; }
    else if(cut >= pts.length) return pts;   // 여유 안에서 다 소진 — 자를 것이 없다
  }
  if(cut < O.minPts){
    // 뿌리부터 비었다. 리프트 때는 "실측상 없는 가닥"이라 버리지만, 조정 후
    // 재클립에서는 볼륨·가르마가 뿌리를 들어올린 것이므로 뿌리 토막은 남긴다.
    if(!neverDrop){ if(acc) acc.dropped++; return null; }
    cut = Math.min(pts.length, O.minPts);
    if(cut >= pts.length) return pts;
  }
  if(acc){ acc.trimmed++; acc.removedPts += (pts.length - cut); }
  return pts.slice(0, cut);
}

/* [진단·시각화] 점유를 셀 격자로 구워 둔다. 미니 3D에서 눈으로 보기 위한 것이고,
   다음 턴의 되쏘기 클립에서 빠른 사전판정 캐시로도 쓸 수 있다.
   셀 중심의 <b>헐 표면 점</b>을 프로브에 물어본다(결 필드와 같은 파라미터화:
   θ 균등 × 극각 균등). */
/* 두상 표면 격자 순회 (2026-08-02 통합) — buildOccupancyCellField와
   buildRootDensityField가 이 이중 루프를 그대로 복제하고 있었다(아래 주석에도
   "같은 격자·같은 순회"라고 적혀 있다). 셀 좌표 계산은 여기 한 곳에 두고,
   각자는 "그 자리에서 무엇을 재는가"만 넘긴다. 순회 순서·좌표식 모두 동일. */
function forEachHeadSurfaceCell(hullW, hullD, bucketOfY, CY, b, visit){
  const O = HAIR_OCC3D, NT = O.NT, NP = O.NP;
  for(let pi=0; pi<NP; pi++){
    const ny = Math.cos((pi + 0.5) / NP * Math.PI);
    const y  = CY + b * ny;
    const bi = bucketOfY(y);
    const Wb = hullW[bi], Db = hullD[bi];
    for(let ti=0; ti<NT; ti++){
      const th = (ti + 0.5) / NT * 2*Math.PI - Math.PI;
      visit(pi*NT + ti, Wb*Math.sin(th), y, Db*Math.cos(th));
    }
  }
}

function buildOccupancyCellField(probe, hullW, hullD, bucketOfY, CY, b){
  if(!probe) return null;
  const O = HAIR_OCC3D, NT = O.NT, NP = O.NP;
  const occ = new Float32Array(NT*NP), seen = new Float32Array(NT*NP);
  let filled = 0, hairCells = 0, grazing = 0;
  forEachHeadSurfaceCell(hullW, hullD, bucketOfY, CY, b, (ci, x, y, z)=>{
    const r = probe.at(x, y, z);
    occ[ci] = r.occ; seen[ci] = r.seen;
    // 보류(abstain)한 셀은 "봤다"로 안 센다 — occ=1로 통과시킨 것뿐이라 실측이 아니다
    if(r.seen > O.minSeen && !r.abstain){ filled++; if(r.occ >= O.occThr) hairCells++; }
    else if(r.abstain === 2) grazing++;
  });
  return { NT, NP, occ, seen, CY, b, filled, hairCells, grazing, ok: filled > 0 };
}

/* ── 두상 표면 뿌리 밀도 격자 (2026-08-01) ──────────────────────────
   buildOccupancyCellField와 <b>같은 격자·같은 순회</b>. 그쪽이 "여기 머리카락이
   있나(실루엣)"를 굽는다면 이쪽은 "여기 뿌리가 얼마나 촘촘한가"를 굽는다.
   결 필드까지 셋이 같은 파라미터화(θ 균등 × 극각 균등)라 서로 참조된다. */
/* 뿌리 밀도 격자 — (옛 51) 실측이 0이거나 실패하면 두피 전체에 균일 격자(아래 ROOTS_FALLBACK). 실측은 buildRootDensityFieldMeasured */
function buildRootDensityField(probe, hullW, hullD, bucketOfY, CY, b){
  return ROOTS_FALLBACK._densityField(probe, hullW, hullD, bucketOfY, CY, b);
}
function buildRootDensityFieldMeasured(probe, hullW, hullD, bucketOfY, CY, b){
  if(!probe || !probe.densityAt) return null;
  const O = HAIR_OCC3D, NT = O.NT, NP = O.NP;
  const den = new Float32Array(NT*NP), seen = new Float32Array(NT*NP);
  const est = new Uint8Array(NT*NP);
  let measured = 0, offScalp = 0;
  const grazing = [];                       // 스쳐만 본 셀 — 아래에서 보강한다
  forEachHeadSurfaceCell(hullW, hullD, bucketOfY, CY, b, (ci, x, y, z)=>{
    /* 두피 밖(턱 아래·뺨·얼굴)은 <b>묻지 않는다</b>. 거기 보이는 머리카락은
       뒤·옆에서 흘러내린 것이지 그 자리에서 난 것이 아니다. */
    const pi = (ci / NT) | 0, ti = ci % NT;
    const phi = (pi + 0.5) / NP * Math.PI;
    const th  = (ti + 0.5) / NT * 2*Math.PI - Math.PI;
    if(phi > scalpPhiMax(th)){
      den[ci] = 0; seen[ci] = 0; est[ci] = EST_OFFSCALP; offScalp++;
      return;
    }
    const r = probe.densityAt(x, y, z);
    den[ci] = r.density; seen[ci] = r.seen;
    if(r.density >= 0){
      /* ── 정수리 보강 (2026-08-09) ─────────────────────────────────────
         사용자: "정수리가 각 이미지가 만나는 점이라서 약한 건 알겠는데, 후면쪽이
         전반적으로 특히 약해. 가상으로 정수리 면을 만들어서 헤어 심는 방법은?"

         면은 이미 있다 — [두상·정수리캡]이 두개골+모발두께로 정수리 밴드를
         채워 둔다. 없는 건 <b>밀도</b>다. 수평 카메라 넷의 축이 정수리에서는
         전부 접선 방향이라 어느 뷰도 제대로 못 본다. 그 자리에서 각 카메라는
         마스크 <b>맨 윗줄</b>을 찍는데 1~2px만 어긋나도 값이 뚝 떨어진다.
         그래서 "정수리 숱이 없다"가 <b>측정 결과처럼</b> 나온다. 실제로는
         대머리가 아닌 두피에서 모낭 밀도는 정수리라고 낮지 않다.

         이 파일은 같은 상황에 이미 답을 정해 뒀다 — at()의 confidentFacing:
         <b>제일 잘 본 뷰</b>가 기준을 넘어야 그 판정을 믿는다. 밀도도 같은 자를
         쓴다. 스쳐만 본 셀은 값을 버리고, <b>제대로 본 셀들의 중앙값</b>을 넣는다.
         지어낸 상수가 아니라 이 사람 두피에서 실제로 잰 값이다. */
      if(HAIR_OCC3D.confidentFacing > 0 && (r.wBest || 0) < HAIR_OCC3D.confidentFacing){
        grazing.push(ci);
      } else measured++;
    }
  });
  /* 제대로 본 셀의 중앙값 — 스쳐만 본 셀에 넣을 값 */
  let crownFill = -1;
  if(grazing.length){
    const solid = [];
    for(let ci=0; ci<NT*NP; ci++)
      if(est[ci] !== EST_OFFSCALP && den[ci] >= 0 && grazing.indexOf(ci) < 0) solid.push(den[ci]);
    if(solid.length){
      solid.sort((p,q)=>p-q);
      crownFill = solid[(solid.length*0.5)|0];
      for(const ci of grazing){ den[ci] = crownFill; est[ci] = EST_CROWNFILL; }
    }
  }
  const field = { NT, NP, den, seen, est, CY, b, measured, offScalp,
                  grazing: grazing.length, crownFill, cells: NT*NP, ok: measured > 0 };
  if(field.ok) fillUnseenRootCells(field);
  console.log('[뿌리밀도] 셀 ' + (NT*NP) + '개 — 두피 밖 ' + offScalp
    + '개(뿌리 안 심음) · 실측 ' + measured + '개'
    + (grazing.length ? ' · <b>정수리 보강 ' + grazing.length + '개</b>(스쳐만 봐서 밀도 '
        + (crownFill >= 0 ? crownFill.toFixed(3) : '?') + '로 채움 = 제대로 본 셀의 중앙값)' : '')
    + ' · 나머지는 이웃/평균 추정'
    + '\n    두피 경계(phi 상한): 정면 ' + scalpPhiMax(0).toFixed(2)
    + ' · 관자 ' + scalpPhiMax(0.75).toFixed(2)
    + ' · 귀옆 ' + scalpPhiMax(1.35).toFixed(2)
    + ' · 후면 ' + scalpPhiMax(Math.PI).toFixed(2)
    + ' (SCALP_ZONES.phiRange 상한에서 나옴 — 이 아래는 사진에 머리가 보여도 두피가 아닙니다)');
  return field;
}

/* ==========================================================================
 * ROOTS_FALLBACK (옛 51-roots-fallback.js) — 뿌리밀도 격자가 비어서 마네킹·다시 기르기가 둘 다 멈추는 것 막기
 *
 * 자리: 13b, buildRootDensityField 바로 뒤. extractHairMask(03b)가 모발 프로필을 잴 때 ROOTS_FALLBACK._fixSkin(angle, 입력) · buildRootDensityField = 실측(buildRootDensityFieldMeasured) → 실패면 균일 격자 · buildMannequinHair3D(17a)·REGROW.build(17b) 맨 앞 ensureRoots · perfPanelLines(18) 끝 줄
 *
 * 왜 (2026-10-04 · 앞머리가 눈까지 덮인 곱슬머리 사진):
 *   마네킹 ON을 눌러도 마네킹이 안 되고, OFF로 해도 원본 머리를 다시 기르지 못했습니다.
 *   진단: [다시 기르기] 켜짐 · 모델 없음 · ⚠ 뿌리밀도/격자 없음   (콘솔: [마네킹] 격자/뿌리밀도가 없어 못 심음)
 *   경로:
 *     ① 03b extractHairMask가 "살색"을 이마~눈썹 사이 패치의 평균색으로 잽니다(머리 픽셀을 안 뺌).
 *     ② 앞머리가 이마를 덮으면 그 패치가 머리라서 살색 ≈ 머리색.
 *     ③ 03a measureViewHairIdentity는 살색↔머리색 거리가 minSkinHairDist(40) 미만이면 그 뷰의 밀도를 안 잽니다.
 *     ④ 정면·좌·우가 모두 같은 이유로 빠지고, 후면은 빌려 올 기준 살색(_refSkinCss)이 한 번도 안 잡혀 역시 빠집니다.
 *     ⑤ 13b buildRootDensityField의 실측 셀이 0 → ok:false → 17a 마네킹과 42 다시 기르기가 둘 다 포기하고
 *        사진 가닥을 그대로 보여 줍니다(그래서 ON이든 OFF든 화면이 같음).
 *
 * 무엇을:
 *   ① 살색 다시 재기 — 살색이 머리색과 너무 가까우면(또는 없으면) 그 뷰의 얼굴 랜드마크로 코·볼 자리에서
 *      머리·눈·입 픽셀을 빼고 살색을 다시 잽니다. 잰 값이 머리색과 충분히 다르면 그것으로 밀도를 재고,
 *      기준 살색(_refSkinCss)으로도 넣어 얼굴 없는 뷰(후면)가 빌려 쓰게 합니다.
 *   ② 밀도 격자 대체 — 그래도 실측 셀이 0이면(또는 격자 만들기가 실패하면) 두피 경계(SCALP_LIMIT) 안쪽 전체에
 *      균일한 추정 밀도를 넣은 격자를 돌려줍니다. 전부 "추정"(est=2)으로 표시하므로 겹침 정리(pruneOverlappedRoots)는
 *      예전처럼 건너뜁니다. 숱이 적은 자리는 구분하지 못합니다(전부 같은 밀도).
 *   ③ 고쳐 넣기 — 이미 만들어진 사진 모델에 격자가 없으면 마네킹·다시 기르기 직전에 ②와 같은 격자를 넣습니다.
 *   ④ 진단 줄 [뿌리 대체] — 어느 경로로 처리됐는지.
 *
 * 끄기: ROOTS_FALLBACK.on=false (살색만: skinFix=false · 격자 대체만: fill=false · 고쳐 넣기만: heal=false) 후 사진을 다시 분석.
 * ========================================================================== */
var ROOTS_FALLBACK = (function () {
  'use strict';
  var W = window, TAG = '[뿌리 대체]';
  var F = Object.assign({
    on: true,
    skinFix: true,      // ① 살색 다시 재기
    fill: true,         // ② 실측 0이면 균일 격자
    heal: true,         // ③ 이미 만들어진 모델에 격자 넣기
    den: 1,             // 대체 격자의 밀도(가닥 수는 STRAND_BUDGET이 정하므로 상대값일 뿐)
    halfW: 0.22,        // 코·볼 표본 반폭(귀 사이 폭 대비)
    minSamples: 30,
    loPct: 0.3, hiPct: 0.85   // 밝기 순으로 이 구간만 평균(콧구멍 그늘·번들거림 제외)
  }, W.ROOTS_FALLBACK || {});
  F.cur = null;                                  // 지금 분석 중인 뷰
  var ST = F.stats = { skin: {}, grid: null, heals: 0 };

  function rgbOf(css) { try { return parseRGBTriple(css); } catch (e) { return null; } }
  function dist(a, b) { return Math.sqrt((a.r - b.r) * (a.r - b.r) + (a.g - b.g) * (a.g - b.g) + (a.b - b.b) * (a.b - b.b)); }
  function minDist() { try { return HAIR_IDENTITY.minSkinHairDist || 40; } catch (e) { return 40; } }

  /* ────────────────────────────────────────────────────────────────────────
   * ① 살색 다시 재기
   * ────────────────────────────────────────────────────────────────────── */
  /* 코·볼 자리(눈 아래 ~ 입 위, 코끝 좌우)의 살색. 못 재면 null */
  function faceSkin(angle, a) {
    var lm = null; try { lm = state.landmarks && state.landmarks[angle]; } catch (e) {}
    if (!lm || lm.lEarX == null || lm.rEarX == null || lm.chinY == null || lm.eyeY == null) return null;
    var w = a.w, h = a.h, px = a.srcPixels, mask = a.maskBuf, person = a.personMask, reason = a.reasonMask;
    if (!px || !(w > 4) || !(h > 4)) return null;
    var earL = Math.min(lm.lEarX, lm.rEarX), earR = Math.max(lm.lEarX, lm.rEarX), span = earR - earL;
    if (!(span > 0.02)) return null;
    var f = lm.features || {}, raw = lm.rawLandmarks;
    var cx = (raw && raw[1] && isFinite(raw[1].x)) ? raw[1].x : (earL + earR) / 2;               // 코끝
    var eyeBot = (f.leftEye && f.rightEye) ? Math.max(f.leftEye.maxY, f.rightEye.maxY) : lm.eyeY;
    var mouthTop = f.mouth ? f.mouth.minY : lm.eyeY + 0.6 * (lm.chinY - lm.eyeY);
    var y0 = eyeBot + 0.15 * (mouthTop - eyeBot), y1 = mouthTop - 0.05 * (mouthTop - eyeBot);
    if (!(y1 > y0)) return null;
    var xs = Math.max(0, Math.round((cx - span * F.halfW) * w)), xe = Math.min(w, Math.round((cx + span * F.halfW) * w));
    var ys = Math.max(0, Math.round(y0 * h)), ye = Math.min(h, Math.round(y1 * h));
    var L = [], R = [], G = [], B = [], x, y, i, r, g, b;
    for (y = ys; y < ye; y++) for (x = xs; x < xe; x++) {
      i = y * w + x;
      if (mask && mask[i] > 0) continue;                                 // 머리
      if (reason && (reason[i] === 2 || reason[i] === 3)) continue;      // 얼굴 상자에서 걷어 낸 머리 · 눈/눈썹/입
      if (person && person[i] !== 1) continue;                           // 배경
      r = px[i * 4]; g = px[i * 4 + 1]; b = px[i * 4 + 2];
      L.push(0.299 * r + 0.587 * g + 0.114 * b); R.push(r); G.push(g); B.push(b);
    }
    if (L.length < F.minSamples) return null;
    var idx = L.map(function (_, k) { return k; }).sort(function (p, q2) { return L[p] - L[q2]; });
    var lo = Math.floor(idx.length * F.loPct), hi = Math.max(lo + 1, Math.floor(idx.length * F.hiPct)), sr = 0, sg = 0, sb = 0, n = 0, k;
    for (k = lo; k < hi; k++) { sr += R[idx[k]]; sg += G[idx[k]]; sb += B[idx[k]]; n++; }
    if (!n) return null;
    return { css: 'rgb(' + Math.round(sr / n) + ',' + Math.round(sg / n) + ',' + Math.round(sb / n) + ')', n: L.length };
  }

  /* extractHairMask(03b)가 measureViewHairIdentity에 넘길 입력을 여기 거쳐 넘김 — 살색이 머리색과 너무 가까우면 바꾼 사본 */
  F._fixSkin = function (angle, a) {
    try { delete ST.skin[angle]; } catch (e) {}
    var args = [a];
    try {
      if (F.on && F.skinFix && a && angle && HAIR_IDENTITY.on) {
        var hair = rgbOf(a.hairColorCss), skin = rgbOf(a.densitySkinCss || a.scalpColorCss), md = minDist();
        var d0 = hair && skin ? dist(skin, hair) : null;
        var bad = hair && (!skin || (HAIR_IDENTITY.borrowSkin && d0 < md));
        if (bad) {
          var rec = { was: a.densitySkinCss || a.scalpColorCss || null, d0: d0, how: '못 고침', css: null, d1: null };
          var fs = faceSkin(angle, a), c = fs && rgbOf(fs.css), ref = null;
          if (c && dist(c, hair) >= md) {
            rec.how = '코·볼에서 다시 잼(' + fs.n + 'px)'; rec.css = fs.css; rec.d1 = dist(c, hair);
            try { if (!HAIR_IDENTITY._refSkinCss || angle === 'front') HAIR_IDENTITY._refSkinCss = fs.css; } catch (e) {}
          } else {
            try { ref = HAIR_IDENTITY._refSkinCss; } catch (e) {}
            c = ref && rgbOf(ref);
            if (c && dist(c, hair) >= md && ref !== a.densitySkinCss) { rec.how = '다른 뷰 살색 빌림'; rec.css = ref; rec.d1 = dist(c, hair); }
          }
          ST.skin[angle] = rec;
          if (rec.css) {
            args = [Object.assign({}, a, { densitySkinCss: rec.css })];
            console.log(TAG + ' ' + angle + ' · 살색이 머리색과 너무 가까움(' + (rec.was || '없음') + ' · 거리 ' + (d0 != null ? d0.toFixed(0) : '?') +
              ' < ' + md + ' — 이마가 머리에 덮였을 가능성) → ' + rec.how + ' ' + rec.css + ' · 거리 ' + rec.d1.toFixed(0) + ' → 밀도를 잽니다');
          } else {
            console.warn(TAG + ' ' + angle + ' · 살색이 머리색과 너무 가깝고(' + (rec.was || '없음') + ') 다시 잴 자리도 없음 — 이 뷰는 밀도를 못 잽니다(실측이 하나도 없으면 균일 격자로 대체)');
          }
        }
      }
    } catch (e) { console.warn(TAG + ' 살색 다시 재기 실패(무시)', e); args = [a]; }
    return args[0];
  };

  /* ────────────────────────────────────────────────────────────────────────
   * ② 밀도 격자 대체
   * ────────────────────────────────────────────────────────────────────── */
  /* 두피 경계 안쪽 전체에 균일 밀도(전부 추정 표시). 13b buildRootDensityField와 같은 모양 */
  function synthRoots(CY, b, why) {
    var NT = HAIR_OCC3D.NT, NP = HAIR_OCC3D.NP, n = NT * NP;
    var OFF = (typeof EST_OFFSCALP !== 'undefined') ? EST_OFFSCALP : 3;
    var den = new Float32Array(n), seen = new Float32Array(n), est = new Uint8Array(n), off = 0, on = 0, r, c, i, ph, th;
    for (r = 0; r < NP; r++) for (c = 0; c < NT; c++) {
      i = r * NT + c; ph = (r + 0.5) / NP * Math.PI; th = (c + 0.5) / NT * 2 * Math.PI - Math.PI;
      if (ph > scalpPhiMax(th)) { est[i] = OFF; off++; } else { den[i] = F.den; est[i] = 2; on++; }
    }
    if (!on) return null;
    return { NT: NT, NP: NP, den: den, seen: seen, est: est, CY: CY, b: b, measured: 0, offScalp: off, grazing: 0, crownFill: -1,
      cells: n, ok: true, fallback: true, why: why };
  }

  /* buildRootDensityField(13b) — 실측(buildRootDensityFieldMeasured)이 0이거나 실패하면 균일 격자 */
  F._densityField = function (probe, hullW, hullD, bucketOfY, CY, b) {
    var r = null, err = null;
    try { r = buildRootDensityFieldMeasured(probe, hullW, hullD, bucketOfY, CY, b); } catch (e) { err = e; }
    if (r && r.ok) { ST.grid = { mode: '실측', measured: r.measured, cells: r.cells }; return r; }
    if (!F.on || !F.fill) { if (err) throw err; return r; }
    var why = err ? '격자 만들기 실패(' + String(err && err.message || err) + ')' : (!r ? '밀도 표본 없음' : '실측 셀 0');
    var s = null;
    try { s = synthRoots(CY, b, why); } catch (e) { console.warn(TAG + ' 균일 격자 만들기 실패', e); }
    if (!s) { if (err) throw err; return r; }
    ST.grid = { mode: '대체', why: why, cells: s.cells, planted: s.cells - s.offScalp };
    console.warn(TAG + ' 뿌리밀도를 사진에서 못 잼(' + why + ') → 두피 전체에 균일 밀도를 넣었습니다(심을 셀 ' + (s.cells - s.offScalp) + '/' + s.cells +
      ') — 마네킹·다시 기르기는 됩니다. 숱이 적은 자리는 구분하지 못합니다. 되돌리기 ROOTS_FALLBACK.fill=false');
    return s;
  };

  /* ────────────────────────────────────────────────────────────────────────
   * ③ 이미 만들어진 사진 모델에 격자가 없으면 넣기
   * ────────────────────────────────────────────────────────────────────── */
  function ensureRoots(model) {
    try {
      if (!model || !model.strands || !model.strands.length || model.mannequin) return false;
      if (model.roots && model.roots.ok) return true;
      if (!F.on || !F.heal || !model.grid) return false;
      var CY = isFinite(model.CY) ? model.CY : 0.15;
      var b = (model.roots && model.roots.b > 0) ? model.roots.b : (isFinite(model.yTop) && model.yTop - CY > 0 ? model.yTop - CY : 0);
      if (!(b > 0)) { try { b = getScalpEllipsoid().b; } catch (e) {} }
      if (!(b > 0)) return false;
      var s = synthRoots(CY, b, '모델에 격자가 없어 넣음');
      if (!s) return false;
      model.roots = s; ST.heals++;
      ST.grid = { mode: '대체', why: s.why, cells: s.cells, planted: s.cells - s.offScalp };
      console.warn(TAG + ' 사진 모델에 뿌리밀도 격자가 없어 균일 격자를 넣었습니다(심을 셀 ' + (s.cells - s.offScalp) + '/' + s.cells + ')');
      return true;
    } catch (e) { console.warn(TAG + ' 격자 넣기 실패', e); return false; }
  }
  F.ensureRoots = ensureRoots;

  F._beforeRegrowBuild = function (RG) {   // REGROW.build(17b) 맨 앞
    try {
      var photo = state._hair3Dneutral, had = !!(photo && photo.roots && photo.roots.ok);
      if (ensureRoots(photo) && !had && RG.failedFor === photo) RG.failedFor = null;      // 격자가 없어 포기했던 사진 — 다시 시도
    } catch (e) {}
  };

  /* ────────────────────────────────────────────────────────────────────────
   * ④ 진단
   * ────────────────────────────────────────────────────────────────────── */
  F.lines = function () {
    var L = [TAG + ' ' + (F.on ? '켜짐' : '꺼짐')], g = ST.grid, ks = Object.keys(ST.skin);
    if (!g) L[0] += ' · 밀도 격자: 아직 안 만듦';
    else if (g.mode === '실측') L[0] += ' · 밀도 격자: 사진에서 잼(실측 ' + g.measured + '/' + g.cells + '셀)';
    else L[0] += ' · 밀도 격자: ⚠ 균일 추정으로 대체(' + g.why + ' · 심을 셀 ' + g.planted + '/' + g.cells + ')' + (ST.heals ? ' · 모델에 넣음 ' + ST.heals + '회' : '');
    if (ks.length) L.push('  살색 — ' + ks.map(function (k) {
      var s = ST.skin[k];
      return k + ': ' + (s.was || '없음') + '(머리색과 거리 ' + (s.d0 != null ? s.d0.toFixed(0) : '?') + ') → ' + s.how + (s.css ? ' ' + s.css + '(거리 ' + s.d1.toFixed(0) + ')' : '');
    }).join(' · '));
    else L[0] += ' · 살색: 고칠 것 없음';
    return L;
  };
  console.log(TAG + ' 설치 — 살색이 머리색과 겹치면 코·볼에서 다시 재고, 뿌리밀도 실측이 0이면 균일 격자로 대체. 콘솔: ROOTS_FALLBACK.lines().join("\\n")');
  return F;
})();
console.log('[64] 얼굴·목 막음 꺼짐 (v20261010e · 되돌리기 HAIR_OCC3D.faceVeto=true, REGROW.neck=true)');
