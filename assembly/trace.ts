// Today's StylePeek core — strand path tracing along the photo's flow field
// (port of 09-strand-dye.js traceStrandPath). Trig/random/field lookups come from JS
// imports so results are bit-identical to the original engine.

@external("env", "sin") declare function jsin(x: f64): f64;
@external("env", "cos") declare function jcos(x: f64): f64;
@external("env", "atan2") declare function jatan2(y: f64, x: f64): f64;
@external("env", "rnd") declare function jrnd(): f64;
@external("env", "oriSample") declare function oriSample(x: f64, y: f64): f64;   // → coherence
@external("env", "oriAngle") declare function oriAngle(): f64;
@external("env", "oriFx") declare function oriFx(): f64;
@external("env", "oriFy") declare function oriFy(): f64;
@external("env", "oriFc") declare function oriFc(): f64;
@external("env", "pol") declare function jpol(angle: f64): i32;
@external("env", "maskAt") declare function jmask(x: f64, y: f64): i32;

const TMAX: i32 = 4096;
const tb = new StaticArray<f64>(TMAX * 2);
export function tracePtr(): usize { return changetype<usize>(tb); }
export function traceMax(): i32 { return TMAX; }

let exitOut: i32 = 0, flowOut: i32 = -1, accN: i32 = 0, accFlow: i32 = 0;
export function traceExitIdx(): i32 { return exitOut; }
export function traceFlowEndIdx(): i32 { return flowOut; }   // -1 = null
export function traceAccN(): i32 { return accN; }
export function traceAccFlow(): i32 { return accFlow; }

const PI = Math.PI;
function wrapPi(a: f64): f64 {
  while (a > PI) a -= PI * 2;
  while (a < -PI) a += PI * 2;
  return a;
}

export function trace(
  ix: f64, sy: f64, targetLen: f64, jitterSeed: f64, stepLen: f64,
  frontBias: f64, curlAmt: f64, waveT: f64,
  hasOri: i32, flowOn2D: i32, minConf: f64, maxTurn2D: f64,
  hasMask: i32, stopAtExit: i32, discThr: f64,
  dirJump: f64, dipRatio: f64, dipMin: f64, wDir: f64, wDip: f64,
  ox: f64, oy: f64
): i32 {
  accN = 0; accFlow = 0;
  const steps = <i32>Math.max(2, Math.round(targetLen / stepLen));
  let n = 1;
  tb[0] = ix; tb[1] = sy;
  let offRun = 0, exitIdx = -1;
  let cohEma: f64 = 0, hasEma = false, discScore: f64 = 0, flowEnd = -1;
  const curlStrength = curlAmt / 100;
  let baseDir = PI / 2;
  if (flowOn2D && hasOri) {
    oriSample(ix * ox, sy * oy);
    const fc = oriFc();
    if (fc >= minConf) baseDir = jatan2(oriFy(), oriFx());
  }
  for (let s = 0; s < steps; s++) {
    if (n >= TMAX) return -1;
    const cx = tb[(n - 1) * 2], cy = tb[(n - 1) * 2 + 1];
    let dir = baseDir;
    if (hasOri && s >= 2) {
      const coh = oriSample(cx * ox, cy * oy);
      if (coh > 0.05) {
        let targetDir = oriAngle();
        const pol = flowOn2D ? jpol(targetDir) : 0;
        if (pol != 0) { if (pol < 0) targetDir += PI; }
        else { const dc = wrapPi(targetDir - baseDir); if (Math.abs(dc) > PI / 2) targetDir += PI; }
        accN++; if (pol != 0) accFlow++;
        let w = Math.min(1, coh * 1.3) * (1 - curlStrength * 0.65);
        const delta = wrapPi(targetDir - baseDir);
        if (Math.abs(delta) > PI / 2) w = Math.min(w, maxTurn2D);
        dir = baseDir + delta * w;
        let dl = delta;
        if (dl > PI / 2) dl -= PI;
        if (dl < -PI / 2) dl += PI;
        if (flowEnd < 0 && exitIdx < 0 && s >= 4) {
          if (Math.abs(dl) > dirJump && coh > 0.2) discScore += wDir;
          if (hasEma && cohEma > dipMin && coh < cohEma * dipRatio) discScore += wDip;
          if (discScore >= discThr) flowEnd = n - 1;
        }
        cohEma = hasEma ? cohEma * 0.7 + coh * 0.3 : coh; hasEma = true;
      } else {
        const restore = wrapPi(PI / 2 - baseDir);
        const gravityPull = 0.15 + (<f64>s / <f64>steps) * 0.35;
        dir = baseDir + restore * gravityPull;
        if (flowEnd < 0 && exitIdx < 0 && s >= 4 && hasEma && cohEma > 0.3) {
          discScore += wDip;
          if (discScore >= discThr) flowEnd = n - 1;
        }
        if (hasEma) cohEma *= 0.7;
      }
    }
    if (exitIdx >= 0) { const r = wrapPi(PI / 2 - dir); dir += r * 0.45; }
    baseDir = dir;
    const sr = <f64>s / <f64>steps;
    const wiggleGrowth = 1 + sr * 1.8;
    const wiggle = (jsin((<f64>s + jitterSeed) * 0.9) * 0.12 + (jrnd() - 0.5) * 0.10) * wiggleGrowth;
    const WL = 3 + waveT * 15;
    const curlPhase = (<f64>s / WL) * PI * 2;
    const curlComponent = jsin(curlPhase + ix * 0.05 + jitterSeed * 0.15) * curlStrength * 0.85;
    const frontBiasDecay = 1 - sr * 0.6;
    const travel = dir + curlComponent + wiggle + frontBias * frontBiasDecay;
    const nx = cx + jcos(travel) * stepLen, ny = cy + jsin(travel) * stepLen;
    tb[n * 2] = nx; tb[n * 2 + 1] = ny; n++;
    if (hasMask && exitIdx < 0 && s >= 2) {
      if (jmask(nx, ny)) offRun = 0;
      else {
        offRun++;
        if (offRun >= 3) { exitIdx = n - 1 - offRun; if (stopAtExit) break; }
      }
    }
    if (stopAtExit && flowEnd >= 0) break;
  }
  exitOut = exitIdx >= 0 ? (exitIdx > 1 ? exitIdx : 1) : n - 1;
  flowOut = flowEnd >= 0 ? (flowEnd > 1 ? flowEnd : 1) : -1;
  return n;
}
