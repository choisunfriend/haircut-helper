/* 52-lift-csv.js — lift0(사진에서 3D로 올린 직후 가닥)를 CSV로 내보내기 (2026-11-28)
   ─────────────────────────────────────────────────────────────────
   예전 51(STAGE_TAG/STAGE_DIAG)은 audit·carry·carryList가 매 프레임 돌아 3D가 멈춰서 지웠다.
   여기서는 13c가 이미 부르는 최소 고리만 다시 단다:
     · STAGE_TAG.on / make  — 점마다 "어느 사진·몇 번째 가닥·몇 번째 점" 꼬리표 (문자열 하나)
     · STAGE_TAG.lifted     — 대입될 때마다(첫 lift0 · 카메라 맞춘 뒤 lift0 …) 사본을 쌓음
   audit / carry / carryList 는 <b>일부러 정의하지 않는다</b> → 17b의 단계별 꼬리표 이어받기는 꺼진 채로 둔다(멈춤 원인).

   후보 채점: 쌓인 lift0들 + 다시 기른 가닥(REGROW.model) + 최종 조정 가닥(computeAdjustedHair3DStrands)을
   <b>가장 최근(카메라 맞춘) 사진 카메라</b>에 되쏴서 사진 머리 마스크와 비교한다.
     정밀도 = 되쏜 점 중 마스크 안 비율 · 재현율 = 마스크 칸 중 점이 닿은 비율 · F1 = 둘의 조화평균(사진 평균)
   F1이 제일 높은 후보 = "정답(사진)에 가장 가까운 것".

   좌표: 앱(Y 위, +Z 얼굴 앞) → 블렌더(Z 위, -Y 얼굴 앞), 단위 cm(modelCmPerUnit).
     X_b = x·cm, Y_b = −z·cm, Z_b = y·cm.  블렌더 씬 단위가 m면 임포트 때 0.01 배.
   OBJ로 내보낼 때도 반드시 같은 변환을 써야 점이 겹친다.

   콘솔: LIFT_CSV.score() · LIFT_CSV.download() · LIFT_CSV.on=false(꼬리표·수집 끔)
*/
var STAGE_TAG = (function () {
  'use strict';
  var T = { on: true, lifted: null };
  T.make = function (angle, si, i, fine) { return angle + ':' + si + ':' + i + (fine ? 'f' : ''); };
  return T;
})();

var LIFT_CSV = (function () {
  'use strict';
  var TAG = '[lift0 CSV]';
  var L = { on: true, snaps: [], max: 4, lastScore: null };

  /* 13c 2241줄의 `STAGE_TAG.lifted = …` 대입을 가로채 사본을 쌓는다(카메라·마스크 프로브도 그 시점 것) */
  var _lifted = null;
  Object.defineProperty(STAGE_TAG, 'lifted', {
    configurable: true,
    get: function () { return _lifted; },
    set: function (v) {
      _lifted = v;
      if (!L.on || !v || !v.length) return;
      var occ = null; try { occ = state.hairOcc3D || null; } catch (e) {}
      var vf = false; try { vf = typeof VIEW_FIX !== 'undefined' && VIEW_FIX.on && VIEW_FIX.isDone(); } catch (e) {}
      L.snaps.push({ name: 'lift0#' + (L.snaps.length + 1) + (vf ? '(카메라맞춤)' : ''), strands: v, probe: occ && occ.probe,
                     yTop: occ && occ.yTop, CY: occ && occ.CY, at: Date.now(), camFit: vf });
      if (L.snaps.length > L.max) L.snaps.shift();
      showBtn();
    }
  });
  STAGE_TAG.on = true;
  Object.defineProperty(L, 'on', { get: function () { return STAGE_TAG.on; }, set: function (b) { STAGE_TAG.on = !!b; } });

  function ptsOf(st) { return (st && (st.pts || st.points)) || (Array.isArray(st) ? st : null); }

  function candidates() {
    var out = L.snaps.map(function (s) { return { name: s.name, strands: s.strands, lift: true }; });
    try { if (typeof REGROW !== 'undefined' && REGROW.model && REGROW.model.strands) out.push({ name: 'regrow', strands: REGROW.model.strands }); } catch (e) {}
    try { if (typeof computeAdjustedHair3DStrands === 'function' && state.hair3Dneutral) { var f = computeAdjustedHair3DStrands(); if (f && f.length) out.push({ name: 'final', strands: f }); } } catch (e) { console.warn(TAG + ' final 후보 실패', e); }
    return out;
  }

  /* 채점 기준 카메라 = 가장 최근 lift0 시점 프로브(카메라 맞춘 뒤면 그게 제일 정확) */
  function refProbe() {
    for (var i = L.snaps.length - 1; i >= 0; i--) if (L.snaps[i].probe) return L.snaps[i];
    try { var o = state.hairOcc3D; if (o && o.probe) return { probe: o.probe, yTop: o.yTop, CY: o.CY }; } catch (e) {}
    return null;
  }

  var GW = 96;   // 마스크 비교 격자 가로 칸 수
  function scoreOne(strands, ref) {
    var cams = ref.probe.cams, yTop = ref.yTop, CY = ref.CY, per = [];
    var stride = 1, nPts = 0;
    for (var a = 0; a < strands.length; a++) { var p0 = ptsOf(strands[a]); if (p0) nPts += p0.length; }
    if (nPts > 400000) stride = Math.ceil(nPts / 400000);   // 너무 크면 솎아서(멈춤 방지)
    for (var c = 0; c < cams.length; c++) {
      var C = cams[c], R = C.R; if (!C.iw || !C.ih) continue;
      var GH = Math.max(8, Math.round(GW * C.ih / C.iw)), cell = new Uint8Array(GW * GH), mask = new Uint8Array(GW * GH);
      var inN = 0, allN = 0, k = 0, gx, gy;
      for (gy = 0; gy < GH; gy++) for (gx = 0; gx < GW; gx++) mask[gy * GW + gx] = C.smp.at((gx + 0.5) / GW * C.iw, (gy + 0.5) / GH * C.ih) > 0 ? 1 : 0;
      for (var s = 0; s < strands.length; s++) {
        var P = ptsOf(strands[s]); if (!P) continue;
        for (var j = 0; j < P.length; j++) {
          if ((k++ % stride) !== 0) continue;
          var q = P[j], wy = q.y - CY;
          var lx = R[0] * q.x + R[1] * wy + R[2] * q.z, ly = R[3] * q.x + R[4] * wy + R[5] * q.z;
          var ix = lx / C.s + C.cx, iy = C.crownY + (yTop - (ly + CY)) / C.sy;
          gx = Math.floor(ix / C.iw * GW); gy = Math.floor(iy / C.ih * GH);
          allN++;
          if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) continue;
          var id = gy * GW + gx; cell[id] = 1; if (mask[id]) inN++;
        }
      }
      var mN = 0, hitN = 0;
      for (var m = 0; m < mask.length; m++) if (mask[m]) { mN++; if (cell[m] || (m % GW > 0 && cell[m - 1]) || (m % GW < GW - 1 && cell[m + 1]) || cell[m - GW] || cell[m + GW]) hitN++; }
      var prec = allN ? inN / allN : 0, rec = mN ? hitN / mN : 0;
      per.push({ view: C.angle, prec: prec, rec: rec, f1: (prec + rec) ? 2 * prec * rec / (prec + rec) : 0 });
    }
    var avg = function (key) { return per.length ? per.reduce(function (t, r) { return t + r[key]; }, 0) / per.length : 0; };
    return { prec: avg('prec'), rec: avg('rec'), f1: avg('f1'), per: per, strands: strands.length, pts: nPts };
  }

  L.score = function () {
    var ref = refProbe();
    if (!ref) { console.warn(TAG + ' 사진 마스크 프로브가 없습니다 — 3D를 한 번 만든 뒤 다시'); return null; }
    var rows = candidates().map(function (c) { var r = scoreOne(c.strands, ref); r.name = c.name; r.src = c; return r; });
    rows.sort(function (a, b) { return b.f1 - a.f1; });
    L.lastScore = rows;
    console.table(rows.map(function (r) { return { 후보: r.name, F1: +r.f1.toFixed(4), 정밀도: +r.prec.toFixed(4), 재현율: +r.rec.toFixed(4), 가닥: r.strands, 점: r.pts }; }));
    if (rows.length) console.log(TAG + ' 가장 가까운 후보: ' + rows[0].name);
    return rows;
  };

  function cmPer() { var cm = null; try { cm = modelCmPerUnit(); } catch (e) {} return cm > 0 ? cm : 16.36; }
  function f(v) { return (Math.round(v * 10000) / 10000).toString(); }

  function strandsCsv(name, strands) {
    var cm = cmPer(), out = ['candidate,strand,pt,x_cm,y_cm,z_cm,src_view,src_strand,src_pt'];
    for (var s = 0; s < strands.length; s++) {
      var P = ptsOf(strands[s]); if (!P) continue;
      for (var j = 0; j < P.length; j++) {
        var q = P[j], t = (typeof q.t === 'string') ? q.t.split(':') : null;
        out.push(name + ',' + s + ',' + j + ',' + f(q.x * cm) + ',' + f(-q.z * cm) + ',' + f(q.y * cm) + ','
          + (t ? t[0] + ',' + t[1] + ',' + parseInt(t[2], 10) : ',,'));
      }
    }
    return out.join('\n');
  }

  function scoreCsv(rows) {
    var out = ['rank,candidate,f1,precision,recall,strands,points,view,view_f1,view_precision,view_recall'];
    rows.forEach(function (r, i) {
      r.per.forEach(function (v) {
        out.push((i + 1) + ',' + r.name + ',' + f(r.f1) + ',' + f(r.prec) + ',' + f(r.rec) + ',' + r.strands + ',' + r.pts + ','
          + v.view + ',' + f(v.f1) + ',' + f(v.prec) + ',' + f(v.rec));
      });
    });
    out.push('# 좌표: 블렌더 축(Z 위, -Y 얼굴 앞), 단위 cm, cm/unit=' + f(cmPer()) + ' · 기준 카메라=가장 최근 lift0 시점');
    return out.join('\n');
  }

  function save(name, text) {
    var blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' });   // BOM — 엑셀에서 한글 안 깨지게
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  /* 받기: ① 가장 가까운 후보 점 CSV ② 가장 최근 lift0 CSV(1위가 lift0가 아닐 때) ③ 채점표 CSV */
  L.download = function () {
    var rows = L.score();
    var stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
    if (!rows || !rows.length) {
      if (!L.snaps.length) { alert('저장된 lift0가 없습니다. 3D 결과를 한 번 만든 뒤 눌러 주세요.'); return; }
      var s0 = L.snaps[L.snaps.length - 1]; save('lift0_' + stamp + '.csv', strandsCsv(s0.name, s0.strands)); return;
    }
    var best = rows[0];
    save('best_' + best.name.replace(/[^\w#]/g, '') + '_' + stamp + '.csv', strandsCsv(best.name, best.src.strands));
    var lastLift = L.snaps[L.snaps.length - 1];
    if (lastLift && best.src.strands !== lastLift.strands) setTimeout(function () { save('lift0_' + stamp + '.csv', strandsCsv(lastLift.name, lastLift.strands)); }, 400);
    setTimeout(function () { save('scores_' + stamp + '.csv', scoreCsv(rows)); }, 800);
  };

  var btn = null;
  function showBtn() {
    try {
      if (btn || !document.body) { if (btn) btn.style.display = ''; return; }
      btn = document.createElement('button');
      btn.textContent = '3D 점 CSV';
      btn.title = 'lift0 · 다시 기르기 · 최종 중 사진에 가장 가까운 점 + 채점표 받기';
      btn.style.cssText = 'position:fixed;right:12px;bottom:84px;z-index:9999;padding:8px 12px;border-radius:8px;border:0;background:#2E3A4E;color:#fff;font-size:13px;opacity:.85';
      btn.onclick = function () { btn.disabled = true; btn.textContent = '계산 중…'; setTimeout(function () { try { L.download(); } finally { btn.disabled = false; btn.textContent = '3D 점 CSV'; } }, 30); };
      document.body.appendChild(btn);
    } catch (e) {}
  }

  console.log(TAG + ' 설치 — lift0 대입마다 사본 저장(최대 ' + L.max + ') · LIFT_CSV.score() / LIFT_CSV.download() · 끄기 LIFT_CSV.on=false');
  return L;
})();
