/* ══════════════════════════════════════════════════════════
   13a-outfit-pose.js — 의상 메쉬 · 포즈 회전 · 이미지점→두상 3D
   원본 index.html 19029~19767행. 클래식 스크립트이므로 로드 순서가 곧
   실행 순서다 — index.html의 <script src> 순서를 바꾸지 말 것.
   ══════════════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════════════════════
   의상 메쉬 (3단계 프로토타입)
   AI 추천 결과에 맞춘 의상 표시. 절차 생성 폴백 + OBJ/MTL 로더 경로.
   ════════════════════════════════════════════════════════════════ */
function buildOutfitPlaceholderMesh(item, widthFactor){
  const group = new THREE.Group();
  group.name = 'outfitPlaceholder'; // 이름은 유지하지만 이제 상반신뿐 아니라 전신(골반·다리·발)까지 포함
  const color = new THREE.Color(item.colorHex || '#888888');
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.75 });
  const pantsColor = color.clone().multiplyScalar(0.55); // 상의보다 어두운 톤 = 하의(바지) 자리표시자
  const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.75 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#241E1A'), roughness: 0.6 }); // 신발은 색과 무관하게 어두운 톤 고정

  // 어깨~가슴 상단부를 대충 근사하는 원뿔대(목에서 어깨로 벌어지는 형태).
  const torsoTopR = 0.50*widthFactor, torsoBotR = 0.92*widthFactor, torsoH = 1.15;
  const torsoGeo = new THREE.CylinderGeometry(torsoTopR, torsoBotR, torsoH, 24);
  const torso = new THREE.Mesh(torsoGeo, mat);
  const torsoTopY = getNeckBottomY(), torsoBotY = torsoTopY - torsoH; // 목이 짧아지면 몸통도 같이 올라온다
  torso.position.y = (torsoTopY + torsoBotY) / 2;
  torso.name = 'outfitTorsoPlaceholder';
  group.add(torso);

  // 옷깃: 목 밑동(y=-1.15)에 딱 맞는 얇은 링. 몸통보다 살짝 어둡게 해서
  // "여기가 목선이다"를 시각적으로 구분해줌 — 원뿔 하나뿐이던 것보다 훨씬
  // 옷처럼 보이게 하는 최소한의 디테일.
  const collarMat = new THREE.MeshStandardMaterial({ color: color.clone().multiplyScalar(0.75), roughness: 0.8 });
  const collarGeo = new THREE.TorusGeometry(torsoTopR*1.03, 0.035*widthFactor, 8, 20);
  const collar = new THREE.Mesh(collarGeo, collarMat);
  collar.position.y = torsoTopY;
  collar.rotation.x = Math.PI/2; // 눕혀서 목 둘레를 감싸는 링 형태로
  collar.name = 'outfitCollarPlaceholder';
  group.add(collar);

  // ── 골반: 몸통 하단에서 허벅지로 이어지는 완충 구간 ──
  const hipTopR = torsoBotR, hipBotR = 0.72*widthFactor, hipH = 0.45;
  const hipGeo = new THREE.CylinderGeometry(hipTopR, hipBotR, hipH, 20);
  const hip = new THREE.Mesh(hipGeo, pantsMat);
  const hipTopY = torsoBotY, hipBotY = hipTopY - hipH; // 골반 하단 = 다리 시작점
  hip.position.y = (hipTopY + hipBotY) / 2;
  hip.name = 'outfitHipPlaceholder';
  group.add(hip);

  // ── 다리 2개: 골반 하단에서 발까지 ──
  const legTopR = 0.30*widthFactor, legBotR = 0.19*widthFactor, legH = 2.35;
  const legGeo = new THREE.CylinderGeometry(legTopR, legBotR, legH, 16);
  const legXOffset = 0.32*widthFactor;
  const legBotY = hipBotY - legH;
  [-1, 1].forEach(side=>{
    const leg = new THREE.Mesh(legGeo, pantsMat);
    leg.position.set(side*legXOffset, (hipBotY + legBotY)/2, 0);
    leg.name = 'outfitLegPlaceholder';
    group.add(leg);
  });

  // ── 발 2개: 다리 하단에서 앞(+Z)으로 살짝 뻗은 형태 ──
  const footW = 0.24*widthFactor, footH = 0.16, footD = 0.46*widthFactor;
  const footGeo = new THREE.BoxGeometry(footW, footH, footD);
  [-1, 1].forEach(side=>{
    const foot = new THREE.Mesh(footGeo, shoeMat);
    foot.position.set(side*legXOffset, legBotY - footH/2, footD*0.28); // 발끝이 앞으로 나오도록 z 오프셋
    foot.name = 'outfitFootPlaceholder';
    group.add(foot);
  });

  // ── 팔 2개: 어깨에서 대략 허벅지 중간 높이까지(안정된 직립 자세 근사) ──
  // 이전엔 짧은 소매(0.85)로 상반신에서 끝났음 — 전신상 요청으로 실제
  // 팔 길이만큼 늘리고, 각도도 옆으로 60° 벌어진 소매가 아니라 몸통을 따라
  // 거의 수직으로 내려오되 살짝 바깥으로 벌어지는(자연스러운 직립 자세)
  // 방향으로 변경.
  const shoulderY = -1.35; // 목 밑동보다 살짝 아래(어깨선 근사)
  const shoulderFrac = (shoulderY - torsoTopY) / (-torsoH); // 원뿔대 상단 기준 진행률(0=상단, 1=하단)
  const shoulderR = torsoTopR + shoulderFrac * (torsoBotR - torsoTopR);
  const armLen = 2.6, armTopR = 0.15*widthFactor, armBotR = 0.10*widthFactor;
  const armGeo = new THREE.CylinderGeometry(armTopR, armBotR, armLen, 12);
  [-1, 1].forEach(side=>{
    const arm = new THREE.Mesh(armGeo, mat);
    // 거의 수직 아래(-Y)로 내려오되 살짝 바깥으로 벌어지는 방향 —
    // Rz(dirAngle)·(0,1,0) = (-sin(dirAngle), cos(dirAngle), 0)이 되도록
    // 목표 방향(옆으로 살짝, 대부분 아래)에 맞는 각도를 역산해서 사용.
    const dirAngle = -side * 2.900; // 라디안 — 목표 방향 벡터(±0.24, -0.97, 0)에 대응
    const dir = new THREE.Vector3(-Math.sin(dirAngle), Math.cos(dirAngle), 0);
    const shoulderPos = new THREE.Vector3(side*shoulderR*0.92, shoulderY, 0.02);
    arm.position.set(
      shoulderPos.x + dir.x*armLen*0.5,
      shoulderPos.y + dir.y*armLen*0.5,
      shoulderPos.z + dir.z*armLen*0.5,
    );
    arm.rotation.z = dirAngle;
    arm.name = 'outfitArmPlaceholder';
    group.add(arm);
  });

  // 포멀 카테고리는 옷깃 아래로 앞트임(라펠) 느낌의 판 2개를 V자로 추가 —
  // 재킷 실루엣을 아주 단순하게나마 구분되게(캐주얼/스트릿과 같은 원뿔로
  // 뭉뚱그려지지 않도록).
  if(item.category === '포멀'){
    const lapelMat = new THREE.MeshStandardMaterial({ color: color.clone().multiplyScalar(0.85), roughness: 0.7 });
    const lapelGeo = new THREE.BoxGeometry(0.16*widthFactor, 0.55, 0.02);
    [-1, 1].forEach(side=>{
      const lapel = new THREE.Mesh(lapelGeo, lapelMat);
      lapel.position.set(side*0.14*widthFactor, -1.45, torsoTopR*0.85);
      lapel.rotation.z = -side*0.28;
      lapel.name = 'outfitLapelPlaceholder';
      group.add(lapel);
    });
  }

  return group;
}

// 실제 .obj(+.mtl) 의상/전신 에셋 로더. Quaternius 등에서 받은 파일을
// OUTFIT_MESH_SOURCE.objUrl(+mtlUrl)에 넣으면 절차적 플레이스홀더 대신
// 진짜 3D가 붙는다. 에셋마다 원래 스케일·피벗이 제각각이라, bounding box를
// 재서 자동으로 (a) neckAttachPoint 하단(y=-1.15)에 상단이 맞닿도록,
// (b) 전신 높이가 지금 절차적 플레이스홀더와 비슷한 범위(약 4유닛)가
// 되도록 스케일·위치를 맞춘다 — 에셋마다 정확도가 다를 수 있어
// OUTFIT_MESH_SOURCE.offsetY/scaleOverride로 수동 보정 가능하게 열어둠.
// neckCutFrac은 호출 쪽(OUTFIT_CATALOG[i].asset.neckCutFrac)에서 에셋별
// 실측값을 넘겨받음 — 전부 같은 베이스 바디라 비슷하지만 에셋마다 다름.
// ※ THREE.OBJLoader/Box3는 브라우저 전용 API라 Canvas류와 마찬가지로 이
// 함수 자체는 Node 샌드박스에서 실행 검증 불가 — 문법 검사만 통과.
function loadOutfitMeshFromOBJ(objUrl, mtlUrl, widthFactor, neckCutFrac, targetBodyLen){
  return new Promise((resolve, reject)=>{
    if(typeof THREE.OBJLoader !== 'function'){
      reject(new Error('OBJLoader 스크립트가 로드되지 않았습니다'));
      return;
    }
    function loadObj(materials){
      const objLoader = new THREE.OBJLoader();
      if(materials) objLoader.setMaterials(materials);
      objLoader.load(objUrl, (obj)=>{
        try{
          const box = new THREE.Box3().setFromObject(obj);
          const size = new THREE.Vector3(); box.getSize(size);

          // 에셋 자체 높이(발~정수리) 대비 "목 밑동" 위치 비율로, 그 위쪽(에셋 자체
          // 머리/목/헤어)은 스케일 계산에서도 제외하고 나중에 클리핑으로도 잘라냄 —
          // 우리 두상(실측 사진 기반 얼굴+헤어)만 보이게 하기 위함.
          const cutFrac = (typeof neckCutFrac === 'number') ? neckCutFrac : 0.84;
          const neckCutYRaw = box.min.y + cutFrac * size.y;
          const bodyHeightRaw = neckCutYRaw - box.min.y; // 발~목까지만(머리 제외) 실측 높이

          /* ── 목 밑동~발끝 길이는 <b>두신 자</b>가 정한다 (2026-09-09 사용자 지시) ──
             사용자: "두신은 6.5로 맞춰서 이전에 잘 나왔었는데 4.9로 바뀐 거라고.
             지금 6.5로 되어 있는 그 함수가 결정하는 값으로 나오도록 하고,
             고정값은 없애면 돼."

             맞다. 여기 있던 TARGET_HEIGHT = 4.0은 <b>에셋 눈대중</b>이고 두신 자와
             아무 관계가 없었다. 11-result-screen.js:126의 배너가 "그걸 이 함수로
             통일했다"고 적어 놓고도, 실제로 personBodyLenMesh를 부르는 곳은 결과
             화면 한 군데뿐이었다(3D 화면은 이 4.0을 그대로 먹었다 = 4.9두신).
             이제 <b>두 화면이 같은 자</b>를 쓴다 — 호출부가 그 화면이 재는
             정수리(결과 화면 = 사진 헤어박스 / 3D 화면 = 씬 실측)로 계산한
             targetBodyLen을 들려 보낸다.
             ⚠ 폴백 4.0은 <b>자가 아예 없을 때</b>만이다(정면 랜드마크 실패 →
               getPersonScaleRef가 null). 그 경우엔 두신을 잴 근거 자체가 없다. */
          let TARGET_HEIGHT = targetBodyLen;
          if(!(isFinite(TARGET_HEIGHT) && TARGET_HEIGHT > 0.5)){
            TARGET_HEIGHT = (typeof personBodyLenMesh === 'function') ? personBodyLenMesh() : null;
          }
          if(!(isFinite(TARGET_HEIGHT) && TARGET_HEIGHT > 0.5)){
            TARGET_HEIGHT = 4.0;
            console.warn('[3D·비율] 두상 자(getPersonScaleRef)가 없어 폴백 4.0단위로 세웁니다 —'
              + ' 이 경우에만 두신이 상수에서 벗어납니다.');
          }
          /* ⚠ widthFactor는 이름 그대로 <b>폭</b>이다. setScalar에 곱하면 세로도 같이
             늘어나고, 그만큼 화면 두신이 FIGURE_HEADS에서 벗어난다 — 위에서 자를
             통일해 놓고 마지막 줄에서 다시 어긋나는 자리다. 결과 화면은 뒤에
             group.scale 재보정이 한 번 더 있어 안 보이고, 3D 화면에만 남는다.
             그래서 세로는 자 그대로 두고 폭은 x·z에만 건다.
             ── 그런데 x·z에만 걸어도 <b>몸이 뚱뚱해진다</b> (2026-09-14) ──────────
             세로를 자에 맞춰 줄이고 가로는 wf로 둔 순간, 몸 자체의 <b>가로/세로
             비</b>가 wf배로 벌어진다. 사용자 관찰 "뚱뚱해지고 팔뚝하고 손도
             커진 느낌"이 정확히 그 몫이다. 의상 에셋은 사람 몸이라 <b>균일</b>하게만
             키워야 한다 — 늘리면 팔 굵기·손 크기가 같이 늘어난다.
             그리고 얼굴이 넓다고 몸이 넓어야 할 근거도 없다. 손님의 <b>크기</b>는
             이미 두상 높이(TARGET_HEIGHT)가 들고 있고, wf는 거기에 두 번째로
             얹히는 자다 — 한 값을 두 곳이 각자 정하던 이 저장소의 그 함정이다.
             그래서 기본을 <b>off</b>로 둔다: 균일 배율 · wf 안 씀.
               off     — 두신 정확 · 몸 비례 에셋 그대로  (기본)
               uniform — 예전 동작. 두신이 wf배만큼 상수에서 벗어난다
               xz      — 9/14 오전. 두신은 맞지만 몸이 wf배 뚱뚱해진다
             되돌리기: OUTFIT_MESH_SOURCE.widthMode = 'uniform' (또는 'xz') */
          const wf = (isFinite(widthFactor) && widthFactor > 0) ? widthFactor : 1;
          const mode = OUTFIT_MESH_SOURCE.widthMode
            || (OUTFIT_MESH_SOURCE.widthUniform ? 'uniform' : 'off');
          const scale = OUTFIT_MESH_SOURCE.scaleOverride
            || (TARGET_HEIGHT / (bodyHeightRaw || 1)) * (mode === 'uniform' ? wf : 1);
          const wx = (mode === 'xz') ? wf : 1;
          obj.scale.set(scale * wx, scale, scale * wx);
          if(mode !== 'off') console.log('[3D·비율·의상] widthMode=' + mode + ' · 폭 ×' + wf.toFixed(3)
            + ' — off가 아니면 두신이나 몸 비례 중 하나가 얼굴 폭을 따라 움직입니다.');

          // 스케일 적용 후 좌표 기준으로 재계산해서 위치 정렬(중심을 x/z=0으로,
          // 목 밑동 지점이 neckAttachPoint 하단 y=-1.15에 오도록)
          const box2 = new THREE.Box3().setFromObject(obj);
          const center2 = new THREE.Vector3(); box2.getCenter(center2);
          const neckCutYScaled = neckCutYRaw * scale;
          const offsetY = OUTFIT_MESH_SOURCE.offsetY || 0;
          obj.position.x += -center2.x;
          obj.position.z += -center2.z;
          obj.position.y += (getNeckBottomY() - neckCutYScaled) + offsetY;
          obj.name = 'outfitLoadedOBJ';

          // 에셋 자체 "Hair" 재질은 완전히 숨김(우리 자체 헤어 시스템을 쓰므로).
          // 나머지 재질(Skin/Eyes/Shirt/Pants/Socks 등)에는 위치 정렬 후의
          // 월드 좌표 기준 y=-1.15 클리핑 플레인을 적용해서, 정렬이 살짝 어긋나도
          // 그 위쪽(에셋 자체 머리/목)은 어차피 안 보이게 하는 안전장치로 사용.
          // + 감마 보정: Blender OBJ export는 Kd를 리니어 색공간으로 쓰는데
          // 렌더러가 그대로 표시하면 실제보다 어둡게 나옴(카탈로그 colorHex는
          // 이미 보정된 "진짜 보일 색"으로 계산해둠) — 여기서 실제 로드된
          // material.color에도 동일한 보정을 적용해야 카탈로그 색상과 실제
          // 렌더링이 일치함. THREE.Color.convertLinearToSRGB()가 정확히 이 변환.
          const HIDE_MATERIAL_NAMES = ['hair'];
          const neckClipPlane = new THREE.Plane(new THREE.Vector3(0,-1,0), getNeckBottomY());
          obj.traverse(child=>{
            if(!child.isMesh) return;
            const matName = (child.material && child.material.name || '').toLowerCase();
            if(HIDE_MATERIAL_NAMES.includes(matName)){ child.visible = false; return; }
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach(m=>{
              if(!m) return;
              m.clippingPlanes = [neckClipPlane];
              m.clipShadows = true;
              if(m.color && typeof m.color.convertLinearToSRGB === 'function') m.color.convertLinearToSRGB();
            });
          });

          resolve(obj);
        }catch(e){ reject(e); }
      }, undefined, (err)=>reject(err));
    }
    if(mtlUrl && typeof THREE.MTLLoader === 'function'){
      const mtlLoader = new THREE.MTLLoader();
      mtlLoader.load(mtlUrl, (materials)=>{
        materials.preload();
        loadObj(materials);
      }, undefined, ()=>loadObj(null)); // mtl 로드 실패해도 obj는 시도(무채색으로)
    } else {
      loadObj(null);
    }
  });
}

// 이제 실제 에셋 정보는 OUTFIT_CATALOG[i].asset(id별로 다른 obj/mtl/neckCutFrac)에
// 있음 — item에 asset이 있으면 그걸로 로드, 없으면(아직 실제 에셋 없는 카탈로그
// 항목) 절차적 플레이스홀더로 폴백. 로드 실패(파일 404 등)해도 동일하게 폴백.
async function loadOutfitMesh(item, widthFactor, targetBodyLen){
  if(item.asset && item.asset.objUrl){
    try{
      return await loadOutfitMeshFromOBJ(item.asset.objUrl, item.asset.mtlUrl, widthFactor, item.asset.neckCutFrac, targetBodyLen);
    }catch(e){
      console.warn('OBJ 의상 에셋 로드 실패, 절차적 플레이스홀더로 폴백:', e);
    }
  }
  /* 플레이스홀더도 <b>같은 자</b>를 탄다 (2026-09-09). 예전엔 OBJ만 배율을 받고
     이 쪽은 손으로 짠 ~4단위 그대로였다 — 에셋이 404면 두신이 조용히 달라진다.
     목 밑동을 고정점으로 스케일하므로 옷깃 위치는 배율과 무관하다(결과 화면의
     ensureResultBodyMesh가 쓰는 것과 같은 식). */
  const ph = buildOutfitPlaceholderMesh(item, widthFactor);
  try{
    const want = (isFinite(targetBodyLen) && targetBodyLen > 0.5)
      ? targetBodyLen
      : ((typeof personBodyLenMesh === 'function') ? personBodyLenMesh() : null);
    const m = (typeof measureOutfitMeshBody === 'function') ? measureOutfitMeshBody(ph) : null;
    if(want && m && m.heightRaw > 0.01){
      const NY = getNeckBottomY();
      const s = want / m.heightRaw;
      ph.scale.setScalar(s);
      ph.position.y = NY * (1 - s);
    }
  }catch(e){ console.warn('[3D·비율] 플레이스홀더 두신 배율 실패 — 원래 크기 유지:', e); }
  return ph;
}

/* 의상이 만들어지는 <b>유일한</b> 출구에서 목 구멍을 잰다 (2026-08-31 11차).
   호출부마다 재면 3D 화면과 결과 화면이 서로 다른 옷깃을 보게 된다 — 이 파일이
   여러 번 겪은 그 모양이다. loadOutfitMesh를 감싸는 이유도 같다: OBJ 경로든
   플레이스홀더 폴백이든 <b>여기 한 곳</b>을 지나간다.
   ⚠ 두 호출부 모두 <b>두신 배율을 걸기 전</b>에 이 함수를 지난다(결과 화면은 바로
     위에서 snap.group.scale을 1로 되돌린다). 목 메쉬도 그 배율 밖이라 좌표계가 같다. */
async function loadOutfitMeshMeasured(item, widthFactor, targetBodyLen){
  const mesh = await loadOutfitMesh(item, widthFactor, targetBodyLen);
  try{
    const g = measureGarmentNeckOpening(mesh);
    if(g){
      _garmentNeckOpening = g;
      console.log('[3D·목] 옷깃 구멍 실측 반폭 ' + g.halfWidth.toFixed(3)
        + ' · 반깊이 ' + g.halfDepth.toFixed(3) + ' 단위 → 아래 링 = 이 값 ×' + NECK_SHAPE.inset);
    }else{
      console.warn('[3D·목] 옷깃 구멍 실측 실패 — 예전(두개골 클램프) 경로로 폴백');
    }
  }catch(e){ console.warn('[3D·목] 옷깃 구멍 실측 예외:', e); }
  // (옛 50) 3D 결과 화면이 실제로 불러올 때 — 아직 못 쟀으면 여기서 어깨를 잼(아래 SHOULDER)
  SHOULDER._afterOutfitLoad(mesh, item);
  return mesh;
}
/* ==========================================================================
 * SHOULDER (옛 50-shoulders.js) — 어깨: 머리카락이 몸통을 뚫지 않고 어깨 위·앞·뒤로 놓이게 + "어깨 앞으로 넘겼는가" 인지
 *
 * 자리: 13a, loadOutfitMeshMeasured 바로 뒤. loadOutfitMeshMeasured 끝에서 몸통 메쉬로 어깨 재기 · computeAdjustedHair3DStrands(17b) 마감 단계 SHOULDER._apply · adjFilterSig 꼬리표 · navTo(05) 끝에서 미리 재기 · perfPanelLines(18) 끝 줄
 *
 * 왜 (2026-10-04 사용자): "어깨 위에 놓이지는 않았어." → "어깨 앞으로 나왔다는 건 인지할 수 있어?
 *   그러면 3D 결과보기에 붙일 몸통 메쉬에서 읽어 보면 되겠네." → "다 넣고, 안 맞으면 빼면 되지."
 *   지금까지 머리카락 계산에는 두상(과 47g의 목 기둥)만 있었고 어깨가 없어서, 긴 머리가 몸통을 그대로 통과했습니다.
 *
 * 무엇을:
 *   ① 어깨 모양을 3D 결과 화면에 붙는 몸통(의상) 메쉬에서 직접 읽습니다 — 어림값이 아니라 그 메쉬의 삼각형을
 *      촘촘히 찍어 (좌우 |x| × 높이 y) 칸마다 "몸통 앞면 z / 뒷면 z"와 "어깨 윗면 높이"를 적어 둡니다.
 *      · 몸통 메쉬는 원래 3D 결과 화면에 들어갈 때 처음 불러오므로, 스타일·조정 화면에 들어올 때 한 번 미리 불러와 잽니다
 *        (재고 나면 버림 · 사진이 바뀌면 다시 잼). 미리 못 쟀으면 3D 결과 화면이 불러올 때 잽니다.
 *   ② 모든 가닥(다시 기른 원본 머리 · 마네킹 스타일 · 길이를 늘린 부분)에 마지막으로 한 번 "몸통 밖으로" 통과시킵니다.
 *      몸통 안에 든 점은 — 어깨 윗면에 살짝 걸친 정도면 위에 얹고, 깊으면 앞면이나 뒷면으로 밀어냅니다.
 *      앞/뒤는 가닥마다 한 번 정합니다: 몸통에 닿기 직전에 어깨 능선보다 앞에 있었으면 앞, 뒤에 있었으면 뒤.
 *      능선 바로 위라 애매하면 ③의 인지 결과를 따릅니다(그쪽을 앞으로 넘긴 사진이면 앞, 아니면 뒤).
 *      목(턱 밑~목 밑동)은 42번의 목 기둥을 같이 씁니다.
 *   ③ 인지 — 정면 사진에서 어깨선 아래에 보이는 머리는 몸 앞에 있는 머리입니다(뒤에 있으면 몸에 가려 안 보임).
 *      사람 영역의 폭이 귀 사이 거리의 2.1배를 넘는 첫 줄을 어깨선으로 보고, 그 아래 머리를 화면 왼쪽/오른쪽 따로 잽니다.
 *      후면 사진은 포즈가 잡은 어깨 높이 아래의 머리(= 등 쪽 머리)를 잽니다. 진단에 숫자로 찍습니다.
 *
 * (2026-10-04i) 앞으로는 사진에서 넘긴 쪽만 — 사용자: "머리가 길기만 하면 다 어깨 앞으로 나온다. 사진에서 어깨 앞으로 머리를 뺀 경우만."
 *   예전: 가닥이 몸통에 닿기 직전에 어깨 능선보다 앞에 있었으면 무조건 앞으로 보냈습니다(사진 인지는 능선 근처의 애매한 가닥에만 씀).
 *        그래서 긴 머리는 옆머리가 전부 어깨 앞으로 나왔습니다.
 *   지금: 그쪽(왼/오른)을 사진에서 어깨 앞으로 넘겼다고 인지했을 때만 예전 규칙. 아니면
 *        · 몸통에 닿은 가닥은 전부 뒤로(어깨 위에 얕게 걸친 점은 그대로 위에 얹음),
 *        · 몸통에 닿지 않고 어깨 앞에 떠 있는 점(어깨 윗면보다 아래 · 몸통 앞면보다 앞)도 뒤로 보냅니다.
 *        목 바로 아래 가운데 띠(|x| < centerBand)는 예외 — 뒤로 보내면 목을 가로지르므로 예전 규칙 그대로.
 *   되돌리기: SHOULDER.frontOnlyIfDraped=false; SHOULDER.refresh()
 *
 * (2026-10-05j) 마네킹은 전부 등 쪽으로 · 어깨를 넘어갈 때 나란히 — 사용자: "마네킹 모드가 떴을 때 어깨 부위가 갈라진 모습.
 *   나란히 정렬해서 등 쪽으로 넘기는 게 기본."
 *   ① 마네킹 모드(mqBack): 사진에서 넘겼는지와 상관없이 전부 뒤로(가운데 띠는 예외). 예전에는 사진이 "앞으로 넘김"이면
 *      마네킹도 능선 앞 가닥은 앞으로, 뒤 가닥은 뒤로 가서 어깨에서 두 갈래로 갈라졌습니다.
 *   ② 넘어가는 자리 다듬기(sweepLen): 뒤로 보낸 가닥은 어깨 아래 점만 등 면으로 옮겨져서, 어깨 높이에서 앞 → 뒤로 한 번에
 *      꺾였습니다(옆에서 보면 가로줄). 처음 뒤로 옮겨진 점에서 가닥을 거슬러 sweepLen만큼은 z를 부드럽게 이어 줍니다
 *      (어깨 위로 올수록 원래 자리 · 내려갈수록 등 쪽). 마네킹·원본 머리 모두 적용.
 *   되돌리기: SHOULDER.mqBack=false · SHOULDER.sweepLen=0 후 SHOULDER.refresh()
 *
 * (2026-10-05k) 어깨 앞으로 넘기기는 끔 — 사용자: "어깨 앞으로 머리를 내려야 할 필요가 있기 전까지는 그냥 아래로 늘어뜨린 형태로.
 *   복잡도만 높아지고 아직 스타일에 꼭 필요할 것 같진 않다. 마네킹도, 어깨 앞으로 넘긴 손님도 일괄적으로 쭉 내려오도록."
 *   frontDrape=false(기본): 사진을 보지 않고, 마네킹·원본 머리 모두 몸통에 닿는 가닥을 전부 등 쪽으로 보냅니다(가운데 띠는 예외).
 *   사진 인지(어깨 앞으로 넘겼는가)는 계산하지 않습니다. 다시 쓰려면 SHOULDER.frontDrape=true; SHOULDER.refresh()
 *
 * (2026-10-07) 어깨 처리 전체를 끔(기본) — 사용자: "얼굴·목 쪽 막음은 최소한으로 해야 한다. 그쪽으로 일부러 보내는 경우도 있으니까."
 *   "(어깨 넘김은) 테스트 삼아 넘겨 본 거다. 그 기능 전혀 필요 없어서 그냥 원복하면 된다." → 선택: 어깨 처리 전체 끔.
 *   계기(폰 영상 · 긴 직모 · 결 표를 건 마네킹): 턱 밑 목 앞을 가로지르는 가닥 뭉치. 같은 손님·같은 사진에서 목 밖으로 민 점이
 *   다시 기른 가닥일 때 6 → 결 표를 건 마네킹일 때 2,632(가닥이 목 앞·목 자리에 와 있었음 — 59번 표 쪽 문제), 거기서 "전부 등 쪽으로"가
 *   그 가닥을 목을 가로질러 뒤로 끌어 가로줄이 됐습니다. 재현(이 파일의 _pass · 상자 몸통 · 합성 긴 머리 12,000가닥):
 *   목·어깨 높이의 가로 마디 — 전부 등 쪽으로 1,214~4,905개 → 어깨 처리를 끄면 0개.
 *   지금: on=false(기본) — 머리가 만들어진 그대로 내려갑니다. 앞·뒤로 보내지 않고, 어깨 위에 얹지 않고, 몸통 메쉬를 미리 불러와 재지도 않습니다.
 *   대신: 긴 머리가 어깨·몸통을 통과할 수 있습니다(이 파일이 생기기 전과 같음).
 *   다시 켜기: SHOULDER.on=true; SHOULDER.refresh()  (조정 화면에 다시 들어오면 몸통을 재고 적용합니다)
 *
 * 끄기: SHOULDER.on=false; SHOULDER.refresh()      (어깨만 끔 · 목 기둥은 REGROW.neck=false)
 * 조절: SHOULDER.margin(몸에서 띄우는 거리) · SHOULDER.restMax(이보다 얕게 걸치면 위에 얹음) 후 SHOULDER.refresh()
 * ========================================================================== */
var SHOULDER = (function () {
  'use strict';
  var W = window, TAG = '[어깨]';
  var H = Object.assign({
    on: false, resultOnly: true,   // (2026-11-08d) 끔 — 사용자: "장치를 그냥 꺼 … 조정으로 가려서 잘 되는 줄 알았잖아" · 몸 앞 머리를 못 이어 몸통을 뚫던 것을 등 쪽으로 밀어 가렸음. 켜기 SHOULDER.on=true; SHOULDER.refresh()
      // (2026-10-13d) 3D 결과 화면에서만 켬 — 사용자: "머리를 어깨에 자연스럽게 내리기 안 되어 있다". 조정 화면의 가로줄·쭈글한 띠(12m에 끈 이유)는 조정 화면에서만 생겼으므로 조정 화면은 그대로 둠 · 예전 = SHOULDER.resultOnly=false
    on_was12m: false,   // (2026-10-12m) 다시 끔 — 몸통 메쉬를 조정 화면에도 불러와 가슴 높이 아래를 면에 눌러 가로줄·쭈글한 띠가 생김(10/7과 같은 이유) · 켜기 SHOULDER.on=true; SHOULDER.refresh()   // (2026-10-12g) 다시 켬 — 아래 natural 방식으로만(긴 웨이브 손님: 몸통을 통과한 아랫머리가 뜯겨 보임). 예전 기본 = false
    natural: true,      // (2026-10-12g) 자연스럽게 놓기 — 몸통 안에 든 점만, 그 가닥이 몸통에 들어가기 직전 자리에서 가까운 면(앞/등)으로 밀어 얹음.
                        //   앞·뒤로 강제로 보내지 않고 · 몸통 밖에 뜬 점은 안 건드리고 · 목 구간은 안 건드림(10/7의 목 가로줄 원인 = '전부 등 쪽으로' 강제) · false = 아래 예전 규칙
    on_was: false,      // (2026-10-07) 기본 끔 — 머리가 만들어진 그대로 내려감. 켜기: SHOULDER.on=true; SHOULDER.refresh()
    preload: true,      // 스타일·조정 화면에서 몸통 메쉬를 미리 불러와 잼
    cell: 0.05,         // 격자 한 칸(모델 단위 ≈ 0.9cm)
    xMax: 1.5,          // 좌우 범위(≈ 27cm — 어깨 끝 + 팔 윗부분)
    depth: 1.9,         // 목 밑동에서 아래로 재는 범위(≈ 35cm)
    margin: 0.03,       // 몸에서 띄우는 거리(≈ 0.5cm)
    restMax: 0.07,      // 어깨 윗면에서 이보다 얕게 든 점은 위에 얹음(≈ 1.3cm)
    ambig: 0.2,         // 능선에서 이 안쪽(≈ 3.7cm)이면 앞/뒤가 애매 → 사진 인지를 따름
    shoulderRatio: 2.1, // 사진에서 사람 폭이 귀 사이 거리의 이 배수를 넘는 줄 = 어깨선
    earSpanCm: 15,      // 귀 사이 거리(cm 환산용 어림)
    frontOnlyIfDraped: true,   // (2026-10-04i) 사진에서 어깨 앞으로 넘긴 쪽만 앞으로 — 아니면 전부 뒤로
    centerBand: 0.3,    // 가운데 띠 반폭(≈ 5.5cm) — 이 안쪽은 뒤로 보내지 않음(목을 가로지르게 됨)
    frontDrape: true,   // (2026-10-17) 다시 켬 — 사용자: 전부 등 쪽으로 모으지 말 것. 사진에서 어깨 앞으로 넘긴 머리는 앞으로 걸침 · 예전 = false
    // (2026-10-05k) 어깨 앞으로 넘기기(사진 인지) — 끔: 전부 등 쪽으로 곧게
    mqBack: true,       // (2026-10-05j) 마네킹 모드는 사진과 상관없이 전부 등 쪽으로(frontDrape를 켰을 때 쓰임)
    sweepLen: 0.45,     // 뒤로 넘어가는 자리를 가닥 길이로 이만큼(≈ 8cm) 거슬러 부드럽게 이음 · 0 = 끔
    sweepMinJump: 0.08  // 처음 뒤로 옮겨진 점이 이만큼은 움직였을 때만 다듬음
  }, W.SHOULDER || {});
  var S = H.stats = { strands: 0, touched: 0, front: 0, back: 0, rest: 0, neck: 0, forced: 0, swept: 0, smooth: 0, mq: false, ms: 0, src: '', item: '', err: null };
  var grid = null, gridKey = null, ver = 1, pending = null, pendingKey = null;

  function scr() { try { return currentScreen; } catch (e) { return ''; } }
  function now() { try { return performance.now(); } catch (e) { return Date.now(); } }
  function cmPer() { try { return modelCmPerUnit() || 19; } catch (e) { return 19; } }
  function photoKey() {
    try { var s = state.shots && state.shots.front; return s ? s.length + ':' + s.slice(-24) : ''; } catch (e) { return ''; }
  }

  /* ── ① 몸통 메쉬에서 어깨 읽기 ─────────────────────────────────────────── */
  function measure(obj, key, src, item) {
    var yTop; try { yTop = getNeckBottomY() + 0.02; } catch (e) { return false; }
    if (!isFinite(yTop)) return false;
    var cell = H.cell, NX = Math.ceil(H.xMax / cell), NY = Math.ceil(H.depth / cell), yBot = yTop - NY * cell, xMax = NX * cell;
    var ZF = new Float32Array(NX * NY).fill(-Infinity), ZB = new Float32Array(NX * NY).fill(Infinity), TOP = new Float32Array(NX).fill(-Infinity);
    var tris = 0, filled = 0;
    try { obj.updateMatrixWorld(true); } catch (e) {}
    function put(x, y, z) {
      if (y > yTop || y <= yBot) return;
      var ax = x < 0 ? -x : x; if (ax >= xMax) return;
      var ix = ax / cell | 0, iy = (yTop - y) / cell | 0, k = iy * NX + ix;
      if (z > ZF[k]) ZF[k] = z; if (z < ZB[k]) ZB[k] = z; if (y > TOP[ix]) TOP[ix] = y;
    }
    obj.traverse(function (m) {
      if (!m.isMesh || m.visible === false) return;
      var g = m.geometry, pos = g && g.attributes && g.attributes.position; if (!pos) return;
      var e = m.matrixWorld.elements, idx = g.index, n = idx ? idx.count : pos.count, t, q, i, j;
      var P = [0, 0, 0, 0, 0, 0, 0, 0, 0];
      for (t = 0; t + 2 < n; t += 3) {
        for (q = 0; q < 3; q++) {
          var vi = idx ? idx.getX(t + q) : t + q, x = pos.getX(vi), y = pos.getY(vi), z = pos.getZ(vi);
          P[q * 3] = e[0] * x + e[4] * y + e[8] * z + e[12];
          P[q * 3 + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
          P[q * 3 + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
        }
        var yMaxT = Math.max(P[1], P[4], P[7]), yMinT = Math.min(P[1], P[4], P[7]);
        if (yMinT > yTop || yMaxT < yBot) continue;
        if (Math.min(Math.abs(P[0]), Math.abs(P[3]), Math.abs(P[6])) >= xMax && (P[0] > 0) === (P[3] > 0) && (P[3] > 0) === (P[6] > 0)) continue;
        var e1 = Math.hypot(P[3] - P[0], P[4] - P[1], P[5] - P[2]), e2 = Math.hypot(P[6] - P[0], P[7] - P[1], P[8] - P[2]), e3 = Math.hypot(P[6] - P[3], P[7] - P[4], P[8] - P[5]);
        var N = Math.max(1, Math.min(40, Math.ceil(Math.max(e1, e2, e3) / (cell * 0.5))));
        for (i = 0; i <= N; i++) for (j = 0; j <= N - i; j++) {
          var u = i / N, v = j / N, w = 1 - u - v;
          put(P[0] * w + P[3] * u + P[6] * v, P[1] * w + P[4] * u + P[7] * v, P[2] * w + P[5] * u + P[8] * v);
        }
        tris++;
      }
    });
    for (var k = 0; k < ZF.length; k++) if (ZF[k] > -Infinity) filled++;
    if (filled < 60 || !(TOP[0] > -Infinity)) { S.err = '몸통 메쉬에서 어깨를 못 읽음(칸 ' + filled + ')'; return false; }
    // 어깨 끝: 윗면이 목 밑동에서 가장 멀리(옆으로) 이어지는 칸 · 어깨 내려감: 그 칸의 윗면 높이
    var tipIx = 0, drop = 0, ix;
    for (ix = 0; ix < NX; ix++) if (TOP[ix] > yTop - 0.9) tipIx = ix;
    drop = yTop - TOP[tipIx];
    grid = { yTop: yTop, yBot: yBot, cell: cell, NX: NX, NY: NY, xMax: xMax, ZF: ZF, ZB: ZB, TOP: TOP, tris: tris, filled: filled,
      halfW: (tipIx + 1) * cell, drop: drop };
    gridKey = key; ver++;
    S.src = src || ''; S.item = item || ''; S.err = null;
    drapeMemo = null;
    console.log(TAG + ' 몸통 메쉬에서 어깨를 읽음(' + S.src + (S.item ? ' · ' + S.item : '') + ') — 삼각형 ' + tris + '개 · 칸 ' + filled +
      ' · 어깨 끝(팔 바깥)까지 반폭 ' + (grid.halfW * cmPer()).toFixed(1) + 'cm · 거기서 윗면이 목 밑동보다 ' + (drop * cmPer()).toFixed(1) + 'cm 낮음');
    return true;
  }
  H._measure = measure;

  /* 미리 불러와 재기. 돌려주는 Promise: true = 이번에 새로 쟀음 */
  H.ensure = function () {
    if (!H.on || !H.preload || H.resultOnly) return Promise.resolve(false);
    var key = photoKey();
    if (!key) return Promise.resolve(false);
    if (grid && gridKey === key) return Promise.resolve(false);
    if (pending && pendingKey === key) return pending;
    if (typeof loadOutfitMesh !== 'function' || typeof recommendOutfitWithAI !== 'function' || typeof THREE === 'undefined') return Promise.resolve(false);
    pendingKey = key;
    pending = (async function () {
      try {
        if (!(state.landmarks && state.landmarks.front) || !(state.hairMasks && state.hairMasks.front)) return false;
        var rec = await recommendOutfitWithAI();
        if (!rec || !rec.item) return false;
        var fm = getFaceMetrics(), crown = null, len = null;
        try { if (isFinite(state._model3DCrownY)) crown = state._model3DCrownY; } catch (e) {}
        try { len = personBodyLenMesh(crown == null ? undefined : crown); } catch (e) { len = null; }
        if (!(len > 0.5)) return false;                               // 몸 길이 자가 아직 없음 — 3D 결과 화면이 불러올 때 잼
        var obj = await loadOutfitMesh(rec.item, fm.widthFactor, len);
        if (photoKey() !== key) return false;
        var ok = measure(obj, key, '미리 불러옴', rec.item.name || rec.item.id || '');
        try { if (typeof disposeObject3D === 'function') disposeObject3D(obj); } catch (e) {}
        return ok;
      } catch (e) { S.err = String(e && e.message || e); console.warn(TAG + ' 미리 재기 실패', e); return false; }
      finally { pending = null; }
    })();
    return pending;
  };

  // 3D 결과 화면이 실제로 불러올 때 — 아직 못 쟀으면 여기서 잼(이미 쟀으면 그대로: 머리를 다시 만들지 않게)
  H._afterOutfitLoad = function (obj, item) {   // loadOutfitMeshMeasured(13a) 끝
    try {
      var key = photoKey();
      if (H.on && obj && !(grid && gridKey === key)) { measure(obj, key, '3D 결과 화면에서', (item && (item.name || item.id)) || ''); if (H.resultOnly && grid) { try { H.refresh(); } catch (e2) {} } }
    } catch (e) { console.warn(TAG + ' 재기 실패', e); }
  };

  /* ── ③ 인지: 어깨 앞으로 넘긴 머리 ─────────────────────────────────────── */
  var drapeMemo = null;
  function runAt(mask, Wm, row, cx) {              // 가운데 열을 품은 사람 영역의 좌우 끝
    var x0 = cx, x1 = cx, base = row * Wm;
    if (!mask[base + cx]) return null;
    while (x0 > 0 && mask[base + x0 - 1]) x0--;
    while (x1 < Wm - 1 && mask[base + x1 + 1]) x1++;
    return [x0, x1];
  }
  function recognize() {
    var key = photoKey();
    if (drapeMemo && drapeMemo.key === key) return drapeMemo;
    var R = { key: key, front: null, back: null, signX: 1 };
    try {
      var mi = state.hairMasks && state.hairMasks.front, lm = state.landmarks && state.landmarks.front;
      if (mi && lm && mi.reasonMask && mi.personMask && mi.maskW && mi.maskH && lm.chinY != null) {
        var Wm = mi.maskW, Hm = mi.maskH, hair = mi.reasonMask, per = mi.personMask;
        var span = Math.abs(lm.rEarX - lm.lEarX) * Wm, cx = Math.round((lm.lEarX + lm.rEarX) / 2 * Wm), chin = Math.round(lm.chinY * Hm);
        if (span > 4 && cx > 0 && cx < Wm - 1) {
          var cmPx = H.earSpanCm / span, row, shRow = -1, how = '사람 폭';
          for (row = chin + Math.round(span * 0.15); row < Hm; row++) {
            var rn = runAt(per, Wm, row, cx);
            if (rn && rn[1] - rn[0] + 1 >= H.shoulderRatio * span) { shRow = row; break; }
          }
          if (shRow < 0) { shRow = chin + Math.round(span * 0.75); how = '어림(턱 아래 ' + (0.75 * H.earSpanCm).toFixed(0) + 'cm)'; }
          var F = { shRow: shRow, how: how, inFrame: shRow < Hm - 2, L: { low: -1, area: 0 }, R: { low: -1, area: 0 }, cmPx: cmPx };
          for (row = Math.max(0, shRow); row < Hm; row++) {
            var nL = 0, nR = 0, base = row * Wm, x;
            for (x = 0; x < Wm; x++) if (hair[base + x] === 1) { if (x < cx) nL++; else nR++; }
            F.L.area += nL; F.R.area += nR;
            if (nL >= 3) F.L.low = row; if (nR >= 3) F.R.low = row;
          }
          ['L', 'R'].forEach(function (k) {
            var o = F[k];
            o.depthCm = o.low >= 0 ? (o.low - shRow) * cmPx : 0;
            o.areaCm2 = o.area * cmPx * cmPx;
            o.draped = F.inFrame && o.depthCm >= 3 && o.areaCm2 >= 6;      // 3cm 넘게 내려오고 6cm² 넘게 보임
          });
          R.front = F;
        }
      }
    } catch (e) { R.err = String(e && e.message || e); }
    try {
      var mb = state.hairMasks && state.hairMasks.back, pe = state.poseEars && state.poseEars.back;
      if (mb && mb.reasonMask && mb.maskW && pe && pe.shoulderY != null && pe.span > 0) {
        var Wb = mb.maskW, Hb = mb.maskH, hb = mb.reasonMask, sr = Math.round(pe.shoulderY * Hb), low = -1, r2, x2, cnt;
        for (r2 = Math.max(0, sr); r2 < Hb; r2++) { cnt = 0; for (x2 = 0; x2 < Wb; x2++) if (hb[r2 * Wb + x2] === 1) cnt++; if (cnt >= 3) low = r2; }
        R.back = { shRow: sr, depthCm: low >= 0 ? (low - sr) * (H.earSpanCm / (pe.span * Wb)) : 0 };
      }
    } catch (e) {}
    try {                                             // 사진의 오른쪽이 모델의 +x인가
      var photo = state._hair3Dneutral, probe = (photo && photo.occ && photo.occ.probe) || (state.hairOcc3D && state.hairOcc3D.probe);
      var cam = probe && probe.cams && probe.cams.filter(function (c) { return c.angle === 'front'; })[0];
      if (cam && cam.R && cam.s) R.signX = (cam.R[0] / cam.s) >= 0 ? 1 : -1;
    } catch (e) {}
    drapeMemo = R;
    return R;
  }
  H.recognize = recognize;
  /* 모델 x 쪽(부호)의 머리를 사진에서 어깨 앞으로 넘겼는가 */
  function drapedAt(x) {
    var R = recognize(); if (!R.front) return false;
    var imgRight = (x >= 0) === (R.signX > 0);
    return !!(imgRight ? R.front.R.draped : R.front.L.draped);
  }

  /* ── ② 몸통 밖으로 ─────────────────────────────────────────────────────── */
  function pushPoint(q, prev, st) {
    var g = grid;
    if (H.natural) {                                 // (2026-10-12g) 몸통 안에 든 점만 가까운 면으로 — 몸통 밖은 그대로
      /* (2026-10-13) 목 구간도 목 기둥 밖으로 — 사용자 영상(19:30): 목 앞·옷깃에 가시. 예전 natural은 목 구간을 그냥 통과시켜
         목을 뚫고 나온 가닥 토막이 목 앞에 보였음. 아래 natural이 아닌 쪽과 같은 42번 목 기둥을 씀. */
      if (q.y > g.yTop) {
        var NKn = W.REGROW && W.REGROW.neckPush;
        if (NKn) { var rn = NKn(q); if (rn !== q) { S.neck++; return rn; } }
        return q;
      }
      if (q.y <= g.yBot) return q;
      var ax2 = q.x < 0 ? -q.x : q.x; if (ax2 >= g.xMax) return q;
      var ix2 = ax2 / g.cell | 0, k2 = ((g.yTop - q.y) / g.cell | 0) * g.NX + ix2, zf2 = g.ZF[k2];
      if (zf2 === -Infinity) return q;
      var zb2 = g.ZB[k2], m2 = H.margin;
      if (!(q.z > zb2 - m2 && q.z < zf2 + m2)) return q;
      /* (2026-10-13) 앞으로 보내는 건 들어가기 직전 점이 정말 몸통 앞면 앞에 있었을 때만 — 예전엔 몸통 두께의 가운데보다 앞이면 앞으로 보내서,
         어깨·목 밑동 위로 곧게 떨어지던 가닥이 가슴 앞면에 눌려 옷깃 앞에 가시처럼 보였음(영상 19:30). */
      if (!st.pref) { var ref2 = prev ? prev.z : q.z; st.pref = ref2 >= zf2 - m2 ? 'front' : 'back'; S.touched++; if (st.pref === 'front') S.front++; else S.back++; }
      var dUp2 = g.TOP[ix2] + m2 - q.y, dZ2 = st.pref === 'front' ? zf2 + m2 - q.z : q.z - (zb2 - m2);
      if (dUp2 >= 0 && dUp2 < H.restMax && dUp2 < dZ2) { S.rest++; return { x: q.x, y: g.TOP[ix2] + m2, z: q.z }; }   // 어깨 위에 얹음
      return { x: q.x, y: q.y, z: st.pref === 'front' ? zf2 + m2 : zb2 - m2 };
    }
    if (q.y > g.yTop) {                              // 목 구간 — 42번의 목 기둥
      var NK = W.REGROW && W.REGROW.neckPush;
      if (NK) { var r0 = NK(q); if (r0 !== q) { S.neck++; return r0; } }
      return q;
    }
    if (q.y <= g.yBot) return q;
    var ax = q.x < 0 ? -q.x : q.x; if (ax >= g.xMax) return q;
    var ix = ax / g.cell | 0, iy = (g.yTop - q.y) / g.cell | 0, k = iy * g.NX + ix, zf = g.ZF[k];
    if (zf === -Infinity) return q;
    var zb = g.ZB[k], m = H.margin;
    // (2026-10-04i) 사진에서 이쪽을 어깨 앞으로 안 넘겼으면 앞에 두지 않음(가운데 띠는 예외)
    var only = H.frontOnlyIfDraped && ax >= H.centerBand;
    var useDrape = H.frontDrape && !st.mq;                         // 사진에서 넘겼는지 볼 것인가
    if (only && useDrape && st.drp == null) st.drp = drapedAt(q.x);
    var noFront = only && (!useDrape || !st.drp);                  // 기본: 전부 뒤로
    if (!(q.z > zb - m && q.z < zf + m)) {
      // 몸통 밖 — 어깨 윗면보다 아래에서 몸통 앞에 떠 있는 점
      if (noFront && q.z >= zf + m && q.y < g.TOP[ix]) {
        if (!st.pref) { st.pref = 'back'; S.touched++; S.back++; S.forced++; }
        if (st.pref === 'back') { S.swept++; return { x: q.x, y: q.y, z: zb - m }; }
      }
      return q;
    }
    // 몸통 안
    if (!st.pref) {
      var mid = (zf + zb) / 2, ref = prev ? prev.z : q.z;
      if (noFront) { st.pref = 'back'; if (ref > mid) S.forced++; }
      else if (Math.abs(ref - mid) < H.ambig) st.pref = (useDrape && drapedAt(q.x)) ? 'front' : 'back';
      else st.pref = ref > mid ? 'front' : 'back';
      S.touched++; if (st.pref === 'front') S.front++; else S.back++;
    }
    var dUp = g.TOP[ix] + m - q.y, dZ = st.pref === 'front' ? zf + m - q.z : q.z - (zb - m);
    if (dUp >= 0 && dUp < H.restMax && dUp < dZ) { S.rest++; return { x: q.x, y: g.TOP[ix] + m, z: q.z }; }   // 어깨 위에 얹음
    return { x: q.x, y: q.y, z: st.pref === 'front' ? zf + m : zb - m };
  }
  /* 뒤로 넘어가는 자리 다듬기: k0(처음 등 면으로 옮겨진 점)에서 가닥을 거슬러 sweepLen만큼 z를 부드럽게 */
  function sweepBack(np, p, k0) {
    var len = H.sweepLen; if (!(len > 0) || k0 < 2) return false;
    var zt = np[k0].z, acc = 0, j, a, b, t, sm, q, z, did = false, NK = W.REGROW && W.REGROW.neckPush;
    for (j = k0 - 1; j >= 1; j--) {
      acc += Math.hypot(p[j].x - p[j + 1].x, p[j].y - p[j + 1].y, p[j].z - p[j + 1].z);   // 원래 가닥의 길이로 잼
      if (acc >= len) break;
      a = np[j];
      t = 1 - acc / len; sm = t * t * (3 - 2 * t);
      z = a.z + (zt - a.z) * sm;
      if (!(z < a.z - 1e-4)) continue;                             // 뒤쪽으로만
      q = { x: a.x, y: a.y, z: z };
      if (NK && q.y > grid.yTop) { try { q = NK(q) || q; } catch (e) {} }
      np[j] = q; did = true;
    }
    return did;
  }
  var passMemo = new WeakMap();
  function pass(list) {
    if (!H.on || !grid || !list || !list.length) return list;
    if (H.resultOnly && scr() === 'adjust') return list;   // (2026-10-13d)
    var hit = passMemo.get(list);
    if (hit && hit.ver === ver) return hit.out;
    var t0 = now(), n = list.length, out = new Array(n), i, k, e, p, np, st, r, top = grid.yTop + 0.6;
    S.strands = n; S.touched = S.front = S.back = S.rest = S.neck = S.forced = S.swept = S.smooth = 0;
    var mq = false; try { mq = !!(H.mqBack && MANNEQUIN.on); } catch (e2) { mq = false; }
    S.mq = mq;
    for (i = 0; i < n; i++) {
      e = list[i]; p = e && e.pts; np = null;
      if (p && p.length > 1) {
        st = { pref: null, drp: null, mq: mq, k0: -1 };
        for (k = 1; k < p.length; k++) {
          if (!(p[k].y < top)) continue;
          r = pushPoint(p[k], np ? np[k - 1] : p[k - 1], st);
          if (r !== p[k]) {
            if (!np) { np = p.slice(); try { np._pre = p._pre || p; } catch (e3) {} }   // _pre: 53번 빗질이 달아 둔 "빗기 전 자리"
            np[k] = r;
            if (st.k0 < 0 && st.pref === 'back' && r.z < p[k].z - H.sweepMinJump) st.k0 = k;
          }
        }
        if (np && st.k0 > 0 && sweepBack(np, p, st.k0)) S.smooth++;
      }
      out[i] = np ? Object.assign({}, e, { pts: np }) : e;
    }
    S.ms = now() - t0;
    passMemo.set(list, { ver: ver, out: out });
    return out;
  }
  H._pass = pass;

  H._apply = function (out) {   // computeAdjustedHair3DStrands(17b) 마감 단계
    try { return pass(out); } catch (e) { S.err = String(e && e.message || e); return out; }
  };
  // 서명 — 어깨가 새로 재지거나 꺼지면 미리 만든 헤어도 다시(adjFilterSig 17b 끝)
  H._sigTail = function () { return '|sh' + (H.on && grid && !(H.resultOnly && scr() === 'adjust') ? ver + (H.natural ? 'n' : '') : 0); };

  function redraw() {
    try { if (typeof ADJ_CACHE !== 'undefined' && ADJ_CACHE.bump) ADJ_CACHE.bump(); } catch (e) {}
    try { if (scr() === 'adjust' && typeof renderAdjustFrame === 'function') renderAdjustFrame(); } catch (e) {}
  }
  H.refresh = function () { ver++; passMemo = new WeakMap(); drapeMemo = null; redraw(); return H.on; };
  H.reset = function () { grid = null; gridKey = null; drapeMemo = null; ver++; };

  // 스타일·조정 화면에 들어오면 미리 잼. 조정 화면에서 뒤늦게 재졌으면 머리를 한 번 다시 만듦
  H._afterNav = function (name) {   // navTo(05) 끝 — 스타일·조정 화면에 들어오면 미리 잼
    try {
      if (name === 'style' || name === 'adjust') H.ensure().then(function (fresh) { if (fresh) redraw(); });
    } catch (e) {}
  };

  H._panelLines = function () {   // perfPanelLines(18) 끝
    var L = [], cm = cmPer(), a;
    if (!H.on) return L.concat([TAG + ' 꺼짐']);
    a = TAG + ' 켜짐 · ' + (grid ? '몸통 메쉬에서 읽음(' + S.src + (S.item ? ' · ' + S.item : '') + ') — 어깨 끝(팔 바깥)까지 반폭 ' + (grid.halfW * cm).toFixed(1) + 'cm · 거기서 윗면이 목 밑동보다 ' + (grid.drop * cm).toFixed(1) + 'cm 낮음 · 칸 ' + grid.filled
      : '아직 못 읽음(몸통 메쉬를 불러오기 전)' + (pending ? ' · 불러오는 중' : '')) + (S.err ? ' · ⚠ ' + S.err : '');
    L = L.concat([a]);
    if (grid) L.push('  적용(직전) — 가닥 ' + S.strands + '개 중 몸통에 닿은 가닥 ' + S.touched + ' (앞으로 ' + S.front + ' / 뒤로 ' + S.back + ') · 어깨 위에 얹은 점 ' + S.rest + ' · 목 밖으로 민 점 ' + S.neck + ' · ' + Math.round(S.ms) + 'ms' +
      (!H.frontDrape ? ' · 어깨 앞으로 넘기기 꺼짐 — 전부 등 쪽으로: 앞에 있었지만 뒤로 보낸 가닥 ' + S.forced + ' (어깨 앞에 떠 있던 점 ' + S.swept + ')'
        : H.frontOnlyIfDraped ? ' · 앞은 사진에서 넘긴 쪽만: 앞에 있었지만 뒤로 보낸 가닥 ' + S.forced + ' (어깨 앞에 떠 있던 점 ' + S.swept + ')' + (S.mq ? ' · 마네킹: 전부 등 쪽으로' : '') : ' · 앞은 사진에서 넘긴 쪽만: 꺼짐') +
      ' · 넘어가는 자리 다듬은 가닥 ' + S.smooth);
    if (!H.frontDrape) return L;                       // 사진 인지는 안 씀(계산도 안 함)
    try {
      var R = recognize(), F = R.front;
      if (F) {
        var side = function (o) { return '어깨선 아래 ' + o.depthCm.toFixed(1) + 'cm · ' + o.areaCm2.toFixed(0) + 'cm² → ' + (o.draped ? '앞으로 넘김' : '안 넘김'); };
        L.push('  사진 인지(정면) — 어깨선: 사진 높이의 ' + Math.round(F.shRow / (state.hairMasks.front.maskH || 1) * 100) + '% 줄(' + F.how + ')' + (F.inFrame ? '' : ' ⚠ 어깨가 사진 밖 — 판정 안 함') +
          ' · 화면 왼쪽: ' + side(F.L) + ' · 화면 오른쪽: ' + side(F.R));
      } else L.push('  사진 인지(정면) — 못 함(정면 머리 영역/랜드마크 없음)' + (R.err ? ' ⚠ ' + R.err : ''));
      L.push('  사진 인지(후면) — ' + (R.back ? '어깨 아래로 ' + R.back.depthCm.toFixed(1) + 'cm 내려온 머리(등 쪽)' : '어깨 높이를 못 잡음(포즈 없음)'));
    } catch (e) {}
    return L;
  };

  console.log(TAG + (H.on ? ' 설치 — 몸통 메쉬에서 어깨를 읽어 머리카락이 몸통을 뚫지 않게 합니다(전부 등 쪽으로 · 어깨 앞으로 넘기기는 SHOULDER.frontDrape=true로 켬). 끄기 SHOULDER.on=false 후 SHOULDER.refresh()'
    : ' 설치 — 꺼짐(기본): 머리가 만들어진 그대로 내려갑니다(앞·뒤로 보내지 않음 · 몸통을 통과할 수 있음). 켜기 SHOULDER.on=true; SHOULDER.refresh()'));
  return H;
})();

/* 의상이 도착한 뒤 목을 <b>다시</b> 짓는다. setupModel3DScreen은 두상·목을 먼저
   세우고 의상을 나중에 로드하므로 첫 빌드는 옷깃을 못 본다 — 여기서 그 한 번을
   메운다. 결과 화면 쪽은 의상 다음에 목을 지어서 이 함수가 필요 없다. */
function refitNeckToGarment(group, skinColorCss){
  if(!NECK_SHAPE.fromGarment || !_garmentNeckOpening || !group) return false;
  const old = group.getObjectByName('neckAttachPoint');
  if(!old) return false;
  try{
    let c = new THREE.Color(skinColorCss || '#E8C39E');
    if((c.r + c.g + c.b)/3 < 0.30) c = new THREE.Color('#E0B294');
    const fresh = buildRealNeckMesh(c);
    if(!fresh) return false;
    const parent = old.parent || group;
    parent.remove(old); disposeObject3D(old);
    parent.add(fresh);
    return true;
  }catch(e){ console.warn('[3D·목] 옷깃 기준 재생성 실패(예전 목 유지):', e); return false; }
}

/* ── 뿌리 위치·길이·결방향을 진짜로 3D에 반영 ──
   지적: "computeSectionRealExtent가 만드는 건 섹션 전체에 곱하는 배율 하나뿐이고,
   뿌리가 어디 심기는지(phi/theta)·어느 방향으로 흐르는지(결방향)는 여전히 랜덤
   아니냐" — 정확한 지적. state.hairMasks[angle].orientation(실측 결방향 필드,
   2D에서 이미 쓰고 있는 그 데이터)이 3D 쪽에서는 한 번도 안 읽히고 있었음.
   여기서부터 실제로 연결한다.
   좌우 대칭(temple/side)은 어느 실측 뷰가 물리적으로 어느 쪽(왼/오)에
   대응하는지 좌표계 관례가 코드 어디에도 확정돼 있지 않아서, 잘못 매핑하면
   "왼쪽 결이 오른쪽에 심긴다" 같은 검증하기 어려운 좌우反전 버그가 생길 위험이
   있음. 그래서:
   - phi(위아래 뿌리 위치)·길이비율·결 강도(방향의 크기, 부호 아님)는 모든
     섹션에 안전하게 적용(좌우 모호성이 없는 값들).
   - theta(좌우 뿌리 위치)의 "실측 위치 매핑"은 중심이 하나뿐인 섹션(front/
     occipital/nape)에만 적용 — 그 사진 한 장 안에서 좌/우가 자체적으로
     일관되므로 좌우反전 위험이 없음. temple/side(거울대칭 2중심)는 기존처럼
     무작위 배치를 유지하되, 실측 길이·결 강도는 그대로 반영. */

/* ── 진짜 2D→3D 투영: outputFacialTransformationMatrixes를 실제로 활용 ──
   지적: "makeFaceProjector 말고, 랜드마크 연결할 때 쓰던 AR용 진짜 캘리브레이션
   행렬(outputFacialTransformationMatrixes)이 있었잖아, 그건 왜 안 써?" — 정확한
   지적. 이 매트릭스는 MediaPipe가 "캐노니컬 얼굴을 실제 감지된 얼굴 위치/각도에
   맞춰 정렬하는" 진짜 AR 캘리브레이션 결과인데, decomposePoseMatrix()가 여기서
   yaw/pitch/roll "각도 3개"만 뽑고 나머지(그 각도로 실제 회전을 재구성하는 데
   필요한 나머지 정보)는 버리고 있었음. 심지어 파일 상단 개발 로그에 "이 방향
   재활용 가능"이라고 이미 적어뒀던 걸 놓쳤음.
   여기서부터: 저장된 yaw/pitch/roll(비손실 분해값, 실측 행렬과 100% 동일한
   회전 정보)로 회전행렬을 다시 조립해서, 사진 픽셀 하나하나를 실제 두상 표면
   3D 좌표로 진짜 투영한다 — "시작점·끝점 좌표를 그대로 찍어서 쓴다"는 원래
   말씀하신 방식. */

/* ════════════════════════════════════════════════════════════════
   포즈 회전 · 이미지점 → 두상 3D 좌표
   촬영 뷰의 실측 yaw/pitch/roll로 회전행렬을 만들고(composeRotationZYX),
   사진의 한 점을 두상 표면 3D 좌표로 되돌린다(projectImagePointToHead).
   4장을 하나의 두상 좌표계 위에 올리는 접합부.
   ════════════════════════════════════════════════════════════════ */
// decomposePoseMatrix가 어떤 합성순서를 가정한 건지 몰라서(그 함수엔 각도를
// 다시 행렬로 되돌리는 대응 함수가 없었음), Node로 300개 랜덤 각도 왕복
// 테스트를 돌려 정확히 일치하는 합성순서를 수치로 찾아냄: R = Rz(roll)·Ry(yaw)·Rx(pitch)
// (row-major 3x3, 왕복 오차 0.000000 확인됨).
function composeRotationZYX(yawRad, pitchRad, rollRad){
  const cy=Math.cos(yawRad), sy=Math.sin(yawRad);
  const cx=Math.cos(pitchRad), sx=Math.sin(pitchRad);
  const cz=Math.cos(rollRad), sz=Math.sin(rollRad);
  function matMul(a,b){ const r=new Array(9); for(let i=0;i<3;i++)for(let j=0;j<3;j++){ let s=0; for(let k=0;k<3;k++) s+=a[i*3+k]*b[k*3+j]; r[i*3+j]=s; } return r; }
  const Rz=[cz,-sz,0, sz,cz,0, 0,0,1];
  const Ry=[cy,0,sy, 0,1,0, -sy,0,cy];
  const Rx=[1,0,0, 0,cx,-sx, 0,sx,cx];
  return matMul(matMul(Rz,Ry),Rx);
}
// 전치(=직교행렬의 역) 적용 — "카메라 공간 → 두상 공간" 방향 변환용.
// MediaPipe 포즈 행렬은 "두상(캐노니컬) → 카메라" 방향이므로, 사진에서 읽은
// 카메라 공간 좌표를 두상 공간으로 가져오려면 역회전을 써야 함(아래
// projectImagePointToHead의 2026-07-14 방향 버그 수정 참고).
function applyRotationTranspose3(mat9, v){
  return new THREE.Vector3(
    mat9[0]*v.x + mat9[3]*v.y + mat9[6]*v.z,
    mat9[1]*v.x + mat9[4]*v.y + mat9[7]*v.z,
    mat9[2]*v.x + mat9[5]*v.y + mat9[8]*v.z,
  );
}

// ── 후면(랜드마크 없는 뷰) 실루엣 앵커 (2026-07-14, 사용자 설계) ──
// "후면 사진 앵커 귀와 정수리 등으로 잡아" — 얼굴 랜드마크가 없는 사진의
// 투영 기준점을 지어낸 고정값(getEstimatedLandmarks) 대신 그 사진에 실제로
// 있는 것에서 실측:
//   가로 축척 = 귀 높이의 실루엣 폭(뒤에서도 귀는 실루엣 양옆으로 보임 —
//     정수리에서 아래로 내려가며 폭을 재다가, 어깨(폭 급증) 전 구간에서
//     가장 넓은 행 = 귀 높이/귀 간격)
//   세로 기준(눈/턱 높이) = 같은 사람 정면 사진에서 실측한 "정수리→눈/턱
//     거리 ÷ 귀높이 실루엣 폭" 비율을 후면 실루엣에 적용(같은 사람이니
//     비율은 동일 — 지어낸 상수 없이 전부 그 사람 실측).
// 정면 쪽 폭도 랜드마크 귀 간격이 아니라 같은 정의(실루엣 폭@귀높이)로
// 재서 앞/뒤 측정 정의를 일치시킴(헤어가 부풀어도 양쪽이 같이 부풀어
// 비율이 유지되도록). 포즈는 poseYawDeg를 넣지 않아 기존 폴백(촬영 슬롯
// 기본각 — back이면 180°)을 그대로 따름.
let _silhouetteAnchorCache = {};
function computeSilhouetteAnchors(angle){
  if(_silhouetteAnchorCache[angle] !== undefined) return _silhouetteAnchorCache[angle];
  let result = null;
  try{
    const maskInf = state.hairMasks && state.hairMasks[angle];
    const frontLm = state.landmarks && state.landmarks.front;
    const frontInf = state.hairMasks && state.hairMasks.front;
    if(maskInf && maskInf.personMask && frontLm && frontInf && frontInf.personMask && frontInf.scalpY){
      // 공용: 특정 마스크에서 "중앙 1/3 구간 최상단(5퍼센타일)"과 "행별 실루엣 폭"
      const topOf = (mask, mw, mh)=>{
        const tops = [];
        for(let x=Math.floor(mw/3); x<Math.floor(mw*2/3); x++){
          for(let y=0; y<mh; y++){ if(mask[y*mw+x]){ tops.push(y); break; } }
        }
        if(tops.length < 10) return -1;
        tops.sort((a,b)=>a-b);
        return tops[Math.floor(tops.length*0.05)];
      };
      const rowSpanOf = (mask, mw, y)=>{
        let l=-1, r=-1;
        for(let x=0;x<mw;x++){ if(mask[y*mw+x]){ l=x; break; } }
        for(let x=mw-1;x>=0;x--){ if(mask[y*mw+x]){ r=x; break; } }
        return (l>=0 && r>=l) ? { l, r, w: r-l+1 } : null;
      };
      // "정수리부터 내려가며 어깨(폭 급증) 전 최대 폭 행" = 귀 높이
      const earRowOf = (mask, mw, mh, topRow)=>{
        let earRow=-1, earL=0, earR=0, best=0, shoulderRow=-1;
        const widths = [];
        for(let y=topRow; y<mh; y++){
          const rw = rowSpanOf(mask, mw, y); if(!rw) continue;
          widths.push(rw.w);
          if(widths.length > 8){
            const med = widths.slice().sort((a,b)=>a-b)[Math.floor(widths.length/2)];
            if(rw.w > med*1.6){ shoulderRow = y; break; } // 어깨 시작 — 머리 구간 종료
          }
          if(rw.w > best){ best=rw.w; earRow=y; earL=rw.l; earR=rw.r; }
        }
        return earRow > topRow ? { earRow, earL, earR, span: earR-earL, shoulderRow } : null;
      };

      const mw = maskInf.maskW, mh = maskInf.maskH;
      const fw = frontInf.maskW, fh = frontInf.maskH;
      const topB = topOf(maskInf.personMask, mw, mh);
      const topF = topOf(frontInf.personMask, fw, fh);
      const earB = topB >= 0 ? earRowOf(maskInf.personMask, mw, mh, topB) : null;
      const earF = topF >= 0 ? earRowOf(frontInf.personMask, fw, fh, topF) : null;
      /* 귀 앵커 선택 — PoseLandmarker 실측이 있으면 그걸 쓴다(2026-07-26).
         정면·좌·우가 쓰는 기준점(귀)과 같아져서 네 장이 한 자로 연결된다.
         없으면 기존 방식(어깨 직전 최대폭 행)으로 폴백. */
      let pe = state.poseEars && state.poseEars[angle];
      /* 2차 타당성 검사(2026-07-26): 같은 사진의 실루엣 폭과 대조한다.
         주의 — "귀 간격 ÷ 실루엣 폭"은 고정 상수로 두면 안 된다. 실루엣 폭에는
         머리숱이 포함돼서, 숱이 많거나 부풀린 머리는 이 비율이 크게 낮아진다
         (제대로 잡힌 귀를 오탐으로 버릴 수 있음).
         그래서 그 사람 정면 사진에서 같은 비율을 실측해 기준으로 삼는다.
         (정면: 귀 랜드마크 간격 ÷ 귀높이 실루엣 폭 — 같은 사람이라 숱이 반영됨)
         정면 비율을 못 구할 때만 넉넉한 절대 범위(0.30~1.40)로 최소한만 거른다. */
      if(pe && earB && earB.span > 4){
        const rel = (pe.rEarX - pe.lEarX) * mw / earB.span;
        const relF = (earF && earF.span > 4)
          ? clamp(Math.abs(frontLm.rEarX - frontLm.lEarX) * fw / earF.span, 0.40, 1.05)
          : 0;
        const lo = relF ? relF * 0.50 : 0.30;
        const hi = relF ? relF * 1.60 : 1.40;
        if(rel < lo || rel > hi){
          console.log(`[${angle}] 포즈 귀 = 실루엣 폭의 ${(rel*100).toFixed(0)}%`
            + (relF ? ` (정면 실측 기준 ${(relF*100).toFixed(0)}%, 허용 ${(lo*100).toFixed(0)}~${(hi*100).toFixed(0)}%)` : ' (허용 30~140%)')
            + ' — 비정상으로 보고 실루엣 앵커 사용');
          pe = null;
        }
      }
      /* ══════════════════════════════════════════════════════════════
         가로 자(실루엣 폭)를 <b>세로 자(정수리→어깨)</b>로 바꾼다 (2026-08-09)
         ──────────────────────────────────────────────────────────────
         사용자: "후면을 실루엣비교로 잡기로 했는데(긴머리는 귀가 안 보여서)
         그게 자가 어긋났을 거라고? 그거 잡아야지."

         맞다. 실루엣 비교라는 <b>방침</b>은 옳은데 <b>재는 물건</b>이 틀렸다.
         원래 설계는 "앞뒤 모두 실루엣 폭@귀높이로 재면 헤어가 부풀어도 양쪽이
         같이 부풀어 비율이 유지된다"였다. 전제가 하나 깔려 있다 — <b>앞뒤의
         '귀높이'가 같은 높이일 것</b>. 그게 안 맞는다:
           · 정면 — 머리가 앞으로 넘어와 있어 어깨 직전 최대폭이 <b>귀·턱 근처</b>
           · 후면 — 머리가 어깨까지 계속 넓어져 최대폭이 <b>어깨 바로 위</b>
         실기기 로그가 그대로다: 후면 "귀높이 y 0.635" — 이미지 세로 63.5%면
         귀가 아니라 어깨선이다. 두 자를 서로 다른 자리에서 대고 있었다.
         (같은 현상을 [두상 폭 보정]도 잡는다 — "밴드 W가 끝까지 증가, 적도를
          못 지남 = 어깨로 흐른 머리카락을 두상 폭으로 잡음".)

         ── 1차 고침이 또 틀렸다 (2026-08-09, 사용자 지적) ────────────────
         "앞뒤 실루엣이 거의 일치하니까 그렇게 대조하라고 한 건데, 왜 한 구역을
         지정해서 잡아. 긴머리는 후면에서 본 어깨 위치도 정확하지 않을 수 있어."
         맞다. 가로 자(최대폭 행)를 세로 자(어깨 행)로 바꾼 건 <b>재는 행 하나를
         다른 행 하나로 옮긴 것</b>뿐이다. 그 행이 틀리면 스케일이 통째로 틀리는
         구조는 그대로다. 긴머리의 후면 어깨선은 머리카락에 덮여 있어 특히 위태롭다.

         ── 실제 고침: 옆선 <b>전체</b>로 맞춘다 ──────────────────────────
         사용자 제안: "정수리부터 어깨까지의 삼각형을 만들고 후면에서 그 삼각형에
         일치시켜라." 그 삼각형을 <b>꼭짓점 두 개</b>로 쓰면 다시 점 잡기가 되므로,
         옆선을 이루는 <b>모든 행</b>으로 쓴다 — 삼각형을 한 점에서 재지 않고
         빗변 전체로 겹치는 것이다.

           정면 프로파일  halfF(u) = 정수리에서 u행 아래의 실루엣 반폭
           후면 프로파일  halfB(v) = 같은 정의
           찾는 것        halfB(u·s) ≈ s·halfF(u) 를 가장 잘 만족하는 s

         s를 0.55~1.85에서 훑어 정규화 평균오차가 최소인 값을 고른다. 어느 한
         행이 틀려도 나머지 수백 행이 결정하므로 점 하나에 안 휘고, 어깨를
         <b>찾을 필요조차 없다</b> — 어깨는 프로파일에 이미 들어 있는 특징일 뿐이다.
         (완전한 원뿔이라면 s가 안 정해진다. 실제 실루엣은 정수리가 둥글고 목이
          잘록하고 어깨에서 꺾이므로 그 특징들이 s를 고정한다. 그래서 잔차를
          같이 찍는다 — 잔차가 크면 앞뒤 실루엣이 실제로는 안 닮았다는 신호다.)

         비교 구간은 정수리→턱(정면 실측)의 2배까지. 2는 측정값이 아니라 <b>어디까지
         볼지</b>의 범위일 뿐이라 s를 편향시키지 않는다(팔·배경만 잘라낸다). */
      const profileOf = (mask, mw2, mh2, top, rows)=>{
        const out = [];
        for(let y=top; y<Math.min(mh2, top+rows); y++){
          const rw = rowSpanOf(mask, mw2, y);
          out.push(rw ? rw.w/2 : 0);
        }
        return out;
      };
      /* halfB(u·s) ≈ s·halfF(u) 를 최소오차로 만드는 s. */
      const fitProfileScale = (pf, pb)=>{
        let best = null;
        for(let s=0.55; s<=1.85; s+=0.004){
          const uMax = Math.min(pf.length-1, Math.floor((pb.length-1)/s));
          if(uMax < 24) continue;
          let sum=0, ref=0;
          for(let u=0; u<=uMax; u++){
            const yb = u*s, i = Math.floor(yb), fr = yb - i;
            const hb = (i+1 < pb.length) ? pb[i]*(1-fr) + pb[i+1]*fr : pb[pb.length-1];
            sum += Math.abs(hb - s*pf[u]);
            ref += s*pf[u];
          }
          const err = sum / Math.max(1e-6, ref);
          if(!best || err < best.err) best = { s, err, n: uMax+1 };
        }
        return best;
      };
      /* ── 구간을 둘 다 재고 <b>잔차가 작은 쪽</b>을 쓴다 (2026-08-09) ──────────
         하네스에서 이 방법의 한계가 정확히 드러났다:
           앞뒤 실루엣이 <b>실제로 닮았으면</b> 배율을 0.2% 오차로 맞춘다
             (숱 같음 배율1.0 → 0.998 잔차 0.3% · 후면 20% 크게 → 1.202 잔차 0.7%)
           <b>안 닮았으면</b> 크게 틀린다
             (정면 숱 0.35 / 후면 1.30 → 1.782 잔차 13.7%)
         즉 이 방법의 전제("앞뒤 실루엣이 거의 일치")가 <b>맞는 손님에게만</b>
         맞다. 다행히 <b>잔차가 그걸 말해 준다</b> — 닮았을 때 1% 미만, 안 닮으면
         8%를 넘는다. 그래서 문턱을 두고, 넘으면 <b>정수리 구간만</b>으로 다시
         맞춘다: 머리카락은 아래로 갈수록 퍼지므로 정수리 근처는 앞뒤가 훨씬
         닮아 있다(두개골 + 얇은 모발층). 둘 다 재서 잔차가 작은 쪽을 쓴다. */
      const chinRows = (typeof frontLm.chinY === 'number')
        ? Math.round(frontLm.chinY*fh - topF) : 0;
      const earRows  = (typeof frontLm.earY  === 'number')
        ? Math.round((frontLm.earY*fh - topF) * 1.25) : 0;
      let fit = null, fitFull = null, fitTop = null;
      if(!pe && chinRows > 24 && topF >= 0 && topB >= 0){
        const tryRows = (rows)=> rows > 24 ? fitProfileScale(
          profileOf(frontInf.personMask, fw, fh, topF, rows),
          profileOf(maskInf.personMask,  mw, mh, topB, Math.round(rows*1.9))) : null;
        fitFull = tryRows(chinRows * 2);       // 정수리→어깨까지 옆선 전체
        fitTop  = tryRows(earRows);            // 정수리 구간만(숱 오염이 제일 적다)
        const cand = [fitFull, fitTop].filter(Boolean);
        if(cand.length){
          fit = cand.reduce((a,c)=> c.err < a.err ? c : a);
          fit.which = (fit === fitFull) ? '옆선 전체' : '정수리 구간';
        }
      }
      const useV = !!fit && typeof frontLm.earY === 'number';
      let earPx, frontSpan, rowRule;
      if(pe){
        earPx = { l: pe.lEarX*mw, r: pe.rEarX*mw, row: pe.earY*mh, span: (pe.rEarX-pe.lEarX)*mw, src:'pose' };
        frontSpan = Math.abs(frontLm.rEarX - frontLm.lEarX) * fw;   // 귀 앵커면 정면도 귀 간격
        rowRule = 'pose';
      } else if(useV){
        const k = fit.s;                                      // 후면 픽셀 / 정면 픽셀
        const earRowB = topB + (frontLm.earY*fh - topF) * k;  // 정면 귀높이를 그 자로 옮김
        const spanB   = Math.abs(frontLm.rEarX - frontLm.lEarX) * fw * k;
        /* 귀의 <b>좌우 중심</b>은 그 높이 실루엣의 중심에서 잡는다(머리는
           실루엣 한가운데 있다). 폭은 위에서 옮겨 온 값이라 숱과 무관. */
        const rowB = rowSpanOf(maskInf.personMask, mw,
                       Math.max(0, Math.min(mh-1, Math.round(earRowB))));
        const cx = rowB ? (rowB.l + rowB.r) / 2 : mw/2;
        earPx = { l: cx - spanB/2, r: cx + spanB/2, row: earRowB, span: spanB, src:'silhouette-fit' };
        frontSpan = Math.abs(frontLm.rEarX - frontLm.lEarX) * fw;
        rowRule = 'profile';
        const q = fit.err < 0.02 ? '아주 잘 맞음' : fit.err < 0.05 ? '맞음'
                : fit.err < 0.10 ? '⚠ 헐거움' : '⚠⚠ 앞뒤 실루엣이 안 닮음';
        console.log(`[앵커·실루엣맞춤] ${angle}: 배율 ×${k.toFixed(3)} · 잔차 ${(fit.err*100).toFixed(1)}% (${q})`
          + ` · 채택 ${fit.which} (${fit.n}행 대조)`
          + (fitFull && fitTop ? ` · 옆선전체 ×${fitFull.s.toFixed(3)}/${(fitFull.err*100).toFixed(1)}%`
              + ` vs 정수리 ×${fitTop.s.toFixed(3)}/${(fitTop.err*100).toFixed(1)}%` : '')
          + `\n    귀높이 y ${(earRowB/mh).toFixed(3)} (정면 실측 ${frontLm.earY.toFixed(3)}를 옮김) · 귀 간격 ${(spanB/mw).toFixed(3)}`
          + (earB ? ` · 예전 최대폭 자였다면 y ${(earB.earRow/mh).toFixed(3)} / 간격 ${(earB.span/mw).toFixed(3)}` : '')
          + `\n    잔차 기준(하네스 실측): 실루엣이 진짜 닮으면 1% 미만으로 떨어지고 배율 오차 0.2%. 8%를 넘으면 앞뒤 숱이 달라 배율을 믿을 수 없습니다.`);
      } else {
        earPx = earB ? { l: earB.earL, r: earB.earR, row: earB.earRow, span: earB.span, src:'silhouette' } : null;
        frontSpan = earF ? earF.span : 0;
        rowRule = 'width';
        console.warn(`[앵커·실루엣맞춤] ${angle}: 옆선 대조 실패 — 예전 최대폭 자로 폴백`
          + (headRows > 24 ? '' : ' · 정면 턱 랜드마크가 없어 비교 구간을 못 정함')
          + (typeof frontLm.earY === 'number' ? '' : ' · 정면 귀높이 랜드마크 없음'));
      }
      if(earPx && earPx.span > 4 && frontSpan > 4 && topB >= 0 && topF >= 0){
        // 정면 실측 비율(프레이밍 무관): 정수리→눈/턱 거리 ÷ 귀 간격
        const rEye  = (frontLm.eyeY*fh  - topF) / frontSpan;
        const rChin = (frontLm.chinY*fh - topF) / frontSpan;
        const eyeY  = (topB + rEye  * earPx.span) / mh;
        const chinY = (topB + rChin * earPx.span) / mh;
        result = {
          eyeY, chinY,
          browTopY: Math.max(0, eyeY - (frontLm.eyeY - frontLm.browTopY)), // 정면 실측 간격 재사용
          earY: earPx.row / mh,
          foreheadY: Math.max(0, eyeY - (frontLm.eyeY - frontLm.foreheadY)),
          lEarX: earPx.l / mw, rEarX: earPx.r / mw,
          _silhouette: true, _anchorSrc: earPx.src, _rowRule: rowRule, // [진단용]
        };
      }
    }
  }catch(e){ console.warn('실루엣 앵커 계산 실패:', angle, e); }
  _silhouetteAnchorCache[angle] = result;
  return result;
}

// 사진 한 장의 정규화 좌표(nx,ny 0~1)를 실제 두상 표면 3D 좌표로 투영.
// 1) makeFaceProjector로 "그 뷰가 정면을 보고 있다고 가정했을 때"의 로컬
//    평면 좌표(localX,localY)를 구함(뷰마다 자기 랜드마크 기준이라 재사용 가능).
// 2) 로컬 좌표가 두상 타원면 위에 있다고 보고 localZ를 방정식으로 풀어냄
//    (카메라를 향한 쪽 = +Z해를 선택).
// 3) 그 뷰의 실측 회전(yaw/pitch/roll, PnP 결과)을 로컬 좌표에 실제로 적용해서
//    월드(두상 전체 기준) 좌표로 회전 — 이 부분이 기존엔 없었음(yaw 각도를
//    "어느 섹션이 이 뷰에 가까운가" 가중치 계산에만 쓰고, 실제 좌표 회전에는
//    한 번도 안 썼음). 왼쪽/오른쪽 사진이 실측으로 서로 다른 부호의 회전을
//    갖게 되므로, 예전에 걱정했던 "좌우反전 위험"이 추측이 아니라 실측값으로
//    해소됨.
// (2026-07-16) opts 추가 — "2D 헤어·두피 좌표 그대로 옮기기"용:
//   opts.hangZ    : 점이 두피 타원 밖(머리 실루엣 아래로 늘어진 구간)이어도
//                   버리지 않고, 넘겨준 카메라공간 깊이(z)로 그대로 배치.
//                   호출부(buildHairStrandsFromPaths)가 "이 가닥에서 마지막으로
//                   두피면 위에 있었던 점의 깊이"를 넘겨서, 늘어진 머리가
//                   두피에서 떨어지는 지점의 깊이를 유지한 채 이미지 그대로의
//                   모양으로 내려가게 함(예전엔 이 구간이 전부 null로 잘려서
//                   경로가 끊기고, 나머지는 타원면을 따라 감겨 우산/버섯 모양이 됐음).
//   opts.clampRim : 타원 살짝 밖(실루엣 가장자리 컬럼의 뿌리)을 z=0(림 평면)에
//                   붙임 — 가장자리 뿌리가 통째로 버려지지 않게.
//   opts.usedZ    : (출력) 이번 점에 실제 사용된 카메라공간 z — 호출부가
//                   다음 점의 hangZ로 이어받음.
// opts 없이 부르면 기존 동작과 완전히 동일(다른 호출부 영향 없음).
function projectImagePointToHead(angle, nx, ny, widthFactor, heightFactor, opts){
  // (2026-07-14, 후면 실루엣 앵커) 실측 랜드마크가 없으면 지어낸 고정값
  // (getEstimatedLandmarks) 전에 실루엣 실측 앵커(귀+정수리, 아래 함수)를
  // 먼저 시도 — 사용자 설계: "후면 사진 앵커 귀와 정수리 등으로 잡아".
  const lm = (state.landmarks && state.landmarks[angle]) || computeSilhouetteAnchors(angle) || getEstimatedLandmarks(angle);
  if(!lm) return null;
  const wf = widthFactor || 1, hf = heightFactor || 1;
  const proj = makeFaceProjector(lm, wf, hf);
  const localX = proj.toMeshX(nx);
  const localY = proj.toMeshY(ny);

  // 버그 수정(2026-07-14, 계속): 실기기에서 "정면/측면 헤어가 두상 밖으로
  // 튀어나와 보인다" 피드백 — buildRealFaceMesh에서 고쳤던 것과 정확히
  // 같은 원인이었음. 여기(헤어 실측 투영)는 여전히 고정 타원 상수(a=0.78wf,
  // c=0.85wf)로 Z를 풀고 있었는데, 실제로 화면에 그려지는 두상(buildHeadMesh)
  // 은 이미 "★★ 타원체 완전 제거" 항목에서 이 사람 실측 단면 기반 메쉬로
  // 바뀐 지 오래라 — 그 실측 폭/깊이가 고정 0.78/0.85보다 좁으면, 이 함수가
  // 계산한 헤어 뿌리·끝점이 실제 두상 표면보다 바깥에 놓여 "머리가 두상보다
  // 붕 떠서 튀어나온" 것처럼 보임. 위 얼굴 메쉬 수정 때 남겨둔 "다음 단계
  // 후보"(두상 표시와 헤어/얼굴 위치 계산의 두상 모양 기준이 서로 다르다)가
  // 바로 이거였음 — 이번에 같은 방식으로 통일.
  // 수정: 고정 상수 대신 buildHeadMesh와 동일한 데이터 출처(이 사람의 실측
  // 적도=눈높이 단면, interpolateHeadCrossSection(π/2))로 a/c를 계산 — 얼굴
  // 메쉬에 적용한 것과 동일한 보정.
  // (2026-07-14) 세로축 b: 1×hf(임의) → 실측 세로 반지름 — 헤어 뿌리를 놓는
  // 이 면이 두상 돔(두피면)과 정의상 같은 면이 되도록 정렬. 뿌리의 높이는
  // 사진 픽셀(toMeshY)에서 오므로 이 변경으로 헤어 높이가 움직이진 않고,
  // 정수리 근처 뿌리가 두피 표면에 정확히 붙게 되는 것만 달라짐.
  const { a, b, c } = getHeadEllipsoid(); // 두상 타원 반경(x,y,z)
  const yLocal = localY - 0.15; // 타원 중심(0,0.15,0) 기준으로 이동
  const inside = (localX/a)*(localX/a) + (yLocal/b)*(yLocal/b);
  let localZ;
  if(inside <= 0.98){
    localZ = c * Math.sqrt(Math.max(0, 1 - inside)); // 두피면 위: 카메라를 향한 쪽(+Z) 해 — 이 점의 "두피 3D 좌표"
  } else if(opts && typeof opts.hangZ === 'number'){
    localZ = opts.hangZ; // 두피면 밖(늘어진 구간): 마지막 두피 깊이를 유지한 채 이미지 좌표 그대로 배치
  } else if(opts && opts.clampRim && inside <= 1.2){
    localZ = 0; // 실루엣 가장자리 뿌리: 림 평면에 붙임
  } else {
    return null; // 타원 밖(귀/윤곽 밖 극단치) — 이 픽셀은 투영 포기 (기존 동작)
  }
  if(opts) opts.usedZ = localZ;

  // (2026-07-26) pitch/roll도 0 고정이 아니라 yaw와 같은 폴백 체인을 탄다 —
  // 랜드마크 실패 뷰라도 셔터 직전 라이브 실측이 있으면 3축 모두 그 값을 쓴다.
  const yawRad   = (lm.poseYawDeg   ?? getViewYawDeg(angle))   * Math.PI/180;
  const pitchRad = (lm.posePitchDeg ?? getViewPitchDeg(angle)) * Math.PI/180;
  const rollRad  = (lm.poseRollDeg  ?? getViewRollDeg(angle))  * Math.PI/180;
  const rot = composeRotationZYX(yawRad, pitchRad, rollRad);

  // ── 회전 방향 버그 수정(2026-07-14, "우산처럼 벌어진 헤어"의 원인) ──
  // 기존엔 applyRotation3(rot, …) 즉 포즈 행렬 R을 정방향으로 적용했는데,
  // R은 "두상(캐노니컬) 공간 → 카메라 공간" 방향이고 localX/yLocal/localZ는
  // 사진에서 읽은 "카메라 공간" 좌표라, 두상 공간으로 가려면 역회전(R^T)이
  // 맞음. yaw만 클 땐 티가 덜 났지만 pitch/roll이 섞이면(폰을 살짝 내려/
  // 기울여 찍는 자연스러운 자세) 뷰마다 반대 방향으로 뿌리가 벌어져 정수리
  // 위에 우산처럼 퍼지는 모양이 됨 — 실기기 스크린샷과 일치.
  // 검증(합성 실험, verify_rotation_direction.js): 정답을 아는 합성 두상을
  // 실측 포즈(정면 -2.8/-7.6/-1.2, 좌 50.7/-18.5/-18.6, 우 -57.8/-19.2/26.3)로
  // 촬영→복원했을 때 측면 뷰에서 역회전이 5~6배 정확했고, 포즈 그리드
  // 스윕(yaw ±60, pitch -25~0, roll ±25, 2293점)에서도 평균 오차
  // 0.42→0.19(최악 1.13→0.55)로 역회전이 최선(yaw만 적용하는 변형들보다도
  // 나음). 잔여 오차 ~0.19는 회전이 아니라 프로젝터의 앵커(귀 간격 등)
  // 보정 한계에서 옴 — 별도 항목.
  const rotated = applyRotationTranspose3(rot, new THREE.Vector3(localX, yLocal, localZ));
  rotated.y += 0.15; // 중심 오프셋 복원
  return rotated;
}

// ── [진단용] 가닥 뿌리 기준면(가상 타원체) 시각화 (2026-07-14 추가) ──
// 사용자 아이디어: "헤어들이 만나서 가상의 타원 하나가 생겨야 되잖아? 그
// 가상의 타원을 3D 이미지에 그려 넣으면 어느 쪽이 문제인지 알 수 있지 않을까"
// — 실기기에서 두상(안면 메쉬)은 제자리인데 헤어 가닥들만 떠 있는 문제의
// 원인 분리용. 가닥 뿌리는 두 경로로 배치됨:
//   (1) 실측 투영 경로: projectImagePointToHead(위)가 푸는 가상 타원체
//       (a=적도 실측 halfWidth, b=1×heightFactor, c=적도 실측 halfDepth,
//       중심 y=0.15) 표면 — 이 함수가 그리는 것이 바로 이 타원체.
//   (2) 합성 폴백 경로: scalpPointToWorld(phi별 실측 단면) — 이건 두상
//       메쉬(buildHeadMesh)와 같은 면이라 두상 자체가 기준면 역할을 함.
// 따라서 이 타원체(하늘색 와이어프레임)를 그렸을 때:
//   - 타원체가 두상과 잘 겹치는데 가닥만 떠 있다 → 투영 계산(포즈 회전/
//     랜드마크 프로젝터) 쪽 문제
//   - 타원체 자체가 두상과 어긋나 있다 → 타원체 모델(a/b/c/중심) 자체가
//     두상 메쉬와 안 맞는 것 (예: b=1×heightFactor는 위아래 대칭인데 실제
//     두상 메쉬는 y=0.15 중심에서 위로 1.0, 아래로 cos(PHI_MAX)≈0.70까지라
//     아래쪽 반이 두상보다 김 — 그려보면 바로 보임)
// a/b/c/중심 계산식은 projectImagePointToHead와 글자 단위로 동일하게 유지할 것
// (여기가 달라지면 진단 자체가 무의미해짐).
function buildStrandProjectionEllipsoidDebug(){
  // (2026-07-14) heightFactor 인자 제거 — 세로축이 실측 반지름으로 바뀌면서 미사용
  /* (2026-08-17 c) <b>두 면을 같이</b> 그린다. 예전엔 헐 하나만 하늘색으로 나왔는데,
     "헤어가 제대로 얹혔나"는 원리상 한 면으로는 판정이 안 된다 — 가닥은 두피면과
     헐 <b>사이</b>에 있어야 하고, 이번 버그가 정확히 그 사이 공간이 화면의 살구색
     구에 먹힌 것이었다. 하늘색(헐, 바깥) 안에 초록(두피면, 안쪽)이 보이고 그 틈에
     가닥이 차 있으면 정상. 초록이 하늘색과 겹쳐 보이면 모발 두께가 0으로 붕괴한
     것이고([두피면] 로그의 "모발 두께" cm와 같은 이야기를 눈으로 보는 것이다). */
  const group = new THREE.Group();
  group.name = 'strandEllipsoidDebug';   // 토글이 이 이름을 찾는다(Group.visible이 자식까지 끈다)
  const shell = (ell, color, opacity)=>{
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16),
      new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity }));
    mesh.scale.set(ell.a, ell.b, ell.c);
    mesh.position.set(0, 0.15, 0); // 타원 중심(0,0.15,0) — projectImagePointToHead의 중심 오프셋과 동일
    return mesh;
  };
  group.add(shell(getHeadEllipsoid(), 0x4FC3F7, 0.30));   // 헐(머리카락 겉면) — 기존 하늘색 유지
  try{ group.add(shell(getScalpEllipsoid(), 0x7BE38A, 0.45)); }catch(e){}  // 두피면(뿌리가 놓이는 면)
  return group;
}

// 3D 화면의 "기준면 보기" 토글 — 기본 꺼짐(일반 사용자용 화면을 어지럽히지
// 않기 위함), 켜면 위 가상 타원체가 하늘색 와이어프레임으로 표시됨.
function toggleStrandDebug(){
  state.debugShowStrandSurface = !state.debugShowStrandSurface;
  const btn = document.getElementById('strandDebugToggle');
  if(btn){
    btn.textContent = state.debugShowStrandSurface ? '기준면 숨기기' : '기준면 보기';
    btn.classList.toggle('on', state.debugShowStrandSurface);
  }
  if(model3D && model3D.initialized){
    const m = model3D.headGroup.getObjectByName('strandEllipsoidDebug');
    if(m) m.visible = state.debugShowStrandSurface;
  }
}


// ── 2D 가닥 경로를 3D로 들어올려 렌더(현재 방식) ──
// 사용자 설계: "2D 렌더링이 끝나면 그 점들을 3D 좌표로 옮겨서 렌더하면 된다".
// 절차 생성 방식(섹션별로 3D에서 새로 심기)
// 대신, 조정 화면에서 실제로 그려진(사용자가 눈으로 확인한) 가닥 경로의
// 점들을 projectImagePointToHead로 각각 3D화해서 가는 선(LineSegments)으로
// 그림. 모양·길이·색(실측 팔레트)·컬이 2D와 정의상 일치. 경로 캡처가 없으면
// null을 반환하고 호출부가 기존 절차 생성으로 폴백(동작 보존).
// (2026-07-16) 3D 진입 시, 아직 캡처 안 된 뷰의 2D 가닥 경로를 오프스크린
// 렌더로 확보 — "2D 헤어·두피의 3D 좌표를 산출해서 그대로 옮긴다"가 네 뷰
// 전부에서 성립하도록. (기존엔 사용자가 조정 화면에서 실제로 열어본 뷰만
// 캡처돼 있어서, 안 열어본 뷰는 절차 생성 폴백과 섞였음.) 렌더 조건·옵션은
// renderFrame의 가닥 호출과 동일하게 맞춤(rawMode 아님) — 화면에 그려질
// 그 가닥과 같은 것이 캡처됨. 캔버스 크기도 DRAW_RES(1200) 동일.
function captureStrandPathsFor(angle, rawMode){
  return new Promise(resolve=>{
    const maskInf = state.hairMasks && state.hairMasks[angle];
    const hairC = state.hairCanvases && state.hairCanvases[angle];
    if(!maskInf || !maskInf.scalpY || !hairC){ resolve(false); return; }
    getCachedImg(angle, (img)=>{
      if(!img){ resolve(false); return; }
      try{
        const validCount = countValidCols(maskInf.scalpY);
        if(validCount <= maskInf.w * 0.05){ resolve(false); return; }
        const canvas = document.createElement('canvas');
        canvas.width = DRAW_RES;
        canvas.height = Math.round(DRAW_RES * img.height / img.width);
        const ctx = canvas.getContext('2d');
        const fit = computeFit(img.width, img.height, canvas.width, canvas.height);
        // (11차) rawMode=true면 중립(길이 기본·컬0) 캡처 — 3D 조정 연산자의 소스.
        drawHairStrands(ctx, fit, maskInf.scalpY, maskInf.hairEndY, maskInf.w, maskInf.h, hairC,
          buildStrandOpts(maskInf, angle, !!rawMode));
        resolve(!!(state.strandPaths && state.strandPaths[angle] && state.strandPaths[angle].strands.length));
      }catch(e){ console.warn('오프스크린 가닥 캡처 실패('+angle+'):', e); resolve(false); }
    });
  });
}


/* ==========================================================================
 * BODY_DRAPE v2 — 3D 결과 화면에서 머리를 몸·옷 겉면 위로 "닿은 듯 살짝 띄워" 늘어뜨림
 * (읽을 수 있는 코드로 13a 끝에 덧붙임)
 *
 * 순서
 *  1) 몸 겉면 → 거리장(SDF)
 *     장면의 bodyBaseRig(맨몸+옷) 삼각형을 머리 좌표계로 옮겨, x·y 칸마다 앞(ZF)·뒤(ZB)
 *     z를 기록 → 그 사이를 "몸 안"으로 채운 3D 칸(복셀)을 만들고, 칸마다 겉면까지의
 *     거리(밖 +, 안 −)를 잽니다. 그 다음 흐리게 해서 라펠·주머니·깃 같은 잔굴곡을
 *     지우고 몸의 큰 모양만 남깁니다. 기울기 = 겉면이 향한 방향(어깨는 위, 옆구리는 옆).
 *  2) 가닥 다시 잇기
 *     선분 쌍에서 끝=시작이면 같은 가닥. 결과 화면 선분 거르기로 중간이 빠져 끊긴
 *     조각도, 바로 앞 조각 끝에서 가깝고 아래로 이어지면 같은 가닥으로 봅니다.
 *  3) 선으로 밀기(점마다 붙이지 않음)
 *     ① 점마다 "겉면에서 margin 만큼 밖"까지 필요한 이동량만 계산(방향 = 거리장 기울기,
 *        몸 깊숙이 든 점은 가닥이 처음 몸에 들어간 자리의 방향을 그대로 씀 → 앞뒤가 섞이지 않음)
 *     ② 이동량을 가닥을 따라 부드럽게 퍼뜨림 → 원래 가닥에 더함(웨이브·컬 굴곡이 그대로 남음)
 *     ③ 뿌리부터 마디 길이를 원래대로 → 밀려난 만큼 늘어나지 않고 아래로 흘러내림
 *     ①~③을 몇 번 반복, 마지막에 남은 침범만 작게 한 번 더 밀어 마무리.
 *  4) 결과 화면에서는 BODY_OUT(고정 단면으로 z만 미는 옛 처리)을 쓰지 않습니다
 *     — 두 처리가 서로 다른 몸 모양·앞뒤 판단으로 두 번 밀던 것을 하나로.
 *
 * 원본 좌표를 보관해 몸·옷·머리가 바뀔 때마다 원본에서 다시 계산(누적 없음).
 * 끄기: BODY_DRAPE.on=false; BODY_DRAPE.refresh()   상태: BODY_DRAPE.lines()
 * ========================================================================== */
// 17a의 잔머리 정리(FLY_TRIM)를 끔 — 17a보다 먼저 로드되므로 기본값을 미리 넣어 둠.
// (결과 화면 '선분 거르기'가 렌더 때마다 머리 버퍼를 그 자리에서 고쳐 BODY_DRAPE와 엇갈리던 것)
// 다시 켜기: 콘솔에서 FLY_TRIM.on=true; FLY_TRIM.refresh()
window.FLY_TRIM = Object.assign({ on: false }, window.FLY_TRIM || {});
var BODY_DRAPE = (function () {
  'use strict';
  var TAG = '[몸 위로 늘어뜨리기]';
  var C = Object.assign({
    on: true,
    vox: 0.05,          // 복셀 크기(모델 단위 ≈ 0.95cm)
    xMax: 2.2,          // 좌우 반폭(팔까지)
    zMax: 1.3,          // 앞뒤 반깊이
    depth: 4.6,         // 목 밑동 아래로 볼 깊이
    above: 0.0,         // 목 밑동 위로는 안 봄(머리·목은 다른 처리 몫)
    blur: 2,            // 거리장 흐리기 횟수(클수록 잔굴곡이 사라짐)
    margin: 0.03,       // 겉면에서 띄울 거리 ≈ 0.6cm — "닿은 듯"
    iters: 4,           // ①~③ 반복
    smoothPts: 3,       // 이동량 퍼뜨리기 반폭(점 수)
    deepAt: -0.06,      // 이보다 깊이 든 점은 처음 들어간 자리의 방향으로 밂
    joinGap: 0.12,
    sideDamp: 0.35,     // 옆(x)으로 미는 몫 줄임 — 어깨에서 팔 쪽으로 미끄러지지 않고 앞/뒤로
    sideBias: 0.8,      // 어깨 윗면에서 정해진 쪽(앞/뒤)으로 기울이는 세기
    centerBand: 0.3,
    frontMin: 0.0,      // 원래 늘어지던 자리(목 아래 평균)가 몸통 가운데보다 이만큼 앞이면 앞으로    // |x|가 이보다 크면 옆머리 — 사진에서 앞으로 넘긴 쪽이면 앞      // 끊긴 조각 다시 잇기 거리
    replaceBodyOut: true,
    pollMs: 300,
    budgetMs: 12,       // 한 번에 쓰는 시간(ms) — 넘으면 다음 틈에 이어서
    log: true
  }, window.BODY_DRAPE || {});
  var S = C.stats = { newSrc: 0, reused: 0, strands: 0, joined: 0, touched: 0, pts: 0, left: 0, vox: 0, ms: 0, sdfMs: 0, err: null };
  var F = null, fieldSig = '', pendSig = '', applied = new WeakMap(), ver = 1, busy = false;

  function screen() { try { return currentScreen; } catch (e) { return ''; } }
  function headGroup() { try { return model3D && model3D.headGroup; } catch (e) { return null; } }

  /* ---------------- 장면 ---------------- */
  function findHairs(hg) {
    var out = [];
    hg.traverse(function (o) {
      if (o.visible === false) return;
      if ((o.name === 'adjustedHair' || o.name === 'hairStrands') && (o.isLineSegments || o.isLine) &&
          o.geometry && o.geometry.attributes && o.geometry.attributes.position) out.push(o);
    });
    return out;
  }
  function bodyMeshes(rig) {
    var out = [];
    rig.traverse(function (o) {
      if (!o.isMesh || !o.geometry || !o.geometry.attributes || !o.geometry.attributes.position) return;
      for (var p = o; p && p !== rig; p = p.parent) if (p.visible === false) return;
      var mats = Array.isArray(o.material) ? o.material : [o.material];
      for (var i = 0; i < mats.length; i++) if (mats[i] && (mats[i].name || '').toLowerCase() === 'hair') return;
      out.push(o);
    });
    return out;
  }

  /* ---------------- 1) 거리장 ---------------- */
  // 삼각형을 x·y 칸 기둥으로 찍어 앞/뒤 z 범위를 얻음
  // obj → hg 상대 행렬을 각 노드의 '로컬' 행렬만으로 곱해 만듦.
  // matrixWorld는 마지막 렌더 때 값이라, 옷을 막 바꾼 뒤(새 몸/옷이 아직 한 번도 안 그려짐)에는
  // 머리는 지금 돌려 본 각도, 몸은 회전 없는 자리로 서로 어긋나 거리장이 보는 각도마다 달라졌음.
  function relTo(obj, hg) {
    var M = new THREE.Matrix4(), T = new THREE.Matrix4();
    for (var o = obj; o && o !== hg; o = o.parent) {
      if (o.matrixAutoUpdate) o.updateMatrix();
      T.copy(o.matrix); M.premultiply(T);
    }
    return M;
  }
  function columnSpans(meshes, toLocal, g, hg) {
    var NX = g.NX, NY = g.NY, v = g.vox;
    var ZF = new Float32Array(NX * NY).fill(-Infinity), ZB = new Float32Array(NX * NY).fill(Infinity);
    var M = new THREE.Matrix4(), q = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    function put(x, y, z) {
      var ix = ((x - g.x0) / v) | 0, iy = ((y - g.y0) / v) | 0;
      if (ix < 0 || iy < 0 || ix >= NX || iy >= NY || x < g.x0 || y < g.y0) return;
      var k = iy * NX + ix; if (z > ZF[k]) ZF[k] = z; if (z < ZB[k]) ZB[k] = z;
    }
    meshes.forEach(function (mesh) {
      M.multiplyMatrices(toLocal, relTo(mesh, hg));
      var e = M.elements, G = mesh.geometry, P = G.attributes.position, I = G.index, n = I ? I.count : P.count;
      for (var t = 0; t + 2 < n; t += 3) {
        for (var j = 0; j < 3; j++) {
          var vi = I ? I.getX(t + j) : t + j, x = P.getX(vi), y = P.getY(vi), z = P.getZ(vi);
          q[j * 3] = e[0] * x + e[4] * y + e[8] * z + e[12];
          q[j * 3 + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
          q[j * 3 + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
        }
        if (Math.max(q[1], q[4], q[7]) < g.y0 || Math.min(q[1], q[4], q[7]) > g.y1) continue;
        var L = Math.max(Math.hypot(q[3] - q[0], q[4] - q[1], q[5] - q[2]), Math.hypot(q[6] - q[0], q[7] - q[1], q[8] - q[2]), Math.hypot(q[6] - q[3], q[7] - q[4], q[8] - q[5]));
        var N = Math.max(1, Math.min(48, Math.ceil(L / (v * 0.5))));
        for (var a = 0; a <= N; a++) for (var b = 0; b <= N - a; b++) {
          var u = a / N, w = b / N, r = 1 - u - w;
          put(q[0] * r + q[3] * u + q[6] * w, q[1] * r + q[4] * u + q[7] * w, q[2] * r + q[5] * u + q[8] * w);
        }
      }
    });
    return { ZF: ZF, ZB: ZB };
  }
  // 앞/뒤 범위 → 몸 안 복셀 → 부호 있는 거리(밖 +) → 흐리기
  function buildField(spans, g) {
    var NX = g.NX, NY = g.NY, NZ = g.NZ, v = g.vox, N = NX * NY * NZ;
    var inside = new Uint8Array(N);
    for (var iy = 0; iy < NY; iy++) for (var ix = 0; ix < NX; ix++) {
      var k = iy * NX + ix, zf = spans.ZF[k], zb = spans.ZB[k];
      if (zf === -Infinity) continue;
      var a = Math.max(0, Math.floor((zb - g.z0) / v)), b = Math.min(NZ - 1, Math.floor((zf - g.z0) / v));
      for (var iz = a; iz <= b; iz++) inside[(iz * NY + iy) * NX + ix] = 1;
    }
    // 빈 기둥 메우기(칸 사이 틈) — 좌우·위아래 이웃 두 곳 이상이 안이면 안
    var fill = inside.slice();
    for (var iz2 = 0; iz2 < NZ; iz2++) for (iy = 1; iy < NY - 1; iy++) for (ix = 1; ix < NX - 1; ix++) {
      var id = (iz2 * NY + iy) * NX + ix; if (inside[id]) continue;
      if (inside[id - 1] + inside[id + 1] + inside[id - NX] + inside[id + NX] >= 3) fill[id] = 1;
    }
    inside = fill;
    var mid = new Float32Array(NX * NY).fill(NaN);
    for (var km = 0; km < NX * NY; km++) if (spans.ZF[km] > -Infinity) mid[km] = (spans.ZF[km] + spans.ZB[km]) / 2;
    var dOut = chamfer(inside, 1, g), dIn = chamfer(inside, 0, g), sdf = new Float32Array(N), cnt = 0;
    for (var i = 0; i < N; i++) { sdf[i] = (inside[i] ? -(dIn[i] - 0.5) : (dOut[i] - 0.5)) * v; if (inside[i]) cnt++; }
    var raw = sdf;
    for (var bI = 0; bI < C.blur; bI++) sdf = boxBlur(sdf, g);
    return { g: g, sdf: sdf, raw: raw, inside: cnt, mid: mid };
  }
  // 3D 챔퍼 거리(3-4-5 근사, 칸 단위). target=1이면 "안 칸까지 거리", 0이면 "밖 칸까지 거리"
  function chamfer(inside, target, g) {
    var NX = g.NX, NY = g.NY, NZ = g.NZ, N = NX * NY * NZ, BIG = 1e6, d = new Float32Array(N);
    for (var i = 0; i < N; i++) d[i] = inside[i] === target ? 0 : BIG;
    var offs = [];
    for (var dz = -1; dz <= 1; dz++) for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
      var s = Math.abs(dx) + Math.abs(dy) + Math.abs(dz); if (!s) continue;
      offs.push([dx, dy, dz, s === 1 ? 1 : s === 2 ? 1.4142 : 1.7321]);
    }
    var fwd = offs.filter(function (o) { return o[2] < 0 || (o[2] === 0 && (o[1] < 0 || (o[1] === 0 && o[0] < 0))); });
    var bwd = offs.filter(function (o) { return fwd.indexOf(o) < 0; });
    function pass(list, z0, z1, st) {
      for (var z = z0; z !== z1; z += st) for (var y = st > 0 ? 0 : NY - 1; y >= 0 && y < NY; y += st) for (var x = st > 0 ? 0 : NX - 1; x >= 0 && x < NX; x += st) {
        var id = (z * NY + y) * NX + x, best = d[id]; if (!best) continue;
        for (var k = 0; k < list.length; k++) {
          var o = list[k], xx = x + o[0], yy = y + o[1], zz = z + o[2];
          if (xx < 0 || yy < 0 || zz < 0 || xx >= NX || yy >= NY || zz >= NZ) continue;
          var c = d[(zz * NY + yy) * NX + xx] + o[3]; if (c < best) best = c;
        }
        d[id] = best;
      }
    }
    pass(fwd, 0, NZ, 1); pass(bwd, NZ - 1, -1, -1);
    return d;
  }
  function boxBlur(a, g) {
    var NX = g.NX, NY = g.NY, NZ = g.NZ, b = new Float32Array(a.length), c = new Float32Array(a.length);
    var axes = [[1, NX], [NX, NY], [NX * NY, NZ]], src = a, dst = b;
    for (var ax = 0; ax < 3; ax++) {
      var st = axes[ax][0], n = axes[ax][1];
      for (var i = 0; i < src.length; i++) {
        var pos = ((i / st) | 0) % n, s = src[i], w = 1;
        if (pos > 0) { s += src[i - st]; w++; } if (pos < n - 1) { s += src[i + st]; w++; }
        dst[i] = s / w;
      }
      src = dst; dst = ax === 0 ? c : (ax === 1 ? b : c);
    }
    return src;
  }
  // 거리·기울기(삼선형 보간). 범위 밖이면 null
  var _gr = [0, 0, 0], _useRaw = false;
  function sample(x, y, z) {
    var g = F.g, v = g.vox;
    var fx = (x - g.x0) / v - 0.5, fy = (y - g.y0) / v - 0.5, fz = (z - g.z0) / v - 0.5;
    if (fx < 0 || fy < 0 || fz < 0 || fx >= g.NX - 1 || fy >= g.NY - 1 || fz >= g.NZ - 1) return null;
    var ix = fx | 0, iy = fy | 0, iz = fz | 0, tx = fx - ix, ty = fy - iy, tz = fz - iz;
    var NX = g.NX, NXY = NX * g.NY, s = _useRaw ? F.raw : F.sdf, i0 = (iz * g.NY + iy) * NX + ix;
    var c000 = s[i0], c100 = s[i0 + 1], c010 = s[i0 + NX], c110 = s[i0 + NX + 1];
    var c001 = s[i0 + NXY], c101 = s[i0 + NXY + 1], c011 = s[i0 + NXY + NX], c111 = s[i0 + NXY + NX + 1];
    var x00 = c000 + (c100 - c000) * tx, x10 = c010 + (c110 - c010) * tx, x01 = c001 + (c101 - c001) * tx, x11 = c011 + (c111 - c011) * tx;
    var y0 = x00 + (x10 - x00) * ty, y1 = x01 + (x11 - x01) * ty, d = y0 + (y1 - y0) * tz;
    var gx = ((c100 - c000) * (1 - ty) + (c110 - c010) * ty) * (1 - tz) + ((c101 - c001) * (1 - ty) + (c111 - c011) * ty) * tz;
    var gy = (x10 - x00) * (1 - tz) + (x11 - x01) * tz, gz = y1 - y0, L = Math.hypot(gx, gy, gz);
    if (L < 1e-9) { _gr[0] = 0; _gr[1] = 0; _gr[2] = 0; } else { _gr[0] = gx / L; _gr[1] = gy / L; _gr[2] = gz / L; }
    return d;
  }

  /* ---------------- 3) 선으로 밀기 ---------------- */
  var _L0 = new Float32Array(1024), _dx = new Float32Array(1024), _dy = new Float32Array(1024), _dz = new Float32Array(1024);
  var _px = new Float32Array(1024), _py = new Float32Array(1024), _pz = new Float32Array(1024);
  function drapeStrand(px, py, pz, n) {
    var g = F.g, m = C.margin, yTop = g.y1, any = false, i, it;
    for (i = 0; i < n; i++) if (py[i] < yTop) { any = true; break; }
    if (!any) return false;
    if (_L0.length < n) { _L0 = new Float32Array(n * 2); _dx = new Float32Array(n * 2); _dy = new Float32Array(n * 2); _dz = new Float32Array(n * 2); }
    var L0 = _L0;
    for (i = 1; i < n; i++) L0[i] = Math.hypot(px[i] - px[i - 1], py[i] - py[i - 1], pz[i] - pz[i - 1]);
    var dx = _dx, dy = _dy, dz = _dz, hit = false;
    var entry = null;                                         // 처음 몸에 들어간 자리의 바깥 방향
    var side = strandSide(px, py, pz, n);                     // +1 앞 · −1 뒤
    for (it = 0; it <= C.iters + 1; it++) {              // 마지막 두 회 = 마무리
      var last = it >= C.iters, need = 0;
      _useRaw = last;                                     // 마무리는 흐리지 않은 실제 겉면 기준 — 볼록한 어깨·라펠에서 묻히지 않게
      // ① 점마다 필요한 이동량
      for (i = 1; i < n; i++) {
        dx[i] = dy[i] = dz[i] = 0;
        if (py[i] >= yTop) continue;
        var d = sample(px[i], py[i], pz[i]); if (d === null || d >= m) continue;
        var nx = _gr[0], ny = _gr[1], nz = _gr[2];
        if (!entry && d > C.deepAt && (nx || ny || nz)) entry = [nx, ny, nz];
        if ((d < C.deepAt || !(nx || ny || nz)) && entry) { nx = entry[0]; ny = entry[1]; nz = entry[2]; }
        if (!(nx || ny || nz)) continue;
        if (!last) {                                          // 마무리 회는 겉면 방향 그대로(남은 침범을 확실히 빼냄)
          nx *= C.sideDamp;
          if (ny > 0) nz += side * C.sideBias * ny;             // 어깨 윗면: 정한 쪽으로 넘어가게
        }
        var nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
        var k = m - d; dx[i] = nx * k; dy[i] = ny * k; dz[i] = nz * k; need++;
        if (it === 0) S.pts++;
      }
      if (!need) break;
      hit = true;
      // ② 가닥을 따라 퍼뜨림(마지막 회는 남은 것만 그대로)
      if (!last && C.smoothPts > 0) { spread(dx, n); spread(dy, n); spread(dz, n); }
      for (i = 1; i < n; i++) { px[i] += dx[i]; py[i] += dy[i]; pz[i] += dz[i]; }
      // ③ 뿌리부터 마디 길이 되돌림 — 밀린 만큼 아래로 흘러내림
      if (!last) for (i = 1; i < n; i++) {
        var ex = px[i] - px[i - 1], ey = py[i] - py[i - 1], ez = pz[i] - pz[i - 1], l = Math.hypot(ex, ey, ez);
        if (l < 1e-9 || !L0[i]) continue;
        var f = L0[i] / l; px[i] = px[i - 1] + ex * f; py[i] = py[i - 1] + ey * f; pz[i] = pz[i - 1] + ez * f;
      }
    }
    _useRaw = true;
    if (hit) for (i = 1; i < n; i++) if (py[i] < yTop) { var dd = sample(px[i], py[i], pz[i]); if (dd !== null && dd < 0) S.left++; }
    _useRaw = false;
    return hit;
  }
  // 가닥이 앞/뒤 어느 쪽으로 갈지: 목 밑동 높이에서의 z가 그 자리 몸통 가운데보다 앞이면 앞.
  // 옆머리(|x|>centerBand)는 사진에서 그쪽을 앞으로 넘겼으면 앞.
  var drapeInfo = null;
  function strandSide(px, py, pz, n) {
    var g = F.g, i, x = px[0], z = pz[0], y = g.y1;
    for (i = 1; i < n; i++) if (py[i] < g.y1) { x = px[i]; z = pz[i]; y = py[i]; break; }
    var own = true;                                           // 사진 인지는 손님 자기 머리일 때만 의미 있음
    try { var sid = state.specAppliedId; own = !sid || sid === '__original__'; } catch (e) {}
    if (own && Math.abs(x) > C.centerBand) {
      try {
        if (!drapeInfo) drapeInfo = SHOULDER.recognize();
        var f = drapeInfo && drapeInfo.front;
        if (f) { var right = (x >= 0) === (drapeInfo.signX > 0), sd = right ? f.R : f.L; if (sd && sd.draped) return 1; }
      } catch (e) {}
    }
    // 가닥이 원래 '어디로 늘어지려 했는지'로 정함: 목 밑동 아래 부분의 평균 z를 그 자리 몸통 가운데와 비교.
    // 한 다발은 끝이 같은 쪽으로 모이므로 다발째 같은 쪽으로 감(말안장·앞머리 벌어짐 방지).
    var sz = 0, sm = 0, cnt = 0;
    for (i = 1; i < n; i++) {
      if (py[i] >= g.y1) continue;
      var jx = Math.max(0, Math.min(g.NX - 1, ((px[i] - g.x0) / g.vox) | 0)), jy = ((py[i] - g.y0) / g.vox) | 0;
      if (jy < 0 || jy >= g.NY) continue;
      var mm = F.mid[jy * g.NX + jx]; if (mm !== mm) continue;
      sz += pz[i]; sm += mm; cnt++;
    }
    if (!cnt) return z >= 0 ? 1 : -1;
    return (sz - sm) / cnt >= C.frontMin ? 1 : -1;
  }
  // 이동량을 이웃 점에 퍼뜨리되 큰 값은 지킴(줄어들면 다시 파고드니까) — 움직이는 구간만
  var _tmp = new Float32Array(4096);
  function spread(a, n) {
    var lo = -1, hi = -1, i, j, w = C.smoothPts;
    for (i = 1; i < n; i++) if (a[i] !== 0) { if (lo < 0) lo = i; hi = i; }
    if (lo < 0) return;
    lo = Math.max(1, lo - w); hi = Math.min(n - 1, hi + w);
    if (_tmp.length < n) _tmp = new Float32Array(n * 2);
    for (i = lo; i <= hi; i++) {
      var s = 0, ws = 0;
      for (j = -w; j <= w; j++) { var k = i + j; if (k < 1 || k >= n) continue; var wt = w + 1 - (j < 0 ? -j : j); s += a[k] * wt; ws += wt; }
      var avg = s / ws, ai = a[i];
      _tmp[i] = (ai < 0 ? -ai : ai) > (avg < 0 ? -avg : avg) ? ai : avg;
    }
    for (i = lo; i <= hi; i++) a[i] = _tmp[i];
  }

  /* ---------------- 2) 가닥 다시 잇기 + 적용 ---------------- */
  // 한 머리 객체를 작은 조각 시간(budgetMs)씩 나눠 처리 → 화면이 멈추지 않음. 끝나면 한 번에 반영.
  function startJob(obj, done) {
    var geo = obj.geometry, P = geo.attributes.position;
    // 원본 찾기. 결과 화면의 '선분 거르기'(17a FLY_TRIM)가 내가 써 넣은 버퍼를 렌더 때마다 그 자리에서
    // 다시 고치므로 내용 비교로는 원본을 못 알아봄 → 머리 객체에 원본을 묶어 둠.
    // ① 같은 머리 객체 + 같은 길이 → 보관한 원본  ② 내 결과를 복사해 만든 새 객체 → 지문으로 찾음  ③ 그 밖 = 새 머리
    var cur = P.array, rec = objOrig.get(obj), orig = null;
    if (rec && rec.orig.length === cur.length) orig = rec.orig;
    if (!orig) { var o2 = outToOrig.get(checksum(cur)); if (o2 && o2.length === cur.length) orig = o2; }
    if (!orig) { orig = cur.slice(); S.newSrc++; } else S.reused++;
    objOrig.set(obj, { orig: orig });
    var a = orig.slice();                                    // 원본에서 새로 계산
    var nSeg = (a.length / 6) | 0, g2 = C.joinGap * C.joinGap, s0 = 0, s = 1, myVer = ver;
    function flush(s1) {
      var n = s1 - s0 + 1; if (n < 3) return;
      if (_px.length < n) { _px = new Float32Array(n * 2); _py = new Float32Array(n * 2); _pz = new Float32Array(n * 2); }
      var px = _px, py = _py, pz = _pz, k;
      px[0] = a[s0 * 6]; py[0] = a[s0 * 6 + 1]; pz[0] = a[s0 * 6 + 2];
      for (k = s0; k < s1; k++) { var q = k - s0 + 1; px[q] = a[k * 6 + 3]; py[q] = a[k * 6 + 4]; pz[q] = a[k * 6 + 5]; }
      S.strands++;
      if (!drapeStrand(px, py, pz, n)) return;
      S.touched++;
      for (k = s0; k < s1; k++) {
        var i0 = k - s0, o = k * 6;
        a[o] = px[i0]; a[o + 1] = py[i0]; a[o + 2] = pz[i0];
        a[o + 3] = px[i0 + 1]; a[o + 4] = py[i0 + 1]; a[o + 5] = pz[i0 + 1];
      }
    }
    function step() {
      if (myVer !== ver || !F) { done(false); return; }       // 그 사이 몸·설정이 바뀜 → 버림
      var t0 = performance.now();
      while (s <= nSeg) {
        if (s === nSeg) { flush(s); s++; break; }
        var o = s * 6, ddx = a[o] - a[o - 3], ddy = a[o + 1] - a[o - 2], ddz = a[o + 2] - a[o - 1];
        if (!(ddx === 0 && ddy === 0 && ddz === 0)) {
          if (ddx * ddx + ddy * ddy + ddz * ddz < g2 && ddy <= 0.02) S.joined++;   // 빠진 선분 건너 이어짐
          else { flush(s); s0 = s; }
        }
        s++;
        if ((s & 255) === 0 && performance.now() - t0 > C.budgetMs) { setTimeout(step, 0); return; }
      }
      P.array.set(a); P.needsUpdate = true;
      outToOrig.set(checksum(a), orig);                      // 이 결과 → 이 원본
      if (outToOrig.size > 6) outToOrig.delete(outToOrig.keys().next().value);
      var T = geo.attributes.tng;                               // 머리 빛(HAIR_LOOK)의 결 방향
      if (T && T.itemSize === 3 && T.count === P.count) {
        var ta = T.array;
        for (var v = 0; v + 1 < P.count; v += 2) {
          var ex = a[(v + 1) * 3] - a[v * 3], ey = a[(v + 1) * 3 + 1] - a[v * 3 + 1], ez = a[(v + 1) * 3 + 2] - a[v * 3 + 2], L = Math.hypot(ex, ey, ez) || 1e-9;
          ta[v * 3] = ta[(v + 1) * 3] = ex / L; ta[v * 3 + 1] = ta[(v + 1) * 3 + 1] = ey / L; ta[v * 3 + 2] = ta[(v + 1) * 3 + 2] = ez / L;
        }
        T.needsUpdate = true;
      }
      try { geo.computeBoundingSphere(); } catch (e) {}
      done(true);
    }
    step();
  }
  // 버퍼 내용 지문(길이 + 고르게 뽑은 값들의 합). 같은 내용이면 같은 값.
  var outToOrig = new Map(), objOrig = new WeakMap();
  function checksum(arr) {
    var n = arr.length, st = Math.max(1, (n / 4096) | 0), h1 = n, h2 = 0;
    for (var i = 0; i < n; i += st) { var v = arr[i]; h1 = (h1 * 31 + Math.round(v * 1e4)) | 0; h2 += v; }
    return n + ':' + h1 + ':' + h2.toFixed(3);
  }
  function restoreHair(obj) {
    var geo = obj.geometry, rec = objOrig.get(obj), orig = rec ? rec.orig : outToOrig.get(checksum(geo.attributes.position.array));
    if (orig && orig.length === geo.attributes.position.array.length) { geo.attributes.position.array.set(orig); geo.attributes.position.needsUpdate = true; }
  }

  /* ---------------- 감시 ---------------- */
  function gridFor(yTop) {
    var v = C.vox, g = { vox: v, x0: -C.xMax, y0: yTop - C.depth, z0: -C.zMax, y1: yTop };
    g.NX = Math.ceil(2 * C.xMax / v); g.NY = Math.ceil(C.depth / v); g.NZ = Math.ceil(2 * C.zMax / v);
    return g;
  }
  function tick() {
    try {
      if (busy || screen() !== 'model3d') return;
      var hg = headGroup(); if (!hg) return;
      var hairs = findHairs(hg); if (!hairs.length) return;
      if (!C.on) { hairs.forEach(function (h) { if (applied.has(h)) { restoreHair(h); applied.delete(h); wake(); } }); return; }
      var rig = hg.getObjectByName('bodyBaseRig'); if (!rig) return;
      var meshes = bodyMeshes(rig); if (!meshes.length) return;
      // 몸·옷 자리(위치·배율)까지 지문에 넣고, 두 번 연속 같을 때만(=옷 조각 불러오기가 끝나 멈췄을 때) 계산
      var rm = relTo(rig, hg).elements, rs = '';
      for (var ri = 0; ri < 16; ri++) rs += Math.round(rm[ri] * 1e4) + ',';
      var sig = rig.uuid + '@' + rs + meshes.map(function (m) { return m.uuid + ':' + m.geometry.attributes.position.count; }).join('|') + '#' + ver;
      if (sig !== fieldSig) { if (sig !== pendSig) { pendSig = sig; return; } }
      var todo = hairs.filter(function (h) { return applied.get(h) !== sig + ':' + h.geometry.attributes.position.array.length; });
      if (!todo.length && sig === fieldSig) return;
      var yTop; try { yTop = getNeckBottomY() + 0.02; } catch (e) { return; }
      if (!isFinite(yTop)) return;
      var t0 = performance.now();
      if (sig !== fieldSig || !F) {
        var toLocal = relTo(hairs[0], hg).invert(), g = gridFor(yTop);
        F = buildField(columnSpans(meshes, toLocal, g, hg), g); fieldSig = sig; todo = hairs; drapeInfo = null;
        S.sdfMs = performance.now() - t0; S.vox = F.inside;
        if (F.inside < 200) { S.err = '몸 겉면을 못 읽음(안 칸 ' + F.inside + ')'; F = null; fieldSig = ''; return; }
      }
      S.strands = S.joined = S.touched = S.pts = S.left = 0;
      busy = true;
      (function next(i) {
        if (i >= todo.length) {
          busy = false; S.ms = performance.now() - t0; S.err = null;
          if (C.log) console.log(C.lines()[0]);
          wake(); return;
        }
        var h = todo[i];
        startJob(h, function (ok) {
          if (!ok) { busy = false; return; }
          applied.set(h, sig + ':' + h.geometry.attributes.position.array.length); next(i + 1);
        });
      })(0);
    } catch (e) { S.err = String(e && e.message || e); console.warn(TAG, e); }
  }
  function wake() { try { if (typeof GPU_DIET !== 'undefined' && GPU_DIET.markDirty) GPU_DIET.markDirty(); } catch (e) {} }

  /* ---------------- 4) BODY_OUT 대신 ---------------- */
  function takeOverBodyOut() {
    try {
      if (typeof BODY_OUT === 'undefined' || BODY_OUT.__drapeWrapped) return;
      var orig = BODY_OUT._apply;
      BODY_OUT._apply = function (s) { return C.on && C.replaceBodyOut ? s : orig.apply(this, arguments); };
      BODY_OUT.__drapeWrapped = true;
      try { BODY_OUT.refresh(); } catch (e) {}
    } catch (e) {}
  }
  if (typeof window !== 'undefined' && window.addEventListener) {
    if (document.readyState === 'complete') takeOverBodyOut(); else window.addEventListener('load', takeOverBodyOut);
  }

  C.refresh = function () { ver++; busy = false; fieldSig = ''; pendSig = ''; F = null; try { BODY_OUT.refresh(); } catch (e) {} tick(); return C.on; };
  C.lines = function () {
    return [TAG + ' ' + (C.on ? '켜짐' : '꺼짐') + ' — 거리장 몸 안 칸 ' + S.vox + '(' + Math.round(S.sdfMs) + 'ms · 흐리기 ' + C.blur + ') · 가닥 ' + S.strands +
      '(끊긴 데 이음 ' + S.joined + ') 중 몸에 닿은 ' + S.touched + ' · 밀어낸 점 ' + S.pts + ' · 끝내 몸 안에 남은 점 ' + S.left +
      ' · 원본 새로 ' + S.newSrc + '/다시 씀 ' + S.reused + ' · 띄움 ' + (C.margin * 19.3).toFixed(1) + 'cm · ' + Math.round(S.ms) + 'ms' + (C.replaceBodyOut ? ' · BODY_OUT 대신 씀' : '') + (S.err ? ' ⚠ ' + S.err : '')];
  };
  C._test = { startJob: startJob, gridFor: gridFor, buildField: buildField, drapeStrand: drapeStrand, set: function (f) { F = f; }, sample: sample };
  if (typeof setInterval === 'function') setInterval(tick, C.pollMs);
  console.log(TAG + ' 설치 — 결과 화면에서 몸+옷 거리장으로 머리를 겉면 위로 살짝 띄워 늘어뜨림(BODY_OUT 대신). 끄기 BODY_DRAPE.on=false; BODY_DRAPE.refresh() · 상태 BODY_DRAPE.lines()');
  return C;
})();
