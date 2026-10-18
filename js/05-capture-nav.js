/* ══════════════════════════════════════════════════════════
   05-capture-nav.js — 화면 전환 · 촬영 · 실시간 각도 가이드
   원본 index.html 8140~9176행. 클래식 스크립트이므로 로드 순서가 곧
   실행 순서다 — index.html의 <script src> 순서를 바꾸지 말 것.
   ══════════════════════════════════════════════════════════ */
/* ════════════════════════════════════════
   NAVIGATION
════════════════════════════════════════ */
/* (2026-10 · 옛 34-skip-result.js) 2D 결과(result) 단계를 건너뛰고 조정 → 3D 두상으로 바로 — 5단계 → 4단계(navTo 첫머리 참고).
   result 항목은 화면 자체는 남아 있어 그대로 둔다. 번역은 18 I18N. */
const STAGE_NAMES={capture:'1/4 · 촬영',style:'2/4 · 스타일',adjust:'3/4 · 조정',result:'4/5 · 결과',model3d:'4/4 · 3D두상'};

// nav-* 탭의 disabled를 해제 (진행 단계에 따라 잠금 해제)
function unlockTab(id){ const t=document.getElementById('nav-'+id); if(t) t.disabled=false; }

// 'style' 화면 최초 진입 시 실행되는 AI 분석 파이프라인
// (세그멘터 대기 → 각도별 랜드마크/헤어마스크 추출 → 뷰 매핑 → Claude 분석 요청)
function runStyleAnalysisPipeline(){
  // (옛 40 GPU 다이어트 ②) 분석용 모델을 내려놓았으면 다시 올라올 때까지 기다렸다가 → runStyleAnalysisPipelineBase
  return GPU_DIET._pipe(this, arguments);
}
window.__anaLine = function(){
  const T = window.__anaTimes; if(!T) return '[시간·사진분석] 아직 안 함';
  const r = v => Math.round(v);
  return '[시간·사진분석] 합계 ' + r(T.total||0) + 'ms · 모델 기다림 ' + r(T.wait) + 'ms · ' +
    T.views.map(v => v.a + ' 랜드마크 ' + r(v.lm) + ' / 머리 추출 ' + r(v.mask) + ' / 섹션 ' + r(v.sec)).join(' · ');
};
async function runStyleAnalysisPipelineBase(){
  // segmenter가 아직 로딩 중이면 잠깐 대기 (최대 6초)
  const _T = window.__anaTimes = { wait:0, views:[], t0:performance.now() };
  if(!segmenterReady && !segmenterError){
    showAI('모델 로딩 중…', 'Hair Segmentation 준비 중');
    let waited = 0;
    while(!segmenterReady && !segmenterError && waited < 6000){
      await new Promise(r=>setTimeout(r,300)); waited+=300;
    }
    _T.wait = waited;
  }
  if(segmenter){
    const validAngles = ANGLES.filter(a=>state.shots[a]);
    let done = 0;
    for(const a of validAngles){
      showAI(
        `머리카락 추출 중… ${done+1}/${validAngles.length}`,
        `${ANGLE_LABELS[a]} 처리 중`
      );
      // Face Landmarker: 랜드마크를 먼저 감지해야 extractHairMask에서
      // 얼굴 위치 기반으로 정확한 제거 영역을 잡을 수 있음 (정면/측면 모두 대응)
      const _v = { a:a, lm:0, mask:0, sec:0 }; let _t = performance.now();
      if(faceLandmarkerReady){
        showAI(`얼굴 분석 중… ${done+1}/${validAngles.length}`, `${ANGLE_LABELS[a]} 랜드마크 감지`);
        await detectFaceLandmarks(a);
      }
      _v.lm = performance.now() - _t; _t = performance.now();
      showAI(`머리카락 추출 중… ${done+1}/${validAngles.length}`, `${ANGLE_LABELS[a]} 처리 중`);
      await extractHairMask(a);
      _v.mask = performance.now() - _t; _t = performance.now();
      if(faceLandmarkerReady){
        refineSectionBoundaries(a);
      }
      _v.sec = performance.now() - _t; _T.views.push(_v);
      done++;
    }
    hideAI();
  }
  _T.total = performance.now() - _T.t0;
  try{ console.log(window.__anaLine()); }catch(e){}
  /* (2026-08-29) 여기서 analyzeWithClaude()를 부르던 것을 걷어냈다. 이 파이프라인이
     하는 일은 이제 <b>세그멘테이션 + 랜드마크</b>뿐이고, 그건 조정 화면의 재료라
     스타일 추천과 무관하게 계속 필요하다. 플래그는 "재료가 준비됐다"는 뜻이다. */
  stylePrepDone = true;
}

// 화면 전환의 순수 DOM 작업만 담당: .screen/.nav-tab active 토글, 단계 라벨, currentScreen 갱신
function activateScreen(name){
  // (옛 40 GPU 다이어트 ②) 촬영 화면으로 돌아오면 내려놓았던 분석 모델을 다시 올림
  if(typeof GPU_DIET !== 'undefined') GPU_DIET._beforeActivate(name);
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById('screen-'+name).classList.add('active');
  document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));
  const tab = document.getElementById('nav-'+name);
  if(tab) tab.classList.add('active');
  document.getElementById('stageLabel').innerHTML='단계 <b>'+STAGE_NAMES[name]+'</b>';
  const _prev = currentScreen;
  currentScreen = name; // 먼저 업데이트
  // 촬영 화면을 벗어나면 실시간 각도 가이드 루프를 멈춰야 함(카메라 프레임을
  // 계속 detect하면 다른 화면의 3D 렌더링과 CPU를 다툼).
  if(typeof syncLiveGuide === 'function') syncLiveGuide();
  /* 조정·결과 화면을 <b>벗어날 때</b> 스크래치를 돌려준다 (2026-08-23).
     그 두 화면만 풀을 크게 쓴다. 들어올 때가 아니라 나갈 때 하는 이유는,
     다음 화면(특히 3D 결과보기)이 WebGL 자원을 요구하기 <b>전에</b> 자리를
     비워 줘야 크롬이 남의 백킹스토어를 회수하지 않기 때문이다. */
  if(_prev !== name && (_prev === 'adjust' || _prev === 'result')){
    try{ trimScratchMemory(_prev + '→' + name); }catch(e){}
    try{ trimDerivedCanvases(state.currentViewAngle, _prev + '→' + name); }catch(e){}
  }
  // (옛 37 폰 다이어트 ③) 3D 결과 화면을 나가면 장면(헤어·얼굴·의상) GPU 버퍼 반납 · 조정 화면이면 3D 헤어 미리 만들기
  if(typeof MOBILE_DIET !== 'undefined') MOBILE_DIET.afterActivate(_prev, name);
  // (옛 38 진단 도구 ①) 촬영 화면 밖에서는 카메라를 끄고, 돌아오면 다시 켬
  if(typeof DIAG_TOOLS !== 'undefined') DIAG_TOOLS.afterActivate(name);
  // (옛 40 GPU 다이어트 ②) 조정·3D 화면에 들어가면 잠시 뒤 분석 모델 내려놓기
  if(typeof GPU_DIET !== 'undefined') GPU_DIET._afterActivate(name);
  // (옛 43) 조정 화면에 들어오면 3D 장면 준비
  if(typeof ADJUST3D !== 'undefined') ADJUST3D._afterActivate(name);
  // (옛 53) 조정 화면을 떠나면 3D 빗질 모드 끔
  if(typeof COMB3D !== 'undefined') COMB3D._afterUi('activateScreen', name);
  if(typeof FLY_TRIM !== 'undefined') FLY_TRIM._patchRender();   // (옛 55)
  if(typeof PHOTO_CHECK !== 'undefined') PHOTO_CHECK._afterActivate(name);   // (옛 60) 조정 화면 밖이면 원본 대조 닫기
}
/* 탭이 뒤로 가면(다른 앱·화면 잠금) 어차피 아무것도 안 그린다. 폰에서 백그라운드
   탭은 메모리 압박 때 <b>제일 먼저</b> 회수 대상이 되므로, 돌려줄 수 있는 것을
   미리 돌려주면 돌아왔을 때 백지가 될 확률이 준다. */
document.addEventListener('visibilitychange', ()=>{
  if(document.visibilityState === 'hidden'){
    try{ trimScratchMemory('탭 숨김'); }catch(e){}
    try{ trimDerivedCanvases(state.currentViewAngle, '탭 숨김'); }catch(e){}
  }
});

// 상태텍스트: 현재 진단 중인 항목(각도 탭 vs 실측 3D 포즈)만 남김.
// 마스크픽셀/랜드마크진단/배경가드 등 세그멘테이션 관련 긴 로그(state._diagLog)는
// 지금 확인 대상이 아니라서 제거 — 필요해지면 그때 다시 노출.
// 버그 수정: 예전엔 이 로직이 setupAdjustScreen() 안에 인라인으로 있어서 조정 화면
// "최초 진입" 시점에만 계산됐음 — 각도 탭(정면/좌측/우측/후면) 전환 핸들러는 이 함수를
// 다시 호출하지 않아서, 탭을 바꿔도 화면엔 항상 최초 진입 당시의 각도(front) 값이
// 그대로 남아있었음(실제 계산은 각도별로 맞게 되고 있었는데 "표시"만 고정된 버그).
// → 독립 함수로 분리해서 화면 진입 시점과 탭 전환 시점 둘 다에서 호출되게 함.
function updateSegStatus(){
  const angle = state.currentViewAngle;
  const el = document.getElementById('segStatus');
  if(!el) return;
  const lm = state.landmarks && state.landmarks[angle];
  if(lm && typeof lm.poseYawDeg === 'number'){
    el.textContent = `[${ANGLE_LABELS[angle]}] poseYaw:${lm.poseYawDeg.toFixed(1)}° pitch:${(lm.posePitchDeg??0).toFixed(1)}° roll:${(lm.poseRollDeg??0).toFixed(1)}° (근사yaw:${lm.yaw.toFixed(2)})`;
  } else if(lm){
    el.textContent = `[${ANGLE_LABELS[angle]}] 포즈행렬 없음 — 근사yaw:${lm.yaw.toFixed(2)}만 사용`;
  } else {
    // 랜드마크가 없어도 셔터 시점 라이브 실측이 있으면 그 값이 실제로 쓰이는 각도다
    const cap = getCapturePose(angle);
    el.textContent = cap
      ? `[${ANGLE_LABELS[angle]}] 랜드마크 없음 — 촬영시점 실측 사용 yaw:${cap.yawDeg.toFixed(1)}° pitch:${(cap.pitchDeg??0).toFixed(1)}° roll:${(cap.rollDeg??0).toFixed(1)}°`
      : `[${ANGLE_LABELS[angle]}] 랜드마크 없음 — 슬롯 기본각 ${(ASSUMED_YAW_DEG[angle] ?? 0)}° 가정`;
  }
}

// 'adjust' 화면 진입 시 셋업: 디버그 토글 상태 동기화, 세그멘테이션 상태 표시,
// 섹션 탭 구성, globalCurl 슬라이더 동기화, 프리뷰 렌더
function setupAdjustScreen(){
  const _omPending = ORIG_MQ._beforeSetupAdjust();   // (옛 58) 원본을 보던 중 사진이 바뀌었으면 원본으로 되돌릴 준비(17b)
  const _rgPending = state.pendingSpecId;   // (옛 42) 끝에서 씀
  unlockTab('adjust'); renderAngleSwitch('angleSwitch');
  bindAdjustViewGestures(); syncAdjustZoomUI();   // (2026-08-08) 확대/이동 손잡이
  /* ── 빗질은 화면에 들어올 때마다 <b>꺼진 채로</b> 시작한다 (2026-08-30 2차) ──
     사용자: "comb 디폴트 값 on으로 되어 있어." 선언은 false인데 화면에서는 켜져
     있었다 — 둘 다 사실이다. COMB.on을 <b>false로 되돌리는 곳이 한 군데도 없었기</b>
     때문이다. 한 번 켜면 스타일을 바꿔도 마네킹을 리셋해도 그대로 켜져 있고
     (mannequinReset은 획만 지우고 모드는 안 껐다), 그래서 다음 진입 때 "원래
     켜져 있는 것"으로 보인다. 선언 기본값은 <b>처음 한 번</b>만 뜻이 있고
     그 뒤로는 아무 뜻이 없었던 것이다.
     ⚠ 이건 이 파일이 반복해서 당한 "값이 코드에 있다고 쓰이는 게 아니다"의
       상태(state) 판이다. 기본값은 선언이 아니라 <b>매번 그 값이 되는 자리</b>가
       있어야 기본값이다. */
  COMB.on = false; syncCombBtn();
  /* ── 3D 미리보기도 <b>매번 그 값이 되는 자리</b>가 필요하다 (2026-09-13) ─────
     바로 위 COMB.on 배너와 같은 이유다. state.use3DAdjust를 true로 바꿔도
     패널을 여는 코드는 toggle3DAdjust 안의 showDevMini3D(true) 하나뿐이라,
     버튼을 아무도 안 누르면 <b>상태는 ON인데 화면엔 패널이 없다</b>.
     여기서 상태 → 화면을 맞춘다. 손님 앞에서 껐다면 그 세션 동안은 꺼진 채로
     남는다(state를 안 덮어쓰고 화면만 맞추므로). */
  sync3DPreviewPanel();
  syncMannequinBtn();                             // 마네킹 초기화 상태 표시(스타일 화면에서 정해져 들어온다)
  const maskBtn = document.getElementById('maskDebugToggle');
  if(maskBtn){
    maskBtn.classList.toggle('on', state.debugShowMask);
    maskBtn.textContent = state.debugShowMask ? '마스크 보기' : '가닥 보기';
  }
  const rawBtn = document.getElementById('rawDebugToggle');
  if(rawBtn){
    rawBtn.classList.toggle('on', state.debugShowRaw);
    rawBtn.textContent = state.debugShowRaw ? '스타일 보기' : '원본 결 보기';
  }
  const styleTag = document.getElementById('adjustStyleTag');
  if(styleTag && state.debugShowRaw){
    styleTag.textContent = '원본 결 (스타일 미적용)';
  }
  updateSegStatus();
  buildGyPanel();
  setTimeout(()=>drawAdjustPreview(),80);

  /* ── (2026-08-29) 스타일 화면에서 고른 스펙을 <b>여기서</b> 건다 ──────────
     스펙 역산(solveSectionLengthForTipY / ...ForCm)은 state.hair3Dneutral의 실제
     가닥을 이분탐색으로 돌려서 끝 높이를 재는 것이라 3D 모델이 있어야 한다.
     스타일 화면에는 그 모델이 없으므로 예약만 해 두고 조정 화면에서 푼다.
     모델이 아직 없으면 applyStyleSpecAndRender가 buildNeutralHair3D를 부르고
     콜백에서 자기를 다시 부른다(_retried 경로) — 여기서 따로 기다릴 필요 없다.
     ⚠ specAppliedId를 비우고 부른다: 같은 id면 applyStyleSpecAndRender가
       <b>토글로 해제</b>하는 함수라, 안 비우면 방금 고른 스타일이 곧바로 풀린다. */
  const pend = state.pendingSpecId;
  if(pend){
    state.pendingSpecId = null;
    state.specAppliedId = null;
    setTimeout(()=>{
      try{ applyStyleSpecAndRender(pend); }
      catch(e){ console.warn('[스타일스펙] 스타일 화면에서 예약한 스펙 적용 실패:', e); }
    }, 120);
  }
  // (옛 42) 마네킹이 꺼져 있으면(스타일을 안 골랐거나 껐으면) 바로 다시 기른 머리(17b REGROW)
  REGROW._afterSetupAdjust(_rgPending);
  ORIG_MQ._afterSetupAdjust(_omPending);   // (옛 58)
}

/* ==========================================================================
 * PHOTO_CHANGE (옛 49-photo-change.js) — 사진이 바뀌면 사람(얼굴·두상·머리)도 바뀌게
 *
 * 자리: 05, navTo 바로 앞. navTo 맨 앞에서 await PHOTO_CHANGE._beforeNav(name) · startNewCustomer(18) 맨 앞 PHOTO_CHANGE._forget() · perfPanelLines(18) 끝 줄
 *
 * 증상 (2026-10-04 사용자): 다른 사람 사진을 올렸는데 조정 화면의 사람이 그대로.
 *
 * 원인: 사진에서 만든 것들(머리 영역 · 3D 머리 모델 · 두상 치수 · 얼굴)을 비우는 자리가
 *   [새로 시작]과 360° 세트 불러오기뿐이었습니다.
 *     · [업로드](handleFileUpload)는 사진만 갈아 끼우고 아무것도 안 비움 —
 *       머리 영역 다시 뽑기(stylePrepDone)조차 안 켜져서 예전 사람의 분석이 그대로 남음.
 *     · [재촬영] · [저장된 사진 쓰기]는 머리 영역은 다시 뽑지만 3D 머리 모델(state.hair3Dneutral)은 안 비움.
 *   3D 모델은 "없을 때만" 새로 만들고, 조정 화면 3D(43번)는 그 모델이 바뀔 때만 두상·얼굴을 다시 만들기 때문에
 *   예전 사람이 그대로 보였습니다. (예전 2D 조정 화면은 사진을 직접 그려서 사진만 바뀌어 보였음.)
 *
 * 고침: 사진을 넣는 길이 여러 갈래라 길마다 고치지 않고, 촬영 화면을 떠날 때 한 군데서 확인합니다.
 *   4장 사진의 지문이 지난번 분석 때와 다르면 →
 *     사진에서 만든 것 전부 비움([새로 시작]과 같은 목록 — 사진·랜드마크·고른 스타일은 그대로 둠)
 *     → 머리 영역·랜드마크 다시 분석 → 3D 모델·두상·얼굴은 조정 화면이 새로 만듦.
 *   고른 스타일이 있으면 새 사람 두상에 맞춰 다시 겁니다(길이를 새 두상 기준으로 다시 풂).
 *
 * 끄기: PHOTO_CHANGE.on=false
 * ========================================================================== */
var PHOTO_CHANGE = (function () {
  'use strict';
  var W = window, TAG = '[사진 바뀜]';
  var P = Object.assign({ on: true }, W.PHOTO_CHANGE || {});
  var S = P.stats = { resets: 0, lastAt: null, lastAngles: '' };
  var doneSig = null;                                 // 지난번에 분석을 맡긴 사진들의 지문(각도별)

  function angles() { try { return ANGLES; } catch (e) { return ['front', 'left', 'right', 'back']; } }
  function sigOf(s) {
    if (!s) return '';
    var n = s.length, m = n >> 1;
    return n + ':' + s.slice(m, m + 24) + ':' + s.slice(-40);
  }
  function sigs() {
    var o = {};
    angles().forEach(function (a) { var s = null; try { s = state.shots && state.shots[a]; } catch (e) {} o[a] = sigOf(s); });
    return o;
  }
  function changed(now) {
    if (!doneSig) return angles().filter(function (a) { return now[a]; });
    return angles().filter(function (a) { return now[a] !== doneSig[a]; });
  }
  function tryDo(fn) { try { fn(); } catch (e) {} }

  /* 사진에서 만든 것 전부 비움 */
  function resetDerived(which, first) {
    angles().forEach(function (a) {
      ['hairCanvases', 'hairMasks', 'baseCanvases', 'baseFillCanvases'].forEach(function (k) { tryDo(function () { if (state[k]) state[k][a] = null; }); });
    });
    tryDo(function () { stylePrepDone = false; });
    tryDo(function () { state.hair3D = null; state.hair3Dneutral = null; state._model3DCrownY = null; });
    tryDo(function () { state.strandPaths = {}; state.neutralStrandPaths = null; state._viewCalHealTried = {}; });
    tryDo(function () { state.hairField3D = null; state.hairOcc3D = null; state.hairIdentity = null; });
    tryDo(function () { if (typeof resetScalpSkinSample === 'function') resetScalpSkinSample(); });
    tryDo(function () { HAIR_IDENTITY._refSkinCss = null; });
    tryDo(function () { if (typeof combClear === 'function') combClear(); });
    tryDo(function () { for (var k in _viewMaskCache) delete _viewMaskCache[k]; });
    tryDo(function () { state.aiOutfitRecommendation = null; });
    tryDo(function () { _garmentNeckOpening = null; });
    tryDo(function () { if (typeof resetBodyBase === 'function') resetBodyBase(); });
    tryDo(function () { if (typeof resetBodyBase === 'function') resetBodyBase(); });
    tryDo(function () { resetResultScreenCache(); });
    tryDo(function () { _headCrossSectionCache = null; });
    tryDo(function () { _headVerticalRadiusCache = null; });
    tryDo(function () { _headEllipsoidLogged = false; });
    tryDo(function () { _headWidthGuardLogged = false; });
    tryDo(function () { resetSkinGraft(); });
    tryDo(function () { angles().forEach(function (a) { delete _graftLogged[a]; delete _plateLogged[a]; }); });
    tryDo(function () { _silhouetteAnchorCache = {}; });
    // 다시 기르기(42): 잰 기준·마네킹 되돌리기 값은 예전 사람 것
    tryDo(function () { var G = W.REGROW; if (G) { G.base = null; G.mqSnap = null; G.failedFor = null; G.model = null; G.src = null; } });
    tryDo(function () { if (typeof ADJ_CACHE !== 'undefined' && ADJ_CACHE.bump) ADJ_CACHE.bump(); });
    // 3D 장면에 남아 있는 예전 사람(두상·얼굴·머리)을 바로 치움 — 새 모델이 될 때까지 예전 얼굴이 보이지 않게
    tryDo(function () {
      if (typeof model3D === 'undefined' || !model3D || !model3D.initialized) return;
      var g = model3D.headGroup;
      while (g.children.length) { var c = g.children[0]; g.remove(c); tryDo(function () { disposeObject3D(c); }); }
      tryDo(function () { if (W.GPU_DIET && W.GPU_DIET.markDirty) W.GPU_DIET.markDirty(); });
    });
    // 고른 스타일은 새 두상 기준으로 다시 걸리게
    tryDo(function () {
      state.specAppliedId = null; state._specUndo = null;
      var st = state.selectedStyle;
      if (st && st.specId && typeof MANNEQUIN !== 'undefined' && MANNEQUIN.on) state.pendingSpecId = st.specId;
    });
    if (first) return;                               // 첫 분석 — 비울 것이 없었음(세지 않음)
    S.resets++; S.lastAt = new Date().toTimeString().slice(0, 8); S.lastAngles = which.join(',');
    console.log(TAG + ' ' + which.join(',') + ' 사진이 바뀜 — 머리 영역·3D 모델·두상·얼굴을 비우고 다시 만듭니다');
  }

  /* navTo(05) 맨 앞에서 부름 — 사진이 바뀌었으면 비우고, 조정·3D로 바로 가면 다시 분석 */
  P._beforeNav = async function (screen) {
    var needPrep = false;
    try {
      if (P.on && screen !== 'capture') {
        var now = sigs(), ch = changed(now), any = angles().some(function (a) { return now[a]; });
        if (any && ch.length) {
          var first = !doneSig;
          resetDerived(ch, first);
          doneSig = now;
          needPrep = screen !== 'style';             // 'style'로 가면 원래 흐름이 분석을 돌림
          if (!first) try { if (typeof showToast === 'function') showToast('사진이 바뀌어 새로 분석합니다'); } catch (e) {}
        } else if (!any) doneSig = null;
      }
    } catch (e) { console.warn(TAG + ' 확인 실패', e); }
    if (needPrep) {                                   // 아래 탭으로 조정·결과·3D에 바로 간 경우
      try { if (typeof runStyleAnalysisPipeline === 'function') await runStyleAnalysisPipeline(); }
      catch (e) { console.warn(TAG + ' 다시 분석 실패', e); }
    }
  };
  // [새로 시작]은 사진까지 지우므로 지문도 비움 — startNewCustomer(18) 맨 앞
  P._forget = function () { doneSig = null; };

  P._panelLine = function () {   // perfPanelLines(18) 끝
    return TAG + ' ' + (P.on ? '켜짐' : '꺼짐') + ' · 사진이 바뀌어 전부 다시 만든 횟수 ' + S.resets +
      (S.lastAt ? ' (마지막 ' + S.lastAt + ' · ' + S.lastAngles + ')' : '');
  };

  console.log(TAG + ' 설치 — 촬영 화면을 떠날 때 사진이 지난번과 다르면 사진에서 만든 것을 전부 다시 만듭니다. 끄기 PHOTO_CHANGE.on=false');
  return P;
})();

async function navTo(name){
  ORIG_MQ._navBegin();   // (옛 58) 옮기기 시작할 때 원본을 보던 중이었는지(17b) — 끝나면 비움
  try{
  /* (옛 49) 촬영 화면을 떠날 때 사진이 지난번과 다르면 사진에서 만든 것을 전부 비우고 다시 만듦(위 PHOTO_CHANGE) */
  await PHOTO_CHANGE._beforeNav(name);
  /* (옛 34) 2D 결과 단계 없음 — 기존 코드(결과 보기 버튼·음성 명령 '결과/완료' 등)가 navTo('result')를 불러도 3D 화면으로 */
  if(name==='result') name = 'model3d';
  if(name==='style'){
    unlockTab('style');
    if(!stylePrepDone){ await runStyleAnalysisPipeline(); }
  }
  if(name==='capture'){ stopVoice(); }

  activateScreen(name);

  // currentScreen 업데이트 후 렌더 (블랭크 수정)
  if(name==='adjust'){ setupAdjustScreen(); }
  if(name==='result'){ setTimeout(()=>setupResultScreen(),80); }
  if(name==='model3d'){ unlockTab('model3d'); setTimeout(()=>setupModel3DScreen(),80); }
  // (옛 50) 스타일·조정 화면에 들어오면 어깨(몸통 메쉬)를 미리 잼(13a SHOULDER)
  SHOULDER._afterNav(name);
  } finally { ORIG_MQ._navEnd(); }
}

/* ════════════════════════════════════════
   CAPTURE
════════════════════════════════════════ */
const video = document.getElementById('video');
const camOffMsg = document.getElementById('camOffMsg');
let cameraStream = null;

async function initCamera(){
  if(typeof SHOT360 !== 'undefined' && SHOT360._overlayOpen()) return;   // (옛 45) 360° 촬영 덮개가 떠 있으면 앞 카메라를 켜지 않음
  try{
    cameraStream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:1920},height:{ideal:2560}},audio:false});
    video.srcObject=cameraStream;
    video.style.display='block';
    camOffMsg.style.display='none';
    // 카메라가 붙은 뒤에야 실시간 각도 가이드를 돌릴 수 있음
    video.addEventListener('loadeddata', ()=>{ if(typeof syncLiveGuide==='function') syncLiveGuide(); }, { once:true });
    if(typeof syncLiveGuide==='function') syncLiveGuide();
  }catch(e){
    camOffMsg.innerHTML='카메라에 접근할 수 없습니다.<br><span style="font-size:11px;">아래 "업로드" 버튼을 이용해주세요.</span>';
    camOffMsg.style.display='';
  }
}

/* ==========================================================================
 * SHOT360 (옛 45-shot360.js) — 360° 촬영 (도와주는 사람이 폰을 들고 손님 둘레를 한 바퀴)
 *
 * 자리: 05, initCamera 바로 뒤. initCamera 맨 앞에서 SHOT360._overlayOpen()이면 앱 앞 카메라를 켜지 않음.
 *
 * 설계(2026-10-03~04 사용자와 정함):
 *   · 폰(후면 카메라)을 손님 머리로 향한 채 한 바퀴 돌며 연속 촬영.
 *   · 폰 회전 센서로 "지금 몇 도 돌았나"를 재서, 일정 각도마다 한 장씩 자동으로 뽑습니다(기본 30° 간격 12장 + ±45° 2장).
 *     각도 근처에서 여러 장 중 가장 선명한 것을 남깁니다(걸으면서 찍으면 흔들리므로).
 *   · 화면에 보여 주고 지금 흐름에 넣는 것은 4장(정면 0° · 좌 +45° · 우 −45° · 후면 180°) — 기존 슬롯에 그대로 들어갑니다.
 *     나머지는 "정보용"으로 state.shots360에 들고 있습니다(다시 기르기가 이 사진들까지 읽게 하는 것은 다음 단계 —
 *     실제 촬영본이 있어야 맞출 수 있습니다).
 *   · 좌/우 판정: 폰이 도는 방향(센서)만으로는 "손님의 왼쪽인지"가 기기마다 뒤집힐 수 있어,
 *     촬영 초반 얼굴이 보이는 구간에서 얼굴 각도(기존 얼굴 인식)와 맞춰 자동으로 정합니다. [좌우 바꾸기]로 뒤집을 수 있습니다.
 *   · 세트 저장: 이 기기에 저장(다음에 불러오기) · 파일로 내보내기(.json — 개발 때 그대로 보내 주면 됨) · 가져오기.
 *   · 센서가 없는 기기(노트북)는 [수동 찍기] — 버튼을 누를 때마다 다음 각도 칸에 한 장.
 *
 * 촬영 요령(화면에도 안내): 손님 정면에서 [시작] → 머리가 타원 안에 오게 유지 → 천천히 한 바퀴(15~20초) →
 *   출발점에 돌아오면 [완료]. 손님은 고개·머리카락을 움직이지 않습니다.
 *
 * 끄기: SHOT360.on=false (버튼 숨김 — 새로고침)
 * ========================================================================== */
var SHOT360 = (function () {
  'use strict';
  var W = window, TAG = '[360 촬영]';
  var Q = Object.assign({
    on: true,
    stepDeg: 30,          // 뽑는 간격
    extra: [45, -45],     // 추가로 뽑는 각도(좌·우 표시용)
    tolDeg: 7,            // 목표 각도 ± 이만큼 안에서 뽑음
    maxSide: 1280,        // 저장 해상도(긴 변)
    jpeg: 0.9,
    slowDegPerSec: 50,    // 이보다 빨리 돌면 "천천히"
    maxTries: 4,          // 한 각도에서 더 선명한 장으로 바꿔 보는 횟수
    sign: 0               // +1/-1 = 좌우 고정 · 0 = 자동(얼굴 각도로 정함, 못 정하면 기본 -1)
  }, W.SHOT360 || {});
  if (!Q.on) return;

  var DB = 'gyeol-shot360', STORE = 'sets', KEY = 'last';
  function now() { try { return performance.now(); } catch (e) { return Date.now(); } }
  function wrap(d) { d = ((d + 180) % 360 + 360) % 360 - 180; return d === -180 ? 180 : d; }
  function toast(t) { try { if (typeof showToast === 'function') showToast(t); } catch (e) {} }

  /* 목표 각도(센서 기준 raw 각도 — 부호를 뒤집어도 같은 집합) */
  function targets() {
    var a = [], d, i;
    for (d = -180 + Q.stepDeg; d <= 180; d += Q.stepDeg) a.push(wrap(d));
    (Q.extra || []).forEach(function (x) { x = wrap(x); if (a.indexOf(x) < 0) a.push(x); if (a.indexOf(wrap(-x)) < 0) a.push(wrap(-x)); });
    a.sort(function (x, y) { return x - y; });
    return a;
  }

  /* ── 폰이 향한 방위(후면 카메라가 보는 방향) ──────────────────────────── */
  function headingOf(e) {
    if (e == null || e.alpha == null || e.beta == null || e.gamma == null) return null;
    var k = Math.PI / 180, a = e.alpha * k, b = e.beta * k, g = e.gamma * k;
    var cA = Math.cos(a), sA = Math.sin(a), cB = Math.cos(b), sB = Math.sin(b), cG = Math.cos(g), sG = Math.sin(g);
    // 기기 -Z축(후면 카메라)이 땅 좌표에서 향하는 방향 → 수평 성분의 방위
    var vx = -(cA * sG + sA * sB * cG), vy = -(sA * sG - cA * sB * cG);
    if (Math.hypot(vx, vy) < 0.15) return null;         // 폰이 하늘/바닥을 봄 — 방위를 못 정함
    return Math.atan2(vx, vy) / k;
  }

  /* ── 세트 저장(IndexedDB) ─────────────────────────────────────────────── */
  function idb(mode, fn) {
    return new Promise(function (res, rej) {
      try {
        var r = indexedDB.open(DB, 1);
        r.onupgradeneeded = function () { r.result.createObjectStore(STORE); };
        r.onerror = function () { rej(r.error); };
        r.onsuccess = function () {
          var db = r.result, t = db.transaction(STORE, mode), out = fn(t.objectStore(STORE));
          t.oncomplete = function () { res(out && out.result !== undefined ? out.result : undefined); db.close(); };
          t.onerror = function () { rej(t.error); db.close(); };
        };
      } catch (e) { rej(e); }
    });
  }
  Q.saveSet = function (set) { return idb('readwrite', function (s) { return s.put(set, KEY); }); };
  Q.loadSet = function () { return idb('readonly', function (s) { return s.get(KEY); }).catch(function () { return null; }); };

  /* ── 세트 → 기존 4장 슬롯 ─────────────────────────────────────────────── */
  function nearest(frames, deg, maxOff) {
    var best = null, bd = 1e9;
    frames.forEach(function (f) { var d = Math.abs(wrap(f.deg - deg)); if (d < bd) { bd = d; best = f; } });
    return best && bd <= maxOff ? best : null;
  }
  /* set.frames[].deg 는 앱 기준 각도(+ = 손님의 왼쪽이 보이는 쪽) */
  /* (옛 52) 세트를 넣기 전후 — 360 추가 사진 지문·센서 각도를 포즈로(13b VIEWS360) */
  Q.applySet = function (set) {
    if (typeof VIEWS360 !== 'undefined') VIEWS360._beforeApplySet();
    var p = Promise.resolve(applySetCore.apply(Q, arguments));
    return typeof VIEWS360 !== 'undefined' ? p.then(function (ok) { return VIEWS360._afterApplySet(set, ok); }) : p;
  };
  function applySetCore(set) {
    if (!set || !set.frames || !set.frames.length) { toast('360 세트가 비어 있습니다'); return Promise.resolve(false); }
    var pick = { front: nearest(set.frames, 0, 20), left: nearest(set.frames, 45, 25), right: nearest(set.frames, -45, 25), back: nearest(set.frames, 180, 35) };
    var miss = Object.keys(pick).filter(function (k) { return !pick[k]; });
    if (miss.length) { toast('360 세트에 ' + miss.join('·') + ' 각도 사진이 없습니다 — 다시 찍어 주세요'); return Promise.resolve(false); }
    var cap = (typeof capShotDataURL === 'function') ? capShotDataURL : function (u) { return Promise.resolve(u); };
    var angles = ['front', 'left', 'right', 'back'];
    return Promise.all(angles.map(function (a) { return cap(pick[a].url); })).then(function (urls) {
      angles.forEach(function (a, i) {
        state.shots[a] = urls[i];
        ['hairCanvases', 'hairMasks', 'baseCanvases', 'baseFillCanvases'].forEach(function (k) { if (state[k]) state[k][a] = null; });
        ['landmarks', 'captureLmStatus', 'capturePose', 'poseEars'].forEach(function (k) { if (state[k]) state[k][a] = null; });
        if (state.strandPaths) state.strandPaths[a] = null;
      });
      state.shots360 = set;
      try { state.hair3D = null; state.hair3Dneutral = null; } catch (e) {}
      try { _silhouetteAnchorCache = {}; } catch (e) {}
      try { if (typeof resetResultScreenCache === 'function') resetResultScreenCache(); } catch (e) {}
      try { if (typeof resetSkinGraft === 'function') resetSkinGraft(); } catch (e) {}
      try { stylePrepDone = false; } catch (e) {}
      try { state.currentCaptureIndex = 3; } catch (e) {}
      try { updateAngleUI(); } catch (e) {}
      angles.forEach(function (a) { try { checkCaptureLandmarks(a); } catch (e) {} });
      console.log(TAG + ' 세트 적용 — ' + set.frames.length + '장 중 정면 ' + Math.round(pick.front.deg) + '° · 좌 ' + Math.round(pick.left.deg) + '° · 우 ' + Math.round(pick.right.deg) +
        '° · 후면 ' + Math.round(pick.back.deg) + '° 를 4장 슬롯에 넣음 · 나머지 ' + (set.frames.length - 4) + '장은 정보용(state.shots360)');
      toast('360° 사진 ' + set.frames.length + '장 — 4장을 슬롯에 넣었어요');
      return true;
    });
  }
  Q.exportSet = function (set) {
    set = set || (typeof state !== 'undefined' && state.shots360);
    if (!set) { toast('내보낼 360 세트가 없습니다'); return; }
    try {
      var blob = new Blob([JSON.stringify(set)], { type: 'application/json' }), a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'shot360-' + new Date(set.at || Date.now()).toISOString().replace(/[:.]/g, '-').slice(0, 19) + '.json';
      document.body.appendChild(a); a.click();
      setTimeout(function () { try { document.body.removeChild(a); URL.revokeObjectURL(a.href); } catch (e) {} }, 2000);
    } catch (e) { console.warn(TAG + ' 내보내기 실패', e); toast('내보내기 실패'); }
  };
  Q.importFile = function (file) {
    if (!file) return;
    var fr = new FileReader();
    fr.onload = function () {
      try {
        var set = JSON.parse(fr.result);
        if (!set || !set.frames) throw new Error('형식이 다름');
        Q.applySet(set).then(function (ok) { if (ok) Q.saveSet(set).catch(function () {}); refreshRow(); });
      } catch (e) { toast('360 세트 파일을 읽지 못했습니다'); console.warn(TAG + ' 가져오기 실패', e); }
    };
    fr.readAsText(file);
  };

  /* ── 촬영 화면(전체 화면 덮개) ────────────────────────────────────────── */
  var ov = null, vid = null, stream = null, ring = null, info = null, btnStart = null, btnDone = null, btnManual = null, btnFlip = null, needle = null;
  var running = false, raf = null, sensorOk = false, lastEvt = null, h0 = null, cur = 0, lastDeg = null, lastT = 0, speed = 0;
  var T = [], got = {}, tries = {}, small = null, grab = null, signVote = 0, signN = 0, userFlip = false, lastFaceAt = 0;

  function el(tag, css, text) { var e = document.createElement(tag); if (css) e.style.cssText = css; if (text != null) e.textContent = text; return e; }
  function btn(label, primary, fn) {
    var b = el('button', 'flex:1;min-height:44px;padding:10px 8px;border-radius:12px;font:600 14px system-ui,sans-serif;touch-action:manipulation;border:1px solid ' +
      (primary ? '#C98A4B;background:#C98A4B;color:#1b1510;' : 'rgba(255,255,255,.35);background:rgba(20,16,12,.7);color:#f3eadf;'), label);
    b.type = 'button'; b.addEventListener('click', fn); return b;
  }
  function onOri(e) { lastEvt = e; if (e && e.alpha != null) sensorOk = true; }

  function drawRing() {
    if (!ring) return;
    var s = '', R = 44, i, t, a0, a1, c, p0, p1;
    function pt(deg, r) { var k = (deg - 90) * Math.PI / 180; return [50 + r * Math.cos(k), 50 + r * Math.sin(k)]; }
    // 화면에서는 위 = 정면(0°), 시계 방향 = raw 각도 +
    for (i = 0; i < T.length; i++) {
      t = T[i]; if (Math.abs(t % Q.stepDeg) > 0.01 && Math.abs(t) !== 180) continue;
      a0 = t - Q.stepDeg / 2 + 2; a1 = t + Q.stepDeg / 2 - 2; p0 = pt(a0, R); p1 = pt(a1, R);
      c = got[t] ? '#6fdc7a' : '#5a5148';
      s += '<path d="M' + p0[0].toFixed(2) + ' ' + p0[1].toFixed(2) + ' A' + R + ' ' + R + ' 0 0 1 ' + p1[0].toFixed(2) + ' ' + p1[1].toFixed(2) + '" fill="none" stroke="' + c + '" stroke-width="5" stroke-linecap="round"/>';
    }
    (Q.extra || []).concat((Q.extra || []).map(function (x) { return -x; })).forEach(function (x) {
      x = wrap(x); if (T.indexOf(x) < 0) return; var p = pt(x, R - 8);
      s += '<circle cx="' + p[0].toFixed(2) + '" cy="' + p[1].toFixed(2) + '" r="2.4" fill="' + (got[x] ? '#6fdc7a' : '#5a5148') + '"/>';
    });
    var n = pt(cur, R - 16), n2 = pt(cur, R + 4);
    s += '<line x1="' + n[0].toFixed(2) + '" y1="' + n[1].toFixed(2) + '" x2="' + n2[0].toFixed(2) + '" y2="' + n2[1].toFixed(2) + '" stroke="#C98A4B" stroke-width="2.5" stroke-linecap="round"/>';
    s += '<text x="50" y="47" text-anchor="middle" font-size="9" fill="#f3eadf" font-family="system-ui,sans-serif">' + Object.keys(got).length + '/' + T.length + '</text>';
    s += '<text x="50" y="58" text-anchor="middle" font-size="7" fill="#cfc5b8" font-family="system-ui,sans-serif">' + Math.round(cur) + '°</text>';
    ring.innerHTML = s;
  }
  function sharpness() {            // 작은 흑백 사본의 라플라시안 분산
    try {
      if (!small) { small = document.createElement('canvas'); small.width = 160; small.height = 120; }
      var c = small.getContext('2d', { willReadFrequently: true });
      c.drawImage(vid, 0, 0, 160, 120);
      var d = c.getImageData(0, 0, 160, 120).data, w = 160, h = 120, sum = 0, sum2 = 0, n = 0, x, y, i, v;
      function g(xx, yy) { var k = (yy * w + xx) * 4; return d[k] * 0.3 + d[k + 1] * 0.59 + d[k + 2] * 0.11; }
      for (y = 20; y < h - 20; y += 2) for (x = 30; x < w - 30; x += 2) {
        v = 4 * g(x, y) - g(x - 1, y) - g(x + 1, y) - g(x, y - 1) - g(x, y + 1);
        sum += v; sum2 += v * v; n++;
      }
      return n ? sum2 / n - (sum / n) * (sum / n) : 0;
    } catch (e) { return 0; }
  }
  function grabFrame() {
    var vw = vid.videoWidth, vh = vid.videoHeight; if (!vw || !vh) return null;
    var k = Math.min(1, Q.maxSide / Math.max(vw, vh));
    if (!grab) grab = document.createElement('canvas');
    grab.width = Math.round(vw * k); grab.height = Math.round(vh * k);
    grab.getContext('2d').drawImage(vid, 0, 0, grab.width, grab.height);      // 후면 카메라 — 좌우를 뒤집지 않음
    return grab;
  }
  function takeFor(t, sh) {
    var c = grabFrame(); if (!c) return false;
    var url; try { url = c.toDataURL('image/jpeg', Q.jpeg); } catch (e) { return false; }
    got[t] = { raw: t, at: cur, url: url, sharp: sh, time: Date.now() };
    tries[t] = (tries[t] || 0) + 1;
    return true;
  }
  function faceVote() {             // 얼굴이 보이는 구간에서 "센서 + 방향 = 손님의 왼쪽인가"를 맞춰 봄
    if (Q.sign || typeof detectPoseOnCanvas !== 'function') return;
    var a = Math.abs(cur); if (a < 10 || a > 55) return;
    var t = now(); if (t - lastFaceAt < 450) return; lastFaceAt = t;
    var c = grabFrame(); if (!c) return;
    var p = null; try { p = detectPoseOnCanvas(c); } catch (e) {}
    if (!p || !isFinite(p.yawDeg) || Math.abs(p.yawDeg) < 8) return;
    signVote += (p.yawDeg > 0 ? 1 : -1) * (cur > 0 ? 1 : -1) * Math.min(Math.abs(p.yawDeg), a);
    signN++;
  }
  function appSign() {
    var s = Q.sign ? (Q.sign > 0 ? 1 : -1) : (signN >= 2 && Math.abs(signVote) > 15 ? (signVote > 0 ? 1 : -1) : -1);
    return userFlip ? -s : s;
  }
  function setInfo(t) { if (info) info.textContent = t; }

  function tick() {
    raf = null; if (!running) return;
    if (!Q.cam.ok) { drawRing(); raf = requestAnimationFrame(tick); return; }      // 카메라가 아직 안 들어옴 — 안내는 카메라 쪽이 씀
    var t = now();
    if (sensorOk && lastEvt) {
      var h = headingOf(lastEvt);
      if (h != null) {
        if (h0 == null) h0 = h;
        cur = wrap(h - h0);
        if (lastDeg != null && t > lastT) speed = speed * 0.7 + 0.3 * Math.abs(wrap(cur - lastDeg)) / ((t - lastT) / 1000);
        lastDeg = cur; lastT = t;
        // 가장 가까운 목표
        var best = null, bd = 1e9, i;
        for (i = 0; i < T.length; i++) { var d = Math.abs(wrap(cur - T[i])); if (d < bd) { bd = d; best = T[i]; } }
        if (best != null && bd <= Q.tolDeg && (tries[best] || 0) < Q.maxTries) {
          var sh = sharpness();
          if (!got[best] || sh > got[best].sharp * 1.1) takeFor(best, sh);
        }
        faceVote();
        setInfo(speed > Q.slowDegPerSec ? '너무 빨라요 — 천천히 도세요' : (Object.keys(got).length >= T.length ? '다 찍었어요 — [완료]를 누르세요' : '머리를 타원 안에 두고 천천히 한 바퀴 도세요'));
      } else setInfo('폰을 세워서 손님 머리를 향해 주세요');
    } else setInfo('각도 센서가 없습니다 — [수동 찍기]로 한 장씩 찍으세요(정면부터 한 방향으로)');
    drawRing();
    raf = requestAnimationFrame(tick);
  }
  function start() {
    var go = function () {
      T = targets(); got = {}; tries = {}; h0 = null; cur = 0; lastDeg = null; speed = 0; signVote = 0; signN = 0; userFlip = false;
      running = true; btnStart.textContent = '다시 시작';
      W.addEventListener('deviceorientation', onOri, true);
      setTimeout(function () { if (btnManual) btnManual.style.display = sensorOk ? 'none' : ''; }, 1500);
      if (!raf) raf = requestAnimationFrame(tick);
    };
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission().then(go, go);      // 아이폰은 허락을 물어봄
      } else go();
    } catch (e) { go(); }
  }
  function manualShot() {           // 센서 없음: 정면(0°)부터 +방향으로 다음 빈 칸에
    if (!running) start();
    var order = T.slice().sort(function (a, b) { return ((a + 360) % 360) - ((b + 360) % 360); }), i;
    for (i = 0; i < order.length; i++) if (!got[order[i]]) { cur = order[i]; takeFor(order[i], sharpness()); break; }
    drawRing();
  }
  function finish() {
    var keys = Object.keys(got);
    if (keys.length < 4) { toast('사진이 모자랍니다 — 정면·양옆·뒤가 다 찍혀야 해요'); return; }
    var s = appSign(), frames = keys.map(function (k) { var f = got[k]; return { deg: wrap(s * f.raw), url: f.url, sharp: Math.round(f.sharp), time: f.time }; });
    frames.sort(function (a, b) { return a.deg - b.deg; });
    var set = { version: 1, at: Date.now(), stepDeg: Q.stepDeg, sign: s, signAuto: !Q.sign && !userFlip && signN >= 2, sensor: sensorOk, frames: frames };
    console.log(TAG + ' 완료 — ' + frames.length + '장 · 좌우 부호 ' + s + (set.signAuto ? '(얼굴 각도로 자동 · 표 ' + signN + '회 · 합 ' + Math.round(signVote) + ')' : userFlip ? '(직접 바꿈)' : '(기본값 — 얼굴 각도를 못 읽음)') +
      ' · 각도 ' + frames.map(function (f) { return Math.round(f.deg); }).join(','));
    close();
    Q.applySet(set).then(function (ok) { if (ok) Q.saveSet(set).then(refreshRow, refreshRow); });
  }
  function stopCam() { try { if (stream) stream.getTracks().forEach(function (t) { t.onended = null; t.stop(); }); } catch (e) {} stream = null; }

  /* ── 카메라 열기 (2026-10-04 고침: "360 촬영을 켜면 카메라가 안 들어옴") ─────────────────
   * 예전에는 앱 카메라를 끄자마자 딱 한 번 getUserMedia를 부르고, 실패하거나 영상이 안 나와도 그대로였습니다.
   *   · 앞 카메라를 끈 직후에는 기기가 아직 카메라를 놓지 않아 실패하는 일이 흔합니다(NotReadableError) → 잠깐 기다렸다 열고, 실패하면 다시 시도.
   *   · 해상도·후면 조건을 못 맞추는 기기 → 조건을 낮춰 가며 다시(1080p 후면 → 후면 → 아무 카메라).
   *   · 스트림은 받았는데 영상이 안 도는 경우(자동 재생 막힘) → play()를 직접 부르고, 그래도 안 되면 "화면을 눌러 주세요".
   *   · 앱의 앞 카메라가 뒤늦게 켜져 후면을 밀어내는 경우(켜지는 도중에 360을 누름) → 덮개가 떠 있는 동안 앱 카메라를 막음.
   *   · 그래도 안 되면 이유(권한/카메라 없음/다른 앱이 사용 중/https 아님)를 화면에 쓰고 [카메라 다시 열기] 버튼을 보여 줍니다.
   * ───────────────────────────────────────────────────────────────────────────────────── */
  var READY_MSG = '손님 정면에 서서 [시작]을 누르세요. 폰은 세워서 머리를 향하게.';
  var CAM_TRIES = [
    { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false },
    { video: { facingMode: { ideal: 'environment' } }, audio: false },
    { video: true, audio: false }
  ];
  var camSeq = 0, camWatch = null, camGuard = null, btnCam = null, tapEl = null;
  Q.cam = { opens: 0, retries: 0, lastErr: null, ok: false };
  function showRetry(on) { if (btnCam) btnCam.style.display = on ? '' : 'none'; }
  function camFail(text, e) {
    Q.cam.ok = false; Q.cam.lastErr = e ? (e.name || '') + ': ' + (e.message || e) : text;
    setInfo(text); showRetry(true);
    console.warn(TAG + ' 카메라 실패 — ' + Q.cam.lastErr);
  }
  function releaseAppCam() {        // 앱(촬영 화면)의 앞 카메라를 끔 — 폰은 두 카메라를 동시에 못 여는 경우가 많음
    try {
      if (typeof cameraStream !== 'undefined' && cameraStream) {
        cameraStream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} });
        cameraStream = null; try { video.srcObject = null; } catch (e) {}
        return true;
      }
    } catch (e) {}
    return false;
  }
  function playVid() {
    if (!vid) return;
    var p = null; try { p = vid.play(); } catch (e) {}
    if (p && typeof p.catch === 'function') p.catch(function (e) {
      if (!ov || !vid || !vid.paused || (e && e.name === 'AbortError')) return;
      // 자동 재생이 막힘 — 한 번 눌러서 켬
      if (!tapEl) {
        tapEl = el('button', 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);padding:14px 18px;border-radius:14px;border:1px solid #C98A4B;background:rgba(20,16,12,.85);color:#f3eadf;font:600 15px system-ui,sans-serif;', '화면을 눌러 카메라 켜기');
        tapEl.type = 'button';
        tapEl.addEventListener('click', function () { try { vid.play(); } catch (x) {} if (tapEl && tapEl.parentNode) tapEl.parentNode.removeChild(tapEl); tapEl = null; });
        if (vid.parentNode) vid.parentNode.appendChild(tapEl);
      }
    });
  }
  function camReady() {
    if (!vid || !(vid.videoWidth > 0)) return false;
    if (!Q.cam.ok) { Q.cam.ok = true; Q.cam.lastErr = null; showRetry(false); if (!running) setInfo(READY_MSG); }
    return true;
  }
  function openCam(attempt) {
    if (!ov) return;
    attempt = attempt || 0;
    var my = ++camSeq, md = navigator.mediaDevices;
    if (camWatch) { clearTimeout(camWatch); camWatch = null; }
    showRetry(false);
    if (!md || !md.getUserMedia) {
      var insecure = false; try { insecure = W.isSecureContext === false; } catch (e) {}
      camFail(insecure ? '카메라는 https 주소에서만 열 수 있습니다 — 주소가 https://로 시작하는지 확인해 주세요' : '이 브라우저에서는 카메라를 열 수 없습니다');
      return;
    }
    Q.cam.opens++; if (attempt) Q.cam.retries++;
    setInfo('카메라를 여는 중…');
    md.getUserMedia(CAM_TRIES[Math.min(attempt, CAM_TRIES.length - 1)]).then(function (s) {
      if (!ov || my !== camSeq) { s.getTracks().forEach(function (t) { t.stop(); }); return; }
      stopCam();
      stream = s;
      try { s.getVideoTracks().forEach(function (t) { t.onended = function () { if (ov && stream === s) camFail('카메라가 끊겼습니다 — [카메라 다시 열기]를 눌러 주세요'); }; }); } catch (e) {}
      try { vid.srcObject = s; } catch (e) { try { vid.src = URL.createObjectURL(s); } catch (x) {} }
      vid.onloadedmetadata = function () { playVid(); camReady(); };
      vid.onplaying = camReady;
      playVid();
      // 스트림은 받았는데 영상이 안 나오는 경우 — 다시 열어 봄
      var waited = 0;
      (function watch() {
        camWatch = null;
        if (!ov || my !== camSeq) return;
        if (camReady()) return;
        waited += 500;
        if (waited < 3000) { camWatch = setTimeout(watch, 500); return; }
        if (attempt < 3) { stopCam(); openCam(attempt + 1); }
        else camFail('카메라 영상이 나오지 않습니다 — 다른 앱이 카메라를 쓰고 있지 않은지 확인하고 [카메라 다시 열기]를 눌러 주세요');
      })();
    }, function (e) {
      if (!ov || my !== camSeq) return;
      var n = (e && e.name) || '';
      if (n === 'NotAllowedError' || n === 'SecurityError' || n === 'PermissionDeniedError') {
        camFail('카메라 권한이 꺼져 있습니다 — 브라우저 주소창의 카메라 권한을 허용한 뒤 [카메라 다시 열기]를 눌러 주세요', e);
      } else if (n === 'NotFoundError' || n === 'DevicesNotFoundError' || n === 'OverconstrainedError' || n === 'ConstraintNotSatisfiedError') {
        if (attempt < CAM_TRIES.length - 1) openCam(attempt + 1);
        else camFail('쓸 수 있는 카메라를 찾지 못했습니다', e);
      } else if (attempt < 4) {
        // NotReadableError·AbortError 등 — 앞 카메라가 아직 안 놓였거나 다른 곳에서 쓰는 중. 조금 기다렸다 다시.
        releaseAppCam();
        setTimeout(function () { if (ov && my === camSeq) openCam(attempt + 1); }, 350 + 350 * attempt);
      } else camFail('카메라를 열 수 없습니다 — 다른 앱이나 탭이 카메라를 쓰고 있지 않은지 확인하고 [카메라 다시 열기]를 눌러 주세요', e);
    });
  }
  // 덮개가 떠 있는 동안에는 앱의 앞 카메라가 켜지지 않게(켜지는 도중에 360을 누른 경우 포함)
  Q._overlayOpen = function () { return !!ov; };   // initCamera(05) 맨 앞에서 확인
  function close() {
    running = false; if (raf) { cancelAnimationFrame(raf); raf = null; }
    W.removeEventListener('deviceorientation', onOri, true);
    camSeq++; if (camWatch) { clearTimeout(camWatch); camWatch = null; }
    if (camGuard) { clearInterval(camGuard); camGuard = null; }
    stopCam();
    if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
    ov = null; vid = null; btnCam = null; tapEl = null; Q.cam.ok = false;
    // 후면 카메라가 놓일 틈을 주고 앱의 앞 카메라를 다시 켬(바로 켜면 실패하는 기기가 있음) — 실패하면 한 번 더
    var back = function (again) {
      try {
        if (ov || typeof initCamera !== 'function' || typeof currentScreen === 'undefined' || currentScreen !== 'capture') return;
        if (typeof cameraStream !== 'undefined' && cameraStream) return;
        Promise.resolve(initCamera()).then(function () {
          try { updateAngleUI(); } catch (e) {}
          try { if (again && !ov && !cameraStream) setTimeout(function () { back(false); }, 900); } catch (e) {}
        });
      } catch (e) {}
    };
    setTimeout(function () { back(true); }, 300);
  }
  Q.open = function () {
    if (ov) return;
    // 앱의 전면 카메라를 끄고 후면 카메라를 엶(폰은 두 카메라를 동시에 못 여는 경우가 많음)
    var hadAppCam = releaseAppCam();
    ov = el('div', 'position:fixed;inset:0;z-index:9998;background:#000;display:flex;flex-direction:column;');
    var stage = el('div', 'position:relative;flex:1;overflow:hidden;');
    vid = el('video', 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;');
    vid.autoplay = true; vid.muted = true; vid.defaultMuted = true; vid.playsInline = true;
    vid.setAttribute('autoplay', ''); vid.setAttribute('muted', ''); vid.setAttribute('playsinline', ''); vid.setAttribute('webkit-playsinline', '');   // 아이폰은 속성으로 있어야 화면 안에서 재생
    var oval = el('div', 'position:absolute;left:50%;top:40%;width:56%;aspect-ratio:3/4;transform:translate(-50%,-50%);border:2px dashed rgba(232,195,158,.75);border-radius:50%;pointer-events:none;');
    var ringWrap = el('div', 'position:absolute;right:10px;top:10px;width:104px;height:104px;background:rgba(0,0,0,.45);border-radius:50%;pointer-events:none;');
    ringWrap.innerHTML = '<svg viewBox="0 0 100 100" width="104" height="104"></svg>'; ring = ringWrap.firstChild;
    info = el('div', 'position:absolute;left:10px;right:124px;top:10px;padding:8px 10px;border-radius:10px;background:rgba(0,0,0,.55);color:#f3eadf;font:600 13px/1.4 system-ui,sans-serif;',
      '카메라를 여는 중…');
    var tip = el('div', 'position:absolute;left:10px;right:10px;bottom:10px;padding:6px 10px;border-radius:10px;background:rgba(0,0,0,.45);color:#cfc5b8;font:12px/1.4 system-ui,sans-serif;',
      '15~20초에 걸쳐 한 바퀴 · 손님은 고개와 머리카락을 움직이지 않습니다 · 출발점으로 돌아오면 [완료]');
    stage.appendChild(vid); stage.appendChild(oval); stage.appendChild(ringWrap); stage.appendChild(info); stage.appendChild(tip);
    var bar = el('div', 'display:flex;gap:8px;padding:10px;background:#15110d;flex-wrap:wrap;');
    btnStart = btn('시작', true, start);
    btnManual = btn('수동 찍기', false, manualShot); btnManual.style.display = 'none';
    btnFlip = btn('좌우 바꾸기', false, function () { userFlip = !userFlip; toast(userFlip ? '좌우를 바꿨어요' : '좌우를 원래대로 했어요'); });
    btnDone = btn('완료', true, finish);
    btnCam = btn('카메라 다시 열기', true, function () { stopCam(); releaseAppCam(); openCam(0); }); btnCam.style.display = 'none';
    bar.appendChild(btn('닫기', false, close)); bar.appendChild(btnCam); bar.appendChild(btnStart); bar.appendChild(btnManual); bar.appendChild(btnFlip); bar.appendChild(btnDone);
    ov.appendChild(stage); ov.appendChild(bar);
    document.body.appendChild(ov);
    T = targets(); got = {}; cur = 0; drawRing();
    Q.cam.ok = false;
    camGuard = setInterval(function () { if (ov && releaseAppCam() && !Q.cam.ok) openCam(0); }, 400);   // 뒤늦게 켜진 앱 카메라를 끔
    setTimeout(function () { openCam(0); }, hadAppCam ? 250 : 0);                                          // 앞 카메라가 놓일 틈
  };

  /* ── 촬영 화면의 버튼 줄 ──────────────────────────────────────────────── */
  var rowEl = null, fileIn = null;
  function small_btn(label, fn) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'btn btn-ghost'; b.textContent = label;
    b.style.cssText = 'flex:1;font-size:12px;padding:9px 6px;white-space:nowrap;';
    b.addEventListener('click', fn); return b;
  }
  function refreshRow() {
    var host = document.querySelector('#screen-capture .capture-actions');
    if (!host || !host.parentNode) return;
    if (!rowEl) {
      rowEl = document.createElement('div');
      rowEl.id = 'shot360Row';
      rowEl.style.cssText = 'display:flex;gap:6px;padding:0 14px 10px;flex-shrink:0;flex-wrap:wrap;';
      host.parentNode.insertBefore(rowEl, host.nextSibling);
      fileIn = document.createElement('input'); fileIn.type = 'file'; fileIn.accept = '.json,application/json'; fileIn.style.display = 'none';
      fileIn.addEventListener('change', function (e) { Q.importFile(e.target.files && e.target.files[0]); e.target.value = ''; });
      host.parentNode.appendChild(fileIn);
    }
    rowEl.textContent = '';
    var b0 = small_btn('🔄 360° 촬영', Q.open); b0.className = 'btn btn-primary'; rowEl.appendChild(b0);
    Q.loadSet().then(function (set) {
      if (!rowEl) return;
      if (set && set.frames) rowEl.appendChild(small_btn('저장된 360 세트 불러오기 (' + set.frames.length + ')', function () { Q.applySet(set); }));
      if ((typeof state !== 'undefined' && state.shots360) || (set && set.frames)) rowEl.appendChild(small_btn('내보내기', function () { Q.exportSet((typeof state !== 'undefined' && state.shots360) || set); }));
      rowEl.appendChild(small_btn('가져오기', function () { fileIn.click(); }));
    });
  }
  Q.refreshRow = refreshRow;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refreshRow); else refreshRow();

  console.log(TAG + ' 설치 — 촬영 화면의 [360° 촬영] 버튼. 간격 ' + Q.stepDeg + '° · 세트는 state.shots360 · 내보내기 SHOT360.exportSet()');
  return Q;
})();
initCamera();

function updateAngleUI(){
  ANGLES.forEach((a,i)=>{
    const card=document.getElementById('card-'+a);
    const seg=document.getElementById('seg'+i);
    const thumb=document.getElementById('thumb-'+a);
    const chk=document.getElementById('chk-'+a);
    const isCurrent = i===state.currentCaptureIndex;
    const hasShot = !!state.shots[a];
    card.className='angle-item'+(isCurrent?' current':'');
    // ── 촬영 직후 랜드마크 감지 상태 배지 (2026-07-14 추가) ──
    // 사용자 요청: "처음 촬영할 때 랜드마크가 감지되는지 안내해줄 수 있나?"
    // 배경: 우측 사진이 랜드마크 감지에 실패한 채로 끝까지 진행되면 그 뷰가
    // 필요한 실측(헤어 섹션·목·안면 깊이 등)이 전부 폴백으로 대체되는데,
    // 지금까지는 조정 화면의 진단정보에서야 알 수 있었음 → 촬영 화면에서
    // 바로 ✓/…/⚠로 보여줘서 그 자리에서 재촬영하도록 유도.
    // (수정) 후면도 사용자 지시로 동일하게 검사·표시: "폴백 쓰면 3D이미지
    // 찌그러져" — 후면 ⚠는 "진행 불가"가 아니라 "폴백으로 동작 중" 표시.
    const lmStatus = (state.captureLmStatus || {})[a];
    if(!hasShot){ chk.textContent=''; }
    else if(!lmStatus || lmStatus === 'na'){ chk.textContent='✓'; chk.style.color='var(--ok)'; }
    else if(lmStatus === 'checking'){ chk.textContent='…'; chk.style.color='var(--text-muted)'; }
    else if(lmStatus === 'fail'){ chk.textContent='⚠'; chk.style.color='var(--warn)'; }
    // 'wrongslot' = 감지는 됐는데 그 슬롯에 맞지 않는 사진(예: 후면 슬롯에 얼굴)
    else if(lmStatus === 'wrongslot'){ chk.textContent='⚠'; chk.style.color='var(--warn)'; }
    else { chk.textContent='✓'; chk.style.color='var(--ok)'; }
    thumb.innerHTML = hasShot?`<img src="${state.shots[a]}">`:'';
    // dial
    const okColor='#8FA888', activeColor='#C98A4B', lineColor='#3A332B', warnColor='#C2685A';
    seg.style.stroke = hasShot
      ? (lmStatus === 'fail' ? warnColor : okColor)
      : (isCurrent?activeColor:lineColor);
  });
  const doneCount=ANGLES.filter(a=>state.shots[a]).length;
  document.getElementById('dialCenter').textContent=doneCount+'/4';
  const curAngle=ANGLES[state.currentCaptureIndex];
  document.getElementById('captureHint').textContent=HINTS[curAngle];
  document.getElementById('capHintSmall').textContent=ANGLE_LABELS[curAngle]+ ' 촬영';
  document.getElementById('toStyleBtn').disabled=doneCount<1;
  // show/hide preview
  const shot=state.shots[curAngle];
  const sp=document.getElementById('shotPreview');
  if(shot){sp.src=shot;sp.style.display='block';video.style.display='none';}
  else{sp.style.display='none';if(cameraStream)video.style.display='block';}
  // 슬롯이 바뀌면 목표 각도도 바뀌므로 실시간 가이드를 재동기화
  if(typeof syncLiveGuide === 'function') syncLiveGuide();
}
updateAngleUI();

function jumpToAngle(i){ state.currentCaptureIndex=i; updateAngleUI(); }

function captureCurrentAngle(){
  const angle=ANGLES[state.currentCaptureIndex];
  if(state.shots[angle]){ retakeCurrent(); return; }
  // 실시간 가이드가 "아직 범위 밖"이라고 보고 있어도 촬영은 막지 않는다 —
  // 사용자 지시: "안내만, 셔터는 직접". 대신 그 사실을 토스트로 알려서
  // 그 자리에서 재촬영할지 판단할 수 있게 함.
  if(typeof _liveReadyState !== 'undefined' && !_liveReadyState && liveGuideShouldRun()){
    const t = LIVE_YAW_TARGET[angle];
    // 목표 범위는 내부적으로 부호가 있지만(미러 기준), 사용자에겐 절대값으로 보여줌
    const tTxt = t ? (angle==='front' ? `±${t.max}°`
      : `${Math.min(Math.abs(t.min),Math.abs(t.max))}~${Math.max(Math.abs(t.min),Math.abs(t.max))}°`) : '';
    // 각도는 맞는데 랜드마크만 안 잡힌 경우와, 각도 자체가 벗어난 경우를 구분해서 안내
    const stillMissing = (angle!=='back') && !_liveStillLastOk
                         && (performance.now() - _liveStillOkAt >= LIVE_STILL_GRACE);
    showToast(angle==='back'
      ? '⚠ 귀 2개가 다 보이는 상태는 아니에요 — 그대로 저장했어요'
      : stillMissing
        ? '⚠ 얼굴 랜드마크가 안 잡히는 상태예요 — 그대로 저장했지만 3D가 부정확할 수 있어요'
        : `⚠ 목표 각도(${tTxt}) 밖이에요 — 그대로 저장했어요`);
  }
  if(video.style.display!=='none' && video.videoWidth){
    const c=document.createElement('canvas');
    c.width=video.videoWidth; c.height=video.videoHeight;
    const ctx=c.getContext('2d');
    ctx.translate(c.width,0); ctx.scale(-1,1); // mirror
    ctx.drawImage(video,0,0);
    // ── 셔터 지연 보정 ──────────────────────────────────────────────
    // 1) 지금 이 프레임(=저장될 사진)에서 곧바로 감지·포즈 측정을 시도한다.
    //    성공하면 그게 최선 — 포즈도 "저장 사진 실측"이라 폴백이 아니다.
    // 2) 실패하면(초록불을 본 뒤 고개가 움직였거나 반응시간만큼 늦게 눌렀거나),
    //    직전에 감지 확인까지 끝난 검증 프레임으로 대체 저장한다. 사용자가
    //    "초록불을 보고 눌렀다"는 의도와 실제 저장본을 일치시키는 쪽이 맞다.
    let pose = detectPoseOnCanvas(c), poseSrc = 'shutter', usedVerified = false;
    if(!pose && angle !== 'back' && _liveVerifiedCanvas && _liveVerifiedAngle === angle
       && (performance.now() - _liveVerifiedAt) <= VERIFIED_SHOT_MAX_AGE){
      ctx.setTransform(1,0,0,1,0,0);          // 미러는 검증 캔버스에 이미 적용됨
      ctx.drawImage(_liveVerifiedCanvas,0,0); // 프레임 자체를 교체
      pose = _liveVerifiedPose; poseSrc = 'verified'; usedVerified = true;
    }
    /* (2026-07-26 4차) 품질 0.85 → 0.94.
       초록불은 "캔버스"에서 감지해서 켜지는데, 나중에 랜드마크를 다시 재는 건
       JPEG로 압축했다 디코딩한 이미지다. 경계선 각도에서는 이 압축 손실만으로
       감지가 갈린다(사용자: "초록색일 때 찍어도 랜드마크 감지 안 된 경우 많았어").
       또 실패 시 무손실에 가깝게 다시 인코딩해 재시도할 수 있도록 캔버스를 보관한다. */
    /* (2026-08-23 6차) 여기가 사진이 앱으로 들어오는 <b>첫 입구</b>다.
       카메라는 ideal 1920×2560을 요구하므로 잡히는 대로 들어오는데, 그 크기가
       그대로 hairC·baseC가 되어 보관 89~133MB를 만들었다. 저장 <b>전에</b> 건다 —
       뒤에서 걸면 이미 원본 크기 캔버스가 한 바퀴 돈 뒤다.
       ※ detectPoseOnCanvas는 <b>줄이기 전</b> 캔버스로 이미 끝났다. 포즈 측정은
         해상도가 높을수록 좋고 결과는 각도 몇 개뿐이라 그 순서가 맞다. */
    const shotC = capShotCanvas(c);
    if(shotC !== c){ c.width = 0; c.height = 0; }   // 원본 크기 캔버스는 바로 반납
    state.shots[angle]=shotC.toDataURL('image/jpeg',0.94);
    _lastShotCanvas = { angle, canvas:shotC };
    // ── 촬영 시점 포즈 저장 ──
    // 저장 사진에서 나중에 랜드마크가 안 잡혀도 이 각도는 버리지 않는다
    // (getViewYawDeg의 'live' 등급). 우선순위: 저장본 실측 > 검증 프레임 실측 >
    // 라이브 프레임 실측. 셋 다 없으면 null(슬롯 기본 각도로 폴백).
    if(!state.capturePose) state.capturePose = {};
    state.capturePose[angle] = pose
      ? { yawDeg:pose.yawDeg, pitchDeg:pose.pitchDeg, rollDeg:pose.rollDeg, src:poseSrc }
      : ((_liveLastPose && _liveLastPose.angle === angle &&
          (performance.now() - _liveLastPose.ts) <= CAPTURE_POSE_MAX_AGE)
          ? { yawDeg:_liveLastPose.yawDeg, pitchDeg:_liveLastPose.pitchDeg,
              rollDeg:_liveLastPose.rollDeg, src:'live' }
          : null);   // 오래됐거나 다른 슬롯 값이면 안 씀(엉뚱한 각도 오염 방지)
    if(usedVerified){
      const lagMs = Math.round(performance.now() - _liveVerifiedAt);
      console.log(`[${angle}] 셔터 시점 프레임 감지 실패 → ${lagMs}ms 전 검증 프레임으로 저장`);
      showToast(`셔터가 ${(lagMs/1000).toFixed(1)}초 늦어 인식이 끊겼어요 — 초록불이던 순간의 프레임으로 저장했어요`);
    }
    // auto advance
    if(state.currentCaptureIndex<3) state.currentCaptureIndex++;
    updateAngleUI();
    checkCaptureLandmarks(angle); // 촬영 직후 랜드마크 감지 안내 (비동기, 흐름 안 막음)
  } else { showToast('카메라가 준비되지 않았어요.'); }
}

function retakeCurrent(){
  const angle=ANGLES[state.currentCaptureIndex];
  state.shots[angle]=null; state.hairCanvases[angle]=null; state.hairMasks[angle]=null; state.baseCanvases[angle]=null; state.baseFillCanvases[angle]=null;
  if(state.strandPaths) state.strandPaths[angle]=null; // 캡처된 가닥 경로도 함께 무효화
  // 이 뷰에서 뜬 이마 표본이 보관 중이면 버린다(다른 뷰가 재사용 중일 수 있음).
  // 사진이 바뀌면 표본도 다시 떠야 한다.
  if(_skinGraft && _skinGraft.src === angle) resetSkinGraft();
  delete _graftLogged[angle];
  delete _plateLogged[angle];
  _silhouetteAnchorCache = {}; // 실루엣 앵커는 정면 비율도 참조하므로 어느 각도든 재촬영 시 전체 리셋
  _resultScene = null; _personScaleRef = null; // 결과 화면의 두상 자·장면 재료도 사진이 바뀌면 무효
  // 랜드마크/감지상태도 함께 초기화 — 촬영 직후 감지가 생기면서, 지우지 않으면
  // "이전 사진의 랜드마크"가 남아 있다가 새 사진 감지 실패 시 그대로(엉뚱한
  // 좌표로) 재사용될 수 있음 (detectFaceLandmarks는 실패 시 기존 값을 안 지움).
  if(state.landmarks) state.landmarks[angle]=null;
  if(state.captureLmStatus) state.captureLmStatus[angle]=null;
  if(state.capturePose) state.capturePose[angle]=null; // 라이브 포즈 폴백도 사진과 함께 무효화
  if(state.poseEars) state.poseEars[angle]=null;       // 포즈 귀 앵커도 무효화
  if(_lastShotCanvas && _lastShotCanvas.angle===angle) _lastShotCanvas=null; // 보관 캔버스도 무효화
  stylePrepDone=false;   // 사진이 바뀌었다 — 이 각도의 세그멘테이션을 다시 돌려야 한다
  updateAngleUI();
}

/* ── 업로드 빠른 길 (2026-10-18) ────────────────────────────────────────
   예전: 파일 전체를 base64 문자열로 읽고(FileReader) → 12MP 그대로 디코드 →
   원본 크기 캔버스(약 48MB)에 그린 뒤 800px로 줄였다. 폰에서 한 장에 1~3초.
   지금: createImageBitmap에 크기를 알려 줘서 <b>디코드하면서 바로 줄인다</b>.
   (사진 방향 EXIF는 createImageBitmap이 기본으로 반영한다.) 안 되는 브라우저나
   이미 작은 파일은 예전 길(capShotDataURL)로 간다. 결과 형식(jpeg 0.94)은 같다. */
async function fileToShotDataURL(file){
  const M = (typeof INPUT_RES !== 'undefined') ? INPUT_RES.photoMax : 0;
  if(M > 0 && typeof createImageBitmap === 'function' && file.size > 400*1024){
    try{
      let bmp = await createImageBitmap(file, { resizeWidth: M, resizeQuality: 'high' });
      if(bmp.height > bmp.width){                      // 세로 사진 → 긴 변(세로)을 M에 맞춰 다시
        bmp.close();
        bmp = await createImageBitmap(file, { resizeHeight: M, resizeQuality: 'high' });
      }
      const c = document.createElement('canvas');
      c.width = bmp.width; c.height = bmp.height;
      c.getContext('2d').drawImage(bmp, 0, 0);
      bmp.close();
      const url = c.toDataURL('image/jpeg', 0.94);
      c.width = c.height = 0;
      return url;
    }catch(err){ console.warn('업로드 빠른 길 실패 — 예전 길로', err); }
  }
  const raw = await new Promise((res, rej)=>{
    const r = new FileReader(); r.onload = ()=>res(r.result); r.onerror = rej; r.readAsDataURL(file);
  });
  return capShotDataURL(raw);
}
function handleFileUpload(e){
  const file=e.target.files[0]; if(!file) return;
  const angle=ANGLES[state.currentCaptureIndex]; // 인덱스 증가 전에 확정
  e.target.value='';
  try{ if(typeof showToast==='function') showToast('사진 불러오는 중…'); }catch(_){}
  (async ()=>{
    /* (2026-08-23 6차) 업로드는 크기 제한이 아예 없었다 — 요즘 폰 사진이면
       4000×3000도 들어온다. 촬영과 <b>같은 상한</b>을 건다. */
    state.shots[angle]=await fileToShotDataURL(file);
    // 업로드 사진은 라이브 측정과 무관 — 이전 촬영의 라이브 포즈가 남아있으면 지운다
    if(state.capturePose) state.capturePose[angle]=null;
    if(state.currentCaptureIndex<3) state.currentCaptureIndex++;
    updateAngleUI();
    checkCaptureLandmarks(angle); // 업로드 직후에도 동일하게 랜드마크 감지 안내
  })().catch(err=>{ console.warn('업로드 실패', err); try{ showToast('사진을 불러오지 못했어요'); }catch(_){} });
}

// ── 촬영/업로드 직후 랜드마크 감지 안내 (2026-07-14 추가) ──
// 사용자 요청: "처음 촬영할 때 랜드마크가 감지되는지 안내해줄 수 있나?"
// 촬영 직후 그 사진 한 장에 대해서만 detectFaceLandmarks를 바로 실행해서
// 결과를 토스트 + 앵글 카드 배지(✓/…/⚠)로 안내한다. 어차피 조정 단계
// 진입 시 파이프라인이 모든 각도의 랜드마크를 다시 감지하므로(성공 시
// state.landmarks에 같은 결과가 다시 저장됨) 여기서 미리 감지해도 중복
// 부작용은 없음 — 목적은 오직 "그 자리에서 재촬영 유도".
// (수정 2026-07-14 계속) 처음엔 후면(back)을 "얼굴이 안 보이는 게 정상"
// 이라 검사에서 뺐는데, 실기기 확인 후 사용자 지시로 후면도 동일하게
// 검사하도록 변경: "후면도 그냥 랜드마크 감지 넣어줘. 폴백 쓰면 3D이미지
// 찌그러져" — 맞는 지적. 랜드마크가 없는 뷰는 getEstimatedLandmarks()의
// 고정 추정치로 폴백되는데, 그 뷰의 makeFaceProjector 좌표 변환·포즈
// 회전이 전부 그 추정치 기준이 되어 실측 뷰들과 어긋남(3D 왜곡의 원인 중
// 하나). 후면도 뒤통수를 살짝 돌려 귀·턱 라인이 걸리면 감지되는 경우가
// 있으므로, 검사해서 알려주고 사용자가 각도를 조절할 수 있게 함.
async function checkCaptureLandmarks(angle){
  if(!state.captureLmStatus) state.captureLmStatus = {};
  const shotAtStart = state.shots[angle];
  if(!shotAtStart) return;
  // 이전 사진의 랜드마크가 남아있으면 먼저 비움 — 새 사진 감지가 실패해도
  // 옛 좌표가 절대 재사용되지 않도록(위 retakeCurrent 주석과 같은 이유).
  if(state.landmarks) state.landmarks[angle]=null;
  state.captureLmStatus[angle]='checking';
  updateAngleUI();
  // FaceLandmarker가 아직 로딩 중이면 최대 5초까지 기다림(앱 시작 직후
  // 바로 촬영하는 경우) — 그래도 준비가 안 되면 검사 불가로 보고 기존과
  // 동일하게 ✓ 표시(경고 없음), 조정 단계의 기존 감지 흐름에 맡김.
  let waited = 0;
  while(!faceLandmarkerReady && waited < 5000){
    await new Promise(r=>setTimeout(r,250)); waited += 250;
  }
  if(state.shots[angle] !== shotAtStart) return; // 그새 재촬영/삭제됨 — 이 검사 결과는 무효
  if(!faceLandmarkerReady){
    state.captureLmStatus[angle]=null; updateAngleUI(); return;
  }
  let info = await detectFaceLandmarks(angle);
  if(state.shots[angle] !== shotAtStart) return; // 감지 도중 재촬영된 경우도 무효
  /* ── 압축 손실 자가 복구 (2026-07-26 4차) ──────────────────────────
     초록불(캔버스 감지 성공)로 찍었는데 저장 JPEG에서 감지가 실패하면, 원인은
     대개 압축 손실이다. 셔터 시점 캔버스를 아직 들고 있으면 거의 무손실로 다시
     인코딩해 한 번만 재시도한다. 성공하면 그 이미지로 교체 — 이후 파이프라인
     전체가 감지되는 사진을 쓰게 된다. */
  if(!info && _lastShotCanvas && _lastShotCanvas.angle === angle && _lastShotCanvas.canvas){
    try{
      const hq = _lastShotCanvas.canvas.toDataURL('image/jpeg', 0.99);
      if(hq && hq !== state.shots[angle]){
        state.shots[angle] = hq;
        const retry = await detectFaceLandmarks(angle);
        if(state.shots[angle] !== hq) return;      // 그새 재촬영됨
        if(retry){
          info = retry;
          console.log(`[${angle}] 저장 JPEG 감지 실패 → 고품질 재인코딩(0.99)으로 성공 — 압축 손실이 원인이었음`);
        } else {
          state.shots[angle] = shotAtStart;        // 소득 없으면 원래 이미지로 되돌림
        }
      }
    }catch(e){ console.warn('고품질 재인코딩 실패:', e); }
  }
  // [진단] 셔터 시점 캔버스 감지 vs 저장 이미지 감지 — 초록불과 실제 결과의 간극 추적
  {
    const cap = state.capturePose && state.capturePose[angle];
    const canvasOk = cap ? (cap.src === 'shutter' ? '성공' : cap.src === 'verified' ? '검증프레임으로 대체' : '라이브값만') : '실패';
    console.log(`[${angle}] 셔터 캔버스 감지=${canvasOk} / 저장 이미지 감지=${info ? '성공' : '실패'}`
      + (info && typeof info.poseYawDeg === 'number' ? ` (yaw ${info.poseYawDeg.toFixed(0)}°)` : ''));
  }
  if(info){
    const yawDeg = (typeof info.poseYawDeg === 'number') ? info.poseYawDeg : null;
    const yawTxt = (yawDeg !== null) ? ` (yaw ${yawDeg.toFixed(0)}°)` : '';
    // ── 슬롯-사진 불일치 검사 (2026-07-26 추가) ──
    // 실기기 로그에서 back 뷰가 우측과 같은 -28°로 잡힌 적이 있다. 후면 슬롯에
    // 정면·측면 얼굴이 찍힌 것으로, 4장 중 2장이 사실상 같은 각도가 되어
    // 후면 정보가 통째로 비고 두상 복원이 무너진다(실제로 3D가 뭉개짐).
    // 각도가 명백히 슬롯과 어긋나면 ✓ 대신 ⚠로 알려준다.
    let mismatch = null;
    if(angle === 'back' && yawDeg !== null && Math.abs(yawDeg) < 70){
      mismatch = `후면 슬롯인데 얼굴이 ${Math.abs(yawDeg).toFixed(0)}°로 잡혔어요 — 뒷머리 사진이 맞나요?`;
    } else if((angle === 'left' || angle === 'right') && yawDeg !== null){
      const tt = LIVE_YAW_TARGET[angle];
      if((yawDeg >= 0) !== (tt.max > 0) && Math.abs(yawDeg) > 10)
        mismatch = `${ANGLE_LABELS[angle]} 슬롯인데 반대쪽 옆얼굴이에요(yaw ${yawDeg.toFixed(0)}°)`;
      else if(Math.abs(yawDeg) < 20)
        mismatch = `${ANGLE_LABELS[angle]} 슬롯인데 거의 정면이에요(yaw ${yawDeg.toFixed(0)}°) — 옆머리 정보가 부족해요`;
    }
    /* ── 정수리 잘림은 <b>저장본</b>에서 본다 (2026-08-18) ─────────────────────
       frameCutCheck는 여태 라이브 가이드에서만 돌았다. 업로드 사진은 그 경로를
       안 지나므로 잘린 사진이 그대로 들어갔고, 잘리면 정수리·후두부 상단의
       실측 근거가 통째로 없어진다(그 구간이 "숱 없음"으로 나온다).
       미리보기(#shotPreview)는 담기로 바뀌었지만 그건 <b>보여주는</b> 문제고,
       이건 <b>실제 저장본</b>을 재는 것이라 둘 다 필요하다. */
    const framed = (info.rawLandmarks && info.rawLandmarks.length >= 468)
                 ? frameCutCheck(info.rawLandmarks) : { cut:false };
    if(framed.cut){
      console.log(`[${angle}] 프레임 잘림: 머리 ${framed.where} — 저장본 기준(미리보기 아님).`
        + ' 정수리가 잘리면 그 구간은 실측 근거가 없어 "숱 없음"으로 나옵니다.');
    }
    if(framed.cut){
      state.captureLmStatus[angle]='wrongslot';
      showToast(framed.where==='위'
        ? `⚠ ${ANGLE_LABELS[angle]} 머리 위가 사진 밖이에요 — 정수리·뒷머리 윗부분이 "숱 없음"으로 나옵니다. 머리 위 여백이 남게 다시 찍어주세요`
        : `⚠ ${ANGLE_LABELS[angle]} 머리 ${framed.where}이 사진 밖이에요 — 두상 폭 실측이 어긋납니다`);
    } else if(mismatch){
      state.captureLmStatus[angle]='wrongslot';
      showToast('⚠ ' + mismatch + ' 다시 촬영을 권해요');
    } else {
      state.captureLmStatus[angle]='ok';
      showToast(`${ANGLE_LABELS[angle]} 얼굴 랜드마크 감지 ✓${yawTxt}`);
    }
  } else {
    state.captureLmStatus[angle]='fail';
    // (2026-07-26) 감지가 실패해도 셔터 직전 라이브 실측 각도가 남아 있으면
    // 그 값이 그대로 쓰인다는 걸 알려준다 — "실패=각도 버림"이 아님.
    // 후면은 얼굴이 원리적으로 안 잡힌다 — PoseLandmarker로 귀 앵커를 대신 확보해서
    // 네 장이 같은 기준점(귀)을 공유하게 한다. 성공하면 신뢰도도 0.25 → 0.5로 올라간다.
    if(angle === 'back'){
      const ears = await detectBackEarsByPose(angle);
      if(state.shots[angle] !== shotAtStart) return;
      if(!state.poseEars) state.poseEars = {};
      state.poseEars[angle] = ears;
      _silhouetteAnchorCache = {};   // 앵커 재계산 필요
      console.log(ears ? `[${angle}] 포즈 귀 앵커 확보 — 간격 ${(ears.span*100).toFixed(1)}% (얼굴 대신 이 기준점 사용)`
                       : `[${angle}] 포즈 귀 앵커도 실패 — 실루엣 최대폭 추정으로 폴백`);
    }
    const cap = getCapturePose(angle);
    if(cap){
      // 각도는 살렸지만 랜드마크(귀·눈·턱 좌표)가 없으면 그 뷰의 2D→3D 매핑이
      // 추정치로 떨어져 3D가 망가진다 — 각도 보존과 별개로 재촬영을 권한다.
      showToast(`⚠ ${ANGLE_LABELS[angle]} 랜드마크 감지 실패 — 각도(yaw ${cap.yawDeg.toFixed(0)}°)는 살렸지만 3D 정확도가 떨어져요. 조금 덜 돌린 각도로 다시 찍는 걸 권해요`);
    } else
    // 후면은 원래 얼굴이 안 잡히는 경우가 많아 안내 문구를 다르게 —
    // "실패했으니 무조건 다시"가 아니라 "가능하면 귀·턱 라인이 걸리게".
    showToast(angle === 'back'
      ? `⚠ 후면 랜드마크 감지 실패 — 이 상태로도 진행은 되지만(추정치 폴백) 뒤통수를 살짝 돌려 귀·턱 라인이 걸리면 3D가 더 정확해져요`
      : `⚠ ${ANGLE_LABELS[angle]} 랜드마크 감지 실패 — 눈·코 라인이 살짝 보이는 각도로 다시 촬영하면 3D 정확도가 올라가요`);
  }
  updateAngleUI();
}

/* ════════════════════════════════════════
   실시간 촬영 각도 가이드 (2026-07-26 추가)
   ────────────────────────────────────────
   사용자 요청: "처음 사진 4장 찍을 때, 찍기 전에 실시간 감지로 각도를 확인해서
   40~55 범위 안에 들어올 때 초록색 라인과 함께 '지금 찍으세요' 안내를 줘서
   찍게 만들어줘." + "좌/우 측면만 40~55를 쓰고, 후면은 귀 2개가 다 보이면"
   + "각도 감지 엔진을 따로 추가하는 게 아니라, 사진 찍고 나면 검증하는 그
   MediaPipe를 처음 시작할 때 로드해서 쓰면 될 것 같은데".

   ── 설계 ──
   · 엔진을 새로 만들지 않는다. 앱 시작 시 initFaceLandmarker()가 이미 로드해둔
     그 faceLandmarker 인스턴스를 그대로 재사용하고, 입력만 <img> 대신 <video>
     엘리먼트를 넘긴다. MediaPipe의 detect()는 ImageSource(HTMLVideoElement 포함)를
     받으므로 runningMode:'IMAGE' 그대로 라이브 프레임 판정이 가능하다.
     → 추가 모델 다운로드 0개. 촬영 후 검증과 완전히 같은 포즈 계산(PnP)을 쓰므로
       "가이드는 초록이었는데 찍고 나니 실패" 같은 불일치가 원리적으로 없다.
   · 단, 후면(back)은 얼굴이 안 보여 FaceLandmarker로 귀를 잡을 수 없다. 사용자가
     요청한 "귀 2개" 판정을 위해 PoseLandmarker를 쓰는데, 같은 @mediapipe/tasks-vision
     모듈(이미 import됨)에서 만들되 사용자가 실제로 후면 슬롯에 도착했을 때만
     지연 로드한다 — 앞 3장 찍는 동안은 추가 네트워크 비용이 전혀 없다.

   ── 미러(거울) 부호 주의 ──
   captureCurrentAngle()은 캔버스에 scale(-1,1)로 좌우를 뒤집어 저장한다(셀피 미러).
   따라서 "저장된 사진의 yaw" = -(라이브 영상의 yaw). 판정은 저장 사진 기준으로
   통일하고 라이브 값에 LIVE_MIRROR_SIGN을 곱해서 맞춘다.

   ── (2026-07-26 수정) 좌/우 목표 각도가 뒤바뀌어 있던 버그 ──
   증상: "좌측면을 맞춰주세요" 안내에 맞춰 왼쪽 옆머리를 보여주면 가이드가
        "반대 방향이에요"라고 함 = 안내가 좌우 반대.
   원인: 이 파일의 yaw 부호 규약은 "양수 = 사진 속에서 얼굴이 오른쪽을 봄"이다
        (detectFaceLandmarks의 yaw = (nose.x - earCX)/…, sectionBandsFor의
        faceDir 주석 "+1=오른쪽"). 저장 사진은 미러라, 왼쪽 옆머리를 보여주려고
        고개를 오른쪽으로 돌리면 저장 사진의 yaw는 "양수"가 된다.
        실기기 로그가 이걸 그대로 증명함 — 헤더 기록의 실측값
        "정면0.2 / 좌31 / 우-25", "이 뷰들의 실측 yaw도 21°/-31°"
        → 좌측 뷰 = 양수, 우측 뷰 = 음수.
        그런데 LIVE_YAW_TARGET은 left를 음수(-55~-40), right를 양수로 잡고
        있어서 정확히 반대로 요구하고 있었다. (ASSUMED_YAW_DEG의 left:-90/
        right:90도 같은 착오라 아래에서 함께 바로잡음.)
   수정: left = +40~+55, right = -55~-40 으로 교환. 부호 규약 자체(그리고
        LIVE_MIRROR_SIGN = -1)는 실측과 맞으므로 건드리지 않는다.
        ⚠ 여기서 LIVE_MIRROR_SIGN을 뒤집어 "고치면" 정면 안내(왼쪽/오른쪽
        돌려주세요)까지 같이 뒤집혀 버린다 — 정면 안내는 원래 맞았음.
════════════════════════════════════════ */

/* ── (2026-07-26 2차 수정) 각도만으로 잡던 합격 조건에 "랜드마크 감지"를 추가 ──
   사용자 실기기 보고: "46도인데도 랜드마크가 안 잡혔어. 랜드마크 감지 안 되니까
   3D 이미지가 망가져."
   원인: 합격 판정이 오직 yaw 범위(40~55°)였다. 그런데 MediaPipe가 얼굴을 잡을 수
   있느냐는 각도 하나로 정해지지 않는다 — 조명·안경·얼굴 크기·고개 pitch에 따라
   같은 46°에서도 잡히거나 안 잡힌다. 즉 "40~55°"는 감지 가능성의 대리 지표였을
   뿐이고, 대리 지표만 보고 초록불을 켜니 감지 실패 사진이 통과됐다.
   수정 2가지:
   1) 각도 범위는 하한 위주로 완화(35~65°) — 정확한 상한을 각도로 정하는 건
      애초에 불가능하고, 아래 2)가 실질 상한 역할을 한다.
   2) 진짜 조건을 직접 검사한다: "지금 이 프레임을 그대로 저장했을 때 그 사진에서
      랜드마크가 잡히는가". 라이브 판정을 <video>로만 하지 않고, 촬영과 완전히
      동일한 경로(미러 캔버스)로 한 장 떠서 거기서도 감지되는지 확인한 뒤에만
      초록불을 켠다(liveStillLandmarkOk). 원리적으로 "가이드는 초록이었는데
      찍고 나니 감지 실패"가 나올 수 없게 됨.                                    */
// 저장 사진 기준 목표 각도(도). 측면 하한 35°(그 이상은 랜드마크 감지 여부로 판정).
// turn = 그 각도를 만들려면 사용자가 고개를 실제로 어느 쪽으로 돌려야 하는지.
//        (미러 저장이라 "보여줄 옆머리 쪽"과 "돌리는 방향"이 서로 반대다:
//         왼쪽 옆머리를 카메라에 보이려면 고개는 오른쪽으로 돌려야 함)
const LIVE_YAW_TARGET = {
  front: { min:-12, max: 12, label:'정면', turn:null },
  // (2026-07-26 3차) 하한 35 → 40. 실기기 경험("각도를 많이 돌리고 나서 잘 나왔다")과
  // 깊이 복원의 조건수 계산이 같은 숫자를 가리킨다 — d²=(E²−W²cos²θ)/sin²θ 는 40°
  // 아래에서 오차 증폭이 2배를 넘어 z를 못 믿게 된다(15°:±0.18, 25°:±0.07, 40°:±0.035).
  // (2026-09-19 배포본 반영) 40~65° → 35~60°. 초록불까지 너무 많이 돌려야 해서
  // 범위를 5° 앞당겼다. (위 3차 메모의 조건수 이유로 35 아래로는 내리지 말 것)
  left:  { min: 35, max: 60, label:'좌측', turn:'오른쪽' }, // 왼쪽 옆머리 = 고개는 오른쪽으로
  right: { min:-60, max:-35, label:'우측', turn:'왼쪽'  }, // 오른쪽 옆머리 = 고개는 왼쪽으로
};
const LIVE_MIRROR_SIGN = -1;      // 라이브 yaw → 저장 사진 yaw 변환 계수(미러 촬영이라 -1)
const LIVE_DETECT_INTERVAL = 120; // ms. 프레임마다 돌리면 과함 — 약 8fps면 안내용으로 충분
// (2026-07-26 3차) 유예를 줄였다 — 유예가 길수록 "초록불이 켜진 상태"가 과거의
// 상태라는 뜻이고, 그 차이가 곧 사용자가 체감한 셔터 지연이다. 아래 검증 프레임
// 보관(_liveVerifiedCanvas)이 있어 유예를 짧게 잡아도 초록이 심하게 깜빡이지 않는다.
const LIVE_LOST_GRACE = 450;      // ms. 한두 프레임 놓쳐도 바로 빨간불로 안 떨어지게
const LIVE_STILL_INTERVAL = 250;  // ms. "저장본 감지" 확인 주기(매 틱마다 두 번 돌리면 과함)
const LIVE_STILL_GRACE = 600;     // ms. 저장본 감지도 한두 번 놓친 걸로 초록이 깜빡이지 않게
// 고개 숙임/듦 경고 임계(도). 이 이상이면 칩에 표시하고, 감지 실패 시 원인으로 안내.
// 판정 자체엔 안 넣는다 — 숙여도 랜드마크만 잡히면 촬영은 유효하다.
const LIVE_PITCH_WARN = 18;

/* ── 후면 음성 안내 + 자동 촬영 (2026-07-26, 임시 기능) ────────────────────
   사용자 상황: 뒤를 돌아본 채로 찍으므로 화면을 볼 수 없다 — 초록불도 초록 띠도
   후면에선 무용지물이다. 그래서 후면 슬롯에서만 (1) 안내를 소리로 읽어주고
   (2) 조건이 유지되면 카운트다운 후 자동으로 찍는다.
   ※ 임시: BACK_AUTO_SHOOT=false로 두면 기존처럼 직접 셔터를 누르는 동작으로 복귀. */
const BACK_AUTO_SHOOT   = true;
/* 후면 음성 안내 (2026-08-11 사용자 지시로 꺼짐) — "후면 촬영할 때 음성안내
   나오는데 그거 삭제해줘". 자동 촬영은 그대로 두고 <b>소리만</b> 끈다.
   speak()를 한 곳에서 막으므로 카운트다운·안내가 전부 조용해진다.
   되살리려면 BACK_VOICE = true. */
const BACK_VOICE        = false;
const BACK_HOLD_MS      = 700;   // 조건이 이만큼 유지되면 카운트다운 시작
const BACK_COUNT_STEP   = 800;   // 카운트다운 간격(삼·이·일)
const SPEAK_MIN_GAP     = 2200;  // 같은 안내를 반복해서 읽지 않게(ms)
var _speakLast = { text:'', at:0 };
var _backCountStart = null, _backSpoken = -1;

// 음성 안내 — 같은 문장은 SPEAK_MIN_GAP 안에 다시 읽지 않는다.
function speak(text, force){
  if(!BACK_VOICE) return;                 // 사용자 지시로 음성 안내 끔(위 BACK_VOICE)
  try{
    if(!('speechSynthesis' in window) || !text) return;
    const now = performance.now();
    if(!force && text === _speakLast.text && now - _speakLast.at < SPEAK_MIN_GAP) return;
    _speakLast = { text, at:now };
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ko-KR'; u.rate = 1.05;
    window.speechSynthesis.speak(u);
  }catch(e){}
}
function stopSpeak(){ try{ window.speechSynthesis && window.speechSynthesis.cancel(); }catch(e){} }

/* ── 정수리 잘림 감지 ────────────────────────────────────────────────
   앉아서 가까이 찍으면 머리 위가 프레임 밖으로 나간다. 그러면 후면 복원의
   기준점(정수리)이 통째로 사라지고, 두상 세로 반경도 무너진다.
   얼굴 랜드마크에는 정수리가 없으므로 얼굴 높이로 추정한다 —
   이마(랜드마크 최상단)에서 얼굴 높이의 CROWN_ABOVE_FACE 만큼 위. */
/* (2026-09-19 배포본 반영) 0.55 → 0.30, 여유 0.012 → 0.004.
   0.55는 정수리를 너무 높게 잡아서 머리가 화면에 다 들어와도 "정수리 잘림"으로
   막히는 일이 잦았다. 추정을 낮추고 가장자리 여유도 줄였다. */
const CROWN_ABOVE_FACE = 0.3;    // 얼굴 높이 대비 이마→정수리 비율(보수적으로 낮춤)
const EDGE_MARGIN      = 0.004;  // 프레임 가장자리 여유(정규 좌표)
/* (2026-09-19) 정면/좌/우에서 "위" 잘림은 이제 촬영을 막지 않고 칩에 경고만 띄운다.
   liveAngleCheck가 매 프레임 갱신하고, 같은 함수 아래쪽 칩 문구에서 읽는다. */
var _crownWarn = false;
// 랜드마크 배열 → {cut:true/false, where:'위'|'왼쪽'|'오른쪽'}
function frameCutCheck(pts, crownFactor){
  let minY=1, maxY=0, minX=1, maxX=0;
  for(const p of pts){
    if(p.y<minY) minY=p.y; if(p.y>maxY) maxY=p.y;
    if(p.x<minX) minX=p.x; if(p.x>maxX) maxX=p.x;
  }
  const h = Math.max(1e-6, maxY-minY);
  const crownY = minY - h*(crownFactor==null?CROWN_ABOVE_FACE:crownFactor);
  if(crownY < EDGE_MARGIN) return { cut:true, where:'위' };
  if(minX < EDGE_MARGIN)   return { cut:true, where:'왼쪽' };
  if(maxX > 1-EDGE_MARGIN) return { cut:true, where:'오른쪽' };
  return { cut:false };
}
/* ── 후면 판정 기준 (2026-07-26 재작성) ────────────────────────────────
   예전엔 "양쪽 귀가 다 보이는가"(visibility ≥ 0.5)로 판정했는데, 뒤돌아 서면
   두 귀가 모두 머리에 가려져 visibility가 둘 다 낮게 나온다. 그러면
   `visL < visR ? '왼쪽' : '오른쪽'` 이 늘 같은 쪽만 골라서, 사용자가 아무리
   돌려도 "오른쪽 귀가 가려졌어요"만 반복됐다(실기기 보고 — 결국 수동 촬영).
   게다가 후면 복원(computeSilhouetteAnchors)이 실제로 쓰는 건 귀가 아니라
   "정수리 + 어깨 직전 최대폭"이다. 즉 귀 가시성은 필요한 조건이 아니었다.
   → 뒤에서도 안정적으로 잡히는 신호로 교체:
       ① 얼굴(코·눈)이 안 보일 것        = 정말 뒤를 보고 있다
       ② 어깨가 둘 다 잡히고 수평일 것   = 상체가 화면에 있고 기울지 않았다
       ③ 머리가 어깨 중앙 위에 있을 것   = 고개를 돌려 뒤돌아보고 있지 않다
       ④ 정수리가 안 잘릴 것             = 복원 기준점이 살아 있다
   좌/우 방향 안내는 쓰지 않는다 — 뒤돌아선 사람에게 "왼쪽"은 중의적이라
   음성으로 들으면 오히려 헷갈린다. */
const BACK_FACE_MAX_VIS = 0.90;   // 코·눈이 이보다 잘 보이면 카메라를 보고 있는 것
const BACK_SHOULDER_MIN_VIS = 0.5;// 어깨 최소 신뢰도
const BACK_SHOULDER_MIN_W = 0.10; // 어깨 너비(정규 x) 하한 — 옆으로 서면 좁아진다
const BACK_CENTER_TOL = 0.16;     // 머리 중심이 어깨 중심에서 벗어난 허용치(어깨폭 대비)
const BACK_TILT_TOL = 0.22;       // 어깨 기울기 허용치(어깨폭 대비 y차)
const BACK_EAR_MIN_SPAN = 0.045;  // 정규화 x 기준 두 귀 최소 간격(완전 옆모습이면 붙어버림)

// ⚠ 아래 상태 변수들은 반드시 var — let/const가 아님.
// updateAngleUI()가 정의 직후 로드 시점에 한 번 호출되는데(파일 위쪽), 그 안에서
// syncLiveGuide() → stopLiveGuide()가 이 변수들을 건드린다. 이 블록은 그보다
// 아래에 있으므로 let이면 TDZ("Cannot access '_liveRAF' before initialization")로
// 앱 초기화가 통째로 죽는다(실제로 겪음). var는 호이스팅되어 undefined로 안전.
var _liveRAF = null;
var _liveLastDetect = 0;
var _liveReadyState = false;
var _liveLastGood = 0;      // 마지막으로 "범위 안"이었던 시각
var _liveLastMsg = '';
var __lmDetectBusy = false; // faceLandmarker 재진입 방지(촬영 직후 검증과 공유하는 인스턴스라)
// 마지막으로 성공한 라이브 포즈 측정(저장 사진 기준으로 미러 보정 완료).
// {yawDeg, pitchDeg, rollDeg, ts, angle}. captureCurrentAngle()이 셔터 순간에
// 이걸 state.capturePose[angle]로 복사해, 저장 사진 감지 실패 시 폴백으로 쓴다.
var _liveLastPose = null;
// ── "저장본에서도 감지되는가" 확인용 ──
var _liveStillCanvas = null;  // 촬영과 같은 미러 캔버스(재사용)
var _liveStillOkAt   = 0;     // 마지막으로 저장본 감지에 성공한 시각
var _liveStillCheckAt= 0;     // 마지막으로 확인을 시도한 시각(주기 제한용)
var _liveStillLastOk = false;
/* ── (2026-07-26 3차) 셔터 지연 보정: "검증된 프레임"을 따로 보관 ──────────
   사용자 보고: "파란불(초록) 들어왔을 때 찍었는데 결과가 이상해. 셔터 지연이
   좀 되나봐?" — 맞다. 초록불은 (a) 최대 LIVE_STILL_INTERVAL(확인 주기) +
   (b) 유예시간 + (c) 사람 반응시간(0.2~0.5s)만큼 과거의 상태다. 그 사이 고개가
   움직이면 "검증되지 않은 프레임"이 저장된다.
   → 확인에 성공한 그 프레임 자체를 캔버스로 복사해두고(픽셀 복사는 저렴),
     셔터를 눌렀을 때 현재 프레임이 감지에 실패하면 이 검증된 프레임을 대신
     저장한다. 사용자가 초록불을 보고 누른 의도와 실제 저장본이 일치하게 됨.
   덤: 이 캔버스는 곧 저장될 이미지 그 자체라, 여기서 뽑은 포즈는 미러 보정이
     필요 없는 "저장 사진 기준" 실측 포즈다(라이브 값보다 정확). */
var _liveVerifiedCanvas = null; // 감지 성공이 확인된 프레임(미러 완료)
var _liveVerifiedAt     = 0;
var _liveVerifiedAngle  = null;
var _liveVerifiedPose   = null; // {yawDeg,pitchDeg,rollDeg} — 저장 사진 기준
const VERIFIED_SHOT_MAX_AGE = 2000; // ms. 이보다 오래된 검증 프레임은 안 씀
// (4차 상향 1200→2000) 초록 유지 유예(600)+빨간불 유예(450)+사람 반응(~300)이
// 겹치면 셔터가 1.2초를 넘길 수 있고, 그러면 폴백이 없어 감지 안 되는 프레임이
// 그대로 저장됐다. 초록인 동안은 자세를 유지하므로 2초 전 검증 프레임도 거의 같다.
var _lastShotCanvas = null; // {angle, canvas} — 저장 JPEG 감지 실패 시 재인코딩용

// 캔버스(=저장될 이미지)에서 직접 포즈를 뽑는다. 미러가 이미 적용된 캔버스이므로
// LIVE_MIRROR_SIGN 보정이 필요 없다. 감지 실패면 null.
function detectPoseOnCanvas(cv){
  if(!faceLandmarkerReady || !faceLandmarker) return null;
  const poseOf = (src)=>{
    let r = null;
    try{ r = faceLandmarker.detect(src); }catch(e){ return null; }
    if(!r || !r.faceLandmarks || !r.faceLandmarks.length) return null;
    if(!r.facialTransformationMatrixes || !r.facialTransformationMatrixes.length) return null;
    try{
      const p = decomposePoseMatrix(r.facialTransformationMatrixes[0].data);
      return { yawDeg:p.yawRad*180/Math.PI, pitchDeg:p.pitchRad*180/Math.PI, rollDeg:p.rollRad*180/Math.PI };
    }catch(e){ return null; }
  };
  const direct = poseOf(cv);
  if(direct) return direct;
  /* ── 중앙크롭 확대 재시도 (2026-07-26 3차) ──────────────────────────
     detectFaceLandmarks(저장 사진)에는 원본→2배확대→중앙크롭확대 3단 사다리가
     있는데 라이브 가이드에는 없어서, 가이드가 촬영보다 더 엄격했다. 실기기 로그에
     "[right] 원본 실패 → '중앙크롭확대' 재시도로 성공"이 그대로 찍혔다 — 저장은
     되는데 초록불은 안 켜지던 상태(사용자: "파란불이 잘 안 켜져").
     비용을 감안해 라이브에선 가장 잘 듣는 한 단계(중앙크롭 확대)만 쓴다.
     포즈(회전)만 쓰므로 크롭으로 인한 주점 이동은 무시 가능. */
  try{
    const W = cv.width, H = cv.height;
    if(W > 40 && H > 40){
      const sx = W*0.15, sy = H*0.08, sw = W*0.70, sh = H*0.84;
      const sc = Math.max(1, Math.min(2, 1800/sw, 1800/sh));
      if(!_liveCropCanvas) _liveCropCanvas = document.createElement('canvas');
      const cc = _liveCropCanvas;
      const cw2 = Math.round(sw*sc), ch2 = Math.round(sh*sc);
      if(cc.width !== cw2 || cc.height !== ch2){ cc.width = cw2; cc.height = ch2; }
      const cx = cc.getContext('2d');
      cx.setTransform(1,0,0,1,0,0);
      cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = 'high';
      cx.drawImage(cv, sx, sy, sw, sh, 0, 0, cw2, ch2);
      return poseOf(cc);
    }
  }catch(e){}
  return null;
}
var _liveCropCanvas = null;   // 라이브 재시도용 크롭 캔버스(재사용)

// 지금 이 비디오 프레임을 촬영과 완전히 동일하게(미러 캔버스) 떠서, 그 이미지에서
// faceLandmarker가 얼굴을 잡는지 확인한다. 촬영 경로(captureCurrentAngle)와 같은
// 캔버스·같은 미러 변환을 쓰므로 "가이드는 통과했는데 저장 사진은 감지 실패"가
// 생기지 않는다. detect()는 HTMLCanvasElement도 그대로 받으므로 dataURL 왕복 없이
// 동기로 끝난다(비용: 프레임당 detect 1회 추가, LIVE_STILL_INTERVAL로 제한).
function liveStillLandmarkOk(now, angle){
  if(now - _liveStillCheckAt < LIVE_STILL_INTERVAL) return _liveStillLastOk;
  _liveStillCheckAt = now;
  if(!faceLandmarkerReady || !faceLandmarker || !video.videoWidth) return _liveStillLastOk;
  if(!_liveStillCanvas) _liveStillCanvas = document.createElement('canvas');
  const c = _liveStillCanvas;
  if(c.width !== video.videoWidth || c.height !== video.videoHeight){
    c.width = video.videoWidth; c.height = video.videoHeight;
  }
  const cx = c.getContext('2d');
  cx.setTransform(1,0,0,1,0,0);
  cx.translate(c.width,0); cx.scale(-1,1);   // 촬영과 동일한 미러
  cx.drawImage(video,0,0);
  const pose = detectPoseOnCanvas(c);
  const ok = !!pose;
  _liveStillLastOk = ok;
  if(ok){
    _liveStillOkAt = now;
    // 이 프레임을 통째로 보관 — 셔터가 늦게 눌려도 이 프레임으로 저장할 수 있게.
    if(!_liveVerifiedCanvas) _liveVerifiedCanvas = document.createElement('canvas');
    const v = _liveVerifiedCanvas;
    if(v.width !== c.width || v.height !== c.height){ v.width = c.width; v.height = c.height; }
    const vx = v.getContext('2d');
    vx.setTransform(1,0,0,1,0,0);
    vx.drawImage(c,0,0);          // 픽셀 복사(미러는 이미 적용됨)
    _liveVerifiedAt = now; _liveVerifiedAngle = angle; _liveVerifiedPose = pose;
  }
  return ok;
}

// ── 후면용 PoseLandmarker: 후면 슬롯에 도착했을 때만 지연 로드 ──
var posePoseLandmarker = null;
var poseLandmarkerState = 'idle'; // idle | loading | ready | fail
async function ensurePoseLandmarker(){
  if(poseLandmarkerState === 'ready' || poseLandmarkerState === 'loading' || poseLandmarkerState === 'fail') return;
  poseLandmarkerState = 'loading';
  try{
    const vision = await loadVisionModule();
    const PL = vision.PoseLandmarker, FR = vision.FilesetResolver;
    if(!PL || !FR) throw new Error('PoseLandmarker API 없음');
    const fs = await FR.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/wasm');
    posePoseLandmarker = await PL.createFromOptions(fs, {
      baseOptions:{
        modelAssetPath:'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
        delegate:'GPU'
      },
      runningMode:'IMAGE', numPoses:1,
      minPoseDetectionConfidence:0.4, minPosePresenceConfidence:0.4, minTrackingConfidence:0.4,
    });
    poseLandmarkerState = 'ready';
    console.log('Pose Landmarker(후면 귀 판정) 준비 완료');
  }catch(e){
    poseLandmarkerState = 'fail';
    window.__poseDiag = (e && e.message) ? e.message : String(e);
    console.warn('Pose Landmarker 로드 실패 — 후면은 가이드 없이 진행:', e);
  }
}

// 현재 촬영 슬롯에서 실시간 가이드를 돌려야 하는 상황인지
function liveGuideShouldRun(){
  if(typeof currentScreen !== 'undefined' && currentScreen !== 'capture') return false;
  if(!cameraStream) return false;
  const angle = ANGLES[state.currentCaptureIndex];
  if(state.shots[angle]) return false;              // 이미 찍은 슬롯(미리보기 중)이면 불필요
  if(video.style.display === 'none') return false;
  return true;
}

function setLiveUI(ready, chipText, chipOk, hintText){
  const wrap = document.querySelector('.capture-video-wrap');
  const chip = document.getElementById('liveAngleChip');
  const btn  = document.getElementById('shutterBtn');
  const hint = document.getElementById('captureHint');
  if(wrap) wrap.classList.toggle('live-ready', !!ready);
  if(btn)  btn.classList.toggle('live-ready', !!ready);
  if(chip){
    if(chipText === null){ chip.classList.add('hide'); }
    else { chip.classList.remove('hide'); chip.textContent = chipText; chip.classList.toggle('ok', !!chipOk); }
  }
  if(hint && hintText != null && hintText !== _liveLastMsg){ hint.textContent = hintText; _liveLastMsg = hintText; }
  _liveReadyState = !!ready;
}

// 판정 1회. 반환: {ready, chip, hint}
function liveEvaluateFrame(angle){
  // ── 후면: 얼굴 대신 양쪽 귀가 다 보이는지(PoseLandmarker) ──
  if(angle === 'back'){
    if(poseLandmarkerState === 'loading') return { ready:false, chip:'후면 감지 준비 중…', hint:'후면(뒷머리)을 맞춰주세요' };
    if(poseLandmarkerState !== 'ready')  return { ready:false, chip:null, hint:'후면(뒷머리)을 맞춰주세요' };
    let res = null;
    try{ res = posePoseLandmarker.detect(video); }catch(e){ return { ready:false, chip:null, hint:'후면(뒷머리)을 맞춰주세요' }; }
    const pts = res && res.landmarks && res.landmarks[0];
    if(!pts || pts.length < 13) return { ready:false, chip:'사람이 안 잡혀요', hint:'뒷머리와 어깨가 화면에 들어오게 서주세요' };
    const vis = p => (p && typeof p.visibility === 'number') ? p.visibility : 0;

    // ① 얼굴이 보이면 아직 뒤를 안 본 것
    const faceVis = Math.max(vis(pts[0]), vis(pts[2]), vis(pts[5]));
    if(faceVis > BACK_FACE_MAX_VIS)
      return { ready:false, chip:'얼굴이 보여요', hint:'고개를 앞으로 돌려 뒷머리만 보이게 해주세요' };

    // ② 어깨
    const lS = pts[11], rS = pts[12];
    if(Math.min(vis(lS), vis(rS)) < BACK_SHOULDER_MIN_VIS)
      return { ready:false, chip:'어깨가 안 잡혀요', hint:'상체가 화면에 들어오게 서주세요' };
    const shoW = Math.abs(lS.x - rS.x);
    if(shoW < BACK_SHOULDER_MIN_W)
      return { ready:false, chip:'몸이 옆으로 돌아갔어요', hint:'어깨가 화면과 나란해지게 서주세요' };
    const tilt = Math.abs(lS.y - rS.y) / shoW;
    if(tilt > BACK_TILT_TOL)
      return { ready:false, chip:`어깨 기울기 ${(tilt*100).toFixed(0)}%`, hint:'어깨를 수평으로 맞춰주세요' };

    // ③ 머리가 어깨 중앙 위에 있는가(고개를 돌려 뒤돌아보면 크게 벗어난다)
    const earMid = (pts[7].x + pts[8].x) / 2, shoMid = (lS.x + rS.x) / 2;
    const off = Math.abs(earMid - shoMid) / shoW;
    if(off > BACK_CENTER_TOL)
      return { ready:false, chip:`머리 치우침 ${(off*100).toFixed(0)}%`, hint:'고개를 어깨와 나란히 정면으로 돌려주세요' };
    const span = Math.abs(pts[8].x - pts[7].x);
    if(span < BACK_EAR_MIN_SPAN)
      return { ready:false, chip:'너무 옆으로 돌아갔어요', hint:'뒷머리가 정면으로 오게 서주세요' };

    /* ④ 정수리 잘림 — 후면 복원의 기준점이라 여기서 잘리면 아무 소용이 없다.
       ※ visibility로 필터하면 안 된다: 뒤에서는 머리 랜드마크의 visibility가
         전부 낮아서, 정작 재야 할 머리 점들이 걸러지고 어깨만 남아 검사가
         무력화된다(테스트로 확인). 위치는 가려져도 추정되므로 귀 y를 직접 쓴다.
       귀선 위 머리 높이 ≈ 귀 간격의 0.9배(또는 어깨폭의 0.25배)로 근사. */
    {
      const earTopY = Math.min(pts[7].y, pts[8].y);
      // (2026-09-19 배포본 반영) 0.9/0.25 → 0.6/0.18 — 후면도 정수리 추정이 과해서
      // 멀쩡한 사진을 막던 것을 완화(위 CROWN_ABOVE_FACE 조정과 같은 이유).
      const headAbove = Math.max(span * 0.6, shoW * 0.18);
      if(earTopY - headAbove < EDGE_MARGIN)
        return { ready:false, chip:'정수리가 잘려요', hint:'머리 위가 화면 밖이에요 — 조금 물러나 주세요' };
    }
    return { ready:true, chip:`후면 정렬 ✓ (치우침 ${(off*100).toFixed(0)}% · 기울기 ${(tilt*100).toFixed(0)}%)`,
             hint: BACK_AUTO_SHOOT ? '그대로 계세요 — 자동으로 찍습니다' : '셔터 버튼을 눌러주세요' };
  }

  // ── 정면/좌/우: 기존 faceLandmarker를 그대로 재사용 ──
  if(!faceLandmarkerReady || !faceLandmarker) return { ready:false, chip:'각도 감지 준비 중…', hint:HINTS[angle] };
  let res = null;
  try{ res = faceLandmarker.detect(video); }catch(e){ return { ready:false, chip:null, hint:HINTS[angle] }; }
  if(!res || !res.faceLandmarks || !res.faceLandmarks.length){
    return { ready:false, chip:'얼굴이 안 잡혀요', hint:'눈·코 라인이 살짝 보이는 각도로 맞춰주세요' };
  }
  // 머리(정수리·좌우)가 프레임 밖으로 나갔는지 — 나가면 두상 실측 기준점이 사라진다
  {
    const cut = frameCutCheck(res.faceLandmarks[0]);
    // (2026-09-19 배포본 반영) 위 잘림은 경고만(_crownWarn) — 촬영은 계속 가능.
    // 좌/우 잘림만 예전처럼 막는다.
    _crownWarn = !!(cut.cut && cut.where === '위');
    if(cut.cut && cut.where !== '위') return { ready:false, chip:`머리 ${cut.where} 잘림`,
      hint: `머리 ${cut.where}이 잘려요 — 가운데로 맞춰주세요` };
  }
  let liveYaw = null, livePitch = 0, liveRoll = 0;
  if(res.facialTransformationMatrixes && res.facialTransformationMatrixes.length){
    try{
      const p = decomposePoseMatrix(res.facialTransformationMatrixes[0].data);
      liveYaw   = p.yawRad   * 180/Math.PI;
      livePitch = p.pitchRad * 180/Math.PI;
      liveRoll  = p.rollRad  * 180/Math.PI;
    }
    catch(e){ liveYaw = null; }
  }
  if(liveYaw === null || Number.isNaN(liveYaw)){
    return { ready:false, chip:'각도 계산 실패', hint:HINTS[angle] };
  }
  // 라이브 → 저장 사진 기준으로 변환(미러 보정)
  const yaw = liveYaw * LIVE_MIRROR_SIGN;
  // 이 프레임의 실측 포즈를 기억해둔다 — 셔터 순간에 state.capturePose로 넘어가고,
  // 저장 사진의 랜드마크 감지가 실패하면 ASSUMED_YAW_DEG(±90°) 대신 이 값이 쓰인다.
  // 미러 보정 규칙: x반전이므로 yaw·roll은 부호 반전(LIVE_MIRROR_SIGN), pitch는 그대로.
  _liveLastPose = { angle, yawDeg: yaw, pitchDeg: livePitch,
                    rollDeg: liveRoll * LIVE_MIRROR_SIGN, ts: performance.now() };
  const t = LIVE_YAW_TARGET[angle];
  const inRange = yaw >= t.min && yaw <= t.max;
  // 화면 표시는 사용자의 머릿속 기준에 맞춰 절대값으로 — 내부 판정만 부호 있는
  // 저장기준 yaw를 쓴다. 정면은 어느 쪽으로 틀어졌는지가 정보라 부호 유지.
  const tLo = Math.min(Math.abs(t.min), Math.abs(t.max));
  const tHi = Math.max(Math.abs(t.min), Math.abs(t.max));
  // 고개 숙임(pitch)도 같이 보여준다 — 사용자: "고개를 숙여서 그런가".
  // 판정에는 안 넣는다(숙여도 랜드마크가 잡히면 촬영은 유효). 다만 크게 숙이면
  // 감지가 잘 안 되므로 아래 안내에서 그 사실을 짚어준다.
  // (2026-09-19 배포본 반영) 정수리 잘림 경고를 칩 끝에 붙인다.
  // ※ 배포본과 동작을 똑같이 맞췄다: 고개 각도 경고가 떠 있을 때는 정수리 경고가
  //   붙지 않는다(배포본 식의 연산자 우선순위 때문). 둘 다 보이게 하려면 괄호를 바꿀 것.
  const pitchTxt = (Math.abs(livePitch) >= LIVE_PITCH_WARN)
    ? ` · 고개 ${livePitch>0?'듦':'숙임'} ${Math.abs(livePitch).toFixed(0)}°`
    : (_crownWarn ? ' · ⚠ 정수리 잘림' : '');
  const chip = (angle === 'front')
    ? `정면 ${yaw>=0?'+':''}${yaw.toFixed(0)}° / 목표 ±${t.max}°${pitchTxt}`
    : `${t.label} ${Math.abs(yaw).toFixed(0)}° / 목표 ${tLo}~${tHi}°${pitchTxt}`;
  if(inRange){
    // ── 각도만으로는 부족 ── 실제로 저장될 이미지에서 랜드마크가 잡히는지 확인.
    // 46°처럼 범위 안이어도 감지가 안 되는 각도/조명이 실기기에서 나왔고, 감지가
    // 안 되면 그 뷰의 좌표 변환이 통째로 추정치로 떨어져 3D가 망가진다.
    const now = performance.now();
    const stillOk = liveStillLandmarkOk(now, angle) || (now - _liveStillOkAt < LIVE_STILL_GRACE);
    if(stillOk) return { ready:true, chip:chip + ' · 랜드마크 ✓', hint:'셔터 버튼을 눌러주세요' };
    return { ready:false, chip:chip + ' · 랜드마크 ✗',
             hint: (Math.abs(livePitch) >= LIVE_PITCH_WARN)
               ? `고개를 ${livePitch>0?'너무 들었어요':'너무 숙였어요'} — 턱을 수평으로 두고 다시 맞춰주세요`
               : '각도는 맞는데 얼굴 인식이 안 돼요 — 조금 덜 돌리거나, 얼굴 쪽을 밝게 해주세요' };
  }

  // 어느 쪽으로 얼마나 돌려야 하는지 안내
  let hint;
  if(angle === 'front'){
    // (검증됨, 건드리지 말 것) yaw는 미러 저장 기준이라 양수 = 라이브에선 얼굴이
    // 왼쪽을 봄 = 사용자가 고개를 자기 오른쪽으로 돌린 상태 → 되돌리려면 왼쪽.
    hint = (yaw > t.max) ? '조금 왼쪽으로 돌려주세요' : '조금 오른쪽으로 돌려주세요';
  } else {
    const mag = Math.abs(yaw), lo = Math.min(Math.abs(t.min), Math.abs(t.max)), hi = Math.max(Math.abs(t.min), Math.abs(t.max));
    const sameSide = (yaw >= 0) === (t.max > 0);
    // "좌측으로 돌려주세요"는 중의적이라(보여줄 옆머리? 돌릴 방향?) 실제 동작으로 안내.
    if(!sameSide)      hint = `반대 방향이에요 — 고개를 ${t.turn}으로 돌려 ${t.label} 옆머리를 보여주세요`;
    else if(mag < lo)  hint = (uiLang === 'en')
      ? `Turn ${(lo-mag).toFixed(0)}° further to the ${tUI(t.turn)}`
      : `${t.turn}으로 ${(lo-mag).toFixed(0)}° 더 돌려주세요`;
    else               hint = `${(mag-hi).toFixed(0)}° 덜 돌려주세요(너무 옆모습)`;
  }
  return { ready:false, chip, hint };
}

function liveGuideTick(){
  _liveRAF = requestAnimationFrame(liveGuideTick);
  if(!liveGuideShouldRun()){ stopLiveGuide(); return; }
  const now = performance.now();
  if(now - _liveLastDetect < LIVE_DETECT_INTERVAL) return;
  _liveLastDetect = now;
  if(__lmDetectBusy) return;                                   // 촬영 직후 검증과 인스턴스 공유 — 겹치지 않게
  if(!(video.readyState >= 2 && video.videoWidth)) return;     // 첫 프레임 전

  const angle = ANGLES[state.currentCaptureIndex];
  let r;
  __lmDetectBusy = true;
  try{ r = liveEvaluateFrame(angle); }
  finally{ __lmDetectBusy = false; }

  if(r.ready){ _liveLastGood = now; }
  // 한두 프레임 놓쳐서 초록이 깜빡이는 걸 막는 유예
  const ready = r.ready || (now - _liveLastGood < LIVE_LOST_GRACE && _liveReadyState);
  setLiveUI(ready, r.chip, r.ready, ready && !r.ready ? null : r.hint);

  /* ── 후면 전용: 음성 안내 + 자동 촬영 ────────────────────────────────
     뒤돌아본 상태에선 화면을 못 보므로 안내를 귀로 준다. 조건이 BACK_HOLD_MS
     동안 유지되면 "삼·이·일" 카운트다운 후 자동으로 찍는다. 도중에 조건이
     깨지면 즉시 취소하고 다시 안내한다(잘못된 프레임이 저장되지 않게). */
  if(angle === 'back' && BACK_AUTO_SHOOT){
    if(r.ready){
      if(_backCountStart === null){ _backCountStart = now; _backSpoken = -1; }
      const held = now - _backCountStart;
      if(held >= BACK_HOLD_MS){
        const step = Math.floor((held - BACK_HOLD_MS) / BACK_COUNT_STEP); // 0,1,2 → 삼,이,일
        if(step <= 2 && step > _backSpoken){
          _backSpoken = step;
          speak(['셋','둘','하나'][step], true);
        }
        if(step >= 3){
          _backCountStart = null; _backSpoken = -1;
          speak('찍었습니다', true);
          captureCurrentAngle();          // 자동 촬영 — 이후 슬롯이 차서 가이드가 멈춘다
          return;
        }
      }
    } else {
      if(_backCountStart !== null){ _backCountStart = null; _backSpoken = -1; stopSpeak(); }
      if(r.hint) speak(r.hint);           // 같은 안내는 SPEAK_MIN_GAP 안에 반복 안 함
    }
  }
}

function startLiveGuide(){
  if(_liveRAF !== null) return;
  _liveLastGood = 0; _liveLastDetect = 0;
  _liveRAF = requestAnimationFrame(liveGuideTick);
}
function stopLiveGuide(){
  if(_liveRAF !== null){ cancelAnimationFrame(_liveRAF); _liveRAF = null; }
  setLiveUI(false, null, false, null);
  _liveLastGood = 0;
  // 저장본 감지 상태도 초기화 — 슬롯/화면이 바뀌면 이전 각도의 성공이 남아
  // 다음 슬롯에서 근거 없이 초록불이 켜질 수 있음
  _liveStillOkAt = 0; _liveStillCheckAt = 0; _liveStillLastOk = false;
  _liveVerifiedAt = 0; _liveVerifiedAngle = null; _liveVerifiedPose = null;
  _backCountStart = null; _backSpoken = -1; stopSpeak(); // 후면 자동촬영 카운트다운도 취소
  _liveLastMsg = ''; // 다음에 같은 문구가 다시 필요할 때 중복제거에 걸려 안 뜨는 것 방지
}

// 화면/슬롯이 바뀔 때마다 호출 — 돌려야 하면 켜고, 아니면 끈다.
function syncLiveGuide(){
  if(!liveGuideShouldRun()){ stopLiveGuide(); return; }
  // 후면 슬롯에 처음 도착한 순간에만 Pose 모델을 받는다(앞 3장은 추가 다운로드 0).
  if(ANGLES[state.currentCaptureIndex] === 'back') ensurePoseLandmarker();
  startLiveGuide();
}

