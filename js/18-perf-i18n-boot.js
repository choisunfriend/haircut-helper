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
  /* ── 기능별 진단 줄 — 예전엔 기능 파일(31~69)마다 perfPanelLines를 감싸 끝에 붙였다. 붙던 순서 그대로 여기서 붙인다. ── */
  {
    // 앞머리 눈 가림 검사(17a FACE_COVER_CHECK)
    const L = FACE_COVER_CHECK.last;
    out.push(!L ? '[얼굴 가림] 아직 검사 안 함(스타일 적용 후 표시)' :
      '[얼굴 가림] ' + L.id + ' — ' + (L.bad.length ? '⚠ ' + L.bad.join(' · ') + ' (스펙에서 길이/시술로 수정)' : '없음'));
  }
  out.push(MOBILE_DIET.panelLine());   // 폰 다이어트(18)
  out.push(TWO_PASS._panelLine());     // 두 번 그리기(15)
  out.push(GPU_DIET._panelLine());     // GPU 다이어트(18)
  out.push(...ORIG_ASIS._panelLines()); // 원본 옮기기 재기(17b)
  out.push(...REGROW._panelLines());    // 다시 기르기(17b)
  out.push(ADJUST3D._panelLine());      // 조정 3D(18)
  out.push(NATURAL_GROW._panelLine());  // 길이 늘리기(14)
  out.push(STRAND_BUDGET._panelLine()); // 가닥 수(17b)
  out.push(PHOTO_CHANGE._panelLine());  // 사진 바뀜(05)
  out.push(...SHOULDER._panelLines());  // 어깨(13a)
  try{ out.push(...ROOTS_FALLBACK.lines()); }catch(e){}   // 뿌리 대체(13b)
  try{ out.push(...VIEWS360.lines()); }catch(e){}         // 360 뷰(13b)
  try{ out.push(...READ_STEPS.lines()); }catch(e){}       // 결 읽기 단계(34) — 건너기·채우기·정렬 전후
  out.push(...COMB3D._panelLines());    // 빗질 3D(17a)
  out.push(...BODY_SEG_WAIT._panelLines()); // 사람 윤곽(03b)
  out.push(...FLY_TRIM._panelLines());  // 잔머리 정리(17a)
  try{ if(REGROW.on) out.push(...NEIGHBOR_ALIGN.lines()); }catch(e){}   // 이웃 결 정렬(17b)
  out.push(...SPEC_PASS._panelLines()); // 스펙 넘기기(17b)
  try{ out.push(...ORIG_MQ.lines()); }catch(e){}   // 원본=마네킹+스펙(17b)
  try{ out.push(...FLOW_SPEC.lines()); }catch(e){}  // 결 표(17b)
  try{ out.push(...PHOTO_CHECK.lines()); }catch(e){} // 원본 대조(07b)
  try{ out.push(...PHOTO_CURL.lines()); }catch(e){}  // 사진 컬(17b)
  try{ out.push(...READ_SHAPE.lines()); }catch(e){}  // 읽은 모양(17b)
  try{ out.push(...STYLE_PATHS.lines()); }catch(e){} // 스타일 길(17b)
  try{ out.push(...HAIR_LOOK.lines()); }catch(e){}   // 머리 빛(18)
  try{ out.push(...SEG_ORIENT.lines()); }catch(e){}  // 영역·결 보강(04)
  try{ out.push(...VIEW_ALIGN.lines()); }catch(e){}  // 사진 맞춤(17b)
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

/* ==========================================================================
 * GPU_DIET (옛 40-gpu-diet.js) — GPU·메모리 점유 자체를 줄이기 (보여 주는 순서가 아니라 일을 줄임)
 *
 * 자리: 18, initModel3DRenderer 바로 앞. 연결 지점 —
 *   · initModel3DRenderer(18) 끝에서 GPU_DIET._patchRenderer(model3D)  — ①
 *   · activateScreen(05) 맨 앞 GPU_DIET._beforeActivate · 맨 끝 GPU_DIET._afterActivate  — ②
 *   · runStyleAnalysisPipeline(05) 바깥 단계 → GPU_DIET._pipe → runStyleAnalysisPipelineBase  — ②
 *   · perfPanelLines(18) 끝에 GPU_DIET._panelLine()  — ③
 *
 * ① 3D 결과 화면: 바뀐 게 없으면 다시 그리지 않기
 *    원래 루프는 3D 화면에 있는 동안 매 프레임(초당 60번) 헤어 선 전체·두상·의상을 다시 그립니다.
 *    가만히 보고 있을 때도, 자동 회전 중에도요.
 *    · 카메라·두상 회전·장면 구성이 직전에 그린 것과 같으면 건너뜁니다.
 *      (놓친 변화가 있어도 보이도록 idleMs마다 한 번은 무조건 그림 — 텍스처가 뒤늦게 뜨는 경우 등)
 *    · 저사양 판정 기기는 움직이는 중에도 초당 30번까지만 그립니다. 자동 회전 속도는 그대로입니다
 *      (회전각은 원래 루프가 매 프레임 올리고, 그리기만 한 번 걸러 함).
 *
 * ② 분석용 모델을 분석이 끝난 뒤 내려놓기
 *    머리 분리(MediaPipe) · 몸 분리(TF.js) · 얼굴 랜드마크 · 포즈 모델은 촬영·분석 때만 쓰이는데,
 *    앱을 열 때 올라와서 한 번도 내려가지 않았습니다(close/dispose 호출 없음).
 *    조정·3D 화면에 들어가고 holdMs 뒤에 내려놓고, 촬영 화면으로 돌아오면 다시 올립니다.
 *    분석(runStyleAnalysisPipeline)이 불리면 모델이 다 올라올 때까지 기다렸다가 시작합니다.
 *    ⚠ faceLandmarkerReady는 내려놓은 동안에도 true로 둡니다 — 조정 화면 렌더가 이 값이 true일 때만
 *      섹션 경계를 보정(refineSectionBoundaries)하기 때문입니다. 촬영 화면으로 돌아오는 순간 false로 내리고
 *      다시 올라오면 원래 코드가 true로 올립니다.
 *    대가: 재촬영·새 손님 때 모델이 다시 올라오는 몇 초.
 *
 * ③ 진단 줄 [GPU] — 3D 그리기 횟수(그림/건너뜀) · 장면의 선·삼각형 수 · 그림판 크기 · TF.js가 잡은 GPU 메모리 ·
 *    모델을 내려놓기 전/후.
 *
 * 끄기: GPU_DIET.on=false (전부) · .skipIdle=false · .cap30=false · .releaseModels=false
 * 상태: GPU_DIET.status()
 * ========================================================================== */
var GPU_DIET = (function () {
  'use strict';
  var W = window, TAG = '[GPU 다이어트]';
  var G = Object.assign({
    on: true,
    skipIdle: true,       // ① 바뀐 게 없으면 3D를 다시 그리지 않음
    idleMs: 500,          //    그래도 이만큼마다 한 번은 그림
    cap30: null,          //    초당 30번 상한 — null이면 저사양 판정 기기만
    releaseModels: true,  // ② 분석 끝난 뒤 모델 내려놓기
    holdMs: 2500          //    조정·3D 화면에 들어간 뒤 이만큼 지나서
  }, W.GPU_DIET || {});
  var S = G.stats = { drawn: 0, skipped: 0, released: 0, reloaded: 0, tfBefore: null, tfAfter: null, lastErr: null };

  function now() { try { return performance.now(); } catch (e) { return Date.now(); } }
  function scr() { try { return currentScreen; } catch (e) { return ''; } }
  function lowMem() { try { return typeof isLowMemDevice === 'function' && isLowMemDevice(); } catch (e) { return false; } }

  /* ────────────────────────────────────────────────────────────────────────
   * ① 3D 그리기 건너뛰기
   * ────────────────────────────────────────────────────────────────────── */
  function sceneSig(m) {
    var c = m.camera, g = m.headGroup, a = [], n = 0, vis = 0;
    a.push(c.position.x, c.position.y, c.position.z, c.quaternion.x, c.quaternion.y, c.quaternion.z, c.quaternion.w, c.fov, c.aspect, c.near);
    a.push(g.rotation.x, g.rotation.y, g.rotation.z, g.position.x, g.position.y, g.position.z, g.scale.x, g.visible ? 1 : 0);
    m.scene.traverse(function (o) { n++; if (o.visible) vis = (vis * 31 + n) | 0; });
    var el = m.renderer.domElement;
    a.push(n, vis, el.width, el.height);
    return a.join(',');
  }
  var forced = false;
  G.markDirty = function () { forced = true; };
  function patchRenderer(m) {
    if (!m || !m.renderer || m.renderer.__gpuDiet) return;
    var rnd = m.renderer, orig = rnd.render, lastSig = null, lastAt = 0;
    rnd.__gpuDiet = true;
    rnd.render = function (scene, camera) {
      if (!G.on || scene !== m.scene) return orig.apply(this, arguments);
      var t = now(), sig = null;
      try { sig = sceneSig(m); } catch (e) { sig = null; }
      if (forced) { forced = false; sig = null; }                 // 내용이 바뀌었다고 알려 옴(43번: 헤어 갈아 끼움) — 바로 그림
      if (sig !== null) {
        if (sig === lastSig) {
          if (G.skipIdle && t - lastAt < G.idleMs) { S.skipped++; return; }
        } else {
          var cap = G.cap30 == null ? lowMem() : G.cap30;
          if (cap && t - lastAt < 30) { S.skipped++; return; }         // 움직이는 중: 초당 30번까지
        }
      }
      lastSig = sig; lastAt = t; S.drawn++;
      return orig.apply(this, arguments);
    };
  }
  /* initModel3DRenderer(18) 끝에서 부름 */
  G._patchRenderer = function (m) {
    try { patchRenderer(m); } catch (e) { console.warn(TAG + ' 3D 그리기 고침 실패', e); }
  };

  /* ────────────────────────────────────────────────────────────────────────
   * ② 분석용 모델 내려놓기 / 다시 올리기
   * ────────────────────────────────────────────────────────────────────── */
  var released = false, faceReleased = false, reloadP = null, relTimer = null;
  function tfGpuMB() {
    try { var m = tf.memory(); return typeof m.numBytesInGPU === 'number' ? m.numBytesInGPU / 1048576 : null; } catch (e) { return null; }
  }
  function tryCall(o, name) { try { if (o && typeof o[name] === 'function') o[name](); } catch (e) { S.lastErr = String(e && e.message || e); } }

  function releaseNow(why) {
    if (!G.on || !G.releaseModels || released || reloadP) return;
    try {
      if (typeof stylePrepDone === 'undefined' || !stylePrepDone) return;      // 분석이 아직 안 끝남
      if (typeof segmenterReady === 'undefined' || (!segmenterReady && !segmenterError)) return;   // 아직 올라오는 중
      var sc = scr();
      if (sc !== 'adjust' && sc !== 'model3d') return;
      S.tfBefore = tfGpuMB();
      try { tf.env().set('WEBGL_DELETE_TEXTURE_THRESHOLD', 0); } catch (e) {}   // 풀어 준 텍스처를 쌓아 두지 않고 바로 지움

      // 머리 분리(MediaPipe) · 몸 분리(TF.js) — segmenter가 둘 중 하나를 가리킴
      var tfModels = [];
      if (typeof bodySegmenter !== 'undefined' && bodySegmenter) tfModels.push(bodySegmenter);
      if (segmenter && segmenter !== mpImageSegmenter && tfModels.indexOf(segmenter) < 0) tfModels.push(segmenter);
      tryCall(mpImageSegmenter, 'close');
      tfModels.forEach(function (mdl) { tryCall(mdl, 'dispose'); });
      mpImageSegmenter = null; segmenter = null; segmenterReady = false; segmenterError = false;
      if (typeof bodySegmenter !== 'undefined') bodySegmenter = null;

      // 얼굴 랜드마크 — Ready 값은 그대로 둠(조정 화면 섹션 경계 보정이 이 값에 걸려 있음)
      faceReleased = false;
      if (typeof faceLandmarker !== 'undefined' && faceLandmarker && faceLandmarkerReady) {
        tryCall(faceLandmarker, 'close'); faceLandmarker = null; faceReleased = true;
      }
      // 포즈(후면 촬영용) — 필요할 때 원래 코드가 다시 올림
      if (typeof posePoseLandmarker !== 'undefined' && posePoseLandmarker && poseLandmarkerState === 'ready') {
        tryCall(posePoseLandmarker, 'close'); posePoseLandmarker = null; poseLandmarkerState = 'idle';
      }
      released = true; S.released++;
      S.tfAfter = tfGpuMB();
      console.log(TAG + ' 분석용 모델 내려놓음 (' + why + ') — TF.js GPU ' +
        (S.tfBefore == null ? '?' : S.tfBefore.toFixed(1)) + ' → ' + (S.tfAfter == null ? '?' : S.tfAfter.toFixed(1)) + 'MB');
    } catch (e) { S.lastErr = String(e && e.message || e); console.warn(TAG + ' 모델 내려놓기 실패', e); }
  }

  /* 모델이 필요해지면 부름. 내려놓은 적이 없으면 아무것도 안 함. 돌려주는 값: 다 올라오면 풀리는 Promise */
  function ensureModels(why) {
    if (relTimer) { clearTimeout(relTimer); relTimer = null; }
    if (reloadP) return reloadP;
    if (!released) return Promise.resolve();
    released = false; S.reloaded++;
    console.log(TAG + ' 분석용 모델 다시 올림 (' + why + ')');
    var jobs = [];
    try {
      if (faceReleased) { faceLandmarkerReady = false; faceReleased = false; jobs.push(Promise.resolve(initFaceLandmarker())); }
      jobs.push(Promise.resolve(initSegmenter()).then(function () { return initBodySegmenter(); }));
    } catch (e) { S.lastErr = String(e && e.message || e); console.warn(TAG + ' 모델 다시 올리기 실패', e); }
    var done = function () { reloadP = null; };
    reloadP = Promise.all(jobs.map(function (p) { return p.then(null, function (e) { S.lastErr = String(e && e.message || e); }); })).then(done, done);
    return reloadP;
  }
  G.ensureModels = ensureModels;
  G.releaseNow = function () { releaseNow('직접 호출'); };

  /* activateScreen(05) 맨 앞 — 원래 코드(라이브 가이드)보다 먼저 Ready 값을 내려 둬야 함 */
  G._beforeActivate = function (name) {
    if (name === 'capture') ensureModels('촬영 화면');
  };
  /* activateScreen(05) 맨 끝 — 조정·3D 화면에 들어가면 holdMs 뒤 내려놓기 */
  G._afterActivate = function (name) {
    if (name === 'adjust' || name === 'model3d') {
      if (relTimer) clearTimeout(relTimer);
      relTimer = setTimeout(function () { relTimer = null; releaseNow(name + ' 화면'); }, G.holdMs);
    } else if (relTimer) { clearTimeout(relTimer); relTimer = null; }
  };
  /* runStyleAnalysisPipeline(05) 바깥 단계 — 모델을 내려놓았으면 다 올라올 때까지 기다렸다가 분석 */
  G._pipe = function (self, args) {
    if (!released && !reloadP) return runStyleAnalysisPipelineBase.apply(self, args);
    try { if (typeof showAI === 'function') showAI('모델 로딩 중…', '분석 모델을 다시 준비하고 있어요'); } catch (e) {}
    return ensureModels('분석').then(function () { return runStyleAnalysisPipelineBase.apply(self, args); });
  };
  // 촬영 직후의 얼굴 확인은 원래 코드가 faceLandmarkerReady를 5초까지 기다림 — 따로 고칠 것 없음.

  /* ────────────────────────────────────────────────────────────────────────
   * ③ 진단 줄
   * ────────────────────────────────────────────────────────────────────── */
  G.status = function () {
    var o = { drawn: S.drawn, skipped: S.skipped, modelsReleased: released, released: S.released, reloaded: S.reloaded,
      tfGpuMB: tfGpuMB(), tfBefore: S.tfBefore, tfAfter: S.tfAfter, lastErr: S.lastErr };
    try {
      if (typeof model3D !== 'undefined' && model3D && model3D.initialized) {
        var inf = model3D.renderer.info, el = model3D.renderer.domElement;
        o.scene = { lines: inf.render.lines, triangles: inf.render.triangles, calls: inf.render.calls,
          geometries: inf.memory.geometries, textures: inf.memory.textures, canvas: el.width + '×' + el.height };
      }
    } catch (e) {}
    return o;
  };
  function f1(v) { return v == null ? '?' : (Math.round(v * 10) / 10); }
  /* perfPanelLines(18) 끝에 붙는 줄 */
  G._panelLine = function () {
    var st = G.status(), sc = st.scene;
    var tot = st.drawn + st.skipped;
    return '[GPU] 3D 그리기 ' + st.drawn + '회 / 건너뜀 ' + st.skipped + '회' + (tot ? ' (' + Math.round(st.skipped / tot * 100) + '% 줄임)' : '') +
      (sc ? ' · 장면 선 ' + sc.lines + ' · 삼각형 ' + sc.triangles + ' · 그리기 호출 ' + sc.calls + ' · 그림판 ' + sc.canvas + ' · 지오메트리 ' + sc.geometries + ' · 텍스처 ' + sc.textures : ' · 3D 장면 아직 없음') +
      ' · TF.js GPU ' + f1(st.tfGpuMB) + 'MB · 분석 모델 ' + (st.modelsReleased ? '내려놓음' : '올라와 있음') +
      ' (내림 ' + st.released + ' / 다시 올림 ' + st.reloaded + (st.tfBefore != null ? ' · 내리기 전 ' + f1(st.tfBefore) + ' → 후 ' + f1(st.tfAfter) + 'MB' : '') + ')' +
      (st.lastErr ? ' · ⚠ ' + st.lastErr : '') + (G.on ? '' : ' · 꺼짐');
  };

  console.log(TAG + ' 설치 — 3D 안 바뀌면 안 그림(저사양 30fps 상한) · 분석 끝나면 모델 내려놓음. 끄기 GPU_DIET.on=false · 상태 GPU_DIET.status()');
  return G;
})();

/* ==========================================================================
 * ADJUST3D (옛 43-adjust-3d.js) — 조정 화면을 3D 완성 이미지로 (2D 합성·미니 3D 대신)
 *
 * 자리: 18, GPU_DIET 다음. 원래 함수에서 부르는 곳 —
 *   · initModel3DRenderer(18) 끝 — 루프 문 열기·조정/3D 화면 아니면 안 그림·자동 회전 멈춤
 *   · renderFrame(07b) 맨 앞 — 조정 화면 2D 그리기 건너뜀 · renderAdjustFrame(07b) 끝 — 3D 헤어 갱신 예약
 *   · activateScreen(05) 끝 · setupModel3DScreen(18) 맨 앞(그림판을 3D 결과 화면으로 옮김)
 *   · adjustViewStep · adjustViewReset(07b) 맨 앞, model3dApplyView(18) 끝 — 확대 막대
 *   · perfPanelLines(18) 끝에 ADJUST3D._panelLine()
 *
 * 왜 (2026-10-04 사용자):
 *   "조정 화면에 2D랑 미니 화면 지우고, 3D 완성 이미지가 지금 2D 화면 자리에 들어오게. 2D처럼 확대·축소·회전되게 하고
 *    머리카락은 다 나오게. 지금 미니 화면은 머리가 길면 아래가 구부러지거든. 그러지 않게."
 *
 * 무엇을:
 *   · 조정 화면의 그림 자리에 3D 결과 화면과 "같은 장면"(같은 렌더러·같은 두상·같은 헤어 만들기)을 넣습니다.
 *     렌더러를 하나 더 만들지 않고, 3D 결과 화면의 그림판을 조정 화면과 번갈아 옮겨 씁니다(GPU 메모리 한 벌).
 *   · 장면 = 두상 + 얼굴 + 헤어. 의상·몸은 조정 화면에 없습니다(3D 결과 화면에서 입힘) —
 *     그래서 긴 머리가 어깨에 걸려 구부러질 것도 없습니다.
 *   · 헤어는 전체 가닥(최종 3D와 같은 객체). 슬라이더가 바뀌면 37번의 "나눠서 만들기"로 다시 만들어
 *     다 되면 갈아 끼웁니다(만드는 동안은 직전 머리가 그대로 보임 · 아래에 진행률).
 *   · 2D 그리기는 조정 화면에서 통째로 건너뜁니다(안 보이는 그림에 시간을 쓰지 않음).
 *   · 조작: 드래그 = 회전 · Shift+드래그/두 손가락 = 이동 · 휠/핀치 = 확대 · 더블클릭 = 원래대로.
 *     확대 막대(− 100% ＋ ↺)와 정면/좌/우/후면 탭도 3D에 걸립니다(탭 = 그 면이 보이게 돌림).
 *   · 처음 뜰 때 헤어 전체가 화면에 들어오게 맞춥니다.
 *
 * 숨기는 것: 2D 그림 · 미니 3D · 2D 전용 버튼(가닥 보기 / 원본 결 보기 / 결필드 원본 / 3D 미리보기 / 옮기기 실험).
 *
 * 끄기: ADJUST3D.on=false 후 ADJUST3D.refresh() (예전 2D 화면으로)
 * ========================================================================== */
var ADJUST3D = (function () {
  'use strict';
  var W = window, TAG = '[조정 3D]';
  var A = Object.assign({ on: true, debounceMs: 140 }, W.ADJUST3D || {});
  var S = A.stats = { builds: 0, swaps: 0, lastMs: 0, baseBuilds: 0, err: null };
  if (typeof THREE === 'undefined') { console.warn(TAG + ' 필요한 함수가 없어 건너뜀'); A.on = false; }
  function now() { try { return performance.now(); } catch (e) { return Date.now(); } }
  function scr() { try { return currentScreen; } catch (e) { return ''; } }
  function m3() { try { return (model3D && model3D.initialized) ? model3D : null; } catch (e) { return null; } }
  function active() { return !!A.on && scr() === 'adjust'; }
  A.active = active;

  /* ── 화면 요소 ────────────────────────────────────────────────────────── */
  var host = null, chip = null, hintShown = false, lastW = 0, lastH = 0;
  try {
    var st = document.createElement('style');
    st.textContent = '#screen-adjust.a3-on #adjustCanvas,#screen-adjust.a3-on #devMini3D,#screen-adjust.a3-on #maskDebugToggle,' +
      '#screen-adjust.a3-on #rawDebugToggle,#screen-adjust.a3-on #fieldDebugToggle,#screen-adjust.a3-on #btn3dEngine,' +
      '#screen-adjust.a3-on #origExpBtn,#screen-adjust.a3-on #combBtn{display:none !important;}' +
      '#adjust3dHost canvas{display:block;width:100% !important;height:100% !important;}';
    document.head.appendChild(st);
  } catch (e) {}
  function syncClass() { try { document.getElementById('screen-adjust').classList.toggle('a3-on', !!A.on); if (host) host.style.display = A.on ? '' : 'none'; } catch (e) {} }
  function ensureHost() {
    if (host) return host;
    var pv = document.querySelector('#screen-adjust .adjust-preview');
    if (!pv) return null;
    host = document.createElement('div');
    host.id = 'adjust3dHost';
    host.style.cssText = 'position:absolute;inset:0;z-index:0;overflow:hidden;' +
      'background:radial-gradient(ellipse at 50% 32%,#f1ece3 0%,#d6cfc3 55%,#b9b1a4 100%);';
    pv.insertBefore(host, pv.firstChild);
    chip = document.createElement('div');
    chip.id = 'adjust3dChip';
    chip.style.cssText = 'position:absolute;left:50%;bottom:10px;transform:translateX(-50%);z-index:6;display:none;pointer-events:none;' +
      'font-size:11px;color:#fff;background:rgba(0,0,0,.55);padding:4px 10px;border-radius:10px;white-space:nowrap;';
    pv.appendChild(chip);
    return host;
  }
  var chipTimer = null;
  function setChip(t, ms) {
    if (!chip) return;
    if (chipTimer) { clearTimeout(chipTimer); chipTimer = null; }
    chip.textContent = t || ''; chip.style.display = t ? 'block' : 'none';
    if (t && ms) chipTimer = setTimeout(function () { chip.style.display = 'none'; }, ms);
  }

  /* ── 렌더러를 조정 화면 ↔ 3D 결과 화면으로 옮기기 ─────────────────────── */
  function stopAutoRotate() {              // 원래 루프는 손대기 전까지 혼자 돕니다 — 조정 화면에서는 가만히 있어야 함
    try {
      var c = model3D.renderer.domElement, o = { clientX: 0, clientY: 0, pointerId: 98765, bubbles: true };
      c.dispatchEvent(new PointerEvent('pointerdown', o));
      c.dispatchEvent(new PointerEvent('pointerup', o));
      W.dispatchEvent(new PointerEvent('pointerup', o));
    } catch (e) {}
  }
  function patchRender() {                 // 조정·3D 화면이 아니면 그리지 않음(루프 문을 열어 둔 대신)
    var m = m3(); if (!m || m.renderer.__a3) return;
    var r = m.renderer, orig = r.render;
    r.__a3 = true;
    r.render = function () {
      var s = scr();
      if (s !== 'model3d' && !(s === 'adjust' && A.on)) return;
      return orig.apply(this, arguments);
    };
  }
  A._afterInitRenderer = function () {   // initModel3DRenderer(18) 끝
    try { MOBILE_PERF.loopGate = false; } catch (e) {}
    patchRender(); stopAutoRotate();
  };
  function attach() {
    var h = ensureHost(); if (!h) return false;
    syncClass();
    if (!(h.clientWidth > 0 && h.clientHeight > 0)) return false;
    var moved = false;
    if (!m3()) { initModel3DRenderer(h); moved = true; }
    else if (model3D.container !== h) { h.appendChild(model3D.renderer.domElement); model3D.container = h; moved = true; }
    // 크기가 바뀌었을 때만 다시 맞춤(매번 맞추면 머리 길이가 바뀔 때마다 화면이 들썩임)
    if (moved || h.clientWidth !== lastW || h.clientHeight !== lastH) {
      lastW = h.clientWidth; lastH = h.clientHeight;
      try { resizeModel3D(); } catch (e) {}
    }
    try { model3D.headGroup.visible = true; } catch (e) {}
    return true;
  }
  function toResult() {
    var m = m3(), vp = document.getElementById('model3dViewport');
    hair = null; sceneKey = null; framed = false; gen++; busy = false; again = false;
    if (!m || !vp || m.container === vp) return;
    vp.appendChild(m.renderer.domElement); m.container = vp;
  }

  /* ── 장면: 두상 + 얼굴 (+ 헤어는 따로) ────────────────────────────────── */
  var hair = null, sceneKey = null, framed = false, gen = 0, busy = false, again = false, baseP = null;
  function buildBase(key) {
    var g = model3D.headGroup;
    while (g.children.length) { var c = g.children[0]; g.remove(c); try { disposeObject3D(c); } catch (e) {} }
    hair = null; framed = false; sceneKey = key; S.baseBuilds++;
    g.rotation.set(0, 0, 0);
    var myGen; try { myGen = ++model3DGeneration; } catch (e) { myGen = 0; }
    function stale() { try { return myGen !== model3DGeneration || !active(); } catch (e) { return true; } }
    var color = '#E8C39E';
    try { color = (state.hairMasks && state.hairMasks.front && state.hairMasks.front.scalpColor) || color; } catch (e) {}
    return Promise.resolve(loadHeadMesh(color)).then(function (res) {
      if (stale() || !res || !res.group) return;
      g.add(res.group); dirty();
      var fm = null; try { fm = getFaceMetrics(); } catch (e) {}
      try {
        Promise.resolve(buildRealFaceMesh(fm)).then(function (mesh) {
          if (stale()) return;
          if (mesh) {
            g.add(mesh); dirty();
            try { if (typeof conformScalpToFace === 'function') conformScalpToFace(g, mesh); } catch (e) { console.warn(TAG + ' 두피면↔얼굴 붙이기 실패', e); }
            return;
          }
          if (typeof buildFacePhotoDecal === 'function') return Promise.resolve(buildFacePhotoDecal(fm)).then(function (d) { if (d && !stale()) g.add(d); });
        }).catch(function (e) { console.warn(TAG + ' 얼굴 붙이기 실패', e); });
      } catch (e) { console.warn(TAG + ' 얼굴 붙이기 실패', e); }
    });
  }
  function dirty() { try { if (W.GPU_DIET && W.GPU_DIET.markDirty) W.GPU_DIET.markDirty(); } catch (e) {} }
  function swapHair(obj) {
    var g = model3D.headGroup, old = hair;
    if (obj === old && obj.parent === g) return;
    if (old && old.parent) old.parent.remove(old);
    g.add(obj); hair = obj; S.swaps++; dirty();
    if (old && old !== obj) {
      try { while (old.children.length) old.remove(old.children[0]); } catch (e) {}
      var D = W.MOBILE_DIET;
      try { if (D && D.recycleObject) D.recycleObject(old); else disposeObject3D(old); } catch (e) {}
    }
  }
  function updateHair() {
    if (busy) { again = true; return; }
    busy = true; again = false;
    var t0 = now(), my = ++gen, D = W.MOBILE_DIET;
    S.builds++;
    // (2026-10-04f) "머리 만드는 중… ○○%" 표시는 뺌(사용자 요청) — 조정 화면 헤어는 가볍게 만들어 금방 바뀜
    var pr = (D && typeof D.prepare3D === 'function') ? D.prepare3D() : Promise.resolve(false);
    pr.then(function () {
      busy = false;
      if (my !== gen || !active()) { setChip(''); return; }
      if (again) { again = false; return updateHair(); }          // 만드는 사이 값이 또 바뀜 — 최신 값으로 다시
      var obj = null;
      try { obj = buildAdjustedHair3DObject(); } catch (e) { S.err = String(e && e.message || e); console.warn(TAG + ' 헤어 만들기 실패', e); }
      if (obj && m3()) swapHair(obj);
      S.lastMs = now() - t0;
      if (!framed && obj) {                                                              // 헤어 전체가 들어오게
        try { MODEL3D_VIEW.zoom = 1; MODEL3D_VIEW.panX = 0; MODEL3D_VIEW.panY = 0; } catch (e) {}   // 3D 결과 화면에서 쓰던 확대·이동은 가져오지 않음
        try { frameCameraToHead(); } catch (e) {}
        framed = true;
      }
      if (!hintShown) { hintShown = true; setChip('드래그 회전 · Shift+드래그(두 손가락) 이동 · 휠(핀치) 확대', 4500); } else setChip('');
    }, function (e) { busy = false; setChip(''); console.warn(TAG + ' 헤어 준비 실패', e); });
  }

  /* ── 갱신 ─────────────────────────────────────────────────────────────── */
  var timer = null, waitN = 0;
  function schedule(ms) { if (timer) clearTimeout(timer); timer = setTimeout(refresh, ms == null ? A.debounceMs : ms); }
  function refresh() {
    timer = null;
    syncClass();
    try { if (W.MOBILE_DIET) W.MOBILE_DIET.externalDriver = !!A.on; } catch (e) {}
    if (!active()) return;
    if (!attach()) { if (waitN++ < 40) schedule(150); return; }
    var model = null; try { model = state.hair3Dneutral; } catch (e) {}
    if (!model || !model.strands || !model.strands.length) {       // 중립 모델은 원래 흐름(scheduleHair3DRefresh)이 만듦 — 기다림
      setChip('3D 모델 준비 중…');
      if (waitN++ < 120) schedule(300);
      return;
    }
    waitN = 0;
    var key = state._hair3Dneutral || model;
    var need = sceneKey !== key || !model3D.headGroup.children.length;
    if (need && !baseP) {
      baseP = buildBase(key).then(function () { baseP = null; }, function (e) { baseP = null; console.warn(TAG + ' 두상 만들기 실패', e); });
    }
    (baseP || Promise.resolve()).then(function () { if (active()) updateHair(); });
  }
  A.refresh = function () {
    syncClass();
    if (!A.on) {                                    // 예전 2D 화면으로
      try { if (W.MOBILE_DIET) W.MOBILE_DIET.externalDriver = false; } catch (e) {}
      try { if (typeof drawAdjustPreview === 'function') { if (typeof RENDER_SKIP !== 'undefined') RENDER_SKIP.last = null; drawAdjustPreview(); } } catch (e) {}
      return;
    }
    schedule(0);
  };

  /* ── 걸기 ─────────────────────────────────────────────────────────────── */
  // 2D 그리기 건너뛰기
  A._skipFrame = function (canvas) { return !!(A.on && canvas && canvas.id === 'adjustCanvas' && scr() === 'adjust'); };   // renderFrame(07b) 맨 앞
  // 값·뷰가 바뀔 때마다 원래 흐름이 부르는 자리
  var sideAtPlusX = null, lastView = null;
  function yawFor(view) {
    if (view === 'front') return 0;
    if (view === 'back') return Math.PI;
    if (sideAtPlusX == null) {
      try { var E = getHeadEllipsoid(), cy = (state.hair3Dneutral && state.hair3Dneutral.CY) || 0; sideAtPlusX = viewOfRoot({ x: E.a, y: cy, z: 0 }); } catch (e) { sideAtPlusX = 'left'; }
    }
    return view === sideAtPlusX ? -Math.PI / 2 : Math.PI / 2;      // +x 쪽을 카메라로 = −90°
  }
  A._afterAdjustFrame = function () {   // renderAdjustFrame(07b) 끝
    if (A.on && scr() === 'adjust') {
      try {
        var v = state.currentViewAngle;
        if (lastView !== null && v !== lastView && m3()) model3D.headGroup.rotation.y = yawFor(v);   // 탭 = 그 면이 보이게
        lastView = v;
      } catch (e) {}
      schedule();
    }
  };
  A._afterActivate = function (name) {   // activateScreen(05) 끝
    if (name === 'adjust' && A.on) { waitN = 0; lastView = null; schedule(30); }
  };
  A._beforeSetup3D = function () {   // setupModel3DScreen(18) 맨 앞 — 그림판을 3D 결과 화면으로
    try { toResult(); } catch (e) { console.warn(TAG + ' 3D 화면으로 옮기기 실패', e); }
  };
  // 확대 막대
  A._afterApplyView = function () {   // model3dApplyView(18) 끝 — 조정 화면 확대 % 표시
    try { if (active()) { var el = document.getElementById('adjustZoomPct'); if (el) el.textContent = Math.round(MODEL3D_VIEW.zoom * 100) + '%'; } } catch (e) {}
  };
  W.addEventListener('resize', function () { if (active()) schedule(120); });

  A.status = function () {
    return { on: A.on, attached: !!(m3() && host && model3D.container === host), hair: !!hair, builds: S.builds, swaps: S.swaps, lastMs: Math.round(S.lastMs), baseBuilds: S.baseBuilds, err: S.err };
  };
  A._panelLine = function () {   // perfPanelLines(18) 끝
    var s = A.status();
    return '[조정 3D] ' + (s.on ? '켜짐' : '꺼짐') + ' · 그림판 ' + (s.attached ? '조정 화면에 있음' : '다른 화면') + ' · 헤어 만들기 ' + s.builds + '회 / 갈아 끼움 ' + s.swaps +
      '회 · 직전 ' + s.lastMs + 'ms(값 바뀐 뒤 새 머리가 보일 때까지) · 두상 만들기 ' + s.baseBuilds + '회' + (s.err ? ' · ⚠ ' + s.err : '');
  };

  syncClass();
  console.log(TAG + ' 설치 — 조정 화면에 3D 완성 이미지(2D·미니 3D 숨김). 끄기 ADJUST3D.on=false 후 ADJUST3D.refresh() · 상태 ADJUST3D.status()');
  return A;
})();

/* HAIR_LOOK (옛 63-hair-look.js) — 3D 결과 화면 머리의 실사감(빛) (2026-10-10b)
 *
 * 사용자: "머리에 실사감을 주기 위해서 우리 앱에서 할 수 있는 거 넣어봐" · "가닥 결의 실제 느낌은 우리 앱이 강한데 왜 실사감이 안 날까"
 * 원인(지금 그리는 법): 가닥 = 색만 칠한 선. 음영은 24번이 색에 한 번 구워 둔 것(안쪽 어둡게 + 정면에서 본 결 하이라이트 하나)이라
 *   화면을 돌려도 광택이 따라 움직이지 않고, 광택 띠가 하나뿐이며, 가닥 끝이 뭉툭합니다.
 * 지금: 머리 선을 빛을 계산하는 재질로 바꿉니다(가닥 모양·색·가닥 수는 그대로).
 *   ① 결 방향 광택 두 줄(머리카락 반사 모형) — 결과 직각으로 길게 늘어진 띠. 하얗고 날카로운 띠(뿌리 쪽으로 조금 밀림) + 머리색이 섞인 흐린 띠(끝 쪽으로).
 *      빛은 화면 기준(왼쪽 위 앞) — 머리를 돌리면 광택이 결을 따라 흘러갑니다. 매끈한 머리의 "천사 고리".
 *   ② 결 방향 확산광 — 빛과 결이 직각일수록 밝음(머리카락은 원통이라 면처럼 비치지 않음).
 *   ③ 다발 안쪽 그림자 — 24번이 구운 안쪽 어둡게는 그대로 쓰고, 겉면 가닥에만 광택이 실림(안쪽 가닥은 광택이 약함).
 *   ④ 테두리 빛 — 화면 가장자리(실루엣)의 가닥이 살짝 밝게(역광 느낌).
 *   ⑤ 가닥 끝 — 끝으로 갈수록 살짝 투명하고 밝게(가늘어지는 끝).
 *   ⑥ 24번이 구운 정면 하이라이트는 끔(두 번 겹치지 않게).
 * 끄기: HAIR_LOOK.on = false 후 3D 화면 다시 들어가기 · 바로 비교 HAIR_LOOK.toggle()
 * 세기: HAIR_LOOK.spec1 / spec2 / rim / tipFade  (바꾼 뒤 HAIR_LOOK.refresh())
 * 자리: 18, initModel3DRenderer 앞. 3D 결과 화면의 헤어 개체를 주기적으로 살펴 재질을 바꿈(pollMs) · perfPanelLines(18) 끝 줄
 */
var HAIR_LOOK = (function () {
  'use strict';
  var W = window, TAG = '[머리 빛]';
  var HL = Object.assign({
    on: true,
    light: [-0.45, 0.75, 0.55],   // 화면 기준 빛 방향(왼쪽 위 앞)
    // (2026-10-10b) 사용자: "머리가 너무 글리스하다 — 저 정도 광택(생성 사진의 남자 머리)만 있으면 될 것 같아" → 넓고 은은한 광택으로 낮춤
    diffuse: 0.45,                // 결 방향 확산광 세기(나머지는 고른 빛)
    // (2026-10-17) 사용자: 3D 뒷모습 정수리가 회색빛으로 뜸(원본은 고른 짙은 갈색) → 하얀 띠를 줄이고 머리색 쪽으로 물들임
    spec1: 0.12, pow1: 36, shift1: 0.12,     // 하얀 띠(10-10b 0.2)(예전 0.55 · 90 — 젖은 듯 반짝였음)
    spec2: 0.16, pow2: 12, shift2: -0.10,   // 머리색 띠(예전 0.35 · 22)
    rim: 0.04, rimPow: 3,          // (2026-10-17) 0.08 → 0.04
    tipFade: 0.3, tipFrom: 0.8,   // 끝 투명(0~1) · 가닥 길이의 이 비율부터
    outerOnly: 0.75,              // 광택을 겉면 가닥에 몰기(0 = 안쪽도 같은 광택)
    pollMs: 400
  }, W.HAIR_LOOK || {});
  var S = HL.stats = { upgraded: 0, last: null, err: null, verts: 0, strands: 0 };
  if (typeof THREE === 'undefined') { console.warn(TAG + ' THREE가 없어 건너뜀'); return; }

  // ⑥ 24번이 색에 굽는 정면 하이라이트 끄기(안쪽 어둡게·밝기 상한은 그대로)
  function muteBaked() {
    try {
      var SB = W.STYLE_BASE; if (!SB) return;
      if (SB.shade && SB.shade.spec > 0 && HL.on) { HL._bakedSpec = SB.shade.spec; SB.shade.spec = 0; }
      if (SB.active && SB.active.shade && SB.active.shade.spec > 0 && HL.on) { SB.active.shade.spec = 0; }
    } catch (e) {}
  }
  muteBaked();

  var VS = [
    'attribute vec3 color;', 'attribute vec3 tng;', 'attribute vec2 hl;',   // hl.x = 뿌리0~끝1 · hl.y = 겉면 정도 0~1
    'uniform vec3 uCenter;',
    'varying vec3 vCol; varying vec3 vT; varying vec3 vN; varying vec3 vV; varying vec2 vHl;',
    'void main(){',
    '  vec4 mv = modelViewMatrix * vec4(position,1.0);',
    '  vT = normalize((modelViewMatrix * vec4(tng,0.0)).xyz);',
    '  vN = normalize((modelViewMatrix * vec4(position - uCenter,0.0)).xyz);',
    '  vV = normalize(-mv.xyz); vCol = color; vHl = hl;',
    '  gl_Position = projectionMatrix * mv;',
    '}'].join('\n');
  var FS = [
    'uniform vec3 uL; uniform float uDiff, uS1, uP1, uSh1, uS2, uP2, uSh2, uRim, uRimP, uTip, uTipFrom, uOuter;',
    'varying vec3 vCol; varying vec3 vT; varying vec3 vN; varying vec3 vV; varying vec2 vHl;',
    'float kk(vec3 T, vec3 H, float p){ float d = dot(T,H); return pow(sqrt(max(0.0,1.0-d*d)), p); }',
    'void main(){',
    '  vec3 T = normalize(vT), N = normalize(vN), V = normalize(vV), L = normalize(uL);',
    '  vec3 H = normalize(L + V);',
    '  float tl = dot(T,L), dif = sqrt(max(0.0,1.0-tl*tl));',
    '  float outer = mix(1.0, vHl.y, uOuter);',
    '  vec3 T1 = normalize(T + N*uSh1), T2 = normalize(T + N*uSh2);',
    '  float face = clamp(dot(N,L)*0.5+0.5, 0.0, 1.0);',
    '  float s1 = kk(T1,H,uP1) * uS1 * outer * face;',
    '  float s2 = kk(T2,H,uP2) * uS2 * outer * face;',
    '  float rim = pow(1.0 - clamp(abs(dot(N,V)),0.0,1.0), uRimP) * uRim * outer;',
    '  vec3 base = vCol * ((1.0-uDiff) + uDiff * dif * (0.55 + 0.45*face));',
    '  vec3 c = base + vec3(s1) * mix(vec3(1.0,0.97,0.92), vCol*2.2 + vec3(0.08,0.06,0.04), 0.65) + s2 * (vCol*1.6 + vec3(0.06,0.04,0.02)) + rim * (vCol + vec3(0.25,0.22,0.2));',
    '  float tip = smoothstep(uTipFrom, 1.0, vHl.x);',
    '  c = mix(c, c*1.15 + vec3(0.02), tip*0.5);',
    '  gl_FragColor = vec4(min(c, vec3(1.0)), 1.0 - tip*uTip);',
    '}'].join('\n');

  function uniforms() {
    var c = { x: 0, y: typeof SCALP_CENTER_Y !== 'undefined' ? SCALP_CENTER_Y : 0.15, z: 0 };
    return {
      uCenter: { value: new THREE.Vector3(c.x, c.y, c.z) }, uL: { value: new THREE.Vector3(HL.light[0], HL.light[1], HL.light[2]) },
      uDiff: { value: HL.diffuse }, uS1: { value: HL.spec1 }, uP1: { value: HL.pow1 }, uSh1: { value: HL.shift1 },
      uS2: { value: HL.spec2 }, uP2: { value: HL.pow2 }, uSh2: { value: HL.shift2 }, uRim: { value: HL.rim }, uRimP: { value: HL.rimPow },
      uTip: { value: HL.tipFade }, uTipFrom: { value: HL.tipFrom }, uOuter: { value: HL.outerOnly }
    };
  }
  // 가닥 결·뿌리→끝 자리·겉면 정도 — 선분 쌍(LineSegments)에서: 앞 선분의 끝 = 이 선분의 시작이면 같은 가닥
  function addAttrs(g) {
    var P = g.attributes.position, n = P.count, a = P.array, T = new Float32Array(n * 3), HLa = new Float32Array(n * 2), i, j;
    var cy = typeof SCALP_CENTER_Y !== 'undefined' ? SCALP_CENTER_Y : 0.15, E = null;
    try { E = getHeadEllipsoid(); } catch (e) { E = { a: 0.4, b: 0.6, c: 0.5 }; }
    // 가닥 묶기
    var starts = [0], s;
    for (s = 2; s + 1 < n; s += 2) {
      var px = a[(s - 1) * 3], py = a[(s - 1) * 3 + 1], pz = a[(s - 1) * 3 + 2];
      if (Math.abs(px - a[s * 3]) + Math.abs(py - a[s * 3 + 1]) + Math.abs(pz - a[s * 3 + 2]) > 1e-6) starts.push(s);
    }
    starts.push(n);
    // 겉면 정도: 방향 칸마다 가장 바깥 반지름 대비(24번과 같은 생각)
    var NT = 36, NP = 18, rho = new Float32Array(n), bin = new Int32Array(n), bmax = new Float32Array(NT * NP);
    for (i = 0; i < n; i++) {
      var dx = a[i * 3] / E.a, dy = (a[i * 3 + 1] - cy) / E.b, dz = a[i * 3 + 2] / E.c, r = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
      var th = Math.atan2(dx, dz), ph = Math.acos(Math.max(-1, Math.min(1, dy / r)));
      var bi = Math.min(NP - 1, (ph / Math.PI * NP) | 0) * NT + Math.min(NT - 1, ((th + Math.PI) / (2 * Math.PI) * NT) | 0);
      rho[i] = r; bin[i] = bi; if (r > bmax[bi]) bmax[bi] = r;
    }
    for (j = 0; j + 1 < starts.length; j++) {
      var b0 = starts[j], b1 = starts[j + 1], L = 0, acc = 0, k;
      for (k = b0; k + 1 < b1; k += 2) L += Math.hypot(a[(k + 1) * 3] - a[k * 3], a[(k + 1) * 3 + 1] - a[k * 3 + 1], a[(k + 1) * 3 + 2] - a[k * 3 + 2]);
      L = L || 1e-9;
      for (k = b0; k + 1 < b1; k += 2) {
        var tx = a[(k + 1) * 3] - a[k * 3], ty = a[(k + 1) * 3 + 1] - a[k * 3 + 1], tz = a[(k + 1) * 3 + 2] - a[k * 3 + 2], tl = Math.hypot(tx, ty, tz) || 1e-9;
        T[k * 3] = T[(k + 1) * 3] = tx / tl; T[k * 3 + 1] = T[(k + 1) * 3 + 1] = ty / tl; T[k * 3 + 2] = T[(k + 1) * 3 + 2] = tz / tl;
        HLa[k * 2] = acc / L; acc += tl; HLa[(k + 1) * 2] = acc / L;
      }
    }
    for (i = 0; i < n; i++) { var bm = bmax[bin[i]]; HLa[i * 2 + 1] = bm > 1.02 ? Math.max(0, Math.min(1, (rho[i] - 1) / (bm - 1))) : 1; }
    g.setAttribute('tng', new THREE.BufferAttribute(T, 3));
    g.setAttribute('hl', new THREE.BufferAttribute(HLa, 2));
    S.verts = n; S.strands = starts.length - 1;
  }
  function upgrade(obj) {
    if (!obj || !obj.geometry || !obj.geometry.attributes.position || !obj.geometry.attributes.color) return false;
    try {
      addAttrs(obj.geometry);
      obj.userData._hlOld = obj.material;
      obj.material = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: uniforms(), transparent: HL.tipFade > 0, depthWrite: true });
      obj.material.userData = { hairLook: true };
      obj.userData._hlGeo = obj.geometry.uuid + ':' + obj.geometry.attributes.color.version;
      S.upgraded++; S.last = new Date().toTimeString().slice(0, 8);
      if (S.upgraded === 1) console.log(TAG + ' 3D 머리에 빛 계산 재질을 입힘 — 가닥 ' + S.strands + '개 · 결 광택 두 줄·결 확산광·테두리 빛·끝 투명 · 비교 HAIR_LOOK.toggle()');
      return true;
    } catch (e) { S.err = String(e && e.message || e); console.warn(TAG + ' 재질 바꾸기 실패', e); return false; }
  }
  function revert(obj) { if (obj && obj.userData._hlOld) { obj.material = obj.userData._hlOld; obj.userData._hlOld = null; obj.userData._hlGeo = null; } }
  function hairObj() { try { return (typeof model3D !== 'undefined' && model3D && model3D.headGroup) ? model3D.headGroup.getObjectByName('adjustedHair') : null; } catch (e) { return null; } }
  function tick() {
    var o = hairObj(); if (!o) return;
    var mine = o.material && o.material.userData && o.material.userData.hairLook;
    if (HL.on) {
      muteBaked();
      var sig = o.geometry && o.geometry.attributes.color ? o.geometry.uuid + ':' + o.geometry.attributes.color.version : '';
      if (!mine || o.userData._hlGeo !== sig) { if (mine) revert(o); upgrade(o); }
    } else if (mine) revert(o);
  }
  setInterval(tick, HL.pollMs);
  HL.refresh = function () { var o = hairObj(); if (o && o.material && o.material.userData && o.material.userData.hairLook) { revert(o); } tick(); };
  HL.toggle = function (v) { HL.on = typeof v === 'boolean' ? v : !HL.on; if (!HL.on) { try { var SB = W.STYLE_BASE; if (SB && SB.shade && HL._bakedSpec) SB.shade.spec = HL._bakedSpec; } catch (e) {} } tick(); return HL.on; };
  HL.lines = function () { return [TAG + ' ' + (HL.on ? '켜짐' : '꺼짐') + ' · 입힌 횟수 ' + S.upgraded + (S.last ? '(' + S.last + ')' : '') + ' · 가닥 ' + S.strands + ' · 하얀 띠 ' + HL.spec1 + ' · 머리색 띠 ' + HL.spec2 + ' · 테두리 ' + HL.rim + ' · 끝 투명 ' + HL.tipFade + (S.err ? ' · ⚠ ' + S.err : '')]; };
  console.log(TAG + ' 설치 — 3D 결과 화면 머리에 결 방향 광택·확산광·테두리 빛·끝 투명을 입힙니다(모양은 그대로). 비교 HAIR_LOOK.toggle() · 끄기 HAIR_LOOK.on=false');
  return HL;
})();

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
  // (옛 40 GPU 다이어트 ①) 바뀐 게 없으면 3D를 다시 그리지 않도록 renderer.render를 감쌈
  GPU_DIET._patchRenderer(model3D);
  // (옛 43 조정 3D) 루프 문을 열고, 조정·3D 화면이 아니면 그리지 않게, 자동 회전 멈춤
  ADJUST3D._afterInitRenderer();
  FLY_TRIM._patchRender(model3D);   // (옛 55) 결과 화면에서 몸통 밖 선분 거르기
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
  ADJUST3D._afterApplyView();   // (옛 43) 조정 화면 확대 %도
  COMB3D._afterApplyView();     // (옛 53) 빗질 붓 원 크기
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
async function setupModel3DScreenBase(){
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
  let outfitTag = '', stageOutfit = null;
  {
    /* (2026-09-13) showAI('AI가 어울리는 의상을 고르고 있어요…')를 뺐다 —
       판단이 로컬이라 한 프레임 안에 끝나서 토스트가 떴다 사라지는 깜빡임만
       남고, 무엇보다 이제 AI가 아니다.
       ⚠ `state.shots.front` 조건도 같이 뺐다. 사진을 더 이상 안 보내므로 있으나
         없으나 같은 판단이 나오는데, 조건만 남으면 사진 없는 손님에게 의상이
         통째로 사라진다 — 바로 아래 2026-07-13 주석이 selectedStyle 조건으로
         똑같이 당했다고 적어 둔 자리다. 같은 함정을 한 칸 옆에 다시 파지 않는다. */
    const outfitRec = await recommendOutfitWithAI();
    if(outfitRec && myGen === model3DGeneration){
      /* ── 두신 자를 <b>씬에서</b> 재서 넘긴다 (2026-09-09) ─────────────────────
         personBodyLenMesh 배너가 이미 적어 둔 그 자리다: "3D 화면은 씬에서 잰
         값을 넣고(state._model3DCrownY), 결과 화면은 안 넣어 사진 기준을 쓴다."
         그 문장은 있는데 <b>재는 코드가 없었고</b> 넘기는 코드도 없었다 —
         그래서 로더가 고정값 4.0으로 떨어져 4.9두신이 나왔다.
         여기가 재기에 맞는 자리인 이유: 두상·헤어는 이미 headGroup에 들어갔고
         의상은 아직 안 들어갔다(들어간 뒤에 재면 발끝이 정수리로 잡힌다). */
      let crownY3D = null;
      try{
        const bb = new THREE.Box3().setFromObject(model3D.headGroup);
        if(bb && isFinite(bb.max.y)) crownY3D = bb.max.y;
      }catch(e){ console.warn('[3D·비율] 씬 정수리 실측 실패 — 사진 기준 자로 폴백:', e); }
      state._model3DCrownY = crownY3D;
      const bodyLen3D = personBodyLenMesh(crownY3D);
      /* 의상 갈아입히기(Changeclothes): 21-body-base의 몸+옷 리그를 쓴다. 없으면 예전 단일 의상 메쉬로. */
      const outfitMesh = (typeof buildBody3DForOutfit === 'function')
        ? await buildBody3DForOutfit(outfitRec.item, faceMetrics.widthFactor, bodyLen3D)
        : await loadOutfitMeshMeasured(outfitRec.item, faceMetrics.widthFactor, bodyLen3D);
      model3D.headGroup.add(outfitMesh);
      // (2026-08-31 11차) 옷깃을 이제 봤으니 목을 그 구멍 기준으로 다시 짓는다.
      refitNeckToGarment(model3D.headGroup,
        (state.hairMasks && state.hairMasks.front && state.hairMasks.front.scalpColor));
      outfitTag = ` · 의상 추천: ${outfitRec.item.name}(${outfitRec.item.category}, 데모)`;
      stageOutfit = outfitRec.item;
    }
  }

  /* (2026-09-04 2차) 무대 배경을 지금 걸린 헤어·의상 색에 맞춰 고른다.
     의상이 없으면(추천 실패·사진 없음) null로 부른다 — 헤어만으로도 밝기
     규칙은 성립한다. 실패해도 화면은 styles.css 기본 팔레트로 그냥 뜬다.
     ⚠ 여기 자리인 이유: 의상 메쉬가 붙은 <b>뒤</b>여야 stageOutfit이 찼다.
       위로 올리면 조용히 항상 null이 되어 의상 연동이 사라진다. */
  try{ applyStageBackdrop(stageOutfit); }
  catch(e){ console.warn('[무대] 배경 색 적용 실패 — 기본 팔레트 유지:', e); }

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
      /* (2026-09-16) 두피면을 얼굴 <b>최종면</b>(굴곡·측면보정 포함)에 붙인다 — 12a FACE_SCALP_CONFORM */
      try{ if(typeof conformScalpToFace === 'function') conformScalpToFace(model3D.headGroup, realFace); }
      catch(e){ console.warn('[3D] 두피면↔얼굴 붙이기 실패:', e); }
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
/* 3D 결과 화면 만들기 — 기능 단계(바깥) → setupModel3DScreenBase(28 시간·29 헤어핀이 감쌈)
   단계(안쪽 → 바깥): 폰 다이어트(옛 37 ④⑤ — 남은 헤어 계산을 나눠서 하며 진행률 · 의상·얼굴까지 다 붙은 뒤 한꺼번에 보여 줌)
                     → 진단 도구(옛 38 ④ — 3D 진입 기록) */
function setupModel3DScreen(){
  ADJUST3D._beforeSetup3D();   // (옛 43) 조정 화면에 있던 3D 그림판을 결과 화면으로 옮김
  const self = this, args = arguments;
  const dietStep = () => MOBILE_DIET.setupScreen(self, args);   // 폰 다이어트(이 파일 아래) → setupModel3DScreenBase
  const p = DIAG_TOOLS.trackSetup(dietStep);                     // (옛 38) 3D 진입 기록 — 힙·걸린 시간·성능 줄(07b)
  // (옛 44 피팅) 다 만든 뒤 하단 버튼(보기·의상·시술 스펙)을 떼고, 3D 화면이면 전신 보기로
  const after = () => { fittingRemoveButtons(); if(currentScreen === 'model3d') fittingFullView(); };
  try{ Promise.resolve(p).then(after, after); }catch(e){ after(); }
  FLY_TRIM._patchRender(p);   // (옛 55) 결과 화면 선분 거르기 연결
  return p;
}
/* ── (옛 44-fitting.js) 3D 결과 화면 — 하단 버튼(보기·의상·시술 스펙) 없음, 들어올 때 전신 보기 ── */
function fittingRemoveButtons(){
  ['fittingBar', 'treatSpecBtn3D'].forEach(id => {
    const el = document.getElementById(id);
    if(el && el.parentNode) el.parentNode.removeChild(el);
  });
}
function fittingFullView(){
  try{
    if(typeof MODEL3D_VIEW === 'undefined') return;
    MODEL3D_VIEW.zoom = 1; MODEL3D_VIEW.panX = 0; MODEL3D_VIEW.panY = 0;
    if(typeof model3dApplyView === 'function') model3dApplyView();
  }catch(e){}
}
// [시술 스펙] 3D 버튼은 25번이 DOMContentLoaded 때 붙임 — 그 뒤에 한 번 뗌
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(fittingRemoveButtons, 0));
else setTimeout(fittingRemoveButtons, 0);
console.log('[3D 결과 화면] 하단 버튼(보기·의상·시술 스펙) 없음 — 들어올 때 전신 보기');

/* ==========================================================================
 * 폰 다이어트 — MOBILE_DIET (2026-10-03 · 옛 37-mobile-diet.js)
 *   폰에서 느려지고 꺼지는 문제 (슬라이더 · 누적 · 3D 진입)
 *
 *   붙는 자리(각 함수 안에서 아래 창구를 부름):
 *     drawAdjustPreview(10) · scheduleHair3DRefresh(07b) — deferDraw / deferMini (드래그 중 미루기)
 *     renderAdjustFrame(07b) — afterRenderAdjust (걸린 시간 · 미리 만들기 예약)
 *     computeAdjustedHair3DStrands(17b) — pruneNow (옛 상태 캐시 버림)
 *     activateScreen(05) — afterActivate (3D 나갈 때 장면 반납 · 조정 화면이면 미리 만들기)
 *     buildRealFaceMesh·buildFacePhotoDecal(12a) — noteFace (얼굴이 붙는 약속)
 *     setupModel3DScreen(18) — setupScreen (진입 때 나눠 만들기 · 한꺼번에 보여 주기)
 *     buildAdjustedHair3DObject(14) — buildHair (미리 만든 헤어 받아 쓰기)
 *     perfPanelLines(18) — panelLine
 *   원래 계산은 각 함수의 …Base(28-perf-probe·24-style-base가 감싸는 쪽)가 한다.
 *
 * ① 슬라이더 — 드래그 중에는 숫자·손잡이만 움직이고, 그림은 손이 멈추거나 뗄 때 그립니다.
 *    막대 값이 바뀔 때마다 조정 화면 전체 렌더(폰에서 0.5초 이상)가 돌아 그동안 손잡이가
 *    손가락을 못 따라왔습니다. 터치 가드(12px·300ms)는 건드리지 않았습니다.
 *    렌더가 충분히 빠른 기기(dragLiveMs 이하)는 예전처럼 드래그 중에도 실시간으로 그립니다.
 *    미니 3D 갱신도 손을 뗄 때 한 번만 합니다.
 *
 * ② 3D 헤어 미리 만들기 — 값이 정해지면(마지막 그림 뒤 preDelayMs) 조정 화면이 한가할 때
 *    3D 결과 화면에 쓸 헤어(광택·웨이브 다듬기 → 다발 뭉치기 → 사진 색 입히기 → 음영)를
 *    조금씩(sliceMs) 끝까지 만들어 둡니다. 3D 결과보기는 그걸 받아서 바로 띄웁니다.
 *    다 못 만든 채 넘어가면 만들던 데서 이어서 마저 만듭니다.
 *    계산식은 원래 함수들과 같고, 방식만 다릅니다: 전체 가닥 복사본(다듬은 것·뭉친 것)과
 *    숫자 배열을 통째로 만들지 않고 가닥 하나씩 최종 버퍼에 바로 씁니다 → 진입 순간 메모리가 훨씬 적습니다.
 *    레게펌(땋기)은 원래 경로 그대로입니다.
 *
 * ③ 누적 막기
 *    · 상태(막대 값)가 바뀌면 예전 상태의 조정 캐시를 그 자리에서 버립니다
 *      (예전: 3벌이 찰 때까지 옛 전체 가닥이 남아 있었음).
 *    · 3D 결과 화면을 나가면 장면(헤어·얼굴·의상)의 GPU 버퍼를 바로 반납합니다
 *      (예전: 다음에 다시 들어올 때까지 잡고 있었음).
 *    · 3D 결과 화면에 들어가면 전체 가닥 기억을 비웁니다(완성본만 있으면 됨 · 조정 화면으로 돌아오면 다시 채움).
 *    · 3D 헤어 색은 8비트로 담고(사진 색이 원래 8비트 — float의 1/4 크기), 버퍼 한 벌을 돌려 씁니다.
 *
 * ④ (2026-10-03c) 3D 진입 때 나눠서 만들기 — 실측(4GB 폰): 미리 만들기가 끝나기 전에 넘어가면
 *    빈 화면으로 2~5초 멈췄습니다(이어서 2087ms · 진입 때 만듦 4713ms). 남은 일을 한 번에 하지 않고
 *    조각(entrySliceMs)으로 나눠 하면서 "3D 헤어 만드는 중… ○○%"를 보여 줍니다. 총 시간은 비슷하지만
 *    화면이 얼지 않습니다. 미리 만들기 시작도 앞당겼습니다(700 → 400ms, 확인 간격 500 → 200ms).
 *    진단 줄에 마지막 헤어 만들기의 단계별 시간(가닥 계산 · 가닥 쓰기 · 음영)이 찍힙니다.
 *
 * ⑤ (2026-10-03d) 3D 결과 화면을 한꺼번에 보여 주기 — 원래 순서가 두상·헤어 → (의상 추천·로딩 0.2~0.8초) 의상
 *    → 얼굴 메쉬라서 머리만 먼저 떠 있다가 옷과 얼굴이 뒤늦게 붙었습니다. 다 붙을 때까지 장면을 숨겼다가
 *    한 번에 보여 줍니다(최대 6초 뒤에는 무조건 보여 줌).
 *
 * 끄기: MOBILE_DIET.on=false (전부) · .entryProgress=false · .showTogether=false · .drag=false · .pre3D=false · .prune=false · .release3D=false · .freeFull=false
 * 상태: MOBILE_DIET.status()
 * ========================================================================== */
var MOBILE_DIET = (function () {
  'use strict';
  var W = window, TAG = '[폰 다이어트]';
  var D = Object.assign({
    on: true,
    drag: true,          // ① 드래그 중 그림 미루기
    dragPauseMs: 140,    //    손이 이만큼 멈추면 그림
    dragLiveMs: 45,      //    직전 렌더가 이보다 빠르면 미루지 않고 실시간
    pre3D: true,         // ② 3D 헤어 미리 만들기
    preDelayMs: 400,     //    마지막 그림 뒤 이만큼 조용하면 시작 (2026-10-03c: 700 → 400)
    prePollMs: 200,      //    가닥 미리계산이 끝났는지 확인하는 간격 (2026-10-03c: 500 → 200)
    sliceMs: 12,         //    한 번에 일하는 시간
    entryProgress: true, // ④ 3D 진입 때 남은 일을 나눠서 하며 진행률 표시
    entrySliceMs: 40,    //    진입 때 한 조각
    showTogether: true,  // ⑤ 3D 장면을 다 붙은 뒤 한꺼번에 보여 주기
    prune: true,         // ③ 옛 상태 캐시 즉시 버림
    release3D: true,     // ③ 3D 화면 나갈 때 장면 반납
    freeFull: true,      // ③ 3D 화면에 들어갈 때 전체 가닥 기억 비움
    lite: true,          // ⑥ (2026-10-04f) 조정 화면의 헤어는 가볍게(사진 색 입히기·코팅·음영 없이)
    bgFull: true,        // ⑥ 조정 화면이 한가할 때 3D 결과 화면용 완성본(전체 가닥·색·음영)을 뒤에서 미리 만듦
    bgDelayMs: 250,      //    조정 화면 헤어가 뜬 뒤 이만큼 조용하면 시작 (2026-10-04g: 500 → 250)
    bgSliceMs: 12        //    한 번에 일하는 시간
  }, {});
  var S = D.stats = { freedFull: 0, bufReuse: 0, deferred: 0, lastRenderMs: 0, pruned: 0, released: 0, preHit: 0, preResume: 0, preCold: 0, preFallback: 0, preBuiltMs: 0, lastBuild: null, lastShow: null };

  function now() { try { return performance.now(); } catch (e) { return Date.now(); } }
  function scr() { try { return currentScreen; } catch (e) { return ''; } }
  function neutral() { try { var m = state.hair3Dneutral; return m && m.strands ? m : null; } catch (e) { return null; } }
  function J(v) { try { return JSON.stringify(v); } catch (e) { return '?'; } }

  /* ────────────────────────────────────────────────────────────────────────
   * ① 슬라이더 드래그 중 그림 미루기
   * ────────────────────────────────────────────────────────────────────── */
  var drag = { el: null, pending: false, timer: null, mini: false };
  function isRange(t) { return !!t && t.tagName === 'INPUT' && t.type === 'range'; }

  function flushDrag() {
    if (drag.timer) { clearTimeout(drag.timer); drag.timer = null; }
    if (!drag.pending) return;
    drag.pending = false;
    try { drawAdjustPreviewBase(); } catch (e) { console.warn(TAG + ' 그리기 실패', e); }
  }
  function endDrag() {
    if (!drag.el) return;
    drag.el = null;
    flushDrag();
    if (drag.mini) { drag.mini = false; try { scheduleHair3DRefreshBase(); } catch (e) {} }
  }
  /* drawAdjustPreview(10) 첫머리 — true면 지금 그리지 않음(손이 멈추거나 뗄 때 drawAdjustPreviewBase) */
  D.deferDraw = function () {
    if (!D.on || !D.drag || !drag.el || !(S.lastRenderMs > D.dragLiveMs)) return false;
    drag.pending = true; S.deferred++;
    if (drag.timer) clearTimeout(drag.timer);
    drag.timer = setTimeout(flushDrag, D.dragPauseMs);
    return true;
  };
  document.addEventListener('pointerdown', function (e) { if (isRange(e.target)) drag.el = e.target; }, true);
  document.addEventListener('pointerup', endDrag, true);
  document.addEventListener('pointercancel', endDrag, true);
  document.addEventListener('change', function (e) { if (isRange(e.target)) flushDrag(); }, true);
  W.addEventListener('blur', endDrag);
  /* scheduleHair3DRefresh(07b) 첫머리 — 미니 3D는 손 뗄 때 한 번 */
  D.deferMini = function () {
    if (D.on && D.drag && drag.el) { drag.mini = true; return true; }
    return false;
  };
  /* renderAdjustFrame(07b) 끝 — 걸린 시간 기록 · 3D 미리 만들기 예약 */
  D.afterRenderAdjust = function (ms) { S.lastRenderMs = ms; schedulePre(); };

  /* ────────────────────────────────────────────────────────────────────────
   * ③-a 옛 상태의 조정 캐시 즉시 버리기
   *   캐시 키 = 상태 서명에 (뷰, 간격)만 끼운 것. 지금 상태와 다른 키는 다시 쓰일 일이 없는데
   *   LRU 3칸이 찰 때까지 남아 있었고, 3D용 전체 가닥(과 거기 딸린 복사본)이 그렇게 남았습니다.
   * ────────────────────────────────────────────────────────────────────── */
  var lastState = null;
  function normKey(k) {
    var p = String(k).split('|');
    if (p.length < 6) return k;
    p[4] = '*'; p[5] = '1.0000';
    return p.join('|');
  }
  function pruneStale(model) {
    var cur;
    try { cur = adjCacheSig(model, null, 1); } catch (e) { return; }
    if (cur === lastState) return;
    lastState = cur;
    if (pre.sig) dropPre();                       // 미리 만든 3D 헤어도 옛 상태 것
    if (bg.sig) dropBg();
    try {
      var dead = [];
      ADJ_CACHE._map.forEach(function (v, k) { if (normKey(k) !== cur) dead.push(k); });
      if (!dead.length) return;
      dead.forEach(function (k) { ADJ_CACHE._map.delete(k); });
      ADJ_CACHE._lru = ADJ_CACHE._lru.filter(function (k) { return ADJ_CACHE._map.has(k); });
      S.pruned += dead.length;
    } catch (e) {}
  }
  /* computeAdjustedHair3DStrands(17b) 첫머리 — 예전엔 _adjGeometry를 감쌌다(그 함수를 부르는 곳이 여기뿐) */
  D.pruneNow = function () { if (D.on && D.prune) { var m = neutral(); if (m) pruneStale(m); } };

  /* ────────────────────────────────────────────────────────────────────────
   * ③-b 3D 결과 화면을 나갈 때 장면 반납
   *   setupModel3DScreen은 "다음에 들어올 때" 비우므로, 조정 화면에 있는 동안 헤어·얼굴·의상의
   *   GPU 버퍼가 그대로 잡혀 있었습니다. 나갈 때 바로 비웁니다(다시 들어오면 어차피 새로 붙임).
   * ────────────────────────────────────────────────────────────────────── */
  function disposeDeep(root) {
    root.traverse(function (o) {
      try { if (o.geometry) o.geometry.dispose(); } catch (e) {}
      var mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      mats.forEach(function (m) {
        try {
          for (var k in m) { var v = m[k]; if (v && v.isTexture) v.dispose(); }
          m.dispose();
        } catch (e) {}
      });
    });
  }
  function release3D(why) {
    try {
      if (typeof model3D === 'undefined' || !model3D || !model3D.initialized || !model3D.headGroup) return;
      var g = model3D.headGroup, n = 0;
      if (!g.children.length) return;
      try { model3DGeneration++; } catch (e) {}   // 붙이는 중이던 비동기 작업(의상·얼굴)은 버림
      while (g.children.length) { var c = g.children[0]; g.remove(c); disposeDeep(c); n++; }
      // 미리 만든 헤어는 CPU 쪽 버퍼만 들고 있음(다시 들어오면 그대로 붙임). 딸린 것(헤어핀)은 뗌.
      if (pre.obj) while (pre.obj.children.length) pre.obj.remove(pre.obj.children[0]);
      try { model3D.renderer.renderLists.dispose(); } catch (e) {}
      S.released++;
      console.log(TAG + ' 3D 장면 반납 — 객체 ' + n + '개 (' + why + ')');
    } catch (e) { console.warn(TAG + ' 3D 장면 반납 실패', e); }
  }
  /* activateScreen(05) 끝 — prev = 들어오기 전 화면 */
  D.afterActivate = function (prev, name) {
      if (D.on && D.release3D && prev === 'model3d' && name !== 'model3d') {
        release3D('3D→' + name);
        // 나가는 순간 아직 만들던 중이었다면 뒤늦게 붙는 것이 있음 — 잠시 뒤 한 번 더
        [1500, 5000].forEach(function (ms) { setTimeout(function () {
          if (scr() === 'model3d') return;
          if (W.ADJUST3D && W.ADJUST3D.on && scr() === 'adjust') return;   // (2026-10-04) 조정 화면이 같은 장면을 쓰는 중
          release3D('뒤늦게 붙은 것');
        }, ms); });
      }
      if (name === 'adjust') schedulePre();
  };

  /* ────────────────────────────────────────────────────────────────────────
   * ② 3D 헤어 미리 만들기 (가닥 하나씩 최종 버퍼에 바로 쓰기)
   *
   *   원래 buildAdjustedHair3DObject (+24번 음영)와 같은 순서·같은 식:
   *     computeAdjustedHair3DStrands → [36 다듬기] → clumpStrands3D → bakeStrandColors3D → 선분 → 음영
   *   다른 점은 전체 목록을 단계마다 통째로 복사하지 않는다는 것뿐입니다.
   * ────────────────────────────────────────────────────────────────────── */
  var pre = { sig: null, obj: null, ready: false, job: null, tries: 0 };
  /* 버퍼 한 벌을 돌려 씀 — 값이 바뀔 때마다 수십 MB를 새로 잡았다 버리지 않게 */
  /* (2026-10-04f) 두 벌까지 — 조정 화면용(작은 것)과 3D 결과 화면용(큰 것)이 번갈아 쓰이므로 크기가 맞는 것만 꺼냄 */
  var pools = [];
  function recycle(b) {
    if (!b || !b.pos || !b.col) return;
    for (var i = 0; i < pools.length; i++) if (pools[i].pos === b.pos) return;
    pools.push({ pos: b.pos, col: b.col });
    if (pools.length > 2) {                                           // 가장 큰 것과 가장 작은 것만 남김
      pools.sort(function (x, y) { return x.pos.length - y.pos.length; });
      pools.splice(1, pools.length - 2);
    }
  }
  function takeBufs(need) {
    var best = -1;
    for (var i = 0; i < pools.length; i++) {
      var L = pools[i].pos.length;
      if (L >= need && pools[i].col.length >= need && L <= need * 2.2 && (best < 0 || L < pools[best].pos.length)) best = i;
    }
    if (best >= 0) { var b = pools.splice(best, 1)[0]; S.bufReuse++; return b; }
    for (i = pools.length - 1; i >= 0; i--) if (pools[i].pos.length < need) pools.splice(i, 1);   // 모자란 것은 버림
    var cap = Math.ceil(need * 1.05 / 6) * 6;
    return { pos: new Float32Array(cap), col: new Uint8Array(cap) };
  }
  /* ⑥ (2026-10-04f) 조정 화면은 가볍게 · 완성본은 뒤에서
     사용자: "조정에서 음영이랑 코팅·색 입히기까지는 필요 없다. 조정에 필요한 것만 먼저 그리고, 나머지는 그 뒤 시간에
     계속 계산해서 3D 결과보기 시간도 아끼자."
       · 조정 화면의 헤어(lite) = 고른 가닥만 · 가닥 색 한 가지(가닥마다 밝기만 조금 다르게) · 사진 색 입히기/코팅/음영 없음.
         모양(길이·컬·다발·웨이브 다듬기)은 완성본과 같습니다.
       · 그 헤어가 뜬 뒤 조용하면, 3D 결과 화면용 완성본(전체 가닥 + 사진 색 + 음영)을 뒤에서 조금씩 만듭니다(bg).
         값을 다시 움직이면 버리고 새로 시작. 3D 결과보기를 누르면 다 된 것은 바로 받아 쓰고, 덜 됐으면 이어서 만듭니다. */
  var bg = { sig: null, obj: null, ready: false, job: null };
  var forcing = false, preparing = 0, bgTimer = null, lastTouch = 0;
  try {
    ['pointerdown', 'pointermove', 'touchmove', 'wheel'].forEach(function (ev) {
      document.addEventListener(ev, function (e) { if (ev !== 'pointermove' || (e && e.buttons)) lastTouch = now(); }, { capture: true, passive: true });
    });
  } catch (e) {}
  function isLite() { return D.lite !== false && !!D.externalDriver && !forcing && scr() === 'adjust'; }
  function withFull(fn) {                                             // 조정 화면에 있으면서 "3D 결과 화면이라면"으로 계산
    var SBg = W.STRAND_BUDGET, was = forcing, wasB = SBg ? SBg.forceFull : false;
    forcing = true; if (SBg) SBg.forceFull = true;
    try { return fn(); } finally { forcing = was; if (SBg) SBg.forceFull = wasB; }
  }
  function dropBg() {
    try {
      if (bg.job && bg.job.bufs) recycle(bg.job.bufs);
      var o = bg.obj;
      if (o && !o.parent && o.userData && o.userData._bufs) {
        try { o.geometry.dispose(); } catch (e) {}
        recycle(o.userData._bufs); o.userData._bufs = null;
      }
    } catch (e2) {}
    bg.sig = null; bg.obj = null; bg.ready = false; bg.job = null;
  }
  /* 지금 pre에 든 것이 완성본(또는 만들던 완성본)이면 버리지 않고 bg로 옮김. true = 옮김 */
  function parkPreAsBg() {
    if (pre.lite !== false || !pre.sig) return false;
    if (!(pre.job || (pre.ready && pre.obj && !pre.obj.parent))) return false;
    dropBg();
    bg.sig = pre.sig; bg.obj = pre.ready ? pre.obj : null; bg.ready = !!pre.ready; bg.job = pre.job || null;
    pre.sig = null; pre.obj = null; pre.ready = false; pre.job = null; pre.tries = 0; pre.entryMade = false; pre.lite = null;
    return true;
  }
  /* 뒤에서 만든(만들던) 완성본이 지금 필요한 것이면 pre로 가져옴. true = 가져옴 */
  function adoptBg(sig) {
    if (!bg.sig || bg.sig !== sig || !(bg.ready || bg.job)) return false;
    if (bgTimer) { clearTimeout(bgTimer); bgTimer = null; }
    if (pre.sig && pre.sig !== sig) dropPre();
    pre.sig = sig; pre.obj = bg.obj; pre.ready = bg.ready; pre.job = bg.job; pre.entryMade = false; pre.lite = false;
    if (bg.ready) S.bgHit = (S.bgHit || 0) + 1; else S.bgResume = (S.bgResume || 0) + 1;
    bg.sig = null; bg.obj = null; bg.ready = false; bg.job = null;
    return true;
  }
  function scheduleBg(delay) {
    if (!D.on || D.bgFull === false || !D.pre3D) return;
    if (bgTimer) clearTimeout(bgTimer);
    bgTimer = setTimeout(bgTick, delay == null ? D.bgDelayMs : delay);
  }
  function bgTick() {
    bgTimer = null;
    if (!D.on || D.bgFull === false || !D.pre3D || !D.externalDriver || scr() !== 'adjust') return;
    if (preparing > 0 || drag.el || drag.pending) return scheduleBg(300);
    if (now() - lastTouch < 250) return scheduleBg(120);              // 손으로 돌리는 중에는 쉼
    var model = neutral();
    if (!model || !canStream()) return;
    var sig;
    try { sig = withFull(function () { return fullSig(model); }); } catch (e) { return; }
    if (bg.sig !== sig) { dropBg(); bg.sig = sig; }
    if (bg.ready) return;
    try {
      withFull(function () {
        if (!bg.job) {
          var Q = W.GYEOL_3D;
          if (Q && typeof Q.warmStep === 'function' && Q.warmStep(D.bgSliceMs) < 1) return;   // 가닥 계산의 남은 부분
          bg.job = new Job(sig, model);
        }
        bg.job.step(D.bgSliceMs);
      });
    } catch (e) { console.warn(TAG + ' 완성본 미리 만들기 중단 — 3D 결과 화면에 들어갈 때 만듭니다', e); dropBg(); return; }
    if (!bg.job || !bg.job.done) return scheduleBg(6);
    var job = bg.job, still = null; bg.job = null;
    try { still = withFull(function () { return fullSig(model); }); } catch (e) {}
    if (still !== sig) {
      try { if (job.obj && job.obj.userData) recycle(job.obj.userData._bufs); } catch (e) {}
      dropBg(); return scheduleBg();
    }
    bg.obj = job.obj; bg.ready = true;
    S.bgBuilt = (S.bgBuilt || 0) + 1;
    S.lastFullBuild = { how: '뒤에서 미리', ms: Math.round(job.ms), calc: Math.round(job.tm[0]), write: Math.round(job.tm[1]), shade: Math.round(job.tm[2]), strands: job.count || 0 };
    try {                                                              // 다 만들었으니 가닥 기억은 비움
      ADJ_CACHE._map.clear(); ADJ_CACHE._lru = [];
      var Q2 = W.GYEOL_3D; if (Q2 && typeof Q2.dropMemo === 'function') { Q2.dropMemo(); S.freedFull++; }
    } catch (e) {}
    console.log(TAG + ' 3D 결과 화면용 완성본을 뒤에서 미리 만듦 — 가닥 ' + (job.count || 0) + '개 · 일한 시간 ' + Math.round(job.ms) + 'ms');
  }
  /* (2026-10-04e) 조정 화면용 헤어 보관 — 3D 결과 화면에 가 있는 동안 조정 화면의 헤어(1만 가닥)를 버리지 않고
     CPU 버퍼만 들고 있다가(화면 메모리는 내림), 돌아오면 다시 만들지 않고 그대로 붙입니다.
     돌아오는 순간 3D 결과 화면용(3만 가닥)은 버퍼까지 버리므로 큰 것 두 벌을 같이 들고 있지 않습니다. */
  var stash = null;
  function stashForReturn() {
    if (D.stash === false || !pre.ready || !pre.obj || pre.job || pre.lite !== true) return;
    releaseStash();
    var o = pre.obj;
    try { if (o.parent) o.parent.remove(o); } catch (e) {}
    try { o.geometry.dispose(); } catch (e) {}                     // 화면(GPU) 쪽만 내림 — 버퍼는 그대로
    stash = { sig: pre.sig, obj: o };
    pre.sig = null; pre.obj = null; pre.ready = false; pre.tries = 0; pre.entryMade = false; pre.lite = null;
    S.stashKept = (S.stashKept || 0) + 1;
  }
  function releaseStash() {
    if (!stash) return;
    try {
      var o = stash.obj;
      if (o && !o.parent) {
        try { o.geometry.dispose(); } catch (e) {}
        try { if (o.material && o.material.dispose) o.material.dispose(); } catch (e) {}
        if (o.userData && o.userData._bufs) { recycle(o.userData._bufs); o.userData._bufs = null; }
      }
    } catch (e2) {}
    stash = null;
  }
  /* 보관해 둔 것이 지금 상태와 같으면 꺼내 씀. true = 꺼내 씀 */
  function takeStash(sig) {
    if (!stash) return false;
    if (stash.sig !== sig) {
      if (scr() === 'adjust') { releaseStash(); S.stashMiss = (S.stashMiss || 0) + 1; }
      return false;
    }
    var o = stash.obj; stash = null;
    if (!parkPreAsBg()) dropPre();                                 // 3D 결과 화면용 완성본은 다시 갈 때 쓰게 둠(화면 메모리는 이미 내림)
    pre.sig = sig; pre.obj = o; pre.ready = true; pre.entryMade = false; pre.lite = true;
    S.stashHit = (S.stashHit || 0) + 1;
    return true;
  }
  function dropPre() {
    try {
      if (pre.job && pre.job.bufs) recycle(pre.job.bufs);
      var o = pre.obj;
      if (o && !o.parent && o.userData && o.userData._bufs) {      // 장면에 안 붙어 있을 때만 버퍼 회수
        try { o.geometry.dispose(); } catch (e) {}
        recycle(o.userData._bufs); o.userData._bufs = null;
      }
    } catch (e2) {}
    pre.sig = null; pre.obj = null; pre.ready = false; pre.job = null; pre.tries = 0; pre.entryMade = false; pre.lite = null;
  }
  /* 3D 결과 화면에 들어가면(헤어 완성본을 붙인 뒤) 그걸 만드는 데 쓴 "전체 가닥" 기억을 비움.
     조정 화면에서는 뷰를 바꿀 때 빨리 그리려고 들고 있지만, 3D 화면에 있는 동안은 쓸 일이 없음. */
  function freeFull(model) {
    if (!D.freeFull) return;
    try {
      var k = adjCacheSig(model, null, 1);
      if (ADJ_CACHE._map.delete(k)) ADJ_CACHE._lru = ADJ_CACHE._lru.filter(function (x) { return x !== k; });
      var Q = W.GYEOL_3D;
      if (Q && typeof Q.dropMemo === 'function') { Q.dropMemo(); S.freedFull++; }
    } catch (e) {}
  }

  function braidOn() { return typeof BRAID !== 'undefined' && BRAID.on && typeof buildBraid3DObject === 'function'; }
  function canStream() {
    if (typeof THREE === 'undefined' || braidOn()) return false;
    if (typeof bakeStrandColors3D !== 'function' || typeof viewOfRoot !== 'function' || typeof HAIR_PIXEL_COLOR === 'undefined') return false;
    var GW = W.GLOSS_WAVE;
    if (GW && typeof GW.strand !== 'function') return false;   // 36번이 옛 버전 — 원래 경로로
    return true;
  }
  function fullSig(model) {
    var a = [adjCacheSig(model, null, 1), typeof adjFilterSig === 'function' ? adjFilterSig() : ''];
    try { a.push(J([HAIR_CLUMP3D.on, HAIR_CLUMP3D.cellCm, HAIR_CLUMP3D.pull, HAIR_CLUMP3D.rampCm, HAIR_CLUMP3D.tailCm])); } catch (e) { a.push('-'); }
    var GW = W.GLOSS_WAVE; a.push(GW && GW.cfg ? J(GW.cfg()) : '-');
    var SB = W.STYLE_BASE; a.push(SB ? J([SB.on, (SB.active && SB.active.shade) || SB.shade]) : '-');
    a.push(J(HAIR_PIXEL_COLOR));
    try { a.push(modelCmPerUnit()); } catch (e) { a.push('-'); }
    try { var E = getHeadEllipsoid(); a.push(E.a + ',' + E.b + ',' + E.c); } catch (e) { a.push('-'); }
    a.push(typeof SCALP_CENTER_Y !== 'undefined' ? SCALP_CENTER_Y : '-', model.CY, model.yTop, J(model.viewCal));
    a.push(isLite() ? 'lite' : 'full');
    return a.join('\u00a7');
  }

  function b8(v) { return v >= 1 ? 255 : v > 0 ? Math.round(v * 255) : 0; }
  function Job(sig, model) {
    this.sig = sig; this.model = model; this.stage = 0; this.done = false; this.obj = null;
    this.i = 0; this.cur = 0; this.pix = 0; this.ms = 0; this.frac = 0;
    this.tm = [0, 0, 0];   // 단계별 ms: 가닥 계산(init) · 가닥 쓰기(다듬기·뭉치기·색) · 음영
    this.lite = isLite();  // 조정 화면용: 사진 색 입히기·코팅·음영 없이
  }
  Job.prototype.finish = function (obj) { this.obj = obj; this.done = true; this.frac = 1; this.list = this.rep = this.repCache = null; };

  Job.prototype.init = function () {
    var GW = W.GLOSS_WAVE, list;
    if (GW) GW._defer = true;                     // 다듬기는 아래에서 가닥 단위로
    try { list = W.computeAdjustedHair3DStrands(); } finally { if (GW) GW._defer = false; }
    if (!list || !list.length) return this.finish(null);
    this.list = list;
    this.gcfg = GW && GW.cfg && Array.isArray(list) ? GW.cfg() : null;
    if (this.lite && this.gcfg && this.gcfg.shape === false) this.gcfg = null;   // 코팅만 하는 스타일(모양 그대로) — 조정 화면에선 건너뜀
    this.gcpu = this.gcfg ? GW.cpu() : 0;
    var n = list.length, i;

    // 다발: 뿌리가 같은 칸(cellCm)에 든 가닥들 → 칸 중심에 가장 가까운 가닥이 대표
    this.rep = null;
    if (typeof HAIR_CLUMP3D !== 'undefined' && HAIR_CLUMP3D.on && n >= 2 && typeof clumpStrands3D === 'function') {
      var cmu = null;
      try { cmu = typeof modelCmPerUnit === 'function' ? modelCmPerUnit() : null; } catch (e) {}
      if (cmu > 0) {
        var cell = HAIR_CLUMP3D.cellCm / cmu, cells = new Map(), rep = new Int32Array(n).fill(-1);
        this.ramp = HAIR_CLUMP3D.rampCm / cmu; this.tail = HAIR_CLUMP3D.tailCm / cmu;
        this.pull = Math.max(0, Math.min(1, HAIR_CLUMP3D.pull));
        for (i = 0; i < n; i++) {
          var r = list[i] && list[i].pts && list[i].pts[0];
          if (!r || !isFinite(r.x) || !isFinite(r.y) || !isFinite(r.z)) continue;
          var key = Math.floor(r.x / cell) + ',' + Math.floor(r.y / cell) + ',' + Math.floor(r.z / cell);
          var arr = cells.get(key);
          if (!arr) { arr = []; cells.set(key, arr); }
          arr.push(i);
        }
        cells.forEach(function (idx, key) {
          if (idx.length < 2) return;
          var k = key.split(',').map(Number);
          var cx = (k[0] + 0.5) * cell, cy = (k[1] + 0.5) * cell, cz = (k[2] + 0.5) * cell;
          var best = idx[0], bd = Infinity;
          for (var j = 0; j < idx.length; j++) {
            var q = list[idx[j]].pts[0];
            var d = Math.pow(q.x - cx, 2) + Math.pow(q.y - cy, 2) + Math.pow(q.z - cz, 2);
            if (d < bd) { bd = d; best = idx[j]; }
          }
          var rp = list[best].pts;
          if (!rp || rp.length < 2) return;
          for (var m = 0; m < idx.length; m++) rep[idx[m]] = best;
        });
        this.rep = rep; this.repCache = new Map();
      }
    }

    var segs = 0;
    for (i = 0; i < n; i++) { var p = list[i] && list[i].pts; if (p && p.length >= 2) segs += p.length - 1; }
    this.bufs = takeBufs(segs * 6);               // 위치 float32 · 색 8비트(사진 색이 원래 8비트)
    this.pos = this.bufs.pos; this.col = this.bufs.col;
    this.color = new THREE.Color();
    this.stage = 1;
  };

  Job.prototype.gloss = function (i) {
    var sd = this.list[i];
    return this.gcfg ? W.GLOSS_WAVE.strand(sd, this.gcfg, this.gcpu, null) : sd;
  };
  Job.prototype.repOf = function (r) {
    var R = this.repCache.get(r);
    if (!R) {
      var g = this.gloss(r);
      R = { g: g, arc: _clumpArc(g.pts) };
      this.repCache.set(r, R);
    }
    return R;
  };

  Job.prototype.strand = function (i) {
    var sd = this.list[i];
    if (!sd || !sd.pts || sd.pts.length < 2) return;
    var r = this.rep ? this.rep[i] : -1, g, pts;
    if (r === i) g = this.repOf(i).g; else g = this.gloss(i);
    pts = g.pts;
    if (r >= 0 && r !== i) {                      // 대표 가닥 쪽으로 당김
      var R = this.repOf(r), rp = R.g.pts, ra = R.arc, RL = ra[ra.length - 1];
      var a = _clumpArc(pts), np = new Array(pts.length);
      for (var k = 0; k < pts.length; k++) {
        var s = a[k], w = this.pull * Math.min(1, s / (this.ramp || 1e-9));
        if (s > RL) w *= Math.max(0, 1 - (s - RL) / (this.tail || 1e-9));
        if (w <= 0) { np[k] = pts[k]; continue; }
        var c = _clumpAt(rp, ra, Math.min(s, RL)), p = pts[k];
        np[k] = { x: p.x + (c.x - p.x) * w, y: p.y + (c.y - p.y) * w, z: p.z + (c.z - p.z) * w };
      }
      pts = np;
    }
    if (!pts || pts.length < 2) return;

    var cols = null;
    if (!this.lite) {
      var ang = g.srcAngle || (pts[0] ? viewOfRoot(pts[0]) : null);
      cols = HAIR_PIXEL_COLOR.reproject && ang ? bakeStrandColors3D(pts, this.model, ang, g.color, g.colors, g.dye) : (g.colors || null);
    }
    var use = cols && cols.length > 1 ? cols : null;
    if (use) this.pix++;
    var n = pts.length, m = use ? use.length : 0, C = this.color, P = this.pos, K = this.col, o = this.cur;
    if (!use) {
      try { C.set(g.color || '#1a1a1a'); } catch (e0) { C.set('#1a1a1a'); }
      if (this.lite) {                                // 가닥마다 밝기를 조금 다르게 — 한 덩어리로 뭉개져 보이지 않게
        var jf = 0.78 + 0.5 * (((i * 2654435761) >>> 0) / 4294967296);
        C.r *= jf; C.g *= jf; C.b *= jf;
      }
    }
    var ci = 0, lim = use ? Math.round((ci + 1) * (n - 1) / m) : n - 1;
    if (use) try { C.set(use[0]); } catch (e) { C.set(g.color || '#1a1a1a'); }
    for (var q = 1; q < n; q++) {
      if (use) {
        while (ci < m - 1 && q > lim) { ci++; lim = Math.round((ci + 1) * (n - 1) / m); }
        try { C.set(use[ci]); } catch (e2) {}
      }
      var A = pts[q - 1], B = pts[q];
      if (!isFinite(A.x) || !isFinite(A.y) || !isFinite(A.z)) continue;
      if (!isFinite(B.x) || !isFinite(B.y) || !isFinite(B.z)) continue;
      P[o] = A.x; P[o + 1] = A.y; P[o + 2] = A.z; P[o + 3] = B.x; P[o + 4] = B.y; P[o + 5] = B.z;
      K[o] = K[o + 3] = b8(C.r); K[o + 1] = K[o + 4] = b8(C.g); K[o + 2] = K[o + 5] = b8(C.b);
      o += 6;
    }
    this.cur = o;
  };

  Job.prototype.makeObject = function () {
    this.count = this.list.length;
    this.list = this.rep = this.repCache = null;
    if (!this.cur) { recycle(this.bufs); this.bufs = null; return this.finish(null); }
    this.pos = this.pos.subarray(0, this.cur); this.col = this.col.subarray(0, this.cur);
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3, true));
    var obj = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true }));
    obj.name = 'adjustedHair';
    obj.userData._bufs = this.bufs; this.bufs = null;
    this.obj = obj;
    if (this.lite) return this.finish(obj);          // 조정 화면용은 음영 없음

    // 음영(24번 shadeHairObject와 같은 식 — 색 버퍼에 바로 덮어씀)
    var SB = W.STYLE_BASE, sh = SB && SB.on && ((SB.active && SB.active.shade) || SB.shade);
    var n = this.pos.length / 3, E = null;
    if (sh && typeof SB._shade === 'function' && n >= 4) { try { E = getHeadEllipsoid(); } catch (e) { E = null; } }
    if (!E) return this.finish(obj);
    this.sh = sh; this.E = E; this.n = n;
    this.cy = typeof SCALP_CENTER_Y !== 'undefined' ? SCALP_CENTER_Y : 0.15;
    this.rho = new Float32Array(n); this.bin = new Uint16Array(n); this.bmax = new Float32Array(36 * 18);
    this.i = 0; this.stage = 3;
  };

  Job.prototype.shadeA = function (end) {          // 방향 칸마다 가장 바깥 반지름
    var P = this.pos, E = this.E, cy = this.cy, rho = this.rho, bin = this.bin, bmax = this.bmax, NT = 36, NP = 18;
    for (var i = this.i; i < end; i++) {
      var dx = P[i * 3] / E.a, dy = (P[i * 3 + 1] - cy) / E.b, dz = P[i * 3 + 2] / E.c;
      var r = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
      var th = Math.atan2(dx, dz), ph = Math.acos(Math.max(-1, Math.min(1, dy / r)));
      var bi = Math.min(NP - 1, (ph / Math.PI * NP) | 0) * NT + Math.min(NT - 1, ((th + Math.PI) / (2 * Math.PI) * NT) | 0);
      rho[i] = r; bin[i] = bi; if (r > bmax[bi]) bmax[bi] = r;
    }
    this.i = end;
  };
  Job.prototype.shadeCap = function () {           // 밝기 중앙값 → 상한
    var K = this.col, n = this.n, L = new Float64Array(Math.ceil(n / 7)), c = 0;
    for (var j = 0; j < n; j += 7) L[c++] = (0.299 * K[j * 3] + 0.587 * K[j * 3 + 1] + 0.114 * K[j * 3 + 2]) / 255;
    L.sort();
    this.cap = (L[L.length >> 1] || 0.2) * this.sh.lumCap;
    var Lt = [0.3, 0.8, 0.5], V = [0, 0, 1], H = [Lt[0] + V[0], Lt[1] + V[1], Lt[2] + V[2]];
    var hl = Math.hypot(H[0], H[1], H[2]);
    this.H = [H[0] / hl, H[1] / hl, H[2] / hl];
    this.i = 0; this.stage = 5;
  };
  Job.prototype.shadeB = function (end) {          // 안쪽 가닥 어둡게 · 밝기 상한 · 결 하이라이트
    var P = this.pos, K = this.col, sh = this.sh, H = this.H, cap = this.cap, rho = this.rho, bin = this.bin, bmax = this.bmax;
    for (var s = this.i; s + 1 < end; s += 2) {
      var tx = P[s * 3 + 3] - P[s * 3], ty = P[s * 3 + 4] - P[s * 3 + 1], tz = P[s * 3 + 5] - P[s * 3 + 2];
      var tl = Math.hypot(tx, ty, tz) || 1e-9;
      var th2 = (tx * H[0] + ty * H[1] + tz * H[2]) / tl;
      var kk = Math.pow(Math.sqrt(Math.max(0, 1 - th2 * th2)), sh.specPow);
      for (var q = s; q < s + 2; q++) {
        var bm = bmax[bin[q]], d = bm > 1.02 ? Math.max(0, Math.min(1, (rho[q] - 1) / (bm - 1))) : 1;
        var ao = sh.ao + (1 - sh.ao) * Math.pow(d, 0.8);
        var rr = K[q * 3] / 255, gg = K[q * 3 + 1] / 255, bb = K[q * 3 + 2] / 255;
        var lum = 0.299 * rr + 0.587 * gg + 0.114 * bb;
        if (lum > cap && lum > 0) { var f = cap / lum; rr *= f; gg *= f; bb *= f; }
        var sp = kk * sh.spec * d * d;
        K[q * 3] = b8(rr * ao + sp * 0.85);
        K[q * 3 + 1] = b8(gg * ao + sp * 0.8);
        K[q * 3 + 2] = b8(bb * ao + sp * 0.72);
      }
    }
    this.i = end;
  };

  // budget(ms) 동안만 일하고 돌아옴. Infinity면 끝까지.
  Job.prototype.step = function (budget) {
    var t0 = now(), n, end, s0, g;
    while (!this.done) {
      s0 = now(); g = this.stage === 0 ? 0 : this.stage <= 2 ? 1 : 2;
      if (this.stage === 0) this.init();
      else if (this.stage === 1) {
        n = this.list.length; end = Math.min(n, this.i + 4);
        for (; this.i < end; this.i++) this.strand(this.i);
        this.frac = 0.85 * this.i / n;
        if (this.i >= n) this.stage = 2;
      }
      else if (this.stage === 2) this.makeObject();
      else if (this.stage === 3) {
        this.shadeA(Math.min(this.n, this.i + 8000));
        this.frac = 0.85 + 0.05 * this.i / this.n;
        if (this.i >= this.n) this.stage = 4;
      }
      else if (this.stage === 4) this.shadeCap();
      else if (this.stage === 5) {
        end = Math.min(this.n, this.i + 6000);      // 짝수 유지(선분 = 정점 2개)
        this.shadeB(end);
        this.frac = 0.9 + 0.1 * this.i / this.n;
        if (this.i >= this.n) { this.obj.geometry.attributes.color.needsUpdate = true; this.rho = this.bin = this.bmax = null; this.finish(this.obj); }
      }
      this.tm[g] += now() - s0;
      if (now() - t0 >= budget) break;
    }
    this.ms += now() - t0;
  };
  D._Job = Job;   // 점검용

  /* 조정 화면이 한가할 때 조금씩 */
  var preTimer = null;
  function schedulePre(delay, cont) {
    if (!D.on || !D.pre3D) return;
    if (D.externalDriver) return;                 // (2026-10-04) 43번(조정 화면 3D)이 직접 만들기를 몰 때는 배경 작업을 안 돌림
    if (preTimer) clearTimeout(preTimer);
    preTimer = setTimeout(function () { preTick(cont); }, delay == null ? D.preDelayMs : delay);
  }
  function preTick(cont) {
    preTimer = null;
    if (!D.on || !D.pre3D || scr() !== 'adjust') return;
    if (drag.el || drag.pending) return schedulePre(300);
    var model = neutral();
    if (!model || !canStream()) return;
    var sig;
    if (cont && pre.job && pre.job.model === model) sig = pre.job.sig;   // 이어 하는 조각 — 서명은 끝날 때 다시 확인
    else {
      try { sig = fullSig(model); } catch (e) { return; }
      if (pre.sig !== sig) { dropPre(); pre.sig = sig; }
    }
    if (pre.ready) return;
    if (!pre.job) {
      var Q = W.GYEOL_3D;
      if (!Q || typeof Q.warmReady !== 'function') return;          // 28번이 옛 버전 — 진입 때 만듦
      if (!Q.warmReady()) {                                           // 가닥 미리계산이 끝나길 기다림
        if (pre.tries === 0 && Q.scheduleWarm) Q.scheduleWarm();
        if (++pre.tries < 600) schedulePre(D.prePollMs || 500);
        return;
      }
      pre.job = new Job(sig, model);
    }
    try { pre.job.step(D.sliceMs); }
    catch (e) { console.warn(TAG + ' 3D 미리 만들기 중단 — 진입 때 원래 방식으로 만듭니다', e); dropPre(); return; }
    if (!pre.job.done) return schedulePre(0, true);
    var job = pre.job; pre.job = null;
    var still = null;
    try { still = fullSig(model); } catch (e) {}
    if (still !== sig) {                                             // 만드는 사이 값이 바뀜
      try { if (job.obj) recycle(job.obj.userData._bufs); } catch (e) {}
      dropPre(); return schedulePre();
    }
    pre.obj = job.obj; pre.ready = true; pre.lite = !!job.lite; S.preBuiltMs = job.ms; noteBuild(job, '미리');
    console.log(TAG + ' 3D 헤어 미리 만들기 끝 — 가닥 ' + (job.count || 0) + '개 · 선분 ' + (job.obj ? job.pos.length / 6 : 0) +
      '개 · 일한 시간 ' + Math.round(job.ms) + 'ms (조금씩 나눠서) · 3D 결과보기는 이걸 받아 씁니다');
  }

  function noteBuild(job, how) {
    if (!job.lite) S.lastFullBuild = { how: how, ms: Math.round(job.ms), calc: Math.round(job.tm[0]), write: Math.round(job.tm[1]), shade: Math.round(job.tm[2]), strands: job.count || 0 };
    S.lastBuild = { how: how, ms: Math.round(job.ms), calc: Math.round(job.tm[0]), write: Math.round(job.tm[1]), shade: Math.round(job.tm[2]), strands: job.count || 0 };
  }

  /* ────────────────────────────────────────────────────────────────────────
   * ④ 3D 진입 때 남은 일을 나눠서 하기 (진행률 표시)
   *   순서: 가닥 미리계산의 남은 부분(28번 warmStep) → 헤어 만들기 Job의 남은 부분.
   *   둘 다 조정 화면에서 하던 일을 그대로 이어서 하는 것이라 결과는 같습니다.
   *   돌려주는 값(Promise): true = 헤어가 준비됨 · false = 못 함(원래 경로가 진입 때 만듦)
   * ────────────────────────────────────────────────────────────────────── */
  D.prepare3D = function (onProg) {
    return new Promise(function (res0) {
      preparing++;
      if (bgTimer) { clearTimeout(bgTimer); bgTimer = null; }
      var settled = false;
      function res(v) { if (settled) return; settled = true; preparing = Math.max(0, preparing - 1); res0(v); }
      var model, sig, Q = W.GYEOL_3D;
      try {
        if (!D.on || !D.pre3D || !canStream()) return res(false);
        model = neutral(); if (!model) return res(false);
        // (2026-10-04) 값이 바뀐 뒤 처음이면 "옛 상태 정리"를 여기서 먼저 끝냄. 예전에는 2D 그리기가 먼저 돌면서
        // 해 줬는데, 조정 화면이 3D가 되면서(43번) 2D 그리기가 없어져 만들던 것이 중간에 버려졌음.
        if (D.prune) pruneStale(model);
        sig = fullSig(model);
      } catch (e) { return res(false); }
      if (pre.sig === sig && pre.ready) return res(true);
      try { if (adoptBg(sig) && pre.ready) return res(true); } catch (e) {}   // (2026-10-04f) 뒤에서 미리 만든 완성본(덜 됐으면 아래에서 이어서)
      try { if (takeStash(sig)) return res(true); } catch (e) {}      // (2026-10-04e) 3D 결과 화면에 가기 전에 보관해 둔 헤어
      if (pre.sig !== sig) { if (!parkPreAsBg()) dropPre(); pre.sig = sig; }
      if (preTimer) { clearTimeout(preTimer); preTimer = null; }
      var job = pre.job, phaseA = !job && Q && typeof Q.warmStep === 'function';
      if (job) S.preResume++; else S.preCold++;
      var slice = D.entrySliceMs || 40;
      function prog(f) { if (onProg) try { onProg(f); } catch (e) {} }
      function tick() {
        try {
          if (pre.sig !== sig) return res(false);                       // 그 사이 다른 쪽에서 버림
          if (phaseA) {                                                 // 가닥 계산의 남은 부분
            var f = Q.warmStep(slice);
            if (f < 1) { prog(0.45 * f); return setTimeout(tick, 0); }
            phaseA = false;
          }
          if (!job) { job = pre.job || new Job(sig, model); pre.job = job; }
          if (pre.job !== job) return res(false);
          job.step(slice);
          prog(0.45 + 0.55 * job.frac);
          if (!job.done) return setTimeout(tick, 0);
          pre.job = null; pre.obj = job.obj; pre.ready = true; pre.entryMade = true; pre.lite = !!job.lite;
          S.preBuiltMs = job.ms; noteBuild(job, job.lite ? '조정 화면(가볍게)' : '진입(나눠서)');
          res(true);
        } catch (e) {
          console.warn(TAG + ' 진입 때 나눠서 만들기 중단 — 원래 방식으로 만듭니다', e);
          dropPre(); res(false);
        }
      }
      tick();
    });
  };

  var setupGen = 0;
  /* ⑤ 얼굴(메쉬 또는 사진 데칼)은 setupModel3DScreen이 끝난 뒤에 따로 붙으므로, 그 약속을 잡아 둠(12a에서 부름) */
  var faceP = null, decalP = null;
  D.noteFace = function (idx, r) { if (idx === 0) { faceP = r; decalP = null; } else decalP = r; };
  /* 돌려주는 Promise는 장면이 실제로 보이는 순간에 풀립니다(38번의 "걸린 시간"이 보일 때까지의 시간이 되도록). */
  function runSetup(self, args, gen, onShown) {
    faceP = decalP = null;
    var t0 = now(), p = setupModel3DScreenBase.apply(self, args), g = null;
    function finish() { if (onShown) try { onShown(); } catch (e) {} }
    try { g = D.showTogether && typeof model3D !== 'undefined' && model3D && model3D.initialized ? model3D.headGroup : null; } catch (e) { g = null; }
    if (!g) { Promise.resolve(p).then(finish, finish); return p; }
    g.visible = false;                                                   // 첫 프레임이 그려지기 전(같은 작업 안)
    return new Promise(function (res, rej) {
      var done = false, tSetup = null;
      function show(byGuard) {
        if (done) return; done = true; clearTimeout(guard); g.visible = true;
        S.lastShow = { setupMs: tSetup == null ? null : Math.round(tSetup), shownMs: Math.round(now() - t0), guard: !!byGuard };
        finish(); res();
      }
      var guard = setTimeout(function () { show(true); }, 6000);
      function settle(x) { return x && typeof x.then === 'function' ? x.then(function () {}, function () {}) : Promise.resolve(); }
      Promise.resolve(p).then(function () {
        tSetup = now() - t0;
        settle(faceP).then(function () { return settle(decalP); }).then(function () { setTimeout(function () { show(false); }, 0); });
      }, function (e) { show(false); rej(e); });
    });
  }
  /* setupModel3DScreen(18) 몸통 — 원래 화면 만들기는 setupModel3DScreenBase */
  {
    D.setupScreen = function (self, args) {
      var gen = ++setupGen;
      if (!D.on) return setupModel3DScreenBase.apply(self, args);
      if (!D.pre3D || !D.entryProgress || !neutral()) return runSetup(self, args, gen);
      try {
        var sigNow = fullSig(neutral());
        if (pre.sig !== sigNow) {
          try { stashForReturn(); } catch (e1) {}                        // (2026-10-04e) 조정 화면의 헤어는 돌아올 때 쓰게 보관
          try { adoptBg(sigNow); } catch (e2) {}                         // (2026-10-04f) 뒤에서 미리 만든 완성본
        }
        if (pre.ready && pre.sig === sigNow) return runSetup(self, args, gen);
      } catch (e) { return runSetup(self, args, gen); }
      var shown = false, sub = null, lastPct = -1;
      try {
        if (typeof showAI === 'function') { showAI('3D 헤어 만드는 중…', '0%'); shown = true; sub = document.getElementById('aiOverlaySub'); }
      } catch (e) {}
      function hide() { if (shown) { shown = false; try { hideAI(); } catch (e) {} } }
      function go() {
        if (gen !== setupGen || scr() !== 'model3d') { hide(); return; }  // 그 사이 나갔거나 다시 들어옴
        if (sub) sub.textContent = '의상·얼굴 붙이는 중…';
        try { return runSetup(self, args, gen, hide); } catch (e) { hide(); throw e; }
      }
      return new Promise(function (r) {                                  // 안내를 먼저 그리고 시작
        var raf = W.requestAnimationFrame || function (f) { return setTimeout(f, 16); };
        raf(function () { setTimeout(r, 0); });
      }).then(function () {
        return D.prepare3D(function (f) {
          var pct = Math.round(f * 100);
          if (sub && pct !== lastPct) { lastPct = pct; sub.textContent = pct + '%'; }
        });
      }).then(go, go);
    };
  }

  /* buildAdjustedHair3DObject(14) 몸통 — 원래 만들기는 buildAdjustedHair3DObjectBase(24 음영·28 시간이 감쌈) */
  {
    D.buildHair = function (self, args) {
      if (!D.on || !D.pre3D || !canStream()) return buildAdjustedHair3DObjectBase.apply(self, args);
      var model = neutral();
      if (!model) return buildAdjustedHair3DObjectBase.apply(self, args);
      try {
        var sig = fullSig(model), t0 = now(), how;
        if (pre.sig === sig && pre.ready) {
          if (pre.entryMade) how = '진입 때 나눠서 만든 것'; else { S.preHit++; how = '미리 만든 것 받아 씀'; }
          pre.entryMade = false;
        }
        else {
          if (pre.sig !== sig) { dropPre(); pre.sig = sig; }
          var job = pre.job;
          if (job) { S.preResume++; how = '만들던 데서 이어서(' + Math.round(job.frac * 100) + '%부터)'; }
          else { job = new Job(sig, model); S.preCold++; how = '지금 만듦'; }
          pre.job = null;
          job.step(Infinity);
          pre.obj = job.obj; pre.ready = true; pre.lite = !!job.lite; noteBuild(job, job.lite ? '조정 화면(한 번에)' : '진입(한 번에)');
        }
        if (isLite() && D.bgFull !== false) scheduleBg();   // 조정 화면: 가닥 기억을 그대로 두고, 조용해지면 완성본을 뒤에서 만듦
        else freeFull(model);   // 3D 화면에 있는 동안은 전체 가닥 기억이 필요 없음(조정 화면으로 돌아오면 28번이 다시 채움)
        console.log(TAG + ' 3D 헤어 — ' + how + ' · ' + Math.round(now() - t0) + 'ms');
        return pre.obj;
      } catch (e) {
        console.warn(TAG + ' 3D 헤어 새 방식 실패 — 원래 방식으로 만듭니다', e);
        dropPre(); S.preFallback++;
        return buildAdjustedHair3DObjectBase.apply(self, args);
      }
    };
  }

  /* (2026-10-04) 장면에서 뗀 헤어 객체의 버퍼를 돌려받음 — 43번이 값이 바뀔 때마다 헤어를 갈아 끼우면서 부름 */
  D.recycleObject = function (o) {
    try {
      if (!o || o.parent) return;
      try { o.geometry.dispose(); } catch (e) {}
      try { if (o.material && o.material.dispose) o.material.dispose(); } catch (e) {}
      if (o.userData && o.userData._bufs && o !== pre.obj && o !== bg.obj && !(stash && o === stash.obj)) { recycle(o.userData._bufs); o.userData._bufs = null; }
    } catch (e2) {}
  };

  /* ── 상태 ─────────────────────────────────────────────────────────────── */
  function preLine() {
    if (!D.pre3D) return '꺼짐';
    if (braidOn()) return '레게펌 — 원래 경로';
    if (pre.ready) return '준비됨';
    if (pre.job) return '만드는 중 ' + Math.round(pre.job.frac * 100) + '%';
    return '대기';
  }
  D.status = function () {
    return { drag: { deferred: S.deferred, lastRenderMs: Math.round(S.lastRenderMs), live: !(S.lastRenderMs > D.dragLiveMs) },
      pruned: S.pruned, released3D: S.released,
      pre3D: { state: preLine(), hit: S.preHit, resumed: S.preResume, cold: S.preCold, fallback: S.preFallback, builtMs: Math.round(S.preBuiltMs), last: S.lastBuild } };
  };
  /* perfPanelLines(18) 끝에 붙는 한 줄 */
  D.panelLine = function () {
    return ('[폰 다이어트] 드래그 중 미룬 그림 ' + S.deferred + '회(직전 렌더 ' + Math.round(S.lastRenderMs) + 'ms) · 옛 캐시 버림 ' + S.pruned +
      '벌 · 전체 가닥 기억 비움 ' + S.freedFull + '회 · 버퍼 재사용 ' + S.bufReuse + '회 · 3D 장면 반납 ' + S.released + '회 · 3D 미리 만들기: ' + preLine() + ' (받아 씀 ' + S.preHit + ' / 이어서 ' + S.preResume +
      ' / 진입 때 만듦 ' + S.preCold + ' / 원래 방식 ' + S.preFallback + ')' +
      (S.lastBuild ? ' · 마지막 헤어 만들기[' + S.lastBuild.how + '] ' + S.lastBuild.ms + 'ms = 가닥 계산 ' + S.lastBuild.calc + ' + 가닥 쓰기 ' + S.lastBuild.write + ' + 음영 ' + S.lastBuild.shade + ' (가닥 ' + S.lastBuild.strands + '개)' : '') +
      ' · 완성본 뒤에서 만들기: ' + (D.bgFull === false ? '꺼짐' : bg.ready ? '준비됨' : bg.job ? '만드는 중 ' + Math.round(bg.job.frac * 100) + '%' : '대기') +
      ' (다 만듦 ' + (S.bgBuilt || 0) + ' / 3D 진입 때 받아 씀 ' + (S.bgHit || 0) + ' / 이어서 ' + (S.bgResume || 0) + ')' +
      (S.lastFullBuild ? ' · 마지막 완성본[' + S.lastFullBuild.how + '] ' + S.lastFullBuild.ms + 'ms = 가닥 계산 ' + S.lastFullBuild.calc + ' + 가닥 쓰기 ' + S.lastFullBuild.write + ' + 음영 ' + S.lastFullBuild.shade + ' (가닥 ' + S.lastFullBuild.strands + '개)' : '') +
      ' · 조정 화면 헤어 보관: ' + (stash ? '보관 중' : '없음') + ' (보관 ' + (S.stashKept || 0) + ' / 돌아와서 받아 씀 ' + (S.stashHit || 0) + ' / 상태가 달라 못 씀 ' + (S.stashMiss || 0) + ')' +
      (S.lastShow ? ' · 3D 장면 붙이기 ' + S.lastShow.setupMs + 'ms → 한꺼번에 보임 ' + S.lastShow.shownMs + 'ms' + (S.lastShow.guard ? ' ⚠ 6초 안전장치로 보임(얼굴 붙기를 못 기다림)' : '') : ''));
  };

  console.log(TAG + ' 설치 — 드래그 중 그림 미루기 · 옛 캐시 즉시 버림 · 3D 나갈 때 장면 반납 · 3D 헤어 미리 만들기. 끄기 MOBILE_DIET.on=false · 상태 MOBILE_DIET.status()');
  return D;
})();


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
  PHOTO_CHANGE._forget();   // (옛 49) 사진까지 지우므로 사진 지문도 비움(05)
  stylePrepDone=false;
  state.hair3D=null; state.hair3Dneutral=null; // (11차) 3D 모델 캐시도 새 고객마다 무효화
  state._model3DCrownY = null;                 // (2026-09-09) 두신 자도 고객마다 다시 잰다
  if(typeof resetScalpSkinSample === 'function') resetScalpSkinSample(); // 두피색 픽셀 표본
  if(typeof HAIR_IDENTITY !== 'undefined') HAIR_IDENTITY._refSkinCss = null; // (2026-09-16) 숱 판정 빌림 살색도 손님마다
  if(typeof combClear === 'function') combClear();      // (#5) 빗질도 고객마다 초기화
  state.hairField3D=null; // (2026-08-01) 3D 결 필드도 사람이 바뀌면 통째로 무효
  state.hairOcc3D=null;   // (2026-08-01) 3D 점유 필드도 마찬가지
  state.hairIdentity=null; // (2026-08-01) 모발 프로필 — 사람이 바뀌면 당연히 버린다
  for(const k in _viewMaskCache) delete _viewMaskCache[k]; // 뷰 마스크 샘플러 캐시
  state.aiOutfitRecommendation=null; // (3단계) 의상 추천 캐시도 초기화
  if (typeof resetBodyBase === 'function') resetBodyBase(); // 의상 갈아입히기: 몸·옷 리그 무효
  _garmentNeckOpening = null;        // (11차) 옷깃 구멍 실측 — 사람·의상이 바뀌면 무효
  // (2026-09-21 배포본 반영) 몸통 베이스 캐시도 새 손님마다 초기화 — 21-body-base.js가
  // 로드돼 있을 때만(지금 index.html은 안 불러서 typeof 가드로 건너뛴다).
  if(typeof resetBodyBase === 'function') resetBodyBase();
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
  if(typeof resetFade === 'function') resetFade();   // (2026-09-16) 새 손님 — 앞 손님 클리퍼를 물려주지 않는다
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
  '2/4 · 스타일':'2/4 · Style', '3/4 · 조정':'3/4 · Adjust', '4/4 · 3D두상':'4/4 · 3D Head',   // (옛 34) 4단계 표시
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
  '조정하기 →':'Adjust →', '🗑 삭제':'🗑 Delete', '내가 등록한 스타일만 삭제할 수 있어요':'Only styles you saved can be deleted',
  '이 스타일을 삭제할까요?':'Delete this style?', '스타일을 삭제했어요':'style deleted', '← 스타일':'← Style', '결과 보기 →':'View result →',
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
  '3D 미리보기: ON':'3D preview: ON',   // (2026-09-13) 기본값이 ON이 되면서 이쪽이 첫 화면 문구가 됐다
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
  // (옛 46) 브라우저 탭 제목은 <head>에 있어 화면 번역이 닿지 않음 — 언어에 맞춰 바꿈
  try{ document.title = (uiLang === 'ko') ? '결 GYEOL — 스타일 프리뷰' : 'GYEOL — Style Preview'; }catch(e){}
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
