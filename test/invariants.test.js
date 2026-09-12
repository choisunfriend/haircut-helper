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
