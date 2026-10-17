function _gX(){ const C = window.__SPCORE; return C && C.ready ? C.x : null; }
function _gIn(X, pts){
  const n = pts.length, B = new Float64Array(X.memory.buffer, X.geomInPtr(), n * 3);
  for(let i=0, o=0; i<n; i++, o+=3){ const p = pts[i]; B[o] = p.x; B[o+1] = p.y; B[o+2] = p.z; }
}
function _gOut(X, m, from, out){
  const B = new Float64Array(X.memory.buffer, X.geomOutPtr(), m * 3);
  for(let i=from, o=from*3; i<m; i++, o+=3) out.push({ x:B[o], y:B[o+1], z:B[o+2] });
  return out;
}
function _gOk(X, pts){ return X && pts.length <= X.geomMax(); }

function straightenStrand3D(pts, k){
  if(!(k > 0) || !pts || pts.length < 3) return pts;
  const X = _gX(); if(!_gOk(X, pts)) return pts;
  const n = pts.length;
  const passes = Math.max(1, Math.round(BASE_RESET.passes * Math.min(1, k)));
  const lam = BASE_RESET.lambda * Math.min(1, k);
  _gIn(X, pts);
  return _gOut(X, X.straighten(n, passes, lam), 0, []);
}

function curlStrand3D(pts, curlAmt, waveT, curlDir){
  if(!pts || pts.length < 3 || !(curlAmt > 0)) return pts;
  const X = _gX(); if(!_gOk(X, pts)) return pts;
  const R = curlRodRadius(waveT);
  const tight = Math.pow(Math.max(0, Math.min(100, curlAmt)) / 100, CURL3D_FIX.ampGamma);
  const A = R * Math.pow(tight, CURL3D_FIX.radiusGamma);
  _gIn(X, pts);
  if(!CURL3D_FIX.spine){
    const arc = X.arcLen(pts.length);
    if(arc < 1e-5) return pts;
    const b = R * (2.6 - 2.28 * tight);
    const perRad = Math.sqrt(A*A + b*b) || 1e-4;
    const thetaMax = arc / perRad, turns = thetaMax / (2*Math.PI);
    const M = Math.max(pts.length, Math.min(400, Math.ceil(turns * 12) + 2));
    const root = pts[0];
    const core = _v3norm(_v3sub(pts[pts.length-1], root));
    let up = {x:0,y:1,z:0};
    if(Math.abs(core.y) > 0.94) up = {x:1,y:0,z:0};
    const u0 = _v3norm(_v3cross(core, up)), v0 = _v3norm(_v3cross(core, u0));
    const out0 = [root];
    for(let i=1;i<=M;i++){
      const theta = thetaMax * (i/M), env = Math.min(1, i/(M*0.12 + 1e-6));
      const base = _v3add(root, _v3scale(core, b*theta));
      out0.push(_v3add(base, _v3add(_v3scale(u0, Math.cos(theta)*A*env), _v3scale(v0, Math.sin(theta)*A*env))));
    }
    return out0;
  }
  const m = X.curlSpine(pts.length, R, A, tight, curlDir || 0);
  if(m < 0) return pts;
  return _gOut(X, m, 1, [pts[0]]);
}

function gravityDroop3D(pts, curlAmt){
  if(!pts || pts.length < 3) return pts;
  const X = _gX(); if(!_gOk(X, pts)) return pts;
  const curlT = Math.max(0, Math.min(100, curlAmt))/100;
  const hold = 1 - 0.6 * curlT;
  const amt = (CURL3D_FIX.droopWithCurl ? curlT * hold : hold)
            * Math.max(0, 1 - (typeof GRAV3D !== 'undefined' ? GRAV3D.curlK : 0) * curlT);
  _gIn(X, pts);
  if(X.arcLen(pts.length) < 1e-5 || !(amt > 0)) return pts;
  return _gOut(X, X.droop(pts.length, amt, GRAV3D_STRENGTH), 1, [pts[0]]);
}

function volumeStrand3D(pts, volumeVal, sec){
  if(!pts || pts.length < 2) return pts;
  const lift = volumeLiftHead(pts[0], volumeVal);
  if(!lift) return pts;
  let k = 1;
  if(sec && VOLUME3D.secK && typeof VOLUME3D.secK[sec] === 'number') k *= VOLUME3D.secK[sec];
  if(VOLUME3D.noise > 0){
    const cell = (VOLUME3D.cellCm || 1.5) / _volCmPerUnit(), r = pts[0];
    k *= 1 + VOLUME3D.noise * (2*_volHash(Math.floor(r.x/cell), Math.floor(r.y/cell), Math.floor(r.z/cell)) - 1);
  }
  if(!(k > 0)) return pts;
  let fly = 0;
  if(VOLUME3D.flyFrac > 0 && VOLUME3D.flyAmp > 0){
    const cell = (VOLUME3D.cellCm || 1.5) / _volCmPerUnit(), r = pts[0];
    const h = _volHash(Math.floor(r.x/cell) + 7, Math.floor(r.y/cell) + 13, Math.floor(r.z/cell) + 3);
    if(h < VOLUME3D.flyFrac) fly = VOLUME3D.flyAmp * (0.5 + h / VOLUME3D.flyFrac * 0.5);
  }
  const X = _gX(); if(!_gOk(X, pts)) return pts;
  const th = Math.max(0, Math.min(1, VOLUME3D.tipHold || 0));
  _gIn(X, pts);
  return _gOut(X, X.volumeMap(pts.length, lift.x*k, lift.y*k, lift.z*k, fly, VOLUME3D.RAMP, th), 1, [pts[0]]);
}

function flowCurlStrand3D(pts, flowVal){
  if(!pts || pts.length < 2 || !flowVal) return pts;
  const f = Math.max(-100, Math.min(100, flowVal)) / 100;
  const root = pts[0];
  const rl = _fh2(root.x, root.z);
  if(rl < 1e-4) return pts;
  const X = _gX(); if(!_gOk(X, pts)) return pts;
  const E = getHeadEllipsoid();
  _gIn(X, pts);
  return _gOut(X, X.flowMap(pts.length, root.x/rl, root.z/rl, FLOW3D.AMP * f * Math.max(E.a, E.c)), 1, [pts[0]]);
}

function scalpDirAt(d, E, frac){
  const fn = (P)=>{
    const t = scalpTangentAt(P, d, E);
    const l = _fh3(t.x, t.y, t.z);
    if(l < 1e-5) return null;
    return { x:t.x/l*frac, y:t.y/l*frac, z:t.z/l*frac };
  };
  fn._sd = { d, frac };
  return fn;
}

function bendStrandToDir3D(pts, dirAt, ramp, tail, E, hugCurl){
  const hugK = hugCurlFactor(hugCurl);
  if(!pts || pts.length < 2) return pts;
  const X = _gX(); if(!_gOk(X, pts) || !dirAt || !dirAt._sd) return pts;
  const H = SCALP_HUG;
  const hugOn = !!(H.on && E && E.a > 1e-9 && E.b > 1e-9 && E.c > 1e-9);
  const d = dirAt._sd.d;
  X.setShape(E ? E.a : NaN, E ? E.b : NaN, E ? E.c : NaN, HUG_STEER.rotate ? 1 : 0, HUG_STEER.into);
  _gIn(X, pts);
  const m = X.bend(pts.length, d.x, d.y, d.z, dirAt._sd.frac, ramp, tail,
                   hugOn ? 1 : 0, hugK, H.lift, H.band, H.strength, BEND3D.carry ? 1 : 0);
  return _gOut(X, m, 1, [pts[0]]);
}

function sleekStrand3D(pts, sleekVal){
  if(!SLEEK3D.on || !pts || pts.length < 2) return pts;
  const s = sliderResponse(Math.max(0, Math.min(100, sleekVal || 0)), SLEEK3D.GAMMA);
  if(s <= 0) return pts;
  let E = null;
  try{ E = getHeadEllipsoid(); }catch(e){}
  if(!E || !(E.a > 1e-9 && E.b > 1e-9 && E.c > 1e-9)) return pts;
  const X = _gX(); if(!_gOk(X, pts)) return pts;
  const K = SLEEK3D;
  X.setShape(E.a, E.b, E.c, HUG_STEER.rotate ? 1 : 0, HUG_STEER.into);
  _gIn(X, pts);
  return _gOut(X, X.sleek(pts.length, s, K.lift, K.band, K.strength, K.ramp, K.carry ? 1 : 0), 1, [pts[0]]);
}

function lengthStrand3D(pts, ratio){
  if(!pts || pts.length < 2 || !(ratio > 0) || Math.abs(ratio-1) < 1e-6) return pts;
  const X = _gX(); if(!_gOk(X, pts)) return pts;
  _gIn(X, pts);
  const m = X.lengthStrand(pts.length, ratio);
  if(m < 0) return pts;
  const kept = X.geomKept();
  return _gOut(X, m, kept, pts.slice(0, kept));
}
