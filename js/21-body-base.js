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
  'timeoutMs': 6000,
  /* 성별 구분은 추천이 옷장에서 <b>자동으로</b> 고를 때만 쓰는 규칙이다 —
     치마가 남자 몸에 얹히는 일을 막으려는 것이지, 손님을 막으려는 게 아니다.
     손님이 쇼핑몰에서 직접 고른 옷은 남성복이든 여성복이든 지금 몸 그대로 입힌다.
     (true로 두면 고른 옷도 성별이 맞아야만 입는다 — 예전 동작) */
  'pickGenderLock': false
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

/* 쇼핑몰 항목을 이 성별에서 입을 수 있는 조각으로 바꾼다(없으면 null).
   loose=true면 성별 표시를 따지지 않고 있는 메쉬를 그대로 쓴다. */
function shopPiece(it, gender, loose) {
  if (!it || !it.mesh) return null;
  if (!loose && it.gender && it.gender !== 'both' && it.gender !== gender) return null;
  const any = it.mesh.male || it.mesh.female;
  const url = it.mesh[gender] || ((loose || !it.gender || it.gender === 'both') ? any : null);
  if (!url) return null;
  /* fitFor — 이 메쉬가 <b>어느 몸에 물려 구운</b> 것이냐. 지금 몸과 다르면 앱이 한 번 더
     굽는다(fitGarmentToBody). 목록이 직접 적어 두면 그것을 믿고, 없으면 쓴 메쉬 키로 본다. */
  const fitFor = it.fitFor || (it.mesh[gender] ? gender : (it.mesh.male ? 'male' : 'female'));
  return { 'id': it.id, 'name': it.name, 'formal': typeof it.formal === 'number' ? it.formal : 0.5,
           'url': url, 'colorHex': it.colorHex || null, 'layer': it.layer || 'outer',
           'fitFor': fitFor, 'shop': it.shop || null, 'fromShop': true };
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
    const raw = _shopItemById(_pickedShopId, shop);
    /* 고른 옷은 성별을 따지지 않는다. 지금 몸에 맞는 메쉬가 있으면 그것을,
       없으면 있는 메쉬를 그대로 얹는다 — 몸은 손님이 둔 그대로 둔다. */
    const hit = raw && shopPiece(raw, gender, !BODY_SHOP.pickGenderLock);
    /* 고른 옷도 제 layer를 지킨다 — 외투를 벗어 둔 손님에게 고른 재킷을 다시 입히면
       스위치가 거짓말이 된다. 벗어 둔 동안에도 고른 기억(_pickedShopId)은 지우지 않는다.
       다시 켜면 같은 옷이 돌아온다. */
    if (hit && ((hit.layer || 'outer') !== 'outer' || BODY_BASE.outer)) {
      const parts = [Object.assign({}, hit, { 'colorHex': hit.colorHex || tint })];
      return { 'label': hit.name + ' · 고름', 'shop': hit.shop || null, 'parts': parts };
    }
    if (!hit) {
      /* 정말 입힐 메쉬가 없다 — 그때만 추천으로 돌아가고, 조용히 넘어가지 않는다. */
      console.warn('[3D·쇼핑몰] 고른 옷(' + _pickedShopId + ')에 ' +
        BODY_FIGURES[gender].label + ' 몸에 얹을 메쉬가 없어 추천으로 돌아갑니다');
      bodyToast('고른 옷을 이 몸에 얹을 수 없어 추천 의상으로 돌아갑니다');
      _pickedShopId = null; _pickedShopItem = null;
    }
    /* 외투 OFF + 고른 옷이 외투 → 아래 안쪽 한 벌로 내려간다. */
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
const _garmentCache = new Map();  // url|offset(|gender) → [BufferGeometry]
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

/* ------------------------------------------------- 다른 몸에 옮겨 굽기
   반입 단계의 tools/conform.py가 옷을 <b>한</b> 몸(fitFor)에 물려 굽는다. 그런데 손님은
   남자 옷을 여자 몸에 입어 보기도 한다 — 성별 구분은 추천이 자동으로 고를 때만 쓰는
   규칙이지 손님을 막는 규칙이 아니다(BODY_SHOP.pickGenderLock=false).

   두 몸은 정점 번호가 안 맞으므로(남 9529 / 여 9450) conform.py처럼 같은 번호로 옮길 수
   없다. 대신 몸을 <b>높이 × 방위</b> 칸으로 재서 칸마다 겉 반지름을 하나 두고, 옷의 점을
   같은 칸의 반지름 비율만큼 옮긴다. 가슴은 앞쪽 방위에서만 커지므로 그 자리만 부풀고
   허리는 그대로 들어간다. 옷이 몸에서 떠 있던 여유(gap)는 그대로 지킨다.

   ※ 이건 <b>근사</b>다. 파는 성별 몸에는 conform.py로 제대로 구운 메쉬가 그대로 쓰이고
     (fitFor === 지금 성별이면 이 길을 아예 안 탄다), 교차 피팅일 때만 돈다.
     목록이 mesh.male·mesh.female을 둘 다 주면 이 길은 영영 안 돌아간다.
   끄기: FIT_WARP.on = false */
const FIT_WARP = {
  'on': true,
  'NY': 48,          // 세로 칸 (발바닥 ~ 목 절단선)
  'NTH': 32,         // 방위 칸 — 소매가 어색하면 48~64로 올린다
  'ease': 0.010,     // 살이 옷을 뚫지 못하게 두는 최소 틈(모델 단위)
  'keepOther': false // true면 반대 성별로 구운 벌도 캐시에 남긴다
};
const _radialCache = new Map();   // gender → 반지름 격자

async function bodyRadialMap(gender) {
  if (_radialCache.has(gender)) return _radialCache.get(gender);
  const b = await loadBodyFigure(gender);
  const y0 = b.box.min.y, y1 = b.cutY, NY = FIT_WARP.NY, NTH = FIT_WARP.NTH;
  const R = new Float32Array(NY * NTH);
  for (const g of b.geoms) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i); if (y < y0 || y > y1) continue;
      const x = p.getX(i) - b.neckCx, z = p.getZ(i) - b.neckCz;
      const r = Math.hypot(x, z); if (!r) continue;
      const iy = Math.min(NY - 1, Math.floor((y - y0) / (y1 - y0) * NY));
      const it = ((Math.floor((Math.atan2(z, x) + Math.PI) / (2 * Math.PI) * NTH)) % NTH + NTH) % NTH;
      if (r > R[iy * NTH + it]) R[iy * NTH + it] = r;
    }
  }
  /* 빈 칸(다리 사이·팔 사이)은 같은 높이의 가까운 방위에서 빌린다. */
  let holes = 0;
  for (let iy = 0; iy < NY; iy++) for (let it = 0; it < NTH; it++) {
    if (R[iy * NTH + it] > 0) continue;
    holes++;
    for (let d = 1; d < NTH; d++) {
      const a = R[iy * NTH + (it + d) % NTH], c = R[iy * NTH + ((it - d) % NTH + NTH) % NTH];
      if (a || c) { R[iy * NTH + it] = Math.max(a, c); break; }
    }
  }
  const rec = { 'R': R, 'y0': y0, 'y1': y1, 'NY': NY, 'NTH': NTH,
                'cx': b.neckCx, 'cz': b.neckCz };
  _radialCache.set(gender, rec);
  console.log('[3D·옷·자] ' + BODY_FIGURES[gender].label + ' 몸 반지름 격자 ' +
    NY + '×' + NTH + ' · 빈 칸 ' + holes + '개는 이웃에서 빌림');
  return rec;
}

/* 격자 한 점 읽기 — 높이는 0(발바닥)~1(목 절단선), 방위는 감아 돈다. */
function _sampleBodyR(m, yn, th) {
  const fy = Math.max(0, Math.min(m.NY - 1e-3, yn * m.NY - 0.5));
  const ft = (th + Math.PI) / (2 * Math.PI) * m.NTH - 0.5;
  const iy = Math.floor(fy), it = Math.floor(ft), wy = fy - iy, wt = ft - it;
  const at = (a, b) => m.R[Math.max(0, Math.min(m.NY - 1, a)) * m.NTH +
                           ((b % m.NTH) + m.NTH) % m.NTH];
  return (at(iy, it) * (1 - wt) + at(iy, it + 1) * wt) * (1 - wy) +
         (at(iy + 1, it) * (1 - wt) + at(iy + 1, it + 1) * wt) * wy;
}

async function fitGarmentToBody(geoms, fitFor, gender) {
  if (!FIT_WARP.on || !fitFor || fitFor === gender) return geoms;
  const src = await bodyRadialMap(fitFor), dst = await bodyRadialMap(gender);
  const s = (dst.y1 - dst.y0) / (src.y1 - src.y0);
  let pushed = 0, total = 0;
  const out = geoms.map(g0 => {
    const g = g0.clone(), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const yn = (p.getY(i) - src.y0) / (src.y1 - src.y0);
      const x = p.getX(i) - src.cx, z = p.getZ(i) - src.cz;
      const th = Math.atan2(z, x);
      let r = Math.hypot(x, z);
      const rs = _sampleBodyR(src, yn, th), rd = _sampleBodyR(dst, yn, th);
      const gap = Math.max(0, r - rs) * s;     // 떠 있던 여유는 지킨다
      r = (rs > 0 && rd > 0) ? rd + gap : r * s;
      const floor = rd + FIT_WARP.ease;
      if (r < floor) { r = floor; pushed++; }  // 살이 뚫고 나오던 자리
      total++;
      p.setXYZ(i, dst.cx + Math.cos(th) * r,
                  dst.y0 + yn * (dst.y1 - dst.y0),
                  dst.cz + Math.sin(th) * r);
    }
    p.needsUpdate = true;
    smoothInflateGeometry(g, 0);               // 법선 다시 (안 하면 각져 보인다)
    return g;
  });
  console.log('[3D·옷·굽기] ' + BODY_FIGURES[fitFor].label + '용 옷 → ' +
    BODY_FIGURES[gender].label + ' 몸 · 세로 ×' + s.toFixed(3) +
    ' · 밀어낸 점 ' + pushed + '/' + total +
    ' (밀어낸 점이 태반이면 그 옷은 이 몸에 너무 작은 것입니다 — 근사로는 여기까지)');
  return out;
}

/* 성별이 바뀌면 반대쪽으로 구운 벌은 버린다(원본은 남긴다 — 다시 읽을 필요가 없다). */
function _pruneGarmentCache(keepGender) {
  if (FIT_WARP.keepOther) return;
  const other = keepGender === 'male' ? 'female' : 'male';
  for (const k of Array.from(_garmentCache.keys())) {
    if (k.endsWith('|' + other)) _garmentCache.delete(k);
  }
}

async function loadGarmentGeometries(part) {
  const offset = part.under ? BODY_BASE.underOffset : BODY_BASE.clothOffset;
  const raw = part.url + '|' + offset;
  if (!_garmentCache.has(raw)) {
    const group = await _loadOBJGroup(part.url);
    const geoms = _collectGeometries(group);
    geoms.forEach(g => smoothInflateGeometry(g, offset));
    _garmentCache.set(raw, geoms);
  }
  /* 견본 옷장 옷에는 fitFor가 없다 — 성별 폴더에서 온 것이라 지금 몸용이 맞다. */
  const fitFor = part.fitFor || BODY_BASE.gender;
  if (!FIT_WARP.on || fitFor === BODY_BASE.gender) return _garmentCache.get(raw);
  const key = raw + '|' + BODY_BASE.gender;
  if (!_garmentCache.has(key)) {
    _garmentCache.set(key,
      await fitGarmentToBody(_garmentCache.get(raw), fitFor, BODY_BASE.gender));
  }
  return _garmentCache.get(key);
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
  _pruneGarmentCache(BODY_BASE.gender);
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
  /* 스위치의 뜻은 하나다 — <b>외투를 입는다/벗는다</b>.
     고른 옷은 "어떤 외투냐"만 정하므로 여기서 놓지 않는다(놓으면 껐다 켠 사이에
     고른 옷이 사라져, 손님 눈에는 스위치가 저 혼자 ON으로 돌아간 것처럼 보였다).
     고른 옷을 아주 벗는 길은 「고른 옷 벗기」 버튼 하나로 둔다. */
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
  bOuter.title = _pickedShopId
    ? '고른 옷(외투)을 입었다 벗깁니다 — 벗어도 고른 옷은 기억해 둡니다'
    : '슈트·재킷을 입었다 벗깁니다 (무슨 옷인지는 추천이 정합니다)';
  bOuter.addEventListener('click', () => toggleBodyOuter());
  rack.appendChild(bOuter);

  /* 고른 옷을 입고 있는 동안은 벗을 길을 열어 둔다. */
  if (_pickedShopId) {
    const bClear = document.createElement('button');
    bClear.type = 'button';
    bClear.textContent = '고른 옷 벗기';
    bClear.title = '쇼핑몰에서 고른 옷을 벗고 추천 의상으로 돌아갑니다';
    bClear.addEventListener('click', () => clearShopPick());
    rack.appendChild(bClear);
  }

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

/* ───────────────────────────────────────────────── 고른 옷 입히기
   예전 판이 여기서 두 가지를 잘못했다.
   ① 고른 옷이 지금 몸의 성별용이 아니면 말없이 버리고 추천으로 돌아갔다.
      쇼핑몰에 남성 옷만 있고 손님 몸이 여자면 "눌러도 아무 일도 안 일어난다".
      성별 구분은 추천이 자동으로 고를 때 쓰는 규칙일 뿐, 손님이 직접 고른 옷에는
      적용하지 않는다 — 남성 재킷이 마음에 든 여자 손님은 그냥 입어 보면 된다.
   ② 손님이 꺼 둔 외투 스위치를 제 마음대로 다시 켰다. 고른 옷은 외투 스위치와
      상관없이 입혀지므로(piecesForOutfit이 먼저 돌려준다) 켤 이유가 없었다. */
function _shopItemById(id, list) {
  if (_pickedShopItem && _pickedShopItem.id === id) return _pickedShopItem;
  return ((list || _shopItems || []).find(it => it && it.id === id)) || null;
}

async function applyShopPick(id, rawItem, origin) {
  if (!id) return false;
  const pid = String(id);

  /* 메시지에 옷 정보가 실려 왔으면 목록보다 그것을 믿는다(목록이 늦거나 없을 수 있다). */
  let inline = null;
  if (rawItem) {
    inline = _normalizeShopItem(Object.assign({ 'id': pid }, rawItem),
      (origin && origin !== 'null' ? origin + '/' : BODY_SHOP.catalogUrl));
  }
  let list = _shopItems || [];
  if (!inline) { try { list = await loadShopCatalog(); } catch (e) { list = _shopItems || []; } }

  const it = inline || list.find(x => x && x.id === pid);
  if (!it) {
    console.warn('[3D·쇼핑몰] 고른 옷(' + pid + ')을 목록에서 못 찾았습니다');
    bodyToast('고른 옷 정보를 받지 못했습니다 (' + pid + ')');
    return false;
  }
  _pickedShopId = pid;
  _pickedShopItem = it;
  _shopItems = (_shopItems || []).filter(x => x.id !== pid).concat([it]);

  if (!_bodyRig) { console.warn('[3D·쇼핑몰] 아직 몸이 안 세워져 고른 옷만 기억해 둡니다'); return true; }

  try {
    await _mountGarment(_bodyRig, _lastBuild && _lastBuild.item);
  } catch (e) {
    console.warn('[3D·쇼핑몰] 갈아입히기 실패:', e);
    bodyToast('옷을 불러오지 못했습니다');
    return false;
  }
  buildBodyGarmentRack(); _updateModel3DTag();
  console.log('[3D·쇼핑몰] 손님이 고른 옷으로 갈아입힘 — ' + pid +
    ' · 외투 스위치는 ' + (BODY_BASE.outer ? 'ON' : 'OFF') + ' 그대로');
  return true;
}

/* 고른 옷을 벗고 추천으로 돌아간다. */
async function clearShopPick() {
  if (!_pickedShopId) return false;
  _pickedShopId = null; _pickedShopItem = null;
  if (!_bodyRig) return false;
  await _mountGarment(_bodyRig, _lastBuild && _lastBuild.item);
  buildBodyGarmentRack(); _updateModel3DTag();
  return true;
}

/* 3D 화면 위에 잠깐 뜨는 알림 — 콘솔만 보고 있을 수는 없다. */
let _toastTimer = null;
function bodyToast(msg) {
  const host = document.getElementById('model3dViewport');
  if (!host || !msg) return;
  let t = document.getElementById('bbToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'bbToast'; t.className = 'bb-toast';
    host.appendChild(t);
  }
  t.textContent = msg;
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { const n = document.getElementById('bbToast'); if (n) n.remove(); }, 4200);
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

    const ok = await applyShopPick(d.id, d.item, ev.origin);
    if (ok && d.close !== false) closeShopPanel();  // 입었으면 옷장 문은 닫는다
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
