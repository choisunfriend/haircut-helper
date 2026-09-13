/* ══════════════════════════════════════════════════════════════════════════
   20-outfit-match.js — 의상 추천, 전부 <b>로컬</b>에서 (2026-09-13)
   ─────────────────────────────────────────────────────────────────────────
   사용자: "난 인터넷을 꺼도 돌아가는 앱을 만들고 싶은거거덩."

   그래서 recommendOutfitWithAI(외부 호출 → 401 → 항상 OUTFIT_CATALOG[0])를
   대체한다. 판단은 여기서 하고, 제휴 카탈로그는 <b>데이터만</b> 받아온다 —
   "이 옷이 유행인가"는 판단이 아니라 필드(trendScore)다. 오프라인이면 캐시된
   카탈로그로 그대로 돈다.

   구조는 19-stage-backdrop.js의 stageChoosePalette를 그대로 따랐다:
   실측 → 규칙 → 실패 시 폴백 + 근거 로그. 그쪽이 이미 배경색으로 증명한 틀이다.

   재는 것은 넷이다(전부 이미 측정돼 있거나 손님이 고른 값이다):
     tipAt     끝높이 중앙 — (정수리y − 머리끝y) / 두상높이. 07b-render-compare.js가
               state._adjStamp에 찍는다. <b>단위가 없어</b> 사람 크기에 안 휩쓸린다
               (cm로 재면 키 큰 손님이 전부 길게 나온다 — 그래서 lenCm을 안 쓴다).
     elevation 크라운 시술각 0~90°. SECTIONS 주석대로 "볼륨"이 따로 있던 게 아니라
               전부 이것의 결과다. 0=원랭스(무게 아래) · 90=완전 레이어(볼륨 위).
     curl      크라운 컬 진폭 0~100.
     염색색     sec.color(dominantDyeCss). 없으면 FORCED_HAIR_COLOR로 떨어진다 —
               둘 중 <b>화면에 실제로 칠해지는 쪽</b>을 본다(outfitColorFit 배너).

   끄기: OUTFIT_MATCH.on = false → 예전처럼 OUTFIT_CATALOG[0]으로 폴백.
   ══════════════════════════════════════════════════════════════════════════ */

const OUTFIT_MATCH = {
  on: true,
  /* 축별 가중치. 합이 1일 필요는 없지만(거리를 그대로 뺀다) 합이 1이면
     점수가 0~1에 떨어져 읽기 쉽다.
     ── color 0.12 → 0.20 (2026-09-13) ────────────────────────────────────
     0.12에서는 <b>염색을 바꿔도 옷이 안 바뀌었다</b>. 색 항이 최대 0.12밖에
     못 움직이는데 실루엣 1등과 2등의 차이가 대개 그보다 컸기 때문이다.
     실제로 재 본 것(머리 18설정 × 염색 6색 · 실루엣은 tipAt·시술각·컬 100조합):

       w.color   실루엣 분포(슈트/캐주얼/롱슬리브/버건디)   염색이 옷을 바꾼 설정
        0.12            24 / 21 / 28 / 27                      2 / 18
        0.20            17 / 23 / 31 / 29                      9 / 18
        0.28            14 / 34 / 32 / 20                     13 / 18
        0.45             3 / 37 / 42 / 18                     18 / 18

     0.20이 접점이다. 더 올리면 염색이 잘 먹는 대신 <b>차콜 슈트가 사라진다</b>
     (0.45에서 100조합 중 3번) — 검정에 가까운 옷이라 어떤 머리색과도 명도가
     안 벌어져 색 점수에서 늘 진다. 네 벌을 다 쓰는 것이 우선이라 여기서 멈춘다.
     ⚠ 이 표는 지금 카탈로그 <b>4벌 기준</b>이다. 제휴 DB로 갈아끼우면 다시 재야
       한다 — 밝은 옷이 늘면 슈트가 죽는 구간도 같이 움직인다. */
  w: { neckline: 0.40, shoulder: 0.26, busy: 0.22, color: 0.20 },
  /* tipAt을 0~1로 펴는 구간. ⚠ 이 두 숫자는 <b>실측이 아니라 시작점</b>이다.
     손님 몇 명의 [의상] 로그에 찍히는 tipAt을 보고, 머리끝이 실제로 어깨에
     닿는 지점이 0.5 근처로 오게 맞춰야 한다. 맞추기 전까진 임시 받침대다.
     참고: 이 녹화의 손님은 tipAt 1.733(가슴께 긴 생머리)이었다. */
  tipAt0: 1.00,        // 이하 = 두상 안쪽(픽시·크롭)
  tipAt1: 1.90,        // 이상 = 가슴 아래
  /* 추천 개수와, 이미 고른 것과 닮았을 때의 감점.
     dupPenalty=0이면 상위 n개가 <b>비슷한 것만</b> 나온다 — 색만 다른 변형이
     카탈로그에 섞여 있으면 특히 그렇다(같은 obj를 쓰므로 실루엣 축이 동일하다). */
  topN: 3,
  dupPenalty: 0.35,
  minScore: 0.45,      // 이 밑이면 "맞는 게 없음" — tight로 표시한다
  log: true,
};

/* ── 헤어 실측 → 이 손님에게 맞는 옷의 목표 축값 ─────────────────────────────
   반환값은 전부 0~1. 폴백은 전부 <b>중립(0.5 언저리)</b>이다 — 측정이 실패했을
   때 극단값을 주면 엉뚱한 옷이 확신에 차서 올라온다. */
function hairSilhouetteTarget(){
  const clamp01 = v => Math.max(0, Math.min(1, v));
  const num = (v, d) => (typeof v === 'number' && isFinite(v)) ? v : d;

  let tipAt = 1.30, elev = 45, curl = 30;   // 중립 폴백
  let measured = { tipAt:false, sec:false };
  try{
    /* 3D화면 도장이 우선, 없으면 2D투영 — 둘 다 같은 배열을 잰다(07b 주석). */
    const S = state._adjStamp || {};
    const st = S['3D화면'] || S['미니3D'] || S['2D투영'];
    if(st && typeof st.tipAt === 'number' && isFinite(st.tipAt)){
      tipAt = st.tipAt; measured.tipAt = true;
    }
  }catch(e){}
  try{
    const c = state.sections && state.sections.crown;
    if(c){
      elev = num(c.elevation, elev);
      curl = num(c.curl, curl);
      measured.sec = true;
    }
  }catch(e){}

  const span = Math.max(1e-6, OUTFIT_MATCH.tipAt1 - OUTFIT_MATCH.tipAt0);
  const lenN = clamp01((tipAt - OUTFIT_MATCH.tipAt0) / span);

  return {
    /* 길이 → 목선. 긴 머리가 어깨를 덮으면 카라도 프린트도 머리에 가린다.
       목선이 열려 있어야 얼굴 주변에 세로 공간이 생겨 머리와 옷이 안 싸운다.
       짧으면 반대 — 목·어깨가 드러나 카라가 살고, 깊게 파이면 휑하다. */
    neckline: lenN,
    /* 볼륨 → 어깨. 엘리베이션이 높으면 볼륨이 머리 위쪽에 몰린다. 거기에 각진
       어깨까지 얹으면 상체가 통째로 삼각형이 된다 → 드롭숄더(shoulder 낮음).
       원랭스처럼 무게가 아래 있으면 구조적 어깨가 위쪽 균형을 잡아준다. */
    shoulder: clamp01(1 - elev / 90),
    /* 컬 → 디테일. 컬이 이미 곡선과 리듬을 만들고 있어 프린트가 겹치면
       시끄럽다 → 무지(busy 낮은 옷을 원한다는 뜻이므로 목표값도 낮다).
       스트레이트는 여백이 많아 패턴을 받아준다. */
    busy: clamp01(1 - curl / 100),
    _raw: { tipAt, elev, curl, measured },
  };
}

/* ── 색 궁합 — 19-stage-backdrop.js와 <b>같은 자</b>(OKLCh)를 쓴다 ───────────
   여기서 색을 아예 빼면 같은 obj를 쓰는 색 변형들이 실루엣 점수가 전부 같아서
   순서가 카탈로그 배열 순서로 정해진다(=늘 같은 옷). 색이 그 동점을 가른다.
   가중치가 낮은 건 의도다 — 배경(무대)이 이미 색을 맞춰 주므로 여기서 세게
   걸면 두 장치가 같은 일을 두 번 한다. 끄려면 OUTFIT_MATCH.w.color = 0. */
/* ── 화면에 실제로 보이는 머리색 (2026-09-13) ──────────────────────────────
   여기 있던 순서는 FORCED_HAIR_COLOR가 <b>맨 앞</b>이었다. 그건 상수(#141414)라
   색 축이 통째로 상수가 되고, 그러면 "머리색을 참고해서 옷을 고른다"가 말만
   남는다 — 손님이 염색을 바꿔도 점수가 한 톨도 안 움직인다.

   ⚠ 그렇다고 아무 색이나 앞에 두면 안 된다. 12b가 예전에 적어 둔 함정이 그것이다:
     "화면은 검정인데 실측 갈색 기준으로 의상을 골라 색 조합이 어긋난다."
     골라야 하는 건 <b>화면에 실제로 칠해지는 색</b>이다.
   그래서 경로를 따라가 확인한 순서다:
     ① sec.color (염색) — FORCED_HAIR_COLOR와 <b>다른 경로</b>로 칠해진다.
        FORCED_HAIR_COLOR는 drawHairStrands(중립 캡처·원본 결 보기·폴백)에서
        opts.color를 덮는 것이고, 염색은 그 뒤 _adjApplyFilter →
        sampleProjectedStrandColors가 LUT로 올린다(09의 HAIR_DYE 배너). 즉
        염색이 걸려 있으면 3D 결과에 보이는 건 검정이 아니라 <b>그 색</b>이다.
        단 HAIR_DYE.on이 꺼져 있으면 LUT를 안 타므로 그때는 안 본다.
     ② FORCED_HAIR_COLOR — 염색이 없으면 화면은 이 값이다.
     ③ 스타일 색 · ④ 실측 평균색 — 위 둘이 다 없을 때(원복했을 때) 경로.

   ⚠ 어느 섹션의 염색인가: 섹션마다 다른 색을 넣을 수 있다. 옷과 싸우는 건
     면적이 넓은 쪽이므로 <b>가장 많은 섹션이 쓰는 색</b>을 고르고, 동수면
     SECTION_ORDER 앞쪽(크라운·프론트)이 이긴다. 한 색만 쓰면 그냥 그 색이다. */
function dominantDyeCss(){
  try{
    if(typeof HAIR_DYE !== 'undefined' && HAIR_DYE && HAIR_DYE.on === false) return null;
    const order = (typeof SECTION_ORDER !== 'undefined') ? SECTION_ORDER : Object.keys(state.sections || {});
    const count = new Map();
    for(const id of order){
      const c = state.sections && state.sections[id] && state.sections[id].color;
      if(!c) continue;
      if(!count.has(c)) count.set(c, { n:0, first:order.indexOf(id) });
      count.get(c).n++;
    }
    if(!count.size) return null;
    let best = null, bestN = -1, bestFirst = Infinity;
    for(const [css, v] of count){
      if(v.n > bestN || (v.n === bestN && v.first < bestFirst)){
        best = css; bestN = v.n; bestFirst = v.first;
      }
    }
    return best;
  }catch(e){ return null; }
}

function outfitColorFit(item){
  try{
    if(!item || !item.colorHex) return 0.5;
    if(typeof gyToOklch !== 'function') return 0.5;
    let hairCss = null;
    try{
      hairCss = dominantDyeCss()
        || (typeof FORCED_HAIR_COLOR !== 'undefined' && FORCED_HAIR_COLOR)
        || (state.selectedStyle && state.selectedStyle.colorHex)
        || (state.hairMasks && state.hairMasks.front && state.hairMasks.front.avgColor);
    }catch(e){}
    if(!hairCss) return 0.5;
    const H = gyToOklch(hairCss), O = gyToOklch(item.colorHex);
    if(!H || !O) return 0.5;

    /* ① 명도 간격 — 머리가 옷에 묻지 않을 만큼은 벌어져야 하고, 너무 벌어지면
       옷이 시선을 가져간다. 0.22~0.55가 좋은 구간. */
    const dL = Math.abs(H.L - O.L);
    const lScore = dL < 0.22 ? dL / 0.22
                 : dL > 0.55 ? Math.max(0, 1 - (dL - 0.55) / 0.35)
                 : 1;

    /* ② 선명한 염색이면 옷은 비켜선다 — stageChoosePalette가 배경에 거는 것과
       같은 논리. 헤어 채도가 낮으면(자연모) 이 항은 중립이다. */
    let hScore = 1;
    if(H.C > 0.06 && O.C > 0.02){
      const d = Math.abs(((O.h - H.h + 540) % 360) - 180);   // 0~180
      hScore = d < 25 ? d / 25 : 1;                          // 너무 가까우면 감점
    }
    return Math.max(0, Math.min(1, 0.55 * lScore + 0.45 * hScore));
  }catch(e){ return 0.5; }
}

/* ── 한 벌의 점수 ─────────────────────────────────────────────────────────
   축이 없는 카탈로그 항목(제휴 DB가 아직 태그를 안 준 것)은 <b>중립 0.5</b>로
   센다. 0으로 두면 태그 없는 옷이 전부 꼴찌가 되어 영영 안 나온다. */
function outfitScore(item, t){
  const W = OUTFIT_MATCH.w;
  const ax = ['neckline','shoulder','busy'];
  let d = 0, wsum = 0;
  for(const k of ax){
    const v = (typeof item[k] === 'number' && isFinite(item[k])) ? item[k] : 0.5;
    d += W[k] * Math.abs(v - t[k]);
    wsum += W[k];
  }
  const sil = wsum > 0 ? 1 - d / wsum : 0.5;
  const col = outfitColorFit(item);
  const wc = W.color || 0;
  return (sil * (1 - wc)) + (col * wc);
}

/* 핏 필터 — 성별이 아니라 <b>어느 옷걸이에서 꺼낼까</b>다. 그래서 사진에서
   추론하지 않는다(미용실에서 성별을 틀리게 찍는 건 기능 오류가 아니라 사고다).
   state.outfitFit에 UI 칩이 넣어 준 값을 쓰고, 없으면 거르지 않는다. */
function outfitFitAllows(item){
  let want = null;
  try{ want = state.outfitFit || null; }catch(e){}
  if(!want || want === 'any') return true;
  const f = item.fit || 'unisex';
  return f === want || f === 'unisex';
}

/* ── 상위 N벌 ─────────────────────────────────────────────────────────────
   그냥 상위 3개를 뽑으면 <b>비슷한 게 셋</b> 나온다(점수가 가까운 것끼리 닮았다).
   이미 고른 것과 축이 겹치면 깎는다. */
function pickTopOutfits(t, n){
  n = n || OUTFIT_MATCH.topN;
  const pool = OUTFIT_CATALOG.filter(outfitFitAllows);
  if(!pool.length) return { list: [OUTFIT_CATALOG[0]], tight: true };

  const scored = pool.map(o => ({ o, s: outfitScore(o, t) }))
                     .sort((a, b) => b.s - a.s);
  /* ⚠ 감점은 <b>순서를 정하는 데만</b> 쓰고 합격선에는 안 쓴다. 둘 다에 쓰면
     2등부터 감점 먹은 점수가 minScore에 걸려 전부 탈락하고 <b>한 벌만</b>
     나온다 — 색만 다른 변형이 카탈로그에 있으면 반드시 그렇게 된다.
     합격선은 그 옷이 이 손님에게 맞는가(s)고, 감점은 이미 고른 것과 겹치나다.
     서로 다른 질문이라 자를 섞으면 안 된다. */
  const out = [], used = new Set();
  const dupOf = (cand) => {
    let dup = 0;
    for(const p of out){
      const same = 1 - (Math.abs((p.neckline ?? 0.5) - (cand.neckline ?? 0.5))
                      + Math.abs((p.shoulder ?? 0.5) - (cand.shoulder ?? 0.5))
                      + Math.abs((p.busy     ?? 0.5) - (cand.busy     ?? 0.5))) / 3;
      if(same > dup) dup = same;
    }
    return dup;
  };
  while(out.length < n){
    let best = null, bestAdj = -Infinity;
    for(let i = 0; i < scored.length; i++){
      if(used.has(i)) continue;
      if(scored[i].s < OUTFIT_MATCH.minScore) continue;   // 합격선은 s로만
      const adj = scored[i].s - OUTFIT_MATCH.dupPenalty * dupOf(scored[i].o);
      if(adj > bestAdj){ bestAdj = adj; best = i; }
    }
    if(best === null) break;
    used.add(best); out.push(scored[best].o);
  }
  /* 전부 기준 미달이면 최고점 하나라도 내보낸다 — stageChoosePalette의
     tight("기준 미달 — 가능한 최선")와 같은 처리다. 빈손보다 낫다. */
  if(!out.length) return { list: [scored[0].o], tight: true, scored };
  return { list: out, tight: false, scored };
}

/* ── 바깥이 부르는 자리 ────────────────────────────────────────────────────
   12b-head-measure.js의 recommendOutfitWithAI를 이걸로 갈아끼운다(아래 README).
   반환 모양은 그대로 { item, reason } — 호출부를 안 고쳐도 된다.
   reason은 비워 둔다(사용자: "문장같은건 필요없어"). 필요해지면 여기서
   이긴 축 이름으로 조립하면 된다 — 외부 호출 없이. */
function recommendOutfitLocal(){
  if(!OUTFIT_MATCH.on) return { item: OUTFIT_CATALOG[0], reason: '', alts: [] };
  try{
    const t = hairSilhouetteTarget();
    const r = pickTopOutfits(t);
    if(OUTFIT_MATCH.log){
      const R = t._raw;
      const dye = dominantDyeCss();
      const hairCss = dye || (typeof FORCED_HAIR_COLOR !== 'undefined' && FORCED_HAIR_COLOR) || '?';
      console.log('[의상] tipAt ' + R.tipAt.toFixed(3) + (R.measured.tipAt ? '' : '(폴백)')
        + ' · 엘리베이션 ' + R.elev + '°' + (R.measured.sec ? '' : '(폴백)')
        + ' · 컬 ' + R.curl
        + ' · 머리색 ' + hairCss + (dye ? '(염색)' : '(기본)')
        + ' → 목표 목선 ' + t.neckline.toFixed(2)
        + ' / 어깨 ' + t.shoulder.toFixed(2)
        + ' / 무지 ' + t.busy.toFixed(2)
        + '\n      → ' + r.list.map(o => o.name + ' ' + outfitScore(o, t).toFixed(2)).join(' · ')
        + (r.tight ? '   ⚠ 기준 미달 — 가능한 최선' : '')
        + '\n      임계값이 의심되면 OUTFIT_MATCH.tipAt0/tipAt1 · .w 를 바꾸고 다시 부르십시오.');
    }
    return { item: r.list[0], reason: '', alts: r.list.slice(1) };
  }catch(e){
    console.warn('[의상] 로컬 추천 실패(기본 항목으로 대체):', e);
    return { item: OUTFIT_CATALOG[0], reason: '', alts: [] };
  }
}

/* 하네스·콘솔에서 부를 수 있게 노출 — 클로저 밖이라 그냥 전역이지만,
   12a의 __sideDepthWeight와 같은 이유로 이름을 박아 둔다. */
if(typeof globalThis !== 'undefined'){
  globalThis.__hairSilhouetteTarget = hairSilhouetteTarget;
  globalThis.__outfitScore = outfitScore;
}
