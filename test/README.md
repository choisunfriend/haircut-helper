# 검사 세트

    node test/run.js

브라우저 없이 `js/` 전체를 vm 컨텍스트에 올려서(= `index.html`의 `<script>` 순서 그대로)
불변식을 확인한다. DOM·WebGL·MediaPipe는 스텁이다.

## 왜 있나

이 저장소가 반복하는 실패는 버그라기보다 **모양**이다. 주석에 남은 기록만 봐도:

- 한 값을 두 곳이 각자 쓰다가 한쪽만 고쳐짐 — 앵커/관측(8/09), 기준면(8/17),
  로그/판정(8/31), 목 밑동 소비처 열 곳, 얼굴 라인 cal(9/07)
- 표시용 손잡이와 치수용 값을 겹침 — sideGain(9/07)
- 부호를 빌드식 기준으로 적어 놓고 되쏘기에서 반대로 돎 — cxNudgePx(9/06 2·3·4차)

사람 눈으로 잡으려면 매번 같은 실력이 필요하다. 세션마다 실력이 다르니 기계가 잡게 한다.

## 검사를 추가할 때

**반드시 깨지는 것을 한 번 보고 나서 믿을 것.** 검사 ①은 처음 작성했을 때
`state.landmarks`가 비어 `getViewYawDeg`가 폴백으로 빠지는 바람에 **잘못된 이유로
통과**했다. 회귀를 일부러 넣어 보고서야 알았다. 그래서 `primeState()`가 있고,
거기서 포즈 티어가 `pnp`인지 먼저 확인한다.

회귀를 넣어 확인하는 법:

    sed -i "s|if(tier === 'pnp') return lm.poseYawDeg;|if(tier === 'pnp') return correctedViewYawDeg(lm.poseYawDeg, angle);|" js/01-face-landmarker.js
    node test/run.js      # ① 실패해야 정상
    git checkout js/01-face-landmarker.js

## 층 규칙 (검사 ①·⑦이 지키는 것)

| 층 | 값 | 쓰는 곳 |
|---|---|---|
| **치수** | `getViewYawDeg` | `getHeadEllipsoid`·`getScalpEllipsoid`·헐 맞춤 — 머리통 크기를 푼다 |
| **표시** | `calForDraw`(`sideGain`·`drawNudgePx`) | 되쏘기·가림판정·얼굴라인·실루엣 측정 |

표시용 손잡이를 치수층에 넣으면 실루엣 폭이 깊이로 귀속돼 머리통이 좁고 깊어진다.
9/07에 그렇게 해서 "오히려 더 쏠렸다"가 나왔다. 검사 ①이 그 자리다.

`viewCal[angle]` 원본을 직접 읽는 새 코드를 쓰면 검사 ⑦이 잡는다. 면제하려면
**이유를 주석과 면제 목록 양쪽에 적어야** 한다.

## 부호 규약

`ix = lx/cal.s + cal.cx + cal.dx` — **`dx`가 +면 화면 오른쪽.**
빌드식 `mx = (px − cx)·s` 기준으로 부호를 말하지 말 것. 그게 9/06의 세 턴이었다.
