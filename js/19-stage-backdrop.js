/* ══════════════════════════════════════════════════════════════════════
   STAGE BACKDROP — 헤어·의상에 맞춰 무대 색을 고른다 (2026-09-04 2차)
   ─────────────────────────────────────────────────────────────────────
   사용자: "그라디언트를 옷과 헤어에 맞춰서 변화되게 할 수 있어?"

   ⚠ 하지 않는 것부터: <b>옷 색을 배경에 그대로 깔지 않는다.</b> 네이비 슈트
     뒤에 네이비를 깔면 9/4 1차에서 고친 문제(어두운 의상이 어두운 배경에
     먹혀 실루엣이 사라짐)로 그대로 돌아간다. 색을 맞추는 게 아니라
     <b>떼어놓는</b> 것이 이 파일이 하는 일이다. 살롱 촬영에서 배경지를
     고르는 기준과 같다 — 어울리는 색이 아니라 피사체가 떨어지는 색.

   규칙 두 개뿐이다.
   ① 밝기는 <b>반대편</b>으로. 피사체(헤어 위주)가 어두우면 밝은 무대,
      밝으면(백금발·탈색·회색) 어두운 무대. 최소 간격 STAGE.minGap을 항상
      보장한다 — 이게 "어떤 손님이 와도 윤곽은 보인다"의 근거다.
   ② 색상은 <b>비켜서</b>, 채도는 거의 0으로. 의상 색상에서 출발하되
      염색이 선명하면(C가 크면) 그 색상에서 STAGE.hueClear만큼 밀어낸다.
      무대가 채도를 가지면 헤어 컬러와 경쟁한다 — 손님이 보러 온 건 머리다.

   ⚠ 축은 OKLCH다. HSL로 만들면 안 된다 — 9/2·9/3 배너에 적은 그대로,
     HSL의 L은 밝기가 아니라 (max+min)/2라 노랑과 파랑이 같은 L에서 밝기가
     두 배 차이 난다. "밝기를 반대편으로"라는 이 파일의 규칙 ①이 그 축에선
     성립하지 않는다. gyToOklch/gyFromOklch(09-strand-dye.js)를 그대로 쓴다 —
     변환식을 여기 또 적지 않는다(작업원칙 3).

   되돌리기: STAGE.on = false → styles.css의 기본 팔레트(웜 아이보리 고정)로
   돌아간다. 이 파일을 통째로 빼도 무대는 그 기본값으로 그냥 뜬다.
   ══════════════════════════════════════════════════════════════════════ */

const STAGE = {
  on: true,
  /* 무대와 <b>헤어 단독</b>, 무대와 <b>의상 단독</b>이 각각 지켜야 할 최소
     밝기 차(OKLab L). ⚠ 섞은 평균 하나로 재면 안 된다 — 금발(L 0.73)+차콜
     슈트(L 0.29)의 평균은 0.59라 "어두운 피사체"로 분류되어 무대가 0.93까지
     밝아지는데, 정작 <b>머리와 무대 간격은 0.20</b>이라 금발이 흰 배경에
     녹는다. 평균이 가리는 건 언제나 양 끝이다. 그래서 둘을 따로 잰다.
     헤어 쪽이 더 빡빡한 건 이 앱이 파는 게 머리이기 때문이다. 의상은
     덩어리가 커서 조금 덜 떨어져도 형태가 읽힌다. */
  hairGap: 0.26,
  outfitGap: 0.16,
  /* 후보 L을 훑는 간격. 촘촘할 필요 없다 — 0.01이면 눈에 안 보이는 차이다. */
  step: 0.01,
  /* 밝은 무대 / 어두운 무대의 L 범위. 밝은 쪽 상한을 0.93에 두는 건 순백이
     다크 UI(--bg:#1B1816)에서 눈이 부시기 때문(1차 배너와 같은 이유). */
  lightBand: [0.78, 0.93],
  /* 어두운 무대의 아래 끝을 0.22로 잡았다. 더 내리면 9/4 1차에서 걷어낸
     검정 배경과 눈으로 구별이 안 된다 — 백금발을 위해 어둡게 가는 것이지
     원래 화면으로 돌아가려는 게 아니다. */
  darkBand:  [0.22, 0.36],
  /* 무대 채도 상한. 이 값을 올리면 배경이 헤어 컬러와 경쟁하기 시작한다. */
  maxChroma: 0.038,
  /* 염색이 "선명하다"고 볼 채도, 그리고 그때 색상을 비켜설 각도. */
  vividC: 0.055,
  hueClear: 45,
  /* 색상을 못 읽었을 때의 기본 색상(웜 베이지 — 기존 팔레트의 색상). */
  fallbackHue: 68,
};

/* 지금 화면에 걸린 헤어 색. 염색이 걸려 있으면 그게 답이고, 없으면 사진에서
   실측한 평균색이다(measureHairColorsFromMask). 둘 다 없으면 어두운 갈색. */
function stageHairColor(){
  const dyed = (typeof gyDyeAllColor === 'function') ? gyDyeAllColor() : null;
  if(dyed) return dyed;
  const m = state.hairMasks && state.hairMasks.front;
  return (m && m.avgHairColor) || '#2A1B12';
}

/* (헤어색, 의상색) → 무대 팔레트. 순수 함수다 — DOM을 안 만진다.
   그래서 콘솔에서 stageChoosePalette('#111','#2A262A') 처럼 바로 시험할 수 있다. */
function stageChoosePalette(hairCss, outfitCss){
  const hair   = gyToOklch(hairCss)   || { L:0.25, C:0.03, h:STAGE.fallbackHue };
  const outfit = outfitCss ? gyToOklch(outfitCss) : null;

  // ── ① 밝기: 기준을 <b>충족</b>하는 것 중 피사체에 가장 가까운 L ─────────
  /* ⚠ 분리를 <b>최대화</b>하면 안 된다(첫 시도가 그랬다). 점수가 가장 높은
     L은 언제나 밴드 끝이라, 어떤 손님이 와도 무대가 0.93 아니면 0.17에
     붙는다 — 밝기 변화가 사라지고, 어두운 쪽은 #081114라 사실상 9/4 1차의
     검정 배경으로 되돌아간다. 고치려던 것으로 돌아가는 셈이다.
     그래서 기준을 넘는 것 중 <b>가장 덜 극단적인</b> 것을 고른다. 필요한
     만큼만 떨어뜨리면 밝기가 손님마다 달라지고(=요청한 변화), 무대는
     밝은 톤(뽀샤시)에 머문다. */
  const hairL = hair.L, outL = outfit ? outfit.L : null;
  const ok = L => Math.abs(L - hairL) >= STAGE.hairGap &&
                  (outL === null || Math.abs(L - outL) >= STAGE.outfitGap);
  const scoreAt = L => {
    const sh = Math.abs(L - hairL) / STAGE.hairGap;
    return outL === null ? sh : Math.min(sh, Math.abs(L - outL) / STAGE.outfitGap);
  };
  const pickIn = band => {
    let hit = null, alt = null, altS = -Infinity;
    for(let L = band[0]; L <= band[1] + 1e-9; L += STAGE.step){
      if(ok(L)){                       // 충족하는 것 중 피사체에 가장 가까운 쪽
        if(hit === null || Math.abs(L - hairL) < Math.abs(hit - hairL)) hit = L;
      }
      const s = scoreAt(L);            // 아무것도 충족 못 할 때의 차선
      if(s > altS){ altS = s; alt = L; }
    }
    return { hit, alt, altS };
  };
  /* 밝은 무대를 먼저 본다 — 요청이 "뽀샤시"였다. 밝은 쪽이 기준을 못 넘길
     때만(=백금발·탈색처럼 피사체가 이미 밝을 때) 어두운 무대로 넘어간다.
     뒤집는 조건을 상수로 따로 두지 않는 이유다. 조건을 적어두면 경계 근처
     손님마다 그 숫자를 손으로 고치게 된다. */
  const light = pickIn(STAGE.lightBand), dark = pickIn(STAGE.darkBand);
  let bgL, tight = false;
  if(light.hit !== null)      bgL = light.hit;
  else if(dark.hit !== null)  bgL = dark.hit;
  else { tight = true; bgL = light.altS >= dark.altS ? light.alt : dark.alt; }
  const goDark = bgL < 0.5;

  // ── ② 색상: 의상에서 출발, 선명한 염색이면 비켜선다 ──────────────────
  let hue = outfit && outfit.C > 0.012 ? outfit.h : STAGE.fallbackHue;
  if(hair.C > STAGE.vividC){
    let d = ((hue - hair.h + 540) % 360) - 180;   // -180..180
    if(Math.abs(d) < STAGE.hueClear){
      hue = (hair.h + (d >= 0 ? STAGE.hueClear : -STAGE.hueClear) + 360) % 360;
    }
  }
  const C = Math.min(STAGE.maxChroma, (outfit ? outfit.C : 0.03) * 0.32 + 0.012);

  // 중심에서 모서리로 갈수록 어두워지고(밝은 무대) 채도가 아주 조금 오른다.
  const dir = goDark ? 1 : -1;                    // 어두운 무대는 모서리가 밝다
  const hex = (L, c) => gyFromOklch(Math.max(0.04, Math.min(0.97, L)), c, hue).hex;

  return {
    goDark, hue, bgL, tight,
    hairGap: Math.abs(bgL - hairL),
    outfitGap: outL === null ? null : Math.abs(bgL - outL),
    s1: hex(bgL + dir * -0.045, C * 0.55),
    s2: hex(bgL,                C * 0.85),
    s3: hex(bgL + dir *  0.085, C * 1.0),
    s4: hex(bgL + dir *  0.165, C * 1.1),
    /* 발밑 그림자·비네트는 무대색을 <b>더 눌러서</b> 만든다. 검정을 얹으면
       무대 색상이 회색으로 죽는다. */
    shadow: hex(Math.max(0.10, bgL - 0.30), C * 1.2),
    ink:    hex(Math.max(0.08, bgL - 0.38), C * 1.2),
    glow:   hex(goDark ? bgL + 0.30 : 0.985, C * 0.3),
  };
}

/* 팔레트를 뷰포트에 바른다. outfitItem은 OUTFIT_CATALOG 항목(없으면 null). */
function applyStageBackdrop(outfitItem){
  const el = document.getElementById('model3dViewport');
  if(!el) return null;
  if(!STAGE.on){                       // 끄면 styles.css 기본 팔레트로 되돌린다
    ['--stage-1','--stage-2','--stage-3','--stage-4','--stage-glow',
     '--stage-glow-a','--stage-shadow','--stage-ink','--stage-bloom-a']
      .forEach(k=>el.style.removeProperty(k));
    el.classList.remove('stage-dark');
    return null;
  }

  const hairCss = stageHairColor();
  const p = stageChoosePalette(hairCss, outfitItem && outfitItem.colorHex);

  el.style.setProperty('--stage-1', p.s1);
  el.style.setProperty('--stage-2', p.s2);
  el.style.setProperty('--stage-3', p.s3);
  el.style.setProperty('--stage-4', p.s4);
  el.style.setProperty('--stage-glow', p.glow);
  el.style.setProperty('--stage-glow-a', p.goDark ? '0.42' : '0.92');
  el.style.setProperty('--stage-shadow', p.shadow);
  el.style.setProperty('--stage-ink', p.ink);
  /* 어두운 무대에선 뽀샤시를 줄인다. 어두운 배경 위의 블룸은 번지는 게 아니라
     전체를 뿌옇게 들어올려서 대비를 <b>깎는다</b> — 방향이 반대다. */
  el.style.setProperty('--stage-bloom-a', p.goDark ? '0.20' : '0.34');
  /* 오버레이 칩 대비를 뒤집는 스위치(styles.css의 :not(.stage-dark)). */
  el.classList.toggle('stage-dark', p.goDark);

  /* 간격을 <b>따로</b> 찍는다. "배경이 애매하다"는 보고가 오면 헤어 쪽인지
     의상 쪽인지부터 갈린다 — 합쳐서 찍으면 9/4에 평균이 가렸던 것과 같은
     실수를 로그에서 되풀이하게 된다. tight면 밴드로 못 덮은 손님이다. */
  console.log(`[무대] 헤어 ${hairCss} + 의상 ${outfitItem ? outfitItem.colorHex : '없음'}`
    + ` → ${p.goDark ? '어두운' : '밝은'} 무대 ${p.s2} (L=${p.bgL.toFixed(2)} h=${Math.round(p.hue)})`
    + ` · 간격 헤어 ${p.hairGap.toFixed(2)}/${STAGE.hairGap}`
    + (p.outfitGap === null ? '' : ` 의상 ${p.outfitGap.toFixed(2)}/${STAGE.outfitGap}`)
    + (p.tight ? '  ⚠ 기준 미달 — 가능한 최선' : ''));
  return p;
}
