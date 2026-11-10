// ============================================================================
// 42-sil-length.js (2026-11-10) — 짧은 머리 가닥 끝: 사진 실루엣에서 잰 길이로 자름
// ============================================================================
// 사용자: "결은 앞뒤가 없는 선이라 가닥이 어디서 끝나는지 정보가 없어요 → 이걸 중력을 쓰든 뭘 쓰든 끝을 맞춰야지… 중요한 정보인데"
//         "앱이 이미 재고 있는 값 — 이거는 정확할까? 끝 자체를 결 읽기 단계에서 찾는 방법은?"
// 왜: 짧은 머리는 짧은 머리카락 수천 가닥이 겹쳐 이어진 흐름 무늬로 보여서, 사진 가닥 긋기가 그 흐름을 따라 두상을 돌아 계속 감.
//   잰 값(실사 360 짧은 남자 머리 · 디버그 1225/1301): 사진 가닥 길이 중앙 6cm(p90 14) · 다시 기른 가닥 6.5cm(p90 17) — 실제 머리 1~3cm.
//   폰 해상도에서 한 올의 끝은 안 보임 → 끝이 보이는 곳은 실루엣(머리 테두리)뿐.
// 재는 법(사진에서 바로 — 두께 어림 아님):
//   ① 사진마다 두피 타원의 테두리(시선에 수직인 두피 점)를 비춤 · 귀 높이 위만
//   ② 그 점에서 사진 바깥쪽(두피 법선 방향)으로 머리 영역이 끝나는 데까지 = 머리가 두피 위로 솟은 높이 h
//   ③ 그 띠 가운데의 사진 결과 두피 법선 사이 각 → 결이 두피와 이루는 각 α (머리가 누울수록 작음)
//   ④ 길이 L = h ÷ sin α (sin α는 minSin 아래로 안 내림 — 거의 누운 자리에서 길이가 터지지 않게)
//   ⑤ 다시 기른 가닥마다 뿌리에서 radDeg 안의 실루엣 표본 L의 pct(중앙값) × slack(1.3)을 상한으로, 넘는 부분만 자름 · 둘레 표본이 없으면 전체 표본 값
//      (75% 값은 거의 누운 자리(sin α < 0.3)의 큰 값에 끌려 상한이 13cm까지 감 — 디버그 1301에서 중앙값으로 바꿈)
// 짧은 머리(다시 기르기가 "짧은 머리"로 본 경우)만 — 긴 머리는 실루엣 끝이 머리끝이 아님(테두리 아래로 계속 흘러내림).
// 끄기 SIL_LEN.on=false (다음 다시 기르기부터) · 값 SIL_LEN.pct / .slack / .radDeg / .minSin · 상태 SIL_LEN.lines().join("\n")
// ============================================================================
var SIL_LEN = (function () {
  'use strict';
  var W = window, TAG = '[실루엣 길이]';
  var S = Object.assign({ on: true, pct: 0.5, slack: 1.3, fallback: true, radDeg: 35, minN: 6, minSin: 0.25, minCoh: 0.3, rimEps: 0.06, nU: 90, nV: 180, longToo: false, stat: null }, W.SIL_LEN || {});

  function quant(a, q) { if (!a.length) return NaN; var b = a.slice().sort(function (x, y) { return x - y; }); return b[Math.min(b.length - 1, Math.max(0, Math.floor(q * (b.length - 1) + 0.5)))]; }

  /* 사진 실루엣에서 길이 표본 — cams: PHOTO_CHECK._cams() 모양({R,s,sy,cx,crownY,iw,ih,smp.at,dirAt,angle}) · E: 두피 타원 {a,b,c} · CY,yTop · cm(모델 1단위 cm) */
  S.measure = function (cams, E, CY, yTop, cm) {
    var out = [], per = {}, iu, iv, ci;
    for (ci = 0; ci < cams.length; ci++) {
      var cam = cams[ci]; if (!cam || typeof cam.dirAt !== 'function' || !cam.smp) continue;
      var R = cam.R, vx = R[6], vy = R[7], vz = R[8], nOK = 0, hs = [], Ls = [];
      var pr = function (x, y, z) { return [(R[0] * x + R[1] * (y - CY) + R[2] * z) / cam.s + cam.cx, cam.crownY + (yTop - ((R[3] * x + R[4] * (y - CY) + R[5] * z) + CY)) / cam.sy]; };
      for (iu = 1; iu < S.nU; iu++) for (iv = 0; iv < S.nV; iv++) {
        var u = Math.PI * iu / S.nU, v = 2 * Math.PI * iv / S.nV - Math.PI;
        var px = E.a * Math.sin(u) * Math.cos(v), py = E.b * Math.cos(u) + CY, pz = E.c * Math.sin(u) * Math.sin(v);
        if (py < CY) continue;                                                       // 귀 높이 위만
        var nx = px / (E.a * E.a), ny = (py - CY) / (E.b * E.b), nz = pz / (E.c * E.c), nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
        if (Math.abs(nx * vx + ny * vy + nz * vz) > S.rimEps) continue;             // 시선에 수직인 두피 점 = 이 사진의 두피 테두리
        var q = pr(px, py, pz), q2 = pr(px + nx * 0.02, py + ny * 0.02, pz + nz * 0.02);
        var dx = q2[0] - q[0], dy = q2[1] - q[1], dl = Math.hypot(dx, dy); if (!(dl > 1e-6)) continue; dx /= dl; dy /= dl;   // 사진 위 바깥 방향(px · y 아래)
        if (q[0] < 0 || q[1] < 0 || q[0] >= cam.iw || q[1] >= cam.ih) continue;
        if (!(cam.smp.at(q[0], q[1]) > 0)) continue;                                  // 두피 테두리가 머리 위에 있어야(머리가 덮음)
        var d = 0, miss = 0, last = 0, maxD = Math.min(cam.iw, cam.ih) * 0.25;
        while (d < maxD) { d += 1; var ix = q[0] + dx * d, iy = q[1] + dy * d; if (ix < 0 || iy < 0 || ix >= cam.iw || iy >= cam.ih) break; if (cam.smp.at(ix, iy) > 0) { last = d; miss = 0; } else if (++miss >= 2) break; }
        if (!(last >= 1)) continue;
        var h = last * cam.s * cm;                                                    // cm
        var md = cam.dirAt(q[0] + dx * last * 0.5, q[1] + dy * last * 0.5); if (!md || !(md[1] >= S.minCoh)) continue;
        var phi = Math.atan2(-dy, dx), sinA = Math.abs(Math.cos(md[0] - phi));     // 결(화면 오른쪽 0 · 위 +)과 두피 법선 사이 — 결이 두피와 이루는 각의 sin
        var L = h / Math.max(S.minSin, sinA);
        var ux = px / E.a, uy = (py - CY) / E.b, uz = pz / E.c, ul = Math.hypot(ux, uy, uz);
        out.push({ u: [ux / ul, uy / ul, uz / ul], L: L, h: h, sin: sinA, view: cam.angle }); nOK++; hs.push(h); Ls.push(L);
      }
      per[cam.angle] = { n: nOK, h: quant(hs, 0.5), L: quant(Ls, 0.5), L75: quant(Ls, 0.75) };
    }
    return { pts: out, per: per };
  };

  /* 다시 기른 가닥 자르기 — model.strands[i].pts[0] = 뿌리 */
  S.apply = function (model, photo, isLong) {
    var st = { on: !!S.on, skip: '', n: 0, cut: 0, cutCm: 0, noSample: 0, per: null, capMed: NaN, ms: 0 };
    S.stat = st;
    if (!S.on) { st.skip = '꺼짐'; return st; }
    if (isLong && !S.longToo) { st.skip = '긴 머리 — 실루엣 끝이 머리끝이 아님'; return st; }
    var t0 = Date.now();
    var PC = W.PHOTO_CHECK, E = (typeof getScalpEllipsoid === 'function') ? getScalpEllipsoid() : null, cm = 0;
    try { cm = modelCmPerUnit(); } catch (e) {}
    if (!PC || typeof PC._cams !== 'function' || !E || !(E.a > 0) || !photo || !isFinite(photo.CY) || !isFinite(photo.yTop) || !(cm > 0)) { st.skip = '사진·두상 값 없음'; return st; }
    var cams = PC._cams(), M = S.measure(cams, E, photo.CY, photo.yTop, cm), P = M.pts; st.per = M.per; st.samples = P.length;
    if (P.length < S.minN) { st.skip = '실루엣 표본 ' + P.length + '개'; return st; }
    var gCap = quant(P.map(function (o) { return o.L; }), S.pct) * S.slack / cm;
    var cosR = Math.cos(S.radDeg * Math.PI / 180), caps = [], list = model && model.strands || [], i, k;
    for (i = 0; i < list.length; i++) {
      var sd = list[i], p = sd && sd.pts; if (!p || p.length < 2) continue; st.n++;
      var r = p[0], ux = r.x / E.a, uy = (r.y - photo.CY) / E.b, uz = r.z / E.c, ul = Math.hypot(ux, uy, uz) || 1; ux /= ul; uy /= ul; uz /= ul;
      var Ls = []; for (k = 0; k < P.length; k++) { var w = P[k].u; if (w[0] * ux + w[1] * uy + w[2] * uz >= cosR) Ls.push(P[k].L); }
      var cap;
      if (Ls.length < S.minN) { st.noSample++; if (!S.fallback) continue; cap = gCap; st.fallbackN = (st.fallbackN || 0) + 1; }   // 둘레에 실루엣 표본이 없는 뿌리(귀 아래·뒷목) — 이 사진들 전체 표본 값
      else cap = quant(Ls, S.pct) * S.slack / cm;
      caps.push(cap * cm);
      var acc = 0, j;
      for (j = 1; j < p.length; j++) {
        var sl = Math.hypot(p[j].x - p[j - 1].x, p[j].y - p[j - 1].y, p[j].z - p[j - 1].z);
        if (acc + sl > cap) break; acc += sl;
      }
      if (j < p.length) {
        var tot = acc; for (k = j; k < p.length; k++) tot += Math.hypot(p[k].x - p[k - 1].x, p[k].y - p[k - 1].y, p[k].z - p[k - 1].z);
        var a0 = p[j - 1], a1 = p[j], sl2 = Math.hypot(a1.x - a0.x, a1.y - a0.y, a1.z - a0.z), f = sl2 > 1e-9 ? (cap - acc) / sl2 : 0;
        var tip = Object.assign({}, a1, { x: a0.x + (a1.x - a0.x) * f, y: a0.y + (a1.y - a0.y) * f, z: a0.z + (a1.z - a0.z) * f });
        var n0 = p.length, np = p.slice(0, j); np.push(tip);
        Object.keys(sd).forEach(function (key) { var v = sd[key]; if (key !== 'pts' && Array.isArray(v) && v.length === n0) { var nv = v.slice(0, j); nv.push(v[j]); sd[key] = nv; } });
        sd.pts = np; st.cut++; st.cutCm += (tot - cap) * cm;
      }
    }
    st.capMed = quant(caps, 0.5); st.capP90 = quant(caps, 0.9); st.ms = Date.now() - t0;
    console.log(S.lines().join('\n'));
    return st;
  };

  S.lines = function () {
    var st = S.stat; if (!st) return [TAG + ' 아직 안 함'];
    if (st.skip) return [TAG + ' 안 함 — ' + st.skip + ' (끄기 SIL_LEN.on=false)'];
    var per = st.per ? Object.keys(st.per).map(function (k) { var q = st.per[k]; return k + ' ' + q.n + '점 · 솟은 높이 ' + (isFinite(q.h) ? q.h.toFixed(1) : '-') + ' · 길이 ' + (isFinite(q.L) ? q.L.toFixed(1) : '-') + '/' + (isFinite(q.L75) ? q.L75.toFixed(1) : '-'); }).join(' | ') : '';
    return [TAG + ' 짧은 머리 — 사진 실루엣에서 잰 길이(두피 위 솟은 높이 ÷ 결이 두피와 이루는 각의 sin)로 가닥 끝을 정함 · 뿌리 ' + S.radDeg + '° 안 표본의 ' + Math.round(S.pct * 100) + '% 값 × ' + S.slack,
      '  가닥 ' + st.n + ' 중 자른 ' + st.cut + '(평균 ' + (st.cut ? (st.cutCm / st.cut).toFixed(1) : '0') + 'cm 덜어냄) · 둘레 표본 없어 ' + (S.fallback ? '전체 표본 값을 쓴 ' + (st.fallbackN || 0) : '그대로 둔 ' + st.noSample) + ' · 상한 중앙 ' + (isFinite(st.capMed) ? st.capMed.toFixed(1) : '-') + 'cm(p90 ' + (isFinite(st.capP90) ? st.capP90.toFixed(1) : '-') + ') · 표본 ' + st.samples + ' · ' + st.ms + 'ms',
      '  사진별(점 · 높이 cm · 길이 중앙/75% cm): ' + per + ' (끄기 SIL_LEN.on=false · 값 SIL_LEN.pct/.slack/.radDeg/.minSin)'];
  };
  try { console.log(TAG + ' 설치 — 짧은 머리 가닥 끝을 사진 실루엣에서 잰 길이로 정함 · 끄기 SIL_LEN.on=false · 상태 SIL_LEN.lines().join("\\n")'); } catch (e) {}
  return S;
})();
