/* =====================================================================
   Crossword Studio — URL codec
   A whole puzzle (title, difficulty, entries with clues, unplaced
   words) is serialized compactly and embedded in the URL hash, so
   sharing needs no server at all. Gzip via CompressionStream when
   available, plain base64url as fallback.
   ===================================================================== */
(function (global) {
  'use strict';

  var CW = global.CW = global.CW || {};
  var Codec = {};

  function bytesToB64Url(bytes) {
    var bin = '';
    for (var i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function b64UrlToBytes(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    var bin = atob(str);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function toPayload(puzzle) {
    return {
      v: 1,
      t: puzzle.title || '',
      d: puzzle.difficulty || 'medium',
      e: puzzle.entries.map(function (e) {
        return [e.row, e.col, e.dir === 'across' ? 'a' : 'd', e.answer, e.clue || ''];
      }),
      u: (puzzle.unplaced || []).map(function (u) {
        return [u.answer, u.clue || ''];
      })
    };
  }

  function fromPayload(p) {
    if (!p || p.v !== 1 || !Array.isArray(p.e) || !p.e.length) {
      throw new Error('Not a valid puzzle link');
    }
    return {
      title: String(p.t || ''),
      difficulty: ['easy', 'medium', 'hard'].indexOf(p.d) !== -1 ? p.d : 'medium',
      entries: p.e.map(function (e) {
        return {
          row: e[0] | 0, col: e[1] | 0,
          dir: e[2] === 'a' ? 'across' : 'down',
          answer: String(e[3] || '').toUpperCase(),
          clue: String(e[4] || '')
        };
      }),
      unplaced: (p.u || []).map(function (u) {
        return { answer: String(u[0] || '').toUpperCase(), clue: String(u[1] || '') };
      })
    };
  }

  var hasCS = typeof CompressionStream === 'function';

  Codec.encode = function (puzzle) {
    var json = JSON.stringify(toPayload(puzzle));
    var bytes = new TextEncoder().encode(json);
    if (!hasCS) return Promise.resolve('R' + bytesToB64Url(bytes));
    return new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip')))
      .arrayBuffer()
      .then(function (buf) { return 'G' + bytesToB64Url(new Uint8Array(buf)); });
  };

  Codec.decode = function (str) {
    if (!str) return Promise.reject(new Error('Empty puzzle data'));
    var marker = str.charAt(0), body = str.slice(1);
    var bytes = b64UrlToBytes(body);
    var jsonPromise;
    if (marker === 'G' && hasCS) {
      jsonPromise = new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
        .then(function (buf) { return new TextDecoder().decode(buf); });
    } else {
      jsonPromise = Promise.resolve(new TextDecoder().decode(bytes));
    }
    return jsonPromise.then(function (json) {
      var p;
      try { p = JSON.parse(json); } catch (e) { throw new Error('Corrupted puzzle data'); }
      return fromPayload(p);
    });
  };

  /* Fragment after "#p=" in a full href, or null. */
  Codec.readFromLocation = function () {
    var h = location.hash || '';
    if (h.indexOf('#p=') === 0) return decodeURIComponent(h.slice(3));
    return null;
  };

  CW.Codec = Codec;
})(typeof window !== 'undefined' ? window : globalThis);
