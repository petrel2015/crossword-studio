/* =====================================================================
   Crossword Studio — print / PDF pages
   Builds A4 pages (puzzle + optional answer key) into #printRoot.
   The same DOM serves as the on-screen preview inside the print modal
   (scaled down via a CSS transform) and as the real print output.
   Pure black on white for crisp photocopies. Text follows the active
   UI language (CW.t).
   ===================================================================== */
(function (global) {
  'use strict';

  var CW = global.CW = global.CW || {};
  var t = function (key, params) { return CW.t ? CW.t(key, params) : key; };

  function el(tag, cls, text) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (text != null) d.textContent = text;
    return d;
  }

  /* A4 content area ≈ 184×273mm at 12mm page margins / 14mm preview padding.
     Pick a cell size that fits width AND leaves room for clues below. */
  function cellMm(cols, rows) {
    var byWidth = Math.floor(184 / cols);
    var byHeight = Math.floor(rows > 14 ? 170 / rows : 190 / rows);
    return Math.max(5, Math.min(11, byWidth, byHeight));
  }

  function buildGridTable(L, withLetters) {
    var mm = cellMm(L.cols, L.rows);
    var table = el('table', 'p-grid');
    table.style.setProperty('--pcell', mm + 'mm');
    for (var r = 0; r < L.rows; r++) {
      var tr = document.createElement('tr');
      for (var c = 0; c < L.cols; c++) {
        var sol = L.solution[r][c];
        var td = document.createElement('td');
        if (!sol) {
          td.className = 'blk';
        } else {
          var num = L.numbers[r + ',' + c];
          if (num) td.appendChild(el('span', 'pnum', num));
          if (withLetters) td.appendChild(el('span', 'pltr', sol));
        }
        tr.appendChild(td);
      }
      table.appendChild(tr);
    }
    return table;
  }

  function buildClueSets(L) {
    var wrap = el('div', 'p-clues cols2');
    [['across', t('across')], ['down', t('down')]].forEach(function (pair) {
      var set = el('div', 'p-clue-set');
      set.appendChild(el('h3', null, pair[1]));
      var ul = document.createElement('ul');
      L.entries.forEach(function (e) {
        if (e.dir !== pair[0]) return;
        var li = document.createElement('li');
        var b = el('b', null, e.number + '. ');
        li.appendChild(b);
        li.appendChild(document.createTextNode(e.clue ? e.clue : t('noClue')));
        ul.appendChild(li);
      });
      set.appendChild(ul);
      wrap.appendChild(set);
    });
    return wrap;
  }

  /* state: {layout, title, difficulty, issue, date} — date '' hides it */
  CW.Print = {
    build: function (state, opts) {
      opts = opts || {};
      var L = state.layout;
      var scroller = el('div', 'preview-scroller');
      var pages = el('div', 'preview-pages');
      scroller.appendChild(pages);

      var pageTitle = state.title || t('titlePh');
      var metaRight = [state.date || '', state.difficulty || ''].filter(Boolean).join(' · ');
      var page = el('section', 'a4');
      var head = el('div', 'p-head');
      head.appendChild(el('div', 'p-title', pageTitle));
      var sub = el('div', 'p-sub');
      var subL = el('span', null, t('noAbbr') + ' ' + (state.issue || '0000'));
      var subR = el('span', null, metaRight);
      sub.appendChild(subL); sub.appendChild(subR);
      head.appendChild(sub);
      page.appendChild(head);
      var gw = el('div', 'p-grid-wrap');
      gw.appendChild(buildGridTable(L, false));
      page.appendChild(gw);
      page.appendChild(buildClueSets(L));
      var foot = el('div', 'p-foot');
      foot.appendChild(el('span', null, 'Crossword Studio'));
      foot.appendChild(el('span', null, t('goodLuck')));
      page.appendChild(foot);
      pages.appendChild(page);

      if (opts.solution) {
        var sp = el('section', 'a4 solution');
        var sh = el('div', 'p-head');
        sh.appendChild(el('div', 'p-title', t('solution') + ' — ' + pageTitle));
        var ss = el('div', 'p-sub');
        ss.appendChild(el('span', null, t('answerKey')));
        ss.appendChild(el('span', null, t('noAbbr') + ' ' + (state.issue || '0000')));
        sh.appendChild(ss);
        sp.appendChild(sh);
        var sgw = el('div', 'p-grid-wrap');
        sgw.appendChild(buildGridTable(L, true));
        sp.appendChild(sgw);
        var sf = el('div', 'p-foot');
        sf.appendChild(el('span', null, 'Crossword Studio'));
        sf.appendChild(el('span', null, t('answerKey')));
        sp.appendChild(sf);
        pages.appendChild(sp);
      }

      return { scroller: scroller, pages: pages };
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
