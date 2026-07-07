/* ════════════════════════════════════════
   NAVIGATION
════════════════════════════════════════ */
const STAGE_NAMES={capture:'1/4 · 촬영',style:'2/4 · 스타일',adjust:'3/4 · 조정',compare:'4/4 · 비교'};

async function navTo(name){
  // unlock tabs as user progresses
  const unlock = (id)=>{ const t=document.getElementById('nav-'+id); if(t) t.disabled=false; };

  if(name==='style'){
    unlock('style');
    if(!aiAnalysis){
      // segmenter가 아직 로딩 중이면 잠깐 대기 (최대 6초)
      if(!segmenterReady && !segmenterError){
        showAI('모델 로딩 중…', 'Hair Segmentation 준비 중');
        let waited = 0;
        while(!segmenterReady && !segmenterError && waited < 6000){
          await new Promise(r=>setTimeout(r,300)); waited+=300;
        }
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
          if(faceLandmarkerReady){
            showAI(`얼굴 분석 중… ${done+1}/${validAngles.length}`, `${ANGLE_LABELS[a]} 랜드마크 감지`);
            await detectFaceLandmarks(a);
          }
          await extractHairMask(a);
          if(faceLandmarkerReady){
            refineSectionBoundaries(a);
          }
          done++;
        }
        hideAI();
        // 모든 뷰 랜드마크 추출 완료 → 매핑 테이블 생성
        buildViewMapping();
      }
      await analyzeWithClaude();
    }
  }
  if(name==='capture'){ stopVoice(); }

  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById('screen-'+name).classList.add('active');
  document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));
  const tab = document.getElementById('nav-'+name);
  if(tab) tab.classList.add('active');
  document.getElementById('stageLabel').innerHTML='단계 <b>'+STAGE_NAMES[name]+'</b>';
  currentScreen = name; // 먼저 업데이트

  // currentScreen 업데이트 후 렌더 (블랭크 수정)
  if(name==='adjust'){
    unlock('adjust'); renderAngleSwitch('angleSwitch');
    const maskBtn = document.getElementById('maskDebugToggle');
    if(maskBtn){
      maskBtn.classList.toggle('on', state.debugShowMask);
      maskBtn.textContent = state.debugShowMask ? '가닥 보기' : '마스크 보기';
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
    const angle = state.currentViewAngle;
    const el = document.getElementById('segStatus');
    if(el){
      if(state.hairMasks[angle] && state.hairMasks[angle].scalpY){
        const validCols = Array.from(state.hairMasks[angle].scalpY).filter(y=>y>=0).length;
        const lm = state.landmarks && state.landmarks[angle];
        const yawStr = lm ? ` | yaw:${lm.yaw.toFixed(2)}` : '';
        el.textContent = `✓ 머리카락 인식됨 (${validCols}px 폭) | ${state._diagLog||''}${yawStr}`;
      } else if(state.hairCanvases[angle]){
        el.textContent = `△ 색상 기반 추출 | ${state._diagLog||''}`;
      } else {
        el.textContent = `가이드 오버레이 모드 | 세그멘터:${state.segmenterType||'로딩중'}`;
      }
    }
    buildSectionTabs();
    // globalCurl 슬라이더 동기화
    const gcSlider = document.getElementById('slider-globalCurl');
    const gcVal = document.getElementById('val-globalCurl');
    if(gcSlider) gcSlider.value = state._globalCurl;
    if(gcVal) gcVal.textContent = state._globalCurl;
    setTimeout(()=>drawAdjustPreview(),80);
  }
  if(name==='compare'){ unlock('compare'); renderAngleSwitch('angleSwitchCompare'); setTimeout(()=>drawCompare(),80); }
}

