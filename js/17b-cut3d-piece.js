/* (2026-10-17) 웨이브 배수 자동 — 방향필터 진폭(사진 컬 ②, 픽셀)과 머리 실루엣 가장자리의 출렁임 진폭(픽셀)을
   정면·뒤 사진에서 비교: 배수 = 실루엣/필터 × waveGainCal (보정값은 사용자가 맞다고 한 웨이브 사진에서 3배가 나오게 둔 값).
   실루엣 진폭은 머리 아래쪽(40~85%)의 왼·오른 가장자리에서, 잔털(파장/6 이하)과 큰 형태(파장×2 이상)를 빼고 잰다.
   잴 수 없으면 READ_SHAPE.waveGain(3). 끄기 READ_SHAPE.waveGainAuto=false · 결과 READ_SHAPE.stats.autoGain */
window.__rsAutoGain=function(cfg){
  var key='';try{key=String(!!state._hair3Dneutral)+'|'+(state.hairMasks&&state.hairMasks.front&&state.hairMasks.front.w);}catch(e){}
  var C=window.__rsAutoGain._c;if(C&&C.key===key&&C.src===state._hair3Dneutral)return C.g;
  var res={views:[],gain:cfg.waveGain||3,why:'fallback'};
  try{
    var ratios=[];
    ['front','back'].forEach(function(v){
      var m=state.hairMasks&&state.hairMasks[v],ws=m&&m.identity&&m.identity.waveShape;
      var cv=state.hairCanvases&&state.hairCanvases[v];
      if(!m||!cv||!cv.width||!ws||!(ws.ampPx>0)||!(ws.lamPx>0))return;
      var CW=cv.width,CH=cv.height,sx=CW/(m.w||CW),A=cv.getContext('2d').getImageData(0,0,CW,CH).data;
      var hairAt=function(x,y){return A[4*(y*CW+x)+3]>128;};
      var top=-1,bot=-1;for(var yy=0;yy<CH;yy++){var any=false;for(var xx=0;xx<CW;xx+=2){if(hairAt(xx,yy)){any=true;break;}}if(any){if(top<0)top=yy;bot=yy;}}
      if(!(bot>top+40))return;
      var H=bot-top,y0=Math.round(top+0.4*H),y1=Math.round(top+0.85*H),L=[],R=[];
      for(var y=y0;y<y1;y++){var lo=-1,hi=-1;for(var x2=0;x2<CW;x2++){if(hairAt(x2,y)){if(lo<0)lo=x2;hi=x2;}}if(lo>=0){L.push(lo/sx);R.push(hi/sx);}}
      if(L.length<20)return;
      var sm=function(a,w){w=Math.max(1,Math.round(w));var o=new Array(a.length);for(var i=0;i<a.length;i++){var s2=0,c=0;for(var j=i-w;j<=i+w;j++){var jj=Math.min(a.length-1,Math.max(0,j));s2+=a[jj];c++;}o[i]=s2/c;}return o;};
      var amp=function(E){var a=sm(E,ws.lamPx/12),b=sm(E,ws.lamPx),s2=0;for(var i=0;i<E.length;i++){var r=a[i]-b[i];s2+=r*r;}return Math.sqrt(2*s2/E.length);};
      var ea=(amp(L)+amp(R))/2,rt=ea/ws.ampPx;
      res.views.push(v+' 실루엣 '+ea.toFixed(1)+'px / 필터 '+(+ws.ampPx).toFixed(1)+'px = '+rt.toFixed(2));
      if(isFinite(rt)&&rt>=0)ratios.push(rt);
    });
    if(ratios.length){ratios.sort(function(a,b){return a-b;});var r=ratios[ratios.length>>1];
      res.gain=Math.min(cfg.waveGainMax||5,Math.max(cfg.waveGainMin||1.5,r*(cfg.waveGainCal||1.75)));res.why='실측';res.ratio=r;}
  }catch(e){res.err=String(e&&e.message||e);}
  try{if(window.READ_SHAPE&&READ_SHAPE.stats)READ_SHAPE.stats.autoGain=res;}catch(e){}
  try{console.log('[웨이브 배수] '+(res.why==='실측'?'자동 ×'+res.gain.toFixed(2)+' ('+res.views.join(' · ')+' · 보정 ×'+(cfg.waveGainCal||1.75)+')':'잴 수 없어 기본 ×'+res.gain)+' · 끄기 READ_SHAPE.waveGainAuto=false');}catch(e){}
  window.__rsAutoGain._c={key:key,src:state._hair3Dneutral,g:res.gain};return res.gain;};
/* (2026-10-17) 읽은 웨이브 키우기 — 방향필터(4px)가 다발 단위의 큰 S자 출렁임을 작게 읽어
   (같은 사진: 사진 진폭 ≈2cm · 읽은 값 0.5cm) 읽은 길이 거의 직모로 나오던 것.
   가닥을 '척추'(waveSpineCm 폭으로 고르게 편 길)와 '출렁임'으로 나누고 출렁임만 waveGain배.
   뿌리에서 waveRootCm까지는 0→1로 서서히. 웨이브(S자)로 판정된 사진에만. 끄기 READ_SHAPE.waveGain=1 */
window.__rsWaveGain=function(pts,cfg){
  if(!pts||pts.length<5)return pts;
  var cpu=(typeof CURL_BUNDLE!=='undefined'&&CURL_BUNDLE.cmPerUnit)||19.33;
  var n=pts.length,s=new Float64Array(n);
  for(var i=1;i<n;i++){var dx=pts[i].x-pts[i-1].x,dy=pts[i].y-pts[i-1].y,dz=pts[i].z-pts[i-1].z;s[i]=s[i-1]+Math.sqrt(dx*dx+dy*dy+dz*dz);}
  var sig=(cfg.waveSpineCm||3)/cpu,root=(cfg.waveRootCm||3)/cpu,k=(cfg.waveGainAuto&&window.__rsAutoGain)?window.__rsAutoGain(cfg):(cfg.waveGain||1),out=new Array(n);
  out[0]=pts[0];
  for(var a=1;a<n;a++){var wx=0,wy=0,wz=0,ws=0;
    for(var b=0;b<n;b++){var d=(s[b]-s[a])/sig;if(d>3||d<-3)continue;var w=Math.exp(-0.5*d*d);wx+=w*pts[b].x;wy+=w*pts[b].y;wz+=w*pts[b].z;ws+=w;}
    var cx=wx/ws,cy=wy/ws,cz=wz/ws,t=Math.min(1,s[a]/root),g=1+(k-1)*t*t*(3-2*t);
    out[a]=Object.assign({},pts[a],{x:cx+(pts[a].x-cx)*g,y:cy+(pts[a].y-cy)*g,z:cz+(pts[a].z-cz)*g});}
  return out;};
/* ══════════════════════════════════════════════════════════
   17b-cut3d-piece.js — 커트 기법 3D · 페이드 · 디스커넥션 · 조각머리 · 조정 캐시
   원본 index.html 27619~29092행. 클래식 스크립트이므로 로드 순서가 곧
   실행 순서다 — index.html의 <script src> 순서를 바꾸지 말 것.
   ══════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════════
   커트 기법을 3D로 (2026-08-08) — 시술각·기법·텍스처가 <b>그림에 나오게</b>
   ─────────────────────────────────────────────────────────────────
   확인해 보니 elevation/technique/texture/overdirection은 전부 2D 컬럼
   렌더러에서만 작동하고 있었다. 기본 렌더는 3D 모델 투영이므로 그 값들이
   그림에 아무 영향이 없었다 — 길이·컬·웨이브·스타일링만 먹었다.

   여기서 <b>실제 시술 정의</b> 그대로 이식한다. 지어낸 곡선이 아니다:
     · 시술각(elevation) — 모발을 두피에서 얼마나 들어올려 자르는가.
         0°  = 자연 낙하 상태로 한 라인에 자른다 → <b>끝 높이가 같아진다</b>(원랭스)
         90° = 두피에서 직각으로 들어올려 자른다 → <b>길이가 같아진다</b>(유니폼 레이어)
       그래서 각도는 "끝 높이를 맞출지, 길이를 맞출지"의 <b>보간값</b>이다.
       상수를 하나도 안 만든다 — 두 극단이 전부 실측(그 섹션의 중앙값)이다.
     · 기법(technique) — 가이드 길이가 섹션 <b>안에서</b> 어느 쪽으로 기우는가.
         그라데이션 = 아래가 길다(무게 하단) · 인크리스 = 위가 길다 · 유니폼 = 평평
         원랭스 = 각도와 무관하게 끝 높이를 맞춘다(정의상 0°)
     · 텍스처(texture) — 끝단을 들쭉날쭉하게 쳐서 가볍게. 가닥별 결정적 해시라
       슬라이더를 움직여도 같은 가닥은 같은 만큼 쳐진다(프레임 간 반짝임 방지).
     · 크라운 연동(overdirection, 템플) — 템플 가이드를 크라운 가이드 쪽으로 당긴다.
══════════════════════════════════════════════════════════════════ */
const CUT3D = {
  on: true,
  techSlope: { onelength:0, graduation:0.35, uniform:0, increase:-0.35 },
  textureMax: 0.25,   // 텍스처 100%일 때 끝단이 최대 이만큼 짧아진다
  /* 커팅라인 100%일 때 <b>가장 옆 가닥</b>이 최대 이만큼 길어(스퀘어)/짧아(테이퍼)
     진다. 0.35 = 스퀘어에서 옆이 1.35배, 테이퍼에서 0.65배. 근거는 실측이 아니라
     <b>초안</b>이다(tipAt과 같은 자격) — 0.5 이상이면 테이퍼가 옆머리를 반토막
     내서 커트가 아니라 사고로 보였고, 0.2 아래는 일자 밑단과 라운드가 구분이
     안 갔다. 실기기에서 스퀘어/테이퍼 양 끝을 보고 고칠 것. */
  /* (2026-09-01 5차) 시술각 0°의 기준 높이에 <b>뿌리가 이미 아래</b>일 때
     "도달 불가 → 전체 길이"가 아니라 "도달 불가 → 최소"로 읽는다.
     후두부·네이프가 슬라이더를 내려도 안 줄던 원인. false면 예전 동작.
     (2026-09-02) <b>켠다</b>. 6차에 "이 빌드가 확인되면 올린다"고 꺼 뒀는데,
     노트북 콘솔이 켜야 할 근거를 줬다 — 길이 슬라이더를 내리는 동안
     호길이 <b>중앙값은 17.45→12.21cm로 줄어드는데 p90이 30.34cm에서
     소수점까지 고정</b>이고 끝높이도 0.701에서 바닥을 친다. 즉 긴 가닥
     상위 10%가 커트를 통째로 안 먹는다. 5차가 잰 것과 같은 모양이다. */
  tipUnreachableCut: true,
  lineMax: 0.35,
  minRatio: 0.02,
  /* 한 가닥을 자기 길이의 이 배 넘게는 <b>안 늘인다</b> (2026-08-09).
     유니폼 커트는 섹션 전체를 가이드 길이(Lref)로 맞추는데, 그 섹션 안에 유난히
     짧게 잡힌 가닥이 있으면 비율이 3~4배가 된다. 늘린 부분은 실측이 아니라
     <b>마지막 방향으로의 연장</b>이라, 그만큼 가면 두상을 벗어나 얼굴을 가로지른다.
     실제 시술로도 "자르기"가 머리를 3배로 늘려 주지는 않는다 — 없는 길이는
     없는 것이고, 그 가닥은 그냥 짧은 가닥으로 남는 게 맞다(레이어의 정의).
     ※ 이건 증상 억제이고 원인은 뿌리 쪽이다 — 뷰별길이 가둠(마네킹)이 먼저다. */
  maxRatio: 1.8,
  /* 오버디렉션(템플→크라운)을 <b>길이비율에서</b> 섞는다 (2026-09-02 4차).
     false면 예전 동작(절대 호길이 덧셈 — 크라운이 늘 더 길어 템플 슬라이더가
     상한에 눌려 죽던 그것). cutRatioForStrand ③ 주석 참조. */
  odRatioSpace: true,
};
/* 이 가닥에서 y=targetY에 닿는 지점까지의 호길이. 안 닿으면 전체 길이. */
function arcAtY(pts, targetY){
  let acc = 0;
  for(let i=1;i<pts.length;i++){
    const a = pts[i-1], c = pts[i];
    const seg = Math.hypot(c.x-a.x, c.y-a.y, c.z-a.z);
    if(c.y <= targetY && a.y > targetY){
      const t = (a.y - targetY) / Math.max(1e-9, a.y - c.y);
      return acc + seg * t;
    }
    acc += seg;
  }
  return acc;
}
function _cutHash01(st){
  const p = st.pts[0];
  const s = Math.sin(p.x*127.1 + p.y*311.7 + p.z*74.7) * 43758.5453;
  return s - Math.floor(s);
}
/* 섹션 가이드 — 시술각의 두 극단이 되는 실측값.
   Lref = 이 섹션 가닥 길이의 중앙값(슬라이더 반영), Yref = 그때 끝 높이의 중앙값.
   두 극단이 중앙값 가닥에서 정확히 일치하므로 각도를 바꿔도 섹션 전체 길이감은
   유지되고 <b>분포만</b> 바뀐다. yTop/yBot는 기법 기울기가 쓰는 뿌리 세로 범위. */
function sectionCutGuide(secId, lenVal){
  const m = state.hair3Dneutral;
  if(!m || !m.strands) return null;
  const key = secId + '|' + (+lenVal).toFixed(2);
  const cache = m._guideCache || (m._guideCache = {});
  if(cache[key] !== undefined) return cache[key];
  let pool = (m._solveCache && m._solveCache[secId]);
  if(!pool){
    const all = m.strands.filter(s=>s.sec === secId);
    const step = Math.max(1, all.length / SOLVE_SAMPLE);
    pool = []; for(let i=0;i<all.length;i+=step) pool.push(all[i|0]);
    (m._solveCache || (m._solveCache = {}))[secId] = pool;
  }
  if(!pool.length) return (cache[key] = null);
  const ratio = sectionLengthRatio(secId, lenVal);
  const Ls = [], Ys = [];
  let yLo = Infinity, yHi = -Infinity;
  /* (2026-09-01) 뿌리 <b>좌우</b> 범위도 같이 잰다 — 커팅라인(스퀘어/라운드/
     테이퍼)이 "중앙에서 얼마나 옆인가"를 필요로 한다. 세로 범위를 재는 이
     루프에 한 줄 붙이는 것이라 비용이 없고, 가이드 캐시를 그대로 탄다. */
  let xLo = Infinity, xHi = -Infinity;
  for(const st of pool){
    const total = arcLength3D(st.pts);
    const L = total * ratio;
    Ls.push(L);
    Ys.push(yAtArc(st.pts, L));
    const ry = st.pts[0].y;
    if(ry < yLo) yLo = ry; if(ry > yHi) yHi = ry;
    const rx = st.pts[0].x;
    if(rx < xLo) xLo = rx; if(rx > xHi) xHi = rx;
  }
  Ls.sort((a,b)=>a-b); Ys.sort((a,b)=>a-b);
  const g = { Lref: Ls[(Ls.length*0.5)|0], Yref: Ys[(Ys.length*0.5)|0], yLo, yHi, xLo, xHi };
  return (cache[key] = g);
}
/* 호길이 L 지점의 y (arcAtY의 역함수)
   ── 가닥보다 <b>긴</b> L은 연장선에서 읽는다 (2026-08-26) ──────────────────
   예전엔 끝점 y로 잘랐다(return pts[last].y). 그 한 줄이 파일 10649행에
   "nape이 0/50/100에서 전부 같은 길이"로 남아 있던 미해결 항목의 원인이다.
   sectionCutGuide는 Yref를 <b>yAtArc(pts, total×ratio)의 중앙값</b>으로 잡는데,
   ratio ≥ 1이면 모든 가닥이 끝점 y를 돌려주므로 <b>Yref가 슬라이더와 무관하게
   고정</b>된다. 시술각이 0°인 섹션(네이프의 기본값이 유일하게 0이다)은
   cutRatioForStrand가 L = Ltip = arcAtY(pts, Yref)로 줄어들어 길이가 오직
   Yref로만 움직이므로, 기본값(35) 위쪽 슬라이더 전 구간이 통째로 죽었다.
   하네스 실측(h_nape.js, 합성 네이프 120가닥, elev 0):
     고치기 전  35:0.359 · 50:0.359 · 75:0.359 · 100:0.359   ← 안 움직인다
     고친 뒤    35:0.359 · 50:0.395 · 75:0.410 · 100:0.410
   ⚠ 상수를 하나도 안 만든다 — <b>lengthStrand3D가 실제로 하는 연장</b>(마지막
     진행 방향 유지)을 그대로 읽는다. 두 벌이 되면 갈라지는 그 자리다.
   ※ 75 위에서 평평해지는 것은 버그가 아니다. 시술각 0°는 원랭스(끝 높이를
     맞추는 커트)이고, 가이드 선이 <b>모든 가닥의 끝보다 아래</b>로 내려가면
     더 자를 것이 없다 — 없는 길이를 만들어 내지 않는다는 뜻이라 그대로 둔다
     (arcAtY는 일부러 안 고쳤다. 거기서 연장하면 원랭스가 짧은 가닥을 늘리게
      되고, 그게 CUT3D.maxRatio 주석이 경고하는 "얼굴을 가로지르는 연장"이다). */
function yAtArc(pts, L){
  let acc = 0;
  for(let i=1;i<pts.length;i++){
    const a = pts[i-1], c = pts[i];
    const seg = Math.hypot(c.x-a.x, c.y-a.y, c.z-a.z);
    if(acc + seg >= L){
      const t = (L - acc) / Math.max(1e-9, seg);
      return a.y + (c.y - a.y) * t;
    }
    acc += seg;
  }
  // acc === 전체 호길이. 남은 (L-acc)만큼 마지막 방향으로 더 간 자리의 y.
  const n = pts.length, a = pts[n-2], b = pts[n-1];
  const seg = Math.hypot(b.x-a.x, b.y-a.y, b.z-a.z);
  if(!(seg > 1e-9)) return b.y;
  return b.y + ((b.y - a.y) / seg) * (L - acc);
}
/* 이 가닥의 커트 후 길이비율 — 위 네 가지를 순서대로 적용 */
function cutRatioForStrand(st, sec, lenVal, fallbackRatio){
  if(!CUT3D.on) return fallbackRatio;
  const g = sectionCutGuide(st.sec, lenVal);
  if(!g) return fallbackRatio;
  const total = arcLength3D(st.pts);
  if(!(total > 1e-9)) return fallbackRatio;
  /* 사용자가 <b>지시한</b> 비율. 아래 상한이 이걸 기준선으로 쓴다(맨 끝 배너).
     오버디렉션이 걸리면 섞인 값이 곧 지시값이라 ③에서 갱신된다. */
  let want = sectionLengthRatio(st.sec, lenVal);
  const tech = sec.technique || 'uniform';
  /* ── ① 시술각 — 같은 끝높이(0°) ↔ 같은 길이(90°) ────────────────────────
     ⚠⚠ (2026-09-01 5차) <b>여기가 뒷머리가 안 줄던 자리다.</b>
     사용자: "커트len 움직이는 거만 봐도, 지금 <b>뒷머리는 저 길이 이하로 줄일
     수가 없는</b> 상황이야."
     실기기: 길이 슬라이더 <b>13~14%</b>인데 뒷머리가 어깨까지 그대로. 이번엔
     미니3D도 같이 길었다 — 즉 투영이 아니라 <b>여기</b>다.

     arcAtY는 가닥이 targetY를 <b>내려가며 지나는</b> 지점의 호길이를 준다.
     안 지나면 마지막 줄에서 `return acc`, 즉 <b>가닥 전체 길이</b>다.
     그런데 안 지나는 경우가 <b>둘</b>이고 정답이 <b>정반대</b>다:
       ⓐ 뿌리가 이미 기준 높이보다 <b>아래</b>다(pts[0].y ≤ Yref)
          → "같은 끝높이"는 <b>위로 올라가야</b> 닿는 높이다. 머리카락은 위로
            자라지 않으니 도달 불가이고, 0°의 옳은 답은 <b>최소</b>(두피까지)다.
       ⓑ 가닥이 짧아서 기준 높이까지 <b>못 내려간다</b>(Yref가 끝점보다 아래)
          → 자를 게 없다. <b>전체 길이</b>가 맞다.
     지금은 둘 다 ⓑ로 처리돼 ⓐ가 <b>통째로 안 잘렸다</b>.

     ── 왜 하필 뒷머리인가 ─────────────────────────────────────────────
     Yref는 <b>그 섹션 끝높이의 중앙값</b>이라 슬라이더를 내릴수록 <b>올라간다</b>.
     후두부·네이프는 뿌리가 두상 아래쪽이라, 슬라이더를 내리면 Yref가 뿌리를
     추월하는 가닥이 <b>점점 늘어난다</b>. 그래서 증상이 "짧게 할수록 더 안
     줄어든다"로 나타난다 — 사용자가 본 그것이고, 폼파두르에서 뒷머리가
     페이드만 먹고 가위는 안 먹던 것도 <b>같은 원인</b>이다.
     ⓘ 슬라이더 <b>범위</b>를 넓혔어도 이건 안 고쳐졌다. 값이 안 닿는 게 아니라
       닿은 값이 <b>뒤집혀 쓰이고</b> 있었다. 범위부터 건드렸으면 헛일이었다.
     ⓘ arcAtY의 계약은 안 바꾼다 — 다른 자리에서 "못 만나면 전체"가 맞을 수
       있다. 두 경우를 <b>부르는 쪽</b>에서 가른다.
     되돌리기: CUT3D.tipUnreachableCut = false */
  let elevT = (typeof sec.elevation === 'number') ? Math.max(0, Math.min(1, sec.elevation/90)) : 0.5;
  if(tech === 'onelength') elevT = 0;                 // 원랭스는 정의상 0°
  let Ltip = arcAtY(st.pts, g.Yref);
  if(CUT3D.tipUnreachableCut && Ltip >= total - 1e-9 && st.pts[0].y <= g.Yref){
    /* ⓐ — 뿌리가 이미 기준보다 아래. 0°의 답은 최대가 아니라 최소다.
       0으로 두면 아래 minRatio(0.02)가 받아 준다(두피에 붙은 최소 길이). */
    Ltip = 0;
  }
  let L = Ltip + (g.Lref - Ltip) * elevT;
  // ② 기법 — 섹션 안 뿌리 세로 위치(0=위, 1=아래)에 따른 기울기
  const slope = CUT3D.techSlope[tech] || 0;
  if(slope && g.yHi > g.yLo){
    const u = Math.max(0, Math.min(1, (g.yHi - st.pts[0].y) / (g.yHi - g.yLo)));
    L *= 1 + slope * (u - 0.5);
  }
  // ③ 크라운 연동(템플) — 템플 가이드를 크라운 가이드 쪽으로 당겨 자른다
  /* ⚠⚠ (2026-09-02 4차) <b>여기가 "템플이 안 줄어든다"의 자리다.</b>
     예전 줄: L += (gc.Lref - L) * od
     gc.Lref는 비율이 아니라 <b>크라운의 절대 호길이 중앙값</b>이다. 마네킹은
     섹션별 <b>최댓값</b>으로 심으니(MANNEQUIN.lenPct = 1.0) 크라운 Lref가 전
     섹션 중 제일 길다. 템플 L 1.0 · 크라운 Lref 2.8이면
       1.0 + (2.8−1.0)×0.5 = 1.9
     — 템플 슬라이더를 100에서 0까지 다 내려도 자기 몫 L만 1.36→0.05로 움직이고
     블렌드 결과는 2.08→1.42다. 게다가 마지막 줄이 L/total을 maxRatio(1.8)로
     자르므로, 자기 total이 짧은 가닥은 <b>통째로 상한에 눌려 아예 안 움직인다</b>.
     total은 가닥마다 다르고 가르마 때문에 좌우가 다르다 — 그래서 증상이
     "한쪽 관자만 안 움직인다"로 나온다. 좌우 판정은 멀쩡했다(resolveSection3D는
     th에 절댓값을 씌운다). <b>단위가 섞인 덧셈</b>이 원인이다.

     고침: 절대길이를 더하지 말고 <b>길이비율에서</b> 섞는다.
       rT = 템플 비율, rC = 크라운 비율,  rMix = rT + (rC − rT)·od
       L  = L × (rMix / rT)
     단위가 같은 것끼리만 섞으니 크라운이 아무리 길어도 템플을 밀어올리지
     않고, od<1인 동안 템플 슬라이더가 <b>제 몫만큼 끝까지</b> 먹는다.
     od=100은 정의 그대로 "완전히 크라운을 따라감"이라 템플 슬라이더가 죽는
     것이 맞다(그때만 죽는다). od=0이면 배율이 정확히 1 — 비트 동일.
     되돌리기: CUT3D.odRatioSpace = false */
  if(st.sec === 'temple' && typeof sec.overdirection === 'number' && state.sections.crown){
    const od = Math.max(0, Math.min(1, sec.overdirection/100));
    if(od > 0){
      if(CUT3D.odRatioSpace !== false){
        const rT = sectionLengthRatio('temple', lenVal);
        const rC = sectionLengthRatio('crown', state.sections.crown.length);
        if(rT > 1e-6){
          const rMix = rT + (rC - rT) * od;
          L *= Math.max(0, rMix) / rT;
          want = Math.max(0, rMix);          // 섞인 값이 곧 지시값이다(상한 기준선)
        }
      }else{
        const gc = sectionCutGuide('crown', state.sections.crown.length);   // 예전 동작(단위 섞임)
        if(gc) L += (gc.Lref - L) * od;
      }
    }
  }
  /* ── ③-b 커팅라인(line) — <b>밑단이 좌우로 어떤 모양인가</b> (2026-09-01) ──
     사용자: "line은 2D 컬럼 렌더러에만 있고 3D 조정 경로에 없다 — 이건 무슨
     소리야? 전부 3D를 먼저 건드리는 거잖아."
     맞는 지적이다. 조정 경로는 2026-07-26에 3D 하나로 단일화됐고, line만
     그 이사를 못 따라왔다. 옛 2D 코드(lengthRatioFor의 ②, frontDirBiasFor)는
     남아 있었지만 그건 <b>투영이 실패했을 때의 폴백 렌더러</b>라, 실기기에서는
     슬라이더를 끝까지 밀어도 그림이 안 바뀌었다. 여기가 그 이사다.

     ── 옛 2D 수식을 그대로 옮기지 <b>않았다</b> ─────────────────────────
     2D의 nape.line은 컬럼마다 길이배율을 <b>흔들거나(jitter) 평탄화</b>하는
     것이었다. 그건 끝단 질감이지 밑단 라인이 아니다 — 흔드는 건 texture가
     이미 하고 있고(④), 두 손잡이가 같은 일을 하면 하나는 죽는다.
     2D의 front.line은 <b>방향 바이어스</b>였는데, 그건 3D에서 넘김(sweep)과
     결흐름(flow)이 이미 한다. 역시 겹친다.
     미용에서 커팅라인이 뜻하는 것은 <b>좌우 위치에 따른 길이 분포</b>다:
       스퀘어  — 옆도 가운데와 같은 높이(일자 밑단·일자 뱅)
       라운드  — 가운데가 길고 옆으로 갈수록 자연히 짧다(중립 = 지금 동작)
       테이퍼  — 옆이 더 짧게 올라간다(V네이프·V뱅)
     그래서 <b>가로 위치의 함수</b>로 적는다. nx² 를 쓰는 이유는 밑단 곡선이
     실제로 포물선에 가깝기 때문이고(가위를 한 자리에서 돌려 자른 자국),
     중앙(nx=0)에서 기울기가 0이라 <b>가운데가 뾰족해지지 않는다</b>.

     ⚠ line = 50이면 t = 0이라 배율이 <b>정확히 1</b>이다 — 곱셈이 항등이므로
       기존 결과가 비트까지 같다. 두 스펙 다 front/nape가 50이라 프리셋도 불변.
     ⚠ front·nape에만 건다. 두 섹션만 SECTIONS.params에 line이 있고, 다른
       섹션에 띄우면 또 무반응 손잡이가 된다(이번에 disc에서 없앤 그것).
     되돌리기: CUT3D.lineMax = 0 (배율이 항등으로 돌아간다) */
  if(typeof sec.line === 'number' && sec.line !== 50 && CUT3D.lineMax > 0
     && (st.sec === 'nape' || st.sec === 'front') && g.xHi > g.xLo){
    const t = (sec.line - 50) / 50;                 // -1 스퀘어 ~ 0 라운드 ~ +1 테이퍼
    const cx = (g.xLo + g.xHi) / 2;
    const half = Math.max(1e-9, (g.xHi - g.xLo) / 2);
    const nx = Math.min(1, Math.abs(st.pts[0].x - cx) / half);
    L *= 1 - t * CUT3D.lineMax * nx * nx;
  }
  // ④ 텍스처라이징 — 끝단을 가닥마다 다르게 쳐서 가볍게(결정적)
  const tx = (typeof sec.texture === 'number') ? sec.texture/100 : 0;
  if(tx > 0) L *= 1 - tx * CUT3D.textureMax * _cutHash01(st);
  // ⑤ 페이드(클리퍼) — 가위질이 끝난 길이에 <b>기계가 다시 들어간다</b>
  L = fadeCutLen(st, g, L);
  /* ── 상한이 <b>슬라이더 자신</b>을 눌러 죽이던 것 (2026-09-02 6차) ────────
     사용자: "템플은 상한선에서 더 안 움직이고."
     맞다. 그리고 템플만이 아니라 <b>모든 섹션</b>이 그랬다:
       sectionLengthRatio(100) = 1 + 50×0.018 = <b>1.90</b>
       CUT3D.maxRatio          =                <b>1.80</b>
     슬라이더 상단 ~6칸이 상한에 닿아 통째로 죽는다. 오버디렉션이 걸린 템플은
     rMix가 더 크게 나오니 더 일찍 닿아서 <b>제일 먼저</b> 눈에 띈 것뿐이다.

     maxRatio가 막으려던 것은 슬라이더가 아니다 — 유니폼 커트가 <b>유난히 짧게
     잡힌 가닥</b>을 가이드 길이에 맞추려고 3~4배로 늘리는 것이다(그 배너 그대로).
     그건 시술각·기법이 만드는 <b>덤</b>이지 사용자가 지시한 값이 아니다.
     그래서 상한을 "지시한 비율과 maxRatio 중 <b>큰 쪽</b>"으로 둔다. 사용자가
     민 만큼은 언제나 나가고, 그 위로 덤이 붙는 것만 1.8배에서 막힌다.
     ⚠ maxRatio 숫자를 올리는 것과 다르다. 올리면 막으려던 3~4배 연장이 같이
       풀린다. 여기서는 <b>기준선</b>만 슬라이더를 따라 올라간다. */
  const asked = Math.max(0, (typeof want === 'number') ? want : fallbackRatio);
  const cap = Math.max(CUT3D.maxRatio, asked);
  return Math.max(CUT3D.minRatio, Math.min(cap, L / total));
}

/* ══════════════════════════════════════════════════════════════════
   페이드 — 이 파일의 <b>첫 절대길이 연산자</b> (2026-08-23 7차)
   ─────────────────────────────────────────────────────────────────
   파일 553줄 감사에 이렇게 적혀 있었다:
     "<b>fade(페이드/클리퍼)</b> — 3D에 없다. 남성 커트가 사실상 미지원."
   state.fade는 2026-07에 스키마만 들어와 있었다(enabled·guard·height·blendWidth).
   실제 바버 어휘 그대로라 스키마는 고칠 게 없고, <b>연산자만</b> 없었다.

   ── 왜 다른 손잡이와 성격이 다른가 ─────────────────────────────────
     elevation = 시술각 → 들어올린 만큼 길이가 변한다      (상대)
     length    = 손님 <b>원래</b> 길이의 비율               (상대)
     texture   = 끝단을 비율로 친다                          (상대)
     fade      = 두피 높이에 따른 길이 함수, guard는 <b>cm</b>  ← 절대
   가드 1번은 1/8인치 = 3.175mm다. <b>손님이 누구든 3.175mm</b>다. 그래서 이 하나만
   모델 단위가 아니라 cm로 계산하고, 두상 반높이(12.2cm)를 자로 삼아 환산한다.
   이것이 sectionLengthRatio의 하한을 우회하는 유일한 경로이기도 하다 — 긴 머리
   손님에게 <b>진짜 짧은 사이드</b>를 보여줄 수 있는 첫 수단이다.

   ── 규칙 하나: 페이드는 <b>짧게만</b> 한다 ──────────────────────────
   Math.min(가위길이, 페이드길이)다. 클리퍼가 머리를 길게 만들지는 않는다.
   덕분에 이 연산자는 단조(monotone)라, 켜서 갑자기 길어지는 사고가 원리적으로
   없다. 가위가 이미 더 짧게 잘랐으면 그대로 둔다(그게 실제 시술이다).

   ── height / blendWidth 의미 ────────────────────────────────────
   u = 섹션 안 뿌리 세로 위치(0=아래끝, 1=위끝). height는 페이드가 <b>어디까지</b>
   올라가는지(로우/미드/하이). blendWidth는 그 구간의 <b>위쪽 몇 %</b>에서 가위
   길이로 넘어가는지 — 좁으면 칼선, 넓으면 부드러운 그라데이션. 스키마 주석에
   적혀 있던 "낮으면 칼선, 높으면 부드러운 그라데이션"을 그대로 구현한 것이다.
   되돌리기: FADE3D.on = false (또는 state.fade.enabled = false — 기본값이 false다) */
const FADE3D = {
  on: true,
  guardInchStep: 2.54/8,   // 가드 번호당 1/8인치 — 업계 표준
  headHalfHCm: 12.2,       // 두상 반높이. 모델 단위 ↔ cm 환산자(STYLE_SPECS와 같은 자)
  skinCm: 0.1,             // 가드 0(스킨)도 0이 아니다 — 밀어도 그루터기가 남는다
  minBand: 0.05,           // blendWidth 0에서도 이만큼은 섞는다(완전 계단은 렌더가 깨진다)
};
/* 모델 단위 하나가 몇 cm인가. 두상 타원체의 b(반높이)를 12.2cm로 보는 자는
   STYLE_SPECS 역산이 쓰는 것과 <b>같은 자</b>다 — 두 벌이 되면 갈라진다. */
/* 가드 번호 → <b>mm</b>. (2026-08-25) 여태 로그가 <b>cm 값에 mm 딱지</b>를 붙여
   찍고 있었다 — 가드 1번이 "0.3mm"로 나왔는데 실제는 3.2mm다(FADE3D.guardInchStep은
   cm 단위다). 7차 하네스는 mm로 제대로 쟀는데 화면에 나가는 줄만 틀렸다.
   이 파일이 반복해서 당한 "재는 자가 아니라 <b>재서 보여주는 줄</b>이 틀린" 자리라
   환산을 여기 한 곳에 두고 콘솔·패널이 같이 쓴다. */
function guardMm(g){
  const gd = Math.max(0, Math.min(8, (typeof g === 'number') ? g : 1));
  return Math.max(FADE3D.skinCm, gd * FADE3D.guardInchStep) * 10;
}
function modelCmPerUnit(){
  try{
    const E = getHeadEllipsoid();
    if(E && E.b > 1e-6) return FADE3D.headHalfHCm / E.b;
  }catch(e){}
  return null;
}
/* ══════════════════════════════════════════════════════════════════
   두상 높이 정규화 자 — <b>단일 출처</b> (2026-08-26)
   ─────────────────────────────────────────────────────────────────
   "정수리 0, 두상 바닥 1"은 STYLE_SPECS의 tipAt이 쓰는 좌표이고, 레퍼런스
   사진을 재던 자도 이것이다. 여태 applyStyleSpec 안에 한 줄로만 있었는데
   (yTop = CY + E.b, H = 2*E.b) 디스커넥션이 같은 좌표를 쓰게 되면서 두 벌이
   된다 — 이 파일이 반복해서 당한 자리라 먼저 뽑아 둔다.
══════════════════════════════════════════════════════════════════ */
function headHeightRef(){
  const m = state.hair3Dneutral;
  let E = null;
  try{ E = getHeadEllipsoid(); }catch(e){}
  if(!m || !E || !(E.b > 1e-6)) return null;
  const CY = (m.CY != null) ? m.CY : SCALP_CENTER_Y;
  return { yTop: CY + E.b, H: 2 * E.b };
}
/* 두상높이 정규화 v(0=정수리, 1=두상 바닥) → 모델 y. 못 재면 null. */
function headYAt(v){
  const r = headHeightRef();
  return r ? (r.yTop - v * r.H) : null;
}
/* ══════════════════════════════════════════════════════════════════
   디스커넥션 — "윗머리와 사이드가 <b>안 이어진다</b>" (2026-08-26)
   ─────────────────────────────────────────────────────────────────
   2026-08-23 8차가 "아직 못 적는 것" 1번으로 적어 둔 자리다. 그때 이렇게
   썼다 — "지금은 섹션 길이가 각자 다를 뿐 '안 이어진다'를 말할 어휘가 없다."

   ── 왜 fade의 height로는 안 되는가 ─────────────────────────────
   fadeCutLen의 height는 <b>그 섹션 뿌리 세로 범위 안에서의 %</b>다. 즉 이
   손님의 세그멘테이션이 사이드 뿌리를 어디까지 잡았느냐에 따라 같은 65가
   다른 높이를 가리킨다. 그건 <b>슬라이더 값</b>이지 모양이 아니다 — 파일
   상단이 못 박아 둔 그 금기다("프리셋을 이 손님에게 맞춘 슬라이더 값으로
   적고 싶은 유혹이 생기면 그건 이 방향을 깨는 것이다. 반드시 모양으로 적을 것").
   disc는 <b>두상 높이 정규화</b>라 누구에게나 같은 자리를 가리킨다. 레퍼런스
   사진에서 자로 잰 값을 그대로 적을 수 있는 유일한 형태다.

   ── 레퍼런스 실측 (2026-08-26, 세 뷰가 서로를 확인해 준다) ──────
   측면 뷰   눈 y240 · 턱 y425 → yTop 44 · H 393 → 라인 y125  → <b>0.21</b>
   정면 뷰   눈 y237 · 턱 y437 → yTop 25 · H 424 → 라인 y≈140 → <b>0.27</b>
   3/4 뷰    눈 y248 · 턱 y429 → yTop 57 · H 383 → 뒤쪽 y150  → <b>0.24</b>
   측면이 가장 곧게 보이는 각이라 0.21을 쓴다(8차에 이미 잰 값과 같다).
   정면이 조금 높게 나오는 건 정면에서 라인이 <b>비스듬히</b> 보이기 때문이다.

   ── 무엇을 하는가: 페이드의 <b>꼭대기</b>가 이 라인이 된다 ────────
   라인 위 뿌리 = 가위(윗머리) · 라인 아래 = 클리퍼. 그리고 그 경계에서
   섞지 않는다(bw = minBand) — 그게 "끊긴다"의 뜻이다. blendWidth는 disc가
   켜지면 안 쓴다(부드러움은 아래쪽 taper가 맡는다).

   ── ⚠ 안 한 것: 윗머리를 라인에서 자르는 캡 ─────────────────────
   "라인 위에서 난 가닥은 라인 아래로 안 내려온다"는 규칙도 같이 넣으려다
   <b>재보고 뺐다</b>. SCALP_ZONES.front의 뿌리는 phi 0.55~0.95인데, 위 자로
   환산하면 v 0.074~0.209로 <b>전부 라인 위</b>다. 캡을 걸면 앞머리가
   arcAtY(라인)까지 = 3cm 남짓으로 잘려 폼파두르가 통째로 사라진다.
   디스커넥션은 <b>옆선</b>에서 보이는 것이고, 윗머리 길이는 아래 lenCm이
   맡는다. 이 구분을 안 하고 넣었으면 앞머리를 죽여 놓고 "디스커넥션 됐다"고
   적었을 것이다.
   되돌리기: DISC3D.on = false (또는 state.fade.disc = 0 — 기본값이 0이다)
══════════════════════════════════════════════════════════════════ */
const DISC3D = {
  on: true,
  minBand: 0.02,   // 완전 계단은 렌더가 깨진다(FADE3D.minBand와 같은 이유·같은 성격)
};
/* 지금 디스커넥션 라인이 있는가 — 있으면 두상높이 정규화 v, 없으면 null. */
function discLineV(){
  const F = state.fade;
  if(!DISC3D.on || !F || !F.enabled || !(F.disc > 0)) return null;
  return Math.max(0, Math.min(1, F.disc / 100));
}
/* (2026-10-11a · 옛 64) 페이드 높이를 "옆·뒤 클리퍼 구역 전체"에서 재기
   사용자: "남자는 뒷머리 페이드 중간에 좀 긴머리가 있어."
   원인: 페이드 식이 높이를 섹션마다 따로 잼(sectionCutGuide의 yLo~yHi = 그 섹션 뿌리 범위) → 후두부 아래와 목덜미 아래 사이에 안 깎인 띠.
   지금: 관자·옆·후두·목덜미 가닥은 높이를 네 섹션을 합친 범위에서 잼 → 페이드 선 하나로 이어짐. 끄기 FADE_ZONE.on=false */
var FADE_ZONE = Object.assign({ on: true, stats: { n: 0 } }, window.FADE_ZONE || {});
var _fadeZoneMemo = { key: '', lo: null, hi: null };
const FADE_ZONE_SECS = ['temple', 'side', 'occipital', 'nape'];
function fadeZoneRange(){
  let key = '';
  try{ key = FADE_ZONE_SECS.map(s => (state.sections && state.sections[s] ? state.sections[s].length : '')).join(',') + '|' + (state.hair3Dneutral ? 1 : 0); }catch(e){}
  if(_fadeZoneMemo.key === key && _fadeZoneMemo.lo != null) return _fadeZoneMemo;
  let lo = Infinity, hi = -Infinity;
  FADE_ZONE_SECS.forEach(s => { try{ const g = sectionCutGuide(s, state.sections && state.sections[s] ? state.sections[s].length : 50); if(g && g.yHi > g.yLo){ if(g.yLo < lo) lo = g.yLo; if(g.yHi > hi) hi = g.yHi; } }catch(e){} });
  _fadeZoneMemo = { key, lo: isFinite(lo) ? lo : null, hi: isFinite(hi) ? hi : null };
  return _fadeZoneMemo;
}
function fadeCutLen(st, g, L){
  // (옛 64) 옆·뒤 클리퍼 구역은 높이 범위를 네 섹션 합친 것으로(위 FADE_ZONE)
  try{
    if(FADE_ZONE.on && st && g && FADE_ZONE_SECS.indexOf(st.sec) >= 0){
      const z = fadeZoneRange();
      if(z.lo != null && z.hi > z.lo){ g = Object.assign({}, g, { yLo: z.lo, yHi: z.hi }); FADE_ZONE.stats.n++; }
    }
  }catch(e){}
  const F = state.fade;
  if(!FADE3D.on || !F || !F.enabled) return L;
  /* ── (2026-09-01) 섹션 차단을 <b>없앴다</b> ──────────────────────────────
     사용자: "이건 <b>스포츠머리</b>도 있기 때문에 크라운, 프론트도 일부러 막지
     말라 그랬는데."
     맞다. 이 줄은 2026-08-23 7차가 남성 <b>페이드</b>를 염두에 두고 넣은
     것인데, 클리퍼가 하단 네 구역에만 들어간다는 건 페이드·언더컷의 성질이지
     <b>클리퍼의 성질이 아니다</b>. 스포츠머리(크루컷·버즈컷)는 정수리까지
     같은 가드로 민다 — 그 머리를 이 앱에서 만들 방법이 없었다.
     ⓘ 열어도 <b>기존 프리셋은 안 바뀐다</b>. 두 가지가 지켜 준다:
       · 디스커넥션이 켜져 있으면(폼파두르) 아래 dv 분기가 라인 <b>위</b> 뿌리를
         그대로 통과시킨다(ry >= yLine → return L). 크라운·프론트 뿌리는 전부
         라인 위다(DISC3D 배너 실측 v 0.074~0.209 vs 라인 0.21).
       · 디스커넥션이 꺼진 경우 height는 <b>그 섹션 안</b> 상대 위치라, 크라운에
         걸어도 크라운 뿌리 범위의 아래쪽 몇 %에만 닿는다. 스포츠머리는
         height를 100까지 올려서 만든다 — 그게 이 손잡이가 하려던 일이다.
     되돌리기: 이 함수 첫머리에 `if(!FADE_SOLVE_ABOVE_LINE[st.sec]) return L;` 복원. */
  if(!g || !(g.yHi > g.yLo)) return L;
  const cm = modelCmPerUnit();
  if(!cm) return L;                                 // 자가 없으면 아무것도 안 한다
  const gd = Math.max(0, Math.min(8, (typeof F.guard === 'number' ? F.guard : 1)));
  const guardLen = Math.max(FADE3D.skinCm, gd * FADE3D.guardInchStep) / cm;
  /* t = 0 페이드 맨 아래, 1 = 페이드 꼭대기.  bw = 꼭대기에서 가위로 넘어가는 폭. */
  let t, bw;
  const dv = discLineV();
  if(dv != null){
    /* ── 디스커넥션 (2026-08-26) — 꼭대기가 <b>두상 높이 라인</b>이다 ──────
       height(섹션 상대 %)를 안 쓴다. 그건 손님마다 다른 자리를 가리키는
       슬라이더 값이고, 이 라인은 레퍼런스에서 잰 모양이다(위 DISC3D 배너). */
    const yLine = headYAt(dv);
    if(yLine == null) return L;                     // 자가 없으면 손대지 않는다
    const ry = st.pts[0].y;
    if(ry >= yLine) return L;                       // 라인 위 뿌리 = 윗머리 — 가위 그대로
    if(!(yLine > g.yLo)) return L;                  // 이 섹션이 통째로 라인 위 — 페이드 구간이 없다
    t = (ry - g.yLo) / (yLine - g.yLo);
    bw = DISC3D.minBand;                            // <b>끊긴다</b> — 경계에서 안 섞는다
  } else {
    const h = Math.max(0, Math.min(1, (typeof F.height === 'number' ? F.height : 35) / 100));
    if(h <= 0) return L;
    const u = (st.pts[0].y - g.yLo) / (g.yHi - g.yLo);
    if(u >= h) return L;                            // 페이드 위 — 가위 그대로
    t = h > 0 ? (u / h) : 1;
    bw = Math.max(FADE3D.minBand,
                  Math.min(1, (typeof F.blendWidth === 'number' ? F.blendWidth : 40) / 100));
  }
  t = Math.max(0, Math.min(1, t));
  /* ── 테이퍼 (2026-08-26) — 가드가 <b>아래로 갈수록 닫힌다</b> ────────────
     예전엔 페이드 구간 아래쪽이 가드 하나로 <b>평평</b>했다. 그건 블록 컷이지
     테이퍼가 아니다 — 레퍼런스의 구레나룻은 거의 살이 비치고 위로 올라가며
     열린다. taper=0이면 gAt === guardLen이라 <b>산술까지 예전과 같다</b>. */
  const tp = Math.max(0, Math.min(1, (typeof F.taper === 'number' ? F.taper : 0) / 100));
  const skinLen = FADE3D.skinCm / cm;
  const gAt = guardLen + (skinLen - guardLen) * tp * (1 - t);
  /* 위쪽 bw 구간에서만 가위 길이로 넘어간다. 아래는 가드 길이(테이퍼면 그 높이의
     가드 길이)로 밀린다 — 그게 클리퍼 가드가 하는 일이다. */
  const raw = (t - (1 - bw)) / bw;
  const k = Math.max(0, Math.min(1, raw));
  const w = k * k * (3 - 2 * k);                    // smoothstep — 경계에서 꺾임이 안 보이게
  const fadeLen = gAt + (L - gAt) * w;
  return Math.min(L, fadeLen);                      // 클리퍼는 <b>짧게만</b> 한다
}

/* ══════════════════════════════════════════════════════════════════
   조각머리(PIECE) — <b>공간</b>으로 모듈화한다 (2026-08-29)
   ─────────────────────────────────────────────────────────────────
   사용자: "바로 흔히 생각하는 모듈 — 조립식이야. 구획을 나누고 조각머리들을
   만드는 거야. 기본형을 먼저 깔고, 추가 설정하고 싶은 부위에 미리 제작해 놓은
   모듈헤어를 얹는 거지. 조각 자체를 붙이는 게 아니라 <b>기하</b>를 얹는 거니까
   충분히 자연스럽지."

   ── 8/25의 모듈안과 무엇이 다른가 ────────────────────────────────
   그때 적은 것은 "파라미터 공간 위의 곡선"이었다 — <b>값</b>의 분해다. 이건
   <b>공간</b>의 분해다. 둘은 안 싸운다: 조각이 두상을 나누고, 세기(amount)는
   조각 하나 안의 손잡이가 된다. 곡선안은 버리는 게 아니라 조각 <b>안</b>으로
   들어간다.
   값 조합이 안 되는 이유도 사용자가 정확히 짚었다 — 수치 모듈은 <b>곱</b>으로
   늘어난다(가르마 3종 × 넘김 3종 × 옆머리 3종 = 27개 버튼). 공간 조각은
   <b>합</b>이다. 부위별로 몇 개씩만 있으면 조합은 얹기가 만든다.

   ── 구획을 <b>정하지 않는다</b> (사용자 지시) ────────────────────
   "합성이 자연스럽게 녹으면, 그 조각이 크든 작든 부위정보만 있으면 다 섞을 수
   있게 되는 거지." 그래서 support는 경계선이 아니라 <b>범위</b>다:
     · 조각은 두상 전체를 안 덮어도 된다 — 안 덮은 곳은 기본형이 그대로 보인다
     · 조각끼리 겹쳐도 된다 — 겹친 곳은 가중치 비율로 섞인다(아귀를 안 맞춘다)
     · <b>기본형도 조각이다</b> — support가 두상 전체인 조각 하나일 뿐이다.
       그래서 특수 케이스가 없다. 지금은 state.sections/styling이 그 자리다.
   페더(feather)가 없으면 조각 경계에 <b>선이 보인다</b>(길이가 한 칸에서 뚝
   떨어진다). mm로 적어 두면 두상 크기와 무관하게 같은 부드러움이 나온다.

   ── 성분마다 합성 규칙이 다르다 ──────────────────────────────────
     길이   min  — 가위는 <b>짧게만</b> 한다. cutRatioForStrand의 페이드가 이미
                   Math.min인 것과 같은 규약이고, 이 규칙이면 <b>조각 순서가
                   결과를 안 바꾼다</b>(스타일리스트 A와 B의 조각을 아무 순서로
                   섞어도 같은 머리가 나온다 — 나중에 올리게 할 때 이게 크다)
     밀도   mul  — 솎기는 비율이다
     방향   circ — <b>산술평균 금지</b>. 각도라서 뒤(170°)와 앞(-170°)을 그냥
                   평균하면 0°(옆으로 붕 뜸)가 나온다. 벡터로 더하고 다시
                   각도로 돌린다(원형평균 — 풍향·시각 평균과 같은 물건).
                   ⚠ 합벡터의 <b>길이</b>가 공짜로 딸려온다 = "얼마나 한 방향으로
                     모였나". 이게 조각끼리 싸우는 자리를 찾아내는 센서라,
                     아래 진단이 그 최저값을 찍는다.
     위치   dom  — 가르마 <b>위치</b>는 물리적 사실이라 섞으면 안 된다. 가중치가
                   제일 큰 조각이 이긴다(섞으면 한 머리에 가르마가 여럿 생긴다)
     나머지 add  — 세움/눌림 등은 가산이 물리적으로 맞다(볼륨 위에 국소 눌림)
   ※ 선(하드파트 면도선·페이드 라인·디스커넥션)은 <b>불연속</b>이라 가중합하면
     뭉갠다. 규칙 이름만 'hard'로 비워 둔다 — 면도선은 페이드 확인 후로 미뤘다
     (8/25 합의). 그때 이 표에 한 줄 채우면 된다.

   ── 지금 단계에서 <b>화면은 안 변해야 한다</b> ───────────────────
   조각이 0개면 base 객체를 <b>그대로</b>(사본이 아니라 같은 개체) 돌려준다.
   그래서 이 판의 검증은 "아무것도 안 바뀜"이다. pieceHarness()가 그걸 센다.
   되돌리기: PIECE3D.on = false
══════════════════════════════════════════════════════════════════ */
const PIECE3D = {
  on: true,
  /* 성분별 합성 규칙. 여기 없는 키는 전부 'add'(가중 가산)로 간다. */
  rule: {
    length:'min', density:'mul',
    curlDir:'circ', flow:'circ',
    part:'dom',
    line:'hard', technique:'dom', color:'dom',
  },
  minW: 0.002,      // 이보다 작은 가중치는 없는 것으로 본다(부동소수 잡음 컷)
};
/* 조각 목록은 state에 산다(고객마다 다르다). 없으면 빈 배열 — 기본형만. */
function hairPieces(){
  if(!state.pieces) state.pieces = [];
  return state.pieces;
}
/* 조각 하나의 support 중심을 <b>모델 좌표</b>로. (phi,theta)로 적어 두는 이유는
   두상 크기가 달라도 같은 자리를 가리키게 하려는 것이다(정규화). 좌표 규약은
   viewWeightsForRoot와 같다: phi 0=정수리, theta 0=정면 · +=우측. */
function _pieceCenterXYZ(p, E, CY){
  const phi = p.support.phi, th = p.support.theta;
  const s = Math.sin(phi);
  return { x: E.a * s * Math.sin(th), y: CY + E.b * Math.cos(phi), z: E.c * s * Math.cos(th) };
}
/* 뿌리 하나에서 조각 하나가 갖는 가중치 0~1.
   d ≤ radiusMm → 1(꽉 찬 구간) · d ≥ radiusMm+featherMm → 0 · 사이는 smoothstep.
   ⚠ 거리를 <b>mm</b>로 재는 것이 정규화의 전부다. 모델단위로 재면 큰 머리에서만
     맞는 조각이 된다. modelCmPerUnit()이 그 자다(페이드·디스커넥션과 같은 출처). */
function pieceWeightForRoot(p, root, mmPerUnit, E, CY){
  if(!p || !p.support || !(p.amount > 0)) return 0;
  if(p.support.all) return Math.max(0, Math.min(1, p.amount));   // 두상 전체 = 기본형 자격
  const c = _pieceCenterXYZ(p, E, CY);
  const d = Math.hypot(root.x - c.x, root.y - c.y, root.z - c.z) * (mmPerUnit || 0);
  const R = Math.max(0, p.support.radiusMm || 0);
  const F = Math.max(1e-6, p.support.featherMm || 0);
  if(d <= R) return Math.max(0, Math.min(1, p.amount));
  if(d >= R + F) return 0;
  const k = 1 - (d - R) / F;
  return Math.max(0, Math.min(1, p.amount)) * k * k * (3 - 2*k);
}
/* 진단용 누산기 — 프레임당 한 벌. "모임"(원형평균 합벡터 길이)의 최저값을
   여기 담는다. 조각끼리 방향이 싸우는 자리가 있으면 이 값이 떨어진다. */
let _pieceAcc = null;
/* ── 합성기 본체 ────────────────────────────────────────────────────
   base(기본형 = 지금의 state.sections[sec] / 스타일링 한 벌) 위에 조각들의
   <b>차이값</b>을 얹는다. 조각이 절대값이 아니라 차이를 담는 이유: 절대값이면
   다른 기본형 위에 얹었을 때 그 부위만 원래 스타일로 되돌아간다. */
function _compositePart(base, deltas, weights, keys){
  let out = null;                       // 얹을 게 하나도 없으면 null(= base 그대로)
  for(const k of keys){
    const rule = PIECE3D.rule[k] || 'add';
    let hit = false;
    const b = base[k];
    if(rule === 'min'){
      let v = (typeof b === 'number') ? b : null;
      for(let i=0;i<deltas.length;i++){
        const d = deltas[i][k]; if(typeof d !== 'number') continue;
        const cand = (typeof b === 'number') ? b + weights[i]*d : d;
        v = (v === null) ? cand : Math.min(v, cand); hit = true;
      }
      if(hit){ (out || (out = Object.assign({}, base)))[k] = v; }
    }else if(rule === 'mul'){
      let v = (typeof b === 'number') ? b : 100;
      for(let i=0;i<deltas.length;i++){
        const d = deltas[i][k]; if(typeof d !== 'number') continue;
        v *= (1 + weights[i]*(d - 1)); hit = true;      // d는 배율(1=변화 없음)
      }
      if(hit){ (out || (out = Object.assign({}, base)))[k] = v; }
    }else if(rule === 'circ'){
      /* 원형평균 — 기본형도 하나의 방향으로 넣고 벡터로 더한다. */
      let sx = 0, sy = 0, wsum = 0;
      if(typeof b === 'number'){ const r = b*Math.PI/180; sx += Math.cos(r); sy += Math.sin(r); wsum += 1; }
      for(let i=0;i<deltas.length;i++){
        const d = deltas[i][k]; if(typeof d !== 'number') continue;
        const r = ((typeof b === 'number' ? b : 0) + d) * Math.PI/180;
        sx += weights[i]*Math.cos(r); sy += weights[i]*Math.sin(r); wsum += weights[i]; hit = true;
      }
      if(hit){
        const R = Math.hypot(sx, sy), mean = wsum > 0 ? R/wsum : 0;
        if(_pieceAcc){ _pieceAcc.n++; if(mean < _pieceAcc.minR){ _pieceAcc.minR = mean; _pieceAcc.minKey = k; } }
        /* 모임이 0에 가까우면 방향이 <b>정해지지 않은</b> 자리다(가마가 실제로
           그렇게 생겼다). 지어낸 각으로 채우지 말고 기본형 방향을 그대로 쓴다. */
        if(mean > 0.02) (out || (out = Object.assign({}, base)))[k] = Math.atan2(sy, sx) * 180/Math.PI;
      }
    }else if(rule === 'dom' || rule === 'hard'){
      let bw = -1, bv;
      for(let i=0;i<deltas.length;i++){
        const d = deltas[i][k]; if(d === undefined || d === null) continue;
        if(weights[i] > bw){ bw = weights[i]; bv = d; hit = true; }
      }
      if(hit && bw > 0.5) (out || (out = Object.assign({}, base)))[k] = bv;   // 절반은 넘어야 이긴다
    }else{
      let v = (typeof b === 'number') ? b : 0;
      for(let i=0;i<deltas.length;i++){
        const d = deltas[i][k]; if(typeof d !== 'number') continue;
        v += weights[i]*d; hit = true;
      }
      if(hit){ (out || (out = Object.assign({}, base)))[k] = v; }
    }
  }
  return out;
}
/* 뿌리 하나에 걸리는 조각들을 합성해 {sec, sty}를 만든다.
   걸리는 조각이 없으면 <b>base 개체를 그대로</b> 돌려준다 — 사본조차 안 만든다.
   (조각 0개일 때 예전과 완전히 동일하다는 보장이자, 프레임당 수천 번 도는
    자리라 개체를 안 만드는 것이 성능이기도 하다.) */
function piecesForRoot(root, baseSec, baseSty){
  const ps = PIECE3D.on ? hairPieces() : null;
  if(!ps || !ps.length || !root) return null;
  let E, CY, mm;
  try{
    E = getHeadEllipsoid();
    CY = (state.hair3Dneutral && state.hair3Dneutral.CY) || 0;
    mm = modelCmPerUnit(); mm = (mm === null) ? null : mm * 10;   // cm/unit → mm/unit
  }catch(e){ return null; }
  if(!E || !(mm > 0)) return null;
  const dC = [], dS = [], wC = [], wS = [];
  for(const p of ps){
    const w = pieceWeightForRoot(p, root, mm, E, CY);
    if(!(w > PIECE3D.minW)) continue;
    if(p.cut){ dC.push(p.cut); wC.push(w); }
    if(p.styling){ dS.push(p.styling); wS.push(w); }
  }
  if(!dC.length && !dS.length) return null;
  const sec = dC.length ? _compositePart(baseSec, dC, wC, ADJ_GEO_SECTION_KEYS.concat(ADJ_FILTER_SECTION_KEYS)) : null;
  const sty = dS.length ? _compositePart(baseSty, dS, wS, STYLING_KEYS) : null;
  if(!sec && !sty) return null;
  return { sec: sec || baseSec, sty: sty || baseSty };
}
/* 조각 패널 줄 — 화면(패널)에서 1단계 합격 여부를 바로 읽게 한다.
   조각 0개일 때 "기본형 그대로"가 나와야 이번 판이 통과다. */
let _pieceLast = null;      // 지난 패스의 모임 최저값(진단 전용)
function piecePanelLines(){
  const ps = (state && state.pieces) || [];
  if(!PIECE3D.on) return ['[조각] OFF (PIECE3D.on=false — 예전 동작)'];
  if(!ps.length){
    return ['[조각] 0개 — <b>기본형 그대로</b> (합성기는 끼워져 있고 아무것도 안 바꿉니다)'];
  }
  const out = ['[조각] ' + ps.length + '개'];
  for(const p of ps){
    out.push('  ' + (p.name || p.id) + ' 세기 ' + Math.round((p.amount||0)*100) + '%'
      + (p.support && p.support.all ? ' · 두상 전체'
         : ' · 반경 ' + (p.support ? p.support.radiusMm : '?') + 'mm + 페더 ' + (p.support ? p.support.featherMm : '?') + 'mm'));
  }
  if(_pieceLast) out.push('  방향 모임 최저 ' + _pieceLast.minR.toFixed(2)
    + (_pieceLast.minKey ? '(' + _pieceLast.minKey + ')' : '')
    + ' — 낮으면 그 자리에서 조각끼리 방향이 싸웁니다');
  return out;
}
/* 조각 목록의 캐시 서명 — <b>반드시</b> adjCacheSig에 들어가야 한다. 안 넣으면
   조각을 얹거나 세기를 돌려도 캐시가 지난 결과를 그대로 준다(= 손잡이가 조용히
   안 먹는다). 이 파일이 fade·disc·sleek에서 반복해서 당한 그 자리다. */
function piecesSig(){
  const ps = (state && state.pieces) || [];
  if(!PIECE3D.on || !ps.length) return '0';
  return ps.map(p => (p.id||'?') + ':' + (+p.amount).toFixed(3) + ':'
    + (p.support ? (p.support.all ? 'all' : [p.support.phi, p.support.theta, p.support.radiusMm, p.support.featherMm].join(',')) : '-')
    + ':' + (p.ver || 0) + ':' + (p._rev || 0)).join('|');
}
/* [하네스] 이 판의 합격 조건은 <b>아무것도 안 바뀜</b>이다.
   콘솔에서 pieceHarness()로 부른다. */
function pieceHarness(){
  const m = state.hair3Dneutral;
  if(!m || !m.strands || !m.strands.length){ console.log('[조각·하네스] 중립 모델이 없습니다 — 조정 화면까지 진행한 뒤 부르세요.'); return false; }
  const ps = hairPieces();
  const uni = uniformStyling();
  let same = 0, n = 0;
  for(let i=0;i<m.strands.length && n<200;i+=Math.max(1, Math.floor(m.strands.length/200))){
    const st = m.strands[i]; if(!st || !st.pts || st.pts.length < 2) continue;
    n++;
    const base = (state.sections && state.sections[st.sec]) || {};
    const r = piecesForRoot(st.pts[0], base, uni || stylingForRoot(st.pts[0]));
    if(r === null) same++;
  }
  const ok = ps.length === 0 ? (same === n) : true;
  console.log('[조각·하네스] 조각 ' + ps.length + '개'
    + ' · 표본 ' + n + '가닥 중 <b>기본형 그대로</b> ' + same + '가닥'
    + (ps.length === 0 ? (ok ? ' → 조각 0개에서 전부 그대로 ✓' : ' → ✗ 조각이 없는데 값이 바뀝니다')
                       : ' (조각이 있으므로 일부가 바뀌는 것이 정상)')
    + '\n  서명 ' + piecesSig()
    + ' · 규칙 길이=min · 밀도=mul · 방향=원형평균 · 위치=우세');
  return ok;
}

/* ── 가닥 하나에 커트·펌·스타일링 연산자를 순서대로 (2026-08-08 분리) ──────
   원래 computeAdjustedHair3DStrands 안에 인라인이었는데, <b>스타일 스펙 역산</b>이
   같은 순서를 다시 짜야 했다. 두 벌이 되면 반드시 갈라진다(이 파일이 겪어온
   그 패턴) — 그래서 하나로 뽑아 둘 다 이걸 부른다.
   lenOverride를 주면 그 길이로 계산한다(이분탐색이 이걸 쓴다). */
function adjustStrandGeomBase(st, lenOverride, uni){
  /* (2026-10-01 · 옛 31 EYE_GUARD ⓒ) 길이 역산 중 시험 길이 — solveSectionLengthForTipY가 lenOverride로 시험 길이를
     넘기는 동안 fringeLineY()(앞머리 선)가 state.sections[sec].length(이전 값)를 읽어 역산과 최종 그림이 달라졌다.
     마네킹 front·crown 가닥이면 이 호출 동안만 섹션 길이를 시험 길이로 두고 끝나면 되돌린다(자르기 없음). */
  let solveLenRestore = null;
  if(EYE_GUARD.on && EYE_GUARD.fixSolveLength && st && st.mannequin && typeof lenOverride === 'number' &&
     state.sections && (st.sec === 'front' || st.sec === 'crown') && state.sections[st.sec] &&
     state.sections[st.sec].length !== lenOverride){
    solveLenRestore = [state.sections[st.sec], state.sections[st.sec].length];
    solveLenRestore[0].length = lenOverride;
  }
  try{
    /* ── 조각 합성이 들어가는 <b>이음매</b> (2026-08-29) ─────────────────────
       여기가 가닥 하나가 자기 값을 받아가는 유일한 자리다. 기본형(state.sections /
       스타일링 한 벌)을 먼저 읽고, 얹힌 조각이 있으면 그 위에 합성해서 바꿔 끼운다.
       조각이 없으면 piecesForRoot가 null을 주고 base 개체가 <b>그대로</b> 간다 —
       그래서 조각 0개면 이 줄이 없던 때와 완전히 동일하다.
       ⚠ 스타일링을 먼저 확정해야 한다(예전엔 ④ 가르마 직전에 읽었다). 조각은
         커트와 스타일링을 <b>한 번에</b> 결정하므로 순서를 위로 당긴다 — 값은
         같다(그 사이 연산자들은 sty를 안 읽는다). */
    let sec = (state.sections && state.sections[st.sec]) || {};
    let sty = (uni !== undefined ? uni : uniformStyling()) || stylingForRoot(st.pts[0]);
    {
      const pc = piecesForRoot(st.pts[0], sec, sty);
      if(pc){ sec = pc.sec; sty = pc.sty; }
    }
    const len = (typeof lenOverride === 'number') ? lenOverride : sec.length;
    const ratio = sectionLengthRatio(st.sec, len);
    const curlAmt = (typeof sec.curl === 'number') ? sec.curl : 0;
    // ⓪ 시술 전 초기화(촬영 가닥 모델에서만 의미가 있다 — 마네킹은 애초에 곧다)
    const base0 = BASE_RESET.straighten > 0 ? straightenStrand3D(st.pts, BASE_RESET.straighten) : st.pts;
    // ① 길이 — 슬라이더 비율에 <b>시술각·기법·텍스처</b>를 얹은 가닥별 비율
    let pts = lengthStrand3D(base0, cutRatioForStrand(st, sec, len, ratio));
    /* ①-b 앞머리 라인 — 얼굴 앞을 넘어온 <b>프론트·크라운</b> 가닥을 한 선에서
       일자로 자른다(fringeLineY 배너). 여기 있어야 길이를 줄일 때 선도 같이
       올라간다 — 심을 때 고정 y로 그었던 3차가 실패한 자리다.
       ⚠ 템플·사이드는 <b>안 건드린다</b>. 옆머리는 얼굴을 가로지르는 게 아니라
         얼굴 <b>옆으로</b> 떨어지는 것이고, 여기 걸면 관자가 눈썹에서 멈춘다
         (사용자: "템플은 눈썹 아래로는 안 내려오고"). */
    /* (2026-09-05) 선은 이제 <b>섹션당 하나</b>다 — 크라운은 눈썹, 프론트는
       눈높이(MQ_FRINGE.crownLine 배너). 인자를 안 넘기면 예전처럼 한 선이다. */
    if(st.mannequin && (st.sec === 'front' || st.sec === 'crown')){
      const yLine = fringeLineY(st.sec);
      if(yLine != null){
        let E = null; try{ E = getHeadEllipsoid(); }catch(e){}
        /* 크라운은 <b>방향을 안 보고</b> 자른다(2026-09-05 2차) — 얼굴 앞만
           자르면 옆·뒤로 흘러내린 크라운이 남아 절반만 걸린다. */
        const all = (st.sec === 'crown') && MQ_FRINGE.crownLine && MQ_FRINGE.crownAllAround;
        if(E || all) pts = mqTrimAtFringeLine(pts, yLine, E, all);
      }
    }
    /* (2026-09-21 배포본 반영) 스타일링 순서 스위치 — 14의 STYLE_ORDER 배너.
       spineFirst면 가르마·넘김(④⑤)을 <b>컬보다 먼저</b> 건다. 컬을 감은 뒤에 넘기면
       나선 전체가 휘어 컬이 찌그러졌다(히피펌에서 두드러짐). 먼저 곧은 가닥의 "척추"를
       넘기고 그 위에 컬을 감는다. 이때 넘김 세기는 컬이 셀수록 줄인다(sweepCurlScale).
       spineFirst=false면 예전 순서(컬 → 처짐 → 가르마 → 넘김) 그대로다. */
    const spineFirst = (typeof STYLE_ORDER !== 'undefined') && STYLE_ORDER.spineFirst;
    if(spineFirst){
      pts = partStrand3D(pts, sty.part || 0, curlAmt, sty.partAmt);                    // ④ 가르마(선행)
      pts = sweepStrand3D(pts, (sty.sweep || 0) * sweepCurlScale(curlAmt), curlAmt,
                          sty.part || 0, sty.partAmt);                                 // ⑤ 넘김(선행·컬 감쇠)
    }
    pts = curlStrand3D(pts, curlAmt, ((typeof sec.wave === 'number') ? sec.wave : 50)/100,
                       (typeof sec.curlDir === 'number') ? sec.curlDir : 0);                // ② 컬(로드 나선)
    if(curlAmt > 0) pts = gravityDroop3D(pts, curlAmt);                              // ③ 감은 뒤 처짐
    if(!spineFirst){
      /* ④ 가르마 — (예전 순서) 스타일링은 커트/펌 위에 얹는 연출이라 뒤에 온다.
         ※ 세기는 <b>원래 뿌리</b> 방향으로 정한다(길이·컬로 이동한 뒤가 아니라).
         (2026-08-29) sty는 함수 첫머리에서 이미 확정됐다 — 조각 합성이 커트와
         스타일링을 한 번에 정하기 때문이다. 읽는 값은 예전과 같다. */
      pts = partStrand3D(pts, sty.part || 0, curlAmt, sty.partAmt);
      /* ⑤ 넘김 — 가르마 값을 <b>같이</b> 넘긴다(2026-08-30). 안 넘기면 넘김이
         가르마를 덮어쓴다(sweepStrand3D 배너의 실측 표). 읽는 값은 ④와 같은 sty다. */
      pts = sweepStrand3D(pts, sty.sweep || 0, curlAmt, sty.part || 0, sty.partAmt);
    }
    // ⑥ 뿌리 볼륨 — (2026-09-21) 섹션 이름을 넘겨 섹션별 배율(VOLUME3D.secK)을 쓴다
    pts = volumeStrand3D(pts, (typeof sty.volume === 'number') ? sty.volume : 50, st.sec);
    pts = flowCurlStrand3D(pts, sty.flow || 0);                                      // ⑦ 결 흐름
    /* ⑧ 정돈 — <b>맨 마지막</b>이다. 앞의 연산자들이 만든 뜸을 전부 본 뒤에
       눕혀야 "머리가 붙었다"가 된다. 순서를 앞으로 옮기면 sweep·volume·flow가
       도로 들어 올린다(SLEEK3D 배너 참고). sleek=0이면 pts 그대로다. */
    pts = sleekStrand3D(pts, (typeof sty.sleek === 'number') ? sty.sleek : 0);
    return pts;
  }finally{
    if(solveLenRestore) solveLenRestore[0].length = solveLenRestore[1];
  }
}

/* ══ 가닥 하나 조정 — 바깥 단계 ══
   위 adjustStrandGeomBase가 커트·컬·스타일링 기본 순서다. 예전엔 기능 파일(33~69)이 adjustStrandGeom을 겹겹이 감쌌는데,
   그 감싼 순서(안쪽 → 바깥) 그대로 여기서 단계로 붙인다. 바깥 단계일수록 아래쪽(나중에 붙은 기능).
   ⚠ 24-style-base·28-perf-probe도 이 이름을 감싼다(현재 섹션 기억·시간 재기) — 동작과 무관. */
function adjustStrandGeom(st, lenOverride, uni){
  /* ── (옛 69) 등록한 스타일 길이 실린 스타일 — 마네킹 뿌리에 그 길을 그대로(STYLE_PATHS) ── */
  let out = STYLE_PATHS._adjust(st, lenOverride, uni);
  if(!out){
    /* ── (옛 68) 원본 머리 — 방향 필터로 읽은 가닥 모양을 마네킹 뿌리에 옮겨심음, 아니면 안쪽 단계 뒤 스타일 굴곡(READ_SHAPE) ── */
    out = READ_SHAPE._adjust(st, lenOverride, uni);
    if(!out) out = READ_SHAPE._afterStages(st, adjustStrandGeomStages(st, lenOverride, uni));
    STYLE_PATHS._record(st, out);   // (옛 69) 원본 머리를 볼 때 보이는 가닥 길 기록
  }
  /* ── (옛 64) 페이드가 다시 기른 머리·결 표 머리에도 먹게 — 모양이 다 만들어진 뒤 길이를 한 번 더 누름(04 SEG_ORIENT) ── */
  return SEG_ORIENT._fadeAll(st, out);
}
/* 안쪽 단계들(위가 바깥): 61 타래 뼈대 → 59 결 표 → 57·47 가닥 문맥 → 42 다시 기르기 → 41 원본 그대로 → 33 끝에서 자르기 → adjustStrandGeomBase */
function adjustStrandGeomStages(st, lenOverride, uni){
  /* ── (옛 61) 곱슬 다시 기른 머리 — 타래 뼈대로 모은 가닥으로 아래 단계 전체를 한 번 더(PHOTO_CURL) ── */
  { const lp = PHOTO_CURL._lockFor(st); if(lp){ const self = this, args = arguments; return PHOTO_CURL._withLock(st, lp, () => adjustStrandGeomStages.apply(self, args)); } }
  /* ── (옛 59) 결 표가 든 스타일 — 마네킹 가닥(또는 제 머리 바탕의 다시 기른 가닥)을 표대로(FLOW_SPEC) ── */
  { const f = FLOW_SPEC._adjust(st, lenOverride, uni); if(f) return f; }
  /* ── (옛 47) 이 가닥이 다시 기른 가닥인지 적어 둠 — 안쪽 lengthStrand3D가 늘릴 때 NATURAL_GROW(14)를 쓸지 ── */
  const _ngSave = NATURAL_GROW._cur;
  NATURAL_GROW._cur = !!(st && st.regrown && !st.mannequin);
  /* ── (옛 57) 마네킹 가닥이면 지금 스타일의 로드 배수를 안쪽 curlStrand3D가 쓰게(SPEC_PASS) ── */
  const _spSave = SPEC_PASS._enterStrand(st);
  try{
  /* ── (옛 42) 마네킹 OFF = 사진에서 다시 기른 원본 머리 — 그 가닥은 REGROW._adjust(아래 REGROW) ── */
  if(REGROW.on && st && !st.mannequin && st.pts) return REGROW._adjust(st, lenOverride, uni);
  /* ── (옛 41) 원본 3D 그대로 — 사진 가닥은 조정 엔진을 통째로 건너뜀(아래 ORIG_ASIS) ── */
  if(ORIG_ASIS.on && st && !st.mannequin && st.pts) return st.pts;
  /* ── (옛 33) 커트는 끝에서부터 — 원래 길이로 스타일을 다 만든 뒤 호길이로 끝에서 자름(14 CUT_FROM_TIP 배너) ── */
  if(!CUT_FROM_TIP.on || _cutFromTipCtx) return adjustStrandGeomBase(st, lenOverride, uni);
  const c = _cutFromTipCtx = { ratio: null, L0: 0, Lpre: 0 };
  let out;
  try{ out = adjustStrandGeomBase(st, lenOverride, uni); }
  finally{ _cutFromTipCtx = null; }
  if(c.ratio == null || !out || out.length < 2) return out;
  // 남길 길이 = 원래 가닥 호길이 × 비율(절대값). 스타일 연산은 호길이를 거의 보존하고,
  // 앞머리 선·눈 상자 트림으로 이미 더 짧아졌으면 아무것도 안 한다(두 번 줄이지 않음).
  let cutFrac = 1 - c.ratio;
  // 컬 있는 가닥은 덜 잘림 — 잘라낼 양 × 수축 계수
  const k = cutFromTipCurlSpare(st, c.ratio);
  if(k < 1){ cutFrac *= k; CUT_FROM_TIP.stats.curlSpared++; }
  const keep = (1 - cutFrac) * c.L0, have = cutFromTipArcLen(out);
  if(!(keep < have - 1e-9)) return out;
  CUT_FROM_TIP.stats.cut++;
  return cutFromTipTruncate(out, keep);
  } finally { NATURAL_GROW._cur = _ngSave; SPEC_PASS._cur = _spSave; }
}
console.log('[64] 페이드 높이 = 옆·뒤 클리퍼 구역 전체 기준(섹션마다 따로 재던 것 고침) · 끄기 FADE_ZONE.on=false');
console.log('[커트·끝에서] 설치 — 스타일을 원래 길이로 만든 뒤 끝에서부터 자릅니다(위쪽 흐름 고정) · 끄기 CUT_FROM_TIP.on=false');

/* ==========================================================================
 * ORIG_ASIS (옛 41-original-asis.js) — 원본 결 → 3D 옮기기 1단계: "원본 3D 그대로" 보기 + 옮겨진 가닥 재기
 *
 * 자리: 17b, 바깥 adjustStrandGeom 바로 뒤. 연결 지점 —
 *   · adjustStrandGeom(17b) 바깥 단계 맨 앞: ORIG_ASIS.on이면 사진 가닥을 그대로 돌려줌  — ①
 *   · mannequinReset(17a) 맨 앞: ORIG_ASIS._onMannequinReset() — 마네킹을 다시 켜면 이 모드도 끔
 *   · perfPanelLines(18) 끝에 ORIG_ASIS._panelLines()  — ②③
 *   ※ ② 재기의 "조정 후" 가닥은 예전엔 이 파일이 감싸기 직전 단계로 쟀습니다. 지금은 adjustStrandGeom 전체로 잽니다
 *     (재는 동안 on=false) — 뒤에 붙은 단계(42~)까지 포함한 값이라 진단 숫자만 조금 다를 수 있습니다.
 *
 * 왜: 마네킹 초기화를 끄면 사진에서 뜬 가닥이 3D에서 뻗치고 덥수룩해집니다(2026-10-03 노트북 영상:
 *     옆을 짧게 친 남자 머리가 3D에서는 귀를 덮는 곱슬 더벅머리 + 삐죽 솟은 가닥).
 *     원인 후보가 둘이라 먼저 갈라야 합니다.
 *       (가) 조정 엔진이 사진 가닥을 바꿈 — 마네킹을 꺼도 섹션 기본값이 그대로 걸립니다.
 *            · 컬 기본값 30 → 컬 + 처짐
 *            · 커트 엔진(CUT3D)이 섹션마다 가이드 길이로 다시 자름 → 가이드보다 짧은 가닥은
 *              끝 방향으로 곧게 "늘림"(lengthStrand3D의 ratio>1 분기, 최대 1.8배) → 삐죽한 가시
 *       (나) 들어올린 가닥 자체가 3D에서 어긋남 — 4면의 결 방향이 서로 안 맞음
 *
 * ① [원본 3D 그대로] 버튼 — 켜면 사진 가닥에는 조정 엔진을 통째로 건너뜁니다(adjustStrandGeom이
 *    가닥을 손대지 않고 돌려줌). 마네킹은 자동으로 꺼집니다. 2D·미니 3D·3D 결과 화면에 전부 걸립니다.
 *    이 상태에서 보이는 것이 "들어올린 가닥 그 자체"입니다. 켜도 뻗치면 (나), 깨끗해지면 (가).
 *    사진 영역 밖 다듬기(세그다듬기)와 빗질은 그대로 둡니다.
 *
 * ② 진단 줄 [원본 옮기기] — 사진 뷰별로
 *      가닥 수 · 길이 · 끝이 머리(타원체) 밖으로 나간 정도 · 가시 가닥 비율
 *      (가시 = 끝이 머리 반지름의 1.25배 밖 + 끝 방향이 바깥을 향함)
 *    과, 조정 엔진이 가닥 길이를 얼마나 바꾸는지(조정 후 길이 ÷ 원본 길이)를 섹션별로 찍습니다.
 *
 * ③ (2026-10-03b) [옮기기 실험] 버튼 — "원본 3D 그대로"를 켜도 뻗쳤습니다(노트북 영상). 즉 들어올리는 단계 자체의 문제.
 *    콘솔 기록에 용의자가 둘 찍혀 있습니다.
 *      · 결정렬: "필드↔가닥 각차 평균 78.7° … 150~180°에 몰림 = 극성 문제" · 스텝 64,860개 중 24,527개를 되돌림
 *        (4면의 결을 합친 방향장이 가닥 끝 방향을 반대로 알고 있는 자리가 많다는 뜻 — 그 방향으로 가닥을 꺾으면 지그재그·가시)
 *      · 채움: 가닥 10,869 → 25,099개(+131%) — 절반 넘는 가닥이 이웃을 복제해 옮겨 심은 것
 *    이 둘을 하나씩 끄고 모델을 다시 만들어, 가시·꺾임·길이가 어떻게 달라지는지 표로 찍습니다.
 *    끝나면 원래 설정으로 되돌려 다시 만듭니다. (마네킹은 꺼집니다)
 *
 * 끄기: ORIG_ASIS.on=false 후 ORIG_ASIS.refresh() · 버튼은 기본 숨김(2026-10-04) — 다시 보이려면 ORIG_ASIS.button=true (새로고침)
 * ========================================================================== */
var ORIG_ASIS = (function () {
  'use strict';
  var W = window, TAG = '[원본 그대로]';
  var O = Object.assign({ on: false, button: false /* 2026-10-04: 버튼 없앰(사용자 요청) — 콘솔 ORIG_ASIS.toggle()은 그대로 */, spikeR: 1.25, spikeCos: 0.5, sample: 1500 }, W.ORIG_ASIS || {});

  /* ① 사진 가닥은 손대지 않고 돌려줌 — adjustStrandGeom(17b) 바깥 단계 맨 앞에 있음 */
  var innerAdj = function () { return adjustStrandGeom.apply(this, arguments); };   // ② 재기용(재는 동안 on=false)

  function redraw() {
    try { if (typeof ADJ_CACHE !== 'undefined' && ADJ_CACHE.bump) ADJ_CACHE.bump(); } catch (e) {}
    try { if (typeof combRefresh === 'function') combRefresh(); else if (typeof renderAdjustFrame === 'function') renderAdjustFrame(); } catch (e) { console.warn(TAG + ' 다시 그리기 실패', e); }
  }
  var btn = null;
  function syncBtn() {
    if (!btn) return;
    btn.textContent = '원본 3D 그대로 ' + (O.on ? 'ON' : 'OFF');
    btn.classList.toggle('on', !!O.on);
  }
  O.refresh = function () { syncBtn(); redraw(); };
  O.toggle = function () {
    O.on = !O.on;
    try {
      if (O.on && typeof MANNEQUIN !== 'undefined' && MANNEQUIN.on && typeof toggleMannequin === 'function') toggleMannequin();   // 마네킹 끔
    } catch (e) {}
    console.log(TAG + ' ' + (O.on ? '켬 — 사진 가닥에 조정 엔진을 걸지 않음' : '끔 — 조정 엔진 다시 적용'));
    O.refresh();
  };
  // 마네킹을 다시 켜면 이 모드는 의미가 없으므로 같이 끔
  O._onMannequinReset = function () {   // mannequinReset(17a) 맨 앞에서 부름
    if (O.on) { O.on = false; syncBtn(); try { ADJ_CACHE.bump(); } catch (e) {} }
  };

  if (O.button) try {
    var bar = document.querySelector('#screen-adjust .mode-bar'), mq = document.getElementById('mannequinBtn');
    if (bar) {
      btn = document.createElement('button');
      btn.id = 'origAsIsBtn'; btn.type = 'button';
      if (mq && mq.className) btn.className = mq.className;
      btn.title = '사진에서 뜬 가닥을 조정 없이 그대로 3D로 봅니다 (마네킹은 꺼집니다)';
      btn.addEventListener('click', function () { O.toggle(); });
      bar.appendChild(btn);
      syncBtn();
    }
  } catch (e) { console.warn(TAG + ' 버튼 만들기 실패', e); }

  /* ────────────────────────────────────────────────────────────────────────
   * ② 재기
   * ────────────────────────────────────────────────────────────────────── */
  function arc(p) { var L = 0; for (var i = 1; i < p.length; i++) L += Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y, p[i].z - p[i - 1].z); return L; }
  function q(a, f) { if (!a.length) return NaN; var b = a.slice().sort(function (x, y) { return x - y; }); return b[Math.min(b.length - 1, Math.floor(b.length * f))]; }
  function n2(v) { return isFinite(v) ? (Math.round(v * 100) / 100).toFixed(2) : '?'; }
  function n1(v) { return isFinite(v) ? (Math.round(v * 10) / 10).toFixed(1) : '?'; }

  O.measure = function () {
    var m = state.hair3Dneutral;
    if (!m || !m.strands || !m.strands.length) return null;
    var E = null, cy = m.CY || 0, cm = 1;
    try { E = getHeadEllipsoid(); } catch (e) {}
    try { cm = modelCmPerUnit() || 1; } catch (e) {}
    if (!E) return null;
    var step = Math.max(1, m.strands.length / O.sample), byView = {}, bySec = {}, acc = 0, i, s;
    function R(p) { var x = p.x / E.a, y = (p.y - cy) / E.b, z = p.z / E.c; return Math.sqrt(x * x + y * y + z * z); }
    var keepOn = O.on; O.on = false;                       // 조정 엔진이 바꾸는 양을 재려면 잠깐 원래대로
    try {
      for (i = 0; i < m.strands.length; i++) {
        acc += 1 / step; if (acc < 1) continue; acc -= 1;
        s = m.strands[i];
        var p = s.pts; if (!p || p.length < 2) continue;
        var v = byView[s.srcAngle || '?'] || (byView[s.srcAngle || '?'] = { n: 0, len: [], tipR: [], rootR: [], spike: 0, up: 0 });
        var tip = p[p.length - 1], prev = p[p.length - 2], L = arc(p), rt = R(tip);
        // 끝 방향이 바깥(타원체 법선)을 향하는 정도
        var nx = tip.x / (E.a * E.a), ny = (tip.y - cy) / (E.b * E.b), nz = tip.z / (E.c * E.c), nl = Math.hypot(nx, ny, nz) || 1;
        var dx = tip.x - prev.x, dy = tip.y - prev.y, dz = tip.z - prev.z, dl = Math.hypot(dx, dy, dz) || 1;
        var out = (dx * nx + dy * ny + dz * nz) / (dl * nl);
        v.n++; v.len.push(L * cm); v.tipR.push(rt); v.rootR.push(R(p[0]));
        if (rt > O.spikeR && out > O.spikeCos) v.spike++;
        if (tip.y > p[0].y) v.up++;                        // 끝이 뿌리보다 위(위로 선 가닥)
        if (!s.mannequin) {
          var b = bySec[s.sec || '?'] || (bySec[s.sec || '?'] = { n: 0, ratio: [] });
          var g = null;
          try { g = innerAdj(s, null, typeof uniformStyling === 'function' ? uniformStyling() : undefined); } catch (e) { g = null; }
          if (g && g.length >= 2 && L > 1e-9) { b.n++; b.ratio.push(arc(g) / L); }
        }
      }
    } finally { O.on = keepOn; }
    return { total: m.strands.length, mannequin: !!m.mannequin, byView: byView, bySec: bySec, cm: cm };
  };

  var memoKey = null, memoVal = null;
  O.lines = function () {
    var r = null;
    try {
      var key = null;
      try { key = adjCacheSig(state.hair3Dneutral, null, 1) + '|' + (typeof adjFilterSig === 'function' ? adjFilterSig() : ''); } catch (e) { key = null; }
      if (key && key === memoKey) r = memoVal;              // 값이 그대로면 다시 재지 않음(3D 진입 기록 때마다 재지 않도록)
      else { r = O.measure(); memoKey = key; memoVal = r; }
    } catch (e) { return ['[원본 옮기기] 재기 실패: ' + (e && e.message)]; }
    if (!r) return ['[원본 옮기기] 모델 없음'];
    var L = ['[원본 옮기기] 원본 3D 그대로 ' + (O.on ? '켜짐' : '꺼짐') + ' · 모델 ' + r.total + '가닥' + (r.mannequin ? ' (지금은 마네킹 모델 — 사진 가닥을 보려면 마네킹을 끄세요)' : ' (사진 가닥)')];
    L.push('  들어올린 가닥(조정 전) — 뷰별: 길이cm 중앙값/p90 · 끝 위치(1.00=두피면) 중앙값/p90 · 가시 · 위로 선 가닥');
    Object.keys(r.byView).forEach(function (k) {
      var v = r.byView[k];
      L.push('   ' + k + ' ' + v.n + '개 · 길이 ' + n1(q(v.len, 0.5)) + '/' + n1(q(v.len, 0.9)) + ' · 뿌리 ' + n2(q(v.rootR, 0.5)) +
        ' · 끝 ' + n2(q(v.tipR, 0.5)) + '/' + n2(q(v.tipR, 0.9)) + ' · 가시 ' + Math.round(v.spike / v.n * 100) + '% · 위로 ' + Math.round(v.up / v.n * 100) + '%');
    });
    var secs = Object.keys(r.bySec);
    if (secs.length) {
      L.push('  조정 엔진이 길이를 바꾸는 양(조정 후÷원본 · 1.00=그대로) — 섹션별 중앙값/p90 · 늘린 가닥 비율');
      L.push('   ' + secs.map(function (k) {
        var b = r.bySec[k], grown = b.ratio.filter(function (x) { return x > 1.05; }).length;
        return k + ' ' + n2(q(b.ratio, 0.5)) + '/' + n2(q(b.ratio, 0.9)) + ' 늘림' + (b.n ? Math.round(grown / b.n * 100) : 0) + '%';
      }).join(' · '));
    }
    try {
      var cs = [];
      (typeof SECTION_ORDER !== 'undefined' ? SECTION_ORDER : []).forEach(function (k) {
        var sc = state.sections[k] || {}; cs.push(k + ' 길이' + sc.length + '/컬' + sc.curl);
      });
      if (cs.length) L.push('  지금 섹션 값: ' + cs.join(' · ') + ' · 커트엔진 ' + (typeof CUT3D !== 'undefined' && CUT3D.on ? '켜짐' : '꺼짐'));
    } catch (e) {}
    return L;
  };

  /* ────────────────────────────────────────────────────────────────────────
   * ③ 옮기기 실험 — 들어올리는 단계의 장치를 하나씩 끄고 다시 만들어 비교
   * ────────────────────────────────────────────────────────────────────── */
  function rawStats() {
    var m = state.hair3Dneutral;
    if (!m || !m.strands || !m.strands.length || m.mannequin) return null;
    var E = null, cy = m.CY || 0, cm = 1;
    try { E = getHeadEllipsoid(); } catch (e) {}
    try { cm = modelCmPerUnit() || 1; } catch (e) {}
    if (!E) return null;
    function R(p) { var x = p.x / E.a, y = (p.y - cy) / E.b, z = p.z / E.c; return Math.sqrt(x * x + y * y + z * z); }
    var len = [], tipR = [], kink = [], spike = 0, n = 0, pts = 0, out = 0, views = {}, i, j;
    for (i = 0; i < m.strands.length; i++) {
      var s = m.strands[i], p = s.pts; if (!p || p.length < 2) continue;
      n++;
      var L = 0, turn = 0, turns = 0;
      for (j = 1; j < p.length; j++) {
        var ax = p[j].x - p[j - 1].x, ay = p[j].y - p[j - 1].y, az = p[j].z - p[j - 1].z, al = Math.hypot(ax, ay, az);
        L += al;
        if (j > 1 && al > 1e-9) {
          var bx = p[j - 1].x - p[j - 2].x, by = p[j - 1].y - p[j - 2].y, bz = p[j - 1].z - p[j - 2].z, bl = Math.hypot(bx, by, bz);
          if (bl > 1e-9) { turn += Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by + az * bz) / (al * bl)))); turns++; }
        }
        pts++; if (R(p[j]) > 1.15) out++;
      }
      var tip = p[p.length - 1], prev = p[p.length - 2], rt = R(tip);
      var nx = tip.x / (E.a * E.a), ny = (tip.y - cy) / (E.b * E.b), nz = tip.z / (E.c * E.c), nl = Math.hypot(nx, ny, nz) || 1;
      var dx = tip.x - prev.x, dy = tip.y - prev.y, dz = tip.z - prev.z, dl = Math.hypot(dx, dy, dz) || 1;
      var isSpike = rt > O.spikeR && (dx * nx + dy * ny + dz * nz) / (dl * nl) > O.spikeCos;
      if (isSpike) spike++;
      len.push(L * cm); tipR.push(rt); if (turns) kink.push(turn / turns * 180 / Math.PI);
      var v = views[s.srcAngle || '?'] || (views[s.srcAngle || '?'] = { n: 0, spike: 0 });
      v.n++; if (isSpike) v.spike++;
    }
    return { n: n, lenMed: q(len, 0.5), lenP90: q(len, 0.9), tipMed: q(tipR, 0.5), tipP90: q(tipR, 0.9), tipMax: q(tipR, 0.999),
      kinkMed: q(kink, 0.5), kinkP90: q(kink, 0.9), spikePct: n ? spike / n * 100 : 0, outPct: pts ? out / pts * 100 : 0, views: views };
  }
  function statLine(name, r) {
    if (!r) return '  ' + name + ' — 모델 없음(만들기 실패)';
    var vs = Object.keys(r.views).map(function (k) { var v = r.views[k]; return k + ' ' + Math.round(v.spike / Math.max(1, v.n) * 100) + '%'; }).join(' / ');
    return '  ' + name + ' — 가닥 ' + r.n + ' · 가시 ' + n1(r.spikePct) + '% (' + vs + ') · 머리 밖 점 ' + n1(r.outPct) + '% · 끝 위치 ' + n2(r.tipMed) + '/' + n2(r.tipP90) + '/최대 ' + n2(r.tipMax) +
      ' · 꺾임 ' + n1(r.kinkMed) + '°/' + n1(r.kinkP90) + '° · 길이 ' + n1(r.lenMed) + '/' + n1(r.lenP90) + 'cm';
  }
  function rebuild(cb) {
    var called = false, done = function () { if (called) return; called = true; setTimeout(cb, 60); };
    try { rebuildHair3D(); } catch (e) { console.warn(TAG + ' 다시 만들기 실패', e); }
    try { buildNeutralHair3D(done); } catch (e) { done(); }
    setTimeout(done, 20000);                                 // 안전장치
  }
  var box = null;
  function showBox(text) {
    try {
      var host = document.querySelector('#screen-adjust .adjust-preview');
      if (!host) return;
      if (!box) {
        box = document.createElement('div');
        box.style.cssText = 'position:absolute;left:8px;right:8px;top:70px;bottom:56px;z-index:80;background:rgba(0,0,0,0.9);color:#0f0;font:11px/1.5 monospace;' +
          'padding:8px;border-radius:6px;white-space:pre-wrap;overflow:auto;';
        host.appendChild(box);
      }
      box.textContent = '';
      var bar = document.createElement('div'); bar.style.cssText = 'display:flex;gap:8px;margin-bottom:6px;';
      function mk(label, fn) {
        var b = document.createElement('button'); b.type = 'button'; b.textContent = label;
        b.style.cssText = 'min-height:30px;padding:4px 12px;border-radius:8px;border:1px solid #0f0;background:#062a06;color:#0f0;font:600 12px monospace;';
        b.addEventListener('click', function (e) { e.stopPropagation(); fn(b); }); return b;
      }
      bar.appendChild(mk('복사', function (b) {
        var ok = function () { b.textContent = '복사됨 ✓'; setTimeout(function () { b.textContent = '복사'; }, 1500); };
        try { navigator.clipboard.writeText(text).then(ok, function () { b.textContent = '복사 실패'; }); } catch (e) { b.textContent = '복사 실패'; }
      }));
      bar.appendChild(mk('닫기', function () { box.style.display = 'none'; }));
      // 눈으로 보기 — 그 설정으로 다시 만들어 둔 채로 둠(미니 3D·3D 결과 화면에서 확인). '원래대로'로 되돌림.
      ['②', '③', '④', '⑤', '원래대로'].forEach(function (lab, idx) {
        bar.appendChild(mk(lab === '원래대로' ? lab : lab + '로 보기', function () { box.style.display = 'none'; O.view(idx === 4 ? 0 : idx + 1); }));
      });
      bar.style.flexWrap = 'wrap';
      box.appendChild(bar); box.appendChild(document.createTextNode(text));
      box.style.display = 'block';
    } catch (e) {}
  }
  var running = false, base = null;
  /* n: 0=원래대로 1=결정렬 끔 2=채움 끔 3=둘 다 끔 4=둘 다+세그다듬기 끔 — 그 설정으로 다시 만들어 둔다(눈으로 확인용) */
  O.view = function (n) {
    if (running) return;
    if (!base) base = { field: HAIR_FIELD3D.on, fill: HAIR_OVERLAP.fill, occ: HAIR_OCC3D.on };
    var c = [base, { field: false, fill: base.fill, occ: base.occ }, { field: base.field, fill: false, occ: base.occ },
      { field: false, fill: false, occ: base.occ }, { field: false, fill: false, occ: false }][n] || base;
    running = true;
    try { if (typeof MANNEQUIN !== 'undefined' && MANNEQUIN.on && typeof toggleMannequin === 'function') toggleMannequin(); } catch (e) {}
    HAIR_FIELD3D.on = c.field; HAIR_OVERLAP.fill = c.fill; HAIR_OCC3D.on = c.occ;
    try { if (typeof showAI === 'function') showAI('다시 만드는 중…', ''); } catch (e) {}
    setTimeout(function () {
      rebuild(function () {
        try { if (typeof hideAI === 'function') hideAI(); } catch (e) {}
        running = false; O.viewing = n;
        console.log(TAG + ' 보기 설정 ' + n + ' — 결정렬 ' + (c.field ? '켬' : '끔') + ' · 채움 ' + (c.fill ? '켬' : '끔') + ' · 세그다듬기 ' + (c.occ ? '켬' : '끔'));
        redraw();
      });
    }, 60);
  };
  O.experiment = function () {
    if (running) return;
    if (typeof rebuildHair3D !== 'function' || typeof buildNeutralHair3D !== 'function' || typeof HAIR_FIELD3D === 'undefined' || typeof HAIR_OVERLAP === 'undefined') {
      console.warn(TAG + ' 실험에 필요한 함수가 없습니다'); return;
    }
    running = true;
    try { if (typeof MANNEQUIN !== 'undefined' && MANNEQUIN.on && typeof toggleMannequin === 'function') toggleMannequin(); } catch (e) {}
    if (!base) base = { field: HAIR_FIELD3D.on, fill: HAIR_OVERLAP.fill, occ: HAIR_OCC3D.on };
    var keep = base;
    var cases = [
      { name: '① 지금 그대로            ', field: keep.field, fill: keep.fill, occ: keep.occ },
      { name: '② 결정렬 끔              ', field: false, fill: keep.fill, occ: keep.occ },
      { name: '③ 채움(복제) 끔          ', field: keep.field, fill: false, occ: keep.occ },
      { name: '④ 결정렬·채움 둘 다 끔   ', field: false, fill: false, occ: keep.occ },
      { name: '⑤ ④ + 세그다듬기도 끔    ', field: false, fill: false, occ: false }
    ];
    var out = ['[옮기기 실험] 들어올리는 단계의 장치를 하나씩 끄고 다시 만든 결과 (조정 엔진은 안 거친 가닥 그대로)',
      '  읽는 법 — 가시: 끝이 머리 반지름의 ' + O.spikeR + '배 밖 + 끝 방향이 바깥 (뷰별 %) · 머리 밖 점: 타원체 1.15배 밖에 있는 점 · 끝 위치: 중앙값/p90/최대(1.00=두상 타원체 면)',
      '           꺾임: 가닥 안에서 이웃 마디 사이 평균 각(중앙값/p90) — 크면 지그재그 · 길이: 중앙값/p90'];
    var i = 0;
    function say(t) { try { if (typeof showAI === 'function') showAI('옮기기 실험 중…', t); } catch (e) {} }
    function next() {
      if (i >= cases.length) return finish();
      var c = cases[i];
      say((i + 1) + ' / ' + cases.length);
      HAIR_FIELD3D.on = c.field; HAIR_OVERLAP.fill = c.fill; HAIR_OCC3D.on = c.occ;
      setTimeout(function () {
        rebuild(function () {
          var r = null; try { r = rawStats(); } catch (e) { console.warn(TAG + ' 재기 실패', e); }
          out.push(statLine(c.name, r));
          i++; next();
        });
      }, 60);
    }
    function finish() {
      HAIR_FIELD3D.on = keep.field; HAIR_OVERLAP.fill = keep.fill; HAIR_OCC3D.on = keep.occ;
      say('원래 설정으로 되돌리는 중');
      rebuild(function () {
        try { if (typeof hideAI === 'function') hideAI(); } catch (e) {}
        running = false; O.viewing = 0;
        try { out.push('  사진 각도 — ' + ['front', 'left', 'right', 'back'].map(function (k) { return k + ' ' + Math.round(getViewYawDeg(k)) + '°'; }).join(' · ') + '  (측면이 90°에 가까울수록 옆·뒤 깊이를 실제로 잰 것)'); } catch (e) {}
        out.push('  눈으로 보려면 위의 [②로 보기]…[⑤로 보기]를 누르세요 — 그 설정으로 다시 만들어 둡니다. [원본 3D 그대로]를 켠 채 미니 3D와 3D 결과 화면에서 비교하고, 끝나면 [원래대로].');
        O.lastExperiment = out.join('\n');
        console.log(O.lastExperiment);
        showBox(O.lastExperiment);
        redraw();
      });
    }
    next();
  };

  if (O.button) try {
    var bar2 = document.querySelector('#screen-adjust .mode-bar');
    if (bar2) {
      var eb = document.createElement('button');
      eb.id = 'origExpBtn'; eb.type = 'button'; eb.textContent = '옮기기 실험';
      eb.title = '들어올리는 단계의 장치를 하나씩 끄고 다시 만들어 가시·꺾임·길이를 비교합니다 (10~30초)';
      eb.addEventListener('click', function () { O.experiment(); });
      bar2.appendChild(eb);
    }
  } catch (e) {}

  /* perfPanelLines(18) 끝에 붙는 줄들 */
  O._panelLines = function () {
    var L = [];
    try { L = L.concat(O.lines()); } catch (e) {}
    if (O.lastExperiment) L = L.concat(O.lastExperiment.split('\n'));
    return L;
  };

  console.log(TAG + ' 설치 — 조정 화면의 [원본 3D 그대로] 버튼 · 진단 줄 [원본 옮기기]. 콘솔: ORIG_ASIS.toggle() · ORIG_ASIS.lines().join("\\n")');
  return O;
})();

/* ==========================================================================
 * REGROW (옛 42-regrow.js) — 원본 결 → 3D: 뿌리부터 다시 기르기 (4장 버전 · v1)
 *
 * 자리: 17b, ORIG_ASIS 다음. 원래 함수에서 부르는 곳 —
 *   · adjustStrandGeom(17b) 바깥 단계 맨 앞 — 다시 기른 사진 가닥은 REGROW._adjust
 *   · toggleMannequin · mannequinReset(17a) 앞뒤 — 마네킹 값 기억/되돌림, 끄면 다시 기른 머리로
 *   · setupAdjustScreen(05) 끝 — 마네킹이 꺼져 있으면 바로 다시 기른 머리
 *   · registerCurrentAsStyle(06) 맨 앞 — 슬라이더를 안 움직였으면 잰 숫자로 등록
 *   · extractHairMask(03b) 맨 앞 · computeHairOrientationField(04) 끝 · measureViewHairIdentity(03a) 끝 — 컬·타래 재기
 *   · trimStrandToOccupancy3D(13b) 맨 앞 — 뒤로 늘어뜨린 가닥은 다듬기 건너뜀
 *   · perfPanelLines(18) 끝에 REGROW._panelLines()
 *
 * 왜 (2026-10-03 실험):
 *   지금 방식은 사진에서 결을 따라 그은 긴 선 하나를 머리카락 한 올로 보고, 선의 위쪽 끝을 뿌리로 삼아
 *   머리 겉면에 걸쳐 놓습니다. 그래서
 *     · 뿌리가 크라운에 몰립니다(폼파두르: crown 68% · front 1% · temple 0% — 두피 면적은 crown 28%).
 *     · 짧은 옆머리를 정수리에서 난 9cm 가닥이 덮습니다(버섯 갓 모양).
 *     · 4면의 결을 하나로 합친 방향장을 따르게 하면 오히려 꺾입니다(꺾임 25° → 37°).
 *   긴 머리에서도 가닥이 얼굴을 가로지르고 지그재그였습니다.
 *
 * 무엇을:
 *   ① 뿌리 — 마네킹과 같은 방식으로 두피 전체에 심습니다(실측 뿌리밀도 × 셀 면적).
 *   ② 방향 — 4면을 미리 합치지 않습니다. 가닥이 한 걸음 나갈 때마다 지금 자리를 각 사진에 되비춰
 *      그 픽셀의 결 방향을 직접 읽고, 그 자리를 정면으로 보는 사진일수록 크게 칩니다.
 *      (그 사진 각도에서 보면 2D 원본 결과 같은 방향으로 흐르게 됩니다.)
 *   ③ 두께 — 두피에서 바깥으로 얼마나 떠 있는가는 사진 윤곽선으로 잽니다: 두피 셀마다 법선을 따라
 *      나가며 "이 점이 모든 사진에서 머리 영역 안인가"를 물어 처음 벗어나는 높이를 두께로 씁니다.
 *      어느 사진도 판정 못 하는 자리(정옆·뒤 일부)는 이웃 셀 값으로 메웁니다(추정).
 *   ④ 길이 — 사진의 머리 영역을 벗어나면 멈춥니다. 상한은 섹션별 원본 가닥 길이.
 *   ⑤ 방향의 앞뒤 — 2D 결은 선이라 앞뒤가 없습니다. 기본은 아래(중력) 쪽, 수평이면 뒤쪽·가르마 바깥쪽.
 *      그쪽으로 머리가 없으면(앞 헤어라인 아래 = 이마) 반대로 기릅니다 → 세운 앞머리.
 *   ⑥ 두피를 벗어나면(목덜미 아래·얼굴 쪽) 자유 낙하 구간 — 결을 따르되 중력을 섞고 두상 안으로 못 들어가게.
 *
 * 화면(2026-10-04 바뀜): 버튼 없음 — 마네킹 OFF면 자동으로 다시 기르고 치수를 재서 슬라이더에 넣습니다(아래 "버튼 없이 자동" 참고).
 *       (예전: 조정 화면 [다시 기르기] 버튼. 켜면 마네킹은 꺼지고 [원본 3D 그대로]가 켜집니다
 *       (조정 엔진의 기본 컬·커트가 섞이지 않은 결과를 먼저 보기 위해서).)
 *       진단 줄 [다시 기르기]에 뿌리 분포·길이·꺾임·추정 비율·멈춘 이유가 찍힙니다.
 *
 * 한계(v1): 측면 사진이 28~51°라 정옆·뒤의 두께는 추정이 섞입니다. 속머리(겉에서 안 보이는 층)는 겉 결을 따릅니다.
 *
 * v2 (2026-10-03b · 폼파두르 첫 실측: 뿌리 crown 68% → 30%로 정상화, 머리가 두상에 붙음. 남은 것 —
 *      꺾임 26.8°(가짜 두상에서는 3.8°) · 그루터기 4,227개가 페이드 자리에 주황 점선으로 보임 · 길이 상한에 걸린 가닥 34%)
 *   · 관성 — 매 걸음 사진 결을 그대로 따르지 않고 직전 방향과 섞습니다(사진 결의 픽셀 잡음이 가닥을 떨게 했음).
 *   · 다 기른 뒤 가닥을 한 번 고르게 폅니다(양 끝 고정).
 *   · 두께를 칸 단위로 뚝뚝 읽지 않고 이웃 칸과 보간합니다(칸 경계에서 높이가 계단처럼 튀던 것).
 *   · 사진에 머리가 없다고 나오는 자리의 뿌리는 억지로 그루터기를 세우지 않고 안 심습니다(페이드는 두피색 그대로).
 *   · 길이 상한 — 짧은 머리는 섹션별 원본 길이 중앙값 × 1.25, 어깨 아래로 내려오는 긴 머리는 넉넉히(p95 × 1.3).
 *
 * v3 (2026-10-03c) 스타일 숫자로 재기 — 다시 기른 머리에서 스타일 스펙(등록 스타일과 같은 형식)을 잽니다.
 *   [스타일 숫자 재기] 버튼 → 숫자를 보여 주고 → [이 숫자로 스타일 등록]. 등록된 스타일은 다른 손님에게
 *   기존 경로(applyStyleSpec — 그 손님 마네킹에서 같은 cm·끝 높이가 되도록 역산)로 걸립니다.
 *   무엇을 어떻게 재는가:
 *     · 긴 머리 — 섹션별 "끝 높이"(tipAt: 정수리에서 두상 높이의 몇 배 아래에서 끝나는가). 가닥이 사진의 머리 끝까지
 *       자랐으므로 그대로 믿습니다.
 *     · 짧은 머리 — 섹션별 길이 cm. 두피에 누운 가닥은 사진만으로 길이를 알 수 없어서(1cm 머리가 겹겹이 누운 것과
 *       10cm 머리가 누운 것이 겉에서 같아 보임) 그 자리의 두께로 어림합니다: 길이 ≈ 두께 × liftK(2.2).
 *       ⚠ 어림값입니다 — 등록 전에 숫자를 보고, 다른 손님에게 건 뒤 슬라이더로 고치는 것을 전제로 합니다.
 *     · 페이드 — 옆·뒤 아래쪽에서 "사진에 머리가 없어 안 심은 뿌리"가 차지하는 높이. 가드·테이퍼는 기본값.
 *     · 뿌리 볼륨 — 윗머리(크라운+프론트) 뿌리 자리의 두께(cm)에서. 35 + 10×cm (1.5cm = 50 중립, 3.5cm = 70).
 *     · 넘김 — 윗머리 가닥이 뒤로 흐르는 정도(+ 뒤로 · − 앞으로).
 *     · 가르마 — 위치·세기를 재서 보여 주기만 합니다(스펙에는 아직 안 넣음 — 좌우 부호를 실제 사진으로 확인한 뒤 넣을 것).
 *     · 컬 — (v4에서 잼 · 아래)
 *
 * v4 (2026-10-04h) 컬 재기 — 곱슬머리 사진을 다시 기르면 직모처럼 나왔습니다(실측: 앞머리가 눈까지 덮인 곱슬 단발 → 매끈한 바가지 머리).
 *   왜: 다시 기르기는 한 걸음 ≈0.4cm에 관성 55%로 결을 따라가고, 다 기른 뒤 두 번 폅니다. 지름 1~2cm짜리 컬은 이 걸음으로는
 *       따라갈 수 없어서 가닥은 "컬을 편 뼈대"만 남습니다. 그리고 컬 값은 재지 않고 0으로 넣었습니다.
 *   무엇을:
 *     · 재기 — 03a가 뷰마다 재 둔 "결이 꺾이는 정도"(curlDegPerPx: 결을 따라 6px 간 자리의 결 방향이 몇 도 달라졌나 ÷ 6)의
 *       뷰 중앙값을 컬 0~curlMax로 옮깁니다(curlLo 이하 = 0 · curlHi 이상 = curlMax · 사이는 직선).
 *       ⚠ curlLo·curlHi는 합성 무늬(직모 0.1 · 굵은 웨이브 2.5 · 곱슬 3.6~4.9 °/px)로 잡은 어림값입니다 — 실제 사진 몇 장의
 *         진단 줄([스타일 숫자] 컬 …)을 보고 고쳐야 합니다. 로드 굵기(웨이브)는 못 재서 기본값 50.
 *     · 보이기 — 잰 컬을 섹션 컬 슬라이더에 넣고, 가닥에는 기존 컬 엔진(curlStrand3D)으로 겁니다.
 *       컬을 주면 가닥이 그만큼 짧아지므로(나선), 잰 컬에서 겉모양이 사진과 같도록 가닥의 "편 길이"를 미리 늘려 잡습니다
 *       (사진에 보이는 길이 ÷ 남는 비율). 그래서 컬을 내리면 머리가 길어지고(펴짐), 올리면 짧아집니다.
 *     · 컬이 0으로 재진 머리(직모)는 예전과 똑같습니다(가닥을 손대지 않음).
 *   끄기: REGROW.curl=false 후 마네킹을 켰다 끄기.
 *
 * v5 (2026-10-04i) 컬 굵기 재기 — v4는 컬의 "세기"만 재고 굵기(로드)는 기본값 50이라, 굵은 컬 사진도 지름 1.5cm쯤의 잔 컬로 나왔습니다.
 *   재기: 사진을 분석할 때(결 방향장을 만든 직후) 결을 따라 걸어가며 "몇 px 가면 결 방향이 처음과 달라지는가"를 잽니다
 *        (방향 상관이 절반으로 떨어지는 거리 dHalf). 컬이 굵을수록 멀리 가야 달라집니다.
 *        컬 반경(px) ≈ curlRk × (dHalf − curlR0) — 타래 모양 합성 무늬(반경 12~60px)로 맞춘 식입니다(⚠ 어림). 
 *        결 방향장이 7px 창으로 뭉개져 있어서 반경 5px 미만은 구분하지 못합니다(270px짜리 사진이면 약 1cm 미만).
 *        px → cm는 그 뷰의 카메라 배율로 바꾸고, 뷰 중앙값을 씁니다.
 *   적용: 나선 반경 = 잰 컬 반경이 되도록 웨이브(로드 굵기) 슬라이더 값을 정합니다. 로드 최대(웨이브 100)로도 모자라면
 *        다시 기른 가닥에 한해 로드를 그 배수만큼 더 키웁니다(rodScale — 가닥을 줄여서 컬을 건 뒤 다시 키우는 방식).
 *        등록 스타일에는 웨이브 값만 들어갑니다(100을 넘는 몫은 안 들어감).
 *   끄기: REGROW.curlRadius=false (웨이브 50 · 배수 없음 = v4 동작)
 *
 * v6 (2026-10-05k) 긴 머리는 목 아래에서 그냥 곧게 늘어뜨림 — 사용자: "어깨 앞으로 머리를 내려야 할 필요가 있기 전까지는 그냥 아래로
 *   늘어뜨린 형태로. 복잡도만 높아진다. 어깨 앞으로 넘겨서 뒷머리가 구겨졌던 손님도 — 어차피 목덜미 아래까지 내려오는 머리니까 —
 *   일괄적으로 쭉 내려오도록."
 *   예전: 두피를 벗어난 뒤에도 사진의 결을 따라가서, 머리를 어깨 앞으로 넘긴 사진이면 가닥이 앞으로 감기려 하고(backFix가 막음)
 *        길이도 사진의 머리 영역이 정해서 뒤쪽이 들쭉날쭉 구겨졌습니다.
 *   지금(hangDown · 긴 머리만): 턱·목덜미 높이(yBody) 아래로 내려온 가닥은 사진 결을 읽지 않고 곧게 아래로 내립니다(hangK로 부드럽게 꺾음).
 *        끝 높이는 사진 가닥의 끝 높이 분포(뒤 사진 가닥이 20개 넘으면 그것 · 아니면 전체)의 25~75% 사이에서 가닥마다 뽑습니다.
 *        그 높이까지는 사진이 "머리 없음"이라 해도 이어 갑니다(섹션 길이 상한은 그대로 적용).
 *        어깨에 닿는 가닥은 50번이 전부 등 쪽으로 넘깁니다(50번 frontDrape=false).
 *   짧은 머리와, 긴 머리의 목 위쪽 구간은 예전 그대로입니다.
 *   끄기: REGROW.hangDown=false 후 마네킹을 켰다 끄기.
 *
 * v8 (2026-10-06n) 컬 굵기 적용을 끔(10/4 방식으로 되돌림) — 사용자(영상·콘솔): "왜 이 컬은 도로 컬이 죽어서 나와?"
 *   콘솔: 컬 75 · 컬 굵기 반경 1.3cm → 웨이브 100 + 로드 ×1.29. 화면: 컬이 아니라 곧은 막대가 사방으로 삐죽 나온 모양.
 *   원인: v5가 잰 반경에 맞추려고 웨이브를 100으로 올리고 로드를 1.29배 했는데, 실제 컬 엔진(14c 컬 묶음)은 로드가 굵어지면
 *        한 바퀴 간격이 훨씬 더 빨리 늘어납니다. 실제 엔진에 곧은 가닥을 넣어 재 보니(하네스 자 기준) 컬 75에서
 *        웨이브 50 = 한 바퀴 2cm · 17.7cm 가닥에 4.7바퀴 / 웨이브 100 = 한 바퀴 11cm · 1.9바퀴. 두 바퀴도 안 감기면 컬이 아니라 비스듬한 막대로 보입니다.
 *        v5의 환산식은 14번의 단순 나선을 가정한 것이라 이 엔진과 맞지 않았습니다.
 *   지금: curlRadius=false — 컬 값만 사진에서 재고 웨이브는 50(10/4에 컬로 보이던 상태). 반경은 재서 진단에만 찍습니다.
 *   다시 켜기: REGROW.curlRadius=true (실제 엔진에 맞춘 환산을 새로 만들기 전에는 권하지 않음)
 *
 *   (2026-10-06r) 컬 굵기 적용은 다시 껐습니다. q에서 "결 정렬만 꺼도 컬이 돌아왔다"고 보고 켰는데, 콘솔 기록을 대조하니 컬이 돌아온 그때(09:57)는
 *     파일이 이미 curlRadius=false(웨이브 50)였습니다. 굵기를 켠 q(웨이브 100 + 로드 ×1.29 · 결 정렬은 건너뜀)에서는 다시 막대가 됐습니다(16:26 영상).
 *     즉 컬이 살려면 둘 다 필요합니다: 굵기 적용 끔 + 곱슬머리는 결 정렬 안 함.
 *   (2026-10-06p) 그런데 굵기를 끈 것만으로는 부족했습니다 — 사용자: "REGROW.align=false로 하니까 돌아왔어."
 *     v7 결 정렬이 곱슬 사진의 뼈대를 나란히 펴 버린 것입니다(이 사진: 돌린 가닥 28,334 · 돌린 각 중앙값 23.8°. 직모 손님은 6.4°).
 *     곱슬머리의 뼈대는 일부러 엇갈려 있고 그 엇갈림이 컬의 부피를 만듭니다. → 사진에서 잰 컬이 alignCurlOff(40) 이상이면 정렬을 안 하고,
 *     그 아래는 세기를 비례해서 줄입니다.
 *
 * v7 (2026-10-05m) 기른 뒤 결 정렬 — 사용자: "머리는 결이 중요하다. 일부러 삐죽하게 하지 않는 이상 주변 머리와 한 방향으로 나란히 정렬된다.
 *   일일이 빗질하기 전에, 사진에서 읽힌 결과 일반적인 결 방향을 참고해서 방향을 잡아 둘 수 없나?"
 *   다시 기르기는 가닥을 하나씩 따로 길러서, 한 가닥이 결을 잘못 읽으면 그 가닥만 혼자 튑니다(이웃을 보지 않음).
 *   다 기른 뒤 한 번:
 *     ① 자리(alignCell ≈ 1.3cm 칸)마다 그 칸을 지나는 가닥들의 평균 방향(= 이웃들의 결)과 가닥 수를 냅니다.
 *        머리 겉면 밖으로 뜬 잔머리는 제 칸에 이웃이 없으므로, 두상 쪽으로 alignReach칸(≈ 4cm)까지 들어가며 가장 가까운 이웃 결을 씁니다.
 *     ② 가닥의 마디가 그 평균에서 alignTol° 넘게 벗어나면 평균 쪽으로 돌립니다(alignFull° 이상이면 alignK만큼 · 사이는 부드럽게).
 *        이미 나란한 마디는 안 건드립니다. 평균이 뚜렷하지 않은 칸(가르마·가마처럼 방향이 갈리는 자리 — 결집도 < alignCoh)과,
 *        평균과 거의 반대인 마디(alignFlip° 넘음)는 그대로 둡니다. 마디 길이는 그대로라 가닥 길이는 안 변합니다.
 *     ③ 혼자 나간 꼬리 — 끝까지 이웃이 없는 칸(가닥 수 ≤ strayMax)만 지나는 꼬리가 strayMinSeg 마디 넘으면 그 꼬리를 잘라 냅니다
 *        (머리 밖으로 크게 휘어 나간 고리 가닥).
 *   컬은 이 뼈대 위에 따로 얹히므로 잰 컬은 그대로 걸립니다.
 *   끄기: REGROW.align=false 후 마네킹을 켰다 끄기.
 *
 * 끄기: 버튼 또는 REGROW.on=false 후 REGROW.refresh()
 * ========================================================================== */
var REGROW = (function () {
  'use strict';
  var W = window, TAG = '[다시 기르기]';
  var G = Object.assign({
    on: false, button: true,
    step: 0.022,        // 한 걸음(모델 단위 ≈ 0.4cm)
    maxSteps: 44,
    minFacing: 0.22,    // 이 사진이 그 자리를 이만큼은 정면으로 봐야 결을 읽음
    /* (2026-10-20) 사진끼리 맞춰 보기 — 실제 사진 기준. 한 걸음에 두 장 이상이 결을 읽었는데 서로 agreeDeg°보다 벌어지면
       가장 믿을 만한 사진(정면도² × 결 또렷함이 큰 쪽)과 맞는 사진만 씀. 엇갈린 사진도 그만큼 믿을 만하면(무게가 agreeRatio배 안쪽)
       어느 쪽이 맞는지 모르는 것이니 이 걸음은 결을 못 읽은 걸로 보고 관성으로 이어 감(agreeAmbig='skip').
       생성 사진(장마다 따로 그림)은 33-synth-photo.js가 이 값을 느슨하게 바꿈. 끄기 REGROW.agree=false */
    agree: true, agreeDeg: 30, agreeRatio: 1.5, agreeAmbig: 'best' /* (2026-10-24) 'skip' → 'best': 두 사진이 엇갈리고 둘 다 믿을 만해도 결을 버리지 않고 가장 믿을 만한 사진(정면도²×또렷함)을 따름 — 각도가 조금 틀려 결이 어긋날 때 "결이 빠지는" 걸음을 없앰 · 예전 ?ambig=skip */,
    /* (2026-10-24) 사진끼리 머리 영역 맞추기 — 각도는 미디어파이프 그대로 두고, 사진마다 가운데(cx)·정수리 높이(crownY)만 ±photoAlignMaxCm 안에서 옮겨
       "다른 사진들로 깎은 3D 덩어리가 그 사진의 머리 영역을 얼마나 설명하나"(사진 평균)가 가장 큰 자리로. 다시 기르기의 사진 값만 바꿈(다른 단계는 그대로).
       기준 사진(정면 · 없으면 뒤)은 안 옮김. 실제 사진 세트(09:40 · 세 장)로 미리 재 본 값: 평균 0.837 → 0.866. 끄기 ?photoalign=0 · REGROW.photoAlign=false */
    photoAlign: true, photoAlignMaxCm: 2, photoAlignN: 30000, photoAlignCols: 96, photoAlignMinGain: 0.004,
    /* (2026-10-24) 걸음 안 세 번 더 보기(RK4) — 0.4cm 걸음 하나를 정할 때 처음 자리(사진 여러 장 · 맞춰 보기 포함)에 더해
       걸음 중간 두 번 · 끝 한 번을 "처음 자리에서 쓴 사진"의 결로만 다시 읽어 평균(1:2:2:1). 걸음은 그대로라 가닥 점 수는 안 늘고, 굽은 결(컬 고리·웨이브)을 0.1cm 걸음만큼 따라감.
       디버그 파일 곱슬 뒷모습으로 흉내: 0.4cm 걸음 = 고리 안 닫힘 · 0.1cm 걸음 = 닫힘 · 0.4cm+RK4 = 0.1cm와 거의 같음. 끄기 ?rk=0 · REGROW.rk=false */
    rk: true, rkSkipDeg: 5,   // (2026-10-24b) 걸음 끝에서 먼저 한 번 읽어 처음 자리 결과 이 각(°) 안이면 중간 두 번은 건너뜀(곧은 결) · 0 = 늘 네 번
    /* (2026-10-24b) 같은 길을 두 번 돌면 멈춤 — 사용자: "직모나 고리나 같은 경로를 두번 돌면 멈추기". 중력을 끈 뒤 가닥이 머리 덩어리 안을 돌며 걸음 수 상한까지 가던 것(실제 세트 9,704가닥 · 곱슬 21,360가닥).
       새 점이 loopBackCm 넘게 앞에서 지나간 자기 길에서 loopCm 안이고 가는 쪽도 같으면(cos ≥ loopCos) 그 자리에서 끝(한 바퀴는 남음). 끄기 ?loopstop=0 · REGROW.loopStop=false */
    loopStop: true, loopCm: 0.35, loopBackCm: 1.6, loopCos: 0.5,
    /* (2026-10-24) 결이 끊긴 곳에서 끝(시험 · 기본 끔) — 한 걸음 꺾인 각이 직전 세 걸음 꺾임의 중앙값보다 kinkDeg° 넘게 크면(곡선이 이어지지 않고 다른 결로 갈아탐) 그 앞에서 끝.
       디버그 파일(점 0.8cm 간격)로 잰 것: 꺾여 오르기 시작하는 자리의 튐 중앙값 직모 단발 61° · 실제 66° · 곱슬 33° / 고리 도는 구간 13~18°.
       45°에서 꺾여 오르는 자리 잡힘 61% · 69% · 39% / 고리 구간 점이 잘못 잘림 8% · 13% · 5%(점마다 — 고리 한 바퀴면 더 큼). 켜기 ?kink=1 · REGROW.kinkStop=true */
    kinkStop: false, kinkDeg: 45, kinkMinCm: 2,
    minCoh: 0.08,       // 결 또렷함 하한
    layerLo: 0.2, layerHi: 1.0,   // 가닥이 두께의 몇 %까지 뜨는가(가닥마다 무작위)
    tMax: 0.45,         // 두께 재기 상한(모델 단위 ≈ 9cm)
    tStep: 0.012,
    outlineCos: 0.3,    // 두께는 그 자리를 거의 옆에서(법선·카메라축 각 73° 이상) 보는 사진으로만 잼
    tFloor: 0.012,      // 두께 바닥(≈ 0.25cm)
    lenCap: false,      // (2026-10-11f) 길이 상한(섹션 중앙값 × lenMul) 끔 — 길이는 3D 머리 덩어리 밖·누운 머리 두께로 끝남. 걸음 폭 정하는 데만 씀(걸음 수는 3배까지)
    lenPct: 0.5, lenMul: 1.25,    // 짧은 머리 길이 상한 = 섹션별 원본 가닥 길이 중앙값 × 1.25
    longPct: 0.95, longMul: 1.3,  // 긴 머리(어깨 아래로 내려오는 가닥이 longShare 넘게 있음)는 넉넉히
    longShare: 0.1,
    sideLayStay: true,  // (2026-10-11p) 앞 헤어라인에서 옆으로 눕힌 가닥(10d)은 두피를 벗어나는 자리에서 끝 · 길이도 그 섹션 상한까지 — 길이 상한을 끈 뒤(11f) 관자놀이 밖 허공으로 뻗어 나가 옆머리에 가시가 되던 것. false = 예전(두피 밖으로 이어 감)
    stubCm: 0,          // (2026-10-22) 끔 — 걷기 안 규칙도 끔(읽기·기르기 강화 단계 · 되돌리기 ?judge=1) · 예전 1.2
    stubCm_was: 1.2,    // (2026-10-10e) 안 뒤집은 얇은 자리(옆·목덜미 머리선)에 심는 짧은 머리 길이(cm) · 0 = 안 심음
    polDown: 0,         // (2026-10-22) 끔 — 걷기 안 규칙도 끔(읽기·기르기 강화 단계 · 되돌리기 ?judge=1): 오르막 벌점 · 예전 2.5
    polDown_was: 2.5,   // (2026-10-10f) 두피 위에서 결(앞뒤 없는 선)의 앞뒤를 고를 때 비탈을 거꾸로 오르는 쪽에만 이만큼 벌점(비탈 기울기에 비례) — 한 번 위로 가면 계속 위로 가며 두상을 감던 것. 옆으로 흐르는 결(가마·가르마)은 안 건드림 · 0 = 예전(직전 방향만)
    glossSkip: false,   // (2026-10-22) 끔 — 걷기 안 규칙도 끔(읽기·기르기 강화 단계 · 되돌리기 ?judge=1): 광택 띠 수평 결 안 읽기 · 예전 true
    glossSkip_was: true, // (2026-10-10f) 광택 보정 — 머리색보다 많이 밝은 자리(광택 띠)에서 수평에 가까운 결은 안 읽음(광택 띠 가장자리를 결로 잘못 읽은 것) · false = 끔
    glossLo: 0.35,      // 광택 판정: (밝기 − 머리색 밝기) ÷ (255 − 머리색 밝기)가 이 값 이상
    glossFlat: 0.5,
    glossNbrKeep: false, // (2026-10-12b) 끔 — 광택 띠의 수평 결은 둘레와 같아도 안 읽음(직모 손님에서 798개가 살아 가닥이 옆으로 꺾임). 다시 켜기 true   // (2026-10-11s) 3·6번만 되돌림 — 이것은 12:25 그대로 · 끄기 false   // (2026-10-11q) 원인 찾기용 스위치 — false면 광택 띠의 수평 결을 둘레와 같아도 안 읽음(10f)
    secVol: true,        // (2026-10-11s) 3·6번만 되돌림 — 이것은 12:25 그대로 · 끄기 false   // (2026-10-11q) 원인 찾기용 스위치 — false면 섹션 부피(volShare/volPoint/weight)를 스펙에 안 넣음
    glossNbr: 8,        // (2026-10-10i) 둘레 결을 볼 거리(마스크 px)     // 수평에 가까움: |sin(결 각)| 이 값 미만(±30°)
    flipThickCm: 1.8,   // (2026-10-10g) 4 → 1.8 — 실측 앞쪽 뿌리 두께: 넘겨 세운 남자 앞머리 중앙값 2.3cm · 눕힌 여자 앞머리 1.0cm
    flipRule: false,    // (2026-10-22) 끔 — 걷기 안 규칙도 끔(읽기·기르기 강화 단계 · 되돌리기 ?judge=1): 앞머리선 뿌리 뒤집기·옆으로 눕히기(flipThickCm · sideLayStay · stubCm 모두 이 규칙 뒤에 걸림) · 예전 true
    thinStopCm: 0 /* (2026-10-22) 끔 — 걷기 안 규칙도 끔(읽기·기르기 강화 단계 · 되돌리기 ?judge=1): 얇은 자리에서 멈춤 · 예전 0.5 */, thinStopRoot: 1.2, thinStopAfter: 1.0,   // (2026-10-10j) 뿌리 두께가 thinStopRoot cm 이상인 가닥은 두께 thinStopCm 미만 자리(페이드)에 들어서면 멈춤(뿌리에서 thinStopAfter cm 지난 뒤) · 0 = 끔
    polSlopeLo: 0.35, polSlopeHi: 0.75,   // (2026-10-10i) 오르막 벌점은 비탈이 이 기울기(내리막 방향 길이 0~1) 사이에서 서서히 걸림 — 가마·정수리처럼 완만한 곳은 결 그대로 돎
    polThickLo: 0, polThickHi: 0,   // (2026-10-12b) 끔(둘 다 0 = 두께로 벌점을 안 풂) — 뿌리 두께 2.2cm 이상인 자리(직모 손님 옆·뒤)에서 벌점이 꺼져 가닥이 위로 거슬러 가던 것. 예전 값 1.4 / 2.2   // (2026-10-10g) 오르막 벌점을 뿌리 두께로 풂 — 이 cm 이하면 벌점 그대로 · 이 cm 이상(세운 머리·볼륨)이면 벌점 없음 · 사이는 서서히
    flipThickCm_note: 0,     // (2026-10-10c) 출발 방향 뒤집기(아래에 머리가 없으면 위로)는 뿌리 자리 머리 두께가 이 cm 이상일 때만 — 세운 앞머리. 얇으면(눕힌 머리·목덜미 짧은 머리) 안 뒤집음 · 0 = 예전처럼 늘 뒤집음
    trace: true,        // (2026-10-10b) 걸음 기록 — 기본 켬(시험판). 끄기 REGROW.trace=false · 켜면 가닥마다 걸음별로 무엇이 방향을 정했는지 남김(60번 내보내기에 실림) · 머리 모양은 그대로
    traceEvery: 25,     // 기록할 보통 가닥 표본 간격(두피 위에서 길이 상한까지 간 가닥은 전부)
    inertia: 0,         // (2026-10-24) 0.55 → 0: 읽은 결 그대로(관성이 웨이브·삐침·컬 고리를 폄 — 디버그 파일 흉내로 확인) · 되돌리기 ?judge=1
    inertia_was: 0.55,  // 직전 방향을 섞는 비율(0 = 사진 결 그대로)
    smooth: 2,          // 다 기른 뒤 고르게 펴는 횟수
    liftK: 2.2,
    onScalpLen: false,  // (2026-10-22) 판정 끔 — 읽은 대로 그리고 사진과 대조만(34 READ_STEPS · 되돌리기 ?judge=1): 머리 전체 '짧은/긴 머리' 판정으로 길이를 두께×liftK로 정하던 것 · 예전 true
    onScalpLen_was: true, // (2026-10-11a) 짧은 머리: 두피 위로 누운 가닥은 뿌리 자리 두께 × liftK에서 끝(누운 머리는 기와처럼 겹쳐 사진에서 끝없이 이어 보임 — 걸어간 거리는 가닥 길이가 아님. 스펙 길이와 같은 잣대)         // 짧은 머리 길이 어림 = 뿌리 자리 두께 × 이 값
    // (2026-10-04h) 컬 재기 — 머리말 v4 참고
    curl: false,        // (2026-10-22) 판정 끔 — 읽은 대로 그리고 사진과 대조만(34 READ_STEPS · 되돌리기 ?judge=1): 뷰 중앙값 하나(머리 전체 컬)를 모든 섹션에 걸어 나선을 얹던 것 — 재기는 그대로(진단 raw) · 예전 true
    curlLo: 1.8, curlHi: 4.0,   // 결 꺾임(°/px) 이 구간을 컬 0 → curlMax로 (⚠ 합성 무늬로 잡은 어림값)
    curlMax: 90,                // 100이면 가닥 점 수가 3배(나선 11바퀴) — 90이면 2배쯤
    curlMin: 10,                // 이보다 작게 재지면 0(직모)으로 봄
    curlMinN: 20,               // 뷰의 표본 수가 이보다 많아야 믿음
    curlKeepShape: true,        // 잰 컬에서 겉모양이 사진과 같도록 편 길이를 미리 늘려 잡음
    // (2026-10-04i) 컬 굵기 — 머리말 v5 참고
    curlRadius: false,          // (2026-10-06r) 끔 — 켜면 컬이 죽음(웨이브 100 + 로드 ×1.29 = 곧은 막대). q에서 다시 켠 것은 잘못 읽은 것 — 머리말 v8 참고
    clumps: true, clumpWin: 17, clumpLift: 1.5, clumpMinPx: 25,   // (2026-10-10m) 곱슬 사진에서 타래 조각 찾기(61번이 3D 가닥을 조각대로 묶음)
    waveFromHelix: true, waveFromHelixBelow: 30, waveHelixPitchLo: 3, waveHelixPitchHi: 15, waveHelixRLo: 0.8, waveHelixRMaxK: 0.6, waveCurlLo: 40, waveCurlHi: 65,   // (2026-10-10p) 굵은 웨이브: 컬이 30 미만으로 잡혀도 나선 측정이 한 바퀴 3~15cm·반경 0.8cm 이상을 잡으면 컬 40~65(반경÷간격에 비례). 사용자: 이 정도(한 바퀴 7~8cm)면 "강한 펌은 아니지만 약한 펌도 아님" → 60대 · 더 굵은 미국식 웨이브(간격이 더 김)는 40~50대
    fadeOn: false,      // (2026-10-22) 판정 끔 — 읽은 대로 그리고 사진과 대조만(34 READ_STEPS · 되돌리기 ?judge=1): 잰 페이드로 토글을 켜 가닥을 깎던 것 · 예전 true
    fadeOn_was: true,   // (2026-10-10l) 페이드를 잰 손님은 페이드 토글을 켜서 시작
    curlHelix: true,    // (2026-10-10m) 다시 켬(사용자: 타래 구현까지 한 다음에 판단) · 예전 메모: 실제 곱슬 사진(타래가 여러 방향으로 감김)에서 사진마다 0.6~1.1cm로 들쭉날쭉·정면은 못 잼 → 사진 전체 한 번이 아니라 부분마다 재는 방식으로 다시 만들 때까지 예전 어림식
    curlHelix_was: true, helixPeak: 0.3, helixBetaLo: 25, helixBetaHi: 78,   // (2026-10-10k) 나선 측정으로 컬 반경·한 바퀴 간격을 잼(쓸 조건: 반복 세기 · 가닥 기울기 범위) · false = 예전 어림식
    curlAmp: false, curlAmpK: 1.15, curlAmpWavy: 0.25,   // (2026-10-10j) 끔 — 실제 곱슬 사진에서 0.4cm로 작게 잼(큰 컬은 선이 타래 경계에서 끊겨 빠지고 잔물결만 남음) → 뽀글이. 고칠 때까지 예전 어림식   // (2026-10-10h) 컬 반경을 결 선의 흔들림 폭으로 직접 잼(합성 컬 진폭 3~25px에서 실제의 74~96% → ×1.15) · 흔들리는 선이 이 비율 이상일 때만 · false = 예전 어림식
    curlRk: 5, curlR0: 3.3,     // 컬 반경(px) = curlRk × (dHalf − curlR0)  (⚠ 합성 타래 무늬로 맞춘 어림)
    curlRminPx: 5,              // 이보다 작게는 구분 못 함(결 방향장의 창 크기)
    curlRodScaleMax: 3,         // 로드 최대를 넘길 수 있는 배수 상한
    minLenCm: 0.8,
    tapPx: 4,           // 머리 영역 판정 여유(800px 기준)
    gravity: 0.25,      // (2026-10-24c) 다시 켬 — 사용자: "기본 중력은 살려야지" (판정 단계에서 끈 것은 중력과 겹치는 보정 규칙이지 기본 중력이 아님). 0으로 두니 두피 밖 가닥을 두상 쪽으로 붙잡는 힘이 없어 정수리 위를 곧게 지나가 윗면·뒷면이 평평해졌음(디버그 1610) · 예전 값 실험: REGROW.gravity=0
    gravity_was: 0.25,  // 두피 밖 구간에서 중력을 섞는 비율
    // (2026-10-04e) 뒷머리가 앞으로 쏠리는 것 막기 — 아래 backFix 설명 참고
    backFix: false,     // (2026-10-12r) 끔 — 사용자: "그거 꺼" (뒷머리 뒤로 넘기기 · 몸통에 자연스럽게 흘러내리기와 겹치면 안 됨) · 다시 켜기 REGROW.backFix=true
    backFix_was: true,  // (2026-10-11j) 다시 켬(사용자 선택 (가)) — 끄니 뒷머리가 몸통을 뚫고 앞으로 넘어옴(뒤 뿌리 → 몸 앞 1,278가닥). 몸통이 없는 동안은 이것이 뒷머리를 뒤에 둠
    backFoldAfter: true, backFoldFlat: false, backFoldDropCm: 6, backFoldRampCm: 6, backFoldBw: 0.25,   // (2026-10-12d) 뒷머리를 뒤에 두는 것을 "읽은 뒤"에 함 — 사용자: "읽을 때 뺄 필요는 없거든? 렌더링까지는 읽어서 한 뒤 처리 과정에서 뒤로 넘기는 걸로" · "뒷머리에서 나온 가닥들을 결 정리하는 식으로". 걷는 동안에는 앞으로 가는 것을 안 막고(사진대로 끝까지 읽음), 다 읽은 가닥에서 어깨 높이(턱·목덜미 높이에서 backFoldDropCm 아래)부터 backFoldRampCm에 걸쳐 서서히 두피를 벗어난 자리의 깊이까지 뒤로 옮김 → 귀~어깨 사이 옆머리는 사진 그대로. backFoldBw: 뒤쪽 정도가 이 값 이상이면 온전히 넘김. false = 예전(걷는 동안 막음)
    freeDepth: 0.6,     // 두피 밖 구간에서 사진 결이 지어낼 수 있는 깊이(카메라 쪽/반대쪽) 움직임 상한(가로·세로 움직임의 몇 배)
    backFrom: 0.1, backFull: 0.5,   // 두피를 벗어난 자리가 얼마나 뒤쪽인가(0 = 귀 옆 · 1 = 정뒤) — 이 구간에서 0→1로 막음
    // (2026-10-05k) 긴 머리는 목 아래에서 곧게 늘어뜨림 — 머리말 v6 참고
    /* (2026-10-13k) 두피 밖에서 다시 오르지 않음 — 사용자 영상(21:10·21:26 긴 생머리): 뒷머리 아래에서 뒤·위로 곧게 솟은 묶음.
       로그: 기른 가닥 28,724 중 솟은 가닥 2,263 + 내려갔다 다시 솟은 가닥 2,138(15%) · "세그멘테이션이 어깨/옷을 머리로 따라갔을 가능성" 경고.
       원인: 두피 위 구간에는 오르막 벌점(polDown)이 있지만 두피 밖 구간은 사진 결(+중력 0.25)을 그대로 따라감. 어깨·옷까지 머리로 잡힌 사진에서
         등까지 내려온 가닥이 어깨선·옷 윤곽(목 쪽으로 올라가는 선)의 결을 만나면 그 선을 타고 위로 거슬러 올라감 — 몸에 부딪혀 결이 반대로 잡힌 것.
       고침: 두피를 벗어난 뒤 가장 낮게 내려간 높이보다 noClimbCm 넘게 올라가는 걸음은 위 성분을 지움(옆·뒤로만 감 → 덩어리 밖에서 끝남).
         세운 앞머리처럼 두피를 벗어나며 위로 가는 구간은 아직 내려간 적이 없으므로 안 걸림. 끄기 REGROW.noClimbCm=0 */
    noClimbCm: 0,       // (13l) 끔 — 아래 soloSideBelow가 원인 자리를 고쳐서 필요 없음(켜면 13k 동작)
    /* (2026-10-13l) 원인 확인(진단 데이터 22:31 · 긴 생머리): 두상 아래에서 사진 한 장만 보고 걸은 걸음 14,339 중 옆으로 누운 걸음 2,681(18.7%) —
       사진 두 장이 같이 본 걸음은 1.1%, 긴 웨이브 손님은 0.4%. 전부 뒷모습 사진(포즈 실측 아님 · 180° 가정 · 신뢰도 0.25) 한 장의 결.
       걸음 기록: 등을 내려오던 가닥이 목덜미 높이(두피 아래 12cm)에서 그 결을 따라 옆으로 돌아 목 뒤를 가로질러 감(x +8 → −4.5cm) → 뒷모습의 아치 · 오름을 막기 전엔 솟은 가닥.
       고침: 두상 아래(y < CY − b)에서 결을 읽은 사진이 한 장뿐이고 그 결이 수직에서 60° 넘게 누우면(|y| < soloSideCos) 그 걸음은 결을 못 읽은 것으로 침.
       사진 두 장이 같이 옆으로 가라고 하면 그대로 따름. 끄기 REGROW.soloSideBelow=false */
    soloSideBelow: false, soloSideCos: 0.5,   // (2026-10-14 배포본) true → false
    hangDown: false,    // (2026-10-11f) 끔 — 긴 머리도 3D 머리 덩어리를 빠져나가는 곳에서 끝(곧게 늘어뜨려 끝 높이 맞추기 대신)
    hangK: 0.6,         // 한 걸음마다 아래 방향을 섞는 비율(클수록 빨리 곧아짐)
    // (2026-10-05m) 기른 뒤 결 정렬 — 머리말 v7 참고
    align: false,       // (2026-10-22) 판정 끔 — 읽은 대로 그리고 사진과 대조만(34 READ_STEPS · 되돌리기 ?judge=1): 이웃 평균 쪽으로 돌리기 + 세기를 머리 전체 컬(alignCurlOff)로 정하던 것 · 예전 true
    alignCell: 0.07,    // 이웃을 보는 칸 크기(모델 단위 ≈ 1.3cm)
    alignK: 0.75,       // 많이 벗어난 마디를 평균 쪽으로 돌리는 세기(0~1)
    alignTol: 12, alignFull: 40, alignFlip: 100,   // 도: 이 안쪽은 그대로 · 이 이상은 alignK만큼 · 이 넘게 반대면 안 건드림
    alignCoh: 0.6,      // 칸의 결집도(평균 벡터 길이)가 이보다 낮으면 그 칸은 기준으로 안 씀
    alignMin: 4,        // 칸을 지나는 가닥이 이만큼은 돼야 기준으로 씀
    alignReach: 3,      // 제 칸에 기준이 없으면 두상 쪽으로 이 칸 수까지 들어가며 이웃 결을 찾음(겉면 밖으로 뜬 잔머리)
    alignRoot: 0.15, alignRootFade: 0.1,   // 뿌리에서 이 길이(≈ 2.7cm)까지는 안 돌리고, 그 뒤 이 길이에 걸쳐 서서히(뿌리 볼륨을 눕히지 않게)
    strayTrim: true, strayMax: 1, strayMinSeg: 4, strayKeep: 1,   // 혼자 나간 꼬리 자르기
    alignCurlOff: 40,   // (2026-10-06p) 사진에서 잰 컬이 이 값 이상이면 결 정렬을 안 함(0~이 값 사이는 세기를 비례해서 줄임) · 0 = 컬과 무관하게 정렬
    // (2026-10-04g) 목 — 늘어뜨린 가닥이 목(과 그 아래 몸통 기둥) 안으로 못 들어가게. 화면에 보이는 목과 같은 치수.
    neck: false, neckMargin: 1.1,
    hullRule: 'front',  // (2026-10-11h) 사용자: "다수결방식에 정면을 참고하는 걸로" — 'front' = 다수결 + 정면이 1cm 넘게 밖이면 머리 아님 ·    // (2026-10-11g) 'tol' = 여유 둔 교집합: 그 자리를 보는 사진 중 하나라도 머리 영역에서 여유(정면 1 · 옆·뒤 1.5cm) 넘게 밖이면 머리 아님 — 예전 다수결은 2:2 동점도 머리로 쳐서 웨이브 손님 덩어리가 1.3배 컸음 · 'face' = 다수결 + 마주 보는 사진
    hullViews: ['front', 'left', 'right', 'back'], hullMarginCm: 1.0, hullMarginSideCm: 1.5, hullMissMax: 2 /* (2026-10-24b) 걷기 여유는 예전대로 — 0.3·0.4로 줄이면 사진끼리 조금 어긋난 자리에서 가닥이 끊김(디버그 파일: 일찍 멈출 가닥 중 다시 머리 영역으로 들어오던 가닥 직모 8~24% · 실제 58% · 곱슬 22%). 대신 다 걸은 뒤 머리 영역 밖으로 나간 끝만 자름(아래 trimTail) */, hullFacing: true, hullCellPx: 3,   // (2026-10-11b) 그 자리를 가장 정면으로 마주 보는 사진이 '밖'이라고 하면 밖(정면 1cm · 옆·뒤 1.5cm 여유) — 사용자: "정 안맞는 곳은 해당 면의 사진영역으로 결정" · 사진 맞춤은 65번   // (2026-10-11a) 껍질 = 사진들의 "교집합" — 이 사진들이 머리 영역 밖(여유 이 cm 넘게)이라고 하면 다른 사진이 머리라고 해도 머리 아님. 정면은 얼굴 랜드마크로 맞춘 사진이라 믿을 수 있음 · [] = 예전 다수결만
    tri3D: false, /* (2026-10-11r) 원인 찾기 결과 — 끔. 다시 켜기 REGROW.tri3D=true */ tri3DMinDeg: 35, tri3DPrior: 0.15,   // (2026-10-11a) 두피 밖 결의 3D 방향 = 두 장 이상의 사진 결이 만드는 평면들의 교선(깊이를 직전 걸음에서 물려받지 않음) · 시선축이 이 각 이상 벌어진 사진들일 때만
    volume: true, volCellCm: 0.6, volTight: false /* (2026-10-22) 끔 — 머리 전체 컬 30 이상이면 만들던 좁은 덩어리(61번 전용) */, volTightMinCurl: 30,   // (2026-10-11d) 3D 머리 덩어리 — 사진 네 장(마주 보는 사진 규칙)으로 칸마다 머리/아님을 한 번 정해 두고, 걷기·61번(마네킹 위 컬의 축 길이)이 같은 덩어리를 씀
    polNbr: true,       // (2026-10-11d) 뿌리 결이 옆으로 흐릴 때 앞뒤 방향을 "가운데 선 바깥"이 아니라 이웃 뿌리들의 방향으로(남자분 가운데 가르마의 원인)
    straightCurly: false, straightMode: 'path', straightWinK: 1.0, straightCurlMin: 40, straightPitchK: 0.5, straightDHalfK: 4, straightRMinPx: 5, straightRMaxPx: 40,   // (2026-10-10s) 곱슬 사진은 큰 흐름만 따라 직모 뼈대로 기름(컬은 61·14c가 그 위에 얹음) — 반경 = 한 바퀴 간격 × K (못 쟀으면 dHalf × K) · 사진 px
    sliceMs: 60,        // (2026-10-12e) 30 → 60: 화면에 양보하는 횟수를 반으로(폰에서 쉬는 시간이 얼마인지는 아래 진단 줄 '일한 시간/쉰 시간'으로 확인)
    waveField: true, waveCellCm: 0.8, waveMinN: 3,   // (2026-10-12e) 읽은 굴곡 장 — 곱슬·웨이브 사진에서 '읽은 길 − 편 길'을 자리(칸)마다 모아 둠. 61번이 PHOTO_CURL.readWave일 때 마네킹 가닥에 그대로 얹음 · 안 만들기 waveField=false
    sGrid: true, sGridK: 4,   // (2026-10-12l) 고른 결 미리 계산(속도) · 끄기 sGrid=false
    axisGabor: false, axisK: 0.5, axisRMinPx: 4, axisRMaxPx: 60, axisWinK: 1.0,   // (2026-10-12j) 축 = 방향 필터 파장으로 고른 결을 따라 걸음(아래 설명) · 끄기 axisGabor=false
    measureShare: 1, measureFull: ['front', 'temple'],   // (2026-10-12e) 기른 가닥은 재는 용도뿐(원본 = 마네킹 + 스펙)이라 measureFull 밖의 섹션은 이 비율만 기름 · 전부 기르기 measureShare=1
    seed: 20261003,
    /* (2026-10-21i) 사진 윤곽 끝 자르기(결 정렬 바로 뒤)
       디버그 파일 2개(곱슬 단발 1947 · 직모 단발 1952)를 같은 투영으로 대 보니:
       - 걷기는 껍질 여유(hullMarginCm 1 · hullMarginSideCm 1.5)만큼 밖으로 나가야 멈춤 → 끝이 늘 그만큼 밖에서 끝남. 정렬이 조금 더 밈.
         직모: 아래 끝 정면 +3.3 · 뒤 +3.6cm, 1cm 넘게 밖으로 나간 가닥 35%(정렬 전 28%) · 앞머리 가닥은 중앙값 3.1cm가 이마 위 · 옆머리 p90 15cm가 얼굴 앞.
       - 그 점을 "마주 보는"(머리 중심보다 카메라 쪽) 사진 중 하나라도 머리 영역(+trimTolCm) 밖이면 밖 — 얼굴·목 뒤로 가려진 뒷머리는 판정 안 함.
       - 밖으로 trimOutCm 넘게 이어지면 그 자리에서, 밖에서 끝난 꼬리가 trimTailCm 넘으면 꼬리를 자름(뿌리 쪽 trimKeepPts점은 남김).
       같은 데이터로 돌려 본 결과: 직모 아래 끝 +3.3/+1.1/+1.2/+3.6 → +0.3/−0.3/+0.2/+0.5cm · 넘침 6.5/4.4/8.9/4.6 → 3.8/0.8/0.6/0.0%
         (대신 빔 9.3/9.5/10.8 → 15.4/14.3/12.1% — 어깨 앞으로 떨어지는 머리를 걷기가 원래 못 채움. 얼굴 앞 가닥이 가려 주던 몫이 드러난 것)
         곱슬: 거의 그대로(넘침 1.7/6.8/4.9/2.0 → 0.8/2.6/3.6/0.4%).
       끄기 ?rgtrim=0 또는 REGROW.trimTail=false · 사진·투영은 07b PHOTO_CHECK와 같은 것 */
    trimTail: true /* (2026-10-24b) 다시 켬 — 끝만 자름: 마지막으로 머리 영역(마주 보는 사진 + trimTolCm) 밖으로 나간 꼬리를 나간 자리에서 자름 · 가운데에서 나갔다 다시 들어오는 것은 안 자름(trimOutCm 99) · 끄기 ?rgtrim=0 */, trimTolCm: 0.4, trimOutCm: 99, trimTailCm: 0.2, trimKeepPts: 3
  }, W.REGROW || {});
  var S = G.stats = null;
  try { var rgtQ = /[?&]rgtrim=([01])/.exec(String(location.search || '')); if (rgtQ) G.trimTail = rgtQ[1] === '1'; } catch (e) {}
  try { var t3Q = /[?&]tri3d=([01])/.exec(String(location.search || '')); if (t3Q) G.tri3D = t3Q[1] === '1'; } catch (e) {}
  try { var qs24 = String(location.search || ''), m24;
    if ((m24 = /[?&]rk=([01])/.exec(qs24))) G.rk = m24[1] === '1';
    if ((m24 = /[?&]loopstop=([01])/.exec(qs24))) G.loopStop = m24[1] === '1';
    if ((m24 = /[?&]kink=([01])/.exec(qs24))) G.kinkStop = m24[1] === '1';
    if ((m24 = /[?&]photoalign=([01])/.exec(qs24))) G.photoAlign = m24[1] === '1';
    if ((m24 = /[?&]ambig=(skip|best)/.exec(qs24))) G.agreeAmbig = m24[1];
  } catch (e) {}   // 시험용: 어깨 앞으로 떨어지는 머리(빔)가 채워지는지
  G.trimStat = null;

  function now() { try { return performance.now(); } catch (e) { return Date.now(); } }

  /* ────────────────────────────────────────────────────────────────────────
   * (2026-10-12e) 읽은 굴곡 장 — "읽은 결을 그대로 쓴다"의 그릇
   *   곱슬·웨이브 사진은 뼈대를 펴서 기릅니다(직모 뼈대). 그때 버려지던 '읽은 길 − 편 길'(= 사진에서 읽은 굴곡)을 편 길의 자리(칸)마다 모읍니다.
   *   굴곡은 가닥을 따라간 길이가 아니라 "자리"에 고정돼 있어서(옆 가닥과 마루가 나란함 — 타래) 결 표(길이 칸 평균)로는 지워지고, 자리 칸으로 모으면 남습니다.
   *     D  = 칸에 든 가닥들의 벗어남 평균(벡터) — 이웃 가닥이 같이 굽은 자리만 남고, 제각각인 자리(못 읽은 컬)는 서로 지워져 0에 가까워짐
   *     aC = 같이 굽은 크기(둘레 5칸에서 |ΣD| ÷ 표본 수 × √2) — "여기서 굴곡을 얼마나 읽었나"
   *   make(칸 크기, 범위) → add(읽은 길, 편 길) … → finish() → at(p, out): out.x/y/z = D, out.a = aC, out.k = 아는 정도(0~1)
   * ──────────────────────────────────────────────────────────────────────── */
  function makeWaveField(cell, bx, win) {
    var nx = Math.max(2, Math.ceil((bx.x1 - bx.x0) / cell)), ny = Math.max(2, Math.ceil((bx.y1 - bx.y0) / cell)), nz = Math.max(2, Math.ceil((bx.z1 - bx.z0) / cell)), NV = nx * ny * nz;
    if (!(NV > 0) || NV > 4e6) return null;
    var SX = new Float32Array(NV), SY = new Float32Array(NV), SZ = new Float32Array(NV), NN = new Float32Array(NV), nAdd = 0, nSmp = 0, minN = Math.max(1, G.waveMinN | 0);
    function arcOf(p) { var a = new Float64Array(p.length), i; for (i = 1; i < p.length; i++) a[i] = a[i - 1] + Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y, p[i].z - p[i - 1].z); return a; }
    var F = {
      cell: cell, nx: nx, ny: ny, nz: nz, x0: bx.x0, y0: bx.y0, z0: bx.z0, known: 0, ampU: 0, cohMed: 0, strands: 0, samples: 0,
      add: function (raw, str) {
        if (!raw || !str || raw.length < 3 || str.length < 3) return;
        var ar = arcOf(raw), as = arcOf(str), Lr = ar[raw.length - 1], Ls = as[str.length - 1]; if (!(Lr > 0) || !(Ls > cell)) return;
        var ds = cell * 0.5, m = Math.ceil(Ls / ds), i, jr = 0, js = 0, t, tr, u, a, b, qx, qy, qz, ix, iy, iz, id;
        var PXs = new Float32Array(m + 1), PYs = new Float32Array(m + 1), PZs = new Float32Array(m + 1), CX = new Float64Array(m + 2), CYs = new Float64Array(m + 2), CZ = new Float64Array(m + 2);
        for (i = 0; i <= m; i++) {
          t = Math.min(Ls, i * ds); tr = t / Ls * Lr;
          while (js < str.length - 2 && as[js + 1] < t) js++;
          while (jr < raw.length - 2 && ar[jr + 1] < tr) jr++;
          a = str[js]; b = str[js + 1]; u = (t - as[js]) / Math.max(1e-12, as[js + 1] - as[js]); PXs[i] = a.x + (b.x - a.x) * u; PYs[i] = a.y + (b.y - a.y) * u; PZs[i] = a.z + (b.z - a.z) * u;
          a = raw[jr]; b = raw[jr + 1]; u = (tr - ar[jr]) / Math.max(1e-12, ar[jr + 1] - ar[jr]); qx = a.x + (b.x - a.x) * u; qy = a.y + (b.y - a.y) * u; qz = a.z + (b.z - a.z) * u;
          CX[i + 1] = CX[i] + (qx - PXs[i]); CYs[i + 1] = CYs[i] + (qy - PYs[i]); CZ[i + 1] = CZ[i] + (qz - PZs[i]);
        }
        // 굴곡만 남김 — 벗어남에서 한 바퀴 창(win) 평균을 뺌(편 길이 굽은 자리 안쪽으로 파고든 만큼 같은 큰 어긋남은 굴곡이 아님)
        var h = win > 0 ? Math.max(1, Math.round(win / 2 / ds)) : 0, lo, hi, c, dx, dy, dz;
        for (i = 1; i <= m; i++) {
          dx = CX[i + 1] - CX[i]; dy = CYs[i + 1] - CYs[i]; dz = CZ[i + 1] - CZ[i];
          if (h) { lo = Math.max(0, i - h); hi = Math.min(m, i + h); c = hi - lo + 1; dx -= (CX[hi + 1] - CX[lo]) / c; dy -= (CYs[hi + 1] - CYs[lo]) / c; dz -= (CZ[hi + 1] - CZ[lo]) / c; }
          ix = Math.floor((PXs[i] - F.x0) / cell); iy = Math.floor((PYs[i] - F.y0) / cell); iz = Math.floor((PZs[i] - F.z0) / cell);
          if (ix < 0 || iy < 0 || iz < 0 || ix >= nx || iy >= ny || iz >= nz) continue;
          id = ix + nx * (iy + ny * iz); SX[id] += dx; SY[id] += dy; SZ[id] += dz; NN[id] += 1; nSmp++;
        }
        nAdd++;
      },
      finish: function () {
        var DX = new Float32Array(NV), DY = new Float32Array(NV), DZ = new Float32Array(NV), KN = new Uint8Array(NV), E1 = new Float32Array(NV), i, n;
        for (i = 0; i < NV; i++) { n = NN[i]; if (n >= minN) { DX[i] = SX[i] / n; DY[i] = SY[i] / n; DZ[i] = SZ[i] / n; KN[i] = 1; F.known++; } if (n > 0) E1[i] = SX[i] * SX[i] + SY[i] * SY[i] + SZ[i] * SZ[i]; }
        // 둘레 5칸 상자 평균(축마다 한 번씩) — E1 = |ΣD|² · N2 = n²
        var N2 = new Float32Array(NV); for (i = 0; i < NV; i++) N2[i] = NN[i] * NN[i];
        function box(A) {
          var T = new Float32Array(NV), x, y, z, k, s2, c, st, len, ax, o, lim;
          for (ax = 0; ax < 3; ax++) {
            st = ax === 0 ? 1 : ax === 1 ? nx : nx * ny; len = ax === 0 ? nx : ax === 1 ? ny : nz;
            for (o = 0; o < NV; o++) {
              c = ax === 0 ? o % nx : ax === 1 ? ((o / nx) | 0) % ny : (o / (nx * ny)) | 0; s2 = 0;
              for (k = -2; k <= 2; k++) { lim = c + k; if (lim < 0 || lim >= len) continue; s2 += A[o + k * st]; }
              T[o] = s2;
            }
            A.set(T);
          }
          return A;
        }
        box(E1); box(N2);
        var AC = new Float32Array(NV), amps = [];
        for (i = 0; i < NV; i++) if (N2[i] > 0) { AC[i] = Math.sqrt(2 * E1[i] / N2[i]); if (KN[i]) amps.push(AC[i]); }
        amps.sort(function (x, y) { return x - y; });
        F.ampU = amps.length ? amps[amps.length >> 1] : 0; F.ampHi = amps.length ? amps[Math.floor(amps.length * 0.9)] : 0;
        F.strands = nAdd; F.samples = nSmp; F.DX = DX; F.DY = DY; F.DZ = DZ; F.KN = KN; F.AC = AC;
        SX = SY = SZ = NN = null;
        return F;
      },
      /* 세 방향 선형 보간 — 모르는 칸은 0으로(가장자리에서 저절로 잦아듦) */
      at: function (px, py, pz, out) {
        var gx = (px - F.x0) / cell - 0.5, gy = (py - F.y0) / cell - 0.5, gz = (pz - F.z0) / cell - 0.5, x0 = Math.floor(gx), y0 = Math.floor(gy), z0 = Math.floor(gz), fx = gx - x0, fy = gy - y0, fz = gz - z0;
        var k, dx, dy, dz, w, id, X = 0, Y = 0, Z = 0, A = 0, K = 0, xx, yy, zz;
        for (k = 0; k < 8; k++) {
          dx = k & 1; dy = (k >> 1) & 1; dz = (k >> 2) & 1; xx = x0 + dx; yy = y0 + dy; zz = z0 + dz;
          if (xx < 0 || yy < 0 || zz < 0 || xx >= nx || yy >= ny || zz >= nz) continue;
          id = xx + nx * (yy + ny * zz); if (!F.KN[id]) continue;
          w = (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy) * (dz ? fz : 1 - fz);
          X += w * F.DX[id]; Y += w * F.DY[id]; Z += w * F.DZ[id]; A += w * F.AC[id]; K += w;
        }
        out.x = X; out.y = Y; out.z = Z; out.a = A; out.k = K; return out;
      }
    };
    return F;
  }
  G._makeWaveField = makeWaveField;
  /* 지금 사진의 굴곡 장(없으면 null) — 61번이 씀 */
  G.waveField = function () { try { return (G.model && G.src === state._hair3Dneutral && G.model.waveField) || null; } catch (e) { return null; } };
  function q(a, f) { if (!a.length) return NaN; var b = a.slice().sort(function (x, y) { return x - y; }); return b[Math.min(b.length - 1, Math.floor(b.length * f))]; }
  function n1(v) { return isFinite(v) ? (Math.round(v * 10) / 10).toFixed(1) : '?'; }

  /* (2026-10-04g) 목 기둥 밖으로 밀어내기 — 12a의 목 메쉬와 같은 치수(밑동 폭×깊이 cm ÷ 얼굴 환산자, 윗단 = 턱 + 0.12).
     목 아래(어깨·몸통)는 모양을 모르므로 같은 굵기의 기둥으로만 봅니다(어깨에 얹히는 것은 아직 아님). 47번(길이 늘리기)도 씁니다. */
  var neckMemo = null, neckAt = 0;
  function neckDims() {
    var t = now();
    if (neckMemo && t - neckAt < 1000) return neckMemo;
    neckAt = t; neckMemo = { ok: false };
    try {
      var fm = getFaceMetrics(), top = 0.15 - 0.7 * fm.heightFactor + NECK_SHAPE.topAboveChin, cm = 16.4;
      try { var r = faceRulerCmPerUnit(fm); if (r && r.x > 1) cm = r.x; } catch (e) {}
      var hw = NECK_SHAPE.baseWCm / 2 / cm, hd = NECK_SHAPE.baseDCm / 2 / cm;
      if (isFinite(top) && hw > 0.01 && hd > 0.01) neckMemo = { ok: true, top: top, hw: hw, hd: hd, back: NECK_SHAPE.napeFull || 1 };
    } catch (e) {}
    return neckMemo;
  }
  G.neckPush = function (p) {
    if (!G.neck) return p;
    var N = neckDims();
    if (!N.ok || !(p.y < N.top)) return p;
    var t = Math.min(1, (N.top - p.y) / 0.06), m = G.neckMargin * (0.7 + 0.3 * t);          // 윗단에서 턱이 지지 않게 서서히
    var hw = N.hw * m, hd = N.hd * m * (p.z < 0 ? N.back : 1);
    var e = p.x * p.x / (hw * hw) + p.z * p.z / (hd * hd);
    if (e >= 1) return p;
    if (e < 1e-6) return { x: p.x, y: p.y, z: -hd };                                        // 한가운데 — 뒤로
    var k = 1 / Math.sqrt(e);
    return { x: p.x * k, y: p.y, z: p.z * k };
  };

  /* ────────────────────────────────────────────────────────────────────────
   * 만들기
   * ────────────────────────────────────────────────────────────────────── */
  function makeBuilder(photo) {
    var probe = (photo.occ && photo.occ.probe) || (state.hairOcc3D && state.hairOcc3D.probe) || null;
    if (!probe || !probe.cams || !probe.cams.length) return { err: '점유 프로브 없음(HAIR_OCC3D가 꺼져 있거나 사진 정보가 없음)' };
    var roots = photo.roots, grid = photo.grid;
    if (!roots || !roots.ok || !grid) return { err: '뿌리밀도/격자 없음' };
    var Es = getScalpEllipsoid(), Eh = getHeadEllipsoid(), CY = photo.CY, yTop = photo.yTop;
    if (!Es || !(Es.a > 0) || !(Es.b > 0) || !(Es.c > 0)) return { err: '두피 타원체 없음' };
    var NT = roots.NT, NP = roots.NP, NC = NT * NP;
    var OFF = (typeof EST_OFFSCALP !== 'undefined') ? EST_OFFSCALP : 3;
    var bald = (typeof MANNEQUIN !== 'undefined' && MANNEQUIN.baldDen) || 0.08;
    var a2 = Es.a * Es.a, b2 = Es.b * Es.b, c2 = Es.c * Es.c;
    var yBody = CY - 0.7 * Es.b;

    // 사진별 카메라
    function lumOfCss(cs) {                                               // '#rrggbb' · 'rgb(r,g,b)' → 밝기(0~255) · 모르면 50
      try { var m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(cs || ''), r, g, b;
        if (m) { r = parseInt(m[1], 16); g = parseInt(m[2], 16); b = parseInt(m[3], 16); } else { m = /(\d+)\D+(\d+)\D+(\d+)/.exec(cs || ''); if (!m) return 50; r = +m[1]; g = +m[2]; b = +m[3]; }
        return 0.299 * r + 0.587 * g + 0.114 * b; } catch (e) { return 50; }
    }
    var cams = [];
    probe.cams.forEach(function (c) {
      var mi = state.hairMasks && state.hairMasks[c.angle];
      if (!mi || !c.smp || !(c.iw > 0) || !(c.ih > 0)) return;
      var mw = mi.maskW || mi.w, mh = mi.maskH || mi.h;
      cams.push({ angle: c.angle, R: c.R, cx: c.cx, s: c.s, sy: c.sy, crownY: c.crownY, smp: c.smp, iw: c.iw, ih: c.ih,
        ori: mi.orientation || null, mw: mw, kx: mw / mi.w, ky: mh / mi.h, tap: Math.max(2, G.tapPx * c.iw / 800),
        rgb: mi.photoRGB || null, mh: mh, hairLum: lumOfCss(mi.avgColor) });
    });
    if (!cams.length) return { err: '쓸 수 있는 사진 없음' };
    // (2026-10-10s) 직모 뼈대 — 곱슬 사진이면 결을 한 바퀴보다 넓게 평균 내어 읽음(사진의 컬을 뼈대에 복사하지 않음 · 컬은 나중에 잰 값으로 얹음)
    var straightOn = false, straightNote = [], pitchCs = [], straightWinCm = 0;
    try {
      var pcS = G.straightCurly ? G.photoCurl() : null;
      if (pcS && pcS.raw >= G.straightCurlMin) {
        straightOn = true;
        cams.forEach(function (cam) {
          var mi = state.hairMasks && state.hairMasks[cam.angle], id = mi && mi.identity, r = 0, how = '';
          var hx = id && id.curlHelix;
          if (hx && hx.P >= 6 && hx.peak >= G.helixPeak) { r = hx.P * G.straightPitchK; how = 'P'; }
          else if (id && id.curlDHalf > 0) { r = id.curlDHalf * G.straightDHalfK; how = 'd'; }
          r = clampN(r || G.straightRMinPx * 2, G.straightRMinPx, G.straightRMaxPx);
          if (hx && hx.P >= 6 && hx.peak >= G.helixPeak) { var cppS = 0; try { cppS = cmPerMaskPx(cam.angle); } catch (e2) {} if (cppS > 0) pitchCs.push(hx.P * cppS / Math.max(0.3, Math.cos((hx.beta || 0) * Math.PI / 180))); }
          if (G.straightMode === 'field') cam.sR = r; straightNote.push(cam.angle + ' ' + r.toFixed(0) + 'px' + (how ? '(' + how + ')' : ''));
        });
      }
        if (straightOn) {                                                  // 한 바퀴 간격(cm) — 사진마다 잰 값의 중앙값 · 못 쟀으면 반경 × 2π · 그것도 없으면 2.5cm
          pitchCs.sort(function (x, y) { return x - y; });
          var pc0 = pitchCs.length ? pitchCs[pitchCs.length >> 1] : (pcS.rCm > 0 ? 2 * Math.PI * pcS.rCm * 0.5 : 2.5);
          straightWinCm = clampN(pc0 * G.straightWinK, 1.5, 20);   // 가닥을 따라 잰 한 바퀴 길이(= 간격 ÷ cos 기울기)
          straightNote.push('창 ' + straightWinCm.toFixed(1) + 'cm(' + (pitchCs.length ? '잰 한 바퀴 ' + pitchCs.length + '장' : '어림') + ')');
        }
    } catch (e) { straightOn = false; }
    /* (2026-10-12j) 축과 굴곡을 따로 — 사용자: "컬과 웨이브는 걸어간 길을 따라가면 근본적으로 문제가 생겨. 걷는 순간 벗어나기 때문에"
     *  곱슬·웨이브 사진(방향 필터 선이 굽어 있음)은 결을 "그 사진에서 잰 파장 × axisK" 반경으로 고르게 한 뒤 걸음(직모 뼈대 field 방식) → 굴곡에서 벗어날 일이 없는 큰 흐름(퍼짐·어깨 앞 흐름은 남음).
     *  편 길 창 = 방향 필터 파장 중앙값(예전: 잰 한 바퀴 — 웨이브 손님 11.3cm로 퍼짐까지 지움). 굴곡은 61번이 사진 선 값 그대로 얹음(68번 옮겨심기 뒤). */
    try {
      var WSg = (G.axisGabor && W.PHOTO_CURL && typeof W.PHOTO_CURL.waveShape === 'function') ? W.PHOTO_CURL.waveShape() : null;
      if (WSg && WSg.nAll > 0 && isFinite(WSg.lamCm) && WSg.lamCm > 1) {
        straightOn = true; straightNote = ['방향 필터 축'];
        cams.forEach(function (cam) {
          var mi = state.hairMasks && state.hairMasks[cam.angle], ws = mi && mi.identity && mi.identity.waveShape, lp = ws && ws.lamPx, cpp1 = 0;
          try { cpp1 = cmPerMaskPx(cam.angle); } catch (e3) {}
          if (!(lp > 0) && cpp1 > 0) lp = WSg.lamCm / cpp1;
          var r = clampN((lp || 0) * G.axisK * (cam.iw / Math.max(1, (mi && (mi.maskW || mi.w)) || cam.iw)), G.axisRMinPx, G.axisRMaxPx);
          cam.sR = r; straightNote.push(cam.angle + ' 반경 ' + r.toFixed(0) + 'px');
        });
        straightWinCm = clampN(WSg.lamCm * G.axisWinK, 1.5, 12);
        straightNote.push('창 ' + straightWinCm.toFixed(1) + 'cm(방향 필터 파장)');
      }
    } catch (e) {}
    var nStraight = 0, straightShrink = [];
    var WFb = null;                                                       // (2026-10-12e) 읽은 굴곡 장 — 편 가닥이 있을 때만
    if (straightOn && straightWinCm > 0 && G.waveField !== false && G.waveCellCm > 0) {
      try { var cmW = 18.6; try { cmW = modelCmPerUnit() || cmW; } catch (e3) {} var hw = Math.max(Eh.a, Eh.c) * 2.3;
        WFb = makeWaveField(G.waveCellCm / cmW, { x0: -hw, x1: hw, z0: -hw, z1: hw, y0: yTop - 62 / cmW, y1: yTop + 3 / cmW }, straightWinCm / cmW); } catch (e) { WFb = null; }
    }
    /* 걸어 간 길(사진 컬을 따라 구불구불)을 한 바퀴 창으로 평균 → 나선의 축 = 직모 뼈대. 뿌리는 그대로 · 창은 뿌리·끝에서 줄어듦 · 두피 속으로 들어간 점은 두피면으로 */
    function straightenPath(pts, Wu) {
      var n = pts.length, i, S = [0];
      if (n < 4 || !(Wu > 0)) return pts;
      for (i = 1; i < n; i++) S.push(S[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y, pts[i].z - pts[i - 1].z));
      var L = S[n - 1]; if (!(L > Wu * 0.5)) return pts;
      var ds = Math.min(Wu / 10, L / (n - 1)), m = Math.max(4, Math.ceil(L / ds) + 1), R = new Array(m), j = 0, t, u;
      for (i = 0; i < m; i++) {                                             // 호길이로 고르게 다시 찍음
        t = Math.min(L, i * ds); while (j < n - 2 && S[j + 1] < t) j++;
        u = (t - S[j]) / Math.max(1e-12, S[j + 1] - S[j]);
        R[i] = { x: pts[j].x + (pts[j + 1].x - pts[j].x) * u, y: pts[j].y + (pts[j + 1].y - pts[j].y) * u, z: pts[j].z + (pts[j + 1].z - pts[j].z) * u };
      }
      var P = new Float64Array(3 * (m + 1)); for (i = 0; i < m; i++) { P[3 * i + 3] = P[3 * i] + R[i].x; P[3 * i + 4] = P[3 * i + 1] + R[i].y; P[3 * i + 5] = P[3 * i + 2] + R[i].z; }
      var out = [R[0]], h = Math.max(1, Math.round(Wu / 2 / ds)), k, a, b, c, q, e;
      for (i = 1; i < m; i++) {
        k = Math.min(h, i, m - 1 - i); if (k < 1) { out.push(R[i]); continue; }
        a = i - k; b = i + k + 1; c = b - a;
        q = { x: (P[3 * b] - P[3 * a]) / c, y: (P[3 * b + 1] - P[3 * a + 1]) / c, z: (P[3 * b + 2] - P[3 * a + 2]) / c };
        e = q.x * q.x / a2 + (q.y - CY) * (q.y - CY) / b2 + q.z * q.z / c2;
        if (e < 1) { var kk = 1 / Math.sqrt(Math.max(1e-9, e)); q = { x: q.x * kk, y: CY + (q.y - CY) * kk, z: q.z * kk }; }
        out.push(q);
      }
      var o2 = [out[0]], st0 = L / (n - 1), acc = 0;                       // 원래 걸음 간격쯤으로 솎음
      for (i = 1; i < out.length; i++) { acc += Math.hypot(out[i].x - out[i - 1].x, out[i].y - out[i - 1].y, out[i].z - out[i - 1].z); if (acc >= st0 * 0.999 || i === out.length - 1) { o2.push(out[i]); acc = 0; } }
      return o2.length >= 3 ? o2 : pts;
    }
    var SOFF = []; (function () { var k; SOFF.push([0, 0, 1]); for (k = 0; k < 8; k++) { var a = k * Math.PI / 4; SOFF.push([Math.cos(a), Math.sin(a), 0.8]); SOFF.push([0.5 * Math.cos(a + Math.PI / 8), 0.5 * Math.sin(a + Math.PI / 8), 0.9]); } })();
    function sampleOriRaw(cam, ix, iy) {
      var cx = 0, cy = 0, ws = 0, cs = 0, k, q, sm, w, x, y;
      for (k = 0; k < SOFF.length; k++) {
        q = SOFF[k]; x = ix + q[0] * cam.sR; y = iy + q[1] * cam.sR;
        if (x < 0 || y < 0 || x >= cam.iw || y >= cam.ih) continue;
        if (k && !(cam.smp.at(x, y) > 0)) continue;
        sm = sampleOrientation(cam.ori, x * cam.kx, cam.mw, y * cam.ky);
        if (!sm || !(sm.coherence > 0)) continue;
        w = q[2] * sm.coherence; cx += w * Math.cos(2 * sm.angle); cy += w * Math.sin(2 * sm.angle); ws += w; cs += q[2];
      }
      if (!(ws > 0)) return null;
      var R2 = Math.hypot(cx, cy) / ws;                       // 둘레 결이 한쪽으로 모이는 정도(0~1)
      return { angle: 0.5 * Math.atan2(cy, cx), coherence: (ws / cs) * R2 };
    }
    /* (2026-10-12l) 고른 결을 미리 한 번 계산해 둠 — 걸음마다 17자리를 읽던 것(기르기 18~35초) → 칸(반경 ÷ sGridK)마다 한 번 읽어 두고 걸음은 둘레 4칸을 섞기만 */
    function smoothGrid(cam) {
      var g = Math.max(2, cam.sR / (G.sGridK || 4)), gw = Math.ceil(cam.iw / g) + 1, gh = Math.ceil(cam.ih / g) + 1, N = gw * gh;
      var X = new Float32Array(N), Y = new Float32Array(N), C = new Float32Array(N), ok = new Uint8Array(N), i, j, k, r;
      for (j = 0; j < gh; j++) for (i = 0; i < gw; i++) {
        k = j * gw + i; if (!(cam.smp.at(i * g, j * g) > 0) && !(cam.smp.at(Math.min(cam.iw - 1, i * g + g / 2), Math.min(cam.ih - 1, j * g + g / 2)) > 0)) continue;
        r = sampleOriRaw(cam, i * g, j * g); if (!r) continue;
        ok[k] = 1; C[k] = r.coherence; X[k] = Math.cos(2 * r.angle) * r.coherence; Y[k] = Math.sin(2 * r.angle) * r.coherence;
      }
      return { g: g, gw: gw, gh: gh, X: X, Y: Y, C: C, ok: ok };
    }
    function sampleOri(cam, ix, iy) {
      if (!cam.sR) return sampleOrientation(cam.ori, ix * cam.kx, cam.mw, iy * cam.ky);
      if (G.sGrid === false) return sampleOriRaw(cam, ix, iy);
      var SG = cam.sG || (cam.sG = smoothGrid(cam)), fx = ix / SG.g, fy = iy / SG.g, i0 = Math.floor(fx), j0 = Math.floor(fy), u = fx - i0, v = fy - j0;
      if (i0 < 0 || j0 < 0 || i0 >= SG.gw - 1 || j0 >= SG.gh - 1) return null;
      var k = j0 * SG.gw + i0, ks = [k, k + 1, k + SG.gw, k + SG.gw + 1], ws4 = [(1 - u) * (1 - v), u * (1 - v), (1 - u) * v, u * v], x = 0, y = 0, c = 0, w = 0, t;
      for (t = 0; t < 4; t++) { var q = ks[t]; if (!SG.ok[q]) continue; x += ws4[t] * SG.X[q]; y += ws4[t] * SG.Y[q]; c += ws4[t] * SG.C[q]; w += ws4[t]; }
      if (!(w > 0.25)) return null;
      return { angle: 0.5 * Math.atan2(y, x), coherence: c / w };
    }

    // 난수(결정적)
    var seed = G.seed >>> 0;
    function rnd() { seed = (seed + 0x6D2B79F5) >>> 0; var t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }

    function onSurf(p) {     // 중심에서 본 방향 그대로 두피 타원체 면으로
      var x = p.x, y = p.y - CY, z = p.z, k = 1 / Math.sqrt(Math.max(1e-12, x * x / a2 + y * y / b2 + z * z / c2));
      return { x: x * k, y: CY + y * k, z: z * k };
    }
    function normalAt(p) {
      var x = p.x / a2, y = (p.y - CY) / b2, z = p.z / c2, l = Math.hypot(x, y, z) || 1;
      return { x: x / l, y: y / l, z: z / l };
    }
    function cellOf(p) {     // 두피 격자 칸(행=극각, 열=방위)
      var cy = Math.max(-1, Math.min(1, (p.y - CY) / Es.b)), ph = Math.acos(cy), th = Math.atan2(p.x / Es.a, p.z / Es.c);
      var r = Math.max(0, Math.min(NP - 1, Math.floor(ph / Math.PI * NP)));
      var c = Math.floor((th + Math.PI) / (2 * Math.PI) * NT); c = ((c % NT) + NT) % NT;
      return r * NT + c;
    }
    function offScalp(i) { return !!(roots.est && roots.est[i] === OFF); }

    var pj = { ix: 0, iy: 0, z: 0 };
    function proj(cam, p) {
      var R = cam.R, x = p.x, y = p.y - CY, z = p.z;
      pj.ix = (R[0] * x + R[1] * y + R[2] * z) / cam.s + cam.cx;
      pj.iy = cam.crownY + (yTop - ((R[3] * x + R[4] * y + R[5] * z) + CY)) / cam.sy;
      pj.z = R[6] * x + R[7] * y + R[8] * z;
      return pj;
    }
    function hairAt(cam, ix, iy) {
      var t = cam.tap, s = cam.smp;
      return s.at(ix, iy) > 0 || s.at(ix - t, iy) > 0 || s.at(ix + t, iy) > 0 || s.at(ix, iy - t) > 0 || s.at(ix, iy + t) > 0;
    }
    function behindSkull(cam, p) {   // p에서 카메라 쪽으로 가는 길이 두개골에 막히는가
      var R = cam.R, dx = R[6], dy = R[7], dz = R[8], x = p.x, y = p.y - CY, z = p.z;
      var A = dx * dx / a2 + dy * dy / b2 + dz * dz / c2, B = 2 * (x * dx / a2 + y * dy / b2 + z * dz / c2), C = x * x / a2 + y * y / b2 + z * z / c2 - 0.96;
      var D = B * B - 4 * A * C;
      if (D <= 0) return false;
      return (-B + Math.sqrt(D)) / (2 * A) > 1e-4;
    }
    /* (2026-10-24) 사진끼리 머리 영역 맞추기(G.photoAlign) — 각도(R)는 그대로, cx·crownY만 옮김. 위 머리말 참고 */
    var paStat = { on: !!G.photoAlign, before: null, after: null, moved: [], ms: 0, why: '' };
    (function () {
      if (!G.photoAlign) { paStat.why = '꺼짐'; return; }
      if (cams.length < 2) { paStat.why = '사진 ' + cams.length + '장'; return; }
      var t0p = now(), cmP = 18.6; try { cmP = modelCmPerUnit() || cmP; } catch (e) {}
      var N = Math.max(2000, G.photoAlignN | 0), PX = new Float64Array(N), PY = new Float64Array(N), PZ = new Float64Array(N), seed = 12345, i, k;
      function rr() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
      var x0 = -2.4 * Es.a, x1 = 2.4 * Es.a, z0 = -2.4 * Es.c, z1 = 2.4 * Es.c, y1 = CY + 1.4 * Es.b, y0 = Math.min(CY - 1.2 * Es.b, yTop - 75 / cmP);
      for (i = 0; i < N; i++) { PX[i] = x0 + (x1 - x0) * rr(); PY[i] = y0 + (y1 - y0) * rr(); PZ[i] = z0 + (z1 - z0) * rr(); }
      var GR = cams.map(function (cam) {                                     // 사진마다 머리 영역 칸 지도
        var gw = Math.max(40, G.photoAlignCols | 0), cell = cam.iw / gw, gh = Math.max(1, Math.ceil(cam.ih / cell)), M = new Uint8Array(gw * gh), n = 0, x, y;
        for (y = 0; y < gh; y++) for (x = 0; x < gw; x++) if (cam.smp.at((x + 0.5) * cell, (y + 0.5) * cell) > 0) { M[y * gw + x] = 1; n++; }
        return { gw: gw, gh: gh, cell: cell, M: M, n: n, gx: new Int32Array(N), cov: new Uint8Array(gw * gh) };
      });
      function place(ci) {                                                   // 점마다 이 사진에서의 칸(-1 = 사진 밖)
        var cam = cams[ci], g = GR[ci], R = cam.R, j, x, y, z, ix, iy, a, b;
        for (j = 0; j < N; j++) {
          x = PX[j]; y = PY[j] - CY; z = PZ[j];
          ix = (R[0] * x + R[1] * y + R[2] * z) / cam.s + cam.cx; iy = cam.crownY + (yTop - ((R[3] * x + R[4] * y + R[5] * z) + CY)) / cam.sy;
          a = Math.floor(ix / g.cell); b = Math.floor(iy / g.cell);
          g.gx[j] = (a < 0 || b < 0 || a >= g.gw || b >= g.gh) ? -1 : b * g.gw + a;
        }
      }
      function score() {                                                     // 사진 평균 "다른 사진 포함 덩어리가 설명하는 비율"
        var j, c, g, tot = 0, cnt = 0;
        GR.forEach(function (g2) { g2.cov.fill(0); });
        for (j = 0; j < N; j++) {
          var inAll = true;
          for (c = 0; c < GR.length; c++) { var q2 = GR[c].gx[j]; if (q2 < 0 || !GR[c].M[q2]) { inAll = false; break; } }
          if (!inAll) continue;
          for (c = 0; c < GR.length; c++) GR[c].cov[GR[c].gx[j]] = 1;
        }
        for (c = 0; c < GR.length; c++) {
          g = GR[c]; if (!g.n) continue; var hit = 0, x, y, q3;
          for (y = 0; y < g.gh; y++) for (x = 0; x < g.gw; x++) {
            q3 = y * g.gw + x; if (!g.M[q3]) continue;
            var ok = false, dx, dy;
            for (dy = -1; dy <= 1 && !ok; dy++) for (dx = -1; dx <= 1; dx++) { var xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < g.gw && yy < g.gh && g.cov[yy * g.gw + xx]) { ok = true; break; } }
            if (ok) hit++;
          }
          tot += hit / g.n; cnt++;
        }
        return cnt ? tot / cnt : 0;
      }
      for (i = 0; i < cams.length; i++) place(i);
      var base = score(); paStat.before = base;
      var refI = -1; for (i = 0; i < cams.length; i++) if (cams[i].angle === 'front') refI = i;
      if (refI < 0) for (i = 0; i < cams.length; i++) if (cams[i].angle === 'back') refI = i;
      paStat.ref = refI >= 0 ? cams[refI].angle : '-';
      var maxC = Math.max(0, +G.photoAlignMaxCm || 0);
      for (i = 0; i < cams.length; i++) {
        if (i === refI) continue;
        var cam = cams[i], pxPerCm = 1 / Math.max(1e-9, cam.s * cmP), cx0 = cam.cx, cy0 = cam.crownY, best = { v: base, dx: 0, dy: 0 };
        cam._cx0 = cx0; cam._cy0 = cy0;
        var tryAt = function (dxc, dyc) {
          if (Math.abs(dxc) > maxC + 1e-9 || Math.abs(dyc) > maxC + 1e-9) return;
          cam.cx = cx0 + dxc * pxPerCm; cam.crownY = cy0 + dyc * pxPerCm; place(i);
          var v = score(); if (v > best.v + 1e-6) best = { v: v, dx: dxc, dy: dyc };
        };
        var stp1 = Math.max(0.5, maxC / 2), a1, b1;
        for (a1 = -maxC; a1 <= maxC + 1e-9; a1 += stp1) for (b1 = -maxC; b1 <= maxC + 1e-9; b1 += stp1) if (a1 || b1) tryAt(a1, b1);
        var cx1 = best.dx, cy1 = best.dy;
        for (a1 = -0.5; a1 <= 0.5; a1 += 0.5) for (b1 = -0.5; b1 <= 0.5; b1 += 0.5) if (a1 || b1) tryAt(cx1 + a1, cy1 + b1);
        if (best.v - base >= (G.photoAlignMinGain || 0)) { cam.cx = cx0 + best.dx * pxPerCm; cam.crownY = cy0 + best.dy * pxPerCm; base = best.v; paStat.moved.push(cam.angle + ' 가로 ' + (best.dx >= 0 ? '+' : '') + best.dx.toFixed(1) + ' · 세로 ' + (best.dy >= 0 ? '+' : '') + best.dy.toFixed(1) + 'cm'); }
        else { cam.cx = cx0; cam.crownY = cy0; }
        place(i);
      }
      paStat.after = base; paStat.ms = Math.round(now() - t0p);
      // (2026-10-24c) 옮긴 양을 남김 — 07b 사진 대조(PHOTO_CHECK)·디버그 내보내기가 같은 사진 값으로 비추게(안 그러면 옮긴 만큼 어긋나 보임)
      try { var sh = {}; cams.forEach(function (c2, i2) { if (c2._cx0 != null) sh[c2.angle] = { cx: c2.cx - c2._cx0, crownY: c2.crownY - c2._cy0 }; }); G.camShift = { photo: photo, by: sh }; } catch (e) {}
    })();
    /* 이 점이 사진들에서 머리 영역인가. 1 = 머리 · 0 = 아님 · -1 = 어느 사진도 판정 못 함 */
    /* (2026-10-11a) 믿을 수 있는 사진의 "머리 영역에서 떨어진 거리"(사진 px) — 거리 지도(체스판 거리 · 3px 칸) */
    var hullN = 0, triN = 0;
    cams.forEach(function (cam) {
      if (!(G.hullViews && G.hullViews.indexOf(cam.angle) >= 0)) return;
      try {
        var cp = Math.max(1, G.hullCellPx * cam.iw / 800), gw = Math.ceil(cam.iw / cp), gh = Math.ceil(cam.ih / cp), D = new Float32Array(gw * gh), x, y, i;
        for (y = 0; y < gh; y++) for (x = 0; x < gw; x++) D[y * gw + x] = cam.smp.at((x + 0.5) * cp, (y + 0.5) * cp) > 0 ? 0 : 1e9;
        for (y = 0; y < gh; y++) for (x = 0; x < gw; x++) { i = y * gw + x; if (x) D[i] = Math.min(D[i], D[i - 1] + 1); if (y) { D[i] = Math.min(D[i], D[i - gw] + 1); if (x) D[i] = Math.min(D[i], D[i - gw - 1] + 1.414); if (x < gw - 1) D[i] = Math.min(D[i], D[i - gw + 1] + 1.414); } }
        for (y = gh - 1; y >= 0; y--) for (x = gw - 1; x >= 0; x--) { i = y * gw + x; if (x < gw - 1) D[i] = Math.min(D[i], D[i + 1] + 1); if (y < gh - 1) { D[i] = Math.min(D[i], D[i + gw] + 1); if (x < gw - 1) D[i] = Math.min(D[i], D[i + gw + 1] + 1.414); if (x) D[i] = Math.min(D[i], D[i + gw - 1] + 1.414); } }
        var cmPx = cam.s * ((typeof modelCmPerUnit === 'function' && modelCmPerUnit()) || 16.4);   // 사진 1px이 몇 cm
        cam.hull = { D: D, gw: gw, gh: gh, cp: cp, lim: (cam.angle === 'front' ? G.hullMarginCm : G.hullMarginSideCm) / Math.max(1e-6, cmPx * cp) };
      } catch (e) { cam.hull = null; }
    });
    function hullOut(cam, ix, iy) { var h = cam.hull; if (!h) return false; var gx = Math.floor(ix / h.cp), gy = Math.floor(iy / h.cp); if (gx < 0 || gy < 0 || gx >= h.gw || gy >= h.gh) return true; return h.D[gy * h.gw + gx] > h.lim; }
    function voteRaw(p) {
      var yes = 0, no = 0, i, cam, o, bf = -2, bOut = false, farNo = 0, frontOut = false;
      var frx = p.x / Es.a, fry = (p.y - CY) / Es.b, frz = p.z / Es.c, frl = Math.sqrt(frx * frx + fry * fry + frz * frz) || 1;   // 이 자리의 바깥 방향(두피 타원 기준)
      for (i = 0; i < cams.length; i++) {
        cam = cams[i]; o = proj(cam, p);
        if (o.ix < 0 || o.iy < 0 || o.ix >= cam.iw || o.iy >= cam.ih) continue;
        if (o.z < 0) {                               // 카메라 반대편
          if (p.y < yBody) continue;                 // 목·어깨에 가려졌을 수 있음(몸은 모델에 없음)
          if (behindSkull(cam, p)) continue;         // 두개골에 가림
        }
        var isHair = hairAt(cam, o.ix, o.iy);
        if (isHair) yes++; else { no++; if (cam.hull && hullOut(cam, o.ix, o.iy)) { farNo++; if (cam.angle === 'front') frontOut = true; } }
        if (cam.hull) {
          if (G.hullFacing) { var fc = (cam.R[6] * frx + cam.R[7] * fry + cam.R[8] * frz) / frl; if (fc > bf) { bf = fc; bOut = !isHair && hullOut(cam, o.ix, o.iy); } }
          else if (!isHair && o.z >= 0 && hullOut(cam, o.ix, o.iy)) { hullN++; return 0; }
        }
      }
      if (G.hullRule === 'front') { if (yes + no === 0) return -1; if (frontOut) { hullN++; return 0; } return yes >= no ? 1 : 0; }   // (2026-10-11h) 다수결 + 정면 참고(정면이 1cm 넘게 밖이면 머리 아님)
      if (G.hullRule === 'tol') { if (yes + no === 0) return -1; if (farNo) { hullN++; return 0; } return yes > 0 ? 1 : 0; }   // (2026-10-11g) 여유 둔 교집합
      if (bOut) { hullN++; return 0; }                                      // 마주 보는 사진이 "밖"
      return yes + no === 0 ? -1 : (yes >= no ? 1 : 0);
    }

    /* (2026-10-11d) 3D 머리 덩어리 — vote()를 칸 중심마다 한 번 구해 둠 */
    var VOL = null;
    (function () {
      if (!G.volume) return;
      try {
        var t0v = now(), cmV = (typeof modelCmPerUnit === 'function' && modelCmPerUnit()) || 16.4, h = G.volCellCm / cmV;
        var x0 = -2.4 * Es.a, x1 = 2.4 * Es.a, z0 = -2.4 * Es.c, z1 = 2.4 * Es.c, y1 = CY + 1.4 * Es.b, y0 = Math.min(CY - 1.2 * Es.b, yTop - 75 / cmV);
        var nx = Math.ceil((x1 - x0) / h), ny = Math.ceil((y1 - y0) / h), nz = Math.ceil((z1 - z0) / h), A = new Int8Array(nx * ny * nz), i, j, k, idx = 0, inN = 0;
        for (j = 0; j < ny; j++) for (k = 0; k < nz; k++) for (i = 0; i < nx; i++) {
          var v = voteRaw({ x: x0 + (i + 0.5) * h, y: y0 + (j + 0.5) * h, z: z0 + (k + 0.5) * h });
          A[(j * nz + k) * nx + i] = v; if (v === 1) inN++;
        }
        VOL = { A: A, nx: nx, ny: ny, nz: nz, x0: x0, y0: y0, z0: z0, h: h, inN: inN, ms: Math.round(now() - t0v),
          at: function (p) { var a = Math.floor((p.x - this.x0) / this.h), b = Math.floor((p.y - this.y0) / this.h), c = Math.floor((p.z - this.z0) / this.h); if (a < 0 || b < 0 || c < 0 || a >= this.nx || b >= this.ny || c >= this.nz) return -2; return this.A[(b * this.nz + c) * this.nx + a]; } };
        G.vol = VOL; hullN = 0;
        // (2026-10-11i) 좁은 덩어리(여유 둔 교집합) — 마네킹 위 컬이 바깥으로 부푼 점을 당겨 넣는 경계로만 씀(61번). 걷기는 위의 덩어리(다수결 + 정면)
        var needTight = true; try { var pcT = G.photoCurl(); needTight = !!(pcT && Math.max(pcT.value || 0, pcT.raw || 0) >= (G.volTightMinCurl || 0)); } catch (eT) { needTight = true; }   // (2026-10-12a) 좁은 덩어리는 마네킹 위 컬(61번)만 씀 — 컬이 없는 손님은 안 만듦(폰에서 덩어리 시간 절반)
        G.volT = null;
        if (G.volTight && needTight) {
          var rule0 = G.hullRule, AT = new Int8Array(nx * ny * nz), tN = 0; G.hullRule = 'tol';
          try { for (j = 0; j < ny; j++) for (k = 0; k < nz; k++) for (i = 0; i < nx; i++) { var vt = voteRaw({ x: x0 + (i + 0.5) * h, y: y0 + (j + 0.5) * h, z: z0 + (k + 0.5) * h }); AT[(j * nz + k) * nx + i] = vt; if (vt === 1) tN++; } } finally { G.hullRule = rule0; }
          G.volT = { A: AT, nx: nx, ny: ny, nz: nz, x0: x0, y0: y0, z0: z0, h: h, inN: tN, at: VOL.at };
          VOL.tightN = tN; VOL.ms = Math.round(now() - t0v); hullN = 0;
        }
      } catch (e) { VOL = null; }
    })();
    function vote(p) { if (VOL) { var v = VOL.at(p); if (v !== -2) { if (v === 0) hullN++; return v; } } return voteRaw(p); }

    /* 두께 재기 전용 — 그 자리를 "옆에서"(윤곽선으로) 보는 사진만 묻는다.
       정면으로 보는 사진은 깊이를 못 재서 항상 "머리"라고 답하고, 비스듬히 보는 사진은 늦게 알아챈다
       (법선과 카메라 축이 이루는 각이 90°에서 벗어난 만큼 두께를 크게 잰다). 1 머리 · 0 아님 · -1 물어볼 사진 없음 */
    function voteOutline(p, n) {
      var yes = 0, i, cam, o, R, ncz;
      for (i = 0; i < cams.length; i++) {
        cam = cams[i]; R = cam.R;
        ncz = R[6] * n.x + R[7] * n.y + R[8] * n.z;
        if (Math.abs(ncz) > G.outlineCos) continue;
        o = proj(cam, p);
        if (o.ix < 0 || o.iy < 0 || o.ix >= cam.iw || o.iy >= cam.ih) continue;
        if (o.z < 0) { if (p.y < yBody) continue; if (behindSkull(cam, p)) continue; }
        if (hairAt(cam, o.ix, o.iy)) yes++; else return 0;
      }
      return yes ? 1 : -1;
    }

    /* 그 자리의 결 방향을 사진들에서 직접 읽어 3D 접선 방향으로. ref가 있으면 그쪽 부호로 맞춤 */
    var TRF = null;   // 걸음 기록: flow()가 이번에 쓴 사진들
    var flowNC = 0;   // (13l) flow()가 이번 걸음에 결을 읽은 사진 수
    var glossN = 0, glossKeep = 0;   // 광택 띠라 안 읽은 결 표본 수
    var agreeN = 0, agreeDrop = 0, agreeSkip = 0;   // (2026-10-20) 두 장 이상 읽은 걸음 · 엇갈려 뺀 사진 · 갈피를 못 잡아 관성으로 넘긴 걸음
    var lastUse = [];   // (2026-10-24) flow()가 이번에 쓴 사진(번호) — RK 걸음 안 다시 보기에서 같은 사진만 씀
    var rkN = 0, rkSub = 0, rkMiss = 0, rkSkip = 0;
    var polW = 0;     // (2026-10-10d) 이번 걸음의 내리막 무게(두피 위 · 뒤집힌 뿌리 아님일 때만 G.polDown)
    function flow(p, n, ref, flat) {
      flowNC = 0;
      if (TRF) { TRF.nc = 0; TRF.best = -1; TRF.bw = 0; TRF.coh = 0; TRF.spr = 0; TRF.dirs = []; }
      var ax = 0, ay = 0, az = 0, wsum = 0, i, cam, o, R, ncx, ncy, ncz, sm, pol, dX, dY, dZ, mx, my, mz, l, w, dot;
      var TM = [0, 0, 0, 0, 0, 0, 0], TV = [], VD = [];   // VD: 사진마다 [x,y,z,무게,사진 번호,결 또렷함]
      for (i = 0; i < cams.length; i++) {
        cam = cams[i]; if (!cam.ori) continue;
        R = cam.R;
        ncz = R[6] * n.x + R[7] * n.y + R[8] * n.z;
        var lowF = ncz < G.minFacing; if (lowF && !(flat && G.tri3D)) continue;
        o = proj(cam, p);
        if (o.ix < 0 || o.iy < 0 || o.ix >= cam.iw || o.iy >= cam.ih) continue;
        if (!(cam.smp.at(o.ix, o.iy) > 0)) continue;
        if (lowF && o.z < 0 && behindSkull(cam, p)) continue;
        sm = sampleOri(cam, o.ix, o.iy);
        if (!sm || !(sm.coherence >= G.minCoh)) continue;
        if (!cam.sR && G.glossSkip && cam.rgb && Math.abs(Math.sin(sm.angle)) < G.glossFlat) {   // (2026-10-10f) 광택 띠의 수평 결은 안 읽음
          var gx = Math.floor(o.ix * cam.kx), gy = Math.floor(o.iy * cam.ky);
          if (gx >= 0 && gy >= 0 && gx < cam.mw && gy < cam.mh) {
            var gi = (gy * cam.mw + gx) * 3, lu = 0.299 * cam.rgb[gi] + 0.587 * cam.rgb[gi + 1] + 0.114 * cam.rgb[gi + 2], gl = (lu - cam.hairLum) / Math.max(20, 255 - cam.hairLum);
            if (gl >= G.glossLo) {
              // (2026-10-10i) 둘레(위·아래·옆 glossNbr px)의 결과 같으면 진짜 결(넘겨 세운 앞머리처럼 옆으로 누운 밝은 머리) — 안 버림
              var agree = 0, seenN = 0, dn, nxp, nyp, smn;
              for (dn = 0; G.glossNbrKeep !== false && dn < 4; dn++) {
                nxp = o.ix + (dn === 0 ? G.glossNbr : dn === 1 ? -G.glossNbr : 0) / cam.kx; nyp = o.iy + (dn === 2 ? G.glossNbr : dn === 3 ? -G.glossNbr : 0) / cam.ky;
                var gx2 = Math.floor(nxp * cam.kx), gy2 = Math.floor(nyp * cam.ky); if (gx2 < 0 || gy2 < 0 || gx2 >= cam.mw || gy2 >= cam.mh) continue;
                var gi2 = (gy2 * cam.mw + gx2) * 3, lu2 = 0.299 * cam.rgb[gi2] + 0.587 * cam.rgb[gi2 + 1] + 0.114 * cam.rgb[gi2 + 2];
                if ((lu2 - cam.hairLum) / Math.max(20, 255 - cam.hairLum) >= G.glossLo) continue;   // 둘레도 밝으면 판단 안 함
                smn = sampleOrientation(cam.ori, nxp * cam.kx, cam.mw, nyp * cam.ky); if (!smn || !(smn.coherence >= G.minCoh)) continue;
                seenN++; var dd2 = Math.abs(((smn.angle - sm.angle) % Math.PI + Math.PI) % Math.PI); if (dd2 > Math.PI / 2) dd2 = Math.PI - dd2; if (dd2 < 0.52) agree++;
              }
              if (!(seenN >= 2 && agree * 2 >= seenN)) { glossN++; continue; }
              glossKeep++;
            }
          }
        }
        ncx = R[0] * n.x + R[1] * n.y + R[2] * n.z; ncy = R[3] * n.x + R[4] * n.y + R[5] * n.z;
        dX = Math.cos(sm.angle) * cam.s; dY = -Math.sin(sm.angle) * cam.sy;
        dZ = -(dX * ncx + dY * ncy) / ncz;
        l = Math.hypot(dX, dY);
        if (flat && G.tri3D) {                                               // (2026-10-11a) 사진마다 "이 방향을 품는 평면"(시선축 + 사진 결) — 여러 장이면 평면들의 교선 = 3D 방향
          var tax = R[0] * dX + R[3] * dY, tay = R[1] * dX + R[4] * dY, taz = R[2] * dX + R[5] * dY;
          var tmx = tay * R[8] - taz * R[7], tmy = taz * R[6] - tax * R[8], tmz = tax * R[7] - tay * R[6], tml = Math.sqrt(tmx * tmx + tmy * tmy + tmz * tmz);
          if (tml > 1e-9) { tmx /= tml; tmy /= tml; tmz /= tml; var tw = sm.coherence; TM[0] += tw * tmx * tmx; TM[1] += tw * tmx * tmy; TM[2] += tw * tmx * tmz; TM[3] += tw * tmy * tmy; TM[4] += tw * tmy * tmz; TM[5] += tw * tmz * tmz; TM[6] += tw; TV.push(R[6], R[7], R[8]); }
        }
        if (lowF) continue;
        var zl = (flat && G.backFix) ? G.freeDepth : 3;                                     // 스치는 각에서 깊이가 터지는 것 막음(두피 밖은 더 좁게)
        if (Math.abs(dZ) > zl * l) dZ = (dZ < 0 ? -zl : zl) * l;
        mx = R[0] * dX + R[3] * dY + R[6] * dZ; my = R[1] * dX + R[4] * dY + R[7] * dZ; mz = R[2] * dX + R[5] * dY + R[8] * dZ;
        l = Math.hypot(mx, my, mz); if (!(l > 1e-12)) continue;
        mx /= l; my /= l; mz /= l;
        if (ref) {
          dot = mx * ref.x + my * ref.y + mz * ref.z;
          if (polW > 0) {                                                   // (2026-10-10f) 오르막에만 벌점 — 내리막 = 아래(0,-1,0)를 이 자리 두피면에 놓은 방향(정수리처럼 평평한 곳은 짧아져 저절로 약해짐)
            var kd = -n.y, ddx = -kd * n.x, ddy = -1 - kd * n.y, ddz = -kd * n.z, b = mx * ddx + my * ddy + mz * ddz;
            var ddl = Math.sqrt(ddx * ddx + ddy * ddy + ddz * ddz), sl = G.polSlopeHi > G.polSlopeLo ? Math.max(0, Math.min(1, (ddl - G.polSlopeLo) / Math.max(1e-6, G.polSlopeHi - G.polSlopeLo))) : 1;   // (2026-10-10i) 완만한 곳(정수리·가마)은 벌점을 풂
            // 두 쪽 점수: 이 쪽 = dot + polW·min(0, b) · 반대쪽 = −dot + polW·min(0, −b). 옆으로 흐르는 결(b≈0 · 가마·가르마)은 그대로, 비탈에서 거꾸로 오르는 쪽만 막음
            var pw = polW * sl * sl * (3 - 2 * sl);
            dot = (dot + pw * Math.min(0, b)) - (-dot + pw * Math.min(0, -b));
          }
        }
        else if (wsum > 0) dot = mx * ax + my * ay + mz * az;
        else { pol = 0; try { pol = flowPolarityFor(sm.angle, sm); } catch (e) {} dot = pol < 0 ? -1 : 1; }
        if (dot < 0) { mx = -mx; my = -my; mz = -mz; }
        w = ncz * ncz * sm.coherence;
        flowNC++;
        VD.push(mx, my, mz, w, i, sm.coherence);
        ax += w * mx; ay += w * my; az += w * mz; wsum += w;
      }
      if (G.agree && VD.length >= 12) {                                     // (2026-10-20) 두 장 이상 — 서로 맞는지 봄
        agreeN++;
        var bI = 0, k2, cosT = Math.cos((G.agreeDeg || 30) / 57.2958), amb = false, drop = 0;
        for (k2 = 6; k2 < VD.length; k2 += 6) if (VD[k2 + 3] > VD[bI + 3]) bI = k2;
        for (k2 = 0; k2 < VD.length; k2 += 6) {
          if (k2 === bI) continue;
          var cb = VD[k2] * VD[bI] + VD[k2 + 1] * VD[bI + 1] + VD[k2 + 2] * VD[bI + 2];
          if (cb >= cosT) continue;
          if (VD[k2 + 3] * (G.agreeRatio || 1.5) >= VD[bI + 3]) amb = true;   // 엇갈린 쪽도 거의 그만큼 믿을 만함
          VD[k2 + 3] = 0; drop++;
        }
        if (amb && G.agreeAmbig === 'skip') { agreeSkip++; flowNC = 0; if (TRF) TRF.nc = 0; return null; }
        if (drop) { agreeDrop += drop; ax = 0; ay = 0; az = 0; wsum = 0; flowNC = 0; for (k2 = 0; k2 < VD.length; k2 += 6) if (VD[k2 + 3] > 0) { ax += VD[k2 + 3] * VD[k2]; ay += VD[k2 + 3] * VD[k2 + 1]; az += VD[k2 + 3] * VD[k2 + 2]; wsum += VD[k2 + 3]; flowNC++; } }
      }
      lastUse.length = 0; for (var k4 = 0; k4 < VD.length; k4 += 6) if (VD[k4 + 3] > 0) lastUse.push(VD[k4 + 4]);
      if (TRF) for (var k3 = 0; k3 < VD.length; k3 += 6) if (VD[k3 + 3] > 0) { TRF.nc++; if (VD[k3 + 3] > TRF.bw) { TRF.bw = VD[k3 + 3]; TRF.best = VD[k3 + 4]; TRF.coh = VD[k3 + 5]; } TRF.dirs.push(VD[k3], VD[k3 + 1], VD[k3 + 2], VD[k3 + 3]); }
      l = Math.hypot(ax, ay, az);
      if (TRF && l > 1e-9 && TRF.dirs.length > 4) { var sp = 0, j2; for (j2 = 0; j2 < TRF.dirs.length; j2 += 4) { var c2 = (TRF.dirs[j2] * ax + TRF.dirs[j2 + 1] * ay + TRF.dirs[j2 + 2] * az) / l; var a2 = Math.acos(Math.max(-1, Math.min(1, c2))) * 57.3; if (a2 > sp) sp = a2; } TRF.spr = sp; }
      if (!(l > 1e-9)) return null;
      var rx = ax / l, ry = ay / l, rz = az / l;
      if (flat && G.tri3D && TV.length >= 6) {                               // 시선축이 충분히 다른 두 장 이상일 때만(한 장이면 깊이를 모름 — 예전 방식)
        var sep = 0, a1, b1; for (a1 = 0; a1 < TV.length; a1 += 3) for (b1 = a1 + 3; b1 < TV.length; b1 += 3) { var cv = Math.abs(TV[a1] * TV[b1] + TV[a1 + 1] * TV[b1 + 1] + TV[a1 + 2] * TV[b1 + 2]); if (1 - cv > sep) sep = 1 - cv; }
        if (sep > 1 - Math.cos(G.tri3DMinDeg * Math.PI / 180)) {
          var lam = G.tri3DPrior * TM[6], nx0 = n.x, ny0 = n.y, nz0 = n.z;   // 약한 기대: 바깥(n) 쪽으로는 안 감
          var m00 = TM[0] + lam * nx0 * nx0, m01 = TM[1] + lam * nx0 * ny0, m02 = TM[2] + lam * nx0 * nz0, m11 = TM[3] + lam * ny0 * ny0, m12 = TM[4] + lam * ny0 * nz0, m22 = TM[5] + lam * nz0 * nz0;
          var tr = m00 + m11 + m22, vx = rx, vy = ry, vz = rz, it;                // 가장 작은 고유벡터 = (tr·I − M)의 가장 큰 고유벡터(거듭제곱)
          for (it = 0; it < 12; it++) { var qx = tr * vx - (m00 * vx + m01 * vy + m02 * vz), qy = tr * vy - (m01 * vx + m11 * vy + m12 * vz), qz = tr * vz - (m02 * vx + m12 * vy + m22 * vz), ql = Math.sqrt(qx * qx + qy * qy + qz * qz); if (!(ql > 1e-12)) break; vx = qx / ql; vy = qy / ql; vz = qz / ql; }
          if (vx * rx + vy * ry + vz * rz < 0) { vx = -vx; vy = -vy; vz = -vz; }
          triN++;
          return { x: vx, y: vy, z: vz };
        }
      }
      return { x: rx, y: ry, z: rz };
    }
    /* (2026-10-24) 걸음 안 다시 보기 — 처음 자리에서 쓴 사진들의 결만 그 점에서 다시 읽음(맞춰 보기·광택은 처음 자리에서 끝남) */
    function flowLite(p, n, ref, flat) {
      var ax = 0, ay = 0, az = 0, ws = 0, t, i, cam, R, ncz, o, sm, ncx, ncy, dX, dY, dZ, l, mx, my, mz, w;
      for (t = 0; t < lastUse.length; t++) {
        i = lastUse[t]; cam = cams[i]; if (!cam || !cam.ori) continue; R = cam.R;
        ncz = R[6] * n.x + R[7] * n.y + R[8] * n.z; if (ncz < G.minFacing) continue;
        o = proj(cam, p); if (o.ix < 0 || o.iy < 0 || o.ix >= cam.iw || o.iy >= cam.ih) continue;
        if (!(cam.smp.at(o.ix, o.iy) > 0)) continue;
        sm = sampleOri(cam, o.ix, o.iy); if (!sm || !(sm.coherence >= G.minCoh)) continue;
        ncx = R[0] * n.x + R[1] * n.y + R[2] * n.z; ncy = R[3] * n.x + R[4] * n.y + R[5] * n.z;
        dX = Math.cos(sm.angle) * cam.s; dY = -Math.sin(sm.angle) * cam.sy; dZ = -(dX * ncx + dY * ncy) / ncz; l = Math.hypot(dX, dY);
        var zl = (flat && G.backFix) ? G.freeDepth : 3; if (Math.abs(dZ) > zl * l) dZ = (dZ < 0 ? -zl : zl) * l;
        mx = R[0] * dX + R[3] * dY + R[6] * dZ; my = R[1] * dX + R[4] * dY + R[7] * dZ; mz = R[2] * dX + R[5] * dY + R[8] * dZ;
        l = Math.hypot(mx, my, mz); if (!(l > 1e-12)) continue; mx /= l; my /= l; mz /= l;
        if (mx * ref.x + my * ref.y + mz * ref.z < 0) { mx = -mx; my = -my; mz = -mz; }
        w = ncz * ncz * sm.coherence; ax += w * mx; ay += w * my; az += w * mz; ws += w;
      }
      l = Math.hypot(ax, ay, az); if (!(ws > 0) || !(l > 1e-9)) return null;
      return { x: ax / l, y: ay / l, z: az / l };
    }
    /* 0.4cm 걸음 = 처음 자리(flow) + 중간 두 번 · 끝 한 번(flowLite) — 1:2:2:1 */
    function flowStep(p, n, ref, flat, h) {
      var k1 = flow(p, n, ref, flat);
      if (!k1 || !G.rk || !(h > 0) || !lastUse.length) return k1;
      rkN++;
      var q = function (d, f) { return { x: p.x + d.x * h * f, y: p.y + d.y * h * f, z: p.z + d.z * h * f }; };
      if (G.rkSkipDeg > 0) {                                                 // 걸음 끝이 처음 자리와 거의 같은 결이면 곧은 결 — 한 번으로 끝
        var ke = flowLite(q(k1, 1), n, k1, flat);
        if (ke && ke.x * k1.x + ke.y * k1.y + ke.z * k1.z >= Math.cos(G.rkSkipDeg * Math.PI / 180)) { rkSkip++; rkSub++; return k1; }
      }
      var k2 = flowLite(q(k1, 0.5), n, k1, flat); if (!k2) { k2 = k1; rkMiss++; } else rkSub++;
      var k3 = flowLite(q(k2, 0.5), n, k1, flat); if (!k3) { k3 = k2; rkMiss++; } else rkSub++;
      var k4 = flowLite(q(k3, 1), n, k1, flat); if (!k4) { k4 = k3; rkMiss++; } else rkSub++;
      var x = k1.x + 2 * k2.x + 2 * k3.x + k4.x, y = k1.y + 2 * k2.y + 2 * k3.y + k4.y, z = k1.z + 2 * k2.z + 2 * k3.z + k4.z, l = Math.hypot(x, y, z);
      return l > 1e-9 ? { x: x / l, y: y / l, z: z / l } : k1;
    }
    function mixDir(prev, d) {       // 관성
      var a = G.inertia, x = prev.x * a + d.x * (1 - a), y = prev.y * a + d.y * (1 - a), z = prev.z * a + d.z * (1 - a), l = Math.hypot(x, y, z);
      return l > 1e-6 ? { x: x / l, y: y / l, z: z / l } : d;
    }
    function smoothPts(pts) {        // 양 끝 고정, 가운데만 이웃 평균 쪽으로
      var n = pts.length, it, i, out;
      if (n < 4 || !(G.smooth > 0)) return pts;
      for (it = 0; it < G.smooth; it++) {
        out = new Array(n); out[0] = pts[0]; out[n - 1] = pts[n - 1];
        for (i = 1; i < n - 1; i++) out[i] = { x: pts[i].x * 0.5 + (pts[i - 1].x + pts[i + 1].x) * 0.25, y: pts[i].y * 0.5 + (pts[i - 1].y + pts[i + 1].y) * 0.25, z: pts[i].z * 0.5 + (pts[i - 1].z + pts[i + 1].z) * 0.25 };
        pts = out;
      }
      for (i = 1; i < n; i++) { try { pts[i] = ellipsoidPushOut(pts[i], Es.a, Es.b, Es.c, CY); } catch (e) {} }
      return pts;
    }
    function tangent(d, n) {
      var k = d.x * n.x + d.y * n.y + d.z * n.z, x = d.x - k * n.x, y = d.y - k * n.y, z = d.z - k * n.z, l = Math.hypot(x, y, z);
      return l > 1e-6 ? { x: x / l, y: y / l, z: z / l } : null;
    }

    /* ③ 두께 지도 */
    var T = new Float32Array(NC), known = new Uint8Array(NC), tStat = { measured: 0, filled: 0, zero: 0 };
    function buildThickness() {
      var r, c, i, ph, th, sp, n, h, miss, last, v, got;
      for (r = 0; r < NP; r++) for (c = 0; c < NT; c++) {
        i = r * NT + c;
        if (offScalp(i)) { T[i] = 0; known[i] = 2; continue; }
        ph = (r + 0.5) / NP * Math.PI; th = (c + 0.5) / NT * 2 * Math.PI - Math.PI;
        sp = { x: Es.a * Math.sin(ph) * Math.sin(th), y: CY + Es.b * Math.cos(ph), z: Es.c * Math.sin(ph) * Math.cos(th) };
        n = normalAt(sp); miss = 0; last = 0; got = false;
        for (h = G.tStep; h <= G.tMax; h += G.tStep) {
          v = voteOutline({ x: sp.x + n.x * h, y: sp.y + n.y * h, z: sp.z + n.z * h }, n);
          if (v === 0) { if (++miss >= 2) { got = true; break; } }
          else { if (v === 1) last = h; miss = 0; }
        }
        if (got) { T[i] = last; known[i] = 1; tStat.measured++; if (last <= 0) tStat.zero++; }
        else known[i] = 0;                                   // 끝까지 안 벗어남 = 이 방향은 사진이 두께를 못 잼
      }
      // 못 잰 칸은 잰 이웃으로 메움
      var it, any, tmp = new Float32Array(NC), k2 = new Uint8Array(NC), dr, dc, rr, cc, j, sum, cnt;
      for (it = 0; it < 64; it++) {
        any = false; tmp.set(T); k2.set(known);
        for (r = 0; r < NP; r++) for (c = 0; c < NT; c++) {
          i = r * NT + c; if (known[i] !== 0) continue;
          sum = 0; cnt = 0;
          for (dr = -1; dr <= 1; dr++) for (dc = -1; dc <= 1; dc++) {
            rr = r + dr; if (rr < 0 || rr >= NP) continue; cc = ((c + dc) % NT + NT) % NT; j = rr * NT + cc;
            if (known[j] === 1) { sum += T[j]; cnt++; }
          }
          if (cnt) { tmp[i] = sum / cnt; k2[i] = 1; tStat.filled++; any = true; }
        }
        T.set(tmp); known.set(k2);
        if (!any) break;
      }
      var fb = Math.max(G.tFloor, (Eh.a - Es.a + Eh.c - Es.c) / 2);
      for (i = 0; i < NC; i++) if (known[i] === 0) { T[i] = fb; known[i] = 1; tStat.filled++; }
      // 한 번 고르게(두피 안 칸끼리만)
      tmp.set(T);
      for (r = 0; r < NP; r++) for (c = 0; c < NT; c++) {
        i = r * NT + c; if (known[i] !== 1) continue;
        sum = 0; cnt = 0;
        for (dr = -1; dr <= 1; dr++) for (dc = -1; dc <= 1; dc++) {
          rr = r + dr; if (rr < 0 || rr >= NP) continue; cc = ((c + dc) % NT + NT) % NT; j = rr * NT + cc;
          if (known[j] === 1) { var wgt = (dr === 0 && dc === 0) ? 4 : (dr === 0 || dc === 0) ? 2 : 1; sum += T[j] * wgt; cnt += wgt; }
        }
        tmp[i] = cnt ? sum / cnt : T[i];
      }
      for (i = 0; i < NC; i++) if (known[i] === 1) T[i] = Math.max(G.tFloor, Math.min(G.tMax, tmp[i]));
    }
    function thickAt(p) {            // 이웃 칸과 보간(두피 안 칸끼리만)
      var cy = Math.max(-1, Math.min(1, (p.y - CY) / Es.b)), fr = Math.acos(cy) / Math.PI * NP - 0.5, fc = (Math.atan2(p.x / Es.a, p.z / Es.c) + Math.PI) / (2 * Math.PI) * NT - 0.5;
      var r0 = Math.floor(fr), c0 = Math.floor(fc), tr = fr - r0, tc = fc - c0, sum = 0, wsum = 0, dr, dc, rr, cc, j, w;
      for (dr = 0; dr <= 1; dr++) for (dc = 0; dc <= 1; dc++) {
        rr = Math.max(0, Math.min(NP - 1, r0 + dr)); cc = ((c0 + dc) % NT + NT) % NT; j = rr * NT + cc;
        if (known[j] !== 1) continue;
        w = (dr ? tr : 1 - tr) * (dc ? tc : 1 - tc);
        sum += w * T[j]; wsum += w;
      }
      return wsum > 1e-6 ? sum / wsum : G.tFloor;
    }

    var info;
    /* 길이 상한·색 팔레트 — 원본 사진 가닥에서 */
    var lenBy = {}, colBy = {}, allLen = [];
    photo.strands.forEach(function (s) {
      var k = s.sec || 'crown', p = s.pts, L = 0, j;
      for (j = 1; j < p.length; j++) L += Math.hypot(p[j].x - p[j - 1].x, p[j].y - p[j - 1].y, p[j].z - p[j - 1].z);
      (lenBy[k] || (lenBy[k] = [])).push(L); allLen.push(L);
      if (s.color) { var cl = colBy[k] || (colBy[k] = []); if (cl.length < 400) cl.push(s.color); }
    });
    info = { isLong: false, skipY: {}, plantY: {} };
    var lowTips = 0;
    photo.strands.forEach(function (s) { if (s.pts[s.pts.length - 1].y < yBody) lowTips++; });
    var isLong = lowTips / Math.max(1, photo.strands.length) > G.longShare;
    var cPct = isLong ? G.longPct : G.lenPct, cMul = isLong ? G.longMul : G.lenMul;
    info.isLong = isLong;
    /* (2026-10-04e) backFix — 뒷머리(두피를 뒤쪽에서 벗어난 가닥)가 목을 감아 앞으로 쏠리는 것 막기
       실측: 앞·옆 사진에서 머리를 어깨 앞으로 넘긴 손님 → 목덜미 가닥이 전부 목 앞으로 감겨 가고 뒤는 목이 드러남.
       원인 ① 두피 밖 구간에서도 사진의 2D 결을 "두상을 감싼 면 위의 방향"으로 올려서, 뒤 사진 가장자리에서
              조금만 옆으로 흐르면 깊이(앞쪽) 움직임이 그 3배까지 붙었음 → 목을 감아 앞으로.
            ② 앞으로 간 자리는 앞·옆 사진(어깨 앞으로 넘긴 머리)이 "머리 맞음"이라고 해 줘서 계속 자람.
       고침 ① 두피 밖 구간은 깊이 움직임을 freeDepth배까지만.
            ② 뒤쪽에서 두피를 벗어난 가닥은 앞(z+)으로 못 감(뒤쪽일수록 강하게).
            ③ 그 가닥의 길이는 뒤 사진이 정함 — 뒤 사진에서 뜬 가닥들의 끝 높이까지는 다른 사진이 "머리 없음"이라 해도 이어 감. */
    var backTips = [], lowAll = [];
    if ((G.backFix || G.hangDown) && isLong) {
      photo.strands.forEach(function (s) { var ty = s.pts[s.pts.length - 1].y; if (ty < yBody) { lowAll.push(ty); if (s.srcAngle === 'back') backTips.push(ty); } });
      backTips.sort(function (x, y) { return x - y; });               // 낮은(긴) 것부터
      lowAll.sort(function (x, y) { return x - y; });
    }
    var backTipOK = backTips.length >= 20;
    var hangTips = (G.hangDown && isLong) ? (backTipOK ? backTips : (lowAll.length >= 20 ? lowAll : null)) : null;   // (v6) 곧게 내릴 끝 높이 분포
    var capAll = q(allLen, cPct) * cMul, cap = {};
    Object.keys(lenBy).forEach(function (k) { cap[k] = q(lenBy[k], cPct) * cMul; });
    function capFor(sec) { return cap[sec] > 0 ? cap[sec] : (capAll > 0 ? capAll : 0.5); }

    /* 뿌리 예산(마네킹과 같은 식: 밀도 × 셀 면적) */
    var yStep = (grid.yTopH - grid.yBot) / (grid.NY - 1);
    function bucketOfY(y) { return Math.min(grid.NY - 1, Math.max(0, Math.round((grid.yTopH - y) / yStep))); }
    var areas = null;
    try { areas = headSurfaceCellAreas(grid.hullW, grid.hullD, bucketOfY, CY, roots.b, NT, NP); } catch (e) { areas = null; }
    var wgt = new Float64Array(NC), wTot = 0, i;
    for (i = 0; i < NC; i++) {
      if (offScalp(i)) continue;
      var den = roots.den[i]; if (!(den > bald)) continue;
      wgt[i] = den * (areas ? areas[i] : 1); wTot += wgt[i];
    }
    if (!(wTot > 0)) return { err: '뿌리밀도가 전부 0' };
    /* (2026-10-12e) 재는 용도로만 기를 때는 덜 기름 — 화면의 원본 머리는 마네킹 + 스펙(58번)이라 기른 가닥은 결 표·길이·두께를 재는 데만 씀.
       실측(저장된 가닥을 솎아 결 표를 다시 만들어 비교 · 긴 웨이브·긴 직모): 앞·관자놀이는 그대로, 나머지 절반 → 표대로 만든 가닥의 차이 중앙값 0.1cm · 90% 0.3cm · 99% 1cm.
       1/3은 정수리 막다른 무리 판정이 빠지는 경우가 있어 절반까지만. 58번이 꺼져 있으면(기른 가닥을 그대로 보여 줌) 전부 기름. */
    var mShare = 1, kc = null;
    try { if (G.measureShare > 0 && G.measureShare < 1 && W.ORIG_MQ && W.ORIG_MQ.on !== false) mShare = G.measureShare; } catch (e) { mShare = 1; }
    if (mShare < 1) try {
      kc = new Float32Array(NC); var keepSec = G.measureFull || [], rr, cc2, phC, thC, FC, secC;
      for (i = 0; i < NC; i++) {
        if (!wgt[i]) continue;
        rr = i / NT | 0; cc2 = i % NT; phC = (rr + 0.5) / NP * Math.PI; thC = (cc2 + 0.5) / NT * 2 * Math.PI - Math.PI;
        FC = { x: Es.a * Math.sin(phC) * Math.sin(thC), y: CY + Es.b * Math.cos(phC), z: Es.c * Math.sin(phC) * Math.cos(thC) };
        secC = null; try { secC = resolveSection3D(FC, CY, Es.b); } catch (e) {}
        kc[i] = keepSec.indexOf(secC || 'crown') >= 0 ? 1 : mShare;
      }
    } catch (e) { kc = null; mShare = 1; }
    // (2026-10-04d) 가닥 수 = 48번(STRAND_BUDGET.total · 기본 30,000). 없으면 예전처럼 사진 가닥 수.
    var total = (W.STRAND_BUDGET && W.STRAND_BUDGET.on !== false && W.STRAND_BUDGET.total > 0) ? W.STRAND_BUDGET.total : photo.strands.length;

    var st = { n: 0, stub: 0, skipped: 0, steps: 0, est: 0, stopMask: 0, stopCap: 0, stopMax: 0, free: 0, flipped: 0,
      backN: 0, backFwd: 0, backKeep: 0, backLen: [], neckPush: 0, hangN: 0, hangSteps: 0, stopTip: 0,
      len: [], kink: [], sec: {} };
    var down = { x: 0, y: -1, z: 0 };

    var cmU = 18.6; try { cmU = modelCmPerUnit() || cmU; } catch (e) {}
    function room(F, n, dt, sgn) {       // 그 방향으로 몇 걸음까지 머리가 있나(짧게 내다봄)
      var k, f = F, nn = n, cnt = 0, d = { x: dt.x * sgn, y: dt.y * sgn, z: dt.z * sgn }, t2;
      for (k = 0; k < 4; k++) {
        f = onSurf({ x: f.x + d.x * G.step, y: f.y + d.y * G.step, z: f.z + d.z * G.step });
        nn = normalAt(f);
        if (vote({ x: f.x + nn.x * G.tFloor, y: f.y + nn.y * G.tFloor, z: f.z + nn.z * G.tFloor }) === 0) break;
        cnt++;
        t2 = tangent(d, nn); if (t2) d = t2;
      }
      return cnt;
    }

    /* (2026-10-11d) 뿌리 칸마다 결의 앞뒤를 미리 정함 — 또렷한 칸(아래·뒤로 흐름)은 그대로, 옆으로 흐린 칸은 이웃 칸들 쪽으로(되풀이해서 퍼뜨림) */
    var polMap = null, polStat = { sure: 0, nbr: 0, mid: 0 };
    if (G.polNbr) try {
      polMap = new Float32Array(NC * 4);                                    // x,y,z,상태(1 또렷 · 2 이웃으로 정함 · 0 모름)
      var rr, cc, ci2;
      for (rr = 0; rr < NP; rr++) for (cc = 0; cc < NT; cc++) {
        ci2 = rr * NT + cc; if (offScalp(ci2)) continue;
        var ph0 = (rr + 0.5) / NP * Math.PI, th0 = (cc + 0.5) / NT * 2 * Math.PI - Math.PI;
        var F0c = { x: Es.a * Math.sin(ph0) * Math.sin(th0), y: CY + Es.b * Math.cos(ph0), z: Es.c * Math.sin(ph0) * Math.cos(th0) }, n0c = normalAt(F0c);
        var f0 = flow(F0c, n0c, null); if (!f0) continue;
        var t0c = tangent(f0, n0c); if (!t0c) continue;
        var sg0 = 0;
        if (Math.abs(t0c.y) > 0.3) sg0 = t0c.y < 0 ? 1 : -1; else if (Math.abs(t0c.z) > 0.3) sg0 = t0c.z < 0 ? 1 : -1;
        polMap[ci2 * 4] = t0c.x * (sg0 || 1); polMap[ci2 * 4 + 1] = t0c.y * (sg0 || 1); polMap[ci2 * 4 + 2] = t0c.z * (sg0 || 1); polMap[ci2 * 4 + 3] = sg0 ? 1 : 0;
        if (sg0) polStat.sure++;
      }
      for (var pass = 0; pass < 12; pass++) {
        var changed = 0;
        for (ci2 = 0; ci2 < NC; ci2++) {
          if (polMap[ci2 * 4 + 3] !== 0 || (polMap[ci2 * 4] === 0 && polMap[ci2 * 4 + 1] === 0 && polMap[ci2 * 4 + 2] === 0)) continue;
          rr = ci2 / NT | 0; cc = ci2 % NT; var sum = 0, dr, dc;
          for (dr = -1; dr <= 1; dr++) for (dc = -1; dc <= 1; dc++) {
            if (!dr && !dc) continue; var pr2 = rr + dr, pc2 = (cc + dc + NT) % NT; if (pr2 < 0 || pr2 >= NP) continue;
            var cj = pr2 * NT + pc2; if (polMap[cj * 4 + 3] === 0) continue;
            sum += polMap[ci2 * 4] * polMap[cj * 4] + polMap[ci2 * 4 + 1] * polMap[cj * 4 + 1] + polMap[ci2 * 4 + 2] * polMap[cj * 4 + 2];
          }
          if (Math.abs(sum) > 0.15) { if (sum < 0) { polMap[ci2 * 4] *= -1; polMap[ci2 * 4 + 1] *= -1; polMap[ci2 * 4 + 2] *= -1; } polMap[ci2 * 4 + 3] = 2; polStat.nbr++; changed++; }
        }
        if (!changed) break;
      }
    } catch (e) { polMap = null; }

    function grow(cellIdx) {
      var r = cellIdx / NT | 0, c = cellIdx % NT;
      var ph = (r + rnd()) / NP * Math.PI, th = (c + rnd()) / NT * 2 * Math.PI - Math.PI;
      var F = { x: Es.a * Math.sin(ph) * Math.sin(th), y: CY + Es.b * Math.cos(ph), z: Es.c * Math.sin(ph) * Math.cos(th) };
      var n = normalAt(F), u = G.layerLo + (G.layerHi - G.layerLo) * rnd();
      var sec = null; try { sec = resolveSection3D(F, CY, Es.b); } catch (e) {} sec = sec || 'crown';
      var Lcap = capFor(sec), ramp = Math.max(0.03, Math.min(0.12, 0.25 * Lcap));
      var stp = Math.max(G.step, Lcap / G.maxSteps);      // 긴 가닥은 걸음을 넓혀 걸음 수 상한에 안 걸리게
      var tRoot = thickAt(F), rootY = F.y;
      var pts = [{ x: F.x, y: F.y, z: F.z }], P = F, s = 0, prev = null, miss = 0, k, d, dt, fl, estSteps = 0, steps = 0, free = false, stop = 'max';
      var bw = 0, myTip = null, exitI = -1, exitY = 0, exitZ = 0;           // backFix: 뒤쪽 정도(0~1) · 이 가닥이 내려갈 끝 높이 · 두피를 벗어난 자리(점 번호·높이·깊이)
      var hangTip = null, hung = false, lowF = Infinity;   // lowF: (13k) 두피 밖에서 가장 낮게 내려간 높이                                     // (v6) 곧게 내릴 끝 높이 · 곧게 내린 적 있음
      var nClimb = 0, sOn = 0, sFree = 0, nBack = 0, nNeck = 0, nEst = 0, TS = G.trace ? [] : null;   // (2026-10-10a) 걸음 기록
      function rec(ph, est, ex2) {                                          // 걸음 하나: [단계 0두피위 1두피밖 2곧게내림, 결 못읽음, 쓴 사진 수, 주로 쓴 사진, 그 사진 결 또렷함, 사진끼리 벌어진 각, 따로 막은 것(1 앞쏠림 2 목), 머리 영역 표, x,y,z]
        if (!TS) return; var f2 = TRF || {}; TS.push(ph, est ? 1 : 0, f2.nc || 0, f2.best == null ? -1 : f2.best, Math.round((f2.coh || 0) * 100), Math.round(f2.spr || 0), ex2 || 0);
      }
      if (TS) TRF = {};

      // 첫 방향과 앞뒤
      fl = flow(F, n, null);
      d = fl || down; if (!fl) estSteps++;
      dt = tangent(d, n) || tangent({ x: 0.3, y: -1, z: 0.2 }, n) || { x: 1, y: 0, z: 0 };
      var sgn;
      if (Math.abs(dt.y) > 0.3) sgn = dt.y < 0 ? 1 : -1;                    // 아래쪽
      else if (Math.abs(dt.z) > 0.3) sgn = dt.z < 0 ? 1 : -1;               // 수평이면 뒤쪽
      else if (polMap && polMap[cellIdx * 4 + 3] > 0) sgn = (dt.x * polMap[cellIdx * 4] + dt.y * polMap[cellIdx * 4 + 1] + dt.z * polMap[cellIdx * 4 + 2]) >= 0 ? 1 : -1;   // (2026-10-11d) 이웃 뿌리들의 방향
      else { sgn = dt.x * F.x >= 0 ? 1 : -1; polStat.mid++; }               // 이웃도 모름 — 예전처럼 가운데 선 바깥쪽
      var r1 = room(F, n, dt, sgn);
      var flip = 0, tCm0 = tRoot * cmU;
      var polK = G.polThickHi > G.polThickLo ? Math.max(0, Math.min(1, (G.polThickHi - tCm0) / (G.polThickHi - G.polThickLo))) : 1;   // (2026-10-10g) 두꺼운(세운) 자리는 오르막 허용
      if (G.flipRule !== false && r1 < 2) {   // (2026-10-22) flipRule=false면 결이 가리킨 쪽 그대로
        var r2 = room(F, n, dt, -sgn);
        if (r2 > r1) {
          var tCm = tRoot * cmU;
          if (!(G.flipThickCm > 0) || tCm >= G.flipThickCm) { sgn = -sgn; st.flipped++; flip = 1; }
          else {                                                                     // (2026-10-10c) 얇은 자리 — 위로 안 뒤집음
            st.flipKept = (st.flipKept || 0) + 1; flip = 2;
            // (2026-10-10d) 아래로는 곧 머리가 끝나니(이마·목덜미) 두피를 따라 옆으로 눕힘 — 가르마 바깥쪽 · 앞이면 옆·뒤쪽. 옆으로도 자리가 없으면 아래 그대로(짧게)
            var sx = F.x >= 0 ? 1 : -1, sideD = tangent({ x: sx, y: -0.35, z: F.z > 0 ? -0.25 : 0 }, n);
            var frontRoot = F.z > 0 && Math.abs(Math.atan2(F.x, F.z)) < 0.87;          // 앞 헤어라인(±50°)만 옆으로 — 옆·목덜미는 아래로 짧게(구레나룻·목덜미 짧은 머리)
            if (frontRoot && sideD && room(F, n, sideD, 1) >= 2) { dt = sideD; sgn = 1; st.flipSide = (st.flipSide || 0) + 1; flip = 3; }
          }
        }
      }
      prev = { x: dt.x * sgn, y: dt.y * sgn, z: dt.z * sgn };

      var loopR2 = 0, loopBack = 0, kinkMin = 0, turnH = [], arcK = 0; try { var cmL = modelCmPerUnit() || 18.6; loopR2 = Math.pow(G.loopCm / cmL, 2); loopBack = G.loopBackCm / cmL; kinkMin = G.kinkMinCm / cmL; } catch (e) {}
      for (k = 0; k < (G.lenCap ? G.maxSteps : G.maxSteps * 3); k++) {
        if (G.kinkStop && pts.length >= 3) {                                 // (2026-10-24) 결이 끊긴 곳에서 끝(시험)
          var ka = pts[pts.length - 3], kb = pts[pts.length - 2], kc = pts[pts.length - 1];
          var u1x = kb.x - ka.x, u1y = kb.y - ka.y, u1z = kb.z - ka.z, u2x = kc.x - kb.x, u2y = kc.y - kb.y, u2z = kc.z - kb.z;
          var l1 = Math.sqrt(u1x * u1x + u1y * u1y + u1z * u1z), l2 = Math.sqrt(u2x * u2x + u2y * u2y + u2z * u2z);
          if (l1 > 1e-9 && l2 > 1e-9) {
            arcK += l2;
            var tk = Math.acos(Math.max(-1, Math.min(1, (u1x * u2x + u1y * u2y + u1z * u2z) / (l1 * l2)))) * 57.2958;
            if (turnH.length >= 3 && arcK >= kinkMin) {
              var h3 = turnH.slice(-3).sort(function (p1, p2) { return p1 - p2; });
              if (tk - h3[1] >= G.kinkDeg) { pts.pop(); stop = 'kink'; st.stopKink = (st.stopKink || 0) + 1; break; }
            }
            turnH.push(tk);
          }
        }
        if (G.loopStop && loopR2 > 0 && pts.length > 4) {                    // (2026-10-24b) 같은 길을 두 번 돌면 멈춤
          var la = pts[pts.length - 1], lb = pts[pts.length - 2], ldx = la.x - lb.x, ldy = la.y - lb.y, ldz = la.z - lb.z, ll = Math.sqrt(ldx * ldx + ldy * ldy + ldz * ldz) || 1, back = 0, lj, hitL = false;
          for (lj = pts.length - 2; lj > 0; lj--) {
            var pa = pts[lj], pb = pts[lj - 1];
            back += Math.sqrt((pa.x - pb.x) * (pa.x - pb.x) + (pa.y - pb.y) * (pa.y - pb.y) + (pa.z - pb.z) * (pa.z - pb.z));
            if (back < loopBack) continue;
            var ex2 = la.x - pa.x, ey2 = la.y - pa.y, ez2 = la.z - pa.z;
            if (ex2 * ex2 + ey2 * ey2 + ez2 * ez2 > loopR2) continue;
            var mdx = pa.x - pb.x, mdy = pa.y - pb.y, mdz = pa.z - pb.z, ml = Math.sqrt(mdx * mdx + mdy * mdy + mdz * mdz) || 1;
            if ((ldx * mdx + ldy * mdy + ldz * mdz) / (ll * ml) >= G.loopCos) { hitL = true; break; }
          }
          if (hitL) { stop = 'loop'; st.stopLoop = (st.stopLoop || 0) + 1; break; }
        }
        steps++;
        if (!free) {
          // 두피 위 구간: 발은 두피면을 따라, 몸은 그 위 두께만큼 떠서
          polW = (flip === 1) ? 0 : (G.polDown || 0) * polK; fl = flowStep(P, n, prev, false, stp); polW = 0; if (!fl) { estSteps++; nEst++; }
          if (fl) fl = mixDir(prev, fl);
          dt = tangent(fl || prev, n) || prev;
          var F2 = onSurf({ x: F.x + dt.x * stp, y: F.y + dt.y * stp, z: F.z + dt.z * stp });
          if (offScalp(cellOf(F2))) {
            if (flip === 3 && G.sideLayStay) { stop = 'side'; st.sideEnd = (st.sideEnd || 0) + 1; break; }   // (2026-10-11p) 옆으로 눕힌 가닥은 두피 밖으로 안 나감
            free = true; st.free++; prev = dt; k--; steps--; exitI = pts.length - 1; exitY = P.y; exitZ = P.z; lowF = P.y;
            if (G.backFix) {                                                // 두피를 벗어난 자리가 얼마나 뒤쪽인가
              var ex = P.x / Es.a, ez = P.z / Es.c, eh = Math.hypot(ex, ez);
              var tb = eh > 1e-6 ? -ez / eh : 0, tt = Math.max(0, Math.min(1, (tb - G.backFrom) / Math.max(1e-6, G.backFull - G.backFrom)));
              bw = tt * tt * (3 - 2 * tt);
              if (bw >= 0.5) { st.backN++; if (backTipOK) myTip = backTips[Math.min(backTips.length - 1, Math.floor(backTips.length * (0.25 + 0.5 * rnd())))]; }
            }
            if (hangTips) hangTip = hangTips[Math.min(hangTips.length - 1, Math.floor(hangTips.length * (0.25 + 0.5 * rnd())))];
            continue;
          }
          var n2 = normalAt(F2), s2 = s + stp, h2 = u * thickAt(F2) * Math.min(1, s2 / ramp);
          var P2 = { x: F2.x + n2.x * h2, y: F2.y + n2.y * h2, z: F2.z + n2.z * h2 };
          var v2 = vote(P2); if (TS) { rec(0, !fl, 0); TS.push(v2 ? 1 : 0, P2.x, P2.y, P2.z); }
          // (2026-10-10j) 사진 윤곽으로 잰 머리 두께가 거의 없는 자리(페이드·짧게 민 옆·뒤)로는 위에서 내려온 긴 머리가 못 덮음 — 덮었다면 윤곽이 두꺼웠을 것
          if (G.thinStopCm > 0 && tCm0 >= G.thinStopRoot && s2 > G.thinStopAfter / cmU && thickAt(F2) * cmU < G.thinStopCm) { stop = 'mask'; st.thinStop = (st.thinStop || 0) + 1; break; }
          if (v2 === 0) { if (++miss >= (G.hullMissMax || 2)) { stop = 'mask'; break; } } else miss = 0;
          if (G.onScalpLen && !isLong && s2 > Math.max(G.minLenCm / cmU, G.liftK * tRoot)) { stop = 'len'; st.lenThick = (st.lenThick || 0) + 1; pts.push(P2); break; }
          if (flip === 3 && G.sideLayStay && s2 >= Lcap) { stop = 'side'; st.sideEnd = (st.sideEnd || 0) + 1; pts.push(P2); break; }   // (2026-10-11p) 옆으로 눕힌 가닥의 길이 = 그 섹션 상한까지(10f 때와 같음)
          pts.push(P2); F = F2; n = n2; P = P2; s = s2; sOn += stp; prev = tangent(dt, n2) || dt;
        } else {
          // 두피 밖 구간: 결 + 중력, 두상 안으로는 못 들어감
          var hangNow = hangTip != null && P.y < yBody;                     // (v6) 턱·목덜미 아래 — 사진 결을 안 읽고 곧게 아래로
          var exB = 0;
          if (hangNow) {
            if (TRF) { TRF.nc = 0; TRF.best = -1; TRF.coh = 0; TRF.spr = 0; }
            var hk = G.hangK, hx = prev.x * (1 - hk), hy = prev.y * (1 - hk) - hk, hz = prev.z * (1 - hk), hl = Math.hypot(hx, hy, hz) || 1;
            d = { x: hx / hl, y: hy / hl, z: hz / hl };
            if (!hung) { hung = true; st.hangN++; }
            st.hangSteps++;
          } else {
            var rr = Math.hypot(P.x, P.z), nc = rr > 1e-6 ? { x: P.x / rr, y: 0, z: P.z / rr } : n;
            fl = flowStep(P, nc, prev, true, stp);
            // (13l) 두상 아래에서 사진 한 장만 옆으로 누운 결을 말하면 안 믿음 — 결을 못 읽은 걸음처럼 직전 방향 + 중력
            if (fl && G.soloSideBelow && flowNC === 1 && P.y < CY - Es.b && Math.abs(fl.y) < G.soloSideCos) { fl = null; st.soloSide = (st.soloSide || 0) + 1; }
            if (!fl) { estSteps++; nEst++; }
            d = fl ? mixDir(prev, fl) : prev;
            if (!G.backFoldAfter && bw > 0 && d.z > 0) {                      // 뒷머리는 앞으로 못 감 — (2026-10-12d) backFoldAfter면 여기서 안 막고 다 읽은 뒤 뒤로 넘김
              var fz = d.z * (1 - bw), fl2 = Math.hypot(d.x, d.y, fz);
              d = fl2 > 0.2 ? { x: d.x / fl2, y: d.y / fl2, z: fz / fl2 } : down;
              st.backFwd++; nBack++; exB = 1;
            }
            var gx = d.x * (1 - G.gravity), gy = d.y * (1 - G.gravity) - G.gravity, gz = d.z * (1 - G.gravity), gl = Math.hypot(gx, gy, gz) || 1;
            d = { x: gx / gl, y: gy / gl, z: gz / gl };
            if (G.noClimbCm > 0 && d.y > 0 && P.y + d.y * stp - lowF > G.noClimbCm / cmU) {   // (13k) 내려왔던 가닥이 다시 오름 — 위 성분 지움
              var cl = Math.hypot(d.x, d.z);
              d = cl > 0.2 ? { x: d.x / cl, y: 0, z: d.z / cl } : down;
              st.noClimb = (st.noClimb || 0) + 1; nClimb++;
            }
          }
          var Q = { x: P.x + d.x * stp, y: P.y + d.y * stp, z: P.z + d.z * stp };
          try { Q = ellipsoidPushOut(Q, Es.a * 1.02, Es.b * 1.02, Es.c * 1.02, CY); } catch (e) {}
          var Qn = G.neckPush(Q); if (Qn !== Q) { Q = Qn; st.neckPush++; nNeck++; exB = exB | 2; }
          if (hangNow) {                                                    // 끝 높이까지는 사진과 상관없이 이어 감
            if (Q.y <= hangTip) { miss = 0; stop = 'tip'; break; }
            miss = 0; if (TS) { rec(2, 0, exB); TS.push(1, Q.x, Q.y, Q.z); }
            pts.push({ x: Q.x, y: Q.y, z: Q.z }); P = Q; s += stp; sFree += stp; prev = d; if (Q.y < lowF) lowF = Q.y;
            if (G.lenCap && s >= Lcap) { stop = 'cap'; break; }
            continue;
          }
          var vq = vote(Q);
          // 뒤 사진의 머리 끝 높이까지는 이어 감 — (2026-10-04g) 아래로 늘어지는 중이고 두상 폭 안쪽일 때만.
          // 실측: 위·옆으로 튀어 나간 가닥까지 이어 가서 머리 밖으로 큰 고리가 몇 가닥 생겼음.
          if (vq === 0 && myTip != null && Q.y > myTip && d.y < -0.5) {
            var fx = Q.x / (Es.a * 1.3), fz2 = Q.z / (Es.c * 1.3);
            if (fx * fx + fz2 * fz2 <= 1) { vq = 1; st.backKeep++; }
          }
          if (TS) { rec(1, !fl, exB); TS.push(vq ? 1 : 0, Q.x, Q.y, Q.z); }
          if (vq === 0) { if (++miss >= (G.hullMissMax || 2)) { stop = 'mask'; break; } } else miss = 0;
          pts.push({ x: Q.x, y: Q.y, z: Q.z }); P = Q; s += stp; sFree += stp; prev = d; if (Q.y < lowF) lowF = Q.y;
        }
        if (G.lenCap && s >= Lcap) { stop = 'cap'; break; }
      }
      if (miss > 0) pts.length = Math.max(1, pts.length - miss);        // 머리 영역 밖으로 나간 꼬리는 버림
      if (pts.length < 3 && flip === 2 && G.stubCm > 0) {                 // (2026-10-10e) 안 뒤집은 얇은 자리 — 짧은 머리로 심음(안 심으면 결 표가 이웃 칸의 긴 길이를 가져와 귀 옆이 길게 늘어짐)
        var sd = tangent(down, normalAt(pts[0])) || down, sl = G.stubCm / cmU, b0 = pts[0], nn0 = normalAt(b0), hh = 0.3 * thickAt(b0);
        pts = [b0, { x: b0.x + sd.x * sl * 0.5 + nn0.x * hh, y: b0.y + sd.y * sl * 0.5 + nn0.y * hh, z: b0.z + sd.z * sl * 0.5 + nn0.z * hh }, { x: b0.x + sd.x * sl + nn0.x * hh, y: b0.y + sd.y * sl + nn0.y * hh, z: b0.z + sd.z * sl + nn0.z * hh }];
        st.stub = (st.stub || 0) + 1; stop = 'mask';
      }
      if (pts.length < 3) { st.skipped++; (info.skipY[sec] || (info.skipY[sec] = [])).push(rootY); return null; }   // 사진에 머리가 없는 자리 — 그루터기를 억지로 세우지 않음
      (info.plantY[sec] || (info.plantY[sec] = [])).push(rootY);
      if (G.backFix && G.backFoldAfter && free && bw > 0 && exitI >= 0 && pts.length > exitI + 1) {   // (2026-10-12d) 다 읽은 뒤: 뒤쪽에서 나온 가닥을 어깨 아래에서 뒤로 넘김(위는 읽은 그대로)
        var fK = Math.max(0, Math.min(1, bw / Math.max(1e-6, G.backFoldBw))); fK = fK * fK * (3 - 2 * fK);
        var yF = Math.min(exitY, yBody - G.backFoldDropCm / cmU), rF = Math.max(1e-6, G.backFoldRampCm / cmU), movedF = 0, iF, pF, wF;
        var dzF = -1;                                                     // (2026-10-12q) 눌러 펴지 않고 통째로 뒤로 옮김 — 사용자: "어깨가 비고 · 뒷모습 아래쪽이 퍼지질 않고 일자"
        for (iF = exitI + 1; iF < pts.length; iF++) {                    //   예전: 어깨 아래 점마다 앞으로 나온 만큼을 지워(z → 두피 벗어난 깊이) 모든 가닥이 한 판으로 눌림 → 출렁임·퍼짐이 사라짐(이 손님 21,629가닥)
          pF = pts[iF]; if (!(pF.y < yF)) continue;                      //   지금: 어깨 높이에서 앞으로 나와 있던 만큼(dzF)만 아래 전체를 뒤로 평행 이동 → 가닥 모양·가닥끼리의 벌어짐은 그대로 · 예전 = REGROW.backFoldFlat=true
          if (dzF < 0) dzF = Math.max(0, pF.z - exitZ);
          wF = Math.min(1, (yF - pF.y) / rF); wF = fK * wF * wF * (3 - 2 * wF); if (!(wF > 1e-4)) continue;
          var zN = G.backFoldFlat ? (pF.z > exitZ ? pF.z - wF * (pF.z - exitZ) : pF.z) : pF.z - wF * dzF;
          if (zN === pF.z) continue;
          pts[iF] = { x: pF.x, y: pF.y, z: zN }; movedF++;
        }
        if (movedF) { st.foldN = (st.foldN || 0) + 1; st.foldPts = (st.foldPts || 0) + movedF; }
      }
      pts = smoothPts(pts);
      if (straightOn && straightWinCm > 0) {                              // (2026-10-10s) 곱슬 — 사진 컬을 뼈대에서 빼고 축만 남김
        var L0s = 0, L1s = 0, iS; for (iS = 1; iS < pts.length; iS++) L0s += Math.hypot(pts[iS].x - pts[iS - 1].x, pts[iS].y - pts[iS - 1].y, pts[iS].z - pts[iS - 1].z);
        var ptsS = straightenPath(straightenPath(pts, straightWinCm / cmU), straightWinCm / cmU);
        if (ptsS !== pts && WFb) { try { WFb.add(pts, ptsS); } catch (e) {} }
        if (ptsS !== pts) { for (iS = 1; iS < ptsS.length; iS++) L1s += Math.hypot(ptsS[iS].x - ptsS[iS - 1].x, ptsS[iS].y - ptsS[iS - 1].y, ptsS[iS].z - ptsS[iS - 1].z); if (L0s > 0) straightShrink.push(L1s / L0s); pts = ptsS; nStraight++; }
      }
      if (bw >= 0.5 || hung) { try { pts._rgKeep = true; } catch (e) {} }  // 조정 단계의 "사진 영역 밖 다듬기"가 이 가닥을 다시 자르지 않게
      var Larc = 0, ii; for (ii = 1; ii < pts.length; ii++) Larc += Math.hypot(pts[ii].x - pts[ii - 1].x, pts[ii].y - pts[ii - 1].y, pts[ii].z - pts[ii - 1].z);
      var qi = Math.min(pts.length - 1, 6), ex = pts[qi].x - pts[0].x, ey = pts[qi].y - pts[0].y, ez = pts[qi].z - pts[0].z, el = Math.hypot(ex, ey, ez) || 1;
      var rg = { t: tRoot, free: free, L: Larc, tipY: pts[pts.length - 1].y, dx: ex / el, dy: ey / el, dz: ez / el,
        flip: flip, stop: stop, sOn: sOn, sFree: sFree, nEst: nEst, nBack: nBack, nNeck: nNeck, steps: steps, cap: Lcap, stp: stp, cell: cellIdx, den: roots.den[cellIdx], est0: roots.est ? roots.est[cellIdx] : 0 };
      if (TS) { TRF = null; if ((!free && (stop === 'cap' || stop === 'max')) || (st.n % Math.max(1, G.traceEvery | 0) === 0)) rg.trace = new Float32Array(TS); }
      if (nClimb) st.noClimbN = (st.noClimbN || 0) + 1;
      if (stop === 'mask') st.stopMask++; else if (stop === 'cap') st.stopCap++; else if (stop === 'tip') st.stopTip++; else if (stop === 'len' || stop === 'side' || stop === 'loop' || stop === 'kink') { } else st.stopMax++;
      if (bw >= 0.5) st.backLen.push(Larc);
      st.steps += steps; st.est += estSteps;

      var view = 'front'; try { view = viewOfRoot(F0(pts)); } catch (e) {}
      var pal = colBy[sec] || colBy.crown, color = pal && pal.length ? pal[rnd() * pal.length | 0] : '#2B2320', colors = null;
      try { colors = bakeStrandColors3D(pts, photo, view, color, null); } catch (e) { colors = null; }
      return { pts: pts, sec: sec, color: color, colors: colors, srcAngle: view, rootFacing: 0, regrown: true, rg: rg };
    }
    function F0(p) { return p[0]; }

    var out = [], cell = 0, carry = 0, t0 = now(), thickDone = false;
    return {
      total: total,
      /* budget ms만큼 일하고 진행률(0~1) 반환. 1이면 끝 */
      step: function (budget) {
        var t = now();
        if (!thickDone) { buildThickness(); thickDone = true; return 0.08; }
        while (cell < NC && now() - t < budget) {
          if (wgt[cell]) {
            carry += wgt[cell] / wTot * total * (kc ? kc[cell] : 1);
            var nRoots = Math.floor(carry); carry -= nRoots;
            for (var j = 0; j < nRoots; j++) {
              var sdd = grow(cell);
              if (!sdd) continue;
              out.push(sdd); st.n++;
              st.sec[sdd.sec] = (st.sec[sdd.sec] || 0) + 1;
              if (st.n % 7 === 0) {            // 통계 표본
                var p = sdd.pts, L = 0, turn = 0, turns = 0, i2;
                for (i2 = 1; i2 < p.length; i2++) {
                  var ax = p[i2].x - p[i2 - 1].x, ay = p[i2].y - p[i2 - 1].y, az = p[i2].z - p[i2 - 1].z, al = Math.hypot(ax, ay, az);
                  L += al;
                  if (i2 > 1 && al > 1e-9) {
                    var bx = p[i2 - 1].x - p[i2 - 2].x, by = p[i2 - 1].y - p[i2 - 2].y, bz = p[i2 - 1].z - p[i2 - 2].z, bl = Math.hypot(bx, by, bz);
                    if (bl > 1e-9) { turn += Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by + az * bz) / (al * bl)))); turns++; }
                  }
                }
                st.len.push(L); if (turns) st.kink.push(turn / turns * 180 / Math.PI);
              }
            }
          }
          cell++;
        }
        return cell >= NC ? 1 : 0.08 + 0.92 * cell / NC;
      },
      finish: function () {
        var cm = 1; try { cm = modelCmPerUnit() || 1; } catch (e) {}
        // (2026-10-06p) 곱슬머리는 결 정렬을 약하게/안 함 — 곱슬 사진의 뼈대는 일부러 엇갈려 있고, 나란히 펴면 컬이 죽어 보임(사용자: "align=false로 하니까 돌아왔어")
        var alK = 1; if (!straightOn) try { var pcA = G.photoCurl(); if (pcA && pcA.raw > 0 && G.alignCurlOff > 0) alK = clampN(1 - pcA.raw / G.alignCurlOff, 0, 1); } catch (e) { alK = 1; }
        var al = null; try { al = G.alignStrands(out, CY, alK); } catch (e) { console.warn(TAG + ' 결 정렬 실패(그대로 둠)', e); }
        try { G.trimStat = G.trimTails(out); } catch (e) { G.trimStat = { err: String(e && e.message || e) }; console.warn(TAG + ' 윤곽 끝 자르기 실패(그대로 둠)', e); }   // (2026-10-21i)
        var tv = []; for (var k = 0; k < NC; k++) if (known[k] === 1 && !offScalp(k)) tv.push(T[k] * cm);
        S = G.stats = {
          ms: Math.round(now() - t0), mShare: mShare, pa: paStat, rk: { on: !!G.rk, n: rkN, sub: rkSub, miss: rkMiss, skip: rkSkip }, n: st.n, stub: st.stub, skipped: st.skipped, sec: st.sec,
          lenMed: q(st.len, 0.5) * cm, lenP90: q(st.len, 0.9) * cm, kinkMed: q(st.kink, 0.5), kinkP90: q(st.kink, 0.9),
          estPct: st.steps ? st.est / st.steps * 100 : 0, stopLoop: st.stopLoop || 0, stopKink: st.stopKink || 0, stopMask: st.stopMask, stopCap: st.stopCap, stopMax: st.stopMax, free: st.free, flipped: st.flipped, soloSide: st.soloSide || 0, noClimb: st.noClimb || 0, noClimbN: st.noClimbN || 0, flipKept: st.flipKept || 0, flipSide: st.flipSide || 0, stubN: st.stub || 0, glossN: glossN, glossKeep: glossKeep, agreeN: agreeN, agreeDrop: agreeDrop, agreeSkip: agreeSkip, thinStop: st.thinStop || 0, sideEnd: st.sideEnd || 0,
          isLong: isLong, capTxt: Object.keys(cap).map(function (k) { return k + ' ' + n1(cap[k] * cm); }).join(' · '),
          tMed: q(tv, 0.5), tP90: q(tv, 0.9), tMeasured: tStat.measured, tFilled: tStat.filled, tZero: tStat.zero, cells: NC,
          cams: cams.map(function (c) { return c.angle; }).join(','), hullN: hullN, triN: triN, vol: VOL ? { n: VOL.nx * VOL.ny * VOL.nz, inN: VOL.inN, tN: VOL.tightN, ms: VOL.ms, cm: G.volCellCm } : null, pol: polStat, lenThick: st.lenThick || 0, hullV: cams.filter(function (c) { return c.hull; }).map(function (c) { return c.angle; }).join(','), straight: straightOn ? straightNote.join(' · ') + ' · 편 가닥 ' + nStraight + '개 · 길이 남음(축/걸은 길) 중앙값 ' + (straightShrink.length ? q(straightShrink, 0.5).toFixed(2) : '-') : '',
          neckPush: st.neckPush, backFoldAfter: !!G.backFoldAfter, foldN: st.foldN || 0, foldPts: st.foldPts || 0, backFix: !!G.backFix, backN: st.backN, backFwd: st.backFwd, backKeep: st.backKeep, backLenMed: q(st.backLen, 0.5) * cm,
          align: al ? { on: al.on, skipped: !!al.skipped, kMul: al.kMul, strands: al.strands, segs: al.segs, rotMed: q(al.rot, 0.5), rotP90: q(al.rot, 0.9), trimmed: al.trimmed, trimCm: al.trimmed ? al.trimLen / al.trimmed * cm : 0, cells: al.cells, ms: Math.round(al.ms) } : null,
          backTipN: backTips.length, backTipCm: backTipOK ? (yTop - q(backTips, 0.5)) * cm : NaN,
          hang: !!hangTips, hangSrc: hangTips ? (hangTips === backTips ? '뒤 사진 가닥' : '전체 사진 가닥') : '', hangN: st.hangN, hangSteps: st.hangSteps, stopTip: st.stopTip,
          hangTipCm: hangTips ? [(yTop - q(hangTips, 0.75)) * cm, (yTop - q(hangTips, 0.25)) * cm] : null
        };
        var WFf = null; try { if (WFb) { var tWf = now(); WFf = WFb.finish(); S.wf = { known: WFf.known, n: WFf.nx * WFf.ny * WFf.nz, ampCm: WFf.ampU * cm, ampHiCm: WFf.ampHi * cm, strands: WFf.strands, samples: WFf.samples, ms: Math.round(now() - tWf), cellCm: G.waveCellCm }; } } catch (e) { WFf = null; console.warn(TAG + ' 굴곡 장 만들기 실패(없이 진행)', e); }
        return { strands: out, viewCal: photo.viewCal, yTop: photo.yTop, CY: photo.CY, field: photo.field || null, occ: photo.occ || null,
          grid: photo.grid, roots: photo.roots, mannequin: false, regrown: true, rgInfo: info, waveField: WFf };
      }
    };
  }

  /* ────────────────────────────────────────────────────────────────────────
   * 모델 바꿔 끼우기 — state.hair3Dneutral이 (마네킹이 꺼져 있고 REGROW.on이면) 다시 기른 모델을 돌려줌
   * ────────────────────────────────────────────────────────────────────── */
  var desc = null;
  try { desc = Object.getOwnPropertyDescriptor(state, 'hair3Dneutral'); } catch (e) {}
  if (!desc || !desc.get || !desc.set || !desc.configurable) { console.warn(TAG + ' state.hair3Dneutral 접근자를 못 찾아 건너뜀'); return; }
  G.model = null; G.src = null; G.building = false; G.lastErr = null;
  Object.defineProperty(state, 'hair3Dneutral', {
    enumerable: true, configurable: true,
    get: function () {
      var m = desc.get.call(this);
      if (!G.on || !m || m.mannequin) return m;
      if (G.model && G.src === this._hair3Dneutral) return G.model;
      if (!G.building && this._hair3Dneutral && G.failedFor !== this._hair3Dneutral) setTimeout(G.build, 0);   // 사진 모델이 새로 만들어졌으면 다시 기름
      return m;
    },
    set: function (v) { G.model = null; G.src = null; desc.set.call(this, v); }
  });

  function redraw() {
    try { if (typeof ADJ_CACHE !== 'undefined' && ADJ_CACHE.bump) ADJ_CACHE.bump(); } catch (e) {}
    try { if (typeof combRefresh === 'function') combRefresh(); else if (typeof renderAdjustFrame === 'function') renderAdjustFrame(); } catch (e) { console.warn(TAG + ' 다시 그리기 실패', e); }
  }
  G.build = function (cb) {
    // (옛 65) 기르기 직전 옆·뒤 사진을 정면 기준으로 맞춤(VIEW_ALIGN · 기본 꺼짐)
    if (typeof VIEW_ALIGN !== 'undefined') VIEW_ALIGN._beforeRegrowBuild();
    // (옛 68) 웨이브 사진은 직모 뼈대를 안 씀(READ_SHAPE)
    if (typeof READ_SHAPE !== 'undefined') READ_SHAPE._beforeRegrowBuild();
    // (옛 51) 격자가 없어 포기했던 사진이면 균일 격자를 넣고 다시 시도(13b ROOTS_FALLBACK)
    if (typeof ROOTS_FALLBACK !== 'undefined') ROOTS_FALLBACK._beforeRegrowBuild(G);
    if (typeof cb !== 'function') cb = null;
    if (G.building) return;
    var photo = state._hair3Dneutral;
    if (!photo || !photo.strands || !photo.strands.length) { if (cb) cb(false); return; }
    try { if (typeof NEUTRAL_BUILD !== 'undefined' && NEUTRAL_BUILD.running) { setTimeout(function () { G.build(cb); }, 300); return; } } catch (e) {}
    var B;
    try { B = makeBuilder(photo); } catch (e) { B = { err: String(e && e.message || e) }; console.warn(TAG + ' 준비 실패', e); }
    if (!B || B.err) {
      G.lastErr = B ? B.err : '?'; G.failedFor = photo;
      console.warn(TAG + ' 못 기름 — ' + G.lastErr + ' · 사진 가닥을 그대로 씁니다');
      if (cb) cb(false); return;
    }
    G.building = true; G.lastErr = null;
    var sub = null;
    try { if (typeof showAI === 'function') { showAI('뿌리부터 다시 기르는 중…', '0%'); sub = document.getElementById('aiOverlaySub'); } } catch (e) {}
    var workMs = 0, slices = 0;
    (function tick() {
      var f, tW = now();
      try { f = B.step(G.sliceMs); workMs += now() - tW; slices++; }
      catch (e) {
        G.building = false; G.lastErr = String(e && e.message || e); G.failedFor = photo;
        console.warn(TAG + ' 기르다 실패 — 사진 가닥을 그대로 씁니다', e);
        try { if (typeof hideAI === 'function') hideAI(); } catch (x) {}
        if (cb) cb(false); return;
      }
      if (sub) sub.textContent = Math.round(f * 100) + '%';
      if (f < 1) return setTimeout(tick, 0);
      var model = null;
      var tF = now();
      try { model = B.finish(); } catch (e) { G.lastErr = String(e && e.message || e); }
      try { if (G.stats) { G.stats.workMs = Math.round(workMs); G.stats.finMs = Math.round(now() - tF); G.stats.slices = slices; } } catch (e) {}
      G.building = false;
      try { if (typeof hideAI === 'function') hideAI(); } catch (x) {}
      if (!model || !model.strands.length || state._hair3Dneutral !== photo) {
        if (!model || !model.strands.length) { G.failedFor = photo; G.lastErr = G.lastErr || '가닥 0개'; console.warn(TAG + ' 결과가 비었습니다 — 사진 가닥을 그대로 씁니다'); }
        if (cb) cb(false); return;
      }
      G.model = model; G.src = photo;
      console.log(G.lines().join('\n'));
      try { if (G.applyBaseline) G.applyBaseline(); } catch (e) { console.warn(TAG + ' 기준 값 넣기 실패', e); }
      redraw();
      if (cb) cb(true);
    })();
  };

  /* ────────────────────────────────────────────────────────────────────────
   * (2026-10-04) 버튼 없이 자동 — 마네킹 OFF = 다시 기른 원본 머리(+치수 재기) · 마네킹 ON = 마네킹 모드
   *   · [다시 기르기] [원본 3D 그대로] [스타일 숫자 재기] 버튼은 없앴습니다(사용자 요청).
   *   · 마네킹이 꺼져 있으면 항상 다시 기른 머리를 보여 주고, 다 기르면 바로 치수를 재서
   *     슬라이더에 넣습니다(뿌리 볼륨·넘김 = 잰 값 · 길이 = 지금 길이가 기준 · 컬 0 = 지금 결 그대로).
   *   · 그 상태가 "기준"입니다. 기준에서는 가닥을 손대지 않고(사진 결 그대로), 슬라이더를 움직인 만큼만
   *     가닥에 겁니다(길이 비율 · 컬/웨이브 · 볼륨 · 넘김 · 가르마 · 흐름 · 정돈) — 바로 조정할 수 있게.
   *   · 마네킹 ON으로 가면 마네킹 때 쓰던 슬라이더 값(과 걸려 있던 스타일)을 되돌립니다.
   * ────────────────────────────────────────────────────────────────────── */
  G.base = null;            // 기준(잰 값): { sections:{sec:{length,curl}}, sty:{sweep,volume}, src: 사진 모델 }
  G.mqSnap = null;          // 마네킹 모드에서 쓰던 값(되돌리기용)
  function mqOn() { try { return typeof MANNEQUIN !== 'undefined' && !!MANNEQUIN.on; } catch (e) { return false; } }
  function secOrder() { return (typeof SECTION_ORDER !== 'undefined') ? SECTION_ORDER : ['crown', 'front', 'temple', 'side', 'occipital', 'nape']; }
  function clone(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }
  function setTag(t) { try { var el = document.getElementById('adjustStyleTag'); if (el) el.textContent = t; } catch (e) {} }
  function rebuildPanel() {
    try { if (typeof buildGyPanel === 'function') buildGyPanel(); else if (typeof buildGyControls === 'function') buildGyControls(); } catch (e) { console.warn(TAG + ' 조정 패널 다시 그리기 실패', e); }
    try { if (typeof syncSliderUI === 'function') syncSliderUI(); } catch (e) {}
  }
  function summary(r) {     // 미리보기 꼬리표에 넣는 한 줄
    try {
      var sp = r.spec, top, side, back;
      var ct = (sp.perm && sp.perm.curl > 0) ? ' · 컬 ' + sp.perm.curl : '';
      if (r.isLong) return '원본 머리 · 치수 잼 — 긴 머리 · 볼륨 ' + sp.styling.volume + ' · 넘김 ' + (sp.styling.sweep > 0 ? '+' : '') + sp.styling.sweep + ct;
      top = sp.lenCm.crown != null ? sp.lenCm.crown : sp.lenCm.front; side = sp.lenCm.side != null ? sp.lenCm.side : sp.lenCm.temple;
      back = sp.lenCm.occipital != null ? sp.lenCm.occipital : sp.lenCm.nape;
      return '원본 머리 · 치수 잼 — 윗머리 ' + (top != null ? top : '?') + 'cm · 옆 ' + (side != null ? side : '?') + 'cm · 뒤 ' + (back != null ? back : '?') + 'cm · 볼륨 ' + sp.styling.volume + ct;
    } catch (e) { return '원본 머리 · 치수 잼'; }
  }
  /* 다시 기른 머리에서 잰 값을 슬라이더에 넣고 그 상태를 기준으로 삼음 */
  G.applyBaseline = function () {
    // (옛 59) 컬 머리의 원본·제 머리 바탕 스타일을 거는 중/걸린 동안에는 58번을 건너뛰고 다시 기른 머리 그대로(FLOW_SPEC)
    if (typeof FLOW_SPEC !== 'undefined') return FLOW_SPEC._baseline(applyBaselineInner);
    return applyBaselineInner();
  };
  function applyBaselineInner() {
    // (옛 58) 다시 기른 가닥 대신 마네킹 위에 잰 스펙을 올려 보여 줌(아래 ORIG_MQ) — 못 올리면 이 본문
    if (typeof ORIG_MQ !== 'undefined') { var _om = ORIG_MQ._baseline(); if (_om !== undefined) return _om; }
    if (!G.on || mqOn()) return false;
    var photo = null; try { photo = state._hair3Dneutral; } catch (e) {}
    if (!photo) return false;
    if (G.base && G.base.src === photo) return true;                 // 이 머리에는 이미 넣었음(사용자가 움직인 값을 덮지 않음)
    var r = null; try { r = G.measure(); } catch (e) { console.warn(TAG + ' 치수 재기 실패', e); }
    var sty = null; try { sty = neutralStyling(); } catch (e) { sty = { sweep: 0, volume: 50, flow: 0, part: 0, partAmt: 0, finish: 50, sleek: 0 }; }
    if (r && r.spec && r.spec.styling) { sty.sweep = r.spec.styling.sweep; sty.volume = r.spec.styling.volume; }
    var curl0 = (r && r.spec && r.spec.perm && r.spec.perm.curl > 0) ? r.spec.perm.curl : 0;
    var rod0 = (curl0 > 0 && r && r.curl && r.curl.rodScale > 1) ? r.curl.rodScale : 1;
    var base = { rodScale: rod0, sections: {}, sty: { sweep: sty.sweep || 0, volume: typeof sty.volume === 'number' ? sty.volume : 50 }, src: photo, measured: r };
    try {
      secOrder().forEach(function (sec) {
        var d = {}; try { d = clone(SECTIONS[sec].defaults) || {}; } catch (e) {}
        d.curl = curl0;                                              // 사진에서 잰 컬(직모면 0 = 지금 결 그대로)
        if (curl0 > 0 && r && r.curl && typeof r.curl.wave === 'number') d.wave = r.curl.wave;   // 잰 컬 굵기
        state.sections[sec] = d;
        base.sections[sec] = { length: d.length, curl: curl0 };
      });
      state._globalCurl = curl0;
      var sbv = {}; (typeof ANGLES !== 'undefined' ? ANGLES : ['front', 'left', 'right', 'back']).forEach(function (a) { sbv[a] = Object.assign({}, sty); });
      state.stylingByView = sbv;
      try { if (typeof bindStylingToCurrentView === 'function') bindStylingToCurrentView(); } catch (e) {}
      // (2026-10-10l) 사용자: "페이드가 켜지면서 먹도록 해야 될 것 같아. 토글이 켜져야 페이드 조정이 되거든" — 사진에서 페이드를 잰 손님은 토글을 켜고 잰 높이·가드·테이퍼를 넣음(이어서 조정 가능) · 아니면 예전처럼 끔
      try {
        var fd = r && r.spec && r.spec.fade;
        if (state.fade) {
          if (G.fadeOn && fd && fd.enabled) { Object.assign(state.fade, { enabled: true, height: fd.height, guard: fd.guard, taper: fd.taper, blendWidth: fd.blendWidth }); base.fade = { height: fd.height }; }
          else state.fade.enabled = false;
        }
      } catch (e) {}
      try { state.specAppliedId = null; state._specUndo = null; if (typeof BRAID !== 'undefined') BRAID.on = false; } catch (e) {}
    } catch (e) { console.warn(TAG + ' 기준 값 넣기 실패', e); }
    G.base = base;
    rebuildPanel();
    setTag(r ? summary(r) : '원본 머리');
    if (r) console.log(G.measureLines(r).join('\n'));
    redraw();
    return true;
  }
  function atBase(sec, cur, sty) {
    var b = G.base; if (!b) return true;
    var bs = b.sections[sec] || {};
    return (cur.length === bs.length || typeof cur.length !== 'number') && (cur.curl || 0) === (bs.curl || 0) &&
      (sty.sweep || 0) === b.sty.sweep && (typeof sty.volume !== 'number' || sty.volume === b.sty.volume) &&
      !(sty.part) && !(sty.flow) && !(sty.sleek);
  }
  /* ── (2026-10-21i) 사진 윤곽 끝 자르기 — 가닥 배열을 그 자리에서 고침(정렬 바로 뒤) ── */
  G.trimTails = function (strands) {
    var st = { at: Date.now(), on: !!G.trimTail, strands: strands ? strands.length : 0, cut: 0, cutMid: 0, cutTail: 0, lenMed: 0, lenP90: 0, views: 0, ms: 0, why: '' };
    if (!G.trimTail || !strands || !strands.length) { st.why = G.trimTail ? '가닥 없음' : '꺼짐'; return st; }
    var PC = W.PHOTO_CHECK, core = PC && PC._core;
    if (!core || typeof PC._cams !== 'function' || typeof PC._env !== 'function') { st.why = '07b 없음'; return st; }
    var t0 = now(), cams = PC._cams(), env0 = PC._env();
    if (!cams || !cams.length || !env0) { st.why = '사진·두상 값 없음'; return st; }
    var env = core.mkEnv(env0), cfg = { cols: (PC.cols | 0) || 200 }, pcs = cams.map(function (c) { return core.prepCam(c, env, cfg, G.trimTolCm); }), o = [0, 0];
    var cmU = env.cm, outU = G.trimOutCm / cmU, tailU = G.trimTailCm / cmU, keep = Math.max(2, G.trimKeepPts | 0), lens = [];
    st.views = pcs.length;
    function outside(p) {
      for (var ci = 0; ci < pcs.length; ci++) {
        var pc = pcs[ci], R = pc.cam.R;
        if (R[6] * p.x + R[7] * (p.y - env.CY) + R[8] * p.z <= 0) continue;          // 이 사진을 마주 보는 쪽만(가려진 뒷머리는 판정 못 함)
        if (!core.project(pc.cam, env, p.x, p.y, p.z, o)) continue;
        var gx = Math.floor(o[0] / pc.cell), gy = Math.floor(o[1] / pc.cell);
        if (gx < 0 || gy < 0 || gx >= pc.gw || gy >= pc.gh) continue;
        if (!pc.MD[gy * pc.gw + gx]) return true;
      }
      return false;
    }
    for (var i = 0; i < strands.length; i++) {
      var e = strands[i], p = e && e.pts; if (!p || p.length <= keep + 1) continue;
      var m = p.length, cut = m, rs = -1, rl = 0, mid = false, k, qq, a;
      for (k = 1; k < m; k++) {
        if (outside(p[k])) {
          if (rs < 0) { rs = k; rl = 0; }
          qq = p[k - 1]; rl += Math.hypot(p[k].x - qq.x, p[k].y - qq.y, p[k].z - qq.z);
          if (rl >= outU) { cut = Math.max(keep, rs); mid = true; break; }
        } else rs = -1;
      }
      if (!mid && rs >= 0 && rl >= tailU) cut = Math.max(keep, rs);
      if (cut >= m) continue;
      var L = 0; for (k = cut; k < m; k++) L += Math.hypot(p[k].x - p[k - 1].x, p[k].y - p[k - 1].y, p[k].z - p[k - 1].z);
      for (a in e) if (a !== 'pts' && Array.isArray(e[a]) && e[a].length === m) e[a] = e[a].slice(0, cut);   // 점마다 붙은 값(색 등)도 같이
      e.pts = p.slice(0, cut);
      st.cut++; if (mid) st.cutMid++; else st.cutTail++; lens.push(L * cmU);
    }
    lens.sort(function (u, v) { return u - v; });
    if (lens.length) { st.lenMed = lens[lens.length >> 1]; st.lenP90 = lens[Math.floor(lens.length * 0.9)]; }
    st.ms = Math.round(now() - t0);
    return st;
  };
  /* ── (v7) 기른 뒤 결 정렬 ───────────────────────────────────────────────── */
  G.alignStrands = function (strands, CY, kMul) {
    // (옛 56) 먼저 뿌리 이웃 기준 연쇄 결·자리 맞춤(아래 NEIGHBOR_ALIGN) → 그 다음 이 v7 결 정렬
    if (typeof NEIGHBOR_ALIGN !== 'undefined') NEIGHBOR_ALIGN._before(strands, CY, kMul);
    var st = { on: !!G.align, strands: 0, segs: 0, rot: [], trimmed: 0, trimLen: 0, cells: 0, ms: 0, kMul: kMul == null ? 1 : kMul };
    if (!G.align || !strands || !strands.length) return st;
    if (kMul != null && !(kMul > 0.01)) { st.skipped = true; return st; }      // 곱슬머리 — 정렬 안 함
    var t0 = now(), cell = G.alignCell, OFFA = 512, SP = 1024, map = new Map(), cap = 8192, nC = 0;
    var SX = new Float32Array(cap), SY = new Float32Array(cap), SZ = new Float32Array(cap), CN = new Float32Array(cap), NS = new Uint16Array(cap), LAST = new Int32Array(cap).fill(-1);
    function grow() { var c2 = cap * 2, a; a = new Float32Array(c2); a.set(SX); SX = a; a = new Float32Array(c2); a.set(SY); SY = a; a = new Float32Array(c2); a.set(SZ); SZ = a;
      a = new Float32Array(c2); a.set(CN); CN = a; a = new Uint16Array(c2); a.set(NS); NS = a; a = new Int32Array(c2).fill(-1); a.set(LAST); LAST = a; cap = c2; }
    function keyOf(x, y, z) {
      var a = Math.floor(x / cell) + OFFA, b = Math.floor(y / cell) + OFFA, c = Math.floor(z / cell) + OFFA;
      if (a < 0 || b < 0 || c < 0 || a >= SP || b >= SP || c >= SP) return -1;
      return a + SP * (b + SP * c);
    }
    var si, i, p, n, k, idx, ux, uy, uz, len;
    var yCap = (isFinite(CY) ? CY : 0.15) + 0.3, reach = Math.max(0, G.alignReach | 0);
    /* 그 자리의 "이웃 결" 칸. 제 칸에 기준이 없으면(머리 겉면 밖으로 뜬 잔머리) 두상 쪽으로 alignReach칸까지 들어가며 찾음 */
    function consensusAt(x, y, z) {
      var h, kk, id, ml, tx, ty, tz, tl;
      for (h = 0; h <= reach; h++) {
        kk = keyOf(x, y, z);
        id = kk < 0 ? undefined : map.get(kk);
        if (id !== undefined && NS[id] >= G.alignMin) {
          ml = Math.sqrt(SX[id] * SX[id] + SY[id] * SY[id] + SZ[id] * SZ[id]);
          if (ml / CN[id] >= G.alignCoh) return id;
        }
        tx = -x; ty = Math.min(y, yCap) - y; tz = -z; tl = Math.sqrt(tx * tx + ty * ty + tz * tz);
        if (!(tl > 1e-6)) break;
        x += tx / tl * cell; y += ty / tl * cell; z += tz / tl * cell;
      }
      return -1;
    }
    // ① 칸마다 평균 방향·가닥 수
    for (si = 0; si < strands.length; si++) {
      p = strands[si].pts; n = p.length;
      for (i = 1; i < n; i++) {
        ux = p[i].x - p[i - 1].x; uy = p[i].y - p[i - 1].y; uz = p[i].z - p[i - 1].z; len = Math.sqrt(ux * ux + uy * uy + uz * uz);
        if (!(len > 1e-9)) continue;
        k = keyOf((p[i].x + p[i - 1].x) * 0.5, (p[i].y + p[i - 1].y) * 0.5, (p[i].z + p[i - 1].z) * 0.5); if (k < 0) continue;
        idx = map.get(k);
        if (idx === undefined) { if (nC >= cap) grow(); idx = nC++; map.set(k, idx); }
        SX[idx] += ux / len; SY[idx] += uy / len; SZ[idx] += uz / len; CN[idx]++;
        if (LAST[idx] !== si) { LAST[idx] = si; if (NS[idx] < 65535) NS[idx]++; }
      }
    }
    st.cells = nC;
    var cTol = Math.cos(G.alignTol * Math.PI / 180), cFull = Math.cos(G.alignFull * Math.PI / 180), cFlip = Math.cos(G.alignFlip * Math.PI / 180), K = G.alignK * (kMul == null ? 1 : Math.min(1, kMul));
    var U = new Float64Array(4 * 256), alone = new Uint8Array(256);
    // ② 벗어난 마디 돌리기 ③ 혼자 나간 꼬리
    for (si = 0; si < strands.length; si++) {
      var s = strands[si]; p = s.pts; n = p.length; if (n < 3) continue;
      if (U.length < n * 4) { U = new Float64Array(n * 4 + 128); alone = new Uint8Array(n + 32); }
      var changed = false, lo = n, hi = 0, last = n - 1, arcA = 0;
      for (i = 1; i < n; i++) {
        ux = p[i].x - p[i - 1].x; uy = p[i].y - p[i - 1].y; uz = p[i].z - p[i - 1].z; len = Math.sqrt(ux * ux + uy * uy + uz * uz);
        alone[i] = 0; arcA += len;
        if (len > 1e-9) {
          ux /= len; uy /= len; uz /= len;
          var mxm = (p[i].x + p[i - 1].x) * 0.5, mym = (p[i].y + p[i - 1].y) * 0.5, mzm = (p[i].z + p[i - 1].z) * 0.5;
          k = keyOf(mxm, mym, mzm);
          var own = k < 0 ? undefined : map.get(k);
          idx = consensusAt(mxm, mym, mzm);
          if (idx < 0) { if (own === undefined || NS[own] <= G.strayMax) alone[i] = 1; }
          if (idx >= 0) {
            {
              var mx = SX[idx], my = SY[idx], mz = SZ[idx], ml = Math.sqrt(mx * mx + my * my + mz * mz);
              {
                mx /= ml; my /= ml; mz /= ml;
                var dot = ux * mx + uy * my + uz * mz;
                if (dot < cTol && dot > cFlip) {
                  var tt = (cTol - dot) / Math.max(1e-6, cTol - cFull); if (tt > 1) tt = 1;
                  var w = K * tt * tt * (3 - 2 * tt);
                  if (arcA < G.alignRoot + G.alignRootFade) w *= arcA <= G.alignRoot ? 0 : (arcA - G.alignRoot) / G.alignRootFade;   // 뿌리에서 솟는 구간(뿌리 볼륨)은 그대로
                  var tx = ux + (mx - ux) * w, ty = uy + (my - uy) * w, tz = uz + (mz - uz) * w, tl = Math.sqrt(tx * tx + ty * ty + tz * tz);
                  if (tl > 1e-3 && w > 0.01) {
                    tx /= tl; ty /= tl; tz /= tl;
                    st.segs++; if (st.segs % 13 === 0) st.rot.push(Math.acos(Math.max(-1, Math.min(1, ux * tx + uy * ty + uz * tz))) * 180 / Math.PI);
                    ux = tx; uy = ty; uz = tz; changed = true; if (i < lo) lo = i; if (i > hi) hi = i;
                  }
                }
              }
            }
          }
        } else { ux = 0; uy = -1; uz = 0; len = 0; }
        U[i * 4] = ux; U[i * 4 + 1] = uy; U[i * 4 + 2] = uz; U[i * 4 + 3] = len;
      }
      // 꼬리: 끝에서부터 혼자인 마디가 이어진 길이
      var cut = n;
      if (G.strayTrim) {
        var run = 0; for (i = last; i >= 1 && alone[i]; i--) run++;
        if (run >= G.strayMinSeg && n - run + G.strayKeep >= 3) cut = n - run + G.strayKeep;
      }
      if (!changed && cut === n) continue;
      var out = new Array(cut), qx = p[0].x, qy = p[0].y, qz = p[0].z, s0 = Math.max(1, lo - 1), s1 = Math.min(last, hi + 1), ax, ay, az, al, i0, i1, L = 0;
      out[0] = p[0];
      for (i = 1; i < cut; i++) {
        ax = U[i * 4]; ay = U[i * 4 + 1]; az = U[i * 4 + 2];
        if (changed && i >= s0 && i <= s1) {                              // 바뀐 구간은 이웃 마디와 한 번 고르게
          i0 = i > 1 ? i - 1 : i; i1 = i < last ? i + 1 : i;
          ax = U[i0 * 4] + 2 * ax + U[i1 * 4]; ay = U[i0 * 4 + 1] + 2 * ay + U[i1 * 4 + 1]; az = U[i0 * 4 + 2] + 2 * az + U[i1 * 4 + 2];
          al = Math.sqrt(ax * ax + ay * ay + az * az);
          if (al > 1e-6) { ax /= al; ay /= al; az /= al; } else { ax = U[i * 4]; ay = U[i * 4 + 1]; az = U[i * 4 + 2]; }
        }
        len = U[i * 4 + 3]; L += len;
        qx += ax * len; qy += ay * len; qz += az * len;
        out[i] = { x: qx, y: qy, z: qz };
      }
      if (cut < n) { st.trimmed++; for (i = cut; i < n; i++) st.trimLen += U[i * 4 + 3]; }
      if (changed) st.strands++;
      try { if (p._rgKeep) out._rgKeep = true; } catch (e) {}
      s.pts = out;
      if (s.rg) { s.rg.L = L; s.rg.tipY = out[cut - 1].y; }
    }
    st.ms = now() - t0;
    return st;
  };

  /* 컬 c를 걸면 가닥이 차지하는 뼈대 길이 ÷ 가닥 길이 (14 curlStrand3D와 같은 식 — 로드 굵기와 무관) */
  function curlRemain(c) {
    var F = (typeof CURL3D_FIX !== 'undefined') ? CURL3D_FIX : { ampGamma: 1, radiusGamma: 0.5 };
    var a = Math.pow(Math.max(0, Math.min(100, c || 0)) / 100, F.ampGamma || 1), rr = Math.pow(a, F.radiusGamma || 1), h = 2.6 - 2.28 * a;
    return a > 0 ? h / Math.sqrt(rr * rr + h * h) : 1;
  }
  G.curlRemain = curlRemain;
  G.cmPerMaskPx = function (a) { try { return cmPerMaskPx(a); } catch (e) { return null; } };
  function scalePts(pts, k) { var o = new Array(pts.length), i, p; for (i = 0; i < pts.length; i++) { p = pts[i]; o[i] = { x: p.x * k, y: p.y * k, z: p.z * k }; } return o; }
  /* 끝 방향으로 점 하나를 덧대 호길이를 ratio배로 */
  function padArc(pts, ratio) {
    var n = pts.length; if (n < 2 || !(ratio > 1)) return pts;
    var L = 0, i; for (i = 1; i < n; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y, pts[i].z - pts[i - 1].z);
    var a = pts[n - 2], t = pts[n - 1], dx = t.x - a.x, dy = t.y - a.y, dz = t.z - a.z, dl = Math.hypot(dx, dy, dz);
    if (!(L > 1e-9) || !(dl > 1e-9)) return pts;
    var add = L * (ratio - 1) / dl, out = pts.slice();
    out.push({ x: t.x + dx * add, y: t.y + dy * add, z: t.z + dz * add });
    return out;
  }
  /* 다시 기른 가닥: 기준에서 움직인 만큼만 */
  function adjustRegrown(s, lenOverride, styOverride) {
    var b = G.base; if (!b || b.src !== state._hair3Dneutral) return s.pts;
    var cur = (state.sections && state.sections[s.sec]) || {};
    var sty = (styOverride !== undefined ? styOverride : uniformStyling()) || stylingForRoot(s.pts[0]) || {};
    if (typeof lenOverride === 'number') cur = Object.assign({}, cur, { length: lenOverride });
    var bs = b.sections[s.sec] || {}, g = s.pts, C0 = bs.curl || 0;
    if (atBase(s.sec, cur, sty) && !(C0 > 0)) return s.pts;            // 직모 기준 — 손대지 않음
    var r = sectionLengthRatio(s.sec, cur.length) / (sectionLengthRatio(s.sec, bs.length) || 1);
    // 가닥(s.pts)은 컬을 편 뼈대 — 컬은 지금 슬라이더 값을 그대로 겁니다(기준이 직모면 예전의 "더한 만큼"과 같음)
    var curl = Math.max(0, cur.curl || 0), keep = G.curlKeepShape && C0 > 0, total = r, cover = r;
    if (keep) {
      total = r / curlRemain(C0);                                     // 편 길이 ÷ 뼈대 길이 (잰 컬에서 겉모양 = 사진)
      var used = total * curlRemain(curl);                            // 컬을 건 뒤 뼈대를 차지하는 길이 ÷ 뼈대 길이
      cover = used > 1.0005 ? used : Math.min(1, total);              // 뼈대를 실제로 늘리거나 줄일 비율
    }
    if (Math.abs(cover - 1) > 1e-6) g = lengthStrand3D(g, cover);
    var sweep = Math.max(-100, Math.min(100, (sty.sweep || 0) - b.sty.sweep));
    var vol = Math.max(0, Math.min(100, 50 + ((typeof sty.volume === 'number' ? sty.volume : 50) - b.sty.volume)));
    var part = sty.part || 0, spine = false;
    try { spine = typeof STYLE_ORDER !== 'undefined' && !!STYLE_ORDER.spineFirst; } catch (e) {}
    if (spine) { g = partStrand3D(g, part, curl, sty.partAmt); g = sweepStrand3D(g, sweep * sweepCurlScale(curl), curl, part, sty.partAmt); }
    if (keep && total > cover * 1.0005) g = padArc(g, total / cover);    // 호길이만 편 길이에 맞춤(덧댄 구간은 나선이 쓰지 않음)
    var ks = (C0 > 0 && b.rodScale > 1 && curl > 0) ? b.rodScale : 1;   // 로드 최대보다 굵은 컬 — 가닥을 줄여서 걸고 다시 키움
    if (ks > 1) g = scalePts(g, 1 / ks);
    g = curlStrand3D(g, curl, (typeof cur.wave === 'number' ? cur.wave : 50) / 100, typeof cur.curlDir === 'number' ? cur.curlDir : 0);
    if (ks > 1) g = scalePts(g, ks);
    if (keep) { if (curl > C0) g = gravityDroop3D(g, curl - C0); }     // 잰 컬까지는 사진에 이미 처져 있음 — 더한 만큼만
    else if (curl > 0) g = gravityDroop3D(g, curl);
    if (!spine) { g = partStrand3D(g, part, curl, sty.partAmt); g = sweepStrand3D(g, sweep, curl, part, sty.partAmt); }
    g = volumeStrand3D(g, vol, s.sec);
    g = flowCurlStrand3D(g, sty.flow || 0);
    g = sleekStrand3D(g, typeof sty.sleek === 'number' ? sty.sleek : 0);
    return g;
  }
  /* adjustStrandGeom(17b) 맨 앞에서 부름 — 사진 가닥(REGROW.on일 때) */
  G._adjust = function (s, lenOverride, styOverride) {
    if (!s.regrown) return s.pts;                                    // 못 길렀을 때 — 사진 가닥을 손대지 않고 그대로
    try { return adjustRegrown(s, lenOverride, styOverride); } catch (e) { G.adjErr = String(e && e.message || e); return s.pts; }
  };

  G.refresh = function () {
    if (G.on && !(G.model && G.src === state._hair3Dneutral)) { G.build(); return; }
    // (2026-10-04e) 이미 기준이 들어 있으면 바뀐 것이 없음 — 캐시를 흔들지 않고 다시 그리기만(예전: 조정 화면에 들어올 때마다 전부 다시 계산)
    var same = false; try { same = !!(G.on && G.base && G.base.src === state._hair3Dneutral); } catch (e) {}
    if (G.on) G.applyBaseline();
    if (same) { try { if (typeof renderAdjustFrame === 'function') renderAdjustFrame(); } catch (e) {} }
    else redraw();
  };
  /* 마네킹 상태에 맞춤 — 마네킹 OFF면 다시 기르기 켬 */
  G.sync = function () {
    var want = !mqOn();
    if (want === G.on) { if (want) G.refresh(); return; }
    if (want) {
      G.on = true; G.failedFor = null;
      try { if (W.ORIG_ASIS && W.ORIG_ASIS.on) W.ORIG_ASIS.on = false; } catch (e) {}
      setTag('원본 머리');
      console.log(TAG + ' 마네킹 OFF — 다시 기른 원본 머리');
      G.refresh();
    } else { G.on = false; }
  };
  try { var mqb = document.getElementById('mannequinBtn'); if (mqb) mqb.title = 'ON: 마네킹 모드(컬·스타일링을 지운 상태에서 시작) · OFF: 사진에서 다시 기른 원본 머리(치수 잼)'; } catch (e) {}
  G.toggle = function () { try { if (typeof toggleMannequin === 'function') toggleMannequin(); } catch (e) {} };   // 예전 콘솔 명령 호환

  // 마네킹을 끌 때: 마네킹에서 쓰던 값을 기억 · 켤 때: 되돌림
  G._beforeToggleMq = function () {   // toggleMannequin(17a) 맨 앞 — 돌려준 값을 끝의 _afterToggleMq에 넘김
    var wasOn = mqOn();
    if (wasOn) {
      try { G.mqSnap = { sections: clone(state.sections), stylingByView: clone(state.stylingByView), fade: clone(state.fade), globalCurl: state._globalCurl, specId: state.specAppliedId || null }; } catch (e) { G.mqSnap = null; }
      G.base = null;                                                 // 다시 들어올 때 잰 값을 새로 넣음
    }
    return wasOn;
  };
  G._afterToggleMq = function (wasOn) { if (wasOn && !mqOn()) G.sync(); };
  G._beforeMqReset = function () {   // mannequinReset(17a) 맨 앞 — 돌려준 값을 끝의 _afterMqReset에 넘김
    var was = G.on, snap = G.mqSnap, inAdj = false;
    try { inAdj = currentScreen === 'adjust' && !state.pendingSpecId; } catch (e) {}
    if (!inAdj) snap = null;                                         // 스타일 화면에서 새 스타일을 고른 경우 — 예전 값을 되돌리지 않음
    G.on = false;
    if (was && snap) {
      try {
        state.sections = snap.sections;
        if (snap.fade && state.fade) Object.assign(state.fade, snap.fade);
        if (typeof snap.globalCurl === 'number') state._globalCurl = snap.globalCurl;
      } catch (e) {}
    }
    return { was: was, snap: snap };
  };
  G._afterMqReset = function (c) {
    var was = c.was, snap = c.snap;
    if (was) {
      G.mqSnap = null; G.base = null;
      try { setTag((state.selectedStyle && state.selectedStyle.name) || '스타일 미선택'); } catch (e) {}
      rebuildPanel();
      if (snap && snap.specId && typeof applyStyleSpecAndRender === 'function') {
        setTimeout(function () { try { if (mqOn() && !state.specAppliedId) applyStyleSpecAndRender(snap.specId); } catch (e) { console.warn(TAG + ' 스타일 다시 걸기 실패', e); } }, 60);
      }
    }
  };
  // 조정 화면에 들어올 때 — 마네킹이 꺼져 있으면(스타일을 안 골랐거나 껐으면) 바로 다시 기른 머리
  G._afterSetupAdjust = function (pending) {   // setupAdjustScreen(05) 끝 — pending은 들어올 때의 state.pendingSpecId
    if (!pending) setTimeout(function () { try { if (currentScreen === 'adjust') G.sync(); } catch (e) {} }, 0);
  };
  // 이 모드에서 [현재 모델을 스타일로 등록] = 잰 숫자로 등록(슬라이더를 안 움직였을 때)
  G._registerByMeasure = function () {   // registerCurrentAsStyle(06) 맨 앞 — true면 잰 숫자로 등록하고 끝
    if (G.on && !mqOn() && G.base && G.model && G.src === state._hair3Dneutral) {
      var moved = false;
      try {
        var sty = uniformStyling() || state.stylingByView[state.currentViewAngle] || {};
        secOrder().forEach(function (sec) { if (!atBase(sec, state.sections[sec] || {}, sty)) moved = true; });
      } catch (e) {}
      if (!moved) return true;
    }
    return false;
  };

  /* ────────────────────────────────────────────────────────────────────────
   * 스타일 숫자로 재기
   * ────────────────────────────────────────────────────────────────────── */
  function clampN(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* ── (v5) 컬 굵기: 결을 따라가며 방향 상관이 절반으로 떨어지는 거리 ─────────────────────────── */
  function curvStats(angle, coh, mask, Wd, Hd) {
    var minCoh = 0.2, dMax = 48, want = 4000, n = Wd * Hd, cnt = 0, i, d;
    for (i = 0; i < n; i++) if (mask[i] && coh[i] >= minCoh) cnt++;
    if (cnt < 200) return null;
    var stride = Math.max(1, Math.floor(cnt / want)), S = new Float64Array(dMax + 1), N = new Float64Array(dMax + 1), k = 0;
    for (i = 0; i < n; i++) {
      if (!mask[i] || coh[i] < minCoh) continue;
      if (k++ % stride) continue;
      var x0 = i % Wd, y0 = (i / Wd) | 0, t0 = angle[i], sg;
      for (sg = 1; sg >= -1; sg -= 2) {
        var x = x0 + 0.5, y = y0 + 0.5, ux = Math.cos(t0) * sg, uy = Math.sin(t0) * sg;
        for (d = 1; d <= dMax; d++) {
          x += ux; y += uy;
          var xi = x | 0, yi = y | 0; if (xi < 0 || yi < 0 || xi >= Wd || yi >= Hd) break;
          var j = yi * Wd + xi; if (!mask[j]) break;
          var t = angle[j], vx = Math.cos(t), vy = Math.sin(t);
          if (vx * ux + vy * uy < 0) { vx = -vx; vy = -vy; }
          ux = vx; uy = vy;
          if (coh[j] < minCoh) continue;
          S[d] += Math.cos(2 * (t - t0)); N[d]++;
        }
      }
    }
    if (!(N[1] > 50)) return null;
    var c1 = S[1] / N[1], dHalf = null, prev = c1;
    if (!(c1 > 0.2)) return { c1: c1, dHalf: null, n: N[1], flat: false };
    for (d = 2; d <= dMax; d++) {
      if (!(N[d] > 50)) break;
      var c = S[d] / N[d];
      if (c <= 0.5 * c1) { dHalf = (d - 1) + (prev - 0.5 * c1) / Math.max(1e-9, prev - c); break; }
      prev = c;
    }
    return { c1: c1, dHalf: dHalf, n: N[1], flat: dHalf == null };      // flat: 끝까지 가도 안 달라짐(거의 직선)
  }
  G.curvStats = curvStats;
  function curlAmp(angle, coh, mask, Wd, Hd) {      // (2026-10-10h) 사진 결을 따라 선을 그어 그 선이 옆으로 흔들리는 폭(진폭) = 컬 반경(px) · 흔들림 한 번 길이 = 한 바퀴 간격
    var minCoh = 0.2, Lh = 160, want = 1200, n = Wd * Hd, cnt = 0, i, k;
    for (i = 0; i < n; i++) if (mask[i] && coh[i] >= minCoh) cnt++;
    if (cnt < 300) return null;
    var stride = Math.max(1, Math.floor(cnt / want)), amps = [], lams = [], tried = 0, waved = 0, kk = 0;
    var PX = new Float64Array(2 * Lh + 1), PY = new Float64Array(2 * Lh + 1); var CX = new Float64Array(2 * Lh + 2), CY2 = new Float64Array(2 * Lh + 2);
    function trace(x0, y0, t0, sg, out, off) {      // 한쪽으로 따라감 → 몇 점 갔나
      var x = x0 + 0.5, y = y0 + 0.5, ux = Math.cos(t0) * sg, uy = Math.sin(t0) * sg, d;
      for (d = 1; d <= Lh; d++) {
        x += ux; y += uy;
        var xi = x | 0, yi = y | 0; if (xi < 0 || yi < 0 || xi >= Wd || yi >= Hd) return d - 1;
        var j = yi * Wd + xi; if (!mask[j] || coh[j] < minCoh * 0.5) return d - 1;
        var t = angle[j], vx = Math.cos(t), vy = Math.sin(t);
        if (vx * ux + vy * uy < 0) { vx = -vx; vy = -vy; }
        ux = 0.5 * ux + 0.5 * vx; uy = 0.5 * uy + 0.5 * vy; var ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
        out(off + sg * d, x, y);
      }
      return Lh;
    }
    function dev(a, b, Wn) {                          // 이동 평균 뼈대에서 벗어난 거리(부호) → [진폭, 파장, 부호 바뀜 수]
      var m = b - a + 1, h = Math.max(2, Wn >> 1), s, dv = [], sum = 0, ch = 0, prev = 0;
      for (s = a; s <= b; s++) { CX[s + 1] = CX[s] + PX[s]; CY2[s + 1] = CY2[s] + PY[s]; }
      for (s = a + h; s <= b - h; s++) {
        var mx = (CX[s + h + 1] - CX[s - h]) / (2 * h + 1), my = (CY2[s + h + 1] - CY2[s - h]) / (2 * h + 1);
        var tx = PX[Math.min(b, s + h)] - PX[Math.max(a, s - h)], ty = PY[Math.min(b, s + h)] - PY[Math.max(a, s - h)], tl = Math.hypot(tx, ty) || 1;
        var e = ((PX[s] - mx) * (-ty) + (PY[s] - my) * tx) / tl; dv.push(e);
      }
      if (dv.length < 20) return null;
      var mean = 0; dv.forEach(function (e) { mean += e; }); mean /= dv.length;
      dv.forEach(function (e) { e -= mean; sum += Math.abs(e); var sgn = e > 0 ? 1 : -1; if (prev && sgn !== prev) ch++; prev = sgn; });
      return [sum / dv.length * Math.PI / 2, ch > 0 ? 2 * dv.length / ch : 1e9, ch];
    }
    for (i = 0; i < n; i++) {
      if (!mask[i] || coh[i] < minCoh) continue;
      if (kk++ % stride) continue;
      var x0 = i % Wd, y0 = (i / Wd) | 0, t0 = angle[i];
      PX[Lh] = x0 + 0.5; PY[Lh] = y0 + 0.5;
      var put = function (idx, x, y) { PX[idx] = x; PY[idx] = y; };
      var f = trace(x0, y0, t0, 1, put, Lh), bk = trace(x0, y0, t0, -1, put, Lh);
      var a = Lh - bk, b = Lh + f; if (b - a < 50) continue;
      tried++;
      var r1 = dev(a, b, 40); if (!r1) continue;
      var Wn = Math.max(12, Math.min(120, Math.round(r1[1] || 40))), r2 = dev(a, b, Wn) || r1;
      if (r2[2] >= 3 && r2[0] >= 1.5) { waved++; amps.push(r2[0]); lams.push(r2[1]); }
    }
    if (tried < 50) return null;
    amps.sort(function (p, q) { return p - q; }); lams.sort(function (p, q) { return p - q; });
    var med = amps.length ? amps[amps.length >> 1] : 0, lam = lams.length ? lams[lams.length >> 1] : 0;
    return { ampPx: med, lamPx: lam, n: amps.length, tried: tried, wavy: waved / tried };
  }
  G.curlAmpFn = curlAmp;
  /* (2026-10-10k) 나선 측정 — 사진 속 곱슬은 가닥이 아니라 타래(나선)의 앞면만 보임 → 결 선은 반 바퀴마다 끊김.
     대신: 머리 영역 밝기의 자기상관(FFT)에서 축 방향 반복 = 한 바퀴 간격 P · 가닥이 축에서 기운 각의 봉우리 β(나선 앞면 가운데)
     → 나선 중심 반경 Rc = P·tanβ/2π · 타래 지름 ≈ 2·Rc·1.8. 실제 나선 타래를 비춰 그린 무늬(지름 12~40px · 간격 16~60px)에서 지름 오차 2~14% · 간격은 정확.
     직모(가닥이 축과 거의 직각으로 나옴 β>78°)·반복이 약하면 안 씀. */
// 나선 측정: 머리 영역 밝기의 자기상관(FFT)에서 한 바퀴 간격 P(축 방향 반복)와 가닥 기울기 β → 지름 D = P·tanβ/π
function hxFft(re,im,n,inv){for(let i=1,j=0;i<n;i++){let b=n>>1;for(;j&b;b>>=1)j^=b;j^=b;if(i<j){let t=re[i];re[i]=re[j];re[j]=t;t=im[i];im[i]=im[j];im[j]=t;}}
 for(let len=2;len<=n;len<<=1){const a=2*Math.PI/len*(inv?1:-1),wr=Math.cos(a),wi=Math.sin(a);for(let i=0;i<n;i+=len){let cr=1,ci=0;for(let j=0;j<len/2;j++){const ur=re[i+j],ui=im[i+j],vr=re[i+j+len/2]*cr-im[i+j+len/2]*ci,vi=re[i+j+len/2]*ci+im[i+j+len/2]*cr;re[i+j]=ur+vr;im[i+j]=ui+vi;re[i+j+len/2]=ur-vr;im[i+j+len/2]=ui-vi;const nr=cr*wr-ci*wi;ci=cr*wi+ci*wr;cr=nr;}}}
 if(inv)for(let i=0;i<n;i++){re[i]/=n;im[i]/=n;}}
function hxFft2(re,im,n,inv){const rr=new Float64Array(n),ri=new Float64Array(n);for(let y=0;y<n;y++){for(let x=0;x<n;x++){rr[x]=re[y*n+x];ri[x]=im[y*n+x];}hxFft(rr,ri,n,inv);for(let x=0;x<n;x++){re[y*n+x]=rr[x];im[y*n+x]=ri[x];}}
 for(let x=0;x<n;x++){for(let y=0;y<n;y++){rr[y]=re[y*n+x];ri[y]=im[y*n+x];}hxFft(rr,ri,n,inv);for(let y=0;y<n;y++){re[y*n+x]=rr[y];im[y*n+x]=ri[y];}}}
function helixMeasure(rgba,mask,W,H,angle,coh,opt){opt=opt||{};const n=opt.n||256;
 // 1) 밝기 · 머리 영역 안만 · 저주파 뺌
 const L=new Float32Array(W*H);for(let i=0;i<W*H;i++)L[i]=0.299*rgba[i*4]+0.587*rgba[i*4+1]+0.114*rgba[i*4+2];
 // 머리 영역의 중심에서 n×n(사진이 작으면 줄임)
 let sx=0,sy=0,c=0;for(let i=0;i<W*H;i++)if(mask[i]){sx+=i%W;sy+=(i/W)|0;c++;}if(c<2000)return null;const cx=Math.round(sx/c),cy=Math.round(sy/c);
 const re=new Float64Array(n*n),im=new Float64Array(n*n),wm=new Float64Array(n*n);let mean=0,mc=0;
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){const X=cx-n/2+x,Y=cy-n/2+y;if(X<0||Y<0||X>=W||Y>=H)continue;const i=Y*W+X;if(!mask[i])continue;mean+=L[i];mc++;}mean/=Math.max(1,mc);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){const X=cx-n/2+x,Y=cy-n/2+y;if(X<0||Y<0||X>=W||Y>=H)continue;const i=Y*W+X;if(!mask[i])continue;const hw=(0.5-0.5*Math.cos(2*Math.PI*x/n))*(0.5-0.5*Math.cos(2*Math.PI*y/n));re[y*n+x]=(L[i]-mean)*hw;wm[y*n+x]=hw;}
 // 2) 자기상관 = |FFT|² 역변환 (영역 모양 효과는 창 자기상관으로 나눔)
 hxFft2(re,im,n,false);for(let i=0;i<n*n;i++){re[i]=re[i]*re[i]+im[i]*im[i];im[i]=0;}hxFft2(re,im,n,true);
 const wr=Float64Array.from(wm),wi=new Float64Array(n*n);hxFft2(wr,wi,n,false);for(let i=0;i<n*n;i++){wr[i]=wr[i]*wr[i]+wi[i]*wi[i];wi[i]=0;}hxFft2(wr,wi,n,true);
 const A=(dx,dy)=>{const x=(dx+n)%n,y=(dy+n)%n,k=y*n+x;return wr[k]>1e-6*wr[0]?re[k]/wr[k]:0;};const A0=A(0,0);
 // 3) 가는 결 방향(β 재기용) — 사진 결의 중앙값(두 배 각)
 let ca=0,sa=0;for(let i=0;i<W*H;i+=3)if(mask[i]&&coh[i]>0.3){ca+=coh[i]*Math.cos(2*angle[i]);sa+=coh[i]*Math.sin(2*angle[i]);}const fine=0.5*Math.atan2(sa,ca);
 // 4) 중심을 뺀 가장 센 자기상관 봉우리 = 한 바퀴 옮김(P) — 반경 rmin..rmax에서
 const rmin=opt.rmin||6,rmax=opt.rmax||Math.min(110,n/2-4);let best=-1e18,bx=0,by=0;
 for(let dy=0;dy<=rmax;dy++)for(let dx=-rmax;dx<=rmax;dx++){const r=Math.hypot(dx,dy);if(r<rmin||r>rmax)continue;if(dy===0&&dx<0)continue;
  const v=A(dx,dy);if(v<=best)continue;// 봉우리인지(이웃보다 큼)
  let pk=true;for(let ey=-1;ey<=1&&pk;ey++)for(let ex=-1;ex<=1;ex++){if(!ex&&!ey)continue;if(A(dx+ex,dy+ey)>v){pk=false;break;}}if(pk){best=v;bx=dx;by=dy;}}
 const P=Math.hypot(bx,by),axis=Math.atan2(by,bx);
 // 가닥이 축에서 기운 각의 분포(또렷함 무게) — 가장 많은 각(봉우리) = 나선 앞면 가운데의 기울기
 const hb=new Float64Array(91);for(let i=0;i<W*H;i+=2){if(!mask[i]||!(coh[i]>0.3))continue;let d=Math.abs(((angle[i]-axis)%Math.PI+Math.PI)%Math.PI);if(d>Math.PI/2)d=Math.PI-d;hb[Math.min(90,Math.round(d*57.3))]+=coh[i];}
 const sm=new Float64Array(91);for(let k=0;k<=90;k++){let s2=0,w2=0;for(let j=-4;j<=4;j++){const q=k+j;if(q<0||q>90)continue;const ww=5-Math.abs(j);s2+=hb[q]*ww;w2+=ww;}sm[k]=s2/w2;}
 let bk=12;for(let k=12;k<=88;k++)if(sm[k]>sm[bk])bk=k;const beta=bk/57.3;
 const Rc=P*Math.tan(beta)/(2*Math.PI),D=2*Rc*(opt.tubeK||1.8);
 return {P,D,Rc,beta:beta*57.3,axis:axis*57.3,fine:fine*57.3,peak:best/A0,bx,by};}


  G.helixMeasureFn = helixMeasure;

  /* (2026-10-10m) 타래 조각 찾기 — 곱슬 사진에서 타래는 밝은 겉면과 그 사이 어두운 틈으로 갈림.
     머리 영역 안에서 둘레(17px)보다 밝은 부분을 이어진 조각으로 묶음 → 조각 하나 = 앞으로 드러난 타래의 반 바퀴(C·S자).
     실측(곱슬 여자분 사진 4장): 조각 57~95개 · 폭 중앙값 7~9px(≈1cm). 61번이 이 조각으로 3D 가닥을 한 타래로 묶음. */
  function clumpFind(px, mask, Wd, Hd) {
    var N = Wd * Hd, L = new Float32Array(N), T = new Float32Array(N), i, x, y, k;
    for (i = 0; i < N; i++) L[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
    for (var pass = 0; pass < 2; pass++) {                                   // [1 2 1] 두 번 = 살짝 흐림
      for (y = 0; y < Hd; y++) for (x = 0; x < Wd; x++) { k = y * Wd + x; T[k] = (L[k] * 2 + L[x > 0 ? k - 1 : k] + L[x < Wd - 1 ? k + 1 : k]) / 4; }
      for (y = 0; y < Hd; y++) for (x = 0; x < Wd; x++) { k = y * Wd + x; L[k] = (T[k] * 2 + T[y > 0 ? k - Wd : k] + T[y < Hd - 1 ? k + Wd : k]) / 4; }
    }
    var I = new Float64Array((Wd + 1) * (Hd + 1)), r = G.clumpWin >> 1;   // 적분 영상 → 둘레 평균
    for (y = 0; y < Hd; y++) { var row = 0; for (x = 0; x < Wd; x++) { row += L[y * Wd + x]; I[(y + 1) * (Wd + 1) + x + 1] = I[y * (Wd + 1) + x + 1] + row; } }
    var B = new Uint8Array(N);
    for (y = 0; y < Hd; y++) for (x = 0; x < Wd; x++) {
      k = y * Wd + x; if (!mask[k]) continue;
      var x0 = Math.max(0, x - r), x1 = Math.min(Wd, x + r + 1), y0 = Math.max(0, y - r), y1 = Math.min(Hd, y + r + 1);
      var m = (I[y1 * (Wd + 1) + x1] - I[y0 * (Wd + 1) + x1] - I[y1 * (Wd + 1) + x0] + I[y0 * (Wd + 1) + x0]) / ((x1 - x0) * (y1 - y0));
      if (L[k] > m + G.clumpLift) B[k] = 1;
    }
    var E2 = new Uint8Array(N);                                              // 열기(깎고 다시 키움) — 실오라기 연결 끊기
    for (y = 1; y < Hd - 1; y++) for (x = 1; x < Wd - 1; x++) { k = y * Wd + x; if (B[k] && B[k - 1] && B[k + 1] && B[k - Wd] && B[k + Wd]) E2[k] = 1; }
    for (i = 0; i < N; i++) B[i] = 0;
    for (y = 1; y < Hd - 1; y++) for (x = 1; x < Wd - 1; x++) { k = y * Wd + x; if (E2[k] || E2[k - 1] || E2[k + 1] || E2[k - Wd] || E2[k + Wd]) B[k] = 1; }
    var lab = new Int16Array(N), n = 0, st = [], ws = [], sizes = [], CLEN = [0], CW = [0];
    for (i = 0; i < N; i++) {
      if (!B[i] || lab[i]) continue;
      if (n >= 32000) break;
      n++; var comp = [i]; lab[i] = n; st.length = 0; st.push(i);
      while (st.length) { var c = st.pop(), cx = c % Wd; var nb = [cx > 0 ? c - 1 : -1, cx < Wd - 1 ? c + 1 : -1, c - Wd, c + Wd]; for (var j = 0; j < 4; j++) { var q = nb[j]; if (q < 0 || q >= N || !B[q] || lab[q]) continue; lab[q] = n; st.push(q); comp.push(q); } }
      if (comp.length < G.clumpMinPx) { comp.forEach(function (q2) { lab[q2] = -1; }); n--; continue; }
      var sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0; comp.forEach(function (q2) { var qx = q2 % Wd, qy = (q2 / Wd) | 0; sx += qx; sy += qy; sxx += qx * qx; syy += qy * qy; sxy += qx * qy; });
      var cn = comp.length, mx = sx / cn, my = sy / cn, a = sxx / cn - mx * mx, b2 = sxy / cn - mx * my, d = syy / cn - my * my, tr = a + d, det = a * d - b2 * b2, l2 = tr / 2 - Math.sqrt(Math.max(0, tr * tr / 4 - det));
      var l1 = tr - l2; ws.push(4 * Math.sqrt(Math.max(l2, 1e-6))); sizes.push(cn); CLEN[n] = 4 * Math.sqrt(Math.max(l1, 1e-6)); CW[n] = 4 * Math.sqrt(Math.max(l2, 1e-6));
    }
    for (i = 0; i < N; i++) if (lab[i] < 0) lab[i] = 0;
    ws.sort(function (p1, p2) { return p1 - p2; });
    return { lab: lab, n: n, W: Wd, H: Hd, wMed: ws.length ? ws[ws.length >> 1] : 0, len: Float32Array.from(CLEN), wid: Float32Array.from(CW) };
  }
  G.clumpFindFn = clumpFind;
  var CLUMPS = new WeakMap();                                               // 사진 분석값(identity) → 조각 지도(저장소에 안 들어가게 따로 둠)
  G.clumpsFor = function (angle) { try { var mi = state.hairMasks && state.hairMasks[angle], id = mi && mi.identity; return id ? (CLUMPS.get(id) || null) : null; } catch (e) { return null; } };

  /* 컬·타래 재기 — computeHairOrientationField(04) 끝에서 재 두고, measureViewHairIdentity(03a) 끝에서 그 뷰 값에 붙임 */
  (function () {
    var pend = null;
    G._resetPend = function () { pend = null; };   // extractHairMask(03b) 맨 앞
    G._afterOrientField = function (f, px, mask, Wd, Hd) {
      pend = null;
      try { if (f && f.angle && f.coherence) { var cs = curvStats(f.angle, f.coherence, mask, Wd, Hd); if (cs) { pend = { w: Wd, h: Hd, cs: cs }; if (G.curlAmp) { try { pend.amp = curlAmp(f.angle, f.coherence, mask, Wd, Hd); } catch (e2) {} }
            if (G.clumps && px && px.length === Wd * Hd * 4) { try { pend.clumps = clumpFind(px, mask, Wd, Hd); } catch (e4) {} }
            if (G.curlHelix && px && px.length === Wd * Hd * 4) { try { pend.helix = helixMeasure(px, mask, Wd, Hd, f.angle, f.coherence, { n: Math.min(Wd, Hd) >= 300 ? 256 : 128 }); } catch (e3) {} } } } } catch (e) { pend = null; }
      return f;
    };
    G._afterIdentity = function (id, a) {
      try {
        if (id && pend && a && pend.w === a.w && pend.h === a.h) { id.curlDHalf = pend.cs.dHalf; id.curlFlat = pend.cs.flat; id.curlC1 = pend.cs.c1; id.curlRn = pend.cs.n; if (pend.helix) { id.curlHelix = pend.helix; }
        if (pend.clumps) { CLUMPS.set(id, pend.clumps); id.curlClumpN = pend.clumps.n; id.curlClumpW = pend.clumps.wMed; try { console.log(TAG + ' 타래 조각 — ' + pend.clumps.n + '개 · 폭 중앙값 ' + pend.clumps.wMed.toFixed(1) + 'px(' + pend.clumps.W + '×' + pend.clumps.H + ')'); } catch (e5) {} }
        if (pend.amp) { id.curlAmpPx = pend.amp.ampPx; id.curlLamPx = pend.amp.lamPx; id.curlWavy = pend.amp.wavy; id.curlAmpN = pend.amp.n; } }
      } catch (e) {}
      pend = null;
      return id;
    };
  })();
  /* 뷰의 마스크 1px이 몇 cm인가(그 뷰의 카메라 배율) */
  function cmPerMaskPx(angle) {
    try {
      var photo = state._hair3Dneutral, probe = (photo && photo.occ && photo.occ.probe) || (state.hairOcc3D && state.hairOcc3D.probe);
      var cam = probe && probe.cams && probe.cams.filter(function (c) { return c.angle === angle; })[0];
      var mi = state.hairMasks && state.hairMasks[angle];
      if (!cam || !(cam.s > 0) || !mi) return null;
      var kx = (mi.maskW || mi.w) / (mi.w || mi.maskW || 1);
      return cam.s * (modelCmPerUnit() || 16.4) / (kx || 1);
    } catch (e) { return null; }
  }
  /* 사진의 결 꺾임 → 컬 값. 뷰마다 03a가 재 둔 curlDegPerPx의 중앙값 */
  G.photoCurl = function () {
    var out = photoCurlCore.apply(this, arguments);
    if (typeof PHOTO_CURL !== 'undefined') out = PHOTO_CURL._afterPhotoCurl(out);   // (옛 61) 사진에서 잰 반경 → 웨이브(아래 PHOTO_CURL)
    return out;
  };
  function photoCurlCore() {
    var views = [], vals = [];
    (typeof ANGLES !== 'undefined' ? ANGLES : ['front', 'left', 'right', 'back']).forEach(function (a) {
      var mi = state.hairMasks && state.hairMasks[a], id = mi && mi.identity;
      if (!id || id.curlDegPerPx == null || !isFinite(id.curlDegPerPx)) return;
      var ok = id.curlN > G.curlMinN;
      views.push({ a: a, v: id.curlDegPerPx, n: id.curlN || 0, ok: ok });
      if (ok) vals.push(id.curlDegPerPx);
    });
    if (!vals.length) return { value: 0, deg: null, views: views };
    vals.sort(function (x, y) { return x - y; });
    var deg = vals.length % 2 ? vals[(vals.length - 1) / 2] : (vals[vals.length / 2 - 1] + vals[vals.length / 2]) / 2;
    var v = Math.round(G.curlMax * clampN((deg - G.curlLo) / Math.max(1e-6, G.curlHi - G.curlLo), 0, 1));
    if (v < G.curlMin) v = 0;
    var out = { value: G.curl ? v : 0, raw: v, deg: deg, views: views, wave: 50, rodScale: 1, rCm: null, rViews: [], rNote: '' };
    // (v5) 컬 굵기
    try {
      var rs = [], flat = 0, seen = 0;
      (typeof ANGLES !== 'undefined' ? ANGLES : ['front', 'left', 'right', 'back']).forEach(function (a) {
        var mi = state.hairMasks && state.hairMasks[a], id = mi && mi.identity;
        if (!id || !(id.curlRn > 200) || (id.curlDHalf == null && !id.curlFlat)) return;
        seen++;
        if (id.curlFlat) { flat++; out.rViews.push({ a: a, flat: true }); return; }
        var cpp = cmPerMaskPx(a); if (!(cpp > 0)) { out.rViews.push({ a: a, dHalf: id.curlDHalf, noScale: true }); return; }
        var rpx = G.curlRk * (id.curlDHalf - G.curlR0), floor = !(rpx > G.curlRminPx), how = 'dHalf';
        // (2026-10-10h) 사진 결을 따라 그은 선의 흔들림 폭(진폭)으로 직접 잰 반경 — 흔들리는 선이 충분하면 이것을 씀
        var hx = id.curlHelix, hxOk = G.curlHelix && hx && hx.peak >= G.helixPeak && hx.beta >= G.helixBetaLo && hx.beta <= G.helixBetaHi && hx.P >= 6 && hx.D > 2;
        if (hxOk) { rpx = hx.D / 2; floor = false; how = 'helix'; }
        else if (G.curlAmp && id.curlAmpPx > 0 && id.curlWavy >= G.curlAmpWavy && id.curlAmpN >= 60) { rpx = id.curlAmpPx * G.curlAmpK; floor = false; how = 'amp'; }
        else if (floor) rpx = G.curlRminPx;
        out.rViews.push({ a: a, dHalf: id.curlDHalf, rpx: rpx, cm: rpx * cpp, floor: floor, how: how, pitchCm: hxOk ? hx.P * cpp : null, beta: hxOk ? hx.beta : null, hxPeak: hx ? hx.peak : null, wavy: id.curlWavy, lamCm: id.curlLamPx ? id.curlLamPx * cpp : null });
        rs.push(rpx * cpp);
      });
      if (!seen) out.rNote = '굵기를 잰 뷰가 없음(사진을 다시 분석하면 잽니다) — 웨이브 50';
      else if (!rs.length && flat) { out.rNote = '결이 끝까지 안 틀어짐(거의 직선) — 컬 0으로'; out.flatAll = true; if (flat === seen) { out.raw = 0; out.value = 0; } }
      else if (rs.length) {
        rs.sort(function (x, y) { return x - y; });
        out.rCm = rs.length % 2 ? rs[(rs.length - 1) / 2] : (rs[rs.length / 2 - 1] + rs[rs.length / 2]) / 2;
      } else out.rNote = '카메라 배율이 없어 cm로 못 바꿈 — 웨이브 50';
      // (2026-10-10o) 굵은 웨이브(물결 펌) — 결 꺾임(°/px)이 낮아 컬 0으로 잡히지만, 나선 측정이 큰 반복(한 바퀴 3~15cm)을 잡으면 웨이브로 봄
      try {
        var hv = out.rViews.filter(function (v) { return v.how === 'helix' && v.pitchCm >= G.waveHelixPitchLo && v.pitchCm <= G.waveHelixPitchHi && v.cm >= G.waveHelixRLo && (!(G.waveHelixRMaxK > 0) || v.cm <= G.waveHelixRMaxK * v.pitchCm); });   // (2026-10-12c) 반경이 한 바퀴 간격보다 큰 값은 웨이브가 아님(직모 정면 사진이 반경 8.3cm·간격 7.2cm로 통과해 컬 65가 들어갔음)
        if (G.waveFromHelix && out.value < G.waveFromHelixBelow && hv.length >= 1) {
          var ps = hv.map(function (v) { return v.pitchCm; }).sort(function (x, y) { return x - y; }), rr = hv.map(function (v) { return v.cm; }).sort(function (x, y) { return x - y; });
          var pm = ps[ps.length >> 1], rm = rr[rr.length >> 1];
          out.waveHelix = { pitchCm: pm, rCm: rm, views: hv.length, was: out.value };
          out.value = out.raw = Math.round(Math.max(G.waveCurlLo, Math.min(G.waveCurlHi, G.waveCurlLo + (G.waveCurlHi - G.waveCurlLo) * Math.min(1, rm / Math.max(0.5, pm) * 2))));
          out.rCm = rm; out.pitchCm = pm;
        }
      } catch (e) {}
      if (G.curlRadius && out.rCm > 0 && out.value > 0) {
        var cm = modelCmPerUnit() || 16.4, FX = (typeof CURL3D_FIX !== 'undefined') ? CURL3D_FIX : { ampGamma: 1, radiusGamma: 0.5 };
        var amp = Math.pow(out.value / 100, FX.ampGamma || 1), need = (out.rCm / cm) / Math.pow(amp, FX.radiusGamma || 1);   // 필요한 로드 반경(모델 단위)
        var rMin = (typeof CURL3D_R_MIN !== 'undefined') ? CURL3D_R_MIN : 0.02, rMax = (typeof CURL3D_R_MAX !== 'undefined') ? CURL3D_R_MAX : 0.07;
        out.wave = Math.round(clampN((need - rMin) / (rMax - rMin), 0, 1) * 100);
        out.rodScale = need > rMax ? Math.min(G.curlRodScaleMax, need / rMax) : 1;
        out.rodCm = need * cm;
      }
    } catch (e) { out.rNote = '굵기 재기 실패: ' + (e && e.message || e); }
    return out;
  }
  G.measure = function () {
    var m = G.model;
    if (!m || G.src !== state._hair3Dneutral || !m.strands || !m.strands.length) return null;
    var info = m.rgInfo || { isLong: false, skipY: {}, plantY: {} };
    var cm = 1; try { cm = modelCmPerUnit() || 1; } catch (e) {}
    var hr = null; try { hr = headHeightRef(); } catch (e) {}
    var order = (typeof SECTION_ORDER !== 'undefined') ? SECTION_ORDER : ['crown', 'front', 'temple', 'side', 'occipital', 'nape'];
    var by = {}; m.strands.forEach(function (s) { if (s.rg) (by[s.sec] || (by[s.sec] = [])).push(s); });
    var lenCm = {}, tipAt = {}, raw = {}, lenFallback = {}, cut = {};
    order.forEach(function (sec) {
      lenFallback[sec] = 50;
      try {
        var d = JSON.parse(JSON.stringify(SECTIONS[sec].defaults)); delete d.length; delete d.curl; delete d.wave; delete d.color; cut[sec] = d;
      } catch (e) { cut[sec] = {}; }
      var a = by[sec] || []; if (a.length < 8) return;
      raw[sec] = { n: a.length, growCm: q(a.map(function (s) { return s.rg.L * cm; }), 0.5), thickCm: q(a.map(function (s) { return s.rg.t * cm; }), 0.5),
        freePct: Math.round(a.filter(function (s) { return s.rg.free; }).length / a.length * 100) };
      // ④ 부피 재기 — 이 섹션 두께(머리 표면에서 뜬 정도), 끝쪽 퍼짐, 처짐
      try {
        var flare = [], drop = [];
        a.forEach(function (s) {
          var P = s.pts, n = P.length; if (n < 4) return;
          var mid = P[n >> 1], tip = P[n - 1], r0 = P[0];
          var rM = Math.sqrt(mid.x * mid.x + mid.z * mid.z), rT = Math.sqrt(tip.x * tip.x + tip.z * tip.z);
          flare.push((rT - rM) * cm);
          var L = s.rg.L || 1; drop.push(clampN((r0.y - tip.y) / L, -1, 1));
        });
        raw[sec].flareCm = flare.length ? +q(flare, 0.5).toFixed(2) : 0;
        raw[sec].drop = drop.length ? +q(drop, 0.5).toFixed(2) : 0;
      } catch (e) {}
      if (info.isLong) {
        if (hr) tipAt[sec] = +((hr.yTop - q(a.map(function (s) { return s.rg.tipY; }), 0.5)) / hr.H).toFixed(3);
      } else {
        lenCm[sec] = +q(a.map(function (s) {
          return (s.rg.free ? s.rg.L : Math.min(s.rg.L, Math.max(G.minLenCm / cm, G.liftK * s.rg.t))) * cm;
        }), 0.5).toFixed(1);
      }
    });
    // 뿌리 볼륨 · 넘김 · 가르마 — 윗머리에서
    var top = (by.crown || []).concat(by.front || []);
    var tTop = top.length ? q(top.map(function (s) { return s.rg.t * cm; }), 0.5) : 1.5;
    var volume = Math.round(clampN(35 + 10 * tTop, 20, 95));
    // ④ 섹션 부피 → volShare/volPoint/weight (SB.map 거꾸로 — 전체 volume이 윗머리 두께를 맡고, 섹션은 그 비율만)
    var K0 = { crown: 1, front: .85, temple: .7, side: .75, occipital: .85, nape: .5 };
    try { var vk = (CFG.VOLUME3D() || {}).secK; if (vk) K0 = vk; } catch (e) {}
    var kTop = ((K0.crown || 1) + (K0.front || 1)) / 2, volRaw = {};
    order.forEach(function (sec) {
      var R = raw[sec]; if (!R || !(tTop > 0)) return;
      var share = 50 * (R.thickCm / tTop) * kTop / (K0[sec] || 1);
      var point = 50 + 25 * (R.flareCm || 0);                 // 끝이 1cm 더 벌어지면 +25
      var weight = 50 + 50 * ((R.drop || 0) - 0.6) / 0.4;     // 끝이 곧게 처질수록 무거움
      volRaw[sec] = { volShare: Math.round(share), volPoint: Math.round(point), weight: Math.round(weight) };
      if (G.secVol === false) return;
      cut[sec].volShare = Math.round(clampN(share, 0, 100));
      cut[sec].volPoint = Math.round(clampN(point, 0, 100));
      cut[sec].weight = Math.round(clampN(weight, 0, 100));
    });
    var swSum = 0; top.forEach(function (s) { swSum += -s.rg.dz; });
    var sweep = top.length ? Math.round(clampN(100 * swSum / top.length, -100, 100)) : 0;
    var part = { x: 0, score: 0, lateral: 0 };
    try {
      var E = getScalpEllipsoid(), best = -1, bx = 0, k, x0, okW, totW, lat = 0;
      top.forEach(function (s) { lat += Math.abs(s.rg.dx); }); lat = top.length ? lat / top.length : 0;
      for (k = -6; k <= 6; k++) {
        x0 = k / 10 * E.a; okW = 0; totW = 0;
        top.forEach(function (s) {
          var w = Math.abs(s.rg.dx); totW += w;
          if ((s.pts[0].x - x0) * s.rg.dx > 0) okW += w;      // 가르마 바깥쪽으로 흐르는가
        });
        if (totW > 0 && okW / totW > best) { best = okW / totW; bx = k / 10; }
      }
      part = { x: bx, score: best, lateral: lat };
    } catch (e) {}
    // 페이드
    var low = ['side', 'nape', 'occipital', 'temple'], nSkip = 0, nPlant = 0, vs = [];
    low.forEach(function (sec) {
      var sk = info.skipY[sec] || [], pl = info.plantY[sec] || [], all = sk.concat(pl);
      nSkip += sk.length; nPlant += pl.length;
      if (!all.length) return;
      var lo = Math.min.apply(null, all), hi = Math.max.apply(null, all);
      if (!(hi > lo)) return;
      sk.forEach(function (y) { vs.push((y - lo) / (hi - lo)); });
    });
    var bareShare = nSkip + nPlant ? nSkip / (nSkip + nPlant) : 0;
    var fade = { enabled: false, guard: 1, height: 35, blendWidth: 40, disc: 0, taper: 0 };
    if (!info.isLong && bareShare > 0.12 && vs.length > 20) {
      fade = { enabled: true, guard: 1, height: Math.round(clampN(100 * q(vs, 0.8) + 10, 10, 95)), blendWidth: 40, disc: 0, taper: 60 };
    }
    var styling = {}; try { styling = neutralStyling(); } catch (e) { styling = { sweep: 0, volume: 50, flow: 0, part: 0, partAmt: 0, finish: 50, sleek: 0 }; }
    styling.sweep = sweep; styling.volume = volume;
    var pc = { value: 0, deg: null, views: [] }; try { pc = G.photoCurl(); } catch (e) {}
    var spec = { name: '', cut: cut, perm: { curl: pc.value, wave: pc.wave != null ? pc.wave : 50, rCm: pc.rCm > 0 ? +pc.rCm : null, pitchCm: (function () { try { var ps = (pc.rViews || []).filter(function (v) { return v.pitchCm > 0; }).map(function (v) { return v.pitchCm; }).sort(function (x, y) { return x - y; }); return ps.length ? (ps.length % 2 ? ps[ps.length >> 1] : (ps[ps.length / 2 - 1] + ps[ps.length / 2]) / 2) : (pc.pitchCm > 0 ? pc.pitchCm : null); } catch (e) { return null; } })() }, styling: styling, globalCurl: pc.value, fade: fade, lenFallback: lenFallback, version: 1, source: 'regrow' };
    if (info.isLong) spec.tipAt = tipAt; else spec.lenCm = lenCm;
    return { spec: spec, isLong: info.isLong, raw: raw, volRaw: volRaw, tTopCm: tTop, part: part, bareShare: bareShare, order: order, curl: pc };
  };
  G.measureLines = function (r) {
    r = r || G.measure();
    if (!r) return ['[스타일 숫자] 다시 기른 모델이 없습니다 — 마네킹을 끄면 원본 머리를 다시 기릅니다'];
    var sp = r.spec, L = ['[스타일 숫자] 다시 기른 머리에서 잰 값 (' + (r.isLong ? '긴 머리 — 끝 높이로 저장' : '짧은 머리 — 길이 cm로 저장') + ')'];
    if (r.isLong) {
      L.push('  끝 높이(정수리에서 두상 높이의 몇 배 아래 · 1.00 ≈ 턱): ' + r.order.filter(function (k) { return sp.tipAt[k] != null; }).map(function (k) { return k + ' ' + sp.tipAt[k].toFixed(2); }).join(' · '));
    } else {
      L.push('  길이 cm(어림 — 두께×' + G.liftK + ' 또는 기른 길이 중 짧은 쪽): ' + r.order.filter(function (k) { return sp.lenCm[k] != null; }).map(function (k) { return k + ' ' + sp.lenCm[k]; }).join(' · '));
    }
    L.push('  참고 — 섹션별 [기른 길이 cm / 뿌리 자리 두께 cm / 두피 밖으로 늘어진 가닥 %]: ' + r.order.filter(function (k) { return r.raw[k]; }).map(function (k) {
      return k + ' ' + n1(r.raw[k].growCm) + '/' + n1(r.raw[k].thickCm) + '/' + r.raw[k].freePct + '%'; }).join(' · '));
    if (r.volRaw) L.push('  섹션 부피 [volShare/volPoint/weight] (괄호 = 막대 0~100 밖이라 잘린 원래 값): ' + r.order.filter(function (k) { return r.volRaw[k]; }).map(function (k) {
      var c = sp.cut[k], v = r.volRaw[k], f = function (key) { return c[key] + (c[key] !== v[key] ? '(' + v[key] + ')' : ''); };
      return k + ' ' + f('volShare') + '/' + f('volPoint') + '/' + f('weight') + ' ←두께 ' + n1(r.raw[k].thickCm) + 'cm·끝퍼짐 ' + r.raw[k].flareCm + 'cm·처짐 ' + r.raw[k].drop; }).join(' · '));
    L.push('  페이드: ' + (sp.fade.enabled ? '켜짐 · 높이 ' + sp.fade.height + '% · 가드 ' + sp.fade.guard + ' · 테이퍼 ' + sp.fade.taper + '% (가드·테이퍼는 기본값)' : '꺼짐') +
      ' · 옆·뒤에서 사진에 머리가 없던 뿌리 ' + Math.round(r.bareShare * 100) + '%');
    L.push('  뿌리 볼륨 ' + sp.styling.volume + ' (윗머리 두께 ' + n1(r.tTopCm) + 'cm) · 넘김 ' + (sp.styling.sweep > 0 ? '+' : '') + sp.styling.sweep + ' (' + (sp.styling.sweep > 15 ? '뒤로' : sp.styling.sweep < -15 ? '앞으로' : '중립') + ')');
    L.push('  가르마(재기만 — 스펙에는 아직 안 넣음): 위치 ' + (r.part.x > 0 ? '+' : '') + r.part.x.toFixed(1) + ' (두상 반폭 대비, 모델 x축) · 양쪽으로 갈라지는 정도 ' + Math.round(r.part.score * 100) + '% · 옆으로 흐르는 세기 ' + r.part.lateral.toFixed(2));
    var pc = r.curl || { value: 0, deg: null, views: [] };
    L.push('  컬 ' + pc.value + (pc.deg == null ? ' — 결 꺾임을 잰 뷰가 없어 0' :
      ' ← 결 꺾임 ' + pc.deg.toFixed(2) + '°/px(뷰 중앙값) · ' + pc.views.map(function (v) { return v.a + ' ' + v.v.toFixed(2) + (v.ok ? '' : '(표본 ' + v.n + ' — 안 씀)'); }).join(' · ') +
      ' · 환산 ' + G.curlLo + '~' + G.curlHi + '°/px → 0~' + G.curlMax + ' (어림값 — 직모 사진에서 컬이 잡히면 curlLo를 올릴 것)' + (G.curl ? '' : ' · 꺼짐(REGROW.curl=false) — 켜면 ' + pc.raw)) +
      (pc.value > 0 ? ' · 편 길이 = 보이는 길이 × ' + (1 / curlRemain(pc.value)).toFixed(2) : '') + (pc.waveHelix ? ' · 굵은 웨이브로 봄(나선 측정 ' + pc.waveHelix.views + '장 · 한 바퀴 ' + pc.waveHelix.pitchCm.toFixed(1) + 'cm · 반경 ' + pc.waveHelix.rCm.toFixed(1) + 'cm · 예전 컬 ' + pc.waveHelix.was + ')' : ''));
    if (pc.rViews && (pc.rViews.length || pc.rNote)) L.push('  컬 굵기 ' + (pc.rCm > 0 ? '반경 ' + pc.rCm.toFixed(1) + 'cm(뷰 중앙값) → ' + (G.curlRadius ? '웨이브 ' + pc.wave +
      (pc.rodScale > 1 ? ' + 로드 ×' + pc.rodScale.toFixed(2) + '(다시 기른 가닥에만)' : '') + (pc.rodCm ? ' · 로드 반경 ' + pc.rodCm.toFixed(1) + 'cm' : '') : '꺼짐(REGROW.curlRadius=false) — 웨이브 50') : (pc.rNote || '못 잼')) +
      (pc.rViews.length ? ' · ' + pc.rViews.map(function (v) { return v.a + ' ' + (v.flat ? '직선' : v.noScale ? 'dHalf ' + v.dHalf.toFixed(1) + 'px(배율 없음)' : v.cm.toFixed(1) + 'cm(' + (v.how === 'helix' ? '나선 측정 · 한 바퀴 간격 ' + v.pitchCm.toFixed(1) + 'cm · 가닥 기울기 ' + Math.round(v.beta) + '° · 반복 세기 ' + v.hxPeak.toFixed(2) + ' · ' : '') + (v.how === 'amp' ? '결 선 흔들림 폭으로 잼 · 흔들리는 선 ' + Math.round((v.wavy || 0) * 100) + '%' + (v.lamCm ? ' · 한 바퀴 길이 ' + v.lamCm.toFixed(1) + 'cm' : '') + ' · ' : '') + 'dHalf ' + v.dHalf.toFixed(1) + 'px' + (v.floor ? ' — 하한, 이보다 잔 컬일 수 있음' : '') + ')'); }).join(' · ') : '') +
      ' · 식: 반경px = ' + G.curlRk + '×(dHalf−' + G.curlR0 + ') (어림)');
    return L;
  };
  G.register = function () {
    if (typeof DIALOG_LANG !== 'undefined') { var _dl = DIALOG_LANG._run(this, arguments, G.register); if (_dl !== DIALOG_LANG.PASS) return _dl; }   // (옛 62) 이름 묻는 창을 앱 언어로(06)
    var _fsReg = (typeof FLOW_SPEC !== 'undefined') ? FLOW_SPEC._regBegin() : null;   // (옛 59) 마네킹 없이 등록한 스타일 표시
    try {
    var r = G.measure();
    if (typeof SPEC_PASS !== 'undefined') r = SPEC_PASS._enrichForRegister(r);   // (옛 57) 컬 길이·로드 배수·가르마를 스펙에
    if (!r) { try { showToast('원본 머리를 아직 못 쟀어요 — 마네킹을 끄고 잠시 기다려 주세요'); } catch (e) {} return null; }
    var name = null; try { name = prompt((typeof tUI === 'function' ? tUI : function (x) { return x; })('이 스타일 이름을 입력하세요 (원본 머리에서 잰 숫자로 등록)'), ''); } catch (e) {}
    if (!name || !name.trim()) return null;
    name = name.trim();
    var id = 'custom-' + Date.now(), sections = {}, sbv = {};
    r.order.forEach(function (sec) { try { sections[sec] = Object.assign({}, SECTIONS[sec].defaults, { curl: r.spec.perm.curl }); } catch (e) {} });
    try { (typeof ANGLES !== 'undefined' ? ANGLES : []).forEach(function (a) { sbv[a] = Object.assign({}, r.spec.styling); }); } catch (e) {}
    r.spec.name = name;
    var color = '#2A1B12'; try { color = (state.hairMasks.front && state.hairMasks.front.avgColor) || color; } catch (e) {}
    var stl = { id: id, specId: id, spec: r.spec, name: name, tags: '원본에서 잼', isCustom: true, sections: sections, styling: Object.assign({}, r.spec.styling),
      stylingByView: sbv, globalCurl: r.spec.perm.curl, length: 50, curl: r.spec.perm.curl, volume: r.spec.styling.volume, colorHex: color };
    try {
      STYLES.push(stl);
      if (typeof saveCustomStylesToStorage === 'function') saveCustomStylesToStorage();
      if (typeof buildStyleGrid === 'function') buildStyleGrid();
      if (typeof showToast === 'function') showToast('스타일로 등록했어요: ' + name);
      console.log(TAG + ' 스타일 등록 "' + name + '"\n' + G.measureLines(r).join('\n'));
    } catch (e) { console.warn(TAG + ' 스타일 등록 실패', e); return null; }
    if (typeof SPEC_PASS !== 'undefined') SPEC_PASS._afterRegister(stl);   // (옛 57) 넘긴 값 기록
    return stl;
    } finally { if (typeof FLOW_SPEC !== 'undefined') FLOW_SPEC._regEnd(_fsReg); }
  };
  var mbox = null;
  G.showMeasure = function () {
    var r = G.measure(), text = G.measureLines(r).join('\n');
    console.log(text);
    try {
      var host = document.querySelector('#screen-adjust .adjust-preview'); if (!host) return;
      if (!mbox) {
        mbox = document.createElement('div');
        mbox.style.cssText = 'position:absolute;left:8px;right:8px;top:70px;bottom:56px;z-index:80;background:rgba(0,0,0,0.9);color:#0f0;font:11px/1.6 monospace;padding:8px;border-radius:6px;white-space:pre-wrap;overflow:auto;';
        host.appendChild(mbox);
      }
      mbox.textContent = '';
      var bar = document.createElement('div'); bar.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px;';
      var mk = function (label, fn) {
        var b = document.createElement('button'); b.type = 'button'; b.textContent = label;
        b.style.cssText = 'min-height:30px;padding:4px 12px;border-radius:8px;border:1px solid #0f0;background:#062a06;color:#0f0;font:600 12px monospace;';
        b.addEventListener('click', function (e) { e.stopPropagation(); fn(b); }); return b;
      };
      if (r) bar.appendChild(mk('이 숫자로 스타일 등록', function () { if (G.register()) mbox.style.display = 'none'; }));
      bar.appendChild(mk('복사', function (b) {
        try { navigator.clipboard.writeText(text).then(function () { b.textContent = '복사됨 ✓'; setTimeout(function () { b.textContent = '복사'; }, 1500); }, function () { b.textContent = '복사 실패'; }); } catch (e) { b.textContent = '복사 실패'; }
      }));
      bar.appendChild(mk('닫기', function () { mbox.style.display = 'none'; }));
      mbox.appendChild(bar); mbox.appendChild(document.createTextNode(text));
      mbox.style.display = 'block';
    } catch (e) {}
  };
  G.lines = function () {
    var s = G.stats, L = ['[다시 기르기] ' + (G.on ? '켜짐' : '꺼짐') + (G.building ? ' · 만드는 중' : '') + (G.model && G.src === state._hair3Dneutral ? ' · 모델 있음' : ' · 모델 없음') + (G.lastErr ? ' · ⚠ ' + G.lastErr : '')];
    if (!s) return L;
    var tot = s.n || 1, secs = Object.keys(s.sec).map(function (k) { return k + ' ' + Math.round(s.sec[k] / tot * 100) + '%'; }).join(' · ');
    L.push('  가닥 ' + s.n + '개(사진에 머리가 없어 안 심은 뿌리 ' + s.skipped + ') · ' + s.ms + 'ms' + (s.workMs != null ? '(걷기에 일한 시간 ' + s.workMs + ' · 마무리 ' + s.finMs + ' · 사이사이 쉰 시간 ' + Math.max(0, s.ms - s.workMs - s.finMs) + ' — ' + s.slices + '번 나눠 함)' : '') + (s.mShare < 1 ? ' · 재는 용도라 ' + (G.measureFull || []).join('·') + ' 밖은 ' + Math.round(s.mShare * 100) + '%만 기름(전부 REGROW.measureShare=1)' : '') + ' · 사진 ' + s.cams);
    L.push('  뿌리 분포 — ' + secs);
    L.push('  길이 ' + n1(s.lenMed) + '/' + n1(s.lenP90) + 'cm(중앙값/p90) · 꺾임 ' + n1(s.kinkMed) + '°/' + n1(s.kinkP90) + '° · 결을 사진에서 못 읽고 이어 간 걸음 ' + n1(s.estPct) + '%');
    L.push('  길이 상한(' + (s.isLong ? '긴 머리 — 넉넉히' : '짧은 머리 — 섹션 중앙값×' + G.lenMul) + ') cm: ' + s.capTxt);
    L.push('  멈춘 이유 — 결이 끊김 ' + (G.kinkStop ? (s.stopKink || 0) + '(' + G.kinkDeg + '°)' : '꺼짐(켜기 ?kink=1)') + ' · 같은 길을 두 번 돎 ' + (s.stopLoop || 0) + (G.loopStop ? '' : '(꺼짐 · 켜기 ?loopstop=1)') + ' · 머리 영역 밖 ' + s.stopMask + ' · 길이 상한 ' + s.stopCap + ' · 걸음 수 상한 ' + s.stopMax + ' · 두피 밖으로 나가 늘어뜨린 가닥 ' + s.free + (G.soloSideBelow ? ' · 두상 아래 사진 한 장의 누운 결이라 안 따른 걸음 ' + (s.soloSide || 0) + '(끄기 REGROW.soloSideBelow=false)' : '') + (G.noClimbCm > 0 ? ' · 두피 밖에서 다시 오르려던 가닥 ' + (s.noClimbN || 0) + '(걸음 ' + (s.noClimb || 0) + ' · 위 성분 지움 · 끄기 REGROW.noClimbCm=0)' : '') + ' · 반대로 기른 뿌리(아래쪽에 머리 없음 · 두께 ' + G.flipThickCm + 'cm 이상) ' + s.flipped + ' · 얇아서 안 뒤집은 뿌리 ' + (s.flipKept || 0) + '(그중 앞 헤어라인에서 옆으로 눕힌 ' + (s.flipSide || 0) + ' · 짧게 심은 ' + (s.stubN || 0) + (G.sideLayStay ? ' · 옆으로 눕힌 가닥을 두피 끝·섹션 길이에서 끝냄 ' + (s.sideEnd || 0) : '') + ')' + ' · 비탈 거꾸로 오르기 벌점 ' + G.polDown + (G.polThickHi > G.polThickLo ? '(뿌리 두께 ' + G.polThickLo + '~' + G.polThickHi + 'cm에서 풀림)' : '(두께로 안 풂)') + (G.glossSkip ? ' · 페이드(두께 없는 자리) 앞에서 멈춘 가닥 ' + (s.thinStop || 0) + ' · 광택 띠라 안 읽은 결 ' + (s.glossN || 0) + '(둘레와 같아 살린 것 ' + (s.glossKeep || 0) + ')' : ''));
    try { var pa = s.pa; if (pa) L.push('  사진끼리 머리 영역 맞추기(각도는 그대로 · 가운데·정수리 높이만 ±' + G.photoAlignMaxCm + 'cm): ' + (!pa.on ? '꺼짐(켜기 ?photoalign=1)' : pa.why ? pa.why : '기준 ' + pa.ref + ' · 다른 사진들로 깎은 덩어리가 설명하는 비율(사진 평균) ' + (pa.before * 100).toFixed(1) + '% → ' + (pa.after * 100).toFixed(1) + '% · 옮긴 사진: ' + (pa.moved.length ? pa.moved.join(' / ') : '없음') + ' · ' + pa.ms + 'ms (끄기 ?photoalign=0)')); } catch (e) {}
    try { var rk = s.rk; if (rk) L.push('  걸음 안 세 번 더 보기(RK4 · 0.4cm 걸음): ' + (rk.on ? '켜짐 — 걸음 ' + rk.n + ' · 곧은 결이라 한 번으로 끝낸 걸음 ' + (rk.skip || 0) + ' · 다시 본 자리 ' + rk.sub + ' · 결이 없어 앞 값을 쓴 자리 ' + rk.miss + ' (끄기 ?rk=0)' : '꺼짐(켜기 ?rk=1)') + ' · 관성 ' + G.inertia + ' · 중력 ' + G.gravity); } catch (e) {}
    L.push('  사진끼리 맞춰 보기: ' + (G.agree ? '켜짐(' + G.agreeDeg + '° · ' + G.agreeRatio + '배 · 갈피 없으면 ' + (G.agreeAmbig === 'skip' ? '관성' : '가장 믿을 만한 사진') + ') — 두 장 이상 읽은 걸음 ' + (s.agreeN || 0) + ' · 엇갈려 뺀 사진 ' + (s.agreeDrop || 0) + ' · 갈피를 못 잡아 관성으로 넘긴 걸음 ' + (s.agreeSkip || 0) + (W.SYNTH_PHOTO && W.SYNTH_PHOTO.on ? ' · 생성 사진 보정 걸림(33번)' : '') : '꺼짐(끄기 REGROW.agree=false)'));
    if (s.backFix) L.push('  뒷머리 앞쏠림 막기 — ' + (s.backFoldAfter ? '읽을 때는 안 막음 · 다 읽은 뒤 어깨 아래에서 뒤로 넘긴 가닥 ' + (s.foldN || 0) + '개(옮긴 점 ' + (s.foldPts || 0) + ' · 끄기 REGROW.backFoldAfter=false) · ' : '') + '뒤쪽에서 두피를 벗어난 가닥 ' + s.backN + '개(길이 중앙값 ' + n1(s.backLenMed) + 'cm) · 앞으로 가려던 걸음 ' + s.backFwd + '회 막음 · 뒤 사진 끝 높이까지 이어 간 걸음 ' + s.backKeep +
      (s.backTipN >= 20 ? ' · 뒤 사진 머리 끝 = 정수리에서 ' + n1(s.backTipCm) + 'cm 아래(가닥 ' + s.backTipN + '개 기준)' : ' · 뒤 사진 가닥이 적어(' + s.backTipN + ') 끝 높이 기준은 안 씀'));
    L.push('  곧게 늘어뜨리기(긴 머리 · 목 아래): ' + (!G.hangDown ? '꺼짐' : !s.isLong ? '짧은 머리라 안 씀' : !s.hang ? '끝 높이를 낼 사진 가닥이 모자라 안 씀' :
      '켜짐 — 곧게 내린 가닥 ' + s.hangN + '개(' + s.hangSteps + '걸음) · 끝 높이에서 멈춤 ' + s.stopTip + ' · 끝 높이 = 정수리에서 ' + n1(s.hangTipCm[0]) + '~' + n1(s.hangTipCm[1]) + 'cm 아래(' + s.hangSrc + '의 25~75%)'));
    L.push('  3D 머리 덩어리: ' + (s.vol ? s.vol.cm + 'cm 칸 ' + s.vol.n + '개 중 머리 ' + s.vol.inN + '개(좁은 덩어리 ' + (s.vol.tN != null ? s.vol.tN : '-') + ') · ' + s.vol.ms + 'ms (걷기·마네킹 위 컬이 같이 씀 · 끄기 REGROW.volume=false)' : '안 씀'));
    L.push('  뿌리 결 앞뒤: ' + (s.pol ? '또렷한 칸 ' + s.pol.sure + ' · 이웃 칸 따라 정한 칸 ' + s.pol.nbr + ' · 둘 다 아니라 가운데 선 바깥쪽으로 정한 가닥 ' + s.pol.mid + ' (끄기 REGROW.polNbr=false)' : '예전 규칙'));
    L.push('  누운 머리 길이(짧은 머리 · 두께×' + G.liftK + '에서 끝): ' + (G.onScalpLen ? (s.isLong ? '긴 머리라 안 씀' : '끝낸 가닥 ' + (s.lenThick || 0) + '개 (끄기 REGROW.onScalpLen=false)') : '꺼짐'));
    L.push('  두피 밖 3D 방향(사진 두 장 이상의 결로 깊이까지): ' + (G.tri3D ? '켜짐 — 그렇게 정한 걸음 ' + (s.triN || 0) + '회 (끄기 REGROW.tri3D=false)' : '꺼짐'));
    L.push('  껍질(사진 교집합): ' + (s.hullV ? s.hullV + ' 중 그 자리를 마주 보는 사진이 머리 영역에서 ' + G.hullMarginCm + '(정면)·' + G.hullMarginSideCm + '(옆·뒤)cm 넘게 밖이라 덩어리 밖인 걸음(덩어리를 쓰면 다른 이유로 밖인 것도 포함) ' + (s.hullN || 0) + '회 — 다른 사진이 머리라고 해도 멈춤 (예전: 다수결 · 끄기 REGROW.hullViews=[])' : '안 씀(다수결)'));
    L.push('  직모 뼈대(곱슬 사진 · 큰 흐름만 따라 기름 · 컬은 그 위에 얹음): ' + (s.straight ? '켜짐 — ' + s.straight + ' (끄기 REGROW.straightCurly=false)' : '안 씀'));
    if (s.wf) L.push('  읽은 굴곡 장(편 길에서 벗어난 만큼을 자리마다 모음): ' + s.wf.cellCm + 'cm 칸 ' + s.wf.n + '개 중 아는 칸 ' + s.wf.known + ' · 가닥 ' + s.wf.strands + '개(표본 ' + s.wf.samples + ') · 이웃과 같이 굽은 크기 중앙값 ' + (+s.wf.ampCm).toFixed(2) + 'cm / 위쪽 10% ' + (+s.wf.ampHiCm).toFixed(2) + 'cm · ' + s.wf.ms + 'ms (마네킹에 얹기 = 주소 끝에 ?rw=1 또는 PHOTO_CURL.readWave=true)');
    L.push('  결 정렬(기른 뒤): ' + (!s.align || !s.align.on ? '꺼짐' : s.align.skipped ? '곱슬머리라 안 함(잰 컬이 ' + G.alignCurlOff + ' 이상 · REGROW.alignCurlOff=0이면 컬과 무관하게 정렬)' : '켜짐' + (s.align.kMul < 0.999 ? '(컬이 있어 세기 ×' + s.align.kMul.toFixed(2) + ')' : '') + ' — 이웃 결에서 벗어나 돌린 가닥 ' + s.align.strands + '개(마디 ' + s.align.segs + '개 · 돌린 각 중앙값 ' + n1(s.align.rotMed) + '° / p90 ' + n1(s.align.rotP90) +
      '°) · 혼자 나간 꼬리 자름 ' + s.align.trimmed + '개(평균 ' + n1(s.align.trimCm) + 'cm) · 칸 ' + s.align.cells + ' · ' + s.align.ms + 'ms'));
    var tS = G.trimStat;
    if (tS && tS.err) L.push('  윤곽 끝 자르기 실패: ' + tS.err);
    else if (tS && tS.why) L.push('  윤곽 끝 자르기: ' + tS.why + (G.trimTail ? '' : ' (켜기 ?rgtrim=1)'));
    else if (tS) L.push('  윤곽 끝 자르기(정렬 뒤 · 마주 보는 사진 ' + tS.views + '장 · 여유 ' + G.trimTolCm + 'cm): 자른 가닥 ' + tS.cut + '/' + tS.strands + '(' + (tS.strands ? (tS.cut / tS.strands * 100).toFixed(1) : '0') + '%) — 밖으로 ' + G.trimOutCm + 'cm 넘게 나감 ' + tS.cutMid + ' · 밖에서 끝난 꼬리 ' + tS.cutTail + ' · 자른 길이 중앙값 ' + n1(tS.lenMed) + ' / p90 ' + n1(tS.lenP90) + 'cm · ' + tS.ms + 'ms (끄기 ?rgtrim=0)');
    L.push('  목: ' + (G.neck ? '켜짐 — 목 안으로 들어가려던 걸음 ' + (s.neckPush || 0) + '회 밖으로 밀어냄' : '꺼짐'));
    L.push('  두께(두피→머리 겉면) 중앙값 ' + n1(s.tMed) + 'cm · p90 ' + n1(s.tP90) + 'cm · 윤곽선으로 잰 칸 ' + s.tMeasured + ' · 이웃으로 메운 칸(추정) ' + s.tFilled + ' · 두께 0으로 잰 칸 ' + s.tZero + ' / 전체 ' + s.cells);
    return L;
  };
  /* (2026-10-04e) backFix로 뒤로 늘어뜨린 가닥은 조정 단계의 "사진 영역 밖 다듬기"를 건너뜀
     (그 다듬기는 앞·옆 사진까지 섞어 판정해서, 어깨 앞으로 머리를 넘긴 사진이면 목 뒤 가닥을 다시 잘라 냄) */
  G._skipTrim = function (opts) { return !!((G.backFix || G.hangDown) && opts && opts.srcPts && opts.srcPts._rgKeep); };   // trimStrandToOccupancy3D(13b) 맨 앞

  G._panelLines = function () {   // perfPanelLines(18) 끝
    var L = [];
    try { L = L.concat(G.lines()); } catch (e) {}
    try { if (G.on && G.model) L = L.concat(G.measureLines()); } catch (e) {}
    if (G.adjErr) L.push('[다시 기르기] ⚠ 조정 실패: ' + G.adjErr);
    return L;
  };

  console.log(TAG + ' 설치 — 마네킹 OFF = 다시 기른 원본 머리(+치수) · 마네킹 ON = 마네킹 모드. 콘솔: REGROW.lines().join("\\n") · REGROW.measureLines().join("\\n")' + (G.trace ? ' · 걸음 기록 켜짐(v20261012e — 내보내기에 실림 · 끄기 REGROW.trace=false)' : ' · 걸음 기록 꺼짐'));
  return G;
})();

/* ==========================================================================
 * NEIGHBOR_ALIGN (옛 56-neighbor-align.js) — 다시 기른 머리: 다 기른 뒤 "뿌리 이웃"을 기준으로 결 정렬 (v3 · 2026-10-07 연쇄로 다시 짬)
 *
 * 자리: 17b, REGROW 바로 뒤. REGROW.alignStrands 맨 앞에서 NEIGHBOR_ALIGN._before(…) · perfPanelLines(18) 끝 줄
 *
 * 왜 v3 (2026-10-07 · 사용자): "원본 다시 기르기 자체가 빗 기능 사용 이전에 이웃 결들이랑 나란히 정렬돼서 빗 기능이 필요 없어야 한다."
 *   "(이웃 자리에서 멀어서 · 거의 반대라서 건너뛰는 것은) 인근 뿌리 기준으로 하면 이유가 상쇄되잖아. 머리카락은 인근 마디가 같이 연결되어서
 *   연쇄적으로 움직여야 되는 거다." "100도 넘게 반대가 되는 경우는 컬을 적용한 경우 말고는 있을 수가 없다."
 *   v2 실측(2026-10-07 로그 · 직모 긴 머리 29,237가닥): 돌린 마디 32,199 · "이웃 자리에서 멀어" 그대로 둔 마디 22,332 · "거의 반대라" 그대로 둔 마디 14,729.
 *   v2는 방향·위치를 전부 "고치기 전 가닥"에서 한 번에 읽고 나서 가닥을 다시 이었습니다. 그래서
 *     · 위에서 한 번 벗어난 가닥은 그 아래 마디가 전부 "이웃 자리에서 멀다"로 빠졌고,
 *     · 허용 각 안에서 조금씩 벗어나 결과 나란한 채 떠 있는 가닥은 돌릴 마디가 하나도 없었고(방향만 봄),
 *     · 100° 넘게 반대인 마디는 길이와 상관없이 전부 그대로 뒀습니다.
 *
 * 무엇을 (42번이 가닥을 다 기른 직후 · v7 결 정렬 "앞"에 한 번 — 자리는 v2와 같음):
 *   기준(이웃) = v2 그대로: 뿌리가 가까운 가닥(뿌리 칸 cell ≈ 1.2cm · 옆 칸과 섞음)들이 "뿌리에서 같은 길이만큼 간 자리"에서
 *     어느 쪽으로 가는가(방향) · 뿌리에서 보아 어디에 있는가(자리) · 그 자리가 얼마나 퍼져 있는가(폭 — v3에서 더함).
 *   고치는 법 = 연쇄: 뿌리에서부터 한 마디씩 걸으며, 다음 마디는 "이미 고쳐서 이어 온 자리"에서 판정합니다.
 *     ① 방향 — 이웃 결에서 alignTol° 넘게 벗어난 마디를 이웃 결 쪽으로(alignFull° 이상은 alignK만큼). v2와 같은 식.
 *     ② 자리 — 이어 온 자리가 이웃들의 자리에서 "이웃이 원래 퍼진 폭"(posK × 퍼짐 · 최소 posMin + posGrow × 길이) 밖이면
 *        그 폭 안으로 들어올 때까지 마디를 이웃 자리 쪽으로 기울입니다(한 마디에 pullMax°까지 · 폭 안은 안 건드림 → 볼륨은 남음).
 *        결과 나란한 채 떠 있는 가닥이 여기서 붙습니다. 마디 길이는 그대로(방향만 틂).
 *        v2의 "이웃 자리에서 멀면 그대로 둠"은 없앴습니다 — 벗어나기 시작한 자리에서 바로잡으므로 그 아래가 멀어지지 않습니다.
 *     ③ 반대 마디(alignFlip° 넘게) — 연달아 반대인 구간의 길이로 가릅니다.
 *        짧은 구간(flipShort ≈ 2.5cm 이하 = 꺾였다 돌아오는 자리)은 이웃 결로 폅니다.
 *        긴 구간은 그대로 두고, 그 가닥은 거기서부터 끝까지 손대지 않습니다(다른 쪽으로 넘어간 머리로 봄).
 *   그대로 둔 것(42번 값을 읽음): 뿌리 보호(alignRoot까지 한 점도 안 옮김 · alignRootFade에 걸쳐 서서히) · alignTol/alignFull/alignK ·
 *     이웃 결집도 < alignCoh인 자리(가르마·가마)는 기준으로 안 씀 · 곱슬 세기(kMul — 0이면 아무것도 안 함) · 마디 길이 · 꼬리 자르기 없음.
 *
 * ⚠ 합성 머리로만 확인했습니다(실제 손님 사진으로는 못 돌려 봄). 진단 [이웃 결 정렬] 줄에 방향으로 돌린 마디 · 자리로 당긴 마디 ·
 *   편 꺾임 · 그대로 둔 긴 반대 구간 · "이웃 폭 밖에 있던 마디 전 → 후"가 찍힙니다. 전 → 후가 안 줄면 이 파일이 안 듣는 것입니다.
 *   v2 동작으로: NEIGHBOR_ALIGN.chain=false (그러면 flip·far 규칙도 v2 그대로)
 *
 * 끄기: NEIGHBOR_ALIGN.on=false 후 NEIGHBOR_ALIGN.rebuild() (값을 바꾼 뒤에도 rebuild — 머리를 다시 기릅니다)
 * ========================================================================== */
var NEIGHBOR_ALIGN = (function () {
  'use strict';
  var W = window, TAG = '[이웃 결 정렬]';
  var G = REGROW;

  var NB = Object.assign({
    on: true,
    cell: 0.07,          // 뿌리 이웃 칸(모델 단위 ≈ 1.2cm)
    bin: 0.03,           // 뿌리에서 잰 길이 칸(≈ 0.5cm)
    maxBins: 160,        // 길이 칸 상한(≈ 79cm) — 그보다 긴 구간은 마지막 칸으로
    minN: 6,             // 그 자리까지 자란 이웃이 이만큼은 돼야 기준으로 씀
    trim: 45,            // 도: 이웃 평균을 다시 낼 때 첫 평균에서 이 안쪽인 마디만 씀
    spreadK: 1.3,        // 이웃이 원래 벌어진 자리는 기준 각을 (퍼짐 × 이 값)까지 넓힘 · 0 = 안 넓힘
    nearMin: 0.06, nearK: 0.6,  // (v2만 씀) 뿌리 이웃들의 자리에서 (nearMin + nearK × 뿌리에서의 길이)보다 멀리 떨어진 마디는 안 건드림
    // ── v3(연쇄)
    chain: true,         // false = v2 동작 그대로
    posK: 1.5,           // 이웃 자리의 퍼짐 × 이 값까지는 제자리로 봄(볼륨을 남기는 폭) — 줄이면 더 붙고 납작해짐
    posMin: 0.03, posGrow: 0.02,   // 그 폭의 하한 = posMin + posGrow × 뿌리에서의 길이(모델 단위 · 0.03 ≈ 0.5cm)
    pullMax: 25,         // 도: 폭 밖의 마디를 이웃 자리 쪽으로 기울이는 상한(한 마디에) · 0 = 자리는 안 봄(방향만)
    flipShort: 0.14,     // 연달아 반대(alignFlip° 넘게)인 구간이 이 길이(≈ 2.5cm) 이하면 꺾임으로 보고 폄 · 더 길면 거기서부터 그대로
    // 돌리는 세기·각도·뿌리 보호·곱슬 처리는 REGROW(42번)의 alignK · alignTol · alignFull · alignFlip · alignCoh · alignRoot · alignRootFade를 그대로 읽습니다
  }, W.NEIGHBOR_ALIGN || {});
  var S = NB.stats = null;

  function now() { try { return performance.now(); } catch (e) { return Date.now(); } }
  function qv(a, f) { if (!a.length) return NaN; var b = a.slice().sort(function (x, y) { return x - y; }); return b[Math.min(b.length - 1, Math.floor(b.length * f))]; }
  function num(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : d; }

  var OFFA = 512, SP = 1024, WGT = [1, 0.6, 0.3, 0.15];
  function keyOf(p, cell) {
    var a = Math.floor(p.x / cell) + OFFA, b = Math.floor(p.y / cell) + OFFA, c = Math.floor(p.z / cell) + OFFA;
    if (a < 1 || b < 1 || c < 1 || a >= SP - 1 || b >= SP - 1 || c >= SP - 1) return -1;
    return a + SP * (b + SP * c);
  }

  /* ── v2(NEIGHBOR_ALIGN.chain=false일 때만 씀 · 손대지 않음) ──
     뿌리 칸 × 길이 칸마다 이웃들의 방향 합(x,y,z) · 마디 수 · 뿌리에서 본 마디 위치 합(x,y,z). own[si] = 그 가닥의 뿌리 칸 번호(-1 = 없음).
     ref가 있으면 그 평균에서 trim° 안쪽인 마디만 넣음 */
  function buildField2(strands, nb, ref, cTrim, coh) {
    var cell = NB.cell, bin = NB.bin, n = strands.length, map = new Map(), raw = [], keys = [], own = new Int32Array(n);
    var si, p, m, i, k, id, A, arc, ux, uy, uz, len, b, b0, b1, RF, rx, ry, rz, rn, rl;
    for (si = 0; si < n; si++) {
      own[si] = -1; p = strands[si] && strands[si].pts; if (!p || p.length < 2) continue;
      k = keyOf(p[0], cell); if (k < 0) continue;
      id = map.get(k);
      if (id === undefined) { id = raw.length; map.set(k, id); raw.push(new Float32Array(nb * 7)); keys.push(k); }
      own[si] = id; A = raw[id]; arc = 0; m = p.length;
      RF = ref ? ref.F[ref.own[si]] : null;
      for (i = 1; i < m; i++) {
        ux = p[i].x - p[i - 1].x; uy = p[i].y - p[i - 1].y; uz = p[i].z - p[i - 1].z; len = Math.sqrt(ux * ux + uy * uy + uz * uz);
        if (!(len > 1e-9)) continue;
        ux /= len; uy /= len; uz /= len;
        var ox = (p[i].x + p[i - 1].x) * 0.5 - p[0].x, oy = (p[i].y + p[i - 1].y) * 0.5 - p[0].y, oz = (p[i].z + p[i - 1].z) * 0.5 - p[0].z;
        b0 = Math.min(nb - 1, Math.floor(arc / bin)); arc += len; b1 = Math.min(nb - 1, Math.floor((arc - 1e-9) / bin));
        for (b = b0; b <= b1; b++) {                                            // 마디가 걸친 길이 칸마다
          if (RF) {
            rx = RF[b * 7]; ry = RF[b * 7 + 1]; rz = RF[b * 7 + 2]; rn = RF[b * 7 + 3]; rl = Math.sqrt(rx * rx + ry * ry + rz * rz);
            if (!(rn >= NB.minN) || !(rl / rn >= coh) || (ux * rx + uy * ry + uz * rz) / rl < cTrim) continue;
          }
          A[b * 7] += ux; A[b * 7 + 1] += uy; A[b * 7 + 2] += uz; A[b * 7 + 3] += 1; A[b * 7 + 4] += ox; A[b * 7 + 5] += oy; A[b * 7 + 6] += oz;
        }
      }
    }
    // 옆 칸과 섞음(칸 경계에서 기준이 뚝 바뀌지 않게)
    var out = new Array(raw.length), dx, dy, dz, j, w, B, R, t, L = nb * 7;
    for (id = 0; id < raw.length; id++) {
      B = new Float32Array(L); k = keys[id];
      for (dz = -1; dz <= 1; dz++) for (dy = -1; dy <= 1; dy++) for (dx = -1; dx <= 1; dx++) {
        j = map.get(k + dx + SP * (dy + SP * dz)); if (j === undefined) continue;
        w = WGT[Math.abs(dx) + Math.abs(dy) + Math.abs(dz)]; R = raw[j];
        for (t = 0; t < L; t++) if (R[t]) B[t] += w * R[t];
      }
      out[id] = B;
    }
    return { F: out, own: own, cells: raw.length };
  }
  /* 칸별 기준 — M[칸][길이 칸 × 9] = 이웃 방향(x,y,z) · cos(tol) · cos(full) · 쓸 수 있나(0/1) · 뿌리에서 본 이웃들의 평균 위치(x,y,z) */
  function consensus2(strands, nb, P) {
    var f0 = buildField2(strands, nb, null, 0, P.coh), f1 = buildField2(strands, nb, f0, Math.cos(NB.trim * Math.PI / 180), P.coh);
    var M = new Array(f0.F.length), id, b, A, B, R, sx, sy, sz, cn, ml, n0, l0, R1, sig, tol, wid = P.full - P.tol;
    for (id = 0; id < f0.F.length; id++) {
      A = f0.F[id]; B = f1.F[id]; R = M[id] = new Float32Array(nb * 9);
      for (b = 0; b < nb; b++) {
        n0 = A[b * 7 + 3]; if (!(n0 >= NB.minN)) continue;
        l0 = Math.sqrt(A[b * 7] * A[b * 7] + A[b * 7 + 1] * A[b * 7 + 1] + A[b * 7 + 2] * A[b * 7 + 2]);
        if (!(l0 / n0 >= P.coh)) continue;                                     // 이웃이 갈림(가르마·가마)
        sx = B[b * 7]; sy = B[b * 7 + 1]; sz = B[b * 7 + 2]; cn = B[b * 7 + 3]; ml = Math.sqrt(sx * sx + sy * sy + sz * sz);
        if (!(cn >= NB.minN) || !(cn >= 0.5 * n0) || !(ml > 1e-6)) continue;   // 평균 둘레에 모인 마디가 절반도 안 됨
        R1 = Math.min(1, ml / cn); sig = Math.sqrt(Math.max(0, -2 * Math.log(Math.max(1e-6, R1)))) * 180 / Math.PI;   // 이웃 퍼짐(도)
        tol = Math.max(P.tol, (NB.spreadK > 0 ? NB.spreadK : 0) * sig);
        R[b * 9] = sx / ml; R[b * 9 + 1] = sy / ml; R[b * 9 + 2] = sz / ml;
        R[b * 9 + 3] = Math.cos(Math.min(170, tol) * Math.PI / 180); R[b * 9 + 4] = Math.cos(Math.min(175, tol + wid) * Math.PI / 180);
        R[b * 9 + 5] = 1;
        R[b * 9 + 6] = B[b * 7 + 4] / cn; R[b * 9 + 7] = B[b * 7 + 5] / cn; R[b * 9 + 8] = B[b * 7 + 6] / cn;
      }
    }
    return { M: M, own: f0.own, cells: f0.cells };
  }

  /* strands를 그 자리에서 고침. kMul = 42번이 넘겨주는 정렬 세기(1 = 직모 · 0 = 곱슬) — v7과 같은 뜻 */
  NB.runV2 = function (strands, CY, kMul) {
    var st = { on: !!NB.on, skipped: '', n: strands ? strands.length : 0, strands: 0, segs: 0, rot: [], kept: 0, flipKept: 0, farKept: 0, pushed: 0, cells: 0, kMul: kMul == null ? 1 : kMul, root: 0, ms: 0 };
    if (!NB.on || !strands || !strands.length) return st;
    if (!G.align) { st.skipped = 'REGROW.align=false'; return st; }
    if (kMul != null && !(kMul > 0.01)) { st.skipped = '곱슬 — 정렬 안 함(42번 alignCurlOff)'; return st; }
    var t0 = now();
    var tolD = num(G.alignTol, 12), fullD = num(G.alignFull, 40), flipD = num(G.alignFlip, 100);
    if (!(fullD > tolD + 1)) fullD = tolD + 1;
    var K = num(G.alignK, 0.75) * (kMul == null ? 1 : Math.min(1, kMul));
    var rootKeep = Math.max(0, num(G.alignRoot, 0.15)), rootFade = Math.max(0, num(G.alignRootFade, 0.1));
    var cFlip = Math.cos(flipD * Math.PI / 180);
    var P = { tol: tolD, full: fullD, coh: num(G.alignCoh, 0.6) };
    st.root = rootKeep;
    var Es = null; try { Es = getScalpEllipsoid(); } catch (e) { Es = null; }
    if (!Es || !(Es.a > 0) || !(Es.b > 0) || !(Es.c > 0)) Es = null;
    if (!isFinite(CY)) CY = 0.15;
    // 길이 칸 수
    var maxArc = 0, si, p, i, a, n = strands.length;
    for (si = 0; si < n; si++) { p = strands[si] && strands[si].pts; if (!p) continue; a = 0; for (i = 1; i < p.length; i++) a += Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y, p[i].z - p[i - 1].z); if (a > maxArc) maxArc = a; }
    var nb = Math.max(4, Math.min(NB.maxBins | 0, Math.floor(maxArc / NB.bin) + 2)), bin = NB.bin;
    var fld = consensus2(strands, nb, P); st.cells = fld.cells;
    var U = new Float64Array(4 * 256), WR = new Float32Array(256);
    for (si = 0; si < n; si++) {
      if (fld.own[si] < 0) continue;
      var s = strands[si]; p = s.pts; var m = p.length; if (m < 3) continue;
      if (U.length < m * 4) { U = new Float64Array(m * 4 + 128); WR = new Float32Array(m + 32); }
      var B = fld.M[fld.own[si]], arc = 0, lo = m, hi = 0, last = m - 1;
      for (i = 1; i < m; i++) {
        var ux = p[i].x - p[i - 1].x, uy = p[i].y - p[i - 1].y, uz = p[i].z - p[i - 1].z, len = Math.sqrt(ux * ux + uy * uy + uz * uz), wr = 0;
        if (len > 1e-9) {
          ux /= len; uy /= len; uz /= len;
          var b = Math.min(nb - 1, Math.floor((arc + len * 0.5) / bin)); arc += len;
          // 뿌리 보호 — v7과 같은 식(뿌리에서 이 마디 끝까지의 길이로 잼)
          wr = arc <= rootKeep ? 0 : (arc < rootKeep + rootFade ? (arc - rootKeep) / rootFade : 1);
          if (wr > 0 && B[b * 9 + 5]) {
            var mx = B[b * 9], my = B[b * 9 + 1], mz = B[b * 9 + 2], cTol = B[b * 9 + 3], cFull = B[b * 9 + 4];
            var dot = ux * mx + uy * my + uz * mz;
            var ex = (p[i].x + p[i - 1].x) * 0.5 - p[0].x - B[b * 9 + 6], ey = (p[i].y + p[i - 1].y) * 0.5 - p[0].y - B[b * 9 + 7], ez = (p[i].z + p[i - 1].z) * 0.5 - p[0].z - B[b * 9 + 8];
            var gate = NB.nearMin + NB.nearK * arc;
            if (dot <= cFlip) st.flipKept++;                                    // 거의 반대 — 그대로 둠
            else if (ex * ex + ey * ey + ez * ez > gate * gate) st.farKept++;   // 이웃들 자리에서 이미 멀리 떨어짐 — 그대로 둠
            else if (dot < cTol) {
              var tt = (cTol - dot) / Math.max(1e-6, cTol - cFull); if (tt > 1) tt = 1;
              var w = K * tt * tt * (3 - 2 * tt) * wr;
              var tx = ux + (mx - ux) * w, ty = uy + (my - uy) * w, tz = uz + (mz - uz) * w, tl = Math.sqrt(tx * tx + ty * ty + tz * tz);
              if (tl > 1e-3 && w > 0.01) {
                tx /= tl; ty /= tl; tz /= tl;
                st.segs++; if (st.segs % 13 === 0) st.rot.push(Math.acos(Math.max(-1, Math.min(1, ux * tx + uy * ty + uz * tz))) * 180 / Math.PI);
                ux = tx; uy = ty; uz = tz; if (i < lo) lo = i; if (i > hi) hi = i;
              }
            }
          }
        } else { ux = 0; uy = -1; uz = 0; len = 0; }
        U[i * 4] = ux; U[i * 4 + 1] = uy; U[i * 4 + 2] = uz; U[i * 4 + 3] = len; WR[i] = wr;
      }
      if (lo >= m) continue;                                                   // 돌린 마디 없음 — 가닥을 그대로 둠
      // 첫 바뀐 마디 앞의 점은 같은 점 그대로(뿌리 보호 구간은 전부 여기 들어감)
      var out = new Array(m), x = p[lo - 1].x, y = p[lo - 1].y, z = p[lo - 1].z, s1 = Math.min(last, hi + 1), ax, ay, az, al, i1, L = 0, q, q2;
      for (i = 0; i < lo; i++) out[i] = p[i];
      st.kept += lo;
      for (i = lo; i < m; i++) {
        ax = U[i * 4]; ay = U[i * 4 + 1]; az = U[i * 4 + 2];
        if (i <= s1 && WR[i] >= 1) {                                           // 바뀐 구간은 이웃 마디와 한 번 고르게 — 뿌리 보호(서서히 구간 포함) 밖에서만
          i1 = i < last ? i + 1 : i;
          ax = U[(i - 1) * 4] + 2 * ax + U[i1 * 4]; ay = U[(i - 1) * 4 + 1] + 2 * ay + U[i1 * 4 + 1]; az = U[(i - 1) * 4 + 2] + 2 * az + U[i1 * 4 + 2];
          al = Math.sqrt(ax * ax + ay * ay + az * az);
          if (al > 1e-6) { ax /= al; ay /= al; az /= al; } else { ax = U[i * 4]; ay = U[i * 4 + 1]; az = U[i * 4 + 2]; }
        }
        len = U[i * 4 + 3];
        x += ax * len; y += ay * len; z += az * len;
        q = { x: x, y: y, z: z };
        if (Es) {                                                              // 옮긴 점이 두상 안으로 들어가면 — 두피를 타고 가게(마디 길이 그대로)
          try {
            q2 = ellipsoidPushOut(q, Es.a, Es.b, Es.c, CY);
            if (q2 !== q) {
              var gx = q2.x / (Es.a * Es.a), gy = (q2.y - CY) / (Es.b * Es.b), gz = q2.z / (Es.c * Es.c), gl = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1, gd = (ax * gx + ay * gy + az * gz) / gl;
              if (gd < 0) {
                var hx = ax - gd * gx / gl, hy = ay - gd * gy / gl, hz = az - gd * gz / gl, hl = Math.sqrt(hx * hx + hy * hy + hz * hz);
                if (hl > 1e-4) { q = { x: x - ax * len + hx / hl * len, y: y - ay * len + hy / hl * len, z: z - az * len + hz / hl * len }; q2 = ellipsoidPushOut(q, Es.a, Es.b, Es.c, CY); }
              }
              q = q2; x = q.x; y = q.y; z = q.z; st.pushed++;
            }
          } catch (e) {}
        }
        out[i] = q;
      }
      for (i = 1; i < m; i++) L += Math.hypot(out[i].x - out[i - 1].x, out[i].y - out[i - 1].y, out[i].z - out[i - 1].z);
      st.strands++;
      try { if (p._rgKeep) out._rgKeep = true; } catch (e) {}
      s.pts = out;
      if (s.rg) { s.rg.L = L; s.rg.tipY = out[m - 1].y; }                      // v7과 같이 길이·끝 높이만 고침(뿌리 쪽 방향 값은 안 바뀜)
    }
    st.ms = now() - t0;
    return st;
  };

  /* ---------------------------------------------------------------------------------------------------------------
   * v3 — 연쇄 정렬
   * 칸 표: 뿌리 칸 × 길이 칸마다 13값 = 방향 합(x,y,z) · 마디 수 · 뿌리에서 본 자리 합(x,y,z) · 자리 2차 합(xx,yy,zz,xy,xz,yz)
   * ------------------------------------------------------------------------------------------------------------- */
  var RAWN = 13, MN = 10;
  function buildField3(strands, nb, ref, cTrim, coh) {
    var cell = NB.cell, bin = NB.bin, n = strands.length, map = new Map(), raw = [], keys = [], own = new Int32Array(n);
    var si, p, m, i, k, id, A, arc, ux, uy, uz, len, b, b0, b1, RF, rx, ry, rz, rn, rl, ox, oy, oz, o;
    for (si = 0; si < n; si++) {
      own[si] = -1; p = strands[si] && strands[si].pts; if (!p || p.length < 2) continue;
      k = keyOf(p[0], cell); if (k < 0) continue;
      id = map.get(k);
      if (id === undefined) { id = raw.length; map.set(k, id); raw.push(new Float32Array(nb * RAWN)); keys.push(k); }
      own[si] = id; A = raw[id]; arc = 0; m = p.length;
      RF = ref ? ref.F[ref.own[si]] : null;
      for (i = 1; i < m; i++) {
        ux = p[i].x - p[i - 1].x; uy = p[i].y - p[i - 1].y; uz = p[i].z - p[i - 1].z; len = Math.sqrt(ux * ux + uy * uy + uz * uz);
        if (!(len > 1e-9)) continue;
        ux /= len; uy /= len; uz /= len;
        ox = (p[i].x + p[i - 1].x) * 0.5 - p[0].x; oy = (p[i].y + p[i - 1].y) * 0.5 - p[0].y; oz = (p[i].z + p[i - 1].z) * 0.5 - p[0].z;
        b0 = Math.min(nb - 1, Math.floor(arc / bin)); arc += len; b1 = Math.min(nb - 1, Math.floor((arc - 1e-9) / bin));
        for (b = b0; b <= b1; b++) {
          if (RF) {
            o = b * RAWN; rx = RF[o]; ry = RF[o + 1]; rz = RF[o + 2]; rn = RF[o + 3]; rl = Math.sqrt(rx * rx + ry * ry + rz * rz);
            if (!(rn >= NB.minN) || !(rl / rn >= coh) || (ux * rx + uy * ry + uz * rz) / rl < cTrim) continue;
          }
          o = b * RAWN;
          A[o] += ux; A[o + 1] += uy; A[o + 2] += uz; A[o + 3] += 1; A[o + 4] += ox; A[o + 5] += oy; A[o + 6] += oz; A[o + 7] += ox * ox; A[o + 8] += oy * oy; A[o + 9] += oz * oz; A[o + 10] += ox * oy; A[o + 11] += ox * oz; A[o + 12] += oy * oz;
        }
      }
    }
    var out = new Array(raw.length), dx, dy, dz, j, w, B, R, t, L = nb * RAWN;
    for (id = 0; id < raw.length; id++) {
      B = new Float32Array(L); k = keys[id];
      for (dz = -1; dz <= 1; dz++) for (dy = -1; dy <= 1; dy++) for (dx = -1; dx <= 1; dx++) {
        j = map.get(k + dx + SP * (dy + SP * dz)); if (j === undefined) continue;
        w = WGT[Math.abs(dx) + Math.abs(dy) + Math.abs(dz)]; R = raw[j];
        for (t = 0; t < L; t++) if (R[t]) B[t] += w * R[t];
      }
      out[id] = B;
    }
    return { F: out, own: own, cells: raw.length };
  }
  /* 칸별 기준 — M[칸][길이 칸 × 10] = 이웃 방향(x,y,z) · cos(tol) · cos(full) · 쓸 수 있나 · 이웃 평균 자리(x,y,z) · 허용 폭(반지름) */
  function consensus3(strands, nb, P) {
    var f0 = buildField3(strands, nb, null, 0, P.coh), f1 = buildField3(strands, nb, f0, Math.cos(NB.trim * Math.PI / 180), P.coh);
    var M = new Array(f0.F.length), id, b, A, B, R, sx, sy, sz, cn, ml, n0, l0, R1, sig, tol, wid = P.full - P.tol, o, q, px, py, pz, v, lx, rad;
    for (id = 0; id < f0.F.length; id++) {
      A = f0.F[id]; B = f1.F[id]; R = M[id] = new Float32Array(nb * MN);
      for (b = 0; b < nb; b++) {
        o = b * RAWN; q = b * MN;
        n0 = A[o + 3]; if (!(n0 >= NB.minN)) continue;
        l0 = Math.sqrt(A[o] * A[o] + A[o + 1] * A[o + 1] + A[o + 2] * A[o + 2]);
        if (!(l0 / n0 >= P.coh)) continue;                                     // 이웃이 갈림(가르마·가마)
        sx = B[o]; sy = B[o + 1]; sz = B[o + 2]; cn = B[o + 3]; ml = Math.sqrt(sx * sx + sy * sy + sz * sz);
        if (!(cn >= NB.minN) || !(cn >= 0.5 * n0) || !(ml > 1e-6)) continue;
        R1 = Math.min(1, ml / cn); sig = Math.sqrt(Math.max(0, -2 * Math.log(Math.max(1e-6, R1)))) * 180 / Math.PI;
        tol = Math.max(P.tol, (NB.spreadK > 0 ? NB.spreadK : 0) * sig);
        R[q] = sx / ml; R[q + 1] = sy / ml; R[q + 2] = sz / ml;
        R[q + 3] = Math.cos(Math.min(170, tol) * Math.PI / 180); R[q + 4] = Math.cos(Math.min(175, tol + wid) * Math.PI / 180);
        R[q + 5] = 1;
        px = B[o + 4] / cn; py = B[o + 5] / cn; pz = B[o + 6] / cn;
        R[q + 6] = px; R[q + 7] = py; R[q + 8] = pz;
        // 이웃 자리의 퍼짐 — 결에 수직인 쪽만(결 방향으로 앞뒤 차이는 길이 차이지 뜬 것이 아님): 공분산 C에서 tr(C) − mᵀCm
        var mx = R[q], my = R[q + 1], mz = R[q + 2];
        var cxx = B[o + 7] / cn - px * px, cyy = B[o + 8] / cn - py * py, czz = B[o + 9] / cn - pz * pz, cxy = B[o + 10] / cn - px * py, cxz = B[o + 11] / cn - px * pz, cyz = B[o + 12] / cn - py * pz;
        v = cxx + cyy + czz - (mx * mx * cxx + my * my * cyy + mz * mz * czz + 2 * (mx * my * cxy + mx * mz * cxz + my * mz * cyz));
        lx = v > 0 ? Math.sqrt(v) : 0;
        rad = Math.max(NB.posMin + NB.posGrow * (b + 0.5) * NB.bin, NB.posK * lx);
        R[q + 9] = rad;
      }
    }
    return { M: M, own: f0.own, cells: f0.cells };
  }

  NB.runV3 = function (strands, CY, kMul) {
    var st = { v: 3, on: !!NB.on, skipped: '', n: strands ? strands.length : 0, strands: 0, segs: 0, pull: 0, rot: [], kept: 0, kinkRuns: 0, kinkSegs: 0, longRuns: 0, longSegs: 0,
      outBefore: 0, outAfter: 0, seen: 0, pushed: 0, cells: 0, kMul: kMul == null ? 1 : kMul, root: 0, ms: 0 };
    if (!NB.on || !strands || !strands.length) return st;
    if (!G.align) { st.skipped = 'REGROW.align=false'; return st; }
    if (kMul != null && !(kMul > 0.01)) { st.skipped = '곱슬 — 정렬 안 함(42번 alignCurlOff)'; return st; }
    var t0 = now();
    var tolD = num(G.alignTol, 12), fullD = num(G.alignFull, 40), flipD = num(G.alignFlip, 100);
    if (!(fullD > tolD + 1)) fullD = tolD + 1;
    var kc = (kMul == null ? 1 : Math.min(1, kMul)), K = num(G.alignK, 0.75) * kc;
    var rootKeep = Math.max(0, num(G.alignRoot, 0.15)), rootFade = Math.max(0, num(G.alignRootFade, 0.1));
    var cFlip = Math.cos(flipD * Math.PI / 180), tanMax = Math.tan(Math.max(0, Math.min(60, NB.pullMax)) * Math.PI / 180) * kc;
    var P = { tol: tolD, full: fullD, coh: num(G.alignCoh, 0.6) };
    st.root = rootKeep;
    var Es = null; try { Es = getScalpEllipsoid(); } catch (e) { Es = null; }
    if (!Es || !(Es.a > 0) || !(Es.b > 0) || !(Es.c > 0)) Es = null;
    if (!isFinite(CY)) CY = 0.15;
    var maxArc = 0, si, p, i, a, n = strands.length;
    for (si = 0; si < n; si++) { p = strands[si] && strands[si].pts; if (!p) continue; a = 0; for (i = 1; i < p.length; i++) a += Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y, p[i].z - p[i - 1].z); if (a > maxArc) maxArc = a; }
    var nb = Math.max(4, Math.min(NB.maxBins | 0, Math.floor(maxArc / NB.bin) + 2)), bin = NB.bin;
    var fld = consensus3(strands, nb, P); st.cells = fld.cells;
    var U = new Float64Array(4 * 256), WR = new Float32Array(256), BI = new Int32Array(256), DT = new Float32Array(256), FL = new Uint8Array(256);

    for (si = 0; si < n; si++) {
      if (fld.own[si] < 0) continue;
      var s = strands[si]; p = s.pts; var m = p.length; if (m < 3) continue;
      if (U.length < m * 4) { U = new Float64Array(m * 4 + 128); WR = new Float32Array(m + 32); BI = new Int32Array(m + 32); DT = new Float32Array(m + 32); FL = new Uint8Array(m + 32); }
      var B = fld.M[fld.own[si]], arc = 0, last = m - 1, ux, uy, uz, len, wr, b, q;
      // ── 1) 원래 마디: 방향 · 길이 · 뿌리 보호 세기 · 길이 칸 · 이웃 결과의 내적
      for (i = 1; i < m; i++) {
        ux = p[i].x - p[i - 1].x; uy = p[i].y - p[i - 1].y; uz = p[i].z - p[i - 1].z; len = Math.sqrt(ux * ux + uy * uy + uz * uz); wr = 0; b = -1; FL[i] = 0; DT[i] = 1;
        if (len > 1e-9) {
          ux /= len; uy /= len; uz /= len;
          b = Math.min(nb - 1, Math.floor((arc + len * 0.5) / bin)); arc += len;
          wr = arc <= rootKeep ? 0 : (arc < rootKeep + rootFade ? (arc - rootKeep) / rootFade : 1);
          if (!B[b * MN + 5]) b = -1; else DT[i] = ux * B[b * MN] + uy * B[b * MN + 1] + uz * B[b * MN + 2];
        } else { ux = 0; uy = -1; uz = 0; len = 0; }
        U[i * 4] = ux; U[i * 4 + 1] = uy; U[i * 4 + 2] = uz; U[i * 4 + 3] = len; WR[i] = wr; BI[i] = b;
      }
      // ── 2) 반대 구간 가르기: 연달아 alignFlip° 넘게 반대인 마디 — 짧으면 1(폄) · 길면 2(거기서부터 끝까지 그대로)
      var stopAt = m, r0, rl, j;
      for (i = 1; i < m; i++) {
        if (!(WR[i] > 0) || BI[i] < 0 || !(DT[i] <= cFlip)) continue;
        r0 = i; rl = 0;
        while (i < m && WR[i] > 0 && (BI[i] < 0 || DT[i] <= cFlip)) { rl += U[i * 4 + 3]; i++; }   // 기준 없는 마디(BI < 0)는 구간을 끊지 않음
        while (i > r0 + 1 && BI[i - 1] < 0 && i < m) { i--; rl -= U[i * 4 + 3]; }                  // 다만 구간 끝에 붙은 기준 없는 마디는 뺌(가닥 끝까지 간 경우는 둠)
        if (rl <= NB.flipShort) { for (j = r0; j < i; j++) if (BI[j] >= 0) FL[j] = 1; st.kinkRuns++; st.kinkSegs += i - r0; }
        else { st.longRuns++; st.longSegs += i - r0; stopAt = r0; break; }
        i--;                                                                    // for의 i++와 맞춤
      }
      // ── 3) 연쇄: 뿌리에서부터, 이미 고쳐 이어 온 자리(x,y,z)에서 판정
      var x = p[0].x, y = p[0].y, z = p[0].z, lo = m, hi = 0, pdx = 0, pdy = -1, pdz = 0, R0x = p[0].x, R0y = p[0].y, R0z = p[0].z;
      var mx, my, mz, dot, tt, w, tx, ty, tz, tl, ex, ey, ez, el, em, rad, over, tn, cap, changed, ox0, oy0, oz0;
      for (i = 1; i < m; i++) {
        ux = U[i * 4]; uy = U[i * 4 + 1]; uz = U[i * 4 + 2]; len = U[i * 4 + 3]; wr = WR[i]; b = BI[i]; changed = false;
        if (wr > 0 && b >= 0 && len > 0) {
          q = b * MN; mx = B[q]; my = B[q + 1]; mz = B[q + 2]; rad = B[q + 9];
          // 진단: 고치기 전 이 마디가 이웃 폭 밖이었나
          ox0 = (p[i].x + p[i - 1].x) * 0.5 - R0x - B[q + 6]; oy0 = (p[i].y + p[i - 1].y) * 0.5 - R0y - B[q + 7]; oz0 = (p[i].z + p[i - 1].z) * 0.5 - R0z - B[q + 8];
          em = ox0 * mx + oy0 * my + oz0 * mz; ox0 -= em * mx; oy0 -= em * my; oz0 -= em * mz;
          st.seen++; if (ox0 * ox0 + oy0 * oy0 + oz0 * oz0 > rad * rad) st.outBefore++;
          if (i < stopAt) {
            dot = DT[i];
            if (FL[i]) {                                                        // 짧은 꺾임 — 이웃 결로 폄(지나온 방향과 섞어 뚝 꺾이지 않게)
              w = wr * kc; tx = pdx * (1 - w) + mx * w; ty = pdy * (1 - w) + my * w; tz = pdz * (1 - w) + mz * w; tl = Math.sqrt(tx * tx + ty * ty + tz * tz);
              if (tl > 1e-3) { ux = tx / tl; uy = ty / tl; uz = tz / tl; changed = true; }
            } else if (dot < B[q + 3]) {                                        // ① 방향
              tt = (B[q + 3] - dot) / Math.max(1e-6, B[q + 3] - B[q + 4]); if (tt > 1) tt = 1;
              w = K * tt * tt * (3 - 2 * tt) * wr;
              tx = ux + (mx - ux) * w; ty = uy + (my - uy) * w; tz = uz + (mz - uz) * w; tl = Math.sqrt(tx * tx + ty * ty + tz * tz);
              if (tl > 1e-3 && w > 0.01) {
                tx /= tl; ty /= tl; tz /= tl;
                st.segs++; if (st.segs % 13 === 0) st.rot.push(Math.acos(Math.max(-1, Math.min(1, ux * tx + uy * ty + uz * tz))) * 180 / Math.PI);
                ux = tx; uy = ty; uz = tz; changed = true;
              }
            }
            // ② 자리 — 이 마디를 이대로 놓았을 때의 가운데가 이웃 폭 밖이면 이웃 자리 쪽으로 기울임
            if (tanMax > 0) {
              ex = x + ux * len * 0.5 - R0x - B[q + 6]; ey = y + uy * len * 0.5 - R0y - B[q + 7]; ez = z + uz * len * 0.5 - R0z - B[q + 8];
              em = ex * mx + ey * my + ez * mz; ex -= em * mx; ey -= em * my; ez -= em * mz;   // 결 방향 성분은 뺌(앞뒤로 밀린 것은 길이 차이지 뜬 것이 아님)
              el = Math.sqrt(ex * ex + ey * ey + ez * ez);
              if (el > rad && el > 1e-6) {
                over = (el - rad) / Math.max(rad, 1e-4); if (over > 1) over = 1;
                tn = tanMax * over * (2 - over) * wr; cap = (el - rad) / len; if (tn > cap) tn = cap;   // 한 마디에 폭 안까지만(넘어가지 않게)
                if (tn > 0.003) {
                  tx = ux - tn * ex / el; ty = uy - tn * ey / el; tz = uz - tn * ez / el; tl = Math.sqrt(tx * tx + ty * ty + tz * tz);
                  if (tl > 1e-3) { ux = tx / tl; uy = ty / tl; uz = tz / tl; st.pull++; changed = true; }
                }
              }
            }
          }
        }
        if (changed) { if (i < lo) lo = i; if (i > hi) hi = i; U[i * 4] = ux; U[i * 4 + 1] = uy; U[i * 4 + 2] = uz; }
        x += ux * len; y += uy * len; z += uz * len; if (len > 0) { pdx = ux; pdy = uy; pdz = uz; }
        if (wr > 0 && b >= 0 && len > 0) {                                      // 진단: 고친 뒤
          q = b * MN; mx = B[q]; my = B[q + 1]; mz = B[q + 2];
          ex = x - ux * len * 0.5 - R0x - B[q + 6]; ey = y - uy * len * 0.5 - R0y - B[q + 7]; ez = z - uz * len * 0.5 - R0z - B[q + 8];
          em = ex * mx + ey * my + ez * mz; ex -= em * mx; ey -= em * my; ez -= em * mz;
          if (ex * ex + ey * ey + ez * ez > B[q + 9] * B[q + 9] * 1.0201) st.outAfter++;
        }
      }
      if (lo >= m) continue;                                                   // 바뀐 마디 없음 — 가닥을 그대로 둠
      // ── 4) 다시 잇기: 첫 바뀐 마디 앞의 점은 같은 점 그대로(뿌리 보호 구간은 전부 여기 들어감)
      var out = new Array(m), s1 = Math.min(last, hi + 1), ax, ay, az, al, i1, L = 0, pt, q2;
      x = p[lo - 1].x; y = p[lo - 1].y; z = p[lo - 1].z;
      for (i = 0; i < lo; i++) out[i] = p[i];
      st.kept += lo;
      for (i = lo; i < m; i++) {
        ax = U[i * 4]; ay = U[i * 4 + 1]; az = U[i * 4 + 2];
        if (i <= s1 && i > lo && WR[i] >= 1 && i < stopAt) {                    // 바뀐 구간은 이웃 마디와 한 번 고르게 — 뿌리 보호 밖 · 긴 반대 구간 앞에서만
          i1 = (i < last && i + 1 < stopAt) ? i + 1 : i;
          ax = U[(i - 1) * 4] + 2 * ax + U[i1 * 4]; ay = U[(i - 1) * 4 + 1] + 2 * ay + U[i1 * 4 + 1]; az = U[(i - 1) * 4 + 2] + 2 * az + U[i1 * 4 + 2];
          al = Math.sqrt(ax * ax + ay * ay + az * az);
          if (al > 1e-6) { ax /= al; ay /= al; az /= al; } else { ax = U[i * 4]; ay = U[i * 4 + 1]; az = U[i * 4 + 2]; }
        }
        len = U[i * 4 + 3];
        x += ax * len; y += ay * len; z += az * len;
        pt = { x: x, y: y, z: z };
        if (Es) {                                                              // 두상 안으로 들어가면 두피를 타고 가게(마디 길이 그대로) — v2와 같음
          try {
            q2 = ellipsoidPushOut(pt, Es.a, Es.b, Es.c, CY);
            if (q2 !== pt) {
              var gx = q2.x / (Es.a * Es.a), gy = (q2.y - CY) / (Es.b * Es.b), gz = q2.z / (Es.c * Es.c), gl = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1, gd = (ax * gx + ay * gy + az * gz) / gl;
              if (gd < 0) {
                var hx = ax - gd * gx / gl, hy = ay - gd * gy / gl, hz = az - gd * gz / gl, hl = Math.sqrt(hx * hx + hy * hy + hz * hz);
                if (hl > 1e-4) { pt = { x: x - ax * len + hx / hl * len, y: y - ay * len + hy / hl * len, z: z - az * len + hz / hl * len }; q2 = ellipsoidPushOut(pt, Es.a, Es.b, Es.c, CY); }
              }
              pt = q2; x = pt.x; y = pt.y; z = pt.z; st.pushed++;
            }
          } catch (e) {}
        }
        out[i] = pt;
      }
      for (i = 1; i < m; i++) L += Math.hypot(out[i].x - out[i - 1].x, out[i].y - out[i - 1].y, out[i].z - out[i - 1].z);
      st.strands++;
      try { if (p._rgKeep) out._rgKeep = true; } catch (e) {}
      s.pts = out;
      if (s.rg) { s.rg.L = L; s.rg.tipY = out[m - 1].y; }
    }
    st.ms = now() - t0;
    return st;
  };
  NB.run = function (strands, CY, kMul) { return NB.chain ? NB.runV3(strands, CY, kMul) : NB.runV2(strands, CY, kMul); };

  /* 42번의 "다 기른 뒤" 자리에 끼움 — 뿌리 이웃 결 정렬 → (예전 그대로) v7 결 정렬 */
  NB._before = function (strands, CY, kMul) {   // REGROW.alignStrands(17b) 맨 앞
    var st = null;
    try { st = NB.run(strands, CY, kMul); } catch (e) { st = { on: !!NB.on, err: String(e && e.message || e) }; console.warn(TAG + ' 실패(그대로 둠)', e); }
    S = NB.stats = st;
    try { console.log(NB.lines().join('\n')); } catch (e) {}
  };

  NB.lines = function () {
    var s = S; if (!s) return [TAG + ' ' + (NB.on ? '대기 — 아직 다시 기른 머리가 없음' : '꺼짐')];
    if (s.err) return [TAG + ' ⚠ ' + s.err];
    if (!s.on) return [TAG + ' 꺼짐'];
    if (s.skipped) return [TAG + ' 건너뜀 — ' + s.skipped];
    var cm = 16.4; try { cm = modelCmPerUnit() || 16.4; } catch (e) {}
    var med = isFinite(qv(s.rot, 0.5)) ? qv(s.rot, 0.5).toFixed(1) : '0', p90 = isFinite(qv(s.rot, 0.9)) ? qv(s.rot, 0.9).toFixed(1) : '0';
    var tail = ' · 뿌리 칸 ' + s.cells + ' · ' + Math.round(s.ms) + 'ms — 끄기 NEIGHBOR_ALIGN.on=false 후 NEIGHBOR_ALIGN.rebuild()';
    if (s.v !== 3) return [TAG + ' (v2 동작) 가닥 ' + s.n + '개 중 돌린 것 ' + s.strands + '개(' + (s.n ? Math.round(s.strands / s.n * 100) : 0) + '%) · 마디 ' + s.segs +
      ' · 돌린 각 중앙값 ' + med + '° · 90% ' + p90 + '° · 세기 ×' + (+s.kMul).toFixed(2) + ' · 뿌리 ' + (s.root * cm).toFixed(1) + 'cm까지는 안 건드림 · 거의 반대라 그대로 둔 마디 ' + s.flipKept +
      ' · 이웃 자리에서 멀어 그대로 둔 마디 ' + s.farKept + tail];
    var pc = function (a) { return s.seen ? (a / s.seen * 100).toFixed(1) + '%' : '0%'; };
    return [TAG + ' (연쇄) 가닥 ' + s.n + '개 중 고친 것 ' + s.strands + '개(' + (s.n ? Math.round(s.strands / s.n * 100) : 0) + '%) · 방향으로 돌린 마디 ' + s.segs +
      '(돌린 각 중앙값 ' + med + '° · 90% ' + p90 + '°) · 이웃 자리 쪽으로 기울인 마디 ' + s.pull +
      ' · 편 꺾임 ' + s.kinkRuns + '곳(마디 ' + s.kinkSegs + ') · 길게 반대로 가서 그대로 둔 가닥 ' + s.longRuns + '개(마디 ' + s.longSegs + ')',
      '    이웃 폭 밖에 있던 마디 ' + s.outBefore + '(' + pc(s.outBefore) + ') → ' + s.outAfter + '(' + pc(s.outAfter) + ') / 판정한 마디 ' + s.seen +
      ' — 안 줄었으면 이 단계가 안 들은 것입니다(남은 것 = 뿌리 보호 구간에서 이미 벗어났거나 · 길게 반대로 간 가닥이거나 · pullMax로 못 따라간 것)',
      '    세기 ×' + (+s.kMul).toFixed(2) + ' · 뿌리 ' + (s.root * cm).toFixed(1) + 'cm까지는 안 건드림 · 폭 = 이웃 퍼짐 ×' + NB.posK + '(하한 ' + (NB.posMin * cm).toFixed(1) + 'cm) · 기울임 상한 ' + NB.pullMax +
      '° · 꺾임으로 보는 길이 ' + (NB.flipShort * cm).toFixed(1) + 'cm 이하 · v2 동작은 NEIGHBOR_ALIGN.chain=false' + tail];
  };
  /* 값을 바꾼 뒤 — 지금 머리를 다시 기름(마네킹 OFF일 때만) */
  NB.rebuild = function () {
    try {
      if (!G.on) { console.log(TAG + ' 마네킹이 켜져 있습니다 — 마네킹을 끄면 새 값으로 기릅니다'); return; }
      G.model = null; G.src = null; G.failedFor = null;
      if (typeof G.build === 'function') G.build();
    } catch (e) { console.warn(TAG + ' 다시 기르기 실패', e); }
  };

  console.log(TAG + ' 설치 — 다시 기른 머리를 다 기른 직후, 뿌리가 가까운 가닥을 기준으로 뿌리에서부터 연쇄로 결·자리를 맞춥니다(v3 · 뿌리 보호 그대로 · 그 다음 42번 결 정렬) · v2 동작 NEIGHBOR_ALIGN.chain=false. 끄기 NEIGHBOR_ALIGN.on=false 후 NEIGHBOR_ALIGN.rebuild()');
  return NB;
})();

/* ==========================================================================
 * SPEC_PASS (옛 57-spec-pass.js) — 원본 머리에서 재고도 스타일 스펙에 안 넘기던 값 넘기기 (가르마 · 컬 굵기 초과분 · 컬 길이)
 *
 * 자리: 17b, NEIGHBOR_ALIGN 다음. 원래 함수에서 부르는 곳 —
 *   · REGROW.register(17b): 잰 결과에 SPEC_PASS.enrich(컬 길이·로드 배수·가르마)
 *   · adjustStrandGeom(17b) 바깥 단계: 마네킹 가닥이면 지금 스타일의 로드 배수(_cur)
 *   · curlStrand3D(14) 맨 앞: 로드 배수만큼 크게 말기 · applyStyleSpec(24 단계)·buildSpecFromCurrent(06)·clearStyleSpec(17a)
 *   · perfPanelLines(18) 끝 줄
 *
 * 왜 (2026-10-06 · 사용자): "원본 머리를 스타일로 저장해서 다시 돌려보니까 마네킨 모드 기반으로 생성되는데, 영 다른 모양이네."
 *   "(재고도 스펙에) 안 넘기게 지금 해놨다고? 넘겨줘."
 *   원본 머리를 스타일로 등록하면(42번 REGROW.register) 스펙에 섹션 길이 · 컬 · 웨이브 · 넘김 · 볼륨 · 페이드만 들어갑니다.
 *   아래 셋은 재기는 하는데 스펙에 안 들어가서, 마네킹에 다시 걸면 그만큼 달라졌습니다.
 *
 * 무엇을 (등록할 때 스펙에 넣고, 마네킹에 걸 때 쓰게 함):
 *   ① 컬 길이 — 짧은 머리(길이를 cm로 저장하는 쪽)만.
 *      42번이 저장하는 cm는 "보이는 길이"(컬을 편 뼈대 길이)인데, 마네킹 쪽(16번 applyStyleSpec)은 그 cm를 "컬을 건 가닥의 호길이"(= 편 길이)로
 *      맞춥니다. 그래서 곱슬 손님은 마네킹에서 그만큼 짧게 나왔습니다(컬 75면 약 0.72배).
 *      → 저장할 때 cm에 1/curlRemain(컬)을 곱합니다. 원본 화면(42번 curlKeepShape)이 가닥을 늘려 잡는 것과 같은 식이라,
 *        원본 화면의 가닥 길이와 마네킹의 가닥 길이가 같아집니다.
 *      긴 머리(끝 높이로 저장)는 마네킹 쪽이 컬을 건 상태에서 끝 높이를 맞추므로 손댈 것이 없습니다.
 *   ② 컬 굵기 초과분 — 웨이브 100으로도 모자랄 때의 로드 배수(rodScale). 지금까지는 "다시 기른 가닥에만" 걸렸습니다.
 *      → spec.perm.rodScale로 저장하고, 그 스타일이 걸려 있는 동안 마네킹 가닥에도 같은 방식(가닥을 줄여서 컬을 걸고 다시 키움)으로 겁니다.
 *        그 상태에서 [현재 모델을 스타일로 등록]하면 새 스타일에도 같이 들어갑니다(spec.rodScale).
 *   ③ 가르마 — 42번이 잰 위치(part.x)를 가르마 슬라이더 값으로 바꿔 styling.part에 넣습니다.
 *      위치 환산: 14번 가르마는 두상 방향의 x성분이 −part/100 × PART3D.MAXOFF인 자리에서 갈라집니다(실제 함수 partingPushHead로 확인:
 *      part 0 → 가운데 · ±50 → ∓0.325 · ±100 → ∓0.65). 재는 쪽과 거는 쪽이 같은 모델 x축을 쓰므로 좌우는 사진과 무관하게 맞습니다.
 *      세기(partAmt): ⚠ 어림입니다. 42번의 "양쪽으로 갈라지는 정도"는 못 씁니다 — 가르마가 없는 마네킹도 가운데에서 100%로 나옵니다
 *      (가닥이 원래 바깥으로 떨어지므로). 그래서 "가운데 선과 가르마 사이에서 난 가닥이 가운데를 넘어 반대쪽으로 가는 비율"을 따로 재서
 *      그것이 crossLo(50%)~crossHi(90%)일 때 세기 0~100으로 넣습니다. 가르마가 가운데(|위치| < partMinX)면 세기 0 = 안 넣습니다
 *      (가운데 가르마와 가르마 없음을 가닥 방향만으로는 구분 못 함).
 *
 * 확인한 것(실제 앱 코드를 브라우저에 올려서): 16번의 cm 맞추기가 호길이 기준임 · 14번 컬 엔진이 호길이를 거의 그대로 둠(0.85~1.05배) ·
 *   가르마 위치 환산 · 마네킹 가닥에 로드 배수가 걸림 / 다시 기른 가닥에는 두 번 안 걸림.
 * 확인 못 한 것: 실제 손님 사진으로 등록 → 다시 걸기. 가르마 세기는 위 어림식 그대로입니다.
 *   이미 등록해 둔 스타일에는 이 값이 없습니다 — 원본 머리에서 다시 등록해야 들어갑니다.
 *
 * 끄기: SPEC_PASS.on=false (전부) · SPEC_PASS.curlLen=false · SPEC_PASS.rod=false · SPEC_PASS.part=false (등록할 때 적용)
 * ========================================================================== */
var SPEC_PASS = (function () {
  'use strict';
  var W = window, TAG = '[스펙 넘기기]';
  var G = REGROW;

  var SP = Object.assign({
    on: true,
    curlLen: true,       // ① 짧은 곱슬머리의 cm를 편 길이로
    rod: true,           // ② 로드 배수(rodScale)
    part: true,          // ③ 가르마
    partMinX: 0.15,      // 가르마 위치(두상 반폭 대비)가 이보다 가운데면 안 넣음
    crossLo: 0.5, crossHi: 0.9,   // 가운데를 넘어가는 가닥 비율 이 구간을 세기 0 → partMaxAmt로 (⚠ 어림)
    partMaxAmt: 100,
    partMinN: 20         // 가운데 선과 가르마 사이의 가닥이 이만큼은 있어야 믿음
  }, W.SPEC_PASS || {});
  SP.last = null;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* ③ 가르마: 42번이 잰 위치 → 슬라이더 값, 세기는 "가운데를 넘어가는 비율"로 */
  function measurePart(r) {
    var out = { ok: false, why: '', x: r.part ? r.part.x : 0, part: 0, amt: 0, cross: null, n: 0 };
    if (!r.part) { out.why = '잰 가르마 없음'; return out; }
    if (Math.abs(r.part.x) < SP.partMinX) { out.why = '가운데(위치 ' + r.part.x.toFixed(1) + ') — 가르마 없음과 구분 못 해서 안 넣음'; return out; }
    var P3 = (typeof PART3D !== 'undefined') ? PART3D : null;
    if (!P3 || !P3.OFFSET || !P3.DIST || !(P3.MAXOFF > 0)) { out.why = '가르마 엔진이 위치 방식이 아님(PART3D.OFFSET/DIST) — 환산 못 함'; return out; }
    var m = G.model, Es = null, Eh = null;
    try { Es = getScalpEllipsoid(); Eh = getHeadEllipsoid(); } catch (e) {}
    if (!m || !m.strands || !Es || !Eh || !(Es.a > 0) || !(Eh.a > 0)) { out.why = '모델/두상 없음'; return out; }
    var CY = isFinite(m.CY) ? m.CY : 0.15, x0 = r.part.x * Es.a, sg = x0 > 0 ? 1 : -1;
    // 위치: 두피 윗면에서 x = x0인 자리의 "두상 방향 x성분"(14번 partingPushHead가 쓰는 값)
    var yy = CY + Es.b * Math.sqrt(Math.max(0, 1 - (x0 / Es.a) * (x0 / Es.a))) - 0.15;
    var vx = x0 / Eh.a, vy = yy / Eh.b, vl = Math.sqrt(vx * vx + vy * vy) || 1, nx0 = vx / vl;
    out.part = Math.round(clamp(-nx0 / P3.MAXOFF * 100, -100, 100));
    // 세기: 가운데 선과 가르마 사이에서 난 윗머리 가닥이 가운데를 넘어 반대쪽으로 가는 비율(방향의 x성분으로 가중)
    var tot = 0, cross = 0, n = 0, i, s, rx;
    for (i = 0; i < m.strands.length; i++) {
      s = m.strands[i]; if (!s.rg || (s.sec !== 'crown' && s.sec !== 'front')) continue;
      rx = s.pts[0].x;
      if (!(rx * sg > 0) || !(Math.abs(rx) < Math.abs(x0))) continue;
      var w = Math.abs(s.rg.dx); tot += w; n++;
      if (s.rg.dx * sg < 0) cross += w;
    }
    out.n = n;
    if (n < SP.partMinN || !(tot > 0)) { out.why = '가운데 선과 가르마 사이의 가닥이 ' + n + '개뿐 — 안 넣음'; return out; }
    out.cross = cross / tot;
    out.amt = Math.round(SP.partMaxAmt * clamp((out.cross - SP.crossLo) / Math.max(1e-6, SP.crossHi - SP.crossLo), 0, 1));
    if (!(out.amt > 0)) { out.why = '가운데를 넘어가는 가닥 ' + Math.round(out.cross * 100) + '% — 가르마로 안 봄'; return out; }
    out.ok = true;
    return out;
  }

  /* 잰 결과(r)의 스펙에 넘길 값을 넣음 — r.spec을 그 자리에서 고침 */
  SP.enrich = function (r) {
    var o = enrichCore(r);
    // (옛 59) 결 표·길이 지도도 같이 싣기(아래 FLOW_SPEC)
    try { if (typeof FLOW_SPEC !== 'undefined') FLOW_SPEC.enrich(o || r); } catch (e) { console.warn(TAG + ' 결 표 싣기 실패(없이 진행)', e); }
    return o;
  };
  function enrichCore(r) {
    var info = { curlLenK: 1, lenBefore: null, rodScale: 1, part: null };
    if (!SP.on || !r || !r.spec) { SP.last = info; return r; }
    var sp = r.spec, curl = (sp.perm && sp.perm.curl > 0) ? sp.perm.curl : 0;
    // ① 컬 길이
    if (SP.curlLen && curl > 0 && !r.isLong && sp.lenCm && typeof G.curlRemain === 'function') {
      var rem = G.curlRemain(curl);
      if (rem > 0.05 && rem < 0.999) {
        info.curlLenK = 1 / rem; info.lenBefore = Object.assign({}, sp.lenCm);
        Object.keys(sp.lenCm).forEach(function (k) { if (typeof sp.lenCm[k] === 'number') sp.lenCm[k] = +(sp.lenCm[k] / rem).toFixed(1); });
        sp.lenCmSeen = info.lenBefore;                                         // 참고용: 보이는 길이(고치기 전 값)
      }
    }
    // ② 로드 배수
    if (SP.rod && curl > 0 && r.curl && r.curl.rodScale > 1.005) { info.rodScale = +(+r.curl.rodScale).toFixed(2); sp.perm.rodScale = info.rodScale; }
    // ③ 가르마
    if (SP.part) {
      var pm = null; try { pm = measurePart(r); } catch (e) { pm = { ok: false, why: '재기 실패: ' + (e && e.message || e) }; }
      info.part = pm;
      if (pm.ok && sp.styling) { sp.styling.part = pm.part; sp.styling.partAmt = pm.amt; }
    }
    SP.last = info;
    return r;
  }
  SP.lines = function () {
    var i = SP.last; if (!i) return [TAG + ' ' + (SP.on ? '대기 — 원본 머리를 스타일로 등록하면 찍힙니다' : '꺼짐')];
    var L = [TAG + ' 직전 등록에서 스펙에 넘긴 값'];
    L.push('  컬 길이: ' + (i.lenBefore ? 'cm × ' + i.curlLenK.toFixed(2) + ' (보이는 길이 → 편 길이) · 고치기 전 ' + Object.keys(i.lenBefore).map(function (k) { return k + ' ' + i.lenBefore[k]; }).join(' · ') : '안 고침(직모 · 긴 머리 · 꺼짐)'));
    L.push('  로드 배수: ' + (i.rodScale > 1 ? '×' + i.rodScale.toFixed(2) + ' (마네킹 가닥에도 걸림)' : '없음(웨이브 100 이내)'));
    L.push('  가르마: ' + (!i.part ? '꺼짐' : i.part.ok ? '위치 ' + (i.part.x > 0 ? '+' : '') + i.part.x.toFixed(1) + ' → 슬라이더 ' + i.part.part + ' · 세기 ' + i.part.amt +
      ' (가운데를 넘어가는 가닥 ' + Math.round(i.part.cross * 100) + '% · ' + i.part.n + '가닥 — 세기는 어림)' : '안 넣음 — ' + i.part.why));
    return L;
  };

  /* 등록할 때만 넣음 — 원본 화면(기준 값 넣기)이 쓰는 REGROW.measure는 그대로. REGROW.register(17b)가 잰 결과를 여기 거침 */
  SP._enrichForRegister = function (r) {
    if (!SP.on || !r) return r;
    try { return SP.enrich(r); } catch (e) { console.warn(TAG + ' 넣기 실패(예전대로 등록)', e); return r; }
  };
  SP._afterRegister = function (stl) { if (SP.on && stl) { try { console.log(SP.lines().join('\n')); } catch (e) {} } };

  /* ② 거는 쪽 — 지금 걸려 있는(또는 걸고 있는) 스타일의 로드 배수를 마네킹 가닥의 컬에 */
  var pendingId = null;
  function activeRod() {
    try {
      var id = pendingId || state.specAppliedId; if (!id || typeof getStyleSpec !== 'function') return 1;
      var sp = getStyleSpec(id), k = sp ? (+sp.rodScale || (sp.perm && +sp.perm.rodScale)) : 0;
      return (SP.on && SP.rod && k > 1.005 && isFinite(k)) ? Math.min(4, k) : 1;
    } catch (e) { return 1; }
  }
  SP.activeRod = activeRod;
  function scalePts(pts, k) { var o = new Array(pts.length), i, p; for (i = 0; i < pts.length; i++) { p = pts[i]; o[i] = { x: p.x * k, y: p.y * k, z: p.z * k }; } return o; }
  /* adjustStrandGeom(17b) 바깥 단계 — 마네킹 가닥이면 지금 스타일의 배수(다시 기른 가닥은 42번이 직접 겁니다 · 두 번 걸지 않음) */
  SP._cur = 1;
  SP._enterStrand = function (s) { var save = SP._cur; SP._cur = (s && s.mannequin) ? activeRod() : 1; return save; };
  /* curlStrand3D(14) 맨 앞 — 배수가 걸려 있으면 작게 줄여 말고 다시 키움. run(인자) = curlStrand3D 다시 부르기(이때 배수 1) */
  SP._wantsRod = function (g, curl) { return SP._cur > 1 && curl > 0 && g && g.length >= 3; };
  SP._rodCurl = function (args, run) {
    var a = Array.prototype.slice.call(args), ks = SP._cur, out;
    a[0] = scalePts(a[0], 1 / ks);
    SP._cur = 1;
    try { out = run(a); } finally { SP._cur = ks; }
    return out ? scalePts(out, ks) : out;
  };
  /* applyStyleSpec(24 단계) — 길이를 맞추는 동안에도 이 스타일의 배수로 */
  SP._beginApply = function (id) { var save = pendingId; pendingId = id; return save; };
  SP._endApply = function (save) { pendingId = save; try { if (typeof ADJ_CACHE !== 'undefined' && ADJ_CACHE.bump) ADJ_CACHE.bump(); } catch (e) {} };
  /* 마네킹 상태에서 [현재 모델을 스타일로 등록]할 때도 지금 걸린 배수를 같이 저장(buildSpecFromCurrent 06 끝 — perm을 안 만들므로 spec.rodScale에) */
  SP._afterBuildSpec = function (spec) { try { var k = activeRod(); if (spec && k > 1) spec.rodScale = +k.toFixed(2); } catch (e) {} };

  SP._panelLines = function () {   // perfPanelLines(18) 끝
    var L = [];
    try { var k = activeRod(); if (SP.last) L = L.concat(SP.lines()); if (k > 1) L.push(TAG + ' 지금 걸린 스타일의 로드 배수 ×' + k.toFixed(2) + ' — 마네킹 가닥의 컬에 걸림'); } catch (e) {}
    return L;
  };
  console.log(TAG + ' 설치 — 원본 머리를 스타일로 등록할 때 컬 길이(짧은 곱슬) · 로드 배수 · 가르마를 스펙에 넣습니다. 끄기 SPEC_PASS.on=false');
  return SP;
})();

/* ==========================================================================
 * ORIG_MQ (옛 58-original-on-mannequin.js) — 원본 머리 = 마네킹을 켜고 그 위에 사진에서 잰 스펙을 올린 것
 *
 * 자리: 17b, SPEC_PASS 다음. 원래 함수에서 부르는 곳 —
 *   · getStyleSpec(16) 맨 앞 — '__original__'이면 원본 스펙 · syncMannequinBtn(17a) 끝 — 원본을 보는 중이면 OFF 표시
 *   · REGROW.applyBaseline(17b) 맨 앞 — 다시 기른 가닥 대신 마네킹 + 잰 스펙
 *   · toggleMannequin(17a) 맨 앞 — 원본 머리 ↔ 맨 마네킹 · applyStyleSpec(24 단계) · setupAdjustScreen · navTo(05)
 *   · perfPanelLines(18) 끝 줄
 *
 * 왜 (2026-10-06 · 사용자): "다른 스타일들은 기반이 마네킨 모드다. 원본 머리를 스타일로 저장해서 다시 돌려보니까 마네킨 모드 기반으로
 *   생성되는데, 영 다른 모양이네." "마네킨 모드를 켜고 그 위에 스펙을 올려라. 그 상태로 스타일을 저장해야 나중에 적용해도 안 변한다."
 *   예전: 마네킹 OFF = 다시 기른 가닥(42번)을 그대로 그림. 그 머리를 스타일로 등록하면 숫자 몇 개만 남고, 다시 걸 때는 마네킹에 그 숫자를
 *        거는 다른 경로라서 모양이 달라졌습니다.
 *
 * 무엇을:
 *   · 다시 기르기는 "재는 용도"로만 돕니다. 다 기르면 그 가닥을 그리지 않고,
 *       ① 마네킹 초기화(섹션 기본값 · 컬 0 · 스타일링 중립 · 페이드 꺼짐)
 *       ② 그 위에 잰 스펙(42번 measure + 57번이 넘기는 컬 길이·로드 배수·가르마)을 등록 스타일과 같은 경로(applyStyleSpec)로 겁니다.
 *     화면에 보이는 원본 머리가 곧 "마네킹 + 스펙"입니다.
 *   · 그 상태에서 [현재 모델을 스타일로 등록]하면 여느 마네킹 스타일과 같은 경로(06번 buildSpecFromCurrent)로 저장됩니다.
 *     다시 걸 때도 같은 마네킹에 같은 값이 걸리므로 같은 모양이 나옵니다.
 *   · 버튼의 뜻은 그대로 — [마네킹 초기화 OFF] = 원본 머리 · [마네킹 초기화 ON] = 맨 마네킹(초기화).
 *     달라진 것은 OFF일 때도 속은 마네킹이라는 것뿐입니다(MANNEQUIN.on은 계속 true).
 *   · 사진이 바뀌면(49번) 원본 머리였던 경우에 한해 새 사진으로 다시 재서 올립니다.
 *   · 재기에 실패하면(다시 기른 모델이 없음) 예전처럼 다시 기른 가닥을 그대로 보여 줍니다.
 *
 * ⚠ 원본 머리가 예전(다시 기른 가닥)보다 사진과 덜 닮습니다 — 스펙이 담는 것(섹션 길이 · 컬 · 굵기 · 넘김 · 볼륨 · 페이드 · 가르마)만큼만 닮습니다.
 *   자리마다의 결 방향·두께는 아직 스펙에 없습니다. 닮게 하려면 스펙에 담는 것을 늘려야 합니다(다음 단계).
 *
 * 확인한 것(실제 앱 코드를 브라우저에 올리고, 사진 모델·다시 기른 모델은 지어낸 것으로):
 *   원본 올리기 → 그 상태를 스타일로 등록 → 맨 마네킹으로 초기화 → 등록한 스타일 다시 걸기 → 가닥이 점 단위로 같은가.
 * 확인 못 한 것: 실제 손님 사진.
 *
 * 끄기: ORIG_MQ.on=false 후 버튼을 두 번(예전 방식 = 다시 기른 가닥을 그림)
 * ========================================================================== */
var ORIG_MQ = (function () {
  'use strict';
  var W = window, TAG = '[원본=마네킹+스펙]';
  var G = REGROW;

  var ID = '__original__';
  var OM = Object.assign({ on: false /* (2026-10-22) 끔 — 원본 머리 = 다시 기른 가닥 그대로(마네킹 + 머리 전체로 잰 숫자로 다시 그리지 않음) · 되돌리기 ?judge=1 */, name: '원본 머리 (마네킹 + 잰 값)' }, W.ORIG_MQ || {});
  OM.id = ID; OM.spec = null; OM.src = null; OM.mode = 'orig';   // mode: 'orig' = 원본 머리를 보는 중 · 'mq' = 맨 마네킹/다른 스타일
  var ST = OM.stats = { applied: 0, fellBack: 0, lastErr: null, at: null };

  function mqOn() { try { return typeof MANNEQUIN !== 'undefined' && !!MANNEQUIN.on; } catch (e) { return false; } }
  function photoNow() { try { return state._hair3Dneutral || null; } catch (e) { return null; } }
  function isOrig() { try { return mqOn() && state.specAppliedId === ID; } catch (e) { return false; } }
  function clone(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }
  function setTag(t) { try { var el = document.getElementById('adjustStyleTag'); if (el) el.textContent = t; } catch (e) {} }
  function secOrder() { return (typeof SECTION_ORDER !== 'undefined') ? SECTION_ORDER : ['crown', 'front', 'temple', 'side', 'occipital', 'nape']; }
  OM.isOriginal = isOrig;

  /* 등록 스타일 찾기에 원본 스펙을 끼움(STYLE_SPECS·STYLES에는 넣지 않음 — 스타일 목록에 안 보이게) */
  //   → getStyleSpec(16) 맨 앞에서 id === ORIG_MQ.id면 ORIG_MQ.spec

  /* 버튼 표시: 원본 머리를 보는 중이면 OFF(= 원본), 아니면 17번 그대로 */
  function syncBtn() { try { syncMannequinBtn(); } catch (e) {} }
  OM._btnTail = function () {   // syncMannequinBtn(17a) 끝
    try {
      var b = document.getElementById('mannequinBtn'); if (!b) return;
      if (OM.on && isOrig()) { b.classList.remove('on'); b.textContent = '마네킹 초기화 OFF'; }
      b.title = 'OFF: 원본 머리(마네킹에 사진에서 잰 값을 올린 것) · ON: 맨 마네킹으로 초기화';
    } catch (e) {}
  };

  /* 맨 마네킹 — 섹션 기본값 · 컬 0 · 스타일링 중립 · 페이드 꺼짐 · 걸린 스타일 없음 */
  function bare() {
    try {
      state.specAppliedId = null; state._specUndo = null;
      secOrder().forEach(function (sec) { var d = {}; try { d = clone(SECTIONS[sec].defaults) || {}; } catch (e) {} d.curl = 0; state.sections[sec] = d; });
      state._globalCurl = 0;
      try { if (state.fade) state.fade.enabled = false; } catch (e) {}
      try { if (typeof BRAID !== 'undefined') BRAID.on = false; } catch (e) {}
      G.mqSnap = null;                                                        // 42번이 예전 마네킹 값을 되돌리지 않게
    } catch (e) { console.warn(TAG + ' 초기화 값 넣기 실패', e); }
    mannequinReset();                                                         // 스타일링 중립 · 마네킹 켬 · 빗질 지움 · 다시 그림
    try { if (typeof ADJ_CACHE !== 'undefined' && ADJ_CACHE.bump) ADJ_CACHE.bump(); } catch (e) {}
  }
  OM.bare = bare;

  /* 다시 기른 모델에서 잰 스펙을 마네킹 위에 올림. 못 하면 false */
  OM.apply = function () {
    var photo = photoNow();
    if (!photo || !(G.model && G.src === photo)) return false;
    var r = null;
    try { r = G.measure(); } catch (e) { ST.lastErr = '재기 실패: ' + (e && e.message || e); }
    if (!r || !r.spec) return false;
    try { if (W.SPEC_PASS && typeof W.SPEC_PASS.enrich === 'function') W.SPEC_PASS.enrich(r); } catch (e) { console.warn(TAG + ' 57번 값 넣기 실패(없이 진행)', e); }
    var spec = clone(r.spec); spec.name = OM.name; spec.source = 'original-on-mannequin';
    OM.spec = spec; OM.src = photo; OM.measured = r; OM.mode = 'orig';
    bare();
    var res = null;
    try { res = applyStyleSpecAndRender(ID); } catch (e) { ST.lastErr = '스펙 걸기 실패: ' + (e && e.message || e); console.warn(TAG + ' ' + ST.lastErr, e); }
    if (!isOrig()) { ST.fellBack++; return !!res; }
    ST.applied++; ST.lastErr = null; ST.at = new Date().toTimeString().slice(0, 8);
    setTag(OM.name); syncBtn();
    try { console.log(OM.lines().join('\n')); if (typeof G.measureLines === 'function') console.log(G.measureLines(r).join('\n')); } catch (e) {}
    return true;
  };

  /* 42번이 다 기른 뒤(그리고 마네킹 OFF로 돌아올 때마다) 부르는 "기준 값 넣기" 자리 — 다시 기른 가닥을 보여 주는 대신 마네킹에 스펙을 올림 */
  //   REGROW.applyBaseline(17b) 맨 앞 — true/false면 그대로 돌려주고, undefined면 예전처럼 다시 기른 가닥(원래 본문)
  OM._baseline = function () {
    if (!OM.on) return undefined;
    var ok = false;
    try { if (G.on && !mqOn()) ok = OM.apply(); } catch (e) { ST.lastErr = String(e && e.message || e); console.warn(TAG + ' 실패 — 예전 방식으로', e); }
    if (ok) return true;
    if (mqOn()) return false;                                                // 이미 마네킹 — 42번의 기준 값을 넣으면 안 됨
    ST.fellBack++;
    return undefined;                                                        // 못 올림 — 예전처럼 다시 기른 가닥
  };

  /* 원본 머리 보이기 — 이 사진으로 이미 쟀으면 바로, 아니면 42번 흐름(다시 기르기 → 위의 자리)으로 */
  function showOriginal() {
    OM.mode = 'orig';
    var photo = photoNow();
    if (photo && OM.spec && OM.src === photo && G.model && G.src === photo) {
      if (isOrig()) return;
      bare();
      try { applyStyleSpecAndRender(ID); } catch (e) { console.warn(TAG + ' 스펙 걸기 실패', e); }
      if (isOrig()) { setTag(OM.name); syncBtn(); return; }
    }
    try {                                                                     // 42번의 "마네킹 OFF → 다시 기르기"를 그대로 탐
      state.specAppliedId = null; state._specUndo = null;
      MANNEQUIN.on = false; syncBtn();
      if (typeof G.sync === 'function') G.sync();
    } catch (e) { console.warn(TAG + ' 다시 기르기 시작 실패', e); }
  }
  OM.showOriginal = showOriginal;

  /* 버튼: 원본 머리 ↔ 맨 마네킹 — toggleMannequin(17a) 맨 앞. 'handled'면 거기서 끝, 'inner'면 원래 본문 뒤 _syncBtn() */
  OM._beforeToggle = function () {
    if (!OM.on) return 'off';
    if (!mqOn()) { OM.mode = 'mq'; return 'inner'; }                         // 다시 기르는 중이거나 예전 방식으로 떨어진 상태 — 17번·42번 그대로(마네킹 켬)
    if (isOrig()) { OM.mode = 'mq'; bare(); setTag('마네킹'); syncBtn(); }
    else showOriginal();
    return 'handled';
  };
  OM._syncBtn = syncBtn;

  /* 다른 스타일을 걸면 원본 보기가 아님 — applyStyleSpec(24 단계) 맨 앞/끝 */
  OM._beginApply = function (id) { if (id !== ID) OM.mode = 'mq'; };
  OM._endApply = function () { setTimeout(syncBtn, 0); };

  /* 조정 화면에 들어올 때 — 원본을 보던 중인데 걸린 것이 없으면(사진이 바뀌어 49번이 비운 경우) 새 사진으로 다시. setupAdjustScreen(05) 맨 앞/끝 */
  OM._beforeSetupAdjust = function () {
    // 원본 머리를 보던 중에 사진이 바뀌면 49번이 "고른 스타일"을 다시 걸도록 예약합니다(마네킹이 켜져 있으므로) — 원본을 보던 중이었으면 원본으로
    try { if (OM.on && navWasOrig && !navPend0 && state.pendingSpecId) { state.pendingSpecId = null; OM.mode = 'orig'; } } catch (e) {}
    var pending = null; try { pending = state.pendingSpecId; } catch (e) {}
    return pending;
  };
  OM._afterSetupAdjust = function (pending) {
    if (OM.on && !pending) setTimeout(function () {
      try {
        if (typeof currentScreen !== 'undefined' && currentScreen !== 'adjust') return;
        if (OM.mode === 'orig' && mqOn() && !isOrig() && !state.specAppliedId) showOriginal();
        else syncBtn();
      } catch (e) {}
    }, 0);
  };

  /* 화면을 옮기기 시작할 때의 상태(49번이 비우기 전) — navTo(05) 맨 앞/끝 */
  var navWasOrig = false, navPend0 = null;
  OM._navBegin = function () { try { navWasOrig = !!(OM.on && isOrig()); navPend0 = state.pendingSpecId || null; } catch (e) { navWasOrig = false; navPend0 = null; } };
  OM._navEnd = function () { navWasOrig = false; navPend0 = null; };

  OM.lines = function () {
    var L = [TAG + ' ' + (!OM.on ? '꺼짐(예전 방식 — 다시 기른 가닥을 그림)' : isOrig() ? '원본 머리 = 마네킹 + 잰 스펙' : OM.mode === 'orig' ? '원본 머리 준비 중/못 올림' : '맨 마네킹 또는 다른 스타일') +
      ' · 올린 횟수 ' + ST.applied + (ST.at ? '(마지막 ' + ST.at + ')' : '') + ' · 예전 방식으로 떨어진 횟수 ' + ST.fellBack + (ST.lastErr ? ' · ⚠ ' + ST.lastErr : '')];
    try {
      var sp = OM.spec;
      if (sp && OM.src === photoNow()) L.push('  올린 스펙: ' + (sp.tipAt ? '끝 높이 ' + Object.keys(sp.tipAt).map(function (k) { return k + ' ' + sp.tipAt[k]; }).join(' · ') :
        '길이 cm ' + Object.keys(sp.lenCm || {}).map(function (k) { return k + ' ' + sp.lenCm[k]; }).join(' · ')) +
        ' | 컬 ' + (sp.perm ? sp.perm.curl + ' · 웨이브 ' + sp.perm.wave + (sp.perm.rodScale > 1 ? ' · 로드 ×' + sp.perm.rodScale : '') : '-') +
        ' | 넘김 ' + (sp.styling ? sp.styling.sweep : '-') + ' · 볼륨 ' + (sp.styling ? sp.styling.volume : '-') + ' · 가르마 ' + (sp.styling && sp.styling.partAmt ? sp.styling.part + '(세기 ' + sp.styling.partAmt + ')' : '없음') +
        ' | 페이드 ' + (sp.fade && sp.fade.enabled ? '높이 ' + sp.fade.height + '%' : '꺼짐'));
    } catch (e) {}
    return L;
  };
  try { syncBtn(); } catch (e) {}
  console.log(TAG + ' 설치 — 원본 머리를 다시 기른 가닥으로 그리지 않고, 마네킹을 켠 뒤 사진에서 잰 스펙을 올려서 보여 줍니다(버튼 OFF = 원본 · ON = 맨 마네킹). 끄기 ORIG_MQ.on=false');
  return OM;
})();

/* ==========================================================================
 * FLOW_SPEC (옛 59-flow-spec.js) — 결 표 · 길이 지도를 스타일 스펙에 넘기기 (원본 머리 = 마네킹 + 숫자 + 결 + 길이)
 *
 * 자리: 17b, ORIG_MQ 다음. 원래 함수에서 부르는 곳 —
 *   · SPEC_PASS.enrich 끝 FLOW_SPEC.enrich(결 표 싣기) · REGROW.register 앞뒤(regCtx) · REGROW.applyBaseline 바깥(제 머리 바탕일 때 58 건너뜀)
 *   · adjustStrandGeom(17b) 맨 앞 FLOW_SPEC._adjust · applyStyleSpecAndRender(17a) 맨 앞 · applyStyleSpec(24 단계) 맨 바깥
 *   · computeAdjustedHair3DStrands 끝 기록 줄 · clearStyleSpec(17a) 끝 · adjFilterSig 꼬리표 · buildSpecFromCurrent(06) 끝 · saveCustomStylesToStorage(06) 끝
 *   · perfPanelLines(18) 끝 줄
 *
 * 왜 (2026-10-07 · 사용자): "원본 다시 기르기로 작업한 스타일을 저장한 다음 다시 적용하면 마네킹 모드로 넘어가면서 원래 모양과 완전히 달라진다."
 *   "스타일을 저장한다는 건 그 살롱의 대표 헤어로 다른 손님들에게도 적용하기 위해서다."
 *   "마네킹 기반으로 해서 스펙을 모두(숫자만이 아니라) 올리는 방향으로 가는 게 맞다." "(앞머리) 내려 심기 안 해도 된다. (섹션 길이 자동 맞추기 끄기) 그 방향으로 진행."
 *   2026-10-07 로그(직모 긴 머리 · 가운데 가르마): 저장된 값은 섹션 6개의 끝 높이 · 컬 0 · 볼륨 49 · 넘김 +14뿐.
 *   다시 걸면 마네킹이 앞머리 1,042가닥을 눈높이까지 내려 심고(얼굴을 덮는 가닥 front 1,362/1,527), temple은 슬라이더 100에 걸려 오차 32%.
 *   가르마는 위치 0.0(가운데)이라 57번도 못 넘김. 58번 주석: "자리마다의 결 방향·두께는 아직 스펙에 없습니다."
 *
 * 무엇을 스펙에 더 넣나 (spec.flow — 다시 기른 가닥(42번 · 정렬 뒤)에서 뽑음):
 *   · 결 표 — 두피 칸(뿌리 자리) × 뿌리에서의 길이 칸마다 "가닥이 가는 방향".
 *   · 길이 지도 — 두피 칸마다 가닥 길이의 분포(10·30·50·70·90%).
 *   · 갈리는 칸(가르마) — 한 칸 안에서 가닥이 두 쪽으로 갈리면 두 무리로 나눠 따로 저장하고, 가닥은 뿌리 자리가 가까운 쪽 무리를 따릅니다.
 *   전부 "두상으로 나눈 좌표"(두피 타원체의 반축 a·b·c로 나눔)로 저장합니다 → 다른 손님에게 걸 때는 그 손님 두상의 a·b·c를 곱합니다.
 *   spec.flowBase — 표를 뽑을 때의 넘김·볼륨·컬(= 표에 이미 들어 있는 값). spec.flowLen — 표 위에 걸 섹션 길이 슬라이더 값(처음엔 기본값).
 *
 * 어떻게 거나 (마네킹 가닥 · 걸려 있는 스타일의 스펙에 flow가 있을 때만):
 *   · 가닥의 뼈대 — 마네킹이 만든 뼈대 대신, 제 뿌리 자리의 표를 따라 뿌리에서부터 걸어 만든 뼈대를 씁니다(둘레 8칸을 섞음 · 길이는 제 칸의 분포에서).
 *     모든 가닥이 칸의 결을 따르므로 혼자 뜬 잔머리가 처음부터 없습니다.
 *   · 그 위의 슬라이더 — 42번이 다시 기른 가닥에 하는 것과 같은 방식("기준에서 움직인 만큼만"):
 *     섹션 길이 = 기본값 대비 비율 · 넘김/볼륨/가르마 = flowBase에서 달라진 만큼 · 컬 = 지금 값(표는 컬을 편 뼈대).
 *   · 마네킹의 앞머리 내려 심기(앞머리선에서 자르기)는 안 탑니다 · 섹션 길이 자동 맞추기(tipAt/lenCm 역산)는 건너뜁니다(스펙의 값은 그대로 둠 — 끄면 예전 동작).
 *   · [현재 모델을 스타일로 등록] — 지금 걸린 표를 새 스펙에 그대로 싣고, 그때의 섹션 길이 슬라이더 값을 flowLen에 넣습니다.
 *
 * 그대로 안 되는 것 / 알아둘 것:
 *   · 표 위에서는 섹션의 "길이" 말고 다른 커트 값(기법·각도 등)은 안 걸립니다(42번 원본 화면과 같음). 숱(density) · 색 · 컬 · 페이드는 걸립니다.
 *   · 스타일 하나에 표가 수십 KB 붙습니다. 브라우저 저장소(약 5MB)가 차면 저장이 안 되고 화면에 알립니다.
 *   · 빗질(53번)한 것은 스펙에 안 들어갑니다(지금처럼 그 화면에서만).
 *   · 이미 등록해 둔 스타일에는 표가 없습니다 — 원본 머리에서 다시 등록해야 들어갑니다.
 *
 * (2026-10-07b) 앞쪽 머리가 흩어지던 것 — 사용자(폰 영상·진단): "분명 마네킹 모드가 적용은 됐어. 그런데 앞쪽 머리 흩어짐 손봐야겠네."
 *   영상: 얼굴 앞(볼·눈 옆)에 곧게 내려오는 가닥 몇 개 · 턱 밑 목 앞을 가로지르는 가닥 뭉치. 실루엣·가르마는 원본대로.
 *   진단: 표 502칸(갈린 칸 57) · 102KB · 표로 다시 만든 가닥 ↔ 원래 가닥 1.3cm(중앙값) / 5.1cm(90%) · 얼굴 가림 front 23/1518(예전 1,362/1,527) ·
 *        50번(어깨)이 목 밖으로 민 점 2,632(다시 기른 가닥일 때는 6) = 표로 만든 길이 목 기둥을 지나고 있었음.
 *   원인(합성 머리로 재현한 것 — 실제 가닥을 한 올씩 추적한 것은 아님): 표가 칸마다 "평균 방향"이었습니다.
 *     처음에는 같이 가다가 얼굴·목 양쪽으로 갈라지는 가닥들을 평균 내면 가운데(= 얼굴 앞 · 목 속)로 가는 길이 됩니다.
 *     처음 4cm의 방향만 보고 무리를 갈랐기 때문에, 나중에 갈라지는 칸은 한 무리로 남았습니다. 평균 방향을 이어 걸으면 자리도 조금씩 밀립니다.
 *     재현(앞쪽 가운데 가닥이 3cm 같이 가다 양옆으로 갈라지는 합성 머리 · 원본에서 얼굴 앞을 지나는 가닥 135/20,000):
 *       평균 표 649/30,000 → 지금 90/30,000. 표로 다시 만든 가닥 ↔ 원래 가닥도 0.93 → 0.81cm(잔머리 아닌 가닥 중앙값).
 *   지금:
 *     · 본보기 가닥 — 칸(무리)마다 평균이 아니라 "실제로 있는 가닥 하나"의 길을 저장합니다(길이가 무리의 중간 이상이고, 가는 쪽이 무리 평균과
 *       가장 닮은 가닥). 실제 길이라 얼굴·목을 뚫지 않고, 양쪽의 평균이 아닙니다. 본보기보다 긴 구간만 닮은 가닥들의 평균으로 잇습니다.
 *     · 무리 가르기 — 가는 쪽을 뿌리에서 세 자리(≈ 4 · 11 · 26cm)에서 봅니다. 나중에 갈라지는 칸도 두 무리가 됩니다.
 *     · 이웃 칸과 섞기 — 길이 칸마다, 이웃 칸의 방향이 제 칸 방향과 35° 안일 때만 섞습니다(갈라지는 자리에서 가운데로 평균 내지 않음).
 *     · 목 — 걷는 동안 목 기둥 속으로 들어가는 점은 그 자리에서 밖으로(42번 neckPush) 옮기고 거기서 이어 걷습니다
 *       (나중에 50번이 한 점씩 밀어내면 가로로 지그재그가 됨). 끄기 FLOW_SPEC.guardNeck=false
 *     · 표 형식이 v2로 바뀜(무리마다 끝 쪽 방향 3바이트 추가). 오늘 아침에 v1로 저장한 스타일도 그대로 풀립니다(다만 평균 표라 흩어짐은 그대로 —
 *       원본 머리에서 다시 등록해야 새 표가 들어갑니다).
 *
 * (2026-10-07c) 결이 얽히고 잔머리가 나오던 것 — 사용자(폰 영상·진단): "왜 결이 얽히고 잔머리가 나왔는지, 그 원인을 제거해 줘."
 *   영상(긴 직모 · 10:01 배포본): 옆·뒤가 다발째로 엇갈리고, 밑단 아래로 길게 늘어진 다발, 이마를 가로지르는 가닥.
 *   원인 = (b)에서 제가 넣은 "본보기 가닥"입니다. 칸마다 실제 가닥 하나의 길을 그대로 쓰니
 *     · 그 가닥의 잔 굴곡·엇나감이 칸 전체(수십 가닥)에 복사되고, 이웃 칸은 다른 가닥을 따라가서 칸끼리 결이 엇갈렸습니다.
 *     · 본보기가 잔머리에 가까운 가닥이면 그 칸이 통째로 잔머리 다발이 됐습니다.
 *     · 길이를 칸의 분포(10~90%)에서 가닥마다 뽑아서, 밑단이 들쭉날쭉하고 긴 쪽이 꼬리로 나왔습니다(이건 처음 버전부터).
 *   재현(합성 머리 2만 가닥 — 잔 굴곡 + 잔머리 12% + 중간에 끊긴 가닥 15% + 밑단을 지나친 가닥 5% + 거꾸로 간 가닥 5% → 마네킹 3만 가닥):
 *                              결 어긋남(이웃 평균과의 각 · 중앙/90%)   밑단 들쭉날쭉(끝 높이 10~90%)   밑단보다 3cm 넘게 내려온 가닥   잡음 없는 머리와의 거리(중앙/90%)
 *     평균 표(아침)                    0.7° / 3.5°                        8.8cm                        3.4%                      1.0 / 4.0cm
 *     본보기 표(10:01 배포)            3.3° / 7.1°                        9.3cm                        4.7%                      1.6 / 4.6cm
 *     지금                            0.3° / 3.4°                        4.7cm                        2.1%                      1.0 / 1.7cm
 *     (잡음 없는 머리 자체의 밑단 들쭉날쭉은 3.8cm) · 칸 몇 개가 통째로 밑단을 지나친 원본이면 꼬리 가닥: 평균 8.1% · 본보기 8.9% · 지금 2.4%.
 *     같이 가다 양옆으로 갈라지는 머리에서 얼굴 앞을 지나는 가닥(잡음 없는 머리 197/30,000): 평균 700 · 본보기 124 · 지금 202.
 *   지금:
 *     · 본보기 가닥을 뺐습니다. 칸(무리)의 방향 = 그 무리의 "몸통 가닥"(가는 쪽이 무리 평균과 coreDot 이상 같은 가닥)만의 평균.
 *       잔머리·엇나간 가닥·거꾸로 간 가닥은 표에 안 들어갑니다. 양쪽으로 갈라지는 칸은 (b)의 세 자리 가르기로 이미 두 무리라 가운데로 평균 나지 않습니다.
 *     · 이웃 칸과 고르기 — 같은 쪽으로 가는 이웃 무리끼리 방향·길이를 두 번 섞습니다(갈라지는 길이 칸은 안 섞음). 결이 칸마다 따로 놀지 않습니다.
 *     · 길이 — 칸마다 하나(몸통 가닥 길이의 60% 자리)로 정하고 가닥마다 ±4%만 다르게. 이웃보다 혼자 훨씬 긴 칸은 이웃 길이로 누릅니다(짧은 쪽은 그대로).
 *     · 한 칸의 가닥이 두 쪽으로 갈릴 때, 두 무리의 뿌리 자리가 칸 안에서 섞여 있으면(가르마처럼 자리로 갈리지 않으면) 큰 무리만 씁니다.
 *       예전에는 작은 무리(엇나가거나 거꾸로 간 가닥들)도 그 비율만큼 가닥을 받아서, 여러 가닥이 같이 엇나가는 다발이 됐습니다.
 *       다발은 53번 빗이 "몸통"으로 보기 때문에(같이 가는 가닥이 많음) 빗어도 안 눕습니다.
 *     · 칸의 몸통은 "가장 많은 가닥이 같이 가는 쪽"에서 고릅니다(평균에서 고르면 두 쪽이 섞인 칸은 아무도 안 가는 가운데가 됨).
 *       둘레에 같은 쪽으로 가는 이웃이 하나도 없는 칸은 이웃들 중 여럿이 가는 쪽을 따릅니다(이웃도 제각각인 가마 같은 자리는 그대로).
 *       재현(칸의 15%에서 그 칸 가닥의 30%가 같이 엇나가는 원본 → 깨끗한 길에서 3cm 넘게 벗어난 가닥 / 그런 가닥이 10개 넘게 모인 칸):
 *         평균 표 466 / 12칸 · 본보기 표 185 / 7칸 · 지금 29 / 0칸.  (42%가 엇나가면 890 / 23 · 763 / 15 · 178 / 1.
 *         절반 넘게 엇나가는 칸은 그쪽이 그 칸의 결이므로 그대로 따라갑니다.)
 *     · 표 형식은 v2 그대로(풀기·걷기 코드는 안 바뀜). 10:01 배포본으로 저장한 스타일은 본보기 표가 들어 있으니 원본 머리에서 다시 등록해야 합니다.
 *
 * (2026-10-07d) 마네킹 없이(제 머리 바탕) — 사용자: "컬은 마네킹 모드 적용 안 한 게 확실히 나은 것 같아." "마네킹 모드 없이 스타일을 만든 다음에
 *   적용하면, 마네킹 모드가 안 켜지고 스타일이 얹어질 수는 없나?" "(결·가르마·윤곽) 이것도 넘기면 안 돼? 왜 안 넘겨?" "그래, 만들어 봐야 확인이 되지."
 *   실측(컬 75 손님 · 10:43): 표에 넣은 가닥 66%(직모 83~90%) · 표로 다시 만든 가닥 ↔ 원래 가닥 3.0 / 9.9cm(직모 0.9~1.5 / 4.5~5.3cm).
 *   컬 머리는 가닥끼리 엇갈린 것이 부피를 만드는 재료인데(42번도 그래서 곱슬에는 결 정렬을 안 함), 표는 그 엇갈림을 잡음으로 보고 지웁니다.
 *   지금:
 *     ① 컬 손님의 원본 — 잰 컬이 nativeCurl(40) 이상이면 58번(마네킹 + 스펙)을 건너뛰고 42번의 다시 기른 머리를 그대로 보여 줍니다.
 *     ② 스타일이 어디서 만들어졌는지 기억 — 다시 기른 머리 화면에서 등록한 스타일은 spec.base = 'regrown'(표 · 기준 값 · 섹션 길이 값도 같이 실음).
 *     ③ 그런 스타일을 걸면 마네킹을 켜지 않습니다. 그 손님의 머리를 다시 기른 뒤(없으면 기름), 가닥마다
 *          큰 흐름 = 스타일의 표 · 잔 차이(그 가닥이 제 칸의 결에서 벗어나 있던 만큼) = 그 손님 것 그대로 · 길이 = 제 길이 × (스타일 칸 길이 ÷ 제 칸 길이)
 *        로 다시 걷습니다(마디마다 "제 칸의 결 → 스타일의 결" 회전을 그대로 걸어 줌). 슬라이더는 마네킹 방식과 같게 그 위에 걸립니다.
 *        같은 스타일을 다시 누르면 해제(다시 기른 머리로). 마네킹에서 만든 스타일은 예전처럼 마네킹이 켜집니다.
 *        ※ 마네킹이 꺼져 있으면 17번이 state.specAppliedId를 비우므로, 걸린 스타일은 FLOW_SPEC.nativeState.id에 따로 적습니다.
 *   확인한 것(합성 머리):
 *     · 같은 손님에게 다시: 원래 가닥과의 차이 평균 0.001cm(최대 0.19cm — 제 결에서 75° 넘게 벗어난 마디를 누른 자리).
 *     · 컬 스타일(가운데 가르마) → 다른 컬 손님(한쪽으로 넘긴 머리 · 더 짧음): 가르마 바깥으로 가는 가닥 6,381 / 반대 6,490 → 12,396 / 475 ·
 *       엇갈림(이웃과의 각 중앙/90%) 손님 15.5° / 32.7° → 얹은 뒤 11.2° / 28.7°(같은 스타일을 마네킹 방식으로 걸면 0.6° / 3.9°) ·
 *       길이 중앙 20.4 → 30.2cm(스타일 29.7cm) · 두피 속 점 0.
 *     · 실제 앱 코드를 브라우저에 올려서(다시 기른 모델·기준 값은 지어낸 것): 다시 기른 머리 화면에서 등록 → base 'regrown' ·
 *       같은 손님에게 걸기(마네킹 안 켜짐 · 7,000가닥 전부 다시 걸음) → 다시 눌러 해제 · 마네킹 상태의 다른 손님에게 걸기(마네킹 꺼짐 → 얹힘) ·
 *       컬 슬라이더가 그 위에 걸림 · 마네킹에서 만든 스타일은 마네킹이 켜짐 · 컬 76인 사진은 58번을 건너뛰고 직모 사진은 58번을 탐.
 *   한계 / 확인 못 한 것:
 *     · 컬 스타일을 직모 손님에게 얹으면 엇갈림이 안 생깁니다(합성: 2.4° → 2.6° · 스타일 원본 14.7°) — 손님 머리에 없는 잔 차이는 만들지 않습니다.
 *       이걸 살리려면 스타일에 "원래 얼마나 엇갈려 있었는지"를 같이 저장해야 합니다(다음 단계).
 *     · 실제 다시 기르기를 기다렸다가 거는 경로(폰에서 6초쯤) · 실제 손님 사진 · 42번 "잰 숫자로 등록" 경로의 base 표시 · 58번 버튼과의 왕복은 실제로 못 돌려 봤습니다.
 *   끄기: FLOW_SPEC.native=false(전부 예전처럼 마네킹 방식) · FLOW_SPEC.nativeCurl=0(컬 손님 원본도 마네킹 + 표)
 *
 * 확인한 것(합성 머리 — 가운데·옆 가르마 · 앞쪽만 짧은 긴 직모 · 잔머리 12%):
 *   · 표 만들기 → 싣기 → 풀기 → 같은/큰/작은 두상에 걸기: 두피 속 점 0 · 가르마를 건너가는 가닥 0 · 끝 높이(두상 높이 대비) 두상 크기와 무관하게 같음.
 *   · 실제 앱 코드를 브라우저에 올려서(사진 모델·다시 기른 모델은 지어낸 것): 스타일 걸기(applyStyleSpecAndRender → 앱이 직접 만든 마네킹 29,999가닥)에서
 *     전 가닥이 표대로 · 얼굴 앞을 지나는 가닥 0(같은 스타일을 표 없이 걸면 2,305) · 기준 상태의 가닥 = 표 뼈대와 점 단위로 같음 ·
 *     섹션 길이 슬라이더 30/50/70이 그 섹션에만 걸림 · 컬·넘김이 그 위에 걸림 · [현재 모델을 스타일로 등록] → 저장소 → 다시 걸기 · 끄면 예전 동작.
 * 확인 못 한 것: 실제 손님 사진 · 58번의 원본 올리기 경로 전체(42번 재기는 실제 다시 기르기가 있어야 돕니다) · 마네킹이 앞머리를 내려 심는 손님 · 폰 속도.
 *   진단 [결 표] 줄의 "표로 다시 만든 가닥 ↔ 원래 가닥" 거리가 실제 사진에서 표가 얼마나 잃는지를 말해 줍니다.
 *
 * 끄기: FLOW_SPEC.on=false 후 스타일을 다시 걸기(그러면 그 스타일은 예전처럼 숫자만으로 걸립니다) · 표를 스펙에 안 싣기: FLOW_SPEC.save=false
 * ========================================================================== */
var FLOW_SPEC = (function () {
  'use strict';
  var W = window, TAG = '[결 표]';
  var FS = Object.assign({
    on: true,            // 거는 쪽: 스펙에 flow가 있으면 마네킹 가닥을 표대로
    save: true,          // 싣는 쪽: 원본 머리의 스펙에 flow를 넣음
    cs: 0.14,            // 두피 칸(두상으로 나눈 좌표 · 0.14 ≈ 1cm)
    bin: 0.08,           // 길이 칸(같은 좌표 · ≈ 0.6~0.9cm)
    maxBins: 72,         // 길이 칸 상한(≈ 60cm)
    early: 0.35, mid: 1.0, late: 2.4,   // 가닥이 "어느 쪽으로 가는가"를 보는 세 자리(뿌리에서 ≈ 4 · 11 · 26cm — 가닥이 짧으면 끝)
    minCell: 3,          // 한 칸에 가닥이 이만큼은 있어야 표로 씀
    splitCoh: 0.8,       // 칸 안 가닥들의 방향 모임(0~1)이 이보다 낮으면 두 무리로 갈라 봄
    splitAngle: 50,      // 도: 두 무리의 방향이 이만큼은 벌어져야 가름
    splitMinShare: 0.2,  // 작은 무리가 이 비율은 돼야 가름
    step: 0.05,          // 뼈대를 걸을 때 한 걸음(같은 좌표) — 가닥이 길면 maxPts에 맞춰 넓어짐
    minPts: 6, maxPts: 28,
    matchDot: 0.5,       // 이웃 칸의 무리가 제 무리와 이만큼(cos · 처음과 끝 쪽 평균)은 같은 쪽이어야 섞음
    binGate: 0.82,       // 길이 칸마다: 이웃 칸의 방향이 제 칸 방향과 이만큼(cos ≈ 35°)은 같아야 그 칸에서 섞음 — 양쪽으로 갈라지는 자리에서 가운데로 평균 내지 않게
    dropMixed: true,     // 한 칸의 두 무리가 뿌리 자리로 갈리지 않고 섞여 있으면 큰 무리만 씀(작은 무리 = 엇나간 가닥)
    coreDot: 0.85,       // 무리의 "몸통"으로 치는 기준 — 가는 쪽(세 자리 평균 cos)이 무리 평균과 이만큼 같은 가닥만 표에 넣음(≈ 32°)
    lenQ: 0.6,           // 칸의 길이 = 몸통 가닥 길이의 이 자리(0.5 = 중앙값). 가닥마다 제각각인 길이는 안 씀
    lenVar: 0.04,        // 가닥마다 길이를 ± 이만큼만 다르게
    lonerMin: 4,         // 둘레에 무리가 이만큼은 있는데 같은 쪽으로 가는 이웃이 하나도 없는 칸은 이웃을 따름 · 0 = 안 함
    tailCap: 1.1,        // 같은 쪽 이웃들의 길이(위쪽 75%)보다 이 배수 넘게 긴 칸은 그 길이로 누름 · 0 = 안 누름
    lenStep: 0.25,       // 이웃 칸과 길이를 섞는 한도 — 이보다 크게 다르면(앞머리 ↔ 긴 머리) 안 섞음
    smoothPasses: 2, smoothDot: 0.8,   // 이웃 칸과 고르는 횟수 · 같은 쪽으로 가는 무리로 보는 기준(cos)
    // ── 마네킹 없이(제 머리 바탕)
    native: true,        // 마네킹 없이 만든 스타일은 마네킹을 안 켜고 손님의 다시 기른 머리 위에 얹음 · 컬이 nativeCurl 이상인 손님의 원본은 다시 기른 머리로 보여 줌
    nativeCurl: 0,       // (2026-10-10t) 0 — 컬 손님 원본도 마네킹 + 잰 값(61번 ④가 잰 반경·간격으로 감음). 예전 값 40      // 잰 컬이 이 값 이상이면 원본 = 다시 기른 머리(42번이 결 정렬을 끄는 기준과 같은 값) · 0 = 컬과 무관하게 마네킹+표
    natResMax: 75,       // 도: 가닥이 제 결에서 벗어나 있던 각을 이만큼까지만 인정(거꾸로 간 가닥은 이 각으로 눌림)
    natLenMin: 0.25, natLenMax: 4,   // 길이 배수(스타일 길이 ÷ 제 칸 길이)의 한도
    smallFrac: 0.25,     // (i) 몸통 가닥 수가 보통 칸(중앙값)의 이 비율 미만인 무리는 같은 쪽으로 가는 큰 이웃의 방향을 따름 · 0 = 끔
    saveComb: true,      // (h) 스타일 등록 때 빗질·넘기기(53번)를 건 가닥으로 표를 뽑음 — 넘긴 모양이 스타일에 들어감 · false = 빗기 전 모양으로(예전)
    natUpK: 1.25,        // (2026-10-10a) 제 머리 바탕: 두상(타원) 반지름의 이 배 밖에서는 결이 위로 가도 위로 가려던 만큼 아래로 꺾임(처짐) · 0 = 끔
    natTail: 1.1, natTailFull: 2,    // (g) 늘릴 때: 제 칸보다 긴 가닥도 스타일 칸 길이의 natTail배까지만(배수 natTailFull 이상에서 온전히) · 0 = 안 누름
    nativeWaitMs: 25000, // 다시 기르기를 이만큼 기다려도 안 끝나면 마네킹 방식으로 겁니다
    guardNeck: false,     // 걸을 때 목 기둥 속으로 들어가는 점은 밖으로(42번 neckPush)
    lenOwnOnly: true,    // (2026-10-12c) 가닥 길이 = 제 칸의 길이만(둘레 칸과 안 섞음) — 사용자: "왜 섞는거야? 그냥 가닥길이를 쓰면 안돼?" 머리선의 짧은 칸(짧게 심은·옆으로 눕힌 가닥)이 긴 이웃의 길이를 받아 제 방향 그대로 허공으로 뻗던 것(직모 손님 앞머리 가시 450가닥 → 0). 이웃 가닥과의 길이 차이는 그대로(중앙 0.49 → 0.50cm). false = 예전(섞음)
    deadEnd: true, deadRatio: 0.3, deadRing: 7,   // (2026-10-12e) 머리 안쪽(둘레 8방향 중 deadRing 이상이 두 칸 밖까지 머리)인데 이웃 길이의 deadRatio배 미만인 무리는 표에서 뺌(더듬이) · 끄기 deadEnd=false
    lenOwnCap: 0,        // lenOwnOnly를 끄고 쓸 때: 제 칸 길이의 이 배까지만 이웃과 섞음 · 0 = 끔
    fidelityN: 2500      // 진단: 표로 다시 만들어 볼 원래 가닥 수
  }, W.FLOW_SPEC || {});
  var ST = FS.stats = { built: null, shaped: 0, fallback: 0, err: null, saveWarn: null };

  function now() { try { return performance.now(); } catch (e) { return Date.now(); } }
  function qv(a, f) { if (!a.length) return NaN; var b = a.slice().sort(function (x, y) { return x - y; }); return b[Math.min(b.length - 1, Math.floor(b.length * f))]; }
  var OFF = 64, SPAN = 128;
  function keyOf(ix, iy, iz) { return (ix + OFF) + SPAN * ((iy + OFF) + SPAN * (iz + OFF)); }
  function hash01(p) { var v = Math.sin(p.x * 269.5 + p.y * 183.3 + p.z * 419.2) * 24634.6345; return v - Math.floor(v); }   // 08번 _cutHash01(숱 솎기)과 다른 상수 — 같으면 숱을 줄일 때 짧은 가닥만 남음

  /* ------------------------------------------------------------------------------------------------------------
   * 표 만들기 — strands: [{pts:[{x,y,z}…]}] · E: 두피 타원체 {a,b,c} · CY: 두상 중심 높이
   * ---------------------------------------------------------------------------------------------------------- */
  function buildTable(strands, E, CY, cfg) {
    cfg = cfg || FS;
    var cs = cfg.cs, bin = cfg.bin, NBmax = cfg.maxBins | 0, n = strands.length, recs = [], cells = new Map(), si, i;
    var ia = 1 / E.a, ib = 1 / E.b, ic = 1 / E.c, maxLen = 0, A1 = cfg.early, A2 = cfg.mid, A3 = cfg.late;
    for (si = 0; si < n; si++) {
      var p = strands[si] && strands[si].pts; if (!p || p.length < 3) continue;
      var m = p.length, N = new Float32Array(m * 3);
      for (i = 0; i < m; i++) { N[i * 3] = p[i].x * ia; N[i * 3 + 1] = (p[i].y - CY) * ib; N[i * 3 + 2] = p[i].z * ic; }
      var rl = Math.sqrt(N[0] * N[0] + N[1] * N[1] + N[2] * N[2]); if (!(rl > 0.2)) continue;
      var ux = N[0] / rl, uy = N[1] / rl, uz = N[2] / rl, ix = Math.floor(ux / cs), iy = Math.floor(uy / cs), iz = Math.floor(uz / cs);
      // 길이 · 가는 쪽(뿌리에서 early / mid / late만큼 간 자리까지의 방향 — 가닥이 짧으면 끝까지)
      var len = 0, F = new Float32Array(9), g1 = false, g2 = false, g3 = false, dx, dy, dz, l, k;
      for (i = 1; i < m; i++) {
        dx = N[i * 3] - N[i * 3 - 3]; dy = N[i * 3 + 1] - N[i * 3 - 2]; dz = N[i * 3 + 2] - N[i * 3 - 1]; l = Math.sqrt(dx * dx + dy * dy + dz * dz); len += l;
        if (!g1 && len >= A1) { F[0] = N[i * 3] - N[0]; F[1] = N[i * 3 + 1] - N[1]; F[2] = N[i * 3 + 2] - N[2]; g1 = true; }
        if (!g2 && len >= A2) { F[3] = N[i * 3] - N[0]; F[4] = N[i * 3 + 1] - N[1]; F[5] = N[i * 3 + 2] - N[2]; g2 = true; }
        if (!g3 && len >= A3) { F[6] = N[i * 3] - N[0]; F[7] = N[i * 3 + 1] - N[1]; F[8] = N[i * 3 + 2] - N[2]; g3 = true; }
      }
      if (!(len > bin * 0.5)) continue;
      var tx = N[m * 3 - 3] - N[0], ty = N[m * 3 - 2] - N[1], tz = N[m * 3 - 1] - N[2];
      if (!g1) { F[0] = tx; F[1] = ty; F[2] = tz; } if (!g2) { F[3] = tx; F[4] = ty; F[5] = tz; } if (!g3) { F[6] = tx; F[7] = ty; F[8] = tz; }
      var okF = true;
      for (k = 0; k < 3; k++) { l = Math.sqrt(F[k * 3] * F[k * 3] + F[k * 3 + 1] * F[k * 3 + 1] + F[k * 3 + 2] * F[k * 3 + 2]); if (!(l > 1e-6)) { okF = false; break; } F[k * 3] /= l; F[k * 3 + 1] /= l; F[k * 3 + 2] /= l; }
      if (!okF) continue;
      var rec = { N: N, m: m, len: len, F: F, ox: ux - (ix + 0.5) * cs, oy: uy - (iy + 0.5) * cs, oz: uz - (iz + 0.5) * cs, cl: 0 };
      var key = keyOf(ix, iy, iz), c = cells.get(key);
      if (!c) { c = { ix: ix, iy: iy, iz: iz, recs: [] }; cells.set(key, c); }
      c.recs.push(rec); recs.push(rec); if (len > maxLen) maxLen = len;
    }
    function fdot(a, b) { var s = 0, k; for (k = 0; k < 9; k++) s += a[k] * b[k]; return s / 3; }
    function fmean(R) {                                                      // 세 구간 방향을 따로 평균해 각각 길이 1로 · coh = 세 평균 벡터 길이의 평균
      var M = new Float32Array(9), j, k, l, coh = 0;
      for (j = 0; j < R.length; j++) for (k = 0; k < 9; k++) M[k] += R[j].F[k];
      for (k = 0; k < 3; k++) { l = Math.sqrt(M[k * 3] * M[k * 3] + M[k * 3 + 1] * M[k * 3 + 1] + M[k * 3 + 2] * M[k * 3 + 2]); coh += l / R.length; if (l > 1e-6) { M[k * 3] /= l; M[k * 3 + 1] /= l; M[k * 3 + 2] /= l; } }
      return { M: M, coh: coh / 3 };
    }
    var nb = Math.max(2, Math.min(NBmax, Math.ceil(maxLen / bin))), out = [], nSplit = 0, nMixed = 0, nUsed = 0, nSkipCell = 0, cSplit = Math.cos(cfg.splitAngle * Math.PI / 180);
    var D = new Float32Array(nb * 4), WN = [0, 1, 0.6, 0.35];
    cells.forEach(function (c) {
      var R = c.recs, nr = R.length, j, r, k;
      if (nr < cfg.minCell) { nSkipCell++; return; }
      // 갈리는 칸인가 — 가는 쪽(세 구간)이 두 무리로 나뉘는가
      var fm = fmean(R), groups = [R];
      if (fm.coh < cfg.splitCoh && nr >= 2 * cfg.minCell) {
        var a = R[0], b = R[0], best = 9, d;
        for (j = 0; j < nr; j++) { d = fdot(R[j].F, fm.M); if (d < best) { best = d; a = R[j]; } }
        best = 9; for (j = 0; j < nr; j++) { d = fdot(R[j].F, a.F); if (d < best) { best = d; b = R[j]; } }
        var CA = a.F, CB = b.F, it, GA, GB, mA, mB;
        for (it = 0; it < 6; it++) {
          GA = []; GB = [];
          for (j = 0; j < nr; j++) { r = R[j]; if (fdot(r.F, CA) >= fdot(r.F, CB)) { r.cl = 0; GA.push(r); } else { r.cl = 1; GB.push(r); } }
          if (!GA.length || !GB.length) break;
          mA = fmean(GA); mB = fmean(GB); CA = mA.M; CB = mB.M;
        }
        var minStage = 2;
        for (k = 0; k < 3; k++) { d = CA[k * 3] * CB[k * 3] + CA[k * 3 + 1] * CB[k * 3 + 1] + CA[k * 3 + 2] * CB[k * 3 + 2]; if (d < minStage) minStage = d; }
        if (GA && GB && GA.length >= cfg.minCell && GB.length >= cfg.minCell && Math.min(GA.length, GB.length) / nr >= cfg.splitMinShare && minStage <= cSplit) { groups = [GA, GB]; nSplit++; }
        else for (j = 0; j < nr; j++) R[j].cl = 0;
      }
      // 두 무리의 뿌리 자리가 칸 안에서 섞여 있으면(가르마처럼 자리로 갈리지 않음) 작은 무리는 엇나간 가닥으로 보고 큰 무리만 씀
      if (groups.length === 2 && cfg.dropMixed) {
        var ca = [0, 0, 0], cb = [0, 0, 0];
        groups[0].forEach(function (q0) { ca[0] += q0.ox; ca[1] += q0.oy; ca[2] += q0.oz; }); groups[1].forEach(function (q0) { cb[0] += q0.ox; cb[1] += q0.oy; cb[2] += q0.oz; });
        var na2 = groups[0].length, nb2 = groups[1].length, sx2 = ca[0] / na2 - cb[0] / nb2, sy2 = ca[1] / na2 - cb[1] / nb2, sz2 = ca[2] / na2 - cb[2] / nb2;
        if (sx2 * sx2 + sy2 * sy2 + sz2 * sz2 <= 0.0625 * cs * cs) { groups = [na2 >= nb2 ? groups[0] : groups[1]]; nSplit--; nMixed++; }
      }
      var cell = { ix: c.ix, iy: c.iy, iz: c.iz, cl: [] };
      groups.forEach(function (Gr) {
        // 무리의 "몸통" — 가는 쪽(세 자리)이 무리 평균과 coreDot 이상 같은 가닥만(잔머리·엇나간 가닥은 표에 안 들어감). 평균을 몸통으로 한 번 다시 냄
        //   평균에서 시작하지 않고 "가장 많은 가닥이 같이 가는 쪽"에서 시작합니다(평균은 두 쪽이 섞인 칸에서 아무도 안 가는 가운데가 됨)
        var gm = fmean(Gr).M, core = Gr, pass, j2, r2, o, bb, k2;
        if (Gr.length >= 2 * cfg.minCell) {
          var bestC = -1, bi = 0, lim2 = Math.min(Gr.length, 90), stp = Gr.length / lim2, a3, b3, cnt3;
          for (a3 = 0; a3 < lim2; a3++) {
            var ra = Gr[Math.floor(a3 * stp)]; cnt3 = 0;
            for (b3 = 0; b3 < lim2; b3++) if (fdot(ra.F, Gr[Math.floor(b3 * stp)].F) >= cfg.coreDot) cnt3++;
            if (cnt3 > bestC) { bestC = cnt3; bi = Math.floor(a3 * stp); }
          }
          gm = Gr[bi].F;
        }
        for (pass = 0; pass < 2; pass++) {
          var nx = Gr.filter(function (q0) { return fdot(q0.F, gm) >= cfg.coreDot; });
          if (nx.length < Math.max(cfg.minCell, Math.ceil(Gr.length * 0.3))) nx = Gr.filter(function (q0) { return fdot(q0.F, gm) >= 0.7; });
          if (nx.length < cfg.minCell) { nx = Gr; pass = 2; }
          core = nx; gm = fmean(core).M;
        }
        var cn = core.length, lens = [];
        for (o = 0; o < nb * 4; o++) D[o] = 0;
        for (j2 = 0; j2 < cn; j2++) {
          r2 = core[j2]; lens.push(r2.len);
          var a2 = 0, i3, x2, y2, z2, l2, c0, c1, c2;
          for (i3 = 1; i3 < r2.m; i3++) {
            x2 = r2.N[i3 * 3] - r2.N[i3 * 3 - 3]; y2 = r2.N[i3 * 3 + 1] - r2.N[i3 * 3 - 2]; z2 = r2.N[i3 * 3 + 2] - r2.N[i3 * 3 - 1]; l2 = Math.sqrt(x2 * x2 + y2 * y2 + z2 * z2);
            if (!(l2 > 1e-9)) continue;
            c0 = Math.min(nb - 1, Math.floor(a2 / bin)); a2 += l2; c1 = Math.min(nb - 1, Math.floor((a2 - 1e-9) / bin));
            for (c2 = c0; c2 <= c1; c2++) { o = c2 * 4; D[o] += x2; D[o + 1] += y2; D[o + 2] += z2; D[o + 3] += 1; }
          }
        }
        // 길이 = 몸통 가닥 길이의 lenQ 자리 하나(가닥마다 제각각인 길이는 버림 — 밑단이 들쭉날쭉해지고 긴 꼬리가 생김)
        var L0 = qv(lens, cfg.lenQ), need = Math.min(nb, Math.ceil(L0 * (1 + cfg.lenVar) / bin) + 1), minKeep = Math.max(1, Math.min(3, Math.floor(cn * 0.2)));
        var dirs = [], nbn = 0, vx, vy, vz, vl, lx = 0, ly = -1, lz = 0;
        for (bb = 0; bb < need; bb++) {
          o = bb * 4; vx = D[o]; vy = D[o + 1]; vz = D[o + 2]; vl = Math.sqrt(vx * vx + vy * vy + vz * vz);
          if (!(D[o + 3] >= minKeep) || !(vl > 1e-6)) { if (!nbn) break; vx = lx; vy = ly; vz = lz; vl = 1; }   // 몸통 가닥이 여기까지 안 옴 — 직전 방향 그대로
          lx = vx / vl; ly = vy / vl; lz = vz / vl; dirs.push(lx, ly, lz); nbn++;
        }
        if (!nbn) return;
        var ox = 0, oy = 0, oz = 0;
        for (j2 = 0; j2 < Gr.length; j2++) { r2 = Gr[j2]; ox += r2.ox; oy += r2.oy; oz += r2.oz; }
        cell.cl.push({ n: Gr.length, core: cn, e: [gm[0], gm[1], gm[2]], e2: [gm[6], gm[7], gm[8]], rc: [ox / Gr.length, oy / Gr.length, oz / Gr.length], L: Math.min(L0, nbn * bin), nbn: nbn, d: dirs });
        nUsed += cn;
      });
      if (cell.cl.length) out.push(cell);
    });
    // 이웃 칸과 고르기 — 같은 쪽으로 가는 이웃 무리끼리 방향·길이를 섞어 결이 칸마다 따로 놀지 않게(얽힘 방지). 갈라지는 자리는 안 섞음
    var cmap = new Map(), ci, pi;
    out.forEach(function (c) { cmap.set(keyOf(c.ix, c.iy, c.iz), c); });
    function compat(a, b) { return 0.5 * (a.e[0] * b.e[0] + a.e[1] * b.e[1] + a.e[2] * b.e[2] + a.e2[0] * b.e2[0] + a.e2[1] * b.e2[1] + a.e2[2] * b.e2[2]); }
    // (2026-10-12e) 머리 안쪽의 막다른 짧은 무리 빼기 — 둘레가 두 칸 밖까지 전부 머리인 자리(헤어라인이 아님)인데 길이가 이웃의 deadRatio배도 안 되는 무리.
    //   실측(긴 웨이브·긴 직모): 정수리 앞쪽 가르마 위의 뿌리가 앞으로 걷다가 이마에서 앞 사진에 막혀 5cm쯤에서 끝남 → 마네킹에서 "더듬이"·앞으로 뻗는 가닥.
    //   긴 머리 한가운데의 짧은 가닥은 사진에 보일 수 없는 것이라(긴 머리에 덮임) 읽은 것이 아니라 막힌 것으로 봅니다. 표에서 빼면 그 자리 뿌리는 가까운 이웃 칸의 결·길이를 따릅니다.
    //   헤어라인의 짧은 칸(앞머리·잔머리)은 둘레에 빈 칸이 있어 안 걸립니다.
    var nDead = 0;
    if (cfg.deadEnd && cfg.deadRatio > 0) {
      var ringOk = function (c, kk) {
        var ux = (c.ix + 0.5) * cs, uy = (c.iy + 0.5) * cs, uz = (c.iz + 0.5) * cs, ul = Math.sqrt(ux * ux + uy * uy + uz * uz) || 1, a8, n8 = 0;
        ux /= ul; uy /= ul; uz /= ul;
        var rx = Math.abs(uy) > 0.9 ? 1 : 0, ry = Math.abs(uy) > 0.9 ? 0 : 1, t1x = uy * 0 - uz * ry, t1y = uz * rx - ux * 0, t1z = ux * ry - uy * rx, tl = Math.sqrt(t1x * t1x + t1y * t1y + t1z * t1z) || 1;
        t1x /= tl; t1y /= tl; t1z /= tl;
        var t2x = uy * t1z - uz * t1y, t2y = uz * t1x - ux * t1z, t2z = ux * t1y - uy * t1x;
        for (a8 = 0; a8 < 8; a8++) {
          var ca8 = Math.cos(a8 * Math.PI / 4), sa8 = Math.sin(a8 * Math.PI / 4), px = ux + kk * cs * (ca8 * t1x + sa8 * t2x), py = uy + kk * cs * (ca8 * t1y + sa8 * t2y), pz = uz + kk * cs * (ca8 * t1z + sa8 * t2z), pl = Math.sqrt(px * px + py * py + pz * pz) || 1;
          if (cmap.has(keyOf(Math.floor(px / pl / cs), Math.floor(py / pl / cs), Math.floor(pz / pl / cs)))) n8++;
        }
        return n8;
      };
      var deads = [];
      out.forEach(function (c) {
        var Ls = [], dx, dy, dz, nc, k;
        for (dz = -1; dz <= 1; dz++) for (dy = -1; dy <= 1; dy++) for (dx = -1; dx <= 1; dx++) {
          if (!dx && !dy && !dz) continue;
          nc = cmap.get(keyOf(c.ix + dx, c.iy + dy, c.iz + dz)); if (!nc) continue;
          for (k = 0; k < nc.cl.length; k++) Ls.push(nc.cl[k].L);
        }
        if (Ls.length < 6) return;
        var med = qv(Ls, 0.5), hit = c.cl.filter(function (g) { return g.L < cfg.deadRatio * med; });
        if (!hit.length) return;
        if (ringOk(c, 1.3) < cfg.deadRing || ringOk(c, 2.6) < cfg.deadRing) return;
        deads.push([c, hit]);
      });
      deads.forEach(function (u) {
        var c = u[0]; c.cl = c.cl.filter(function (g) { if (u[1].indexOf(g) >= 0) { nDead++; nUsed -= g.core; return false; } return true; });
        if (!c.cl.length) { cmap.delete(keyOf(c.ix, c.iy, c.iz)); out.splice(out.indexOf(c), 1); }
      });
    }
    // 혼자 긴 칸 누르기 — 같은 쪽으로 가는 이웃 무리들보다 훨씬 긴 칸은(다시 기르기가 밑단을 지나쳐 간 자리) 이웃 길이의 위쪽(75%) × tailCap으로.
    //   짧은 쪽(앞머리 등)은 그대로 둠
    var nTail = 0;
    if (cfg.tailCap > 0) {
      var caps = [];
      out.forEach(function (c) {
        c.cl.forEach(function (g) {
          var Ls = [], dx, dy, dz, nc, k;
          for (dz = -1; dz <= 1; dz++) for (dy = -1; dy <= 1; dy++) for (dx = -1; dx <= 1; dx++) {
            if (!dx && !dy && !dz) continue;
            nc = cmap.get(keyOf(c.ix + dx, c.iy + dy, c.iz + dz)); if (!nc) continue;
            for (k = 0; k < nc.cl.length; k++) if (compat(g, nc.cl[k]) >= cfg.smoothDot) Ls.push(nc.cl[k].L);
          }
          if (Ls.length >= 3) { var cap = qv(Ls, 0.75) * cfg.tailCap; if (g.L > cap) caps.push([g, cap]); }
        });
      });
      caps.forEach(function (u) { u[0].L = u[1]; nTail++; });
    }
    // 혼자 다른 쪽으로 가는 칸 — 둘레의 무리가 lonerMin개 이상인데 같은 쪽으로 가는 이웃이 하나도 없으면, 이웃들 중 가장 여럿이 가는 쪽을 따름
    var nLone = 0;
    if (cfg.lonerMin > 0) {
      var fixes = [];
      out.forEach(function (c) {
        c.cl.forEach(function (g) {
          var Ns = [], dx, dy, dz, nc, k, any = false;
          for (dz = -1; dz <= 1; dz++) for (dy = -1; dy <= 1; dy++) for (dx = -1; dx <= 1; dx++) {
            if (!dx && !dy && !dz) continue;
            nc = cmap.get(keyOf(c.ix + dx, c.iy + dy, c.iz + dz)); if (!nc) continue;
            for (k = 0; k < nc.cl.length; k++) { Ns.push(nc.cl[k]); if (compat(g, nc.cl[k]) >= cfg.smoothDot) any = true; }
          }
          if (any || Ns.length < cfg.lonerMin || c.cl.length > 1) return;
          var best = null, bs = -1, i2, j3, sc;
          for (i2 = 0; i2 < Ns.length; i2++) { sc = 0; for (j3 = 0; j3 < Ns.length; j3++) if (compat(Ns[i2], Ns[j3]) >= cfg.smoothDot) sc += Ns[j3].core; if (sc > bs) { bs = sc; best = Ns[i2]; } }
          if (!best) return;
          var grp = Ns.filter(function (x) { return compat(best, x) >= cfg.smoothDot; });
          if (grp.length < Math.ceil(Ns.length * 0.5)) return;                 // 이웃들도 제각각이면(가마 등) 그대로 둠
          fixes.push([g, grp]);
        });
      });
      fixes.forEach(function (u) {
        var g = u[0], grp = u[1], nbn = g.nbn, nd = new Float32Array(nbn * 3), e = [0, 0, 0], e2 = [0, 0, 0], bb, o, i2, x, w, wn, last;
        for (i2 = 0; i2 < grp.length; i2++) {
          x = grp[i2]; w = Math.min(x.core, 40);
          for (bb = 0; bb < nbn; bb++) { o = bb * 3; last = Math.min(bb, x.nbn - 1) * 3; nd[o] += w * x.d[last]; nd[o + 1] += w * x.d[last + 1]; nd[o + 2] += w * x.d[last + 2]; }
          e[0] += w * x.e[0]; e[1] += w * x.e[1]; e[2] += w * x.e[2]; e2[0] += w * x.e2[0]; e2[1] += w * x.e2[1]; e2[2] += w * x.e2[2];
        }
        for (bb = 0; bb < nbn; bb++) { o = bb * 3; wn = Math.sqrt(nd[o] * nd[o] + nd[o + 1] * nd[o + 1] + nd[o + 2] * nd[o + 2]) || 1; nd[o] /= wn; nd[o + 1] /= wn; nd[o + 2] /= wn; }
        wn = Math.hypot(e[0], e[1], e[2]) || 1; g.e = [e[0] / wn, e[1] / wn, e[2] / wn]; wn = Math.hypot(e2[0], e2[1], e2[2]) || 1; g.e2 = [e2[0] / wn, e2[1] / wn, e2[2] / wn];
        g.d = Array.prototype.slice.call(nd); nLone++;
      });
    }
    // (2026-10-08i) 작은 무리는 이웃을 따름 — 원본 가닥이 몇 올뿐인 칸(헤어라인 가장자리 등)의 결은 그 몇 올의 잡음인데, 마네킹은 그 칸에도 가닥을 고르게 심어서
    //   잔머리 몇 올이 "따로 내려오는 줄"로 불어납니다(실제: 긴 직모 원본 머리에서 몸통 옆으로 나란히 내려오는 가닥 대여섯 올 · 넘기기로도 안 눕음 —
    //   갈라지는 자리가 몸통 속이라서). 몸통 가닥 수가 보통 칸의 smallFrac 미만인 무리는, 같은 쪽으로 가는(smoothDot 이상) "작지 않은" 이웃 무리가 있으면
    //   제 방향을 버리고 그 이웃들의 방향을 씁니다(길이는 제 것 그대로). 같은 쪽 이웃이 없는 작은 무리(성긴 앞머리 등)는 그대로 둡니다.
    var nSmall = 0;
    if (cfg.smallFrac > 0) {
      var allCore = []; out.forEach(function (c) { c.cl.forEach(function (g) { allCore.push(g.core); }); });
      var smallN = Math.max(cfg.minCell + 1, qv(allCore, 0.5) * cfg.smallFrac), sf = [];
      out.forEach(function (c) {
        c.cl.forEach(function (g) {
          if (g.core >= smallN) return;
          var grp = [], dx, dy, dz, nc, k, x;
          for (dz = -1; dz <= 1; dz++) for (dy = -1; dy <= 1; dy++) for (dx = -1; dx <= 1; dx++) {
            if (!dx && !dy && !dz) continue;
            nc = cmap.get(keyOf(c.ix + dx, c.iy + dy, c.iz + dz)); if (!nc) continue;
            for (k = 0; k < nc.cl.length; k++) { x = nc.cl[k]; if (x.core >= smallN && compat(g, x) >= cfg.smoothDot) grp.push([x, WN[Math.abs(dx) + Math.abs(dy) + Math.abs(dz)]]); }
          }
          if (grp.length) sf.push([g, grp]);
        });
      });
      sf.forEach(function (u) {
        var g = u[0], grp = u[1], nbn = g.nbn, nd = new Float32Array(nbn * 3), e = [0, 0, 0], e2 = [0, 0, 0], bb, o, i2, x, w, wn, last;
        for (i2 = 0; i2 < grp.length; i2++) {
          x = grp[i2][0]; w = Math.min(x.core, 40) * grp[i2][1];
          for (bb = 0; bb < nbn; bb++) { o = bb * 3; last = Math.min(bb, x.nbn - 1) * 3; nd[o] += w * x.d[last]; nd[o + 1] += w * x.d[last + 1]; nd[o + 2] += w * x.d[last + 2]; }
          e[0] += w * x.e[0]; e[1] += w * x.e[1]; e[2] += w * x.e[2]; e2[0] += w * x.e2[0]; e2[1] += w * x.e2[1]; e2[2] += w * x.e2[2];
        }
        for (bb = 0; bb < nbn; bb++) { o = bb * 3; wn = Math.sqrt(nd[o] * nd[o] + nd[o + 1] * nd[o + 1] + nd[o + 2] * nd[o + 2]); if (!(wn > 1e-6)) { nd[o] = g.d[o]; nd[o + 1] = g.d[o + 1]; nd[o + 2] = g.d[o + 2]; } else { nd[o] /= wn; nd[o + 1] /= wn; nd[o + 2] /= wn; } }
        wn = Math.hypot(e[0], e[1], e[2]); if (wn > 1e-6) g.e = [e[0] / wn, e[1] / wn, e[2] / wn];
        wn = Math.hypot(e2[0], e2[1], e2[2]); if (wn > 1e-6) g.e2 = [e2[0] / wn, e2[1] / wn, e2[2] / wn];
        g.d = Array.prototype.slice.call(nd); nSmall++;
      });
    }
    for (pi = 0; pi < (cfg.smoothPasses | 0); pi++) {
      var upd = [];
      out.forEach(function (c) {
        c.cl.forEach(function (g) {
          var nd = new Float32Array(g.nbn * 3), wl = Math.min(g.core, 40), sl = g.L * wl, dx, dy, dz, nc, k, gj, w, bb, o, dt, wn, lim;
          for (bb = 0; bb < g.nbn * 3; bb++) nd[bb] = g.d[bb] * wl;
          for (dz = -1; dz <= 1; dz++) for (dy = -1; dy <= 1; dy++) for (dx = -1; dx <= 1; dx++) {
            if (!dx && !dy && !dz) continue;
            nc = cmap.get(keyOf(c.ix + dx, c.iy + dy, c.iz + dz)); if (!nc) continue;
            for (k = 0; k < nc.cl.length; k++) {
              gj = nc.cl[k]; if (compat(g, gj) < cfg.smoothDot) continue;
              w = Math.min(gj.core, 40) * WN[Math.abs(dx) + Math.abs(dy) + Math.abs(dz)];
              lim = Math.min(g.nbn, gj.nbn);
              for (bb = 0; bb < lim; bb++) {
                o = bb * 3; dt = g.d[o] * gj.d[o] + g.d[o + 1] * gj.d[o + 1] + g.d[o + 2] * gj.d[o + 2];
                if (dt < cfg.binGate) continue;                              // 이 길이 칸에서는 갈라짐 — 안 섞음
                nd[o] += w * gj.d[o]; nd[o + 1] += w * gj.d[o + 1]; nd[o + 2] += w * gj.d[o + 2];
              }
              if (Math.abs(gj.L - g.L) <= cfg.lenStep * Math.max(g.L, gj.L)) { sl += gj.L * w; wl += w; }   // 길이가 확 다른 이웃(앞머리 ↔ 긴 머리)은 길이를 안 섞음
            }
          }
          for (bb = 0; bb < g.nbn; bb++) { o = bb * 3; wn = Math.sqrt(nd[o] * nd[o] + nd[o + 1] * nd[o + 1] + nd[o + 2] * nd[o + 2]) || 1; nd[o] /= wn; nd[o + 1] /= wn; nd[o + 2] /= wn; }
          upd.push([g, nd, sl / wl]);
        });
      });
      upd.forEach(function (u) { u[0].d = Array.prototype.slice.call(u[1]); u[0].L = Math.min(u[2], u[0].nbn * bin); });
    }
    // 길이 분포(5자리)는 고른 길이 둘레의 좁은 띠로 — 가닥마다 ±lenVar만 다름
    out.forEach(function (c) { c.cl.forEach(function (g) { var v = cfg.lenVar; g.q = [g.L * (1 - v), g.L * (1 - v / 2), g.L, g.L * (1 + v / 2), g.L * (1 + v)]; }); });
    return { cs: cs, bin: bin, nb: nb, cells: out, stats: { strands: recs.length, used: nUsed, cells: out.length, split: nSplit, skipped: nSkipCell, maxLen: maxLen, tailCells: nTail, mixed: nMixed, lone: nLone, small: nSmall, dead: nDead } };
  }

  /* ------------------------------------------------------------------------------------------------------------
   * 싣기 / 풀기 — 무리 하나 = [ix,iy,iz, 무리번호|무리수<<1, n, e×3, e2×3, rc×3, q×5, nbn, 방향 nbn×3] (전부 1바이트 · v1에는 e2가 없음)
   * ---------------------------------------------------------------------------------------------------------- */
  function c8(v) { v = Math.round(v * 127); return v < -127 ? -127 : v > 127 ? 127 : v; }
  function b64(u8) { var s = '', i, CH = 0x8000; for (i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH)); return btoa(s); }
  function unb64(s) { var b = atob(s), u = new Uint8Array(b.length), i; for (i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  function encode(t) {
    var lmax = 0, tot = 0, nrec = 0;
    t.cells.forEach(function (c) { c.cl.forEach(function (g) { if (g.q[4] > lmax) lmax = g.q[4]; tot += 20 + g.nbn * 3; nrec++; }); });
    if (!(lmax > 0)) lmax = t.bin;
    var u = new Uint8Array(tot), I = new Int8Array(u.buffer), o = 0;
    t.cells.forEach(function (c) {
      c.cl.forEach(function (g, gi) {
        var k;
        I[o++] = c.ix; I[o++] = c.iy; I[o++] = c.iz; u[o++] = gi | (c.cl.length << 1); u[o++] = Math.min(255, g.n);
        for (k = 0; k < 3; k++) I[o++] = c8(g.e[k]);
        for (k = 0; k < 3; k++) I[o++] = c8(g.e2[k]);
        for (k = 0; k < 3; k++) I[o++] = c8(g.rc[k] / t.cs);
        for (k = 0; k < 5; k++) u[o++] = Math.max(0, Math.min(255, Math.round(g.q[k] / lmax * 255)));
        u[o++] = g.nbn;
        for (k = 0; k < g.nbn * 3; k++) I[o++] = c8(g.d[k]);
      });
    });
    return { v: 2, cs: t.cs, bin: t.bin, lmax: +lmax.toFixed(4), n: nrec, d: b64(u) };
  }
  var RT = (typeof WeakMap === 'function') ? new WeakMap() : null, RTs = { s: null, t: null };
  function decode(f) {
    if (!f || (f.v !== 1 && f.v !== 2) || typeof f.d !== 'string') return null;
    var hit = RT ? RT.get(f) : null; if (hit) return hit;
    if (RTs.s === f.d) { if (RT) RT.set(f, RTs.t); return RTs.t; }        // 같은 표를 복사한 스펙(JSON 복제)
    var u = unb64(f.d), I = new Int8Array(u.buffer), o = 0, map = new Map(), k, nrec = 0, HD = f.v >= 2 ? 20 : 17;
    while (o + HD <= u.length) {
      var ix = I[o++], iy = I[o++], iz = I[o++], fl = u[o++], n = u[o++], e = [I[o++] / 127, I[o++] / 127, I[o++] / 127];
      var e2 = f.v >= 2 ? [I[o++] / 127, I[o++] / 127, I[o++] / 127] : e;
      var rc = [I[o++] / 127 * f.cs, I[o++] / 127 * f.cs, I[o++] / 127 * f.cs], q = new Float32Array(5);
      for (k = 0; k < 5; k++) q[k] = u[o++] / 255 * f.lmax;
      var nbn = u[o++]; if (o + nbn * 3 > u.length) break;
      var d = new Float32Array(nbn * 3), l;
      for (k = 0; k < nbn; k++) { d[k * 3] = I[o++]; d[k * 3 + 1] = I[o++]; d[k * 3 + 2] = I[o++]; l = Math.sqrt(d[k * 3] * d[k * 3] + d[k * 3 + 1] * d[k * 3 + 1] + d[k * 3 + 2] * d[k * 3 + 2]) || 1; d[k * 3] /= l; d[k * 3 + 1] /= l; d[k * 3 + 2] /= l; }
      var key = keyOf(ix, iy, iz), c = map.get(key);
      if (!c) { c = { ix: ix, iy: iy, iz: iz, cl: [] }; map.set(key, c); }
      c.cl[fl & 1] = { n: n, e: e, e2: e2, rc: rc, q: q, nbn: nbn, d: d }; nrec++;
    }
    map.forEach(function (c) { c.cl = c.cl.filter(Boolean); });
    var t = { cs: f.cs, bin: f.bin, lmax: f.lmax, map: map, n: nrec };
    if (RT) RT.set(f, t); RTs.s = f.d; RTs.t = t;
    return t;
  }

  /* ------------------------------------------------------------------------------------------------------------
   * 뼈대 걷기 — root: 가닥 뿌리(모델 좌표) · h: 0~1(길이 분포에서 뽑을 자리) · t: 풀어 둔 표 · E, CY: 걸 두상
   *   lenOver(같은 좌표의 길이)가 있으면 길이 분포 대신 그 길이로(진단용). 못 만들면 null.
   * ---------------------------------------------------------------------------------------------------------- */
  var _C = new Array(8), _G = new Array(8), _Wt = new Float64Array(8);
  function pickCluster(c, ox, oy, oz, h, cs) {
    if (c.cl.length < 2) return c.cl[0];
    var A = c.cl[0], B = c.cl[1], sx = A.rc[0] - B.rc[0], sy = A.rc[1] - B.rc[1], sz = A.rc[2] - B.rc[2];
    if (sx * sx + sy * sy + sz * sz > 0.0625 * cs * cs) {                 // 두 무리의 뿌리 자리가 떨어져 있음(가르마) — 가까운 쪽
      var da = (ox - A.rc[0]) * (ox - A.rc[0]) + (oy - A.rc[1]) * (oy - A.rc[1]) + (oz - A.rc[2]) * (oz - A.rc[2]);
      var db = (ox - B.rc[0]) * (ox - B.rc[0]) + (oy - B.rc[1]) * (oy - B.rc[1]) + (oz - B.rc[2]) * (oz - B.rc[2]);
      return da <= db ? A : B;
    }
    return h < A.n / (A.n + B.n) ? A : B;                                 // 섞여 있음 — 비율대로
  }
  function quant(q, h) { var f = (h < 0 ? 0 : h > 1 ? 1 : h) * 4, i = Math.min(3, Math.floor(f)), t = f - i; return q[i] + (q[i + 1] - q[i]) * t; }
  function shape(root, h, t, E, CY, lenOver, cfg, guard) {
    cfg = cfg || FS;
    var cs = t.cs, bin = t.bin, nx = root.x / E.a, ny = (root.y - CY) / E.b, nz = root.z / E.c, rl = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (!(rl > 0.2)) return null;
    var ux = nx / rl, uy = ny / rl, uz = nz / rl, hx = Math.floor(ux / cs), hy = Math.floor(uy / cs), hz = Math.floor(uz / cs);
    var gx = ux / cs - 0.5, gy = uy / cs - 0.5, gz = uz / cs - 0.5, x0 = Math.floor(gx), y0 = Math.floor(gy), z0 = Math.floor(gz), fx = gx - x0, fy = gy - y0, fz = gz - z0;
    var home = t.map.get(keyOf(hx, hy, hz)), k, dx, dy, dz, c, w, best = -1, i;
    if (!home) {                                                           // 제 칸에 표가 없음 — 둘레 8칸 중 가장 가까운 칸, 없으면 2칸 둘레까지
      for (k = 0; k < 8; k++) {
        dx = k & 1; dy = (k >> 1) & 1; dz = (k >> 2) & 1; c = t.map.get(keyOf(x0 + dx, y0 + dy, z0 + dz)); if (!c) continue;
        w = (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy) * (dz ? fz : 1 - fz); if (w > best) { best = w; home = c; }
      }
      if (!home) {
        var bd = 1e9, ddx, ddy, ddz, dd;
        for (dz = -2; dz <= 2; dz++) for (dy = -2; dy <= 2; dy++) for (dx = -2; dx <= 2; dx++) {
          c = t.map.get(keyOf(hx + dx, hy + dy, hz + dz)); if (!c) continue;
          ddx = (hx + dx + 0.5) * cs - ux; ddy = (hy + dy + 0.5) * cs - uy; ddz = (hz + dz + 0.5) * cs - uz; dd = ddx * ddx + ddy * ddy + ddz * ddz;
          if (dd < bd) { bd = dd; home = c; }
        }
        if (!home) return null;
      }
    }
    var H = pickCluster(home, ux - (home.ix + 0.5) * cs, uy - (home.iy + 0.5) * cs, uz - (home.iz + 0.5) * cs, h, cs), e = H.e, e2 = H.e2, nC = 0, wsum = 0, g, j, dt, bdot, iH = 0;
    for (k = 0; k < 8; k++) {
      dx = k & 1; dy = (k >> 1) & 1; dz = (k >> 2) & 1; c = t.map.get(keyOf(x0 + dx, y0 + dy, z0 + dz)); if (!c) continue;
      w = (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy) * (dz ? fz : 1 - fz); if (!(w > 1e-4)) continue;
      if (c === home) { g = H; iH = nC; }
      else {
        g = null; bdot = cfg.matchDot;
        for (j = 0; j < c.cl.length; j++) {
          var cj = c.cl[j]; dt = 0.5 * (cj.e[0] * e[0] + cj.e[1] * e[1] + cj.e[2] * e[2] + cj.e2[0] * e2[0] + cj.e2[1] * e2[1] + cj.e2[2] * e2[2]);
          if (dt >= bdot && cj.e2[0] * e2[0] + cj.e2[1] * e2[1] + cj.e2[2] * e2[2] >= 0.3) { bdot = dt; g = cj; }
        }
        if (!g) continue;
      }
      w *= Math.min(1, g.n / 6); _C[nC] = c; _G[nC] = g; _Wt[nC] = w; wsum += w; nC++;
    }
    if (!nC || !(wsum > 1e-6) || _G[iH] !== H) { _G[0] = H; _Wt[0] = 1; wsum = 1; nC = 1; iH = 0; }
    var len = 0;
    if (lenOver > 0) len = lenOver; else { for (i = 0; i < nC; i++) len += _Wt[i] * quant(_G[i].q, h); len /= wsum; }
    if (!(lenOver > 0) && cfg.lenOwnOnly) len = quant(H.q, h);
    if (!(lenOver > 0) && cfg.lenOwnCap > 0) { var lenOwn = quant(H.q, h) * cfg.lenOwnCap; if (len > lenOwn) { len = lenOwn; if (cfg === FS) ST.lenCapped = (ST.lenCapped || 0) + 1; } }   // (2026-10-12c) 제 칸 길이보다 훨씬 길게는 이웃에서 끌어오지 않음 — 머리선의 짧은 칸(짧게 심은·옆으로 눕힌 가닥)이 이웃의 긴 길이를 받아 제 방향 그대로 허공으로 뻗던 것(가시·더듬이)
    if (!(len > 1e-4)) return null;
    var n = Math.max(cfg.minPts, Math.min(cfg.maxPts, Math.round(len / cfg.step))), ds = len / n, out = new Array(n + 1);
    var px = nx, py = ny, pz = nz, vx = e[0], vy = e[1], vz = e[2], s, fb, b0, tt, ax, ay, az, al, bA, bB, d, pl;
    out[0] = { x: root.x, y: root.y, z: root.z };
    for (k = 0; k < n; k++) {
      s = (k + 0.5) * ds; fb = s / bin - 0.5; b0 = Math.floor(fb); tt = fb - b0; if (b0 < 0) { b0 = 0; tt = 0; }
      // 제 칸(제 무리)의 방향을 먼저 — 이웃 칸은 이 자리에서 방향이 binGate 안으로 같을 때만 섞음
      g = H; d = g.d; bA = b0 < g.nbn ? b0 : g.nbn - 1; bB = b0 + 1 < g.nbn ? b0 + 1 : g.nbn - 1; w = _Wt[iH];
      var qx = d[bA * 3] + (d[bB * 3] - d[bA * 3]) * tt, qy = d[bA * 3 + 1] + (d[bB * 3 + 1] - d[bA * 3 + 1]) * tt, qz = d[bA * 3 + 2] + (d[bB * 3 + 2] - d[bA * 3 + 2]) * tt, ql = Math.sqrt(qx * qx + qy * qy + qz * qz) || 1, cx, cy, cz, cl2;
      ax = w * qx; ay = w * qy; az = w * qz;
      for (i = 0; i < nC; i++) {
        if (i === iH) continue;
        g = _G[i]; d = g.d; if (b0 >= g.nbn) continue;                       // 이웃 칸의 표가 여기까지 안 옴 — 안 섞음
        bA = b0; bB = b0 + 1 < g.nbn ? b0 + 1 : g.nbn - 1; w = _Wt[i];
        cx = d[bA * 3] + (d[bB * 3] - d[bA * 3]) * tt; cy = d[bA * 3 + 1] + (d[bB * 3 + 1] - d[bA * 3 + 1]) * tt; cz = d[bA * 3 + 2] + (d[bB * 3 + 2] - d[bA * 3 + 2]) * tt; cl2 = Math.sqrt(cx * cx + cy * cy + cz * cz) || 1;
        if ((cx * qx + cy * qy + cz * qz) / (cl2 * ql) < cfg.binGate) continue;
        ax += w * cx; ay += w * cy; az += w * cz;
      }
      al = Math.sqrt(ax * ax + ay * ay + az * az);
      if (al > 1e-4) { vx = ax / al; vy = ay / al; vz = az / al; }
      px += vx * ds; py += vy * ds; pz += vz * ds;
      pl = Math.sqrt(px * px + py * py + pz * pz);
      if (pl < 1 && pl > 1e-6) { px /= pl; py /= pl; pz /= pl; }           // 두피 속으로는 안 감
      var pt = { x: px * E.a, y: CY + py * E.b, z: pz * E.c };
      if (guard) { var pg = guard(pt); if (pg && pg !== pt) { pt = pg; px = pt.x / E.a; py = (pt.y - CY) / E.b; pz = pt.z / E.c; } }   // 목 속으로는 안 감
      out[k + 1] = pt;
    }
    return out;
  }
  /* 한 뿌리 자리에서 표의 결을 읽는 도구 — dir(s, o): 뿌리에서 s만큼 간 자리의 방향을 o[0..2]에 · L: 그 자리의 길이(표의 가운데 값). 표가 없으면 null.
     고르는 규칙은 shape()와 같습니다(제 칸의 무리 + 같은 쪽으로 가는 둘레 칸 · 길이 칸마다 binGate) */
  function sampler(root, h, t, E, CY, cfg) {
    cfg = cfg || FS;
    var cs = t.cs, bin = t.bin, nx = root.x / E.a, ny = (root.y - CY) / E.b, nz = root.z / E.c, rl = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (!(rl > 0.2)) return null;
    var ux = nx / rl, uy = ny / rl, uz = nz / rl, hx = Math.floor(ux / cs), hy = Math.floor(uy / cs), hz = Math.floor(uz / cs);
    var gx = ux / cs - 0.5, gy = uy / cs - 0.5, gz = uz / cs - 0.5, x0 = Math.floor(gx), y0 = Math.floor(gy), z0 = Math.floor(gz), fx = gx - x0, fy = gy - y0, fz = gz - z0;
    var home = t.map.get(keyOf(hx, hy, hz)), k, dx, dy, dz, c, w, best = -1;
    if (!home) {
      for (k = 0; k < 8; k++) {
        dx = k & 1; dy = (k >> 1) & 1; dz = (k >> 2) & 1; c = t.map.get(keyOf(x0 + dx, y0 + dy, z0 + dz)); if (!c) continue;
        w = (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy) * (dz ? fz : 1 - fz); if (w > best) { best = w; home = c; }
      }
      if (!home) {
        var bd = 1e9, ddx, ddy, ddz, dd;
        for (dz = -2; dz <= 2; dz++) for (dy = -2; dy <= 2; dy++) for (dx = -2; dx <= 2; dx++) {
          c = t.map.get(keyOf(hx + dx, hy + dy, hz + dz)); if (!c) continue;
          ddx = (hx + dx + 0.5) * cs - ux; ddy = (hy + dy + 0.5) * cs - uy; ddz = (hz + dz + 0.5) * cs - uz; dd = ddx * ddx + ddy * ddy + ddz * ddz;
          if (dd < bd) { bd = dd; home = c; }
        }
        if (!home) return null;
      }
    }
    var H = pickCluster(home, ux - (home.ix + 0.5) * cs, uy - (home.iy + 0.5) * cs, uz - (home.iz + 0.5) * cs, h, cs), e = H.e, e2 = H.e2, Gs = [H], Ws = [0], g, j, dt, bdot, hasHome = false;
    for (k = 0; k < 8; k++) {
      dx = k & 1; dy = (k >> 1) & 1; dz = (k >> 2) & 1; c = t.map.get(keyOf(x0 + dx, y0 + dy, z0 + dz)); if (!c) continue;
      w = (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy) * (dz ? fz : 1 - fz); if (!(w > 1e-4)) continue;
      if (c === home) { Ws[0] = w * Math.min(1, H.n / 6); hasHome = true; continue; }
      g = null; bdot = cfg.matchDot;
      for (j = 0; j < c.cl.length; j++) {
        var cj = c.cl[j]; dt = 0.5 * (cj.e[0] * e[0] + cj.e[1] * e[1] + cj.e[2] * e[2] + cj.e2[0] * e2[0] + cj.e2[1] * e2[1] + cj.e2[2] * e2[2]);
        if (dt >= bdot && cj.e2[0] * e2[0] + cj.e2[1] * e2[1] + cj.e2[2] * e2[2] >= 0.3) { bdot = dt; g = cj; }
      }
      if (!g) continue;
      Gs.push(g); Ws.push(w * Math.min(1, g.n / 6));
    }
    if (!hasHome || !(Ws[0] > 1e-6)) { Gs = [H]; Ws = [1]; }
    var wsum = 0, Lm = 0, i, nC = Gs.length;
    for (i = 0; i < nC; i++) { wsum += Ws[i]; Lm += Ws[i] * Gs[i].q[2]; }
    return {
      L: Lm / (wsum || 1),
      dir: function (s, o) {
        var fb = s / bin - 0.5, b0 = Math.floor(fb), tt = fb - b0, d = H.d, bA, bB, i2, g2, w2, cx, cy, cz, cl2; if (b0 < 0) { b0 = 0; tt = 0; }
        bA = b0 < H.nbn ? b0 : H.nbn - 1; bB = b0 + 1 < H.nbn ? b0 + 1 : H.nbn - 1;
        var qx = d[bA * 3] + (d[bB * 3] - d[bA * 3]) * tt, qy = d[bA * 3 + 1] + (d[bB * 3 + 1] - d[bA * 3 + 1]) * tt, qz = d[bA * 3 + 2] + (d[bB * 3 + 2] - d[bA * 3 + 2]) * tt, ql = Math.sqrt(qx * qx + qy * qy + qz * qz) || 1;
        var ax = Ws[0] * qx, ay = Ws[0] * qy, az = Ws[0] * qz, al;
        for (i2 = 1; i2 < nC; i2++) {
          g2 = Gs[i2]; d = g2.d; if (b0 >= g2.nbn) continue;
          bA = b0; bB = b0 + 1 < g2.nbn ? b0 + 1 : g2.nbn - 1; w2 = Ws[i2];
          cx = d[bA * 3] + (d[bB * 3] - d[bA * 3]) * tt; cy = d[bA * 3 + 1] + (d[bB * 3 + 1] - d[bA * 3 + 1]) * tt; cz = d[bA * 3 + 2] + (d[bB * 3 + 2] - d[bA * 3 + 2]) * tt; cl2 = Math.sqrt(cx * cx + cy * cy + cz * cz) || 1;
          if ((cx * qx + cy * qy + cz * qz) / (cl2 * ql) < cfg.binGate) continue;
          ax += w2 * cx; ay += w2 * cy; az += w2 * cz;
        }
        al = Math.sqrt(ax * ax + ay * ay + az * az);
        if (al > 1e-4) { o[0] = ax / al; o[1] = ay / al; o[2] = az / al; } else { o[0] = qx / ql; o[1] = qy / ql; o[2] = qz / ql; }
        return o;
      }
    };
  }
  /* 제 머리 가닥의 "큰 흐름"만 스타일 표로 바꿈 — 마디마다 (제 칸의 결 → 스타일의 결) 만큼 돌리고, 그 가닥이 제 결에서 벗어나 있던 만큼(잔 차이)은 그대로 둡니다.
     pts: 다시 기른 가닥(모델 좌표) · own: 이 손님 표의 sampler(없으면 안 돌림) · sty: 스타일 표의 sampler · 길이는 (스타일 길이 ÷ 제 칸 길이) 배로 */
  function resteer(pts, own, sty, E, CY, cfg, guard) {
    cfg = cfg || FS;
    var m = pts.length; if (m < 2 || !sty) return null;
    var ia = 1 / E.a, ib = 1 / E.b, ic = 1 / E.c, i, A = 0, L = new Float64Array(m), U = new Float64Array(m * 3), dx, dy, dz, l;
    for (i = 1; i < m; i++) {
      dx = (pts[i].x - pts[i - 1].x) * ia; dy = (pts[i].y - pts[i - 1].y) * ib; dz = (pts[i].z - pts[i - 1].z) * ic; l = Math.sqrt(dx * dx + dy * dy + dz * dz);
      L[i] = l; A += l; if (l > 1e-9) { U[i * 3] = dx / l; U[i * 3 + 1] = dy / l; U[i * 3 + 2] = dz / l; }
    }
    if (!(A > 1e-6)) return null;
    var ratio = (own && own.L > 1e-3 && sty.L > 1e-3) ? sty.L / own.L : 1;
    if (ratio < cfg.natLenMin) ratio = cfg.natLenMin; if (ratio > cfg.natLenMax) ratio = cfg.natLenMax;
    var T = A * ratio;
    // (2026-10-07g) 혼자 긴 가닥 누르기 — 제 칸보다 몇 배 긴 가닥(잔머리·지나쳐 기른 가닥)에 길이 배수를 그대로 곱하면 스타일보다 훨씬 긴 꼬리가 됨
    //   (실제: 짧은 머리 남자에 긴 펌 스타일 → 가슴 아래까지 늘어진 곧은 가닥 몇 줄). 늘리는 경우에만, 스타일 칸 길이 × natTail까지만.
    //   배수가 1(같은 길이의 스타일)이면 손님 가닥 그대로이고, 배수 natTailFull 이상에서 온전히 누름(사이는 서서히 — 뚝 끊기지 않게).
    if (cfg.natTail > 0 && ratio > 1 && own && own.L > 1e-3 && sty.L > 1e-3) {
      var fOwn = A / own.L;
      if (fOwn > cfg.natTail) {
        var tk = (ratio - 1) / Math.max(1e-3, (cfg.natTailFull || 2) - 1); if (tk > 1) tk = 1;
        var capT = sty.L * (cfg.natTail + (fOwn - cfg.natTail) * (1 - tk));
        if (T > capT) { T = Math.max(A, capT); if (cfg._st) cfg._st.tailCut = (cfg._st.tailCut || 0) + 1; }
      }
    }
    var out = [{ x: pts[0].x, y: pts[0].y, z: pts[0].z }], px = pts[0].x * ia, py = (pts[0].y - CY) * ib, pz = pts[0].z * ic, arc = 0, mo = [0, -1, 0], ms = [0, -1, 0];
    var cMax = Math.cos(cfg.natResMax * Math.PI / 180), sMax = Math.sin(cfg.natResMax * Math.PI / 180), ux, uy, uz, c, qx, qy, qz, ql, kx, ky, kz, sn, cs2, kd, vx, vy, vz, step, pl, pt, pg;
    function put() {
      pl = Math.sqrt(px * px + py * py + pz * pz);
      if (pl < 1 && pl > 1e-6) { px /= pl; py /= pl; pz /= pl; }
      pt = { x: px * E.a, y: CY + py * E.b, z: pz * E.c };
      if (guard) { pg = guard(pt); if (pg && pg !== pt) { pt = pg; px = pt.x * ia; py = (pt.y - CY) * ib; pz = pt.z * ic; } }
      out.push(pt);
    }
    for (i = 1; i < m; i++) {
      l = L[i]; if (!(l > 1e-9)) continue;
      step = Math.min(l, T - arc); if (!(step > 1e-6)) break;
      sty.dir(arc + step * 0.5, ms); if (own) own.dir(arc + step * 0.5, mo); else { mo[0] = ms[0]; mo[1] = ms[1]; mo[2] = ms[2]; }
      ux = U[i * 3]; uy = U[i * 3 + 1]; uz = U[i * 3 + 2];
      c = ux * mo[0] + uy * mo[1] + uz * mo[2];
      if (c < cMax) {                                                        // 제 결에서 natResMax° 넘게 벗어난 마디(거꾸로 간 가닥 등)는 그 각까지만 인정
        qx = ux - c * mo[0]; qy = uy - c * mo[1]; qz = uz - c * mo[2]; ql = Math.sqrt(qx * qx + qy * qy + qz * qz);
        if (ql > 1e-6) { ux = mo[0] * cMax + qx / ql * sMax; uy = mo[1] * cMax + qy / ql * sMax; uz = mo[2] * cMax + qz / ql * sMax; } else { ux = mo[0]; uy = mo[1]; uz = mo[2]; }
      }
      // mo → ms로 가는 가장 작은 회전을 이 마디에 그대로
      cs2 = mo[0] * ms[0] + mo[1] * ms[1] + mo[2] * ms[2];
      if (cs2 < 0.99999) {
        kx = mo[1] * ms[2] - mo[2] * ms[1]; ky = mo[2] * ms[0] - mo[0] * ms[2]; kz = mo[0] * ms[1] - mo[1] * ms[0]; sn = Math.sqrt(kx * kx + ky * ky + kz * kz);
        if (sn > 1e-6) {
          kx /= sn; ky /= sn; kz /= sn; kd = kx * ux + ky * uy + kz * uz;
          vx = ux * cs2 + (ky * uz - kz * uy) * sn + kx * kd * (1 - cs2); vy = uy * cs2 + (kz * ux - kx * uz) * sn + ky * kd * (1 - cs2); vz = uz * cs2 + (kx * uy - ky * ux) * sn + kz * kd * (1 - cs2);
          ux = vx; uy = vy; uz = vz;
        } else { ux = ms[0]; uy = ms[1]; uz = ms[2]; }
      }
      if (cfg.natUpK > 0 && uy > 0) {                                        // (2026-10-10a) 머리 겉면 밖에서는 위로 안 가고 아래로 꺾임 — 곱슬 표의 헤매는 결이 긴 머리에서 정수리 위로 솟는 막대가 되던 것
        var kq = Math.sqrt(px * px + py * py + pz * pz);
        if (kq > cfg.natUpK) { var wu = Math.min(1, (kq - cfg.natUpK) / 0.08); uy *= (1 - 2 * wu); var lu = Math.sqrt(ux * ux + uy * uy + uz * uz); if (lu > 1e-6) { ux /= lu; uy /= lu; uz /= lu; } else { ux = 0; uy = -1; uz = 0; } if (cfg._st && wu > 0) cfg._st.upCut = (cfg._st.upCut || 0) + 1; }
      }
      px += ux * step; py += uy * step; pz += uz * step; arc += step; put();
    }
    if (T - arc > 1e-3) {                                                    // 스타일이 더 긺 — 스타일의 결을 따라 이어 기름
      var avg = A / Math.max(1, m - 1), nx2 = Math.min(80, Math.max(1, Math.ceil((T - arc) / Math.max(avg, 1e-3)))), ds = (T - arc) / nx2, k;
      for (k = 0; k < nx2; k++) {
        sty.dir(arc + ds * 0.5, ms);
        if (cfg.natUpK > 0 && ms[1] > 0) { var kq2 = Math.sqrt(px * px + py * py + pz * pz); if (kq2 > cfg.natUpK) { var wu2 = Math.min(1, (kq2 - cfg.natUpK) / 0.08), my = ms[1] * (1 - 2 * wu2), lm = Math.sqrt(ms[0] * ms[0] + my * my + ms[2] * ms[2]) || 1; ms[0] /= lm; ms[1] = my / lm; ms[2] /= lm; } }
        px += ms[0] * ds; py += ms[1] * ds; pz += ms[2] * ds; arc += ds; put();
      }
    }
    return out.length >= 2 ? out : null;
  }
  FS._core = { buildTable: buildTable, encode: encode, decode: decode, shape: shape, hash01: hash01, sampler: sampler, resteer: resteer };

  /* 진단: 원래 가닥을 표로 다시 만들어 얼마나 다른가(모델 단위) */
  function fidelity(strands, t, E, CY, maxN) {
    var n = strands.length, stride = Math.max(1, Math.ceil(n / Math.max(1, maxN))), mean = [], tip = [], si, i, miss = 0;
    function arcOf(p, sc) { var L = 0, k, dx, dy, dz; for (k = 1; k < p.length; k++) { dx = (p[k].x - p[k - 1].x) / (sc ? E.a : 1); dy = (p[k].y - p[k - 1].y) / (sc ? E.b : 1); dz = (p[k].z - p[k - 1].z) / (sc ? E.c : 1); L += Math.sqrt(dx * dx + dy * dy + dz * dz); } return L; }
    function at(p, L, f) {
      var want = L * f, acc = 0, k, l;
      for (k = 1; k < p.length; k++) { l = Math.hypot(p[k].x - p[k - 1].x, p[k].y - p[k - 1].y, p[k].z - p[k - 1].z); if (acc + l >= want && l > 0) { var u = (want - acc) / l; return { x: p[k - 1].x + (p[k].x - p[k - 1].x) * u, y: p[k - 1].y + (p[k].y - p[k - 1].y) * u, z: p[k - 1].z + (p[k].z - p[k - 1].z) * u }; } acc += l; }
      return p[p.length - 1];
    }
    for (si = 0; si < n; si += stride) {
      var p = strands[si] && strands[si].pts; if (!p || p.length < 3) continue;
      var q = shape(p[0], hash01(p[0]), t, E, CY, arcOf(p, true)); if (!q) { miss++; continue; }
      var Lp = arcOf(p, false), Lq = arcOf(q, false), sum = 0, a, b;
      for (i = 1; i <= 8; i++) { a = at(p, Lp, i / 8); b = at(q, Lq, i / 8); sum += Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z); }
      mean.push(sum / 8); tip.push(Math.hypot(p[p.length - 1].x - q[q.length - 1].x, p[p.length - 1].y - q[q.length - 1].y, p[p.length - 1].z - q[q.length - 1].z));
    }
    return { n: mean.length, miss: miss, meanMed: qv(mean, 0.5), meanP90: qv(mean, 0.9), tipMed: qv(tip, 0.5), tipP90: qv(tip, 0.9) };
  }
  FS._core.fidelity = fidelity;

  /* ------------------------------------------------------------------------------------------------------------
   * 앱에 끼우기
   * ---------------------------------------------------------------------------------------------------------- */
  var G = REGROW;
  function mqOn() { try { return typeof MANNEQUIN !== 'undefined' && !!MANNEQUIN.on; } catch (e) { return false; } }
  function photoNow() { try { return state._hair3Dneutral || null; } catch (e) { return null; } }
  function clone(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }
  function setTag(t) { try { var el = document.getElementById('adjustStyleTag'); if (el) el.textContent = t; } catch (e) {} }
  // 마네킹 없이(제 머리 바탕) 걸린 스타일 — 마네킹이 꺼져 있으면 17번이 state.specAppliedId를 비우므로 여기에 따로 적어 둠
  var nat = FS.nativeState = { id: null, pending: null, base: null, undo: null, timer: 0, shaped: 0, kept: 0, applied: 0, fellBack: 0, err: null, at: null }, regCtx = false;
  function cmPerUnit() { var cm = 16.4; try { cm = modelCmPerUnit() || 16.4; } catch (e) {} return cm; }
  function secOrder() { return (typeof SECTION_ORDER !== 'undefined') ? SECTION_ORDER : ['crown', 'front', 'temple', 'side', 'occipital', 'nape']; }
  function scalpEnv(model) {
    var E = null, CY = 0.15;
    try { E = getScalpEllipsoid(); } catch (e) { E = null; }
    if (!E || !(E.a > 0) || !(E.b > 0) || !(E.c > 0)) return null;
    try { if (model && isFinite(model.CY)) CY = model.CY; else if (typeof SCALP_CENTER_Y !== 'undefined' && isFinite(SCALP_CENTER_Y)) CY = SCALP_CENTER_Y; } catch (e) {}
    return { E: { a: E.a, b: E.b, c: E.c }, CY: CY };
  }

  /* 다시 기른 모델에서 표를 뽑아 스펙 조각으로 */
  var lastFrom = { m: null, f: null };
  FS.fromRegrown = function () {
    if (!G || !G.model || !G.model.strands || !G.model.strands.length) return null;
    if (lastFrom.m === G.model && lastFrom.f) return lastFrom.f;         // 같은 모델이면 다시 안 뽑음(원본 ↔ 마네킹을 오갈 때마다 부르므로)
    var env = scalpEnv(G.model); if (!env) return null;
    var t0 = now(), tb = buildTable(G.model.strands, env.E, env.CY, FS), f = encode(tb), rt = decode(f), fid = null;
    lastFrom.m = G.model; lastFrom.f = f;
    try { fid = fidelity(G.model.strands, rt, env.E, env.CY, FS.fidelityN); } catch (e) { fid = null; }
    ST.built = { at: new Date().toTimeString().slice(0, 8), ms: now() - t0, bytes: f.d.length, stats: tb.stats, nb: tb.nb, fid: fid, cm: cmPerUnit() };
    return f;
  };

  /* (2026-10-07h) 빗질·넘기기를 표에 담기 — 사용자: "정리하고 나서 스타일로 저장한다면 넣는 게 맞다."
     표는 "슬라이더를 타기 전의 가닥"에서 뽑습니다(슬라이더 값은 flowBase/flowLen으로 따로 실으므로). 그래서 그 가닥에 53번 빗질(combStrand3D — 화면이 쓰는 것과 같은 함수)을
     걸어서 뽑습니다: 다시 기른 머리 화면 = 다시 기른 가닥 · 제 머리 바탕 스타일 = 스타일 결로 바꾼 가닥 · 마네킹+표 = 표대로 만든 마네킹 가닥.
     빗질 획은 "화면에 그려진 자리"(슬라이더를 탄 뒤)에 칠해져 있어서, 슬라이더를 기준에서 많이 움직인 채(특히 넘김·볼륨) 빗었으면 자리가 조금 어긋날 수 있습니다.
     획이 없거나 표를 못 만들면 null(예전 경로). */
  function combN() { try { var C = W.COMB3D; if (!C || C.enabled === false) return 0; return (C.samples ? C.samples.length : 0) + (C.sweeps ? C.sweeps.length : 0); } catch (e) { return 0; } }
  FS.fromCombed = function () {
    ST.combed = null;
    var nC = combN(); if (!FS.saveComb || !nC || typeof W.combStrand3D !== 'function') return null;
    var t0 = now(), list = [], moved = 0, model = null, how = '';
    function add(pts) {
      if (!pts || pts.length < 2) return;
      var o = pts; try { o = W.combStrand3D(pts) || pts; } catch (e) { o = pts; }
      if (o !== pts) moved++;
      list.push({ pts: o });
    }
    try {
      if (mqOn()) {
        var sp = activeSpec(); model = state.hair3Dneutral; if (!sp || !model || !model.strands) return null;
        how = '표대로 만든 마네킹 가닥';
        model.strands.forEach(function (s) {
          if (!s || !s.mannequin || !s.pts) return;
          if (!s._fsk) { try { W.adjustStrandGeom(s); } catch (e) {} }
          if (s._fsk && s._fsk.pts) add(s._fsk.pts);
        });
      } else if (G && G.on && G.model && G.model.strands) {
        model = G.model; var ns = natSpec(); how = ns ? '스타일 결로 바꾼 제 가닥' : '다시 기른 가닥';
        model.strands.forEach(function (s) {
          if (!s || !s.pts) return;
          var pts = s.pts;
          if (ns) { if (!s._fnat) { try { W.adjustStrandGeom(s); } catch (e) {} } if (s._fnat && s._fnat.pts) pts = s._fnat.pts; }
          add(pts);
        });
      } else return null;
      if (!list.length || !moved) { ST.combed = { n: nC, strands: list.length, moved: 0, how: how, skipped: true }; return null; }
      var env = scalpEnv(model); if (!env) return null;
      var tb = buildTable(list, env.E, env.CY, FS), f = encode(tb);
      if (!f || !(f.n > 0)) return null;
      ST.combed = { n: nC, strands: list.length, moved: moved, how: how, ms: now() - t0, nb: tb.nb, bytes: f.d.length, at: new Date().toTimeString().slice(0, 8) };
      console.log(TAG + ' 스타일 등록 — 빗질·넘기기를 표에 담았습니다: ' + how + ' ' + list.length + '개에 빗질(획 표본 ' + nC + '개)을 걸어 표를 다시 뽑음 · 빗질로 바뀐 가닥 ' + moved + '개 · ' + Math.round(ST.combed.ms) + 'ms — 끄기 FLOW_SPEC.saveComb=false');
      return f;
    } catch (e) { console.warn(TAG + ' 빗질을 표에 담기 실패 — 빗기 전 모양으로 싣습니다', e); ST.combed = { err: String(e && e.message || e) }; return null; }
  };

  /* 잰 결과(r)에 표를 실음 — r.spec을 그 자리에서 고침. tipAt/lenCm은 지우지 않습니다(끄면 예전 동작 · 걸 때만 가림) */
  FS.enrich = function (r) {
    if (!FS.save || !r || !r.spec) return r;
    var f = null;
    try { f = FS.fromRegrown(); } catch (e) { ST.err = '표 만들기 실패: ' + (e && e.message || e); console.warn(TAG + ' ' + ST.err, e); }
    if (!f || !(f.n > 0)) { ST.err = '표가 비었습니다(다시 기른 가닥에서 칸을 하나도 못 만듦) — 숫자만 넘깁니다'; console.warn(TAG + ' ' + ST.err); return r; }
    if (regCtx) { try { var fcE = FS.fromCombed(); if (fcE) f = fcE; } catch (e) {} }      // (h) 사용자가 등록을 누른 경우에만(58번의 자동 원본 올리기에는 안 넣음)
    var sp = r.spec, sty = sp.styling || {}, perm = sp.perm || {}, len = {};
    secOrder().forEach(function (sec) { try { len[sec] = SECTIONS[sec].defaults.length; } catch (e) { len[sec] = 50; } });
    sp.flow = f;
    sp.flowBase = { sweep: sty.sweep || 0, volume: typeof sty.volume === 'number' ? sty.volume : 50, part: sty.part || 0, partAmt: sty.partAmt || 0,
      curl: perm.curl > 0 ? perm.curl : 0, wave: typeof perm.wave === 'number' ? perm.wave : 50,
      rodScale: (perm.rodScale > 1 ? perm.rodScale : (r.curl && perm.curl > 0 && r.curl.rodScale > 1 ? +(+r.curl.rodScale).toFixed(2) : 1)) };
    sp.flowLen = len;
    if (regCtx) sp.base = 'regrown'; else if (sp.base) delete sp.base;   // 마네킹 없이(다시 기른 머리 화면에서) 등록한 스타일인가
    try { console.log(FS.lines().join('\n')); } catch (e) {}
    return r;
  };
  // → SPEC_PASS.enrich(17b) 끝에서 FLOW_SPEC.enrich(r) — 58번 원본 올리기 · 42번 등록이 둘 다 이 자리를 지남

  /* ------------------------------------------------------------------------------------------------------------
   * 마네킹 없이(제 머리 바탕)
   * ---------------------------------------------------------------------------------------------------------- */
  function isCurlyPhoto() {
    try { if (!(FS.nativeCurl > 0) || !G || typeof G.photoCurl !== 'function') return false; var pc = G.photoCurl(); return !!pc && Math.max(pc.value || 0, pc.raw || 0) >= FS.nativeCurl; } catch (e) { return false; }
  }
  FS.isCurlyPhoto = isCurlyPhoto;
  /* 지금 제 머리 바탕으로 걸려 있는 스타일의 스펙(없으면 null) — 42번이 기준을 다시 넣었으면(다른 사진 · 마네킹을 켰다 끔) 풀린 것으로 봄 */
  function natSpec() {
    if (!FS.on || !FS.native || !nat.id || mqOn() || !G || !G.on) return null;
    if (!G.base || G.base !== nat.base) { nat.id = null; return null; }
    var sp = null; try { sp = getStyleSpec(nat.id); } catch (e) {}
    return (sp && sp.flow) ? sp : null;
  }
  function redrawAll(tag) {
    try { if (typeof ADJ_CACHE !== 'undefined' && ADJ_CACHE.bump) ADJ_CACHE.bump(); } catch (e) {}
    try { if (typeof buildGyPanel === 'function') buildGyPanel(); else if (typeof buildGyControls === 'function') buildGyControls(); } catch (e) {}
    try { if (typeof syncSliderUI === 'function') syncSliderUI(); } catch (e) {}
    if (tag) setTag(tag);
    try { if (typeof combRefresh === 'function') combRefresh(); else if (typeof renderAdjustFrame === 'function') renderAdjustFrame(); } catch (e) {}
  }
  /* 다시 기른 머리와 기준 값이 준비된 뒤 — 스타일의 값을 슬라이더에 넣고 제 머리 바탕으로 건 것으로 표시 */
  function finishNative(id) {
    nat.pending = null; try { clearTimeout(nat.timer); } catch (e) {}
    var sp = null; try { sp = getStyleSpec(id); } catch (e) {}
    if (!sp || !sp.flow || !G || !G.base) return false;
    var undo = null; try { undo = (typeof snapshotForSpec === 'function') ? snapshotForSpec() : { sections: clone(state.sections), stylingByView: clone(state.stylingByView), fade: clone(state.fade) }; } catch (e) {}
    try {
      secOrder().forEach(function (sec) {
        var d = state.sections[sec] || (state.sections[sec] = {}), dl = 50; try { dl = SECTIONS[sec].defaults.length; } catch (e) {}
        if (sp.cut && sp.cut[sec]) Object.assign(d, sp.cut[sec]);
        if (sp.perm) { if (typeof sp.perm.curl === 'number') d.curl = sp.perm.curl; if (typeof sp.perm.wave === 'number') d.wave = sp.perm.wave; }
        d.length = (sp.flowLen && typeof sp.flowLen[sec] === 'number') ? sp.flowLen[sec] : dl;
        if (sp.color) d.color = sp.color;
      });
      var sbv = (typeof neutralStylingByView === 'function') ? neutralStylingByView() : {}, AN = (typeof ANGLES !== 'undefined') ? ANGLES : ['front', 'left', 'right', 'back'];
      AN.forEach(function (a) { if (!sbv[a]) sbv[a] = {}; Object.assign(sbv[a], (sp.stylingByView && sp.stylingByView[a]) || sp.styling || {}); });
      state.stylingByView = sbv;
      try { if (typeof bindStylingToCurrentView === 'function') bindStylingToCurrentView(); } catch (e) {}
      if (typeof sp.globalCurl === 'number') state._globalCurl = sp.globalCurl; else if (sp.perm && typeof sp.perm.curl === 'number') state._globalCurl = sp.perm.curl;
      if (state.fade && sp.fade) Object.assign(state.fade, sp.fade);
      try { if (typeof BRAID !== 'undefined') BRAID.on = false; } catch (e) {}
    } catch (e) { nat.err = '값 넣기 실패: ' + (e && e.message || e); console.warn(TAG + ' ' + nat.err, e); return false; }
    nat.id = id; nat.base = G.base; nat.undo = undo; nat.shaped = 0; nat.kept = 0; nat.tailCut = 0; nat.upCut = 0; FS._st = nat; nat.err = null; nat.applied++; nat.at = new Date().toTimeString().slice(0, 8);
    refreshActive();
    redrawAll(sp.name || '스타일');
    needNatLine = true;
    return true;
  }
  function unapplyNative() {
    var u = nat.undo; nat.id = null; nat.undo = null;
    try { if (u) { state.sections = u.sections; state.stylingByView = u.stylingByView; if (u.fade && state.fade) Object.assign(state.fade, u.fade); try { if (typeof bindStylingToCurrentView === 'function') bindStylingToCurrentView(); } catch (e) {} } } catch (e) {}
    refreshActive(); redrawAll('원본 머리');
    console.log(TAG + ' 제 머리 바탕으로 건 스타일 해제 — 다시 기른 머리로');
  }
  function startNative(id) {
    nat.id = null; nat.pending = id; refreshActive();
    try {
      if (!photoNow()) {                                                    // 사진 모델이 아직 없음 — 17번처럼 만들고 다시
        if (typeof buildNeutralHair3D === 'function') { setTag('3D 준비 중…'); buildNeutralHair3D(function () { startNative(id); }); return; }
        throw new Error('사진 모델 없음');
      }
      if (mqOn()) {                                                         // 마네킹을 끔(42번이 다시 기른 머리를 그림) — 마네킹에서 쓰던 값은 되돌리지 않음
        try { G.mqSnap = null; G.base = null; } catch (e) {}
        MANNEQUIN.on = false; try { state.specAppliedId = null; state._specUndo = null; } catch (e) {}
        try { if (typeof syncMannequinBtn === 'function') syncMannequinBtn(); } catch (e) {}
      }
      setTag('다시 기르는 중…');
      G.sync();                                                             // 다시 기르기(없으면 기름) → 기준 값 넣기 → 아래 applyBaseline 자리에서 finishNative
      if (nat.pending === id && G.on && G.model && G.src === photoNow() && G.base && G.base.src === photoNow()) finishNative(id);
    } catch (e) { nat.pending = null; nat.fellBack++; nat.err = String(e && e.message || e); console.warn(TAG + ' 제 머리 바탕으로 걸기 실패 — 마네킹 방식으로', e); return innerASR ? innerASR(id) : null; }
    try { clearTimeout(nat.timer); } catch (e) {}
    if (nat.pending === id) nat.timer = setTimeout(function () {
      if (nat.pending !== id) return;
      nat.pending = null; nat.fellBack++; nat.err = '다시 기르기가 ' + Math.round(FS.nativeWaitMs / 1000) + '초 안에 안 끝남';
      console.warn(TAG + ' ' + nat.err + ' — 마네킹 방식으로 겁니다');
      try { if (innerASR) innerASR(id); } catch (e) {}
    }, FS.nativeWaitMs);
    return null;
  }
  /* 스타일 걸기 — 마네킹 없이 만든 스타일(spec.base === 'regrown')은 마네킹을 켜지 않고 제 머리 위에 */
  var asrPlain = false;
  var innerASR = function (id) { asrPlain = true; try { return applyStyleSpecAndRender(id); } finally { asrPlain = false; } };   // 마네킹으로 거는 원래 길(아래 nativeWaitMs 뒤 다시 걸 때 — 이 단계는 건너뜀)
  /* applyStyleSpecAndRender(17a) 맨 앞 — { handled, value }. handled면 원래 본문을 건너뜀 */
  FS._asr = function (id) {
    if (asrPlain) return { handled: false };
    var sp = null; try { sp = getStyleSpec(id); } catch (e) {}
    if (!(FS.on && FS.native && sp && sp.flow && sp.base === 'regrown')) { nat.id = null; nat.pending = null; try { clearTimeout(nat.timer); } catch (e) {} return { handled: false }; }
    if (nat.id === id && natSpec()) { unapplyNative(); return { handled: true, value: null }; }       // 같은 스타일을 다시 누름 = 해제
    return { handled: true, value: startNative(id) };
  };
  /* 42번의 "기준 값 넣기" 자리(58번이 끼워 둔 것 바깥) — 컬 머리의 원본, 그리고 제 머리 바탕 스타일을 거는 중/걸린 동안에는
     58번(마네킹 + 스펙)을 건너뛰고 42번의 다시 기른 머리를 그대로 씁니다 */
  /* REGROW.applyBaseline(17b) 바깥 — inner = 58번 단계부터의 원래 기준 값 넣기 */
  FS._baseline = function (inner) {
    var bypass = false, r, OMo = W.ORIG_MQ;
    try {
      if (nat.id && (!G.base || G.base !== nat.base)) nat.id = null;      // 기준이 비워졌으면 걸려 있던 것은 풀린 것
      bypass = !!(FS.on && FS.native && G.on && !mqOn() && (nat.pending || nat.id || isCurlyPhoto()));
    } catch (e) { bypass = false; }
    if (bypass && OMo && OMo.on) { OMo.on = false; try { r = inner(); } finally { OMo.on = true; } nat.bypassed = (nat.bypassed || 0) + 1; }
    else r = inner();
    try { if (nat.pending && G.on && !mqOn() && G.base && G.base.src === photoNow()) finishNative(nat.pending); } catch (e) { console.warn(TAG + ' 제 머리 바탕으로 걸기 실패', e); }
    return r;
  };
  /* 42번의 "잰 숫자로 등록"(다시 기른 머리 화면에서 등록) — 이 스타일은 마네킹 없이 만든 것으로 표시 */
  FS._regBegin = function () { var save = regCtx; regCtx = true; return save; };   // REGROW.register(17b) 앞뒤
  FS._regEnd = function (save) { regCtx = save; };
  var needNatLine = false;

  /* 지금 걸린(또는 걸고 있는) 스타일의 표 — 마네킹 모델일 때만 */
  var pendingId = null, actId = null, actSpec = null, envModel = null, envVal = null;
  function activeSpec() {
    if (!FS.on) return null;
    var id = null; try { id = pendingId || (mqOn() ? state.specAppliedId : (nat.id || state.specAppliedId)); } catch (e) { return null; }
    if (!id) return null;
    if (id !== actId || !actSpec) { actId = id; actSpec = null; try { actSpec = (typeof getStyleSpec === 'function') ? getStyleSpec(id) : null; } catch (e) { actSpec = null; } }
    return (actSpec && actSpec.flow) ? actSpec : null;
  }
  function refreshActive() { actId = null; actSpec = null; envModel = null; envVal = null; }
  FS.active = function () { var s = activeSpec(); return s ? s.flow : null; };
  function envFor(model) { if (model !== envModel) { envModel = model; envVal = scalpEnv(model); } return envVal; }

  /* 표 위에서 슬라이더 걸기 — 42번 adjustRegrown과 같은 방식(기준에서 움직인 만큼만) */
  function adjustFlow(s, g, base, lenOverride, styOverride) {
    var cur = (state.sections && state.sections[s.sec]) || {};
    var sty = (styOverride !== undefined ? styOverride : uniformStyling()) || stylingForRoot(s.pts[0]) || {};
    var C0 = base.curl || 0, dlen = 50; try { dlen = SECTIONS[s.sec].defaults.length; } catch (e) {}
    var r = sectionLengthRatio(s.sec, typeof lenOverride === 'number' ? lenOverride : cur.length) / (sectionLengthRatio(s.sec, dlen) || 1);
    var curl = Math.max(0, cur.curl || 0), keep = C0 > 0 && G && typeof G.curlRemain === 'function' && G.curlKeepShape !== false, total = r, cover = r;
    if (keep) { total = r / G.curlRemain(C0); var used = total * G.curlRemain(curl); cover = used > 1.0005 ? used : Math.min(1, total); }
    if (Math.abs(cover - 1) > 1e-6) g = lengthStrand3D(g, cover);
    var sweep = Math.max(-100, Math.min(100, (sty.sweep || 0) - (base.sweep || 0)));
    var vol = Math.max(0, Math.min(100, 50 + ((typeof sty.volume === 'number' ? sty.volume : 50) - (typeof base.volume === 'number' ? base.volume : 50))));
    var samePart = (sty.part || 0) === (base.part || 0) && (sty.partAmt || 0) === (base.partAmt || 0);
    var part = samePart ? 0 : (sty.part || 0), partAmt = samePart ? 0 : sty.partAmt, spine = false;
    try { spine = typeof STYLE_ORDER !== 'undefined' && !!STYLE_ORDER.spineFirst; } catch (e) {}
    if (spine) { g = partStrand3D(g, part, curl, partAmt); g = sweepStrand3D(g, sweep * sweepCurlScale(curl), curl, part, partAmt); }
    if (keep && total > cover * 1.0005) g = padArc(g, total / cover);
    var ks = (C0 > 0 && base.rodScale > 1 && curl > 0) ? Math.min(4, base.rodScale) : 1;
    if (ks > 1) g = scalePts(g, 1 / ks);
    g = curlStrand3D(g, curl, (typeof cur.wave === 'number' ? cur.wave : 50) / 100, typeof cur.curlDir === 'number' ? cur.curlDir : 0);
    if (ks > 1) g = scalePts(g, ks);
    if (keep) { if (curl > C0) g = gravityDroop3D(g, curl - C0); } else if (curl > 0) g = gravityDroop3D(g, curl);
    if (!spine) { g = partStrand3D(g, part, curl, partAmt); g = sweepStrand3D(g, sweep, curl, part, partAmt); }
    g = volumeStrand3D(g, vol, s.sec);
    g = flowCurlStrand3D(g, sty.flow || 0);
    g = sleekStrand3D(g, typeof sty.sleek === 'number' ? sty.sleek : 0);
    return g;
  }
  function scalePts(pts, k) { var o = new Array(pts.length), i, p; for (i = 0; i < pts.length; i++) { p = pts[i]; o[i] = { x: p.x * k, y: p.y * k, z: p.z * k }; } return o; }
  function padArc(pts, ratio) {
    var n = pts.length; if (n < 2 || !(ratio > 1)) return pts;
    var L = 0, i; for (i = 1; i < n; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y, pts[i].z - pts[i - 1].z);
    var a = pts[n - 2], t = pts[n - 1], dx = t.x - a.x, dy = t.y - a.y, dz = t.z - a.z, dl = Math.hypot(dx, dy, dz);
    if (!(L > 1e-9) || !(dl > 1e-9)) return pts;
    var add = L * (ratio - 1) / dl, out = pts.slice();
    out.push({ x: t.x + dx * add, y: t.y + dy * add, z: t.z + dz * add });
    return out;
  }

  var fjSeq = 0;
  function neckGuard() { return (FS.guardNeck && G && typeof G.neckPush === 'function') ? G.neckPush : null; }
  function frac(v) { return v - Math.floor(v); }
  /* 뿌리를 제 두피 칸 안에서 옮김(17번 격자: x = a·sinφ·sinθ, y = CY + b·cosφ, z = c·sinφ·cosθ) */
  function jitterRoot(root, env, u1, u2) {
    var NT = 64, NP = 32;
    try { var ro = state._hair3Dneutral && state._hair3Dneutral.roots; if (ro && ro.NT > 0 && ro.NP > 0) { NT = ro.NT; NP = ro.NP; } } catch (e) {}
    var E = env.E, nx = root.x / E.a, ny = (root.y - env.CY) / E.b, nz = root.z / E.c, r = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (!(r > 1e-6)) return root;
    var phi = Math.acos(Math.max(-1, Math.min(1, ny / r))) + (u1 - 0.5) * Math.PI / NP, th = Math.atan2(nx, nz) + (u2 - 0.5) * 2 * Math.PI / NT;
    if (phi < 0.01) phi = 0.01;
    return { x: E.a * r * Math.sin(phi) * Math.sin(th), y: env.CY + E.b * r * Math.cos(phi), z: E.c * r * Math.sin(phi) * Math.cos(th) };
  }
  /* adjustStrandGeom(17b) 맨 앞 — 표대로 만든 가닥(없으면 null → 원래 단계들) */
  FS._adjust = function (s, lenOverride, styOverride) {
    if (s && !s.mannequin && s.regrown && s.pts && s.pts.length >= 2 && nat.id) {
      var ns = natSpec();
      if (ns) {
        try {
          var rtS = decode(ns.flow), fo = FS.fromRegrown(), rtO = fo ? decode(fo) : null, envN = rtS ? envFor(G.model) : null;
          if (rtS && envN) {
            var mn = s._fnat;
            if (!mn || mn.t !== rtS || mn.o !== rtO || mn.e !== envN) {
              var rootN = s.pts[0], hN = hash01(rootN), stS = sampler(rootN, hN, rtS, envN.E, envN.CY, FS), owS = rtO ? sampler(rootN, hN, rtO, envN.E, envN.CY, FS) : null;
              var np = stS ? resteer(s.pts, owS, stS, envN.E, envN.CY, FS, neckGuard()) : null;
              mn = s._fnat = { t: rtS, o: rtO, e: envN, pts: np };
              if (np) nat.shaped++; else nat.kept++;
            }
            if (mn.pts) return adjustFlow(s, mn.pts, ns.flowBase || {}, lenOverride, styOverride);
          }
        } catch (e) { if (!nat.err) console.warn(TAG + ' 제 머리 바탕으로 만들기 실패 — 다시 기른 가닥 그대로', e); nat.err = String(e && e.message || e); }
      }
    }
    if (s && s.mannequin && s.pts && s.pts.length >= 2) {
      var sp = activeSpec();
      if (sp) {
        try {
          var rt = decode(sp.flow), model = state.hair3Dneutral, env = rt ? envFor(model) : null;
          if (rt && env) {
            var mem = s._fsk;
            if (!mem || mem.t !== rt || mem.e !== env) {
              var root = s.pts[0], hh;
              if (s.fringe) {                                              // 마네킹이 앞머리로 내려 심은 가닥 — 한 칸의 가닥이 전부 같은 뿌리라 칸 안에 흩음
                if (s._fj === undefined) { fjSeq++; s._fj = [frac(fjSeq * 0.6180339887), frac(fjSeq * 0.7548776662), frac(fjSeq * 0.5698402910)]; }
                root = jitterRoot(root, env, s._fj[0], s._fj[1]); hh = s._fj[2];
              } else hh = hash01(root);
              var sk = shape(root, hh, rt, env.E, env.CY, 0, FS, neckGuard());
              mem = s._fsk = { t: rt, e: env, pts: sk };
              if (sk) ST.shaped++; else ST.fallback++;
            }
            if (mem.pts) return adjustFlow(s, mem.pts, sp.flowBase || {}, lenOverride, styOverride);
          }
        } catch (e) { if (!ST.err) console.warn(TAG + ' 가닥 만들기 실패 — 마네킹 뼈대로', e); ST.err = String(e && e.message || e); }
      }
    }
    return null;
  };

  /* 걸 때: 이 스타일의 표로 · 섹션 길이 자동 맞추기는 건너뜀(스펙의 tipAt/lenCm을 잠깐 가리고, 길이 슬라이더는 flowLen으로) */
  /* applyStyleSpec(24 단계) 맨 바깥 — 돌려준 값을 _endApply에 넘김 */
  FS._beginApply = function (id) {
    var save = pendingId, sp = null, hid = null;
    pendingId = id; refreshActive(); ST.shaped = 0; ST.fallback = 0; ST.err = null;
    try { sp = activeSpec(); } catch (e) { sp = null; }
    if (sp) { hid = { tipAt: sp.tipAt, lenCm: sp.lenCm, lenFallback: sp.lenFallback }; sp.tipAt = undefined; sp.lenCm = undefined; if (sp.flowLen) sp.lenFallback = sp.flowLen; }
    return { save: save, sp: sp, hid: hid };
  };
  FS._endApply = function (c) {
    var save = c.save, sp = c.sp, hid = c.hid;
    {
      if (hid) { sp.tipAt = hid.tipAt; sp.lenCm = hid.lenCm; sp.lenFallback = hid.lenFallback; if (sp.tipAt === undefined) delete sp.tipAt; if (sp.lenCm === undefined) delete sp.lenCm; if (sp.lenFallback === undefined) delete sp.lenFallback; }
      pendingId = save; refreshActive();
      try { if (typeof ADJ_CACHE !== 'undefined' && ADJ_CACHE.bump) ADJ_CACHE.bump(); } catch (e) {}
      if (hid) needLine = true;
    }
  };
  // 걸고 난 뒤 가닥을 처음 다 만든 자리에서 한 줄 찍음
  var needLine = false;
  FS._afterCompute = function () {   // computeAdjustedHair3DStrands(17b) 끝
    if (needLine && !pendingId && (ST.shaped + ST.fallback) > 0) { needLine = false; try { console.log(FS.applyLine()); } catch (e) {} }
    if (needNatLine && (nat.shaped + nat.kept) > 0) { needNatLine = false; try { console.log(FS.nativeLine()); } catch (e) {} }
  };
  FS._afterClear = function () { refreshActive(); try { if (typeof ADJ_CACHE !== 'undefined' && ADJ_CACHE.bump) ADJ_CACHE.bump(); } catch (e) {} };   // clearStyleSpec(17a) 끝
  // 미리 만든 헤어의 서명 — 표가 걸렸는지/켜졌는지가 바뀌면 다시
  FS._sigTail = function () { var f = null; try { f = FS.active(); } catch (e) {} return '|fl' + (f ? f.n + ':' + f.d.length : 0); };   // adjFilterSig(17b) 끝

  /* [현재 모델을 스타일로 등록] — 지금 걸린 표를 새 스펙에 그대로 · 지금 섹션 길이 슬라이더 값을 flowLen에 */
  FS._afterBuildSpec = function (spec) {   // buildSpecFromCurrent(06) 끝
    try {
      var sp = activeSpec();
      if (spec && !sp && FS.save && G && G.on && !mqOn() && G.base && G.model && G.src === photoNow()) {
        // 다시 기른 머리 화면에서(슬라이더를 움직인 뒤) 등록 — 이 손님의 표를 싣고, 표에 이미 들어 있는 값(기준)을 같이 적음
        var f0 = FS.fromRegrown(), b0 = G.base, c0 = 0, w0 = 50;
        try { c0 = (b0.sections && b0.sections.crown && b0.sections.crown.curl) || 0; if (b0.measured && b0.measured.curl && typeof b0.measured.curl.wave === 'number') w0 = b0.measured.curl.wave; } catch (e) {}
        if (f0 && f0.n > 0) sp = { flow: f0, base: 'regrown', flowBase: { sweep: (b0.sty && b0.sty.sweep) || 0, volume: (b0.sty && typeof b0.sty.volume === 'number') ? b0.sty.volume : 50, part: 0, partAmt: 0, curl: c0, wave: w0, rodScale: b0.rodScale > 1 ? b0.rodScale : 1 } };
      }
      if (spec && sp && FS.save) {
        if (sp.base === 'regrown') spec.base = 'regrown';
        // (2026-10-12t) 원본 머리(68번 = 다시 기른 길을 옮겨심은 것)를 보며 등록한 스타일도 마네킹 없이 — 사용자: "마네킨 모드로 저장하지 않은 건 마네킨 모드 꺼지게"
        //   다른 손님에게 걸 때 그 손님의 다시 기른 머리 위에 얹음(위의 native 경로) · (2026-10-12v) 기본 끔(FLOW_SPEC.origAsRegrown=true일 때만) — 대신 굴곡을 spec.readShape로 싣고 받는 손님은 결 표 길 + 그 굴곡 · 예전 = FLOW_SPEC.origAsRegrown=false
        try { if (W.ORIG_MQ && typeof W.ORIG_MQ.isOriginal === 'function' && W.ORIG_MQ.isOriginal() && W.PHOTO_CURL && typeof W.PHOTO_CURL.exportShape === 'function') { var rsx = W.PHOTO_CURL.exportShape(); if (rsx) { spec.readShape = rsx; console.log(TAG + ' 원본 머리에서 등록 — 사진에서 읽은 굴곡을 같이 실음(' + Math.round(JSON.stringify(rsx).length / 1024) + 'KB · 나선 쪽 ' + rsx.w + ')'); } } } catch (e) {}   // (2026-10-12v)
        try { if (FS.origAsRegrown === true && W.ORIG_MQ && typeof W.ORIG_MQ.isOriginal === 'function' && W.ORIG_MQ.isOriginal() && W.READ_SHAPE && W.READ_SHAPE.on !== false) { spec.base = 'regrown'; console.log(TAG + ' 원본 머리에서 등록 — 마네킹 없이 거는 스타일로 저장(base regrown)'); } } catch (e) {}
        var fcB = null; try { fcB = FS.fromCombed(); } catch (e) { fcB = null; }             // (h) 빗질·넘기기가 있으면 그걸 건 가닥으로 다시 뽑은 표
        spec.flow = fcB || sp.flow; spec.flowBase = JSON.parse(JSON.stringify(sp.flowBase || {})); spec.flowLen = {};
        secOrder().forEach(function (sec) { var c = state.sections && state.sections[sec]; if (c && typeof c.length === 'number') spec.flowLen[sec] = c.length; });
        console.log(TAG + ' 스타일 등록 — ' + (fcB ? '빗질·넘기기를 담은 표' : '지금 걸린 표') + '를 같이 실었습니다(' + Math.round(spec.flow.d.length / 1024) + 'KB · 섹션 길이 슬라이더 ' + secOrder().map(function (k) { return k + ' ' + spec.flowLen[k]; }).join(' · ') + ')');
      }
    } catch (e) { console.warn(TAG + ' 등록에 표 싣기 실패', e); }
  };
  /* 저장소가 차서 표가 든 스타일이 안 들어갔으면 알림 */
  FS._afterSave = function () {   // saveCustomStylesToStorage(06) 끝
    try {
      var want = STYLES.filter(function (s) { return s.isCustom; }), raw = localStorage.getItem('gyeol_customStyles') || '', last = want[want.length - 1];
      var kb = Math.round(raw.length / 1024), nFlow = want.filter(function (s) { return s.spec && s.spec.flow; }).length;
      if (last && raw.indexOf('"' + last.id + '"') < 0) {
        ST.saveWarn = '저장소가 차서 "' + last.name + '"이(가) 저장되지 않았습니다(지금 ' + kb + 'KB) — 안 쓰는 스타일을 지워 주세요';
        console.warn(TAG + ' ' + ST.saveWarn);
        try { if (typeof showToast === 'function') showToast(ST.saveWarn); } catch (e) {}
      } else { ST.saveWarn = null; if (nFlow) console.log(TAG + ' 저장소 — 등록 스타일 ' + want.length + '개(표가 든 것 ' + nFlow + '개) · ' + kb + 'KB'); }
    } catch (e) {}
  };

  FS.nativeLine = function () {
    var sp = null; try { sp = natSpec(); } catch (e) {}
    if (!sp) return TAG + ' 제 머리 바탕 — ' + (nat.pending ? '거는 중(다시 기르기를 기다림)' : (FS.native ? '걸린 스타일 없음' : '꺼짐(FLOW_SPEC.native=false)')) +
      (isCurlyPhoto() ? ' · 이 손님은 컬 ' + FS.nativeCurl + ' 이상이라 원본을 다시 기른 머리로 보여 줍니다' : '') + (nat.fellBack ? ' · 마네킹 방식으로 떨어진 횟수 ' + nat.fellBack : '') + (nat.err ? ' · ⚠ ' + nat.err : '');
    return TAG + ' 제 머리 바탕으로 걸림 — "' + (sp.name || nat.id) + '"(' + nat.at + ') · 마네킹 안 켬 · 큰 흐름을 스타일 표로 바꾼 가닥 ' + nat.shaped + '개' + (nat.upCut ? ' · 머리 겉면 밖에서 위로 솟으려다 아래로 꺾인 마디 ' + nat.upCut + '(FLOW_SPEC.natUpK)' : '') + (nat.kept ? ' · 표가 없어 그대로 둔 가닥 ' + nat.kept : '') + (nat.tailCut ? ' · 혼자 길어서 스타일 길이로 누른 가닥 ' + nat.tailCut + '(FLOW_SPEC.natTail)' : '') +
      ' · 가닥의 잔 차이는 이 손님 것 그대로(' + FS.natResMax + '°까지) · 길이는 스타일 ÷ 제 칸 배수' + (nat.err ? ' · ⚠ ' + nat.err : '') + ' — 끄기 FLOW_SPEC.native=false 후 스타일 다시 걸기';
  };
  FS.applyLine = function () {
    var f = null; try { f = FS.active(); } catch (e) {}
    if (!f) return TAG + ' 지금 걸린 스타일에는 표가 없습니다(숫자만으로 걸림)';
    return TAG + ' 걸림 — 표 ' + f.n + '무리 · ' + Math.round(f.d.length / 1024) + 'KB · 표대로 만든 마네킹 가닥 ' + ST.shaped + '개' + (ST.fallback ? ' · 표가 없는 자리라 마네킹 뼈대 그대로 ' + ST.fallback + '개' : '') +
      ' · 섹션 길이 자동 맞추기 건너뜀 · 앞머리 내려 심기 안 탐' + (ST.err ? ' · ⚠ ' + ST.err : '') + ' — 끄기 FLOW_SPEC.on=false 후 스타일 다시 걸기';
  };
  FS.lines = function () {
    var b = ST.built, L = [];
    if (!b) L.push(TAG + ' ' + (FS.save ? '대기 — 원본 머리를 다시 기르면 표를 뽑습니다' : '싣기 꺼짐(FLOW_SPEC.save=false)'));
    else {
      var cm = b.cm, s = b.stats, f = b.fid;
      L.push(TAG + ' 다시 기른 가닥 ' + s.strands + '개에서 뽑음(' + b.at + ' · ' + Math.round(b.ms) + 'ms) — 두피 칸 ' + s.cells + '개(가닥이 ' + FS.minCell + '개 미만이라 뺀 칸 ' + s.skipped + ') · 그중 두 무리로 가른 칸(가르마 등) ' + s.split + ' · 두 무리가 섞여 있어 큰 무리만 쓴 칸 ' + (s.mixed || 0) + ' · 혼자 다른 쪽으로 가서 이웃을 따르게 한 칸 ' + (s.lone || 0) +
        ' · 가닥이 적어(보통 칸의 ' + Math.round(FS.smallFrac * 100) + '% 미만) 큰 이웃의 결을 따르게 한 무리 ' + (s.small || 0) +
        ' · 표에 넣은 가닥(칸의 결과 같은 쪽으로 가는 몸통만) ' + s.used + '개(' + Math.round(s.used / Math.max(1, s.strands) * 100) + '% — 나머지는 잔머리·엇나간 가닥이라 뺌) · 혼자 길어서 누른 칸 ' + (s.tailCells || 0) +
        ' · 머리 안쪽의 막다른 짧은 무리라 뺀 것 ' + (s.dead || 0) + '(이웃 칸을 따름 · 끄기 FLOW_SPEC.deadEnd=false)' +
        ' · 길이 칸 ' + b.nb + ' · 스펙에 싣는 크기 ' + Math.round(b.bytes / 1024) + 'KB');
      if (f && f.n) L.push('    표로 다시 만든 가닥 ↔ 원래 가닥(' + f.n + '개 표본 · 길이는 원래 길이로): 가닥 전체 평균 거리 ' + (f.meanMed * cm).toFixed(1) + 'cm(중앙값) · ' + (f.meanP90 * cm).toFixed(1) + 'cm(90%) | 끝 거리 ' +
        (f.tipMed * cm).toFixed(1) + ' · ' + (f.tipP90 * cm).toFixed(1) + 'cm' + (f.miss ? ' · 표가 없어 못 만든 가닥 ' + f.miss : '') +
        ' — 90% 쪽이 큰 것은 잔머리(표는 칸의 결만 담음)라 정상이고, 중앙값이 크면 표가 머리 모양을 못 담은 것입니다');
    }
    try { if (mqOn() && FS.active()) L.push(FS.applyLine()); } catch (e) {}
    try { if (nat.id || nat.pending || isCurlyPhoto()) L.push(FS.nativeLine()); } catch (e) {}
    if (ST.saveWarn) L.push(TAG + ' ⚠ ' + ST.saveWarn);
    return L;
  };
  console.log(TAG + ' 설치 — 원본 머리의 스펙에 결 표·길이 지도를 싣고, 표가 든 스타일은 마네킹 가닥을 표대로 만듭니다(다른 손님 두상에도). 끄기 FLOW_SPEC.on=false · 싣지 않기 FLOW_SPEC.save=false');
  return FS;
})();

/* ==========================================================================
 * PHOTO_CURL (옛 61-photo-curl.js) — 곱슬 원본 머리: 컬 굵기를 사진에서 잰 값에 맞추고, 가닥이 뭉쳐서 같이 감기게
 *
 * 자리: 17b, FLOW_SPEC 다음. 원래 함수에서 부르는 곳 —
 *   · REGROW.photoCurl 끝 — 사진 반경 → 웨이브 · adjustStrandGeom(17b) 맨 앞 — 타래 뼈대로 바꾼 가닥으로 한 번 더(_lockFor/_withLock)
 *   · curlStrand3D(14) 맨 앞 — PHOTO_CURL._curlStage(뭉침 모양·마네킹 위 잰 컬·읽은 굴곡). 안쪽 말기는 innerCurl(이 단계 건너뜀)
 *   · adjFilterSig 꼬리표 · perfPanelLines(18) 끝 줄
 *
 * 왜 (2026-10-08 · 사용자, 곱슬 손님 영상): "컬이 원본 사진에 비해 컬 직경이 좁고, 너무 가닥가닥 놀아. 사진에서 읽은 정보가 있을 테니,
 *   거기에 맞춰서 컬 직경과 뭉쳐 다니는 가닥들로 정리되게 해 줘."
 *   진단: 컬 75 · 컬 굵기 반경 1.3cm(뷰 중앙값) → 꺼짐(REGROW.curlRadius=false) — 웨이브 50.
 *   · 굵기 — 사진에서 반경은 재고 있었지만 쓰지 않았습니다. 42번 v5의 환산식이 실제 컬 엔진(14c 컬 묶음)과 안 맞아서(웨이브 100 + 로드 ×1.29 =
 *     한 바퀴 11cm · 두 바퀴도 안 감김 → 곧은 막대) 10/6에 꺼 둔 것입니다(42번 머리말 v8). 그래서 굵은 컬 사진도 웨이브 50짜리 잔 컬로 나왔습니다.
 *   · 뭉침 — 컬 엔진은 가닥을 다발(로드 하나에 감기는 한 타래)로 묶지만, 기본값이 다발 안에서도 가닥마다 감기는 자리(위상)를 크게 흩고(phaseJitter 1.2)
 *     다발 가운데로는 30%만 당깁니다(clumpPull 0.3). 그래서 타래가 아니라 낱가닥이 제각각 꼬불거리는 것처럼 보였습니다.
 *
 * 무엇을 (다시 기른 머리 화면에서, 사진에서 잰 컬이 lookMinCurl 이상일 때만):
 *   ① 컬 굵기 — 실제 엔진을 돌려서 "웨이브 값 → 가닥이 뼈대에서 벗어나는 거리(= 컬 반경)"를 재 둔 표(table)로, 사진에서 잰 반경이 나오는 웨이브 값을 고릅니다.
 *      REGROW.photoCurl()이 돌려주는 wave를 그 값으로 바꾸므로 — 섹션 웨이브 슬라이더 · 등록 스타일(perm.wave)에 그대로 들어갑니다.
 *      웨이브는 waveMin~waveMax 안에서만(너무 굵으면 다시 막대가 됨). 로드 배수(rodScale)는 쓰지 않습니다.
 *   ② 뭉침 모양(look) — 컬을 거는 동안만 컬 엔진의 값 네 개를 바꿉니다:
 *        pitchThick 3.5 → 1.4  굵은 로드에서도 한 바퀴 간격이 덜 늘어남(굵게 해도 감긴 모양이 남음 — ①을 켤 수 있게 된 이유)
 *        clumpPull 0.3 → 0.8 · phaseJitter 1.2 → 0.3 · microAmp 0.07 → 0.03   한 다발의 가닥이 같은 자리에서 같이 감김(타래)
 *      컬 엔진의 전역 값은 건드리지 않습니다(호출 앞뒤로 바꿨다 되돌림) → 마네킹 스타일·스타일 프로필(24번)은 예전 그대로입니다.
 *      제 머리 바탕으로 건 스타일(59번 · 마네킹 안 켬)에도 같은 모양이 걸립니다(그 화면도 다시 기른 가닥이라서).
 *
 * (2026-10-08b) ③ 타래 뼈대 — 사용자(3D 결과 화면 영상): "앞머리에서는 컬이 구현된 게 보여. 근데 나머지 머리는 가닥가닥이 제멋대로 굴곡만 좀 주며 뭉쳐 있는
 *   형태 — 저 앞머리처럼 전체에 적용되게."
 *   원인: 컬은 가닥의 "뼈대"(컬을 편 선)에 감깁니다. 한 다발의 뼈대가 나란하면(앞머리 — 전부 같은 쪽으로 내려옴) 같이 감겨 타래로 보이지만,
 *        곱슬 사진에서 다시 기른 뼈대는 가닥마다 엇갈려 있어서(곱슬은 결 정렬을 일부러 안 함) 다발이 같은 자리에서 감겨도 축이 제각각 → 낱가닥이 꼬불거리는 덩어리.
 *        재현(지어낸 가닥 · 같은 컬 값): 뼈대의 엇갈림만 키우면 타래가 사라지고 영상과 같은 모양이 됩니다.
 *   지금: 컬을 걸기 전에 뼈대를 "타래" 단위로 모읍니다.
 *     · 뿌리가 가까운(아래 2026-10-08c: 컬 지름 × 1직경) 가닥끼리 한 타래. 그 안에서 가장 여럿이 같이 가는 가닥을 길잡이로 삼고(같은 칸에서 반대로 가는 가닥은 다른 타래),
 *       나머지 가닥을 길잡이의 길로 당깁니다(lockPull · 뿌리 자리는 그대로 · 끝으로 갈수록 타래가 모임 lockTaper).
 *     · 타래끼리는 그대로 엇갈립니다 → 부피는 "타래의 엇갈림"에서 나옵니다(예전: 가닥의 엇갈림).
 *     · 다시 기른 가닥(G.model)은 안 건드립니다 — 가닥을 만들 때만 모은 뼈대를 씁니다. 그래서 결 표·스타일 등록·원본 대조는 예전 뼈대 그대로입니다.
 *     · 제 머리 바탕으로 건 곱슬 스타일(직모 손님에게 펌 스타일을 얹은 경우)에도 ②③이 걸립니다(스타일에 적힌 컬이 lookMinCurl 이상이면).
 *   끄기: PHOTO_CURL.lock=false 후 PHOTO_CURL.refresh()
 *
 * (2026-10-08c) 타래 크기 = 펌의 베이스 규칙 — 사용자가 보낸 와인딩 영상 두 개: 한 로드에 뜨는 베이스는 "로드 지름만큼의 두께 × 로드 길이만큼의 폭"인 얇은 판.
 *   예전 값(컬 반경 × 1.4 = 0.7직경)은 눈대중이었습니다. 이제 뿌리 자리 = 컬 지름(사진 반경 × 2) × lockDia(1직경).
 *   구역의 "펌·베이스 폭" 슬라이더가 이 값을 키우고 줄입니다(기본 자리 = 1직경 · 끝까지 올리면 2직경 · 끝까지 내리면 0.5직경 · 구역마다 따로).
 *   판 전체(로드 길이 폭)를 한 타래로 묶지는 않았습니다 — 로드를 풀면 판은 지름 폭쯤의 타래 여러 개로 갈라지기 때문(영상의 완성 머리).
 * (2026-10-08d) 길잡이 펴기 — 사용자(3D 결과 영상): "앞머리 쪽은 타래가 더 생겼는데 나머지는 아닌데?"
 *   추정 원인(실제 가닥으로는 아직 못 봄 · 지어낸 가닥으로 재현): 앞머리는 두피 밖으로 늘어뜨린 가닥이라 뼈대가 곧고 나란함 → 컬이 타래로 보임.
 *     나머지는 곱슬 사진의 결을 따라 걸음마다 10°씩 꺾이며 두피 위를 헤매는 뼈대 → 타래로 모아도 타래 자체가 구불구불 서로 엇갈려 컬이 묻힘.
 *   지금: 길잡이의 길을 lockSmoothCm(3cm)만큼 고르게 폄(가는 쪽만 · 두피에서 뜬 높이는 그대로 → 부피 유지). 길잡이는 "여럿이 같이 가는 가닥 중 가장 긴 것".
 *         길잡이보다 긴 가닥은 남은 길을 제 모양대로 이어 감(예전: 곧은 막대로 뻗음 — 그림에서 확인된 흠).
 *   끄기: PHOTO_CURL.lockSmoothCm=0; PHOTO_CURL.refresh()
 * 확인한 것(실제 앱 코드를 브라우저에 올리고 · 가닥은 지어낸 것): 표의 숫자 · 그림으로 본 타래 모양 · 다른 화면(마네킹)의 가닥이 점 단위로 그대로인 것.
 * ⚠ 확인 못 한 것: 실제 사진. 사진에서 재는 반경 자체가 어림값입니다(42번 curlRk) — 굵기가 사진보다 크거나 작게 나오면 PHOTO_CURL.radiusK(기본 1)로 맞춥니다.
 *   마네킹에 표를 올린 원본(직모·약한 웨이브 — 58번)과 마네킹 스타일에는 걸리지 않습니다.
 *
 * 끄기: PHOTO_CURL.on=false 후 마네킹을 켰다 끄기 · 굵기만 끄기 PHOTO_CURL.radius=false · 뭉침만 끄기 PHOTO_CURL.clump=false
 * ========================================================================== */
var PHOTO_CURL = (function () {
  'use strict';
  var W = window, TAG = '[사진 컬]';
  var PC = Object.assign({
    on: false,           // (2026-10-22) 끔 — 머리 전체 컬(lookMinCurl 이상)로 굵기·뭉침·타래 뼈대를 거는 것 · 되돌리기 ?judge=1
    radius: true,        // ① 컬 굵기를 사진 반경에 맞춤
    clump: true,         // ② 뭉침 모양
    lookMinCurl: 30,     // 사진에서 잰 컬이 이 이상일 때만
    look: { pitchThick: 1.4, clumpPull: 0.8, phaseJitter: 0.3, microAmp: 0.03 },
    lock: true,          // ③ 타래 뼈대
    lockDia: 1.0,        // 타래 하나의 뿌리 자리 크기 = 컬 지름(사진 반경 × 2) × 이 값 — 펌에서 로드 하나에 뜨는 베이스 두께(1직경)와 같은 규칙. 반경을 못 쟀으면 lockCm
    lockBase: true,      // 그 구역의 "펌·베이스 폭" 슬라이더로 굵게/가늘게: 기본 자리(구역 기본값)에서 1직경 · 끝까지 올리면 lockBaseMax배 · 끝까지 내리면 1/lockBaseMax배
    lockBaseMax: 2,
    lockCm: 2.6, lockCmMin: 1.2, lockCmMax: 5,
    lockPull: 0.85,      // 길잡이의 길로 당기는 정도(1 = 완전히 나란히)
    lockRootCm: 1.0,     // 뿌리에서 이만큼은 서서히(뿌리는 제자리)
    lockTaper: 0.45, lockTaperCm: 5,   // 끝으로 갈수록 타래가 모임: 뿌리 간격의 이 비율까지 · 이 길이에 걸쳐
    lockSmoothCm: 3,     // 길잡이의 길을 이 길이(cm)만큼 고르게 편 뒤 타래를 모음(가는 쪽만 펴고 두피에서 뜬 높이는 지킴) — 0이면 예전처럼 살짝만(두 번)
    clumpSize: true, clumpRK: 1, clumpRMin: 0.6, clumpRMax: 1.6,   // (2026-10-10b) 조각마다 잰 크기로 컬 굵기 · 크기 보정 · 사진 전체 값의 이 배수 사이로
    lockClumps: true, lockClumpFr: [0.25, 0.4, 0.55, 0.7, 0.85], lockClumpVotes: 2,   // (2026-10-10m) 사진 타래 조각으로 묶기 · 가닥에서 비춰 볼 자리 · 같은 조각에 이만큼 걸려야
    lockDot: 0.5,        // 길잡이와 가는 쪽이 이만큼은 같아야 같은 타래(아니면 그 칸의 둘째 타래 · 그것도 아니면 그대로)
    radiusK: 1,          // 사진에서 잰 반경에 곱하는 보정(굵기가 사진과 다르면 이것으로)
    waveMin: 30, waveMax: 90,
    // 실제 컬 엔진(뭉침 모양을 건 상태)으로 잰 값: 컬 값 → [웨이브, 가닥이 뼈대에서 벗어나는 거리 cm(중앙값)] (2026-10-08 · 가닥 15~27cm · 엔진 자 19.33cm/단위)
    table: {
      50: [[30, 0.56], [50, 0.73], [60, 0.79], [70, 0.89], [80, 1.04], [90, 1.33]],
      75: [[30, 0.72], [50, 0.95], [60, 1.04], [70, 1.14], [80, 1.37], [90, 1.78]],
      90: [[30, 0.75], [50, 0.93], [60, 1.01], [70, 1.08], [80, 1.26], [90, 1.33]]
    }
  }, W.PHOTO_CURL || {});
  var S = PC.stats = { rCm: null, wave: null, was: null, curl: null, why: '', look: false, calls: 0, err: null };
  var G = REGROW;

  function mqOn() { try { return typeof MANNEQUIN !== 'undefined' && !!MANNEQUIN.on; } catch (e) { return false; } }
  function waveInRow(row, r) {             // 그 컬 값에서 반경 r이 나오는 웨이브(표 밖은 끝 값)
    var i, a, b;
    if (r <= row[0][1]) return row[0][0];
    for (i = 1; i < row.length; i++) { a = row[i - 1]; b = row[i]; if (r <= b[1]) return a[0] + (b[0] - a[0]) * (r - a[1]) / Math.max(1e-6, b[1] - a[1]); }
    return row[row.length - 1][0];
  }
  PC.waveFor = function (rCm, curl) {
    var keys = Object.keys(PC.table).map(Number).sort(function (x, y) { return x - y; }), i, w;
    if (!keys.length || !(rCm > 0)) return 50;
    if (curl <= keys[0]) w = waveInRow(PC.table[keys[0]], rCm);
    else if (curl >= keys[keys.length - 1]) w = waveInRow(PC.table[keys[keys.length - 1]], rCm);
    else for (i = 1; i < keys.length; i++) if (curl <= keys[i]) {
      var w0 = waveInRow(PC.table[keys[i - 1]], rCm), w1 = waveInRow(PC.table[keys[i]], rCm), t = (curl - keys[i - 1]) / (keys[i] - keys[i - 1]);
      w = w0 + (w1 - w0) * t; break;
    }
    return Math.round(Math.max(PC.waveMin, Math.min(PC.waveMax, w)));
  };

  /* ① 사진에서 잰 반경 → 웨이브 */
  //   REGROW.photoCurl(17b) 끝에서 부름
  {
    PC._afterPhotoCurl = function (out) {
      try {
        if (PC.on && PC.radius && !G.curlRadius && out && out.value >= PC.lookMinCurl && out.rCm > 0) {
          var was = out.wave, w = PC.waveFor(out.rCm * PC.radiusK, out.value);
          out.wave = w; out.rodScale = 1; out.photoCurlWave = { was: was, rCm: out.rCm, k: PC.radiusK };
          S.rCm = out.rCm; S.wave = w; S.was = was; S.curl = out.value;
        } else if (out) { S.rCm = out.rCm || null; S.wave = null; S.curl = out.value; S.why = !PC.on ? '꺼짐' : !PC.radius ? '굵기 맞추기 꺼짐(PHOTO_CURL.radius=false)' : G.curlRadius ? '42번 굵기 적용(REGROW.curlRadius)이 켜져 있어 그쪽에 맡김' : !(out.value >= PC.lookMinCurl) ? '컬이 ' + PC.lookMinCurl + ' 미만이라 안 맞춤' : '사진에서 반경을 못 잼'; }
      } catch (e) { S.err = String(e && e.message || e); }
      return out;
    };
  }

  /* ② 뭉침 모양 — 다시 기른 머리 화면(사진에서 잰 컬이 있음)에서 컬을 거는 동안만 */
  function baseCurl() {
    var m = 0;
    try { var b = G && G.base && G.base.sections, k; if (b) for (k in b) if (b[k] && b[k].curl > m) m = b[k].curl; } catch (e) {}
    // 제 머리 바탕으로 건 스타일(59번)이 곱슬 스타일이면 그 컬로 — 직모 손님에게 펌 스타일을 얹은 경우
    try { var ns = W.FLOW_SPEC && W.FLOW_SPEC.nativeState, sp = (ns && ns.id && typeof getStyleSpec === 'function') ? getStyleSpec(ns.id) : null, c = sp && sp.flowBase ? +sp.flowBase.curl : 0; if (c > m) m = c; } catch (e) {}
    return m;
  }
  function lookActive() {
    try { return !!(PC.on && PC.clump && G && G.on && !mqOn() && typeof CURL_BUNDLE !== 'undefined' && baseCurl() >= PC.lookMinCurl); } catch (e) { return false; }
  }
  PC.lookActive = lookActive;
  /* ③ 타래 뼈대 — 모델마다 한 번 만들어 둠(가닥 → 모은 점 배열) */
  var lockMemo = { model: null, ver: -1, map: null, n: 0, locks: 0, moved: 0, ms: 0 }, lver = 0;
  function cmU() { try { var c = (typeof modelCmPerUnit === 'function') ? modelCmPerUnit() : 0; return c > 1 ? c : 19.33; } catch (e) { return 19.33; } }
  function arcs(p) { var a = new Float64Array(p.length), i; for (i = 1; i < p.length; i++) a[i] = a[i - 1] + Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y, p[i].z - p[i - 1].z); return a; }
  function atArc(p, a, s, o) {              // 길 p(호길이 a)에서 s만큼 간 자리 → o · 끝을 넘으면 끝 방향으로 곧게
    var n = p.length, L = a[n - 1], i, t, d;
    if (s >= L) { d = Math.max(1e-9, a[n - 1] - a[n - 2]); t = (s - L) / d; o.x = p[n - 1].x + (p[n - 1].x - p[n - 2].x) * t; o.y = p[n - 1].y + (p[n - 1].y - p[n - 2].y) * t; o.z = p[n - 1].z + (p[n - 1].z - p[n - 2].z) * t; return o; }
    var lo = 0, hi = n - 1; while (hi - lo > 1) { i = (lo + hi) >> 1; if (a[i] <= s) lo = i; else hi = i; }
    t = (s - a[lo]) / Math.max(1e-9, a[hi] - a[lo]); o.x = p[lo].x + (p[hi].x - p[lo].x) * t; o.y = p[lo].y + (p[hi].y - p[lo].y) * t; o.z = p[lo].z + (p[hi].z - p[lo].z) * t; return o;
  }
  function feat(p, a, A) {                  // 가는 쪽: 뿌리 → A만큼 간 자리 · 뿌리 → 끝 (둘 다 길이 1)
    var o = { x: 0, y: 0, z: 0 }, f = new Float32Array(6), l; atArc(p, a, Math.min(A, a[p.length - 1]), o);
    f[0] = o.x - p[0].x; f[1] = o.y - p[0].y; f[2] = o.z - p[0].z; l = Math.hypot(f[0], f[1], f[2]) || 1; f[0] /= l; f[1] /= l; f[2] /= l;
    var e = p[p.length - 1]; f[3] = e.x - p[0].x; f[4] = e.y - p[0].y; f[5] = e.z - p[0].z; l = Math.hypot(f[3], f[4], f[5]) || 1; f[3] /= l; f[4] /= l; f[5] /= l;
    return f;
  }
  function fd(a, b) { return 0.5 * (a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3] + a[4] * b[4] + a[5] * b[5]); }
  function baseOf(sec) {                    // 그 구역의 펌·베이스 폭 → 직경 배수(기본 자리 = 1)
    if (!PC.lockBase) return 1;
    try {
      var d = SECTIONS[sec] && SECTIONS[sec].defaults ? +SECTIONS[sec].defaults.base : NaN, v = state.sections && state.sections[sec] ? +state.sections[sec].base : NaN;
      if (!(d >= 0)) d = 55; if (!(v >= 0)) return 1;
      var t = v >= d ? (v - d) / Math.max(1, 100 - d) : (v - d) / Math.max(1, d);
      return Math.pow(Math.max(1, PC.lockBaseMax), Math.max(-1, Math.min(1, t)));
    } catch (e) { return 1; }
  }
  function lockCmOf(sec) {
    var cm = PC.lockCm; if (S.rCm > 0) cm = 2 * S.rCm * PC.radiusK * PC.lockDia;
    return Math.max(PC.lockCmMin, Math.min(PC.lockCmMax, cm * baseOf(sec)));
  }
  function lockSig() {
    var a = [PC.lockPull, PC.lockTaper, PC.lockDia, PC.lockSmoothCm, PC.lockRootCm, PC.lockTaperCm, PC.lockDot, PC.lockCm, PC.lockCmMin, PC.lockCmMax, PC.radiusK, S.rCm || 0];
    try { if (PC.lockBase && state.sections) Object.keys(state.sections).sort().forEach(function (k) { a.push(k + '=' + (+baseOf(k)).toFixed(3)); }); } catch (e) {}
    return a.join(',');
  }
  /* (2026-10-10m) 사진의 타래 조각으로 묶기 — 42번이 곱슬 사진에서 찾은 조각(밝은 겉면, 앞으로 드러난 반 바퀴) 위를 지나는 가닥끼리 한 타래.
     가닥의 가운데 몇 점을 사진마다 비춰 보고(가려진 자리는 뺌) 가장 많이 걸린 (사진, 조각)을 그 가닥의 타래로. 못 찾으면 예전처럼 뿌리 칸. */
  var CK = null, nClump = 0;
  function prepClumps() {
    CK = null; nClump = 0;
    if (!PC.lockClumps || !G || typeof G.clumpsFor !== 'function') return;
    try {
      var photo = state._hair3Dneutral, probe = (photo && photo.occ && photo.occ.probe) || (state.hairOcc3D && state.hairOcc3D.probe), E = getScalpEllipsoid();
      if (!probe || !probe.cams || !photo || !isFinite(photo.yTop)) return;
      var env = { CY: photo.CY, yTop: photo.yTop, a2: E.a * E.a, b2: E.b * E.b, c2: E.c * E.c, yBody: photo.CY - 0.7 * E.b }, views = [];
      probe.cams.forEach(function (c) {
        var cl = G.clumpsFor(c.angle), mi = state.hairMasks && state.hairMasks[c.angle];
        if (!cl || !mi || !(c.s > 0)) return;
        var kx0 = cl.W / (mi.w || cl.W), cmU0 = (typeof modelCmPerUnit === 'function' ? modelCmPerUnit() : 0) || 19.33;
        views.push({ c: c, cl: cl, kx: kx0, ky: cl.H / (mi.h || cl.H), cmPx: c.s * cmU0 / (kx0 || 1) });
      });
      if (views.length) CK = { env: env, views: views };
    } catch (e) { CK = null; }
  }
  var pj = [0, 0];
  function projectP(c, env, p) {                   // 60번과 같은 식(사진 카메라 · 두상 뒤로 가려지면 0)
    var R = c.R, x = p.x, y = p.y - env.CY, z = p.z;
    pj[0] = (R[0] * x + R[1] * y + R[2] * z) / c.s + c.cx;
    pj[1] = c.crownY + (env.yTop - ((R[3] * x + R[4] * y + R[5] * z) + env.CY)) / c.sy;
    if (R[6] * x + R[7] * y + R[8] * z < 0) {
      if (p.y < env.yBody) return 0;
      var dx = R[6], dy = R[7], dz = R[8], A = dx * dx / env.a2 + dy * dy / env.b2 + dz * dz / env.c2, B = 2 * (x * dx / env.a2 + y * dy / env.b2 + z * dz / env.c2), C = x * x / env.a2 + y * y / env.b2 + z * z / env.c2 - 0.96, D = B * B - 4 * A * C;
      if (D > 0 && (-B + Math.sqrt(D)) / (2 * A) > 1e-4) return 0;
    }
    return 1;
  }
  function clumpKey(p) {
    var votes = {}, best = 0, bk = 0, fr = PC.lockClumpFr, i, v, hitOf = {};
    for (i = 0; i < fr.length; i++) {
      var q = p[Math.min(p.length - 1, Math.round(fr[i] * (p.length - 1)))];
      for (v = 0; v < CK.views.length; v++) {
        var V = CK.views[v]; if (!projectP(V.c, CK.env, q)) continue;
        var lx = Math.floor(pj[0] * V.kx), ly = Math.floor(pj[1] * V.ky); if (lx < 0 || ly < 0 || lx >= V.cl.W || ly >= V.cl.H) continue;
        var lb = V.cl.lab[ly * V.cl.W + lx]; if (!(lb > 0)) continue;
        var key = (v + 1) * 40000 + lb; votes[key] = (votes[key] || 0) + 1; if (!hitOf[key]) hitOf[key] = { fr: fr[i], v: v }; if (votes[key] > best) { best = votes[key]; bk = key; }
      }
    }
    lastHit = best >= PC.lockClumpVotes ? hitOf[bk] : null;
    return best >= PC.lockClumpVotes ? bk : 0;
  }
  var lastHit = null;
  /* (2026-10-10b) 조각마다 컬 크기 — 조각 = 앞으로 드러난 반 바퀴(C·S자): 긴 축 길이(4σ) = 2.83 × 감기는 중심 반경 · 폭 = 타래 굵기 → 바깥 반경 = 길이 ÷ 2.83 + 폭 ÷ 2 (사진 조각 중앙값으로 약 1.2cm — 사진 전체 어림값과 비슷) */
  function clumpRcm(key) {
    if (!CK || !key) return 0;
    var v = Math.floor(key / 40000) - 1, lb = key % 40000, V = CK.views[v]; if (!V || !V.cl.len || !(lb > 0)) return 0;
    var r = (V.cl.len[lb] / 2.83 + V.cl.wid[lb] / 2) * V.cmPx * PC.clumpRK;   // 반원 점들의 긴 축 4σ = 2.83×중심 반경 · 바깥 반경 = 중심 반경 + 굵기 절반
    return r > 0 ? r : 0;
  }
  function buildLocks(model) {
    prepClumps(); var rOf = new Map(), rList = [];
    var t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now()), cu = cmU(), S0 = model.strands, n = S0.length, map = new Map(), cells = new Map(), i, s, p, k;
    var cmBy = {}, cmLo = Infinity, cmHi = 0, c;
    var A = 3 / cu, rootL = Math.max(1e-4, PC.lockRootCm / cu), tapL = Math.max(1e-4, PC.lockTaperCm / cu), recs = [];
    for (i = 0; i < n; i++) {
      s = S0[i]; p = s && s.pts; if (!p || p.length < 4 || !s.regrown) continue;
      var a = arcs(p); if (!(a[p.length - 1] > 1e-4)) continue;
      var sc = s.sec == null ? '' : s.sec; if (!(sc in cmBy)) { cmBy[sc] = lockCmOf(sc); cmLo = Math.min(cmLo, cmBy[sc]); cmHi = Math.max(cmHi, cmBy[sc]); }
      c = cmBy[sc] / cu;
      var ck = CK ? clumpKey(p) : 0; if (ck) { nClump++; var rc = clumpRcm(ck); if (rc > 0) { rOf.set(s, rc); rList.push(rc); } }
      var r = { s: s, p: p, a: a, f: feat(p, a, A) }; k = ck ? 'c' + ck : sc + '|' + Math.floor(p[0].x / c) + ',' + Math.floor(p[0].y / c) + ',' + Math.floor(p[0].z / c);
      var g = cells.get(k); if (!g) { g = []; cells.set(k, g); } g.push(r);
    }
    var locks = 0, moved = 0, o = { x: 0, y: 0, z: 0 }, EL = null, ECY = 0;
    try { EL = getScalpEllipsoid(); ECY = (typeof SCALP_CENTER_Y !== 'undefined' && isFinite(SCALP_CENTER_Y)) ? SCALP_CENTER_Y : (model.CY || 0); } catch (e) { EL = null; }
    function make(G0) {                      // 한 무리 → 길잡이를 뽑아 타래로 · 남은 가닥을 돌려줌
      var m = G0.length, lim = Math.min(m, 40), st = m / lim, best = -1, bi = 0, x, y, cnt;
      for (x = 0; x < lim; x++) { var ra = G0[Math.floor(x * st)]; cnt = 0; for (y = 0; y < lim; y++) if (fd(ra.f, G0[Math.floor(y * st)].f) >= 0.8) cnt++; ra.c = cnt; if (cnt > best) { best = cnt; bi = Math.floor(x * st); } }
      if (PC.lockSmoothCm > 0) { var bl = 0; for (x = 0; x < lim; x++) { var rb = G0[Math.floor(x * st)], ll = rb.a[rb.p.length - 1]; if (rb.c >= best * 0.8 && ll > bl) { bl = ll; bi = Math.floor(x * st); } } }
      var Ld = G0[bi], rest = [], mem = [], j;
      for (j = 0; j < m; j++) (fd(G0[j].f, Ld.f) >= PC.lockDot ? mem : rest).push(G0[j]);
      if (mem.length < 2) return rest.length === m ? [] : rest;
      // 길잡이의 길을 두 번 고르게(한 가닥의 잔 꺾임이 타래 전체에 복사되지 않게)
      var lp = Ld.p.map(function (q) { return { x: q.x, y: q.y, z: q.z }; }), ps, q;
      var nps = 2, kk0 = null, ekf = function (v) { var ex = v.x / EL.a, ey = (v.y - ECY) / EL.b, ez = v.z / EL.c; return Math.sqrt(ex * ex + ey * ey + ez * ez); };
      if (PC.lockSmoothCm > 0 && lp.length > 3) {
        var stp = Ld.a[lp.length - 1] / (lp.length - 1), sg = PC.lockSmoothCm / cu / Math.max(1e-6, stp); nps = Math.max(2, Math.min(600, Math.round(2 * sg * sg)));
        if (EL) { kk0 = lp.map(ekf); for (ps = 0; ps < 6; ps++) for (q = 1; q < kk0.length - 1; q++) kk0[q] = (kk0[q - 1] + 2 * kk0[q] + kk0[q + 1]) / 4; }   // 두피에서 뜬 높이(부피)는 지킴 — 살짝만 고름
      }
      for (ps = 0; ps < nps; ps++) for (q = 1; q < lp.length - 1; q++) { lp[q] = { x: (lp[q - 1].x + 2 * lp[q].x + lp[q + 1].x) / 4, y: (lp[q - 1].y + 2 * lp[q].y + lp[q + 1].y) / 4, z: (lp[q - 1].z + 2 * lp[q].z + lp[q + 1].z) / 4 }; }
      if (kk0) for (q = 1; q < lp.length; q++) {                                  // 편 길: 가는 쪽만 펴고 높이는 원래대로(두피 안으로도 안 들어감)
        var ek = ekf(lp[q]), tg = Math.max(1.012, kk0[q]);
        if (ek > 1e-6) { var em = tg / ek; lp[q] = { x: lp[q].x * em, y: ECY + (lp[q].y - ECY) * em, z: lp[q].z * em }; }
      }
      var la = arcs(lp), r0 = Ld.p[0], laL = la[lp.length - 1], rawL = Ld.a[Ld.p.length - 1], lk = PC.lockSmoothCm > 0 ? laL / Math.max(1e-9, rawL) : 1, tipM = { x: 0, y: 0, z: 0 };
      mem.forEach(function (rc) {
        var pp = rc.p, aa = rc.a, out = new Array(pp.length), dx = pp[0].x - r0.x, dy = pp[0].y - r0.y, dz = pp[0].z - r0.z, q2, sx, tp, w;
        out[0] = pp[0];
        for (q2 = 1; q2 < pp.length; q2++) {
          sx = aa[q2];
          if (PC.lockSmoothCm > 0) {
            if (sx <= rawL) atArc(lp, la, sx * lk, o);
            else { atArc(pp, aa, rawL, tipM); o.x = lp[lp.length - 1].x + (pp[q2].x - tipM.x); o.y = lp[lp.length - 1].y + (pp[q2].y - tipM.y); o.z = lp[lp.length - 1].z + (pp[q2].z - tipM.z); }   // 길잡이보다 긴 가닥: 남은 길은 제 모양대로 이어 감(곧은 막대가 되지 않게)
          } else atArc(lp, la, sx, o);
          tp = sx >= tapL ? PC.lockTaper : 1 - (1 - PC.lockTaper) * sx / tapL;
          w = PC.lockPull * Math.min(1, sx / rootL);
          out[q2] = { x: pp[q2].x + (o.x + dx * tp - pp[q2].x) * w, y: pp[q2].y + (o.y + dy * tp - pp[q2].y) * w, z: pp[q2].z + (o.z + dz * tp - pp[q2].z) * w };
        }
        map.set(rc.s, out); moved++;
      });
      locks++;
      return rest;
    }
    cells.forEach(function (g) { var rest = make(g); if (rest.length >= 2) make(rest); });
    if (!(cmHi > 0)) cmLo = cmHi = lockCmOf('');
    rList.sort(function (x, y) { return x - y; });
    lockMemo = { rOf: rOf, rMed: rList.length ? rList[rList.length >> 1] : 0, rP25: rList.length ? rList[Math.floor(rList.length * 0.25)] : 0, rP75: rList.length ? rList[Math.floor(rList.length * 0.75)] : 0, clumped: nClump, clumpViews: CK ? CK.views.length : 0, model: model, ver: lver, sig: lockSig(), map: map, n: n, locks: locks, moved: moved, cm: cmLo, cmHi: cmHi, per: moved / Math.max(1, locks), ms: (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0 };
    try { if (nClump) console.log(TAG + ' 타래 뼈대 — 사진 타래 조각으로 묶은 가닥 ' + nClump + '/' + n + ' · 타래 ' + locks + '개 · 조각 크기 반경(25/50/75%) ' + (lockMemo.rMed ? lockMemo.rP25.toFixed(1) + '/' + lockMemo.rMed.toFixed(1) + '/' + lockMemo.rP75.toFixed(1) + 'cm' : '-') + ' · 사진 전체 반경 ' + (S.rCm > 0 ? (+S.rCm).toFixed(1) + 'cm' : '-')); } catch (e) {}
    return lockMemo;
  }
  function lockedPts(s) {
    var m = G && G.model; if (!m || !m.strands) return null;
    var sg = lockSig();
    if (lockMemo.model !== m || lockMemo.ver !== lver || lockMemo.sig !== sg) { try { buildLocks(m); } catch (e) { S.err = '타래 만들기: ' + (e && e.message || e); lockMemo = { model: m, ver: lver, sig: sg, map: new Map(), n: 0, locks: 0, moved: 0, ms: 0 }; } }
    return lockMemo.map.get(s) || null;
  }
  PC._locks = function () { return lockMemo; };
  var curS = null;
  /* adjustStrandGeom(17b) 맨 앞 — 타래 뼈대로 바꾼 가닥(없으면 null). 바꾼 가닥으로 다시 부르는 동안(curS)은 null */
  PC._lockFor = function (s) {
    if (s && s === curS) return null;
    if (s && s.regrown && !s.mannequin && s.pts && PC.lock && lookActive()) return lockedPts(s);
    return null;
  };
  PC._withLock = function (s, lp, run) { var keepP = s.pts, keepC = curS; s.pts = lp; curS = s; try { return run(); } finally { s.pts = keepP; curS = keepC; } };

  /* 안쪽 말기 — curlStrand3D(14)를 다시 부르되 이 단계(_curlStage)는 건너뜀 */
  var inInner = false;
  function innerCurl() { var save = inInner; inInner = true; try { return curlStrand3D.apply(this, arguments); } finally { inInner = save; } }
  PC._inInner = function () { return inInner; };
  /* ④ (2026-10-10t) 원본 = 맨 마네킹 + 잰 컬 — 사용자: "이제는 값을 좀 더 정밀하게 받으니까 마네킨 모드에 다시 올려보자"
   *  예전에 컬 손님을 마네킹에 올렸을 때 부피가 죽은 원인(컬 엔진으로 직접 잼 · 30cm 직모 · 컬 82):
   *    엔진 기본값은 끝에서 20cm만 감음(windCm 20) → 뿌리에서 17cm는 곧은 채 · 반경도 가닥마다 흩어짐.
   *  지금: 원본(마네킹+스펙)을 볼 때만 · 스펙의 컬이 lookMinCurl 이상이고 잰 반경이 있으면
   *    · 뿌리부터 끝까지 감음(windCm 99 · rootLeaveCm 1) · 뭉침 모양(look)
   *    · 웨이브 = 엔진이 잰 반경을 내는 값, 한 바퀴 간격(pitchThick) = 잰 간격을 내는 값 — 엔진을 직선 가닥에 돌려 이분법으로 찾음(값마다 한 번)
   *    · 감으면 줄어드는 만큼 미리 늘림(엔진으로 잰 남는 비율) → 겉 길이 = 스펙 길이 */
  PC.mq = true; PC.mqVolCut = true; PC.mqVolKeepCm = 1; PC.mqWind = 999; PC.mqRootLeave = 1; PC.mqStretch = true;
  var mqMemo = { key: '', wave: null, pt: null, remain: 1, r: null, P: null }, mqS = PC.mqStats = { calls: 0, solved: '' };
  function origSpec() {
    try { var OM = W.ORIG_MQ; if (!OM || !OM.on || !mqOn() || typeof OM.isOriginal !== 'function' || !OM.isOriginal()) return null; var sp = OM.spec, pm = sp && sp.perm; return (pm && pm.curl >= PC.lookMinCurl && pm.rCm > 0) ? pm : null; } catch (e) { return null; }
  }
  function engineOn(C, w, pt) {                // 직선 30cm 가닥에 엔진을 돌려 반경·간격·남는 비율을 잼
    var CB = CURL_BUNDLE, cm = CB.cmPerUnit || 19.33, L = 30 / cm, n = 300, g = [], i, k, sv = {}, o = {}, p;
    for (k in PC.look) o[k] = PC.look[k]; o.windCm = PC.mqWind; o.rootLeaveCm = PC.mqRootLeave; if (pt != null) o.pitchThick = pt;
    for (i = 0; i <= n; i++) g.push({ x: 0, y: -i * L / n, z: 0.4 });
    for (k in o) { sv[k] = CB[k]; CB[k] = o[k]; }
    try { p = innerCurl(g, C, w / 100, 0); } finally { for (k in sv) CB[k] = sv[k]; }
    var m = p.length, R = [], H = Math.max(5, Math.round(m / 40)), zc = [];
    for (i = H; i < m - H; i++) { var ax = 0, az = 0, j; for (j = i - H; j <= i + H; j++) { ax += p[j].x; az += p[j].z; } ax /= 2 * H + 1; az /= 2 * H + 1; R.push(Math.hypot(p[i].x - ax, p[i].z - az) * cm); }
    R.sort(function (x, y) { return x - y; });
    // (2026-10-11c) 한 바퀴 간격 — 가닥 축(이동 평균)에서 벗어난 x가 부호를 바꾸는 자리로 셈(예전: x=0 기준이라 축이 옆으로 흐르면 못 셌음 → 간격 값이 끝까지 올라가 웨이브가 풀림)
    var dxs = new Float64Array(m);
    for (i = 0; i < m; i++) { var lo2 = Math.max(0, i - H), hi2 = Math.min(m - 1, i + H), sx = 0, j2; for (j2 = lo2; j2 <= hi2; j2++) sx += p[j2].x; dxs[i] = p[i].x - sx / (hi2 - lo2 + 1); }
    for (i = H + 1; i < m - H; i++) if (dxs[i] * dxs[i - 1] < 0) zc.push(p[i].y);
    return { r: R.length ? R[R.length >> 1] : 0, P: zc.length > 3 ? (zc[1] - zc[zc.length - 1]) / ((zc.length - 2) / 2) * cm : NaN, remain: (p[0].y - p[m - 1].y) * cm / 30 };
  }
  function mqSolve(C, rT0, PT0) {
    var key = [C, rT0.toFixed(2), PT0 ? PT0.toFixed(2) : '-', PC.mqWind, PC.mqRootLeave, JSON.stringify(PC.look)].join('|');
    if (mqMemo.key === key) return mqMemo;
    // (2026-10-11a) 엔진이 낼 수 있는 가장 굵은 반경보다 굵으면(굵은 웨이브 3.9cm 등) 가닥을 ks배 줄여서 감고 다시 키움 — 반경·간격이 같이 ks배
    var eMax = engineOn(C, 100, null), ks = (eMax.r > 0 && rT0 > eMax.r * 0.9) ? rT0 / (eMax.r * 0.9) : 1;
    var rT = rT0 / ks, PT = PT0 ? PT0 / ks : PT0;
    var lo = 0, hi = 100, i, e, w = 50;
    for (i = 0; i < 9; i++) { w = (lo + hi) / 2; e = engineOn(C, w, null); if (e.r < rT) lo = w; else hi = w; }
    w = Math.round((lo + hi) / 2);
    var pt = PC.look.pitchThick || 1.4;
    if (PT > 0) { var a = 0.2, b = 6; for (i = 0; i < 9; i++) { pt = Math.sqrt(a * b); e = engineOn(C, w, pt); if (!(e.P > 0)) { b = pt; continue; } if (e.P < PT) a = pt; else b = pt; } pt = Math.sqrt(a * b); }   // 간격을 못 재면(감기지 않음) 더 촘촘한 쪽으로
    e = engineOn(C, w, pt);
    mqMemo = { key: key, wave: w, pt: pt, ks: ks, remain: Math.max(0.12, Math.min(1, e.remain)), r: e.r * ks, P: e.P * ks };
    mqS.solved = '컬 ' + C + ' · 잰 반경 ' + rT0.toFixed(2) + 'cm' + (PT0 ? ' · 잰 간격 ' + PT0.toFixed(1) + 'cm' : '') + ' → 웨이브 ' + w + ' · 간격 값 ' + pt.toFixed(2) + (ks > 1 ? ' · 가닥을 1/' + ks.toFixed(2) + '로 줄여 감고 다시 키움' : '') + ' (엔진: 반경 ' + (e.r * ks).toFixed(2) + ' · 간격 ' + (e.P > 0 ? (e.P * ks).toFixed(1) : '-') + 'cm · 남는 길이 ' + e.remain.toFixed(2) + ')';
    try { console.log(TAG + ' ④ 마네킹 위 잰 컬 — ' + mqS.solved); } catch (e2) {}
    return mqMemo;
  }
  /* (2026-10-11c) ② 사진 결을 따라 그은 선으로 잰 모양(66번) — 웨이브(S자)면 나선 대신 납작한 물결로
   *  사용자: "완전히 말린 컬이 아닌데, 계속 말려서 나와" · "방향필터가 있는데 이거 구분해서 해야돼?"
   *  사진 4장의 선: 고리 정도(0=S자 · 1=고리) · 파장 · 진폭 → 고리 정도 waveLoopMax 미만이면 웨이브.
   *  물결: 축(마네킹 가닥)을 따라 진폭 × sin(2π·호길이/파장 + 위상) 만큼 옆(두상 면에 나란한 방향)으로 흔듦. 뿌리 waveRootCm는 서서히.
   *  위상은 2cm 칸마다 같게(한 타래가 같이 출렁임) · 겉 길이 = 축 길이(스펙 길이). */
  PC.waveMode = true; PC.waveLoopMax = 0.33; PC.waveRootCm = 2; PC.waveLockCm = 2; PC.waveJitter = 0.35;
  var wsMemo = { key: '', v: null };
  function waveShape() {
    var key = ''; try { key = (state._hair3Dneutral ? 1 : 0) + '|' + (G && G.model ? G.model.strands.length : 0); } catch (e) {}
    if (wsMemo.key === key && wsMemo.v) return wsMemo.v;
    var loops = [], lams = [], amps = [], views = [], byView = {}, nAll = 0, sfA = [];
    (typeof ANGLES !== 'undefined' ? ANGLES : ['front', 'left', 'right', 'back']).forEach(function (a) {
      try {
        var id = state.hairMasks && state.hairMasks[a] && state.hairMasks[a].identity, ws = id && id.waveShape; if (!ws || !(ws.bent >= 20)) return;
        var cpp = G && G.cmPerMaskPx ? G.cmPerMaskPx(a) : null; if (!(cpp > 0)) return;
        if (isFinite(ws.straightFrac)) sfA.push(ws.straightFrac);   // (2026-10-20) 곧은 선 비율 — 직모를 웨이브로 잘못 보지 않게
        if (isFinite(ws.loop)) loops.push(ws.loop); if (isFinite(ws.lamPx)) lams.push(ws.lamPx * cpp); if (isFinite(ws.ampPx)) amps.push(ws.ampPx * cpp);
        if (ws.all && ws.all.length) { byView[a] = ws.all.map(function (l) { return [l[0], l[1], l[2] * cpp, l[3] * cpp, l[4], l[5]]; }); nAll += ws.all.length; }
        views.push(a + ' 고리 ' + (+ws.loop).toFixed(2) + ' · 파장 ' + (ws.lamPx * cpp).toFixed(1) + ' · 진폭 ' + (ws.ampPx * cpp).toFixed(2) + 'cm');
      } catch (e) {}
    });
    function med(a) { a = a.slice().sort(function (x, y) { return x - y; }); return a.length ? a[a.length >> 1] : NaN; }
    var v = { loop: med(loops), lamCm: med(lams), ampCm: med(amps), views: views, byView: byView, nAll: nAll, straightFrac: med(sfA) };
    v.isWave = isFinite(v.loop) && v.loop < PC.waveLoopMax && v.lamCm > 1 && v.ampCm > 0.05
      && v.ampCm / v.lamCm < (PC.waveSteepMax || 0.12)                    // (2026-10-18 배포본) 가파른 굴곡은 웨이브 아님
      && !(v.straightFrac >= (PC.waveStraightMax || 0.6));               // (2026-10-20) 곧은 선이 60% 이상이면 직모 — 웨이브 아님
    wsMemo = { key: key, v: v };
    try { console.log(TAG + ' ② 사진 선 모양 — ' + (v.isWave ? '웨이브(S자)' : '컬(고리)') + ' · 고리 정도 ' + (+v.loop).toFixed(2) + '(웨이브 기준 ' + PC.waveLoopMax + ' 미만) · 파장 ' + (+v.lamCm).toFixed(1) + 'cm · 진폭 ' + (+v.ampCm).toFixed(2) + 'cm · ' + views.join(' | ')); } catch (e) {}
    return v;
  }
  PC.waveShape = waveShape;
  function hash3(x, y, z) { var h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return h - Math.floor(h); }
  function waveStrand(g, A, lam) {
    var cpu = (typeof CURL_BUNDLE !== 'undefined' && CURL_BUNDLE.cmPerUnit) || 19.33, Au = A / cpu, Lu = lam / cpu, ru = PC.waveRootCm / cpu;
    var CY0 = 0; try { CY0 = (G && G.model && G.model.CY) || (state._hair3Dneutral && state._hair3Dneutral.CY) || 0; } catch (e) {}
    var S = [0], i; for (i = 1; i < g.length; i++) S.push(S[i - 1] + Math.hypot(g[i].x - g[i - 1].x, g[i].y - g[i - 1].y, g[i].z - g[i - 1].z));
    var Ltot = S[S.length - 1]; if (!(Ltot > 1e-6)) return g;
    var cell = PC.waveLockCm / cpu, r0 = g[0], ph = 2 * Math.PI * hash3(Math.floor(r0.x / cell), Math.floor(r0.y / cell), Math.floor(r0.z / cell)) + PC.waveJitter * (hash3(r0.x * 91, r0.y * 37, r0.z * 53) - 0.5);
    var ds = Math.min(Lu / 24, Ltot / 6), m = Math.max(3, Math.ceil(Ltot / ds) + 1), out = [], j = 0;
    for (i = 0; i < m; i++) {
      var s = Math.min(Ltot, i * ds); while (j < g.length - 2 && S[j + 1] < s) j++;
      var u = (s - S[j]) / Math.max(1e-12, S[j + 1] - S[j]), a = g[j], b = g[j + 1];
      var px = a.x + (b.x - a.x) * u, py = a.y + (b.y - a.y) * u, pz = a.z + (b.z - a.z) * u;
      var tx = b.x - a.x, ty = b.y - a.y, tz = b.z - a.z, tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
      var ox = px, oy = py - CY0, oz = pz, ol = Math.hypot(ox, oy, oz) || 1; ox /= ol; oy /= ol; oz /= ol;
      var bx = ty * oz - tz * oy, by = tz * ox - tx * oz, bz = tx * oy - ty * ox, bl = Math.hypot(bx, by, bz);
      if (!(bl > 1e-6)) { bx = 1; by = 0; bz = 0; bl = 1; } bx /= bl; by /= bl; bz /= bl;
      var w = rootW(s, cpu);
      var off = Au * w * Math.sin(2 * Math.PI * s / Lu + ph);
      out.push({ x: px + bx * off, y: py + by * off, z: pz + bz * off });
    }
    return out;
  }
  /* (2026-10-11d) 기준선 없이 컬 모양 — 사용자: "기준을 두지 않고 결흐름대로만" · "웨이브 판정 이거 아직 판정해야돼?"
   *  얼마나 고리인가 w(0 = 납작한 S자 · 1 = 둥근 나선)를 사진 선의 두 값으로 정함: 고리 정도(0.15→0 · 0.5→1)와 가파름(진폭÷파장 0.06→0 · 0.15→1)의 평균.
   *  크기·간격은 w만큼 나선 측정(42번 반경·한 바퀴)에서, 1−w만큼 사진 선(진폭·파장)에서. 앞뒤(두상 바깥) 굴곡 = 크기 × w.
   *  사진 선이 없으면 나선 측정만(w=1). 위상은 뿌리 자리의 부드러운 함수(칸 경계 없음 — 두상 위 격자 줄 고침) + 가닥마다 조금. */
  PC.shapeMode = true; PC.shapeLoop = [0.15, 0.5]; PC.shapeSteep = [0.06, 0.15]; PC.shapeRootCm = 1.5; PC.phaseWaveCm = 7; PC.phaseJit = 0.5; PC.phaseJitAsIs = 2.0;   // (2026-10-12g) 방향 필터 그대로일 때 가닥마다 흩는 위상(라디안) — 0.5면 이웃 가닥이 같은 자리에서 같이 출렁여 겹쳐 보임(뭉침 · 가닥 수가 적어 보임)
  /* (2026-10-12e) 읽은 굴곡 그대로 — 42번이 모아 둔 '읽은 굴곡 장'을 원본 머리(마네킹 + 스펙) 가닥에 얹고, 지어낸 웨이브는 "못 읽은 만큼만" 채움
       자리 p에서:  가닥 = 뼈대 + gain × D(p) + (1 − gain × aC(p) ÷ 잰 굴곡 크기) × 지어낸 굴곡
         D = 그 자리에서 읽은 벗어남(이웃 가닥이 같이 굽은 것만 남음) · aC = 그 크기
         gain = 잰 굴곡 크기(③) ÷ 읽은 굴곡의 크기(걸음이 넓어 읽은 굴곡이 실제보다 작게 잡히는 것을 사진 값으로 맞춤 · 1~readGainMax)
       장이 모르는 자리(가닥이 안 지나간 곳)·못 읽은 자리(가닥마다 제각각 = 잔 컬)는 D ≈ 0 · aC ≈ 0 → 지금처럼 잰 값으로 지어낸 굴곡.
       기본은 꺼짐 — 주소 끝에 ?rw=1 을 붙이거나 콘솔에서 PHOTO_CURL.readWave=true 후 PHOTO_CURL.refresh() (같은 올림으로 켠 것·끈 것을 바로 비교) */
  PC.readWave = false; PC.readGainMax = 2.5; PC.readFill = true;
  /* (2026-10-12f) 방향 필터에서 읽은 첫 값 그대로 — 사용자: "웨이브와 컬이 방향필터에서 읽어낸 초기 정보 그대로 그려지도록 해줘. roots 고르게 펴주고"
   *  예전(11d): 크기·간격을 사진 선(66번)과 42번 나선 측정 사이에서 섞음(w) → 사진에서 읽은 웨이브가 나선 값에 끌려 굵거나 가늘게 나옴.
   *  지금: 사진 선이 있으면 크기 = 66번 진폭 · 한 번 = 66번 파장 · 앞뒤 굴곡(S자 ↔ 고리) = 66번 고리 정도만으로. 나선 측정·표(table)는 안 섞음.
   *        다시 기른 머리 화면(뭉침 모양이 걸리는 쪽)에서도 같은 식으로 그림(사진 선이 있을 때). 사진 선이 없으면 예전 그대로.
   *  뿌리: 모든 가닥이 뿌리에서 rootStraightCm 만큼은 곧게(굴곡 0) · 그 뒤 shapeRootCm에 걸쳐 같은 곡선으로 서서히 — 읽은 굴곡 장(⑤)도 같은 비율로.
   *  예전 = PHOTO_CURL.gaborAsIs=false; PHOTO_CURL.rootStraightCm=0 후 PHOTO_CURL.refresh() */
  PC.gaborAsIs = true; PC.rootStraightCm = 1.0; PC.gaborPitchFromHelix = true;
  function rootW(s, cpu) {                                                // 뿌리 펴기 — 모든 가닥 같은 곡선(곧게 rootStraightCm → shapeRootCm에 걸쳐 0→1)
    var s0 = (PC.rootStraightCm || 0) / cpu, rr = Math.max(1e-6, (PC.shapeRootCm || 0) / cpu), w = (s - s0) / rr;
    if (w <= 0) return 0; if (w >= 1) return 1; return w * w * (3 - 2 * w);
  }
  function gaborOK() { if (!PC.gaborAsIs) return false; var ws = waveShape(); return !!(ws && isFinite(ws.loop) && ws.lamCm > 0 && ws.ampCm > 0); }
  PC.gaborOK = gaborOK;
  try { var rwQ = /[?&]rw=([0-9.]+)/.exec(String(location.search || '')); if (rwQ) PC.readWave = +rwQ[1] > 0; } catch (e) {}
  var rwMemo = { wf: null, gain: 1, lineU: 0 };
  function readField(SH, cpu) {
    if (!PC.readWave || !G || typeof G.waveField !== 'function') return null;
    var wf = G.waveField(); if (!wf || !(wf.known > 0)) return null;
    var lineCm = SH.A, lineU = lineCm / cpu;   // 목표 크기 = ③에서 정한 굴곡 크기(사진 선 진폭과 나선 반경을 섞은 값 — 지어낸 굴곡이 쓰는 것과 같은 값)
    if (rwMemo.wf !== wf || rwMemo.lineU !== lineU) {
      var g0 = wf.ampU > 1e-9 ? lineU / wf.ampU : 1; g0 = Math.max(1, Math.min(PC.readGainMax, g0));
      rwMemo = { wf: wf, gain: g0, lineU: lineU };
      mqS.readTxt = '잰 굴곡 크기 ' + lineCm.toFixed(2) + 'cm ÷ 읽은 굴곡 ' + (wf.ampU * cpu).toFixed(2) + 'cm → ×' + g0.toFixed(2); mqS.readPts = 0; mqS.readFillSum = 0; mqS.readKnown = 0;
      try { console.log(TAG + ' ⑤ 읽은 굴곡 그대로 — ' + mqS.readTxt + ' · 아는 칸 ' + wf.known); } catch (e) {}
    }
    return rwMemo;
  }
  var bsMemo = { key: '', v: null };
  function blendShape(pm) {
    pm = pm || {}; var key = ''; try { key = [pm.rCm, pm.pitchCm, wsMemo.key, PC.gaborAsIs ? 'g' : ''].join('|'); } catch (e) {}
    var ws = waveShape();
    if (bsMemo.key === key + '|' + (ws ? ws.loop : '') && bsMemo.v) return bsMemo.v;
    var rH = pm.rCm > 0 ? pm.rCm * PC.radiusK : null, pH = pm.pitchCm > 0 ? pm.pitchCm : (rH ? rH * 2 : null), w = 1, A, L, src;
    function cl(x) { return Math.max(0, Math.min(1, x)); }
    if (PC.gaborAsIs && ws && isFinite(ws.loop) && ws.lamCm > 0 && ws.ampCm > 0) {
      // (2026-10-12g) 옆에서 찍은 사진에서 나선(컬)은 S자로 비칩니다 — 고리 정도만으로는 컬을 못 가림(짧은 곱슬 손님: 고리 0.29 → 웨이브로만 나옴).
      //   같은 사진 선의 가파름(진폭 ÷ 파장)이 크면 나선 — 둘 중 큰 쪽. 1이면 둥근 나선(반경 = 진폭 · 한 바퀴 = 파장), 0이면 납작한 S자.
      var wl0 = cl((ws.loop - PC.shapeLoop[0]) / (PC.shapeLoop[1] - PC.shapeLoop[0])), ws0 = cl((ws.ampCm / ws.lamCm - PC.shapeSteep[0]) / (PC.shapeSteep[1] - PC.shapeSteep[0]));
      w = Math.max(wl0, ws0);
      A = ws.ampCm; L = ws.lamCm; src = '방향 필터 그대로';
      // (2026-10-12h) 컬 쪽(w)은 한 바퀴 길이만 나선 측정으로 — 방향 필터 선은 촘촘한 컬의 꺾임을 따라가지 못해 큰 흐름의 굴곡을 잼(짧은 곱슬: 선 5.2cm · 나선 측정 2.1~2.7cm → 늘어난 스프링 = 웨이브로 보임)
      if (PC.gaborPitchFromHelix && pH > 0) { L = (1 - w) * ws.lamCm + w * pH; src = '방향 필터 그대로 · 한 바퀴는 나선 측정 ×' + w.toFixed(2); }
    } else if (ws && isFinite(ws.loop) && ws.lamCm > 0 && ws.ampCm > 0) {
      var wl = cl((ws.loop - PC.shapeLoop[0]) / (PC.shapeLoop[1] - PC.shapeLoop[0])), stp = ws.ampCm / ws.lamCm, wsx = cl((stp - PC.shapeSteep[0]) / (PC.shapeSteep[1] - PC.shapeSteep[0]));
      w = (wl + wsx) / 2;
      A = rH ? (1 - w) * ws.ampCm + w * rH : ws.ampCm; L = pH ? (1 - w) * ws.lamCm + w * pH : ws.lamCm; src = '사진 선 + 나선 측정';
    } else if (rH && pH) { A = rH; L = pH; src = '나선 측정만'; }
    else return null;
    var v = { A: A, L: L, w: w, depth: w, pH: pH, gab: (PC.gaborAsIs && ws && ws.byView && ws.nAll > 0) ? ws : null };
    bsMemo = { key: key + '|' + (ws ? ws.loop : ''), v: v };
    mqS.shapeTxt = '고리 정도 ' + (ws ? (+ws.loop).toFixed(2) : '-') + ' · 가파름 ' + (ws ? (ws.ampCm / ws.lamCm).toFixed(3) : '-') + ' → 나선 쪽 ' + w.toFixed(2) + ' · 크기 ' + A.toFixed(2) + 'cm · 한 번 ' + L.toFixed(1) + 'cm · 앞뒤 굴곡 ×' + w.toFixed(2) + ' (' + src + ')';
    try { console.log(TAG + ' ③ 컬 모양(기준선 없음) — ' + mqS.shapeTxt); } catch (e) {}
    return v;
  }
  function smoothPhase(r0, waveCm) {                                      // 자리에 따라 부드럽게 바뀌는 위상(파장 phaseWaveCm · 주면 그 값)
    var cpu = (typeof CURL_BUNDLE !== 'undefined' && CURL_BUNDLE.cmPerUnit) || 19.33, k = 2 * Math.PI / ((waveCm > 0 ? waveCm : PC.phaseWaveCm) / cpu);
    return Math.PI * (Math.sin(r0.x * k + 1.3) + Math.sin(r0.y * k * 0.83 + 2.1) + Math.sin(r0.z * k * 1.17 + 0.4)) + (PC.gaborAsIs ? PC.phaseJitAsIs : PC.phaseJit) * (hash3(r0.x * 91, r0.y * 37, r0.z * 53) - 0.5);
  }
  /* (2026-10-12i) 선 하나하나 그대로 — 사용자: "정보를 중앙값만 갖고 오지 말고 다 가져와 · 머리가 밧줄처럼 일자 · 굴곡지면서 퍼져야"
   *  가닥마다: 뿌리 방위로 그 자리를 마주 본 사진을 고르고(앞·뒤·옆) · 가닥을 위→아래 5칸으로 나눠 칸마다 그 사진의 같은 높이에서 그은 선 하나를 뽑음(가닥마다 다른 선)
   *    → 파장·진폭이 가닥마다·높이마다 사진대로 다름(곧은 선을 뽑은 칸은 굴곡 0 · 뿌리 쪽이 곧고 끝으로 갈수록 크게 출렁이는 모양이 사진에서 그대로)
   *  물결 면을 가닥(뿌리 자리)마다 돌림: 옆으로만 흔들리던 것(밧줄) → 옆·바깥 사이 어느 면 → 머리가 바깥으로 퍼짐
   *  끄기 PHOTO_CURL.gaborAll=false 후 PHOTO_CURL.refresh() */
  PC.ptsPerWave = 8; PC.maxPts = 120;   // (2026-10-12n) 한 번 굽는 길이에 찍는 점 수(24 → 12) · 가닥당 점 상한 — 긴 웨이브 3만 가닥에서 점이 150개씩이라 3D 완성본 만드는 데 10초
  PC.lockDiaAsIs = 1.0; PC.lockMinCmAsIs = 0.8;   // (2026-10-12m) 사진: 덜 뭉친 타래로 고리 — 같은 위상으로 도는 자리 크기 = 컬 지름 × 이 값(작을수록 타래가 가늘고 많아짐)
  PC.gaborAll = true; PC.gaborBins = 5; PC.gaborBinTol = [0.12, 0.25];
  function viewForRoot(r) {
    var CY0 = 0; try { CY0 = (G && G.model && G.model.CY) || (state._hair3Dneutral && state._hair3Dneutral.CY) || 0; } catch (e) {}
    var az = Math.atan2(r.x, r.z) * 180 / Math.PI, a = Math.abs(az);
    return a < 45 ? 'front' : a > 135 ? 'back' : (az > 0 ? 'left' : 'right');
  }
  function profileFor(r0, SH) {
    var bv = SH.gab.byView, v = viewForRoot(r0), Ls = bv[v] || bv.front || bv.back || bv.left || bv.right; if (!Ls || !Ls.length) return null;
    var nb = PC.gaborBins, A = [], L = [], b, lamMed = SH.gab.lamCm > 0 ? SH.gab.lamCm : SH.L;
    for (b = 0; b < nb; b++) {
      var fc = (b + 0.5) / nb, pick = null, k, t, cand;
      for (t = 0; t < PC.gaborBinTol.length && !pick; t++) {
        cand = Ls.filter(function (l) { return Math.abs(l[0] - fc) < PC.gaborBinTol[t]; });
        if (cand.length >= 3) pick = cand;
      }
      if (!pick) pick = Ls;
      k = Math.floor(hash3(r0.x * 53 + b * 7.1, r0.y * 17 + b, r0.z * 29) * pick.length) % pick.length;
      var l = pick[k];
      if (l[5] || !(l[3] > 0)) { A.push(0); L.push(lamMed); }
      else { A.push(l[3]); L.push(l[2] > 1 ? l[2] : lamMed); }
    }
    return { A: A, L: L, view: v };
  }
  function shapeStrand(g, SH) {
    if (PC.gaborAll && SH.gab) { var rA = shapeStrandAll(g, SH); if (rA) return rA; }
    var cpu = (typeof CURL_BUNDLE !== 'undefined' && CURL_BUNDLE.cmPerUnit) || 19.33, Au = SH.A / cpu, Lu = SH.L / cpu, ru = PC.shapeRootCm / cpu;
    var CY0 = 0; try { CY0 = (G && G.model && G.model.CY) || (state._hair3Dneutral && state._hair3Dneutral.CY) || 0; } catch (e) {}
    var S = [0], i; for (i = 1; i < g.length; i++) S.push(S[i - 1] + Math.hypot(g[i].x - g[i - 1].x, g[i].y - g[i - 1].y, g[i].z - g[i - 1].z));
    var Lt = S[S.length - 1]; if (!(Lt > 1e-6)) return g;
    var ph = smoothPhase(g[0]), ds = Math.min(Lu / 24, Lt / 6), m = Math.max(3, Math.ceil(Lt / ds) + 1), out = [], j = 0;
    var RW = readField(SH, cpu), fo = RW ? { x: 0, y: 0, z: 0, a: 0, k: 0 } : null, fill, rx, ry, rz;
    for (i = 0; i < m; i++) {
      var s = Math.min(Lt, i * ds); while (j < g.length - 2 && S[j + 1] < s) j++;
      var u = (s - S[j]) / Math.max(1e-12, S[j + 1] - S[j]), a = g[j], b = g[j + 1];
      var px = a.x + (b.x - a.x) * u, py = a.y + (b.y - a.y) * u, pz = a.z + (b.z - a.z) * u;
      var tx = b.x - a.x, ty = b.y - a.y, tz = b.z - a.z, tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
      var ox = px, oy = py - CY0, oz = pz, od = ox * tx + oy * ty + oz * tz; ox -= od * tx; oy -= od * ty; oz -= od * tz;   // 바깥 방향(축에 수직으로)
      var ol = Math.hypot(ox, oy, oz) || 1; ox /= ol; oy /= ol; oz /= ol;
      var bx = ty * oz - tz * oy, by = tz * ox - tx * oz, bz = tx * oy - ty * ox, bl = Math.hypot(bx, by, bz) || 1; bx /= bl; by /= bl; bz /= bl;
      var wr = rootW(s, cpu);
      var t = 2 * Math.PI * s / Lu + ph, c1 = Au * wr * Math.cos(t), c2 = Au * wr * SH.depth * Math.sin(t);
      fill = 1; rx = ry = rz = 0;
      if (RW) {
        RW.wf.at(px, py, pz, fo); rx = RW.gain * wr * fo.x; ry = RW.gain * wr * fo.y; rz = RW.gain * wr * fo.z;
        if (PC.readFill) fill = Math.max(0, Math.min(1, 1 - RW.gain * fo.a / Math.max(1e-9, RW.lineU)));
        mqS.readPts++; mqS.readFillSum += fill; if (fo.k > 0.5) mqS.readKnown++;
      }
      out.push({ x: px + rx + fill * (bx * c1 + ox * c2), y: py + ry + fill * (by * c1 + oy * c2), z: pz + rz + fill * (bz * c1 + oz * c2) });
    }
    return out;
  }
  /* (2026-10-12q) 컬 타래 — 사용자: "컬이 철사가 됐어. 가닥끼리 모여서 타래가 되면 좋을텐데"
   *  컬(나선 쪽 lockW 이상)이면 뿌리를 "컬 지름 × lockDiaAsIs" 칸으로 묶어 한 칸 = 한 타래: 같은 사진 선(파장·진폭) · 같은 위상 · 같은 감는 면으로 감음(가닥마다 위상만 lockJit 조금).
   *  68번이 같은 칸의 가닥들을 그 칸 대표 길(본보기 하나)로 모음 → 축이 나란해서 같이 감겨 타래가 됨. 끄기 PHOTO_CURL.lockMode=false */
  /* (2026-10-12s) 타래 = 사진에서 읽은 타래 조각(42번 clumpsFor) — 사용자: "묶도록 짜는 게 아니고, 결을 읽을 때 그렇게 읽어야" · 격자 칸(12q)은 뺌
   *  68번이 기른 가닥마다 그 가닥이 지나간 사진 조각(clumpOfPath · 10/10m과 같은 투표)을 붙여 두고, 옮겨심을 때 넘겨줌(LK).
   *  같은 조각 = 같은 사진 선 · 같은 위상 · 같은 감는 면 · 컬 크기 = 그 조각에서 잰 반경 · 조각에 안 걸린 가닥은 제 뿌리 그대로(묶지 않음). 끄기 PHOTO_CURL.lockMode=false */
  PC.lockMode = true; PC.lockW = 0.6; PC.lockJit = 0.35; PC.lockRFromClump = true;
  var ckPhoto = null;
  PC.clumpOfPath = function (p) {
    try {
      if (!p || p.length < 4) return null;
      var ph = state._hair3Dneutral; if (ckPhoto !== ph) { prepClumps(); ckPhoto = ph; }
      if (!CK) return null;
      var k = clumpKey(p); if (!k) return null;
      var o = { key: k, rCm: clumpRcm(k) };
      if (lastHit) { var R = CK.views[lastHit.v].c.R; o.frac = lastHit.fr; o.dir = [R[6], R[7], R[8]]; }   // (2026-10-12u) 조각을 본 사진 · 그 가닥이 조각을 지난 자리 — 그 자리에서 고리가 그 사진 쪽으로 드러나 있었음(조각 = 앞으로 드러난 반 바퀴)
      return o;
    } catch (e) { return null; }
  };
  PC.lockOn = function () { try { var SH = blendShape(origSpec() || {}); return !!(PC.lockMode && SH && SH.w >= PC.lockW); } catch (e) { return false; } };
  /* (2026-10-12w) 자리 그대로 옮기기 — 사용자: "모양은 살았는데, 위치가 같진 않네"
   *  원본 머리를 그릴 때 가닥마다 실제로 쓴 값(높이 5칸의 크기·한 번 길이 · 뿌리에서의 위상 · 감는 면)을 두피 칸(두피 타원의 위도 NP × 경도 NT · 48×24)마다 모아 둠.
   *  스타일에 실어(exportShape · cells) 받는 손님은 뿌리의 두피 칸 값을 그대로 씀 → 같은 자리에서 같은 쪽으로 굽음. 칸 안 가닥끼리 위상이 흩어진 정도(원 평균 길이 R)도 읽어 그만큼만 흩음.
   *  칸에 값이 없으면 예전(선 묶음에서 고름) · 끄기 PHOTO_CURL.cellMode=false */
  PC.cellMode = true; PC.cellNT = 48; PC.cellNP = 24;   // 칸 ≈ 1.2cm(두피 둘레 기준)
  var CELLREC = { photo: null, m: new Map() };
  function scalpCell(r0, CYc) {
    try {
      var E = getScalpEllipsoid(); if (!E || !(E.a > 0)) return -1;
      var cy = Math.max(-1, Math.min(1, (r0.y - CYc) / E.b)), ph = Math.acos(cy), th = Math.atan2(r0.x / E.a, r0.z / E.c);
      var r = Math.max(0, Math.min(PC.cellNP - 1, Math.floor(ph / Math.PI * PC.cellNP))), c = Math.floor((th + Math.PI) / (2 * Math.PI) * PC.cellNT); c = ((c % PC.cellNT) + PC.cellNT) % PC.cellNT;
      return r * PC.cellNT + c;
    } catch (e) { return -1; }
  }
  function recordCell(ci, PF, t0, phi) {
    if (ci < 0) return;
    var ph = state._hair3Dneutral; if (CELLREC.photo !== ph) { CELLREC.photo = ph; CELLREC.m = new Map(); }
    var c = CELLREC.m.get(ci); if (!c) { c = { n: 0, A: [0, 0, 0, 0, 0], L: [0, 0, 0, 0, 0], tc: 0, ts: 0, pc: 0, ps: 0 }; CELLREC.m.set(ci, c); }
    var b; for (b = 0; b < 5 && b < PF.A.length; b++) { c.A[b] += PF.A[b]; c.L[b] += PF.L[b]; }
    c.tc += Math.cos(t0); c.ts += Math.sin(t0); c.pc += Math.cos(2 * phi); c.ps += Math.sin(2 * phi); c.n++;
  }
  function cellsExport() {
    var out = []; if (CELLREC.photo !== state._hair3Dneutral) return out;
    CELLREC.m.forEach(function (c, ci) {
      if (c.n < 1) return; var n = c.n, R = Math.hypot(c.tc, c.ts) / n, r3 = function (x) { return Math.round(x * 1000) / 1000; };
      out.push([ci].concat(c.A.map(function (x) { return r3(x / n); }), c.L.map(function (x) { return r3(x / n); }), [r3(Math.atan2(c.ts, c.tc)), r3(R), r3(0.5 * Math.atan2(c.ps, c.pc)), n]));
    });
    return out;
  }
  PC.cellsExport = cellsExport;
  function shapeStrandAll(g, SH, LKin, OV) {
    var LK = (LKin && PC.lockMode && SH.w >= PC.lockW) ? LKin : null, rP = LK ? { x: (LK.key % 997) * 0.0131, y: Math.floor(LK.key / 997) * 0.0173, z: (LK.key % 31) * 0.0217 } : g[0];
    var cpu = (typeof CURL_BUNDLE !== 'undefined' && CURL_BUNDLE.cmPerUnit) || 19.33, PF = OV ? { A: OV.A.slice(), L: OV.L.slice(), view: 'cell' } : profileFor(rP, SH); if (!PF) return null;
    var CY0 = 0; try { CY0 = (G && G.model && G.model.CY) || (state._hair3Dneutral && state._hair3Dneutral.CY) || 0; } catch (e) {}
    var S = [0], i; for (i = 1; i < g.length; i++) S.push(S[i - 1] + Math.hypot(g[i].x - g[i - 1].x, g[i].y - g[i - 1].y, g[i].z - g[i - 1].z));
    var Lt = S[S.length - 1]; if (!(Lt > 1e-6)) return g;
    var nb = PF.A.length, w = SH.w, useH = PC.gaborPitchFromHelix && SH.pH > 0, Lmin = 1e9, b;
    if (!OV && LK && PC.lockRFromClump && LK.rCm > 0) for (b = 0; b < nb; b++) if (PF.A[b] > 0) PF.A[b] = LK.rCm;   // 그 조각에서 잰 컬 반경
    if (OV) useH = false;
    for (b = 0; b < nb; b++) { PF.L[b] = useH ? (1 - w) * PF.L[b] + w * SH.pH : PF.L[b]; if (PF.L[b] < Lmin) Lmin = PF.L[b]; }
    var r0 = g[0], phi = OV ? OV.phi : 2 * Math.PI * hash3(rP.x * 13.7, rP.y * 71.3, rP.z * 37.9), cf = Math.cos(phi), sf = Math.sin(phi);
    var Am = 0, An = 0; for (b = 0; b < nb; b++) if (PF.A[b] > 0) { Am += PF.A[b]; An++; } Am = An ? Am / An : SH.A;
    var lockCm = Math.max(PC.lockMinCmAsIs, PC.lockDiaAsIs * 2 * Am);   // (2026-10-12m) 한 타래 크기 = 컬 지름 × lockDiaAsIs — 예전 7cm 칸이 통째로 같은 위상이라 한 고리에 가닥이 너무 많았음
    var t = OV ? OV.t0 : LK ? 2 * Math.PI * hash3(rP.x * 41.3, rP.y * 17.9, rP.z * 63.1) + PC.lockJit * (hash3(r0.x * 91, r0.y * 37, r0.z * 53) - 0.5) : smoothPhase(r0, lockCm), ds = Math.max(Math.min(Lmin / cpu / PC.ptsPerWave, Lt / 6), Lt / PC.maxPts), m = Math.max(3, Math.ceil(Lt / ds) + 1), out = [], j = 0, sPrev = 0;
    var PP = [], E1 = [], E2 = [], TT = [], AU = [], SS = [];
    for (i = 0; i < m; i++) {
      var s = Math.min(Lt, i * ds); while (j < g.length - 2 && S[j + 1] < s) j++;
      var u = (s - S[j]) / Math.max(1e-12, S[j + 1] - S[j]), a = g[j], bb = g[j + 1];
      var px = a.x + (bb.x - a.x) * u, py = a.y + (bb.y - a.y) * u, pz = a.z + (bb.z - a.z) * u;
      var tx = bb.x - a.x, ty = bb.y - a.y, tz = bb.z - a.z, tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
      var ox = px, oy = py - CY0, oz = pz, od = ox * tx + oy * ty + oz * tz; ox -= od * tx; oy -= od * ty; oz -= od * tz;
      var ol = Math.hypot(ox, oy, oz) || 1; ox /= ol; oy /= ol; oz /= ol;
      var bx = ty * oz - tz * oy, by = tz * ox - tx * oz, bz = tx * oy - ty * ox, bl = Math.hypot(bx, by, bz) || 1; bx /= bl; by /= bl; bz /= bl;
      E1.push([cf * bx + sf * ox, cf * by + sf * oy, cf * bz + sf * oz]); E2.push([-sf * bx + cf * ox, -sf * by + cf * oy, -sf * bz + cf * oz]);
      var f = s / Lt * nb - 0.5, b0 = Math.max(0, Math.min(nb - 1, Math.floor(f))), b1 = Math.min(nb - 1, b0 + 1), q = Math.max(0, Math.min(1, f - b0)); q = q * q * (3 - 2 * q);
      var Acm = PF.A[b0] + (PF.A[b1] - PF.A[b0]) * q, Lcm = PF.L[b0] + (PF.L[b1] - PF.L[b0]) * q;
      t += 2 * Math.PI * (s - sPrev) * cpu / Math.max(0.3, Lcm); sPrev = s;   // 파장이 칸마다 달라도 위상이 끊기지 않게 쌓아 감
      PP.push(px, py, pz); TT.push(t); AU.push(Acm / cpu * rootW(s, cpu)); SS.push(s);
    }
    var dT = 0; if (OV) LK = null;                                                           // (2026-10-12u) 읽은 위상 — 가닥이 사진 조각을 지난 자리에서 고리가 그 사진 쪽(카메라 쪽)으로 드러나도록 위상을 맞춤
    if (LK && LK.dir && LK.frac != null && PC.readPhase !== false) {       //   가닥마다 제 길·제 자리에서 맞추므로 같은 조각이라도 위상이 조금씩 다름(한 점으로 겹치지 않음) · 끄기 PHOTO_CURL.readPhase=false
      var sc = LK.frac * Lt, ic = 0; while (ic < SS.length - 1 && SS[ic] < sc) ic++;
      var d = LK.dir, a1 = d[0] * E1[ic][0] + d[1] * E1[ic][1] + d[2] * E1[ic][2], a2 = d[0] * E2[ic][0] + d[1] * E2[ic][1] + d[2] * E2[ic][2];
      if (Math.abs(a1) + Math.abs(a2) > 1e-3) { dT = Math.atan2(a1, a2 / Math.max(0.2, w)) - TT[ic]; mqS.readPh = (mqS.readPh || 0) + 1; }
    }
    for (i = 0; i < TT.length; i++) {
      var c1 = AU[i] * Math.sin(TT[i] + dT), c2 = AU[i] * w * Math.cos(TT[i] + dT);
      out.push({ x: PP[3 * i] + E1[i][0] * c1 + E2[i][0] * c2, y: PP[3 * i + 1] + E1[i][1] * c1 + E2[i][1] * c2, z: PP[3 * i + 2] + E1[i][2] * c1 + E2[i][2] * c2 });
    }
    if (SH.rec) recordCell(scalpCell(g[0], CY0), PF, (TT.length ? TT[0] : 0) + dT, phi);   // (2026-10-12w) 원본에서 쓴 값을 두피 칸에 모음
    mqS.allN = (mqS.allN || 0) + 1; mqS.allV = mqS.allV || {}; mqS.allV[PF.view] = (mqS.allV[PF.view] || 0) + 1;
    return out;
  }
  PC.blendShape = blendShape; PC._shapeStrand = shapeStrand;
  /* (2026-10-12v) 굴곡을 스타일에 싣기 — 사용자: "적용받는 곳도 (그 손님 머리를) 다시 기르기 한 다음에 얹는 게 아니고, 편 다음에 얹어야"
   *  원본 머리(68번)를 보며 스타일을 등록하면 이 손님 사진에서 읽은 굴곡(방향 필터 선 · 나선 쪽 · 한 바퀴 · 크기)을 spec.readShape로 실음(59번).
   *  다른 손님에게 걸면: 그 손님의 뿌리 자리 + 스타일 결 표로 만든 길(59번 · 굴곡 없는 흐름) 위에 이 값으로 굴곡을 얹고(68번이 부름), 컬 엔진은 안 돌림(겹치지 않게).
   *  받는 손님 사진의 굴곡은 쓰지 않음 · 타래 위상은 사진이 없으니 자리에 따라 부드럽게(타래 크기 = 컬 지름) · 끄기 PHOTO_CURL.rsApply=false */
  PC.rsApply = true; PC.rsMaxLines = 200;
  PC.exportShape = function () {
    try {
      if (!shapeAllowed()) return null;   // (2026-10-13a) 직모 원본에서 등록한 스타일에는 굴곡을 안 실음
      var SH = blendShape(origSpec() || {}); if (!SH || !SH.gab || !SH.gab.byView) return null;
      var bv = {}, k; for (k in SH.gab.byView) {
        var L = SH.gab.byView[k], st = Math.max(1, Math.ceil(L.length / PC.rsMaxLines)), o = [], i;
        for (i = 0; i < L.length; i += st) o.push(L[i].map(function (x) { return isFinite(x) ? Math.round(x * 1000) / 1000 : 0; }));
        bv[k] = o;
      }
      return { v: 1, A: +SH.A.toFixed(3), L: +SH.L.toFixed(3), w: +SH.w.toFixed(3), pH: SH.pH > 0 ? +SH.pH.toFixed(3) : 0,
        cells: PC.cellMode ? cellsExport() : [], cellNT: PC.cellNT, cellNP: PC.cellNP,
        gab: { lamCm: +(+SH.gab.lamCm).toFixed(3), ampCm: +(+SH.gab.ampCm).toFixed(3), loop: +(+SH.gab.loop).toFixed(3), nAll: SH.gab.nAll, byView: bv } };
    } catch (e) { return null; }
  };
  function rsSpec() {
    try { if (!PC.rsApply || origSpec()) return null; var id = state.specAppliedId; if (!id || typeof getStyleSpec !== 'function') return null; var sp = getStyleSpec(id); return (sp && sp.readShape && sp.readShape.gab) ? sp.readShape : null; } catch (e) { return null; }
  }
  PC.activeRS = rsSpec;
  PC.applyShapeRS = function (g, rs) {
    if (!PC.on || !g || g.length < 2 || !rs) return g;
    var SH = { A: rs.A, L: rs.L, w: rs.w, depth: rs.w, pH: rs.pH, gab: rs.gab }, OV = null;
    mqS.rs = (mqS.rs || 0) + 1;
    if (PC.cellMode && rs.cells && rs.cells.length && rs.cellNT === PC.cellNT && rs.cellNP === PC.cellNP) {
      if (rs._cm !== rs.cells) { rs._cmap = new Map(); rs.cells.forEach(function (c) { rs._cmap.set(c[0], c); }); rs._cm = rs.cells; }
      var CYt = 0; try { CYt = (state._hair3Dneutral && state._hair3Dneutral.CY) || (G && G.model && G.model.CY) || 0; } catch (e) {}
      var c = rs._cmap.get(scalpCell(g[0], CYt));
      if (c) {
        var R = Math.max(1e-3, Math.min(1, c[12])), sd = Math.sqrt(-2 * Math.log(R)), r0 = g[0];   // 칸 안 가닥끼리 흩어진 정도(원본에서 읽은 값)만큼 위상을 흩음
        OV = { A: c.slice(1, 6), L: c.slice(6, 11), t0: c[11] + sd * 1.7 * (hash3(r0.x * 91, r0.y * 37, r0.z * 53) - 0.5) * 2, phi: c[13] };
        mqS.rsCell = (mqS.rsCell || 0) + 1;
      }
    }
    return shapeStrandAll(g, SH, null, OV) || g;
  };
  /* (2026-10-13a) 직모에는 굴곡을 안 얹음 — 사용자: "폰에서 찍은 건 직모 여자인데, 컬이 얹힌 거야"
   *  예전: applyShape가 잰 컬과 상관없이 사진 방향 필터 선(66번)의 진폭을 얹음 → 직모 사진도 선마다 잔 흔들림(빛·잔머리)이 있어 0.5~1cm 굴곡이 생김.
   *  지금: 원본 스펙의 잰 컬(perm.curl)이 shapeMinCurl 미만이면 얹지 않고 스타일에도 안 실음. 끄기 PHOTO_CURL.shapeMinCurl=0 */
  PC.shapeMinCurl = 10;
  function measuredCurl() { try { var sp = W.ORIG_MQ && W.ORIG_MQ.spec, pm = sp && sp.perm; return (pm && typeof pm.curl === 'number') ? pm.curl : null; } catch (e) { return null; } }
  function shapeAllowed() { var c = measuredCurl(); if (c == null || !(PC.shapeMinCurl > 0)) return true; if (c < PC.shapeMinCurl) { mqS.straightSkip = (mqS.straightSkip || 0) + 1; return false; } return true; }
  PC.shapeAllowed = shapeAllowed;
  PC.applyShape = function (g, lk) {                                     // (2026-10-12j) 68번이 옮겨심은 축에 사진 선 굴곡을 얹음 · lk = 그 가닥의 사진 타래 조각
    if (!PC.on || !PC.gaborAll || !g || g.length < 2) return g;
    if (!shapeAllowed()) return g;
    var SH = blendShape(origSpec() || {}); if (!SH || !SH.gab) return g;
    if (PC.cellMode) SH = Object.assign({}, SH, { rec: true });
    var res = shapeStrandAll(g, SH, lk) || g;
    return (res !== g && PC.shapePushIn) ? pushIn(res, g) : res;   // (2026-10-13a) 굴곡이 3D 머리 덩어리 밖(목·옆 공중)으로 부푼 점은 축 쪽으로 당김
  };
  PC.shapePushIn = true;
  /* (2026-10-11c) ① 감은 컬이 좁은 덩어리(42번 여유 둔 교집합) 밖으로 부푼 점은 축 쪽으로 당겨 넣음 — 자르지 않음 */
  PC.mqPushIn = true; mqS.pushed = 0;
  function pushIn(res, axis) {
    var VT = G && G.volT; if (!PC.mqPushIn || !VT || !res || !axis || axis.length < 2) return res;
    var n = res.length, m = axis.length, i, k;
    for (i = 1; i < n; i++) {
      var p = res[i]; if (VT.at(p) !== 0) continue;
      var a = axis[Math.min(m - 1, Math.round(i / Math.max(1, n - 1) * (m - 1)))]; if (VT.at(a) === 0) continue;
      var lo = 0, hi = 1; for (k = 0; k < 6; k++) { var t = (lo + hi) / 2, q = { x: a.x + (p.x - a.x) * t, y: a.y + (p.y - a.y) * t, z: a.z + (p.z - a.z) * t }; if (VT.at(q) === 0) hi = t; else lo = t; }
      res[i] = { x: a.x + (p.x - a.x) * lo, y: a.y + (p.y - a.y) * lo, z: a.z + (p.z - a.z) * lo }; mqS.pushed++;
    }
    return res;
  }
  function mqCurl(g, C) {
    var pm = origSpec(); if (!pm || !(C > 0) || typeof CURL_BUNDLE === 'undefined') return null;   // 원본 머리(마네킹)일 때만 — 마네킹 스타일에는 사진 결을 안 얹음
    var CB = CURL_BUNDLE, o = {}, sv = {}, k, args = Array.prototype.slice.call(arguments);
    // (2026-10-11d) 컬의 축은 3D 머리 덩어리(42번) 안에서 끝 — 축이 덩어리를 빠져나가면(두 점 연속) 거기까지(사진에서 잰 길이 · 얼굴 앞으로 내려오던 앞머리 축)
    var VC = (G && (G.volT || G.vol)) || null;   // (2026-10-11d) 축은 좁은 덩어리(여유 둔 교집합)에서 끊음 — 넓은 덩어리(다수결)로는 이마 앞 공중·옆머리 틈으로 나간 축(더듬이)이 안 끊겼음
    if (PC.mqVolCut && VC && g && g.length > 3) {
      var cpu = CB.cmPerUnit || 19.33, acc = 0, outRun = 0, cutAt = -1, j3;
      for (j3 = 1; j3 < g.length; j3++) {
        acc += Math.hypot(g[j3].x - g[j3 - 1].x, g[j3].y - g[j3 - 1].y, g[j3].z - g[j3 - 1].z);
        if (acc * cpu < PC.mqVolKeepCm) continue;
        if (VC.at(g[j3]) === 0) { if (++outRun >= 2) { cutAt = j3 - 1; break; } } else outRun = 0;
      }
      if (cutAt > 1) { args[0] = g.slice(0, cutAt); mqS.cut = (mqS.cut || 0) + 1; }
    }
    var axis0 = args[0];
    if (PC.shapeMode) {                                                   // (2026-10-11d) 기준선 없이 — 사진 선 모양과 나선 측정을 섞은 한 식
      var SH = blendShape(pm);
      if (SH) { mqS.shaped = (mqS.shaped || 0) + 1; return pushIn(shapeStrand(axis0, SH), axis0); }
    }
    if (PC.waveMode) { var WS = waveShape(); if (WS && WS.isWave) { mqS.wave = (mqS.wave || 0) + 1; return pushIn(waveStrand(axis0, WS.ampCm, WS.lamCm), axis0); } }
    var M = mqSolve(C, pm.rCm * PC.radiusK, pm.pitchCm > 0 ? pm.pitchCm : null);
    for (k in PC.look) o[k] = PC.look[k]; o.windCm = PC.mqWind; o.rootLeaveCm = PC.mqRootLeave; o.pitchThick = M.pt;
    args[2] = M.wave / 100;
    if (PC.mqStretch && M.remain < 0.999 && typeof lengthStrand3D === 'function') { try { args[0] = lengthStrand3D(args[0], 1 / M.remain); } catch (e) {} }
    var ks = M.ks || 1, r0 = args[0] && args[0][0];
    function sc(pts, f) { var o2 = new Array(pts.length), j, q; for (j = 0; j < pts.length; j++) { q = pts[j]; o2[j] = { x: r0.x + (q.x - r0.x) * f, y: r0.y + (q.y - r0.y) * f, z: r0.z + (q.z - r0.z) * f }; } return o2; }
    if (ks > 1 && r0) args[0] = sc(args[0], 1 / ks);
    for (k in o) { sv[k] = CB[k]; CB[k] = o[k]; }
    mqS.calls++;
    try { var res = innerCurl.apply(this, args); res = (ks > 1 && r0 && res && res.length) ? sc(res, ks) : res; return pushIn(res, axis0); } finally { for (k in sv) CB[k] = sv[k]; }
  }
  PC.PASS = {};   // _curlStage가 "원래 본문 그대로"라고 알릴 때
  {
    /* curlStrand3D(14) 맨 앞에서 부름 */
    PC._curlStage = function () {
      if (rsSpec()) { mqS.rsNoCurl = (mqS.rsNoCurl || 0) + 1; return arguments[0]; }   // (2026-10-12v) 스타일에 실린 굴곡을 얹을 것이라 컬 엔진은 안 돌림
      if (PC.mq && !lookActive()) { var mr = mqCurl.apply(this, arguments); if (mr) return mr; }
      if (!lookActive()) return PC.PASS;
      if (PC.shapeMode && gaborOK() && arguments[0] && arguments[0].length > 1) {   // (2026-10-12f) 다시 기른 머리도 방향 필터 값 그대로
        var SHg = blendShape(origSpec()); if (SHg) { S.gabor = (S.gabor || 0) + 1; return pushIn(shapeStrand(arguments[0], SHg), arguments[0]); }
      }
      var CB = CURL_BUNDLE, L = PC.look, sv = {}, k;
      if (PC.clumpSize && curS && lockMemo.rOf && lockMemo.rOf.has(curS) && arguments.length >= 3 && S.rCm > 0) {   // 조각마다 잰 크기로 웨이브(컬 굵기)
        var rg0 = S.rCm * PC.radiusK, rc0 = Math.max(rg0 * PC.clumpRMin, Math.min(rg0 * PC.clumpRMax, lockMemo.rOf.get(curS)));
        var args = Array.prototype.slice.call(arguments); args[2] = PC.waveFor(rc0, args[1] || 75) / 100; S.sized = (S.sized || 0) + 1;
        for (k in L) { sv[k] = CB[k]; CB[k] = L[k]; } S.calls++;
        try { return innerCurl.apply(this, args); } finally { for (k in sv) CB[k] = sv[k]; }
      }
      for (k in L) { sv[k] = CB[k]; CB[k] = L[k]; }
      S.calls++;
      try { return innerCurl.apply(this, arguments); } finally { for (k in sv) CB[k] = sv[k]; }
    };
  }
  // 서명 — 모양이 걸렸는지가 바뀌면 미리 만든 헤어도 다시
  PC._sigTail = function () {   // adjFilterSig(17b) 끝
    var s = '';
    try { var a = lookActive(), om = origSpec(); if (om) s += '|pmq' + [om.curl, om.rCm, om.pitchCm, PC.mqWind, PC.mqRootLeave, PC.mqStretch, PC.gaborAsIs ? 'g' + PC.rootStraightCm + ':' + PC.shapeRootCm + ':' + PC.phaseJitAsIs + ':2' + (PC.gaborPitchFromHelix ? 'h' : '') + (PC.gaborAll ? 'a' + PC.gaborBins + ':' + PC.lockDiaAsIs + (PC.lockMode ? 'L' + PC.lockW + ':' + PC.lockJit + (PC.readPhase !== false ? 'p' : '') : '') : '') : 0, 'sm' + PC.shapeMinCurl + (PC.shapePushIn ? 'p' : '') + ':' + measuredCurl(), PC.readWave ? 'rw' + PC.readGainMax + (PC.readFill ? 'f' : '') + ((G && G.waveField && G.waveField()) ? 1 : 0) : 0].join(','); return s + '|pcl' + (a ? [PC.look.pitchThick, PC.look.clumpPull, PC.look.phaseJitter, PC.look.microAmp].join(',') + (PC.lock ? 'L' + lver + ':' + lockSig() : '') : 0); } catch (e) { return s; }
  };

  PC.lines = function () {
    var a = lookActive(), L = [];
    L.push(TAG + ' ' + (PC.on ? '켜짐' : '꺼짐') +
      ' · 컬 굵기: ' + (!PC.radius ? '안 맞춤(PHOTO_CURL.radius=false)' : (S.wave != null ? '사진 반경 ' + (+S.rCm).toFixed(1) + 'cm' + (PC.radiusK !== 1 ? ' ×' + PC.radiusK : '') + ' · 컬 ' + S.curl + ' → 웨이브 ' + S.wave + '(예전 ' + S.was + ')' :
        (S.curl != null ? (S.rCm > 0 ? '사진 반경 ' + (+S.rCm).toFixed(1) + 'cm — ' : '') + (S.why || '안 맞춤') : '아직 안 잼'))) +
      ' · 뭉침 모양: ' + (!PC.clump ? '꺼짐' : (a ? '걸림(한 바퀴 간격 ' + PC.look.pitchThick + ' · 다발로 당김 ' + PC.look.clumpPull + ' · 감기는 자리 흩기 ' + PC.look.phaseJitter + ' · 잔떨림 ' + PC.look.microAmp + ')' :
        '안 걸림(다시 기른 머리 화면이 아니거나 사진 컬이 ' + PC.lookMinCurl + ' 미만)')) +
      ' · 타래 뼈대: ' + (!PC.lock ? '꺼짐' : (a && lockMemo.map ? '타래 ' + lockMemo.locks + '개(뿌리 자리 ' + (+lockMemo.cm).toFixed(1) + (lockMemo.cmHi > lockMemo.cm + 0.05 ? '~' + (+lockMemo.cmHi).toFixed(1) : '') + 'cm = 컬 지름 ' + (S.rCm > 0 ? (2 * S.rCm * PC.radiusK).toFixed(1) + 'cm' : '못 잼') + ' × ' + PC.lockDia + '직경' + (PC.lockBase ? ' × 펌·베이스 폭' : '') + ' · 타래당 ' + Math.round(lockMemo.per || 0) + '가닥) · 사진 타래 조각으로 묶은 가닥 ' + (lockMemo.clumped || 0) + '(사진 ' + (lockMemo.clumpViews || 0) + '장 · 조각 크기 반경 ' + (lockMemo.rMed ? lockMemo.rP25.toFixed(1) + '/' + lockMemo.rMed.toFixed(1) + '/' + lockMemo.rP75.toFixed(1) + 'cm' : '-') + ' · 조각 크기로 감은 가닥 ' + (S.sized || 0) + ') · 길잡이로 모은 가닥 ' + lockMemo.moved + '/' + lockMemo.n + ' · ' + Math.round(lockMemo.ms) + 'ms' : (a ? '아직 안 만듦' : '안 걸림'))) +
      (S.err ? ' · ⚠ ' + S.err : ''));
    if (mqS.solved) L.push('   ④ 마네킹 위 잰 컬: ' + mqS.solved + ' · 감은 가닥 ' + mqS.calls + ' · 3D 머리 덩어리 밖에서 축을 끝낸 가닥 ' + (mqS.cut || 0) + ' · 좁은 덩어리 밖으로 부푼 점을 당겨 넣음 ' + (mqS.pushed || 0) + ' · 기준선 없이 감은 가닥 ' + (mqS.shaped || 0) + (mqS.shapeTxt ? '(' + mqS.shapeTxt + ')' : '') + ' (끄기 PHOTO_CURL.mqVolCut / mqPushIn / waveMode=false)');
    if (mqS.straightSkip) L.push('   직모라 굴곡 안 얹음: 가닥 ' + mqS.straightSkip + '번(잰 컬 ' + measuredCurl() + ' < ' + PC.shapeMinCurl + ' · 끄기 PHOTO_CURL.shapeMinCurl=0)');
    L.push('   ⑤ 읽은 굴곡 그대로: ' + (!PC.readWave ? '꺼짐(켜기 = 주소 끝에 ?rw=1 · 콘솔 PHOTO_CURL.readWave=true 후 PHOTO_CURL.refresh())' : (mqS.readPts > 0 ? '켜짐 — ' + mqS.readTxt + ' · 얹은 점 ' + mqS.readPts + '(굴곡 장이 아는 자리 ' + Math.round(mqS.readKnown / mqS.readPts * 100) + '%) · 지어낸 굴곡을 남긴 비율 평균 ' + Math.round(mqS.readFillSum / mqS.readPts * 100) + '% (끄기 ?rw=0)' : '켜짐 — 아직 안 걸림(곱슬·웨이브 원본 머리가 아니거나 굴곡 장이 없음)')));
    return L;
  };
  /* 지금 손님에게 다시 걸기(끄고 켠 뒤) — 사진에서 다시 재서 슬라이더에 넣음 */
  PC.refresh = function () {
    lver++;
    try { if (G && G.model && G.model.strands) G.model.strands.forEach(function (s) { if (s && s._fnat) s._fnat = null; }); } catch (e) {}
    try { if (G && G.on && typeof G.applyBaseline === 'function') { if (G.base) G.base = null; G.applyBaseline(); } } catch (e) { S.err = String(e && e.message || e); }
    try { if (typeof ADJ_CACHE !== 'undefined' && ADJ_CACHE.bump) ADJ_CACHE.bump(); } catch (e) {}
    try { if (typeof renderAdjustFrame === 'function') renderAdjustFrame(); } catch (e) {}
  };
  console.log(TAG + ' 설치 — 곱슬 원본 머리의 컬 굵기를 사진에서 잰 반경에 맞추고(웨이브), 가닥이 다발로 같이 감기게 합니다(v20261012e · 사진 타래 조각으로 묶기 · 조각마다 크기 · ④ 원본 = 마네킹 + 잰 반경·간격으로 감기). 끄기 PHOTO_CURL.on=false 후 마네킹을 켰다 끄기 · 굵기 보정 PHOTO_CURL.radiusK');
  return PC;
})();

/* ==========================================================================
 * READ_SHAPE (옛 68-read-shape.js) — 원본 머리 = 방향필터(66번)로 읽은 모양 그대로 · 거꾸로 자란 가닥 규칙 · 뿌리 고르게
 *
 * 자리: 17b, PHOTO_CURL 다음. REGROW.build 맨 앞(웨이브 사진은 직모 뼈대 안 씀) · adjustStrandGeom(17b 맨 바깥 단계) READ_SHAPE._adjust / _afterStages · adjFilterSig 꼬리표 · fillUnseenRootCells(13c) 끝 뿌리 고르게 · perfPanelLines(18) 끝 줄
 *
 * 왜 (2026-10-12 · 사용자):
 *   "웨이브는 방향필터를 통해서 다 제대로 읽고 있는데, 그 뒷처리를 해버려서 원래 모양이 다 사라졌어. 방향필터에서 읽은 모양대로 읽도록."
 *   "머리 위 더듬이를 그냥 눌러놨는데, 그거 방향이 반대로 자란 가닥이야. 처리하는 규칙이 있을 텐데 제대로 안 갔고."
 *   "앞이마 쪽은 뿌리가 성글고 그 바로 위쪽은 뿌리가 밀집된 곳이 띠처럼 있어. 대머리이거나 숱이 적은 곳이 아니면 균일하게."
 *   "원래 수준대로 3만 가닥 가까이."
 *
 *   읽은 웨이브가 사라진 경로(10:38 로그 · 웨이브 손님):
 *     ① 42번 직모 뼈대 — 컬 55라서 읽은 길을 한 바퀴(11cm) 창으로 두 번 펴서 축만 남김("편 가닥 15444").
 *     ② 59번 결 표 — 그 축을 다시 칸 평균 방향으로 줄임.
 *     ③ 61번 — 그 위에 사진 값(파장 6.5 · 진폭 0.52cm)으로 "지어낸" 물결을 얹음. 읽은 자리·위상은 하나도 안 남음.
 *   더듬이: 42번이 "아래쪽에 머리가 없고 두께 1.8cm 이상"인 앞머리선 뿌리 264개를 위로 뒤집어 기름(세운 앞머리 규칙).
 *     긴 웨이브는 볼륨 때문에 두께가 3.7cm라 규칙이 걸려, 위로 솟은 가닥이 생겼고 59번은 짧은 막다른 무리만 눌렀음.
 *
 * 무엇을:
 *   A. 웨이브 사진(61번 ② 고리 정도 < 0.33)은 42번 직모 뼈대를 안 씀 — 기른 가닥 = 방향필터를 따라 걸은 길 그대로.
 *      진짜 고리 컬은 예전대로(뼈대 + 컬 엔진).
 *   B. 원본 머리(마네킹 + 잰 값)를 볼 때, 마네킹 뿌리마다 가장 가까운 "기른 가닥"의 길을 그 뿌리로 옮겨 씀(모양 옮겨심기).
 *      결 표·지어낸 물결을 거치지 않음 → 읽은 굴곡·위상·결이 그대로. 슬라이더(길이·넘김·볼륨·가르마·결·윤기)는
 *      59번과 같은 "기준에서 움직인 만큼만"으로 그 위에 걸림 · 컬은 스펙 값보다 올렸을 때만 그만큼 더 감음.
 *   C. 거꾸로 자란 가닥 — 기른 가닥 전체로 1cm 칸마다 "그 자리를 지나는 가닥들이 가는 쪽"(앞뒤 있는 평균)을 내고,
 *      뿌리에서 8cm 동안 그 흐름과 반대로(평균 cos < revCos) 가는 가닥은 거꾸로 자란 것으로 봄 → 본보기에서 뺌.
 *      그 뿌리는 이웃의 바른 가닥 모양을 받음(누르는 게 아니라 결대로 다시 남).
 *      짧게 막힌 가닥(이웃 뿌리 길이 중앙값의 shortK 미만)도 본보기에서 뺌.
 *   D. 뿌리 고르게 — 13b 뿌리 밀도에서, 머리 있는 칸은 전부 보통 밀도(잰 칸 중앙값)로. 보통의 rootLow(0.6) 미만인 칸만 그대로 두고
 *      64번 ③이 작은 덩어리는 채우고 넓고 빈 덩어리(대머리·숱 적은 곳)는 남김. → 앞이마 성긴 줄 · 그 위 밀집 띠가 없어짐.
 *   (가닥 수는 48번 adjustLow/High = 30000 · 42번 measureShare = 1로 같이 고침)
 *
 * (2026-10-12o) 오늘 저녁 정리 — 무엇이 남았고 왜(같은 날 21:05 로그·영상 · 손님 2: 긴 웨이브 · 짧은 곱슬)
 *   · 이 파일(오전 작업)을 2d2c950에서 되돌렸다가 다시 넣음(잔머리 때문인 줄 알고 되돌린 것이 잘못) · 42번 measureShare=1 · 48번 3D 결과 3만
 *   · 축 고르기는 전부 뺌(42번 axisGabor=false · straightCurly=false) — 사용자: "결과를 바꾸기 위한 제한은 최대한 안 함. 읽은 걸 잘해서 결과로 잇는 게 먼저"
 *     컬·웨이브 모두 사진 결을 그대로 걸은 길 → 이 파일이 마네킹 뿌리에 옮겨심음 → 61번이 방향 필터 선(높이별·가닥별) 굴곡을 얹음(shape)
 *   · 느려진 원인 = 가닥당 점 수(기른 길 0.4cm 걸음 = 긴 머리 100점+ · 61번이 또 촘촘히 다시 찍음) — 완성본 3만: 12g 3.9초 → 12m 10.3초
 *     12n(61번 점 줄임 · 조정 화면 1만/2만)에서 4.2초(웨이브) · 3.1초(곱슬) · 12o: 옮겨심은 길 48점 상한(maxPts) · 61번 한 번 굽는 데 8점(가닥당 120 상한)
 *   · 결과(21:05 영상): 웨이브 풍성 · 컬 더 세밀 — 사용자 확인. 남은 것: 웨이브 손님 길이가 사진보다 짧음(어깨 근처에서 끝) · 3D에서 곱슬 부피가 조정 화면보다 작아 보임
 *   · 50번 어깨 처리는 다시 끔(조정 화면 가슴 높이 가로줄 · 쭈글한 띠)
 * 끄기: READ_SHAPE.on=false(B·C) · READ_SHAPE.waveRaw=false(A) · READ_SHAPE.evenRoots=false(D) — 바꾼 뒤 사진을 다시 분석하거나 마네킹을 켰다 끄기
 * ========================================================================== */
var READ_SHAPE = (function () {
  'use strict';
  var W = window, TAG = '[읽은 모양]';
  var RS = Object.assign({
    on: true,            // B·C
    waveRaw: false,      // (2026-10-22) 끔 — 머리 전체 '웨이브 사진' 판정 · 예전 true
    waveRaw_was: true,   // (2026-10-17 배포본) 켬 — 웨이브(S자) 사진이면 읽은 길 그대로 + 출렁임 키우기(__rsWaveGain)
    // was: waveRaw: false,      // A — (2026-10-12j) 끔: 웨이브도 42번 축(방향 필터 파장으로 고른 결)으로 걷고 굴곡은 61번이 얹음. 켜면 예전(읽은 길 그대로)
    evenRoots: false,    // D — (2026-10-22) 끔 — 걷기 안 규칙도 끔(읽기·기르기 강화 단계 · 되돌리기 ?judge=1): 뿌리 고르게 · 예전 true
    rootLow: 0.6,        // D: 보통 밀도의 이 비율 미만 칸은 손대지 않음(대머리·숱 적은 곳 후보 — 64번이 덩어리 크기로 가름)
    vox: 0.05,           // C: 흐름 칸(모델 단위 ≈ 1cm)
    revLen: 0.42,        // C: 뿌리에서 이 길이(≈ 8cm)까지 봄
    revCos: -0.15,       // C: 흐름과의 평균 cos가 이 값 미만이면 거꾸로 자란 가닥
    revMinN: 3,          // C: 칸에 자기 말고 이만큼은 다른 마디가 있어야 비교
    shortK: 0.3,         // C: 이웃 뿌리 가닥 길이 중앙값의 이 비율 미만은 본보기 아님
    rootNbr: 0.06,       // C: 뿌리 이웃 칸(≈ 1.2cm · 둘레 27칸 ≈ 3.5cm 안의 뿌리들이 기준)
    rootCell: 0.04,      // B: 뿌리 찾기 칸(≈ 0.8cm)
    reach: 4,            // B
    maxPts: 48,
    offKeepCm: 0.5, offFadeCm: 3,
    riseCm: 0,         // (2026-10-13h) 뒤·옆 뿌리 가닥이 뿌리보다 이만큼 넘게 올라가면 본보기 아님 · 0 = 끔
    capK: 0,           // (2026-10-13g) 옮겨심은 길 길이 상한 = 마네킹 가닥 길이 × 이 값 · 0 = 끔
    longK: 1e9,          // (2026-10-13g) 이웃 뿌리 길이 중앙값의 이 배를 넘는 가닥은 본보기 아님
    hairlineOn: false,   // (2026-10-14 배포본) 얼굴 앞 가로지르는 본보기 빼기 끔
    hairlineCm: 1.5, hairlineK: 1.5, hairlineFaceFrac: 0.55,   // (2026-10-13f) 얼굴·목 앞을 가로지르는 본보기 빼기
    farCm: 1.5,          // (2026-10-13b) 본보기 뿌리가 이보다 멀면(사진에 머리가 없는 자리) 그리지 않음
    strayOn: true, strayOut: 0.2, strayCos: 0.45, strayCurlMax: 30,   // (2026-10-13b) 엇나간 본보기 빼기   // (2026-10-13a) 본보기와 뿌리가 떨어진 만큼 길 전체를 옮기지 않고 3cm에 걸쳐 0.5cm까지 붙임
    lockPull: 0, lockRootCm: 1.5,   // (2026-10-12u) 0: 대표 길로 당기지 않음 — 한 조각의 가닥이 한 줄로 겹쳐 뭉치가 됐음. 타래는 같은 조각 = 같은 사진 선 + 가닥마다 읽은 위상(61번)으로 · 예전 0.85   // (2026-10-12s) 사진 타래 조각의 대표 길로 당기는 정도(0 = 당기지 않고 위상·크기만 같게) · (2026-10-12q) 컬 타래로 당기는 정도 · 뿌리에서 이 길이에 걸쳐 서서히 — 0 = 안 모음          // (2026-10-12o) 옮겨심은 길의 점 수 상한(웨이브 한 번에 8점쯤) · 0 = 그대로
    shape: false,        // (2026-10-17 배포본) 끔 — 웨이브가 아닐 때만 61번 굴곡을 얹음(아래 '|| !웨이브')
    waveGain: 3, waveSpineCm: 3, waveRootCm: 3, waveGainAuto: true, waveGainCal: 1.75, waveGainMin: 1.5, waveGainMax: 5   // (2026-10-17) 읽은 웨이브 키우기 — 파일 머리의 __rsWaveGain·__rsAutoGain
    // was: shape: true          // (2026-10-12j) 옮겨심은 축에 61번 굴곡(방향 필터 선 그대로)을 얹음 · false = 축만: 이 칸 수까지 넓혀 찾음(넘으면 예전 경로)
  }, W.READ_SHAPE || {});
  var ST = RS.stats = { built: null, used: 0, fell: 0, curlAdd: 0, wave: null, roots: null, err: null };
  var G = REGROW;

  function cpu() { try { return (typeof CURL_BUNDLE !== 'undefined' && CURL_BUNDLE.cmPerUnit) || 19.33; } catch (e) { return 19.33; } }
  function photo() { try { return state._hair3Dneutral || null; } catch (e) { return null; } }
  function model() { try { return (G && G.model && G.src === photo()) ? G.model : null; } catch (e) { return null; } }
  function isOrig() { try { return !!(W.ORIG_MQ && W.ORIG_MQ.on !== false && typeof W.ORIG_MQ.isOriginal === 'function' && W.ORIG_MQ.isOriginal()); } catch (e) { return false; } }

  /* ── A. 웨이브 사진은 직모 뼈대를 안 씀 ─────────────────────────────── */
  function isWavePhoto() {
    try { var ws = W.PHOTO_CURL && typeof W.PHOTO_CURL.waveShape === 'function' ? W.PHOTO_CURL.waveShape() : null; return ws ? { wave: !!ws.isWave, loop: ws.loop } : null; } catch (e) { return null; }
  }
  var straight0 = G.straightCurly;
  RS._beforeRegrowBuild = function () {   // REGROW.build(17b) 맨 앞
    try {
      G.straightCurly = straight0;
      if (RS.waveRaw) { var w = isWavePhoto(); ST.wave = w; if (w && w.wave) G.straightCurly = false; }
    } catch (e) {}
  };

  /* ── C. 본보기 표: 거꾸로 자란 가닥·짧게 막힌 가닥을 빼고 뿌리 칸에 넣음 ── */
  var IDX = null;
  function keyOf(ix, iy, iz) { return ((ix + 512) * 1024 + (iy + 512)) * 1024 + (iz + 512); }
  function buildIndex(m) {
    var t0 = Date.now(), S = m.strands, n = S.length, V = RS.vox, flow = new Map(), i, j;
    // 흐름 칸 — 마디 방향(앞뒤 있음)의 합
    for (i = 0; i < n; i++) {
      var p = S[i] && S[i].pts; if (!p || p.length < 2) continue;
      for (j = 1; j < p.length; j++) {
        var dx = p[j].x - p[j - 1].x, dy = p[j].y - p[j - 1].y, dz = p[j].z - p[j - 1].z, l = Math.sqrt(dx * dx + dy * dy + dz * dz); if (!(l > 1e-9)) continue;
        var k = keyOf(Math.floor(p[j].x / V), Math.floor(p[j].y / V), Math.floor(p[j].z / V)), c = flow.get(k);
        if (!c) { c = [0, 0, 0, 0]; flow.set(k, c); }
        c[0] += dx / l; c[1] += dy / l; c[2] += dz / l; c[3]++;
      }
    }
    // 뿌리 이웃의 처음 방향 — 42번이 위로 뒤집어 기른 가닥(rg.flip 1)은 기준에서 뺌(앞머리선 한 줄이 통째로 뒤집혀도 그 뒤 뿌리들이 기준이 됨)
    var RN = RS.rootNbr, rootDir = new Map(), d0 = new Array(n);
    function dirOf(q) { var qi = Math.min(q.length - 1, 6), x = q[qi].x - q[0].x, y = q[qi].y - q[0].y, z = q[qi].z - q[0].z, l = Math.sqrt(x * x + y * y + z * z); return l > 1e-9 ? [x / l, y / l, z / l] : null; }
    for (i = 0; i < n; i++) {
      var q0 = S[i] && S[i].pts; if (!q0 || q0.length < 2) continue;
      var dd = d0[i] = dirOf(q0); if (!dd || (S[i].rg && S[i].rg.flip === 1)) continue;
      var kr = keyOf(Math.floor(q0[0].x / RN), Math.floor(q0[0].y / RN), Math.floor(q0[0].z / RN)), cr = rootDir.get(kr);
      if (!cr) rootDir.set(kr, cr = [0, 0, 0, 0]); cr[0] += dd[0]; cr[1] += dd[1]; cr[2] += dd[2]; cr[3]++;
    }
    function rootRef(i) {
      var q = S[i].pts[0], cx = Math.floor(q.x / RN), cy = Math.floor(q.y / RN), cz = Math.floor(q.z / RN), s = [0, 0, 0, 0], a, b, c;
      for (a = -1; a <= 1; a++) for (b = -1; b <= 1; b++) for (c = -1; c <= 1; c++) { var e = rootDir.get(keyOf(cx + a, cy + b, cz + c)); if (e) { s[0] += e[0]; s[1] += e[1]; s[2] += e[2]; s[3] += e[3]; } }
      var dd = d0[i]; if (dd && !(S[i].rg && S[i].rg.flip === 1)) { s[0] -= dd[0]; s[1] -= dd[1]; s[2] -= dd[2]; s[3]--; }
      return s;
    }
    var info = new Array(n), rev = 0, revFlip = 0, flipN = 0, shortN = 0, longN = 0, revRoot = 0;
    for (i = 0; i < n; i++) {
      var q = S[i] && S[i].pts; if (!q || q.length < 2) { info[i] = null; continue; }
      var L = 0, sum = 0, cnt = 0;
      for (j = 1; j < q.length; j++) {
        var ex = q[j].x - q[j - 1].x, ey = q[j].y - q[j - 1].y, ez = q[j].z - q[j - 1].z, el = Math.sqrt(ex * ex + ey * ey + ez * ez); if (!(el > 1e-9)) continue;
        L += el;
        if (L <= RS.revLen) {
          var c2 = flow.get(keyOf(Math.floor(q[j].x / V), Math.floor(q[j].y / V), Math.floor(q[j].z / V)));
          if (c2 && c2[3] - 1 >= RS.revMinN) {
            var ux = ex / el, uy = ey / el, uz = ez / el, ox = c2[0] - ux, oy = c2[1] - uy, oz = c2[2] - uz, ol = Math.sqrt(ox * ox + oy * oy + oz * oz);
            if (ol > 0.5) { sum += (ux * ox + uy * oy + uz * oz) / ol; cnt++; }
          }
        }
      }
      var isRev = cnt >= 2 && sum / cnt < RS.revCos, fl = S[i].rg && S[i].rg.flip === 1;
      if (!isRev && d0[i]) {                                                   // 지나가는 자리에 다른 가닥이 없는 더듬이 — 뿌리 이웃이 가는 쪽과 반대면 거꾸로
        var rr = rootRef(i), rl = Math.sqrt(rr[0] * rr[0] + rr[1] * rr[1] + rr[2] * rr[2]);
        if (rr[3] >= RS.revMinN && rl > 0.3 * rr[3] && (d0[i][0] * rr[0] + d0[i][1] * rr[1] + d0[i][2] * rr[2]) / rl < RS.revCos) { isRev = true; revRoot++; }
      }
      if (fl) flipN++;
      if (isRev) { rev++; if (fl) revFlip++; }
      info[i] = { L: L, rev: isRev, r: q[0] };
    }
    // (2026-10-13b) 엇나간 본보기 — 사용자: "직모 옆으로 가닥들이 생기네"
    //   기른 가닥의 5%쯤은 잔머리·엇나간 가닥(결 표가 빼는 것)인데 본보기로는 그대로 쓰여, 그 근처 마네킹 뿌리 여러 개가 같은 엇나간 길을 받아 옆으로 뜬 가닥 줄이 됨.
    //   ① 3D 머리 덩어리 밖을 지나는 점이 strayOut 넘게 많은 가닥 ② (직모·웨이브 — 잰 컬 strayCurlMax 미만) 길 전체에서 그 자리 흐름과의 평균 cos가 strayCos 미만인 가닥 → 본보기에서 뺌(이웃 바른 가닥 모양을 받음)
    var VC = (G && (G.volT || G.vol)) || null, curlM = 0, strayN = 0, strayV = 0;
    try { var spx = W.ORIG_MQ && W.ORIG_MQ.spec; curlM = (spx && spx.perm && spx.perm.curl) || 0; } catch (e) {}
    // (2026-10-13e) 웨이브·곱슬(잰 컬 strayCurlMax 이상)은 둘 다 안 봄 — 굴곡 때문에 덩어리 밖을 자주 지나 웨이브 손님 본보기 4,900개(17%)가 빠졌고,
    //   앞이마 뿌리가 멀리 있는 긴 가닥을 받아 이마로 더 내려오며 꺾였음(사용자: "웨이브 여자분 이마에 가닥이 더 내려오면서 꺾여 있어")
    if (RS.strayOn && curlM < RS.strayCurlMax) for (i = 0; i < n; i++) {
      var f0 = info[i]; if (!f0 || f0.rev) continue;
      var q2 = S[i].pts, outN = 0, tot = 0, cs = 0, cn = 0;
      for (j = 1; j < q2.length; j++) {
        tot++;
        if (VC) { try { if (VC.at(q2[j]) === 0) outN++; } catch (e) {} }
        if (curlM < RS.strayCurlMax) {
          var fx = q2[j].x - q2[j - 1].x, fy = q2[j].y - q2[j - 1].y, fz = q2[j].z - q2[j - 1].z, fl2 = Math.sqrt(fx * fx + fy * fy + fz * fz); if (!(fl2 > 1e-9)) continue;
          var c3 = flow.get(keyOf(Math.floor(q2[j].x / V), Math.floor(q2[j].y / V), Math.floor(q2[j].z / V)));
          if (c3 && c3[3] - 1 >= RS.revMinN) { var gx = c3[0] - fx / fl2, gy = c3[1] - fy / fl2, gz = c3[2] - fz / fl2, gl = Math.sqrt(gx * gx + gy * gy + gz * gz); if (gl > 0.5) { cs += (fx * gx + fy * gy + fz * gz) / (fl2 * gl); cn++; } }
        }
      }
      if (tot && outN / tot > RS.strayOut) { f0.rev = true; strayV++; continue; }
      if (cn >= 4 && cs / cn < RS.strayCos) { f0.rev = true; strayN++; }
    }
    /* (2026-10-13f) 얼굴·목 앞을 가로지르는 본보기 — 사용자 영상(19:56 긴 곱슬: 이마에 머리띠처럼 가로로 걸친 줄 · 19:59 긴 생머리: 목 앞을 가로지른 한 가닥).
       사진의 머리선(이마와 머리 경계)·턱선·목선은 결 필터에 "가로 결"로 읽혀, 그 자리에서 기른 가닥이 이마·얼굴·목을 따라 옆으로 걷습니다.
       위 엇나간 본보기 빼기는 곱슬(잰 컬 30 이상)에서 꺼져 있어 곱슬 손님은 이 가닥이 그대로 앞쪽 뿌리들의 본보기가 됐습니다.
       컬과 상관없이: 얼굴·목 앞(머리선 ~ 목 밑동 · 얼굴 폭 안 · 얼굴 앞면/목 앞쪽)에서 옆으로 간 거리가 hairlineCm을 넘고
       내려간 거리의 hairlineK배를 넘는 가닥은 본보기에서 뺌(이웃 바른 가닥 모양을 받음). 옆으로 늘어진 머리는 아래로 가므로 안 걸림.
       끄기 READ_SHAPE.hairlineOn=false */
    var hlN = 0;
    if (RS.hairlineOn !== false) {
      var fg = null; try { fg = typeof faceClearGeom === 'function' ? faceClearGeom() : null; } catch (e) { fg = null; }
      var hlU = (RS.hairlineCm || 1.5) / cpu(), hlK = RS.hairlineK || 1.5;
      var hlTop = fg ? fg.topY + (RS.hairlineFaceFrac || 0.55) * fg.fh : 0;   // 이마 높이 ≈ 얼굴 단위(눈~턱)의 0.55 — 그 위 정수리 가르마 넘김은 안 봄
      var hlBot = fg ? fg.botY - 0.6 * fg.fh : 0;                             // 턱 아래 목 밑동까지
      try { var nb = getNeckBottomY(); if (isFinite(nb) && nb < fg.botY) hlBot = nb; } catch (e) {}
      if (fg) for (i = 0; i < n; i++) {
        var fh = info[i]; if (!fh || fh.rev) continue;
        var q4 = S[i].pts, adx = 0, ady = 0;
        for (j = 1; j < q4.length; j++) {
          var a4 = q4[j], b4 = q4[j - 1];
          if (!(a4.y < hlTop) || !(a4.y > hlBot) || !(Math.abs(a4.x) < fg.xHalf)) continue;
          if (a4.y > fg.botY) { if (!fg.inFront(fg, a4)) continue; }             // 얼굴: 얼굴 앞에 보이는 점(17a faceClearInFront)
          else if (!(a4.z > 0)) continue;                                         // 목: 앞쪽 반
          adx += Math.abs(a4.x - b4.x); ady += Math.abs(a4.y - b4.y);
        }
        if (adx > hlU && adx > hlK * ady) { fh.rev = true; hlN++; }
      }
    }
    /* (2026-10-13h) 하늘로 솟은 본보기 — 사용자 영상(20:11, 긴 생머리): 뒤쪽 머리가 위로 솟아 뻗침.
       뒤·옆 뿌리(머리 앞쪽 반이 아닌 곳)에서 기른 가닥이 뿌리보다 riseCm 넘게 올라가면 본보기에서 뺌(이웃 바른 가닥 모양을 받음).
       앞머리선(앞쪽 반)은 세운 앞머리가 있을 수 있어 안 봄. 끄기 READ_SHAPE.riseCm=0 */
    var riseN = 0, riseU = (RS.riseCm || 0) / cpu(), Eh5 = null;
    try { Eh5 = getHeadEllipsoid(); } catch (e) {}
    if (riseU > 0) for (i = 0; i < n; i++) {
      var f5 = info[i]; if (!f5 || f5.rev) continue;
      var q5 = S[i].pts, r5 = q5[0];
      if (Eh5 && r5.z > 0.5 * Eh5.c) continue;
      var top5 = -Infinity; for (j = 1; j < q5.length; j++) if (q5[j].y > top5) top5 = q5[j].y;
      if (top5 - r5.y > riseU) { f5.rev = true; riseN++; }
    }
    // 짧게 막힌 가닥 — 뿌리 칸(2cm) 이웃 길이 중앙값 대비
    var RC = RS.rootCell, rc = new Map();
    for (i = 0; i < n; i++) { var f = info[i]; if (!f) continue; var kk = keyOf(Math.floor(f.r.x / (RC * 2)), Math.floor(f.r.y / (RC * 2)), Math.floor(f.r.z / (RC * 2))), a = rc.get(kk); if (!a) rc.set(kk, a = []); a.push(f.L); }
    rc.forEach(function (a) { a.sort(function (x, y) { return x - y; }); a.med = a[a.length >> 1]; });
    var cells = new Map(), good = 0;
    for (i = 0; i < n; i++) {
      var g = info[i]; if (!g || g.rev) continue;
      var a2 = rc.get(keyOf(Math.floor(g.r.x / (RC * 2)), Math.floor(g.r.y / (RC * 2)), Math.floor(g.r.z / (RC * 2))));
      if (a2 && a2.length >= 4 && g.L < a2.med * RS.shortK) { shortN++; continue; }
      /* (2026-10-13g) 길게 샌 가닥 — 사용자 영상(19:59): 머리 아래로 바닥까지 내려간 한 줄. 세그멘테이션이 옷·몸을 머리로 따라가면
         그 자리에서 기른 가닥이 이웃보다 몇 배 길어지고, 그걸 받은 마네킹 뿌리가 그대로 길게 늘어짐. 이웃 길이 중앙값의 longK배를 넘으면 본보기 아님. */
      if (a2 && a2.length >= 4 && g.L > a2.med * (RS.longK || 2.2)) { longN++; continue; }
      var k3 = keyOf(Math.floor(g.r.x / RC), Math.floor(g.r.y / RC), Math.floor(g.r.z / RC)), b = cells.get(k3);
      if (!b) cells.set(k3, b = []); b.push(i); good++;
    }
    ST.built = { rise: riseN, hairline: hlN, long: longN, strayV: strayV, strayN: strayN, n: n, good: good, rev: rev, revRoot: revRoot, revFlip: revFlip, flipN: flipN, short: shortN, vox: flow.size, ms: Date.now() - t0 };
    try { console.log(TAG + ' 본보기 — 기른 가닥 ' + n + ' 중 ' + good + '개 · 거꾸로 자란 가닥 ' + rev + '(그중 42번이 위로 뒤집어 기른 것 ' + revFlip + '/' + flipN + ') · 짧게 막힌 가닥 ' + shortN + ' · 얼굴·목을 가로지른 가닥 ' + hlN + ' · 길게 샌 가닥 ' + longN + ' · 솟은 가닥 ' + riseN + ' · ' + ST.built.ms + 'ms'); } catch (e) {}
    return { m: m, arr: S, cells: cells };
  }
  function index() {
    var m = model(); if (!m || !m.strands || !m.strands.length) return null;
    if (!IDX || IDX.m !== m || IDX.arr !== m.strands) IDX = buildIndex(m);
    return IDX;
  }
  RS.reindex = function () { IDX = null; return index() ? ST.built : null; };

  function resample(p, M) {
    var S = [0], i, j = 0, n = p.length; for (i = 1; i < n; i++) S.push(S[i - 1] + Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y, p[i].z - p[i - 1].z));
    var L = S[n - 1]; if (!(L > 0)) return p;
    var out = new Array(M); for (i = 0; i < M; i++) { var s = L * i / (M - 1); while (j < n - 2 && S[j + 1] < s) j++; var u = (s - S[j]) / Math.max(1e-12, S[j + 1] - S[j]); out[i] = { x: p[j].x + (p[j + 1].x - p[j].x) * u, y: p[j].y + (p[j + 1].y - p[j].y) * u, z: p[j].z + (p[j + 1].z - p[j].z) * u }; }
    return out;
  }
  /* (2026-10-12s) 컬 타래 — 사진에서 읽은 타래 조각 기준(61번 clumpOfPath). 본보기 가닥마다 지나간 조각을 붙여 두고(buildIndex 뒤 한 번),
   *  옮겨심을 때 그 조각의 대표 길(조각에 걸린 기른 가닥 중 가장 긴 것)로 뿌리에서 lockRootCm 지나며 lockPull만큼 당김. 조각에 안 걸린 가닥은 그대로. */
  function clumpTable(ix) {
    if (ix.clT !== undefined) return ix.clT;
    var PC = W.PHOTO_CURL; ix.clT = null;
    if (!PC || typeof PC.clumpOfPath !== 'function' || typeof PC.lockOn !== 'function' || !PC.lockOn()) return null;
    var t0 = Date.now(), of = new Map(), ex = new Map(), lenOf = new Map(), n = 0;
    ix.cells.forEach(function (L) { L.forEach(function (i) {
      var p = ix.arr[i].pts, c = PC.clumpOfPath(p); if (!c) return; of.set(i, c); n++;
      var L0 = 0, k; for (k = 1; k < p.length; k++) L0 += Math.hypot(p[k].x - p[k - 1].x, p[k].y - p[k - 1].y, p[k].z - p[k - 1].z);
      if (!(lenOf.get(c.key) >= L0)) { lenOf.set(c.key, L0); ex.set(c.key, i); }
    }); });
    ix.clT = { of: of, ex: ex };
    ST.clumps = { strands: n, clumps: ex.size, ms: Date.now() - t0 };
    try { console.log(TAG + ' 사진 타래 조각 — 본보기 ' + n + '가닥이 조각 ' + ex.size + '개에 걸림 · ' + ST.clumps.ms + 'ms'); } catch (e) {}
    return ix.clT;
  }
  function pullToClump(ix, bi, root, pts) {
    var T = clumpTable(ix); if (!T) return null;
    var c = T.of.get(bi); if (!c) return null;
    var ei = T.ex.get(c.key); if (!(ei >= 0)) return null;
    var out = { lk: c, pts: pts };
    if (ei === bi || !(RS.lockPull > 0)) return out;
    var src = ix.arr[ei].pts, q0 = src[0], M = pts.length, lp = new Array(src.length), k;
    for (k = 0; k < src.length; k++) lp[k] = { x: src[k].x - q0.x + root.x, y: src[k].y - q0.y + root.y, z: src[k].z - q0.z + root.z };
    lp = resample(lp, M);
    var S = 0, o = [pts[0]], rU = RS.lockRootCm / cpu();
    for (k = 1; k < M; k++) {
      S += Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y, pts[k].z - pts[k - 1].z);
      var w = Math.min(1, S / Math.max(1e-6, rU)); w = RS.lockPull * w * w * (3 - 2 * w);
      o.push({ x: pts[k].x + (lp[k].x - pts[k].x) * w, y: pts[k].y + (lp[k].y - pts[k].y) * w, z: pts[k].z + (lp[k].z - pts[k].z) * w });
    }
    ST.locked = (ST.locked || 0) + 1; out.pts = o;
    return out;
  }
  function nearest(ix, p) {
    var RC = RS.rootCell, cx = Math.floor(p.x / RC), cy = Math.floor(p.y / RC), cz = Math.floor(p.z / RC), best = -1, bd = Infinity, r, a, b, c;
    for (r = 0; r <= RS.reach; r++) {
      for (a = -r; a <= r; a++) for (b = -r; b <= r; b++) for (c = -r; c <= r; c++) {
        if (Math.max(Math.abs(a), Math.abs(b), Math.abs(c)) !== r) continue;
        var L = ix.cells.get(keyOf(cx + a, cy + b, cz + c)); if (!L) continue;
        for (var t = 0; t < L.length; t++) { var q = ix.arr[L[t]].pts[0], d = (q.x - p.x) * (q.x - p.x) + (q.y - p.y) * (q.y - p.y) + (q.z - p.z) * (q.z - p.z); if (d < bd) { bd = d; best = L[t]; } }
      }
      if (best >= 0 && Math.sqrt(bd) <= (r + 0.5) * RC) break;              // 다음 고리에 더 가까운 게 있을 수 없음
    }
    return best;
  }

  /* ── B. 슬라이더 — 59번 adjustFlow와 같은 "기준에서 움직인 만큼만" · 컬은 올린 만큼만 ── */
  function adjustRead(s, g, base, lenOverride, styOverride, lk) {
    var cur = (state.sections && state.sections[s.sec]) || {};
    var sty = (styOverride !== undefined ? styOverride : uniformStyling()) || stylingForRoot(s.pts[0]) || {};
    var dlen = 50; try { dlen = SECTIONS[s.sec].defaults.length; } catch (e) {}
    var r = sectionLengthRatio(s.sec, typeof lenOverride === 'number' ? lenOverride : cur.length) / (sectionLengthRatio(s.sec, dlen) || 1);
    if (isFinite(r) && Math.abs(r - 1) > 1e-6) g = lengthStrand3D(g, r);
    if (RS.shape || !(ST.wave && ST.wave.wave)) { try { var PCx = W.PHOTO_CURL; if (PCx && typeof PCx.applyShape === 'function') { var g2 = PCx.applyShape(g, lk); if (g2 && g2 !== g) { g = g2; ST.shaped = (ST.shaped || 0) + 1; } } } catch (e) {} }   // (2026-10-12j) 옮겨심은 축 위에 사진 선 굴곡
    try { if (RS.waveGain > 1 && ST.wave && ST.wave.wave && typeof W.__rsWaveGain === 'function') { g = W.__rsWaveGain(g, RS); ST.waveGained = (ST.waveGained || 0) + 1; } } catch (e) {}   // (2026-10-17) 웨이브 사진이면 출렁임만 waveGain배
    var curl = Math.max(0, cur.curl || 0), C0 = base.curl || 0, dC = curl - C0;
    var sweep = Math.max(-100, Math.min(100, (sty.sweep || 0) - (base.sweep || 0)));
    var vol = Math.max(0, Math.min(100, 50 + ((typeof sty.volume === 'number' ? sty.volume : 50) - (typeof base.volume === 'number' ? base.volume : 50))));
    var samePart = (sty.part || 0) === (base.part || 0) && (sty.partAmt || 0) === (base.partAmt || 0);
    var part = samePart ? 0 : (sty.part || 0), partAmt = samePart ? 0 : sty.partAmt;
    if (dC > 1) { g = curlStrand3D(g, dC, (typeof cur.wave === 'number' ? cur.wave : 50) / 100, typeof cur.curlDir === 'number' ? cur.curlDir : 0); g = gravityDroop3D(g, dC); ST.curlAdd++; }
    g = partStrand3D(g, part, curl, partAmt);
    g = sweepStrand3D(g, sweep, curl, part, partAmt);
    g = volumeStrand3D(g, vol, s.sec);
    g = flowCurlStrand3D(g, sty.flow || 0);
    g = sleekStrand3D(g, typeof sty.sleek === 'number' ? sty.sleek : 0);
    return g;
  }

  /* adjustStrandGeom(17b) 맨 바깥 단계 — 옮겨심은 가닥(아니면 null → 안쪽 단계들 다음 _afterStages) */
  RS._adjust = function (s, lenOverride, styOverride) {
    if (RS.on && s && s.mannequin && s.pts && s.pts.length >= 2 && isOrig()) {
      try {
        var ix = index();
        if (ix) {
          var mem = s._rsh;
          if (mem && mem.ix === ix && mem.stub) return mem.stub;
          if (!mem || mem.ix !== ix) {
            var root = s.pts[0], bi = nearest(ix, root), pts = null;
            if (bi >= 0) {
              var src = ix.arr[bi].pts, q0 = src[0], dx = root.x - q0.x, dy = root.y - q0.y, dz = root.z - q0.z, k;
              pts = new Array(src.length);
              // (2026-10-13a) 목·옆머리 잔가닥 — 사진에 머리가 없어 안 심은 뿌리(목선·귀 둘레) 자리의 마네킹 뿌리는 몇 cm 떨어진 본보기 길을
              //   통째로 옮겨 왔음 → 길 전체가 그만큼 비켜 3D 머리 덩어리 밖(목 앞·귀 옆 공중)으로 나감. 이제 뿌리에서 offFadeCm에 걸쳐
              //   비킨 거리를 offKeepCm까지 줄여 본보기 길 옆으로 붙임(같은 길로 겹치지는 않게 조금 남김). 끄기 READ_SHAPE.offFadeCm=0
              var dl = Math.sqrt(dx * dx + dy * dy + dz * dz);
              // (2026-10-13b) 목 가닥 — 사진에 머리가 없어 기른 가닥이 없는 자리(목선 아래·귀 뒤)의 마네킹 뿌리는 멀리(1.5~3cm) 있는 본보기 길을 받아,
              //   그 길까지 목 피부를 가로질러 가는 짧은 선("ㄴ" 모양)이 됨. 사진대로 그 자리는 머리가 없는 것이므로 그리지 않음(두피에 붙은 0.1mm 점). 끄기 READ_SHAPE.farCm=0
              if (RS.farCm > 0 && dl * cpu() > RS.farCm) { ST.farSkip = (ST.farSkip || 0) + 1; var tip = { x: root.x + (root.x) * 1e-4, y: root.y + 1e-5, z: root.z + root.z * 1e-4 }; mem = s._rsh = { ix: ix, pts: null, stub: [root, tip] }; return mem.stub; }
              var keepU = RS.offKeepCm / cpu(), fadeU = RS.offFadeCm / cpu(), acc = 0;
              var fr = (RS.offFadeCm > 0 && dl > keepU) ? keepU / dl : 1;
              if (fr < 1) ST.offPulled = (ST.offPulled || 0) + 1;
              for (k = 0; k < src.length; k++) {
                if (k) acc += Math.hypot(src[k].x - src[k - 1].x, src[k].y - src[k - 1].y, src[k].z - src[k - 1].z);
                var ww = fr < 1 ? Math.min(1, acc / Math.max(1e-6, fadeU)) : 0; ww = ww * ww * (3 - 2 * ww);
                var f2 = 1 - ww * (1 - fr);
                pts[k] = { x: src[k].x + dx * f2, y: src[k].y + dy * f2, z: src[k].z + dz * f2 };
              }
              /* (2026-10-13g) 길이 상한 — 사용자 영상(19:59, 검은 상의 · 긴 생머리): 머리 아래로 바닥까지 내려간 굵은 줄.
                 세그멘테이션이 검은 옷을 머리로 따라가 뒤쪽 기른 가닥이 이웃까지 통째로 길어지면 위 longK(이웃 대비)로는 못 거름.
                 마네킹 가닥(섹션에서 잰 길이 백분위로 심은 길이)의 capK배를 넘는 부분은 끝에서 자름. 끄기 READ_SHAPE.capK=0 */
              if (RS.capK > 0 && typeof cutFromTipArcLen === 'function' && typeof cutFromTipTruncate === 'function') {
                var Lm = cutFromTipArcLen(s.pts), Lp = cutFromTipArcLen(pts);
                if (Lm > 0 && Lp > RS.capK * Lm) { pts = cutFromTipTruncate(pts, RS.capK * Lm); ST.capped = (ST.capped || 0) + 1; }
              }
              if (RS.maxPts > 2 && pts.length > RS.maxPts) pts = resample(pts, RS.maxPts);
              var lk = null; if (RS.lockPull >= 0) { try { var pc2 = pullToClump(ix, bi, root, pts); if (pc2) { pts = pc2.pts; lk = pc2.lk; } } catch (e2) {} }   // (2026-10-12s) 사진 타래 조각
            }
            mem = s._rsh = { ix: ix, pts: pts, lk: (typeof lk !== 'undefined') ? lk : null };
            if (pts) ST.used++; else ST.fell++;
          }
          if (mem.pts) {
            // 기준 = 잰 값 그대로(옮겨심은 길에 이미 들어 있는 넘김·볼륨·컬) — 컬은 스펙이 섹션에 넣은 값(= 사진에서 잰 컬)
            var base = {}; try { var sp = W.ORIG_MQ.spec; base = Object.assign({}, (sp && sp.flowBase) || {}); if (sp && sp.perm && typeof sp.perm.curl === 'number') base.curl = sp.perm.curl; } catch (e) {}
            return adjustRead(s, mem.pts, base, lenOverride, styOverride, mem.lk);
          }
        }
      } catch (e) { if (!ST.err) console.warn(TAG + ' 옮겨심기 실패 — 예전 경로', e); ST.err = String(e && e.message || e); }
    }
    return null;
  };
  RS._afterStages = function (s, outA) {
    try { if (s && s.mannequin && W.PHOTO_CURL && typeof W.PHOTO_CURL.activeRS === 'function') { var rs = W.PHOTO_CURL.activeRS(); if (rs && outA && outA.length > 1) { var o2 = W.PHOTO_CURL.applyShapeRS(RS.maxPts > 2 && outA.length > RS.maxPts ? resample(outA, RS.maxPts) : outA, rs); if (o2) { ST.rsShaped = (ST.rsShaped || 0) + 1; return o2; } } } } catch (e) {}   // (2026-10-12v) 다른 손님에게 건 스타일 — 결 표로 만든 길 위에 스타일에 실린 굴곡
    return outA;
  };

  RS._sigTail = function () {   // adjFilterSig(17b) 끝
    var s = '';
    try { if (RS.on && isOrig()) { var m = model(); s += '|rs1:' + (m ? m.strands.length : 0) + (RS.shape ? 's' : '') + RS.maxPts + 'L' + RS.lockPull + 'o' + RS.offKeepCm + ':' + RS.offFadeCm + 'f' + RS.farCm + (RS.strayOn ? 'y' + RS.strayOut + ':' + RS.strayCos : ''); } } catch (e) {}
    return s;
  };

  /* ── D. 뿌리 고르게 ─────────────────────────────────────────────────── */
  RS._evenRoots = function (ro, r) {   // fillUnseenRootCells(13c) 끝
    if (!RS.evenRoots) return r;
    try {
      var den = ro && ro.den, est = ro && ro.est; if (!den || !est) return r;
      var N = ro.NT * ro.NP, OFFv = typeof EST_OFFSCALP !== 'undefined' ? EST_OFFSCALP : 3, meas = [], i;
      for (i = 0; i < N; i++) if (est[i] === 0 && den[i] > 0) meas.push(den[i]);
      if (meas.length < 20) return r;
      meas.sort(function (a, b) { return a - b; });
      var base = meas[meas.length >> 1], low = base * RS.rootLow, up = 0, down = 0, left = 0;
      for (i = 0; i < N; i++) {
        if (est[i] === OFFv) continue;
        if (!(den[i] >= low)) { left++; continue; }
        if (den[i] < base) up++; else if (den[i] > base) down++;
        den[i] = base;
      }
      ST.roots = { base: +base.toFixed(2), up: up, down: down, left: left };
      console.log(TAG + ' 뿌리 고르게 — 머리 있는 칸을 보통 밀도 ' + ST.roots.base + '로: 올린 칸 ' + up + ' · 내린 칸(밀집 띠) ' + down + ' · 보통의 ' + RS.rootLow + ' 미만이라 남긴 칸 ' + left + '(64번이 작은 덩어리는 채우고 넓게 빈 곳은 대머리로 둠) · 끄기 READ_SHAPE.evenRoots=false');
    } catch (e) { ST.err = '뿌리: ' + (e && e.message || e); }
    return r;
  };

  RS.lines = function () {
    var b = ST.built, w = ST.wave, ro = ST.roots;
    return [TAG + ' ' + (RS.on ? '켜짐' : '꺼짐') +
      ' · 웨이브 사진 직모 뼈대 안 씀: ' + (!RS.waveRaw ? '꺼짐' : w ? (w.wave ? '웨이브(고리 ' + (+w.loop).toFixed(2) + ') → 읽은 길 그대로' : '고리 컬이라 예전대로') : '아직') +
      ' · 옮겨심은 마네킹 가닥 ' + ST.used + ' / 본보기 못 찾아 예전 경로 ' + ST.fell + (ST.offPulled ? ' · 멀리서 옮겨 와 본보기 옆으로 붙인 가닥 ' + ST.offPulled : '') + (ST.curlAdd ? ' · 컬 더 감은 가닥 ' + ST.curlAdd : '') +
      (b ? '\n  본보기: 기른 가닥 ' + b.n + ' 중 ' + b.good + ' · 거꾸로 자란 가닥 ' + b.rev + '(42번이 위로 뒤집은 ' + b.flipN + ' 중 ' + b.revFlip + ') · 짧게 막힌 ' + b.short + ' · ' + b.ms + 'ms' : '') +
      (ro ? '\n  뿌리 고르게: 보통 밀도 ' + ro.base + ' · 올린 칸 ' + ro.up + ' · 내린 칸 ' + ro.down + ' · 남긴 칸 ' + ro.left : '') +
      (ST.err ? ' · ⚠ ' + ST.err : '')];
  };
  console.log(TAG + ' 설치 — 원본 머리 = 방향필터로 읽은 가닥 모양을 마네킹 뿌리에 옮겨심음 · 거꾸로 자란 가닥은 본보기에서 뺌 · 뿌리 고르게. 끄기 READ_SHAPE.on / waveRaw / evenRoots = false');
  return RS;
})();

/* ==========================================================================
 * STYLE_PATHS (옛 69-style-paths.js) — 원본 머리를 스타일로 등록할 때 "보이는 가닥 길 그대로"(타래 자리까지) 실음
 *
 * 자리: 17b, READ_SHAPE 다음. adjustStrandGeom(17b 맨 바깥) STYLE_PATHS._adjust / _record · buildSpecFromCurrent(06) 끝 · adjFilterSig 꼬리표 · syncMannequinBtn(17a) 끝 · perfPanelLines(18) 끝 줄
 *
 * 왜 (2026-10-13 · 사용자):
 *   "앞에 컬 헤어 여자분 머리를 스타일로 저장해서 뒤에 적용해 봤는데, 머리가 늘어지네. 타래 위치까지 다 기억하게 스타일 등록되게 해줘."
 *   예전(12v·12w) 등록 = 결 표(59번 · 칸마다 큰 흐름 방향 + 길이) + 굴곡 값(61번 · 두피 칸마다 크기·한 번·위상).
 *     받는 손님은 결 표로 길을 "다시 지어서"(굴곡 없는 흐름 → 중력 쪽으로 내려감) 그 위에 굴곡을 얹음
 *     → 원본의 부피(덩어리 안에서 옆·바깥으로 뜬 길)와 타래가 놓인 자리가 사라지고 아래로 늘어짐.
 *
 * 무엇을:
 *   A. 기록 — 원본 머리(마네킹 + 잰 값 · 68번 옮겨심기)를 그릴 때 마네킹 가닥마다 최종 길(굴곡·타래·슬라이더까지 다 걸린 것)을
 *      뿌리 자리 칸(cell ≈ 0.8cm)마다 하나씩 모아 둠.
 *   B. 등록 — buildSpecFromCurrent에서 원본 머리를 보고 있으면 spec.readPaths로 실음
 *      (뿌리 int16 · 길은 점 사이 차이를 int8로 · base64 — 1000가닥쯤 ≈ 100~200KB). 등록 때 슬라이더 값(섹션 길이·컬·넘김·볼륨·가르마)도 같이.
 *   C. 적용 — 이 스타일이 걸린 다른 손님의 마네킹 가닥은 가장 가까운 뿌리의 길을 그대로 옮겨 씀(결 표로 다시 짓지 않음 · 굴곡도 다시 안 얹음).
 *      같은 칸(≈0.8cm)의 가닥은 같은 길을 나란히 따라가 타래가 원본 자리에서 그대로 생김.
 *      슬라이더는 "등록 때 값에서 움직인 만큼만"(길이 비율·넘김·볼륨·가르마·컬 더 감기).
 * 끄기: STYLE_PATHS.on=false(기록·적용 모두) · STYLE_PATHS.apply=false(적용만 — 예전 결 표 경로)
 * ========================================================================== */
var STYLE_PATHS = (function () {
  'use strict';
  var W = window, TAG = '[스타일 길]';
  var SP = Object.assign({
    on: true, apply: true,
    cell: 0.04,          // 뿌리 칸(모델 단위 ≈ 0.8cm) — 칸마다 길 하나
    stepCm: 0.6,         // 실을 때 점 간격(컬 한 바퀴 2cm에 3~4점 이상)
    maxPts: 72,
    reach: 4,            // 적용 때 뿌리 찾기 칸 반경
    offKeepCm: 0.4, offFadeCm: 2.5
  }, W.STYLE_PATHS || {});
  var ST = SP.stats = { rec: 0, cells: 0, exportKB: 0, exportN: 0, used: 0, fell: 0, err: null };
  var REC = { photo: null, m: new Map() };

  function cpu() { try { return (typeof CURL_BUNDLE !== 'undefined' && CURL_BUNDLE.cmPerUnit) || 19.33; } catch (e) { return 19.33; } }
  function photo() { try { return state._hair3Dneutral || null; } catch (e) { return null; } }
  function isOrig() { try { return !!(W.ORIG_MQ && W.ORIG_MQ.on !== false && typeof W.ORIG_MQ.isOriginal === 'function' && W.ORIG_MQ.isOriginal()); } catch (e) { return false; } }
  function keyOf(ix, iy, iz) { return ((ix + 512) * 1024 + (iy + 512)) * 1024 + (iz + 512); }
  function cellKey(p) { var c = SP.cell; return keyOf(Math.floor(p.x / c), Math.floor(p.y / c), Math.floor(p.z / c)); }
  function arcLen(p) { var L = 0, i; for (i = 1; i < p.length; i++) L += Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y, p[i].z - p[i - 1].z); return L; }
  function resample(p, M) {
    var S = [0], i, j = 0, n = p.length; for (i = 1; i < n; i++) S.push(S[i - 1] + Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y, p[i].z - p[i - 1].z));
    var L = S[n - 1]; if (!(L > 0) || M < 2) return p.slice();
    var out = new Array(M); for (i = 0; i < M; i++) { var s = L * i / (M - 1); while (j < n - 2 && S[j + 1] < s) j++; var u = (s - S[j]) / Math.max(1e-12, S[j + 1] - S[j]); out[i] = { x: p[j].x + (p[j + 1].x - p[j].x) * u, y: p[j].y + (p[j + 1].y - p[j].y) * u, z: p[j].z + (p[j + 1].z - p[j].z) * u }; }
    return out;
  }

  /* ── A. 기록 ─────────────────────────────────────────────────────────── */
  function record(s, out) {
    var ph = photo(); if (REC.photo !== ph) { REC.photo = ph; REC.m = new Map(); }
    var r = s.pts[0]; if (!r || !out || out.length < 2) return;
    var k = cellKey(r), e = REC.m.get(k);
    var c = SP.cell, cx = (Math.floor(r.x / c) + 0.5) * c, cy = (Math.floor(r.y / c) + 0.5) * c, cz = (Math.floor(r.z / c) + 0.5) * c, d = (r.x - cx) * (r.x - cx) + (r.y - cy) * (r.y - cy) + (r.z - cz) * (r.z - cz);
    if (e && e.s !== s && e.d < d) return;                                 // 칸 가운데에 가까운 뿌리 하나만(같은 가닥이면 새 길로 바꿈)
    REC.m.set(k, { s: s, d: d, r: { x: r.x, y: r.y, z: r.z }, p: out, sec: s.sec });
    ST.rec++;
  }

  /* ── B. 실기(인코딩) ─────────────────────────────────────────────────── */
  var Q = 1e-4;   // 뿌리 좌표 단위(모델 단위) — int16이면 ±3.27
  function exportPaths() {
    if (REC.photo !== photo() || !REC.m.size) return null;
    var bytes = [], n = 0, stepU = SP.stepCm / cpu();
    function i16(v) { v = Math.max(-32768, Math.min(32767, Math.round(v))); bytes.push(v & 255, (v >> 8) & 255); }
    function u16(v) { v = Math.max(0, Math.min(65535, Math.round(v))); bytes.push(v & 255, (v >> 8) & 255); }
    REC.m.forEach(function (e) {
      var p = e.p, L = arcLen(p); if (!(L > 1e-6)) return;
      var M = Math.max(4, Math.min(SP.maxPts, Math.ceil(L / stepU) + 1)), q = resample(p, M), i;
      var mx = 0; for (i = 1; i < M; i++) mx = Math.max(mx, Math.abs(q[i].x - q[i - 1].x), Math.abs(q[i].y - q[i - 1].y), Math.abs(q[i].z - q[i - 1].z));
      var sc = Math.max(1e-6, mx / 127);                                  // 점 사이 차이 한 칸 크기(모델 단위)
      i16(e.r.x / Q); i16(e.r.y / Q); i16(e.r.z / Q); u16(sc / 1e-6); bytes.push(M);
      var px = q[0].x, py = q[0].y, pz = q[0].z;                           // 되살린 점을 따라가며 양자화(오차가 쌓이지 않게)
      for (i = 1; i < M; i++) {
        var ax = Math.max(-127, Math.min(127, Math.round((q[i].x - px) / sc))), ay = Math.max(-127, Math.min(127, Math.round((q[i].y - py) / sc))), az = Math.max(-127, Math.min(127, Math.round((q[i].z - pz) / sc)));
        bytes.push(ax & 255, ay & 255, az & 255); px += ax * sc; py += ay * sc; pz += az * sc;
      }
      n++;
    });
    var bin = '', CH = 8192, i2; for (i2 = 0; i2 < bytes.length; i2 += CH) bin += String.fromCharCode.apply(null, bytes.slice(i2, i2 + CH));
    var sty = {}, len = {}, curl = {};
    try { sty = Object.assign({}, (typeof uniformStyling === 'function' && uniformStyling()) || {}); } catch (e) {}
    try { Object.keys(state.sections || {}).forEach(function (k) { var c = state.sections[k]; if (c) { if (typeof c.length === 'number') len[k] = c.length; curl[k] = c.curl || 0; } }); } catch (e) {}
    var out = { v: 1, q: Q, cell: SP.cell, n: n, d: btoa(bin), sty: sty, len: len, curl: curl };
    ST.exportN = n; ST.exportKB = Math.round(out.d.length / 1024);
    return out;
  }
  function decode(rp) {
    if (rp._dec) return rp._dec;
    var bin = atob(rp.d), N = bin.length, o = 0, list = [], q = rp.q || Q;
    function b() { return bin.charCodeAt(o++); }
    function i16() { var v = b() | (b() << 8); return v >= 32768 ? v - 65536 : v; }
    function i8() { var v = b(); return v >= 128 ? v - 256 : v; }
    while (o + 9 <= N) {
      var r = { x: i16() * q, y: i16() * q, z: i16() * q }, sc = (b() | (b() << 8)) * 1e-6, M = b(), p = [{ x: r.x, y: r.y, z: r.z }], i;
      if (o + (M - 1) * 3 > N) break;
      for (i = 1; i < M; i++) { var l = p[i - 1]; p.push({ x: l.x + i8() * sc, y: l.y + i8() * sc, z: l.z + i8() * sc }); }
      list.push({ r: r, p: p });
    }
    var cells = new Map(), c = rp.cell || SP.cell;
    list.forEach(function (e, idx) { var k = keyOf(Math.floor(e.r.x / c), Math.floor(e.r.y / c), Math.floor(e.r.z / c)), a = cells.get(k); if (!a) cells.set(k, a = []); a.push(idx); });
    rp._dec = { list: list, cells: cells, c: c };
    try { Object.defineProperty(rp, '_dec', { enumerable: false, value: rp._dec, writable: true }); } catch (e) {}   // 저장(JSON) 때 안 실리게
    return rp._dec;
  }
  function nearest(D, p) {
    var c = D.c, cx = Math.floor(p.x / c), cy = Math.floor(p.y / c), cz = Math.floor(p.z / c), best = -1, bd = Infinity, r, a, b2, d2;
    for (r = 0; r <= SP.reach; r++) {
      for (a = -r; a <= r; a++) for (b2 = -r; b2 <= r; b2++) for (d2 = -r; d2 <= r; d2++) {
        if (Math.max(Math.abs(a), Math.abs(b2), Math.abs(d2)) !== r) continue;
        var L = D.cells.get(keyOf(cx + a, cy + b2, cz + d2)); if (!L) continue;
        for (var t = 0; t < L.length; t++) { var q = D.list[L[t]].r, dd = (q.x - p.x) * (q.x - p.x) + (q.y - p.y) * (q.y - p.y) + (q.z - p.z) * (q.z - p.z); if (dd < bd) { bd = dd; best = L[t]; } }
      }
      if (best >= 0 && Math.sqrt(bd) <= (r + 0.5) * c) break;
    }
    return best;
  }

  /* ── C. 적용 ─────────────────────────────────────────────────────────── */
  function activePaths() {
    try {
      if (!SP.on || !SP.apply || isOrig()) return null;
      var id = state.specAppliedId; if (!id || typeof getStyleSpec !== 'function') return null;
      var sp = getStyleSpec(id); return (sp && sp.readPaths && sp.readPaths.d) ? sp.readPaths : null;
    } catch (e) { return null; }
  }
  SP.active = activePaths;
  function placePath(src, root) {
    var q0 = src[0], dx = root.x - q0.x, dy = root.y - q0.y, dz = root.z - q0.z, dl = Math.sqrt(dx * dx + dy * dy + dz * dz);
    var keepU = SP.offKeepCm / cpu(), fadeU = SP.offFadeCm / cpu(), fr = (SP.offFadeCm > 0 && dl > keepU) ? keepU / dl : 1, acc = 0, out = new Array(src.length), k;
    for (k = 0; k < src.length; k++) {
      if (k) acc += Math.hypot(src[k].x - src[k - 1].x, src[k].y - src[k - 1].y, src[k].z - src[k - 1].z);
      var w = fr < 1 ? Math.min(1, acc / Math.max(1e-6, fadeU)) : 0; w = w * w * (3 - 2 * w);
      var f = 1 - w * (1 - fr);
      out[k] = { x: src[k].x + dx * f, y: src[k].y + dy * f, z: src[k].z + dz * f };
    }
    return out;
  }
  function adjustFromReg(s, g, rp, lenOverride, styOverride) {
    var cur = (state.sections && state.sections[s.sec]) || {}, base = rp.sty || {};
    var sty = {}; try { sty = (styOverride !== undefined ? styOverride : uniformStyling()) || stylingForRoot(s.pts[0]) || {}; } catch (e) {}
    try {
      var L0 = rp.len && typeof rp.len[s.sec] === 'number' ? rp.len[s.sec] : null, L1 = typeof lenOverride === 'number' ? lenOverride : cur.length;
      if (L0 != null && typeof L1 === 'number' && L1 !== L0) { var r = sectionLengthRatio(s.sec, L1) / (sectionLengthRatio(s.sec, L0) || 1); if (isFinite(r) && Math.abs(r - 1) > 1e-6) g = lengthStrand3D(g, r); }
    } catch (e) {}
    var curl = Math.max(0, cur.curl || 0), C0 = (rp.curl && rp.curl[s.sec]) || 0, dC = curl - C0;
    var sweep = Math.max(-100, Math.min(100, (sty.sweep || 0) - (base.sweep || 0)));
    var vol = Math.max(0, Math.min(100, 50 + ((typeof sty.volume === 'number' ? sty.volume : 50) - (typeof base.volume === 'number' ? base.volume : 50))));
    var samePart = (sty.part || 0) === (base.part || 0) && (sty.partAmt || 0) === (base.partAmt || 0);
    var part = samePart ? 0 : (sty.part || 0), partAmt = samePart ? 0 : sty.partAmt;
    try {
      if (dC > 1 && W.PHOTO_CURL && typeof W.PHOTO_CURL.activeRS === 'function' && !W.PHOTO_CURL.activeRS()) { g = curlStrand3D(g, dC, (typeof cur.wave === 'number' ? cur.wave : 50) / 100, typeof cur.curlDir === 'number' ? cur.curlDir : 0); g = gravityDroop3D(g, dC); }
      if (part || sweep) { g = partStrand3D(g, part, curl, partAmt); g = sweepStrand3D(g, sweep, curl, part, partAmt); }
      if (vol !== 50) g = volumeStrand3D(g, vol, s.sec);
      var fl = (sty.flow || 0) - (base.flow || 0); if (fl) g = flowCurlStrand3D(g, fl);
      var sl = (typeof sty.sleek === 'number' ? sty.sleek : 0) - (typeof base.sleek === 'number' ? base.sleek : 0); if (sl > 0) g = sleekStrand3D(g, sl);
    } catch (e) { if (!ST.err) ST.err = '슬라이더: ' + (e && e.message || e); }
    return g;
  }

  /* adjustStrandGeom(17b) 맨 바깥 — 등록한 스타일 길로 만든 가닥(아니면 null) */
  SP._adjust = function (s, lenOverride, styOverride) {
    if (SP.on && s && s.mannequin && s.pts && s.pts.length >= 2) {
      try {
        var rp = activePaths();
        if (rp) {
          var D = decode(rp), mem = s._spth;
          if (!mem || mem.D !== D || mem.r0 !== s.pts[0]) {
            var bi = nearest(D, s.pts[0]);
            mem = s._spth = { D: D, r0: s.pts[0], pts: bi >= 0 ? placePath(D.list[bi].p, s.pts[0]) : null };
            if (mem.pts) ST.used++; else ST.fell++;
          }
          if (mem.pts) return adjustFromReg(s, mem.pts, rp, lenOverride, styOverride);
        }
      } catch (e) { if (!ST.err) console.warn(TAG + ' 적용 실패 — 예전 경로', e); ST.err = String(e && e.message || e); }
    }
    return null;
  };
  SP._record = function (s, out) {   // adjustStrandGeom(17b) 끝 — 원본 머리를 볼 때 보이는 가닥 길 기록
    try { if (SP.on && s && s.mannequin && s.pts && isOrig()) record(s, out); } catch (e) {}   // (2026-10-13b) 길이·스타일 인자가 늘 넘어와서 예전 조건으로는 한 번도 기록이 안 됐음(진단 "기록한 칸 0")
  };

  SP._afterBuildSpec = function (spec) {   // buildSpecFromCurrent(06) 끝
    try {
      if (spec && SP.on && isOrig()) {
        var rp = exportPaths();
        if (rp && rp.n > 0) {
          spec.readPaths = rp;
          console.log(TAG + ' 원본 머리에서 등록 — 보이는 가닥 길 ' + rp.n + '개(뿌리 칸 ' + Math.round(SP.cell * cpu() * 10) / 10 + 'cm마다 하나 · 타래 자리 그대로)를 실음 · ' + ST.exportKB + 'KB');
        } else console.warn(TAG + ' 등록 — 기록된 길이 없음(원본 머리를 한 번 그린 뒤 등록하세요)');
      }
    } catch (e) { console.warn(TAG + ' 등록에 길 싣기 실패', e); }
  };

  SP._sigTail = function () {   // adjFilterSig(17b) 끝
    var s = '';
    try { var rp = activePaths(); if (rp) { s += '|sp' + rp.n + ':' + rp.d.length + ':' + SP.offKeepCm; btnSync(); } } catch (e) {}
    return s;
  };

  /* (2026-10-13f) 버튼 표시 — 스타일 길이 있는 스타일은 마네킹 뿌리 자리만 쓰고 모양은 등록한 그대로라, 걸 때 [마네킹 초기화]를 OFF로 보이게
   *  사용자: "마네킨 뿌리만 쓴다고. 그럼 상관없지. 버튼만 off로 해. 헷갈리니까" · 끄기 STYLE_PATHS.btnOff=false */
  SP.btnOff = true;
  function btnSync() {
    try {
      if (!SP.btnOff || !activePaths()) return;
      var b = document.getElementById('mannequinBtn'); if (!b) return;
      b.classList.remove('on'); if (b.textContent !== '마네킹 초기화 OFF') b.textContent = '마네킹 초기화 OFF';
      b.title = '스타일 길이 든 스타일 — 마네킹 뿌리 자리만 쓰고 모양은 등록한 그대로';
    } catch (e) {}
  }
  //   syncMannequinBtn(17a) 끝에서 STYLE_PATHS.btnSync()
  SP.btnSync = btnSync;

  SP.lines = function () {
    return [TAG + ' ' + (SP.on ? '켜짐' : '꺼짐') + ' · 기록한 칸 ' + REC.m.size + (ST.exportN ? ' · 직전 등록에 실은 길 ' + ST.exportN + '개(' + ST.exportKB + 'KB)' : '') +
      ' · 지금 걸린 스타일 길: ' + (activePaths() ? '있음 — 옮겨 쓴 가닥 ' + ST.used + ' / 못 찾아 예전 경로 ' + ST.fell : '없음(결 표 경로)') + (ST.err ? ' · ⚠ ' + ST.err : '')];
  };
  console.log(TAG + ' 설치 — 원본 머리를 스타일로 등록하면 보이는 가닥 길(타래 자리까지)을 실어 다른 손님에게 그대로 옮김. 끄기 STYLE_PATHS.on=false / .apply=false');
  return SP;
})();

/* VIEW_ALIGN (옛 65-view-align.js) — 사진 맞춤 (2026-10-11a)
 * 사용자: "3D두상 만들듯이 서로 기준점으로 보정을 해서 맞추고, 정 안맞는 곳은 해당 면의 사진영역으로 결정해야지"
 *        "이건 안면사진처럼 정확해야 하는 게 아닌 '영역'이라서 지금 렌더링이 되고 있는 영역만 정하는 거니까, 해볼만해."
 * 잰 것(진단 파일 2개): 사진 네 장이 머리 위 끝을 서로 1~2cm 다르게 잡고 있음 → 겹치면(교집합) 가장 낮은 쪽으로 깎임.
 * 하는 일: 42번이 머리를 기르기 직전, 점유 프로브의 카메라(정수리 높이 crownY · 가운데 cx · 배율 s/sy)를 정면 기준으로 맞춤.
 *   ① 머리 위 끝 높이 — 카메라가 수평이면 어느 쪽에서 봐도 머리 꼭대기는 같은 높이
 *   ② 같은 높이의 폭 — 정면 폭 = 뒤 폭(뒤 배율), 왼쪽 앞뒤 폭 = 오른쪽 앞뒤 폭(둘의 가운데로)
 *   ③ 가운데 — 정면·뒤의 가운데와 옆 사진들의 앞뒤 가운데가 같은 3D 점(머리 단면의 중심)
 *   머리 위쪽 띠(꼭대기에서 두피 반높이의 10~50%)만 씀 — 늘어진 긴 머리·어깨가 기준을 흔들지 않게.
 *   정면은 얼굴 랜드마크로 맞춘 사진이라 그대로 둠(기준).
 * 되돌리기: VIEW_ALIGN.on=false 후 VIEW_ALIGN.undo() · 상태 VIEW_ALIGN.lines()
 * 자리: 17b, STYLE_PATHS 다음. REGROW.build 맨 앞에서 VIEW_ALIGN._beforeRegrowBuild() · perfPanelLines(18) 끝 줄
 */
var VIEW_ALIGN = (function () {
  var W = window, TAG = '[사진 맞춤]';
  var VA = Object.assign({ on: false /* (2026-10-11r) 원인 찾기 결과(직모 손님 · ?t=3,6,10,11) — 끔. 다시 켜기 VIEW_ALIGN.on=true */, ref: 'front', band: [0.1, 0.5], nBand: 6, maxShiftCm: 4, kMin: 0.85, kMax: 1.15, iters: 3, minRowPx: 3 }, W.VIEW_ALIGN || {});
  var last = null;
  function cmPerUnit() { try { return (typeof modelCmPerUnit === 'function' && modelCmPerUnit()) || 16.4; } catch (e) { return 16.4; } }
  function rowExt(c, iy) {                                  // 그 줄의 머리 픽셀 가로 범위(양끝 2%를 버림)
    if (iy < 0 || iy >= c.ih) return null;
    var xs = [], x, st = Math.max(1, c.iw / 400);
    for (x = 0; x < c.iw; x += st) if (c.smp.at(x, iy) > 0) xs.push(x);
    if (xs.length < VA.minRowPx) return null;
    var a = xs[Math.floor(xs.length * 0.02)], b = xs[Math.min(xs.length - 1, Math.floor(xs.length * 0.98))];
    return [a, b];
  }
  function topRow(c) {
    var y, st = Math.max(1, c.ih / 600);
    for (y = 0; y < c.ih; y += st) { var e = rowExt(c, y); if (e && e[1] - e[0] > c.iw * 0.04) return y; }
    return null;
  }
  function med(a) { if (!a.length) return NaN; a = a.slice().sort(function (x, y) { return x - y; }); return a[a.length >> 1]; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  VA.align = function (photo, probe) {
    if (!VA.on || !probe || !probe.cams || probe._aligned === photo) return last;
    var cams = probe.cams.filter(function (c) { return c && c.smp && c.iw > 0 && c.ih > 0 && c.s > 0 && c.sy > 0 && c.R; });
    var F = cams.filter(function (c) { return c.angle === VA.ref; })[0];
    if (!F || cams.length < 2) return null;
    var yTop = photo.yTop, Es = null; try { Es = getScalpEllipsoid(); } catch (e) {}
    if (!(isFinite(yTop)) || !Es) return null;
    var cm = cmPerUnit(), rep = { at: new Date().toTimeString().slice(0, 8), views: {} };
    cams.forEach(function (c) { if (!c._al0) c._al0 = { cx: c.cx, crownY: c.crownY, s: c.s, sy: c.sy }; else { c.cx = c._al0.cx; c.crownY = c._al0.crownY; c.s = c._al0.s; c.sy = c._al0.sy; } });
    var tops = {}; cams.forEach(function (c) { tops[c.angle] = topRow(c); });
    if (tops[F.angle] == null) return null;
    var Yref = yTop - (tops[F.angle] - F.crownY) * F.sy;
    for (var it = 0; it < VA.iters; it++) {
      // ① 위 끝
      cams.forEach(function (c) { if (c === F || tops[c.angle] == null) return; c.crownY = tops[c.angle] - (yTop - Yref) / c.sy; });
      // ② ③ 띠에서 폭·가운데
      var M = {};
      cams.forEach(function (c) {
        var ws = [], ms = [], j, Y, iy, e;
        for (j = 0; j < VA.nBand; j++) {
          Y = Yref - (VA.band[0] + (VA.band[1] - VA.band[0]) * j / Math.max(1, VA.nBand - 1)) * Es.b;
          iy = c.crownY + (yTop - Y) / c.sy; e = rowExt(c, Math.round(iy)); if (!e) continue;
          var u0 = (e[0] - c.cx) * c.s, u1 = (e[1] - c.cx) * c.s; ws.push(u1 - u0); ms.push((u0 + u1) / 2);
        }
        M[c.angle] = { w: med(ws), m: med(ms), n: ws.length };
      });
      var mf = M[F.angle]; if (!mf || !(mf.n >= 2)) break;
      // 축: 그 사진의 가로축(R0)이 x쪽이면 정면·뒤 무리, z쪽이면 옆 무리
      var gx = [], gz = [];
      cams.forEach(function (c) { var m = M[c.angle]; if (!m || !(m.n >= 2)) return; (Math.abs(c.R[0]) >= Math.abs(c.R[2]) ? gx : gz).push(c); });
      // 배율: x무리는 정면 폭에, z무리는 서로의 가운데 폭에
      function setK(c, k) { var kt = clamp(c.s * k / c._al0.s, VA.kMin, VA.kMax); c.s = c._al0.s * kt; c.sy = c._al0.sy * kt; }   // 배율은 원래 값 대비 범위 안에서(되풀이해도 쌓이지 않게)
      gx.forEach(function (c) { if (c === F) return; setK(c, mf.w / M[c.angle].w); });
      if (gz.length) { var wz = 0; gz.forEach(function (c) { wz += M[c.angle].w; }); wz /= gz.length; gz.forEach(function (c) { setK(c, wz / M[c.angle].w); }); }
      // 가운데: 정면이 x를, 옆 무리(부호 맞춰)가 z를 정함 → 다른 사진은 그 점이 제 가운데에 오게 cx를 옮김
      var Cx = mf.m * F.R[0] + 0, Cz = 0;   // 정면 R0 ≈ (±1,0,0)
      if (gz.length) { var zs = gz.map(function (c) { return M[c.angle].m * (c.R[2] >= 0 ? 1 : -1); }); Cz = med(zs); }
      cams.forEach(function (c) {
        if (c === F) return; var m = M[c.angle]; if (!m || !(m.n >= 2)) return;
        var want = c.R[0] * Cx + c.R[2] * Cz, ixc = c.cx + m.m / c.s;        // 이 사진에서 지금 가운데 픽셀
        var cx2 = ixc - want / c.s, lim = VA.maxShiftCm / (c.s * cm);
        c.cx = clamp(cx2, c._al0.cx - lim, c._al0.cx + lim);
      });
    }
    cams.forEach(function (c) { if (c === F || tops[c.angle] == null) return; c.crownY = tops[c.angle] - (yTop - Yref) / c.sy; });   // 배율을 바꾼 뒤 위 끝을 한 번 더
    cams.forEach(function (c) {
      var o = c._al0, lim = VA.maxShiftCm / (c.s * cm);
      if (Math.abs(c.crownY - o.crownY) > lim) c.crownY = o.crownY + (c.crownY > o.crownY ? lim : -lim);
      rep.views[c.angle] = { dyCm: (c.crownY - o.crownY) * c.sy * cm, dxCm: (c.cx - o.cx) * c.s * cm, k: c.s / o.s, ref: c === F };
    });
    probe._aligned = photo; last = rep;
    try { console.log(VA.lines().join('\n')); } catch (e) {}
    return rep;
  };
  VA.undo = function () {
    try {
      var photo = state._hair3Dneutral, probe = (photo && photo.occ && photo.occ.probe) || (state.hairOcc3D && state.hairOcc3D.probe);
      if (!probe || !probe.cams) return false;
      probe.cams.forEach(function (c) { if (c && c._al0) { c.cx = c._al0.cx; c.crownY = c._al0.crownY; c.s = c._al0.s; c.sy = c._al0.sy; } });
      probe._aligned = null; last = null; return true;
    } catch (e) { return false; }
  };
  VA.lines = function () {
    if (!last) return [TAG + ' ' + (VA.on ? '아직 안 맞춤' : '꺼짐')];
    var L = [TAG + ' ' + last.at + ' · 정면 기준(머리 위 끝 · 위쪽 띠의 폭 · 가운데) — 사진마다 옮긴 양'];
    Object.keys(last.views).forEach(function (a) { var v = last.views[a]; L.push('   ' + a + (v.ref ? ' (기준)' : '') + ' — 높이 ' + (v.dyCm >= 0 ? '+' : '') + v.dyCm.toFixed(2) + 'cm · 가로 ' + (v.dxCm >= 0 ? '+' : '') + v.dxCm.toFixed(2) + 'cm · 배율 ×' + v.k.toFixed(3)); });
    L.push('   되돌리기 VIEW_ALIGN.on=false; VIEW_ALIGN.undo() 후 다시 기르기');
    return L;
  };
  VA.status = function () { return last; };
  // 42번이 기르기 직전에
  VA._beforeRegrowBuild = function () {   // REGROW.build(17b) 맨 앞
    try { var photo = state._hair3Dneutral, probe = (photo && photo.occ && photo.occ.probe) || (state.hairOcc3D && state.hairOcc3D.probe); if (photo && probe) VA.align(photo, probe); } catch (e) { console.warn(TAG + ' 실패 — 맞추지 않고 진행', e); }
  };
  console.log(TAG + ' 설치 — 다시 기르기 직전에 옆·뒤 사진을 정면 기준으로 맞춤(머리 위 끝 · 폭 · 가운데) · 끄기 VIEW_ALIGN.on=false · 상태 VIEW_ALIGN.lines().join("\\n")');
  return VA;
})();

/* ══════════════════════════════════════════════════════════════════
   조정 결과 캐시 — <b>뷰만 바꿨는데 전부 다시 계산</b>하던 것 (2026-08-22)
   ─────────────────────────────────────────────────────────────────
   Front → Left를 누르면 섹션값도 스타일링도 그대로다. 바뀐 건 카메라뿐이다.
   그런데 여기서 커트·컬·처짐·가르마·넘김·볼륨·결흐름을 <b>처음부터</b> 다시
   돌린다. 실기기 녹화에서 뷰 전환 한 번에 4초 안팎이 얼었고(3.4~4.6초),
   120초 중 83초가 정지였다.
   그래서 <b>입력이 같으면 지난 결과를 그대로 준다</b>. 입력이란 이 함수가 실제로
   읽는 것 전부다 — 모델 개체, 섹션 파라미터, 뷰별 스타일링, 시술 전 초기화,
   빗질 격자, 마네킹 여부, 솎기 간격, 뷰 필터. 하나라도 다르면 다시 계산한다.

   ── 왜 서명을 <b>손으로</b> 적는가 ───────────────────────────────────
   JSON.stringify(state)로 뭉뚱그리면 렌더와 무관한 필드가 바뀔 때마다 캐시가
   깨지고(=효과 없음), 반대로 이 함수가 읽는 값이 state 밖에 생기면 조용히
   낡은 결과를 준다(=버그). 읽는 것을 <b>여기 한 곳에</b> 적어 두면, 나중에
   연산자가 새 값을 읽게 될 때 이 목록도 같이 고치게 된다.
   ⚠ 콘솔에서 CUT3D·CURL3D 같은 <b>상수</b>를 직접 만졌다면 서명이 안 바뀐다.
     그때는 ADJ_CACHE.bump()를 부르면 된다.
   되돌리기: ADJ_CACHE.on = false (항상 새로 계산 — 예전 동작) */
/* max=3인 이유: 이 캐시를 쓰는 소비자가 셋이다(조정화면 투영 · 미니3D 썸네일 ·
   3D 결과보기). 각자 solid stride가 다르니 서명도 다르고, 3보다 작게 잡으면
   화면을 오갈 때마다 서로를 밀어내며 전부 다시 계산한다.
   ── 그런데 실기기에서 이게 <b>43MB</b>였다 (2026-08-23) ──────────────────
   점 하나가 {x,y,z} 객체라 V8에서 대략 48바이트다. 3벌 × 30만 점이면 그 값이
   나온다. 4GB 폰에서는 이게 JS힙 141MB 안에서 제일 큰 단일 덩어리다.
   저사양에서는 2로 줄인다 — 미니3D 썸네일 벌이 먼저 밀려나는데, 그건 172×222
   썸네일이라 다시 계산해도 제일 싸다(MINI3D.maxStrands로 이미 솎여 있다).
   ⚠ 근본 해법은 점을 Float32Array로 담는 것이다(같은 점이 12바이트 → 1/4).
     그건 이 배열을 읽는 모든 소비자를 같이 고쳐야 해서 별도 작업으로 남긴다.
   되돌리기: ADJ_CACHE.max = 3 (또는 MOBILE_PERF.lowMem = false) */
/* ══════════════════════════════════════════════════════════════════
   캐시를 <b>기하</b>와 <b>필터</b> 두 단으로 가른다 (2026-08-23 2차)
   ─────────────────────────────────────────────────────────────────
   실기기 재측정: Adjust캐시 <b>56%적중</b>. 절반 가까이가 미스인데,
   205초 녹화에서 유일하게 남은 1.7초 정지가 <b>Density 슬라이더 드래그</b>였고
   그 앞 빌드에서 탭이 죽은 자리도 같은 조작이었다.
   이유는 서명에 있었다 — density가 서명 안에 있으니 드래그 틱마다 <b>100% 미스</b>다.

   ── 그런데 density는 기하를 안 건드린다 ──────────────────────────
   이 함수 안에서 density가 하는 일은 이것 하나뿐이다:
       if(sec.density < 100 && _cutHash01(st) > sec.density/100) continue;
   <b>순수한 부분집합 선택</b>이고, 판정값 _cutHash01(st)은 st.pts[0](중립 모델의
   뿌리)만 읽는다 — 조정을 아무리 해도 안 변한다. adjustStrandGeom(①~⑦)은
   density를 <b>한 번도 안 읽는다</b>(확인: 이 파일에서 sec.density를 읽는 곳은
   위 한 줄과 서명뿐).
   sec.color도 같다 — out.push의 color/colors 필드에만 들어간다.

   그래서 두 단으로 가른다:
     ① 기하 단  — 서명에서 density·color를 <b>뺀다</b>. 항상 density=100으로
                  (=안 솎고) 전량 계산해 캐시한다. 무거운 쪽은 전부 여기다.
     ② 필터 단  — 캐시된 기하에 해시컷 + 색을 씌워 돌려준다. 점을 하나도
                  안 만든다(가닥 수만큼의 겉포장 개체뿐).
   Density·Color 슬라이더는 이제 ②만 돈다.

   ⚠ <b>솎기(stride) 다음, 밀도컷 앞</b>이라는 순서를 반드시 지킨다. 예전 루프가
     정확히 그 순서였고(누산기 → 밀도컷), 필터가 같은 순서로 같은 해시를 보므로
     결과 배열은 <b>가닥 단위로 예전과 동일</b>하다. 순서를 뒤집으면 남는 가닥이
     달라져 화면이 바뀐다.
   ⚠ 기하 캐시는 density<100일 때 예전보다 <b>더 많은</b> 점을 쥔다(안 솎은 전량).
     대신 드래그 중 재계산이 사라진다 — 가만히 있는 메모리가 프레임마다 잡았다
     버리는 것보다 폰에 순하다는 것이 8/23 1차의 결론이었다.
   ⚠ <b>앞으로 density나 color를 기하 쪽에서 읽게 되면</b> 그 손잡이는 조용히
     안 먹는다(서명이 못 본다). 그때는 아래 GEO_KEYS에 도로 넣어야 한다 —
     이 파일이 반복해서 당한 "서명이 못 보는 값" 그 자리다.
   되돌리기: ADJ_CACHE.split = false (서명에 density·color를 도로 넣고
             밀도컷을 루프 안에서 한다 = 예전 동작)
══════════════════════════════════════════════════════════════════ */
/* 기하 서명이 보는 섹션 손잡이 — density·color는 <b>일부러</b> 빠져 있다(위 주석).
   손으로 적지 않고 목록으로 두는 이유는 STYLING_KEYS와 같다: 손잡이가 늘 때
   여기 한 곳만 보면 되게. */
const ADJ_GEO_SECTION_KEYS = ['length','technique','elevation','texture',
                              'curl','wave','curlDir','line','overdirection'];
/* 필터 단이 보는 손잡이 — 기하 서명에서 뺀 것이 <b>정확히</b> 여기 들어 있어야
   한다. 둘을 합치면 예전 서명의 섹션 손잡이 11개가 된다. */
const ADJ_FILTER_SECTION_KEYS = ['density','color'];
const ADJ_CACHE = { on: true, max: 3, hits: 0, misses: 0, gen: 0,
                    fhits: 0, fmisses: 0, _lru: [], _map: new Map(), _split: true };
/* (2026-08-23 5차) 저사양이면 max=2로 줄이던 것을 <b>되돌린다</b>.
   그 판단은 2단 분리 <b>전</b>의 것이다 — 그때는 한 벌이 43MB였다. 분리 뒤
   기하 한 벌은 실측 5~21MB이고, 대신 소비자가 셋이다(조정화면·미니3D·3D결과).
   카메라 사진 실측에서 미니3D를 켜자 적중률이 <b>67% → 29%</b>로 떨어졌다 —
   두 칸을 셋이 놓고 서로 밀어낸 것이다. 적중률이 반토막 나면 기하를 매번 다시
   도는 것이라, 10MB 더 쥐는 것보다 CPU와 할당 churn이 훨씬 비싸다.
   되돌리기: ADJ_CACHE.max = 2 (또는 아래 줄을 원복) */
try{ if(isLowMemDevice()) ADJ_CACHE.max = 3; }catch(e){}
/* 필터 memo는 기하 배열에 붙어 있으므로(_adjApplyFilter) _map만 비우면 같이 간다. */
ADJ_CACHE.bump = function(){ this.gen++; this._lru.length = 0; this._map.clear(); };
/* split을 <b>콘솔에서 바꾸면 캐시를 스스로 비운다</b>.
   이 스위치는 A/B로 켰다 껐다 하라고 둔 것인데, 두 모드는 캐시에 담기는 항목의
   <b>모양이 다르다</b>(기하 단은 srcColor·h를, 예전 단은 color·colors를 싣는다).
   그냥 대입만 되게 두면 켠 직후 첫 프레임이 <b>지난 모드의 항목</b>을 꺼내 읽고,
   h가 undefined라 밀도컷이 통째로 안 먹거나 색이 사라진다 — 스위치를 만들어 놓고
   그 스위치가 버그를 만드는 자리다. 대입 시점에 비우면 그 창이 없다. */
try{
  Object.defineProperty(ADJ_CACHE, 'split', {
    get(){ return this._split; },
    set(v){ v = !!v; if(v !== this._split){ this._split = v; this.bump(); } },
    enumerable: true, configurable: true
  });
}catch(e){ ADJ_CACHE.split = ADJ_CACHE._split; }   // 못 걸면 예전처럼 평범한 필드
function adjCacheSig(model, srcAngleFilter, stp){
  const secs = [];
  const KEYS = ADJ_CACHE.split
    ? ADJ_GEO_SECTION_KEYS
    : ADJ_GEO_SECTION_KEYS.concat(ADJ_FILTER_SECTION_KEYS);
  for(const id of SECTION_ORDER){
    const s = (state.sections && state.sections[id]) || {};
    secs.push(id + ':' + KEYS.map(k=>s[k]).join('/'));
  }
  /* 스타일링 키는 <b>STYLING_KEYS에서 받아온다</b> — 여기에 손으로 적어 두면
     파라미터가 하나 늘 때 이 목록만 안 늘어나서 캐시가 그 값을 못 보게 된다.
     stylingByView가 아직 없을 때 uniformStyling이 보는 state.styling도 같이 본다. */
  const sty = [];
  for(const a of ANGLES){
    const v = (state.stylingByView && state.stylingByView[a]) || {};
    sty.push(a + ':' + STYLING_KEYS.map(k=>v[k]).join('/'));
  }
  {
    const v = state.styling || {};
    sty.push('*:' + STYLING_KEYS.map(k=>v[k]).join('/'));
  }
  /* 염색 설정(2026-09-02) — _adjApplyFilter가 조각색을 LUT로 굽게 됐으므로
     <b>결과를 바꾸는 새 입력</b>이다. 안 넣으면 HAIR_DYE를 만져도 지난 결과가
     나온다 = 조용히 안 먹는 손잡이. 섹션 color는 위 KEYS에 이미 들어 있다.
     여기서도 <b>DYE_KEYS를 순회</b>한다(손으로 적으면 값이 늘 때 안 따라온다). */
  sty.push('dye:' + (HAIR_DYE.on ? DYE_KEYS.map(k=>HAIR_DYE[k]).join('/') : 'off'));
  /* 페이드(2026-08-23 7차) — cutRatioForStrand가 <b>새로 읽는 값</b>이라 반드시
     여기 들어와야 한다. 안 넣으면 페이드 슬라이더를 돌려도 캐시가 지난 결과를
     그대로 준다 = 손잡이가 조용히 안 먹는다. 이 파일이 반복해서 당한 자리다.
     기하 서명에 넣는 이유: 페이드는 <b>길이</b>를 바꾸므로 기하다(density처럼
     필터로 뺄 수 없다). */
  const fd = state.fade || {};
  const fadeSig = (fd.enabled ? 1 : 0) + '/' + fd.guard + '/' + fd.height + '/' + fd.blendWidth
                + '/' + (FADE3D.on ? 1 : 0)
                /* (2026-08-26) 디스커넥션·테이퍼도 cutRatioForStrand가 <b>읽는 값</b>이다.
                   위 페이드 주석의 이유가 그대로 여기에도 걸린다 — 안 넣으면 프리셋을
                   눌러도 지난 결과가 나온다. 하네스가 이 서명을 따로 검사한다. */
                + '/' + (fd.disc || 0) + '/' + (fd.taper || 0) + '/' + (DISC3D.on ? 1 : 0);
  return [ADJ_CACHE.gen, model._gid || (model._gid = ++_canvasGidSeq),
          model.mannequin ? 1 : 0, fadeSig,
          srcAngleFilter || '*', (+stp).toFixed(4),
          BASE_RESET.straighten,
          /* 빗질은 <b>획 수</b>로 본다 — 획이 늘거나(combSplat) 지워지면(combClear
             strokes.length=0) 반드시 바뀌는 값이라 따로 세대 변수를 안 둬도 된다.
             maxDisp도 같이 본다(같은 획 수에서 세기만 달라지는 경우). */
          (typeof COMB !== 'undefined' && COMB.grid)
            ? (COMB.strokes.length + ':' + (COMB.maxDisp||0).toFixed(4)) : 0,
          HAIR_OCC3D.clipAdjusted ? 1 : 0, HAIR_OCC3D.moveGrow ? 1 : 0,
          CUT3D.on ? 1 : 0,
          /* 조각(2026-08-29) — adjustStrandGeom이 <b>새로 읽는 값</b>이라 반드시
             여기 들어와야 한다. 조각은 길이를 바꾸므로 <b>기하</b> 쪽이다
             (density처럼 필터로 뺄 수 없다). 조각 0개면 '0' 한 글자라 예전
             서명과 사실상 같다. */
          piecesSig()]
         .concat(secs).concat(sty).join('|');
}
/* 필터 단의 서명 — 기하 서명에서 <b>뺀 것만</b> 본다. 여기 목록이 위 기하
   서명과 겹치면 두 단이 같은 값을 두 번 보게 되고(무해하지만 헷갈린다),
   반대로 어느 쪽에도 없으면 그 손잡이는 <b>조용히 안 먹는다</b>.
   ※ 필터가 읽는 것이 전부다: 밀도컷(density)과 색 결정(color). */
function adjFilterSig(){
  const out = [];
  for(const id of SECTION_ORDER){
    const s = (state.sections && state.sections[id]) || {};
    out.push(id + ':' + ADJ_FILTER_SECTION_KEYS.map(k=>s[k]).join('/'));
  }
  let sig = out.join('|');
  sig += STRAND_BUDGET._sigTail();   // (옛 48) 조정 화면 가닥 수 꼬리표
  sig += SHOULDER._sigTail();        // (옛 50) 어깨 재기 판
  sig += COMB3D._sigTail();          // (옛 53) 빗질 판
  sig += FLY_TRIM._sigTail();        // (옛 55) 잔머리 정리 판·곱슬 여부
  sig += FLOW_SPEC._sigTail();       // (옛 59) 결 표
  sig += PHOTO_CHECK._sigTail();     // (옛 60) 원본 대조
  sig += PHOTO_CURL._sigTail();      // (옛 61) 사진 컬 모양
  sig += READ_SHAPE._sigTail();      // (옛 68) 읽은 모양
  sig += STYLE_PATHS._sigTail();     // (옛 69) 스타일 길
  sig += SEG_ORIENT._sigTail();      // (옛 64) 페이드 원본 머리에도
  return sig;
}
/* 캐시가 쥐고 있는 대략의 크기 — 폰에서 이 값과 JS힙을 같이 보라고 찍는다.
   점 하나가 {x,y,z} 객체라 V8에서 대략 48바이트로 잡는다(정확한 값이 아니라
   자릿수를 보려는 것이다 — 그래서 '≈'로 적는다).
   ※ 2단 분리 뒤로는 _map이 <b>기하</b>를 쥔다(밀도컷 전 전량). 필터 결과는
     같은 pts 배열을 가리키는 겉포장뿐이라 여기 안 센다 — 겹쳐 세면 실제보다
     크게 나온다. */
function adjCacheMB(){
  let pts = 0;
  ADJ_CACHE._map.forEach(v=>{ for(const st of v) pts += st.pts.length; });
  return pts * 48 / 1048576;
}
function adjCacheLine(){
  const t = ADJ_CACHE.hits + ADJ_CACHE.misses;
  const ft = ADJ_CACHE.fhits + ADJ_CACHE.fmisses;
  return '조정캐시 ' + (ADJ_CACHE.on
    ? (t ? Math.round(ADJ_CACHE.hits/t*100) : 0) + '%적중 ' + ADJ_CACHE._map.size + '벌 ≈'
      + adjCacheMB().toFixed(0) + 'MB'
      /* 필터 적중률을 <b>따로</b> 찍는다. 합쳐 놓으면 "기하가 잘 맞는 건지
         밀도 슬라이더만 잘 맞는 건지"를 못 가른다 — 8/23에 "재는 자가 틀렸다"로
         두 번 헛짚은 자리라 여기서는 처음부터 나눠 둔다. */
      + (ADJ_CACHE.split ? ' · 필터 ' + (ft ? Math.round(ADJ_CACHE.fhits/ft*100) : 0) + '%' : ' · 분리OFF')
    : 'OFF');
}
/* ── ② 필터 단 ────────────────────────────────────────────────────
   기하 단이 준 배열에 <b>밀도컷 + 색</b>만 씌운다. 점을 하나도 안 만들고
   pts 배열은 기하 캐시의 것을 <b>그대로 가리킨다</b>(복사하지 않는다).
   ⚠ 그래서 소비자가 pts를 제자리에서 고치면 안 된다 — 이건 새 제약이 아니다.
     예전에도 캐시 적중이면 같은 배열을 돌려줬고, 확인해 보면 소비자 일곱 곳이
     전부 새 배열(cp·q·positions)에 담아 쓴다(2026-08-23 확인).
   같은 서명이면 <b>같은 배열 개체</b>를 돌려준다 — 겉포장 개체 4천 개도
   프레임마다 새로 만들면 아까우니 한 벌만 memo한다. */
function _adjApplyFilter(geo){
  if(!geo) return geo;
  if(!ADJ_CACHE.split) return geo;                 // 되돌리기: 기하 단이 이미 다 했다
  let fsig = null;
  try{ fsig = adjFilterSig(); }catch(e){ fsig = null; }
  /* memo를 ADJ_CACHE에 한 칸 두지 않고 <b>기하 배열 자체에</b> 붙인다.
     소비자마다 stride가 달라 기하도 여러 벌인데(조정화면·미니3D·3D결과),
     한 칸이면 화면을 오가며 서로 밀어낸다 — max=3을 그 이유로 잡아 둔 것과
     같은 사정이다. 붙여 두면 기하가 LRU에서 밀려날 때 memo도 같이 사라진다. */
  if(fsig && geo._fsig === fsig && geo._fout){
    ADJ_CACHE.fhits++;
    return geo._fout;
  }
  if(fsig) ADJ_CACHE.fmisses++;
  const out = [];
  for(const g of geo){
    const sec = (state.sections && state.sections[g.sec]) || {};
    /* ⓪ 숱치기 — 예전 루프에서 <b>솎기 다음, 기하 앞</b>에 있던 그 판정을
       여기로 옮긴 것이다. geo는 이미 솎인 뒤의 배열이고 순서도 같으므로,
       같은 해시에 같은 임계값을 걸면 남는 가닥이 예전과 <b>동일</b>하다. */
    if(typeof sec.density === 'number' && sec.density < 100
       && g.h > Math.max(0, sec.density) / 100) continue;
    /* ⑩⑪ 섹션 컬러 — 미용사가 명시한 섹션 컬러가 실측색보다 앞선다(예전과 같은
       우선순위). 염색은 사진 색을 덮는 게 목적이라 조각색은 버린다. */
    /* ── (2026-09-02) 염색해도 <b>조각색을 안 버린다</b> ──────────────────
       예전엔 `colors: sec.color ? null : srcColors` 였다. 염색이 걸리는 순간
       뿌리 어두움·광택 띠·끝 밝음이 통째로 사라져 <b>색연필로 칠한</b> 머리가
       됐다(2026-08-17에 애써 넣은 실측 명암이 바로 그것이다).
       이제 조각색은 <b>밝기 구조의 재료</b>로 그대로 싣고, 색은 dye가 정한다 —
       sampleProjectedStrandColors가 LUT로 바꾼다(HAIR_DYE 배너).
       ⚠ 되쏘기가 없는 경로(reproject=false)를 위해 여기서도 굽는다 — 안 그러면
         그 경로만 사진 색이 그대로 나와 두 화면이 갈린다. */
    const _dye = sec.color || null;
    let _cols = g.srcColors || null;
    if(_dye && _cols && HAIR_DYE.on){
      const lut = dyeLUTFor(_dye, _adjRefColorFor(g.srcAngle));
      if(lut){
        _cols = _cols.map(cs=>{
          const c = cssToRGB(cs);
          return c ? lut[dyeIndexOf(c.r, c.g, c.b)] : cs;
        });
      }
    }
    out.push({ pts: g.pts, color: _dye || g.srcColor, sec: g.sec,
               srcAngle: g.srcAngle, dye: _dye,
               colors: (_dye && !HAIR_DYE.on) ? null : _cols });
  }
  if(fsig){ geo._fsig = fsig; geo._fout = out; }
  return out;
}
/* 염색 LUT의 <b>기준 밝기</b>로 쓸 그 뷰의 실측 평균 헤어색.
   새로 재지 않는다 — measureHairColorsFromMask가 이미 뷰마다 넣어 둔 값이다. */
function _adjRefColorFor(angle){
  const mi = state.hairMasks && state.hairMasks[angle];
  if(mi && mi.avgHairColor) return mi.avgHairColor;
  for(const a in (state.hairMasks||{})){
    const m = state.hairMasks[a];
    if(m && m.avgHairColor) return m.avgHairColor;
  }
  return null;
}
/* ==========================================================================
 * STRAND_BUDGET (옛 48-strand-budget.js) — 가닥 수: 3D 결과 화면 3만 · 조정 화면 1만 (앞머리는 전부)
 *
 * 자리: 17b, computeAdjustedHair3DStrands 바로 앞. computeAdjustedHair3DStrands가 조정 화면 전체 요청이면 고른 가닥만(_adjComputeCore에 간격) · adjFilterSig 끝에 꼬리표 · perfPanelLines(18) 끝 줄
 *
 * 왜 (2026-10-04 사용자):
 *   "3D 결과보기는 3만 가닥 수준, 조정 화면은 줄여서."
 *   (2026-10-04e) "조정이 오래 걸린다 → 1만 가닥으로. 프론트 쪽에서는 빼지 말고 사이드와 뒷머리 쪽에서 골고루."
 *
 * 무엇을:
 *   ① 머리 모델(다시 기른 원본 머리 · 마네킹 둘 다)을 STRAND_BUDGET.total(30,000)가닥으로 심습니다.
 *      — 42-regrow.js와 17a-mannequin.js의 "심을 가닥 수" 한 줄이 이 값을 읽습니다.
 *        (사진에 머리가 없는 자리의 뿌리는 안 심으므로 실제 수는 2~3% 적게 나옵니다.)
 *   ② 조정 화면에서는 그중 STRAND_BUDGET.adjust(10,000)가닥만 그립니다. 3D 결과 화면은 전부.
 *      · keepAll 섹션(앞머리 front · 관자놀이 temple — 얼굴 둘레)은 한 가닥도 안 뺍니다.
 *      · 나머지(정수리·옆·뒤·목덜미)에서 남은 수만큼 일정 간격으로 고르게 뽑습니다.
 *      · "전체 가닥" 요청(인자 없는 computeAdjustedHair3DStrands())에만 걸립니다.
 *        간격을 직접 정해 부르는 곳(진단·치수 재기·2D)은 그대로입니다.
 *   ③ (2026-10-04e) 느렸던 진짜 이유 — 값이 바뀔 때마다 28번의 "미리 계산"이 화면에 안 그리는 가닥까지
 *      모델 전체(3만)를 다시 계산하고 있었습니다(진단: adjustStrandGeom 240,000회 = 8번 × 30,000).
 *      28번이 이 파일의 maskFor()를 읽어 조정 화면에서는 고른 가닥만 계산합니다.
 *   ④ 37번의 "미리 만든 3D 헤어"가 두 화면 사이에서 섞이지 않게 서명에 화면별 꼬리표를 붙입니다.
 *
 * 바꾸기: STRAND_BUDGET.total / .adjust / .keepAll 을 고친 뒤 STRAND_BUDGET.refresh()
 * 끄기:   STRAND_BUDGET.on=false; STRAND_BUDGET.refresh()   (예전처럼 사진 가닥 수 · 두 화면 같은 수)
 * ========================================================================== */
var STRAND_BUDGET = (function () {
  'use strict';
  var W = window, TAG = '[가닥 수]';
  /* (2026-10-04g) 고사양 폰은 조정 화면도 25,000가닥 — 사용자: "고사양폰은 한 2만5천 가닥 해도 상관없겠다."
     고사양 = 기기 메모리 8GB 이상(크롬이 알려 주는 최댓값) · 메모리를 안 알려 주는 브라우저(아이폰 등)는 코어 6개 이상이고 저사양 판정이 아니면. */
  function highEnd() {
    try {
      if (typeof isLowMemDevice === 'function' && isLowMemDevice()) return false;
      var dm = navigator.deviceMemory, hc = navigator.hardwareConcurrency || 0;
      if (typeof dm === 'number' && dm > 0) return dm >= 8;
      return hc >= 6;
    } catch (e) { return false; }
  }
  var B = Object.assign({ on: true, total: 30000, adjustLow: 10000, adjustHigh: 20000,   // (2026-10-12n) 조정 화면만 다시 줄임(마네킹 켜고 끌 때마다 전부 다시 계산 · 폰에서 꺼짐) — 3D 결과 화면은 total 3만 그대로 · 예전(오전) 30000/30000   // (2026-10-12) 사용자: "원래 수준대로 3만 가닥 가까이" — 조정 화면도 줄이지 않음(예전 10000 / 25000)
  keepAll: ['front', 'temple'] }, W.STRAND_BUDGET || {});
  B.highEnd = highEnd();
  if (!(B.adjust > 0)) B.adjust = B.highEnd ? B.adjustHigh : B.adjustLow;
  var S = B.stats = { lastAdjust: 0, lastFull: 0, bySec: null };

  function scr() { try { return currentScreen; } catch (e) { return ''; } }
  function model() { try { var m = state.hair3Dneutral; return m && m.strands ? m : null; } catch (e) { return null; } }

  /* 조정 화면에서 그릴 가닥 표. 돌려주는 값 { key, keep(Uint8Array), n } · 줄일 필요가 없으면 null */
  var maskMemo = new WeakMap();
  function buildMask(m) {
    var st = m.strands, n = st.length, keepAll = {}, i, kept = 0, rest = 0;
    (B.keepAll || []).forEach(function (k) { keepAll[k] = 1; });
    var keep = new Uint8Array(n);
    for (i = 0; i < n; i++) { if (keepAll[st[i].sec]) { keep[i] = 1; kept++; } else rest++; }
    var want = Math.max(0, B.adjust - kept);                       // 나머지에서 뽑을 수
    if (rest > 0 && want > 0) {
      var step = Math.max(1, rest / want), acc = 0;
      for (i = 0; i < n; i++) {
        if (keep[i]) continue;
        acc += 1 / step;
        if (acc >= 1) { acc -= 1; keep[i] = 1; kept++; }
      }
    }
    var by = {};
    for (i = 0; i < n; i++) { var sec = st[i].sec || '?', b = by[sec] || (by[sec] = [0, 0]); b[1]++; if (keep[i]) b[0]++; }
    S.bySec = by;
    return keep;
  }
  B.maskFor = function (m) {
    if (B.forceFull) return null;                                  // 37번이 조정 화면에서 3D 결과 화면용 완성본을 뒤에서 만드는 중
    if (!B.on || scr() !== 'adjust' || !(B.adjust > 0) || !m || !m.strands) return null;
    var n = m.strands.length;
    if (n <= B.adjust) return null;
    var key = n + ':' + B.adjust + ':' + (B.keepAll || []).join(',');
    var e = maskMemo.get(m);
    if (!e || e.key !== key || e.arr !== m.strands) { e = { key: key, keep: buildMask(m), n: 0, arr: m.strands }; for (var i = 0; i < n; i++) e.n += e.keep[i]; maskMemo.set(m, e); }
    return e;
  };
  /* 캐시 열쇠로 쓰는 간격 값(1 = 전부) */
  function adjustStride() {
    var m = model(), e = m ? B.maskFor(m) : null;
    return e && e.n > 0 ? m.strands.length / e.n : 1;
  }
  B.stride = adjustStride;

  // ② 전체 가닥 요청에만 — computeAdjustedHair3DStrands(17b) 맨 앞에서 부름. 돌려주는 값이 undefined면 원래대로 계산
  B._compute = function (view, stride) {
    var k = adjustStride(), out;
    if (k > 1) {
      var save = B._inFull; B._inFull = true;                    // 28번 _adjGeometry가 이 표시를 보고 고른 가닥만 계산
      try { out = _adjComputeCore(null, k); } finally { B._inFull = save; }
      if (out && out.length) S.lastAdjust = out.length;
      return out;
    }
    out = _adjComputeCore(view, stride);
    if (out && out.length) { if (scr() === 'adjust' && !B.forceFull) S.lastAdjust = out.length; else S.lastFull = out.length; }
    return out;
  };
  // ④ 화면별 꼬리표 — adjFilterSig(17b) 끝에서 부름
  B._sigTail = function () { var m = model(), e = m ? B.maskFor(m) : null; return e ? '|n' + e.key : ''; };

  /* 값을 바꾼 뒤: 모델을 다시 만들게 하고 다시 그림 */
  B.refresh = function () {
    maskMemo = new WeakMap();
    try { if (typeof ADJ_CACHE !== 'undefined' && ADJ_CACHE.bump) ADJ_CACHE.bump(); } catch (e) {}
    try {
      var photo = state._hair3Dneutral, m = model();
      if (photo && m && Math.abs(m.strands.length - B.total) > B.total * 0.06) state.hair3Dneutral = photo;   // 모델 가닥 수가 목표와 다를 때만 다시 심음
    } catch (e) {}
    try { if (W.REGROW) { W.REGROW.base = null; if (typeof W.REGROW.sync === 'function' && scr() === 'adjust') W.REGROW.sync(); } } catch (e) {}
    try { if (typeof renderAdjustFrame === 'function') renderAdjustFrame(); } catch (e) {}
    return { total: B.total, adjust: B.adjust, keepAll: B.keepAll, on: B.on };
  };

  B._panelLine = function () {   // perfPanelLines(18) 끝
    var m = model(), n = m ? m.strands.length : 0, by = S.bySec, parts = [];
    if (by) Object.keys(by).forEach(function (k) { parts.push(k + ' ' + by[k][0] + '/' + by[k][1]); });
    return TAG + ' ' + (B.on ? '켜짐' : '꺼짐') + ' · 목표: 모델 ' + B.total + ' / 조정 화면 ' + B.adjust + (B.highEnd ? '(고사양)' : '(저사양)') + ' (전부 남기는 섹션: ' + ((B.keepAll || []).join(',') || '없음') + ')' +
      ' · 지금 모델 ' + n + '가닥' + (m && m.mannequin ? '(마네킹)' : m && m.regrown ? '(다시 기른 머리)' : '(사진 가닥)') +
      ' · 직전에 그린 수 — 조정 화면 ' + (S.lastAdjust || '—') + ' · 3D 결과 화면 ' + (S.lastFull || '—') +
      (parts.length ? '\n  조정 화면에 남긴 가닥(남김/전체): ' + parts.join(' · ') : '');
  };

  console.log(TAG + ' 설치 — 모델 ' + B.total + '가닥 · 조정 화면은 ' + B.adjust + '가닥(' + (B.keepAll || []).join('·') + '은 전부, 나머지에서 고르게). 바꾸기 STRAND_BUDGET.total / .adjust / .keepAll 후 STRAND_BUDGET.refresh()');
  return B;
})();

/* ══ 조정 결과 가닥 — 바깥 단계 ══
   예전 기능 파일(48~)이 이 함수를 감싸던 순서 그대로 단계로 둔다(위가 바깥). 기본 계산은 아래 _adjComputeCore. */
function computeAdjustedHair3DStrands(srcAngleFilter, stride){
  const _cbT0 = COMB3D._beforeCompute();   // (옛 53) 빗질 통계 비움·모델 바뀌면 빗질 지움
  // (옛 48 가닥 수) 조정 화면 전체 요청이면 정해 둔 수만큼만 — 위 STRAND_BUDGET
  let out = (!srcAngleFilter && stride == null) ? STRAND_BUDGET._compute(srcAngleFilter, stride) : _adjComputeCore(srcAngleFilter, stride);
  // (옛 50 어깨) 몸통 안으로 들어간 점을 어깨·등 면에 얹음 — 13a SHOULDER
  out = riseFixAll(out);   // (2026-10-13i) 하늘로 솟은 뒷머리를 늘어뜨림(17a RISE_FIX) — 어깨 처리 전에
  out = SHOULDER._apply(out);
  out = (typeof tipFlareAll === 'function' ? tipFlareAll(out) : out);   // (2026-10-18 배포본) 17a 끝 벌어짐
  // (2026-10-13) 원본 머리에서 얼굴 앞을 가로지르는 가닥을 옆으로 비킴(17a FACE_CLEAR)
  out = faceClearAll(out);
  // (옛 53) 빗질이 있는데 머리 모양이 바뀌었으면 결을 다시 읽어 둠 · 통계(17a COMB3D)
  COMB3D._afterCompute(out, srcAngleFilter, stride, _cbT0);
  // (옛 55 잔머리 정리) 곱슬이면 몸통에서 벗어난 잔머리 꼬리를 자름(17a FLY_TRIM)
  out = FLY_TRIM._apply(out);
  FLOW_SPEC._afterCompute();   // (옛 59) 걸고 난 뒤 처음 다 만든 자리에서 한 줄
  out = PHOTO_CHECK._apply(out); // (옛 60) 원본 대조 — 결 맞추기·윤곽 밖 잘라내기(07b)
  return out;
}
/* 기본 계산: 기하(캐시) → 필터 → 기능 마감 단계들 */
function _adjComputeCore(srcAngleFilter, stride){
  // (옛 37 폰 다이어트 ③-a) 상태가 바뀌었으면 옛 상태의 조정 캐시를 그 자리에서 버림
  if(typeof MOBILE_DIET !== 'undefined') MOBILE_DIET.pruneNow();
  let out = _adjApplyFilter(_adjGeometry(srcAngleFilter, stride));
  // (2026-10-01 · 옛 31) 스타일 적용 후 첫 최종 결과에서 한 번 — 얼굴을 덮는 섹션을 센다(자르지 않음 · 17a faceCoverCheck)
  faceCoverCheck(out);
  // (옛 32) 땋기(BRAID.on)일 때 가닥 끝을 가르마 바깥으로 늘어뜨림 — 새 배열(캐시 공유 안전 · 21 braidDrapeAll)
  if(typeof braidDrapeAll === 'function') out = braidDrapeAll(out);
  // (옛 36) 광택·웨이브 마감 — gloss 있는 스타일만(09 glossWaveAll). 37 폰 다이어트가 가닥 단위로 직접 다듬을 땐 건너뜀(_defer)
  out = glossWaveAll(out);
  return out;
}
/* ── ① 기하 단 ──────────────────────────────────────────────────── */
function _adjGeometry(srcAngleFilter, stride){
  const model = state.hair3Dneutral;
  if(!model || !model.strands) return null;
  let _sig = null;
  if(ADJ_CACHE.on){
    try{
      _sig = adjCacheSig(model, srcAngleFilter, Math.max(1, +stride || 1));
      const hit = ADJ_CACHE._map.get(_sig);
      if(hit){
        ADJ_CACHE.hits++;
        const i = ADJ_CACHE._lru.indexOf(_sig);          // 최근 쓴 것을 뒤로
        if(i >= 0) ADJ_CACHE._lru.splice(i, 1);
        ADJ_CACHE._lru.push(_sig);
        return hit;
      }
      ADJ_CACHE.misses++;
    }catch(e){ _sig = null; }                            // 서명을 못 만들면 그냥 계산한다
  }
  /* ── 솎기를 <b>누산기</b>로 (2026-08-08 #3) ────────────────────────────
     예전엔 `_i++ % stp`라 stp가 <b>정수</b>여야 했고, 그리는 수 = 모델 ÷ 정수라
     계단이 굵었다. 그래서 모델을 키우면 stride가 2→3으로 튀며 그리는 수가
     <b>오히려 줄었다</b>:
         모델 11,206 · 솎기 2 → left 3,003 그림
         모델 16,523 · 솎기 3 → left 2,515 그림 (목표 2,880 대비 −13%)
     모델을 47% 키웠는데 화면은 16% 줄었다 — #3(가닥 늘리기)이 화면에 안 나오던
     직접 원인이다. 누산기로 바꾸면 stp가 2.7 같은 실수여도 되고, 뽑히는 수가
     목표치에 정확히 붙는다(브레젠험과 같은 원리). */
  const stp = Math.max(1, +stride || 1);
  const out = [];
  let _acc = 0;
  /* 스타일링은 뷰별이다(2026-07-27). 네 뷰 값이 같으면(대부분의 프레임) 한 번만
     읽고 끝내고, 다르면 가닥 뿌리 방향으로 섞는다. */
  const uni = uniformStyling();
  /* ── 조정 후 재클립 준비 (2026-08-01) ──────────────────────────────
     연산자가 가닥을 움직인 <b>다음</b>에 세그멘테이션으로 한 번 더 다듬는다.
     프로브는 리프트 때 만든 것을 그대로 재사용한다(뷰 마스크·포즈만 보므로
     조정과 무관하게 유효하다). 없으면 조용히 예전 동작. */
  /* 마네킹이면 <b>손님의 옛 머리 실루엣</b>이 기준이 되는 이 재클립을 닫는다.
     머리를 묶고 온 손님이면 귀 앞·뺨에 머리카락이 없어 옆머리가 정의상
     전멸한다(MQ_TRUST 배너). 되돌리기: MQ_TRUST.photoClip3D = false */
  const occ = (HAIR_OCC3D.clipAdjusted && !(MQ_TRUST.photoClip3D && model.mannequin && MQ_TRUST.on))
    ? ((model.occ && model.occ.probe) || (state.hairOcc3D && state.hairOcc3D.probe) || null)
    : null;
  const occAcc = occ ? { n:0, dropped:0, trimmed:0, removedPts:0, faceBlocked:0 } : null;
  /* 조각 진단(2026-08-29) — 원형평균의 <b>합벡터 길이</b> 최저값을 이 패스에서
     모은다. 조각이 없으면 켜지 않는다(비용 0). */
  _pieceAcc = (PIECE3D.on && hairPieces().length) ? { n:0, minR:1, minKey:null } : null;
  /* 마네킹이면 점유 판정은 "여유 무한"으로 통과시키고 <b>얼굴 거부만</b> 남긴다
     (근거는 HAIR_OCC3D.fringeFrac 주석). 길이를 늘렸을 때의 여유와 <b>큰 쪽</b>을
     쓴다 — 둘은 서로 다른 이유의 여유라 더하면 이중으로 열린다. */
  let mqGrow = 0;
  if(model.mannequin && HAIR_OCC3D.fringeFrac > 0){
    try{ mqGrow = 2 * getHeadEllipsoid().b * HAIR_OCC3D.fringeFrac; }catch(e){ mqGrow = 0; }
  }
  for(const st of model.strands){
    if(srcAngleFilter && st.srcAngle !== srcAngleFilter) continue;
    _acc += 1/stp;
    if(_acc < 1) continue;                 // 아직 차례가 아니다
    _acc -= 1;
    const sec = (state.sections && state.sections[st.sec]) || {};
    /* ⓪ 숱치기 — 판정은 가닥 고유 해시라 슬라이더를 움직여도 같은 가닥이 같은
       순서로 빠진다(프레임마다 다른 가닥이 사라지면 반짝인다).
       ── 2단 분리(2026-08-23 2차)에서는 <b>여기서 안 버린다</b> ──────────────
       예전엔 "솎아낼 가닥은 기하 계산 전에 버린다(공짜로 빨라진다)"였다. 맞는
       말인데, 그 대가로 density가 서명에 들어가서 <b>드래그 틱마다 전량 재계산</b>이
       됐다. 한 번 더 계산하는 값(density<100일 때만) vs 매 틱 전부 다시 계산하는
       값을 견주면 후자가 압도적으로 크다 — 실기기에서 그 드래그가 1.7초 정지였고
       그 앞 빌드에서는 탭이 죽었다.
       그래서 기하는 <b>안 솎고</b> 전량 계산해 캐시하고, 컷은 _adjApplyFilter가 한다.
       되돌리기(ADJ_CACHE.split=false)면 예전처럼 여기서 버린다. */
    if(!ADJ_CACHE.split && typeof sec.density === 'number' && sec.density < 100
       && _cutHash01(st) > Math.max(0, sec.density) / 100) continue;
    const ratio = sectionLengthRatio(st.sec, sec.length);
    let pts = adjustStrandGeom(st, null, uni);                     // ①~⑦ (아래 함수)
    /* ⑧ 세그멘테이션 재클립 — "세그멘테이션 밖에는 안 그린다"를 3D에도.
       늘린 만큼(ratio>1)은 나가는 게 맞으므로 그 호길이만큼 여유를 준다. */
    /* ── 문턱 ① — 앞머리는 <b>사진 점유로 판정하지 않는다</b> (2026-09-02 3차) ──
       마네킹 앞머리는 "사진에 없는 머리를 일부러 만든" 가닥이다(MQ_FRINGE 배너).
       그걸 사진 점유에 대면 <b>정의상 전부 잘린다</b> — 이마에는 머리가 없으니까.
       faceVeto도 같이 빠진다: 뱅은 얼굴을 덮는 게 맞는 시술이다.
       면제는 st.fringe가 붙은 가닥에만 걸리므로 나머지는 비트 단위로 그대로다. */
    if(occ && !st.fringe){
      /* 여유(2026-08-18 i) — 시술이 <b>실제로 움직인 거리</b>가 여유다(srcPts).
         길이만 보던 growPerRatio는 moveGrow=false일 때의 폴백으로만 남는다:
         변위 여유가 그 값을 이미 포함하므로 켜져 있을 때 같이 주면 이중이다.
         마네킹 바닥값(mqGrow)은 기하 오차 보정이라 성격이 다르므로 그대로 두되
         앞쪽(이마)에만 준다 — HAIR_OCC3D.fringeFrontOnly 주석 참조. */
      const grow = (!HAIR_OCC3D.moveGrow && ratio > 1)
        ? (ratio - 1) * arcLength3D(st.pts) * HAIR_OCC3D.growPerRatio : 0;
      const t = trimStrandToOccupancy3D(pts, occ, occAcc,
                  { growLen: Math.max(grow, mqGrow), growFrontOnly: (mqGrow > grow) && HAIR_OCC3D.fringeFrontOnly,
                    growAboveY: model.CY,          // 앞머리 여유는 <b>눈 위</b>(이마)까지만
                    srcPts: st.pts, neverDrop: true, faceVeto: true });
      if(t && t.length >= 2) pts = t;
    }
    /* ⑨ 빗질(시술모드) — 재클립 <b>뒤</b>다. 클립은 "사진에 머리가 없는 자리에는
       안 그린다"는 규칙인데, 빗질은 일부러 그 자리로 옮기는 행위라 앞에 두면
       빗는 족족 잘려나간다. 빗질 없으면(격자 없음) 비용 0. */
    pts = combStrand3D(pts);
    /* ⑩ 섹션 컬러 (2026-08-09) — 여태 <b>2D 컬럼 렌더러에서만</b> 살아 있었다
       (colorForSection). 기본 렌더는 3D 투영이라 st.color(촬영/마네킹 실측색)를
       그대로 썼고, 그래서 섹션 컬러 스와치도 스타일 스펙의 색(애쉬 브라운)도
       화면에 한 픽셀도 안 나왔다. 커트·펌은 3D로 옮겼는데 컬러만 안 따라온 것.
       우선순위는 2D와 같다 — 미용사가 명시한 섹션 컬러가 실측색보다 앞선다. */
    /* ⑪ 조각별 실측색 동승 (2026-08-17 b) — 여기서 안 실으면 투영 렌더의
       `st.colors`가 항상 null이라 3D 화면만 <b>가닥당 단색</b>이 된다.
       (섹션 컬러가 지정된 가닥은 그 색이 우선이므로 조각색을 버린다 — 염색은
       사진 색을 덮는 게 목적이다.) */
    /* 기하 항목은 <b>색을 정하지 않는다</b> — 원료(st.color / st.colors)만 실어
       보내고, 어느 색으로 칠할지는 필터 단이 sec.color를 보고 정한다. 여기서
       정해 버리면 색이 기하 캐시에 구워져서 색 스와치가 캐시 미스를 낸다.
       h는 밀도컷 판정값이다. st.pts[0](중립 뿌리)만 보는 값이라 <b>가닥마다
       한 번</b> 재고 모델에 붙여 둔다 — 모델이 다시 만들어지면 같이 사라진다.
       ⚠ 되돌리기(split=false)에서는 색을 여기서 정해야 예전과 같은 배열이 된다.
         그래서 두 필드를 <b>같이</b> 싣는다(필터가 그냥 통과시키므로 무해하다). */
    if(st._ch === undefined) st._ch = _cutHash01(st);
    out.push(ADJ_CACHE.split
      ? { pts, sec: st.sec, srcAngle: st.srcAngle, h: st._ch,
          srcColor: st.color, srcColors: st.colors || null }
      : { pts, color: sec.color || st.color, sec: st.sec, srcAngle: st.srcAngle,
          colors: sec.color ? null : (st.colors || null) });
  }
  /* ⚠ 2단 분리 뒤로 out.length는 <b>밀도컷 전</b>의 수다(예전엔 컷 후였다).
     재클립이 얼마나 잘랐는지를 보는 진단이라 분모는 컷 전이 오히려 맞지만,
     예전 스크린샷과 숫자를 견주다 헷갈리지 않게 그 사실을 넘겨서 찍게 한다. */
  if(occAcc) logAdjustedClip(occAcc, out.length, ADJ_CACHE.split);
  /* [진단·조각] 모임(원형평균 합벡터 길이) — 1에 가까우면 조각들이 같은 방향을
     가리킨다. 낮은 자리가 있으면 그 부위에서 <b>조각끼리 방향이 싸운다</b>는
     뜻이고, 라이브러리가 커질수록 이 줄이 먼저 알려준다. */
  if(_pieceAcc && _pieceAcc.n){
    _pieceLast = { minR: _pieceAcc.minR, minKey: _pieceAcc.minKey };   // 패널이 읽는다
    console.log('[조각] ' + hairPieces().length + '개 얹힘 · 방향 모임 최저 '
      + _pieceAcc.minR.toFixed(2) + (_pieceAcc.minKey ? '(' + _pieceAcc.minKey + ')' : '')
      + ' · 0.02 미만이면 방향을 안 정하고 기본형을 씁니다(가마가 실제로 그렇습니다).');
  }
  _pieceAcc = null;
  if(_sig){
    ADJ_CACHE._map.set(_sig, out);
    ADJ_CACHE._lru.push(_sig);
    /* 오래된 벌부터 버린다. 이 캐시는 <b>가만히 있는</b> 메모리라 프레임마다
       새로 잡았다 버리는 것보다 GC에 훨씬 순하지만, 그래도 폰에서는 무한히
       쌓게 두면 안 된다 — max로 묶어 두고 위 [성능] 줄에 MB를 같이 찍는다. */
    while(ADJ_CACHE._lru.length > ADJ_CACHE.max){
      const old = ADJ_CACHE._lru.shift();
      if(ADJ_CACHE._lru.indexOf(old) < 0) ADJ_CACHE._map.delete(old);
    }
  }
  return out;
}

/* [진단] 조정 후 재클립이 실제로 먹었는지. 슬라이더 틱마다 찍히면 콘솔이
   넘치므로 <b>숫자가 바뀔 때만</b>, 그리고 1초에 한 번까지만 찍는다.
     · 자름 0 → 조정이 마스크 밖으로 안 밀어냈거나(중립) 프로브가 없다
     · 자름이 과하게 큼 → occThr/offRun이 빡빡하거나 포즈·마스크가 어긋남 */
let _adjClipSig = '', _adjClipAt = 0;
function logAdjustedClip(acc, kept, preDensity){
  const sig = acc.trimmed + '/' + kept + '/' + (acc.faceBlocked||0);
  const now = Date.now();
  if(sig === _adjClipSig || now - _adjClipAt < 1000) return;
  _adjClipSig = sig; _adjClipAt = now;
  /* [진단] 시술 변위 여유(2026-08-18 i) — "컬을 넣었는데도 실루엣에 잘린다"를
     가르는 줄이다. 여유가 0에 가까우면 연산자가 가닥을 안 움직였다는 뜻이고
     (그러면 원인은 클립이 아니라 조정 쪽), 여유가 큰데도 자름이 많으면
     움직인 방향이 얼굴이라 faceVeto가 막고 있는 것이다. */
  const growTxt = acc.growN
    ? ' · 여유 받은 가닥 ' + acc.growN + '개(평균 ' + (acc.growSum/acc.growN).toFixed(3) + ' 모델단위)'
    : ' · 여유 0(시술 변위 없음)';
  console.log('[3D·클립] 조정 후 재클립 — 가닥 ' + kept + (preDensity ? '개(숱치기 전)' : '개')
    + ' 중 자름 ' + acc.trimmed
    + '개(평균 ' + (acc.trimmed ? (acc.removedPts/acc.trimmed).toFixed(1) : '0') + '점 제거)'
    + ' · 얼굴침범 차단 ' + (acc.faceBlocked||0) + '개'
    + growTxt
    + ' · 판정 ' + acc.n + '회'
    + (HAIR_OCC3D.moveGrow ? '' : ' · moveGrow OFF')
    + (HAIR_OCC3D.clipAdjusted ? '' : ' · OFF'));
}

// 중립 모델 + 조정 연산자 → 미니뷰 LineSegments 재구성. 슬라이더가 바뀌면
// 재캡처·재리프트 없이 이 함수만 다시 불러 연산자를 재적용한다(효율+이중적용 방지).
/* ── 미니뷰가 <b>안 보일 때도</b> 전 모델을 다시 계산하고 있었다 (2026-08-22) ──
   실기기(갤럭시 A15) 영상 실측: 조정화면이 0.1~2.2fps인데 같은 폰에서 3D
   결과보기는 13~18fps다. 더 무거운 쪽이 30배 빠르니 하드웨어 문제가 아니다.
   호출 사슬을 따라가 보면:
     renderAdjustFrame → scheduleHair3DRefresh(120ms) → refreshDevMini3D()
       → computeAdjustedHair3DStrands()   ← <b>인자 없음 = stride 1 = 전 가닥</b>
   조정 화면 본체는 stride를 줘서 그릴 것만(수천 개) 계산하는데, 미니뷰는
   <b>모델 전체</b>(1만 2천여 가닥 × 32점 ≈ 40만 점)에 커트·컬·처짐·가르마·
   넘김·볼륨·결흐름을 다 돌린다. 그것도 화면 갱신마다.
   게다가 devMini3D는 한 번 만들어지면 패널을 닫아도 객체가 남아서
   `if(!devMini3D) return` 가드를 통과한다 — <b>안 보이는 패널을 위해</b>
   그 계산이 계속 돌고 있었다.
   두 가지로 막는다(둘 다 그림은 안 바꾼다):
     ① 패널이 실제로 화면에 있을 때만 계산한다(display 검사)
     ② 미니뷰는 172×222px 썸네일이다 — 전 가닥을 그릴 해상도가 아니다.
        MINI3D.maxStrands 개까지만 솎아 쓴다(누산기 방식이라 분포는 유지).
   되돌리기: MINI3D.gateHidden=false, MINI3D.maxStrands=Infinity */
const MINI3D = { gateHidden: true, maxStrands: 2500 };
function devMini3DVisible(){
  /* MINI3D 상수가 이 함수보다 <b>아래</b>에 있어도(선언 호이스팅은 함수만) 안전하게 —
     TDZ든 DOM 예외든 "모르면 예전 동작(그린다)"으로 떨어진다. */
  try{
    if(!MINI3D.gateHidden) return true;
    const p = document.getElementById('devMini3D');
    if(!p) return false;
    if(p.style.display === 'none') return false;
    return p.offsetParent !== null || p.classList.contains('expanded');
  }catch(e){ return true; }
}
/* ── 미니뷰 개체 떼어내기 (2026-08-23 중복 통합) ──────────────────────
   가닥·점유·결 세 진단 개체가 <b>글자 그대로 같은 다섯 줄</b>을 각자 적고
   있었다(remove → geometry.dispose → material.dispose → null). 재구성마다
   부르는 자리라, 한 곳만 고치면 나머지 둘이 GPU 메모리를 계속 쥔다.
   ※ disposeObject3D도 있지만 그건 traverse + material.map까지 본다. 여기 셋은
     자식도 텍스처도 없는 단일 LineSegments/Points라 하던 일만 그대로 옮긴다 —
     넓은 쪽을 쓰면 "동작 그대로"가 아니게 된다. */
function miniDetach(key){
  if(!devMini3D) return;
  const o = devMini3D[key];
  if(!o) return;
  devMini3D.group.remove(o);
  /* (2026-09-22) 묶음(Group)도 안쪽까지 치운다 — 땋기가 밧줄 메쉬 + 모아 빗기 선을 한 묶음으로
     넘긴다. 예전처럼 o.geometry만 보면 Group엔 geometry가 없어 안쪽 두 벌이 슬라이더마다 남았다. */
  const kill = (x)=>{ if(x.geometry) x.geometry.dispose(); if(x.material) x.material.dispose(); };
  if(typeof o.traverse === 'function') o.traverse(kill); else kill(o);
  devMini3D[key] = null;
}
function refreshDevMini3D(){
  if(!devMini3D) return;
  if(!devMini3DVisible()) return;                       // ① 안 보이면 계산 자체를 안 한다
  /* 형상을 다시 만들면 <b>반드시</b> 한 장은 다시 그려야 한다 — 안 그러면
     dirty 게이트(2026-08-23) 때문에 슬라이더를 돌려도 미니뷰만 안 따라온다.
     이 한 줄이 그 게이트와 짝이다. */
  if(devMini3D.markDirty) devMini3D.markDirty();
  const _m = state.hair3Dneutral;                       // ② 썸네일에 맞는 개수만
  const _stride = (_m && _m.strands && MINI3D.maxStrands > 0)
    ? Math.max(1, _m.strands.length / MINI3D.maxStrands) : 1;
  const adj = computeAdjustedHair3DStrands(null, _stride);
  if(!adj) return;
  /* (2026-09-01 4차) 2D 캔버스와 <b>같은 프레임·같은 화면</b>의 도장이다.
     사용자: "2D조정화면이 아니라 <b>캔버스</b>를 봐 — 미니3D 뒤에 계속 보이는 게
     2D 캔버스잖아." 맞다. 화면을 오가며 비교하면 그 사이에 상태가 바뀌었을
     가능성이 남는데, 이 둘은 <b>같은 순간</b>이라 그 여지가 없다. 여기가
     대조의 올바른 짝이고, 3D 두상 화면 쪽 도장은 참고로 남는다. */
  diagAdjSourceStamp('미니3D', adj);
  const { group } = devMini3D;
  miniDetach('strandObj');
  /* 땋기(2026-09-22 2차) — 3D 결과보기와 <b>같은 함수</b>로 밧줄을 짓는다(색만 섹션색).
     슬라이더마다 다시 지으므로 가볍게: 원주 3 · 마디당 4점 · 로그 끔.
     못 지으면 아래 평소 선으로. */
  if(typeof BRAID !== 'undefined' && BRAID.on && typeof buildBraid3DObject === 'function'){
    const bo = buildBraid3DObject(adj, (st)=> SECTION_COLORS[st.sec] || '#cccccc',
      { x:0, y: (_m && isFinite(_m.CY)) ? _m.CY : 0, z:0 }, { radial:3, stepsPerNode:4, log:false, mini:true });   // 예산: BRAID3D.miniMaxVerts(저사양 miniMaxVertsLow)
    if(bo){
      group.add(bo); devMini3D.strandObj = bo;
      refreshField3DDebug(); refreshOcc3DDebug();
      return;
    }
  }
  const positions=[], colors=[]; const c=new THREE.Color();
  for(const st of adj){
    const pts = st.pts;
    // (12차) 미니뷰를 섹션별 색으로 — 어느 부위가 어느 섹션인지 눈으로 확인
    // (실기기 섹션 분포 튜닝용). SECTION_COLORS는 미니뷰 전용(실제 머리색 아님).
    c.set(SECTION_COLORS[st.sec] || '#cccccc');
    for(let i=0;i<pts.length-1;i++){
      positions.push(pts[i].x,pts[i].y,pts[i].z, pts[i+1].x,pts[i+1].y,pts[i+1].z);
      colors.push(c.r,c.g,c.b, c.r,c.g,c.b);
    }
  }
  if(!positions.length) return;
  const obj = makeVertexColorLines(positions, colors);
  group.add(obj);
  devMini3D.strandObj = obj;
  refreshField3DDebug();
  refreshOcc3DDebug();
}

/* ── [진단용] 3D 점유 필드를 미니뷰에 그린다 (2026-08-01) ──────────────
   window.__occ3DDebug = true; 로 켜면 두상 표면 셀마다 점을 찍는다.
   초록 = 머리카락 있음 / 빨강 = 없음(민머리·가르마·마스크 구멍) / 회색 = 어느 뷰도
   제대로 못 본 자리(판단 보류 — 여기는 아무것도 안 지운다).
   "가르마가 3D에서 사라진다" 같은 증상을 이 그림 하나로 확인할 수 있다. */
function refreshOcc3DDebug(){
  if(!devMini3D) return;
  const { group } = devMini3D;
  miniDetach('occObj');
  if(!window.__occ3DDebug) return;
  const store = state.hairOcc3D;
  const f = store && store.field;
  if(!f || !f.ok) return;
  let he; try{ he = getHeadEllipsoid(); }catch(e){ return; }
  const O = HAIR_OCC3D;
  const pos=[], col=[];
  for(let pi=0; pi<f.NP; pi++){
    const ny = Math.cos((pi + 0.5) / f.NP * Math.PI);
    const rq = Math.max(0, 1 - ny*ny);
    if(rq <= 1e-4) continue;
    const rr = Math.sqrt(rq);
    for(let ti=0; ti<f.NT; ti++){
      const ci = pi*f.NT + ti;
      const th = (ti + 0.5) / f.NT * 2*Math.PI - Math.PI;
      pos.push(he.a * rr * Math.sin(th) * 1.10, f.CY + f.b * ny, he.c * rr * Math.cos(th) * 1.10);
      if(f.seen[ci] <= O.minSeen)      col.push(0.45, 0.45, 0.45);  // 판단 보류
      else if(f.occ[ci] >= O.occThr)   col.push(0.15, 0.95, 0.35);  // 머리카락 있음
      else                             col.push(0.95, 0.20, 0.20);  // 없음
    }
  }
  if(!pos.length) return;
  const o = new THREE.Points(makeVertexColorGeometry(pos, col),
                             new THREE.PointsMaterial({ size: Math.max(0.012, he.a*0.035), vertexColors:true }));
  o.name = 'occ3DDebug';
  group.add(o);
  devMini3D.occObj = o;
}

/* ── [진단용] 3D 결 필드를 미니뷰에 직접 그린다 (2026-08-01) ──────────
   콘솔 숫자만으로는 "결이 두상 어디에 어떤 방향으로 붙었나"를 못 본다.
   window.__field3DDebug = true; 로 켜면 셀마다 짧은 선분 하나를 두상 표면에
   찍는다 — 색은 3D 또렷함(빨강=흐림, 초록=또렷). 결이 뒤통수에서 뒤집혀
   있거나 좌우가 바뀌어 있으면 여기서 바로 보인다. */
function refreshField3DDebug(){
  if(!devMini3D) return;
  const { group } = devMini3D;
  miniDetach('fieldObj');
  if(!window.__field3DDebug) return;
  const model = state.hair3Dneutral || state.hair3D;
  const field = (model && model.field) || state.hairField3D;
  if(!field || !field.ok) return;
  let he; try{ he = getHeadEllipsoid(); }catch(e){ return; }
  const L = Math.max(0.01, he.a * 0.10);           // 선분 길이 = 두상 반폭의 10%
  const pos=[], col=[];
  for(let pi=0; pi<field.NP; pi++){
    const ny = Math.cos((pi + 0.5) / field.NP * Math.PI); // 셀 중심의 정규화 높이(극각 균등)
    const rq = Math.max(0, 1 - ny*ny);
    if(rq <= 1e-4) continue;
    const rr = Math.sqrt(rq);
    for(let ti=0; ti<field.NT; ti++){
      const ci = pi*field.NT + ti;
      const c = field.coh[ci];
      if(!(c > 0)) continue;
      const th = (ti + 0.5) / field.NT * 2*Math.PI - Math.PI;
      // 셀 중심을 두상 타원체 표면 살짝 바깥에 놓는다(가닥에 묻히지 않게)
      const px = he.a * rr * Math.sin(th) * 1.06;
      const pz = he.c * rr * Math.cos(th) * 1.06;
      const py = field.CY + field.b * ny;
      const dx = field.dir[ci*3]*L, dy = field.dir[ci*3+1]*L, dz = field.dir[ci*3+2]*L;
      pos.push(px-dx/2, py-dy/2, pz-dz/2, px+dx/2, py+dy/2, pz+dz/2);
      const g = Math.min(1, c*3), r = 1 - g;
      col.push(r, g, 0.15, r, g, 0.15);
    }
  }
  if(!pos.length) return;
  const o = makeVertexColorLines(pos, col);
  o.name = 'field3DDebug';
  group.add(o);
  devMini3D.fieldObj = o;
}

// (11차) 중립 3D 모델 생성 — 촬영된 뷰들을 중립(rawMode)으로 캡처 → 리프트.
// 조정과 무관하게 한 번만 만들면 되고(슬라이더는 연산자 재적용만), 3D 화면의
// 비중립 캡처(state.strandPaths)는 swap-restore로 보존한다.
/* ── 중립 모델 빌드는 <b>한 번에 하나</b>만 돈다 (2026-09-16) ─────────────────
   증상: 후면만 3D 투영(슬라이더가 먹음), 정면·좌·우는 폴백 2D 렌더(조정 안 먹음).
   원인: viewCal[angle]이 없어 07b의 canProject가 거짓 → drawHairStrands 폴백.
   viewCal은 지워진 게 아니라, 모델이 <b>일부 뷰 경로만</b> 보고 만들어졌다.
   조정 화면 진입 때 이 함수가 세 군데서 거의 동시에 불린다:
     · sync3DPreviewPanel(즉시) · scheduleHair3DRefresh(~200ms) · applyStyleSpecAndRender(120ms)
   셋 다 `!state.hair3Dneutral`을 보고 들어오는데, 모델은 비동기 캡처가 다 끝나야
   생기므로 셋 다 통과한다. 예전 코드는 전역 state.strandPaths를 {}로 바꿔 끼우고
   끝나면 되돌렸다 — 동시에 돌면 한 빌드가 다른 빌드의 임시 객체에 캡처를 쓰고,
   먼저 끝난 쪽이 전역을 되돌리면 뒤 빌드는 <b>화면용 옛 경로</b>(일부 뷰뿐)로 리프트한다.
   그 모델이 캐시되면 다시 만들 계기가 없어 그대로 굳는다.
   고침: ① 단일 비행 — 진행 중이면 콜백만 줄 세운다.
         ② 캡처는 끝날 때마다 <b>이 빌드의 사본</b>(mine)으로 옮기고, 리프트 직전에
            그 사본만 전역에 꽂는다(화면 렌더가 중간에 덮어써도 섞이지 않는다).
         ③ 리프트 전에 state.hair3D를 비운다 — 실패하면 옛 모델이 조용히
            중립 모델 자리에 들어가던 것을 막는다(실패는 null로 드러난다).
   되돌리기: NEUTRAL_BUILD.singleFlight = false */
const NEUTRAL_BUILD = { singleFlight: true, running: false, waiters: [] };
/* 중립 3D 모델 만들기 — 바깥 단계(위가 바깥): (옛 54) 빠진 사람 윤곽 채우기 → (옛 52) 360 추가 사진 분석 → buildNeutralHair3DCore */
function buildNeutralHair3D(cb){
  const self = this, args = arguments;
  return BODY_SEG_WAIT._build(() =>
    VIEWS360._build(() => buildNeutralHair3DCore.apply(self, args)));
}
function buildNeutralHair3DCore(cb){
  if(typeof THREE === 'undefined'){ cb && cb(); return; }
  const angles = ANGLES.filter(a => state.shots && state.shots[a]);
  if(!angles.length){ cb && cb(); return; }
  if(NEUTRAL_BUILD.singleFlight){
    if(cb) NEUTRAL_BUILD.waiters.push(cb);
    if(NEUTRAL_BUILD.running){
      console.log('[중립3D] 빌드 진행 중 — 새로 시작하지 않고 끝나면 콜백만 부릅니다');
      return;
    }
    NEUTRAL_BUILD.running = true;
  }
  const savedPaths = state.strandPaths, savedModel = state.hair3D;
  const tmp = {};
  const mine = {};                 // 이 빌드가 뜬 중립 캡처만
  state.strandPaths = tmp;         // 중립 캡처 임시 저장소
  let idx = 0;
  const finish = ()=>{
    if(NEUTRAL_BUILD.singleFlight){
      NEUTRAL_BUILD.running = false;
      const ws = NEUTRAL_BUILD.waiters.splice(0);
      for(const w of ws){ try{ w(); }catch(e){ console.warn('[중립3D] 콜백 실패:', e); } }
    } else { cb && cb(); }
  };
  const done = ()=>{
    state.strandPaths = mine;      // 리프트는 <b>이 빌드의</b> 캡처만 본다
    state.hair3D = null;           // 실패 시 옛 모델이 끼어들지 않게
    try { buildHairStrandsFromPaths(); } catch(e){ console.warn('중립 3D 리프트 실패:', e); }
    state.hair3Dneutral = state.hair3D || null;
    if(typeof COMB !== 'undefined'){ COMB.box = null; }  // (#5) 격자 상자는 모델에서 나온다 — 모델이 바뀌면 다시 잰다
    // (2026-08-01) 중립 캡처 = <b>3D의 원료</b>. 단계별 밀도를 재려면 원료를 봐야 해서 보관한다.
    state.neutralStrandPaths = mine;
    // 빌드 중에 화면 렌더(폴백)가 tmp에 쓴 비중립 경로는 살려서 되돌린다
    const restored = savedPaths || {};
    for(const a in tmp){ if(tmp[a] && tmp[a] !== mine[a]) restored[a] = tmp[a]; }
    state.strandPaths = restored; state.hair3D = savedModel; // 복원(3D 화면 캡처 보존)
    const raw = state._hair3Dneutral;
    const got = raw && raw.viewCal ? Object.keys(raw.viewCal) : [];
    const miss = angles.filter(a => got.indexOf(a) < 0);
    console.log('[중립3D] 완료 — 캡처 ' + Object.keys(mine).map(a=>a+' '+((mine[a]&&mine[a].strands)?mine[a].strands.length:0)).join(' · ')
      + ' | viewCal ' + (got.join(',') || '없음')
      + (miss.length ? '  ⚠ 빠진 뷰 ' + miss.join(',') + ' — 위의 [3D] 뷰 품질 게이트 로그를 보세요' : ''));
    finish();
  };
  const next = ()=>{
    if(idx >= angles.length){ done(); return; }
    const a = angles[idx++];
    captureStrandPathsFor(a, true).then(ok=>{
      // 캡처는 동기로 그려지고 resolve되므로 이 시점의 값이 방금 뜬 것이다
      if(ok && tmp[a]) mine[a] = tmp[a];
      else if(ok && state.strandPaths && state.strandPaths[a]) mine[a] = state.strandPaths[a];
      next();
    }, ()=>next());
  };
  try{ next(); }
  catch(e){
    console.warn('[중립3D] 빌드 시작 실패:', e);
    state.strandPaths = savedPaths; state.hair3D = savedModel;
    finish();
  }
}

/* ── viewCal 누락 자가 복구 (2026-09-16) ────────────────────────────────────
   사진·마스크가 있는 뷰인데 모델에 viewCal이 없으면 한 번만 새로 만든다.
   같은 모델에서 같은 뷰가 또 빠지면 경합이 아니라 리프트 게이트(13c 뷰 루프)에서
   막힌 것이므로 다시 돌지 않고 경고만 남긴다. */
function healMissingViewCal(angle){
  const raw = state._hair3Dneutral;
  if(!raw || NEUTRAL_BUILD.running) return false;
  if(raw.viewCal && raw.viewCal[angle]) return false;
  const mi = state.hairMasks && state.hairMasks[angle];
  if(!(state.shots && state.shots[angle]) || !mi || !mi.scalpY) return false;
  const key = angle;
  state._viewCalHealTried = state._viewCalHealTried || {};
  if(state._viewCalHealTried[key]){
    if(state._viewCalHealTried[key] !== 'warned'){
      state._viewCalHealTried[key] = 'warned';
      console.warn('[viewCal 누락] ' + angle + ' — 다시 만들어도 빠집니다. 경합이 아니라 리프트 게이트'
        + '(13c-scalp-sections.js 뷰 루프: 가닥 12개 미만 / 유효 컬럼 8% 미만 / scalpY 없음)에서 막힌 것입니다.');
    }
    return false;
  }
  state._viewCalHealTried[key] = true;
  console.warn('[viewCal 누락] ' + angle + ' — 모델(viewCal ' + Object.keys(raw.viewCal||{}).join(',')
    + ')이 이 뷰 없이 만들어졌습니다. 중립 모델을 한 번 새로 만듭니다.');
  state.hair3Dneutral = null;
  buildNeutralHair3D(()=>{ try{ refreshDevMini3D(); }catch(e){} renderAdjustFrame(); });
  return true;
}

function resizeDevMini3D(){
  if(!devMini3D) return;
  const wrap = document.getElementById('devMini3DCanvasWrap');
  if(!wrap) return;
  const w=wrap.clientWidth, h=wrap.clientHeight;
  if(w<=0||h<=0) return;
  devMini3D.renderer.setSize(w,h);
  devMini3D.camera.aspect=w/h; devMini3D.camera.updateProjectionMatrix();
}

// 3D 조정 엔진 토글과 연동: ON이면 패널 표시+모델 반영, OFF면 숨김.
/* ── 미니뷰 섹션 색인 (2026-08-29 2차) ────────────────────────────────────
   사용자 지시: "3D 미니화면에 색깔별로 섹션명 색인을 같이 넣는 것."
   refreshDevMini3D가 가닥을 SECTION_COLORS[st.sec]로 칠하는데, 그 대응표가
   화면에 없어서 "지금 분홍이 템플이었나 프론트였나"를 코드에서 확인해야 했다.
   ⚠ 색·이름을 여기 다시 적지 않는다. SECTION_ORDER(순서) · SECTION_COLORS(색) ·
     SECTIONS[id].label(이름) 세 곳에서 그대로 읽는다 — 섹션이 늘거나 색을 바꾸면
     범례가 저절로 따라온다. 복제본을 만들면 한쪽만 고쳐져 조용히 어긋난다.
   ⚠ 이름은 한국어 원문을 넣는다. 화면 문구 번역은 텍스트 노드를 보는
     MutationObserver가 맡으므로('크라운'→'Crown' 등 사전에 이미 있다),
     여기서 uiLang을 보면 번역 경로가 두 갈래가 된다. */
function buildMini3DLegend(){
  const box = document.getElementById('devMini3DLegend');
  if(!box || box.childElementCount) return;   // 1회만 — 색·이름은 세션 중 안 바뀐다
  box.innerHTML = SECTION_ORDER.map(id=>{
    const col = SECTION_COLORS[id] || '#cccccc';
    const name = (SECTIONS[id] && SECTIONS[id].label) || id;
    return `<span class="lg"><span class="sw" style="background:${col}"></span>${name}</span>`;
  }).join('');
}
function showDevMini3D(on){
  const panel = document.getElementById('devMini3D');
  if(!panel) return;
  panel.style.display = on ? 'flex' : 'none';
  if(on){
    buildMini3DLegend();          // THREE가 없어도 범례는 뜬다(초기화 실패와 무관)
    if(!devMini3D) initDevMini3D();
    setTimeout(()=>{ resizeDevMini3D(); refreshDevMini3D(); }, 30);
  }
}

/* (2026-10 · 옛 33-cut-from-tip.js ②) 3D 미리보기 전체보기
   증상: ⛶ 를 눌러도 전체 화면이 안 되고 옆으로만 조금 넓어졌다(캔버스는 예전 크기).
   원인: 26-hair-clump.js의 드래그가 창을 한 번이라도 끌면 인라인으로 left/top과 right:auto·bottom:auto를 박는다.
         인라인이 .expanded CSS를 이겨서 전체 화면 배치가 무시됐다.
   고침: 확대할 때 인라인 위치를 치워 두고, 줄일 때 되돌린다. 크기 변화마다 렌더러 크기도 맞춘다(아래 ResizeObserver).
         Esc로 전체보기 닫기. */
const DEV_MINI3D_POS_KEYS = ['left', 'top', 'right', 'bottom', 'position', 'width', 'height'];
function devMini3DResizeSoon(){
  const go = () => {
    try{ if(typeof resizeDevMini3D === 'function') resizeDevMini3D(); }catch(e){}
    try{ if(typeof refreshDevMini3D === 'function') refreshDevMini3D(); }catch(e){}
  };
  requestAnimationFrame(() => { go(); setTimeout(go, 60); });
}
function toggleDevMini3DExpand(){
  const el = document.getElementById('devMini3D');
  if(!el) return;
  const expand = !el.classList.contains('expanded');
  if(expand){
    const saved = {};
    DEV_MINI3D_POS_KEYS.forEach(k => { saved[k] = el.style[k]; el.style[k] = ''; });
    el._mini3dSavedPos = saved;
    el.classList.add('expanded');
  } else {
    el.classList.remove('expanded');
    const sv = el._mini3dSavedPos;
    if(sv) DEV_MINI3D_POS_KEYS.forEach(k => { el.style[k] = sv[k] || ''; });
    el._mini3dSavedPos = null;
  }
  devMini3DResizeSoon();
}
// 창 크기가 바뀔 때(확대 상태 포함)도 렌더러를 맞춘다
try{
  const wrapEl = document.getElementById('devMini3DCanvasWrap');
  if(wrapEl && typeof ResizeObserver !== 'undefined'){
    let pending = false;
    new ResizeObserver(() => {
      if(pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        try{ if(typeof resizeDevMini3D === 'function') resizeDevMini3D(); }catch(e){}
        try{ if(typeof devMini3D !== 'undefined' && devMini3D && devMini3D.markDirty) devMini3D.markDirty(); }catch(e){}
      });
    }).observe(wrapEl);
  }
}catch(e){}
document.addEventListener('keydown', (e) => {
  if(e.key !== 'Escape') return;
  const el = document.getElementById('devMini3D');
  if(el && el.classList.contains('expanded')) toggleDevMini3DExpand();
});

// headGroup 재구성 시(스타일이 바뀌어 이전 가닥/두상을 지울 때) geometry/material을
// 같이 dispose. 자리표시자 돔 1개일 땐 신경 안 써도 됐지만, 가닥이 수십~백여
// 개로 늘면서 재구성마다 누적되는 GPU 메모리가 무시할 수준이 아니게 됨.
/* 정점 색 지오메트리·선분 (2026-08-02 통합) — 가닥 리프트, 조정 반영 헤어,
   미니뷰 가닥, 점유 필드, 결 필드 다섯 곳이 같은 세 줄을 각자 적고 있었고
   그중 넷은 뒤따르는 LineSegments 생성까지 똑같았다. */
function makeVertexColorGeometry(positions, colors){
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geo.setAttribute('color',    new THREE.BufferAttribute(new Float32Array(colors), 3));
  return geo;
}
function makeVertexColorLines(positions, colors){
  return new THREE.LineSegments(makeVertexColorGeometry(positions, colors),
                                new THREE.LineBasicMaterial({ vertexColors:true }));
}

