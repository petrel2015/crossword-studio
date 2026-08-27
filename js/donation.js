/* =====================================================================
   Crossword Studio — donation ("buy me a coffee")
   Shared interaction spec for every tool site in this family:
     footer entry ☕ → dialog → Alipay | WeChat Pay tabs → QR.
   The QR is generated client-side on first open (no static images, no
   third-party QR API); the vendor bundle (vendor/qrcode.min.js) is
   lazy-loaded the moment the dialog opens. No analytics, nothing
   uploaded — this component only shows an entry, may attempt one
   Alipay URL jump on mobile, and renders a QR fallback.
   ===================================================================== */
(function (global) {
  'use strict';

  var CW = global.CW = global.CW || {};

  /*集中配置 —— 所有工具站共用同一组支付内容*/
  var CONFIG = {
    alipay: {
      nameKey: 'tabAlipay',
      qrContent: 'https://qr.alipay.com/fkx16432isyyhmx9ttwpi79'
    },
    wechat: {
      nameKey: 'tabWechat',
      qrContent: 'wxp://f2f1fJpOcJc7F-MSeLMxALhc6tWu-oohtxueHRbCe98bMy2AmDunimuOJFv-8bjobLBM'
    }
  };

  var ORDER = ['alipay', 'wechat'];
  var VENDOR_SRC = 'vendor/qrcode.min.js';
  var QR_CSS_SIZE = 220;           /* spec: ~220px */
  var QUIET_MODULES = 4;           /* spec: ≥4 modules quiet zone */

  function t(key) { return CW.t ? CW.t(key) : key; }
  function el(tag, cls, text) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (text != null) d.textContent = text;
    return d;
  }
  function isMobile() {
    return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  /* ---------- lazy QR library ---------- */
  var libPromise = null;
  function loadLib() {
    if (global.QRCodeLib && typeof global.QRCodeLib.create === 'function') {
      return Promise.resolve(global.QRCodeLib);
    }
    if (!libPromise) {
      libPromise = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = VENDOR_SRC;
        s.async = true;
        s.onload = function () { resolve(global.QRCodeLib); };
        s.onerror = function () { reject(new Error('qr-lib')); };
        document.head.appendChild(s);
      });
    }
    return libPromise;
  }

  /* paint modules onto a canvas; light card + dark modules regardless
     of theme — scanability beats visual unity. Safe when canvas is
     unavailable (e.g. test DOM): structure still renders. */
  function drawQR(canvas, text) {
    var lib = global.QRCodeLib;
    if (!lib || !lib.create) return;
    var qr = lib.create(text, { errorCorrectionLevel: 'M' });
    var size = qr.modules.size;
    var ratio = Math.max(1, Math.round((global.devicePixelRatio || 1)));
    var scale = Math.max(4, Math.floor(QR_CSS_SIZE * ratio / size));
    var px = (size + QUIET_MODULES * 2) * scale;
    var ctx = null;
    try { ctx = canvas.getContext('2d'); } catch (e) { ctx = null; }
    if (!ctx) return;
    canvas.width = px;
    canvas.height = px;
    canvas.style.width = (px / ratio) + 'px';
    canvas.style.height = (px / ratio) + 'px';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, px, px);
    ctx.fillStyle = '#111111';
    for (var r = 0; r < size; r++) {
      for (var c = 0; c < size; c++) {
        if (qr.modules.data[r * size + c]) {
          ctx.fillRect((c + QUIET_MODULES) * scale, (r + QUIET_MODULES) * scale, scale, scale);
        }
      }
    }
  }

  /* ---------- state ---------- */
  var ui = null;            // {openModal, closeModal} injected by app.js
  var channel = 'alipay';   // default per spec
  var cache = {};           // painted canvases per channel
  var jumpAttemptedAt = 0;  // mobile alipay navigation marker
  var dialogOpen = false;

  function tabEl(ch) { return document.getElementById('donateTab-' + ch); }
  function qrHost() { return document.getElementById('donateQrHost'); }
  function captionEl() { return document.getElementById('donateCaption'); }
  function fallbackEl() { return document.getElementById('donateFallback'); }
  function jumpBtnEl() { return document.getElementById('donateJump'); }

  function renderCanvas(ch) {
    var host = qrHost();
    if (!host || !dialogOpen) return;
    var cv = cache[ch];
    if (!cv) {
      cv = el('canvas', 'qr-canvas');
      cv.setAttribute('role', 'img');
      cv.setAttribute('aria-label', t(ch === 'alipay' ? 'scanAlipay' : 'scanWechat'));
      drawQR(cv, CONFIG[ch].qrContent);
      cache[ch] = cv;
    }
    host.innerHTML = '';
    host.appendChild(cv);
    captionEl().textContent = t(ch === 'alipay' ? 'scanAlipay' : 'scanWechat');
  }

  function renderLibPending() {
    captionEl().textContent = t('qrLoading');
  }

  function selectChannel(ch, userInitiated) {
    channel = ch;
    ORDER.forEach(function (c) {
      var b = tabEl(c);
      if (!b) return;
      var on = c === ch;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    /* wechat payload cannot be deep-linked reliably — always straight to QR.
       alipay keeps its official URL jump only as a mobile affordance. */
    var isAlipay = ch === 'alipay';
    fallbackEl().hidden = true;
    jumpBtnEl().hidden = !(isMobile() && isAlipay);
    if (isAlipay && isMobile()) {
      renderLibPending();
      loadLib().then(function () { renderCanvas(ch); }).catch(function () {
        captionEl().textContent = t('qrLoading');
      });
    } else {
      renderLibPending();
      loadLib().then(function () { renderCanvas(ch); }).catch(function () { /* leave pending note */ });
    }

    /* user taps 支付宝 on mobile → prefer jumping straight into payment;
       visibility handlers below show the QR fallback when returning */
    if (userInitiated && isAlipay && isMobile()) tryAlipayJump();
  }

  function tryAlipayJump() {
    jumpAttemptedAt = Date.now();
    /* the raw QR content IS a normal https URL — let it open; the page and
       browser handle the app hand-off. No invented schemes. */
    location.href = CONFIG.alipay.qrContent;
  }

  function showReturnFallback() {
    if (!dialogOpen || Date.now() - jumpAttemptedAt < 800) return;
    jumpAttemptedAt = 0;
    fallbackEl().hidden = false;
    selectChannel('alipay', false); /* re-render to be safe; no new jump */
  }

  function bindLifecycle() {
    ['visibilitychange'].forEach(function (evName) {
      document.addEventListener(evName, function () {
        if (evName === 'visibilitychange' && document.visibilityState === 'visible') showReturnFallback();
      });
    });
    window.addEventListener('pageshow', function (ev) {
      /* bfcache restore after the external app took over */
      if (ev.persisted) showReturnFallback();
    });
  }

  function buildBody() {
    var box = el('div', 'donate-modal');

    box.appendChild(el('p', 'donate-desc', t('donateDesc')));

    var tabs = el('div', 'lang-switch donate-tabs');
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', t('donatePayAria'));
    ORDER.forEach(function (ch) {
      var b = el('button', 'lang-btn donate-tab' + (ch === channel ? ' active' : ''), t(CONFIG[ch].nameKey));
      b.type = 'button';
      b.id = 'donateTab-' + ch;
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', ch === channel ? 'true' : 'false');
      b.addEventListener('click', function () { selectChannel(ch, true); });
      tabs.appendChild(b);
    });
    box.appendChild(tabs);

    var fb = el('p', 'donate-note', t('donateFallback'));
    fb.id = 'donateFallback';
    fb.hidden = true;
    box.appendChild(fb);

    var host = el('div', 'qr-card');
    host.id = 'donateQrHost';
    box.appendChild(host);

    var cap = el('p', 'donate-caption');
    cap.id = 'donateCaption';
    box.appendChild(cap);

    var jump = el('button', 'btn small donate-jump', t('jumpAlipay'));
    jump.type = 'button';
    jump.id = 'donateJump';
    jump.hidden = true;
    jump.addEventListener('click', tryAlipayJump);
    box.appendChild(jump);

    return box;
  }

  /* ---------- public ---------- */

  CW.Donation = {
    /* app.js injects the modal controller once at boot */
    init: function (hooks) {
      ui = hooks;
      bindLifecycle();
    },
    open: function () {
      if (!ui) return;
      channel = 'alipay';
      cache = {};
      jumpAttemptedAt = 0;
      dialogOpen = true;
      ui.openModal(t('donateTitle') + ' \u2615', buildBody());
      /* generate lazily, only now, exactly per spec */
      renderLibPending();
      loadLib().then(function () { renderCanvas(channel); }).catch(function () { /* keep note */ });
    },
    close: function () {
      dialogOpen = false;
      jumpAttemptedAt = 0;
      if (ui) ui.closeModal();
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
