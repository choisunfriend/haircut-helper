/* 얼굴 비우기(FACE_CLEAR) · 솟은 뒷머리(RISE_FIX) 하네스 — 2026-10-13j. 실행: node test/faceclear-rise.test.js
   17a의 두 안전망을 합성 가닥으로 확인한다(기하는 스텁: 머리 타원체·얼굴 상자를 고정).
   ① 얼굴 면에 붙어 가로로 누운 가닥(코끝 깊이보다 뒤 · 타원체 0.85 안) — 예전 판정이 놓쳤던 것 → 이제 상자 밖으로
   ② 얼굴을 가로질러 반대편까지 간 가닥 — 한 번 비킨 뒤 꼬리가 도로 상자에 남지 않음
   ③ 정수리 뿌리에서 등까지 내려갔다가 귀 높이로 되솟은 가닥(U자 · 끝 < 뿌리) → 이제 솟은 구간이 아래로
   ④ 곧게 내려가는 가닥 · 옆으로 떨어지는 가닥은 그대로 */
const { loadApp, evalIn } = require('./harness');
let pass = 0, fail = 0; const t = (n, c) => { c ? (pass++, console.log('  ok   ' + n)) : (fail++, console.log('  FAIL ' + n)); };

const { ctx } = loadApp();
const CMU = 19.33;
// 기하 스텁: 머리 타원체 a,b,c · 얼굴 상자(CY 0.15 · fh 0.6 · 반폭 0.4)
evalIn(ctx, `
  state.specAppliedId = '__original__';
  state.sections = { side: { curl: 0 }, crown: { curl: 0 }, occipital: { curl: 0 } };
  getHeadEllipsoid = function(){ return { a: 0.42, b: 0.55, c: 0.62 }; };
  eyeGuardGeom = function(){ const E = getHeadEllipsoid(), CY = 0.15, fh = 0.6;
    return { E, CY, fh, prof: { halfX: 0.4, zAt: function(){ return 0.70; } } }; };
  getNeckBottomY = function(){ return 0.15 - 1.0; };
  CURL_BUNDLE.cmPerUnit = ${CMU};
`);
const g = evalIn(ctx, 'faceClearGeom()');
const inBox = (q) => q.y < g.topY && q.y > g.botY && Math.abs(q.x) < g.xHalf;

function line(a, b, n) { const o = []; for (let i = 0; i < n; i++) { const t = i / (n - 1); o.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t }); } return o; }
function poly(ps, n) { let o = []; for (let i = 0; i + 1 < ps.length; i++) { const s = line(ps[i], ps[i + 1], n); o = o.concat(i ? s.slice(1) : s); } return o; }

// ① 왼쪽 관자 뿌리 → 눈 높이에서 얼굴 면(z 0.45: 코끝 0.70 − 0.3c(0.186) = 0.514보다 뒤 · 타원체 0.85 안)에 가로로 누움
const eyeY = 0.15;
const lying = poly([{ x: -0.38, y: 0.42, z: 0.30 }, { x: -0.18, y: eyeY + 0.03, z: 0.45 }, { x: 0.05, y: eyeY - 0.02, z: 0.45 }], 10);
// ② 오른쪽 뿌리 → 얼굴을 가로질러 왼쪽 바깥까지
const across = poly([{ x: 0.36, y: 0.42, z: 0.32 }, { x: 0.30, y: eyeY, z: 0.58 }, { x: -0.55, y: eyeY - 0.10, z: 0.50 }], 12);
// ④ 옆으로 곧게 떨어지는 가닥(얼굴 폭 밖)
const sideFall = line({ x: -0.44, y: 0.40, z: 0.20 }, { x: -0.46, y: -0.9, z: 0.10 }, 30);
const old = evalIn(ctx, '(function(){ const s = FACE_CLEAR.zMinFrac; FACE_CLEAR.zMinFrac = null; return s; })()');
const before = evalIn(ctx, 'faceClearAll')([{ pts: lying, sec: 'side' }]);
t('예전 판정은 얼굴 면에 누운 가닥을 놓친다(재현)', before[0].pts.some(q => inBox(q) && q.z > 0));
evalIn(ctx, `FACE_CLEAR.zMinFrac = ${old}`);

const out = evalIn(ctx, 'faceClearAll')([{ pts: lying, sec: 'side' }, { pts: across, sec: 'side' }, { pts: sideFall, sec: 'side' }]);
const left = (o) => o.pts.filter(q => inBox(q) && q.z > 0.25 * 0.62).length;
t('① 얼굴 면에 누운 가닥 — 상자 안 점 0', left(out[0]) === 0);
t('② 얼굴을 가로지른 가닥 — 상자 안 점 0(꼬리 다시 검사)', left(out[1]) === 0);
t('④ 얼굴 밖으로 떨어지는 가닥은 그대로', out[2].pts === sideFall);
t('뿌리는 그대로', out[0].pts[0].x === lying[0].x && out[1].pts[0].x === across[0].x);
let maxJump = 0; for (const o of out.slice(0, 2)) for (let k = 1; k < o.pts.length; k++) { const a = o.pts[k], b = o.pts[k - 1]; maxJump = Math.max(maxJump, Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)); }
let maxSrc = 0; for (const s of [lying, across]) for (let k = 1; k < s.length; k++) maxSrc = Math.max(maxSrc, Math.hypot(s[k].x - s[k - 1].x, s[k].y - s[k - 1].y, s[k].z - s[k - 1].z));
t('비킨 가닥에 크게 튄 마디 없음(원래 최대 마디의 3배 이하) — ' + (maxJump * CMU).toFixed(1) + 'cm / ' + (maxSrc * CMU).toFixed(1) + 'cm', maxJump <= 3 * maxSrc);

// ③ U자: 정수리 뒤 뿌리(y 0.55) → 등(y −0.9) → 다시 위로 귀 높이(y 0.25)까지 뒤쪽으로 곧게
const uturn = poly([{ x: 0.05, y: 0.55, z: -0.40 }, { x: 0.05, y: 0.05, z: -0.58 }, { x: 0.05, y: -0.9, z: -0.60 }, { x: 0.05, y: 0.25, z: -1.0 }], 15);
const straight = line({ x: 0.1, y: 0.55, z: -0.40 }, { x: 0.1, y: -0.9, z: -0.62 }, 40);
const wavy = []; for (let i = 0; i < 60; i++) { const s = i / 59; wavy.push({ x: -0.1 + 0.03 * Math.sin(s * 30), y: 0.55 - 1.4 * s + 0.02 * Math.sin(s * 30), z: -0.45 - 0.15 * s }); }
const r2 = evalIn(ctx, 'riseFixAll')([{ pts: uturn, sec: 'crown' }, { pts: straight, sec: 'occipital' }, { pts: wavy, sec: 'occipital' }]);
const climb = (p) => { let lo = p[0].y, m = 0; for (const q of p) { if (q.y < lo) lo = q.y; m = Math.max(m, q.y - lo); } return m; };
t('③ U자 가닥 재현 — 끝이 뿌리보다 낮음(예전 판정 통과)', uturn[uturn.length - 1].y < uturn[0].y);
t('③ U자 가닥 — 다시 솟은 높이 ' + (climb(uturn) * CMU).toFixed(0) + 'cm → ' + (climb(r2[0].pts) * CMU).toFixed(1) + 'cm', climb(r2[0].pts) * CMU < 5);
t('④ 곧게 내려가는 가닥은 그대로', r2[1].pts === straight);
t('④ 잔물결(높이 출렁 0.4cm) 가닥은 그대로', r2[2].pts === wavy);
t('통계 climb = 1', evalIn(ctx, 'RISE_FIX.stats.climb') === 1);
t('NaN 없음', r2.concat(out).every(s => s.pts.every(p => isFinite(p.x) && isFinite(p.y) && isFinite(p.z))));

console.log(`\n${pass} 통과 · ${fail} 실패`);
process.exit(fail ? 1 : 0);
