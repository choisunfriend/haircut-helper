// usage: node splice.js src.js repl.js out.js  — replaces top-level `function NAME(` blocks in src by those in repl
const fs=require('fs');
function blocks(s){ // map name -> [start,end) for top-level function decls
  const re=/^function\s+([A-Za-z_$][\w$]*)\s*\(/gm, out={}; let m;
  while((m=re.exec(s))){ const st=m.index; let i=s.indexOf('{',re.lastIndex), d=0, q=null;
    // skip param list containing braces? params have default objects rarely; find '{' after ')' matching
    let p=re.lastIndex, pd=1; while(pd){const c=s[p++]; if(c==='(')pd++; else if(c===')')pd--;} i=s.indexOf('{',p);
    for(;i<s.length;i++){const c=s[i],n=s[i+1];
      if(q){ if(c==='\\'){i++;continue;} if(c===q)q=null; continue; }
      if(c==='/'&&n==='/'){i=s.indexOf('\n',i);continue;}
      if(c==='/'&&n==='*'){i=s.indexOf('*/',i+2)+1;continue;}
      if(c==='"'||c==="'"||c==='`'){q=c;continue;}
      if(c==='{')d++; else if(c==='}'){d--; if(!d){out[m[1]]=[st,i+1];break;}}
    } re.lastIndex=i+1; }
  return out;
}
const [src,repl,outp]=process.argv.slice(2);
let s=fs.readFileSync(src,'utf8'); const r=fs.readFileSync(repl,'utf8');
const rb=blocks(r); let sb=blocks(s);
const extra=[];
for(const name of Object.keys(rb)){
  const code=r.slice(...rb[name]);
  if(sb[name]){ s=s.slice(0,sb[name][0])+code+s.slice(sb[name][1]); sb=blocks(s); }
  else extra.push(code);
}
for(const name of (process.argv[5]||'').split(',').filter(Boolean)){ sb=blocks(s); if(sb[name]) s=s.slice(0,sb[name][0])+s.slice(sb[name][1]); else console.log('no',name); }
if(extra.length) s = extra.join('\n')+'\n'+s;
fs.writeFileSync(outp,s); console.log('replaced',Object.keys(rb).filter(n=>!extra.includes(n)).length,'added',extra.length);
