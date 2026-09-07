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
function fadeCutLen(st, g, L){
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
function adjustStrandGeom(st, lenOverride, uni){
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
  pts = curlStrand3D(pts, curlAmt, ((typeof sec.wave === 'number') ? sec.wave : 50)/100,
                     (typeof sec.curlDir === 'number') ? sec.curlDir : 0);                // ② 컬(로드 나선)
  if(curlAmt > 0) pts = gravityDroop3D(pts, curlAmt);                              // ③ 감은 뒤 처짐
  /* ④ 가르마 — 스타일링은 커트/펌 위에 얹는 연출이라 뒤에 온다.
     ※ 세기는 <b>원래 뿌리</b> 방향으로 정한다(길이·컬로 이동한 뒤가 아니라).
     (2026-08-29) sty는 함수 첫머리에서 이미 확정됐다 — 조각 합성이 커트와
     스타일링을 한 번에 정하기 때문이다. 읽는 값은 예전과 같다. */
  pts = partStrand3D(pts, sty.part || 0, curlAmt, sty.partAmt);
  /* ⑤ 넘김 — 가르마 값을 <b>같이</b> 넘긴다(2026-08-30). 안 넘기면 넘김이
     가르마를 덮어쓴다(sweepStrand3D 배너의 실측 표). 읽는 값은 ④와 같은 sty다. */
  pts = sweepStrand3D(pts, sty.sweep || 0, curlAmt, sty.part || 0, sty.partAmt);
  pts = volumeStrand3D(pts, (typeof sty.volume === 'number') ? sty.volume : 50);   // ⑥ 뿌리 볼륨
  pts = flowCurlStrand3D(pts, sty.flow || 0);                                      // ⑦ 결 흐름
  /* ⑧ 정돈 — <b>맨 마지막</b>이다. 앞의 연산자들이 만든 뜸을 전부 본 뒤에
     눕혀야 "머리가 붙었다"가 된다. 순서를 앞으로 옮기면 sweep·volume·flow가
     도로 들어 올린다(SLEEK3D 배너 참고). sleek=0이면 pts 그대로다. */
  pts = sleekStrand3D(pts, (typeof sty.sleek === 'number') ? sty.sleek : 0);
  return pts;
}

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
  return out.join('|');
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
function computeAdjustedHair3DStrands(srcAngleFilter, stride){
  return _adjApplyFilter(_adjGeometry(srcAngleFilter, stride));
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
  const occ = HAIR_OCC3D.clipAdjusted
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
  if(o.geometry) o.geometry.dispose();
  if(o.material) o.material.dispose();
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
function buildNeutralHair3D(cb){
  if(typeof THREE === 'undefined'){ cb && cb(); return; }
  const angles = ANGLES.filter(a => state.shots && state.shots[a]);
  if(!angles.length){ cb && cb(); return; }
  const savedPaths = state.strandPaths, savedModel = state.hair3D;
  state.strandPaths = {}; // 중립 캡처 임시 저장소
  let idx = 0;
  const done = ()=>{
    try { buildHairStrandsFromPaths(); } catch(e){ console.warn('중립 3D 리프트 실패:', e); }
    state.hair3Dneutral = state.hair3D || null;
    if(typeof COMB !== 'undefined'){ COMB.box = null; }  // (#5) 격자 상자는 모델에서 나온다 — 모델이 바뀌면 다시 잰다
    // (2026-08-01) 중립 캡처 = <b>3D의 원료</b>. 예전엔 복원하면서 버렸는데, 단계별
    // 밀도를 재려면 "원료가 이미 비어 있었나"를 봐야 해서 따로 보관한다.
    state.neutralStrandPaths = state.strandPaths;
    state.strandPaths = savedPaths; state.hair3D = savedModel; // 복원(3D 화면 캡처 보존)
    cb && cb();
  };
  const next = ()=>{ if(idx >= angles.length){ done(); return; } captureStrandPathsFor(angles[idx++], true).then(next); };
  next();
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

function toggleDevMini3DExpand(){
  const panel = document.getElementById('devMini3D');
  if(!panel) return;
  panel.classList.toggle('expanded');
  setTimeout(resizeDevMini3D, 30); // 크기 전환 후 렌더러 리사이즈
}

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

