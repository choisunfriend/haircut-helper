/* 17a-mannequin.js — 읽을 수 있는 판(2026-10-22)
   배포된 난독화본(10/17)을 펼친 것: 동작은 그대로. 9/23 원본에 같은 이름으로 있던 함수는 그 변수 이름과 주석을 옮겨 왔고,
   9/23 뒤에 생긴 부분(COMB3D · CROWN_FILL · EYE_GUARD · FACE_CLEAR · RISE_FIX · TIP_FLARE 등)은 이름이 v1·v2…로 남아 있고 주석이 없음. */
/* ══════════════════════════════════════════════════════════
   17a-mannequin.js — 마네킹 헤어 · 마네킹 앞머리 · 얼굴 프로필 · 시술모드
   원본 index.html 26569~27618행. 클래식 스크립트이므로 로드 순서가 곧
   실행 순서다 — index.html의 <script src> 순서를 바꾸지 말 것.
   ══════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════════
   마네킹 헤어 — 촬영 가닥을 쓰지 않고 <b>새로 심는다</b> (2026-08-08)
   ─────────────────────────────────────────────────────────────────
   촬영 가닥 모델은 가닥 하나하나의 모양·길이·존재 여부가 전부 그 사진의
   세그멘테이션 결과다. 그래서 길이를 늘리면 추적 경로가 향하던 방향으로 뻗고
   (얼굴을 가로지르고), 뷰마다 다른 자리에서 없던 게 튀어나온다.

   마네킹 모델은 사진에서 <b>특성만</b> 가져온다:
     · 뿌리 — 실측 뿌리밀도 격자(rootField.den)에 <b>면적 비례</b>로 심는다.
              밀도 0인 셀(헤어라인 아래·대머리)에는 아예 안 심으므로 헤어라인이
              실측 그대로 나온다. 총 개수는 촬영 모델과 같게 맞춘다.
     · 섹션 — 뿌리의 3D 위치로 resolveSection3D. 뷰와 무관하게 딱 나뉜다.
     · 길이 — 그 섹션 촬영 가닥 호길이의 <b>중앙값</b>(사용자 선택: 고객 실측 길이).
     · 모양 — 두피 법선으로 나와 rootRamp 구간에서 중력으로 넘어가고, 두상에
              닿으면 타원체 표면으로 밀려 미끄러진다(사용자 선택).
     · 색   — 그 섹션 촬영 가닥의 실측 색에서 뽑는다.
   컬은 0이다 — 초기화 상태니까. 펌은 이 위에 얹는다.

   지어낸 상수: rootRamp / clearance / segments 셋뿐이고, 길이·밀도·색·섹션·
   두상 반경은 전부 실측에서 온다.
══════════════════════════════════════════════════════════════════ */
const MANNEQUIN = {
  on: false,
  segments: 22,
  rootRampMax: 0.25,
  clearance: 1.004,
  lenPct: 1,
  minLen: 0.02,
  baldDen: 0.08,
  layerLo: 0.15,
  layerHi: 1,
  spread: 0.7,
  /* (2026-10-22) 길이는 다시 기른 가닥에서 — 뿌리 칸마다 그 칸에서 자란 가닥 길이의 중앙값(없으면 둘레 칸 → 섹션 중앙값).
     예전: 13c가 사진 가닥을 사진마다 겉면에 붙인 모델(_hair3Dneutral.strands)의 섹션·사진별 lenPct(기본 1 = 최댓값) 길이.
       그 모델은 사진 한 장씩 따로 붙여 같은 머리가 장마다 생기고 · 머리 영역 번짐을 따라 길게 그어져서(실사 3장: crown 52cm ↔ 다시 기르기 23cm)
       첫 마네킹이 삐죽했고(lenPct 1 · crownAllAround) · 원본 스펙을 걸며 lenPct 0.9로 한 번 더 지었음.
     다시 기른 모델이 없으면(아직 안 기름·끔) 예전대로. 끄기 MANNEQUIN.lenFromRegrow=false */
  lenFromRegrow: true,
  lenNbr: 2
};
/* ══════════════════════════════════════════════════════════════════
   마네킹 앞머리 — <b>심을 게 없으면 프론트·크라운에서 내린다</b> (2026-09-02 3차)
   ─────────────────────────────────────────────────────────────────
   사용자: "앞머리 심긴 거 <b>거꾸로</b> 된 거부터 고쳐. … 원래 헤어라인 따라서
   심어야 되는 건 심고, <b>심을 게 없으면 프론트와 크라운 섹션에서 일부 앞머리로
   내려줘</b>."

   ── 화면에 보이던 게 <b>앞머리가 아니었다</b> ────────────────────────────
   눈두덩 위에 뜬 두 개의 쐐기는 심긴 앞머리가 아니라 <b>뿌리 없는 꼬리 토막</b>이다.
   이마를 지나는 구간이 잘려 나가고, 옆머리 높이에서 사진 마스크가 1인 자리만
   남아 그 조각이 공중에 떠 있었다. 그래서 방향이 뿌리→끝이 아니라 끝만 보여
   <b>거꾸로</b>로 보이고 본체와 따로 놀았다. 즉 고칠 것은 "뒤집힌 가닥"이 아니라
   <b>애초에 앞머리가 없다</b>는 것이다.

   ── 왜 없었나: 이 손님은 <b>앞머리가 없다</b> ───────────────────────────
   원본 사진이 이마가 드러난 가르마 머리다. 마네킹 뿌리는 실측 밀도 격자
   (rf.den > baldDen)로 심으므로 헤어라인 위에만 심긴다 — <b>여기까지는 맞다</b>
   (헤어라인이 실측 그대로 나오는 근거가 이것이라 안 건드린다). 문제는 그 뿌리에서
   난 가닥이 이마 앞으로 <b>못 내려간다</b>는 것이고, 막는 문턱이 셋이었다:
     ① _adjGeometry 재클립의 growAboveY = CY — 여유를 <b>눈 위까지만</b> 준다
     ② trimStrandToOccupancy3D의 faceVeto — "머리는 늘어나도 얼굴은 못 덮는다"
     ③ buildHairClipMask — 늘림 여유에서 <b>얼굴 타원을 destination-out</b>
   하나만 열면 다른 데서 다시 잘린다. mannequinClipGrowPx 주석이 이미 그 경고를
   적어 뒀다("두 클립이 다른 폭을 열면 3D에서 살아남은 앞머리가 화면에서 다시
   지워져 아무것도 안 바뀐 것처럼 보인다"). 그래서 <b>셋 다</b> 연다 — 단
   fringe 표시가 붙은 가닥에만. 나머지 가닥의 동작은 비트 단위로 그대로다.

   ── "심을 게 없으면"을 <b>재서</b> 정한다 ──────────────────────────────
   손님에게 이미 앞머리가 있으면 이 연산자는 <b>돌면 안 된다</b>(있는 머리 위에
   또 얹으면 숱만 두 배가 된다). 판정은 지어내지 않고 이미 있는 점유 프로브에
   묻는다 — 이마 앞면을 표본으로 훑어 occ ≥ occThr인 비율이 haveFringeFrac을
   넘으면 "이미 있다"로 보고 아무것도 안 심는다. 새 측정기가 아니라 리프트가
   쓰는 그 프로브다(작업원칙 1).

   ── 지어낸 값 셋 (전부 <b>초안</b> — tipAt과 같은 자격) ────────────────
   · tipFaceFrac 0.35 — 끝이 눈→턱의 35% 지점, 곧 <b>광대</b>(사용자 지정).
     자는 makeFaceProjector와 같다(눈 y=CY, 턱 y=CY−0.70·heightFactor).
   · frontFrac 0.60 / crownFrac 0.15 — 내릴 뿌리의 비율. 시스루 뱅이 아니라
     보통 뱅 기준이고, 크라운은 헤어라인에 가까운 앞쪽 띠만 걸린다.
   · bulge 0.35 — 이마에서 앞으로 뜨는 정도. 0이면 이마에 달라붙어 두피에
     칠한 것처럼 보이고, 크게 하면 차양처럼 뜬다.
   되돌리기: MQ_FRINGE.on = false (①②③ 면제가 한꺼번에 닫히고 예전 그림) */
const MQ_FRINGE = {
  on: true,
  tipFaceFrac: 0,
  lineHalfX: 0.95,
  lineGain: 0.75,
  lineFloorFaceFrac: 0.4,
  crownLine: true,
  crownRiseFrac: 0.18,
  crownAllAround: false,   // (2026-10-22) 공통 기본값(STYLE_COMMON_DEFAULTS)과 같게 — 스타일을 걸기 전 첫 마네킹에서 정수리 둘레 앞머리 선이 솟던 것
  crownFloorBrow: true,
  frontFrac: 0.6,
  crownFrac: 0.15,
  crownThFrac: 0.6,
  bulge: 0.35,
  converge: 1,
  haveFringeFrac: 0.3,
  minLen: 0.05
};
/* 이 손님에게 <b>이미 앞머리가 있는가</b>. 점유 프로브에 묻는다(새 자 없음).
   프로브가 없으면 null — 모르면 안 심는다(모르는 것을 지어내지 않는다). */
function mannequinHasFringe(src) {
  const probe = src && src.occ && src.occ.probe || state.hairOcc3D && state.hairOcc3D.probe || null;
  if (!probe || !probe.at) return null;
  let E = null,
    S = null;
  try {
    E = getHeadEllipsoid(), S = getScalpEllipsoid();
  } catch (v1) {
    return null;
  }
  if (!E || !S) return null;
  const CY = src && src.CY != null ? src.CY : SCALP_CENTER_Y,
    yEye = CY,
    yBrow = mqBrowY(CY, E);
  if (yBrow == null) return null;
  let n = 0,
    hit = 0;
  for (let v2 = 0; v2 < 3; v2++) {
    const v3 = yEye + (yBrow - yEye) * (v2 / 2),
      v4 = Math.max(-1, Math.min(1, (v3 - CY) / E.b)),
      v5 = E.c * Math.sqrt(Math.max(0, 1 - v4 * v4));
    for (let v6 = -2; v6 <= 2; v6++) {
      const v7 = E.a * 0.3 * v6 / 2,
        v8 = probe.at(v7, v3, v5 * 1.02);
      if (!v8) continue;
      n++;
      if (v8.occ >= HAIR_OCC3D.occThr) hit++;
    }
  }
  if (!n) return null;
  return hit / n >= MQ_FRINGE.haveFringeFrac;
}
/* 앞머리 끝이 올 모델 y — 눈(CY)에서 눈→턱의 tipFaceFrac만큼 아래.
   자는 makeFaceProjector와 <b>같은 것</b>을 쓴다(EYE=CY, 눈~턱=0.70·heightFactor).
   얼굴 계측을 못 얻으면 두상 높이 자로 폴백한다. */
function mqFringeTipY(CY) {
  let v9 = null;
  try {
    const v14 = getFaceMetrics();
    if (v14 && v14.heightFactor > 0) v9 = 0.7 * v14.heightFactor;
  } catch (v15) {}
  if (!(v9 > 0)) try {
    const v16 = getHeadEllipsoid();
    if (v16 && v16.b > 0) v9 = 0.7 * (v16.b / 0.633);
  } catch (v17) {}
  if (!(v9 > 0)) return null;
  const v10 = CY - MQ_FRINGE.tipFaceFrac * v9;
  if (!eyeGuardActive() || eyeGuardProfileSetsTip()) return v10;
  const v11 = eyeGuardGeom(),
    v12 = eyeGuardFrontTarget();
  let v13 = null;
  try {
    v13 = eyeGuardSafeHeadRef();
  } catch (v18) {}
  if (v12 != null && v13) return v13.yTop - v12 * v13.H;
  return v11 ? CY - EYE_GUARD.defaultTipFaceFrac * v11.fh : v10;
}
var EYE_GUARD = {
  on: true,
  defaultTipFaceFrac: -0.14,
  fixSolveLength: true,
  boxTopFaceFrac: -0.06,
  boxBotFaceFrac: 0.3,
  boxHalfXFrac: 0.75,
  zBackFrac: 0.22
};
var STYLE_TUNES = {
  layered_bob_hush: {
    tipAt: {
      front: 0.45
    }
  },
  wavy_bob_seethrough: {
    tipAt: {
      front: 0.44
    }
  },
  side_part_perm: {
    tipAt: {
      front: 0.43
    }
  }
};
var STYLE_COMMON_DEFAULTS = {
  on: true,
  MANNEQUIN: {
    lenPct: 0.9
  },
  MQ_FRINGE: {
    crownAllAround: false
  }
};
var FACE_COVER_CHECK = {
  on: true,
  warnFrac: 0.01,
  last: null,
  pendingId: null
};
function eyeGuardSafeHeadRef() {
  if (typeof state === "undefined" || !state) return null;
  const v19 = state.hair3Dmannequin || state._hair3Dneutral;
  let v20 = null;
  try {
    v20 = getHeadEllipsoid();
  } catch (v22) {}
  if (!v19 || !v20 || !(v20.b > 0.000001)) return null;
  const v21 = v19.CY != null ? v19.CY : typeof SCALP_CENTER_Y !== "undefined" ? SCALP_CENTER_Y : 0.15;
  return {
    yTop: v21 + v20.b,
    H: 2 * v20.b
  };
}
function eyeGuardFrontTarget() {
  const v23 = EYE_GUARD._applying || typeof state !== "undefined" && state && state.specAppliedId || null;
  let v24 = null;
  try {
    v24 = v23 ? getStyleSpec(v23) : null;
  } catch (v25) {}
  if (!v24 || v24.eyeGuard === false || !v24.tipAt || typeof v24.tipAt.front !== "number") return null;
  return v24.tipAt.front;
}
function eyeGuardActive() {
  return EYE_GUARD.on && typeof MANNEQUIN !== "undefined" && !!MANNEQUIN.on && eyeGuardFrontTarget() != null;
}
function eyeGuardProfileSetsTip() {
  const v26 = window.STYLE_BASE && window.STYLE_BASE.active;
  return !!(v26 && v26.config && v26.config.MQ_FRINGE && typeof v26.config.MQ_FRINGE.tipFaceFrac === "number");
}
function eyeGuardGeom() {
  if (typeof state === "undefined" || !state) return null;
  const v27 = state._hair3Dneutral || null;
  let v28 = null;
  try {
    v28 = typeof getFaceProfile === "function" ? getFaceProfile() : null;
  } catch (v31) {}
  const v29 = EYE_GUARD._geo;
  if (v29 && v29.h === v27 && v29.prof === v28) return v29.v;
  let v30 = null;
  try {
    const v32 = getHeadEllipsoid();
    if (v32 && v32.a > 0 && v32.b > 0 && v32.c > 0) {
      const v33 = v27 && isFinite(v27.CY) ? v27.CY : typeof SCALP_CENTER_Y !== "undefined" ? SCALP_CENTER_Y : 0.15,
        v34 = typeof _mqFaceH === "function" ? _mqFaceH(v33, v32) : v32.b / 0.633 * 0.7;
      if (v34 > 0) {
        const v35 = v28 && v28.halfX > 0 ? v28.halfX : v32.a * 0.95;
        v30 = {
          E: v32,
          CY: v33,
          fh: v34,
          prof: v28,
          topY: v33 - EYE_GUARD.boxTopFaceFrac * v34,
          botY: v33 - EYE_GUARD.boxBotFaceFrac * v34,
          xHalf: v35 * EYE_GUARD.boxHalfXFrac,
          zBack: EYE_GUARD.zBackFrac * v32.c
        };
      }
    }
  } catch (v36) {
    v30 = null;
  }
  return EYE_GUARD._geo = {
    h: v27,
    prof: v28,
    v: v30
  }, v30;
}
function eyeGuardCoversFace(v37, v38) {
  if (!v37 || v37.length < 2 || !v38) return false;
  for (let v39 = 1; v39 < v37.length; v39++) {
    const v40 = v37[v39];
    if (!(v40.y < v38.topY) || !(v40.y > v38.botY) || !(Math.abs(v40.x) < v38.xHalf)) continue;
    const v41 = v38.prof ? v38.prof.zAt(v40.y) : v38.E.c;
    if (v40.z > v41 - v38.zBack) return true;
  }
  return false;
}
function eyeGuardApplyCommonDefaults(v42) {
  const v43 = STYLE_COMMON_DEFAULTS;
  if (!v43.on) return;
  const v44 = window.STYLE_BASE,
    v45 = v44 && v44.active && v44.active.config || {},
    v46 = {
      MANNEQUIN: typeof MANNEQUIN !== "undefined" ? MANNEQUIN : null,
      MQ_FRINGE: typeof MQ_FRINGE !== "undefined" ? MQ_FRINGE : null
    };
  let v47 = false;
  const v48 = [];
  for (const v49 in v46) {
    if (!v46[v49] || !v43[v49]) continue;
    for (const v50 in v43[v49]) {
      if (v45[v49] && v50 in v45[v49]) continue;
      if (v46[v49][v50] === v43[v49][v50]) continue;
      v46[v49][v50] = v43[v49][v50], v48.push(v49 + "." + v50 + "=" + v43[v49][v50]);
      if (v49 === "MANNEQUIN") v47 = true;
    }
  }
  if (v47 && typeof state !== "undefined" && state) state.hair3Dmannequin = null;
  if (v48.length) console.log("[앞머리 길이] 공통 기본값 " + v42 + ": " + v48.join(" · ") + " (끄기 STYLE_COMMON_DEFAULTS.on=false)");
}
function faceCoverCheck(v51) {
  if (!FACE_COVER_CHECK.on || !FACE_COVER_CHECK.pendingId || !v51 || !v51.length) return;
  const v52 = FACE_COVER_CHECK.pendingId;
  FACE_COVER_CHECK.pendingId = null;
  try {
    const v53 = eyeGuardGeom();
    if (!v53) return;
    const v54 = {},
      v55 = {};
    for (let v57 = 0; v57 < v51.length; v57++) {
      const v58 = v51[v57],
        v59 = v58.sec || "?";
      v55[v59] = (v55[v59] || 0) + 1;
      if (eyeGuardCoversFace(v58.pts, v53)) v54[v59] = (v54[v59] || 0) + 1;
    }
    const v56 = [];
    for (const v60 in v54) if (v54[v60] / v55[v60] > FACE_COVER_CHECK.warnFrac) v56.push(v60 + " " + v54[v60] + "/" + v55[v60]);
    FACE_COVER_CHECK.last = {
      id: v52,
      by: v54,
      n: v55,
      bad: v56,
      at: Date.now()
    };
    if (v56.length) console.warn("[얼굴 가림] " + v52 + " — 얼굴을 덮는 섹션: " + v56.join(" · ") + "\n    → 자르지 않았습니다. 이 스타일 스펙에서 해당 섹션의 tipAt을 줄이거나(짧게)," + " 가르마(partAmt)·넘김(sweep)·curlDir·overdirection으로 얼굴 밖으로 보내세요.");else console.log("[얼굴 가림] " + v52 + " — 얼굴 가림 없음");
  } catch (v61) {
    console.warn("[얼굴 가림] 검사 실패", v61);
  }
}
var FACE_CLEAR = {
  on: true,
  topFaceFrac: -0.1,
  trimTailCm: 5,
  trimmed: 0,
  botFaceFrac: 1,
  halfXFrac: 0.8,
  zBackFrac: 0.3,
  ramp: 4,
  outK: 0.85,
  sideByRoot: false,
  neck: true,
  stats: {
    strands: 0,
    moved: 0
  }
};
function faceClearGeom() {
  const v62 = eyeGuardGeom();
  if (!v62) return null;
  const v63 = v62.prof && v62.prof.halfX > 0 ? v62.prof.halfX : v62.E.a * 0.95;
  return {
    E: v62.E,
    prof: v62.prof,
    fh: v62.fh,
    CY: v62.CY,
    inFront: faceClearInFront,
    topY: v62.CY - FACE_CLEAR.topFaceFrac * v62.fh,
    botY: v62.CY - FACE_CLEAR.botFaceFrac * v62.fh,
    xHalf: v63 * FACE_CLEAR.halfXFrac,
    zBack: FACE_CLEAR.zBackFrac * v62.E.c
  };
}
function faceClearInFront(v64, v65) {
  if (!(v65.z > 0)) return false;
  const v66 = v64.prof ? v64.prof.zAt(v65.y) : v64.E.c;
  if (v65.z > v66 - v64.zBack) return true;
  const v67 = v65.x / v64.E.a,
    v68 = (v65.y - v64.CY) / v64.E.b,
    v69 = v65.z / v64.E.c;
  return v67 * v67 + v68 * v68 + v69 * v69 > FACE_CLEAR.outK;
}
function faceClearAll(v70) {
  if (!FACE_CLEAR.on || !v70 || !v70.length) return v70;
  let v71 = false;
  try {
    v71 = state.specAppliedId === "__original__" || typeof MANNEQUIN !== "undefined" && !MANNEQUIN.on;
  } catch (v76) {
    v71 = false;
  }
  if (!v71) return v70;
  let v72 = null;
  try {
    v72 = faceClearGeom();
  } catch (v77) {
    v72 = null;
  }
  if (!v72) return v70;
  let v73 = null,
    v74 = 0,
    v75 = v72.botY;
  if (FACE_CLEAR.neck) {
    v75 = v72.botY - 0.6 * v72.fh;
    try {
      const v78 = getNeckBottomY();
      if (isFinite(v78) && v78 < v72.botY) v75 = v78;
    } catch (v79) {}
  }
  for (let v80 = 0; v80 < v70.length; v80++) {
    const v81 = v70[v80],
      v82 = v81 && v81.pts;
    if (!v82 || v82.length < 2) continue;
    let v83 = -1,
      v84 = 0,
      v85 = 0;
    const v86 = [];
    for (let v91 = 1; v91 < v82.length; v91++) {
      const v92 = v82[v91];
      if (!(v92.y < v72.topY) || !(v92.y > v75) || !(Math.abs(v92.x) < v72.xHalf)) continue;
      if (v92.y > v72.botY) {
        if (!faceClearInFront(v72, v92)) continue;
      } else {
        if (!(v92.z > 0)) continue;
      }
      if (v83 < 0) v83 = v91;
      v86.push(v92.x), v84 += v92.x, v85++;
    }
    if (v83 < 0) continue;
    if (FACE_CLEAR.trimTailCm > 0 && v83 >= 2) {
      var _tl = 0;
      for (var _tk = v83; _tk < v82.length; _tk++) {
        var _ta = v82[_tk],
          _tb = v82[_tk - 1];
        _tl += Math.hypot(_ta.x - _tb.x, _ta.y - _tb.y, _ta.z - _tb.z);
      }
      var _tcpu = typeof CURL_BUNDLE !== "undefined" && CURL_BUNDLE.cmPerUnit || 19.33;
      if (_tl * _tcpu < FACE_CLEAR.trimTailCm) {
        if (!v73) v73 = v70.slice();
        v73[v80] = Object.assign({}, v81, {
          pts: v82.slice(0, v83)
        });
        FACE_CLEAR.trimmed++;
        continue;
      }
    }
    const v87 = FACE_CLEAR.sideByRoot ? v82[0].x < 0 ? -1 : 1 : v84 < 0 ? -1 : 1;
    let v88 = 0;
    for (let v93 = 0; v93 < v86.length; v93++) {
      const v94 = v87 > 0 ? v72.xHalf - v86[v93] : v86[v93] + v72.xHalf;
      if (v94 > v88) v88 = v94;
    }
    const v89 = v82.slice(),
      v90 = Math.max(1, v83 - FACE_CLEAR.ramp);
    for (let v95 = v90; v95 < v89.length; v95++) {
      const v96 = v95 >= v83 ? 1 : (v95 - v90 + 1) / (v83 - v90 + 1),
        v97 = v96 * v96 * (3 - 2 * v96),
        v98 = v89[v95];
      v89[v95] = {
        x: v98.x + v87 * v88 * v97,
        y: v98.y,
        z: v98.z
      };
    }
    if (!v73) v73 = v70.slice();
    v73[v80] = Object.assign({}, v81, {
      pts: v89
    }), v74++;
  }
  return FACE_CLEAR.stats.strands = v70.length, FACE_CLEAR.stats.moved = v74, v73 || v70;
}
var RISE_FIX = {
  on: false,
  riseCm: 2.5,
  frontFrac: 0.5,
  shell: 1.02,
  stats: {
    strands: 0,
    fixed: 0
  }
};
function riseFixAll(v99) {
  if (!RISE_FIX.on || !v99 || !v99.length) return v99;
  let v100 = false;
  try {
    v100 = state.specAppliedId === "__original__" || typeof MANNEQUIN !== "undefined" && !MANNEQUIN.on;
  } catch (v109) {
    v100 = false;
  }
  if (!v100) return v99;
  let v101 = null;
  try {
    v101 = faceClearGeom();
  } catch (v110) {
    v101 = null;
  }
  if (!v101 || !v101.E) return v99;
  const v102 = v101.E,
    v103 = v101.CY;
  let v104 = 19.33;
  try {
    if (typeof CURL_BUNDLE !== "undefined" && CURL_BUNDLE.cmPerUnit) v104 = CURL_BUNDLE.cmPerUnit;
  } catch (v111) {}
  const v105 = RISE_FIX.riseCm / v104,
    v106 = RISE_FIX.shell;
  let v107 = null,
    v108 = 0;
  for (let v112 = 0; v112 < v99.length; v112++) {
    const v113 = v99[v112],
      v114 = v113 && v113.pts;
    if (!v114 || v114.length < 3) continue;
    const v115 = v114[0];
    if (v115.z > RISE_FIX.frontFrac * v102.c) continue;
    let v116 = -1;
    for (let v122 = 1; v122 < v114.length; v122++) if (v114[v122].y - v115.y > v105) {
      v116 = v122;
      break;
    }
    if (v116 < 0) continue;
    let v117 = v116;
    while (v117 > 1 && v114[v117 - 1].y > v114[v117 - 2].y) v117--;
    const v118 = v114.slice(0, v117);
    let v119 = v114[v117 - 1].x,
      v120 = v114[v117 - 1].y,
      v121 = v114[v117 - 1].z;
    for (let v123 = v117; v123 < v114.length; v123++) {
      const v124 = v114[v123].x - v114[v123 - 1].x,
        v125 = v114[v123].y - v114[v123 - 1].y,
        v126 = v114[v123].z - v114[v123 - 1].z;
      v119 += v124, v120 += v125 > 0 ? -v125 : v125, v121 += v126;
      const v127 = v119 / v102.a,
        v128 = (v120 - v103) / v102.b,
        v129 = v121 / v102.c,
        v130 = v127 * v127 + v128 * v128 + v129 * v129;
      if (v130 < v106 * v106 && v130 > 1e-9) {
        const v131 = v106 / Math.sqrt(v130);
        v119 *= v131, v121 *= v131, v120 = v103 + (v120 - v103) * v131;
      }
      v118.push(Object.assign({}, v114[v123], {
        x: v119,
        y: v120,
        z: v121
      }));
    }
    if (!v107) v107 = v99.slice();
    v107[v112] = Object.assign({}, v113, {
      pts: v118
    }), v108++;
  }
  return RISE_FIX.stats.strands = v99.length, RISE_FIX.stats.fixed = v108, v107 || v99;
}
/* 눈썹 높이 — 이 파일의 <b>유일한</b> 눈썹 자. 원래 mannequinHasFringe가 이마
   표본을 뜨려고 안에서 쓰던 식(CY + 0.18·E.b)을 그대로 꺼낸 것이고, 이제
   크라운 앞머리 선도 같은 것을 본다. 자가 두 벌이 되면 "눈썹"이 화면 두 군데서
   다른 높이가 된다 — 그래서 상수까지 MQ_FRINGE로 올렸다. */
function mqBrowY(CY, E) {
  if (!E || !(E.b > 0)) return null;
  return CY + MQ_FRINGE.crownRiseFrac * E.b;
}
/* 크라운 앞머리 끝이 올 모델 y — 중립(길이비율 1)에서 <b>눈썹</b>.
   크라운 선을 끄면 프론트와 같은 tip(눈높이)으로 떨어진다. */
function mqCrownTipY(CY, E) {
  if (!MQ_FRINGE.crownLine) return mqFringeTipY(CY);
  const y = mqBrowY(CY, E);
  return y != null ? y : mqFringeTipY(CY);
}
/* 이 뿌리를 앞머리로 내릴 것인가. 결정적 해시라 다시 심어도 같은 가닥이 걸린다. */
function mqFringePicks(rp, sec, ci, k) {
  if (!MQ_FRINGE.on) return false;
  const th = Math.abs(Math.atan2(rp.x, rp.z));
  let frac = 0;
  if (sec === "front") frac = MQ_FRINGE.frontFrac;else {
    if (sec === "crown" && th <= SECTION_CUT.thFront * MQ_FRINGE.crownThFrac) frac = MQ_FRINGE.crownFrac;
  }
  if (!(frac > 0)) return false;
  return hashFract(ci * 0.6180339887 + k * 0.7548776662 + 3.71) < frac;
}
/* 앞머리 한 가닥 — 뿌리(헤어라인)에서 <b>이마 앞으로 넘겨</b> 광대까지 내린다.
   ── 왜 growMannequinStrand를 안 쓰나 ─────────────────────────────────
   저쪽은 "법선으로 조금 나갔다가 중력, 두상에 닿으면 타원체로 밀어내기"다.
   이마에서 그 규칙을 그대로 돌리면 가닥이 <b>두개골 표면을 타고</b> 내려가
   얼굴 안쪽으로 들어간다(그리고 그 자리는 사진에 머리가 없어 통째로 잘린다).
   실제 뱅은 두피에서 나와 <b>이마를 타지 않고 앞으로 떨어진다</b> — 그래서
   밀어내기를 안 쓰고 뿌리→끝 곡선을 직접 그린다.
   길이는 그 섹션 실측 호길이 L에서 <b>못 넘어간다</b> — 커트는 빼는 일이고,
   없는 길이를 만들지 않는다(MANNEQUIN.lenPct 주석과 같은 규칙). */
function growFringeStrand(rp, d0, tipY, L, colors) {
  const F = MQ_FRINGE,
    N = MANNEQUIN.segments;
  if (!(tipY != null) || !(L > F.minLen)) return null;
  const drop = rp.y - tipY;
  if (!(drop > F.minLen)) return null;
  const end = {
      x: rp.x * F.converge,
      y: tipY,
      z: Math.abs(rp.z) + drop * F.bulge
    },
    span = Math.hypot(end.x - rp.x, end.y - rp.y, end.z - rp.z);
  if (!(span > 0.000001)) return null;
  const nh = Math.hypot(d0.x, d0.z),
    dOut = nh > 0.000001 ? {
      x: d0.x / nh,
      y: 0,
      z: d0.z / nh
    } : {
      x: 0,
      y: 0,
      z: 1
    },
    build = v132 => {
      const out = [{
        x: rp.x,
        y: rp.y,
        z: rp.z
      }];
      for (let v133 = 1; v133 <= N; v133++) {
        const v134 = v133 / N * v132,
          v135 = v134 * v134 * (3 - 2 * v134),
          v136 = Math.min(1, v134 * 3),
          v137 = rp.x + (end.x - rp.x) * v135,
          v138 = rp.y + (end.y - rp.y) * v135,
          v139 = rp.z + (end.z - rp.z) * v135,
          v140 = span * 0.1 * (1 - v135) * v136;
        // 뿌리 쪽만 앞으로 살짝 들림
        out.push({
          x: v137 + dOut.x * v140,
          y: v138,
          z: v139 + dOut.z * v140
        });
      }
      return out;
    };
  // 실측 길이가 모자라면 덜 내려온다
  /* 앞으로 부푼 몫이 호길이에 얹히므로 span만으로는 <b>실측 길이를 넘을 수 있다</b>
       (하네스: 0.306 vs 0.297). 한 번 재서 그만큼 당긴다 — 커트는 빼는 일이고,
       없는 길이를 만들지 않는다(MANNEQUIN.lenPct 주석과 같은 규칙). */
  let reach = Math.min(1, L / span),
    pts = build(reach);
  const arc0 = arcLength3D(pts);
  if (arc0 > L && arc0 > 1e-9) pts = build(reach * (L / arc0));
  const color = colors && colors.length ? colors[_mqRand() * colors.length | 0] : "#2B2320";
  return {
    pts: pts,
    sec: null,
    color: color,
    srcAngle: null,
    rootFacing: 0,
    mannequin: true,
    fringe: true
  };
}
/* ══════════════════════════════════════════════════════════════════
   얼굴 프로필 — <b>측면 사진의 얼굴선</b> (2026-09-03)
   ─────────────────────────────────────────────────────────────────
   사용자: \"코앞을 지나는 라인이 하나 설정되어 있는데 그게 잘못설정된 거 같아.
   2D측면사진의 얼굴라인(두상타원이 아닌)을 확인해서 그 라인으로 새로 지정해야 돼.\"
   맞다. mqTrimAtFringeLine의 \"얼굴 앞인가\" 판정은 두 인자 <b>둘 다 두상 타원</b>이었다:
     · Math.abs(c.x) > halfX — halfX = E.a × 0.95, 곧 <b>헐</b>(머리카락 겉면)의
       반너비다. 파일 실측이 그대로 말한다: 헐 a=0.704 vs <b>얼굴 실측 0.503</b>
       (한쪽당 2.8cm). 0.95를 곱해도 얼굴보다 33% 넓다.
     · c.z > 0 — 기준면이 <b>두상 중심</b>이라 앞쪽 반구면 전부 \"얼굴 앞\"이다.
       실제 얼굴 표면은 z=0이 아니다([얼굴 입체감] 코끝 0.639 · 이마 0.285,
       두상 깊이 c=0.541). 즉 선이 얼굴보다 <b>넓고 얕게</b> 서 있었다.
   그래서 관자놀이 옆 커튼과 반대쪽 사이드가 같이 잘리는데 정작 코앞은 못 지킨다.

   ── 자를 어디서 가져오나: <b>이미 있는 것만</b> ───────────────────────────
   측면 사진에서는 앞뒤 깊이가 이미지의 좌우 위치로 <b>직접</b> 나타난다. 이
   원리와 그 구현(projectImagePointToHead)은 이 파일이 헤어 뿌리에 이미 쓰고
   있다. 새로 만드는 것은 없고, 정중선(midsagittal) 랜드마크를 그 함수에 통과
   시켜 \"높이 → 얼굴 앞면 z\" 곡선 하나로 모을 뿐이다.
   ⚠ 깊이맵(computeFullProfileDepthMap)은 <b>안 쓴다</b>(사용자 지시 — 필요한지
     확인하고 쓴다). 그건 async·정면 사진 의존이라 이 경로가 그 실패 모드를
     떠안게 된다. 여기서 필요한 건 468정점이 아니라 <b>선 하나</b>다.

   ── 정직한 한계 ──────────────────────────────────────────────────────
   측면이 덜 돌아간 사진에서는 projectImagePointToHead가 사실상 <b>두상 타원면</b>을
   돌려준다(PROFILE_YAW_GATE 배너가 재어 둔 그것 — 이 손님 right는 yaw 40.9°다).
   그래도 지금보다 낫다: 그때도 선이 z=0(중심면)이 아니라 <b>표면</b>에 서기
   때문이다. 코 돌출까지 살아나는 건 각도가 충분할 때다. 그러니 이 곡선은
   \"실측이면 실측, 아니면 타원면\"이고 어느 쪽인지 진단에 찍는다 — 좋아 보이는데
   실은 타원면이더라, 를 나중에 못 가리면 안 된다.
   되돌리기: FACE_PROFILE.on = false (c.z > 0 · halfX = E.a×lineHalfX 그대로) */
const FACE_PROFILE = {
  on: true,
  midline: [10, 151, 9, 8, 168, 6, 197, 195, 5, 4, 1, 19, 94, 2, 164, 0, 13, 14, 17, 18, 200, 199, 175, 152],
  bands: 12,
  src: null,
  n: 0
};
let _faceProfileCache = null;
/* 이 손님의 얼굴 프로필. 반환 {zAt(meshY), halfX, src} — zAt은 그 높이에서
   얼굴 <b>앞면</b>의 두상 로컬 z. 못 만들면 null(호출부가 예전 동작).
   ⚠ 캐시 키를 state.landmarks <b>객체</b>로 잡으면 안 된다 — 그 객체는 한 번
     만들어지고 detectFaceLandmarks가 [angle]에 <b>제자리로</b> 채워 넣으므로
     참조가 영영 안 바뀐다. 재촬영해도 옛 프로필을 계속 쓰게 된다. 뷰별 lm
     객체는 매번 새로 만들어지므로 그 셋을 본다. */
function getFaceProfile() {
  if (!FACE_PROFILE.on) return null;
  const L = state.landmarks || {},
    key = [L.left, L.right, L.front];
  if (_faceProfileCache && _faceProfileCache._key.every((v141, v142) => v141 === key[v142])) return _faceProfileCache.v;
  let v = null;
  try {
    v = buildFaceProfile();
  } catch (v143) {
    v = null;
  }
  return _faceProfileCache = {
    _key: key,
    v: v
  }, v;
}
function buildFaceProfile() {
  /** (9/23 원본 주석 — 코드가 바뀌어 제자리를 못 찾음)
     · 밴드 사이는 선형 보간 — 프로필은 연속이고, 계단으로 두면 그 높이에서
       가닥이 갑자기 걸리거나 빠진다(무게선이 톱니가 되는 것과 같은 이유).
  */
  /* 빈 밴드는 <b>지어내지 않고</b> 가장 가까운 실측을 잇는다 — 이 파일의
       fillBandsWithNearestNeighbor와 같은 원칙(원칙 (1)). 하나도 없으면 타원면. */
  let fm;
  try {
    fm = getFaceMetrics();
  } catch (v144) {
    return null;
  }
  if (!fm) return null;
  let E;
  try {
    E = getHeadEllipsoid();
  } catch (v145) {
    return null;
  }
  if (!E || !(E.b > 0) || !(E.c > 0)) return null;
  const CY = 0.15;
  let faceHalfX = 0;
  try {
    const v146 = fm.lm,
      v147 = fm.projector;
    v146 && v147 && v146.lEarX != null && v146.rEarX != null && (faceHalfX = Math.abs(v147.toMeshX(Math.max(v146.lEarX, v146.rEarX))));
  } catch (v148) {}
  if (!(faceHalfX > 0)) faceHalfX = E.a * MQ_FRINGE.lineHalfX;
  const yTop = CY + E.b,
    yBot = CY - E.b,
    span = Math.max(0.000001, yTop - yBot),
    NB = Math.max(4, FACE_PROFILE.bands | 0),
    zMax = new Array(NB).fill(-Infinity);
  let nHit = 0;
  for (const v149 of ["left", "right"]) {
    const v150 = state.landmarks && state.landmarks[v149];
    if (!v150 || !v150.rawLandmarks || v150.rawLandmarks.length < 468) continue;
    let v151 = 0;
    try {
      v151 = getViewPoseConfidence(v149);
    } catch (v152) {}
    // 어림 각도로는 선을 안 긋는다
    if (v151 < 0.5) continue;
    for (const v153 of FACE_PROFILE.midline) {
      const v154 = v150.rawLandmarks[v153];
      if (!v154) continue;
      let v155 = null;
      try {
        v155 = projectImagePointToHead(v149, v154.x, v154.y, fm.widthFactor, fm.heightFactor);
      } catch (v157) {}
      if (!v155 || !isFinite(v155.z) || !isFinite(v155.y)) continue;
      /* 좌·우가 같은 높이를 보면 <b>더 앞</b>을 쓴다 — 얼굴 앞면을 찾는 것이고,
               한쪽 사진이 덜 돌아가 얕게 나왔다고 코를 뒤로 당기면 안 된다. */
      const v156 = Math.min(NB - 1, Math.max(0, Math.floor((yTop - v155.y) / span * NB)));
      if (v155.z > zMax[v156]) zMax[v156] = v155.z;
      nHit++;
    }
  }
  const measured = zMax.some(v158 => v158 > -Infinity),
    zs = new Array(NB),
    ellZAt = my => {
      const yl = (my - CY) / E.b;
      return E.c * Math.sqrt(Math.max(0, 1 - Math.min(1, yl * yl)));
    };
  for (let v159 = 0; v159 < NB; v159++) {
    if (zMax[v159] > -Infinity) {
      zs[v159] = zMax[v159];
      continue;
    }
    if (!measured) {
      zs[v159] = ellZAt(yTop - (v159 + 0.5) / NB * span);
      continue;
    }
    let v160 = v159,
      v161 = v159;
    while (v160 >= 0 && zMax[v160] === -Infinity) v160--;
    while (v161 < NB && zMax[v161] === -Infinity) v161++;
    zs[v159] = v160 >= 0 && v161 < NB ? (zMax[v160] + zMax[v161]) / 2 : v160 >= 0 ? zMax[v160] : zMax[v161];
  }
  return FACE_PROFILE.src = measured ? "side" : "ellipsoid", FACE_PROFILE.n = nHit, {
    src: FACE_PROFILE.src,
    halfX: faceHalfX,
    zAt(v162) {
      const v163 = (yTop - v162) / span * NB - 0.5;
      if (v163 <= 0) return zs[0];
      if (v163 >= NB - 1) return zs[NB - 1];
      const v164 = Math.floor(v163),
        v165 = v163 - v164;
      return zs[v164] * (1 - v165) + zs[v164 + 1] * v165;
    }
  };
}
/* 앞머리 라인 — 얼굴 앞으로 내려온 가닥을 <b>그 높이에서 일자로</b> 자른다.
   ── 왜 가닥을 고르지 않고 선으로 자르나 ─────────────────────────────
   앞머리는 "어느 가닥이냐"가 아니라 <b>어느 높이냐</b>로 정해진다. 뽑힌 가닥만
   짧게 하면 안 뽑힌 이웃이 그 사이로 흘러내려 화면에서는 그냥 <b>긴 머리 몇
   가닥</b>으로 보인다. 가위는 선을 긋고, 그 선을 넘은 것은 무엇이든 잘린다.
   ⚠ 길이를 <b>만들지 않는다</b>. 자르기만 한다(MANNEQUIN.lenPct 주석과 같은 규칙).
   ⚠ 옆·뒤로 흐르는 머리는 안 건드린다 — z>0(앞쪽)이면서 두상 너비 안일 때만.
   되돌리기: MQ_FRINGE.lineHalfX = 0 */
function mqTrimAtFringeLine(pts, tipY, E, allAround) {
  if (!(tipY != null) || !pts || pts.length < 2) return pts;
  const prof = getFaceProfile(),
    halfX = prof && prof.halfX > 0 ? prof.halfX : E && E.a > 0 && MQ_FRINGE.lineHalfX > 0 ? E.a * MQ_FRINGE.lineHalfX : 0;
  if (!(halfX > 0) && !allAround) return pts;
  for (let v166 = 1; v166 < pts.length; v166++) {
    const v167 = pts[v166 - 1],
      v168 = pts[v166];
    // 이 마디에서 선을 넘는다
    /* (2026-09-05) allAround면 <b>방향을 안 본다</b> — 크라운 배너 참고.
           기본(프론트)은 예전 그대로 얼굴 앞을 지나는 가닥만 자른다. */
    if (!(v167.y >= tipY && v168.y < tipY)) continue;
    if (!allAround) {
      // 얼굴 <b>앞면</b>보다 앞인가. 예전엔 두상 중심(0)이라 앞쪽 반구 전체가 걸렸다.
      const v171 = prof ? prof.zAt(v168.y) : 0;
      // 얼굴 앞이 아니면 통과
      if (!(v168.z > v171) || Math.abs(v168.x) > halfX) continue;
    }
    const v169 = (v167.y - tipY) / Math.max(1e-9, v167.y - v168.y),
      v170 = pts.slice(0, v166);
    return v170.push({
      x: v167.x + (v168.x - v167.x) * v169,
      y: tipY,
      z: v167.z + (v168.z - v167.z) * v169
    }), v170.length >= 2 ? v170 : pts;
  }
  // 뿌리 한 점만 남기지는 않는다
  return pts;
}
/* 앞머리 선이 <b>지금</b> 어느 높이인가 — 길이 슬라이더가 정한다 (2026-09-02 5차).
   ── 3차의 잘못 ────────────────────────────────────────────────────
   3차는 이 선을 <b>심을 때 고정 y로</b> 그었다. 그러니 선이 바닥이자 천장이
   돼서, 길이를 아무리 내려도 가닥이 여전히 그 선까지 닿아 앞머리가 눈썹에
   붙박이가 됐다(사용자: "아무리 줄여도 눈썹이 한계"). 앞머리 길이는 고정
   높이가 아니라 <b>커트 결과</b>다 — 그래서 자를 때마다 다시 긋는다.
   ── 자 ───────────────────────────────────────────────────────────
   위 끝은 이마 헤어라인이다. 지어내지 않고 SCALP_ZONES.front의 phiRange 상한을
   그대로 읽는다 — SCALP_LIMIT이 "두피가 여기까지"라고 이미 정한 그 선이다.
   아래 끝은 비율 1(중립)에서 mqFringeTipY, 곧 <b>눈높이</b>다.
     선 = 헤어라인 − (헤어라인 − 눈높이) × 길이비율
   비율 0.05면 헤어라인 바로 아래(거의 안 남김), 1이면 눈, 1.8이면 광대 근처.
   단조이고, 슬라이더 전 구간이 살아 있고, 얼굴을 <b>덮는 데까지는 못 간다</b>.
   ── 누구의 비율인가: <b>프론트가 주인, 크라운이 거든다</b> ─────────────
   앞머리는 프론트 섹션의 물건이라 선은 하나여야 한다(가닥마다 자기 섹션 비율을
   쓰면 크라운 앞머리와 프론트 앞머리가 다른 높이에서 잘려 일자가 깨진다).
   다만 사용자: "크라운이 프론트와 같이 움직이니 올라가졌네. 그런데 크라운이
   <b>덜 움직일 정도면</b> 길이변화배율을 조금 조정해야 될 거 같아."
   맞다 — 크라운도 앞머리에 뿌리를 대고 있으니 지분이 0은 아니다. 지분은
   지어내지 않고 <b>실제로 내려 심는 비율</b>에서 읽는다:
       crownFrac / (frontFrac + crownFrac) = 0.15 / 0.75 = <b>0.20</b>
   MQ_FRINGE 값을 바꾸면 지분도 따라 움직인다(두 벌이 안 된다). */
function fringeLineY(sec) {
  if (!MQ_FRINGE.on || !(MQ_FRINGE.lineHalfX > 0)) return null;
  const m = state.hair3Dneutral;
  if (!m || !m.mannequin) return null;
  const CY = m.CY != null ? m.CY : SCALP_CENTER_Y;
  let E = null;
  try {
    E = getHeadEllipsoid();
  } catch (v172) {
    return null;
  }
  if (!E || !(E.b > 0.000001)) return null;
  const S = state.sections || {},
    yHair = CY + E.b * Math.cos(SCALP_ZONES.front.phiRange[1]),
    isCrown = sec === "crown" && MQ_FRINGE.crownLine;
  if (isCrown) {
    const v173 = mqCrownTipY(CY, E);
    if (v173 == null) return null;
    let v174 = sectionLengthRatio("crown", (S.crown || {}).length);
    v174 = 1 + (v174 - 1) * MQ_FRINGE.lineGain;
    /* 바닥 = <b>눈썹</b> 그 자체. 길이를 최대로 올려도 눈썹 밑으로는 안 간다
           (crownFloorBrow 배너). 자는 tipC와 같은 mqBrowY라 두 벌이 되지 않는다. */
    const v175 = yHair - (yHair - v173) * Math.max(0, v174);
    if (MQ_FRINGE.crownFloorBrow) {
      const v176 = mqBrowY(CY, E);
      if (v176 != null && v175 < v176) return v176;
    }
    return v175;
  }
  const tip0 = mqFringeTipY(CY);
  if (tip0 == null) return null;
  /* 크라운 지분은 <b>크라운이 이 선을 탈 때만</b> 의미가 있다. 자기 선이
       생긴 뒤에도 지분을 남겨 두면, 크라운 슬라이더가 크라운 선과 프론트 선을
       <b>동시에</b> 움직여 "크라운만 올렸는데 앞머리도 따라 올라간다"가 된다.
       그래서 crownLine이 켜져 있으면 프론트 선은 순수하게 프론트 것이다. */
  const rF = sectionLengthRatio("front", (S.front || {}).length),
    rC = sectionLengthRatio("crown", (S.crown || {}).length),
    share = MQ_FRINGE.crownLine ? 0 : MQ_FRINGE.crownFrac / Math.max(1e-9, MQ_FRINGE.frontFrac + MQ_FRINGE.crownFrac);
  let r = rF * (1 - share) + rC * share;
  // 선에만 감쇠
  r = 1 + (r - 1) * MQ_FRINGE.lineGain;
  /* 바닥 — 눈~턱의 lineFloorFaceFrac 아래로는 안 내려간다. 자는 mqFringeTipY와
       같은 것이라 두 벌이 되지 않는다(tip0 = CY − tipFaceFrac × 눈~턱). */
  const y = yHair - (yHair - tip0) * Math.max(0, r);
  if (MQ_FRINGE.lineFloorFaceFrac > 0 && MQ_FRINGE.tipFaceFrac !== MQ_FRINGE.lineFloorFaceFrac) {
    const v177 = (CY - tip0) / Math.max(1e-9, MQ_FRINGE.tipFaceFrac || 1),
      v178 = MQ_FRINGE.tipFaceFrac > 0 ? CY - MQ_FRINGE.lineFloorFaceFrac * v177 : CY - MQ_FRINGE.lineFloorFaceFrac * _mqFaceH(CY, E);
    if (v178 != null && y < v178) return v178;
  }
  return y;
}
/* 눈~턱 — mqFringeTipY와 <b>같은 자</b>(tipFaceFrac이 0이면 tip0에서 역산이
   안 되므로 여기서 직접 잰다. 식은 mqFringeTipY 그대로다). */
function _mqFaceH(CY, E) {
  try {
    const v179 = getFaceMetrics();
    if (v179 && v179.heightFactor > 0) return 0.7 * v179.heightFactor;
  } catch (v180) {}
  return E && E.b > 0 ? 0.7 * (E.b / 0.633) : 0;
}
let _mqSeed = 20260808;
const _mqRand = () => {
  return _mqSeed = _mqSeed * 1103515245 + 12345 & 2147483647, _mqSeed / 2147483647;
};
/* 타원체 안이면 표면으로 방사 밀어내기. 밖이면 그대로 — 두상 미끄러짐의 전부다. */
function ellipsoidPushOut(p, a, b, c, CY) {
  const x = p.x,
    y = p.y - CY,
    z = p.z,
    f = x * x / (a * a) + y * y / (b * b) + z * z / (c * c);
  if (f >= 1 || !(f > 0)) return p;
  const s = 1 / Math.sqrt(f);
  return {
    x: x * s,
    y: CY + y * s,
    z: z * s
  };
}
function growMannequinStrand(ci, NT, NP, S, E, CY, L, colors) {
  if (!(L > MANNEQUIN.minLen)) return null;
  const M = MANNEQUIN,
    pi = ci / NT | 0,
    ti = ci % NT,
    phi = (pi + _mqRand()) / NP * Math.PI,
    th = (ti + _mqRand()) / NT * 2 * Math.PI - Math.PI,
    sp = Math.sin(phi),
    cp = Math.cos(phi),
    K = M.clearance,
    aR = S.a * K,
    bR = S.b * K,
    cR = S.c * K;
  let p = {
    x: aR * sp * Math.sin(th),
    y: CY + bR * cp,
    z: cR * sp * Math.cos(th)
  };
  const d0 = _v3norm({
      x: p.x / (aR * aR),
      y: (p.y - CY) / (bR * bR),
      z: p.z / (cR * cR)
    }),
    layer = M.layerLo + (M.layerHi - M.layerLo) * _mqRand(),
    kx = (1 + layer * (E.a / Math.max(0.000001, S.a) - 1)) * K,
    ky = (1 + layer * (E.b / Math.max(0.000001, S.b) - 1)) * K,
    kz = (1 + layer * (E.c / Math.max(0.000001, S.c) - 1)) * K,
    cA = S.a * kx,
    cB = S.b * ky,
    cC = S.c * kz,
    N = M.segments,
    step = L / N,
    pHull = {
      x: E.a * sp * Math.sin(th),
      y: CY + E.b * cp,
      z: E.c * sp * Math.cos(th)
    },
    thick = Math.hypot(pHull.x - p.x, pHull.y - p.y, pHull.z - p.z),
    rampLen = Math.max(0.0001, Math.min(thick, L * M.rootRampMax)),
    pts = [{
      x: p.x,
      y: p.y,
      z: p.z
    }],
    outw = {
      x: Math.sin(th),
      y: 0,
      z: Math.cos(th)
    };
  let contact = false;
  for (let v181 = 1; v181 <= N; v181++) {
    const v182 = Math.min(1, v181 * step / rampLen),
      v183 = contact ? M.spread : 0,
      v184 = _v3norm({
        x: d0.x * (1 - v182) + outw.x * v183,
        y: d0.y * (1 - v182) - v182,
        z: d0.z * (1 - v182) + outw.z * v183
      });
    p = {
      x: p.x + v184.x * step,
      y: p.y + v184.y * step,
      z: p.z + v184.z * step
    };
    // 두상 미끄러짐
    const v185 = ellipsoidPushOut(p, cA, cB, cC, CY);
    contact = v185 !== p, p = v185, pts.push({
      x: p.x,
      y: p.y,
      z: p.z
    });
  }
  const color = colors && colors.length ? colors[_mqRand() * colors.length | 0] : "#2B2320";
  return {
    pts: pts,
    sec: null,
    color: color,
    srcAngle: null,
    rootFacing: 0,
    mannequin: true
  };
}
function buildMannequinHair3D() {
  /** (9/23 원본 주석 — 코드가 바뀌어 제자리를 못 찾음)
     · 섹션은 뿌리를 심어 봐야 안다 — 임시로 길이를 모르는 채 뿌리만 먼저 잡는다
     · 앞머리 — "심을 게 없으면 프론트·크라운에서 내린다"(위 MQ_FRINGE 배너).
       needFringe가 false(이미 앞머리 있음)거나 null(모름)이면 안 걸린다.
     · [진단] 조각별 원본 픽셀색을 실제로 구운 가닥 비율(2026-08-18 i).
       0%면 마스크·photoRGB·캘리브레이션 중 하나가 없다는 뜻이고, 그때 최종 3D는
       예전처럼 가닥당 단색이 된다 — [3D]의 "원본 픽셀색 N개"와 같은 숫자여야 한다.
     · [진단·앞머리] 셋을 한 줄에 — <b>왜 안 내려왔는지</b>를 화면에서 바로 가른다.
       · 이미 있음  → 손님에게 앞머리가 있어 안 심은 것(정상)
       · 모름       → 점유 프로브가 없다. 안 심는 게 맞고, 원인은 리프트 쪽이다
       · 0개        → 판정은 내렸는데 한 가닥도 안 났다 = 뿌리가 광대보다 아래거나
       실측 길이가 minLen 미만. 그때 볼 값은 tipFaceFrac다.
     · [진단·크라운선] 눈썹 선이 실제로 걸렸는지. 크라운 끝 y가 눈높이(CY)와
       같으면 crownLine이 꺼졌거나 mqBrowY가 null로 떨어진 것이다.
  */
  try {
    ROOTS_FALLBACK.ensureRoots(state._hair3Dneutral || state.hair3D);
  } catch (v186) {}
  const src = state._hair3Dneutral || state.hair3D;
  if (!src || !src.strands || !src.strands.length) return null;
  const G = src.grid,
    rf = src.roots;
  if (!G || !rf || !rf.ok) return console.warn("[마네킹] 격자/뿌리밀도가 없어 못 심음"), null;
  const NT = rf.NT,
    NP = rf.NP,
    CY = src.CY,
    b = rf.b,
    S = getScalpEllipsoid(),
    E = getHeadEllipsoid(),
    yStep = (G.yTopH - G.yBot) / (G.NY - 1),
    bucketOfY = y => Math.min(G.NY - 1, Math.max(0, Math.round((G.yTopH - y) / yStep))),
    areas = headSurfaceCellAreas(G.hullW, G.hullD, bucketOfY, CY, b, NT, NP),
    byS = {},
    byV = {},
    allLen = [];
  for (const v187 of src.strands) {
    const v188 = v187.sec || "crown",
      v189 = byS[v188] || (byS[v188] = {
        len: [],
        col: []
      }),
      v190 = arcLength3D(v187.pts);
    v189.len.push(v190), allLen.push(v190);
    if (v187.color) v189.col.push(v187.color);
    const v191 = v188 + "|" + viewOfRoot(v187.pts[0]);
    (byV[v191] || (byV[v191] = [])).push(v190);
  }
  const pick = (arr, q) => {
      if (!arr.length) return 0;
      const a = arr.slice().sort((v192, v193) => v192 - v193);
      return a[Math.min(a.length - 1, Math.floor(a.length * q))];
    },
    secLen = {},
    secCol = {},
    viewLen = {},
    이상치 = [];
  for (const v194 in byS) {
    secLen[v194] = pick(byS[v194].len, MANNEQUIN.lenPct), secCol[v194] = byS[v194].col;
    const v195 = pick(byS[v194].len, 0.5);
    if (v195 > 0 && secLen[v194] / v195 > 3) 이상치.push(v194 + " 최장 " + secLen[v194].toFixed(3) + " = 중앙값 " + v195.toFixed(3) + "의 " + (secLen[v194] / v195).toFixed(1) + "배");
  }
  if (이상치.length) console.warn("[마네킹·길이 이상치] " + 이상치.join(" · ") + "\n    최장 가닥이 중앙값의 3배를 넘습니다 — 세그멘테이션이 어깨/옷을 머리로 따라갔을 가능성. MANNEQUIN.lenPct를 0.95 등으로 낮추면 이상치를 뺍니다.");
  const MIN_VIEW_N = 12,
    VIEW_LEN_TOL = 1 / 3,
    clampedTxt = [];
  for (const v196 in byV) {
    if (byV[v196].length < MIN_VIEW_N) continue;
    const v197 = pick(byV[v196], MANNEQUIN.lenPct),
      v198 = secLen[v196.split("|")[0]];
    if (!(v198 > 0)) {
      viewLen[v196] = v197;
      continue;
    }
    const v199 = Math.max(v198 * (1 - VIEW_LEN_TOL), Math.min(v198 * (1 + VIEW_LEN_TOL), v197));
    if (Math.abs(v199 - v197) > 0.000001) clampedTxt.push(v196 + " " + v197.toFixed(3) + "→" + v199.toFixed(3));
    viewLen[v196] = v199;
  }
  if (clampedTxt.length) console.log("[마네킹·뷰별길이 가둠] 섹션 중앙값 ±33% 밖 " + clampedTxt.length + "칸 — " + clampedTxt.join(" · ") + "\n    ↑ 많이 뜨면 그 섹션은 뷰마다 다르게 잘리고 있다는 뜻(세그멘테이션·마스크 경계 확인). MANNEQUIN 뷰별길이 자체를 끄려면 MIN_VIEW_N을 크게.");
  let fbLen = pick(allLen, MANNEQUIN.lenPct),
    lenFor = (sec, view) => viewLen[sec + "|" + view] || secLen[sec] || fbLen;
  const nCell = NT * NP,
    w = new Float64Array(nCell);
  /* (2026-10-22) 다시 기른 가닥으로 칸마다 길이 */
  let cellLen = null, rgTxt = "꺼짐(MANNEQUIN.lenFromRegrow=false)";
  try {
    const RG = window.REGROW, rgm = RG && RG.model;
    if (!MANNEQUIN.lenFromRegrow) {} else if (!(rgm && RG.src === src && rgm.strands && rgm.strands.length)) rgTxt = "다시 기른 모델 없음 — 예전(사진 가닥 모델 lenPct " + MANNEQUIN.lenPct + ")";
    else {
      const lists = new Array(nCell), secL = {}, allL = [];
      for (const s of rgm.strands) {
        const p = s.pts; if (!p || p.length < 2) continue;
        const L = arcLength3D(p), r = p[0];
        const ny = Math.max(-1, Math.min(1, (r.y - CY) / S.b)), pi = Math.max(0, Math.min(NP - 1, Math.floor(Math.acos(ny) / Math.PI * NP)));
        let ti = Math.floor((Math.atan2(r.x / S.a, r.z / S.c) + Math.PI) / (2 * Math.PI) * NT); ti = (ti % NT + NT) % NT;
        const ci = pi * NT + ti; (lists[ci] || (lists[ci] = [])).push(L); allL.push(L);
        const sc = s.sec || "crown"; (secL[sc] || (secL[sc] = [])).push(L);
      }
      const med = a => pick(a, 0.5);
      cellLen = new Float32Array(nCell);
      let own = 0, nbr = 0, bySec = 0;
      for (let ci = 0; ci < nCell; ci++) {
        if (lists[ci] && lists[ci].length) { cellLen[ci] = med(lists[ci]); own++; continue; }
        const pr = ci / NT | 0, tc = ci % NT; let got = null;
        for (let rr = 1; rr <= MANNEQUIN.lenNbr && !got; rr++) {
          const acc = [];
          for (let dp = -rr; dp <= rr; dp++) for (let dt = -rr; dt <= rr; dt++) {
            const pp = pr + dp; if (pp < 0 || pp >= NP) continue;
            const L2 = lists[pp * NT + ((tc + dt) % NT + NT) % NT]; if (L2) for (const x of L2) acc.push(x);
          }
          if (acc.length) got = med(acc);
        }
        if (got != null) { cellLen[ci] = got; nbr++; } else bySec++;
      }
      for (const k in secL) secLen[k] = med(secL[k]);
      fbLen = med(allL);
      for (const k in viewLen) delete viewLen[k];
      rgTxt = "다시 기른 가닥 " + rgm.strands.length + "개 · 칸 길이 제 칸 " + own + " · 둘레 칸 " + nbr + " · 섹션 중앙값 " + bySec;
    }
  } catch (e) { cellLen = null; rgTxt = "실패 — 예전대로: " + (e && e.message); }
  const lenAt = (ci, sec, view) => cellLen && cellLen[ci] > 0 ? cellLen[ci] : lenFor(sec, view);
  let wSum = 0,
    planted = 0,
    baldCells = 0,
    pxColored = 0,
    offScalpCells = 0;
  for (let v200 = 0; v200 < nCell; v200++) {
    // 두피 밖은 밀도 0이라 아래 조건에 자동으로 걸리지만, 이유를 따로 센다
    if (rf.est && rf.est[v200] === EST_OFFSCALP) {
      offScalpCells++, baldCells++;
      continue;
    }
    const v201 = rf.den[v200];
    if (!(v201 > MANNEQUIN.baldDen)) {
      baldCells++;
      continue;
    }
    w[v200] = v201 * (areas ? areas[v200] : 1), wSum += w[v200];
  }
  if (!(wSum > 0)) return console.warn("[마네킹] 뿌리밀도가 전부 0"), null;
  const target = window.STRAND_BUDGET && window.STRAND_BUDGET.on !== false && window.STRAND_BUDGET.total > 0 ? window.STRAND_BUDGET.total : src.strands.length,
    out = [];
  let acc = 0;
  /* 앞머리를 내릴지는 <b>심기 전에 한 번만</b> 정한다(프로브 표본 15점).
       hasFringe가 null이면 모르는 것이라 안 심는다 — 모르면 지어내지 않는다. */
  const secHist = {},
    hasFringe = MQ_FRINGE.on ? mannequinHasFringe(src) : null,
    fringeTipY = MQ_FRINGE.on ? mqFringeTipY(CY) : null;
  // 크라운은 눈썹
  let crownTipY = fringeTipY;
  if (MQ_FRINGE.on) {
    const v202 = mqCrownTipY(CY, E);
    if (v202 != null) crownTipY = v202;
  }
  const needFringe = hasFringe === false && fringeTipY != null;
  let fringeN = 0;
  /* 크라운은 <b>눈썹</b>까지만 내려 심는다 (2026-09-05). 심을 때 길게
             내려놓고 자를 때만 올리면, 커트 전(중립) 그림에서 크라운이 여전히
             눈까지 내려와 보인다 — 사용자가 본 게 그 상태다. */
  /* 조각별 원본 픽셀색 — 마네킹도 <b>사진에서 결을 가져온다</b>(2026-08-18 i).
           가닥을 자기 뷰로 되쏘아 그 자리 픽셀을 읽는다. 못 읽으면 null이라
           예전처럼 가닥당 단색으로 떨어진다(새 실패 모드 없음). */
  for (let v203 = 0; v203 < nCell; v203++) {
    if (!w[v203]) continue;
    acc += w[v203] / wSum * target;
    const v204 = Math.floor(acc);
    acc -= v204;
    for (let v205 = 0; v205 < v204; v205++) {
      const v206 = v203 / NT | 0,
        v207 = v203 % NT,
        v208 = (v206 + 0.5) / NP * Math.PI,
        v209 = (v207 + 0.5) / NT * 2 * Math.PI - Math.PI,
        v210 = {
          x: S.a * Math.sin(v208) * Math.sin(v209),
          y: CY + S.b * Math.cos(v208),
          z: S.c * Math.sin(v208) * Math.cos(v209)
        },
        v211 = resolveSection3D(v210, CY, S.b) || "crown",
        v212 = viewOfRoot(v210);
      let v213 = null;
      if (needFringe && mqFringePicks(v210, v211, v203, v205)) {
        const v214 = _v3norm({
            x: v210.x / (S.a * S.a),
            y: (v210.y - CY) / (S.b * S.b),
            z: v210.z / (S.c * S.c)
          }),
          v215 = v211 === "crown" ? crownTipY : fringeTipY;
        v213 = growFringeStrand(v210, v214, v215, lenAt(v203, v211, v212), secCol[v211] || secCol.crown);
        if (v213) fringeN++;
      }
      if (!v213) v213 = growMannequinStrand(v203, NT, NP, S, E, CY, lenAt(v203, v211, v212), secCol[v211] || secCol.crown);
      if (!v213) continue;
      v213.sec = v211, v213.srcAngle = v212, v213.colors = bakeStrandColors3D(v213.pts, src, v212, v213.color, null);
      if (v213.colors) pxColored++;
      secHist[v211] = (secHist[v211] || 0) + 1, out.push(v213), planted++;
    }
  }
  const lenTxt = Object.keys(secLen).map(v216 => v216 + " " + secLen[v216].toFixed(3)).join(" · "),
    vTxt = Object.keys(viewLen).sort().map(v217 => v217 + " " + viewLen[v217].toFixed(3)).join(" · ");
  return console.log("[마네킹] 가닥 " + planted + "개(촬영 " + target + "개 기준) · 심은 셀 " + (nCell - baldCells) + "/" + nCell + "(두피 밖 " + offScalpCells + " · 밀도 0 " + (baldCells - offScalpCells) + ")" + " · 섹션 " + Object.keys(secHist).map(v218 => v218 + " " + secHist[v218] + "(" + Math.round(100 * secHist[v218] / planted) + "%)").join(" ") + " · 섹션길이(중앙값) " + lenTxt + " · 원본 픽셀색 " + pxColored + "개(=" + (planted ? Math.round(pxColored / planted * 100) : 0) + "%)" + "\n[마네킹·앞머리] " + (hasFringe == null ? "<b>모름</b>(점유 프로브 없음 — 안 심음)" : hasFringe ? "손님에게 <b>이미 있음</b> — 안 심음" : fringeTipY == null ? "<b>끝높이 못 잼</b>(얼굴 계측 없음) — 안 심음" : "내려 심음 <b>" + fringeN + "개</b> · 끝 y=" + fringeTipY.toFixed(3) + "(눈에서 눈~턱의 " + Math.round(MQ_FRINGE.tipFaceFrac * 100) + "%" + (MQ_FRINGE.tipFaceFrac <= 0.01 ? " = 눈높이" : "") + ")" + " · front " + Math.round(MQ_FRINGE.frontFrac * 100) + "% / crown " + Math.round(MQ_FRINGE.crownFrac * 100) + "%" + (MQ_FRINGE.crownLine && crownTipY != null ? " · 크라운 끝 y=" + crownTipY.toFixed(3) + "(눈 위 " + (E && E.b > 0 ? Math.round((crownTipY - CY) / E.b * 100) : "?") + "% of E.b = <b>눈썹</b>)" : " · 크라운 <b>프론트와 같은 선</b>")) + (vTxt ? "\n[마네킹·뷰별길이] " + vTxt : "") + "\n[마네킹·길이 출처] " + rgTxt), {
    strands: out,
    viewCal: src.viewCal,
    yTop: src.yTop,
    CY: src.CY,
    field: null,
    occ: null,
    grid: G,
    roots: rf,
    mannequin: true
  };
}
/* ══════════════════════════════════════════════════════════════════
   #5 시술모드 — 빗질한 자리에 머리가 <b>남는다</b>
   ─────────────────────────────────────────────────────────────────
   사용자: "시술모드 — 마네킹처럼 리셋, 자유롭게 움직이는 머리(빗질·쓸어넘김이
   유지됨)". 기존 스타일링(넘김/가르마/볼륨/결흐름)은 <b>머리 전체</b>에 한
   방향으로 걸리는 슬라이더다. 실제 시술은 그렇지 않다 — 빗을 댄 자리만,
   댄 방향으로 움직이고, 손을 떼면 거기 있다.

   설계 — 스트로크 목록이 아니라 <b>변위장</b>:
   빗질 한 획을 그대로 목록에 쌓고 가닥마다 전부 훑으면 비용이
   (획 수 × 가닥 수 × 점 수)로 커진다(획 200개면 6천만 회). 대신 두상+모발을
   감싸는 성긴 3D 격자(N³)에 변위를 <b>누적</b>해 두고, 가닥은 자기 점에서
   삼선형 보간으로 한 번만 읽는다 — 획을 아무리 그어도 적용 비용이 일정하다.
   획 목록(strokes)은 되돌리기·재굽기용으로만 남긴다.

   두 가지 물리 규칙만 지킨다(나머지는 손대지 않는다):
     · 뿌리는 두피에 박혀 있다 — 뿌리 쪽 gripFrom 구간은 거의 안 움직인다
     · 머리카락 <b>길이는 변하지 않는다</b> — 변위 후 원래 마디 길이로 다시 걷는다
       (안 하면 빗질할수록 머리가 늘어난다)
══════════════════════════════════════════════════════════════════ */
const COMB = {
  on: false,
  radiusPx: 64,
  falloff: 1.6,
  gripFrom: 0.18,
  maxStrokes: 4000,
  N: 32,
  minMovePx: 4,
  strokes: [],
  grid: null,
  box: null,
  _proj: null,
  bmin: null,
  bmax: null,
  maxDisp: 0
};
/* 격자 상자 — 중립 모델의 실제 점 범위에서 잡는다(지어낸 크기 아님). */
function combEnsureBox() {
  if (COMB.box) return COMB.box;
  const m = state.hair3Dneutral;
  if (!m || !m.strands || !m.strands.length) return null;
  let x0 = Infinity,
    y0 = Infinity,
    z0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity,
    z1 = -Infinity;
  const step = Math.max(1, Math.floor(m.strands.length / 400));
  for (let v219 = 0; v219 < m.strands.length; v219 += step) {
    for (const v220 of m.strands[v219].pts) {
      if (v220.x < x0) x0 = v220.x;
      if (v220.x > x1) x1 = v220.x;
      if (v220.y < y0) y0 = v220.y;
      if (v220.y > y1) y1 = v220.y;
      if (v220.z < z0) z0 = v220.z;
      if (v220.z > z1) z1 = v220.z;
    }
  }
  if (!isFinite(x0)) return null;
  const pad = 0.3 * Math.max(x1 - x0, y1 - y0, z1 - z0);
  return COMB.box = {
    x0: x0 - pad,
    y0: y0 - pad,
    z0: z0 - pad,
    x1: x1 + pad,
    y1: y1 + pad,
    z1: z1 + pad
  }, COMB.box;
}
function combGrid() {
  if (COMB.grid) return COMB.grid;
  if (!combEnsureBox()) return null;
  return COMB.grid = new Float32Array(COMB.N * COMB.N * COMB.N * 3), COMB.grid;
}
/* 획 하나를 격자에 뿌린다(누적). r은 모델 단위 반경. */
function combSplat(p, d, r) {
  const g = combGrid(),
    B = COMB.box,
    N = COMB.N;
  if (!g || !B || !(r > 0)) return;
  const sx = (B.x1 - B.x0) / (N - 1),
    sy = (B.y1 - B.y0) / (N - 1),
    sz = (B.z1 - B.z0) / (N - 1);
  {
    const v221 = (p.x - B.x0) / sx,
      v222 = (p.y - B.y0) / sy,
      v223 = (p.z - B.z0) / sz,
      v224 = Math.min(N - 2, Math.max(0, Math.floor(v221))),
      v225 = Math.min(N - 2, Math.max(0, Math.floor(v222))),
      v226 = Math.min(N - 2, Math.max(0, Math.floor(v223))),
      v227 = v221 - v224,
      v228 = v222 - v225,
      v229 = v223 - v226;
    let v230 = 0;
    for (let v231 = 0; v231 < 2; v231++) for (let v232 = 0; v232 < 2; v232++) for (let v233 = 0; v233 < 2; v233++) {
      const v234 = (v233 ? v227 : 1 - v227) * (v232 ? v228 : 1 - v228) * (v231 ? v229 : 1 - v229);
      if (!v234) continue;
      const v235 = Math.hypot(B.x0 + (v224 + v233) * sx - p.x, B.y0 + (v225 + v232) * sy - p.y, B.z0 + (v226 + v231) * sz - p.z);
      if (v235 < r) v230 += v234 * Math.pow(1 - v235 / r, COMB.falloff);
    }
    if (v230 > 0.15) d = {
      x: d.x / v230,
      y: d.y / v230,
      z: d.z / v230
    };
  }
  !COMB.bmin && (COMB.bmin = {
    x: Infinity,
    y: Infinity,
    z: Infinity
  }, COMB.bmax = {
    x: -Infinity,
    y: -Infinity,
    z: -Infinity
  });
  COMB.bmin.x = Math.min(COMB.bmin.x, p.x - r), COMB.bmax.x = Math.max(COMB.bmax.x, p.x + r), COMB.bmin.y = Math.min(COMB.bmin.y, p.y - r), COMB.bmax.y = Math.max(COMB.bmax.y, p.y + r), COMB.bmin.z = Math.min(COMB.bmin.z, p.z - r), COMB.bmax.z = Math.max(COMB.bmax.z, p.z + r);
  const i0 = Math.max(0, Math.floor((p.x - r - B.x0) / sx)),
    i1 = Math.min(N - 1, Math.ceil((p.x + r - B.x0) / sx)),
    j0 = Math.max(0, Math.floor((p.y - r - B.y0) / sy)),
    j1 = Math.min(N - 1, Math.ceil((p.y + r - B.y0) / sy)),
    k0 = Math.max(0, Math.floor((p.z - r - B.z0) / sz)),
    k1 = Math.min(N - 1, Math.ceil((p.z + r - B.z0) / sz));
  for (let v236 = i0; v236 <= i1; v236++) {
    const v237 = B.x0 + v236 * sx;
    for (let v238 = j0; v238 <= j1; v238++) {
      const v239 = B.y0 + v238 * sy;
      for (let v240 = k0; v240 <= k1; v240++) {
        const v241 = B.z0 + v240 * sz,
          v242 = Math.hypot(v237 - p.x, v239 - p.y, v241 - p.z);
        if (v242 > r) continue;
        const v243 = Math.pow(1 - v242 / r, COMB.falloff),
          v244 = ((v240 * N + v238) * N + v236) * 3;
        g[v244] += d.x * v243, g[v244 + 1] += d.y * v243, g[v244 + 2] += d.z * v243;
        const v245 = Math.hypot(g[v244], g[v244 + 1], g[v244 + 2]);
        if (v245 > COMB.maxDisp) COMB.maxDisp = v245;
      }
    }
  }
}
function combSampleInto(p, out) {
  const g = COMB.grid,
    B = COMB.box,
    N = COMB.N;
  out.x = out.y = out.z = 0;
  if (!g || !B) return out;
  const fx = (p.x - B.x0) / (B.x1 - B.x0) * (N - 1),
    fy = (p.y - B.y0) / (B.y1 - B.y0) * (N - 1),
    fz = (p.z - B.z0) / (B.z1 - B.z0) * (N - 1);
  if (fx < 0 || fy < 0 || fz < 0 || fx > N - 1 || fy > N - 1 || fz > N - 1) return out;
  const i = Math.min(N - 2, Math.floor(fx)),
    j = Math.min(N - 2, Math.floor(fy)),
    k = Math.min(N - 2, Math.floor(fz)),
    tx = fx - i,
    ty = fy - j,
    tz = fz - k;
  for (let v246 = 0; v246 < 2; v246++) for (let v247 = 0; v247 < 2; v247++) for (let v248 = 0; v248 < 2; v248++) {
    const v249 = (v248 ? tx : 1 - tx) * (v247 ? ty : 1 - ty) * (v246 ? tz : 1 - tz);
    if (!v249) continue;
    const v250 = (((k + v246) * N + (j + v247)) * N + (i + v248)) * 3;
    out.x += g[v250] * v249, out.y += g[v250 + 1] * v249, out.z += g[v250 + 2] * v249;
  }
  return out;
}
function combRebake() {
  COMB.grid = null, COMB.bmin = COMB.bmax = null, COMB.maxDisp = 0;
  if (!COMB.strokes.length) return;
  combGrid();
  /* 재굽기는 원래 명령값(s.d)으로 다시 뿌려야 한다 — combSplat이 감쇠 보정을
       또 걸므로, 저장은 <b>보정 전</b> 값이어야 왕복이 맞는다(그래서 splat은
       인자 d를 지역 변수로만 바꾸고 호출자의 객체는 안 건드린다). */
  for (const v251 of COMB.strokes) combSplat(v251.p, v251.d, v251.r);
}
function combClear() {
  COMB.strokes.length = 0, COMB.grid = null, COMB.bmin = COMB.bmax = null, COMB.maxDisp = 0;
}
function combUndo() {
  if (!COMB.strokes.length) return;
  const id = COMB.strokes[COMB.strokes.length - 1].g;
  while (COMB.strokes.length && COMB.strokes[COMB.strokes.length - 1].g === id) COMB.strokes.pop();
  combRebake(), combRefresh();
}
/* 변위장을 가닥에 적용 — 뿌리 고정 + 길이 보존 */
const _combTmp = {
  x: 0,
  y: 0,
  z: 0
};
function combStrand3D(pts) {
  /** (9/23 원본 주석 — 코드가 바뀌어 제자리를 못 찾음)
     · 획이 닿은 범위 밖이면 통째로 건너뛴다(대부분의 가닥이 여기서 끝난다)
     · 길이 보존 — 옮겨진 곡선의 <b>접선</b>을 따라 원래 마디 길이로 다시 걷는다.
       (목표점을 향해 걷는 방식은 곡선이 줄어들면 앞질러 나가 지그재그가 된다 —
       straightenStrand3D에서 실측으로 확인한 그 함정. 같은 형태를 쓴다.)
  */
  return FLY_TRIM._comb(() => COMB3D._apply(combStrand3DGrid(pts)));
}
function combStrand3DGrid(v252) {
  if (!COMB.grid || !v252 || v252.length < 2) return v252;
  const v253 = COMB.bmin,
    v254 = COMB.bmax;
  if (v253) {
    let v259 = false;
    for (let v260 = 0; v260 < v252.length; v260++) {
      const v261 = v252[v260];
      if (v261.x >= v253.x && v261.x <= v254.x && v261.y >= v253.y && v261.y <= v254.y && v261.z >= v253.z && v261.z <= v254.z) {
        v259 = true;
        break;
      }
    }
    if (!v259) return v252;
  }
  const v255 = v252.length - 1,
    v256 = new Array(v252.length);
  let v257 = false;
  for (let v262 = 0; v262 < v252.length; v262++) {
    const v263 = v252[v262];
    combSampleInto(v263, _combTmp);
    const v264 = v262 / v255,
      v265 = v264 <= COMB.gripFrom ? v264 / COMB.gripFrom : 1;
    if (_combTmp.x || _combTmp.y || _combTmp.z) v257 = true;
    v256[v262] = {
      x: v263.x + _combTmp.x * v265,
      y: v263.y + _combTmp.y * v265,
      z: v263.z + _combTmp.z * v265
    };
  }
  if (!v257) return v252;
  const v258 = [v256[0]];
  for (let v266 = 1; v266 < v252.length; v266++) {
    const v267 = Math.hypot(v252[v266].x - v252[v266 - 1].x, v252[v266].y - v252[v266 - 1].y, v252[v266].z - v252[v266 - 1].z),
      v268 = v258[v266 - 1];
    let v269 = v256[v266].x - v256[v266 - 1].x,
      v270 = v256[v266].y - v256[v266 - 1].y,
      v271 = v256[v266].z - v256[v266 - 1].z;
    const v272 = Math.hypot(v269, v270, v271) || 1;
    v258.push({
      x: v268.x + v269 / v272 * v267,
      y: v268.y + v270 / v272 * v267,
      z: v268.z + v271 / v272 * v267
    });
  }
  return v258;
}
var COMB3D = function () {
  'use strict';

  var v273 = window,
    v274 = "[빗질 3D]",
    v275 = Object.assign({
      enabled: true,
      on: false,
      radiusPx: 30,
      maxRadius: 0.16,
      cell: 0.025,
      pickPx: 22,
      strength: 0.6,
      falloff: 1.4,
      gripFrom: 0.12,
      spacing: 0.35,
      minMovePx: 3,
      maxSamples: 1500,
      dab: 0.045,
      dabCell: 0.03,
      dabMax: 1500,
      depthMargin: 0.2,
      liveMs: 250,
      dirLagPx: 22,
      touchOffset: 52,
      indicator: true,
      grain: true,
      flowCell: 0.07,
      flowSmooth: 0.2,
      flowMin: 24,
      flowNear: 2,
      flowDense: 0.2,
      flowShare: 1,
      flowOwn: 55,
      flowFinger: 60,
      flowCoh: 0.6,
      flowReach: 3,
      tolFrom: 12,
      tolFull: 28,
      collide: true,
      anchor: true,
      flyOnly: true,
      anchorLen: 0.13,
      bodyFull: 8,
      pullIn: 0.3,
      headLift: 1.02,
      surf: true,
      surfThr: 0.3,
      surfNbr: 6,
      surfCore: 12,
      surfHead: 1.15,
      flyFrom: 0.02,
      flyFull: 0.05,
      depthLayer: 0.13,
      visCell: 4,
      partFinger: true,
      reachIn: 4,
      reachBack: true,
      divAngle: 15,
      flyTol: 0,
      flyTolFull: 6,
      lead: 0.6,
      settle: 0.7,
      maxMove: 0.32,
      settleReach: 0.16,
      settleGain: 0.6,
      ease: 0.5,
      relax: 2,
      pickStrands: 8000,
      sweep: true,
      mode: "tidy",
      sweepStrength: 0.6,
      sweepLevel: 7,
      sweepGrip: 0.12,
      sweepTol: 3,
      sweepDepth: 0.2,
      sweepWrap: true,
      wrapNear: 1.15,
      wrapFar: 1.5
    }, v273.COMB3D || {});
  v275.sweeps = [];
  if (v275.mode !== "sweep") v275.mode = "tidy";
  v275.samples = [];
  var v276 = v275.stats = {
      strokes: 0,
      touched: 0,
      _t: 0,
      ms: 0,
      pickMs: 0,
      pickPts: 0,
      pickFly: 0,
      pickHidden: 0,
      reached: 0,
      dabs: 0,
      seen: 0,
      tOwn: 0,
      tSide: 0,
      tAll: 0,
      tReach: 0,
      tFinger: 0,
      tSkip: 0,
      _to: 0,
      _ts: 0,
      _ta: 0,
      _tr: 0,
      _tf: 0,
      _tk: 0,
      pushed: 0,
      neck: 0,
      _pu: 0,
      _nk: 0,
      anch: 0,
      pin: 0,
      _an: 0,
      _pi: 0,
      fly: 0,
      _fl: 0,
      up: 0,
      _up: 0,
      clamp: 0,
      _cl: 0,
      surfRef: 0,
      surfCells: 0,
      flowRef: 0,
      flowCells: 0,
      flowMs: 0,
      err: null
    },
    v277 = 0,
    v278 = 0,
    v279 = null;
  v276._sw = 0, v276._swp = 0, v276.swept = 0, v276.sweptPush = 0, v276.sweepStrokes = 0;
  function v280() {
    try {
      return performance.now();
    } catch (v368) {
      return Date.now();
    }
  }
  function v281() {
    try {
      return currentScreen;
    } catch (v369) {
      return "";
    }
  }
  function v282() {
    try {
      return model3D && model3D.initialized ? model3D : null;
    } catch (v370) {
      return null;
    }
  }
  function v283() {
    try {
      return !!(v273.ADJUST3D && v273.ADJUST3D.on);
    } catch (v371) {
      return false;
    }
  }
  function v284() {
    return !!(v275.enabled && v283() && v281() === "adjust" && v282());
  }
  var v285 = null,
    v286 = 0,
    v287 = 0,
    v288 = 0,
    v289 = 512,
    v290 = 1024;
  function v291() {
    return {
      map: new Map(),
      V: new Float32Array(3 * 4096),
      n: 0,
      mn: [Infinity, Infinity, Infinity],
      mx: [-Infinity, -Infinity, -Infinity]
    };
  }
  function v292(v372, v373, v374, v375, v376, v377, v378, v379, v380) {
    var v381 = v275.cell,
      v382 = v376 * v376,
      v383 = Math.floor((v373 - v376) / v381),
      v384 = Math.floor((v373 + v376) / v381),
      v385 = Math.floor((v374 - v376) / v381),
      v386 = Math.floor((v374 + v376) / v381),
      v387 = Math.floor((v375 - v376) / v381),
      v388 = Math.floor((v375 + v376) / v381),
      v389,
      v390,
      v391,
      v392,
      v393,
      v394,
      v395,
      v396;
    if (v383 < -v289 || v385 < -v289 || v387 < -v289 || v384 >= v289 || v386 >= v289 || v388 >= v289) return;
    for (v391 = v387; v391 <= v388; v391++) {
      var v397 = (v391 + 0.5) * v381 - v375;
      for (v390 = v385; v390 <= v386; v390++) {
        var v398 = (v390 + 0.5) * v381 - v374;
        for (v389 = v383; v389 <= v384; v389++) {
          var v399 = (v389 + 0.5) * v381 - v373;
          v394 = v399 * v399 + v398 * v398 + v397 * v397;
          if (v394 >= v382) continue;
          v395 = v377 * Math.min(1, 1.6 * (1 - Math.sqrt(v394) / v376));
          if (v395 < 0.004) continue;
          v392 = v389 + v289 + v290 * (v390 + v289 + v290 * (v391 + v289)), v393 = v372.map.get(v392);
          if (v393 === undefined) {
            v393 = v372.n++, v372.map.set(v392, v393);
            if (v393 * 3 + 3 > v372.V.length) {
              var v400 = new Float32Array(v372.V.length * 2);
              v400.set(v372.V), v372.V = v400;
            }
          }
          v396 = v372.V, v393 *= 3, v396[v393] = v396[v393] * (1 - v395) + v378 * v395, v396[v393 + 1] = v396[v393 + 1] * (1 - v395) + v379 * v395, v396[v393 + 2] = v396[v393 + 2] * (1 - v395) + v380 * v395;
        }
      }
    }
    if (v373 - v376 < v372.mn[0]) v372.mn[0] = v373 - v376;
    if (v374 - v376 < v372.mn[1]) v372.mn[1] = v374 - v376;
    if (v375 - v376 < v372.mn[2]) v372.mn[2] = v375 - v376;
    if (v373 + v376 > v372.mx[0]) v372.mx[0] = v373 + v376;
    if (v374 + v376 > v372.mx[1]) v372.mx[1] = v374 + v376;
    if (v375 + v376 > v372.mx[2]) v372.mx[2] = v375 + v376;
  }
  function v293(v401, v402) {
    var v403 = v402.dabs,
      v404 = v402.m,
      v405,
      v406 = v275.dab;
    for (v405 = 0; v405 < v404; v405++) v292(v401, v403[v405 * 4], v403[v405 * 4 + 1], v403[v405 * 4 + 2], v406, v402.k * v403[v405 * 4 + 3], v402.dx, v402.dy, v402.dz);
  }
  function v294() {
    var v407 = v275.samples.length;
    (!v285 || v287 !== v288 || v286 > v407) && (v285 = v291(), v286 = 0, v287 = v288);
    for (; v286 < v407; v286++) v293(v285, v275.samples[v286]);
    return v407 ? v285 : null;
  }
  var v295 = null,
    v296 = 0,
    v297 = 0;
  function v298() {
    var v408 = v275.sweeps.length;
    (!v295 || v297 !== v288 || v296 > v408) && (v295 = v291(), v296 = 0, v297 = v288);
    for (; v296 < v408; v296++) v293(v295, v275.sweeps[v296]);
    return v408 ? v295 : null;
  }
  var v299 = null,
    v300 = -1000000000,
    v301 = null;
  function v302() {
    var v409 = null,
      v410 = v280();
    try {
      v409 = state._hair3Dneutral || state.hair3Dneutral || null;
    } catch (v414) {}
    if (v299 !== null && v409 === v301 && v410 - v300 < 400) return v299 || null;
    var v411 = null,
      v412 = 0;
    try {
      v411 = typeof getScalpEllipsoid === "function" ? getScalpEllipsoid() : getHeadEllipsoid();
    } catch (v415) {
      v411 = null;
    }
    try {
      var v413 = state.hair3Dneutral;
      if (v413 && isFinite(v413.CY)) v412 = v413.CY;else {
        if (typeof SCALP_CENTER_Y !== "undefined") v412 = SCALP_CENTER_Y;
      }
    } catch (v416) {}
    return v299 = v411 && v411.a > 0 && v411.b > 0 && v411.c > 0 && isFinite(v412) ? {
      a2: v411.a * v411.a,
      b2: v411.b * v411.b,
      c2: v411.c * v411.c,
      cy: v412
    } : false, v300 = v410, v301 = v409, v299 || null;
  }
  var v303 = new Float64Array(4 * 256),
    v304 = new Float64Array(3 * 256),
    v305 = new Float64Array(256),
    v306 = new Float64Array(256),
    v307 = new Int32Array(256),
    v308 = Math.PI / 180;
  function v309(v417, v418, v419, v420) {
    var v421 = (v418 - v417.x0) * v417.inv - 0.5,
      v422 = (v419 - v417.y0) * v417.inv - 0.5,
      v423 = (v420 - v417.z0) * v417.inv - 0.5,
      v424 = Math.floor(v421),
      v425 = Math.floor(v422),
      v426 = Math.floor(v423);
    if (v424 < 0 || v425 < 0 || v426 < 0 || v424 >= v417.mx - 1 || v425 >= v417.my - 1 || v426 >= v417.mz - 1) return v417.far;
    var v427 = v421 - v424,
      v428 = v422 - v425,
      v429 = v423 - v426,
      v430 = v417.D,
      v431 = v424 + v417.mx * (v425 + v417.my * v426),
      v432 = v417.mx,
      v433 = v417.mx * v417.my,
      v434 = v430[v431] + (v430[v431 + 1] - v430[v431]) * v427,
      v435 = v430[v431 + v432] + (v430[v431 + v432 + 1] - v430[v431 + v432]) * v427,
      v436 = v430[v431 + v433] + (v430[v431 + v433 + 1] - v430[v431 + v433]) * v427,
      v437 = v430[v431 + v433 + v432] + (v430[v431 + v433 + v432 + 1] - v430[v431 + v433 + v432]) * v427;
    return v434 += (v435 - v434) * v428, v436 += (v437 - v436) * v428, v434 + (v436 - v434) * v429;
  }
  var v310 = new Float64Array(3);
  function v311(v438, v439, v440, v441) {
    var v442 = v438.h,
      v443 = v309(v438, v439 - v442, v440, v441) - v309(v438, v439 + v442, v440, v441),
      v444 = v309(v438, v439, v440 - v442, v441) - v309(v438, v439, v440 + v442, v441),
      v445 = v309(v438, v439, v440, v441 - v442) - v309(v438, v439, v440, v441 + v442),
      v446 = Math.sqrt(v443 * v443 + v444 * v444 + v445 * v445);
    if (!(v446 > 1e-9)) return 0;
    return v310[0] = v443 / v446, v310[1] = v444 / v446, v310[2] = v445 / v446, v446 / (2 * v442);
  }
  function v312(v447, v448, v449, v450) {
    var v451 = Math.floor((v448 - v447.x0) * v447.inv),
      v452 = Math.floor((v449 - v447.y0) * v447.inv),
      v453 = Math.floor((v450 - v447.z0) * v447.inv);
    if (v451 < 0 || v452 < 0 || v453 < 0 || v451 >= v447.nx || v452 >= v447.ny || v453 >= v447.nz) return 0;
    var v454 = (v447.GA[v451 + v447.nx * (v452 + v447.ny * v453)] - v447.bLo) / (v447.bHi - v447.bLo);
    return v454 <= 0 ? 0 : v454 >= 1 ? 1 : v454 * v454 * (3 - 2 * v454);
  }
  var v313 = new Float64Array(3);
  function v314(v455, v456, v457, v458, v459, v460, v461, v462, v463, v464, v465, v466) {
    var v467 = Math.floor((v456 - v455.x0) * v455.inv),
      v468 = Math.floor((v457 - v455.y0) * v455.inv),
      v469 = Math.floor((v458 - v455.z0) * v455.inv),
      v470,
      v471,
      v472,
      v473,
      v474,
      v475,
      v476,
      v477,
      v478,
      v479,
      v480 = 0,
      v481 = 0,
      v482 = 0,
      v483 = 0,
      v484 = 0,
      v485 = 0,
      v486 = 0,
      v487 = 0,
      v488 = 0,
      v489 = 0,
      v490 = 0,
      v491 = 0,
      v492 = v455.GN,
      v493 = v455.GM,
      v494 = v455.GX,
      v495 = v455.GY,
      v496 = v455.GZ,
      v497 = v455.nx,
      v498 = v455.ny,
      v499 = v455.nz;
    for (v472 = v469 - 1; v472 <= v469 + 1; v472++) {
      if (v472 < 0 || v472 >= v499) continue;
      for (v471 = v468 - 1; v471 <= v468 + 1; v471++) {
        if (v471 < 0 || v471 >= v498) continue;
        for (v470 = v467 - 1; v470 <= v467 + 1; v470++) {
          if (v470 < 0 || v470 >= v497) continue;
          v473 = v470 + v497 * (v471 + v498 * v472), v474 = v492[v473];
          if (!v474) continue;
          v491 += v474, v475 = v493[v473];
          if (!(v475 > 0.000001)) continue;
          v476 = v494[v473], v477 = v495[v473], v478 = v496[v473], v488 += v476, v489 += v477, v490 += v478, v476 * v459 + v477 * v460 + v478 * v461 > v465 * v475 && (v480 += v476, v481 += v477, v482 += v478, v483 += v474), v476 * v462 + v477 * v463 + v478 * v464 > v466 * v475 && (v484 += v476, v485 += v477, v486 += v478, v487 += v474);
        }
      }
    }
    if (v491 < v455.near) return 0;
    var v500 = v455.near * v275.flowShare;
    if (v483 >= v500) {
      v479 = Math.sqrt(v480 * v480 + v481 * v481 + v482 * v482);
      if (v479 > 0.000001) return v313[0] = v480 / v479, v313[1] = v481 / v479, v313[2] = v482 / v479, 1;
    }
    if (v487 >= v500) {
      v479 = Math.sqrt(v484 * v484 + v485 * v485 + v486 * v486);
      if (v479 > 0.000001) return v313[0] = v484 / v479, v313[1] = v485 / v479, v313[2] = v486 / v479, 2;
    }
    v479 = Math.sqrt(v488 * v488 + v489 * v489 + v490 * v490);
    if (v479 > 0.000001 && v479 / v491 >= v275.flowCoh) return v313[0] = v488 / v479, v313[1] = v489 / v479, v313[2] = v490 / v479, 3;
    return -1;
  }
  function v315(v501, v502, v503) {
    var v504 = v503.DF,
      v505 = v501.length,
      v506 = v505 - 1,
      v507 = v275.cell,
      v508 = v502.map,
      v509 = v502.V,
      v510 = v303,
      v511 = v304,
      v512 = v305,
      v513 = v306,
      v514 = v307,
      v515,
      v516,
      v517,
      v518,
      v519,
      v520,
      v521,
      v522,
      v523,
      v524,
      v525,
      v526,
      v527,
      v528,
      v529,
      v530,
      v531,
      v532 = 0,
      v533 = v505,
      v534 = 0,
      v535,
      v536 = v501[0].x,
      v537 = v501[0].y,
      v538 = v501[0].z,
      v539 = v504.d0,
      v540 = 1 / (v504.d1 - v504.d0);
    for (v515 = 1; v515 < v505; v515++) {
      v516 = v501[v515], v527 = v516.x - v536, v528 = v516.y - v537, v529 = v516.z - v538, v531 = Math.sqrt(v527 * v527 + v528 * v528 + v529 * v529), v531 > 1e-9 ? (v510[v515 * 4] = v527 / v531, v510[v515 * 4 + 1] = v528 / v531, v510[v515 * 4 + 2] = v529 / v531) : (v510[v515 * 4] = 0, v510[v515 * 4 + 1] = -1, v510[v515 * 4 + 2] = 0), v510[v515 * 4 + 3] = v531, v532 += v531, v536 = v516.x, v537 = v516.y, v538 = v516.z;
    }
    for (v515 = 1; v515 < v505; v515++) {
      v512[v515] = 0, v513[v515] = 0, v514[v515] = -1;
      if (!(v510[v515 * 4 + 3] > 1e-9)) continue;
      v516 = v501[v515], v517 = v501[v515 - 1], v527 = (v516.x + v517.x) * 0.5, v528 = (v516.y + v517.y) * 0.5, v529 = (v516.z + v517.z) * 0.5, v518 = Math.floor(v527 / v507) + v289, v519 = Math.floor(v528 / v507) + v289, v520 = Math.floor(v529 / v507) + v289;
      if (v518 < 0 || v519 < 0 || v520 < 0 || v518 >= v290 || v519 >= v290 || v520 >= v290) continue;
      v521 = v508.get(v518 + v290 * (v519 + v290 * v520));
      if (v521 === undefined) continue;
      v524 = v509[v521 * 3], v525 = v509[v521 * 3 + 1], v526 = v509[v521 * 3 + 2], v522 = Math.sqrt(v524 * v524 + v525 * v525 + v526 * v526);
      if (!(v522 > 0.01)) continue;
      v523 = v515 / v506;
      if (v523 < v275.gripFrom) v522 *= v523 / v275.gripFrom;
      if (v522 > 1) v522 = 1;
      v514[v515] = v521, v513[v515] = v522, v275.flyOnly && (v535 = (v309(v504, v527, v528, v529) - v539) * v540, v522 *= v535 <= 0 ? 0 : v535 >= 1 ? 1 : v535 * v535 * (3 - 2 * v535)), v512[v515] = v522;
    }
    if (v275.reachBack) {
      var v541 = 0,
        v542 = -1,
        v543,
        v544,
        v545,
        v546 = Math.cos(Math.max(1, v275.divAngle) * v308);
      for (v515 = v506; v515 >= 1; v515--) {
        v522 = v512[v515];
        if (v522 > v541) {
          v541 = v522, v542 = v514[v515];
          continue;
        }
        if (!(v541 > 0.05) || !(v510[v515 * 4 + 3] > 1e-9)) continue;
        if (!(v513[v515] > 0.01)) {
          v541 *= 0.5;
          continue;
        }
        v516 = v501[v515], v517 = v501[v515 - 1], v535 = (v309(v504, (v516.x + v517.x) * 0.5, (v516.y + v517.y) * 0.5, (v516.z + v517.z) * 0.5) - v539) * v540, v543 = v535 > 0;
        if (!v543) {
          v518 = Math.floor(((v516.x + v517.x) * 0.5 - v503.x0) * v503.inv), v519 = Math.floor(((v516.y + v517.y) * 0.5 - v503.y0) * v503.inv), v520 = Math.floor(((v516.z + v517.z) * 0.5 - v503.z0) * v503.inv), v521 = 0;
          if (v518 >= 0 && v519 >= 0 && v520 >= 0 && v518 < v503.nx && v519 < v503.ny && v520 < v503.nz) {
            v518 += v503.nx * (v519 + v503.ny * v520);
            if (v503.GN[v518] >= v503.dense && v503.GM[v518] >= 0.85 * v503.GN[v518] && v503.GX[v518] * v510[v515 * 4] + v503.GY[v518] * v510[v515 * 4 + 1] + v503.GZ[v518] * v510[v515 * 4 + 2] < v546 * v503.GM[v518]) v521 = 1;
          }
          if (!v521) v541 *= v275.lead;
        }
        v523 = v515 / v506, v544 = v523 < v275.gripFrom ? v523 / v275.gripFrom : 1, v545 = v541 * v544;
        if (v545 > v522) {
          v512[v515] = v545;
          if (v514[v515] < 0) v514[v515] = v542;
          v276._up++;
        }
      }
    } else {
      if (v275.lead > 0) for (v515 = v506 - 1; v515 >= 1; v515--) {
        v522 = v512[v515 + 1] * v275.lead;
        if (v522 > v513[v515]) v522 = v513[v515];
        if (v522 > v512[v515]) v512[v515] = v522;
      }
    }
    for (v515 = 1; v515 < v505; v515++) if (v512[v515] > 0.01) {
      if (v515 < v533) v533 = v515;
      v534 = v515;
    }
    if (v533 > v534) return v501;
    var v547 = v532 > 0 ? Math.round(v275.flowSmooth / (v532 / v506)) : 1;
    if (!(v547 >= 1)) v547 = 1;else {
      if (v547 > 16) v547 = 16;
    }
    var v548, v549, v550, v551, v552, v553, v554, v555, v556, v557, v558;
    for (v515 = v533; v515 <= v534; v515++) {
      if (!(v512[v515] > 0.01)) continue;
      v516 = v501[v515], v517 = v501[v515 - 1], v548 = v501[v515 - 1 - v547 < 0 ? 0 : v515 - 1 - v547], v549 = v501[v515 + v547 > v506 ? v506 : v515 + v547], v550 = v510[v515 * 4], v551 = v510[v515 * 4 + 1], v552 = v510[v515 * 4 + 2], v527 = v549.x - v548.x, v528 = v549.y - v548.y, v529 = v549.z - v548.z, v530 = Math.sqrt(v527 * v527 + v528 * v528 + v529 * v529), v530 > 1e-9 ? (v527 /= v530, v528 /= v530, v529 /= v530, v557 = v527 * v550 + v528 * v551 + v529 * v552) : (v527 = v550, v528 = v551, v529 = v552, v557 = 1), v553 = v516.x - v548.x, v554 = v516.y - v548.y, v555 = v516.z - v548.z, v556 = Math.sqrt(v553 * v553 + v554 * v554 + v555 * v555), v556 > 1e-9 && (v558 = (v553 * v550 + v554 * v551 + v555 * v552) / v556, v558 > v557 && (v557 = v558, v527 = v553 / v556, v528 = v554 / v556, v529 = v555 / v556)), v553 = v549.x - v517.x, v554 = v549.y - v517.y, v555 = v549.z - v517.z, v556 = Math.sqrt(v553 * v553 + v554 * v554 + v555 * v555), v556 > 1e-9 && (v558 = (v553 * v550 + v554 * v551 + v555 * v552) / v556, v558 > v557 && (v557 = v558, v527 = v553 / v556, v528 = v554 / v556, v529 = v555 / v556)), v511[v515 * 3] = v527, v511[v515 * 3 + 1] = v528, v511[v515 * 3 + 2] = v529;
    }
    var v559 = Math.max(0, v275.flyTol) * v308,
      v560 = Math.max(v559 + 0.001, v275.flyTolFull * v308),
      v561 = Math.cos(v275.flowOwn * v308),
      v562 = Math.cos(v275.flowFinger * v308),
      v563 = Math.max(0, v275.flowReach | 0),
      v564 = v302(),
      v565 = v275.collide ? v564 : null,
      v566 = null,
      v567 = v275.headLift > 0 ? v275.headLift : 1.02,
      v568 = (v564 ? v564.cy : 0.15) + 0.3,
      v569 = v539 * 0.5,
      v570 = 1,
      v571 = 1,
      v572 = 1,
      v573 = 0,
      v574 = Math.cos(40 * v308),
      v575 = Math.cos(80 * v308),
      v576 = null,
      v577 = {
        x: 0,
        y: 0,
        z: 0
      },
      v578 = v275.maxMove > 0 ? v275.maxMove : 0;
    try {
      v576 = v273.REGROW && typeof v273.REGROW.neckPush === "function" ? v273.REGROW.neckPush : null;
    } catch (v632) {
      v576 = null;
    }
    if (v565) {
      v570 = v565.a2, v571 = v565.b2, v572 = v565.c2, v573 = v565.cy;
      try {
        v566 = v273.REGROW && typeof v273.REGROW.neckPush === "function" ? v273.REGROW.neckPush : null;
      } catch (v633) {
        v566 = null;
      }
    }
    var v579 = new Array(v505),
      v580 = v501[v533 - 1].x,
      v581 = v501[v533 - 1].y,
      v582 = v501[v533 - 1].z,
      v583,
      v584,
      v585,
      v586 = 0,
      v587 = 0,
      v588 = 0,
      v589 = 0,
      v590 = false,
      v591,
      v592,
      v593,
      v594,
      v595,
      v596,
      v597,
      v598,
      v599,
      v600,
      v601,
      v602,
      v603,
      v604,
      v605,
      v606,
      v607,
      v608,
      v609,
      v610,
      v611,
      v612,
      v613,
      v614,
      v615,
      v616,
      v617,
      v618,
      v619,
      v620,
      v621,
      v622,
      v623,
      v624,
      v625,
      v626,
      v627,
      v628,
      v629,
      v630,
      v631;
    v533 > 1 && (v587 = v510[(v533 - 1) * 4], v588 = v510[(v533 - 1) * 4 + 1], v589 = v510[(v533 - 1) * 4 + 2], v590 = v510[(v533 - 1) * 4 + 3] > 1e-9);
    for (v515 = 0; v515 < v533; v515++) v579[v515] = v501[v515];
    for (v515 = v533; v515 < v505; v515++) {
      v550 = v510[v515 * 4], v551 = v510[v515 * 4 + 1], v552 = v510[v515 * 4 + 2], v531 = v510[v515 * 4 + 3], v522 = v515 <= v534 ? v512[v515] : 0;
      if (v522 > 0.01 && v531 > 1e-9) {
        v276._fl++, v521 = v514[v515] * 3, v600 = v509[v521], v601 = v509[v521 + 1], v602 = v509[v521 + 2], v603 = Math.sqrt(v600 * v600 + v601 * v601 + v602 * v602), v600 /= v603, v601 /= v603, v602 /= v603, v591 = v309(v504, v580, v581, v582), v596 = false, v597 = v580, v598 = v581, v599 = v582, v592 = 0;
        if (v591 > 0.0001 && v591 < v504.far && (v592 = v311(v504, v580, v581, v582)) > 0.2) {
          v593 = v310[0], v594 = v310[1], v595 = v310[2], v527 = v580 + v593 * v591, v528 = v581 + v594 * v591, v529 = v582 + v595 * v591, v605 = 1;
          if (v580 * v527 + v582 * v529 < 0) v605 = 0;else {
            if (v564) {
              v627 = v528 - v564.cy;
              if (v527 * v527 / v564.a2 + v627 * v627 / v564.b2 + v529 * v529 / v564.c2 < 1) v605 = 0;else {
                v627 = (v581 + v528) * 0.5 - v564.cy;
                if ((v580 + v527) * (v580 + v527) * 0.25 / v564.a2 + v627 * v627 / v564.b2 + (v582 + v529) * (v582 + v529) * 0.25 / v564.c2 < 1) v605 = 0;
              }
            }
          }
          if (v605 && v576) try {
            v577.x = v527, v577.y = v528, v577.z = v529;
            if (v576(v577) !== v577) v605 = 0;else {
              v577.x = (v580 + v527) * 0.5, v577.y = (v581 + v528) * 0.5, v577.z = (v582 + v529) * 0.5;
              if (v576(v577) !== v577) v605 = 0;
            }
          } catch (v634) {}
          if (!v605) v592 = 0;else v597 = v527, v598 = v528, v599 = v529;
          v606 = -v580, v607 = v581 > v568 ? v568 - v581 : 0, v608 = -v582, v609 = Math.sqrt(v606 * v606 + v607 * v607 + v608 * v608), v610 = v609 > 0.000001 ? (v593 * v606 + v594 * v607 + v595 * v608) / v609 : 1, v596 = v605 === 1 && v275.settle > 0 && v591 > v569 && v591 <= v275.settleReach && v610 > 0.2;
        }
        v590 ? (v527 = v587, v528 = v588, v529 = v589) : (v527 = v511[v515 * 3], v528 = v511[v515 * 3 + 1], v529 = v511[v515 * 3 + 2]);
        v604 = v314(v503, v597, v598, v599, v527, v528, v529, v600, v601, v602, v561, v562);
        if (v604 === 0) for (v605 = 1; v605 <= v563; v605++) {
          if (v592 > 0.2) v618 = v593, v619 = v594, v620 = v595, v556 = 1;else {
            v618 = -v597, v619 = v598 < v568 ? 0 : v568 - v598, v620 = -v599, v556 = Math.sqrt(v618 * v618 + v619 * v619 + v620 * v620);
            if (!(v556 > 0.000001)) break;
          }
          v597 += v618 / v556 * v503.fc, v598 += v619 / v556 * v503.fc, v599 += v620 / v556 * v503.fc, v604 = v314(v503, v597, v598, v599, v527, v528, v529, v600, v601, v602, v561, v562);
          if (v604 !== 0) {
            if (v604 > 0) v604 = 4;
            break;
          }
        }
        if (v604 === 0 && v592 > 0.2 && v593 * v550 + v594 * v551 + v595 * v552 < -0.6) v604 = -2;
        if (v604 === -1) {
          v276._tk++;
          if (v275.partFinger) v604 = 0;
        }
        if (v604 < 0) {} else {
          if (v604 === 0) v553 = v600, v554 = v601, v555 = v602, v276._tf++;else {
            v553 = v313[0], v554 = v313[1], v555 = v313[2];
            if (v604 === 1) v276._to++;else {
              if (v604 === 2) v276._ts++;else {
                if (v604 === 3) v276._ta++;else v276._tr++;
              }
            }
          }
          v605 = 0;
          if (v596) {
            v611 = v593 * v553 + v594 * v554 + v595 * v555, v618 = v593 - v611 * v553, v619 = v594 - v611 * v554, v620 = v595 - v611 * v555, v612 = Math.sqrt(v618 * v618 + v619 * v619 + v620 * v620);
            if (v612 > 0.3) {
              v613 = v275.settleGain * (v591 - v569) / v531;
              if (v613 > v275.settle) v613 = v275.settle;
              v613 *= (v610 >= 0.6 ? 1 : (v610 - 0.2) / 0.4) / v612, v553 += v618 * v613, v554 += v619 * v613, v555 += v620 * v613, v530 = Math.sqrt(v553 * v553 + v554 * v554 + v555 * v555), v553 /= v530, v554 /= v530, v555 /= v530, v276._pi++, v605 = 1;
            }
          }
          v590 && v275.ease > 0 && v587 * v553 + v588 * v554 + v589 * v555 > 0 && (v553 += v587 * v275.ease, v554 += v588 * v275.ease, v555 += v589 * v275.ease, v530 = Math.sqrt(v553 * v553 + v554 * v554 + v555 * v555), v553 /= v530, v554 /= v530, v555 /= v530);
          v614 = v550 * v553 + v551 * v554 + v552 * v555;
          if (v614 < 0) v615 = v522 <= 0.15 ? 0 : v522 >= 0.4 ? 1 : (v522 - 0.15) / 0.25, v615 = v615 * v615 * (3 - 2 * v615), v615 > 0.5 && (v527 = v550 * (1 - v615) + v553 * v615, v528 = v551 * (1 - v615) + v554 * v615, v529 = v552 * (1 - v615) + v555 * v615, v530 = Math.sqrt(v527 * v527 + v528 * v528 + v529 * v529), v530 > 0.2 ? (v550 = v527 / v530, v551 = v528 / v530, v552 = v529 / v530) : (v550 = v553, v551 = v554, v552 = v555));else {
            v527 = v511[v515 * 3], v528 = v511[v515 * 3 + 1], v529 = v511[v515 * 3 + 2];
            v527 * v550 + v528 * v551 + v529 * v552 < 0.5 && (v527 = v550, v528 = v551, v529 = v552);
            v557 = v527 * v553 + v528 * v554 + v529 * v555;
            if (v557 > 1) v557 = 1;else {
              if (v557 < -1) v557 = -1;
            }
            v558 = Math.acos(v557);
            if (v558 > v559 || v605 && v558 > 0.01) {
              v616 = v605 || v558 >= v560 ? 1 : (v558 - v559) / (v560 - v559);
              if (v616 < 1) v616 = v616 * v616 * (3 - 2 * v616);
              v617 = v558 * v616 * v522, v618 = v528 * v555 - v529 * v554, v619 = v529 * v553 - v527 * v555, v620 = v527 * v554 - v528 * v553, v556 = Math.sqrt(v618 * v618 + v619 * v619 + v620 * v620), v617 >= 0.003 && v556 > 0.0001 && (v618 /= v556, v619 /= v556, v620 /= v556, v621 = Math.cos(v617), v622 = Math.sin(v617), v623 = (v618 * v550 + v619 * v551 + v620 * v552) * (1 - v621), v527 = v550 * v621 + (v619 * v552 - v620 * v551) * v622 + v618 * v623, v528 = v551 * v621 + (v620 * v550 - v618 * v552) * v622 + v619 * v623, v529 = v552 * v621 + (v618 * v551 - v619 * v550) * v622 + v620 * v623, v550 = v527, v551 = v528, v552 = v529);
            }
          }
        }
        v275.relax > 0 && v590 && (v557 = v550 * v587 + v551 * v588 + v552 * v589, v557 < v574 && (v616 = v557 <= v575 ? 1 : (v574 - v557) / (v574 - v575), v616 = v616 * v616 * (3 - 2 * v616) * v522 * (v275.relax > 1 ? 1 : v275.relax), v527 = v550 + (v587 - v550) * v616, v528 = v551 + (v588 - v551) * v616, v529 = v552 + (v589 - v552) * v616, v530 = Math.sqrt(v527 * v527 + v528 * v528 + v529 * v529), v530 > 0.2 && (v550 = v527 / v530, v551 = v528 / v530, v552 = v529 / v530)));
      }
      v583 = v580 + v550 * v531, v584 = v581 + v551 * v531, v585 = v582 + v552 * v531, v624 = v501[v515];
      v578 > 0 && v531 > 1e-9 && (v527 = v583 - v624.x, v528 = v584 - v624.y, v529 = v585 - v624.z, v631 = v527 * v527 + v528 * v528 + v529 * v529, v631 > v578 * v578 && (v613 = v578 / Math.sqrt(v631), v553 = v624.x + v527 * v613 - v580, v554 = v624.y + v528 * v613 - v581, v555 = v624.z + v529 * v613 - v582, v530 = Math.sqrt(v553 * v553 + v554 * v554 + v555 * v555), v530 > 1e-9 && (v583 = v580 + v553 / v530 * v531, v584 = v581 + v554 / v530 * v531, v585 = v582 + v555 / v530 * v531, v276._cl++)));
      if (v275.anchor && v531 > 1e-9) {
        v527 = v583 - v624.x, v528 = v584 - v624.y, v529 = v585 - v624.z, v631 = v527 * v527 + v528 * v528 + v529 * v529;
        if (v631 > 1e-10) {
          v535 = (v309(v504, v624.x, v624.y, v624.z) - v539) * v540, v535 = v535 <= 0 ? 1 : v535 >= 1 ? 0 : 1 - v535 * v535 * (3 - 2 * v535);
          if (v535 > 0 && !(v522 > 0.01)) {
            v613 = v531 / (v275.anchorLen > 0.01 ? v275.anchorLen : 0.13);
            if (v613 > 0.5) v613 = 0.5;
            v613 *= v535, v557 = v527 * v510[v515 * 4] + v528 * v510[v515 * 4 + 1] + v529 * v510[v515 * 4 + 2], v527 -= v557 * v510[v515 * 4], v528 -= v557 * v510[v515 * 4 + 1], v529 -= v557 * v510[v515 * 4 + 2], v553 = v583 - v527 * v613 - v580, v554 = v584 - v528 * v613 - v581, v555 = v585 - v529 * v613 - v582, v530 = Math.sqrt(v553 * v553 + v554 * v554 + v555 * v555), v530 > 1e-9 && (v583 = v580 + v553 / v530 * v531, v584 = v581 + v554 / v530 * v531, v585 = v582 + v555 / v530 * v531, v276._an++);
          }
        }
      }
      if (v565 && v531 > 1e-9) {
        v627 = v624.y - v573, v629 = Math.sqrt(v624.x * v624.x / v570 + v627 * v627 / v571 + v624.z * v624.z / v572);
        if (v629 > v567) v629 = v567;
        v627 = v584 - v573, v628 = Math.sqrt(v583 * v583 / v570 + v627 * v627 / v571 + v585 * v585 / v572), v628 < v629 - 0.000001 && (v627 = v581 - v573, v606 = v580 / v570, v607 = v627 / v571, v608 = v582 / v572, v609 = Math.sqrt(v606 * v606 + v607 * v607 + v608 * v608), v609 > 1e-9 && (v606 /= v609, v607 /= v609, v608 /= v609, v553 = (v583 - v580) / v531, v554 = (v584 - v581) / v531, v555 = (v585 - v582) / v531, v630 = v553 * v606 + v554 * v607 + v555 * v608, v630 < 0 && (v553 -= v630 * v606, v554 -= v630 * v607, v555 -= v630 * v608, v530 = Math.sqrt(v553 * v553 + v554 * v554 + v555 * v555), v530 < 0.35 && (v517 = v501[v515 - 1], v553 = (v624.x - v517.x) / v531, v554 = (v624.y - v517.y) / v531, v555 = (v624.z - v517.z) / v531, v630 = v553 * v606 + v554 * v607 + v555 * v608, v630 < 0 && (v553 -= v630 * v606, v554 -= v630 * v607, v555 -= v630 * v608), v530 = Math.sqrt(v553 * v553 + v554 * v554 + v555 * v555)), v530 > 0.001 && (v583 = v580 + v553 / v530 * v531, v584 = v581 + v554 / v530 * v531, v585 = v582 + v555 / v530 * v531))), v627 = v584 - v573, v628 = Math.sqrt(v583 * v583 / v570 + v627 * v627 / v571 + v585 * v585 / v572), v628 < v629 - 0.000001 && v628 > 1e-9 && (v613 = v629 / v628, v583 *= v613, v584 = v573 + v627 * v613, v585 *= v613, v553 = v583 - v580, v554 = v584 - v581, v555 = v585 - v582, v530 = Math.sqrt(v553 * v553 + v554 * v554 + v555 * v555), v530 > 1e-9 && (v583 = v580 + v553 / v530 * v531, v584 = v581 + v554 / v530 * v531, v585 = v582 + v555 / v530 * v531)), v276._pu++);
      }
      v625 = {
        x: v583,
        y: v584,
        z: v585
      };
      if (v566 && v531 > 1e-9) try {
        v626 = v566(v625), v626 && v626 !== v625 && v566(v624) === v624 && (v553 = v626.x - v580, v554 = v626.y - v581, v555 = v626.z - v582, v530 = Math.sqrt(v553 * v553 + v554 * v554 + v555 * v555), v530 > 1e-9 && (v625 = {
          x: v580 + v553 / v530 * v531,
          y: v581 + v554 / v530 * v531,
          z: v582 + v555 / v530 * v531
        }, v276._nk++));
      } catch (v635) {}
      v531 > 1e-9 && (v587 = (v625.x - v580) / v531, v588 = (v625.y - v581) / v531, v589 = (v625.z - v582) / v531, v590 = true);
      v527 = v625.x - v624.x, v528 = v625.y - v624.y, v529 = v625.z - v624.z, v631 = v527 * v527 + v528 * v528 + v529 * v529;
      if (v631 > v586) v586 = v631;
      v580 = v625.x, v581 = v625.y, v582 = v625.z, v579[v515] = v625;
    }
    if (!(v586 > 1e-12)) return v501;
    v276._t++;
    try {
      v579._pre = v501._pre || v501;
    } catch (v636) {}
    return v579;
  }
  function v316(v637) {
    if (!v275.enabled || !v275.samples.length || !v637 || v637.length < 2) return v637;
    var v638 = v294();
    if (!v638 || !v638.n) return v637;
    var v639 = v637.length,
      v640,
      v641,
      v642 = v638.mn,
      v643 = v638.mx,
      v644 = false;
    for (v640 = 0; v640 < v639; v640++) {
      v641 = v637[v640];
      if (v641.x >= v642[0] && v641.x <= v643[0] && v641.y >= v642[1] && v641.y <= v643[1] && v641.z >= v642[2] && v641.z <= v643[2]) {
        v644 = true;
        break;
      }
    }
    if (!v644) return v637;
    v303.length < v639 * 4 && (v303 = new Float64Array(v639 * 4 + 128), v304 = new Float64Array(v639 * 3 + 96), v305 = new Float64Array(v639 + 32), v306 = new Float64Array(v639 + 32), v307 = new Int32Array(v639 + 32));
    if (v275.grain && v275.surf && v321 && v321.flow && v321.flow.DF) return v315(v637, v638, v321.flow);
    var v645 = v275.cell,
      v646 = v638.map,
      v647 = v638.V,
      v648 = v639 - 1,
      v649 = false,
      v650 = v303,
      v651 = v304,
      v652 = v637[0].x,
      v653 = v637[0].y,
      v654 = v637[0].z,
      v655 = v639,
      v656 = 0,
      v657 = 0,
      v658,
      v659,
      v660,
      v661,
      v662;
    for (v640 = 1; v640 < v639; v640++) {
      v641 = v637[v640], v659 = v641.x - v652, v660 = v641.y - v653, v661 = v641.z - v654, v658 = Math.sqrt(v659 * v659 + v660 * v660 + v661 * v661), v658 > 1e-9 ? (v650[v640 * 4] = v659 / v658, v650[v640 * 4 + 1] = v660 / v658, v650[v640 * 4 + 2] = v661 / v658) : (v650[v640 * 4] = 0, v650[v640 * 4 + 1] = -1, v650[v640 * 4 + 2] = 0), v650[v640 * 4 + 3] = v658, v657 += v658, v652 = v641.x, v653 = v641.y, v654 = v641.z;
    }
    var v663 = v657 > 0 ? Math.round(v275.flowSmooth / (v657 / v648)) : 1;
    if (!(v663 >= 1)) v663 = 1;else {
      if (v663 > 16) v663 = 16;
    }
    var v664 = Math.max(0, v275.tolFrom) * v308,
      v665 = Math.max(v664 + 0.001, v275.tolFull * v308),
      v666,
      v667,
      v668,
      v669,
      v670,
      v671,
      v672,
      v673,
      v674,
      v675,
      v676,
      v677,
      v678,
      v679,
      v680,
      v681,
      v682,
      v683,
      v684,
      v685,
      v686,
      v687,
      v688,
      v689,
      v690,
      v691,
      v692,
      v693 = v275.grain && v321 && v321.flow ? v321.flow : null,
      v694 = null,
      v695,
      v696,
      v697,
      v698,
      v699,
      v700,
      v701,
      v702,
      v703 = Math.max(0, v275.flowReach | 0),
      v704 = v305,
      v705 = v275.anchor && v321 && v321.flow && v321.flow.GA ? v321.flow : null,
      v706 = Math.cos(v664),
      v707 = Math.cos(v275.flowOwn * v308),
      v708 = Math.cos(v275.flowFinger * v308),
      v709 = 0.45;
    v693 && (v694 = v302(), v709 = (v694 ? v694.cy : 0.15) + 0.3);
    for (v640 = 1; v640 < v639; v640++) {
      v651[v640 * 3] = 0, v651[v640 * 3 + 1] = 0, v651[v640 * 3 + 2] = 0, v704[v640] = 0;
      if (!(v650[v640 * 4 + 3] > 1e-9)) continue;
      v641 = v637[v640], v668 = v637[v640 - 1], v669 = Math.floor((v641.x + v668.x) * 0.5 / v645) + v289, v670 = Math.floor((v641.y + v668.y) * 0.5 / v645) + v289, v671 = Math.floor((v641.z + v668.z) * 0.5 / v645) + v289;
      if (v669 < 0 || v670 < 0 || v671 < 0 || v669 >= v290 || v670 >= v290 || v671 >= v290) continue;
      v672 = v646.get(v669 + v290 * (v670 + v290 * v671));
      if (v672 === undefined) continue;
      v672 *= 3, v673 = v647[v672], v674 = v647[v672 + 1], v675 = v647[v672 + 2], v676 = Math.sqrt(v673 * v673 + v674 * v674 + v675 * v675), v677 = v676;
      if (!(v677 > 0.01)) continue;
      v678 = v640 / v648;
      if (v678 < v275.gripFrom) v677 *= v678 / v275.gripFrom;
      if (v677 > 1) v677 = 1;
      if (v705 && v275.flyOnly) {
        v677 *= 1 - v312(v705, (v641.x + v668.x) * 0.5, (v641.y + v668.y) * 0.5, (v641.z + v668.z) * 0.5);
        if (!(v677 > 0.01)) continue;
      }
      v704[v640] = v677;
      if (v705 && v275.pullIn > 0 && v312(v705, v641.x, v641.y, v641.z) < 0.5) {
        v649 = true;
        if (v640 < v655) v655 = v640;
        if (v640 > v656) v656 = v640;
      }
      v666 = v637[v640 - 1 - v663 < 0 ? 0 : v640 - 1 - v663], v667 = v637[v640 + v663 > v648 ? v648 : v640 + v663], v690 = v650[v640 * 4], v691 = v650[v640 * 4 + 1], v692 = v650[v640 * 4 + 2], v659 = v667.x - v666.x, v660 = v667.y - v666.y, v661 = v667.z - v666.z, v662 = Math.sqrt(v659 * v659 + v660 * v660 + v661 * v661);
      v662 > 1e-9 ? (v659 /= v662, v660 /= v662, v661 /= v662, v682 = v659 * v690 + v660 * v691 + v661 * v692) : (v659 = v690, v660 = v691, v661 = v692, v682 = 1);
      v679 = v641.x - v666.x, v680 = v641.y - v666.y, v681 = v641.z - v666.z, v689 = Math.sqrt(v679 * v679 + v680 * v680 + v681 * v681);
      v689 > 1e-9 && (v683 = (v679 * v690 + v680 * v691 + v681 * v692) / v689, v683 > v682 && (v682 = v683, v659 = v679 / v689, v660 = v680 / v689, v661 = v681 / v689));
      v679 = v667.x - v668.x, v680 = v667.y - v668.y, v681 = v667.z - v668.z, v689 = Math.sqrt(v679 * v679 + v680 * v680 + v681 * v681);
      v689 > 1e-9 && (v683 = (v679 * v690 + v680 * v691 + v681 * v692) / v689, v683 > v682 && (v682 = v683, v659 = v679 / v689, v660 = v680 / v689, v661 = v681 / v689));
      v679 = v673 / v676, v680 = v674 / v676, v681 = v675 / v676;
      if (v693) {
        v697 = (v641.x + v668.x) * 0.5, v698 = (v641.y + v668.y) * 0.5, v699 = (v641.z + v668.z) * 0.5, v669 = Math.floor((v697 - v693.x0) * v693.inv), v670 = Math.floor((v698 - v693.y0) * v693.inv), v671 = Math.floor((v699 - v693.z0) * v693.inv);
        if (v669 >= 0 && v670 >= 0 && v671 >= 0 && v669 < v693.nx && v670 < v693.ny && v671 < v693.nz) {
          v700 = v669 + v693.nx * (v670 + v693.ny * v671), v701 = v693.GN[v700], v702 = v693.GM[v700];
          if (v701 >= v693.dense && v702 >= 0.85 * v701 && v693.GX[v700] * v659 + v693.GY[v700] * v660 + v693.GZ[v700] * v661 >= v706 * v702) continue;
        }
        v695 = v314(v693, v697, v698, v699, v659, v660, v661, v679, v680, v681, v707, v708);
        if (v695 === 0) for (v696 = 1; v696 <= v703; v696++) {
          v686 = -v697, v687 = v698 < v709 ? 0 : v709 - v698, v688 = -v699, v689 = Math.sqrt(v686 * v686 + v687 * v687 + v688 * v688);
          if (!(v689 > 0.000001)) break;
          v697 += v686 / v689 * v693.fc, v698 += v687 / v689 * v693.fc, v699 += v688 / v689 * v693.fc, v695 = v314(v693, v697, v698, v699, v659, v660, v661, v679, v680, v681, v707, v708);
          if (v695 !== 0) {
            if (v695 > 0) v695 = 4;
            break;
          }
        }
        if (v695 < 0) {
          v276._tk++;
          continue;
        }
        if (v695 === 0) v276._tf++;else {
          v679 = v313[0], v680 = v313[1], v681 = v313[2];
          if (v695 === 1) v276._to++;else {
            if (v695 === 2) v276._ts++;else {
              if (v695 === 3) v276._ta++;else v276._tr++;
            }
          }
        }
      }
      v682 = v659 * v679 + v660 * v680 + v661 * v681;
      if (v682 > 1) v682 = 1;else {
        if (v682 < -1) v682 = -1;
      }
      v683 = Math.acos(v682);
      if (v683 <= v664) continue;
      v684 = v683 >= v665 ? 1 : (v683 - v664) / (v665 - v664);
      if (v684 < 1) v684 = v684 * v684 * (3 - 2 * v684);
      v685 = v683 * v684 * v677;
      if (v685 < 0.003) continue;
      v686 = v660 * v681 - v661 * v680, v687 = v661 * v679 - v659 * v681, v688 = v659 * v680 - v660 * v679, v689 = Math.sqrt(v686 * v686 + v687 * v687 + v688 * v688);
      if (v689 < 0.0001) {
        Math.abs(v659) < 0.9 ? (v686 = 0, v687 = v661, v688 = -v660) : (v686 = -v661, v687 = 0, v688 = v659);
        v689 = Math.sqrt(v686 * v686 + v687 * v687 + v688 * v688);
        if (!(v689 > 1e-9)) continue;
      }
      v685 /= v689, v651[v640 * 3] = v686 * v685, v651[v640 * 3 + 1] = v687 * v685, v651[v640 * 3 + 2] = v688 * v685, v649 = true;
      if (v640 < v655) v655 = v640;
      if (v640 > v656) v656 = v640;
    }
    if (!v649) return v637;
    var v710 = Math.max(1, v655 - 1),
      v711 = Math.min(v648, v656 + 1),
      v712,
      v713,
      v714,
      v715,
      v716,
      v717,
      v718;
    v718 = (v710 > 1 ? v710 - 1 : v710) * 3, v712 = v651[v718], v713 = v651[v718 + 1], v714 = v651[v718 + 2];
    for (v640 = v710; v640 <= v711; v640++) {
      v718 = v640 * 3, v715 = v651[v718], v716 = v651[v718 + 1], v717 = v651[v718 + 2], v640 < v648 ? (v651[v718] = (v712 + 2 * v715 + v651[v718 + 3]) * 0.25, v651[v718 + 1] = (v713 + 2 * v716 + v651[v718 + 4]) * 0.25, v651[v718 + 2] = (v714 + 2 * v717 + v651[v718 + 5]) * 0.25) : (v651[v718] = (v712 + 3 * v715) * 0.25, v651[v718 + 1] = (v713 + 3 * v716) * 0.25, v651[v718 + 2] = (v714 + 3 * v717) * 0.25), v712 = v715, v713 = v716, v714 = v717;
    }
    var v719 = new Array(v639),
      v720 = v275.collide ? v302() : null,
      v721 = null,
      v722 = v275.headLift > 0 ? v275.headLift : 1.02,
      v723 = 1,
      v724 = 1,
      v725 = 1,
      v726 = 0,
      v727,
      v728,
      v729,
      v730,
      v731,
      v732,
      v733,
      v734,
      v735,
      v736,
      v737,
      v738,
      v739,
      v740,
      v741,
      v742,
      v743,
      v744,
      v745,
      v746,
      v747;
    if (v720) {
      v723 = v720.a2, v724 = v720.b2, v725 = v720.c2, v726 = v720.cy;
      try {
        v721 = v273.REGROW && typeof v273.REGROW.neckPush === "function" ? v273.REGROW.neckPush : null;
      } catch (v769) {
        v721 = null;
      }
    }
    for (v640 = 0; v640 < v710; v640++) v719[v640] = v637[v640];
    var v748 = v637[v710 - 1].x,
      v749 = v637[v710 - 1].y,
      v750 = v637[v710 - 1].z;
    for (v640 = v710; v640 < v639; v640++) {
      v690 = v650[v640 * 4], v691 = v650[v640 * 4 + 1], v692 = v650[v640 * 4 + 2], v658 = v650[v640 * 4 + 3];
      v640 <= v711 && (v727 = v651[v640 * 3], v728 = v651[v640 * 3 + 1], v729 = v651[v640 * 3 + 2], v685 = Math.sqrt(v727 * v727 + v728 * v728 + v729 * v729), v685 > 0.00001 && (v727 /= v685, v728 /= v685, v729 /= v685, v730 = Math.cos(v685), v731 = Math.sin(v685), v732 = (v727 * v690 + v728 * v691 + v729 * v692) * (1 - v730), v679 = v690 * v730 + (v728 * v692 - v729 * v691) * v731 + v727 * v732, v680 = v691 * v730 + (v729 * v690 - v727 * v692) * v731 + v728 * v732, v681 = v692 * v730 + (v727 * v691 - v728 * v690) * v731 + v729 * v732, v690 = v679, v691 = v680, v692 = v681));
      v733 = v748 + v690 * v658, v734 = v749 + v691 * v658, v735 = v750 + v692 * v658;
      if (v705 && v658 > 1e-9) {
        v738 = v637[v640];
        var v751 = v733 - v738.x,
          v752 = v734 - v738.y,
          v753 = v735 - v738.z,
          v754 = v751 * v751 + v752 * v752 + v753 * v753,
          v755 = 0,
          v756 = 1;
        if (v754 > 1e-10) {
          v755 = v312(v705, v738.x, v738.y, v738.z);
          if (v755 > 0) {
            var v757 = v658 / (v275.anchorLen > 0.01 ? v275.anchorLen : 0.13);
            if (v757 > 0.5) v757 = 0.5;
            v757 *= v755, v743 = v738.x, v744 = v738.y > v709 ? v738.y - v709 : 0, v745 = v738.z, v746 = Math.sqrt(v743 * v743 + v744 * v744 + v745 * v745);
            v746 > 1e-9 ? (v743 /= v746, v744 /= v746, v745 /= v746) : (v743 = 0, v744 = 1, v745 = 0);
            v756 = v312(v705, v733, v734, v735);
            var v758 = v751 * v743 + v752 * v744 + v753 * v745,
              v759 = v757 * (1 - v756),
              v760 = v275.flyOnly ? v757 : v704[v640] > 0.01 ? v759 : Math.max(v759, v757 * 0.5),
              v761 = -(v758 * v743 * v757 + (v751 - v758 * v743) * v760),
              v762 = -(v758 * v744 * v757 + (v752 - v758 * v744) * v760),
              v763 = -(v758 * v745 * v757 + (v753 - v758 * v745) * v760),
              v764 = Math.sqrt(v761 * v761 + v762 * v762 + v763 * v763),
              v765 = 0.5 * v658;
            v764 > v765 && (v761 *= v765 / v764, v762 *= v765 / v764, v763 *= v765 / v764), v679 = v733 + v761 - v748, v680 = v734 + v762 - v749, v681 = v735 + v763 - v750, v662 = Math.sqrt(v679 * v679 + v680 * v680 + v681 * v681), v662 > 1e-9 && (v733 = v748 + v679 / v662 * v658, v734 = v749 + v680 / v662 * v658, v735 = v750 + v681 / v662 * v658, v276._an++);
          }
        }
        if (v275.pullIn > 0 && v704[v640] > 0.01 && v755 < 0.5) {
          v756 = v312(v705, v733, v734, v735);
          if (v756 < 1) {
            v743 = -v733, v744 = v734 > v709 ? v709 - v734 : 0, v745 = -v735, v746 = Math.sqrt(v743 * v743 + v744 * v744 + v745 * v745);
            if (v746 > 0.000001) {
              v743 /= v746, v744 /= v746, v745 /= v746;
              var v766 = false,
                v767;
              for (v767 = 1; v767 <= v703 + 1; v767++) if (v312(v705, v733 + v743 * v705.fc * v767, v734 + v744 * v705.fc * v767, v735 + v745 * v705.fc * v767) >= 0.5) {
                v766 = true;
                break;
              }
              if (v766) {
                var v768 = v275.pullIn * v704[v640] * (1 - v756);
                v679 = (v733 - v748) / v658 + v743 * v768, v680 = (v734 - v749) / v658 + v744 * v768, v681 = (v735 - v750) / v658 + v745 * v768, v662 = Math.sqrt(v679 * v679 + v680 * v680 + v681 * v681), v662 > 1e-9 && (v733 = v748 + v679 / v662 * v658, v734 = v749 + v680 / v662 * v658, v735 = v750 + v681 / v662 * v658, v276._pi++);
              }
            }
          }
        }
      }
      if (v720 && v658 > 1e-9) {
        v738 = v637[v640], v742 = v738.y - v726, v737 = Math.sqrt(v738.x * v738.x / v723 + v742 * v742 / v724 + v738.z * v738.z / v725);
        if (v737 > v722) v737 = v722;
        v742 = v734 - v726, v736 = Math.sqrt(v733 * v733 / v723 + v742 * v742 / v724 + v735 * v735 / v725), v736 < v737 - 0.000001 && (v742 = v749 - v726, v743 = v748 / v723, v744 = v742 / v724, v745 = v750 / v725, v746 = Math.sqrt(v743 * v743 + v744 * v744 + v745 * v745), v746 > 1e-9 && (v743 /= v746, v744 /= v746, v745 /= v746, v747 = v690 * v743 + v691 * v744 + v692 * v745, v747 < 0 && (v679 = v690 - v747 * v743, v680 = v691 - v747 * v744, v681 = v692 - v747 * v745, v662 = Math.sqrt(v679 * v679 + v680 * v680 + v681 * v681), v662 < 0.35 && (v668 = v637[v640 - 1], v679 = (v738.x - v668.x) / v658, v680 = (v738.y - v668.y) / v658, v681 = (v738.z - v668.z) / v658, v747 = v679 * v743 + v680 * v744 + v681 * v745, v747 < 0 && (v679 -= v747 * v743, v680 -= v747 * v744, v681 -= v747 * v745), v662 = Math.sqrt(v679 * v679 + v680 * v680 + v681 * v681)), v662 > 0.001 && (v733 = v748 + v679 / v662 * v658, v734 = v749 + v680 / v662 * v658, v735 = v750 + v681 / v662 * v658))), v742 = v734 - v726, v736 = Math.sqrt(v733 * v733 / v723 + v742 * v742 / v724 + v735 * v735 / v725), v736 < v737 - 0.000001 && v736 > 1e-9 && (v739 = v737 / v736, v733 *= v739, v734 = v726 + v742 * v739, v735 *= v739, v679 = v733 - v748, v680 = v734 - v749, v681 = v735 - v750, v662 = Math.sqrt(v679 * v679 + v680 * v680 + v681 * v681), v662 > 1e-9 && (v733 = v748 + v679 / v662 * v658, v734 = v749 + v680 / v662 * v658, v735 = v750 + v681 / v662 * v658)), v276._pu++);
      }
      v740 = {
        x: v733,
        y: v734,
        z: v735
      };
      if (v721 && v658 > 1e-9) try {
        v741 = v721(v740), v741 && v741 !== v740 && v721(v637[v640]) === v637[v640] && (v679 = v741.x - v748, v680 = v741.y - v749, v681 = v741.z - v750, v662 = Math.sqrt(v679 * v679 + v680 * v680 + v681 * v681), v662 > 1e-9 && (v740 = {
          x: v748 + v679 / v662 * v658,
          y: v749 + v680 / v662 * v658,
          z: v750 + v681 / v662 * v658
        }, v276._nk++));
      } catch (v770) {}
      v748 = v740.x, v749 = v740.y, v750 = v740.z, v719[v640] = v740;
    }
    v276._t++;
    try {
      v719._pre = v637._pre || v637;
    } catch (v771) {}
    return v719;
  }
  v275._apply = v316, v275._cell = function (v772, v773, v774) {
    var v775 = v294();
    if (!v775) return null;
    var v776 = v775.map.get(Math.floor(v772 / v275.cell) + v289 + v290 * (Math.floor(v773 / v275.cell) + v289 + v290 * (Math.floor(v774 / v275.cell) + v289)));
    return v776 === undefined ? null : [v775.V[v776 * 3], v775.V[v776 * 3 + 1], v775.V[v776 * 3 + 2]];
  }, v275._dist = function (v777, v778, v779) {
    return v321 && v321.flow && v321.flow.DF ? v309(v321.flow.DF, v777, v778, v779) : null;
  };
  function v317(v780, v781) {
    if (!v275.enabled || !v275.sweep || !v275.sweeps.length || !v780 || v780.length < 2) return v780;
    var v782 = v298();
    if (!v782 || !v782.n) return v780;
    var v783 = v780.length,
      v784,
      v785,
      v786,
      v787 = v782.mn,
      v788 = v782.mx,
      v789 = false;
    if (!v781 || v781.length !== v783) v781 = v780;
    for (v784 = 0; v784 < v783; v784++) {
      v785 = v781[v784];
      if (v785.x >= v787[0] && v785.x <= v788[0] && v785.y >= v787[1] && v785.y <= v788[1] && v785.z >= v787[2] && v785.z <= v788[2]) {
        v789 = true;
        break;
      }
    }
    if (!v789) return v780;
    v303.length < v783 * 4 && (v303 = new Float64Array(v783 * 4 + 128), v304 = new Float64Array(v783 * 3 + 96), v305 = new Float64Array(v783 + 32), v306 = new Float64Array(v783 + 32), v307 = new Int32Array(v783 + 32));
    var v790 = v275.cell,
      v791 = v782.map,
      v792 = v782.V,
      v793 = v783 - 1,
      v794 = v303,
      v795 = v304,
      v796 = false,
      v797 = v783,
      v798 = 0,
      v799 = 0,
      v800 = v780[0].x,
      v801 = v780[0].y,
      v802 = v780[0].z,
      v803,
      v804,
      v805,
      v806,
      v807;
    for (v784 = 1; v784 < v783; v784++) {
      v785 = v780[v784], v803 = v785.x - v800, v804 = v785.y - v801, v805 = v785.z - v802, v807 = Math.sqrt(v803 * v803 + v804 * v804 + v805 * v805), v807 > 1e-9 ? (v794[v784 * 4] = v803 / v807, v794[v784 * 4 + 1] = v804 / v807, v794[v784 * 4 + 2] = v805 / v807) : (v794[v784 * 4] = 0, v794[v784 * 4 + 1] = -1, v794[v784 * 4 + 2] = 0), v794[v784 * 4 + 3] = v807, v799 += v807, v800 = v785.x, v801 = v785.y, v802 = v785.z;
    }
    var v808 = v799 > 0 ? Math.round(v275.flowSmooth / (v799 / v793)) : 1;
    if (!(v808 >= 1)) v808 = 1;else {
      if (v808 > 16) v808 = 16;
    }
    var v809 = v302(),
      v810 = 1,
      v811 = 1,
      v812 = 1,
      v813 = 0,
      v814 = v275.wrapNear,
      v815 = Math.max(v275.wrapFar, v814 + 0.001),
      v816 = v275.sweepGrip,
      v817 = Math.max(0, v275.sweepTol) * v308;
    v809 && (v810 = v809.a2, v811 = v809.b2, v812 = v809.c2, v813 = v809.cy);
    var v818, v819, v820, v821, v822, v823, v824, v825, v826, v827, v828, v829, v830, v831, v832, v833, v834, v835, v836, v837, v838, v839, v840, v841, v842, v843, v844, v845, v846, v847, v848, v849, v850;
    for (v784 = 1; v784 < v783; v784++) {
      v795[v784 * 3] = 0, v795[v784 * 3 + 1] = 0, v795[v784 * 3 + 2] = 0;
      if (!(v794[v784 * 4 + 3] > 1e-9)) continue;
      v785 = v781[v784], v786 = v781[v784 - 1], v818 = Math.floor((v785.x + v786.x) * 0.5 / v790) + v289, v819 = Math.floor((v785.y + v786.y) * 0.5 / v790) + v289, v820 = Math.floor((v785.z + v786.z) * 0.5 / v790) + v289;
      if (v818 < 0 || v819 < 0 || v820 < 0 || v818 >= v290 || v819 >= v290 || v820 >= v290) continue;
      v821 = v791.get(v818 + v290 * (v819 + v290 * v820));
      if (v821 === undefined) continue;
      v821 *= 3, v822 = v792[v821], v823 = v792[v821 + 1], v824 = v792[v821 + 2], v825 = Math.sqrt(v822 * v822 + v823 * v823 + v824 * v824), v826 = v825;
      if (!(v826 > 0.01)) continue;
      v827 = v784 / v793;
      if (v816 > 0 && v827 < v816) v826 *= v827 / v816;
      if (v826 > 1) v826 = 1;
      v828 = v822 / v825, v829 = v823 / v825, v830 = v824 / v825, v785 = v780[v784], v786 = v780[v784 - 1];
      if (v809 && v275.sweepWrap) {
        v848 = (v785.x + v786.x) * 0.5, v849 = (v785.y + v786.y) * 0.5 - v813, v850 = (v785.z + v786.z) * 0.5, v845 = Math.sqrt(v848 * v848 / v810 + v849 * v849 / v811 + v850 * v850 / v812);
        if (v845 < v815) {
          v840 = v848 / v810, v841 = v849 / v811, v842 = v850 / v812, v843 = Math.sqrt(v840 * v840 + v841 * v841 + v842 * v842);
          if (v843 > 1e-9) {
            v840 /= v843, v841 /= v843, v842 /= v843, v847 = v845 <= v814 ? 1 : (v815 - v845) / (v815 - v814), v844 = (v828 * v840 + v829 * v841 + v830 * v842) * v847, v803 = v828 - v844 * v840, v804 = v829 - v844 * v841, v805 = v830 - v844 * v842, v806 = Math.sqrt(v803 * v803 + v804 * v804 + v805 * v805);
            if (v806 < 0.2) continue;
            v828 = v803 / v806, v829 = v804 / v806, v830 = v805 / v806;
          }
        }
      }
      v831 = v780[v784 - 1 - v808 < 0 ? 0 : v784 - 1 - v808], v832 = v780[v784 + v808 > v793 ? v793 : v784 + v808], v803 = v832.x - v831.x, v804 = v832.y - v831.y, v805 = v832.z - v831.z, v806 = Math.sqrt(v803 * v803 + v804 * v804 + v805 * v805);
      v806 > 1e-9 ? (v803 /= v806, v804 /= v806, v805 /= v806) : (v803 = v794[v784 * 4], v804 = v794[v784 * 4 + 1], v805 = v794[v784 * 4 + 2]);
      v833 = v803 * v828 + v804 * v829 + v805 * v830;
      if (v833 > 1) v833 = 1;else {
        if (v833 < -1) v833 = -1;
      }
      v834 = Math.acos(v833);
      if (v834 <= v817) continue;
      v835 = v834 * v826;
      if (v835 < 0.003) continue;
      v836 = v804 * v830 - v805 * v829, v837 = v805 * v828 - v803 * v830, v838 = v803 * v829 - v804 * v828, v839 = Math.sqrt(v836 * v836 + v837 * v837 + v838 * v838);
      if (v839 < 0.0001) {
        v840 = v785.x, v841 = v809 ? v785.y - v813 : 0, v842 = v785.z, v836 = v804 * v842 - v805 * v841, v837 = v805 * v840 - v803 * v842, v838 = v803 * v841 - v804 * v840, v839 = Math.sqrt(v836 * v836 + v837 * v837 + v838 * v838);
        v839 < 0.000001 && (Math.abs(v803) < 0.9 ? (v836 = 0, v837 = v805, v838 = -v804) : (v836 = -v805, v837 = 0, v838 = v803), v839 = Math.sqrt(v836 * v836 + v837 * v837 + v838 * v838));
        if (!(v839 > 1e-9)) continue;
      }
      v835 /= v839, v795[v784 * 3] = v836 * v835, v795[v784 * 3 + 1] = v837 * v835, v795[v784 * 3 + 2] = v838 * v835, v796 = true;
      if (v784 < v797) v797 = v784;
      if (v784 > v798) v798 = v784;
    }
    if (!v796) return v780;
    var v851 = Math.max(1, v797 - 1),
      v852 = Math.min(v793, v798 + 1),
      v853,
      v854,
      v855,
      v856,
      v857,
      v858,
      v859;
    v859 = (v851 > 1 ? v851 - 1 : v851) * 3, v853 = v795[v859], v854 = v795[v859 + 1], v855 = v795[v859 + 2];
    for (v784 = v851; v784 <= v852; v784++) {
      v859 = v784 * 3, v856 = v795[v859], v857 = v795[v859 + 1], v858 = v795[v859 + 2], v784 < v793 ? (v795[v859] = (v853 + 2 * v856 + v795[v859 + 3]) * 0.25, v795[v859 + 1] = (v854 + 2 * v857 + v795[v859 + 4]) * 0.25, v795[v859 + 2] = (v855 + 2 * v858 + v795[v859 + 5]) * 0.25) : (v795[v859] = (v853 + 3 * v856) * 0.25, v795[v859 + 1] = (v854 + 3 * v857) * 0.25, v795[v859 + 2] = (v855 + 3 * v858) * 0.25), v853 = v856, v854 = v857, v855 = v858;
    }
    var v860 = new Array(v783),
      v861 = v275.collide && v809 ? v809 : null,
      v862 = null,
      v863 = v275.headLift > 0 ? v275.headLift : 1.02,
      v864,
      v865,
      v866,
      v867,
      v868,
      v869,
      v870,
      v871,
      v872,
      v873,
      v874,
      v875,
      v876,
      v877,
      v878,
      v879;
    if (v861) try {
      v862 = v273.REGROW && typeof v273.REGROW.neckPush === "function" ? v273.REGROW.neckPush : null;
    } catch (v883) {
      v862 = null;
    }
    for (v784 = 0; v784 < v851; v784++) v860[v784] = v780[v784];
    var v880 = v780[v851 - 1].x,
      v881 = v780[v851 - 1].y,
      v882 = v780[v851 - 1].z;
    for (v784 = v851; v784 < v783; v784++) {
      v864 = v794[v784 * 4], v865 = v794[v784 * 4 + 1], v866 = v794[v784 * 4 + 2], v807 = v794[v784 * 4 + 3];
      v784 <= v852 && (v867 = v795[v784 * 3], v868 = v795[v784 * 3 + 1], v869 = v795[v784 * 3 + 2], v835 = Math.sqrt(v867 * v867 + v868 * v868 + v869 * v869), v835 > 0.00001 && (v867 /= v835, v868 /= v835, v869 /= v835, v870 = Math.cos(v835), v871 = Math.sin(v835), v872 = (v867 * v864 + v868 * v865 + v869 * v866) * (1 - v870), v828 = v864 * v870 + (v868 * v866 - v869 * v865) * v871 + v867 * v872, v829 = v865 * v870 + (v869 * v864 - v867 * v866) * v871 + v868 * v872, v830 = v866 * v870 + (v867 * v865 - v868 * v864) * v871 + v869 * v872, v864 = v828, v865 = v829, v866 = v830));
      v873 = v880 + v864 * v807, v874 = v881 + v865 * v807, v875 = v882 + v866 * v807;
      if (v861 && v807 > 1e-9) {
        v877 = v780[v784], v846 = v877.y - v813, v876 = Math.sqrt(v877.x * v877.x / v810 + v846 * v846 / v811 + v877.z * v877.z / v812);
        if (v876 > v863) v876 = v863;
        v846 = v874 - v813, v845 = Math.sqrt(v873 * v873 / v810 + v846 * v846 / v811 + v875 * v875 / v812), v845 < v876 - 0.000001 && (v846 = v881 - v813, v840 = v880 / v810, v841 = v846 / v811, v842 = v882 / v812, v843 = Math.sqrt(v840 * v840 + v841 * v841 + v842 * v842), v843 > 1e-9 && (v840 /= v843, v841 /= v843, v842 /= v843, v844 = v864 * v840 + v865 * v841 + v866 * v842, v844 < 0 && (v828 = v864 - v844 * v840, v829 = v865 - v844 * v841, v830 = v866 - v844 * v842, v806 = Math.sqrt(v828 * v828 + v829 * v829 + v830 * v830), v806 > 0.001 && (v873 = v880 + v828 / v806 * v807, v874 = v881 + v829 / v806 * v807, v875 = v882 + v830 / v806 * v807))), v846 = v874 - v813, v845 = Math.sqrt(v873 * v873 / v810 + v846 * v846 / v811 + v875 * v875 / v812), v845 < v876 - 0.000001 && v845 > 1e-9 && (v847 = v876 / v845, v873 *= v847, v874 = v813 + v846 * v847, v875 *= v847, v828 = v873 - v880, v829 = v874 - v881, v830 = v875 - v882, v806 = Math.sqrt(v828 * v828 + v829 * v829 + v830 * v830), v806 > 1e-9 && (v873 = v880 + v828 / v806 * v807, v874 = v881 + v829 / v806 * v807, v875 = v882 + v830 / v806 * v807)), v276._swp++);
      }
      v878 = {
        x: v873,
        y: v874,
        z: v875
      };
      if (v862 && v807 > 1e-9) try {
        v879 = v862(v878);
        if (v879 && v879 !== v878 && v862(v780[v784]) === v780[v784]) {
          v828 = v879.x - v880, v829 = v879.y - v881, v830 = v879.z - v882, v806 = Math.sqrt(v828 * v828 + v829 * v829 + v830 * v830);
          if (v806 > 1e-9) v878 = {
            x: v880 + v828 / v806 * v807,
            y: v881 + v829 / v806 * v807,
            z: v882 + v830 / v806 * v807
          };
        }
      } catch (v884) {}
      v880 = v878.x, v881 = v878.y, v882 = v878.z, v860[v784] = v878;
    }
    v276._sw++;
    try {
      v860._pre = v780._pre || v781;
    } catch (v885) {}
    return v860;
  }
  v275._sweep = v317, v275._apply = function (v886) {
    if (!v275.samples.length && !v275.sweeps.length) return v886;
    var v887 = v886;
    if (v275.samples.length) try {
      v887 = v316(v886);
    } catch (v888) {
      v276.err = String(v888 && v888.message || v888), v887 = v886;
    }
    if (v275.sweeps.length) try {
      v887 = v317(v887, v886);
    } catch (v889) {
      v276.err = String(v889 && v889.message || v889);
    }
    return v887;
  };
  function v318() {
    var v890 = null;
    try {
      v890 = state.hair3Dneutral;
    } catch (v891) {}
    v890 !== v279 && (v279 = v890, (v275.samples.length || v275.sweeps.length) && (v275.samples.length = 0, v275.sweeps.length = 0, v277++, v288++, v363()));
  }
  v275._beforeCompute = function () {
    try {
      v318(), v276._t = 0, v276._pu = 0, v276._nk = 0, v276._an = 0, v276._pi = 0, v276._fl = 0, v276._up = 0, v276._cl = 0, v276._to = v276._ts = v276._ta = v276._tr = v276._tf = v276._tk = 0, v276._sw = 0, v276._swp = 0;
    } catch (v892) {}
    return v280();
  }, v275._afterCompute = function (v893, v894, v895, v896) {
    var v897 = [v894, v895];
    try {
      if (v275.grain && v275.samples.length && v893 && v893.length && !v897[0] && !(v897[1] > 1) && v279) {
        var v898 = v321;
        v323(v893, Math.max(1, Math.ceil(v893.length / v275.pickStrands)), v279);
        if (v898 && v898 !== v321 && typeof ADJ_CACHE !== "undefined" && ADJ_CACHE.bump) ADJ_CACHE.bump();
      }
    } catch (v899) {}
    if (v276._sw > 0) {
      v276.swept = v276._sw, v276.sweptPush = v276._swp;
      if (!(v276._t > 0)) v276.ms = v280() - v896;
    } else !v275.sweeps.length && (v276.swept = 0, v276.sweptPush = 0);
    return (v276._t > 0 || v276._tk > 0) && (v276.touched = v276._t, v276.ms = v280() - v896, v276.pushed = v276._pu, v276.neck = v276._nk, v276.anch = v276._an, v276.pin = v276._pi, v276.fly = v276._fl, v276.up = v276._up, v276.clamp = v276._cl, v276.tOwn = v276._to, v276.tSide = v276._ts, v276.tAll = v276._ta, v276.tReach = v276._tr, v276.tFinger = v276._tf, v276.tSkip = v276._tk), v893;
  }, v275._sigTail = function () {
    return "|cb" + v277;
  };
  function v319() {
    try {
      if (typeof ADJ_CACHE !== "undefined" && ADJ_CACHE.bump) ADJ_CACHE.bump();
    } catch (v900) {}
    try {
      if (v281() === "adjust" && typeof renderAdjustFrame === "function") renderAdjustFrame();
    } catch (v901) {}
  }
  v275.refresh = function () {
    v277++, v288++, v319(), v363();
  }, v275.clear = function () {
    if (!v275.samples.length && !v275.sweeps.length) return;
    v275.samples.length = 0, v275.sweeps.length = 0, v277++, v288++, v276.strokes = 0, v276.sweepStrokes = 0, v319(), v363();
  }, v275.clearSweeps = function () {
    if (!v275.sweeps.length) return;
    v275.sweeps.length = 0, v277++, v288++, v276.sweepStrokes = 0, v319(), v363();
  }, v275.undo = function () {
    var v902 = v275.samples.length ? v275.samples[v275.samples.length - 1].g : -1,
      v903 = v275.sweeps.length ? v275.sweeps[v275.sweeps.length - 1].g : -1;
    if (v902 < 0 && v903 < 0) return;
    var v904 = v903 > v902 ? v275.sweeps : v275.samples,
      v905 = Math.max(v902, v903);
    while (v904.length && v904[v904.length - 1].g === v905) v904.pop();
    v277++, v288++, v319(), v363();
  };
  function v320() {
    var v906 = v282(),
      v907 = null;
    if (!v906) return null;
    return v906.headGroup.traverse(function (v908) {
      if (!v907 && (v908.isLineSegments || v908.isLine) && v908.geometry) v907 = v908;
    }), v907 || v906.headGroup;
  }
  var v321 = null;
  function v322(v909, v910, v911, v912, v913) {
    var v914 = v913,
      v915 = v913 * 1.41421356,
      v916 = v913 * 1.7320508,
      v917 = v910 * v911,
      v918,
      v919,
      v920,
      v921,
      v922,
      v923,
      v924,
      v925,
      v926,
      v927,
      v928;
    for (v918 = 0; v918 < 2; v918++) {
      v919 = v918 ? -1 : 1;
      for (v922 = v918 ? v912 - 2 : 1; v922 >= 1 && v922 <= v912 - 2; v922 += v919) for (v921 = v918 ? v911 - 2 : 1; v921 >= 1 && v921 <= v911 - 2; v921 += v919) {
        v926 = v910 * (v921 + v911 * v922), v927 = v926 - v919 * v917, v928 = v926 - v919 * v910;
        for (v920 = v918 ? v910 - 2 : 1; v920 >= 1 && v920 <= v910 - 2; v920 += v919) {
          v923 = v926 + v920, v924 = v909[v923];
          if (v924 === 0) continue;
          v923 = v927 + v920, v925 = v909[v923] + v914;
          if (v925 < v924) v924 = v925;
          v925 = v909[v923 - 1] + v915;
          if (v925 < v924) v924 = v925;
          v925 = v909[v923 + 1] + v915;
          if (v925 < v924) v924 = v925;
          v925 = v909[v923 - v910] + v915;
          if (v925 < v924) v924 = v925;
          v925 = v909[v923 + v910] + v915;
          if (v925 < v924) v924 = v925;
          v925 = v909[v923 - v910 - 1] + v916;
          if (v925 < v924) v924 = v925;
          v925 = v909[v923 - v910 + 1] + v916;
          if (v925 < v924) v924 = v925;
          v925 = v909[v923 + v910 - 1] + v916;
          if (v925 < v924) v924 = v925;
          v925 = v909[v923 + v910 + 1] + v916;
          if (v925 < v924) v924 = v925;
          v923 = v928 + v920, v925 = v909[v923] + v914;
          if (v925 < v924) v924 = v925;
          v925 = v909[v923 - 1] + v915;
          if (v925 < v924) v924 = v925;
          v925 = v909[v923 + 1] + v915;
          if (v925 < v924) v924 = v925;
          v925 = v909[v926 + v920 - v919] + v914;
          if (v925 < v924) v924 = v925;
          v909[v926 + v920] = v924;
        }
      }
    }
  }
  function v323(v929, v930, v931) {
    var v932 = v280(),
      v933,
      v934,
      v935,
      v936,
      v937,
      v938 = 0,
      v939 = Math.max(1, Math.floor(v929.length / 97));
    for (v933 = 0; v933 < v929.length; v933 += v939) {
      v935 = v929[v933].pts;
      if (!v935 || !v935.length) continue;
      if (v935._pre && v935._pre.length === v935.length) v935 = v935._pre;
      v936 = v935[v935.length - 1], v938 += v936.x * 1.3 + v936.y * 2.1 + v936.z * 3.7 + v935.length;
    }
    var v940 = v929.length + ":" + v930 + ":" + v938.toFixed(4) + ":" + v275.flowCell + ":" + v275.flowSmooth + ":" + v275.flowMin + ":" + v275.flowNear + ":" + v275.flowDense + ":" + (v275.surf ? v275.surfThr + "/" + v275.surfNbr + "/" + v275.surfCore + "/" + v275.surfHead + "/" + v275.flyFrom + "/" + v275.flyFull : "x");
    if (v321 && v321.fp === v940 && v321.model === v931) return v321.flow;
    v321 && v321.flow && (v277++, v276.flowRebuilt = (v276.flowRebuilt || 0) + 1);
    var v941 = v275.flowCell > 0.01 ? v275.flowCell : 0.07,
      v942 = Infinity,
      v943 = Infinity,
      v944 = Infinity,
      v945 = -Infinity,
      v946 = -Infinity,
      v947 = -Infinity,
      v948 = 0;
    for (v933 = 0; v933 < v929.length; v933 += v930) {
      v935 = v929[v933].pts;
      if (!v935) continue;
      if (v935._pre && v935._pre.length === v935.length) v935 = v935._pre;
      v948++;
      for (v934 = 0; v934 < v935.length; v934 += 2) {
        v936 = v935[v934];
        if (v936.x < v942) v942 = v936.x;
        if (v936.x > v945) v945 = v936.x;
        if (v936.y < v943) v943 = v936.y;
        if (v936.y > v946) v946 = v936.y;
        if (v936.z < v944) v944 = v936.z;
        if (v936.z > v947) v947 = v936.z;
      }
    }
    var v949 = null;
    if (v945 >= v942 && isFinite(v942 + v945 + v943 + v946 + v944 + v947)) {
      var v950 = isFinite(v931.CY) ? v931.CY : 0,
        v951 = 64 * v941;
      v942 = Math.max(v942, -v951) - v941, v945 = Math.min(v945, v951) + v941, v943 = Math.max(v943, v950 - v951) - v941, v946 = Math.min(v946, v950 + v951) + v941, v944 = Math.max(v944, -v951) - v941, v947 = Math.min(v947, v951) + v941;
      var v952 = Math.floor((v945 - v942) / v941) + 1,
        v953 = Math.floor((v946 - v943) / v941) + 1,
        v954 = Math.floor((v947 - v944) / v941) + 1,
        v955 = v952 * v953 * v954;
      if (v952 > 0 && v953 > 0 && v954 > 0) {
        var v956 = new Float32Array(v955),
          v957 = new Float32Array(v955),
          v958 = new Float32Array(v955),
          v959 = new Uint16Array(v955),
          v960 = new Int32Array(v955).fill(-1),
          v961 = 1 / v941,
          v962,
          v963,
          v964,
          v965,
          v966,
          v967,
          v968,
          v969,
          v970,
          v971,
          v972,
          v973,
          v974,
          v975,
          v976,
          v977;
        for (v933 = 0; v933 < v929.length; v933 += v930) {
          v935 = v929[v933].pts;
          if (!v935) continue;
          if (v935._pre && v935._pre.length === v935.length) v935 = v935._pre;
          v937 = v935.length;
          if (v937 < 2) continue;
          v963 = 0, v964 = v937 - 1 < 8 ? v937 - 1 : 8, v965 = v935[0];
          for (v934 = 1; v934 <= v964; v934++) {
            v966 = v935[v934], v963 += Math.sqrt((v966.x - v965.x) * (v966.x - v965.x) + (v966.y - v965.y) * (v966.y - v965.y) + (v966.z - v965.z) * (v966.z - v965.z)), v965 = v966;
          }
          v963 /= v964, v962 = v963 > 0 ? Math.round(v275.flowSmooth / v963) : 1;
          if (!(v962 >= 1)) v962 = 1;else {
            if (v962 > 16) v962 = 16;
          }
          v977 = v963 > 0 ? Math.floor(v941 * 0.8 / v963) : 1;
          if (!(v977 >= 1)) v977 = 1;else {
            if (v977 > 6) v977 = 6;
          }
          for (v934 = 0; v934 < v937; v934 += v977) {
            v936 = v935[v934], v973 = (v936.x - v942) * v961 | 0, v974 = (v936.y - v943) * v961 | 0, v975 = (v936.z - v944) * v961 | 0;
            if (!(v936.x >= v942 && v936.y >= v943 && v936.z >= v944 && v973 < v952 && v974 < v953 && v975 < v954)) continue;
            v976 = v973 + v952 * (v974 + v953 * v975);
            if (v960[v976] === v933) continue;
            v967 = v935[v934 - v962 < 0 ? 0 : v934 - v962], v968 = v935[v934 + v962 >= v937 ? v937 - 1 : v934 + v962], v969 = v968.x - v967.x, v970 = v968.y - v967.y, v971 = v968.z - v967.z, v972 = Math.sqrt(v969 * v969 + v970 * v970 + v971 * v971);
            if (!(v972 > 1e-9)) continue;
            v960[v976] = v933;
            if (v959[v976] < 65535) v959[v976]++;
            v956[v976] += v969 / v972, v957[v976] += v970 / v972, v958[v976] += v971 / v972;
          }
        }
        var v978 = [],
          v979 = 0,
          v980 = 0,
          v981 = 1;
        for (v934 = 0; v934 < v955; v934++) v959[v934] && (v978.push(v959[v934]), v979 += v959[v934]);
        v978.sort(function (v1048, v1049) {
          return v1048 - v1049;
        });
        for (v934 = 0; v934 < v978.length; v934++) {
          v980 += v978[v934];
          if (v980 * 2 >= v979) {
            v981 = v978[v934];
            break;
          }
        }
        var v982 = Math.max(6, Math.round(v275.flowMin * Math.min(1, v948 / 8000))),
          v983 = new Float32Array(v955);
        for (v934 = 0; v934 < v955; v934++) if (v959[v934]) v983[v934] = Math.sqrt(v956[v934] * v956[v934] + v957[v934] * v957[v934] + v958[v934] * v958[v934]);
        var v984 = new Float32Array(v955),
          v985 = new Float32Array(v955),
          v986,
          v987,
          v988,
          v989,
          v990;
        for (v988 = 0; v988 < v954; v988++) for (v987 = 0; v987 < v953; v987++) for (v986 = 0; v986 < v952; v986++) {
          v989 = v986 + v952 * (v987 + v953 * v988), v990 = v959[v989];
          if (v986 > 0) v990 += v959[v989 - 1];
          if (v986 < v952 - 1) v990 += v959[v989 + 1];
          v985[v989] = v990;
        }
        for (v988 = 0; v988 < v954; v988++) for (v987 = 0; v987 < v953; v987++) for (v986 = 0; v986 < v952; v986++) {
          v989 = v986 + v952 * (v987 + v953 * v988), v990 = v985[v989];
          if (v987 > 0) v990 += v985[v989 - v952];
          if (v987 < v953 - 1) v990 += v985[v989 + v952];
          v984[v989] = v990;
        }
        for (v988 = 0; v988 < v954; v988++) for (v987 = 0; v987 < v953; v987++) for (v986 = 0; v986 < v952; v986++) {
          v989 = v986 + v952 * (v987 + v953 * v988), v990 = v984[v989];
          if (v988 > 0) v990 += v984[v989 - v952 * v953];
          if (v988 < v954 - 1) v990 += v984[v989 + v952 * v953];
          v985[v989] = v990;
        }
        var v991 = Math.max(v982, v275.flowNear * v981),
          v992 = null;
        if (v275.surf) {
          var v993 = v941 * 0.5,
            v994 = 1 / v993,
            v995 = v952 * 2,
            v996 = v953 * 2,
            v997 = v954 * 2,
            v998 = v995 * v996 * v997;
          if (v998 > 0 && v998 <= 3000000) {
            var v999 = new Uint16Array(v998),
              v1000 = new Int32Array(v998).fill(-1),
              v1001,
              v1002,
              v1003,
              v1004,
              v1005,
              v1006,
              v1007,
              v1008,
              v1009,
              v1010;
            for (v933 = 0; v933 < v929.length; v933 += v930) {
              v935 = v929[v933].pts;
              if (!v935) continue;
              if (v935._pre && v935._pre.length === v935.length) v935 = v935._pre;
              v937 = v935.length;
              for (v934 = 0; v934 < v937; v934++) {
                v936 = v935[v934], v1001 = 0;
                if (v934 + 1 < v937) {
                  v966 = v935[v934 + 1], v1003 = v966.x - v936.x, v1004 = v966.y - v936.y, v1005 = v966.z - v936.z, v1006 = Math.sqrt(v1003 * v1003 + v1004 * v1004 + v1005 * v1005), v1001 = Math.floor(v1006 / (v993 * 0.9));
                  if (v1001 > 12) v1001 = 12;
                }
                for (v1002 = 0; v1002 <= v1001; v1002++) {
                  v1008 = v1001 ? v936.x + v1003 * v1002 / (v1001 + 1) : v936.x, v1009 = v1001 ? v936.y + v1004 * v1002 / (v1001 + 1) : v936.y, v1010 = v1001 ? v936.z + v1005 * v1002 / (v1001 + 1) : v936.z, v973 = (v1008 - v942) * v994 | 0, v974 = (v1009 - v943) * v994 | 0, v975 = (v1010 - v944) * v994 | 0;
                  if (!(v1008 >= v942 && v1009 >= v943 && v1010 >= v944 && v973 < v995 && v974 < v996 && v975 < v997)) continue;
                  v1007 = v973 + v995 * (v974 + v996 * v975);
                  if (v1000[v1007] === v933) continue;
                  v1000[v1007] = v933;
                  if (v999[v1007] < 65535) v999[v1007]++;
                }
              }
            }
            v1000 = null;
            var v1011 = [],
              v1012 = 0,
              v1013 = 0,
              v1014 = 1;
            for (v934 = 0; v934 < v998; v934++) v999[v934] && (v1011.push(v999[v934]), v1012 += v999[v934]);
            v1011.sort(function (v1050, v1051) {
              return v1050 - v1051;
            });
            for (v934 = 0; v934 < v1011.length; v934++) {
              v1013 += v1011[v934];
              if (v1013 * 2 >= v1012) {
                v1014 = v1011[v934];
                break;
              }
            }
            var v1015 = Math.max(2, Math.round(v275.surfThr * v1014)),
              v1016 = new Uint8Array(v998),
              v1017 = v995 * v996,
              v1018 = 0,
              v1019 = Math.max(0, v275.surfNbr | 0),
              v1020,
              v1021,
              v1022,
              v1023,
              v1024,
              v1025,
              v1026,
              v1027,
              v1028,
              v1029,
              v1030,
              v1031,
              v1032,
              v1033;
            for (v988 = 0; v988 < v997; v988++) for (v987 = 0; v987 < v996; v987++) for (v986 = 0; v986 < v995; v986++) {
              v989 = v986 + v995 * (v987 + v996 * v988);
              if (v999[v989] < 2) continue;
              v1027 = v986 > 2 ? v986 - 2 : 0, v1028 = v986 < v995 - 3 ? v986 + 2 : v995 - 1, v1029 = v987 > 2 ? v987 - 2 : 0, v1030 = v987 < v996 - 3 ? v987 + 2 : v996 - 1, v1031 = v988 > 2 ? v988 - 2 : 0, v1032 = v988 < v997 - 3 ? v988 + 2 : v997 - 1, v1024 = 0, v1025 = 0;
              for (v1023 = v1031; v1023 <= v1032; v1023++) for (v1022 = v1029; v1022 <= v1030; v1022++) {
                v1033 = v995 * (v1022 + v996 * v1023);
                for (v1021 = v1027; v1021 <= v1028; v1021++) {
                  v1026 = v999[v1033 + v1021], v1024 += v1026, v1025 += v1026 * v1026;
                }
              }
              if (v999[v989] * v1024 >= v275.surfThr * v1025) v1016[v989] = 1;
            }
            var v1034 = new Float32Array(v998),
              v1035 = 1000000,
              v1036 = new Uint8Array(v998),
              v1037 = Math.max(1, v275.surfCore | 0),
              v1038 = [],
              v1039,
              v1040,
              v1041 = v302(),
              v1042,
              v1043 = v275.surfHead > 1 ? v275.surfHead : 1.15,
              v1044,
              v1045,
              v1046;
            for (v988 = 0; v988 < v997; v988++) for (v987 = 0; v987 < v996; v987++) for (v986 = 0; v986 < v995; v986++) {
              v989 = v986 + v995 * (v987 + v996 * v988), v1034[v989] = v1035;
              if (!v1016[v989]) continue;
              v1020 = 0;
              for (v1023 = -1; v1023 <= 1; v1023++) {
                if (v988 + v1023 < 0 || v988 + v1023 >= v997) continue;
                for (v1022 = -1; v1022 <= 1; v1022++) {
                  if (v987 + v1022 < 0 || v987 + v1022 >= v996) continue;
                  for (v1021 = -1; v1021 <= 1; v1021++) {
                    if (v986 + v1021 < 0 || v986 + v1021 >= v995 || !v1021 && !v1022 && !v1023) continue;
                    if (v1016[v989 + v1021 + v995 * v1022 + v1017 * v1023]) v1020++;
                  }
                }
              }
              v1036[v989] = v1020;
            }
            for (v934 = 0; v934 < v998; v934++) v1016[v934] && v1036[v934] >= v1037 && (v1016[v934] = 3, v1038.push(v934));
            while (v1038.length) {
              v989 = v1038.pop(), v986 = v989 % v995, v987 = (v989 - v986) / v995 % v996, v988 = (v989 - v986 - v995 * v987) / v1017;
              for (v1023 = -2; v1023 <= 2; v1023++) {
                if (v988 + v1023 < 0 || v988 + v1023 >= v997) continue;
                for (v1022 = -2; v1022 <= 2; v1022++) {
                  if (v987 + v1022 < 0 || v987 + v1022 >= v996) continue;
                  for (v1021 = -2; v1021 <= 2; v1021++) {
                    if (v986 + v1021 < 0 || v986 + v1021 >= v995) continue;
                    v1040 = v989 + v1021 + v995 * v1022 + v1017 * v1023, v1016[v1040] === 1 && v1036[v1040] >= v1019 && (v1016[v1040] = 3, v1038.push(v1040));
                  }
                }
              }
            }
            for (v988 = 0; v988 < v997; v988++) for (v987 = 0; v987 < v996; v987++) for (v986 = 0; v986 < v995; v986++) {
              v989 = v986 + v995 * (v987 + v996 * v988);
              if (!v1016[v989]) continue;
              if (v1016[v989] !== 3) {
                if (!v1041) {
                  if (v1036[v989] < v1019) continue;
                } else {
                  if (v1036[v989] < 2) continue;
                  v1045 = v942 + (v986 + 0.5) * v993, v1044 = v943 + (v987 + 0.5) * v993 - v1041.cy, v1046 = v944 + (v988 + 0.5) * v993, v1042 = Math.sqrt(v1045 * v1045 / v1041.a2 + v1044 * v1044 / v1041.b2 + v1046 * v1046 / v1041.c2);
                  if (!(v1042 <= v1043)) continue;
                }
              }
              v1034[v989] = 0, v1018++;
            }
            v1036 = null;
            if (v1018) {
              v322(v1034, v995, v996, v997, v993);
              var v1047 = 8 * v993;
              for (v934 = 0; v934 < v998; v934++) if (v1034[v934] > v1047) v1034[v934] = v1047;
              v992 = {
                D: v1034,
                h: v993,
                inv: v994,
                x0: v942,
                y0: v943,
                z0: v944,
                mx: v995,
                my: v996,
                mz: v997,
                far: v1047 - 0.000001,
                d0: Math.max(0, v275.flyFrom),
                d1: Math.max(v275.flyFrom + 0.001, v275.flyFull),
                ref: v1014,
                thr: v1015,
                cells: v1018
              };
            }
          }
        }
        v949 = {
          DF: v992,
          fc: v941,
          inv: v961,
          x0: v942,
          y0: v943,
          z0: v944,
          nx: v952,
          ny: v953,
          nz: v954,
          GX: v956,
          GY: v957,
          GZ: v958,
          GN: v959,
          GM: v983,
          GA: v985,
          bLo: v991,
          bHi: Math.max(v991 * 1.5, v275.bodyFull * v981),
          ref: v981,
          cells: v978.length,
          dense: Math.max(2, v275.flowDense * v981),
          near: v991
        };
      }
    }
    return v321 = {
      fp: v940,
      model: v931,
      flow: v949
    }, v276.flowRef = v949 ? v949.ref : 0, v276.flowCells = v949 ? v949.cells : 0, v276.surfRef = v949 && v949.DF ? v949.DF.ref : 0, v276.surfCells = v949 && v949.DF ? v949.DF.cells : 0, v276.flowMs = v280() - v932, v949;
  }
  var v324 = null;
  function v325(v1052, v1053) {
    var v1054 = v321,
      v1055,
      v1056,
      v1057,
      v1058 = 0,
      v1059 = new Int32Array(v1052.length + 1);
    for (v1055 = 0; v1055 < v1052.length; v1055++) {
      v1059[v1055] = v1058, v1057 = v1052[v1055].pts;
      if (v1057) v1058 += v1057.length;
    }
    v1059[v1052.length] = v1058;
    if (v324 && v324.fm === v1054 && v324.n === v1052.length && v324.tot === v1058) return v324;
    var v1060 = new Uint8Array(v1058),
      v1061 = 0,
      v1062 = v1053.d0,
      v1063 = 0;
    for (v1055 = 0; v1055 < v1052.length; v1055++) {
      v1057 = v1052[v1055].pts;
      if (!v1057) continue;
      if (v1057._pre && v1057._pre.length === v1057.length) v1057 = v1057._pre;
      for (v1056 = 0; v1056 < v1057.length; v1056++, v1061++) v309(v1053, v1057[v1056].x, v1057[v1056].y, v1057[v1056].z) > v1062 && (v1060[v1061] = 1, v1063++);
    }
    return v324 = {
      fm: v1054,
      n: v1052.length,
      tot: v1058,
      F: v1060,
      off: v1059,
      cnt: v1063
    }, v324;
  }
  var v326 = null;
  function v327() {
    var v1064 = v282();
    if (!v1064) return null;
    var v1065 = v280(),
      v1066 = null;
    try {
      v1066 = state.hair3Dneutral;
    } catch (v1119) {}
    if (!v1066 || !v1066.strands || !v1066.strands.length) return null;
    var v1067 = null;
    try {
      v1067 = computeAdjustedHair3DStrands();
    } catch (v1120) {
      v1067 = null;
    }
    if (!v1067 || !v1067.length) return null;
    var v1068 = Math.max(1, Math.ceil(v1067.length / v275.pickStrands)),
      v1069 = v320(),
      v1070 = v1064.camera,
      v1071 = v1064.renderer.domElement,
      v1072 = v1071.getBoundingClientRect();
    v1064.scene.updateMatrixWorld(true), v1070.updateMatrixWorld(true);
    var v1073 = new THREE.Matrix4().multiplyMatrices(v1070.projectionMatrix, v1070.matrixWorldInverse).multiply(v1069.matrixWorld),
      v1074 = v1073.elements;
    if (v275.grain) try {
      v323(v1067, v1068, v1066);
    } catch (v1121) {
      v276.err = String(v1121 && v1121.message || v1121);
    }
    var v1075 = v275.surf && v275.grain && v321 && v321.flow && v321.flow.DF ? v321.flow.DF : null,
      v1076 = null,
      v1077 = 0,
      v1078,
      v1079,
      v1080 = 0,
      v1081;
    if (v1075) try {
      v1076 = v325(v1067, v1075);
    } catch (v1122) {
      v1076 = null, v1075 = null, v276.err = String(v1122 && v1122.message || v1122);
    }
    for (v1078 = 0; v1078 < v1067.length; v1078++) {
      if (!v1067[v1078].pts) continue;
      if (v1078 % v1068 === 0) {
        v1077 += v1067[v1078].pts.length;
        continue;
      }
      if (v1076) {
        for (v1081 = v1076.off[v1078], v1079 = v1076.off[v1078 + 1]; v1081 < v1079; v1081++) v1077 += v1076.F[v1081];
      }
    }
    var v1082 = new Float32Array(v1077),
      v1083 = new Float32Array(v1077),
      v1084 = new Float32Array(v1077),
      v1085 = new Float32Array(v1077),
      v1086 = new Float32Array(v1077),
      v1087 = new Float32Array(v1077),
      v1088 = v1076 ? new Int32Array(v1077) : null,
      v1089 = v1076 ? new Int32Array(v1077) : null,
      v1090 = v1076 ? new Uint8Array(v1077) : null,
      v1091 = Math.max(8, v275.pickPx),
      v1092 = Math.ceil(v1072.width / v1091) + 1,
      v1093 = Math.ceil(v1072.height / v1091) + 1,
      v1094 = new Int32Array(v1092 * v1093).fill(-1),
      v1095 = new Int32Array(v1077),
      v1096 = 0;
    for (v1078 = 0; v1078 < v1067.length; v1078++) {
      var v1097 = v1067[v1078].pts;
      if (!v1097) continue;
      var v1098 = v1078 % v1068 === 0;
      if (!v1098 && !v1076) continue;
      var v1099 = v1097._pre && v1097._pre.length === v1097.length ? v1097._pre : v1097;
      v1081 = v1076 ? v1076.off[v1078] : 0;
      for (v1079 = 0; v1079 < v1097.length; v1079++) {
        if (!v1098) {
          if (!v1076.F[v1081 + v1079]) continue;
          v1080++;
        }
        var v1100 = v1097[v1079],
          v1101 = v1074[3] * v1100.x + v1074[7] * v1100.y + v1074[11] * v1100.z + v1074[15];
        if (!(v1101 > 0.000001)) continue;
        var v1102 = ((v1074[0] * v1100.x + v1074[4] * v1100.y + v1074[8] * v1100.z + v1074[12]) / v1101 * 0.5 + 0.5) * v1072.width,
          v1103 = (1 - ((v1074[1] * v1100.x + v1074[5] * v1100.y + v1074[9] * v1100.z + v1074[13]) / v1101 * 0.5 + 0.5)) * v1072.height;
        if (v1102 < 0 || v1103 < 0 || v1102 >= v1072.width || v1103 >= v1072.height) continue;
        var v1104 = (v1103 / v1091 | 0) * v1092 + (v1102 / v1091 | 0);
        v1082[v1096] = v1102, v1083[v1096] = v1103, v1084[v1096] = v1101, v1085[v1096] = v1099[v1079].x, v1086[v1096] = v1099[v1079].y, v1087[v1096] = v1099[v1079].z, v1095[v1096] = v1094[v1104], v1094[v1104] = v1096, v1076 && (v1088[v1096] = v1078, v1089[v1096] = v1079, v1090[v1096] = v1076.F[v1081 + v1079]), v1096++;
      }
    }
    var v1105 = new THREE.Matrix4().copy(v1069.matrixWorld).invert(),
      v1106 = new THREE.Vector3().setFromMatrixColumn(v1070.matrixWorld, 0).transformDirection(v1105),
      v1107 = new THREE.Vector3().setFromMatrixColumn(v1070.matrixWorld, 1).transformDirection(v1105),
      v1108 = isFinite(v1066.CY) ? v1066.CY : 0,
      v1109 = v1074[7] * v1108 + v1074[15],
      v1110 = v1109 + v275.depthMargin,
      v1111 = null,
      v1112 = 0,
      v1113 = v275.mode === "sweep" && v275.sweep ? v275.sweepDepth : v275.depthLayer;
    if (v1076 && v1113 > 0) {
      var v1114 = Math.max(2, v275.visCell),
        v1115 = Math.ceil(v1072.width / v1114) + 1,
        v1116 = Math.ceil(v1072.height / v1114) + 1,
        v1117 = new Float32Array(v1115 * v1116).fill(Infinity),
        v1118;
      for (v1078 = 0; v1078 < v1096; v1078++) {
        v1118 = (v1083[v1078] / v1114 | 0) * v1115 + (v1082[v1078] / v1114 | 0);
        if (v1084[v1078] < v1117[v1118]) v1117[v1118] = v1084[v1078];
      }
      v1111 = new Uint8Array(v1096);
      for (v1078 = 0; v1078 < v1096; v1078++) {
        if (v1084[v1078] <= v1117[(v1083[v1078] / v1114 | 0) * v1115 + (v1082[v1078] / v1114 | 0)] + v1113) v1111[v1078] = 1;else {
          if (v1084[v1078] <= v1110) v1112++;
        }
      }
    }
    return v276.pickMs = v280() - v1065, v276.pickPts = v1096, v276.pickFly = v1080, v276.pickHidden = v1112, {
      sweep: v275.mode === "sweep" && v275.sweep,
      DF: v1075,
      FM: v1076,
      list: v1067,
      e: v1074,
      wMax: v1110,
      SX: v1082,
      SY: v1083,
      SW: v1084,
      PX: v1085,
      PY: v1086,
      PZ: v1087,
      SI: v1088,
      SK: v1089,
      FL: v1090,
      VIS: v1111,
      head: v1094,
      next: v1095,
      cell: v1091,
      gw: v1092,
      gh: v1093,
      rect: v1072,
      right: v1106,
      up: v1107,
      perPx: function (v1123) {
        return 2 * v1123 * Math.tan(v1070.fov * Math.PI / 360) / v1072.height;
      }
    };
  }
  function v328(v1124, v1125, v1126, v1127) {
    var v1128 = v1124.cell,
      v1129 = v1125 / v1128 | 0,
      v1130 = v1126 / v1128 | 0,
      v1131 = Math.ceil(v1127 / v1128),
      v1132 = -1,
      v1133 = Infinity,
      v1134 = v1127 * v1127,
      v1135,
      v1136,
      v1137,
      v1138 = v1124.VIS;
    for (v1136 = v1130 - v1131; v1136 <= v1130 + v1131; v1136++) {
      if (v1136 < 0 || v1136 >= v1124.gh) continue;
      for (v1135 = v1129 - v1131; v1135 <= v1129 + v1131; v1135++) {
        if (v1135 < 0 || v1135 >= v1124.gw) continue;
        for (v1137 = v1124.head[v1136 * v1124.gw + v1135]; v1137 >= 0; v1137 = v1124.next[v1137]) {
          if (v1124.SW[v1137] > v1124.wMax || v1138 && !v1138[v1137]) continue;
          var v1139 = v1124.SX[v1137] - v1125,
            v1140 = v1124.SY[v1137] - v1126;
          if (v1139 * v1139 + v1140 * v1140 > v1134) continue;
          v1124.SW[v1137] < v1133 && (v1133 = v1124.SW[v1137], v1132 = v1137);
        }
      }
    }
    return v1132;
  }
  var v329 = new Int32Array(8192);
  function v330(v1141, v1142, v1143, v1144) {
    var v1145 = v1141.cell,
      v1146 = v1142 / v1145 | 0,
      v1147 = v1143 / v1145 | 0,
      v1148 = Math.ceil(v1144 / v1145),
      v1149 = v1144 * v1144,
      v1150,
      v1151,
      v1152,
      v1153 = 0,
      v1154 = v1141.VIS;
    for (v1151 = v1147 - v1148; v1151 <= v1147 + v1148; v1151++) {
      if (v1151 < 0 || v1151 >= v1141.gh) continue;
      for (v1150 = v1146 - v1148; v1150 <= v1146 + v1148; v1150++) {
        if (v1150 < 0 || v1150 >= v1141.gw) continue;
        for (v1152 = v1141.head[v1151 * v1141.gw + v1150]; v1152 >= 0; v1152 = v1141.next[v1152]) {
          if (v1141.SW[v1152] > v1141.wMax || v1154 && !v1154[v1152]) continue;
          var v1155 = v1141.SX[v1152] - v1142,
            v1156 = v1141.SY[v1152] - v1143;
          if (v1155 * v1155 + v1156 * v1156 > v1149) continue;
          if (v1153 >= v329.length) {
            var v1157 = new Int32Array(v329.length * 2);
            v1157.set(v329), v329 = v1157;
          }
          v329[v1153++] = v1152;
        }
      }
    }
    if (!v1153) return null;
    var v1158 = v275.dabCell,
      v1159 = new Map(),
      v1160,
      v1161,
      v1162,
      v1163,
      v1164,
      v1165,
      v1166 = v1141.FL,
      v1167 = 0,
      v1168 = null,
      v1169;
    function v1170(v1181, v1182, v1183, v1184, v1185) {
      v1161 = Math.floor(v1181 / v1158) + 2048 + 4096 * (Math.floor(v1182 / v1158) + 2048 + 4096 * (Math.floor(v1183 / v1158) + 2048)), v1165 = v1159.get(v1161);
      if (v1165 === undefined) {
        v1159.set(v1161, [v1181, v1182, v1183, v1184, v1185]);
        if (v1185) v1167++;
      } else v1184 > v1165[3] && (v1165[0] = v1181, v1165[1] = v1182, v1165[2] = v1183, v1165[3] = v1184), v1185 && !v1165[4] && (v1165[4] = 1, v1167++);
    }
    for (v1160 = 0; v1160 < v1153; v1160++) {
      v1152 = v329[v1160], v1163 = v1141.SX[v1152] - v1142, v1164 = v1141.SY[v1152] - v1143, v1162 = Math.pow(1 - Math.sqrt(v1163 * v1163 + v1164 * v1164) / v1144, v275.falloff), v1170(v1141.PX[v1152], v1141.PY[v1152], v1141.PZ[v1152], v1162, v1166 ? v1166[v1152] : 0);
      if (v1166 && v1166[v1152] && v275.reachBack && !v1141.sweep) {
        if (!v1168) v1168 = new Map();
        v1169 = v1168.get(v1141.SI[v1152]);
        if (v1169 === undefined) v1168.set(v1141.SI[v1152], [v1141.SK[v1152], v1162]);else {
          if (v1141.SK[v1152] > v1169[0]) v1169[0] = v1141.SK[v1152];
          if (v1162 > v1169[1]) v1169[1] = v1162;
        }
      }
    }
    var v1171 = 0;
    if (v1168 && v1141.FM) {
      var v1172 = v1141.e,
        v1173 = v1141.FM.F,
        v1174 = v1141.FM.off,
        v1175 = Math.max(0, v275.reachIn | 0);
      v1168.forEach(function (v1186, v1187) {
        var v1188 = v1141.list[v1187].pts,
          v1189 = v1188._pre && v1188._pre.length === v1188.length ? v1188._pre : v1188,
          v1190 = v1174[v1187],
          v1191 = 0,
          v1192,
          v1193;
        for (v1192 = v1186[0] - 1; v1192 >= 1; v1192--) {
          v1193 = v1188[v1192];
          if (v1172[3] * v1193.x + v1172[7] * v1193.y + v1172[11] * v1193.z + v1172[15] > v1141.wMax) break;
          if (v1173[v1190 + v1192]) v1191 = 0;else {
            if (++v1191 > v1175) break;
          }
          v1170(v1189[v1192].x, v1189[v1192].y, v1189[v1192].z, v1186[1], 1), v1171++;
        }
      });
    }
    var v1176 = v1159.size,
      v1177 = 1,
      v1178 = 0,
      v1179 = 0;
    if (v1176 > v275.dabMax) v1177 = Math.max(1, Math.ceil((v1176 - v1167) / Math.max(1, v275.dabMax - v1167)));
    var v1180 = new Float32Array((v1167 + Math.ceil((v1176 - v1167) / v1177) + 1) * 4);
    return v1159.forEach(function (v1194) {
      if (!v1194[4] && v1179++ % v1177) return;
      v1180[v1178 * 4] = v1194[0], v1180[v1178 * 4 + 1] = v1194[1], v1180[v1178 * 4 + 2] = v1194[2], v1180[v1178 * 4 + 3] = v1194[3], v1178++;
    }), {
      dabs: v1180,
      m: v1178,
      seen: v1153,
      reached: v1171
    };
  }
  var v331 = null,
    v332 = false,
    v333 = new Map(),
    v334 = false,
    v335 = 0,
    v336 = null;
  function v337(v1195) {
    var v1196 = v282();
    return !!(v1196 && v1195.target === v1196.renderer.domElement && v1196.container && v1196.container.id === "adjust3dHost");
  }
  function v338() {
    if (v336) return;
    var v1197 = Math.max(0, v275.liveMs - (v280() - v335));
    v336 = setTimeout(function () {
      v336 = null, v335 = v280(), v319();
    }, v1197);
  }
  function v339(v1198, v1199, v1200) {
    var v1201 = v1198.trail,
      v1202 = v1201.length,
      v1203 = 0,
      v1204;
    for (v1204 = v1202 - 2; v1204 >= 0; v1204 -= 2) {
      v1203 += Math.hypot((v1204 + 2 < v1202 ? v1201[v1204 + 2] : v1199) - v1201[v1204], (v1204 + 3 < v1202 ? v1201[v1204 + 3] : v1200) - v1201[v1204 + 1]);
      if (v1203 >= v275.dirLagPx) break;
    }
    if (v1204 < 0) v1204 = 0;
    return [v1199 - v1201[v1204], v1200 - v1201[v1204 + 1]];
  }
  function v340(v1205, v1206) {
    var v1207 = v331,
      v1208 = v1207.pk;
    if (!v1208) return;
    var v1209 = v1205 - v1207.lx,
      v1210 = v1206 - v1207.ly,
      v1211 = Math.sqrt(v1209 * v1209 + v1210 * v1210);
    if (v1211 < v275.minMovePx) return;
    var v1212 = v339(v1207, v1205, v1206);
    v1207.trail.push(v1205, v1206);
    if (v1207.trail.length > 240) v1207.trail.splice(0, 120);
    var v1213 = Math.hypot(v1212[0], v1212[1]) || 1;
    v1207.vx === 0 && v1207.vy === 0 ? (v1207.vx = v1212[0] / v1213, v1207.vy = v1212[1] / v1213) : (v1207.vx = v1207.vx * 0.7 + v1212[0] / v1213 * 0.3, v1207.vy = v1207.vy * 0.7 + v1212[1] / v1213 * 0.3);
    var v1214 = v328(v1208, v1205, v1206, v275.radiusPx);
    if (v1214 >= 0) v1207.w = v1208.SW[v1214];
    var v1215 = v1207.w > 0 ? Math.min(v275.maxRadius, v275.radiusPx * v1208.perPx(v1207.w)) / v1208.perPx(v1207.w) : null;
    v349(v1205, v1206, v1215, Math.atan2(v1207.vy, v1207.vx)), v1207.lx = v1205, v1207.ly = v1206;
    if (v1215 == null) return;
    var v1216 = v1208.right.x * v1207.vx - v1208.up.x * v1207.vy,
      v1217 = v1208.right.y * v1207.vx - v1208.up.y * v1207.vy,
      v1218 = v1208.right.z * v1207.vx - v1208.up.z * v1207.vy,
      v1219 = Math.sqrt(v1216 * v1216 + v1217 * v1217 + v1218 * v1218);
    if (!(v1219 > 1e-9)) return;
    if (v1207.has && Math.hypot(v1205 - v1207.sx, v1206 - v1207.sy) < v275.spacing * v1215) return;
    var v1220 = v330(v1208, v1205, v1206, v1215);
    if (!v1220) return;
    if (v275.samples.length + v275.sweeps.length >= v275.maxSamples) {
      if (!v1207.full) {
        v1207.full = true;
        try {
          showToast(v352() === "ko" ? "빗질이 너무 많아요 — ↶로 되돌리거나 지워 주세요" : "Too many comb strokes — undo or clear some");
        } catch (v1221) {}
      }
      return;
    }
    if (v1208.sweep) v275.sweeps.push({
      dabs: v1220.dabs,
      m: v1220.m,
      dx: v1216 / v1219,
      dy: v1217 / v1219,
      dz: v1218 / v1219,
      k: v275.sweepStrength,
      g: v1207.g
    });else v275.samples.push({
      dabs: v1220.dabs,
      m: v1220.m,
      dx: v1216 / v1219,
      dy: v1217 / v1219,
      dz: v1218 / v1219,
      k: v275.strength,
      g: v1207.g
    });
    v1207.sx = v1205, v1207.sy = v1206, v1207.has = true, v1207.n++, v276.dabs = v1220.m, v276.seen = v1220.seen, v276.reached = v1220.reached || 0, v277++, v338();
  }
  function v341() {
    var v1222 = v331;
    v331 = null;
    if (!v1222) return;
    if (v1222.n) {
      if (v1222.sweep) v276.sweepStrokes = (v276.sweepStrokes || 0) + 1;else v276.strokes++;
      v336 && (clearTimeout(v336), v336 = null), v319();
    }
    v363();
  }
  function v342(v1223) {
    if (v334 || !v275.on || !v284() || !v337(v1223)) return;
    v333.set(v1223.pointerId, {
      x: v1223.clientX,
      y: v1223.clientY,
      type: v1223.pointerType
    });
    if (v332) return;
    if (v331) {
      var v1224 = v331.id,
        v1225 = v333.get(v1224);
      v341(), v332 = true;
      if (v1225) {
        try {
          v334 = true, v1223.target.dispatchEvent(new PointerEvent("pointerdown", {
            pointerId: v1224,
            clientX: v1225.x,
            clientY: v1225.y,
            bubbles: true,
            isPrimary: true,
            button: 0,
            pointerType: v1225.type || "touch"
          }));
        } catch (v1232) {}
        v334 = false;
      }
      return;
    }
    if (v1223.button !== 0 || v1223.shiftKey) return;
    var v1226 = null;
    try {
      v1226 = v327();
    } catch (v1233) {
      v276.err = String(v1233 && v1233.message || v1233);
    }
    if (!v1226) return;
    var v1227 = v1226.rect,
      v1228 = v1223.pointerType === "touch" ? v275.touchOffset : 0,
      v1229 = v1223.clientX - v1227.left,
      v1230 = v1223.clientY - v1227.top - v1228;
    v331 = {
      sweep: !!v1226.sweep,
      id: v1223.pointerId,
      pk: v1226,
      oy: v1228,
      lx: v1229,
      ly: v1230,
      vx: 0,
      vy: 0,
      trail: [v1229, v1230],
      has: false,
      n: 0,
      g: ++v278,
      cx: 0,
      cy: 0,
      cz: 0,
      sx: 0,
      sy: 0,
      sz: 0,
      w: 0
    };
    var v1231 = v328(v1226, v1229, v1230, v275.radiusPx);
    if (v1231 >= 0) v331.w = v1226.SW[v1231];
    v349(v1229, v1230, v1231 >= 0 ? Math.min(v275.maxRadius, v275.radiusPx * v1226.perPx(v1226.SW[v1231])) / v1226.perPx(v1226.SW[v1231]) : null, null), v1223.stopPropagation();
  }
  function v343(v1234) {
    if (v333.has(v1234.pointerId)) {
      var v1235 = v333.get(v1234.pointerId);
      v1235.x = v1234.clientX, v1235.y = v1234.clientY;
    }
    if (!v331 && v275.on && !v332 && v1234.pointerType === "mouse" && v284() && v337(v1234)) {
      var v1236 = v1234.target.getBoundingClientRect();
      v349(v1234.clientX - v1236.left, v1234.clientY - v1236.top, null, null);
    }
    if (!v331 || v1234.pointerId !== v331.id) return;
    v1234.stopPropagation();
    var v1237 = v331.pk.rect,
      v1238 = v331.oy,
      v1239 = typeof v1234.getCoalescedEvents === "function" ? v1234.getCoalescedEvents() : null;
    if (v1239 && v1239.length > 1) {
      for (var v1240 = 0; v1240 < v1239.length; v1240++) v340(v1239[v1240].clientX - v1237.left, v1239[v1240].clientY - v1237.top - v1238);
    } else v340(v1234.clientX - v1237.left, v1234.clientY - v1237.top - v1238);
  }
  function v344(v1241) {
    v333.delete(v1241.pointerId);
    if (v331 && v1241.pointerId === v331.id) v341();
    if (!v333.size) v332 = false;
  }
  document.addEventListener("pointerdown", v342, true), v273.addEventListener("pointermove", v343, true), v273.addEventListener("pointerup", v344, true), v273.addEventListener("pointercancel", v344, true);
  var v345 = null,
    v346 = 14;
  function v347() {
    try {
      var v1242 = v282(),
        v1243 = v1242.renderer.domElement.getBoundingClientRect(),
        v1244 = MODEL3D_VIEW.base ? MODEL3D_VIEW.base.dist / MODEL3D_VIEW.zoom : v1242.camera.position.length(),
        v1245 = 2 * v1244 * Math.tan(v1242.camera.fov * Math.PI / 360) / v1243.height;
      return Math.min(v275.maxRadius, v275.radiusPx * v1245) / v1245;
    } catch (v1246) {
      return v275.radiusPx;
    }
  }
  function v348() {
    var v1247 = v282();
    if (!v1247 || !v1247.container || v1247.container.id !== "adjust3dHost") return null;
    if (v345 && v345.parentNode === v1247.container) return v345;
    return v345 = document.createElement("div"), v345.id = "comb3dMark", v345.style.cssText = "position:absolute;left:0;top:0;width:0;height:0;z-index:5;pointer-events:none;display:none;", v345.innerHTML = "<svg width=\"120\" height=\"120\" viewBox=\"-60 -60 120 120\" style=\"position:absolute;left:-60px;top:-60px;overflow:visible\">" + "<circle id=\"comb3dRing\" r=\"14\" fill=\"rgba(201,135,74,0.10)\" stroke=\"#fff\" stroke-width=\"2.5\" opacity=\"0.9\"/>" + "<circle id=\"comb3dRing2\" r=\"14\" fill=\"none\" stroke=\"#c9874a\" stroke-width=\"1.5\" stroke-dasharray=\"4 3\"/>" + "<g id=\"comb3dGlyph\"><g transform=\"translate(0,0)\">" + "<rect x=\"-13\" y=\"-8\" width=\"26\" height=\"6\" rx=\"2\" fill=\"#c9874a\" stroke=\"#1a1410\" stroke-width=\"1\"/>" + [-10.5, -7, -3.5, 0, 3.5, 7, 10.5].map(function (v1248) {
      return "<rect x=\"" + (v1248 - 0.9) + "\" y=\"-2.5\" width=\"1.8\" height=\"10\" rx=\"0.8\" fill=\"#c9874a\" stroke=\"#1a1410\" stroke-width=\"0.6\"/>";
    }).join("") + "</g></g></svg>", v1247.container.appendChild(v345), v345;
  }
  function v349(v1249, v1250, v1251, v1252) {
    if (!v275.indicator) return;
    var v1253 = v348();
    if (!v1253) return;
    if (v1251 != null && isFinite(v1251)) v346 = Math.max(4, v1251);
    v1253.style.display = "block", v1253.style.transform = "translate(" + v1249.toFixed(1) + "px," + v1250.toFixed(1) + "px)";
    try {
      v1253.querySelector("#comb3dRing").setAttribute("r", v346.toFixed(1)), v1253.querySelector("#comb3dRing2").setAttribute("r", v346.toFixed(1));
      var v1254 = v1252 == null ? 0 : v1252 * 180 / Math.PI - 90;
      v1253.querySelector("#comb3dGlyph").setAttribute("transform", "rotate(" + v1254.toFixed(1) + ")");
    } catch (v1255) {}
  }
  function v350() {
    if (v345) v345.style.display = "none";
  }
  function v351() {
    try {
      var v1256 = v282();
      if (!v1256 || !v275.on) {
        v350();
        return;
      }
      var v1257 = v1256.renderer.domElement.getBoundingClientRect();
      v349(v1257.width / 2, v1257.height / 2, v347(), null);
    } catch (v1258) {}
  }
  v275._mark = function () {
    return v345;
  };
  function v352() {
    try {
      return uiLang === "ko" ? "ko" : "en";
    } catch (v1259) {
      return "ko";
    }
  }
  var v353 = null,
    v354 = null,
    v355 = null,
    v356 = null,
    v357 = null,
    v358 = null,
    v359 = 0.03,
    v360 = 0.6,
    v361 = "gyeol_sweepLevel";
  function v362(v1260) {
    return v1260 = Math.max(1, Math.min(10, +v1260 || 7)), +(v359 * Math.pow(v360 / v359, (v1260 - 1) / 9)).toFixed(3);
  }
  v275.setSweepLevel = function (v1261, v1262) {
    v1261 = Math.max(1, Math.min(10, Math.round(+v1261 || 7))), v275.sweepLevel = v1261, v275.sweepStrength = v362(v1261);
    if (!v1262) try {
      localStorage.setItem(v361, String(v1261));
    } catch (v1263) {}
    try {
      if (v357) v357.value = String(v1261);
      if (v358) v358.textContent = (v352() === "ko" ? "세기 " : "Strength ") + v1261;
    } catch (v1264) {}
    return v275.sweepStrength;
  };
  function v363() {
    try {
      if (!v353) return;
      var v1265 = v275.enabled && v283(),
        v1266 = v275.on && v275.mode === "sweep" && v275.sweep;
      v353.style.display = v1265 ? "" : "none", v353.classList.toggle("on", !!v275.on && !v1266), v353.textContent = v275.on && !v1266 ? "빗질 ON" : "빗질 OFF";
      v355 && (v355.style.display = v1265 && v275.sweep ? "" : "none", v355.classList.toggle("on", !!v1266), v355.textContent = v1266 ? "넘기기 ON" : "넘기기 OFF");
      if (v356) v356.style.display = v1265 && v1266 ? "inline-flex" : "none";
      v354.style.display = v1265 && v275.on ? "" : "none", v354.disabled = !(v275.samples.length || v275.sweeps.length);
      if (v345) {
        var v1267 = v345.querySelector("#comb3dRing2");
        if (v1267) v1267.setAttribute("stroke", v1266 ? "#3b82c4" : "#c9874a");
      }
      var v1268 = v282();
      if (v1268 && v1268.container && v1268.container.id === "adjust3dHost") v1268.renderer.domElement.style.cursor = v275.on ? "crosshair" : "";
    } catch (v1269) {}
  }
  v275.toggle = function (v1270, v1271) {
    v1271 = v1271 === "sweep" && v275.sweep ? "sweep" : "tidy";
    if (v1270 == null) v1270 = !(v275.on && v275.mode === v1271);
    if (v331) v341();
    v275.on = !!v1270;
    if (v275.on) v275.mode = v1271;
    v363();
    if (v275.on && v1271 === "sweep") {
      v351(), v363();
      try {
        showToast(v352() === "ko" ? "넘기고 싶은 머리에 빗(원)을 올리고 보낼 방향으로 쓸어 주세요 — 원 안의 머리가 뭉치째 그 방향으로 넘어갑니다 · 이어서 쓸면 더 넘어가요 · ↶ 되돌리기" : "Put the comb (circle) on the hair and stroke the way you want it to go — the whole bundle inside the circle turns that way · keep stroking to carry it further · ↶ undo");
      } catch (v1272) {}
    } else {
      if (v275.on) {
        v351(), v363();
        try {
          showToast(v352() === "ko" ? "뜬 머리에 빗(원)을 올리고 결대로 쓸어 주세요 — 주변 머리의 결에 맞춰 눕습니다 · 빗은 손가락 조금 위에 있어요 · 두 손가락: 이동·확대" : "Put the comb (circle) on the flyaways and sweep along the hair — they lie down into the surrounding flow · the comb sits just above your finger · two fingers: move / zoom");
        } catch (v1273) {}
      } else v350();
    }
  };
  try {
    var v364 = document.querySelector("#screen-adjust .mode-bar"),
      v365 = document.getElementById("mannequinBtn");
    if (v364) {
      v353 = document.createElement("button"), v353.id = "comb3dBtn", v353.type = "button";
      if (v365 && v365.className) v353.className = v365.className;
      v353.title = "켜면 한 손가락 드래그가 빗질이 됩니다 — 잔머리를 결 방향으로 쓰다듬어 눕힙니다", v353.addEventListener("click", function () {
        v275.toggle();
      }), v354 = document.createElement("button"), v354.id = "comb3dUndoBtn", v354.type = "button";
      if (v365 && v365.className) v354.className = v365.className;
      v354.textContent = "↶", v354.title = "마지막 빗질 한 획 되돌리기", v354.addEventListener("click", function () {
        v275.undo();
      }), v355 = document.createElement("button"), v355.id = "comb3dSweepBtn", v355.type = "button";
      if (v365 && v365.className) v355.className = v365.className;
      v355.title = "켜면 한 손가락 드래그가 빗어 넘기기가 됩니다 — 원 안의 머리가 뭉치째 쓴 방향으로 넘어갑니다", v355.addEventListener("click", function () {
        v275.toggle(null, "sweep");
      }), v356 = document.createElement("span"), v356.id = "comb3dSweepK", v356.style.cssText = "display:none;align-items:center;gap:5px;vertical-align:middle;padding:2px 8px;border-radius:999px;background:rgba(30,25,21,0.82);color:#f3e9da;font-size:11px;line-height:1;white-space:nowrap;", v358 = document.createElement("span"), v357 = document.createElement("input"), v357.type = "range", v357.min = "1", v357.max = "10", v357.step = "1", v357.style.cssText = "width:84px;height:22px;margin:0;accent-color:#3b82c4;touch-action:pan-x;", v357.title = "넘기기 세기 — 한 번 쓸 때 얼마나 넘어가나(여러 번 쓸면 쌓임)", v357.addEventListener("input", function () {
        v275.setSweepLevel(v357.value);
      }), ["pointerdown", "touchstart", "mousedown"].forEach(function (v1274) {
        v356.addEventListener(v1274, function (v1275) {
          v1275.stopPropagation();
        });
      }), v356.appendChild(v358), v356.appendChild(v357);
      var v366 = v275.sweepLevel;
      try {
        var v367 = parseInt(localStorage.getItem(v361), 10);
        if (v367 >= 1 && v367 <= 10) v366 = v367;
      } catch (v1276) {}
      v275.setSweepLevel(v366, true), v364.appendChild(v353), v364.appendChild(v355), v364.appendChild(v356), v364.appendChild(v354), v363();
    }
  } catch (v1277) {
    console.warn(v274 + " 버튼 만들기 실패", v1277);
  }
  try {
    if (typeof I18N !== "undefined") {
      Object.assign(I18N, {
        "빗질 ON": "Comb ON",
        "빗질 OFF": "Comb OFF",
        "넘기기 ON": "Sweep ON",
        "넘기기 OFF": "Sweep OFF",
        "넘기기 세기 — 한 번 쓸 때 얼마나 넘어가나(여러 번 쓸면 쌓임)": "Sweep strength — how far one stroke turns the hair (repeat strokes add up)",
        "켜면 한 손가락 드래그가 빗어 넘기기가 됩니다 — 원 안의 머리가 뭉치째 쓴 방향으로 넘어갑니다": "When on, a one-finger drag sweeps — the whole bundle inside the circle turns the way you stroke",
        "켜면 한 손가락 드래그가 빗질이 됩니다 — 잔머리를 결 방향으로 쓰다듬어 눕힙니다": "When on, a one-finger drag combs — stroke flyaways along the hair flow to lay them down",
        "마지막 빗질 한 획 되돌리기": "Undo the last comb stroke"
      });
      try {
        _i18nSubKeys = null;
      } catch (v1278) {}
      try {
        if (typeof applyUiLang === "function") applyUiLang();
      } catch (v1279) {}
    }
  } catch (v1280) {}
  return v275._afterUi = function (v1281, v1282) {
    try {
      if (v1281 === "activateScreen" && v1282 !== "adjust" && v275.on) {
        v275.on = false;
        if (v331) v341();
        v350();
      }
      v363();
    } catch (v1283) {}
  }, v275._afterApplyView = function () {
    try {
      v275.on && !v331 && v345 && v345.style.display !== "none" && (v346 = Math.max(4, v347()), v345.querySelector("#comb3dRing").setAttribute("r", v346.toFixed(1)), v345.querySelector("#comb3dRing2").setAttribute("r", v346.toFixed(1)));
    } catch (v1284) {}
  }, v275._syncBtn = function () {
    try {
      v363();
    } catch (v1285) {}
  }, v275._panelLines = function () {
    var v1286 = [];
    try {
      v1286.push(v274 + " " + (v275.enabled ? v275.on ? "켜짐(빗질 모드)" : "대기" : "꺼짐") + " · 획 " + v276.strokes + " · 표본 " + v275.samples.length + "/" + v275.maxSamples + " · 넘기기 " + (v275.sweep ? (v275.on && v275.mode === "sweep" ? "켜짐" : "대기") + " — 세기 " + v275.sweepLevel + "/10(표본 세기 " + v275.sweepStrength + ") · 획 " + (v276.sweepStrokes || 0) + " · 표본 " + v275.sweeps.length + " · 직전에 넘어간 가닥 " + (v276.swept || 0) + "(두상에 막혀 눕힌 마디 " + (v276.sweptPush || 0) + ") · 방향 장 " + (v295 ? v295.n : 0) + "칸" : "꺼짐(COMB3D.sweep=false)") + " · 직전에 바뀐 가닥 " + v276.touched + " · 가닥 만들기 " + Math.round(v276.ms) + "ms(빗질 포함) · 붓 자리 찾기 준비 " + Math.round(v276.pickMs) + "ms(점 " + v276.pickPts + ") · 직전 표본이 칠한 점 " + v276.dabs + "(원 안에 보인 점 " + v276.seen + ")" + " · 방향 장 " + (v285 ? v285.n : 0) + "칸 · 붓 " + v275.radiusPx + "px(상한 " + v275.maxRadius + " · 지금 화면에서 " + Math.round(v346) + "px) · 세기 " + v275.strength + " · 터치 빗 위치 손가락 위 " + v275.touchOffset + "px" + (v276.err ? " · ⚠ " + v276.err : "")), v1286.push("  결 따라 빗기 " + (v275.grain ? v321 && v321.flow ? "켜짐 — 결 칸 " + v276.flowCells + " · 몸통 머리 보통 밀도 칸당 " + v276.flowRef + "가닥 · 결 읽기 " + Math.round(v276.flowMs) + "ms" : "켜짐(아직 결을 안 읽음 — 빗을 대면 읽음)" : "꺼짐(손가락 방향 그대로)") + " · 직전에 본 마디의 목표: 제 무리의 결 " + v276.tOwn + " / 손가락 쪽 이웃의 결 " + v276.tSide + " / 이웃 전체의 결 " + v276.tAll + " / 두상 쪽에서 찾은 결 " + v276.tReach + " / 손가락 방향(주변에 머리 없음) " + v276.tFinger + " / 결이 갈려 그대로 둠 " + v276.tSkip + " · 허용 각 " + v275.tolFrom + "~" + v275.tolFull + "° · " + (v275.collide ? "두상에 막혀 눕힌 마디 " + v276.pushed + " / 목 밖으로 민 점 " + v276.neck : "두상 막기 꺼짐") + " · " + (v275.anchor ? "몸통 붙들기 켜짐 — 제자리로 되돌린 점 " + v276.anch + " / 몸통 쪽으로 기울인 마디 " + v276.pin : "몸통 붙들기 꺼짐")), v1286.push("  겉면 타기 " + (v275.surf ? v321 && v321.flow && v321.flow.DF ? "켜짐 — 몸통 칸 " + v276.surfCells + "(잔칸 보통 밀도 " + v276.surfRef + "가닥) · 뜬 점 " + (v324 ? v324.cnt + "/" + v324.tot : "-") + " · 직전에 세기가 걸린 잔머리 마디 " + v276.fly + " · 그중 거슬러 올라가 세기를 올린 마디 " + v276.up + (v275.reachBack ? "(직전 표본이 가닥을 따라 올라가며 칠한 점 " + v276.reached + ")" : "(거슬러 올라가기 꺼짐)") + " · 겉면 쪽으로 튼 마디 " + v276.pin + (v275.settle > 0 ? "" : "(꺼짐 — 방향 정렬만)") + " · 6cm 상한에 걸린 점 " + v276.clamp + " · 붓 자리 찾기: 따로 넣은 뜬 점 " + (v276.pickFly || 0) + " / 겉층 뒤라 뺀 점 " + (v276.pickHidden || 0) + (v275.depthLayer > 0 ? "" : "(깊이 안 가림)") : v275.grain ? "켜짐(아직 거리장 없음 — 빗을 대면 만듦)" : "꺼짐(결 따라 빗기가 꺼져 있음)" : "꺼짐(예전 방식)"));
    } catch (v1287) {}
    return v1286;
  }, console.log(v274 + " 설치 — 3D 조정 화면에서 [빗질]을 켜고 잔머리를 결 방향으로 쓰다듬으면 그 방향으로 눕습니다 · [넘기기]를 켜고 쓸면 원 안의 머리가 뭉치째 그 방향으로 넘어갑니다. 지우기 COMB3D.clear() · 되돌리기 COMB3D.undo()"), v275;
}();
var FLY_TRIM = function () {
  'use strict';

  var v1288 = window,
    v1289 = "[잔머리 정리]",
    v1290 = Object.assign({
      on: true,
      auto: false,
      brush: true,
      minCurl: 30,
      cell: 0.07,
      minStrands: 3,
      frac: 0.12,
      refStrands: 10000,
      minTail: 0.08,
      maxOut: 0.16,
      brushBack: 0.25,
      keepPts: 3,
      final: true,
      finalCellCm: 0.8,
      finalLo: 4,
      finalHi: 10,
      finalFrac: 0.2,
      finalDilate: 0,
      finalMinSegs: 20000
    }, v1288.FLY_TRIM || {}),
    v1291 = v1290.stats = {
      curly: false,
      curl: 0,
      strands: 0,
      autoCut: 0,
      loopCut: 0,
      brushCut: 0,
      cutLen: 0,
      cells: 0,
      body: 0,
      thr: 0,
      ms: 0,
      err: null
    },
    v1292 = 0,
    v1293 = [];
  function v1294() {
    try {
      return performance.now();
    } catch (v1302) {
      return Date.now();
    }
  }
  function v1295() {
    try {
      var v1303,
        v1304 = 0,
        v1305 = 0;
      for (v1303 in state.sections) {
        var v1306 = +state.sections[v1303].curl;
        isFinite(v1306) && (v1305 += v1306, v1304++);
      }
      return v1304 ? v1305 / v1304 : 0;
    } catch (v1307) {
      return 0;
    }
  }
  function v1296() {
    return !!(v1290.on && v1295() >= v1290.minCurl);
  }
  v1290.curly = v1296, v1290._comb = function (v1308) {
    var v1309 = v1288.COMB3D;
    if (!(v1290.brush && v1309 && v1309.samples && v1309.samples.length && v1296())) return v1308();
    var v1310 = v1309.samples;
    v1309.samples = v1293;
    try {
      return v1308();
    } finally {
      v1309.samples = v1310;
    }
  };
  var v1297 = new WeakMap();
  function v1298(v1311) {
    v1291.curl = Math.round(v1295()), v1291.curly = v1296();
    if (!v1291.curly || !v1311 || !v1311.length) return v1311;
    var v1312 = v1288.COMB3D,
      v1313 = v1290.brush && v1312 && v1312.samples ? v1312.samples.length : 0,
      v1314 = v1297.get(v1311);
    if (v1314 && v1314.ver === v1292 && v1314.nSm === v1313) return v1314.out;
    var v1315 = v1294(),
      v1316 = v1311.length,
      v1317,
      v1318,
      v1319,
      v1320,
      v1321 = v1290.cell,
      v1322 = [Infinity, Infinity, Infinity],
      v1323 = [-Infinity, -Infinity, -Infinity];
    for (v1317 = 0; v1317 < v1316; v1317++) {
      v1319 = v1311[v1317] && v1311[v1317].pts;
      if (!v1319) continue;
      for (v1318 = 0; v1318 < v1319.length; v1318++) {
        var v1324 = v1319[v1318];
        if (v1324.x < v1322[0]) v1322[0] = v1324.x;
        if (v1324.y < v1322[1]) v1322[1] = v1324.y;
        if (v1324.z < v1322[2]) v1322[2] = v1324.z;
        if (v1324.x > v1323[0]) v1323[0] = v1324.x;
        if (v1324.y > v1323[1]) v1323[1] = v1324.y;
        if (v1324.z > v1323[2]) v1323[2] = v1324.z;
      }
    }
    if (!isFinite(v1322[0])) return v1311;
    var v1325 = Math.min(160, Math.floor((v1323[0] - v1322[0]) / v1321) + 3),
      v1326 = Math.min(200, Math.floor((v1323[1] - v1322[1]) / v1321) + 3),
      v1327 = Math.min(160, Math.floor((v1323[2] - v1322[2]) / v1321) + 3),
      v1328 = v1322[0] - v1321,
      v1329 = v1322[1] - v1321,
      v1330 = v1322[2] - v1321,
      v1331 = v1325 * v1326 * v1327,
      v1332 = new Uint16Array(v1331),
      v1333 = new Int32Array(v1331).fill(-1);
    function v1334(v1374) {
      var v1375 = Math.floor((v1374.x - v1328) / v1321),
        v1376 = Math.floor((v1374.y - v1329) / v1321),
        v1377 = Math.floor((v1374.z - v1330) / v1321);
      return v1375 < 0 || v1376 < 0 || v1377 < 0 || v1375 >= v1325 || v1376 >= v1326 || v1377 >= v1327 ? -1 : v1375 + v1325 * (v1376 + v1326 * v1377);
    }
    for (v1317 = 0; v1317 < v1316; v1317++) {
      v1319 = v1311[v1317] && v1311[v1317].pts;
      if (!v1319) continue;
      for (v1318 = 0; v1318 < v1319.length; v1318++) {
        var v1335 = v1334(v1319[v1318]);
        if (v1335 >= 0 && v1333[v1335] !== v1317) {
          v1333[v1335] = v1317;
          if (v1332[v1335] < 65535) v1332[v1335]++;
        }
      }
    }
    var v1336 = [],
      v1337;
    for (v1337 = 0; v1337 < v1331; v1337++) if (v1332[v1337]) v1336.push(v1332[v1337]);
    v1336.sort(function (v1378, v1379) {
      return v1378 - v1379;
    });
    var v1338 = v1336.length ? v1336[v1336.length >> 1] : 0,
      v1339 = Math.max(v1290.minStrands * Math.max(1, v1316 / v1290.refStrands), v1290.frac * v1338),
      v1340 = new Uint8Array(v1331),
      v1341 = new Uint8Array(v1331),
      v1342 = 0,
      v1343 = 1,
      v1344 = v1325,
      v1345 = v1325 * v1326;
    for (v1337 = 0; v1337 < v1331; v1337++) v1332[v1337] >= v1339 && (v1340[v1337] = 1, v1342++);
    for (v1337 = 0; v1337 < v1331; v1337++) if (v1340[v1337]) {
      v1341[v1337] = 1;
      if (v1337 - v1343 >= 0) v1341[v1337 - v1343] = 1;
      if (v1337 + v1343 < v1331) v1341[v1337 + v1343] = 1;
      if (v1337 - v1344 >= 0) v1341[v1337 - v1344] = 1;
      if (v1337 + v1344 < v1331) v1341[v1337 + v1344] = 1;
      if (v1337 - v1345 >= 0) v1341[v1337 - v1345] = 1;
      if (v1337 + v1345 < v1331) v1341[v1337 + v1345] = 1;
    }
    v1291.cells = v1336.length, v1291.body = v1342, v1291.thr = v1339;
    var v1346 = null;
    if (v1313) {
      v1346 = new Uint8Array(v1331);
      var v1347 = Math.max(1, Math.round((v1312.dab > 0 ? v1312.dab : 0.045) / v1321)),
        v1348,
        v1349,
        v1350,
        v1351;
      for (v1348 = 0; v1348 < v1312.samples.length; v1348++) {
        var v1352 = v1312.samples[v1348],
          v1353 = v1352 && v1352.dabs,
          v1354 = v1352 && v1352.m;
        if (!v1353 || !v1354) continue;
        for (v1318 = 0; v1318 < v1354; v1318++) {
          var v1355 = Math.floor((v1353[v1318 * 4] - v1328) / v1321),
            v1356 = Math.floor((v1353[v1318 * 4 + 1] - v1329) / v1321),
            v1357 = Math.floor((v1353[v1318 * 4 + 2] - v1330) / v1321);
          for (v1351 = v1357 - v1347; v1351 <= v1357 + v1347; v1351++) {
            if (v1351 < 0 || v1351 >= v1327) continue;
            for (v1350 = v1356 - v1347; v1350 <= v1356 + v1347; v1350++) {
              if (v1350 < 0 || v1350 >= v1326) continue;
              for (v1349 = v1355 - v1347; v1349 <= v1355 + v1347; v1349++) {
                if (v1349 < 0 || v1349 >= v1325) continue;
                v1346[v1349 + v1325 * (v1350 + v1326 * v1351)] = 1;
              }
            }
          }
        }
      }
    }
    var v1358 = new Array(v1316),
      v1359 = 0,
      v1360 = 0,
      v1361 = 0,
      v1362 = 0;
    for (v1317 = 0; v1317 < v1316; v1317++) {
      v1320 = v1311[v1317], v1319 = v1320 && v1320.pts, v1358[v1317] = v1320;
      if (!v1319 || v1319.length <= v1290.keepPts) continue;
      var v1363 = v1319.length,
        v1364 = v1363,
        v1365 = 0,
        v1366 = -1,
        v1367 = 0,
        v1368;
      for (v1318 = 1; v1318 < v1363; v1318++) {
        v1368 = v1334(v1319[v1318]);
        if (v1346 && v1318 >= v1290.keepPts && v1368 >= 0 && v1346[v1368] && !v1340[v1368]) {
          var v1369 = 0,
            v1370,
            v1371;
          for (v1370 = v1318 + 1; v1370 < v1363; v1370++) {
            v1371 = v1334(v1319[v1370]);
            if (v1371 >= 0 && v1340[v1371]) v1369++;
          }
          if (v1369 <= v1290.brushBack * (v1363 - v1318)) {
            v1364 = v1318, v1365 = 3;
            break;
          }
        }
        if (!v1290.auto) continue;
        if (v1368 < 0 || !v1341[v1368]) {
          v1366 < 0 && (v1366 = v1318, v1367 = 0);
          v1367 += Math.hypot(v1319[v1318].x - v1319[v1318 - 1].x, v1319[v1318].y - v1319[v1318 - 1].y, v1319[v1318].z - v1319[v1318 - 1].z);
          if (v1367 >= v1290.maxOut && v1318 < v1363 - 1) {
            v1364 = Math.max(v1290.keepPts, v1366), v1365 = 2;
            break;
          }
        } else v1366 = -1;
      }
      v1364 === v1363 && v1290.auto && v1366 >= 0 && v1367 >= v1290.minTail && (v1364 = Math.max(v1290.keepPts, v1366), v1365 = 1);
      if (v1364 >= v1363) continue;
      for (v1318 = v1364; v1318 < v1363; v1318++) v1362 += Math.hypot(v1319[v1318].x - v1319[v1318 - 1].x, v1319[v1318].y - v1319[v1318 - 1].y, v1319[v1318].z - v1319[v1318 - 1].z);
      var v1372 = v1319.slice(0, v1364);
      try {
        v1372._pre = v1319._pre && v1319._pre.length === v1319.length ? v1319._pre.slice(0, v1364) : v1372;
      } catch (v1380) {}
      var v1373 = Object.assign({}, v1320, {
        pts: v1372
      });
      try {
        if (v1320.colors && v1320.colors.length === v1319.length) v1373.colors = v1320.colors.slice(0, v1364);
        if (v1320.srcColors && v1320.srcColors.length === v1319.length) v1373.srcColors = v1320.srcColors.slice(0, v1364);
      } catch (v1381) {}
      v1358[v1317] = v1373;
      if (v1365 === 1) v1359++;else {
        if (v1365 === 2) v1360++;else v1361++;
      }
    }
    return v1291.strands = v1316, v1291.autoCut = v1359, v1291.loopCut = v1360, v1291.brushCut = v1361, v1291.cutLen = v1362, v1291.ms = v1294() - v1315, v1297.set(v1311, {
      ver: v1292,
      nSm: v1313,
      out: v1358
    }), v1358;
  }
  v1290._pass = v1298, v1290._apply = function (v1382) {
    try {
      return v1298(v1382);
    } catch (v1383) {
      return v1291.err = String(v1383 && v1383.message || v1383), v1382;
    }
  }, v1290._sigTail = function () {
    return "|ft" + v1292 + (v1296() ? "c" : "s");
  }, v1290.refresh = function () {
    v1292++;
    try {
      if (typeof ADJ_CACHE !== "undefined" && ADJ_CACHE.bump) ADJ_CACHE.bump();
    } catch (v1384) {}
    try {
      if (typeof renderAdjustFrame === "function") renderAdjustFrame();
    } catch (v1385) {}
  };
  var v1299 = v1290.finalStats = {
    runs: 0,
    segs: 0,
    removed: 0,
    cells: 0,
    body: 0,
    lo: 0,
    hi: 0,
    ms: 0,
    objs: 0,
    err: null
  };
  v1290.filterSegments = function (v1386, v1387, v1388) {
    var v1389 = v1294(),
      v1390 = v1388 > 0 ? v1388 : 16.4,
      v1391 = v1290.finalCellCm / v1390,
      v1392,
      v1393,
      v1394 = Infinity,
      v1395 = Infinity,
      v1396 = Infinity,
      v1397 = -Infinity,
      v1398 = -Infinity,
      v1399 = -Infinity,
      v1400,
      v1401,
      v1402;
    for (v1392 = 0; v1392 < v1387 * 2; v1392++) {
      v1400 = v1386[v1392 * 3], v1401 = v1386[v1392 * 3 + 1], v1402 = v1386[v1392 * 3 + 2];
      if (!(v1400 === v1400)) continue;
      if (v1400 < v1394) v1394 = v1400;
      if (v1400 > v1397) v1397 = v1400;
      if (v1401 < v1395) v1395 = v1401;
      if (v1401 > v1398) v1398 = v1401;
      if (v1402 < v1396) v1396 = v1402;
      if (v1402 > v1399) v1399 = v1402;
    }
    if (!isFinite(v1394)) return 0;
    var v1403, v1404, v1405, v1406;
    for (;;) {
      v1403 = Math.floor((v1397 - v1394) / v1391) + 3, v1404 = Math.floor((v1398 - v1395) / v1391) + 3, v1405 = Math.floor((v1399 - v1396) / v1391) + 3, v1406 = v1403 * v1404 * v1405;
      if (v1406 <= 2500000) break;
      v1391 *= 1.26;
    }
    var v1407 = v1394 - v1391,
      v1408 = v1395 - v1391,
      v1409 = v1396 - v1391,
      v1410 = 1 / v1391,
      v1411 = v1391 * 0.5,
      v1412 = new Float32Array(v1406);
    function v1413(v1443, v1444, v1445) {
      return Math.floor((v1443 - v1407) * v1410) + v1403 * (Math.floor((v1444 - v1408) * v1410) + v1404 * Math.floor((v1445 - v1409) * v1410));
    }
    var v1414, v1415, v1416, v1417, v1418, v1419, v1420, v1421, v1422, v1423;
    for (v1392 = 0; v1392 < v1387; v1392++) {
      v1393 = v1392 * 6, v1414 = v1386[v1393], v1415 = v1386[v1393 + 1], v1416 = v1386[v1393 + 2], v1417 = v1386[v1393 + 3], v1418 = v1386[v1393 + 4], v1419 = v1386[v1393 + 5], v1420 = Math.sqrt((v1417 - v1414) * (v1417 - v1414) + (v1418 - v1415) * (v1418 - v1415) + (v1419 - v1416) * (v1419 - v1416));
      if (!(v1420 > 1e-9)) continue;
      v1421 = Math.ceil(v1420 / v1411);
      if (v1421 > 64) v1421 = 64;
      for (v1422 = 0; v1422 < v1421; v1422++) {
        v1423 = (v1422 + 0.5) / v1421, v1412[v1413(v1414 + (v1417 - v1414) * v1423, v1415 + (v1418 - v1415) * v1423, v1416 + (v1419 - v1416) * v1423)] += v1420 / v1421;
      }
    }
    var v1424 = [];
    for (v1392 = 0; v1392 < v1406; v1392++) if (v1412[v1392] > 0) v1424.push(v1412[v1392]);
    if (!v1424.length) return 0;
    v1424.sort(function (v1446, v1447) {
      return v1446 - v1447;
    });
    var v1425 = v1424[v1424.length >> 1],
      v1426 = v1290.finalLo * v1391,
      v1427 = Math.max(v1290.finalHi * v1391, v1290.finalFrac * v1425),
      v1428 = new Uint8Array(v1406),
      v1429 = [],
      v1430 = 0,
      v1431,
      v1432,
      v1433,
      v1434,
      v1435,
      v1436,
      v1437,
      v1438 = v1403 * v1404;
    for (v1392 = 0; v1392 < v1406; v1392++) v1412[v1392] >= v1427 && (v1428[v1392] = 1, v1429.push(v1392), v1430++);
    while (v1429.length) {
      v1392 = v1429.pop(), v1433 = v1392 / v1438 | 0, v1432 = (v1392 - v1433 * v1438) / v1403 | 0, v1431 = v1392 - v1433 * v1438 - v1432 * v1403;
      for (v1436 = -1; v1436 <= 1; v1436++) {
        if (v1433 + v1436 < 0 || v1433 + v1436 >= v1405) continue;
        for (v1435 = -1; v1435 <= 1; v1435++) {
          if (v1432 + v1435 < 0 || v1432 + v1435 >= v1404) continue;
          for (v1434 = -1; v1434 <= 1; v1434++) {
            if (v1431 + v1434 < 0 || v1431 + v1434 >= v1403) continue;
            v1437 = v1431 + v1434 + v1403 * (v1432 + v1435 + v1404 * (v1433 + v1436)), !v1428[v1437] && v1412[v1437] >= v1426 && (v1428[v1437] = 1, v1429.push(v1437), v1430++);
          }
        }
      }
    }
    var v1439 = v1428,
      v1440;
    for (v1440 = 0; v1440 < (v1290.finalDilate | 0); v1440++) {
      var v1441 = new Uint8Array(v1439);
      for (v1392 = 0; v1392 < v1406; v1392++) if (v1439[v1392]) {
        if (v1392 - 1 >= 0) v1441[v1392 - 1] = 1;
        if (v1392 + 1 < v1406) v1441[v1392 + 1] = 1;
        if (v1392 - v1403 >= 0) v1441[v1392 - v1403] = 1;
        if (v1392 + v1403 < v1406) v1441[v1392 + v1403] = 1;
        if (v1392 - v1438 >= 0) v1441[v1392 - v1438] = 1;
        if (v1392 + v1438 < v1406) v1441[v1392 + v1438] = 1;
      }
      v1439 = v1441;
    }
    var v1442 = 0;
    for (v1392 = 0; v1392 < v1387; v1392++) {
      v1393 = v1392 * 6, v1414 = v1386[v1393], v1415 = v1386[v1393 + 1], v1416 = v1386[v1393 + 2], v1417 = v1386[v1393 + 3], v1418 = v1386[v1393 + 4], v1419 = v1386[v1393 + 5];
      if (v1414 === v1417 && v1415 === v1418 && v1416 === v1419) continue;
      !v1439[v1413((v1414 + v1417) * 0.5, (v1415 + v1418) * 0.5, (v1416 + v1419) * 0.5)] && (v1386[v1393 + 3] = v1414, v1386[v1393 + 4] = v1415, v1386[v1393 + 5] = v1416, v1442++);
    }
    return v1299.runs++, v1299.segs = v1387, v1299.removed = v1442, v1299.cells = v1424.length, v1299.body = v1430, v1299.lo = v1426 / v1391, v1299.hi = v1427 / v1391, v1299.ms = v1294() - v1389, v1442;
  };
  function v1300() {
    try {
      return currentScreen;
    } catch (v1448) {
      return "";
    }
  }
  v1290.sweepScene = function () {
    if (!v1290.on || !v1290.final) return 0;
    var v1449 = null;
    try {
      v1449 = model3D && model3D.initialized ? model3D : null;
    } catch (v1452) {
      v1449 = null;
    }
    if (!v1449 || !v1449.headGroup || typeof v1449.headGroup.traverse !== "function") return 0;
    var v1450 = 16.4,
      v1451 = 0;
    try {
      v1450 = modelCmPerUnit() || 16.4;
    } catch (v1453) {}
    v1449.headGroup.traverse(function (v1454) {
      try {
        if (!v1454 || !v1454.isLineSegments || !v1454.geometry || v1454.geometry.index) return;
        var v1455 = v1454.geometry,
          v1456 = v1455.attributes && v1455.attributes.position;
        if (!v1456 || !v1456.array || v1456.itemSize !== 3) return;
        var v1457 = Math.floor(v1456.count / 2);
        if (v1457 < v1290.finalMinSegs) return;
        var v1458 = v1455.userData || (v1455.userData = {});
        if (v1458._ftArr === v1456.array && v1458._ftVer === v1456.version && v1458._ftCfg === v1292) return;
        v1290.filterSegments(v1456.array, v1457, v1450), v1456.needsUpdate = true, v1458._ftArr = v1456.array, v1458._ftVer = v1456.version, v1458._ftCfg = v1292, v1451++;
      } catch (v1459) {
        v1299.err = String(v1459 && v1459.message || v1459);
      }
    });
    if (v1451) v1299.objs = v1451;
    return v1451;
  };
  function v1301() {
    try {
      var v1460 = model3D && model3D.initialized ? model3D : null;
      if (!v1460 || !v1460.renderer || v1460.renderer.__ft) return;
      var v1461 = v1460.renderer,
        v1462 = v1461.render;
      v1461.__ft = true, v1461.render = function () {
        if (v1290.on && v1290.final && v1300() === "model3d") try {
          v1290.sweepScene();
        } catch (v1463) {
          v1299.err = String(v1463 && v1463.message || v1463);
        }
        return v1462.apply(this, arguments);
      };
    } catch (v1464) {}
  }
  return v1290._patchRender = function (v1465) {
    try {
      v1301();
      if (v1465 && typeof v1465.then === "function") v1465.then(v1301, function () {});
    } catch (v1466) {}
  }, v1290._panelLines = function () {
    var v1467 = [];
    try {
      var v1468 = 16.4;
      try {
        v1468 = modelCmPerUnit() || 16.4;
      } catch (v1470) {}
      var v1469 = v1291.autoCut + v1291.loopCut + v1291.brushCut;
      v1467.push(v1289 + " " + (!v1290.on ? "꺼짐" : !v1291.curly ? "대기 — 컬 평균 " + v1291.curl + " < " + v1290.minCurl + " (직모는 빗질 = 결 정렬 그대로)" : "켜짐(컬 평균 " + v1291.curl + ") · 직전 가닥 " + v1291.strands + "개 중 자른 것 " + v1469 + "개 — 밖에서 끝난 꼬리 " + v1291.autoCut + " · 멀리 나간 고리 " + v1291.loopCut + " · 빗이 지나간 자리 " + v1291.brushCut + " · 자른 길이 평균 " + (v1469 ? (v1291.cutLen / v1469 * v1468).toFixed(1) : "0") + "cm · 몸통 칸 " + v1291.body + "/" + v1291.cells + "(기준 가닥 " + v1291.thr.toFixed(1) + "개) · " + Math.round(v1291.ms) + "ms" + " · 이 머리에서는 빗 = 가위(53번 결 정렬은 건너뜀)") + (v1291.err ? " · ⚠ " + v1291.err : "")), v1467.push("  3D 결과 화면 선분 거르기: " + (!v1290.on || !v1290.final ? "꺼짐" : !v1299.runs ? "켜짐 · 아직 결과 화면을 안 그림" : "켜짐 · 직전 묶음 선분 " + v1299.segs + "개 중 뺀 것 " + v1299.removed + "개(" + (v1299.removed / Math.max(1, v1299.segs) * 100).toFixed(1) + "%) · 머리 있는 칸 " + v1299.cells + " 중 몸통 " + v1299.body + " · 기준: 가닥 " + v1299.lo.toFixed(1) + "개 이상 이어진 칸(씨앗 " + v1299.hi.toFixed(1) + "개) · " + Math.round(v1299.ms) + "ms · 처리한 횟수 " + v1299.runs) + (v1299.err ? " · ⚠ " + v1299.err : ""));
    } catch (v1471) {}
    return v1467;
  }, console.log(v1289 + " 설치 — 컬이 있는 머리(섹션 컬 평균 " + v1290.minCurl + " 이상)는 몸통에서 벗어난 잔머리를 잘라 내고, 빗질도 정렬 대신 자르기로 동작합니다. 끄기 FLY_TRIM.on=false 후 FLY_TRIM.refresh()"), v1290;
}();
function combRefresh() {
  if (typeof drawAdjustPreview === "function") drawAdjustPreview();
  if (typeof refreshDevMini3D === "function") refreshDevMini3D();
  const b = document.getElementById("combUndoBtn");
  if (b) b.disabled = !COMB.strokes.length;
}
/* 화면 좌표 → 지금 보이는 가닥 중 가장 가까운 점(3D). 역투영을 새로 만들지
   않고 <b>렌더가 쓰는 정투영</b>을 그대로 되돌려 쓴다 — 두 경로가 갈라지지 않게. */
function combPickAnchor(px, py) {
  const P = COMB._proj,
    m = state.hair3Dneutral;
  if (!P || !m || !m.strands || !m.strands.length) return null;
  const adj = computeAdjustedHair3DStrands(null, Math.max(1, m.strands.length / 900));
  if (!adj || !adj.length) return null;
  let best = null,
    bd = Infinity;
  const occ = makeViewOccluder(P.cal);
  for (const v1472 of adj) {
    for (const v1473 of v1472.pts) {
      const v1474 = project3DPointToView(v1473, P.cal, P.yTop, P.CY);
      // 가려진 자리의 가닥은 못 집는다
      if (!viewPointVisible(v1474, occ, state.hairMasks && state.hairMasks[P.angle])) continue;
      const v1475 = P.toCX(v1474.ix) - px,
        v1476 = P.toCY(v1474.iy) - py,
        v1477 = v1475 * v1475 + v1476 * v1476;
      v1477 < bd && (bd = v1477, best = v1473);
    }
  }
  return best ? {
    x: best.x,
    y: best.y,
    z: best.z,
    dist: Math.sqrt(bd)
  } : null;
}
/* 캔버스 이동량 → 월드 변위. 화면 드래그이므로 <b>카메라 상면</b>에 놓는다:
   이미지 x는 모델 x(cal.s), 이미지 y는 모델 y(cal.sy, 부호 반대), 깊이 0.
   그 다음 이 뷰의 실측 포즈로 되돌린다(리프트가 쓰는 것과 같은 R^T). */
function combDeltaToWorld(dxPx, dyPx) {
  const P = COMB._proj;
  if (!P) return null;
  const dIx = dxPx / Math.max(0.000001, P.pxScale),
    dIy = dyPx / Math.max(0.000001, P.pxScale),
    rot = composeRotationZYX(P.cal.yaw, P.cal.pitch, P.cal.roll),
    v = applyRotationTranspose3(rot, new THREE.Vector3(dIx * P.cal.s, -dIy * P.cal.sy, 0));
  return {
    x: v.x,
    y: v.y,
    z: v.z
  };
}
function combRadiusModel() {
  const P = COMB._proj;
  if (!P) return 0;
  return COMB.radiusPx / Math.max(0.000001, P.pxScale) * P.cal.s;
}
let _combGroup = 0;
function combStrokeFromDrag(anchor, dxPx, dyPx) {
  const d = combDeltaToWorld(dxPx, dyPx),
    r = combRadiusModel();
  if (!d || !(r > 0)) return null;
  COMB.strokes.push({
    p: {
      x: anchor.x,
      y: anchor.y,
      z: anchor.z
    },
    d: d,
    r: r,
    g: _combGroup
  });
  if (COMB.strokes.length > COMB.maxStrokes) COMB.strokes.shift();
  return combSplat(anchor, d, r), d;
}
/* 빗질(COMB)은 <b>주차</b>다 (2026-08-08). 엔진(변위장·길이보존·되돌리기)은
   검증까지 끝났지만, 사용자가 말한 시술모드는 "빗질할 수 있는 모드"가 아니라
   <b>마네킹 초기화 상태</b>였다. UI를 붙이지 않으므로 COMB.on은 계속 false이고
   빗질 경로는 한 번도 안 탄다(비용 0). 나중에 필요하면 버튼 하나만 다시 달면 된다. */
/* (2026-08-25) 주차 해제 — 조정화면 모드바에 버튼을 달았다. 위 "주차" 주석의
   "나중에 필요하면 버튼 하나만 다시 달면 된다"가 이것이다. 엔진은 안 건드렸다. */
function toggleCombMode() {
  COMB.on = !COMB.on, syncCombBtn(), combRefresh();
}
function syncCombBtn() {
  const v = document.getElementById("gyst-comb");
  if (v) v.textContent = COMB.on ? "ON" : "OFF";
  const b = document.getElementById("combBtn");
  if (!b) return;
  b.classList.toggle("on", COMB.on), b.textContent = COMB.on ? "빗질 ON" : "빗질 OFF";
}
/* 마네킹 리셋 — 시술을 <b>깨끗한 바닥</b>에서 시작하기 위한 초기화.
     · 스타일링(넘김·볼륨·결흐름·가르마) 전부 중립
     · 빗질 삭제
     · 손님 머리에 구워져 있는 웨이브를 편다(생머리)
   커트·펌·컬러는 <b>시술 결과</b>라 건드리지 않는다 — 되돌리려면 '초기화'. */
function mannequinReset() {
  const v1478 = REGROW._beforeMqReset();
  if (typeof ORIG_ASIS !== "undefined") ORIG_ASIS._onMannequinReset();
  state.stylingByView = neutralStylingByView(), combClear(), COMB.on = false, syncCombBtn(), MANNEQUIN.on = true, state.hair3Dmannequin = null, syncMannequinBtn();
  if (typeof buildGyControls === "function") buildGyControls();
  combRefresh(), REGROW._afterMqReset(v1478), COMB3D._afterUi("mannequinReset");
}
function syncMannequinBtn() {
  const b = document.getElementById("mannequinBtn");
  if (!b) return;
  b.classList.toggle("on", MANNEQUIN.on), b.textContent = MANNEQUIN.on ? "마네킹 초기화 ON" : "마네킹 초기화 OFF";
  !MANNEQUIN.on && (state.specAppliedId = null, state._specUndo = null);
  if (typeof ORIG_MQ !== "undefined") ORIG_MQ._btnTail();
  if (typeof STYLE_PATHS !== "undefined") STYLE_PATHS.btnSync();
}
/* 켜면 마네킹 모델(절차 생성)로, 끄면 촬영 가닥 모델로 돌아간다.
   스타일링은 끌 때 되돌리지 않는다 — 끄는 건 "손님 원래 머리 보기"지
   "리셋"이 아니다. */
/* 스펙 적용 + 화면 갱신. 시술은 마네킹 상태에서 시작하는 게 원칙이라 꺼져 있으면 켠다.
   (2026-08-09) 중립 모델이 아직 없으면 예전엔 console.warn 한 줄 찍고 <b>조용히</b>
   끝났다 — 조정 화면에 막 들어온 순간(리프트는 120ms 뒤에 시작한다)에 누르면
   버튼이 먹지 않은 것처럼 보였고, 그게 "적용이 안 된다"로 읽혔다. 이제 모델을
   만들고 나서 다시 건다(한 번만 재시도한다 — 실패가 반복되면 원인은 다른 데 있다). */
/* ── 스펙은 <b>껐다 켤 수 있어야 한다</b> (2026-08-09) ──────────────────────
   사용자: "레이어드 보브 버튼 적용은 되는데 꺼지질 않아."
   맞다. 누를 때마다 다시 걸기만 했다. 그러면 <b>비교를 못 한다</b> — 스펙이
   뭘 바꿨는지 보려면 끄고 켜 봐야 하는데 그 길이 없었다.

   되돌릴 때 기본값으로 리셋하지 <b>않는다</b>. 미용사가 스펙을 걸기 전에 이미
   손으로 만져 둔 값이 있을 수 있고, 그걸 기본값으로 밀어버리면 "껐다"가 아니라
   "지웠다"가 된다. 걸기 직전 상태를 통째로 찍어 두고 그대로 돌려놓는다.
   (마네킹 ON/OFF는 건드리지 않는다 — 그건 별개 손잡이다.) */
/* (2026-08-29 2차) 여기 잠깐 있던 SPEC_BUTTONS/syncSpecButtons/specBtnEl 삭제 —
   모드바의 스펙 버튼 두 개가 없어졌으니 잡을 대상이 없다. 그 지도가 고쳤던 버그
   (버튼이 늘었는데 세 곳이 specBtn 하나만 잡던 것)는 버튼이 사라지며 함께 소멸.
   지금 "무엇이 걸려 있는가"를 말하는 자리는 미리보기 딱지(adjustStyleTag) 하나다. */
function snapshotForSpec() {
  /** (9/23 원본 주석 — 코드가 바뀌어 제자리를 못 찾음)
     · (2026-09-16) 해제하면 클리퍼도 걸기 직전으로
  */
  return {
    sections: JSON.parse(JSON.stringify(state.sections)),
    stylingByView: JSON.parse(JSON.stringify(state.stylingByView || neutralStylingByView())),
    fade: state.fade ? JSON.parse(JSON.stringify(state.fade)) : null
  };
}
function clearStyleSpec() {
  const s = state._specUndo;
  state._specUndo = null, state.specAppliedId = null;
  if (typeof BRAID !== "undefined") BRAID.on = false;
  if (s) {
    state.sections = s.sections, state.stylingByView = s.stylingByView;
    if (s.fade && state.fade) Object.assign(state.fade, s.fade);
  }
  if (typeof buildGyPanel === "function") buildGyPanel();
  const tag = document.getElementById("adjustStyleTag");
  if (tag) tag.textContent = state.selectedStyle && state.selectedStyle.name || "스타일 미선택";
  console.log("[스타일스펙] 해제 — 걸기 직전 값으로 되돌림" + (s ? "" : " (되돌릴 스냅샷이 없어 현재 값 유지)")), combRefresh();
  try {
    ADJ_CACHE.bump();
  } catch (v1479) {}
  return FLOW_SPEC._afterClear(), null;
}
function applyStyleSpecAndRender(id, _retried) {
  {
    const v1480 = FLOW_SPEC._asr(id);
    if (v1480.handled) return v1480.value;
  }
  if (state.specAppliedId === id) return clearStyleSpec();
  if (!MANNEQUIN.on) mannequinReset();
  /* 스타일 적용은 여러 단계가 순차로 돈다 — 단계마다 다시 그리지 않게 <b>문</b>으로 묶는다
       (10-hair-render-2d.js의 RENDER_GATE 배너). 끝에 한 번만 그린다. */
  /* (2026-08-29 2차) 진행 표시를 <b>버튼 라벨에서 미리보기 딱지로</b> 옮겼다.
         버튼이 없어졌기 때문이기도 하지만, 이제 이 경로는 미용사가 누르는 게
         아니라 조정 화면에 들어오면 <b>저절로</b> 도는 자리라서 그렇다 —
         아무 표시가 없으면 몇 초 동안 "왜 스타일이 안 걸렸지"로 읽힌다. */
  if (!state.hair3Dneutral) {
    if (_retried || typeof buildNeutralHair3D !== "function") return console.warn("[스타일스펙] 3D 모델을 못 만들었다 — 촬영/세그멘테이션부터 확인할 것"), null;
    const v1481 = document.getElementById("adjustStyleTag");
    if (v1481) v1481.textContent = "3D 준비 중…";
    return buildNeutralHair3D(() => {
      applyStyleSpecAndRender(id, true);
    }), null;
  }
  // 걸기 <b>직전</b> 상태 — 해제하면 여기로 돌아온다
  const undo = snapshotForSpec(),
    rep = typeof withRenderGate === "function" ? withRenderGate(() => _applyStyleSpecBody(id, undo), "스타일 적용") : _applyStyleSpecBody(id, undo);
  return rep;
}
function _applyStyleSpecBody(id, undo) {
  const rep = applyStyleSpec(id);
  if (!rep) return null;
  state._specUndo = undo, state.specAppliedId = id;
  if (typeof buildGyPanel === "function") buildGyPanel();else {
    if (typeof buildGyControls === "function") buildGyControls();
  }
  const tag = document.getElementById("adjustStyleTag");
  if (tag) tag.textContent = rep.name || "스타일 스펙 적용";
  return combRefresh(), rep;
}
function toggleMannequin() {
  const v1482 = MANNEQUIN.on,
    v1483 = ORIG_MQ._beforeToggle();
  if (v1483 === "handled") {
    toggleMannequinBareCheck(v1482);
    return;
  }
  const v1484 = REGROW._beforeToggleMq();
  MANNEQUIN.on ? (MANNEQUIN.on = false, syncMannequinBtn(), combRefresh()) : mannequinReset();
  REGROW._afterToggleMq(v1484), COMB3D._afterUi("toggleMannequin");
  if (v1483 === "inner") ORIG_MQ._syncBtn();
  toggleMannequinBareCheck(v1482);
}
function toggleMannequinBareCheck(v1485) {
  try {
    if (!v1485 && MANNEQUIN.on && typeof ORIG_MQ !== "undefined" && typeof ORIG_MQ.bare === "function") {
      let v1486 = 0;
      try {
        Object.keys(state.sections || {}).forEach(v1487 => {
          if ((state.sections[v1487].curl || 0) > 0) v1486++;
        });
      } catch (v1488) {}
      (v1486 || state._globalCurl) && (ORIG_MQ.bare(), console.log("[64] 마네킹 켬 — 남아 있던 컬 지움(섹션 " + v1486 + "곳) → 맨 마네킹"));
    }
  } catch (v1489) {
    console.warn("[64] 맨 마네킹 맞추기 실패", v1489);
  }
}
var CROWN_FILL = {
  on: true,
  mul: 1,
  phiMax: 0.75,
  NP: 24,
  NT: 32,
  maxAddFrac: 0.6,
  maxSrcDist: 2.5
};
function crownFill(v1490) {
  if (!CROWN_FILL.on || !v1490 || !v1490.strands || !v1490.strands.length) return v1490;
  var v1491 = null;
  try {
    v1491 = getScalpEllipsoid();
  } catch (v1537) {}
  if (!v1491) return v1490;
  var v1492 = isFinite(v1490.CY) ? v1490.CY : typeof SCALP_CENTER_Y !== "undefined" ? SCALP_CENTER_Y : 0.15,
    v1493 = CROWN_FILL.NP,
    v1494 = CROWN_FILL.NT,
    v1495 = Math.PI / v1493,
    v1496 = 2 * Math.PI / v1494;
  function v1497(v1538, v1539) {
    return {
      x: v1491.a * Math.sin(v1538) * Math.sin(v1539),
      y: v1492 + v1491.b * Math.cos(v1538),
      z: v1491.c * Math.sin(v1538) * Math.cos(v1539)
    };
  }
  function v1498(v1540, v1541) {
    var v1542 = (v1540 + 0.5) * v1495,
      v1543 = (v1541 + 0.5) * v1496 - Math.PI,
      v1544 = 0.0001,
      v1545 = v1497(v1542, v1543),
      v1546 = v1497(v1542 + v1544, v1543),
      v1547 = v1497(v1542, v1543 + v1544),
      v1548 = v1546.x - v1545.x,
      v1549 = v1546.y - v1545.y,
      v1550 = v1546.z - v1545.z,
      v1551 = v1547.x - v1545.x,
      v1552 = v1547.y - v1545.y,
      v1553 = v1547.z - v1545.z,
      v1554 = v1549 * v1553 - v1550 * v1552,
      v1555 = v1550 * v1551 - v1548 * v1553,
      v1556 = v1548 * v1552 - v1549 * v1551;
    return Math.sqrt(v1554 * v1554 + v1555 * v1555 + v1556 * v1556) / (v1544 * v1544) * v1495 * v1496;
  }
  function v1499(v1557) {
    var v1558 = Math.acos(Math.max(-1, Math.min(1, (v1557.y - v1492) / v1491.b))),
      v1559 = Math.atan2(v1557.x / v1491.a, v1557.z / v1491.c),
      v1560 = Math.min(v1493 - 1, Math.floor(v1558 / v1495)),
      v1561 = Math.min(v1494 - 1, Math.floor((v1559 + Math.PI) / v1496));
    return v1560 * v1494 + v1561;
  }
  var v1500 = new Array(v1493 * v1494);
  for (var v1501 = 0; v1501 < v1490.strands.length; v1501++) {
    var v1502 = v1490.strands[v1501];
    if (!v1502 || !v1502.pts || !v1502.pts.length) continue;
    var v1503 = v1499(v1502.pts[0]);
    (v1500[v1503] || (v1500[v1503] = [])).push(v1502);
  }
  var v1504 = [];
  for (var v1505 = 0; v1505 < v1493; v1505++) {
    var v1506 = (v1505 + 0.5) * v1495;
    if (v1506 < 0.9 || v1506 > 1.6) continue;
    for (var v1507 = 0; v1507 < v1494; v1507++) {
      var v1508 = v1500[v1505 * v1494 + v1507];
      if (v1508 && v1508.length >= 3) v1504.push(v1508.length / v1498(v1505, v1507));
    }
  }
  if (v1504.length < 8) return v1490;
  v1504.sort(function (v1562, v1563) {
    return v1562 - v1563;
  });
  var v1509 = v1504[v1504.length >> 1] * CROWN_FILL.mul,
    v1510 = Math.round(v1490.strands.length * CROWN_FILL.maxAddFrac),
    v1511 = 0,
    v1512 = 0,
    v1513 = 0,
    v1514 = 97531;
  function v1515() {
    return v1514 = v1514 * 1103515245 + 12345 & 2147483647, v1514 / 2147483647;
  }
  for (v1505 = 0; v1505 < v1493 && v1511 < v1510; v1505++) {
    if ((v1505 + 0.5) * v1495 > CROWN_FILL.phiMax) break;
    for (v1507 = 0; v1507 < v1494 && v1511 < v1510; v1507++) {
      var v1516 = v1498(v1505, v1507),
        v1517 = (v1500[v1505 * v1494 + v1507] || []).length,
        v1518 = Math.round(v1509 * v1516);
      if (v1517 >= v1518) continue;
      var v1519 = [];
      for (var v1520 = -1; v1520 <= 1; v1520++) for (var v1521 = -1; v1521 <= 1; v1521++) {
        var v1522 = v1505 + v1520;
        if (v1522 < 0 || v1522 >= v1493) continue;
        var v1523 = v1500[v1522 * v1494 + ((v1507 + v1521) % v1494 + v1494) % v1494];
        if (v1523) v1519 = v1519.concat(v1523);
      }
      if (!v1519.length) {
        v1513++;
        continue;
      }
      var v1524 = Math.sqrt(v1516);
      v1512++;
      for (var v1525 = v1517; v1525 < v1518 && v1511 < v1510; v1525++) {
        var v1526 = v1497((v1505 + v1515()) * v1495, (v1507 + v1515()) * v1496 - Math.PI),
          v1527 = null,
          v1528 = Infinity;
        for (var v1529 = 0; v1529 < v1519.length; v1529++) {
          var v1530 = v1519[v1529].pts[0],
            v1531 = (v1530.x - v1526.x) * (v1530.x - v1526.x) + (v1530.y - v1526.y) * (v1530.y - v1526.y) + (v1530.z - v1526.z) * (v1530.z - v1526.z);
          v1531 < v1528 && (v1528 = v1531, v1527 = v1519[v1529]);
        }
        if (!v1527 || Math.sqrt(v1528) > CROWN_FILL.maxSrcDist * v1524 + 0.000001) {
          v1513++;
          break;
        }
        var v1532 = v1527.pts[0],
          v1533 = v1526.x - v1532.x,
          v1534 = v1526.y - v1532.y,
          v1535 = v1526.z - v1532.z,
          v1536 = Object.assign({}, v1527, {
            pts: v1527.pts.map(function (v1564) {
              return {
                x: v1564.x + v1533,
                y: v1564.y + v1534,
                z: v1564.z + v1535
              };
            }),
            _crownAdded: true
          });
        if (v1527.colors && v1527.colors.slice) v1536.colors = v1527.colors.slice();
        v1490.strands.push(v1536), v1511++;
      }
    }
  }
  return console.log("[앞머리 길이] [정수리 채움] 기준 밀도(옆·뒤 중앙) ×" + CROWN_FILL.mul + " · 모자란 칸 " + v1512 + "개에 " + v1511 + "가닥 추가" + (v1513 ? " · 원본이 멀어 건너뛴 칸 " + v1513 : "") + " · 끄기 CROWN_FILL.on=false"), v1490;
}
function setCrownFill(v1565) {
  CROWN_FILL.mul = Math.max(0.5, Math.min(3, +v1565 || 1));
  if (typeof state !== "undefined" && state) state.hair3Dmannequin = null;
  try {
    if (typeof ADJ_CACHE !== "undefined") ADJ_CACHE.bump();
  } catch (v1566) {}
  try {
    if (typeof combRefresh === "function") combRefresh();
  } catch (v1567) {}
  return CROWN_FILL.mul;
}
var _hairDensityBase = null;
function setHairDensity(v1568) {
  v1568 = Math.max(0.5, Math.min(3, +v1568 || 1));
  var v1569 = window.ROOT_EVEN,
    v1570 = typeof HAIR3D_RENDER !== "undefined" ? HAIR3D_RENDER : null;
  if (!_hairDensityBase) _hairDensityBase = {
    boost: v1569 ? v1569.boost : 1.2,
    maxAdd: v1569 ? v1569.maxAddFrac : 1.2,
    mul: v1570 ? v1570.targetMul : 1.5
  };
  v1569 && (v1569.boost = _hairDensityBase.boost * v1568, v1569.maxAddFrac = _hairDensityBase.maxAdd * v1568);
  if (v1570) v1570.targetMul = _hairDensityBase.mul * v1568;
  if (typeof state !== "undefined" && state) state.hair3Dmannequin = null;
  try {
    if (typeof ADJ_CACHE !== "undefined") ADJ_CACHE.bump();
  } catch (v1571) {}
  EYE_GUARD._geo = null;
  try {
    if (typeof combRefresh === "function") combRefresh();
  } catch (v1572) {}
  return console.log("[앞머리 길이] 숱 ×" + v1568 + " — ROOT_EVEN.boost " + (v1569 && v1569.boost.toFixed(2)) + " · maxAddFrac " + (v1569 && v1569.maxAddFrac.toFixed(2)) + " · HAIR3D_RENDER.targetMul " + (v1570 && v1570.targetMul.toFixed(2)) + " (되돌리기 setHairDensity(1))"), v1568;
}
console.log("[앞머리 길이] 설치 — 앞머리 기본 끝 " + EYE_GUARD.defaultTipFaceFrac + " · 가닥 자르기 없음(얼굴 가림은 FACE_COVER_CHECK가 검사만 함)");
/* (2026-10-17) 끝단 퍼짐 — 사용자: "뒤모습에서 보면 머리 끝단이 옆으로 좀 퍼져야 하는데 그렇게 안 나왔다".
   같은 사진: 뒷모습 머리 폭이 끝으로 갈수록 두상 폭의 약 2배(A라인)인데, 3D는 끝이 모이는 V자였다.
   사진(뒤 → 없으면 정면) 머리 영역에서 위→아래 폭 비율을 재고, 3D 가닥의 같은 높이 폭이 그보다 좁으면
   어깨 아래부터 가로(x)로만 벌린다(좁히지는 않음). 원본 머리(__original__/마네킹 끔)에만.
   끄기 TIP_FLARE.on=false · 최대 배수 TIP_FLARE.maxScale · 시작 높이 TIP_FLARE.fromT(0=정수리 1=끝) */
var TIP_FLARE = {
  on: true,
  fromT: 0.35,
  rampT: 0.15,
  maxScale: 2.4,
  bands: 24,
  cmpMaxT: 0.85,
  backOnly: true,
  pct: 0.9,
  stats: null
};
function tipFlarePhotoProfile() {
  var views = ["back", "front"];
  for (var v = 0; v < views.length; v++) {
    var m = state.hairMasks && state.hairMasks[views[v]];
    if (!m || !m.scalpY || !m.hairEndY) continue;
    var W = m.scalpY.length,
      top = 1e9,
      bot = [];
    for (var x = 0; x < W; x++) {
      if (m.scalpY[x] >= 0 && m.hairEndY[x] > m.scalpY[x]) {
        if (m.scalpY[x] < top) top = m.scalpY[x];
        bot.push(m.hairEndY[x]);
      }
    }
    if (bot.length < 20) continue;
    bot.sort(function (a, b) {
      return a - b;
    });
    var end = bot[Math.floor(bot.length * 0.9)];
    if (!(end > top + 10)) continue;
    var N = TIP_FLARE.bands,
      prof = new Float64Array(N);
    for (var b = 0; b < N; b++) {
      var y = top + (end - top) * (b + 0.5) / N,
        lo = 1e9,
        hi = -1;
      for (var x2 = 0; x2 < W; x2++) {
        if (m.scalpY[x2] >= 0 && m.scalpY[x2] <= y && m.hairEndY[x2] >= y) {
          if (x2 < lo) lo = x2;
          if (x2 > hi) hi = x2;
        }
      }
      prof[b] = hi >= lo ? hi - lo + 1 : 0;
    }
    var head = 0;
    for (var b2 = 0; b2 < Math.ceil(N * 0.25); b2++) head = Math.max(head, prof[b2]);
    if (!(head > 0)) continue;
    for (var b3 = 0; b3 < N; b3++) prof[b3] /= head;
    return {
      view: views[v],
      ratio: prof
    };
  }
  return null;
}
function tipFlareAll(strands) {
  if (!TIP_FLARE.on || !strands || !strands.length) return strands;
  var orig = false;
  try {
    orig = state.specAppliedId === "__original__" || typeof MANNEQUIN !== "undefined" && !MANNEQUIN.on;
  } catch (e) {}
  if (!orig) return strands;
  var P = null;
  try {
    P = tipFlarePhotoProfile();
  } catch (e) {
    P = null;
  }
  if (!P) return strands;
  var N = TIP_FLARE.bands,
    yTop = -1e9,
    tips = [];
  for (var i = 0; i < strands.length; i++) {
    var p = strands[i] && strands[i].pts;
    if (!p || p.length < 2) continue;
    if (p[0].y > yTop) yTop = p[0].y;
    tips.push(p[p.length - 1].y);
  }
  if (tips.length < 50) return strands;
  tips.sort(function (a, b) {
    return a - b;
  });
  var yBot = tips[Math.floor(tips.length * 0.1)];
  if (!(yTop > yBot)) return strands;
  var bandAbs = [];
  for (var b = 0; b < N; b++) bandAbs.push([]);
  var tOf = function (y) {
    return (yTop - y) / (yTop - yBot);
  };
  for (var i2 = 0; i2 < strands.length; i2++) {
    var q = strands[i2] && strands[i2].pts;
    if (!q) continue;
    for (var k = 0; k < q.length; k += 2) {
      if (TIP_FLARE.backOnly && !(q[k].z < 0)) continue;
      var t = tOf(q[k].y);
      if (t < 0 || t >= 1) continue;
      bandAbs[Math.floor(t * N)].push(Math.abs(q[k].x));
    }
  }
  var cur = new Float64Array(N);
  for (var b4 = 0; b4 < N; b4++) {
    var a = bandAbs[b4];
    if (a.length < 10) {
      cur[b4] = 0;
      continue;
    }
    a.sort(function (u, v) {
      return u - v;
    });
    cur[b4] = 2 * a[Math.floor(a.length * TIP_FLARE.pct)];
  }
  var head3 = 0;
  for (var b5 = 0; b5 < Math.ceil(N * 0.25); b5++) head3 = Math.max(head3, cur[b5]);
  if (!(head3 > 0)) return strands;
  var sc = new Float64Array(N);
  /* 끝단 가장자리는 둥글게 짧아져 폭이 줄어드는 게 정상이라 cmpMaxT(0.85)까지만 비교하고, 그 아래는 0.85의 배수를 그대로 쓴다 */
  var bMax = Math.max(1, Math.floor(TIP_FLARE.cmpMaxT * N));
  for (var b6 = 0; b6 < N; b6++) {
    var bb = Math.min(b6, bMax),
      tgt = P.ratio[bb] * head3;
    sc[b6] = cur[bb] > 0 && tgt > cur[bb] ? Math.min(TIP_FLARE.maxScale, tgt / cur[bb]) : 1;
  }
  for (var r = 0; r < 2; r++) {
    var s2 = Float64Array.from(sc);
    for (var b7 = 1; b7 < N - 1; b7++) sc[b7] = (s2[b7 - 1] + 2 * s2[b7] + s2[b7 + 1]) / 4;
  }
  var scaleAt = function (t) {
    if (t <= TIP_FLARE.fromT) return 1;
    var f = Math.min(1, (t - TIP_FLARE.fromT) / TIP_FLARE.rampT),
      ff = f * f * (3 - 2 * f);
    var bi = Math.min(N - 1, Math.max(0, Math.floor(Math.min(t, 0.999) * N)));
    return 1 + (sc[bi] - 1) * ff;
  };
  var out = strands.slice(),
    moved = 0,
    maxS = 1;
  for (var i3 = 0; i3 < strands.length; i3++) {
    var st = strands[i3],
      pp = st && st.pts;
    if (!pp || pp.length < 2) continue;
    var np = null;
    for (var k2 = 1; k2 < pp.length; k2++) {
      var g = scaleAt(tOf(pp[k2].y));
      if (g > 1.0005) {
        if (!np) np = pp.slice();
        np[k2] = Object.assign({}, pp[k2], {
          x: pp[k2].x * g
        });
        if (g > maxS) maxS = g;
      }
    }
    if (np) {
      out[i3] = Object.assign({}, st, {
        pts: np
      });
      moved++;
    }
  }
  TIP_FLARE.stats = {
    view: P.view,
    moved: moved,
    maxScale: +maxS.toFixed(2),
    photoTip: +P.ratio[Math.floor(TIP_FLARE.cmpMaxT * N)].toFixed(2),
    model3dTip: +(cur[Math.floor(TIP_FLARE.cmpMaxT * N)] / head3).toFixed(2)
  };
  if (!TIP_FLARE._logged) {
    TIP_FLARE._logged = true;
    try {
      console.log("[끝단 퍼짐] " + P.view + " 사진 아래쪽(85%) 폭 = 두상의 " + TIP_FLARE.stats.photoTip + "배 · 3D " + TIP_FLARE.stats.model3dTip + "배 → 가닥 " + moved + "개 벌림(최대 ×" + TIP_FLARE.stats.maxScale + ") · 끄기 TIP_FLARE.on=false");
    } catch (e) {}
  }
  return out;
}
/** (9/23 원본의 맨 윗단 주석 — 제자리를 못 찾음)
   · 가닥당 마디 수(촬영 가닥의 점 수와 비슷한 수준)
   · 뿌리에서 법선 → 중력으로 넘어가는 구간. (2026-08-09) <b>길이 비율에서
     고정 거리로</b> 바뀌었다 — 거리는 실측 모발 두께(헐−두피)를 그대로 쓴다.
     rootRampMax는 그 두께가 가닥 길이보다 클 때(아주 짧은 커트)의 상한일 뿐.
   · 두피에서 살짝 띄워 시작(정확히 표면이면 첫 밀어냄이 불안정)
   · 섹션 길이 = 촬영 가닥 호길이의 이 백분위 (2026-08-09: 0.5 중앙값 → 1.0 최댓값)
     사용자 지정. 이유가 <b>시술의 방향성</b>에 있다: 커트는 <b>빼는</b> 일이다.
     중앙값으로 심으면 그 섹션 가닥의 절반이 손님 실제 머리보다 짧게 시작하고,
     그 부족분은 커트로 되돌릴 수 없다(늘리는 건 자르기가 아니고, 실제로
     CUT3D.maxRatio가 1.8에서 막는다). 그래서 역산이 슬라이더 상한에 붙었다 —
     실기기에서 crown 100(오차 24.9%)이 정확히 그 모습이었다.
     최댓값으로 심으면 모든 가닥이 <b>실측 최장</b>에서 시작하므로 어떤 목표
     길이든 빼기만으로 도달한다. 마네킹 초기 상태가 "아직 안 자른 머리"라는
     정의와도 맞는다. 대가는 초기 길이가 실제보다 길어 보이는 것인데, 시술
     전 상태라 그게 맞다.
   · 이보다 밀도가 낮은 셀은 안 심는다(HAIR_OVERLAP과 같은 기준)
   · 가닥이 타고 흐르는 껍질 위치(모발 두께 안)
   · 두상에 닿아 있는 동안 바깥으로 퍼지는 정도(정수리 갇힘 방지)
   · 끝 높이 = 눈에서 눈→턱의 이 비율만큼 아래.
     (2026-09-02 4차) 0.35(광대) → <b>0</b>(눈높이). 사용자: "눈높이 정도에서
     일자로 되게 정리해줘." 자는 그대로 makeFaceProjector(EYE = CY)다.
   · 앞머리 라인을 <b>가닥 종류와 무관하게</b> 먹인다 (2026-09-02 4차).
     화면에 남아 있던 "중간의 긴 머리"는 앞머리 가닥이 아니었다 — 앞머리로
     안 뽑힌 나머지 40%가 growMannequinStrand로 두상을 타고 내려와 얼굴 앞을
     가로질러 턱 밑까지 떨어진 것이다. 앞머리만 눈높이에 맞추면 그 옆으로
     안 잘린 가닥이 계속 흘러내려 <b>일자가 안 된다</b>. 실제 시술도 뱅은
     "뽑은 가닥만"이 아니라 <b>그 선을 넘는 것 전부</b>를 자른다.
     lineHalfX: 얼굴 앞을 지나는가의 판정 폭(두상 반너비 대비). 이보다 바깥은
     옆머리 커튼이라 안 건드린다.
   · 앞머리 선의 <b>길이 감도</b>와 <b>바닥</b> (2026-09-02 6차).
     · lineGain — 선이 중립(눈높이)에서 벗어나는 폭. 1.0이면 5차 그대로인데
     실기기에서 상단이 인중까지 내려왔다(사용자: "길이값 최고로 하면 얼굴
     사라지는 건 여전"). 비율 자체를 건드리면 커트 길이가 같이 바뀌므로
     <b>선에만</b> 감쇠를 건다 — 머리는 길어지되 앞머리가 얼굴을 삼키지 않는다.
     · lineFloorFaceFrac — 선이 내려갈 수 있는 최저. 눈에서 눈→턱의 이 비율.
     0.40은 대략 <b>코끝</b>이다. 이 아래로는 앞머리가 아니라 커튼이 된다.
     감마가 아니라 <b>하드 클램프</b>인 이유: 감마는 어디서 멈추는지 모르고,
     여기서 알아야 하는 것은 정확히 "얼굴이 남는가"다.
     되돌리기: lineGain = 1, lineFloorFaceFrac = 0 (5차 동작)
   · ── 크라운은 <b>자기 선</b>을 쓴다 · 눈썹 (2026-09-05 사용자 지시) ─────────
     사용자: "마네킹모드에서 크라운 섹션 헤어가닥이 너무 내려와 있는데, 눈썹
     높이 정도로 조정해줘."
     지금까지 선은 <b>하나</b>였다(프론트가 주인, 크라운 지분 0.20 — fringeLineY
     배너). 그래서 크라운 가닥이 프론트와 같은 눈높이까지 내려왔고, 뿌리가 더
     뒤에 있는 만큼 얼굴 앞을 <b>길게</b> 가로질러 화면에서 제일 무겁게 보인다.
     실제 시술도 크라운을 앞으로 당겨 자를 때는 프론트보다 <b>짧게</b> 둔다 —
     그래야 위층이 뜨고 앞머리에 층이 생긴다. 그래서 크라운만 선을 하나 더 긋는다.
     ⚠ "일자가 깨진다"는 fringeLineY의 경고는 <b>여전히 유효</b>하다. 그건
     가닥마다 제 비율을 쓰지 말라는 말이고, 여기서 늘어난 선은 <b>섹션당
     하나</b>다(프론트 한 줄 · 크라운 한 줄). 프론트끼리는 여전히 일자다.
     · crownLine    — 끄면 예전처럼 프론트와 한 선을 쓴다(되돌리기 스위치)
     · crownRiseFrac 0.18 — 눈(CY)에서 <b>위로</b> E.b의 이 비율 = 눈썹.
     새 자가 아니라 mannequinHasFringe가 이미 쓰던 yBrow의 그 값이다
     (이제 양쪽이 mqBrowY 하나를 본다 — 두 벌이 되지 않게).
     · crownAllAround — <b>크라운은 앞머리만이 아니다</b>(2026-09-05 2차 지시:
     "크라운은 앞머리만 말하는 게 아니야. 크라운 전체적으로 눈썹라인 위로").
     1차에서는 선을 그어 놓고 <b>얼굴 앞을 지나는 가닥만</b> 잘랐다
     (mqTrimAtFringeLine의 c.z > faceZ · |x| ≤ halfX 게이트). 그래서 크라운
     중에서도 관자 옆이나 뒤로 흘러내린 가닥은 그대로 남아, 화면에서는
     "크라운이 여전히 길다"로 보인다 — 선은 걸렸는데 <b>절반에만</b> 걸린 것이다.
     이 스위치를 켜면 크라운 가닥은 방향을 안 보고 눈썹 선에서 잘린다.
     ⚠ 뒤로 떨어지는 크라운도 같이 잘린다 — 크라운 섹션이 통째로 <b>눈썹 위
     길이</b>가 된다는 뜻이고, 그게 이번 지시다. 뒤는 남기고 싶어지면 이
     스위치를 끄면 1차(얼굴 앞만) 동작으로 돌아간다.
     · crownFloorBrow — 크라운 선이 <b>눈썹 밑으로는 안 내려간다</b>. 길이
     슬라이더를 최대로 올려도 마찬가지다("눈썹라인 위로"가 상한이 아니라
     <b>경계</b>라는 뜻). 짧게 줄이는 쪽은 그대로 살아 있어 헤어라인까지
     올라간다 — 슬라이더 전 구간이 죽지 않는다(3차의 실패를 안 되풀이한다).
   · front 뿌리 중 앞머리로 내릴 비율
   · crown 뿌리 중 앞머리로 내릴 비율
   · crown은 |θ|가 thFront의 이 배 안(=앞쪽 띠)일 때만 후보
   · 이마 앞으로 뜨는 정도(뿌리~끝 거리 대비)
   · 끝이 중앙 쪽으로 모이는 정도(1이면 안 모임)
   · 이마 앞 표본 중 이 비율 이상이 "머리 있음"이면 안 심는다
   · 뿌리~끝 거리가 이보다 짧으면 앞머리로 안 친다
   · MediaPipe 정중선 정점 — <b>추측하지 않는다</b>. 이마(10)·미간(168)·코끝(1)·
     턱(152)은 이 파일이 detectFaceLandmarks/PROFILE_DEPTH_ANCHORS에서 이미
     쓰는 검증된 인덱스이고, 나머지는 그 사이를 잇는 같은 정중선 위의 점이다.
   · 높이 구간 수 — 선 하나를 표현하는 데 이 이상은 잡음이다
   · [진단] 'side'(실측) | 'ellipsoid'(폴백) | null
   · [진단] 실제로 곡선에 들어간 정점 수
   · 시술모드 ON/OFF
   · 브러시 반경(캔버스 백킹 px) — 화면 확대에 따라 자동 환산
   · 거리 감쇠 지수
   · 이 비율까지의 뿌리 구간은 붙잡혀 있다
   · 변위장 격자 한 변
   · 이만큼 움직여야 한 획으로 친다
   · 획들이 실제로 건드린 범위(AABB). 대부분의 가닥은 여기 밖이라 6번 비교로
   · 통째로 건너뛴다 — 이게 없으면 안 움직이는 가닥까지 8모서리 보간을 돈다
   · (실측: 16,000가닥 442ms → 이 컷으로 대부분 제거).
   · 변위장의 최대 크기(모델 단위) — 클립 여유 계산에 쓴다
   · (11차) 중립 3D 모델에 섹션별 조정 연산자(길이·컬)를 적용해 "조정된 월드 가닥"을
   · 반환. 미니뷰(3D)와 조정창 투영(2D)이 같은 소스를 쓰게 하는 단일 출처.
   · srcAngleFilter를 주면 그 뷰 캡처 가닥만(뷰별 투영 시 교차뷰 잡음 방지).
   · stride: 조정 연산을 적용할 가닥 간격(1=전부). 조정 화면은 어차피 일부만
     그리는데 전 가닥에 길이·컬·중력·가르마·넘김·볼륨·결흐름을 다 돌리면
     그 계산이 렌더 비용의 대부분이 된다(실측: 밀도 2배 → 시간 2배, 그린 다발
     수는 그대로였음). 그릴 것만 계산하도록 호출부가 간격을 넘긴다.
*/
;
