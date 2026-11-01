// ============================================================================
// 36-erase-strand.js (2026-11-01) — 「쪽집게 / Tweezers」 튀어나온 가닥 뽑기
// ============================================================================
// · 조정 화면(3D) 위쪽 줄(mode-bar)의 빗질 버튼 옆에 버튼 두 개: 「쪽집게」 · 「↶」(되돌리기)
// · 켜면 한 손가락이 쪽집게: 손가락 조금 위(56px)에 쪽집게가 뜨고 그 끝(빨간 점)에 걸린 가닥이 빨갛게 보임
//   → 손을 떼면 그 가닥이 뽑힘 · 두 손가락은 예전처럼 이동·확대 · 마우스는 커서 자리가 끝
// · 뽑은 가닥은 computeAdjustedHair3DStrands 결과에서 빠짐 → 조정 화면 · 3D 결과 화면 모두 반영
// · 가닥 표시: 뿌리 위치(+ 있으면 가닥 해시 h). 사진·3D 머리를 새로 만들면 목록은 비워짐
// · 화면 좌표는 빗질(COMB3D)과 같은 방법: 첫 번째 선(LineSegments) 물체의 matrixWorld 기준
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
    if (m !== E.model) { E.model = m; E.keys.clear(); E.history.length = 0; E.pending = null; sync(); }
  }

  // ---- 계산 결과에서 지운 가닥 빼기 ---------------------------------------------------------
  if (typeof computeAdjustedHair3DStrands === 'function') {
    var _orig = computeAdjustedHair3DStrands;
    computeAdjustedHair3DStrands = function () { // eslint-disable-line no-global-assign
      var out = _orig.apply(this, arguments);
      try {
        if (!E.enabled || !Array.isArray(out)) return out;
        checkModel();
        if (E.pending && E.pending.length && out.length) resolvePending(out);
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

  // 스타일 레시피(37-groom-recipe.js)가 다른 머리에서 옮겨 온 "지운 자리" — 이 머리에서 뿌리가 가장 가까운 가닥을 지움
  E.pending = null;
  function resolvePending(out) {
    var pts = E.pending; E.pending = null;
    var used = new Set();
    for (var i = 0; i < pts.length; i++) {
      var q = pts[i], best = -1, bd = Infinity;
      for (var j = 0; j < out.length; j++) {
        if (used.has(j)) continue;
        var r = out[j].pts && out[j].pts[0]; if (!r) continue;
        var d = (r.x - q.x) * (r.x - q.x) + (r.y - q.y) * (r.y - q.y) + (r.z - q.z) * (r.z - q.z);
        if (d < bd) { bd = d; best = j; }
      }
      if (best < 0) continue;
      used.add(best);
      var k = keysOf(out[best]); if (!k.length) continue;
      k.forEach(function (x) { E.keys.add(x); });
      var r0 = out[best].pts[0];
      E.history.push({ k: k, p: { x: r0.x, y: r0.y, z: r0.z } });
    }
    E.ver++;
    sync();
  }
  // 지금 지운 가닥들의 뿌리 위치(이 머리 좌표) — 스타일 저장 때 씀
  E.exportRoots = function () { checkModel(); return E.history.map(function (h) { return h.p; }).filter(Boolean); };
  // 다른 머리에서 온 뿌리 위치(이미 이 머리 좌표로 바꾼 것)를 다음 계산 때 지우기로 예약
  E.importRoots = function (list) {
    checkModel();
    E.keys.clear(); E.history.length = 0;
    E.pending = (list && list.length) ? list.slice(0, E.maxUndo) : null;
    E.ver++; sync();
  };

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
  // 누른 자리(화면 좌표)에서 가장 가까운 가닥 — strands 를 주면 그걸로(조준하는 동안 한 번 계산한 것 재사용)
  function pick(clientX, clientY, strands) {
    var m = m3(); if (!m) return null;
    if (!strands) { try { strands = computeAdjustedHair3DStrands(); } catch (e) { strands = null; } }
    if (!strands || !strands.length) return null;
    var cam = m.camera, canvas = m.renderer.domElement, rect = canvas.getBoundingClientRect();
    var obj = hairObject(m);
    m.scene.updateMatrixWorld(true); cam.updateMatrixWorld(true);
    var M = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse).multiply(obj.matrixWorld).elements;
    var px = clientX - rect.left, py = clientY - rect.top, lim2 = E.pickPx * E.pickPx;
    var best = null, bestD = Infinity, bestW = Infinity;
    function proj(p) {
      var w = M[3] * p.x + M[7] * p.y + M[11] * p.z + M[15];
      if (!(w > 1e-6)) return null;
      return [((M[0] * p.x + M[4] * p.y + M[8] * p.z + M[12]) / w * 0.5 + 0.5) * rect.width,
              (1 - ((M[1] * p.x + M[5] * p.y + M[9] * p.z + M[13]) / w * 0.5 + 0.5)) * rect.height, w];
    }
    for (var i = 0; i < strands.length; i++) {
      var pts = strands[i].pts; if (!pts || pts.length < 2) continue;
      var a = null;
      for (var j = 0; j < pts.length; j++) {
        var b = proj(pts[j]);
        if (!b) { a = null; continue; }
        if (a) {
          var d = segDist2(px, py, a[0], a[1], b[0], b[1]);
          // 같은 거리면 카메라에 더 가까운(앞에 보이는) 가닥
          if (d <= lim2 && (d < bestD - 4 || (Math.abs(d - bestD) <= 4 && b[2] < bestW))) { best = strands[i]; bestD = d; bestW = b[2]; }
        }
        a = b;
      }
    }
    if (!best) return null;
    var line = [];
    best.pts.forEach(function (p) { var q = proj(p); if (q) line.push([q[0] + rect.left, q[1] + rect.top]); });
    return { s: best, line: line };
  }

  function eraseAt(x, y, strands) {
    checkModel();
    var hit = pick(x, y, strands), s = hit && hit.s;
    if (!s) { toast(L('가닥을 못 찾았어요 — 가닥 위를 정확히 눌러 주세요', 'No strand there — tap right on the strand')); return; }
    var k = keysOf(s); if (!k.length) return;
    k.forEach(function (x) { E.keys.add(x); });
    var r0 = s.pts[0];
    E.history.push({ k: k, p: { x: r0.x, y: r0.y, z: r0.z } });
    if (E.history.length > E.maxUndo) E.history.shift();
    sync(); refresh();
  }

  function undo() {
    var h = E.history.pop();
    if (!h) return;
    h.k.forEach(function (x) { E.keys.delete(x); });
    sync(); refresh();
  }
  function clearAll() { E.keys.clear(); E.history.length = 0; sync(); refresh(); }

  // ---- 버튼 ---------------------------------------------------------------------------------
  var btn = null, undoBtn = null;
  function sync() {
    if (btn) {
      btn.textContent = (E.on ? L('쪽집게 ON', 'Tweezers ON') : L('쪽집게', 'Tweezers'));
      btn.classList.toggle('on', E.on);
      btn.title = L('켜면 한 손가락이 쪽집게가 돼요 — 끝을 가닥에 대고 떼면 뽑힘 · 두 손가락은 이동·확대', 'One finger becomes tweezers — put the tip on a strand and lift to pluck · two fingers move / zoom');
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
      toast(L('쪽집게 끝(빨간 점)을 튀어나온 가닥에 대고 손을 떼면 뽑혀요 · 빨갛게 보이는 가닥이 뽑힐 가닥 · ↶ 되돌리기', 'Put the tweezer tip (red dot) on a stray strand and lift to pluck it · the red strand is the one · ↶ to undo'));
    }
    try { var c = m3() && m3().renderer.domElement; if (c) c.style.cursor = E.on ? 'none' : ''; } catch (e) { /* 무시 */ }
    if (!E.on) { aim = null; hideTweezers(); }
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

  // ---- 쪽집게 — 손가락 조금 위에 쪽집게가 떠 있고, 그 끝에 걸린 가닥이 빨갛게 표시됨 · 손을 떼면 그 가닥을 뽑음 ----
  //   한 손가락 끌기 = 쪽집게 옮기기(회전 대신) · 두 손가락 = 이동·확대(예전처럼) · 마우스는 끝이 바로 커서 자리
  E.touchOffset = 56;   // 손가락보다 이만큼 위가 쪽집게 끝(px) — 손가락에 가려 안 보이는 것 방지
  var TWEEZ_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">' +
    '<g fill="none" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M40 4 L6 36 M40 4 L10 40" stroke="#1b1816" stroke-width="5"/>' +
    '<path d="M40 4 L6 36 M40 4 L10 40" stroke="#c98b52" stroke-width="3"/>' +
    '<circle cx="4.5" cy="39.5" r="2.6" fill="#e0453a" stroke="#fff" stroke-width="1"/></g></svg>';
  var tw = null, hl = null, aim = null, lastPick = 0;
  function ensureOverlay() {
    if (!tw) {
      tw = document.createElement('div');
      tw.id = 'eraseTweezers';
      tw.style.cssText = 'position:fixed;left:0;top:0;width:44px;height:44px;pointer-events:none;z-index:60;display:none;' +
        'transform-origin:4.5px 39.5px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.4));';
      tw.innerHTML = TWEEZ_SVG;
      document.body.appendChild(tw);
    }
    if (!hl) {
      hl = document.createElement('canvas');
      hl.id = 'eraseHighlight';
      hl.style.cssText = 'position:fixed;left:0;top:0;pointer-events:none;z-index:59;display:none;';
      document.body.appendChild(hl);
    }
  }
  function placeTweezers(x, y) {     // (x,y) = 쪽집게 끝(빨간 점) 자리
    ensureOverlay();
    tw.style.display = 'block';
    tw.style.left = (x - 4.5) + 'px';
    tw.style.top = (y - 39.5) + 'px';
  }
  function hideTweezers() { if (tw) tw.style.display = 'none'; drawLine(null); }
  function drawLine(line) {
    ensureOverlay();
    if (!line || line.length < 2) { hl.style.display = 'none'; return; }
    var dpr = window.devicePixelRatio || 1, W = window.innerWidth, H = window.innerHeight;
    if (hl.width !== Math.round(W * dpr) || hl.height !== Math.round(H * dpr)) {
      hl.width = Math.round(W * dpr); hl.height = Math.round(H * dpr); hl.style.width = W + 'px'; hl.style.height = H + 'px';
    }
    var g = hl.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    g.lineJoin = 'round'; g.lineCap = 'round';
    g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 4;
    g.beginPath(); line.forEach(function (p, i) { if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }); g.stroke();
    g.strokeStyle = '#e0453a'; g.lineWidth = 2;
    g.stroke();
    hl.style.display = 'block';
  }
  function tipOf(e) {
    var off = e.pointerType === 'mouse' ? 0 : E.touchOffset;
    return { x: e.clientX, y: e.clientY - off };
  }
  function aimAt(tip, force) {
    var t = Date.now();
    placeTweezers(tip.x, tip.y);
    if (!force && t - lastPick < 70) return;
    lastPick = t;
    var hit = aim ? pick(tip.x, tip.y, aim.strands) : pick(tip.x, tip.y);
    if (aim) aim.hit = hit;
    drawLine(hit && hit.line);
  }
  function onCanvas(e) { var m = m3(); return !!(m && e.target === m.renderer.domElement); }
  function active() { return E.enabled && E.on && scr() === 'adjust'; }
  var replaying = false;

  document.addEventListener('pointerdown', function (e) {
    if (replaying || !active() || !onCanvas(e)) return;
    if (aim) {
      // 두 번째 손가락 → 조준을 그만두고 두 손가락 이동·확대가 되도록 첫 손가락 누름을 다시 넘겨줌
      var first = aim; aim = null; hideTweezers();
      try {
        replaying = true;
        e.target.dispatchEvent(new PointerEvent('pointerdown', { pointerId: first.id, clientX: first.x, clientY: first.y, bubbles: true, isPrimary: true, button: 0, pointerType: first.type || 'touch' }));
      } catch (er) { /* 무시 */ } finally { replaying = false; }
      return;
    }
    if (e.button !== 0) return;
    e.stopPropagation(); e.preventDefault();         // 한 손가락은 회전 대신 쪽집게
    checkModel();
    var strands = null;
    try { strands = computeAdjustedHair3DStrands(); } catch (er) { strands = null; }
    aim = { id: e.pointerId, x: e.clientX, y: e.clientY, type: e.pointerType, strands: strands, hit: null };
    aimAt(tipOf(e), true);
  }, true);
  document.addEventListener('pointermove', function (e) {
    if (!active()) { if (tw && tw.style.display !== 'none') hideTweezers(); return; }
    if (aim && e.pointerId === aim.id) {
      e.stopPropagation(); e.preventDefault();
      aim.x = e.clientX; aim.y = e.clientY;
      aimAt(tipOf(e));
      return;
    }
    // 마우스는 누르지 않아도 쪽집게가 따라다님
    if (!aim && e.pointerType === 'mouse' && onCanvas(e)) aimAt(tipOf(e));
    else if (!aim && e.pointerType === 'mouse' && tw && tw.style.display !== 'none') hideTweezers();
  }, true);
  function finish(e, cancel) {
    if (!aim || e.pointerId !== aim.id) return;
    e.stopPropagation();
    var a = aim; aim = null;
    if (!cancel) {
      aimAt(tipOf(e), true);                          // 뗀 자리에서 마지막으로 한 번 더 잼
      var hit = pick(tipOf(e).x, tipOf(e).y, a.strands);
      if (hit) pluck(hit.s);
      else toast(L('쪽집게 끝(빨간 점)을 가닥에 대 주세요', 'Put the tweezer tip (red dot) on a strand'));
    }
    if (e.pointerType !== 'mouse') hideTweezers(); else drawLine(null);
  }
  window.addEventListener('pointerup', function (e) { finish(e, false); }, true);
  window.addEventListener('pointercancel', function (e) { finish(e, true); }, true);

  function pluck(s) {
    var k = keysOf(s); if (!k.length) return;
    k.forEach(function (x) { E.keys.add(x); });
    var r0 = s.pts[0];
    E.history.push({ k: k, p: { x: r0.x, y: r0.y, z: r0.z } });
    if (E.history.length > E.maxUndo) E.history.shift();
    sync(); refresh();
  }

  document.addEventListener('click', function (e) {
    if (e.target && e.target.closest && e.target.closest('#langToggle')) setTimeout(sync, 0);
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountButtons); else mountButtons();

  E.toggle = toggle; E.undo = undo; E.clear = clearAll; E.eraseAt = eraseAt; E.pluck = pluck;
  return E;
})();
