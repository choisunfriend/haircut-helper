/* ══════════════════════════════════════════════════════════════════
   테스트 하네스 — 브라우저 없이 js/ 를 통째로 올린다 (2026-09-07)
   ─────────────────────────────────────────────────────────────────
   js/ 아래는 전부 클래식 스크립트라 모듈 경계가 없다. 그래서 vm 컨텍스트
   하나에 index.html 순서 그대로 부어 넣으면 브라우저와 같은 전역이 만들어진다.
   DOM·WebGL·MediaPipe는 스텁으로 막는다 — 우리가 검사할 것은 기하와 배선이지
   렌더링이 아니다. 스텁이 모자라 터지는 파일은 건너뛰고 기록만 남긴다
   (검사 대상 함수가 그 파일에 없으면 문제가 안 된다).
══════════════════════════════════════════════════════════════════ */
const fs = require('fs'), path = require('path'), vm = require('vm');
const JS = path.join(__dirname, '..', 'js');

function stubEl(){
  const e = {
    style:{}, dataset:{}, classList:{add(){},remove(){},toggle(){},contains(){return false}},
    children:[], value:'', textContent:'', innerHTML:'', checked:false, width:0, height:0,
    appendChild(c){ this.children.push(c); return c; }, removeChild(){}, remove(){},
    addEventListener(){}, removeEventListener(){}, setAttribute(){}, getAttribute(){return null},
    querySelector(){ return stubEl(); }, querySelectorAll(){ return []; },
    getBoundingClientRect(){ return {x:0,y:0,width:0,height:0,top:0,left:0,right:0,bottom:0}; },
    getContext(){ return stubCtx(); }, closest(){ return null; }, focus(){}, click(){},
  };
  return e;
}
function stubCtx(){
  const c = new Proxy({}, { get(t,k){
    if(k === 'canvas') return stubEl();
    if(k === 'getImageData') return (x,y,w,h)=>({data:new Uint8ClampedArray(Math.max(1,w*h*4)),width:w,height:h});
    if(k === 'createImageData') return (w,h)=>({data:new Uint8ClampedArray(Math.max(1,w*h*4)),width:w,height:h});
    if(k === 'measureText') return ()=>({width:0});
    if(k === 'createLinearGradient' || k === 'createRadialGradient') return ()=>({addColorStop(){}});
    return ()=>{};
  }});
  return c;
}

function makeContext(){
  const doc = {
    readyState:'complete', body:stubEl(), documentElement:stubEl(),
    createElement(){ return stubEl(); }, createElementNS(){ return stubEl(); },
    getElementById(){ return stubEl(); }, querySelector(){ return stubEl(); },
    querySelectorAll(){ return []; }, addEventListener(){}, removeEventListener(){},
    createTextNode(){ return stubEl(); }, hidden:false, fonts:{ ready:Promise.resolve(), add(){} },
  };
  const ctx = {
    console, Math, JSON, Date, Promise, Array, Object, Number, String, Boolean, Error,
    Map, Set, WeakMap, WeakSet, Symbol, RegExp, Function, parseInt, parseFloat, isNaN, isFinite,
    Uint8Array, Uint8ClampedArray, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array,
    ArrayBuffer, DataView, TextEncoder, TextDecoder, URL, structuredClone,
    setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask,
    requestAnimationFrame:(f)=>setTimeout(()=>f(0),0), cancelAnimationFrame:clearTimeout,
    document: doc, navigator:{ userAgent:'node', language:'ko', mediaDevices:{} },
    location:{ href:'http://localhost/', search:'', hash:'', protocol:'http:' },
    localStorage:{ getItem(){return null}, setItem(){}, removeItem(){}, clear(){} },
    sessionStorage:{ getItem(){return null}, setItem(){}, removeItem(){}, clear(){} },
    fetch:()=>Promise.reject(new Error('no network in tests')),
    Image: function(){ return stubEl(); },
    OffscreenCanvas: function(w,h){ const e = stubEl(); e.width=w; e.height=h; return e; },
    ImageData: function(w,h){ return {data:new Uint8ClampedArray(Math.max(1,w*h*4)),width:w,height:h}; },
    Path2D: function(){ return { moveTo(){}, lineTo(){}, closePath(){}, arc(){}, rect(){} }; },
    ResizeObserver: function(){ return { observe(){}, unobserve(){}, disconnect(){} }; },
    MutationObserver: function(){ return { observe(){}, disconnect(){} }; },
    matchMedia:()=>({ matches:false, addEventListener(){}, removeEventListener(){} }),
    performance:{ now:()=>Date.now() },
    THREE: new Proxy(function(){}, { get(){ return function(){ return {}; }; },
                                     construct(){ return {}; } }),
    tf: new Proxy({}, { get(){ return ()=>{}; } }),
    bodySegmentation: new Proxy({}, { get(){ return ()=>{}; } }),
    addEventListener(){}, removeEventListener(){}, alert(){}, prompt(){ return null; },
  };
  ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
  return vm.createContext(ctx);
}

/* index.html의 <script src="js/..."> 순서를 그대로 읽는다 — 순서를 여기에
   손으로 옮겨 적으면 그게 또 하나의 "두 곳에 사는 한 값"이 된다. */
function loadOrder(){
  const html = fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  const out = [];
  const re = /<script\s+src="js\/([^"]+)"/g;
  let m; while((m = re.exec(html))) out.push(m[1]);
  return out;
}

function loadApp(){
  const ctx = makeContext();
  const skipped = [];
  for(const f of loadOrder()){
    const p = path.join(JS, f);
    if(!fs.existsSync(p)){ skipped.push([f,'없음']); continue; }
    try{ vm.runInContext(fs.readFileSync(p,'utf8'), ctx, { filename:'js/'+f }); }
    catch(e){ skipped.push([f, e.message.split('\n')[0]]); }
  }
  return { ctx, skipped, order: loadOrder() };
}

/* const/let 로 선언된 최상위 값(VIEWCAL_ANCHOR 등)은 컨텍스트 객체가 아니라
   전역 렉시컬 스코프에 산다 — 객체 접근으로는 안 보이므로 평가해서 꺼낸다. */
function evalIn(ctx, expr){ return vm.runInContext(expr, ctx); }
module.exports = { loadApp, loadOrder, evalIn, JS };
