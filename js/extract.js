/* =====================================================================
   Crossword Studio — article word extraction
   Pure logic: no DOM, no network. Turns pasted English text into ranked
   crossword candidate words (function words removed, plurals merged,
   proper nouns recognised) and builds cloze clues by blanking a word out
   of its own sentence. Usable in browser and Node.
   ===================================================================== */
(function (global) {
  'use strict';

  var CW = global.CW = global.CW || {};

  /* function words + weak verbs/nouns that would otherwise dominate any
     article; content words (storm, coast, people…) deliberately kept */
  var STOP = new Set(('a,about,above,across,after,again,against,ago,all,almost,along,already,also,although,always,am,among,and,another,any,anyone,anything,are,arent,around,as,at,back,be,because,become,becomes,became,been,before,being,below,between,both,but,by,came,can,cannot,come,comes,could,did,do,does,doing,dont,down,during,each,either,else,enough,even,ever,every,everyone,everything,few,for,from,further,get,gets,give,go,goes,going,gone,got,had,has,have,having,he,her,here,hers,herself,him,himself,his,how,i,if,in,instead,into,is,it,its,itself,just,know,known,least,let,like,little,made,make,makes,many,may,maybe,me,might,much,must,my,myself,near,need,neither,never,next,no,nor,not,now,of,off,often,on,once,one,only,or,other,others,ought,our,ours,ourselves,out,over,own,part,parts,per,perhaps,really,same,saw,say,says,said,see,seen,seem,seems,several,shall,she,should,since,so,some,someone,something,still,such,take,taken,than,that,the,their,theirs,them,themselves,then,there,these,they,thing,things,think,thinks,this,those,though,through,till,to,today,together,too,took,toward,two,under,until,up,upon,us,used,very,was,way,ways,we,well,were,what,when,where,whether,which,while,who,whom,whose,why,will,with,within,without,would,yet,you,your,yours,yourself,yourselves,asked,told,went').split(','));

  var MIN_LEN = 3, MAX_LEN = 12, MAX_CANDIDATES = 60;

  function normalize(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  function splitSentences(norm) {
    var out = [], re = /([^.!?]+[.!?]+(?:["'”’)\]]*)|[^.!?]+$)/g, m;
    while ((m = re.exec(norm)) !== null) {
      var s = m[0].trim();
      if (s) out.push(s);
      if (re.lastIndex === m.index) re.lastIndex++; /* safety */
    }
    return out;
  }

  /* plural ↔ base variants used to merge surface forms into one entry */
  function variantsOf(w) {
    var v = [w];
    if (/IES$/.test(w)) v.push(w.slice(0, -3) + 'Y');
    else if (/ES$/.test(w)) v.push(w.slice(0, -2));
    else if (/S$/.test(w)) v.push(w.slice(0, -1));
    else {
      v.push(w + 'S');
      if (!/S$/.test(w)) v.push(w + 'ES');
      if (/Y$/.test(w)) v.push(w.slice(0, -1) + 'IES');
    }
    var seen = {}, out = [];
    v.forEach(function (x) { if (!seen[x]) { seen[x] = 1; out.push(x); } });
    return out;
  }

  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function containsForm(sentence, forms) {
    for (var i = 0; i < forms.length; i++) {
      if (new RegExp('\\b' + esc(forms[i]) + '\\b', 'i').test(sentence)) return true;
    }
    return false;
  }

  function upperRatio(s) {
    var letters = s.match(/[A-Za-z]/g) || [];
    if (!letters.length) return 0;
    var up = s.match(/[A-Z]/g) || [];
    return up.length / letters.length;
  }

  /* ------------------------------------------------------------------ */
  /* analyze(text) → { wordCount, sentenceCount, candidates }            */
  /* candidates: [{word, occurrences, isProper, inLede, context, score}] */
  /* sorted by score desc, capped at MAX_CANDIDATES, deterministic      */
  /* ------------------------------------------------------------------ */
  function analyze(text) {
    var norm = normalize(text);
    var sentences = splitSentences(norm);
    var entries = {};   // base form (UPPERCASE) -> data
    var order = [];     // first-seen order for tie-breaks
    var wordCount = 0;
    var ledeLimit = norm.length * 0.2;

    sentences.forEach(function (sentence) {
      var shouty = upperRatio(sentence) > 0.75; /* headline — caps ≠ proper nouns */
      var tokens = sentence.match(/[A-Za-z]+/g) || [];
      tokens.forEach(function (tok, i) {
        wordCount++;
        var lower = tok.toLowerCase();
        if (STOP.has(lower)) return;
        if (tok.length < MIN_LEN || tok.length > MAX_LEN) return;
        var upper = tok.toUpperCase();
        var key = null;
        var vs = variantsOf(upper);
        for (var vi = 0; vi < vs.length; vi++) {
          if (entries[vs[vi]]) { key = vs[vi]; break; }
        }
        if (!key) { key = upper; order.push(key); }
        var e = entries[key];
        if (!e) e = entries[key] = { forms: {}, count: 0, proper: false, context: sentence, firstIdx: norm.indexOf(sentence) };
        e.forms[upper] = (e.forms[upper] || 0) + 1;
        e.count++;
        /* proper noun: capitalised mid-sentence, or an ALL-CAPS acronym in normal text */
        if (!shouty && i > 0 && /^[A-Z][a-z]+$/.test(tok)) e.proper = true;
        if (!shouty && /^[A-Z]{3,10}$/.test(tok)) e.proper = true;
      });
    });

    var candidates = order.map(function (key) {
      var e = entries[key];
      /* display the most frequent surface form; ties prefer the shorter */
      var word = key, best = -1;
      Object.keys(e.forms).forEach(function (f) {
        var c = e.forms[f];
        if (c > best || (c === best && f.length < word.length)) { best = c; word = f; }
      });
      var len = word.length;
      var inLede = e.firstIdx >= 0 && e.firstIdx < ledeLimit;
      return {
        word: word,
        occurrences: e.count,
        isProper: e.proper,
        inLede: inLede,
        context: e.context,
        score: (e.count - 1) * 2 + Math.min(len, 9) * 0.5 + (e.proper ? 3 : 0) + (inLede ? 1 : 0)
      };
    });

    candidates.sort(function (a, b) {
      return b.score - a.score || (a.word < b.word ? -1 : a.word > b.word ? 1 : 0);
    });

    return {
      wordCount: wordCount,
      sentenceCount: sentences.length,
      candidates: candidates.slice(0, MAX_CANDIDATES)
    };
  }

  /* ------------------------------------------------------------------ */
  /* clozeFor(text, word) → sentence from the text with every occurrence */
  /* of the word (and its plural forms) blanked, or null. Prefers a      */
  /* medium sentence containing the word exactly once.                   */
  /* ------------------------------------------------------------------ */
  function clozeFor(text, word) {
    var norm = normalize(text);
    var sentences = splitSentences(norm);
    var forms = variantsOf(String(word || '').toUpperCase());
    var best = null;
    sentences.forEach(function (s) {
      var hits = 0;
      forms.forEach(function (f) {
        var m = s.match(new RegExp('\\b' + esc(f) + '\\b', 'gi'));
        if (m) hits += m.length;
      });
      if (!hits) return;
      var len = s.trim().length;
      var rank = hits === 1 ? (len >= 40 && len <= 180 ? 0 : len < 40 ? 1 : 2) : 3;
      if (!best || rank < best.rank) best = { s: s.trim(), rank: rank };
    });
    if (!best) return null;
    var clozed = best.s;
    forms.forEach(function (f) {
      clozed = clozed.replace(new RegExp('\\b' + esc(f) + '\\b', 'gi'), '______');
    });
    /* long sentences: keep a window around the first blank */
    if (clozed.length > 200) {
      var idx = clozed.indexOf('______');
      var start = Math.max(0, idx - 70);
      var end = Math.min(clozed.length, idx + 130);
      clozed = (start > 0 ? '…' : '') + clozed.slice(start, end).trim() + (end < clozed.length ? '…' : '');
    }
    return clozed;
  }

  CW.Extract = {
    analyze: analyze,
    clozeFor: clozeFor,
    MIN_LEN: MIN_LEN,
    MAX_LEN: MAX_LEN,
    STOPWORD_COUNT: STOP.size
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = CW;
})(typeof window !== 'undefined' ? window : globalThis);
