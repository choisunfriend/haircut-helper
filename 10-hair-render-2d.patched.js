function drawHairStrands(_0x111f1d, _0x2ff52d, _0x147c26, _0x5570f4, _0x17ee6e, _0x582dd4, _0x772cb9, _0x4b6a85) {
  FORCED_HAIR_COLOR && _0x4b6a85 && (_0x4b6a85 = Object['assign']({}, _0x4b6a85, {
    'color': FORCED_HAIR_COLOR,
    'avgColorsBySection': null,
    'colorPalette': null
  }));
  const {
    curl: _0x51cf7c,
    volume: _0x160e28,
    thickness: _0x17e2cd,
    color: _0x19fa46,
    avgColorsBySection: _0x1bd293,
    colorPalette: _0x7c4cb,
    orientation: _0x8c9cc6,
    orientMaskW: _0x21e93b,
    orientMaskH: _0x13d3a3,
    angle: _0x1133b7,
    sections: _0x4bd3fb,
    capturePaths: _0x31575a
  } = _0x4b6a85, _0x39577d = _0x4b6a85['styling'] || state['styling'] || neutralStyling(), _0x4538b0 = _0x31575a ? [] : null, _0x543401 = Array['isArray'](_0x7c4cb) && _0x7c4cb['length'] > 0x0, _0xa8c30d = 0x1, _0x2029e1 = hairStrandRoles(_0x2ff52d['dw'], _0x160e28, _0x17e2cd), [_0x497504, _0x24fc6e, _0x257f3f, _0x4a24c7] = _0x2029e1, _0x4e1a77 = _0x582dd4 * 1.15, _0x51f290 = new Int32Array(_0x17ee6e)['fill'](-0x1), _0xce57b4 = new Int32Array(_0x17ee6e)['fill'](-0x1);
  {
    let _0x2f0713 = -0x1;
    for (let _0x26d923 = 0x0; _0x26d923 < _0x17ee6e; _0x26d923++) {
      if (_0x147c26[_0x26d923] >= 0x0) _0x2f0713 = _0x26d923;
      _0x51f290[_0x26d923] = _0x2f0713;
    }
  } {
    let _0x1b9220 = -0x1;
    for (let _0x329d00 = _0x17ee6e - 0x1; _0x329d00 >= 0x0; _0x329d00--) {
      if (_0x147c26[_0x329d00] >= 0x0) _0x1b9220 = _0x329d00;
      _0xce57b4[_0x329d00] = _0x1b9220;
    }
  }
  const _0x4285fc = _0x17ee6e * 0.08,
    _0x1ca1d4 = [];
  for (let _0x25652d = 0x0; _0x25652d < _0x17ee6e; _0x25652d++) {
    if (_0x147c26[_0x25652d] >= 0x0) {
      _0x1ca1d4['push'](_0x25652d);
      continue;
    }
    const _0x164e05 = _0x51f290[_0x25652d],
      _0x45d2ab = _0xce57b4[_0x25652d];
    if (_0x164e05 >= 0x0 && _0x45d2ab >= 0x0 && _0x45d2ab - _0x164e05 <= _0x4285fc) _0x1ca1d4['push'](_0x25652d);
  }
  if (_0x1ca1d4['length'] === 0x0) return;
  const _0x4bb70f = new Float32Array(_0x17ee6e)['fill'](-0x1),
    _0x50fc84 = new Float32Array(_0x17ee6e)['fill'](-0x1);
  for (let _0x267300 = 0x0; _0x267300 < _0x17ee6e; _0x267300++) {
    _0x4bb70f[_0x267300] = _0x147c26[_0x267300], _0x50fc84[_0x267300] = _0x5570f4[_0x267300];
  }
  cleanupLine1D(_0x4bb70f, {
    'clamp': ![],
    'smooth': ![]
  }), cleanupLine1D(_0x50fc84);
  const {
    lengthRatioFor: _0x6bd7a8,
    cutLayerDeltaFor: _0x84afd8,
    colorForSection: _0x51d524,
    curlAmtFor: _0x1e60fe,
    waveWidthFor: _0x3e89a7,
    textureFor: _0x4302ab,
    frontDirBiasFor: _0x4b5bdf
  } = createColumnStyleResolvers({
    'maskW': _0x17ee6e,
    'maskH': _0x582dd4,
    'iScalpY': _0x4bb70f,
    'sections': _0x4bd3fb,
    'angle': _0x1133b7,
    'color': _0x19fa46,
    'avgColorsBySection': _0x1bd293,
    'styling': _0x39577d
  }), {
    toX: _0x2db431,
    toY: _0x196a5e
  } = makeImgToCanvas(_0x2ff52d, _0x17ee6e, _0x582dd4), _0x31cf58 = !!(_0x8c9cc6 && _0x21e93b && _0x13d3a3), _0x291bc8 = _0x31cf58 ? _0x21e93b / _0x17ee6e : 0x1, _0x369658 = _0x31cf58 ? _0x13d3a3 / _0x582dd4 : 0x1, _0x9dbcd2 = _0x111f1d['canvas']['width'], _0x7ab4bf = _0x111f1d['canvas']['height'], _0x4434f7 = _0x582dd4 * 0.025, _0x5e314b = scratchCanvas('dhsBase', _0x9dbcd2, _0x7ab4bf), _0xde1c29 = _0x5e314b['getContext']('2d');
  _0xde1c29['lineCap'] = 'round', _0xde1c29['lineJoin'] = 'round';
  const _0x6f588e = scratchCanvas('dhsExt', _0x9dbcd2, _0x7ab4bf),
    _0xe8d09c = _0x6f588e['getContext']('2d');
  _0xe8d09c['lineCap'] = 'round', _0xe8d09c['lineJoin'] = 'round';
  const _0x24382a = {
    'width': 0x1,
    'alpha': 0x1
  };

  function _0x526d62(_0xe36b9e, _0x440fc7) {
    if (_0xe36b9e === 'lineWidth') _0x24382a['width'] = _0x440fc7;
    else {
      if (_0xe36b9e === 'globalAlpha') _0x24382a['alpha'] = _0x440fc7;
      else _0xde1c29[_0xe36b9e] = _0x440fc7, _0xe8d09c[_0xe36b9e] = _0x440fc7;
    }
  }
  const _0x4605a0 = {
      'n': 0x0,
      'byFlow': 0x0
    },
    _0xa501eb = {
      'hasOrientation': _0x31cf58,
      'orientation': _0x8c9cc6,
      'orientMaskW': _0x21e93b,
      'ox': _0x291bc8,
      'oy': _0x369658,
      'STRAND_STEP_LEN': _0x4434f7,
      'frontDirBiasFor': _0x4b5bdf,
      'curlAmtFor': _0x1e60fe,
      'waveWidthFor': _0x3e89a7,
      'maskAt': _0x17cb54,
      'flowAcc': _0x4605a0
    };

  function _0x1f1295(_0x1985f8, _0x377478, _0x281c0d, _0x173052, _0x365507, _0x1d38f9) {
    return traceStrandPath(_0x1985f8, _0x377478, _0x281c0d, _0x173052, _0xa501eb, _0x365507, _0x1d38f9);
  }

  function _0x5ea27b(_0x50e9db) {
    return _0x50e9db['map'](_0x2378ff => ({
      'x': _0x2db431(_0x2378ff['x']),
      'y': _0x196a5e(_0x2378ff['y'])
    }));
  }
  const _0x3955d2 = strokeSmoothPolyline,
    _0x1381a6 = [];
  let _0x85126e = 0x0,
    _0x27f43d = 0x0;
  const _0x368c52 = [];

  function _0x5c212f(_0x2c171e, _0x19754c, _0x5465d1, _0x4be050, _0x3b910d, _0x2758cf, _0x359ad5, _0x547327, _0x4a5554) {
    const _0x4b0e1c = _0x6bd7a8(_0x5465d1, _0x4be050, _0x3b910d),
      _0xf18c7 = 0x1 + (_0x4b0e1c - 0x1) * _0x2758cf,
      _0x5d0b59 = _0x84afd8(_0x5465d1, _0x4be050, _0x3b910d) * _0x2758cf,
      _0x115b2c = _0x359ad5 * _0xf18c7 <= 0x1 && _0x5d0b59 <= 0x0,
      _0x3299c3 = _0x1f1295(_0x2c171e, _0x19754c, _0x4e1a77, _0x547327, _0x4be050, _0x115b2c),
      _0x28fdd2 = typeof _0x3299c3['maskExitIdx'] === 'number' ? _0x3299c3['maskExitIdx'] : _0x3299c3['length'] - 0x1,
      _0x232c67 = typeof _0x3299c3['flowEndIdx'] === 'number' ? _0x3299c3['flowEndIdx'] : null,
      _0x2cbee2 = Math['max'](0x1, _0x232c67 !== null ? Math['min'](_0x28fdd2, _0x232c67) : _0x28fdd2);
    if (_0x232c67 !== null && _0x232c67 < _0x28fdd2) _0x85126e++;
    _0x27f43d++, _0x368c52['push']({
      'probe': _0x3299c3,
      'exitIdx': _0x28fdd2,
      'hemIdx': _0x2cbee2,
      'ix': _0x5465d1,
      'rootSec': _0x4be050 || 'crown',
      'rootX': _0x2c171e,
      'rootNy': _0x3b910d,
      'ratio': _0xf18c7,
      'layerDelta': _0x5d0b59,
      'strandMult': _0x359ad5,
      'strokeStyleVal': _0x4a5554,
      'width': _0x24382a['width'],
      'alpha': _0x24382a['alpha']
    });
  }

  function _0x388e7e() {
    const _spN = _spSliceLens(_0x368c52, _0x17ee6e, _0x582dd4, _0x4434f7, _0x4e1a77, _0x4302ab);
    _0x368c52['forEach']((_0x568f1d, _spI) => {
      const _0x2c2e1b = _spN[_spI],
        _0x58c49f = _0x568f1d['probe']['slice'](0x0, _0x2c2e1b),
        _0x14b69f = sampleStrandColors(_0x4b6a85['maskInf'], _0x58c49f, _0x568f1d['strokeStyleVal']);
      _0x4538b0 && _0x4538b0['push']({
        'pts': _0x58c49f,
        'color': _0x568f1d['strokeStyleVal'],
        'colors': _0x14b69f,
        'sec': _0x568f1d['rootSec']
      });
      const _0x349884 = Math['min'](_0x568f1d['exitIdx'], _0x58c49f['length'] - 0x1);
      _0x1381a6['push']({
        'sec': _0x568f1d['rootSec'],
        'cPts': _0x5ea27b(_0x58c49f),
        'splitIdx': _0x349884,
        'color': _0x568f1d['strokeStyleVal'],
        'colors': _0x14b69f,
        'width': _0x568f1d['width'],
        'alpha': _0x568f1d['alpha']
      });
    });
  }
  let _0x234f5c = null,
    _0x252d75 = 0x0,
    _0xe3a7ac = 0x0,
    _0x293268 = ![];

  function _0x17cb54(_0xe4230a, _0x4b3c3e) {
    if (_0x234f5c === null && !_0x293268) {
      _0x252d75 = _0x21e93b || Math['max'](0x1, Math['round'](_0x17ee6e * 0.5)), _0xe3a7ac = _0x13d3a3 || Math['max'](0x1, Math['round'](_0x582dd4 * 0.5));
      try {
        const _0x44438e = document['createElement']('canvas');
        _0x44438e['width'] = _0x252d75, _0x44438e['height'] = _0xe3a7ac;
        const _0x12abdb = _0x44438e['getContext']('2d');
        _0x12abdb['drawImage'](_0x772cb9, 0x0, 0x0, _0x252d75, _0xe3a7ac), _0x234f5c = _0x12abdb['getImageData'](0x0, 0x0, _0x252d75, _0xe3a7ac)['data'];
      } catch (_0x12dff6) {
        _0x293268 = !![];
      }
    }
    if (!_0x234f5c) return !![];
    const _0x154017 = Math['round'](_0xe4230a / _0x17ee6e * _0x252d75),
      _0x4a3b93 = Math['round'](_0x4b3c3e / _0x582dd4 * _0xe3a7ac);
    if (_0x154017 < 0x0 || _0x154017 >= _0x252d75 || _0x4a3b93 < 0x0 || _0x4a3b93 >= _0xe3a7ac) return ![];
    return _0x234f5c[(_0x4a3b93 * _0x252d75 + _0x154017) * 0x4 + 0x3] > 0x28;
  }
  const _0x1af5bb = () => _0x1ca1d4[Math['floor'](Math['random']() * _0x1ca1d4['length'])];

  function _0x33f92b(_0x172af2) {
    const {
      count: _0x4f3dfe,
      alphaMul: _0x3f6b18,
      lineWidth: _0x528ff4,
      pickCol: _0x403588,
      endYFallbackRatio: _0x40dc38,
      lenMult: _0x3bca5d,
      startXJitter: _0x2a6eb7,
      startYJitter: _0x364cc0,
      jitterSeedFn: _0x14312e,
      tintRange: _0x4f528e,
      rootDepthFrac: _0x566718
    } = _0x172af2;
    _0x526d62('globalAlpha', _0xa8c30d * _0x3f6b18), _0x526d62('lineWidth', _0x528ff4);
    for (let _0x464916 = 0x0; _0x464916 < _0x4f3dfe; _0x464916++) {
      const _0x1eee02 = _0x403588(_0x464916),
        _0x1adfb1 = _0x4bb70f[_0x1eee02];
      if (_0x1adfb1 < 0x0) continue;
      const _0x66fc16 = _0x50fc84[_0x1eee02] >= 0x0 ? _0x50fc84[_0x1eee02] : _0x1adfb1 + _0x582dd4 * _0x40dc38;
      let _0x1a18df = _0x1adfb1,
        _0xd37bcb = 0x1;
      if (_0x566718) {
        const _0xe01291 = Math['max'](0x0, Math['min'](0.9, _0x566718())),
          _0x24d91b = _0x1adfb1 + (_0x66fc16 - _0x1adfb1) * _0xe01291;
        _0xe01291 > 0x0 && _0x17cb54(_0x1eee02, _0x24d91b) && (_0x1a18df = _0x24d91b, _0xd37bcb = 0x1 - _0xe01291 * 0.3);
      }
      const _0x30bc87 = _0x1a18df / _0x582dd4,
        _0x180991 = _0x4bd3fb && _0x1133b7 ? resolveSectionId(_0x1133b7, _0x1eee02 / _0x17ee6e, _0x30bc87) : 'crown',
        _0x46815c = _0x3bca5d ? _0x3bca5d() : 0x1,
        _0x71fda9 = _0x1eee02 + _0x2a6eb7(),
        _0x14d0e3 = _0x364cc0 ? _0x1a18df + _0x364cc0() : _0x1a18df,
        _0x4ac848 = _0x14312e(_0x464916),
        [_0x37ac29, _0x5273ca] = _0x4f528e,
        _0x4decf0 = _0x543401 ? 0.94 + Math['random']() * 0.12 : _0x37ac29 + Math['random']() * _0x5273ca,
        _0x25bb55 = FORCED_HAIR_COLOR ? Math['min'](1.06, _0x4decf0) : _0x4decf0,
        _0x2a8375 = _0x543401 ? tintColor(_0x7c4cb[Math['floor'](Math['random']() * _0x7c4cb['length'])], _0x25bb55) : tintColor(_0x51d524(_0x1eee02, _0x180991), _0x25bb55);
      _0x5c212f(_0x71fda9, _0x14d0e3, _0x1eee02, _0x180991, _0x30bc87, _0xd37bcb, _0x46815c, _0x4ac848, _0x2a8375);
    }
  }
  const _0x43a7ac = Math['round'](_0x497504['n']);
  _0x33f92b({
    'count': _0x43a7ac,
    'alphaMul': 0x1,
    'lineWidth': _0x497504['w'],
    'pickCol': _0x1af5bb,
    'endYFallbackRatio': 0.35,
    'rootDepthFrac': () => Math['pow'](Math['random'](), 1.1) * 0.8,
    'lenMult': () => 0.6 + Math['random']() * 0.4,
    'startXJitter': () => (Math['random']() - 0.5) * _0x17ee6e * 0.01,
    'jitterSeedFn': _0x10927f => _0x10927f * 0.271,
    'tintRange': _0x497504['tint']
  });
  const _0x5189d3 = Math['round'](_0x24fc6e['n']);
  _0x33f92b({
    'count': _0x5189d3,
    'alphaMul': 0x1,
    'lineWidth': _0x24fc6e['w'],
    'pickCol': _0x1a0fce => _0x1ca1d4[Math['floor'](_0x1a0fce / _0x5189d3 * _0x1ca1d4['length'])],
    'endYFallbackRatio': 0.4,
    'rootDepthFrac': () => Math['pow'](Math['random'](), 1.1) * 0.6,
    'startXJitter': () => (Math['random']() - 0.5) * (_0x17ee6e / _0x5189d3) * 1.5,
    'jitterSeedFn': _0x250630 => _0x250630,
    'tintRange': _0x24fc6e['tint']
  });
  const _0x5bd9fe = Math['round'](_0x257f3f['n']);
  _0x33f92b({
    'count': _0x5bd9fe,
    'alphaMul': 0x1,
    'lineWidth': _0x257f3f['w'],
    'pickCol': _0x1af5bb,
    'endYFallbackRatio': 0.38,
    'rootDepthFrac': () => Math['pow'](Math['random'](), 1.1) * 0.7,
    'lenMult': () => 0.85 + Math['random']() * 0.3,
    'startXJitter': () => (Math['random']() - 0.5) * _0x17ee6e * 0.008,
    'jitterSeedFn': _0x43721a => _0x43721a * 0.618,
    'tintRange': _0x257f3f['tint']
  });
  const _0x41e8c2 = Math['round'](_0x4a24c7['n']);
  _0x33f92b({
    'count': _0x41e8c2,
    'alphaMul': 0x1,
    'lineWidth': _0x4a24c7['w'],
    'pickCol': _0x1af5bb,
    'endYFallbackRatio': 0.35,
    'rootDepthFrac': () => Math['pow'](Math['random'](), 1.1) * 0.85,
    'lenMult': () => 0.7 + Math['random']() * 0.5,
    'startXJitter': () => (Math['random']() - 0.5) * _0x17ee6e * 0.012,
    'startYJitter': () => (Math['random']() - 0.5) * _0x582dd4 * 0.01,
    'jitterSeedFn': _0x102fc3 => _0x102fc3 * 0.382,
    'tintRange': _0x4a24c7['tint']
  }), _0x388e7e();
  const _0x3d3d4c = {
    'nape': 0x0,
    'occipital': 0x1,
    'temple': 0x2,
    'side': 0x3,
    'front': 0x4,
    'crown': 0x5
  };
  _0x1381a6['sort']((_0x40e227, _0x53e0bb) => (_0x3d3d4c[_0x40e227['sec']] ?? 0x2) - (_0x3d3d4c[_0x53e0bb['sec']] ?? 0x2));

  function _0x196969(_0x2ae0c3, _0x111099, _0x2359b6, _0x2749f7) {
    const _0x1c744d = _0x2ae0c3['cPts']['slice'](0x0, _0x2ae0c3['splitIdx'] + 0x1);
    _0xde1c29['strokeStyle'] = _0x111099, _0xde1c29['lineWidth'] = _0x2ae0c3['width'] * _0x2359b6, _0xde1c29['globalAlpha'] = _0x2ae0c3['alpha'], _0x3955d2(_0xde1c29, _0x1c744d), !_0x2749f7 && _0x2ae0c3['splitIdx'] < _0x2ae0c3['cPts']['length'] - 0x1 && (_0xe8d09c['strokeStyle'] = _0x111099, _0xe8d09c['lineWidth'] = _0x2ae0c3['width'] * _0x2359b6, _0xe8d09c['globalAlpha'] = _0x2ae0c3['alpha'], _0x3955d2(_0xe8d09c, _0x2ae0c3['cPts']['slice'](_0x2ae0c3['splitIdx'])));
  }

  function _0x48ad3b(_0x30e8f2, _0x269c34) {
    const _0x5c6d91 = _0x30e8f2['cPts']['length'],
      _0x4166bb = _0x30e8f2['colors']['length'];
    for (let _0x749bc7 = 0x0; _0x749bc7 < _0x4166bb; _0x749bc7++) {
      const _0x8110a6 = Math['round'](_0x749bc7 * (_0x5c6d91 - 0x1) / _0x4166bb),
        _0x2d5d01 = Math['round']((_0x749bc7 + 0x1) * (_0x5c6d91 - 0x1) / _0x4166bb);
      if (_0x2d5d01 <= _0x8110a6) continue;
      const _0x35b838 = _0x30e8f2['cPts']['slice'](_0x8110a6, _0x2d5d01 + 0x1),
        _0x3d87bf = _0x30e8f2['colors'][_0x749bc7];
      if (_0x2d5d01 <= _0x30e8f2['splitIdx']) _0xde1c29['strokeStyle'] = _0x3d87bf, _0xde1c29['lineWidth'] = _0x30e8f2['width'] * _0x269c34, _0xde1c29['globalAlpha'] = _0x30e8f2['alpha'], _0x3955d2(_0xde1c29, _0x35b838);
      else {
        if (_0x8110a6 >= _0x30e8f2['splitIdx']) _0xe8d09c['strokeStyle'] = _0x3d87bf, _0xe8d09c['lineWidth'] = _0x30e8f2['width'] * _0x269c34, _0xe8d09c['globalAlpha'] = _0x30e8f2['alpha'], _0x3955d2(_0xe8d09c, _0x35b838);
        else {
          const _0xe48316 = _0x30e8f2['splitIdx'] - _0x8110a6;
          _0xde1c29['strokeStyle'] = _0x3d87bf, _0xde1c29['lineWidth'] = _0x30e8f2['width'] * _0x269c34, _0xde1c29['globalAlpha'] = _0x30e8f2['alpha'], _0x3955d2(_0xde1c29, _0x35b838['slice'](0x0, _0xe48316 + 0x1)), _0xe8d09c['strokeStyle'] = _0x3d87bf, _0xe8d09c['lineWidth'] = _0x30e8f2['width'] * _0x269c34, _0xe8d09c['globalAlpha'] = _0x30e8f2['alpha'], _0x3955d2(_0xe8d09c, _0x35b838['slice'](_0xe48316));
        }
      }
    }
  }
  const _0x410435 = _0x4b6a85['scalpColor'] || 'rgb(224,178,148)';
  _0x1381a6['forEach'](_0x3cf1be => _0x196969(_0x3cf1be, _0x410435, 2.2, !![])), _0x1381a6['forEach'](_0xefb50f => _0xefb50f['colors'] ? _0x48ad3b(_0xefb50f, 0x1) : _0x196969(_0xefb50f, _0xefb50f['color'], 0x1, ![]));
  if (_0x1133b7 && _0x27f43d > 0x0) {
    const _0x3ac7c7 = Math['round'](_0x85126e / _0x27f43d * 0x64);
    window['_lastDiscLog'] = window['_lastDiscLog'] || {}, (!(_0x1133b7 in window['_lastDiscLog']) || window['DIAG_VERBOSE']) && (window['_lastDiscLog'][_0x1133b7] = !![], console['log']('[진단·결단]\x20' + _0x1133b7 + '\x20가닥\x20' + _0x27f43d + '개\x20중\x20결불연속(겹\x20끝)\x20종결\x20' + _0x85126e + '개(' + _0x3ac7c7 + '%)' + '\x20·\x20극성\x20판정\x20' + (_0x4605a0['n'] ? Math['round'](_0x4605a0['byFlow'] / _0x4605a0['n'] * 0x64) : 0x0) + '%\x20측정(' + _0x4605a0['byFlow'] + '/' + _0x4605a0['n'] + ')\x20나머지\x20연속성')), window['_lastDisc'] = window['_lastDisc'] || {}, window['_lastDisc'][_0x1133b7] = {
      'n': _0x27f43d,
      'cut': _0x85126e,
      'pct': _0x3ac7c7
    };
  }
  const _0x23d97e = window['HAIR_CLIP'] = window['HAIR_CLIP'] || {
    'close': !![],
    'gapFrac': 0.015,
    'loThr': 0x19,
    'hiThr': 0xe6,
    'growFrac': 0x0
  };
  let _0x390ddf = 0x0;

  function _0x5ac51e(_0x48c7f0, _0x11eb12, _0x1f49ec, _0x5d951c) {
    const _0x37723d = scratchCanvas('dhsThr' + _0x390ddf++, _0x9dbcd2, _0x7ab4bf),
      _0x21cbf9 = _0x37723d['getContext']('2d');
    _0x21cbf9['filter'] = 'blur(' + _0x11eb12 + 'px)';
    if (_0x5d951c) _0x21cbf9['drawImage'](_0x48c7f0, _0x2ff52d['dx'], _0x2ff52d['dy'], _0x2ff52d['dw'], _0x2ff52d['dh']);
    else _0x21cbf9['drawImage'](_0x48c7f0, 0x0, 0x0);
    _0x21cbf9['filter'] = 'none';
    const _0xe51b7d = _0x21cbf9['getImageData'](0x0, 0x0, _0x9dbcd2, _0x7ab4bf);
    for (let _0x21ca8f = 0x3; _0x21ca8f < _0xe51b7d['data']['length']; _0x21ca8f += 0x4) _0xe51b7d['data'][_0x21ca8f] = _0xe51b7d['data'][_0x21ca8f] > _0x1f49ec ? 0xff : 0x0;
    return _0x21cbf9['putImageData'](_0xe51b7d, 0x0, 0x0), _0x37723d;
  }
  let _0x20de1c = null;

  function _0x18cdf0() {
    if (_0x20de1c) return _0x20de1c;
    const _0x1a0983 = scratchCanvas('dhsStrict', _0x9dbcd2, _0x7ab4bf);
    return _0x1a0983['getContext']('2d')['drawImage'](_0x772cb9, _0x2ff52d['dx'], _0x2ff52d['dy'], _0x2ff52d['dw'], _0x2ff52d['dh']), _0x20de1c = _0x1a0983;
  }

  function _0x46f2dd() {
    const _0x5ec77c = Math['max'](0x3, _0x2ff52d['dw'] * _0x23d97e['gapFrac']),
      _0x1066a3 = _0x5ac51e(_0x772cb9, _0x5ec77c, _0x23d97e['loThr'], !![]);
    let _0xa57dd3 = _0x23d97e['close'] ? _0x5ac51e(_0x1066a3, _0x5ec77c, _0x23d97e['hiThr'], ![]) : _0x1066a3;
    if (_0x23d97e['close']) {
      const _0x54a722 = _0xa57dd3['getContext']('2d');
      _0x54a722['drawImage'](_0x18cdf0(), 0x0, 0x0), _0x23d97e['growFrac'] > 0x0 && (_0xa57dd3 = _0x5ac51e(_0xa57dd3, Math['max'](0x1, _0x2ff52d['dw'] * _0x23d97e['growFrac']), _0x23d97e['loThr'], ![]));
    }
    _0xde1c29['save'](), _0xde1c29['globalCompositeOperation'] = 'destination-in', _0xde1c29['drawImage'](_0xa57dd3, 0x0, 0x0), _0xde1c29['restore'](), _0x111f1d['save'](), _0x111f1d['globalAlpha'] = 0x1, _0x111f1d['drawImage'](_0x5e314b, 0x0, 0x0), _0x111f1d['drawImage'](_0x6f588e, 0x0, 0x0), _0x111f1d['restore']();
  }
  _0x46f2dd(), measureMaskLeak(_0x5e314b, _0x6f588e, _0x18cdf0(), _0x9dbcd2, _0x7ab4bf, _0x1133b7), _0x4538b0 && _0x1133b7 && (state['strandPaths'] = state['strandPaths'] || {}, state['strandPaths'][_0x1133b7] = {
    'strands': _0x4538b0,
    'maskW': _0x17ee6e,
    'maskH': _0x582dd4
  });
}
const HAIR_LAYER_CLIP = {
    'on': !![],
    'gapFrac': 0.015,
    'loThr': 0x19,
    'hiThr': 0xe6,
    'growPerRatio': 0.5
  },
  CLIP_MASK_CACHE = {
    'on': !![],
    'sig': '',
    'canvas': null,
    'hits': 0x0,
    'misses': 0x0
  };

function buildHairClipMask(_0x182407, _0x599a1b, _0x36f4d0, _0x1060bc, _0xe18f27, _0x4cd0ca) {
  const _0x83df4b = CLIP_MASK_CACHE['on'] ? [_0x4cd0ca || '-', _0x36f4d0, _0x1060bc, Math['round'](_0x599a1b['dx']), Math['round'](_0x599a1b['dy']), Math['round'](_0x599a1b['dw']), Math['round'](_0x599a1b['dh']), Math['round'](_0xe18f27 * 0x4), _0x182407['width'], _0x182407['height'], canvasGid(_0x182407), HAIR_LAYER_CLIP['gapFrac'], HAIR_LAYER_CLIP['loThr'], HAIR_LAYER_CLIP['hiThr'], HAIR_LAYER_CLIP['on'] ? 0x1 : 0x0]['join'](',') : null;
  if (_0x83df4b && _0x83df4b === CLIP_MASK_CACHE['sig'] && CLIP_MASK_CACHE['canvas'] && CLIP_MASK_CACHE['canvas']['width'] === _0x36f4d0 && CLIP_MASK_CACHE['canvas']['height'] === _0x1060bc) return CLIP_MASK_CACHE['hits']++, CLIP_MASK_CACHE['canvas'];
  if (_0x83df4b) CLIP_MASK_CACHE['misses']++;
  let _0x1d5e98 = 0x0;
  const _0x329156 = (_0x3caf38, _0x14d63c, _0x10fec5, _0x2c8e5c) => {
      const _0x21b1d7 = scratchCanvas('clipPass' + _0x1d5e98++, _0x36f4d0, _0x1060bc),
        _0x44331f = _0x21b1d7['getContext']('2d', {
          'willReadFrequently': !![]
        });
      _0x44331f['filter'] = 'blur(' + _0x14d63c + 'px)';
      if (_0x2c8e5c) _0x44331f['drawImage'](_0x3caf38, _0x599a1b['dx'], _0x599a1b['dy'], _0x599a1b['dw'], _0x599a1b['dh']);
      else _0x44331f['drawImage'](_0x3caf38, 0x0, 0x0);
      _0x44331f['filter'] = 'none';
      const _0x21bcae = _0x44331f['getImageData'](0x0, 0x0, _0x36f4d0, _0x1060bc);
      for (let _0x3bb2db = 0x3; _0x3bb2db < _0x21bcae['data']['length']; _0x3bb2db += 0x4) _0x21bcae['data'][_0x3bb2db] = _0x21bcae['data'][_0x3bb2db] > _0x10fec5 ? 0xff : 0x0;
      return _0x44331f['putImageData'](_0x21bcae, 0x0, 0x0), _0x21b1d7;
    },
    _0x3cb16b = _0x206126 => {
      if (!_0x83df4b) return _0x206126;
      let _0x425136 = CLIP_MASK_CACHE['canvas'];
      !_0x425136 && (_0x425136 = CLIP_MASK_CACHE['canvas'] = document['createElement']('canvas'), CANVAS_POOL['made']++);
      (_0x425136['width'] !== _0x36f4d0 || _0x425136['height'] !== _0x1060bc) && (_0x425136['width'] = _0x36f4d0, _0x425136['height'] = _0x1060bc);
      const _0x5f4c36 = _0x425136['getContext']('2d');
      return _0x5f4c36['setTransform'](0x1, 0x0, 0x0, 0x1, 0x0, 0x0), _0x5f4c36['globalCompositeOperation'] = 'source-over', _0x5f4c36['clearRect'](0x0, 0x0, _0x36f4d0, _0x1060bc), _0x5f4c36['drawImage'](_0x206126, 0x0, 0x0), CLIP_MASK_CACHE['sig'] = _0x83df4b, _0x425136;
    },
    _0x9bdc46 = HAIR_LAYER_CLIP,
    _0x50832e = Math['max'](0x3, _0x599a1b['dw'] * _0x9bdc46['gapFrac']),
    _0x2a9da1 = _0x329156(_0x182407, _0x50832e, _0x9bdc46['loThr'], !![]),
    _0x244f61 = _0x329156(_0x2a9da1, _0x50832e, _0x9bdc46['hiThr'], ![]);
  _0x244f61['getContext']('2d')['drawImage'](_0x182407, _0x599a1b['dx'], _0x599a1b['dy'], _0x599a1b['dw'], _0x599a1b['dh']);
  if (_0xe18f27 <= 0.5) return _0x3cb16b(_0x244f61);
  const _0x22bf48 = _0x329156(_0x244f61, _0xe18f27, _0x9bdc46['loThr'], ![]),
    _0x584ca9 = _0x4cd0ca && !mqFringeActive() ? getViewFaceEllipse(_0x4cd0ca) : null;
  if (_0x584ca9) {
    const _0xea39db = _0x22bf48['getContext']('2d');
    _0xea39db['save'](), _0xea39db['globalCompositeOperation'] = 'destination-out', _0xea39db['fillStyle'] = '#000', _0xea39db['beginPath'](), _0xea39db['ellipse'](_0x599a1b['dx'] + _0x584ca9['cx'] * _0x599a1b['dw'], _0x599a1b['dy'] + _0x584ca9['cy'] * _0x599a1b['dh'], _0x584ca9['rx'] * _0x599a1b['dw'], _0x584ca9['ry'] * _0x599a1b['dh'], 0x0, 0x0, Math['PI'] * 0x2), _0xea39db['fill'](), _0xea39db['restore'](), _0xea39db['drawImage'](_0x244f61, 0x0, 0x0);
  }
  return _0x3cb16b(_0x22bf48);
}

function combClipGrowPx(_0x156b02, _0xd74474, _0x2a1ecc) {
  if (_0x2a1ecc || !COMB['maxDisp']) return 0x0;
  const _0x1a78e2 = state['hair3Dneutral'],
    _0x2e54c1 = _0x1a78e2 && _0x1a78e2['viewCal'] && _0x1a78e2['viewCal'][_0xd74474],
    _0x18c52c = state['hairMasks'] && state['hairMasks'][_0xd74474];
  if (!_0x2e54c1 || !_0x18c52c || !(_0x2e54c1['s'] > 0x0) || !(_0x18c52c['w'] > 0x0)) return 0x0;
  const _0x151785 = COMB['maxDisp'] / _0x2e54c1['s'] * (_0x156b02['dw'] / _0x18c52c['w']);
  return Math['max'](0x0, Math['min'](_0x151785, _0x156b02['dw'] * 0.25));
}

function hairClipGrowPx(_0x310df2, _0xe32b35) {
  if (_0xe32b35) return 0x0;
  let _0x3f26b3 = 0x1;
  try {
    for (const _0x584fba in state['sections'] || {}) {
      const _0x3724c9 = sectionLengthRatio(_0x584fba, state['sections'][_0x584fba]['length']);
      if (isFinite(_0x3724c9) && _0x3724c9 > _0x3f26b3) _0x3f26b3 = _0x3724c9;
    }
  } catch (_0x3aa35b) {}
  return Math['max'](0x0, _0x3f26b3 - 0x1) * _0x310df2['dh'] * HAIR_LAYER_CLIP['growPerRatio'];
}

function mqFringeActive() {
  const _0x554cf9 = state['hair3Dneutral'];
  if (!MQ_FRINGE['on'] || !_0x554cf9 || !_0x554cf9['mannequin'] || !_0x554cf9['strands']) return ![];
  if (_0x554cf9['_fringeN'] === undefined) {
    let _0x43390a = 0x0;
    for (const _0x5129e8 of _0x554cf9['strands']) {
      if (_0x5129e8['fringe']) {
        _0x43390a++;
        if (_0x43390a > 0x8) break;
      }
    }
    _0x554cf9['_fringeN'] = _0x43390a;
  }
  return _0x554cf9['_fringeN'] > 0x0;
}

function mannequinClipGrowPx(_0x130690, _0x5b098d, _0x3f8f98) {
  if (_0x3f8f98) return 0x0;
  const _0x4196bd = state['hair3Dneutral'];
  if (!_0x4196bd || !_0x4196bd['mannequin']) return 0x0;
  const _0xab4ff4 = _0x4196bd['viewCal'] && _0x4196bd['viewCal'][_0x5b098d],
    _0x3ff3ac = state['hairMasks'] && state['hairMasks'][_0x5b098d];
  if (!_0xab4ff4 || !_0x3ff3ac || !(_0xab4ff4['s'] > 0x0) || !(_0x3ff3ac['w'] > 0x0)) return 0x0;
  let _0x50ddca = 0x0;
  try {
    _0x50ddca = getHeadEllipsoid()['b'] || 0x0;
  } catch (_0x572c02) {
    return 0x0;
  }
  let _0x4b15a6 = 0x2 * _0x50ddca * HAIR_OCC3D['fringeFrac'];
  if (mqFringeActive()) {
    const _0x1946da = _0x4196bd['CY'] != null ? _0x4196bd['CY'] : SCALP_CENTER_Y,
      _0x94fbea = mqFringeTipY(_0x1946da);
    if (_0x94fbea != null) _0x4b15a6 = Math['max'](_0x4b15a6, _0x1946da + 0.18 * _0x50ddca - _0x94fbea);
  }
  if (!(_0x4b15a6 > 0x0)) return 0x0;
  const _0x119d36 = _0x4b15a6 / _0xab4ff4['s'] * (_0x130690['dw'] / _0x3ff3ac['w']);
  return Math['max'](0x0, Math['min'](_0x119d36, _0x130690['dw'] * 0.25));
}

function applyHairLayerClip(_0x5e9fdd, _0x173e09, _0x4d20ff, _0x56e167, _0x136353, _0x20f388, _0x33c9d2) {
  if (!HAIR_LAYER_CLIP['on'] || !_0x173e09) return 0x0;
  if (!_0x20f388 && MQ_TRUST['photoClip2D'] && mqGeomTrusted()) return 0x0;
  const _0xdd2c2a = Math['max'](hairClipGrowPx(_0x4d20ff, _0x20f388), mannequinClipGrowPx(_0x4d20ff, _0x33c9d2, _0x20f388)) + combClipGrowPx(_0x4d20ff, _0x33c9d2, _0x20f388),
    _0x46356a = buildHairClipMask(_0x173e09, _0x4d20ff, _0x56e167, _0x136353, _0xdd2c2a, _0x20f388 ? null : _0x33c9d2),
    _0x326320 = _0x5e9fdd['getContext']('2d');
  return _0x326320['save'](), _0x326320['globalCompositeOperation'] = 'destination-in', _0x326320['drawImage'](_0x46356a, 0x0, 0x0), _0x326320['restore'](), _0xdd2c2a;
}

function displayWidthOf(_0x2de819) {
  const _0x1c82be = _0x2de819 && _0x2de819['_sizeRef'] || _0x2de819;
  try {
    return _0x1c82be['getBoundingClientRect']()['width'] || _0x1c82be['width'];
  } catch (_0x3f2335) {
    return _0x2de819['width'];
  }
}
const DENSITY_MAP = {
  'on': !![],
  'G': 0x5
};

function _densGrid(_0x13c8ba) {
  return {
    'cnt': new Float64Array(_0x13c8ba * _0x13c8ba),
    'area': new Float64Array(_0x13c8ba * _0x13c8ba)
  };
}

function _densIndex(_0x96a3ec, _0x8505bd) {
  const _0x5e11e2 = new Array(_0x8505bd * _0x8505bd)['fill'](-0x1),
    _0x5eb849 = [];
  for (let _0x11dee7 = 0x0; _0x11dee7 < _0x8505bd * _0x8505bd; _0x11dee7++) {
    if (_0x96a3ec['area'][_0x11dee7] > 0x0) {
      const _0x48d033 = _0x96a3ec['cnt'][_0x11dee7] / _0x96a3ec['area'][_0x11dee7];
      _0x5e11e2[_0x11dee7] = _0x48d033, _0x5eb849['push'](_0x48d033);
    }
  }
  _0x5eb849['sort']((_0x15ce42, _0x564494) => _0x15ce42 - _0x564494);
  const _0x78bdfd = _0x5eb849['length'] ? _0x5eb849[Math['min'](_0x5eb849['length'] - 0x1, Math['floor'](_0x5eb849['length'] * 0.9))] : 0x0;
  return _0x5e11e2['map'](_0x4b5c25 => _0x4b5c25 < 0x0 ? null : _0x78bdfd > 1e-12 ? Math['round'](_0x4b5c25 / _0x78bdfd * 0x64) : 0x0);
}

function _densRow(_0x234e75, _0x5b07a5) {
  const _0x3840a4 = [];
  for (let _0x5cc9ae = 0x0; _0x5cc9ae < _0x5b07a5; _0x5cc9ae++) {
    _0x3840a4['push'](Array['from']({
      'length': _0x5b07a5
    }, (_0x2f44d3, _0x5dee5a) => {
      const _0x45c7a1 = _0x234e75[_0x5cc9ae * _0x5b07a5 + _0x5dee5a];
      return _0x45c7a1 === null ? '\x20\x20·' : String(Math['min'](0x3e7, _0x45c7a1))['padStart'](0x3);
    })['join']('\x20'));
  }
  return _0x3840a4['join']('\x20|\x20');
}

function _densFrame(_0x5d00a4) {
  const _0x3fb7f8 = _0x5d00a4,
    _0x1d50d8 = _0x3fb7f8['reasonMask'],
    _0x152751 = _0x3fb7f8['maskW'],
    _0x69f32a = _0x3fb7f8['maskH'];
  if (!_0x1d50d8 || !_0x152751 || !_0x69f32a) return null;
  let _0x5df5dc = _0x152751,
    _0xb79e4f = -0x1,
    _0x5802ad = _0x69f32a,
    _0x29af38 = -0x1;
  for (let _0x1a3b4b = 0x0; _0x1a3b4b < _0x69f32a; _0x1a3b4b++)
    for (let _0xbf053b = 0x0; _0xbf053b < _0x152751; _0xbf053b++)
      if (_0x1d50d8[_0x1a3b4b * _0x152751 + _0xbf053b] === 0x1) {
        if (_0xbf053b < _0x5df5dc) _0x5df5dc = _0xbf053b;
        if (_0xbf053b > _0xb79e4f) _0xb79e4f = _0xbf053b;
        if (_0x1a3b4b < _0x5802ad) _0x5802ad = _0x1a3b4b;
        if (_0x1a3b4b > _0x29af38) _0x29af38 = _0x1a3b4b;
      } if (_0xb79e4f < _0x5df5dc || _0x29af38 < _0x5802ad) return null;
  const _0x2b36d8 = DENSITY_MAP['G'],
    _0x5c33e5 = (_0xb79e4f - _0x5df5dc + 0x1) / _0x2b36d8,
    _0x35a9e3 = (_0x29af38 - _0x5802ad + 0x1) / _0x2b36d8,
    _0x240310 = new Float64Array(_0x2b36d8 * _0x2b36d8);
  for (let _0x1f0cbb = _0x5802ad; _0x1f0cbb <= _0x29af38; _0x1f0cbb++)
    for (let _0x423791 = _0x5df5dc; _0x423791 <= _0xb79e4f; _0x423791++)
      if (_0x1d50d8[_0x1f0cbb * _0x152751 + _0x423791] === 0x1) {
        const _0x4aca2d = Math['min'](_0x2b36d8 - 0x1, Math['floor']((_0x423791 - _0x5df5dc) / _0x5c33e5)),
          _0x5e03c0 = Math['min'](_0x2b36d8 - 0x1, Math['floor']((_0x1f0cbb - _0x5802ad) / _0x35a9e3));
        _0x240310[_0x5e03c0 * _0x2b36d8 + _0x4aca2d]++;
      } const _0x11fa8a = _0x152751 / _0x3fb7f8['w'],
    _0x17b5f4 = _0x69f32a / _0x3fb7f8['h'],
    _0x5ccbd8 = (_0x57636c, _0x4136ae) => {
      const _0x7e7293 = _0x57636c * _0x11fa8a,
        _0x5a03c5 = _0x4136ae * _0x17b5f4;
      if (_0x7e7293 < _0x5df5dc || _0x7e7293 > _0xb79e4f || _0x5a03c5 < _0x5802ad || _0x5a03c5 > _0x29af38) return -0x1;
      const _0x26666e = Math['min'](_0x2b36d8 - 0x1, Math['floor']((_0x7e7293 - _0x5df5dc) / _0x5c33e5)),
        _0x424b87 = Math['min'](_0x2b36d8 - 0x1, Math['floor']((_0x5a03c5 - _0x5802ad) / _0x35a9e3));
      return _0x424b87 * _0x2b36d8 + _0x26666e;
    };
  return {
    'G': _0x2b36d8,
    'area': _0x240310,
    'cellOf': _0x5ccbd8
  };
}

function measureStageDensity(_0xad6f41, _0x2172e3, _0x129eaf) {
  if (!DENSITY_MAP['on'] || !_0xad6f41) return null;
  try {
    const _0x1412a2 = _densFrame(_0x2172e3);
    if (!_0x1412a2) return null;
    const _0x10e7d4 = _0x1412a2['G'],
      _0x4e2ae8 = _densGrid(_0x10e7d4);
    _0x4e2ae8['area'] = _0x1412a2['area'];
    const _0x29762d = state['neutralStrandPaths'] && state['neutralStrandPaths'][_0xad6f41] || state['strandPaths'] && state['strandPaths'][_0xad6f41];
    if (_0x29762d && _0x29762d['strands'])
      for (const _0x46d875 of _0x29762d['strands']) {
        for (const _0x5b38d4 of _0x46d875['pts']) {
          const _0x25113d = _0x1412a2['cellOf'](_0x5b38d4['x'], _0x5b38d4['y']);
          if (_0x25113d >= 0x0) _0x4e2ae8['cnt'][_0x25113d]++;
        }
      }
    const _0x7224a9 = _densGrid(_0x10e7d4);
    _0x7224a9['area'] = _0x1412a2['area'];
    const _0x1d4f6a = state['hair3Dneutral'],
      _0x425ecf = _0x1d4f6a && _0x1d4f6a['viewCal'] && _0x1d4f6a['viewCal'][_0xad6f41];
    if (_0x425ecf) {
      const _0x391ce8 = composeRotationZYX(_0x425ecf['yaw'], _0x425ecf['pitch'], _0x425ecf['roll']),
        _0x4cf072 = _0x1d4f6a['CY'],
        _0x36fe9e = _0x1d4f6a['yTop'];
      for (const _0x5dcb31 of _0x1d4f6a['strands']) {
        for (const _0x19afa8 of _0x5dcb31['pts']) {
          const _0x149a0f = _0x19afa8['y'] - _0x4cf072,
            _0x555886 = _0x391ce8[0x6] * _0x19afa8['x'] + _0x391ce8[0x7] * _0x149a0f + _0x391ce8[0x8] * _0x19afa8['z'];
          if (_0x555886 <= 0x0) continue;
          const _0x5803a8 = _0x391ce8[0x0] * _0x19afa8['x'] + _0x391ce8[0x1] * _0x149a0f + _0x391ce8[0x2] * _0x19afa8['z'],
            _0x2fedee = _0x391ce8[0x3] * _0x19afa8['x'] + _0x391ce8[0x4] * _0x149a0f + _0x391ce8[0x5] * _0x19afa8['z'],
            _0x30b141 = _0x1412a2['cellOf'](_0x5803a8 / _0x425ecf['s'] + _0x425ecf['cx'], _0x425ecf['crownY'] + (_0x36fe9e - (_0x2fedee + _0x4cf072)) / _0x425ecf['sy']);
          if (_0x30b141 >= 0x0) _0x7224a9['cnt'][_0x30b141]++;
        }
      }
    }
    const _0x550af6 = _densGrid(_0x10e7d4);
    _0x550af6['area'] = _0x1412a2['area'];
    if (_0x129eaf) {
      for (let _0x2233bd = 0x0; _0x2233bd < _0x10e7d4 * _0x10e7d4; _0x2233bd++) _0x550af6['cnt'][_0x2233bd] = _0x129eaf[_0x2233bd];
    }
    const _0xb736a6 = {
      'G': _0x10e7d4,
      'capture': _densIndex(_0x4e2ae8, _0x10e7d4),
      'model': _densIndex(_0x7224a9, _0x10e7d4),
      'screen': _densIndex(_0x550af6, _0x10e7d4),
      'capN': _0x29762d && _0x29762d['strands'] ? _0x29762d['strands']['length'] : 0x0,
      'srcNeutral': !!(state['neutralStrandPaths'] && state['neutralStrandPaths'][_0xad6f41])
    };
    return window['_lastDensity'] = window['_lastDensity'] || {}, window['_lastDensity'][_0xad6f41] = _0xb736a6, console['log']('[밀도]\x20' + _0xad6f41 + '\x20' + _0x10e7d4 + '×' + _0x10e7d4 + '\x20·\x20중앙값=100\x20·\x20·=마스크\x20없음' + ('\x20(원료\x20' + _0xb736a6['capN'] + '가닥' + (_0xb736a6['srcNeutral'] ? '' : '\x20※중립캡처\x20없어\x20현재\x20캡처로\x20대체') + ')')), console['log']('\x20\x20\x20\x20\x20\x20\x20\x20①\x20캡처\x20' + _densRow(_0xb736a6['capture'], _0x10e7d4)), console['log']('\x20\x20\x20\x20\x20\x20\x20\x20②\x203D\x20\x20\x20' + _densRow(_0xb736a6['model'], _0x10e7d4)), console['log']('\x20\x20\x20\x20\x20\x20\x20\x20③\x20화면\x20' + _densRow(_0xb736a6['screen'], _0x10e7d4)), _0xb736a6;
  } catch (_0x3131bb) {
    return console['warn']('[밀도]\x20실패', _0x3131bb), null;
  }
}
const RENDER_MATCH = {
  'on': !![],
  'w': 0x140,
  'inkAlpha': 0x18,
  'minCoh': 0.05,
  'fillBlur': 0.012,
  'fillThr': 0x14,
  'everyFrame': ![]
};
let _matchLogged = {};

function measureRenderVsPhoto(_0x1e4e90, _0x242bff, _0x29521d, _0x3f696a, _0x291616, _0x291a33, _0x336ce0) {
  if (!RENDER_MATCH['on'] || !_0x291a33 || !_0x242bff) return null;
  if (!RENDER_MATCH['everyFrame'] && _0x291a33 in _matchLogged && !window['DIAG_VERBOSE']) return null;
  try {
    const _0x5aab9f = Math['min'](RENDER_MATCH['w'], _0x3f696a),
      _0x566269 = Math['max'](0x1, Math['round'](_0x291616 * _0x5aab9f / _0x3f696a));
    let _0x530b48 = 0x0;
    const _0x4e33fd = (_0x433e35, _0x291034) => {
        const _0x326638 = scratchCanvas('mrvpGrab' + _0x530b48++, _0x5aab9f, _0x566269),
          _0x4400d7 = _0x326638['getContext']('2d', {
            'willReadFrequently': !![]
          });
        if (_0x291034) _0x4400d7['drawImage'](_0x433e35, _0x29521d['dx'] * _0x5aab9f / _0x3f696a, _0x29521d['dy'] * _0x566269 / _0x291616, _0x29521d['dw'] * _0x5aab9f / _0x3f696a, _0x29521d['dh'] * _0x566269 / _0x291616);
        else _0x4400d7['drawImage'](_0x433e35, 0x0, 0x0, _0x5aab9f, _0x566269);
        return _0x4400d7['getImageData'](0x0, 0x0, _0x5aab9f, _0x566269)['data'];
      },
      _0x46cc50 = _0x4e33fd(_0x1e4e90, ![]),
      _0x1bd9cd = state['hairCanvases'] && state['hairCanvases'][_0x291a33];
    if (!_0x1bd9cd) return null;
    const _0x493691 = _0x4e33fd(_0x1bd9cd, !![]),
      _0x43e4ca = ((() => {
        const _0x4cb712 = Math['max'](1.5, _0x5aab9f * RENDER_MATCH['fillBlur']);
        let _0x499610 = 0x0;
        const _0xe168bc = (_0x2c3be9, _0x260bc2) => {
            const _0x2649d8 = scratchCanvas('mrvpPass' + _0x499610++, _0x5aab9f, _0x566269),
              _0x5674a4 = _0x2649d8['getContext']('2d', {
                'willReadFrequently': !![]
              });
            _0x5674a4['filter'] = 'blur(' + _0x4cb712 + 'px)', _0x5674a4['drawImage'](_0x2c3be9, 0x0, 0x0, _0x5aab9f, _0x566269), _0x5674a4['filter'] = 'none';
            const _0x57bf39 = _0x5674a4['getImageData'](0x0, 0x0, _0x5aab9f, _0x566269);
            for (let _0x3f31a1 = 0x3; _0x3f31a1 < _0x57bf39['data']['length']; _0x3f31a1 += 0x4) _0x57bf39['data'][_0x3f31a1] = _0x57bf39['data'][_0x3f31a1] > _0x260bc2 ? 0xff : 0x0;
            return _0x5674a4['putImageData'](_0x57bf39, 0x0, 0x0), _0x2649d8;
          },
          _0x12b0c9 = _0xe168bc(_0x1e4e90, RENDER_MATCH['fillThr']),
          _0x191aeb = _0xe168bc(_0x12b0c9, 0xff - RENDER_MATCH['fillThr']);
        return _0x191aeb['getContext']('2d')['drawImage'](_0x1e4e90, 0x0, 0x0, _0x5aab9f, _0x566269), _0x191aeb['getContext']('2d')['getImageData'](0x0, 0x0, _0x5aab9f, _0x566269)['data'];
      })());
    let _0x12225b = 0x0,
      _0x4b655a = 0x0,
      _0x50da9c = 0x0,
      _0x2f300e = 0x0,
      _0x352462 = 0x0;
    const _0x4b4ceb = new Uint8Array(_0x5aab9f * _0x566269),
      _0x333446 = new Uint8Array(_0x5aab9f * _0x566269),
      _0x1324a4 = new Uint8Array(_0x5aab9f * _0x566269);
    for (let _0x8d4dd8 = 0x0; _0x8d4dd8 < _0x5aab9f * _0x566269; _0x8d4dd8++) {
      const _0x567266 = _0x46cc50[_0x8d4dd8 * 0x4 + 0x3] > RENDER_MATCH['inkAlpha'],
        _0x5c6d9e = _0x43e4ca[_0x8d4dd8 * 0x4 + 0x3] > RENDER_MATCH['fillThr'],
        _0x4ad27d = _0x493691[_0x8d4dd8 * 0x4 + 0x3] > 0x28;
      _0x4b4ceb[_0x8d4dd8] = _0x567266 ? 0x1 : 0x0, _0x333446[_0x8d4dd8] = _0x4ad27d ? 0x1 : 0x0, _0x1324a4[_0x8d4dd8] = _0x5c6d9e ? 0x1 : 0x0;
      if (_0x5c6d9e && _0x4ad27d) _0x12225b++, _0x50da9c++;
      else {
        if (_0x5c6d9e) _0x2f300e++;
        else _0x4ad27d && _0x352462++;
      }
      if (_0x5c6d9e || _0x4ad27d) _0x4b655a++;
    }
    const _0x17255c = _0x4b655a ? _0x12225b / _0x4b655a : 0x0,
      _0x484799 = new Uint8ClampedArray(_0x5aab9f * _0x566269 * 0x4);
    for (let _0x77a42e = 0x0; _0x77a42e < _0x5aab9f * _0x566269; _0x77a42e++) {
      const _0x3ffa04 = _0x46cc50[_0x77a42e * 0x4 + 0x3];
      _0x484799[_0x77a42e * 0x4] = _0x484799[_0x77a42e * 0x4 + 0x1] = _0x484799[_0x77a42e * 0x4 + 0x2] = _0x3ffa04, _0x484799[_0x77a42e * 0x4 + 0x3] = 0xff;
    }
    const _0x5e7342 = new Uint8Array(_0x5aab9f * _0x566269);
    for (let _0x3a5324 = 0x0; _0x3a5324 < _0x5aab9f * _0x566269; _0x3a5324++) _0x5e7342[_0x3a5324] = _0x4b4ceb[_0x3a5324] ? 0xff : 0x0;
    const _0x1965ee = computeHairOrientationField(_0x484799, _0x5e7342, _0x5aab9f, _0x566269),
      _0x30f08a = _0x242bff['maskW'] || _0x242bff['w'],
      _0x197d22 = _0x242bff['maskH'] || _0x242bff['h'];
    let _0x37d7d3 = 0x0,
      _0x50d7d5 = 0x0,
      _0x1d87b1 = 0x0;
    for (let _0x3cf56b = 0x0; _0x3cf56b < _0x566269; _0x3cf56b++)
      for (let _0xd19a27 = 0x0; _0xd19a27 < _0x5aab9f; _0xd19a27++) {
        const _0x43641b = _0x3cf56b * _0x5aab9f + _0xd19a27;
        if (!_0x4b4ceb[_0x43641b] || !_0x333446[_0x43641b]) continue;
        const _0x5cc14e = _0x1965ee['coherence'][_0x43641b];
        if (!(_0x5cc14e >= RENDER_MATCH['minCoh'])) continue;
        const _0x28ae6b = (_0xd19a27 * _0x3f696a / _0x5aab9f - _0x29521d['dx']) / _0x29521d['dw'] * _0x242bff['w'],
          _0x591bd9 = (_0x3cf56b * _0x291616 / _0x566269 - _0x29521d['dy']) / _0x29521d['dh'] * _0x242bff['h'];
        if (_0x28ae6b < 0x0 || _0x591bd9 < 0x0 || _0x28ae6b >= _0x242bff['w'] || _0x591bd9 >= _0x242bff['h']) continue;
        const _0x1cfdf0 = sampleOrientation(_0x242bff['orientation'], _0x28ae6b * (_0x30f08a / _0x242bff['w']), _0x30f08a, _0x591bd9 * (_0x197d22 / _0x242bff['h']));
        if (!_0x1cfdf0 || !(_0x1cfdf0['coherence'] >= RENDER_MATCH['minCoh'])) continue;
        let _0x51ecd2 = Math['abs'](_0x1965ee['angle'][_0x43641b] - _0x1cfdf0['angle']) % Math['PI'];
        if (_0x51ecd2 > Math['PI'] / 0x2) _0x51ecd2 = Math['PI'] - _0x51ecd2;
        const _0x19b75e = _0x5cc14e * _0x1cfdf0['coherence'];
        _0x50d7d5 += _0x51ecd2 * _0x19b75e, _0x37d7d3 += _0x19b75e, _0x1d87b1++;
      }
    const _0x49b5fb = _0x37d7d3 ? _0x50d7d5 / _0x37d7d3 * 0xb4 / Math['PI'] : null;
    let _0x5e87e8 = 0x0;
    for (let _0x3e68fb = 0x0; _0x3e68fb < _0x5aab9f * _0x566269; _0x3e68fb++)
      if (_0x333446[_0x3e68fb] && _0x4b4ceb[_0x3e68fb]) _0x5e87e8++;
    const _0x2550d7 = ((() => {
      let _0x5d2d8e = 0x0;
      for (let _0x350ccd = 0x0; _0x350ccd < _0x5aab9f * _0x566269; _0x350ccd++)
        if (_0x333446[_0x350ccd]) _0x5d2d8e++;
      return _0x5d2d8e;
    })());
    let _0x14ed29 = null;
    try {
      const _0x2f63a5 = _densFrame(_0x242bff);
      if (_0x2f63a5) {
        _0x14ed29 = new Float64Array(_0x2f63a5['G'] * _0x2f63a5['G']);
        for (let _0x2c0472 = 0x0; _0x2c0472 < _0x566269; _0x2c0472++)
          for (let _0x24806f = 0x0; _0x24806f < _0x5aab9f; _0x24806f++) {
            const _0x3d4d67 = _0x2c0472 * _0x5aab9f + _0x24806f;
            if (!_0x4b4ceb[_0x3d4d67] || !_0x333446[_0x3d4d67]) continue;
            const _0x6dccdb = (_0x24806f * _0x3f696a / _0x5aab9f - _0x29521d['dx']) / _0x29521d['dw'] * _0x242bff['w'],
              _0x1ef6b1 = (_0x2c0472 * _0x291616 / _0x566269 - _0x29521d['dy']) / _0x29521d['dh'] * _0x242bff['h'],
              _0x54f2c5 = _0x2f63a5['cellOf'](_0x6dccdb, _0x1ef6b1);
            if (_0x54f2c5 >= 0x0) _0x14ed29[_0x54f2c5]++;
          }
      }
    } catch (_0x4c1479) {}
    const _0x130162 = {
      'iou': +_0x17255c['toFixed'](0x3),
      'grainDeg': _0x49b5fb != null ? +_0x49b5fb['toFixed'](0x1) : null,
      'grainPx': _0x1d87b1,
      'inkIn': _0x50da9c,
      'inkOut': _0x2f300e,
      'maskOnly': _0x352462,
      'inkCells': _0x14ed29,
      'fill': _0x50da9c + _0x352462 ? +(_0x50da9c / (_0x50da9c + _0x352462) * 0x64)['toFixed'](0x1) : 0x0,
      'rawFill': _0x2550d7 ? +(_0x5e87e8 / _0x2550d7 * 0x64)['toFixed'](0x1) : 0x0,
      'leak': _0x50da9c + _0x2f300e ? +(_0x2f300e / (_0x50da9c + _0x2f300e) * 0x64)['toFixed'](0x1) : 0x0
    };
    return window['_lastMatch'] = window['_lastMatch'] || {}, window['_lastMatch'][_0x291a33] = _0x130162, (!(_0x291a33 in _matchLogged) || window['DIAG_VERBOSE']) && (_matchLogged[_0x291a33] = !![], console['log']('[비교]\x20' + _0x291a33 + '\x20실루엣\x20IoU\x20' + _0x130162['iou'] + ('\x20·\x20덮음\x20' + _0x130162['fill'] + '%(번짐)\x20·\x20<b>실채움\x20' + _0x130162['rawFill'] + '%</b>(원본\x20잉크)\x20·\x20밖으로\x20샘\x20' + _0x130162['leak'] + '%') + ('\x20·\x20결\x20일치\x20' + (_0x130162['grainDeg'] != null ? _0x130162['grainDeg'] + '°' : '-') + '(' + _0x1d87b1 + 'px)') + ('\x20·\x20클립\x20' + (HAIR_LAYER_CLIP['on'] ? _0x336ce0 > 0.5 ? '여유\x20' + Math['round'](_0x336ce0) + 'px(길이\x20늘림)' : 'ON' : 'OFF'))), measureStageDensity(_0x291a33, _0x242bff, _0x130162['inkCells'])), _0x130162;
  } catch (_0x9f8cbc) {
    return console['warn']('[비교]\x20실패', _0x9f8cbc), null;
  }
}

function resetRenderMatchLog() {
  _matchLogged = {};
}
const MASK_LEAK_W = 0x140;
let _leakLogged = {};

function measureMaskLeak(_0x16e574, _0x4fb3a6, _0xa9e6e9, _0x2dcf30, _0x31876e, _0x3e69ee) {
  if (!_0x3e69ee) return null;
  if (_0x3e69ee in _leakLogged && !window['DIAG_VERBOSE']) return null;
  try {
    const _0x589b3e = Math['min'](MASK_LEAK_W, _0x2dcf30),
      _0x364d4a = Math['max'](0x1, Math['round'](_0x31876e * _0x589b3e / _0x2dcf30));
    let _0x56bbfb = 0x0;
    const _0x437b0c = _0x130ec7 => {
        const _0x4ddb3 = scratchCanvas('leak' + _0x56bbfb++, _0x589b3e, _0x364d4a),
          _0x51b7bc = _0x4ddb3['getContext']('2d', {
            'willReadFrequently': !![]
          });
        return _0x51b7bc['drawImage'](_0x130ec7, 0x0, 0x0, _0x589b3e, _0x364d4a), _0x51b7bc['getImageData'](0x0, 0x0, _0x589b3e, _0x364d4a)['data'];
      },
      _0x336751 = _0x437b0c(_0xa9e6e9),
      _0x21bc8a = _0x437b0c(_0x16e574),
      _0x1c97bd = _0x437b0c(_0x4fb3a6);
    let _0x474d27 = 0x0,
      _0x3e99ba = 0x0,
      _0x2e0955 = 0x0,
      _0x2fcc3a = 0x0;
    for (let _0x4c7245 = 0x3; _0x4c7245 < _0x336751['length']; _0x4c7245 += 0x4) {
      const _0x56e37e = _0x336751[_0x4c7245] > 0x28;
      _0x21bc8a[_0x4c7245] > 0x18 && (_0x56e37e ? _0x474d27++ : _0x3e99ba++), _0x1c97bd[_0x4c7245] > 0x18 && (_0x56e37e ? _0x2e0955++ : _0x2fcc3a++);
    }
    const _0x28b014 = _0x474d27 + _0x3e99ba + _0x2e0955 + _0x2fcc3a,
      _0x44f153 = {
        'base': {
          'inside': _0x474d27,
          'outside': _0x3e99ba
        },
        'ext': {
          'inside': _0x2e0955,
          'outside': _0x2fcc3a
        },
        'leakPct': _0x28b014 ? +((_0x3e99ba + _0x2fcc3a) / _0x28b014 * 0x64)['toFixed'](0x2) : 0x0
      };
    return window['_lastMaskLeak'] = window['_lastMaskLeak'] || {}, window['_lastMaskLeak'][_0x3e69ee] = _0x44f153, (!(_0x3e69ee in _leakLogged) || window['DIAG_VERBOSE']) && (_leakLogged[_0x3e69ee] = !![], console['log']('[진단·침범]\x20' + _0x3e69ee + '\x20마스크\x20밖\x20잉크\x20' + _0x44f153['leakPct'] + '%' + '\x20(클립층\x20' + _0x3e99ba + 'px,\x20연장층\x20' + _0x2fcc3a + 'px\x20/\x20마스크\x20안\x20' + (_0x474d27 + _0x2e0955) + 'px)')), _0x44f153;
  } catch (_0x5afb84) {
    return null;
  }
}

function tintColor(_0x40c2b3, _0x3fbd4e) {
  let _0x4bdc09 = 0x2a,
    _0x30c8b5 = 0x1b,
    _0x340ba7 = 0x12;
  if (_0x40c2b3['startsWith']('#')) {
    const _0x3b372d = parseInt(_0x40c2b3['slice'](0x1), 0x10);
    _0x4bdc09 = _0x3b372d >> 0x10 & 0xff, _0x30c8b5 = _0x3b372d >> 0x8 & 0xff, _0x340ba7 = _0x3b372d & 0xff;
  } else {
    const _0x1d5c26 = _0x40c2b3['match'](/\d+/g);
    _0x1d5c26 && _0x1d5c26['length'] >= 0x3 && (_0x4bdc09 = +_0x1d5c26[0x0], _0x30c8b5 = +_0x1d5c26[0x1], _0x340ba7 = +_0x1d5c26[0x2]);
  }
  const _0x70daa7 = _0x3fbd4e - 0x1;

  function _0x4c67ff(_0x121a4c) {
    if (_0x70daa7 >= 0x0) return _0x121a4c + (0xff - _0x121a4c) * Math['min'](0x1, _0x70daa7 * 1.8);
    return _0x121a4c * _0x3fbd4e;
  }
  return 'rgb(' + Math['min'](0xff, Math['round'](_0x4c67ff(_0x4bdc09))) + ',' + Math['min'](0xff, Math['round'](_0x4c67ff(_0x30c8b5))) + ',' + Math['min'](0xff, Math['round'](_0x4c67ff(_0x340ba7))) + ')';
}
let rafId = null;
const RENDER_GATE = {
  'on': !![],
  'depth': 0x0,
  'pending': ![],
  'skipped': 0x0
};

function beginRenderGate() {
  if (RENDER_GATE['on']) RENDER_GATE['depth']++;
}

function endRenderGate() {
  if (!RENDER_GATE['on']) return;
  RENDER_GATE['depth'] = Math['max'](0x0, RENDER_GATE['depth'] - 0x1), RENDER_GATE['depth'] === 0x0 && RENDER_GATE['pending'] && (RENDER_GATE['pending'] = ![], drawAdjustPreview());
}

function withRenderGate(_0x75835b, _0x3cf096) {
  beginRenderGate();
  const _0xf4fb83 = RENDER_GATE['skipped'];
  try {
    return _0x75835b();
  } finally {
    const _0x59785a = RENDER_GATE['skipped'] - _0xf4fb83;
    endRenderGate();
    if (_0x59785a > 0x0 && _0x3cf096) console['log']('[렌더\x20문]\x20' + _0x3cf096 + '\x20—\x20다시\x20그리기\x20' + (_0x59785a + 0x1) + '회를\x20<b>1회</b>로\x20묶음' + '\x20(끄기\x20RENDER_GATE.on=false)');
  }
}
const RENDER_SKIP = {
  'on': !![],
  'staleMs': 0x5dc,
  'last': null,
  'at': 0x0,
  'skipped': 0x0,
  'drawn': 0x0,
  'by': {}
};
let _modelGen = 0x0,
  _modelSeen = null;

function renderSignature() {
  try {
    const _0x3f1b02 = state['sections'] || {},
      _0x2b4946 = [],
      _0x43b127 = typeof ADJ_GEO_SECTION_KEYS !== 'undefined' ? ADJ_GEO_SECTION_KEYS : [],
      _0x542f1f = typeof ADJ_FILTER_SECTION_KEYS !== 'undefined' ? ADJ_FILTER_SECTION_KEYS : [],
      _0x537cf8 = typeof SECTION_ORDER !== 'undefined' ? SECTION_ORDER : Object['keys'](_0x3f1b02);
    for (const _0xc7b0c7 of _0x537cf8) {
      const _0x5deadf = _0x3f1b02[_0xc7b0c7] || {};
      _0x2b4946['push'](_0xc7b0c7 + ':' + _0x43b127['concat'](_0x542f1f)['map'](_0x31285a => _0x5deadf[_0x31285a])['join']('/'));
    }
    state['hair3Dneutral'] !== _modelSeen && (_modelSeen = state['hair3Dneutral'], _modelGen++);
    const _0xb93906 = state['stylingByView'] || state['styling'] || {},
      _0x385b10 = document['getElementById']('adjustCanvas');
    return _0x2b4946['push']('v=' + state['currentViewAngle'], 'raw=' + state['debugShowRaw'], 'quilt=' + state['hairQuilt'], 'mq=' + (typeof MANNEQUIN !== 'undefined' && MANNEQUIN['on']), 'gcurl=' + state['_globalCurl'], 'spec=' + state['specAppliedId'], 'sty=' + JSON['stringify'](_0xb93906), 'fade=' + JSON['stringify'](state['fade'] || null), 'zoom=' + (typeof ADJUST_VIEW !== 'undefined' ? [ADJUST_VIEW['zoom'], ADJUST_VIEW['panX'], ADJUST_VIEW['panY']]['join'](',') : ''), 'cv=' + (_0x385b10 ? _0x385b10['width'] + 'x' + _0x385b10['height'] : ''), 'gen=' + _modelGen, 'braid=' + (typeof BRAID !== 'undefined' ? [BRAID['on'], BRAID['partCm'], BRAID['widthCm'], BRAID['strands'], BRAID['gather']]['join'](',') : ''), 'clump=' + (typeof HAIR_CLUMP3D !== 'undefined' ? [HAIR_CLUMP3D['on'], HAIR_CLUMP3D['cellCm'], HAIR_CLUMP3D['pull']]['join'](',') : '')), _0x2b4946['join']('|');
  } catch (_0x38bc72) {
    return null;
  }
}

function _renderCaller() {
  try {
    const _0x14e7e4 = new Error()['stack']['split']('\x0a');
    for (let _0x1839dc = 0x3; _0x1839dc < _0x14e7e4['length']; _0x1839dc++) {
      const _0xe29077 = _0x14e7e4[_0x1839dc] && _0x14e7e4[_0x1839dc]['match'](/([\w.\-]+\.js)[^\d]*(\d+):(\d+)/);
      if (_0xe29077 && !/10-hair-render-2d/ ['test'](_0xe29077[0x1])) return _0xe29077[0x1] + ':' + _0xe29077[0x2];
    }
  } catch (_0x5ca552) {}
  return '?';
}

function drawAdjustPreview() {
  if (currentScreen !== 'adjust') return;
  if (RENDER_GATE['on'] && RENDER_GATE['depth'] > 0x0) {
    RENDER_GATE['pending'] = !![], RENDER_GATE['skipped']++;
    return;
  }
  if (RENDER_SKIP['on']) {
    const _0x12fd1e = renderSignature(),
      _0x577bec = Date['now']();
    if (_0x12fd1e && _0x12fd1e === RENDER_SKIP['last'] && _0x577bec - RENDER_SKIP['at'] < RENDER_SKIP['staleMs']) {
      RENDER_SKIP['skipped']++;
      const _0x49d70b = _renderCaller();
      RENDER_SKIP['by'][_0x49d70b] = (RENDER_SKIP['by'][_0x49d70b] || 0x0) + 0x1;
      return;
    }
    RENDER_SKIP['last'] = _0x12fd1e, RENDER_SKIP['at'] = _0x577bec, RENDER_SKIP['drawn']++;
  }
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(() => {
    renderAdjustFrame(), RENDER_SKIP['at'] = Date['now'](), rafId = null, _renderSkipReport();
  });
}
let _skipReportTimer = null;

function _renderSkipReport() {
  if (!RENDER_SKIP['on'] || _skipReportTimer) return;
  _skipReportTimer = setTimeout(() => {
    _skipReportTimer = null;
    if (!RENDER_SKIP['skipped']) return;
    const _0x53a468 = Object['entries'](RENDER_SKIP['by'])['sort']((_0x1d4a54, _0x3e2909) => _0x3e2909[0x1] - _0x1d4a54[0x1])['slice'](0x0, 0x6)['map'](([_0xe00ea1, _0x5bff87]) => _0xe00ea1 + '\x20×' + _0x5bff87)['join']('\x20·\x20');
    console['log']('[다시\x20그리기]\x20그림\x20' + RENDER_SKIP['drawn'] + '회\x20·\x20<b>같은\x20그림이라\x20건너뜀\x20' + RENDER_SKIP['skipped'] + '회</b>\x20\x20부른\x20곳:\x20' + _0x53a468 + '\x20\x20(끄기\x20RENDER_SKIP.on=false\x20·\x20안\x20그려지는\x20게\x20있으면\x20이\x20줄과\x20함께\x20알려\x20주세요)'), RENDER_SKIP['skipped'] = 0x0, RENDER_SKIP['drawn'] = 0x0, RENDER_SKIP['by'] = {};
  }, 0x4b0);
}