/* =====================================================================
   Crossword Studio — application shell
   Wires the builder, the solver, the editor drawer, sharing, printing,
   AI settings and language switching together. All puzzle logic lives
   in CW.Generator; all grid interaction lives in CW.Solve.
   ===================================================================== */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var Gen = CW.Generator, Store = CW.Store, Codec = CW.Codec, AI = CW.AI, U = CW.util, I = CW.I18N;
  var t = function (key, params) { return I.t(key, params); };

  /* ---------------- tiny DOM helpers ---------------- */
  function el(tag, cls, text) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (text != null) d.textContent = text;
    return d;
  }
  function btn(label, cls) {
    var b = el('button', ('btn ' + (cls || '')).trim(), label);
    b.type = 'button';
    return b;
  }
  function reasonText(u) {
    if (u.reasonCode) return t('reason.' + u.reasonCode, u.reasonParams);
    return t('reason.default');
  }
  function issueText(it) {
    return t('issue.' + it.code, it.params || {});
  }

  /* ---------------- toast ---------------- */
  var toastEl = $('toast'), toastT = null;
  function toast(msg, isErr) {
    toastEl.textContent = msg;
    toastEl.classList.toggle('err', !!isErr);
    toastEl.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.hidden = true; }, 3400);
  }

  /* ---------------- modal ---------------- */
  var modal = $('modal'), modalTitle = $('modalTitle'), modalBody = $('modalBody');
  function openModal(title, bodyEl, wide) {
    modalTitle.textContent = title;
    modalBody.innerHTML = '';
    modalBody.appendChild(bodyEl);
    modal.querySelector('.modal-card').classList.toggle('wide', !!wide);
    modal.hidden = false;
  }
  function closeModal() {
    modal.hidden = true;
    modalBody.innerHTML = '';
    $('printRoot').innerHTML = '';
    /* modal closes via ESC / backdrop / ✕ without going through
       Donation.close — let it drop its dialog state the same way */
    if (CW.Donation && CW.Donation.onModalClosed) CW.Donation.onModalClosed();
  }
  modal.addEventListener('click', function (ev) {
    if (ev.target.closest('[data-close]')) closeModal();
  });

  function confirmModal(title, text, okLabel, danger) {
    return new Promise(function (resolve) {
      var box = el('div');
      box.appendChild(el('p', 'modal-p', text));
      var row = el('div', 'btn-row');
      var no = btn(t('cancel'));
      var yes = btn(okLabel || t('confirmOk'), danger ? 'danger' : 'primary');
      no.addEventListener('click', function () { closeModal(); resolve(false); });
      yes.addEventListener('click', function () { closeModal(); resolve(true); });
      row.appendChild(no); row.appendChild(yes);
      box.appendChild(row);
      openModal(title, box);
    });
  }

  /* ---------------- state ---------------- */
  var state = {
    layout: null,        // generator output
    title: '',
    difficulty: 'medium',
    unplaced: [],        // [{answer, clue, reasonCode, reasonParams}]
    id: '',
    issue: '0000',
    solve: null
  };

  function payloadFromState() {
    return {
      title: state.title,
      difficulty: state.difficulty,
      entries: state.layout.entries.map(function (e) {
        return { row: e.row, col: e.col, dir: e.dir, answer: e.answer, clue: e.clue };
      }),
      unplaced: state.unplaced.map(function (u) { return { answer: u.answer, clue: u.clue }; })
    };
  }

  function puzzleId(entries, unplaced) {
    var src = JSON.stringify({
      e: entries.map(function (e) { return [e.row, e.col, e.dir === 'a' ? 'a' : e.dir, e.answer]; }),
      u: unplaced.map(function (u) { return u.answer; })
    });
    return U.hashString(src).toString(16).slice(0, 8).toUpperCase();
  }

  /* ---------------- views ---------------- */
  function showBuilder() { $('viewSolve').hidden = true; $('viewBuilder').hidden = false; closeDrawer(); }
  function showSolve() { $('viewBuilder').hidden = true; $('viewSolve').hidden = false; }
  function fmt(sec) { return state.solve ? state.solve.fmtTime(sec) : String(sec); }

  function showSolvedBanner(sec) {
    $('solvedBanner').hidden = false;
    $('solvedTime').textContent = fmt(sec);
  }

  function renderHeading() {
    $('puzzleHeading').textContent = state.title;
    $('puzzleMeta').textContent = t('metaLine', {
      diff: t('diff_' + state.difficulty),
      n: state.layout.entries.length,
      r: state.layout.rows,
      c: state.layout.cols
    });
  }

  /* ---------------- clue list ---------------- */
  function clueEl(ix) {
    return document.querySelector('.clue[data-entry="' + ix + '"]');
  }
  function renderClues() {
    var lists = { across: $('cluesAcross'), down: $('cluesDown') };
    lists.across.innerHTML = ''; lists.down.innerHTML = '';
    state.layout.entries.forEach(function (e, ix) {
      var li = el('li', 'clue' + (e.clue.trim() ? '' : ' noclue'));
      li.dataset.entry = ix;
      li.tabIndex = 0;
      li.appendChild(el('span', 'cnum', e.number + '.'));
      li.appendChild(el('span', 'ctext', e.clue.trim() ? e.clue : t('noClue')));
      li.appendChild(el('em', 'len', ' (' + e.len + ')'));
      lists[e.dir].appendChild(li);
    });
  }
  /* re-apply solver state onto a freshly rendered clue list (after edits or language switch) */
  function resyncClueStates() {
    state.layout.entries.forEach(function (_, ix) {
      var li = clueEl(ix);
      if (!li) return;
      li.classList.toggle('done', state.solve.isDone(ix));
      li.classList.toggle('active', state.solve.activeEntry() === ix);
    });
  }
  function bindClueLists() {
    ['cluesAcross', 'cluesDown'].forEach(function (id) {
      var list = $(id);
      list.addEventListener('click', function (ev) {
        var li = ev.target.closest('.clue');
        if (li) state.solve.selectEntry(+li.dataset.entry);
      });
      list.addEventListener('keydown', function (ev) {
        var li = ev.target.closest('.clue');
        if (li && (ev.key === 'Enter' || ev.key === ' ')) {
          ev.preventDefault();
          state.solve.selectEntry(+li.dataset.entry);
        }
      });
    });
  }

  function renderUnplaced() {
    var panel = $('unplacedPanel'), ul = $('unplacedList');
    ul.innerHTML = '';
    if (!state.unplaced.length) { panel.hidden = true; return; }
    panel.hidden = false;
    $('unplacedTitle').textContent = t('notPlacedTitle', {
      u: state.unplaced.length,
      t: state.unplaced.length + state.layout.entries.length
    });
    state.unplaced.forEach(function (u) {
      var li = el('li');
      li.appendChild(el('b', null, u.answer));
      li.appendChild(el('span', 'why', reasonText(u)));
      ul.appendChild(li);
    });
  }

  /* ---------------- adopt puzzle (from generator or URL) ---------------- */
  function adoptPuzzle(opts) {
    state.layout = opts.layout;
    state.title = opts.title || t('titlePh');
    state.difficulty = opts.difficulty || 'medium';
    state.unplaced = opts.unplaced || [];
    state.id = puzzleId(state.layout.entries, state.unplaced);
    state.issue = String(parseInt(state.id.slice(0, 4), 16) % 10000).padStart(4, '0');

    $('mastIssue').textContent = t('noAbbr') + ' ' + state.issue;
    $('solvedBanner').hidden = true;

    renderHeading();
    renderClues();
    renderUnplaced();
    var progress = Store.loadProgress(state.id);
    state.solve.load(state.layout, progress);
    if (progress && progress.solved) showSolvedBanner(progress.elapsed);
    showSolve();
    updateShareUrl();
  }

  function adoptFromPayload(p) {
    var layout;
    try {
      layout = Gen.buildLayout(p.entries);
    } catch (e) {
      toast(t('linkDamaged'), true);
      showBuilder();
      return;
    }
    var unplaced = (p.unplaced || []).map(function (u) {
      return { answer: u.answer, clue: u.clue || '', reasonCode: 'default', reasonParams: {} };
    });
    adoptPuzzle({
      layout: layout,
      title: p.title,
      difficulty: p.difficulty,
      unplaced: unplaced
    });
  }

  /* ---------------- share url ---------------- */
  var shareUrlBusy = false, shareUrlQueued = false;
  function updateShareUrl() {
    if (shareUrlBusy) { shareUrlQueued = true; return; }
    shareUrlBusy = true;
    var payload = payloadFromState();
    Store.saveCurrentPuzzle(payload);
    var settle = function () {
      shareUrlBusy = false;
      if (shareUrlQueued) { shareUrlQueued = false; updateShareUrl(); }
    };
    Codec.encode(payload).then(function (enc) {
      history.replaceState(null, '', '#p=' + enc);
      settle();
    }).catch(settle);
  }

  /* ---------------- progress persistence ---------------- */
  var saveT = null;
  function saveProgressSoon() {
    clearTimeout(saveT);
    saveT = setTimeout(function () {
      if (state.id && state.solve) Store.saveProgress(state.id, state.solve.getProgress());
    }, 350);
  }

  /* ---------------- solve instance ---------------- */
  state.solve = CW.Solve.create({
    gridEl: $('grid'),
    ghostEl: $('ghostInput'),
    timerEl: $('timer'),
    hooks: {
      onSelection: function (ix) {
        var prev = document.querySelector('.clue.active');
        if (prev) prev.classList.remove('active');
        var li = clueEl(ix);
        if (li) {
          li.classList.add('active');
          if (li.scrollIntoView) li.scrollIntoView({ block: 'nearest' });
        }
      },
      onEntryDone: function (ix, done) {
        var li = clueEl(ix);
        if (li) li.classList.toggle('done', done);
      },
      onSolved: function (sec) {
        showSolvedBanner(sec);
        toast(t('solvedToast', { t: fmt(sec) }));
      },
      onDirty: saveProgressSoon
    }
  });
  bindClueLists();

  /* ---------------- builder ---------------- */
  var SAMPLE = [
    'APPLE | It keeps the doctor away, supposedly',
    'BANANA',
    'ORANGE | Citrus fruit that shares its name with a color',
    'GRAPE | Small fruit that becomes wine',
    'LEMON | Sour yellow citrus',
    'PEACH | Fuzzy fruit with a stone',
    'MELON',
    'PLUM',
    'PEAR',
    'CHERRY | Often sits on top of whipped cream',
    'APRICOT | Velvet-skinned orange fruit',
    'MANGO | King of fruits, some say'
  ].join('\n');

  /* ----- input modes: word list / article ----- */
  var builderMode = 'words';
  var lastCandidates = [];

  function saveDraft() {
    Store.saveDraft({
      mode: builderMode,
      text: $('wordInput').value,
      title: $('puzzleTitle').value,
      difficulty: $('difficulty').value,
      article: $('articleInput').value,
      clueStyle: $('clueStyle').value,
      selected: selectedCandidateWords()
    });
  }

  function switchMode(m) {
    builderMode = m;
    $('modeWords').classList.toggle('active', m === 'words');
    $('modeArticle').classList.toggle('active', m === 'article');
    $('modeWords').setAttribute('aria-selected', m === 'words');
    $('modeArticle').setAttribute('aria-selected', m === 'article');
    $('wordsPanel').hidden = m !== 'words';
    $('articlePanel').hidden = m !== 'article';
    $('wordsActions').hidden = m !== 'words';
    $('aiFillRow').hidden = m !== 'words'; /* article mode has its own clue-style selector */
    saveDraft();
  }
  $('modeWords').addEventListener('click', function () { switchMode('words'); });
  $('modeArticle').addEventListener('click', function () { switchMode('article'); });

  function refreshArticleStats() {
    var txt = $('articleInput').value;
    var wc = (txt.match(/[A-Za-z]+/g) || []).length;
    var sc = (txt.match(/[.!?]+/g) || []).length;
    $('articleStats').textContent = wc ? t('articleStat', { n: wc, s: sc }) : '';
    saveDraft();
  }
  $('articleInput').addEventListener('input', refreshArticleStats);

  $('btnExtract').addEventListener('click', function () {
    var res = CW.Extract.analyze($('articleInput').value);
    if (res.wordCount < 20) { toast(t('articleTooShort'), true); return; }
    lastCandidates = res.candidates;
    renderCandidates([]);
    $('candidatesWrap').hidden = false;
  });

  function selectedCandidateWords() {
    return Array.from($('candidateList').querySelectorAll('input:checked'))
      .map(function (i) { return i.value; });
  }
  function updateCandSelected() {
    $('candSelected').textContent = t('selectedN', { n: selectedCandidateWords().length });
  }
  function renderCandidates(preselect) {
    var wrapEl = $('candidateList');
    wrapEl.innerHTML = '';
    var pre = {};
    if (Array.isArray(preselect)) {
      preselect.forEach(function (w) { pre[w] = 1; });
    } else {
      selectedCandidateWords().forEach(function (w) { pre[w] = 1; });
    }
    lastCandidates.forEach(function (c) {
      var lab = el('label', 'cand' + (pre[c.word] ? ' on' : ''));
      var box = el('input'); box.type = 'checkbox'; box.value = c.word; box.checked = !!pre[c.word];
      lab.appendChild(box);
      lab.appendChild(el('span', 'cand-word', c.word));
      lab.appendChild(el('span', 'cand-n', '×' + c.occurrences));
      if (c.context) lab.title = c.context;
      wrapEl.appendChild(lab);
    });
    updateCandSelected();
  }
  $('candidateList').addEventListener('change', function (ev) {
    var lab = ev.target.closest('.cand');
    if (!lab) return;
    lab.classList.toggle('on', ev.target.checked);
    updateCandSelected();
    saveDraft();
  });
  function setCandSelection(fn) {
    Array.from($('candidateList').querySelectorAll('.cand')).forEach(function (lab, i) {
      var on = !!fn(i);
      var box = lab.querySelector('input');
      box.checked = on;
      lab.classList.toggle('on', on);
    });
    updateCandSelected();
    saveDraft();
  }
  $('btnCandTop').addEventListener('click', function () { setCandSelection(function (i) { return i < 10; }); });
  $('btnCandAll').addEventListener('click', function () { setCandSelection(function () { return true; }); });
  $('btnCandNone').addEventListener('click', function () { setCandSelection(function () { return false; }); });

  function addCustomWord() {
    if ($('candidatesWrap').hidden) { toast(t('needCandidates'), true); return; }
    var w = CW.util.sanitizeWord($('addWordInput').value);
    $('addWordInput').value = '';
    if (w.length < 3 || w.length > 12) return;
    var existing = $('candidateList').querySelector('input[value="' + w + '"]');
    if (existing) {
      existing.checked = true;
      existing.closest('.cand').classList.add('on');
      updateCandSelected();
      saveDraft();
      return;
    }
    lastCandidates.push({ word: w, occurrences: 0, isProper: false, context: '' });
    renderCandidates();
    var box = $('candidateList').querySelector('input[value="' + w + '"]');
    if (box) { box.checked = true; box.closest('.cand').classList.add('on'); }
    updateCandSelected();
    saveDraft();
  }
  $('btnAddWord').addEventListener('click', addCustomWord);
  $('addWordInput').addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter') { ev.preventDefault(); addCustomWord(); }
  });

  function renderIssues(issues) {
    var ul = $('parseIssues');
    ul.innerHTML = '';
    issues.forEach(function (it) {
      var li = el('li');
      li.appendChild(el('span', null, it.line.trim()));
      li.appendChild(el('span', 'why', issueText(it)));
      ul.appendChild(li);
    });
    ul.hidden = !issues.length;
  }

  function refreshBuilderStats() {
    var parsed = Gen.parseWordList($('wordInput').value);
    var withClues = parsed.words.filter(function (w) { return w.clue.trim(); }).length;
    $('wordStats').textContent = parsed.words.length
      ? t('wordsStat', { n: parsed.words.length, m: withClues })
      : '';
    renderIssues(parsed.issues);
    saveDraft();
    return parsed;
  }

  ['wordInput', 'puzzleTitle', 'difficulty'].forEach(function (id) {
    $(id).addEventListener('input', refreshBuilderStats);
    $(id).addEventListener('change', refreshBuilderStats);
  });
  $('clueStyle').addEventListener('change', saveDraft);

  $('btnSample').addEventListener('click', function () {
    $('wordInput').value = SAMPLE;
    $('puzzleTitle').value = 'Orchard Crossword';
    refreshBuilderStats();
  });
  $('btnClearWords').addEventListener('click', function () {
    $('wordInput').value = '';
    refreshBuilderStats();
    $('wordInput').focus();
  });

  function updateAiStatus() {
    var cfg = AI.getConfig();
    var ready = AI.isConfigured();
    $('aiStatus').textContent = !ready ? t('aiOff')
      : cfg.provider === 'builtin' ? t('aiReadyBuiltin')
      : t('aiReady', { model: cfg.model });
    $('aiStatusNote').textContent = !ready ? t('aiNotConfigured')
      : cfg.provider === 'builtin' ? t('aiBuiltinTag')
      : cfg.model;
  }

  /* ---------------- generation ---------------- */
  async function generatePuzzle() {
    if (builderMode === 'article') return generateFromArticle();
    var parsed = refreshBuilderStats();
    if (!parsed.words.length) {
      toast(t('genNeedWords'), true);
      return;
    }
    var difficulty = $('difficulty').value;
    var title = $('puzzleTitle').value.trim() || t('titlePh');
    var words = parsed.words.map(function (w) { return { answer: w.answer, clue: w.clue }; });
    var missing = words.filter(function (w) { return !w.clue.trim(); }).length;

    if (missing > 0 && $('useAi').checked) {
      if (AI.isConfigured()) {
        var busy = el('div', 'busy');
        busy.appendChild(el('div', 'spin'));
        busy.appendChild(el('div', null, t('aiBusy', { n: missing })));
        openModal(t('aiBusyTitle'), busy);
        try {
          var map = await AI.fillClues(words, difficulty);
          var got = 0;
          words.forEach(function (w) { if (map[w.answer]) { w.clue = map[w.answer]; got++; } });
          toast(got ? t(got === 1 ? 'aiWrote1' : 'aiWroteN', { n: got }) : t('aiNoUsable'), !got);
        } catch (err) {
          toast(AI.friendlyError(err), true);
        }
        closeModal();
      } else {
        toast(t('aiNoClueCfg', { n: missing }), true);
      }
    }

    var layout = Gen.generate(words, { difficulty: difficulty });
    adoptPuzzle({
      layout: layout,
      title: title,
      difficulty: difficulty,
      unplaced: layout.unplaced
    });
    var note = t('placedToast', { p: layout.meta.placed, t: layout.meta.total });
    if (layout.unplaced.length) note += t('placedSeeBelow');
    toast(note, !!layout.unplaced.length);
  }
  $('btnGenerate').addEventListener('click', generatePuzzle);

  /* article mode: fill cloze clues for words still missing one (cloze style
     fills all of them; auto style uses it as the offline fallback when the
     AI service is unreachable). Returns how many words had no cloze match. */
  function fillCloze(article, words) {
    var missing = 0;
    words.forEach(function (w) {
      if (w.clue) return;
      var cz = CW.Extract.clozeFor(article, w.answer);
      if (cz) w.clue = t('clozePrefix') + '“' + cz + '”';
      else missing++;
    });
    return missing;
  }

  /* article mode: selected candidates → clues from the article (AI or cloze) */
  async function generateFromArticle() {
    if ($('candidatesWrap').hidden || !selectedCandidateWords().length) {
      toast(t('needCandidates'), true);
      return;
    }
    var style = $('clueStyle').value;
    if (style === 'ai' && !AI.isConfigured()) { toast(t('aiStyleNoCfg'), true); return; }
    var useAi = style === 'ai' || (style === 'auto' && AI.isConfigured());
    var difficulty = $('difficulty').value;
    var title = $('puzzleTitle').value.trim() || t('titlePh');
    var article = $('articleInput').value;
    var answers = selectedCandidateWords();
    var words = answers.map(function (w) { return { answer: w, clue: '' }; });

    if (useAi) {
      var busy = el('div', 'busy');
      busy.appendChild(el('div', 'spin'));
      var busyText = el('div', null, t('aiArticleBusy', { n: answers.length }));
      busy.appendChild(busyText);
      openModal(t('aiBusyTitle'), busy);
      try {
        var map = await AI.cluesFromArticle(article, answers, difficulty, function (done, total) {
          busyText.textContent = t('aiArticleBusy', { n: total }) + ' ' + t('aiProgress', { done: done, total: total });
        });
        var got = 0;
        words.forEach(function (w) { if (map[w.answer]) { w.clue = map[w.answer]; got++; } });
        toast(got ? t(got === 1 ? 'aiWrote1' : 'aiWroteN', { n: got }) : t('aiNoUsable'), !got);
      } catch (err) {
        toast(AI.friendlyError(err), true);
      }
      closeModal();
      if (style === 'auto') fillCloze(article, words);
    } else {
      var missing = fillCloze(article, words);
      if (missing) toast(t('noClozeN', { n: missing }), true);
    }

    var layout = Gen.generate(words, { difficulty: difficulty });
    adoptPuzzle({
      layout: layout,
      title: title,
      difficulty: difficulty,
      unplaced: layout.unplaced
    });
    var note = t('placedToast', { p: layout.meta.placed, t: layout.meta.total });
    if (layout.unplaced.length) note += t('placedSeeBelow');
    toast(note, !!layout.unplaced.length);
  }

  async function regenerate() {
    if (!state.layout) return;
    var words = state.layout.entries.map(function (e) { return { answer: e.answer, clue: e.clue }; })
      .concat(state.unplaced.map(function (u) { return { answer: u.answer, clue: u.clue }; }));
    if (words.length < 2) { toast(t('regenNeed2'), true); return; }
    if (state.solve.hasProgress()) {
      var go = await confirmModal(t('regenTitle'), t('regenConfirmP'), t('regenTitle'));
      if (!go) return;
    }
    var layout = Gen.generate(words, { difficulty: state.difficulty });
    adoptPuzzle({
      layout: layout,
      title: state.title,
      difficulty: state.difficulty,
      unplaced: layout.unplaced
    });
    toast(t('regenDone', { p: layout.meta.placed, t: layout.meta.total }));
  }

  /* ---------------- toolbar ---------------- */
  $('btnCheck').addEventListener('click', function () {
    var r = state.solve.check();
    if (r.wrong) toast(t(r.wrong === 1 ? 'check1' : 'checkN', { n: r.wrong }), true);
    else if (r.filled === r.total) toast(t('checkAll'));
    else toast(t('checkNone', { f: r.filled, t: r.total }));
  });
  $('btnHint').addEventListener('click', function () {
    toast(state.solve.hint() ? t('hintOk') : t('hintNone'));
  });
  $('btnReveal').addEventListener('click', function () {
    var box = el('div', 'modal-menu');
    var letter = btn(t('revealLetter'), '');
    letter.appendChild(el('small', null, t('revealLetterSub')));
    var word = btn(t('revealWord'), '');
    word.appendChild(el('small', null, t('revealWordSub')));
    var all = btn(t('revealAll'), 'danger');
    all.appendChild(el('small', null, t('revealAllSub')));
    letter.addEventListener('click', function () { closeModal(); state.solve.reveal('letter'); });
    word.addEventListener('click', function () { closeModal(); state.solve.reveal('word'); });
    all.addEventListener('click', async function () {
      closeModal();
      var go = await confirmModal(t('revealConfirmTitle'), t('revealConfirmP'), t('revealConfirmBtn'), true);
      if (go) state.solve.reveal('puzzle');
    });
    box.appendChild(letter); box.appendChild(word); box.appendChild(all);
    openModal(t('revealTitle'), box);
  });
  $('btnReset').addEventListener('click', async function () {
    var go = await confirmModal(t('resetTitle'), t('resetP'), t('resetBtn'), true);
    if (go) {
      state.solve.resetProgress();
      $('solvedBanner').hidden = true;
    }
  });
  $('btnRegenerate').addEventListener('click', regenerate);
  $('btnExit').addEventListener('click', showBuilder);
  $('btnHome').addEventListener('click', showBuilder);

  /* ---------------- share ---------------- */
  $('btnShare').addEventListener('click', function () {
    var url = location.href;
    var box = el('div');
    box.appendChild(el('p', 'modal-p', t('shareP')));
    var row = el('div', 'url-box');
    var input = el('input'); input.readOnly = true; input.value = url;
    input.addEventListener('focus', function () { input.select(); });
    var copy = btn(t('copy'));
    row.appendChild(input); row.appendChild(copy);
    box.appendChild(row);
    var r2 = el('div', 'btn-row');
    if (navigator.share) {
      var sys = btn(t('webShare'));
      sys.addEventListener('click', function () {
        navigator.share({ title: state.title, text: t('shareText', { title: state.title }), url: url }).catch(function () { });
      });
      r2.appendChild(sys);
    }
    var done = btn(t('done'), 'primary');
    done.addEventListener('click', closeModal);
    r2.appendChild(done);
    box.appendChild(r2);
    copy.addEventListener('click', function () {
      input.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { }
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(function () { toast(t('copied')); }, function () {
          toast(ok ? t('copied') : t('copyFail'), !ok);
        });
      } else {
        toast(ok ? t('copied') : t('copyFail'), !ok);
      }
    });
    openModal(t('shareTitle'), box);
  });

  /* ---------------- donate ---------------- */
  CW.Donation.init({
    openModal: function (title, bodyEl) { openModal(title, bodyEl); },
    closeModal: closeModal
  });
  $('btnDonate').addEventListener('click', function () { CW.Donation.open(); });

  /* ---------------- editor drawer ---------------- */
  function openDrawer() {
    if (!state.layout) return;
    $('editTitle').value = state.title;
    $('editDifficulty').value = state.difficulty;
    var wrap = $('editClues');
    wrap.innerHTML = '';
    state.layout.entries.forEach(function (e, ix) {
      var row = el('div', 'ec');
      var lab = el('label');
      lab.appendChild(el('span', null, e.number + (e.dir === 'across' ? 'A' : 'D') + ' · '));
      lab.appendChild(el('b', null, e.answer));
      row.appendChild(lab);
      var input = el('input');
      input.value = e.clue;
      input.dataset.entry = ix;
      input.placeholder = t('clueFor', { word: e.answer });
      row.appendChild(input);
      wrap.appendChild(row);
    });
    if (state.unplaced.length) {
      var head = el('div', 'field-label', t('notPlaced'));
      head.style.marginTop = '14px';
      wrap.appendChild(head);
      state.unplaced.forEach(function (u, ui) {
        var row = el('div', 'ec unplaced-ec');
        var lab = el('label');
        lab.appendChild(el('span', null, t('notPlacedDot')));
        lab.appendChild(el('b', null, u.answer));
        row.appendChild(lab);
        var input = el('input');
        input.value = u.clue;
        input.dataset.unplaced = ui;
        input.placeholder = t('clueFor', { word: u.answer }) + ' ' + t('keptForRegen');
        row.appendChild(input);
        wrap.appendChild(row);
      });
    }
    $('drawer').hidden = false;
    $('drawerScrim').hidden = false;
  }
  function closeDrawer() {
    $('drawer').hidden = true;
    $('drawerScrim').hidden = true;
  }
  $('btnEdit').addEventListener('click', openDrawer);
  $('btnDrawerClose').addEventListener('click', closeDrawer);
  $('drawerScrim').addEventListener('click', closeDrawer);

  function applyEdits() {
    state.title = $('editTitle').value.trim() || t('titlePh');
    state.difficulty = $('editDifficulty').value;
    $('editClues').querySelectorAll('input[data-entry]').forEach(function (input) {
      state.layout.entries[+input.dataset.entry].clue = input.value.trim();
    });
    $('editClues').querySelectorAll('input[data-unplaced]').forEach(function (input) {
      state.unplaced[+input.dataset.unplaced].clue = input.value.trim();
    });
    renderHeading();
    renderClues();
    resyncClueStates();
    updateShareUrl();
  }
  $('btnEditSave').addEventListener('click', function () {
    applyEdits();
    closeDrawer();
    toast(t('changesSaved'));
  });
  $('btnEditRegen').addEventListener('click', async function () {
    applyEdits();
    closeDrawer();
    await regenerate();
  });

  /* ---------------- print / pdf ---------------- */
  function todayLocalized() {
    try {
      return new Date().toLocaleDateString(I.localeTag(), { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) { return ''; }
  }
  $('btnPrint').addEventListener('click', function () {
    if (!state.layout) return;
    var box = el('div');

    var titleRow = el('label', 'field');
    titleRow.appendChild(el('span', 'field-label', t('printTitleL')));
    var titleInput = el('input');
    titleInput.type = 'text'; titleInput.maxLength = 72; titleInput.value = state.title;
    titleRow.appendChild(titleInput);

    var dateRow = el('div', 'check-row');
    var dateChk = el('input'); dateChk.type = 'checkbox'; dateChk.checked = true;
    dateRow.appendChild(dateChk);
    dateRow.appendChild(el('span', null, t('printShowDate')));
    var dateInput = el('input');
    dateInput.type = 'text'; dateInput.maxLength = 40;
    dateInput.value = todayLocalized();
    dateInput.setAttribute('data-i18n-placeholder', 'printDatePh');
    dateInput.placeholder = t('printDatePh');
    dateRow.appendChild(dateInput);

    var chkLabel = el('label', 'check-row');
    var chk = el('input'); chk.type = 'checkbox';
    chkLabel.appendChild(chk);
    chkLabel.appendChild(el('span', null, t('printSolutionLabel')));

    var preview = el('div', 'print-preview');
    var row = el('div', 'btn-row');
    var printBtn = btn(t('printBtn'), 'primary');
    row.appendChild(printBtn);
    var note = el('p', 'modal-note', t('printNote'));
    var built = null;
    var rebuild = function () {
      $('printRoot').innerHTML = '';
      built = CW.Print.build({
        layout: state.layout,
        title: titleInput.value.trim() || state.title,
        difficulty: t('diff_' + state.difficulty),
        issue: state.issue,
        date: dateChk.checked ? dateInput.value.trim() : ''
      }, { solution: chk.checked });
      preview.innerHTML = '';
      preview.appendChild(built.scroller);
      requestAnimationFrame(function () { scalePreview(); });
    };
    var scalePreview = function () {
      if (!built) return;
      var pages = built.pages, scroller = built.scroller;
      var w = pages.offsetWidth, h = pages.offsetHeight;
      if (!w) return;
      var s = Math.min(1, (scroller.clientWidth - 30) / w);
      pages.style.transform = 'scale(' + s + ')';
      scroller.style.height = (h * s + 28) + 'px';
    };
    titleInput.addEventListener('input', rebuild);
    dateChk.addEventListener('change', function () {
      dateInput.disabled = !dateChk.checked;
      rebuild();
    });
    dateInput.addEventListener('input', rebuild);
    chk.addEventListener('change', rebuild);
    printBtn.addEventListener('click', function () {
      if (!built) return;
      var pr = $('printRoot');
      pr.innerHTML = '';
      pr.appendChild(built.scroller); /* pages must live under #printRoot while printing */
      if (typeof window.print === 'function') window.print();
    });
    window.addEventListener('afterprint', function () {
      if (built && preview.isConnected) {
        preview.innerHTML = '';
        preview.appendChild(built.scroller);
        requestAnimationFrame(scalePreview);
      }
    });

    box.appendChild(titleRow);
    box.appendChild(dateRow);
    box.appendChild(chkLabel);
    box.appendChild(preview);
    box.appendChild(row);
    box.appendChild(note);
    openModal(t('printTitle'), box, true);
    rebuild();
  });

  /* ---------------- AI settings ---------------- */
  $('btnSettings').addEventListener('click', function () {
    var saved = CW.Store.loadAiConfig() || {};
    var custom = saved.baseUrl || saved.provider === 'custom'
      ? { baseUrl: saved.baseUrl || '', model: saved.model || '', apiKey: saved.apiKey || '' }
      : { baseUrl: '', model: '', apiKey: '' };
    var isBuiltin = !(saved.baseUrl || saved.provider === 'custom');
    var box = el('div');

    box.appendChild(el('p', 'modal-p', t('settingsP')));

    var provField = el('div', 'field');
    provField.appendChild(el('span', 'field-label', t('providerLabel')));
    var rowB = el('label', 'check-row');
    var rBuiltin = el('input'); rBuiltin.type = 'radio'; rBuiltin.name = 'aiProvider';
    rBuiltin.value = 'builtin'; rBuiltin.checked = isBuiltin;
    rowB.appendChild(rBuiltin);
    rowB.appendChild(el('span', null, t('providerBuiltin')));
    var rowC = el('label', 'check-row');
    var rCustom = el('input'); rCustom.type = 'radio'; rCustom.name = 'aiProvider';
    rCustom.value = 'custom'; rCustom.checked = !isBuiltin;
    rowC.appendChild(rCustom);
    rowC.appendChild(el('span', null, t('providerCustom')));
    provField.appendChild(rowB);
    provField.appendChild(rowC);
    box.appendChild(provField);

    var customWrap = el('div');
    customWrap.hidden = isBuiltin;

    var f1 = el('label', 'field');
    f1.appendChild(el('span', 'field-label', t('baseUrl')));
    var i1 = el('input'); i1.type = 'text'; i1.value = custom.baseUrl;
    i1.placeholder = 'https://api.openai.com/v1';
    f1.appendChild(i1);

    var f2 = el('label', 'field');
    f2.appendChild(el('span', 'field-label', t('model')));
    var i2 = el('input'); i2.type = 'text'; i2.value = custom.model;
    i2.placeholder = 'gpt-4o-mini';
    f2.appendChild(i2);

    var f3 = el('label', 'field');
    f3.appendChild(el('span', 'field-label', t('apiKey')));
    var i3 = el('input'); i3.type = 'password'; i3.value = custom.apiKey;
    i3.placeholder = 'sk-…';
    f3.appendChild(i3);

    customWrap.appendChild(f1); customWrap.appendChild(f2); customWrap.appendChild(f3);
    box.appendChild(customWrap);

    var testRow = el('div', 'btn-row');
    var testBtn = btn(t('aiTestBtn'));
    var testOut = el('span', 'field-hint ai-test-out');
    testRow.appendChild(testBtn);
    box.appendChild(testRow);
    box.appendChild(testOut);

    var row = el('div', 'btn-row');
    var save = btn(t('saveBtn'), 'primary');
    var clear = btn(t('clearBtn'));
    row.appendChild(save); row.appendChild(clear);
    box.appendChild(row);
    box.appendChild(el('p', 'modal-note', t('settingsNote')));

    function currentCfg() {
      var provider = rBuiltin.checked ? 'builtin' : 'custom';
      return { provider: provider, baseUrl: i1.value.trim(), model: i2.value.trim(), apiKey: i3.value.trim() };
    }
    function syncFields() {
      customWrap.hidden = rBuiltin.checked;
    }
    rBuiltin.addEventListener('change', syncFields);
    rCustom.addEventListener('change', syncFields);

    testBtn.addEventListener('click', function () {
      var cfg = AI.resolveConfig(currentCfg());
      if (!cfg.baseUrl || (cfg.provider === 'custom' && !cfg.model)) {
        testOut.textContent = t('settingsNeed');
        return;
      }
      testBtn.disabled = true;
      testOut.textContent = t('aiTesting');
      AI.ping(cfg).then(function () {
        testOut.textContent = t('aiTestOk');
      }).catch(function (err) {
        testOut.textContent = AI.friendlyError(err);
      }).then(function () {
        testBtn.disabled = false;
      });
    });

    save.addEventListener('click', function () {
      AI.saveConfig(currentCfg());
      updateAiStatus();
      closeModal();
      toast(AI.isConfigured() ? t('settingsSaved') : t('settingsNeed'), !AI.isConfigured());
    });
    clear.addEventListener('click', function () {
      i1.value = ''; i2.value = ''; i3.value = '';
    });
    openModal(t('settingsTitle'), box);
  });

  /* ---------------- language ---------------- */
  function updateLangButtons() {
    var lang = I.getLang();
    $('langEn').classList.toggle('active', lang === 'en');
    $('langZh').classList.toggle('active', lang === 'zh');
    $('langEn').setAttribute('aria-pressed', lang === 'en');
    $('langZh').setAttribute('aria-pressed', lang === 'zh');
  }
  function updateMastDate() {
    try {
      $('mastDate').textContent = new Date().toLocaleDateString(I.localeTag(), {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      });
    } catch (e) { /* keep empty */ }
  }
  $('langEn').addEventListener('click', function () { I.setLang('en'); });
  $('langZh').addEventListener('click', function () { I.setLang('zh'); });

  I.onChange(function () {
    updateLangButtons();
    updateMastDate();
    closeModal();
    if (state.layout && !$('viewSolve').hidden) {
      renderHeading();
      renderClues();
      renderUnplaced();
      var progress = state.solve.getProgress();
      state.solve.load(state.layout, progress); /* rebuilds grid aria labels */
      resyncClueStates();
      if (progress && progress.solved) showSolvedBanner(progress.elapsed);
      state.solve.resumeTimer();
      $('mastIssue').textContent = t('noAbbr') + ' ' + state.issue;
      if (!$('drawer').hidden) openDrawer(); /* refill with translated labels */
    }
    if (!$('viewBuilder').hidden) refreshBuilderStats();
    updateAiStatus();
  });

  /* ---------------- global keys ---------------- */
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') {
      if (!modal.hidden) closeModal();
      else if (!$('drawer').hidden) closeDrawer();
    }
  });

  /* ---------------- boot ---------------- */
  function boot() {
    document.documentElement.lang = I.getLang() === 'zh' ? 'zh-CN' : 'en';
    I.applyStatic();
    updateLangButtons();
    updateMastDate();

    var draft = Store.loadDraft();
    if (draft) {
      $('wordInput').value = draft.text || '';
      $('puzzleTitle').value = draft.title || '';
      $('difficulty').value = draft.difficulty || 'medium';
      $('articleInput').value = draft.article || '';
      if (draft.clueStyle) $('clueStyle').value = draft.clueStyle;
    }
    updateAiStatus();
    switchMode(draft && draft.mode === 'article' ? 'article' : 'words');
    refreshBuilderStats();
    if (builderMode === 'article') {
      refreshArticleStats();
      var art = $('articleInput').value;
      if (art) {
        var res = CW.Extract.analyze(art);
        if (res.wordCount >= 20) {
          lastCandidates = res.candidates;
          renderCandidates(draft && draft.selected || []);
          $('candidatesWrap').hidden = false;
        }
      }
    }

    var frag = Codec.readFromLocation();
    if (frag) {
      Codec.decode(frag)
        .then(function (p) { adoptFromPayload(p); })
        .catch(function () {
          toast(t('linkUnreadable'), true);
          showBuilder();
        });
      return;
    }
    var saved = Store.loadCurrentPuzzle();
    if (saved && saved.entries && saved.entries.length) {
      adoptFromPayload(saved);
      return;
    }
    showBuilder();
  }

  boot();
})();
