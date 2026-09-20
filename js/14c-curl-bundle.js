/* 14c-curl-bundle.js
 * 펌 웨이브를 "가닥 단위"가 아니라 "로드(와인딩) 단위"로 묶어서 적용한다.
 *
 * 문제: 기존 curlStrand3D()는 가닥마다 자기 뿌리 위치에서 프레임(u,v)을 만들고
 *       자기 스파인을 따라 평행이송하면서 나선을 감았다. 뿌리 위치·컷 길이·
 *       곡률이 조금씩 다르면 이웃 가닥의 프레임과 위상이 갈라지고, 나선반경이
 *       가닥 간격의 절반을 넘는 순간 서로를 통과한다 → 화면에서 X자 교차.
 *
 * 해법: 두피 위에서 로드 지름만큼 격자를 끊어 "번들"을 만들고, 번들마다
 *       축(axis) · 프레임(u,v) · 위상(phase)을 한 번만 정한다. 같은 번들의
 *       가닥은 호길이 s에 대해 "완전히 같은 변위 d(s)"를 받으므로 번들 전체가
 *       평행이동한다. 평행이동은 순서를 바꾸지 않으므로 교차가 원리적으로 없다.
 *       (실제 펌도 로드 하나에 감긴 패널이 통째로 같은 나선을 그린다.)
 */

const CURL_BUNDLE = {
  on: true,
  rodK: 1.0,         // 번들 폭 = 로드 지름 × rodK (1.0 = 로드 실치수)
  microAmp: 0.02,    // 번들 안에서 가닥별 진폭 흔들림 (0이면 완전 판때기)
  microPhase: 0.03,  // 번들 안에서 가닥별 위상 흔들림 (rad)
  phaseStep: 0.55,   // 이웃 번들끼리 벌어지는 위상 (rad) — 판이 갈라져 보이는 정도
  phaseJitter: 0.35, // 번들 위상에 섞는 난수 폭 (rad)
  ramp: 0.12,        // 뿌리 쪽에서 진폭이 0→1 되는 구간 (스파인 길이 비율)
  minSamples: 24,
  maxSamples: 400,
  debug: false,
};

const _curlBundleCache = new Map();
let _curlBundleGen = -1;
let _curlBundleStats = { bundles: 0, strands: 0 };

function _cbGen() {
  try { return (typeof ADJ_CACHE !== 'undefined' && ADJ_CACHE.gen) | 0; } catch (e) { return 0; }
}

function _cbHash(a, b, c) {
  let h = (Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663) ^ Math.imul(c | 0, 83492791)) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 1274126177) >>> 0; h ^= h >>> 16;
  return h / 4294967296;
}

/* 뿌리 위치 → 두피 격자 칸(번들 좌표). 칸 한 변 = 로드 지름. */
function curlBundleCell(root, rodR) {
  let E = null;
  try { E = getHeadEllipsoid(); } catch (e) { return null; }
  if (!E || !(E.a > 0) || !(E.b > 0) || !(E.c > 0)) return null;

  const x = root.x, y = root.y - SCALP_CENTER_Y, z = root.z;
  const r = Math.hypot(x, y, z);
  if (!(r > 1e-9)) return null;

  const rMean = (E.a + E.b + E.c) / 3;
  const rod = Math.max(1e-4, rodR * 2 * CURL_BUNDLE.rodK);

  const phi = Math.acos(Math.max(-1, Math.min(1, y / r)));   // 0=정수리
  const theta = Math.atan2(x, z);                             // 0=뒤통수 중앙
  const shrink = Math.max(0.25, Math.sin(phi));               // 정수리에서 칸이 무한히 좁아지는 것 방지

  const su = theta * rMean * shrink;  // 두피 위 가로 호길이
  const sv = phi * rMean;             // 두피 위 세로 호길이

  const i = Math.floor(su / rod), j = Math.floor(sv / rod);
  // 칸 중심을 3D 방향으로 되돌린다 (번들 공통 기준 방향)
  const phiC = ((j + 0.5) * rod) / rMean;
  const shrinkC = Math.max(0.25, Math.sin(phiC));
  const thetaC = ((i + 0.5) * rod) / (rMean * shrinkC);
  return {
    i, j, rod,
    ref: { x: Math.sin(thetaC) * Math.sin(phiC), y: Math.cos(phiC), z: Math.cos(thetaC) * Math.sin(phiC) },
  };
}

/* 번들 하나의 나선 파라미터를 정한다(캐시). 같은 칸의 첫 가닥이 축을 정한다. */
function curlBundleField(root, pts, curl, waveNorm, curlDir) {
  const rodR = curlRodRadius(waveNorm);
  const cell = curlBundleCell(root, rodR);
  if (!cell) return null;

  const gen = _cbGen();
  if (gen !== _curlBundleGen) {
    _curlBundleCache.clear();
    _curlBundleGen = gen;
    _curlBundleStats = { bundles: 0, strands: 0 };
  }
  const id = cell.i + '|' + cell.j + '|' + curl.toFixed(1) + '|' + waveNorm.toFixed(3) + '|' + (curlDir | 0);
  const hit = _curlBundleCache.get(id);
  _curlBundleStats.strands++;
  if (hit) return hit;

  const amp01 = Math.pow(Math.max(0, Math.min(100, curl)) / 100, CURL3D_FIX.ampGamma);
  const R = rodR * Math.pow(amp01, CURL3D_FIX.radiusGamma);
  const pitch = rodR * (2.6 - 2.28 * amp01);
  const turnLen = Math.sqrt(R * R + pitch * pitch) || 1e-4;
  if (!(R > 1e-9) || !(pitch > 1e-9)) return null;

  // 축: 이 번들을 대표하는 뿌리→끝 방향
  const tip = pts[pts.length - 1];
  let ax = { x: tip.x - root.x, y: tip.y - root.y, z: tip.z - root.z };
  let axL = Math.hypot(ax.x, ax.y, ax.z);
  if (!(axL > 1e-9)) { ax = { x: 0, y: -1, z: 0 }; axL = 1; }
  ax = { x: ax.x / axL, y: ax.y / axL, z: ax.z / axL };

  // u축: 번들 중심의 바깥 방향을 축에 수직으로 투영
  const cands = [cell.ref, { x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }];
  let u = null;
  for (const c of cands) {
    const d = c.x * ax.x + c.y * ax.y + c.z * ax.z;
    const p = { x: c.x - d * ax.x, y: c.y - d * ax.y, z: c.z - d * ax.z };
    const pl = Math.hypot(p.x, p.y, p.z);
    if (pl > 1e-6) { u = { x: p.x / pl, y: p.y / pl, z: p.z / pl }; break; }
  }
  if (!u) return null;
  const v = {
    x: ax.y * u.z - ax.z * u.y,
    y: ax.z * u.x - ax.x * u.z,
    z: ax.x * u.y - ax.y * u.x,
  };

  // 위상: 이웃 번들끼리 조금씩만 어긋나게 (완전 난수면 다시 갈라져 보인다)
  const jitter = (_cbHash(cell.i, cell.j, 7) - 0.5) * 2 * CURL_BUNDLE.phaseJitter;
  const phase = (Math.max(-100, Math.min(100, curlDir || 0)) / 100) * Math.PI
              + (cell.i + cell.j * 0.5) * CURL_BUNDLE.phaseStep + jitter;

  // 뿌리 램프 기준 길이도 번들 공통으로 고정
  const refArc = arcLength3D(pts);
  const refSpine = refArc * (pitch / turnLen);

  const field = { cell, R, pitch, turnLen, u, v, phase, rampLen: Math.max(1e-6, refSpine * CURL_BUNDLE.ramp) };
  if (_curlBundleCache.size > 20000) { _curlBundleCache.clear(); _curlBundleStats = { bundles: 0, strands: 0 }; }
  _curlBundleCache.set(id, field);
  _curlBundleStats.bundles++;
  return field;
}

const _curlStrand3D_perStrand = curlStrand3D;

/* 덮어쓰기: 번들 단위 나선 */
curlStrand3D = function (pts, curl, waveNorm, curlDir) {
  if (!CURL_BUNDLE.on) return _curlStrand3D_perStrand(pts, curl, waveNorm, curlDir);
  if (!pts || pts.length < 3 || !(curl > 0)) return pts;

  const arc = arcLength3D(pts);
  if (arc < 1e-5) return pts;

  const root = pts[0];
  const f = curlBundleField(root, pts, curl, waveNorm, curlDir);
  if (!f) return _curlStrand3D_perStrand(pts, curl, waveNorm, curlDir);

  // 이 가닥이 쓸 스파인 길이(컬로 줄어든 만큼)
  const spineLen = arc * (f.pitch / f.turnLen);
  const totalAngle = arc / f.turnLen;
  const turns = totalAngle / (2 * Math.PI);
  const N = Math.max(CURL_BUNDLE.minSamples, Math.min(CURL_BUNDLE.maxSamples, Math.ceil(turns * 14) + 2));

  // 가닥 자신의 호길이 테이블
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + _v3len(_v3sub(pts[i], pts[i - 1])));

  // 번들 안 미세 변주 (0이면 완전히 같은 판)
  const hs = _cbHash(Math.round(root.x * 9973), Math.round(root.y * 9973), Math.round(root.z * 9973));
  const rMul = 1 + (hs - 0.5) * 2 * CURL_BUNDLE.microAmp;
  const pAdd = (hs - 0.5) * 2 * CURL_BUNDLE.microPhase;

  const out = [pts[0]];
  for (let k = 1; k <= N; k++) {
    const s = spineLen * (k / N);
    const p = _pointAtArc(pts, cum, s);
    const th = f.phase + pAdd + s / f.pitch;
    const rad = f.R * rMul * Math.min(1, s / f.rampLen);
    const c = Math.cos(th) * rad, d = Math.sin(th) * rad;
    out.push({
      x: p.x + f.u.x * c + f.v.x * d,
      y: p.y + f.u.y * c + f.v.y * d,
      z: p.z + f.u.z * c + f.v.z * d,
    });
  }
  return out;
};

function curlBundleHarness() {
  const n = state && state.hair3Dneutral && state.hair3Dneutral.strands;
  console.log('[펌·번들] ' + (CURL_BUNDLE.on ? 'ON' : 'OFF')
    + ' · 번들 ' + _curlBundleStats.bundles + '개 / 가닥 ' + _curlBundleStats.strands + '개'
    + ' · 번들당 평균 ' + (_curlBundleStats.bundles ? (_curlBundleStats.strands / _curlBundleStats.bundles).toFixed(1) : 0) + '가닥'
    + '\n  번들당 1~2가닥이면 로드가 너무 작은 것입니다 — 웨이브 폭(로드 사이즈)을 올리거나 CURL_BUNDLE.rodK를 키우십시오.'
    + '\n  끄고 비교: CURL_BUNDLE.on=false 후 슬라이더를 살짝 움직이면 다시 그립니다.'
    + (n ? '' : '\n  (중립 모델 없음 — 조정 화면까지 진행한 뒤 부르십시오.)'));
  return _curlBundleStats;
}
