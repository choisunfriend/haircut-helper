// Today's StylePeek core — slice-consensus cut ("cut a panel of strands together")
// (port of 10-hair-render-2d.js finalizeStrandsWithSlices length rule)
@external("env", "sin") declare function jsin(x: f64): f64;
@external("env", "rnd") declare function jrnd(): f64;

const SMAX: i32 = 20000;
const F: i32 = 9;   // sec, rootX, rootNy, hemIdx, ratio, layerDelta, strandMult, texAmt, probeLen
const sin_ = new StaticArray<f64>(SMAX * F);
const sout = new StaticArray<i32>(SMAX);
const keys = new StaticArray<i64>(SMAX);
const idx = new StaticArray<i32>(SMAX);
export function sliceInPtr(): usize { return changetype<usize>(sin_); }
export function sliceOutPtr(): usize { return changetype<usize>(sout); }
export function sliceMax(): i32 { return SMAX; }

function hashFract(x: f64): f64 { const v = jsin(x) * 43758.5453; return v - Math.floor(v); }

export function sliceLens(n: i32, maskW: f64, maskH: f64, stepLen: f64, maxLen: f64): i32 {
  if (n > SMAX) return -1;
  const SW = Math.max(4, maskW * 0.03);
  for (let i = 0; i < n; i++) {
    const o = i * F;
    const a = <i64>sin_[o], bx = <i64>Math.floor(sin_[o + 1] / SW), by = <i64>Math.floor(sin_[o + 2] * 10);
    keys[i] = (a << 44) | (((bx + 1048576) & 0x3FFFFF) << 22) | ((by + 1048576) & 0x3FFFFF);
    idx[i] = i;
  }
  // sort indices by (key, hem) — insertion sort per nearly-sorted input is fine up to a few thousand; use shell sort
  let gap = n >> 1;
  while (gap > 0) {
    for (let i = gap; i < n; i++) {
      const t = idx[i]; const kt = keys[t]; const ht = sin_[t * F + 3];
      let j = i;
      while (j >= gap) {
        const p = idx[j - gap]; const kp = keys[p];
        if (kp > kt || (kp == kt && sin_[p * F + 3] > ht)) { idx[j] = p; j -= gap; } else break;
      }
      idx[j] = t;
    }
    gap >>= 1;
  }
  // median per group → stash into slot 3 of a scratch via sout (temporary hem as i32 bits not needed: store in keys-free array)
  let s = 0;
  while (s < n) {
    let e = s + 1; const k0 = keys[idx[s]];
    while (e < n && keys[idx[e]] == k0) e++;
    const med = sin_[idx[s + ((e - s) >> 1)] * F + 3];
    for (let q = s; q < e; q++) sout[idx[q]] = <i32>med;
    s = e;
  }
  // target length per strand, original order (random draws in the same order as the JS)
  for (let i = 0; i < n; i++) {
    const o = i * F;
    const hemLen = Math.max(maskH * 0.03, <f64>sout[i] * stepLen);
    const multEff = 1 + (sin_[o + 6] - 1) * 0.4;
    const jit = 0.92 + hashFract(sin_[o + 1] * 17.23 + sin_[o + 2] * 91.7) * 0.16;
    const ratio = sin_[o + 4], ld = sin_[o + 5];
    let t = ratio >= 1 ? hemLen * multEff * jit + hemLen * (ratio - 1) * 1.6 + ld : hemLen * multEff * jit * ratio + ld;
    const tex = sin_[o + 7];
    if (tex > 0) t *= 1 - jrnd() * (tex / 100) * 0.35;
    t = Math.max(maskH * 0.02, Math.min(t, maxLen));
    const np = Math.max(2, Math.min(sin_[o + 8], Math.round(t / stepLen) + 1));
    sout[i] = <i32>np;
  }
  return n;
}
