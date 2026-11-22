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
 * (2026-11-21b) 헐 몸체도 두상 축으로(hull=true) — 뿌리(13a R^T)·얼굴(12a R^T)은 두상 축으로 되돌리는데
 *   헐(13c mapY)만 사진 세로를 그대로 모델 y로 써서 혼자 11° 누워 있었다. 헤어 몸체에 R_u를 걸어 축을 맞춤
 *   → 헐·두상이 한 몸이라 두상을 세우면 헐도 같이 선다. 끄기 HEAD_TILT.hull=false
 *
 * (2026-11-21) 중력도 모델 아래로(grav=false) — 헐 단면은 모델 축 중심이라 헐 축 = 모델 y = 두상 축인데,
 *   중력만 사진의 아래여서 화면을 세우면 가닥만 기울어 흘렀다. 이제 헐·두상·가닥·화면이 모두 한 축(수직)이다.
 *   사진처럼 기울여 기르기 HEAD_TILT.grav=true (화면까지 기울이려면 HEAD_TILT.view=true)
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
    /* (2026-11-21) 중력도 두상 축으로 — 사용자: "카메라맞춤에서 헤어 헐하고 두상 축 일치시키는데 … 두상은 수직인데 헐은 그대로야"
       헐(13c)은 버킷마다 모델 축(x=0·z=0) 중심의 W·D 단면이라 <b>정의상 모델 y가 축</b>이다. 두상·두개골도 모델 y다.
       그런데 다시 기르기 중력만 사진의 아래(HEAD_TILT.down, 약 11° 기운 축)여서, 화면을 세우면(view=false)
       두상·헐은 수직인데 <b>가닥만</b> 그 각만큼 비스듬히 흘러 머리 뭉치가 기울어 보였다 — 사용자가 본 "헐은 그대로".
       grav=false면 중력도 모델 아래(0,−1,0) = 헐 축 = 두상 축 = 화면 세로. 사진처럼 기울여 기르기 HEAD_TILT.grav=true(+ view=true로 화면까지) */
    grav: false,
    /* (2026-11-21b) 헐 몸체를 두상 축으로 — 사용자: "같이 움직여야지. 중심축을 맞춘 다음인데."
       되돌림이 한 곳 빠져 있었다:
         · 뿌리 위치 13a:1123 applyRotationTranspose3(R^T) · 얼굴 12a:3189 R^T → 둘 다 두상 축
         · 헐 13c:1478 mapY = yTop −(py−crownY)·sy → <b>되돌림 없음</b>. 사진 세로를 그대로 모델 y로 씀.
       그래서 헐만 사진 축에 남아, 그린 헐 = R_u^T·(참 헐)만큼(약 11°) 누워 있었다 — 두상을 세우면 "헐은 그대로".
       참 헐 = R_u·(그린 헐)이므로, 헤어 몸체에 R_u(ŷ→사진의 위)를 두상 중심에서 한 번 걸어 축을 맞춘다.
       그러면 헐 축 = 두상 축 = 한 몸 → 두상을 세우면 헐도 같이 선다(화면 회전·돌리기는 headGroup이 그대로 담당).
       끄기 HEAD_TILT.hull=false · 근본 고침(헐 적합에 버킷별 z 중심 hullCz를 넣어 13c에서 되돌리기)은 별 항목. */
    /* (2026-11-21c) 기본 끔 — 사용자: "헤어헐을 두상축과 맞췄는데, 헤어헐만 기울어져 있어 …
       헐은 두상축이랑 일치시키니까 카메라맞춤에서, 그 이후에는 계속 같이 움직이도록 해야지"
       헐과 두상 축을 맞추는 일은 <b>카메라맞춤 단계</b>(VIEW_FIX로 맞춘 카메라 → 13c가 그 카메라로 헐을 적합)에서 한 번 끝난다.
       그 뒤에 여기서 매 프레임 헤어 몸체(adjustedHair/hairStrands)에만 rotation·position을 더 걸면,
       두상(skullEllipsoid·얼굴 메쉬)은 headGroup 그대로인데 <b>머리카락만</b> 그 각만큼 돌아간다 —
       화면에서 "헤어헐만 기울어져" 보이던 것이 이 한 겹이었다. 두상과 머리는 같은 headGroup의 자식이므로,
       여기서 아무것도 안 걸면 둘은 정의상 한 몸으로 같이 움직인다(돌리기·기울이기는 headGroup 하나만 담당).
       축이 실제로 어긋나 보이면 그건 헐 적합(13c) 쪽에서 고칠 일이지, 그린 뒤에 돌려서 덮을 일이 아니다.
       예전처럼 몸체만 돌려 보기 HEAD_TILT.hull=true */
    hull: false,
    lateral: true,       // (11-10) 좌우(갸웃) 기울기도 쓸지 — 기본 끔: 앞뒤(숙임)만. 켜기 HEAD_TILT.lateral=true
    maxDeg: 25,          // 이보다 크면 포즈 오측정으로 보고 안 기울임
    weights: { front: 1, left: 1, right: 1, back: 0 },   // 얼굴 실측 없는 뷰는 아래에서 0
    up: null, down: null, downRaw: null, deg: 0, from: '', _key: ''
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
    T._key = key; T._hullLogged = false;
    if (!(wsum > 0)) { T.up = T.down = T.downRaw = null; T.deg = 0; T.from = '얼굴 실측 사진 없음'; return null; }
    var rawSide = Math.atan2(sx, sy) * 180 / Math.PI;
    if (!T.lateral) sx = 0;   // 좌우 성분 지움 → 축은 y–z 평면(앞뒤)에만 남음
    var l = Math.hypot(sx, sy, sz) || 1, u = { x: sx / l, y: sy / l, z: sz / l };
    var deg = Math.acos(Math.max(-1, Math.min(1, u.y))) * 180 / Math.PI;
    T.from = used.join('·');
    if (deg > T.maxDeg) { T.up = T.down = T.downRaw = null; T.deg = deg; T.from += ' (' + deg.toFixed(1) + '° > ' + T.maxDeg + '° — 오측정으로 보고 안 씀)'; console.warn('[두상 기울기] ' + T.from); return null; }
    T.up = u; T.downRaw = { x: -u.x, y: -u.y, z: -u.z }; T.down = T.grav ? T.downRaw : null; T.deg = deg;
    console.log('[두상 기울기] 사진의 위(모델 좌표) (' + u.x.toFixed(3) + ', ' + u.y.toFixed(3) + ', ' + u.z.toFixed(3) + ') · ' + deg.toFixed(1) + '°'
      + ' (앞뒤 ' + (Math.atan2(-u.z, u.y) * 180 / Math.PI).toFixed(1) + '° · 좌우 ' + (Math.atan2(u.x, u.y) * 180 / Math.PI).toFixed(1) + '°' + (T.lateral ? '' : ' (실측 ' + rawSide.toFixed(1) + '° 안 씀)') + ') · 출처 ' + T.from
      + ' — 다시 기르기 중력 ' + (T.grav ? '이 축으로' : '모델 아래(0,−1,0) = 헐·두상 축 · 사진 축으로 HEAD_TILT.grav=true')
      + ' · 화면 ' + (T.view ? '이 축으로 기울임' : '두상 축을 세로로(기울여 보기 HEAD_TILT.view=true)') + ' (끄기 HEAD_TILT.on=false)');
    return u;
  };

  /* headGroup(Euler YXZ = 돌리기 y 뒤에 로컬 x·z)에서 u를 세로로 세우는 x·z 각 */
  function anglesFor(u) {
    var phi = Math.atan2(u.x, u.y);                         // z축 먼저: x 성분 지움
    var theta = -Math.atan2(u.z, Math.hypot(u.x, u.y));     // 그 다음 x축: z 성분 지움
    return { x: theta, z: phi };
  }
  /* 헤어 몸체(헐)를 두상 축으로 — R_u = Rz(−phi)·Rx(−theta) (anglesFor의 역), 축점은 두상 중심 */
  function headCY() {
    try { var c = state.hair3Dneutral && state.hair3Dneutral.CY; return isFinite(c) ? c : 0.15; } catch (e) { return 0.15; }
  }
  function hairBody() {
    try {
      var g = model3D.headGroup;
      return g.getObjectByName('adjustedHair') || g.getObjectByName('hairStrands') || null;
    } catch (e) { return null; }
  }
  T.applyHull = function () {
    try {
      var h = hairBody(); if (!h) return;
      /* hull=false(기본)면 여기서 건 것을 모두 지우고 손을 뗀다 — 헤어 몸체는 headGroup(두상)과 한 몸 */
      var ax = { x: 0, z: 0 };
      if (T.on && T.hull) { T.compute(); if (T.up) { var a0 = anglesFor(T.up); ax = { x: -a0.x, z: -a0.z }; } }
      if (h.rotation.order !== 'ZXY') { h.rotation.order = 'ZXY'; }
      if (Math.abs(h.rotation.x - ax.x) < 1e-5 && Math.abs(h.rotation.z - ax.z) < 1e-5) return;
      h.rotation.x = ax.x; h.rotation.z = ax.z;
      /* 축점 보정: 두상 중심 c=(0,CY,0)이 제자리에 있게 position = c − R_u·c */
      var cy = headCY();
      if (ax.x || ax.z) {
        var v = new THREE.Vector3(0, cy, 0).applyEuler(new THREE.Euler(ax.x, 0, ax.z, 'ZXY'));
        h.position.set(-v.x, cy - v.y, -v.z);
      } else h.position.set(0, 0, 0);
      if (!T._hullLogged) { T._hullLogged = true; console.log('[두상 기울기] 헐 몸체를 두상 축으로 — ' + T.deg.toFixed(1) + '° (앞뒤 ' + (Math.atan2(-T.up.z, T.up.y) * 180 / Math.PI).toFixed(1) + '°) · 축점 y ' + cy.toFixed(3) + ' · 끄기 HEAD_TILT.hull=false'); }
      try { if (W.GPU_DIET && W.GPU_DIET.dirty) W.GPU_DIET.dirty(); } catch (e) {}
    } catch (e) {}
  };
  T.apply = function () {
    try {
      T.applyHull();
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
    return ['[두상 기울기] ' + (T.on ? '켜짐' : '꺼짐') + ' · 화면 ' + (T.view ? '켜짐' : '꺼짐') + ' · 중력 ' + (T.grav ? '사진의 아래' : '모델 아래(헐·두상 축)') + ' · 헐 몸체 ' + (T.hull ? '두상 축으로 맞춤' : '사진 축 그대로'),
      '  사진의 위 ' + (T.up ? '(' + T.up.x.toFixed(3) + ', ' + T.up.y.toFixed(3) + ', ' + T.up.z.toFixed(3) + ')' : '없음') + ' · ' + T.deg.toFixed(1) + '° · 출처 ' + T.from];
  };

  /* 다시 기르기 직전에 중력 축을 정해 둔다(17b가 HEAD_TILT.down을 읽음) · 화면 자세는 가볍게 따라감 */
  setInterval(function () { if (T.on) T.compute(); else { T.down = T.downRaw = null; } if (!T.grav) T.down = null; T.apply(); }, 400);
  console.log('[두상 기울기] 설치 — 헐·두상·중력·화면을 모두 <b>한 축(모델 y)</b>으로 · 헤어 몸체는 두상과 한 몸(headGroup)으로 둠(2026-11-21c hull=false): 헐 단면은 정의상 모델 축 중심이고 두상도 모델 y라, 중력만 사진의 아래면 가닥만 기울어 보였음(2026-11-21 grav=false) · 사진처럼 기울이기 HEAD_TILT.grav=true·view=true · 끄기 HEAD_TILT.on=false · 상태 HEAD_TILT.lines().join("\\n")');
})();
