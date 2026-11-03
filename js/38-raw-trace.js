// ============================================================================
// 38-raw-trace.js (2026-11-01) — 사진 가닥을 "읽은 결 그대로" 긋기 (3D 리프트 소스 전용)
// ============================================================================
// 사용자: "사진 가닥이 곧을 리가 없잖아, 곱슬이. 결 읽기가 평균을 내면 안 돼. 있는 그대로를 가야지. 평균·중앙값 이런 거 안 된다고"
//
// 예전: 사진 가닥(중립 3D·다시 기르기·정리된 가닥 따라 걷기의 재료)은 화면용 2D 가닥 그리기(traceStrandPath · core.wasm)로 그었음.
//   그 함수는 보기 좋게 그리려고 결을 다듬음:
//     · 보폭 = 사진 높이 × 0.025(≈1.2cm) — 지름 2cm 컬은 한 바퀴에 점 4~5개라 모양이 안 나옴
//     · 관성 섞기 — 새 방향 = 직전 방향 + (읽은 결 − 직전 방향) × min(1, 또렷함×1.3) → 꺾임을 덜 꺾음
//     · 90° 넘게 꺾으면 꺾는 양을 maxTurn2D로 깎음 · 결을 못 읽으면 아래(중력)로 당김 · 매 걸음 흔들림(사인+무작위)·앞쪽 치우침을 더함
//   디버그 2214(곱슬): 사진 가닥 6cm 구간 "직선거리 ÷ 실제 길이" 중앙 0.96(거의 곧음).
// 지금(중립 캡처 rawMode 일 때만 — 화면용 2D 그리기는 그대로):
//     · 보폭 = 사진 높이 × stepFrac(0.01 ≈ 0.5cm · 지름 2cm 컬 한 바퀴에 점 12개 · 점 수는 예전의 2.5배 — 폰 메모리 때문에 더 줄이지 않음)
//     · 그 자리에서 읽은 결 방향을 그대로 씀(섞지 않음 · 꺾임 제한 없음) — 결은 앞뒤가 없는 선이라
//       두 방향 중 직전 걸음과 이어지는 쪽만 고름(평균 아님)
//     · 결을 못 읽은 자리(또렷함 minCoh 미만)는 직전 방향 그대로(중력·흔들림 없음)
//     · 뿌리 첫 방향 = 흐름(뿌리→끝) 극성이 있으면 그것, 없으면 읽은 결 중 아래쪽
//     · 머리 영역을 벗어나는 자리 표시(maskExitIdx)는 예전 규칙 그대로(3걸음 연속 밖)
// 끄기: RAW_TRACE.on = false (사진을 다시 분석하거나 3D를 다시 만들면 반영)
// (2026-11-01b) 기본 끔 — 사용자: "결이 더 헝클어졌는데… 저게 원래 결이라고?"
//   디버그 2237(직모)·2239(곱슬): 읽은 결을 그대로 따르니 결 읽기의 잘못 읽은 자리가 그대로 가닥이 됨 —
//   직모인데 약 1cm마다 60° 넘게 꺾이는 자리 9%(결 또렷함 0.6 이상인 자리에서도 8%) · 곱슬은 결을 못 읽은 자리에서 직전 방향으로 곧게 뻗은 가닥이 머리 밖으로 튀어나감.
//   예전 긋기의 다듬기(관성·큰 보폭)가 이 잡음을 가리면서 컬도 같이 지우고 있었던 것. 고칠 곳은 긋기가 아니라 결 읽기(잘못 읽은 자리를 줄이는 쪽)

// (2026-11-01c) 다시 켬 — 사용자 결정(23:04): "사진가닥긋기에서 결읽기로 만들어낸 가닥을 변형시키는 것들만 빼면 되지 · 카메라에서 가닥맞추기한 길을 따라 그려지게 · 보폭이 가닥을 넘어가버리지는 않게"
//   · 결 변형 없음: 관성·꺾임 깎기·중력 당김·흔들림·앞쪽 치우침 없음 — 그 자리 읽은 결 각도 그대로
//   · 중력은 방향 고르기에만(결 각도는 안 바꿈): 결(앞뒤 없음)의 두 방향 중 —
//       ① 뿌리→끝 흐름 극성을 잰 자리면 그 쪽 ② 아니면 결이 세로 성분 |sin| ≥ gravPick 이면 아래쪽 ③ 거의 가로면 직전 걸음과 이어지는 쪽
//   · 보폭 = 결 읽기 사진에서 stepPx(2px) — 머리카락 굵기 무늬(파장 4px)를 건너뛰지 않음
//   · 점 저장: 2px로 그은 길 위를 길이 기준 일정 간격(사진 높이 × stepFrac ≈ 0.5cm)으로 다시 찍음 — 점은 모두 그은 길 위(모양 그대로)
//     · 간격이 일정해야 함: 10-hair-render-2d가 "점 번호 × STRAND_STEP_LEN = 길이"로 실측 길이·자를 자리를 셈
//   · 결을 못 읽은 자리(또렷함 minCoh 미만 · 결 없음)에서 가닥 끝(직전 방향으로 곧게 뻗어 머리 밖으로 튀어나가던 것 없앰)
//   끄기 RAW_TRACE.on=false(예전 2D 긋기)
// ============================================================================
var RAW_TRACE = { on: true, loopFollow: true, gravFirst: true, stepPx: 2, stepFrac: 0.01, gravPick: 0.2, minCoh: 0.05, endOnNoRead: true, stats: { strands: 0, steps: 0, read: 0, byFlow: 0, byGrav: 0, byCont: 0, endNoRead: 0, pts: 0 } };

function rawTraceStrandPath(ix, sy, targetLen, jitterSeed, env, rootSec, stopAtExit) {
  var R = RAW_TRACE, PI = Math.PI, St = R.stats;
  var oy = env.oy > 0 ? env.oy : 1;
  var step = Math.max(1e-3, R.stepPx / oy);                                  // 결 읽기 사진 2px를 이 좌표로
  var keepLen = env.STRAND_STEP_LEN > step ? env.STRAND_STEP_LEN : step;      // 저장 간격 상한(예전 보폭)
    var steps = Math.max(2, Math.ceil(targetLen / step));
  var offRun = 0, exitIdx = -1;
  var has = !!(env.hasOrientation && env.orientation && typeof sampleOrientation === 'function');
  function sample(x, y) { try { return has ? sampleOrientation(env.orientation, x * env.ox, env.orientMaskW, y * env.oy) : null; } catch (e) { return null; } }
  var minConf = (typeof HAIR_FLOW !== 'undefined' && HAIR_FLOW.minConf) || 0.2;
  function pick(sm, prev) {                                                   // 결 각도는 그대로 · 두 방향 중 하나만 고름
    var a = sm.angle;
    /* (2026-11-02) 있는 고리는 생긴 대로 — 사용자: "아래로 가는 경우는 중력으로 방향판정을 했을 때
       아래로 향하는 경우만 하라고 했는데" · "있는 고리는 생긴대로 갈 수 있도록".
       예전엔 매 걸음 ①흐름 극성 ②세로면 무조건 아래 를 먼저 봐서, 고리의 위로 올라가는 반 바퀴가
       매번 아래로 뒤집혔다(디버그 1651 곱슬: 사진 가닥 위로 가는 걸음 0% · 한 바퀴 돈 가닥 0%).
       이제 ①②는 <b>첫 걸음(뿌리 방향)</b>에만 쓰고, 그다음은 직전 걸음과 이어지는 쪽만 고른다.
       같은 결 데이터로 다시 그어 봄: 곱슬 위로 가는 걸음 0 → 29~35% · 반 바퀴 이상 1~3 → 26~33%,
       직모는 그대로 아래로(세로 이동/길이 0.77~0.93). 되돌리기 RAW_TRACE.loopFollow = false */
    if (R.loopFollow && prev != null) {
      if (Math.cos(a - prev) < 0) a += PI;
      St.byCont++; return a;
    }
    /* (2026-11-02) 뿌리 첫 걸음은 화면용 2D(traceStrandPath)처럼 세로 결이면 아래쪽부터 — 흐름 극성은 거의 가로인 자리만.
       화면 2D(아래로 출발)는 실사 11장에서 끝이 뿌리보다 위 0.2% · 사진 가닥(흐름 극성 먼저)은 8.7%. 되돌리기 RAW_TRACE.gravFirst=false */
    if (R.gravFirst && Math.abs(Math.sin(a)) >= R.gravPick) { if (Math.sin(a) < 0) a += PI; St.byGrav++; return a; }
    if (sm.fc >= minConf && (sm.fx || sm.fy)) { if (Math.cos(a) * sm.fx + Math.sin(a) * sm.fy < 0) a += PI; St.byFlow++; return a; }
    if (Math.abs(Math.sin(a)) >= R.gravPick) { if (Math.sin(a) < 0) a += PI; St.byGrav++; return a; }   // 이미지 y 아래 = +
    if (prev != null && Math.cos(a - prev) < 0) a += PI;
    St.byCont++; return a;
  }
  St.strands++;
  var D = [{ x: ix, y: sy }], x = ix, y = sy, dir = null;                    // 2px 걸음 — 그은 길 그대로
  for (var s = 0; s < steps; s++) {
    var sm = sample(x, y);
    if (!(sm && sm.coherence > R.minCoh && isFinite(sm.angle))) {
      if (R.endOnNoRead) { St.endNoRead++; break; }
      if (dir == null) dir = PI / 2;
    } else { dir = pick(sm, dir); St.read++; }
    St.steps++;
    x += Math.cos(dir) * step; y += Math.sin(dir) * step; D.push({ x: x, y: y });
  }
  if (D.length < 2) D.push({ x: ix, y: sy + step });                          // 뿌리에서 바로 못 읽음 — 한 걸음(호출 쪽이 2점을 기대)
  var pts = [D[0]], need = keepLen, j;                                        // 길이 기준 일정 간격으로 다시 찍기(점은 그은 길 위)
  for (j = 1; j < D.length; j++) {
    var ax = D[j - 1].x, ay = D[j - 1].y, sl = Math.hypot(D[j].x - ax, D[j].y - ay), u = 0;
    while (sl - u >= need - 1e-9) { u += need; var t = u / sl; pts.push({ x: ax + (D[j].x - ax) * t, y: ay + (D[j].y - ay) * t }); need = keepLen; }
    need -= (sl - u);
  }
  var last = D[D.length - 1], pl = pts[pts.length - 1];
  if (Math.hypot(last.x - pl.x, last.y - pl.y) > keepLen * 0.5 || pts.length < 2) pts.push({ x: last.x, y: last.y });   // 끝 자리
  if (env.maskAt) for (j = 3; j < pts.length; j++) {                          // 머리 영역 이탈(예전 규칙 그대로: 3점 연속 밖)
    if (env.maskAt(pts[j].x, pts[j].y)) offRun = 0;
    else if (++offRun >= 3) { exitIdx = j - offRun; if (stopAtExit) { pts.length = j + 1; } break; }
  }
  St.pts += pts.length;
  pts.maskExitIdx = exitIdx >= 0 ? Math.max(1, exitIdx) : pts.length - 1;
  pts.flowEndIdx = null;
  return pts;
}
