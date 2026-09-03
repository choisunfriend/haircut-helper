/* ══════════════════════════════════════════════════════════
   02-state-sections.js — SECTIONS·SECTION_ORDER · gyeol 공정 정의 · 전역 state
   원본 index.html 5157~5922행. 클래식 스크립트이므로 로드 순서가 곧
   실행 순서다 — index.html의 <script src> 순서를 바꾸지 말 것.
   ══════════════════════════════════════════════════════════ */
/* ════════════════════════════════════════
   STATE
════════════════════════════════════════ */
const ANGLES = ['front','left','right','back'];
const ANGLE_LABELS = {front:'정면', left:'좌측', right:'우측', back:'후면'};
// (2026-07-26) 좌/우 안내가 "어느 쪽 옆머리를 보여줄지"인지 "고개를 어느 쪽으로
// 돌릴지"인지 헷갈려 반대로 찍히는 문제가 있어, 두 가지를 한 문장에 명시.
const HINTS = {front:'정면을 맞춰주세요', left:'왼쪽 옆머리가 보이게 — 고개를 오른쪽으로 돌려주세요', right:'오른쪽 옆머리가 보이게 — 고개를 왼쪽으로 돌려주세요', back:'후면(뒷머리)을 맞춰주세요'};

/* ── 섹션 정의 ──
   각 섹션: 미용사가 실제로 커트하는 구역
   yRange/xRange: 이미지 내 위치 비율 (0~1)
   visibleIn: 어느 뷰에서 보이는가
   linkedParams: 다른 섹션 조정 시 연동되는 파라미터
*/
// 엘리베이션·컬 파라미터 범위 — 크라운/사이드/후두부가 같은 리터럴을 각자
// 적어두고 있던 것을 통합(2026-07-26). 세 섹션이 항상 같은 범위를 쓰는 게 맞다.
const ELEV_CURL_META = { elevation:{min:0, max:90, unit:'°'}, curl:{min:0, max:200, unit:'%'} };
const SECTIONS = {
  crown: {
    id:'crown', label:'크라운', labelEn:'CROWN',
    desc:'정수리 · 엘리베이션(시술각) 기준',
    yRange:[0, 0.28], xRange:[0.15, 0.85],
    visibleIn:['front','left','right','back'],
    params:['length','elevation','curl'],
    // 엘리베이션(시술각): 실제 미용 기법 그대로 — 두피에서 모발을 얼마나
    // 들어올려서 자르는지(0°~90°). 0°(무시술각)=원랭스, 무게감 유지, 볼륨 없음.
    // 90°(이상)=완전 레이어, 무게 제거, 볼륨↑. "볼륨"이 따로 있던 게 아니라
    // 전부 엘리베이션의 결과였음 — 그래서 volume 파라미터를 없애고 이걸로 통합.
    // curl: 전역 컬(state._globalCurl)에 대한 이 섹션만의 배율(%). 100%=전역과
    // 동일(기본값, 손 안 대면 변화 없음), 0%=이 섹션만 스트레이트, 200%=전역의
    // 2배. 부분펌(스택펌 — 크라운만 다른 로드 쓰는 것)을 표현하기 위함.
    paramMeta: ELEV_CURL_META,
    // gyeol 확장(2026-07-20): 커트기법·텍스처·웨이브·섹션컬러를 전 섹션 공통으로 추가.
    // curl 의미 변경 — 예전엔 "전역컬 대비 %배율(기본100)"이었으나, gyeol UI는
    // 섹션별 컬을 절대값(0~100)으로 다루므로 절대 진폭(기본30=기존 전역컬 30과 동일)으로 통일.
    defaults:{technique:'uniform', length:50, elevation:45, texture:0, density:100, curl:30, wave:50, curlDir:0, color:null},
  },
  front: {
    id:'front', label:'프론트', labelEn:'FRONT',
    desc:'앞머리 · 커팅라인(실제로는 Fringe 개념)',
    yRange:[0.20, 0.45], xRange:[0.22, 0.78],   // (2026-08-11) 위 SCALP_ZONES.front와 같은 이유로 넓힘
    visibleIn:['front'],
    params:['length','line'],
    // gyeol 확장: elevation/texture/curl/wave/technique/color 추가. line(커팅라인)은
    // 렌더러(frontDirBiasFor)가 계속 참조하므로 기본 50(중립)으로 유지.
    defaults:{technique:'uniform', length:50, elevation:20, texture:0, density:100, curl:30, wave:50, curlDir:0, color:null, line:50},
  },
  temple: {
    id:'temple', label:'템플', labelEn:'TEMPLE',
    desc:'관자놀이 · 크라운 연동비율(Overdirection)',
    yRange:[0.20, 0.50], xRange:[0, 1],   // xRange는 좌우 양쪽 (렌더 시 분기)
    visibleIn:['front','left','right'],
    params:['length','overdirection'],
    // 크라운 연동비율(영문 기법명: Overdirection) — 실제 미용 기법: 이 섹션의
    // 모발을 자연스럽게 떨어지는 방향이 아니라 다른 기준선(가이드라인, 여기선
    // 크라운)으로 당겨서 자르는 정도. 한글 UI에선 실제 동작(크라운 길이를
    // 얼마나 따라가는지)이 바로 와닿게 "크라운 연동비율"로 표기, 영문판에선
    // 기법 정식명칭 그대로 Overdirection 사용 예정.
    // 0%=독립적(크라운이 바뀌어도 템플은 그대로) ~ 100%=크라운과 거의 동일하게 따라감.
    paramMeta:{ overdirection:{min:0, max:100, unit:'%'} },
    // gyeol 확장: overdirection(크라운 연동비율)은 propagateSectionChange가 계속
    // 참조하므로 기본 50으로 유지. 나머지 gyeol 공통 파라미터 추가.
    defaults:{technique:'uniform', length:50, elevation:30, texture:0, density:100, curl:30, wave:50, curlDir:0, color:null, overdirection:50},
  },
  side: {
    id:'side', label:'사이드', labelEn:'SIDE',
    desc:'귀 앞·뒤 · 엘리베이션(시술각) 기준',
    yRange:[0.28, 0.72], xRange:[0, 1],
    visibleIn:['left','right'],
    params:['length','elevation','curl'],
    paramMeta: ELEV_CURL_META,
    defaults:{technique:'uniform', length:50, elevation:30, texture:0, density:100, curl:30, wave:50, curlDir:0, color:null},
  },
  occipital: {
    id:'occipital', label:'후두부', labelEn:'OCCIPITAL',
    desc:'뒤통수 · 엘리베이션(시술각) 기준',
    yRange:[0.30, 0.68], xRange:[0.10, 0.90],
    visibleIn:['back','left','right'],
    params:['length','elevation','curl'],
    paramMeta: ELEV_CURL_META,
    defaults:{technique:'uniform', length:50, elevation:50, texture:0, density:100, curl:30, wave:50, curlDir:0, color:null},
  },
  nape: {
    id:'nape', label:'네이프', labelEn:'NAPE',
    desc:'목선 마무리 · 커팅라인',
    yRange:[0.68, 1.0], xRange:[0, 1],
    visibleIn:['back','front','left','right'],
    params:['length','line'],
    // gyeol 확장: line(스퀘어/라운드/테이퍼)은 lengthRatioFor가 계속 참조하므로 유지.
    defaults:{technique:'uniform', length:50, elevation:0, texture:0, density:100, curl:30, wave:50, curlDir:0, color:null, line:50},
    // 길이 기본값만 네이프는 35로 다른 섹션(80)보다 낮게 유지 — 사용자 설명:
    // "일반 커트는 줄이는 방향만 있지 늘리는 방향은 스타일 새로 만들 때뿐이고,
    // 네이프는 원래 길어야 하는 부위도 아니다" — 목선은 자연스럽게 짧은 게
    // 기본이 맞음. 다른 5개 섹션(크라운/프론트/템플/사이드/후두부)만 80으로
    // 통일한 이유("이건 커트지 스타일 새로 만드는 게 아니니 원본에 가깝게")가
    // 네이프에는 반대로 적용됨.
  },
};

// 섹션 커트 순서 (미용사 작업 순서)
const SECTION_ORDER = ['crown','front','temple','side','occipital','nape'];

/* ────────────────────────────────────────────────────────────────
   gyeol 2D 설계 UI 이식(2026-07-20)
   조정 화면의 컨트롤 UI/UX를 gyeol-2d 구성(섹션칩 → 커트/펌/컬러 공정그룹 +
   커트기법 선택 + 스타일링 마무리 탭)으로 교체하기 위한 정의들.
   ★ 캔버스 렌더는 index의 실측 세그 파이프라인(drawHairStrands)을 그대로 쓰고,
     여기 신규 파라미터(technique/texture/wave/color/styling)를 전부 그 렌더러에
     "기본값=중립(기존 동작과 동일)"으로 가산 연결한다.
   ──────────────────────────────────────────────────────────────── */
/* ════════════════════════════════════════════════════════════════
   gyeol 공정 정의 — 커트기법·색·공정그룹·스타일링 파라미터
   화면에 뿌릴 데이터 정의만 모임(로직 없음). 실제 조정 UI는 아래
   "gyeol 2D 설계 패널 빌더" 구역이 이 정의들을 읽어 만든다.
   ════════════════════════════════════════════════════════════════ */
// 커트 기법 — 섹션 높이(rootT)에 따른 길이 분포(겹)를 만든다. lengthRatioFor에서 사용.
const TECHNIQUES = {
  onelength:  { label:'원랭스',          hint:'한 라인 · 무게감 하단' },
  graduation: { label:'그라데이션',      hint:'사선 · 무게 쌓임' },
  uniform:    { label:'유니폼 레이어',   hint:'균일 층 · 가벼움' },
  increase:   { label:'인크리스 레이어', hint:'위로 갈수록 길게' },
};
// gyeol 컬러 스와치(섹션별 컬러 = 발레아쥬 등 부분 염색 표현)
/* ── (2026-09-01) 스펙 색 두 개를 <b>팔레트에 넣는다</b> ─────────────────────
   사용자 지시: "두 스타일을 사용자가 <b>조작해서</b> 만들 수 있게." 커트·펌·
   스타일링은 전부 슬라이더가 있는데 <b>색만</b> 프리셋 전용이었다 —
   STYLE_SPECS.layered_bob_hush.color(#7A6149)와 taper_fade_pomp.color(#60554E)가
   이 목록에 없어서, 미용사가 손으로는 그 색을 <b>고를 수가 없었다</b>.
   두 스펙이 p80을 base로 잡아 실측한 값이라(각 스펙 주석 참고) 팔레트에
   있어야 할 자격이 충분하다. 뒤에 붙인다 — 앞에 끼우면 기존 커스텀 스타일이
   저장해 둔 색 인덱스가 밀린다(색은 hex로 저장되므로 실제 피해는 없지만,
   스와치 순서가 바뀌면 사용자가 기억한 자리가 어긋난다). */
const GYEOL_COLORS = ['#2B2016','#4A3421','#6B4A2E','#8B5A2B','#A9713C','#C89860','#3A2E4A','#7A3B4A','#B0788F',
                      '#7A6149','#60554E'];
// 공정 그룹 — 섹션 탭 내부를 커트→펌→컬러로 정리(gyeol 구성)
const GYEOL_GROUPS = [
  { id:'cut',  title:'커트', sub:'형태', color:'var(--gy-cut)', optional:false,
    params:[
      {key:'length',    label:'길이',         hint:'모발 길이',   min:10, max:100, unit:'%'},
      {key:'elevation', label:'엘리베이션',   hint:'시술각',      min:0,  max:90,  unit:'°'},
      {key:'texture',   label:'텍스처라이징', hint:'끝단 숱·질감', min:0,  max:100, unit:'%'},
      /* ── 숱치기(틴닝) 신설 (2026-08-09) ────────────────────────────────
         텍스처라이징과 <b>다른 시술</b>이다. 텍스처는 <b>끝단</b>을 가닥마다
         다른 길이로 쳐서 가볍게 하는 것이고(가닥 수는 그대로), 숱치기는
         틴닝가위로 <b>중간 가닥을 솎아내는</b> 것이다(가닥 수가 준다).
         둘을 한 손잡이로 묶으면 <b>시스루 뱅을 못 만든다</b> — 시스루는
         "끝이 뾰족한 두꺼운 앞머리"가 아니라 "이마가 비치는 성긴 앞머리"라
         가닥 자체가 적어야 한다. 실기기에서 앞머리가 불투명한 커튼으로
         나오던 직접 원인이 이 손잡이의 부재였다.
         100 = 그대로 · 40 = 40%만 남김(=60% 솎음). */
      {key:'density',   label:'숱',           hint:'숱치기 · 낮을수록 비침', min:15, max:100, unit:'%'},
      /* ── 오버디렉션 손잡이 복구 (2026-08-26) ────────────────────────────
         사용자: "얘 지금 3D에 표현되고 있다는 거잖아. 그럼 조절되어야 되는 거잖아."
         맞다. cutRatioForStrand(관자 분기)가 sec.overdirection을 <b>읽고</b> 있는데
         이 목록에 없어서 미용사가 만질 수가 없었다. 파일 815행이 2026-08-11에
         "3D엔 닿는데 슬라이더가 없다"고 적어 두고 <b>그대로 15일을 둔</b> 자리다.
         손잡이 없는 파라미터는 프리셋 작성자만 쓸 수 있고, 그건 이 앱이 지향하는
         "미용사가 만지는 도구"가 아니다.
         ⚠ 지금은 <b>관자에만</b> 붙는다 — 읽는 쪽이 st.sec === 'temple' 분기라서다.
           다른 섹션에 슬라이더를 띄우면 만져도 아무 일이 안 일어나는 손잡이가 된다
           (그게 이 파일이 반복해서 당한 "무반응 슬라이더"다). onlySec으로 거른다.
         0 = 그 자리에서 자름(오버디렉션 없음) · 100 = 크라운 가이드까지 끌어올림.
           값이 클수록 관자가 길어지고 앞이 무거워진다 = A라인. */
      {key:'overdirection', label:'오버디렉션', hint:'크라운 가이드로 끌어올림 · A라인',
       min:0, max:100, unit:'%', onlySec:'temple'},
      /* ── 커팅라인 손잡이 (2026-09-01) ──────────────────────────────────
         파일 1209행 "도달성 실측"이 line을 <b>죽었다</b>고 판정하고 "살릴지
         정리할지 정하기 전"이라고 적어 둔 지 3주가 지났다. 사용자가 그
         유예를 끝냈다 — "전부 3D를 먼저 건드리는 거잖아."
         이번에 cutRatioForStrand ③-b로 <b>3D 커트 경로에 넣었고</b>, 그래서
         이제 손잡이를 달아도 실제로 먹는다(순서: 연산자 먼저, 손잡이 다음).
         0 = 스퀘어(일자 밑단·일자 뱅) · 50 = 라운드(중립) · 100 = 테이퍼(V)
         ⚠ front·nape만이다. 읽는 쪽이 두 섹션으로 분기한다. */
      {key:'line', label:'커팅라인', hint:'0=스퀘어(일자) · 50=라운드 · 100=테이퍼(V)',
       min:0, max:100, unit:'', onlySec:['front','nape']},
    ]},
  { id:'perm', title:'펌', sub:'컬', color:'var(--gy-perm)', optional:true,
    params:[
      {key:'curl', label:'컬 세기',   hint:'0이면 펌 없음', min:0, max:100, unit:'%'},
      {key:'wave', label:'웨이브 폭', hint:'로드 굵기',     min:0, max:100, unit:'%'},
      /* ── 컬 방향 신설 (2026-08-18 k, 사용자 지시 "컬방향도 조정해야 하고") ──
         나선이 <b>어디서 시작해 어디로 도는가</b>. 예전엔 임의의 축(up=(0,1,0))에서
         프레임을 만들어 가닥마다 위상이 제각각이었다 — 그래서 방향이라는 개념
         자체가 없었다. 이제 위상 기준이 <b>두상 바깥 방향</b>이라 뜻이 생긴다.
         −100 안말음(C컬) ↔ 0 접선 ↔ +100 바깥말음. ±100은 위상 ±π로 같은 자리라
         손잡이가 끝에서 튀지 않는다.
         ※ 좌권/우권(감는 손 방향)은 아직 없다 — 필요해지면 여기 옆에 붙일 자리다. */
      {key:'curlDir', label:'컬 방향', hint:'안말음 ↔ 바깥말음', min:-100, max:100, unit:''},
    ]},
  { id:'color', title:'컬러', sub:'선택', color:'var(--gy-color)', optional:true, params:[] },
];
// 스타일링(마무리) — 커트/펌/컬러 위에 얹히는 머리 전체 연출. state.styling 참조.
const GYEOL_STYLING_PARAMS = [
  {key:'sweep',  label:'넘김',       min:-100, max:100, left:'앞으로',   right:'뒤로',    neutral:0},
  {key:'volume', label:'뿌리 볼륨',  min:0,    max:100, left:'눌러줌',   right:'세움',    neutral:50},
  {key:'flow',   label:'결 흐름',    min:-100, max:100, left:'안말음 C', right:'바깥말음', neutral:0},
  /* ── 가르마는 <b>위치</b>와 <b>세기</b>가 따로다 (2026-08-18 k) ─────────────
     예전엔 part 하나였고 0이 "가르마 없음"이었다. 그래서 <b>중간 가르마</b>를
     만들 방법이 없었다(가장 흔한 가르마인데). 이제 part는 위치만 말한다. */
  {key:'part',    label:'가르마 위치', min:-100, max:100, left:'좌',    right:'우',    neutral:0},
  {key:'partAmt', label:'가르마 세기', min:0,    max:100, left:'없음',  right:'또렷',  neutral:0},
  {key:'finish', label:'마무리 질감', min:0,    max:100, left:'매트',     right:'윤기',    neutral:50},
  /* ── 정돈(2026-08-26) — <b>슬라이더 없이</b> 목록에만 있다 ─────────────────
     사용자 지시가 "슬라이더 새로 만들 건 없고, 모듈화한 버튼 하나"였다. 그런데
     여기 목록에서 빼 버리면 STYLING_KEYS에도 안 들어가고, 그러면 <b>캐시 서명이
     이 값을 못 본다</b> — 프리셋이 켜도 지난 결과가 나오는, 이 파일이 반복해서
     당한 그 자리다(fade·disc와 같은 함정).
     그래서 <b>목록에는 두고 UI만 건너뛴다</b>(hidden). 이러면
       · STYLING_KEYS · adjCacheSig · neutralStyling이 전부 자동으로 따라오고
       · 나중에 슬라이더가 필요하다고 판단되면 이 한 줄에서 hidden만 지우면 된다.
     UI를 거르는 곳은 buildGyStylingControls 한 곳뿐이다(아래). */
  /* (2026-08-26 2차) hidden 해제 — 사용자 지시 "sleek 기능을 스타일링에
     슬라이더로 빼줘". 위 배너가 적어 둔 대로 <b>이 한 줄에서 hidden만</b>
     지우면 되는 자리였다(STYLING_KEYS·adjCacheSig·neutralStyling은 전부 이
     목록에서 파생되므로 이미 sleek을 보고 있었다). */
  {key:'sleek',  label:'정돈',       min:0,    max:100, left:'자연스럽게', right:'눌러붙임', neutral:0},
];
// 중립(무변화) 스타일링 값 — 매번 새 객체를 반환(state.styling은 변경되므로 공유 금지).
// state 초기화 / 리셋 / 원본결 렌더 / 폴백 등 여러 곳에서 동일 리터럴로 반복되던 것을 통합.
/* ── 중립값도 <b>목록에서 파생</b>한다 (2026-08-26) ────────────────────────
   예전엔 { sweep:0, volume:50, … }를 손으로 적어 뒀다. 그러면 파라미터가 하나
   늘 때 이 함수만 안 늘어나서 그 값이 <b>undefined로 시작</b>하고, 연산자가
   `sty.x || 0`으로 받아 조용히 0이 된다 — 서명은 보는데 초기값이 없는, 찾기
   어려운 쪽의 버그다. STYLING_KEYS가 같은 목록에서 파생되는 것과 같은 이유다. */
function neutralStyling(){
  const o = {};
  for(const p of GYEOL_STYLING_PARAMS) o[p.key] = (typeof p.neutral === 'number') ? p.neutral : 0;
  return o;
}
const STYLING_KEYS = GYEOL_STYLING_PARAMS.map(p=>p.key);
/* ── 가르마만 <b>뷰별이 아니다</b> (2026-08-25, 사용자 지시) ────────────────
   2026-07-27에 스타일링을 뷰별로 갈랐다(사용자: "정면을 보면서 가르마와 넘김을
   적용했는데 후면까지 적용됐어"). 넘김·볼륨·결흐름·마무리는 그 말이 맞다 —
   보고 있는 쪽을 어떻게 연출하느냐의 문제다.
   그런데 <b>가르마는 연출이 아니라 두상 위에 하나 있는 선</b>이다. 뷰마다 다른
   값을 쥐면 stylingForRoot가 cos²로 섞으면서 옆·뒤로 갈수록 partAmt가 0으로
   희석되고, 그러면 선이 흐려진다(프리셋은 applyStyleSpec이 네 뷰에 같은 값을
   넣으므로 안 드러나고, 미용사가 슬라이더를 만지는 순간부터 갈라진다).
   그래서 이 두 키만 슬라이더에서 <b>네 뷰에 동시에</b> 쓴다.
   ※ 읽는 쪽(stylingForRoot·uniformStyling)은 그대로다 — 네 뷰 값이 같으면
     가중합이 정확히 그 값이라(합=1) 섞기가 항등이 된다. 즉 고칠 곳은 쓰기 한 곳뿐.
   되돌리기: PART_VIEW_LOCK.on = false (예전 동작 = 보고 있는 뷰에만 적용) */
/* ── (2026-08-25 정정) 잠그는 것은 <b>위치뿐</b>이다 ─────────────────────
   처음엔 part·partAmt를 같이 잠갔다. 그런데 뷰별로 가른 이유가 <b>좌우 비대칭</b>
   이었다는 사용자 지적이 맞다 — 커트(state.sections)가 전역 한 벌이라 좌우를
   다르게 자를 수 없고, 스타일링이 뷰별인 것이 지금 유일하게 좌우를 다르게
   만들 수 있는 경로다(viewWeightsForRoot가 뿌리 방위각으로 섞으므로 left·right
   값이 다르면 실제로 좌우가 다르게 걸린다).
   가르는 기준: <b>선의 위치는 물리적 사실이라 하나뿐</b>이고(뷰마다 다르면
   같은 머리에 가르마가 넷 생긴다), 그 선을 기준으로 갈린 <b>두 덩어리가 얼마나
   눕는지는 좌우가 다를 수 있다</b>(짧은 쪽과 넘기는 쪽이 다르다).
   그래서 part만 네 뷰에 쓰고 partAmt는 예전처럼 보고 있는 뷰에만 쓴다. */
const PART_VIEW_LOCK = { on: true, keys: { part:1 } };

/* ══════════════════════════════════════════════════════════════════
   스타일링은 "지금 보고 있는 화면"의 것 (2026-07-27, 사용자 지정)
   ─────────────────────────────────────────────────────────────────
   사용자: "정면을 보면서 가르마와 넘김을 적용했는데 후면까지 적용됐어.
            해당 화면만 스타일링하는 걸로."
   예전엔 state.styling 하나를 전 가닥이 공유했다. 이제 뷰마다 한 벌씩 두고
   (state.stylingByView), 가닥은 <b>자기 뿌리가 어느 쪽을 향하는가</b>에 따라
   해당 뷰의 값을 받는다. 캡처된 뷰(srcAngle)가 아니라 실제 방향 기준이다 —
   조정 화면은 전 뷰 가닥을 후보로 그리므로, 정면 화면에 보이는 가닥은
   출처와 무관하게 전부 정면 값을 받아야 사용자 눈에 맞는다.

   경계를 딱 자르면 45°에서 계단이 생기므로 cos²/sin²으로 섞는다.
   이 네 개의 합은 어떤 각에서도 <b>정확히 1</b>이라(cos²φ+sin²φ=1) 네 뷰 값이
   같으면 결과도 정확히 그 값이다 — 전역이던 예전 동작이 특수해로 보존된다.
   두상 꼭대기(수평 반경 ≈ 0)는 방위각이 불안정하므로 네 뷰 균등으로 수렴시킨다.
   좌표 규약 확인(probe-axis): front=+Z, right=+X, left=-X, back=-Z.
══════════════════════════════════════════════════════════════════ */
function neutralStylingByView(){
  const o = {}; for(const a of ANGLES) o[a] = neutralStyling(); return o;
}
function viewWeightsForRoot(root){
  const E = getHeadEllipsoid();
  const x = root.x, z = root.z;
  const horiz = Math.hypot(x, z);
  const t = Math.max(0, Math.min(1, horiz / (0.35 * Math.max(E.a, E.c))));
  const phi = Math.atan2(x, z);                 // 0=정면, +π/2=우측, ±π=후면
  const c = Math.cos(phi), s = Math.sin(phi);
  const f = Math.max(0, c), bk = Math.max(0, -c), r = Math.max(0, s), l = Math.max(0, -s);
  const u = 0.25 * (1 - t);                     // 정수리로 갈수록 네 뷰 균등
  return { front: u + t*f*f, back: u + t*bk*bk, right: u + t*r*r, left: u + t*l*l };
}
// 네 뷰 값이 모두 같으면 섞을 필요가 없다(대부분의 프레임이 이쪽이다).
function uniformStyling(){
  const bv = state.stylingByView;
  if(!bv) return state.styling || neutralStyling();
  const a0 = bv[ANGLES[0]] || {};
  for(const a of ANGLES){
    const s = bv[a] || {};
    for(const k of STYLING_KEYS) if(s[k] !== a0[k]) return null;
  }
  return a0;
}
function stylingForRoot(root){
  const bv = state.stylingByView;
  if(!bv || !root) return state.styling || neutralStyling();
  const w = viewWeightsForRoot(root);
  const nt = neutralStyling(), out = {};
  for(const k of STYLING_KEYS){
    let v = 0;
    for(const a of ANGLES){
      const s = bv[a] || nt;
      v += w[a] * ((typeof s[k] === 'number') ? s[k] : nt[k]);
    }
    out[k] = v;
  }
  return out;
}
/* state.styling은 접근자라 현재 뷰를 <b>자동으로</b> 따라간다(위 defineProperty).
   이 함수는 그릇이 있는지만 보장한다 — 호출부는 "여기서 뷰가 바뀐다"는 표시로 남긴다. */
function bindStylingToCurrentView(){
  if(!state.stylingByView) state.stylingByView = neutralStylingByView();
  const a = state.currentViewAngle;
  if(!state.stylingByView[a]) state.stylingByView[a] = neutralStyling();
}

// ── 공간 좌표(nx,ny: 0~1) → 섹션 ID 판정 ──
// SECTIONS의 yRange/xRange는 "이 섹션이 대략 이 범위에 있다"는 참고값이라
// 뷰별로 겹치는 구간이 있음(예: front와 crown이 이마 위쪽에서 겹침).
// 뷰마다 "더 구체적인 섹션을 먼저 확인"하는 우선순위로 겹침을 해소한다.
// ※ 버그 수정(2026-07-13): 예전엔 crown이 자기 yRange/xRange를 실제로 안 쓰고
// "front도 temple도 nape도 아니면 무조건 crown"인 순수 fallback이었음 —
// refineSectionBoundaries가 아무리 정확한 두정선 경계를 계산해도 crown이
// 그걸 무시하고 나머지 전부를 흡수해버리는 구조라 의미가 없었음. 이제
// crown.yRange[1](=두정선 y좌표)을 명시적으로 검사해서, 실제로 두정선
// 위쪽(Interior)인 곳만 crown이 되도록 고침.
// ── 뷰별 섹션 경계 밴드 — 2026-07-22 재작성 → 같은 날 2차 수정(실기기) ──
// 1차(랜드마크 절대비율)의 실기기 실패: 두정선(earY-40%)과 네이프선(chinY×0.78)이
// "이미지 전체에 대한 절대 비율" 공식이라, 얼굴이 프레임 어디에 있느냐에 따라
// 두 선이 겹치거나 역전됨 — 실기기 로그에서 좌측 뷰 두정선 0.503 vs 네이프선
// ≈0.50으로 Exterior 밴드(템플/사이드/후두부)가 폭 0으로 붕괴, crown=100% 확인.
// 정면 temple=0%도 동일 원인(프론트 밴드 x공식 lx*0.55이 프레임 폭 기준이라
// 넓은 사진에선 머리 전체를 삼킴).
// → 2차: 경계를 "헤어 마스크의 실측 스팬"(머리 꼭대기 apex~모발 끝, 좌우 폭)과
// 랜드마크의 조합으로 머리 기준 상대좌표로 계산. 프레임 안 어디에 어떤 크기로
// 찍혀도 비율이 유지된다. 마스크가 아직 없으면(처리 초기) 랜드마크 폴백.
// 메모이즈: 랜드마크·마스크 객체 identity 기준(재촬영/재처리 시 자동 갱신).
// ── 진단 로그 상세 모드(2026-07-22) ──
// 실기기 피드백: "콘솔로그에 진단내용이 뭐 이렇게 많지?" — [진단·조정]/
// [진단·조정렌더]/[진단·섹션분포]/경계보정 로그가 슬라이더 input 이벤트마다
// (드래그 한 번에 수십 번) 찍히고 있었음. 기본은 끄고, 문제 추적할 때만
// 콘솔에서 window.DIAG_VERBOSE = true 로 켜서 보게 함.
// [진단·섹션분포]는 값이 "바뀔 때만" 1회 출력(검증에 필요한 최소한만 유지).
window.DIAG_VERBOSE = false;
const _secBandsCache = {};
function sectionBandsFor(angle){
  const lm = (state.landmarks && state.landmarks[angle]) || null;
  const mi = (state.hairMasks && state.hairMasks[angle]) || null;
  const c = _secBandsCache[angle];
  if(c && c.srcLm === lm && c.srcMi === mi) return c.bands;
  const L = lm || getEstimatedLandmarks(angle);
  // ── 머리 실측 스팬(헤어 마스크): apex(머리 꼭대기)·모발 최하단·좌우 폭 ──
  let headTopY = null, hairBotY = null, nxMin = 0.2, nxMax = 0.8;
  if(mi && mi.scalpY){
    let minS = Infinity, maxE = -Infinity, x0 = Infinity, x1 = -Infinity;
    for(let x = 0; x < mi.w; x++){
      const s = mi.scalpY[x]; if(s < 0) continue;
      if(s < minS) minS = s;
      const e = (mi.hairEndY && mi.hairEndY[x] >= 0) ? mi.hairEndY[x] : s;
      if(e > maxE) maxE = e;
      if(x < x0) x0 = x; if(x > x1) x1 = x;
    }
    if(isFinite(minS) && x1 > x0){
      headTopY = minS / mi.h; hairBotY = maxE / mi.h;
      nxMin = x0 / mi.w; nxMax = x1 / mi.w;
    }
  }
  if(headTopY === null){ // 마스크 미가용 폴백(랜드마크 기반 근사)
    headTopY = Math.max(0, L.foreheadY - 0.10);
    hairBotY = Math.min(1, L.chinY + 0.10);
  }
  const earLineY  = (typeof L.earY  === 'number') ? L.earY  : headTopY + (hairBotY - headTopY) * 0.60;
  const chinLineY = (typeof L.chinY === 'number') ? L.chinY : headTopY + (hairBotY - headTopY) * 0.95;
  // 두정선: apex(실측 머리 꼭대기)~귀 사이 지점 — "귀 위 손가락 3개" 근사를
  // 이마 랜드마크가 아니라 실제 머리 꼭대기 기준으로 계산(프레임 무관).
  // (4차, 사용자 교정 "측면에서 뿌리 기준이어도 크라운이 75%면 안 된다") 뷰별 분리:
  // 측면/후면에선 옆통수 두피면 전체가 보이므로 크라운(Interior)은 위쪽 ~35%만 —
  // 정면은 두정선 아래가 화면에 거의 안 보여 52% 유지. 편중 시 이 계수만 조정(튜닝 지점).
  const parietalFrac = (angle === 'front') ? 0.52 : 0.25; // (12차) 측면 크라운 축소 0.35→0.25(사이드 확대)
  /* (14차, 2026-07-27) 기준 길이를 "정수리~귀"와 "정수리~모발끝" 중 <b>짧은 쪽</b>으로.
     13차에서 정면 크라운을 먼저 판정하게 고쳤더니 실기기에서 crown 89%가 나왔다.
     짧은 머리(모발이 귀까지 안 내려옴)면 귀 기준 두정선이 모발 범위 <b>밖</b>에
     찍혀서, 보이는 머리가 통째로 두정선 위가 돼버린다. 실제로 잴 수 있는 건
     모발이 있는 구간뿐이므로 그 안에서 나눈다 — 긴 머리에선 귀 기준이 더 짧아
     기존 동작 그대로다. */
  const refSpan = Math.max(0.02, Math.min(earLineY - headTopY, (hairBotY - headTopY) * 0.92));
  const parietalY = headTopY + refSpan * parietalFrac;
  // 네이프선: 귀~턱 사이 25% 지점(귀 바로 아래 목덜미 시작) — chinY 절대비율 폐기.
  // 두정선보다 항상 아래에 있도록 하한 보장(Exterior 밴드 붕괴 방지).
  const napeTopY  = Math.max(parietalY + 0.04, earLineY + (chinLineY - earLineY) * 0.25);
  // (12차) 프론트 중앙 밴드 = "머리 실측 좌우 폭의 중앙 50%". 예전엔 귀 간격 기준
  // 이었는데 정면 사진에서 귀가 좁게 잡히면(earSpan 작음) 밴드가 7%로 쪼그라들어
  // 프론트가 거의 안 잡혔음 → 프레임 무관한 헤어 폭 기준으로 통일(귀 폭이 더
  // 넓으면 그쪽을 존중). 앞머리 덩어리는 대략 앞 중앙 절반이라 50%가 적정.
  const lx = Math.min(L.lEarX, L.rEarX), rx = Math.max(L.lEarX, L.rEarX);
  const hs = Math.max(0.02, nxMax - nxMin);
  let frontX0 = nxMin + hs * 0.25, frontX1 = nxMax - hs * 0.25; // 헤어 폭 중앙 50%
  if((rx - lx) > (frontX1 - frontX0)){ frontX0 = lx; frontX1 = rx; } // 귀 폭이 더 넓으면 채택
  const browY = (typeof L.browTopY === 'number') ? L.browTopY : (headTopY + (earLineY - headTopY) * 0.80);
  /* (15차, 2026-07-27) 정면 크라운/프론트 경계 = <b>헤어라인</b>.
     두정선(parietalY)은 귀 랜드마크에 매달려 있어 프레임에 따라 크게 흔들린다.
     실기기에서 그게 깊게 잡혀 crown 80% / front 8%가 나왔다(사용자 보고).
     그래서 정면만 얼굴 랜드마크(이마 위)를 1차 기준으로 쓰고, 그마저 튀는 경우를
     대비해 <b>실측 모발 세로 범위의 24~34% 안</b>으로 가둔다 — 크라운이 정면을
     통째로 먹는 일도, 아예 사라지는 일도 없게 하는 안전선.
     상한을 34%로 좁게 잡은 이유: 뿌리 표본이 컬럼마다 0~0.8 깊이에 <b>사다리꼴로</b>
     찍히기 때문에, 경계를 세로 범위의 45%에 두면 표본 기준으로는 크라운이 57%가
     된다(범위 비율 ≠ 가닥 비율). 실제 분포로 재서 맞춘 값이다. */
  const vExt = Math.max(0.02, hairBotY - headTopY);
  const fringeTopY = Math.max(headTopY + vExt * 0.24,
                       Math.min(headTopY + vExt * 0.34, L.foreheadY * 0.85));
  const bands = {
    fringeTopY,
    headTopY, hairBotY, parietalY, napeTopY,
    earLineY, chinLineY,   // (2026-07-27) 두상 영역 판정에 사용 — 구멍 메움에서 참조
    nxMin, nxMax,
    frontY0: Math.min(parietalY, L.foreheadY * 0.85 + 0), // 프린지 밴드 상단(헤어라인 부근)
    frontY1: browY * 1.05,                                 // 프린지 밴드 하단(눈썹 위)
    frontX0, frontX1,
    // 얼굴이 이미지에서 어느 쪽을 보는가(+1=오른쪽, -1=왼쪽). 랜드마크 yaw
    // (코가 귀 중심보다 어느 쪽인지)가 있으면 실측, 없으면 촬영 슬롯 가정.
    faceDir: (lm && typeof lm.yaw === 'number' && Math.abs(lm.yaw) > 0.05)
      ? (lm.yaw >= 0 ? 1 : -1)
      // (2026-07-26) 폴백도 ASSUMED_YAW_DEG와 같은 부호 착오가 있었음:
      // 미러 저장이라 좌측 뷰가 양수(얼굴이 오른쪽을 봄)다 → left가 +1.
      : (angle === 'left' ? 1 : -1),
  };
  _secBandsCache[angle] = { srcLm: lm, srcMi: mi, bands };
  return bands;
}

function resolveSectionId(angle, nx, ny){
  // ── 섹션 배분 재재설계(2026-07-22, 뿌리 실좌표 기반) ──
  // 이전 재설계(nx 하드코딩 0.32/0.64 분할)의 문제:
  //  · ny로 들어오던 값이 "컬럼의 실루엣 맨 꼭대기"라 세로 정보가 죽어 있었고,
  //    그 보상으로 좌우(nx)만으로 나누다 보니 측면 뷰에서 중앙 컬럼 전부(사실상
  //    보이는 머리 전체)가 side로 먹혔음 — "사이드만 조정하면 전체가 움직인다"의 원인.
  //  · 네이프는 어떤 뷰에서도 조건(ny>네이프선)을 만족할 수 없어 조정이 무반응.
  //  · left/right 모두 "nx 작으면 템플" 고정이라 우측 뷰에선 템플/후두부가 뒤바뀜.
  // 이제 호출부(drawStrandLayer)가 가닥의 "실제 뿌리 좌표"(루트 확산 레이어의
  // 깊이 포함)를 넘기므로 세로(ny)가 다시 의미를 갖는다 → 초반에 잡아둔 미용
  // 기준선(두정선 위=Interior=크라운, 아래=Exterior, 네이프선 아래=네이프)을
  // 그대로 적용하고, 측면의 앞/뒤(템플/후두부)는 귀 실측 x와 얼굴 방향으로 나눈다.
  const b = sectionBandsFor(angle);
  if(angle==='front'){
    /* ── (13차, 2026-07-27 사용자 지정) 정면 섹션 재정의 ──
       실기기 실측: crown 9% / front 83% / temple 7% / nape 0%.
       원인은 순서였다. 12차에서 "프론트 = 중앙 컬럼 꼭대기~눈썹"으로 넓히면서
       프론트 판정을 크라운보다 먼저 놓아, 중앙 컬럼의 정수리까지 전부 프론트가
       됐다(그때 고치려던 건 "프론트가 안 먹힌다"였는데 반대로 넘어간 것).
       사용자 교정: "크라운을 정수리에서 중간 정도까지", "네이프는 일단 측면과
       후면만". 그대로 반영 —
         · 두정선(정수리~귀 사이 52%) 위 = 크라운   ← 중앙도 포함, 먼저 판정
         · 그 아래 중앙 컬럼 = 프론트(앞머리)
         · 그 아래 좌우 = 템플
         · 네이프는 정면에서 판정하지 않음(측면·후면 전용)
       프론트는 여전히 "두정선~아래 중앙 컬럼"이라 조작 대상이 충분히 남는다.

       ── (15차, 2026-07-27 사용자 지정) 순서를 뒤집는다 ──
       "나머지 다 정하고 나머지를 크라운으로 간 다음에, 크라운이 겹으로 침범할 수
        있도록 하면 길이를 줄이면 되니까."
       13차처럼 크라운을 <b>먼저</b> 판정하면 경계선이 조금만 깊게 잡혀도 크라운이
       다 먹는다(실기기 crown 80% / front 8% / temple 12% — 프론트가 오른쪽에만
       조금 보였던 이유). 이제 프론트·템플이 <b>자기 밴드를 먼저</b> 가져가고
       남는 위쪽 전부가 크라운이다.
       겹침 걱정은 안 해도 된다 — 크라운 가닥은 길어서 어차피 앞머리 위로 덮여
       내려온다. 크라운 길이를 줄이면 그 밑에 깔린 프론트가 드러난다. */
    if(ny >= b.fringeTopY) return (nx >= b.frontX0 && nx <= b.frontX1) ? 'front' : 'temple';
    return 'crown';                                // 남는 위쪽 전부
  }
  if(angle==='left' || angle==='right'){
    if(ny >= b.napeTopY) return 'nape';          // 목선 쪽 뿌리 = 네이프
    if(ny <= b.parietalY) return 'crown';        // 두정선 위(Interior) = 크라운
    // 두정선~네이프선 사이(Exterior): 헤어 좌우 스팬 기준 상대좌표로 앞/뒤 분할
    // (2차 수정: 귀 x 절대좌표 ± 고정폭 → 실기기 프레임에 따라 깨져서 폐기).
    // fw: 0=머리 뒤쪽 끝 ~ 1=머리 앞쪽 끝(얼굴 방향은 실측 yaw 부호로 결정).
    const span = Math.max(0.02, b.nxMax - b.nxMin);
    const fw = b.faceDir > 0 ? (nx - b.nxMin) / span : (b.nxMax - nx) / span;
    // (12차) 사이드 확대: 측면 뷰 주인공은 사이드인데 크라운(위 35%)+템플/후두부에
    // 밀려 작았음. 앞/뒤 밴드를 22%로 좁혀 사이드를 가운데 56%로. (크라운 축소는
    // sectionBandsFor의 측면 parietalFrac 0.35→0.25로 별도 처리.)
    if(fw > 0.78) return 'temple';               // 앞 22%(귀 앞·관자놀이)
    if(fw < 0.22) return 'occipital';            // 뒤 22%(뒤통수)
    return 'side';                               // 가운데 56%(귀 주변)
  }
  if(angle==='back'){
    if(ny >= b.napeTopY) return 'nape';
    if(ny <= b.parietalY) return 'crown';        // 두정선 위 = 크라운
    return 'occipital';                          // 그 사이 = 후두부
  }
  return 'crown';
}

// (2026-07-22 정리) 겹 스택 헴 캡(gySectionHemCapNy/HEM_OVERLAP)은 4차에 도입했으나
// 6차 실측 길이 렌더(마스크 이탈·결 불연속 실측)로 대체되며 호출부가 사라짐 — 제거.
// 3D 헴라인은 2단계에서 실측 기반으로 새로 구현.

/* ════════════════════════════════════════════════════════════════
   STATE — 전역 상태 객체
   촬영 사진·마스크·랜드마크·섹션 파라미터·3D 모델 캐시가 전부 여기 모인다.
   새 고객 시작(startNewCustomer)이 이 객체를 초기화하는 단일 지점.
   ════════════════════════════════════════════════════════════════ */
const state = {
  // ROADMAP(voice): 향후 음성입력 연동 시, 인식 실패/수정 이벤트를 여기 state에
  // 사용자별로 누적 기록하는 필드 추가 예정 (예: state.voiceCorrections[]).
  // 서버측 범용 모델 개선이 아니라 클라이언트 로컬 개인화 목적 — 정정 이벤트 자체가
  // 학습 신호. UI 연동 지점은 섹션/슬라이더 명령 파싱하는 곳(추후 신설).
  shots: {front:null,left:null,right:null,back:null},
  hairMasks: {front:null,left:null,right:null,back:null},
  hairCanvases: {front:null,left:null,right:null,back:null},
  baseCanvases: {front:null,left:null,right:null,back:null},
  baseFillCanvases: {front:null,left:null,right:null,back:null}, // 지워진 자리를 주변색으로 메운 배경
  debugShowMask: false, // true면 조정화면에서 가닥 대신 hairMaskBuf 실루엣을 그대로 표시(진단용)
  debugShowRaw: false,  // true면 스타일/슬라이더 값 무시하고 전 섹션 중립값(길이·볼륨 50, 컬 0)으로 렌더링(진단용)
  // (2026-07-27) true면 가닥을 그리지 않고 원본 사진의 헤어 픽셀을 이식해 렌더
  // (2026-08-01) 후보 경로 → <b>기본 경로</b>로 승격. 토글 버튼은 제거했고,
  // 이식이 불가능한 조건이면 projectHair3DToView / drawHairStrands로 조용히 폴백한다.
  // (2026-08-02 8차) <b>다시 false</b>. 8/2 (7)차에서 "스타일 적용 후의 가닥을
  // 원본 결 보기의 가닥으로 통일"한 대상은 projectHair3DToView인데, 이 플래그가
  // true라 조정/결과 화면은 그보다 <b>앞에 있는</b> 픽셀 이식으로 갔다 —
  // 통일한 코드가 아예 실행되지 않아 화면은 하나도 안 바뀌었다
  // (사용자: "통일시켰다는데 여전히 저렇게 다르게 나와").
  // 픽셀 이식은 원본 사진의 헤어 띠를 잘라 붙이는 <b>다른 그림 규칙</b>이라
  // 정의상 가닥 렌더와 같아질 수 없다. 통일이 목적이면 이 경로를 꺼야 한다.
  // 코드는 그대로 남겨 뒀으므로 콘솔에서 state.hairQuilt = true 로 되살릴 수 있다.
  hairQuilt: false,
  debugShowField: false, // true면 strand 시뮬레이션(뿌리/중력/clamp) 전부 건너뛰고 orientation 컬럼 샘플을 가공 없이 그대로 표시(진단용)
  // ── 3D 미리보기 패널 표시 여부 (이름은 옛 플래그명 유지) ──
  // (2026-07-26) 예전엔 이 값이 조정 경로를 갈랐다(true=3D, false=2D 직접 렌더).
  // 지금은 조정 경로가 3D 하나뿐이라 — "중립 가닥 캡처 → 3D 리프트 → 3D에서
  // 커트/펌/스타일링 → 같은 뷰로 역투영" — 이 값은 우하단 미니 3D 패널을
  // 띄울지만 정한다. 조정 결과는 이 값과 무관하게 항상 3D를 거쳐 나온다.
  use3DAdjust: false,
  currentCaptureIndex: 0,
  selectedStyle: null,
  /* (2026-08-29) 스펙 스타일 두 손잡이 — 여태 필요할 때 붙였다 떼던 필드라
     여기 목록에 없었다. 읽는 자리가 늘었으니 뜻을 적어 둔다.
     pendingSpecId : 스타일 화면에서 <b>고르기만</b> 한 스펙. 조정 화면 진입 때
                     applyStyleSpecAndRender가 걸고 비운다(역산에 3D 모델 필요).
     specAppliedId : 지금 <b>걸려 있는</b> 스펙. 같은 id를 다시 누르면 해제다. */
  pendingSpecId: null,
  specAppliedId: null,
  currentViewAngle: 'front',
  currentSection: 'crown',   // 현재 편집 중인 섹션
  // 섹션별 파라미터 저장
  sections: Object.fromEntries(
    Object.entries(SECTIONS).map(([id,s])=>[id, {...s.defaults}])
  ),
  // ── 페이드/테이퍼(클리퍼 기법) — 길이 기준, 엘리베이션(각도)과는 완전히 별개 ──
  // 템플/사이드/후두부/네이프 하단(구레나룻·목선 쪽)에 적용되는 클리퍼 가드
  // 그라데이션. 실제 기법 그대로: guard 0=스킨(가드 없음, 맨살까지), 8=1인치
  // (가드 번호당 1/8인치 — 업계 표준). enabled가 false면 완전히 무시되고
  // 기존 elevation/length 렌더링만 적용(하위 호환).
  fade: {
    enabled: false,
    guard: 1,        // 0~8, 페이드 최하단(구레나룻/목선 끝) 길이
    height: 35,       // 0~100, 그 섹션 안에서 페이드가 몇 %까지 올라가는지(로우/미드/하이 페이드)
    blendWidth: 40,   // 0~100, 가드 경계가 얼마나 부드럽게 섞이는지(테이퍼 레버 개념 — 낮으면 칼선, 높으면 부드러운 그라데이션)
    /* ── (2026-08-26) 남성 컷의 나머지 절반. 둘 다 기본값이 <b>예전과 산술까지
       동일</b>하고(disc 0 = 안 씀, taper 0 = 블록), 프리셋만 켠다.
       ⚠ 슬라이더를 안 만든다 — 미용사가 만질 값이 아니다(파일 상단 제품 방향:
         "안 만진다 — 프리셋에 들어 있고, 안 맞을 때만 만진다"). ──────────── */
    disc: 0,          // 0=안 씀. >0이면 <b>디스커넥션 라인</b> — 두상 높이 정규화 %(0=정수리, 100=두상 바닥)
    taper: 0,         // 0=블록(가드 하나로 평평, 예전 동작) ~ 100=맨 아래가 스킨까지 닫히는 진짜 테이퍼
  },
  // 웨이브 폭(펌 로드 사이즈) — 컬 진폭(_globalCurl)과 별개로 파장(촘촘함)을
  // 조절. 0=작은 로드(촘촘한 스파이럴), 100=큰 로드(느슨한 웨이브).
  waveWidth: 50,
  // 텍스처링 강도(포인트컷/슬라이드컷/레이저컷/틴닝 통합) — 끝단을 정리해서
  // 자연스럽게 만드는 정도. 엘리베이션(길이 그라데이션의 근원)과 달리
  // "끝만" 다듬는 마무리 기법이라 전역 하나로 둠(실제로도 대부분 전체
  // 마무리 단계에서 한 번에 적용). ★ gyeol 이식 후엔 섹션별 texture가 주(主)이고
  // 이 전역값은 하위호환용 바닥값으로만 남음(둘 중 큰 값 적용).
  texturing: 0,
  /* ── gyeol 스타일링(마무리) — 커트/펌/컬러 위에 얹는 연출 ──
     전부 중립(sweep0/volume50/flow0/part0/partAmt0/finish50)이면 렌더는 기존과 동일.
     (2026-07-27) 뷰별로 한 벌씩 둔다. state.styling은 <b>지금 보고 있는 뷰</b>의
     객체를 가리키는 별칭이라, 슬라이더 코드(state.styling[key]=…)는 그대로 두고
     각도 탭을 바꿀 때 bindStylingToCurrentView()가 대상만 바꿔 끼운다. */
  stylingByView: neutralStylingByView(),
  styling: neutralStyling(),   // ← bindStylingToCurrentView가 현재 뷰 것으로 교체
  // 섹션별 컬러 토글 시 기본 선택될 색(발레아쥬 첫 스와치)
  globalColor: '#6B4A2E',
  // gyeol 조정 패널: 현재 활성 섹션('styling'이면 마무리 탭), 그룹 접힘 상태
  activePanelSection: 'crown',
  /* recipe(스펙 수치)는 <b>접힌 채</b> 시작한다 — 읽을거리라 열려 있으면 슬라이더를
     아래로 밀어낸다. 필요할 때 펴서 보는 참조표다(2026-09-01). */
  panelCollapsed: { perm:false, color:true, recipe:true },
  // 하위 호환: sliders는 섹션 파라미터에서 파생 (renderFrame에서 사용)
  // length 필드는 더 이상 여기서 쓰이지 않음 — drawHairStrands가 컬럼별로
  // resolveSectionId()를 통해 해당 위치의 섹션 length를 직접 조회함
  // (머리 전체에 평균 길이 하나만 적용되던 문제를 고치기 위함).
  get sliders(){
    const sec = state.sections;
    // 각 뷰 렌더에 필요한 통합 파라미터 계산
    const blend = (a,b,t)=> a*(1-t)+b*t;
    // 엘리베이션(0~90°)을 기존 볼륨류 공식(numRootScatter 등)이 기대하는
    // 0~100 스케일로 환산. 실제 기법 파라미터로 바뀌었어도 렌더링 쪽 공식은
    // 그대로 재사용(입력만 바뀜) — elevation 90°=완전 레이어=볼륨 100.
    const elevToVol = (deg)=> Math.max(0, Math.min(100, ((deg ?? 45)/90) * 100));
    // left/right는 좌우 대칭이라 항상 동일한 값 — 한 번만 계산해서 공유
    const sideView = {
      length: blend(sec.side.length, sec.occipital.length, 0.5),
      curl:   state._globalCurl || 30,
      volume: blend(elevToVol(sec.crown.elevation), elevToVol(sec.occipital.elevation), 0.5),
      thickness: 50,
    };
    return {
      front: {
        length: blend(sec.crown.length, sec.front.length, 0.6),
        curl:   state._globalCurl || 30,
        volume: elevToVol(sec.crown.elevation),
        thickness: 50,
      },
      left: sideView,
      right: sideView,
      back: {
        length: blend(sec.occipital.length, sec.nape.length, 0.5),
        curl:   state._globalCurl || 30,
        volume: elevToVol(sec.occipital.elevation),
        thickness: 50,
      },
    };
  },
  _globalCurl: 30,
};

/* state.styling을 <b>현재 뷰의 스타일링</b>에 대한 접근자로 바꾼다 (2026-07-27).
   뷰별 스타일링으로 바꾸면서 "state.styling에 새 객체를 대입"하는 코드
   (리셋·스타일 불러오기·검사 스크립트)가 별칭을 조용히 끊어버리는 문제가 있었다
   — 그러면 슬라이더는 움직이는데 3D는 안 변한다. 접근자로 만들면 대입해도
   현재 뷰 객체 <b>안으로</b> 값이 들어가므로 끊길 수가 없다.
   읽기는 살아 있는 객체를 그대로 주므로 state.styling.sweep = 100 도 그대로 동작. */
Object.defineProperty(state, 'styling', {
  enumerable: true, configurable: true,
  get(){
    if(!this.stylingByView) this.stylingByView = neutralStylingByView();
    const a = this.currentViewAngle;
    if(!this.stylingByView[a]) this.stylingByView[a] = neutralStyling();
    return this.stylingByView[a];
  },
  set(v){
    const cur = this.styling;                       // getter가 보장해 준다
    for(const k of STYLING_KEYS) delete cur[k];
    Object.assign(cur, neutralStyling(), v || {});
  },
});

/* ══════════════════════════════════════════════════════════════════
   마네킹 모델은 <b>다른 모델</b>이다 (2026-08-08, 사용자 지정)
   ─────────────────────────────────────────────────────────────────
   사용자: "그 상태에서는 모든 헤어의 상태가 고객의 뿌리밀도와 모질 등의
   특성만을 지닌 채 다 초기화되어 있어야 돼. 섹션은 딱 정렬돼서 나눠져 있어야
   되고. 길이를 늘렸을 때 갑자기 나타나는 부분이 생긴다든가 하면 안 되거든."

   그래서 마네킹 상태는 촬영 가닥을 <b>펴는</b> 게 아니라 아예 다른 모델이다:
   촬영 가닥은 색·질감 소스로만 남고, 기하는 실측 특성(뿌리밀도·섹션·길이)만
   가지고 새로 심는다. state.hair3Dneutral을 접근자로 두면 렌더·조정·미니뷰가
   전부 자기 코드를 그대로 두고 모델만 갈아탄다(state.styling과 같은 수법).
   대입하면 마네킹 캐시는 무효화된다 — 새로 촬영하면 다시 심어야 하니까. */
Object.defineProperty(state, 'hair3Dneutral', {
  enumerable: true, configurable: true,
  get(){
    if(typeof MANNEQUIN !== 'undefined' && MANNEQUIN.on && this._hair3Dneutral){
      /* 게으른 생성 — '스타일 선택안함'은 <b>스타일 화면</b>에서 눌리는데 그때는
         3D 모델이 아직 없다. 켜만 두고, 처음 읽힐 때(=조정 화면 렌더) 심는다. */
      if(!this.hair3Dmannequin) this.hair3Dmannequin = buildMannequinHair3D();
      if(this.hair3Dmannequin) return this.hair3Dmannequin;
    }
    return this._hair3Dneutral || null;
  },
  set(v){ this._hair3Dneutral = v || null; this.hair3Dmannequin = null; },
});

// ROADMAP(fashion): 스타일 확정 후 얼굴형+선택 스타일 조합 → 패션 추천으로 확장 예정.
// 각 STYLES 항목에 훗날 recommendTags(실루엣/톤 등) 필드 추가해서 매칭에 쓸 것.
// 제휴사 카탈로그 연동은 별도 API 모듈로 분리, 이 배열은 매칭 키만 제공.
// ── 머리색 강제 오버라이드(2026-07-17, 사용자 요청: "머리를 검정색으로 바꿔") ──
// null이면 원래 로직(선택 스타일 colorHex → 실측 avgColor)으로 원복됨.
// 순수 #000000이 아니라 #141414인 이유: 가닥 간 음영·겹침 대비가 남아야
// 머리카락처럼 보임(완전 검정은 디테일이 뭉개짐).
// (2026-07-17 정리 후) 적용 경로 2개: ① 2D 가닥(drawStrandLayer의 strokeCol —
// 3D는 캡처된 2D 경로의 색을 그대로 옮기므로 여기서 함께 덮임, 흰색 가산
// 틴트 상한 1.06 클램프 포함) ② AI 의상 추천 프롬프트(recommendOutfitWithAI).
// 절차 생성 3D(extractStyleParamsFor3D)에 적용했던 세 번째 지점은 해당
// 경로가 죽은 코드(호출 0건)로 확인되어 함수째 삭제됨.
const FORCED_HAIR_COLOR = '#141414';

/* (2026-07-26) 내장 프리셋 전부 제거 — 사용자 요청 "스타일 미적용 빼고 다 지워줘".
   프리셋은 length/curl/volume 대표값 하나로 6개 섹션을 뭉뚱그리는 구형 모델이라,
   섹션별 커트/펌/스타일링으로 옮겨간 지금 구조와 맞지 않는다. 배열만 비우면
   "스타일 미적용" 카드(별도 생성)와 사용자가 직접 등록한 커스텀 스타일
   (registerCurrentAsStyle → STYLES.push)은 그대로 동작한다.

   ── (2026-08-29) 스펙 스타일 두 개를 <b>스타일 화면으로</b> ─────────────────
   사용자 지시: "지금 조정화면에서 선택하게 되어 있는 layered bob랑 폼파두르를
   스타일로 저장해줘."

   여기 되살아난 두 항목은 <b>2026-07-26에 지운 옛 프리셋과 다른 물건</b>이다.
   옛 프리셋은 length/curl/volume 대표값 셋으로 여섯 섹션을 뭉뚱그렸고, 그래서
   지웠다. 이 둘은 값을 하나도 안 들고 있고 <b>specId만</b> 들고 있다 — 실제
   값은 STYLE_SPECS(끝 높이 tipAt / 절대 길이 lenCm)에서 손님 두상으로 그때
   역산된다. 파일 상단 "현장에서 걸리는 시간" 항목의 "프리셋을 이 손님에게 맞춘
   슬라이더 값으로 적지 말고 모양으로 적어라"가 지켜지는 이유가 이것이다.

   ⚠ 그래서 아래 length/curl/volume/colorHex는 <b>카드 아이콘(styleIconSVG)
     전용</b>이다. 시술에는 한 값도 안 쓰인다 — 렌더에 쓰려고 읽지 말 것.
     selectStyle이 st.specId를 보고 프리셋 역산 분기 자체를 건너뛴다.
   ⚠ 역산에는 3D 중립 모델이 필요한데 <b>스타일 화면에는 아직 그게 없다</b>
     (촬영 가닥을 3D로 올리는 건 조정 화면 진입 때 일어난다). 그래서 여기서는
     state.pendingSpecId에 적어만 두고, setupAdjustScreen이 실제로 건다. */
const STYLES = [
  { id:'layered_bob_hush', specId:'layered_bob_hush',
    name:'레이어드 보브', tags:'시스루 뱅 · 아웃컬',
    length:78, curl:28, volume:70, colorHex:'#7A6149' },   // ← 아이콘 전용(위 ⚠)
  { id:'taper_fade_pomp', specId:'taper_fade_pomp',
    name:'페이드 폼파두르', tags:'테이퍼 페이드 · 사이드파트',
    length:34, curl:0,  volume:82, colorHex:'#60554E' },   // ← 아이콘 전용(위 ⚠)
];

/* ── 의상 카탈로그(OUTFIT_CATALOG) ──
   3단계(비즈니스 로드맵 — 파일 상단 주석 참고) 착수용. 아직 제휴사 상품 DB가
   없어서, "AI가 추천 → 붙여넣는" 파이프라인 전체가 실제로 동작하는 걸 보여줄
   데모용 카탈로그 — 다만 이제 색상만 지어낸 목업이 아니라 poly.pizza에서
   받은 실제 Quaternius 에셋(Male_Casual/LongSleeve/Shirt/Suit, CC0)을 매핑.
   colorHex는 각 에셋의 실제 재질(Kd)을 감마 보정(linear→sRGB, 2.2 감마)해서
   계산한 진짜 렌더링 색 — OBJ가 Blender에서 export되면서 Kd가 리니어
   색공간이라, 감마 보정 없이 그대로 쓰면 실제보다 어둡게 나옴(예: Male_Shirt의
   Shirt 재질 Kd(0.106,0.010,0.030)를 그대로 읽으면 거의 검정으로 보이지만,
   감마 보정하면 실제로는 버건디(#5C1F34)). 로더(loadOutfitMeshFromOBJ)에서도
   동일하게 감마 보정을 적용해서 카탈로그에 적어둔 색과 실제 렌더링이 일치하게 함.
   asset.neckCutFrac은 각 에셋 재질별 y범위를 직접 계산해서 뽑은 실측값(옷깃
   최고점 기준) — 전부 같은 베이스 바디라 0.83~0.85로 서로 비슷하지만, 정확도를
   위해 에셋별로 따로 둠. 4종 다 저사양 기기 고려해서 Smooth(고폴리, 정점 4배)
   버전 대신 기본(저폴리, 정점 약 1000개) 버전으로 매핑.
   나중에 진짜 제휴 상품 DB/API가 생기면 이 배열 자체를 그 응답으로 교체. */
const OUTFIT_CATALOG = [
  {id:'ot-charcoal-suit',   name:'차콜 슈트',        category:'포멀',   colorHex:'#2A262A', tags:['클래식','단정','오피스'],
    asset:{ objUrl:'./assets/Male_Suit.obj',       mtlUrl:'./assets/Male_Suit.mtl',       neckCutFrac:0.8369 }, affiliateUrl:null},
  {id:'ot-slate-casual',    name:'슬레이트 캐주얼 셔츠', category:'캐주얼', colorHex:'#657277', tags:['편안함','데일리','뉴트럴'],
    asset:{ objUrl:'./assets/Male_Casual.obj',     mtlUrl:'./assets/Male_Casual.mtl',     neckCutFrac:0.8382 }, affiliateUrl:null},
  {id:'ot-olive-longsleeve',name:'올리브 롱슬리브',   category:'캐주얼', colorHex:'#606B55', tags:['캐주얼','차분함','데일리'],
    asset:{ objUrl:'./assets/Male_LongSleeve.obj', mtlUrl:'./assets/Male_LongSleeve.mtl', neckCutFrac:0.8448 }, affiliateUrl:null},
  {id:'ot-burgundy-shirt',  name:'버건디 셔츠',       category:'포인트', colorHex:'#5C1F34', tags:['포인트컬러','개성','데일리'],
    asset:{ objUrl:'./assets/Male_Shirt.obj',      mtlUrl:'./assets/Male_Shirt.mtl',      neckCutFrac:0.8258 }, affiliateUrl:null},
];

// 전역 수동 보정 전용(에셋별 세팅은 이제 OUTFIT_CATALOG[i].asset에 있음).
// 자동 정렬(bounding box 기준)이 특정 에셋에서 어색할 때만 값 채워서 씀 —
// scaleOverride: null이면 자동계산, offsetY: 자동 정렬 위치에 추가로 더할 y값.
const OUTFIT_MESH_SOURCE = { scaleOverride: null, offsetY: 0 };


/* (2026-08-29) aiAnalysis(스타일 추천 AI의 응답) → stylePrepDone.
   뜻이 "AI 분석 결과가 있다"에서 "세그멘테이션·랜드마크 재료가 준비됐다"로
   바뀌었다. navTo('style')이 이 하나로 파이프라인 재실행을 막는다. */
let stylePrepDone = false;
let recognition = null;
let listening = false;
let segmenter = null;
let currentScreen = 'capture';

