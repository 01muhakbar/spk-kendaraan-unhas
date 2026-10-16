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

// Ambil logo sebagai Buffer (Cloudinary / File Lokal)
const getLogoBuffer = async (logoUrl) => {
  if (logoUrl && typeof logoUrl === 'string' && logoUrl.startsWith('http')) {
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

  // Fallback ke logo lokal yang ada di public/logo-unhas.jpg
  const localLogoPath = path.join(__dirname, '../public/logo-unhas.jpg');
  if (fs.existsSync(localLogoPath)) {
    return fs.readFileSync(localLogoPath);
  }

  return null;
};

/**
 * Menghasilkan Buffer PDF Surat Rekomendasi & Kuasa SAMSAT
 * @param {Object} data { vehicle, pemberiKuasa, penerimaKuasa, nomorSurat, kopSettings, logoUrl }
 * @returns {Promise<Buffer>}
 */
const generateSamsatLetterPDF = async (data) => {
  const {
    vehicle,
    pemberiKuasa,
    penerimaKuasa,
    nomorSurat = '65969/UN4.1.6.1.3/PL.10.04/2026',
    kopSettings = {},
    logoUrl = null
  } = data;

  const logoBuffer = await getLogoBuffer(logoUrl);

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 28, bottom: 28, left: 40, right: 40 },
        info: {
          Title: `Surat Kuasa SAMSAT - ${vehicle.nomor_polisi}`,
          Author: 'Universitas Hasanuddin',
          Subject: 'Pengurusan Pajak STNK SAMSAT'
        }
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const leftMargin = 40;
      const rightMargin = 555;
      const pageWidth = rightMargin - leftMargin;

      // ─── 1. KOP SURAT STANDAR UNHAS (3 BLOK SEJAJAR) ───
      const headerTop = 28;

      // Blok Kiri: Logo UNHAS
      if (logoBuffer) {
        doc.image(logoBuffer, leftMargin, headerTop, { width: 56, height: 56, fit: [56, 56] });
      }

      // Blok Tengah: Teks Institusi
      const centerLeft = leftMargin + 64;
      const centerWidth = 275;
      doc.font('Times-Bold').fontSize(9.5).text(
        kopSettings.KOP_KIRI_1 || 'KEMENTERIAN PENDIDIKAN TINGGI, SAINS,',
        centerLeft, headerTop, { width: centerWidth, lineGap: 1 }
      );
      doc.text(
        kopSettings.KOP_KIRI_2 || 'DAN TEKNOLOGI',
        centerLeft, doc.y, { width: centerWidth, lineGap: 1 }
      );
      doc.fontSize(12).text(
        kopSettings.KOP_KIRI_3 || 'UNIVERSITAS HASANUDDIN',
        centerLeft, doc.y + 1, { width: centerWidth, lineGap: 1 }
      );
      if (kopSettings.KOP_KIRI_4) {
        doc.fontSize(9.5).text(
          kopSettings.KOP_KIRI_4,
          centerLeft, doc.y, { width: centerWidth, lineGap: 1 }
        );
      }

      // Blok Kanan: Alamat & Kontak
      const rightLeft = 385;
      const rightWidth = rightMargin - rightLeft;
      doc.font('Times-Roman').fontSize(7.5);
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
        currentRightY += 9.5;
      });

      // Garis Pemisah Ganda (Horizontal Rule)
      const lineY = Math.max(doc.y, headerTop + 60) + 4;
      doc.lineWidth(1.8).moveTo(leftMargin, lineY).lineTo(rightMargin, lineY).stroke('#000000');
      doc.lineWidth(0.5).moveTo(leftMargin, lineY + 2.5).lineTo(rightMargin, lineY + 2.5).stroke('#000000');

      // ─── 2. JUDUL DOKUMEN & METADATA ───
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
      // Perihal & Tujuan Surat
      doc.font('Times-Bold').fontSize(9).text('Perihal :', leftMargin, yPos);
      doc.font('Times-Roman').fontSize(9).text('Pembayaran Pajak Tahunan Dan Pergantian STNK', leftMargin + 45, yPos);

      yPos += 13;
      doc.font('Times-Roman').fontSize(9);
      doc.text('Kepada Yth.', leftMargin, yPos);
      yPos += 11;
      doc.font('Times-Bold').text('Direktur Lalu Lintas Polda Sulsel', leftMargin, yPos);
      yPos += 11;
      doc.font('Times-Roman').text('cq. Kasi. BPKB / Kasi. STNK', leftMargin, yPos);
      yPos += 11;
      doc.text('di -', leftMargin, yPos);
      yPos += 11;
      doc.text('     Makassar', leftMargin, yPos);

      // Helper untuk merender baris titik dua sejajar
      const renderKeyValueRows = (items, startY, labelW = 95, colonW = 12) => {
        let curY = startY;
        items.forEach(item => {
          doc.font('Times-Roman').fontSize(8.8).text(item.label, leftMargin + 10, curY, { width: labelW });
          doc.text(':', leftMargin + 10 + labelW, curY, { width: colonW });
          if (item.isBold) doc.font('Times-Bold');
          else doc.font('Times-Roman');
          doc.text(item.value || '-', leftMargin + 10 + labelW + colonW, curY, { width: pageWidth - (10 + labelW + colonW) });
          curY += 12;
        });
        return curY;
      };

      // ─── 3. BLOK PEMBERI KUASA ───
      yPos += 14;
      doc.font('Times-Roman').fontSize(9).text('Yang bertanda tangan di bawah ini:', leftMargin, yPos);
      yPos += 12;

      yPos = renderKeyValueRows([
        { label: 'Nama', value: pemberiKuasa.nama_lengkap, isBold: true },
        { label: 'NIP / NIK', value: pemberiKuasa.nip_nik },
        { label: 'Jabatan', value: pemberiKuasa.jabatan },
        { label: 'Instansi / Alamat', value: 'Universitas Hasanuddin, Kampus Tamalanrea Jl. Perintis Kemerdekaan Km. 10, Makassar' }
      ], yPos);

      // ─── 4. BLOK PENERIMA KUASA ───
      yPos += 4;
      doc.font('Times-Roman').fontSize(9).text('Dengan ini memberikan rekomendasi dan kuasa kepada:', leftMargin, yPos);
      yPos += 12;

      yPos = renderKeyValueRows([
        { label: 'Nama', value: penerimaKuasa.nama_lengkap, isBold: true },
        { label: 'NIP / NIK', value: penerimaKuasa.nip_nik },
        { label: 'Jabatan', value: penerimaKuasa.jabatan },
        { label: 'Instansi / Alamat', value: 'Universitas Hasanuddin, Kampus Tamalanrea Jl. Perintis Kemerdekaan Km. 10, Makassar' }
      ], yPos);

      // ─── 5. KLAUSUL KUASA & TABEL SPESIFIKASI STNK ───
      yPos += 4;
      doc.font('Times-Roman').fontSize(8.8).text(
        'Untuk melakukan pengurusan administrasi, pembayaran pajak kendaraan bermotor tahunan, dan/atau pergantian STNK serta Tanda Nomor Kendaraan Bermotor (TNKB) 5 tahunan di Kantor Bersama SAMSAT, terhadap kendaraan dinas operasional milik Universitas Hasanuddin dengan spesifikasi teknis STNK sebagai berikut:',
        leftMargin, yPos, { width: pageWidth, align: 'justify', lineGap: 1 }
      );
      yPos = doc.y + 6;

      // Kotak Tabel Spesifikasi STNK
      const boxPadding = 6;
      const boxStartY = yPos;
      
      const stnkRows = [
        { label: 'Nomor Polisi (TNKB)', value: (vehicle.nomor_polisi || '-').toUpperCase(), isBold: true },
        { label: 'Merek / Type', value: vehicle.merek_type || '-' },
        { label: 'Model', value: vehicle.model || '-' },
        { label: 'Nomor Rangka (VIN)', value: (vehicle.no_rangka || '-').toUpperCase(), isBold: true },
        { label: 'Nomor Mesin', value: (vehicle.no_mesin || '-').toUpperCase(), isBold: true },
        { label: 'Warna Kendaraan', value: vehicle.warna || '-' },
        { label: 'Isi Silinder / Kapasitas', value: vehicle.isi_silinder ? `${vehicle.isi_silinder} cc` : '-' }
      ];

      // Gambar latar abu-abu halus untuk tabel spesifikasi
      const specBoxHeight = (stnkRows.length * 12) + (boxPadding * 2);
      doc.rect(leftMargin, boxStartY, pageWidth, specBoxHeight).fillAndStroke('#fcfcfd', '#d1d5db');
      doc.fillColor('#000000'); // kembalikan warna teks hitam

      renderKeyValueRows(stnkRows, boxStartY + boxPadding, 130, 15);
      yPos = boxStartY + specBoxHeight + 8;

      // ─── 6. KLAUSUL PENUTUP ───
      doc.font('Times-Roman').fontSize(8.8).text(
        'Demikian Surat Rekomendasi dan Kuasa ini dibuat dengan sebenar-benarnya untuk dapat dipergunakan sebagaimana mestinya, dan kepada pihak berwenang dimohon untuk memberikan bantuan serta pelayanan sesuai ketentuan yang berlaku.',
        leftMargin, yPos, { width: pageWidth, align: 'justify', lineGap: 1 }
      );
      yPos = doc.y + 12;

      // ─── 7. TANDA TANGAN (2 KOLOM) ───
      const dateText = `Makassar, ${formatTanggalIndo()}`;
      const signY = yPos;

      // Tanggal di atas kolom kanan
      const col2Left = 330;
      doc.font('Times-Roman').fontSize(9).text(dateText, col2Left, signY, { width: 220, align: 'center' });

      const roleY = signY + 12;
      // Kolom Kiri: Penerima Kuasa
      const col1Left = leftMargin;
      doc.font('Times-Roman').fontSize(9).text('Penerima Kuasa,', col1Left, roleY, { width: 200, align: 'center' });

      // Kolom Kanan: Pemberi Kuasa
      doc.text('Pemberi Kuasa,', col2Left, roleY, { width: 220, align: 'center' });

      // Jarak tanda tangan
      const nameY = roleY + 48;

      // Nama & NIP Penerima
      doc.font('Times-Bold').fontSize(9).text(penerimaKuasa.nama_lengkap || '___________________', col1Left, nameY, { width: 200, align: 'center', underline: true });
      doc.font('Times-Roman').fontSize(8.5).text(`NIP. ${penerimaKuasa.nip_nik || '-'}`, col1Left, nameY + 12, { width: 200, align: 'center' });

      // Nama & NIP Pemberi
      doc.font('Times-Bold').fontSize(9).text(pemberiKuasa.nama_lengkap || '___________________', col2Left, nameY, { width: 220, align: 'center', underline: true });
      doc.font('Times-Roman').fontSize(8.5).text(`NIP. ${pemberiKuasa.nip_nik || '-'}`, col2Left, nameY + 12, { width: 220, align: 'center' });

      // ─── 8. TEMBUSAN (KIRI BAWAH) ───
      const tembusanY = nameY + 28;
      doc.font('Times-Italic').fontSize(8).text('Tembusan Yth.:', leftMargin, tembusanY);
      doc.font('Times-Roman').fontSize(7.5);
      doc.text('1. Rektor Universitas Hasanuddin (sebagai laporan);', leftMargin + 8, tembusanY + 10);
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
