const fs=require('fs'),vm=require('vm');
function env(){
  const ctx={console,Math,Map,Float64Array,Object,Array,isFinite,Date,Error,WebAssembly,
    SCALP_CENTER_Y:0.15, CURL3D_FIX:{ampGamma:0.7}, ADJ_CACHE:{gen:1},
    state:{}, fetch:null};
  ctx.window=ctx;
  ctx.getHeadEllipsoid=()=>({a:0.42,b:0.63,c:0.49});
  ctx.curlRodRadius=(w)=>0.02+0.05*w;
  ctx.logCurlScale=function(){};
  vm.createContext(ctx);
  vm.runInContext('var curlStrand3D=function(p){return p;};',ctx);
  return ctx;
}
const A=env(); vm.runInContext(fs.readFileSync('src_14c_orig.js','utf8'),A);
const B=env(); B.fetch=()=>Promise.reject('x');
vm.runInContext(fs.readFileSync('build/14c-curl-bundle.js','utf8'),B);
(async()=>{
  const bytes=fs.readFileSync('build/core.wasm');
  const {instance}=await WebAssembly.instantiate(bytes,{env:{abort(){throw 1},seed(){return 1},sin:Math.sin,cos:Math.cos,atan2:Math.atan2,rnd:Math.random,oriSample(){return 0},oriAngle(){return 0},oriFx(){return 0},oriFy(){return 0},oriFc(){return 0},pol(){return 0},maskAt(){return 1}}});
  // inject instance into B via its closure: reload with STYLEPEEK override
  const B2=env(); B2.__SPCORE={ready:true,x:instance.exports,waiters:[]};
  B2.fetch=async()=>({arrayBuffer:async()=>bytes});
  vm.runInContext(fs.readFileSync('build/14c-curl-bundle.js','utf8'),B2);
  await new Promise(r=>setTimeout(r,50));
  console.log('wasm ready',B2.CURL_BUNDLE.wasm.ready);
  let rnd=1;const R=()=>{rnd=(rnd*16807)%2147483647;return rnd/2147483647;};
  let worst=0,cnt=0,lenMis=0,same=0;
  for(let t=0;t<3000;t++){
    const th=R()*1.4+0.1, ph=R()*6.28-3.14, n=10+((R()*60)|0);
    let x=0.42*Math.sin(th)*Math.sin(ph), y=0.15+0.63*Math.cos(th), z=0.49*Math.sin(th)*Math.cos(ph);
    const pts=[];for(let i=0;i<n;i++){pts.push({x,y,z});x+=(R()-0.5)*0.01+x*0.01;y-=0.03+R()*0.01;z+=(R()-0.5)*0.01;}
    const curl=[20,42,60,90][t%4], w=[0.2,0.5,0.95][t%3], dir=[0,-10,25][t%3];
    if(t%500===0){A.ADJ_CACHE.gen++;B2.ADJ_CACHE.gen++;}
    const a=A.curlStrand3D(pts.map(p=>({...p})),curl,w,dir), b=B2.curlStrand3D(pts.map(p=>({...p})),curl,w,dir);
    cnt++; if(a.length!==b.length){lenMis++;continue;}
    let d=0;for(let i=0;i<a.length;i++)d=Math.max(d,Math.abs(a[i].x-b[i].x),Math.abs(a[i].y-b[i].y),Math.abs(a[i].z-b[i].z));
    if(d<1e-12)same++; worst=Math.max(worst,d);
  }
  console.log({cnt,lenMis,same,worst,statsA:A.CURL_BUNDLE.stats,statsB:B2.CURL_BUNDLE.stats,wasm:B2.CURL_BUNDLE.wasm});
  const t0=Date.now();for(let k=0;k<3;k++)for(let t=0;t<3000;t++){}
})();
setTimeout(async()=>{ // bench
  const mk=(k)=>{const p=[];let x=0.3*Math.sin(k),y=0.5,z=0.3*Math.cos(k);for(let i=0;i<40;i++){p.push({x,y,z});y-=0.035;x*=1.01;}return p;};
  const bytes=fs.readFileSync('build/core.wasm');const {instance}=await WebAssembly.instantiate(bytes,{env:{abort(){},seed(){return 1},sin:Math.sin,cos:Math.cos,atan2:Math.atan2,rnd:Math.random,oriSample(){return 0},oriAngle(){return 0},oriFx(){return 0},oriFy(){return 0},oriFc(){return 0},pol(){return 0},maskAt(){return 1}}});
  const B3=env();B3.__SPCORE={ready:true,x:instance.exports,waiters:[]};B3.fetch=async()=>({arrayBuffer:async()=>bytes});
  vm.runInContext(fs.readFileSync('build/14c-curl-bundle.js','utf8'),B3);await new Promise(r=>setTimeout(r,50));
  for(const [nm,C] of [['js',A],['wasm',B3]]){const t0=process.hrtime.bigint();for(let k=0;k<20000;k++)C.curlStrand3D(mk(k*0.001),42,0.9,20);console.log(nm,Number(process.hrtime.bigint()-t0)/1e6,'ms / 20000 strands');}
},300);
