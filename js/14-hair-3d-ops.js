/* ══════════════════════════════════════════════════════════
   14-hair-3d-ops.js — 최종 3D 헤어 · 컬/중력/가르마/넘김/볼륨 · 뷰 컬링
   원본 index.html 22598~24198행. 클래식 스크립트이므로 로드 순서가 곧
   실행 순서다 — index.html의 <script src> 순서를 바꾸지 말 것.
   ══════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════════
   최종 3D 화면의 헤어 — 조정 결과를 반영 (2026-07-27)
   ─────────────────────────────────────────────────────────────────
   사용자: "스타일링까지 하고 나서 헤어가 들리는 건 (조정 화면에선) 입체로
   표현이 되는데, 3D로 갔을 때는 변화가 없어."
   맞다. 두 화면이 <b>다른 소스</b>를 보고 있었다:
     · 조정 화면 = 중립 3D 모델 + 조정 연산자(computeAdjustedHair3DStrands)
     · 3D 화면   = 2D 가닥을 <b>다시 캡처해서 다시 리프트</b>(buildHairStrandsFromPaths)
   그런데 조정은 이제 전부 3D 연산자에 있다(길이·컬·중력·가르마·넘김·볼륨·결흐름).
   2D 캡처 경로에서는 걷어냈으므로, 다시 캡처하면 <b>조정 이전</b>의 머리가 나온다.
   → 3D 화면도 조정 화면과 같은 소스를 쓰게 한다. "3D가 원본, 2D는 그 투영"이라는
     구조가 이제 최종 화면까지 한 줄로 이어진다.
   ※ 중립 모델이 아직 없으면(촬영 직후 등) 기존 경로로 폴백한다.
══════════════════════════════════════════════════════════════════ */
function buildAdjustedHair3DObject(){
  if(typeof THREE === 'undefined') return null;
  const adj = computeAdjustedHair3DStrands();     // 전 뷰, 조정 반영
  if(!adj || !adj.length) return null;
  diagAdjSourceStamp('3D화면', adj);   // 조정 화면과 같은 자로 재서 도장(위 ADJ_STAMP 배너)
  const positions = [], colors = [];
  const c = new THREE.Color();
  /* ── 조각별 실측색을 여기서도 쓴다 (2026-08-17 c) ────────────────────────
     computeAdjustedHair3DStrands는 8/17 b부터 st.colors(가닥이 지나는 자리의
     원본 픽셀색 K조각)를 실어 보내는데, <b>이 함수만</b> 그걸 안 읽고 st.color
     하나로 온 가닥을 칠하고 있었다. 그래서 결과 화면·2D 투영은 뿌리 어두움과
     광택 띠가 살아 있는데 최종 3D만 가닥당 단색 = "색연필로 칠한 머리"였다.
     조각 경계식(i0/i1)은 projectHair3DToView·strokeOpColored와 <b>글자 그대로</b>
     같다 — 세 경로가 갈라지면 조용히 어긋난다(이 파일이 반복해서 겪은 방식).
     ⚠ 끝점을 공유해야(i1 포함) 조각 사이에 틈이 안 생긴다. 3D는 선분 목록이라
       틈이 생기면 가닥이 점선으로 끊겨 보인다. */
  /* ── (2026-08-18 i) 3D는 <b>앞 화면에서 조정한 그대로</b>를 따른다 (사용자 지시) ──
     사용자: "3D는 모든 결과를 앞에서 조정한 거에 따르는 거야."
     조정 화면(projectHair3DToView)의 색 규칙은 <b>되쏘아 읽기</b>다: 가닥이 지금
     지나는 자리의 원본 픽셀을 쓰고, 원본에 머리가 없는 자리(늘린 구간·이마의
     뱅·염색으로 덮은 자리)에서만 가닥 색으로 폴백한다. 여기만 그 되쏘기가 없어서
       · 마네킹 — 조각색이 아예 없어 가닥당 단색(사용자 3번: 3D만 전체가 갈색)
       · 염색   — 조정 화면은 사진색인데 3D만 스펙 색으로 전부 덮임
     두 화면이 갈라졌다. 같은 함수(bakeStrandColors3D → sampleProjectedStrandColors)로
     여기서도 읽으면 규칙이 하나가 된다. 폴백색이 sec.color(염색)이므로 "사진에
     머리가 없는 자리는 염색색"이라는 조정 화면의 동작까지 그대로 따라온다. */
  const cmodel = state.hair3Dneutral;
  let pxN = 0;
  for(const st of adj){
    const pts = st.pts;
    if(!pts || pts.length < 2) continue;
    const view = st.srcAngle || (pts[0] ? viewOfRoot(pts[0]) : null);
    const reCols = (HAIR_PIXEL_COLOR.reproject && view)
      ? bakeStrandColors3D(pts, cmodel, view, st.color, st.colors, st.dye)
      : (st.colors || null);
    const segCols = (reCols && reCols.length > 1) ? reCols : null;
    if(segCols) pxN++;
    const n = pts.length, K = segCols ? segCols.length : 0;
    if(!segCols) c.set(st.color || '#1a1a1a');
    let k = 0;                       // 현재 조각 인덱스(점 i가 속한 구간)
    let kEnd = segCols ? Math.round((k+1)*(n-1)/K) : n-1;
    if(segCols){ try{ c.set(segCols[0]); }catch(e){ c.set(st.color || '#1a1a1a'); } }
    for(let i=1;i<n;i++){
      if(segCols){
        while(k < K-1 && i > kEnd){ k++; kEnd = Math.round((k+1)*(n-1)/K); }
        try{ c.set(segCols[k]); }catch(e){}
      }
      const a = pts[i-1], b2 = pts[i];
      if(!isFinite(a.x)||!isFinite(a.y)||!isFinite(a.z)) continue;
      if(!isFinite(b2.x)||!isFinite(b2.y)||!isFinite(b2.z)) continue;
      positions.push(a.x, a.y, a.z, b2.x, b2.y, b2.z);
      colors.push(c.r, c.g, c.b, c.r, c.g, c.b);
    }
  }
  if(!positions.length) return null;
  const obj = makeVertexColorLines(positions, colors);
  obj.name = 'adjustedHair';
  diagFinal3DCoverage(positions);
  /* [진단] 2D 투영 로그의 "원본 픽셀색 N개(=x%)"와 <b>같은 숫자</b>가 나와야 한다.
     여기만 0이면 조각색이 이 함수 앞에서 끊긴 것이고, 둘 다 0이면 중립 캡처가
     색을 못 읽은 것이다(원인이 다르므로 숫자로 갈라야 한다 — 8/17 b와 같은 규칙). */
  console.log(`[3D] 조정 반영 헤어: ${adj.length}가닥 (조정 화면과 같은 소스)`
    + ` · 원본 픽셀색 ${pxN}개(=${adj.length ? Math.round(pxN/adj.length*100) : 0}%)`);
  return obj;
}

/* ══════════════════════════════════════════════════════════════════
   최종 3D <b>실물 커버리지</b> — "모델엔 있는데 화면에 없다"를 가른다 (2026-08-18)
   ─────────────────────────────────────────────────────────────────
   사용자: "혹시 이거 그 자리에 머리카락이 이미 있는 거 아냐? 투명처리가 되어
   있든 뭐 렌더상으로 뭔가 오류가 있든."

   합리적인 의심이고, 지금 로그로는 <b>갈리지 않는다</b>. [3D·겹침]은 뿌리 수를,
   [3D·클립]은 잘린 점 수를 세는데 둘 다 <b>모델</b> 얘기다. 화면에 실제로 들어간
   것은 buildAdjustedHair3DObject가 만든 <b>선분 배열</b>뿐이고, 아무도 그걸
   안 셌다. 그래서 여기서 <b>그 배열 자체</b>를 두상 좌표로 되돌려 센다.

   읽는 법 — 후두부 상단 칸(phi 0.60~1.05 × 후면)이
     · 0에 가깝다  → 화면에 진짜로 없다. 원인은 모델(리프트·클립)이고
                     [3D·클립]·diagCrownCoverage()로 이어서 판다.
     · 이웃과 비슷 → <b>있는데 안 보이는 것</b>이다. 그러면 렌더 쪽 —
                     살구색 두개골이 앞에 서 있거나(getDisplaySkullEllipsoid),
                     선 색이 배경과 같거나, 카메라·컬링 문제다.
   점이 아니라 <b>선분 길이</b>를 더하는 이유: 가닥이 잘려 토막만 남아도 개수는
   그대로라, 개수로 세면 "있다"고 나오는데 화면은 비어 보인다.
══════════════════════════════════════════════════════════════════ */
function diagFinal3DCoverage(positions){
  try{
    const m = state.hair3Dneutral;
    if(!m || !positions || positions.length < 6) return null;
    let S; try{ S = getScalpEllipsoid(); }catch(e){ return null; }
    const CY = m.CY, bb = Math.max(1e-6, S.b);
    /* 밴드 경계는 지어내지 않고 SCALP_ZONES에서 파생한다(crownBandEdges와 동일). */
    const E = crownBandEdges(), NB = E.length - 1;
    // 방위: 정면(|θ|≤thFront) · 옆(≤thBack) · 후면 — SECTION_CUT의 경계 그대로
    // (2026-09-05) 숫자를 주석에 박아두지 않는다 — 경계가 SCALP_ZONES에서 파생되므로
    //   구역표를 고치면 주석만 조용히 낡는다(실제로 0.375/2.25가 그렇게 낡았다).
    const C = SECTION_CUT;
    const len = new Float64Array(NB*3);
    for(let i=0; i+5 < positions.length; i+=6){
      const mx = (positions[i]   + positions[i+3]) / 2;
      const my = (positions[i+1] + positions[i+4]) / 2;
      const mz = (positions[i+2] + positions[i+5]) / 2;
      const d = Math.hypot(positions[i+3]-positions[i], positions[i+4]-positions[i+1], positions[i+5]-positions[i+2]);
      const phi = Math.acos(Math.max(-1, Math.min(1, (my - CY) / bb)));
      let k = 0; while(k < NB-1 && phi >= E[k+1]) k++;
      const th = Math.abs(Math.atan2(mx, mz));
      const s = th <= C.thFront ? 0 : (th <= C.thBack ? 1 : 2);
      len[k*3 + s] += d;
    }
    let tot = 0; for(let i=0;i<len.length;i++) tot += len[i];
    if(!(tot > 0)) return null;
    const pc = v => (v/tot*1000).toFixed(0).padStart(4);   // 천분율 — 작은 칸도 보이게
    const lines = [];
    for(let k=0;k<NB;k++){
      const row = len[k*3] + len[k*3+1] + len[k*3+2];
      if(row <= 0) continue;
      lines.push('phi ' + E[k].toFixed(2) + '~' + E[k+1].toFixed(2)
        + ' | 정면' + pc(len[k*3]) + ' 옆' + pc(len[k*3+1]) + ' <b>후면' + pc(len[k*3+2]) + '</b>');
    }
    console.log('[3D·최종 커버리지] 화면에 실제로 들어간 <b>선분 길이</b> 분포(천분율, 합계 1000)\n  '
      + lines.join('\n  ')
      + '\n  후두부 상단 = phi 0.60~1.05의 <b>후면</b> 칸입니다.'
      + ' 이 칸이 이웃 phi 칸과 비슷하면 화면엔 <b>있는</b> 것이고(그러면 두개골·색·컬링 등 렌더 쪽),'
      + ' 0에 가까우면 <b>없는</b> 것입니다(그러면 [3D·클립]과 diagCrownCoverage()로 이어서 봅니다).');
    return { edges: E, len };
  }catch(e){ console.warn('[3D·최종 커버리지] 실패', e); return null; }
}

// ── (11차) 3D 조정 연산자 — 순수 기하(Node 검증 가능) ──
// 3D=원본 구조에서 조정을 "월드 가닥 폴리라인"에 직접 가한다. 2D의 한계(직모
// 결과 충돌)가 없어 컬은 두상 곡면 위 나선으로 진짜로 감긴다.
// 벡터 유틸(THREE 없이 순수) — Node 하네스에서 그대로 검증.
function _v3sub(a,b){ return {x:a.x-b.x, y:a.y-b.y, z:a.z-b.z}; }
function _v3add(a,b){ return {x:a.x+b.x, y:a.y+b.y, z:a.z+b.z}; }
// 3D 가닥의 호길이(점 사이 거리 합) — curlStrand3D·gravityDroop3D·lengthStrand3D가
// 각자 같은 루프를 복제하고 있던 것을 통합(2026-07-26). 동작 동일.
function arcLength3D(pts){
  let arc = 0;
  for(let i=1;i<pts.length;i++) arc += _v3len(_v3sub(pts[i], pts[i-1]));
  return arc;
}
function _v3scale(a,s){ return {x:a.x*s, y:a.y*s, z:a.z*s}; }
function _v3len(a){ return Math.sqrt(a.x*a.x+a.y*a.y+a.z*a.z); }
function _v3norm(a){ const l=_v3len(a)||1e-9; return {x:a.x/l, y:a.y/l, z:a.z/l}; }
function _v3cross(a,b){ return {x:a.y*b.z-a.z*b.y, y:a.z*b.x-a.x*b.z, z:a.x*b.y-a.y*b.x}; }

// (11차 3D컬 재재작성, 사용자 교정) 실제 펌 물리: 로드(rod) 크기 = 웨이브 폭이
// "루프 지름"을 정하고, 그건 머리 전체에서 동일하다. 긴 머리는 같은 로드에 더
// 여러 바퀴 감길 뿐 루프 크기는 같다 → 길이 비례가 아니라 로드(웨이브폭) 고정.
// 웨이브 폭 → 루프 반경 R(모델 단위, 두상 가로반경 a≈0.29 기준). 머리 전체 공통.
const CURL3D_R_MIN = 0.020; // 작은 로드(웨이브폭 0%) — 촘촘한 작은 스파이럴
const CURL3D_R_MAX = 0.070; // 큰 로드(웨이브폭 100%) — 느슨한 큰 웨이브
/* ════════════════════════════════════════════════════════════════
   3D 조정 연산자 — 길이 · 컬 · 중력 · 가르마
   중립 3D 가닥에 순서대로 얹는 변형들. computeAdjustedHair3DStrands가
   (1)길이 (2)컬(로드 나선) (3)중력 처짐 (4)가르마 순으로 호출한다.
   조정은 전부 여기서 일어나고, 2D는 그 결과를 투영만 한다.
   ════════════════════════════════════════════════════════════════ */
// 3D 컬: 가닥을 로드 반경 R의 "스프링 나선"으로 감는다. 감기면 호길이가 축방향으로
// 압축돼(피치<둘레) 끝이 위로 끌려 올라가는 진짜 링렛이 된다. curlAmt(컬 세기, 0~100)
// =로드 밀착도(반경)+코일 촘촘함(피치), waveT(웨이브 폭)=로드 반경 R. 뿌리 고정.
// 같은 로드에 긴 가닥은 자동으로 더 여러 바퀴. 감은 뒤 gravityDroop3D가 아래로 늘어뜨림.
/* ══════════════════════════════════════════════════════════════════
   시술 전 초기화 — 손님 머리를 <b>생머리로 펴고</b> 시작한다 (2026-08-08)
   ─────────────────────────────────────────────────────────────────
   사용자 의도(#5 재확인): "커트 먼저, 컬 넣고, 염색하고, 그 다음 스타일링인데,
   처음에 머리에 컬이 들어가 있거나 스타일링이 되어 있으면 시술하기가 더
   복잡해지잖아. 그래서 렌더링된 머리를 초기화하고 시작하자."

   앞서 만든 마네킹 리셋은 <b>우리 슬라이더</b>만 중립으로 돌린다. 그런데 손님
   머리의 웨이브는 슬라이더가 아니라 <b>캡처된 가닥 자체</b>에 들어 있다 —
   3D 가닥은 사진의 결 필드를 따라 그린 2D 경로를 올린 것이라, 곱슬 1.08°/px
   같은 실측 굴곡이 폴리라인 좌표에 그대로 구워져 있다. 그 위에 펌을 걸면
   "이미 말린 머리에 또 마는" 상태가 된다.

   그래서 조정 파이프라인 <b>제일 앞(⓪)</b>에 편다:
     · 라플라시안 평활 — 이웃 두 점의 중점 쪽으로 당긴다(굴곡만 깎이고 큰
       흐름은 남는다). 지어낸 곡선으로 바꾸는 게 아니라 <b>있던 굴곡을 줄이는</b>
       연산이라 강도 0이면 원본과 완전히 동일하다.
     · <b>뿌리와 끝을 둘 다 고정</b>한다.

   ⚠ 1차 구현은 "길이 보존"이었다 — 평활된 방향을 따라 <b>원래 호길이만큼</b>
   다시 걸었다. 실제 머리는 펴면 길어지니까 물리적으로 맞다고 봤는데, 실기기에서
   보라색·노란색 가닥이 두상 위와 옆으로 길게 뻗어 나갔다(사용자 스크린샷).
   이유가 두 개다:
     ① 3D 가닥의 호길이는 <b>진짜 모발 길이가 아니다</b>. 사진 결을 따라 추적한
        경로라 추적 잔떨림이 그대로 길이에 들어 있다. 그 잔떨림을 펴면 길이가
        노이즈만큼 늘어난다.
     ② 두상을 감아 도는 가닥은 펴는 순간 <b>접선 방향 직선</b>이 된다. 호길이가
        1.2면 두상 밖으로 1.2를 곧게 뻗는다 — 그게 그 긴 활 모양이다.
   그래서 길이 보존을 버리고 <b>양 끝 고정</b>으로 바꿨다. 가닥이 차지하는 범위는
   그대로 두고 그 안의 웨이브만 깎는다. 폴리라인 길이는 줄어드는데(웨이브가
   없어졌으니 당연하다) 화면상 머리 길이·부피는 안 변한다.
══════════════════════════════════════════════════════════════════ */
const BASE_RESET = { straighten: 0, passes: 24, lambda: 0.5 };
function straightenStrand3D(pts, k){
  if(!(k > 0) || !pts || pts.length < 3) return pts;
  const n = pts.length;
  const passes = Math.max(1, Math.round(BASE_RESET.passes * Math.min(1, k)));
  const lam = BASE_RESET.lambda * Math.min(1, k);
  let cur = new Array(n), nxt = new Array(n);
  for(let i=0;i<n;i++) cur[i] = { x:pts[i].x, y:pts[i].y, z:pts[i].z };
  for(let s=0;s<passes;s++){
    nxt[0] = cur[0]; nxt[n-1] = cur[n-1];
    for(let i=1;i<n-1;i++){
      const a = cur[i-1], b = cur[i], c = cur[i+1];
      nxt[i] = { x: b.x + lam*((a.x+c.x)/2 - b.x),
                 y: b.y + lam*((a.y+c.y)/2 - b.y),
                 z: b.z + lam*((a.z+c.z)/2 - b.z) };
    }
    const t = cur; cur = nxt; nxt = t;
  }
  /* 여기서 끝. 길이를 다시 늘리는 단계는 <b>없다</b>(위 ⚠ 참조).
     양 끝이 고정된 평활은 볼록결합이라 가닥이 원래 점들의 볼록껍질 밖으로
     나갈 수 없다 — 두상 밖으로 뻗는 활 모양이 원리적으로 생기지 않는다. */
  return cur;
}

/* ══════════════════════════════════════════════════════════════════
   컬 — 나선을 <b>가닥 자신</b>에 감는다 (2026-08-18 k 재작성)
   ─────────────────────────────────────────────────────────────────
   사용자: "curl 같은 경우 직접 조정해보면 0에서 조금 늘렸을 때 <b>갑자기 길이가
   확 길어져</b>. 그랬다가 서서히 컬이 잡혀가는 식으로 조정이 <b>일정하지 않아</b>.
   <b>컬 방향</b>도 조정해야 하고."

   맞다. 그리고 원인은 튜닝값이 아니라 <b>나선을 어디에 감았나</b>였다.
   예전 구현은 축을 <b>뿌리→끝 직선</b>(core)으로 잡고 그 위에 나선을 얹었다.
   그러면 컬 0<sup>+</sup>에서 이런 일이 일어난다:
     tight→0 ⇒ A→0 · b→2.6R · perRad→2.6R ⇒ 축길이 = b·θmax = <b>호길이 arc</b>
   즉 컬을 <b>1만 올려도</b> 가닥이 "호길이 arc짜리 <b>직선</b>"으로 바뀐다. 원래
   가닥이 화면에서 차지하던 길이는 현(chord)인데, 굽은 가닥은 arc > chord이므로
   그 비율만큼(캡처 가닥은 보통 1.2~1.5배, 두상을 감아 도는 가닥은 그 이상)
   <b>갑자기 길어진다</b>. 그 다음부터는 A가 커지며 축길이 = arc·b/perRad가
   줄어드니 "서서히 컬이 잡히며 짧아지는" 것으로 보인다 — 사용자가 본 그대로다.
   ※ 부작용이 하나 더 있었다: 컬이 0보다 크기만 하면 가닥의 <b>실제 경로가 버려지고</b>
     직선이 된다. 헤더에 적힌 "가닥이 두상을 안 타고 <b>곧은 바늘</b>처럼 떨어진다"의
     한 몫이 여기다(마네킹 성장만의 문제가 아니었다).

   고침 — 등뼈를 <b>원래 가닥</b>으로. 나선은 그 곡선을 따라 감긴다.
     · 스프링이 길이를 먹는 몫은 그대로 산다: 등뼈를 <b>앞쪽 b/perRad 만큼만</b>
       따라간다(= 예전의 축길이 축소와 같은 양). tight=0이면 이 비가 정확히 1이라
       <b>원래 곡선 그대로</b> — 컬 0과 0<sup>+</sup>가 이어진다(불연속 소멸).
     · 프레임은 평행이송(회전 최소화)한다. 곡선을 따라가면 축이 점마다 바뀌므로
       고정 u,v를 쓰면 나선이 꼬인다.
     · 시작 위상을 <b>두상 바깥 방향</b>에 건다 — 예전엔 up=(0,1,0) 같은 임의 축에서
       나와 가닥마다 위상이 제각각이었다(그래서 "컬 방향"이라는 개념 자체가 없었다).
       curlDir가 이 위상을 돌린다: −100 안말음 ↔ 0 접선 ↔ +100 바깥말음.
       ±100은 같은 자리(위상 ±π)라 손잡이가 <b>연속</b>이다.
   되돌리기: CURL3D_FIX.spine = false (예전 직선축 동작).
══════════════════════════════════════════════════════════════════ */
/* ── 컬 진폭이 <b>주석과 반대로</b> 구현돼 있었다 (2026-08-18 k-3) ──────────
   사용자: "컬만 좀 살면 좀 있어 보이겠는데?"

   위 CURL3D_R_MIN/MAX 주석이 스스로 이렇게 적고 있다:
     "로드(rod) 크기 = 웨이브 폭이 <b>루프 지름</b>을 정하고, 그건 머리 전체에서
      동일하다. 긴 머리는 같은 로드에 더 여러 바퀴 감길 뿐 루프 크기는 같다."
   그런데 구현은 <b>A = tight × R</b>이었다 — 컬 세기가 루프 반경을 <b>깎는다</b>.
   실제 펌은 반대다: 약한 펌 = <b>굵은 로드</b>(큰 반경·느슨한 피치),
   강한 펌 = 가는 로드(작은 반경·촘촘). 로드 굵기는 이미 wave가 맡고 있으므로,
   curl이 또 반경을 건드리면 <b>약한 펌이 그냥 작은 컬</b>이 되어 안 보인다.

   실기기 로그로 환산하면(두상 반폭 0.416 · 헤어폭 475px · 19.33cm/단위):
     컬 28(현재 레이어드 보브 스펙) → 나선 반경 <b>0.30cm · 화면 9px</b>
   STYLE_SPECS는 같은 자리에 "curl 22→28: 목표는 중간기장에 <b>S 한 번이 눈에
   보인다</b>"고 적어 뒀다. 0.30cm짜리 루프로는 그 S가 안 나온다 — 적어 둔 의도와
   나오는 그림이 어긋나 있었다.

   고침: 반경을 <b>로드가 정하게</b> 되돌린다. 다만 컬 0에서는 진폭이 0이어야
   하므로(8/18 k에서 세운 연속성) 선형이 아니라 <b>빨리 붙고 포화하는</b> 곡선을
   쓴다: A = R × tight^radiusGamma. 0.5는 그 조건을 만족하는 가장 완만한 값이고,
   지어낸 계수가 아니라 "0에서 0, 1에서 R, 중간에서 로드에 근접"이라는 위 문장을
   그대로 만족시키는 최소 곡률이다. 피치(b)는 <b>손대지 않았다</b> — 세기가
   촘촘함을 정한다는 부분은 원래 맞았다.
   radiusGamma = 1 로 두면 예전 동작 그대로.
   ※ 얼마나 보여야 하는가는 <b>미용사가 정할 값</b>이므로, 지어내는 대신
     [컬 환산] 로그로 지금 설정이 몇 cm·몇 %인지 찍는다(아래 logCurlScale). */
const CURL3D_FIX = { spine: true, droopWithCurl: true, radiusGamma: 0.5,
  /* 로드 반경 눈금 · 컬 세기 응답 — 둘 다 <b>물리 그대로</b>다(아래 배너).
     rodK 1 = 로드 지름에 선형 · ampGamma 1 = 손대지 않음. 남겨 둔 건 손잡이가
     아니라 <b>왜 안 건드리는지</b>를 코드에 붙들어 두기 위한 자리다. */
  rodK: 1,
  ampGamma: 1 };
/* 지금 섹션 설정이 <b>화면에서 얼마짜리 루프</b>인지 한 번 찍는다.
   두상 반폭 대비 %라 자(cm 환산)가 없어도 읽을 수 있다. */
let _curlScaleLogged = false;
function logCurlScale(){
  if(_curlScaleLogged) return;
  let a = 0; try{ a = getHeadEllipsoid().a; }catch(e){ return; }
  if(!(a > 0)) return;
  _curlScaleLogged = true;
  const g = CURL3D_FIX.radiusGamma;
  const rows = [];
  for(const id of SECTION_ORDER){
    const s = (state.sections && state.sections[id]) || null;
    if(!s || !(s.curl > 0)) continue;
    const R = curlRodRadius(s.wave/100);   // 렌더와 <b>같은 출처</b>(두 벌이면 로그가 거짓말한다)
    const t = Math.max(0, Math.min(100, s.curl))/100;
    const A = R * Math.pow(t, g);
    const b = R * (2.6 - 2.28*t);
    rows.push(id + ' 컬' + s.curl + '/웨이브' + s.wave
      + ' → 로드반경 ' + (R/a*100).toFixed(0) + '% · 나선반경 <b>' + (A/a*100).toFixed(0) + '%</b>'
      + ' · 남는 길이 ' + (b/Math.hypot(A,b)*100).toFixed(0) + '%');
  }
  if(!rows.length){ console.log('[컬 환산] 컬이 걸린 섹션이 없습니다(전부 curl 0).'); return; }
  console.log('[컬 환산] 두상 <b>반폭 대비</b> (radiusGamma ' + g + ' · 1이면 예전 동작)\n  ' + rows.join('\n  ')
    + '\n  나선반경이 5% 미만이면 화면에서 직모와 구분이 안 됩니다(두상 반폭이 보통 화면 240px 안팎).');
}
/* 폴리라인 위 호길이 s 지점 — 선형보간. arcAtY/yAtArc와 같은 규약(뿌리=0). */
function _pointAtArc(pts, cum, s){
  const n = pts.length;
  if(s <= 0) return { x:pts[0].x, y:pts[0].y, z:pts[0].z };
  const tot = cum[n-1];
  if(s >= tot) return { x:pts[n-1].x, y:pts[n-1].y, z:pts[n-1].z };
  let lo = 0, hi = n-1;
  while(lo + 1 < hi){ const mid = (lo+hi)>>1; if(cum[mid] <= s) lo = mid; else hi = mid; }
  const seg = cum[hi] - cum[lo];
  const t = seg > 1e-12 ? (s - cum[lo]) / seg : 0;
  return _v3add(pts[lo], _v3scale(_v3sub(pts[hi], pts[lo]), t));
}
/* ── 로드 눈금은 <b>건드릴 게 없었다</b> — 횟수는 물리가 정한다 (8/30 5차) ──
   사용자: "원래 부분펌이 아니면, <b>rod 지름과 그 가닥의 길이를 나누면 회수가
   나오는 거 아냐?</b>" — 맞다. 그리고 이 한마디가 4차의 근거를 통째로 무너뜨린다.

   4차는 이 슬라이더를 "감은 횟수"와 "굴곡 크기"라는 <b>두 양의 절충</b>이라고
   보고, 둘 중 나쁜 쪽을 최소로 만드는 지수(k = −0.20)를 골랐다. 그런데 그 둘은
   독립이 아니다. 로드에 감으면
       감은 횟수 = 가닥 길이 ÷ (π · 로드 지름)
       굴곡 크기 = 로드 반경
   이라 <b>하나가 정해지면 나머지는 따라온다</b>. 하네스로 확인(길이 0.55 · 컬 100):
     웨이브 0/40/100 → R 0.020 / 0.040 / 0.070
       감은 횟수      4.12 / 2.20 / 1.37
       횟수 × R      0.082 / 0.088 / <b>0.096</b>   ← 거의 상수 = 반비례가 맞다
       길이÷(π·지름)  4.38 / 2.19 / <b>1.25</b>   ← 실제 횟수와 몇 % 안에서 일치
   즉 4차는 <b>같은 사실을 두 번 재 놓고</b> 그 둘을 화해시키려 한 것이다. 어떤 양과
   그 역수의 이탈을 동시에 줄이면 답은 언제나 기하평균 근처로 끌려간다 — k가
   −0.20(등비 k=0 바로 옆)으로 나온 것도 머리카락의 성질이 아니라 그 <b>산술의
   성질</b>이었다. 재 봐야 아무것도 안 나오는 자를 두 개 든 셈이다.

   그래서 눈금은 <b>로드 지름에 선형</b>으로 되돌린다(rodK = 1, 원래 코드).
   이 손잡이가 뜻하는 것은 파생량이 아니라 미용사가 집는 <b>물건</b>이고, 로드는
   mm로 골라 쓴다. "위쪽 절반에서 횟수가 덜 변한다"는 것은 버그가 아니라
   굵은 로드의 <b>사실</b>이다 — 20mm와 25mm는 많이 다르고 60mm와 65mm는 별로
   안 다르다. 눈금을 비틀어 그 사실을 감추면 화면과 시술이 어긋난다.
   ⓘ 컬 세기(ampGamma)도 같은 이유로 1로 되돌렸다 — 아래 배너 참고.
   ⓘ 남는 아쉬움이 있다면 눈금이 아니라 <b>표시</b>다. 이 슬라이더는 0~100이 아니라
     <b>mm</b>로 적히는 게 맞다(R_MIN 0.020 ~ R_MAX 0.070이 그 축척이다).
     다만 그건 새 UI라 "새로 만들어야 되는 건 놔두고"에 걸린다 — 다음 차례.
   되돌리기: 없음. rodK는 1이 원래 동작이고, 다른 값을 넣으면 위 사실이 깨진다. */
function curlRodRadius(waveT){
  const w = Math.max(0, Math.min(1, waveT || 0));
  const k = CURL3D_FIX.rodK;
  if(k === 1) return CURL3D_R_MIN + w * (CURL3D_R_MAX - CURL3D_R_MIN);
  if(Math.abs(k) < 1e-6) return CURL3D_R_MIN * Math.pow(CURL3D_R_MAX / CURL3D_R_MIN, w);
  const lo = Math.pow(CURL3D_R_MIN, k), hi = Math.pow(CURL3D_R_MAX, k);
  return Math.pow(lo + w * (hi - lo), 1 / k);
}
function curlStrand3D(pts, curlAmt, waveT, curlDir){
  if(!pts || pts.length < 3 || !(curlAmt > 0)) return pts;
  const arc = arcLength3D(pts);
  if(arc < 1e-5) return pts;
  // 로드(웨이브폭) 반경 — 머리 전체 고정. 루프 지름을 정한다.
  const R = curlRodRadius(waveT);
  /* ── 컬 세기도 되돌렸다 — 같은 이유다 (2026-08-30 5차) ────────────────────
     4차는 이 값도 "감은 횟수 vs 굴곡 크기"의 절충으로 보고 0.86을 골랐다.
     그 틀 자체가 틀렸다(위 curlRodRadius 배너). 컬 세기는 <b>가닥이 로드 모양을
     얼마나 따라갔나</b>이고, 0이면 생머리 1이면 로드 그대로다. 그 사이를 어떻게
     비틀 근거가 없다 — 파생량 두 개를 재서 고를 문제가 아니었다.
     그래서 ampGamma = 1(손대지 않음)로 되돌린다.
     ⚠ 4차가 "10~40 네 칸이 8%p"라고 적은 표는 <b>단위 버그</b>가 섞인 값이었다
       (waveT에 0~1이 아니라 0~100을 넣고 쟀다). 바로잡고 다시 재면 컬은
       0~100에서 단조롭고 이탈도 17.3%p로 죽은 구간이 아니다.
     ⓘ 여기서 비트는 대신 손을 대야 할 곳이 있다면 radiusGamma(0.5)와 피치식
       (2.6−2.28·tight)이다. 그 둘은 실측 근거 없이 들어온 모양 상수라 언젠가
       실기기에서 재야 한다 — 눈금이 아니라 <b>모형</b>의 문제다. */
  const tight = Math.pow(Math.max(0, Math.min(100, curlAmt)) / 100,
                         CURL3D_FIX.ampGamma); // 컬 세기 0~1
  // 컬 세기 = ① 로드 밀착도(나선 반경 A) + ② 코일 촘촘함(피치 b).
  // 반경은 <b>로드</b>가 정한다(위 CURL3D_FIX 주석). tight는 0에서 0이 되게만 한다.
  const A = R * Math.pow(tight, CURL3D_FIX.radiusGamma);
  const b = R * (2.6 - 2.28 * tight);        // 피치비 2.6R(느슨)→0.32R(탱탱)
  const perRad = Math.sqrt(A*A + b*b) || 1e-4;
  const thetaMax = arc / perRad;             // 총 감김 각 — 긴 가닥일수록 여러 바퀴
  const axisLen = b * thetaMax;              // 스프링이 남긴 축길이 (= arc·b/perRad ≤ arc)
  const turns = thetaMax / (2*Math.PI);
  const M = Math.max(pts.length, Math.min(400, Math.ceil(turns * 12) + 2));
  const root = pts[0];

  if(!CURL3D_FIX.spine){                     // ── 예전 동작(직선축) — A/B용
    const core = _v3norm(_v3sub(pts[pts.length-1], root));
    let up = {x:0,y:1,z:0};
    if(Math.abs(core.y) > 0.94) up = {x:1,y:0,z:0};
    const u0 = _v3norm(_v3cross(core, up)), v0 = _v3norm(_v3cross(core, u0));
    const out0 = [root];
    for(let i=1;i<=M;i++){
      const theta = thetaMax * (i/M), env = Math.min(1, i/(M*0.12 + 1e-6));
      const base = _v3add(root, _v3scale(core, b*theta));
      out0.push(_v3add(base, _v3add(_v3scale(u0, Math.cos(theta)*A*env),
                                    _v3scale(v0, Math.sin(theta)*A*env))));
    }
    return out0;
  }

  // ── 등뼈 = 원래 가닥의 앞 axisLen 구간을 호길이 등간격으로 다시 뜬 것
  const cum = [0];
  for(let i=1;i<pts.length;i++) cum.push(cum[i-1] + _v3len(_v3sub(pts[i], pts[i-1])));
  const spine = [];
  for(let i=0;i<=M;i++) spine.push(_pointAtArc(pts, cum, axisLen * (i/M)));

  /* 시작 기준 벡터 — 뿌리에서 <b>두상 바깥</b>을 향하는 수평 방향. 이게 있어야
     모든 가닥의 컬 위상이 같은 뜻을 갖는다(그래야 "방향"을 손잡이로 줄 수 있다). */
  let T = _v3norm(_v3sub(spine[1], spine[0]));
  const rl = Math.hypot(root.x, root.z);
  let ref = rl > 1e-4 ? { x: root.x/rl, y: 0, z: root.z/rl } : { x: 1, y: 0, z: 0 };
  const strip = (r, t)=>{
    const d = r.x*t.x + r.y*t.y + r.z*t.z;
    const q = { x: r.x - d*t.x, y: r.y - d*t.y, z: r.z - d*t.z };
    return (_v3len(q) < 1e-6) ? null : _v3norm(q);
  };
  let u = strip(ref, T) || strip({x:0,y:1,z:0}, T) || strip({x:1,y:0,z:0}, T);
  const phase0 = (Math.max(-100, Math.min(100, curlDir || 0)) / 100) * Math.PI;

  const out = [root];
  for(let i=1;i<=M;i++){
    const Tp = _v3norm(_v3sub(spine[i], spine[i-1]));
    if(_v3len(_v3sub(spine[i], spine[i-1])) > 1e-9){
      const un = strip(u, Tp);               // 평행이송(회전 최소화) — 꼬임 방지
      if(un) u = un;
      T = Tp;
    }
    const v = _v3norm(_v3cross(T, u));
    const theta = phase0 + thetaMax * (i/M);
    const env = Math.min(1, i / (M*0.12 + 1e-6)); // 뿌리 근처 테이퍼(부착 유지)
    const rad = A * env;
    out.push(_v3add(spine[i], _v3add(_v3scale(u, Math.cos(theta)*rad),
                                     _v3scale(v, Math.sin(theta)*rad))));
  }
  return out;
}

/* ══════════════════════════════════════════════════════════════════
   뷰 컬링 — 이 각도에서 <b>보이는 가닥</b> 판정 (2026-08-11 단일 출처)
   ─────────────────────────────────────────────────────────────────
   예전 규칙: 가닥의 <b>평균</b> depth < 0이면 통째로 버린다.
   실기기에서 잡힌 증상 — 후면 뷰에서 정수리가 텅 빈다. [정수리 커버리지]가
   원인을 가렸다(뿌리·클립은 멀쩡, "보임"만 낮음):
       정수리(phi 0.01~0.55) 보임 — 손님A 정면 69% 좌 69% 우 68% <b>후 32%</b>
                                     손님B 정면 64% 좌 65% 우 63% <b>후 38%</b>
   두 사람 다 앞·좌·우는 63~69%로 나란한데 후면만 3분의 1이다. 사진이 아니라
   <b>규칙</b>의 문제다.

   왜 정수리에서만 터지나 — 정수리 가닥은 두상 <b>꼭대기</b>에서 나와 사방으로
   흐른다. 그래서 평균 depth가 0 근처에 몰려 있고, 뷰 회전이 조금만 틀어져도
   부호가 통째로 뒤집힌다. 특히 후면은 랜드마크가 없어 포즈가 추정치다
   (로그: "[back] 랜드마크 없음 — 슬롯 기본각 180° 가정"). 추정 포즈 위에
   <b>부호 하나로</b> 자르니 정수리가 절반 넘게 날아간다.

   지금 규칙: 가닥의 <b>어느 부분이라도</b> 카메라 쪽을 향하면 남긴다.
   평균은 "가닥 전체가 어디 있나"를 묻지만, 실제로 보이느냐는 "보이는 부분이
   있느냐"의 문제다. 두상에 걸친 가닥은 절반만 보이는 게 정상이고, 예전 규칙은
   그런 가닥을 통째로 지웠다. 실제로 정수리 머리는 어느 각도에서 봐도 보인다.

   같은 원칙이 이미 파일에 있다 — 세그멘테이션 쪽 "[3D·정수리 보류] 스쳐만 봐서
   보류(지우지 않고 통과)". 확실하지 않으면 안 지운다는 규칙인데, 컬링에만
   그게 없었다. 여기서 맞춘다.

   ※ 남는 가닥이 늘어도 화면 개수는 안 늘어난다 — 렌더가 frontFrac(아래 프로브)로
     솎기를 다시 잡기 때문이다. 그래서 프로브도 <b>같은 판정</b>을 써야 한다
     (안 그러면 예산이 어긋나 그리는 수가 목표에서 벗어난다).
   되돌리려면 VIEW_CULL.mode = 'mean'.

   ── (2026-08-18 h) "정면에서 <b>목 옆으로 뒷머리가 안 보인다</b>" ────────────
   사용자: "정면모드에서 목 주변을 통해서 뒷머리가 보여야 되는데 보이지 않아."
   위 규칙(dmax ≥ 0)은 여전히 <b>깊이 부호</b>다 — "카메라 반대편에 있으면 안
   보인다". 그런데 뒷머리가 목·어깨 옆으로 비어져 나온 부분은 카메라 반대편에
   있으면서도 <b>가리는 것이 없다</b>. 어깨까지 내려온 긴 머리는 정면 사진에서
   목 양옆으로 반드시 보이는데, 그 가닥은 점이 전부 z<0이라 통째로 버려지고
   있었다. 정면 뷰에서 뒷머리가 한 가닥도 안 그려진 이유가 이것이다.
   (세그멘테이션은 그 자리를 머리카락으로 잡고 있었다 — 그래서 클립은 통과다.
    즉 "그릴 게 없어서"가 아니라 "그리기 전에 버려서" 비어 있었다.)

   판정을 "뒤에 있나"에서 "<b>가려지나</b>"로 바꾼다 — 아래 makeViewOccluder.
   앞을 향한 점은 예전과 똑같이 무조건 보임이라, 이 변경으로 <b>사라지는</b>
   가닥은 없다(추가만 된다). 가림 기하를 못 만들면 예전 규칙 그대로.
══════════════════════════════════════════════════════════════════ */
/* ── (2026-08-18 i) 판정은 가닥 단위인데 <b>그리기는 통째로</b>였다 ──────────
   사용자: "1번 사진에서는 뒷머리가 <b>목 앞에</b> 그려져." / "측면 사진에서는
   머리가 이상하게 그려져 있고."

   8/18 h가 "가닥의 어느 한 점이라도 보이면 남긴다"로 바꿨다. 맞는 규칙이다 —
   목 옆으로 비어져 나온 뒷머리는 실제로 보이니까. 그런데 <b>남긴 다음</b>이
   빠져 있었다: 남긴 가닥은 점 하나도 빠짐없이 전부 그려진다. 그래서 목 옆으로
   1cm 보이는 가닥이 목·턱·얼굴을 <b>가로질러</b> 통째로 그려졌다.
   2D 조정 화면은 원본 사진 <b>위에</b> 가닥을 얹으므로, 목 뒤를 지나는 구간이
   그대로 목 앞에 얹힌 그림이 된다 — 사용자가 본 것이 정확히 이것이다.
   측면도 같은 원인이다: 반대쪽(먼 쪽) 머리가 얼굴을 가로질러 그려진다.

   고침 — 판정을 <b>점 단위</b>로 내려서 보이는 구간만 그린다. 판정식(viewPointVisible)은
   그대로 쓴다. 새 규칙이 아니라, 이미 있던 규칙을 <b>그리기에도</b> 적용하는 것이다.
   · 경계 선분(보임↔가림)은 그린다 — 가려지는 지점에서 자연스럽게 끝나야 하고,
     빼면 실루엣 경계에 눈에 보이는 틈이 생긴다.
   · 가닥 단위 판정(strandFacesCamera)은 그대로 둔다: 그건 "이 가닥을 아예
     계산할 가치가 있나"를 정하는 예산 쪽 판정이라 성격이 다르다.
   되돌리려면 VIEW_CULL.trimHidden = false(8/18 h 동작). */
/* ── (2026-09-02) photoOverrides를 <b>끈다</b> — 측면에서 반대로 돌고 있었다 ──
   사용자: "측면 캔버스에서 머리카락이 입과 반대편 얼굴을 덮는다."
   viewPointVisible ④가 그 자리다. ③까지 오면 그 점은 <b>카메라 반대편이고
   두개골 그림자 안</b>, 즉 판정이 이미 "안 보임"으로 끝난 상태인데, ④가
   "되쏜 픽셀이 사진에서 머리카락이면" 그 결론을 뒤집는다.
   isHairPixelAt은 <b>그 픽셀에 머리가 있나</b>만 보고 <b>누구의</b> 머리인지는
   안 본다. 측면에서 먼 쪽 머리는 두개골을 지나 가까운 쪽 뺨 위에 투영되는데,
   그 자리는 가까운 쪽 머리가 덮고 있어 사진 마스크가 1이다 → 뒤집힌다.
   8/18 j가 이 규칙을 넣을 때 근거는 <b>정면</b>이었고(목 양옆 뒷머리는 사진에
   실제로 찍혀 있다), 안전장치로 "얼굴·목 <b>살</b> 위는 예전대로 지운다"고
   적었다. 그 안전장치가 곧 ④의 조건 자체다 — 살이면 마스크가 0이라 안 뒤집힌다.
   정면은 뺨이 살이라 작동하고, 측면은 뺨이 머리로 덮여 있어 안 걸린다.
   규칙이 틀린 게 아니라 <b>적용 범위가 정면 전용인데 전 뷰에 걸려 있었다</b>.
   실측이 이 방향을 가리킨다 — right 뷰 [정수리 단계] 점 보임 <b>91%</b>
   (7961/8779). 가림 판정이 점의 9%밖에 안 자른다 = 두개골 뒤 반구가 통째로 살아 있다.
   ⚠ 대가: 8/18 j가 고친 <b>정면 목 옆 뒷머리</b>가 도로 사라질 수 있다.
     이번엔 그걸 <b>확인하려고</b> 끈다 — 측면이 좋아지고 정면이 나빠지면
     예외의 범위 문제가 맞고, 그때 답은 뷰별 분기가 아니라 깊이 버퍼다
     (예외의 예외를 만들면 이 파일이 반복해서 당한 그 모양이 된다).
   되돌리기: VIEW_CULL.photoOverrides = true */
/* depthBuffer — 가림을 <b>깊이</b>로 판정한다(viewPointVisible 배너). 8/18 j가
   "예외의 예외 대신 깊이 버퍼"라고 미리 적어 둔 그 자리다.
   depthEps — 두개골 반깊이 대비 허용 오차. 뿌리는 두피에 붙어 있어 두개골
   앞면과 거의 같은 깊이라, 0이면 수치 오차로 <b>뿌리가 깜빡인다</b>. */
/* ── (2026-09-05 2차) 깊이 버퍼를 <b>목·어깨에도</b> 준다 ────────────────────
   사용자: "photoOverrides 껐을 때야 … 이거 하고 나서 depthBuffer 했는데
   그건 변화가 없어."

   변화가 없는 게 맞다. 9/05의 깊이 버퍼는 occ.frontZ 하나뿐이고, 그건
   <b>두개골 타원만</b> 푼다. 그런데 그 타원은 getDisplaySkullEllipsoid =
   두피면이라 실기기에서 a=0.503이고, 머리카락은 헐(a=0.704)에 있다.
   옆머리는 그 그림자 <b>밖</b>으로 투영되므로 판별식이 음수 → frontZ가 null →
   깊이 버퍼가 <b>한 번도 안 걸린다</b>. 켜든 끄든 같은 그림인 이유가 이것이다.

   그러면 실제로 자르고 있는 건 아래 예전 경로다:
       if(pr.depth >= 0) return true;
       if(!occ.covers(lx, ly, my)) return true;
       if(photoOverrides && 사진이 머리라고 함) return true;   ← 지금 꺼져 있음
       return false;
   covers의 <b>목·어깨 가지</b>에는 깊이가 없다 — |lx| ≤ half 하나뿐이고,
   interpolateBands가 마지막 밴드(어깨)로 클램프하므로 그 그림자가 화면 아래
   끝까지 서 있다. 턱 아래로 내려온 사이드·템플 가닥은 z가 0 근처에서 부호만
   흔들리는데, 부호가 음수로 떨어진 점을 trimHidden이 점 단위로 잘라낸다 →
   <b>턱선 아래부터 시작되는 세로 틈과 톱니 밑단</b>. 증상이 턱 위에서는 안
   보이고 턱 아래에서만 보이는 이유가 neckTopY 그 한 줄이다.

   고침은 8/18 j가 적어 둔 그대로 <b>깊이 버퍼</b>인데, 붙일 자리가 두개골이
   아니라 목이었다. 단면 타원(반폭 w · 반깊이 d)을 뷰로 돌린 2×2 행렬
   M = [[R0·w, R2·d],[R6·w, R8·d]] 에서 lz를 소거하면 지금 covers가 쓰는
   half² = P = u·u 가 그대로 나오고, 소거 대신 lz에 대해 풀면 앞면이 닫힌 해로
   나온다(두개골 frontZ와 <b>같은 절차</b> · 새 상수 없음).

   neckRimMin — rim 가드. 실루엣 가장자리에서는 단면 두께가 0으로 수렴해서
   깊이 판정이 성립하지 않는다(가릴 두께가 없는데 부호로 자르면 얼룩이 된다).
   국소 반두께가 이 비율 밑이면 "여긴 가리는 게 없다"로 본다.
   되돌리기: VIEW_CULL.neckDepth = false (9/05 1차와 글자 그대로 같은 동작) */
/* ── (2026-09-06 2차) 목·어깨 아래는 <b>깊이로 못 가른다</b> — 뿌리 쪽으로 ────
   사용자: "정면에서 봤을 때 긴머리가 다 잘려서 단발로만 보여."

   3D 화면은 같은 모델로 <b>어깨 아래까지</b> 그린다. 그러니 없어서 안 그린 게
   아니라 <b>그리기 전에 지운 것</b>이고, 마네킹에서 아직 열려 있는 문은 둘뿐이다
   (MQ_TRUST가 나머지를 닫았다) — 두개골 깊이와 목·어깨 깊이. 두개골 그림자는
   턱 위에서 끝나므로, 턱 아래를 자르는 것은 <b>목·어깨 깊이</b> 하나다.
   실측이 그 말을 그대로 한다: [끊긴 가닥]의 구멍은 전부 두개골 깊이인데
   가림 트리밍은 61%다 — 나머지 트리밍은 구멍이 아니라 <b>꼬리</b>, 즉 잘린 밑단이다.

   왜 잘리나. neckFrontZ는 목·어깨 타원의 <b>앞면</b>을 구해 그보다 뒤면 지운다.
   그런데 우리 모델의 머리카락은 두상에서 그대로 흘러내릴 뿐 <b>가슴이 없다</b> —
   턱 아래로 내려온 가닥의 z는 뿌리의 z 언저리(0.1~0.3)에 머무는데, 목·어깨
   단면의 앞면은 그보다 앞(어깨 밴드는 두상 대비 최대 3배 깊다)이다. 그래서
   앞으로 흘러내린 머리가 전부 "몸 뒤"로 판정돼 사라진다. 자른 높이가 정확히
   턱선인 이유가 이것이다(그 위는 두개골 그림자라 이 가지를 안 탄다).

   즉 깊이 판정이 성립하려면 <b>몸과 머리카락이 같은 정밀도로 모델링</b>돼야
   하는데, 몸통은 실측 밴드의 클램프이고 머리카락엔 드레이프가 없다. 두 개의
   서로 다른 근사를 부호도 아닌 절대 깊이로 비교한 것이 이 문에 없던 권한이다.

   대신 <b>가닥이 몸의 어느 쪽으로 흘렀나</b>로 가른다. 이건 우리가 실제로 아는
   값이다 — 뿌리 깊이. 뒤통수에서 난 머리는 길든 짧든 몸 뒤로 가고, 앞·옆에서
   난 머리는 몸 앞(겉)으로 내려온다. 길이는 그 소속을 안 바꾼다. 이미 겹 정렬
   키(9/01 6차)와 얼굴 게이트(strandIsFarSide)가 같은 근거를 쓴다.
     · 뿌리가 카메라 쪽(rootDepth ≥ 0) → 몸 <b>겉</b>에 놓인 머리다. 안 지운다.
     · 뿌리가 반대쪽                    → 몸에 <b>가려질 때만</b> 지운다(occ.covers).
       이건 8/18 h가 세운 규칙 그대로라, "정면에서 목 옆으로 보이는 뒷머리"도
       그대로 살아 있다.
   부수 효과로 9/05 2차가 겨냥한 <b>톱니 밑단</b>도 같이 없어진다 — 원인이던
   "z 부호가 0 언저리에서 점마다 흔들림"이 가닥당 한 번의 판정으로 바뀐다.
   되돌리기: VIEW_CULL.neckBySide = false (9/05 2차와 글자 그대로 같은 동작) */
const VIEW_CULL = { mode: 'anyVisible', trimHidden: true, photoOverrides: false,
                    depthBuffer: true, depthEps: 0.04,
                    neckDepth: true, neckRimMin: 0.15,
                    neckBySide: true };   // 'anyVisible' | 'anyFacing' | 'mean'(예전)

/* 이 뷰에서 <b>가리는 몸</b>(두상+목·어깨)의 직교투영 그림자 (2026-08-18 h).
   가리는 것은 두 조각이고 <b>둘 다 이미 실측돼 있다</b>(새 상수 없음):
     · 두상 — getDisplaySkullEllipsoid(). 헐(getHeadEllipsoid)이 아니라 <b>두개골</b>을
       쓰는 이유: 헐은 머리카락 겉면이라 그걸로 가리면 "머리카락이 머리카락을
       가린다"가 되는데, 머리끼리의 겹침 순서는 painter's 정렬이 이미 처리한다.
       가려야 하는 건 살·뼈다.
     · 목·어깨 — interpolateNeckCrossSection(meshY)의 실측 반폭·반깊이. 밴드 아래로
       내려가면 interpolateBands가 마지막 밴드(어깨선)로 클램프하므로 몸통도
       근사로 덮인다.
   직교투영이라 "가려짐 = 그 점이 실루엣 <b>그림자</b> 안에 있다"가 정확히 계산된다.
     · 두상: 뷰 좌표의 2차형식 A = R·M·Rᵀ (M=diag(1/a²,1/b²,1/c²))에서 lz를 소거하면
       (슈어 여원) 그림자 타원의 2×2 형식 B가 나온다 — 닫힌 해, 반복 없음.
     · 목: 단면 타원(반폭 w, 반깊이 d)의 뷰 가로 방향 지지함수 √((w·cosψ)²+(d·sinψ)²).
       ψ는 yaw만 본다(목은 세로 기둥이라 pitch·roll의 몫이 작다).
   ⚠ 최종 안전망은 그대로다 — 이 판정이 통과시킨 가닥도 세그멘테이션 클립
     (applyHairLayerClip)이 "사진에 머리카락이 없는 자리"에서 지운다. 여기서 하는
     일은 <b>지울 이유가 없는 가닥을 미리 버리지 않는 것</b>뿐이다. */
function makeViewOccluder(cal){
  try{
    const E = getDisplaySkullEllipsoid();
    if(!E || !(E.a > 0) || !(E.b > 0) || !(E.c > 0)) return null;
    const R = composeRotationZYX(cal.yaw, cal.pitch, cal.roll);   // project3DPointToView와 같은 R
    const M = [1/(E.a*E.a), 1/(E.b*E.b), 1/(E.c*E.c)];
    const A = (i,j)=> R[i*3]*M[0]*R[j*3] + R[i*3+1]*M[1]*R[j*3+1] + R[i*3+2]*M[2]*R[j*3+2];
    const a33 = A(2,2), inv = (a33 > 1e-12) ? 1/a33 : 0;
    const A02 = A(0,2), A12 = A(1,2);
    const B11 = A(0,0) - A02*A02*inv;
    const B12 = A(0,1) - A02*A12*inv;
    const B22 = A(1,1) - A12*A12*inv;
    const cw = Math.cos(cal.yaw), sw = Math.sin(cal.yaw);
    let neckTopY = null;
    try{ neckTopY = headPhiToMeshY(HEAD_PHI_BANDS[HEAD_PHI_BANDS.length-1]); }catch(e){}
    const A00 = A(0,0), A01 = A(0,1), A11 = A(1,1);
    /* neckFrontZ가 목 단면을 뷰로 돌릴 때 쓰는 R의 (x,z)↔(lx,lz) 네 항.
       cw/sw는 covers가 쓰던 yaw 전용 근사이고, 이쪽은 같은 R에서 직접 읽는다 —
       yaw만이면 두 식이 정확히 같은 값으로 환원된다(P = half²). */
    const R0 = R[0], R2 = R[2], R6 = R[6], R8 = R[8];
    const zEps = E.c * VIEW_CULL.depthEps;
    return {
      /* 이 뷰에서 <b>부호+covers 폴백</b>을 쓸지. 마네킹이면 깊이(frontZ/neckFrontZ)만
         남기고 닫는다(MQ_TRUST 배너). 뷰당 한 번만 정하므로 점당 비용은 0이다. */
      trust: (MQ_TRUST.bodyShadow && mqGeomTrusted()),
      covers(lx, ly, my){
        if(B11*lx*lx + 2*B12*lx*ly + B22*ly*ly <= 1) return true;   // 두상 그림자 안
        if(neckTopY == null || my > neckTopY) return false;         // 두상 옆·위 = 가릴 것 없음
        let n = null;
        try{ n = interpolateNeckCrossSection(my); }catch(e){ return false; }
        if(!n || !(n.halfWidth > 0)) return false;
        const half = Math.hypot(n.halfWidth*cw, (n.halfDepth||n.halfWidth)*sw);
        return Math.abs(lx) <= half;                                // 목·어깨 그림자 안
      },
      /* 이 화면 위치에서 <b>목·어깨의 앞면</b>이 어느 깊이에 있나 (2026-09-05 2차).
         두개골 frontZ와 같은 절차다 — covers가 소거한 것을 lz에 대해 풀 뿐이다.
           단면 타원 (x,z) = (w·cosθ, d·sinθ)
           뷰 좌표 (lx, lz) = M·(cosθ, sinθ),  M = [[R0·w, R2·d],[R6·w, R8·d]]
         |(cosθ,sinθ)| = 1 이므로 (lx,lz)는 타원 위에 있고, lz에 대해 풀면
           lz = (S·lx ± |detM|·√(P − lx²)) / P,   P = u·u,  S = u·v,  u,v = M의 행
         P는 covers의 half²와 <b>같은 값</b>이고(yaw만이면 w²cos²+d²sin²로 환원),
         카메라 쪽 근(+)이 앞면이다. R을 직접 읽으므로 pitch·roll도 따라온다. */
      neckFrontZ(lx, my){
        if(!VIEW_CULL.neckDepth) return null;
        if(neckTopY == null || my > neckTopY) return null;          // 두상 옆·위 — 목이 아니다
        let n = null;
        try{ n = interpolateNeckCrossSection(my); }catch(e){ return null; }
        if(!n || !(n.halfWidth > 0)) return null;
        const w = n.halfWidth, d = (n.halfDepth || n.halfWidth);
        const P = R0*R0*w*w + R2*R2*d*d;                            // = half²
        if(!(P > 1e-12)) return null;
        const q = P - lx*lx;
        if(!(q > 0)) return null;                                   // 그림자 밖 = 가릴 것 없음
        const rq = Math.sqrt(q);
        const dM = Math.abs((R0*R8 - R2*R6) * w * d);               // |det M|
        const hHalf = dM * rq / P;                                  // 이 자리의 <b>반두께</b>
        if(hHalf < VIEW_CULL.neckRimMin * d) return null;           // rim — 두께가 없으면 못 가린다
        const S = R0*R6*w*w + R2*R8*d*d;
        return (S*lx + dM*rq) / P - d*VIEW_CULL.depthEps;
      },
      /* 이 화면 위치에서 <b>두개골의 앞면</b>이 어느 깊이에 있나 (2026-09-02 7차).
         그림자 안이 아니면 null(가릴 두개골이 없다).
         covers가 lz를 소거해서 그림자를 얻은 그 2차형식을, 이번엔 <b>lz에 대해</b>
         푼다 — 소거 대신 근을 구할 뿐이라 새 모델도 새 상수도 없다:
           A22·lz² + 2(A02·lx + A12·ly)·lz + (A00lx² + 2A01lxly + A11ly² − 1) = 0
         카메라 쪽 근(큰 lz)이 앞면이다. 판별식이 음수면 그림자 밖이라 null. */
      frontZ(lx, ly){
        if(!(a33 > 1e-12)) return null;
        const bq = A02*lx + A12*ly;
        const cq = A00*lx*lx + 2*A01*lx*ly + A11*ly*ly - 1;
        const disc = bq*bq - a33*cq;
        if(!(disc > 0)) return null;
        return (-bq + Math.sqrt(disc)) / a33 - zEps;
      }
    };
  }catch(e){ return null; }
}

/* 점 하나가 이 각도에서 보이는가. occ가 없으면(기하 미준비) 예전 규칙과 동일 —
   앞을 향한 점만 보임으로 세므로 아래 strandFacesCamera가 dmax 규칙으로 떨어진다.

   ── (2026-08-18 j) <b>사진이 거기 머리카락이라고 말하면 그린다</b> ─────────────
   사용자: "후면에서 찍은 사진은 뒷머리가 <b>일자</b>인데, 앞에서 보는 뒷머리는
   <b>중간이 잘려서 올라가</b> 있네."

   맞다. 목 그림자는 목에서 끝나지 않는다 — 목 단면 밴드는 neckBotY(-1.15)까지
   내려가고 그 아래는 마지막 밴드(어깨)로 클램프된다. 즉 <b>몸통 폭</b>의 그림자가
   화면 아래 끝까지 서 있다. 그래서 어깨 뒤로 넘어간 가닥이 통째로 지워지고,
   지워진 자리가 밑단을 톱니처럼 끊어 놓는다. 그런데 사진에는 그 자리에
   <b>머리카락이 찍혀 있다</b> — 우리 z부호는 그만큼 정확하지 않은데(뿌리선
   어긋남 중앙값 32~49px) 그 부호 하나로 실제로 보이는 머리를 지운 것이다.

   그래서 가림 판정에 <b>사진</b>을 한 표 더 준다: 되쏜 자리가 원본에서 머리카락
   (reasonMask=1)이면 가려졌다고 보지 않는다. 판정 근거가 "우리 몸 모델"에서
   "사진"으로 넘어가는 것이고, 이 파일이 반복해서 옳았던 방향이다.
   · 얼굴·목 <b>살</b> 위(사진이 머리카락이 아니라고 말하는 자리)는 예전 그대로 지운다
     — 8/18 i가 고친 "목 앞에 그려지는 뒷머리"는 그대로 안 그려진다.
   · 마스크·좌표가 없으면(마네킹 초기·이식 실패) 예전 규칙 그대로.
   되돌리려면 VIEW_CULL.photoOverrides = false. */
/* ══════════════════════════════════════════════════════════════════
   마네킹 기하를 믿는다 (2026-09-06) — 사진 보정용 문을 닫는다
   ─────────────────────────────────────────────────────────────────
   사용자: "지금은 마네킹 모드로 가닥 디렉션도 잡았고, 길이는 별도로
   조정하면 되니까, 불필요한 건 지워."

   ── 어떤 게 불필요한가 ───────────────────────────────────────────
   지금 가닥을 지우는 문이 여섯이었다. 그런데 여섯이 <b>같은 종류가 아니다</b>:

     A. 진짜 기하 — 두개골·목 앞면 깊이(occ.frontZ / occ.neckFrontZ).
        닫힌 해로 푼 깊이 비교다. "머리 뒤에 있으면 안 보인다"는 물리다.
     B. 사진 보정 — 얼굴 타원(8/01) · 점유 재클립(8/01) · 2D 클립 마스크
        (8/01) · 얼굴 실루엣 게이트(9/04).

   B가 왜 생겼는지는 코드가 직접 적어 뒀다. 9/04 배너: <b>"가림 판정의
   정확도가 두개골 타원의 정확도를 절대 못 넘는다 — 뿌리선 어긋남 중앙값이
   32~49px인 모델로 이 점이 뺨 앞이냐 뒤냐를 가리려는 것"</b>. 즉 B는 전부
   <b>A가 못 미더워서</b> 사진(랜드마크·세그멘테이션)으로 덧댄 안전망이다.

   그 전제가 마네킹에서는 성립하지 않는다. 마네킹 가닥은 <b>바로 그 두상
   타원 위에</b> 심어 만든 것이라, 가닥과 가림판정이 같은 기하를 쓴다 —
   뿌리선 어긋남이라는 개념 자체가 없다. A가 정확하므로 B는 A가 이미 하는
   일을 더 거친 자로 한 번 더 하는 것이고, 거친 자가 이기면 그게 화면의
   구멍이 된다(사용자가 본 "사이드·템플이 뜯긴 자리").

   그리고 B는 마네킹에서 <b>기준 자체가 틀렸다</b>: 점유 재클립과 2D 클립이
   대는 자는 <b>손님의 원래 머리 실루엣</b>이다. 머리를 묶고 온 손님이면
   귀 앞·뺨에 머리카락이 없고, 거기로 내려오는 마네킹 옆머리는 정의상
   전멸한다. 8/09가 이걸 겪고 "여는 폭을 정한다"(fringeFrac)로 이마만
   열어 줬는데, 그때 클립을 통째로 못 놓은 이유가 <b>"마네킹 기하가 혼자
   설 만큼 정확하지 않다"</b>였다. 그 뒤로 깊이 버퍼(9/02 7차)·목 깊이
   (9/05 2차)·얼굴 타원 정합(9/05)이 들어왔다. 전제가 바뀌었으니 결론도
   바뀐다.

   ── 그래서 마네킹일 때 닫는 문 ───────────────────────────────────
   A는 그대로 둔다(뒤통수가 얼굴 위에 그려지면 안 되는 건 여전하다).
   B는 마네킹 모델에서만 닫는다. 촬영 가닥 모델은 <b>한 글자도 안 바뀐다</b> —
   거기서는 뿌리선 어긋남이 실재하므로 안전망이 아직 필요하다.
     faceGate    얼굴 실루엣 게이트(9/04)      → A의 중복
     faceEllipse 얼굴 타원 거부(8/01)          → A의 중복 + 9/05가 지목한 뜯김
     photoClip3D 점유 재클립(8/01)             → 손님 옛 실루엣이라 기준이 틀림
     photoClip2D 레이어 destination-in(8/01)   → 같은 이유
     bodyShadow  부호+covers 폴백(8/18 h)      → 깊이 없는 옛 가지. A가 대신한다
   되돌리기: MQ_TRUST.on = false (여기 위 전부가 한 번에 예전 동작)
            개별로는 아래 플래그 하나씩.
   확인: 콘솔 [끊긴 가닥] 줄이 어느 문이 몇 점을 지웠는지 찍는다(GAP_DIAG). */
const MQ_TRUST = {
  on: true,
  faceGate:    true,
  faceEllipse: true,
  photoClip3D: true,
  photoClip2D: true,
  bodyShadow:  true,
};
/* 지금 화면의 모델이 마네킹인가. 플래그가 아니라 모델을 보고 판정한다
   (mqFringeActive와 같은 규칙 — "화면 라벨은 상태가 아니다"). */
function mqGeomTrusted(){
  if(!MQ_TRUST.on) return false;
  try{ const m = state.hair3Dneutral; return !!(m && m.mannequin); }catch(e){ return false; }
}

/* ══════════════════════════════════════════════════════════════════
   끊긴 가닥 진단 (2026-09-06) — "누가 이 점을 지웠나"
   ─────────────────────────────────────────────────────────────────
   사용자: "사이드헤어와 템플헤어가 뜯겨져 있듯이 중간에 빈 곳이 보인다."
   그리고 그 증상이 <b>9/04(얼굴 게이트) 이전에도 있었다</b>.

   맞다면 범인은 얼굴 게이트가 아니다. 게이트는 그림을 직접 안 그리고
   <b>vpt[](점별 보임)에 false를 찍을 뿐</b>이고, 그 배열을 조각으로 끊어
   그리는 기계는 8/18 i의 visibleRuns다. 같은 배열에 false를 찍는 문이
   지금 다섯이다 — 두개골 깊이(9/02 7차) · 목·어깨 깊이(9/05 2차) ·
   몸 그림자(8/18 h) · 뒤쪽 폴백 · 얼굴 게이트(9/04). 화면에 나타나는
   모양은 다섯이 똑같아서 <b>눈으로는 못 가른다</b>.

   그래서 지우는 쪽에 사유를 달고, 실제로 <b>구멍이 난 가닥</b>(=보이는
   구간이 둘 이상으로 쪼개진 가닥)만 골라 그 구멍을 누가 냈는지 센다.
   이 파일의 원칙 (1)이 요구하는 것이 정확히 이것이다 — 스위치를 하나씩
   꺼 보며 짐작하지 말고, 재서 범인을 찍는다.
   비용: 점당 정수 하나 저장 + 구멍 난 가닥에서만 세기. 끄려면 GAP_DIAG.on=false */
const GAP_DIAG = {
  on: true,
  reason: 0,        // 마지막 viewPointVisible 판정의 사유(스크래치 — 호출 즉시 읽는다)
  minGap: 1,        // 이만큼 이상 연속으로 지워져야 "구멍"으로 센다
  topN: 3,          // 로그에 남길 대표 조각 개수
};
/* 사유 코드. 0은 보임이고 나머지는 <b>그 점을 지운 문</b>이다.
   이름 옆의 괄호가 그 문을 여닫는 손잡이라, 로그를 보고 바로 끌 수 있다. */
const GAP_REASON = [
  '보임',
  '두개골 깊이(VIEW_CULL.depthBuffer)',
  '목·어깨 아래(VIEW_CULL.neckDepth · neckBySide면 뿌리 쪽 판정)',
  '몸 그림자(occ.covers)',
  '뒤쪽 폴백(depth<0)',
  '얼굴 게이트(FACE_GATE.on)',
];
/* 판정 본체 — 돌려주는 값이 <b>사유 코드</b>다. 0이면 보임.
   ⚠ 분기·순서·반환 조건은 9/05 2차와 <b>한 글자도 다르지 않다</b>. true를 0으로,
     false를 사유 번호로 바꿔 적었을 뿐이라 그림은 비트 단위로 같다. */
function viewPointHideReason(pr, occ, maskInf, rootDepth){
  /* ── (2026-09-02 7차) <b>깊이의 부호</b>가 아니라 깊이를 본다 ────────────────
     사용자: "사이드가 넘어오는 거야. 그런데 3D에선 얼굴이 가려지는 게 없잖아."
     그 두 문장이 같이 오는 게 답이다 — 3D는 깊이 버퍼가 있고 2D 투영엔 없었다.
     기하는 멀쩡했고 <b>가림 판정만</b> 틀렸다.

     예전 첫 줄은 `if(pr.depth >= 0) return true`였다. "카메라 쪽 반구는 언제나
     보임"인데, 기준면이 <b>두상 중심</b>이다. 측면에서 먼 쪽 옆머리는 뺨을 타고
     <b>앞으로</b> 흘러 lz가 0을 넘는다 — 두개골보다는 여전히 뒤인데 부호는
     양수라 무조건 통과했다. 그래서 반대쪽 사이드가 얼굴 위에 그려졌다.
     occ.covers는 lz를 소거한 <b>그림자</b>라 깊이를 모르니 이걸 못 잡는다.

     고침은 8/18 j 주석이 이미 지목해 둔 것이다("답은 뷰별 분기가 아니라
     깊이 버퍼다"). 그 자리에서 두개골 앞면 깊이를 닫힌 해로 구해(occ.frontZ)
     그보다 뒤면 가린다. 부호 규칙은 frontZ가 null일 때(그림자 밖 = 가릴
     두개골이 없다)의 폴백으로 남는다 — 그때는 예전과 글자 그대로 같다.
     되돌리기: VIEW_CULL.depthBuffer = false */
  if(VIEW_CULL.depthBuffer && occ && occ.frontZ){
    const fz = occ.frontZ(pr.lx, pr.ly);
    if(fz != null){
      if(pr.depth >= fz) return 0;                    // 두개골 앞면보다 앞 = 보임
      if(VIEW_CULL.photoOverrides && maskInf && maskInf.reasonMask
         && isHairPixelAt(maskInf, pr.ix, pr.iy)) return 0;
      return 1;                                       // 두개골 안/뒤 = 안 보임
    }
    /* 두개골 그림자 밖 — 아래 목·어깨 깊이가 이어받는다. */
  }
  /* ── (2026-09-05 2차) 목·어깨도 <b>깊이</b>로 판정한다 (VIEW_CULL 배너) ────
     두개골 타원은 두피면(a≈0.50)이라 옆머리(헐 a≈0.70)가 그림자 밖으로 나간다 —
     그래서 위 블록은 이 가닥들을 한 번도 안 만난다. 실제로 자르던 것은 아래
     covers의 목·어깨 가지이고, 거기엔 깊이가 없어서 z 부호만으로 잘라 왔다.
     여기서 같은 닫힌 해를 주면 "목·어깨 <b>뒤</b>인 것"만 사라진다.
     neckDepth=false면 이 블록이 통째로 빠져 9/05 1차와 같은 동작이 된다. */
  if(VIEW_CULL.neckDepth && occ && occ.neckFrontZ){
    const nz = occ.neckFrontZ(pr.lx, pr.my);
    if(nz != null){
      /* (2026-09-06 2차) 여기서부터는 <b>목·어깨 아래</b>다. 절대 깊이 대신
         가닥의 소속(뿌리 쪽)으로 가른다 — 근거는 VIEW_CULL 배너.
         rootDepth를 안 받은 호출부(진단·마네킹 집기·이식)는 예전처럼
         그 점 자신의 부호를 쓴다 = 9/05 1차와 같은 그림. */
      if(VIEW_CULL.neckBySide){
        const rd = (typeof rootDepth === 'number') ? rootDepth : pr.depth;
        if(rd >= 0) return 0;                                  // 몸 겉으로 흘러내린 머리
        return occ.covers(pr.lx, pr.ly, pr.my) ? 2 : 0;        // 뒤로 넘어간 머리는 가려질 때만
      }
      return (pr.depth >= nz) ? 0 : 2;
    }
  }
  /* 여기 아래는 <b>깊이가 없는 옛 가지</b>다(8/18 h). 두개골·목 그림자 밖이라
     깊이를 물을 대상이 없는 자리이고, 그런 자리는 원래 "가릴 게 없다"는 뜻이다.
     마네킹에서는 위 두 깊이 판정이 정확하므로 이 폴백이 할 일이 없다 —
     오히려 어깨 밴드가 화면 끝까지 세우는 그림자가 밑단을 톱니로 만든다
     (그 증상은 makeViewOccluder 배너가 이미 적어 뒀다). MQ_TRUST 배너 참조. */
  if(occ && occ.trust) return 0;
  if(pr.depth >= 0) return 0;                    // 카메라 쪽 반구는 언제나 보임(예전과 동일)
  if(!occ) return 4;
  if(!occ.covers(pr.lx, pr.ly, pr.my)) return 0;      // 뒤에 있어도 <b>가리는 게 없으면</b> 보인다
  if(VIEW_CULL.photoOverrides && maskInf && maskInf.reasonMask
     && isHairPixelAt(maskInf, pr.ix, pr.iy)) return 0;      // 사진이 "여긴 머리카락"이라 말한다
  return 3;
}
/* 예전 이름·예전 반환값 그대로의 얇은 겉껍질. 부르는 쪽은 아무것도 안 바뀐다.
   사유는 GAP_DIAG.reason에 남겨 두고, 필요한 호출부만 호출 <b>직후에</b> 읽는다
   (스크래치 한 칸을 돌려 쓰는 것은 이 파일의 _proj와 같은 방식이다). */
function viewPointVisible(pr, occ, maskInf, rootDepth){
  const r = viewPointHideReason(pr, occ, maskInf, rootDepth);
  GAP_DIAG.reason = r;
  return r === 0;
}
function strandFacesCamera(dsum, n, dmax, vis){
  if(VIEW_CULL.mode === 'mean') return (n > 0) && (dsum / n >= 0);
  if(VIEW_CULL.mode === 'anyFacing') return dmax >= 0;
  return (vis > 0) || (dmax >= 0);               // 어느 한 점이라도 보이면 남긴다
}
/* 점별 보임 배열 → <b>그릴 구간</b>의 인덱스 범위 [시작, 끝](끝 포함).
   선분 i−1→i는 <b>양 끝 중 하나라도</b> 보이면 그린다(경계에서 끊기지 않게).
   전부 보이면 [[0, n−1]] 하나 — 그때는 예전과 글자 그대로 같은 그림이다. */
function visibleRuns(vpt){
  const n = vpt.length;
  if(n < 2) return [];
  const runs = [];
  let s = -1;
  for(let i=1;i<n;i++){
    const draw = vpt[i-1] || vpt[i];
    if(draw){ if(s < 0) s = i-1; }
    else if(s >= 0){ runs.push([s, i-1]); s = -1; }
  }
  if(s >= 0) runs.push([s, n-1]);
  return runs;
}

/* ══════════════════════════════════════════════════════════════════
   얼굴 실루엣 게이트 (2026-09-04) — "반대편 사이드가 얼굴 위로 지나간다"

   사용자: "측면사진에서 반대편 사이드헤어 가닥이 얼굴 위로 지나가. 그거
   얼굴 반대편으로 넘어가야 하고, 얼굴에 가려지는 부분은 안 보여야 돼."

   ── 왜 지금까지 못 잡았나 ────────────────────────────────────────
   8/18 h(두개골 그림자) · 8/18 i(점 단위 트리밍) · 8/18 j(사진 한 표) ·
   9/02(photoOverrides 끔) · 9/02 7차(깊이 버퍼 frontZ) — 다섯 번 다
   <b>가리는 물체를 우리 3D 모델로 세우고</b> 깊이로 판정했다. 그래서
   가림 판정의 정확도가 두개골 타원의 정확도를 절대 못 넘는다. 뿌리선
   어긋남 중앙값이 32~49px인 모델로 "이 점이 뺨 앞이냐 뒤냐"를 가리려는
   것이고, 측면에서 반대쪽 옆머리는 뺨을 <b>타고</b> 흐르므로 그 오차
   범위 안에 정확히 들어앉는다 — 원리적으로 안 잡힌다.

   이번엔 <b>사진이 직접 말하는 것</b>을 쓴다. 얼굴이 화면 어디에 있는지는
   추정할 필요가 없다 — MediaPipe 468점이 이미 재 놨고(state.landmarks[angle]
   .rawLandmarks), 그건 두개골 타원과 달리 <b>그 사진에서 실측된 값</b>이다.
   그 윤곽선(FACE_OVAL)이 사용자가 말한 "얼굴 반대편 라인"이다.

   ── 규칙 (사용자 설계 그대로) ─────────────────────────────────────
   "x값이 반대라인을 넘어가는 경우, 라인 접선 기울기가 양수면 y>라인일
    때만, 음수면 y<라인일 때만 그린다."
   이건 <b>얼굴 윤곽선의 바깥쪽만 그린다</b>와 같은 말이다. 타원 왼쪽
   위 호는 기울기가 음수이고 바깥이 y<라인, 왼쪽 아래 호는 기울기가
   양수이고 바깥이 y>라인 — 접선 기울기의 부호가 "어느 쪽이 바깥인가"를
   가리키는 국소 표현이다.
   여기서는 그걸 y=f(x) 대신 <b>행별 [좌,우] 구간</b>으로 적는다. 이유
   하나뿐이다: 측면에서 얼굴 윤곽선의 앞쪽 호(이마→코→턱)는 거의
   수직이라 y=f(x)가 다치일함수가 된다(같은 x에 y가 여러 개). 행으로
   훑으면 그 문제가 아예 생기지 않고, 판정 결과는 위 규칙과 똑같다.
   접선 기울기가 하던 "위냐 아래냐"의 역할은 스캔 범위(yTop~yBot)가 한다.

   ── 어느 가닥에 거나 ─────────────────────────────────────────────
   <b>뿌리가 카메라 반대쪽인 가닥</b>에만 건다(rootDepth < 0). 앞머리·
   가까운 쪽 옆머리는 실제로 얼굴을 덮는 게 맞으므로 예전 그대로다.
   판정 기준을 뿌리로 잡는 근거는 이 파일이 이미 정해 둔 것과 같다
   (DEPTH_SORT.byRoot): "가닥이 앞에 있냐 뒤에 있냐는 어디서 나느냐가
   정한다. 뒤통수에서 난 머리는 길든 짧든 옆머리 뒤다." 뿌리는 커트가
   건드리지 않는 유일한 점이라 길이를 흔들어도 판정이 안 튄다.

   ⚠ 이건 <b>추가 게이트</b>다. 기존 판정(viewPointVisible)이 이미 지운
     점을 되살리지 않는다 — 지우기만 한다. 그래서 켜서 나빠질 수 있는
     최대치는 "반대편 머리가 얼굴 자리에서 사라지는 것"뿐이다.
   되돌리기: FACE_GATE.on = false
   ══════════════════════════════════════════════════════════════════ */
const FACE_GATE = {
  on: true,
  /* 얼굴 폭 대비 안쪽으로 줄이는 비율. 0이면 윤곽선에서 칼같이 끊긴다 —
     실제 사진에서는 가닥 끝이 뺨 경계에 살짝 걸쳐 보이므로 조금 줄여서
     경계에 틈이 안 생기게 한다. */
  inset: 0.02,
  /* 턱 아래로 더 내려 잡는 비율(얼굴 높이 대비). 턱선 바로 아래 목은
     FACE_OVAL 밖인데 거기도 반대편 머리가 넘어오면 안 된다. */
  chinExtend: 0.12,
  /* 뿌리 깊이 판정 여유(두개골 반깊이 대비). 정수리 가닥은 뿌리 깊이가
     0 근처라 부호가 잘 뒤집힌다 — 확실히 반대쪽인 것만 건다. */
  rootEps: 0.05,
  /* ── (2026-09-04 2차) 라인을 <b>머리카락 공간</b>으로 옮긴다 ──────────────
     사용자: "얼굴이 우측으로 틀어졌거나 헤어렌더링이 좌측으로 틀어진 것 같다 —
     좌측면에서는 반대편 헤어가 거의 안 보이고, 우측화면에서는 코에 걸린다."
     맞았다. diagRoundTrip() 실측:
       정면 평행이동 ( −1.8,  0.6)px · 배율 1.006 · 잔차 0.2px  ← 닫힘
       후면 평행이동 ( −1.3, −0.2)px · 배율 1.003 · 잔차 0.2px  ← 닫힘
       좌측 평행이동 (−35.3,−21.5)px · 배율 1.103 · 잔차 11.4px
       우측 평행이동 (−26.5, −3.0)px · 배율 1.053 · 잔차 8.6px
     라인은 <b>사진 좌표</b>(raw.x×maskW)에 있고 머리카락은 <b>투영 좌표</b>
     (lx/cal.s + cal.cx)에 있다. 측면 두 뷰에서만 cal.cx·cal.s가 귀 앵커로 크게
     옮겨져서(뷰캘리 로그 left +34px · right −36px) 두 공간이 벌어졌다.
     tx가 둘 다 <b>음수</b>인 게 사용자가 본 좌우 비대칭의 정체다 — 머리가 왼쪽으로
     밀리면, 얼굴이 오른쪽을 보는 좌측면에서는 <b>멀어지고</b> 얼굴이 왼쪽을 보는
     우측면에서는 <b>파고든다</b>.
     고침은 값을 손으로 넣는 게 아니라 <b>재서 상쇄</b>하는 것이다: 랜드마크를
     projectImagePointToHead → project3DPointToView로 왕복시켜 (평행이동·배율·회전)을
     최소제곱으로 뽑고(_fitSimilarity2D — 위 표를 만드는 그 함수) 468점에 그대로
     적용한다. 그러면 cx가 뷰마다 어떻게 옮겨져 있든 정의상 따라간다.
     'none'이면 예전(사진 좌표) 동작. */
  align: 'roundtrip',
  /* 안전레일 — 실측 변환이 이 범위를 벗어나면 <b>안 쓴다</b>(왕복이 깨진 뷰에서
     라인을 엉뚱한 데로 옮기느니 안 옮기는 게 낫다). 위 실측이 최대 tx 35px(마스크
     폭의 4%) · 배율 1.10이라 넉넉히 잡았다. */
  alignMaxShift: 0.20,          // 마스크 폭 대비
  alignScale: [0.7, 1.4],
  /* 얼굴에 막힌 반대편 가닥을 <b>거기서 끝낸다</b>(구멍 뚫기 → 끊기).
     근거는 applyFaceGate 배너. false면 9/04 동작(꼬리가 다시 나옴). */
  cutTail: true,
  debug: false,   // true면 조정 캔버스에 얼굴 라인을 그린다
};

/* 이 뷰의 얼굴 실루엣 — 마스크(=pr.ix/iy) 좌표계. 없으면 null(게이트 꺼짐).

   윤곽선을 FACE_OVAL 링 하나로 잡지 않고 <b>468점 전체의 볼록껍질</b>로
   잡는다. 이유는 측면이다 — FACE_OVAL은 머리를 <b>감아 도는</b> 링이라
   yaw가 커지면 투영이 접혀서 자기교차하고, 접힌 폭이 실제 얼굴보다
   좁게 나온다. 얼굴 표면 점을 전부 넣고 껍질을 씌우면 그 문제가 없다:
   측면에서는 코(가장 앞)부터 귀 앞(가장 뒤)까지가 그대로 폭이 된다.
   얼굴 실루엣은 원래 볼록에 가까워서 껍질로 덮어도 남는 오차는 턱선
   아래 오목한 부분 정도인데, 거기는 chinExtend가 어차피 덮는다.

   껍질을 <b>스캔라인</b>으로 훑어 행별 [minX, maxX]를 만든다. 이게
   사용자가 말한 "얼굴 반대편 라인"의 양쪽 끝이다. */
function _convexHull2D(pts){
  const P = pts.slice().sort((a,b)=> a.x===b.x ? a.y-b.y : a.x-b.x);
  const cross = (o,a,b)=> (a.x-o.x)*(b.y-o.y) - (a.y-o.y)*(b.x-o.x);
  const lower = [];
  for(const p of P){ while(lower.length>=2 && cross(lower[lower.length-2],lower[lower.length-1],p)<=0) lower.pop(); lower.push(p); }
  const upper = [];
  for(let i=P.length-1;i>=0;i--){ const p=P[i];
    while(upper.length>=2 && cross(upper[upper.length-2],upper[upper.length-1],p)<=0) upper.pop(); upper.push(p); }
  lower.pop(); upper.pop();
  return lower.concat(upper);
}
/* 사진 좌표 → 이 뷰의 <b>투영 좌표</b> 변환을 실측한다. diagRoundTrip과 같은
   왕복을 랜드마크 위에서 돌리고 _fitSimilarity2D로 (s, deg, tx, ty)를 뽑는다.
   결과는 뷰·모델·캘리브레이션이 그대로면 안 변하므로 서명으로 캐시한다
   (렌더마다 117회 왕복을 다시 도는 건 이 파일이 반복해서 당한 그 낭비다). */
const _faceAlignCache = new Map();
function faceLineAlignFit(angle, maskW, maskH, raw){
  if(FACE_GATE.align !== 'roundtrip') return null;
  const m = state.hair3Dneutral;
  if(!m || !m.viewCal || !m.viewCal[angle]) return null;
  const cal = m.viewCal[angle];
  const sig = [angle, m._gid || 0, maskW, maskH,
               (cal.cx||0).toFixed(3), (cal.s||0).toFixed(6), (cal.sy||0).toFixed(6),
               (cal.crownY||0).toFixed(3), (cal.yaw||0).toFixed(5),
               (cal.pitch||0).toFixed(5), (cal.roll||0).toFixed(5)].join(',');
  if(_faceAlignCache.has(sig)) return _faceAlignCache.get(sig);
  let fit = null;
  try{
    const fm = getFaceMetrics();
    if(fm){
      const P = [], Q = [];
      for(let i=0; i<raw.length; i+=4){          // 468 → 표본 117개
        const p = raw[i]; if(!p) continue;
        let w = null;
        try{ w = projectImagePointToHead(angle, p.x, p.y, fm.widthFactor, fm.heightFactor); }catch(e){}
        if(!w) continue;                          // 두상 밖 — 왕복 정의가 없다
        const pr = project3DPointToView(w, cal, m.yTop, m.CY);
        if(!isFinite(pr.ix) || !isFinite(pr.iy)) continue;
        P.push([p.x*maskW, p.y*maskH]); Q.push([pr.ix, pr.iy]);
      }
      if(P.length >= 12) fit = _fitSimilarity2D(P, Q);
      if(fit) fit.n = P.length;
    }
  }catch(e){ fit = null; }
  if(_faceAlignCache.size > 32) _faceAlignCache.clear();
  _faceAlignCache.set(sig, fit);
  return fit;
}
/* 안전레일은 <b>캐시 밖</b>에서 본다 — 손잡이(alignMaxShift·alignScale)는 콘솔에서
   만지는 값인데 서명에 안 들어 있다. 안에서 판정하면 값을 바꿔 놓고 "안 바뀐다"고
   헤매게 된다(이 파일이 probeCache 주석에 이미 적어 둔 그 함정). */
function faceLineAlignUsable(fit, maskW){
  if(!fit) return false;
  const lim = maskW * FACE_GATE.alignMaxShift;
  const [s0, s1] = FACE_GATE.alignScale;
  return isFinite(fit.tx) && isFinite(fit.ty) && isFinite(fit.s)
      && Math.abs(fit.tx) <= lim && Math.abs(fit.ty) <= lim
      && fit.s >= s0 && fit.s <= s1;
}

function makeFaceSilhouette(angle, maskW, maskH){
  try{
    const lmi = state.landmarks && state.landmarks[angle];
    const raw = lmi && lmi.rawLandmarks;
    if(!raw || raw.length < 468) return null;
    /* 사진 좌표 → 투영 좌표. fit이 없거나 안전레일에 걸리면 예전대로 사진 좌표. */
    const fit = faceLineAlignFit(angle, maskW, maskH, raw);
    const use = faceLineAlignUsable(fit, maskW);
    const th = use ? fit.deg * Math.PI/180 : 0;
    const cs = use ? Math.cos(th)*fit.s : 1, sn = use ? Math.sin(th)*fit.s : 0;
    const tx = use ? fit.tx : 0, ty = use ? fit.ty : 0;
    const all = [];
    for(const p of raw){
      if(!p || !isFinite(p.x) || !isFinite(p.y)) continue;
      const px = p.x * maskW, py = p.y * maskH;
      all.push({ x: cs*px - sn*py + tx, y: sn*px + cs*py + ty });
    }
    if(all.length < 100) return null;
    const P = _convexHull2D(all);
    if(P.length < 3) return null;
    const H = Math.max(2, Math.round(maskH));
    const lo = new Float32Array(H).fill(Infinity);
    const hi = new Float32Array(H).fill(-Infinity);
    let yMin = Infinity, yMax = -Infinity, xMin = Infinity, xMax = -Infinity;
    for(const p of P){
      if(p.y < yMin) yMin = p.y; if(p.y > yMax) yMax = p.y;
      if(p.x < xMin) xMin = p.x; if(p.x > xMax) xMax = p.x;
    }
    if(!(yMax > yMin) || !(xMax > xMin)) return null;
    for(let k=0; k<P.length; k++){
      const a = P[k], b = P[(k+1) % P.length];
      const dy = b.y - a.y;
      if(Math.abs(dy) < 1e-6){                       // 수평 변 — 그 행에 양 끝만
        const iy = Math.round(a.y);
        if(iy >= 0 && iy < H){
          lo[iy] = Math.min(lo[iy], a.x, b.x);
          hi[iy] = Math.max(hi[iy], a.x, b.x);
        }
        continue;
      }
      const y0 = Math.max(0, Math.ceil(Math.min(a.y, b.y)));
      const y1 = Math.min(H-1, Math.floor(Math.max(a.y, b.y)));
      for(let y=y0; y<=y1; y++){
        const x = a.x + (b.x - a.x) * ((y - a.y) / dy);
        if(x < lo[y]) lo[y] = x;
        if(x > hi[y]) hi[y] = x;
      }
    }
    const iyTop = Math.max(0, Math.round(yMin));
    const iyBot = Math.min(H-1, Math.round(yMax));
    // 빈 행 메움(꼭짓점에 딱 걸려 교차를 못 잡은 행)
    for(let y=iyTop; y<=iyBot; y++){
      if(hi[y] >= lo[y]) continue;
      let a = y-1; while(a >= iyTop && !(hi[a] >= lo[a])) a--;
      let b = y+1; while(b <= iyBot && !(hi[b] >= lo[b])) b++;
      if(a >= iyTop && b <= iyBot){
        const t = (y - a) / (b - a);
        lo[y] = lo[a] + (lo[b] - lo[a]) * t;
        hi[y] = hi[a] + (hi[b] - hi[a]) * t;
      } else if(a >= iyTop){ lo[y] = lo[a]; hi[y] = hi[a]; }
      else if(b <= iyBot){   lo[y] = lo[b]; hi[y] = hi[b]; }
    }
    // 턱 아래 연장 — 마지막 유효 행의 폭을 아래로 이어 내린다(살짝 좁히면서)
    const faceH = yMax - yMin;
    const extBot = Math.min(H-1, Math.round(yMax + faceH * FACE_GATE.chinExtend));
    for(let y=iyBot+1; y<=extBot; y++){
      const t = (y - iyBot) / Math.max(1, extBot - iyBot);
      const c = (lo[iyBot] + hi[iyBot]) / 2, hw = (hi[iyBot] - lo[iyBot]) / 2 * (1 - 0.35*t);
      lo[y] = c - hw; hi[y] = c + hw;
    }
    const inset = (xMax - xMin) * FACE_GATE.inset;
    // 얼굴이 향한 방향(+1=오른쪽) — 진단·디버그 표시용
    const nose = raw[1], eL = raw[234], eR = raw[454];
    const dir = (nose && eL && eR) ? ((nose.x - (eL.x + eR.x)/2) >= 0 ? 1 : -1) : 0;
    return {
      dir, poly: P, yTop: iyTop, yBot: extBot, w: xMax - xMin, h: faceH,
      fit: fit ? { tx: fit.tx, ty: fit.ty, s: fit.s, rms: fit.rms,
                   n: fit.n, used: use } : null,
      lo, hi, inset,
      /* 이 점이 <b>얼굴 안</b>인가 — 마스크 좌표(pr.ix, pr.iy). */
      covers(ix, iy){
        const y = Math.round(iy);
        if(y < this.yTop || y > this.yBot) return false;
        const l = lo[y], h = hi[y];
        if(!(h > l)) return false;
        return ix > l + inset && ix < h - inset;
      },
    };
  }catch(e){ return null; }
}

/* ── 끊긴 가닥 누산기 ─────────────────────────────────────────────────
   재는 것은 <b>구멍</b>이지 지워진 점 전체가 아니다. 끝이 잘린 가닥은 짧아질
   뿐 화면에서 안 이상하다 — 이상한 것은 <b>보이는 구간 사이에 낀 빈 칸</b>과
   그 뒤에 남은 조각이고, 사용자가 "뜯겨져 있다"고 말한 게 그것이다.
   그래서 runs.length ≥ 2 인 가닥만 세고, 각 구멍을 <b>그 안의 점들이 어느
   문에 지워졌는지</b>로 귀속시킨다. 사유가 섞이면 제일 많은 문에 준다. */
function newGapAcc(){
  return { strands:0, holes:0, pts:0, byReason:new Array(GAP_REASON.length).fill(0),
           bySec:Object.create(null), frag:[],
           allPts:0, allByReason:new Array(GAP_REASON.length).fill(0) };
}
/* ── 지워진 점 <b>전수</b> 귀속 (2026-09-06 3차) ─────────────────────────────
   위 tallyStrandGaps는 <b>구멍</b>만 센다(runs≥2). 그런데 실기기 로그가
   "[끊긴 가닥] 구멍 87칸 · 빈 점 477 / 가림 트리밍 45%(점 34290/76645)"였다 —
   지워진 34290점 중 사유가 적힌 것은 477점뿐이고, 나머지는 구멍이 아니라 잘린
   <b>꼬리</b>라 아무도 안 세고 있었다. "정면에서 목 옆 뒷머리가 안 보인다" 같은
   증상은 정확히 그 꼬리 쪽이라, 세지 않는 한 문 다섯 중 누구인지 못 가른다.
   비용은 점당 배열 증가 하나. 끄기: GAP_DIAG.on = false */
function tallyHiddenPoints(acc, vpt, rsn){
  if(!acc || !rsn) return;
  for(let i=0;i<vpt.length;i++){
    acc.allPts++;
    if(!vpt[i]) acc.allByReason[(rsn[i] || 0)]++;
  }
}
function tallyStrandGaps(acc, runs, vpt, rsn, ipts, sec){
  if(runs.length < 2) return;
  let counted = 0;
  for(let k=1; k<runs.length; k++){
    /* ⚠ 구간 경계를 그대로 빼면 안 된다 — visibleRuns는 <b>양 끝 중 하나라도</b>
       보이면 그 선분을 그리므로, 각 구간이 안 보이는 점을 하나씩 물고 있다.
       그래서 두 구간의 끝점까지 포함해 훑되 <b>실제로 지워진 점만</b> 센다
       (그냥 인덱스 차를 쓰면 두 점짜리 구멍이 0으로 나온다 — 하네스에서 잡혔다). */
    const s = runs[k-1][1], e = runs[k][0];
    let n = 0;
    const tally = new Array(GAP_REASON.length).fill(0);
    for(let i=s; i<=e; i++){
      if(vpt[i]) continue;
      n++; tally[(rsn && rsn[i]) || 0]++;
    }
    if(n < GAP_DIAG.minGap) continue;
    counted++;
    acc.holes++; acc.pts += n;
    let best = 0, bn = 0;                              // 사유가 섞이면 제일 많은 문에 준다
    for(let r=1; r<tally.length; r++) if(tally[r] > bn){ bn = tally[r]; best = r; }
    acc.byReason[best]++;
    /* 대표 조각 — 구멍 <b>뒤에</b> 남은 구간의 시작점. 화면에서 "여기 떠 있다"고
       짚을 수 있는 좌표가 있어야 로그와 눈이 만난다. */
    if(acc.frag.length < GAP_DIAG.topN){
      const f = ipts[runs[k][0]];
      acc.frag.push({ sec, r:best, len:(runs[k][1]-runs[k][0]+1),
                      x:Math.round(f.x), y:Math.round(f.y) });
    }
  }
  if(counted){
    acc.strands++;
    acc.bySec[sec] = (acc.bySec[sec] || 0) + counted;
  }
}
/* 로그 한 덩어리. 구멍이 0이면 <b>한 줄만</b> 찍는다 — 정상일 때 콘솔을 채우면
   비정상일 때 눈에 안 띈다. */
function gapDiagText(acc, drawn){
  if(!acc) return '';
  const gates = []
    .concat(mqGeomTrusted() ? ['마네킹 신뢰 ON — 닫힌 문: '
        + [MQ_TRUST.faceGate&&'얼굴게이트', MQ_TRUST.faceEllipse&&'얼굴타원',
           MQ_TRUST.photoClip3D&&'점유재클립', MQ_TRUST.photoClip2D&&'2D클립',
           MQ_TRUST.bodyShadow&&'몸그림자폴백'].filter(Boolean).join('·')]
      : ['마네킹 신뢰 OFF(촬영 가닥 모델 — 사진 안전망 그대로)']);
  /* 지워진 점 전수 — 구멍이 없어도 찍는다. "가림 트리밍 45%"의 내역이 이것이고,
     그 대부분은 구멍이 아니라 잘린 꼬리라 아래 [끊긴 가닥]에는 안 잡힌다. */
  let all = '';
  if(acc.allPts){
    const hid = acc.allByReason.reduce((s,n,r)=> r ? s+n : s, 0);
    const by = acc.allByReason.map((n,r)=> (r && n) ? `${GAP_REASON[r]} ${n}` : null)
                 .filter(Boolean).join(' · ');
    all = `\n    [지운 점 전수] ${hid}/${acc.allPts}점(${Math.round(hid/acc.allPts*100)}%)`
        + `\n      문별: ${by || '없음'}`;
  }
  if(!acc.holes) return all + `\n    [끊긴 가닥] 없음 (${gates[0]})`;
  return all + gapHolesText(acc, drawn, gates);
}
function gapHolesText(acc, drawn, gates){
  const secs = Object.keys(acc.bySec).sort((a,b)=>acc.bySec[b]-acc.bySec[a])
                 .map(k=>`${k} ${acc.bySec[k]}`).join(' · ');
  const rs = acc.byReason.map((n,r)=> n ? `${GAP_REASON[r]} ${n}` : null)
               .filter(Boolean).join(' · ');
  return `\n    [끊긴 가닥] ${acc.strands}개(그린 가닥의 ${drawn?Math.round(acc.strands/drawn*100):0}%)`
       + ` · 구멍 ${acc.holes}칸 · 빈 점 ${acc.pts}`
       + `\n      구멍을 낸 문: ${rs || '사유 미기록'}`
       + `\n      섹션: ${secs}`
       + acc.frag.map(f=>`\n      떠 있는 조각 — ${f.sec} · 사진좌표(${f.x},${f.y}) · ${f.len}점 · 앞의 구멍은 ${GAP_REASON[f.r]}`).join('')
       + `\n      ${gates[0]}`
       + `\n      제일 큰 문 하나를 끄고 다시 그려 보십시오(슬라이더를 살짝 움직이면 다시 그립니다).`
       + ` 끄기: GAP_DIAG.on=false`;
}

/* 이 가닥이 <b>카메라 반대쪽에서 난</b> 가닥인가 — 얼굴 게이트를 걸 대상.
   rootDepth는 project3DPointToView가 뿌리에 대해 준 lz(두상 중심 기준). */
function strandIsFarSide(rootDepth){
  let eps = 0;
  try{ const E = getDisplaySkullEllipsoid(); if(E && E.c > 0) eps = E.c * FACE_GATE.rootEps; }catch(e){}
  return rootDepth < -eps;
}

/* 얼굴 게이트를 점별 보임 배열에 적용한다. 지우기만 하고 되살리지 않는다.
   돌려주는 값은 <b>새로 지운 점 수</b>(vis 보정용).

   ── (2026-09-06) 구멍이 아니라 <b>끊기</b>다 — 떠 있는 조각의 정체 ──────────
   사용자: "사이드헤어와 템플헤어가 뜯겨져 있듯이 중간에 빈 곳이 보인다."

   9/04가 이 게이트를 넣을 때의 설계는 <b>구멍 뚫기</b>였다(15-project-3d.js
   호출부 주석): "지운 구간은 visibleRuns가 알아서 끊어 주므로, 가닥은 얼굴
   앞에서 사라졌다가 반대편 윤곽선 너머에서 다시 나온다." 정면을 머리에 두고
   쓴 문장이고, 정면에서는 맞다 — 얼굴 윤곽선 <b>바깥</b>이 곧 머리통 옆이라
   거기 다시 나오는 게 실제로 옳다.

   측면에서는 그 문장이 성립하지 않는다. makeFaceSilhouette의 볼록껍질은
   <b>코(가장 앞)부터 귀 앞(가장 뒤)까지</b>다(그 함수 배너에 그렇게 적혀
   있다). 그러니 "반대편 윤곽선 너머"는 <b>코 앞의 허공</b>이다. 머리통이
   없는 자리이고, 거기 다시 나온 꼬리가 얼굴 옆에 <b>혼자 떠 있는 가닥
   조각</b>이 된다. 화면에서 본 것이 정확히 그것이다:
     · left 45  — 코 앞 허공에 세로로 긴 가닥 한 줄이 본체와 떨어져 떠 있다
     · right 45 — 턱선 아래(chinExtend 밖)에 네모난 조각이 따로 남는다
   즉 <b>중간이 지워진 게 증상이고, 꼬리가 남은 게 원인</b>이다.

   ── 왜 잘라도 되는가(새 상수 없음) ──────────────────────────────────────
   이 게이트가 걸리는 대상은 이미 <b>뿌리가 카메라 반대쪽인 가닥</b>뿐이다
   (strandIsFarSide). 반대편에서 난 가닥이 얼굴에 <b>가려졌다</b>면, 그
   앞쪽 구간은 둘 중 하나다:
     ① 계속 얼굴·머리 뒤 — 어차피 안 보인다
     ② 얼굴을 지나 이쪽으로 나온다 — 그러려면 <b>머리를 통과</b>해야 한다
   ②는 물리적으로 없다. 그래서 "처음 막힌 점부터 끝까지"를 지우는 것이
   구멍 뚫기보다 규칙이 강하고, 판정에 쓰는 값도 지금 있는 것뿐이다.
   가까운 쪽 가닥(앞머리·이쪽 옆머리)은 이 함수에 들어오지도 않으므로
   얼굴을 덮는 정상 시술은 그대로다.
   되돌리기: FACE_GATE.cutTail = false (9/04와 글자 그대로 같은 동작) */
function applyFaceGate(vpt, ipts, faceSil, rootDepth, rsn){
  if(!FACE_GATE.on || !faceSil || !strandIsFarSide(rootDepth)) return 0;
  let cut = 0, hit = -1;
  for(let i=0; i<vpt.length; i++){
    /* 처음 막힌 자리는 <b>이미 안 보이던 점</b>에서도 센다 — 가닥이 얼굴로
       들어간 사실은 그 점이 그려졌는지와 무관하다(두개골 뒤라 안 보이던
       구간에서 얼굴로 들어가는 경우가 측면에서는 오히려 흔하다). */
    if(faceSil.covers(ipts[i].x, ipts[i].y)){
      if(hit < 0) hit = i;
      if(vpt[i]){ vpt[i] = false; cut++; if(rsn) rsn[i] = 5; }
    }
  }
  if(FACE_GATE.cutTail && hit >= 0){
    for(let i=hit+1; i<vpt.length; i++){ if(vpt[i]){ vpt[i] = false; cut++; if(rsn) rsn[i] = 5; } }
  }
  return cut;
}


// (11차) 중력 처짐 — 실제 펌: 로드로 감은 뒤 풀면 자체 무게로 끝이 아래로 늘어짐.
// 사용자: "그렇게 된 다음에 적절한 중력이 작용." 컬 나선 위에 얹는 마지막 단계.
// 뿌리 고정, 끝으로 갈수록 가속 처짐(t²). 컬 강할수록 탱탱하게 덜 처짐(hold).
const GRAV3D_STRENGTH = 0.35; // 중력 처짐 세기(튜닝 지점) — 호길이 대비 최대 처짐 비율
/* 뿌리 고정 변형 (2026-08-02 통합) — 중력 처짐·볼륨 리프트·결 흐름 세 연산자가
   "0번 점(뿌리)은 그대로 두고 나머지를 옮긴다"는 같은 골격을 각자 적고 있었다.
   at(점, t=i/n, i, n)이 그 자리의 새 점을 돌려준다. */
function mapStrandFromRoot(pts, at){
  const n = pts.length - 1;
  const out = [pts[0]];
  for(let i=1;i<pts.length;i++) out.push(at(pts[i], i/n, i, n));
  return out;
}

/* ── 처짐도 컬 0에서 <b>0이어야 한다</b> (2026-08-18 k) ─────────────────────
   두 번째 불연속이 여기 있었다. 이 함수는 curlAmt>0일 때만 불리는데, 들어오는
   순간 세기가 <b>최대</b>다(hold = 1 − 0.6·0 = 1). 그래서 컬을 0→1로 올리는
   한 칸에서 끝이 호길이의 0.35만큼 <b>뚝 떨어졌다</b>. 위 나선 불연속과 같은
   방향(길게·아래로)이라 둘이 겹쳐 보였다.
   처짐은 "<b>감았다 푼</b> 머리가 자기 무게로 늘어지는 것"이므로 시술량에
   비례해야 한다 → curlT를 곱한다. hold(강한 컬일수록 탱탱해 덜 처짐)는 그대로.
   그래서 처짐은 0에서 시작해 컬 ~83에서 가장 크고 다시 줄어든다 — 약한 펌이
   제일 늘어지고 강한 펌이 탱탱하다는 실제와 맞는다.
   되돌리기: CURL3D_FIX.droopWithCurl = false. */
function gravityDroop3D(pts, curlAmt){
  if(!pts || pts.length < 3) return pts;
  const arc = arcLength3D(pts);
  if(arc < 1e-5) return pts;
  const curlT = Math.max(0, Math.min(100, curlAmt))/100;
  const hold = 1 - 0.6 * curlT;                       // 강한 컬=덜 처짐(0.4~1)
  const amt = CURL3D_FIX.droopWithCurl ? curlT * hold : hold;
  if(!(amt > 0)) return pts;
  return mapStrandFromRoot(pts, (p, t)=>{
    const sag = GRAV3D_STRENGTH * arc * t * t * amt;  // 끝으로 갈수록 가속(t²) 아래로
    return { x: p.x, y: p.y - sag, z: p.z };
  });
}

/* ──────────────────────────────────────────────────────────────────
   가르마(파팅) — 두피 표면 방향장 (2026-07-26)
   ────────────────────────────────────────────────────────────────
   기존 구현의 문제(하네스 styling-test.html로 확인):
     partBias = stPart * 0.30 * max(0, 1-prog*2)  ← 이미지 평면 각도 바이어스
   이건 "모든 가닥을 화면에서 같은 쪽으로 민다"라, 가르마가 아니라 머리 전체가
   한쪽으로 쏠리는 동작이었다. 사용자 지적: "가르마는 그 선을 중심으로 좌우로
   머리결이 반대가 되어야 하는데 그런 동작이 안 나온다" — 맞음. 원리적으로 못 나옴.

   올바른 정의: 가르마는 정수리를 넘어가는 대원(great circle)이고, 그 면을 기준
   으로 양쪽 머리가 서로 반대 방향으로 갈라진다.
     · 분할선 방위각 φp (part -100~100 → ∓60°)
     · 분할면 법선  m = (cos φp, 0, -sin φp)   (Y축을 포함하는 평면)
     · 어느 쪽인가  sign(P·m)  → 그 부호대로 ±m 방향으로 쓸려감
     · 두피 접선 성분만 사용(법선 성분 제거) — 두피를 파고들지 않게. 이 투영이
       "두피에 수직인 방향으론 못 쓸어감"을 자동 처리한다(예외 코드 불필요).
     · 감쇠: 분할선에서 멀수록(SIGMA), 귀 쪽으로 내려갈수록(topness) 약해지고,
       뿌리에서 강하고 끝은 중력에 맡긴다(DECAY).
     · 컬이 셀수록 빗질이 덜 먹는다(combable) — 곱슬은 갈라도 다시 부푼다.

   좌표 규약: 두상 공간 +Z=얼굴 앞, +Y=위, 중심 y=0.15 (projectImagePointToHead
   와 동일). φ = atan2(x, z) → 0=얼굴 정중앙, ±π=뒤통수.
   이 함수 하나가 3D 경로(computeAdjustedHair3DStrands)와 2D 경로
   (traceStrandPath)의 공통 출처다 — 두 경로가 다른 가르마를 그리지 않도록.
────────────────────────────────────────────────────────────────── */
const PART3D = {
  AMP:   0.13, // 두상 반경 대비 최대 이동량(튜닝 지점)
  SIGMA: 1.1,  // (구) <b>방위각</b> 기준 감쇠 폭. DIST=true면 안 쓴다 — 아래 배너
  /* ── 가르마가 <b>일자로 안 잡히던</b> 이유 (2026-08-30 2차) ────────────────
     사용자: "가르마가 일자로 형성이 안되는 것 같아."
     게이트가 <b>분할면까지의 거리</b>가 아니라 <b>방위각</b>이었다:
         d = atan2(x,z) − φP ;  near = exp(−(d/1.1)²)
     방위각은 정수리로 갈수록 <b>퇴화</b>한다. 꼭대기에서는 아주 조금만 움직여도
     atan2가 크게 튀고, 적도 근처에서는 많이 움직여야 조금 변한다. 그래서 같은
     near 값이 곧 같은 거리가 아니다. 하네스 실측(part=0, 세기 100 / 대괄호는
     [분할면까지 <b>실제</b> 각거리 → 그 자리의 가르마 세기]):
         정수리(elev85°) : [0°→1.00] [2°→0.92] [ 3°→0.71] [ 5°→0.31]
         이마 (elev20°) : [0°→0.33] [19°→0.29] [37°→0.19] [62°→0.05]
     즉 <b>선이 아니라 부채꼴</b>이다 — 정수리에서 한 점으로 모였다가 이마로
     내려오며 60°까지 벌어진다. 게다가 세기까지 1.00 → 0.33으로 떨어져서,
     <b>실제로 보이는 앞머리 쪽이 제일 약하다</b>. 8/26에 "선이 안 보이는 이유는
     머리가 떠서"라고 적었고 8/30 1차에 "넘김이 덮어써서"를 더했는데,
     선의 <b>모양</b> 자체가 틀린 건 이번이 처음 잡힌 것이다.

     고침: 두상 비율을 벗긴 <b>정규화 구면</b>에서 분할면까지의 각거리로 잰다.
       · 게이트   near = exp(−(gd/SIGMA_D)²),  gd = asin(û·m̂)
       · 어느 편  side = sign(û·m̂)            ← 같은 양을 쓴다(예전엔 따로였다)
     이러면 폭이 선 전체에서 <b>일정</b>하고, 세기도 정수리~이마가 같다.
     앞뒤 범위는 따로 끊는다 — 예전엔 near가 d=π에서 저절로 0이 되며 뒤통수를
     막아 줬는데, 거리 기준은 대원 전체가 gd=0이라 <b>뒤통수까지 갈라진다</b>.
     되돌리기: PART3D.DIST = false (예전 방위각 게이트 — 산술까지 동일) */
  DIST:    true,
  SIGMA_D: 0.35, // 분할면까지의 각거리 감쇠 폭(rad ≈20°) — 선 전체에서 <b>일정</b>
  /* ── 그래도 <b>일자가 아니었다</b> — 선이 정수리로 모인다 (2026-08-30 3차) ──
     사용자: "가르마가 저런 식으로 <b>일자로</b> 나오지 않았어." (타겟 4뷰 사진)
     8/30 2차는 선의 <b>폭</b>을 고른게 만들었다(표준편차 7.20°→0.93°). 그런데
     선의 <b>자리</b>는 안 봤다. 분할면이 m=(cos φP, 0, −sin φP)로 <b>Y축을 품는</b>
     평면이라, 구면과의 교선이 항상 <b>극(정수리)을 지나는 대원</b>이다. 즉 어떤
     φP를 줘도 선은 꼭대기 한 점으로 모인다 — 부챗살이지 일자가 아니다.
     하네스(part=60, 선의 자취를 고도별로 추적 · ux = 정규화 가로 위치):
       고도 15/25/35/45/55/65/75/85° →
         −0.699 · −0.634 · −0.573 · −0.495 · −0.401 · −0.296 · −0.181 · <b>−0.061</b>
     이마에서 귀 쪽 −0.70이던 선이 정수리에서 <b>−0.06(정중앙)</b>까지 걸어온다.
     실제 가르마는 이렇게 안 생긴다 — 앞머리선에서 뒤로, <b>정중앙에서 같은 거리</b>를
     유지하며 나아가다 정수리 못 미쳐 사라진다(타겟 후면 사진이 그렇다).

     고침: 분할면을 <b>정시상면에 나란한 채로 옆으로 밀어</b> 놓는다.
       · 법선 p̂ = (1,0,0) 고정 — 면이 앞뒤로 곧게 서므로 교선이 <b>일자</b>다
       · 슬라이더 part는 각도가 아니라 <b>옆으로 민 거리</b>(off)를 말한다
       · 게이트 gd = |acos(û·p̂) − acos(off)|  ← 소원(小圓)까지의 <b>정확한</b> 각거리
       · 어느 편 side = sign(û·p̂ − off)       ← 게이트와 같은 양(2차의 규약 유지)
     part는 원래 <b>위치</b>를 뜻하는 손잡이였으므로(2026-08-18 k) 뜻이 바뀌는 게
     아니라 <b>제대로 구현</b>되는 것이다. 각도로 밀던 것을 거리로 민다.
       → 고도 20~55°에서 ux −0.560 → −0.540 (흔들림 0.0818 → <b>0.0051</b>)
     ⓘ 이 모델은 분할면이 두상을 안 지나는 높이 위로는 가르마를 <b>안 만든다</b>
       (part 60이면 고도 57° 위). 그게 맞다 — 가르마는 정수리를 안 넘는다.
       part 20/40/60/80/100 → 끝나는 고도 89/85/74/60/42°.
     ⓘ part=0(중간 가르마)은 off=0이라 예전 대원과 <b>같은 면</b>이다. 하네스에서
       두 모드 최대 차이 <b>0.00e+0</b>(비트 단위 동일).
     되돌리기: PART3D.OFFSET = false (그러면 8/30 2차의 대원 게이트로 돌아간다) */
  OFFSET: true,
  /* ── MAXOFF 0.90은 <b>슬라이더 위쪽을 죽였다</b> (2026-08-30 4차) ──────────
     0.90이면 part=100에서 분할면이 두상을 스치기만 해서, 가르마가 고도 26°
     아래에만 남는다. 그런데 그 아래는 topness 차단(TOP_LO .10~TOP_HI .32,
     = 고도 5.7~18.7°)이 걸리는 구간이라 선이 거의 통째로 사그라진다.
     하네스(세기 90 · 가닥 전체 평균 이동):
       part  20 →  9.64 · 40 → 8.42 · 60 → 6.56 · 80 → 4.24 · 100 → <b>1.66</b>
     즉 오른쪽으로 밀수록 가르마가 <b>없어진다</b> — 위치 손잡이인데 세기가
     같이 죽는 것이고, 사용자가 말한 "수치가 다 안 먹는" 자리다.
     선이 topness 차단 위에 넉넉히 살려면 선의 꼭대기 acos(off)가 45° 이상이어야
     하고, 그게 off ≲ 0.71이다. 0.65에서 part=100이 중앙 대비 <b>53%</b>를 지킨다.
     ⚠ 자리 뜻이 바뀌므로 STYLE_SPECS의 part도 같이 환산했다(아래 스펙 주석). */
  MAXOFF: 0.65, // 슬라이더 ±100 → 정규화 구면에서 옆으로 ∓0.65 (관자놀이 앞)
  FRONT:      -0.10, // 선을 따르는 좌표(û·f̂: +1 이마 · 0 정수리 · −1 뒤통수).
  FRONT_SOFT:  0.35, // 이 지점부터 뒤로 이만큼에 걸쳐 사그라진다(정수리 살짝 뒤에서 끝)
  /* ── topness도 같이 범인이었다 ────────────────────────────────────────
     topness = sin(고도)라 <b>선을 따라 세기가 기울어진다</b>: 정수리 1.00,
     이마 0.33. 위 실측표의 세로 방향 차이가 방위각이 아니라 이것이었다.
     원래 뜻은 "귀 밑은 가르마가 없다"는 <b>차단</b>인데 진폭으로 쓰이고 있었다.
     그래서 차단으로 되돌린다 — LO 아래는 0, HI 위는 1, 사이는 선형. */
  TOP_LO: 0.10,
  TOP_HI: 0.32,
  RAMP:  0.35, // 뿌리에서 이 비율까지 꺾이며 벌어짐(결이 꺾이는 구간)
  TAIL:  0.6,  // 램프 이후에도 계속 벌어지는 정도 — 0이면 평행 이동만 되어
               // "밀렸을 뿐 안 갈라진" 느낌이 남는다(결이 갈라져 보이는 핵심)
  MAXPHI: 60,  // 슬라이더 ±100 → ∓60°
  TURN: 0.8,   // 최대 회전 비율(넘김은 1.0 — 가르마는 그만큼 완전히 돌지 않는다)
  GAMMA: 1.2,  // 가르마 <b>세기</b> 슬라이더 응답 — 선형 이탈 8.9%p→<b>3.0%p</b>
};
/* ── <b>중간 가르마</b>가 안 되던 이유 (2026-08-18 k) ──────────────────────
   사용자: "중간가르마 자체가 안되는듯."

   수식은 <b>이미 맞았다</b>. partVal=0이면 phiP=0이고, 그때 분할면 법선은
   m=(1,0,0)이라 side=sign(x) — 정확히 <b>좌우로 갈리는 정중앙 가르마</b>다.
   막고 있던 건 첫 줄의 가드 하나였다:
       if(!root || !partVal) return null;      ← 0을 "가르마 없음"으로 읽는다
   즉 슬라이더의 <b>중앙</b>이 "가장 흔한 가르마"가 아니라 "가르마 안 함"이었다.
   0을 두 가지 뜻으로 쓰던 것이고, 이 파일이 컬에서 겪은 것과 같은 모양이다
   (컬 0 = 펌 안 함은 맞지만, 가르마 0 = 가르마 없음은 <b>틀리다</b>).

   고침: 세기를 <b>따로</b> 뺀다. part = 가르마 <b>위치</b>(−100 좌 · 0 중앙 · +100 우),
   partAmt = 가르마 <b>세기</b>(0 = 안 함). 기본 partAmt=0이라 예전과 동작이 같고,
   올리는 순간 위치대로 갈라진다 — 0에서도 갈라진다.
   ⚠ STYLE_SPECS에 partAmt가 없으면 0이 되어 프리셋 동작도 예전 그대로다. */
// 뿌리 좌표(두상 공간) → 가르마가 만드는 이동 벡터(두상 공간). 없으면 null.
function partingPushHead(root, partVal, curlAmt, partAmt){
  /* 세기도 감마를 먹인다(sliderResponse 배너 참고) — 0과 100은 그대로다. */
  const amt = sliderResponse(Math.max(0, Math.min(100, (typeof partAmt === 'number') ? partAmt : 0)),
                             PART3D.GAMMA);
  if(!root || !(amt > 0)) return null;
  const phiP = (-partVal/100) * (PART3D.MAXPHI*Math.PI/180); // 슬라이더 +=우측 가르마
  /* 분할면 법선. OFFSET 모드에서는 면을 <b>기울이지 않고 옆으로 미는</b> 것이므로
     법선이 정시상면 그대로다 — 그래야 갈라지는 방향이 선에 수직인 <b>가로</b>가
     된다(선이 앞뒤로 곧게 서 있으니 머리는 좌우로 떨어진다). */
  const mx = PART3D.OFFSET && PART3D.DIST ? 1 : Math.cos(phiP);
  const mz = PART3D.OFFSET && PART3D.DIST ? 0 : -Math.sin(phiP);
  const x = root.x, y = root.y - 0.15, z = root.z;           // 두상 중심 기준
  const horiz = Math.hypot(x, z);
  const topness = Math.max(0, y) / Math.max(1e-6, Math.hypot(y, horiz)); // 정수리1 귀0
  if(topness < 0.02) return null;
  const E = getHeadEllipsoid();
  let near, side, along = 1, sd = 0, gd = 0;
  if(PART3D.DIST){
    /* 정규화 구면(두상 비율을 벗긴 단위구)으로 옮겨서 잰다 — 거기서만
       "분할면까지의 거리"가 방향에 상관없이 같은 뜻을 갖는다. */
    let ux = x/E.a, uy = y/E.b, uz = z/E.c;
    const ul = Math.hypot(ux, uy, uz) || 1; ux/=ul; uy/=ul; uz/=ul;
    let px, pz, fx, fz;
    if(PART3D.OFFSET){
      /* 분할면을 <b>옆으로 민다</b>: 법선은 정시상면 그대로(1,0,0)이고
         part는 미는 거리다. 면이 앞뒤로 곧게 서므로 교선이 일자다. */
      px = 1; pz = 0; fx = 0; fz = 1;                        // f̂ = 앞(+Z)
      const off  = Math.max(-0.98, Math.min(0.98, (-partVal/100) * PART3D.MAXOFF));
      const cosA = Math.max(-1, Math.min(1, ux*px + uz*pz));
      sd = cosA - off;                                       // 0 = 분할선 위
      /* 소원까지의 각거리는 두 극각의 차다(같은 자오선을 따라 재므로 정확).
         asin(|sd|)로 재면 off≠0에서 어긋난다 — 거긴 대원이 아니다. */
      gd = Math.abs(Math.acos(cosA) - Math.acos(off));
    }else{
      px = mx*E.a; pz = mz*E.c;
      const pl = Math.hypot(px, pz) || 1; px/=pl; pz/=pl;
      sd = Math.max(-1, Math.min(1, ux*px + uz*pz));         // 0 = 분할선 위
      gd = Math.asin(Math.abs(sd));                          // 분할면까지 각거리(rad)
      /* 선을 따르는 좌표 — f̂는 이마쪽 선 방향. p̂와 직교화해서 쓴다. */
      fx = Math.sin(phiP); fz = Math.cos(phiP);
      const fp = fx*px + fz*pz; fx -= px*fp; fz -= pz*fp;
      const fl = Math.hypot(fx, fz) || 1; fx/=fl; fz/=fl;
    }
    near = Math.exp(-(gd/PART3D.SIGMA_D)*(gd/PART3D.SIGMA_D));
    side = sd >= 0 ? 1 : -1;                                 // 게이트와 <b>같은 양</b>
    const t = ux*fx + uz*fz;                                 // +1 이마 · 0 정수리 · −1 뒤통수
    along = Math.max(0, Math.min(1, (t - (PART3D.FRONT - PART3D.FRONT_SOFT)) / PART3D.FRONT_SOFT));
    near *= along;
    // topness를 진폭이 아니라 <b>차단</b>으로 (위 배너)
    near *= Math.max(0, Math.min(1, (topness - PART3D.TOP_LO) / (PART3D.TOP_HI - PART3D.TOP_LO)));
  }else{
    const d = wrapPi(Math.atan2(x, z) - phiP);
    near = Math.exp(-(d/PART3D.SIGMA)*(d/PART3D.SIGMA));
    side = (x*mx + z*mz) >= 0 ? 1 : -1;                      // 분할면 어느 쪽인가
  }
  if(near * (PART3D.DIST ? 1 : topness) < 0.02) return null;   // DIST면 near에 이미 들어 있다
  // 두피 접선으로 투영
  let nx = x/(E.a*E.a), ny = y/(E.b*E.b), nz = z/(E.c*E.c);
  const nl = Math.hypot(nx, ny, nz) || 1; nx/=nl; ny/=nl; nz/=nl;
  const dx0 = side*mx, dz0 = side*mz;
  const dot = dx0*nx + dz0*nz;
  /* DIST 모드에서는 topness가 이미 near 안에 <b>차단</b>으로 들어가 있다.
     여기서 또 곱하면 예전의 "선을 따라 기울어지는 세기"가 그대로 돌아온다. */
  const topAmp = PART3D.DIST ? 1 : topness;
  const amp = PART3D.AMP * amt * near * topAmp * (1 - 0.5*Math.max(0,Math.min(100,curlAmt||0))/100);
  return { x:(dx0 - dot*nx)*amp, y:(-dot*ny)*amp, z:(dz0 - dot*nz)*amp };
}
/* 가닥 진행에 따른 가중치.
   ── (2026-07-26 수정) 감쇠 → 유지 ──
   처음엔 "가르마는 뿌리 근처 효과"라고 보고 올라갔다가 0으로 내려오는 프로파일
   (min(1,i/2)×max(0,1-t·1.5))을 썼다. 실기기 결과: 가르마 선은 보이는데 결이
   안 갈라짐(사용자 보고). 당연한 결과였다 — 나갔다가 제자리로 돌아오니 끝점
   변위가 0이라, 뿌리 근처만 벌어진 "혹"이 생길 뿐 가닥 방향은 그대로였다.
   실제 빗질은 뿌리에서 방향이 정해지면 그 아래 전체가 그 방향을 물려받는다.
   → 뿌리에서 RAMP 구간까지 꺾이며 벌어지고(결의 꺾임), 그 아래로도 TAIL 비율로
     계속 벌어진다. 유지만 하면(TAIL=0) 가닥들이 나란히 평행 이동할 뿐이라
     "밀렸을 뿐 안 갈라진" 모양이 된다 — 갈라져 보이려면 계속 벌어져야 한다. */
function combWeightAt(i, n, ramp, tail){
  if(i <= 0 || n <= 0) return 0;
  const t = i/n;
  return Math.min(1, t/ramp) + Math.max(0, t - ramp) * tail;
}

/* ══════════════════════════════════════════════════════════════════
   넘김(sweep) — 3D 이식 (2026-07-27)
   ─────────────────────────────────────────────────────────────────
   그동안 넘김 슬라이더는 값만 저장하고 아무것도 안 하는 상태였다(2D 경로에서
   걷어냈고 3D엔 아직 안 넣었음). 가르마와 같은 원리로 넣는다.

   가르마와의 차이 하나뿐: 가르마는 분할선 기준으로 <b>좌우가 반대로</b> 갈라지고,
   넘김은 머리 전체가 <b>한 방향</b>(뒤 또는 앞)으로 쓸린다. 그래서 ±부호 분기와
   분할선 감쇠(SIGMA·near)가 없고, 방향이 머리 기준 ∓Z 하나로 고정된다.

   두피 접선 투영은 그대로 쓴다 — 이게 "그 지점에서 그 방향으로 실제로 쓸려갈 수
   있는 정도"를 자동으로 만들어준다:
     · 정수리:   뒤(-Z)가 두피와 나란함 → 최대로 쓸림
     · 뒤통수 정중앙: 뒤(-Z)가 두피에 수직 → 접선 성분 0 → 안 쓸림(맞는 동작)
     · 이마:     뒤(-Z)가 두피를 따라 위로 넘어감 → 잘 쓸림
   예전 2D 구현은 화면 기준 가로 밀기였고, 그래서 정면에서 "밖으로 벌렸다
   오므렸다" 하는 변화로만 보였다(사용자 지적). 머리 기준 방향으로 바꾸면
   좌·우 뷰에서도 같은 "뒤로 넘김"이 된다.
══════════════════════════════════════════════════════════════════ */
/* ── 빗질 방향을 점마다 다시 구한다 (2026-07-27 해결) ──────────────────
   사용자: "헤어를 그냥 들어 올리는 게 아니고, 뒤쪽으로 넘긴다 치면 뒤쪽으로
   헤어가 들리는 동시에 <b>가볍게 휘어야</b> 돼. 그냥 일자 그대로 올라가는 게 아니고."
   원인은 <b>뿌리 한 점</b>에서 접선 방향을 한 번만 구해 가닥 전체를 같은 방향으로
   민 것이었다(가중치만 커짐). 방향이 끝까지 일정하니 "통째로 기울어진 직선"이 된다.

   고친 방식 — 점마다 적분한다:
     ① 지금까지 이동한 결과 위치에서 두피 법선을 다시 구하고
     ② 거기서 "뒤로"를 접선에 투영해 그 지점의 밀기 방향을 얻고
     ③ 그 구간의 가중치 <b>증가분</b>만큼만 밀어 누적한다
   가닥이 뒤로 갈수록 그 지점의 법선이 돌기 때문에 밀기 방향도 따라 돈다.
   그 누적이 곧 휨이다 — 곡률을 따로 만들어 넣지 않아도 기하에서 나온다.
   (같은 구조인 가르마도 함께 고쳤다. 볼륨은 법선 방향이라 해당 없고,
    결흐름은 끝단 회전이라 성격이 다르다 — 그 둘은 그대로 둔다.) */
const SWEEP3D = {
  TURN: 1.0,  // 100에서 결 방향을 빗질 방향으로 <b>완전히</b> 돌린다(뿌리부터 뒤를 봄)
  GAMMA: 1.6, // 슬라이더 응답(sliderResponse 배너) — 하네스에서 선형 이탈 18.6%p→<b>6.1%p</b>
  RAMP: 0.22, // 뿌리~이 비율에서 방향 전환이 끝난다. 크면 "끝만 넘어간" 모양이 된다
  TAIL: 0.6,  // 그 아래로도 계속(회전이라 이미 포화 — 램프 뒤 마무리 역할)
};
/* ══════════════════════════════════════════════════════════════════
   뿌리 볼륨(volume) — 3D 이식 (2026-07-27)
   ─────────────────────────────────────────────────────────────────
   넘김·가르마는 두피를 <b>따라</b> 쓸어가는 동작이라 접선 성분만 썼다.
   볼륨은 정반대다 — 두피에서 모발을 <b>띄우는</b> 동작이라 <b>법선</b> 방향이다.
   그래서 접선 투영을 하지 않고 법선을 그대로 쓴다.

   가중치 프로파일도 다르다. 빗질(가르마·넘김)은 뿌리에서 정해진 방향을 끝까지
   물려받으므로 계속 벌어지는 프로파일이었지만, 볼륨은 <b>뿌리 근처만 들뜨고</b>
   끝은 원래 자리로 돌아온다(실제로 드라이로 뿌리만 세운 모양이 그렇다).
   → 삼각형 프로파일: 0에서 시작해 RAMP에서 최대, 끝에서 다시 0.
   ※ 슬라이더는 0~100이고 50이 중립이다(다른 스타일링 값과 규약이 다름 — 주의).
══════════════════════════════════════════════════════════════════ */
const VOLUME3D = {
  AMP:  0.10, // 두상 반경 대비 최대 들림
  RAMP: 0.30, // 이 지점에서 가장 많이 들림(뿌리~중간)
};
function volumeLiftHead(root, volumeVal){
  const v = (Math.max(0, Math.min(100, volumeVal)) - 50) / 50;  // -1(눌림) ~ +1(세움)
  if(!v) return null;
  const x = root.x, y = root.y - 0.15, z = root.z;
  const E = getHeadEllipsoid();
  let nx = x/(E.a*E.a), ny = y/(E.b*E.b), nz = z/(E.c*E.c);
  const nl = Math.hypot(nx, ny, nz) || 1; nx/=nl; ny/=nl; nz/=nl;
  const amp = VOLUME3D.AMP * v;
  return { x:nx*amp, y:ny*amp, z:nz*amp };
}
// 뿌리에서 0 → RAMP에서 1 → 끝에서 0 (들뜬 뒤 제자리로)
function volumeWeightAt(i, n){
  if(i <= 0 || n <= 0) return 0;
  const t = i/n, R = VOLUME3D.RAMP;
  return (t <= R) ? (t/R) : Math.max(0, 1 - (t-R)/(1-R));
}
function volumeStrand3D(pts, volumeVal){
  if(!pts || pts.length < 2) return pts;
  const lift = volumeLiftHead(pts[0], volumeVal);
  if(!lift) return pts;
  return mapStrandFromRoot(pts, (p, t, i, n)=>{
    const w = volumeWeightAt(i, n);
    return { x:p.x + lift.x*w, y:p.y + lift.y*w, z:p.z + lift.z*w };
  });
}

/* ══════════════════════════════════════════════════════════════════
   결 흐름(flow) — 안말음 C / 바깥말음 — 3D 이식 (2026-07-27)
   ─────────────────────────────────────────────────────────────────
   이건 뿌리가 아니라 <b>끝</b>의 동작이다. 뿌리는 그대로 두고 모발 끝이 안쪽으로
   말리거나(안말음 C) 바깥으로 뻗는다(바깥말음). 그래서:
     · 방향 = 머리 세로축에서 바깥으로 향하는 반경 방향(±). 안말음이면 -, 바깥이면 +.
     · 가중치 = t²  — 뿌리 쪽은 거의 안 움직이고 끝으로 갈수록 급격히 휜다.
       (빗질의 선형 프로파일을 쓰면 통째로 밀린 모양이 되어 C가 안 나온다)
   반경 방향이라 정수리처럼 축에 가까운 곳은 자연히 약해진다 — 실제로도
   정수리 머리는 말 게 없다.
══════════════════════════════════════════════════════════════════ */
const FLOW3D = { AMP: 0.16 };
function flowCurlStrand3D(pts, flowVal){
  if(!pts || pts.length < 2 || !flowVal) return pts;
  const f = Math.max(-100, Math.min(100, flowVal)) / 100;   // +=바깥말음, -=안말음
  const root = pts[0];
  const rx = root.x, rz = root.z;
  const rl = Math.hypot(rx, rz);
  if(rl < 1e-4) return pts;                                  // 세로축 위 — 말 방향이 없음
  const E = getHeadEllipsoid();
  const ux = rx/rl, uz = rz/rl;                              // 바깥 반경 방향(수평)
  const amp = FLOW3D.AMP * f * Math.max(E.a, E.c);
  return mapStrandFromRoot(pts, (p, t)=>{
    const w = t*t;                                           // 끝으로 갈수록 급격히
    return { x:p.x + ux*amp*w, y:p.y, z:p.z + uz*amp*w };
  });
}

/* 두상 공간의 한 점 P에서, 머리 기준 방향 d를 두피 접선으로 투영한 벡터.
   "그 지점에서 그 방향으로 실제로 쓸려갈 수 있는 정도"가 길이로 나온다
   (두피에 수직이면 0). 가르마·넘김이 공유하는 핵심 연산. */
/* 두상 타원체의 중심 y. 예전엔 scalpTangentAt 안에 0.15가 <b>박혀</b> 있었다 —
   두피를 보는 함수가 늘어나면서 같은 숫자가 여러 벌이 될 자리라 한 곳으로 뺀다. */
const SCALP_CENTER_Y = 0.15;
/* 점 P가 두피 껍질 어디에 있는가.
   q = 1 이면 <b>두피 표면</b>, q > 1 이면 그만큼 바깥, q < 1 이면 두상 안쪽.
   n = 바깥을 향하는 단위 법선.
   ※ scalpTangentAt과 아래 hug가 이 하나를 같이 쓴다. 두 벌이 되면 한쪽만
     중심 오프셋을 고쳤을 때 접선과 되돌림이 서로 다른 두상을 보게 된다. */
function scalpShellAt(P, E){
  const x = P.x, y = P.y - SCALP_CENTER_Y, z = P.z;
  let nx = x/(E.a*E.a), ny = y/(E.b*E.b), nz = z/(E.c*E.c);
  const nl = Math.hypot(nx, ny, nz) || 1;
  return { nx:nx/nl, ny:ny/nl, nz:nz/nl,
           q: Math.hypot(x/E.a, y/E.b, z/E.c) };
}
function scalpTangentAt(P, d, E){
  const s = scalpShellAt(P, E);
  const dot = d.x*s.nx + d.y*s.ny + d.z*s.nz;
  return { x: d.x - dot*s.nx, y: d.y - dot*s.ny, z: d.z - dot*s.nz };
}
/* ── combStrand3D 규약의 dirAt를 만든다 (2026-08-23 중복 통합) ──────────
   넘김(sweepStrand3D)과 가르마(partStrand3D)가 <b>글자 그대로 같은 여섯 줄</b>을
   각자 적고 있었다 — 점마다 두피 접선을 구해 단위화하고 frac을 곱하는 것.
   규약이 "dirAt의 <b>길이</b>가 회전 비율(0~1)"이라 이 여섯 줄이 곧 규약의
   구현이다. 두 벌이면 규약이 두 벌이 된다.
   d    — 돌릴 방향(뿌리가 정한다. 가닥이 움직여도 안 바뀐다)
   frac — 세기(뿌리가 정한다). 두피에 수직인 지점은 null = 방향 없음. */
function scalpDirAt(d, E, frac){
  return (P)=>{
    const t = scalpTangentAt(P, d, E);
    const l = Math.hypot(t.x, t.y, t.z);
    if(l < 1e-5) return null;                                // 두피에 수직 = 방향 없음
    return { x:t.x/l*frac, y:t.y/l*frac, z:t.z/l*frac };     // 방향만 점마다, 세기는 뿌리
  };
}
/* ── 미는 게 아니라 <b>방향을 돌린다</b> (2026-07-27 2차 수정) ──────────────
   사용자: "완전히 넘겼을 때는 끝이 올라가는 게 아니라, 일단 <b>뿌리쪽부터</b>
   헤어가 뒤편을 바라볼 정도로 결방향이 바뀌어야 함."

   1차 수정(변위 적분)은 원래 점 위에 이동량을 <b>더하는</b> 방식이었다. 그래서
   슬라이더를 올리면 뿌리 근처는 거의 그대로인 채 끝으로 갈수록 변위가 쌓여
   "끝이 들려 올라가는" 모양이 됐다. 게다가 원래 좌표에 벡터를 더하는 것이라
   가닥 길이가 늘어난다(끝이 위로 튀어 오른 원인 중 하나).

   지금 방식 — 구간 벡터를 빗질 방향으로 <b>회전</b>시킨다:
     ① 각 구간의 원래 방향 v̂와 그 지점의 빗질 방향 ĝ를 k만큼 섞는다
     ② 섞은 방향에 <b>원래 구간 길이</b>를 다시 입힌다 → 가닥 길이 보존
     ③ 다음 점은 그 벡터를 이어 붙인 자리 → 방향이 돌면 경로가 저절로 휜다
   k = min(1, 가중치 × dirAt 길이). 그래서 dirAt이 돌려주는 벡터의 <b>길이가
   곧 "그 지점에서 얼마나 완전히 돌릴 것인가"(0~1)</b>라는 규약이다.
   k=1이면 그 구간부터 결이 통째로 빗질 방향을 향한다 = 뿌리부터 뒤를 봄.
   두피에 수직인 지점(뒤통수 정중앙)은 접선 성분이 0이라 k도 0 — 그대로다. */
/* ⚠ 이름 주의 (2026-08-11) — 예전 이름은 combStrand3D였다. 파일 뒤쪽 #5 시술모드에
   <b>같은 이름의 1인자 함수</b>(빗질 변위장 적용)가 하나 더 선언돼 있었고, JS는
   나중 선언이 이긴다. 그래서 아래 넘김·가르마가 부르던 4인자 호출이 전부 빗질용
   1인자 함수로 들어가 <b>빗질 격자가 없으면 pts를 그대로 반환</b>했다 — 두 슬라이더가
   에러 하나 없이 완전 무반응이었다(교훈 B "실행됨 ≠ 맞음"의 재발).
   확인 방법: 파일에서 두 선언만 꺼내 Node에 넣고 fn.length를 찍으면 1이 나온다.
   그래서 역할이 드러나는 이름으로 바꿨다 — 이건 "결을 그 방향으로 굽히는" 프리미티브다. */
/* ══════════════════════════════════════════════════════════════════
   빗질한 머리는 <b>두상에 붙는다</b> (2026-08-23 9차)
   ─────────────────────────────────────────────────────────────────
   사용자: "가르마 조정하는 거, 머리 넘기는 거를 좀 더 섬세하게 만들어야 될 것
   같음. <b>제대로 구부러져서 머리가 붙게</b> 해야 돼."
   실기기 3D 프리뷰에서 가닥이 부채처럼 <b>바깥으로</b> 퍼졌다. 원인은 명확하다:

     combWeightAt(i,n,RAMP=0.22,TAIL) 은 가닥의 22%에서 이미 k=1로 포화한다.
     그 뒤로 방향은 <b>완전히 접선</b>이고, 접선으로 직진하면 구면에서 멀어진다.
     남은 78%가 길수록 벌어짐이 커진다 — 그게 그 부채다.

   빗질은 방향만 돌리는 게 아니다. 빗은 머리를 <b>두피 쪽으로 누르면서</b> 돌린다.
   그래서 방향 회전에 <b>되돌림 조향</b>을 하나 더 얹는다:
     · 지금 점이 껍질(q)에서 얼마나 떴는지 재고
     · 뜬 만큼 진행 방향을 안쪽으로 살짝 꺾는다
     · 꺾은 뒤 <b>다시 원래 길이로 정규화</b>한다 → 마디 길이가 안 변한다
   마지막이 중요하다. 점을 직접 끌어당기면 가닥이 짧아져서 커트 결과가 바뀐다.
   방향만 꺾으면 길이는 그대로고 <b>곡률</b>만 생긴다 — 그게 "구부러져서 붙는" 것이다.

   ⚠ 안쪽으로만 민다. 이미 누워 있는 가닥을 <b>바깥으로 밀지 않는다</b>.
   ⚠ 뿌리가 자란 껍질(qRoot)보다 안쪽으로는 안 들어간다 + lift만큼 띄운다.
     두피에 파묻히면 렌더에서 머리가 사라진다.
   ⚠ 되돌림 세기를 회전 세기 k에 묶는다 — 빗질이 안 닿는 뿌리 근처는 안 건드린다.
   되돌리기: SCALP_HUG.on = false (예전 동작 = 접선 직진) */
const SCALP_HUG = {
  on: true,
  strength: 0.55,  // 최대 얼마나 세게 안으로 조향할까(0=예전 동작, 1=거의 껍질 위를 김)
  band:     0.35,  // 껍질에서 이만큼(두상 반경 대비) 뜨면 되돌림이 최대가 된다
  lift:     0.06,  // 두피에서 이만큼은 띄운다 — 모발 두께. 0이면 살에 파묻힌다
};
/* ══════════════════════════════════════════════════════════════════
   되돌림이 <b>법선으로 자란 가닥</b>에는 무동작이었다 (2026-08-30 2차)
   ─────────────────────────────────────────────────────────────────
   9차 SCALP_HUG와 8/26 SLEEK3D가 <b>같은 산술</b>을 쓴다:
       w = u − n·pull    (진행방향에서 법선 성분을 뺀다)
   u가 법선과 나란하면 w = n(1−pull)이고, 정규화하면 <b>u와 같은 방향</b>이다.
   즉 아무리 세게 당겨도 0.00°다. 하네스 실측:
       pull 0.2 → 0.00° · pull 0.5 → 0.00° · pull 0.8 → 0.00°
   8/30 1차 배너가 이 사실을 <b>적어 두고도</b> 고친 것은 누적(carry)뿐이었다.
   누적은 첫 마디의 <b>증분</b>이 0이면 계속 0이라 이 경우를 못 구한다.
   그리고 <b>정수리 가닥이 정확히 이 경우</b>다 — 두피 법선이 곧 위쪽이라
   위로 곧게 자란다. 실기기에서 두정부만 삐죽 서던 것의 정체가 이것이다.

   고침 — 빼지 말고 <b>접선 쪽으로 회전</b>시킨다:
       w = normalize( u·(1−pull) + t̂·pull ),   t̂ = u의 접선 성분
     · u가 이미 접선이면 t̂ = u라 무동작 → 누운 가닥은 안 건드린다(9차 안전선 유지)
     · u가 법선과 나란하면 t̂가 0이라 <b>눕힐 기준이 없다</b> → 대안 접선을 쓴다.
       빗질 방향이 있으면 그것(빗은 쪽으로 눕는 게 맞다), 없으면 중력,
       그것도 두피에 수직이면 뒤(−Z).
     · 각도가 법선→접선 쪽으로만 가므로 <b>90°를 못 넘는다</b> = 두피를 뚫지 않는다.
       빼기 판은 pull>1에서 넘을 수 있었다(바닥 가드가 필요했던 이유 중 하나).
   ⚠ 목표는 <b>접선이 아니라 접선보다 살짝 안쪽</b>이다(INTO). 하네스에서 잡은 것:
     순수 접선으로만 돌리면 방향이 90°에서 멈춘다 — 그런데 접선으로 직진하면
     곡면에서 <b>멀어진다</b>(9차 배너가 부채 원인으로 지목한 바로 그것). 즉
     "90°를 안 넘는다"는 안전해 보이지만 <b>붙는 능력도 같이 없앤다</b>.
     실측: 끝점 뜸 p90이 옛 1.011 → 접선만이면 1.166으로 <b>더 떴다</b>.
     그래서 뜬 만큼(pull)에 비례해 목표를 안쪽으로 기울인다. 곡률을 따라가는
     데 필요한 만큼만 들어가고, 파고듦은 아래 바닥 가드가 받는다.
   ⚠ 이 함수가 되돌림 산술의 <b>단일 출처</b>다. SCALP_HUG(빗질)와 SLEEK3D(마무리)가
     같이 부른다 — 두 벌이 되면 8/30 1차처럼 한쪽만 고쳐진다.
   되돌리기: HUG_STEER.rotate = false (예전 빼기 판 — 산술까지 동일)
══════════════════════════════════════════════════════════════════ */
const HUG_STEER = { rotate: true, into: 3.0 };  // into: 하네스 sweep에서 고름(0~7)
                                               // 끝점 뜸 중앙값이 목표 껍질 qWant(=1.06)에 얹히는 값
function steerDownToScalp(u, sh, pull, hint){
  if(!(pull > 0)) return u;
  if(!HUG_STEER.rotate){                                   // ── 예전 판(빼기)
    const bx = u.x - sh.nx*pull, by = u.y - sh.ny*pull, bz = u.z - sh.nz*pull;
    const bl = Math.hypot(bx, by, bz);
    return bl > 1e-9 ? { x:bx/bl, y:by/bl, z:bz/bl } : u;
  }
  const dn = u.x*sh.nx + u.y*sh.ny + u.z*sh.nz;
  let tx = u.x - sh.nx*dn, ty = u.y - sh.ny*dn, tz = u.z - sh.nz*dn;
  let tl = Math.hypot(tx, ty, tz);
  if(tl < 1e-4){                                           // 법선과 나란 — 기준이 없다
    const cands = [hint, { x:0, y:-1, z:0 }, { x:0, y:0, z:-1 }];
    for(let ci=0; ci<cands.length; ci++){
      const c = cands[ci]; if(!c) continue;
      const cd = c.x*sh.nx + c.y*sh.ny + c.z*sh.nz;
      tx = c.x - sh.nx*cd; ty = c.y - sh.ny*cd; tz = c.z - sh.nz*cd;
      tl = Math.hypot(tx, ty, tz);
      if(tl > 1e-4) break;
    }
    if(tl < 1e-4) return u;                                // 어느 것도 안 되면 포기
  }
  tx/=tl; ty/=tl; tz/=tl;
  const p = Math.min(1, pull);
  if(HUG_STEER.into > 0){                    // 접선보다 살짝 안쪽 — 곡률을 따라간다
    const lam = p * HUG_STEER.into;
    tx -= sh.nx*lam; ty -= sh.ny*lam; tz -= sh.nz*lam;
    const gl = Math.hypot(tx, ty, tz) || 1; tx/=gl; ty/=gl; tz/=gl;
  }
  const wx = u.x*(1-p) + tx*p, wy = u.y*(1-p) + ty*p, wz = u.z*(1-p) + tz*p;
  const wl = Math.hypot(wx, wy, wz);
  return wl > 1e-9 ? { x:wx/wl, y:wy/wl, z:wz/wl } : u;
}
/* ── 꺾임을 <b>다음 마디로 물려준다</b> — 단, 눕힘만 (2026-08-30 2차) ────────
   사용자: "머리가닥이 구부러질 때 direction도 함께 변경되는지 확인해보고."
   확인 결과 <b>절반만</b> 바뀌고 있었다. 이 함수는 마디마다 <b>원래</b> 방향
   (pts[i]−pts[i−1])을 다시 가져와 목표 방향과 k로 섞는다. 그래서:
     · 빗질 성분(k 블렌드)은 매 마디 원래 방향에서 다시 재므로 <b>tilt가 k로 고정</b>.
       이건 <b>맞다</b> — k가 곧 "이 뿌리에 가르마가 얼마나 닿나"이고, 그 세기
       차이가 화면에서 <b>가르마 선</b>을 만든다. 누적시키면 약한 가닥도 결국
       목표 방향에 도달해 세기 구배가 사라진다 = 선이 도로 없어진다.
     · 눕힘 성분(되돌림 조향)은 <b>누적돼야 한다</b>. 지금은 매 마디 원래 방향에서
       다시 시작하니 눕힌 것이 안 쌓인다 — 8/30 1차가 sleek에서 고친 것과
       같은 문제이고, <b>이쪽은 안 고쳐져 있었다</b>.
   그래서 M에는 <b>되돌림 증분만</b> 합친다. 빗질 블렌드의 증분은 안 넣는다.
   되돌리기: BEND3D.carry = false (예전 동작 — 산술까지 동일) */
const BEND3D = { carry: true };
function bendStrandToDir3D(pts, dirAt, ramp, tail, E){
  if(!pts || pts.length < 2) return pts;
  const n = pts.length - 1;
  const out = [pts[0]];
  let cx = pts[0].x, cy = pts[0].y, cz = pts[0].z;
  const H = SCALP_HUG;
  const hugOn = !!(H.on && E && E.a > 1e-9 && E.b > 1e-9 && E.c > 1e-9);
  /* 이 가닥이 <b>자란</b> 껍질. 목표는 "두피에 붙이기"가 아니라 "자기가 난
     자리 근처로 되돌리기"다 — 정수리에서 난 가닥을 두피까지 눌러 버리면
     볼륨이 통째로 사라진다. */
  const qRoot = hugOn ? scalpShellAt(pts[0], E).q : 0;
  const qWant = qRoot + (hugOn ? H.lift : 0);
  let M = null;                                  // 누적 <b>눕힘</b> 회전(빗질은 안 넣는다)
  for(let i=1;i<pts.length;i++){
    let vx = pts[i].x - pts[i-1].x, vy = pts[i].y - pts[i-1].y, vz = pts[i].z - pts[i-1].z;
    const L = Math.hypot(vx, vy, vz);
    if(L > 1e-9){
      let u = { x:vx/L, y:vy/L, z:vz/L };
      if(BEND3D.carry && M){                     // ① 지금까지 눕힌 만큼을 물려받는다
        u = _sleekApply(M, u);
        const ul = Math.hypot(u.x, u.y, u.z) || 1;
        u = { x:u.x/ul, y:u.y/ul, z:u.z/ul };
      }
      const d = dirAt({ x:cx, y:cy, z:cz });
      const dl = d ? Math.hypot(d.x, d.y, d.z) : 0;
      let k = 0, g = null, w = u;
      if(dl > 1e-9){
        g = { x:d.x/dl, y:d.y/dl, z:d.z/dl };
        k = Math.min(1, combWeightAt(i, n, ramp, tail) * dl);
        if(k > 0){
          /* ② 빗질 — <b>k로 고정된 tilt</b>. 누적시키지 않는다(위 배너: 누적하면
             세기 구배가 사라져 가르마 선이 없어진다). */
          let bx = u.x*(1-k) + g.x*k, by = u.y*(1-k) + g.y*k, bz = u.z*(1-k) + g.z*k;
          let bl = Math.hypot(bx, by, bz);
          if(bl < 1e-6){ bx=g.x; by=g.y; bz=g.z; bl=1; }   // 정반대라 상쇄된 경우
          w = { x:bx/bl, y:by/bl, z:bz/bl };
        }
      }
      const uComb = w;                            // 여기까지가 빗질 몫
      /* ③ 되돌림 조향 — 뜬 만큼 접선 쪽으로 회전(steerDownToScalp).
         빼기가 아니라 회전이라 <b>법선으로 자란 가닥도 눕는다</b>. */
      if(hugOn && k > 0){
        const sh = scalpShellAt({ x:cx, y:cy, z:cz }, E);
        const over = sh.q - qWant;
        if(over > 0) w = steerDownToScalp(w, sh, Math.min(1, over/H.band)*H.strength*k, g);
      }
      /* ④ 눕힘 증분만 <b>정착</b>시킨다 — 다음 마디가 이 자세에서 이어간다. */
      if(BEND3D.carry){
        const R = _sleekRotate(uComb, w);
        if(R) M = M ? _sleekMul(R, M) : R;
        /* 바닥 — 정착시키면 파고듦이 새 실패 모드다(8/30 1차와 같은 이유).
           뿌리 껍질보다 안으로 들어갈 방향이면 법선 성분을 잘라 미끄러뜨린다. */
        if(hugOn){
          const nq = scalpShellAt({ x:cx + w.x*L, y:cy + w.y*L, z:cz + w.z*L }, E);
          if(nq.q < qRoot){
            const sh2 = scalpShellAt({ x:cx, y:cy, z:cz }, E);
            const dn = w.x*sh2.nx + w.y*sh2.ny + w.z*sh2.nz;
            if(dn < 0){
              let tx = w.x - sh2.nx*dn, ty = w.y - sh2.ny*dn, tz = w.z - sh2.nz*dn;
              const tl = Math.hypot(tx, ty, tz);
              if(tl > 1e-9){
                const nw = { x:tx/tl, y:ty/tl, z:tz/tl };
                const R2 = _sleekRotate(w, nw);
                if(R2) M = M ? _sleekMul(R2, M) : R2;
                w = nw;
              }
            }
          }
        }
      }
      vx = w.x*L; vy = w.y*L; vz = w.z*L;         // 길이 보존(9차 규약)
    }
    cx += vx; cy += vy; cz += vz;
    out.push({ x:cx, y:cy, z:cz });
  }
  return out;
}
/* ══════════════════════════════════════════════════════════════════
   정돈(SLEEK) — "머리가 <b>눌러붙어</b> 깔끔하게 정리된다" (2026-08-26)
   ─────────────────────────────────────────────────────────────────
   사용자: "가르마랑 <b>머리가 좀 더 눌러붙어서 깔끔하게 정리되는 거</b>를
   구현해 보는 거."

   ── 왜 SCALP_HUG로는 안 되나 (코드로 확인한 것) ──────────────────
   2026-08-23 9차의 SCALP_HUG는 <b>bendStrandToDir3D 안에서만</b> 돈다. 그리고
   그 안에서도 조건이 `k > 0`이다 — k는 combWeightAt × 회전세기이므로
   <b>넘김·가르마가 실제로 돌리는 가닥의, 돌리는 구간에서만</b> 되돌림이 걸린다.
   sweep=0인 가닥, 가르마가 안 닿는 뒤통수, 그리고 넘김이 약한 구간은
   <b>한 번도</b> 안 눌린다. 그래서 "빗은 자리만 붙고 나머지는 뜬다".
   9차가 고친 것은 <b>빗질한 머리</b>가 붙는 것이고, 지금 필요한 것은
   <b>머리 전체</b>가 눌리는 것이다 — 다른 시술이다(왁스·포마드로 눌러 붙이는
   마무리). 그래서 연산자를 따로 둔다.

   ── 무엇을 하는가 ───────────────────────────────────────────────
   9차가 세운 규약을 그대로 쓴다 — <b>점을 끌어당기지 않고 방향만 꺾는다</b>.
     · 지금 점이 자기 뿌리 껍질(qRoot + lift)에서 얼마나 떴는지 재고(over)
     · 뜬 만큼 진행 <b>방향</b>을 안쪽 법선 쪽으로 꺾고
     · 꺾은 뒤 <b>원래 마디 길이로 다시 정규화</b>한다
   마지막이 핵심인 이유도 9차와 같다: 점을 직접 당기면 가닥이 짧아져서
   <b>커트 결과가 바뀐다</b>. 그건 눌러 붙인 게 아니라 자른 것이다.

   ── 9차와 다른 점 둘 ────────────────────────────────────────────
   ① 회전(k)에 안 묶는다 — 빗질 여부와 무관하게 <b>모든 가닥</b>에 걸린다.
      대신 뿌리 쪽은 원래 붙어 있으므로 끝으로 갈수록 세지는 가중치를 쓴다
      (VOLUME3D·PART3D가 쓰는 것과 같은 t 기반).
   ② 세기를 <b>스타일링 값</b>이 정한다(state.styling.sleek). 0이면 이 함수는
      pts를 그대로 돌려준다 — 예전 동작과 산술까지 같다.

   ⚠ 뿌리 볼륨과 <b>싸우지 않게</b> 순서를 뒤에 둔다. volume은 뿌리를 들어
     올리는 것이고 sleek은 <b>기울어진 뒤의 길이 부분</b>을 눕히는 것이라,
     volume 다음에 와야 "뿌리는 섰는데 끝은 붙은" 폼파두르가 나온다.
     앞에 두면 sleek이 눕힌 것을 volume이 도로 들어 올린다.
   ⚠ 목표는 두피가 아니라 <b>자기 뿌리 껍질 + lift</b>다(9차와 같은 이유).
     정수리 가닥을 두피까지 눌러 버리면 볼륨이 통째로 사라진다.
   되돌리기: SLEEK3D.on = false (또는 styling.sleek = 0 — 기본값이 0이다)
══════════════════════════════════════════════════════════════════ */
const SLEEK3D = {
  on: true,
  strength: 0.85,  // sleek=100일 때의 최대 조향 세기(SCALP_HUG.strength 0.55보다 세다 — 이건 마무리다)
  band:     0.30,  // 껍질에서 이만큼(두상 반경 대비) 뜨면 조향이 최대
  lift:     0.06,  // 두피에서 이만큼은 띄운다 — 모발 두께(SCALP_HUG.lift와 같은 값·같은 이유)
  ramp:     0.15,  // 이 지점부터 조향이 살아난다(뿌리는 원래 붙어 있다)
  GAMMA:    1.4,   // 슬라이더 응답(sliderResponse 배너) — 선형 이탈 18.3%p→<b>7.3%p</b>
  /* (2026-08-30) 꺾임을 누적·정착시킨다. false면 8/26의 비누적 판 = 예전 동작.
     이게 켜져야 세기가 뜻을 갖는다(아래 배너의 실측 표 참고). */
  carry:    true,
};
/* ── 꺾은 방향은 <b>다음 마디로 물려져야 한다</b> (2026-08-30) ────────────────
   사용자: "가닥의 방향이 변화되어야 할 시술에서는 방향도 같이 변경되고
   <b>정착</b>되어야 되지. 원래 방향만 고수할 수가 없잖아. 가닥의 굴곡이
   자연스럽게 변화된 후 <b>고정</b>되어야 하고, 그 반경은 가닥이 움직일 때만
   변경되는 걸로 설정된 걸로 알고 있어."

   맞았다. 위 8/26 판은 마디마다 <b>원래</b> 방향(pts[i]−pts[i−1])을 다시 가져와
   꺾었다. 그래서 꺾임이 쌓이지 않고 매 마디 처음부터 다시 시작한다 —
   세기를 올려도 모양이 안 바뀐다. 하네스 실측이 정확히 그 모양이었다:
     sleek 80 → 뜸 중앙 1.58cm · sleek 100 → 1.54cm  (세기를 25% 올려 0.04cm)
   그리고 <b>법선으로 곧게 자란 가닥</b>은 아예 안 눕는다. w = n − n·pull =
   n(1−pull)이라 정규화하면 같은 방향이다(측정: pull 0.2/0.5/0.68 전부 0.0°).
   "빗은 자리만 붙고 나머지는 뜬다"의 나머지 절반이 여기였다.

   지금 방식 — 회전을 <b>들고 다닌다</b>:
     ① 지금까지의 누적 회전 M을 원래 방향에 먼저 입힌다(= 물려받는다)
     ② 그 방향을 두피 쪽으로 꺾고, 그 <b>증분 회전</b>을 M에 합친다(= 정착한다)
     ③ 마디 길이는 그대로 다시 입힌다 — 9차·8/26과 같은 규약이다
   가닥 자신의 곡률(컬·처짐)은 원래 방향 쪽에 남아 있고 눕힘만 누적된다.
   그래서 "굴곡이 자연스럽게 변화된 후 고정"이 성립한다.

   ⚠ 정착시키면 <b>파고듦</b>이 새 실패 모드가 된다 — 안쪽을 향한 채 굳은 방향이
     두피를 지나서도 그대로 간다(측정: 파묻힘 0.4% → 18.1%). 그래서 바닥을 둔다:
     다음 점이 <b>뿌리 껍질보다 안쪽</b>이면 그 방향의 법선 성분을 잘라 접선으로
     미끄러뜨린다. 밀어내는 게 아니라 못 파고들게 하는 것이라 길이가 안 변한다.
     이게 사용자가 말한 "그 반경은 가닥이 움직일 때만 변경된다"의 짝이다 —
     반경(껍질)은 뿌리가 정하고, 가닥은 그 위를 미끄러질 뿐 안으로는 못 든다.
   ⚠ sleek=0이면 <b>같은 개체</b>를 그대로 돌려준다(예전과 산술까지 동일).
   되돌리기: SLEEK3D.carry = false (예전 비누적 판으로 복귀) */
function _sleekRotate(u, w){
  /* u→w 회전행렬(로드리게스). 두 벡터 다 단위. 거의 같으면 항등을 준다. */
  const c = u.x*w.x + u.y*w.y + u.z*w.z;
  let ax = { x:u.y*w.z-u.z*w.y, y:u.z*w.x-u.x*w.z, z:u.x*w.y-u.y*w.x };
  const s = Math.hypot(ax.x, ax.y, ax.z);
  if(s < 1e-9) return null;                       // 회전 없음 — 합칠 것도 없다
  ax = { x:ax.x/s, y:ax.y/s, z:ax.z/s };
  const K = [[0,-ax.z,ax.y],[ax.z,0,-ax.x],[-ax.y,ax.x,0]];
  const M = [[1,0,0],[0,1,0],[0,0,1]];
  for(let i=0;i<3;i++) for(let j=0;j<3;j++){
    let kk = 0; for(let m=0;m<3;m++) kk += K[i][m]*K[m][j];
    M[i][j] += s*K[i][j] + (1-c)*kk;
  }
  return M;
}
function _sleekMul(A, B){
  const C = [[0,0,0],[0,0,0],[0,0,0]];
  for(let i=0;i<3;i++) for(let j=0;j<3;j++){
    let s = 0; for(let k=0;k<3;k++) s += A[i][k]*B[k][j];
    C[i][j] = s;
  }
  return C;
}
function _sleekApply(M, v){
  return { x:M[0][0]*v.x + M[0][1]*v.y + M[0][2]*v.z,
           y:M[1][0]*v.x + M[1][1]*v.y + M[1][2]*v.z,
           z:M[2][0]*v.x + M[2][1]*v.y + M[2][2]*v.z };
}
/* ══════════════════════════════════════════════════════════════════
   슬라이더 응답 곡선 — <b>칸마다 같은 만큼</b> 변하게 (2026-08-30 4차)
   ─────────────────────────────────────────────────────────────────
   사용자: "슬라이더가 있는 경우, <b>슬라이더 수치가 다 안 먹으면</b> 수치
   조정해줘 … 사람이 조정해서 변경할 수 있게."

   넘김·정돈·가르마세기는 전부 <b>목표 방향으로 frac만큼 회전</b>하는 연산자다.
   회전은 각도가 커질수록 변위가 덜 늘어나므로(사인), 슬라이더를 그대로
   frac에 꽂으면 <b>앞쪽 절반이 대부분을 먹고 뒤쪽 절반이 죽는다</b>.
   하네스 실측(합성 두상 340가닥 · 가닥 전체 평균 이동 · 값 0~100을 10칸):
     넘김   0 · 18 · 35 · 48 · 59 · <b>68</b> · 76 · 84 · 90 · 96 · 100 (%)
     정돈   0 · 16 · 32 · 46 · 58 · <b>68</b> · 77 · 84 · 90 · 95 · 100
   즉 슬라이더 <b>절반에서 이미 효과의 2/3</b>가 끝나 있었다. 위쪽 30%(70→100)가
   더 만드는 변화는 넘김 16.3%p · 정돈 16.1%p뿐이다 — 사용자가 "안 먹는다"고
   한 자리가 여기다.

   고침: 값을 frac에 꽂기 전에 <b>감마</b>를 한 번 먹인다. frac = (v/100)^γ.
   γ는 하네스에서 "칸마다 같은 변화"에 가장 가까운 값을 골랐다(선형 이탈 최소):
     넘김 γ 1.6 (이탈 18.6%p → <b>6.1%p</b>) · 정돈 γ 1.4 (18.3 → <b>7.3</b>)
     가르마세기 γ 1.2 (8.9 → <b>3.0</b>)
   ⚠ 곡선을 바꾸면 <b>같은 숫자가 다른 그림</b>이 된다. 그래서 STYLE_SPECS의
     값을 같이 환산했다(v' = 100·(v/100)^(1/γ)) — 프리셋 렌더 결과는 그대로다.
   ⚠ 끝값(0과 100)은 감마와 무관하게 그대로다. 되돌림 검증이 여기서 걸린다.
   되돌리기: 각 연산자의 GAMMA를 1로 (그러면 산술까지 예전과 같다)
══════════════════════════════════════════════════════════════════ */
function sliderResponse(v, gamma){
  const s = Math.max(-1, Math.min(1, (v || 0) / 100));
  if(!(gamma > 0) || gamma === 1) return s;
  return Math.sign(s) * Math.pow(Math.abs(s), gamma);
}
function sleekStrand3D(pts, sleekVal){
  if(!SLEEK3D.on || !pts || pts.length < 2) return pts;
  const s = sliderResponse(Math.max(0, Math.min(100, sleekVal || 0)), SLEEK3D.GAMMA);
  if(s <= 0) return pts;                       // 예전 동작과 <b>산술까지</b> 동일
  let E = null;
  try{ E = getHeadEllipsoid(); }catch(e){}
  if(!E || !(E.a > 1e-9 && E.b > 1e-9 && E.c > 1e-9)) return pts;
  const K = SLEEK3D;
  const qRoot = scalpShellAt(pts[0], E).q;
  const qWant = qRoot + K.lift;                // 목표 껍질 — 뿌리가 정한다
  const qFloor = qRoot;                        // 바닥 — 여기보다 안쪽으론 못 든다
  const n = pts.length - 1;
  const out = [pts[0]];
  let cx = pts[0].x, cy = pts[0].y, cz = pts[0].z;
  let M = null;                                // 누적 회전(없으면 항등)
  for(let i=1;i<pts.length;i++){
    let vx = pts[i].x - pts[i-1].x, vy = pts[i].y - pts[i-1].y, vz = pts[i].z - pts[i-1].z;
    const L = Math.hypot(vx, vy, vz);
    if(L > 1e-9){
      let u = { x:vx/L, y:vy/L, z:vz/L };
      if(K.carry && M){                        // ① 지금까지의 꺾임을 물려받는다
        u = _sleekApply(M, u);
        const ul = Math.hypot(u.x, u.y, u.z) || 1;
        u = { x:u.x/ul, y:u.y/ul, z:u.z/ul };
      }
      let w = u;
      /* 뿌리 근처는 안 건드린다 — 거기는 원래 두피에 붙어 있고, 건드리면
         volume이 만든 리프트를 지운다. ramp 지점부터 선형으로 살아난다. */
      const t = i / n;
      const ww = t <= K.ramp ? 0 : (t - K.ramp) / (1 - K.ramp);
      if(ww > 0){
        const sh = scalpShellAt({ x:cx, y:cy, z:cz }, E);
        const over = sh.q - qWant;
        if(over > 0){                           // <b>안쪽으로만</b> 민다(이미 누운 가닥은 안 건드림)
          const pull = Math.min(1, over / K.band) * K.strength * s * ww;
          /* (2026-08-30 2차) 빼기 → <b>접선 쪽 회전</b>. 8/30 1차 배너가 적어 둔
             "법선으로 곧게 자란 가닥은 아예 안 눕는다(전부 0.0°)"를 실제로 고치는
             자리다 — 누적만으로는 첫 증분이 0이라 못 구했다. steerDownToScalp이
             SCALP_HUG와 공용 단일 출처다. 되돌리기: HUG_STEER.rotate = false */
          const nw = steerDownToScalp(u, sh, pull, null);
          if(nw !== u){
            if(K.carry){                        // ② 증분 회전을 <b>고정</b>한다
              const R = _sleekRotate(u, nw);
              if(R) M = M ? _sleekMul(R, M) : R;
            }
            w = nw;
          }
        }
      }
      /* ③ 바닥 — 뿌리 껍질 안쪽으로 들어갈 방향이면 접선으로 미끄러뜨린다.
         "두피에 파묻히면 렌더에서 머리가 사라진다"(9차 안전선)의 구현. */
      if(K.carry){
        const nq = scalpShellAt({ x:cx + w.x*L, y:cy + w.y*L, z:cz + w.z*L }, E);
        if(nq.q < qFloor){
          const sh2 = scalpShellAt({ x:cx, y:cy, z:cz }, E);
          const dn = w.x*sh2.nx + w.y*sh2.ny + w.z*sh2.nz;
          if(dn < 0){
            let tx = w.x - sh2.nx*dn, ty = w.y - sh2.ny*dn, tz = w.z - sh2.nz*dn;
            const tl = Math.hypot(tx, ty, tz);
            if(tl > 1e-9){
              const nw = { x:tx/tl, y:ty/tl, z:tz/tl };
              const R = _sleekRotate(w, nw);
              if(R) M = M ? _sleekMul(R, M) : R;
              w = nw;
            }
          }
        }
      }
      vx = w.x*L; vy = w.y*L; vz = w.z*L;       // 길이 보존
    }
    cx += vx; cy += vy; cz += vz;
    out.push({ x:cx, y:cy, z:cz });
  }
  return out;
}
/* ── 넘김이 가르마를 <b>덮어쓰고 있었다</b> (2026-08-30) ────────────────────
   파이프라인은 ④가르마 → ⑤넘김이고, 둘 다 bendStrandToDir3D로 결 방향을 돌린다.
   그런데 SWEEP3D.TURN = 1.0이라 넘김은 k=1로 <b>포화</b>한다. k=1이면 그 구간의
   방향은 통째로 넘김 방향이 된다 — 가르마가 방금 만든 방향이 지워진다.
   하네스로 확인한 것(가르마비 = 분할선 위 캐노피 밀도 ÷ 좌우 10~25mm 밀도,
   낮을수록 가르마가 보인다):
     넘김 0 · 가르마세기 0   → 0.94   (가르마 없음 = 균일)
     넘김 0 · 가르마세기 50  → 0.64   (갈라진다)
     넘김 72 · 가르마세기 100 → <b>1.20</b>  (가르마가 <b>사라진다</b>)
   즉 폼파두르 스펙이 가르마를 걸어 놓고 넘김으로 지우고 있었다. 8/26에 "선이
   안 보이던 진짜 이유는 세기가 아니라 머리가 떠 있어서"라고 적은 것은 절반만
   맞았다 — 나머지 절반이 이것이다.

   고침: 넘김의 <b>목표 방향</b>을 뿌리가 속한 가르마 편으로 기울인다. 실제
   사이드파트가 그렇다 — 가르마 오른쪽 머리는 오른쪽-뒤로, 왼쪽은 왼쪽-뒤로
   넘어간다. "뒤로" 하나로 통일되는 것은 <b>올백</b>이지 사이드파트가 아니다.
   두 시술이 싸우지 않고 <b>합성</b>되므로 순서를 바꿀 필요도 없다.
   방향의 출처는 partingPushHead 하나 그대로다(두 벌을 안 만든다).
   되돌리기: PART_SWEEP_MIX = 0 (예전 동작 = 넘김은 늘 정중앙 뒤) */
const PART_SWEEP_MIX = 1.2;   // 넘김 방향을 가르마 편으로 기울이는 비중(하네스 표에서 고름)
function sweepStrand3D(pts, sweepVal, curlAmt, partVal, partAmt){
  if(!pts || pts.length < 2 || !sweepVal) return pts;
  const s = sliderResponse(Math.max(-100, Math.min(100, sweepVal)), SWEEP3D.GAMMA); // +=뒤로, -=앞으로
  const E = getHeadEllipsoid();
  // 컬이 셀수록 빗질이 덜 먹는다(가르마와 동일 규칙)
  const turn = SWEEP3D.TURN * (1 - 0.5*Math.max(0, Math.min(100, curlAmt||0))/100);
  let back = { x:0, y:0, z: s >= 0 ? -1 : 1 };               // 머리 기준 "뒤로"(부호만)
  /* 가르마가 걸려 있으면 그 편 쪽으로 기울인다. seed는 가르마가 이 뿌리에서
     정한 갈라짐 방향이고, 그 <b>크기</b>가 곧 "여기에 가르마가 얼마나 닿나"다
     (AMP로 나누면 0~1 — partStrand3D가 쓰는 것과 같은 정규화). 가르마가 안 닿는
     뒤통수·귀 아래는 seed가 null이라 예전과 <b>같은 값</b>이 나온다. */
  if(PART_SWEEP_MIX > 0){
    const seed = partingPushHead(pts[0], partVal || 0, curlAmt, partAmt);
    if(seed){
      const m = Math.hypot(seed.x, seed.y, seed.z);
      if(m > 1e-9){
        const w = Math.min(1, m / PART3D.AMP) * PART_SWEEP_MIX;
        let bx = back.x + seed.x/m*w, by = back.y + seed.y/m*w, bz = back.z + seed.z/m*w;
        const bl = Math.hypot(bx, by, bz);
        if(bl > 1e-9) back = { x:bx/bl, y:by/bl, z:bz/bl };
      }
    }
  }
  /* 세기는 <b>뿌리</b>가 정한다(가르마와 같은 규칙). 점마다 다시 재면, 가닥이
     뒤통수 아래로 내려갈수록 두피가 휘어 -Z의 접선 성분이 <b>위쪽</b>으로 뒤집힌다
     — 뒤통수 가닥이 넘김 슬라이더에 들려 올라가는 잘못된 동작이 된다.
     어느 가닥이 얼마나 넘어가느냐는 그 가닥이 <b>어디서 자랐나</b>로 정해야 맞다.
     점마다 다시 구하는 건 방향뿐이고, 그게 휨을 만든다. */
  const t0 = scalpTangentAt(pts[0], back, E);
  const reach0 = Math.min(1, Math.hypot(t0.x, t0.y, t0.z));  // 0=두피에 수직(못 쓸림)
  const frac = Math.abs(s) * turn * reach0;                  // 0~1 = 얼마나 완전히 돌릴까
  if(frac < 1e-4) return pts;
  return bendStrandToDir3D(pts, scalpDirAt(back, E, frac), SWEEP3D.RAMP, SWEEP3D.TAIL, E);
}
/* 3D 경로용 — 가닥 전체에 가르마 이동을 얹는다. 뿌리(pts[0])는 고정.
   (2026-07-27) 넘김과 같은 이유로 점마다 방향을 다시 구한다. 갈라지는 방향
   자체는 <b>뿌리</b>가 정한다(분할선 어느 쪽인지는 뿌리로 결정 — 가닥이 이동한다고
   편이 바뀌면 안 된다). 바뀌는 건 그 방향을 두피 접선에 투영하는 지점뿐이다. */
function partStrand3D(pts, partVal, curlAmt, partAmt){
  if(!pts || pts.length < 2) return pts;
  const seed = partingPushHead(pts[0], partVal, curlAmt, partAmt);
  if(!seed) return pts;
  const mag = Math.hypot(seed.x, seed.y, seed.z);
  if(mag < 1e-9) return pts;
  const E = getHeadEllipsoid();
  const dir = { x:seed.x/mag, y:seed.y/mag, z:seed.z/mag };   // 뿌리가 정한 갈라짐 방향
  /* combStrand3D 규약: dirAt의 <b>길이</b>가 회전 비율(0~1)이다.
     partingPushHead의 크기는 AMP×근접도×정수리성이므로 AMP로 나누면 0~1이 된다
     (AMP는 이제 이동량이 아니라 정규화 상수 역할). TURN으로 최대 회전을 제한한다 —
     가르마는 넘김만큼 결을 완전히 돌리지는 않는다. */
  const frac = Math.min(1, mag / PART3D.AMP) * PART3D.TURN;
  return bendStrandToDir3D(pts, scalpDirAt(dir, E, frac), PART3D.RAMP, PART3D.TAIL, E);
}

// 3D 길이: 호길이 기준 트림(ratio<1)/연장(ratio>1). 연장은 마지막 진행방향 유지.
// ratio=1이면 원본 그대로. 뿌리 고정, 끝만 이동.
function lengthStrand3D(pts, ratio){
  if(!pts || pts.length < 2 || !(ratio > 0) || Math.abs(ratio-1) < 1e-6) return pts;
  // 누적 호길이
  const seg = [], cum = [0];
  for(let i=1;i<pts.length;i++){ const d=_v3len(_v3sub(pts[i],pts[i-1])); seg.push(d); cum.push(cum[i-1]+d); }
  const total = cum[cum.length-1]; if(total < 1e-9) return pts;
  const target = total * ratio;
  if(ratio < 1){
    // 트림: target 호길이 지점까지 포인트 취하고 마지막은 보간
    const out = [pts[0]];
    for(let i=1;i<pts.length;i++){
      if(cum[i] <= target){ out.push(pts[i]); }
      else { const t=(target-cum[i-1])/(seg[i-1]||1e-9); out.push(_v3add(pts[i-1], _v3scale(_v3sub(pts[i],pts[i-1]), t))); break; }
    }
    return out.length>=2 ? out : pts;
  } else {
    // 연장: 원본 전체 + 마지막 방향으로 (target-total) 만큼 추가 스텝
    const out = pts.slice();
    const dir = _v3norm(_v3sub(pts[pts.length-1], pts[pts.length-2]));
    const step = total / (pts.length-1);
    let added = 0; const extra = target - total; let cur = pts[pts.length-1];
    while(added < extra){ const d=Math.min(step, extra-added); cur=_v3add(cur,_v3scale(dir,d)); out.push(cur); added+=d; }
    return out;
  }
}

