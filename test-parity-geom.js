const fs=require('fs'),vm=require('vm');
const J='../haircut-helper-app/js/';
const bytes=fs.readFileSync('build/core.wasm');
function mk(files){
  const c={console:{log(){},warn(){},error:console.error},Math,Map,WeakMap,Set,Float64Array,Float32Array,Uint8Array,Int32Array,Array,Object,isFinite,isNaN,Date,Error,Promise,setTimeout,JSON,Number,String,state:{}};
  c.window=c; vm.createContext(c);
  for(const f of files) vm.runInContext(fs.readFileSync(f,'utf8'),c,{filename:f});
  vm.runInContext('var SOLVE_SAMPLE=160;',c);
  return c;
}
const base=[J+'02-state-sections.js',J+'08-cut-engine.js'];
const A=mk([...base,J+'14-hair-3d-ops.js',J+'17b-cut3d-piece.js']);
const B=mk([...base,'14-hair-3d-ops.wasm-src.js','17b-cut3d-piece.wasm-src.js']);
const nop=()=>0;
const env={sin:Math.sin,cos:Math.cos,atan2:Math.atan2,hyp3:Math.hypot,rnd:Math.random,oriSample:nop,oriAngle:nop,oriFx:nop,oriFy:nop,oriFc:nop,pol:nop,maskAt:nop,abort(){throw Error('abort')},seed:()=>1};
WebAssembly.instantiate(bytes,{env}).then(r=>{
  B.__SPCORE={ready:true,x:r.instance.exports};
  let s=7;const R=()=>{s=(s*48271)%2147483647;return s/2147483647;};
  const E={a:0.417,b:0.633,c:0.492};
  for(const C of [A,B]){ C.getHeadEllipsoid=()=>E; C.fringeLineY=()=>null; C.MQ_FRINGE={}; }
  const secs=['crown','front','temple','side','occipital','nape'];
  function strand(){ // root on head shell, wavy path downwards
    const th=R()*2*Math.PI, ph=R()*1.6+0.05;
    let x=E.a*Math.sin(ph)*Math.sin(th), y=0.15+E.b*Math.cos(ph), z=E.c*Math.sin(ph)*Math.cos(th);
    const pts=[{x,y,z}]; const n=3+Math.floor(R()*60); const st=0.02+R()*0.05;
    let dx=x*0.3,dy=-1,dz=z*0.3;
    for(let i=0;i<n;i++){ dx+= (R()-0.5)*0.6; dz+=(R()-0.5)*0.6; const l=Math.hypot(dx,dy,dz); x+=dx/l*st; y+=dy/l*st; z+=dz/l*st; pts.push({x,y,z}); if(R()<0.03) pts.push({x,y,z}); }
    return {pts, sec:secs[Math.floor(R()*6)]};
  }
  const model={strands:[]}; for(let i=0;i<600;i++) model.strands.push(strand());
  let bad=0,tot=0,worst=0;
  function cmp(a,b,tag){ tot++;
    if(typeof a==='number'||typeof b==='number'){ if(!(a===b||(a!==a&&b!==b))){bad++; if(bad<8)console.log('num',tag,a,b);} return; }
    if(a.length!==b.length){bad++; if(bad<8)console.log('len',tag,a.length,b.length); return;}
    let d=0; for(let i=0;i<a.length;i++){ d=Math.max(d,Math.abs(a[i].x-b[i].x),Math.abs(a[i].y-b[i].y),Math.abs(a[i].z-b[i].z)); if(a[i].x!==b[i].x&&!(a[i].x!==a[i].x&&b[i].x!==b[i].x))d=Math.max(d,1e-300); }
    worst=Math.max(worst,d); if(d>0){bad++; if(bad<8)console.log('diff',tag,d);} }
  const techs=['onelength','graduation','uniform','increase'];
  for(let t=0;t<4000;t++){
    const sec={}; for(const k of secs) sec[k]={length:10+R()*140, curl:R()<0.4?0:R()*100, wave:R()*100, curlDir:(R()-0.5)*200, technique:techs[t%4], elevation:R()*90, texture:R()<0.5?0:R()*100, line:R()<0.5?50:R()*100, overdirection:R()*100, density:100};
    const sty={part:(R()-0.5)*200, partAmt:R()*100, sweep:(R()-0.5)*200, volume:R()*100, flow:R()<0.5?0:(R()-0.5)*200, sleek:R()<0.4?0:R()*100};
    const fade = R()<0.3 ? {enabled:true, guard:R()*8, height:R()*100, blendWidth:R()*100, taper:R()*100, disc:R()<0.5?0:R()*100} : null;
    const straight = R()<0.3 ? R()*1.5 : 0, spine = R()<0.9, carry=R()<0.8, rot=R()<0.8, hug=R()<0.85, odrs=R()<0.8;
    for(const C of [A,B]){
      C.state.sections=JSON.parse(JSON.stringify(sec)); C.state.fade=fade&&{...fade}; C.state.hair3Dneutral=Object.assign({CY:0.15},{strands:model.strands});
      C.uniformStyling=()=>({...sty});
      vm.runInContext(`BASE_RESET.straighten=${straight};CURL3D_FIX.spine=${spine};BEND3D.carry=${carry};SLEEK3D.carry=${carry};HUG_STEER.rotate=${rot};SCALP_HUG.on=${hug};CUT3D.odRatioSpace=${odrs};`,C);
    }
    const st=model.strands[t%600];
    const len = R()<0.5 ? undefined : 10+R()*140;
    let a,b; try{a=A.adjustStrandGeom(st,len);}catch(e){a='ERR '+e.message} try{b=B.adjustStrandGeom(st,len);}catch(e){b='ERR '+e.message}
    if(typeof a==='string'||typeof b==='string'){ if(a!==b){bad++;tot++;if(bad<8)console.log('err',t,a,b);} else tot++; }
    else cmp(a,b,'adj'+t);
    { const p=st.pts, s2=sec[st.sec]; const r1=0.1+R()*1.8, k=R()*1.5, cA=R()*100, w=R(), cd=(R()-0.5)*200;
      const ops=[['len',C=>C.lengthStrand3D(p,r1)],['str',C=>C.straightenStrand3D(p,k)],['curl',C=>C.curlStrand3D(p,cA,w,cd)],['grav',C=>C.gravityDroop3D(p,cA)],
        ['part',C=>C.partStrand3D(p,sty.part,cA,sty.partAmt)],['sweep',C=>C.sweepStrand3D(p,sty.sweep,cA,sty.part,sty.partAmt)],['vol',C=>C.volumeStrand3D(p,sty.volume,st.sec)],
        ['flow',C=>C.flowCurlStrand3D(p,sty.flow)],['sleek',C=>C.sleekStrand3D(p,sty.sleek)],['cut',C=>C.cutRatioForStrand(st,s2,s2.length,0.7)]];
      for(const [nm,f] of ops) cmp(f(A),f(B),nm+t); }
    const p=st.pts, s2=sec[st.sec];
  }
  console.log({tot,bad,worst});
});
setTimeout(()=>{ for(const [nm,C] of [['js',A],['wasm',B],['js',A],['wasm',B]]){ const ms=C.state.hair3Dneutral.strands; const t0=process.hrtime.bigint(); for(let k=0;k<20000;k++) C.adjustStrandGeom(ms[k%600]); console.log(nm,Number(process.hrtime.bigint()-t0)/1e6,'ms/20000'); } },500);
