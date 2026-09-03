/* ══════════════════════════════════════════════════════════
   07a-render-canvas.js — 각도 전환 · 캔버스 렌더 · 지워진 자리 메움 · 경계 배경
   원본 index.html 10381~11385행. 클래식 스크립트이므로 로드 순서가 곧
   실행 순서다 — index.html의 <script src> 순서를 바꾸지 말 것.
   ══════════════════════════════════════════════════════════ */
/* ════════════════════════════════════════
   ANGLE SWITCH
════════════════════════════════════════ */
function renderAngleSwitch(targetId){
  const el=document.getElementById(targetId); if(!el) return; el.innerHTML='';
  ANGLES.forEach(a=>{
    const btn=document.createElement('button');
    btn.textContent=ANGLE_LABELS[a];
    btn.className=state.currentViewAngle===a?'on':'';
    btn.onclick=()=>{
      state.currentViewAngle=a;
      try{ trimDerivedCanvases(a, '뷰 전환'); }catch(e){}   // 안 보는 뷰의 파생 캔버스 반납
      bindStylingToCurrentView();   // 스타일링 슬라이더는 뷰마다 따로다
      renderAngleSwitches();
      updateSegStatus();
      syncSliderUI(); drawAdjustPreview(); drawResult();
    };
    el.appendChild(btn);
  });
}
// 조정/결과 화면 두 각도 스위치를 함께 다시 그리는 헬퍼 — 이 둘을 나란히 호출하는
// 코드가 여러 곳에 그대로 반복되던 것을 하나로 합침
function renderAngleSwitches(){
  renderAngleSwitch('angleSwitch');
  renderAngleSwitch('angleSwitchResult');
}

/* ════════════════════════════════════════
   RENDER / CANVAS
   - 이미지 캐시로 매번 new Image() 방지
   - hairCanvas 없으면 SVG 선 오버레이로 폴백
════════════════════════════════════════ */
const imgCache = {}; // angle → HTMLImageElement (loaded)

function getCachedImg(angle, cb){
  const url = state.shots[angle];
  if(!url){ cb(null); return; }
  if(imgCache[angle] && imgCache[angle].src.endsWith(url.slice(-20))){
    cb(imgCache[angle]); return;
  }
  const img = new Image();
  img.onload = ()=>{ imgCache[angle]=img; cb(img); };
  img.onerror = ()=>cb(null);
  img.src = url;
}

// fit 계산만 하고 실제로 그리지는 않음 (베이스를 원본 대신 baseC로 바로 그릴 때 사용)
// 이건 <b>덮기</b>(cover) — 캔버스를 꽉 채우고 넘치는 쪽은 잘라낸다.
function computeFit(imgW, imgH, w, h){
  const ir=imgW/imgH, cr=w/h;
  let dw,dh,dx,dy;
  if(ir>cr){dh=h;dw=h*ir;dx=(w-dw)/2;dy=0;}
  else{dw=w;dh=w/ir;dx=0;dy=(h-dh)/2;}
  return {dw,dh,dx,dy};
}
/* <b>담기</b>(contain) — 사진 전체가 캔버스 안에 들어오게. 결과 화면 전용.
   (2026-08-02) 실기기(가로가 긴 데스크톱 창)에서 발견: 세로 사진을 cover로 깔면
   가로를 채우느라 세로가 캔버스보다 훨씬 커져서 <b>목·어깨가 프레임 아래로
   잘려나간다</b> — 조정 화면은 어차피 머리만 보면 되니 문제가 안 됐지만, 결과
   화면은 목 아래 의상이 주인공이라 그 구간이 안 보이면 아무것도 안 한 것처럼
   보인다(실제 증상: "조정 화면과 똑같이 나온다"). 결과 화면만 담기로 바꾼다. */
function computeFitContain(imgW, imgH, w, h){
  const ir=imgW/imgH, cr=w/h;
  let dw,dh,dx,dy;
  if(ir>cr){dw=w;dh=w/ir;dx=0;dy=(h-dh)/2;}
  else{dh=h;dw=h*ir;dx=(w-dw)/2;dy=0;}
  return {dw,dh,dx,dy};
}

/* 투명 구멍을 주변 색으로 메운 사본을 만든다(작은 해상도).
   알고리즘: 투명 픽셀 중 "불투명 이웃이 있는" 것부터 그 이웃들의 평균색으로
   채우고, 채워진 픽셀은 다음 회차에서 이웃 역할을 한다 — 경계에서 안쪽으로
   물이 스미듯 번진다. 구멍 반지름만큼 회차를 돌면 완전히 메워진다.
   (거리변환·인페인팅의 아주 단순한 형태. 바탕으로만 쓰므로 이 정도면 충분하다.) */
/* 이 뷰의 사진이 그 슬롯에 맞는지 <b>알리기만</b> 한다(배제하지 않음).
   얼굴 실측 각도로만 판정 — 얼굴이 안 잡힌 뷰는 근거가 없으니 조용히 넘어간다
   (후면은 원래 안 잡히는 게 정상이다). */
const SLOT_YAW_MIN_BACK = 120;  // 후면인데 이보다 정면에 가까우면 뒷머리 사진이 아님
const SLOT_YAW_MIN_SIDE = 15;   // 측면인데 이보다 정면에 가까우면 옆머리 정보가 없음
function warnViewSlotMismatch(angle){
  const lm = state.landmarks && state.landmarks[angle];
  const yaw = (lm && typeof lm.poseYawDeg === 'number') ? lm.poseYawDeg : null;
  if(yaw === null) return;                           // 실측 없음 — 판정 불가
  const a = Math.abs(yaw);
  let bad = null;
  if(angle === 'back'){
    if(a < SLOT_YAW_MIN_BACK) bad = `얼굴이 ${a.toFixed(0)}°로 잡힘 — 뒷머리 사진이 아님`;
  } else if(angle === 'left' || angle === 'right'){
    const want = LIVE_YAW_TARGET[angle];
    if(want && a > SLOT_YAW_MIN_SIDE && (yaw >= 0) !== (want.max > 0)) bad = `반대쪽 옆얼굴(yaw ${yaw.toFixed(0)}°)`;
    else if(a <= SLOT_YAW_MIN_SIDE) bad = `거의 정면(yaw ${yaw.toFixed(0)}°)`;
  } else if(angle === 'front'){
    if(a > 45) bad = `정면 슬롯인데 yaw ${yaw.toFixed(0)}°`;
  }
  if(bad){
    console.warn(`[슬롯 불일치] ${angle} — ${bad}.`
      + ` 이 뷰의 가닥이 반대편(예: 후면 라벨이 앞머리 자리)에 얹혀 3D에서 섞여 보일 수 있습니다.`
      + ` 배제하지 않고 그대로 씁니다 — 다시 촬영하면 정상화됩니다.`);
  }
}

/* ══════════════════════════════════════════════════════════════════
   지워진 머리카락 자리 메우기 (2026-07-27 2차)
   ─────────────────────────────────────────────────────────────────
   baseC는 원본에서 머리카락을 destination-out으로 지운 그림이라, 조정으로
   가닥이 비켜난 자리는 투명 구멍이 되고 페이지 배경(검정)이 비친다.
   그 구멍을 메운 배경을 만들어 baseC 밑에 깐다.

   ── 사용자 설계(2026-07-27) ──
   "피부색 경계는 세그멘테이션이 아니라 두상으로 우리가 잡는 영역으로 잡아야겠네.
     그 외는 목은 신체부위로 잡힐 테니까."
   맞다. 채울 자리는 헤어 세그멘테이션 안이지만, <b>피부로 다뤄야 하는 범위</b>는
   두상이다. 긴 머리가 어깨까지 내려오면 그 구멍은 옷·배경이지 피부가 아니다.
     · 두상 안  → 피부: 주변색 + <b>실제 피부 결</b>, 피부톤 편향 ON
     · 두상 밖  → 주변색만(결 없음), 편향 OFF
   ※ 사람/배경 구분(personMask)은 <b>쓰지 않는다</b> — 둘 다 "주변색만"으로
     처리가 같아서 넣어도 그림이 안 바뀐다. 목에도 결을 넣고 싶어지면
     그때 personMask를 조건에 더하면 된다(자리는 아래 headAt 한 곳).

   ── 왜 두 해상도인가 ──
   색·명암(저주파)은 번지는 계산이라 회차가 구멍 반지름만큼 필요하다 → 160px에서
   싸게 만든다. 반면 피부 결(고주파)은 확대하면 뭉개지므로 <b>원본 해상도</b>에서
   한 번 더한다. 결을 이어붙이는 게 아니라 "색은 주변에서, 결만 실제 피부에서"
   가져오는 방식이라 아무리 넓은 면을 채워도 이음매가 안 생긴다.
══════════════════════════════════════════════════════════════════ */
const HOLE_FILL = {
  lowW: 160,      // 저주파(색·명암) 계산 해상도
  outW: 1200,     // 최종 배경 해상도 상한(피부 결이 보이는 해상도)
                  // (2026-08-10) 900→1200. 두상 <b>밖</b>(어깨·옷·배경)까지 여기서
                  // 제대로 메우게 되면서, 확대해 깔 때 뭉개지면 그게 그대로 "유령"으로 보인다.
  patch: 72,      // 피부 표본 한 변(출력 해상도 기준)
  texture: 1.0,   // 결 세기(1=패치 그대로)
  skinBoost: 3,   // 피부색 이웃 가중(두상 안에서만)
  skinTol: 110,
  dirW: [0.4, 1.0, 2.6], // 위/가운데/아래 이웃 가중 — 살색이 두피로 타고 올라오게
  /* ── 두피 이식 (2026-08-03) ────────────────────────────────────────
     사용자: "머리두피면을 보면 까맣게 보여. 저기 채워지지 않은 자리는 헤어
     세그멘테이션 바깥쪽의 <b>이마 피부 픽셀</b>을 가져와서 옮겨심는 구조가
     있을거야. 그걸 연결해줘."
     맞다 — 구조는 이미 있었다(pickSkinPatch). 다만 <b>결(고주파)만</b> 얹고
     있었다: 그 자리의 <b>색</b>은 여전히 이웃 전파(fillHolesLowRes)가 정했고,
     정수리 근처는 이웃이 거의 전부 <b>배경(벽)</b>이라 흰 벽이, 뒤통수·목덜미
     쪽은 지워진 머리 경계의 어두운 값이 번져 들어왔다. 결만 얹어봐야 그 위에
     찍히는 미세 명암일 뿐이라 "두피면이 까맣다/허옇다"가 그대로 남는다.
     고침: 두상 안 구멍은 <b>색까지 이마 표본에서 가져온다</b>. 번져 들어온
     색은 색으로 안 쓰고 <b>밝기만</b>, 그것도 아래 범위로 <b>제한해서</b> 받는다
     (그늘은 남기되 벽의 흰색·머리의 검정으로는 절대 못 가게).
     ※ 소스와 대상이 같은 사람·같은 조명·같은 카메라라 색을 맞출 필요가 없다 —
       이게 원래 구멍 메움이 통했던 이유고, 그대로 적용된다. */
  graft: {
    on: true,          // false면 예전 동작(결만 얹기) — A/B용
    shadeMin: 0.72,    // 받아들일 밝기 배율 하한(제일 어두운 안쪽 겹)
    shadeMax: 1.12,    // 〃 상한(정수리 하이라이트) — 벽의 흰색이 여기서 잘린다
    edgeFeather: 0.14, // 두상 타원 가장자리 페더(반경 대비) — 이식이 뚝 끊기지 않게
    flatMix: 0.85,     // 표본을 못 떴을 때 두피색 쪽으로 끌어당기는 비율
  },
};

/* 이식용 피부 표본 — 뷰별로 뜨고, 못 뜨면 <b>다른 뷰에서 뜬 것</b>을 재사용한다.
   후면처럼 얼굴이 아예 없는 뷰가 정확히 이 경우다(로그: "back 얼굴 감지 실패").
   같은 사람·같은 조명·같은 카메라라 뷰가 달라도 색을 맞출 필요가 없다. */
let _skinGraft = null;   // { rgb:Uint8ClampedArray(size*size*3), hi:Float32Array, size, lum, src }
function resetSkinGraft(){ _skinGraft = null; }

// 뷰의 두상 영역(정규 좌표) — 정수리~턱을 감싸는 타원. 없으면 null.
function headEllipseFor(angle){
  const b = sectionBandsFor(angle);
  if(!b) return null;
  const top = b.headTopY;
  const bot = (typeof b.chinLineY === 'number') ? b.chinLineY : b.napeTopY;
  if(!(bot > top)) return null;
  const cx = (b.nxMin + b.nxMax) / 2;
  // 실루엣에는 머리숱이 포함돼 있어 두개골보다 넓다 — 조금 좁혀 잡는다.
  const rx = Math.max(0.02, (b.nxMax - b.nxMin) / 2 * 0.92);
  return { cx, cy: (top + bot) / 2, rx, ry: (bot - top) / 2 };
}

/* 얼굴에서 깨끗한 피부 표본을 찾는다(불투명 + 피부색에 가까운 정사각 영역).

   ── 후보 자리 (2026-08-03 수정) ────────────────────────────────────
   주석은 예전부터 "볼 → 턱 → <b>이마</b>"라고 적혀 있었는데 후보 좌표에는
   <b>이마가 아예 없었다</b> — dy가 전부 0 이상(=두상 중심보다 아래)이라
   제일 위가 dy 0.10, 눈 언저리였다. 이식 대상이 <b>두피</b>인데 표본을 볼·턱에서
   뜨면 그림자·수염·턱선 명암이 같이 따라온다. 두피 바로 옆에 붙어 있고 결이
   가장 비슷한 <b>이마</b>(dy 음수 = 중심보다 위)를 후보에 넣고 우대한다.
   ※ 이마 밴드는 앞머리가 걸치기 쉬운 자리라 구멍(투명)이 섞이면 아래
     "불투명 98%" 조건에서 자동으로 탈락한다 — 우대해도 안전하다. */
const SKIN_PATCH_CANDS = [
  // [dx, dy, 우대점수] — 두상 타원 중심 기준(dy<0 = 위쪽 = 이마)
  [ 0.00, -0.28, 0.25], [-0.28, -0.24, 0.22], [ 0.28, -0.24, 0.22],
  [ 0.00, -0.16, 0.20], [-0.40, -0.10, 0.15], [ 0.40, -0.10, 0.15],
  [ 0.00,  0.15, 0.05], [-0.35,  0.10, 0.05], [ 0.35,  0.10, 0.05],
  [-0.55,  0.35, 0.00], [ 0.55,  0.35, 0.00], [-0.50, 0.60, 0.00],
  [ 0.50,  0.60, 0.00], [ 0.00,  0.70, 0.00],
];
function pickSkinPatch(ctx, W, H, ell, skinRGB, size){
  if(!ell) return null;
  const cands = [];
  for(const [dx, dy, bonus] of SKIN_PATCH_CANDS){
    const px = Math.round((ell.cx + ell.rx*dx) * W - size/2);
    const py = Math.round((ell.cy + ell.ry*dy) * H - size/2);
    if(px < 0 || py < 0 || px+size > W || py+size > H) continue;
    const d = ctx.getImageData(px, py, size, size).data;
    let opaque=0, near=0;
    for(let i=0;i<d.length;i+=4){
      if(d[i+3] < 200) continue;
      opaque++;
      const dist = Math.abs(d[i]-skinRGB[0]) + Math.abs(d[i+1]-skinRGB[1]) + Math.abs(d[i+2]-skinRGB[2]);
      if(dist < HOLE_FILL.skinTol) near++;
    }
    const total = size*size;
    if(opaque < total*0.98) continue;            // 구멍이 섞이면 못 씀
    // score = 순수 "피부다움"(합격 판정용), rank = 거기에 이마 우대를 얹은 정렬 키.
    // 우대점수로 <b>합격선을 넘기지는 않게</b> 둘을 분리한다(머리카락 패치 방지).
    /* dy<0 = 이마. 어느 자리에서 떴는지를 <b>들고 나간다</b> (2026-08-11).
       여태 이 정보를 버려서, 로그가 어느 후보가 뽑혔든 "이마 표본"이라고 찍었다.
       그래서 눈 언저리에서 떠 와도 아무도 몰랐다. */
    cands.push({ px, py, dx, dy, forehead: dy < 0, score: near/total, rank: near/total + bonus });
  }
  if(!cands.length) return null;
  cands.sort((a,b)=> b.rank - a.rank);
  const best = cands.find(c => c.score > 0.5);   // 절반도 피부색이 아니면 못 씀
  return best || null;
}

/* 이마 표본을 떠서 "이식 재료"로 만든다.
     rgb — 패치 원본 픽셀(색 + 결). 이식은 이걸 통째로 옮겨 심는다.
     hi  — 패치 − 흐린 패치 = 결만(예전 동작 A/B용으로 남겨둔다).
     lum — 패치 평균 밝기. 대상 자리의 밝기를 이 값 대비 배율로 환산할 때 기준. */
function buildSkinGraft(hctx, ow, oh, ell, skinRGB, size, angle){
  const patch = pickSkinPatch(hctx, ow, oh, ell, skinRGB, size);
  if(!patch) return null;
  const pc = document.createElement('canvas'); pc.width = size; pc.height = size;
  const pctx = pc.getContext('2d', { willReadFrequently:true });
  pctx.drawImage(hctx.canvas, patch.px, patch.py, size, size, 0, 0, size, size);
  const sharp = pctx.getImageData(0, 0, size, size).data;
  /* 흐린 판 — 색·밝기는 여기 다 들어있으므로 빼고 나면 결(모공·잔털·미세 명암)만 남는다. */
  const bs = Math.max(2, size >> 3);
  const bc = document.createElement('canvas'); bc.width = bs; bc.height = bs;
  const bctx = bc.getContext('2d', { willReadFrequently:true });
  bctx.imageSmoothingEnabled = true;
  bctx.drawImage(pc, 0, 0, bs, bs);
  pctx.clearRect(0, 0, size, size);
  pctx.drawImage(bc, 0, 0, size, size);
  const blur = pctx.getImageData(0, 0, size, size).data;

  const rgb = new Uint8ClampedArray(size*size*3);
  const hi  = new Float32Array(size*size*3);
  let lumSum = 0;
  for(let i=0, k=0; i<sharp.length; i+=4, k+=3){
    rgb[k]   = sharp[i];   hi[k]   = sharp[i]   - blur[i];
    rgb[k+1] = sharp[i+1]; hi[k+1] = sharp[i+1] - blur[i+1];
    rgb[k+2] = sharp[i+2]; hi[k+2] = sharp[i+2] - blur[i+2];
    lumSum += 0.299*sharp[i] + 0.587*sharp[i+1] + 0.114*sharp[i+2];
  }
  return { rgb, hi, size, lum: lumSum / (size*size), src: angle || '?', at: patch,
           forehead: !!patch.forehead, dy: patch.dy };
}

// 저해상도 이웃 전파 — 투명 픽셀을 주변 색으로 채운다(두상 안에서만 피부톤 편향).
function fillHolesLowRes(srcCanvas, w, h, skinRGB, ell){
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently:true });
  ctx.drawImage(srcCanvas, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  const OPAQUE = 200;
  const inHead = (x, y)=>{
    if(!ell) return false;
    const nx = (x + 0.5)/w, ny = (y + 0.5)/h;
    const u = (nx - ell.cx)/ell.rx, v = (ny - ell.cy)/ell.ry;
    return u*u + v*v <= 1;
  };
  const MAX_PASS = Math.ceil(Math.hypot(w, h));
  for(let pass=0; pass<MAX_PASS; pass++){
    const fill = [];
    for(let y=0; y<h; y++){
      for(let x=0; x<w; x++){
        const i = (y*w+x)*4;
        if(d[i+3] >= OPAQUE) continue;
        const head = skinRGB && inHead(x, y);
        let r=0,g=0,b=0,n=0;
        for(let dy=-1; dy<=1; dy++){
          const yy = y+dy; if(yy<0||yy>=h) continue;
          for(let dx=-1; dx<=1; dx++){
            const xx = x+dx; if(xx<0||xx>=w||(dx===0&&dy===0)) continue;
            const j = (yy*w+xx)*4;
            if(d[j+3] < OPAQUE) continue;
            let ww = HOLE_FILL.dirW[dy+1];
            if(head){
              const dist = Math.abs(d[j]-skinRGB[0]) + Math.abs(d[j+1]-skinRGB[1]) + Math.abs(d[j+2]-skinRGB[2]);
              ww *= 1 + HOLE_FILL.skinBoost * Math.max(0, 1 - dist / HOLE_FILL.skinTol);
            }
            r+=d[j]*ww; g+=d[j+1]*ww; b+=d[j+2]*ww; n+=ww;
          }
        }
        if(n) fill.push(i, r/n, g/n, b/n);
      }
    }
    if(!fill.length) break;
    for(let k=0; k<fill.length; k+=4){
      const i = fill[k];
      d[i]=fill[k+1]; d[i+1]=fill[k+2]; d[i+2]=fill[k+3]; d[i+3]=255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/* ══════════════════════════════════════════════════════════════════
   렌더링 경계 배경 (2026-08-10)
   ─────────────────────────────────────────────────────────────────
   증상(사용자): "렌더링 주변에 <b>다른 마스크들이 겹쳐</b> 있어."
   결과 사진에서 새 헤어 바깥으로 <b>원래 머리 실루엣 모양</b>의 뿌연 회색·살구색
   덩어리와, 그 덩어리를 따라 도는 <b>검은 톱니 테두리</b>가 같이 보인다.
   원인은 둘이고, 둘 다 "지운 자리를 어떻게 메우느냐"에 있다.

   [원인 1] 검은 톱니 테두리 = <b>반투명 머리카락 테두리 잔상</b>
     baseC는 원본에서 머리 마스크를 destination-out으로 지운 그림이다. 마스크를
     작은 세그멘테이션 해상도에서 원본 크기로 <b>확대</b>해 지우기 때문에 경계
     픽셀의 알파가 0도 255도 아닌 중간값이 된다. 그 자리엔 <b>검은 머리색이
     반쯤 남는다</b>. 구멍 메움은 알파 200 이상을 "원래 있던 픽셀"로 보고 안
     건드렸으므로(옛 코드 holeA[i+3] >= 200), 그 반투명 머리 테두리는 끝까지
     살아남아 메운 배경 <b>위에</b> 얹혔다 — 화면의 톱니 윤곽이 정확히 이것이다.
     → 고침: 알파 250 미만을 전부 구멍으로 보고, 거기서 몇 px 더 <b>부풀려</b>
       지운다. 테두리를 살릴 이유가 없다 — 어차피 새 헤어가 덮거나 배경이다.

   [원인 2] 뿌연 덩어리 = <b>160px 확산 결과를 확대</b>한 것
     메움은 160px로 줄여 이웃 평균을 반복 전파(fillHolesLowRes)한 뒤 900px로
     늘려 썼다. 두상 <b>안</b>은 그 위에 이마 표본을 이식하니 티가 안 났지만,
     두상 <b>밖</b>(어깨·옷·창밖 배경)은 "손대지 않음"이라 그 뭉갠 회색이
     그대로 남는다. 긴 머리를 지운 자리가 통째로 그 상태다.
     → 고침: 두상 밖도 <b>출력 해상도에서</b> 메운다. 방식은 확산 평균이 아니라
       <b>방향성 인페인팅</b> — 구멍의 각 픽셀에서 상·하·좌·우로 나가 처음
       만나는 "아는 픽셀"을 찾고, 거리의 역제곱으로 섞는다.
       배경은 행 방향으로 대체로 균일하므로(창틀·니트 짜임·벽) 좌우에서 오는
       색이 가깝고 강하게 잡혀, 스웨터 자리는 스웨터로 창 자리는 창으로 메워진다.
       마지막에 주변에서 잰 만큼의 미세 잡티를 얹어 "너무 매끈해서 티 나는"
       면을 없앤다.

   ※ 새 라이브러리를 안 쓴 이유: 인페인팅 한 번이 아니라 <b>뷰마다 매번</b>
     돌아야 하고(4뷰 × 조정할 때마다), 위 두 사정(행 균일 배경 + 이미 있는
     두상 이식)이면 4방향 스윕으로 충분하다. 스윕은 픽셀당 상수시간이다.
══════════════════════════════════════════════════════════════════ */
const RENDER_PLATE = {
  on: true,          // false면 예전 동작(테두리 잔상 + 160px 확산) — A/B용
  alphaHole: 250,    // 이 알파 미만은 전부 구멍(=반투명 머리 테두리도 구멍)
  dilatePx: 3,       // 구멍 부풀림(원본 해상도 px) — 마스크 확대로 생긴 반투명 띠 제거용
  featherPx: 1.0,    // 깎은 자리와 원본 사이 경계 부드럽게(px)
  power: 2.0,        // 방향성 인페인팅 가중 = 1/거리^power
  relax: 8,          // 스윕 뒤 구멍만 3×3 평균 회차(빗살무늬 제거) — 0이면 끔
  grain: 0.55,       // 거울 결을 못 가져왔을 때 얹는 잡티 세기(0=끔)
  /* ── 남은 머리 테두리 걷어내기 (2026-08-10 2차) ────────────────────────
     사용자: "블러 시도는 좋은데, 그 이전에 <b>겹친 마스크 자체가 제거되지</b>
     않았어."
     맞다. 1차에서는 알파가 애매한 <b>몇 px</b>만 구멍으로 넘겼는데, 실제로
     남아 있던 건 그게 아니었다 — MediaPipe 헤어 마스크가 <b>진짜 머리보다 작게</b>
     잡혀서, 지운 자리 둘레에 <b>원본 머리카락이 온전한 알파 255로</b> 10~20px씩
     띠로 남아 있다. 그 띠는 "아는 픽셀"이라 지워지지도 않고, 더 나쁘게는
     인페인팅이 <b>그 어두운 머리색을 정답으로 보고 안쪽으로 퍼뜨렸다</b>.
     후면 목덜미의 검은 얼룩이 정확히 그것이다(메운 면이 회색 108, 니트는 170).
     고침: 구멍 둘레에서 <b>머리색에 가까운 픽셀만</b> 골라 최대 maxPx까지
     한 겹씩 구멍으로 넘긴다. 색으로 거르므로 니트·피부·배경은 안 먹는다.
     ※ 반경을 상한으로 묶는 이유: 금발처럼 머리색이 배경색과 가까우면 색만으로는
       못 멈춘다. 상한이 안전장치다. 로그의 "테두리 회수"가 크게 튀면 tol을 줄일 것. */
  rim: { on: true, tol: 96, minPx: 4, maxPx: 18 },
  /* 거울 결 — 메운 면이 <b>매끈해서</b> 티가 나는 문제. 색·명암은 인페인팅이 만든
     것을 그대로 쓰고, <b>고주파(니트 짜임·배경 입자)만</b> 경계 건너편에서 거울로
     비춰 가져온다. 두상 안에서 이미 쓰는 "색은 주변, 결은 실제 피부" 방식과 같다. */
  detail: 0.75,      // 거울 결 세기(0=끔 — 매끈해도 좋으면 0)
  detailBlurPx: 2,   // 이 반경보다 <b>고운 것만</b> 결로 본다. 키우면 선반 선 같은
                     // 큰 구조까지 거울로 넘어와 겹쳐 보인다(오프라인 테스트로 확인).
};

/* 플래그 팽창 — 분리형 슬라이딩 최대값(가로 한 번, 세로 한 번). O(픽셀). */
function dilateFlags(flags, w, h, r){
  if(!(r > 0)) return flags;
  const tmp = new Uint8Array(w*h);
  for(let y=0; y<h; y++){
    const row = y*w;
    let cnt = 0;
    for(let x=0; x<=Math.min(r, w-1); x++) cnt += flags[row+x];
    for(let x=0; x<w; x++){
      tmp[row+x] = cnt > 0 ? 1 : 0;
      const add = x+r+1, sub = x-r;
      if(add < w) cnt += flags[row+add];
      if(sub >= 0) cnt -= flags[row+sub];
    }
  }
  for(let x=0; x<w; x++){
    let cnt = 0;
    for(let y=0; y<=Math.min(r, h-1); y++) cnt += tmp[y*w+x];
    for(let y=0; y<h; y++){
      flags[y*w+x] = cnt > 0 ? 1 : 0;
      const add = y+r+1, sub = y-r;
      if(add < h) cnt += tmp[add*w+x];
      if(sub >= 0) cnt -= tmp[sub*w+x];
    }
  }
  return flags;
}

/* 구멍 둘레의 <b>남은 머리카락</b>을 색으로 골라 구멍에 편입한다.
   한 겹씩(= 1px씩) 바깥으로 나가며, 구멍에 닿아 있고 색이 머리색에 가까운
   픽셀만 넘긴다. 색 조건이 있어 니트·피부·배경에서는 저절로 멈춘다.
   d: baseC의 RGBA (구멍은 알파 0, 남은 머리는 알파 255 + 원본 머리색). */
function growHairRim(hole, d, w, h, hair, tol, maxIter){
  let added = 0;
  for(let it=0; it<maxIter; it++){
    const add = [];
    for(let y=0; y<h; y++){
      for(let x=0; x<w; x++){
        const p = y*w+x;
        if(hole[p]) continue;
        const adj = (x>0 && hole[p-1]) || (x<w-1 && hole[p+1])
                 || (y>0 && hole[p-w]) || (y<h-1 && hole[p+w]);
        if(!adj) continue;
        const i = p*4;
        if(d[i+3] < 250) continue;
        const dist = Math.abs(d[i]-hair[0]) + Math.abs(d[i+1]-hair[1]) + Math.abs(d[i+2]-hair[2]);
        if(dist <= tol) add.push(p);
      }
    }
    if(!add.length) break;
    for(let k=0; k<add.length; k++) hole[add[k]] = 1;
    added += add.length;
  }
  return added;
}

/* 플래그 축소 — 한 칸이라도 구멍이면 구멍(최대값 풀링).
   메움 배경은 원본보다 작은 해상도에서 만들 수 있는데, 평균으로 줄이면
   가장자리 한 겹이 "구멍 아님"으로 살아나 그 자리에 다시 테두리가 생긴다. */
function downsampleFlagsMax(src, sw, sh, dw, dh){
  if(sw === dw && sh === dh) return src.slice();
  const out = new Uint8Array(dw*dh);
  for(let y=0; y<dh; y++){
    const y0 = Math.floor(y*sh/dh), y1 = Math.max(y0+1, Math.floor((y+1)*sh/dh));
    for(let x=0; x<dw; x++){
      const x0 = Math.floor(x*sw/dw), x1 = Math.max(x0+1, Math.floor((x+1)*sw/dw));
      let v = 0;
      for(let yy=y0; yy<y1 && !v; yy++){
        for(let xx=x0; xx<x1; xx++){ if(src[yy*sw+xx]){ v=1; break; } }
      }
      out[y*dw+x] = v;
    }
  }
  return out;
}

/* 이 뷰에서 "메워야 할 자리"의 <b>단 하나의</b> 정의 — baseC에 붙여 캐시한다.
   테두리 정리(baseC)와 메움 배경(fillC)이 <b>같은</b> 구멍을 봐야 한다.
   서로 1px이라도 어긋나면 그 틈으로 원본 머리색이 실선처럼 남는다. */
function buildHoleMask(baseC, maskInf){
  const w = baseC.width, h = baseC.height;
  const d = baseC.getContext('2d').getImageData(0, 0, w, h).data;
  const hole = new Uint8Array(w*h);
  let n0 = 0;
  for(let p=0, i=3; p<hole.length; p++, i+=4){ if(d[i] < RENDER_PLATE.alphaHole){ hole[p]=1; n0++; } }
  dilateFlags(hole, w, h, Math.max(1, Math.round(RENDER_PLATE.dilatePx)));
  let nRim = 0, rimIter = 0;
  const R = RENDER_PLATE.rim;
  let hair = null;
  const m = maskInf && maskInf.avgColor && String(maskInf.avgColor).match(/\d+/g);
  if(m && m.length >= 3) hair = [+m[0], +m[1], +m[2]];
  if(R.on && hair && n0){
    rimIter = Math.max(R.minPx, Math.min(R.maxPx, Math.round(h*0.035)));
    nRim = growHairRim(hole, d, w, h, hair, R.tol, rimIter);
  }
  return { hole, w, h, n0, nRim, rimIter, hair };
}
function getHoleMask(baseC, maskInf){
  if(!baseC) return null;
  if(baseC._holeMask) return baseC._holeMask;
  let hm = null;
  try{ hm = buildHoleMask(baseC, maskInf); }
  catch(e){ console.warn('구멍 마스크 생성 실패:', e); }
  baseC._holeMask = hm;
  return hm;
}

/* 방향성 인페인팅 — 구멍 픽셀마다 ←→↑↓ 네 방향으로 처음 만나는 "아는 픽셀"을
   거리 역제곱으로 섞는다. 스윕 4번, 픽셀당 상수시간.
   d: RGBA Uint8ClampedArray(w*h*4) — 구멍 자리는 여기서 덮어쓴다.
   hole: Uint8Array(w*h) 1=구멍. */
function inpaintDirectional(d, hole, w, h, power){
  const n = w*h;
  const acc = new Float32Array(n*3), wsum = new Float32Array(n);
  const P = (power > 0) ? power : 2;
  const put = (p, dist, r, g, b)=>{
    const ww = 1 / Math.pow(dist, P);
    acc[p*3] += r*ww; acc[p*3+1] += g*ww; acc[p*3+2] += b*ww; wsum[p] += ww;
  };
  // ← 왼쪽에서 오른쪽
  for(let y=0; y<h; y++){
    let lx = -1, r=0, g=0, b=0;
    for(let x=0; x<w; x++){
      const p = y*w+x;
      if(!hole[p]){ lx = x; r = d[p*4]; g = d[p*4+1]; b = d[p*4+2]; continue; }
      if(lx >= 0) put(p, x-lx, r, g, b);
    }
  }
  // → 오른쪽에서 왼쪽
  for(let y=0; y<h; y++){
    let lx = -1, r=0, g=0, b=0;
    for(let x=w-1; x>=0; x--){
      const p = y*w+x;
      if(!hole[p]){ lx = x; r = d[p*4]; g = d[p*4+1]; b = d[p*4+2]; continue; }
      if(lx >= 0) put(p, lx-x, r, g, b);
    }
  }
  // ↓ 위에서 아래
  for(let x=0; x<w; x++){
    let ly = -1, r=0, g=0, b=0;
    for(let y=0; y<h; y++){
      const p = y*w+x;
      if(!hole[p]){ ly = y; r = d[p*4]; g = d[p*4+1]; b = d[p*4+2]; continue; }
      if(ly >= 0) put(p, y-ly, r, g, b);
    }
  }
  // ↑ 아래에서 위
  for(let x=0; x<w; x++){
    let ly = -1, r=0, g=0, b=0;
    for(let y=h-1; y>=0; y--){
      const p = y*w+x;
      if(!hole[p]){ ly = y; r = d[p*4]; g = d[p*4+1]; b = d[p*4+2]; continue; }
      if(ly >= 0) put(p, ly-y, r, g, b);
    }
  }
  let filled = 0, unreached = 0;
  for(let p=0; p<n; p++){
    if(!hole[p]) continue;
    const s = wsum[p];
    if(s > 0){
      d[p*4]   = acc[p*3]  /s;
      d[p*4+1] = acc[p*3+1]/s;
      d[p*4+2] = acc[p*3+2]/s;
      filled++;
    } else unreached++;
    d[p*4+3] = 255;   // 메운 배경은 언제나 불투명(검정 비침 방지)
  }
  return { filled, unreached };
}

/* 줄무늬 지우기 — 4방향 스윕만 쓰면 넓은 구멍 <b>안쪽</b>에서 가로/세로 어느
   방향이 이기느냐가 픽셀마다 갈려 빗살무늬가 생긴다(테스트로 확인됨).
   구멍 픽셀만 골라 3×3 평균을 몇 번 돌리면 그 무늬가 사라진다 — 경계에 붙은
   구멍 픽셀은 매번 <b>아는 픽셀</b> 쪽으로 다시 당겨지므로, 가장자리 색은
   그대로 두고 안쪽만 매끄럽게 이어진다(라플라스 메움과 같은 수렴).
   스윕 결과가 이미 정답에 가까운 출발점이라 회차가 조금이면 된다. */
function relaxHoles(d, hole, w, h, iters){
  const n = w*h;
  if(!(iters > 0)) return;
  const buf = new Float32Array(n*3);
  for(let it=0; it<iters; it++){
    for(let p=0; p<n; p++){ buf[p*3]=d[p*4]; buf[p*3+1]=d[p*4+1]; buf[p*3+2]=d[p*4+2]; }
    for(let y=0; y<h; y++){
      for(let x=0; x<w; x++){
        const p = y*w+x;
        if(!hole[p]) continue;
        let r=0,g=0,b=0,c=0;
        for(let dy=-1; dy<=1; dy++){
          const yy=y+dy; if(yy<0||yy>=h) continue;
          for(let dx=-1; dx<=1; dx++){
            const xx=x+dx; if(xx<0||xx>=w) continue;
            const q=(yy*w+xx)*3;
            r+=buf[q]; g+=buf[q+1]; b+=buf[q+2]; c++;
          }
        }
        if(!c) continue;
        d[p*4]=r/c; d[p*4+1]=g/c; d[p*4+2]=b/c;
      }
    }
  }
}

/* 거울 결 — 메운 면에 <b>실제 사진의 결</b>을 얹는다.
   인페인팅은 색·명암(저주파)은 잘 잇지만 결과가 유리처럼 매끈해서, 니트 짜임과
   배경 입자가 살아 있는 주변과 붙여 놓으면 그 매끈함만으로 "여기 메웠다"가 보인다.
   구멍 픽셀마다 <b>가장 가까운 경계</b>를 찾아 그 건너편(거울 대칭 위치)의
   고주파(원본 − 흐린 원본)를 가져와 더한다. 저주파는 인페인팅 것을 그대로 쓰므로
   큰 구조가 복제되지 않고 <b>결만</b> 옮겨온다.
   blurD: 같은 그림을 detailBlurPx로 흐린 것. 둘의 차가 곧 결이다. */
function mirrorDetail(d, blurD, hole, w, h, strength){
  const n = w*h;
  const bestD = new Float32Array(n).fill(Infinity);
  const srcI  = new Int32Array(n).fill(-1);
  const cand = (p, dist, q)=>{ if(dist < bestD[p]){ bestD[p]=dist; srcI[p]=q; } };
  // ← : 왼쪽 경계 lx, 거울 위치 lx-(x-lx)
  for(let y=0; y<h; y++){
    let lx=-1;
    for(let x=0; x<w; x++){
      const p=y*w+x;
      if(!hole[p]){ lx=x; continue; }
      if(lx<0) continue;
      const dist=x-lx, mx=lx-dist;
      if(mx>=0) cand(p, dist, y*w+mx);
    }
  }
  // →
  for(let y=0; y<h; y++){
    let lx=-1;
    for(let x=w-1; x>=0; x--){
      const p=y*w+x;
      if(!hole[p]){ lx=x; continue; }
      if(lx<0) continue;
      const dist=lx-x, mx=lx+dist;
      if(mx<w) cand(p, dist, y*w+mx);
    }
  }
  // ↓
  for(let x=0; x<w; x++){
    let ly=-1;
    for(let y=0; y<h; y++){
      const p=y*w+x;
      if(!hole[p]){ ly=y; continue; }
      if(ly<0) continue;
      const dist=y-ly, my=ly-dist;
      if(my>=0) cand(p, dist, my*w+x);
    }
  }
  // ↑
  for(let x=0; x<w; x++){
    let ly=-1;
    for(let y=h-1; y>=0; y--){
      const p=y*w+x;
      if(!hole[p]){ ly=y; continue; }
      if(ly<0) continue;
      const dist=ly-y, my=ly+dist;
      if(my<h) cand(p, dist, my*w+x);
    }
  }
  let used = 0;
  for(let p=0; p<n; p++){
    if(!hole[p]) continue;
    const q = srcI[p];
    if(q < 0 || hole[q]) continue;       // 거울 자리가 또 구멍이면 결을 못 가져온다
    for(let ch=0; ch<3; ch++){
      const hf = d[q*4+ch] - blurD[q*4+ch];
      d[p*4+ch] = Math.max(0, Math.min(255, d[p*4+ch] + hf*strength));
    }
    used++;
  }
  return used;
}

/* 메운 면에 잡티 얹기 — 인페인팅 결과는 완전히 매끈해서, 사진 잡티가 있는
   주변과 붙여 놓으면 그 매끈함 자체가 "여기 메웠다"고 알려준다.
   세기는 지어내지 않고 <b>주변 아는 픽셀의 가로 이웃 차이</b>에서 실측한다.
   난수는 픽셀 좌표 해시(결정적) — 다시 그려도 무늬가 안 바뀌어 깜빡임이 없다. */
function addGrainToHoles(d, hole, w, h, strength){
  let sum = 0, n = 0;
  for(let y=1; y<h-1; y+=3){
    for(let x=1; x<w-2; x+=3){
      const p = y*w+x;
      if(hole[p] || hole[p+1]) continue;
      const l1 = 0.299*d[p*4]   + 0.587*d[p*4+1]   + 0.114*d[p*4+2];
      const l2 = 0.299*d[p*4+4] + 0.587*d[p*4+5]   + 0.114*d[p*4+6];
      sum += Math.abs(l1-l2); n++;
    }
  }
  if(!n) return 0;
  const sigma = Math.min(6, (sum/n) * 0.8) * strength;
  if(sigma < 0.3) return 0;
  for(let p=0; p<w*h; p++){
    if(!hole[p]) continue;
    let s = (Math.imul(p, 2654435761)) >>> 0;
    s ^= s >>> 15; s = Math.imul(s, 2246822519) >>> 0; s ^= s >>> 13;
    const nz = ((s & 1023)/1023 - 0.5) * 2 * sigma;
    d[p*4]   = Math.max(0, Math.min(255, d[p*4]   + nz));
    d[p*4+1] = Math.max(0, Math.min(255, d[p*4+1] + nz));
    d[p*4+2] = Math.max(0, Math.min(255, d[p*4+2] + nz));
  }
  return sigma;
}

/* baseC 테두리 정리 — 반투명 머리 잔상(검은 톱니 윤곽)을 <b>완전히</b> 떨군다.
   알파 250 미만은 전부 버리고 몇 px 더 깎은 뒤, 그 경계만 살짝 페더링한다.
   깎여 나간 자리는 아래 깔린 메움 배경이 이미 채우고 있으므로 구멍이 안 생긴다. */
function buildCleanBaseCanvas(baseC, maskInf){
  const w = baseC.width, h = baseC.height;
  if(!w || !h) return baseC;
  const hm = getHoleMask(baseC, maskInf);
  if(!hm || !hm.n0) return baseC;
  const hole = hm.hole;

  const mc = document.createElement('canvas'); mc.width = w; mc.height = h;
  const mx = mc.getContext('2d');
  const md = mx.createImageData(w, h);
  for(let p=0; p<hole.length; p++){
    const i = p*4;
    md.data[i] = md.data[i+1] = md.data[i+2] = 255;
    md.data[i+3] = hole[p] ? 0 : 255;
  }
  mx.putImageData(md, 0, 0);

  const out = document.createElement('canvas'); out.width = w; out.height = h;
  const ox = out.getContext('2d');
  ox.drawImage(baseC, 0, 0);
  ox.globalCompositeOperation = 'destination-in';
  if(RENDER_PLATE.featherPx > 0) ox.filter = `blur(${RENDER_PLATE.featherPx}px)`;
  ox.drawImage(mc, 0, 0);
  ox.filter = 'none';
  ox.globalCompositeOperation = 'source-over';
  out._holePx = hm.n0 + hm.nRim;
  return out;
}

/* 테두리 정리한 baseC — baseC 객체에 붙여 캐시(baseC가 새로 만들어지면 자동 무효). */
function getCleanBaseCanvas(baseC, maskInf){
  if(!baseC) return baseC;
  if(!RENDER_PLATE.on) return baseC;
  if(baseC._cleanBase) return baseC._cleanBase;
  let c = baseC;
  try{ c = buildCleanBaseCanvas(baseC, maskInf) || baseC; }
  catch(e){ console.warn('베이스 테두리 정리 실패(원본 사용):', e); c = baseC; }
  baseC._cleanBase = c;
  return c;
}

/* 최종 배경 생성. skinColor가 없으면 결 없이 색만 채운다(안전 폴백). */
function buildHoleFillCanvas(srcCanvas, skinColor, ell, angle, holeMaskInfo){
  const sw = srcCanvas.width, sh = srcCanvas.height;
  if(!sw || !sh) return null;
  let skinRGB = null;
  if(skinColor){
    const m = String(skinColor).match(/\d+/g);
    if(m && m.length>=3) skinRGB = [+m[0], +m[1], +m[2]];
  }
  const lw = Math.max(16, Math.min(HOLE_FILL.lowW, sw));
  const lh = Math.max(16, Math.round(sh * (lw / sw)));
  const low = fillHolesLowRes(srcCanvas, lw, lh, skinRGB, ell);

  const ow = Math.max(32, Math.min(HOLE_FILL.outW, sw));
  const oh = Math.max(32, Math.round(sh * (ow / sw)));
  const out = document.createElement('canvas'); out.width = ow; out.height = oh;
  const octx = out.getContext('2d', { willReadFrequently:true });
  octx.imageSmoothingEnabled = true;
  /* ── 이 캔버스는 <b>반드시 불투명</b>해야 한다 (2026-08-02 12차) ────────────
     사용자: "아직 베이스C 안 깔리는 거 같아. 까매."
     11차에서 "메움 배경이 <b>없을 때</b>"의 검정은 막았는데, 메움 배경이
     <b>있는데 그 안에 투명이 남은</b> 경우가 남아 있었다. low(저해상도 전파)는
     이웃이 전부 투명한 구멍(예: 마스크가 프레임 가장자리에 닿아 씨앗이 없는
     자리)을 못 채우고, 그 투명이 여기로 그대로 확대돼 넘어온다. 그 위에 얹히는
     baseC도 같은 자리가 투명이니 결국 페이지 배경(검정)이 비친다.
     그래서 <b>먼저 두피색으로 한 번 칠하고</b> 그 위에 low를 얹는다. low가
     채운 자리는 그대로고, 못 채운 자리만 두피색이 된다 — 검정은 못 나온다. */
  octx.fillStyle = skinRGB ? `rgb(${skinRGB[0]},${skinRGB[1]},${skinRGB[2]})` : 'rgb(224,178,148)';
  octx.fillRect(0, 0, ow, oh);
  octx.drawImage(low, 0, 0, ow, oh);           // 저주파(색·명암) — 아래 스윕이 못 닿는 자리의 안전망

  // 어디가 구멍인지(=원본이 투명했던 자리) 출력 해상도로 다시 읽는다
  const hc = document.createElement('canvas'); hc.width = ow; hc.height = oh;
  const hctx = hc.getContext('2d', { willReadFrequently:true });
  hctx.drawImage(srcCanvas, 0, 0, ow, oh);
  const holeA = hctx.getImageData(0, 0, ow, oh).data;

  /* ── 렌더링 경계 배경 (2026-08-10) ────────────────────────────────
     ① 원본 픽셀을 출력 해상도로 얹는다 — 인페인팅이 참조할 "아는 픽셀".
        (예전엔 low를 확대한 뿌연 값이 유일한 참조였다.)
     ② 알파 250 미만 + 몇 px 부풀림 = 구멍. 반투명 머리 테두리가 여기 포함되어
        검은 톱니 윤곽이 사라진다.
     ③ 4방향 스윕으로 메우고 주변에서 잰 만큼 잡티를 얹는다.
     두상 안은 아래 이식 루프가 색까지 다시 덮으므로, 여기 결과는 두상 <b>밖</b>
     (어깨·옷·배경)에서 그대로 최종이 된다 — 유령 덩어리가 없어지는 자리다. */
  let plateDiag = null;
  let hole = new Uint8Array(ow*oh);
  if(RENDER_PLATE.on){
    octx.drawImage(srcCanvas, 0, 0, ow, oh);   // ① 아는 픽셀(구멍은 투명이라 안 덮임)
    /* 구멍 정의는 <b>테두리 정리와 같은 것</b>을 쓴다(getHoleMask). 원본 해상도에서
       한 번 만들어(알파 + 부풀림 + 머리색 테두리 회수) 여기로 축소해 온다.
       두 곳에서 따로 재면 1px 어긋난 자리에 원본 머리색이 실선으로 남는다. */
    const hm = getHoleMask(srcCanvas, holeMaskInfo);
    if(hm) hole = downsampleFlagsMax(hm.hole, hm.w, hm.h, ow, oh);
    else { for(let p=0, i=3; p<hole.length; p++, i+=4) hole[p] = holeA[i] < RENDER_PLATE.alphaHole ? 1 : 0; }
    const pimg = octx.getImageData(0, 0, ow, oh), pd = pimg.data;
    const res = inpaintDirectional(pd, hole, ow, oh, RENDER_PLATE.power); // ②
    relaxHoles(pd, hole, ow, oh, RENDER_PLATE.relax);                     // ③ 빗살무늬 제거
    /* ④ 거울 결 — 흐린 판을 한 장 떠서 고주파를 경계 건너편에서 가져온다. */
    let nDetail = 0, sigma = 0;
    if(RENDER_PLATE.detail > 0){
      const bc = document.createElement('canvas'); bc.width = ow; bc.height = oh;
      const bx = bc.getContext('2d', { willReadFrequently:true });
      octx.putImageData(pimg, 0, 0);
      bx.filter = `blur(${RENDER_PLATE.detailBlurPx}px)`;
      bx.drawImage(out, 0, 0);
      bx.filter = 'none';
      const blurD = bx.getImageData(0, 0, ow, oh).data;
      nDetail = mirrorDetail(pd, blurD, hole, ow, oh, RENDER_PLATE.detail);
    }
    if(!nDetail) sigma = addGrainToHoles(pd, hole, ow, oh, RENDER_PLATE.grain);
    octx.putImageData(pimg, 0, 0);
    plateDiag = { sigma, detail: nDetail,
                  rim: hm ? hm.nRim : 0, rimIter: hm ? hm.rimIter : 0,
                  hair: hm ? hm.hair : null, ...res };
  } else {
    for(let p=0, i=3; p<hole.length; p++, i+=4) hole[p] = holeA[i] < 200 ? 1 : 0;
  }
  logRenderPlateOnce(angle, plateDiag, ow, oh);

  if(!skinRGB || !ell) return out;             // 결 없이 색만 — 폴백

  const size = Math.min(Math.max(24, Math.round(HOLE_FILL.patch * ow / 900)), ow>>1, oh>>1);
  /* ── 이마 표본 확보 ─────────────────────────────────────────────
     이 뷰에서 뜬다 → 못 뜨면 다른 뷰(대개 정면)에서 뜬 것을 쓴다.
     정면 표본은 늘 최신으로 보관한다(얼굴이 가장 크게·정면으로 나오는 뷰). */
  /* ── 이마가 아니면 <b>남의 이마</b>를 쓴다 (2026-08-11) ────────────────────
     사용자: "이마에서 픽셀만 떼어와서 심으라고 했는데 눈까지 떼어왔어?"
     맞다. SKIN_PATCH_CANDS는 14자리인데 이마(dy<0)는 위 6개뿐이고 나머지는
     볼·턱·목이다. 이마는 <b>우대점수</b>일 뿐 필수가 아니었다. 그런데 우대는
     합격선을 못 넘기게 일부러 분리해 놨으므로, 이마가 떨어지면 우대는 못 구한다.

     그리고 이 손님처럼 <b>앞머리가 이마를 통째로 덮으면</b> 그 자리는 원본 머리를
     지운 뒤라 투명이고, "불투명 98%" 조건에서 이마 후보 여섯이 <b>전부</b> 탈락한다.
     남는 최상위가 dy +0.10~0.15 — 위 주석이 "눈 언저리"라고 적어둔 바로 그 줄이다.
     떠온 24px 패치를 46px 주기 거울 타일로 만 픽셀에 깔므로, 그 안에 눈이 있으면
     화면에 눈이 수십 번 찍힌다(사용자가 본 "실루엣 둘레의 눈동자").

     고침 — 우선순위를 <b>위치</b>로 정한다:
       ① 이 뷰의 이마 표본        ② 보관된 다른 뷰의 이마 표본
       ③ 이 뷰의 비이마 표본      ④ 없음 → 단색 피부(아래 flatMix)
     ③이 ②보다 뒤인 게 이번 변경의 핵심이다. 예전엔 자기 뷰 것이 있으면 그게
     눈이어도 무조건 이겼다(`if(!graft) graft = _skinGraft` — null일 때만 빌림).
     실제로 우측만 자기 것(눈)을 쓰고 좌·후면은 정면 이마를 빌려 썼다.
     ④는 눈 무늬가 반복되느니 단색이 낫다는 판단이다 — 없는 정보를 지어내는 것보다
     "여기는 모른다"가 화면에서도 덜 틀린다. */
  const own = buildSkinGraft(hctx, ow, oh, ell, skinRGB, size, angle);
  // 보관은 <b>이마 표본만</b> 한다. 눈 표본을 보관하면 다른 뷰까지 오염된다.
  if(own && own.forehead && (!_skinGraft || angle === 'front' || _skinGraft.src !== 'front')) _skinGraft = own;
  /* ── dy<0(이마)만으로는 모자란다 (2026-08-11 2차) ────────────────────────
     실기기: 우측만 `이마 dy-0.10 · 평균밝기 102`, 나머지 뷰는 `dy-0.28 · 139`.
     dy−0.10은 이마 후보 <b>여섯 중 제일 아래</b>(관자놀이 쪽)라 머리카락 경계·
     그늘이 섞이기 쉽다. 통과는 했는데 27% 어두웠고, 화면에는 그 어두운 무늬가
     타일로 반복됐다. 그래서 밝기로 한 번 더 거른다 — 보관된 이마 표본보다
     <b>뚜렷하게 어두우면</b> 내 것을 버리고 보관본을 쓴다.
     기준 0.85는 "조명 차이"와 "다른 것이 섞임"을 가르는 자리로 잡았다(실측
     139 대 102 = 0.73이 걸리고, 뷰 간 정상 조명차 ±10%는 안 걸린다). */
  const GRAFT_DARK_TOL = 0.85;
  let ownUsable = !!(own && own.forehead), darkRejected = null;
  if(ownUsable && _skinGraft && _skinGraft.forehead && _skinGraft !== own
     && _skinGraft.lum > 1 && own.lum / _skinGraft.lum < GRAFT_DARK_TOL){
    darkRejected = own; ownUsable = false;
  }
  let graft = null;
  if(ownUsable) graft = own;                                  // ①
  else if(_skinGraft && _skinGraft.forehead) graft = _skinGraft; // ②
  else graft = null;                                          // ③은 안 쓴다 → ④ 단색
  const graftRejected = (own && !own.forehead) ? own : darkRejected;

  const G = HOLE_FILL.graft;
  // 거울 반복(ping-pong)으로 타일링 — 같은 무늬가 줄줄이 반복되는 티가 안 난다
  const mirror = (v, n)=>{ const p = 2*n - 2; let m = ((v % p) + p) % p; return m < n ? m : p - m; };
  const oimg = octx.getImageData(0, 0, ow, oh), od = oimg.data;
  const T = HOLE_FILL.texture;
  const gs = graft ? graft.size : 0;
  let nGraft = 0, nFlat = 0;
  for(let y=0; y<oh; y++){
    const ny = (y + 0.5)/oh, v = (ny - ell.cy)/ell.ry, v2 = v*v;
    if(v2 > 1) continue;                       // 두상 밖 — 손대지 않음(목·옷·배경)
    const py = gs ? mirror(y, gs) : 0;
    for(let x=0; x<ow; x++){
      const i = (y*ow+x)*4;
      // 원래 있던 픽셀은 안 건드림. 기준을 holeA 알파에서 <b>부풀린 구멍 플래그</b>로
      // 바꾼 이유: 반투명 머리 테두리(알파 200~250)가 예전엔 "있던 픽셀"로 통과해
      // 두피 위에 검은 실선으로 남았다 — 그 자리도 이식 대상이어야 한다.
      if(!hole[y*ow + x]) continue;
      const nx = (x + 0.5)/ow, u = (nx - ell.cx)/ell.rx;
      const r2 = u*u + v2;
      if(r2 > 1) continue;                     // 두상 밖
      /* 두상 경계 페더 — 이식이 타원 선에서 뚝 끊기면 그 자리에 테두리가 생긴다.
         바깥 몇 %에서 원래(전파된) 색으로 서서히 넘긴다. */
      let wgt = 1;
      if(G.edgeFeather > 0){
        const r = Math.sqrt(r2);
        if(r > 1 - G.edgeFeather) wgt = Math.max(0, (1 - r) / G.edgeFeather);
      }
      if(!graft){
        /* 표본을 아예 못 떴을 때 — 최소한 <b>두피색 쪽으로</b> 끌어당긴다.
           벽의 흰색·머리의 검정이 그대로 남는 것보다 낫다(검정은 답이 아니다). */
        const m = G.flatMix * wgt;
        od[i]   = od[i]  *(1-m) + skinRGB[0]*m;
        od[i+1] = od[i+1]*(1-m) + skinRGB[1]*m;
        od[i+2] = od[i+2]*(1-m) + skinRGB[2]*m;
        nFlat++;
        continue;
      }
      const k = (mirror(x, gs)*gs + py) * 3;
      if(!G.on){
        // 예전 동작(A/B) — 결만 얹는다. 색은 이웃 전파가 정한 그대로.
        od[i]   = Math.max(0, Math.min(255, od[i]   + graft.hi[k]  *T));
        od[i+1] = Math.max(0, Math.min(255, od[i+1] + graft.hi[k+1]*T));
        od[i+2] = Math.max(0, Math.min(255, od[i+2] + graft.hi[k+2]*T));
        continue;
      }
      /* ── 이식 ──
         이 자리에 번져 들어온 색(od)은 <b>색으로 안 쓴다</b>. 정수리 근처면
         벽(흰색), 뒤통수·목덜미면 지워진 머리 경계(검정)라 둘 다 두피가 아니다.
         쓰는 건 <b>밝기 하나</b>고, 그마저 shadeMin~shadeMax로 잘라서 받는다 —
         그늘·하이라이트는 남되 흰 벽/검정으로는 못 간다.
         색과 결은 전부 이마 표본에서 온다. */
      const lum = 0.299*od[i] + 0.587*od[i+1] + 0.114*od[i+2];
      let sh = graft.lum > 1 ? lum / graft.lum : 1;
      sh = Math.max(G.shadeMin, Math.min(G.shadeMax, sh));
      for(let ch = 0; ch < 3; ch++){
        const skinPx = graft.rgb[k+ch] * sh;
        od[i+ch] = Math.max(0, Math.min(255, od[i+ch]*(1-wgt) + skinPx*wgt));
      }
      nGraft++;
    }
  }
  octx.putImageData(oimg, 0, 0);
  logSkinGraftOnce(angle, graft, nGraft, nFlat, ow, oh, graftRejected);
  return out;
}

/* [진단] 렌더링 경계 배경 — 뷰당 1회.
   "주변에 마스크가 겹쳐 보인다"는 신고가 다시 오면 이 한 줄로 갈린다:
     · 채움 0px      → RENDER_PLATE.on이 꺼졌거나 구멍 판정이 안 됨
     · 미도달 큰 값  → 마스크가 프레임 가장자리에 닿아 사방이 전부 구멍(=촬영 문제)
     · 잡티 0        → 주변이 이미 매끈(합성 배경) — 정상 */
const _plateLogged = {};
function logRenderPlateOnce(angle, diag, ow, oh){
  if(!angle || _plateLogged[angle]) return;
  _plateLogged[angle] = true;
  if(!diag){ console.log(`[렌더경계] ${angle}: 꺼짐(RENDER_PLATE.on=false) — 예전 동작(160px 확산 + 테두리 잔상)`); return; }
  const px = ow*oh;
  const holePx = diag.filled + diag.unreached;
  console.log(`[렌더경계] ${angle}: 구멍 ${holePx}px (${((holePx/px)*100).toFixed(1)}% of ${ow}×${oh})`
    + ` · <b>테두리 회수 ${diag.rim}px</b>(머리색 ${diag.hair ? 'rgb('+diag.hair.join(',')+')' : '없음'}, 최대 ${diag.rimIter}겹)`
    + ` · 방향성 채움 ${diag.filled}px · 미도달 ${diag.unreached}px`
    + ` · 거울 결 ${diag.detail}px` + (diag.detail ? '' : ` (못 가져와 잡티 σ ${diag.sigma.toFixed(2)}로 대체)`)
    + ` — 두상 밖(어깨·옷·배경)은 이 값이 최종입니다`);
  if(diag.rim === 0){
    console.warn(`[렌더경계] ${angle}: 테두리 회수가 0입니다 — 마스크 밖에 남은 머리색 픽셀이 없다는 뜻이거나,`
      + ` 머리색(avgColor)이 없어 색 판정을 못 한 것입니다. 겹친 마스크가 계속 보이면 RENDER_PLATE.rim.tol을 키우세요.`);
  } else if(diag.rim > holePx * 0.5){
    console.warn(`[렌더경계] ${angle}: 테두리 회수가 구멍의 절반을 넘습니다(${diag.rim}/${holePx})`
      + ` — 머리색이 옷/배경과 가까워 색 판정이 번지고 있을 수 있습니다. RENDER_PLATE.rim.tol을 줄이세요.`);
  }
}

/* [진단] 두피 이식이 실제로 먹었는지 — 뷰당 1회. 까맣게 보인다는 신고가 오면
   여기 숫자 하나로 "안 심었다 / 심었는데 다른 이유"가 갈린다. */
const _graftLogged = {};
function logSkinGraftOnce(angle, graft, nGraft, nFlat, ow, oh, rejected){
  if(!angle || _graftLogged[angle]) return;
  _graftLogged[angle] = true;
  const px = ow*oh;
  /* 표본이 <b>어디서</b> 왔는지 적는다 (2026-08-11). 예전엔 어느 후보가 뽑혔든
     "이마 표본"이라고 찍어서, 눈 언저리에서 떠 와도 로그로는 알 수 없었다. */
  const where = g => (g.dy == null) ? '위치?' : (g.forehead ? '이마' : '<b>이마 아님</b>')
                     + ' dy' + (g.dy > 0 ? '+' : '') + g.dy.toFixed(2);
  console.log(`[두피이식] ${angle}: `
    + (graft
        ? `표본 ${graft.size}px · ${where(graft)} · 출처 ${graft.src}${graft.src!==angle?'(다른 뷰 재사용)':''}`
          + ` · 평균밝기 ${graft.lum.toFixed(0)}`
        : `표본 없음 → 두피색 단색 ${Math.round(HOLE_FILL.graft.flatMix*100)}% 혼합`)
    + ` · 이식 ${nGraft}px${nFlat?`(단색 ${nFlat}px)`:''}`
    + ` = 두상 안 구멍 ${(100*(nGraft+nFlat)/px).toFixed(1)}% of ${ow}×${oh}`);
  if(rejected) console.warn(`[두피이식] ${angle}: 이 뷰에서 뜬 표본이 ${where(rejected)}`
    + (rejected.forehead ? ` <b>인데 너무 어두워</b>` : `라`) + ` 버렸습니다`
    + ` (평균밝기 ${rejected.lum != null ? rejected.lum.toFixed(0) : '?'}).`
    + `\n    앞머리가 이마를 덮으면 이마 후보 6자리가 "불투명 98%"에서 전부 탈락하고 눈 언저리로 내려갑니다.`
    + ` 그 패치를 ${graft ? '다른 뷰 이마로 대체했습니다' : '쓰지 않고 단색으로 갔습니다'}.`);
}

// 뷰별 1회 생성 후 캐시. 두상 판정에 sectionBandsFor가 필요해서 렌더 시점에 만든다.
/* 메움 배경이 없어서 두피색 단색으로 때웠다는 것을 뷰당 한 번만 알린다.
   (2026-08-02 10차) 이 경고가 뜨면 원인은 아래 셋 중 하나다:
     ① headEllipseFor(angle)이 null — 섹션 밴드(정수리/턱선)가 아직 없음
     ② pickSkinPatch 실패 — 얼굴에서 깨끗한 피부 정사각형을 못 찾음
     ③ buildHoleFillCanvas 예외 */
const _holeFillWarned = {};
function warnHoleFillOnce(angle){
  if(_holeFillWarned[angle]) return;
  _holeFillWarned[angle] = true;
  const ell = (typeof headEllipseFor === 'function') ? headEllipseFor(angle) : null;
  console.warn(`[메움] ${angle}: 구멍 메움 배경이 없어 두피색 단색으로 대체했다`
    + ` (두상 타원 ${ell ? '있음' : '없음'}). 세그멘테이션 안이 검게 비치는 증상의 원인 자리.`);
}

function getHoleFillCanvas(angle, baseC, maskInf){
  if(!baseC) return null;
  const cached = state.baseFillCanvases && state.baseFillCanvases[angle];
  if(cached && cached._src === baseC) return cached;
  let c = null;
  try{
    c = buildHoleFillCanvas(baseC, maskInf && maskInf.scalpColor, headEllipseFor(angle), angle, maskInf);
  }catch(e){ console.warn('구멍 메움 배경 생성 실패:', angle, e); }
  if(c){ c._src = baseC; if(state.baseFillCanvases) state.baseFillCanvases[angle] = c; }
  return c;
}

/* ── 조정 화면 머리 확대 (2026-07-26) ─────────────────────────────────
   사용자 상황: "노트북으로 작업하고 있어서 어쩔 수 없어. 정수리까지 나오려면."
   맞다 — 노트북 웹캠으로 정수리까지 담으려면 뒤로 물러날 수밖에 없고, 그러면
   머리가 프레임의 20%밖에 안 된다. 진단 로그 기준 <b>머리 전체가 화면에서 142px</b>.
   여기에 결을 그리는 건 우표 크기에 머리카락을 그리는 것과 같아서, 렌더를
   아무리 손봐도 한계가 있다(다발 5개 × 0.7px + 틈 0.9px = 다발 하나가 화면
   4.5px — 머리가 142px이면 다발 30개면 머리가 꽉 찬다).
   촬영은 못 바꾸니 <b>보는 쪽</b>을 바꾼다: 조정 화면만 머리에 맞춰 확대한다.
   가닥은 벡터로 다시 그려지니 확대해도 선명하고, 배경 사진만 부드러워진다
   (baseC는 어차피 머리카락이 지워진 얼굴·배경이라 손해가 작다).
   ※ fit이 "배율 + 평행이동"이라 확대는 dw/dh/dx/dy만 바꾸면 된다 —
     makeImgToCanvas·가닥 투영·마스크 clip이 전부 fit을 통하므로 자동으로 따라온다.
   ※ 재구성(3D)에는 전혀 관여하지 않는다. 순수하게 표시 배율만. */
