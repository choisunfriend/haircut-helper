/* ══════════════════════════════════════════════════════════
   18-perf-i18n-boot.js — 성능 계측 · 패널 · HELPERS · 소비자용 스위치 · 다국어 · 부팅
   원본 index.html 29093~30240행. 클래식 스크립트이므로 로드 순서가 곧
   실행 순서다 — index.html의 <script src> 순서를 바꾸지 말 것.
   ══════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════════
   [성능] — 폰에서 <b>어디에 시간이 가고 메모리가 쌓이는가</b> (2026-08-19)
   ─────────────────────────────────────────────────────────────────
   사용자(갤럭시 A15): "버벅거리거나 멈춰" · "몇번 왔다갔다하다보면 <b>아예 다운</b>돼"
   화면 녹화를 프레임으로 뜯어 재 보니(4fps 표본 62초):
     뷰 전환 구간 <b>0.2fps</b> · 3D 결과보기 <b>1.8fps</b> · 미니3D 떠 있을 때 0.2fps
     62초 중 <b>약 50초가 정지</b>(24개 구간, 길게는 6.25초)
   그런데 "느리다"와 "다운된다"는 원인이 다르다. 느린 건 계산량이고, 다운은
   대개 <b>메모리</b>다. 지금 의심 가는 자리는 셋인데 어느 쪽인지 모른다:
     ① computeAdjustedHair3DStrands가 호출마다 가닥 2만 × 점 20개 =
        <b>점 객체 40만 개</b>를 새로 만든다({x,y,z} 객체다). 뷰 전환·슬라이더마다.
     ② 클립·마스크 경로가 document.createElement('canvas')를 여러 번 쓴다
        (파일 전체에 47곳). 캔버스 백킹스토어는 GC가 늦게 돌려준다.
     ③ 미니3D·본 3D의 렌더러·rAF 루프가 화면을 오갈 때 정리되는가.
   추측으로 깎으면 엉뚱한 데를 깎는다(작업원칙 1). 그래서 <b>먼저 잰다</b>.
   뷰를 한 번 그릴 때마다 한 줄 — 단계별 ms · JS 힙 · 살아있는 캔버스 수.
   힙이 뷰 전환마다 <b>계단처럼 올라가면</b> ①·②가 범인이고, 평평하면 순수 계산량이다.
   ⚠ performance.memory는 Chrome 계열에서만 나온다(폰 Chrome은 나온다).
   끄려면 PERF.on = false.
══════════════════════════════════════════════════════════════════ */
/* ── 그 계측으로 답이 나왔다 (2026-08-22) ────────────────────────────────
   두 번째 녹화(120초)를 프레임 단위로 다시 재니 <b>순위가 뒤집혀</b> 있었다:
     조정화면 0.1~2.2fps  /  3D 결과보기 <b>13~18fps</b>   (같은 폰, 같은 세션)
   더 무거운 쪽(WebGL·두개골·의상·가닥 수천)이 30배 빠르다 = 하드웨어가 아니라
   조정화면 구조 문제다. 사슬을 따라가서 나온 것 셋:
     ⓐ refreshDevMini3D가 <b>패널이 닫혀 있어도</b> stride 없이(=전 가닥) 재계산
     ⓑ measureRenderVsPhoto(캔버스 4개+블러 2패스)가 <b>매 프레임</b> 도는데
        출력은 뷰당 한 번뿐
     ⓒ 뷰만 바꿔도(섹션값·스타일링 동일) 조정 연산 전체를 처음부터 다시
   셋 다 그림을 안 바꾸고 없앨 수 있는 낭비다. 각각 ⓐMINI3D / ⓑRENDER_MATCH.
   everyFrame / ⓒADJ_CACHE에서 되돌릴 수 있게 두었다.
   ※ 세 번째 녹화(84초)에서는 <b>모든 캔버스가 백지</b>가 됐다(UI는 5~7회/초로
     멀쩡히 동작). JS가 죽은 게 아니라 크롬이 캔버스 백킹스토어를 회수한 모양이다
     — 그래서 아래 카운터를 <b>오프스크린까지</b> 세도록 고쳤다(perfLine 주석). */
const PERF = { on: true, lastHeap: 0, minGapMs: 700, _lastAt: 0 };
function perfCanLog(){
  const now = (typeof performance !== 'undefined') ? performance.now() : 0;
  if(now - PERF._lastAt < PERF.minGapMs) return false;
  PERF._lastAt = now; return true;
}
function perfHeapMB(){
  try{ const m = performance.memory; return m ? m.usedJSHeapSize/1048576 : null; }catch(e){ return null; }
}
/* ── 캔버스 카운터가 <b>정작 위험한 것을 안 세고 있었다</b> (2026-08-22) ────────
   예전엔 document.getElementsByTagName('canvas')뿐이었다. 그건 <b>DOM에 붙은</b>
   캔버스만 센다. 문제를 일으키는 것은 createElement로 만들어 DOM에 안 붙이는
   오프스크린 캔버스인데, 그건 이 숫자에 한 번도 안 나왔다 — 재는 자가 틀렸다.
   이제 셋을 같이 찍는다:
     DOM n개      — 화면에 붙어 있는 캔버스
     새로 N개     — 지금까지 새로 만든 누적 수(이 값이 계속 오르면 어딘가
                    프레임마다 새로 만들고 있다는 뜻)
     재사용 R개·풀 M MB — 풀이 돌려 쓴 횟수와 풀이 쥐고 있는 픽셀 용량 */
/* 폰용 — 진단정보 패널 <b>맨 위</b>에 찍는 같은 값들. 콘솔이 없는 기기에서
   스크린샷 한 장으로 "느린 건가 메모리인가"를 가르는 것이 목적이다.
   ※ 패널은 max-height 200px 스크롤 상자라 <b>줄 수를 아낀다</b> — 설명은 짧게. */
/* ══════════════════════════════════════════════════════════════════
   스타일스펙·포즈를 <b>패널에</b> (2026-08-25)
   ─────────────────────────────────────────────────────────────────
   applyStyleSpec은 섹션별 끝높이 오차·좌우차·페이드 mm·실루엣을 이미 다 재고
   있었는데 전부 console.log로만 나갔다. 노트북에서는 콘솔을 열면 됐지만
   실기기(폰)에는 콘솔이 없다 — 8/25 녹화 208초에 그 숫자가 <b>한 줄도</b> 안
   남았고, 그래서 tipAt을 고칠 근거를 못 얻었다.
   여기 두 함수는 <b>새로 재지 않는다</b>. state._lastSpec에 담긴 지난 계산을
   읽어 줄로 만들 뿐이다 — 패널을 열 때마다 이분탐색을 다시 돌면 8/22에 걷어낸
   그 낭비(진단이 렌더 비용을 만드는 모양)를 도로 만드는 것이다.
   포즈를 같이 찍는 이유: 실루엣 대조는 <b>뷰 각도가 맞다</b>는 전제 위에 서 있다.
   8/25 녹화에서 우측 뷰가 '근사yaw -0.5'로 찍혀 있었는데, 그게 사실이면 우측
   대조는 각도부터 어긋난 것이라 숫자를 믿으면 안 된다. 그래서 나란히 둔다.
══════════════════════════════════════════════════════════════════ */
function specPanelLines(){
  const S = state._lastSpec;
  if(!S || !S.rep) return ['[스타일스펙] 아직 적용 안 함 — 모드바의 스펙 버튼을 누르면 여기 숫자가 찍힙니다'];
  const r = S.rep, out = [];
  const secs = Object.keys(r.solved || {});
  const ago = Math.max(0, Math.round((Date.now() - S.at)/1000));
  out.push('[스타일스펙] ' + (S.name || S.id) + '  (' + ago + '초 전 적용)');
  /* 끝높이 오차는 <b>두상 높이 대비</b>다. 5%를 넘으면 눈에 보이는 차이라 표시한다 —
     그 섹션의 tipAt이 이 손님·이 두상에서 안 맞는다는 뜻이고, 고칠 자리가 거기다. */
  out.push('  오차(두상높이 대비) ' + (secs.length ? secs.map(s=>{
    const m = r.missY ? r.missY[s] : null;
    const c = (r.missCm && r.missCm[s] != null) ? '(' + (r.missCm[s]>0?'+':'') + r.missCm[s] + 'cm)' : '';
    return s + ' ' + (m == null ? '—' : (m*100).toFixed(1) + '%' + c + (Math.abs(m) > 0.05 ? '⚠' : ''));
  }).join(' ') : '(없음)'));
  /* (2026-08-26) 섹션마다 어느 어휘로 적혔는지 같이 찍는다 — cm 목표를 %오차로만
     보면 "왜 이 숫자가 이렇게 크지"를 못 읽는다(사이드는 클리퍼가 맡는 구역이다). */
  out.push('  길이(역산) ' + (secs.length ? secs.map(s=>
    s + ' ' + (r.solved[s] == null
        ? ((r.unit && r.unit[s] === 'clipper') ? '(클리퍼)' : '(가닥없음)')
        : r.solved[s] + ((r.unit && r.unit[s] === 'cm') ? 'cm' : ''))).join(' ') : '(없음)'));
  /* 범위 끝에 붙은 채 오차가 남았다 = 슬라이더 안에 답이 없었다. 조용히 넘어가면
     "스펙대로 됐다"로 읽히므로 콘솔과 같은 판정을 패널에도 그대로 옮긴다. */
  const stuck = secs.filter(s=> r.solved[s] != null && (r.solved[s] <= 0 || r.solved[s] >= 100)
    && r.missY && r.missY[s] != null && Math.abs(r.missY[s]) > 0.05);
  if(stuck.length) out.push('  ⚠ 못 푼 섹션 ' + stuck.join(' ') + ' — 슬라이더 범위 안에 답이 없음');
  const asym = Object.keys(r.asym || {}).filter(s=>Math.abs(r.asym[s]) > 0);
  out.push('  좌우차 ' + (asym.length ? asym.map(s=>s + ' ' + (r.asym[s]>0?'+':'') + r.asym[s]).join(' ')
    + ' (+ = 좌측을 더 길게)' : '없음 — 좌우 대칭'));
  if(r.fade) out.push('  페이드 ' + (r.fade.enabled
    ? '가드 ' + r.fade.guard + '(' + guardMm(r.fade.guard).toFixed(1) + 'mm)'
      + (r.fade.disc > 0 ? ' · 디스커넥션 ' + r.fade.disc + '%(두상높이)에서 끊김'
                         : ' · 높이 ' + r.fade.height + '% · 블렌딩 ' + r.fade.blendWidth + '%')
      + (r.fade.taper > 0 ? ' · 테이퍼 ' + r.fade.taper + '%' : ' · 테이퍼 없음')
    : '없음'));
  /* 실루엣: 레퍼런스(SILHOUETTE_REF)가 있는 스타일만 목표와 나란히 찍는다.
     taper_fade_pomp는 아직 레퍼런스가 없어서 <b>우리 값만</b> 나온다 —
     그 사실 자체가 보여야 "목표와 맞췄다"고 잘못 읽지 않는다. */
  const ref = (typeof SILHOUETTE_REF !== 'undefined') && SILHOUETTE_REF[S.id];
  const sil = r.silhouette;
  if(sil){
    if(!ref) out.push('  실루엣 (이 스타일은 레퍼런스 없음 — 우리 값만)');
    for(const a of ANGLES){
      const m = sil[a]; if(!m) continue;
      const t = ref && ref[a];
      out.push('   ' + a.padEnd(5) + ' W/H ' + m.wh.toFixed(2)
        + (t ? '/목표 ' + t.wh.toFixed(2) : '')
        + ' · 요철 ' + (m.botRough == null ? '—' : m.botRough.toFixed(3))
        + ' · 비침덩어리 ' + (m.seeRuns == null ? '—' : m.seeRuns)
        + ' · 가닥 ' + m.n);
    }
  }
  return out;
}
function posePanelLines(){
  const out = ['[뷰 포즈] 실루엣 대조는 이 각도가 맞다는 전제 위에 섭니다'];
  for(const a of ANGLES){
    let tier = '?', yaw = null, conf = null;
    try{ tier = getViewPoseSource(a).tier; }catch(e){}
    try{ yaw = getViewYawDeg(a); }catch(e){}
    try{ conf = getViewPoseConfidence(a); }catch(e){}
    out.push('  ' + a.padEnd(5) + ' ' + tier.padEnd(7)
      + ' yaw ' + (yaw == null ? '—' : yaw.toFixed(1) + '°')
      + (conf == null ? '' : ' · 신뢰도 ' + conf.toFixed(2))
      + (tier === 'pnp' ? '' : '  ← 실측 아님'));
  }
  return out;
}
function perfPanelLines(){
  const out = [];
  const heap = perfHeapMB();
  let dom = 0;
  try{ dom = document.getElementsByTagName('canvas').length; }catch(e){}
  out.push('[성능·메모리]  ' + (heap == null ? 'JS힙 (없음)' : 'JS힙 ' + heap.toFixed(0) + 'MB'));
  out.push('  캔버스 DOM ' + dom + ' · 새로 ' + CANVAS_POOL.made
    + ' · 재사용 ' + CANVAS_POOL.reused + ' · 풀 ' + canvasPoolMB().toFixed(1) + 'MB');
  out.push('  클립캐시 ' + CLIP_MASK_CACHE.hits + '/' + CLIP_MASK_CACHE.misses
    + ' · ' + adjCacheLine());
  /* ── 전수 회계 (2026-08-23) ────────────────────────────────────────
     위 두 줄은 <b>스크래치</b>만 센다. 실제로 제일 큰 덩어리는 뷰당 계속 들고
     있는 보관 캔버스(헤어·베이스·메움·정리본·진단)라 여태 한 번도 안 찍혔다.
     합계가 JS힙과 <b>따로</b>인 것에 주의 — 캔버스 백킹스토어는 힙 밖이다.
     즉 폰이 실제로 쓰는 양은 대략 <b>JS힙 + 아래 합계</b>다. */
  {
    const m = memCensus();
    /* 사진 <b>실제 크기</b>를 찍는다 (2026-08-23 6차). 8/23에 "보관이 왜 큰가"를
       두 번 틀렸는데 두 번 다 <b>입력 크기를 안 재고</b> 짐작한 탓이었다. 상한을
       걸었으니 그 상한이 실제로 먹었는지도 여기서 보여야 한다. */
    try{
      const a0 = state.currentViewAngle || ANGLES[0];
      const im0 = (typeof imgCache !== 'undefined') && imgCache[a0];
      if(im0 && im0.naturalWidth){
        out.push('  ▣ 사진 ' + im0.naturalWidth + '×' + im0.naturalHeight
          + ' (상한 ' + INPUT_RES.photoMax + ') · 분석 ' + INPUT_RES.maxDim
          + ' · 렌더 ' + INPUT_RES.drawRes);
      }
    }catch(e){}
    out.push('  ▣ 보관 ' + m.views.toFixed(0) + 'MB(뷰' + m.viewsN + ' · 파생 '
      + m.derived.toFixed(0) + ') · 사진 ' + m.photos.toFixed(0)
      + 'MB · 버퍼 ' + m.buffers.toFixed(0) + 'MB · 스크래치 ' + (m.pool + m.clip).toFixed(0) + 'MB');
    out.push('  ▣ 캔버스합계 ' + m.total.toFixed(0) + 'MB (힙과 별도)'
      + (heap != null ? ' → 대략 ' + (heap + m.total - m.adj).toFixed(0) + 'MB 사용' : '')
      + (isLowMemDevice() ? ' · 저사양판정' : ''));
  }
  out.push('  미니3D ' + (devMini3D ? (devMini3DVisible() ? '보임' : '숨김(계산X)') : '없음')
    + ' · 조명 ' + (FACE_MAT.unlit ? '얼굴무조명' : '얼굴조명') + ' ×' + FACE_MAT.lightScale);
  /* 얼굴이 <b>입체인가 평면인가</b> — 스틸로는 못 가르는 값이라 반드시 여기 찍는다. */
  if(FACE_BUILD.path === 'mesh'){
    const flat = FACE_BUILD.zRange != null && FACE_BUILD.ellC
      ? (FACE_BUILD.zRange / FACE_BUILD.ellC) : null;
    out.push('  얼굴 <입체메쉬> z범위 ' + (FACE_BUILD.zRange||0).toFixed(3)
      + (flat != null ? ' (두상깊이의 ' + Math.round(flat*100) + '%)' : '')
      + (FACE_BUILD.cmPerUnit ? ' ≈' + (FACE_BUILD.zRange*FACE_BUILD.cmPerUnit).toFixed(1) + 'cm' : '')
      + ' · 측면실측 ' + FACE_BUILD.sideHits + '점'
      + (flat != null && flat < 0.15 ? '  ⚠ 거의 평면' : ''));
    /* (2026-08-31) <b>왜</b> 평평한지를 가르는 두 줄. z범위 하나로는 "측면 실측이
       굴곡을 덮어썼다"와 "굴곡 자체가 작다"를 구별할 수 없다 — 폰에는 콘솔이 없다. */
    {
      const sy = FACE_BUILD.sideYaw || {};
      const fmt = (a)=> sy[a] ? a + ' ' + sy[a].yawAbs.toFixed(0) + '°(신뢰 '
                                + Math.round(sy[a].trust*100) + '%)' : a + ' 없음';
      const used = ['left','right'].some(a=>sy[a] && sy[a].trust > 0);
      out.push('  얼굴 측면깊이 ' + fmt('left') + ' · ' + fmt('right')
        + (used ? '' : '  ← 각도가 얕아 <b>깊이 보정 안 씀</b>(정면 굴곡 유지)'));
    }
    if(FACE_BUILD.reliefGain != null){
      out.push('  얼굴 굴곡 코돌출 ' + (FACE_BUILD.reliefCm != null ? FACE_BUILD.reliefCm.toFixed(1) + 'cm' : '?')
        + ' · 배율 ×' + FACE_BUILD.reliefGain.toFixed(2)
        + (FACE_BUILD.reliefGain >= 2.99 ? '  ⚠ 상한(원본 z가 너무 얕음)' : ''));
    }
  } else {
    out.push('  얼굴 <b>평면 데칼</b> — ' + (FACE_BUILD.why || '이유 미기록'));
  }
  out.push('  ("새로"가 열 때마다 계속 늘면 아직 매 프레임 새로 만드는 자리가 있음)');
  return out;
}
function perfLine(){
  if(!PERF.on) return '';
  const mb = perfHeapMB();
  let live = 0;
  try{ live = document.getElementsByTagName('canvas').length; }catch(e){}
  let txt = ' · 캔버스 DOM ' + live + '개'
          + ' · 새로 ' + CANVAS_POOL.made + '개/재사용 ' + CANVAS_POOL.reused + '회'
          + ' · 풀 ' + canvasPoolMB().toFixed(1) + 'MB'
          + ' · 클립캐시 ' + CLIP_MASK_CACHE.hits + '적중/' + CLIP_MASK_CACHE.misses + '재작성';
  if(mb != null){
    const d = PERF.lastHeap ? (mb - PERF.lastHeap) : 0;
    PERF.lastHeap = mb;
    txt += ' · JS힙 <b>' + mb.toFixed(0) + 'MB</b>'
        + (PERF.lastHeap && Math.abs(d) > 0.5 ? ' (' + (d>0?'+':'') + d.toFixed(0) + ')' : '');
  }
  return txt;
}
function disposeObject3D(obj){
  obj.traverse(node=>{
    if(node.geometry) node.geometry.dispose();
    if(node.material){
      const mats = Array.isArray(node.material) ? node.material : [node.material];
      // map(=사진 데칼의 CanvasTexture) dispose 추가 — 데칼은 재구성마다 새
      // 캔버스 텍스처를 새로 만들므로, 안 지우면 스트랜드 늘어날 때와 같은
      // 부류의 GPU 메모리 누수가 남는다.
      mats.forEach(m=>{ if(m.map) m.map.dispose(); m.dispose(); });
    }
  });
}

// 나중에 진짜 두상 파일(.glb)이 생기면 이 분기가 실행됨.
// GLTFLoader는 THREE 코어에 안 딸려있어서 실제 사용 시 별도 CDN 스크립트
// (three@0.128.0용 GLTFLoader.js) 추가가 필요 — procedural 단계에선 로드 안 함.
function loadHeadMeshFromGLTF(url){
  return new Promise((resolve, reject)=>{
    if(typeof THREE.GLTFLoader !== 'function'){
      reject(new Error('GLTFLoader 스크립트가 로드되지 않았습니다 — gltf 모드로 전환 시 CDN 스크립트 추가 필요'));
      return;
    }
    const loader = new THREE.GLTFLoader();
    loader.load(url, gltf=>resolve(gltf.scene), undefined, reject);
  });
}

async function loadHeadMesh(skinColorCss){ // faceMetrics 인자 제거 — buildProceduralHead가 더 이상 안 받음
  if(HEAD_MESH_SOURCE.type === 'gltf' && HEAD_MESH_SOURCE.url){
    const scene = await loadHeadMeshFromGLTF(HEAD_MESH_SOURCE.url);
    return { group: scene, headMesh: scene };
  }
  return buildProceduralHead(skinColorCss);
}

function initModel3DRenderer(container){
  const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.localClippingEnabled = true; // 실제 전신 OBJ 에셋의 머리/목 부분을 잘라내는 클리핑 플레인 사용(loadOutfitMeshFromOBJ 참고)
  // 버그 수정(2026-07-14): 기존 container.innerHTML='' 가 WebGL 캔버스만이
  // 아니라 뷰포트 안의 오버레이 UI(#model3dTag "범용 3D 두상" 태그,
  // "드래그해서 회전" 힌트, #strandDebugToggle "기준면 보기" 버튼)까지
  // 통째로 삭제하고 있었음 — 그래서 3D 화면에서 이 오버레이들이 어떤
  // 버전에서도 전혀 안 보였던 것(사용자 스크린샷으로 확인, "토글이 없다"의
  // 진짜 원인. setupModel3DScreen의 model3dTag 갱신 코드도 if(tag) 가드
  // 때문에 조용히 스킵되고 있어서 지금까지 아무 에러 없이 숨어 있었음).
  // → 이전 렌더러 캔버스만 골라서 제거하고 오버레이 요소들은 보존.
  // 오버레이는 전부 position:absolute라 static인 캔버스 위에 그려짐.
  container.querySelectorAll('canvas').forEach(c=>c.remove());
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, container.clientWidth/container.clientHeight, 0.1, 100);
  // 초기 위치는 임시값 — 실제 프레이밍은 모델을 다 구성한 뒤 frameCameraToHead()가
  // 바운딩 박스 기준으로 다시 계산해서 덮어씀 (아래 버그 수정 참고).
  camera.position.set(0, 0, 5);

  /* 조명 총량 — 키 0.9 + 필 0.35 + 앰비언트 0.55 = 최대 <b>1.8배</b>였다.
     알베도가 142만 넘으면 잘린다(142×1.8=256). 실측에서 목이 RGB(254,211,176)로
     빨강이 붙은 채 <b>완전히 평평</b>하게 나온 이유다 — 원기둥인데 음영이 없다.
     사진 얼굴은 위에서 무조명으로 뺐고, 여기서는 절차적 면이 <b>잘리지 않을</b>
     만큼으로 낮춘다. FACE_MAT.lightScale로 한 번에 되돌릴 수 있다. */
  const _ls = FACE_MAT.lightScale;
  const keyLight = new THREE.DirectionalLight(0xffffff, 0.9 * _ls);
  keyLight.position.set(1.5, 2, 2);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.35 * _ls);
  fillLight.position.set(-2, 0.5, 1);
  scene.add(fillLight);
  scene.add(new THREE.AmbientLight(0xffffff, 0.55 * _ls));

  const headGroup = new THREE.Group();
  scene.add(headGroup);

  // 드래그 회전 (OrbitControls 없이 직접 구현 — 가벼움 유지)
  let dragging=false, lastX=0, autoRotate=true;
  const dom = renderer.domElement;
  dom.style.touchAction='none';
  /* (2026-08-08) 좌우 드래그 = 회전(기존), <b>Shift/오른쪽 드래그 = 이동</b>,
     휠·핀치 = 확대. 회전만 있던 탓에 정수리가 프레임 밖이면 확인할 방법이 없었다. */
  let lastY=0, panning=false;
  dom.addEventListener('pointerdown', e=>{
    dragging=true; autoRotate=false; lastX=e.clientX; lastY=e.clientY;
    panning = e.shiftKey || e.button === 2 || e.button === 1;
  });
  dom.addEventListener('contextmenu', e=>e.preventDefault());  // 오른쪽 드래그를 이동으로 쓰므로
  window.addEventListener('pointerup', ()=>{ dragging=false; panning=false; });
  window.addEventListener('pointermove', e=>{
    if(!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    if(panning){
      const r = dom.getBoundingClientRect();
      MODEL3D_VIEW.panX -= dx / Math.max(1, r.width);
      MODEL3D_VIEW.panY += dy / Math.max(1, r.height);
      model3dApplyView();
    } else {
      headGroup.rotation.y += dx * 0.01;
    }
  });
  dom.addEventListener('wheel', e=>{
    e.preventDefault(); autoRotate=false;
    model3dZoomStep(Math.exp(-e.deltaY * 0.0016));
  }, { passive:false });
  /* ── 두 손가락 = 핀치 확대 + <b>드래그 이동</b> (2026-08-19) ────────────────
     사용자(갤럭시 A15): "3D결과보기에서 shift키를 이용할 수 없어서 상하이동이 안돼"

     맞다. 이동은 <b>Shift/우클릭/휠클릭</b>에만 걸려 있었다 — 셋 다 폰에 없다.
     휠 확대도 마찬가지고, 핀치만 대체가 있었다. 즉 <b>이동은 폰에서 아예 불가</b>였다.
     지도 앱의 표준 제스처를 따른다: 한 손가락 회전 · 두 손가락 드래그 이동 ·
     두 손가락 벌리기 확대(둘은 <b>동시에</b> 먹는다). 데스크톱 조작은 그대로 둔다.
     ※ 두 손가락이 닿는 순간 회전을 끈다 — 안 그러면 이동하는 동안 같이 돌아간다. */
  const tp = new Map();
  let pd = 0, pmid = null;
  function twoPtMid(m){
    const it = [...m.values()];
    return { x:(it[0].clientX + it[1].clientX)/2, y:(it[0].clientY + it[1].clientY)/2 };
  }
  dom.addEventListener('pointerdown', e=>{
    tp.set(e.pointerId, e);
    if(tp.size === 2){ pd = twoPtDist(tp); pmid = twoPtMid(tp); dragging = false; autoRotate = false; }
  });
  dom.addEventListener('pointermove', e=>{
    if(!tp.has(e.pointerId)) return;
    tp.set(e.pointerId, e);
    if(tp.size === 2){
      dragging = false; autoRotate = false;   // 이동 중 회전 금지(위 주석)
      const d = twoPtDist(tp), m = twoPtMid(tp);
      if(pd > 1 && d > 1) model3dZoomStep(d/pd);
      if(pmid){
        const r = dom.getBoundingClientRect();
        MODEL3D_VIEW.panX -= (m.x - pmid.x) / Math.max(1, r.width);
        MODEL3D_VIEW.panY += (m.y - pmid.y) / Math.max(1, r.height);
        model3dApplyView();
      }
      pd = d; pmid = m;
    }
  });
  const tpUp = e=>{ tp.delete(e.pointerId); if(tp.size<2){ pd=0; pmid=null; } };
  dom.addEventListener('pointerup', tpUp);
  dom.addEventListener('pointercancel', tpUp);
  dom.addEventListener('dblclick', e=>{ e.preventDefault(); model3dViewReset(); });

  const state3D = { renderer, scene, camera, headGroup, container, autoRotateRef:()=>autoRotate };

  /* ── 이 루프는 <b>한 번 시작하면 절대 안 멈춘다</b> (2026-08-23) ──────────
     cancelAnimationFrame이 파일 전체에 이 루프에 대해 <b>한 곳도 없다</b>
     (grep: animId는 대입 두 곳뿐). 3D 결과보기를 한 번 열면 그 뒤로 조정화면에
     있든 촬영화면에 있든, 두개골·의상·가닥 수천 개짜리 WebGL 장면이 세션이
     끝날 때까지 초당 60회 그려진다. 미니3D는 8/22에 같은 이유로 게이트를
     달았는데 <b>본체 쪽에는 안 달았다</b> — 같은 판정이 두 곳에 있고 한쪽만
     고쳐진, 이 파일의 단골 모양(작업원칙 3)이다.
     ⚠ rAF 자체는 살려 둔다(미니3D와 같은 이유 — 화면을 다시 열 때 재시작
       로직이 필요 없게). 비싼 render 호출만 건너뛴다.
     되돌리기: MOBILE_PERF.loopGate = false */
  function model3DVisible(){
    try{
      if(!MOBILE_PERF.loopGate) return true;
      if(typeof currentScreen !== 'undefined' && currentScreen === 'model3d') return true;
      const s = document.getElementById('screen-model3d');
      if(!s) return true;                                  // 모르면 예전 동작(그린다)
      return s.classList.contains('active') && s.offsetParent !== null;
    }catch(e){ return true; }
  }
  function animate(){
    model3D.animId = requestAnimationFrame(animate);
    if(!model3DVisible()) return;
    if(autoRotate) headGroup.rotation.y += 0.004;
    renderer.render(scene, camera);
  }
  model3D = { ...state3D, animId:null, initialized:true };
  animate();
  return model3D;
}

function resizeModel3D(){
  if(!model3D || !model3D.initialized) return;
  const { renderer, camera, container } = model3D;
  const w = container.clientWidth, h = container.clientHeight;
  if(w<=0||h<=0) return;
  renderer.setSize(w, h);
  camera.aspect = w/h;
  camera.updateProjectionMatrix();
  frameCameraToHead(); // 화면 크기(aspect)가 바뀌면 프레이밍도 다시 계산
}
window.addEventListener('resize', resizeModel3D);

// 버그 수정: 예전엔 camera.position을 (0,0.1,3.4) 같은 눈대중 값으로 고정해뒀는데,
// 실기기 스크린샷을 보니 두상이 화면을 꽉 채우고 눈·헤어·목이 전부 프레임 밖으로
// 잘려나가는 심한 줌인 버그였음(회전 자체는 되고 있었는데 특징 없는 곡면만 보여서
// "안 움직인다"고 느껴진 것). 원인은 카메라 거리/화각을 모델 실제 크기와 무관하게
// 손으로 대충 잡았던 것 — 화면 세로/가로 비율(aspect)에 따라 필요한 거리가 다른데
// 그걸 반영 안 함.
// → 모델의 바운딩 박스를 실측해서 세로 기준/가로 기준 두 필요거리 중 더 큰 쪽으로
// 카메라를 배치하도록 수정. 이렇게 하면 나중에 진짜 두상 3D 파일(다른 크기·비율)로
// 바꿔도 다시 눈대중으로 튜닝할 필요 없이 항상 알맞게 잡힘.
/* ── 3D 화면 확대/이동 (2026-08-08) ──────────────────────────────────
   사용자: "3D 이미지 나오는 마지막 단계도 마찬가지." — 여기도 고정 프레이밍만
   있고 손잡이가 없었다. 자동 프레이밍이 잡은 거리를 <b>기준</b>으로 두고
   배율·이동만 곱한다(프레이밍 로직 자체는 그대로) — 그래야 스타일을 바꿔
   모델이 재구성돼도 보던 배율이 유지된다. */
const MODEL3D_VIEW = { zoom: 1, panX: 0, panY: 0, min: 0.4, max: 12, base: null };
function model3dApplyView(){
  if(!model3D || !model3D.initialized || !MODEL3D_VIEW.base) return;
  const { camera } = model3D, B = MODEL3D_VIEW.base;
  const dist = B.dist / MODEL3D_VIEW.zoom;
  // 이동은 화면 비율로 — 거리에 비례해야 확대해도 같은 속도로 움직인다
  const k = dist * Math.tan(camera.fov*Math.PI/360) * 2;
  const ox = MODEL3D_VIEW.panX * k * camera.aspect, oy = MODEL3D_VIEW.panY * k;
  camera.position.set(B.cx + ox, B.cy + oy, B.cz + dist);
  camera.near = Math.max(0.01, dist/100);
  camera.far  = dist*100;
  camera.lookAt(B.cx + ox, B.cy + oy, B.cz);
  camera.updateProjectionMatrix();
  const el = document.getElementById('model3dZoomPct');
  if(el) el.textContent = Math.round(MODEL3D_VIEW.zoom*100) + '%';
}
function model3dZoomStep(mul){
  MODEL3D_VIEW.zoom = Math.max(MODEL3D_VIEW.min, Math.min(MODEL3D_VIEW.max, MODEL3D_VIEW.zoom*mul));
  model3dApplyView();
}
function model3dViewReset(){
  MODEL3D_VIEW.zoom = 1; MODEL3D_VIEW.panX = 0; MODEL3D_VIEW.panY = 0;
  if(model3D && model3D.headGroup) model3D.headGroup.rotation.set(0,0,0);
  model3dApplyView();
}

function frameCameraToHead(){
  if(!model3D || !model3D.initialized) return;
  const { camera, headGroup } = model3D;
  const box = new THREE.Box3().setFromObject(headGroup);
  if(box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  const vFov = camera.fov * Math.PI/180;
  const MARGIN = 1.45; // 프레임 가장자리에 여백을 두기 위한 배율
  const distForHeight = (size.y/2) / Math.tan(vFov/2);
  const distForWidth  = (size.x/2) / (Math.tan(vFov/2) * camera.aspect);
  const dist = Math.max(distForHeight, distForWidth) * MARGIN;

  // 자동 프레이밍 결과를 <b>기준</b>으로 보관하고, 사용자 배율·이동을 그 위에 얹는다
  MODEL3D_VIEW.base = { cx:center.x, cy:center.y, cz:center.z, dist };
  model3dApplyView();
}

// 'model3d' 화면 진입 시 셋업: 렌더러 최초 1회 생성(이후엔 재사용), 확정된
// 스타일 파라미터로 두상+헤어캡 다시 그림.
async function setupModel3DScreen(){
  const container = document.getElementById('model3dViewport');
  if(!container) return;

  if(!model3D || !model3D.initialized){
    initModel3DRenderer(container);
  } else {
    resizeModel3D();
  }

  // 이전에 그려둔 두상/헤어 제거 후 새로 구성 (스타일이 바뀌었을 수 있으므로).
  // 가닥이 수십~백여 개로 늘면서 dispose 없이 remove만 하면 GPU 메모리가
  // 재구성마다 누적되므로 disposeObject3D()로 geometry/material까지 정리.
  while(model3D.headGroup.children.length){
    const obj = model3D.headGroup.children[0];
    disposeObject3D(obj);
    model3D.headGroup.remove(obj);
  }
  model3D.headGroup.rotation.y = 0; // 프레이밍 계산이 항상 같은 기준(정면)에서 이뤄지도록 리셋

  model3DGeneration++;
  const myGen = model3DGeneration;

  // 실측 얼굴 비율(getFaceMetrics)과 실제 두피색(scalpColor — extractHairMask가
  // 이미 얼굴 피부에서 샘플링해뒀던 값, 지금까진 언더코트 색으로만 쓰이고 3D엔
  // 전혀 반영 안 되고 있었음)을 뽑아서 두상 생성에 넘긴다.
  const faceMetrics = getFaceMetrics();
  const skinColorCss = (state.hairMasks && state.hairMasks.front && state.hairMasks.front.scalpColor) || '#E8C39E';

  const { group } = await loadHeadMesh(skinColorCss);
  model3D.headGroup.add(group);

  // (2026-07-16 재작성) 3D 헤어 = "2D 전체를 3D 좌표로 그대로 옮기기" 단일 경로.
  // 사용자 지시: "그냥 전체를 3D좌표로 옮겨. 함수랑 섞으면 더 복잡해" —
  // 절차 생성(buildHairStrands)·AI 볼륨 보완·styleParams·viewMapping 등
  // 함수 기반 3D 헤어 경로를 이 화면에서 전부 제거. 아직 캡처 안 된 뷰는
  // 오프스크린 렌더로 경로를 먼저 확보해서 네 뷰 전부 옮기기로만 렌더.
  /* ── 조정 결과 연동 (2026-08-17 c) ──────────────────────────────────────
     사용자: "3D 미리보기 말고 마지막 3D 결과보기까지도 결과값을 연동시키고".
     예전 코드는 `buildAdjustedHair3DObject() || buildHairStrandsFromPaths()`라
     중립 모델이 없으면 <b>조용히</b> 2D 재캡처 리프트로 떨어졌다. 그런데 조정은
     전부 3D 연산자에 있고 2D 캡처 경로에서는 걷어냈으므로(2026-07-27 항목),
     그 폴백이 걸리는 순간 화면에는 <b>조정 이전</b>의 머리가 나온다 — 에러도
     경고도 없이. "3D로 갔더니 조정이 사라졌다"가 여기서 나온다.
     조정 화면을 안 거치고 바로 3D로 온 경우(스타일→결과→3D)가 정확히 그 상황이라
     드문 경로도 아니다. 그래서 <b>먼저 중립 모델을 확보</b>한다 — 조정 화면이
     scheduleHair3DRefresh로 하는 것과 같은 일이고, 이미 있으면 그냥 넘어간다.
     ※ 비중립 캡처(captureStrandPathsFor)는 폴백 경로에서만 필요하므로 아래로
       옮겼다. 정상 경로에서는 뷰 4장을 헛돌던 비용이 사라진다. */
  if(!state.hair3Dneutral){
    showAI('3D 두상에 조정 결과를 얹는 중…','조정 화면과 같은 모델을 만듭니다');
    await new Promise(res=>{
      try{ buildNeutralHair3D(res); }
      catch(e){ console.warn('[3D] 중립 모델 생성 실패 — 2D 리프트로 폴백:', e); res(); }
    });
    hideAI();
    if(myGen !== model3DGeneration) return; // 대기 중 화면 재구성됨 — 오래된 진행 중단
  }

  let liftedStrands = buildAdjustedHair3DObject();
  if(!liftedStrands){
    /* 폴백 — 사진은 있는데 중립 리프트가 실패한 경우에만 온다. 여기서만
       비중립 캡처가 필요하다(이 경로의 소스가 state.strandPaths이므로). */
    console.warn('[3D] 조정 반영 모델 없음 — 2D 캡처 리프트로 폴백(조정 이전 모양일 수 있음)');
    for(const a of ANGLES){
      const has = state.strandPaths && state.strandPaths[a] && state.strandPaths[a].strands && state.strandPaths[a].strands.length;
      if(!has && state.shots[a]) await captureStrandPathsFor(a);
    }
    if(myGen !== model3DGeneration) return; // 캡처 대기 중 화면 재구성됨 — 오래된 진행 중단
    liftedStrands = buildHairStrandsFromPaths();
  }
  if(liftedStrands){
    model3D.headGroup.add(liftedStrands);
  } else {
    // 사진/마스크가 하나도 없어 캡처 자체가 불가능한 경우 — 두상만 표시.
    // (절차 생성 폴백은 사용자 결정으로 제거 — 함수 생성 헤어를 섞지 않음)
    console.warn('[3D] 옮길 2D 가닥 경로가 없음 — 헤어 없이 두상만 표시');
  }

  // [진단용] 가닥 뿌리 기준면(가상 타원체) — "기준면 보기" 토글로 표시.
  // headGroup 재구성 때마다 새로 만들어 넣되, 토글 상태는 유지.
  const strandDebugMesh = buildStrandProjectionEllipsoidDebug();
  strandDebugMesh.visible = !!state.debugShowStrandSurface;
  model3D.headGroup.add(strandDebugMesh);

  // (3단계) 헤어스타일 기반 의상 추천 + 플레이스홀더 부착.
  // 버그 수정(2026-07-13): 예전엔 state.selectedStyle이 있어야만 실행됐는데,
  // "스타일 미적용"(프리셋 없이 직접 조정) 모드에서는 이 조건이 항상 false라
  // 의상 로딩 전체가 스킵되고 3D에 두상만 남는 원인이었음(recommendOutfitWithAI
  // 자체도 위에서 동일하게 수정). 정면 사진만 있으면 되도록 조건 완화 —
  // recommendOutfitWithAI 내부에서 style 유무에 따라 알아서 다르게 설명 구성.
  let outfitTag = '';
  if(state.shots && state.shots.front){
    showAI('AI가 어울리는 의상을 고르고 있어요…','헤어스타일 기반 추천 (데모)');
    const outfitRec = await recommendOutfitWithAI();
    hideAI();
    if(outfitRec && myGen === model3DGeneration){
      const outfitMesh = await loadOutfitMeshMeasured(outfitRec.item, faceMetrics.widthFactor);
      model3D.headGroup.add(outfitMesh);
      // (2026-08-31 11차) 옷깃을 이제 봤으니 목을 그 구멍 기준으로 다시 짓는다.
      refitNeckToGarment(model3D.headGroup,
        (state.hairMasks && state.hairMasks.front && state.hairMasks.front.scalpColor));
      outfitTag = ` · 의상 추천: ${outfitRec.item.name}(${outfitRec.item.category}, 데모)`;
    }
  }

  frameCameraToHead(); // 버그 수정: 모델 크기 기준으로 카메라 거리 자동 계산 (이전엔 눈대중 고정값이라 심하게 줌인됐었음)

  // 실측 정면 사진 기반 얼굴은 비동기(이미지 로드)라 두상·헤어부터 먼저
  // 그려서 화면이 비지 않게 한 뒤 나중에 얹는다. myGen이 그 사이 바뀌었으면
  // (화면을 벗어났다 다시 들어와 headGroup이 재구성된 경우) 오래된 결과를
  // 버린다. 진짜 3D 얼굴 메쉬(buildRealFaceMesh, 468개 랜드마크 기반 입체)를
  // 먼저 시도하고, rawLandmarks가 없는 경우(폴백 추정 랜드마크, 예전 캐시
  // 데이터 등) 기존 평면 데칼(buildFacePhotoDecal)로 자동 대체 — 신규
  // 실패 모드 추가 아님.
  buildRealFaceMesh(faceMetrics).then(realFace=>{
    if(realFace && myGen === model3DGeneration && model3D && model3D.initialized){
      model3D.headGroup.add(realFace);
      return;
    }
    // 폴백: 평면 데칼
    return buildFacePhotoDecal(faceMetrics).then(decal=>{
      if(!decal || myGen !== model3DGeneration || !model3D || !model3D.initialized) return;
      model3D.headGroup.add(decal);
    });
  }).catch(e=>console.warn('얼굴(실제 메쉬/데칼 둘 다) 첨부 실패(절차적 이목구비 유지):', e));

  const tag = document.getElementById('model3dTag');
  if(tag){
    const name = state.selectedStyle ? state.selectedStyle.name : '커스텀 스타일';
    tag.textContent = `범용 3D 두상 · ${name} 적용 (프로토타입)${outfitTag}`;
  }
}

/* ════════════════════════════════════════
   HELPERS
════════════════════════════════════════ */
function showAI(text,sub){
  document.getElementById('aiOverlayText').textContent=text;
  document.getElementById('aiOverlaySub').textContent=sub;
  document.getElementById('aiOverlay').classList.remove('hidden');
}
function hideAI(){ document.getElementById('aiOverlay').classList.add('hidden'); }

let toastTimer;
function showToast(msg){
  const el=document.getElementById('toast');
  el.textContent=msg; el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>el.classList.remove('show'),2800);
}

function startNewCustomer(){
  stylePrepDone=false;
  state.hair3D=null; state.hair3Dneutral=null; // (11차) 3D 모델 캐시도 새 고객마다 무효화
  if(typeof combClear === 'function') combClear();      // (#5) 빗질도 고객마다 초기화
  state.hairField3D=null; // (2026-08-01) 3D 결 필드도 사람이 바뀌면 통째로 무효
  state.hairOcc3D=null;   // (2026-08-01) 3D 점유 필드도 마찬가지
  state.hairIdentity=null; // (2026-08-01) 모발 프로필 — 사람이 바뀌면 당연히 버린다
  for(const k in _viewMaskCache) delete _viewMaskCache[k]; // 뷰 마스크 샘플러 캐시
  state.aiOutfitRecommendation=null; // (3단계) 의상 추천 캐시도 초기화
  _garmentNeckOpening = null;        // (11차) 옷깃 구멍 실측 — 사람·의상이 바뀌면 무효
  resetResultScreenCache();   // 결과 화면의 의상 메쉬/스냅샷 캐시(사람·의상이 바뀌면 전부 무효)
  _headCrossSectionCache = null; // 두상 실측 단면(Shape-from-Silhouette) 캐시도 새 고객마다 초기화
  _headVerticalRadiusCache = null; // 두상 세로 반지름 실측 캐시도 새 고객마다 초기화
  _headEllipsoidLogged = false; // [진단용] 두상 넙적도 로그도 새 고객마다 다시 1회 출력
  _headWidthGuardLogged = false;
  ANGLES.forEach(a=>{state.shots[a]=null;state.hairCanvases[a]=null;state.hairMasks[a]=null;state.baseCanvases[a]=null;state.baseFillCanvases[a]=null;});
  // 새 고객 — 앞 사람의 이마 표본을 물려주면 안 된다(피부톤이 다른 사람에게 이식됨)
  resetSkinGraft();
  ANGLES.forEach(a=>{ delete _graftLogged[a]; delete _plateLogged[a]; });
  state.landmarks = {};
  state.captureLmStatus = {}; // 촬영 직후 랜드마크 감지 배지 상태도 초기화
  state.capturePose = {};     // 셔터 시점 라이브 포즈(감지 실패 폴백)도 초기화
  state.poseEars = {};        // 후면 포즈 귀 앵커도 초기화
  _lastShotCanvas = null;     // 고품질 재인코딩용 보관 캔버스도 해제(메모리)
  state.strandPaths = {}; // 캡처된 2D 가닥 경로(3D 리프트 소스)도 초기화
  _silhouetteAnchorCache = {}; // 실루엣 앵커 캐시도 새 고객마다 초기화
  state.selectedStyle=null; state.pendingSpecId=null; state.specAppliedId=null;
  state.currentCaptureIndex=0; state.currentSection='crown';
  // 섹션 초기화
  SECTION_ORDER.forEach(id=>{
    state.sections[id] = {...SECTIONS[id].defaults};
  });
  state._globalCurl = 30;
  document.querySelectorAll('.style-card').forEach(c=>c.classList.remove('selected'));
  document.getElementById('toAdjustBtn').disabled=true;
  ['style','adjust','result','model3d'].forEach(id=>{ const t=document.getElementById('nav-'+id); if(t) t.disabled=true; });
  updateAngleUI();
  navTo('capture');
}

/* ══════════════════════════════════════════════════════════════════
   개발용 / 소비자용 한 소스 (2026-08-03)
   ─────────────────────────────────────────────────────────────────
   사용자: "앞으로 파일 2개 만드는 거 가능해? 지금같은 index와, 측정용으로 만든
   원본결보기·세그멘테이션 보기 등의 버튼과 측정치가 아래에 뜨는 걸 제거한
   소비자용 index"

   두 파일을 <b>따로 관리하지 않는다</b>. 갈라놓으면 이 다음에 고치는 것마다
   양쪽에 손으로 옮겨야 하고, 한 번만 빠뜨려도 두 파일이 조용히 달라진다.
   대신 아래 <b>한 줄</b>로 갈린다:

       const DEV_UI = true;    ← 개발용(index.html)
       const DEV_UI = false;   ← 소비자용(index-consumer.html)

   그 줄만 바꾼 사본이 소비자용 파일이다. 기능 코드는 완전히 같으므로
   "소비자용에서만 나는 버그"가 생길 자리가 없다.

   ── 무엇이 사라지나 ──
     · 가닥 보기 / 원본 결 보기 / 결필드 원본 — 렌더 경로 A/B 토글
     · 진단정보 버튼과 그 패널 — 실측치가 화면 아래에 뜨던 것
     · 세그멘테이션 상태 줄(캔버스 위 poseYaw·마스크픽셀 오버레이)
     · 3D 미리보기 ON/OFF 버튼 — 소비자용에선 항상 켜둔다(버튼이 필요 없음)
     · 기준면 보기(3D 화면의 가상 타원체 토글)
   ※ 3D 미리보기 <b>패널 자체</b>는 남긴다 — 진단이 아니라 손님에게 보여주는
     기능이다. console 로그도 그대로 둔다(화면에 안 보이고, 문제 생겼을 때
     손님 기기에서 그대로 받아볼 수 있는 유일한 단서다).
══════════════════════════════════════════════════════════════════ */
const DEV_UI = true;
const DEV_ONLY_IDS = [
  'maskDebugToggle',    // 가닥 보기 / 마스크 보기
  'rawDebugToggle',     // 원본 결 보기
  'fieldDebugToggle',   // 결필드 원본
  'diagInfoToggle',     // 진단정보 버튼
  'diagInfoBox',        // 〃 패널(실측치)
  'segStatus',          // 캔버스 위 세그멘테이션 상태 줄
  'btn3dEngine',        // 3D 미리보기 ON/OFF
  'strandDebugToggle',  // 기준면 보기(3D 화면)
];
function applyDevUiVisibility(){
  if(DEV_UI) return;
  for(const id of DEV_ONLY_IDS){
    const el = document.getElementById(id);
    if(el) el.style.display = 'none';
  }
  /* 3D 미리보기 패널은 원래 btn3dEngine으로만 켤 수 있었다. 버튼을 숨겼으니
     소비자용에서는 조정 화면에 들어갈 때 <b>알아서 켠다</b> — 안 그러면 영영
     안 뜬다. 이미 켜져 있으면 건드리지 않는다(끄는 일이 없어야 하므로).
     조정 경로 자체는 이 값과 무관하게 항상 3D를 거치므로(use3DAdjust 주석 참조)
     그림이 달라지지는 않는다. 패널이 뜨고 안 뜨고만 바뀐다. */
  const origNavTo = window.navTo;
  window.navTo = async function(name){
    const r = await origNavTo.apply(this, arguments);
    if(name === 'adjust' && !state.use3DAdjust) toggle3DAdjust();
    return r;
  };
}

/* ══════════════════════════════════════════════════════════════════
   다국어 (2026-08-03) — 기본 <b>영어</b>
   ─────────────────────────────────────────────────────────────────
   사용자: "첫번째 화면에 언어토글 하나 만들어서 영어를 디폴트로 해줘"

   ── 왜 t() 호출부를 안 고치는가 ─────────────────────────────────
   이 파일의 한국어 문구는 정적 HTML 49곳 + JS가 만들어 넣는 수백 곳에
   흩어져 있고, 그 대부분이 템플릿 문자열(`${ANGLE_LABELS[a]} 처리 중`)이다.
   전부 t()로 감싸면 손댈 자리가 수백 곳이고, 앞으로 문구를 하나 추가할
   때마다 또 감싸야 한다 — <b>기능 코드에 손을 안 대는 게 조건</b>이었다.
   그래서 출구 하나에서 잡는다: <b>DOM 텍스트 노드</b>. 어떤 경로로 만들어진
   문구든 화면에 보이려면 결국 텍스트 노드가 되고, MutationObserver가 그걸
   전부 본다. 진단 로그(console)는 텍스트 노드가 아니라서 자동으로 제외된다
   — 콘솔은 한국어로 남는 게 맞다(진단 문구는 개발자용).

   ── 두 단계 번역 ───────────────────────────────────────────────
     ① 정확 일치 — 사전에 통째로 있는 문구(대부분). 자연스러운 번역이 나온다.
     ② 부분 치환 — `좌측 얼굴 랜드마크 감지 ✓`처럼 값이 끼어든 문구.
        긴 열쇠부터 훑어 바꾼다. 어순이 완벽하진 않아도 읽힌다.
   ①에서 끝나는 게 대부분이고, ②는 안전망이다. 둘 다 못 찾으면 한국어가
   그대로 남는다 — <b>빈 화면이 되는 경우는 없다</b>.

   ── 되돌리기 ───────────────────────────────────────────────────
   번역하기 전 원문을 그 노드에 붙여 둔다(node.__ko). 한국어로 토글하면
   그걸 되쓴다 — 재번역이 아니라 <b>원문 복원</b>이라 왕복해도 안 뭉개진다.
══════════════════════════════════════════════════════════════════ */
const I18N = {
  // ── 헤더·단계 ──
  '단계':'Step', '1/4 · 촬영':'1/4 · Capture',
  '1/5 · 촬영':'1/5 · Capture', '2/5 · 스타일':'2/5 · Style', '3/5 · 조정':'3/5 · Adjust',
  '4/5 · 결과':'4/5 · Result', '5/5 · 3D두상':'5/5 · 3D Head',
  '촬영':'Capture', '스타일':'Style', '조정':'Adjust', '결과':'Result',
  // ── 촬영 화면 ──
  '카메라를 불러오는 중…':'Starting camera…',
  '아래 업로드 버튼도 이용 가능해요':'You can also use the Upload button below',
  '카메라가 준비되지 않았어요.':'The camera isn’t ready.',
  '지금 찍으세요':'Shoot now',
  '각도 측정 준비 중…':'Preparing angle detection…',
  '각도 감지 준비 중…':'Preparing angle detection…',
  '후면 감지 준비 중…':'Preparing back-view detection…',
  '정면을 가이드 안에 맞춰주세요':'Line your face up inside the guide',
  '정면을 맞춰주세요':'Face the camera straight on',
  '좌측면을 맞춰주세요':'Turn to your left profile',
  '왼쪽 옆머리가 보이게 — 고개를 오른쪽으로 돌려주세요':'Show your left side — turn your head to the right',
  '오른쪽 옆머리가 보이게 — 고개를 왼쪽으로 돌려주세요':'Show your right side — turn your head to the left',
  '후면(뒷머리)을 맞춰주세요':'Show the back of your head',
  '촬영 버튼을 눌러주세요':'Press the shutter button',
  '셔터 버튼을 눌러주세요':'Press the shutter button',
  '그대로 계세요 — 자동으로 찍습니다':'Hold still — shooting automatically',
  '정면':'Front', '좌측':'Left', '우측':'Right', '후면':'Back',
  '재촬영':'Retake', '업로드':'Upload', '다음→':'Next →', '← 촬영':'← Capture',
  '조정하기 →':'Adjust →', '← 스타일':'← Style', '결과 보기 →':'View result →',
  '← 조정':'← Adjust', '3D로 보기 →':'View in 3D →', '← 결과':'← Result', '새로 시작':'Start over',
  /* (2026-08-29) 실사 생성 관련 항목 일괄 삭제 — 그 화면과 그 코드가 없어졌다.
     '브라우저 저장소를 쓸 수 없어요.'는 여기 있었지만 커스텀 스타일 저장도
     쓸 수 있는 문구라 아래 스타일 화면 묶음으로 옮겨 살려 둔다. */
  '찍었습니다':'Captured', '셋':'Three', '둘':'Two', '하나':'One',
  // 라이브 가이드 판정
  '사람이 안 잡혀요':'No person detected',
  '뒷머리와 어깨가 화면에 들어오게 서주세요':'Stand so the back of your head and shoulders are in frame',
  '얼굴이 보여요':'Your face is showing',
  '고개를 앞으로 돌려 뒷머리만 보이게 해주세요':'Turn away so only the back of your head shows',
  '어깨가 안 잡혀요':'Shoulders not detected',
  '상체가 화면에 들어오게 서주세요':'Stand so your upper body is in frame',
  '몸이 옆으로 돌아갔어요':'Your body is turned sideways',
  '어깨가 화면과 나란해지게 서주세요':'Square your shoulders to the camera',
  '어깨를 수평으로 맞춰주세요':'Level your shoulders',
  '고개를 어깨와 나란히 정면으로 돌려주세요':'Center your head over your shoulders',
  '너무 옆으로 돌아갔어요':'Turned too far to the side',
  '뒷머리가 정면으로 오게 서주세요':'Point the back of your head at the camera',
  '정수리가 잘려요':'Top of head is cut off',
  '머리 위가 화면 밖이에요 — 조금 물러나 주세요':'The top of your head is out of frame — step back a little',
  '얼굴이 안 잡혀요':'No face detected',
  '눈·코 라인이 살짝 보이는 각도로 맞춰주세요':'Turn until your eye and nose line is just visible',
  '각도 계산 실패':'Angle calculation failed',
  '조금 왼쪽으로 돌려주세요':'Turn a little to the left',
  '조금 오른쪽으로 돌려주세요':'Turn a little to the right',
  '각도는 맞는데 얼굴 인식이 안 돼요 — 조금 덜 돌리거나, 얼굴 쪽을 밝게 해주세요':
    'Angle is right but the face isn’t detected — turn back slightly, or add light on your face',
  '다시 촬영을 권해요':'we recommend retaking it',
  '이 각도의 사진이 없습니다':'No photo for this angle',
  // ── 스타일 화면 ──
  '스타일 미선택':'No style selected', '스타일 미적용':'No style applied',
  '커스텀':'Custom',
  '브라우저 저장소를 쓸 수 없어요.':'Browser storage is unavailable.',
  // (2026-08-29) 스펙 스타일 카드의 태그 — 이름 두 개는 아래 모드바 묶음에 이미 있다
  '시스루 뱅 · 아웃컬':'See-through fringe \u00b7 flick-out ends',
  '테이퍼 페이드 · 사이드파트':'Taper fade \u00b7 side part',
  '원랭스':'One length', '한 라인 · 무게감 하단':'Single line · weight at the bottom',
  '그라데이션':'Graduation', '사선 · 무게 쌓임':'Diagonal · weight builds up',
  '유니폼 레이어':'Uniform layer', '균일 층 · 가벼움':'Even layers · light',
  '인크리스 레이어':'Increase layer', '위로 갈수록 길게':'Longer toward the top',
  // ── 조정 화면 ──
  '가닥 보기':'Strands', '원본 결 보기':'Original flow', '마스크 보기':'Mask',
  '스타일 보기':'Style', '결필드 원본':'Raw flow field', '얼굴박스 보기':'Face box',
  '원본 결 (스타일 미적용)':'Original flow (no style)',
  '진단정보':'Diagnostics', '3D 미리보기':'3D preview',
  '3D 미리보기: ':'3D preview: ', '3D 미리보기: OFF':'3D preview: OFF',
  '드래그 회전 · ⛶ 확대':'Drag to rotate · ⛶ zoom',
  '드래그해서 회전':'Drag to rotate', '기준면 보기':'Show reference surface',
  '드래그 회전 · 두 손가락(Shift+드래그) 이동 · 핀치(휠) 확대':'Drag to rotate · two-finger (Shift+drag) to move · pinch (wheel) to zoom',
  // ── 시술모드 (#5) ──
  '마네킹 초기화 ON':'Mannequin reset: ON', '마네킹 초기화 OFF':'Mannequin reset: OFF',
  '레이어드 보브':'Layered bob',
  '음성으로 조정하기':'Adjust by voice',
  '예: "크라운 길게", "네이프 짧게", "볼륨 추가"':'e.g. "crown longer", "nape shorter", "add volume"',
  '크라운·프론트·템플·사이드·후두부·네이프 + 길게·짧게·볼륨·컬':
    'Crown · Front · Temple · Side · Occipital · Nape  +  longer · shorter · volume · curl',
  '결원본 직접 조정':'Adjust the original flow directly',
  '초기화':'Reset', '★ 현재 모델을 스타일로 등록하기':'★ Save current model as a style',
  '이 스타일 이름을 입력하세요 (예: "오늘 손님 스타일")':'Name this style (e.g. "today’s client style")',
  '분석 중…':'Analyzing…', '잠시만 기다려주세요':'One moment please',
  '모델 로딩 중…':'Loading model…', '의상 준비 중…':'Preparing outfit…',
  '제휴 준비중':'Partnership coming soon',
  '범용 3D 두상 · 확정 스타일 적용':'Generic 3D head · final style applied',
  '확대/축소':'Zoom', '원래대로':'Reset view',
  // 섹션
  '크라운':'Crown', '프론트':'Front', '템플':'Temple',
  '사이드':'Side', '후두부':'Occipital', '네이프':'Nape', '스타일링':'Styling',
  '정수리 · 엘리베이션(시술각) 기준':'Top · elevation-driven',
  '앞머리 · 커팅라인(실제로는 Fringe 개념)':'Fringe · cutting line',
  '관자놀이 · 크라운 연동비율(Overdirection)':'Temples · overdirection to crown',
  '귀 앞·뒤 · 엘리베이션(시술각) 기준':'Around the ears · elevation-driven',
  '뒤통수 · 엘리베이션(시술각) 기준':'Back of head · elevation-driven',
  '목선 마무리 · 커팅라인':'Neckline finish · cutting line',
  // 설계 패널
  '커트':'Cut', '형태':'Shape', '펌':'Perm', '컬러':'Color', '선택':'optional',
  '길이':'Length', '모발 길이':'Hair length',
  '엘리베이션':'Elevation', '시술각':'lift angle',
  '엘리베이션(시술각)':'Elevation (lift angle)',
  '시술각(기법 강도 스케일)':'Lift angle (technique intensity)',
  '텍스처라이징':'Texturizing', '끝단 숱·질감':'End thinning · texture',
  '숱':'Density', '숱치기 · 낮을수록 비침':'Thinning · lower = see-through',
  '컬':'Curl', '컬 세기':'Curl strength', '0이면 펌 없음':'0 = no perm',
  '웨이브 폭':'Wave width', '로드 굵기':'rod diameter',
  '넘김':'Sweep', '앞으로':'forward', '뒤로':'back',
  '뿌리 볼륨':'Root volume', '눌러줌':'flat', '세움':'lifted',
  '결 흐름':'End flow', '안말음 C':'C-curl under', '바깥말음':'flick out',
  '가르마':'Part', '좌':'L', '우':'R',
  '마무리 질감':'Finish', '매트':'matte', '윤기':'shine',
  '커팅라인':'Cutting line', '크라운 연동비율':'Crown overdirection',
  '볼륨':'Volume', '연결감':'Connection', '레이어':'Layer',
  '커트 방식':'Cut method', '가드 번호':'Guard number', '0=스킨 · 8=1인치':'0 = skin · 8 = 1 inch',
  '페이드 높이':'Fade height', '로우~하이':'low → high',
  '블렌딩 폭':'Blend width', '테이퍼 레버':'taper lever', '영향: ':'Affects: ',
  // 의상
  // ── 값이 끼어드는 문구의 조각(부분 치환용) ──
  '얼굴 랜드마크 감지':'face landmarks detected', '랜드마크 감지 실패':'landmark detection failed',
  '랜드마크 감지':'landmark detection', '처리 중':'processing', '분석 중':'analyzing',
  '머리카락 추출 중…':'Extracting hair…', '얼굴 분석 중…':'Analyzing face…',
  'Hair Segmentation 준비 중':'Preparing hair segmentation',
  '슬롯인데 반대쪽 옆얼굴이에요':'slot, but this is the opposite profile',
  '슬롯인데 거의 정면이에요':'slot, but this is almost head-on',
  '옆머리 정보가 부족해요':'not enough side-hair information',
  '그대로 저장했어요':'saved as is',
  '⚠ 귀 2개가 다 보이는 상태는 아니에요 — 그대로 저장했어요':'⚠ Both ears aren’t visible — saved as is',
  '⚠ 얼굴 랜드마크가 안 잡히는 상태예요 — 그대로 저장했지만 3D가 부정확할 수 있어요':
    '⚠ No face landmarks detected — saved as is, but the 3D may be inaccurate',
  '오른쪽 귀가 가려졌어요':'Your right ear is hidden',
  '목표 각도':'target angle', '밖이에요':'is out of range',
  '스타일로 등록했어요':'saved as a style',
  '후면 정렬':'Back view aligned', '머리 치우침':'Head offset', '어깨 기울기':'Shoulder tilt',
  '고개 듦':'chin up', '고개 숙임':'chin down', '목표':'target',
  '더 돌려주세요':'turn further', '덜 돌려주세요':'turn back',
  '너무 옆모습':'too much profile', '오른쪽':'right', '왼쪽':'left',
  // ── 의상 ──
  '차콜 슈트':'Charcoal suit', '포멀':'Formal', '클래식':'Classic', '단정':'Sharp', '오피스':'Office',
  '슬레이트 캐주얼 셔츠':'Slate casual shirt', '캐주얼':'Casual', '편안함':'Relaxed',
  '데일리':'Daily', '뉴트럴':'Neutral', '올리브 롱슬리브':'Olive long sleeve', '차분함':'Calm',
  '버건디 셔츠':'Burgundy shirt', '포인트':'Accent', '포인트컬러':'Accent color', '개성':'Personality',

  /* ══ 2026-08-26 2차 — 화면에 남아 있던 한국어 일괄 수록 ══════════════════
     사용자 지시: "두 파일의 한국어가 있는 거 모두 영어로". 미국 살롱 설문에
     나가는 것은 index-consumer(DEV_UI=false)이므로 <b>진단 패널·콘솔은 뺀다</b>
     (그 화면 자체가 소비자용에서 사라진다 — DEV_ONLY_IDS 참고). 여기 들어간
     것은 소비자용에서 <b>실제로 보이는</b> 문구뿐이다.
     ⚠ 부분치환 열쇠를 새로 넣을 땐 위 경고를 다시 볼 것 — 이 앱에서 그 문구로만
       쓰이는 말이어야 한다. 아래 짧은 열쇠(없음·페이드·테이퍼·확대·기울기 등)는
       전부 <b>더 긴 열쇠가 같이 있어서</b> 긴 것부터 훑는 규칙에 보호받는다. */
  // ── 모드바(시술모드) ──
  '페이드 폼파두르':'Fade pompadour',
  '빗질 ON':'Comb: ON', '빗질 OFF':'Comb: OFF', '빗질 되돌리기':'Undo comb stroke',
  /* (2026-08-30) 빗질 손잡이가 스타일링 패널로 옮겨오면서 늘어난 문구 셋.
     '빗질'은 위 '빗질 ON/OFF'보다 <b>짧아서</b> 부분치환이 먼저 걸리면 안 되는
     열쇠다 — 이 사전이 긴 열쇠부터 시도하는지 확인하고 넣었다(tUI 참고). */
  '빗질':'Comb', '손으로 빗기':'Comb by hand',
  '컬·스타일링을 지운 마네킹 상태에서 시술을 시작합니다':
    'Start from a mannequin state with curl and styling cleared',
  /* (2026-08-29 2차) 스펙 버튼 두 개의 툴팁 항목 삭제 — 버튼이 없어졌다.
     이름('레이어드 보브'·'페이드 폼파두르')은 스타일 카드가 계속 쓰므로 남는다. */
  '한 손가락 드래그로 머리를 빗습니다 — 빗은 자리에 그대로 남습니다':
    'One-finger drag combs the hair \u2014 it stays where you comb it',
  '마지막 빗질 한 획을 되돌립니다':'Undo the last comb stroke',
  '3D 준비 중…':'Preparing 3D\u2026',
  '스타일 스펙 적용':'Style spec applied',
  '레이어드 보브 · 시스루 뱅 · 아웃컬':'Layered bob \u00b7 see-through fringe \u00b7 flick-out ends',
  '테이퍼 페이드 · 사이드파트 폼파두르':'Taper fade \u00b7 side-part pompadour',
  '기준면 숨기기':'Hide reference surface',
  '축소':'Zoom out', '확대':'Zoom in',
  'Language / 언어':'Language',
  // ── 설계 패널(커트/펌/스타일링) ──
  '오버디렉션':'Overdirection',
  '크라운 가이드로 끌어올림 · A라인':'Pulled up to the crown guide \u00b7 A-line',
  '컬 방향':'Curl direction', '안말음 ↔ 바깥말음':'under \u2194 out',
  '가르마 위치':'Part position', '가르마 세기':'Part strength',
  '없음':'none', '또렷':'defined',
  '정돈':'Sleek', '자연스럽게':'natural', '눌러붙임':'slicked down',
  '머리 전체 마무리 연출':'Overall finish for the whole head',
  '이 섹션만 다른 색 적용 (발레아쥬 등)':'Colour this section differently (balayage, etc.)',
  /* 염색 손잡이 (2026-09-03) — 새 문자열 세 개. 여기 안 적으면 EN 모드에서만
     한국어가 남는다(8/26 3차가 겪은 그 자리). placeholder도 I18N_ATTRS에 있어
     같이 번역된다. */
  '머리 전체를 한 색으로 (기본 염색)':'Colour the whole head (standard dye)',
  '머리 전체 색':'Whole-head colour',
  '머리 전체를 이 색으로 다시 칠하기':'Repaint the whole head in this colour',
  /* 드래그 조합기 (2026-09-03 2차). 축 이름·양끝 눈금은 <b>두 글자</b>라
     부분치환에 태우면 다른 문장을 갉아먹는다("색상은 뭐든…" 같은 자리) —
     I18N_EXACT_ONLY에 넣어 <b>정확히 그 칸일 때만</b> 바뀌게 한다. */
  '밝기':'Lightness', '채도':'Chroma', '색상':'Hue',
  '검정':'black', '백금':'platinum', '애쉬':'ash', '원색':'vivid',
  '화면 밖':'off-screen',
  '레벨 — 뿌리 어두움과 겨루는 축':'Level — the axis that fights root darkness',
  '0=무채색(애쉬) · 높을수록 원색':'0 = neutral (ash) · higher = more vivid',
  '0°빨강 · 90°노랑 · 150°초록 · 250°파랑':
    '0° red · 90° yellow · 150° green · 250° blue',
  '탭하면 색 넘버가 복사됩니다':'Tap to copy the colour number',
  '페이드':'Fade', '클리퍼 · 하단 그라데이션':'Clipper \u00b7 bottom gradient',
  '템플·사이드·후두부·네이프 하단(구레나룻·목선)에 적용':
    'Applies to the bottom of Temple \u00b7 Side \u00b7 Occipital \u00b7 Nape (sideburns \u00b7 neckline)',
  '테이퍼':'Taper',
  '0=블록(균일) · 100=아래가 스킨까지':'0 = block (even) \u00b7 100 = closed to skin at the bottom',
  '커스텀 스타일':'Custom style',
  '직접 조정한 스타일':'Hand-adjusted style',
  '태그':'tags',
  // ── 촬영 화면 ──
  '정면 촬영':'Shoot front', '좌측 촬영':'Shoot left',
  '우측 촬영':'Shoot right', '후면 촬영':'Shoot back',
  '카메라에 접근할 수 없습니다.':'Can\u2019t access the camera.',
  '아래 \"업로드\" 버튼을 이용해주세요.':'Please use the Upload button below.',
  '후면 슬롯인데 얼굴이 ':'Back slot, but a face was detected at ',
  '로 잡혔어요 — 뒷머리 사진이 맞나요?':' \u2014 is this really a photo of the back of the head?',
  '머리 위가 사진 밖이에요 — 정수리·뒷머리 윗부분이 \"숱 없음\"으로 나옵니다. 머리 위 여백이 남게 다시 찍어주세요':
    'the top of the head is outside the frame \u2014 the crown and upper back will read as \u201cno hair\u201d. Retake with some space above the head',
  '이 사진 밖이에요 — 두상 폭 실측이 어긋납니다':' is outside the frame \u2014 the head-width measurement will be off',
  '는 살렸지만 3D 정확도가 떨어져요. 조금 덜 돌린 각도로 다시 찍는 걸 권해요':
    ' was kept, but 3D accuracy drops. We recommend retaking with a little less rotation',
  '⚠ 후면 랜드마크 감지 실패 — 이 상태로도 진행은 되지만(추정치 폴백) 뒤통수를 살짝 돌려 귀·턱 라인이 걸리면 3D가 더 정확해져요':
    '\u26a0 No landmarks on the back view \u2014 you can still continue (estimated fallback), but turning slightly so an ear or jaw line shows makes the 3D more accurate',
  '눈·코 라인이 살짝 보이는 각도로 다시 촬영하면 3D 정확도가 올라가요':
    'retaking at an angle where the eye and nose line is just visible improves 3D accuracy',
  '잘림':'cut off', '이 잘려요 — 가운데로 맞춰주세요':' is cut off \u2014 center your head',
  '치우침':'offset', '기울기':'tilt', '랜드마크':'landmarks',
  ' · 고개 ':' \u00b7 chin ',
  ' — 턱을 수평으로 두고 다시 맞춰주세요':' \u2014 keep your chin level and line up again',
  '반대 방향이에요 — 고개를 ':'Wrong way \u2014 turn your head ',
  '으로 돌려 ':' and show the ',
  '옆머리를 보여주세요':'side of your hair',
  // ── 결과 · 의상 ──
  '의상 추천 없음':'No outfit recommendation',
  '쇼핑몰에서 보기 →':'View in shop \u2192',
  '추천 의상 · ':'Recommended \u00b7 ',
  '직접 선택한 의상':'Manually selected outfit',
  '의상 추천: ':'Outfit: ', '데모':'demo',
  '범용 3D 두상':'Generic 3D head', '적용 (프로토타입)':'applied (prototype)',
  // ── AI 오버레이 · 분석 ──
  'AI가 어울리는 의상을 고르고 있어요…':'Picking an outfit to match this look\u2026',
  '헤어스타일 기반 추천 (데모)':'Hairstyle-based recommendation (demo)',
  /* (2026-08-29) 스타일 추천 AI 관련 항목 삭제 — 얼굴형/머리색/길이 낱말표
     ('계란형'·'블랙'·'숏' 등)는 그 카드의 태그를 옮기려고만 있던 것이라 같이 뺀다. */
  '3D 두상에 조정 결과를 얹는 중…':'Applying your design to the 3D head\u2026',
  '조정 화면과 같은 모델을 만듭니다':'Building the same model as the adjust screen',
  // ── 음성 ──
  '음성인식은 Chrome에서만 작동해요.':'Voice input only works in Chrome.',
  '듣는 중… (탭하여 종료)':'Listening\u2026 (tap to stop)',
  '인식됨:':'Heard:',
  '명령을 이해하지 못했어요: ':'Didn\u2019t catch that command: ',
  /* ── 하네스(h_i18n.js)가 잡아낸 나머지 — 값이 끼어든 문구의 조각들 ────────
     실제 문장을 만들어 넣어 보고 한글이 남는 것만 여기 추가했다. 눈으로 사전을
     훑는 것과 다르다: `머리 ${where} 잘림`처럼 <b>조각이 사전에 다 있어도</b>
     이음매가 안 잡히는 자리가 나온다. */
  '결':'GYEOL',                       // 브랜드 마크(1글자 = 정확일치 전용)
  '머리 ':'head ',                    // `머리 ${오른쪽} 잘림` 류의 머리말
  '머리 위 잘림':'Top of head cut off',   // '위'는 1글자라 부분치환이 안 닿는다
  '고개를 ':'Your chin is ',
  '너무 들었어요':'too high', '너무 숙였어요':'too low',
  '덜 돌려주세요(너무 옆모습)':'less rotation \u2014 too much profile',
  '각도(yaw ':'angle (yaw ',
  '셔터가 ':'The shutter was ',
  '초 늦어 인식이 끊겼어요 — 초록불이던 순간의 프레임으로 저장했어요':
    's late and detection had dropped \u2014 saved the frame from when the guide was green',
  '이 주소는 Worker가 아닙니다(':'This URL is not a Worker (',
  'HTML 응답 ':'HTML response ',
  '). ⚙에서 주소를 다시 확인해주세요.':'). Check the URL again under \u2699.',
  '). Cloudflare Worker 주소가 맞는지 확인해주세요.':
    '). Check that this really is a Cloudflare Worker URL.',
  '서버 ':'Server ', '응답 없음':'no response',
};
/* 부분 치환에 쓰면 오히려 망가지는 열쇠 — <b>한 글자</b>라 다른 낱말 안에
   그냥 들어 있다('컬'은 '컬럼' 안에도 있다). 이것만 정확 일치로 제한한다.
   나머지는 긴 열쇠부터 훑기 때문에 '재촬영'이 '촬영'보다 먼저 걸려 안전하다. */
/* (2026-09-03 2차) 조합기 축 이름·눈금을 여기 넣는다 — 전부 두 글자라
   부분치환에 태우면 다른 문장 안에서 조용히 갈린다. */
const I18N_EXACT_ONLY = new Set(['좌','우','컬',
  '밝기','채도','색상','검정','백금','애쉬','원색']);
/* 긴 열쇠부터 — '엘리베이션(시술각)'이 '엘리베이션'보다 먼저 걸려야 한다. */
let _i18nSubKeys = null;
function i18nSubKeys(){
  if(!_i18nSubKeys){
    _i18nSubKeys = Object.keys(I18N)
      .filter(k => !I18N_EXACT_ONLY.has(k) && k.trim().length >= 2)
      .sort((a,b)=> b.length - a.length);
  }
  return _i18nSubKeys;
}
const HANGUL = /[가-힣]/;
function i18nTranslate(ko){
  const t = ko.trim();
  if(!t || !HANGUL.test(t)) return null;              // 숫자·기호만 — 건드릴 것 없음
  const hit = I18N[t];
  if(hit != null){                                    // ① 정확 일치 — 앞뒤 공백은 보존
    const lead = ko.slice(0, ko.indexOf(t[0]));
    const tail = ko.slice(lead.length + t.length);
    return lead + hit + tail;
  }
  let out = ko, changed = false;                      // ② 부분 치환(값이 끼어든 문구)
  for(const k of i18nSubKeys()){
    if(out.indexOf(k) < 0) continue;
    out = out.split(k).join(I18N[k]);
    changed = true;
  }
  return changed ? out : null;                        // 못 찾으면 한국어 그대로 둔다
}

let uiLang = 'en';        // ← 기본값. 'ko'로 바꾸면 한국어로 시작한다.
/* DOM 텍스트 노드가 <b>아닌</b> 문구용 — window.prompt()와 AI 프롬프트가 그것이다.
   옵저버는 화면에 그려진 텍스트 노드만 보므로 이 둘은 원리적으로 안 잡힌다.
   호출부를 다 고치지 않기 위해 만든 게 옵저버였고, 이건 옵저버가 못 닿는
   <b>몇 곳</b>만 쓰는 예외 통로다. 사전에 없으면 원문 그대로 돌려준다. */
function tUI(ko){
  if(uiLang !== 'en') return ko;
  const en = i18nTranslate(ko);
  return (en == null) ? ko : en;
}
let _i18nMuted = false;   // 우리가 고친 노드를 옵저버가 다시 보지 않게
const I18N_ATTRS = ['placeholder','title','aria-label'];

/* 재진입 안전: 이미 그 언어로 되어 있으면 <b>쓰지 않는다</b>. 안 쓰면 새 변경도
   안 생기니 옵저버가 되물려도 그 자리에서 멎는다(무한 루프 없음). */
function i18nApplyTextNode(node){
  if(uiLang === 'ko'){
    if(node.__ko != null && node.nodeValue !== node.__ko) node.nodeValue = node.__ko; // 원문 복원
    return;
  }
  if(node.__en != null && node.nodeValue === node.__en) return;   // 이미 번역됨
  const ko = (node.__ko != null && node.nodeValue === node.__ko) ? node.__ko : node.nodeValue;
  const en = i18nTranslate(ko);
  node.__ko = ko;
  if(en == null || en === ko){ node.__en = null; return; }
  node.__en = en;
  node.nodeValue = en;
}
function i18nApplyEl(el){
  for(const a of I18N_ATTRS){
    if(!el.hasAttribute || !el.hasAttribute(a)) continue;
    const key = '__ko_' + a;
    if(uiLang === 'ko'){ if(el[key] != null) el.setAttribute(a, el[key]); continue; }
    const ko = (el[key] != null) ? el[key] : el.getAttribute(a);
    const en = i18nTranslate(ko);
    if(en == null || en === ko) continue;
    el[key] = ko;
    el.setAttribute(a, en);
  }
}
function i18nWalk(root){
  if(!root) return;
  if(root.nodeType === 3){ i18nApplyTextNode(root); return; }
  if(root.nodeType !== 1) return;
  // <canvas>·<script>·<style> 안쪽은 볼 일이 없다
  const SKIP = { SCRIPT:1, STYLE:1, CANVAS:1, VIDEO:1 };
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode: (n)=> (n.nodeType === 1 && SKIP[n.tagName]) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
  });
  if(root.nodeType === 1) i18nApplyEl(root);
  let n;
  while((n = walker.nextNode())){
    if(n.nodeType === 3) i18nApplyTextNode(n); else i18nApplyEl(n);
  }
}
/* ── 루트가 <b>#app이면 안 된다</b> (2026-08-26) ───────────────────────────
   #toast와 #aiOverlay는 마크업에서 <b>#app 바깥</b>에 있다. 루트를 #app으로
   잡아 두는 바람에 토스트와 AI 오버레이("AI가 어울리는 의상을 고르고 있어요…")가
   <b>한 번도</b> 번역되지 않았다 — 사전에 문구를 넣어도 안 바뀌는 종류의
   버그라, 사전을 계속 늘리는 쪽으로 시간을 쓰게 만든다. body를 루트로 잡는다
   (SKIP에 SCRIPT·STYLE·CANVAS·VIDEO가 이미 있어 훑는 비용은 그대로다). */
function i18nRoot(){ return document.body || document.getElementById('app'); }
function applyUiLang(){
  _i18nMuted = true;
  try{ i18nWalk(i18nRoot()); }
  finally{ _i18nMuted = false; }
  const btn = document.getElementById('langToggle');
  if(btn) btn.textContent = (uiLang === 'en') ? 'EN' : '한국어';
  document.documentElement.lang = uiLang;
}
function setUiLang(lang){
  uiLang = (lang === 'ko') ? 'ko' : 'en';
  applyUiLang();
}
function toggleUiLang(){ setUiLang(uiLang === 'en' ? 'ko' : 'en'); }

/* JS가 새로 넣는 문구(토스트·힌트·스타일 카드·진단 패널…)를 자동으로 잡는다.
   호출부를 하나도 안 고쳐도 되는 이유가 이것이다. */
function initI18nObserver(){
  const root = i18nRoot();
  if(!root || typeof MutationObserver === 'undefined') return;
  const obs = new MutationObserver((muts)=>{
    if(_i18nMuted) return;
    _i18nMuted = true;
    try{
      for(const m of muts){
        if(m.type === 'characterData') i18nApplyTextNode(m.target);
        else for(const n of m.addedNodes) i18nWalk(n);
      }
    } finally { _i18nMuted = false; }
  });
  obs.observe(root, { childList:true, subtree:true, characterData:true });
}
(function initI18n(){
  const boot = ()=>{ applyDevUiVisibility(); applyUiLang(); initI18nObserver(); };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
