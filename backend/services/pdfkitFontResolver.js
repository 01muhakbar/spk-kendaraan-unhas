/**
 * PDFKit Font Resolver for Vercel Serverless / AWS Lambda
 * Memastikan standard fonts (Helvetica, Times, Courier, etc.) selalu dapat dimuat
 * meskipun bundler serverless (Vercel NFT) tidak meng-bundle folder internal node_modules/pdfkit.
 */

const Module = require('module');
const path = require('path');
const fs = require('fs');

const localFontsDir = path.join(__dirname, '../fonts/standard-fonts');

// Hook Module._resolveFilename untuk menangani kegagalan require standard font PDFKit
const origResolveFilename = Module._resolveFilename;

Module._resolveFilename = function (request, parent, isMain, options) {
  try {
    return origResolveFilename.call(this, request, parent, isMain, options);
  } catch (err) {
    if (
      err.code === 'MODULE_NOT_FOUND' &&
      (request.includes('standard-fonts') || request.startsWith('#standard-fonts/'))
    ) {
      const fontBase = request.replace('#standard-fonts/', '').split(/[/\\]/).pop();
      const fontFile = fontBase.endsWith('.cjs') ? fontBase : `${fontBase}.cjs`;
      const localPath = path.join(localFontsDir, fontFile);
      if (fs.existsSync(localPath)) {
        return localPath;
      }
    }
    throw err;
  }
};

// Static require hints untuk Vercel NFT (Node File Trace) agar font otomatis terikutsertakan
try {
  require('pdfkit/standard-fonts/Helvetica');
  require('pdfkit/standard-fonts/HelveticaBold');
  require('pdfkit/standard-fonts/HelveticaOblique');
  require('pdfkit/standard-fonts/HelveticaBoldOblique');
  require('pdfkit/standard-fonts/TimesRoman');
  require('pdfkit/standard-fonts/TimesBold');
  require('pdfkit/standard-fonts/TimesItalic');
  require('pdfkit/standard-fonts/TimesBoldItalic');
  require('pdfkit/standard-fonts/Courier');
  require('pdfkit/standard-fonts/CourierBold');
  require('pdfkit/standard-fonts/CourierOblique');
  require('pdfkit/standard-fonts/CourierBoldOblique');
  require('pdfkit/standard-fonts/Symbol');
  require('pdfkit/standard-fonts/ZapfDingbats');
} catch (_) {
  // Abaikan jika dieksekusi di environment tanpa export subpath
}

module.exports = { localFontsDir };
