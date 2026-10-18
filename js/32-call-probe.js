/* [호출 추적] 3D 머리 계산(computeAdjustedHair3DStrands)을 누가 몇 번 부르는지 + 걸린 시간.
 * 마지막 호출 3초 뒤 한 번 요약을 찍습니다. 끄기 CALL_PROBE.on=false · 다시 보기 CALL_PROBE.report() */
(function () {
  var W = window, P = W.CALL_PROBE = { on: true, rows: {}, n: 0, ms: 0, slow: 0 };
  var orig = W.computeAdjustedHair3DStrands;
  if (typeof orig !== 'function') return;
  var timer = null;
  function now() { return (W.performance && performance.now) ? performance.now() : Date.now(); }
  function caller() {
    try {
      var L = (new Error().stack || '').split('\n').slice(3, 5);
      return L.map(function (l) {
        var m = /at\s+([^\s(]+)?\s*\(?.*\/(js\/[^?:]+)[^:]*:(\d+):(\d+)/.exec(l) || /([^@]*)@.*\/(js\/[^?:]+)[^:]*:(\d+):(\d+)/.exec(l);
        return m ? ((m[1] || '?') + ' ' + m[2] + ':' + m[4]) : l.trim().slice(0, 60);
      }).join(' ← ');
    } catch (e) { return '?'; }
  }
  P.report = function () {
    var arr = Object.keys(P.rows).map(function (k) { return [k, P.rows[k]]; })
      .sort(function (a, b) { return b[1].ms - a[1].ms; }).slice(0, 8);
    var lines = arr.map(function (r) {
      return '  ' + r[1].n + '회 · ' + Math.round(r[1].ms) + 'ms (느린 것 ' + r[1].slow + '회) — ' + r[0];
    });
    console.log('[호출 추적] 3D 머리 계산 ' + P.n + '회 · 합계 ' + Math.round(P.ms) + 'ms · 30ms 넘은 것(새로 계산) ' + P.slow + '회\n' + lines.join('\n'));
  };
  W.computeAdjustedHair3DStrands = function () {
    if (!P.on) return orig.apply(this, arguments);
    var t0 = now(), r = orig.apply(this, arguments), dt = now() - t0;
    var k = caller() + ' · stride ' + (arguments[1] ? (+arguments[1]).toFixed(1) : '1');
    var row = P.rows[k] || (P.rows[k] = { n: 0, ms: 0, slow: 0 });
    row.n++; row.ms += dt; P.n++; P.ms += dt;
    if (dt > 30) { row.slow++; P.slow++; }
    clearTimeout(timer); timer = setTimeout(P.report, 3000);
    return r;
  };
})();
