/* =====================================================================
   DOM-level end-to-end test — runs the real app (index.html + all
   scripts) inside jsdom and drives it like a user would.
   Run: node test/dom-test.js
   ===================================================================== */
'use strict';
const path = require('path');
const fs = require('fs');
const { JSDOM } = require('jsdom');

let passed = 0, failed = 0;
function ok(cond, label) {
  if (cond) passed++;
  else { failed++; console.error('  ✗ FAIL: ' + label); }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const dom = new JSDOM(html, {
    url: 'http://localhost:8741/',
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    beforeParse(window) {
      window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
    }
  });
  const { window } = dom;
  const { document } = window;
  await sleep(400); // let scripts + boot settle

  const $ = id => document.getElementById(id);
  const click = el => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  const typeInto = (ch) => {
    const g = $('ghostInput');
    g.value = ch;
    g.dispatchEvent(new window.Event('input', { bubbles: true }));
  };
  const letters = () => Array.from(document.querySelectorAll('#grid .cell .ltr'))
    .filter(e => e.textContent).map(e => e.textContent).join('');

  /* ---------- 1. boot: English default (jsdom navigator.language = en-US) ---------- */
  ok(document.documentElement.lang === 'en', 'boot: html lang=en');
  ok($('btnGenerate').textContent.trim() === 'Generate crossword', 'boot: English UI text');
  ok(/EN/.test($('langEn').textContent) && !$('langEn').classList.contains('active') === false, 'boot: EN button active');

  /* ---------- 2. builder: sample + stats + issues ---------- */
  click($('btnSample'));
  ok($('wordStats').textContent.includes('12'), 'builder: 12 words counted');
  $('wordInput').value = 'ab\napple | red fruit\napple\nhello world';
  $('wordInput').dispatchEvent(new window.Event('input', { bubbles: true }));
  const issueText = $('parseIssues').textContent;
  ok(/minimum 3/.test(issueText), 'builder: too-short issue shown');
  ok(/Duplicate/.test(issueText), 'builder: duplicate issue shown');
  ok(/spaces/.test(issueText), 'builder: spaces issue shown');

  /* ---------- 3. language switch to zh ---------- */
  click($('langZh'));
  ok(document.documentElement.lang === 'zh-CN', 'lang: html lang=zh-CN');
  ok($('btnGenerate').textContent.includes('生成'), 'lang: generate button zh');
  ok($('cluesAcross') && document.querySelector('[data-i18n="across"]').textContent === '横向', 'lang: Across → 横向');
  ok($('wordStats').textContent.includes('个单词'), 'lang: stats re-rendered zh');
  click($('langEn'));
  ok($('btnGenerate').textContent === 'Generate crossword', 'lang: back to English');

  /* ---------- 4. generate a puzzle ---------- */
  click($('btnSample'));
  click($('btnGenerate'));
  await sleep(150);
  ok(document.querySelectorAll('#grid .cell').length > 0, 'generate: grid rendered');
  const entries = document.querySelectorAll('.clue').length;
  ok(entries >= 8, 'generate: clue list rendered (' + entries + ' entries)');
  ok(window.location.hash.indexOf('#p=') === 0, 'generate: share URL hash set');
  const firstHash = window.location.hash;
  ok($('puzzleHeading').textContent === 'Orchard Crossword', 'generate: title shown');
  ok(!/no clue/.test($('cluesAcross').textContent) === false, 'generate: some clues missing (sample has clue-less words)');

  /* ---------- 5. typing letters ---------- */
  const firstCell = document.querySelector('#grid .cell:not(.blk)');
  click(firstCell);
  ok(document.querySelector('.cell.cur') !== null, 'type: cell selected');
  typeInto('Q'); // wrong on purpose
  typeInto('Z');
  ok(/QZ/.test(letters()), 'type: letters appear in grid');
  ok($('timer').textContent === '00:00' || $('timer').textContent === '00:01', 'type: timer alive');

  /* ---------- 6. check marks errors ---------- */
  click($('btnCheck'));
  const errs = document.querySelectorAll('.cell.err').length;
  ok(errs >= 2, 'check: wrong letters marked (' + errs + ')');

  /* ---------- 7. hint reveals a correct letter ---------- */
  const hintBefore = letters();
  click($('btnHint'));
  ok(letters() !== hintBefore, 'hint: a letter was revealed');

  /* ---------- 8. reveal word via menu ---------- */
  click($('btnReveal'));
  ok(!$('modal').hidden, 'reveal: menu opens');
  const wordBtn = Array.from($('modalBody').querySelectorAll('button'))
    .find(b => /Reveal word/i.test(b.textContent));
  click(wordBtn);
  const revealedCells = document.querySelectorAll('.cell.rev').length;
  ok(revealedCells >= 3, 'reveal word: cells revealed (' + revealedCells + ')');

  /* ---------- 9. progress auto-save + language switch preserves it ---------- */
  await sleep(600); // debounce
  const savedKey = Object.keys(window.localStorage).find(k => k.indexOf('cw-progress:') === 0);
  ok(!!savedKey, 'progress: saved to localStorage');
  const savedBefore = JSON.parse(window.localStorage.getItem(savedKey));
  ok(Object.keys(savedBefore.letters).length >= 4, 'progress: letters persisted');
  const lettersBeforeLangSwitch = letters();
  click($('langZh'));
  ok(letters() === lettersBeforeLangSwitch && letters().length > 0, 'lang switch: progress kept on grid');
  ok(/横向/.test(document.querySelector('[data-i18n="across"]').textContent), 'lang switch: solve view re-rendered zh');
  click($('langEn'));

  /* ---------- 10. clue click locates word ---------- */
  const aClue = document.querySelector('.clue');
  click(aClue);
  ok(document.querySelector('.clue.active') === aClue, 'clue click: clue activated');
  ok(document.querySelectorAll('.cell.in-word').length >= 3, 'clue click: word highlighted');

  /* ---------- 11. edit drawer: change title + clue ---------- */
  click($('btnEdit'));
  ok(!$('drawer').hidden, 'drawer: opens');
  $('editTitle').value = 'Renamed Puzzle';
  const firstClueInput = $('editClues').querySelector('input[data-entry="0"]');
  firstClueInput.value = 'EDITED CLUE ' + Date.now();
  click($('btnEditSave'));
  ok($('puzzleHeading').textContent === 'Renamed Puzzle', 'drawer: title applied');
  ok(document.querySelector('.clue[data-entry="0"] .ctext').textContent.includes('EDITED CLUE'), 'drawer: clue applied');
  await sleep(250); // URL refresh is async (gzip)
  ok(window.location.hash !== firstHash, 'drawer: share URL updated after edits');

  /* ---------- 12. print modal: title override, date toggle, answer key ---------- */
  click($('btnPrint'));
  ok(!$('modal').hidden, 'print: modal opens');
  let pages = $('modalBody').querySelectorAll('.a4');
  ok(pages.length === 1, 'print: one page without answer key');

  // printable title override (does not touch the saved puzzle)
  const printTitleInput = $('modalBody').querySelector('.field input[type="text"]');
  printTitleInput.value = 'Custom Print Title';
  printTitleInput.dispatchEvent(new window.Event('input', { bubbles: true }));
  await sleep(60);
  ok($('modalBody').querySelector('.p-title').textContent === 'Custom Print Title', 'print: title override applied');
  ok($('puzzleHeading').textContent === 'Renamed Puzzle', 'print: puzzle title untouched');

  // date shown by default, hidden when unchecked
  const printDateChk = $('modalBody').querySelector('.check-row > input[type="checkbox"]'); // date row is first
  const todayStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  ok($('modalBody').querySelector('.p-sub').textContent.includes(todayStr), 'print: date shown by default');
  printDateChk.checked = false;
  printDateChk.dispatchEvent(new window.Event('change', { bubbles: true }));
  await sleep(60);
  ok(!$('modalBody').querySelector('.p-sub').textContent.includes(todayStr), 'print: date hidden when unchecked');
  // custom date text
  printDateChk.checked = true;
  printDateChk.dispatchEvent(new window.Event('change', { bubbles: true }));
  const printDateInput = $('modalBody').querySelector('.check-row input[type="text"]');
  printDateInput.value = '1 January 2030';
  printDateInput.dispatchEvent(new window.Event('input', { bubbles: true }));
  await sleep(60);
  ok($('modalBody').querySelector('.p-sub').textContent.includes('1 January 2030'), 'print: custom date applied');

  const chk = $('modalBody').querySelector('label.check-row > input[type="checkbox"]'); // solution row
  chk.checked = true;
  chk.dispatchEvent(new window.Event('change', { bubbles: true }));
  await sleep(120);
  pages = $('modalBody').querySelectorAll('.a4');
  ok(pages.length === 2, 'print: answer key page added');
  ok(pages[0].querySelectorAll('table.p-grid td').length > 0, 'print: grid table built');
  ok(pages[0].querySelectorAll('.pltr').length === 0, 'print: puzzle page has no letters');
  ok(pages[1].querySelectorAll('.pltr').length > 0, 'print: solution page has letters');
  const anyBlk = pages[0].querySelectorAll('td.blk').length;
  ok(anyBlk > 0, 'print: black cells present');
  ok(/Across/.test(pages[0].textContent), 'print: Across clues on page');
  // 关闭弹窗
  click(document.querySelector('.modal-x'));
  ok($('modal').hidden, 'print: modal closes');

  /* ---------- 13. share modal ---------- */
  click($('btnShare'));
  ok(!$('modal').hidden, 'share: modal opens');
  const urlInput = $('modalBody').querySelector('input');
  ok(urlInput.value.indexOf('#p=') !== -1, 'share: URL shown');
  click(document.querySelector('.modal-x'));

  /* ---------- 14. regenerate produces a new layout ---------- */
  const gridBefore = document.querySelector('#grid').innerHTML;
  click($('btnRegenerate')); // progress exists → confirm modal
  const confirmBtn = Array.from($('modalBody').querySelectorAll('button')).find(b => /Regenerate/i.test(b.textContent));
  ok(!!confirmBtn, 'regen: confirmation shown');
  click(confirmBtn);
  await sleep(150);
  const gridAfter = document.querySelector('#grid').innerHTML;
  ok(gridBefore !== gridAfter, 'regen: layout changed');

  /* ---------- 15. solved flow: fill everything correctly via reveal puzzle ---------- */
  click($('btnReveal'));
  const allBtn = Array.from($('modalBody').querySelectorAll('button')).find(b => /entire puzzle/i.test(b.textContent));
  click(allBtn);
  const goBtn = Array.from($('modalBody').querySelectorAll('button')).find(b => /Reveal everything/i.test(b.textContent));
  ok(!!goBtn, 'reveal all: confirmation shown');
  click(goBtn);
  await sleep(120); // confirm resolves on a microtask; reveal runs after
  ok(!$('solvedBanner').hidden, 'solved: banner shown after full reveal');
  await sleep(500);
  const progKeys = Object.keys(window.localStorage).filter(k => k.indexOf('cw-progress:') === 0);
  const solvedProgress = JSON.parse(window.localStorage.getItem(progKeys[progKeys.length - 1]));
  ok(solvedProgress.solved === true, 'solved: persisted');

  /* ---------- 16. share URL restores puzzle (fresh window from hash) ---------- */
  // wait until the async (gzip) URL refresh has fully settled: poll until the
  // hash stops changing, otherwise a queued replaceState can land after capture
  let lastHash = window.location.hash, stable = 0;
  for (let i = 0; i < 14 && stable < 2; i++) {
    await sleep(150);
    if (window.location.hash === lastHash) stable++;
    else { stable = 0; lastHash = window.location.hash; }
  }
  const shareUrl = window.location.href;
  const dom2 = new JSDOM(fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8'), {
    url: shareUrl,
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true
  });
  await sleep(500);
  const d2 = dom2.window.document;
  ok(dom2.window.location.hash === window.location.hash, 'restore: hash carried');
  ok(d2.querySelectorAll('#grid .cell').length > 0, 'restore: grid rebuilt from URL');
  const restoredTitle = d2.getElementById('puzzleHeading').textContent;
  ok(restoredTitle === 'Renamed Puzzle', 'restore: title restored (' + restoredTitle + ')');
  const restoredClues = d2.querySelectorAll('.clue').length;
  ok(restoredClues === document.querySelectorAll('.clue').length, 'restore: same entry count');

  /* ---------- 17. article mode: extract → pick → cloze clues → generate ---------- */
  const TEST_ARTICLE = 'The lighthouse at Cape Morrow has guarded the coast for a century. ' +
    'Every evening the keeper Alice climbed the iron stairs and lit the lantern. ' +
    'The lantern guided ships past the rocks in every storm. ' +
    'Sailors trusted the light and the harbor never lost a ship. ' +
    'When storm waves hammered the tower Alice still climbed. ' +
    'The lantern still turns today and sailors still wave from the ships.';
  click($('btnHome'));
  click($('modeArticle'));
  ok(!$('articlePanel').hidden && $('wordsPanel').hidden, 'article: panel swaps');
  ok($('aiFillRow').hidden, 'article: word-list AI checkbox hidden');
  $('articleInput').value = TEST_ARTICLE;
  $('articleInput').dispatchEvent(new window.Event('input', { bubbles: true }));
  ok(/words/.test($('articleStats').textContent), 'article: live stats (' + $('articleStats').textContent + ')');

  // too-short guard
  $('articleInput').value = 'Too short text.';
  $('articleInput').dispatchEvent(new window.Event('input', { bubbles: true }));
  click($('btnExtract'));
  ok($('candidatesWrap').hidden, 'article: short text rejected');

  $('articleInput').value = TEST_ARTICLE;
  $('articleInput').dispatchEvent(new window.Event('input', { bubbles: true }));
  click($('btnExtract'));
  await sleep(80);
  ok(!$('candidatesWrap').hidden, 'article: candidates shown');
  const candWords = Array.from($('candidateList').querySelectorAll('.cand-word')).map(e => e.textContent);
  ok(candWords.includes('LANTERN'), 'article: LANTERN is a candidate');
  ok(!candWords.includes('THE'), 'article: stopwords excluded');
  ok(candWords.indexOf('LANTERN') < 5, 'article: frequent words rank top (' + candWords.slice(0, 5).join(',') + ')');
  ok(candWords.includes('STORM'), 'article: STORM among candidates');

  click($('btnCandTop'));
  const selCount = $('candidateList').querySelectorAll('input:checked').length;
  ok(selCount === Math.min(10, candWords.length), 'article: top-10 selects ' + selCount);

  $('addWordInput').value = 'beacon';
  click($('btnAddWord'));
  const beaconBox = $('candidateList').querySelector('input[value="BEACON"]');
  ok(beaconBox && beaconBox.checked, 'article: custom word added and checked');

  // generate without picking → blocked
  click($('btnCandNone'));
  click($('btnGenerate'));
  await sleep(80);
  ok(!$('viewBuilder').hidden, 'article: generate blocked with no selection');

  click($('btnCandTop'));
  $('clueStyle').value = 'cloze';
  $('clueStyle').dispatchEvent(new window.Event('change', { bubbles: true }));
  $('puzzleTitle').value = 'Lighthouse Puzzle';
  click($('btnGenerate'));
  await sleep(250);
  ok(!$('viewSolve').hidden && document.querySelectorAll('#grid .cell').length > 0, 'article: grid generated');
  const clueTexts = Array.from(document.querySelectorAll('.clue .ctext')).map(e => e.textContent);
  ok(clueTexts.some(c => c.includes('______')), 'article: cloze clue contains a blank');
  ok(clueTexts.some(c => c.indexOf('From the text') === 0), 'article: cloze prefix used');
  // each word's own answer is hidden in its cloze clue (exact expected strings)
  ['LANTERN', 'SHIPS'].forEach(w => {
    const expected = 'From the text: \u201C' + window.CW.Extract.clozeFor(TEST_ARTICLE, w) + '\u201D';
    if (clueTexts.includes(expected)) {
      ok(!new RegExp('\\b' + w + 'S?\\b', 'i').test(clueTexts.find(c => c === expected)), 'article: cloze for ' + w + ' hides its answer');
    } else {
      ok(false, 'article: expected cloze clue for ' + w + ' not found');
    }
  });

  // AI-style without configuration is blocked with a toast, stays in builder
  click($('btnHome'));
  $('clueStyle').value = 'ai';
  $('clueStyle').dispatchEvent(new window.Event('change', { bubbles: true }));
  click($('btnGenerate'));
  await sleep(120);
  ok(!$('viewBuilder').hidden, 'article: AI style without config aborts');

  // draft persistence + zh strings for the article flow
  const draftNow = JSON.parse(window.localStorage.getItem('cw-draft'));
  ok(draftNow.mode === 'article' && draftNow.article === TEST_ARTICLE, 'article: draft persisted');
  click($('langZh'));
  ok($('modeArticle').textContent === '文章', 'article lang: mode button zh');
  ok($('btnExtract').textContent.includes('提取'), 'article lang: extract button zh');
  ok($('clueStyle').selectedOptions[0].textContent.indexOf('AI 文章式') !== -1, 'article lang: selected style zh');
  click($('langEn'));

  /* ---------- 18. donation per unified spec ---------- */
  const entry = $('btnDonate');
  ok(!!entry && document.querySelectorAll('#btnDonate').length === 1, 'donate: single footer entry');
  ok(/☕/.test(entry.textContent), 'donate: entry carries ☕');
  ok(entry.querySelector('[data-i18n="donateEntry"]').textContent === 'Buy me a coffee', 'donate: en entry copy');

  click(entry);
  ok(!$('modal').hidden, 'donate: dialog opens');
  const tablist = $('modalBody').querySelector('[role="tablist"]');
  const tabAli = document.getElementById('donateTab-alipay');
  const tabWx = document.getElementById('donateTab-wechat');
  ok(!!tablist && !!tabAli && !!tabWx, 'donate: payment tabs rendered');
  ok(tabAli.getAttribute('aria-selected') === 'true' && !tabAli.classList.contains('active') === false, 'donate: Alipay default selected');
  ok($('modalTitle').textContent.includes('Buy me a coffee') && /☕/.test($('modalTitle').textContent), 'donate: dialog title');
  ok(document.querySelector('.donate-desc').textContent.length > 10, 'donate: description line shown');

  // lazy realtime QR: canvas generated at open time, no static <img>
  await sleep(350); // vendor lib loads over http from the dev server
  let qrCanvas = document.querySelector('#donateQrHost .qr-canvas');
  ok(!!qrCanvas && qrCanvas.tagName === 'CANVAS', 'donate: QR painted onto a live canvas');
  ok(document.querySelectorAll('.donate-modal img, .qr-card img').length === 0, 'donate: no static QR images in dialog');
  ok(qrCanvas.getAttribute('aria-label') === 'Scan with Alipay', 'donate: alipay scan caption/aria');
  const aliCanvas = qrCanvas;

  tabWx.click();
  await sleep(60);
  ok(tabWx.getAttribute('aria-selected') === 'true' && !tabAli.getAttribute('aria-selected') === false ? true : tabWx.classList.contains('active'), 'donate: wechat tab activates');
  const wxCanvas = document.querySelector('#donateQrHost .qr-canvas');
  ok(wxCanvas && wxCanvas !== aliCanvas, 'donate: switching re-renders QR');
  ok(wxCanvas.getAttribute('aria-label') === 'Scan with WeChat', 'donate: wechat caption swapped');

  // ESC closes
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await sleep(60);
  ok($('modal').hidden, 'donate: ESC closes dialog');

  // zh labels
  click($('langZh'));
  ok(entry.querySelector('[data-i18n="donateEntry"]').textContent === '请作者喝杯咖啡', 'donate lang: zh entry copy');
  click(entry);
  await sleep(80);
  ok($('modalTitle').textContent.indexOf('请作者喝杯咖啡') === 0, 'donate lang: zh title');
  ok(document.getElementById('donateTab-wechat').textContent === '微信支付', 'donate lang: zh tab');
  ok(document.querySelector('.donate-note').textContent === '没有自动打开？请使用支付宝 / 微信扫码'
    || document.getElementById('donateFallback').textContent === '没有自动打开？请使用支付宝 / 微信扫码',
    'donate lang: zh fallback copy per spec');
  click($('langEn'));

  /* ---------- 19. donation contract (regression guard) ---------- */
  const donationSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'donation.js'), 'utf8');
  ok(!/alipays:\/\//i.test(donationSrc), 'donate contract: no alipays:// scheme');
  ok(!/(src|href|url)\s*[:(=]\s*['"][^'"]*\.(png|jpe?g|svg|webp)/i.test(donationSrc), 'donate contract: no static QR image refs');
  const cssSrc = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');
  const clsTokens = new Set();
  (donationSrc.match(/'[^']{2,80}'/g) || []).forEach(lit => {
    lit.slice(1, -1).split(/\s+/).forEach(tok => {
      if (/^(donate-|qr-(card|canvas|host))/.test(tok)) clsTokens.add(tok);
    });
  });
  const cssMissing = [...clsTokens].filter(tok => !new RegExp('\\.' + tok + '(?![\\w-])').test(cssSrc));
  ok(clsTokens.size > 0 && cssMissing.length === 0,
    'donate contract: donate/qr classes reconciled with style.css' + (cssMissing.length ? ' — missing ' + cssMissing.join(', ') : ''));

  /* ---------- 20. donation on mobile: Alipay window.open, once per session ---------- */
  const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
  const domM = new JSDOM(html, {
    url: 'http://localhost:8741/',
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    beforeParse(w) {
      w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
      /* jsdom may ignore its userAgent option — force it on the instance */
      Object.defineProperty(w.navigator, 'userAgent', { get: () => MOBILE_UA, configurable: true });
      Object.defineProperty(w.document, 'visibilityState', { get: () => 'visible', configurable: true });
      w.__opens = [];
      w.open = function (url, target, features) { w.__opens.push({ url, target, features }); return null; };
    }
  });
  const mw = domM.window;
  await sleep(400);
  ok(/Mobi/.test(mw.navigator.userAgent), 'donate mobile: UA override active');
  const mDoc = mw.document;
  const mClick = el => el.dispatchEvent(new mw.MouseEvent('click', { bubbles: true, cancelable: true }));
  mClick(mDoc.getElementById('btnDonate'));
  await sleep(150);
  ok(!mDoc.getElementById('modal').hidden, 'donate mobile: dialog opens');
  ok(mw.__opens.length === 1, 'donate mobile: official page opened once at dialog open');
  ok(mw.__opens[0] && mw.__opens[0].url === 'https://qr.alipay.com/fkx16432isyyhmx9ttwpi79', 'donate mobile: official receive URL');
  ok(mw.__opens[0] && mw.__opens[0].target === '_blank', 'donate mobile: opens in new tab');
  ok(mw.__opens[0] && /noopener/.test(mw.__opens[0].features || ''), 'donate mobile: noopener set');
  ok(mw.location.href === 'http://localhost:8741/', 'donate mobile: no same-tab navigation');
  ok(!mDoc.getElementById('donateJump').hidden, 'donate mobile: jump affordance visible');
  // re-tapping the active Alipay tab must not open a second time this session
  mClick(mDoc.getElementById('donateTab-alipay'));
  await sleep(80);
  ok(mw.__opens.length === 1, 'donate mobile: one auto-jump per dialog session');
  // back from the payment page → fallback note appears next to the QR
  await sleep(800);
  mDoc.dispatchEvent(new mw.Event('visibilitychange'));
  await sleep(80);
  ok(!mDoc.getElementById('donateFallback').hidden, 'donate mobile: return fallback note shown');
  // WeChat on mobile: never jumps, straight to QR
  mClick(mDoc.getElementById('donateTab-wechat'));
  await sleep(80);
  ok(mw.__opens.length === 1, 'donate mobile: WeChat never auto-jumps');
  // close + reopen → new dialog session, single auto-jump re-armed
  mDoc.dispatchEvent(new mw.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await sleep(80);
  mClick(mDoc.getElementById('btnDonate'));
  await sleep(150);
  ok(mw.__opens.length === 2, 'donate mobile: reopen re-arms the single auto-jump');
  domM.window.close();

  dom.window.close();
  dom2.window.close();

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
