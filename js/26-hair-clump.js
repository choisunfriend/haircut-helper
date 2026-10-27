/* ══════════════════════════════════════════════════════════════════════════
   26-hair-clump.js — 3D 결과보기 가닥을 <b>작은 다발</b>로 모은다 · 2026-09-22
   ─────────────────────────────────────────────────────────────────────────
   사용자(웨이브 보브 3D를 보며): "3D 결과보기는 헤어 가닥이 너무 가닥가닥 나와서 그런지
   가늘어 보이고, 그래서 머리숱은 엄청 많아 보여. 실제로 사람 머리만큼 많이 그리는 건 아니지
   않나? 사진처럼 몇 가닥씩 조금 뭉쳐서 다니도록 하면 나아지지 않을까."

   ── 왜 가늘고 많아 보였나 ────────────────────────────────────────────
   3D는 조정 반영 가닥 약 2만 개를 <b>각자</b> 1px 선으로 긋는다(실제 머리카락은 10만 안팎이라
   수는 적다). 선 하나가 화면에서 늘 1px이라 실제 머리카락보다 훨씬 굵게 찍히는데, 이웃과
   따로 놀아서 겉이 잔머리처럼 부풀고 숱이 많아 보였다. 실제 머리는 가닥이 서로 붙어
   <b>다발</b>로 다닌다 — 특히 웨이브는 다발째 휜다(참고 사진의 청키 컬).

   ── 14c 컬 번들과 무엇이 다른가 ──────────────────────────────────────
   14c는 <b>펌 로드</b> 크기(이 스타일에서 5.15cm) 칸마다 나선 위상을 맞춘다. 모으는 힘
   (clumpPull 0.3)은 약해서 한 번들 안 가닥이 5cm 폭에 그대로 흩어져 있다.
   여기는 그보다 훨씬 작은 <b>1cm 안쪽 다발</b>을 만든다. 둘은 겹쳐 돈다 — 번들이 같은 나선을
   주고, 그 안에서 작은 다발로 모인다. 14c는 한 줄도 안 건드렸다.

   ── 방식 ───────────────────────────────────────────────────────────
   뿌리를 3D 칸(cellCm)으로 묶어 한 다발. 칸 가운데에 가장 가까운 가닥이 <b>대표</b>.
   나머지 가닥의 점마다, 뿌리에서 잰 호길이 s에서의 대표 점 쪽으로 w만큼 당긴다:
       새 점 = 제 점 + (대표 점 − 제 점) × w,   w = pull × min(1, s / rampCm)
   · 뿌리(s=0)는 w=0 — 두피에서 뜨지 않는다.
   · (1 − pull)만큼은 제자리를 남긴다 — 한 줄로 합쳐지면 다발 안의 결이 사라진다.
   · 대표보다 긴 가닥은 대표 끝을 지나면 tailCm에 걸쳐 w가 0으로 돌아간다(레이어 끝이 제 길로).

   ── 적용 범위 ───────────────────────────────────────────────────────
   3D 결과보기(14 buildAdjustedHair3DObject)만. 조정 화면(2D)은 가닥 6천 개를 굵기
   0.9px로 그려 이미 덜 가늘어 보이고, 거기까지 바꾸면 조정 손잡이의 반응이 달라진다 —
   필요하면 그때 같은 함수를 15에 끼운다(함수는 하나 — 두 벌을 만들지 않는다).
   끄기: HAIR_CLUMP3D.on = false
   ══════════════════════════════════════════════════════════════════════════ */
const HAIR_CLUMP3D = {
  on: true,
  cellCm: 0.8,    // 다발 굵기 — 참고 사진의 웨이브 다발(0.5~1cm)에서 잡은 초안
  pull: 0.7,      // 대표 쪽으로 당기는 비율(1 = 한 줄로 합침)
  rampCm: 3.0,    // 뿌리에서 이 길이에 걸쳐 0 → pull (두피에서 뜨지 않게)
  tailCm: 2.0,    // 대표보다 긴 부분에서 이 길이에 걸쳐 pull → 0
  log: true,
};

/* 호길이 표. */
function _clumpArc(P){
  const s = new Float64Array(P.length);
  for(let i=1;i<P.length;i++) s[i] = s[i-1] + Math.hypot(P[i].x-P[i-1].x, P[i].y-P[i-1].y, P[i].z-P[i-1].z);
  return s;
}
/* 호길이 t에서의 점(선형 보간). t가 끝을 넘으면 끝점. */
function _clumpAt(P, S, t){
  const n = P.length;
  if(t <= 0) return P[0];
  if(t >= S[n-1]) return P[n-1];
  let lo = 0, hi = n - 1;
  while(hi - lo > 1){ const m = (lo + hi) >> 1; if(S[m] < t) lo = m; else hi = m; }
  const d = (S[hi] - S[lo]) || 1, u = (t - S[lo]) / d, a = P[lo], b = P[hi];
  return { x: a.x + (b.x-a.x)*u, y: a.y + (b.y-a.y)*u, z: a.z + (b.z-a.z)*u };
}

/* adj(조정 반영 가닥 배열)를 받아, 다발로 모은 <b>새 배열</b>을 돌려준다(원본은 안 건드린다 —
   조정 캐시가 같은 객체를 다시 쓴다). 자를 못 만들면 원본 그대로. */
function clumpStrands3D(adj){
  if(!HAIR_CLUMP3D.on || !adj || adj.length < 2) return adj;
  let cmu = null;
  try{ cmu = (typeof modelCmPerUnit === 'function') ? modelCmPerUnit() : null; }catch(e){}
  if(!(cmu > 0)) return adj;
  const cell = HAIR_CLUMP3D.cellCm / cmu, ramp = HAIR_CLUMP3D.rampCm / cmu, tail = HAIR_CLUMP3D.tailCm / cmu;
  const pull = Math.max(0, Math.min(1, HAIR_CLUMP3D.pull));
  // 뿌리 → 3D 칸
  const groups = new Map();
  for(let i=0;i<adj.length;i++){
    const r = adj[i] && adj[i].pts && adj[i].pts[0];
    if(!r || !isFinite(r.x) || !isFinite(r.y) || !isFinite(r.z)) continue;
    const key = Math.floor(r.x / cell) + ',' + Math.floor(r.y / cell) + ',' + Math.floor(r.z / cell);
    let g = groups.get(key); if(!g){ g = []; groups.set(key, g); } g.push(i);
  }
  const out = adj.slice();
  let clumps = 0, moved = 0, sizeSum = 0;
  for(const [key, g] of groups){
    if(g.length < 2) continue;
    // 대표 = 칸 가운데에 가장 가까운 뿌리
    const k = key.split(',').map(Number);
    const cx = (k[0] + 0.5) * cell, cy = (k[1] + 0.5) * cell, cz = (k[2] + 0.5) * cell;
    let lead = g[0], bd = Infinity;
    for(const i of g){ const r = adj[i].pts[0]; const d = (r.x-cx)**2 + (r.y-cy)**2 + (r.z-cz)**2; if(d < bd){ bd = d; lead = i; } }
    const LP = adj[lead].pts; if(!LP || LP.length < 2) continue;
    const LS = _clumpArc(LP), Ltot = LS[LS.length-1];
    clumps++; sizeSum += g.length;
    for(const i of g){
      if(i === lead) continue;
      const P = adj[i].pts; if(!P || P.length < 2) continue;
      const S = _clumpArc(P);
      const NP = new Array(P.length);
      for(let j=0;j<P.length;j++){
        const s = S[j];
        let w = pull * Math.min(1, s / (ramp || 1e-9));
        if(s > Ltot) w *= Math.max(0, 1 - (s - Ltot) / (tail || 1e-9));
        if(w <= 0){ NP[j] = P[j]; continue; }
        const q = _clumpAt(LP, LS, Math.min(s, Ltot));
        const p = P[j];
        NP[j] = { x: p.x + (q.x - p.x)*w, y: p.y + (q.y - p.y)*w, z: p.z + (q.z - p.z)*w };
      }
      out[i] = Object.assign({}, adj[i], { pts: NP });
      moved++;
    }
  }
  if(HAIR_CLUMP3D.log && typeof console !== 'undefined'){
    console.log('[3D·다발] 가닥 ' + adj.length + '개 → 다발 ' + clumps + '개(평균 ' + (clumps ? (sizeSum/clumps).toFixed(1) : 0)
      + '가닥 · 칸 ' + HAIR_CLUMP3D.cellCm + 'cm) · 당긴 가닥 ' + moved + ' · 대표 쪽 ' + Math.round(pull*100) + '%'
      + ' — 끄기 HAIR_CLUMP3D.on=false');
  }
  return out;
}

/* ══════════════════════════════════════════════════════════════════════════
   3D 미리보기 창 옮기기 (2026-09-22)
   사용자: "3D 미리보기 창 브라우저 창처럼 위에 잡고 움직일 수 있으면 좋겠는데."
   헤더(#devMini3DHeader)를 잡고 끌면 창이 따라온다. 마우스·손가락 둘 다(Pointer 이벤트).
   ⚠ 헤더 안의 ⛶·✕ 버튼에서 시작한 끌기는 무시한다 — 안 그러면 버튼이 안 눌린다.
   ⚠ 확대(.expanded) 상태에서는 안 움직인다(그때는 화면을 거의 다 덮는 창이라 옮길 자리가 없다).
   ⚠ 위치는 left/top으로 바꿔 놓는다 — 원래 CSS는 right/bottom 고정이라 둘을 같이 쓰면
     창이 늘어난다. 그래서 잡는 순간 현재 자리를 재서 left/top으로 바꾸고 right/bottom을 푼다.
   화면 밖으로 나가지 않게 가장자리에서 멈춘다(제목이 안 보이면 다시 못 잡는다).
   되돌리기: MINI3D_DRAG.on = false 후 새로고침 · 제자리로: resetMini3DPos()
   ══════════════════════════════════════════════════════════════════════════ */
const MINI3D_DRAG = { on: true, margin: 4 };

function resetMini3DPos(){
  const el = document.getElementById('devMini3D');
  if(!el) return;
  el.style.left = ''; el.style.top = ''; el.style.right = ''; el.style.bottom = '';
}
function installMini3DDrag(){
  if(!MINI3D_DRAG.on) return;
  const el = document.getElementById('devMini3D'), h = document.getElementById('devMini3DHeader');
  if(!el || !h || h._mini3dDrag) return;
  h._mini3dDrag = true;
  h.style.cursor = 'move';
  h.style.touchAction = 'none';          // 손가락 끌기를 스크롤로 뺏기지 않게
  let id = null, dx = 0, dy = 0;
  h.addEventListener('pointerdown', (e)=>{
    if(e.target.closest('button')) return;               // ⛶·✕는 버튼 그대로
    if(el.classList.contains('expanded')) return;        // 확대 상태는 안 옮긴다
    const r = el.getBoundingClientRect();
    // right/bottom 고정을 left/top으로 바꿔 잡는다(둘을 같이 두면 창이 늘어난다)
    el.style.left = r.left + 'px'; el.style.top = r.top + 'px';
    el.style.right = 'auto'; el.style.bottom = 'auto';
    el.style.position = 'fixed';
    dx = e.clientX - r.left; dy = e.clientY - r.top;
    id = e.pointerId; h.setPointerCapture(id);
    e.preventDefault();
  });
  h.addEventListener('pointermove', (e)=>{
    if(id === null || e.pointerId !== id) return;
    const m = MINI3D_DRAG.margin, r = el.getBoundingClientRect();
    const x = Math.max(m, Math.min(window.innerWidth  - r.width  - m, e.clientX - dx));
    const y = Math.max(m, Math.min(window.innerHeight - r.height - m, e.clientY - dy));
    el.style.left = x + 'px'; el.style.top = y + 'px';
  });
  const up = (e)=>{ if(id !== null && e.pointerId === id){ try{ h.releasePointerCapture(id); }catch(_){} id = null; } };
  h.addEventListener('pointerup', up);
  h.addEventListener('pointercancel', up);
}
if(typeof document !== 'undefined'){
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installMini3DDrag);
  else installMini3DDrag();
}
