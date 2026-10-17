PRIVATE — do not upload to the public repository.

core.wasm contents (assembly/):
  curl.ts    curl-bundle winding (from 14c)
  pixel.ts   hair-pixel harvesting for strand colors (from 09 sample*StrandColors)
  trace.ts   strand path tracing along the photo flow field (from 09 traceStrandPath)
  slice.ts   slice-consensus cut length (from 10 finalizeStrandsWithSlices)
Trig / Math.random / field lookups are imported from JS so results are bit-identical to the old engine.

Readable glue before obfuscation:
  09-strand-dye.wasm-src.js      (also hosts the shared loader window.__SPCORE and the imports)
  14c-curl-bundle.wasm-src.js
  10-hair-render-2d.patched.js   (made from the DEPLOYED 10 — your 10 source was older and lacked the RENDER_SKIP code)

Parity tests: test-parity-*.js (need src_09_orig.js / src_14c_orig.js = your original sources, and helpers04.js)

Build:
  npm i -D assemblyscript javascript-obfuscator
  npx asc assembly/index.ts -O3 --noAssert --runtime incremental -o build/core.wasm
  npx javascript-obfuscator <file> --output build/<file>.js --compact true --string-array false --identifier-names-generator hexadecimal --rename-globals false
Bump window.STYLEPEEK_WASM_V in index.html whenever core.wasm changes.

Bundle 1 (2026-09-28): assembly/geom.ts — straighten · length · curl spine · droop · volume · flow ·
part/sweep bend · sleek · 17b cut ratio (arcAtY/yAtArc/fade). Glue: 14-hair-3d-ops.wasm-src.js,
17b-cut3d-piece.wasm-src.js (built from originals with glue/splice.js + glue/g14.js, glue/g17b.js).
Global function names are kept so the 24-style-base wrappers still apply. Parity: test-parity-geom.js
(44,000 cases incl. 4,000 full adjustStrandGeom — bit-identical).

Merge 2026-10-13 (branch merge-360): 01~30 match the 360shot deployed behavior; the 360shot patch files
31~69 are melted into the original files (no separate patch files, no extra script tags). Each melted spot
carries a "(옛 NN …)" comment naming the old patch. 67-cause-test was never loaded and is not included.
test/run.js invariants ⑦ ⑲ reflect the old behavior and now fail by design.
