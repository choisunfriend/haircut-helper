/* ──────────────────────────────────────────────────────────────────────────
 * [두상 기울기] (2026-11-09) 헤어 헐과 두상 축을 한 축으로 — 사진처럼 전체를 기울임
 *
 * 무엇이 어긋났나
 *   · 헤어 헐(13c)은 사진마다 <b>그 카메라의 세로</b>로 실루엣을 쌓는다. 카메라는 수평이니
 *     헐의 축 = 사진의 위아래(중력)다.
 *   · 두상(두피 타원·두개골·얼굴)은 <b>얼굴 기준 세로</b>(모델 y)에 서 있다.
 *   · 사진 속 머리는 얼굴 기준으로 기울어 있다 — 카메라 R의 둘째 줄이 "모델 좌표에서 본
 *     사진의 위"다. 디버그 2043 정면: (0.002, 0.981, −0.195) = 11° 앞으로 숙임.
 *   · 그런데 3D는 두상을 똑바로 세워 그리고, 다시 기르기 중력도 모델 −y로 내린다
 *     → 늘어진 머리가 사진보다 11°만큼 뒤로 누움(원본 대조: 옆 사진 아래 앞 파랑·위 뒤 빨강).
 *
 * 고침(규칙·판정 없음 — 카메라 실측 하나)
 *   ① 사진의 위 = 얼굴을 실측한 사진들(랜드마크 있는 뷰)의 카메라 위 벡터 평균.
 *   ② 다시 기르기 중력 = 그 반대(HEAD_TILT.down) — 헐 축과 같은 축으로 내림.
 *   ③ 화면: 두상+머리 묶음(headGroup)을 그 각만큼 기울임 → 사진처럼 숙인/갸웃한 머리.
 *      돌리기(rotation.y)는 그대로 — 기울기는 그 안쪽(로컬)에 들어감(Euler YXZ).
 *   사진 대조·카메라 값은 안 바꿈(모델 좌표 그대로 · 보이는 자세만 기울임).
 *
 * (2026-11-10) 좌우 성분은 기본으로 지움 — 앞뒤로만 기울임(HEAD_TILT.lateral=true로 되살림)
 * 끄기 HEAD_TILT.on=false 후 다시 기르기 · 화면만 끄기 HEAD_TILT.view=false
 * 상태 HEAD_TILT.lines().join("\n")
 * ────────────────────────────────────────────────────────────────────────── */
(function () {
  var W = window;
  var T = W.HEAD_TILT = {
    /* (2026-11-10i) 화면은 세워서 — 사용자: "헤어헐을 두상축에 맞춘 다음에 기울기를 그대로 했는데, 두상축에 맞춘 다음에 상하좌우 다 수직으로 세워줘"
       헐·두상을 한 축으로 맞추는 건(중력 = 사진의 아래) 그대로 · 화면에서 사진처럼 숙이고 갸웃하던 것(앞뒤·좌우)만 끔 = 두상 축이 화면 세로.
       예전처럼 기울여 보기 HEAD_TILT.view=true */
    on: true, view: false,
    lateral: true,       // (11-10) 좌우(갸웃) 기울기도 쓸지 — 기본 끔: 앞뒤(숙임)만. 켜기 HEAD_TILT.lateral=true
    maxDeg: 25,          // 이보다 크면 포즈 오측정으로 보고 안 기울임
    weights: { front: 1, left: 1, right: 1, back: 0 },   // 얼굴 실측 없는 뷰는 아래에서 0
    up: null, down: null, deg: 0, from: '', _key: ''
  };

  function cams() {
    try {
      var ph = state._hair3Dneutral, pr = (ph && ph.occ && ph.occ.probe) || (state.hairOcc3D && state.hairOcc3D.probe);
      return (pr && pr.cams) || [];
    } catch (e) { return []; }
  }
  function measured(angle) {
    try { var lm = state.landmarks && state.landmarks[angle]; return !!(lm && !lm._silhouette); } catch (e) { return false; }
  }

  T.compute = function () {
    var cs = cams(), sx = 0, sy = 0, sz = 0, wsum = 0, used = [];
    cs.forEach(function (c) {
      if (!c || !c.R || c.R.length < 9) return;
      var w = T.weights[c.angle]; if (!(w > 0) || !measured(c.angle)) return;
      sx += w * c.R[3]; sy += w * c.R[4]; sz += w * c.R[5]; wsum += w;   // R 둘째 줄 = 모델에서 본 사진의 위
      used.push(c.angle);
    });
    var key = (T.lateral ? 'L' : 'F') + used.join(',') + ':' + sx.toFixed(4) + sy.toFixed(4) + sz.toFixed(4);
    if (key === T._key) return T.up;
    T._key = key;
    if (!(wsum > 0)) { T.up = T.down = null; T.deg = 0; T.from = '얼굴 실측 사진 없음'; return null; }
    var rawSide = Math.atan2(sx, sy) * 180 / Math.PI;
    if (!T.lateral) sx = 0;   // 좌우 성분 지움 → 축은 y–z 평면(앞뒤)에만 남음
    var l = Math.hypot(sx, sy, sz) || 1, u = { x: sx / l, y: sy / l, z: sz / l };
    var deg = Math.acos(Math.max(-1, Math.min(1, u.y))) * 180 / Math.PI;
    T.from = used.join('·');
    if (deg > T.maxDeg) { T.up = T.down = null; T.deg = deg; T.from += ' (' + deg.toFixed(1) + '° > ' + T.maxDeg + '° — 오측정으로 보고 안 씀)'; console.warn('[두상 기울기] ' + T.from); return null; }
    T.up = u; T.down = { x: -u.x, y: -u.y, z: -u.z }; T.deg = deg;
    console.log('[두상 기울기] 사진의 위(모델 좌표) (' + u.x.toFixed(3) + ', ' + u.y.toFixed(3) + ', ' + u.z.toFixed(3) + ') · ' + deg.toFixed(1) + '°'
      + ' (앞뒤 ' + (Math.atan2(-u.z, u.y) * 180 / Math.PI).toFixed(1) + '° · 좌우 ' + (Math.atan2(u.x, u.y) * 180 / Math.PI).toFixed(1) + '°' + (T.lateral ? '' : ' (실측 ' + rawSide.toFixed(1) + '° 안 씀)') + ') · 출처 ' + T.from
      + ' — 다시 기르기 중력·화면 자세를 이 축으로 (끄기 HEAD_TILT.on=false)');
    return u;
  };

  /* headGroup(Euler YXZ = 돌리기 y 뒤에 로컬 x·z)에서 u를 세로로 세우는 x·z 각 */
  function anglesFor(u) {
    var phi = Math.atan2(u.x, u.y);                         // z축 먼저: x 성분 지움
    var theta = -Math.atan2(u.z, Math.hypot(u.x, u.y));     // 그 다음 x축: z 성분 지움
    return { x: theta, z: phi };
  }
  T.apply = function () {
    try {
      if (typeof model3D === 'undefined' || !model3D || !model3D.headGroup) return;
      var g = model3D.headGroup, ax = { x: 0, z: 0 };
      if (T.on && T.view) { T.compute(); if (T.up) ax = anglesFor(T.up); }
      if (g.rotation.order !== 'YXZ') { var ry = g.rotation.y; g.rotation.order = 'YXZ'; g.rotation.y = ry; }
      if (Math.abs(g.rotation.x - ax.x) > 1e-5 || Math.abs(g.rotation.z - ax.z) > 1e-5) {
        g.rotation.x = ax.x; g.rotation.z = ax.z;
        try { if (W.GPU_DIET && W.GPU_DIET.dirty) W.GPU_DIET.dirty(); } catch (e) {}
      }
    } catch (e) {}
  };
  T.lines = function () {
    T._key = ''; T.compute();
    return ['[두상 기울기] ' + (T.on ? '켜짐' : '꺼짐') + ' · 화면 ' + (T.view ? '켜짐' : '꺼짐'),
      '  사진의 위 ' + (T.up ? '(' + T.up.x.toFixed(3) + ', ' + T.up.y.toFixed(3) + ', ' + T.up.z.toFixed(3) + ')' : '없음') + ' · ' + T.deg.toFixed(1) + '° · 출처 ' + T.from];
  };

  /* 다시 기르기 직전에 중력 축을 정해 둔다(17b가 HEAD_TILT.down을 읽음) · 화면 자세는 가볍게 따라감 */
  setInterval(function () { if (T.on) T.compute(); else { T.down = null; } T.apply(); }, 400);
  console.log('[두상 기울기] 설치 — 헤어 헐(사진 세로)과 두상 축을 한 축으로: 중력은 사진의 아래로, 화면은 두상 축을 세로로 세움(기울여 보기 HEAD_TILT.view=true) · 끄기 HEAD_TILT.on=false · 상태 HEAD_TILT.lines().join("\\n")');
})();
