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
var RAW_TRACE = { on: true, loopFollow: true, gravFirst: true, stepPx: 2, stepFrac: 0.01, gravPick: 0.2, minCoh: 0.05, endOnNoRead: true,
  /* (2026-11-10) 가려졌다가 다시 드러나는 가닥 — 사용자: "보이는 가닥들은 다 영역 안에 있어야 되고, 가려져서 안 보이는 경우만 해당되게"
   *   예: 옆 사진에서 어깨 앞으로 내려오는 머리가 턱·얼굴·목에 가려 끊겨 보임 → 예전엔 거기서 가닥이 끝나(결 못 읽음 · 3점 연속 밖)
   *   아래 조각은 두피와 이어지지 않은 조각이 됨 → 옆 사진의 깊이 정보가 3D로 안 감(디버그 2241: 옆 사진에서 목 앞 어깨 높이 옮긴 점 왼 270 · 오른 831).
   *   지금: 머리 영역을 벗어난 자리가 <b>사람 윤곽 안(살·옷 = 가린 것)</b>이면 직전 방향 그대로 곧게 건너 봄 —
   *     · 건너는 중 배경(사람 윤곽 밖)에 닿으면 = 보이는데 영역 밖 → 틈 시작에서 끝(예전과 같음)
   *     · hideGapFrac(마스크 높이 비율) 안에 다시 머리 영역에 닿고, 그 자리 결이 직전 방향과 이어지면(|cos| ≥ hideCos) 계속 그음
   *     · 못 닿으면 틈 시작에서 끝
   *   건넌 점은 pts.hidden(점 번호)에 남김 · 보이는 점은 전부 머리 영역 안. 사람 윤곽 없는 사진은 예전 그대로. 끄기 RAW_TRACE.hideBridge=false */
  hideBridge: true, hideGapFrac: 0.08, hideCos: 0.7,
  /* (2026-11-10d) 되접힘 끝 — 사용자: "왼쪽 어깨에 내려온 가닥이 어깨에 닿은 다음 솟구쳐 올라서 턱으로 갔어" · "웨이브 뒷머리끝도 그런 머리들" · "단발 뒷머리 중간에 위쪽으로 말린 머리"
   *   셋 다 같은 원인: loopFollow(첫 걸음 뒤엔 직전 걸음과 이어지는 쪽만 고름)는 결(앞뒤 없는 선)을 따라 몇 걸음에 걸쳐 조금씩 돌면
   *   180°까지 돌아갈 수 있음 — 머리끝(끝단 테두리 결이 가로)·어깨 윤곽·빛 띠처럼 결이 옆으로 눕는 자리에서 돌아서면, 그 위 곧은 결은
   *   "이어지는 쪽 = 위"라 옆 가닥 결을 타고 뿌리 쪽으로 다시 올라감(거울처럼 내려간 만큼 올라감).
   *   잰 값(디버그 1033 긴 웨이브 · 1036 단발 · 사진 가닥 lift): 맨 아래에서 다시 12cm 넘게 오르는 가닥 웨이브 13% · 단발 18% —
   *     웨이브의 진짜 고리는 3cm 안(1~3cm 364개 · 3~12cm 152개 · 12cm↑ 1410개 = 둘로 갈림) · 다시 기른 가닥 37%가 이걸 그대로 옮김.
   *   지금: 뿌리 거리장 흐름(fx,fy = 04 buildRootFlowField — 결과 따로 마스크에서만 잰 "뿌리에서 멀어지는 쪽")을 따라 걸음마다 나아간 양을 더함.
   *     가닥이 지금까지 가장 멀리 간 자리보다 foldFrac(마스크 높이 비율 · 0.06 ≈ 3.8cm) 넘게 뿌리 쪽으로 되돌아오면 그 가장 먼 자리에서 끝.
   *     고리(지름 3cm 안)는 그대로 · 방향 고르기는 그대로(뒤집지 않음 · 끝만 정함) · 흐름 확신도가 낮은 걸음은 안 셈.
   *   같은 데이터로 사진 결 다시 긋기: 6cm 넘게 되돌아 오른 가닥 웨이브 뒤 27% · 옆 10% → 0 · 1~3cm 고리 그대로. 끄기 RAW_TRACE.foldEnd=false */
  foldEnd: true, foldFrac: 0.06,
  stats: { strands: 0, steps: 0, read: 0, byFlow: 0, byGrav: 0, byCont: 0, endNoRead: 0, pts: 0, hideTry: 0, hideOk: 0, hideBg: 0, hideLong: 0, hidePts: 0, foldCut: 0, foldPts: 0 } };

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
  var HB = !!(R.hideBridge && env.personAt && env.maskAt), hidD = HB ? [0] : null, gapMaxN = HB ? Math.max(3, Math.ceil(R.hideGapFrac * (env.maskH || 800) / step)) : 0;
  var FE = R.foldEnd !== false, foldTol = (R.foldFrac || 0.06) * (env.maskH || 800), prog = 0, progMax = 0, progMaxN = 1;   // (11-10d) 되접힘 끝
  for (var s = 0; s < steps; s++) {
    if (HB && dir != null && !env.maskAt(x, y) && env.personAt(x, y)) {      // (2026-11-10) 가린 것(살·옷) 위 — 곧게 건너 봄
      St.hideTry++;
      var g0 = D.length, gx = x, gy = y, gk, back = false, why = 'long';
      for (gk = 0; gk < gapMaxN && s < steps; gk++, s++) {
        gx += Math.cos(dir) * step; gy += Math.sin(dir) * step;
        if (env.maskAt(gx, gy)) {
          var sm2 = sample(gx, gy);
          if (sm2 && sm2.coherence > R.minCoh && isFinite(sm2.angle) && Math.abs(Math.cos(sm2.angle - dir)) >= R.hideCos) { back = true; break; }
          why = 'turn'; break;                                               // 다시 머리인데 결이 안 이어짐 — 다른 가닥
        }
        if (!env.personAt(gx, gy)) { why = 'bg'; break; }                     // 보이는데 영역 밖 = 배경
        D.push({ x: gx, y: gy }); hidD.push(1);
      }
      if (!back) { D.length = g0; hidD.length = g0; if (why === 'bg') St.hideBg++; else St.hideLong++; break; }
      St.hideOk++; St.hidePts += D.length - g0; x = gx; y = gy; D.push({ x: x, y: y }); hidD.push(0); continue;
    }
    var sm = sample(x, y);
    if (!(sm && sm.coherence > R.minCoh && isFinite(sm.angle))) {
      if (R.endOnNoRead) { St.endNoRead++; break; }
      if (dir == null) dir = PI / 2;
    } else { dir = pick(sm, dir); St.read++; }
    St.steps++;
    if (FE && sm && sm.fc >= minConf && (sm.fx || sm.fy)) {                 // 뿌리에서 멀어진 양(흐름 방향 성분) — 결 각도·방향 고르기는 안 건드림
      prog += step * (Math.cos(dir) * sm.fx + Math.sin(dir) * sm.fy);
      if (prog > progMax) { progMax = prog; progMaxN = D.length; }
      else if (progMax - prog > foldTol) { St.foldCut++; St.foldPts += D.length - progMaxN; D.length = progMaxN; if (hidD) hidD.length = progMaxN; break; }
    }
    x += Math.cos(dir) * step; y += Math.sin(dir) * step; D.push({ x: x, y: y }); if (HB) hidD.push(0);
  }
  if (D.length < 2) D.push({ x: ix, y: sy + step });                          // 뿌리에서 바로 못 읽음 — 한 걸음(호출 쪽이 2점을 기대)
  var pts = [D[0]], need = keepLen, j, hidP = [];                            // 길이 기준 일정 간격으로 다시 찍기(점은 그은 길 위)
  for (j = 1; j < D.length; j++) {
    var ax = D[j - 1].x, ay = D[j - 1].y, sl = Math.hypot(D[j].x - ax, D[j].y - ay), u = 0;
    while (sl - u >= need - 1e-9) { u += need; var t = u / sl; pts.push({ x: ax + (D[j].x - ax) * t, y: ay + (D[j].y - ay) * t }); if (hidD && (hidD[j] || hidD[j - 1])) hidP.push(pts.length - 1); need = keepLen; }
    need -= (sl - u);
  }
  var last = D[D.length - 1], pl = pts[pts.length - 1];
  if (Math.hypot(last.x - pl.x, last.y - pl.y) > keepLen * 0.5 || pts.length < 2) pts.push({ x: last.x, y: last.y });   // 끝 자리
  if (env.maskAt) for (j = 3; j < pts.length; j++) {                          // 머리 영역 이탈(예전 규칙 그대로: 3점 연속 밖)
    if (env.maskAt(pts[j].x, pts[j].y) || (hidP.length && hidP.indexOf(j) >= 0)) offRun = 0;   // 건넌(가려진) 점은 영역 밖으로 안 셈
    else if (++offRun >= 3) { exitIdx = j - offRun; if (stopAtExit) { pts.length = j + 1; } break; }
  }
  if (typeof RAW3D !== 'undefined' && RAW3D.fine) {                          // (2026-11-03) 3D로 올릴 촘촘한 점 — 같은 그은 길 위, 간격 keepLen/div
    var dv = RAW3D.fineDiv || 5, fl = keepLen / dv, F = [D[0]], nd = fl;
    for (j = 1; j < D.length; j++) {
      var bx = D[j - 1].x, by = D[j - 1].y, sl2 = Math.hypot(D[j].x - bx, D[j].y - by), u2 = 0;
      while (sl2 - u2 >= nd - 1e-9) { u2 += nd; var t2 = u2 / sl2; F.push({ x: bx + (D[j].x - bx) * t2, y: by + (D[j].y - by) * t2 }); nd = fl; }
      nd -= (sl2 - u2);
    }
    var lf = F[F.length - 1]; if (Math.hypot(last.x - lf.x, last.y - lf.y) > fl * 0.5) F.push({ x: last.x, y: last.y });
    if (F.length > (pts.length - 1) * dv + 1) F.length = (pts.length - 1) * dv + 1;
    F.div = dv; pts.fine = F;
  }
  St.pts += pts.length;
  if (hidP.length) { pts.hidden = hidP.filter(function (k) { return k < pts.length; }); }
  pts.maskExitIdx = exitIdx >= 0 ? Math.max(1, exitIdx) : pts.length - 1;
  pts.flowEndIdx = null;
  return pts;
}
