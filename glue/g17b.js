function arcAtY(pts, targetY){
  const X = _gX(); if(!_gOk(X, pts)) return 0;
  _gIn(X, pts); return X.arcAtY(pts.length, targetY);
}
function yAtArc(pts, L){
  const X = _gX(); if(!_gOk(X, pts)) return pts[pts.length-1].y;
  _gIn(X, pts); return X.yAtArc(pts.length, L);
}
function cutRatioForStrand(st, sec, lenVal, fallbackRatio){
  if(!CUT3D.on) return fallbackRatio;
  const g = sectionCutGuide(st.sec, lenVal);
  if(!g) return fallbackRatio;
  const X = _gX(); if(!_gOk(X, st.pts)) return fallbackRatio;
  _gIn(X, st.pts);
  const n = st.pts.length, total = X.arcLen(n);
  if(!(total > 1e-9)) return fallbackRatio;
  const P = new Float64Array(X.memory.buffer, X.cutParamsPtr(), 40);
  let want = sectionLengthRatio(st.sec, lenVal);
  const tech = sec.technique || 'uniform';
  let elevT = (typeof sec.elevation === 'number') ? Math.max(0, Math.min(1, sec.elevation/90)) : 0.5;
  if(tech === 'onelength') elevT = 0;
  let odMul = -1, odAdd = NaN, od = 0;
  if(st.sec === 'temple' && typeof sec.overdirection === 'number' && state.sections.crown){
    od = Math.max(0, Math.min(1, sec.overdirection/100));
    if(od > 0){
      if(CUT3D.odRatioSpace !== false){
        const rT = sectionLengthRatio('temple', lenVal);
        const rC = sectionLengthRatio('crown', state.sections.crown.length);
        if(rT > 1e-6){ const rMix = rT + (rC - rT) * od; odMul = Math.max(0, rMix) / rT; want = Math.max(0, rMix); }
      }else{
        const gc = sectionCutGuide('crown', state.sections.crown.length);
        if(gc) odAdd = gc.Lref;
      }
    }
  }
  const lineOn = typeof sec.line === 'number' && sec.line !== 50 && CUT3D.lineMax > 0
     && (st.sec === 'nape' || st.sec === 'front') && g.xHi > g.xLo;
  const F = state.fade;
  let fadeOn = !!(FADE3D.on && F && F.enabled), cm = 0, dv = null, yLine = NaN;
  if(fadeOn){ cm = modelCmPerUnit(); if(!cm) fadeOn = false; }
  if(fadeOn){ dv = discLineV(); if(dv != null){ const y = headYAt(dv); yLine = (y == null) ? NaN : y; } }
  const gd = fadeOn ? Math.max(0, Math.min(8, (typeof F.guard === 'number' ? F.guard : 1))) : 0;
  P[0] = total; P[1] = (typeof want === 'number') ? want : fallbackRatio; P[2] = fallbackRatio; P[3] = elevT;
  P[4] = g.Yref; P[5] = g.Lref; P[6] = CUT3D.tipUnreachableCut ? 1 : 0; P[7] = CUT3D.techSlope[tech] || 0;
  P[8] = g.yHi; P[9] = g.yLo; P[10] = odMul; P[11] = want;
  P[12] = lineOn ? (sec.line - 50) / 50 : NaN; P[13] = g.xLo; P[14] = g.xHi; P[15] = CUT3D.lineMax;
  P[16] = (typeof sec.texture === 'number') ? sec.texture/100 : 0; P[17] = CUT3D.textureMax;
  P[18] = fadeOn ? 1 : 0; P[19] = cm;
  P[20] = fadeOn ? Math.max(FADE3D.skinCm, gd * FADE3D.guardInchStep) / cm : 0;
  P[21] = dv != null ? 1 : 0; P[22] = yLine; P[23] = DISC3D.minBand;
  P[24] = fadeOn ? Math.max(0, Math.min(1, (typeof F.height === 'number' ? F.height : 35) / 100)) : 0;
  P[25] = fadeOn ? Math.max(FADE3D.minBand, Math.min(1, (typeof F.blendWidth === 'number' ? F.blendWidth : 40) / 100)) : 0;
  P[26] = fadeOn ? Math.max(0, Math.min(1, (typeof F.taper === 'number' ? F.taper : 0) / 100)) : 0;
  P[27] = fadeOn ? FADE3D.skinCm / cm : 0;
  P[28] = CUT3D.minRatio; P[29] = CUT3D.maxRatio; P[30] = odAdd; P[31] = od;
  return X.cutRatio(n);
}
