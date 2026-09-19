/* ==========================================================================
   21-body-base.js — 3D 결과보기의 "몸"
   ------------------------------------------------------------------------
   예전: 의상 에셋(Male_Suit.obj 등)이 몸과 옷을 통째로 들고 있었다.
         옷을 바꾸려면 몸까지 갈아끼워야 했다.
   지금: 몸은 MakeHuman 표준 인체 두 벌(남/여)로 고정하고, 그 위에 의상만 얹는다.

   몸  — assets/body_male.obj · body_female.obj
         MakeHuman hm08 base + macrodetails {male|female}-young 타깃(CC0).
         목 위는 잘라 뒀고, 절단선 비율이 아래 BODY_FIGURES의 neckCutFrac이다.
   옷  — assets/fitted/{male|female}/*.fitted.obj
         기증받은 MakeClothes 에셋은 만든 사람의 체형에 물려 굳어 있어서 그대로 쓰면
         팔·배가 옷을 뚫고 나온다. tools/conform.py가 반입 단계에서 몸별로 맞춰 굽는다.
         업체 옷이 들어와도 같은 길(같은 스크립트)로 통과시키면 된다.

   무엇을 입을지는 사람이 고르지 않는다 — 20-outfit-match.js가 헤어에 맞춰 고른
   OUTFIT_CATALOG 항목을 받아서, 그 항목의 격식·색을 이 옷장에 옮긴다.
   화면 버튼은 둘뿐이다: 남/여 · 외투 On/Off.

   앱 좌표로 세우는 규칙은 기존 loadOutfitMeshFromOBJ와 같다 —
   목 절단선이 getNeckBottomY()에 오고, 발바닥까지가 personBodyLenMesh()다.
   ========================================================================== */

const BODY_BASE = {
  'on': true,                 // false면 예전 의상-바디 경로로 돌아간다
  'gender': 'male',           // 시작 성별 — 버튼으로 바뀐다
  'outer': true,              // 외투(슈트·재킷) 입은 상태로 시작
  'skinHex': '#C2A489',
  'clothOffset': 0.004,       // z-파이팅만 막는 값. 실제 여유는 conform이 이미 넣었다
  'underOffset': 0.002,
  'neckBandUnits': 0.25,      // 목 중심(x·z)을 잴 띠 — 0.3을 넘기면 턱이 딸려와 몸이 뒤로 밀린다
  'rack': true
};

const BODY_FIGURES = {
  'male':   { 'label': '남자', 'objUrl': './assets/body_male.obj',   'neckCutFrac': 0.9474 },
  'female': { 'label': '여자', 'objUrl': './assets/body_female.obj', 'neckCutFrac': 0.9427 }
};

/* ------------------------------------------------------------------ 옷장 */
/* outer: 격식(formal)이 가까운 것을 고른다. 벌이 늘면 여기에 줄만 더한다.
   inner: 외투를 벗었을 때 입는 안쪽 한 벌(아래→위 순서). */
const BODY_WARDROBE = {
  'male': {
    'outer': [
      { 'id': 'm-suit',   'name': '슈트', 'formal': 0.95, 'url': './assets/fitted/male/suit3.fitted.obj' },
      { 'id': 'm-jacket', 'name': '재킷', 'formal': 0.45, 'url': './assets/fitted/male/suit_dinner_jacket.fitted.obj' }
    ],
    'inner': [
      { 'id': 'm-jeans', 'name': '청바지', 'under': true, 'colorHex': '#3E4E6B',
        'url': './assets/fitted/male/mens_elv_jeans2slf.fitted.obj' },
      { 'id': 'm-top',   'name': '상의', 'url': './assets/fitted/male/mycenaean_tunic.fitted.obj' }
    ]
  },
  'female': {
    'outer': [
      { 'id': 'f-suit', 'name': '슈트', 'formal': 0.9, 'url': './assets/fitted/female/fem_suit2.fitted.obj' }
    ],
    'inner': [
      { 'id': 'f-jeans', 'name': '청바지', 'under': true, 'colorHex': '#3E4E6B',
        'url': './assets/fitted/female/mens_elv_jeans2slf.fitted.obj' },
      { 'id': 'f-top',   'name': '상의', 'url': './assets/fitted/female/mycenaean_tunic.fitted.obj' }
    ]
  }
};

/* 추천 항목의 격식 — 카테고리와 실루엣 점수에서 읽는다(20-outfit-match.js의 축). */
function outfitFormality(item) {
  if (!item) return 0.5;
  if (item.category === '포멀') return 1;
  const shoulder = typeof item.shoulder === 'number' ? item.shoulder : 0.5;
  const busy = typeof item.busy === 'number' ? item.busy : 0.5;
  return Math.max(0, Math.min(1, shoulder * 0.6 + busy * 0.4));
}

/* 지금 성별·외투 상태에서 입을 조각들 — 색은 추천 항목에서 온다(에셋이 무지다). */
function piecesForOutfit(item) {
  const w = BODY_WARDROBE[BODY_BASE.gender] || BODY_WARDROBE.male;
  const tint = item && item.colorHex || '#7A7F88';
  if (BODY_BASE.outer && w.outer && w.outer.length) {
    const f = outfitFormality(item);
    let best = w.outer[0], bd = Infinity;
    for (const o of w.outer) {
      const d = Math.abs(o.formal - f);
      if (d < bd) { bd = d; best = o; }
    }
    return { 'label': best.name, 'parts': [Object.assign({}, best, { 'colorHex': tint })] };
  }
  const parts = (w.inner || []).map(p => Object.assign({}, p, { 'colorHex': p.colorHex || tint }));
  return { 'label': parts.length ? '상의 + 하의' : '맨몸', 'parts': parts };
}

/* ------------------------------------------------------------ 불러오기 */
const _figureCache = new Map();   // gender → {geoms, box, cutY, neckCx, neckCz}
const _garmentCache = new Map();  // url|offset → [BufferGeometry]
let _bodyRig = null, _bodyWornLabel = '', _lastBuild = null;

function _loadOBJGroup(objUrl) {
  return new Promise((resolve, reject) => {
    if (typeof THREE === 'undefined' || typeof THREE.OBJLoader !== 'function') {
      reject(new Error('OBJLoader가 없습니다')); return;
    }
    new THREE.OBJLoader().load(encodeURI(objUrl), resolve, undefined, reject);
  });
}

/* 위치가 같은 정점끼리 법선을 모아 부드럽게 만들고, 원하면 그만큼 부풀린다.
   MakeClothes 에셋에는 법선이 없어서 그냥 쓰면 각져 보인다. */
function smoothInflateGeometry(geom, inflate) {
  const pos = geom.attributes && geom.attributes.position;
  if (!pos) return geom;
  const n = pos.count, acc = new Map();
  const key = i => (Math.round(pos.getX(i) * 1e4) / 1e4) + ',' +
                   (Math.round(pos.getY(i) * 1e4) / 1e4) + ',' +
                   (Math.round(pos.getZ(i) * 1e4) / 1e4);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(),
        ab = new THREE.Vector3(), ac = new THREE.Vector3(), fn = new THREE.Vector3();
  for (let t = 0; t + 2 < n; t += 3) {
    a.fromBufferAttribute(pos, t); b.fromBufferAttribute(pos, t + 1); c.fromBufferAttribute(pos, t + 2);
    fn.crossVectors(ab.subVectors(b, a), ac.subVectors(c, a));
    for (let k = 0; k < 3; k++) {
      const kk = key(t + k), v = acc.get(kk);
      if (v) { v[0] += fn.x; v[1] += fn.y; v[2] += fn.z; } else acc.set(kk, [fn.x, fn.y, fn.z]);
    }
  }
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const v = acc.get(key(i)) || [0, 1, 0];
    const L = Math.hypot(v[0], v[1], v[2]) || 1;
    const nx = v[0] / L, ny = v[1] / L, nz = v[2] / L;
    out[i * 3] = nx; out[i * 3 + 1] = ny; out[i * 3 + 2] = nz;
    if (inflate) pos.setXYZ(i, pos.getX(i) + nx * inflate, pos.getY(i) + ny * inflate, pos.getZ(i) + nz * inflate);
  }
  geom.setAttribute('normal', new THREE.BufferAttribute(out, 3));
  pos.needsUpdate = true;
  geom.computeBoundingBox(); geom.computeBoundingSphere();
  return geom;
}

function _collectGeometries(group) {
  const geoms = [];
  group.traverse(o => { if (o.isMesh && o.geometry) geoms.push(o.geometry); });
  return geoms;
}

/* 캐시한 원본은 씬에 넣지 않는다 — 3D 화면을 나갈 때 앱이 disposeObject3D로
   씬의 지오메트리를 버리기 때문에, 넣을 때마다 복제해서 넣는다. */
function _cloned(geoms) { return geoms.map(g => g.clone()); }

async function loadBodyFigure(gender) {
  if (_figureCache.has(gender)) return _figureCache.get(gender);
  const fig = BODY_FIGURES[gender] || BODY_FIGURES.male;
  const group = await _loadOBJGroup(fig.objUrl);
  const geoms = _collectGeometries(group);
  if (!geoms.length) throw new Error('몸 메쉬가 비어 있습니다: ' + fig.objUrl);
  geoms.forEach(g => { if (!g.attributes.normal) smoothInflateGeometry(g, 0); });

  const box = new THREE.Box3().setFromObject(group);
  const cutY = box.min.y + fig.neckCutFrac * (box.max.y - box.min.y);
  let sx = 0, sz = 0, cnt = 0;
  for (const g of geoms) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      if (y < cutY || y > cutY + BODY_BASE.neckBandUnits) continue;
      sx += p.getX(i); sz += p.getZ(i); cnt++;
    }
  }
  const rec = { 'geoms': geoms, 'box': box, 'cutY': cutY,
                'neckCx': cnt ? sx / cnt : 0, 'neckCz': cnt ? sz / cnt : 0 };
  _figureCache.set(gender, rec);
  console.log('[3D·몸] 표준 인체(' + fig.label + ') 로드 — 파일 높이 ' +
    (box.max.y - box.min.y).toFixed(2) + '단위 · 목 절단선 ' + cutY.toFixed(2) +
    ' · 목 중심 z ' + rec.neckCz.toFixed(2));
  return rec;
}

async function loadGarmentGeometries(part) {
  const offset = part.under ? BODY_BASE.underOffset : BODY_BASE.clothOffset;
  const key = part.url + '|' + offset;
  if (_garmentCache.has(key)) return _garmentCache.get(key);
  const group = await _loadOBJGroup(part.url);
  const geoms = _collectGeometries(group);
  geoms.forEach(g => smoothInflateGeometry(g, offset));
  _garmentCache.set(key, geoms);
  return geoms;
}

/* ------------------------------------------------------------ 리그 조립 */
function _skinMaterial(clip) {
  const m = new THREE.MeshStandardMaterial({
    'color': new THREE.Color(BODY_BASE.skinHex), 'roughness': 0.88, 'metalness': 0 });
  if (clip) { m.clippingPlanes = [clip]; m.clipShadows = true; }
  return m;
}
function _clothMaterial(colorHex, clip) {
  const m = new THREE.MeshStandardMaterial({
    'color': new THREE.Color(colorHex || '#7A7F88'), 'roughness': 0.82, 'metalness': 0,
    'side': THREE.DoubleSide });
  if (clip) { m.clippingPlanes = [clip]; m.clipShadows = true; }
  return m;
}

/* 캐시한 지오메트리는 그대로 두고 재질만 버린다. */
function _detach(parent, obj) {
  if (!obj) return;
  parent.remove(obj);
  obj.traverse(o => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach(m => m && m.dispose && m.dispose());
  });
}

async function _mountGarment(rig, item) {
  const clip = rig.userData.clipPlane;
  _detach(rig, rig.getObjectByName('bodyGarment'));
  const holder = new THREE.Group();
  holder.name = 'bodyGarment';
  rig.add(holder);
  const pick = piecesForOutfit(item);
  for (const part of pick.parts) {
    let geoms;
    try { geoms = await loadGarmentGeometries(part); }
    catch (e) { console.warn('[3D·옷] 불러오기 실패 — 건너뜁니다: ' + part.url, e); continue; }
    const mat = _clothMaterial(part.colorHex, clip);
    _cloned(geoms).forEach(g => holder.add(new THREE.Mesh(g, mat)));
  }
  _bodyWornLabel = pick.label;
  return holder;
}

async function buildBodyBaseRig(item, widthFactor, bodyLenMesh) {
  const base = await loadBodyFigure(BODY_BASE.gender);
  const neckY = typeof getNeckBottomY === 'function' ? getNeckBottomY() : -1.15;
  const clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), neckY);

  const rig = new THREE.Group();
  rig.name = 'bodyBaseRig';
  rig.userData.clipPlane = clip;

  const skin = _skinMaterial(clip);
  const holder = new THREE.Group();
  holder.name = 'bodyBaseSkin';
  _cloned(base.geoms).forEach(g => holder.add(new THREE.Mesh(g, skin)));
  rig.add(holder);

  const bodyLenFile = base.cutY - base.box.min.y;
  let target = bodyLenMesh;
  if (!(isFinite(target) && target > 0.5)) target = typeof personBodyLenMesh === 'function' ? personBodyLenMesh() : null;
  if (!(isFinite(target) && target > 0.5)) {
    target = 4;
    console.warn('[3D·비율] 두상 자가 없어 폴백 4.0단위로 세웁니다 — 이 경우에만 두신이 상수에서 벗어납니다.');
  }
  const wf = isFinite(widthFactor) && widthFactor > 0 ? widthFactor : 1;
  const widthMode = (typeof OUTFIT_MESH_SOURCE !== 'undefined' &&
    (OUTFIT_MESH_SOURCE.widthMode || (OUTFIT_MESH_SOURCE.widthUniform ? 'uniform' : 'off'))) || 'off';
  const s = target / (bodyLenFile || 1) * (widthMode === 'uniform' ? wf : 1);
  const sx = widthMode === 'xz' ? wf : 1;

  rig.scale.set(s * sx, s, s * sx);
  rig.position.set(-base.neckCx * s * sx, neckY - base.cutY * s, -base.neckCz * s * sx);

  await _mountGarment(rig, item);
  rig.updateMatrixWorld(true);
  _bodyRig = rig;
  console.log('[3D·몸] ' + BODY_FIGURES[BODY_BASE.gender].label + ' ×' + s.toFixed(3) +
    ' · 발바닥 y ' + (neckY - bodyLenFile * s).toFixed(2) + ' · 목 절단 y ' + neckY.toFixed(2) +
    ' · 옷 ' + _bodyWornLabel + (BODY_BASE.outer ? '(외투 ON)' : '(외투 OFF)') +
    ' · 추천 ' + (item ? item.name : '없음'));
  return rig;
}

/* 18-perf-i18n-boot.js가 부르는 자리 — 실패하면 예전 의상-바디 경로로 돌아간다. */
async function buildBody3DForOutfit(item, widthFactor, bodyLenMesh) {
  if (BODY_BASE.on) try {
    _lastBuild = { 'item': item, 'wf': widthFactor, 'len': bodyLenMesh };
    const rig = await buildBodyBaseRig(item, widthFactor, bodyLenMesh);
    try {
      const open = typeof measureGarmentNeckOpening === 'function' ? measureGarmentNeckOpening(rig) : null;
      if (open) _garmentNeckOpening = open;
      else console.log('[3D·목] 몸의 목둘레가 옷깃 실측 범위 밖 — 예전(두개골 클램프) 경로로 세웁니다');
    } catch (e) { console.warn('[3D·목] 목둘레 실측 예외:', e); }
    try { buildBodyGarmentRack(); } catch (e) { console.warn('[3D·옷] 버튼 UI 실패:', e); }
    return rig;
  } catch (e) {
    console.warn('[3D·몸] 표준 인체 실패 — 예전 의상-바디 에셋으로 폴백:', e);
  }
  return loadOutfitMeshMeasured(item, widthFactor, bodyLenMesh);
}

/* ------------------------------------------------------------ 버튼 둘 */
function _updateModel3DTag() {
  const tag = document.getElementById('model3dTag');
  if (!tag) return;
  const base = tag.textContent.replace(/ · 몸:.*$/, '');
  tag.textContent = base + ' · 몸: ' + BODY_FIGURES[BODY_BASE.gender].label +
    ' · ' + _bodyWornLabel;
}

async function setBodyGender(gender) {
  if (!BODY_FIGURES[gender] || gender === BODY_BASE.gender) return false;
  BODY_BASE.gender = gender;
  return rebuildBodyRig();
}

async function toggleBodyOuter() {
  BODY_BASE.outer = !BODY_BASE.outer;
  if (!_bodyRig) return false;
  await _mountGarment(_bodyRig, _lastBuild && _lastBuild.item);
  buildBodyGarmentRack(); _updateModel3DTag();
  return true;
}

/* 성별이 바뀌면 몸 자체가 바뀌므로 리그를 다시 세운다. */
async function rebuildBodyRig() {
  if (!_lastBuild || typeof model3D === 'undefined' || !model3D || !model3D.headGroup) return false;
  const host = model3D.headGroup;
  const old = host.getObjectByName('bodyBaseRig');
  let rig;
  try { rig = await buildBodyBaseRig(_lastBuild.item, _lastBuild.wf, _lastBuild.len); }
  catch (e) { console.warn('[3D·몸] 다시 세우기 실패 — 그대로 둡니다:', e); return false; }
  _detach(host, old);
  host.add(rig);
  buildBodyGarmentRack(); _updateModel3DTag();
  return true;
}

function buildBodyGarmentRack() {
  if (!BODY_BASE.rack) return;
  const host = document.getElementById('model3dViewport');
  if (!host) return;
  let rack = document.getElementById('bodyGarmentRack');
  if (!rack) {
    rack = document.createElement('div');
    rack.id = 'bodyGarmentRack'; rack.className = 'bb-rack';
    host.appendChild(rack);
  }
  rack.innerHTML = '';
  const other = BODY_BASE.gender === 'male' ? 'female' : 'male';
  const bGender = document.createElement('button');
  bGender.type = 'button';
  bGender.textContent = BODY_FIGURES[BODY_BASE.gender].label;
  bGender.title = '누르면 ' + BODY_FIGURES[other].label + ' 몸으로 바꿉니다';
  bGender.addEventListener('click', () => setBodyGender(other));
  rack.appendChild(bGender);

  const bOuter = document.createElement('button');
  bOuter.type = 'button';
  bOuter.textContent = '외투 ' + (BODY_BASE.outer ? 'ON' : 'OFF');
  if (BODY_BASE.outer) bOuter.classList.add('on');
  bOuter.title = '슈트·재킷을 입었다 벗깁니다 (무슨 옷인지는 추천이 정합니다)';
  bOuter.addEventListener('click', () => toggleBodyOuter());
  rack.appendChild(bOuter);
}

/* 손님이 바뀌면 리그 참조를 놓는다(에셋 캐시는 남긴다 — 다시 읽을 필요가 없다). */
function resetBodyBase() {
  _bodyRig = null; _lastBuild = null; _bodyWornLabel = '';
  const rack = document.getElementById('bodyGarmentRack');
  if (rack) rack.remove();
}
