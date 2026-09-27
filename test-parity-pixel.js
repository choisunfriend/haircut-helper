const fs=require('fs'),vm=require('vm');
const bytes=fs.readFileSync('build/core.wasm');
function mk(file){const c={console,Math,Map,WeakMap,Float64Array,Uint8Array,Array,Object,isFinite,Date,Error,Promise,setTimeout,state:{}};c.window=c;
 c.parseRGBTriple=(css)=>{if(!css)return null;const m=/rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(css)||/#(..)(..)(..)/.exec(css);if(!m)return null;return css[0]==='#'?{r:parseInt(m[1],16),g:parseInt(m[2],16),b:parseInt(m[3],16)}:{r:+m[1],g:+m[2],b:+m[3]};};
 c.WebAssembly={instantiateStreaming:null,instantiate:(b,i)=>WebAssembly.instantiate(bytes,i)};c.fetch=async()=>({arrayBuffer:async()=>bytes});
 vm.createContext(c);vm.runInContext(fs.readFileSync(file,'utf8'),c);return c;}
const A=mk('src_09_orig.js'),B=mk(process.argv[2]||'09-strand-dye.wasm-src.js');
setTimeout(()=>{
 let rnd=7;const R=()=>{rnd=(rnd*16807)%2147483647;return rnd/2147483647;};
 const views=[];for(let v=0;v<3;v++){const w=200+v*37,h=260+v*11;const rgb=new Uint8Array(w*h*3);for(let i=0;i<rgb.length;i++)rgb[i]=(R()*256)|0;const rm=new Uint8Array(w*h);for(let i=0;i<rm.length;i++)rm[i]=R()<0.7?1:(R()<0.5?0:2);
  views.push({photoRGB:rgb,maskW:w,maskH:h,w:w*3.1,h:h*3.1,reasonMask:v==2?null:rm,avgHairColor:'rgb(40,30,25)'});}
 let bad=0,tot=0,nulls=0;
 const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 for(let t=0;t<6000;t++){const mi=views[t%3];const n=2+((R()*80)|0);const pts=[];let x=R()*mi.w*1.2-mi.w*0.1,y=R()*mi.h*1.2-mi.h*0.1;for(let i=0;i<n;i++){pts.push({x,y});x+=(R()-0.5)*20;y+=R()*25;}
  if(t%97==0)pts[1]={x:NaN,y:5};
  const fbc=['rgb(20,15,10)','#3a2a1a',null][t%3];const baked=t%4==0?null:['rgb(1,2,3)',null,'rgb(4,5,6)','rgb(7,8,9)',null,'rgb(9,9,9)'];const dye=t%5==0?'#b04a2a':null;
  const a1=A.sampleStrandColors(mi,pts,fbc),b1=B.sampleStrandColors(mi,pts,fbc);
  const a2=A.sampleProjectedStrandColors(mi,pts,baked,fbc,dye),b2=B.sampleProjectedStrandColors(mi,pts,baked,fbc,dye);
  tot+=2;if(!eq(a1,b1)){bad++;if(bad<3)console.log('2D',a1,b1);} if(!eq(a2,b2)){bad++;if(bad<3)console.log('P',a2,b2);} if(a1===null)nulls++;}
 console.log({tot,bad,nulls,ready:B.__SPCORE.ready});
 const mi=views[0];const pts=[];for(let i=0;i<40;i++)pts.push({x:100+i,y:50+i*3});
 for(const [nm,C] of [['js',A],['wasm',B]]){const t0=process.hrtime.bigint();for(let k=0;k<30000;k++)C.sampleProjectedStrandColors(mi,pts,null,'rgb(20,15,10)',null);console.log(nm,Number(process.hrtime.bigint()-t0)/1e6,'ms/30000');}
},300);
