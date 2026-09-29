/* ==========================================================================
 * 29-hairpin-3d.js — 3D 결과 화면 전용 헤어핀 착용
 *
 * · 기본은 "없음" → 스타일 완성본 그대로. 핀을 고르면 그때만 머리 위에 얹습니다.
 * · 3D 결과 화면(STEP 5/5)에서만 나옵니다. 조정·결과 2D 화면은 건드리지 않습니다.
 * · 핀 = 상품 사진에서 배경을 지운 PNG를 얇은 판에 입혀 머리 표면 곡률대로 휘어 붙임.
 * · 위치: 귀 위 옆머리(착용샷처럼). 좌/우 선택. 크기는 실제 길이(cm) → 모델 단위로 환산.
 *
 * 새 핀 추가: HAIRPIN_CATALOG 에 { id, name, img, lengthCm } 한 줄 + assets/pins/에 배경 없는 PNG
 * ======================================================================== */
(function () {
  'use strict';
  var G = window;
  if (typeof THREE === 'undefined') return;

  var CATALOG = G.HAIRPIN_CATALOG = [
    { id: 'none', name: 'None' },
    { id: 'pearl', name: 'Pearl', img: 'assets/pins/pearl.png', lengthCm: 7.0 },
    { id: 'butterfly', name: 'Butterfly', img: 'assets/pins/butterfly.png', lengthCm: 6.0 }
  ];
  var HP = G.HAIRPIN = {
    id: 'none',
    side: 1,          // +1 = 화면 오른쪽(착용자 왼쪽), -1 = 반대쪽
    up: 0.38,         // 귀 위 높이 (옆 방향 대비 위쪽 성분)
    fwd: 0.15,        // 약간 앞쪽
    tilt: 0.35,       // 핀 기울기(앞쪽이 올라가게)
    lift: 0.02        // 머리 표면에서 띄우는 비율(파묻힘 방지)
  };

  var texCache = {};
  function loadTex(url, cb) {
    if (texCache[url]) return cb(texCache[url]);
    new THREE.TextureLoader().load(url, function (t) {
      t.anisotropy = 4;
      texCache[url] = t; cb(t);
    }, undefined, function () { console.warn('[헤어핀] 이미지 로드 실패', url); cb(null); });
  }

  function v3(x, y, z) { return new THREE.Vector3(x, y, z); }

  /* 머리 표면 찾기 — 헤어 선분 정점 중 방향 d 근처(원뿔 ~10°)에서 바깥쪽 90% 지점 */
  function surfaceRadius(pos, C, d, cosMin) {
    var rs = [], v = new THREE.Vector3();
    for (var i = 0; i < pos.count; i += 2) {
      v.set(pos.getX(i) - C.x, pos.getY(i) - C.y, pos.getZ(i) - C.z);
      var L = v.length(); if (L < 1e-6) continue;
      if (v.dot(d) / L > cosMin) rs.push(L);
    }
    if (rs.length < 20) return null;
    rs.sort(function (a, b) { return a - b; });
    return rs[Math.floor(rs.length * 0.985)];   // 거의 가장 바깥 — 핀이 머리카락 위에 올라앉게
  }

  function headCenter(pos) {
    var M = state.hair3Dneutral, cy = M && isFinite(M.CY) ? M.CY : 0, zs = [];
    var E = null; try { E = getHeadEllipsoid(); } catch (e) {}
    var b = E ? E.b : 1;
    for (var i = 0; i < pos.count; i += 7) if (pos.getY(i) > cy + 0.5 * b) zs.push(pos.getZ(i));
    zs.sort(function (a, c) { return a - c; });
    return v3(0, cy, zs.length ? zs[zs.length >> 1] : 0);
  }

  function removePin(parent) {
    var old = parent && parent.getObjectByName('hairpin');
    if (!old) return;
    old.parent.remove(old);
    old.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  }

  function placePin() {
    if (typeof model3D === 'undefined' || !model3D || !model3D.headGroup) return;
    var hair = model3D.headGroup.getObjectByName('adjustedHair');
    var parent = hair || model3D.headGroup;
    removePin(model3D.headGroup);
    var item = CATALOG.find(function (c) { return c.id === HP.id; });
    if (!item || !item.img) return;
    if (!hair || !hair.geometry || !hair.geometry.attributes.position) { console.warn('[헤어핀] 3D 헤어가 없어 핀을 붙이지 않음'); return; }
    var pos = hair.geometry.attributes.position;
    var cmPer = (typeof modelCmPerUnit === 'function' && modelCmPerUnit()) || 19.33;

    loadTex(item.img, function (tex) {
      if (!tex || HP.id !== item.id) return;
      removePin(model3D.headGroup);
      var C = headCenter(pos);
      var d = v3(HP.side, HP.up, HP.fwd).normalize();
      var r = surfaceRadius(pos, C, d, Math.cos(10 * Math.PI / 180));
      if (!r) { console.warn('[헤어핀] 옆머리 표면을 못 찾음'); return; }
      r *= 1 + HP.lift;

      // 핀 판의 두 축: t = 길이 방향(앞쪽이 살짝 위), b = 폭 방향
      var t0 = v3(0, HP.tilt, 1);
      var t = t0.sub(d.clone().multiplyScalar(t0.dot(d))).normalize();
      var bAx = new THREE.Vector3().crossVectors(d, t).normalize();
      var len = item.lengthCm / cmPer;
      var aspect = tex.image && tex.image.width ? tex.image.width / tex.image.height : 3;
      var wid = len / aspect;

      // 판을 잘게 나눠 머리 곡면(반지름 r 구면)에 감기게
      var geo = new THREE.PlaneGeometry(len, wid, 24, 4);
      var P = geo.attributes.position, center = C.clone().add(d.clone().multiplyScalar(r)), q = new THREE.Vector3();
      for (var i = 0; i < P.count; i++) {
        q.copy(center).add(t.clone().multiplyScalar(P.getX(i))).add(bAx.clone().multiplyScalar(P.getY(i)));
        q.sub(C).setLength(r).add(C);
        P.setXYZ(i, q.x, q.y, q.z);
      }
      P.needsUpdate = true;
      geo.computeVertexNormals();
      var mat = new THREE.MeshStandardMaterial({
        map: tex, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide,
        roughness: 0.35, metalness: 0.25
      });
      var mesh = new THREE.Mesh(geo, mat);
      mesh.name = 'hairpin';
      mesh.renderOrder = 2;
      parent.add(mesh);
    });
  }
  HP.place = placePin;

  /* ── 진단: 사진 경계 보기 ("Seams" 버튼) ─────────────────────────────
   * 가닥마다 어느 사진(정면·좌·우·후면)에서 왔는지 색으로 칠해 따로 그립니다.
   * 두피가 한 줄로 드러나는 자리가 색이 바뀌는 경계와 겹치는지 보려는 것 — 고침이 아니라 확인용.
   * 정면=빨강 · 좌=초록 · 우=파랑 · 후면=노랑 */
  HP.seams = false;
  var VIEW_RGB = { front: [0.95, 0.25, 0.2], left: [0.2, 0.85, 0.3], right: [0.25, 0.45, 1.0], back: [1.0, 0.85, 0.15] };
  function removeByName(root, name) {
    var o = root && root.getObjectByName(name);
    if (!o) return;
    o.parent.remove(o);
    if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose();
  }
  function showSeams() {
    if (typeof model3D === 'undefined' || !model3D || !model3D.headGroup) return;
    var hair = model3D.headGroup.getObjectByName('adjustedHair');
    removeByName(model3D.headGroup, 'seamView');
    if (hair) hair.visible = !HP.seams;
    if (!HP.seams || !hair || typeof computeAdjustedHair3DStrands !== 'function') return;
    var list = computeAdjustedHair3DStrands();
    if (!list || !list.length) return;
    var P = [], C = [];
    for (var k = 0; k < list.length; k++) {
      var pts = list[k].pts, ang = list[k].srcAngle || (pts && pts[0] && typeof viewOfRoot === 'function' ? viewOfRoot(pts[0]) : 'front');
      var c = VIEW_RGB[ang] || [0.6, 0.6, 0.6];
      if (!pts) continue;
      for (var i = 1; i < pts.length; i++) {
        P.push(pts[i - 1].x, pts[i - 1].y, pts[i - 1].z, pts[i].x, pts[i].y, pts[i].z);
        C.push(c[0], c[1], c[2], c[0], c[1], c[2]);
      }
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
    var o = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true }));
    o.name = 'seamView';
    o.position.copy(hair.position); o.rotation.copy(hair.rotation); o.scale.copy(hair.scale);
    hair.parent.add(o);
  }
  HP.showSeams = showSeams;

  /* 진단: 뿌리 점만 보기 ("Roots") — 갈라진 줄에 뿌리가 없는지(심기 문제), 뿌리는 있는데 가닥이 벌어지는지(흐름 문제) 구분 */
  HP.roots = false;
  function showRoots() {
    if (typeof model3D === 'undefined' || !model3D || !model3D.headGroup) return;
    removeByName(model3D.headGroup, 'rootView');
    var hair = model3D.headGroup.getObjectByName('adjustedHair');
    if (!HP.roots || !hair) return;
    var M = state.hair3Dneutral;
    if (!M || !M.strands) return;
    var P = [];
    for (var k = 0; k < M.strands.length; k++) { var q = M.strands[k].pts && M.strands[k].pts[0]; if (q) P.push(q.x, q.y, q.z); }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    var o = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffe14a, size: 2.5, sizeAttenuation: false, depthTest: true }));
    o.name = 'rootView';
    o.position.copy(hair.position); o.rotation.copy(hair.rotation); o.scale.copy(hair.scale);
    hair.parent.add(o);
    hair.visible = false;
  }
  HP.showRoots = showRoots;


  /* ── 3D 화면 UI: 핀 고르기 + 좌/우 ─────────────────────────────────── */
  function buildUI() {
    var vp = document.getElementById('model3dViewport');
    if (!vp || document.getElementById('hairpinBar')) return;
    var bar = document.createElement('div');
    bar.id = 'hairpinBar';
    bar.style.cssText = 'position:absolute;left:8px;top:60px;z-index:5;display:flex;gap:6px;flex-wrap:wrap;align-items:center;' +
      'font:600 12px/1 system-ui,sans-serif';
    function chip(label, on, fn) {
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = label;
      b.style.cssText = 'padding:7px 10px;border-radius:999px;border:1px solid rgba(0,0,0,.18);cursor:pointer;' +
        (on ? 'background:#D4924A;color:#1b1206;border-color:#D4924A;' : 'background:rgba(20,16,12,.72);color:#f3eadf;');
      b.onclick = fn; return b;
    }
    function render() {
      bar.innerHTML = '';
      var lab = document.createElement('span');
      lab.textContent = 'Hair pin'; lab.style.cssText = 'color:#f3eadf;background:rgba(20,16,12,.72);padding:7px 8px;border-radius:6px;';
      bar.appendChild(lab);
      CATALOG.forEach(function (c) {
        bar.appendChild(chip(c.name, HP.id === c.id, function () { HP.id = c.id; render(); placePin(); }));
      });
      if (HP.id !== 'none') bar.appendChild(chip(HP.side > 0 ? 'Side ◐' : 'Side ◑', false, function () { HP.side = -HP.side; render(); placePin(); }));
      bar.appendChild(chip(HP.seams ? 'Seams ✓' : 'Seams', HP.seams, function () { HP.seams = !HP.seams; render(); showSeams(); }));
      bar.appendChild(chip(HP.roots ? 'Roots ✓' : 'Roots', HP.roots, function () { HP.roots = !HP.roots; render(); showSeams(); showRoots(); }));
    }
    render();
    vp.appendChild(bar);
  }

  // 3D 화면을 만들 때마다(헤드그룹이 비워짐) 다시 붙임
  var setup = G.setupModel3DScreen;
  if (typeof setup === 'function') {
    G.setupModel3DScreen = function () {
      buildUI();
      var r = setup.apply(this, arguments);
      var after = function () {
        try { showSeams(); } catch (e) { console.warn('[경계보기] 실패', e); }
        try { placePin(); } catch (e) { console.warn('[헤어핀] 붙이기 실패', e); }
      };
      if (r && typeof r.then === 'function') r.then(after, after); else after();
      return r;
    };
  }
})();
