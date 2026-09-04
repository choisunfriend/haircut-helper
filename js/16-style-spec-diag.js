/* ══════════════════════════════════════════════════════════
   16-style-spec-diag.js — 스타일 스펙 · 커트 지표 레퍼런스 · 진단 하네스
   원본 index.html 25457~26568행. 클래식 스크립트이므로 로드 순서가 곧
   실행 순서다 — index.html의 <script src> 순서를 바꾸지 말 것.
   ══════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════════
   스타일 스펙 — "슬라이더 숫자"가 아니라 <b>끝이 어디 오는가</b>로 적는다
   ─────────────────────────────────────────────────────────────────
   사용자: 레퍼런스 4뷰(긴 머리 → 레이어드 보브)를 우리 앱으로 만들어내라.

   슬라이더 값을 눈대중으로 박아 넣으면 <b>이 손님한테만</b> 맞는다. 같은 값이
   머리가 더 긴 사람에게는 다른 결과가 된다 — 길이 슬라이더는 절대 길이가
   아니라 <b>비율</b>(sectionLengthRatio)이기 때문이다.
   그래서 스타일을 미용사가 말하는 방식 그대로 적는다: "앞머리는 눈썹 아래,
   사이드는 턱 아래, 네이프는 목덜미 아래". 두상 높이(정수리→두상 바닥)를 1로
   본 세로 좌표다. 그 다음 <b>그 값이 나오는 슬라이더를 이분탐색으로 푼다</b> —
   실제 lengthStrand3D를 돌려서 끝 높이를 재므로 근사식이 아니다.

   이러면 같은 스펙이 누구에게나 같은 <b>모양</b>을 만든다. 긴 머리든 짧은
   머리든, 두상이 크든 작든.

   ※ 제미나이 같은 생성 모델이 4뷰를 일관되게 만들어내는 방식에서 가져올 것은
     "이미지를 만드는 법"이 아니라 <b>스타일을 분해해 적는 어휘</b>다:
     (길이 기준점 · 레이어 구조 · 뱅 종류 · 컬 방향 · 볼륨 위치 · 가르마 · 색).
     아래 스펙이 그 어휘를 그대로 쓴다. 뷰 일관성은 생성 모델이 잠재공간으로
     겨우 맞추는 것을 우리는 <b>진짜 3D 모델</b>로 이미 갖고 있으므로 필요 없다.
══════════════════════════════════════════════════════════════════ */
const STYLE_SPECS = {
  layered_bob_hush: {
    name: '레이어드 보브 · 시스루 뱅 · 아웃컬',
    /* 끝이 오는 세로 위치. 0 = 정수리, 1 = 두상 바닥(≈턱선), 1.3 = 그보다
       두상 높이의 30%만큼 더 아래.
       ── (2026-08-09) 레퍼런스 4뷰를 <b>픽셀로 재서</b> 다시 넣음 ─────────────
       예전 값은 눈대중이라 뒤가 통째로 길었다(실기기 결과가 목표보다 한 뼘 김).
       재는 법: 각 뷰에서 눈높이 = 모델 CY, 눈→턱 11.5cm = FACE_RULER_CM로 자를
       만들고 b(두상 반높이 12.2cm)를 얹어 yTop·H를 낸 뒤, 헤어 실루엣의 컬럼별
       최저점 중앙값을 (y - yTop)/H로 환산.
         정면 뱅(중앙 컬럼)      y204 → 0.50
         정면·좌·우 바깥 컬럼    y351~369 → 0.98~1.06 (중앙값 1.02)
         후면 중앙               y375~380 → 1.03~1.05, 최저점 y392 → 1.09
         내부 레이어 단(허쉬 단) y272~285 → 0.72~0.74
       그래서 아래 여섯 값이 전부 <b>실측</b>이다. 예전 값과의 차:
         side −0.12 · occipital −0.25 · nape −0.26 (여기가 "길다"의 정체)
         front +0.05 · crown −0.04 · temple +0.03 */
    tipAt: { front:0.50, crown:0.74, temple:0.98, side:1.03, occipital:1.05, nape:1.09 },
    /* 커트 — 레이어드 보브는 시술각을 높여 위층을 짧게 만든다(유니폼 레이어).
       네이프만 각을 낮춰 무게를 남겨야 아래 라인이 안 흩어진다(그라데이션). */
    /* density(숱) — 레퍼런스의 정체적 특징이 여기 있다 (2026-08-09).
       앞머리는 <b>시스루</b>다: 눈썹을 덮되 이마가 비쳐야 한다. 길이·텍스처로는
       안 된다(짧고 뾰족한 두꺼운 앞머리가 될 뿐). 가닥을 솎아야 비친다.
       관자는 얼굴 옆 잔머리라 앞머리보다는 촘촘하되 사이드보다는 성기다.
       뒤(사이드·후두부·네이프)는 무게가 남아야 보브 라인이 안 흩어지므로 100. */
    /* (2026-08-09) 레퍼런스 대조 후 조정 — 바꾼 값에만 이유를 단다.
       crown elevation 80→85: 내부 레이어 끝(0.74)과 아웃라인(1.03)의 단차가
         두상 높이의 0.29다. 이 단을 만드는 게 시술각이라 조금 더 세운다.
       front density 42→34, texture 60→70: 목표의 뱅은 이마가 <b>비친다</b>.
         지금 결과는 통짜 커튼이라 시스루가 아니다. 숱을 더 솎고 끝을 더 턴다.
       side/occipital texture 45/40→55/50: 허쉬컷 특유의 뾰족한 끝(포인트 커트).
       나머지(temple·nape·기법·라인)는 목표와 어긋난 근거가 없어 그대로 둔다. */
    cut: {
      crown:     { technique:'uniform',    elevation:85, texture:45, density:88 },
      front:     { technique:'uniform',    elevation:20, texture:70, density:34, line:50 },
      temple:    { technique:'uniform',    elevation:60, texture:45, density:70, overdirection:40 },
      side:      { technique:'uniform',    elevation:65, texture:55, density:100 },
      occipital: { technique:'uniform',    elevation:55, texture:50, density:100 },
      nape:      { technique:'graduation', elevation:25, texture:25, density:100, line:50 },
    },
    /* curl 22→28: 목표는 중간기장에 S 한 번이 눈에 보인다(지금 결과는 직모에 가깝다).
       wave 70(굵은 로드)은 그대로 — 컬을 잘게 만들면 허쉬가 아니라 펌이 된다.
       ── (2026-08-30 4차) 두 값 다 <b>환산</b>됐다. 컬 세기 눈금(ampGamma)과 로드
          눈금(조화)이 바뀌었으므로, 같은 나선이 나오도록 되짚은 것이다:
            curl 28 → <b>23</b> (tight 0.28 그대로) · wave 70 → <b>83</b> (R 0.055 그대로)
          숫자가 작아 보이지만 <b>결과는 같다</b>. 눈금이 촘촘해진 쪽으로 옮겨간 것.
          섹션 기본값 curl 30도 같은 이유로 <b>25</b>로 옮겼다(기본 렌더 불변). */
    /* (2026-08-30 4차) wave 70 → <b>89</b> — 로드 반경 눈금이 바뀌어
       같은 R(0.055)이 나오도록 환산했다. 로드 굵기는 그대로다. */
    perm:    { curl:28, wave:70 },
    /* flow 55→68: 목표의 끝은 또렷하게 <b>바깥으로</b> 꺾인다(아웃컬).
       volume·sweep·part·finish는 목표와 어긋난 근거가 없어 유지. */
    styling: { sweep:0, volume:55, flow:68, part:0, finish:58 },
    /* 레퍼런스 4뷰의 헤어 마스크 픽셀 분포(모발 화소 약 25만): p25 #34251B ·
       p50 #493729 · p75 #66503E · p90 #8B715E.
       여기 적는 색은 <b>가장 밝을 때</b>의 색이다 — 렌더가 층 깊이로 ×0.55~1.0을
       곱하고 림만 더하므로, 사진의 중간톤(p50)을 그대로 넣으면 화면은 그보다 더
       어두워진다. 그래서 p80 언저리를 base로 잡는다.
       예전 #8B7355는 p90(하이라이트)이라 화면 전체가 그 밝기로 떠 있었다. */
    color:   '#7A6149',                                        // 밀크티 애쉬 브라운
  },
  /* ══════════════════════════════════════════════════════════════
     테이퍼 페이드 · 하드파트 폼파두르 (2026-08-23 8차, <b>초안 1</b>)
     ─────────────────────────────────────────────────────────────
     사용자가 준 남성 4뷰. 레이어드 보브를 만들 때와 같은 자로 쟀다 —
     측면 뷰에서 눈 y240 · 턱 y425(눈→턱 11.5cm)로 자를 만들고 b(12.2cm)를
     얹으니 정수리 y44가 나왔다(사진의 실제 정수리 y≈40과 일치 → 자가 맞다).
     두상 높이 H = 393px. 그 자로 잰 <b>구조</b>:
       하드파트 라인      y125 → 0.21   ← 윗머리와 사이드가 끊기는 자리
       구레나룻 끝        y290 → 0.63
       귀 뒤 페이드 하단  y320 → 0.70
     ⚠ 이 셋은 <b>뿌리 쪽 경계</b>이지 tipAt(끝 높이)이 아니다. 아래 tipAt은
       페이드를 끄고 가위로만 잘랐을 때의 끝 높이이며, <b>아직 실측이 아니라
       초안</b>이다. layered_bob_hush도 첫 판은 눈대중이었고 실기기 결과를 보고
       두 번 고쳤다(8/09 기록: "뒤가 통째로 길었다"). 같은 절차를 밟을 것 —
       버튼을 누르면 [스타일스펙] 로그가 섹션별 <b>끝높이 오차</b>를 찍는다.
       그 수를 보고 여기를 고치는 게 이 시스템의 사용법이다.

     ── tipAt이 <b>가위 길이</b>인 이유 ─────────────────────────────
     페이드는 이 스펙에서 길이 역산 <b>뒤에</b> 걸린다. 실제 시술 순서가 그렇고
     (가위로 형태를 잡고 클리퍼로 사이드를 민다), fadeCutLen이 Math.min이라
     나중에 걸어도 역산 결과를 <b>짧게만</b> 만들기 때문이다. 페이드를 켠 채
     역산하면 사이드 가닥 대부분이 3mm라 중앙값이 페이드에 먹혀서 tipAt이
     뜻을 잃는다. applyStyleSpec이 역산 전에 state.fade를 끄는 이유다. */
  taper_fade_pomp: {
    /* (2026-08-25) 이름에서 '하드파트'를 뺐다 — 사용자 확인 결과 레퍼런스는
       면도선이 아니라 <b>가르마 + 빗질</b>이다. 이름이 틀리면 그 이름을 근거로
       다음 작업(면도선 연산자)이 잡히므로 여기서 바로잡는다. */
    name: '테이퍼 페이드 · 사이드파트 폼파두르',
    /* ── (2026-08-26) tipAt → <b>lenCm</b> 으로 갈아엎음 ──────────────────
       하네스가 잰 결과 이 스펙은 <b>한 번도 안 풀리고 있었다</b>:
         풀린 길이   front 100 · crown 100 · temple 100 · side 0 · occipital 0 · nape 0
         끝높이 오차 front +57.8% · crown +23.6% · temple +12.2%
       여섯 개 전부 슬라이더 범위 끝이다. 이유와 근거는 위 "길이를 cm로" 배너에
       적어 뒀다 — 요약하면 <b>뒤로 넘긴 머리에 끝 높이는 뜻이 없다</b>.

       ── 이 값들의 출처 (초안 — tipAt과 같은 자격) ────────────────────
       측면 뷰에서 윗머리가 덮는 두피면의 <b>앞→뒤 호길이</b>를 같은 자로 쟀다:
         앞 헤어라인 (110,100) → 정수리 (200,55) → 뒤 (300,105)  ≈ 212px
         16.09px/cm 이므로 <b>13.2cm</b>. 앞머리를 뒤로 넘겼을 때 그 호의 절반
         남짓을 덮으므로 front 8cm. crown은 그 위에 얹혀 뒤로 눕는 층이라 5cm.
       ⚠ 이건 <b>사진에서 잰 호길이로부터의 추정</b>이지 가닥 하나를 직접 잰 게
         아니다(가닥 끝이 머리 덩어리 안에 묻혀 있어 사진으로는 못 잰다).
         실기기 [스타일스펙] 로그가 섹션별 cm 오차를 찍으니 그걸 보고 고칠 것 —
         layered_bob_hush의 tipAt이 밟은 것과 똑같은 절차다.
       ⚠ 사이드 넷(temple·side·occipital·nape)의 cm는 <b>디스커넥션 라인 위에
         남는 가위 길이</b>다. 라인 아래는 전부 클리퍼가 다시 들어가므로
         (fadeCutLen이 Math.min) 이 값이 그 아래를 길게 만들 수는 없다. */
    lenCm: { front:8.0, crown:5.0, temple:4.0, side:3.0, occipital:4.0, nape:3.0 },
    /* 윗머리는 <b>질감이 살아 있다</b>(가닥이 갈라져 보인다) → texture 높음.
       사이드는 클리퍼가 만드는 면이라 텍스처를 넣으면 오히려 지저분해진다 → 낮음.
       숱은 전부 100 — 이 컷은 시스루가 아니라 <b>덩어리</b>가 있어야 한다
       (레이어드 보브에서 front density 34로 솎았던 것과 정반대다). */
    cut: {
      crown:     { technique:'uniform',    elevation:75, texture:55, density:100 },
      front:     { technique:'uniform',    elevation:45, texture:60, density:100, line:50 },
      /* (2026-08-26) elevation 30 → <b>70</b>. 8/26 범위 실측이 원인을 짚었다 —
         짧게 자르는 손잡이는 길이가 아니라 <b>시술각</b>이고(len0에서 elev30이면
         12.9cm, elev90이면 0.98cm), 관자가 4cm 목표에 +8.2cm로 못 닿던 것이
         이것이었다("못 적는 것 ④"). 디스커넥션 라인 <b>위</b>의 관자는 사실상
         윗머리이므로 crown(75)에 가까운 각으로 세우는 게 시술로도 맞다. */
      temple:    { technique:'uniform',    elevation:70, texture:30, density:100, overdirection:0 },
      side:      { technique:'uniform',    elevation:20, texture:20, density:100 },
      occipital: { technique:'graduation', elevation:35, texture:30, density:100 },
      nape:      { technique:'graduation', elevation:15, texture:20, density:100, line:50 },
    },
    /* 직모다. curl 0이면 gravityDroop도 안 걸린다(adjustStrandGeom ③). */
    /* 직모다. curl 0이면 wave는 안 쓰이지만, 컬을 올렸을 때 스펙이 뜻한
       중간 로드가 나오도록 wave 50 → <b>68</b>로 같이 환산했다(같은 R 0.045). */
    perm:    { curl:0, wave:50 },
    /* ── 이 컷의 절반은 여기 있다 ────────────────────────────────
       sweep +72 — 윗머리 전체가 <b>뒤로</b> 넘어간다. 이게 없으면 앞으로 흘러
         내려 뱅이 되고, 그 순간 폼파두르가 아니라 그냥 짧은 커트가 된다.
       volume 82 — 앞머리 뿌리가 <b>선다</b>. 폼파두르의 리프트가 이 값이다.
       part +60 / partAmt 55 — 가르마가 <b>오른쪽</b>이다.
         ⚠ (2026-08-25 사용자 정정) 이건 <b>하드파트가 아니다</b> — "가르마는 원래대로
           놓고 거기에 <b>빗질</b>을 더하면 저런 머리가 되는 걸로". 그래서 면도선을
           전제로 92까지 밀던 근거가 사라졌다. 92를 유지할 이유가 없어 내렸지만
           <b>55는 실측이 아니라 초안</b>이다(tipAt과 같은 자격). 또렷함의 나머지는
           partAmt를 더 미는 게 아니라 빗질(COMB)이 만든다 — 실기기에서 빗어 보고
           그 결과로 이 숫자를 고칠 것.
       finish 45 — 매트~새틴. 젖은 광이 아니라 마른 질감이다. */
    /* ── (2026-08-26) 정돈·가르마 ────────────────────────────────────
       sleek 80 — 사용자: "머리가 좀 더 <b>눌러붙어서</b> 깔끔하게 정리되는 거".
         실기기 8/25 녹화에서 윗머리가 삐죽하게 서고 옆으로 퍼졌다. 이 컷은
         제품(포마드)으로 눌러 붙인 머리라 정돈이 세다. 100이 아닌 것은 레퍼런스
         윗머리에 <b>질감이 살아 있기</b> 때문(texture 55~60과 같은 이유).
       partAmt 55 → <b>75</b>. 8/25에 55로 내린 근거는 "면도선이 아니라 가르마"였고
         그건 여전히 맞다. 다만 <b>선이 안 보이던 진짜 이유는 세기가 아니라
         머리가 떠 있어서</b>였다 — 삐죽 선 머리에는 가르마가 안 생긴다. sleek이
         눕히고 나서야 세기가 뜻을 갖는다. 그래서 이번에 같이 올린다.
         ⚠ 여전히 실측이 아니라 초안이다(tipAt과 같은 자격). */
    /* ── (2026-08-30) 세 값이 <b>실측으로</b> 움직였다 ──────────────────────
       사용자: "레퍼런스처럼 가르마 타고 머리 붙게." 8/26에 sleek 80·partAmt 75로
       올렸는데도 실기기에서 삐죽 서고 가르마가 안 보였다. 하네스로 재보니 값이
       모자란 게 아니라 <b>연산자 둘이 각각 값을 못 쓰고 있었다</b>(두 배너 참고):
         · sleek이 꺾임을 누적 안 함 → 80과 100이 뜸 1.58 vs 1.54cm로 사실상 같음
         · 넘김이 가르마를 덮어씀   → 가르마비 0.64(넘김0) → 1.20(넘김72)
       고친 뒤에야 이 세 값이 뜻을 갖는다. 그래서 고친 <b>다음</b> 표에서 골랐다
       (뜸 중앙/p90 · 파묻힘 · 가르마비, PART_SWEEP_MIX 1.2 · 이월 sleek 100):
         volume 82 → 뜸 1.24cm · 가르마비 0.68
         volume 70 → 뜸 1.06cm · 가르마비 <b>0.67</b>
         volume 60 → 뜸 0.92cm · 가르마비 0.71
         volume 55 → 뜸 0.84cm · 가르마비 0.71
       volume <b>70</b>을 쓴다. 60 아래는 뜸이 더 줄지만 폼파두르의 <b>리프트</b>가
       같이 죽는다 — 이 컷은 눌러 붙인 머리가 아니라 <b>앞은 서고 위는 눕는</b>
       머리다(레퍼런스 4장 전부 앞머리가 서 있다). 82는 그 리프트를 사이드까지
       걸어서 8/25 녹화의 부푼 모양을 만든 값이다.
       sleek 80 → <b>100</b>: 이제 세기가 실제로 먹으므로 끝까지 쓴다. 제품(포마드)으로
         눌러 붙인 머리라는 8/26의 근거는 그대로고, 그때 100을 안 쓴 이유였던
         "윗머리에 질감이 살아 있다"는 texture 55~60이 맡는다(기하가 아니라 질감이다).
       partAmt 75 → <b>90</b>: 표에서 100이 가르마비 최저(0.67)였으나 슬라이더 끝값이라
         보정 여유가 없다. 90에서 0.68로 사실상 같아 90을 쓴다.
       ⚠ 셋 다 여전히 <b>초안</b>이다(tipAt과 같은 자격) — 합성 두상에서 잰 값이지
         이 손님에서 잰 값이 아니다. 실기기 [스타일스펙] 로그를 보고 고칠 것. */
    /* ── (2026-08-30 4차) 네 값이 <b>환산</b>됐다 — 그림은 그대로다 ──────────
       슬라이더 응답 곡선(sliderResponse)과 가르마 위치 자(MAXOFF)를 고치면서
       <b>같은 숫자가 다른 그림</b>이 되므로, 렌더 결과가 안 바뀌도록 되짚었다.
       튜닝을 다시 한 게 아니라 <b>자를 바꾸고 눈금을 옮겨 적은</b> 것이다:
         sweep   72 → <b>81</b>   (v' = 100·(v/100)^(1/1.6))
         partAmt 90 → <b>92</b>   (γ 1.2)
         sleek  100 → <b>100</b>  (끝값은 감마와 무관 — 안 움직인다)
         part    60 → <b>83</b>   (3차가 놓던 자리 ux −0.54를 MAXOFF 0.65로 환산)
       volume·flow·finish는 응답이 이미 선형이라(하네스: 칸마다 10%) 안 건드렸다.
       ⚠ 셋 다 여전히 <b>초안</b>이다(tipAt과 같은 자격). 자만 바로잡았을 뿐,
         이 손님에서 잰 값이 아니다 — 실기기 [스타일스펙] 로그로 고칠 것. */
    styling: { sweep:81, volume:70, flow:10, part:83, partAmt:92, finish:45, sleek:100 },
    /* ── 클리퍼 (2026-08-23 7차 연산자 · 2026-08-26 디스커넥션·테이퍼) ────
       guard 2 = 6.4mm. 디스커넥션 라인 <b>바로 아래</b>의 길이다. 예전엔 1(3.2mm)
         이었는데 그건 "페이드 전체가 한 길이"일 때의 값이고, 이제 taper가
         아래쪽을 닫으므로 이 숫자는 <b>위쪽 끝</b>을 뜻한다. 의미가 바뀌었으니
         값도 같이 옮긴다 — 안 옮기면 사이드 전체가 예전보다 짧아진다.
       disc 21 — 레퍼런스 측면 뷰 실측(위 DISC3D 배너에 세 뷰 대조까지).
         이게 켜지면 height·blendWidth는 <b>안 쓰인다</b>(라인이 꼭대기이고
         거기서 끊긴다). 남겨 두는 건 disc를 0으로 되돌렸을 때의 폴백값이라서다.
       taper 80 — 구레나룻이 거의 살까지 닫히고 라인 쪽으로 열린다. 100이 아닌
         것은 레퍼런스의 맨 아래가 완전 스킨은 아니기 때문(그루터기가 보인다). */
    fade:    { enabled:true, guard:2, height:65, blendWidth:45, disc:21, taper:80 },
    /* 레퍼런스 모발 화소 약 7.3만: p25 #27201B · p50 #3E352F · p75 #584D47 ·
       p80 #60554E · p90 #81827C.
       layered_bob_hush와 같은 규칙으로 <b>p80</b>을 base로 잡는다 — 렌더가 층
       깊이로 ×0.55~1.0을 곱하므로 중간톤을 그대로 넣으면 화면이 더 어두워진다. */
    color:   '#60554E',                                        // 다크 애쉬 브라운
  },
};
/* ── 아직 못 적는 것 (2026-08-23 8차 · 2026-08-26 갱신) ────────────────────
   위 스펙으로도 <b>레퍼런스와 다르게</b> 나올 자리를 미리 적어 둔다. 나중에
   "왜 안 맞지"를 처음부터 다시 찾지 않도록.
     ① <b>디스커넥션</b> — <b>2026-08-26에 됐다</b>(fade.disc · DISC3D 배너 참고).
        하네스 실측: 라인 위 17.4cm / 아래 0.6cm = <b>단차 16.8cm</b>, 그리고
        윗머리가 사이드를 덮는 비율 <b>46.1% → 0%</b>.
     ② <b>면도선(하드파트)</b> — 살이 보이는 얇은 줄. 어휘가 통째로 없다.
        두피 위 평면 근처 가닥을 지우는 연산이라 density의 공간판이 필요하다.
        ※ 2026-08-25에 사용자가 "레퍼런스는 면도선이 아니라 가르마+빗질"이라고
          정정했으므로, 이 컷에는 <b>필요 없다</b>. 다른 컷을 위해 남겨 둔다.
     ③ <b>좌우 비대칭</b> — 가르마가 한쪽이다. state.sections가 전역 한 벌이라
        사이드를 좌우 따로 못 자른다. applyStyleSpec이 rep.asym으로 <b>얼마나
        다른지는 이미 재고</b> 있다(로그 [스타일스펙·좌우차]) — 쓸 곳이 없어서
        찍고 버릴 뿐이다. 이게 다음 순서다.
     ④ <b>(새로 드러남) 가위로는 못 짧게 자르는 바닥</b> — 하네스에서 temple이
        cm 목표 4cm에 <b>+8.2cm</b>로 못 닿았다. sectionLengthRatio의 하한 때문이고
        (파일 상단 "길이 상한 ≈1.36배 … 하한" 항목), 페이드는 그 하한을 우회하지만
        <b>디스커넥션 라인 위</b>는 가위 구역이라 우회로가 없다. 즉 긴 머리 손님의
        관자를 4cm로 보여줄 수 없다. 실기기에서 관자가 길게 남으면 원인이 여기다.
        ※ 다만 하네스의 합성 뿌리는 <b>헐</b> 타원체 위에 심겨 있어 실제(두피 타원체,
          b 0.595 vs 헐 0.631)보다 temple 뿌리가 높게 잡힌다 — 실기기에서는 관자
          상당수가 라인 <b>아래</b>로 내려가 클리퍼가 맡을 것이다. 과장된 수치다.
   ②③④가 없으면 이 컷은 "짧은 사이드 + 끊긴 선 + 뒤로 넘긴 윗머리"까지는 되고,
   <b>좌우가 다른 것</b>과 <b>아주 짧은 관자</b>는 안 된다. */
/* 이 섹션 가닥들의 <b>끝 높이 중앙값</b>.
   ⚠ 커트만 재면 안 된다. 하네스에서 확인: 커트로 맞춰 놓은 끝이 펌·스타일링을
   거치면 두상 높이의 <b>0.3만큼 더 내려갔다</b>(side 1.15 → 1.43). 미용사가 보는
   건 마지막 그림이므로, 역산도 <b>연산자를 전부 거친 뒤</b>의 끝을 재야 한다.
   그래서 조정 파이프라인과 같은 함수(adjustStrandGeom)를 쓴다.
   표본은 섹션당 최대 SOLVE_SAMPLE개 — 중앙값이라 표본으로 충분하고, 이분탐색이
   24번 도는 동안 전 가닥을 돌리면 느리다. */
const SOLVE_SAMPLE = 160;
/* 이 뿌리가 <b>어느 뷰의 머리</b>인가 — 가장 크게 보이는 뷰. 스타일링이 이미
   쓰고 있는 viewWeightsForRoot를 그대로 재사용한다(판정 기준이 갈리면 안 된다).
   섹션은 두피 구역이라 좌우가 한 덩어리(side/temple)인데, 실제 시술은 좌우를
   따로 자를 수 있으므로 역산은 뷰별로도 낸다. */
function viewOfRoot(p){
  const w = viewWeightsForRoot(p);
  let best = ANGLES[0], bv = -Infinity;
  for(const a of ANGLES) if(w[a] > bv){ bv = w[a]; best = a; }
  return best;
}
function solvePoolFor(secId, view){
  const m = state.hair3Dneutral;
  if(!m || !m.strands) return null;
  const key = secId + '|' + (view || '*');
  const cache = m._solveCache || (m._solveCache = {});
  if(cache[key]) return cache[key];
  let all = m.strands.filter(s=>s.sec === secId);
  if(view) all = all.filter(s=>viewOfRoot(s.pts[0]) === view);
  const step = Math.max(1, all.length / SOLVE_SAMPLE);
  const pool = []; for(let i=0;i<all.length;i+=step) pool.push(all[i|0]);
  return (cache[key] = pool);
}
function measureSectionTipY(secId, lenVal, view){
  const m = state.hair3Dneutral;
  if(!m || !m.strands) return null;
  const pool = solvePoolFor(secId, view);
  if(!pool || !pool.length) return null;
  const uni = uniformStyling();
  const ys = [];
  for(const st of pool){
    const p = adjustStrandGeom(st, lenVal, uni);
    ys.push(p[p.length-1].y);
  }
  ys.sort((a,b)=>a-b);
  return ys[(ys.length*0.5)|0];
}
/* 끝 높이가 targetY가 되는 길이 슬라이더 값. 길이↑ → 끝↓ 로 단조라 이분탐색이 된다.
   view를 주면 그 뷰에서 보이는 가닥만으로 푼다(좌우 비대칭 확인용). */
function solveSectionLengthForTipY(secId, targetY, view){
  if(measureSectionTipY(secId, 50, view) == null) return null;
  let lo = 0, hi = 100;
  for(let i=0;i<24;i++){
    const mid = (lo + hi) / 2;
    const y = measureSectionTipY(secId, mid, view);
    if(y == null) return null;
    if(y > targetY) lo = mid; else hi = mid;   // 끝이 아직 위에 있다 = 짧다 → 늘린다
  }
  return Math.max(0, Math.min(100, Math.round((lo + hi) / 2)));
}
/* ══════════════════════════════════════════════════════════════════
   길이를 <b>cm로</b> 적는다 (2026-08-26)
   ─────────────────────────────────────────────────────────────────
   tipAt은 "끝이 어느 높이에 오는가"다. 보브에는 그게 맞는 어휘였다 —
   밑단이 곧 그 스타일이니까. 그런데 <b>뒤로 넘긴 남자 머리</b>에는 뜻이 없다.

   ── 하네스가 잡은 것 (고치기 전 taper_fade_pomp 실측) ─────────────
     풀린 길이   front 100 · crown 100 · temple 100 · side 0 · occipital 0 · nape 0
     끝높이 오차 front <b>+57.8%</b> · crown +23.6% · temple +12.2% (두상높이 대비)
   <b>여섯 섹션 전부가 슬라이더 범위 끝에 붙어 있었다.</b> 즉 [스타일스펙·못 풂]
   경고가 여섯 개 다 떠야 하는 상태로 스펙이 들어가 있었다.
   이유는 이분탐색 잘못이 아니다 — sweep +72가 앞머리를 <b>뒤로</b> 실어 가므로
   끝이 뒤통수 위에 얹힌다. tipAt front 0.70(눈썹 높이)은 길이를 100으로 밀어도
   <b>도달할 수 없는 목표</b>였다. 스펙 주석이 스스로 "빗어 내렸을 때의 끝
   높이"라고 적어 뒀는데, 역산은 스타일링까지 <b>거친 뒤</b>를 잰다(그게
   2026-08-09에 일부러 그렇게 만든 것이다 — 미용사가 보는 건 마지막 그림이니까).
   두 문장이 서로 어긋나 있었고, 어긋난 채로 값이 들어가 있었다.

   ── 그래서 절대 길이 ────────────────────────────────────────────
   남자 컷을 말할 때 미용사는 "탑 5cm"라고 하지 "끝이 눈썹 높이"라고 하지
   않는다. 페이드 가드가 이미 cm인 것과 같은 이유다(FADE3D 배너 참고) —
   <b>손님이 누구든 5cm는 5cm</b>라 프리셋 하나가 모두에게 쓰인다.
   자는 modelCmPerUnit() 하나를 공유한다(두 벌이 되면 갈라진다).
   ⚠ 이것도 스타일링을 <b>거친 뒤</b>를 잰다 — 컬을 넣으면 같은 커트도 호길이가
     길어지므로, tipAt이 그랬듯 마지막 그림 기준이어야 값이 뜻을 갖는다.
══════════════════════════════════════════════════════════════════ */
function measureSectionLenCm(secId, lenVal, view, aboveY){
  const m = state.hair3Dneutral;
  if(!m || !m.strands) return null;
  const cm = modelCmPerUnit();
  if(!cm) return null;
  let pool = solvePoolFor(secId, view);
  if(!pool || !pool.length) return null;
  /* aboveY를 주면 <b>그 높이 위에서 난 가닥만</b> 잰다. 페이드 섹션에 쓰는데,
     이유는 그 섹션의 라인 <b>아래</b>는 가위가 아니라 클리퍼가 정하기 때문이다.
     안 거르면 도달 불가능한 목표를 이분탐색에 주게 되고(가위로는 sectionLengthRatio
     하한 밑으로 못 간다), 슬라이더가 0에 붙은 채 "못 풂" 경고만 뜬다 —
     하네스에서 side 오차 +12.87cm로 실제로 그렇게 나왔다. */
  if(typeof aboveY === 'number'){
    const up = pool.filter(s=>s.pts[0].y > aboveY);
    if(up.length < 8) return null;                  // 라인 위가 거의 없다 = 통째로 클리퍼 구역
    pool = up;
  }
  const uni = uniformStyling();
  const Ls = [];
  for(const st of pool) Ls.push(arcLength3D(adjustStrandGeom(st, lenVal, uni)) * cm);
  Ls.sort((a,b)=>a-b);
  return Ls[(Ls.length*0.5)|0];
}
/* 길이 중앙값이 targetCm이 되는 슬라이더 값. 길이↑ → 호길이↑ 로 단조. */
function solveSectionLengthForCm(secId, targetCm, view, aboveY){
  if(measureSectionLenCm(secId, 50, view, aboveY) == null) return null;
  let lo = 0, hi = 100;
  for(let i=0;i<24;i++){
    const mid = (lo + hi) / 2;
    const c = measureSectionLenCm(secId, mid, view, aboveY);
    if(c == null) return null;
    if(c < targetCm) lo = mid; else hi = mid;
  }
  return Math.max(0, Math.min(100, Math.round((lo + hi) / 2)));
}
/* 스펙 → 실제 파라미터. 반환값은 뭘 얼마로 풀었는지의 보고서(검증용). */
function applyStyleSpec(id){
  const sp = STYLE_SPECS[id];
  const m = state.hair3Dneutral;
  if(!sp || !m || !m.strands || !m.strands.length){ console.warn('[스타일스펙] 모델이 없다'); return null; }
  const R = headHeightRef();
  if(!R){ console.warn('[스타일스펙] 두상 자가 없다'); return null; }
  const yTop = R.yTop, H = R.H;
  const rep = { name: sp.name, solved: {}, missY: {} };
  /* 순서가 중요하다: 커트기법·펌·스타일링을 <b>먼저</b> 걸고 길이를 푼다.
     끝 높이는 컬·볼륨·결흐름을 다 거친 뒤의 값이므로, 그것들이 정해지기 전에
     길이를 풀면 나중에 전부 어긋난다(하네스에서 0.3 두상높이 차이로 확인). */
  for(const sec in sp.cut){
    if(!state.sections[sec]) continue;
    Object.assign(state.sections[sec], sp.cut[sec]);
    if(sp.perm){ state.sections[sec].curl = sp.perm.curl; state.sections[sec].wave = sp.perm.wave; }
    if(sp.color) state.sections[sec].color = sp.color;
  }
  if(sp.styling){
    state.stylingByView = neutralStylingByView();
    for(const a of ANGLES) Object.assign(state.stylingByView[a], sp.styling);
  }
  /* ── 페이드는 <b>역산 뒤에</b> 건다 (2026-08-23 8차) ───────────────────
     tipAt은 "가위로만 잘랐을 때 끝이 어디 오는가"다. 페이드를 켠 채 역산하면
     사이드 가닥 대부분이 3mm가 되어 <b>중앙값이 클리퍼에 먹힌다</b> —
     measureSectionTipY가 재는 게 가위 길이가 아니게 되고, 이분탐색이 길이를
     아무리 움직여도 중앙값이 안 따라오므로 tipAt이 뜻을 잃는다.
     실제 시술 순서도 같다: 가위로 형태를 잡고 <b>그 다음</b> 클리퍼가 들어간다.
     그리고 fadeCutLen이 Math.min이라 나중에 걸어도 역산 결과를 짧게만 만든다 —
     순서를 이렇게 두는 것이 안전한 이유다.
     ⚠ 여기서 <b>명시적으로 끈다</b>. 지난번에 켜 둔 페이드가 남아 있으면 이번
       역산이 조용히 오염된다(스펙을 두 번 누르면 결과가 달라진다). */
  const _fadeSaved = state.fade && { ...state.fade };
  if(state.fade) state.fade.enabled = false;
  rep.byView = {};
  /* 섹션마다 <b>둘 중 하나</b>로 적힌다: lenCm(절대 길이) 또는 tipAt(끝 높이).
     lenCm이 우선 — 같은 섹션에 둘 다 적혀 있으면 cm가 이긴다(그게 더 강한 진술이다).
     두 어휘를 한 루프에서 도는 이유는 뒤따르는 뷰별 역산·좌우차 계산이 완전히
     같기 때문이다. 두 벌로 적으면 한쪽만 고쳐진다(작업원칙 3). */
  const secIds = [];
  for(const s in (sp.lenCm || {})) secIds.push(s);
  for(const s in (sp.tipAt || {})) if(secIds.indexOf(s) < 0) secIds.push(s);
  rep.unit = {};
  /* 이 스펙에 디스커넥션이 있으면, 페이드 섹션의 가위 목표는 <b>라인 위</b>에만
     해당한다(아래는 클리퍼가 정한다). 그 구분을 여기서 한 번 만들어 넘긴다. */
  const specDiscY = (sp.fade && sp.fade.disc > 0) ? (yTop - (sp.fade.disc/100) * H) : null;
  for(const sec of secIds){
    if(!state.sections[sec]) continue;
    const byCm = !!(sp.lenCm && sp.lenCm[sec] != null);
    const aboveY = (byCm && specDiscY != null && FADE_SOLVE_ABOVE_LINE[sec]) ? specDiscY : undefined;
    rep.unit[sec] = byCm ? 'cm' : 'tip';
    const targetY = byCm ? null : (yTop - sp.tipAt[sec] * H);
    const v = byCm ? solveSectionLengthForCm(sec, sp.lenCm[sec], undefined, aboveY)
                   : solveSectionLengthForTipY(sec, targetY);
    /* 이 섹션에 가닥이 하나도 없으면(뿌리밀도 0 구역 등) 풀 게 없다. 값을
       지어내지 않고 비워 둔다 — 로그가 NaN을 찍지 않게 오차도 같이 비운다.
       페이드 섹션이 라인 아래로 통째로 들어간 경우도 여기로 온다 — 그건 실패가
       아니라 <b>클리퍼 구역</b>이라는 뜻이라 따로 표시한다. */
    if(v == null){
      rep.solved[sec] = null; rep.missY[sec] = null;
      if(aboveY != null) rep.unit[sec] = 'clipper';
      continue;
    }
    state.sections[sec].length = v;
    rep.solved[sec] = v;
    if(byCm){
      const gotCm = measureSectionLenCm(sec, v, undefined, aboveY);
      /* 오차 단위를 tipAt과 <b>같게</b> 맞춘다(두상 높이 대비 비율) — 안 그러면
         한 로그 줄에 cm와 %가 섞여서 어느 쪽이 큰 오차인지 못 읽는다. */
      const cmPerU = modelCmPerUnit();
      rep.missY[sec] = (gotCm == null || !cmPerU) ? null
        : +(((gotCm - sp.lenCm[sec]) / cmPerU) / H).toFixed(4);
      rep.missCm = rep.missCm || {};
      rep.missCm[sec] = (gotCm == null) ? null : +(gotCm - sp.lenCm[sec]).toFixed(2);
    } else {
      const got = measureSectionTipY(sec, v);
      rep.missY[sec] = (got == null) ? null : +((got - targetY) / H).toFixed(4); // 두상높이 대비 오차
    }
    /* 뷰별 역산 — 섹션은 두피 구역이라 좌우가 한 덩어리지만, 그 안에서
       <b>좌우가 서로 다른 값을 요구하는지</b>는 여기서 드러난다. 차이가 크면
       그 손님은 비대칭이고, 섹션 하나로는 양쪽을 동시에 못 맞춘다. */
    for(const a of ANGLES){
      const pool = solvePoolFor(sec, a);
      if(!pool || pool.length < 8) continue;             // 이 뷰에 거의 없는 섹션은 건너뛴다
      const vv = byCm ? solveSectionLengthForCm(sec, sp.lenCm[sec], a, aboveY)
                      : solveSectionLengthForTipY(sec, targetY, a);
      if(vv == null) continue;
      (rep.byView[a] || (rep.byView[a] = {}))[sec] = { length: vv, n: pool.length, d: vv - v };
    }
  }
  /* 역산이 끝났다 — 이제 클리퍼가 들어간다. 스펙에 페이드가 없으면 <b>끈 채로</b>
     둔다(그게 이 스펙의 뜻이다). 있으면 그 값을 그대로 넣는다 — 페이드는
     역산 대상이 아니라 미용사가 고르는 값이다(가드 번호는 절대 길이다). */
  if(state.fade){
    if(sp.fade) Object.assign(state.fade, sp.fade);
    else if(_fadeSaved) state.fade.enabled = false;
    rep.fade = { ...state.fade };
  }
  rep.asym = {};
  for(const sec in rep.solved){
    const L = rep.byView.left && rep.byView.left[sec], R = rep.byView.right && rep.byView.right[sec];
    if(L && R) rep.asym[sec] = L.length - R.length;      // + = 왼쪽이 더 길게 잘라야
  }
  /* ── 못 푼 섹션을 <b>말한다</b> (2026-08-09) ────────────────────────────
     실기기 로그에서 crown이 길이 100(상한)에 붙은 채 끝높이 오차 24.9%로 나왔다.
     이분탐색이 실패한 게 아니라 <b>슬라이더 범위 안에 답이 없었다</b>는 뜻이다 —
     그 섹션 가닥이 목표 높이까지 닿을 만큼 길지 않다(뿌리 길이가 잘못 심겼거나
     스펙의 tipAt이 이 두상엔 무리거나). 조용히 상한값을 넣으면 "스펙대로 됐다"고
     읽히는데 실제로는 그 섹션만 원래보다 <b>더 길어진다</b>. 반드시 눈에 띄게. */
  const stuck = Object.keys(rep.solved).filter(s=>
    rep.solved[s] != null && (rep.solved[s] <= 0 || rep.solved[s] >= 100)
    && rep.missY[s] != null && Math.abs(rep.missY[s]) > 0.05);
  if(stuck.length) console.warn('[스타일스펙·못 풂] ' + stuck.map(s=>
      s + ' 길이 ' + rep.solved[s] + '(범위 끝) 남은 오차 ' + (rep.missY[s]*100).toFixed(1) + '%').join(' · ')
    + '\n    슬라이더 범위 안에 답이 없습니다 — 이 섹션은 스펙대로 안 잘렸고, 값은 상·하한에 붙어 있습니다.'
    + '\n    먼저 볼 것: [마네킹] 섹션길이(중앙값)와 [마네킹·뷰별길이 가둠] — 뿌리 길이가 뷰마다 달랐다면 그게 원인입니다.');
  const missTxt = Object.keys(rep.missY)
    .map(s=> s + ' ' + (rep.missY[s] == null ? '—' : (rep.missY[s]*100).toFixed(1) + '%')
             + ((rep.missCm && rep.missCm[s] != null) ? '(' + (rep.missCm[s]>0?'+':'') + rep.missCm[s] + 'cm)' : '')).join(' ');
  console.log('[스타일스펙] ' + sp.name
    + ' · 길이 ' + Object.keys(rep.solved).map(s=>s+' '+(rep.solved[s] == null
          ? (rep.unit && rep.unit[s] === 'clipper' ? '(클리퍼 구역 — 가위 목표 없음)' : '(가닥없음)')
          : rep.solved[s])
        + (rep.unit && rep.unit[s] === 'cm' ? '[cm목표 ' + sp.lenCm[s] + ']' : '')).join(' ')
    + ' · 오차(두상높이 대비) ' + missTxt);
  const VL = { front:'정면', left:'좌측', right:'우측', back:'후면' };
  for(const a of ANGLES){
    const bv = rep.byView[a]; if(!bv) continue;
    console.log('[스타일스펙·' + (VL[a]||a) + '] '
      + Object.keys(bv).map(s=>s+' '+bv[s].length+(bv[s].d ? '('+(bv[s].d>0?'+':'')+bv[s].d+')' : '')+'·'+bv[s].n+'가닥').join(' · '));
  }
  if(rep.fade) console.log('[스타일스펙·페이드] ' + (rep.fade.enabled
    ? '가드 ' + rep.fade.guard + '(' + guardMm(rep.fade.guard).toFixed(1) + 'mm)'
      + (rep.fade.disc > 0
          ? ' · 디스커넥션 라인 ' + rep.fade.disc + '%(두상높이) — 여기서 <b>끊김</b>'
          : ' · 높이 ' + rep.fade.height + '% · 블렌딩 ' + rep.fade.blendWidth + '%')
      + (rep.fade.taper > 0
          ? ' · 테이퍼 ' + rep.fade.taper + '%(맨 아래 ' + (FADE3D.skinCm*10).toFixed(1) + 'mm까지 닫힘)'
          : ' · 테이퍼 없음(블록)')
      + '  ← 역산 <b>뒤에</b> 걸림(가위 → 클리퍼 순서)'
    : '없음'));
  const asymTxt = Object.keys(rep.asym).filter(s=>Math.abs(rep.asym[s])>0).map(s=>s+' '+(rep.asym[s]>0?'+':'')+rep.asym[s]);
  console.log('[스타일스펙·좌우차] ' + (asymTxt.length ? asymTxt.join(' · ') + ' (+ = 좌측을 더 길게 잡아야)' : '없음 — 좌우 대칭'));
  /* 끝 높이를 맞춘 것과 <b>모양이 맞은 것</b>은 다르다 — 여기서 바로 실루엣을
     재서 레퍼런스와 대조한다(아래 "실루엣 자가측정" 구역). 이게 없으면 "스펙대로
     됐다"는 말이 끝 높이 하나에만 걸린 채로 남는다. */
  try{ _curlScaleLogged = false; logCurlScale(); }catch(e){}
  try{ rep.silhouette = reportSilhouette(id); }catch(e){ console.warn('[실루엣] 측정 실패: ' + (e && e.message)); }
  try{ rep.crown = diagCrownCoverage(); }catch(e){ console.warn('[정수리 커버리지] 측정 실패: ' + (e && e.message)); }
  try{ rep.roundTrip = diagRoundTrip(); }catch(e){ console.warn('[좌표왕복] 측정 실패: ' + (e && e.message)); }
  /* ── 이 보고서를 <b>화면에서도</b> 볼 수 있게 남긴다 (2026-08-25) ──────────
     사용자: "23일 이전까지는 폰으로 안 하고 노트북으로 작업했거든."
     이 함수의 결과는 여태 console.log로만 나갔고, 실기기 녹화(8/25)에는 한 줄도
     안 남았다 — tipAt 여섯 개를 고칠 근거(섹션별 끝높이 오차)가 통째로 없었다.
     8/22에 적어 둔 "재는 장치를 만들었다와 잴 수 있다는 다른 얘기였다"가
     콘솔이 없는 기기에서 그대로 재현된 것이다. 그래서 여기 담아 두고
     진단정보 패널이 읽어 간다(specPanelLines). */
  state._lastSpec = { id, name: sp.name, at: Date.now(), rep };
  return rep;
}

/* ══════════════════════════════════════════════════════════════════
   실루엣 자가측정 — "끝이 어디 오는가" 다음은 <b>어떤 모양인가</b> (2026-08-11)
   ─────────────────────────────────────────────────────────────────
   사용자: "커트·펌·스타일링을 조작해서 만드는 거니까 <b>그 수치를 알아내는 게</b>
   목적이다." 그러려면 먼저 <b>지금 결과가 목표와 얼마나 다른지</b>를 숫자로
   말할 수 있어야 한다. tipAt은 끝 <b>높이</b>만 잡는다 — 같은 높이에서 끝나도
   두상에 붙은 보브와 부풀어 뜬 덩어리는 완전히 다른 머리인데, 스펙에 그걸
   가리키는 어휘가 하나도 없었다.

   그래서 레퍼런스 사진을 재던 것과 <b>똑같은 지표</b>로 우리 결과도 잰다:
     · W/H       — 헤어 실루엣 바운딩박스의 가로/세로 비
     · 폭 프로파일 — 위(0)에서 아래(1)까지 11단, 각 높이의 실루엣 폭 ÷ 전체 폭
     · 밑단 라인   — 좌(0)에서 우(1)까지 13칸, 각 칸의 최저점 ÷ 전체 높이
   셋 다 <b>배율에 무관</b>하다(바운딩박스로 나눈다). 그래서 사진 픽셀과 우리
   투영 좌표를 자 없이 바로 비교할 수 있다 — 레퍼런스 모델과 손님의 두상 크기가
   달라도 성립한다.

   ⚠ 이 지표를 믿을 때의 한계(정직하게 적어 둔다):
   ① 레퍼런스 값은 <b>사진 세그멘테이션</b>이라 마스크 오차가 섞인다. 특히
      우측 50° 뷰의 중간 3단(0.44/0.39/0.45)은 얼굴이 실루엣을 끊어서 낮게
      나온 값이지 머리가 좁아서가 아니다 — 그 구간은 대조에서 빼고 본다.
   ② 레퍼런스는 정확히 ±50°인데 손님 촬영각은 실측값(예: 51°/−40°)이다.
      각도가 10° 넘게 다르면 폭 프로파일은 원래 달라진다. 그래서 아래 리포트가
      <b>그 뷰의 실측 yaw를 같이 찍는다</b> — 안 맞으면 숫자부터 의심할 것.
   ③ 우리 쪽 측정은 그리는 것과 <b>같은 컬링</b>(평균 depth<0 버림)을 쓴다.
      렌더는 여기에 솎기·굵기가 더 붙지만 그건 실루엣 <b>윤곽</b>을 안 바꾼다.
══════════════════════════════════════════════════════════════════ */
/* 빌드 도장 (2026-08-11) — <b>어느 파일이 돌고 있는지</b>를 화면에서 바로 안다.
   실기기 로그를 받아 분석했는데 알고 보니 이전 빌드였던 일이 있었다(두피이식 줄이
   옛 형식이라 뒤늦게 알아챘다). 파일을 주고받으며 고치는 구조에서는 캐시·배포 지연이
   상시 위험이라, 새 파일을 낼 때마다 이 숫자를 올린다. 콘솔 맨 위에 한 번 찍힌다. */
const BUILD = { n: 53, tag: '<b>\uce21\uba74\uc5d0\uc11c \ubc18\ub300\ucabd \uc0ac\uc774\ub4dc\uac00 \uc5bc\uad74\uc744 \uc548 \ub36e\ub294\ub2e4</b> \u2014 2D \ud22c\uc601\uc5d0 <b>\uae4a\uc774 \ubc84\ud37c</b>\ub97c \ub123\uc5c8\ub2e4(\uae30\ud558\ub294 \uba40\uc9f1\ud588\uace0 3D\ub294 \uba40\uc858\ud588\ub2e4 \u2014 3D\uc5d4 \uae4a\uc774 \ubc84\ud37c\uac00 \uc788\uace0 2D \ud22c\uc601\uc5d4 \uc5c6\uc5c8\ub2e4 \u00b7 viewPointVisible \uccab \uc904\uc774 depth>=0\uc774\uba74 \ubb34\uc870\uac74 \ubcf4\uc784\uc774\uc5c8\ub294\ub370 \uae30\uc900\uba74\uc774 <b>\ub450\uc0c1 \uc911\uc2ec</b>\uc774\ub77c, \uba3c \ucabd \uc606\uba38\ub9ac\uac00 \uba3c\uc800 \ubed0\uc744 \ud0c0\uace0 \uc55e\uc73c\ub85c \ud758\ub7ec lz\uac00 0\uc744 \ub118\uae30\uba74 \ub450\uac1c\uace8\ubcf4\ub2e4 \ub4a4\uc778\ub370\ub3c4 \ud1b5\uacfc\ud588\ub2e4 \u00b7 occ.covers\ub294 lz\ub97c \uc18c\uac70\ud55c \uadf8\ub9bc\uc790\ub77c \uae4a\uc774\ub97c \ubaa8\ub978\ub2e4) \u00b7 occ.frontZ\uac00 \uadf8 2\ucc28\ud615\uc2dd\uc744 \uc18c\uac70 \ub300\uc2e0 lz\uc5d0 \ub300\ud574 \ud480\uc5b4 \ub450\uac1c\uace8 \uc55e\uba74 \uae4a\uc774\ub97c <b>\ub2eb\ud78c \ud574</b>\ub85c \uc900\ub2e4(\uc0c8 \ubaa8\ub378\ub3c4 \uc0c8 \uc0c1\uc218\ub3c4 \uc5c6\uc74c \u00b7 8/18 j\uac00 \"\ub2f5\uc740 \ubdf0\ubcc4 \ubd84\uae30\uac00 \uc544\ub2c8\ub77c \uae4a\uc774 \ubc84\ud37c\"\ub77c\uace0 \uc801\uc5b4 \ub454 \uadf8 \uc790\ub9ac) \u00b7 \ud558\ub124\uc2a4: \ud45c\uba74 \uc624\ucc28 2e-16 \u00b7 \uadf8\ub9bc\uc790\u00b7\ud310\ubcc4\uc2dd \ubd80\ud638 \ubd88\uc77c\uce58 0/2304 \u00b7 yaw 0\u00b745\u00b790\u00b0) / \uc774\uc804: <b>\uc624\ubc84\ub514\ub809\uc158 \uc774\uc911\ubc30\uc120\uc744 \ub04a\uc5c8\ub2e4</b>(\uac12 \uc804\ud30c \uc81c\uac70 + \uae30\ud558 \ube14\ub80c\ub4dc\ub97c \ube44\uc728\uacf5\uac04\uc73c\ub85c \u00b7 \uac00\ub3d9\ud3ed 0.375\u21920.925) <b>\ub9c8\ub124\ud0b9 \uc55e\uba38\ub9ac\ub97c \ub0b4\ub824 \uc2ec\ub294\ub2e4</b>(이마 위에 뜬 "거꾸로 된 앞머리"는 심긴 게 아니라 <b>뿌리 없는 꼬리 토막</b>이었다 — 이 손님은 앞머리가 없어 이마 점유가 0이고, 문턱 셋(재클립 growAboveY \u00b7 faceVeto \u00b7 클립마스크 얼굴타원)이 가닥을 이마에서 잘라 옆머리 높이 조각만 남겼다) \u00b7 심을 게 없으면 front 60% \u00b7 crown 15%를 <b>광대까지</b> 내린다(끝높이 = 눈~턱의 35% \u00b7 이미 앞머리가 있으면 점유 프로브가 재서 안 심는다) \u00b7 문턱 셋은 <b>fringe 표시된 가닥에만</b> 열린다 / <b>도장 정정</b>: 48 태그가 "커트 고침(5차)은 꺼 둠"이라 적혀 있었으나 코드는 이미 tipUnreachableCut=true였다 — 라벨이 파일을 안 따라온 자리 / 이전: <b>조정기를 3D 한 벌로</b>(2D 조정엔진 차단 · 중립 입력으로 항등) + <b>겹 정렬을 뿌리 깊이로</b>(길이만 줄여도 25%가 앞뒤 뒤바뀌던 것 → 0%) · 커트 고침(5차)은 <b>꺼 둠</b> / 이전: 뒷머리가 드디어 줄어든다 — 시술각 0°의 기준 높이에 뿌리가 이미 아래일 때 arcAtY의 "못 만남"을 전체길이가 아니라 최소로 읽는다(후두부·네이프가 슬라이더를 내려도 안 줄던 원인 · 시술각 32°에서 목표 11% vs 실제 75% · 하네스 9/9) / 이전: [화면대조]를 미니3D와 짝지었다 — 같은 프레임의 2D 캔버스 vs 미니3D + <b>투영 늘어남 배율</b>(두상폭으로 정규화 · 1.15 넘으면 세로가 늘어난 것)(고침 없음 · 측정만) / 이전: 진단정보 맨 위에 [화면대조](고침 없음 · 측정만) / 이전: <b>스포츠머리가 된다</b>(페이드 섹션 차단 제거 — 크라운·프론트도 클리퍼 구역 · 프리셋 불변) + <b>커팅라인을 3D로</b>(cutRatioForStrand ③-b · 스퀘어/라운드/테이퍼 · line=50 비트 동일) / 이전: <b>두 스타일을 손으로 만들 수 있다</b>(디스커넥션 슬라이더 신설 · 페이드를 커트 그룹 안으로 · 섹션·스타일링별 <b>스펙 수치표</b>와 "이 값으로 맞추기" · 길이는 이 손님에 대해 역산해서 표시 · 스펙 색 2종을 팔레트에) / 이전: 결과화면에서 <b>손님 옷깃이 안 딸려온다</b>(사진은 턱까지만 오리고 목은 3D 메쉬가 그린다 — 그리는 순서도 뒤집힘 · 이음매가 옷깃 밑에서 턱선으로 옮겨간 것이 맞바꾼 값) / 이전: 결과화면 <b>옷깃이 안 잘린다</b>(6차가 의상만 옮기고 2D 오리는 선을 안 옮겨 어깨 윗부분이 날아갔다 — 목 밑동 소비처 열 곳을 단일 출처로) / 이전: <b>목이 8cm로 고정</b>(밑동을 의상 좌표 −1.15가 아니라 턱에서 잰다 — 둥근 얼굴에서 13.6cm까지 늘어났다 · 의상·클리핑·몸통도 같이 이동) + <b>얼굴이 두개골 밖으로 안 나간다</b>(얼굴만 혼자 넓히고 두상은 경고만 하던 것 — applyMinAlways) / 이전: 슬라이더가 <b>칸마다 같은 만큼</b> 먹는다 — 단 컬·웨이브폭은 <b>손대지 않는다</b>(감은 횟수 = 길이÷π지름 · 굴곡 = 로드 반경이라 눈금을 비틀 자유가 없다 — 4차에 비틀었던 것을 원복) — 컬·웨이브폭은 <b>감은 횟수와 굴곡 크기 둘 다</b>를 보고 균형점으로(rodK −0.20 · ampGamma 0.86 · 한쪽만 맞추면 반대쪽이 망가진다)(넘김·정돈·가르마세기 감마 + 컬 세기 + 웨이브폭 눈금을 감긴 횟수 기준으로 — 선형 이탈 최대 31.4%p→<b>1.4~7.3%p</b>) + 가르마 <b>위치</b> 비단조 해소(MAXOFF .90→.65 · 끝에서 세기 17%→<b>51%</b> 유지) + 프리셋·기본값 <b>환산</b>(그림 불변 0.04~0.47%) / 이전: 가르마 선이 <b>정말로 일자</b>가 된다(분할면을 기울이는 대신 <b>옆으로 민다</b> — 대원은 늘 정수리로 모였다 · 가로 흔들림 0.0864→<b>0.0053</b> · part=0은 비트 동일 6.9e-17) + 가르마가 <b>정수리를 안 넘는다</b>(part 60이면 고도 75°에서 끝) + 빗질을 화면에서 완전히 뺐다(터치 경로·버튼 — 엔진은 그대로) / 이전: 가르마 <b>폭</b>이 고르다(방위각 게이트 → 분할면까지의 거리 · 물러난 폭 표준편차 7.20°→<b>0.93°</b>) + 되돌림이 <b>법선 가닥</b>에도 먹는다(빼기 → 접선쪽 회전 · 정수리 sleek 무반응 해소) + 눕힘 꺾임이 빗질 연산자에서도 <b>누적·정착</b>(bendStrandToDir3D carry — 빗질 구배는 일부러 보존) / 이전: 눌러붙음이 실제로 먹는다(sleek 꺾임 <b>누적·정착</b> + 두피 바닥) + 넘김이 가르마를 <b>덮어쓰던 것</b> 고침(PART_SWEEP_MIX) + 폼파두르 스펙 정정(volume 82→70 · partAmt 75→90 · sleek 80→100) + 빗질 버튼을 캔버스에서 스타일링 패널로 이동 / 이전: 진단패널에 [스타일스펙]·[뷰 포즈] — 폰에 콘솔이 없다 + 가드 mm/cm 딱지 버그(단일출처 guardMm) + 모드바 줄바꿈 / 이전: 가르마 위치만 4뷰 잠금(PART_VIEW_LOCK) + 빗질(COMB) 주차 해제 — 조정화면 버튼 + 사이드파트로 스펙 정정(partAmt 92→55) / 이전: 빗질한 머리가 두상에 붙는다(SCALP_HUG) + 남성 컷 스펙(테이퍼 페이드 폼파두르) + 페이드(클리퍼) 연산자 — 첫 절대길이 시술 + 해상도 800 단일출처(사진·분석·렌더) + 보관 메모리 정리(reasonC 지연·파생 반납·fullMaskC 제거·캐시 3벌) + 중복 통합 5종(깊이역산·색파싱·dirAt·포즈폴백·미니뷰정리) + 죽은 코드 정리(도달성 회계) + 조정캐시 <b>2단 분리</b>(기하/필터) — Density·Color 슬라이더가 기하를 안 다시 돎 + 전수회계(memCensus) + 모바일 낭비 6종' };
console.log('%c[GYEOL 빌드 ' + BUILD.n + '] ' + BUILD.tag,
            'background:#7A6149;color:#fff;padding:2px 8px;border-radius:3px');
const SILHOUETTE = {
  bands: 11,     // 폭 프로파일 단수(위→아래)
  cols: 13,      // 밑단 라인 칸수(좌→우)
  stride: 3,     // 측정용 솎기 — 윤곽은 표본으로도 같다(렌더 1패스와 같은 논리)
  /* ── 커트 지표용 (2026-08-18 j) ─────────────────────────────────────
     아래 셋은 <b>커트 손잡이</b>를 겨냥한 지표다(위 셋은 덩어리 모양만 본다).
     roughCols는 13칸으로는 요철이 안 보여서(칸 간격이 요철보다 넓다) 33칸.
     zoneCenter/zoneTop은 비침을 재는 구역 — 실루엣 자신으로만 정의한다
     (얼굴 검출에 안 기댄다. 그래야 사진과 우리 렌더가 <b>같은 구역</b>을 잰다). */
  roughCols: 33,      // 밑단 요철 스캔 칸수
  roughSmooth: 5,     // 이동평균 창 = "전체 모양". 이걸 뺀 나머지가 요철
  zoneCenter: 0.40,   // 비침 구역의 가로 폭(실루엣 폭 대비, 가운데 기준)
  zoneTop: 0.50,      // 비침 구역의 위끝(뱅 끝 높이 대비)
  zoneGap: 0.015,     // 이보다 좁은 틈은 한 덩어리로 본다(구역 폭 대비)
  tipBins: 24,        // 끝높이 히스토그램 칸수(레이어 단 찾기)
};
/* 레퍼런스 4뷰 실측 — 2026-08-18 j <b>다시 쟀다</b>. 마스크가 살로 새고 있었다.
   ─────────────────────────────────────────────────────────────────
   8/11 표를 만든 규칙(V<170 · R−B>12 · R≥G−2 → 3px 열림 → 1% 조각 제거 →
   9px 닫힘)을 그대로 다시 돌려 보니, <b>후면만</b> 재현됐다(폭 평균차 0.004).
   얼굴 3뷰는 턱·목 그늘과 눈썹·눈을 머리카락으로 세서 실루엣이 <b>목걸이까지</b>
   내려가 있었다. 그래서 8/11 표의 front·left·right는 "이 머리는 쇄골까지 온다"고
   말하고 있었다 — 정면 가운데 밑단 0.75~0.88(실제 뱅 끝은 0.52~0.55).
   ⚠ 그 표에 이미 "우측 중간 3단은 얼굴이 끊어서 낮게 나온 값"이라는 단서가
     달려 있었다. 원인을 <b>그 뷰 하나의 예외</b>로 적었지만 실은 규칙 자체였다.

   ── 색으로는 못 가른다. 가르는 것은 <b>결</b>이다 ──────────────────────
   갈색 머리와 따뜻한 살은 색이 겹친다(정규화 R−G로 갈라 보려 했으나 얼굴이
   통째로 머리로 잡혔다 — 실제로 해 봤다). 겹치지 않는 것은 국소 결이다:
     머리카락 국소표준편차 p5 4.05 · 중앙값 8.45   살 중앙값 1.91 · p95 6.18
   이 판단은 이 파일이 이미 갖고 있다(hasHairTexture · STRUCTURE TENSOR 구역).
   새 규칙: V<175 · R−B>12 · R≥G−2 · <b>국소표준편차>4.0</b> · <b>채도>0.24</b>
            → 3px 열림 → 1% 조각 제거 → 9px 닫힘
   채도 하한이 목 그늘을 뗀다(살 p90 0.06 · 머리 p5 0.27).
   그리고 바운딩박스의 위·아래는 <b>폭이 있는</b>(최대폭의 5% 이상) 마지막 줄로
   잡는다 — 목걸이를 타고 남은 1~2px 실오라기가 높이를 10% 늘리고 있었다.
   네 뷰 오버레이를 눈으로 확인했다. */
const SILHOUETTE_REF = {
  layered_bob_hush: {
    front: { wh:0.82, wp:[0.07,0.59,0.74,0.84,0.94,0.99,0.96,0.92,0.91,0.73,0.05],
             bot:[0.66,0.93,0.96,0.97,1.00,0.55,0.53,0.52,0.54,0.95,0.89,0.82,0.54] },
    left:  { wh:0.86, wp:[0.06,0.60,0.79,0.89,0.96,0.97,0.96,0.95,0.43,0.30,0.05],
             bot:[0.45,0.77,0.55,0.46,0.51,0.52,0.53,0.84,0.81,1.00,0.97,0.95,0.87] },
    right: { wh:0.83, wp:[0.05,0.62,0.82,0.91,0.98,0.93,0.41,0.42,0.49,0.67,0.45],
             bot:[0.88,0.92,0.97,1.00,0.97,0.79,0.84,0.90,0.99,0.42,0.48,0.54,0.41] },
    back:  { wh:0.76, wp:[0.08,0.60,0.76,0.87,0.96,0.98,0.99,0.95,0.89,0.74,0.06],
             bot:[0.75,0.82,0.90,1.00,0.96,0.95,0.94,0.99,0.98,0.99,0.93,0.92,0.64] },
  },
};
/* ══════════════════════════════════════════════════════════════════
   커트 지표 레퍼런스 — <b>커트 손잡이가 겨냥할 숫자</b> (2026-08-18 j)
   ─────────────────────────────────────────────────────────────────
   사용자: "이게 전문앱이란 말야. 이걸로 조정할 수 없는 머리는 없어야 돼."

   그러려면 스타일을 <b>근거 있게 적을 수</b> 있어야 한다. 그런데 STYLE_SPECS에서
   실측인 것은 tipAt(끝 높이)과 색뿐이었다. elevation·texture·density·technique은
   전부 "레퍼런스 대조 후 조정"이라고 주석에 적힌 <b>눈대중</b>이다. 그래서 새
   스타일을 추가할 때 그 넷은 적을 근거가 없었다.
   여기서 그 넷에 각자 <b>잴 것</b>을 붙인다. 위 실루엣 지표와 같은 자격(배율 무관,
   사진과 우리 결과를 같은 식으로 잰다)을 갖도록 정의는 실루엣 자신으로만 세운다.

     botRough  밑단 요철  → texture(텍스처라이징)
       33칸 밑단선에서 이동평균 5칸(=전체 모양)을 뺀 고주파의 평균 절대값.
       포인트 커트로 끝을 털수록 커진다. 후면 0.014(가장 매끈) ↔ 정면 0.047.

     seeFill/seeRuns  비침  → density(숱치기)
       가운데 40% 컬럼 × [뱅 끝 높이의 50%~100%] 구역의 가로 스캔라인에서
       "머리카락이 차지하는 비율"과 "덩어리 몇 개가 지나가는가".
       ⚠ 채움은 <b>9px 닫기 전</b> 마스크로 잰다 — 닫기가 시스루의 틈을 정확히
         메운다. 이걸 모르고 닫은 마스크로 재면 앞머리가 100% 꽉 찬 것으로 나온다
         (실제로 처음에 그렇게 나왔다).
       정면 0.843 · 후면 0.964 — 뱅이 있는 정면만 비치고 뒤통수는 꽉 찼다.
       이 대비가 이 지표가 <b>맞는 것을 재고 있다는</b> 증거다.

     layerY  가장 뚜렷한 가로 단절의 높이 → elevation(시술각)
       실루엣 안쪽에서 세로 결을 뺀 가로 방향 밝기 단절의 봉우리 위치.
       ⚠ <b>정직한 한계</b>: 우리 쪽 짝은 원리가 다르다(가닥 끝점 y 히스토그램).
         위치는 비교되지만 세기는 비교 대상이 아니다. 그리고 후면 0.812는
         내부 레이어가 아니라 <b>밑단 윤곽</b>을 잡은 것으로 보인다 — 후면은
         이 지표를 안 믿는 게 맞다.
   ══════════════════════════════════════════════════════════════════ */
const CUT_REF = {
  layered_bob_hush: {
    front: { botRough:0.047, seeFill:0.843, seeRuns:3.0, layerY:0.52 },
    left:  { botRough:0.043, seeFill:0.550, seeRuns:4.0, layerY:0.60 },
    right: { botRough:0.035, seeFill:0.757, seeRuns:3.0, layerY:0.65 },
    back:  { botRough:0.014, seeFill:0.964, seeRuns:2.0, layerY:null },
  },
};
/* ══════════════════════════════════════════════════════════════════
   좌표 왕복 진단 — 2D→3D→2D가 <b>제자리로 오는가</b> (2026-08-11)
   ─────────────────────────────────────────────────────────────────
   사용자: "2D에서 3D 갔다가 재투영하는 과정에서 입체로 변하면서 돌아가는 거 같은데?"

   그럴 만한 구조다. 두 방향이 <b>서로 다른 변환</b>을 쓴다:
     2D→3D 리프트  projectImagePointToHead → makeFaceProjector(랜드마크 아핀)
     3D→2D 재투영  project3DPointToView   → cal(뷰캘리 귀 앵커 + 세로자)
   둘은 각자 만들어졌고 서로를 참조하지 않는다. 뷰캘리가 측면 가로자를
   ×1.48~1.51로 바꿔도 makeFaceProjector는 모른다. 그러면 왕복이 안 닫힌다.

   방증도 이미 있었다 — [뿌리선 어긋남] front 30px/304(10%) · back 74px/284(26%),
   그리고 측면 [비교] IoU 0.44~0.51(정면은 0.96).

   재는 법: 사진 위 격자점을 3D로 올렸다가 <b>같은 뷰로</b> 되쏘고, 원래 픽셀과의
   차이를 본다. 커트도 마네킹도 안 낀 <b>순수 좌표 왕복</b>이라 여기서 어긋나면
   그 위의 모든 것이 어긋난다.

   ★ 그리고 오차를 그냥 평균내지 않고 <b>평행이동·배율·회전으로 분해</b>한다.
     "몇 px 틀렸다"는 고칠 데를 안 알려주지만, 분해하면 바로 지목된다:
       · 평행이동만 크다 → 두 경로의 <b>기준점</b>이 다르다(중심 cx / crownY / CY)
       · 배율만 1에서 뜬다 → <b>자</b>가 다르다(가로자·세로자)
       · 회전이 크다 → <b>포즈</b>가 다르다(yaw·pitch·roll)
       · 셋 다 작은데 잔차만 크다 → 선형으로 설명 안 되는 것 = 두상 <b>모양</b>이 다르다
         (리프트가 쓰는 타원체와 재투영이 가정하는 면이 다름 — 모발 두께가 여기 낀다)
     분해는 2D 닮음변환 최소제곱(Umeyama)이다.

   ※ 모발 두께 한계 — 사진의 한 점은 두피면이 아니라 <b>헤어 바깥면</b>일 수도 있어서
     깊이(z)에는 원리적 모호함이 있다. 하지만 이 검사는 <b>같은 면</b>으로 갔다가
     돌아오므로 그 모호함이 상쇄된다. 즉 여기 남는 오차는 두께 탓이 아니다.
══════════════════════════════════════════════════════════════════ */
function _fitSimilarity2D(P, Q){
  /* Q ≈ s·R·P + t 를 최소제곱으로. 반환 {s, deg, tx, ty, rms} */
  const n = P.length; if(n < 3) return null;
  let mpx=0,mpy=0,mqx=0,mqy=0;
  for(let i=0;i<n;i++){ mpx+=P[i][0]; mpy+=P[i][1]; mqx+=Q[i][0]; mqy+=Q[i][1]; }
  mpx/=n; mpy/=n; mqx/=n; mqy/=n;
  let sxx=0, a=0, b=0;
  for(let i=0;i<n;i++){
    const px=P[i][0]-mpx, py=P[i][1]-mpy, qx=Q[i][0]-mqx, qy=Q[i][1]-mqy;
    sxx += px*px + py*py;
    a   += px*qx + py*qy;      // cos 성분
    b   += px*qy - py*qx;      // sin 성분
  }
  if(sxx < 1e-9) return null;
  const s = Math.hypot(a, b) / sxx, th = Math.atan2(b, a);
  const cs = Math.cos(th)*s, sn = Math.sin(th)*s;
  const tx = mqx - (cs*mpx - sn*mpy), ty = mqy - (sn*mpx + cs*mpy);
  let e2 = 0;
  for(let i=0;i<n;i++){
    const ex = (cs*P[i][0] - sn*P[i][1] + tx) - Q[i][0];
    const ey = (sn*P[i][0] + cs*P[i][1] + ty) - Q[i][1];
    e2 += ex*ex + ey*ey;
  }
  return { s, deg: th*180/Math.PI, tx, ty, rms: Math.sqrt(e2/n) };
}
function diagRoundTrip(step){
  const m = state.hair3Dneutral;
  if(!m || !m.viewCal){ console.warn('[좌표왕복] 뷰 보정이 없다'); return null; }
  let fm; try{ fm = getFaceMetrics(); }catch(e){ return null; }
  const VL = { front:'정면', left:'좌측', right:'우측', back:'후면' };
  const N = Math.max(6, step || 14);
  const out = {};
  for(const angle of ANGLES){
    const cal = m.viewCal[angle], mi = state.hairMasks && state.hairMasks[angle];
    if(!cal || !mi) continue;
    const P = [], Q = [], dl = [];
    for(let iy=1; iy<N; iy++) for(let ix=1; ix<N; ix++){
      const nx = ix/N, ny = iy/N;
      let w = null;
      try{ w = projectImagePointToHead(angle, nx, ny, fm.widthFactor, fm.heightFactor); }catch(e){}
      if(!w) continue;                                  // 두상 밖 — 왕복 정의가 없다
      const pr = project3DPointToView(w, cal, m.yTop, m.CY);
      if(!isFinite(pr.ix) || !isFinite(pr.iy)) continue;
      const px = nx*mi.w, py = ny*mi.h;
      P.push([px, py]); Q.push([pr.ix, pr.iy]);
      dl.push(Math.hypot(pr.ix-px, pr.iy-py));
    }
    if(P.length < 8){ console.log('[좌표왕복·' + (VL[angle]||angle) + '] 표본 부족(' + P.length + ')'); continue; }
    dl.sort((x,y)=>x-y);
    const med = dl[(dl.length*0.5)|0], p90 = dl[(dl.length*0.9)|0];
    const f = _fitSimilarity2D(P, Q);
    out[angle] = { n:P.length, med, p90, fit:f };
    const diag = mi.w && mi.h ? Math.hypot(mi.w, mi.h) : 0;
    console.log('[좌표왕복·' + (VL[angle]||angle) + '] 표본 ' + P.length
      + ' · 어긋남 중앙값 ' + med.toFixed(1) + 'px' + (diag ? '(' + (100*med/diag).toFixed(1) + '%)' : '')
      + ' · 90% ' + p90.toFixed(1) + 'px'
      + (f ? '\n   분해 — 평행이동 (' + f.tx.toFixed(1) + ', ' + f.ty.toFixed(1) + ')px'
             + ' · 배율 ' + f.s.toFixed(3) + ' · 회전 ' + f.deg.toFixed(2) + '°'
             + ' · 남은 잔차 ' + f.rms.toFixed(1) + 'px' : ''));
  }
  console.log('[좌표왕복] 읽는 법 — 배율 1.000·회전 0°·평행이동 0이면 왕복이 닫힌 것입니다.'
    + '\n   평행이동만 크다 → 두 경로의 <b>기준점</b>이 다름(cx·crownY·CY)'
    + '\n   배율이 1에서 뜬다 → <b>자</b>가 다름(makeFaceProjector vs 뷰캘리 cal)'
    + '\n   회전이 크다 → <b>포즈</b>가 다름(yaw·pitch·roll)'
    + '\n   셋 다 작은데 잔차만 크다 → 두상 <b>모양</b>이 다름(리프트 타원체 ≠ 재투영 가정면)');
  return out;
}

/* ══════════════════════════════════════════════════════════════════
   정수리 커버리지 — "뒷머리 위쪽이 텅 비었다"를 <b>가르는</b> 진단 (2026-08-11)
   ─────────────────────────────────────────────────────────────────
   비어 보이는 원인이 셋인데 고칠 데가 전부 다르다:
     ① 뿌리가 애초에 안 심겼다        → 마네킹/뿌리밀도 쪽
     ② 심겼는데 조정·클립에서 잘렸다  → HAIR_OCC3D / 얼굴침범 쪽
     ③ 그 뷰에서 안 보이게 컬링됐다   → 포즈·depth 쪽
   지금 로그로는 셋이 구분이 안 된다(밀도0 셀도 늘고, 후면 클립도 91%다).
   그래서 <b>같은 밴드</b>에서 세 수를 나란히 센다 — 어디서 줄었는지가 한 줄로 나온다.

   밴드 경계는 지어내지 않고 SCALP_ZONES.phiRange에서 파생한다(파일 상단 원칙 (1),
   HEAD_PHI_BANDS가 쓰는 방식과 동일). phi=0이 정수리, 커질수록 아래다. */
function crownBandEdges(){
  const s = new Set([0]);
  for(const z of Object.values(SCALP_ZONES)) for(const v of z.phiRange) s.add(+v.toFixed(2));
  s.add(Math.PI);
  return Array.from(s).sort((a,b)=>a-b);
}
function diagCrownCoverage(stride){
  const m = state.hair3Dneutral;
  if(!m || !m.strands || !m.strands.length){ console.warn('[정수리 커버리지] 모델이 없다'); return null; }
  let S; try{ S = getScalpEllipsoid(); }catch(e){ return null; }
  const CY = m.CY, E = crownBandEdges(), NB = E.length - 1;
  /* 뿌리의 두상 극각. 뿌리는 두피면 위에 있으므로 (y−CY)/S.b = cos(phi).
     모든 연산자가 뿌리를 고정하므로 조정 후에도 같은 밴드에 남는다 —
     그래서 심긴 것과 살아남은 것을 <b>같은 자로</b> 셀 수 있다. */
  const bandOf = (p)=>{
    const c = Math.max(-1, Math.min(1, (p.y - CY) / Math.max(1e-6, S.b)));
    const phi = Math.acos(c);
    let k = 0; while(k < NB-1 && phi >= E[k+1]) k++;
    return k;
  };
  const planted = new Array(NB).fill(0);
  for(const st of m.strands) planted[bandOf(st.pts[0])]++;
  const adj = computeAdjustedHair3DStrands(null, 1);   // 솎기 없이 — 비율을 봐야 하므로
  const kept = new Array(NB).fill(0);
  if(adj) for(const st of adj) kept[bandOf(st.pts[0])]++;
  // 뷰별로 보이는 수 — 렌더와 <b>같은</b> 컬링(가림 판정 포함). 표본으로 충분하다.
  const stp = Math.max(1, stride || 3);
  const vis = {}, visN = {};
  for(const a of ANGLES){
    const cal = m.viewCal && m.viewCal[a]; if(!cal || !adj) continue;
    const occ = makeViewOccluder(cal);
    const mi = state.hairMasks && state.hairMasks[a];   // 사진 한 표(8/18 j) — 렌더와 같은 판정
    const v = new Array(NB).fill(0), n = new Array(NB).fill(0);
    for(let i=0;i<adj.length;i+=stp){
      const st = adj[i], b = bandOf(st.pts[0]);
      n[b]++;
      let d = 0, dm = -Infinity, vs = 0;
      for(const q of st.pts){ const pr = project3DPointToView(q, cal, m.yTop, m.CY);
                              d += pr.depth; if(pr.depth > dm) dm = pr.depth;
                              if(viewPointVisible(pr, occ, mi)) vs++; }
      if(strandFacesCamera(d, st.pts.length, dm, vs)) v[b]++;   // 렌더와 같은 판정
    }
    vis[a] = v; visN[a] = n;
  }
  const VL = { front:'정면', left:'좌', right:'우', back:'후' };
  const pct = (a,b)=> b > 0 ? Math.round(100*a/b) + '%' : '—';
  const lines = [];
  for(let k=0;k<NB;k++){
    if(!planted[k] && !kept[k]) continue;
    lines.push('phi ' + E[k].toFixed(2) + '~' + E[k+1].toFixed(2)
      + ' · 심김 ' + String(planted[k]).padStart(5)
      + ' → 조정·클립 통과 ' + String(kept[k]).padStart(5) + '(' + pct(kept[k], planted[k]) + ')'
      + ' | 보임 ' + ANGLES.filter(a=>vis[a]).map(a=> (VL[a]||a) + ' ' + pct(vis[a][k], visN[a][k])).join(' '));
  }
  console.log('[정수리 커버리지] phi 0=정수리 → 아래로 (밴드는 SCALP_ZONES에서 파생)\n  ' + lines.join('\n  ')
    + '\n  읽는 법 — 심김이 0에 가까우면 <b>뿌리</b> 문제(마네킹·뿌리밀도),'
    + ' 심김은 많은데 통과가 낮으면 <b>클립</b> 문제(HAIR_OCC3D·얼굴침범),'
    + ' 둘 다 멀쩡한데 "보임"만 낮으면 <b>포즈/컬링</b> 문제입니다.');
  return { edges: E, planted, kept, vis };
}

/* ══════════════════════════════════════════════════════════════════
   조정 연산자 자가점검 — <b>슬라이더가 정말 먹는지</b> (2026-08-11)
   ─────────────────────────────────────────────────────────────────
   왜 만들었나: combStrand3D가 두 번 선언돼 있어서 <b>넘김·가르마가 통째로
   무반응</b>이었는데, 에러가 안 나서 아무도 몰랐다(교훈 B의 재발). 이런 버그는
   "슬라이더를 올려도 그림이 안 변한다"로만 드러나고, 그건 눈으로는 "효과가
   약한가 보다"와 구분이 안 된다.

   그래서 <b>재게</b> 한다: 두피에서 난 곧은 시험 가닥에 연산자를 하나씩 세게
   걸어 보고 최대 이동량을 찍는다. 0이면 그 연산자는 죽어 있다. 두상은 실측
   타원체를 그대로 쓰므로 이 손님 기준으로 판정된다.
   콘솔에서 selfTestAdjustOps()로 언제든 부를 수 있다. */
function selfTestAdjustOps(){
  let S, E;
  try{ S = getScalpEllipsoid(); E = getHeadEllipsoid(); }catch(e){ console.warn('[자가점검] 두상 실측이 아직 없다'); return null; }
  const CY = (state.hair3Dneutral && state.hair3Dneutral.CY) != null ? state.hair3Dneutral.CY : 0.15;
  // 시험 뿌리 — 두피 위 다섯 자리(연산자마다 먹는 자리가 다르다)
  const ROOTS = [
    ['정수리', 0.10*Math.PI,  0.0],
    ['앞머리', 0.42*Math.PI,  0.0],
    ['옆머리', 0.55*Math.PI,  Math.PI/2],
    ['뒤통수', 0.50*Math.PI,  Math.PI],
    ['네이프', 0.80*Math.PI,  Math.PI],
  ];
  const OPS = [
    ['길이 0.6',  p=> lengthStrand3D(p, 0.6)],
    ['컬 80',     p=> curlStrand3D(p, 80, 0.7)],
    ['중력 80',   p=> gravityDroop3D(p, 80)],
    ['가르마 80', p=> partStrand3D(p, 80, 0, 100)],
    /* (2026-08-30) 가르마 인자가 늘었다. <b>가르마 없이</b>(partAmt 0) 부르는
       것이 이 점검의 뜻에 맞다 — 넘김 하나만 살아 있는지 보는 자리이고,
       그 호출이 곧 PART_SWEEP_MIX가 예전 동작으로 떨어지는 경로이기도 하다. */
    ['넘김 80',   p=> sweepStrand3D(p, 80, 0, 0, 0)],
    ['볼륨 100',  p=> volumeStrand3D(p, 100)],
    ['결흐름 80', p=> flowCurlStrand3D(p, 80)],
  ];
  const rows = [], dead = [];
  for(const [name, fn] of OPS){
    const per = [];
    for(const [rn, phi, th] of ROOTS){
      const r = { x:S.a*Math.sin(phi)*Math.sin(th), y:CY + S.b*Math.cos(phi), z:S.c*Math.sin(phi)*Math.cos(th) };
      const pts = []; for(let i=0;i<20;i++) pts.push({ x:r.x, y:r.y - i*(2*E.b)/19*0.9, z:r.z });
      let d = 0;
      try{
        const q = fn(pts);
        /* 두 가지를 <b>둘 다</b> 본다. 같은 인덱스끼리의 이동량만 재면 <b>길이</b>가
           빠진다 — 트림은 점을 잘라낼 뿐 남은 점은 제자리라 0에 가깝게 나온다.
           그래서 끝점끼리의 거리도 같이 재서 큰 쪽을 쓴다. */
        const n = Math.min(q.length, pts.length);
        for(let i=0;i<n;i++) d = Math.max(d, Math.hypot(q[i].x-pts[i].x, q[i].y-pts[i].y, q[i].z-pts[i].z));
        const a = q[q.length-1], b = pts[pts.length-1];
        d = Math.max(d, Math.hypot(a.x-b.x, a.y-b.y, a.z-b.z));
      }catch(e){ d = NaN; }
      per.push(d);
    }
    rows.push(name.padEnd(9) + per.map((v,i)=> ROOTS[i][0] + ' ' + (isNaN(v)?'예외':(v/(2*E.b)*100).toFixed(1)+'%')).join(' · '));
    if(per.every(v=> !(v > 1e-6))) dead.push(name);
  }
  console.log('[연산자 자가점검] 최대 이동량(두상 높이 대비)\n  ' + rows.join('\n  '));
  if(dead.length) console.warn('[연산자 자가점검·무반응] ' + dead.join(' · ')
    + '\n    이 연산자는 어느 자리에서도 가닥을 안 움직입니다 = 슬라이더가 죽어 있습니다.'
    + '\n    먼저 볼 것: 같은 이름의 함수가 파일에 두 번 선언돼 있지 않은지(나중 선언이 이깁니다).');
  else console.log('[연산자 자가점검] 무반응 없음 — 일곱 연산자 모두 가닥을 움직입니다.');
  return { rows, dead };
}

/* 폴리라인을 <b>스캔라인</b>으로 자른다 — 사진에서 "이 행의 가장 왼쪽/오른쪽
   모발 화소"를 읽던 것과 같은 값을 내려면 점을 밴드에 주워 담으면 안 된다
   (밴드가 두꺼워져 폭이 부풀고, 사진 지표와 비교가 성립하지 않는다).
   구간이 그 선을 <b>가로지를 때</b> 교점을 보간해서 쓴다. */
function _scanCross(a, b, key, at){
  const va = a[key], vb = b[key];
  if((va - at) * (vb - at) > 0) return null;      // 같은 쪽 = 안 가로지름
  if(Math.abs(vb - va) < 1e-9) return null;
  return (at - va) / (vb - va);
}
function measureSilhouette(angle, stride){
  const model = state.hair3Dneutral;
  if(!model || !model.viewCal || !model.viewCal[angle]) return null;
  const cal = model.viewCal[angle];
  const adj = computeAdjustedHair3DStrands(null, Math.max(1, stride || SILHOUETTE.stride));
  if(!adj || !adj.length) return null;
  // ① 투영 + 렌더와 같은 컬링
  const polys = [];
  const occ = makeViewOccluder(cal);   // 렌더와 <b>같은</b> 가림 판정을 써야 실루엣이 같다
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for(const st of adj){
    const pts = st.pts, q = [];
    let dsum = 0, dmax = -Infinity, vis = 0;
    for(let i=0;i<pts.length;i++){
      const pr = project3DPointToView(pts[i], cal, model.yTop, model.CY);
      q.push({ ix:pr.ix, iy:pr.iy }); dsum += pr.depth;
      if(pr.depth > dmax) dmax = pr.depth;
      if(viewPointVisible(pr, occ, state.hairMasks && state.hairMasks[angle])) vis++;
    }
    if(!strandFacesCamera(dsum, pts.length, dmax, vis)) continue;   // 렌더와 같은 판정(단일 출처)
    polys.push(q);
    for(const p of q){
      if(p.ix < x0) x0 = p.ix; if(p.ix > x1) x1 = p.ix;
      if(p.iy < y0) y0 = p.iy; if(p.iy > y1) y1 = p.iy;
    }
  }
  const Wd = x1 - x0, Ht = y1 - y0;
  if(!(polys.length > 20 && Wd > 0 && Ht > 0)) return null;
  // ② 폭 프로파일(가로 스캔라인) · 밑단 라인(세로 스캔라인)
  const NB = SILHOUETTE.bands, NC = SILHOUETTE.cols, NR = SILHOUETTE.roughCols;
  const lo = new Array(NB).fill(Infinity), hi = new Array(NB).fill(-Infinity);
  const bot = new Array(NC).fill(-Infinity);
  /* ── 커트 지표용 추가 스캔 (2026-08-18 j) ────────────────────────────
     밑단 요철은 13칸으로는 안 보인다 — 칸 간격이 요철보다 넓어서 요철이
     "전체 모양"으로 읽힌다. 그래서 33칸을 따로 뜬다.
     가운데 띠의 세로 스캔은 <b>뱅 끝</b>을 찾기 위한 것이다(비침 구역의 아래끝). */
  const botR = new Array(NR).fill(-Infinity);
  const zc = SILHOUETTE.zoneCenter;
  const zx0 = x0 + Wd*(0.5 - zc/2), zx1 = x0 + Wd*(0.5 + zc/2);
  const NV = 9, colY = []; for(let k=0;k<NV;k++) colY.push([]);
  for(const q of polys){
    for(let i=1;i<q.length;i++){
      const a = q[i-1], b = q[i];
      for(let k=0;k<NB;k++){
        const t = _scanCross(a, b, 'iy', y0 + k/(NB-1)*Ht);
        if(t == null) continue;
        const x = a.ix + (b.ix - a.ix) * t;
        if(x < lo[k]) lo[k] = x; if(x > hi[k]) hi[k] = x;
      }
      for(let k=0;k<NC;k++){
        const t = _scanCross(a, b, 'ix', x0 + k/(NC-1)*Wd);
        if(t == null) continue;
        const y = a.iy + (b.iy - a.iy) * t;
        if(y > bot[k]) bot[k] = y;
      }
      for(let k=0;k<NR;k++){
        const t = _scanCross(a, b, 'ix', x0 + k/(NR-1)*Wd);
        if(t == null) continue;
        const y = a.iy + (b.iy - a.iy) * t;
        if(y > botR[k]) botR[k] = y;
      }
      for(let k=0;k<NV;k++){
        const t = _scanCross(a, b, 'ix', zx0 + (NV<2?0:k/(NV-1))*(zx1-zx0));
        if(t == null) continue;
        colY[k].push(a.iy + (b.iy - a.iy) * t);
      }
    }
  }
  /* 뱅 끝 — 위에서 내려가다 <b>처음 벌어지는</b> 자리. 사진 쪽 정의와 같다
     (사진은 화소가 끊기는 자리, 여기는 교차점이 벌어지는 자리). */
  const tipGap = 0.03 * Ht, tips = [];
  for(const ys of colY){
    if(ys.length < 2) continue;
    ys.sort((p,r)=>p-r);
    let tp = ys[ys.length-1];
    for(let i=1;i<ys.length;i++) if(ys[i]-ys[i-1] > tipGap){ tp = ys[i-1]; break; }
    tips.push(tp);
  }
  tips.sort((a,b)=>a-b);
  const tipY = tips.length ? tips[(tips.length*0.5)|0] : null;
  /* 비침 — 구역 가로 스캔라인에서 <b>덩어리 몇 개</b>가 지나가는가.
     ⚠ 채움 비율(사진의 seeFill)은 여기서 못 낸다: 사진은 화소 면적이고 우리는
       굵기 없는 폴리라인이라 같은 수가 안 나온다. 채움을 재려면 <b>그려진</b>
       캔버스를 읽어야 한다(measureMaskLeak가 이미 그 방식이다) — 다음 작업. */
  let seeRuns = null;
  if(tipY != null && tipY > y0){
    const zr0 = y0 + (tipY - y0) * SILHOUETTE.zoneTop, zr1 = tipY;
    const NH = 11, gap = SILHOUETTE.zoneGap * (zx1 - zx0), runs = [];
    for(let k=0;k<NH;k++){
      const yy = zr0 + (NH<2?0:k/(NH-1))*(zr1-zr0), xs = [];
      for(const q of polys) for(let i=1;i<q.length;i++){
        const a = q[i-1], b = q[i];
        const t = _scanCross(a, b, 'iy', yy);
        if(t == null) continue;
        const x = a.ix + (b.ix - a.ix) * t;
        if(x >= zx0 && x <= zx1) xs.push(x);
      }
      if(!xs.length) continue;
      xs.sort((p,r)=>p-r);
      let c = 1;
      for(let i=1;i<xs.length;i++) if(xs[i]-xs[i-1] > gap) c++;
      runs.push(c);
    }
    runs.sort((a,b)=>a-b);
    seeRuns = runs.length ? runs[(runs.length*0.5)|0] : null;
  }
  /* 레이어 단 — 우리는 <b>가닥 끝점</b>이 어디에 몰리는지 그대로 셀 수 있다.
     사진 쪽(밝기 단절)과 원리가 다르므로 <b>위치만</b> 비교한다(CUT_REF 주석). */
  const NT = SILHOUETTE.tipBins, hist = new Array(NT).fill(0);
  for(const q of polys){
    const p = q[q.length-1];
    hist[Math.max(0, Math.min(NT-1, Math.floor((p.iy - y0)/Ht*NT)))]++;
  }
  let bk = -1, bv = -1;
  for(let k=3;k<NT-3;k++) if(hist[k] > bv){ bv = hist[k]; bk = k; }
  const r2 = v => (v == null ? null : +v.toFixed(2));
  return {
    angle, n: polys.length,
    wh: +(Wd / Ht).toFixed(3),
    wp: lo.map((v,k)=> hi[k] > v ? r2((hi[k]-v)/Wd) : 0),
    bot: bot.map(v=> v > -Infinity ? r2((v-y0)/Ht) : null),
    botRough: _bottomRoughness(botR.map(v=> v > -Infinity ? (v-y0)/Ht : null), SILHOUETTE.roughSmooth),
    seeRuns,
    tipY: tipY == null ? null : r2((tipY - y0)/Ht),
    layerY: bk < 0 ? null : +((bk + 0.5)/NT).toFixed(3),
  };
}
/* 밑단선의 <b>고주파 성분</b> — 이동평균(=전체 모양)을 뺀 나머지의 평균 절대값.
   레퍼런스 사진을 잰 식과 <b>글자 그대로</b> 같다(CUT_REF 주석 참고).
   결측 칸(스캔라인이 실루엣을 못 만난 곳)은 이웃 값을 승계한다 — 지어내지 않는
   대신 요철로 세지도 않는다는 뜻이다. */
function _bottomRoughness(line, win){
  const n = line.length;
  if(!(n >= win + 2)) return null;
  const v = new Array(n); let last = null;
  for(let i=0;i<n;i++){ if(line[i] != null){ v[i] = line[i]; last = line[i]; } else v[i] = last; }
  for(let i=n-1;i>=0;i--) if(v[i] == null) v[i] = v[i+1];
  if(v[0] == null) return null;
  const h = win >> 1; let s = 0;
  for(let i=0;i<n;i++){
    let acc = 0;
    for(let j=-h;j<=h;j++) acc += v[Math.min(n-1, Math.max(0, i+j))];
    s += Math.abs(v[i] - acc/(2*h+1));
  }
  return +(s/n).toFixed(4);
}
/* 4뷰를 재서 레퍼런스와 나란히 찍는다. 스타일 스펙을 적용한 직후 자동으로 부르고,
   콘솔에서 reportSilhouette()로 언제든 다시 부를 수 있다. */
function reportSilhouette(id){
  const ref = SILHOUETTE_REF[id || 'layered_bob_hush'];
  const VL = { front:'정면', left:'좌측', right:'우측', back:'후면' };
  const fmt = a => '[' + a.map(v=> v == null ? ' — ' : (v<0?'':' ') + v.toFixed(2)).join(' ') + ']';
  const out = {};
  for(const a of ANGLES){
    const m = measureSilhouette(a);
    if(!m){ console.log('[실루엣·' + (VL[a]||a) + '] 잴 수 없음(모델/뷰 보정 없음)'); continue; }
    out[a] = m;
    const t = ref && ref[a];
    const yaw = (typeof getViewYawDeg === 'function') ? getViewYawDeg(a) : null;
    const head = '[실루엣·' + (VL[a]||a) + '] 가닥 ' + m.n
      + (yaw == null ? '' : ' · 실측yaw ' + yaw.toFixed(0) + '°'
         + (t ? ' (레퍼런스 ' + (a==='front'?0:a==='back'?180:(a==='left'?50:-50)) + '°)' : ''));
    if(!t){ console.log(head + ' · W/H ' + m.wh + ' · 폭 ' + fmt(m.wp)); continue; }
    /* 폭 차이는 <b>레퍼런스가 있는 단만</b> 평균한다(우측 중간 3단은 null이다 —
       얼굴이 실루엣을 끊은 자리라 비교가 성립하지 않는다. 위 한계 ① 참고). */
    let ds = 0, dn = 0;
    for(let k=0;k<m.wp.length;k++){ if(t.wp[k] == null) continue; ds += Math.abs(m.wp[k]-t.wp[k]); dn++; }
    /* ── 커트 지표 (2026-08-18 j) ────────────────────────────────────
       W/H·폭·밑단은 <b>덩어리 모양</b>만 말한다. 아래 셋은 커트 손잡이를
       직접 가리킨다. 화살표는 <b>제안</b>이지 자동조정이 아니다 — 어느
       손잡이를 돌릴지는 미용사가 정한다(이 파일의 제품 방향). */
    const cr = (CUT_REF[id || 'layered_bob_hush'] || {})[a];
    let cutTxt = '';
    if(cr){
      const L = [];
      const num = v => (v == null ? '—' : (+v).toFixed(3));
      if(m.botRough != null && cr.botRough != null){
        const d = m.botRough - cr.botRough;
        L.push('   요철   우리 ' + num(m.botRough) + ' · 목표 ' + num(cr.botRough)
          + (Math.abs(d) < 0.008 ? '  (맞음)' : d < 0 ? '  ← 끝이 덜 텄다: texture ↑' : '  ← 너무 텄다: texture ↓'));
      }
      if(m.seeRuns != null && cr.seeRuns != null){
        const d = m.seeRuns - cr.seeRuns;
        L.push('   비침   덩어리 우리 ' + m.seeRuns + '개 · 목표 ' + cr.seeRuns + '개'
          + (d === 0 ? '  (맞음)' : d < 0 ? '  ← 뭉쳐 있다: density ↓(더 솎기)' : '  ← 너무 성기다: density ↑')
          + '\n           (목표 채움 ' + num(cr.seeFill) + ' — 우리 쪽 채움은 아직 못 잼: 굵기가 있는 그림을 읽어야 한다)');
      }
      if(m.layerY != null && cr.layerY != null){
        const d = m.layerY - cr.layerY;
        L.push('   레이어 단 우리 ' + num(m.layerY) + ' · 목표 ' + num(cr.layerY)
          + (Math.abs(d) < 0.04 ? '  (맞음)' : d > 0 ? '  ← 단이 낮다: elevation ↑' : '  ← 단이 높다: elevation ↓')
          + '   ※ 원리가 달라(우리=끝점 몰림 / 사진=밝기 단절) 위치만 본다');
      } else if(m.layerY != null){
        L.push('   레이어 단 우리 ' + num(m.layerY) + ' · 목표 없음(이 뷰는 이 지표를 안 믿는다)');
      }
      if(L.length) cutTxt = '\n' + L.join('\n');
    }
    console.log(head
      + '\n   W/H  우리 ' + m.wh.toFixed(2) + ' · 목표 ' + t.wh.toFixed(2)
      + '  (' + ((m.wh-t.wh)>0?'+':'') + (m.wh-t.wh).toFixed(2) + (m.wh>t.wh ? ' 더 넓다)' : ' 더 좁다)')
      + '\n   폭   우리 ' + fmt(m.wp) + '\n        목표 ' + fmt(t.wp)
      + '  평균차 ' + (dn ? (ds/dn).toFixed(3) : '—')
      + '\n   밑단 우리 ' + fmt(m.bot) + '\n        목표 ' + fmt(t.bot)
      + cutTxt);
  }
  console.log('[GYEOL 빌드 ' + BUILD.n + '] ' + BUILD.tag + ' — 이 줄이 안 보이면 옛 파일이 돌고 있습니다.');
  console.log('[실루엣] W/H가 목표보다 크면 <b>덩어리가 넓다</b>(두상에서 떴거나 밑단이 안 모였다).'
    + ' 폭 프로파일 아래쪽 2~3단이 목표보다 크면 밑단이 안 좁아진 것 — 커팅 라인/오버디렉션 쪽을 본다.');
  return out;
}

