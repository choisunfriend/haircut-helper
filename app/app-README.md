# 결 360shot — 앱으로 감싸기

`dist/`(난독화된 웹 자산 61MB, 네트워크 0회)를 Capacitor로 네이티브 앱 안에
그대로 넣습니다. 모델·wasm·three·TFJS가 전부 앱 번들에 들어가므로 **비행기
모드에서도 촬영→마스크→3D까지 돕니다.**

## 한 번만 하는 준비

```bash
cd app
npm install
npx cap add android       # 안드로이드 (Android Studio 필요)
npx cap add ios           # 아이폰 (맥 + Xcode 필요)
```

## 자산을 바꿀 때마다

```bash
cd ..  && node tools/build-dist.js   # dist/ 재생성(난독화 포함)
cd app && npx cap sync               # dist/ → 앱 번들로 복사
npx cap open android                 # 또는 open ios → 스튜디오에서 실행/서명
```

## 권한

카메라만 씁니다. `cap add` 가 만든 네이티브 프로젝트에 아래를 넣으십시오.

- 안드로이드 `android/app/src/main/AndroidManifest.xml`
  ```xml
  <uses-permission android:name="android.permission.CAMERA" />
  <uses-feature android:name="android.hardware.camera" android:required="false" />
  ```
- 아이폰 `ios/App/App/Info.plist`
  ```xml
  <key>NSCameraUsageDescription</key>
  <string>머리 모양을 4방향으로 촬영해 3D로 복원하기 위해 카메라를 씁니다.</string>
  ```

## 주의

- **인터넷 권한은 필요 없습니다.** 안드로이드 매니페스트에서 `INTERNET` 을
  빼도 앱이 돕니다(쇼핑몰 패널만 빈 칸이 됩니다). 홍보용 배포에서 "네트워크를
  쓰지 않는다"를 증명하고 싶으면 그렇게 하는 쪽이 확실합니다.
- WebGL 2 가 필요합니다. 아주 오래된 기기에서는 TF.js 폴백도 webgl 백엔드를
  쓰므로 같이 실패합니다 — 그 경우 목 치수가 고정값으로 떨어집니다(정직한 한계).
- 앱 크기: 설치본 약 70~80MB(모델 10MB + wasm 18MB + 바디/옷 메시). 모델을
  더 줄이고 싶으면 `pose_landmarker_lite.task`(5.6MB)만 남기고
  `vendor/mediapipe/wasm` 의 **nosimd** 변종을 빼는 선택지가 있습니다
  (최신 기기는 SIMD 를 다 지원합니다).
