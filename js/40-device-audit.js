/* ==========================================================================
 * 40-device-audit.js — DEVICE_AUDIT (2026-11-08) 가림 장치 점검표
 *
 * 왜: 사용자 — "몰라서 니들을 이용하는 건데" · 결과를 사후에 고쳐 원인을 가리던 장치(끝 벌리기·등으로 밀기·복제 채움 …)를
 *     껐다고 말로만 하지 않고, 켜짐/꺼짐을 앱이 직접 찍게 함. 디버그 내보내기에도 같은 표(H.devices)가 실림.
 * 표 읽는 법: [끔]이어야 할 장치가 [켜짐]이면 누가 다시 켠 것 · '남김'은 가림이 아니라 읽기·형상 쪽이라 일부러 둔 것(이유를 같이 적음)
 * 콘솔 DEVICE_AUDIT.lines().join("\n")
 * ========================================================================== */
var DEVICE_AUDIT = (function () {
  'use strict';
  var W = window, TAG = '[가림 장치 점검]';
  function g(path) { try { var o = W, p = path.split('.'); for (var i = 0; i < p.length; i++) { if (o == null) return undefined; o = o[p[i]]; } return o; } catch (e) { return undefined; } }
  function gl(name) { try { return eval('typeof ' + name + ' !== "undefined" ? ' + name + ' : undefined'); } catch (e) { return undefined; } }   // const·let 전역(창 속성 아님)
  function v(name, key) { var o = gl(name); if (o === undefined) o = g(name); if (o === undefined || o === null) return undefined; return key ? o[key] : o; }
  // [이름, 설명, 끄는 값을 읽는 법, 기대(false = 꺼져 있어야 함)]
  var OFF = [
    ['TIP_FLARE.on', '끝을 옆으로 벌려 폭을 사진에 맞춤', function () { return v('TIP_FLARE', 'on'); }],
    ['SHOULDER.on', '몸을 뚫는 가닥을 등 쪽으로 밂', function () { return v('SHOULDER', 'on'); }],
    ['GLOSS_WAVE.on', '다 그린 가닥 잔결 지우기·웨이브 키우기', function () { return v('GLOSS_WAVE', 'on'); }],
    ['FLY_TRIM.on', '곱슬 삐져나온 가닥 잘라냄', function () { return v('FLY_TRIM', 'on'); }],
    ['NEIGHBOR_ALIGN.on', '다 기른 뒤 이웃 결로 맞춤', function () { return v('NEIGHBOR_ALIGN', 'on'); }],
    ['HAIR_OVERLAP.on', '사진 가닥 솎음·복제 채움', function () { return v('HAIR_OVERLAP', 'on'); }],
    ['SEG_ORIENT.rootFix', '낮은 뿌리 밀도 칸 채움', function () { return v('SEG_ORIENT', 'rootFix'); }],
    ['ROOTS_FALLBACK.fill', '뿌리 밀도 0이면 균일 격자', function () { return v('ROOTS_FALLBACK', 'fill'); }],
    ['REGROW.hairlineFill', '맨살로 본 이마 위 칸에 뿌리 채움', function () { var x = v('REGROW', 'hairlineFill'); return x === undefined ? true : x; }],
    ['REGROW.thinLen', '얇은 뿌리 길이를 두께×2.2로 자름', function () { return v('REGROW', 'thinLen'); }],
    ['HEAD_WIDTH_GUARD.on', '두상 폭을 얼굴 폭 기준으로 늘림·줄임', function () { return v('HEAD_WIDTH_GUARD', 'on'); }]
  ];
  var KEEP = [
    ['정수리 보강', '어느 사진도 정면으로 못 보는 정수리 밀도를 제대로 본 칸의 실측 중앙값으로 — 데이터 없는 자리의 추정'],
    ['HAIR_IDENTITY.glossAsHair', '광택을 두피로 센 읽기 오류 바로잡기', function () { return v('HAIR_IDENTITY', 'glossAsHair'); }],
    ['ROOTS_FALLBACK.skinFix', '살색이 머리색과 겹칠 때 코·볼에서 다시 잼(읽기)', function () { return v('ROOTS_FALLBACK', 'skinFix'); }],
    ['HAIR_HULL_FIT.on', '실루엣 재는 방식(축 기준·감싸기)', function () { return v('HAIR_HULL_FIT', 'on'); }],
    ['얼굴 메쉬 맞춤(FACE_*)', '머리카락이 아니라 얼굴 형상']
  ];
  var A = {};
  A.list = function () {
    var r = [];
    OFF.forEach(function (d) { var x; try { x = d[2](); } catch (e) { x = undefined; } r.push({ name: d[0], what: d[1], value: x === undefined ? null : !!x, expect: false, ok: x === undefined || !x }); });
    KEEP.forEach(function (d) { var x = null; try { if (d[2]) x = d[2](); } catch (e) {} r.push({ name: d[0], what: d[1], value: x === undefined ? null : x, keep: true }); });
    return r;
  };
  A.lines = function () {
    var L = [TAG + ' 결과를 사후에 고치는 장치 — 꺼져 있어야 함'], bad = 0;
    A.list().forEach(function (d) {
      if (d.keep) L.push('  남김 · ' + d.name + (d.value === null ? '' : '=' + d.value) + ' — ' + d.what);
      else { if (!d.ok) bad++; L.push('  ' + (d.value === null ? '[없음]' : d.value ? '[켜짐 ⚠]' : '[끔]') + ' ' + d.name + ' — ' + d.what); }
    });
    L.splice(1, 0, '  ' + (bad ? '⚠ 켜져 있는 장치 ' + bad + '개 — 원본 대조 수치에 장치 몫이 섞임' : '모두 꺼짐 — 원본 대조 수치는 장치 없이 그린 결과'));
    return L;
  };
  try { setTimeout(function () { console.log(A.lines().join('\n')); }, 0); } catch (e) {}
  return A;
})();
