/* =====================================================================
   Crossword Studio — optional AI clue writer
   Works with any OpenAI-compatible /chat/completions endpoint
   (OpenAI, DeepSeek, Volcengine Ark, Ollama, LM Studio, …). The key is
   entered by the user in Settings and kept in localStorage only.
   ===================================================================== */
(function (global) {
  'use strict';

  var CW = global.CW = global.CW || {};
  var AI = {};

  var STYLE_BY_DIFFICULTY = {
    easy: 'plain, friendly dictionary-style definitions a beginner can solve',
    medium: 'classic broadsheet newspaper clues — concise definitions with a light touch of wordplay',
    hard: 'clever clues with misdirection and puns, in the style of a cryptic-leaning Sunday puzzle, but always fair'
  };

  AI.getConfig = function () {
    return CW.Store.loadAiConfig() || { baseUrl: '', apiKey: '', model: '' };
  };
  AI.saveConfig = function (cfg) { CW.Store.saveAiConfig(cfg); };
  AI.isConfigured = function () {
    var c = AI.getConfig();
    return !!(c.baseUrl && c.model);
  };

  /* words: [{answer, clue}] — fills only entries with empty clues.
     Resolves to a map { ANSWER: clue }. Never rejects for missing
     words; rejects with an Error on transport/auth failure. */
  AI.fillClues = function (words, difficulty) {
    var missing = words.filter(function (w) { return !w.clue || !w.clue.trim(); })
      .map(function (w) { return w.answer; });
    if (!missing.length) return Promise.resolve({});

    var style = STYLE_BY_DIFFICULTY[difficulty] || STYLE_BY_DIFFICULTY.medium;
    var system =
      'You are a professional crossword editor for a serious English-language newspaper. ' +
      'Write one clue for each given word. Style: ' + style + '. ' +
      'Rules: each clue is a single line, at most 12 words; never include the answer word itself ' +
      '(or a direct stem of it) in its clue; capitalise only the first word and proper nouns. ' +
      'Reply with STRICT JSON only, shaped exactly {"clues":{"WORD":"clue", ...}} covering every given word.';
    return chatJSON(system, missing.join('\n')).then(function (map) {
      return pickRequested(map, missing);
    });
  };

  /* Article-style clues: each clue is anchored in how the word appears in
     the article and mimics the article's tone. article: full pasted text;
     words: array of ANSWER strings; onProgress(done, total) optional. */
  AI.cluesFromArticle = function (article, words, difficulty, onProgress) {
    var cfg = AI.getConfig();
    if (!cfg.baseUrl || !cfg.model) {
      return Promise.reject(new Error('AI is not configured — add an endpoint and model in AI Settings'));
    }
    var list = (words || []).filter(Boolean);
    if (!list.length) return Promise.resolve({});

    var style = STYLE_BY_DIFFICULTY[difficulty] || STYLE_BY_DIFFICULTY.medium;
    var excerpt = truncateArticle(article);
    var system =
      'You are a professional crossword editor for a serious English-language newspaper. ' +
      'You will receive an article and a list of words taken from it. For each word write exactly one ' +
      'crossword clue anchored in the article: reference the scene, the role the word plays in the story, ' +
      'or the author\'s own phrasing, and imitate the article\'s tone and narrative style. Clue style: ' + style + '. ' +
      'Rules: each clue is a single line, at most 16 words; never include the answer word itself ' +
      '(or a direct stem of it) in its clue; capitalise only the first word and proper nouns. ' +
      'Reply with STRICT JSON only, shaped exactly {"clues":{"WORD":"clue", ...}} covering every given word.';

    var BATCH = 20;
    var batches = [];
    for (var i = 0; i < list.length; i += BATCH) batches.push(list.slice(i, i + BATCH));

    var merged = {}, done = 0;
    var chain = Promise.resolve();
    batches.forEach(function (batch) {
      chain = chain.then(function () {
        var user = 'ARTICLE:\n' + excerpt + '\n\nWORDS:\n' + batch.join('\n');
        return chatJSON(system, user).then(function (map) {
          Object.keys(map).forEach(function (k) { merged[k] = map[k]; });
          done += batch.length;
          if (onProgress) onProgress(Math.min(done, list.length), list.length);
          return null;
        }).catch(function (err) {
          /* a failed batch must not kill the others */
          done += batch.length;
          if (onProgress) onProgress(Math.min(done, list.length), list.length);
          if (!merged.__errors) merged.__errors = [];
          merged.__errors.push(err.message);
          return null;
        });
      });
    });
    return chain.then(function () {
      var errors = merged.__errors || [];
      delete merged.__errors;
      if (!Object.keys(merged).length && errors.length) {
        throw new Error('AI request failed — ' + errors[0]);
      }
      return pickRequested(merged, list);
    });
  };

  /* ---------- internals ---------- */

  function truncateArticle(article) {
    var text = String(article || '').trim();
    var LIMIT = 12000;
    if (text.length <= LIMIT) return text;
    return text.slice(0, 9000) + '\n[…]\n' + text.slice(-3000);
  }

  function pickRequested(map, requested) {
    var out = {};
    requested.forEach(function (w) {
      var clue = map[w] || map[w.toLowerCase()] || map[w.charAt(0) + w.slice(1).toLowerCase()];
      if (typeof clue === 'string' && clue.trim()) out[w] = clue.trim();
    });
    return out;
  }

  function chatJSON(system, user) {
    var cfg = AI.getConfig();
    var url = cfg.baseUrl.replace(/\/+$/, '') + '/chat/completions';
    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (cfg.apiKey || '')
      },
      body: JSON.stringify({
        model: cfg.model,
        temperature: 0.8,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        response_format: { type: 'json_object' }
      })
    }).then(function (res) {
      if (!res.ok) {
        return res.text().catch(function () { return ''; }).then(function (t) {
          var msg = 'AI request failed (HTTP ' + res.status + ')';
          try { var j = JSON.parse(t); if (j.error && j.error.message) msg += ' — ' + j.error.message; } catch (e) { /* not json */ }
          throw new Error(msg);
        });
      }
      return res.json();
    }).then(function (data) {
      var text = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      if (!text) throw new Error('AI returned an empty response');
      var parsed;
      try { parsed = JSON.parse(text); } catch (e) { throw new Error('AI returned malformed JSON'); }
      var map = parsed && parsed.clues && typeof parsed.clues === 'object' ? parsed.clues : {};
      var normalized = {};
      Object.keys(map).forEach(function (k) { normalized[String(k).toUpperCase()] = map[k]; });
      return normalized;
    }).catch(function (err) {
      if (err instanceof TypeError) {
        throw new Error('Could not reach the AI endpoint — check the Base URL, and note some providers block browser (CORS) requests');
      }
      throw err;
    });
  }

  CW.AI = AI;
})(typeof window !== 'undefined' ? window : globalThis);
