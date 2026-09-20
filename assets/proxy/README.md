# assets/proxy — 의상 원본(프록시 데이터)

여기 있는 건 `assets/fitted/`처럼 구워 붙인 결과물이 아니라 **그 원본**입니다.
쇼핑몰이 열리면 몰에 올라갈 것이 이쪽입니다.

## 무엇이 들어 있나

| 파일 | 내용 |
|---|---|
| `female_casualsuit01.json` | 반팔 상의 + 하의 한 벌 |
| `female_elegantsuit01.json` | 원피스 슈트 |
| `textures/*_diffuse.png` | 색 텍스처 (지금 앱은 안 쓰고 단색으로 칠합니다) |
| `textures/*_normal.png` `*_ao.png` | 요철·그늘 텍스처 (나중에 쓸 것) |

출처: MakeHuman 시스템 의상. 2020년 9월 CC0로 공개됐습니다.
(makehuman-js/makehuman-data · public/data/proxies/clothes)

## 왜 이 형식인가

의상 정점 하나하나가 **베이스 메쉬(hm08)의 삼각형 세 개에 무게중심 좌표로 물려**
있습니다. 그래서 몸이 바뀌면 그 식을 다시 풀기만 하면 옷이 따라옵니다.

- `ref_vIdxs` — 의상 정점이 물려 있는 베이스 메쉬 정점 3개
- `weights`   — 그 삼각형 안에서의 무게중심 좌표
- `offsets`   — 그 지점에서 표면 밖으로 띄운 양
- `faces`     — 면 목록 (three.js 레거시 JSON 형식, 비트마스크)

`assets/fitted/`의 OBJ는 이 식을 우리 남·여 표준 체형에 대해 한 번 풀어서
굳힌 것입니다. 체형이 늘면 fitted는 다시 구워야 하지만, **이 파일은 그대로**입니다.

## 푸는 법

```bash
python3 tools/mhproxy.py   # load_proxy() → fit_to_body(ref, w, off, 체형정점)
```

`fit_to_body`에 넘기는 체형 정점은 **hm08 전체 19,158개 배열**이어야 합니다
(`assets/body_male.obj`는 목 위를 잘라내며 번호를 다시 매겼으므로 그대로는 못 씁니다).
MakeHuman base.obj에 macrodetails 타깃을 얹어 만듭니다 — 남녀 두 벌을 만든
그 과정입니다.

## 남은 것

MakeHuman은 옷 밑에 깔린 몸 정점을 지워서 살이 비치는 걸 막는데(`delete_verts`),
이 JSON에는 그 목록이 없습니다. 그래서 지금은 `tools/conform.py`로 비치는 자리만
5mm 밀어내는 마무리를 합니다. 업체 옷을 받기 시작하면 이 목록을 같이 받거나
반입 단계에서 계산해 굽는 쪽이 낫습니다.
