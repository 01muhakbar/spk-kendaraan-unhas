// Ensure PDFKit standard fonts resolver is loaded first for Vercel Serverless
require('./pdfkitFontResolver');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const defaultLogoBase64 = require('./logoBase64');

// Format tanggal ke Bahasa Indonesia (contoh: 16 Oktober 2026)
const formatTanggalIndo = (date = new Date()) => {
  const bulan = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const d = new Date(date);
  return `${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}`;
};

// Ambil logo sebagai Buffer (Uploads Relatif / Base64 / File Lokal / Fallback Base64 Resmi)
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
    // 3. Dukungan File Upload Relatif (misal: /uploads/logos/logo-xxx.jpg dari pengaturan SPK)
    const cleanPath = logoUrl.startsWith('/') ? logoUrl.slice(1) : logoUrl;
    const pathsToCheck = [
      path.join(__dirname, '../public', cleanPath),
      path.join(__dirname, '..', cleanPath),
      path.join(__dirname, '../../public', cleanPath)
    ];
    for (const p of pathsToCheck) {
      if (fs.existsSync(p) && fs.statSync(p).isFile()) {
        try {
          return fs.readFileSync(p);
        } catch (e) {
          console.warn('Gagal membaca file upload logo:', e.message);
        }
      }
    }
  }

  // 4. Dukungan File Lokal bawaan
  const localLogoPath = path.join(__dirname, '../public/logo-unhas.jpg');
  if (fs.existsSync(localLogoPath)) {
    return fs.readFileSync(localLogoPath);
  }

  // 5. Fallback Base64 Resmi UNHAS (Menjamin logo selalu muncul di lingkungan serverless)
  if (defaultLogoBase64) {
    return Buffer.from(defaultLogoBase64, 'base64');
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

      // ─── KOP SURAT STANDAR UNHAS (IDENTIK DENGAN PRATINJAU DOKUMEN SPK) ───
      const headerTop = 25;
      const logoWidth = 68; // Proporsi logo UNHAS pas ~70px sejajar vertikal teks

      // Kolom Kiri: Logo UNHAS
      if (logoBuffer) {
        doc.image(logoBuffer, leftMargin, headerTop, { width: logoWidth, fit: [logoWidth, 68] });
      }

      // Kolom Tengah: Teks Institusi (Berdampingan langsung dengan logo, gap ~12pt)
      const centerLeft = leftMargin + logoWidth + 12; // 120 pt
      const centerWidth = 245;

      const kopKiri1 = kopSettings.KOP_KIRI_1 !== undefined ? kopSettings.KOP_KIRI_1 : 'KEMENTERIAN PENDIDIKAN TINGGI, SAINS,';
      const kopKiri2 = kopSettings.KOP_KIRI_2 !== undefined ? kopSettings.KOP_KIRI_2 : 'DAN TEKNOLOGI';
      const kopKiri3 = kopSettings.KOP_KIRI_3 !== undefined ? kopSettings.KOP_KIRI_3 : 'UNIVERSITAS HASANUDDIN';
      const kopKiri4 = kopSettings.KOP_KIRI_4 !== undefined ? kopSettings.KOP_KIRI_4 : '';

      doc.font('Times-Roman').fontSize(10).text(kopKiri1, centerLeft, headerTop + 3, { width: centerWidth, lineGap: 1.5 });
      doc.text(kopKiri2, centerLeft, doc.y, { width: centerWidth, lineGap: 1.5 });
      doc.font('Times-Bold').fontSize(14).text(kopKiri3, centerLeft, doc.y + 2, { width: centerWidth, lineGap: 1.5 });
      if (kopKiri4 && kopKiri4.trim()) {
        doc.font('Times-Bold').fontSize(12).text(kopKiri4, centerLeft, doc.y + 1, { width: centerWidth, lineGap: 1.5 });
      }

      // Kolom Kanan: Alamat & Kontak Resmi (Rata Kanan, hanya menampilkan baris yang terisi di pengaturan SPK)
      const rightLeft = 365;
      const rightWidth = rightMargin - rightLeft;
      doc.font('Times-Roman').fontSize(8);

      const rightLines = [
        kopSettings.KOP_KANAN_1 !== undefined ? kopSettings.KOP_KANAN_1 : 'Jalan Perintis Kemerdekaan Km. 10',
        kopSettings.KOP_KANAN_2 !== undefined ? kopSettings.KOP_KANAN_2 : 'Tamalanrea, Makassar 90245',
        kopSettings.KOP_KANAN_3 !== undefined ? kopSettings.KOP_KANAN_3 : '',
        kopSettings.KOP_KANAN_4 !== undefined ? kopSettings.KOP_KANAN_4 : 'e-mail: office@unhas.ac.id',
        kopSettings.KOP_KANAN_5 !== undefined ? kopSettings.KOP_KANAN_5 : 'Laman: www.unhas.ac.id'
      ].filter(line => line && line.trim() !== '');

      let currentRightY = headerTop + 3;
      rightLines.forEach(line => {
        doc.text(line, rightLeft, currentRightY, { width: rightWidth, align: 'right' });
        currentRightY += 10;
      });

      // ─── JUDUL DOKUMEN & METADATA SURAT ───
      // Mengikuti standar Dokumen SPK: tanpa garis hitam tebal, jarak nafas yang bersih
      const headerBottom = Math.max(doc.y, headerTop + 68, currentRightY);
      let yPos = headerBottom + 18;

      doc.font('Times-Bold').fontSize(11).text('SURAT REKOMENDASI DAN KUASA', leftMargin, yPos, {
        align: 'center',
        underline: true
      });

      yPos += 14;
      doc.font('Times-Roman').fontSize(9.5).text(`Nomor : ${nomorSurat}`, leftMargin, yPos, {
        align: 'center'
      });

      yPos += 15;
      // Injeksi Perihal / Hal Dinamis
      doc.font('Times-Roman').fontSize(9.5).text('Hal :', leftMargin, yPos);
      doc.font('Times-Bold').fontSize(9.5).text(perihalSurat, leftMargin + 30, yPos);

      yPos += 15;
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

      // ─── STANDARISASI ALIGNMENT TITIK DUA TERPADU (UNTUK SEMUA TABEL) ───
      // Menggunakan lebar kolom terpadu agar titik dua (:) sejajar tegak lurus sempurna
      const tableIndent = leftMargin + 20; // 60 pt
      const tableWidth = pageWidth - 20; // 495 pt
      const colLabelWidth = 92; // 92 pt: Cukup luas untuk "Nomor Polisi" & "Nomor Rangka"
      const colColonWidth = 15; // 15 pt: Pemisah titik dua
      const colValueWidth = tableWidth - colLabelWidth - colColonWidth; // 388 pt: Nilai data

      const colLabelX = tableIndent; // 60 pt
      const colColonX = colLabelX + colLabelWidth; // 152 pt
      const colValueX = colColonX + colColonWidth; // 167 pt

      // ─── TABEL 1: IDENTITAS LEGAL PEMBERI KUASA ───
      yPos += 14;
      doc.font('Times-Roman').fontSize(9.5).text('Yang bertanda tangan dibawah ini:', leftMargin, yPos);

      yPos += 12;
      const pemberiRows = [
        { label: 'Nama', value: pemberiKuasa.nama || pemberiKuasa.nama_lengkap || '-', bold: true },
        { label: 'NIP', value: pemberiKuasa.nip || pemberiKuasa.nip_nik || '-', bold: false },
        { label: 'Jabatan', value: pemberiKuasa.jabatan || 'Kepala Subdirektorat Kerumahtanggaan dan Keprotokolan', bold: false },
        { label: 'Alamat', value: pemberiKuasa.alamat || 'Jl. P. Kemerdekaan Km. 10 Makassar', bold: false }
      ];

      pemberiRows.forEach(row => {
        doc.font('Times-Roman').fontSize(9.5).text(row.label, colLabelX, yPos, { width: colLabelWidth });
        doc.text(':', colColonX, yPos, { width: colColonWidth, align: 'center' });
        doc.font(row.bold ? 'Times-Bold' : 'Times-Roman').text(row.value, colValueX, yPos, { width: colValueWidth });
        yPos += 12.5;
      });

      // ─── TABEL 2: IDENTITAS LEGAL PENERIMA KUASA ───
      yPos += 4;
      doc.font('Times-Roman').fontSize(9.5).text('Dengan ini memberi kuasa kepada:', leftMargin, yPos);

      yPos += 12;
      const penerimaRows = [
        { label: 'Nama', value: penerimaKuasa.nama || penerimaKuasa.nama_lengkap || '-', bold: true },
        { label: 'NIP', value: penerimaKuasa.nip || penerimaKuasa.nip_nik || '-', bold: false },
        { label: 'Jabatan', value: penerimaKuasa.jabatan || 'Staf Operasional', bold: false },
        { label: 'Alamat', value: penerimaKuasa.alamat || 'Jl. P. Kemerdekaan Km. 10 Makassar', bold: false }
      ];

      penerimaRows.forEach(row => {
        doc.font('Times-Roman').fontSize(9.5).text(row.label, colLabelX, yPos, { width: colLabelWidth });
        doc.text(':', colColonX, yPos, { width: colColonWidth, align: 'center' });
        doc.font(row.bold ? 'Times-Bold' : 'Times-Roman').text(row.value, colValueX, yPos, { width: colValueWidth });
        yPos += 12.5;
      });

      // ─── TABEL 3: SPESIFIKASI KENDARAAN (TITIK DUA SEJAJAR PERSIS DENGAN TABEL DI ATASNYA) ───
      yPos += 4;
      const wheelDesc = (vehicle.jenis_kendaraan && vehicle.jenis_kendaraan.toLowerCase().includes('motor'))
        ? 'roda 2 (dua)'
        : 'roda 4 (empat)';

      doc.font('Times-Roman').fontSize(9.5).text(
        `Menerangkan bahwa kendaraan ${wheelDesc} dengan spesifikasi sebagai berikut:`,
        leftMargin, yPos, { width: pageWidth }
      );

      yPos += 12;
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
        doc.font('Times-Roman').fontSize(9.5).text(row.label, colLabelX, yPos, { width: colLabelWidth });
        doc.text(':', colColonX, yPos, { width: colColonWidth, align: 'center' });
        doc.font('Times-Bold').text(row.value, colValueX, yPos, { width: colValueWidth });
        yPos += 12;
      });

      // ─── PARAGRAF PENUTUP ───
      yPos += 5;
      doc.font('Times-Roman').fontSize(9.5).text(
        'Adalah benar-benar milik Universitas Hasanuddin untuk diproses Surat Tanda Nomor Kendaraan (STNK) dan Buku Pemilikan Kendaraan Bermotor (BPKB).',
        leftMargin, yPos, { width: pageWidth, lineGap: 1.5 }
      );

      yPos = doc.y + 5;
      doc.text(
        'Demikian Surat Rekomendasi dan Kuasa ini dibuat dengan sebenar-benarnya untuk dapat dipergunakan sebagaimana mestinya.',
        leftMargin, yPos, { width: pageWidth, lineGap: 1.5 }
      );

      // ─── BLOK TANDA TANGAN PEJABAT (SISI KANAN) & TEMBUSAN (DI BAWAH TANDA TANGAN) ───
      const signTableTop = doc.y + 18;
      const col50Width = pageWidth * 0.50; // 50% (~257.5 pt)
      const leftColX = leftMargin; // Kolom Kiri
      const rightColX = leftMargin + col50Width; // Kolom Kanan

      // Blok Kanan: Tanda Tangan Pejabat (Pemberi Kuasa)
      const dateText = `Makassar, ${formatTanggalIndo()}`;
      doc.font('Times-Roman').fontSize(9.5).text(dateText, rightColX, signTableTop, { width: col50Width, align: 'left' });

      doc.text('Kepala Subdirektorat Kerumahtanggaan', rightColX, signTableTop + 12, { width: col50Width, align: 'left' });
      doc.text('dan Keprotokolan', rightColX, signTableTop + 23, { width: col50Width, align: 'left' });

      // Ruang stempel basah instansi & tanda tangan fisik (~50 pt)
      const stampVerticalWhitespace = 50;
      const signBaseY = signTableTop + 35 + stampVerticalWhitespace;
      const pemberiNama = pemberiKuasa.nama || pemberiKuasa.nama_lengkap || '___________________';
      const pemberiNip = pemberiKuasa.nip || pemberiKuasa.nip_nik || '-';

      doc.font('Times-Bold').fontSize(9.5).text(pemberiNama, rightColX, signBaseY, { width: col50Width, align: 'left', underline: true });
      doc.font('Times-Roman').fontSize(9).text(`NIP. ${pemberiNip}`, rightColX, signBaseY + 12, { width: col50Width, align: 'left' });

      // Blok Tembusan: Ditempatkan di sisi kiri BAWAH tanda tangan (tidak sejajar dengan tanda tangan)
      const tembusanY = signBaseY + 24;
      doc.font('Times-Roman').fontSize(8.5).text('Tembusan:', leftColX, tembusanY);
      doc.text('1. Wakil Rektor Bidang Perencanaan, Keuangan, dan Prasarana.', leftColX, tembusanY + 11);
      doc.text('2. Direktur Komunikasi dan Kantor Sekretariat Rektor.', leftColX, tembusanY + 22);

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
