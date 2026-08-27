/* =====================================================================
   Generates the donation QR images into img/donate/ (plain black on
   white, matching the app's print aesthetic).
   Payment links come from the author's own receive-money codes —
   the same ones used in petrel2015/chess-reversal-lab.
   Run: node scripts/generate-donate-qr.js   (needs `npm install`)
   ===================================================================== */
'use strict';

const path = require('path');
const QRCode = require('qrcode');

const codes = [
  { name: 'alipay-qr', url: 'https://qr.alipay.com/fkx16432isyyhmx9ttwpi79' },
  { name: 'wechat-qr', url: 'wxp://f2f1fJpOcJc7F-MSeLMxALhc6tWu-oohtxueHRbCe98bMy2AmDunimuOJFv-8bjobLBM' }
];

(async () => {
  const fs = require('fs');
  const outDir = path.join(__dirname, '..', 'img', 'donate');
  fs.mkdirSync(outDir, { recursive: true });
  for (const { name, url } of codes) {
    await QRCode.toFile(path.join(outDir, name + '.png'), url, {
      width: 440,
      margin: 2, /* quiet zone, modules */
      errorCorrectionLevel: 'H',
      color: { dark: '#111111', light: '#ffffff' }
    });
    console.log('Generated img/donate/' + name + '.png');
  }
})().catch(err => { console.error(err); process.exit(1); });
