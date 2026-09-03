/* ══════════════════════════════════════════════════════════
   03b-mask-memory.js — 스크래치 캔버스 풀 · 모바일 메모리 대응
   원본 index.html 6512~7832행. 클래식 스크립트이므로 로드 순서가 곧
   실행 순서다 — index.html의 <script src> 순서를 바꾸지 말 것.
   ══════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════════
   모바일 2차 (2026-08-23) — <b>얼어붙는 건 고쳐졌고, 이번엔 메모리다</b>
   ─────────────────────────────────────────────────────────────────
   사용자(갤럭시 A15): "노트북에서는 괜찮았는데 폰에서 <b>버벅대고 다운</b>된다."
   8/22 대비 무엇이 달라졌는지부터 쟀다(205초 화면녹화, 가변프레임이라 프레임
   자체가 화면 갱신 신호 — 8/22와 같은 방법):
     · <b>3초짜리 정지가 사라졌다</b>. 최대 공백 0.52초(대부분은 화면이 안 변하는
       유휴 구간에서 녹화기가 0.5초마다 한 장 넣는 것). 8/22의 3.4~4.6초 정지는
       ADJ_CACHE·MINI3D·RENDER_MATCH로 실제로 걷혔다.
     · 대신 <b>새 낭비</b>가 보인다 — 42~63초 구간에서 화면이 <b>초당 60회</b>
       갱신되는데 미니3D 패널 픽셀 변화량이 0.04(잡음 수준)다. 22초 동안
       <b>똑같은 그림을 3,600번</b> 그렸다. 자동회전을 끈 뒤(=손가락으로 한 번
       돌린 뒤)에도 rAF 루프가 renderer.render를 계속 부르고 있다.
   그리고 "다운"은 속도가 아니라 메모리다. 진단 패널 실측:
     JS힙 141MB · 풀 59.4MB · 조정캐시 43MB
   그런데 <b>이 셋을 다 더해도 실제 사용량이 아니다</b> — 아래 memCensus 참고.

   ── 왜 계측부터인가 (작업원칙 1·2) ────────────────────────────────
   8/22에 "캔버스 카운터가 정작 위험한 것을 안 세고 있었다"를 고쳤는데,
   고친 카운터도 <b>여전히 절반만</b> 센다. CANVAS_POOL.made는 scratchCanvas와
   손으로 made++를 적어 준 자리만 세고, state.hairCanvases / baseCanvases /
   baseFillCanvases / _cleanBase / reasonCanvas 처럼 <b>뷰당 여러 장을 계속
   들고 있는</b> 캔버스는 한 장도 안 센다. 화면에 "풀 59.4MB"만 뜨니 정작 제일
   큰 덩어리를 안 보고 59MB를 깎을 궁리를 하게 된다 — 이 파일이 반복해서
   당한 "재는 자가 틀렸다"와 같은 모양이다.
   그래서 <b>깎기 전에</b> 전수 회계를 만든다. 어디가 큰지 보고 나서 깎는다.

   되돌리기: MOBILE_PERF의 각 스위치를 false로 (전부 예전 동작)
══════════════════════════════════════════════════════════════════ */
const MOBILE_PERF = {
  loopGate:     true,   // ① 안 보이는 three.js 루프는 render를 건너뛴다
  miniDirty:    true,   // ② 미니3D는 <b>바뀔 때만</b> 그린다(자동회전 중엔 매 프레임)
  sizeSkipSame: true,   // ③ 크기가 같으면 canvas.width 대입을 안 한다(백킹스토어 재할당 방지)
  probeCache:   true,   // ④ 실루엣 프로브는 중립 모델에만 의존 → 뷰별 캐시
  gateSecDist:  true,   // ⑤ 섹션분포 집계를 <b>찍을 때만</b> 계산
  trimOnLeave:  true,   // ⑥ 조정화면을 벗어나거나 탭이 숨으면 스크래치 풀을 돌려준다
  lowMem:       null,   // ⑦ null이면 자동판정(navigator.deviceMemory ≤ 4GB)
  trimDerived:  true,   // ⑧ 안 보는 뷰의 <b>파생</b> 캔버스를 반납한다(아래 trimDerivedCanvases)
};
/* ── 뷰 캔버스 만들기 스위치 (2026-08-23 5차) ── */
const HAIR_VIEW_BUILD = {
  scaleOnComposite: true,  // 마스크를 합성하면서 확대(중간 사본 fullMaskC를 안 만든다)
};
/* 실루엣 프로브 캐시 — 값 두 개짜리 항목이라 메모리는 사실상 0이다.
   쓰는 자리는 projectHair3DToView 1패스(거기 주석에 근거를 적어 뒀다). */
const PROBE_CACHE = { max: 12, hits: 0, misses: 0, map: new Map() };
/* 저사양 판정 — <b>한 번만</b> 재고 기억한다. deviceMemory는 크롬 계열에만 있고
   4를 넘게는 안 알려주는 브라우저도 있으므로, 없으면 "저사양 아님"으로 둔다
   (모르는 건 안 건드린다 — 작업원칙 1). */
let _lowMemCache = null;
function isLowMemDevice(){
  if(MOBILE_PERF.lowMem !== null) return !!MOBILE_PERF.lowMem;
  if(_lowMemCache !== null) return _lowMemCache;
  let low = false;
  try{
    const dm = navigator.deviceMemory;                    // GB (크롬 계열)
    if(typeof dm === 'number' && dm > 0 && dm <= 4) low = true;
    if(!low && typeof navigator.hardwareConcurrency === 'number'
       && navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 4) low = true;
  }catch(e){}
  _lowMemCache = low;
  return low;
}

/* ── 전수 회계 ───────────────────────────────────────────────────
   "지금 이 탭이 쥐고 있는 픽셀"을 한 곳에서 센다. 추정이 아니라 실제로 살아
   있는 개체의 width×height×4를 더한다(타입배열은 byteLength 그대로).
   ⚠ 이건 <b>재는 함수</b>다 — 여기서 아무것도 지우지 않는다. */
function canvasMB(c){
  try{ return (c && c.width > 0 && c.height > 0) ? c.width * c.height * 4 / 1048576 : 0; }
  catch(e){ return 0; }
}
function typedMB(a){
  try{ return (a && a.byteLength) ? a.byteLength / 1048576 : 0; }catch(e){ return 0; }
}
/* ── 스크래치를 <b>돌려준다</b> (2026-08-23) ────────────────────────────────
   풀의 규칙이 이미 "호출부가 들고 있으면 못 쓴다"이므로, 풀 안의 캔버스는
   정의상 <b>지금 아무도 안 보고 있다</b>. 그래서 화면을 벗어나는 순간 통째로
   백킹스토어를 돌려줘도 안전하다(다음에 scratchCanvas가 부르면 다시 잡는다).
   실측 59.4MB가 조정화면을 떠난 뒤에도 계속 잡혀 있었고, 그 상태로 3D 결과보기가
   WebGL 텍스처를 요구하면 크롬이 <b>캔버스 백킹스토어를 회수</b>한다 — 8/22
   세 번째 녹화에서 "모든 캔버스가 백지"가 됐던 그 증상이다.
   ⚠ 개체는 남기고 크기만 0으로 만든다. 풀 Map에서 지워 버리면 다음 호출이
     createElement로 <b>새 개체</b>를 만들어 "새로" 카운터가 계속 오르고,
     그러면 그 카운터가 뜻하는 바("아직 프레임마다 새로 만드는 자리가 있다")가
     오염된다 — 재는 자를 다시 망가뜨리는 셈이다.
   클립캐시 결과 캔버스도 같이 돌려준다(뷰가 바뀌면 어차피 서명이 안 맞는다).
   되돌리기: MOBILE_PERF.trimOnLeave = false */
/* ── 안 보는 뷰의 <b>파생</b> 캔버스 반납 (2026-08-23 5차) ─────────────
   카메라 사진으로 실측하니 ▣ 보관이 <b>89MB → 133MB</b>로 계속 늘었다.
   원본(hairC·baseC)이 아니라 뷰를 옮길 때마다 구워지는 <b>파생</b> 두 장이
   4뷰치 쌓인 것이다:
     · baseC._cleanBase        — buildCleanBaseCanvas(baseC, maskInf)
     · state.baseFillCanvases[a] — buildHoleFillCanvas(baseC, ...)
   둘 다 baseC와 maskInf에서 <b>결정적으로</b> 다시 만들어진다. 즉 버려도
   되찾을 수 없는 것이 없다 — 되찾는 값이 아니라 되찾는 <b>시간</b>만 든다.
   지금 보는 뷰의 것은 남긴다(그 뷰를 그리는 중이므로 버리면 바로 다시 굽는다).

   ⚠ 원본 hairC·baseC는 <b>안 건드린다</b>. 그건 extractHairMask 전체(세그멘테이션
     포함)를 다시 돌려야 나오는 것이라 성격이 다르다.
   ⚠ 뷰를 왔다 갔다 하면 그때마다 한 번씩 다시 굽는다. buildHoleFillCanvas는
     160px에서 만들어 확대하는 값이라 싸고, buildCleanBaseCanvas는 baseC 크기의
     루프 한 번이다 — 뷰 전환이 이미 느리지 않으니 감당 가능하다고 봤다.
     체감이 나빠지면 MOBILE_PERF.trimDerived = false 로 되돌린다. */
function trimDerivedCanvases(keepAngle, why){
  if(!MOBILE_PERF.trimDerived) return 0;
  let freed = 0;
  try{
    for(const a of ANGLES){
      if(a === keepAngle) continue;
      const bc = state.baseCanvases && state.baseCanvases[a];
      if(bc && bc._cleanBase && bc._cleanBase !== bc){
        freed += canvasMB(bc._cleanBase);
        try{ bc._cleanBase.width = 0; bc._cleanBase.height = 0; }catch(e){}
        bc._cleanBase = null;
      }
      const fc = state.baseFillCanvases && state.baseFillCanvases[a];
      if(fc){
        freed += canvasMB(fc);
        try{ fc.width = 0; fc.height = 0; }catch(e){}
        state.baseFillCanvases[a] = null;
      }
      /* 마스크 보기를 껐다 켠 뒤 남은 진단 캔버스도 같이 — 재료(reasonMask)는 남는다. */
      const mi = state.hairMasks && state.hairMasks[a];
      if(mi && mi.reasonCanvas){
        freed += canvasMB(mi.reasonCanvas);
        try{ mi.reasonCanvas.width = 0; mi.reasonCanvas.height = 0; }catch(e){}
        mi.reasonCanvas = null;
      }
    }
  }catch(e){}
  if(freed > 1) console.log('[메모리] 파생 캔버스 ' + freed.toFixed(0) + 'MB 반납 ('
    + (why||'') + ', ' + keepAngle + ' 유지)');
  return freed;
}
function trimScratchMemory(why){
  if(!MOBILE_PERF.trimOnLeave) return 0;
  let freed = 0;
  try{
    CANVAS_POOL._pool.forEach(c=>{
      freed += canvasMB(c);
      try{ c.width = 0; c.height = 0; }catch(e){}
    });
  }catch(e){}
  try{
    if(CLIP_MASK_CACHE.canvas){
      freed += canvasMB(CLIP_MASK_CACHE.canvas);
      CLIP_MASK_CACHE.canvas.width = 0; CLIP_MASK_CACHE.canvas.height = 0;
      CLIP_MASK_CACHE.sig = '';                       // 크기가 0이면 캐시 히트도 안 되게
    }
  }catch(e){}
  if(freed > 1) console.log('[메모리] 스크래치 ' + freed.toFixed(0) + 'MB 반납 (' + (why||'') + ')');
  return freed;
}
function memCensus(){
  const r = { views: 0, viewsN: 0, derived: 0, buffers: 0, photos: 0, photosN: 0,
              pool: 0, clip: 0, adj: 0, total: 0 };
  try{
    for(const a of ANGLES){
      const hc = state.hairCanvases && state.hairCanvases[a];
      const bc = state.baseCanvases && state.baseCanvases[a];
      const fc = state.baseFillCanvases && state.baseFillCanvases[a];
      const mi = state.hairMasks && state.hairMasks[a];
      /* 원본과 <b>파생</b>을 나눠 센다 (2026-08-23 5차).
         카메라 사진에서 보관이 89→133MB로 늘었을 때, 늘어난 44MB가 원본인지
         파생인지 합계만 봐서는 못 갈랐다. 파생은 trimDerivedCanvases가 버릴
         수 있는 몫이라, 그 수가 따로 보여야 트림이 먹었는지 알 수 있다. */
      const orig  = canvasMB(hc) + canvasMB(bc);
      const deriv = canvasMB(fc)
                  + ((bc && bc._cleanBase && bc._cleanBase !== bc) ? canvasMB(bc._cleanBase) : 0)
                  + canvasMB(mi && mi.reasonCanvas);
      const each = orig + deriv;
      if(each > 0) r.viewsN++;
      r.views += each;
      r.derived += deriv;
      if(mi){
        r.buffers += typedMB(mi.photoRGB) + typedMB(mi.personMask) + typedMB(mi.reasonMask)
                   + typedMB(mi.scalpY) + typedMB(mi.hairEndY);
      }
      /* 사진은 두 벌로 존재한다 — dataURL <b>문자열</b>과 디코드된 이미지.
         문자열은 JS엔진이 2바이트/글자로 잡을 수 있어 상한으로 센다.
         디코드본은 imgCache가 들고 있고 크기는 naturalWidth×4바이트다. */
      const url = state.shots && state.shots[a];
      if(url){ r.photos += url.length * 2 / 1048576; r.photosN++; }
      try{
        const im = (typeof imgCache !== 'undefined') && imgCache[a];
        if(im && im.naturalWidth) r.photos += im.naturalWidth * im.naturalHeight * 4 / 1048576;
      }catch(e){}
    }
  }catch(e){}
  r.pool = canvasPoolMB();
  try{ r.clip = canvasMB(CLIP_MASK_CACHE && CLIP_MASK_CACHE.canvas); }catch(e){}
  try{ r.adj  = adjCacheMB(); }catch(e){}
  r.total = r.views + r.buffers + r.photos + r.pool + r.clip + r.adj;
  return r;
}

/* ── 결과 캔버스 합성 (2026-08-02 분리) ─────────────────────────────
   extractHairMask STEP 11의 앞쪽 절반. 마스크/진단/헤어/베이스 네 캔버스를
   만든다. 뒤쪽 절반이던 "색 실측"은 역할이 달라 measureHairColorsFromMask로
   따로 뺐다 — 캔버스는 그리기용이고 색은 재기용이라, 한 함수가 둘 다 하면
   어느 쪽을 고치든 나머지를 같이 읽어야 했다. */
function buildHairViewCanvases(img, hairMaskBuf, reasonMask, w, h){
const maskC = document.createElement('canvas');
maskC.width=w; maskC.height=h;
const mCtx = maskC.getContext('2d');
const mImg = mCtx.createImageData(w,h);
for(let i=0;i<w*h;i++){
  mImg.data[i*4]=mImg.data[i*4+1]=mImg.data[i*4+2]=255;
  mImg.data[i*4+3]=hairMaskBuf[i];
}
mCtx.putImageData(mImg,0,0);


/* (2026-08-23 5차) 예전엔 maskC를 사진 크기로 확대한 사본(fullMaskC)을 한 장
   더 만들어 두고 그걸 두 번 합성했다. drawImage가 <b>합성하면서</b> 확대할 수
   있으므로 그 중간 사본이 필요 없다 — 1200×1600이면 한 뷰당 7.7MB짜리 임시
   캔버스가 두 번(hairC·baseC)의 재료로만 쓰이고 버려지고 있었다.
   ※ 결과는 같다: 두 경우 다 같은 배율로 bilinear 확대되어 destination-in/out에
     들어간다. 다른 점은 중간 캔버스에서 8비트로 한 번 더 반올림하느냐뿐이라
     알파 경계에서 1/255 차이가 날 수 있다 — 눈으로 확인할 것.
   되돌리기: HAIR_VIEW_BUILD.scaleOnComposite = false */

// ── hairCanvas: 원본에서 hair 마스크 영역만 ──
// (2배 슈퍼샘플링을 시도했었지만 실제 "굵기" 문제의 원인이 아니었고 — 원인은
// drawHairStrands의 lineWidth 스케일 계산 쪽이었음 — 속도만 느려져서 원복함)
const hairC = document.createElement('canvas');
hairC.width=img.width; hairC.height=img.height;
const hCtx = hairC.getContext('2d');
hCtx.drawImage(img,0,0);
hCtx.save();
hCtx.globalCompositeOperation='destination-in';
if(HAIR_VIEW_BUILD.scaleOnComposite) hCtx.drawImage(maskC,0,0,img.width,img.height);
else { const fm=document.createElement('canvas'); fm.width=img.width; fm.height=img.height;
       fm.getContext('2d').drawImage(maskC,0,0,img.width,img.height); hCtx.drawImage(fm,0,0); }
hCtx.restore();

// ── baseCanvas: 원본에서 hair 영역 제거 ──
const baseC = document.createElement('canvas');
baseC.width=img.width; baseC.height=img.height;
const bCtx = baseC.getContext('2d');
bCtx.drawImage(img,0,0);
bCtx.save();
bCtx.globalCompositeOperation='destination-out';
if(HAIR_VIEW_BUILD.scaleOnComposite) bCtx.drawImage(maskC,0,0,img.width,img.height);
else { const fm=document.createElement('canvas'); fm.width=img.width; fm.height=img.height;
       fm.getContext('2d').drawImage(maskC,0,0,img.width,img.height); bCtx.drawImage(fm,0,0); }
bCtx.restore();

/* ── 구멍 메움 배경(baseFillC) — 2026-07-27 ──
   baseC는 원본에서 머리카락을 destination-out으로 <b>지운</b> 그림이다.
   그래서 조정으로 가닥이 원래 자리를 비키면 그 자리가 투명 구멍이 되고,
   캔버스 뒤 페이지 배경이 비쳐서 <b>검게</b> 보인다(사용자: "헤어가 들렸을
   때 그 아래쪽 머리 부분이 검은색이야").
   해법: 지워진 자리를 주변 색으로 메운 배경을 하나 만들어 baseC <b>밑에</b>
   깔아둔다. 두피 근처는 살색이, 실루엣 바깥쪽은 배경색이 자연히 번져
   들어온다 — 통짜 두피색으로 칠하는 것과 달리 어디가 머리고 어디가
   배경인지 따로 판정할 필요가 없다.
   ※ 저해상도(160px)에서 이웃 전파로 채우고 확대해서 쓴다. 어차피 가닥
     사이로 살짝 보이는 바탕이라 정밀도보다 "검은 구멍이 없을 것"이 중요.
   ※ 예전에 폐지한 "헤어컬러 통짜 언더코트"와는 다르다. 그건 머리색으로
     실루엣을 칠해서 조정이 안 먹히는 것처럼 보이게 만들었고, 이건
     <b>지워진 자리에만</b> 주변색을 번지게 하는 배경이다.
   ※ 생성은 첫 렌더 때 지연 생성한다(getHoleFillCanvas). 두상 영역 판정에
     sectionBandsFor가 필요한데, 그건 state.hairMasks[angle]가 채워진
     뒤에야 제대로 계산된다 — 여기선 아직 대입 전이다. */
  return {hairC, baseC};
}

/* ── [진단용] 색상코드 마스크 캔버스 — <b>볼 때만</b> 굽는다 (2026-08-23 5차) ──
   1:최종 머리카락(빨강) 2:얼굴박스로 제외(회색) 3:눈썹/눈/입 가드로 제외(파랑) 0:투명

   예전엔 extractHairMask에서 뷰마다 미리 구워 state.hairMasks[a].reasonCanvas에
   <b>세션 내내</b> 들고 있었다. 그런데 이걸 보는 곳은 state.debugShowMask 하나뿐이고,
   그건 개발자가 켜야 켜진다. 카메라 사진(1200×1600) 4뷰면 마스크 해상도로도
   <b>17MB</b>다 — 평생 안 보는 그림에 17MB를 쓰고 있었다.
   재료인 reasonMask(Uint8Array)는 그대로 남아 있으니 언제든 다시 굽는다.
   ⚠ 굽는 비용은 w×h 루프 한 번(900×1200이면 1MB 남짓 쓰기). 마스크 보기를
     켜 둔 동안은 maskInf에 붙여 캐시하므로 프레임마다 다시 굽지 않는다. */
const REASON_COLORS = { 1:[255,45,85], 2:[136,136,136], 3:[51,136,255] };
function getReasonCanvas(maskInf){
  if(!maskInf || !maskInf.reasonMask) return null;
  if(maskInf.reasonCanvas) return maskInf.reasonCanvas;
  const w = maskInf.maskW || maskInf.w, h = maskInf.maskH || maskInf.h;
  if(!w || !h) return null;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const im = ctx.createImageData(w, h);
  const rm = maskInf.reasonMask;
  for(let i=0;i<w*h;i++){
    const col = REASON_COLORS[rm[i]];
    if(col){
      im.data[i*4]=col[0]; im.data[i*4+1]=col[1]; im.data[i*4+2]=col[2];
      im.data[i*4+3]=255;
    } // code 0이면 알파 0으로 남음(투명, 초기값 그대로)
  }
  ctx.putImageData(im, 0, 0);
  maskInf.reasonCanvas = c;
  return c;
}

/* ── 헤어 색 실측 (2026-08-02 분리) ────────────────────────────────
   extractHairMask STEP 11의 뒤쪽 절반. 마스크 안 픽셀에서 평균색·섹션별 색·
   실측 팔레트를 뽑는다. 캔버스를 만들지도, 상태를 건드리지도 않는다. */
function measureHairColorsFromMask(hairMaskBuf, srcPixels, w, h, angle){
// ── 색상 샘플링 전용 침식 마스크 ──
// 사용자 지적: "렌더링된 헤어가 원본보다 하얗다" — 원인은 마스크
// 경계(피부/배경과 애매하게 겹치는 픽셀)가 avgHairColor 평균에
// 섞여 들어가서 밝은 쪽으로 끌어올리는 것. 색상 샘플링에만 쓸
// 별도의 침식된(안쪽으로 몇 픽셀 줄인) 마스크로, 경계 오염 없이
// 확실히 "머리카락 안쪽"인 픽셀만 평균 낸다.
// ── 성능 버그 수정(2026-07-13) ──
// 처음 만들 때 img.width×img.height(원본 사진 전체 해상도 — 요즘
// 폰 사진은 1200만 픽셀 이상)로 새 캔버스를 만들고 그 전체를
// 픽셀 단위로(resolveSectionId 호출까지 포함해서) 훑고 있었음.
// 저사양 기기에서 이게 너무 오래 걸리거나 멈춰서 extractHairMask
// 전체가 완료를 못 하고, 그 결과 이 각도의 세그멘테이션 자체가
// 실패한 것처럼 보이는(renderFrame이 "세그멘테이션 없음: 원본만
// 표시" 폴백으로 빠지는) 문제로 이어졌을 가능성이 높음(실기기
// 피드백: "원본 사진만 뜨고 가닥보기/원본결보기 다 안 먹힘").
// → 이미 파이프라인 앞쪽에서 계산해둔 축소 해상도(w,h) 픽셀 버퍼
// srcPixels를 그대로 재사용 — 원본 해상도 대비 보통 수십 배 더
// 작아서 새 캔버스 생성도, getImageData도, 픽셀 루프도 전부 그만큼
// 가벼워짐. 정확도는 이미 이 해상도에서 세그멘테이션 자체가
// 이뤄지고 있어서 손실 없음.
const erodedMaskBuf = erode(hairMaskBuf, w, h, 2);

// 2026-07-14 정리: "마스크 조건으로 픽셀을 걸러 RGB 합·구역별 합을
// 누적한다"는 완전히 같은 이중 루프를, 침식 마스크(1차 시도)와
// 원본 마스크(cnt<50일 때 폴백)에 대해 그대로 반복하고 있었음 —
// 어느 마스크 버퍼를 보는지만 다르고 나머지는 한 글자도 안 달라서
// 함수로 뽑음(순회 순서·조건 그대로).
function sumMaskColors(maskBuf){
  const sums = {};
  SECTION_ORDER.forEach(id=>{ sums[id] = {r:0,g:0,b:0,cnt:0}; });
  let rS=0,gS=0,bS=0,c=0;
  for(let y=0; y<h; y++){
    for(let x=0; x<w; x++){
      const i = y*w+x;
      if(maskBuf[i] <= 128) continue;
      const r=srcPixels[i*4], g=srcPixels[i*4+1], b=srcPixels[i*4+2];
      rS+=r; gS+=g; bS+=b; c++;
      const secId = resolveSectionId(angle, x/w, y/h);
      const s = sums[secId];
      if(s){ s.r+=r; s.g+=g; s.b+=b; s.cnt++; }
    }
  }
  return { sectionSums: sums, rSum: rS, gSum: gS, bSum: bS, cnt: c };
}

if(typeof faceLandmarkerReady !== 'undefined' && faceLandmarkerReady && state.landmarks && state.landmarks[angle]){
  refineSectionBoundaries(angle);
}
let { sectionSums, rSum, gSum, bSum, cnt } = sumMaskColors(erodedMaskBuf);
// 침식 후 남는 픽셀이 너무 적으면(가는 앞머리 등 마스크 자체가 얇은 경우)
// 안전하게 원본(비침식) 마스크로 폴백 — "색이 아예 안 뽑힘"보다는
// 예전 방식(약간 밝게 나올 수 있음)이 낫다.
let usedMaskBuf = erodedMaskBuf; // 색상 실측에 최종 사용된 마스크(아래 팔레트 샘플링도 동일 마스크 사용)
if(cnt < 50){
  ({ sectionSums, rSum, gSum, bSum, cnt } = sumMaskColors(hairMaskBuf));
  usedMaskBuf = hairMaskBuf;
}
const avgHairColor = avgRGBString(rSum, gSum, bSum, cnt, 0) || '#2A1B12';
// 섹션별 색상 — 그 섹션 샘플이 너무 적으면(이 뷰에서 잘 안 보이는
// 섹션 등) 전역 평균(avgHairColor)으로 안전하게 폴백.
const avgColorsBySection = {};
SECTION_ORDER.forEach(id=>{
  const s = sectionSums[id];
  avgColorsBySection[id] = (s.cnt >= 30) ? (avgRGBString(s.r, s.g, s.b, s.cnt, 0) || avgHairColor) : avgHairColor;
});

// ── 실측 색 팔레트(2026-07-14 추가) ──
// 사용자 지적: "결 굵기와 컬러가 원본이랑 차이가 많이 난다" — 색이 뜨는
// 원인: 지금까지 가닥 색 = "마스크 평균색 × 밝기 틴트(하이라이트는 흰색
// 가산)"이었는데, 어두운 머리 + 새치가 섞인 머리는 평균을 내면 중간
// 회색이 되고 거기에 흰색 가산 하이라이트까지 얹혀 전체가 원본보다
// 밝은 회색으로 떠 보임. 실제 머리는 "대부분 어두운 가닥 + 드문 밝은
// 새치"의 분포이지 평균색 덩어리가 아님. → 평균 대신 실제 마스크 안
// 픽셀 색을 최대 512개 샘플링해 팔레트로 저장하고, 가닥마다 팔레트에서
// 하나씩 뽑아 쓰면(스타일 미선택=원본 모드) 원본의 색 분포(어두운 다수
// + 밝은 소수)가 그대로 재현됨 — 지어낸 틴트 상수가 아니라 그 사진의
// 실측 분포. 결정적 스트라이드 샘플링(매 N번째 마스크 픽셀)이라 재렌더
// 마다 팔레트가 바뀌지 않음.
const colorPalette = [];
if(cnt > 0){
  const PALETTE_MAX = 512;
  const stride = Math.max(1, Math.floor(cnt / PALETTE_MAX));
  let seen = 0;
  for(let i=0; i<w*h; i++){
    if(usedMaskBuf[i] <= 128) continue;
    if(seen % stride === 0 && colorPalette.length < PALETTE_MAX){
      colorPalette.push(`rgb(${srcPixels[i*4]},${srcPixels[i*4+1]},${srcPixels[i*4+2]})`);
    }
    seen++;
  }
}
  return {avgHairColor, avgColorsBySection, colorPalette};
}

async function extractHairMask(angle){
  const dataUrl = state.shots[angle];
  if(!dataUrl || !segmenter) return false;

  return new Promise(resolve=>{
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = async()=>{
      try{
        // 512 → 640 → 768 → 1024: 세그멘터(MediaPipe) 실제 입력 해상도이자 scalpY/hairEndY를
        // 뽑아내는 원본 해상도(w,h). 512였을 때는 세로로 긴 사진에서 축소된 w가
        // 200~300대 컬럼밖에 안 나와서, 화면 폭(750px 등)으로 업샘플할 때 여러 화면
        // 컬럼이 같은 소스 값을 복사해 쓰는 계단식 확대가 두피선이 성긴 원인이었음.
        // 640(면적 1.56배) → 768(면적 2.25배)까지 올렸었고, 실측 결과 저사양 기기에서도
        // 1024(원본 512 대비 면적 4배)가 768 대비 체감 지연이 크지 않았고, 오히려
        // 구레나룻처럼 이전엔 못 잡던 디테일까지 세그멘테이션이 잡아내기 시작해서 1024로 고정.
        // 더 밀어붙일 경우 저사양 기기 기준으로 반드시 체감 지연 재확인할 것.
        // (2026-07-14 사용자 합의) 그리기 캔버스를 폰 물리 해상도 1:1(~1200px)로
        // 올리면서 "읽는 해상도하고 그리는 해상도 둘 다 맞춰서 1200 가보고,
        // 무거우면 둘 다 800으로 줄이면 되지" — 분석(읽기) 해상도도 1200으로
        // 동반 상향. (2026-07-16) 그리기 쪽도 DRAW_RES=1200 고정으로 통일됨 —
        // 실기기에서 무거우면 이 값과 DRAW_RES를 800으로 함께 내리는 것이 폴백.
        const maxDim = INPUT_RES.maxDim;   // (2026-08-23) 단일 출처 — DRAW_RES와 반드시 같이 움직인다
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);

        const srcC = document.createElement('canvas');
        srcC.width=w; srcC.height=h;
        const srcCtx = srcC.getContext('2d');
        srcCtx.drawImage(img, 0, 0, w, h);
        const srcPixels = srcCtx.getImageData(0,0,w,h).data;

        // ── STEP 1.5: 목/어깨 실루엣용 사람 전체 마스크(2026-07-14 추가) ──
        // 헤어 마스크(아래 hairMaskBuf)와 완전히 별개의 목적 — "이 픽셀이
        // 머리카락이냐"가 아니라 "이 픽셀이 배경이 아니라 사람(피부/옷
        // 포함)이냐"를 재서, 나중에 3D 목(buildRealNeckMesh)이 이 사람의
        // 실제 목·어깨 폭을 반영하게 하기 위함. 실패해도(bodySegmenter
        // 로드 실패 등) personMask=null로 남고, 헤어 추출/얼굴 메쉬 등
        // 나머지 파이프라인은 전혀 영향받지 않음(완전히 곁가지 데이터).
        let personMask = null;
        if(bodySegmenter){
          try{
            const bodySegs = await bodySegmenter.segmentPeople(srcC, {
              multiSegmentation: false,
              segmentBodyParts: false,
            });
            if(bodySegs && bodySegs.length>0){
              const binaryMask = await bodySegmentation.toBinaryMask(
                bodySegs,
                {r:255,g:255,b:255,a:255},
                {r:0,g:0,b:0,a:0},
                false, 0.5
              );
              // TF.js 헤어 폴백 경로(위 STEP1)가 personMaskData를 쓰는 것과
              // 동일한 인덱싱 관례(alpha>128=사람) — srcC를 그대로 세그멘터에
              // 넘겼으므로 binaryMask도 이미 w×h와 같은 해상도.
              personMask = new Uint8Array(w * h);
              for(let i=0;i<w*h;i++){ personMask[i] = (binaryMask.data[i*4+3] > 128) ? 1 : 0; }
            }
          }catch(e){
            console.warn('목 실루엣용 바디 세그멘테이션 실패(헤어 추출과 무관, 목은 기존 고정값으로 폴백):', e);
            personMask = null;
          }
        }

        // 마스크 버퍼 (0=background, 255=hair) — 축소 해상도에서 작업
        let hairMaskBuf = new Uint8Array(w * h);
        // 디버그용 "왜 이렇게 됐는지" 코드 — 0:미해당, 1:최종 머리카락, 2:얼굴박스로 제외,
        // 3:눈썹/눈/입 가드로 제외. "마스크 보기"에서 색을 다르게 표시하기 위함.
        const reasonMask = new Uint8Array(w * h);

        // ── STEP 1: 세그멘테이션 — MediaPipe 우선, 실패 시 TF.js 폴백 ──
        // hairMaskBuf를 채우는 역할만 담당 (이후 단계에서 후처리)
        async function runSegmentation(){
        if(mpImageSegmenter){
          // ── MediaPipe hair_segmenter path (confidenceMask 기반) ──
          // categoryMask(0.5 argmax)보다 관대한 기준으로 저채도 경계 픽셀(새치 등)을
          // 더 살리기 위해, index 1(hair) 확률맵을 직접 임계값 비교로 판정한다.
          // 기준치를 낮출수록 더 많이 잡히지만 배경 오탐도 늘어날 수 있음 — 실측
          // 데이터 보면서 조정할 예정.
          const HAIR_CONFIDENCE_THRESHOLD = 0.5; // 원상복구: 관대했던 0.3 → categoryMask argmax와 동등한 0.5로 되돌림
          const result = mpImageSegmenter.segment(srcC);
          const hairConf = result.confidenceMasks[1]; // 0=background, 1=hair
          const confArr = hairConf.getAsFloat32Array();
          // 진단: 확률 분포 요약 (평균/최대값) — 전체적으로 확률이 낮게 나오면
          // 임계값을 더 낮춰야 한다는 신호
          let confSum=0, confMax=0, aboveCount=0;
          for(let i=0;i<confArr.length;i++){
            const c = confArr[i];
            confSum += c; if(c>confMax) confMax=c;
            const isHair = c >= HAIR_CONFIDENCE_THRESHOLD;
            if(isHair) aboveCount++;
            hairMaskBuf[i] = isHair ? 255 : 0;
          }
          window.__maskValueDiag = `avg:${(confSum/confArr.length).toFixed(3)},max:${confMax.toFixed(3)},≥${HAIR_CONFIDENCE_THRESHOLD}:${aboveCount}`;
          hairConf.close();
        } else {
          // ── TF.js SelfieSegmentation 폴백 ──
          const segs = await segmenter.segmentPeople(srcC, {
            multiSegmentation: false,
            segmentBodyParts: false,
          });
          // TF.js 사람 마스크 + HSV hair 색상 필터 (마스크 실패시 상단 영역 HSV만 사용)
          let personMaskData = null;
          if(segs && segs.length>0){
            try{
              const binaryMask = await bodySegmentation.toBinaryMask(
                segs,
                {r:255,g:255,b:255,a:255},
                {r:0,g:0,b:0,a:0},
                false, 0.5
              );
              personMaskData = binaryMask.data;
            } catch(e){ personMaskData = null; }
          }

          // 사람 마스크가 있으면 마스크 내에서, 없으면 상단 60% 전체에서 HSV 필터
          const topLimit = Math.round(h * 0.60);
          for(let i=0;i<w*h;i++){
            const iy = Math.floor(i/w);
            const inRegion = personMaskData
              ? personMaskData[i*4+3] > 128
              : iy < topLimit;
            if(inRegion){
              const r=srcPixels[i*4], g=srcPixels[i*4+1], b=srcPixels[i*4+2];
              if(isHairColor(r,g,b)) hairMaskBuf[i]=255;
            }
          }
        }
        } // runSegmentation
        await runSegmentation();

        // ── STEP 2: 배경 오탐 제거 — 사람 머리 영역 바깥은 무조건 제외 ──
        // confidenceMask 임계값을 관대하게 낮췄더니(0.3), 벽/천장 경계선처럼
        // 배경의 강한 선형 경계가 낮은 확신도로 "머리카락"으로 오탐되어 화면
        // 전체 폭에 걸쳐 일직선 가닥이 뻗어나가는 문제가 실제로 확인됨.
        // 이건 "얼굴을 정교하게 지운다"는 세밀한 보정이 아니라 "사람이 있을 리
        // 없는 먼 배경만 제외한다"는 훨씬 느슨한 가드라서, ENABLE_LANDMARK_POSTPROCESS
        // 플래그(세밀한 재구성 로직들)와 별개로 항상 켜둔다.
        function applyBackgroundGuard(){
          const lmGuard = state.landmarks && state.landmarks[angle];
          if(lmGuard){
            const beforeCount = hairMaskBuf.reduce((a,v)=>a+(v>0?1:0),0);
            const earSpan = Math.abs(lmGuard.rEarX - lmGuard.lEarX);
            const cx = (lmGuard.lEarX + lmGuard.rEarX) / 2;
            const marginX = Math.max(earSpan * 2.2, 0.28); // 측면 등 earSpan이 작을 때 최소 마진 보장
            const xLeft  = Math.max(0, cx - marginX);
            const xRight = Math.min(1, cx + marginX);
            const yTop    = Math.max(0, lmGuard.foreheadY - 0.25);
            const yBottom = Math.min(1, lmGuard.chinY + 0.55); // 목·어깨까지 여유
            const xS = Math.round(xLeft*w), xE = Math.round(xRight*w);
            const yS = Math.round(yTop*h), yE = Math.round(yBottom*h);
            for(let y=0;y<h;y++){
              for(let x=0;x<w;x++){
                if(x<xS || x>=xE || y<yS || y>=yE) hairMaskBuf[y*w+x]=0;
              }
            }
            const afterCount = hairMaskBuf.reduce((a,v)=>a+(v>0?1:0),0);
            window.__bgGuardDiag = `${beforeCount}→${afterCount}(-${beforeCount-afterCount})`;
          }
        } // applyBackgroundGuard
        applyBackgroundGuard();

        // ── 이하 랜드마크 기반 후처리는 세그멘터 종류(MediaPipe/TF.js)와
        // 무관하게 항상 적용한다. (이전엔 TF.js 폴백 분기 안에만 있어서,
        // MediaPipe 1차 세그멘터가 성공하면 얼굴제거박스·어깨컷오프·
        // 귀/프론트 보강이 전부 스킵되는 구조적 버그가 있었음)

        // ── 얼굴 영역 제거: 랜드마크 기반 동적 박스 ──
        // 기존 고정 좌표(가로 25~75%) 박스는 "얼굴이 항상 화면 중앙"이라고 가정해서
        // 측면(좌/우) 사진에서는 얼굴이 한쪽으로 치우쳐 있어 반대쪽 옆머리까지 같이 지워버렸음.
        // Face Landmarker로 실제 눈/귀/턱 위치를 알면 그 범위에 맞춰서만 지운다.
        // 실측 랜드마크가 있으면 그대로, 없으면 비율 기반 추정치로 대체
        // (이전엔 랜드마크 실패 시 이 블록 전체가 꺼지고 보수적 고정 박스로만
        // 폴백했는데, 그러면 아래의 귀/프론트 보강·동적 어깨컷오프까지
        // 전부 같이 무효화됨 → 항상 lm이 존재하도록 바꿔서 그 문제를 없앰)
        const lmReal = state.landmarks && state.landmarks[angle];
        const lm = lmReal || getEstimatedLandmarks(angle);
        const lmEstimated = !lmReal;
        // 얼굴제거박스가 실제로 지운 픽셀을 별도 기록 — 아래 귀/프론트 보강 단계에서
        // "원래부터 머리카락이 아니었던 곳"과 절대 혼동하지 않고 재채움을 막기 위함
        const faceExcludeMask = new Uint8Array(w*h);

        // ── STEP 2.5: 하이라이트로 날아간 부분 보강(색과 무관한 구멍 채우기) ──
        // applyBackgroundGuard 직후, 얼굴 제거박스(STEP 3~4, TF.js 경로에서만
        // 실행됨)가 아직 안 지워진 시점에 실행 — 얼굴 영역도 지금은 배경(0)으로
        // 잡혀있어서 자칫 "둘러싸인 구멍"으로 오인될 수 있지만, 얼굴+목 영역은
        // boundBox 대비 면적이 하이라이트 패치보다 훨씬 커서 maxHoleAreaFrac
        // 상한에 걸려 자동으로 제외됨(실측 없이 잡은 값이라 필요시 재조정).
        function reinforceHighlightHoles(){
          const lmH = state.landmarks && state.landmarks[angle];
          if(!lmH) return;
          const earSpanH = Math.abs(lmH.rEarX - lmH.lEarX);
          const cxH = (lmH.lEarX + lmH.rEarX) / 2;
          const marginXH = Math.max(earSpanH * 2.2, 0.28);
          const boundBox = {
            xS: Math.round(Math.max(0, cxH - marginXH) * w),
            xE: Math.round(Math.min(1, cxH + marginXH) * w),
            yS: Math.round(Math.max(0, lmH.foreheadY - 0.25) * h),
            yE: Math.round(Math.min(1, lmH.chinY + 0.55) * h),
          };
          const before = hairMaskBuf.reduce((a,v)=>a+(v>0?1:0),0);
          hairMaskBuf = fillEnclosedHighlightHoles(hairMaskBuf, w, h, boundBox, 0.06);
          const after = hairMaskBuf.reduce((a,v)=>a+(v>0?1:0),0);
          window.__highlightHoleDiag = `${before}→${after}(+${after-before})`;
        } // reinforceHighlightHoles
        reinforceHighlightHoles();

        // [진단용] 얼굴제거박스의 실제 좌표(0~1 비율)와 사용된 랜드마크 값을 기록.
        // 화면의 각진 블록 아티팩트가 이 박스와 일치하는지 "얼굴박스 보기" 토글로 확인하기 위함.
        let faceBoxDiag = null;

        // ── STEP 3: 얼굴 영역 제거 — 랜드마크 기반 동적 박스 ──
        function applyFaceBoxRemoval(){
          const yTop    = Math.max(0, lm.foreheadY * 0.95);
          const yBottom = Math.min(1, lm.chinY * 1.05); // 턱 끝을 넘어서까지 (기존 0.92는 턱 라인이 박스 밖에 남는 문제)
          const earSpan = Math.abs(lm.rEarX - lm.lEarX);
          let xLeft, xRight;
          if(earSpan > 0.08){
            // 양쪽 귀가 충분히 떨어져 보이는 경우 (정면~약한 측면): 귀 안쪽만 지움
            xLeft  = Math.min(lm.lEarX, lm.rEarX) + earSpan*0.18; // 옆(턱 모서리·관자놀이) 여유 확대 (기존 0.12)
            xRight = Math.max(lm.lEarX, lm.rEarX) - earSpan*0.18;
          } else {
            // 거의 완전 측면(반대쪽 귀가 가려져 earSpan이 비정상적으로 작음):
            // 화면 폭 35%의 좁은 범위만 안전하게 제거 (얼굴 중심부 추정, 옆머리는 보존)
            const cx = (lm.lEarX + lm.rEarX) / 2;
            xLeft  = cx - 0.20; // 측면 턱 라인까지 포함하도록 확대 (기존 0.175)
            xRight = cx + 0.20;
          }
          const yS = Math.round(yTop*h), yE = Math.round(yBottom*h);
          const xS = Math.round(Math.max(0,xLeft)*w), xE = Math.round(Math.min(1,xRight)*w);
          for(let y=yS; y<yE; y++){
            for(let x=xS; x<xE; x++){
              if(x>=0&&x<w&&y>=0&&y<h){
                const idx=y*w+x;
                if(hairMaskBuf[idx]===255) reasonMask[idx]=2;
                hairMaskBuf[idx]=0; faceExcludeMask[idx]=1;
              }
            }
          }
          faceBoxDiag = {
            xLeft: Math.max(0,xLeft), xRight: Math.min(1,xRight), yTop, yBottom,
            lmEstimated,
            foreheadY: lm.foreheadY, chinY: lm.chinY, lEarX: lm.lEarX, rEarX: lm.rEarX, earSpan
          };
        } // applyFaceBoxRemoval

        // ── STEP 4: 얼굴 부위별 정밀 가드 (눈썹·눈·입) ──
        // 위 얼굴제거박스의 x범위(관자놀이 쪽 여유 때문에 좁게 잡힘) 밖으로
        // 삐져나온 부위(특히 측면 사진에서 관자놀이 쪽 눈썹 꼬리)도 좌표 기반으로
        // 별도 제외한다. "이 사람은 앞머리가 짧다/길다" 같은 헤어스타일 가정과
        // 무관하게, 실제 그 부위 랜드마크만 갖고 판단하므로 모든 헤어스타일에 동일 적용됨.
        // 랜드마크 추정 폴백(getEstimatedLandmarks)에는 features가 없으므로 자동 스킵됨
        // — 대략적 비율 추정치로 눈썹 위치까지 지어내는 건 오히려 부정확할 수 있어서.
        function applyFeatureGuard(){
        if(lm.features){
          for(const key of Object.keys(lm.features)){
            const f = lm.features[key];
            const fw = f.maxX - f.minX, fh = f.maxY - f.minY;
            const mx = fw * 0.35 + 0.006, my = fh * 0.5 + 0.006; // 랜드마크가 실제 부위보다 살짝 안쪽으로 잡히는 오차 보정 여유
            const xS = Math.round(Math.max(0, f.minX - mx) * w);
            const xE = Math.round(Math.min(1, f.maxX + mx) * w);
            const yS = Math.round(Math.max(0, f.minY - my) * h);
            const yE = Math.round(Math.min(1, f.maxY + my) * h);
            // 사각형이 아니라 타원으로 — 눈썹/눈/입은 실제로 길쭉한 타원에 가까운
            // 모양이라, 각진 사각형으로 자르면 결과물(특히 원본 결 디버그 뷰)에서
            // 눈에 띄게 인위적인 홈처럼 보였음. 중심·반지름 기준 타원 판정으로 교체.
            const cx = (xS+xE)/2, cy = (yS+yE)/2;
            const rx = Math.max(1,(xE-xS)/2), ry = Math.max(1,(yE-yS)/2);
            for(let y=yS; y<yE; y++){
              const ny = (y-cy)/ry;
              for(let x=xS; x<xE; x++){
                const nx = (x-cx)/rx;
                if(nx*nx + ny*ny > 1) continue; // 타원 밖은 건드리지 않음
                if(x>=0&&x<w&&y>=0&&y<h){
                  const idx=y*w+x;
                  if(hairMaskBuf[idx]===255) reasonMask[idx]=3;
                  hairMaskBuf[idx]=0; faceExcludeMask[idx]=1;
                }
              }
            }
          }
        }
        } // applyFeatureGuard

        // ── STEP 5: 목·어깨 제거 — 랜드마크(chinY) 기반 동적 컷오프 ──
        // 기존 고정 70% 라인은 턱이 그보다 위/아래로 짧게 잡히는 얼굴에서
        // 어깨선(옷)이 70% 안쪽에 들어와 회색 티셔츠 그림자가 머리카락으로 오인됨.
        // 턱 끝(chinY)에서 목 길이만큼(약 1.35배) 아래를 컷오프 라인으로 잡아
        // 얼굴 크기에 비례해서 어깨선을 더 정확히 배제한다.
        function applyShoulderCutoff(){
          const shoulderCutoffY = Math.max(Math.round(h*0.45), Math.min(Math.round(h*0.85), Math.round(lm.chinY * 1.35 * h)));
          for(let y=shoulderCutoffY; y<h; y++){
            for(let x=0;x<w;x++) hairMaskBuf[y*w+x]=0;
          }
        } // applyShoulderCutoff

        // ── STEP 6: 옆머리·앞머리 빈 부분 보강 (귀/프론트 밴드 완화 색상 필터) ──
        // 밝은 조명을 받은 잔머리(v>=0.55, 저채도)는 기존 isHairColor 3번 조건 경계에
        // 걸려 누락되는 경우가 있음. 화면 전체가 아니라 "귀 주변 영역"에서만
        // 완화된 기준을 추가 적용해서, 과확장(옷/목까지 번지는 문제) 재발 없이
        // 옆머리(관자놀이~귀 주변) 빈 구간만 보강한다.
        // (이전: 밴드가 너무 넓어서(가로 14%, 아래로 귀높이*1.55) 뺨·턱선 피부가
        // isHairColorRelaxed에 걸려 같이 채워지는 문제가 실사진에서 계속 발생.
        // 밴드를 귀 바로 옆·바로 아래로만 좁혀서 보수적으로 만듦)
        function reinforceEarAndFrontBands(){
          // 연결성 제약: 색만 머리카락과 비슷한 "고립된" 뺨/턱 피부(그늘 등)가
          // 기존에 검출된 머리카락과 붙어있지 않은데도 그냥 채워지는 문제가
          // 실사진(측면)에서 계속 발생함 — 턱선까지 갈색으로 이어짐.
          // 보강 시작 전 시점의 마스크를 넉넉히 dilate해서 "실제 머리카락과
          // 인접한 범위"만 성장 허용 영역으로 만들고, 이 영역 밖은 색이 맞아도
          // 채우지 않는다. (진짜 잔머리는 기존 머리카락 경계에 붙어있으므로 안전)
          const growAllowEar = dilate(hairMaskBuf, w, h, 4);
          // 안경다리가 지나가는 바로 이 귀 밴드 영역에서, 색 조건(isHairColorRelaxed)만으로
          // 채우면 안경테의 저채도·중간밝기가 잔머리 색과 같은 조건을 통과해버리는 문제가
          // 있었음(가능성2). 색이 맞아도 국소 밝기 분산(hasHairTexture)이 낮으면 —
          // 즉 안경처럼 매끈한 재질이면 — 채우지 않도록 텍스처 조건을 추가로 요구한다.
          const grayForTexture = toGrayscale(srcPixels, w, h);
          // closing(dilate→erode)이 "새로 채운" 픽셀만 텍스처 재검증하는 공통 루프.
          // 귀 밴드/프론트 밴드가 이 블록을 진단 변수명만 다르게 복제하고 있던 것을
          // 통합(2026-07-18). srcMask에 원래 있던 픽셀은 그대로 통과(이미 검증됨),
          // closing이 새로 추가한 픽셀만 hasHairTexture 재검사 — 매끈한 안경테가
          // 틈 메우기로 재유입되는 걸 막던 기존 동작 그대로. 반환=재검사에서 탈락한 수.
          function commitClosedWithTextureRecheck(closed, srcMask){
            let rejected = 0;
            for(let i=0;i<w*h;i++){
              if(closed[i]>0 && !faceExcludeMask[i]){
                if(srcMask[i]>0){ hairMaskBuf[i]=255; continue; } // 이미 검증된 픽셀
                const x = i % w, y = (i / w) | 0;
                if(hasHairTexture(grayForTexture, w, h, x, y, 2)) hairMaskBuf[i]=255;
                else rejected++;
              }
            }
            return rejected;
          }
          let earBandTextureRejected = 0;

          const earXs = [lm.lEarX, lm.rEarX].filter(v=>typeof v==='number');
          const bandHalfW = 0.09; // 14% → 9%: 뺨 쪽으로 번지지 않는 귀 바로 옆 폭만
          const yTopBand = Math.max(0, lm.eyeY - 0.08) * h;  // 관자놀이 위쪽까지 포함
          const yBotBand = Math.min(1, lm.earY * 1.22) * h;  // 1.55 → 1.22: 턱선까지 안 내려가게 귀 바로 아래까지만
          forEachEarBandPixel(earXs, bandHalfW, yTopBand, yBotBand, w, h, (x,y)=>{
            if(x<0||x>=w||y<0||y>=h) return;
            const i = y*w+x;
            if(hairMaskBuf[i]>0) return; // 이미 잡힌 픽셀은 스킵
            if(faceExcludeMask[i]) return; // 얼굴로 판정해 지운 픽셀은 재채움 금지
            if(!growAllowEar[i]) return; // 기존 머리카락과 붙어있지 않은 고립 영역은 스킵
            const r=srcPixels[i*4], g=srcPixels[i*4+1], b=srcPixels[i*4+2];
            if(!isHairColorRelaxed(r,g,b)) return;
            if(!hasHairTexture(grayForTexture, w, h, x, y, 2)){ earBandTextureRejected++; return; }
            hairMaskBuf[i]=255;
          });
          window.__earBandTextureDiag = earBandTextureRejected;
          // 귀 밴드 안에서만 국소 dilate+closing으로 드문드문 잡힌 픽셀을 면으로 연결
          // (화면 전체에 적용하면 과확장 재발 위험 → 밴드 영역에만 한정)
          const bandMask = new Uint8Array(w*h);
          forEachEarBandPixel(earXs, bandHalfW, yTopBand, yBotBand, w, h, (x,y)=>{
            if(x>=0&&x<w&&y>=0&&y<h) bandMask[y*w+x]=hairMaskBuf[y*w+x];
          });
          const bandClosed = morphClose(dilate(bandMask, w, h, 1), w, h, 1); // 2 → 1: 좁은 밴드 밖(뺨)으로 번지는 것 방지
          // 프론트와 동일한 이유로, closing이 새로 채운 픽셀만 텍스처 재검증
          // (안경다리처럼 매끈한 재질이 인접 잔머리에 붙어 다시 이어지는 것 방지)
          window.__bandClosedTextureDiag = commitClosedWithTextureRecheck(bandClosed, bandMask);

          // ── 프론트(앞머리) 라인 보강: 이마 경계 쪽 잔머리도 같은 방식으로 ──
          // 여기도 동일하게, 귀 밴드 보강까지 끝난 시점의 마스크를 기준으로
          // "기존 머리카락과 인접한 곳만" 성장 허용 (고립된 이마 피부 오탐 방지)
          // 실측 결과 귀 밴드 쪽 텍스처 제외는 거의 작동하지 않았고(8px),
          // 실제 눈썹~안경 위쪽 렌즈 영역이 덮이는 문제는 이 프론트 밴드 범위와 겹쳤음.
          // 눈썹도 안경 상단 프레임과 마찬가지로 이 밴드 y범위에 걸리므로, 같은 텍스처
          // 조건을 여기에도 동일하게 적용한다. 하단 경계는 "눈 위 몇 %" 식 고정 비율이
          // 아니라 실제 눈썹 랜드마크(browTopY) 바로 위에서 멈추게 한다 — 앞머리가 짧아서
          // 눈썹 위에서 끝나는 사람을 기준으로 고정 비율을 잡으면, 앞머리가 길어 눈썹을
          // 덮는 사람은 그 아래 실제 머리카락 보강까지 막히게 됨. 눈썹 좌표를 직접 쓰면
          // 헤어스타일에 대한 가정 없이 눈썹만 정확히 피해간다.
          const growAllowFront = dilate(hairMaskBuf, w, h, 4);
          const fxS = Math.round(Math.max(0, Math.min(lm.lEarX, lm.rEarX) + Math.abs(lm.rEarX-lm.lEarX)*0.15) * w);
          const fxE = Math.round(Math.min(1, Math.max(lm.lEarX, lm.rEarX) - Math.abs(lm.rEarX-lm.lEarX)*0.15) * w);
          const fyTop = Math.max(0, lm.foreheadY * 0.85) * h;
          const fyBot = Math.min(1, lm.browTopY != null ? lm.browTopY : lm.eyeY * 0.92) * h;
          const frontBandMask = new Uint8Array(w*h);
          let frontBandTextureRejected = 0;
          for(let y=Math.round(fyTop); y<Math.round(fyBot); y++){
            for(let x=fxS; x<fxE; x++){
              if(x<0||x>=w||y<0||y>=h) continue;
              const i = y*w+x;
              if(hairMaskBuf[i]===0 && !faceExcludeMask[i] && growAllowFront[i]){
                const r=srcPixels[i*4], g=srcPixels[i*4+1], b=srcPixels[i*4+2];
                if(isHairColorRelaxed(r,g,b)){
                  if(hasHairTexture(grayForTexture, w, h, x, y, 2)) hairMaskBuf[i]=255;
                  else frontBandTextureRejected++;
                }
              }
              frontBandMask[i] = faceExcludeMask[i] ? 0 : hairMaskBuf[i];
            }
          }
          window.__frontBandTextureDiag = frontBandTextureRejected;
          const frontClosed = morphClose(dilate(frontBandMask, w, h, 2), w, h, 2);
          // closing(dilate+erode)은 순수 형태 연산이라 텍스처 검사를 다시 하지 않음 —
          // 그래서 눈썹(정당하게 통과)과 붙어있던 안경테 픽셀(텍스처로 걸러졌던 것)이
          // 틈 메우기 과정에서 다시 이어붙는 문제가 있었음. closing이 "새로 추가한" 픽셀만
          // (원래 frontBandMask에는 없던 픽셀) 텍스처를 한 번 더 검증해서 재유입을 막는다.
          window.__frontClosedTextureDiag = commitClosedWithTextureRecheck(frontClosed, frontBandMask);
        } // reinforceEarAndFrontBands

        // ── STEP 3~6 실행: 랜드마크 기반 후처리 (플래그로 일괄 on/off) ──
        // MediaPipe가 정상 동작 중일 때는 이 보강 로직을 끄고(마스크 자체가 이미 정교함),
        // TF.js 폴백으로 떨어졌을 때만 켠다 (TF.js 마스크 기준으로 튜닝된 패치들이라서).
        if(ENABLE_LANDMARK_POSTPROCESS && state.segmenterType !== 'MediaPipe'){
          applyFaceBoxRemoval();
          applyFeatureGuard();
          applyShoulderCutoff();
          reinforceEarAndFrontBands();
        }

        // ── STEP 7: 마스크 후처리 — 컬럼 내 작은 구멍만 채움 (과확장 없이 노이즈 정리만) ──
        // 이전: earY 기반 하단 dilate + HSV 보강이 머리카락을 옷/목까지 과도하게 확장시켜 되돌림
        // 사이드 하단 인식 문제는 결방향 인식(structure tensor) 작업 이후 별도로 재검토
        function cleanupMask(){
          hairMaskBuf = fillColumnGaps(hairMaskBuf, w, h, 6);
          hairMaskBuf = morphClose(hairMaskBuf, w, h, 3);
          // 본체 머리카락과 이어지지 않은 고립된 작은 오탐 덩어리(안경테, 눈썹, 옷깃 등)
          // 제거 — 가장 큰 덩어리 면적의 3% 미만인 컴포넌트는 버림
          hairMaskBuf = keepLargestComponents(hairMaskBuf, w, h, 0.03);
        }
        cleanupMask();

        // ── STEP 8: 진단 로그 문자열 조립 ──
        function buildDiagLog(){
          const pixelCount = hairMaskBuf.filter(v=>v>0).length;
          const lmDiagPart = lmEstimated ? `추정${window.__lmDiag ? '('+window.__lmDiag+')' : ''}` : '실측';
          const segFailPart = (state.segmenterType !== 'MediaPipe' && window.__segDiag) ? ` | MP실패:${window.__segDiag}` : '';
          const maskValPart = (state.segmenterType === 'MediaPipe' && window.__maskValueDiag) ? ` | 마스크값:${window.__maskValueDiag}` : '';
          const bgGuardPart = window.__bgGuardDiag ? ` | 배경가드:${window.__bgGuardDiag}` : '';
          const texRejPart = window.__earBandTextureDiag ? ` | 귀밴드질감제외:${window.__earBandTextureDiag}px` : '';
          const frontTexRejPart = window.__frontBandTextureDiag ? ` | 프론트밴드질감제외:${window.__frontBandTextureDiag}px` : '';
          const frontClosedTexRejPart = window.__frontClosedTextureDiag ? ` | 프론트닫기질감제외:${window.__frontClosedTextureDiag}px` : '';
          const bandClosedTexRejPart = window.__bandClosedTextureDiag ? ` | 귀닫기질감제외:${window.__bandClosedTextureDiag}px` : '';
          state._diagLog = `세그멘터:${state.segmenterType||'?'} | 마스크픽셀:${pixelCount}px | 랜드마크:${lmDiagPart}${segFailPart}${maskValPart}${bgGuardPart}${texRejPart}${frontTexRejPart}${frontClosedTexRejPart}${bandClosedTexRejPart}`;
        }
        buildDiagLog();

        // ── STEP 9: 결방향 인식 (Structure Tensor) ──
        // 축소 해상도(w,h)에서 계산 → 컬럼별 샘플로 다운샘플해 저장
        // (가닥 렌더링 시 매번 풀 계산하지 않고 가벼운 보간만 하도록)
        let orientationColSamples = null;
        function computeOrientation(){
          try{
            // Structure Tensor는 강한 명암 경계(edge)를 만나면 그 edge의 접선 방향을
            // "결방향"으로 오인하는 특성이 있음. hairMaskBuf 그대로 넘기면 머리카락↔
            // 배경/얼굴 경계(마스크 테두리) 자체가 그렇게 오인식되어, 그 경계 근처를
            // 지나가는 가닥들이 전부 그 경계 방향(주로 거의 수평)으로 꺾여버리고,
            // 그 뒤로는 (마스크 밖이라 결방향 데이터가 없으니) 그 방향을 그대로 유지한 채
            // 계속 뻗어나가서 옆으로 뻗은 "빗살" 형태가 됨 — 렌더링 쪽에서 시작점만
            // 2스텝 건너뛰는 것으로는 못 막았던, 경로 중간에 재발하는 동일한 문제.
            // → 경계에서 안쪽으로 살짝 침식(erode)한 마스크로만 결방향을 계산해서
            //   경계 픽셀 자체가 결방향 계산에 아예 들어가지 않게 함.
            const orientErodeR = Math.max(3, Math.round(w*0.004));
            const orientMaskBuf = erode(hairMaskBuf, w, h, orientErodeR);
            const {angle: angleField, coherence: coherenceField} = computeHairOrientationField(srcPixels, orientMaskBuf, w, h);
            /* ── 극성(뿌리→끝) — 측정한 각도는 그대로 두고 <b>부호만</b> 정한다 ──
               거리장은 침식 전 마스크(hairMaskBuf)로 잰다. 침식본은 결 계산의
               경계 오염을 막으려고 안쪽으로 깎은 것이라, 거기서 거리를 재면
               뿌리 경계가 실제보다 아래에 있는 것으로 잡힌다. */
            let flow = null;
            if(HAIR_FLOW.on){
              try{
                flow = buildRootFlowField(hairMaskBuf, w, h);
                console.log('[결·극성] ' + angle + ' 마스크 ' + flow.inMask + 'px 중 극성 확정 '
                  + flow.conf + 'px(' + (flow.inMask ? Math.round(flow.conf/flow.inMask*100) : 0) + '%)'
                  + ' · 나머지는 예전 규칙(연속성)');
              }catch(e){ console.warn('뿌리 흐름장 실패(예전 규칙으로):', e); flow = null; }
            }
            orientationColSamples = buildColumnOrientationSamples(angleField, coherenceField, orientMaskBuf, w, h, 12, flow);
          }catch(e){
            console.warn('결방향 인식 실패, 기본 직선 모드로 폴백:', e);
            orientationColSamples = null;
          }
        }
        computeOrientation();

        // ── STEP 10: 두피(scalpY)·모발끝(hairEndY) 라인 추출 후 원본 해상도로 스케일업 ──
        const {scalpY, hairEndY} = extractScalpAndEndLines(hairMaskBuf, w, h, img.width, scale);

        // ── STEP 11: 결과 캔버스 합성 (마스크/진단/hair/base 캔버스 + 평균 헤어컬러) ──

        // 최종 확정: 지금 시점에 hairMaskBuf===255인 픽셀은 전부 "최종 머리카락"(1)으로
        // 표시 — 귀/프론트 밴드 보강으로 나중에 다시 채워진 픽셀도 여기서 포함됨.
        // (버그 수정: 예전엔 이 대입이 buildOutputCanvases() 호출 "다음"에 실행돼서,
        // reasonC 캔버스가 이미 다 그려진 뒤였음 — 그래서 마스크 보기에서 빨강(최종
        // 머리카락)이 절대 보이지 않고 회색/파랑 제외 표시만 보이는 문제가 있었음.
        // reasonC를 만들기 "전"에 최종 확정을 끝내야 마스크 보기에 빨강이 정상적으로 나옴.)
        for(let i=0;i<w*h;i++){ if(hairMaskBuf[i]===255) reasonMask[i]=1; }

        const {hairC, baseC} = buildHairViewCanvases(img, hairMaskBuf, reasonMask, w, h);
        const {avgHairColor, avgColorsBySection, colorPalette} = measureHairColorsFromMask(hairMaskBuf, srcPixels, w, h, angle);

        // ── 두피/피부색 샘플링 ──
        // 얼굴제거박스·눈썹가드로 "피부"라고 판정해서 머리카락에서 제외한 픽셀들의
        // 평균 색상 = 이 사람의 실제 피부/두피에 가까운 색. 가르마나 정수리가
        // 벗어진 부분처럼 마스크 실루엣 안인데 실제 머리카락은 아닌 곳을
        // (기존처럼) 진한 평균 헤어컬러 단색으로 덮어버리면 밋밋한 덩어리로
        // 보이는데, 대신 이 두피색을 써서 "머리카락 사이로 두피가 비치는"
        // 자연스러운 느낌을 내기 위함.
        let scalpColor = null;
        // 최우선: 이마 중앙 밴드 직접 샘플링 — 마스크 분류 결과와 무관하게 "여기는
        // 무조건 피부"라고 확신할 수 있는 좁은 영역(눈썹 위, 헤어라인 아래, 관자놀이
        // 피해서 중앙 40%만)을 그냥 원본에서 바로 평균낸다. 아래 두 폴백(reason=2 기반,
        // 헤어라인 바로 위 컬럼 샘플)은 마스크 경계 픽셀 몇 개에 의존해서 안티앨리어싱·
        // 그림자가 섞이기 쉬운데, 이 방식은 그런 잡음 없이 실제 보이는 얼굴색과 가장
        // 가깝게 나옴 — "바탕이 얼굴색과 비슷해야 한다"는 요건에 직접 대응.
        {
          const bandYTop = Math.max(0, lm.foreheadY * 0.92);
          const bandYBot = Math.min(1, lm.browTopY != null ? lm.browTopY * 0.96 : lm.eyeY * 0.85);
          const earSpan  = Math.abs(lm.rEarX - lm.lEarX);
          const cx = (lm.lEarX + lm.rEarX) / 2;
          const halfW = Math.max(earSpan * 0.16, 0.05); // 눈썹 꼬리·관자놀이 잔머리 피해서 중앙만
          const xS = Math.round(Math.max(0, cx - halfW) * w);
          const xE = Math.round(Math.min(1, cx + halfW) * w);
          const yS = Math.round(bandYTop * h);
          const yE = Math.round(bandYBot * h);
          let srSum=0, sgSum=0, sbSum=0, scnt=0;
          for(let y=yS; y<yE; y++){
            for(let x=xS; x<xE; x++){
              if(x<0||x>=w||y<0||y>=h) continue;
              const i = y*w+x;
              srSum+=srcPixels[i*4]; sgSum+=srcPixels[i*4+1]; sbSum+=srcPixels[i*4+2]; scnt++;
            }
          }
          if(scnt>20){
            scalpColor = avgRGBString(srSum, sgSum, sbSum, scnt, 20);
          }
        }
        if(!scalpColor){
          // 버그 수정: faceExcludeMask===1은 얼굴박스(reason=2, 순수 피부) 뿐 아니라
          // 눈썹/눈/입 가드(reason=3)까지 같은 값으로 묶여있어서, 어둡고 채도 높은
          // 눈썹·눈동자·입술 픽셀이 피부색 평균에 섞여 들어가 전체가 어둡게 계산되던 문제.
          // → reasonMask===2(순수 얼굴박스 피부)만 샘플링하도록 좁힘.
          let srSum=0, sgSum=0, sbSum=0, scnt=0;
          for(let i=0;i<w*h;i++){
            if(reasonMask[i]===2){
              srSum+=srcPixels[i*4]; sgSum+=srcPixels[i*4+1]; sbSum+=srcPixels[i*4+2]; scnt++;
            }
          }
          scalpColor = avgRGBString(srSum, sgSum, sbSum, scnt, 0);
        }
        // 폴백: ENABLE_LANDMARK_POSTPROCESS가 꺼져있으면 faceExcludeMask가 항상
        // 텅 비어있어서(랜드마크 기반 제외 자체를 안 하니) 위 샘플링이 0건이 됨.
        // 이 경우 랜드마크와 무관하게, 각 컬럼의 "머리카락 시작 지점 바로 위" 픽셀
        // (머리카락으로 판정 안 된 곳 = 대체로 이마 피부)을 대신 샘플링한다.
        if(!scalpColor){
          let srSum=0, sgSum=0, sbSum=0, scnt=0;
          for(let x=0;x<w;x++){
            let topY=-1;
            for(let y=0;y<h;y++){ if(hairMaskBuf[y*w+x]>0){ topY=y; break; } }
            if(topY<=0) continue;
            const sampleY = Math.max(0, topY-3);
            const si = sampleY*w+x;
            if(hairMaskBuf[si]>0) continue; // 혹시 그 지점도 머리카락이면 스킵
            if(reasonMask[si]===3) continue; // 눈썹/눈/입 가드 픽셀이면 스킵 (어두운 색 오염 방지)
            const i = si;
            srSum+=srcPixels[i*4]; sgSum+=srcPixels[i*4+1]; sbSum+=srcPixels[i*4+2]; scnt++;
          }
          scalpColor = avgRGBString(srSum, sgSum, sbSum, scnt, 0);
        }

        /* ── 모발 프로필 실측 (2026-08-01) ────────────────────────────────
           <b>여기서</b> 재는 이유: srcPixels가 이 함수 밖으로 안 나간다. 나가는 건
           알파(hairC)와 축소 마스크뿐이라, 나중에 재려면 사진을 다시 읽어야 한다.
           실패해도 identity=null로 남고 나머지 파이프라인은 영향 없다(곁가지 데이터). */
        let identity = null;
        try{
          identity = measureViewHairIdentity({
            srcPixels, maskBuf: hairMaskBuf, w, h, reasonMask, personMask,
            orientation: orientationColSamples, colorPalette,
            scalpColorCss: scalpColor, hairColorCss: avgHairColor,
          });
          const d = identity.density;
          console.log('[모발프로필] ' + angle
            + ' · 뿌리밀도 ' + (d ? (d.measured + '/' + d.cells + '셀 실측'
                + (d.grown ? '(영역 부풀림)' : '(부풀림 없음 — personMask 없음)')) : '실패')
            + ' · 가닥피치 ' + (identity.pitchPx != null ? identity.pitchPx.toFixed(1)+'px(표본 '+identity.pitchN+')' : '못 잼')
            + ' · 곱슬 ' + (identity.curlDegPerPx != null ? identity.curlDegPerPx.toFixed(2)+'°/px(표본 '+identity.curlN+')' : '못 잼')
            + ' · 광택 ' + (identity.glossHiLo != null ? 'P90/P10 '+identity.glossHiLo.toFixed(2) : '못 잼')
            + ' · 헤어라인 접점 상/하 '
            + identity.hairlineTop.reduce((s,v)=>s+(v>=0?1:0),0) + '/'
            + identity.hairlineBot.reduce((s,v)=>s+(v>=0?1:0),0) + '컬럼');
          /* [진단] "숱 없음"으로 센 픽셀의 정체 — 두피인가 <b>광택</b>인가 (2026-08-18)
             밀도는 "머리색보다 두피색에 가까운 픽셀의 비율"이라, 검은 머리 위의
             흰 하이라이트가 통째로 <b>숱 없음</b>으로 넘어갈 수 있다. 그리고 그
             하이라이트가 앉는 자리가 하필 <b>귀 위</b>(정수리·후두부 상단)다.
             진짜 두피는 가닥 사이 그늘이라 노출된 살보다 <b>어둡고</b>, 하이라이트는
             <b>밝다</b> — 밝기 하나로 갈린다. */
          if(d && d.skinPixN){
            const glossPct = Math.round(d.glossFrac*100);
            console.log('[모발프로필·숱판정] ' + angle
              + ' · "숱 없음"으로 센 픽셀 ' + d.skinPixN + '개'
              + ' · 그중 두피색보다 <b>밝은</b> 것 ' + glossPct + '%'
              + ' | 평균밝기 ' + d.skinPixLuma.toFixed(0)
              + ' (두피색 ' + d.skinLuma.toFixed(0) + ' · 머리색 ' + d.hairLuma.toFixed(0) + ')'
              + (glossPct >= 50
                  ? '\n    ⚠ 절반 넘게 두피색보다 밝습니다 = <b>광택(하이라이트)을 두피로 세고 있습니다</b>.'
                    + ' 곧은 머리에서 그 띠는 귀 위에 앉으므로 정수리·후두부 상단이 통째로 "숱 없음"이 됩니다.'
                  : '\n    (절반 미만이면 실제로 가닥 사이 두피가 비치는 것 — 숱 판정을 믿어도 됩니다.)')
              + (d.glossFixed
                  ? '\n    → <b>보정 적용</b>(칸 ' + d.fixedCells + '개): 광택 ' + d.glossMoved + 'px를 두피→머리로 되돌림'
                    + ' · 대머리 칸 ' + d.baldBefore + ' → <b>' + d.baldAfter + '</b>개'
                    + ' · <b>평균밀도 ' + d.denBefore.toFixed(2) + ' → ' + d.denAfter.toFixed(2) + '</b>'
                    + ' (목표 가닥수는 밀도에 비례합니다 — 대머리가 아니어도 밀도가 깎이면 그만큼 성깁니다.'
                    + ' HAIR_IDENTITY.glossAsHair=false면 예전 동작)'
                  : '\n    → 보정 안 함(광택 지배 칸이 없음) — 대머리 칸 ' + d.baldAfter + '개·평균밀도 ' + d.denAfter.toFixed(2) + '는 실측 그대로입니다.')
              + (d.bands
                  ? '\n    [숱판정·구역] 이미지 세로 3등분 (상=정수리 쪽) — 광택비율 · 보정칸 · 밀도 전→후\n      '
                    + ['<b>상(정수리)</b>','중','하'].map((nm,i)=>{
                        const b = d.bands[i];
                        return nm + ' ' + Math.round(b.glossShare*100) + '% · ' + b.fixedCells + '칸 · '
                             + b.denBefore.toFixed(2) + '→' + b.denAfter.toFixed(2);
                      }).join('  |  ')
                    + '\n      상단 광택비율이 뷰 전체(' + Math.round(d.glossFrac*100) + '%)보다 높으면'
                    + ' <b>정수리만 광택 지배</b>라는 뜻입니다 — 뷰 평균으로는 안 걸리던 그 자리입니다.'
                  : '')
              + (Math.abs(d.skinLuma - d.hairLuma) < 25
                  ? '\n    ⚠ <b>두피색과 머리색이 너무 가깝습니다</b>(차이 ' + Math.abs(d.skinLuma-d.hairLuma).toFixed(0) + ').'
                    + ' 이 뷰는 얼굴 피부를 못 봐서 두피색이 배경·머리에서 왔을 수 있습니다 — 그러면 "머리색에 가까운가"라는 판정 자체가 동전던지기입니다.'
                    + ' ([두피이식]이 이 뷰를 front에서 가져다 쓰고 있는지 같이 볼 것)'
                  : ''));
          }
        }catch(e){ console.warn('모발 프로필 실측 실패(무시):', angle, e); }

        state.hairCanvases[angle] = hairC;
        state.baseCanvases[angle] = baseC;
        state.hairMasks[angle]    = {
          identity, // (2026-08-01) 형태와 무관한 모발 프로필 — 밀도격자·피치·곱슬·광택·헤어라인
          scalpY, hairEndY, w:img.width, h:img.height, avgColor:avgHairColor,
          avgColorsBySection, // 섹션별(크라운/프론트/템플/사이드/후두부/네이프) 평균 헤어 색상
          colorPalette, // 실측 색 팔레트(마스크 안 실제 픽셀 색 최대 512개) — 원본 모드 가닥 색 분포 재현용
          scalpColor, // 얼굴 피부에서 샘플링한 두피/피부 톤 — 가닥 사이 언더코트에 사용
          // 결방향 필드는 축소 해상도(maskW,maskH) 좌표계로 저장됨 — 사용 시 비율 변환 필요
          orientation: orientationColSamples,
          maskW: w, maskH: h,
          /* 원본 사진 픽셀(maskW×maskH, RGB 3바이트). 가닥마다 <b>자기 경로 위의</b>
             실제 색을 읽어 입히는 데 쓴다(HAIR_PIXEL_COLOR 참고). 여기서 떠 두는 이유는
             이 블록이 srcPixels가 살아 있는 유일한 자리이기 때문 — 나가면 사진을 다시
             읽어야 한다(위 hairIdentity 주석과 같은 사정).
             알파를 버리고 3바이트로 담아 25% 절약(768² 기준 뷰당 1.7MB). */
          photoRGB: packPhotoRGB(srcPixels, w, h),
          reasonMask, // [진단용] 0:미해당 1:최종 머리카락 2:얼굴박스로 제외 3:눈썹/눈/입 가드로 제외
          reasonCanvas: null,    // [진단용] getReasonCanvas가 <b>볼 때만</b> 굽는다(2026-08-23). 재료는 아래 reasonMask
          faceBoxDiag, // [진단용] 얼굴제거박스 좌표/사용 랜드마크 — "얼굴박스 보기" 토글에서 사용
          personMask // (2026-07-14 추가) 0:배경 1:사람(피부/옷 포함) — maskW×maskH 해상도,
                     // 목 실루엣 실측(computeNeckCrossSections)용. bodySegmenter 로드
                     // 실패 시 null일 수 있음 — 그 경우 목은 고정값으로 폴백.
        };
        console.log('[진단] extractHairMask 완료', angle, 'faceBoxDiag=', faceBoxDiag);
        resolve(true);
      }catch(e){
        console.warn('extractHairMask 실패:', angle, e);
        resolve(false);
      }
    };
    img.src = dataUrl;
  });
}

/* ────────────────────────────────────────
   유틸: HSV hair 색상 판별 (어두운 갈색~흑색 계열)
──────────────────────────────────────── */
// hueDegrees: RGB에서 hue(0~360)만 계산하는 공용 헬퍼.
// isHairColor / isHairColorRelaxed 양쪽에서 동일하게 쓰던 공식을 하나로 통합.
function hueDegrees(r,g,b,maxC,minC){
  const hRaw=maxC>0?( maxC===r?((g-b)/(maxC-minC+0.001))%6
                    : maxC===g?((b-r)/(maxC-minC+0.001))+2
                    :           ((r-g)/(maxC-minC+0.001))+4 )*60 : 0;
  return (hRaw+360)%360;
}
/* ── 헤어 색 판정 (2026-08-02 통합) ────────────────────────────────
   isHairColor(엄격)와 isHairColorRelaxed(완화)가 HSV 계산 세 줄과 판정 규칙
   골격을 각자 복제하고 있었다. 실제로 다른 건 <b>임계값</b>과 "어두운 색은
   무조건 머리카락" 규칙의 유무뿐이라, 규칙은 한 곳에 두고 값만 표로 뺐다.
   세 규칙은 전부 OR(하나라도 걸리면 true)이라 순서를 합쳐도 결과가 같다.
     darkV   — 이보다 어두우면 무조건 머리카락(완화판은 null = 이 규칙 없음)
     gray*   — 회색·새치·백발: 저채도이면서 밝기가 이 구간
     warm*   — 채도 있는 갈색/적갈색/금발: hue가 hueLo 미만 또는 hueHi 초과 */
const HAIR_COLOR_STRICT  = { darkV:0.55, grayS:0.18, grayVMin:0.55, grayVMax:0.90, warmS:0.15, warmV:0.80, hueLo:50, hueHi:300 };
const HAIR_COLOR_RELAXED = { darkV:null, grayS:0.15, grayVMin:0.55, grayVMax:0.94, warmS:0.12, warmV:0.88, hueLo:55, hueHi:295 };
function isHairColorBy(r,g,b,P){
  const maxC=Math.max(r,g,b), minC=Math.min(r,g,b);
  const v=maxC/255;
  const s=maxC>0?(maxC-minC)/maxC:0;

  if(P.darkV !== null && v < P.darkV) return true;                    // 흑발·어두운 색
  if(s < P.grayS && v >= P.grayVMin && v < P.grayVMax) return true;   // 회색·새치·백발
  if(s > P.warmS && v < P.warmV){                                     // 갈색·적갈색·금발
    const hh=hueDegrees(r,g,b,maxC,minC);
    if(hh < P.hueLo || hh > P.hueHi) return true;
  }
  return false;
}
// 흑발·갈색·금발·회색·백발(새치) 모두 인식
function isHairColor(r,g,b){ return isHairColorBy(r,g,b,HAIR_COLOR_STRICT); }

// 귀 밴드(좌/우 각각) 픽셀 순회 — 밴드 기하(중심 ex ± bandHalfW, yTop~yBot)를
// 한 곳에서만 계산하도록 통합(2026-07-18). extractHairMask 안에서 같은 3중
// 루프 골격이 두 번(마스크 채움 / bandMask 복사) 복제돼 있던 것 — 범위 식이
// 한쪽만 바뀌면 두 단계가 서로 다른 영역을 보게 되는 구조라 하나로 모음.
// 콜백에 경계 안팎을 그대로 넘기므로(클램프 안 함) 호출부의 기존 경계 검사는
// 그대로 유지 — 동작 무변경.
function forEachEarBandPixel(earXs, bandHalfW, yTopBand, yBotBand, w, h, fn){
  for(const ex of earXs){
    const xS = Math.round(Math.max(0, ex - bandHalfW) * w);
    const xE = Math.round(Math.min(1, ex + bandHalfW) * w);
    for(let y=Math.round(yTopBand); y<Math.round(yBotBand); y++){
      for(let x=xS; x<xE; x++) fn(x, y);
    }
  }
}

// isHairColorRelaxed: isHairColor보다 완화된 기준.
// 화면 전체가 아니라 귀 주변(옆머리) 좁은 영역에서만 보조로 사용.
// 밝은 조명을 받은 잔머리(하이라이트 진 가는 머리카락)는 채도가 낮으면서도
// 밝기가 0.90 근처까지 올라가 기존 조건(v<0.90)에서 누락되는 경우가 많아
// 밝기 상한을 완화하되, 순수 배경/피부와 헷갈리지 않도록 채도 조건은 더 좁게 유지.
// 완화판: 저채도 밝은 잔머리까지 인정하고(밝기 상한 확장), 어두운 색 무조건 규칙은 없다
function isHairColorRelaxed(r,g,b){ return isHairColorBy(r,g,b,HAIR_COLOR_RELAXED); }

// hasHairTexture: 국소(5x5 기본) 밝기 분산으로 "결이 있는 재질(머리카락)" vs
// "매끈한 재질(안경테 등)"을 구분한다.
// 안경다리/렌즈테는 통짜 플라스틱·금속이라 작은 창 안에서 밝기가 거의 균일(분산 낮음).
// 반대로 실제 머리카락은 가는 결 하나하나가 서로 다른 밝기를 가져 국소 분산이 큼
// (흑발이든 백발이든 색과 무관하게 성립하는 재질 특성).
// isHairColorRelaxed는 색만 보므로, 색이 맞아도 이 텍스처 조건을 통과 못하면
// 안경/매끈한 표면으로 간주해 제외한다.
// TEXTURE_VAR_THRESHOLD는 실측 없이 잡은 초기값 — 조명이 아주 평평한 사진에서
// 진짜 머리카락까지 걸러질 위험이 있어 추후 실측 데이터로 재조정 필요.
const TEXTURE_VAR_THRESHOLD = 30; // 밝기(0~255) 분산 기준, 표준편차로는 약 5.5
function hasHairTexture(gray, w, h, x, y, radius){
  radius = radius || 2; // 기본 5x5 윈도우
  const xs=Math.max(0,x-radius), xe=Math.min(w-1,x+radius);
  const ys=Math.max(0,y-radius), ye=Math.min(h-1,y+radius);
  let sum=0, sumSq=0, count=0;
  for(let ny=ys; ny<=ye; ny++){
    const row=ny*w;
    for(let nx=xs; nx<=xe; nx++){
      const v=gray[row+nx];
      sum+=v; sumSq+=v*v; count++;
    }
  }
  if(count===0) return true; // 창을 못 만들면(경계) 보수적으로 통과시킴
  const mean = sum/count;
  const variance = sumSq/count - mean*mean;
  return variance >= TEXTURE_VAR_THRESHOLD;
}

/* ────────────────────────────────────────
   유틸: 모폴로지 연산 (마스크 품질 향상)
──────────────────────────────────────── */
// separable 모폴로지 연산 공용 헬퍼 (dilate/erode가 공유)
// 저사양 기기 성능을 위해 brute-force 대신 가로→세로 1차원 패스로 처리
// 연산량 O(w*h*r^2) → O(w*h*r) 로 대폭 감소
// dilating=true: 팽창(경계 밖은 클램프, 하나라도 켜지면 255)
// dilating=false: 침식(경계 밖은 배경으로 취급, 하나라도 꺼지면 0)
function morphSeparable(buf, w, h, radius, dilating){
  if(radius<=0) return new Uint8Array(buf);
  const tmp = new Uint8Array(w*h);
  for(let y=0;y<h;y++){
    const row=y*w;
    for(let x=0;x<w;x++){
      let v = dilating?0:255;
      if(dilating){
        const xs=Math.max(0,x-radius), xe=Math.min(w-1,x+radius);
        for(let nx=xs;nx<=xe;nx++){ if(buf[row+nx]>0){ v=255; break; } }
      } else {
        const xs=x-radius, xe=x+radius;
        for(let nx=xs;nx<=xe;nx++){ if(nx<0||nx>=w||buf[row+nx]===0){ v=0; break; } }
      }
      tmp[row+x]=v;
    }
  }
  const out = new Uint8Array(w*h);
  for(let x=0;x<w;x++){
    for(let y=0;y<h;y++){
      let v = dilating?0:255;
      if(dilating){
        const ys=Math.max(0,y-radius), ye=Math.min(h-1,y+radius);
        for(let ny=ys;ny<=ye;ny++){ if(tmp[ny*w+x]>0){ v=255; break; } }
      } else {
        const ys=y-radius, ye=y+radius;
        for(let ny=ys;ny<=ye;ny++){ if(ny<0||ny>=h||tmp[ny*w+x]===0){ v=0; break; } }
      }
      out[y*w+x]=v;
    }
  }
  return out;
}

// dilate: 마스크를 radius 픽셀만큼 팽창 (사이드 하단 경계 확장)
function dilate(buf, w, h, radius){
  return morphSeparable(buf, w, h, radius, true);
}

// erode: 마스크를 radius 픽셀만큼 침식 (노이즈 제거)
function erode(buf, w, h, radius){
  return morphSeparable(buf, w, h, radius, false);
}

// closing = dilate → erode: 구멍 채우기 (사이드 하단 단절 구간 연결)
function morphClose(buf, w, h, radius){
  return erode(dilate(buf, w, h, radius), w, h, radius);
}

// fillColumnGaps: 각 열에서 마스크 픽셀 사이 빈 구간을 채움
// (머리카락이 희박하게 감지된 열에서 위아래 사이 구멍 메우기)
function fillColumnGaps(buf, w, h, maxGap){
  const out = new Uint8Array(buf);
  for(let x=0;x<w;x++){
    let lastOn=-1;
    for(let y=0;y<h;y++){
      if(buf[y*w+x]>0){
        if(lastOn>=0 && (y-lastOn-1)<=maxGap){
          for(let fy=lastOn+1;fy<y;fy++) out[fy*w+x]=255;
        }
        lastOn=y;
      }
    }
  }
  return out;
}

// ── 하이라이트로 날아간 부분 보강: 색과 무관한 "둘러싸인 구멍" 채우기 ──
// 완전히 하얗게 날아간(RGB≈255,255,255) 픽셀은 원래 색 정보 자체가 사라져서,
// 색 기반 필터(isHairColor 등)로는 원리적으로 "머리카락이었는지 벽/옷이었는지"
// 구분이 불가능함 — 밝기 임계값을 억지로 올리면 흰 벽·흰 옷깃까지 오탐할
// 위험이 커짐(실측 확인 필요 없이 원리적으로 그럼).
// 그래서 색을 전혀 안 보고 keepLargestComponents()와 반대 방향으로 접근한다:
// 배경(0)쪽 연결요소를 찾아서, (a) 이미지 테두리와 안 이어져 있고(=진짜 배경이
// 아니라 머리카락에 둘러싸인 구멍) (b) boundBox 면적 대비 충분히 작은(=벽처럼
// 큰 영역이 아니라 국소 하이라이트로 보이는) 것만 채운다. 진짜 배경은 항상
// 이미지 테두리와 연결돼 있어 (a)에서 걸러지고, 얼굴 같은 큰 미분류 영역은
// (b) 크기 상한에서 걸러지므로 색 기반 방식과 달리 오탐 위험이 구조적으로 낮음.
// maxHoleAreaFrac은 실측 없이 잡은 초기값 — 하이라이트 패치가 이보다 크면
// 여전히 안 채워질 수 있음, 실사진으로 재조정 필요.
/* ── 8방향 연결요소 라벨링 (2026-08-02 통합) ────────────────────────
   fillEnclosedHighlightHoles(배경 0 픽셀을 묶음)와 keepLargestComponents(마스크
   픽셀을 묶음)가 이 스택 기반 순회를 <b>글자 그대로</b> 복제하고 있었다. 다른 건
   "어느 픽셀을 고르나"와 "테두리 접촉을 기록하나" 둘뿐이었는데, 후자는 기록해도
   쓰지 않으면 그만이라 항상 기록한다.
   고를 픽셀은 sel(0/1) 배열로 미리 한 번 훑어서 정한다 — 안쪽 루프에서 조건을
   함수로 부르면 픽셀당 8번씩 호출돼 느려진다(마스크는 100만 픽셀 단위다).
   반환: labels(-1=비대상) / areas[label] / touchesBorder[label]. */
function labelComponents8(buf, w, h, wantPositive){
  const n = w*h;
  const sel = new Uint8Array(n);
  for(let i=0;i<n;i++) sel[i] = (wantPositive ? buf[i]>0 : buf[i]===0) ? 1 : 0;
  const labels = new Int32Array(n).fill(-1);
  const areas = [];
  const touchesBorder = [];
  const stack = new Int32Array(n);
  let nextLabel = 0;
  for(let start=0; start<n; start++){
    if(!sel[start] || labels[start]>=0) continue;
    let sp=0; stack[sp++]=start; labels[start]=nextLabel;
    let area=0, border=false;
    while(sp>0){
      const p = stack[--sp];
      area++;
      const px = p % w, py = (p - px) / w;
      if(px===0 || px===w-1 || py===0 || py===h-1) border = true;
      for(let dy=-1; dy<=1; dy++){
        for(let dx=-1; dx<=1; dx++){
          if(dx===0 && dy===0) continue;
          const nx=px+dx, ny=py+dy;
          if(nx<0||nx>=w||ny<0||ny>=h) continue;
          const np = ny*w+nx;
          if(sel[np] && labels[np]<0){ labels[np]=nextLabel; stack[sp++]=np; }
        }
      }
    }
    areas.push(area); touchesBorder.push(border);
    nextLabel++;
  }
  return { labels, areas, touchesBorder };
}

function fillEnclosedHighlightHoles(buf, w, h, boundBox, maxHoleAreaFrac){
  const n = w*h;
  const { labels, areas, touchesBorder } = labelComponents8(buf, w, h, false); // 배경(0) 픽셀만 대상
  const boundArea = Math.max(1, (boundBox.xE-boundBox.xS) * (boundBox.yE-boundBox.yS));
  const maxHoleArea = boundArea * maxHoleAreaFrac;
  const out = new Uint8Array(buf);
  for(let i=0;i<n;i++){
    if(buf[i]>0) continue;
    const lbl = labels[i];
    if(lbl<0) continue;
    const px = i % w, py = (i - px) / w;
    if(px<boundBox.xS || px>=boundBox.xE || py<boundBox.yS || py>=boundBox.yE) continue; // boundBox 밖은 안전하게 스킵
    if(!touchesBorder[lbl] && areas[lbl] <= maxHoleArea) out[i] = 255;
  }
  return out;
}

// keepLargestComponents: 마스크를 8방향 연결 요소로 분리하고, 가장 큰 덩어리(주로
// "실제 머리") 대비 일정 비율보다 작은 고립된 섬은 지워버린다.
// 배경/옷깃/안경테 등을 얇게 오탐한 작은 덩어리가 본체 머리카락과 이어지지 않은 채
// 따로 떠 있는 경우, scalpY는 "마스크만 있으면 유효 컬럼"으로 인정하기 때문에
// 그 위에도 정상적으로 가닥이 심어져 "머리에서 떨어진 덩어리"로 보이는 문제가 있었음.
// minRatio: 최대 덩어리 면적 대비 이 비율보다 작은 컴포넌트는 제거 (기본 3%)
function keepLargestComponents(buf, w, h, minRatio){
  const n = w*h;
  const { labels, areas } = labelComponents8(buf, w, h, true); // 마스크(>0) 픽셀만 대상
  if(areas.length <= 1) return buf; // 덩어리가 하나뿐이면(또는 없으면) 그대로
  const maxArea = Math.max(...areas);
  const threshold = maxArea * minRatio;
  const out = new Uint8Array(n);
  for(let i=0;i<n;i++){
    const lbl = labels[i];
    if(lbl>=0 && areas[lbl] >= threshold) out[i] = buf[i];
  }
  return out;
}

