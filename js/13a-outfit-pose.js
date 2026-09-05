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
function loadOutfitMeshFromOBJ(objUrl, mtlUrl, widthFactor, neckCutFrac){
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

          /* (2026-09-05) 옷 길이를 <b>잰 두상</b>에서 낸다 — 위 personBodyLenMesh 배너.
             3D 화면은 씬에서 잰 정수리(state._model3DCrownY)를 넣고, 결과 화면은
             안 넣어 사진 기준을 쓴다 — 각 화면이 자기가 그리는 머리를 잰다.
             (결과 화면은 이 뒤에 자기 배율로 한 번 더 맞추므로 어느 쪽이든 무해하다.)
             못 재면 옛 4.0으로 폴백한다. */
          const bodyLen = (typeof personBodyLenMesh === 'function')
            ? personBodyLenMesh(state._model3DCrownY) : null;
          const TARGET_HEIGHT = bodyLen || 4.0;
          if(!bodyLen) console.warn('[3D·의상] 두상 자를 못 써서 옛 고정값 4.0으로 맞춥니다 — 정면 랜드마크 확인');
          const scale = OUTFIT_MESH_SOURCE.scaleOverride || (TARGET_HEIGHT / (bodyHeightRaw || 1)) * widthFactor;
          obj.scale.setScalar(scale);

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
async function loadOutfitMesh(item, widthFactor){
  if(item.asset && item.asset.objUrl){
    try{
      return await loadOutfitMeshFromOBJ(item.asset.objUrl, item.asset.mtlUrl, widthFactor, item.asset.neckCutFrac);
    }catch(e){
      console.warn('OBJ 의상 에셋 로드 실패, 절차적 플레이스홀더로 폴백:', e);
    }
  }
  return buildOutfitPlaceholderMesh(item, widthFactor);
}

/* 의상이 만들어지는 <b>유일한</b> 출구에서 목 구멍을 잰다 (2026-08-31 11차).
   호출부마다 재면 3D 화면과 결과 화면이 서로 다른 옷깃을 보게 된다 — 이 파일이
   여러 번 겪은 그 모양이다. loadOutfitMesh를 감싸는 이유도 같다: OBJ 경로든
   플레이스홀더 폴백이든 <b>여기 한 곳</b>을 지나간다.
   ⚠ 두 호출부 모두 <b>두신 배율을 걸기 전</b>에 이 함수를 지난다(결과 화면은 바로
     위에서 snap.group.scale을 1로 되돌린다). 목 메쉬도 그 배율 밖이라 좌표계가 같다. */
async function loadOutfitMeshMeasured(item, widthFactor){
  const mesh = await loadOutfitMesh(item, widthFactor);
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
  return mesh;
}

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

