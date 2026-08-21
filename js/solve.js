/* =====================================================================
   Crossword Studio — solving surface
   Renders the interactive grid, owns selection / typing / checking /
   revealing / timing / progress. Knows nothing about storage, URLs,
   printing or the generator itself beyond the layout shape.
   ===================================================================== */
(function (global) {
  'use strict';

  var CW = global.CW = global.CW || {};
  var t = function (key, params) { return CW.t ? CW.t(key, params) : key; };

  function key(r, c) { return r + ',' + c; }
  function fmtTime(s) {
    s = Math.max(0, s | 0);
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    var mm = (m < 10 ? '0' : '') + m, sss = (ss < 10 ? '0' : '') + ss;
    return h ? h + ':' + mm + ':' + sss : mm + ':' + sss;
  }

  CW.Solve = {
    create: function (cfg) {
      var gridEl = cfg.gridEl, ghost = cfg.ghostEl, timerEl = cfg.timerEl;
      var hooks = cfg.hooks || {};

      var L = null;                 // layout {rows, cols, solution, numbers, entries}
      var letters = {};             // "r,c" -> typed letter
      var revealed = new Set();     // "r,c"
      var errs = new Set();         // "r,c" shown wrong by Check
      var doneSet = new Set();      // entry indexes fully correct
      var sel = null;               // {idx, pos}
      var solvedFlag = false;
      var elapsed = 0, timerInt = null;
      var cellEls = [];             // [r][c] -> element
      var acrossAt = [], downAt = []; // [r][c] -> entry idx | -1
      var ro = null;

      /* ---------- helpers ---------- */
      function cellRC(e, i) {
        return e.dir === 'down' ? { r: e.row + i, c: e.col } : { r: e.row, c: e.col + i };
      }
      function posOf(ix, r, c) {
        var e = L.entries[ix];
        return e.dir === 'down' ? r - e.row : c - e.col;
      }
      function paintTimer() { timerEl.textContent = fmtTime(elapsed); }
      function ensureTimer() {
        if (solvedFlag || timerInt) return;
        timerInt = setInterval(function () { elapsed++; paintTimer(); }, 1000);
      }
      function stopTimer() { if (timerInt) { clearInterval(timerInt); timerInt = null; } }
      /* restart the clock after an external reload (e.g. language switch)
         only when solving had actually begun */
      function resumeTimer() {
        if (L && !solvedFlag && !timerInt && (elapsed > 0 || Object.keys(letters).length > 0)) {
          timerInt = setInterval(function () { elapsed++; paintTimer(); }, 1000);
        }
      }
      function entryDone(ix) {
        var e = L.entries[ix];
        for (var i = 0; i < e.len; i++) {
          var p = cellRC(e, i);
          if (letters[key(p.r, p.c)] !== L.solution[p.r][p.c]) return false;
        }
        return true;
      }
      function allCorrect() {
        for (var r = 0; r < L.rows; r++) for (var c = 0; c < L.cols; c++) {
          if (L.solution[r][c] && letters[key(r, c)] !== L.solution[r][c]) return false;
        }
        return true;
      }
      function firstEmptyPos(ix) {
        var e = L.entries[ix];
        for (var i = 0; i < e.len; i++) {
          var p = cellRC(e, i);
          if (!letters[key(p.r, p.c)]) return i;
        }
        return e.len - 1;
      }
      function firstIncompleteEntry() {
        for (var i = 0; i < L.entries.length; i++) if (!doneSet.has(i)) return i;
        return -1;
      }
      function nextIncompleteEntry(from) {
        var n = L.entries.length;
        for (var k = 1; k <= n; k++) {
          var ix = (from + k) % n;
          var e = L.entries[ix];
          for (var i = 0; i < e.len; i++) {
            var p = cellRC(e, i);
            if (!letters[key(p.r, p.c)]) return ix;
          }
        }
        return -1;
      }
      function recalcDone(ix) {
        var was = doneSet.has(ix), now = entryDone(ix);
        if (now !== was) {
          if (now) doneSet.add(ix); else doneSet.delete(ix);
          if (hooks.onEntryDone) hooks.onEntryDone(ix, now);
        }
      }
      function checkSolved() {
        if (!solvedFlag && allCorrect()) {
          solvedFlag = true;
          stopTimer();
          if (hooks.onSolved) hooks.onSolved(elapsed);
          saveSoon();
        }
      }
      function saveSoon() { if (hooks.onDirty) hooks.onDirty(); }

      /* ---------- rendering ---------- */
      function sizeGrid() {
        if (!L) return;
        var frame = gridEl.parentElement;
        var avail = frame.clientWidth - 6; /* outer borders */
        if (!avail || avail < 60 || isNaN(avail)) avail = 360;
        var cell = Math.floor((avail - (L.cols - 1)) / L.cols);
        cell = Math.max(24, Math.min(46, cell));
        gridEl.style.setProperty('--cell', cell + 'px');
      }

      function buildGrid() {
        gridEl.innerHTML = '';
        gridEl.style.setProperty('--cols', L.cols);
        cellEls = [];
        var frag = document.createDocumentFragment();
        for (var r = 0; r < L.rows; r++) {
          var rowEls = [];
          for (var c = 0; c < L.cols; c++) {
            var sol = L.solution[r][c];
            var cellEl;
            if (!sol) {
              cellEl = document.createElement('div');
              cellEl.className = 'cell blk';
              cellEl.setAttribute('aria-hidden', 'true');
            } else {
              cellEl = document.createElement('button');
              cellEl.type = 'button';
              cellEl.className = 'cell';
              cellEl.dataset.r = r; cellEl.dataset.c = c;
              var num = L.numbers[key(r, c)];
              var label = (num ? num + '. ' : '') + t('row') + ' ' + (r + 1) + ', ' + t('column') + ' ' + (c + 1);
              cellEl.setAttribute('aria-label', label);
              if (num) {
                var ns = document.createElement('span');
                ns.className = 'num'; ns.textContent = num;
                cellEl.appendChild(ns);
              }
              var ls = document.createElement('span');
              ls.className = 'ltr';
              cellEl.appendChild(ls);
            }
            rowEls.push(cellEl);
            frag.appendChild(cellEl);
          }
          cellEls.push(rowEls);
        }
        gridEl.appendChild(frag);
        sizeGrid();
      }

      function paintCell(r, c) {
        var el = cellEls[r][c], k = key(r, c);
        el.querySelector('.ltr').textContent = letters[k] || '';
        el.classList.toggle('err', errs.has(k));
        el.classList.toggle('rev', revealed.has(k));
      }

      function paint() {
        if (!L) return;
        for (var r = 0; r < L.rows; r++) for (var c = 0; c < L.cols; c++) {
          cellEls[r][c].classList.remove('in-word', 'cur');
        }
        if (sel) {
          var e = L.entries[sel.idx];
          for (var i = 0; i < e.len; i++) {
            var p = cellRC(e, i);
            cellEls[p.r][p.c].classList.add('in-word');
          }
          var cur = cellRC(e, sel.pos);
          cellEls[cur.r][cur.c].classList.add('cur');
        }
      }

      /* ---------- selection ---------- */
      function select(ix, pos) {
        sel = { idx: ix, pos: Math.max(0, Math.min(pos, L.entries[ix].len - 1)) };
        paint();
        ghost.focus({ preventScroll: true });
        if (hooks.onSelection) hooks.onSelection(ix);
      }
      function selectEntry(ix) {
        if (!L || !L.entries.length) return;
        select(ix, firstEmptyPos(ix));
      }
      function selectAt(r, c) {
        var aIx = acrossAt[r][c], dIx = downAt[r][c];
        if (aIx < 0 && dIx < 0) return;
        var cur = sel ? L.entries[sel.idx] : null;
        if (cur) {
          var cc = cellRC(cur, sel.pos);
          if (cc.r === r && cc.c === c && aIx >= 0 && dIx >= 0) { /* second click: flip */
            select(cur.dir === 'across' ? dIx : aIx, posOf(cur.dir === 'across' ? dIx : aIx, r, c));
            return;
          }
          if (cur.dir === 'across' && aIx >= 0) { select(aIx, posOf(aIx, r, c)); return; }
          if (cur.dir === 'down' && dIx >= 0) { select(dIx, posOf(dIx, r, c)); return; }
        }
        var ix = aIx >= 0 ? aIx : dIx;
        select(ix, posOf(ix, r, c));
      }

      gridEl.addEventListener('click', function (ev) {
        var t = ev.target.closest('.cell');
        if (!t || !L || t.classList.contains('blk')) return;
        selectAt(+t.dataset.r, +t.dataset.c);
      });

      /* ---------- typing ---------- */
      function typeChar(ch) {
        ch = ch.toUpperCase();
        if (!/^[A-Z]$/.test(ch) || !sel || solvedFlag || !L) return;
        ensureTimer();
        var e = L.entries[sel.idx];
        var p = cellRC(e, sel.pos), k = key(p.r, p.c);
        letters[k] = ch;
        errs.delete(k);
        paintCell(p.r, p.c);
        recalcDone(sel.idx);
        saveSoon();
        if (sel.pos < e.len - 1) {
          sel.pos++;
          paint();
        } else {
          var nx = nextIncompleteEntry(sel.idx);
          if (nx >= 0 && nx !== sel.idx) select(nx, firstEmptyPos(nx));
          else paint();
        }
        checkSolved();
      }

      function clearCell(r, c) {
        var k = key(r, c);
        if (letters[k] !== undefined) {
          delete letters[k];
          errs.delete(k);
          paintCell(r, c);
          return true;
        }
        return false;
      }

      function backspace() {
        if (!sel || !L) return;
        var e = L.entries[sel.idx];
        var p = cellRC(e, sel.pos);
        if (!clearCell(p.r, p.c) && sel.pos > 0) {
          sel.pos--;
          var q = cellRC(e, sel.pos);
          clearCell(q.r, q.c);
          paint();
        }
        recalcDone(sel.idx);
        saveSoon();
      }

      function move(dir) {
        if (!L || !sel) { if (L && L.entries.length) selectEntry(0); return; }
        var e = L.entries[sel.idx];
        var cur = cellRC(e, sel.pos);
        var horiz = dir === 'left' || dir === 'right';
        /* pressing a perpendicular arrow first flips direction, like print apps */
        if (horiz && e.dir === 'down' && acrossAt[cur.r][cur.c] >= 0) {
          select(acrossAt[cur.r][cur.c], posOf(acrossAt[cur.r][cur.c], cur.r, cur.c)); return;
        }
        if (!horiz && e.dir === 'across' && downAt[cur.r][cur.c] >= 0) {
          select(downAt[cur.r][cur.c], posOf(downAt[cur.r][cur.c], cur.r, cur.c)); return;
        }
        var dr = dir === 'up' ? -1 : dir === 'down' ? 1 : 0;
        var dc = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
        var r = cur.r + dr, c = cur.c + dc;
        while (r >= 0 && r < L.rows && c >= 0 && c < L.cols) {
          if (L.solution[r][c]) {
            var prefer = horiz ? acrossAt[r][c] : downAt[r][c];
            if (prefer < 0) prefer = horiz ? downAt[r][c] : acrossAt[r][c];
            select(prefer, posOf(prefer, r, c));
            return;
          }
          r += dr; c += dc;
        }
      }

      function toggleDir() {
        if (!sel) return;
        var e = L.entries[sel.idx];
        var p = cellRC(e, sel.pos);
        var other = e.dir === 'across' ? downAt[p.r][p.c] : acrossAt[p.r][p.c];
        if (other >= 0) select(other, posOf(other, p.r, p.c));
      }

      function nextEntry(step) {
        if (!L || !L.entries.length) return;
        var n = L.entries.length;
        var ix = sel ? (sel.idx + step + n) % n : 0;
        select(ix, firstEmptyPos(ix));
      }

      ghost.addEventListener('keydown', function (ev) {
        if (!L) return;
        switch (ev.key) {
          case 'Backspace': ev.preventDefault(); backspace(); break;
          case 'ArrowLeft': ev.preventDefault(); move('left'); break;
          case 'ArrowRight': ev.preventDefault(); move('right'); break;
          case 'ArrowUp': ev.preventDefault(); move('up'); break;
          case 'ArrowDown': ev.preventDefault(); move('down'); break;
          case 'Tab': ev.preventDefault(); nextEntry(ev.shiftKey ? -1 : 1); break;
          case 'Enter': ev.preventDefault(); nextEntry(1); break;
          case ' ': ev.preventDefault(); toggleDir(); break;
          case 'Home': if (sel) { sel.pos = 0; paint(); } break;
          case 'End': if (sel) { sel.pos = L.entries[sel.idx].len - 1; paint(); } break;
        }
      });
      /* letters arrive through the input event so mobile keyboards work too */
      ghost.addEventListener('input', function () {
        var v = ghost.value;
        ghost.value = '';
        if (!v) return;
        for (var i = 0; i < v.length; i++) {
          var ch = v.charAt(i);
          if (/[a-zA-Z]/.test(ch)) typeChar(ch);
        }
      });

      /* typing also works when focus sits on a clue or the page body —
         the ghost input path above stays authoritative when it is focused */
      document.addEventListener('keydown', function (ev) {
        if (!L || !sel) return;
        if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
        var t = ev.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
        var k = ev.key;
        if (k && k.length === 1 && /[a-zA-Z]/.test(k)) {
          ev.preventDefault();
          typeChar(k);
        }
      });

      /* ---------- tools ---------- */
      function revealCell(r, c) {
        ensureTimer();
        var k = key(r, c);
        letters[k] = L.solution[r][c];
        revealed.add(k);
        errs.delete(k);
        paintCell(r, c);
        if (acrossAt[r][c] >= 0) recalcDone(acrossAt[r][c]);
        if (downAt[r][c] >= 0) recalcDone(downAt[r][c]);
      }

      function reveal(scope) {
        if (!L) return 0;
        var n = 0;
        if (scope === 'letter' && sel) {
          var p = cellRC(L.entries[sel.idx], sel.pos);
          if (letters[key(p.r, p.c)] !== L.solution[p.r][p.c]) { revealCell(p.r, p.c); n = 1; }
        } else if (scope === 'word' && sel) {
          var e = L.entries[sel.idx];
          for (var i = 0; i < e.len; i++) {
            var q = cellRC(e, i);
            if (letters[key(q.r, q.c)] !== L.solution[q.r][q.c]) { revealCell(q.r, q.c); n++; }
          }
        } else if (scope === 'puzzle') {
          for (var r = 0; r < L.rows; r++) for (var c = 0; c < L.cols; c++) {
            if (L.solution[r][c] && letters[key(r, c)] !== L.solution[r][c]) { revealCell(r, c); n++; }
          }
        }
        if (n) { saveSoon(); checkSolved(); }
        return n;
      }

      function hint() {
        if (!sel) return false;
        var e = L.entries[sel.idx];
        for (var i = 0; i < e.len; i++) {
          var p = cellRC(e, i);
          if (letters[key(p.r, p.c)] !== L.solution[p.r][p.c]) {
            revealCell(p.r, p.c);
            saveSoon();
            checkSolved();
            return true;
          }
        }
        return false;
      }

      function check() {
        var wrong = 0, filled = 0, total = 0;
        for (var r = 0; r < L.rows; r++) for (var c = 0; c < L.cols; c++) {
          if (!L.solution[r][c]) continue;
          total++;
          var k = key(r, c);
          if (letters[k] !== undefined) {
            filled++;
            if (letters[k] !== L.solution[r][c]) { wrong++; errs.add(k); cellEls[r][c].classList.add('err'); }
            else if (errs.has(k)) { errs.delete(k); cellEls[r][c].classList.remove('err'); }
          }
        }
        return { wrong: wrong, filled: filled, total: total };
      }

      function resetProgress() {
        letters = {}; revealed = new Set(); errs = new Set(); doneSet = new Set();
        solvedFlag = false; elapsed = 0; stopTimer(); paintTimer();
        for (var r = 0; r < L.rows; r++) for (var c = 0; c < L.cols; c++) {
          if (L.solution[r][c]) paintCell(r, c);
        }
        L.entries.forEach(function (_, ix) { if (hooks.onEntryDone) hooks.onEntryDone(ix, false); });
        if (L.entries.length) select(0, 0);
        saveSoon();
      }

      /* ---------- lifecycle ---------- */
      function load(layout, progress) {
        L = layout;
        stopTimer(); elapsed = 0; solvedFlag = false;
        letters = {}; revealed = new Set(); errs = new Set(); doneSet = new Set(); sel = null;
        acrossAt = []; downAt = [];
        for (var r = 0; r < L.rows; r++) {
          var aRow = [], dRow = [];
          for (var c = 0; c < L.cols; c++) { aRow.push(-1); dRow.push(-1); }
          acrossAt.push(aRow); downAt.push(dRow);
        }
        L.entries.forEach(function (e, ix) {
          for (var i = 0; i < e.len; i++) {
            var p = cellRC(e, i);
            (e.dir === 'across' ? acrossAt : downAt)[p.r][p.c] = ix;
          }
        });
        buildGrid();
        if (progress) {
          elapsed = progress.elapsed || 0;
          letters = progress.letters || {};
          (progress.revealed || []).forEach(function (k) { revealed.add(k); });
          Object.keys(letters).forEach(function (k) {
            var pp = k.split(',');
            var rr = +pp[0], cc = +pp[1];
            if (cellEls[rr] && cellEls[rr][cc]) paintCell(rr, cc);
          });
        }
        paintTimer();
        L.entries.forEach(function (_, ix) {
          if (entryDone(ix)) { doneSet.add(ix); if (hooks.onEntryDone) hooks.onEntryDone(ix, true); }
        });
        if (allCorrect()) solvedFlag = true;
        var ix0 = firstIncompleteEntry();
        if (ix0 < 0) ix0 = 0;
        if (L.entries.length) select(ix0, firstEmptyPos(ix0));
      }

      if (typeof ResizeObserver === 'function') {
        ro = new ResizeObserver(function () { sizeGrid(); });
        ro.observe(gridEl.parentElement);
      } else {
        global.addEventListener('resize', sizeGrid);
      }

      return {
        load: load,
        selectEntry: selectEntry,
        check: check,
        hint: hint,
        reveal: reveal,
        resetProgress: resetProgress,
        resumeTimer: resumeTimer,
        getProgress: function () {
          return { letters: letters, revealed: Array.from(revealed), elapsed: elapsed, solved: solvedFlag };
        },
        isDone: function (ix) { return doneSet.has(ix); },
        activeEntry: function () { return sel ? sel.idx : -1; },
        hasProgress: function () { return Object.keys(letters).length > 0 || elapsed > 0; },
        fmtTime: fmtTime
      };
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
