/* ══════════════════════════════════════════════════════════
   07b-render-compare.js — 2D·3D 대조 도장 · 해상도 단일 출처
   원본 index.html 11386~12405행. 클래식 스크립트이므로 로드 순서가 곧
   실행 순서다 — index.html의 <script src> 순서를 바꾸지 말 것.
   ══════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════════
   두 화면 대조 도장 — "3D랑 2D가 너무 다르다"를 <b>가른다</b> (2026-09-01 3차)
   ─────────────────────────────────────────────────────────────────
   사용자: "2D투영을 손을 봐야겠다 … 3D에서 나타나는 거랑 너무 달라."
   영상이 보여주는 것은 <b>반대 방향의 두 극단</b>이다:
     조정 화면(2D 투영)  — 페이드 폼파두르인데 <b>어깨까지 오는 긴 머리</b>
     3D 두상 화면        — 같은 스타일인데 <b>거의 민머리</b>
   그런데 코드를 따라가면 두 화면은 <b>같은 배열</b>을 받는다:
     projectHair3DToView    → computeAdjustedHair3DStrands(null, stride)
     buildAdjustedHair3DObject → computeAdjustedHair3DStrands()
   둘 다 _adjGeometry → adjustStrandGeom(커트·펌·스타일링·페이드) 한 경로다.
   즉 <b>코드가 맞다면 이 그림이 나올 수 없다.</b>

   ── 그래서 추측으로 고치지 않는다 ────────────────────────────────
   이 파일이 반복해서 당한 방식이 정확히 여기다 — 화면을 보고 원인을 찍고
   계수를 흔드는 것. 갈래는 둘뿐이고, 숫자 하나면 갈린다:
     ⓐ 두 화면이 <b>다른 배열</b>을 받는다   → 원인은 소스(캐시·마네킹·상태 시점)
     ⓑ 같은 배열인데 <b>다르게 그린다</b>    → 원인은 투영(컬링·트리밍·그리기)
   그래서 두 호출부에서 <b>같은 자</b>로 재서 도장을 찍는다. 새로 재는 게
   아니라 이미 만들어진 배열을 훑는 것이라(가닥당 점 몇 개) 비용이 0에 가깝고,
   프레임마다가 아니라 <b>값이 바뀔 때만</b> 찍는다.
   자는 셋 — 가닥 수 · 호길이 중앙값(cm) · 끝높이 중앙값(두상높이 정규화).
   길이를 cm로 재는 이유는 STYLE_SPECS·페이드가 이미 그 자로 적혀 있어서다
   (가드 2번 = 6.4mm). 두 도장의 cm가 다르면 ⓐ, 같으면 ⓑ다.
══════════════════════════════════════════════════════════════════ */
const ADJ_STAMP = { on: true };
function diagAdjSourceStamp(tag, adj){
  if(!ADJ_STAMP.on || !adj || !adj.length) return;
  try{
    const cm = modelCmPerUnit();
    const R = headHeightRef();
    const Ls = [], Ys = [];
    /* 표본으로 충분하다 — 중앙값이고, 전량을 훑으면 이 진단이 렌더 비용이 된다
       (8/22에 걷어낸 그 모양). 160은 solvePoolFor가 쓰는 것과 같은 표본 수다. */
    const step = Math.max(1, adj.length / SOLVE_SAMPLE);
    for(let i=0; i<adj.length; i+=step){
      const st = adj[i|0]; if(!st || !st.pts || st.pts.length < 2) continue;
      Ls.push(arcLength3D(st.pts) * (cm || 1));
      if(R) Ys.push((R.yTop - st.pts[st.pts.length-1].y) / R.H);
    }
    if(!Ls.length) return;
    Ls.sort((a,b)=>a-b); Ys.sort((a,b)=>a-b);
    const st = {
      n: adj.length,
      lenCm: +Ls[(Ls.length*0.5)|0].toFixed(2),
      lenP90: +Ls[Math.min(Ls.length-1, (Ls.length*0.9)|0)].toFixed(2),
      tipAt: Ys.length ? +Ys[(Ys.length*0.5)|0].toFixed(3) : null,
      cmOk: !!cm, at: Date.now(),
    };
    const prev = (state._adjStamp || (state._adjStamp = {}))[tag];
    state._adjStamp[tag] = st;
    /* 값이 안 바뀌었으면 콘솔엔 안 찍는다(패널은 늘 최신을 읽는다). */
    if(prev && prev.n === st.n && prev.lenCm === st.lenCm && prev.tipAt === st.tipAt) return;
    console.log('[화면대조·' + tag + '] ' + st.n + '가닥 · 호길이 중앙 ' + st.lenCm + 'cm'
      + '(p90 ' + st.lenP90 + ') · 끝높이 중앙 ' + (st.tipAt == null ? '—' : st.tipAt)
      + (cm ? '' : '  ⚠ cm자 없음 — 페이드가 통째로 안 걸린다(fadeCutLen 첫 반려)'));
  }catch(e){}
}
/* 패널 줄 — 두 도장을 나란히 놓고 <b>판정까지</b> 적는다. 숫자만 찍어 두면
   폰에서 그걸 다시 읽어 판단해야 하고, 그 왕복이 이 파일이 겪은 낭비다. */
function adjStampPanelLines(){
  const S = state._adjStamp || {};
  const A = S['2D투영'], B = S['미니3D'], C = S['3D화면'];
  const out = ['[화면대조] 2D 캔버스 vs 미니3D — <b>같은 프레임</b>의 같은 배열인가'];
  const fmt = (s)=> s ? (s.n + '가닥 · ' + s.lenCm + 'cm(p90 ' + s.lenP90 + ') · 끝높이 '
                         + (s.tipAt == null ? '—' : s.tipAt)) : '(아직 안 그림)';
  out.push('  2D투영 ' + fmt(A));
  out.push('  미니3D ' + fmt(B) + (B ? '' : '  ← 3D 미리보기를 켜면 찍힙니다'));
  if(C) out.push('  3D화면 ' + fmt(C) + '  (참고 — 다른 화면이라 시점이 다를 수 있음)');
  if(A && B){
    const d = Math.abs(A.lenCm - B.lenCm);
    const rel = d / Math.max(0.01, Math.max(A.lenCm, B.lenCm));
    out.push(rel < 0.05
      ? '  → 소스는 같습니다(차 ' + d.toFixed(2) + 'cm). 원인은 <b>그리는 쪽</b>입니다 — 아래 늘어남을 보세요.'
      : '  → 소스가 다릅니다(차 ' + d.toFixed(2) + 'cm). 캐시·마네킹·상태 시점 쪽입니다.');
  } else {
    out.push('  → 조정 화면에서 <b>3D 미리보기를 ON</b>으로 두면 두 도장이 같이 찍힙니다.');
  }
  /* 세로 늘어남 — 소스가 같을 때 <b>다음에 볼 숫자</b>다. 앞머리가 미니3D에선
     눈썹, 캔버스에선 코까지 오는 그 차이를 배율 하나로 말한다. */
  const P = state._projStretch || {};
  const angs = Object.keys(P);
  if(angs.length){
    out.push('  [투영 늘어남] 1.00 = 정직 · 1.15 넘으면 세로가 늘어난 것');
    for(const a of angs){
      const p = P[a];
      out.push('   ' + a.padEnd(5) + ' ' + p.stretch.toFixed(2) + '배'
        + ' (화면 가닥 ' + p.pxMed + 'px ÷ 두상폭 ' + p.spanX + 'px, 모델비 ' + p.modelRatio + ')'
        + (p.stretch > 1.15 ? '  ⚠' : ''));
    }
  }
  if(A && !A.cmOk) out.push('  ⚠ cm자가 없습니다(modelCmPerUnit null) — 페이드가 통째로 안 걸립니다.');
  out.push('  [2D 조정엔진] ' + (CUT2D_ENGINE.on ? '<b>켜짐</b>(조정기가 두 벌)' : '꺼짐 — 조정은 3D 한 벌')
    + ' · 투영실패 폴백 ' + PROJ_FALLBACK.n + '회'
    + (PROJ_FALLBACK.n ? ' (마지막 ' + PROJ_FALLBACK.lastAngle + ') ⚠ 여기선 조정이 안 걸립니다' : ' — 손실 없음'));
  out.push('  [겹 정렬] ' + (DEPTH_SORT.byRoot ? '뿌리 깊이 — 길이를 바꿔도 순서가 안 튑니다' : '평균 깊이(예전)'));
  /* [얼굴선] — 앞머리 라인이 <b>무엇을 기준으로</b> 서 있는가 (2026-09-03).
     'ellipsoid'로 뜨면 화면이 좋아 보여도 그건 실측이 아니라 타원면이다.
     측면 사진이 덜 돌아가면 그렇게 되므로, 못 가리면 안 되는 값이라 찍는다. */
  try{
    const _fp = getFaceProfile();
    if(!FACE_PROFILE.on) out.push('  [얼굴선] 꺼짐 — 예전(두상 중심 z=0 · 헐 반너비)');
    else if(!_fp) out.push('  [얼굴선] ⚠ 못 만듦 — 예전(두상 중심 z=0 · 헐 반너비)로 떨어짐');
    else {
      let _eA = 0; try{ _eA = getHeadEllipsoid().a; }catch(e){}
      out.push('  [얼굴선] ' + (_fp.src === 'side' ? '<b>측면 실측</b>' : '⚠ 타원면 폴백(측면 각도 부족)')
        + ' · 정중선 ' + FACE_PROFILE.n + '점'
        + ' · 코높이 z=' + _fp.zAt(0.15 - 0.28).toFixed(3)
        + ' · 눈높이 z=' + _fp.zAt(0.15).toFixed(3)
        + ' · 폭 ' + _fp.halfX.toFixed(3) + (_eA > 0 ? '(헐 ' + (_eA*MQ_FRINGE.lineHalfX).toFixed(3) + ')' : ''));
    }
  }catch(e){}
  /* ── (2026-09-02) 이 빌드가 켠 두 스위치를 <b>도장으로 찍는다</b> ─────────
     한 빌드에 둘을 같이 넣었으므로(사용자 지시), 화면만 보고는 어느 게 무엇을
     바꿨는지 못 가린다. 다행히 <b>보는 숫자가 서로 다르다</b> — 아래 두 줄이
     각각 무엇을 봐야 하는지까지 같이 적는다. 4차에 "화면 라벨은 상태가 아니다"를
     겪었으므로 라벨이 아니라 <b>실제 스위치 값</b>을 읽어 찍는다. */
  out.push('  [커트·도달불가] ' + (CUT3D.tipUnreachableCut ? '<b>켜짐</b>' : '꺼짐(예전)')
    + ' → 볼 곳: 위 [화면대조]의 <b>p90</b>. 길이를 내릴 때 p90이 같이 내려오면 먹은 것');
  out.push('  [사진 한 표] ' + (VIEW_CULL.photoOverrides ? '켜짐(예전)' : '<b>꺼짐</b>')
    + ' → 볼 곳: 아래 <b>가림 트리밍 %</b>. 측면에서 이 %가 오르고 반대편 얼굴이 드러나면 먹은 것');
  out.push('  ⓘ 뿌리가 헤어라인이 아니라 이마에 찍히는지는 아래 <b>뿌리선 어긋남</b>을 보세요.');
  return out;
}
const ADJUST_ZOOM = { on: true, pad: 0.28, max: 3.5 };
// 헤어 마스크가 차지하는 정규화 박스(0~1). 확대 기준.
function hairBoxOf(maskInf){
  const mw = maskInf.w, mh = maskInf.h;
  const scalpY = maskInf.scalpY, hairEndY = maskInf.hairEndY;
  if(!scalpY || !mw || !mh) return null;
  let x0=mw, x1=-1, y0=mh, y1=-1;
  for(let x=0;x<mw;x++){
    const sy = scalpY[x];
    if(!(sy >= 0)) continue;
    if(x<x0) x0=x; if(x>x1) x1=x;
    if(sy<y0) y0=sy;
    const ey = (hairEndY && hairEndY[x] >= 0) ? hairEndY[x] : sy;
    if(ey>y1) y1=ey;
  }
  if(x1 < 0 || y1 < 0) return null;
  return { x0:x0/mw, x1:(x1+1)/mw, y0:y0/mh, y1:(y1+1)/mh };
}
// fit을 머리 중심으로 확대한 새 fit. 확대할 이유가 없으면 원본을 그대로 돌려준다.
/* ── 조정 화면 확대/이동 (2026-08-08) ────────────────────────────────
   사용자: "3번 같은 결과화면은 확대/축소가 돼서 확인이 가능한데, 1번 같은
   화면은 고정화면이라 두상에 맞게 들어오지 않으면 확인이 안 돼."
   맞다. 자동 프레이밍(zoomFitToHair)은 <b>헤어 박스</b>에 맞추는데, 긴 머리면
   박스가 어깨까지 늘어나 정작 보고 싶은 정수리가 우표만 해진다. 결과 화면은
   RESULT_VIEW로 손잡이를 이미 갖고 있었는데 조정 화면만 없었다.
   ※ fit이 "배율 + 평행이동"이라 여기 한 곳에서 dw/dh/dx/dy만 다시 쓰면
     마스크 clip·가닥 투영·이식이 전부 fit을 통하므로 자동으로 따라온다
     (ADJUST_ZOOM이 그렇게 동작한 것과 같은 이유).
   ※ 재구성(3D)에는 전혀 관여하지 않는다 — 순수 표시 배율. */
const ADJUST_VIEW = { zoom: 1, panX: 0, panY: 0, min: 0.4, max: 10 };
function adjustViewReset(){ ADJUST_VIEW.zoom = 1; ADJUST_VIEW.panX = 0; ADJUST_VIEW.panY = 0; syncAdjustZoomUI(); renderAdjustFrame(); }
/* 커서(px,py) 아래의 그림이 <b>제자리에 있도록</b> 확대한다.
   표시식이  p = c + (q − c)·z + pan  (q=원래 자리, c=캔버스 중심)이므로
   같은 q가 그대로 있으려면  pan1 = p − c − (p − c − pan0)·(z1/z0). */
function adjustViewZoomAt(next, px, py, w, h){
  const V = ADJUST_VIEW;
  const z0 = V.zoom, z1 = Math.max(V.min, Math.min(V.max, next));
  if(Math.abs(z1 - z0) < 1e-4) return;
  const cx = w/2, cy = h/2, r = z1/z0;
  if(px == null){ px = cx; py = cy; }
  V.panX = (px - cx) - ((px - cx) - V.panX) * r;
  V.panY = (py - cy) - ((py - cy) - V.panY) * r;
  V.zoom = z1;
  syncAdjustZoomUI();
}
function applyAdjustView(fit, w, h){
  const V = ADJUST_VIEW;
  if(V.zoom === 1 && !V.panX && !V.panY) return fit;
  const cx = w/2, cy = h/2, z = V.zoom;
  return { ...fit,
    dw: fit.dw * z, dh: fit.dh * z,
    dx: cx + (fit.dx - cx) * z + V.panX,
    dy: cy + (fit.dy - cy) * z + V.panY,
    _userZoom: z };
}

function zoomFitToHair(fit, maskInf, w, h){
  if(!ADJUST_ZOOM.on) return applyAdjustView(fit, w, h);
  const box = hairBoxOf(maskInf);
  if(!box) return applyAdjustView(fit, w, h);
  const bw = (box.x1 - box.x0) * (1 + ADJUST_ZOOM.pad);
  const bh = (box.y1 - box.y0) * (1 + ADJUST_ZOOM.pad);
  if(!(bw > 0) || !(bh > 0)) return applyAdjustView(fit, w, h);
  // 확대해도 머리가 캔버스 밖으로 안 나가는 최대 배율
  const k = Math.min(w / (bw * fit.dw), h / (bh * fit.dh), ADJUST_ZOOM.max);
  if(!(k > 1.02)) return applyAdjustView(fit, w, h);   // 이미 꽉 차 있으면 그대로
  const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2;
  return applyAdjustView({ dw: fit.dw * k, dh: fit.dh * k,
           dx: w/2 - (cx * fit.dw * k), dy: h/2 - (cy * fit.dh * k), _zoom: k }, w, h);
}

/* 조정 화면 제스처 — 휠·드래그·핀치. 결과 화면(bindResultViewGestures)과 같은 규칙.
   캔버스 백킹스토어가 1200px 고정이고 화면 표시 크기는 다르므로, 마우스 좌표를
   <b>백킹 픽셀로 환산</b>해서 넘긴다(안 하면 확대 기준점이 어긋난다). */
function bindAdjustViewGestures(){
  const canvas = document.getElementById('adjustCanvas');
  if(!canvas || canvas._adjBound) return;
  canvas._adjBound = true;
  const toCanvas = (e)=>{
    const r = canvas.getBoundingClientRect();
    return { x:(e.clientX - r.left) * (canvas.width /(r.width ||1)),
             y:(e.clientY - r.top ) * (canvas.height/(r.height||1)),
             sx: canvas.width/(r.width||1), sy: canvas.height/(r.height||1) };
  };
  canvas.addEventListener('wheel', (e)=>{
    e.preventDefault();
    const p = toCanvas(e);
    adjustViewZoomAt(ADJUST_VIEW.zoom * Math.exp(-e.deltaY * 0.0016), p.x, p.y, canvas.width, canvas.height);
    renderAdjustFrame();
  }, { passive:false });
  /* (2026-08-30) 화면 터치로 빗질하던 경로를 <b>뺐다</b> — 사용자 지시
     "이 파일에서 화면터치해서 comb 사용하는 기능 지워줘".
     한 손가락 드래그는 이제 <b>언제나 화면 이동</b>이다(COMB.on 여부와 무관).
     Shift+드래그 예외도 같이 사라진다 — 빗질이 없으니 구분할 게 없다.
     엔진(combSplat·combStrand3D·combRebake…)과 슬라이더 패널의 빗질 버튼은
     한 줄도 안 건드렸다. 획을 만드는 입력만 없어졌으므로 COMB.strokes가
     빌 뿐이고, 이미 쌓인 획이 있으면 렌더는 그대로 반영한다. */
  let drag = null, pinch = null;
  const pts = new Map();
  canvas.addEventListener('pointerdown', (e)=>{
    canvas.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, e);
    if(pts.size === 1){
      const p = toCanvas(e);
      drag = { x:p.x, y:p.y };
    }
    else if(pts.size === 2){ drag = null; pinch = pinchStateOf(pts, toCanvas); }
  });
  canvas.addEventListener('pointermove', (e)=>{
    if(!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, e);
    if(pts.size === 2 && pinch){
      const now = pinchStateOf(pts, toCanvas);
      if(now.d > 1 && pinch.d > 1){
        adjustViewZoomAt(ADJUST_VIEW.zoom * (now.d / pinch.d), now.cx, now.cy, canvas.width, canvas.height);
        ADJUST_VIEW.panX += now.cx - pinch.cx; ADJUST_VIEW.panY += now.cy - pinch.cy;
        renderAdjustFrame();
      }
      pinch = now; return;
    }
    if(!drag) return;
    const p = toCanvas(e);
    ADJUST_VIEW.panX += p.x - drag.x; ADJUST_VIEW.panY += p.y - drag.y;
    drag = { x:p.x, y:p.y };
    renderAdjustFrame();
  });
  const up = (e)=>{ pts.delete(e.pointerId); if(pts.size < 2) pinch = null;
                    if(!pts.size){ drag = null; } };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('dblclick', (e)=>{ e.preventDefault(); adjustViewReset(); });
}
function twoPtDist(map){
  const [a,b] = [...map.values()];
  return Math.hypot(a.clientX-b.clientX, a.clientY-b.clientY);
}
function pinchStateOf(pts, toCanvas){
  const [a,b] = [...pts.values()];
  const pa = toCanvas(a), pb = toCanvas(b);
  return { d: Math.hypot(pa.x-pb.x, pa.y-pb.y), cx:(pa.x+pb.x)/2, cy:(pa.y+pb.y)/2 };
}
function syncAdjustZoomUI(){
  const el = document.getElementById('adjustZoomPct');
  if(el) el.textContent = Math.round(ADJUST_VIEW.zoom * 100) + '%';
}
function adjustViewStep(mul){
  const c = document.getElementById('adjustCanvas');
  adjustViewZoomAt(ADJUST_VIEW.zoom * mul, null, null, c ? c.width : INPUT_RES.drawRes, c ? c.height : Math.round(INPUT_RES.drawRes*4/3));
  renderAdjustFrame();
}

// 2D 렌더 캔버스의 devicePixelRatio 배율(2026-07-14 추가).
// (2026-07-16 변경) 그리기 해상도를 기기 dpr에 따라 흔들리게 두지 않고
// 가로 1200px 고정으로 통일 — 사용자 결정: "입력 해상도랑 그리기 해상도
// 다 1200으로". 분석 입력 해상도(extractHairMask maxDim=1200)와 동일 값이라
// 읽기·그리기 해상도가 어떤 기기에서든 항상 1:1로 일치함.
// (이전엔 rect.width×dpr(상한 3)이라 데스크톱(dpr1)에선 CSS 폭 그대로,
// 폰(dpr3)에서만 ~1200이 되는 기기 의존 동작이었음.)
// 실기기에서 무거우면 DRAW_RES와 maxDim을 800으로 함께 내리는 것이 폴백.
/* ══════════════════════════════════════════════════════════════════
   해상도는 <b>한 곳</b>에서 정한다 (2026-08-23 6차)
   ─────────────────────────────────────────────────────────────────
   2026-07-14에 이미 적어 둔 폴백을 실행한다:
     "읽는 해상도하고 그리는 해상도 둘 다 맞춰서 1200 가보고,
      <b>무거우면 둘 다 800으로 줄이면 되지</b>"
   그때 1200으로 올렸고, 카메라 사진(1200×1600) 실측에서 <b>375~379MB</b>가 나와
   녹화를 시작하지도 못했다. 예고된 폴백을 쓸 때다.

   ── 그런데 그때 계획에 <b>빠진 게 하나</b> 있었다 ────────────────────────
   maxDim은 <b>분석 버퍼</b>에만 걸리고, hairC·baseC는 사진 원본 크기로 만들어진다
   (buildHairViewCanvases). 그래서 둘을 800으로 내려도 사진이 1200×1600이면
   보관은 그대로다. 진짜 마개는 <b>사진이 들어오는 자리</b>다 — 그래서 photoMax를
   신설하고 촬영·업로드 두 입구에서 건다. 사진이 800 이하가 되면 maxDim은
   자동으로 무동작이 되고, hairC·baseC도 따라 작아진다.

   ── 왜 800이면 되는가 ──────────────────────────────────────────────
   사용자: "우리 화면이 큰 게 아니라서 800으로 해."
   폰 화면 1080 물리px, 조정 캔버스 CSS 폭 ≈383(dpr 2.75 → 물리 ≈1053).
   800은 물리 해상도의 0.76배다 — 1:1보다 살짝 부족하지만, 이 화면에서
   가닥 굵기가 0.9px 하한에 걸려 있는 걸 생각하면 체감 차가 작다.
   대신 픽셀 수가 <b>1/2.25</b>(1200²→800²)이고, 사진은 1200×1600→600×800으로
   <b>1/4</b>다. 보관·사진·버퍼가 전부 그 배율로 줄어든다.

   ⚠ 셋은 <b>반드시 같이</b> 움직인다. 사진만 줄이고 drawRes를 두면 사진 레이어가
     확대되어 뿌예지고, 반대면 없는 정보를 더 큰 캔버스에 늘려 그리는 낭비다.
   되돌리기: 세 값을 1200으로 (그게 8/23 이전 동작이다) */
const INPUT_RES = {
  photoMax: 800,   // 촬영·업로드 사진의 <b>긴 변</b> 상한(px). 여기가 진짜 마개다
  maxDim:   800,   // 분석(세그멘테이션·마스크) 해상도의 긴 변
  drawRes:  800,   // 2D 렌더 캔버스 목표 가로 해상도
};
const DRAW_RES = INPUT_RES.drawRes; // 2D 렌더 캔버스 목표 가로 해상도(px) — 분석 maxDim과 반드시 함께 움직일 것

/* ── 사진 한 장을 상한 안으로 (2026-08-23 6차) ────────────────────────
   캔버스를 받아 긴 변이 photoMax를 넘으면 <b>제자리에서</b> 줄인 새 캔버스를
   준다. 넘지 않으면 원본을 그대로 돌려준다(불필요한 재인코딩 없음).
   ※ 촬영 경로는 이 캔버스를 _lastShotCanvas로도 보관한다 — 고품질 재인코딩
     재시도(0.99)가 <b>줄인 뒤</b>의 픽셀을 쓰게 되는데, 그게 맞다. 저장본과
     재시도본이 같은 해상도라야 "압축 손실이 원인이었나"를 가릴 수 있다. */
function capShotCanvas(src){
  const M = INPUT_RES.photoMax;
  if(!src || !src.width || !src.height) return src;
  const long = Math.max(src.width, src.height);
  if(!(M > 0) || long <= M) return src;
  const k = M / long;
  const c = document.createElement('canvas');
  c.width  = Math.max(1, Math.round(src.width  * k));
  c.height = Math.max(1, Math.round(src.height * k));
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = true;
  try{ x.imageSmoothingQuality = 'high'; }catch(e){}
  x.drawImage(src, 0, 0, c.width, c.height);
  return c;
}
/* 업로드는 dataURL로 들어온다 — 디코드해서 줄이고 다시 인코딩한다.
   상한 안이면 <b>원본 문자열 그대로</b> 돌려준다(재인코딩은 손실이다).
   품질 0.94는 촬영 경로와 같은 값이다(랜드마크 감지가 압축에 민감하다는
   2026-07-26 4차 기록 참고). */
function capShotDataURL(dataUrl){
  return new Promise(resolve=>{
    if(!dataUrl || !(INPUT_RES.photoMax > 0)) return resolve(dataUrl);
    const img = new Image();
    img.onload = ()=>{
      try{
        if(Math.max(img.naturalWidth, img.naturalHeight) <= INPUT_RES.photoMax) return resolve(dataUrl);
        const tmp = document.createElement('canvas');
        tmp.width = img.naturalWidth; tmp.height = img.naturalHeight;
        tmp.getContext('2d').drawImage(img, 0, 0);
        const out = capShotCanvas(tmp);
        tmp.width = 0; tmp.height = 0;               // 원본 크기 임시본은 바로 반납
        resolve(out.toDataURL('image/jpeg', 0.94));
      }catch(e){ console.warn('업로드 사진 축소 실패(원본 사용):', e); resolve(dataUrl); }
    };
    img.onerror = ()=> resolve(dataUrl);
    img.src = dataUrl;
  });
}

function syncCanvasSize(canvas){
  const rect=canvas.getBoundingClientRect();
  // 백킹스토어를 CSS 크기와 무관하게 가로 DRAW_RES(1200px) 고정, 세로는
  // 표시 종횡비 유지. 좌표·fit·resScale이 전부 canvas.width 기준이라
  // 자동으로 따라오고, 표시 크기는 CSS가 고정하므로 레이아웃 불변.
  if(rect.width>0&&rect.height>0){
    const w = DRAW_RES, h = Math.round(rect.height*(DRAW_RES/rect.width));
    /* ── 같은 크기면 <b>대입하지 않는다</b> (2026-08-23) ─────────────────────
       canvas.width는 값이 같아도 대입하는 순간 백킹스토어를 새로 잡고 화면을
       지운다(HTML 규약: 속성 설정 = 캔버스 리셋). 이 함수는 renderFrame 첫
       줄이라 <b>프레임마다</b> 1200×1459짜리 7MB 백킹스토어를 버리고 새로
       잡고 있었다 — scratchCanvas가 풀에서 피하려던 바로 그 비용을, 정작
       제일 자주 그리는 <b>본 캔버스</b>가 매번 물고 있었던 셈이다.
       ⚠ 크기가 같아도 예전엔 캔버스가 <b>지워진</b> 채로 시작했다. 그러니
         건너뛸 때는 손으로 지워 줘야 예전과 그림이 같다 — 이 clearRect가
         그 짝이다(빼면 이전 프레임 위에 덧그려진다).
       되돌리기: MOBILE_PERF.sizeSkipSame = false */
    if(MOBILE_PERF.sizeSkipSame && canvas.width === w && canvas.height === h){
      try{
        const x = canvas.getContext('2d');
        x.setTransform(1,0,0,1,0,0);
        x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
        try{ x.filter = 'none'; }catch(e){}
        x.clearRect(0, 0, w, h);
      }catch(e){ canvas.width = w; canvas.height = h; }   // 못 지우면 예전 동작
      return;
    }
    canvas.width = w;
    canvas.height = h;
  }
}

// 핵심 렌더 함수
// 마스크 디버그 버튼 상태 동기화 (toggleMaskDebug/toggleRawDebug 양쪽에서 공용으로 사용)
function syncMaskDebugBtn(){
  const btn = document.getElementById('maskDebugToggle');
  if(btn){
    btn.classList.toggle('on', state.debugShowMask);
    btn.textContent = state.debugShowMask ? '마스크 보기' : '가닥 보기';
  }
}
// 마스크 디버그 토글: hairMaskBuf 실루엣을 색으로 채워서 그대로 보여줌(가닥 렌더링 대신)
// — 세그멘테이션이 실제로 어디를 "머리카락"으로 잡았는지(과잉/누락) 눈으로 바로 확인하기 위함
/* ── 디버그 뷰 토글 3종 (2026-08-02 통합) ──────────────────────────
   마스크/원본 결/결 필드 세 뷰는 서로 배타적이다. "하나 켜면 나머지 둘 끄기"와
   "버튼 세 개의 on 표시 맞추기"를 토글 셋이 각자 적어두고 있었다 — 한 곳만
   고치면 어긋나는 종류의 중복이라 규칙을 여기 한 곳에 둔다.
   ※ 버튼 <b>글자</b>는 각 토글이 하던 그대로 남긴다. 예컨대 마스크를 켜서 원본
     결이 꺼질 때 예전에도 그 버튼 글자는 안 바꿨는데, 여기서 같이 바꿔버리면
     화면 표시가 달라진다(동작 무변경이 우선). */
function setDebugView(which){   // 'mask' | 'raw' | 'field' | null(전부 끔)
  state.debugShowMask  = (which === 'mask');
  state.debugShowRaw   = (which === 'raw');
  state.debugShowField = (which === 'field');
  syncMaskDebugBtn();
  const rawBtn = document.getElementById('rawDebugToggle');
  if(rawBtn) rawBtn.classList.toggle('on', state.debugShowRaw);
  const fieldBtn = document.getElementById('fieldDebugToggle');
  if(fieldBtn) fieldBtn.classList.toggle('on', state.debugShowField);
}
function toggleMaskDebug(){
  setDebugView(state.debugShowMask ? null : 'mask');
  renderAdjustFrame();
}

// 원본 결 보기 토글: 스타일/슬라이더 값을 무시하고 전 섹션을 중립값
// (길이 50=원본 인식 길이 그대로, 볼륨 50, 컬 0)으로 렌더링해서
// "스타일 적용 전, 결방향 인식 자체가 얼마나 자연스러운지"만 순수하게 확인하기 위함.
// 실제 state.sections/selectedStyle은 건드리지 않고 화면 표시만 임시로 바꿈.
function toggleRawDebug(){
  setDebugView(state.debugShowRaw ? null : 'raw');
  const btn = document.getElementById('rawDebugToggle');
  if(btn) btn.textContent = state.debugShowRaw ? '스타일 보기' : '원본 결 보기';
  const tag = document.getElementById('adjustStyleTag');
  if(tag){
    tag.textContent = state.debugShowRaw
      ? '원본 결 (스타일 미적용)'
      : (state.selectedStyle ? state.selectedStyle.name : '스타일 미선택');
  }
  renderAdjustFrame();
}

/* 픽셀 이식 (2026-07-27) — 가닥을 <b>그리는</b> 대신 원본 사진의 헤어 픽셀을
   결 방향에 맞춰 회전시켜 <b>찍는다</b>.
   (2026-08-01) 토글 버튼(#quiltDebugToggle)과 toggleQuiltDebug()를 제거하고
   state.hairQuilt = true를 기본값으로 승격했다. 이제 이 경로가 본선이며,
   실패 조건(캘리브레이션·결필드·원본 헤어 이미지 없음 등)에서는
   projectHair3DToView → drawHairStrands 순으로 자동 폴백한다. 사유는
   quiltFail()이 콘솔에 남긴다.
   (2026-08-02 8차) <b>기본값을 false로 되돌렸다</b>. 본선은 다시 가닥 렌더
   (projectHair3DToView)다 — 그쪽이 원본 결 보기와 같은 가닥 규칙
   (HAIR_STRAND_LOOK)을 읽으므로, "두 화면의 가닥을 통일"이라는 요구를
   만족하는 유일한 경로다. 이식 코드·상수는 그대로 두었으니 실험할 때는
   콘솔에서 state.hairQuilt = true 후 화면을 다시 그리면 된다. */

// 결필드 원본 디버그 토글: strand 시뮬레이션(뿌리 위치·중력·clamp 등) 전혀 거치지 않고
// computeHairOrientationField가 실제로 뽑아낸 angle/coherence 컬럼 샘플을 가공 없이
// 그대로 화면에 짧은 선분으로 표시 — 결이 마스크 중간·아래쪽에서 실제로 얼마나
// 촘촘하고 신뢰할 만한지(coherence), 낮은 coherence 구간은 실제로 어떻게 나오는지를
// strand 렌더링 로직(scalpY 시작 제약, 중력 대체 등)과 분리해서 눈으로 검증하기 위함.
function toggleFieldDebug(){
  setDebugView(state.debugShowField ? null : 'field');
  renderAdjustFrame();

// 진단정보: PC 콘솔(F12) 없이도 폰 화면 스크린샷 하나로 원인 파악할 수 있게
// 핵심 상태값을 화면에 텍스트로 그대로 찍어줌. 여기서 확인할 것:
// (1) faceLandmarkerReady가 false면 refineSectionBoundaries가 아예 안 돌고
//     있다는 뜻(정적 기본 경계만 씀) — 그게 "왜 안 바뀌나"의 원인일 수 있음.
// (2) 뷰 바꿔가며 눌러보면 currentViewAngle과 crown.yRange[1](두정선 y)이
//     실제로 그 뷰마다 다른 값으로 바뀌는지 바로 보임 — 안 바뀌면 그게 버그.
// (3) 이마 중앙(0.5, 0.30)과 귀 옆(0.1, 0.45) 두 지점을 resolveSectionId로
//     테스트해서 각각 다른 섹션으로 나오는지 확인.
}
function toggleDiagInfo(){
  const box = document.getElementById('diagInfoBox');
  if(!box) return;
  const show = box.style.display === 'none';
  box.style.display = show ? 'block' : 'none';
  if(!show) return;
  const angle = state.currentViewAngle;
  const lm = state.landmarks && state.landmarks[angle];
  // renderFrame과 동일하게 지금 보고 있는 뷰 기준으로 다시 계산 — 이 진단창에
  // 보이는 값이 실제 렌더링에 쓰이는 값과 항상 일치하게 함(스테일 값 방지).
  if(typeof faceLandmarkerReady !== 'undefined' && faceLandmarkerReady && lm){
    refineSectionBoundaries(angle);
  }
  let lines = [];
  /* [성능·메모리]를 <b>맨 위로</b> (2026-08-22) — 이 상자는 max-height 200px에
     overflow:auto다. 아래에 붙여 놨더니 폰에서 스크롤을 한참 내려야 나와서
     정작 필요한 순간(화면이 백지가 된 직후)에 못 찍었다. 지금 급한 값이
     맨 위에 있어야 스크린샷 한 장으로 끝난다. */
  lines.push(perfPanelLines().join('\n'));
  /* (2026-08-25) 성능 <b>바로 밑</b>에 스펙·포즈. 이 상자는 max-height 200px
     스크롤이라 아래에 붙이면 스크린샷 한 장에 안 들어온다 — 8/22에 성능 줄을
     맨 위로 올린 것과 같은 이유다. 둘 다 새로 재지 않고 지난 계산을 읽기만 한다. */
  lines.push('');
  /* (2026-08-29) 조각 한 줄 — 폰에는 콘솔이 없다. pieceHarness()를 콘솔에서만
     부를 수 있으면 8/25에 [스타일스펙]이 당한 것과 같은 일이 된다(208초 녹화에
     숫자가 한 줄도 안 남음). 그래서 <b>패널에</b> 올린다. 새로 재지 않는다 —
     목록 길이·서명·지난 패스의 모임 최저값을 읽기만 한다. */
  lines.push(piecePanelLines().join('\n'));
  lines.push('');
  /* (2026-09-01 3차) 화면대조를 <b>맨 위</b>에 둔다 — 지금 붙잡고 있는 문제라
     스크롤 없이 바로 보여야 한다. 판정이 끝나면 아래로 내리거나 뺄 줄이다. */
  lines.push(adjStampPanelLines().join('\n'));
  lines.push('');
  lines.push(specPanelLines().join('\n'));
  lines.push('');
  lines.push(posePanelLines().join('\n'));
  lines.push('');
  lines.push('angle: ' + angle);
  lines.push('faceLandmarkerReady: ' + (typeof faceLandmarkerReady!=='undefined' ? faceLandmarkerReady : '(변수없음)'));
  lines.push('landmarks[' + angle + '] 존재: ' + (!!lm));
  if(lm){
    lines.push('  earY=' + lm.earY + ' foreheadY=' + lm.foreheadY + ' chinY=' + lm.chinY);
  }
  lines.push('');
  lines.push('SECTIONS 현재 경계(angle=' + angle + ' 기준):');
  SECTION_ORDER.forEach(id=>{
    const s = SECTIONS[id];
    lines.push('  ' + id + ': y[' + s.yRange.map(v=>v.toFixed(3)).join(',') + '] x[' + s.xRange.map(v=>v.toFixed(3)).join(',') + ']');
  });
  lines.push('');
  lines.push('resolveSectionId 테스트:');
  lines.push('  이마중앙(0.50,0.30) -> ' + resolveSectionId(angle, 0.50, 0.30));
  lines.push('  귀옆(0.10,0.45) -> ' + resolveSectionId(angle, 0.10, 0.45));
  lines.push('  정수리(0.50,0.10) -> ' + resolveSectionId(angle, 0.50, 0.10));
  lines.push('  목선(0.50,0.90) -> ' + resolveSectionId(angle, 0.50, 0.90));

  /* ── 렌더/결 진단 (2026-07-26) ────────────────────────────────────
     노트북 작업이라 콘솔을 열어 복사하기 번거롭다는 피드백. 원인 판정에 꼭
     필요한 세 가지를 화면에 찍어 스크린샷 하나로 끝나게 한다:
       ① 겹 끝(결불연속) 종결 비율 — 0%면 끝점을 하나도 못 잡고 있다는 뜻
          (= 모든 가닥이 실루엣 바닥까지 관통 → 섹션이 안 나뉨)
       ② 결 신뢰도(coherence) 분포 — 끝점 판정의 원재료가 쓸 만한지
       ③ 다발 렌더 실측 — 화면상 머리 크기·틈·가닥 폭·솎기 */
  const dc = window._lastDisc && window._lastDisc[angle];
  lines.push('');
  lines.push('겹 끝(결불연속) 종결: ' + (dc ? `${dc.cut}/${dc.n}개 (${dc.pct}%)` + (dc.pct < 5 ? '  ← 끝점 거의 못 잡음' : '') : '(아직 없음)'));

  const mi = state.hairMasks && state.hairMasks[angle];
  if(mi && mi.orientation){
    let n=0, sum=0, hi=0, lo=0;
    for(const col of mi.orientation){
      if(!col) continue;
      for(const sm of col){ n++; sum += sm.coherence;
        if(sm.coherence > 0.3) hi++; if(sm.coherence < 0.1) lo++; }
    }
    lines.push('결 신뢰도: 표본 ' + n + '개, 평균 ' + (n?(sum/n).toFixed(3):'-')
      + ' / 0.3초과 ' + (n?Math.round(hi/n*100):0) + '% / 0.1미만 ' + (n?Math.round(lo/n*100):0) + '%');
  } else {
    lines.push('결 신뢰도: 결필드 없음');
  }

  const bd = window._lastStrandDiag && window._lastStrandDiag[angle];
  if(bd){
    lines.push('');
    lines.push('가닥 렌더(원본 결 보기와 동일 규칙):');
    lines.push('  화면상 머리폭 ' + bd.headCss + 'px (표시배율 1/' + bd.unit + ')');
    (bd.roles||[]).forEach(r=>{
      lines.push('  ' + r.id + ' 굵기 ' + r.w + 'px(화면 ' + r.wCss + ') · 비중 ' + r.n + '개');
    });
    lines.push('  가닥 ' + bd.drawn + '개 그림 / 목표 ' + bd.target + '개 (원본 결 보기 ' + bd.rawTotal + '개)');
    lines.push('  모델 ' + bd.total + '개 중 솎기 ' + bd.stride);
    /* (2026-09-04) 가림으로 <b>안 그린</b> 점의 비율. 콘솔을 못 보는 실기기에서
       "반대편 사이드가 얼굴을 덮나"를 숫자 하나로 판정하려고 올린다.
       측면 뷰에서 이 값이 10% 언저리면 두개골 뒤 반구가 통째로 살아 있다는
       뜻이다(9/02 로그의 right 뷰 9%가 정확히 그 상태였다). 실루엣 연장이
       걸리면 30~40%대로 올라온다. */
    lines.push('  가림으로 안 그린 점 <b>' + bd.hidPct + '%</b>'
      + (bd.hidPct < 15 ? '  ← 측면인데 이 값이면 뒤 반구가 안 잘리고 있음' : ''));
    if(bd.rootDev){
      const d = bd.rootDev;
      lines.push('  뿌리선 어긋남 중앙값 ' + d.med.toFixed(0) + 'px'
        + ' (10~90% ' + d.p10.toFixed(0) + '~' + d.p90.toFixed(0) + ', 마스크 높이 ' + d.h + ')');
      lines.push('  원본 두피선보다 위(바깥)에 찍힌 뿌리 ' + d.above + '/' + d.n + '개');
      if(d.med < -3) lines.push('  ← 머리가 원본보다 위에서 시작하고 있음');
    }
  }

  /* (2026-08-31) 여기는 textContent였다 — 그래서 로그 문자열의 <b>가 <b>글자 그대로</b>
     찍혔다(실기기 스크린샷: `얼굴 <b>평면 데칼</b> — 이유 미기록`). 강조하려고 붙인
     태그가 오히려 한 줄을 읽기 어렵게 만들고 있었다. 태그를 지우는 대신 살린다 —
     이 파일의 진단 문자열은 <b> 하나만 쓰고, 그건 정확히 "여기가 핵심"이라는 표시다.
     전부 이스케이프한 뒤 <b>만 되돌리므로 사진·파일명에 <>가 섞여 들어와도 안전하다. */
  box.innerHTML = lines.join('\n')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/&lt;b&gt;/g, '<b>').replace(/&lt;\/b&gt;/g, '</b>');
}

// 결필드 원본을 가공 없이 그리는 디버그 오버레이.
// maskInf.orientation은 buildColumnOrientationSamples가 만든 컬럼별 샘플
// (컬럼당 최대 12개, 마스크가 있는 y구간에 걸쳐 분포)이며 좌표계는
// maskInf.maskW × maskInf.maskH (결방향 계산 당시의 축소 해상도) 기준.
// coherence를 색상으로 매핑(빨강=낮음/신뢰 안 됨 → 초록=높음/뚜렷함)해서
// strand 시뮬레이션이 어떤 원본 데이터를 근거로 방향을 정하는지,
// 특히 낮은 coherence 구간이 실제로 어떻게 나오는지를 그대로 보여준다.
function drawOrientationFieldDebug(ctx, fit, maskInf){
  const colSamples = maskInf.orientation;
  if(!colSamples) return;
  const fw = maskInf.maskW, fh = maskInf.maskH;
  if(!fw || !fh) return;
  const toX = ix => fit.dx + (ix/fw) * fit.dw;
  const toY = iy => fit.dy + (iy/fh) * fit.dh;
  // 선분 길이: 컬럼 간격(스킵 간격 포함) 대비 살짝 겹치는 정도로 — 너무 길면
  // 이웃 컬럼끼리 뭉개지고, 너무 짧으면 방향이 안 보임.
  const colSkip = 2; // 컬럼 2개당 1개씩만 그려서 과밀 방지
  const halfLen = Math.max(2, (fit.dw / fw) * colSkip * 1.1);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1, (fit.dw / fw) * 0.9);
  for(let x=0; x<fw; x += colSkip){
    const col = colSamples[x];
    if(!col || col.length===0) continue;
    for(const s of col){
      const cx = toX(x), cy = toY(s.y);
      const dx = Math.cos(s.angle) * halfLen;
      const dy = Math.sin(s.angle) * halfLen;
      const coh = Math.max(0, Math.min(1, s.coherence));
      // coherence 낮음(0)=빨강 ~ 높음(1)=초록. 숨기지 않고 그대로 다 그림 — 낮은
      // coherence 구간이 어떻게 생겼는지 확인하는 게 이 디버그 뷰의 목적이므로
      // 알파를 coherence에 비례시켜 흐릿하게 만들지 않는다.
      ctx.strokeStyle = `hsl(${coh*120}, 90%, 55%)`;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.moveTo(cx-dx, cy-dy);
      ctx.lineTo(cx+dx, cy+dy);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// 가닥 렌더 유효 컬럼 수(두피선이 잡힌 컬럼 개수) — 세그멘테이션 성공 여부 판정용.
// renderFrame과 captureStrandPathsFor 두 곳에서 동일하게 쓰이던 계산을 통합.
function countValidCols(scalpY){
  let n = 0;
  for(let i=0;i<scalpY.length;i++){ if(scalpY[i] >= 0) n++; }
  return n;
}

// drawHairStrands에 넘길 opts 객체 생성 — renderFrame(화면)과 captureStrandPathsFor(3D 캡처)
// 두 곳에서 색상/섹션/결방향/캡처 옵션 구성이 글자 그대로 중복돼 있던 것을 하나로 통합.
// rawMode(원본 결 보기)일 때만 컬·섹션·스타일링·색을 중립화. 비-raw면 두 호출부가 완전히
// 동일한 opts를 만든다(예전엔 capture가 styling을 생략하고 drawHairStrands 폴백에 의존했는데,
// 그 폴백값이 state.styling이라 결과가 같음 → 여기서 명시적으로 넘겨도 동작 동일).
function buildStrandOpts(maskInf, angle, rawMode){
  const { curl, volume, thickness } = rawMode
    ? { curl:0, volume:50, thickness:50 }
    : state.sliders[angle];
  const sections = rawMode
    // length뿐 아니라 line/layer도 중립값으로 덮어씀 — front.line/nape.line/side.layer 효과가
    // "원본 결 보기"(모든 스타일링 무력화가 목적)에 새어 들어가지 않도록. blend는 렌더링에
    // 직접 관여하지 않는 파라미터(propagateSectionChange 전용)라 안 건드려도 무방.
    // gyeol 신규 파라미터도 중립화: technique=uniform(층 분포 없음), curl0(스트레이트),
    // texture0(끝단 트림 없음). color는 raw 모드에서 무시(avgColor 사용)되도록 null.
    // (5차) 길이 중립값 변경: 배율 기준점이 "섹션 기본값=원본"으로 바뀌어서(lengthRatioFor
    // 참고), 원본 결 보기의 중립 길이도 50 고정이 아니라 각 섹션의 기본값이어야 ratio=1.
    ? Object.fromEntries(Object.entries(state.sections).map(([id,s])=>[id, {...s,
        length: (SECTIONS[id] && SECTIONS[id].defaults && typeof SECTIONS[id].defaults.length==='number') ? SECTIONS[id].defaults.length : 50,
        line:50, layer:0, technique:'uniform', curl:0, texture:0, color:null}]))
    : state.sections;
  return {
    curl, volume, thickness,
    // gyeol 스타일링(전역 마무리) — 원본 결 보기에서는 중립으로 넘김.
    styling: rawMode ? neutralStyling() : state.styling,
    angle, sections, // 컬럼별로 섹션을 판정해 길이를 다르게 적용하기 위함
    color: rawMode ? maskInf.avgColor : ((state.selectedStyle ? state.selectedStyle.colorHex : null) || maskInf.avgColor),
    // 섹션별 색상: 염색 스타일(state.selectedStyle)이 선택돼 있으면 그 염색 색을 두상 전체에
    // 균일하게 써야 하므로 섹션별 변화를 끔 — 스타일 미적용(프리셋 없이 실측 그대로)일 때만
    // 부위별로 실제 인식된 색을 각각 사용.
    avgColorsBySection: (!state.selectedStyle) ? maskInf.avgColorsBySection : null,
    colorPalette: (!state.selectedStyle) ? maskInf.colorPalette : null, // 원본 모드에서만 실측 색 분포 사용
    // (6차) 가닥 추종 언더코트용 두피색 — renderFrame의 통짜 실루엣 칠 제거 후
    // drawHairStrands가 가닥 경로 밑바탕에 사용(실패 시 표준 피부톤 폴백은 수신측).
    scalpColor: maskInf.scalpColor || null,
    orientation: maskInf.orientation,       // 결방향 컬럼 샘플 (축소해상도 좌표)
    orientMaskW: maskInf.maskW,              // 결방향 필드가 계산된 축소 해상도 폭
    orientMaskH: maskInf.maskH,              // 결방향 필드가 계산된 축소 해상도 높이
    /* 가닥마다 자기 경로 위의 원본 픽셀색을 읽기 위한 참조(HAIR_PIXEL_COLOR).
       maskInf 통째로 넘기는 이유 — photoRGB·maskW·maskH가 항상 같이 다녀야
       좌표계가 어긋나지 않는다(따로 넘기면 한쪽만 바뀌는 사고가 난다). */
    maskInf,
    capturePaths: true, // 완성된 가닥 경로를 저장 → 3D가 이 경로를 그대로 들어올림
  };
}

/* (2026-08-02) opts 추가 — 결과 화면(SCREEN 4)이 같은 렌더 경로를 그대로 쓰되
   두 가지만 다르게 하기 위한 것. opts 없이 부르면 기존 동작과 완전히 동일하다.
     opts.resultFit : 머리 중심 확대(zoomFitToHair) 대신 결과 화면용 프레이밍을
                   쓴다. 두상을 오려낼 것이라 머리·목이 프레임 안에 온전히
                   들어와야 하는데, zoomFitToHair는 확대만 하고 축소는 안 한다.
     opts.onDone : 그리기가 끝난 뒤 { fit, hairLayer }를 넘겨준다. fit은 오려낸
                   두상을 3D 몸과 같은 자 위에 놓는 데, hairLayer(헤어만 있는
                   투명 레이어, 2026-08-01 도입)는 의상 위에 헤어를 다시 얹는 데
                   쓴다 — 어깨로 내려온 머리가 옷에 덮이지 않게. */
function renderFrame(canvas, angle, opts){
  // ── 버그 수정(2026-07-13): SECTIONS 경계 미스매치 ──
  // refineSectionBoundaries(angle)는 원래 촬영 직후 파이프라인에서 4개 뷰를
  // 순서대로 한 번씩만 돌렸는데, SECTIONS가 뷰별로 안 나뉘고 전역 공유
  //객체라서 나중 뷰가 이전 뷰의 경계값을 덮어씀 — 그 뒤로 어느 뷰 탭을
  // 보든 "마지막으로 처리된 뷰 하나" 기준 경계에 고정된 채 안 바뀌고
  // 있었음(실기기 피드백: "크라운을 만졌는데 프론트/사이드가 늘어난다" 등
  // 전 섹션·전 뷰에 걸친 증상 전부 이걸로 설명됨). 렌더할 때마다 지금
  // 보고 있는 뷰(angle) 기준으로 매번 다시 계산해서 항상 일치하게 함.
  // (landmarks[angle]이 없으면 refineSectionBoundaries 자체가 안전하게
  // no-op — 새 실패 모드 추가 아님)
  if(typeof faceLandmarkerReady !== 'undefined' && faceLandmarkerReady){
    refineSectionBoundaries(angle);
  }
  syncCanvasSize(canvas);
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  if(w===0||h===0){ setTimeout(()=>renderFrame(canvas,angle,opts),50); return; }

  // 그리기 완료 통보(opts.onDone). 어느 분기로 끝나든 정확히 한 번만 부른다.
  let doneCalled = false;
  const done = (fit, hairLayer)=>{
    if(doneCalled) return; doneCalled = true;
    if(opts && typeof opts.onDone === 'function') opts.onDone({ fit: fit || null, hairLayer: hairLayer || null });
  };

  getCachedImg(angle, (img)=>{
    ctx.clearRect(0,0,w,h);

    const hairC   = state.hairCanvases[angle];
    const baseC   = state.baseCanvases[angle];
    const maskInf = state.hairMasks[angle];

    if(state.debugShowField && maskInf && maskInf.orientation){
      // ── 결필드 원본 디버그 뷰 ──
      // strand 시뮬레이션(뿌리 위치 제약·중력·clamp)을 전혀 거치지 않고
      // computeHairOrientationField가 뽑아낸 값을 그대로 표시. 원본 사진 위에
      // 얹어서, 저장된 결방향 데이터가 마스크 전체에 걸쳐 실제로 얼마나
      // 촘촘·신뢰할 만한지(coherence 색상)를 strand 렌더링과 분리해서 확인한다.
      const fit = computeFit(img.width, img.height, w, h);
      ctx.drawImage(img, fit.dx, fit.dy, fit.dw, fit.dh);
      drawOrientationFieldDebug(ctx, fit, maskInf);
      done(fit, null);
      return;
    }

    if(state.debugShowMask && hairC && maskInf){
      // ── 마스크 디버그 뷰 ──
      // 가닥 렌더링을 완전히 건너뛰고, 원본 사진 위에 최종 결과만 단색으로 보여주는 대신,
      // "왜 이렇게 됐는지"를 색으로 구분해서 보여준다: 빨강=최종 머리카락,
      // 회색=얼굴박스라서 제외, 파랑=눈썹/눈/입 가드라서 제외.
      const fit = computeFit(img.width, img.height, w, h);
      ctx.drawImage(img, fit.dx, fit.dy, fit.dw, fit.dh); // 원본 사진 그대로

      ctx.save();
      ctx.globalAlpha = 0.6;
      const reasonC = getReasonCanvas(maskInf);
      if(reasonC){
        ctx.drawImage(reasonC, fit.dx, fit.dy, fit.dw, fit.dh);
      } else {
        // reasonCanvas가 없는 예전 캐시 데이터 대비 폴백: 기존 단색 방식
        const maskOverlay = document.createElement('canvas');
        maskOverlay.width = hairC.width; maskOverlay.height = hairC.height;
        const mCtx = maskOverlay.getContext('2d');
        mCtx.drawImage(hairC, 0, 0);
        mCtx.globalCompositeOperation = 'source-in';
        mCtx.fillStyle = '#ff2d55';
        mCtx.fillRect(0, 0, maskOverlay.width, maskOverlay.height);
        ctx.drawImage(maskOverlay, fit.dx, fit.dy, fit.dw, fit.dh);
      }
      ctx.restore();
      done(fit, null);
      return;
    }

    if(hairC && baseC && maskInf && maskInf.scalpY){
      // ── 세그멘테이션 성공 ──
      // 레이어 순서:
      // [1] baseC (원본에서 머리카락 영역이 진짜로 지워진 베이스) → 얼굴·배경만
      // [2] 헤어컬러 언더코트 (마스크 실루엣을 평균 헤어컬러로 채움, 가닥 사이 빈틈 방지)
      // [3] 새 가닥 (scalpY 기반, 자유롭게 아래로 뻗음)
      // [4] 컬러 오버레이

      // 머리 중심 확대(조정 화면 전용 — 재구성엔 영향 없음).
      // 결과 화면(opts.resultFit)은 두상을 오려낼 것이라 머리·목이 프레임 안에
      // 온전히 들어와야 한다 — 확대만 하는 zoomFitToHair 대신 축소도 하는 프레이밍.
      const baseFit = (opts && opts.resultFit)
        ? computeResultSourceFit(img, maskInf, angle, w, h)
        : computeFit(img.width, img.height, w, h);
      const fit = (opts && opts.resultFit) ? baseFit : zoomFitToHair(baseFit, maskInf, w, h);

      // 이전 버그: 원본 img를 먼저 통째로 그린 뒤 baseC(머리 부분 투명)를
      // source-over로 덮었는데, 투명 픽셀은 source-over에서 아무 효과가 없어서
      // 원본 머리카락이 전혀 안 지워지고 그대로 남아있었음(가닥은 그 위에 얹히기만 함).
      // → baseC 자체를 베이스로 바로 그려서 머리카락 영역을 실제로 비운다.
      // 지워진 머리카락 자리가 검게 뚫리지 않도록 메움 배경을 먼저 깐다.
      const fillC = getHoleFillCanvas(angle, baseC, maskInf);
      if(fillC){
        ctx.save(); ctx.imageSmoothingEnabled = true;
        ctx.drawImage(fillC, fit.dx, fit.dy, fit.dw, fit.dh);
        ctx.restore();
      } else {
        /* ── 메움 실패 시의 바닥 (2026-08-02 10차) ────────────────────────
           사용자: "이마 위쪽 세그멘테이션 안이 까맣게 보인다. 이마 피부픽셀
           옮기는 게 안 먹네?" — 그 '까망'은 <b>아무것도 안 그린 자리</b>다.
           baseC는 머리카락을 지운 그림이라 그 자리가 투명인데, 메움 배경
           생성이 실패하면(두상 타원 없음·피부 표본 없음·예외) 여기서 아무것도
           안 깔아서 페이지 배경(#1B1816)이 그대로 비쳤다. 픽셀 이식 시절엔
           그 위에 사진 띠를 통째로 덮어 안 보였고, 가닥 렌더로 오면서 가닥
           사이로 드러난 것이다.
           정교한 메움이 실패해도 <b>검정은 답이 아니다</b> — 최소한 두피색
           단색을 깔아 준다. 가닥·언더코트가 그 위에 얹히므로 티가 안 난다. */
        const flat = document.createElement('canvas');
        flat.width = baseC.width; flat.height = baseC.height;
        const fx = flat.getContext('2d');
        fx.fillStyle = (maskInf && maskInf.scalpColor) || 'rgb(224,178,148)';
        fx.fillRect(0, 0, flat.width, flat.height);
        ctx.drawImage(flat, fit.dx, fit.dy, fit.dw, fit.dh);
        warnHoleFillOnce(angle);
      }
      /* baseC를 <b>테두리 정리해서</b> 얹는다 (2026-08-10).
         원본 baseC에는 지운 머리의 반투명 경계 픽셀(알파 200~250)이 남아 있어,
         메움 배경 위에 <b>검은 톱니 윤곽</b>으로 찍혔다 — 사용자가 말한
         "렌더링 주변에 겹쳐 보이는 다른 마스크"의 절반이 이것이다.
         정리본은 그 테두리를 버리고 몇 px 더 깎는다. 깎인 자리는 방금 깐
         메움 배경(방향성 인페인팅)이 이미 채우고 있으므로 구멍이 안 생긴다. */
      ctx.drawImage(getCleanBaseCanvas(baseC, maskInf), fit.dx, fit.dy, fit.dw, fit.dh);

      // ── (6차) 통짜 언더코트 제거 ──
      // 예전엔 여기서 hairC 마스크 실루엣 전체를 두피색으로 통째로 칠했음 —
      // 사용자 지적("세그멘테이션 전체를 처음에 그려버리잖아") 그대로: 가닥을
      // 아무리 짧게 조정해도 이 통짜 실루엣이 뒤에 남아 조정이 안 먹히는 것처럼
      // 보이는 직접 원인이었다. 언더코트는 이제 drawHairStrands 내부에서
      // "실제 가닥 경로를 따라" 굵은 두피색 획으로 깔린다(가닥 사이 빈틈 메움은
      // 유지하면서, 조정된 헤어 모양을 바탕이 그대로 따라감).

      // 원본 결 보기(debugShowRaw): 실제 state.sections/selectedStyle은 그대로 두고,
      // 화면에 넘기는 값만 중립값으로 덮어씀 — 길이 50(=원본 인식 길이 그대로),
      // 볼륨 50, 컬 0(순수 결방향만 따라감), 색상은 스타일 틴트 대신 실제 인식된 평균 헤어컬러.
      const rawMode = state.debugShowRaw;
      const maskW = maskInf.w, maskH = maskInf.h;
      const scalpY   = maskInf.scalpY;
      const hairEndY = maskInf.hairEndY;

      const validCount = countValidCols(scalpY);

      if(validCount > maskW * 0.05){
        // (11차 3단계) 3D 조정 엔진 ON + 중립 모델 준비됨 → 조정창을 3D 모델의
        // 투영으로 그림(3D=원본, 2D=투영). "3D로 조정, 2D로 표현"의 완성 —
        // 장기적으로 비교 화면 제거하고 조정창이 곧 결과 화면. 실패/미준비 시
        // 기존 2D 직접 렌더로 폴백(안전).
        // (2026-07-26) β 플래그 게이트 제거 — 경로를 하나로.
        // 사용자: "β 버튼 안 켜도 경로가 3D로 갈 수 있잖아. 경로는 동일하게 가면 되지."
        // 맞는 지적. 플래그로 경로가 갈리면 같은 조정을 두 원리(3D 기하 변형 /
        // 2D 재추적)로 구현해야 하고, 실제로 가르마도 두 군데에 넣어야 했다.
        // 이제 조정은 항상 3D에서 하고 2D는 그 투영이다. 아래 drawHairStrands는
        // 조정 경로가 아니라 폴백(중립 모델 미준비/투영 실패/원본 결 보기)이다.
        const canProject = !rawMode && state.hair3Dneutral
          && state.hair3Dneutral.viewCal && state.hair3Dneutral.viewCal[angle];
        /* ── 헤어를 자기 <b>레이어</b>에 그린다 (2026-08-01) ────────────────
           예전엔 세 경로(이식/가닥투영/2D폴백)가 전부 배경 사진 위에 직접 그렸다.
           그러면 "그려진 헤어 픽셀"을 배경과 분리할 수 없어서 <b>잴 수가 없다</b>.
           레이어로 빼면 두 가지가 한꺼번에 열린다:
             · 비교 — 렌더 결과만 떼어 원본 사진/마스크와 대조(measureRenderVsPhoto)
             · 클립 — 나중에 "세그멘테이션 밖에는 안 그린다"를 이 레이어에
               destination-in <b>한 줄</b>로 걸 수 있다. 경로 세 개를 각각 고칠 필요가 없다.
           _sizeRef: 다발 폭 역산이 화면 표시 폭을 쓰는데 오프스크린은 0을 돌려준다.
           원본 캔버스를 물려서 렌더 결과가 레이어 도입 전과 동일하게 유지된다. */
        /* 이 레이어는 <b>프레임마다</b> 새로 만들어지고 있었다(2026-08-22).
           조정 화면 캔버스 크기 그대로라 폰에서 한 장에 10MB 안팎이다.
           조정 화면은 그리고 나면 버리므로 풀에서 재사용한다.
           결과 화면(onDone으로 hairLayer를 받아 _resultScene에 <b>보관</b>한다)만
           예전처럼 새로 만든다 — 공유하면 다음 프레임이 덮어써서 결과가 바뀐다. */
        const keepsLayer = !!(opts && typeof opts.onDone === 'function');
        const hairLayer = keepsLayer
          ? (()=>{ const c = document.createElement('canvas');
                   c.width = ctx.canvas.width; c.height = ctx.canvas.height;
                   CANVAS_POOL.made++; return c; })()
          : scratchCanvas('hairLayer', ctx.canvas.width, ctx.canvas.height);
        hairLayer._sizeRef = ctx.canvas;
        const lctx = hairLayer.getContext('2d');
        // (2026-07-27) 픽셀 이식 경로 — 켜져 있으면 먼저 시도하고, 실패하면 가닥 렌더로 폴백
        const quilted = canProject && state.hairQuilt && projectHairQuiltToView(lctx, fit, angle, maskInf);
        if(!quilted && !(canProject && projectHair3DToView(lctx, fit, angle, maskInf))){
          /* (2026-09-01 6차) 여기가 <b>ⓒ 투영 실패 폴백</b>이다. 2D 조정 엔진을
             끄면서 "ⓒ가 실제로 도느냐"가 손실 크기를 정하게 됐다 — 안 돌면
             손실이 0이다. 세서 진단정보에 띄운다(추측하지 않기 위해). */
          PROJ_FALLBACK.n++; PROJ_FALLBACK.lastAngle = angle;
          // 가닥 오버레이 — origLen 이내는 hairCanvas 마스크로 clip, 연장분은 clip 없음(drawHairStrands 내부에서 처리)
          drawHairStrands(lctx, fit, scalpY, hairEndY, maskW, maskH, hairC, buildStrandOpts(maskInf, angle, rawMode));
        }
        const clipGrow = applyHairLayerClip(hairLayer, hairC, fit, ctx.canvas.width, ctx.canvas.height, rawMode, angle);
        measureRenderVsPhoto(hairLayer, maskInf, fit, ctx.canvas.width, ctx.canvas.height, angle, clipGrow);
        ctx.drawImage(hairLayer, 0, 0);
        done(fit, hairLayer); // 결과 화면이 이 레이어를 의상 위에 한 번 더 얹는다
      }
      done(fit, null); // 가닥이 하나도 없는 경우(위 if 미진입)에도 fit은 넘겨준다

    } else if(img){
      // ── 세그멘테이션 없음: 원본만 표시 (SVG 폴백 제거) ──
      const fitPlain = (opts && opts.resultFit)
        ? computeResultSourceFit(img, maskInf, angle, w, h)
        : computeFit(img.width, img.height, w, h);
      ctx.drawImage(img, fitPlain.dx, fitPlain.dy, fitPlain.dw, fitPlain.dh);
      done(fitPlain, null);
    } else {
      ctx.fillStyle='#211D19'; ctx.fillRect(0,0,w,h);
      const cssW = canvas.getBoundingClientRect().width || w; // 고정 1200 백킹스토어에서도 화면 표시 크기 유지
      ctx.fillStyle='#52483D'; ctx.font=`${Math.round(13*(w/Math.max(1,cssW)))}px Inter`; ctx.textAlign='center';
      ctx.fillText('이 각도의 사진이 없습니다', w/2, h/2);
      done(null, null);
    }
  });
}

// 조정 화면(#screen-adjust)의 캔버스를 현재 각도로 다시 그리는 짧은 헬퍼 —
// 디버그 토글 3곳에서 renderFrame(document.getElementById('adjustCanvas'), state.currentViewAngle)
// 호출이 그대로 반복되던 것을 하나로 합침 (drawAdjustPreview는 rAF로 감싸서 별도 유지)
function renderAdjustFrame(){
  // [진단용] 조정 렌더가 실제로 실행되는지 + 어떤 섹션 길이값으로 그리는지 추적.
  // onGySlider 로그의 값과 여기 값이 같으면 상태→렌더는 정상(문제는 길이→픽셀 매핑),
  // 여기 로그가 안 찍히면 렌더 자체가 재실행 안 됨(currentScreen/rAF 문제).
  // (2026-07-22) 슬라이더 틱마다 찍혀 콘솔이 넘치던 것 → 상세 모드에서만 출력.
  if(window.DIAG_VERBOSE) console.log('[진단·조정렌더] view='+state.currentViewAngle
    +' 활성섹션='+state.activePanelSection
    +' crown.len='+(state.sections.crown&&state.sections.crown.length)
    +' front.len='+(state.sections.front&&state.sections.front.length)
    +' rawMode='+state.debugShowRaw);
  renderFrame(document.getElementById('adjustCanvas'), state.currentViewAngle);
  logSectionColumnCounts(state.currentViewAngle);
  // 중립 3D 모델 확보 + 미니뷰 갱신(디바운스). 중립 모델은 고정이라 재캡처·
  // 재리프트가 필요 없고, refreshDevMini3D는 연산자만 다시 적용한다(가벼움).
  // (2026-07-26) β 플래그 게이트 제거 — 조정 경로가 3D 하나로 통일됐으므로
  // 중립 모델은 플래그와 무관하게 항상 준비돼 있어야 한다(없으면 위 renderFrame이
  // 2D 폴백으로 떨어진다). 최초 진입 1회만 무겁고 이후엔 캐시.
  scheduleHair3DRefresh();
}
let _hair3DRefreshTimer = null;
function scheduleHair3DRefresh(){
  if(_hair3DRefreshTimer) return;
  _hair3DRefreshTimer = setTimeout(()=>{
    _hair3DRefreshTimer = null;
    try {
      if(!state.hair3Dneutral) buildNeutralHair3D(()=>refreshDevMini3D());
      else refreshDevMini3D();
    } catch(e){ console.warn('3D 미니뷰 갱신 실패:', e); }
  }, 120);
}

// [진단용] 현재 뷰에서 각 섹션에 실제로 몇 개의 머리카락 컬럼이 배정되는지 집계.
// "크라운만 전체를 바꾸고 나머지는 안 먹힌다"의 원인 확인용 — 정면 뷰에서 대부분
// 컬럼이 crown으로 판정되면 crown 조정만 크게 보이고 나머지 섹션은 빈 영역이라
// 조정해도 화면에 나타날 컬럼이 없다. renderFrame이 refineSectionBoundaries로 경계를
// 갱신한 뒤 호출되므로 여기서 세면 현재 뷰 기준 정확.
let _secDistAt = 0;
function logSectionColumnCounts(angle){
  const mi = state.hairMasks && state.hairMasks[angle];
  if(!mi || !mi.scalpY) return;
  /* ── ⓑ와 <b>같은 모양이 하나 더 남아 있었다</b> (2026-08-23) ────────────────
     8/22에 measureRenderVsPhoto를 두고 "출력 조건과 계산 조건이 갈리면 반드시
     이 낭비가 생긴다"고 적어 놨는데, 이 함수가 정확히 그것이다 — 아래에서
     컬럼 W개 × 깊이 5지점 = 마스크 폭의 5배만큼 resolveSectionId를 돌려 놓고,
     찍는 것은 <b>분포가 바뀔 때만</b>(_lastSecDistLog). 슬라이더를 흔드는 동안
     초당 수십 번 계산해서 전부 버렸다. 섹션 경계는 랜드마크에서 나오므로
     같은 뷰를 계속 그리는 동안에는 값이 바뀔 일도 거의 없다.
     게이트를 계산 <b>앞</b>으로 옮긴다: 뷰가 바뀌었거나 1초가 지났을 때만 센다.
     ※ 상세 모드(DIAG_VERBOSE)에서는 예전처럼 매번 — 진단을 켠 사람은 매 프레임을
       보려는 것이다.
     되돌리기: MOBILE_PERF.gateSecDist = false */
  if(MOBILE_PERF.gateSecDist && !window.DIAG_VERBOSE){
    const now = Date.now();
    if(window._lastSecDistLog && window._lastSecDistLog[angle] && (now - _secDistAt) < 1000) return;
    _secDistAt = now;
  }
  const counts = { crown:0, front:0, temple:0, side:0, occipital:0, nape:0 };
  const W = mi.w, H = mi.h;
  let valid = 0;
  // (2026-07-22, 4차) 미용 이론대로 "뿌리 위치" 기준으로 집계(사용자 교정: 기준은 뿌리).
  // 렌더도 뿌리를 준균등 분포(pow 1.1)로 심으므로 깊이 5지점 균등 샘플이 실분포에 근사.
  // 측면 crown 편중은 분류가 아니라 두정선 높이(뷰별 parietalFrac)+겹 스택 캡으로 해소.
  const DEPTHS = [0, 0.2, 0.4, 0.6, 0.8];
  for(let x=0; x<W; x++){
    const sy = mi.scalpY[x]; if(sy < 0) continue;
    const ey = (mi.hairEndY && mi.hairEndY[x] >= 0) ? mi.hairEndY[x] : sy;
    DEPTHS.forEach(f=>{
      const rootY = sy + (ey - sy) * f;
      valid++;
      const sec = resolveSectionId(angle, x/W, rootY/H);
      if(counts[sec] !== undefined) counts[sec]++;
    });
  }
  const line = '[진단·섹션분포] '+angle+' 뿌리기준(깊이5지점×컬럼)='+valid+' | '
    + Object.entries(counts).map(([k,v])=>k+'='+v+'('+(valid?Math.round(v/valid*100):0)+'%)').join(' ');
  // (2026-07-22) 렌더마다 같은 내용이 반복 출력되던 것 → 분포가 "바뀔 때만" 1회 출력
  // (섹션 경계 검증에 필요한 정보는 유지하면서 콘솔 스팸 제거).
  window._lastSecDistLog = window._lastSecDistLog || {};
  if(window._lastSecDistLog[angle] !== line || window.DIAG_VERBOSE){
    window._lastSecDistLog[angle] = line;
    console.log(line);
  }
}

/* ────────────────────────────────────────
   가닥 렌더링
   - 2단계 clip: 원본 인식 길이(origLen) 이내는 hairCanvas(마스크)로 clip해서
     마스크 밖으로 절대 안 나감 / 슬라이더로 늘어난 연장분만 clip 없이 자유롭게
   - 두피 라인(scalpY)에서 출발, 길이·컬·볼륨 슬라이더 반영
   - 미용 "섹션" 개념: 굵은 면 레이어 + 가는 가닥 레이어 혼합
──────────────────────────────────────── */
/* ────────────────────────────────────────────────────────────────
   drawHairStrands(...) 리팩토링(2026-07-14) — 역할별 분리
   원래 663줄짜리 함수 하나 안에 전부 중첩 정의돼 있었음. 이 함수는
   Canvas 2D API(ctx.stroke 등)를 직접 호출하는 부분이 대부분이라,
   Node 샌드박스엔 진짜 Canvas 구현체가 없어서 그 부분을 옮기면
   "동작 100% 보존"을 확신 있게 검증할 방법이 없음(과거 세션에서 이미
   이 이유로 "목차만 추가, 구조는 안 건드림"으로 결론 낸 적 있음).
   → 이번엔 그 중 "Canvas API를 전혀 안 쓰는 순수 계산" 부분만
   골라서 분리(=Node에서 무작위 입력으로 독립 검증 가능한 부분만):
     createColumnStyleResolvers(...) — 컬럼(ix)별 길이배율/색상/컬배율/
       프론트 방향바이어스 4종 계산(원래 lengthRatioFor 등 4개 중첩 함수)
     traceStrandPath(...)            — 결방향 필드를 따라 가닥 경로
       (좌표 배열)를 만드는 순수 함수(원래 traceStrand 중첩 함수)
   실제로 ctx.stroke()/getImageData() 등을 호출하는 setStyle/traceStrand
   (얇은 래퍼로 남음)/toCanvasPts/strokePolyline/drawStrand/
   drawStrandLayer/isRealHairAt/compositeLayers/레이어 실행 4단계는
   검증 불가능한 변경을 피하기 위해 원래처럼 drawHairStrands 안에
   그대로 남겨둠(⚠ 정직한 한계: 이 부분은 이번 리팩토링 대상에서
   의도적으로 제외 — 아래 dev-log 참고).
──────────────────────────────────────────────────────────────── */
