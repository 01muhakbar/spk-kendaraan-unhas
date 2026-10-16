// Ensure PDFKit standard fonts resolver is loaded first for Vercel Serverless
require('./pdfkitFontResolver');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Format tanggal ke Bahasa Indonesia (contoh: 16 Oktober 2026)
const formatTanggalIndo = (date = new Date()) => {
  const bulan = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const d = new Date(date);
  return `${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}`;
};

// Ambil logo sebagai Buffer (Cloudinary / Base64 / File Lokal)
const getLogoBuffer = async (logoUrl) => {
  if (logoUrl && typeof logoUrl === 'string') {
    // 1. Dukungan format Base64 (data:image/...;base64,xxxx)
    if (logoUrl.startsWith('data:image')) {
      try {
        const base64Data = logoUrl.split(',')[1] || logoUrl;
        return Buffer.from(base64Data, 'base64');
      } catch (err) {
        console.warn('Gagal decode base64 logo:', err.message);
      }
    }
    // 2. Dukungan URL HTTP / HTTPS
    if (logoUrl.startsWith('http')) {
      try {
        const response = await fetch(logoUrl, { signal: AbortSignal.timeout(3500) });
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          return Buffer.from(arrayBuffer);
        }
      } catch (err) {
        console.warn('Gagal mengunduh logo dari URL, menggunakan logo lokal fallback:', err.message);
      }
    }
  }

  // 3. Fallback ke logo lokal yang ada di public/logo-unhas.jpg
  const localLogoPath = path.join(__dirname, '../public/logo-unhas.jpg');
  if (fs.existsSync(localLogoPath)) {
    return fs.readFileSync(localLogoPath);
  }

  return null;
};

/**
 * Menghasilkan Buffer PDF Surat Rekomendasi & Kuasa SAMSAT
 * Sesuai Standar Tata Naskah Dinas & Administrasi Universitas Hasanuddin
 * @param {Object} data { vehicle, pemberiKuasa, penerimaKuasa, nomorSurat, kopSettings, logoUrl }
 * @returns {Promise<Buffer>}
 */
const generateSamsatLetterPDF = async (data) => {
  const {
    vehicle = {},
    pemberiKuasa = {},
    penerimaKuasa = null,
    nomorSurat = '65969/UN4.1.6.1.3/PL.10.04/2026',
    kopSettings = {},
    logoUrl = null
  } = data;

  const logoBuffer = await getLogoBuffer(logoUrl);

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 30, bottom: 30, left: 40, right: 40 },
        info: {
          Title: `Surat Rekomendasi dan Kuasa SAMSAT - ${vehicle.nomor_polisi || 'UNHAS'}`,
          Author: 'Universitas Hasanuddin',
          Subject: 'Pengurusan Pajak & Pergantian STNK SAMSAT'
        }
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const leftMargin = 40;
      const rightMargin = 555;
      const pageWidth = rightMargin - leftMargin; // 515 pt

      // ─── TAHAP 3: RESTRUKTURISASI KOP SURAT STANDAR UNHAS (3 BLOK SEJAJAR: 15% - 55% - 30%) ───
      const headerTop = 30;
      const logoWidth = 65; // ~15%

      // Blok Kiri (15%): Logo UNHAS
      if (logoBuffer) {
        doc.image(logoBuffer, leftMargin, headerTop, { width: logoWidth, fit: [logoWidth, 68] });
      }

      // Blok Tengah (55%): Teks Institusi
      const centerLeft = leftMargin + 75;
      const centerWidth = 280;
      doc.font('Times-Bold').fontSize(10).text(
        kopSettings.KOP_KIRI_1 || 'KEMENTERIAN PENDIDIKAN TINGGI, SAINS,',
        centerLeft, headerTop + 4, { width: centerWidth, lineGap: 1.5 }
      );
      doc.text(
        kopSettings.KOP_KIRI_2 || 'DAN TEKNOLOGI',
        centerLeft, doc.y, { width: centerWidth, lineGap: 1.5 }
      );
      doc.fontSize(14).text(
        kopSettings.KOP_KIRI_3 || 'UNIVERSITAS HASANUDDIN',
        centerLeft, doc.y + 2, { width: centerWidth, lineGap: 1.5 }
      );

      // Blok Kanan (30%): Alamat & Kontak (Rata Kanan)
      const rightLeft = 370;
      const rightWidth = rightMargin - rightLeft;
      doc.font('Times-Roman').fontSize(8);
      const rightLines = [
        kopSettings.KOP_KANAN_1 || 'Jalan Perintis Kemerdekaan Km. 10',
        kopSettings.KOP_KANAN_2 || 'Tamalanrea, Makassar 90245',
        kopSettings.KOP_KANAN_3 || 'Telepon (0411) 586200',
        kopSettings.KOP_KANAN_4 || 'e-mail: office@unhas.ac.id',
        kopSettings.KOP_KANAN_5 || 'Laman: www.unhas.ac.id'
      ].filter(Boolean);

      let currentRightY = headerTop + 2;
      rightLines.forEach(line => {
        doc.text(line, rightLeft, currentRightY, { width: rightWidth, align: 'right' });
        currentRightY += 10.5;
      });

      // Garis Pemisah (3px Solid Black di bawah kop surat)
      const lineY = Math.max(doc.y, headerTop + 70) + 6;
      doc.lineWidth(3).moveTo(leftMargin, lineY).lineTo(rightMargin, lineY).stroke('#000000');

      // ─── JUDUL DOKUMEN & METADATA SURAT ───
      let yPos = lineY + 16;

      doc.font('Times-Bold').fontSize(11).text('SURAT REKOMENDASI DAN KUASA', leftMargin, yPos, {
        align: 'center',
        underline: true
      });

      yPos += 14;
      doc.font('Times-Roman').fontSize(9.5).text(`Nomor : ${nomorSurat}`, leftMargin, yPos, {
        align: 'center'
      });

      yPos += 16;
      // Perihal
      doc.font('Times-Bold').fontSize(9.5).text('Perihal :', leftMargin, yPos);
      doc.font('Times-Roman').fontSize(9.5).text('Pembayaran Pajak Tahunan Dan Pergantian STNK', leftMargin + 50, yPos);

      yPos += 15;
      // Tujuan Surat
      doc.font('Times-Roman').fontSize(9.5);
      doc.text('Kepada Yth.', leftMargin, yPos);
      yPos += 12;
      doc.font('Times-Bold').text('Direktur Lalu Lintas Polda Sulsel', leftMargin, yPos);
      yPos += 12;
      doc.font('Times-Roman').text('cq. Kasi. BPKB / Kasi. STNK', leftMargin, yPos);
      yPos += 12;
      doc.text('di -', leftMargin, yPos);
      yPos += 12;
      doc.text('     Makassar', leftMargin, yPos);

      // ─── TAHAP 4: PARAGRAF PENGANTAR BARU ───
      yPos += 18;
      const wheelDesc = (vehicle.jenis_kendaraan && vehicle.jenis_kendaraan.toLowerCase().includes('motor'))
        ? 'roda 2 (dua)'
        : 'roda 4 (empat)';

      doc.font('Times-Roman').fontSize(9.5).text(
        `Menerangkan bahwa kendaraan ${wheelDesc} dengan spesifikasi sebagai berikut:`,
        leftMargin, yPos, { width: pageWidth, lineGap: 2 }
      );

      // ─── TAHAP 3: TABEL SPESIFIKASI STNK (PROPORSI TETAP 25% - 5% - 70%) ───
      yPos = doc.y + 10;
      const tableIndent = leftMargin + 20;
      const tableWidth = pageWidth - 20; // 495 pt
      const col1Width = tableWidth * 0.25; // 25% (~124 pt)
      const col2Width = tableWidth * 0.05; // 5% (~25 pt)
      const col3Width = tableWidth * 0.70; // 70% (~346 pt)

      const col1X = tableIndent;
      const col2X = col1X + col1Width;
      const col3X = col2X + col2Width;

      const specRows = [
        { label: 'Merk', value: vehicle.merek || vehicle.merek_type || '-' },
        { label: 'Type', value: vehicle.jenis || vehicle.jenis_kendaraan || '-' },
        { label: 'Model', value: vehicle.model || '-' },
        { label: 'Nomor Polisi', value: vehicle.nomor_polisi || '-' },
        { label: 'Nomor Rangka', value: vehicle.no_rangka || '-' },
        { label: 'Nomor Mesin', value: vehicle.no_mesin || '-' },
        { label: 'Warna', value: vehicle.warna || '-' },
        { label: 'Isi Silinder', value: vehicle.isi_silinder ? (vehicle.isi_silinder.toString().includes('cc') ? vehicle.isi_silinder : `${vehicle.isi_silinder} cc`) : '-' }
      ];

      specRows.forEach(row => {
        doc.font('Times-Roman').fontSize(9.5).text(row.label, col1X, yPos, { width: col1Width });
        doc.text(':', col2X, yPos, { width: col2Width, align: 'center' });
        doc.font('Times-Bold').text(row.value, col3X, yPos, { width: col3Width });
        yPos += 15;
      });

      // ─── TAHAP 4: PARAGRAF PENUTUP BARU ───
      yPos += 8;
      doc.font('Times-Roman').fontSize(9.5).text(
        'Adalah benar-benar milik Universitas Hasanuddin untuk diproses Surat Tanda Nomor Kendaraan (STNK) dan Buku Pemilikan Kendaraan Bermotor (BPKB).',
        leftMargin, yPos, { width: pageWidth, lineGap: 2 }
      );

      yPos = doc.y + 8;
      doc.text(
        'Demikian Surat Rekomendasi dan Kuasa ini dibuat dengan sebenar-benarnya untuk dapat dipergunakan sebagaimana mestinya.',
        leftMargin, yPos, { width: pageWidth, lineGap: 2 }
      );

      // ─── TAHAP 4: BLOK TANDA TANGAN (HANYA KASUBDIT DI SISI KANAN BAWAH) ───
      // Sisi kiri (60%) kosong, sisi kanan (40%) memuat tanda tangan Kasubdit
      yPos = doc.y + 24;
      const signColLeft = leftMargin + (pageWidth * 0.58);
      const signColWidth = pageWidth * 0.42;

      const dateText = `Makassar, ${formatTanggalIndo()}`;
      doc.font('Times-Roman').fontSize(9.5).text(dateText, signColLeft, yPos, { width: signColWidth, align: 'left' });

      yPos += 13;
      doc.text('Kepala Subdirektorat Kerumahtanggaan', signColLeft, yPos, { width: signColWidth, align: 'left' });
      yPos += 12;
      doc.text('dan Keprotokolan', signColLeft, yPos, { width: signColWidth, align: 'left' });

      // Ruang tanda tangan
      yPos += 52;
      const pemberiNama = pemberiKuasa.nama || pemberiKuasa.nama_lengkap || '___________________';
      const pemberiNip = pemberiKuasa.nip || pemberiKuasa.nip_nik || '-';

      doc.font('Times-Bold').fontSize(9.5).text(pemberiNama, signColLeft, yPos, { width: signColWidth, align: 'left', underline: true });
      yPos += 13;
      doc.font('Times-Roman').fontSize(9).text(`NIP. ${pemberiNip}`, signColLeft, yPos, { width: signColWidth, align: 'left' });

      // ─── TEMBUSAN (KIRI BAWAH) ───
      const tembusanY = yPos - 30;
      doc.font('Times-Italic').fontSize(8).text('Tembusan Yth.:', leftMargin, tembusanY);
      doc.font('Times-Roman').fontSize(7.5);
      doc.text('1. Rektor Universitas Hasanuddin;', leftMargin + 8, tembusanY + 10);
      doc.text('2. Direktur Keuangan dan Akuntansi UNHAS;', leftMargin + 8, tembusanY + 19);
      doc.text('3. Pertinggal / Arsip.', leftMargin + 8, tembusanY + 28);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = {
  generateSamsatLetterPDF,
  formatTanggalIndo
};
