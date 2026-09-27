// Today's StylePeek core — 3D strand operators (straighten · length · droop · volume · flow ·
// part/sweep bend · sleek · curl spine · cut ratio). Port of 14-hair-3d-ops.js / 17b-cut3d-piece.js.
// Points travel as flat f64 triples in gIn → results in gOut. Trig/hypot come from JS (bit parity).
@external("env", "sin") declare function jsin(x: f64): f64;
@external("env", "cos") declare function jcos(x: f64): f64;
@external("env", "hyp3") declare function jhyp3(a: f64, b: f64, c: f64): f64;

const GMAX: i32 = 16384;
const gIn = new StaticArray<f64>(GMAX * 3);
const gOut = new StaticArray<f64>(GMAX * 3);
const gA = new StaticArray<f64>(GMAX * 3);
const gB = new StaticArray<f64>(GMAX * 3);
const gCum = new StaticArray<f64>(GMAX + 1);
const gSeg = new StaticArray<f64>(GMAX + 1);
let gKept: i32 = 0;
export function geomInPtr(): usize { return changetype<usize>(gIn); }
export function geomOutPtr(): usize { return changetype<usize>(gOut); }
export function geomMax(): i32 { return GMAX; }
export function geomKept(): i32 { return gKept; }

// @ts-ignore
@inline function fh3(a: f64, b: f64, c: f64): f64 { return Math.sqrt(a * a + b * b + c * c); }
function or1(v: f64): f64 { return v != 0 && !isNaN(v) ? v : 1; }

export function arcLen(n: i32): f64 {
  let arc = 0.0;
  for (let i = 1; i < n; i++) {
    const o = i * 3, p = o - 3;
    arc += fh3(gIn[o] - gIn[p], gIn[o + 1] - gIn[p + 1], gIn[o + 2] - gIn[p + 2]);
  }
  return arc;
}

/* ⓪ straighten — Laplacian smoothing, both ends fixed */
export function straighten(n: i32, passes: i32, lam: f64): i32 {
  let cur = gA, nxt = gB;
  for (let i = 0; i < n * 3; i++) cur[i] = gIn[i];
  const e = (n - 1) * 3;
  for (let s = 0; s < passes; s++) {
    nxt[0] = cur[0]; nxt[1] = cur[1]; nxt[2] = cur[2];
    nxt[e] = cur[e]; nxt[e + 1] = cur[e + 1]; nxt[e + 2] = cur[e + 2];
    for (let i = 1; i < n - 1; i++) {
      const o = i * 3;
      for (let k = 0; k < 3; k++) {
        const b = cur[o + k];
        nxt[o + k] = b + lam * ((cur[o - 3 + k] + cur[o + 3 + k]) / 2 - b);
      }
    }
    const t = cur; cur = nxt; nxt = t;
  }
  for (let i = 0; i < n * 3; i++) gOut[i] = cur[i];
  return n;
}

/* ① length — cut along arc (ratio<1) or extend along last tangent (ratio>1).
   gKept = leading input points reused verbatim; gOut holds ALL output points. Returns count or -1 (unchanged). */
export function lengthStrand(n: i32, ratio: f64): i32 {
  gCum[0] = 0;
  for (let i = 1; i < n; i++) {
    const o = i * 3, p = o - 3;
    gSeg[i] = fh3(gIn[o] - gIn[p], gIn[o + 1] - gIn[p + 1], gIn[o + 2] - gIn[p + 2]);
    gCum[i] = gCum[i - 1] + gSeg[i];
  }
  const total = gCum[n - 1];
  if (total < 1e-9) return -1;
  const target = total * ratio;
  for (let i = 0; i < n * 3; i++) gOut[i] = gIn[i];
  if (ratio < 1) {
    let m = 1;
    for (let i = 1; i < n; i++) {
      if (gCum[i] <= target) { m++; continue; }
      const seg = gSeg[i];
      const t = (target - gCum[i - 1]) / (seg != 0 && !isNaN(seg) ? seg : 1e-9);
      const o = i * 3, p = o - 3;
      gOut[o] = gIn[p] + (gIn[o] - gIn[p]) * t;
      gOut[o + 1] = gIn[p + 1] + (gIn[o + 1] - gIn[p + 1]) * t;
      gOut[o + 2] = gIn[p + 2] + (gIn[o + 2] - gIn[p + 2]) * t;
      gKept = m; m++;
      return m >= 2 ? m : -1;
    }
    gKept = m;
    return m >= 2 ? m : -1;
  }
  const o = (n - 1) * 3, p = o - 3;
  let dx = gIn[o] - gIn[p], dy = gIn[o + 1] - gIn[p + 1], dz = gIn[o + 2] - gIn[p + 2];
  const l0 = fh3(dx, dy, dz), l = l0 != 0 && !isNaN(l0) ? l0 : 1e-9;
  dx = dx / l; dy = dy / l; dz = dz / l;
  const step = total / <f64>(n - 1);
  let added = 0.0; const extra = target - total;
  let cx = gIn[o], cy = gIn[o + 1], cz = gIn[o + 2];
  let m = n;
  while (added < extra) {
    if (m >= GMAX) return -2;
    const d = Math.min(step, extra - added);
    cx = cx + dx * d; cy = cy + dy * d; cz = cz + dz * d;
    gOut[m * 3] = cx; gOut[m * 3 + 1] = cy; gOut[m * 3 + 2] = cz;
    m++; added += d;
  }
  gKept = n;
  return m;
}

/* ③ gravity droop after winding */
export function droop(n: i32, amt: f64, strength: f64): i32 {
  const arc = arcLen(n);
  if (arc < 1e-5) return -1;
  const nn = <f64>(n - 1);
  gOut[0] = gIn[0]; gOut[1] = gIn[1]; gOut[2] = gIn[2];
  for (let i = 1; i < n; i++) {
    const t = <f64>i / nn, o = i * 3;
    const sag = strength * arc * t * t * amt;
    gOut[o] = gIn[o]; gOut[o + 1] = gIn[o + 1] - sag; gOut[o + 2] = gIn[o + 2];
  }
  return n;
}

/* ⑥ root volume lift map */
export function volumeMap(n: i32, Lx: f64, Ly: f64, Lz: f64, fly: f64, R: f64, th: f64): i32 {
  const nn = n - 1;
  gOut[0] = gIn[0]; gOut[1] = gIn[1]; gOut[2] = gIn[2];
  for (let i = 1; i < n; i++) {
    let vw = 0.0;
    if (nn > 0) {
      const t = <f64>i / <f64>nn;
      vw = (t <= R) ? (t / R) : Math.max(0, 1 - (1 - th) * (t - R) / (1 - R));
    }
    const w = vw + (fly > 0 ? fly * (<f64>i / <f64>nn) * (<f64>i / <f64>nn) : 0);
    const o = i * 3;
    gOut[o] = gIn[o] + Lx * w; gOut[o + 1] = gIn[o + 1] + Ly * w; gOut[o + 2] = gIn[o + 2] + Lz * w;
  }
  return n;
}

/* ⑦ flow curl map */
export function flowMap(n: i32, ux: f64, uz: f64, amp: f64): i32 {
  const nn = <f64>(n - 1);
  gOut[0] = gIn[0]; gOut[1] = gIn[1]; gOut[2] = gIn[2];
  for (let i = 1; i < n; i++) {
    const t = <f64>i / nn, w = t * t, o = i * 3;
    gOut[o] = gIn[o] + ux * amp * w; gOut[o + 1] = gIn[o + 1]; gOut[o + 2] = gIn[o + 2] + uz * amp * w;
  }
  return n;
}

/* ── scalp shell / steering / rotation helpers ───────────────────── */
let Ea: f64 = 1, Eb: f64 = 1, Ec: f64 = 1;
let shNx: f64 = 0, shNy: f64 = 0, shNz: f64 = 0, shQ: f64 = 0;
function shell(px: f64, py: f64, pz: f64): void {
  const x = px, y = py - 0.15, z = pz;
  const nx = x / (Ea * Ea), ny = y / (Eb * Eb), nz = z / (Ec * Ec);
  const nl = or1(fh3(nx, ny, nz));
  shNx = nx / nl; shNy = ny / nl; shNz = nz / nl;
  shQ = fh3(x / Ea, y / Eb, z / Ec);
}
let stRotate: bool = true, stInto: f64 = 3.0;
let wX: f64 = 0, wY: f64 = 0, wZ: f64 = 0;   // steer result
// returns true if changed (result in wX..)
function steer(ux: f64, uy: f64, uz: f64, nx: f64, ny: f64, nz: f64, pull: f64,
               hasHint: bool, hx: f64, hy: f64, hz: f64): bool {
  if (!(pull > 0)) return false;
  if (!stRotate) {
    const bx = ux - nx * pull, by = uy - ny * pull, bz = uz - nz * pull;
    const bl = fh3(bx, by, bz);
    if (bl > 1e-9) { wX = bx / bl; wY = by / bl; wZ = bz / bl; return true; }
    return false;
  }
  const dn = ux * nx + uy * ny + uz * nz;
  let tx = ux - nx * dn, ty = uy - ny * dn, tz = uz - nz * dn;
  let tl = fh3(tx, ty, tz);
  if (tl < 1e-4) {
    for (let ci = 0; ci < 3; ci++) {
      let cx: f64, cy: f64, cz: f64;
      if (ci == 0) { if (!hasHint) continue; cx = hx; cy = hy; cz = hz; }
      else if (ci == 1) { cx = 0; cy = -1; cz = 0; }
      else { cx = 0; cy = 0; cz = -1; }
      const cd = cx * nx + cy * ny + cz * nz;
      tx = cx - nx * cd; ty = cy - ny * cd; tz = cz - nz * cd;
      tl = fh3(tx, ty, tz);
      if (tl > 1e-4) break;
    }
    if (tl < 1e-4) return false;
  }
  tx /= tl; ty /= tl; tz /= tl;
  const p = Math.min(1, pull);
  if (stInto > 0) {
    const lam = p * stInto;
    tx -= nx * lam; ty -= ny * lam; tz -= nz * lam;
    const gl = or1(fh3(tx, ty, tz)); tx /= gl; ty /= gl; tz /= gl;
  }
  const wx = ux * (1 - p) + tx * p, wy = uy * (1 - p) + ty * p, wz = uz * (1 - p) + tz * p;
  const wl = fh3(wx, wy, wz);
  if (wl > 1e-9) { wX = wx / wl; wY = wy / wl; wZ = wz / wl; return true; }
  return false;
}
// carried rotation matrix M (row-major 9) and a scratch R
const Mm = new StaticArray<f64>(9);
const Rm = new StaticArray<f64>(9);
const Tm = new StaticArray<f64>(9);
let hasM: bool = false;
function rotate(ux: f64, uy: f64, uz: f64, wx: f64, wy: f64, wz: f64): bool {
  const c = ux * wx + uy * wy + uz * wz;
  let x = uy * wz - uz * wy, y = uz * wx - ux * wz, z = ux * wy - uy * wx;
  const s = Math.sqrt(x * x + y * y + z * z);
  if (s < 1e-9) return false;
  x /= s; y /= s; z /= s;
  const t = 1 - c;
  Rm[0] = 1 + t * (x * x - 1); Rm[1] = -s * z + t * x * y;     Rm[2] = s * y + t * x * z;
  Rm[3] = s * z + t * x * y;    Rm[4] = 1 + t * (y * y - 1);   Rm[5] = -s * x + t * y * z;
  Rm[6] = -s * y + t * x * z;   Rm[7] = s * x + t * y * z;     Rm[8] = 1 + t * (z * z - 1);
  return true;
}
function accumulate(): void {   // M = R·M  (or M = R)
  if (!hasM) { for (let i = 0; i < 9; i++) Mm[i] = Rm[i]; hasM = true; return; }
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++)
    Tm[r * 3 + c] = Rm[r * 3] * Mm[c] + Rm[r * 3 + 1] * Mm[3 + c] + Rm[r * 3 + 2] * Mm[6 + c];
  for (let i = 0; i < 9; i++) Mm[i] = Tm[i];
}
let aX: f64 = 0, aY: f64 = 0, aZ: f64 = 0;
function applyM(x: f64, y: f64, z: f64): void {
  aX = Mm[0] * x + Mm[1] * y + Mm[2] * z;
  aY = Mm[3] * x + Mm[4] * y + Mm[5] * z;
  aZ = Mm[6] * x + Mm[7] * y + Mm[8] * z;
}

export function setShape(a: f64, b: f64, c: f64, rotateOn: i32, into: f64): void {
  Ea = a; Eb = b; Ec = c; stRotate = rotateOn != 0; stInto = into;
}

/* ④⑤ part / sweep — bend each segment toward the scalp-tangent of direction d */
export function bend(n: i32, dx: f64, dy: f64, dz: f64, frac: f64, ramp: f64, tail: f64,
                     hugOn: i32, hugK: f64, Hlift: f64, Hband: f64, Hstr: f64, carry: i32): i32 {
  const nn = n - 1;
  let cx = gIn[0], cy = gIn[1], cz = gIn[2];
  gOut[0] = cx; gOut[1] = cy; gOut[2] = cz;
  let qRoot = 0.0;
  if (hugOn) { shell(cx, cy, cz); qRoot = shQ; }
  const qWant = qRoot + (hugOn ? Hlift : 0);
  hasM = false;
  for (let i = 1; i < n; i++) {
    const o = i * 3, p = o - 3;
    let vx = gIn[o] - gIn[p], vy = gIn[o + 1] - gIn[p + 1], vz = gIn[o + 2] - gIn[p + 2];
    const L = fh3(vx, vy, vz);
    if (L > 1e-9) {
      let ux = vx / L, uy = vy / L, uz = vz / L;
      if (carry && hasM) {
        applyM(ux, uy, uz);
        const ul = or1(fh3(aX, aY, aZ));
        ux = aX / ul; uy = aY / ul; uz = aZ / ul;
      }
      // dirAt(current point)
      shell(cx, cy, cz);
      const dot = dx * shNx + dy * shNy + dz * shNz;
      const tx = dx - dot * shNx, ty = dy - dot * shNy, tz = dz - dot * shNz;
      const tl = fh3(tx, ty, tz);
      let hasD = false, ddx = 0.0, ddy = 0.0, ddz = 0.0;
      if (!(tl < 1e-5)) { hasD = true; ddx = tx / tl * frac; ddy = ty / tl * frac; ddz = tz / tl * frac; }
      const dl = hasD ? fh3(ddx, ddy, ddz) : 0;
      let k = 0.0, hasG = false, gx = 0.0, gy = 0.0, gz = 0.0;
      let wx = ux, wy = uy, wz = uz;
      if (dl > 1e-9) {
        hasG = true; gx = ddx / dl; gy = ddy / dl; gz = ddz / dl;
        let cw = 0.0;
        if (!(i <= 0 || nn <= 0)) { const t = <f64>i / <f64>nn; cw = Math.min(1, t / ramp) + Math.max(0, t - ramp) * tail; }
        k = Math.min(1, cw * dl);
        if (k > 0) {
          let bx = ux * (1 - k) + gx * k, by = uy * (1 - k) + gy * k, bz = uz * (1 - k) + gz * k;
          let bl = fh3(bx, by, bz);
          if (bl < 1e-6) { bx = gx; by = gy; bz = gz; bl = 1; }
          wx = bx / bl; wy = by / bl; wz = bz / bl;
        }
      }
      const cbx = wx, cby = wy, cbz = wz;
      if (hugOn && hugK > 0 && k > 0) {
        shell(cx, cy, cz);
        const over = shQ - qWant;
        if (over > 0 && steer(wx, wy, wz, shNx, shNy, shNz, Math.min(1, over / Hband) * Hstr * hugK * k, hasG, gx, gy, gz)) {
          wx = wX; wy = wY; wz = wZ;
        }
      }
      if (carry) {
        if (rotate(cbx, cby, cbz, wx, wy, wz)) accumulate();
        if (hugOn) {
          shell(cx + wx * L, cy + wy * L, cz + wz * L);
          if (shQ < qRoot) {
            shell(cx, cy, cz);
            const dn = wx * shNx + wy * shNy + wz * shNz;
            if (dn < 0) {
              const qx = wx - shNx * dn, qy = wy - shNy * dn, qz = wz - shNz * dn;
              const ql = fh3(qx, qy, qz);
              if (ql > 1e-9) {
                const nx = qx / ql, ny = qy / ql, nz = qz / ql;
                if (rotate(wx, wy, wz, nx, ny, nz)) accumulate();
                wx = nx; wy = ny; wz = nz;
              }
            }
          }
        }
      }
      vx = wx * L; vy = wy * L; vz = wz * L;
    }
    cx += vx; cy += vy; cz += vz;
    gOut[o] = cx; gOut[o + 1] = cy; gOut[o + 2] = cz;
  }
  return n;
}

/* ⑧ sleek — lay strands onto the scalp shell */
export function sleek(n: i32, s: f64, lift: f64, band: f64, strength: f64, ramp: f64, carry: i32): i32 {
  let cx = gIn[0], cy = gIn[1], cz = gIn[2];
  gOut[0] = cx; gOut[1] = cy; gOut[2] = cz;
  shell(cx, cy, cz);
  const qRoot = shQ, qWant = qRoot + lift, qFloor = qRoot;
  const nn = <f64>(n - 1);
  hasM = false;
  for (let i = 1; i < n; i++) {
    const o = i * 3, p = o - 3;
    let vx = gIn[o] - gIn[p], vy = gIn[o + 1] - gIn[p + 1], vz = gIn[o + 2] - gIn[p + 2];
    const L = fh3(vx, vy, vz);
    if (L > 1e-9) {
      let ux = vx / L, uy = vy / L, uz = vz / L;
      if (carry && hasM) {
        applyM(ux, uy, uz);
        const ul = or1(fh3(aX, aY, aZ));
        ux = aX / ul; uy = aY / ul; uz = aZ / ul;
      }
      let wx = ux, wy = uy, wz = uz;
      const t = <f64>i / nn;
      const ww = t <= ramp ? 0 : (t - ramp) / (1 - ramp);
      if (ww > 0) {
        shell(cx, cy, cz);
        const over = shQ - qWant;
        if (over > 0) {
          const pull = Math.min(1, over / band) * strength * s * ww;
          if (steer(ux, uy, uz, shNx, shNy, shNz, pull, false, 0, 0, 0)) {
            if (carry) { if (rotate(ux, uy, uz, wX, wY, wZ)) accumulate(); }
            wx = wX; wy = wY; wz = wZ;
          }
        }
      }
      if (carry) {
        shell(cx + wx * L, cy + wy * L, cz + wz * L);
        if (shQ < qFloor) {
          shell(cx, cy, cz);
          const dn = wx * shNx + wy * shNy + wz * shNz;
          if (dn < 0) {
            const qx = wx - shNx * dn, qy = wy - shNy * dn, qz = wz - shNz * dn;
            const ql = fh3(qx, qy, qz);
            if (ql > 1e-9) {
              const nx = qx / ql, ny = qy / ql, nz = qz / ql;
              if (rotate(wx, wy, wz, nx, ny, nz)) accumulate();
              wx = nx; wy = ny; wz = nz;
            }
          }
        }
      }
      vx = wx * L; vy = wy * L; vz = wz * L;
    }
    cx += vx; cy += vy; cz += vz;
    gOut[o] = cx; gOut[o + 1] = cy; gOut[o + 2] = cz;
  }
  return n;
}

/* ② curl — rod helix wound along the strand's own spine (parallel-transport frame) */
const spX = new StaticArray<f64>(GMAX), spY = new StaticArray<f64>(GMAX), spZ = new StaticArray<f64>(GMAX);
export function curlSpine(n: i32, R: f64, A: f64, tight: f64, curlDir: f64): i32 {
  // arc + cum
  gCum[0] = 0;
  for (let i = 1; i < n; i++) {
    const o = i * 3, p = o - 3;
    gCum[i] = gCum[i - 1] + fh3(gIn[o] - gIn[p], gIn[o + 1] - gIn[p + 1], gIn[o + 2] - gIn[p + 2]);
  }
  const arc = gCum[n - 1];
  if (arc < 1e-5) return -1;
  const b = R * (2.6 - 2.28 * tight);
  const pr = Math.sqrt(A * A + b * b), perRad = pr != 0 && !isNaN(pr) ? pr : 1e-4;
  const thetaMax = arc / perRad;
  const axisLen = b * thetaMax;
  const turns = thetaMax / (2 * Math.PI);
  const M = <i32>Math.max(<f64>n, Math.min(400, Math.ceil(turns * 12) + 2));
  if (M + 1 > GMAX) return -2;
  const tot = gCum[n - 1];
  for (let i = 0; i <= M; i++) {
    const s = axisLen * (<f64>i / <f64>M);
    if (s <= 0) { spX[i] = gIn[0]; spY[i] = gIn[1]; spZ[i] = gIn[2]; continue; }
    if (s >= tot) { const e = (n - 1) * 3; spX[i] = gIn[e]; spY[i] = gIn[e + 1]; spZ[i] = gIn[e + 2]; continue; }
    let lo = 0, hi = n - 1;
    while (lo + 1 < hi) { const mid = (lo + hi) >> 1; if (gCum[mid] <= s) lo = mid; else hi = mid; }
    const seg = gCum[hi] - gCum[lo];
    const t = seg > 1e-12 ? (s - gCum[lo]) / seg : 0;
    const l3 = lo * 3, h3 = hi * 3;
    spX[i] = gIn[l3] + (gIn[h3] - gIn[l3]) * t;
    spY[i] = gIn[l3 + 1] + (gIn[h3 + 1] - gIn[l3 + 1]) * t;
    spZ[i] = gIn[l3 + 2] + (gIn[h3 + 2] - gIn[l3 + 2]) * t;
  }
  // T = norm(spine1 - spine0)
  let Tx = spX[1] - spX[0], Ty = spY[1] - spY[0], Tz = spZ[1] - spZ[0];
  { const l = or1e9(fh3(Tx, Ty, Tz)); Tx /= l; Ty /= l; Tz /= l; }
  const rx0 = gIn[0], rz0 = gIn[2];
  const rl = Math.sqrt(rx0 * rx0 + rz0 * rz0);
  let refx = 1.0, refy = 0.0, refz = 0.0;
  if (rl > 1e-4) { refx = rx0 / rl; refz = rz0 / rl; }
  let ux = 0.0, uy = 0.0, uz = 0.0;
  if (strip(refx, refy, refz, Tx, Ty, Tz)) { ux = sX; uy = sY; uz = sZ; }
  else if (strip(0, 1, 0, Tx, Ty, Tz)) { ux = sX; uy = sY; uz = sZ; }
  else if (strip(1, 0, 0, Tx, Ty, Tz)) { ux = sX; uy = sY; uz = sZ; }
  else { ux = NaN; uy = NaN; uz = NaN; }   // JS: u = null → throws later; caller falls back
  const phase0 = (Math.max(-100, Math.min(100, curlDir)) / 100) * Math.PI;
  gOut[0] = gIn[0]; gOut[1] = gIn[1]; gOut[2] = gIn[2];
  for (let i = 1; i <= M; i++) {
    const qx = spX[i] - spX[i - 1], qy = spY[i] - spY[i - 1], qz = spZ[i] - spZ[i - 1];
    const ql = fh3(qx, qy, qz), qn = or1e9(ql);
    const Tpx = qx / qn, Tpy = qy / qn, Tpz = qz / qn;
    if (ql > 1e-9) {
      if (strip(ux, uy, uz, Tpx, Tpy, Tpz)) { ux = sX; uy = sY; uz = sZ; }
      Tx = Tpx; Ty = Tpy; Tz = Tpz;
    }
    let vx = Ty * uz - Tz * uy, vy = Tz * ux - Tx * uz, vz = Tx * uy - Ty * ux;
    { const l = or1e9(fh3(vx, vy, vz)); vx /= l; vy /= l; vz /= l; }
    const theta = phase0 + thetaMax * (<f64>i / <f64>M);
    const env = Math.min(1, <f64>i / (<f64>M * 0.12 + 1e-6));
    const rad = A * env;
    const cr = jcos(theta) * rad, sr = jsin(theta) * rad;
    const o = i * 3;
    gOut[o] = spX[i] + (ux * cr + vx * sr);
    gOut[o + 1] = spY[i] + (uy * cr + vy * sr);
    gOut[o + 2] = spZ[i] + (uz * cr + vz * sr);
  }
  return M + 1;
}
function or1e9(v: f64): f64 { return v != 0 && !isNaN(v) ? v : 1e-9; }
let sX: f64 = 0, sY: f64 = 0, sZ: f64 = 0;
function strip(rx: f64, ry: f64, rz: f64, tx: f64, ty: f64, tz: f64): bool {
  const d = rx * tx + ry * ty + rz * tz;
  const qx = rx - d * tx, qy = ry - d * ty, qz = rz - d * tz;
  const l = fh3(qx, qy, qz);
  if (l < 1e-6) return false;
  const nl = or1e9(l);
  sX = qx / nl; sY = qy / nl; sZ = qz / nl;
  return true;
}

/* 17b — arc position where the strand first crosses y=targetY going down */
export function arcAtY(n: i32, targetY: f64): f64 {
  let acc = 0.0;
  for (let i = 1; i < n; i++) {
    const o = i * 3, p = o - 3;
    const ay = gIn[p + 1], cy = gIn[o + 1];
    const seg = jhyp3(gIn[o] - gIn[p], cy - ay, gIn[o + 2] - gIn[p + 2]);
    if (cy <= targetY && ay > targetY) {
      const t = (ay - targetY) / Math.max(1e-9, ay - cy);
      return acc + seg * t;
    }
    acc += seg;
  }
  return acc;
}
export function yAtArc(n: i32, L: f64): f64 {
  let acc = 0.0;
  for (let i = 1; i < n; i++) {
    const o = i * 3, p = o - 3;
    const ay = gIn[p + 1], cy = gIn[o + 1];
    const seg = jhyp3(gIn[o] - gIn[p], cy - ay, gIn[o + 2] - gIn[p + 2]);
    if (acc + seg >= L) {
      const t = (L - acc) / Math.max(1e-9, seg);
      return ay + (cy - ay) * t;
    }
    acc += seg;
  }
  const e = (n - 1) * 3, p = e - 3;
  const seg = jhyp3(gIn[e] - gIn[p], gIn[e + 1] - gIn[p + 1], gIn[e + 2] - gIn[p + 2]);
  if (!(seg > 1e-9)) return gIn[e + 1];
  return gIn[e + 1] + ((gIn[e + 1] - gIn[p + 1]) / seg) * (L - acc);
}

/* 17b — per-strand cut ratio. Scalars that depend on wrapped/global JS (section ratios, fade line, cm/unit)
   are resolved by the caller; everything strand-geometric happens here. */
const cp = new StaticArray<f64>(40);
export function cutParamsPtr(): usize { return changetype<usize>(cp); }
export function cutRatio(n: i32): f64 {
  // cp: 0 total,1 want,2 fallback,3 elevT,4 Yref,5 Lref,6 tipCut,7 slope,8 yHi,9 yLo,10 odMul(<0 none),11 odWant,
  //     12 lineT(NaN none),13 xLo,14 xHi,15 lineMax,16 tex,17 texMax,18 fadeOn,19 cm,20 guardLen,21 discOn,22 yLine,
  //     23 discBand,24 fadeH,25 fadeBW,26 taper,27 skinLen,28 minRatio,29 maxRatio
  const total = cp[0];
  let want = cp[1];
  const elevT = cp[4 - 1];
  const Yref = cp[4], Lref = cp[5];
  const rx = gIn[0], ry = gIn[1], rz = gIn[2];
  let Ltip = arcAtY(n, Yref);
  if (cp[6] != 0 && Ltip >= total - 1e-9 && ry <= Yref) Ltip = 0;
  let L = Ltip + (Lref - Ltip) * elevT;
  const slope = cp[7], yHi = cp[8], yLo = cp[9];
  if (slope != 0 && yHi > yLo) {
    const u = Math.max(0, Math.min(1, (yHi - ry) / (yHi - yLo)));
    L *= 1 + slope * (u - 0.5);
  }
  if (cp[10] >= 0) { L *= cp[10]; want = cp[11]; }
  else if (!isNaN(cp[30])) L += (cp[30] - L) * cp[31];
  const lineT = cp[12], xLo = cp[13], xHi = cp[14];
  if (!isNaN(lineT)) {
    const cx = (xLo + xHi) / 2;
    const half = Math.max(1e-9, (xHi - xLo) / 2);
    const nx = Math.min(1, Math.abs(rx - cx) / half);
    L *= 1 - lineT * cp[15] * nx * nx;
  }
  const tx = cp[16];
  if (tx > 0) {
    const s = jsin(rx * 127.1 + ry * 311.7 + rz * 74.7) * 43758.5453;
    L *= 1 - tx * cp[17] * (s - Math.floor(s));
  }
  // fade
  if (cp[18] != 0 && yHi > yLo) {
    const guardLen = cp[20];
    let t = 0.0, bw = 0.0, go = true;
    if (cp[21] != 0) {
      const yLine = cp[22];
      if (isNaN(yLine) || ry >= yLine || !(yLine > yLo)) go = false;
      else { t = (ry - yLo) / (yLine - yLo); bw = cp[23]; }
    } else {
      const h = cp[24];
      if (h <= 0) go = false;
      else {
        const u = (ry - yLo) / (yHi - yLo);
        if (u >= h) go = false;
        else { t = h > 0 ? (u / h) : 1; bw = cp[25]; }
      }
    }
    if (go) {
      t = Math.max(0, Math.min(1, t));
      const tp = cp[26], skinLen = cp[27];
      const gAt = guardLen + (skinLen - guardLen) * tp * (1 - t);
      const raw = (t - (1 - bw)) / bw;
      const k = Math.max(0, Math.min(1, raw));
      const w = k * k * (3 - 2 * k);
      const fadeLen = gAt + (L - gAt) * w;
      L = Math.min(L, fadeLen);
    }
  }
  const asked = Math.max(0, want);
  const cap = Math.max(cp[29], asked);
  return Math.max(cp[28], Math.min(cap, L / total));
}
