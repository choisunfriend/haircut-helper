
/* ════════════════════════════════════════
   STATE
════════════════════════════════════════ */
const ANGLES = ['front','left','right','back'];
const ANGLE_LABELS = {front:'정면', left:'좌측', right:'우측', back:'후면'};
const HINTS = {front:'정면을 맞춰주세요', left:'좌측면을 맞춰주세요', right:'우측면을 맞춰주세요', back:'후면(뒷머리)을 맞춰주세요'};

/* ── 섹션 정의 ──
   각 섹션: 미용사가 실제로 커트하는 구역
   yRange/xRange: 이미지 내 위치 비율 (0~1)
   visibleIn: 어느 뷰에서 보이는가
   linkedParams: 다른 섹션 조정 시 연동되는 파라미터
*/
const SECTIONS = {
  crown: {
    id:'crown', label:'크라운', labelEn:'CROWN',
    desc:'정수리 · 전체 길이 기준',
    yRange:[0, 0.28], xRange:[0.15, 0.85],
    visibleIn:['front','left','right','back'],
    params:['length','volume'],
    defaults:{length:50, volume:50},
  },
  front: {
    id:'front', label:'프론트', labelEn:'FRONT',
    desc:'앞머리 · 이마 라인',
    yRange:[0.20, 0.45], xRange:[0.30, 0.70],
    visibleIn:['front'],
    params:['length','line'],
    defaults:{length:50, line:50},  // line: 0=라운드 50=스트레이트 100=위로
  },
  temple: {
    id:'temple', label:'템플', labelEn:'TEMPLE',
    desc:'관자놀이 · 사이드와 연결',
    yRange:[0.20, 0.50], xRange:[0, 1],   // xRange는 좌우 양쪽 (렌더 시 분기)
    visibleIn:['front','left','right'],
    params:['length','blend'],
    defaults:{length:45, blend:50},  // blend: 크라운↔사이드 연결감
  },
  side: {
    id:'side', label:'사이드', labelEn:'SIDE',
    desc:'귀 앞·뒤 · 레이어 여부',
    yRange:[0.28, 0.72], xRange:[0, 1],
    visibleIn:['left','right'],
    params:['length','layer'],
    defaults:{length:50, layer:30},  // layer: 0=원랭스 100=강한레이어
  },
  occipital: {
    id:'occipital', label:'후두부', labelEn:'OCCIPITAL',
    desc:'뒤통수 볼륨 · 형태',
    yRange:[0.30, 0.68], xRange:[0.10, 0.90],
    visibleIn:['back','left','right'],
    params:['length','volume'],
    defaults:{length:50, volume:55},
  },
  nape: {
    id:'nape', label:'네이프', labelEn:'NAPE',
    desc:'목선 마무리 · 언더컷',
    yRange:[0.68, 1.0], xRange:[0, 1],
    visibleIn:['back','front','left','right'],
    params:['length','line'],
    defaults:{length:35, line:50},  // line: 0=스퀘어 50=라운드 100=테이퍼
  },
};

// 섹션 커트 순서 (미용사 작업 순서)
const SECTION_ORDER = ['crown','front','temple','side','occipital','nape'];

// ── 공간 좌표(nx,ny: 0~1) → 섹션 ID 판정 ──
// SECTIONS의 yRange/xRange는 "이 섹션이 대략 이 범위에 있다"는 참고값이라
// 뷰별로 겹치는 구간이 있음(예: front와 crown이 이마 위쪽에서 겹침).
// 뷰마다 "더 구체적인 섹션을 먼저 확인"하는 우선순위로 겹침을 해소한다.
function resolveSectionId(angle, nx, ny){
  const inR = (range, v) => v>=range[0] && v<=range[1];
  if(angle==='front'){
    if(inR(SECTIONS.front.yRange, ny) && inR(SECTIONS.front.xRange, nx)) return 'front';
    if(inR(SECTIONS.temple.yRange, ny) && (nx<0.30 || nx>0.70)) return 'temple';
    if(ny > SECTIONS.nape.yRange[0]) return 'nape';
    return 'crown';
  }
  if(angle==='left' || angle==='right'){
    if(ny > SECTIONS.nape.yRange[0]) return 'nape';
    if(inR(SECTIONS.temple.yRange, ny) && ny < 0.35) return 'temple';
    if(inR(SECTIONS.occipital.yRange, ny) && nx > 0.55) return 'occipital';
    if(inR(SECTIONS.side.yRange, ny)) return 'side';
    return 'crown';
  }
  if(angle==='back'){
    if(ny > SECTIONS.nape.yRange[0]) return 'nape';
    if(inR(SECTIONS.occipital.yRange, ny)) return 'occipital';
    return 'crown';
  }
  return 'crown';
}

const state = {
  shots: {front:null,left:null,right:null,back:null},
  hairMasks: {front:null,left:null,right:null,back:null},
  hairCanvases: {front:null,left:null,right:null,back:null},
  baseCanvases: {front:null,left:null,right:null,back:null},
  debugShowMask: false, // true면 조정화면에서 가닥 대신 hairMaskBuf 실루엣을 그대로 표시(진단용)
  debugShowRaw: false,  // true면 스타일/슬라이더 값 무시하고 전 섹션 중립값(길이·볼륨 50, 컬 0)으로 렌더링(진단용)
  debugShowFaceBox: false, // true면 랜드마크 기반 얼굴제거박스 경계를 화면에 테두리로 표시(진단용)
  currentCaptureIndex: 0,
  selectedStyle: null,
  currentViewAngle: 'front',
  currentSection: 'crown',   // 현재 편집 중인 섹션
  // 섹션별 파라미터 저장
  sections: Object.fromEntries(
    Object.entries(SECTIONS).map(([id,s])=>[id, {...s.defaults}])
  ),
  // 하위 호환: sliders는 섹션 파라미터에서 파생 (renderFrame에서 사용)
  // length 필드는 더 이상 여기서 쓰이지 않음 — drawHairStrands가 컬럼별로
  // resolveSectionId()를 통해 해당 위치의 섹션 length를 직접 조회함
  // (머리 전체에 평균 길이 하나만 적용되던 문제를 고치기 위함).
  get sliders(){
    const sec = state.sections;
    // 각 뷰 렌더에 필요한 통합 파라미터 계산
    const blend = (a,b,t)=> a*(1-t)+b*t;
    // left/right는 좌우 대칭이라 항상 동일한 값 — 한 번만 계산해서 공유
    const sideView = {
      length: blend(sec.side.length, sec.occipital.length, 0.5),
      curl:   state._globalCurl || 30,
      volume: blend(sec.crown.volume, sec.occipital.volume, 0.5),
      thickness: 50,
    };
    return {
      front: {
        length: blend(sec.crown.length, sec.front.length, 0.6),
        curl:   state._globalCurl || 30,
        volume: sec.crown.volume,
        thickness: 50,
      },
      left: sideView,
      right: sideView,
      back: {
        length: blend(sec.occipital.length, sec.nape.length, 0.5),
        curl:   state._globalCurl || 30,
        volume: sec.occipital.volume,
        thickness: 50,
      },
    };
  },
  _globalCurl: 30,
};

const STYLES = [
  {id:'bob',       name:'클래식 보브',     tags:'SHORT · STRAIGHT', length:25, curl:5,  volume:45, colorHex:'#2A1B12'},
  {id:'long-wave', name:'롱 웨이브',       tags:'LONG · WAVE',      length:85, curl:55, volume:60, colorHex:'#3B2415'},
  {id:'pixie',     name:'픽시 컷',         tags:'SHORT · TEXTURED', length:12, curl:15, volume:35, colorHex:'#1F1610'},
  {id:'layered',   name:'레이어드 미디엄', tags:'MID · LAYERED',    length:55, curl:25, volume:55, colorHex:'#33210F'},
  {id:'curly',     name:'볼륨 컬',         tags:'MID · CURL',       length:45, curl:90, volume:90, colorHex:'#241712'},
  {id:'sleek',     name:'슬릭 스트레이트', tags:'LONG · STRAIGHT',  length:90, curl:5,  volume:30, colorHex:'#150F0B'},
  {id:'shag',      name:'샤기 컷',         tags:'MID · TEXTURED',   length:50, curl:40, volume:65, colorHex:'#2E1E12'},
  {id:'lob',       name:'로브',            tags:'MID-SHORT · WAVE', length:38, curl:35, volume:50, colorHex:'#27190F'},
];

let aiAnalysis = null;
let recognition = null;
let listening = false;
let segmenter = null;
let currentScreen = 'capture';

