/* ══════════════════════════════════════════════════════════════════
   불변식 검사 — 브라우저 없이 (2026-09-07)
   ─────────────────────────────────────────────────────────────────
   이 파일이 막으려는 것은 "버그"가 아니라 <b>이 저장소가 반복하는 실패 모양</b>이다.
   주석에 남은 기록만 봐도 같은 모양이 다섯 번 넘게 나온다:
     · 한 값을 두 곳이 각자 쓰다가 한쪽만 고쳐졌다(앵커/관측 8/09, 기준면 8/17,
       로그/판정 8/31, 목 밑동 소비처 열 곳, 얼굴 라인 cal 9/07)
     · 표시용 손잡이와 치수용 값을 겹쳐 놨다(sideGain 9/07)
     · 부호를 빌드식 기준으로 적어 놓고 되쏘기에서 반대로 돌았다(9/06 2·3·4차)
   사람 눈으로 잡으려면 매번 같은 실력이 필요하다. 그래서 기계가 잡게 한다.
   세션이 바뀌어도, 실력이 달라도, 똑같이 통과하거나 똑같이 실패한다.

   실행:  node test/run.js
══════════════════════════════════════════════════════════════════ */
const fs = require('fs'), path = require('path');
const { loadApp, evalIn, loadOrder, JS } = require('./harness.js');

const T = [];
function test(name, fn){ T.push([name, fn]); }
function eq(a, b, msg){ if(a !== b) throw new Error((msg||'') + ` — 받음 ${a}, 기대 ${b}`); }
function near(a, b, tol, msg){
  if(!(Math.abs(a-b) <= tol)) throw new Error((msg||'') + ` — 받음 ${a}, 기대 ${b}±${tol}`);
}
function ok(c, msg){ if(!c) throw new Error(msg || '거짓'); }

const app = loadApp();
const ctx = app.ctx;
const G = (name) => evalIn(ctx, name);

const ANCHOR = G('VIEWCAL_ANCHOR');
const project3DPointToView = G('project3DPointToView');
const composeRotationZYX  = G('composeRotationZYX');
const correctedViewYawDeg = G('correctedViewYawDeg');
const viewDrawNudgePx  = G('viewDrawNudgePx');
const calForDraw          = G('calForDraw');
const getViewYawDeg       = G('getViewYawDeg');

/* 이 손님(9/07 녹화)의 실측 포즈 — 회귀 재현용 고정값.
   숫자를 바꾸지 말 것. 바꾸면 검사가 아니라 서술이 된다. */
const CASE = { front:{yaw:  2.9, pitch:4.4, roll: 0.1},
               left: {yaw: 50.8, pitch:8.7, roll: 3.6},
               right:{yaw:-41.2, pitch:3.2, roll:-0.7} };

/* ⚠ 검사가 <b>실제 경로를 타게</b> 만든다. 이걸 안 하면 state.landmarks가 비어
   getViewYawDeg가 ASSUMED_YAW_DEG 폴백으로 빠지고, 그러면 sideGain을 어디에 걸든
   출력이 안 변해서 검사 ①이 <b>잘못된 이유로 통과</b>한다.
   (실제로 처음 작성했을 때 그렇게 통과했고, 회귀를 일부러 넣어 보고서야 알았다.
    검사를 쓰면 반드시 <b>깨지는 것을 한 번 보고</b> 나서 믿을 것.) */
function primeState(){
  const st = evalIn(ctx, 'state');
  st.landmarks = st.landmarks || {};
  for(const a of ['front','left','right']){
    st.landmarks[a] = Object.assign(st.landmarks[a] || {}, {
      poseYawDeg: CASE[a].yaw, posePitchDeg: CASE[a].pitch, poseRollDeg: CASE[a].roll,
      yaw: CASE[a].yaw/90,
    });
  }
  // pnp 티어가 실제로 잡히는지 확인 — 안 잡히면 아래 검사가 전부 무의미하다
  const src = evalIn(ctx, 'getViewPoseSource')('right');
  ok(src.tier === 'pnp', `포즈 티어가 pnp가 아니다(${src.tier}) — 검사가 실제 경로를 안 탄다`);
}

function fakeCal(angle){
  const p = CASE[angle] || CASE.front;
  return { cx: 400, s: 0.0025, sy: 0.0025, crownY: 120,
           yaw: p.yaw*Math.PI/180, pitch: p.pitch*Math.PI/180, roll: p.roll*Math.PI/180 };
}
function fakeModel(){
  const viewCal = {}; for(const a of ['front','left','right','back']) viewCal[a] = fakeCal(a);
  return { viewCal, yTop: 0.4, CY: 0.5 };
}

/* ─────────────────────────────────────────────────────────────────
   ① 층 분리 — 표시용 손잡이가 치수용 값을 건드리면 안 된다
   9/07에 내가 정확히 이걸 어겼다. sideGain을 getViewYawDeg(출처)로 올렸더니
   getHeadEllipsoid·getScalpEllipsoid가 네 뷰 실루엣 폭을 그 yaw로 나눠 풀면서
   폭이 깊이로 귀속돼 머리통이 좁고 깊어졌다. 화면은 "오히려 더 쏠렸다".
   diff 리뷰로는 안 잡힌다 — 코드를 읽어서는 getViewYawDeg가 치수에도 쓰인다는
   걸 모르면 그럴듯해 보인다. 그래서 <b>동작</b>으로 못 박는다.
───────────────────────────────────────────────────────────────── */
test('① sideGain은 표시용이다 — getViewYawDeg 출력이 흔들리면 안 된다', () => {
  primeState();
  const before = ANCHOR.sideGain;
  ok(Math.abs(getViewYawDeg('right') - CASE.right.yaw) < 1e-9,
     'getViewYawDeg가 실측값을 안 돌려준다 — 폴백 경로를 타고 있다');
  const sample = ['front','left','right','back'].map(a => {
    ANCHOR.sideGain = 1.0;  const off = getViewYawDeg(a);
    ANCHOR.sideGain = 1.45; const on  = getViewYawDeg(a);
    ANCHOR.sideGain = 2.5;  const hi  = getViewYawDeg(a);
    return { a, off, on, hi };
  });
  ANCHOR.sideGain = before;
  for(const s of sample){
    ok(Object.is(s.off, s.on) && Object.is(s.on, s.hi),
      `${s.a}: sideGain이 getViewYawDeg를 움직였다(${s.off} → ${s.on} → ${s.hi}). `
      + 'getViewYawDeg는 머리통 치수(getHeadEllipsoid·getScalpEllipsoid)를 푸는 데도 '
      + '쓰인다 — 표시용 배율이 여기 들어가면 두상 크기가 바뀐다. 보정은 calForDraw에서만.');
  }
});

/* ⚠ (2026-09-09 4차) 이 검사는 <b>sideGain</b>의 항등을 재는 것인데 dx까지 보고
   있었다. dx를 만드는 손잡이는 drawNudgePx로 <b>따로</b> 있고, 4차에 right=8이
   들어가면서 여기서 깨졌다 — 깨진 자리가 틀렸다는 뜻이다(검사 대상이 아닌
   손잡이가 검사를 넘어뜨렸다). 두 손잡이를 다 중립으로 놓고 잰다. */
test('② sideGain=1.0 이면 보정 전과 글자 그대로 같다(항등)', () => {
  const before = ANCHOR.sideGain, beforeNudge = ANCHOR.drawNudgePx;
  ANCHOR.sideGain = 1.0;
  ANCHOR.drawNudgePx = 0;
  for(const a of ['front','left','right','back']){
    const m = fakeModel();
    const drawn = calForDraw(m, a), raw = m.viewCal[a];
    eq(drawn.yaw, raw.yaw, `${a} yaw`);
    eq(drawn.dx || 0, 0, `${a} dx`);
  }
  ANCHOR.sideGain = before;
  ANCHOR.drawNudgePx = beforeNudge;
});

/* ②-b (2026-09-09 4차) drawNudgePx는 <b>가로만</b> 민다 — 각도는 안 건드린다.
   4차에 right로 +8px을 넣으면서, 미는 자와 도는 자가 섞이지 않는다는 것을
   못 박아 둔다. 섞이면 다음 턴에 "밀었더니 각도도 변했다"를 못 읽는다. */
test('②-b drawNudgePx는 dx만 움직이고 yaw는 그대로다', () => {
  const before = ANCHOR.drawNudgePx;
  ANCHOR.drawNudgePx = { front: 0, left: 0, right: 8, back: 0 };
  for(const a of ['front','left','right','back']){
    const m = fakeModel();
    const drawn = calForDraw(m, a), raw = m.viewCal[a];
    eq(drawn.yaw, raw.yaw, `${a} — 미는 손잡이가 각도를 움직였다`);
    eq(drawn.dx || 0, a === 'right' ? 8 : 0, `${a} dx`);
  }
  ANCHOR.drawNudgePx = before;
});

/* ─────────────────────────────────────────────────────────────────
   ③-0 (2026-09-09 2차) <b>기본값은 항등</b>이어야 한다.
   되쏘기 회전이 리프트 회전과 다르면 R′·Rᵀ = Δψ 만큼의 잔여 회전이 남고,
   그건 평행이동이 아니라 <b>전단</b>이라 반대쪽 가닥만 얼굴을 가로지른다
   (VIEWCAL_ANCHOR.sideYawFrom 배너). 그래서 "손대지 않음"이 기본이고,
   그 사실을 검사로 못 박는다 — 다음 세션이 이 손잡이를 다시 켜면 여기서 깨진다.
───────────────────────────────────────────────────────────────── */
test('③-0 되쏘기 보정에는 손대지 않는 경로가 있고 그건 항등이다', () => {
  const beforeFrom = ANCHOR.sideYawFrom, beforeGain = ANCHOR.sideGain;
  /* 이 앱에 실제로 있는 모드는 'nose'와 'gain' 둘뿐이다. "손대지 않음"은
     gain=1 이 맡는다 — 9/09~9/12에 잠깐 있던 'off'·'blend'는 없는 모드다.
     (그 둘을 넣었던 5차는 되돌렸다. 아래 ⚠ 참고) */
  ANCHOR.sideYawFrom = 'gain'; ANCHOR.sideGain = 1;
  for(const a of ['front','left','right','back']){
    const m = fakeModel();
    const drawn = calForDraw(m, a), raw = m.viewCal[a];
    eq(drawn.yaw, raw.yaw, `${a} — 그리는 yaw가 빌드 yaw와 달라졌다(전단이 생긴다)`);
  }
  eq(correctedViewYawDeg(-41.2, 'right'), -41.2, '우측을 손대면 안 된다');
  eq(correctedViewYawDeg( 50.8, 'left'),   50.8, '좌측을 손대면 안 된다');
  ANCHOR.sideYawFrom = beforeFrom; ANCHOR.sideGain = beforeGain;

  /* ⚠ (2026-09-12) 9/09에 여기 못을 'off'로 박았다가 <b>뽑는다.</b>
     5차가 우측을 'off' + drawNudgePx 25px로 바꿔 놨는데, 사용자(미용사)가
     직접 되돌렸다: "지금 파일이 결과물이 제일 괜찮아서 지금 구성으로 바꾼 거야."
     화면을 보고 고르는 쪽이 맞다 — [뷰정렬]이 재는 크라운 띠 중심은 그림이
     좋아 보이는지와 <b>같은 것이 아니다</b>. 숫자가 사람을 이기는 자리가 아니었다.
     그래서 기본값을 못 박지 않는다. 대신 <b>지금 무엇인지</b>만 적어 둔다:
       sideYawFrom='nose' · drawNudgePx 전 뷰 0 (2026-09-12 기준)
     이 줄이 깨지면 누가 바꾼 것이니, 바꾼 사람이 화면으로 확인했는지만 보라. */
  eq(ANCHOR.sideYawFrom, 'nose', "sideYawFrom이 'nose'가 아니다 — 누가 바꿨는지 확인하라");
  for(const a of ['front','left','right','back']){
    eq(ANCHOR.drawNudgePx[a], 0, a + ' drawNudgePx가 0이 아니다 — 화면으로 확인했는가');
  }
});

/* ─────────────────────────────────────────────────────────────────
   ⑪ (2026-09-09) 콘솔 로그의 <b>가 글자 그대로 찍히면 안 된다.
   두 달치 로그가 "누가 장난쳐 놓은 것처럼" 보였던 자리다. 태그는 폰 진단정보
   패널용인데(그쪽은 innerHTML) 콘솔은 HTML을 모른다. 어댑터가 %c로 바꾼다.
   ⚠ 여기서 지키는 것은 "굵게"가 아니라 <b>인자 짝</b>이다. %c를 끼워 넣으면서
     스타일 인자 수가 어긋나면 로그가 통째로 밀린다 — 그게 태그보다 나쁘다.
───────────────────────────────────────────────────────────────── */
test('⑪ 콘솔 굵은 글씨 — 태그를 스타일로 바꾸되 인자 짝을 안 흐트러뜨린다', () => {
  const con = G('console');
  const B = G('gyeolBoldArgs');
  ok(typeof B === 'function', '변환 함수가 없다 — 01 파일 맨 위를 보라');

  /* ⚠ console.log를 <b>감싸면 안 된다.</b> 감싸면 DevTools 소스 링크가 전부
     래퍼 파일로 바뀐다(9/09에 그렇게 했다가 9/12에 되돌렸다 — 녹화에서
     15-project-3d.js:484 가 01-face-landmarker.js:68 로 찍혔다).
     호출부에서 펼치는 꼴이라야 링크가 산다. 여기서 래퍼가 없음을 못 박는다. */
  ok(!con.__gyeolBold, 'console.log가 다시 감싸졌다 — 소스 링크가 죽는다');

  // 태그 없는 줄은 손대지 않는다
  eq(B(['안녕'])[0], '안녕', '태그 없는 줄을 건드렸다');

  // %c 개수와 스타일 인자 개수가 항상 같아야 한다 — 어긋나면 로그가 밀린다
  const [fmt, ...styles] = B(['%c[빌드] <b>굵게</b> 끝', 'background:#7A6149']);
  eq((fmt.match(/%c/g) || []).length, styles.length,
     '%c 개수와 스타일 인자 개수가 다르다 — 로그가 밀린다');
  ok(fmt.indexOf('<b>') < 0, '<b>가 그대로 남았다');
  ok(styles.every(s => s.indexOf('background:#7A6149') === 0),
     '원래 %c 스타일이 뒤 조각에서 사라졌다');
  ok(styles.some(s => s.indexOf('700') >= 0), '굵어진 조각이 하나도 없다');

  // 퍼센트 기호는 %%로 escape — 안 하면 뒤가 서식으로 먹힌다
  ok(B(['<b>50%</b>'])[0].indexOf('50%%') >= 0, '% 를 escape 안 했다');

  // %s 같은 다른 서식이 섞이면 태그만 떼고 인자는 그대로 넘긴다
  const other = B(['%s <b>x</b>', 'v']);
  eq(other.length, 2, '다른 서식이 있는데 인자 수가 바뀌었다');
  eq(other[1], 'v', '뒤 인자가 밀렸다');
  ok(other[0].indexOf('<b>') < 0, '태그를 안 뗐다');

  // 문자열이 아닌 첫 인자는 그대로 — 객체 로깅을 망가뜨리면 안 된다
  const obj = { a: 1 };
  eq(B([obj])[0], obj, '객체 인자를 건드렸다');
});





test('③ sideGain은 측면만 건드린다 · 부호 유지 · 상한 준수', () => {
  /* A/B 경로 검사 — 기본값이 'off'이므로 이 검사만 명시적으로 'gain'을 켠다.
     이 경로가 살아 있어야 "전단이 정말 원인이었나"를 다음 턴에 되돌려 볼 수 있다. */
  const beforeFrom = ANCHOR.sideYawFrom; ANCHOR.sideYawFrom = 'gain';
  const before = ANCHOR.sideGain; ANCHOR.sideGain = 1.45;
  eq(correctedViewYawDeg(2.9, 'front'), 2.9, '정면은 손대지 않는다');
  eq(correctedViewYawDeg(180, 'back'), 180, '후면은 손대지 않는다');
  eq(correctedViewYawDeg(5, 'right'), 5, `|yaw| < sideMinDeg(${ANCHOR.sideMinDeg})는 손대지 않는다`);
  const r = correctedViewYawDeg(-41.2, 'right'), l = correctedViewYawDeg(50.8, 'left');
  ok(r < 0 && l > 0, '부호가 뒤집혔다');
  near(r, -59.74, 0.01, '우측'); near(l, 73.66, 0.01, '좌측');
  ANCHOR.sideGain = 9;
  ok(Math.abs(correctedViewYawDeg(-41.2,'right')) <= ANCHOR.sideMaxDeg,
     `sideMaxDeg(${ANCHOR.sideMaxDeg}) 상한이 안 걸렸다 — 90°는 이 저장소가 교훈 E로 금지한 값이다`);
  ANCHOR.sideGain = before;
  ANCHOR.sideYawFrom = beforeFrom;
});

/* ─────────────────────────────────────────────────────────────────
   ② 부호와 실효성 — 9/06에 세 턴을 태운 자리
   cxNudgePx는 빌드식 mx=(px−cx)·s 기준으로 부호를 적어 놨는데, 정작 그리는 것은
   되쏘기 ix=lx/s+cx다. 게다가 같은 값이 양쪽에 다 쓰여 <b>촬영 가닥에서는 상쇄</b>된다.
   두 사실을 검사로 못 박아 두면 다음 세션이 그 손잡이를 다시 집지 않는다.
───────────────────────────────────────────────────────────────── */
test('④ drawNudgePx는 화면을 정확히 그만큼 민다(+ = 오른쪽)', () => {
  const m = fakeModel(), a = 'right';
  const pt = { x: 0.07, y: 0.52, z: -0.03 };
  const base  = project3DPointToView(pt, m.viewCal[a], m.yTop, m.CY);
  const moved = project3DPointToView(pt, Object.assign({}, m.viewCal[a], { dx: 25 }), m.yTop, m.CY);
  near(moved.ix - base.ix, 25, 1e-9, 'dx가 ix에 그대로 더해져야 한다');
  eq(moved.iy, base.iy, 'dx는 세로를 건드리면 안 된다');
  const back = project3DPointToView(pt, Object.assign({}, m.viewCal[a], { dx: -25 }), m.yTop, m.CY);
  near(back.ix - base.ix, -25, 1e-9, '음수 방향도 대칭이어야 한다');
});

test('⑤ cxNudgePx는 촬영 가닥에서 상쇄된다 — 화면을 못 민다(회귀 기록)', () => {
  /* 빌드:   mx = (px − cx)·s      되쏘기: ix = lx/s + cx
     같은 cx를 넣고 빼므로 왕복이 항등이다. 9/06 2·3·4차가 이 손잡이를 +35 → −35 →
     +35로 뒤집으며 "화면이 안 움직인다 / 반대로 간다"를 반복했다. 그 손잡이가 아니다. */
  const s = 0.0025, px = 512;
  for(const cx of [400, 435, 365]){
    const mx = (px - cx) * s;      // 빌드
    const ix = mx / s + cx;        // 되쏘기
    near(ix, px, 1e-9, `cx=${cx}에서 왕복이 항등이 아니다`);
  }
});

test('⑥ project3DPointToView 왕복 — 회전은 정확한 역이어야 한다', () => {
  for(const a of ['front','left','right']){
    const cal = fakeCal(a);
    const R = composeRotationZYX(cal.yaw, cal.pitch, cal.roll);
    for(let i=0;i<9;i++){
      const s = [0,0,0,0,0,0,0,0,0];
      for(let r=0;r<3;r++) for(let c=0;c<3;c++)
        s[r*3+c] = R[r*3+0]*R[c*3+0] + R[r*3+1]*R[c*3+1] + R[r*3+2]*R[c*3+2];
      for(let r=0;r<3;r++) for(let c=0;c<3;c++)
        near(s[r*3+c], r===c?1:0, 1e-12, `${a} R·Rᵀ가 단위행렬이 아니다`);
      break;
    }
  }
});

/* ─────────────────────────────────────────────────────────────────
   ③ 소비자 일원화 — 이 저장소의 단골 실패
   같은 cal을 쓰는 자리가 여럿인데 그중 일부만 고쳐지면 두 공간이 갈라진다.
   9/07에 얼굴 라인(faceLineAlignFit)이 원본 cal을 써서 가닥이 코 위로 지나갔다.
   grep으로 못 박는다 — 새 소비자가 생기면 여기서 걸린다.
───────────────────────────────────────────────────────────────── */
test('⑦ 그리는 자리는 전부 calForDraw를 거친다', () => {
  const RAW = /(?:model|m)\s*\.viewCal\s*(?:&&[^\n]*?)?\[\s*(?:angle|a)\s*\]/;
  /* 면제는 <b>이유를 적어야</b> 추가할 수 있다. 이유 없이 늘어나면 이 검사가 죽는다. */
  const 허용 = {
    // combClipGrowPx·mannequinClipGrowPx는 cal.s(자 눈금)만 읽는다.
    // dx도 yaw도 s를 안 건드리므로 갈라질 것이 없다.
    '10-hair-render-2d.js': ['combClipGrowPx', 'mannequinClipGrowPx'],
    // calForDraw 자신이 원본을 읽는 자리
    '15-project-3d.js': ['검사 ⑦ 면제 지점'],   // calForDraw 자신이 원본을 읽는 유일한 자리
  };
  const 면제줄 = {
    '10-hair-render-2d.js': [796, 834],   // 위 두 함수의 cal 대입 줄
  };
  const 위반 = [];
  for(const f of loadOrder()){
    const p = path.join(JS, f); if(!fs.existsSync(p)) continue;
    const lines = fs.readFileSync(p,'utf8').split('\n');
    lines.forEach((ln, i) => {
      if(ln.trim().startsWith('*') || ln.trim().startsWith('//')) return;  // 주석
      if(!RAW.test(ln)) return;
      if(/calForDraw/.test(ln)) return;
      if((허용[f]||[]).some(k => ln.includes(k))) return;
      if((면제줄[f]||[]).includes(i+1)) return;
      // 값을 실제로 쓰는가? cal 변수로 받는 줄만 문제 삼는다.
      if(!/\bcal\s*=/.test(ln)) return;
      위반.push(`${f}:${i+1}  ${ln.trim()}`);
    });
  }
  ok(위반.length === 0,
    'viewCal 원본을 직접 쓰는 자리가 남아 있다. 그리기·되쏘기라면 calForDraw를 거쳐야 '
    + '한다(안 그러면 머리카락과 그 판정이 dx·yaw만큼 갈라진다):\n  ' + 위반.join('\n  '));
});

/* ─────────────────────────────────────────────────────────────────
   ④ 얼굴 깊이 — 미간 함몰
   측면 실측 z의 <b>상대 가중</b>이 각도 신뢰도를 반영해야 한다.
   예전 코드는 confidence만 썼다. 좌 50.8°(trust .79) · 우 41.2°(trust .31)처럼
   좌우 trust가 다르면, 깊이를 사실상 못 보는 41°짜리가 온전한 무게로 평균에
   들어가고 보정 크기는 좋은 쪽 trust로 곱해진다 → 정중선(이마·미간) realZ가
   얕게 나오고 map = realZ − frontZ 가 음수 → 함몰.
───────────────────────────────────────────────────────────────── */
test('⑧ 측면 깊이 가중치는 각도 신뢰도에 비례한다(미간 함몰)', () => {
  const w = ctx.__sideDepthWeight;
  ok(typeof w === 'function', '__sideDepthWeight를 못 찾았다 — 클로저 밖으로 빼 두어야 검사할 수 있다');
  const 좌 = { confidence: 0.9, trust: 0.79 };   // 50.8°
  const 우 = { confidence: 0.9, trust: 0.31 };   // 41.2°
  ok(w(좌) > w(우),
    `깊이를 더 잘 보는 뷰가 더 무거워야 한다 — 좌 ${w(좌)} vs 우 ${w(우)}. `
    + 'confidence만 쓰면 둘이 같아지고, 그게 미간 함몰의 몫이다.');
  near(w(우) / w(좌), 0.31/0.79, 1e-12, '가중비가 trust비와 같아야 한다');
  eq(w({ confidence: 0.9, trust: 0 }), 0, 'trust=0인 뷰는 아무 말도 하면 안 된다');
  eq(w(null), 0, '없는 뷰는 0');
});

test('⑨ trust가 같으면 예전 동작과 같다(정규화로 사라진다)', () => {
  /* 예전 주석의 "trust를 섞으면 정규화로 사라진다"는 <b>좌우가 같을 때만</b> 참이다.
     그 경우엔 실제로 같아야 한다 — 아니면 내가 다른 걸 바꾼 것이다. */
  const w = ctx.__sideDepthWeight;
  const a = { confidence: 0.8, trust: 0.6 }, b = { confidence: 0.4, trust: 0.6 };
  const za = 0.3, zb = 0.1;
  const 새 = (za*w(a) + zb*w(b)) / (w(a)+w(b));
  const 옛 = (za*a.confidence + zb*b.confidence) / (a.confidence+b.confidence);
  near(새, 옛, 1e-12, 'trust가 같은데 결과가 달라졌다 — 상대 가중 말고 뭔가 더 바뀌었다');
});

/* ─────────────────────────────────────────────────────────────────
   ⑩ (2026-09-09 2차) 투영기의 역이 <b>정말 역</b>인가.
   두피면 색은 정점을 사진 좌표로 되돌려 그 자리의 살을 집는다. 이 역변환이
   조금이라도 어긋나면 색이 <b>다른 자리</b>에서 오고, 그건 눈으로는 "톤이 좀
   안 맞네" 정도로만 보여서 오래 안 잡힌다. 그래서 기계가 잡는다.
───────────────────────────────────────────────────────────────── */
test('⑩ makeFaceProjector의 toImg*는 toMesh*의 정확한 역이다', () => {
  const mk = G('makeFaceProjector');
  ok(typeof mk === 'function', 'makeFaceProjector를 못 찾았다');
  const lm = { eyeY: 0.32, chinY: 0.62, lEarX: 0.29, rEarX: 0.71 };
  for(const [wf, hf] of [[1, 1], [1.12, 0.89], [0.93, 1.07]]){
    const p = mk(lm, wf, hf);
    ok(typeof p.toImgX === 'function' && typeof p.toImgY === 'function',
       'toImgX/toImgY가 없다 — 두피면 색이 좌표를 손으로 다시 풀게 된다');
    for(const u of [0, 0.17, 0.5, 0.83, 1]){
      near(p.toImgX(p.toMeshX(u)), u, 1e-12, `가로 왕복(wf=${wf})`);
      near(p.toImgY(p.toMeshY(u)), u, 1e-12, `세로 왕복(hf=${hf})`);
    }
  }
});

/* ─────────────────────────────────────────────────────────────────
   ⑬⑭ (2026-09-13) 의상은 <b>로컬에서</b> 고르고, <b>헤어를 따라 바뀐다</b>.
   사용자: "밖에 연결하지 말고 머리색이나 헤어스타일 등을 좀 참고해서,
   옷을 교체하는 메커니즘을 구현해줘."

   ⚠ 이 두 검사가 막으려는 것은 <b>이미 한 번 일어난 일</b>이다. 20-outfit-match.js는
     저장소에 있었지만 index.html에 <script> 줄이 없어 <b>한 번도 로드된 적이
     없었고</b>, recommendOutfitWithAI가 그대로 밖을 불러 401 → catch →
     OUTFIT_CATALOG[0]으로 떨어졌다. 증상은 "늘 차콜 슈트"였는데, 화면만 보면
     그게 고장인지 취향인지 알 수가 없다. 조용한 실패라 사람 눈으로는 안 잡힌다.
   ⑬은 배선(밖을 안 부른다)을, ⑭는 효과(옷이 실제로 갈린다)를 본다. 둘 다
   필요하다 — 배선만 보면 축이 전부 빠져 늘 같은 옷이 나와도 통과하고,
   효과만 보면 fetch가 다시 들어와도 통과한다.
───────────────────────────────────────────────────────────────── */
test('⑬ 이 앱은 밖을 부르지 않는다 — js/ 어디에도 네트워크 호출이 없다', () => {
  const hits = [];
  for(const f of loadOrder()){
    const p = path.join(JS, f);
    if(!fs.existsSync(p)) continue;
    const src = fs.readFileSync(p, 'utf8');
    for(const re of [/\bfetch\s*\(/, /XMLHttpRequest/, /navigator\.sendBeacon/]){
      if(re.test(src)) hits.push(f + ' → ' + re.source);
    }
  }
  eq(hits.length, 0, '네트워크 호출이 돌아왔다: ' + hits.join(' · ')
    + ' — 지우기 전에 이 검사부터 고쳐야 한다(11-result-screen.js의 callClaudeJSON 삭제 배너 참고)');

  ok(loadOrder().indexOf('20-outfit-match.js') >= 0,
     'index.html이 20-outfit-match.js를 안 싣는다 — 파일만 있고 배선이 없던 그 상태로 돌아갔다');
  ok(typeof G('recommendOutfitLocal') === 'function', 'recommendOutfitLocal이 없다');
});

test('⑭ 헤어가 바뀌면 의상도 바뀐다 — 카탈로그 네 벌이 전부 쓰인다', () => {
  const CAT = G('OUTFIT_CATALOG');
  for(const o of CAT){
    for(const ax of ['neckline','shoulder','busy']){
      ok(typeof o[ax] === 'number' && isFinite(o[ax]),
         `${o.name}에 ${ax} 축이 없다 — 축이 빠지면 20이 중립 0.5로 세어 네 벌의 `
         + '실루엣 점수가 같아지고, 머리를 어떻게 바꿔도 늘 같은 옷이 나온다');
    }
  }

  evalIn(ctx, 'OUTFIT_MATCH.log = false;');
  const seen = new Set();
  for(const tipAt of [1.00, 1.20, 1.40, 1.60, 1.90])
    for(const elevation of [0, 25, 45, 70, 90])
      for(const curl of [0, 30, 60, 100]){
        evalIn(ctx, `(function(){
          state._adjStamp = { '3D화면': { tipAt: ${tipAt} } };
          state.sections.crown.elevation = ${elevation};
          state.sections.crown.curl = ${curl};
          for(const id of SECTION_ORDER) state.sections[id].color = null;
        })()`);
        seen.add(evalIn(ctx, 'recommendOutfitLocal().item.id'));
      }
  eq(seen.size, CAT.length,
     `헤어 100조합에서 나온 의상이 ${seen.size}종뿐이다(카탈로그 ${CAT.length}벌) — `
     + '나온 것: ' + [...seen].join(', ')
     + ' · 축값이나 OUTFIT_MATCH.w가 한쪽으로 쏠렸는지 보십시오');

  /* 염색이 <b>실제로 판단에 들어가는지</b>. 색 가중치가 낮으면 실루엣이
     이미 크게 이긴 설정에서는 안 바뀌는 게 정상이라, "어떤 설정에서든 늘
     바뀐다"가 아니라 "바뀌는 설정이 있다"를 본다(w.color 배너의 9/18). */
  const flip = new Set();
  for(const dye of [null, '#E8C15A', '#2E5C9A', '#8B1A1A']){
    evalIn(ctx, `(function(){
      state._adjStamp = { '3D화면': { tipAt: 1.10 } };
      state.sections.crown.elevation = 10;
      state.sections.crown.curl = 60;
      for(const id of SECTION_ORDER) state.sections[id].color = ${dye ? `'${dye}'` : 'null'};
    })()`);
    flip.add(evalIn(ctx, 'recommendOutfitLocal().item.id'));
  }
  ok(flip.size > 1,
     '염색을 네 색으로 바꿔도 의상이 하나로 고정이다 — outfitColorFit이 염색을 '
     + '안 보거나(dominantDyeCss) OUTFIT_MATCH.w.color가 너무 낮다');
});

/* ─────────────────────────────────────────────────────────────────
   ⑮ (2026-09-13) 피부색의 <b>출처는 하나</b>다 — 두피면도 목도 같은 살 격자.
   사용자: "뒷머리 부분이 좀 다른 색이 나왔어. 이마쪽 색이랑 같은 색으로 하든지,
   근처 얼굴색으로 하는 방법으로 해봤으면 좋겠네."

   ⚠ 이건 이 저장소가 <b>반복</b>하는 모양이다: 한 값을 두 곳이 각자 정하다가
     한쪽만 고쳐진다. 9/9에 두피면이 "평균색 한 개 → 자리마다 다른 색"으로
     옮겨갈 때 목은 옛 방식에 남았고, 4일 뒤 화면에서 색 띠로 드러났다.
     화면에서 잰 값이 그 증거였다 — 색조·채도는 같고 밝기만 0.837배.
   검사는 <b>배선</b>을 본다(색 자체는 손님 사진에 달려 있어 단위검사로 못 잰다):
   목 메쉬 코드가 makeModelSkinSampler를 거치는가, 그리고 그 함수가 두피면과
   같은 격자(buildSkinColorField)를 쓰는가.
───────────────────────────────────────────────────────────────── */
test('⑮ 두피면과 목이 같은 살 격자에서 색을 집는다', () => {
  ok(typeof G('makeModelSkinSampler') === 'function',
     'makeModelSkinSampler가 없다 — 두피면·목이 각자 색을 정하던 때로 돌아갔다');

  const src = fs.readFileSync(path.join(JS, '12a-head-project.js'), 'utf8');
  /* ⚠ 주석을 <b>먼저 지운다</b>. 안 지우면 이 파일의 설명 주석이 함수 이름을
     그대로 적고 있어서, 호출을 통째로 빼도 검사가 통과한다 — 회귀를 실제로
     넣어 보고 나서야 알았다(README: "반드시 깨지는 것을 한 번 보고 나서 믿을 것").
     주석이 코드를 대신 증언하게 두면 검사가 아니라 장식이다. */
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const grab = (name) => {
    const i = code.indexOf('function ' + name + '(');
    ok(i >= 0, name + '을 못 찾았다');
    // 다음 최상위 function 선언까지를 본문으로 본다(이 파일은 전부 최상위 함수다)
    const j = code.indexOf('\nfunction ', i + 1);
    return code.slice(i, j < 0 ? code.length : j);
  };

  for(const fn of ['paintScalpFromPhoto', 'buildRealNeckMesh']){
    ok(grab(fn).indexOf('makeModelSkinSampler(') >= 0,
       fn + '이 makeModelSkinSampler를 안 부른다 — 색 출처가 다시 갈렸다');
  }
  ok(grab('makeModelSkinSampler').indexOf('buildSkinColorField(') >= 0,
     'makeModelSkinSampler가 살 격자를 안 쓴다');

  const NS = G('NECK_SHAPE');
  ok(NS.fromField === true, 'NECK_SHAPE.fromField가 꺼졌다 — 목이 평균색 한 개로 돌아간다');
  /* 격자를 쓸 때의 곱은 예전 곱보다 <b>1에 가까워야</b> 한다. 색이 이미 제자리라
     형태감만 남기면 되는데, 예전 값(0.78)을 그대로 두면 띠가 다시 보인다. */
  ok(NS.shadeRearField > NS.shadeRear && NS.shadeTopField > NS.shadeTop,
     `격자용 곱이 예전 곱보다 어둡다(뒤 ${NS.shadeRearField} vs ${NS.shadeRear}, `
     + `위 ${NS.shadeTopField} vs ${NS.shadeTop}) — 색을 맞춰 놓고 다시 어둡게 깎는 셈이다`);
  const worst = NS.shadeRearField * NS.shadeTopField;
  ok(worst >= 0.85,
     `뒤·위가 겹치는 최악에서 얼굴 대비 ${worst.toFixed(3)}배다 — 화면에서 "다른 색"으로 `
     + '보였던 값이 0.837이었으므로 그보다 확실히 위여야 한다');
});


/* ── ⑱ 페이드는 남지 않고, 등록 스타일의 클리퍼 구역은 새 손님에서 풀린다 (2026-09-16) ──
   ① 폼파두르를 한 번 건 뒤 "스타일 미적용"을 누르면 페이드가 꺼져 있어야 한다.
   ② lenCm에 side·nape가 없는(= 등록 손님에게서 못 잰) 스펙을 걸면 두 섹션이
      <b>루프에 들어가</b> 가드 길이로 풀려야 한다. 예전엔 루프에 안 들어가 기본값 50
      (손님 원래 길이)으로 남았고, 긴 머리 손님의 사이드 가닥이 어깨까지 내려왔다. */
test('⑱ 페이드 리셋 · 등록 스타일 클리퍼 구역(side·nape)이 새 손님에서 풀린다', () => {
  const st = G('state');
  // ① 리셋
  Object.assign(st.fade, { enabled:true, guard:2, disc:21, taper:80 });
  try{ G('selectNoStyle')(); }catch(e){ G('resetSections')(); }
  eq(st.fade.enabled, false, 'selectNoStyle 뒤 페이드가 켜져 있다');
  eq(st.fade.disc, 0, 'selectNoStyle 뒤 디스커넥션이 남아 있다');
  eq(st.fade.taper, 0, 'selectNoStyle 뒤 테이퍼가 남아 있다');

  // ② applyStyleSpec — 무거운 측정기는 가짜로 바꾼다(배선만 본다)
  const names = ['headHeightRef','solveSectionLengthForCm','measureSectionLenCm','modelCmPerUnit',
                 'solvePoolFor','reportSilhouette','diagCrownCoverage','logCurlScale'];
  const saved = {}; for(const n of names) saved[n] = G(n);
  const savedModel = st.hair3Dneutral;
  const calls = [];
  try{
    st.hair3Dneutral = { strands:[{ pts:[{x:0,y:0,z:0}] }] };
    ctx.headHeightRef = () => ({ yTop:1, H:2 });
    ctx.modelCmPerUnit = () => 19.3;
    ctx.solvePoolFor = () => null;
    ctx.reportSilhouette = ctx.diagCrownCoverage = ctx.logCurlScale = () => null;
    ctx.measureSectionLenCm = (sec, v) => 4;
    ctx.solveSectionLengthForCm = (sec, cm, view, aboveY) => {
      calls.push({ sec, cm, aboveY });
      if(sec === 'nape') return null;       // 라인 위에 가닥 없음
      if(sec === 'side') return 7;          // 라인 위에 가닥 조금 있음
      return 20;
    };
    G('resetSections')();
    const id = '__t18_spec';
    G('STYLE_SPECS')[id] = {
      name:'t18', cut:{}, lenCm:{ crown:4.2, front:3.1, temple:5.7, occipital:8.3 },
      lenFallback:{ crown:6, front:17, temple:15, side:6, occipital:13, nape:50 },
      fade:{ enabled:true, guard:2, height:65, blendWidth:45, disc:21, taper:80 },
    };                                       // clipperZone 표시가 없는 <b>예전 저장본</b>과 같은 모양
    G('applyStyleSpec')(id);
    delete G('STYLE_SPECS')[id];
    const sideCall = calls.find(c => c.sec === 'side');
    ok(sideCall, 'side가 역산 루프에 안 들어갔다 — 기본값 50(원래 길이)으로 남는다');
    near(sideCall.cm, 2 * 2.54/8, 1e-9, 'side 목표가 가드 2 길이(cm)가 아니다');
    ok(typeof sideCall.aboveY === 'number', 'side 역산이 라인 위 가닥으로 제한되지 않았다');
    eq(st.sections.side.length, 7, 'side 길이');
    eq(st.sections.nape.length, 0, '라인 위 가닥이 없는 nape는 슬라이더 바닥이어야 한다(클리퍼가 민다)');
    ok(st.sections.side.length !== 50 && st.sections.nape.length !== 50, '클리퍼 구역이 기본값 50으로 남았다');
    eq(st.fade.enabled, true, '스펙의 페이드는 역산 뒤 다시 켜져야 한다');
  } finally {
    for(const n of names) ctx[n] = saved[n];
    st.hair3Dneutral = savedModel;
    G('resetSections')();
  }
});

/* ── ⑲ 후면(얼굴 없는 뷰)은 두개골 실루엣으로 살 구역을 자르지 않는다 (2026-09-16 2차) ──
   실루엣 앵커로 선 후면 viewCal의 두개골은 사진 두상보다 작아, 타원 아랫부분이 벽색으로
   칠해져 투명하게 보였다. 얼굴이 있는 뷰는 예전대로 자른다(측면 긴 머리 뒤 허공 방지). */
test('⑲ 후면 2D — 얼굴 없는 뷰는 skullClip이 안 걸리고, 얼굴 있는 뷰는 걸린다', () => {
  const st = G('state');
  const HF = G('HOLE_FILL');
  const savedModel = st.hair3Dneutral, savedLm = st.landmarks;
  const savedCal = ctx.calForDraw;
  try{
    ctx.calForDraw = (m, a) => m.viewCal[a];
    st.hair3Dneutral = { strands:[], viewCal:{ front:{cx:300,s:0.002,sy:0.002,yaw:0}, back:{cx:300,s:0.002,sy:0.002,yaw:0} } };
    st.landmarks = { front:{ poseYawDeg:0 } };           // 후면은 랜드마크 없음
    ok(G('skullClipCal')('front'), '얼굴 있는 정면은 두개골 실루엣으로 잘라야 한다');
    eq(G('skullClipCal')('back'), null, '후면이 두개골로 잘린다 — 타원 아랫부분이 벽색(투명)으로 메워진다');
    eq(G('skullClipSig')('back'), 'none', '후면 캐시 서명이 두개골 자를 따라가면 안 된다');
    HF.skullClip.faceless = true;
    ok(G('skullClipCal')('back'), '되돌리기 손잡이(faceless=true)가 안 먹는다');
  } finally {
    HF.skullClip.faceless = false;
    ctx.calForDraw = savedCal; st.hair3Dneutral = savedModel; st.landmarks = savedLm;
  }
});

module.exports = { T, app };

/* ─────────────────────────────────────────────────────────────────
   ⑫ (2026-09-12) 크라운은 맨 마지막에 그린다 — 그리고 <b>두 곳이 같이</b>.
   사용자(미용사): "크라운이 프론트 안쪽으로 들어가 있는데, 맨 마지막으로 얹어줘."
   ⚠ 이 앱에서 겹 순서를 정하는 자리는 <b>둘</b>이다:
       ① projected.sort      — 가닥 단위
       ② 배치(batch) keys.sort — 실제 stroke 순서
     ②가 평균 깊이로 다시 줄을 세우므로 ①만 고치면 그 결과가 통째로 지워진다.
     그래서 검사하는 것은 "크라운이 위냐"가 아니라 <b>두 정렬이 같은 키를
     쓰느냐</b>다. 한쪽만 고치는 다음 수정을 여기서 막는다.
   ⚠ LAYER_SORT는 08-cut-engine.js에 <b>이미 있었는데</b> 15-project-3d.js가
     안 쓰고 있었다(tieByRootHeight도 마찬가지). 손잡이만 있고 배선이 없던
     자리다 — 그것도 이 검사가 같이 잡는다.
───────────────────────────────────────────────────────────────── */
test('⑫ 크라운 맨 위 — 가닥 정렬과 배치 정렬이 같은 키를 쓴다', () => {
  const LS = G('LAYER_SORT');
  ok(Array.isArray(LS.topSections), 'LAYER_SORT.topSections가 없다');
  ok(LS.topSections.indexOf('crown') >= 0,
     '크라운이 topSections에서 빠졌다 — 미용사가 맨 위로 올려 달라고 한 자리다');

  const src = fs.readFileSync(path.join(JS, '15-project-3d.js'), 'utf8');
  ok(/sec:\s*st\.sec/.test(src), 'projected 항목에 sec이 안 실린다 — 정렬이 섹션을 모른다');
  ok(/projected\.sort\([\s\S]{0,300}?_rank\(a\)\s*-\s*_rank\(b\)/.test(src),
     '가닥 정렬이 topSections를 1차 키로 안 쓴다');
  ok(/rank:\s*rankOf\(p\)/.test(src), '배치 항목에 rank가 안 담긴다');
  ok(/batch\.values\(\)[\s\S]{0,200}?a\.rank\s*-\s*b\.rank/.test(src),
     '배치 정렬이 rank를 1차 키로 안 쓴다 — 여기가 진짜 그리는 순서다');
});

/* ─────────────────────────────────────────────────────────────────
   ⑯ 후면 두상 안 이식 — 승격은 <b>두 마스크</b>에 같이 찍혀야 한다 (2026-09-14 3차)

   이 저장소가 반복하는 실패 모양이 여기서도 그대로 났다: <b>한 값을 두 곳이
   각자 쓰다가 한쪽만 고쳐졌다</b>.
   화면은 [메움 배경] 위에 [baseC 정리본]을 얹어 만든다. 2차(잔재 회수)는
   메움 배경이 쓰는 <b>축소 사본</b>에만 구멍을 승격했고, 정리본이 쓰는
   <b>원본 해상도 마스크</b>(getHoleMask 캐시)는 안 건드렸다. 그래서 아래에서
   아무리 곱게 이식해도 위에 원본 머리 잔재가 그대로 덮여 눈자국이 남았다.
   검사하는 것은 "예뻐 보이냐"가 아니라 <b>두 마스크가 같은 모양을 받느냐</b>다.
───────────────────────────────────────────────────────────────── */
test('⑯ 후면 이식 — 타원 승격이 메움판과 baseC 양쪽에 같은 모양으로 찍힌다', () => {
  const markEllipseHole = G('markEllipseHole');
  ok(typeof markEllipseHole === 'function', 'markEllipseHole이 없다');

  const ell = { cx: 0.5, cy: 0.45, rx: 0.22, ry: 0.30 };
  const FF = G('HOLE_FILL').facelessFill;
  ok(FF && FF.on, 'HOLE_FILL.facelessFill이 꺼져 있다 — 후면 타원 안이 다시 사진에서 색을 가져간다');

  // 같은 타원을 두 해상도에 찍고, 면적 비율이 같은지 본다(해상도 독립 = 정규 좌표).
  const run = (w, h) => {
    const m = new Uint8Array(w*h);
    const n = markEllipseHole(m, w, h, ell, FF.shrink);
    return n / (w*h);
  };
  const small = run(180, 240), big = run(720, 960);
  ok(small > 0.02, '승격 면적이 0에 가깝다 — 타원 안이 안 넘어간다');
  near(small, big, 0.004, '해상도가 바뀌면 승격 모양이 달라진다(정규 좌표가 아니다)');

  // 기대 면적 = 타원 넓이 × shrink² (π·rx·ry)
  const want = Math.PI * ell.rx * ell.ry * FF.shrink * FF.shrink;
  near(big, want, 0.004, '승격 면적이 타원 넓이와 다르다');

  // 이미 구멍인 자리를 두 번 세지 않는다(진단 숫자가 거짓말하면 다음 사람이 헤맨다)
  const m2 = new Uint8Array(200*200).fill(1);
  eq(markEllipseHole(m2, 200, 200, ell, FF.shrink), 0, '이미 구멍인 자리를 또 승격으로 셌다');

  // 배선 검사 — 승격이 <b>원본 해상도 마스크</b>에도 가고, 정리본 캐시를 무효화하는가
  const src = fs.readFileSync(path.join(JS, '07a-render-canvas.js'), 'utf8');
  ok(/markEllipseHole\(\s*hole\s*,\s*ow\s*,\s*oh/.test(src),
     '메움판(출력 해상도 사본)에 승격이 안 간다');
  ok(/markEllipseHole\(\s*hm\.hole\s*,\s*hm\.w\s*,\s*hm\.h/.test(src),
     'baseC가 쓰는 원본 해상도 마스크에 승격이 안 간다 — 2차의 실패가 그대로 돌아왔다');
  ok(/_cleanBase\s*=\s*null/.test(src),
     '정리본 캐시를 무효화하지 않는다 — 이미 만들어진 정리본이 옛 마스크로 계속 덮는다');

  // 얼굴이 잡힌 뷰에서는 절대 돌지 않아야 한다(정면 이목구비를 살색으로 밀어버린다)
  ok(/const\s+noFace\s*=\s*!\(.*state\.landmarks\s*&&\s*state\.landmarks\[angle\]\)/.test(src),
     '랜드마크 게이트가 없다 — 정면·측면에서 이 경로가 돌면 얼굴이 사라진다');
  ok(/const\s+faceless\s*=[^;]*noFace/.test(src), 'faceless 판정이 noFace를 안 쓴다');

  // 이식면의 색은 사진이 아니라 표본에서 와야 한다(눈모양이 들어올 경로 차단)
  ok(/graft\.mean\[ch\]\s*\*\s*shade/.test(src),
     '이식 색이 표본 평균이 아니다 — od(사진)에서 색이나 밝기를 받으면 스윕 자국이 음영으로 되살아난다');
});

/* ─────────────────────────────────────────────────────────────────
   ⑰ 두피면은 얼굴과 <b>겨루지 않는다</b> (2026-09-14 3차)

   사용자: "얼굴쪽에 칠해진 메움이 눈까지 타고 올라갔는데."
   볼록한 두개골 타원체는 오목한 얼굴(안와·콧대 옆·관자놀이)보다 앞에 서므로
   깊이 검사에서 이긴다 — 깊이 오프셋으로는 절대 못 이기는 싸움이다.
   그래서 두피면은 얼굴이 불투명한 자리를 <b>비운다</b>. 이 검사가 지키는 것은
   두 가지다: ① 자(경계 타원)가 두 곳에 복제되지 않았는가 ② 비우는 규칙이
   뒤통수까지 지우지 않는가(정사영이라 앞뒤가 같은 (x,y)로 접힌다).
───────────────────────────────────────────────────────────────── */
test('⑰ 두피면 — 얼굴 경계 자는 하나뿐이고, 비우기가 뒤통수를 안 지운다', () => {
  const faceBoundEllipseNorm = G('faceBoundEllipseNorm');
  const FBF = G('FACE_BOUND_FIT');
  ok(typeof faceBoundEllipseNorm === 'function', 'faceBoundEllipseNorm이 최상위에 없다');
  ok(FBF && FBF.on && FBF.fadeIn > 1, 'FACE_BOUND_FIT가 최상위에서 안 보인다(두피면이 fadeIn을 못 읽는다)');

  // 옮기기 전 식과 산술이 같아야 한다 — 값이 바뀌면 얼굴 테두리가 같이 움직인다
  const lm = { browTopY: 0.30, chinY: 0.62, lEarX: 0.24, rEarX: 0.76,
               features: { leftEye:{minX:0.36,maxX:0.44}, rightEye:{minX:0.56,maxX:0.64} } };
  const b = faceBoundEllipseNorm(lm);
  const topY = 0.30*0.90, botY = 0.62*1.10;
  near(b.cx, 0.50, 1e-9, '경계 중심 x가 두 눈 중점이 아니다');
  near(b.cy, (topY+botY)/2, 1e-9, '경계 중심 y가 달라졌다');
  near(b.ry, (botY-topY)/2*1.08, 1e-9, '경계 세로 반지름이 달라졌다');
  near(b.rx, Math.abs(0.76-0.24)*0.56*1.08, 1e-9, '경계 가로 반지름이 달라졌다');

  // 같은 식이 12a에 <b>두 번</b> 적혀 있으면 안 된다(한쪽만 고쳐지는 그 실패)
  const src = fs.readFileSync(path.join(JS, '12a-head-project.js'), 'utf8');
  const dup = (src.match(/\*\s*0\.56\s*\*\s*1\.08/g) || []).length;
  eq(dup, 1, '경계 가로 반지름 식이 여러 곳에 복제돼 있다 — 자는 한 곳에만 둬야 한다');
  eq((src.match(/keepT:\s*1\.22/g) || []).length, 1, 'FACE_BOUND_FIT가 두 번 정의돼 있다');

  // 비우기 규칙: 앞면(z>0)만 센다 — 안 그러면 뒤통수가 통째로 사라진다
  ok(/if\(pos\.getZ\(i\)\s*<=\s*0\)\s*continue;/.test(src),
     '두피면 비우기가 뒤통수를 거르지 않는다 — 정사영이라 뒤통수가 앞면과 같은 (x,y)로 접힌다');
  ok(/opaque\[a\]\s*&&\s*opaque\[b\]\s*&&\s*opaque\[c\]/.test(src),
     '삼각형을 "셋 다"가 아니라 하나만 걸려도 버린다 — 경계가 벌어진다');
  ok(/if\(!keep\.length\s*\|\|\s*dropped\s*===\s*0\)\s*return;/.test(src),
     '전부 버려질 때의 안전장치가 없다');

  // 앞→뒤 밝기 배율: 색조는 안 건드리고 밝기만, 앞은 1.0
  const BS = G('SCALP_SKIN').backShade;
  ok(BS && BS.on, 'SCALP_SKIN.backShade가 꺼져 있다 — 뒤통수가 안면 밝기로 칠해진다');
  ok(BS.back > 0.6 && BS.back < 1,
     `뒤통수 배율 ${BS.back}가 범위를 벗어났다 — 1이면 예전처럼 밝고, 너무 낮으면 두피면만 검어진다`);
  const shade = nz => BS.back + (1 - BS.back) * (0.5 + 0.5*nz);
  near(shade( 1), 1, 1e-9, '앞면 배율이 1이 아니다 — 이마 위 색이 얼굴과 갈라진다');
  near(shade(-1), BS.back, 1e-9, '뒤통수 배율이 설정값과 다르다');
  ok(shade(0) > shade(-1) && shade(0) < shade(1), '옆면이 앞뒤 사이에 있지 않다');
  ok(/col\[i\*3\]\s*=\s*c\[0\]\*sh;\s*col\[i\*3\+1\]\s*=\s*c\[1\]\*sh;\s*col\[i\*3\+2\]\s*=\s*c\[2\]\*sh;/.test(src),
     '세 채널에 같은 수를 곱하지 않는다 — 밝기만 바꿔야 하는데 색조가 돈다');
});
