/* =====================================================================
   Crossword Studio — AI clue writer
   Two providers, resolved by AI.getConfig():

   - builtin  the PromptGate gateway (default, works out of the box;
              configuration lives in js/promptgate.js). OpenAI-compatible
              and non-streaming, with hard server-side limits the client
              must respect: ALL message content ≤ 2000 chars per request,
              ≤ 200 output tokens, 20 requests/min/IP, daily circuit
              breaker, system role stripped (instructions go in the user
              message), and every extra body field ignored.
   - custom   any user-configured OpenAI-compatible /chat/completions
              endpoint (Base URL + model + key, kept in localStorage).

   Both providers share one code path; the profile tunes batch size,
   input budget and pacing. Failed requests are never auto-retried —
   the gateway charges quota on every attempt, so failures surface to
   the user via AI.friendlyError() instead.
   ===================================================================== */
(function (global) {
  'use strict';

  var CW = global.CW = global.CW || {};
  var AI = {};

  /* ---------- provider profiles ---------- */

  var BUILTIN_PROFILE = {
    provider: 'builtin',
    batchWords: 6,        /* 200-token output cap ÷ ~30 tokens per clue */
    maxInputChars: 2000,  /* gateway counts every message's content */
    inputMargin: 100,     /* stay under the hard cap */
    minGapMs: 3200,       /* sequential batches stay under 20 req/min */
    strictBody: true      /* gateway only reads `messages`: send nothing else */
  };

  var CUSTOM_PROFILE = {
    provider: 'custom',
    batchWords: 20,
    maxInputChars: 14000,
    inputMargin: 0,
    minGapMs: 0,
    strictBody: false
  };

  var STYLE_BY_DIFFICULTY = {
    easy: 'plain, friendly dictionary-style definitions',
    medium: 'classic newspaper clues with light wordplay',
    hard: 'clever clues with misdirection and puns'
  };

  /* shape: {provider, baseUrl, model, apiKey} — legacy saves without a
     provider but with a baseUrl are treated as custom so existing setups
     keep working; everything else falls back to the builtin gateway. */
  AI.resolveConfig = function (shape) {
    shape = shape || {};
    if (shape.provider === 'custom' || (!shape.provider && shape.baseUrl)) {
      var p = Object.assign({}, CUSTOM_PROFILE);
      p.baseUrl = shape.baseUrl || '';
      p.model = shape.model || '';
      p.apiKey = shape.apiKey || '';
      return p;
    }
    var pg = CW.PromptGate || {};
    var b = Object.assign({}, BUILTIN_PROFILE);
    b.baseUrl = pg.BASE_URL || '';
    b.apiKey = pg.API_KEY || '';
    b.model = pg.MODEL || 'crossword-assistant';
    return b;
  };

  AI.getConfig = function () { return AI.resolveConfig(CW.Store.loadAiConfig()); };
  AI.saveConfig = function (cfg) { CW.Store.saveAiConfig(cfg); };
  AI.isConfigured = function () {
    var c = AI.getConfig();
    return c.provider === 'builtin' ? true : !!(c.baseUrl && c.model);
  };

  /* words: [{answer, clue}] — fills only entries with empty clues.
     Resolves to a map { ANSWER: clue }. Partial success is kept; only a
     total failure rejects (with a normalized error for friendlyError). */
  AI.fillClues = function (words, difficulty) {
    var cfg = AI.getConfig();
    var missing = (words || []).filter(function (w) { return !w.clue || !w.clue.trim(); })
      .map(function (w) { return w.answer; });
    if (!missing.length) return Promise.resolve({});
    var instruction = vocabInstruction(difficulty);
    return runBatches(cfg, missing, function (batch) {
      return chat(cfg, instruction + '\nWORDS:\n' + batch.join('\n'));
    }).then(function (merged) {
      return pickRequested(merged, missing);
    });
  };

  /* Article-style clues: each clue is anchored in how the word appears in
     the article and mimics the article's tone. The excerpt is windowed to
     whatever input budget the provider leaves after the instruction and
     word list. onProgress(done, total) optional. */
  AI.cluesFromArticle = function (article, words, difficulty, onProgress) {
    var cfg = AI.getConfig();
    var list = (words || []).filter(Boolean);
    if (!list.length) return Promise.resolve({});
    var instruction = articleInstruction(difficulty);
    return runBatches(cfg, list, function (batch) {
      var wordsBlock = '\n\nWORDS:\n' + batch.join('\n');
      var budget = cfg.maxInputChars - cfg.inputMargin - instruction.length - wordsBlock.length;
      var excerpt = windowArticle(article, Math.max(200, budget));
      return chat(cfg, instruction + '\n\nARTICLE:\n' + excerpt + wordsBlock);
    }, onProgress).then(function (merged) {
      return pickRequested(merged, list);
    });
  };

  /* Connectivity check for the settings dialog — one real request
     (the gateway counts it against quota, hence user-triggered only).
     Shorter timeout than a clue request: a healthy gateway answers a
     trivial prompt well within 20 seconds. */
  AI.ping = function (cfg) {
    return request(cfg || AI.getConfig(), 'Reply with the single word "pong".', 20000)
      .then(function () { return true; });
  };

  /* Localized, user-facing message for a normalized error. */
  AI.friendlyError = function (err) {
    var t = CW.I18N ? CW.I18N.t : function (key) { return key; };
    err = err || {};
    switch (err.kind) {
      case 'unavailable': return t('err.aiUnavailable');
      case 'unreachable': return t('err.aiUnreachable');
      case 'daily': return t('err.aiDailyQuota');
      case 'rate': return t('err.aiRateLimited');
      case 'upstream': return t('err.aiUpstream');
      case 'badrequest': return t('err.aiBadRequest', { msg: err.detail || '—' });
      case 'badresponse': return t('err.aiBadResponse');
      case 'timeout': return t('err.aiTimeout');
      default: return err.message || t('err.aiHttp', { status: err.status || 0 });
    }
  };

  /* ---------- batching ---------- */

  function runBatches(cfg, list, makeRequest, onProgress) {
    var batches = [];
    for (var i = 0; i < list.length; i += cfg.batchWords) batches.push(list.slice(i, i + cfg.batchWords));
    var merged = {}, firstError = null, done = 0;
    var chain = Promise.resolve();
    batches.forEach(function (batch) {
      chain = chain.then(function () {
        return makeRequest(batch).then(function (map) {
          Object.keys(map).forEach(function (k) { merged[k] = map[k]; });
          return null;
        }).catch(function (err) {
          /* a failed batch must not kill the others */
          if (!firstError) firstError = err;
          return null;
        }).then(function () {
          done += batch.length;
          if (onProgress) onProgress(Math.min(done, list.length), list.length);
        });
      });
    });
    return chain.then(function () {
      if (!Object.keys(merged).length && firstError) throw firstError;
      return merged;
    });
  }

  /* ---------- prompts ---------- */

  function vocabInstruction(difficulty) {
    return 'Write one crossword clue for each word listed after "WORDS:". Style: ' +
      styleFor(difficulty) + '. Rules: one line per clue, at most 12 words; never include ' +
      'the answer word itself (or a direct stem of it) in its clue; capitalise only the ' +
      'first word and proper nouns. Reply with JSON only, exactly ' +
      '{"clues":{"WORD":"clue", ...}} covering every listed word.';
  }

  function articleInstruction(difficulty) {
    return 'Write one crossword clue for each word listed after "WORDS:", taken from the ' +
      'article below. Anchor every clue in the article: reference the scene, the role the ' +
      'word plays, or the author\'s phrasing, and imitate the article\'s tone. Style: ' +
      styleFor(difficulty) + '. Rules: one line per clue, at most 16 words; never include ' +
      'the answer word itself (or a direct stem of it) in its clue; capitalise only the ' +
      'first word and proper nouns. Reply with JSON only, exactly ' +
      '{"clues":{"WORD":"clue", ...}} covering every listed word.';
  }

  function styleFor(difficulty) {
    return STYLE_BY_DIFFICULTY[difficulty] || STYLE_BY_DIFFICULTY.medium;
  }

  function windowArticle(article, budget) {
    var text = String(article || '').trim();
    if (text.length <= budget) return text;
    if (budget < 400) return text.slice(0, budget);
    var marker = '\n[…]\n';
    var keep = budget - marker.length;
    var head = Math.floor(keep * 0.6);
    var tail = keep - head;
    return text.slice(0, head) + marker + text.slice(text.length - tail);
  }

  function pickRequested(map, requested) {
    var out = {};
    requested.forEach(function (w) {
      var clue = map[w] || map[w.toLowerCase()] || map[w.charAt(0) + w.slice(1).toLowerCase()];
      if (typeof clue === 'string' && clue.trim()) out[w] = clue.trim();
    });
    return out;
  }

  /* ---------- transport ---------- */

  var lastCallAt = 0; /* keeps sequential builtin batches under the IP rate limit */

  function request(cfg, userContent, timeoutMs) {
    if (!cfg.baseUrl) {
      return Promise.reject(errWith('unconfigured', 'AI is not configured — add an endpoint and model in AI Settings'));
    }
    /* the gateway's upstream may take up to 120 s, so default the abort at
       125 s; callers with trivial prompts (ping) pass a shorter budget */
    timeoutMs = timeoutMs || 125000;
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, timeoutMs) : null;
    var settle = function (fn) {
      return function (v) { if (timer) clearTimeout(timer); return fn(v); };
    };
    var wait = cfg.minGapMs ? Math.max(0, lastCallAt + cfg.minGapMs - Date.now()) : 0;
    lastCallAt = Date.now() + wait; /* reserve the slot before waiting */
    var body = { model: cfg.model, messages: [{ role: 'user', content: userContent }] };
    if (!cfg.strictBody) {
      body.temperature = 0.8;
      body.response_format = { type: 'json_object' };
    }
    var url = cfg.baseUrl.replace(/\/+$/, '') + '/chat/completions';
    var p = delay(wait).then(function () {
      return fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + (cfg.apiKey || '')
        },
        body: JSON.stringify(body),
        signal: ctrl ? ctrl.signal : undefined
      });
    }).then(function (res) {
      if (!res.ok) {
        return res.text().catch(function () { return ''; }).then(function (t) {
          throw httpError(res, t);
        });
      }
      return res.json();
    }).then(function (data) {
      var text = data && data.choices && data.choices[0] && data.choices[0].message &&
        data.choices[0].message.content;
      if (!text) throw errWith('badresponse', 'AI returned an empty response');
      return text;
    }).catch(function (err) {
      /* fetch() network/CORS failure or our own timeout abort (name check:
         TypeErrors and DOMExceptions can arrive from another realm, where
         instanceof would miss them) */
      if (err && err.name === 'TypeError') {
        throw errWith(cfg.provider === 'builtin' ? 'unavailable' : 'unreachable',
          'Could not reach the AI endpoint');
      }
      if (err && err.name === 'AbortError') {
        throw errWith('timeout', 'AI request timed out');
      }
      throw err;
    });
    return p.then(settle(function (v) { return v; }), settle(function (e) { throw e; }));
  }

  function chat(cfg, userContent) {
    return request(cfg, userContent).then(function (text) {
      var parsed;
      try { parsed = extractJSON(text); } catch (e) {
        throw errWith('badresponse', 'AI returned malformed JSON');
      }
      var map = parsed && parsed.clues && typeof parsed.clues === 'object' ? parsed.clues : {};
      var normalized = {};
      Object.keys(map).forEach(function (k) { normalized[String(k).toUpperCase()] = map[k]; });
      return normalized;
    });
  }

  /* The gateway does not honour response_format, so tolerate prose and
     markdown fences around the JSON payload. */
  function extractJSON(text) {
    var s = String(text || '').trim();
    var fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) s = fenced[1].trim();
    var start = s.indexOf('{');
    var end = s.lastIndexOf('}');
    if (start > -1 && end > start) s = s.slice(start, end + 1);
    return JSON.parse(s);
  }

  function httpError(res, text) {
    var msg = '', code = '';
    try {
      var j = JSON.parse(text);
      if (j && j.error) { msg = j.error.message || ''; code = j.error.code || ''; }
    } catch (e) { /* not json */ }
    var kind = 'http';
    if (res.status === 401 || res.status === 403) kind = 'unavailable';
    else if (code === 'daily_requests_exceeded' || code === 'daily_tokens_exceeded') kind = 'daily';
    else if (res.status === 429) kind = 'rate';
    else if (res.status === 502) kind = 'upstream';
    else if (res.status === 400 || res.status === 413) kind = 'badrequest';
    var e = errWith(kind, msg || ('HTTP ' + res.status));
    e.status = res.status;
    e.code = code;
    return e;
  }

  function errWith(kind, detail) {
    var e = new Error(detail || kind);
    e.kind = kind;
    e.detail = detail || '';
    return e;
  }

  function delay(ms) {
    return ms > 0 ? new Promise(function (r) { setTimeout(r, ms); }) : Promise.resolve();
  }

  CW.AI = AI;
})(typeof window !== 'undefined' ? window : globalThis);
