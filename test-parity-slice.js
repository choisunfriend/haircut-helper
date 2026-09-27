const fs=require('fs'),vm=require('vm');const bytes=fs.readFileSync('build/core.wasm');const H=fs.readFileSync('helpers04.js','utf8');
let seed=1;const c={console,Math:Object.create(Math),Map,WeakMap,Float64Array,Int32Array,Uint8Array,Array,Object,isFinite,Date,Error,Promise,setTimeout,state:{}};c.window=c;
c.Math.random=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};c.parseRGBTriple=()=>null;
c.WebAssembly={instantiateStreaming:null,instantiate:(b,i)=>WebAssembly.instantiate(bytes,i)};c.fetch=async()=>({arrayBuffer:async()=>bytes});
vm.createContext(c);vm.runInContext(H,c);vm.runInContext(fs.readFileSync(process.argv[2]||'09-strand-dye.wasm-src.js','utf8'),c);
function orig(pend,maskW,maskH,step,maxLen,tex){const SW=Math.max(4,maskW*0.03),m={};pend.forEach(p=>{const k=p.rootSec+'|'+Math.floor(p.rootX/SW)+'|'+Math.floor(p.rootNy*10);(m[k]=m[k]||[]).push(p);});
 Object.values(m).forEach(g=>{const h=g.map(x=>x.hemIdx).sort((a,b)=>a-b),md=h[Math.floor(h.length/2)];g.forEach(x=>x.sliceHemIdx=md);});
 return pend.map(p=>{const hl=Math.max(maskH*0.03,p.sliceHemIdx*step),me=1+(p.strandMult-1)*0.4,j=0.92+c.hashFract(p.rootX*17.23+p.rootNy*91.7)*0.16;let t=p.ratio>=1?hl*me*j+hl*(p.ratio-1)*1.6+p.layerDelta:hl*me*j*p.ratio+p.layerDelta;const ta=tex(p.ix,p.rootSec);if(ta>0)t*=1-c.Math.random()*(ta/100)*0.35;t=Math.max(maskH*0.02,Math.min(t,maxLen));return Math.max(2,Math.min(p.probe.length,Math.round(t/step)+1));});}
setTimeout(()=>{let r=5;const R=()=>{r=(r*48271)%2147483647;return r/2147483647;};let bad=0,tot=0;
 for(let t=0;t<300;t++){const n=50+((R()*3000)|0);const secs=['crown','front','temple','side','nape'];const pend=[];
  for(let i=0;i<n;i++)pend.push({rootSec:secs[(R()*5)|0],rootX:R()*800,rootNy:R()*1.2-0.1,hemIdx:1+((R()*60)|0),ratio:[0.6,1,1.4][(R()*3)|0],layerDelta:(R()-0.5)*20,strandMult:0.8+R()*0.5,ix:(R()*800)|0,probe:{length:2+((R()*80)|0)}});
  const tx=(ix,s)=> (ix%3===0?40:0)+(s==='front'?20:0);
  seed=t+1;const a=orig(pend.map(p=>({...p})),800,1000,25,1150,tx);seed=t+1;const b=c._spSliceLens(pend,800,1000,25,1150,tx);
  tot++;if(JSON.stringify(a)!==JSON.stringify(b)){bad++;if(bad<3){let k=0;while(a[k]===b[k])k++;console.log('diff',t,k,a[k],b[k]);}}}
 console.log({tot,bad,ready:c.__SPCORE.ready});},300);
