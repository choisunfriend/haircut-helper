/* 배포본 빌드 — 주석 제거 + 난독화
   사용법:  (처음 한 번)  cd tools && npm i javascript-obfuscator@4
            node tools/build-release.js          → dist/ 생성
   원칙:
   · 파일을 합치지 않는다. js/ 파일들은 클래식 스크립트라 전역을 서로 나눠 쓰고,
     index.html의 onclick="navTo(...)" 같은 인라인 핸들러가 전역 함수 이름을 부른다.
     그래서 <b>전역 이름은 그대로</b>(renameGlobals:false) 두고 함수 안쪽만 바꾼다.
   · 무거운 변환(제어흐름 평탄화·죽은코드 삽입)은 끈다. 가닥 렌더·3D 루프가 수만 번
     도는 앱이라 그 변환은 체감 속도를 몇 배로 떨어뜨린다.
   · 문자열은 배열로 빼서 숨긴다(진단 로그의 한국어 설명이 설계 노트 역할을 해서다). */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), DIST = path.join(ROOT, 'dist');
let JO;
try{ JO = require(path.join(__dirname, 'node_modules', 'javascript-obfuscator')); }
catch(e){ console.error('javascript-obfuscator가 없습니다: cd tools && npm i javascript-obfuscator@4'); process.exit(1); }

const OPTS = {
  compact: true,
  renameGlobals: false,                 // 전역 이름 유지(파일 간 공유 + 인라인 핸들러)
  identifierNamesGenerator: 'hexadecimal',
  controlFlowFlattening: false,         // 속도
  deadCodeInjection: false,             // 속도·용량
  numbersToExpressions: false,
  simplify: true,
  splitStrings: false,
  /* (2026-09-16 2차) 문자열 배열을 <b>끈다</b>. 1차 빌드가 폰에서 느렸던 원인이다 —
     켜면 난독화기가 Math.sqrt·obj.x 같은 속성 접근까지 Math[_0x2b66(0x165)] 함수 호출로
     바꿔서, 수십만 번 도는 픽셀·가닥 루프마다 호출이 끼었다(노드 실측 3~4배 느림).
     영문만 제외하는 reservedStrings도 속성 접근에는 안 먹었다(실측).
     대신 설계 노트였던 <b>주석은 전부</b> 지워지고, 지역 이름도 전부 난수가 된다. */
  stringArray: false,
  transformObjectKeys: false,           // 속성 이름이 바뀌면 저장된 스타일(localStorage) 형식이 깨진다
  selfDefending: false,                 // 코드 포맷터에 걸면 멈추게 하는 장치 — WebView에서 오작동 사례가 있어 끔
  disableConsoleOutput: false,          // 진단 패널이 console을 읽는다
  unicodeEscapeSequence: false,
  sourceMap: false,
  target: 'browser',
};

function rmrf(p){ fs.rmSync(p, { recursive: true, force: true }); }
function copyDir(src, dst){
  fs.mkdirSync(dst, { recursive: true });
  for(const e of fs.readdirSync(src, { withFileTypes: true })){
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if(e.isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
}
const obf = code => JO.obfuscate(code, OPTS).getObfuscatedCode();

rmrf(DIST); fs.mkdirSync(path.join(DIST, 'js'), { recursive: true });

// 1) js/*.js — index.html에 적힌 것만(안 쓰는 파일은 배포본에 안 넣는다)
let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const files = [...html.matchAll(/<script\s+src="js\/([^"]+)"/g)].map(m => m[1]);
let inBytes = 0, outBytes = 0;
for(const f of files){
  const src = fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
  const out = obf(src);
  fs.writeFileSync(path.join(DIST, 'js', f), out);
  inBytes += Buffer.byteLength(src); outBytes += Buffer.byteLength(out);
  console.log('  js/' + f + '  ' + (Buffer.byteLength(src)/1024|0) + 'KB → ' + (Buffer.byteLength(out)/1024|0) + 'KB');
}

// 2) index.html — HTML 주석 제거 + 인라인 <script>도 난독화
html = html.replace(/<!--[\s\S]*?-->/g, '');
html = html.replace(/<script>([\s\S]*?)<\/script>/g, (m, code) => '<script>' + obf(code) + '</script>');
html = html.replace(/\n\s*\n+/g, '\n');
fs.writeFileSync(path.join(DIST, 'index.html'), html);

// 3) styles.css — 주석만 제거
const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\n\s*\n+/g, '\n');
fs.writeFileSync(path.join(DIST, 'styles.css'), css);

// 4) 정적 자원 그대로
for(const d of ['assets', 'mediapipe']) if(fs.existsSync(path.join(ROOT, d))) copyDir(path.join(ROOT, d), path.join(DIST, d));

console.log('완료: dist/ · JS ' + (inBytes/1024|0) + 'KB → ' + (outBytes/1024|0) + 'KB · test/·tools/·주석은 안 들어갑니다');
