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
/* ── min이 <b>0.4에서 바닥</b>이었다 (2026-09-14) ────────────────────────────
   사용자(남성 실기기): "이 남자 사진은 adjust 2D화면에서 지금 이상으로 작아지지
   않아." — 녹화의 배율 표시가 정확히 <b>40%</b>에서 멈춰 있다. 손잡이가 고장난
   게 아니라 여기 바닥에 닿은 것이다.
   0.4는 위 주석이 말하는 문제(긴 머리면 자동 프레이밍이 어깨까지 잡아 정수리가
   우표만 해진다)의 <b>반대쪽</b>을 못 푼다: 사진이 얼굴 위주로 크게 잡힌 경우에는
   반대로 <b>더 줄여야</b> 두상 전체가 들어온다. 상한은 10배(=1000%)나 열어 두고
   하한만 2.5배로 막아 둔 것이라 애초에 비대칭이었다.
   0.15로 내린다 — fit이 이미 화면에 맞춘 배율이므로 그 15%면 두상이 프레임의
   6분의 1로 들어와 어떤 구도든 확인이 된다. 표시 배율이 15%까지 내려간다.
   ⚠ 순수 표시 배율이다 — 재구성(3D)에는 관여하지 않는다(위 주석과 같다).
   되돌리기: min: 0.4 */
const ADJUST_VIEW = { zoom: 1, panX: 0, panY: 0, min: 0.15, max: 10 };
function adjustViewReset(){
  // (옛 43) 조정 화면이 3D일 때는 3D 카메라를 되돌림
  if(ADJUST3D.active() && typeof model3dViewReset === 'function'){ model3dViewReset(); try{ frameCameraToHead(); }catch(e){} return; }
  ADJUST_VIEW.zoom = 1; ADJUST_VIEW.panX = 0; ADJUST_VIEW.panY = 0; syncAdjustZoomUI(); renderAdjustFrame(); }
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
  if(ADJUST3D.active() && typeof model3dZoomStep === 'function') return model3dZoomStep(mul);   // (옛 43) 3D일 때는 3D 확대
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
function toggleDiagInfoBase(){
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

/* 진단 패널 열기/닫기 — 기능 단계(바깥) → toggleDiagInfoBase
   · (옛 38 진단 도구 ②③) "계산 중…"을 먼저 그린 뒤 계산 · 계산 중 탭은 버림 · [복사] 막대 */
function toggleDiagInfo(){
  return DIAG_TOOLS.toggle(this, arguments);
}

/* ==========================================================================
 * 진단 도구 — DIAG_TOOLS (2026-10-03 · 옛 38-diag-copy-cam.js)
 *   녹화 없이 숫자 보내기 · 진단 버튼 · 카메라 끄기
 *   붙는 자리: activateScreen(05) 끝 — afterActivate(카메라) · toggleDiagInfo(아래) · setupModel3DScreen(18) — trackSetup(3D 진입 기록)
 *
 * ① 카메라 끄기 — 카메라는 앱을 열 때 켜져서 한 번도 꺼지지 않았습니다(getTracks().stop() 없음).
 *    스타일·조정·3D 화면에 있는 동안에도 센서와 영상 프레임이 계속 돌아 메모리·발열을 먹습니다.
 *    촬영 화면을 나가면 끄고, 촬영 화면으로 돌아오면 다시 켭니다.
 *
 * ② 진단 버튼 — 두 가지가 겹쳐 잘 안 눌렸습니다.
 *    · 버튼 높이가 약 22px(글자 11px + 여백 4px) — 손가락으로 맞히기 어려운 크기.
 *    · 누르면 그 자리에서 미뤄 둔 진단 계산(28번 C: 뷰별 재풀이·실루엣 4뷰·전체 가닥)을 다 하고
 *      나서야 패널이 그려집니다. 그동안 화면이 멈춰 있어 "안 눌렸나" 하고 다시 누르면,
 *      쌓여 있던 두 번째 탭이 패널을 도로 닫습니다.
 *    고침: 버튼을 키우고, 누르면 "계산 중…"을 먼저 그린 뒤 계산하고, 계산 중·직후의 탭은 버립니다.
 *
 * ③ 숫자를 글자로 복사 — 진단 패널에 [복사] 버튼. 화면 녹화 없이 붙여넣기로 보낼 수 있습니다.
 *    마지막 진단 글은 localStorage에도 남깁니다(앱이 꺼져도 DIAG_TOOLS.last()로 꺼냄).
 *
 * ④ 3D 진입 기록 — 3D 결과 화면에 들어갈 때마다 JS힙(진입 전 → 최고 → 끝)과 걸린 시간,
 *    그 순간의 성능 줄을 적어 둡니다. 조정 화면의 진단 → [복사]에 같이 들어갑니다.
 *    (3D 화면의 [진단] 버튼은 2026-10-03d에 뺐습니다 — 사용자 요청)
 *
 * 끄기: DIAG_TOOLS.on=false (②③④) · DIAG_TOOLS.camOff=false (①)
 * ========================================================================== */
var DIAG_TOOLS = (function () {
  'use strict';
  var W = window, TAG = '[진단 도구]';
  var T = { on: true, camOff: true };
  var LS_KEY = 'gyeol_diag_last';
  function now() { try { return performance.now(); } catch (e) { return Date.now(); } }
  function scr() { try { return currentScreen; } catch (e) { return ''; } }
  function heap() { try { var m = performance.memory; return m ? m.usedJSHeapSize / 1048576 : null; } catch (e) { return null; } }
  function mb(v) { return v == null ? '—' : Math.round(v); }
  function clock() { var d = new Date(); function p(n) { return (n < 10 ? '0' : '') + n; } return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()); }
  function afterPaint(fn) {
    var raf = W.requestAnimationFrame || function (f) { return setTimeout(f, 16); };
    raf(function () { setTimeout(fn, 0); });
  }

  /* ────────────────────────────────────────────────────────────────────────
   * ① 촬영 화면 밖에서는 카메라 끄기
   * ────────────────────────────────────────────────────────────────────── */
  var cam = T.cam = { stops: 0, restarts: 0 };
  function camStop() {
    try {
      if (typeof cameraStream === 'undefined' || !cameraStream) return;
      cameraStream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} });
      cameraStream = null;
      try { video.srcObject = null; } catch (e) {}
      cam.stops++;
      console.log(TAG + ' 카메라 끔 (촬영 화면 밖)');
    } catch (e) { console.warn(TAG + ' 카메라 끄기 실패', e); }
  }
  function camStart() {
    try {
      if (typeof cameraStream === 'undefined' || cameraStream || typeof initCamera !== 'function') return;
      if (!cam.stops) return;                       // 우리가 끈 적이 없으면 건드리지 않음(권한 거부 등)
      cam.restarts++;
      var p = initCamera();
      var after = function () {
        if (scr() !== 'capture') return camStop();  // 켜지는 사이 다른 화면으로 갔으면 다시 끔
        try { if (typeof updateAngleUI === 'function') updateAngleUI(); } catch (e) {}
      };
      if (p && typeof p.then === 'function') p.then(after, after); else after();
    } catch (e) { console.warn(TAG + ' 카메라 다시 켜기 실패', e); }
  }
  /* activateScreen(05) 끝 */
  T.afterActivate = function (name) {
    if (T.camOff) { if (name === 'capture') camStart(); else camStop(); }
  };

  /* ────────────────────────────────────────────────────────────────────────
   * 글자 모으기
   * ────────────────────────────────────────────────────────────────────── */
  // 미뤄 둔 진단 계산(28번 C)을 돌리지 않고 성능 줄만
  function perfLinesLight() {
    var F = W.STYLE_FAST, keep = F ? F.pending : null;
    if (F) F.pending = null;
    try { return (typeof W.perfPanelLines === 'function' && W.perfPanelLines()) || []; }
    catch (e) { return ['(성능 줄 실패: ' + (e && e.message) + ')']; }
    finally { if (F) F.pending = keep; }
  }
  function rankLines() {
    var P = W.GYEOL_PERF, rows = [], k;
    if (!P || !P.t) return [];
    for (k in P.t) if (P.t[k].n) rows.push([k, P.t[k].ms, P.t[k].n]);
    rows.sort(function (a, b) { return b[1] - a[1]; });
    return rows.slice(0, 12).map(function (r) { return '  ' + r[0] + ' ' + Math.round(r[1]) + 'ms / ' + r[2] + '회'; });
  }
  var log3D = T.log3D = [];
  function log3DLines() {
    if (!log3D.length) return ['(아직 3D 화면에 들어간 적 없음)'];
    var out = [];
    log3D.forEach(function (e, i) {
      out.push('#' + (i + 1) + ' ' + e.at + ' · JS힙 진입 전 ' + mb(e.h0) + ' → 최고 ' + mb(e.peak) + ' → 끝 ' + mb(e.h1) + 'MB · ' +
        (e.ms == null ? '아직 진행 중' : '걸린 시간 ' + Math.round(e.ms) + 'ms') + (e.hair ? ' · ' + e.hair : ''));
    });
    var last = log3D[log3D.length - 1];
    if (last.lines) { out.push('— 마지막 진입 직후의 성능 줄 —'); out = out.concat(last.lines); }
    return out;
  }
  function header() {
    var n = navigator, s = W.screen || {};
    return ['결 진단 · ' + new Date().toISOString().slice(0, 10) + ' ' + clock() + ' · 화면 ' + scr(),
      (n.userAgent || ''),
      '화면 ' + W.innerWidth + '×' + W.innerHeight + ' @' + (W.devicePixelRatio || 1) + ' · 기기 메모리 ' + (n.deviceMemory || '?') + 'GB · 코어 ' + (n.hardwareConcurrency || '?') +
      ' · 카메라 끔 ' + cam.stops + '회/다시 켬 ' + cam.restarts + '회'];
  }
  function fullText(panelText) {
    var a = header();
    a.push('', panelText || perfLinesLight().join('\n'));
    a.push('', '── 3D 진입 기록 ──'); a = a.concat(log3DLines());
    var rk = rankLines(); if (rk.length) { a.push('', '── 함수별 누적(포함 시간) ──'); a = a.concat(rk); }
    try { if (W.MOBILE_DIET && W.MOBILE_DIET.status) a.push('', '── MOBILE_DIET.status ──', JSON.stringify(W.MOBILE_DIET.status())); } catch (e) {}
    var txt = a.join('\n').replace(/<\/?b>/g, '');
    try { localStorage.setItem(LS_KEY, txt.slice(0, 60000)); } catch (e) {}
    return txt;
  }
  T.text = function () { return fullText(null); };
  T.last = function () { try { return localStorage.getItem(LS_KEY); } catch (e) { return null; } };

  function copyText(text, btn) {
    var label = btn ? btn.textContent : '';
    function flash(msg) { if (!btn) return; btn.textContent = msg; setTimeout(function () { btn.textContent = label; }, 1600); }
    function fallback() {
      try {
        var ta = document.createElement('textarea');
        ta.value = text; ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;';
        document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        flash(ok ? '복사됨 ✓' : '복사 실패');
      } catch (e) { flash('복사 실패'); }
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { flash('복사됨 ✓'); }, fallback);
        return;
      }
    } catch (e) {}
    fallback();
  }
  function mkBtn(label, fn) {
    var b = document.createElement('button');
    b.type = 'button'; b.textContent = label;
    b.style.cssText = 'min-height:34px;min-width:64px;padding:6px 12px;border-radius:8px;border:1px solid #0f0;background:#062a06;color:#0f0;font:600 12px monospace;touch-action:manipulation;';
    b.addEventListener('click', function (e) { e.stopPropagation(); fn(b); });
    return b;
  }
  function addBar(box, getText, onClose) {
    var bar = document.createElement('div');
    bar.style.cssText = 'position:sticky;top:-8px;display:flex;gap:8px;margin:-8px -8px 6px;padding:6px 8px;background:rgba(0,0,0,0.95);z-index:1;';
    bar.appendChild(mkBtn('복사', function (b) { copyText(getText(), b); }));
    if (onClose) bar.appendChild(mkBtn('닫기', onClose));
    box.insertBefore(bar, box.firstChild);
  }

  /* ────────────────────────────────────────────────────────────────────────
   * ②③ 조정 화면 진단 버튼
   * ────────────────────────────────────────────────────────────────────── */
  var box = document.getElementById('diagInfoBox'), btn = document.getElementById('diagInfoToggle');
  var busy = false;
  if (btn) {
    btn.style.minHeight = '40px'; btn.style.minWidth = '88px'; btn.style.padding = '10px 14px';
    btn.style.fontSize = '12px'; btn.style.touchAction = 'manipulation'; btn.style.zIndex = '51';
  }
  if (box) box.style.bottom = '56px';
  /* toggleDiagInfo(아래) 몸통 — 원래 열기/닫기는 toggleDiagInfoBase */
  {
    T.toggle = function (self, args) {
      if (!T.on || !box) return toggleDiagInfoBase.apply(self, args);
      if (busy) return;                                         // 계산 중·직후에 쌓인 탭은 버림
      if (box.style.display !== 'none') return toggleDiagInfoBase.apply(self, args);   // 닫기
      busy = true;
      box.style.display = 'block';
      box.textContent = '진단 계산 중… (스타일을 고른 뒤 처음 열 때는 몇 초 걸립니다)';
      var t0 = now();
      afterPaint(function () {
        try {
          box.style.display = 'none';
          toggleDiagInfoBase();                                 // 원래 함수가 열고 내용을 채움
          var panel = box.textContent, took = Math.round(now() - t0);
          panel = '[진단 패널 여는 데 ' + took + 'ms]\n' + panel;
          T.lastPanel = panel;
          fullText(panel);                                      // localStorage에 남김
          addBar(box, function () { return fullText(T.lastPanel); }, null);
        } catch (e) {
          box.style.display = 'block';
          box.textContent = '진단 실패: ' + (e && e.message);
          console.warn(TAG + ' 진단 패널 실패', e);
        } finally { setTimeout(function () { busy = false; }, 400); }
      });
    };
  }

  /* ────────────────────────────────────────────────────────────────────────
   * ④ 3D 진입 기록 + 3D 화면 진단 버튼
   * ────────────────────────────────────────────────────────────────────── */
  /* setupModel3DScreen(18) — inner()가 안쪽 단계(폰 다이어트 → 원래 화면 만들기) */
  {
    T.trackSetup = function (inner) {
      if (!T.on) return inner();
      var e = { at: clock(), h0: heap(), peak: heap(), h1: null, ms: null, lines: null, hair: '' };
      log3D.push(e); while (log3D.length > 4) log3D.shift();
      var t0 = now(), ticks = 0;
      var iv = setInterval(function () {
        var h = heap(); if (h != null && (e.peak == null || h > e.peak)) e.peak = h;
        if (++ticks > 240) clearInterval(iv);                   // 최대 1분
      }, 250);
      var done = function () {
        e.ms = now() - t0;
        setTimeout(function () {                                // 얼굴 메쉬 등 뒤늦게 붙는 것까지 조금 기다림
          clearInterval(iv);
          e.h1 = heap(); if (e.h1 != null && e.h1 > e.peak) e.peak = e.h1;
          try { var st = W.MOBILE_DIET && W.MOBILE_DIET.status && W.MOBILE_DIET.status().pre3D;
            if (st) e.hair = '헤어: 받아 씀 ' + st.hit + ' / 이어서 ' + st.resumed + ' / 진입 때 만듦 ' + st.cold + ' / 원래 방식 ' + st.fallback; } catch (x) {}
          if (scr() === 'model3d') e.lines = perfLinesLight();
          fullText(null);                                       // 앱이 꺼져도 남도록
        }, 2500);
      };
      var r;
      try { r = inner(); } catch (x) { done(); throw x; }
      if (r && typeof r.then === 'function') r.then(done, done); else done();
      return r;
    };
  }

  /* (2026-10-03d) 3D 화면의 [진단] 버튼은 뺐습니다(사용자 요청). 3D 진입 기록은 계속 남고,
     조정 화면의 진단 → [복사]에 같이 들어갑니다. */

  console.log(TAG + ' 설치 — 촬영 화면 밖 카메라 끔 · 진단 버튼 키움/먼저 그림 · [복사] · 3D 진입 기록. ' +
    '글자 꺼내기 DIAG_TOOLS.text() · 마지막 기록 DIAG_TOOLS.last() · 끄기 DIAG_TOOLS.on=false / .camOff=false');
  return T;
})();


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
  if(ADJUST3D._skipFrame(canvas)) return;   // (옛 43) 조정 화면이 3D면 2D 그리기 건너뜀
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
        /* (2026-09-16) 이 뷰만 viewCal이 빠졌으면 폴백으로 굳히지 말고 한 번 다시 만든다
           (buildNeutralHair3D 동시 실행 경합 — 17b NEUTRAL_BUILD 배너). 결과 화면은 제외. */
        if(!rawMode && !canProject && !(opts && opts.onDone) && typeof healMissingViewCal === 'function'){
          try{ healMissingViewCal(angle); }catch(e){ console.warn('[viewCal 누락] 복구 실패:', e); }
        }
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
function renderAdjustFrameBase(){
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
/* 조정 화면 그리기 — 기능 단계(바깥) → renderAdjustFrameBase(28-perf-probe가 감쌈)
   · (옛 39 두 번 그리기) 맨 바깥 — 이 안에서 불린 투영만 TWO_PASS 대상(15)
   · (옛 37 폰 다이어트) 걸린 시간을 기록하고(드래그 중 미룰지 판단) 한가해지면 3D 헤어 미리 만들기 */
function renderAdjustFrame(){
  const r = TWO_PASS._inFrame(this, arguments, function(){
    const t0 = performance.now();
    try{ return renderAdjustFrameBase.apply(this, arguments); }
    finally{ if(typeof MOBILE_DIET !== 'undefined') MOBILE_DIET.afterRenderAdjust(performance.now() - t0); }
  });
  ADJUST3D._afterAdjustFrame();   // (옛 43) 조정 화면 3D: 탭 바뀌면 그 면으로 돌리고 헤어 갱신 예약
  COMB3D._syncBtn();              // (옛 53) 빗질 버튼 맞춤
  PHOTO_CHECK._syncUi();          // (옛 60) 원본 대조 버튼
  return r;
}
let _hair3DRefreshTimer = null;
function scheduleHair3DRefreshBase(){
  if(_hair3DRefreshTimer) return;
  _hair3DRefreshTimer = setTimeout(()=>{
    _hair3DRefreshTimer = null;
    try {
      if(!state.hair3Dneutral) buildNeutralHair3D(()=>refreshDevMini3D());
      else refreshDevMini3D();
    } catch(e){ console.warn('3D 미니뷰 갱신 실패:', e); }
  }, 120);
}
/* 미니 3D 갱신 예약 — 기능 단계(바깥) → scheduleHair3DRefreshBase
   · (옛 39 두 번 그리기) 빠른 그림 뒤엔 건너뜀 — 완성 그림 뒤에 한 번
   · (옛 37 폰 다이어트 ①) 슬라이더 드래그 중이면 손 뗄 때 한 번 */
function scheduleHair3DRefresh(){
  if(TWO_PASS._skipMini()) return;
  if(typeof MOBILE_DIET !== 'undefined' && MOBILE_DIET.deferMini()) return;
  return scheduleHair3DRefreshBase.apply(this, arguments);
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

/* ==========================================================================
 * PHOTO_CHECK (옛 60-photo-check.js) — 원본 대조: 지금 화면의 3D 머리를 원본 사진의 머리 윤곽과 겹쳐 보기
 *
 * 자리: 07b, 파일 끝. computeAdjustedHair3DStrands(17b) 마감 PHOTO_CHECK._apply(결 맞추기 → 윤곽 밖 잘라내기) · adjFilterSig 꼬리표 · renderAdjustFrame(07b)·activateScreen(05) 끝 버튼 맞춤 · 영어 표는 22 · perfPanelLines(18) 끝 줄
 *
 * 왜 (2026-10-07 · 사용자): "다른 사람들 테스트해 보니 긴 머리 직모가 아니라서 역시 좀 다르네 … 원본 사진이랑 대조하는 작업 등을 시행하면 나아지려나."
 *   "이번엔 원본 대조 한번 걸었으면 좋겠어."
 *   지금까지는 3D 머리가 사진과 얼마나 같은지 눈으로만 봤습니다. 다시 기르기(42)는 가닥의 "뼈대"를 사진의 머리 영역 안에서 멈추지만,
 *   그 뒤에 얹는 컬·볼륨·결 정렬·빗질은 사진을 다시 보지 않습니다. 어디가 얼마나 다른지 재는 것이 먼저입니다.
 *
 * 무엇을:
 *   ① 대조 — 조정 화면의 [원본 대조] 버튼. 지금 그려진 가닥(computeAdjustedHair3DStrands의 결과 그대로)을 사진마다 그 사진의 카메라
 *      (13b 점유 프로브의 카메라 — 42번 다시 기르기가 쓰는 것과 같은 것 · 360 세트면 52번이 넣은 카메라 포함)로 비춰 윤곽을 만들고,
 *      사진의 머리 영역(03a 마스크)과 칸(사진 가로 cols칸) 단위로 비교합니다.
 *        빨강 = 넘침: 3D에는 머리가 있는데 사진에는 없는 자리(허용 여유 tolCm 밖)
 *        파랑 = 빔  : 사진에는 머리가 있는데 3D에는 없는 자리
 *      사진마다 겹침(IoU)·넘침·빔 비율과, 윤곽의 위/아래/좌/우 끝이 사진보다 몇 cm 나갔는지(+)·모자란지(−)를 냅니다.
 *      카메라 반대편에 있으면서 두개골에 가리거나 턱 아래(몸에 가릴 수 있는 자리)인 점은 비교에서 뺍니다(42번의 머리 영역 투표와 같은 규칙).
 *   ② 윤곽 밖 잘라내기(선택 · 기본 꺼짐) — 패널의 [윤곽 밖 잘라내기]. 켜면 가닥에서 "어느 사진에서든 머리 영역 밖(여유 trimTolCm)"으로
 *      trimOut 넘게 나갔거나 밖에서 끝난 꼬리(trimTail 이상)를 그 자리에서 자릅니다. 조정 화면과 3D 결과 화면이 같은 규칙을 거칩니다.
 *      스타일이 걸려 있는 동안(다른 스타일은 원본과 다른 것이 당연)과 길이 슬라이더를 원본 기준에서 늘렸을 때는 자르지 않습니다.
 *      사진·모델이 바뀌면 꺼집니다.
 *   ③ 진단 [원본 대조] — 마지막으로 대조한 숫자.
 *
 * (2026-10-07b) 결 대조 · 결 맞추기 — 사용자: "원본 대조로 두 사진을 겹쳐 놓고 디렉션하고 크게 벗어나는 뭉치들은 조정되는 건 안 돼? 자동으로?"
 *   ④ 결 대조 — 사진마다 03a가 읽어 둔 결 방향(42번 다시 기르기가 가닥을 기를 때 읽는 그 값)과, 그 사진 각도에서 보이는 겉층 가닥의 "큰 방향"
 *      (앞뒤 dirSmooth를 이은 현 — 컬·웨이브는 방향으로 안 침)을 칸마다 비교합니다. 사진의 결이 또렷하고(dirCoh 이상) 3D 가닥도 그 칸에서 한쪽으로
 *      모여 있는(dir3Coh 이상) 칸만 비교합니다. dirWarn° 넘게 어긋났고 이웃 칸도 같이 어긋난(= 뭉치) 칸을 노랑으로 표시합니다.
 *      결은 "선"이라 앞뒤가 없습니다 — 어긋남은 0~90°.
 *   ⑤ 결 맞추기(선택 · 기본 꺼짐) — 패널의 [결 맞추기]. 노랑 칸을 지나는 마디(겉에서 dirFixLayer 깊이까지)를, 그 사진에서 봤을 때 사진의 결과 나란해지도록 그 사진의 시선 축 둘레로 돌립니다
 *      (가닥의 큰 방향만 맞춤 → 컬 모양·마디 길이는 그대로 · 붓을 지난 아래쪽은 모양 그대로 따라 옮겨짐 · 뿌리 쪽 dirGrip은 덜 돎 · 두상·목 속으로는 못 들어감).
 *      한 마디가 여러 사진에 걸리면 그 마디를 가장 옆에서(덜 비스듬히) 보는 사진을 씁니다. 가닥을 다 만든 뒤(빗질까지 한 뒤) 한 번 돕니다 — 잘라내기보다 먼저.
 *      스타일이 걸려 있는 동안은 쉽니다. 사진·모델이 바뀌면 꺼집니다. 등록 스타일에는 아직 안 들어갑니다.
 *      ⚠ 합성 머리로만 확인했습니다. 사진 결의 또렷함(coherence) 눈금은 실제 사진에서 본 적이 없어 dirCoh는 어림값입니다 — 진단 줄의 "비교한 칸 수"가 너무 적거나
 *        엉뚱한 자리가 돌면 그 줄을 보고 조정합니다.
 *
 * 알아둘 것:
 *   · 윤곽 대조는 겉 테두리만 봅니다. 결 대조는 사진의 결이 또렷한 자리만 봅니다(곱슬처럼 잘게 엇갈린 자리는 비교에서 빠짐).
 *   · 컬 모양·가르마 위치가 사진과 같은지는 이 대조로 알 수 없습니다.
 *   · 카메라 맞춤(각도·배율)이 틀린 사진은 통째로 어긋나 보입니다 — 한 사진만 넘침·빔이 한쪽으로 쏠려 있으면 머리가 아니라 그 사진의 맞춤 문제일 수 있습니다.
 *   · "빔"은 고쳐 주지 않습니다(보여 주기만). 머리를 더 심거나 늘리는 것은 다음 단계입니다.
 *   · 잘라내기는 엄격합니다: 한 사진에서만 밖이어도 자릅니다(보이는 것과 같게 하려고). 맞춤이 틀린 사진이 있으면 그 방향이 과하게 깎일 수 있으니
 *     대조 그림을 먼저 보고 켜세요. 특정 사진을 빼려면 PHOTO_CHECK.skip=['v90', …].
 *
 * 끄기: PHOTO_CHECK.on=false · 잘라내기만 끄기 PHOTO_CHECK.setTrim(false) · 결 맞추기만 끄기 PHOTO_CHECK.setFixDir(false) · 결 대조 표시 끄기 PHOTO_CHECK.dir=false
 * ========================================================================== */
var PHOTO_CHECK = (function () {
  'use strict';
  var W = window, TAG = '[원본 대조]';
  var P = Object.assign({
    on: true,
    exportCols: 480,    // (2026-10-10a) 내보내기에 싣는 사진 칸(머리 영역·결) — 경계를 보려고 비교 칸보다 촘촘히
    cols: 200,          // 비교 칸: 사진 가로를 이 수로 나눔(800px 사진이면 칸 4px)
    tolCm: 0.6,         // 넘침·빔으로 치지 않는 여유(윤곽선 근처의 이 두께는 같다고 봄)
    extRun: 3,          // 윤곽 끝(위/아래/좌/우)을 잴 때 그 줄에 머리 칸이 이만큼은 있어야 끝으로 침(한두 가닥은 무시)
    skip: [],           // 대조·잘라내기에서 뺄 사진(angle 이름)
    trim: false,        // 윤곽 밖 잘라내기
    trimTolCm: 1.0,     // 잘라낼 때의 여유(대조보다 넉넉히)
    trimOut: 0.08,      // 밖으로 이 길이(모델 단위 ≈ 1.5cm) 넘게 나가면 나간 자리에서 자름(나갔다 돌아오는 고리 포함)
    trimTail: 0.03,     // 밖에서 끝난 꼬리가 이 길이(≈ 0.6cm) 이상이면 자름
    keepPts: 3,
    // (b) 결 대조 · 결 맞추기
    dir: true,          // 결 대조(표시)
    fixDir: false,      // 결 맞추기
    dirCoh: 0.2,        // 사진 결의 또렷함이 이 이상인 칸만(어림값)
    dir3Coh: 0.5,       // 그 칸의 3D 가닥들이 한쪽으로 모인 정도(0~1)가 이 이상인 칸만
    dirMinSeg: 3,       // 그 칸에 겉층 마디가 이만큼은 있어야
    dirWarn: 30,        // 도: 이 넘게 어긋난 칸을 표시·맞춤
    dirNbr: 4,          // 둘레 3×3칸 중 어긋난 칸이 (자기 포함) 이만큼은 돼야 뭉치로 봄
    dirScalp: 1.25,     // 두피 타원체의 이 배수 안쪽 마디는 두피 법선 둘레로 돌림(누운 머리) · 밖은 사진의 시선 축 둘레로
    dirNormMin: 0.35,   // …단, 그 법선이 사진 시선과 이루는 cos가 이 이상일 때만(너무 비스듬하면 시선 축으로)
    dirLayer: 0.13,     // 겉층: 그 칸에서 카메라에 가장 가까운 머리보다 이만큼(≈ 2.5cm) 안쪽까지
    dirFixLayer: 0.3,   // 결 맞추기가 닿는 깊이(≈ 5.7cm) — 대조는 겉층만 보지만, 맞출 때는 그 아래 속머리도 같이 돌림(사진으로는 겉 결만 알 수 있음)
    dirSample: 6000,    // 결을 읽는 데 쓰는 가닥 수 상한(넘으면 건너뛰며 읽음 — 칸의 방향만 알면 되므로) · 돌리는 것은 전부
    dirFore: 0.5,       // 그 사진에서 이 비율보다 짧게 보이는(시선 쪽으로 누운) 마디는 비교·맞춤에서 뺌
    dirSmooth: 0.2,     // 가닥의 큰 방향을 재는 길이(앞뒤로 ≈ 3.7cm씩)
    dirSegTol: 15,      // 도: 노랑 칸 안이라도 제 큰 방향이 사진 결에서 이 안쪽인 마디는 안 돌림
    dirGain: 1,         // 어긋난 각의 이 비율만큼 돌림
    dirGrip: 0.12,      // 가닥의 앞 12%(뿌리 쪽)는 덜 돎
    lenSlack: 3         // 길이 슬라이더가 원본 기준보다 이 넘게 길어진 섹션이 있으면 잘라내기를 쉼
  }, W.PHOTO_CHECK || {});
  var S = P.stats = { at: null, views: [], strands: 0, ms: 0, err: null, trimCut: 0, trimLen: 0, trimMs: 0, trimWhy: '', fixStr: 0, fixSeg: 0, fixMs: 0, fixWhy: '', fixPush: 0 };
  var ver = 0;

  function now() { try { return performance.now(); } catch (e) { return Date.now(); } }

  /* ────────────────────────────────────────────────────────────────────────
   * 계산(화면·앱 상태와 무관 — 합성 테스트에서 그대로 부름)
   *   cams: [{angle, R[9], cx, s, sy, crownY, smp:{at(ix,iy)}, iw, ih}] · env: {CY, yTop, a, b, c(두피 타원체), cm(모델 단위당 cm)}
   * ────────────────────────────────────────────────────────────────────── */
  function prepCam(cam, env, cfg, tolCm) {
    var cols = Math.max(40, cfg.cols | 0), cell = cam.iw / cols, gw = cols, gh = Math.max(1, Math.ceil(cam.ih / cell)), N = gw * gh, M = new Uint8Array(N), x, y, n = 0;
    for (y = 0; y < gh; y++) for (x = 0; x < gw; x++) if (cam.smp.at((x + 0.5) * cell, (y + 0.5) * cell) > 0) { M[y * gw + x] = 1; n++; }
    var cellCm = cell * cam.s * env.cm, tol = Math.max(1, Math.round(tolCm / Math.max(1e-6, cellCm)));
    return { cam: cam, cell: cell, gw: gw, gh: gh, M: M, nPhoto: n, cellCm: cellCm, tol: tol, MD: dilate(M, gw, gh, tol) };
  }
  function dilate(A, gw, gh, r) {            // 네모 팽창(가로·세로 따로)
    if (!(r > 0)) return A;
    var N = gw * gh, T = new Uint8Array(N), O = new Uint8Array(N), x, y, k, run;
    for (y = 0; y < gh; y++) { run = -1e9; for (x = 0; x < gw; x++) { if (A[y * gw + x]) run = x; if (x - run <= r) T[y * gw + x] = 1; }
      run = 1e9; for (x = gw - 1; x >= 0; x--) { if (A[y * gw + x]) run = x; if (run - x <= r) T[y * gw + x] = 1; } }
    for (x = 0; x < gw; x++) { run = -1e9; for (y = 0; y < gh; y++) { k = y * gw + x; if (T[k]) run = y; if (y - run <= r) O[k] = 1; }
      run = 1e9; for (y = gh - 1; y >= 0; y--) { k = y * gw + x; if (T[k]) run = y; if (run - y <= r) O[k] = 1; } }
    return O;
  }
  /* 점을 그 사진에 비춤 → o[0]=ix, o[1]=iy · 돌려주는 값: 1 보임 · 0 판정에서 뺌(반대편이면서 두개골에 가리거나 턱 아래) */
  function project(cam, env, px, py, pz, o) {
    var R = cam.R, x = px, y = py - env.CY, z = pz;
    o[0] = (R[0] * x + R[1] * y + R[2] * z) / cam.s + cam.cx;
    o[1] = cam.crownY + (env.yTop - ((R[3] * x + R[4] * y + R[5] * z) + env.CY)) / cam.sy;
    if (R[6] * x + R[7] * y + R[8] * z < 0) {
      if (py < env.yBody) return 0;
      var dx = R[6], dy = R[7], dz = R[8];
      var A = dx * dx / env.a2 + dy * dy / env.b2 + dz * dz / env.c2, B = 2 * (x * dx / env.a2 + y * dy / env.b2 + z * dz / env.c2), C = x * x / env.a2 + y * y / env.b2 + z * z / env.c2 - 0.96;
      var D = B * B - 4 * A * C;
      if (D > 0 && (-B + Math.sqrt(D)) / (2 * A) > 1e-4) return 0;
    }
    return 1;
  }
  function mkEnv(env) {
    return { CY: env.CY, yTop: env.yTop, a2: env.a * env.a, b2: env.b * env.b, c2: env.c * env.c, yBody: env.CY - 0.7 * env.b, cm: env.cm > 0 ? env.cm : 19 };
  }
  function extent(A, gw, gh, run) {         // 머리 칸이 run개 이상인 첫/마지막 줄·칸
    var rows = new Int32Array(gh), cols = new Int32Array(gw), x, y, e = { top: -1, bottom: -1, left: -1, right: -1 };
    for (y = 0; y < gh; y++) for (x = 0; x < gw; x++) if (A[y * gw + x]) { rows[y]++; cols[x]++; }
    for (y = 0; y < gh; y++) if (rows[y] >= run) { e.top = y; break; }
    for (y = gh - 1; y >= 0; y--) if (rows[y] >= run) { e.bottom = y; break; }
    for (x = 0; x < gw; x++) if (cols[x] >= run) { e.left = x; break; }
    for (x = gw - 1; x >= 0; x--) if (cols[x] >= run) { e.right = x; break; }
    return e;
  }
  function compare(strands, cams, env0, cfg) {
    var env = mkEnv(env0), out = [], o = [0, 0], ci, si, k, j;
    for (ci = 0; ci < cams.length; ci++) {
      var pc = prepCam(cams[ci], env, cfg, cfg.tolCm), cam = pc.cam, gw = pc.gw, gh = pc.gh, cell = pc.cell, H = new Uint8Array(gw * gh), nPts = 0;
      for (si = 0; si < strands.length; si++) {
        var pts = strands[si] && (strands[si].pts || strands[si]); if (!pts || pts.length < 2) continue;
        var v0 = project(cam, env, pts[0].x, pts[0].y, pts[0].z, o), x0 = o[0], y0 = o[1], v1, x1, y1;
        for (k = 1; k < pts.length; k++) {
          v1 = project(cam, env, pts[k].x, pts[k].y, pts[k].z, o); x1 = o[0]; y1 = o[1];
          if (v0 && v1) {
            var n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) / (cell * 0.7)));
            for (j = 0; j <= n; j++) {
              var gx = Math.floor((x0 + (x1 - x0) * j / n) / cell), gy = Math.floor((y0 + (y1 - y0) * j / n) / cell);
              if (gx >= 0 && gy >= 0 && gx < gw && gy < gh) H[gy * gw + gx] = 1;
            }
            nPts++;
          }
          v0 = v1; x0 = x1; y0 = y1;
        }
      }
      // 가닥 사이 빈칸 메우기(한 칸 부풀렸다 줄임) → 3D 머리의 덩어리
      var Hc = erode(dilate(H, gw, gh, 1), gw, gh, 1), HD = dilate(Hc, gw, gh, pc.tol);
      var OV = new Uint8Array(gw * gh), UN = new Uint8Array(gw * gh), nH = 0, nO = 0, nU = 0, nI = 0, nUni = 0, M = pc.M, MD = pc.MD;
      for (k = 0; k < gw * gh; k++) {
        if (Hc[k]) nH++;
        if (Hc[k] && M[k]) nI++;
        if (Hc[k] || M[k]) nUni++;
        if (Hc[k] && !MD[k]) { OV[k] = 1; nO++; }
        if (M[k] && !HD[k]) { UN[k] = 1; nU++; }
      }
      var eM = extent(M, gw, gh, cfg.extRun), eH = extent(Hc, gw, gh, cfg.extRun), cc = pc.cellCm, ccy = cell * cam.sy * env.cm;
      var ok = eM.top >= 0 && eH.top >= 0;
      out.push({ angle: cam.angle, gw: gw, gh: gh, cell: cell, cellCm: cc, M: M, H: Hc, over: OV, under: UN, nPhoto: pc.nPhoto, nHair: nH, nOver: nO, nUnder: nU,
        iou: nUni ? nI / nUni : 0, overPct: pc.nPhoto ? nO / pc.nPhoto : 0, underPct: pc.nPhoto ? nU / pc.nPhoto : 0, segs: nPts,
        ext: ok ? { top: (eM.top - eH.top) * ccy, bottom: (eM.bottom >= gh - 2) ? null : (eH.bottom - eM.bottom) * ccy, left: (eM.left - eH.left) * cc, right: (eH.right - eM.right) * cc } : null });
    }
    return out;
  }
  function erode(A, gw, gh, r) {
    var N = gw * gh, I = new Uint8Array(N), k; for (k = 0; k < N; k++) I[k] = A[k] ? 0 : 1;
    var D = dilate(I, gw, gh, r); for (k = 0; k < N; k++) D[k] = D[k] ? 0 : 1;
    return D;
  }
  /* 잘라내기: 가닥마다 자를 점 번호(안 자르면 길이) — pcs: prepCam 결과들(여유 = trimTolCm) */
  function cutIndex(pts, pcs, env, cfg, o) {
    var m = pts.length, k, ci, runStart = -1, runLen = 0, out, pc, gx, gy, p, q;
    for (k = 1; k < m; k++) {
      p = pts[k]; out = false;
      for (ci = 0; ci < pcs.length; ci++) {
        pc = pcs[ci];
        if (!project(pc.cam, env, p.x, p.y, p.z, o)) continue;
        gx = Math.floor(o[0] / pc.cell); gy = Math.floor(o[1] / pc.cell);
        if (gx < 0 || gy < 0 || gx >= pc.gw || gy >= pc.gh) continue;       // 사진 밖은 판정 못 함
        if (!pc.MD[gy * pc.gw + gx]) { out = true; break; }
      }
      if (out) {
        if (runStart < 0) { runStart = k; runLen = 0; }
        q = pts[k - 1]; runLen += Math.sqrt((p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y) + (p.z - q.z) * (p.z - q.z));
        if (runLen >= cfg.trimOut) return Math.max(cfg.keepPts, runStart);
      } else runStart = -1;
    }
    if (runStart >= 0 && runLen >= cfg.trimTail) return Math.max(cfg.keepPts, runStart);
    return m;
  }
  /* ── 결 대조 ── cam.dirAt(ix, iy) → [각(화면 오른쪽 0 · 위쪽 +, 선이라 π마다 같음), 또렷함] 또는 null */
  var HALF = Math.PI / 2;
  function wrapHalf(d) { while (d > HALF) d -= Math.PI; while (d <= -HALF) d += Math.PI; return d; }
  function dirPrep(strands, cams, env0, cfg) {
    var env = env0.a2 ? env0 : mkEnv(env0), out = [], o = [0, 0], ci, si, k, stepS = Math.max(1, Math.ceil(strands.length / Math.max(500, cfg.dirSample || 6000)));
    for (ci = 0; ci < cams.length; ci++) {
      var cam = cams[ci]; if (typeof cam.dirAt !== 'function') continue;
      var cols = Math.max(40, cfg.cols | 0), cell = cam.iw / cols, gw = cols, gh = Math.max(1, Math.ceil(cam.ih / cell)), N = gw * gh, R = cam.R;
      var Z = new Float32Array(N).fill(-1e9), C2 = new Float32Array(N), S2 = new Float32Array(N), NN = new Uint16Array(N), pass, pts, p, q, A, B, n, hw, L, zc, gx, gy, id, cx, cy, cz, cl, px2, py2, pl, th;
      for (pass = 0; pass < 2; pass++) for (si = 0; si < strands.length; si += stepS) {
        pts = strands[si] && (strands[si].pts || strands[si]); if (!pts || pts.length < 3) continue;
        n = pts.length;
        if (pass) { L = 0; for (k = 1; k < n; k++) L += Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y, pts[k].z - pts[k - 1].z); hw = L > 0 ? Math.round(cfg.dirSmooth / (L / (n - 1))) : 1; if (!(hw >= 1)) hw = 1; else if (hw > 16) hw = 16; }
        for (k = 1; k < n; k++) {
          p = pts[k]; q = pts[k - 1];
          var mx = (p.x + q.x) * 0.5, my = (p.y + q.y) * 0.5, mz = (p.z + q.z) * 0.5;
          if (!project(cam, env, mx, my, mz, o)) continue;
          gx = Math.floor(o[0] / cell); gy = Math.floor(o[1] / cell); if (gx < 0 || gy < 0 || gx >= gw || gy >= gh) continue;
          id = gy * gw + gx; zc = R[6] * mx + R[7] * (my - env.CY) + R[8] * mz;
          if (!pass) { if (zc > Z[id]) Z[id] = zc; continue; }
          if (zc < Z[id] - cfg.dirLayer) continue;
          A = pts[k - 1 - hw < 0 ? 0 : k - 1 - hw]; B = pts[k + hw > n - 1 ? n - 1 : k + hw];
          cx = B.x - A.x; cy = B.y - A.y; cz = B.z - A.z; cl = Math.sqrt(cx * cx + cy * cy + cz * cz); if (!(cl > 1e-9)) continue;
          px2 = (R[0] * cx + R[1] * cy + R[2] * cz) / cam.s; py2 = (R[3] * cx + R[4] * cy + R[5] * cz) / cam.sy; pl = Math.sqrt(px2 * px2 + py2 * py2);
          if (pl * Math.sqrt(cam.s * cam.sy) < cfg.dirFore * cl) continue;        // 시선 쪽으로 누운 마디
          th = Math.atan2(py2, px2);
          C2[id] += Math.cos(2 * th); S2[id] += Math.sin(2 * th); if (NN[id] < 65535) NN[id]++;
        }
      }
      var TP = new Float32Array(N).fill(NaN), DL = new Float32Array(N).fill(NaN), FL = new Uint8Array(N), compared = 0, degs = [], cohs = [], warn = cfg.dirWarn * Math.PI / 180, x, y, d, pd, r3;
      for (y = 0; y < gh; y++) for (x = 0; x < gw; x++) {
        id = y * gw + x; if (NN[id] < cfg.dirMinSeg) continue;
        r3 = Math.sqrt(C2[id] * C2[id] + S2[id] * S2[id]) / NN[id]; if (r3 < cfg.dir3Coh) continue;
        pd = cam.dirAt((x + 0.5) * cell, (y + 0.5) * cell); if (!pd) continue;
        cohs.push(pd[1]); if (!(pd[1] >= cfg.dirCoh)) continue;
        d = wrapHalf(pd[0] - 0.5 * Math.atan2(S2[id], C2[id]));
        compared++; degs.push(Math.abs(d)); DL[id] = d;
        if (Math.abs(d) >= warn) { FL[id] = 1; TP[id] = pd[0]; }
      }
      // 뭉치만: 둘레 3×3에 어긋난 칸이 dirNbr개 이상
      var MIS = new Uint8Array(N), off = 0, a, b, c2n;
      for (y = 0; y < gh; y++) for (x = 0; x < gw; x++) {
        id = y * gw + x; if (!FL[id]) continue; c2n = 0;
        for (b = -1; b <= 1; b++) for (a = -1; a <= 1; a++) { if (x + a < 0 || y + b < 0 || x + a >= gw || y + b >= gh) continue; if (FL[id + b * gw + a]) c2n++; }
        if (c2n >= cfg.dirNbr) { MIS[id] = 1; off++; } else TP[id] = NaN;
      }
      degs.sort(function (u, v) { return u - v; }); cohs.sort(function (u, v) { return u - v; });
      out.push({ cam: cam, angle: cam.angle, cell: cell, gw: gw, gh: gh, Z: Z, TP: TP, MIS: MIS, compared: compared, off: off,
        medDeg: degs.length ? degs[degs.length >> 1] * 180 / Math.PI : null, cohMed: cohs.length ? cohs[cohs.length >> 1] : null, cohSeen: cohs.length });
    }
    return out;
  }
  /* 결 맞추기: 가닥 하나 → 새 점 배열(안 바뀌면 같은 배열). dps = dirPrep 결과 */
  var RB = new Float64Array(3 * 64), UB = new Float64Array(4 * 64);
  function fixStrand(pts, dps, env, cfg, o, st) {
    var n = pts.length, last = n - 1, k, ci, p, q, A, B, L = 0, hw, changed = false, lo = n, hi = 0;
    if (n < 3 || !dps.length) return pts;
    if (RB.length < n * 3) { RB = new Float64Array(n * 3 + 96); UB = new Float64Array(n * 4 + 128); }
    var R = RB, U = UB, sx, sy, sz, len;
    for (k = 1; k < n; k++) { p = pts[k]; q = pts[k - 1]; sx = p.x - q.x; sy = p.y - q.y; sz = p.z - q.z; len = Math.sqrt(sx * sx + sy * sy + sz * sz);
      if (len > 1e-9) { U[k * 4] = sx / len; U[k * 4 + 1] = sy / len; U[k * 4 + 2] = sz / len; } else { U[k * 4] = 0; U[k * 4 + 1] = -1; U[k * 4 + 2] = 0; }
      U[k * 4 + 3] = len; L += len; }
    hw = L > 0 ? Math.round(cfg.dirSmooth / (L / last)) : 1; if (!(hw >= 1)) hw = 1; else if (hw > 16) hw = 16;
    var tol = cfg.dirSegTol * Math.PI / 180, grip = cfg.dirGrip;
    for (k = 1; k < n; k++) {
      R[k * 3] = 0; R[k * 3 + 1] = 0; R[k * 3 + 2] = 0;
      if (!(U[k * 4 + 3] > 1e-9)) continue;
      p = pts[k]; q = pts[k - 1];
      var mx = (p.x + q.x) * 0.5, my = (p.y + q.y) * 0.5, mz = (p.z + q.z) * 0.5, best = 0, bd = 0, bc = null, cx, cy, cz, cl;
      A = pts[k - 1 - hw < 0 ? 0 : k - 1 - hw]; B = pts[k + hw > last ? last : k + hw];
      cx = B.x - A.x; cy = B.y - A.y; cz = B.z - A.z; cl = Math.sqrt(cx * cx + cy * cy + cz * cz); if (!(cl > 1e-9)) continue;
      for (ci = 0; ci < dps.length; ci++) {
        var dp = dps[ci], cam = dp.cam, Rc = cam.R;
        if (!project(cam, env, mx, my, mz, o)) continue;
        var gx = Math.floor(o[0] / dp.cell), gy = Math.floor(o[1] / dp.cell); if (gx < 0 || gy < 0 || gx >= dp.gw || gy >= dp.gh) continue;
        var id = gy * dp.gw + gx, tp = dp.TP[id]; if (tp !== tp) continue;                                // NaN = 맞출 칸 아님
        if (Rc[6] * mx + Rc[7] * (my - env.CY) + Rc[8] * mz < dp.Z[id] - cfg.dirFixLayer) continue;         // 겉에서 dirFixLayer 깊이까지(속머리는 겉 결을 따름)
        var px2 = (Rc[0] * cx + Rc[1] * cy + Rc[2] * cz) / cam.s, py2 = (Rc[3] * cx + Rc[4] * cy + Rc[5] * cz) / cam.sy, f = Math.sqrt(px2 * px2 + py2 * py2) * Math.sqrt(cam.s * cam.sy) / cl;
        if (f < cfg.dirFore || f <= best) continue;
        var d = wrapHalf(tp - Math.atan2(py2, px2)); if (Math.abs(d) < tol) continue;
        best = f; bd = d; bc = Rc;
      }
      if (!bc) continue;
      var w = cfg.dirGain, t = k / last; if (grip > 0 && t < grip) w *= t / grip;
      var ang = bd * w; if (Math.abs(ang) < 0.003) continue;
      // 돌리는 축: 두피에 누운 머리는 두피 법선 둘레로만 돌 수 있음 → 법선 둘레로, 화면에서 그만큼 돌아 보이도록 각을 키움(법선이 시선과 이루는 cos로 나눔).
      //   두피에서 뜬 머리(dirScalp 밖)나 법선이 시선과 너무 비스듬한 자리는 그 사진의 시선 축 둘레로(화면에서 반시계가 +).
      var axx = bc[6], axy = bc[7], axz = bc[8], yyn = my - env.CY, een = Math.sqrt(mx * mx / env.a2 + yyn * yyn / env.b2 + mz * mz / env.c2);
      if (een < cfg.dirScalp) {
        var nnx = mx / env.a2, nny = yyn / env.b2, nnz = mz / env.c2, nnl = Math.sqrt(nnx * nnx + nny * nny + nnz * nnz);
        if (nnl > 1e-9) { nnx /= nnl; nny /= nnl; nnz /= nnl; var cc = nnx * bc[6] + nny * bc[7] + nnz * bc[8];
          if (Math.abs(cc) >= cfg.dirNormMin) { axx = nnx; axy = nny; axz = nnz; ang = ang / cc; if (ang > HALF) ang = HALF; else if (ang < -HALF) ang = -HALF; } }
      }
      R[k * 3] = axx * ang; R[k * 3 + 1] = axy * ang; R[k * 3 + 2] = axz * ang;
      changed = true; if (k < lo) lo = k; if (k > hi) hi = k; if (st) st.seg++;
    }
    if (!changed) return pts;
    var s0 = Math.max(1, lo - 1), s1 = Math.min(last, hi + 1), j, o0x, o0y, o0z, c0x, c0y, c0z;
    j = (s0 > 1 ? s0 - 1 : s0) * 3; o0x = R[j]; o0y = R[j + 1]; o0z = R[j + 2];
    for (k = s0; k <= s1; k++) {                                           // 회전을 이웃 마디끼리 한 번 고르게
      j = k * 3; c0x = R[j]; c0y = R[j + 1]; c0z = R[j + 2];
      if (k < last) { R[j] = (o0x + 2 * c0x + R[j + 3]) * 0.25; R[j + 1] = (o0y + 2 * c0y + R[j + 4]) * 0.25; R[j + 2] = (o0z + 2 * c0z + R[j + 5]) * 0.25; }
      else { R[j] = (o0x + 3 * c0x) * 0.25; R[j + 1] = (o0y + 3 * c0y) * 0.25; R[j + 2] = (o0z + 3 * c0z) * 0.25; }
      o0x = c0x; o0y = c0y; o0z = c0z;
    }
    var out = new Array(n), a2 = env.a2, b2 = env.b2, c2 = env.c2, hcy = env.CY, lift = 1.02, NK = env.neck || null;
    var ax, ay, az, kx, ky, kz, cs, sn, kd, tx, ty, tz, ex, ey, ez, yy, fl, ee, nx, ny, nz, nl, dn, sl, kk, pt, r, og;
    for (k = 0; k < s0; k++) out[k] = pts[k];
    var qx = pts[s0 - 1].x, qy = pts[s0 - 1].y, qz = pts[s0 - 1].z;
    for (k = s0; k < n; k++) {
      ax = U[k * 4]; ay = U[k * 4 + 1]; az = U[k * 4 + 2]; len = U[k * 4 + 3];
      if (k <= s1) {
        kx = R[k * 3]; ky = R[k * 3 + 1]; kz = R[k * 3 + 2]; ang = Math.sqrt(kx * kx + ky * ky + kz * kz);
        if (ang > 1e-5) { kx /= ang; ky /= ang; kz /= ang; cs = Math.cos(ang); sn = Math.sin(ang); kd = (kx * ax + ky * ay + kz * az) * (1 - cs);
          tx = ax * cs + (ky * az - kz * ay) * sn + kx * kd; ty = ay * cs + (kz * ax - kx * az) * sn + ky * kd; tz = az * cs + (kx * ay - ky * ax) * sn + kz * kd; ax = tx; ay = ty; az = tz; }
      }
      ex = qx + ax * len; ey = qy + ay * len; ez = qz + az * len;
      if (len > 1e-9) {                                                    // 두상 속으로는 못 들어감(원래 안쪽이던 점은 그 깊이까지)
        og = pts[k]; yy = og.y - hcy; fl = Math.sqrt(og.x * og.x / a2 + yy * yy / b2 + og.z * og.z / c2); if (fl > lift) fl = lift;
        yy = ey - hcy; ee = Math.sqrt(ex * ex / a2 + yy * yy / b2 + ez * ez / c2);
        if (ee < fl - 1e-6) {
          yy = qy - hcy; nx = qx / a2; ny = yy / b2; nz = qz / c2; nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
          if (nl > 1e-9) { nx /= nl; ny /= nl; nz /= nl; dn = ax * nx + ay * ny + az * nz;
            if (dn < 0) { tx = ax - dn * nx; ty = ay - dn * ny; tz = az - dn * nz; sl = Math.sqrt(tx * tx + ty * ty + tz * tz); if (sl > 1e-3) { ex = qx + tx / sl * len; ey = qy + ty / sl * len; ez = qz + tz / sl * len; } } }
          yy = ey - hcy; ee = Math.sqrt(ex * ex / a2 + yy * yy / b2 + ez * ez / c2);
          if (ee < fl - 1e-6 && ee > 1e-9) { kk = fl / ee; ex *= kk; ey = hcy + yy * kk; ez *= kk; tx = ex - qx; ty = ey - qy; tz = ez - qz; sl = Math.sqrt(tx * tx + ty * ty + tz * tz);
            if (sl > 1e-9) { ex = qx + tx / sl * len; ey = qy + ty / sl * len; ez = qz + tz / sl * len; } }
          if (st) st.push++;
        }
      }
      pt = { x: ex, y: ey, z: ez };
      if (NK && len > 1e-9) { try { r = NK(pt); if (r && r !== pt && NK(pts[k]) === pts[k]) { tx = r.x - qx; ty = r.y - qy; tz = r.z - qz; sl = Math.sqrt(tx * tx + ty * ty + tz * tz); if (sl > 1e-9) pt = { x: qx + tx / sl * len, y: qy + ty / sl * len, z: qz + tz / sl * len }; } } catch (e4) {} }
      qx = pt.x; qy = pt.y; qz = pt.z; out[k] = pt;
    }
    return out;
  }
  P._core = { dirPrep: dirPrep, fixStrand: fixStrand, compare: compare, prepCam: prepCam, cutIndex: cutIndex, mkEnv: mkEnv, project: project, dilate: dilate };

  /* ────────────────────────────────────────────────────────────────────────
   * 앱 쪽
   * ────────────────────────────────────────────────────────────────────── */
  var dirCamMemo = new WeakMap();
  function photoModel() { try { return state._hair3Dneutral || null; } catch (e) { return null; } }
  function getCams() {
    try {
      var photo = photoModel(), probe = (photo && photo.occ && photo.occ.probe) || (state.hairOcc3D && state.hairOcc3D.probe);
      if (!probe || !probe.cams) return [];
      var list = probe.cams.filter(function (c) { return c && c.smp && c.iw > 0 && c.ih > 0 && c.s > 0 && c.sy > 0 && P.skip.indexOf(c.angle) < 0; });
      return list.map(function (c) {
        var mi = state.hairMasks && state.hairMasks[c.angle], ori = mi && mi.orientation;
        if (!ori || typeof sampleOrientation !== 'function') return c;
        var hit = dirCamMemo.get(c); if (hit && hit.ori === ori) return hit.cam;
        var mw = mi.maskW || mi.w, mh = mi.maskH || mi.h, kx = mw / mi.w, ky = mh / mi.h, smp = c.smp, ret = [0, 0];
        var cam = Object.assign({}, c, { dirAt: function (ix, iy) {
          if (!(smp.at(ix, iy) > 0)) return null;
          var sm = null; try { sm = sampleOrientation(ori, ix * kx, mw, iy * ky); } catch (e) { sm = null; }
          if (!sm || !isFinite(sm.angle) || !isFinite(sm.coherence)) return null;
          ret[0] = -sm.angle; ret[1] = sm.coherence; return ret;          // 사진 각은 화면 아래가 + → 위가 +로
        } });
        dirCamMemo.set(c, { ori: ori, cam: cam });
        return cam;
      });
    } catch (e) { return []; }
  }
  function getEnv() {
    try {
      var photo = photoModel(), E = (typeof getScalpEllipsoid === 'function') ? getScalpEllipsoid() : null;
      if (!photo || !E || !(E.a > 0) || !isFinite(photo.CY) || !isFinite(photo.yTop)) return null;
      var cm = 0; try { cm = (typeof modelCmPerUnit === 'function') ? modelCmPerUnit() : (state.cmPerUnit || 0); } catch (e2) {}
      return { CY: photo.CY, yTop: photo.yTop, a: E.a, b: E.b, c: E.c, cm: cm > 0 ? cm : 19 };
    } catch (e) { return null; }
  }
  function styleOn() {
    try { if (state.specAppliedId && state.specAppliedId !== '__original__') return true; } catch (e) {}
    try { if (W.FLOW_SPEC && W.FLOW_SPEC.nativeState && W.FLOW_SPEC.nativeState.id) return true; } catch (e) {}
    return false;
  }
  function lengthened() {                    // 길이 슬라이더를 원본 기준보다 늘렸나(다시 기른 머리에서만 알 수 있음)
    try {
      var G = W.REGROW, b = G && G.base && G.base.sections, k; if (!b) return false;
      for (k in b) if (state.sections[k] && isFinite(b[k].length) && +state.sections[k].length > +b[k].length + P.lenSlack) return true;
    } catch (e) {}
    return false;
  }
  var NAMES = { front: '정면', left: '왼쪽', right: '오른쪽', back: '뒤' };
  function nameOf(a) {
    if (NAMES[a]) return NAMES[a];
    var m = /^v(m?)(\d+)$/.exec(a || ''); return m ? '360 ' + (m[1] ? '−' : '+') + m[2] + '°' : String(a);
  }
  var ORDER = ['front', 'left', 'right', 'back'];
  function sortViews(v) { return v.slice().sort(function (p, q) { var i = ORDER.indexOf(p.angle), j = ORDER.indexOf(q.angle); return (i < 0 ? 99 : i) - (j < 0 ? 99 : j); }); }

  P.run = function () {
    S.err = null;
    try {
      var cams = getCams(), env = getEnv();
      if (!cams.length || !env) { S.err = '사진 카메라가 없음(사진 분석 전이거나 점유 프로브가 꺼져 있음)'; S.views = []; return null; }
      var list = computeAdjustedHair3DStrands();
      if (!list || !list.length) { S.err = '가닥이 없음'; S.views = []; return null; }
      var t0 = now(), res = sortViews(compare(list, cams, env, P));
      if (P.dir) { try { dirPrep(list, cams, env, P).forEach(function (d) { var v = res.filter(function (x) { return x.angle === d.angle; })[0]; if (v) v.dir = { MIS: d.MIS, compared: d.compared, off: d.off, medDeg: d.medDeg, cohMed: d.cohMed, cohSeen: d.cohSeen }; }); } catch (eD) { S.err = '결 대조 실패: ' + (eD && eD.message || eD); } }
      S.ms = now() - t0; S.views = res; S.strands = list.length; S.at = new Date().toTimeString().slice(0, 8);
      S.style = styleOn(); S.trimOn = !!(P.trim && trimActive()); if (P.fixDir) fixActive();
      try { console.log(P.lines().join('\n')); } catch (e2) {}
      return res;
    } catch (e) { S.err = String(e && e.message || e); S.views = []; return null; }
  };
  function f1(v) { return (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(1); }
  function viewText(v) {
    var t = nameOf(v.angle) + ' — 겹침 ' + Math.round(v.iou * 100) + '% · 넘침 ' + (v.overPct * 100).toFixed(1) + '% · 빔 ' + (v.underPct * 100).toFixed(1) + '%';
    if (v.ext) t += ' · 윤곽 끝(cm · +는 3D가 더 나감) 위 ' + f1(v.ext.top) + ' / 아래 ' + (v.ext.bottom == null ? '사진 밖' : f1(v.ext.bottom)) + ' / 사진 왼쪽 ' + f1(v.ext.left) + ' / 사진 오른쪽 ' + f1(v.ext.right);
    if (v.dir) t += ' · 결: 비교한 칸 ' + v.dir.compared + ' · 어긋난 뭉치 칸 ' + v.dir.off + (v.dir.compared ? '(' + (v.dir.off / v.dir.compared * 100).toFixed(1) + '%)' : '') + (v.dir.medDeg != null ? ' · 어긋남 중앙 ' + v.dir.medDeg.toFixed(0) + '°' : '') +
      (v.dir.cohMed != null ? ' · 사진 결 또렷함 중앙 ' + v.dir.cohMed.toFixed(2) + '(칸 ' + v.dir.cohSeen + ')' : '');
    else if (P.dir) t += ' · 결: 이 사진은 결 정보 없음';
    return t;
  }
  P.lines = function () {
    var L = [];
    if (!S.at && !S.err) { L.push(TAG + ' 아직 안 함 — 조정 화면의 [원본 대조] 버튼 · 윤곽 밖 잘라내기 ' + (P.trim ? '켜짐' : '꺼짐')); return L; }
    if (S.err) { L.push(TAG + ' ⚠ ' + S.err); return L; }
    L.push(TAG + ' ' + S.at + ' · 가닥 ' + S.strands + '개 · 사진 ' + S.views.length + '장 · ' + Math.round(S.ms) + 'ms · 여유 ' + P.tolCm + 'cm · 비율은 사진의 머리 넓이 대비' +
      (S.style ? ' · ⚠ 스타일이 걸려 있음(원본과 다른 것이 당연)' : '') +
      ' · 윤곽 밖 잘라내기 ' + (P.trim ? (S.trimWhy ? '쉼(' + S.trimWhy + ')' : '켜짐 — 자른 가닥 ' + S.trimCut + '개 · 잘라 낸 길이 합 ' + Math.round(S.trimLen * (getEnv() ? getEnv().cm : 19)) + 'cm · ' + Math.round(S.trimMs) + 'ms') : '꺼짐') +
      ' · 결 맞추기 ' + (P.fixDir ? (S.fixWhy ? '쉼(' + S.fixWhy + ')' : '켜짐 — 돌린 가닥 ' + S.fixStr + '개(마디 ' + S.fixSeg + ' · 두상에 막혀 눕힌 마디 ' + S.fixPush + ') · ' + Math.round(S.fixMs) + 'ms · 기준 ' + P.dirWarn + '° · 사진 결 또렷함 ' + P.dirCoh + ' 이상') : '꺼짐'));
    S.views.forEach(function (v) { L.push('   ' + viewText(v)); });
    return L;
  };

  /* ── 잘라내기 ── */
  function trimActive() {
    S.trimWhy = '';
    if (!P.on || !P.trim) return false;
    if (styleOn()) { S.trimWhy = '스타일이 걸려 있음'; return false; }
    if (lengthened()) { S.trimWhy = '길이를 원본보다 늘림'; return false; }
    return true;
  }
  var memo = new WeakMap(), trimModel = null;
  function trimList(list) {
    var hit = memo.get(list); if (hit && hit.ver === ver) return hit.out;
    var cams = getCams(), env0 = getEnv(); if (!cams.length || !env0 || !list || !list.length) return list;
    var t0 = now(), env = mkEnv(env0), pcs = cams.map(function (c) { return prepCam(c, env, P, P.trimTolCm); }), o = [0, 0];
    var n = list.length, out = new Array(n), i, e, p, cut, k, nc = 0, len = 0;
    for (i = 0; i < n; i++) {
      e = list[i]; p = e && e.pts; out[i] = e;
      if (!p || p.length <= P.keepPts) continue;
      cut = cutIndex(p, pcs, env, P, o);
      if (cut >= p.length) continue;
      for (k = cut; k < p.length; k++) len += Math.hypot(p[k].x - p[k - 1].x, p[k].y - p[k - 1].y, p[k].z - p[k - 1].z);
      var np = p.slice(0, cut);
      try { np._pre = (p._pre && p._pre.length === p.length) ? p._pre.slice(0, cut) : np; } catch (e2) {}
      var ne = Object.assign({}, e, { pts: np });
      try { if (e.colors && e.colors.length === p.length) ne.colors = e.colors.slice(0, cut); if (e.srcColors && e.srcColors.length === p.length) ne.srcColors = e.srcColors.slice(0, cut); } catch (e3) {}
      out[i] = ne; nc++;
    }
    S.trimCut = nc; S.trimLen = len; S.trimMs = now() - t0;
    memo.set(list, { ver: ver, out: out });
    return out;
  }
  /* ── 결 맞추기 ── */
  function fixActive() {
    S.fixWhy = '';
    if (!P.on || !P.fixDir) return false;
    if (styleOn()) { S.fixWhy = '스타일이 걸려 있음'; return false; }
    return true;
  }
  var fmemo = new WeakMap();
  function fixList(list) {
    var hit = fmemo.get(list); if (hit && hit.ver === ver) return hit.out;
    var cams = getCams().filter(function (c) { return typeof c.dirAt === 'function'; }), env0 = getEnv(); if (!cams.length || !env0 || !list || !list.length) return list;
    var t0 = now(), env = mkEnv(env0), dps = dirPrep(list, cams, env, P).filter(function (d) { return d.off > 0; }), o = [0, 0], st = { seg: 0, push: 0 };
    try { env.neck = (W.REGROW && typeof W.REGROW.neckPush === 'function') ? W.REGROW.neckPush : null; } catch (e) { env.neck = null; }
    var n = list.length, out = list, i, e, p, np, nc = 0;
    if (dps.length) {
      out = new Array(n);
      for (i = 0; i < n; i++) {
        e = list[i]; p = e && e.pts; out[i] = e;
        if (!p || p.length < 3) continue;
        np = fixStrand(p, dps, env, P, o, st);
        if (np === p) continue;
        try { np._pre = p._pre || p; } catch (e2) {}                       // 빗기 전 자리(53번 붓이 여기에 칠함)는 그대로 넘김
        out[i] = Object.assign({}, e, { pts: np }); nc++;
      }
    }
    S.fixStr = nc; S.fixSeg = st.seg; S.fixPush = st.push; S.fixMs = now() - t0;
    fmemo.set(list, { ver: ver, out: out });
    return out;
  }
  P._apply = function (list) {   // computeAdjustedHair3DStrands(17b) 마감
    try {
      if (P.trim || P.fixDir) {
        var m = photoModel();
        if (trimModel && m !== trimModel) { P.trim = false; P.fixDir = false; trimModel = null; ver++; syncUi(); return list; }      // 사진·모델이 바뀜 → 끔
        if (P.fixDir && fixActive()) list = fixList(list);                 // 결 맞추기 먼저, 그다음 잘라내기
        if (P.trim && trimActive()) list = trimList(list);
      }
    } catch (e) { S.err = String(e && e.message || e); }
    return list;
  };
  P._cams = function () { return getCams(); };   // (2026-10-21i) 34 다시 기르기 끝 자르기가 같은 사진·투영을 씀
  P._env = function () { return getEnv(); };
  P._sigTail = function () {   // adjFilterSig(17b) 끝
    try { return '|pc' + (P.on && (P.trim || P.fixDir) ? ver + (styleOn() ? 's' : ((P.trim ? (lengthened() ? 'l' : 't') : '') + (P.fixDir ? 'd' : ''))) : 0); } catch (e) { return ''; }
  };
  function redraw() {
    try { if (typeof ADJ_CACHE !== 'undefined' && ADJ_CACHE.bump) ADJ_CACHE.bump(); } catch (e) {}
    try { if (typeof currentScreen !== 'undefined' && currentScreen === 'adjust' && typeof renderAdjustFrame === 'function') renderAdjustFrame(); } catch (e) {}
  }
  P.setFixDir = function (v) {
    P.fixDir = (v == null) ? !P.fixDir : !!v; trimModel = (P.trim || P.fixDir) ? photoModel() : null; ver++;
    redraw(); syncUi();
    return P.fixDir;
  };
  P.setTrim = function (v) {
    P.trim = (v == null) ? !P.trim : !!v; trimModel = (P.trim || P.fixDir) ? photoModel() : null; ver++;
    redraw(); syncUi();
    return P.trim;
  };
  P.refresh = function () { ver++; redraw(); };

  /* ────────────────────────────────────────────────────────────────────────
   * (2026-10-08c) 진단 데이터 내보내기 — 영상과 진단 글만으로는 "어느 가닥이 왜 따로 노는가"를 짐작으로만 고칠 수 있었습니다
   *   (사용자: "뜬 머리가 아직 있고, 할 때마다 바뀌어"). 지금 이 손님의 머리 데이터를 파일 하나로 저장해 보내면, 같은 데이터를 그대로 돌려서 원인을 찾을 수 있습니다.
   *   담는 것: 두상 치수 · 다시 기른 가닥(점은 하나 걸러) · 마네킹 뿌리 · 지금 걸린 결 표 · 지금 화면에 그려진 가닥 · 사진별 카메라 값과 머리 영역·결(칸 단위) · 섹션/스타일링 값 · 빗질 획 수.
   *   안 담는 것: 사진 원본 · 얼굴(머리 영역의 윤곽과 결 방향만 칸 단위로 들어갑니다).
   *   형식: 'GYDBG1\n' + 머리말 길이(uint32 LE) + 머리말(JSON) + 묶음들(머리말의 parts에 자리·형식). 브라우저가 되면 gzip.
   * ────────────────────────────────────────────────────────────────────── */
  var QS = 8192;                               // 좌표 → int16 배율(±4 모델 단위)
  function q16(v) { v = Math.round(v * QS); return v < -32767 ? -32767 : v > 32767 ? 32767 : v; }
  function packStrands(list, stride, secIdx) {
    var n = list.length, cnt = new Uint16Array(n), sec = new Uint8Array(n), fl = new Uint8Array(n), tot = 0, i, k, p, m, keep;
    for (i = 0; i < n; i++) { p = list[i] && list[i].pts; m = p ? p.length : 0; keep = m ? (stride > 1 ? Math.floor((m - 1) / stride) + 1 + ((m - 1) % stride ? 1 : 0) : m) : 0; if (keep > 65535) keep = 65535; cnt[i] = keep; tot += keep; }
    var D = new Int16Array(tot * 3), o = 0, e, w;
    for (i = 0; i < n; i++) {
      e = list[i]; p = e && e.pts; if (!p) continue; m = p.length; w = 0;
      for (k = 0; k < m && w < cnt[i]; k += stride) { D[o++] = q16(p[k].x); D[o++] = q16(p[k].y); D[o++] = q16(p[k].z); w++; }
      if (w < cnt[i]) { D[o++] = q16(p[m - 1].x); D[o++] = q16(p[m - 1].y); D[o++] = q16(p[m - 1].z); w++; }      // 끝점은 꼭
      sec[i] = secIdx ? secIdx(e.sec) : 255; fl[i] = (e.mannequin ? 1 : 0) | (e.fringe ? 2 : 0) | (e.regrown ? 4 : 0);
    }
    return { cnt: cnt, sec: sec, fl: fl, D: D.subarray(0, o) };
  }
  P.buildExport = function () {
    var parts = [], bufs = [], off = 0, G = W.REGROW, FSx = W.FLOW_SPEC, C3 = W.COMB3D, env = getEnv(), cams = getCams();
    function add(name, arr, extra) { var u = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength); parts.push(Object.assign({ name: name, off: off, len: u.length, type: arr.constructor.name }, extra || {})); bufs.push(u); off += u.length; if (off % 2) { bufs.push(new Uint8Array(1)); off++; } }
    var order = []; try { order = SECTION_ORDER.slice(); } catch (e) {}
    function secIdx(s) { var i = order.indexOf(s); return i < 0 ? 255 : i; }
    var H = { magic: 'GYDBG', v: 1, at: new Date().toISOString(), ua: (typeof navigator !== 'undefined' ? navigator.userAgent : ''), qs: QS, env: env, sections: null, styling: null, order: order, notes: [] };
    try { H.sections = JSON.parse(JSON.stringify(state.sections)); H.styling = JSON.parse(JSON.stringify(state.stylingByView || state.styling || null)); H.fade = state.fade || null; H.view = state.currentViewAngle; } catch (e) {}
    try { H.mq = !!MANNEQUIN.on; H.specApplied = state.specAppliedId || null; H.curl = state._globalCurl; } catch (e) {}
    try { H.native = FSx && FSx.nativeState ? { id: FSx.nativeState.id, shaped: FSx.nativeState.shaped } : null; } catch (e) {}
    try { H.comb = C3 ? { samples: C3.samples.length, sweeps: C3.sweeps ? C3.sweeps.length : 0, level: C3.sweepLevel } : null; } catch (e) {}
    try { H.cfg = FSx ? JSON.parse(JSON.stringify(FSx, function (k, v) { return (typeof v === 'function' || k === 'stats' || k === '_core' || k === 'nativeState' || k === '_st') ? undefined : v; })) : null; } catch (e) {}
    try { H.pc = { trim: P.trim, fixDir: P.fixDir }; } catch (e) {}
    // 다시 기른 가닥(점은 하나 걸러)
    try { if (G && G.model && G.model.strands && G.model.strands.length) { var rg = packStrands(G.model.strands, 2, secIdx); add('rg.cnt', rg.cnt); add('rg.sec', rg.sec); add('rg.pts', rg.D, { stride: 2 }); H.regrown = { n: G.model.strands.length, on: !!G.on, CY: G.model.CY }; } else H.notes.push('다시 기른 모델 없음'); } catch (e) { H.notes.push('rg: ' + e.message); }
    // (2026-10-10a) 다시 기른 가닥마다 멈춘 이유·두피 위/밖 길이 등(42번 rg) + 걸음 기록(REGROW.trace를 켜고 기른 경우) + 사진에서 잰 뿌리 밀도
    try {
      if (G && G.model && G.model.strands && G.model.strands.length) {
        var ms = G.model.strands, nm = ms.length, STOP = { mask: 1, cap: 2, tip: 3, max: 4 }, MI = new Uint8Array(nm * 4), MF = new Float32Array(nm * 8), tr = [], trIdx = [], trLen = 0, j3, g3;
        for (j3 = 0; j3 < nm; j3++) {
          g3 = ms[j3] && ms[j3].rg; if (!g3) continue;
          MI[j3 * 4] = STOP[g3.stop] || 0; MI[j3 * 4 + 1] = g3.free ? 1 : 0; MI[j3 * 4 + 2] = g3.est0 | 0; MI[j3 * 4 + 3] = g3.trace ? 1 : 0;
          MF[j3 * 8] = g3.sOn || 0; MF[j3 * 8 + 1] = g3.sFree || 0; MF[j3 * 8 + 2] = g3.cap || 0; MF[j3 * 8 + 3] = g3.stp || 0;
          MF[j3 * 8 + 4] = g3.nEst || 0; MF[j3 * 8 + 5] = g3.nBack || 0; MF[j3 * 8 + 6] = g3.nNeck || 0; MF[j3 * 8 + 7] = typeof g3.den === 'number' ? g3.den : -1;
          if (g3.trace && trLen < 6e6) { tr.push(g3.trace); trIdx.push(j3, g3.trace.length); trLen += g3.trace.length; }
        }
        var MT = new Float32Array(nm), MP = new Uint8Array(nm); for (j3 = 0; j3 < nm; j3++) { g3 = ms[j3] && ms[j3].rg; if (!g3) continue; MT[j3] = typeof g3.t === 'number' ? g3.t : -1; MP[j3] = g3.flip | 0; }
        add('rg.mi', MI); add('rg.mf', MF); add('rg.t', MT); add('rg.flip', MP);
        H.rgMeta = { mi: 'stop(1영역밖 2길이상한 3끝높이 4걸음상한),free,est0,traced', mf: 'sOn,sFree,cap,stp,nEst,nBack,nNeck,den', t: '뿌리 자리 두께(모델 단위)', flip: '0 안 뒤집음 1 뒤집음 2 얇아서 안 뒤집음(아래 그대로) 3 얇아서 옆으로 눕힘', traced: tr.length,
          trace: '걸음마다 11값: 단계(0두피위 1두피밖 2곧게내림),결못읽음,쓴사진수,주로쓴사진(0..),결또렷함%,사진끼리벌어진각°,막음(1앞쏠림 2목),머리영역표,x,y,z' };
        if (tr.length) { var TA = new Float32Array(trLen), o3 = 0; tr.forEach(function (a) { TA.set(a, o3); o3 += a.length; }); add('rg.trace', TA); add('rg.traceIdx', new Uint32Array(trIdx)); }
        try { var cfgG = {}; Object.keys(G).forEach(function (k) { var v = G[k]; if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') cfgG[k] = v; }); H.regrowCfg = cfgG; } catch (e) {}
      }
      var ro = state._hair3Dneutral && state._hair3Dneutral.roots;
      if (ro && ro.den) { add('roots.den', new Float32Array(ro.den)); if (ro.est) add('roots.est', new Uint8Array(ro.est)); H.roots = { NT: ro.NT, NP: ro.NP, b: ro.b }; }
    } catch (e) { H.notes.push('rgMeta: ' + e.message); }
    // 지금 모델(마네킹이면 마네킹 뿌리) — 뿌리만
    try {
      var cur = state.hair3Dneutral;
      if (cur && cur.strands && cur.strands.length) {
        var nR = cur.strands.length, R = new Int16Array(nR * 3), rs = new Uint8Array(nR), rf = new Uint8Array(nR), i2, s2, p0;
        for (i2 = 0; i2 < nR; i2++) { s2 = cur.strands[i2]; p0 = s2 && s2.pts && s2.pts[0]; if (!p0) continue; R[i2 * 3] = q16(p0.x); R[i2 * 3 + 1] = q16(p0.y); R[i2 * 3 + 2] = q16(p0.z); rs[i2] = secIdx(s2.sec); rf[i2] = (s2.mannequin ? 1 : 0) | (s2.fringe ? 2 : 0) | (s2.regrown ? 4 : 0); }
        add('cur.root', R); add('cur.sec', rs); add('cur.fl', rf); H.current = { n: nR, mannequin: !!cur.mannequin, CY: cur.CY };
      }
    } catch (e) { H.notes.push('cur: ' + e.message); }
    // (2026-10-21) 34 결 읽기 단계 — 정렬 전 가닥(정렬 뒤는 위 rg.*)
    try {
      var RS0 = W.READ_STEPS && W.READ_STEPS.rg0;
      if (RS0 && RS0.length) {
        var lst0 = RS0.map(function (a) { if (!a) return null; var p = new Array(a.length / 3); for (var q = 0; q < p.length; q++) p[q] = { x: a[q * 3], y: a[q * 3 + 1], z: a[q * 3 + 2] }; return { pts: p }; });
        var r0 = packStrands(lst0, 2, null); add('rg0.cnt', r0.cnt); add('rg0.pts', r0.D, { stride: 2, note: '정렬 전(같은 순서 · rg.*와 짝)' });
        H.readSteps = { align: W.READ_STEPS.align, cfg: { bridge: W.READ_STEPS.bridge, fill: W.READ_STEPS.fill, localAlign: W.READ_STEPS.localAlign, lookPx: W.READ_STEPS.lookPx, resumePx: W.READ_STEPS.resumePx, tol: W.READ_STEPS.tol } };
      }
    } catch (e) { H.notes.push('rg0: ' + e.message); }
    // 지금 걸린 결 표
    try { var fl = FSx && FSx.active ? FSx.active() : null; if (fl && fl.d) { H.flow = { v: fl.v, cs: fl.cs, bin: fl.bin, lmax: fl.lmax, n: fl.n }; var enc = new TextEncoder().encode(fl.d); add('flow.d', enc, { enc: 'base64-text' }); } else H.notes.push('걸린 결 표 없음'); } catch (e) { H.notes.push('flow: ' + e.message); }
    // 이 손님의 다시 기른 가닥에서 뽑은 표(걸린 표와 다를 수 있음 — 다른 스타일이 걸려 있을 때)
    try { var fo = FSx && FSx.fromRegrown ? FSx.fromRegrown() : null; if (fo && fo.d && !(H.flow && fl && fo.d === fl.d)) { H.flowOwn = { v: fo.v, cs: fo.cs, bin: fo.bin, lmax: fo.lmax, n: fo.n }; add('flowOwn.d', new TextEncoder().encode(fo.d), { enc: 'base64-text' }); } else if (fo && fo.d) H.flowOwn = 'same'; } catch (e) { H.notes.push('flowOwn: ' + e.message); }
    try { var sp = (typeof getStyleSpec === 'function' && state.specAppliedId) ? getStyleSpec(state.specAppliedId) : null; if (sp) H.spec = { base: sp.base || null, flowBase: sp.flowBase || null, flowLen: sp.flowLen || null, tipAt: sp.tipAt || null, lenCm: sp.lenCm || null, styling: sp.styling || null, perm: sp.perm || null }; } catch (e) {}
    // 지금 화면에 그려진 가닥(빗질·맞추기·자르기까지 한 것)
    try { var list = computeAdjustedHair3DStrands(); if (list && list.length) { var dr = packStrands(list, 1, secIdx); add('draw.cnt', dr.cnt); add('draw.sec', dr.sec); add('draw.fl', dr.fl); add('draw.pts', dr.D); H.drawn = { n: list.length }; } } catch (e) { H.notes.push('draw: ' + e.message); }
    // 사진별 카메라 · 머리 영역 · 결(칸 단위)
    try {
      H.cams = [];
      cams.forEach(function (c, ci) {
        var cols = Math.max(40, (P.exportCols || P.cols) | 0), cell = c.iw / cols, gw = cols, gh = Math.max(1, Math.ceil(c.ih / cell)), M = new Uint8Array(gw * gh), A = new Int8Array(gw * gh), K = new Uint8Array(gw * gh), x, y, d;
        for (y = 0; y < gh; y++) for (x = 0; x < gw; x++) {
          if (c.smp.at((x + 0.5) * cell, (y + 0.5) * cell) > 0) M[y * gw + x] = 1;
          if (typeof c.dirAt === 'function') { d = c.dirAt((x + 0.5) * cell, (y + 0.5) * cell); if (d) { A[y * gw + x] = Math.max(-127, Math.min(127, Math.round(wrapHalf(d[0]) / HALF * 127))); K[y * gw + x] = Math.max(0, Math.min(255, Math.round(d[1] * 255))); } }
        }
        H.cams.push({ angle: c.angle, R: Array.prototype.slice.call(c.R), cx: c.cx, s: c.s, sy: c.sy, crownY: c.crownY, iw: c.iw, ih: c.ih, gw: gw, gh: gh, cell: cell, hasDir: typeof c.dirAt === 'function' });
        add('cam' + ci + '.mask', M); add('cam' + ci + '.ang', A, { scale: 'x/127*90deg' }); add('cam' + ci + '.coh', K, { scale: 'x/255' });
        // (2026-10-21) 34 결 읽기 단계 스냅샷 — 읽은 그대로(건너기·채우기 전)와 고친 표시. 각도는 04 이미지 좌표(y 아래) 그대로라 위 .ang와 부호가 반대일 수 있음(angRawConv)
        try {
          var RSb = W.READ_STEPS && W.READ_STEPS.byView && W.READ_STEPS.byView[c.angle];
          if (RSb && RSb.raw) {
            var AR = new Int8Array(gw * gh), KR = new Uint8Array(gw * gh), ER = new Uint8Array(gw * gh), kx2 = RSb.w / c.iw, ky2 = RSb.h / c.ih, xi2, yi2, j4;
            for (y = 0; y < gh; y++) for (x = 0; x < gw; x++) {
              xi2 = Math.min(RSb.w - 1, Math.floor((x + 0.5) * cell * kx2)); yi2 = Math.min(RSb.h - 1, Math.floor((y + 0.5) * cell * ky2)); j4 = yi2 * RSb.w + xi2;
              AR[y * gw + x] = RSb.raw[j4]; KR[y * gw + x] = RSb.coh[j4]; ER[y * gw + x] = RSb.est[j4];
            }
            add('cam' + ci + '.angRaw', AR, { scale: 'x/127*90deg', conv: '04 이미지 좌표(y 아래)' }); add('cam' + ci + '.cohRaw', KR, { scale: 'x/255' }); add('cam' + ci + '.est', ER, { values: '0 읽음 1 건넘 2 채움' });
            H.cams[H.cams.length - 1].readSteps = RSb.stats;
            // (2026-10-21e) 두 방식 나란히 — 구조텐서 vs 방향필터(방향 · 또렷함), 각도는 04 이미지 좌표(y 아래)
            if (RSb.cmp && !RSb.cmp.err) {
              var cmpS = Object.assign({}, RSb.cmp); delete cmpS.snap; H.cams[H.cams.length - 1].compare = cmpS;
              var SN = RSb.cmp.snap;
              if (SN) {
                var kx3 = SN.w / c.iw, ky3 = SN.h / c.ih, aS = new Int8Array(gw * gh), aG = new Int8Array(gw * gh), kS = new Uint8Array(gw * gh), kG = new Uint8Array(gw * gh), j5;
                for (y = 0; y < gh; y++) for (x = 0; x < gw; x++) {
                  j5 = Math.min(SN.h - 1, Math.floor((y + 0.5) * cell * ky3)) * SN.w + Math.min(SN.w - 1, Math.floor((x + 0.5) * cell * kx3));
                  aS[y * gw + x] = SN.angST[j5]; kS[y * gw + x] = SN.cohST[j5]; if (SN.angGB) aG[y * gw + x] = SN.angGB[j5]; if (SN.cohGB) kG[y * gw + x] = SN.cohGB[j5];
                }
                add('cam' + ci + '.angST', aS, { scale: 'x/127*90deg', conv: '04 이미지 좌표(y 아래)' }); add('cam' + ci + '.cohST', kS, { scale: 'x/255' });
                if (SN.angGB) { add('cam' + ci + '.angGB', aG, { scale: 'x/127*90deg', conv: '04 이미지 좌표(y 아래)' }); add('cam' + ci + '.cohGB', kG, { scale: 'x/255 · 필터 반응 대비' }); }
              }
            }
          }
        } catch (e) { H.notes.push('readSteps cam' + ci + ': ' + e.message); }
      });
    } catch (e) { H.notes.push('cams: ' + e.message); }
    H.parts = parts;
    var hj = new TextEncoder().encode(JSON.stringify(H)), pad = (4 - (7 + 4 + hj.length) % 4) % 4, head = new Uint8Array(7 + 4 + hj.length + pad), total = head.length + off;
    head.set(new TextEncoder().encode('GYDBG1\n'), 0); new DataView(head.buffer).setUint32(7, hj.length + pad, true); head.set(hj, 11);
    for (var z = 0; z < pad; z++) head[11 + hj.length + z] = 32;
    var out = new Uint8Array(total), o2 = head.length; out.set(head, 0);
    bufs.forEach(function (b) { out.set(b, o2); o2 += b.length; });
    return { bytes: out, header: H };
  };
  /* 파일로 저장(되면 gzip) — 돌려주는 값: Promise<{name, size, gz}> */
  P.exportData = function () {
    var ex = P.buildExport(), d = new Date(), pad2 = function (v) { return (v < 10 ? '0' : '') + v; };
    var base = 'gyeol-debug-' + d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + '-' + pad2(d.getHours()) + pad2(d.getMinutes());
    function save(blob, name, gz) {
      var a = document.createElement('a'), url = URL.createObjectURL(blob);
      a.href = url; a.download = name; a.style.display = 'none'; document.body.appendChild(a); a.click();
      setTimeout(function () { try { document.body.removeChild(a); URL.revokeObjectURL(url); } catch (e) {} }, 4000);
      var info = { name: name, size: blob.size, gz: gz };
      console.log(TAG + ' 진단 데이터 저장 — ' + name + ' · ' + (blob.size / 1048576).toFixed(1) + 'MB · 다시 기른 가닥 ' + (ex.header.regrown ? ex.header.regrown.n : 0) + ' · 그려진 가닥 ' + (ex.header.drawn ? ex.header.drawn.n : 0) + ' · 사진 ' + (ex.header.cams ? ex.header.cams.length : 0) + '장' + (ex.header.notes.length ? ' · ⚠ ' + ex.header.notes.join(' / ') : ''));
      try { if (typeof showToast === 'function') showToast(T('저장했습니다: ' + name + ' (' + (blob.size / 1048576).toFixed(1) + 'MB) — 내려받기 폴더에서 이 파일을 보내 주세요', 'Saved: ' + name + ' (' + (blob.size / 1048576).toFixed(1) + 'MB) — send this file from your Downloads folder')); } catch (e) {}
      return info;
    }
    try {
      if (typeof CompressionStream === 'function') {
        var cs = new Blob([ex.bytes]).stream().pipeThrough(new CompressionStream('gzip'));
        return new Response(cs).blob().then(function (b) { return save(new Blob([b], { type: 'application/octet-stream' }), base + '.gydbg.gz', true); },
          function () { return save(new Blob([ex.bytes], { type: 'application/octet-stream' }), base + '.gydbg', false); });
      }
    } catch (e) {}
    return Promise.resolve(save(new Blob([ex.bytes], { type: 'application/octet-stream' }), base + '.gydbg', false));
  };

  /* ── 화면 ── */
  var btn = null, panel = null, imgCache = {};
  function lang() { try { return uiLang === 'ko' ? 'ko' : 'en'; } catch (e) { return 'ko'; } }
  function T(ko, en) { return lang() === 'ko' ? ko : en; }
  function syncUi() {
    try {
      if (btn) btn.style.display = (P.on && getCams().length) ? '' : 'none';
      if (panel) { var b = panel.querySelector('#pcTrimBtn'); if (b) { b.textContent = P.trim ? T('윤곽 밖 잘라내기 ON', 'Trim outside outline ON') : T('윤곽 밖 잘라내기 OFF', 'Trim outside outline OFF'); b.style.background = P.trim ? '#c9874a' : '#3a322b'; }
        var d = panel.querySelector('#pcDirBtn'); if (d) { d.textContent = P.fixDir ? T('결 맞추기 ON', 'Match grain ON') : T('결 맞추기 OFF', 'Match grain OFF'); d.style.background = P.fixDir ? '#c9874a' : '#3a322b'; } }
    } catch (e) {}
  }
  function loadImg(angle, cb) {
    var src = null; try { src = state.shots && state.shots[angle]; } catch (e) {}
    if (!src || typeof src !== 'string') return cb(null);
    var c = imgCache[angle]; if (c && c.src === src) return cb(c.img);
    var im = new Image(); im.onload = function () { imgCache[angle] = { src: src, img: im }; cb(im); }; im.onerror = function () { cb(null); }; im.src = src;
  }
  function drawView(cv, v, cam) {
    // 머리가 있는 자리만 잘라서 크게(사진·3D 머리를 합친 범위 + 여유)
    var x, y, k, bx0 = v.gw, by0 = v.gh, bx1 = -1, by1 = -1;
    for (y = 0; y < v.gh; y++) for (x = 0; x < v.gw; x++) if (v.M[y * v.gw + x] || v.H[y * v.gw + x]) { if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
    if (bx1 < 0) { bx0 = 0; by0 = 0; bx1 = v.gw - 1; by1 = v.gh - 1; }
    var mg = Math.max(4, Math.round(0.08 * Math.max(bx1 - bx0, by1 - by0)));
    bx0 = Math.max(0, bx0 - mg); by0 = Math.max(0, by0 - mg); bx1 = Math.min(v.gw - 1, bx1 + mg); by1 = Math.min(v.gh - 1, by1 + mg);
    var bw = bx1 - bx0 + 1, bh = by1 - by0 + 1, W0 = 360, sc = W0 / bw, Hh = Math.round(bh * sc);
    cv.width = W0; cv.height = Hh; cv.style.width = '100%';
    var g = cv.getContext('2d');
    function cellRect(cx, cy) { g.fillRect((cx - bx0) * sc, (cy - by0) * sc, sc + 0.5, sc + 0.5); }
    function overlay(hasImg) {
      if (!hasImg) { g.fillStyle = '#2b2622'; g.fillRect(0, 0, W0, Hh); g.fillStyle = '#8d8478'; for (y = by0; y <= by1; y++) for (x = bx0; x <= bx1; x++) if (v.M[y * v.gw + x]) cellRect(x, y); }
      else { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, W0, Hh); }
      for (y = by0; y <= by1; y++) for (x = bx0; x <= bx1; x++) {
        k = y * v.gw + x;
        if (v.dir && v.dir.MIS[k]) { g.fillStyle = 'rgba(255,214,60,0.85)'; cellRect(x, y); }
        else if (v.over[k]) { g.fillStyle = 'rgba(235,60,50,0.85)'; cellRect(x, y); }
        else if (v.under[k]) { g.fillStyle = 'rgba(50,130,245,0.80)'; cellRect(x, y); }
        else if (v.H[k] && !v.M[k]) { g.fillStyle = 'rgba(235,60,50,0.25)'; cellRect(x, y); }      // 여유 안쪽의 넘침(옅게)
        else if (v.H[k] && v.M[k] && ((x > 0 && !v.H[k - 1]) || (x < v.gw - 1 && !v.H[k + 1]) || (y > 0 && !v.H[k - v.gw]) || (y < v.gh - 1 && !v.H[k + v.gw]))) { g.fillStyle = 'rgba(255,255,255,0.55)'; cellRect(x, y); }   // 3D 윤곽선
      }
    }
    loadImg(v.angle, function (im) {
      var ok = false;
      try {
        if (im && cam && Math.abs((im.naturalWidth / im.naturalHeight) / (cam.iw / cam.ih) - 1) < 0.03) {
          var kx = im.naturalWidth / v.gw, ky = im.naturalHeight / (cam.ih / v.cell);
          g.drawImage(im, bx0 * kx, by0 * ky, bw * kx, bh * ky, 0, 0, W0, Hh); ok = true;
        }
      } catch (e) { ok = false; }
      overlay(ok);
    });
  }
  function render() {
    if (!panel) return;
    var body = panel.querySelector('#pcBody'), head = panel.querySelector('#pcHead'), res = P.run(), cams = getCams();
    body.innerHTML = '';
    if (!res) { head.textContent = TAG + ' ' + (S.err || ''); return; }
    var worst = res.slice().sort(function (a, b) { return (b.overPct + b.underPct) - (a.overPct + a.underPct); })[0];
    var avg = res.reduce(function (s, v) { return s + v.iou; }, 0) / res.length;
    head.textContent = T('사진 ' + res.length + '장 평균 겹침 ' + Math.round(avg * 100) + '% · 가장 다른 사진: ' + nameOf(worst.angle) + (S.style ? ' · ⚠ 스타일이 걸려 있어 원본과 다른 것이 당연합니다' : '') + (P.trim && S.trimWhy ? ' · 잘라내기 쉼(' + S.trimWhy + ')' : '') + (P.fixDir && !S.fixWhy ? ' · 결 맞추기로 돌린 가닥 ' + S.fixStr + '개' : '') + (P.fixDir && S.fixWhy ? ' · 결 맞추기 쉼(' + S.fixWhy + ')' : ''),
      res.length + ' photos · mean overlap ' + Math.round(avg * 100) + '% · most different: ' + worst.angle + (S.style ? ' · ⚠ a style is applied' : ''));
    res.forEach(function (v) {
      var card = document.createElement('div'); card.style.cssText = 'background:#1f1b18;border-radius:8px;padding:6px;';
      var cv = document.createElement('canvas'); cv.style.cssText = 'display:block;border-radius:5px;';
      var cap = document.createElement('div'); cap.style.cssText = 'font-size:11px;line-height:1.45;color:#e8dfd2;margin-top:5px;';
      var e = v.ext;
      cap.innerHTML = '<b>' + nameOf(v.angle) + '</b> · ' + T('겹침', 'overlap') + ' ' + Math.round(v.iou * 100) + '%<br><span style="color:#ff8a80">' + T('넘침', 'over') + ' ' + (v.overPct * 100).toFixed(1) + '%</span> · <span style="color:#8ab4ff">' + T('빔', 'missing') + ' ' + (v.underPct * 100).toFixed(1) + '%</span>' +
        (v.dir ? '<br><span style="color:#ffd63c">' + T('결 어긋난 뭉치', 'grain off') + ' ' + (v.dir.compared ? (v.dir.off / v.dir.compared * 100).toFixed(1) : '0') + '%</span> <span style="color:#9d9284">(' + T('비교한 칸', 'cells compared') + ' ' + v.dir.compared + ')</span>' : '') +
        (e ? '<br>' + T('위', 'top') + ' ' + f1(e.top) + ' · ' + T('아래', 'bottom') + ' ' + (e.bottom == null ? '–' : f1(e.bottom)) + ' · ' + T('좌', 'L') + ' ' + f1(e.left) + ' · ' + T('우', 'R') + ' ' + f1(e.right) + ' cm' : '');
      card.appendChild(cv); card.appendChild(cap); body.appendChild(card);
      drawView(cv, v, cams.filter(function (c) { return c.angle === v.angle; })[0]);
    });
    syncUi();
  }
  P.open = function () {
    if (!panel) {
      panel = document.createElement('div'); panel.id = 'photoCheckPanel';
      panel.style.cssText = 'position:fixed;inset:0;z-index:9000;background:rgba(10,8,7,0.88);overflow:auto;padding:12px;box-sizing:border-box;font-family:inherit;';
      panel.innerHTML = '<div style="max-width:1180px;margin:0 auto;">' +
        '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:8px;">' +
        '<b style="color:#f3e9da;font-size:15px;">' + T('원본 대조', 'Compare with photos') + '</b>' +
        '<span style="font-size:12px;color:#d8cdbd;"><span style="color:#ff8a80">■</span> ' + T('넘침 — 3D에만 있는 머리', 'over — hair only in 3D') + ' &nbsp;<span style="color:#8ab4ff">■</span> ' + T('빔 — 사진에만 있는 머리', 'missing — hair only in photo') + ' &nbsp;<span style="color:#ffd63c">■</span> ' + T('결 어긋남 — 사진과 방향이 ' + P.dirWarn + '° 넘게 다른 뭉치', 'grain off by more than ' + P.dirWarn + '°') + ' &nbsp;<span style="color:#fff">▯</span> ' + T('3D 윤곽선', '3D outline') + ' · ' + T('좌/우는 사진에서 본 방향 · +는 3D가 더 나감', 'L/R as seen in the photo · + = 3D sticks out') + '</span>' +
        '<span style="flex:1"></span>' +
        '<button id="pcExportBtn" type="button" style="border:0;border-radius:6px;padding:7px 10px;background:#2f4a66;color:#fff;font-size:12px;cursor:pointer;">' + T('진단 데이터 저장', 'Save debug data') + '</button>' +
        '<button id="pcDirBtn" type="button" style="border:0;border-radius:6px;padding:7px 10px;color:#fff;font-size:12px;cursor:pointer;"></button>' +
        '<button id="pcTrimBtn" type="button" style="border:0;border-radius:6px;padding:7px 10px;color:#fff;font-size:12px;cursor:pointer;"></button>' +
        '<button id="pcAgainBtn" type="button" style="border:0;border-radius:6px;padding:7px 10px;background:#3a322b;color:#fff;font-size:12px;cursor:pointer;">' + T('다시 대조', 'Re-run') + '</button>' +
        '<button id="pcCloseBtn" type="button" style="border:0;border-radius:6px;padding:7px 12px;background:#6b5d50;color:#fff;font-size:12px;cursor:pointer;">' + T('닫기', 'Close') + '</button>' +
        '</div><div id="pcHead" style="font-size:12px;color:#f0c9a0;margin-bottom:8px;"></div>' +
        '<div id="pcBody" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px;"></div></div>';
      document.body.appendChild(panel);
      panel.querySelector('#pcCloseBtn').addEventListener('click', function () { P.close(); });
      panel.querySelector('#pcAgainBtn').addEventListener('click', function () { render(); });
      panel.querySelector('#pcTrimBtn').addEventListener('click', function () { P.setTrim(); render(); });
      panel.querySelector('#pcDirBtn').addEventListener('click', function () { P.setFixDir(); render(); });
      panel.querySelector('#pcExportBtn').addEventListener('click', function () { var b = this; b.disabled = true; b.textContent = T('저장하는 중…', 'Saving…'); Promise.resolve().then(function () { return P.exportData(); }).then(function () {}, function (e) { console.warn(TAG + ' 진단 데이터 저장 실패', e); }).then(function () { b.disabled = false; b.textContent = T('진단 데이터 저장', 'Save debug data'); }); });
    }
    panel.style.display = 'block';
    render();
  };
  P.close = function () { if (panel) panel.style.display = 'none'; };
  try {
    var bar = document.querySelector('#screen-adjust .mode-bar'), mq = document.getElementById('mannequinBtn');
    if (bar) {
      btn = document.createElement('button'); btn.id = 'photoCheckBtn'; btn.type = 'button';
      if (mq && mq.className) btn.className = mq.className;
      btn.textContent = '원본 대조'; btn.title = '지금 화면의 머리를 원본 사진의 머리 윤곽과 겹쳐 봅니다';
      btn.addEventListener('click', function () { P.open(); });
      bar.appendChild(btn); syncUi();
    }
  } catch (e) { console.warn(TAG + ' 버튼 만들기 실패', e); }
  // 영어 표('원본 대조' 등)는 22-ui-i18n-extra.js
  P._syncUi = function () { try { syncUi(); } catch (e) {} };   // renderAdjustFrame(07b) 끝
  P._afterActivate = function (name) { try { if (name !== 'adjust') P.close(); syncUi(); } catch (e) {} };   // activateScreen(05) 끝

  console.log(TAG + ' 설치 — 조정 화면의 [원본 대조]: 지금 머리를 사진의 머리 윤곽과 겹쳐 넘침(빨강)·빔(파랑)을 보여 줍니다. 결이 사진과 크게 다른 뭉치는 노랑. 콘솔에서 PHOTO_CHECK.run() · 결 맞추기 PHOTO_CHECK.setFixDir(true) · 윤곽 밖 잘라내기 PHOTO_CHECK.setTrim(true)');
  return P;
})();
