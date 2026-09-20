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

/* ── 쇼핑몰에서 받아오는 옷 (2026-09-20) ──────────────────────────────────
   아래 BODY_WARDROBE는 앱에 딸려 오는 <b>견본</b>이다. 실제 팔 옷은 쇼핑몰이
   가지고 있고, 앱은 catalogUrl에서 목록을 받아 같은 옷장에 섞어 넣는다.
   목록을 못 받아도(오프라인·주소 오류·CORS) 견본만으로 그대로 돌아간다 —
   3D 화면이 쇼핑몰 때문에 비는 일은 없어야 한다. */
const BODY_SHOP = {
  'on': true,
  'catalogUrl': 'https://pub-0d2b3979dafc4e7ebc2c1b1b5acca4de.r2.dev/catalog.json',
  'pageUrl':    'https://pub-0d2b3979dafc4e7ebc2c1b1b5acca4de.r2.dev/shop/index.html',
  'timeoutMs': 6000
};
/* 손님이 쇼핑몰에서 직접 고른 옷. 추천보다 우선한다(고른 사람이 이긴다).
   null이면 추천이 고른 대로 입는다.
   _pickedShopItem은 쇼핑몰이 목록(catalog.json) 없이 옷 정보를 통째로 보냈을 때 쓴다 —
   목록을 못 받는 상황에서도 "고른 옷"이 입혀져야 한다. */
let _pickedShopId = null;
let _pickedShopItem = null;
let _shopItems = null;     // null=아직 안 읽음, []=읽었는데 없음
let _shopLoading = null;   // 진행 중인 fetch 약속 — 같은 목록을 두 번 읽지 않는다
let _shopFailed = false;   // 한 번 실패했다 → 다음에 다시 시도한다

/* 목록 형식 (catalog.json)
   { "version":1,
     "items":[ { "id":"shop-navy-jacket", "name":"네이비 재킷",
                 "gender":"male",          // male | female | both
                 "layer":"outer",          // outer | inner
                 "formal":0.5,             // 0=캐주얼 1=포멀 — 추천의 격식과 맞춰 고른다
                 "colorHex":"#2E3A4E",     // 없으면 추천 항목의 색을 입힌다
                 "mesh":{ "male":"clothes/x_male.obj", "female":"clothes/x_female.obj" },
                 "shop":{ "title":"...", "price":"...", "link":"https://..." } } ] }
   mesh 주소가 상대경로면 catalogUrl 기준으로 푼다. */
/* 목록 항목 하나를 앱이 쓰는 꼴로 다듬는다(상대경로 → 절대경로). */
function _normalizeShopItem(it, baseUrl) {
  if (!it || !it.id) return null;
  const out = Object.assign({}, it, { 'fromShop': true });
  out.mesh = {};
  for (const g of ['male', 'female']) {
    const u = it.mesh && it.mesh[g];
    if (!u) continue;
    try { out.mesh[g] = new URL(u, baseUrl || BODY_SHOP.catalogUrl).href; }
    catch (e) { out.mesh[g] = u; }
  }
  return (out.mesh.male || out.mesh.female) ? out : null;
}

/* 같은 목록을 두 번 읽지 않고(_shopLoading), 실패한 목록은 다음 기회에 다시 읽는다.
   예전 판은 fetch를 시작하기 전에 _shopItems=[]로 두어서, 동시에 부른 쪽은 빈 목록을
   받았고 한 번 실패하면 영영 다시 읽지 않았다. */
function loadShopCatalog(force) {
  if (!BODY_SHOP.on) return Promise.resolve([]);
  if (_shopLoading) return _shopLoading;
  if (_shopItems && !(force && _shopFailed)) return Promise.resolve(_shopItems);

  _shopLoading = (async () => {
    try {
      const ctl = typeof AbortController === 'function' ? new AbortController() : null;
      const t = ctl && setTimeout(() => ctl.abort(), BODY_SHOP.timeoutMs);
      const res = await fetch(BODY_SHOP.catalogUrl, ctl ? { 'signal': ctl.signal } : undefined);
      if (t) clearTimeout(t);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const list = (data && data.items) || [];
      _shopItems = list.map(it => _normalizeShopItem(it, BODY_SHOP.catalogUrl)).filter(Boolean);
      _shopFailed = false;
      console.log('[3D·쇼핑몰] 옷 목록 ' + _shopItems.length + '벌 받음 — ' + BODY_SHOP.catalogUrl);
    } catch (e) {
      _shopItems = _shopItems || [];
      _shopFailed = true;
      console.log('[3D·쇼핑몰] 목록을 못 받아 견본 옷장만 씁니다:', e && e.message || e);
    }
    _shopLoading = null;
    return _shopItems;
  })();
  return _shopLoading;
}

/* 쇼핑몰 항목을 이 성별에서 입을 수 있는 조각으로 바꾼다(없으면 null). */
function shopPiece(it, gender) {
  if (it.gender && it.gender !== 'both' && it.gender !== gender) return null;
  const url = it.mesh[gender] || (it.gender === 'both' ? (it.mesh.male || it.mesh.female) : null);
  if (!url) return null;
  return { 'id': it.id, 'name': it.name, 'formal': typeof it.formal === 'number' ? it.formal : 0.5,
           'url': url, 'colorHex': it.colorHex || null, 'layer': it.layer || 'outer',
           'shop': it.shop || null, 'fromShop': true };
}

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
      { 'id': 'f-suit',  'name': '슈트', 'formal': 0.95, 'url': './assets/fitted/female/fem_suit2.fitted.obj' },
      { 'id': 'f-dress', 'name': '원피스 슈트', 'formal': 0.55,
        'url': './assets/fitted/female/female_elegantsuit01.fitted.obj' }
    ],
    /* 여자 안쪽 한 벌은 상·하의가 한 메쉬다(MakeHuman female_casualsuit01).
       예전에는 남성용 튜닉 + 청바지를 빌려 썼는데, 가슴이 옷을 뚫고 나와 여유를 계속
       올리다 보니 어깨가 부풀었다. 이 옷은 처음부터 여자 체형에 물려 있어 그 문제가 없다. */
    'inner': [
      { 'id': 'f-casual', 'name': '캐주얼', 'url': './assets/fitted/female/female_casualsuit01.fitted.obj' }
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

/* 지금 성별·외투 상태에서 입을 조각들.
   견본 옷장 + 쇼핑몰 목록을 한 자리에 놓고, 추천의 격식에 제일 가까운 것을 고른다.
   색은 옷이 제 색을 들고 있으면 그것을, 없으면 추천 항목의 색을 쓴다(에셋이 무지다). */
async function piecesForOutfit(item) {
  const gender = BODY_BASE.gender;
  const w = BODY_WARDROBE[gender] || BODY_WARDROBE.male;
  const tint = item && item.colorHex || '#7A7F88';
  const shop = await loadShopCatalog();
  const shopFor = layer => shop.map(it => shopPiece(it, gender))
                               .filter(p => p && (p.layer || 'outer') === layer);

  /* 쇼핑몰에서 직접 고른 옷 — 격식을 따지지 않고 그대로 입는다. */
  if (_pickedShopId) {
    let hit = shop.map(it => shopPiece(it, gender)).find(p => p && p.id === _pickedShopId);
    /* 목록에 없으면 쇼핑몰이 메시지에 실어 보낸 옷 정보로 입힌다. */
    if (!hit && _pickedShopItem && _pickedShopItem.id === _pickedShopId) {
      hit = shopPiece(_pickedShopItem, gender);
    }
    if (hit) {
      const parts = [Object.assign({}, hit, { 'colorHex': hit.colorHex || tint })];
      return { 'label': hit.name + ' · 고름', 'shop': hit.shop || null, 'parts': parts };
    }
    /* 이 성별에는 없는 옷이다 — 고른 것을 놓고 추천으로 돌아간다. */
    console.log('[3D·쇼핑몰] 고른 옷(' + _pickedShopId + ')이 ' +
      BODY_FIGURES[gender].label + ' 몸에는 없어 추천으로 돌아갑니다');
    _pickedShopId = null; _pickedShopItem = null;
  }

  if (BODY_BASE.outer) {
    const cands = (w.outer || []).concat(shopFor('outer'));
    if (cands.length) {
      const f = outfitFormality(item);
      let best = cands[0], bd = Infinity;
      for (const o of cands) { const d = Math.abs(o.formal - f); if (d < bd) { bd = d; best = o; } }
      return { 'label': best.name + (best.fromShop ? ' · 쇼핑몰' : ''),
               'shop': best.shop || null,
               'parts': [Object.assign({}, best, { 'colorHex': best.colorHex || tint })] };
    }
  }
  const shopInner = shopFor('inner');
  const parts = (shopInner.length ? shopInner : (w.inner || []))
    .map(p => Object.assign({}, p, { 'colorHex': p.colorHex || tint }));
  return { 'label': parts.length ? (parts[0].fromShop ? parts[0].name + ' · 쇼핑몰' : '상의 + 하의') : '맨몸',
           'shop': (parts[0] && parts[0].shop) || null,
           'parts': parts };
}

/* ------------------------------------------------------------ 불러오기 */
const _figureCache = new Map();   // gender → {geoms, box, cutY, neckCx, neckCz}
const _garmentCache = new Map();  // url|offset → [BufferGeometry]
let _bodyRig = null, _bodyWornLabel = '', _bodyWornShop = null, _lastBuild = null;

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
  const pick = await piecesForOutfit(item);
  for (const part of pick.parts) {
    let geoms;
    try { geoms = await loadGarmentGeometries(part); }
    catch (e) { console.warn('[3D·옷] 불러오기 실패 — 건너뜁니다: ' + part.url, e); continue; }
    const mat = _clothMaterial(part.colorHex, clip);
    _cloned(geoms).forEach(g => holder.add(new THREE.Mesh(g, mat)));
  }
  _bodyWornLabel = pick.label;
  _bodyWornShop = pick.shop || null;
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
    try { installShopBridge(); buildBodyGarmentRack(); } catch (e) { console.warn('[3D·옷] 버튼 UI 실패:', e); }
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

  /* 쇼핑몰 주소가 있으면 옷장 문을 연다 — 3D 화면 위에 덮어 띄운다.
     목록(catalog.json)을 못 받았다고 버튼을 지우면 안 된다. 손님이 고르는 곳은
     목록이 아니라 쇼핑몰 페이지이고, 고른 옷은 메시지로 직접 들어온다. */
  if (BODY_SHOP.on && BODY_SHOP.pageUrl) {
    const bShop = document.createElement('button');
    bShop.type = 'button';
    const open = !!document.getElementById('bbShopPanel');
    bShop.textContent = open ? '옷 닫기' : '옷 고르기';
    if (open) bShop.classList.add('on');
    bShop.addEventListener('click', () => open ? closeShopPanel() : openShopPanel());
    rack.appendChild(bShop);
  }

  /* 쇼핑몰에서 온 옷이면 구매 칸을 하나 더 띄운다 — 상담이 거래로 이어지는 자리다.
     견본 옷에는 안 뜬다(shop 정보가 없다). */
  if (_bodyWornShop && _bodyWornShop.link) {
    const buy = document.createElement('a');
    buy.className = 'bb-buy';
    buy.href = _bodyWornShop.link;
    buy.target = '_blank';
    buy.rel = 'noopener';
    buy.textContent = (_bodyWornShop.title || '이 옷 보기') +
      (_bodyWornShop.price ? ' · ' + _bodyWornShop.price : '');
    rack.appendChild(buy);
  }
}

/* ─────────────────────────────────────────────────────── 쇼핑몰 패널
   쇼핑몰을 새 탭으로 열면 앱이 내려가고, 앱이 내려가면 이 손님의 3D 모델이
   사라진다(사진부터 다시 찍어야 한다). 그래서 밖으로 내보내지 않고
   3D 화면 <b>위에</b> 얹는다 — 옷을 눌러도 뒤의 아바타는 그대로 서 있다. */
let _shopFrame = null;
function openShopPanel() {
  const host = document.getElementById('model3dViewport');
  if (!host) { console.warn('[3D·쇼핑몰] 3D 화면(model3dViewport)이 없어 옷장을 못 엽니다'); return false; }
  if (document.getElementById('bbShopPanel')) return true;
  installShopBridge();                 // 패널을 열기 전에 귀부터 연다
  loadShopCatalog(true);               // 지난번에 실패했으면 여기서 다시 읽는다

  const panel = document.createElement('div');
  panel.id = 'bbShopPanel';
  panel.className = 'bb-shop';

  const bar = document.createElement('div');
  bar.className = 'bb-shop-bar';
  const ttl = document.createElement('span');
  ttl.textContent = '의상 고르기';
  bar.appendChild(ttl);
  const close = document.createElement('button');
  close.type = 'button'; close.textContent = '✕'; close.title = '닫기';
  close.addEventListener('click', closeShopPanel);
  bar.appendChild(close);

  /* 안 뜰 때 손님이 빈 화면만 보고 있지 않도록, 상태를 글로 말해 준다. */
  const note = document.createElement('div');
  note.className = 'bb-shop-note';
  note.textContent = '쇼핑몰을 여는 중…';

  const frame = document.createElement('iframe');
  frame.id = 'bbShopFrame';
  frame.title = '의상 고르기';
  frame.setAttribute('loading', 'eager');
  frame.setAttribute('referrerpolicy', 'no-referrer');
  frame.addEventListener('load', () => {
    note.remove();
    /* 쇼핑몰에 "나 여기 있다"고 알린다 — 지금 성별도 같이 보낸다. */
    try {
      frame.contentWindow.postMessage(
        { 'type': 'gyeol-hello', 'gender': BODY_BASE.gender }, '*');
    } catch (e) {}
  });
  frame.src = BODY_SHOP.pageUrl;

  /* 6초 안에 load가 안 오면 주소·CORS·X-Frame-Options 문제다 → 새 탭 길을 열어 준다. */
  const timer = setTimeout(() => {
    if (!note.isConnected) return;
    note.innerHTML = '';
    const p = document.createElement('p');
    p.textContent = '쇼핑몰 페이지를 화면 안에 띄우지 못했습니다.';
    const a = document.createElement('a');
    a.href = BODY_SHOP.pageUrl; a.target = '_blank'; a.rel = 'noopener';
    a.textContent = '새 탭에서 열기';
    const q = document.createElement('small');
    q.textContent = BODY_SHOP.pageUrl;
    note.appendChild(p); note.appendChild(a); note.appendChild(q);
  }, BODY_SHOP.timeoutMs);
  frame.addEventListener('load', () => clearTimeout(timer));

  panel.appendChild(bar); panel.appendChild(note); panel.appendChild(frame);
  host.appendChild(panel);
  _shopFrame = frame;
  buildBodyGarmentRack();
  return true;
}
function closeShopPanel() {
  const p = document.getElementById('bbShopPanel');
  if (p) p.remove();
  _shopFrame = null;
  buildBodyGarmentRack();
}

/* 쇼핑몰 페이지가 보내는 "이 옷 입혀줘" 신호.
   주소가 우리 쇼핑몰이 아닌 메시지는 무시한다 — 아무 페이지나 아바타를
   갈아입힐 수 있으면 안 된다. */
let _shopBridgeOn = false;
function installShopBridge() {
  if (_shopBridgeOn || typeof window === 'undefined') return;
  _shopBridgeOn = true;
  let shopOrigin = '';
  try { shopOrigin = new URL(BODY_SHOP.pageUrl, location.href).origin; } catch (e) {}
  window.addEventListener('message', async ev => {
    if (shopOrigin && ev.origin !== shopOrigin && ev.origin !== location.origin) return;
    /* 쇼핑몰이 JSON 문자열로 보낼 수도 있다. */
    let d = ev.data;
    if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { return; } }
    if (!d || d.type !== 'gyeol-wear' || !d.id) return;

    _pickedShopId = String(d.id);
    /* 목록에 없는 옷이어도 입을 수 있게, 메시지에 실려 온 옷 정보를 챙겨 둔다. */
    _pickedShopItem = d.item ? _normalizeShopItem(
      Object.assign({ 'id': _pickedShopId }, d.item), ev.origin + '/') : null;
    if (_pickedShopItem) {
      _shopItems = (_shopItems || []).filter(it => it.id !== _pickedShopId).concat([_pickedShopItem]);
    }
    if (!BODY_BASE.outer) BODY_BASE.outer = true;   // 외투를 벗어둔 상태면 다시 입힌다
    if (!_bodyRig) { console.warn('[3D·쇼핑몰] 아직 몸이 안 세워져 고른 옷만 기억해 둡니다'); return; }
    try {
      await _mountGarment(_bodyRig, _lastBuild && _lastBuild.item);
    } catch (e) { console.warn('[3D·쇼핑몰] 갈아입히기 실패:', e); return; }
    buildBodyGarmentRack(); _updateModel3DTag();
    if (d.close !== false) closeShopPanel();        // 고르면 옷장 문은 닫는다
    console.log('[3D·쇼핑몰] 손님이 고른 옷으로 갈아입힘 — ' + _pickedShopId);
  });
  console.log('[3D·쇼핑몰] 다리 놓음 — ' + (shopOrigin || '(주소 없음)') + ' 의 gyeol-wear 메시지를 듣습니다');
}
/* 3D 화면이 세워지기 전에 메시지가 와도 놓치지 않도록, 파일을 읽는 즉시 귀를 연다. */
if (typeof window !== 'undefined') {
  try { installShopBridge(); } catch (e) {}
}

/* 손님이 바뀌면 리그 참조를 놓는다(에셋 캐시는 남긴다 — 다시 읽을 필요가 없다). */
function resetBodyBase() {
  _bodyRig = null; _lastBuild = null; _bodyWornLabel = ''; _bodyWornShop = null;
  _pickedShopId = null; _pickedShopItem = null; closeShopPanel();
  const rack = document.getElementById('bodyGarmentRack');
  if (rack) rack.remove();
}
