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
  SB.PARAM_KEYS = ['length', 'elevation', 'texture', 'density', 'overdirection', 'line', 'curl', 'wave', 'curlDir',
    'base', 'define', 'volShare', 'volPoint', 'weight'];

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
        spec.cut.front.density = 20;
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
  function toPos(sec, key, eff, def) {
    def = def || paramDef(key);
    var b = SB.on ? baseOf(sec, key) : null;
    if (b == null) return eff;
    return clamp((def.min + def.max) / 2 + (eff - b), def.min, def.max);
  }
  function toEff(sec, key, pos, def) {
    def = def || paramDef(key);
    var b = SB.on ? baseOf(sec, key) : null;
    if (b == null) return pos;
    var e = b + (pos - (def.min + def.max) / 2);
    return Math.round(clamp(e, def.min, effMax(key, def)) * 1000) / 1000;
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
    for (var i = 0; i < 16; i++) {
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
        for (var i = 0; i < 18; i++) {
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
      { key: 'base', label: '베이스 폭', hint: '로드 하나에 감는 모발 폭 · 넓을수록 컬 덩어리가 큼', min: 0, max: 100, unit: '%' }
    ],
    set: [
      { key: 'define',   label: '컬 정리감', hint: '컬크림·에센스로 결을 모은 정도 · 낮으면 부스스', min: 0, max: 100, unit: '%' },
      { key: 'volShare', label: '부피감',    hint: '이 섹션이 두상에서 뜨는 정도',                 min: 0, max: 100, unit: '%' },
      { key: 'volPoint', label: '볼륨 위치', hint: '뿌리 ↔ 모발 끝 · 끝쪽일수록 밑단이 퍼짐',      min: 0, max: 100, unit: '%' },
      { key: 'weight',   label: '처짐',      hint: '모발 무게로 내려앉는 정도 · 낮을수록 컬이 뜸',  min: 0, max: 100, unit: '%' }
    ]
  };
  // 예전 엔진값과 같은 결과가 나오는 기본 숫자
  var NEW_DEFAULTS = { base: 55, define: 30, volShare: 50, volPoint: 50, weight: 50 };
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
        '앞머리 기장': 'Fringe length', '눈썹 위 ↔ 눈 아래': 'Above brows ↔ below eyes'
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
    var CUR_SEC = null;
    wrap('adjustStrandGeom', function (f) {
      return function (strand) {
        var prev = CUR_SEC; CUR_SEC = strand && strand.sec || null;
        try { return f.apply(this, arguments); } finally { CUR_SEC = prev; }
      };
    });
    SB._asSec = function (sec, fn) { var p = CUR_SEC; CUR_SEC = sec; try { return fn(); } finally { CUR_SEC = p; } };  // 점검용
    // 펌 · 베이스 폭 / 세팅 · 컬 정리감
    wrap('curlStrand3D', function (f) {
      return function () {
        if (!SB.on || !CUR_SEC || !G.CURL_BUNDLE) return f.apply(this, arguments);
        var self = this, args = arguments, b = secVal(CUR_SEC, 'base'), d = secVal(CUR_SEC, 'define');
        return withTemp(G.CURL_BUNDLE, { rodK: SB.map.rodK(b), clumpPull: SB.map.clumpPull(d), phaseJitter: SB.map.phaseJitter(d) },
          function () { return f.apply(self, args); });
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
