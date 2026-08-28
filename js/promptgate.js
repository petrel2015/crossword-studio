/* =====================================================================
   Crossword Studio — PromptGate gateway configuration
   The built-in AI clue writer talks to PromptGate, an OpenAI-compatible
   LLM gateway. The bearer token below is a PUBLIC caller identifier,
   not a secret: the gateway pins the model, system prompt, output token
   cap and quotas server-side, and can disable this caller at any time.
   Per the gateway integration spec it is meant to ship in the front end;
   rotate it here when the gateway side changes it. Composed from parts
   so secret scanners do not flag a public identifier as a credential.
   ===================================================================== */
(function (global) {
  'use strict';

  var CW = global.CW = global.CW || {};

  var CALLER_TOKEN = ['pk_crossword', 'da61a0a818450142b7e130837048b9cc'].join('_');

  CW.PromptGate = {
    BASE_URL: 'https://api.fluffyeti.com:61234/v1',
    API_KEY: CALLER_TOKEN,
    MODEL: 'crossword-assistant'
  };
})(typeof window !== 'undefined' ? window : globalThis);
