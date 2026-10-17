// Today's StylePeek core — hair-pixel harvesting for strand colors
// (port of 09-strand-dye.js sampleStrandColors / sampleProjectedStrandColors sampling core)

const SLOTS: i32 = 8;
const rgbs = new Array<StaticArray<u8> | null>(SLOTS);
const masks = new Array<StaticArray<u8> | null>(SLOTS);
const dims = new StaticArray<i32>(SLOTS * 4);   // maskW, maskH, hasMask, used
for (let i = 0; i < SLOTS; i++) { rgbs[i] = null; masks[i] = null; }

export function imgAlloc(slot: i32, maskW: i32, maskH: i32, hasMask: i32): void {
  const n = maskW * maskH;
  rgbs[slot] = new StaticArray<u8>(n * 3);
  masks[slot] = hasMask ? new StaticArray<u8>(n) : null;
  dims[slot * 4] = maskW; dims[slot * 4 + 1] = maskH; dims[slot * 4 + 2] = hasMask; dims[slot * 4 + 3] = 1;
}
export function imgRgbPtr(slot: i32): usize { const a = rgbs[slot]; return a ? changetype<usize>(a) : 0; }
export function imgMaskPtr(slot: i32): usize { const a = masks[slot]; return a ? changetype<usize>(a) : 0; }
export function imgFree(slot: i32): void { rgbs[slot] = null; masks[slot] = null; dims[slot * 4 + 3] = 0; }

const PMAX: i32 = 8192;
const ipts = new StaticArray<f64>(PMAX * 2);
const res = new StaticArray<f64>(64 * 4);           // per segment: flag, r, g, b
export function ptsPtr(): usize { return changetype<usize>(ipts); }
export function resPtr(): usize { return changetype<usize>(res); }
export function ptsMax(): i32 { return PMAX; }

// JS `v | 0`
function toInt32(v: f64): i32 {
  if (!isFinite(v)) return 0;
  const t = Math.trunc(v);
  if (t >= -2147483648.0 && t <= 2147483647.0) return <i32>t;
  const m = t % 4294967296.0;
  return <i32><i64>(m < 0 ? m + 4294967296.0 : m);
}

// mode 0 = 2D path (no mask gate) · mode 1 = reprojected path (hair-mask gate)
// returns number of measured segments; res holds [flag, r, g, b] × K
export function sample(slot: i32, n: i32, K: i32, imgW: f64, imgH: f64, mode: i32,
                       hasFb: i32, blend: f64, fbR: f64, fbG: f64, fbB: f64): i32 {
  if (slot < 0 || slot >= SLOTS || dims[slot * 4 + 3] == 0) return -1;
  if (n < 2 || n > PMAX || K < 2 || K > 64) return -1;
  const rgb = rgbs[slot]!;
  const w = dims[slot * 4], h = dims[slot * 4 + 1], hasMask = dims[slot * 4 + 2];
  const mk = hasMask ? masks[slot] : null;
  const sx = <f64>w / Math.max(1, imgW != 0 ? imgW : <f64>w);
  const sy = <f64>h / Math.max(1, imgH != 0 ? imgH : <f64>h);
  let hit = 0;
  for (let k = 0; k < K; k++) {
    const t = (<f64>k + 0.5) / <f64>K;
    const i = <i32>Math.min(<f64>(n - 1), Math.max(0, Math.round(t * <f64>(n - 1))));
    const x = unchecked(ipts[i * 2]), y = unchecked(ipts[i * 2 + 1]);
    const xi = toInt32(x * sx), yi = toInt32(y * sy);
    const o = k * 4;
    let ok = !(xi < 0 || yi < 0 || xi >= w || yi >= h);
    if (ok && mode == 1 && mk) ok = unchecked(mk![yi * w + xi]) == 1;
    if (!ok) { res[o] = 0; continue; }
    const j = (yi * w + xi) * 3;
    let r = <f64>unchecked(rgb[j]), g = <f64>unchecked(rgb[j + 1]), b = <f64>unchecked(rgb[j + 2]);
    if (hasFb) { r = r * blend + fbR * (1 - blend); g = g * blend + fbG * (1 - blend); b = b * blend + fbB * (1 - blend); }
    res[o] = 1; res[o + 1] = <f64>toInt32(r); res[o + 2] = <f64>toInt32(g); res[o + 3] = <f64>toInt32(b);
    hit++;
  }
  return hit;
}
