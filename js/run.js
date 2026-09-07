/* 검사 실행기 — node test/run.js */
const { T, app } = require('./invariants.test.js');
let pass = 0; const fail = [];
console.log('\n검사 ' + T.length + '건\n' + '─'.repeat(64));
for(const [name, fn] of T){
  try{ fn(); pass++; console.log('  통과  ' + name); }
  catch(e){ fail.push([name, e.message]); console.log('  실패  ' + name); }
}
console.log('─'.repeat(64));
if(app.skipped.length) console.log('로드 건너뜀: ' + app.skipped.map(s=>s[0]).join(', '));
console.log(`통과 ${pass} / ${T.length}` + (fail.length ? `  ·  실패 ${fail.length}` : ''));
for(const [n,m] of fail) console.log('\n▸ ' + n + '\n  ' + m.replace(/\n/g,'\n  '));
process.exit(fail.length ? 1 : 0);
