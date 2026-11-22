/* ==========================================================================
 * 43-photo-amp-gain.js — PHOTO_AMP_GAIN: 사진 실측값(결읽기의 한계 보정)
 *
 * 배경 (대화 로그 + 2026-11-17 확인):
 *   READ_SHAPE(68번) 전환 이후 "읽은 대로 그리고 사진과 대조만" 방향으로 가면서,
 *   PHOTO_CURL·마네킹·컬 엔진(curlEngine) 전부를 껐다. 이유는 두 가지였다:
 *     ① 마네킹은 중력 시뮬레이션이 섞인 인위적 모형이라, 잰 컬 값을 넣어도
 *        중력이 눌러서 반영이 안 됐다.
 *     ② 컬·웨이브·직모를 "판정"해서 그 결과로 컬 엔진을 켜고 끄다 보니,
 *        판정이 틀어지면 직모인데도 웨이브가 지는 일이 생겼다.
 *   그래서 판정·엔진·마네킹을 다 버리고 결읽기(방향필터)가 걸은 길 그대로 쓰기로
 *   했는데, 결읽기 자체가 진폭을 작게 읽는 한계는 여전하다(__rsAutoGain 주석:
 *   "방향필터가 다발 단위의 큰 S자 출렁임을 작게 읽음·사진 진폭 ≈2cm·읽은 값 0.5cm").
 *   지금은 그 간극을 __rsAutoGain이라는 머리 전체 상수 하나(앞뒤 사진 평균 ×
 *   waveGainCal)로만 메운다.
 *
 * 이 파일이 하는 일 (2026-11-17 실측 검증 · verify/run.js, 실제 04/17b 함수로
 *   8장 사진을 직접 돌려 숫자로 확인함):
 *   같은 사람의 비슷한 긴 웨이브 사진 4장만 돌려도 "실루엣 실측 ÷ 결읽기" 배수가
 *   2.55~5.86배로 흔들렸다 — 머리 전체 상수 하나로는 못 맞는다는 뜻. 그래서:
 *     A. 웨이브: __rsAutoGain과 같은 식(실루엣 진폭 ÷ 결읽기 진폭)이지만, 머리
 *        전체 중앙값 하나로 뭉개지 않고 <b>뷰(정면·좌·우·뒤)별로</b> 따로 두고,
 *        섹션마다 그 섹션이 보이는 뷰의 배수를 쓴다(앞은 앞 사진 배수, 뒤는
 *        뒤 사진 배수). 뷰 값이 없으면 평균으로, 그것도 없으면 1(무보정)로.
 *     B. 컬: helixMeasure(자기상관 실측)가 이미 쓰는 신뢰 기준(peak·beta·P·D)을
 *        그대로 따르고, 그 기준을 통과 못 하면(8장 중 5장이 그랬다 — 각도가
 *        안 좋은 사진) <b>clumpFind(다발 폭)</b>로 대신한다 — 8장 다 안정적으로
 *        나왔고, PHOTO_CURL.lockDia(= 1.0 · "타래 하나의 뿌리 자리 크기 = 컬
 *        지름 × 이 값")가 이미 다발 폭 ≈ 컬 지름이라고 보고 있어 그 관계를
 *        그대로 쓴다. 그것도 없으면 1(무보정).
 *   둘 다 <b>판정(이분기)이 아니라 연속 배수</b>다 — 스위치를 켜고 끄는 게
 *   아니라 신뢰도가 낮을수록 1에 가까워지는 숫자라서, PHOTO_CURL/컬엔진을 끈
 *   이유였던 "오판정으로 직모에 웨이브가 지는" 문제가 구조적으로 안 생긴다.
 *   또 로드에 감아 합성하지 않고 <b>이미 읽은 가닥의 국소 출렁임만 그 자리에서
 *   키우므로</b>(두 스케일 평균 분리 — flow/wave) 마네킹 중력 문제도 비켜간다.
 *
 * 무엇을 안 하는지: 새 측정은 없다. 03a/04(GABOR_ORIENT.last.shape)·17b
 *   (curlHelix·curlClumpW·curlDHalf)가 이미 매 분석마다 재 둔 값만 읽는다.
 *
 * 자리 제안 (아직 안 걸어 둠 — 검토 후 연결):
 *   READ_SHAPE가 뷰별 가닥 길(pts)을 다 걸은 직후, 61번(결 표)·렌더로 넘기기
 *   전에 PHOTO_AMP_GAIN.applyToStrand(pts, sec, angle)를 한 번 통과시키면 된다.
 *   예: adjustStrandGeom(17b) 안에서 READ_SHAPE 처리 다음 줄.
 *
 * 끄기: PHOTO_AMP_GAIN.on=false (전체) · .wave=false · .curl=false (부분)
 * ========================================================================== */
var PHOTO_AMP_GAIN = (function () {
  'use strict';
  var W = (typeof window !== 'undefined') ? window : {};
  var TAG = '[사진 실측 보정]';

  var PG = Object.assign({
    on: true,
    wave: true, curl: true,

    // A. 웨이브 ─────────────────────────────────────────────────────────
    waveGainMin: 1, waveGainMax: 6,     // 배수 범위(바깥은 자름) — 1 = 무보정
    waveGainCal: 1,                      // 실루엣/필터 비율에 곱하는 보정(기존 waveGainCal과 같은 자리 · 기본 1 = 실측 비율 그대로)
    waveSilEdgeLo: 0.40, waveSilEdgeHi: 0.85,  // 실루엣 어디서 잴지(머리 세로 구간 비율) — __rsAutoGain과 동일
    waveFineDiv: 12,                     // 잔결 거르는 평균창 = lamPx / 이 값 (sm 창)
    waveSigFineCm: 1.2, waveSigFlowCm: 6,  // 가닥 자체 출렁임 분리(흐름 vs 웨이브) 평균창 — cm
    waveRootCm: 2,                       // 뿌리에서 이만큼은 배수를 0→1로 서서히(가르마·볼륨 보존, 기존 __rsWaveGain과 같은 생각)

    // B. 컬(고리) ────────────────────────────────────────────────────────
    helixPeak: 0.3, helixBetaLo: 25, helixBetaHi: 78,  // helixMeasure 신뢰 기준 — REGROW/PHOTO_CURL과 같은 문턱(따로 안 만듦)
    clumpDiaK: 1.0,                      // 다발 폭(clumpFind wMed) → 컬 지름 환산 배수(PHOTO_CURL.lockDia와 같은 관계)
    curlGainMin: 1, curlGainMax: 4,
    curlSigFineCm: 0.4, curlSigFlowCm: 2.5,  // 컬은 웨이브보다 짧은 주기라 창도 짧게
    curlRootCm: 0.6,                     // 컬은 웨이브보다 뿌리 램프를 짧게(너무 길면 컬 자체를 못 키움)

    // (2026-11-17b) 뿌리 안정화 — 실측 확인(gydbg 덤프): 뿌리점(두피 고정)이 흐름(flow)
    // 평균에 같이 섞여 들어가면, 뿌리 바로 다음 점들의 자연스러운 급커브(두피법선→중력
    // 방향 전환)가 "출렁임"으로 잘못 읽혀 배수가 곱해지면서 뿌리~두번째점이 몇 cm씩
    // 튕겨 나감(실측: 9.4cm). 그래서: ① 흐름 평균에서 뿌리점 자체는 뺀다(뿌리는 입력도
    // 출력도 항상 그대로) ② 램프를 거리(arc) 기준 외에 점 개수로도 한 번 더 막는다(처음
    // rootMinPts개는 무조건 배수 1) ③ 그래도 생기는 비정상적 한 걸음을 입력 걸음 길이의
    // capK배로 눌러 자른다(안전망 — 다른 원인으로 또 튀어도 막아 줌).
    rootMinPts: 3,
    capK: 2.2,

    // 섹션 → 그 섹션이 주로 보이는 뷰(가중 평균용)
    sectionViews: {
      crown: { front: 0.5, back: 0.5 },
      front: { front: 1 },
      temple: { front: 0.6, left: 0.2, right: 0.2 },
      side: { left: 0.5, right: 0.5 },
      occipital: { back: 1 },
      nape: { back: 1 },
    },

    stats: { wave: {}, curl: {}, calls: 0 },
  }, (W.PHOTO_AMP_GAIN || {}));

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function med(a) { if (!a.length) return null; var b = a.slice().sort(function (x, y) { return x - y; }); var n = b.length; return n % 2 ? b[(n - 1) / 2] : (b[n / 2 - 1] + b[n / 2]) / 2; }

  /* ── A. 웨이브 배수: 뷰별로 '실루엣 실측 ÷ 결읽기(GABOR_ORIENT) 진폭' ──
     __rsAutoGain과 같은 실루엣 측정을 재사용하되(있으면 그대로 읽고, 없으면
     여기서 다시 잼), 머리 전체 중앙값이 아니라 뷰마다 따로 돌려준다. */
  function silhouetteAmp(angle) {
    try {
      var m = state.hairMasks && state.hairMasks[angle];
      var ws = m && m.identity && m.identity.waveShape;     // GABOR_ORIENT.last.shape → 03a가 붙여 둠
      var cv = state.hairCanvases && state.hairCanvases[angle];
      if (!m || !cv || !cv.width || !ws || !(ws.ampPx > 0) || !(ws.lamPx > 0)) return null;
      var CW = cv.width, CH = cv.height, sx = CW / (m.w || CW);
      var A = cv.getContext('2d').getImageData(0, 0, CW, CH).data;
      var hairAt = function (x, y) { return A[4 * (y * CW + x) + 3] > 128; };
      var top = -1, bot = -1;
      for (var yy = 0; yy < CH; yy++) { var any = false; for (var xx = 0; xx < CW; xx += 2) if (hairAt(xx, yy)) { any = true; break; } if (any) { if (top < 0) top = yy; bot = yy; } }
      if (!(bot > top + 40)) return null;
      var H = bot - top, y0 = Math.round(top + PG.waveSilEdgeLo * H), y1 = Math.round(top + PG.waveSilEdgeHi * H), L = [], R = [];
      for (var y = y0; y < y1; y++) { var lo = -1, hi = -1; for (var x = 0; x < CW; x++) if (hairAt(x, y)) { if (lo < 0) lo = x; hi = x; } if (lo >= 0) { L.push(lo / sx); R.push(hi / sx); } }
      if (L.length < 20) return null;
      var sm = function (a, w) { w = Math.max(1, Math.round(w)); var o = new Array(a.length); for (var i = 0; i < a.length; i++) { var s = 0, c = 0; for (var j = i - w; j <= i + w; j++) { var jj = Math.min(a.length - 1, Math.max(0, j)); s += a[jj]; c++; } o[i] = s / c; } return o; };
      var amp = function (E) { var a = sm(E, ws.lamPx / PG.waveFineDiv), b = sm(E, ws.lamPx), s2 = 0; for (var i = 0; i < E.length; i++) { var r = a[i] - b[i]; s2 += r * r; } return Math.sqrt(2 * s2 / E.length); };
      var ea = (amp(L) + amp(R)) / 2;
      return { silAmp: ea, filterAmp: ws.ampPx, ratio: ea / ws.ampPx };
    } catch (e) { return null; }
  }

  var _waveGainCache = {};  // 뷰별 1회 계산 캐시 — identity 바뀌면 무효화
  function waveGainForView(angle) {
    try {
      var m = state.hairMasks && state.hairMasks[angle], id = m && m.identity;
      if (!id) return null;
      var key = angle, c = _waveGainCache[key];
      if (c && c.id === id) return c.g;
      var sa = silhouetteAmp(angle);
      var g = sa ? clamp(sa.ratio * PG.waveGainCal, PG.waveGainMin, PG.waveGainMax) : null;
      _waveGainCache[key] = { id: id, g: g, raw: sa };
      PG.stats.wave[angle] = sa ? { ratio: sa.ratio, gain: g } : { why: '못 잼' };
      return g;
    } catch (e) { return null; }
  }

  /* 섹션의 가중 평균 웨이브 배수. 뷰 데이터가 하나도 없으면 null(호출 쪽에서 1로) */
  PG.waveGainForSection = function (sec) {
    var views = PG.sectionViews[sec] || { front: 0.34, left: 0.22, right: 0.22, back: 0.22 };
    var num = 0, den = 0, any = [];
    Object.keys(views).forEach(function (a) {
      var g = waveGainForView(a);
      if (g == null) return;
      num += g * views[a]; den += views[a]; any.push(g);
    });
    if (den > 0) return num / den;
    if (any.length) return med(any);
    // 아무 뷰도 못 재면, 재 둔 다른 뷰 전체의 중앙값으로(완전히 1보다는 낫다)
    var all = ['front', 'left', 'right', 'back'].map(waveGainForView).filter(function (v) { return v != null; });
    return all.length ? med(all) : null;
  };

  /* ── B. 컬 지름 배수: helix(신뢰 통과) 우선, 아니면 clump 폭 ───────────── */
  PG.curlDiaGainForView = function (angle) {
    try {
      var m = state.hairMasks && state.hairMasks[angle], id = m && m.identity;
      if (!id) return null;
      var cpp = (typeof cmPerMaskPx === 'function') ? cmPerMaskPx(angle) : null;  // cm/px (17b) — 없어도 px끼리 비율은 구할 수 있음
      var grainDiaPx = isFinite(id.curlDHalf) ? id.curlDHalf * 2 : (id.curlAmpPx > 0 ? id.curlAmpPx * 2 : null);
      if (!(grainDiaPx > 0)) return null;
      var hx = id.curlHelix, measuredDiaPx = null, how = null;
      if (hx && hx.peak >= PG.helixPeak && hx.beta >= PG.helixBetaLo && hx.beta <= PG.helixBetaHi && hx.P >= 6 && hx.D > 2) {
        measuredDiaPx = hx.D; how = 'helix';
      } else if (id.curlClumpW > 0) {
        measuredDiaPx = id.curlClumpW * PG.clumpDiaK; how = 'clump';
      }
      if (!(measuredDiaPx > 0)) return null;
      var g = clamp(measuredDiaPx / grainDiaPx, PG.curlGainMin, PG.curlGainMax);
      PG.stats.curl[angle] = { how: how, measuredDiaPx: measuredDiaPx, grainDiaPx: grainDiaPx, gain: g, cmPerPx: cpp };
      return g;
    } catch (e) { return null; }
  };
  PG.curlDiaGainForSection = function (sec) {
    var views = PG.sectionViews[sec] || { front: 0.34, left: 0.22, right: 0.22, back: 0.22 };
    var num = 0, den = 0, any = [];
    Object.keys(views).forEach(function (a) {
      var g = PG.curlDiaGainForView(a);
      if (g == null) return;
      num += g * views[a]; den += views[a]; any.push(g);
    });
    if (den > 0) return num / den;
    if (any.length) return med(any);
    return null;
  };

  /* ── 가닥 점(pts)에 배수 적용 — 로드에 감지 않고, 이미 걸은 길의 국소
     출렁임만 그 자리에서 키운다(두 스케일 평균 분리: flow = 낮은 주파수
     그대로, wave = flow를 뺀 나머지 × gain). 판정 없음 — gain이 1이면
     아무 것도 안 바뀜(수학적으로 항등) */
  function arcLen(pts) {
    var n = pts.length, cum = new Array(n); cum[0] = 0;
    for (var i = 1; i < n; i++) { var p = pts[i - 1], q = pts[i]; cum[i] = cum[i - 1] + Math.hypot(q.x - p.x, q.y - p.y, (q.z || 0) - (p.z || 0)); }
    return cum;
  }
  /* (2026-11-17b) 뿌리점(j=0, 두피 고정점)은 평균에서 뺀다 — 두피법선→중력
     방향으로 꺾이는 자연스러운 급커브가 "출렁임"으로 잘못 읽히는 걸 막기 위함.
     뿌리 자신(i=0)은 흐름도 자기 자신 그대로(패스스루). */
  function smoothByArc(pts, cum, sigUnits) {
    var n = pts.length, out = new Array(n);
    out[0] = { x: pts[0].x, y: pts[0].y, z: pts[0].z || 0 };
    for (var i = 1; i < n; i++) {
      var s0 = cum[i], sx = 0, sy = 0, sz = 0, sw = 0;
      for (var j = 1; j < n; j++) {
        var d = cum[j] - s0, w = Math.exp(-0.5 * (d * d) / (sigUnits * sigUnits));
        if (w < 1e-4) continue;
        sx += pts[j].x * w; sy += pts[j].y * w; sz += (pts[j].z || 0) * w; sw += w;
      }
      if (sw > 0) out[i] = { x: sx / sw, y: sy / sw, z: sz / sw };
      else out[i] = { x: pts[i].x, y: pts[i].y, z: pts[i].z || 0 };
    }
    return out;
  }
  function cmPerUnitSafe() {
    try { if (typeof CM_PER_UNIT !== 'undefined' && CM_PER_UNIT > 0) return CM_PER_UNIT; } catch (e) {}
    try { if (typeof state !== 'undefined' && state.cmPerUnit > 0) return state.cmPerUnit; } catch (e) {}
    try { if (typeof modelCmPerUnit === 'function') { var v = modelCmPerUnit(); if (v > 0) return v; } } catch (e) {}
    return 19.33;
  }

  /* pts: [{x,y,z}, ...] 뿌리(0)→끝 순. sec: 섹션 id. angle: 이 가닥이 속한 뷰(없으면 'front').
     반환: 새 pts 배열(gain==1 또는 측정 없음이면 입력을 그대로 돌려줌) */
  PG.applyToStrand = function (pts, sec, angle, opt) {
    if (!PG.on || !pts || pts.length < 6) return pts;
    PG.stats.calls++;
    opt = opt || {};
    var cpu = cmPerUnitSafe();
    var cum = arcLen(pts);
    var out = pts;
    if (PG.wave && opt.band !== 'curl') {
      var gw = PG.waveGainForSection(sec);
      if (gw != null && Math.abs(gw - 1) > 0.02) out = blend(out, cum, PG.waveSigFineCm / cpu, PG.waveSigFlowCm / cpu, gw, cpu, PG.waveRootCm);
    }
    if (PG.curl && opt.band !== 'wave') {
      var cum2 = arcLen(out);
      var gc = PG.curlDiaGainForSection(sec);
      if (gc != null && Math.abs(gc - 1) > 0.02) out = blend(out, cum2, PG.curlSigFineCm / cpu, PG.curlSigFlowCm / cpu, gc, cpu, PG.curlRootCm);
    }
    return out;

    /* P: 입력 가닥(점 배열, 뿌리=0) · C: P의 호 길이 누적
       sigFine/sigFlow: 평균창(모델 단위) · gain: 적용할 배수 · cpuV: cm/unit
       rootCm: 이 밴드(웨이브 또는 컬)의 뿌리 램프 거리(cm) — 밴드별로 다른 값을 받는다.

       3단 분리(flow/wave/fine) — 파일 의도(위 주석)대로:
         flow = 큰 창(sigFlow)으로 뭉갠 저주파 베이스라인 (그대로 둠)
         wave = 작은 창(sigFine)으로 뭉갠 것 - flow  → 사진으로 실측한 진짜 웨이브/컬 성분(이게 gain을 받음)
         fine = 원본 - 작은 창으로 뭉갠 것         → 화소 단위 결읽기 잡음(배수 없이 그대로 보존 — 안 키움)
       (이전 버전은 sigFine을 실제로 안 쓰고 flow 하나만 썼기 때문에, 화소 잡음까지
        전부 gain을 맞고 커졌었다.) */
    function blend(P, C, sigFine, sigFlow, gain, cpuV, rootCm) {
      var n = P.length;
      var flow = smoothByArc(P, C, sigFlow);
      var mid = smoothByArc(P, C, sigFine);   // 뿌리 제외 평균은 smoothByArc가 이미 처리
      var res = new Array(n);
      var rootUnits = (rootCm / cpuV) || 1e-6;
      res[0] = { x: P[0].x, y: P[0].y, z: P[0].z || 0 };  // 뿌리는 절대 안 건드림(항상 그대로)
      for (var i = 1; i < n; i++) {
        var wx = mid[i].x - flow[i].x, wy = mid[i].y - flow[i].y, wz = (mid[i].z || 0) - flow[i].z;  // 진짜 웨이브/컬 성분
        var fx = P[i].x - mid[i].x, fy = P[i].y - mid[i].y, fz = (P[i].z || 0) - mid[i].z;             // 화소 단위 잔결(안 키움)
        // 뿌리에서 0→1 램프: 호 거리 기준 + 처음 rootMinPts개는 무조건 0(거리 기준만으로는
        // 점 간격이 좁을 때 한두 걸음만에 램프가 다 차 버리는 걸 막는 이중 안전장치)
        var arcRamp = Math.max(0, Math.min(1, C[i] / rootUnits));
        var ramp = (i < PG.rootMinPts) ? 0 : arcRamp;
        var g = 1 + (gain - 1) * ramp;
        res[i] = {
          x: flow[i].x + wx * g + fx,
          y: flow[i].y + wy * g + fy,
          z: flow[i].z + wz * g + fz
        };
      }
      return clampSteps(P, res, cpuV);
    }

    /* 안전망: 그래도 어떤 이유로든 한 구간이 비정상적으로 늘어나면, 입력 구간
       길이의 capK배를 넘지 않도록 뿌리부터 바깥쪽으로 순서대로 눌러 자른다.
       (뒤 점들은 이미 눌린 앞 점을 기준으로 이어 붙이므로, 한 군데를 잘라도
       그 뒤 모양 전체가 그대로 밀려 끊기지 않는다.) */
    function clampSteps(P, R, cpuV) {
      var n = R.length, out = new Array(n);
      out[0] = R[0];
      for (var i = 1; i < n; i++) {
        var p0 = P[i - 1], p1 = P[i];
        var inLen = Math.hypot(p1.x - p0.x, p1.y - p0.y, (p1.z || 0) - (p0.z || 0));
        var r0 = out[i - 1], r1 = R[i];
        var dx = r1.x - r0.x, dy = r1.y - r0.y, dz = (r1.z || 0) - (r0.z || 0);
        var outLen = Math.hypot(dx, dy, dz);
        var maxLen = Math.max(inLen * PG.capK, 0.02 / cpuV);  // 아주 짧은 입력 구간도 완전히 0으로 안 눌리게 최소치
        if (outLen > maxLen && outLen > 1e-9) {
          var k = maxLen / outLen;
          out[i] = { x: r0.x + dx * k, y: r0.y + dy * k, z: r0.z + dz * k };
        } else {
          out[i] = r1;
        }
      }
      return out;
    }
  };

  try { console.log(TAG + ' 설치 — 결읽기 진폭(웨이브)·고리 지름(컬)을 사진 실측값 비율로 보정(판정 없음, 신뢰 낮으면 자동 1배). 끄기 PHOTO_AMP_GAIN.on=false'); } catch (e) {}
  return PG;
})();
