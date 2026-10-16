const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../fonts/standard-fonts');
const destDir = path.join(__dirname, '../node_modules/pdfkit/js/standard-fonts');

try {
  if (fs.existsSync(srcDir)) {
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    fs.cpSync(srcDir, destDir, { recursive: true });
    console.log('[ensure-fonts] Successfully verified and synced PDFKit standard-fonts.');
  }
} catch (err) {
  console.warn('[ensure-fonts] Notice during font synchronization:', err.message);
}
