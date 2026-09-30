/* ==========================================================================
 * 24-style-base.js — 스타일 기준점(Style Base) + 슬라이더 중앙화 + 스타일별 엔진 프로필
 *
 * 로드 위치: index.html 에서 23-section-all.js 바로 다음 줄
 *   <script src="js/24-style-base.js?v=20260921g"></script>
 *
 * 하는 일
 *  1) 스타일 = 슬라이더와 무관한 "기준 값".  스타일을 걸면 그 결과를 기준으로 저장하고
 *     모든 섹션 슬라이더의 손잡이는 가운데(중위값)에 둡니다.  손잡이를 움직이면
 *     기준 ± 이동량 = 실제 값.  (엔진은 지금처럼 실제 값을 state.sections 에서 읽습니다.)
 *  2) 길이는 100 에서 잘리던 상한을 LEN_EXT 까지 늘려, 스펙 풀이가 100에 걸리던
 *     섹션(크라운 등)을 끝까지 풀고 그 값을 기준으로 삼습니다.
 *  3) 스타일마다 엔진 설정(컬 번들·볼륨·중력·앞머리·염색 음영)을 "프로필"로 묶어
 *     그 스타일을 걸 때만 적용하고, 다른 스타일로 가면 원래 값으로 되돌립니다.
 *  4) 볼륨 슬라이더 50 = 스타일 기준 볼륨 (예전: 50 = 볼륨 0).
 *  5) 3D 두상 헤어 정점색에 깊이 차폐(AO)·밝기 상한·결 하이라이트를 입혀 입체감을 냅니다.
 *
 * 끄기: 콘솔에서  STYLE_BASE.on = false  (래퍼가 전부 원래 함수로 통과) → 뷰 다시 그리기
 * 상태: STYLE_BASE.status()
 *
 * 변경 이력 (원본 저장소 기준)
 *  2026-09-29 배포본 반영: 숱(density) 막대 제거 · 컬 구간(curlLen) 막대 · 손잡이 가운데=기준값 비대칭 매핑 ·
 *             이분 탐색 16/18회 → 9회 · 자르면 끝 컬도 잘림(cutRemovesCurl) · 가르마 옆 넘김(partSideSweep, 기본 꺼짐) ·
 *             Long Blowout Waves 스타일 · 앞 가르마 자리 뿌리 메우기(fillPartGap)
 *  2026-09-30 병합: 옛 32-shag-curtain.js · 33-layered-bob-tune.js의 엔진 프로필을 아래 SB.profiles로,
 *             옛 31-side-part-perm.js의 앞쪽 뿌리 보강(17a mannequinEvenRoots) 호출을 fillPartGap 래퍼 뒤로 옮김
 * ========================================================================== */
(function () {
  'use strict';
  var G = window;
  var TAG = '[스타일기준]';

  /* ------------------------------------------------------------------------
   * 0. 설정
   * ---------------------------------------------------------------------- */
  var SB = G.STYLE_BASE = G.STYLE_BASE || {};
  SB.on = true;
  SB.LEN_EXT = 200;          // 길이 실제 값 상한 (예전 100)
  // 3D 명암(깊이 차폐·밝기 상한·결 하이라이트) — 미용 기법이 아니라 그리는 품질이라 막대 없이 모든 스타일에 켭니다.
  SB.shade = { ao: 0.42, lumCap: 1.3, spec: 0.22, specPow: 60 };
  /* _volHash 부호 버그 수정 범위
   *  원래 식 h ^= h>>>16 뒤 h/2^32 가 음수가 되어 0~1 대신 −0.5~0.5 를 돌려줍니다.
   *  → 볼륨 노이즈 배수 평균 0.55(최소 0.1), 삐침머리 판정(h<0.25)이 ~75% 가닥에 걸려 끝을 안으로 당김.
   *  false = 프로필이 걸린 스타일에서만 고침(다른 스타일은 지금 보이는 그대로)
   *  true  = 모든 스타일에서 고침(다른 스타일도 볼륨이 커집니다 — 확인 후 켜세요) */
  SB.fixVolHashAll = true;   // 막대만으로 모양을 만들려면 모든 스타일에서 고쳐져 있어야 합니다
  SB.PARAM_KEYS = ['length', 'elevation', 'texture', 'overdirection', 'line', 'curl', 'wave', 'curlDir',
    'base', 'define', 'volShare', 'volPoint', 'weight', 'curlLen'];

  /* 스타일별 엔진 프로필 — 키는 STYLE_SPECS 의 id (또는 커스텀 스타일의 profileId) */
  SB.profiles = {
    wavy_bob_seethrough: {
      label: 'Wavy bob · See-through bangs · Chunky curls',
      // 막대로 옮긴 값(베이스 폭·컬 정리감·부피감·볼륨 위치·처짐·로드 굵기)은 여기서 빼고 스펙에 섹션별로 넣었습니다.
      // 여기 남은 건 막대가 없는 엔진 설정뿐입니다.
      config: {
        CURL_BUNDLE: {
          microAmp: 0.04,      // 잔곱슬 줄임
          microPhase: 0.15,
          relax: 1.2,          // 코일 반경 약간 줄임 (늘어난 용수철 방지)
          pitchThick: 1.4      // 굵은 로드에서 파장이 너무 길어지지 않게 (한 바퀴 ≈ 6cm)
        },
        CURL3D_FIX: { ampGamma: 0.7 },   // 컬 50 → 진폭 0.62
        VOLUME3D: { AMP: 0.18 },
        // HAIR_FIELD3D.maxAlign 은 뺐습니다 — 중립 3D 빌드 때만 쓰이는 값이라 스타일마다 바꾸면
        // 스타일을 고를 때마다 3D 전체를 다시 만들어야 해서 (폰에서 수십 초) 원래 방식으로 되돌렸습니다.
        MANNEQUIN: { lenPct: 0.9 },      // 어깨 따라간 이상치 가닥 제외
        MQ_FRINGE: {
          tipFaceFrac: -0.1,     // 앞머리 기장 막대 가운데의 기준선: 눈썹과 눈 사이
          crownAllAround: false  // 크라운을 눈썹 높이에서 "한 바퀴 전부" 자르던 것 → 앞쪽만 자름
        },
        HAIR_DYE: { sMax: 1.3, highlightK: 0.6, glossDesat: 0.7 } // 원본 광택띠가 은색 철사로 번지는 것 억제
      },
      volBase: 1.0,    // 볼륨 막대 50 = AMP×1.0 만큼 부풂
      after: { front: { curl: 20 } },   // 시스루 앞머리는 거의 곧은 C컬
      shade: { ao: 0.42, lumCap: 1.3, spec: 0.22, specPow: 60 },
      silhouette: {   // 레퍼런스 사진 실측(약 25° 돌아간 사진이라 정면 근사치)
        front: {
          wh: 0.95,
          wp: [0.10, 0.50, 0.72, 0.91, 0.94, 0.99, 0.97, 0.95, 0.87, 0.40, 0.05],
          bot: [0.49, 0.84, 0.90, 0.97, 0.44, 0.54, 0.52, 0.55, 0.63, 0.80, 0.85, 0.80, 0.67]  // 가운데 낮은 칸 = 앞머리 끝
        }
      },
      specPatch: function (spec) {
        spec.perm.wave = 92;          // 로드 ≈ 3.4cm (굵은 로드)
        spec.styling.volume = 50;
        // 펌·세팅 섹션별 기준값 (막대 숫자 그대로)
        var set = {
          crown:     { base: 20, define: 70, volShare: 60, volPoint: 25, weight: 25 },
          front:     { base: 20, define: 70, volShare: 35, volPoint: 25, weight: 25 },
          temple:    { base: 20, define: 70, volShare: 64, volPoint: 25, weight: 25 },
          side:      { base: 20, define: 70, volShare: 67, volPoint: 25, weight: 25 },
          occipital: { base: 20, define: 70, volShare: 59, volPoint: 25, weight: 25 },
          nape:      { base: 20, define: 70, volShare: 50, volPoint: 25, weight: 25 }
        };
        for (var sec in set) if (spec.cut[sec]) Object.assign(spec.cut[sec], set[sec]);
      }
    },

    /* ── Layered Bob 레퍼런스 맞춤 (2026-09-29, 옛 js/33-layered-bob-tune.js) ───────────────
     * 레퍼런스(정면·좌50°·우50°·후면 4컷): 턱~목 중간 기장 레이어드 보브
     *   · 앞머리: 이마 전체를 얇게 덮는 시스루뱅, 끝은 눈썹~눈 사이, 살짝 안으로 C컬
     *   · 얼굴선: 광대~입꼬리 높이에서 끝나는 짧은 사이드뱅, 얼굴 "옆"에서 바깥으로 넘어감
     *   · 결: 뿌리는 차분, 중간부터 느슨한 S웨이브, 끝은 바깥으로 살짝 튕김(잔곱슬 없음)
     *   · 색: 올리브빛 애쉬 브라운 (#6B5A45 — 목록 카드 색은 02-state-sections.js STYLES)
     * 화면 녹화에서 고친 점:
     *   1) 앞머리 양갈래 — temple(얼굴선) 끝이 턱선(0.98)까지 내려와 얼굴 앞에 굵은 두 가닥으로 늘어짐
     *      → 광대 높이(0.80)로 올리고, overdirection·curlDir 로 얼굴 옆·바깥으로 넘김
     *   2) 앞머리가 무거움 — 앞머리 끝이 두꺼워 통뱅처럼 보임
     *      → 숱(density) 막대는 없앰(뿌리째 빠지는 문제). 얇은 느낌은 텍스처라이징 80 으로
     *   3) 잔곱슬 파마처럼 보임 — wave 70(가는 로드) → 95(굵은 롤), 끝 12cm만 느슨하게
     *   4) (v3) 손님 사진에 앞머리가 "있다"고 잡히면 앞머리를 새로 안 자르던 것
     *      → 17a-mannequin.js의 FORCE_FRINGE_STYLES 에 이 스타일을 넣음
     * specPatch는 처음 걸 때 한 번 STYLE_SPECS.layered_bob_hush(16)를 직접 고친다(_specPatched).
     * 끄기: 이 항목을 지우면 16의 원래 스펙 그대로 */
    layered_bob_hush: {
      label: 'Layered bob · See-through bangs · Flick-out ends',
      config: {
        CURL_BUNDLE: {
          rodThickCm: 4,       // 굵은 롤 → 곱슬이 아니라 S결
          pitchThick: 2.0,     // 한 바퀴를 길게
          relax: 1.25,
          microAmp: 0.015,     // 잔곱슬 거의 없음
          microPhase: 0.15
        },
        CURL3D_FIX: { ampGamma: 0.75 },
        VOLUME3D: { AMP: 0.15 },
        MANNEQUIN: { lenPct: 0.9 },
        MQ_FRINGE: {
          on: true,
          tipFaceFrac: -0.15,    // 앞머리 끝: 눈썹 높이 (v2: -0.05 는 눈을 덮음)
          frontFrac: 1.0,        // v2: 앞 섹션 가닥은 전부 앞머리선에서 자름 (0.6 이면 40%가 기장대로 얼굴을 덮고 내려옴)
          crownFrac: 0.45,       // v2: 정수리 앞쪽 가닥 중 앞머리로 떨어지는 몫 (0.15 → 나머지가 입술까지 내려오던 원인)
          crownThFrac: 0.7,
          lineHalfX: 0.9,        // 이마 폭만 덮음(얼굴 양옆으로 흘러내리지 않게)
          lineGain: 0.45,        // 가운데·바깥 길이 차이 작게 → 일자에 가까운 시스루 라인 (커튼뱅 X)
          converge: 0.95,        // 끝이 아주 살짝 가운데로 → 가운데가 벌어져 양갈래로 보이지 않게
          crownAllAround: false  // 앞쪽만 자름
        },
        HAIR_DYE: { sMax: 1.2, highlightK: 0.65, glossDesat: 0.7 }
      },
      volBase: 1.0,
      after: { front: { curl: 12 }, temple: { curl: 20 } },   // 앞머리·얼굴선은 거의 곧은 C컬
      shade: { ao: 0.42, lumCap: 1.3, spec: 0.22, specPow: 60 },
      specPatch: function (spec) {
        // 펌·세팅 기준값(막대 숫자) — curlLen 12 = 끝 12cm만 웨이브
        var set = function (o) {
          return Object.assign({ base: 30, define: 55, volShare: 50, volPoint: 55, weight: 35, curlLen: 12 }, o);
        };
        spec.color = '#6B5A45';   // 레퍼런스 올리브 애쉬 브라운
        spec.tipAt = Object.assign({}, spec.tipAt, {
          front: 0.52,        // 시스루뱅: 눈썹~눈 사이
          crown: 0.80,        // 윗층: 광대~코끝 → 층이 보이게
          temple: 0.80,       // 얼굴선: 광대 높이 (0.98 → 턱까지 내려와 양갈래로 보이던 원인)
          side: 1.02,         // 턱 아래
          occipital: 1.06,
          nape: 1.10          // 목 중간
        });
        Object.assign(spec.cut.front,     set({ texture: 80, elevation: 15, line: 50, curlDir: -15 }), { volShare: 30, weight: 45 });
        Object.assign(spec.cut.temple,    set({ texture: 60, elevation: 60, overdirection: 60, curlDir: 45 }));
        Object.assign(spec.cut.crown,     set({ texture: 50, elevation: 80, curlDir: 25 }), { volShare: 55, volPoint: 35 });
        Object.assign(spec.cut.side,      set({ texture: 60, elevation: 60, curlDir: 40 }));
        Object.assign(spec.cut.occipital, set({ texture: 55, elevation: 55, curlDir: 35 }));
        Object.assign(spec.cut.nape,      set({ texture: 55, elevation: 30, curlDir: 40 }), { technique: 'uniform' });
        spec.perm = { curl: 22, wave: 95 };     // 굵은 롤 · 약한 컬 = 느슨한 S웨이브
        spec.globalCurl = 22;
        spec.styling = Object.assign({}, spec.styling, {
          part: 0, partAmt: 30,  // v2: 앞머리로 안 잘린 윗머리는 가르마 양옆으로 넘김 (10 → 얼굴 위로 떨어짐)
          flow: 60,              // 끝 바깥말음(플립)
          volume: 50, finish: 50, sleek: 25
        });
      }
    },

    /* ── Curtain Bang Shag (2026-09-29, 옛 js/32-shag-curtain.js) ──────────────────────────
     * 스펙(길이·커트·펌·스타일링)은 16-style-spec-diag.js의 STYLE_SPECS.curtain_bang_shag,
     * 목록 카드는 02 STYLES. 여기는 막대가 없는 엔진 설정만. */
    curtain_bang_shag: {
      label: 'Curtain bang shag',
      config: {
        CURL_BUNDLE: {
          rodThickCm: 5,
          pitchThick: 2.2,     // 한 바퀴를 길게 → 컬이 아니라 S결
          relax: 1.25,
          microAmp: 0.01,      // 잔곱슬 없음
          microPhase: 0.2
        },
        CURL3D_FIX: { ampGamma: 0.75 },
        VOLUME3D: { AMP: 0.16 },            // 크라운 볼륨
        MQ_FRINGE: {
          on: true,
          tipFaceFrac: 0.35,     // 앞머리 끝 기준선: 광대뼈(눈 아래) — 시스루뱅(-0.1)보다 훨씬 길게
          lineHalfX: 1.1,        // 앞머리 폭을 넓게 → 얼굴 양옆으로 흘러내림
          lineGain: 1.0,         // 가운데 짧고 바깥으로 갈수록 길어지는 커튼 라인
          crownAllAround: false  // 앞쪽만 자름
        },
        HAIR_DYE: { sMax: 1.3, highlightK: 0.7, glossDesat: 0.7 }   // 레퍼런스의 결 따라 들어간 하이라이트
      },
      volBase: 1.0,
      // 앞·윗머리는 거의 곧게 → 층 끝선이 보이게 (커튼뱅은 스펙 curlDir 35로 바깥으로 넘어가는 C컬)
      after: { front: { curl: 12 }, crown: { curl: 18 }, temple: { curl: 18 } },
      shade: { ao: 0.45, lumCap: 1.3, spec: 0.2, specPow: 50 }   // 층 사이 그림자를 조금 더 → 레이어가 도드라짐
    }
  };

  /* ------------------------------------------------------------------------
   * 1. 전역 접근 (다른 스크립트의 최상위 const 는 이름으로만 접근 가능)
   * ---------------------------------------------------------------------- */
  var CFG = {
    CURL_BUNDLE: function () { return G.CURL_BUNDLE || null; },
    CURL3D_FIX: function () { return typeof CURL3D_FIX !== 'undefined' ? CURL3D_FIX : null; },
    VOLUME3D: function () { return typeof VOLUME3D !== 'undefined' ? VOLUME3D : null; },
    GRAV3D: function () { return typeof GRAV3D !== 'undefined' ? GRAV3D : null; },
    HAIR_FIELD3D: function () { return typeof HAIR_FIELD3D !== 'undefined' ? HAIR_FIELD3D : null; },
    MANNEQUIN: function () { return typeof MANNEQUIN !== 'undefined' ? MANNEQUIN : null; },
    MQ_FRINGE: function () { return typeof MQ_FRINGE !== 'undefined' ? MQ_FRINGE : null; },
    HAIR_DYE: function () { return typeof HAIR_DYE !== 'undefined' ? HAIR_DYE : null; }
  };
  var NEUTRAL_KEYS = { HAIR_FIELD3D: ['maxAlign'] };            // 바뀌면 중립 3D 재빌드
  var MQ_KEYS = { MANNEQUIN: ['lenPct'], MQ_FRINGE: null };     // 바뀌면 마네킹 재생성(null=전부)

  function st() { return typeof state !== 'undefined' ? state : null; }
  function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }
  function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function orig(name) { return SB._orig[name]; }
  SB._orig = SB._orig || {};

  /* ------------------------------------------------------------------------
   * 2. 프로필 적용/복원
   * ---------------------------------------------------------------------- */
  var DEFAULTS = {};
  function snapshotDefaults() {
    for (var pid in SB.profiles) {
      var conf = SB.profiles[pid].config || {};
      for (var cname in conf) {
        var obj = CFG[cname] && CFG[cname]();
        if (!obj) continue;
        DEFAULTS[cname] = DEFAULTS[cname] || {};
        for (var k in conf[cname]) if (!(k in DEFAULTS[cname])) DEFAULTS[cname][k] = clone(obj[k]);
      }
    }
  }

  function sigOf(map) {
    var out = [];
    for (var c in map) {
      var o = CFG[c] && CFG[c]();
      if (!o) continue;
      var keys = map[c] || Object.keys(o).filter(function (k) { return typeof o[k] !== 'object'; });
      keys.forEach(function (k) { out.push(c + '.' + k + '=' + o[k]); });
    }
    return out.join('|');
  }

  SB.activeId = null;
  SB.active = null;
  var builtNeutralSig = null, lastMqSig = null;

  function bumpCaches() {
    try { if (typeof ADJ_CACHE !== 'undefined' && ADJ_CACHE.bump) ADJ_CACHE.bump(); } catch (e) {}
    try { if (typeof DYE_LUT !== 'undefined' && DYE_LUT.map) DYE_LUT.map.clear(); } catch (e) {}
  }

  function applyProfile(id) {
    var prof = (id && SB.profiles[id]) || null;
    // 1) 기본값 복원
    for (var c in DEFAULTS) {
      var o = CFG[c] && CFG[c]();
      if (!o) continue;
      for (var k in DEFAULTS[c]) o[k] = clone(DEFAULTS[c][k]);
    }
    // 2) 프로필 덮기
    if (prof && prof.config) {
      for (var c2 in prof.config) {
        var o2 = CFG[c2] && CFG[c2]();
        if (!o2) continue;
        for (var k2 in prof.config[c2]) {
          var v = prof.config[c2][k2];
          o2[k2] = (isObj(v) && isObj(o2[k2])) ? Object.assign({}, o2[k2], clone(v)) : clone(v);
        }
      }
    }
    // 3) 스펙 원본 보정(한 번)
    if (prof && prof.specPatch && !prof._specPatched) {
      try {
        var spec = typeof STYLE_SPECS !== 'undefined' ? STYLE_SPECS[id] : null;
        if (spec) { prof.specPatch(spec); prof._specPatched = true; }
      } catch (e) { console.warn(TAG + ' 스펙 보정 실패', e); }
    }
    // 4) 실루엣 목표
    if (prof && prof.silhouette) {
      try { if (typeof SILHOUETTE_REF !== 'undefined' && !SILHOUETTE_REF[id]) SILHOUETTE_REF[id] = clone(prof.silhouette); } catch (e) {}
    }
    var changed = SB.activeId !== (prof ? id : null);
    SB.activeId = prof ? id : null;
    SB.active = prof;
    bumpCaches();

    // 5) 스타일을 고를 때 중립 3D·마네킹을 다시 만들지 않습니다 (원래 방식).
    //    마네킹은 원래 코드대로 스펙 스타일 선택 시 mannequinReset() 에서만 새로 만들어집니다.
    lastMqSig = sigOf(MQ_KEYS);
    if (changed) console.log(TAG + ' 엔진 프로필 → ' + (prof ? (prof.label || id) : '기본값'));
  }
  SB.applyProfile = applyProfile;

  /* ------------------------------------------------------------------------
   * 3. 슬라이더 ↔ 실제 값 (기준 + 중앙화)
   * ---------------------------------------------------------------------- */
  function paramDef(key) {
    try { if (typeof gyAllParamDef === 'function') return gyAllParamDef(key); } catch (e) {}
    try {
      for (var i = 0; i < GYEOL_GROUPS.length; i++) {
        var p = (GYEOL_GROUPS[i].params || []).find(function (q) { return q.key === key; });
        if (p) return p;
      }
    } catch (e) {}
    return { key: key, min: 0, max: 100, unit: '' };
  }
  function effMax(key, def) { return key === 'length' ? SB.LEN_EXT : def.max; }
  function baseOf(sec, key) {
    var S = st(), b = S && S._styleBase && S._styleBase[sec];
    return b && typeof b[key] === 'number' ? b[key] : null;
  }
  // 손잡이 가운데 = 스타일 기준값. 왼쪽 절반은 [최소 ~ 기준], 오른쪽 절반은 [기준 ~ 최대]로 나눠 매핑합니다.
  // 예전엔 기준 ±50 이라 기준이 163 이면 손잡이를 끝까지 내려도 113 에서 멈췄습니다(앞머리를 못 줄임).
  function toPos(sec, key, eff, def) {
    def = def || paramDef(key);
    var b = SB.on ? baseOf(sec, key) : null;
    if (b == null) return eff;
    var lo = def.min, hi = effMax(key, def), mid = (def.min + def.max) / 2;
    b = clamp(b, lo, hi);
    if (eff <= b) return b > lo ? clamp(lo + (eff - lo) / (b - lo) * (mid - lo), def.min, mid) : mid;
    return hi > b ? clamp(mid + (eff - b) / (hi - b) * (def.max - mid), mid, def.max) : mid;
  }
  function toEff(sec, key, pos, def) {
    def = def || paramDef(key);
    var b = SB.on ? baseOf(sec, key) : null;
    if (b == null) return pos;
    var lo = def.min, hi = effMax(key, def), mid = (def.min + def.max) / 2;
    b = clamp(b, lo, hi);
    var e = pos <= mid ? lo + (pos - lo) / (mid - lo) * (b - lo)
                       : b + (pos - mid) / (def.max - mid) * (hi - b);
    return Math.round(clamp(e, lo, hi) * 1000) / 1000;
  }
  SB.toPos = toPos; SB.toEff = toEff;

  function captureBase(reason) {
    var S = st();
    if (!S || !S.sections) return;
    var base = {};
    for (var sec in S.sections) {
      base[sec] = {};
      SB.PARAM_KEYS.forEach(function (k) { if (typeof S.sections[sec][k] === 'number') base[sec][k] = S.sections[sec][k]; });
    }
    S._styleBase = base;
    console.log(TAG + ' 기준 저장(' + reason + ') — 손잡이를 가운데로 둡니다. 길이 기준: ' +
      Object.keys(base).map(function (s) { return s + ' ' + (base[s].length != null ? Math.round(base[s].length) : '-'); }).join(' · '));
  }
  function clearBase() { var S = st(); if (S) S._styleBase = null; }
  SB.captureBase = captureBase; SB.clearBase = clearBase;

  function refreshPanel() {
    try { if (typeof buildGyPanel === 'function') buildGyPanel(); else if (typeof buildGyControls === 'function') buildGyControls(); } catch (e) {}
  }

  /* ------------------------------------------------------------------------
   * 4. 길이 상한 확장 + 100에 걸린 스펙 섹션 끝까지 풀기
   * ---------------------------------------------------------------------- */
  // 길이를 더 늘려도 끝이 안 내려가는 지점(포화점)을 찾습니다.
  // 가닥 원료 길이·자르기 상한·앞머리선 때문에 어느 값부터는 막대를 밀어도 화면이 그대로입니다.
  // 기준을 그 너머에 두면 손잡이 오른쪽 절반이 "죽은 구간"이 되므로, 기준은 포화점을 넘지 않게 합니다.
  function saturationLen(sec, ref) {
    var eps = 0.005 * ref.H;
    var yEnd = measureSectionTipY(sec, SB.LEN_EXT);
    if (yEnd == null) return null;
    var lo = 0, hi = SB.LEN_EXT;
    for (var i = 0; i < 9; i++) {   // 200/2^9 < 0.5 — 정수 올림이라 이걸로 충분 (예전 16)
      var mid = (lo + hi) / 2, y = measureSectionTipY(sec, mid);
      if (y == null) return null;
      if (Math.abs(y - yEnd) <= eps) hi = mid; else lo = mid;
    }
    return Math.ceil(hi);
  }

  function extendPinned(id, rep) {
    if (!rep || !rep.unit || typeof measureSectionTipY !== 'function' || typeof headHeightRef !== 'function') return;
    var spec = null;
    try { spec = getStyleSpec(id); } catch (e) {}
    if (!spec || !spec.tipAt) return;
    var ref = headHeightRef();
    if (!ref) return;
    var S = st();
    for (var sec in rep.unit) {
      if (rep.unit[sec] !== 'tip' || spec.tipAt[sec] == null || !S.sections[sec]) continue;
      if (!(S.sections[sec].length >= 99.5)) continue;
      var target = ref.yTop - spec.tipAt[sec] * ref.H;
      var sat = saturationLen(sec, ref);
      if (sat == null) continue;
      var best;
      var ySat = measureSectionTipY(sec, sat);
      if (ySat > target) {
        best = sat;                                   // 끝까지 가도 목표에 못 닿음 → 닿을 수 있는 최대
      } else {
        var lo = 0, hi = sat;                         // 포화점 안쪽에서 목표를 찾음
        for (var i = 0; i < 9; i++) {   // 예전 18 — 결과를 정수로 반올림하므로 9회면 같은 답
          var mid = (lo + hi) / 2, y = measureSectionTipY(sec, mid);
          if (y == null) break;
          if (y > target) lo = mid; else hi = mid;
        }
        best = Math.round((lo + hi) / 2);
      }
      S.sections[sec].length = best;
      if (rep.solved) rep.solved[sec] = best;
      var yB = measureSectionTipY(sec, best);
      var miss = yB == null ? null : (yB - target) / ref.H * 100;
      console.log(TAG + ' ' + sec + ' 길이: 100에 걸려 있던 것 → 기준 ' + best + ' (이 값부터는 늘려도 끝이 안 내려가는 지점 ' + sat + ')' +
        ' · 남은 오차 ' + (miss == null ? '—' : miss.toFixed(1) + '%') +
        (best >= sat && miss != null && Math.abs(miss) > 2 ? ' — 길이로는 더 못 맞춥니다(가닥 원료·앞머리선·컬 줄어듦 쪽)' : ''));
    }
  }

  /* ------------------------------------------------------------------------
   * 5. 3D 헤어 음영 (깊이 차폐 · 밝기 상한 · 결 하이라이트)
   * ---------------------------------------------------------------------- */
  function shadeHairObject(obj) {
    var sh = (SB.active && SB.active.shade) || SB.shade;
    if (!sh || !obj || !obj.geometry) return obj;
    var g = obj.geometry, P = g.attributes.position, C = g.attributes.color;
    if (!P || !C || P.count < 4) return obj;
    var E;
    try { E = getHeadEllipsoid(); } catch (e) { return obj; }
    var cy = typeof SCALP_CENTER_Y !== 'undefined' ? SCALP_CENTER_Y : 0.15;
    var n = P.count, NT = 36, NP = 18;
    var rho = new Float32Array(n), bin = new Int32Array(n), bmax = new Float32Array(NT * NP);
    for (var i = 0; i < n; i++) {
      var dx = P.getX(i) / E.a, dy = (P.getY(i) - cy) / E.b, dz = P.getZ(i) / E.c;
      var r = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
      var th = Math.atan2(dx, dz), ph = Math.acos(clamp(dy / r, -1, 1));
      var bi = Math.min(NP - 1, (ph / Math.PI * NP) | 0) * NT + Math.min(NT - 1, ((th + Math.PI) / (2 * Math.PI) * NT) | 0);
      rho[i] = r; bin[i] = bi; if (r > bmax[bi]) bmax[bi] = r;
    }
    // 밝기 중앙값
    var lums = [];
    for (var j = 0; j < n; j += 7) lums.push(0.299 * C.getX(j) + 0.587 * C.getY(j) + 0.114 * C.getZ(j));
    lums.sort(function (a, b) { return a - b; });
    var cap = (lums[lums.length >> 1] || 0.2) * sh.lumCap;
    // 빛: 앞 위쪽, 시선 +z
    var L = [0.3, 0.8, 0.5], V = [0, 0, 1], H = [L[0] + V[0], L[1] + V[1], L[2] + V[2]];
    var hl = Math.hypot(H[0], H[1], H[2]); H = [H[0] / hl, H[1] / hl, H[2] / hl];
    var out = new Float32Array(n * 3);
    for (var s = 0; s + 1 < n; s += 2) {
      var tx = P.getX(s + 1) - P.getX(s), ty = P.getY(s + 1) - P.getY(s), tz = P.getZ(s + 1) - P.getZ(s);
      var tl = Math.hypot(tx, ty, tz) || 1e-9;
      var th2 = (tx * H[0] + ty * H[1] + tz * H[2]) / tl;
      var kk = Math.pow(Math.sqrt(Math.max(0, 1 - th2 * th2)), sh.specPow);
      for (var q = s; q < s + 2; q++) {
        var bm = bmax[bin[q]], d = bm > 1.02 ? clamp((rho[q] - 1) / (bm - 1), 0, 1) : 1;
        var ao = sh.ao + (1 - sh.ao) * Math.pow(d, 0.8);
        var rr = C.getX(q), gg = C.getY(q), bb = C.getZ(q);
        var lum = 0.299 * rr + 0.587 * gg + 0.114 * bb;
        if (lum > cap && lum > 0) { var f = cap / lum; rr *= f; gg *= f; bb *= f; }
        var sp = kk * sh.spec * d * d;
        out[q * 3] = Math.min(1, rr * ao + sp * 0.85);
        out[q * 3 + 1] = Math.min(1, gg * ao + sp * 0.8);
        out[q * 3 + 2] = Math.min(1, bb * ao + sp * 0.72);
      }
    }
    g.setAttribute('color', new THREE.BufferAttribute(out, 3));
    if (!SB._shadeLogged) { SB._shadeLogged = true; console.log(TAG + ' 3D 음영 — 안쪽 가닥 ×' + sh.ao + ' · 밝기 상한 중앙값×' + sh.lumCap + ' · 결 하이라이트 ' + sh.spec); }
    return obj;
  }

  /* ------------------------------------------------------------------------
   * 5-1. 미용 기법 막대 (섹션별)
   *   펌   · 베이스 폭   — 로드 하나에 감는 모발 폭. 넓을수록 컬 덩어리가 큼
   *   세팅 · 컬 정리감   — 컬크림·에센스로 결을 모은 정도
   *        · 부피감      — 이 섹션이 두상에서 뜨는 정도
   *        · 볼륨 위치   — 부피가 뿌리/중간/모발 끝 중 어디에 실리나
   *        · 처짐        — 모발 무게로 내려앉는 정도
   *   커트 · 앞머리 기장 — 앞머리 섹션의 "길이" 막대 이름을 미용 용어로 (동작은 원래 앞머리선 계산)
   *   각 막대의 기본값은 "예전 엔진값과 똑같은 결과"가 나오는 숫자입니다 → 다른 스타일은 안 변합니다.
   * ---------------------------------------------------------------------- */
  var NEW_PARAMS = {
    perm: [
      { key: 'base', label: '베이스 폭', hint: '로드 하나에 감는 모발 폭 · 넓을수록 컬 덩어리가 큼', min: 0, max: 100, unit: '%' },
      { key: 'curlLen', label: '컬 구간', hint: '모발 끝에서부터 말리는 길이 · 짧으면 끝만(블로우아웃) · 60=뿌리까지', min: 3, max: 60, unit: 'cm' }
    ],
    set: [
      { key: 'define',   label: '컬 정리감', hint: '컬크림·에센스로 결을 모은 정도 · 낮으면 부스스', min: 0, max: 100, unit: '%' },
      { key: 'volShare', label: '부피감',    hint: '이 섹션이 두상에서 뜨는 정도',                 min: 0, max: 100, unit: '%' },
      { key: 'volPoint', label: '볼륨 위치', hint: '뿌리 ↔ 모발 끝 · 끝쪽일수록 밑단이 퍼짐',      min: 0, max: 100, unit: '%' },
      { key: 'weight',   label: '처짐',      hint: '모발 무게로 내려앉는 정도 · 낮을수록 컬이 뜸',  min: 0, max: 100, unit: '%' }
    ]
  };
  // 예전 엔진값과 같은 결과가 나오는 기본 숫자
  var NEW_DEFAULTS = { base: 55, define: 30, volShare: 50, volPoint: 50, weight: 50, curlLen: 20 };   // curlLen 20 = 엔진 기본 windCm
  var VOL_SECK0 = null;   // 섹션별 예전 부피 배수(VOLUME3D.secK)

  function secVal(sec, key) {
    var S = st(), o = S && S.sections && S.sections[sec];
    var v = o && o[key];
    return typeof v === 'number' && isFinite(v) ? v : NEW_DEFAULTS[key];
  }
  // 막대 → 엔진 값
  SB.map = {
    rodK:        function (b) { return 0.4 + 0.02 * b; },                  // 55 → 1.5(예전) · 20 → 0.8
    clumpPull:   function (d) { return d / 100; },                        // 30 → 0.3(예전)
    phaseJitter: function (d) { return Math.max(0.1, 1.6 - 1.4 * d / 100); }, // 30 → 1.18 ≈ 예전 1.2
    secK:        function (v, sec) { return (VOL_SECK0 && VOL_SECK0[sec] != null ? VOL_SECK0[sec] : 1) * v / 50; },
    ramp:        function (p) { return 0.3 + (p - 50) / 50 * 0.2; },      // 50 → 0.3(예전)
    tipHold:     function (p) { return 0.8 + (p - 50) / 50 * 0.5; },      // 50 → 0.8(예전)
    curlK:       function (w) { return 0.35 + (50 - w) / 50 * 0.9; }      // 50 → 0.35(예전) · 25 → 0.8
  };

  function withTemp(obj, vals, fn) {
    if (!obj) return fn();
    var old = {};
    for (var k in vals) { old[k] = obj[k]; obj[k] = vals[k]; }
    try { return fn(); } finally { for (var k2 in old) obj[k2] = old[k2]; }
  }

  function installParams() {
    // 그룹·막대 정의
    try {
      var perm = GYEOL_GROUPS.find(function (g) { return g.id === 'perm'; });
      NEW_PARAMS.perm.forEach(function (p) { if (perm && !perm.params.some(function (q) { return q.key === p.key; })) perm.params.push(p); });
      if (!GYEOL_GROUPS.some(function (g) { return g.id === 'set'; })) {
        var ci = GYEOL_GROUPS.findIndex(function (g) { return g.id === 'color'; });
        var grp = { id: 'set', title: '세팅', sub: '드라이·제품 마무리', color: 'var(--gy-perm)', optional: true, params: NEW_PARAMS.set };
        if (ci < 0) GYEOL_GROUPS.push(grp); else GYEOL_GROUPS.splice(ci, 0, grp);
      }
    } catch (e) { console.warn(TAG + ' 막대 그룹 추가 실패', e); }
    try {
      if (typeof GY_ALL_PARAMS !== 'undefined') {
        if (GY_ALL_PARAMS.perm.indexOf('base') < 0) GY_ALL_PARAMS.perm.push('base');
        if (GY_ALL_PARAMS.perm.indexOf('curlLen') < 0) GY_ALL_PARAMS.perm.push('curlLen');
        GY_ALL_PARAMS.set = NEW_PARAMS.set.map(function (p) { return p.key; });
      }
    } catch (e) {}
    // 조정 캐시 서명에 새 값 포함 (막대를 움직이면 다시 계산되도록)
    try {
      Object.keys(NEW_DEFAULTS).forEach(function (k) { if (ADJ_GEO_SECTION_KEYS.indexOf(k) < 0) ADJ_GEO_SECTION_KEYS.push(k); });
    } catch (e) {}
    // 섹션 기본값
    try {
      for (var sec in SECTIONS) {
        var d = SECTIONS[sec].defaults || (SECTIONS[sec].defaults = {});
        for (var k in NEW_DEFAULTS) if (typeof d[k] !== 'number') d[k] = NEW_DEFAULTS[k];
      }
      var S = st();
      if (S && S.sections) for (var s2 in S.sections) for (var k3 in NEW_DEFAULTS) if (typeof S.sections[s2][k3] !== 'number') S.sections[s2][k3] = NEW_DEFAULTS[k3];
    } catch (e) {}
    // 영어 화면용 번역
    try {
      if (typeof I18N !== 'undefined') Object.assign(I18N, {
        '세팅': 'Setting', '드라이·제품 마무리': 'Blow-dry & product finish',
        '베이스 폭': 'Base width', '로드 하나에 감는 모발 폭 · 넓을수록 컬 덩어리가 큼': 'Hair wound per rod · wider = chunkier curls',
        '컬 정리감': 'Curl definition', '컬크림·에센스로 결을 모은 정도 · 낮으면 부스스': 'How much product groups the curls · low = frizzy',
        '부피감': 'Lift', '이 섹션이 두상에서 뜨는 정도': 'How far this section stands off the head',
        '볼륨 위치': 'Volume point', '뿌리 ↔ 모발 끝 · 끝쪽일수록 밑단이 퍼짐': 'Root ↔ ends · toward ends = flared hem',
        '처짐': 'Weight', '모발 무게로 내려앉는 정도 · 낮을수록 컬이 뜸': 'How much the hair drops under its weight',
        '앞머리 기장': 'Fringe length', '눈썹 위 ↔ 눈 아래': 'Above brows ↔ below eyes',
        '컬 구간': 'Curl zone', '모발 끝에서부터 말리는 길이 · 짧으면 끝만(블로우아웃) · 60=뿌리까지': 'How far up from the ends the curl reaches · short = ends only (blowout) · 60 = from roots'
      });
    } catch (e) {}
    try { VOL_SECK0 = clone((CFG.VOLUME3D() || {}).secK) || null; } catch (e) {}
  }

  /* ------------------------------------------------------------------------
   * 6. 래퍼 설치
   * ---------------------------------------------------------------------- */
  function wrap(name, make) {
    var f = G[name];
    if (typeof f !== 'function') { console.warn(TAG + ' ' + name + ' 없음 — 건너뜀'); return; }
    if (f.__sbWrapped) return;
    SB._orig[name] = f;
    var w = make(f);
    w.__sbWrapped = true;
    G[name] = w;
  }

  function install() {
    installParams();
    snapshotDefaults();
    lastMqSig = sigOf(MQ_KEYS);

    // 길이 상한 확장 (100 → LEN_EXT). 100 이하에서는 원래 식과 같습니다.
    wrap('sectionLengthRatio', function (f) {
      return function (sec, len) {
        if (!SB.on || !(typeof len === 'number' && len > 100)) return f.apply(this, arguments);
        var d = (typeof SECTIONS !== 'undefined' && SECTIONS[sec] && SECTIONS[sec].defaults && typeof SECTIONS[sec].defaults.length === 'number') ? SECTIONS[sec].defaults.length : 50;
        var per = typeof LENGTH_RATIO_PER_UNIT !== 'undefined' ? LENGTH_RATIO_PER_UNIT : 0.018;
        // 원래 식: 기본값 이상 구간은 1 + (v − 기본값) × LENGTH_RATIO_PER_UNIT — 같은 직선을 LEN_EXT까지 연장
        return 1 + (Math.min(SB.LEN_EXT, len) - d) * per;
      };
    });

    // 로드 굵기: 웨이브 폭 0~75 는 예전 그대로, 75~100 은 굵은 로드(최대 4cm)까지 늘림
    SB.ROD_MAX_CM = 4.0;
    wrap('curlRodRadius', function (f) {
      return function (w) {
        var r = f.apply(this, arguments);
        if (!SB.on || !(w > 0.75)) return r;
        var r75 = f.call(this, 0.75);
        var cpu = (G.CURL_BUNDLE && G.CURL_BUNDLE.cmPerUnit) || 19.33;
        var rMax = Math.max(r75, SB.ROD_MAX_CM / 2 / cpu);
        return r75 + (Math.min(1, w) - 0.75) / 0.25 * (rMax - r75);
      };
    });

    // 섹션을 아는 곳(adjustStrandGeom)에서 지금 섹션을 기억 → 섹션을 모르는 계산들이 막대 값을 씀
    var CUR_SEC = null, CUR_STRAND = null, CUR_LEN = null;
    wrap('adjustStrandGeom', function (f) {
      return function (strand, len) {
        var prev = CUR_SEC, ps = CUR_STRAND, pl = CUR_LEN;
        CUR_SEC = strand && strand.sec || null; CUR_STRAND = strand || null; CUR_LEN = (typeof len === 'number') ? len : null;
        try { return f.apply(this, arguments); } finally { CUR_SEC = prev; CUR_STRAND = ps; CUR_LEN = pl; }
      };
    });
    /* 자르기 = 끝의 컬도 같이 잘려 나감
     * 컬은 "끝에서 windCm 만큼" 감기므로, 길이를 줄이면 컬 구간이 뿌리 쪽으로 따라 올라가
     * 머리가 두피 속으로 빨려 들어가는 것처럼 보였습니다. 스타일 기준 길이보다 짧게 자른 만큼(cm)
     * 감기는 길이를 줄이고, 다 잘려 나가면 곧게 둡니다. 스타일을 걸 때(기준 저장 전)는 적용하지 않음. */
    SB.cutRemovesCurl = true;
    function cutCm() {
      var S = st(), base = S && S._styleBase && S._styleBase[CUR_SEC];
      if (!SB.cutRemovesCurl || !base || base.length == null || !CUR_STRAND || !CUR_STRAND.pts) return 0;
      var now = CUR_LEN != null ? CUR_LEN : (S.sections[CUR_SEC] && S.sections[CUR_SEC].length);
      if (!(now < base.length) || typeof sectionLengthRatio !== 'function') return 0;
      var rb = sectionLengthRatio(CUR_SEC, base.length), rn = sectionLengthRatio(CUR_SEC, now);
      if (!(rn < rb)) return 0;
      var cm = (typeof modelCmPerUnit === 'function' && modelCmPerUnit()) || 0;
      if (!cm || typeof arcLength3D !== 'function') return 0;
      return arcLength3D(CUR_STRAND.pts) * cm * (rb - rn);
    }
    SB._asSec = function (sec, fn) { var p = CUR_SEC; CUR_SEC = sec; try { return fn(); } finally { CUR_SEC = p; } };  // 점검용
    /* 가르마는 앞이마~정수리까지만 — 뒤통수로 넘어가지 않게
     * 재 보니 가르마 미는 힘이 정수리(고도 88°)에서 최대인 채로 뒤쪽으로 이어져, 뒤 가운데 고도 80°에서
     * 0.048 · 70°에서 0.019(앞이마 0.061)가 남아 있었습니다 → 뒷머리 가운데가 좌우로 갈라져 두피가 한 줄로 보임.
     * (Seams 색칠로 확인: 갈라진 줄은 사진 경계가 아니라 후면 사진 한가운데였음)
     * 뿌리의 앞뒤 위치(z/c)로 약하게 합니다: 정수리보다 조금 앞(+0.15c)까지 100%, 정수리 뒤 -0.15c에서 0. */
    /* 가르마를 옆으로 옮기면 앞머리도 가르마 반대쪽으로 넘어가게
     * 원래 가르마 힘은 가르마 선 근처(가우시안 폭 0.35rad)에서만 세서, 가르마를 옆으로 옮기면
     * 얼굴 앞 가운데 가닥은 선에서 멀어 힘을 거의 못 받고 그대로 얼굴 위로 떨어졌습니다.
     * 앞·정수리(뿌리 z가 앞쪽) 가닥에는 가르마 선에서 먼 쪽으로 넘기는 힘을 바닥값으로 깝니다.
     * 가운데 가르마(0)에서는 아무것도 안 바꿉니다. 끄기 STYLE_BASE.partSideSweep=false */
    SB.partSideSweep = false; SB.partSideK = 0.9;
    function partSideSweep(v, root, partVal, curlAmt, partAmt) {
      if (!SB.partSideSweep || !root || !partVal || typeof PART3D === 'undefined') return v;
      var E; try { E = getHeadEllipsoid(); } catch (e) { return v; }
      if (!E) return v;
      var pa = clamp(typeof partAmt === 'number' ? partAmt : 0, 0, 100) / 100;
      if (!(pa > 0)) return v;
      var amt = Math.pow(pa, PART3D.GAMMA || 1);
      var x = root.x, y = root.y - 0.15, z = root.z;
      var ux = x / E.a, uy = y / E.b, uz = z / E.c, ul = Math.sqrt(ux * ux + uy * uy + uz * uz) || 1;
      ux /= ul; uy /= ul; uz /= ul;
      var fz = clamp((uz + 0.05) / 0.45, 0, 1); fz = fz * fz * (3 - 2 * fz);            // 앞쪽일수록 1
      var top = clamp((uy + 0.1) / 0.4, 0, 1);                                            // 귀 아래는 0
      var w = fz * top; if (!(w > 0)) return v;
      var off = clamp((-partVal / 100) * (PART3D.MAXOFF || 0.65), -0.98, 0.98);
      var d = ux - off, side = d >= 0 ? 1 : -1;
      var near = clamp(Math.abs(d) / 0.12, 0, 1);                                         // 선 바로 위는 원래 힘에 맡김
      var amp = PART3D.AMP * amt * w * near * SB.partSideK * (1 - 0.5 * clamp(curlAmt || 0, 0, 100) / 100);
      if (!(amp > 1e-6)) return v;
      var nx = x / (E.a * E.a), ny = y / (E.b * E.b), nz = z / (E.c * E.c), nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      nx /= nl; ny /= nl; nz /= nl;
      var dot = side * nx;
      var s = { x: (side - dot * nx) * amp, y: (-dot * ny) * amp, z: (-dot * nz) * amp };
      if (!v) return s;
      var mv = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z), ms = Math.sqrt(s.x * s.x + s.y * s.y + s.z * s.z);
      return ms > mv ? s : v;
    }
    SB.partFrontOnly = false;
    wrap('partingPushHead', function (f) {
      return function (root, partVal, curlAmt, partAmt) {
        var v = f.apply(this, arguments);
        v = partSideSweep(v, root, partVal, curlAmt, partAmt);
        if (!v || !SB.partFrontOnly || !root) return v;
        var c = 1; try { c = getHeadEllipsoid().c || 1; } catch (e) {}
        var zn = root.z / c, lo = -0.15, hi = 0.15;
        var t = Math.max(0, Math.min(1, (zn - lo) / (hi - lo))), w = t * t * (3 - 2 * t);
        if (w >= 1) return v;
        if (w <= 0) return null;
        return { x: v.x * w, y: v.y * w, z: v.z * w };
      };
    });
    // 펌 · 베이스 폭 / 세팅 · 컬 정리감
    wrap('curlStrand3D', function (f) {
      return function () {
        if (!SB.on || !CUR_SEC || !G.CURL_BUNDLE) return f.apply(this, arguments);
        var self = this, args = arguments, b = secVal(CUR_SEC, 'base'), d = secVal(CUR_SEC, 'define');
        var tmp = { rodK: SB.map.rodK(b), clumpPull: SB.map.clumpPull(d), phaseJitter: SB.map.phaseJitter(d) };
        // 컬 구간 막대: 기본 20cm(=엔진 기본)이면 손대지 않음 → 기존 스타일·프리셋 그대로
        var cl = secVal(CUR_SEC, 'curlLen'), wind = G.CURL_BUNDLE.windCm;
        if (cl !== NEW_DEFAULTS.curlLen) { wind = cl >= 60 ? 99 : cl; tmp.windCm = wind; }
        var cut = cutCm();
        if (cut > 0) {
          var w = wind - cut;
          if (w <= 0.5) return args[0];          // 컬 구간이 다 잘려 나감 → 곧은 머리
          tmp.windCm = w;
        }
        return withTemp(G.CURL_BUNDLE, tmp, function () { return f.apply(self, args); });
      };
    });
    // 세팅 · 처짐
    wrap('gravityDroop3D', function (f) {
      return function () {
        var g = CFG.GRAV3D();
        if (!SB.on || !CUR_SEC || !g) return f.apply(this, arguments);
        var self = this, args = arguments;
        return withTemp(g, { curlK: SB.map.curlK(secVal(CUR_SEC, 'weight')) }, function () { return f.apply(self, args); });
      };
    });
    // 세팅 · 부피감 / 볼륨 위치
    wrap('volumeStrand3D', function (f) {
      return function (pts, vol, sec) {
        var v = CFG.VOLUME3D(), sc = sec || CUR_SEC;
        if (!SB.on || !sc || !v) return f.apply(this, arguments);
        var self = this, args = arguments, vp = secVal(sc, 'volPoint');
        var secK = Object.assign({}, v.secK || {}); secK[sc] = SB.map.secK(secVal(sc, 'volShare'), sc);
        return withTemp(v, { secK: secK, RAMP: SB.map.ramp(vp), tipHold: SB.map.tipHold(vp) }, function () { return f.apply(self, args); });
      };
    });

    // 전체 섹션 화면에 '세팅' 묶음 추가
    wrap('buildGyAllControls', function (f) {
      return function (host) {
        var r = f.apply(this, arguments);
        try {
          var grp = GYEOL_GROUPS.find(function (g) { return g.id === 'set'; });
          if (grp && typeof gyAllGroup === 'function' && host) {
            var el = gyAllGroup(grp, function (body) { GY_ALL_PARAMS.set.forEach(function (k) { body.appendChild(gyAllRangeCtrl(k)); }); });
            var note = host.lastElementChild;
            if (note && note.className === 'section-affects') host.insertBefore(el, note); else host.appendChild(el);
          }
        } catch (e) { console.warn(TAG + ' 전체 화면 세팅 묶음 실패', e); }
        return r;
      };
    });

    // 볼륨: 슬라이더 50 = 스타일 기준 볼륨
    wrap('volumeLiftHead', function (f) {
      return function (p, vol) {
        var vb = SB.on && SB.active && SB.active.volBase;
        if (!vb) return f.apply(this, arguments);
        var v1 = f.call(this, p, 100);
        if (!v1) return null;
        var t = vb + (clamp(typeof vol === 'number' ? vol : 50, 0, 100) - 50) / 50;
        if (Math.abs(t) < 1e-6) return null;
        return { x: v1.x * t, y: v1.y * t, z: v1.z * t };
      };
    });

    // _volHash 부호 버그 (위 fixVolHashAll 설명 참고)
    wrap('_volHash', function (f) {
      return function () {
        var r = f.apply(this, arguments);
        if (!SB.on || !(SB.fixVolHashAll || SB.active)) return r;
        return r < 0 ? r + 1 : r;   // 부호 있는 int32 → 부호 없는 값으로
      };
    });

    // 중립 3D 빌드 시점의 설정 서명 기록
    wrap('buildNeutralHair3D', function (f) {
      return function (cb) {
        var running = typeof NEUTRAL_BUILD !== 'undefined' && NEUTRAL_BUILD.running;
        if (!running) builtNeutralSig = sigOf(NEUTRAL_KEYS);
        return f.apply(this, arguments);
      };
    });

    // 스타일 선택: 프로필을 먼저 걸고(마네킹이 올바른 설정으로 만들어지게) 원래 동작
    wrap('selectStyle', function (f) {
      return function (styleId) {
        if (!SB.on) return f.apply(this, arguments);
        var sty = null;
        try { sty = STYLES.find(function (s) { return s.id === styleId; }); } catch (e) {}
        var pid = sty ? (sty.specId || sty.profileId || null) : null;
        clearBase();
        applyProfile(pid);
        var r = f.apply(this, arguments);
        if (sty && !sty.specId && sty.sections) { captureBase('저장 스타일 ' + (sty.name || sty.id)); refreshPanel(); }
        return r;
      };
    });
    wrap('selectNoStyle', function (f) {
      return function () { if (SB.on) { clearBase(); applyProfile(null); } return f.apply(this, arguments); };
    });
    wrap('resetSections', function (f) {
      return function () { clearBase(); return f.apply(this, arguments); };
    });

    // 스펙 적용: 프로필 → 원래 풀이 → 100에 걸린 섹션 확장 → 후처리 → 기준 저장
    wrap('applyStyleSpecAndRender', function (f) {
      return function (id) {
        var S = st();
        if (SB.on && !(S && S.specAppliedId === id)) applyProfile(id);
        return f.apply(this, arguments);
      };
    });
    wrap('applyStyleSpec', function (f) {
      return function (id) {
        var rep = f.apply(this, arguments);
        if (!SB.on || !rep) return rep;
        try { extendPinned(id, rep); } catch (e) { console.warn(TAG + ' 길이 확장 실패', e); }
        var prof = SB.profiles[id], S = st();
        if (prof && prof.after && S) {
          for (var sec in prof.after) if (S.sections[sec]) Object.assign(S.sections[sec], prof.after[sec]);
        }
        captureBase('스펙 ' + id);
        bumpCaches();
        return rep;
      };
    });
    wrap('clearStyleSpec', function (f) {
      return function () {
        var r = f.apply(this, arguments);
        if (SB.on) { clearBase(); applyProfile(null); refreshPanel(); }
        return r;
      };
    });

    // 현재 상태를 스타일로 저장할 때 엔진 프로필도 같이 저장
    wrap('registerCurrentAsStyle', function (f) {
      return function () {
        var before = [];
        try { before = STYLES.slice(); } catch (e) {}
        var r = f.apply(this, arguments);
        try {
          if (SB.activeId) {
            var added = STYLES.filter(function (s) { return before.indexOf(s) < 0; });
            added.forEach(function (s) { if (!s.profileId && !s.specId) s.profileId = SB.activeId; });
            if (added.length && typeof saveCustomStylesToStorage === 'function') saveCustomStylesToStorage();
          }
        } catch (e) {}
        return r;
      };
    });

    /* --- 섹션별 슬라이더 --- */
    wrap('gyBuildRangeCtrl', function (f) {
      return function (sec, def) {
        var el = f.apply(this, arguments);
        try {
          var S = st(), eff = S.sections[sec][def.key];
          var inp = el.querySelector('input[type=range]');
          if (sec === 'front' && def.key === 'length') {   // 커트 · 앞머리 기장
            var lb = el.querySelector('.gy-ctrl-label'), hn = el.querySelector('.gy-ctrl-hint');
            if (lb) lb.textContent = '앞머리 기장';
            if (hn) hn.textContent = '눈썹 위 ↔ 눈 아래';
          }
          if (inp && typeof eff === 'number') inp.value = toPos(sec, def.key, eff, def);
        } catch (e) {}
        return el;
      };
    });
    wrap('syncGyParamUI', function (f) {
      return function (sec, key) {
        var r = f.apply(this, arguments);
        try {
          var inp = document.getElementById('gyrange-' + sec + '-' + key), eff = st().sections[sec][key];
          if (inp && typeof eff === 'number') inp.value = toPos(sec, key, eff);
        } catch (e) {}
        return r;
      };
    });
    wrap('onGySlider', function (f) {
      return function (sec, key, val) {
        var S = st();
        if (!SB.on || !S || !S.sections[sec] || baseOf(sec, key) == null) return f.apply(this, arguments);
        var def = paramDef(key), pos = parseFloat(val);
        var prev = typeof S.sections[sec][key] === 'number' ? S.sections[sec][key] : pos;
        var eff = toEff(sec, key, pos, def);
        S.sections[sec][key] = eff;
        var lab = document.getElementById('gyval-' + sec + '-' + key);
        if (lab) lab.textContent = Math.round(eff) + ((typeof GY_UNIT !== 'undefined' && GY_UNIT[key]) || '');
        if (key === 'length' && typeof propagateSectionChange === 'function') propagateSectionChange(sec, 'length', eff - prev);
        if (typeof drawAdjustPreview === 'function') drawAdjustPreview();
      };
    });

    /* --- 전체(All) 슬라이더 --- */
    function avgOf(key, fn) {
      var S = st(), sum = 0, n = 0, def = paramDef(key);
      (typeof SECTION_ORDER !== 'undefined' ? SECTION_ORDER : Object.keys(S.sections)).forEach(function (sec) {
        var v = S.sections[sec] && S.sections[sec][key];
        if (typeof v === 'number' && isFinite(v)) { sum += fn(sec, v, def); n++; }
      });
      return n ? sum / n : 0;
    }
    function avgPos(key) { return avgOf(key, function (s, v, d) { return toPos(s, key, v, d); }); }
    function avgEff(key) { return avgOf(key, function (s, v) { return v; }); }
    var allDrag = null;

    wrap('gyAllRangeCtrl', function (f) {
      return function (key) {
        var el = f.apply(this, arguments);
        try {
          var inp = el.querySelector('input[type=range]'), p = Math.round(avgPos(key));
          if (inp) { inp.value = p; inp.dataset.start = String(p); }
        } catch (e) {}
        return el;
      };
    });
    wrap('onGyAllSlider', function (f) {
      return function (key, val, inp) {
        if (!SB.on || !st()._styleBase) return f.apply(this, arguments);
        var v = parseFloat(val);
        if (!isFinite(v)) return;
        var S = st(), def = paramDef(key);
        if (!allDrag || allDrag.key !== key) {
          allDrag = { key: key, start: parseFloat(inp && inp.dataset.start), base: {} };
          if (!isFinite(allDrag.start)) allDrag.start = v;
          (typeof SECTION_ORDER !== 'undefined' ? SECTION_ORDER : Object.keys(S.sections)).forEach(function (sec) {
            var x = S.sections[sec] && S.sections[sec][key];
            if (typeof x === 'number') allDrag.base[sec] = x;
          });
        }
        var dlt = v - allDrag.start;
        for (var sec in allDrag.base) {
          S.sections[sec][key] = Math.round(clamp(allDrag.base[sec] + dlt, def.min, effMax(key, def)) * 1000) / 1000;
        }
        if (key === 'curl' && typeof gySyncGlobalCurl === 'function') gySyncGlobalCurl();
        var lab = document.getElementById('gyallval-' + key);
        if (lab) lab.textContent = Math.round(avgEff(key)) + (def.unit || '');
        var rng = document.getElementById('gyallrng-' + key);
        try { if (rng && typeof gyAllRangeText === 'function') rng.textContent = gyAllRangeText(key); } catch (e) {}
        try { drawAdjustPreview(); } catch (e) {}
      };
    });
    wrap('onGyAllSliderEnd', function (f) {
      return function (key, inp) {
        if (!SB.on || !st()._styleBase) return f.apply(this, arguments);
        allDrag = null;
        try { if (typeof _gyAllDrag !== 'undefined') _gyAllDrag = null; } catch (e) {}
        var p = Math.round(avgPos(key)), def = paramDef(key);
        if (inp) { inp.dataset.start = String(p); inp.value = p; }
        var lab = document.getElementById('gyallval-' + key);
        if (lab) lab.textContent = Math.round(avgEff(key)) + (def.unit || '');
        try { SECTION_ORDER.forEach(function (s) { try { updateSectionSummary(s); } catch (e) {} }); } catch (e) {}
      };
    });

    /* --- 3D 음영 --- */
    wrap('buildAdjustedHair3DObject', function (f) {
      return function () {
        var obj = f.apply(this, arguments);
        if (!SB.on) return obj;
        try { return shadeHairObject(obj); } catch (e) { console.warn(TAG + ' 3D 음영 실패 — 원래 색 유지', e); return obj; }
      };
    });

    console.log(TAG + ' 설치 완료 — 새 막대: 펌·베이스 폭 / 세팅·컬 정리감·부피감·볼륨 위치·처짐 / 커트·앞머리 기장 · 스타일 설정 ' + Object.keys(SB.profiles).join(', ') + ' · 끄기 STYLE_BASE.on=false');
  }

  SB._shade = shadeHairObject;   // 점검용

  SB.status = function () {
    var S = st();
    return {
      on: SB.on, profile: SB.activeId, lenExt: SB.LEN_EXT,
      base: S && S._styleBase ? clone(S._styleBase) : null,
      neutralSig: sigOf(NEUTRAL_KEYS), builtNeutralSig: builtNeutralSig
    };
  };

  /* 새 스타일 프로필 추가용:  STYLE_BASE.addProfile('spec_id', { config:{...}, volBase, after, shade, specPatch }) */
  SB.addProfile = function (id, prof) {
    SB.profiles[id] = prof;
    snapshotDefaults();
    return prof;
  };

  // 앞의 스크립트가 모두 동기 로드된 뒤라 바로 설치합니다(부트 코드가 원래 함수를 먼저 부르지 않도록).
  install();
})();

/* ==========================================================================
 * 새 스타일: Long Blowout Waves (미국 살롱 스타일 — 긴 레이어드 + 끝부분 굵은 웨이브)
 *
 *   · 길이: 어깨~쇄골 (옆·뒤), 크라운·관자놀이는 레이어로 더 짧게
 *   · 앞머리 없음: 가운데 가르마로 양옆에 넘김 → 얼굴이 드러남, 얼굴선 레이어는 턱선
 *   · 컬: 뿌리~중간은 곧게, 끝 약 14cm만 굵은 롤(블로아웃)
 *       → CURL_BUNDLE.windCm = 끝에서부터 감기는 길이 (헤드리스 시험: 12cm면 위쪽은 0, 끝만 감김)
 *       → rodThickCm 5 = 굵은 롤, pitchThick 1.8 = 촘촘하지 않은 한 바퀴
 *   · 볼륨 위치(volPoint)를 아래쪽으로 — 끝이 풍성
 * 값은 모두 막대 숫자라 조정 화면에서 그대로 움직일 수 있습니다.
 * ======================================================================== */
(function () {
  'use strict';
  var G = window;
  var ID = 'long_blowout_waves';
  if (typeof STYLE_SPECS === 'undefined' || typeof STYLES === 'undefined' || STYLE_SPECS[ID]) return;

  var set = function (o, extra) {   // 펌·세팅 기준값(막대 숫자)
    return Object.assign({ base: 25, define: 60, volShare: 55, volPoint: 75, weight: 35, curlLen: 14 }, extra || {}, o);   // curlLen 14 = 끝 14cm만 컬
  };
  STYLE_SPECS[ID] = {
    name: 'Long blowout waves · Center part · Big bottom curls',
    tipAt: {                 // 두상 높이 기준 끝 위치 (1.0 ≈ 턱선)
      front: 1.00,           // 얼굴선 레이어: 턱선 (앞머리 없음)
      crown: 1.15,           // 레이어 — 위쪽이 짧아야 끝 웨이브가 층층이 보임
      temple: 1.18,          // 얼굴 감싸는 층
      side: 1.42,            // 어깨
      occipital: 1.50,
      nape: 1.55             // 쇄골 근처
    },
    cut: {
      crown:     set({ technique: 'uniform', elevation: 70, texture: 40, curlDir: 20 }),
      front:     set({ technique: 'uniform', elevation: 20, texture: 55, line: 50, curlDir: -10 }, { volShare: 35 }),   // 얼굴 쪽으로 감싸는 컬 — 끝이 벌어지지 않게
      temple:    set({ technique: 'uniform', elevation: 55, texture: 45, overdirection: 30, curlDir: 5 }),
      side:      set({ technique: 'uniform', elevation: 45, texture: 45, curlDir: 25 }, { volShare: 65 }),
      occipital: set({ technique: 'uniform', elevation: 45, texture: 40, curlDir: 20 }, { volShare: 60 }),
      nape:      set({ technique: 'uniform', elevation: 25, texture: 35, line: 50, curlDir: 20 })
    },
    perm: { curl: 42, wave: 95 },     // wave 95 = 굵은 롤
    styling: { sweep: 0, volume: 50, flow: 30, part: 0, partAmt: 65, finish: 55, sleek: 20 },   // part 0 = 가운데 가르마, partAmt 65 = 양옆으로 넘김(80이면 앞쪽 끝이 벌어짐)
    globalCurl: 42,
    color: '#1E1712'
  };

  STYLES.push({
    id: ID, specId: ID,
    name: 'Blowout Waves',
    tags: 'Long layers · Center part · Big bottom curls',
    length: 92, curl: 42, volume: 60, colorHex: '#1E1712'
  });
  try { if (typeof RECIPE_STYLES !== 'undefined' && RECIPE_STYLES.indexOf(ID) < 0) RECIPE_STYLES.push(ID); } catch (e) {}

  if (G.STYLE_BASE && G.STYLE_BASE.addProfile) {
    G.STYLE_BASE.addProfile(ID, {
      label: 'Long blowout waves',
      config: {
        CURL_BUNDLE: {
          rodThickCm: 5,       // 굵은 롤
          pitchThick: 1.8,     // 한 바퀴가 느슨하게
          relax: 1.2,
          microAmp: 0.02,      // 잔곱슬 거의 없음(드라이로 편 결)
          microPhase: 0.1
        },
        CURL3D_FIX: { ampGamma: 0.7 },
        VOLUME3D: { AMP: 0.16 },
        MQ_FRINGE: { on: false }   // 앞머리(뱅) 없음 — 가르마로 넘긴 얼굴선 레이어
      },
      volBase: 1.0,
      after: { front: { curl: 30 } },   // 얼굴선은 바깥으로 넘어가는 C컬 정도
      shade: { ao: 0.42, lumCap: 1.3, spec: 0.26, specPow: 60 }   // 블로아웃 광택 조금 더
    });
  }
  try { if (typeof buildStyleGrid === 'function') buildStyleGrid(); } catch (e) { console.warn('[스타일] 목록 다시 그리기 실패', e); }
  console.log('[스타일] Blowout Waves 추가');
})();

/* ==========================================================================
 * 앞 가르마 자리 뿌리 메우기 (마네킹 재심기)
 * Roots 보기로 확인: 이마 가운데 헤어라인에 뿌리가 한 칸 덩어리로 비어 있었음 = 원본 사진의 가르마 선이
 * 두피로 보여 밀도(den)가 baldDen(0.08) 아래로 잡힌 칸. 거기엔 가닥을 안 심어서 앞쪽이 벌어졌습니다.
 * 같은 가로줄(같은 높이)에서 양옆이 모두 머리인 좁은 빈 칸(최대 GAP칸)만 양옆 평균 밀도로 채웁니다.
 * 얼굴·두피 밖 칸(EST_OFFSCALP)과 헤어라인 바깥(한쪽만 머리)은 그대로 → 이마가 넓어지지 않음.
 * 원본 밀도 배열은 심은 뒤 되돌립니다. 끄기: STYLE_BASE.fillPartGap = false
 * ======================================================================== */
(function () {
  'use strict';
  var G = window, SB = G.STYLE_BASE || {};
  SB.fillPartGap = true;
  // v2(09-29): 6 → 10 — 이마 앞 헤어라인의 사각 홈(폭 7~10칸)이 안 채워져 가르마 자리가 휑해 보였음
  SB.partGapCells = 10;
  var orig = G.buildMannequinHair3D;
  if (typeof orig !== 'function') return;
  G.buildMannequinHair3D = function () {
    var M = state && (state._hair3Dneutral || state.hair3D), R = M && M.roots;
    if (!SB.fillPartGap || !R || !R.ok || !R.den || !R.NT || !R.NP) return evenRoots(orig.apply(this, arguments));
    var NT = R.NT, NP = R.NP, den = R.den, est = R.est, bald = (typeof MANNEQUIN !== 'undefined' ? MANNEQUIN.baldDen : 0.08);
    var OFF = (typeof EST_OFFSCALP !== 'undefined') ? EST_OFFSCALP : null;
    var isOff = function (a, i) { return OFF !== null && a && a[i] === OFF; };
    var saved = Array.prototype.slice.call(den), savedEst = est ? Array.prototype.slice.call(est) : null;
    var GAP = SB.partGapCells || 6;
    var hair = function (j) { return !isOff(savedEst, j) && saved[j] > bald; };
    var filledLow = 0, filledOff = 0;
    // 이마 쪽(앞) 헤어라인의 파인 홈은 "두피 밖"으로 판정돼 있었음(로그: 정면 phi0.95~1.05 두피밖 12칸, 밀도0은 5칸뿐)
    // → 같은 가로줄에서 양옆이 머리인 좁은 칸은 두피 밖이어도 두피로 되돌려 심음. 위쪽 절반(phi<1.1)만.
    var phiMax = 1.1;
    for (var ip = 0; ip < NP; ip++) {
      var phi = (ip + 0.5) / NP * Math.PI, row = ip * NT;
      for (var it = 0; it < NT; it++) {
        var i = row + it;
        if (hair(i)) continue;
        var off = isOff(savedEst, i);
        if (off && phi > phiMax) continue;
        var L = 0, Ld = 0, Rt = 0, Rd = 0;
        for (var k = 1; k <= GAP; k++) { var j = row + (it - k + NT) % NT; if (hair(j)) { L = k; Ld = saved[j]; break; } }
        for (var k2 = 1; k2 <= GAP; k2++) { var j2 = row + (it + k2) % NT; if (hair(j2)) { Rt = k2; Rd = saved[j2]; break; } }
        if (!(L && Rt && L + Rt - 1 <= GAP)) continue;
        den[i] = (Ld + Rd) / 2;
        if (off) { est[i] = savedEst[row + (it - L + NT) % NT]; filledOff++; } else filledLow++;
      }
    }
    var res;
    try { res = orig.apply(this, arguments); }
    finally {
      for (var q = 0; q < saved.length; q++) den[q] = saved[q];
      if (savedEst) for (var q2 = 0; q2 < savedEst.length; q2++) est[q2] = savedEst[q2];
      console.log('[가르마 뿌리 메우기] 좁은 빈 칸 채움 — 밀도 낮음 ' + filledLow + '칸 · 두피밖 판정 ' + filledOff + '칸 (끄기 STYLE_BASE.fillPartGap=false)');
    }
    return evenRoots(res);   // 밀도를 되돌린 <b>뒤</b>에 — 아래 evenRoots 주석
  };
  /* 앞쪽 뿌리 보강(17a-mannequin.js mannequinEvenRoots · ROOT_EVEN)은 여기서 부른다.
   * 위에서 잠깐 채운 den이 원래대로 돌아온 다음이어야 그쪽의 대머리 판정이 옛 31번 파일과 같다.
   * 실패해도 심은 결과는 그대로 돌려준다. */
  function evenRoots(r) {
    if (typeof mannequinEvenRoots !== 'function') return r;
    try { return mannequinEvenRoots(r); } catch (e) { console.warn('[뿌리 고르게] 실패', e); return r; }
  }
})();
