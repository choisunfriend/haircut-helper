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
// ============================================================================
var RAW_TRACE = { on: true, stepFrac: 0.01, minCoh: 0.05, stats: { strands: 0, steps: 0, read: 0, kept: 0 } };

function rawTraceStrandPath(ix, sy, targetLen, jitterSeed, env, rootSec, stopAtExit) {
  var step = env.STRAND_STEP_LEN, PI = Math.PI;
  var steps = Math.max(2, Math.round(targetLen / step));
  var pts = [{ x: ix, y: sy }], n = 1, offRun = 0, exitIdx = -1, St = RAW_TRACE.stats;
  var has = !!(env.hasOrientation && env.orientation && typeof sampleOrientation === 'function');
  function sample(x, y) { try { return has ? sampleOrientation(env.orientation, x * env.ox, env.orientMaskW, y * env.oy) : null; } catch (e) { return null; } }
  var dir = PI / 2, s0 = sample(ix, sy);
  var minConf = (typeof HAIR_FLOW !== 'undefined' && HAIR_FLOW.minConf) || 0.2;
  if (s0 && s0.fc >= minConf && (s0.fx || s0.fy)) dir = Math.atan2(s0.fy, s0.fx);        // 뿌리→끝 흐름이 있으면 그 방향
  else if (s0 && s0.coherence > RAW_TRACE.minCoh) { dir = s0.angle; if (Math.sin(dir) < 0) dir += PI; }   // 없으면 결 중 아래쪽
  St.strands++;
  for (var s = 0; s < steps; s++) {
    var c = pts[n - 1], sm = sample(c.x, c.y);
    if (sm && sm.coherence > RAW_TRACE.minCoh && isFinite(sm.angle)) {
      var a = sm.angle;
      if (Math.cos(a - dir) < 0) a += PI;                                // 결(앞뒤 없음) 중 직전과 이어지는 쪽
      dir = a; St.read++;
    } else St.kept++;
    St.steps++;
    var nx = c.x + Math.cos(dir) * step, ny = c.y + Math.sin(dir) * step;
    pts.push({ x: nx, y: ny }); n++;
    if (env.maskAt && exitIdx < 0 && s >= 2) {
      if (env.maskAt(nx, ny)) offRun = 0;
      else if (++offRun >= 3) { exitIdx = n - 1 - offRun; if (stopAtExit) break; }
    }
  }
  pts.maskExitIdx = exitIdx >= 0 ? Math.max(1, exitIdx) : n - 1;
  pts.flowEndIdx = null;
  return pts;
}
