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

   ── 변경 이력 ─────────────────────────────────────────────────────────────
   2026-09-21  마지막 원본(가독판) — 이후 10/17~11/02 커밋은 난독화본으로만 올라왔다.
               이 파일은 09-21 원본에 그 사이 바뀐 동작을 옮겨 적고 주석을 다시 단 것이다.
   2026-10-xx  쇼핑몰을 마켓플레이스(workers.dev)로 옮김 — _fromMarketplace로 항목 변환,
               fitted.json(manifest)이 있으면 몸별로 구운 메쉬를 쓰고, 없으면
               _placeShopGeoms가 몸에 맞춰 자동 배치. 추천에는 쇼핑몰 옷을 섞지 않음(recommend).
               리그를 동시에 두 번 세울 때 꼬이던 문제 → _rigSeq / _mountSeq / _liveRig.
   2026-11-14  옷 색: 추천 항목 색 한 가지로 모든 옷을 칠하던 것을 없앰.
               OBJ의 mtllib(MTL: Kd 색·map_Kd 텍스처)와 버텍스 컬러를 그대로 쓴다.
               색 정보가 아무것도 없는 옷만 그 옷 자신의 colorHex → 회색 순으로 칠한다.
   2026-11-14  옷 자리(slot) 나눔 — 고른 옷을 한 벌만 기억하던 것을 자리별로 기억한다.
               자리: lower(하의) · upper(상의) · full(전신·원피스) · outer(외투).
               상의를 고르면 상의 자리만 바뀌고 하의는 그대로, 외투는 안쪽 옷 위에 덧입는다.
               외투 스위치는 외투 자리만 켜고 끈다(안쪽 옷은 언제나 입고 있다).
               견본 슈트처럼 아래위가 한 벌인 외투(coversAll)만 안쪽 옷을 가린다.
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
  /* (2026-10) R2 정적 catalog.json → 마켓플레이스 API로 옮김 */
  'catalogUrl': 'https://tryon-marketplace.choisunfriend.workers.dev/api/products',
  'pageUrl':    'https://tryon-marketplace-web.choisunfriend.workers.dev/shop',
  'assetBase':  'https://tryon-marketplace-web.choisunfriend.workers.dev/',   // 상대경로 메쉬·fitted.json을 푸는 기준
  'timeoutMs': 15000,                  // API가 깨어나는 데 R2보다 오래 걸린다
  /* 성별 구분은 <b>추천이든 손님이 고른 것이든</b> 똑같이 지킨다 —
     남자 몸에는 남성복만, 여자 몸에는 여성복만 얹는다.
     반대 성별 메쉬를 억지로 구워 맞추면(교차 피팅) 어깨가 부풀거나 가슴이 옷을
     뚫는 자리가 남아서, 근사로 덮기보다 아예 안 입히는 쪽을 택한다.
     (false로 두면 고른 옷은 성별을 안 따진다 — 예전 동작) */
  'pickGenderLock': true,
  /* 추천(자동으로 고르는 옷)에 쇼핑몰 옷을 섞을지. false면 추천은 견본 옷장만 쓰고,
     쇼핑몰 옷은 손님이 직접 골랐을 때만 입힌다. */
  'recommend': false
};
/* 손님이 쇼핑몰에서 직접 고른 옷. 추천보다 우선한다(고른 사람이 이긴다).
   null이면 추천이 고른 대로 입는다.
   _pickedShopItem은 쇼핑몰이 목록(catalog.json) 없이 옷 정보를 통째로 보냈을 때 쓴다 —
   목록을 못 받는 상황에서도 "고른 옷"이 입혀져야 한다. */
let _pickedShopId = null;     // 마지막으로 고른 옷 id — "고른 옷이 있다" 표시로도 쓴다
let _pickedShopItem = null;
/* (11-14) 자리별로 고른 옷 { lower?, upper?, full?, outer? } — 값은 앱 꼴 항목 */
let _picks = {};
const SLOT_LABEL = { 'lower': '하의', 'upper': '상의', 'full': '전신', 'outer': '외투' };
function _slotOf(bodyPart, layer) {
  const b = String(bodyPart || '').toLowerCase();
  if (b === 'outer') return 'outer';
  if (b === 'upper_body' || b === 'upper' || b === 'top') return 'upper';
  if (b === 'lower_body' || b === 'lower' || b === 'bottom') return 'lower';
  if (b === 'full_body' || b === 'full' || b === 'dress') return 'full';
  return (layer || 'outer') === 'outer' ? 'outer' : 'upper';
}
let _shopItems = null;     // null=아직 안 읽음, []=읽었는데 없음
let _shopLoading = null;   // 진행 중인 fetch 약속 — 같은 목록을 두 번 읽지 않는다
let _shopFailed = false;   // 한 번 실패했다 → 다음에 다시 시도한다

/* ── 마켓플레이스 항목 → 앱 항목 (2026-10) ───────────────────────────────
   마켓플레이스 API는 아래 catalog.json 꼴이 아니라 DB 행을 그대로 준다:
     { id, name, status, price, currency, gender, model_path,
       media:  '{"model_file":"products/<id>/x.obj", ...}'   ← JSON 문자열일 수 있다
       avatar: '{"gender":"female","body_part":"upper_body","fitted":true}' }
   그걸 앱이 쓰는 {mesh:{male,female}, layer, under, manifest, shop…} 꼴로 바꾼다. */

/* 문자열이면 JSON으로 풀고, 이미 객체면 그대로. 못 풀면 null. */
function _mpParse(v) {
  if (v && typeof v === 'object') return v;
  if (typeof v === 'string') { try { return JSON.parse(v); } catch (e) {} }
  return null;
}

/* 상품 이름 → 쇼핑몰 상품 페이지 주소 조각 ("Navy Jacket" → "navy-jacket") */
function _mpSlug(name) {
  return String(name || '').toLowerCase().trim()
    .replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
}

function _fromMarketplace(row) {
  if (!row || !row.id) return null;
  if (row.mesh) return row;                                   // 이미 앱 꼴(예전 catalog.json·인라인 메시지)
  if (row.status && row.status !== 'active') return null;     // 내린 상품은 안 입힌다
  const media = _mpParse(row.media) || {};
  const avatar = _mpParse(row.avatar) || {};
  const modelPath = String(media.model_file || row.model_path || '').trim();
  if (!modelPath) return null;
  if (!/\.obj(\?|#|$)/i.test(modelPath)) {
    console.warn('[3D·쇼핑몰] ' + row.id + ' 의 3D 파일이 .obj 가 아니라 건너뜁니다(앱은 OBJ만 입힘): ' + modelPath);
    return null;
  }
  /* 같은 사이트의 파일은 /api/assets/ 아래로 서빙된다 — 경로에 없으면 붙여 준다. */
  let url = modelPath;
  try {
    const base = new URL(BODY_SHOP.assetBase);
    const u = new URL(modelPath, base);
    if (u.origin === base.origin && !/^\/api\/assets\//i.test(u.pathname)) {
      u.pathname = '/api/assets/' + u.pathname.replace(/^\/+/, '');
    }
    url = u.href;
  } catch (e) {}

  const g = String(avatar.gender || row.gender || '').toLowerCase();
  const gender = /^(female|woman|women)$/.test(g) ? 'female' : /^(male|man|men)$/.test(g) ? 'male' : 'both';
  const bodyPart = String(avatar.body_part || '').toLowerCase();   // outer | upper_body | lower_body | …
  const layer = bodyPart === 'outer' ? 'outer' : (bodyPart ? 'inner' : 'outer');
  const mesh = {};
  if (gender === 'both') { mesh.male = url; mesh.female = url; }
  else mesh[gender] = url;

  const currency = row.currency || 'KRW';
  const price = typeof row.price === 'number' ? row.price : null;
  /* products/<id>/ 아래에 몸별로 구운 메쉬 목록(fitted.json)이 있을 수 있다 → _shopFitted */
  const m = String(modelPath).match(/products\/([A-Za-z0-9_-]+)\//);
  return {
    'id': String(row.id),
    'name': row.name || String(row.id),
    'gender': gender,
    'layer': layer,
    'under': bodyPart === 'lower_body',      // 하의는 몸에 더 붙여 입힌다(underOffset)
    'bodyPart': bodyPart || null,
    'slot': _slotOf(bodyPart, layer),
    'manifest': m ? new URL('/api/assets/products/' + m[1] + '/fitted.json', BODY_SHOP.assetBase).href : null,
    'fitted': avatar.fitted === true || /\.fitted\.obj(\?|#|$)/i.test(modelPath),
    'colorHex': row.colorHex || null,
    'mesh': mesh,
    'shop': {
      'link': new URL(_mpSlug(row.name), BODY_SHOP.assetBase).href,
      'title': row.name || '이 옷 보기',
      'price': price != null ? price.toLocaleString('ko-KR') + ' ' + currency : null
    }
  };
}

/* 목록 형식 (catalog.json)
   { "version":1,
     "items":[ { "id":"shop-navy-jacket", "name":"네이비 재킷",
                 "gender":"male",          // male | female | both
                 "layer":"outer",          // outer | inner
                 "formal":0.5,             // 0=캐주얼 1=포멀 — 추천의 격식과 맞춰 고른다
                 "colorHex":"#2E3A4E",     // (11-14) OBJ/MTL에 색이 없을 때만 쓴다
                 "mesh":{ "male":"clothes/x_male.obj", "female":"clothes/x_female.obj" },
                 "shop":{ "title":"...", "price":"...", "link":"https://..." } } ] }
   mesh 주소가 상대경로면 catalogUrl 기준으로 푼다. */
/* 목록 항목 하나를 앱이 쓰는 꼴로 다듬는다(상대경로 → 절대경로). */
function _normalizeShopItem(it, baseUrl) {
  it = _fromMarketplace(it);                       // (10월) 마켓플레이스 행이면 먼저 앱 꼴로
  baseUrl = BODY_SHOP.assetBase || baseUrl;
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
      const res = await fetch(BODY_SHOP.catalogUrl, ctl ? { 'signal': ctl.signal } : void 0);
      if (t) clearTimeout(t);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const list = (data && (data.items || data.products)) || [];   // API는 products로 준다
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
   loose=true면 성별 표시(it.gender)까지는 눈감아 주지만, <b>메쉬는 여전히
   이 몸용으로 구운 것만</b> 쓴다 — 반대 성별 메쉬를 빌려다 굽는 길은 없앴다. */
function shopPiece(it, gender, loose) {
  if (!it || !it.mesh) return null;
  if (!loose && it.gender && it.gender !== 'both' && it.gender !== gender) return null;
  /* 이 몸에 물려 구운 메쉬가 없으면 이 옷은 이 몸에 없는 옷이다. */
  const url = it.mesh[gender];
  if (!url) return null;
  /* fitFor — 이 메쉬가 <b>어느 몸에 물려 구운</b> 것이냐. 목록이 직접 적어 두면 그것을
     믿는다. 위에서 mesh[gender]만 골랐으므로 정상 항목이면 언제나 지금 몸과 같다. */
  const fitFor = it.fitFor || gender;
  if (fitFor !== gender) {
    console.warn('[3D·쇼핑몰] ' + it.id + ' 의 mesh.' + gender +
      ' 가 fitFor=' + fitFor + ' 로 적혀 있습니다 — 교차 피팅은 하지 않으므로 건너뜁니다');
    return null;
  }
  return { 'id': it.id, 'name': it.name, 'formal': typeof it.formal === 'number' ? it.formal : 0.5,
           'url': url, 'colorHex': it.colorHex || null, 'layer': it.layer || 'outer',
           'fitFor': fitFor, 'shop': it.shop || null,
           'fitted': !!it.fitted,              // 이미 몸에 맞춰 구운 메쉬인가
           'bodyPart': it.bodyPart || null,
           'slot': it.slot || _slotOf(it.bodyPart, it.layer),
           'manifest': it.manifest || null,    // 몸별 구운 메쉬 목록(fitted.json) 주소
           'under': !!it.under,
           'fromShop': true };
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
      { 'id': 'm-suit',   'name': '슈트', 'formal': 0.95, 'coversAll': true, 'url': './assets/fitted/male/suit3.fitted.obj' },
      { 'id': 'm-jacket', 'name': '재킷', 'formal': 0.45, 'coversAll': true, 'url': './assets/fitted/male/suit_dinner_jacket.fitted.obj' }
    ],
    'inner': [
      { 'id': 'm-jeans', 'name': '청바지', 'slot': 'lower', 'under': true, 'colorHex': '#3E4E6B',
        'url': './assets/fitted/male/mens_elv_jeans2slf.fitted.obj' },
      { 'id': 'm-top',   'name': '상의', 'slot': 'upper', 'url': './assets/fitted/male/mycenaean_tunic.fitted.obj' }
    ]
  },
  'female': {
    'outer': [
      { 'id': 'f-suit',  'name': '슈트', 'formal': 0.95, 'coversAll': true, 'url': './assets/fitted/female/fem_suit2.fitted.obj' },
      { 'id': 'f-dress', 'name': '원피스 슈트', 'formal': 0.55, 'coversAll': true,
        'url': './assets/fitted/female/female_elegantsuit01.fitted.obj' }
    ],
    /* 여자 안쪽 한 벌은 상·하의가 한 메쉬다(MakeHuman female_casualsuit01).
       예전에는 남성용 튜닉 + 청바지를 빌려 썼는데, 가슴이 옷을 뚫고 나와 여유를 계속
       올리다 보니 어깨가 부풀었다. 이 옷은 처음부터 여자 체형에 물려 있어 그 문제가 없다. */
    'inner': [
      { 'id': 'f-casual', 'name': '캐주얼', 'slot': 'full', 'url': './assets/fitted/female/female_casualsuit01.fitted.obj' }
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
   (11-14) 색은 여기서 정하지 않는다. 예전엔 추천 항목의 colorHex(tint)를 모든 옷에
   덮어써서 무엇을 입혀도 같은 색이었다. 이제 각 옷은 자기 colorHex만 들고 가고,
   실제 색은 _mountGarment가 OBJ/MTL에서 읽는다. */
async function piecesForOutfit(item) {
  const gender = BODY_BASE.gender;
  const w = BODY_WARDROBE[gender] || BODY_WARDROBE.male;
  const shop = await loadShopCatalog();
  /* 추천에 쇼핑몰 옷을 섞는 건 BODY_SHOP.recommend가 켜졌을 때만 */
  const shopFor = layer => (BODY_SHOP.recommend ? shop : []).map(it => shopPiece(it, gender))
                               .filter(p => p && (p.layer || 'outer') === layer);

  /* (11-14) 쇼핑몰에서 고른 옷 — 자리별로. 이 몸에 입힐 메쉬가 없는 옷은 그 자리만 비운다. */
  const picked = {};
  for (const slot of Object.keys(_picks)) {
    const raw = _picks[slot];
    const hit = raw && shopPiece(raw, gender, !BODY_SHOP.pickGenderLock);
    if (hit) { picked[slot] = Object.assign({}, hit, { 'slot': slot }); continue; }
    console.warn('[3D·쇼핑몰] 고른 ' + SLOT_LABEL[slot] + '(' + (raw && raw.id) + ')에 ' +
      BODY_FIGURES[gender].label + ' 몸용 메쉬가 없어 이 몸에서는 빼고 입힙니다');
    bodyToast('고른 ' + SLOT_LABEL[slot] + '는 ' + BODY_FIGURES[gender].label + ' 몸용이 아니라 빼고 입힙니다');
  }
  const anyPick = Object.keys(picked).length > 0;

  /* 안쪽 옷 — 견본 한 벌을 바탕에 깔고, 고른 자리만 바꾼다.
     상의를 고르면 상의만, 하의를 고르면 하의만. 전신(원피스)은 상·하의 둘 다를 대신한다. */
  const inner = {};
  const baseInner = shopFor('inner').length ? shopFor('inner') : (w.inner || []);
  for (const p of baseInner) inner[p.slot || _slotOf(p.bodyPart, p.layer)] = Object.assign({}, p);
  if (picked.full) { delete inner.upper; delete inner.lower; inner.full = picked.full; }
  if (picked.upper) inner.upper = picked.upper;   // 바탕이 전신(여자 캐주얼)이면 그 위에 덧입는다
  if (picked.lower) inner.lower = picked.lower;
  /* 바탕이 전신 한 벌인데 상의·하의를 둘 다 골랐으면 바탕 전신은 벗긴다 */
  if (inner.full && !picked.full && picked.upper && picked.lower) delete inner.full;

  /* 외투 — 스위치가 켜졌을 때만. 고른 외투가 있으면 그것, 아무것도 안 골랐으면 추천 견본.
     안쪽 옷만 고른 손님에게 추천 슈트를 덮어 씌우면 고른 옷이 가려지므로 씌우지 않는다. */
  let outer = null;
  if (BODY_BASE.outer) {
    if (picked.outer) outer = picked.outer;
    else if (!anyPick) {
      const cands = (w.outer || []).concat(shopFor('outer'));
      if (cands.length) {
        const f = outfitFormality(item);
        let best = cands[0], bd = Infinity;
        for (const o of cands) { const d = Math.abs(o.formal - f); if (d < bd) { bd = d; best = o; } }
        outer = Object.assign({}, best);
      }
    }
  }

  /* 안에서 밖으로: 하의 → 전신 → 상의 → 외투. 아래위 한 벌 외투(견본 슈트)는 안쪽을 다 가린다. */
  const parts = outer && outer.coversAll
    ? [outer]
    : [inner.lower, inner.full, inner.upper, outer].filter(Boolean);
  const names = parts.map(p => p.name);
  const wornShop = (outer && outer.fromShop && outer.shop) ||
    ((picked.upper || picked.full || picked.lower || {}).shop) || (parts[0] && parts[0].shop) || null;
  return { 'label': parts.length ? names.join(' + ') + (anyPick ? ' · 고름' : '') : '맨몸',
           'shop': wornShop, 'parts': parts, 'hasOuterPick': !!picked.outer, 'anyPick': anyPick };
}

/* ------------------------------------------------------------ 불러오기 */
const _figureCache = new Map();   // gender → {geoms, box, cutY, neckCx, neckCz}
const _garmentCache = new Map();  // url|offset(|gender) → [BufferGeometry]
let _bodyRig = null, _bodyWornLabel = '', _bodyWornShop = null, _lastBuild = null;

/* OBJ를 읽는다. withMtl=true면 (11-14) 파일 안의 `mtllib`를 찾아 MTLLoader로
   재질(Kd 색, map_Kd 텍스처)까지 읽어서 붙인다 — 옷이 원래 색으로 나오는 길.
   MTL 경로는 OBJ 파일과 같은 폴더 기준. MTL을 못 읽어도 실패하지 않고 재질 없이 간다.
   몸(body_*.obj)은 피부색을 따로 칠하므로 withMtl 없이 부른다. */
function _loadOBJGroup(objUrl, withMtl) {
  return new Promise((resolve, reject) => {
    if (typeof THREE === 'undefined' || typeof THREE.OBJLoader !== 'function') {
      reject(new Error('OBJLoader가 없습니다')); return;
    }
    if (!withMtl || typeof THREE.MTLLoader !== 'function') {
      new THREE.OBJLoader().load(encodeURI(objUrl), resolve, undefined, reject);
      return;
    }
    const href = new URL(encodeURI(objUrl), location.href).href;
    const base = href.slice(0, href.lastIndexOf('/') + 1);
    fetch(href)
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + objUrl); return r.text(); })
      .then(text => {
        const m = text.match(/^mtllib[ \t]+(.+?)[ \t]*$/m);
        const parse = mats => {
          const loader = new THREE.OBJLoader();
          if (mats) loader.setMaterials(mats);
          const group = loader.parse(text);
          group.userData.hasMtl = !!mats;      // _collectGeometries가 재질을 챙길지 판단
          resolve(group);
        };
        if (!m) return parse(null);
        const ml = new THREE.MTLLoader();
        ml.setResourcePath(base); ml.setPath(base);
        ml.load(m[1], mats => {
          try { mats.preload(); } catch (e) {}
          parse(mats);
        }, undefined, err => {
          console.warn('[3D·옷] 재질(mtl) 불러오기 실패 — 재질 없이 씁니다: ' + m[1], err);
          parse(null);
        });
      })
      .catch(reject);
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

/* (11-14) 옷의 원래 재질을 geometry.userData.srcMaterial에 붙여 둔다.
   MTL을 읽었거나 버텍스 컬러가 있을 때만 — 아무 정보 없는 OBJLoader 기본 재질(흰색)은
   "원래 색"이 아니므로 붙이지 않는다. geometry.clone()은 userData를 같이 복사하므로
   캐시·복제·굽기(fitGarmentToBody)를 거쳐도 따라온다. */
function _collectGeometries(group) {
  const geoms = [];
  group.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    if ((group.userData && group.userData.hasMtl) || o.geometry.attributes.color) {
      o.geometry.userData.srcMaterial = o.material;
    }
    geoms.push(o.geometry);
  });
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

/* ------------------------------------------------- 다른 몸에 옮겨 굽기 (기본 꺼짐)
   반입 단계의 tools/conform.py가 옷을 <b>한</b> 몸(fitFor)에 물려 굽는다. 남자 옷은
   남자 몸에 물려 구운 그대로 쓰고, 여자 옷은 여자 몸에 물려 구운 그대로 쓴다 —
   지금은 성별이 안 맞으면 굽지 않고 아예 안 입힌다(BODY_SHOP.pickGenderLock=true,
   FIT_WARP.crossGender=false). 아래 길은 그 규칙을 일부러 풀었을 때만 돈다.

   두 몸은 정점 번호가 안 맞으므로(남 9529 / 여 9450) conform.py처럼 같은 번호로 옮길 수
   없다. 대신 몸을 <b>높이 × 방위</b> 칸으로 재서 칸마다 겉 반지름을 하나 두고, 옷의 점을
   같은 칸의 반지름 비율만큼 옮긴다. 가슴은 앞쪽 방위에서만 커지므로 그 자리만 부풀고
   허리는 그대로 들어간다. 옷이 몸에서 떠 있던 여유(gap)는 그대로 지킨다.

   ※ 이건 <b>근사</b>다 — 어깨가 부풀거나 가슴이 옷을 뚫는 자리가 남는다. 그래서 기본을
     끔으로 두었다. 다시 켜려면 FIT_WARP.crossGender = true. */
const FIT_WARP = {
  'on': true,
  'crossGender': false, // true라야 반대 성별로 구운 옷을 굽는다 — 기본은 아예 안 입힌다
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

/* ── 쇼핑몰 옷 자동 배치 (2026-10) ────────────────────────────────────────
   업체가 올린 OBJ는 크기·원점·축이 제각각이다(cm 단위, Z-up, 원점이 발밑…).
   몸에 맞춰 구운(fitted) 메쉬가 없을 때, 어깨폭(하의는 허리폭)을 맞춰 크기를 정하고
   목 절단선(하의는 허리선)에 위쪽 끝을 붙인 뒤, 살을 뚫는 점만 바깥으로 민다.
   근사일 뿐이다 — 제대로 하려면 tools/로 fitted 메쉬를 구워 올려야 한다. */

/* 높이 y0~y1 띠 안 정점들의 가로폭. 소매·팔처럼 떨어진 덩어리는 빼고
   중심(centerX)에서 이어진 몸통 덩어리만 잰다(히스토그램 칸이 1칸 이상 비면 끊김). */
function _bandWidth(geoms, y0, y1, centerX) {
  const xs = [], zs = [];
  for (const g of geoms) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      if (y < y0 || y > y1) continue;
      xs.push(p.getX(i)); zs.push(p.getZ(i));
    }
  }
  if (!xs.length) return null;
  let lo = Infinity, hi = -Infinity;
  for (const x of xs) { if (x < lo) lo = x; if (x > hi) hi = x; }
  const bins = Math.max(6, Math.min(80, Math.floor(xs.length / 6)));
  const step = (hi - lo) / bins || 1;
  const filled = new Uint8Array(bins);
  for (const x of xs) filled[Math.min(bins - 1, Math.floor((x - lo) / step))] = 1;
  /* 중심 칸에서 시작 — 비어 있으면 가장 가까운 찬 칸으로 */
  const cx0 = typeof centerX === 'number' ? centerX : (lo + hi) / 2;
  let c = Math.max(0, Math.min(bins - 1, Math.floor((cx0 - lo) / step)));
  if (!filled[c]) {
    let d = 1;
    while (d < bins && !(filled[c + d] || filled[c - d])) d++;
    c = filled[c + d] ? c + d : c - d;
  }
  /* 좌우로 넓힌다 — 빈 칸 하나까지는 이어진 것으로 본다 */
  let a = c, b = c;
  while (a > 0 && (filled[a - 1] || (a > 1 && filled[a - 2]))) a--;
  while (b < bins - 1 && (filled[b + 1] || (b < bins - 2 && filled[b + 2]))) b++;
  const x0 = lo + a * step, x1 = lo + (b + 1) * step;
  let zSum = 0, n = 0;
  for (let i = 0; i < xs.length; i++) if (xs[i] >= x0 && xs[i] <= x1) { zSum += zs[i]; n++; }
  return { 'w': x1 - x0, 'cx': (x0 + x1) / 2, 'cz': n ? zSum / n : 0, 'n': n };
}

/* 여러 지오메트리를 합친 경계 상자 */
function _geomsBox(geoms) {
  const b = { 'minX': Infinity, 'minY': Infinity, 'minZ': Infinity,
              'maxX': -Infinity, 'maxY': -Infinity, 'maxZ': -Infinity };
  for (const g of geoms) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      if (x < b.minX) b.minX = x; if (x > b.maxX) b.maxX = x;
      if (y < b.minY) b.minY = y; if (y > b.maxY) b.maxY = y;
      if (z < b.minZ) b.minZ = z; if (z > b.maxZ) b.maxZ = z;
    }
  }
  return b;
}

/* geoms(쇼핑몰 옷)를 fig(표준 몸) 좌표에 맞춰 제자리에서 옮긴다. radial = bodyRadialMap 결과(없어도 됨) */
function _placeShopGeoms(geoms, part, fig, radial) {
  let gb = _geomsBox(geoms);
  if (!isFinite(gb.minY)) return geoms;
  const bb = fig._bb || (fig._bb = _geomsBox(fig.geoms));
  const bodyH = bb.maxY - bb.minY, bodyW = bb.maxX - bb.minX, gW = gb.maxX - gb.minX;
  const isLower0 = part.bodyPart === 'lower_body' || part.under;

  /* 이미 몸 좌표에 놓인 옷(몸 상자 안 · 적당한 크기 · 가운데 정렬)이면 손대지 않는다. */
  if (gb.minY >= bb.minY - 0.05 * bodyH && gb.maxY <= bb.maxY + 0.05 * bodyH &&
      gb.minX >= bb.minX - 0.1 * bodyW && gb.maxX <= bb.maxX + 0.1 * bodyW &&
      gb.maxY - gb.minY >= 0.15 * bodyH && gW >= 0.25 * bodyW &&
      (isLower0 || gb.maxY >= fig.cutY - 0.25 * bodyH) &&
      Math.abs((gb.minX + gb.maxX) / 2 - (bb.minX + bb.maxX) / 2) < 0.05 * bodyW) {
    return geoms;
  }

  /* 앞뒤(z)가 키(y)보다 한참 길면 Z-up으로 저장된 파일이다 → y↔z 돌려 세운다. */
  if (gb.maxZ - gb.minZ > 1.5 * (gb.maxY - gb.minY)) {
    for (const g of geoms) {
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i), p.getZ(i), -p.getY(i));
    }
    gb = _geomsBox(geoms);
  }

  const gH = gb.maxY - gb.minY;
  const torso = fig.cutY - fig.box.min.y;          // 목 절단선 ~ 발바닥
  const isLower = part.bodyPart === 'lower_body' || part.under;
  /* 옷 위쪽 끝을 붙일 높이: 하의 = 허리(발바닥에서 77%), 상의 = 목 절단선 살짝 위 */
  const topY = isLower ? fig.box.min.y + 0.77 * torso : fig.cutY + 0.02 * torso;
  /* 몸 쪽 기준 폭: 하의 = 허리 띠, 상의 = 어깨 띠 */
  const bodyBand = isLower
    ? _bandWidth(fig.geoms, topY - 0.05 * torso, topY, fig.neckCx)
    : _bandWidth(fig.geoms, fig.cutY - 0.13 * torso, fig.cutY - 0.06 * torso, fig.neckCx);
  /* 옷 쪽 기준 폭: 위에서부터 띠를 넓혀 가며 점이 충분히(12개+) 잡힐 때까지 */
  const garBand = (() => {
    for (const k of [1, 2, 3]) {
      const b = _bandWidth(geoms, gb.maxY - (isLower ? 0.06 : 0.14) * k * gH,
                                  gb.maxY - (isLower ? 0 : 0.06) * gH);
      if (b && b.n >= 12) return b;
    }
    return _bandWidth(geoms, gb.maxY - 0.4 * gH, gb.maxY);
  })();

  /* 배율 = 몸 폭 / 옷 폭 (+여유 2~4%). 폭을 못 재면 상의 길이(몸통 42%)로 */
  let s = (bodyBand && garBand && garBand.w > 0)
    ? bodyBand.w / garBand.w * (isLower ? 1.04 : 1.02)
    : torso * 0.42 / gH;

  /* 그 배율로 옷 길이가 말이 안 되면(몸통의 15% 미만 / 130% 초과) 폭 측정이 틀린 것 →
     하의·상의·전신 중 길이가 가장 가까운 것으로 보고 길이로 맞춘다. */
  const lenRatio = s * gH / torso;
  let fullBody = false;
  if (!(lenRatio > 0.15 && lenRatio < 1.3)) {
    const reach = topY - fig.box.min.y;
    const kinds = isLower ? [['하의', 0.5 * torso]]
                          : [['상의', 0.4 * torso], ['전신', 0.97 * reach]];
    let best = kinds[0];
    for (const k of kinds) {
      if (Math.abs(Math.log(k[1] / (lenRatio * torso))) < Math.abs(Math.log(best[1] / (lenRatio * torso)))) best = k;
    }
    fullBody = best[0] === '전신';
    console.warn('[3D·쇼핑몰·맞춤] ' + part.id + ' 폭 기준 배율이 이상해(키 대비 ' + lenRatio.toFixed(2) +
      ') → 가장 가까운 「' + best[0] + '」 길이로 맞춥니다');
    s = best[1] / gH;
  }
  /* 세로로 길쭉한 상의(원피스·코트)는 길이를 발목까지로 맞춘다 */
  const tall = !isLower && (fullBody || gH / Math.max(1e-6, gb.maxX - gb.minX) > 2.2);
  if (tall) s = (topY - fig.box.min.y) * 0.97 / gH;
  /* 어떤 경우에도 발바닥 아래로는 안 내려가게 */
  const sMax = (topY - fig.box.min.y) * 0.99 / gH;
  if (s > sMax) s = sMax;

  /* 옮기기: 옷 띠의 중심 → 몸의 목 중심(x)·띠 중심(z), 위쪽 끝 → topY */
  const gcx = garBand ? garBand.cx : (gb.minX + gb.maxX) / 2;
  const gcz = garBand ? garBand.cz : (gb.minZ + gb.maxZ) / 2;
  const bcx = fig.neckCx;
  const bcz = bodyBand ? bodyBand.cz : fig.neckCz;
  for (const g of geoms) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = (p.getX(i) - gcx) * s + bcx;
      const y = (p.getY(i) - gb.maxY) * s + topY;
      const z = (p.getZ(i) - gcz) * s + bcz;
      let nx = x, nz = z;
      /* 살 안쪽으로 들어간 점만 몸 반지름 + 여유(FIT_WARP.ease)까지 바깥으로 민다.
         너무 깊이(반지름 30% 이상) 박힌 점은 팔·다리 사이일 수 있어 건드리지 않는다. */
      if (radial && y >= radial.y0 && y <= radial.y1) {
        const dx = x - radial.cx, dz = z - radial.cz;
        const r = Math.hypot(dx, dz), th = Math.atan2(dz, dx);
        const rb = _sampleBodyR(radial, (y - radial.y0) / (radial.y1 - radial.y0), th);
        const floor = rb + FIT_WARP.ease;
        if (r > 1e-6 && r < floor && floor - r < 0.3 * rb) {
          nx = radial.cx + dx / r * floor;
          nz = radial.cz + dz / r * floor;
        }
      }
      p.setXYZ(i, nx, y, nz);
    }
    p.needsUpdate = true;
    if (g.computeBoundingBox) g.computeBoundingBox();
    if (g.computeBoundingSphere) g.computeBoundingSphere();
  }
  return geoms;
}

async function _autoPlaceShopGeoms(geoms, part) {
  const gender = BODY_BASE.gender;
  const fig = await loadBodyFigure(gender);
  let radial = null;
  try { radial = await bodyRadialMap(gender); } catch (e) {}
  return _placeShopGeoms(geoms, part, fig, radial);
}

/* 상품 폴더의 fitted.json — { "male": "products/<id>/male.fitted.obj", "female": "…", "bakedAt": … }
   있으면 그 몸에 맞춰 미리 구운 메쉬 주소를 돌려준다(없으면 null → 자동 배치로). */
const _shopFittedCache = new Map();
function _shopFitted(manifestUrl, gender) {
  if (!_shopFittedCache.has(manifestUrl)) {
    _shopFittedCache.set(manifestUrl,
      fetch(manifestUrl, { 'cache': 'no-cache' })
        .then(r => r.ok ? r.json() : null)
        .catch(() => null));
  }
  return _shopFittedCache.get(manifestUrl).then(j => {
    const path = j && j[gender];
    if (!path) return null;
    return new URL('/api/assets/' + String(path).split('/').map(encodeURIComponent).join('/'),
                   BODY_SHOP.assetBase).href;
  });
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
  /* (10월) 쇼핑몰 옷: fitted.json에 이 몸용 구운 메쉬가 있으면 그걸로 바꿔 입는다. */
  if (part && part.fromShop && !part.fitted && part.manifest) {
    const fittedUrl = await _shopFitted(part.manifest, BODY_BASE.gender);
    if (fittedUrl) part = Object.assign({}, part, { 'url': fittedUrl, 'fitted': true });
  }
  const offset = part.under ? BODY_BASE.underOffset : BODY_BASE.clothOffset;
  /* 자동 배치한 옷은 몸마다 결과가 달라서 캐시 키에 성별을 붙인다 */
  const raw = part.url + '|' + offset +
    (part.fromShop && !part.fitted ? '|place|' + BODY_BASE.gender : '');
  if (!_garmentCache.has(raw)) {
    const group = await _loadOBJGroup(part.url, true);     // (11-14) MTL까지 — 원래 색
    const geoms = _collectGeometries(group);
    if (!geoms.length) throw new Error('옷 메쉬가 비어 있습니다: ' + part.url);
    if (part.fromShop && !part.fitted) await _autoPlaceShopGeoms(geoms, part);
    geoms.forEach(g => smoothInflateGeometry(g, offset));
    _garmentCache.set(raw, geoms);
  }
  /* 견본 옷장 옷에는 fitFor가 없다 — 성별 폴더에서 온 것이라 지금 몸용이 맞다. */
  const fitFor = part.fitFor || BODY_BASE.gender;
  if (fitFor === BODY_BASE.gender) return _garmentCache.get(raw);
  /* 여기부터는 반대 성별로 구운 옷이다. 기본값(crossGender=false)에서는 굽지 않고
     건너뛴다 — 남자 옷은 남자 몸에서만 comfort(conform)로 맞춘 그대로 쓴다. */
  if (!FIT_WARP.on || !FIT_WARP.crossGender) {
    throw new Error(BODY_FIGURES[fitFor].label + '용 옷은 ' +
      BODY_FIGURES[BODY_BASE.gender].label + ' 몸에 입히지 않습니다');
  }
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
/* 색 정보가 전혀 없는 옷에만 쓰는 단색 재질 (colorHex 없으면 회색) */
function _clothMaterial(colorHex, clip) {
  const m = new THREE.MeshStandardMaterial({
    'color': new THREE.Color(colorHex || '#7A7F88'), 'roughness': 0.82, 'metalness': 0,
    'side': THREE.DoubleSide });
  if (clip) { m.clippingPlanes = [clip]; m.clipShadows = true; }
  return m;
}

/* (11-14) 옷의 원래 재질(MTL에서 온 MeshPhongMaterial 등)을 몸·피부와 같은
   MeshStandardMaterial로 옮긴다 — 색(Kd)·텍스처(map_Kd)·버텍스 컬러·투명도는 그대로,
   양면·목 절단 클립만 덧붙인다. 원래 재질이 없으면(src=null) 단색 재질로.
   재질이 여러 개인 메쉬(셔츠+바지 등)는 배열로 받아 배열로 돌려준다(geometry groups). */
function _garmentMaterialFrom(src, colorHex, clip) {
  const one = m => {
    const mat = new THREE.MeshStandardMaterial({
      'color': (m && m.color) ? m.color.clone() : new THREE.Color(0xffffff),
      'map': (m && m.map) || null,
      'vertexColors': !!(m && m.vertexColors),
      'transparent': !!(m && m.transparent && m.opacity < 1),
      'opacity': (m && typeof m.opacity === 'number') ? m.opacity : 1,
      'roughness': 0.82, 'metalness': 0,
      'side': THREE.DoubleSide
    });
    /* 텍스처는 sRGB — 안 맞추면 색이 바래 보인다 */
    if (mat.map && THREE.sRGBEncoding !== undefined) { mat.map.encoding = THREE.sRGBEncoding; mat.map.needsUpdate = true; }
    if (m && m.name) mat.name = m.name;
    if (clip) { mat.clippingPlanes = [clip]; mat.clipShadows = true; }
    return mat;
  };
  if (!src) return _clothMaterial(colorHex, clip);
  return Array.isArray(src) ? src.map(one) : one(src);
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
  /* (10월) 옷 갈아입히기가 겹쳐 불리면(빠르게 두 번 누름) 늦게 끝난 앞 호출이
     뒤 호출의 옷을 덮거나 옷이 두 벌 겹쳤다. 호출마다 번호를 매기고, 기다리는 사이
     더 새 호출이 왔으면(stale) 자기가 만든 걸 치우고 빠진다. */
  const seq = rig.userData._mountSeq = (rig.userData._mountSeq || 0) + 1;
  const stale = () => rig.userData._mountSeq !== seq;
  const clip = rig.userData.clipPlane;
  for (let old; (old = rig.getObjectByName('bodyGarment'));) _detach(rig, old);   // 남은 것 전부
  const holder = new THREE.Group();
  holder.name = 'bodyGarment';
  rig.add(holder);
  const pick = await piecesForOutfit(item);
  if (stale()) { _detach(rig, holder); return holder; }
  for (const part of pick.parts) {
    let geoms;
    try { geoms = await loadGarmentGeometries(part); }
    catch (e) { console.warn('[3D·옷] 불러오기 실패 — 건너뜁니다: ' + part.url, e); continue; }
    if (stale()) { _detach(rig, holder); return holder; }
    /* (11-14) 옷마다 원래 재질로 — 예전엔 모든 옷을 _clothMaterial(한 색)로 칠했다 */
    _cloned(geoms).forEach((g, i) => {
      const src = (g.userData && g.userData.srcMaterial) ||
                  (geoms[i] && geoms[i].userData && geoms[i].userData.srcMaterial);
      holder.add(new THREE.Mesh(g, _garmentMaterialFrom(src, part.colorHex, clip)));
    });
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
    if (typeof _rigSeq !== 'undefined') _rigSeq++;    // 진행 중인 rebuildBodyRig는 무효
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
  const base = tag.textContent.replace(/\s*·\s*(몸|Body)\s*:.*$/, '');   // 영어 UI(Body:)도 지운다
  tag.textContent = base + ' · 몸: ' + BODY_FIGURES[BODY_BASE.gender].label +
    ' · ' + _bodyWornLabel;
}

/* (10월) _bodyRig 변수가 씬에 실제로 붙은 리그와 어긋나는 일이 있었다
   (다시 세우는 도중 화면이 바뀜 등). 씬에서 직접 찾아 그쪽을 믿는다. */
function _liveRig() {
  try {
    const host = typeof model3D !== 'undefined' && model3D && model3D.headGroup;
    const rig = host && host.getObjectByName('bodyBaseRig');
    if (rig) { _bodyRig = rig; return rig; }
  } catch (e) {}
  return _bodyRig;
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
  if (BODY_BASE.outer && Object.keys(_picks).length && !_picks.outer) {
    bodyToast('고른 외투가 없어요 — 쇼핑몰에서 외투를 고르면 지금 옷 위에 입혀집니다');
  }
  if (!_bodyRig) return false;
  await _mountGarment(_liveRig(), _lastBuild && _lastBuild.item);
  buildBodyGarmentRack(); _updateModel3DTag();
  return true;
}

/* 성별이 바뀌면 몸 자체가 바뀌므로 리그를 다시 세운다.
   (10월) 남/여를 빠르게 연달아 누르면 리그가 두 개 붙었다 → 번호(_rigSeq)로
   가장 마지막 호출만 붙이고, 붙일 때 남아 있는 bodyBaseRig는 전부 뗀다. */
let _rigSeq = 0;
async function rebuildBodyRig() {
  if (!_lastBuild || typeof model3D === 'undefined' || !model3D || !model3D.headGroup) return false;
  const seq = ++_rigSeq;
  const host = model3D.headGroup;
  let rig;
  try { rig = await buildBodyBaseRig(_lastBuild.item, _lastBuild.wf, _lastBuild.len); }
  catch (e) { console.warn('[3D·몸] 다시 세우기 실패 — 그대로 둡니다:', e); return false; }
  if (seq !== _rigSeq) { _detach(host, rig); _liveRig(); return false; }   // 더 새 호출이 있다
  for (let old; (old = host.getObjectByName('bodyBaseRig'));) _detach(host, old);
  _bodyRig = rig;
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
    ? '외투만 입었다 벗깁니다 — 안쪽 상의·하의는 그대로, 벗어도 고른 외투는 기억해 둡니다'
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
  frame.setAttribute('allow', 'geolocation');      // (11월) 미용실 지도가 위치를 쓴다
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
    /* (10월) 패널 전체를 가리던 안내를 아래쪽 작은 띠로 — 늦게라도 뜨면 그대로 보이게 */
    note.style.cssText = 'position:absolute;left:50%;bottom:12px;top:auto;right:auto;transform:translateX(-50%);' +
      'width:auto;height:auto;max-width:92%;padding:8px 12px;border-radius:10px;background:rgba(20,18,16,.88);' +
      'color:#eee;display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:center;z-index:5;' +
      'font-size:12px;pointer-events:auto;';
    const p = document.createElement('p');
    p.textContent = '쇼핑몰이 느리게 열리고 있습니다. 계속 비어 있으면 →';
    p.style.margin = '0';
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

  /* (11-14) 고른 옷은 제 자리만 바꾼다 — 상의를 고르면 하의·외투는 그대로 */
  const slot = it.slot || _slotOf(it.bodyPart, it.layer);
  if (slot === 'full') { delete _picks.upper; delete _picks.lower; }
  if (slot === 'upper' || slot === 'lower') delete _picks.full;
  _picks[slot] = it;
  /* 외투를 골랐는데 스위치가 꺼져 있으면 아무것도 안 바뀐 것처럼 보인다 → 켠다 */
  if (slot === 'outer' && !BODY_BASE.outer) {
    BODY_BASE.outer = true;
    bodyToast('외투를 골라서 외투 스위치를 켰어요');
  }

  if (!_bodyRig) { console.warn('[3D·쇼핑몰] 아직 몸이 안 세워져 고른 옷만 기억해 둡니다'); return true; }

  try {
    await _mountGarment(_liveRig(), _lastBuild && _lastBuild.item);
  } catch (e) {
    console.warn('[3D·쇼핑몰] 갈아입히기 실패:', e);
    bodyToast('옷을 불러오지 못했습니다');
    return false;
  }
  buildBodyGarmentRack(); _updateModel3DTag();
  console.log('[3D·쇼핑몰] 손님이 고른 ' + SLOT_LABEL[slot] + '로 갈아입힘 — ' + pid +
    ' · 외투 스위치는 ' + (BODY_BASE.outer ? 'ON' : 'OFF') + ' 그대로');
  return true;
}

/* 고른 옷을 벗고 추천으로 돌아간다. */
async function clearShopPick() {
  if (!_pickedShopId && !Object.keys(_picks).length) return false;
  _pickedShopId = null; _pickedShopItem = null; _picks = {};
  if (!_bodyRig) return false;
  await _mountGarment(_liveRig(), _lastBuild && _lastBuild.item);
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
  _pickedShopId = null; _pickedShopItem = null; _picks = {}; closeShopPanel();
  const rack = document.getElementById('bodyGarmentRack');
  if (rack) rack.remove();
}
