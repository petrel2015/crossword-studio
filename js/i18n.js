/* =====================================================================
   Crossword Studio — i18n
   English / 简体中文. Detection: saved choice > browser language.
   Static markup uses data-i18n / data-i18n-placeholder /
   data-i18n-title attributes; dynamic strings call CW.t(key, params).
   ===================================================================== */
(function (global) {
  'use strict';

  var CW = global.CW = global.CW || {};
  var STORE_KEY = 'cw-lang';

  var DICT = {
    en: {
      est: 'Est. MMXXVI',
      settings: 'AI Settings',
      langAria: 'Language',

      heroT1: 'Type words.',
      heroT2: 'Get a crossword.',
      heroP: 'Enter one word per line — add your own clue after a vertical bar, or let AI write it. The generator weaves every word it can into a newspaper-style grid; anything that will not fit is reported, never dropped.',

      step1: 'Word list',
      step2: 'Puzzle settings',
      loadSample: 'Load sample',
      clearWords: 'Clear',
      wordListHint: 'One word per line. Optional clue:',
      wordInputPh: 'apple | It keeps the doctor away, supposedly\nbanana\norange | Citrus fruit that shares its name with a color\ngrape\nlemon | Sour yellow citrus',
      titleL: 'Title',
      titlePh: 'Untitled Crossword',
      difficultyL: 'Difficulty',
      diffEasy: 'Easy — dense, compact grid',
      diffMedium: 'Medium — balanced grid',
      diffHard: 'Hard — sprawling, sparse grid',
      aiFill: 'Write missing clues with AI',
      aiNotConfigured: '(not configured)',
      generate: 'Generate crossword',
      diffHint: 'Difficulty shapes the grid (Easy stays small and dense, Hard may sprawl) and, when AI clues are on, their style.',

      edit: 'Edit',
      regenerate: 'Regenerate',
      exit: 'Exit',
      check: 'Check',
      hint: 'Hint',
      reveal: 'Reveal ▾',
      reset: 'Reset',
      printShare: 'Print / PDF',
      share: 'Share',
      timerTitle: 'Elapsed time',

      across: 'Across',
      down: 'Down',
      noClue: '(no clue — add one via Edit)',
      gridHelp: 'Click a cell and type · arrows move · space flips direction · tab next clue',
      notPlacedTitle: 'Not placed in the grid — {u} of {t} words',
      notPlacedHint: 'These words share no usable letters or every crossing conflicted. Try Regenerate, remove them, or switch difficulty.',
      solvedWord: 'Solved',
      metaLine: '{diff} · {n} words in the grid · {r} × {c}',
      row: 'Row',
      column: 'column',

      drawerTitle: 'Edit puzzle',
      close: 'Close',
      appliesOnRegen: '(applies on regenerate)',
      clues: 'Clues',
      notPlaced: 'Not placed in the grid',
      notPlacedDot: 'Not placed · ',
      keptForRegen: '(kept for regeneration)',
      save: 'Save changes',
      saveRegen: 'Save & regenerate',
      changesSaved: 'Changes saved.',
      clueFor: 'Clue for {word}',

      cancel: 'Cancel',
      confirmOk: 'Confirm',
      saveBtn: 'Save',

      check1: '1 incorrect letter is marked on the grid.',
      checkN: '{n} incorrect letters are marked on the grid.',
      checkAll: 'Everything is filled and correct.',
      checkNone: 'No mistakes so far — {f} of {t} letters filled.',
      hintOk: 'One letter in the current word has been revealed.',
      hintNone: 'Nothing to hint — the current word is complete.',

      revealTitle: 'Reveal',
      revealLetter: 'Reveal letter',
      revealLetterSub: 'current cell',
      revealWord: 'Reveal word',
      revealWordSub: 'current clue',
      revealAll: 'Reveal entire puzzle',
      revealAllSub: 'gives up the whole grid',
      revealConfirmTitle: 'Reveal puzzle',
      revealConfirmP: 'This fills in the entire grid with the correct answers.',
      revealConfirmBtn: 'Reveal everything',

      resetTitle: 'Reset progress',
      resetP: 'Clear all entered letters, reveals and the timer for this puzzle.',
      resetBtn: 'Reset',

      regenTitle: 'Regenerate',
      regenConfirmP: 'Regenerating builds a fresh layout from the same words and clears your solving progress on this puzzle.',
      regenNeed2: 'Need at least two words to regenerate.',
      regenDone: 'New layout — {p} of {t} words placed.',
      placedToast: '{p} of {t} words placed',
      placedSeeBelow: ' — see “Not placed in the grid” below.',
      genNeedWords: 'Enter at least one word — 3 to 25 letters each.',

      aiBusyTitle: 'Generating',
      aiBusy: 'Writing {n} clue(s) with AI…',
      aiWrote1: 'AI wrote a clue for 1 word.',
      aiWroteN: 'AI wrote clues for {n} words.',
      aiNoUsable: 'AI returned no usable clues — left blank.',
      aiNoClueCfg: '{n} word(s) have no clue. Configure AI in AI Settings, or type them as “word | clue”.',

      shareTitle: 'Share this puzzle',
      shareP: 'The whole puzzle travels inside this link — anyone who opens it can solve online. No account, no server.',
      copy: 'Copy',
      webShare: 'Share…',
      done: 'Done',
      copied: 'Link copied to clipboard.',
      copyFail: 'Copy failed — select the link and copy manually.',
      shareText: '{title} — a crossword for you',

      linkDamaged: 'This puzzle link is damaged — the layout does not hold together.',
      linkUnreadable: 'This puzzle link could not be read.',

      printTitle: 'Print / export PDF',
      printSolutionLabel: 'Add an answer key page (second sheet with the filled grid)',
      printBtn: 'Print / Save as PDF',
      printNote: 'Paper: A4, portrait, black & white. In the browser print dialogue choose “Save as PDF” as the destination to export a PDF file. Margins “Default” work fine.',
      printTitleL: 'Print title',
      printShowDate: 'Show date',
      printDatePh: 'e.g. 20 August 2026',
      solution: 'Solution',
      answerKey: 'Answer key',
      noAbbr: 'No.',
      goodLuck: 'Across & down — good luck',

      modeWords: 'Word list',
      modeArticle: 'Article',
      modeAria: 'Input mode',
      articleHint: 'Paste an English article — a news story, essay or chapter. Candidate words are extracted locally in your browser.',
      articlePh: 'Paste the article text here…',
      extractWords: 'Extract candidate words',
      articleStat: '{n} words · {s} sentences',
      articleTooShort: 'The article is too short — paste at least ~20 words.',
      pickWords: 'Pick words',
      selectedN: '{n} selected',
      candTop: 'Top 10',
      candAll: 'All',
      candNone: 'None',
      addWord: 'Add',
      addWordPh: 'add a word',
      clueStyleL: 'Clue style',
      styleAuto: 'Auto — AI article-style when configured',
      styleCloze: 'Cloze from the text (offline)',
      styleAi: 'AI article-style',
      styleNote: 'Article-style clues cite scenes and phrasing from the text and mimic its tone. Cloze blanks the word out of its own sentence — fully offline.',
      needCandidates: 'Extract words from the article and pick at least one candidate first.',
      clozePrefix: 'From the text: ',
      aiStyleNoCfg: 'AI article-style clues need a configured endpoint — open AI Settings, or switch to the offline cloze style.',
      aiArticleBusy: 'Writing {n} article-based clues…',
      aiProgress: '{done} of {total} done',
      noClozeN: '{n} word(s) were not found in the article — no cloze clue for them.',

      footerNote: 'No server — everything runs in your browser',
      donateEntry: 'Buy me a coffee',
      donateTitle: 'Buy me a coffee',
      donateDesc: 'If this little tool helped you, you can buy the author a coffee.',
      donatePayAria: 'Payment method',
      tabAlipay: 'Alipay',
      tabWechat: 'WeChat Pay',
      scanAlipay: 'Scan with Alipay',
      scanWechat: 'Scan with WeChat',
      jumpAlipay: 'Open in Alipay',
      donateFallback: 'Didn’t open automatically? Scan the QR code instead.',
      qrLoading: 'Generating QR…',

      settingsTitle: 'AI Settings',
      baseUrl: 'Base URL',
      model: 'Model',
      apiKey: 'API key',
      clearBtn: 'Clear',
      settingsP: 'Any OpenAI-compatible chat endpoint works — OpenAI, DeepSeek, Volcengine Ark (https://ark.cn-beijing.volces.com/api/v3), Ollama, LM Studio. The key is stored only in this browser.',
      settingsNote: 'Words without a clue are sent to the model as a plain list; nothing else leaves your browser. Some providers block direct browser calls (CORS) — use a local model or a CORS-friendly endpoint then.',
      settingsSaved: 'AI settings saved.',
      settingsNeed: 'Fill in Base URL and Model to enable AI clues.',

      wordsStat: '{n} words · {m} with clues',
      aiReady: 'AI clues: {model}',
      aiOff: 'AI clues: not configured',
      solvedToast: 'Puzzle solved in {t}. Well played.',

      diff_easy: 'Easy',
      diff_medium: 'Medium',
      diff_hard: 'Hard',

      'issue.noLetters': 'No A–Z letters found',
      'issue.spaces': 'Single words only — no spaces inside a word',
      'issue.tooShort': 'Too short — minimum {min} letters',
      'issue.tooLong': 'Too long — maximum {max} letters',
      'issue.duplicate': 'Duplicate of {word}',

      'reason.noShared': 'Shares no letters with the placed words',
      'reason.conflicts': 'No valid position — every crossing conflicts with the layout',
      'reason.tooLongGrid': 'Longer than the {max}×{max} grid limit for this difficulty',
      'reason.default': 'Not placed when this puzzle was generated'
    },

    zh: {
      est: '创刊于 MMXXVI',
      settings: 'AI 设置',
      langAria: '语言',

      heroT1: '输入单词，',
      heroT2: '生成填字游戏。',
      heroP: '每行输入一个英文单词——可在竖线后自定义线索，或让 AI 代写。生成器会尽可能把每个词编织进报纸风格的网格；放不下的词会被明确列出，绝不悄悄丢弃。',

      step1: '词表',
      step2: '拼图设置',
      loadSample: '载入示例',
      clearWords: '清空',
      wordListHint: '每行一个单词。可选线索：',
      wordInputPh: 'apple | 据说每天一个，医生远离我\nbanana\norange | 与颜色同名的柑橘类水果\ngrape\nlemon | 酸酸的黄色柑橘',
      titleL: '标题',
      titlePh: '未命名填字游戏',
      difficultyL: '难度',
      diffEasy: '简单——紧密的小网格',
      diffMedium: '中等——均衡网格',
      diffHard: '困难——舒展的稀疏网格',
      aiFill: '用 AI 补写缺失的线索',
      aiNotConfigured: '（未配置）',
      generate: '生成填字游戏',
      diffHint: '难度影响网格形态（简单更小更密，困难更舒展），开启 AI 线索时也影响其风格。',

      edit: '编辑',
      regenerate: '重新生成',
      exit: '退出',
      check: '检查',
      hint: '提示',
      reveal: '揭示 ▾',
      reset: '重置',
      printShare: '打印 / PDF',
      share: '分享',
      timerTitle: '已用时间',

      across: '横向',
      down: '纵向',
      noClue: '（无线索——可在“编辑”中添加）',
      gridHelp: '点击格子输入字母 · 方向键移动 · 空格切换方向 · Tab 跳到下一条线索',
      notPlacedTitle: '未放入网格——共 {t} 个单词，{u} 个未放入',
      notPlacedHint: '这些词与已放置的词没有可用的公共字母，或所有交叉位置都存在冲突。可尝试“重新生成”、删除这些词或更换难度。',
      solvedWord: '已完成',
      metaLine: '{diff} · 网格内 {n} 词 · {r} × {c}',
      row: '第',
      column: '列',

      drawerTitle: '编辑拼图',
      close: '关闭',
      appliesOnRegen: '（重新生成时生效）',
      clues: '线索',
      notPlaced: '未放入网格的单词',
      notPlacedDot: '未放入 · ',
      keptForRegen: '（保留以便重新生成）',
      save: '保存修改',
      saveRegen: '保存并重新生成',
      changesSaved: '已保存修改。',
      clueFor: '{word} 的线索',

      cancel: '取消',
      confirmOk: '确认',
      saveBtn: '保存',

      check1: '有 1 个错误字母已在网格上标出。',
      checkN: '有 {n} 个错误字母已在网格上标出。',
      checkAll: '全部填写正确。',
      checkNone: '暂无错误——已填 {f} / {t} 个字母。',
      hintOk: '当前单词中的一个字母已揭示。',
      hintNone: '无可提示——当前单词已完成。',

      revealTitle: '揭示',
      revealLetter: '揭示字母',
      revealLetterSub: '当前格',
      revealWord: '揭示单词',
      revealWordSub: '当前线索',
      revealAll: '揭示整个拼图',
      revealAllSub: '放弃整盘',
      revealConfirmTitle: '揭示拼图',
      revealConfirmP: '这将用正确答案填满整个网格。',
      revealConfirmBtn: '全部揭示',

      resetTitle: '重置进度',
      resetP: '清除该拼图已输入的字母、已揭示的内容和计时。',
      resetBtn: '重置',

      regenTitle: '重新生成',
      regenConfirmP: '重新生成将用相同的单词构建全新布局，并清空当前拼图的作答进度。',
      regenNeed2: '至少需要两个单词才能重新生成。',
      regenDone: '新布局——{p} / {t} 个单词已放入。',
      placedToast: '{p} / {t} 个单词已放入',
      placedSeeBelow: '——详见下方“未放入网格”。',
      genNeedWords: '请至少输入一个单词——长度 3 至 25 个字母。',

      aiBusyTitle: '正在生成',
      aiBusy: '正在用 AI 撰写 {n} 条线索…',
      aiWrote1: 'AI 已为 1 个单词写好线索。',
      aiWroteN: 'AI 已为 {n} 个单词写好线索。',
      aiNoUsable: 'AI 未返回可用线索——保持留空。',
      aiNoClueCfg: '{n} 个单词没有线索。请在“AI 设置”中配置，或按“word | clue”格式输入。',

      shareTitle: '分享这套填字游戏',
      shareP: '整套拼图都编码在这个链接里——任何人打开即可在线作答。无需账号，无需服务器。',
      copy: '复制',
      webShare: '分享…',
      done: '完成',
      copied: '链接已复制。',
      copyFail: '复制失败——请手动选中链接复制。',
      shareText: '{title}——一套给你的填字游戏',

      linkDamaged: '链接已损坏——该布局无法成立。',
      linkUnreadable: '无法读取此拼图链接。',

      printTitle: '打印 / 导出 PDF',
      printSolutionLabel: '追加答案页（第二张纸，含完整答案网格）',
      printBtn: '打印 / 存为 PDF',
      printNote: '纸张：A4 纵向，黑白打印。在浏览器打印对话框中将目标选择为“存储为 PDF”即可导出 PDF 文件。边距选“默认”即可。',
      printTitleL: '打印标题',
      printShowDate: '显示日期',
      printDatePh: '如：2026年8月20日',
      solution: '答案',
      answerKey: '答案页',
      noAbbr: '编号',
      goodLuck: '横向与纵向——祝你好运',

      modeWords: '词表',
      modeArticle: '文章',
      modeAria: '输入方式',
      articleHint: '粘贴一篇英文文章——新闻、随笔或章节。候选词完全在本地浏览器中提取。',
      articlePh: '把文章正文粘贴到这里……',
      extractWords: '提取候选词',
      articleStat: '{n} 个词 · {s} 个句子',
      articleTooShort: '文章太短——请至少粘贴约 20 个词。',
      pickWords: '选择候选词',
      selectedN: '已选 {n} 个',
      candTop: '选前 10',
      candAll: '全选',
      candNone: '清空',
      addWord: '添加',
      addWordPh: '补充一个单词',
      clueStyleL: '线索风格',
      styleAuto: '自动——已配置 AI 时用文章式',
      styleCloze: '原文填空（离线）',
      styleAi: 'AI 文章式',
      styleNote: '文章式线索会引用文中情节与措辞并模仿其语气；填空式把单词从原句中挖空——完全离线可用。',
      needCandidates: '请先从文章提取候选词，并至少选择一个。',
      clozePrefix: '选自原文：',
      aiStyleNoCfg: 'AI 文章式线索需要先配置 AI——请打开 AI 设置，或改用离线的原文填空式。',
      aiArticleBusy: '正在结合文章撰写 {n} 条线索…',
      aiProgress: '已完成 {done} / {total}',
      noClozeN: '有 {n} 个词未在文中找到，未生成填空线索。',

      footerNote: '没有服务器，一切都发生在你的浏览器里',
      donateEntry: '请作者喝杯咖啡',
      donateTitle: '请作者喝杯咖啡',
      donateDesc: '如果这个小工具帮到了你，可以请作者喝杯咖啡。',
      donatePayAria: '支付方式',
      tabAlipay: '支付宝',
      tabWechat: '微信支付',
      scanAlipay: '打开支付宝扫一扫',
      scanWechat: '打开微信扫一扫',
      jumpAlipay: '在支付宝中打开',
      donateFallback: '没有自动打开？请使用扫一扫。',
      qrLoading: '正在生成二维码…',

      settingsTitle: 'AI 设置',
      baseUrl: 'Base URL',
      model: '模型',
      apiKey: 'API 密钥',
      clearBtn: '清空',
      settingsP: '任何 OpenAI 兼容的 chat 接口均可——OpenAI、DeepSeek、火山方舟（https://ark.cn-beijing.volces.com/api/v3）、Ollama、LM Studio。密钥只保存在本浏览器中。',
      settingsNote: '没有线索的单词会以纯列表发送给模型；其他数据不会离开你的浏览器。部分服务商禁止浏览器直连（CORS）——请改用本地模型或支持 CORS 的接口。',
      settingsSaved: 'AI 设置已保存。',
      settingsNeed: '请填写 Base URL 和模型以启用 AI 线索。',

      wordsStat: '{n} 个单词 · {m} 个有线索',
      aiReady: 'AI 线索：{model}',
      aiOff: 'AI 线索：未配置',
      solvedToast: '拼图完成，用时 {t}。干得漂亮。',

      diff_easy: '简单',
      diff_medium: '中等',
      diff_hard: '困难',

      'issue.noLetters': '未找到 A–Z 字母',
      'issue.spaces': '单词内不能包含空格',
      'issue.tooShort': '过短——至少 {min} 个字母',
      'issue.tooLong': '过长——最多 {max} 个字母',
      'issue.duplicate': '与 {word} 重复',

      'reason.noShared': '与已放置的单词没有公共字母',
      'reason.conflicts': '没有合法位置——所有交叉点均与现有布局冲突',
      'reason.tooLongGrid': '超过当前难度的 {max}×{max} 网格上限',
      'reason.default': '生成时未能放入'
    }
  };

  function detect() {
    try {
      var saved = localStorage.getItem(STORE_KEY);
      if (saved === 'en' || saved === 'zh') return saved;
    } catch (e) { /* private mode */ }
    var langs = (navigator.languages && navigator.languages.length)
      ? navigator.languages
      : [navigator.language || 'en'];
    for (var i = 0; i < langs.length; i++) {
      if (!langs[i]) continue;
      if (String(langs[i]).toLowerCase().indexOf('zh') === 0) return 'zh';
    }
    return 'en';
  }

  var lang = detect();
  var listeners = [];

  function t(key, params) {
    var s = DICT[lang][key];
    if (s == null) s = DICT.en[key];
    if (s == null) return key;
    if (params) {
      for (var k in params) s = s.split('{' + k + '}').join(params[k]);
    }
    return s;
  }

  function applyStatic(root) {
    root = root || document;
    root.querySelectorAll('[data-i18n]').forEach(function (elm) {
      var v = t(elm.getAttribute('data-i18n'));
      if (v) elm.textContent = v;
    });
    root.querySelectorAll('[data-i18n-placeholder]').forEach(function (elm) {
      var v = t(elm.getAttribute('data-i18n-placeholder'));
      if (v) elm.setAttribute('placeholder', v);
    });
    root.querySelectorAll('[data-i18n-title]').forEach(function (elm) {
      var v = t(elm.getAttribute('data-i18n-title'));
      if (v) elm.setAttribute('title', v);
    });
    root.querySelectorAll('[data-i18n-aria-label]').forEach(function (elm) {
      var v = t(elm.getAttribute('data-i18n-aria-label'));
      if (v) elm.setAttribute('aria-label', v);
    });
  }

  function htmlLang(l) { return l === 'zh' ? 'zh-CN' : 'en'; }

  function setLang(l) {
    if (!DICT[l] || l === lang) return;
    lang = l;
    try { localStorage.setItem(STORE_KEY, l); } catch (e) { /* ignore */ }
    document.documentElement.lang = htmlLang(l);
    applyStatic();
    listeners.forEach(function (fn) { fn(l); });
  }

  CW.I18N = {
    t: t,
    setLang: setLang,
    getLang: function () { return lang; },
    applyStatic: applyStatic,
    localeTag: function () { return lang === 'zh' ? 'zh-CN' : 'en-GB'; },
    onChange: function (fn) { listeners.push(fn); }
  };
  CW.t = t;
})(typeof window !== 'undefined' ? window : globalThis);
