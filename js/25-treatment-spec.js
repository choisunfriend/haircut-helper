/* ══════════════════════════════════════════════════════════════════════════
   25-treatment-spec.js — 시술 스펙(지시서) · 2026-09-22
   ─────────────────────────────────────────────────────────────────────────
   사용자: "고객한테 길이를 물어볼 때는 '이 정도~ 눈썹 위로?' 이런 식으로 물어보지.
   구체적인 시술법에 대해서는 자기(미용사)가 판단하는 거지. 미용기법에 따른 지시서를
   일단 만들고, '현재 스타일 시술 스펙' 버튼을 하나 만들어서 그걸 누르면 지시서 내용이
   나오게 하면 될 거 같아."

   ── 왜 새 화면인가 ─────────────────────────────────────────────────────
   조정 화면은 <b>만드는 사람</b>의 화면이다(슬라이더 위치·섹션 칩). 미용사가 가위를 들고
   보는 화면이 아니다 — 거기엔 번역이 한 번 더 든다. 이 파일은 <b>지금 걸린 상태</b>를
   미용사의 말로 한 장에 적는다.
   ⚠ 06의 RECIPE_STYLES 표와 헷갈리지 말 것. 그건 <b>프리셋 스펙</b>의 값을 보여 주는
     참고표이고(손으로 프리셋을 따라 만들 때), 이건 <b>지금 이 손님에게 걸린 결과</b>다.
     대신 말은 같게 한다 — TECHNIQUES 라벨·guardMm을 그대로 쓴다(두 화면이 같은 것을
     다른 이름으로 부르면 현장에서 헷갈린다).

   ── 길이를 어떻게 적나 ─────────────────────────────────────────────────
   손님과 말하는 방식대로 <b>얼굴 기준</b>이 먼저, cm는 괄호. "앞머리 — 눈썹 위 1cm".
   끝 높이는 16의 measureSectionTipY(섹션 가닥 끝의 중앙값, 스타일링까지 거친 뒤 —
   미용사가 보는 마지막 그림 기준), 길이는 measureSectionLenCm(같은 자 modelCmPerUnit).
   <b>새로 재는 식은 없다</b> — 스펙 역산이 쓰는 그 함수들이다(두 벌이 되면 갈라진다).
   얼굴 기준점은 정면 랜드마크를 12a의 projector.toMeshY로 모델 높이로 옮긴다
   (앞머리 로그 "끝 y=0.150 = 눈높이"가 같은 좌표임을 보여 준다). 어깨는 목 밑동
   (getNeckBottomY — 11이 옷깃·몸통에 쓰는 단일 출처).

   ── 기법은 지시가 아니라 <b>참고</b> ──────────────────────────────────
   섹션마다 technique(원랭스·그라데이션·레이어)과 시술각이 이미 있다. 그 값을 그대로
   적되 "참고"라고 붙인다 — 시술법은 미용사가 판단한다는 사용자 말 그대로.

   ── 앱이 모르는 것 ─────────────────────────────────────────────────────
   가마·모류·모질 반응·실제 숱은 시뮬레이션이 완벽하지 않다. 지시서 끝에 그걸 적는다
   (모르는 걸 아는 척하지 않는다 — 이 저장소의 원칙).
   ══════════════════════════════════════════════════════════════════════════ */
const TREAT_SPEC = {
  on: true,
  /* 끝이 기준점에서 이 안(cm)이면 "선"이라고만 적는다(예: "턱선"). 0.7은 초안 —
     손님과 말할 때 1cm 안쪽은 보통 "딱 거기"라고 한다. */
  nearCm: 0.7,
  /* 좌우 끝 높이 차가 이만큼(cm) 넘으면 좌/우를 따로 적는다(비대칭 커트). 초안. */
  asymCm: 1.0,
};

/* 얼굴 기준점 사다리 — 모델 높이(y, 위가 +)로. 못 만들면 null. */
function treatFaceLadder(){
  try{
    const fm = getFaceMetrics();
    const lm = fm && fm.lm, P = fm && fm.projector;
    if(!lm || !P || typeof P.toMeshY !== 'function') return null;
    const Y = (v)=> (typeof v === 'number' && isFinite(v)) ? P.toMeshY(v) : null;
    const L = [];
    const add = (name, y, est)=>{ if(y != null && isFinite(y)) L.push({ name, y, est: !!est }); };
    add('헤어라인', Y(lm.foreheadY));
    add('눈썹', Y(lm.browTopY));
    add('눈', Y(lm.eyeY));
    const mo = lm.features && lm.features.mouth;
    if(mo) add('입', Y((mo.minY + mo.maxY) / 2));
    add('턱', Y(lm.chinY));
    let neck = null;
    try{ neck = (typeof getNeckBottomY === 'function') ? getNeckBottomY() : null; }catch(e){}
    if(neck != null && isFinite(neck)){
      add('어깨', neck);
      /* 가슴은 랜드마크가 아니다 — 어깨(목 밑동)에서 12cm 아래로 <b>추정</b>한다.
         긴 머리 끝을 "어깨 아래 20cm"보다 "가슴"으로 말하는 게 손님 말에 가까워서 둔다. */
      const cmu = modelCmPerUnit();
      if(cmu > 0) add('가슴', neck - 12 / cmu, true);
    }
    L.sort((a,b)=> b.y - a.y);
    return L.length ? L : null;
  }catch(e){ return null; }
}

/* 끝 높이 y → "눈썹 위 1cm" 같은 말. 가장 가까운 기준점을 쓴다. */
function treatTipWords(y, ladder, cmu){
  if(y == null || !isFinite(y) || !ladder || !ladder.length || !(cmu > 0)) return null;
  let best = null, bd = Infinity;
  /* 가운데 끼면(동점) <b>아래쪽</b> 기준점 — 손님과는 "눈썹 위"라고 하지 "헤어라인 아래"라고
     잘 안 한다(하네스에서 눈썹과 헤어라인 사이 한가운데 끝이 "헤어라인 아래 1cm"로 나왔다). */
  for(const L of ladder){
    const d = Math.abs(y - L.y);
    if(d < bd - 1e-9 || (Math.abs(d - bd) <= 1e-9 && best && L.y < best.y)){ bd = d; best = L; }
  }
  const dc = (y - best.y) * cmu;                      // + = 기준점보다 위
  const nm = best.name + (best.est ? '(추정)' : '');
  if(Math.abs(dc) < TREAT_SPEC.nearCm) return nm + '선';
  return nm + (dc > 0 ? ' 위 ' : ' 아래 ') + Math.abs(dc).toFixed(1) + 'cm';
}

/* 지시서 자료. 3D 모델이 아직 없으면 null. */
function buildTreatmentSpec(){
  const m = state.hair3Dneutral;
  if(!m || !m.strands) return null;
  const cmu = modelCmPerUnit();
  const ladder = treatFaceLadder();
  const rows = [];
  for(const id of SECTION_ORDER){
    const sec = state.sections[id]; if(!sec) continue;
    const def = SECTIONS[id] && SECTIONS[id].defaults;
    const base = (def && typeof def.length === 'number') ? def.length : 50;   // 슬라이더 기본 = 손님 지금 길이(배율 1)
    const lenVal = (typeof sec.length === 'number') ? sec.length : base;
    const nowCm = measureSectionLenCm(id, base), goalCm = measureSectionLenCm(id, lenVal);
    const tipY = measureSectionTipY(id, lenVal);
    const r = {
      id, label: (SECTIONS[id] && SECTIONS[id].label) || id,
      nowCm, goalCm, cutCm: (nowCm != null && goalCm != null) ? nowCm - goalCm : null,
      tip: treatTipWords(tipY, ladder, cmu),
      tech: (sec.technique && TECHNIQUES[sec.technique]) ? TECHNIQUES[sec.technique].label : null,
      elev: (typeof sec.elevation === 'number') ? sec.elevation : null,
      curl: (typeof sec.curl === 'number') ? sec.curl : null,
      color: sec.color || null,
      lr: null,
    };
    // 좌우 따로 — 옆 섹션만(앞·뒤는 한가운데라 좌우가 없다)
    if(id === 'temple' || id === 'side'){
      const yl = measureSectionTipY(id, lenVal, 'left'), yr = measureSectionTipY(id, lenVal, 'right');
      if(yl != null && yr != null && cmu > 0 && Math.abs(yl - yr) * cmu >= TREAT_SPEC.asymCm)
        r.lr = { left: treatTipWords(yl, ladder, cmu), right: treatTipWords(yr, ladder, cmu) };
    }
    rows.push(r);
  }
  // 스타일링 — 기본값에서 벗어난 것만, 양끝 말로
  const sty = state.styling || {};
  const styling = [];
  for(const p of GYEOL_STYLING_PARAMS){
    const v = sty[p.key];
    if(typeof v !== 'number' || v === p.neutral) continue;
    const toward = v > p.neutral ? p.right : p.left;
    const span = v > p.neutral ? (p.max - p.neutral) : (p.neutral - p.min);
    const pct = span > 0 ? Math.round(Math.abs(v - p.neutral) / span * 100) : 0;
    if(pct < 5) continue;                                 // 거의 기본이면 안 적는다
    styling.push({ label: p.label, toward, pct });
  }
  const fade = (state.fade && state.fade.enabled) ? {
    guard: state.fade.guard, mm: (typeof guardMm === 'function') ? guardMm(state.fade.guard) : null,
    height: state.fade.height, taper: state.fade.taper, disc: state.fade.disc,
  } : null;
  const braid = (typeof BRAID !== 'undefined' && BRAID.on) ? {
    partCm: BRAID.partCm, widthCm: BRAID.widthCm, strands: BRAID.strands,
  } : null;
  return { rows, styling, fade, braid,
           globalCurl: (typeof state._globalCurl === 'number') ? state._globalCurl : null,
           styleName: (state.specAppliedId && typeof getStyleSpec === 'function' && getStyleSpec(state.specAppliedId))
                        ? getStyleSpec(state.specAppliedId).name : null,
           ladderOk: !!ladder };
}

/* 한 장짜리 HTML. 폰에서 보는 걸 먼저 생각했다 — 표 대신 섹션마다 한 덩어리. */
function treatmentSpecHTML(S){
  const esc = (t)=> String(t).replace(/[&<>]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  const cm = (v)=> (v == null ? '—' : v.toFixed(1) + 'cm');
  let h = '';
  h += '<div class="ts-title">시술 스펙' + (S.styleName ? ' <span class="ts-sub">' + esc(S.styleName) + '</span>' : '') + '</div>';
  if(!S.ladderOk) h += '<div class="ts-warn">정면 얼굴을 못 찾아 얼굴 기준 길이를 못 적습니다 — cm만 적습니다.</div>';
  h += '<div class="ts-sec-h">커트 · 섹션별</div>';
  for(const r of S.rows){
    h += '<div class="ts-row"><div class="ts-name">' + esc(r.label) + '</div><div class="ts-body">';
    if(r.goalCm == null) h += '<div>길이 — 잴 가닥 없음(클리퍼 구역이거나 이 섹션에 머리가 없음)</div>';
    else {
      h += '<div class="ts-main">' + (r.tip ? '<b>' + esc(r.tip) + '</b>' : '') + ' <span class="ts-dim">(' + cm(r.goalCm) + ')</span></div>';
      if(r.lr) h += '<div>좌 ' + esc(r.lr.left) + ' · 우 ' + esc(r.lr.right) + ' <span class="ts-dim">(좌우 다름)</span></div>';
      if(r.cutCm != null){
        h += '<div class="ts-dim">지금 ' + cm(r.nowCm) + ' → '
          + (r.cutCm > 0.3 ? '<b>' + r.cutCm.toFixed(1) + 'cm 자름</b>'
             : r.cutCm < -0.3 ? '<b class="ts-warn-in">' + (-r.cutCm).toFixed(1) + 'cm 더 김 — 지금보다 길게는 안 됩니다(익스텐션 별도)</b>'
             : '거의 그대로') + '</div>';
      }
    }
    const ref = [];
    if(r.tech) ref.push(r.tech);
    if(r.elev != null) ref.push('시술각 ' + r.elev + '°');
    if(ref.length) h += '<div class="ts-dim">참고 · ' + esc(ref.join(' · ')) + '</div>';
    if(r.color) h += '<div class="ts-dim">컬러 <span class="ts-chip" style="background:' + esc(r.color) + '"></span>' + esc(r.color) + '</div>';
    h += '</div></div>';
  }
  if(S.fade){
    h += '<div class="ts-sec-h">페이드</div><div class="ts-row"><div class="ts-body">'
      + '가드 ' + S.fade.guard + (S.fade.mm != null ? ' (' + S.fade.mm.toFixed(1) + 'mm)' : '')
      + ' · 높이 ' + S.fade.height + '%' + (S.fade.taper > 0 ? ' · 테이퍼 ' + S.fade.taper + '%' : '')
      + (S.fade.disc > 0 ? ' · 디스커넥션 ' + S.fade.disc + '%' : '') + '</div></div>';
  }
  if(S.globalCurl != null && S.globalCurl > 0){
    h += '<div class="ts-sec-h">펌</div><div class="ts-row"><div class="ts-body">컬 세기 ' + S.globalCurl
      + ' <span class="ts-dim">(0 = 스트레이트 · 섹션별 배율은 위 각 섹션)</span></div></div>';
  }
  if(S.braid){
    h += '<div class="ts-sec-h">땋기</div><div class="ts-row"><div class="ts-body">'
      + (S.braid.strands === 2 ? '두 갈래 꼬기' : S.braid.strands + '갈래 땋기')
      + ' · 파팅 칸 ' + S.braid.partCm + 'cm · 가닥 굵기 ' + S.braid.widthCm + 'cm'
      + '<div class="ts-dim">길이는 손님 머리 그대로 — 더 긴 땋기는 익스텐션(별도 시술)</div></div></div>';
  }
  if(S.styling.length){
    h += '<div class="ts-sec-h">마무리(스타일링)</div><div class="ts-row"><div class="ts-body">'
      + S.styling.map(s => esc(s.label) + ' — ' + esc(s.toward) + ' ' + s.pct + '%').join('<br>') + '</div></div>';
  }
  h += '<div class="ts-sec-h">앱이 모르는 것 — 현장에서 확인</div>'
    + '<div class="ts-row"><div class="ts-body ts-dim">가마·모류 · 모질에 따른 펌/컬러 반응 · 실제 숱과 두께 · '
    + '손님이 평소 말리는 방법. 화면은 사진 4장으로 만든 시뮬레이션입니다.</div></div>';
  return h;
}

function openTreatmentSpec(){
  let S = null;
  try{ S = buildTreatmentSpec(); }catch(e){ console.warn('[시술 스펙] 만들기 실패', e); }
  let ov = document.getElementById('treatSpecOverlay');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'treatSpecOverlay';
    ov.className = 'ts-overlay';
    ov.onclick = (e)=>{ if(e.target === ov) closeTreatmentSpec(); };
    document.body.appendChild(ov);
  }
  ov.innerHTML = '<div class="ts-sheet"><button class="ts-close" onclick="closeTreatmentSpec()" aria-label="닫기">✕</button>'
    + (S ? treatmentSpecHTML(S) : '<div class="ts-title">시술 스펙</div><div class="ts-warn">3D 모델이 아직 준비되지 않았습니다 — 조정 화면이 다 그려진 뒤에 다시 눌러 주세요.</div>')
    + '</div>';
  ov.style.display = 'flex';
}
function closeTreatmentSpec(){
  const ov = document.getElementById('treatSpecOverlay');
  if(ov) ov.style.display = 'none';
}

/* 버튼 — 조정 화면 모드바(마네킹 초기화 옆)와 3D 결과보기 왼쪽 위.
   index.html을 안 건드리고 여기서 단다: 두 화면의 마크업은 이미 여러 번 고쳐진 자리라,
   버튼 하나 때문에 그 파일을 또 여는 것보다 이 파일 하나로 끄고 켤 수 있는 편이 낫다.
   끄기: TREAT_SPEC.on=false 후 새로고침. */
function installTreatmentSpecButtons(){
  if(!TREAT_SPEC.on) return;
  if(!document.getElementById('treatSpecStyle')){
    const st = document.createElement('style');
    st.id = 'treatSpecStyle';
    st.textContent = `
.ts-btn{background:var(--accent,#C98B4F);color:#1B1816;border:none;border-radius:8px;
  padding:6px 10px;font-size:12px;font-weight:700;cursor:pointer;}
.ts-btn-3d{position:absolute;left:10px;bottom:52px;z-index:40;}
.ts-overlay{position:fixed;inset:0;z-index:9000;display:none;align-items:flex-start;justify-content:center;
  background:rgba(10,8,6,0.72);overflow-y:auto;padding:max(16px, env(safe-area-inset-top,0px)) 10px 24px;}
.ts-sheet{position:relative;width:100%;max-width:520px;background:#FBF8F4;color:#1E1A16;border-radius:14px;
  padding:18px 16px 14px;font-size:14px;line-height:1.55;box-shadow:0 10px 40px rgba(0,0,0,0.35);}
.ts-close{position:absolute;right:10px;top:8px;border:none;background:none;font-size:18px;cursor:pointer;color:#5A5048;}
.ts-title{font-size:18px;font-weight:800;margin-bottom:8px;}
.ts-sub{font-size:12px;font-weight:500;color:#7A6F66;margin-left:6px;}
.ts-sec-h{margin-top:14px;font-size:12px;font-weight:700;color:#8C5A2B;letter-spacing:.5px;
  border-bottom:1px solid #E7DDD2;padding-bottom:3px;}
.ts-row{display:flex;gap:10px;padding:7px 0;border-bottom:1px dashed #EDE4DA;}
.ts-name{flex:none;width:64px;font-weight:700;}
.ts-body{flex:1;min-width:0;}
.ts-main{font-size:15px;}
.ts-dim{color:#7A6F66;font-size:12.5px;}
.ts-warn{background:#FFF1E0;color:#8C4A0B;border-radius:8px;padding:6px 8px;font-size:12.5px;margin:6px 0;}
.ts-warn-in{color:#B0470B;}
.ts-chip{display:inline-block;width:12px;height:12px;border-radius:3px;vertical-align:-1px;margin:0 4px;border:1px solid #0002;}
`;
    document.head.appendChild(st);
  }
  const bar = document.querySelector('#screen-adjust .mode-bar');
  if(bar && !document.getElementById('treatSpecBtnAdjust')){
    const b = document.createElement('button');
    b.id = 'treatSpecBtnAdjust'; b.className = 'ts-btn'; b.textContent = '시술 스펙';
    b.onclick = openTreatmentSpec;
    bar.appendChild(b);
  }
  const vp = document.getElementById('model3dViewport');
  if(vp && !document.getElementById('treatSpecBtn3D')){
    const b = document.createElement('button');
    b.id = 'treatSpecBtn3D'; b.className = 'ts-btn ts-btn-3d'; b.textContent = '시술 스펙';
    b.onclick = openTreatmentSpec;
    vp.appendChild(b);
  }
  // EN 모드 — I18N 표가 있으면 버튼 이름만 더한다(지시서 본문은 한국어 현장용)
  try{ if(typeof I18N === 'object' && I18N && !I18N['시술 스펙']) I18N['시술 스펙'] = 'Treatment spec'; }catch(e){}
}
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installTreatmentSpecButtons);
else installTreatmentSpecButtons();
