const fs=require('fs'),vm=require('vm');
const bytes=fs.readFileSync('build/core.wasm');const H=fs.readFileSync('helpers04.js','utf8');
let seedA=1,seedB=1;
function mk(file,which){const c={console,Math:Object.create(Math),Map,WeakMap,Float64Array,Uint8Array,Array,Object,isFinite,Date,Error,Promise,setTimeout,state:{}};c.window=c;
 c.Math.random=()=>{if(which==='A'){seedA=(seedA*16807)%2147483647;return seedA/2147483647;}seedB=(seedB*16807)%2147483647;return seedB/2147483647;};
 c.parseRGBTriple=()=>null;c.WebAssembly={instantiateStreaming:null,instantiate:(b,i)=>WebAssembly.instantiate(bytes,i)};c.fetch=async()=>({arrayBuffer:async()=>bytes});
 vm.createContext(c);vm.runInContext(H,c);vm.runInContext(fs.readFileSync(file,'utf8'),c);return c;}
const A=mk('src_09_orig.js','A'),B=mk(process.argv[2]||'09-strand-dye.wasm-src.js','B');
setTimeout(()=>{
 let r=11;const R=()=>{r=(r*48271)%2147483647;return r/2147483647;};
 const OW=120,OH=160;const ori=[];for(let x=0;x<OW;x++){if(x%17==5){ori.push([]);continue;}const col=[];for(let y=0;y<OH;y+=4){const a=Math.PI/2+(R()-0.5)*1.6;col.push({y,angle:a,coherence:R()<0.15?0.02:R(),fx:Math.cos(a+(R()-0.5)),fy:Math.sin(a),fc:R()});}ori.push(col);}
 const mask=new Uint8Array(240*320);for(let i=0;i<mask.length;i++)mask[i]=R()<0.93?1:0;
 const maskAt=(x,y)=>{const xi=Math.round(x),yi=Math.round(y);return xi>=0&&yi>=0&&xi<240&&yi<320&&mask[yi*240+xi]===1;};
 let bad=0,tot=0,worst=0;
 for(let t=0;t<3000;t++){
  const flowOn=t%3===0;A.HAIR_FLOW.applyTo2D=flowOn;B.HAIR_FLOW.applyTo2D=flowOn;
  const mkEnv=(C)=>({hasOrientation:t%7!==0,orientation:ori,orientMaskW:OW,ox:0.5,oy:0.5,STRAND_STEP_LEN:8,frontDirBiasFor:()=> (t%4)*0.1-0.1,curlAmtFor:()=>[0,30,70,100][t%4],waveWidthFor:()=>[10,50,90][t%3],maskAt:t%5===0?null:maskAt,flowAcc:{n:0,byFlow:0}});
  const eA=mkEnv(A),eB=mkEnv(B);const ix=R()*240,sy=R()*60,L=40+R()*300,js=R()*100,stop=t%2===0;
  seedA=seedB=1+t;
  const a=A.traceStrandPath(ix,sy,L,js,eA,'crown',stop),b=B.traceStrandPath(ix,sy,L,js,eB,'crown',stop);
  tot++;let d=0;if(a.length!==b.length){bad++;if(bad<4)console.log('len',t,a.length,b.length);continue;}
  for(let i=0;i<a.length;i++)d=Math.max(d,Math.abs(a[i].x-b[i].x),Math.abs(a[i].y-b[i].y));
  if(d>0||a.maskExitIdx!==b.maskExitIdx||a.flowEndIdx!==b.flowEndIdx||eA.flowAcc.n!==eB.flowAcc.n||eA.flowAcc.byFlow!==eB.flowAcc.byFlow){bad++;if(bad<4)console.log('diff',t,d,a.maskExitIdx,b.maskExitIdx,a.flowEndIdx,b.flowEndIdx,eA.flowAcc,eB.flowAcc);}
  worst=Math.max(worst,d);}
 console.log({tot,bad,worst});
 const e={hasOrientation:true,orientation:ori,orientMaskW:OW,ox:0.5,oy:0.5,STRAND_STEP_LEN:8,frontDirBiasFor:()=>0,curlAmtFor:()=>30,waveWidthFor:()=>50,maskAt,flowAcc:{n:0,byFlow:0}};
 for(const [nm,C] of [['js',A],['wasm',B]]){const t0=process.hrtime.bigint();for(let k=0;k<5000;k++)C.traceStrandPath(k%200,20,300,k,e,'crown',false);console.log(nm,Number(process.hrtime.bigint()-t0)/1e6,'ms/5000');}
},300);
