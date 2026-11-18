#!/usr/bin/env node
/* ==========================================================================
 * 난독화 빌드 — js/*.js 를 dist/js/*.js 로 (2026-11-19)
 *
 * 왜 이 설정인가 (바꾸기 전에 읽을 것):
 *  · renameGlobals = false  — 이 앱은 파일끼리 <b>전역 이름</b>으로 서로를 부릅니다(REGROW · PHOTO_CURL ·
 *      CURL_BUNDLE · GARMENT_FIT · HEAD_TILT …). 게다가 운영 중 진단·되돌리기가 전부 콘솔 스위치입니다
 *      (REGROW.foldMid=false · GARMENT_FIT.clearCm=0.5 …). 전역을 바꾸면 앱이 깨지고 스위치도 전부 죽습니다.
 *      그래서 전역 이름은 그대로 두고 <b>함수 안쪽</b>만 뭉갭니다. 알고리즘은 가려지고, 조종 손잡이는 남습니다.
 *  · controlFlowFlattening = false — 이 앱은 무거운 계산입니다(다시 기르기 17초 · 가닥 29,000개).
 *      제어흐름 평탄화는 그런 루프를 몇 배로 느리게 만듭니다. 난독화하자고 제품을 못 쓰게 할 수는 없습니다.
 *  · deadCodeInjection = false — 같은 이유(크기·속도).
 *  · disableConsoleOutput = false — 진단 로그가 이 제품의 자산이자 지원 수단입니다. 지우려면 여기를 true로.
 *  · selfDefending = false — devtools에서 열면 깨지게 만드는 기능인데, 오탐으로 멀쩡한 기기에서 죽는 일이 있습니다.
 *  · stringArray — 한국어 진단 문자열이 통째로 눈에 띄지 않게 모아 숨깁니다(실행 시에는 그대로 찍힙니다).
 *
 * 쓰기:  node tools/build-dist.js            → dist/ 에 통째로
 *        node tools/build-dist.js --plain    → 난독화 없이 그대로 복사(대조용)
 * ========================================================================== */
'use strict';
const fs = require('fs'), path = require('path');
const JO = require('javascript-obfuscator');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'dist');
const PLAIN = process.argv.includes('--plain');

const OPTS = {
  compact: true,
  renameGlobals: false,
  identifierNamesGenerator: 'mangled',
  controlFlowFlattening: false,
  deadCodeInjection: false,
  selfDefending: false,
  debugProtection: false,
  disableConsoleOutput: false,
  simplify: true,
  numbersToExpressions: false,     // 수치 코드가 많아 끔 — 느려지고 부동소수 오차 위험
  splitStrings: false,             // 한국어 로그가 많아 끄는 쪽이 크기에 유리
  stringArray: true,
  stringArrayThreshold: 0.75,
  stringArrayEncoding: ['base64'],
  stringArrayRotate: true,
  stringArrayShuffle: true,
  unicodeEscapeSequence: false,    // 켜면 한국어 문자열이 3배로 불어납니다
  target: 'browser'
};

/* 통째로 복사할 것 — 코드가 아닌 자산 */
// vendor/ = 오프라인용 three·TFJS·tasks-vision(wasm). 네트워크 없이 돌리려면 반드시 복사된다.
const COPY_DIRS = ['assets', 'asset', 'mediapipe', 'glue', 'vendor'];
// 아무 파일도 참조하지 않는 죽은 자산(5.8MB). 되살리려면 이 줄을 비우면 된다.
const SKIP_PATHS = ['mediapipe/selfie_segmentation'];
const COPY_FILES = ['index.html', 'styles.css', 'LICENSE.md', 'bodylab.html', 'helpers04.js'];

function rmrf(p) { if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true }); }
function cpdir(src, dst) {
  if (!fs.existsSync(src)) return 0;
  const rel = path.relative(ROOT, src).split(path.sep).join('/');
  if (SKIP_PATHS.some(s => rel === s || rel.startsWith(s + '/'))) { console.log('  건너뜀(죽은 자산) ' + rel); return 0; }
  fs.mkdirSync(dst, { recursive: true });
  let n = 0;
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const a = path.join(src, e.name), b = path.join(dst, e.name);
    if (e.isDirectory()) n += cpdir(a, b); else { fs.copyFileSync(a, b); n++; }
  }
  return n;
}

rmrf(OUT);
fs.mkdirSync(path.join(OUT, 'js'), { recursive: true });

const files = fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js')).sort();
let inB = 0, outB = 0, fail = [];
for (const f of files) {
  const src = fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
  inB += Buffer.byteLength(src);
  let code;
  if (PLAIN) code = src;
  else {
    try { code = JO.obfuscate(src, OPTS).getObfuscatedCode(); }
    catch (e) { fail.push(f + ': ' + (e && e.message)); code = src; }   // 실패한 파일은 원본 그대로 — 앱이 깨지지 않게
  }
  fs.writeFileSync(path.join(OUT, 'js', f), code);
  outB += Buffer.byteLength(code);
}

let assets = 0;
for (const d of COPY_DIRS) assets += cpdir(path.join(ROOT, d), path.join(OUT, d));
for (const f of COPY_FILES) if (fs.existsSync(path.join(ROOT, f))) { fs.copyFileSync(path.join(ROOT, f), path.join(OUT, f)); assets++; }

const kb = n => (n / 1024).toFixed(0) + 'KB';
console.log((PLAIN ? '[빌드·그대로] ' : '[빌드·난독화] ') + files.length + '개 · ' + kb(inB) + ' → ' + kb(outB)
  + ' (' + (outB / inB * 100).toFixed(0) + '%) · 자산 ' + assets + '개 · dist/');
if (fail.length) { console.log('  ⚠ 난독화 실패해 원본 그대로 둔 파일 ' + fail.length + '개:'); fail.forEach(x => console.log('    ' + x)); }
console.log('  전역 이름·콘솔 스위치는 그대로입니다 — REGROW.lines() 같은 진단이 dist에서도 됩니다.');
