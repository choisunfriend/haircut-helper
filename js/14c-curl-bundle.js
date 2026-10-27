/* ==========================================================================
 * 14c-curl-bundle.js — 펌 컬을 "로드(와인딩) 번들" 단위로, cm 실치수로 감는다
 * (2026-09-21 배포본 기준으로 원본 복원 · 주석 재작성)
 *
 * 로드 위치: index.html 에서 17b-cut3d-piece.js 바로 다음, 18-perf-i18n-boot.js 앞.
 *   14-hair-3d-ops.js 의 curlStrand3D 를 <b>감싸서 바꿔 끼운다</b>(래퍼 패턴).
 *   17b buildStrand3D 는 전역 이름 curlStrand3D 를 부르므로 코드 수정 없이 이쪽을 탄다.
 *
 * ── 왜 번들인가 (2026-09-20 1차 판에서 이어짐) ─────────────────────────
 *   예전 curlStrand3D 는 가닥마다 자기 뿌리에서 프레임(u,v)·위상을 따로 잡았다.
 *   뿌리 위치·컷 길이가 조금만 달라도 이웃 가닥과 위상이 어긋나고, 나선 반경이
 *   가닥 간격의 절반을 넘는 순간 서로를 통과해 화면에 X자 교차가 생겼다.
 *   → 두피를 로드 지름 크기 격자로 나눠 "번들"을 만들고, 번들마다 축·프레임·위상을
 *     한 번만 정한다. 같은 번들의 가닥은 같은 나선을 받아 통째로 움직인다
 *     (실제 펌도 로드 하나에 감긴 패널이 같은 나선을 그린다).
 *
 * ── 이번(2026-09-21) 판에서 달라진 것 ────────────────────────────────
 *   ① <b>cm 단위 코일 모델</b>: 로드 지름(cm) → 코일 반경·피치를 cm로 정하고
 *      모델 단위로 환산한다(cmPerUnit). 예전엔 두상 비율로 적어 손님 머리 크기에 따라
 *      컬 크기가 들쭉날쭉했다.
 *   ② 뿌리 쪽 rootLeaveCm 은 감지 않고(실제 펌도 뿌리 1~3cm는 남긴다), 끝에서부터
 *      최대 windCm 까지만 감는다.
 *   ③ <b>번들 당김(clumpPull)</b>: 같은 번들 가닥들을 번들 중심 쪽으로 조금 모아
 *      컬 덩어리가 또렷해 보이게 한다.
 *   ④ <b>프리셋</b>: setPermPreset('coil'|'wave'|null) — 로드 지름을 직접 정하는 모드.
 *      null이면 14의 curlRodRadius(wave 슬라이더)와 CURL3D_FIX.ampGamma 를 그대로 쓴다.
 *   ⑤ 안전장치: 결과에 NaN/Infinity가 섞이면 원래 curlStrand3D 로 되돌린다(stats.nan).
 *   ⑥ logCurlScale 도 감싸서 [컬 환산·번들] 로그에 실제 cm 값을 찍는다.
 *   ⑦ 전역 오염을 줄이려고 즉시실행함수로 감쌌다. 설정은 window.CURL_BUNDLE 로 공개 —
 *      24-style-base.js 가 스타일 프로필로 이 값들을 잠깐 바꿔 끼운다(withTemp).
 *
 * 끄기: 콘솔에서 CURL_BUNDLE.on = false  → 원래 curlStrand3D 로 통과
 * 상태: CURL_BUNDLE.stats  (bundles/strands/curled/fallback/nan, cmSrc = 자 출처)
 * ========================================================================== */
(function () {
  'use strict';

  /* ── 설정 ─────────────────────────────────────────────────────────── */
  var CB = {
    on: true,
    preset: null,          // null = 슬라이더(curlRodRadius) 모드, 'coil' | 'wave' = 프리셋 모드
    cmPerUnit: 19.33,      // 자를 못 찾을 때 쓰는 기본값(모델 1단위 ≈ 19.33cm, 성인 두상 근사)
    relax: 1.45,           // 코일 반경 = 로드 반지름 × relax — 로드에서 풀고 나면 컬이 조금 벌어진다
    clumpPull: 0.3,        // 번들 중심 쪽으로 모으는 세기(0 = 안 모음)
    clumpRampCm: 3,        // 감기 시작점에서 이 길이(cm)에 걸쳐 모으기가 0→1
    strength: 1,           // 코일 반경 전체 배율
    pitchThin: 1,          // 가는 로드의 피치 = 로드 지름 × 이 값
    pitchThick: 3.5,       // 굵은 로드의 피치 = 로드 지름 × 이 값 (가늘면 링렛, 굵으면 늘어진 웨이브)
    rodThinCm: 1,          // 이 지름 이하 = "가는 로드"
    rodThickCm: 4,         // 이 지름 이상 = "굵은 로드" (사이는 선형 보간)
    windCm: 20,            // 끝에서부터 최대 이만큼만 감는다
    rootLeaveCm: 1.5,      // 뿌리에서 이만큼은 감지 않고 남긴다
    rampCm: 1.5,           // 감기 시작점에서 이 길이에 걸쳐 반경이 0→R (갑자기 꺾이지 않게)
    minWindCm: 1,          // 감을 길이가 이보다 짧으면 안 감는다
    rodK: 1.5,             // 번들 칸 크기 = 로드 지름 × rodK
    microAmp: 0.07,        // 번들 안 가닥별 반경 흔들림(±비율) — 0이면 판때기처럼 똑같다
    microPhase: 0.12,      // 번들 안 가닥별 위상 흔들림(±rad)
    phaseStep: 0.55,       // 이웃 칸끼리 위상 차(rad) — 번들이 갈라져 보이는 정도
    phaseJitter: 1.2,      // 칸 위상에 섞는 난수 폭(±rad)
    minSamples: 12,        // 감긴 구간 샘플 수 하한/상한 (한 바퀴에 약 14점)
    maxSamples: 400,
    presets: {
      // 촘촘한 코일(히피펌·스파이럴) — 가는 로드, 뿌리 1cm만 남김
      coil: { rodMinCm: 0.8, rodMaxCm: 1.8, amp: 1,    windCm: 99, rootLeaveCm: 1, microAmp: 0.10, microPhase: 0.25, phaseJitter: 0.8 },
      // 굵은 웨이브 — 굵은 로드, 진폭 0.75, 뿌리 3cm 남김
      wave: { rodMinCm: 1.8, rodMaxCm: 3.2, amp: 0.75, windCm: 99, rootLeaveCm: 3, microAmp: 0.12, microPhase: 0.30, phaseJitter: 1.0 }
    },
    stats: { bundles: 0, strands: 0, curled: 0, fallback: 0, nan: 0, cmSrc: '' }
  };

  /* 이 파일보다 먼저 누군가 window.CURL_BUNDLE 을 만들어 뒀으면(예: 콘솔에서 미리 설정)
     그 값을 넘겨받는다 — stats·presets 는 이 파일 것을 쓴다. */
  if (typeof window !== 'undefined') {
    var pre = window.CURL_BUNDLE;
    if (pre && typeof pre === 'object') {
      for (var key in pre) {
        if (key !== 'stats' && key !== 'presets' && Object.prototype.hasOwnProperty.call(CB, key)) CB[key] = pre[key];
      }
    }
    window.CURL_BUNDLE = CB;
  }

  /* 번들 캐시 — ADJ_CACHE.gen(조정 캐시 세대)이 바뀌면 통째로 비운다. */
  var bundleCache = new Map();
  var cacheGen = -1;

  function adjGen() {
    try { return (typeof ADJ_CACHE !== 'undefined' && ADJ_CACHE && ADJ_CACHE.gen) | 0; } catch (e) { return 0; }
  }
  /* 정수 3개 → 0~1 결정적 난수 */
  function hash3(a, b, c) {
    var h = (Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663) ^ Math.imul(c | 0, 83492791)) >>> 0;
    h ^= h >>> 13;
    h = Math.imul(h, 1274126177) >>> 0;
    h ^= h >>> 16;
    return h / 4294967296;
  }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  /* 점 하나가 유한한가 — (x+y+z)*0 은 NaN/Infinity가 섞이면 0이 아니다 */
  function finitePt(p) { return !!p && (p.x + p.y + p.z) * 0 === 0; }
  function finitePts(a) {
    if (!a || !a.length) return false;
    for (var i = 0; i < a.length; i++) if (!finitePt(a[i])) return false;
    return true;
  }

  /* 모델 1단위 = 몇 cm — CM_PER_UNIT → state.cmPerUnit → CB.cmPerUnit 순. 출처를 stats에 남긴다. */
  function cmPerUnit() {
    var v;
    try { if (typeof CM_PER_UNIT !== 'undefined' && (v = +CM_PER_UNIT) > 0 && isFinite(v)) { CB.stats.cmSrc = 'CM_PER_UNIT'; return v; } } catch (e) {}
    try { if (typeof state !== 'undefined' && state && (v = +state.cmPerUnit) > 0 && isFinite(v)) { CB.stats.cmSrc = 'state.cmPerUnit'; return v; } } catch (e) {}
    v = +CB.cmPerUnit;
    CB.stats.cmSrc = 'CURL_BUNDLE.cmPerUnit';
    return (v > 0 && isFinite(v)) ? v : 19.33;
  }

  /* 컬 세기(0~100)·웨이브(0~1) → 코일 파라미터. 못 구하면 null(→ 원래 함수로 폴백).
     반환: cpu(cm/단위) · rodCm · amp · R(코일 반경, 단위) · pitch(라디안당 전진, 단위) ·
           turnLen(라디안당 호길이) · rod(로드 지름, 단위) · sig(캐시 키용 서명) 등 */
  function coilParams(curl, waveT) {
    var cpu = cmPerUnit();
    var P = CB.preset && CB.presets && CB.presets[CB.preset];
    var c = {
      cpu: cpu, windCm: CB.windCm, rootLeaveCm: CB.rootLeaveCm,
      microAmp: CB.microAmp, microPhase: CB.microPhase, phaseJitter: CB.phaseJitter,
      rodCm: 0, amp: 0, name: P ? CB.preset : '-'
    };
    if (P) {
      // 프리셋 모드: 웨이브 슬라이더가 로드 지름을 프리셋 범위 안에서 고른다
      c.rodCm = P.rodMinCm + (P.rodMaxCm - P.rodMinCm) * clamp(isFinite(waveT) ? waveT : 0.5, 0, 1);
      c.amp = P.amp;
      if (P.windCm != null) c.windCm = P.windCm;
      if (P.rootLeaveCm != null) c.rootLeaveCm = P.rootLeaveCm;
      if (P.microAmp != null) c.microAmp = P.microAmp;
      if (P.microPhase != null) c.microPhase = P.microPhase;
      if (P.phaseJitter != null) c.phaseJitter = P.phaseJitter;
    } else {
      // 슬라이더 모드: 14의 curlRodRadius(렌더·로그와 같은 출처)로 로드 반지름을 받는다
      if (typeof curlRodRadius !== 'function') return null;
      var rr = +curlRodRadius(waveT);
      if (!(rr > 0) || !isFinite(rr)) return null;
      c.rodCm = rr * 2 * cpu;
      var FIX = (typeof CURL3D_FIX !== 'undefined' && CURL3D_FIX) || {};
      var gamma = isFinite(FIX.ampGamma) ? FIX.ampGamma : 1;
      c.amp = Math.pow(clamp(curl, 0, 100) / 100, gamma);
    }
    if (!(c.rodCm > 0.05) || !(c.amp > 0)) return null;

    // 로드가 굵을수록 피치를 크게(가늘면 링렛, 굵으면 늘어진 웨이브)
    var thick = clamp((c.rodCm - CB.rodThinCm) / Math.max(1e-6, CB.rodThickCm - CB.rodThinCm), 0, 1);
    var pitchCm = c.rodCm * (CB.pitchThin + (CB.pitchThick - CB.pitchThin) * thick);
    var radiusCm = c.rodCm / 2 * CB.relax * CB.strength * c.amp;
    pitchCm *= 1 + (1 - c.amp) * 0.8;          // 약한 컬일수록 늘어진다
    c.R = radiusCm / cpu;
    c.pitch = pitchCm / (Math.PI * 2) / cpu;    // 라디안당 축 방향 전진
    c.turnLen = Math.sqrt(c.R * c.R + c.pitch * c.pitch);  // 라디안당 가닥 호길이
    c.rod = c.rodCm / cpu;
    if (!(c.R > 1e-9) || !(c.pitch > 1e-9) || !isFinite(c.turnLen)) return null;
    c.sig = [c.name, c.rodCm.toFixed(3), c.amp.toFixed(3), c.R.toExponential(3), c.pitch.toExponential(3),
             c.windCm, c.rootLeaveCm, c.phaseJitter, CB.rodK, CB.phaseStep].join('|');
    return c;
  }

  /* 가닥의 누적 호길이 배열 */
  function arcLens(pts) {
    var n = pts.length, s = new Float64Array(n);
    for (var i = 1; i < n; i++) {
      var a = pts[i - 1], b = pts[i];
      s[i] = s[i - 1] + Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    }
    return s;
  }
  /* 점 객체에 x,y,z 말고 붙어 있는 속성 이름들(색·섹션 등) — 보간 때 같이 옮긴다 */
  function extraKeys(p) {
    var ks = [];
    for (var k in p) if (k !== 'x' && k !== 'y' && k !== 'z' && Object.prototype.hasOwnProperty.call(p, k)) ks.push(k);
    return ks;
  }
  /* 호길이 s 위치의 점(이분 탐색 + 선형 보간). 숫자 속성은 보간, 아니면 가까운 쪽 값. */
  function pointAt(pts, S, s, keys) {
    var n = pts.length, total = S[n - 1];
    if (s <= 0) s = 0; else if (s >= total) s = total;
    var lo = 0, hi = n - 1;
    while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (S[mid] <= s) lo = mid; else hi = mid; }
    var a = pts[lo], b = pts[hi], seg = S[hi] - S[lo];
    var t = seg > 1e-12 ? (s - S[lo]) / seg : 0;
    var out = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
    if (keys.length) {
      var near = t < 0.5 ? a : b;
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i], va = a[k], vb = b[k];
        out[k] = (typeof va === 'number' && typeof vb === 'number' && isFinite(va) && isFinite(vb)) ? va + (vb - va) * t : near[k];
      }
    }
    return out;
  }

  /* 뿌리 위치 → 두피 격자 칸(i,j)과 그 칸 중심 방향(ref, 단위벡터).
     구면좌표(θ=위에서 내려온 각, φ=수평 각)로 칸을 나누고, 칸 한 변 = 로드 지름 × rodK.
     sinθ 하한 0.25 — 정수리에서 칸이 한 점으로 모이지 않게. */
  function scalpCell(root, rod) {
    if (typeof getHeadEllipsoid !== 'function' || typeof SCALP_CENTER_Y === 'undefined') return null;
    var E = null;
    try { E = getHeadEllipsoid(); } catch (e) { return null; }
    if (!E || !(E.a > 0) || !(E.b > 0) || !(E.c > 0)) return null;
    var cy = +SCALP_CENTER_Y;
    if (!isFinite(cy)) return null;
    var x = root.x, y = root.y - cy, z = root.z;
    var r = Math.hypot(x, y, z);
    if (!(r > 1e-9)) return null;
    var Rm = (E.a + E.b + E.c) / 3;             // 평균 두상 반경
    var cell = rod * CB.rodK;
    if (!(cell > 1e-5)) return null;
    var theta = Math.acos(clamp(y / r, -1, 1));
    var phi = Math.atan2(x, z);
    var sinT = Math.max(0.25, Math.sin(theta));
    var i = Math.floor(phi * Rm * sinT / cell);
    var j = Math.floor(theta * Rm / cell);
    if (!isFinite(i) || !isFinite(j)) return null;
    var thC = (j + 0.5) * cell / Rm;
    var sinC = Math.max(0.25, Math.sin(thC));
    var phC = (i + 0.5) * cell / (Rm * sinC);
    return { i: i, j: j, ref: { x: Math.sin(phC) * Math.sin(thC), y: Math.cos(thC), z: Math.cos(phC) * Math.sin(thC) } };
  }

  /* 번들 하나의 공통 프레임(u,v)·위상. 같은 칸 + 같은 컬 설정이면 캐시에서 꺼낸다.
     축 = 감기 시작점 → 가닥 끝 방향(없으면 아래). u = ref를 축에 수직 투영(안 되면 +Y, +X). */
  function bundleFrame(pts, S, sWind, c, curl, waveT, curlDir) {
    var cell = scalpCell(pts[0], c.rod);
    if (!cell) return null;
    var g = adjGen();
    if (g !== cacheGen || bundleCache.size > 20000) {
      bundleCache.clear(); cacheGen = g;
      CB.stats.bundles = 0; CB.stats.strands = 0; CB.stats.curled = 0;
    }
    var key = cell.i + '|' + cell.j + '|' + curl.toFixed(1) + '|' + waveT.toFixed(3) + '|' + (curlDir | 0) + '|' + c.sig;
    CB.stats.strands++;
    var hit = bundleCache.get(key);
    if (hit) return hit;

    var n = pts.length;
    var start = pointAt(pts, S, sWind, []);
    var tip = pts[n - 1];
    var ax = { x: tip.x - start.x, y: tip.y - start.y, z: tip.z - start.z };
    var al = Math.hypot(ax.x, ax.y, ax.z);
    if (!(al > 1e-9)) { ax = { x: 0, y: -1, z: 0 }; al = 1; }
    ax = { x: ax.x / al, y: ax.y / al, z: ax.z / al };

    var cands = [cell.ref, { x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }];
    var u = null;
    for (var k = 0; k < cands.length; k++) {
      var r = cands[k], d = r.x * ax.x + r.y * ax.y + r.z * ax.z;
      var p = { x: r.x - d * ax.x, y: r.y - d * ax.y, z: r.z - d * ax.z };
      var pl = Math.hypot(p.x, p.y, p.z);
      if (pl > 1e-6) { u = { x: p.x / pl, y: p.y / pl, z: p.z / pl }; break; }
    }
    if (!u) return null;
    var v = { x: ax.y * u.z - ax.z * u.y, y: ax.z * u.x - ax.x * u.z, z: ax.x * u.y - ax.y * u.x };

    // 위상 = 컬 방향(±100 → ±π) + 칸 위치에 따른 계단(phaseStep) + 칸 난수(phaseJitter)
    var jitter = (hash3(cell.i, cell.j, 7) - 0.5) * 2 * c.phaseJitter;
    var phase = clamp(curlDir, -100, 100) / 100 * Math.PI + (cell.i + cell.j * 0.5) * CB.phaseStep + jitter;
    var fr = { u: u, v: v, phase: phase, ref: cell.ref };
    if (!isFinite(phase) || !finitePt(u) || !finitePt(v)) return null;
    bundleCache.set(key, fr);
    CB.stats.bundles++;
    return fr;
  }

  /* 한 가닥을 감는다. 반환: 새 점 배열 / 원래 pts(감을 게 없음) / null(실패 → 폴백) */
  function windStrand(pts, curl, waveT, curlDir) {
    var c = coilParams(curl, waveT);
    if (!c) return null;
    var S = arcLens(pts), total = S[S.length - 1];
    if (!(total > 1e-5)) return pts;
    var perCm = 1 / c.cpu;
    // 감을 길이 = min(전체 − 뿌리 남김, windCm)
    var windLen = Math.min(Math.max(0, total - c.rootLeaveCm * perCm), c.windCm * perCm);
    if (windLen < CB.minWindCm * perCm) return pts;
    var sWind = total - windLen;               // 이 호길이부터 끝까지 감는다
    var fr = bundleFrame(pts, S, sWind, c, curl, waveT, curlDir);
    if (!fr) return null;
    CB.stats.curled++;

    // 감으면 가닥이 축 방향으로 짧아진다: 축 전진 = 호길이 × (pitch / turnLen)
    var axial = windLen * (c.pitch / c.turnLen);
    var turns = windLen / c.turnLen / (Math.PI * 2);
    var N = Math.max(CB.minSamples, Math.min(CB.maxSamples, Math.ceil(turns * 14) + 2));
    var ramp = Math.max(1e-6, CB.rampCm * perCm);
    var root = pts[0];
    // 가닥별 미세 흔들림(뿌리 좌표 해시) — 번들 안에서도 완전히 똑같진 않게
    var hr = hash3(Math.round(root.x * 9973), Math.round(root.y * 9973), Math.round(root.z * 9973));
    var ampMul = 1 + (hr - 0.5) * 2 * c.microAmp;
    var phMul = (hr - 0.5) * 2 * c.microPhase;
    var keys = extraKeys(root);

    // 감기 전 구간은 그대로 복사
    var out = [];
    for (var i = 0; i < pts.length && S[i] < sWind; i++) out.push(pts[i]);

    // 번들 당김: 뿌리를 번들 중심(ref 방향, 같은 반경) 쪽으로 옮기는 벡터 × clumpPull
    var pull = null;
    var pullRamp = Math.max(1e-6, (CB.clumpRampCm || 3) * perCm);
    if (CB.clumpPull > 0 && fr.ref && typeof SCALP_CENTER_Y !== 'undefined') {
      var cy = +SCALP_CENTER_Y, rf = fr.ref;
      var rr = Math.hypot(root.x, root.y - cy, root.z);
      var k = CB.clumpPull;
      if (rr > 0 && isFinite(cy)) {
        pull = { x: (rf.x * rr - root.x) * k, y: (rf.y * rr + cy - root.y) * k, z: (rf.z * rr - root.z) * k };
      }
    }

    // 감긴 구간: 축(원래 스파인)을 따라 axial 만큼 가며 나선 변위를 더한다
    for (var q = 0; q <= N; q++) {
      var a = axial * (q / N);
      var p = pointAt(pts, S, sWind + a, keys);
      var ang = fr.phase + phMul + (a - axial) / c.pitch;   // 끝에서 위상이 번들 공통값에 맞도록
      var rad = c.R * ampMul * Math.min(1, a / ramp);        // 시작부는 반경 0→R
      var cu = Math.cos(ang) * rad, sv = Math.sin(ang) * rad;
      if (pull) {
        var w = Math.min(1, a / pullRamp);
        p.x += pull.x * w; p.y += pull.y * w; p.z += pull.z * w;
      }
      p.x += fr.u.x * cu + fr.v.x * sv;
      p.y += fr.u.y * cu + fr.v.y * sv;
      p.z += fr.u.z * cu + fr.v.z * sv;
      out.push(p);
    }
    return out.length >= 2 ? out : pts;
  }

  /* ── curlStrand3D 바꿔 끼우기 ───────────────────────────────────────
     __cbBase 에 원래 함수를 달아 둬서, 이 파일이 두 번 로드돼도 래퍼가 겹치지 않는다. */
  if (typeof curlStrand3D !== 'function') return;
  var baseCurl = curlStrand3D.__cbBase || curlStrand3D;

  function curlStrand3DBundled(pts, curlAmt, waveT, curlDir) {
    if (!CB.on) return baseCurl(pts, curlAmt, waveT, curlDir);
    var curl = +curlAmt;
    if (!pts || pts.length < 3 || !(curl > 0)) return pts;
    if (!finitePts(pts)) return baseCurl(pts, curlAmt, waveT, curlDir);
    var res = null;
    try {
      res = windStrand(pts, curl, isFinite(+waveT) ? +waveT : 0, isFinite(+curlDir) ? +curlDir : 0);
    } catch (e) { res = null; }
    if (res && finitePts(res)) return res;
    // 실패 → 원래 함수로. NaN이 섞였던 경우는 따로 센다
    if (res) CB.stats.nan++;
    CB.stats.fallback++;
    var fb = null;
    try { fb = baseCurl(pts, curlAmt, waveT, curlDir); } catch (e) { fb = null; }
    return finitePts(fb) ? fb : pts;
  }
  curlStrand3DBundled.__cbBase = baseCurl;
  // eslint-disable-next-line no-global-assign
  curlStrand3D = curlStrand3DBundled;

  /* ── logCurlScale 감싸기 — [컬 환산·번들] 로그에 실제 cm 값 ────────────
     같은 내용이면 다시 안 찍는다(슬라이더를 움직일 때마다 도배되지 않게). */
  (function () {
    if (typeof logCurlScale !== 'function') return;
    var baseLog = logCurlScale.__cbOld || logCurlScale;
    var lastTxt = '';
    var wrapped = logCurlScale = function () {
      if (!CB.on) return baseLog();
      try {
        if (typeof state === 'undefined' || !state || !state.sections || typeof SECTION_ORDER === 'undefined') return;
        var rows = [];
        for (var i = 0; i < SECTION_ORDER.length; i++) {
          var k = SECTION_ORDER[i], s = state.sections[k];
          if (!s || !(s.curl > 0)) continue;
          var w = typeof s.wave === 'number' ? s.wave : 50;
          var p = coilParams(s.curl, w / 100);
          if (!p) continue;
          var cpu = p.cpu, Rcm = p.R * cpu, pitchCm = p.pitch * 2 * Math.PI * cpu, circ = Math.PI * 2 * Rcm;
          rows.push(k + ' 컬' + s.curl + '/웨이브' + w + ' → 코일 지름 <b>' + (Rcm * 2).toFixed(2) + 'cm</b> · 한 바퀴 피치 '
            + pitchCm.toFixed(2) + 'cm · 피치/둘레 <b>' + (pitchCm / circ).toFixed(2) + '</b> · 남는 길이 '
            + Math.round(p.pitch / p.turnLen * 100) + '% · 번들 칸 ' + (p.rod * CB.rodK * cpu).toFixed(2) + 'cm');
        }
        if (!rows.length) return;
        var txt = rows.join('\n  ');
        if (txt === lastTxt) return;
        lastTxt = txt;
        console.log('[컬 환산·번들] CURL_BUNDLE 실제 값 (relax ' + CB.relax + ' · rodK ' + CB.rodK
          + ' · phaseJitter ' + CB.phaseJitter + ' · clumpPull ' + CB.clumpPull + ')\n  ' + txt
          + '\n  피치/둘레 0.6 넘으면 늘어난 용수철, 0.3~0.5면 링렛. 코일 지름 1cm 이하면 가는 전화선처럼 보입니다.');
      } catch (e) {}
    };
    wrapped.__cbOld = baseLog;
  })();

  /* 콘솔용: setPermPreset('coil') / setPermPreset('wave') / setPermPreset(null) */
  if (typeof window !== 'undefined') {
    window.setPermPreset = function (name) {
      CB.preset = (name && CB.presets[name]) ? name : null;
      bundleCache.clear();
      return CB.preset;
    };
  }
})();
