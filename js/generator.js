/* =====================================================================
   Crossword Studio — generation engine
   Pure logic: no DOM, no network, no storage. Runs in browser and Node.
   Exposed as CW.Generator / CW.util (browser) or module.exports (Node).
   ===================================================================== */
(function (global) {
  'use strict';

  var CW = global.CW = global.CW || {};

  /* ------------------------------------------------------------------ */
  /* utilities                                                           */
  /* ------------------------------------------------------------------ */

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashString(str) { /* FNV-1a, 32-bit */
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  function key(r, c) { return r + ',' + c; }

  function sanitizeWord(raw) {
    return String(raw == null ? '' : raw).toUpperCase().replace(/[^A-Z]/g, '');
  }

  /* Layout presets. Difficulty mainly shapes the grid: easy grids are
     small and dense, hard grids allow sparse sprawling layouts. It is
     also forwarded to the AI clue writer for clue phrasing. */
  var DIFFICULTIES = {
    easy:   { label: 'Easy',   maxDim: 13, compactWeight: 1.7, crossingWeight: 6.0, jitter: 2.0 },
    medium: { label: 'Medium', maxDim: 17, compactWeight: 1.0, crossingWeight: 8.0, jitter: 2.5 },
    hard:   { label: 'Hard',   maxDim: 23, compactWeight: 0.55, crossingWeight: 9.0, jitter: 3.0 }
  };

  var MIN_WORD = 3;
  var MAX_WORD = 25;

  /* ------------------------------------------------------------------ */
  /* word list parsing                                                   */
  /* ------------------------------------------------------------------ */

  /* Accepts free-form text, one entry per line: "WORD" or "WORD | clue".
     Returns { words: [{answer, clue}], issues: [{line, code, params}] }.
     Issue codes are translated by the UI (see js/i18n.js, "issue.*"). */
  function parseWordList(text) {
    var words = [], issues = [], seen = {};
    String(text || '').split(/\r?\n/).forEach(function (line) {
      if (!line.trim()) return;
      var bar = line.indexOf('|');
      var rawAnswer = (bar === -1 ? line : line.slice(0, bar)).trim();
      var clue = bar === -1 ? '' : line.slice(bar + 1).trim();
      var answer = sanitizeWord(rawAnswer);
      if (!answer) { issues.push({ line: line, code: 'noLetters', params: {} }); return; }
      if (/\s/.test(rawAnswer)) { issues.push({ line: line, code: 'spaces', params: {} }); return; }
      if (answer.length < MIN_WORD) { issues.push({ line: line, code: 'tooShort', params: { min: MIN_WORD } }); return; }
      if (answer.length > MAX_WORD) { issues.push({ line: line, code: 'tooLong', params: { max: MAX_WORD } }); return; }
      if (seen[answer]) { issues.push({ line: line, code: 'duplicate', params: { word: answer } }); return; }
      seen[answer] = true;
      words.push({ answer: answer, clue: clue });
    });
    return { words: words, issues: issues };
  }

  /* ------------------------------------------------------------------ */
  /* placement engine                                                    */
  /* ------------------------------------------------------------------ */

  /* Sparse grid held in Maps so candidate coordinates may go negative
     while the layout grows; cropped to origin at the end. */
  function Placer(maxDim) {
    this.maxDim = maxDim;
    this.letters = new Map();     // "r,c" -> letter
    this.acrossCells = new Set(); // cells claimed by an across entry
    this.downCells = new Set();   // cells claimed by a down entry
    this.entries = [];            // {row, col, dir, answer, crossings}
    this.minR = this.maxR = this.minC = this.maxC = null;
    this.intersections = 0;
  }

  Placer.prototype.isEmpty = function () { return this.entries.length === 0; };

  Placer.prototype.area = function () {
    if (this.minR === null) return 0;
    return (this.maxR - this.minR + 1) * (this.maxC - this.minC + 1);
  };

  Placer.prototype.bboxAfter = function (row, col, dir, len) {
    var endR = dir === 'down' ? row + len - 1 : row;
    var endC = dir === 'across' ? col + len - 1 : col;
    var minR = this.minR === null ? row : Math.min(this.minR, row);
    var maxR = this.maxR === null ? endR : Math.max(this.maxR, endR);
    var minC = this.minC === null ? col : Math.min(this.minC, col);
    var maxC = this.maxC === null ? endC : Math.max(this.maxC, endC);
    return { minR: minR, maxR: maxR, minC: minC, maxC: maxC };
  };

  /* Validates a placement against classic American crossword rules:
     - cells just before the start / after the end must be empty
     - an occupied cell must carry the same letter and belong to a
       perpendicular entry (that is a crossing), never a parallel one
     - an empty cell must have no letters orthogonally beside it,
       preventing accidental runs and parallel touching
     - resulting bounding box must respect maxDim
     Returns null when invalid, else {crossings, growth, stretch}. */
  Placer.prototype.canPlace = function (word, row, col, dir) {
    var len = word.length;
    var dr = dir === 'down' ? 1 : 0, dc = dir === 'across' ? 1 : 0;
    if (this.letters.has(key(row - dr, col - dc))) return null;
    if (this.letters.has(key(row + dr * len, col + dc * len))) return null;
    var crossings = 0;
    for (var i = 0; i < len; i++) {
      var r = row + dr * i, c = col + dc * i, k = key(r, c), ch = word.charAt(i);
      if (this.letters.has(k)) {
        if (this.letters.get(k) !== ch) return null;
        if (dir === 'across' ? this.acrossCells.has(k) : this.downCells.has(k)) return null;
        crossings++;
      } else if (dir === 'across') {
        if (this.letters.has(key(r - 1, c)) || this.letters.has(key(r + 1, c))) return null;
      } else {
        if (this.letters.has(key(r, c - 1)) || this.letters.has(key(r, c + 1))) return null;
      }
    }
    var bb = this.bboxAfter(row, col, dir, len);
    var h = bb.maxR - bb.minR + 1, w = bb.maxC - bb.minC + 1;
    if (h > this.maxDim || w > this.maxDim) return null;
    return { crossings: crossings, growth: w * h - this.area(), stretch: Math.abs(w - h) };
  };

  Placer.prototype.place = function (word, row, col, dir, crossings) {
    var len = word.length;
    var dr = dir === 'down' ? 1 : 0, dc = dir === 'across' ? 1 : 0;
    for (var i = 0; i < len; i++) {
      var r = row + dr * i, c = col + dc * i, k = key(r, c);
      this.letters.set(k, word.charAt(i));
      if (dir === 'across') this.acrossCells.add(k); else this.downCells.add(k);
    }
    var bb = this.bboxAfter(row, col, dir, len);
    this.minR = bb.minR; this.maxR = bb.maxR; this.minC = bb.minC; this.maxC = bb.maxC;
    this.entries.push({ row: row, col: col, dir: dir, answer: word, crossings: crossings });
    this.intersections += crossings;
  };

  /* Best placement for `word` given the current layout, or null. */
  Placer.prototype.bestPlacement = function (word, opts, rng) {
    var best = null, bestScore = -Infinity;
    for (var ei = 0; ei < this.entries.length; ei++) {
      var E = this.entries[ei];
      if (E.answer === word) continue; /* never cross a word with itself */
      var eDown = E.dir === 'down';
      for (var j = 0; j < E.answer.length; j++) {
        var ch = E.answer.charAt(j);
        var idx = word.indexOf(ch);
        while (idx !== -1) {
          var cand;
          if (eDown) {
            cand = this.canPlace(word, E.row + j, E.col - idx, 'across');
          } else {
            cand = this.canPlace(word, E.row - idx, E.col + j, 'down');
          }
          if (cand) {
            var score =
              opts.crossingWeight * cand.crossings -
              opts.compactWeight * cand.growth * 1.2 -
              0.8 * cand.stretch +
              rng() * 3;
            if (score > bestScore) { bestScore = score; best = { row: eDown ? E.row + j : E.row - idx, col: eDown ? E.col - idx : E.col + j, dir: eDown ? 'across' : 'down', crossings: cand.crossings }; }
          }
          idx = word.indexOf(ch, idx + 1);
        }
      }
    }
    return best;
  };

  /* Does `word` share at least one letter with anything placed? */
  Placer.prototype.sharesAnyLetter = function (word) {
    var it = this.letters.values();
    var v;
    while ((v = it.next()).done === false) {
      if (word.indexOf(v.value) !== -1) return true;
    }
    return false;
  };

  /* ------------------------------------------------------------------ */
  /* layout assembly                                                     */
  /* ------------------------------------------------------------------ */

  function buildAttempt(ordered, opts, rng) {
    var placer = new Placer(opts.maxDim);
    /* reason codes are translated by the UI (see js/i18n.js, "reason.*") */
    var unplacedReasons = {};
    var tooLong = { code: 'tooLongGrid', params: { max: opts.maxDim } };
    if (ordered.length) {
      var first = ordered[0];
      var dir = rng() < 0.5 ? 'across' : 'down';
      if (first.answer.length > opts.maxDim) {
        unplacedReasons[first.answer] = tooLong;
      } else {
        placer.place(first.answer, 0, 0, dir, 0);
      }
    }
    var pending = ordered.slice(1);
    var progress = true;
    while (progress && pending.length) {
      progress = false;
      var remaining = [];
      for (var i = 0; i < pending.length; i++) {
        var w = pending[i];
        if (w.answer.length > opts.maxDim) {
          unplacedReasons[w.answer] = tooLong;
          continue;
        }
        var best = placer.bestPlacement(w.answer, opts, rng);
        if (best) {
          placer.place(w.answer, best.row, best.col, best.dir, best.crossings);
          progress = true;
        } else {
          remaining.push(w);
        }
      }
      pending = remaining;
    }
    pending.forEach(function (w) {
      if (!unplacedReasons[w.answer]) {
        unplacedReasons[w.answer] = placer.sharesAnyLetter(w.answer)
          ? { code: 'conflicts', params: {} }
          : { code: 'noShared', params: {} };
      }
    });
    return { placer: placer, unplaced: pending, reasons: unplacedReasons };
  }

  function layoutScore(attempt) {
    var p = attempt.placer;
    var placed = p.entries.length;
    if (!placed) return -Infinity;
    var h = p.maxR - p.minR + 1, w = p.maxC - p.minC + 1;
    return placed * 1000 + p.intersections * 8 - (w * h) * 1.0 - Math.abs(w - h) * 8;
  }

  /* Standard crossword numbering: scan row-major; a cell is numbered when
     it starts an across run (nothing left, something right) or a down run. */
  function numberGrid(solution, rows, cols) {
    var numbers = {};
    var n = 0;
    var at = function (r, c) { return r >= 0 && r < rows && c >= 0 && c < cols ? solution[r][c] : null; };
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        if (!at(r, c)) continue;
        var startsAcross = !at(r, c - 1) && !!at(r, c + 1);
        var startsDown = !at(r - 1, c) && !!at(r + 1, c);
        if (startsAcross || startsDown) numbers[key(r, c)] = ++n;
      }
    }
    return numbers;
  }

  /* Crop to origin, build the solution matrix, number it, and attach
     numbers + clues to entries. Throws if an entry lacks a number. */
  function finalize(placer, cluesByAnswer, unplaced, reasons, meta) {
    var rows = placer.maxR - placer.minR + 1;
    var cols = placer.maxC - placer.minC + 1;
    var solution = [];
    for (var r = 0; r < rows; r++) {
      var row = [];
      for (var c = 0; c < cols; c++) {
        var ch = placer.letters.get(key(r + placer.minR, c + placer.minC));
        row.push(ch || null);
      }
      solution.push(row);
    }
    var numbers = numberGrid(solution, rows, cols);
    var entries = placer.entries.map(function (e) {
      e = { row: e.row - placer.minR, col: e.col - placer.minC, dir: e.dir, answer: e.answer };
      var num = numbers[key(e.row, e.col)];
      if (!num) throw new Error('Inconsistent layout: entry ' + e.answer + ' has no start number');
      return {
        number: num, row: e.row, col: e.col, dir: e.dir, answer: e.answer,
        clue: (cluesByAnswer && cluesByAnswer[e.answer]) || '',
        len: e.answer.length
      };
    }).sort(function (a, b) { return a.number - b.number; });
    return {
      rows: rows, cols: cols, solution: solution, numbers: numbers,
      entries: entries,
      unplaced: (unplaced || []).map(function (w) {
        var r = reasons[w.answer] || { code: 'default', params: {} };
        return {
          answer: w.answer, clue: w.clue || '',
          reasonCode: r.code, reasonParams: r.params
        };
      }),
      meta: meta
    };
  }

  /* ------------------------------------------------------------------ */
  /* public API                                                          */
  /* ------------------------------------------------------------------ */

  /* words: [{answer, clue}] — difficulty: 'easy'|'medium'|'hard' — seed: int */
  function generate(words, options) {
    options = options || {};
    var difficulty = DIFFICULTIES[options.difficulty] ? options.difficulty : 'medium';
    var opts = DIFFICULTIES[difficulty];
    var seed = (options.seed >>> 0) || (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    var rng = mulberry32(seed);
    var list = words.filter(function (w) { return w.answer && w.answer.length >= MIN_WORD; });
    var n = list.length;
    var attempts = n <= 8 ? 160 : n <= 12 ? 110 : n <= 20 ? 70 : n <= 35 ? 36 : 18;

    var best = null, bestScore = -Infinity;
    for (var t = 0; t < attempts; t++) {
      var order = list.slice().sort(function (a, b) {
        return (b.answer.length + rng() * opts.jitter) - (a.answer.length + rng() * opts.jitter);
      });
      var attempt = buildAttempt(order, opts, rng);
      var score = layoutScore(attempt);
      if (score > bestScore) { bestScore = score; best = attempt; }
      if (best && best.unplaced.length === 0 && best.placer.intersections >= n - 1) break;
    }

    var cluesByAnswer = {};
    words.forEach(function (w) { cluesByAnswer[w.answer] = w.clue || ''; });
    return finalize(
      best.placer, cluesByAnswer, best.unplaced, best.reasons,
      { difficulty: difficulty, seed: seed, attempts: t + 1, intersections: best.placer.intersections, placed: best.placer.entries.length, total: n }
    );
  }

  /* Rebuild a layout from explicit entries (used to restore a shared
     puzzle from its URL). Entries: [{row, col, dir, answer, clue}].
     Placement is replayed with the same validation rules; a floating
     (uncrossed) entry is only allowed for the very first one. */
  function buildLayout(entries, maxDim) {
    var placer = new Placer(maxDim || 25);
    var pending = entries.slice();
    var cluesByAnswer = {};
    var progress = true;
    while (progress && pending.length) {
      progress = false;
      for (var i = 0; i < pending.length; i++) {
        var e = pending[i];
        cluesByAnswer[e.answer] = e.clue || '';
        var needCross = !placer.isEmpty();
        var r = placer.canPlace(e.answer, e.row, e.col, e.dir);
        if (r && (!needCross || r.crossings > 0)) {
          placer.place(e.answer, e.row, e.col, e.dir, r.crossings);
          pending.splice(i, 1); i--; progress = true;
        }
      }
    }
    if (pending.length) {
      throw new Error('Inconsistent layout: ' + pending.map(function (e) { return e.answer; }).join(', '));
    }
    return finalize(placer, cluesByAnswer, [], {}, { difficulty: 'medium', seed: 0, attempts: 1, intersections: placer.intersections, placed: placer.entries.length, total: placer.entries.length });
  }

  CW.Generator = {
    generate: generate,
    buildLayout: buildLayout,
    parseWordList: parseWordList,
    sanitizeWord: sanitizeWord,
    DIFFICULTIES: DIFFICULTIES,
    MIN_WORD: MIN_WORD,
    MAX_WORD: MAX_WORD
  };
  CW.util = { mulberry32: mulberry32, hashString: hashString, sanitizeWord: sanitizeWord };

  if (typeof module !== 'undefined' && module.exports) module.exports = CW;

})(typeof window !== 'undefined' ? window : globalThis);
