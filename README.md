# GYEOL — 파일 구조

원본 `index.html`(30,243줄 · 2.1MB) 한 벌을 분해한 것이다. **코드는 한 줄도 바뀌지 않았다.**
잘라낸 조각을 순서대로 다시 이으면 원본과 바이트 단위로 같다(검증 완료).

## 왜 이 경계인가

경계를 새로 정하지 않았다. 파일에 이미 있던 배너 주석(`/* ═══ 이름 ═══ */`) 101개를
그대로 접합면으로 썼다. 어떤 파일도 함수 한가운데를 지나가지 않는다 —
24개 전부 `node --check`를 단독으로 통과한다.

## ⚠ 로드 순서

`js/` 아래는 전부 **클래식 스크립트**다(ES 모듈이 아니다). 이 앱은 `onclick=`
인라인 핸들러와 전역 함수에 의존하므로 원본이 의도적으로 택한 방식이고,
분해하면서도 그대로 뒀다.

따라서 `index.html`의 `<script src>` **순서가 곧 실행 순서**이고, 그 순서는
원본 단일 파일의 위→아래 순서와 같다. 순서를 바꾸면 상수 선언 전 참조(TDZ)가
난다. 파일 이름 앞의 번호가 그 순서다.

## 구조

```
index.html                  껍데기 — <head> · body 마크업 · CDN · 스크립트 태그
styles.css                  (원본 4053~4479행)
docs/
  ARCHITECTURE.md           작업 원칙 · 제품 방향 · 좌표 규약 · 파일 구조 목차
  LESSONS.md                재발 방지 교훈 · 하네스 함정 · 정직한 한계
  CHANGELOG.md              날짜별 변경 이력 (325KB — 파일 부피의 15%가 여기였다)
js/
  01-face-landmarker        얼굴 랜드마크 실측 · 포즈 행렬 · 섹션 경계 보정
  02-state-sections         SECTIONS · SECTION_ORDER · gyeol 공정 정의 · 전역 state
  03a-hair-mask             헤어 세그멘테이션 · 모발 프로필 실측 · 마스크 추출
  03b-mask-memory           스크래치 캔버스 풀 · 모바일 메모리 대응
  04-structure-tensor       구조텐서 결방향 인식 · 결 극성
  05-capture-nav            화면 전환 · 촬영 · 실시간 각도 가이드
  06-ui-panels              스타일 선택 · 섹션 UI · 조정 패널 · 염색 손잡이 · 레시피
  07a-render-canvas         각도 전환 · 캔버스 렌더 · 지워진 자리 메움 · 경계 배경
  07b-render-compare        2D·3D 대조 도장 · 해상도 단일 출처
  08-cut-engine             공용 계산 유틸 · 커트 연산 · 길이 슬라이더 범위
  09-strand-dye             가닥 경로 추적 · 라인 정돈 · 가닥 성질/색 · 염색 LUT
  10-hair-render-2d         4레이어 가닥 렌더 · 레이어 클립 · 밀도 지도
  11-result-screen          결과 화면 · 목 합성 · AI 호출 · 음성
  12a-head-project          얼굴 계측 · 이미지↔두상 좌표 투영 · 두상/목/얼굴 메쉬
  12b-head-measure          두상 실측 단면 · 정수리 캡 · 두피면 · 헤어라인 대조
  13a-outfit-pose           의상 메쉬 · 포즈 회전 · 이미지점→두상 3D
  13b-lift-fields           3D 리프트 · 결(orientation) 필드 · 모발 점유 필드
  13c-scalp-sections        겹침 정리 · 섹션=두피의 빈틈없는 분할 · 두피 경계
  14-hair-3d-ops            최종 3D 헤어 · 컬/중력/가르마/넘김/볼륨 · 뷰 컬링
  15-project-3d             3D→2D 투영 · 미니 3D · 3D 결과 화면 · 픽셀 이식
  16-style-spec-diag        스타일 스펙 · 커트 지표 레퍼런스 · 진단 하네스
  17a-mannequin             마네킹 헤어 · 마네킹 앞머리 · 얼굴 프로필 · 시술모드
  17b-cut3d-piece           커트 기법 3D · 페이드 · 디스커넥션 · 조각머리 · 조정 캐시
  18-perf-i18n-boot         성능 계측 · 패널 · HELPERS · 소비자용 스위치 · 다국어 · 부팅
```

## 앞서 나온 섹션 정리 작업은 어디에 있나

- `SECTIONS` · `SECTION_ORDER` → `js/02-state-sections.js`
- `refineSectionBoundaries` (전역 `SECTIONS`를 덮어쓰는 함수) → `js/01-face-landmarker.js`
- `SCALP_ZONES` · `HEAD_PHI_BANDS` → `js/12b-head-measure.js`
- `SECTION_CUT` · `resolveSection3D` · `SCALP_LIMIT` → `js/13c-scalp-sections.js`

경계 정의가 세 파일에 흩어져 있다는 게 이제 눈에 보인다. 뿌리 기준 재획정을
반영할 때 이 셋을 한 파일(`js/02-state-sections.js`)로 모으는 게 다음 단계다.

## GitHub Pages

상대 경로만 쓰므로 리포지토리 루트에 이대로 올리면 그대로 서빙된다.
빌드 단계 없음.
