// ============================================================================
// 36-erase-strand.js (2026-11-01) — 「가닥 지우기 / Erase strand」
// ============================================================================
// · 조정 화면(3D) 위쪽 줄(mode-bar)의 빗질 버튼 옆에 버튼 두 개: 「가닥 지우기」 · 「↶」(되돌리기)
// · 켜고 튀어나온 가닥을 톡 누르면 그 가닥이 사라짐 (끌면 예전처럼 회전 — 누르기만 지움)
// · 지운 가닥은 computeAdjustedHair3DStrands 결과에서 빠짐 → 조정 화면 · 3D 결과 화면 모두 반영
// · 가닥 표시: 뿌리 위치(+ 있으면 가닥 해시 h). 사진·3D 머리를 새로 만들면 지운 목록은 비워짐
// · 빗질(COMB3D)과 같은 방법으로 화면 좌표를 구함: 첫 번째 선(LineSegments) 물체의 matrixWorld 기준
// · 끄기: ERASE_STRAND.enabled = false
// ============================================================================
var ERASE_STRAND = (function () {
  'use strict';
  var E = { enabled: true, on: false, pickPx: 22, tapMovePx: 8, maxUndo: 200, keys: new Set(), history: [], model: null };

  function L(ko, en) { try { return typeof uiLang !== 'undefined' && uiLang === 'en' ? en : ko; } catch (e) { return ko; } }
  function toast(t) { try { if (typeof showToast === 'function') showToast(t); } catch (e) { /* 무시 */ } }
  function scr() { try { return currentScreen; } catch (e) { return ''; } }
  function m3() { try { return model3D && model3D.initialized ? model3D : null; } catch (e) { return null; } }

  // 가닥을 알아보는 열쇠 — 뿌리 점(빗질은 뿌리를 안 움직임) · 해시가 있으면 그것도
  function rootKey(s) {
    var p = s && s.pts && s.pts[0];
    if (!p) return null;
    return 'r' + Math.round(p.x * 1e4) + ',' + Math.round(p.y * 1e4) + ',' + Math.round(p.z * 1e4);
  }
  function keysOf(s) {
    var k = [], r = rootKey(s);
    if (r) k.push(r);
    if (typeof s.h === 'number') k.push('h' + s.h);
    return k;
  }
  function erased(s) {
    if (!E.keys.size) return false;
    var k = keysOf(s);
    for (var i = 0; i < k.length; i++) if (E.keys.has(k[i])) return true;
    return false;
  }
  // 3D 머리를 새로 만들면(새 사진 등) 지운 목록이 다른 머리에 걸리지 않게 비움
  function checkModel() {
    var m = null;
    try { m = state._hair3Dneutral || null; } catch (e) { m = null; }
    if (m !== E.model) { E.model = m; E.keys.clear(); E.history.length = 0; sync(); }
  }

  // ---- 계산 결과에서 지운 가닥 빼기 ---------------------------------------------------------
  if (typeof computeAdjustedHair3DStrands === 'function') {
    var _orig = computeAdjustedHair3DStrands;
    computeAdjustedHair3DStrands = function () { // eslint-disable-line no-global-assign
      var out = _orig.apply(this, arguments);
      try {
        if (!E.enabled || !Array.isArray(out)) return out;
        checkModel();
        if (!E.keys.size) return out;
        return out.filter(function (s) { return !erased(s); });
      } catch (e) { return out; }
    };
  }

  // 미리 만들어 둔 3D 헤어(폰 다이어트 MOBILE_DIET 의 서명 캐시)가 지우기 전 머리를 다시 쓰지 않게
  // 서명(adjFilterSig)에 지우기 판 번호를 붙임
  E.ver = 0;
  if (typeof adjFilterSig === 'function') {
    var _sig = adjFilterSig;
    adjFilterSig = function () { // eslint-disable-line no-global-assign
      var s = _sig.apply(this, arguments);
      return E.keys.size ? s + '|er' + E.ver : s;
    };
  }

  function refresh() {
    E.ver++;
    try { if (typeof ADJUST3D !== 'undefined' && ADJUST3D.on && scr() === 'adjust') ADJUST3D.refresh(); } catch (e) { /* 무시 */ }
    try { if (typeof combRefresh === 'function') combRefresh(); } catch (e) { /* 무시 */ }
    try { if (scr() === 'model3d' && typeof setupModel3DScreen === 'function') setupModel3DScreen(); } catch (e) { /* 무시 */ }
  }

  // ---- 누른 자리에서 가장 가까운 가닥 찾기 --------------------------------------------------
  function hairObject(m) {
    var found = null;
    m.headGroup.traverse(function (o) { if (!found && (o.isLineSegments || o.isLine) && o.geometry) found = o; });
    return found || m.headGroup;
  }
  function segDist2(px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy, t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    var qx = ax + t * dx - px, qy = ay + t * dy - py;
    return qx * qx + qy * qy;
  }
  function pick(clientX, clientY) {
    var m = m3(); if (!m) return null;
    var strands = null;
    try { strands = computeAdjustedHair3DStrands(); } catch (e) { strands = null; }
    if (!strands || !strands.length) return null;
    var cam = m.camera, canvas = m.renderer.domElement, rect = canvas.getBoundingClientRect();
    var obj = hairObject(m);
    m.scene.updateMatrixWorld(true); cam.updateMatrixWorld(true);
    var M = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse).multiply(obj.matrixWorld).elements;
    var px = clientX - rect.left, py = clientY - rect.top, lim2 = E.pickPx * E.pickPx;
    var best = null, bestD = Infinity, bestW = Infinity;
    for (var i = 0; i < strands.length; i++) {
      var pts = strands[i].pts; if (!pts || pts.length < 2) continue;
      var ax = null, ay = null;
      for (var j = 0; j < pts.length; j++) {
        var p = pts[j], w = M[3] * p.x + M[7] * p.y + M[11] * p.z + M[15];
        if (!(w > 1e-6)) { ax = null; continue; }
        var sx = ((M[0] * p.x + M[4] * p.y + M[8] * p.z + M[12]) / w * 0.5 + 0.5) * rect.width;
        var sy = (1 - ((M[1] * p.x + M[5] * p.y + M[9] * p.z + M[13]) / w * 0.5 + 0.5)) * rect.height;
        if (ax !== null) {
          var d = segDist2(px, py, ax, ay, sx, sy);
          // 같은 거리면 카메라에 더 가까운(앞에 보이는) 가닥
          if (d <= lim2 && (d < bestD - 4 || (Math.abs(d - bestD) <= 4 && w < bestW))) { best = strands[i]; bestD = d; bestW = w; }
        }
        ax = sx; ay = sy;
      }
    }
    return best;
  }

  function eraseAt(x, y) {
    checkModel();
    var s = pick(x, y);
    if (!s) { toast(L('가닥을 못 찾았어요 — 가닥 위를 정확히 눌러 주세요', 'No strand there — tap right on the strand')); return; }
    var k = keysOf(s); if (!k.length) return;
    k.forEach(function (x) { E.keys.add(x); });
    E.history.push(k);
    if (E.history.length > E.maxUndo) E.history.shift();
    sync(); refresh();
  }

  function undo() {
    var k = E.history.pop();
    if (!k) return;
    k.forEach(function (x) { E.keys.delete(x); });
    sync(); refresh();
  }
  function clearAll() { E.keys.clear(); E.history.length = 0; sync(); refresh(); }

  // ---- 버튼 ---------------------------------------------------------------------------------
  var btn = null, undoBtn = null;
  function sync() {
    if (btn) {
      btn.textContent = (E.on ? L('가닥 지우기 ON', 'Erase strand ON') : L('가닥 지우기', 'Erase strand'));
      btn.classList.toggle('on', E.on);
      btn.title = L('켜고 튀어나온 가닥을 누르면 사라져요 · 끌면 회전', 'Turn on, then tap a stray strand to remove it · drag still rotates');
    }
    if (undoBtn) {
      undoBtn.disabled = !E.history.length;
      undoBtn.textContent = '↶' + (E.history.length ? ' ' + E.history.length : '');
      undoBtn.title = L('지운 가닥 되살리기', 'Bring back the last erased strand');
    }
  }
  function toggle(v) {
    E.on = v == null ? !E.on : !!v;
    if (E.on) {
      try { if (typeof COMB3D !== 'undefined' && COMB3D.on) COMB3D.toggle(false); } catch (e) { /* 무시 */ }
      toast(L('튀어나온 가닥을 톡 눌러 지우세요 · ↶ 되돌리기', 'Tap a stray strand to erase it · ↶ to undo'));
    }
    try { var c = m3() && m3().renderer.domElement; if (c) c.style.cursor = E.on ? 'cell' : ''; } catch (e) { /* 무시 */ }
    sync();
  }
  function mountButtons() {
    var bar = document.querySelector('#screen-adjust .mode-bar');
    if (!bar || document.getElementById('eraseStrandBtn')) return;
    var ref = document.getElementById('mannequinBtn');
    btn = document.createElement('button');
    btn.id = 'eraseStrandBtn'; btn.type = 'button';
    if (ref && ref.className) btn.className = ref.className;
    btn.addEventListener('click', function () { toggle(); });
    undoBtn = document.createElement('button');
    undoBtn.id = 'eraseStrandUndoBtn'; undoBtn.type = 'button';
    if (ref && ref.className) undoBtn.className = ref.className;
    undoBtn.addEventListener('click', undo);
    // 빗질 버튼들 바로 뒤에
    var after = document.getElementById('comb3dUndoBtn') || document.getElementById('comb3dBtn');
    if (after && after.parentNode === bar) { bar.insertBefore(undoBtn, after.nextSibling); bar.insertBefore(btn, undoBtn); }
    else { bar.appendChild(btn); bar.appendChild(undoBtn); }
    // 버튼 누르기가 3D 회전으로 새지 않게
    ['pointerdown', 'touchstart', 'mousedown'].forEach(function (t) {
      btn.addEventListener(t, function (e) { e.stopPropagation(); });
      undoBtn.addEventListener(t, function (e) { e.stopPropagation(); });
    });
    sync();
  }

  // ---- 누르기(탭) 감지 — 끌면 회전, 제자리에서 떼면 지우기 --------------------------------
  var down = null;
  document.addEventListener('pointerdown', function (e) {
    if (!E.enabled || !E.on || scr() !== 'adjust') return;
    var m = m3(); if (!m || e.target !== m.renderer.domElement) return;
    if (down) { down = null; return; }            // 두 번째 손가락 = 이동·확대
    down = { id: e.pointerId, x: e.clientX, y: e.clientY };
  }, true);
  window.addEventListener('pointerup', function (e) {
    if (!down || e.pointerId !== down.id) return;
    var d = down; down = null;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > E.tapMovePx) return;   // 끈 것 = 회전
    eraseAt(d.x, d.y);
  }, true);
  window.addEventListener('pointercancel', function () { down = null; }, true);
  document.addEventListener('click', function (e) {
    if (e.target && e.target.closest && e.target.closest('#langToggle')) setTimeout(sync, 0);
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountButtons); else mountButtons();

  E.toggle = toggle; E.undo = undo; E.clear = clearAll; E.eraseAt = eraseAt;
  return E;
})();
