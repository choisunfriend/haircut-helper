// Today's StylePeek core — curl bundle winding (port of 14c-curl-bundle.js windStrand/bundleFrame/scalpCell)
// All geometry math lives here; JS only marshals points and parameters.

const MAXP: i32 = 4096;
const inBuf = new StaticArray<f64>(MAXP * 3);
const outBuf = new StaticArray<f64>(MAXP * 3 + 1300 * 3);
const S = new StaticArray<f64>(MAXP);

export function inPtr(): usize { return changetype<usize>(inBuf); }
export function outPtr(): usize { return changetype<usize>(outBuf); }
export function maxPoints(): i32 { return MAXP; }

// frame cache: key = (i, j, paramId)
class Frame { ux: f64; uy: f64; uz: f64; vx: f64; vy: f64; vz: f64; phase: f64; rx: f64; ry: f64; rz: f64; }
let cache = new Map<u64, Frame>();
export function clearCache(): void { cache.clear(); }
export function cacheSize(): i32 { return cache.size; }
function key(i: i32, j: i32, pid: i32): u64 {
  // i, j within ±2^20, pid < 2^22 → collision-free packing
  return ((<u64>(i + 1048576) & 0x1FFFFF) << 43) | ((<u64>(j + 1048576) & 0x1FFFFF) << 22) | (<u64>pid & 0x3FFFFF);
}

function hash3(a: i32, b: i32, c: i32): f64 {
  let h: u32 = <u32>((a * 73856093) ^ (b * 19349663) ^ (c * 83492791));
  h ^= h >>> 13;
  h = h * 1274126177;
  h ^= h >>> 16;
  // JS original: the final `h ^= h >>> 16` yields a SIGNED int32 → result in [-0.5, 1). Kept identical on purpose.
  return <f64>(<i32>h) / 4294967296.0;
}
@inline function clamp(v: f64, lo: f64, hi: f64): f64 { return v < lo ? lo : (v > hi ? hi : v); }
@inline function hyp3(x: f64, y: f64, z: f64): f64 { return Math.sqrt(x * x + y * y + z * z); }

// point at arc length s → writes to (px,py,pz)
let px: f64 = 0, py: f64 = 0, pz: f64 = 0;
function pointAt(n: i32, s: f64): void {
  const total = unchecked(S[n - 1]);
  if (s <= 0) s = 0; else if (s >= total) s = total;
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (unchecked(S[mid]) <= s) lo = mid; else hi = mid; }
  const seg = unchecked(S[hi]) - unchecked(S[lo]);
  const t = seg > 1e-12 ? (s - unchecked(S[lo])) / seg : 0.0;
  const a = lo * 3, b = hi * 3;
  px = unchecked(inBuf[a]) + (unchecked(inBuf[b]) - unchecked(inBuf[a])) * t;
  py = unchecked(inBuf[a + 1]) + (unchecked(inBuf[b + 1]) - unchecked(inBuf[a + 1])) * t;
  pz = unchecked(inBuf[a + 2]) + (unchecked(inBuf[b + 2]) - unchecked(inBuf[a + 2])) * t;
}

// status: >0 = number of output points; 0 = "unchanged" (return original pts); -1 = fail (fallback)
export function wind(
  n: i32, pid: i32,
  // coil params
  cpu: f64, R: f64, pitch: f64, turnLen: f64, rod: f64,
  windCm: f64, rootLeaveCm: f64, microAmp: f64, microPhase: f64, phaseJitter: f64,
  curlDir: f64,
  // globals
  rodK: f64, phaseStep: f64, minWindCm: f64, minSamples: i32, maxSamples: i32, rampCm: f64,
  clumpPull: f64, clumpRampCm: f64,
  // head
  Ea: f64, Eb: f64, Ec: f64, cy: f64, hasHead: i32
): i32 {
  if (n < 3 || n > MAXP) return -1;
  unchecked(S[0] = 0);
  for (let i = 1; i < n; i++) {
    const a = (i - 1) * 3, b = i * 3;
    unchecked(S[i] = S[i - 1] + hyp3(inBuf[b] - inBuf[a], inBuf[b + 1] - inBuf[a + 1], inBuf[b + 2] - inBuf[a + 2]));
  }
  const total = unchecked(S[n - 1]);
  if (!(total > 1e-5)) return 0;
  const perCm = 1.0 / cpu;
  const windLen = Math.min(Math.max(0, total - rootLeaveCm * perCm), windCm * perCm);
  if (windLen < minWindCm * perCm) return 0;
  const sWind = total - windLen;

  // ── scalp cell ──
  if (!hasHead || !(Ea > 0) || !(Eb > 0) || !(Ec > 0) || !isFinite(cy)) return -1;
  const rx0 = unchecked(inBuf[0]), ry0 = unchecked(inBuf[1]), rz0 = unchecked(inBuf[2]);
  const x = rx0, y = ry0 - cy, z = rz0;
  const r = hyp3(x, y, z);
  if (!(r > 1e-9)) return -1;
  const Rm = (Ea + Eb + Ec) / 3;
  const cell = rod * rodK;
  if (!(cell > 1e-5)) return -1;
  const theta = Math.acos(clamp(y / r, -1, 1));
  const phi = Math.atan2(x, z);
  const sinT = Math.max(0.25, Math.sin(theta));
  const fi = Math.floor(phi * Rm * sinT / cell), fj = Math.floor(theta * Rm / cell);
  if (!isFinite(fi) || !isFinite(fj)) return -1;
  const ci = <i32>fi, cj = <i32>fj;
  const thC = (<f64>cj + 0.5) * cell / Rm;
  const sinC = Math.max(0.25, Math.sin(thC));
  const phC = (<f64>ci + 0.5) * cell / (Rm * sinC);
  const refx = Math.sin(phC) * Math.sin(thC), refy = Math.cos(thC), refz = Math.cos(phC) * Math.sin(thC);

  // ── bundle frame (cached per cell+params) ──
  const k = key(ci, cj, pid);
  let fr: Frame;
  if (cache.has(k)) fr = cache.get(k);
  else {
    pointAt(n, sWind);
    const tb = (n - 1) * 3;
    let ax = inBuf[tb] - px, ay = inBuf[tb + 1] - py, az = inBuf[tb + 2] - pz;
    let al = hyp3(ax, ay, az);
    if (!(al > 1e-9)) { ax = 0; ay = -1; az = 0; al = 1; }
    ax /= al; ay /= al; az /= al;
    let ux: f64 = 0, uy: f64 = 0, uz: f64 = 0, ok = false;
    for (let c = 0; c < 3 && !ok; c++) {
      const cx = c == 0 ? refx : (c == 1 ? 0.0 : 1.0);
      const cyy = c == 0 ? refy : (c == 1 ? 1.0 : 0.0);
      const cz = c == 0 ? refz : 0.0;
      const d = cx * ax + cyy * ay + cz * az;
      const qx = cx - d * ax, qy = cyy - d * ay, qz = cz - d * az;
      const pl = hyp3(qx, qy, qz);
      if (pl > 1e-6) { ux = qx / pl; uy = qy / pl; uz = qz / pl; ok = true; }
    }
    if (!ok) return -1;
    const vx = ay * uz - az * uy, vy = az * ux - ax * uz, vz = ax * uy - ay * ux;
    const jitter = (hash3(ci, cj, 7) - 0.5) * 2 * phaseJitter;
    const phase = clamp(curlDir, -100, 100) / 100 * Math.PI + (<f64>ci + <f64>cj * 0.5) * phaseStep + jitter;
    if (!isFinite(phase)) return -1;
    fr = new Frame();
    fr.ux = ux; fr.uy = uy; fr.uz = uz; fr.vx = vx; fr.vy = vy; fr.vz = vz; fr.phase = phase;
    fr.rx = refx; fr.ry = refy; fr.rz = refz;
    cache.set(k, fr);
  }

  // ── wind ──
  const axial = windLen * (pitch / turnLen);
  const turns = windLen / turnLen / (Math.PI * 2);
  let N = <i32>Math.ceil(turns * 14) + 2;
  if (N > maxSamples) N = maxSamples;
  if (N < minSamples) N = minSamples;
  const ramp = Math.max(1e-6, rampCm * perCm);
  const hr = hash3(<i32>Math.round(rx0 * 9973), <i32>Math.round(ry0 * 9973), <i32>Math.round(rz0 * 9973));
  const ampMul = 1 + (hr - 0.5) * 2 * microAmp;
  const phMul = (hr - 0.5) * 2 * microPhase;

  let o = 0;
  for (let i = 0; i < n && unchecked(S[i]) < sWind; i++) {
    const b = i * 3;
    outBuf[o++] = inBuf[b]; outBuf[o++] = inBuf[b + 1]; outBuf[o++] = inBuf[b + 2];
  }
  let hasPull = false, plx: f64 = 0, ply: f64 = 0, plz: f64 = 0;
  const pullRamp = Math.max(1e-6, (clumpRampCm != 0 ? clumpRampCm : 3.0) * perCm);
  if (clumpPull > 0 && isFinite(cy)) {
    const rr = hyp3(rx0, ry0 - cy, rz0);
    if (rr > 0) { hasPull = true; plx = (fr.rx * rr - rx0) * clumpPull; ply = (fr.ry * rr + cy - ry0) * clumpPull; plz = (fr.rz * rr - rz0) * clumpPull; }
  }
  if (o / 3 + N + 1 > MAXP + 1300) return -1;
  for (let q = 0; q <= N; q++) {
    const a = axial * (<f64>q / <f64>N);
    pointAt(n, sWind + a);
    const ang = fr.phase + phMul + (a - axial) / pitch;
    const rad = R * ampMul * Math.min(1, a / ramp);
    const cu = Math.cos(ang) * rad, sv = Math.sin(ang) * rad;
    if (hasPull) { const w = Math.min(1, a / pullRamp); px += plx * w; py += ply * w; pz += plz * w; }
    outBuf[o++] = px + fr.ux * cu + fr.vx * sv;
    outBuf[o++] = py + fr.uy * cu + fr.vy * sv;
    outBuf[o++] = pz + fr.uz * cu + fr.vz * sv;
  }
  const cnt = o / 3;
  for (let i = 0; i < o; i++) if (!isFinite(outBuf[i])) return -1;
  return cnt >= 2 ? cnt : 0;
}
