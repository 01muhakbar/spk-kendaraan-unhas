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
 * @param {Object} data { vehicle, pemberiKuasa, penerimaKuasa, nomorSurat, perihalSurat, kopSettings, logoUrl }
 * @returns {Promise<Buffer>}
 */
const generateSamsatLetterPDF = async (data) => {
  const {
    vehicle = {},
    pemberiKuasa = {},
    penerimaKuasa = {},
    nomorSurat = '65969/UN4.1.6.1.3/PL.10.04/2026',
    perihalSurat = 'Pembayaran Pajak Tahunan dan Pergantian STNK',
    kopSettings = {},
    logoUrl = null
  } = data;

  const logoBuffer = await getLogoBuffer(logoUrl);

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 25, bottom: 25, left: 40, right: 40 },
        info: {
          Title: `Surat Rekomendasi dan Kuasa SAMSAT - ${vehicle.nomor_polisi || 'UNHAS'}`,
          Author: 'Universitas Hasanuddin',
          Subject: perihalSurat
        }
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const leftMargin = 40;
      const rightMargin = 555;
      const pageWidth = rightMargin - leftMargin; // 515 pt

      // ─── TAHAP 1: KOP SURAT STANDAR UNHAS (3 BLOK SEJAJAR: 15% - 55% - 30%) ───
      // CATATAN KHUSUS: Sesuai arahan manajerial, JANGAN menambahkan teks "BIRO UMUM". Pertahankan desain saat ini.
      const headerTop = 25;
      const logoWidth = 62;

      // Blok Kiri (15%): Logo UNHAS
      if (logoBuffer) {
        doc.image(logoBuffer, leftMargin, headerTop, { width: logoWidth, fit: [logoWidth, 65] });
      }

      // Blok Tengah (55%): Teks Institusi
      const centerLeft = leftMargin + 72;
      const centerWidth = 285;
      doc.font('Times-Bold').fontSize(9.5).text(
        kopSettings.KOP_KIRI_1 || 'KEMENTERIAN PENDIDIKAN TINGGI, SAINS,',
        centerLeft, headerTop + 3, { width: centerWidth, lineGap: 1.5 }
      );
      doc.text(
        kopSettings.KOP_KIRI_2 || 'DAN TEKNOLOGI',
        centerLeft, doc.y, { width: centerWidth, lineGap: 1.5 }
      );
      doc.fontSize(13.5).text(
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
        currentRightY += 10;
      });

      // Garis Pemisah (Solid Black di bawah kop surat)
      const lineY = Math.max(doc.y, headerTop + 66) + 4;
      doc.lineWidth(2.5).moveTo(leftMargin, lineY).lineTo(rightMargin, lineY).stroke('#000000');

      // ─── TAHAP 2: JUDUL DOKUMEN & METADATA SURAT ───
      let yPos = lineY + 12;

      doc.font('Times-Bold').fontSize(11).text('SURAT REKOMENDASI DAN KUASA', leftMargin, yPos, {
        align: 'center',
        underline: true
      });

      yPos += 14;
      doc.font('Times-Roman').fontSize(9.5).text(`Nomor : ${nomorSurat}`, leftMargin, yPos, {
        align: 'center'
      });

      yPos += 14;
      // Injeksi Perihal / Hal Dinamis
      doc.font('Times-Roman').fontSize(9.5).text('Hal :', leftMargin, yPos);
      doc.font('Times-Bold').fontSize(9.5).text(perihalSurat, leftMargin + 30, yPos);

      yPos += 14;
      // Tujuan Surat
      doc.font('Times-Roman').fontSize(9.5);
      doc.text('Kepada Yth.', leftMargin, yPos);
      yPos += 11;
      doc.font('Times-Bold').text('Direktur Lalu Lintas Polda Sulsel', leftMargin, yPos);
      yPos += 11;
      doc.font('Times-Roman').text('cq. Kasi. BPKB / Kasi. STNK', leftMargin, yPos);
      yPos += 11;
      doc.text('di -', leftMargin, yPos);
      yPos += 11;
      doc.text('     Makassar', leftMargin, yPos);

      // Konfigurasi Lebar Tabel Identitas Legal (15% - 5% - 80%) dengan margin-left 20px
      const tableIndent = leftMargin + 20;
      const tableWidth = pageWidth - 20; // 495 pt
      const idCol1Width = tableWidth * 0.15; // 15% (~74.25 pt)
      const idCol2Width = tableWidth * 0.05; // 5% (~24.75 pt)
      const idCol3Width = tableWidth * 0.80; // 80% (~396 pt)

      const idCol1X = tableIndent;
      const idCol2X = idCol1X + idCol1Width;
      const idCol3X = idCol2X + idCol2Width;

      // ─── TAHAP 3: BLOK IDENTITAS LEGAL PEMBERI KUASA ───
      yPos += 13;
      doc.font('Times-Roman').fontSize(9.5).text('Yang bertanda tangan dibawah ini:', leftMargin, yPos);

      yPos += 12;
      const pemberiRows = [
        { label: 'Nama', value: pemberiKuasa.nama || pemberiKuasa.nama_lengkap || '-', bold: true },
        { label: 'NIP', value: pemberiKuasa.nip || pemberiKuasa.nip_nik || '-', bold: false },
        { label: 'Jabatan', value: pemberiKuasa.jabatan || 'Kepala Subdirektorat Kerumahtanggaan dan Keprotokolan', bold: false },
        { label: 'Alamat', value: pemberiKuasa.alamat || 'Jl. P. Kemerdekaan Km. 10 Makassar', bold: false }
      ];

      pemberiRows.forEach(row => {
        doc.font('Times-Roman').fontSize(9.5).text(row.label, idCol1X, yPos, { width: idCol1Width });
        doc.text(':', idCol2X, yPos, { width: idCol2Width, align: 'center' });
        doc.font(row.bold ? 'Times-Bold' : 'Times-Roman').text(row.value, idCol3X, yPos, { width: idCol3Width });
        yPos += 12.5;
      });

      // ─── BLOK IDENTITAS LEGAL PENERIMA KUASA ───
      yPos += 3;
      doc.font('Times-Roman').fontSize(9.5).text('Dengan ini memberi kuasa kepada:', leftMargin, yPos);

      yPos += 12;
      const penerimaRows = [
        { label: 'Nama', value: penerimaKuasa.nama || penerimaKuasa.nama_lengkap || '-', bold: true },
        { label: 'NIP', value: penerimaKuasa.nip || penerimaKuasa.nip_nik || '-', bold: false },
        { label: 'Jabatan', value: penerimaKuasa.jabatan || 'Staf Operasional', bold: false },
        { label: 'Alamat', value: penerimaKuasa.alamat || 'Jl. P. Kemerdekaan Km. 10 Makassar', bold: false }
      ];

      penerimaRows.forEach(row => {
        doc.font('Times-Roman').fontSize(9.5).text(row.label, idCol1X, yPos, { width: idCol1Width });
        doc.text(':', idCol2X, yPos, { width: idCol2Width, align: 'center' });
        doc.font(row.bold ? 'Times-Bold' : 'Times-Roman').text(row.value, idCol3X, yPos, { width: idCol3Width });
        yPos += 12.5;
      });

      // ─── TAHAP 4: PENGANTAR & TABEL SPESIFIKASI KENDARAAN (25% - 5% - 70%) ───
      yPos += 3;
      const wheelDesc = (vehicle.jenis_kendaraan && vehicle.jenis_kendaraan.toLowerCase().includes('motor'))
        ? 'roda 2 (dua)'
        : 'roda 4 (empat)';

      doc.font('Times-Roman').fontSize(9.5).text(
        `Menerangkan bahwa kendaraan ${wheelDesc} dengan spesifikasi sebagai berikut:`,
        leftMargin, yPos, { width: pageWidth }
      );

      yPos += 12;
      const specCol1Width = tableWidth * 0.25; // 25% (~123.75 pt)
      const specCol2Width = tableWidth * 0.05; // 5% (~24.75 pt)
      const specCol3Width = tableWidth * 0.70; // 70% (~346.5 pt)

      const specCol1X = tableIndent;
      const specCol2X = specCol1X + specCol1Width;
      const specCol3X = specCol2X + specCol2Width;

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
        doc.font('Times-Roman').fontSize(9.5).text(row.label, specCol1X, yPos, { width: specCol1Width });
        doc.text(':', specCol2X, yPos, { width: specCol2Width, align: 'center' });
        doc.font('Times-Bold').text(row.value, specCol3X, yPos, { width: specCol3Width });
        yPos += 12;
      });

      // ─── TAHAP 5: PARAGRAF PENUTUP ───
      yPos += 4;
      doc.font('Times-Roman').fontSize(9.5).text(
        'Adalah benar-benar milik Universitas Hasanuddin untuk diproses Surat Tanda Nomor Kendaraan (STNK) dan Buku Pemilikan Kendaraan Bermotor (BPKB).',
        leftMargin, yPos, { width: pageWidth, lineGap: 1.5 }
      );

      yPos = doc.y + 5;
      doc.text(
        'Demikian Surat Rekomendasi dan Kuasa ini dibuat dengan sebenar-benarnya untuk dapat dipergunakan sebagaimana mestinya.',
        leftMargin, yPos, { width: pageWidth, lineGap: 1.5 }
      );

      // ─── TAHAP 6: BLOK TANDA TANGAN (HANYA KASUBDIT DI SISI KANAN BAWAH) ───
      // Sisi kanan bawah memuat tanda tangan Kepala Subdirektorat (Pemberi Kuasa)
      yPos = doc.y + 14;
      const signColLeft = leftMargin + (pageWidth * 0.58);
      const signColWidth = pageWidth * 0.42;

      const dateText = `Makassar, ${formatTanggalIndo()}`;
      doc.font('Times-Roman').fontSize(9.5).text(dateText, signColLeft, yPos, { width: signColWidth, align: 'left' });

      yPos += 12;
      doc.text('Kepala Subdirektorat Kerumahtanggaan', signColLeft, yPos, { width: signColWidth, align: 'left' });
      yPos += 11;
      doc.text('dan Keprotokolan', signColLeft, yPos, { width: signColWidth, align: 'left' });

      // Ruang tanda tangan
      const signBaseY = yPos + 44;
      const pemberiNama = pemberiKuasa.nama || pemberiKuasa.nama_lengkap || '___________________';
      const pemberiNip = pemberiKuasa.nip || pemberiKuasa.nip_nik || '-';

      doc.font('Times-Bold').fontSize(9.5).text(pemberiNama, signColLeft, signBaseY, { width: signColWidth, align: 'left', underline: true });
      doc.font('Times-Roman').fontSize(9).text(`NIP. ${pemberiNip}`, signColLeft, signBaseY + 12, { width: signColWidth, align: 'left' });

      // ─── TAHAP 7: TEMBUSAN (KIRI BAWAH) ───
      // Perbarui teks footer (Tembusan) di kiri bawah menjadi 2 butir sesuai spesifikasi
      const tembusanY = yPos + 12;
      doc.font('Times-Roman').fontSize(8.5).text('Tembusan:', leftMargin, tembusanY);
      doc.text('1. Wakil Rektor Bidang Perencanaan, Keuangan, dan Prasarana.', leftMargin, tembusanY + 11);
      doc.text('2. Direktur Komunikasi dan Kantor Sekretariat Rektor.', leftMargin, tembusanY + 22);

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
