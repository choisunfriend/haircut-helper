/* 마네킹 뿌리 촘촘하게(17a MQ_DENSE · mannequinPlantPlan) 하네스 — 2026-09-30. 실행: node test/mannequin-dense.test.js
   녹화(Roots 보기 08:51)에서 본 두 가지를 합성 격자로 재현한다:
     ① 이마 가운데 헤어라인 사각 홈 — 두피 끝선(SCALP_LIMIT) 앞 0.95 · 관자 1.05 차이로 생기는 "두피 밖" 한 줄
        + 가르마 선이 밀도를 baldDen 아래로 떨어뜨린 칸
     ② 앞 띠 성김 — 가르마·광택으로 앞 띠 칸 일부가 밀도 0.03
   그리고 <b>메우면 안 되는 곳</b>: 귀(옆 φ1.4~1.6) · 이마 아래 얼굴(앞 φ>1.1) · 넓은 진짜 빈 자리 */
const { loadApp, evalIn } = require('./harness.js');
const origLog = console.log; console.log = ()=>{};             // 앱 로드 로그 숨김
const app = loadApp();
console.log = origLog;
let pass = 0, fail = 0;
const t = (n, c, extra) => { c ? (pass++, console.log('  ok   ' + n)) : (fail++, console.log('  FAIL ' + n + (extra ? '  — ' + extra : ''))); };
const E = s => evalIn(app.ctx, s);

const NT = E('HAIR_OCC3D.NT'), NP = E('HAIR_OCC3D.NP'), OFF = E('EST_OFFSCALP'), BALD = E('MANNEQUIN.baldDen');
const scalpPhiMax = th => E('scalpPhiMax(' + th + ')');
const phiOf = pi => (pi + 0.5) / NP * Math.PI;
const thOf = ti => (ti + 0.5) / NT * 2 * Math.PI - Math.PI;
const deg = r => Math.abs(r * 180 / Math.PI);
const N = NT * NP;

function makeGrid(){
  const den = new Float32Array(N), est = new Uint8Array(N);
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for(let pi=0; pi<NP; pi++) for(let ti=0; ti<NT; ti++){
    const ci = pi*NT + ti, ph = phiOf(pi), th = thOf(ti);
    if(ph > scalpPhiMax(th)){ est[ci] = OFF; den[ci] = 0; continue; }
    den[ci] = 0.6;
    if(deg(th) <= 12 && pi >= 7) den[ci] = 0.02;                               // ① 가르마 선 사각 홈
    if(deg(th) <= 56 && ph <= 1.05 && ph >= 0.4 && rnd() < 0.25) den[ci] = 0.03; // ② 앞 띠 광택 성김
    if(deg(th) >= 80 && deg(th) <= 100 && ph >= 1.4 && ph <= 1.6) den[ci] = 0;  // 귀
    if(deg(th) >= 140 && ph >= 1.2 && ph <= 2.0) den[ci] = 0;                  // 뒤통수 아래 넓은 진짜 빈 자리(목 쪽)
  }
  return { NT, NP, den, est };
}
const rf = makeGrid();
app.ctx.__rf = rf;
const plan = E('mannequinPlantPlan(__rf, null, MANNEQUIN.baldDen)');
const planted = ci => plan.w[ci] > 0;

console.log('── 빈 데 없이 ──');
// ① 사각 홈: 가운데 |θ|≤12°, 두피 안 7행 이상
let notch = 0, notchOk = 0;
for(let pi=7; pi<NP; pi++) for(let ti=0; ti<NT; ti++){
  const ci = pi*NT + ti; if(deg(thOf(ti)) > 12 || rf.est[ci] === OFF) continue;
  notch++; if(planted(ci)) notchOk++;
}
t('가르마 선 사각 홈(밀도 0.02) 전부 메움', notch > 0 && notchOk === notch, notchOk + '/' + notch);
// ① 이마 가운데 "두피 밖" 한 줄(φ ≤ 1.1, 앞 |θ|≤34°) — 양옆 관자는 머리가 그 줄까지 있다
let offRow = 0, offRowOk = 0;
for(let pi=0; pi<NP; pi++) for(let ti=0; ti<NT; ti++){
  const ci = pi*NT + ti; if(rf.est[ci] !== OFF || deg(thOf(ti)) > 34 || phiOf(pi) > 1.1) continue;
  offRow++; if(planted(ci)) offRowOk++;
}
t('이마 가운데 두피 밖 판정 한 줄(φ≤1.1) 메움 — 헤어라인이 관자와 같은 높이', offRow > 0 && offRowOk === offRow, offRowOk + '/' + offRow);
// ② 앞 띠 광택 칸
let spec = 0, specOk = 0;
for(let ci=0; ci<N; ci++){ if(Math.abs(rf.den[ci] - 0.03) < 1e-6){ spec++; if(planted(ci)) specOk++; } }
t('앞 띠 광택으로 성긴 칸 전부 메움', spec > 0 && specOk === spec, specOk + '/' + spec);

console.log('── 메우면 안 되는 곳 ──');
let face = 0;
for(let pi=0; pi<NP; pi++) for(let ti=0; ti<NT; ti++){
  const ci = pi*NT + ti; if(deg(thOf(ti)) <= 56 && phiOf(pi) > 1.1 && rf.est[ci] === OFF && planted(ci)) face++;
}
t('이마 아래 얼굴(앞 φ>1.1 두피 밖)은 안 심음', face === 0, face + '칸');
let ear = 0, earN = 0;
for(let pi=0; pi<NP; pi++) for(let ti=0; ti<NT; ti++){
  const ci = pi*NT + ti; const d = deg(thOf(ti)), ph = phiOf(pi);
  if(d >= 80 && d <= 100 && ph >= 1.4 && ph <= 1.6 && rf.est[ci] !== OFF){ earN++; if(planted(ci)) ear++; }
}
t('귀 자리는 안 심음', earN > 0 && ear === 0, ear + '/' + earN);
let back = 0, backN = 0;
for(let pi=0; pi<NP; pi++) for(let ti=0; ti<NT; ti++){
  const ci = pi*NT + ti; const d = deg(thOf(ti)), ph = phiOf(pi);
  if(d >= 150 && ph >= 1.35 && ph <= 1.9 && rf.est[ci] !== OFF){ backN++; if(planted(ci)) back++; }
}
t('넓은 진짜 빈 자리(뒤 아래 7행)는 안 메움', backN > 0 && back === 0, back + '/' + backN);
let offOther = 0;
for(let ci=0; ci<N; ci++){ const ti = ci % NT; if(rf.est[ci] === OFF && deg(thOf(ti)) > 56 && planted(ci)) offOther++; }
t('앞 구역 밖의 두피 밖 칸은 하나도 안 심음', offOther === 0, offOther + '칸');

console.log('── 촘촘하게 · 앞이 더 ──');
const wAt = (pi, ti) => plan.w[pi*NT + ti];
const tiAt = d => Math.round((d * Math.PI / 180 + Math.PI) / (2 * Math.PI) * NT - 0.5);
const rowAt = ph => Math.round(ph / Math.PI * NP - 0.5);
const frontW = wAt(rowAt(0.8), tiAt(20)), backW = wAt(rowAt(1.0), tiAt(170));
t('앞(가르마) 칸 몫 = 뒤 칸 × frontBoost (면적 같을 때)', Math.abs(frontW / backW - E('MQ_DENSE.frontBoost')) < 1e-9, (frontW / backW).toFixed(3));
const sparse = wAt(rowAt(0.8), tiAt(0)), full = wAt(rowAt(0.8), tiAt(28));
t('밀도가 낮게 잡힌 칸도 같은 구역이면 같은 몫(사진 밀도 비례 아님)', Math.abs(sparse - full) < 1e-9, sparse + ' vs ' + full);
t('countMul ≥ 1.5 (총량이 예전보다 많다)', E('MQ_DENSE.countMul') >= 1.5);
t('앞쪽 보강 ROOT_EVEN은 기본 꺼짐(중복 방지)', E('ROOT_EVEN.on') === false);

console.log('── 예전 규칙 비교(참고) ──');
let oldPlanted = 0, newPlanted = 0;
for(let ci=0; ci<N; ci++){ if(rf.est[ci] !== OFF && rf.den[ci] > BALD) oldPlanted++; if(planted(ci)) newPlanted++; }
console.log('  심는 칸: 예전 ' + oldPlanted + ' → 지금 ' + newPlanted + '  (메움 ' + plan.fill + ' · 그중 두피밖 ' + plan.fillOff + ')');

console.log('\n' + pass + ' 통과 / ' + (pass + fail) + (fail ? '  ·  실패 ' + fail : ''));
process.exit(fail ? 1 : 0);
