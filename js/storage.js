/* =====================================================================
   Crossword Studio — persistence (localStorage)
   Progress per puzzle, builder draft, AI settings, last puzzle.
   ===================================================================== */
(function (global) {
  'use strict';

  var CW = global.CW = global.CW || {};
  var Store = {};

  function get(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) { return fallback; }
  }
  function set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* quota / private mode */ }
  }
  function remove(key) {
    try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
  }

  /* --- solving progress, keyed by puzzle id --- */
  Store.progressKey = function (id) { return 'cw-progress:' + id; };
  Store.loadProgress = function (id) { return get(Store.progressKey(id), null); };
  Store.saveProgress = function (id, progress) { set(Store.progressKey(id), progress); };
  Store.clearProgress = function (id) { remove(Store.progressKey(id)); };

  /* --- builder draft --- */
  Store.loadDraft = function () { return get('cw-draft', null); };
  Store.saveDraft = function (draft) { set('cw-draft', draft); };

  /* --- last generated puzzle (refresh-friendly) --- */
  Store.saveCurrentPuzzle = function (payload) { set('cw-current', payload); };
  Store.loadCurrentPuzzle = function () { return get('cw-current', null); };

  /* --- AI settings --- */
  Store.loadAiConfig = function () { return get('cw-ai', null); };
  Store.saveAiConfig = function (cfg) { set('cw-ai', cfg); };

  CW.Store = Store;
})(typeof window !== 'undefined' ? window : globalThis);
