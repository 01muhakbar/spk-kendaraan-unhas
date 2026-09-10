import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || (import.meta.env.PROD ? '' : 'http://localhost:5000');
const API = import.meta.env.VITE_API_URL || `${API_BASE}/api/v1`;

// ─── Utilitas Tanggal ───
const HARI_ID = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const BULAN_ID = ['','Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

const ANGKA_TERBILANG = (n) => {
  const satuan = ['','satu','dua','tiga','empat','lima','enam','tujuh','delapan','sembilan',
    'sepuluh','sebelas','dua belas','tiga belas','empat belas','lima belas','enam belas',
    'tujuh belas','delapan belas','sembilan belas'];
  if (n < 20) return satuan[n];
  if (n < 100) return satuan[Math.floor(n/10)*10 - (Math.floor(n/10)*10 - Math.floor(n/10))] + (n%10 ? ' ' + satuan[n%10] : '');
  return '';
};

const PULUHAN = ['','','dua puluh','tiga puluh'];
const formatTanggalTerbilang = (dateString) => {
  if (!dateString) return '—';
  const d = new Date(dateString + 'T00:00:00');
  const tgl = d.getDate();
  const bln = BULAN_ID[d.getMonth() + 1];
  const thn = d.getFullYear(); // 2026

  let tglTerbilang = '';
  if (tgl === 1) tglTerbilang = 'satu';
  else if (tgl < 20) tglTerbilang = ANGKA_TERBILANG(tgl);
  else if (tgl < 30) tglTerbilang = (tgl === 20 ? 'dua puluh' : `dua puluh ${ANGKA_TERBILANG(tgl % 10)}`);
  else tglTerbilang = tgl === 30 ? 'tiga puluh' : 'tiga puluh satu';

  const ribuan = Math.floor(thn / 1000);
  const sisa = thn % 1000;
  const ratusan = Math.floor(sisa / 100);
  const puluhan = sisa % 100;
  let thnTerbilang = '';
  if (ribuan) thnTerbilang += `${ANGKA_TERBILANG(ribuan)} ribu`;
  if (ratusan) thnTerbilang += ` ${ANGKA_TERBILANG(ratusan)} ratus`;
  if (puluhan >= 20) thnTerbilang += ` ${PULUHAN[Math.floor(puluhan/10)]}${puluhan%10 ? ' '+ANGKA_TERBILANG(puluhan%10) : ''}`;
  else if (puluhan > 0) thnTerbilang += ` ${ANGKA_TERBILANG(puluhan)}`;

  return `hari ${HARI_ID[d.getDay()]} tanggal ${tglTerbilang} bulan ${bln} tahun ${thnTerbilang.trim()}`;
};

const capitalizeEachWord = (str) => {
  if (!str) return '';
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
};

const formatDate = (dateString) => {
  if (!dateString) return '—';
  const d = new Date(dateString + 'T00:00:00');
  return `${d.getDate()} ${BULAN_ID[d.getMonth()+1]} ${d.getFullYear()}`;
};

const formatHariTanggal = (dateString) => {
  if (!dateString) return '—';
  const d = new Date(dateString + 'T00:00:00');
  return `${HARI_ID[d.getDay()]}, ${d.getDate()} ${BULAN_ID[d.getMonth()+1]} ${d.getFullYear()}`;
};

const KopSurat = ({ logoUrl, settings }) => {
  const s = settings || {};
  
  return (
    <div className="flex justify-between items-start mb-6 font-serif text-black">
      <div className="flex items-center gap-4">
        <div className="w-[90px] shrink-0">
          {logoUrl && <img src={logoUrl} alt="Logo" className="w-full h-auto object-contain" />}
        </div>
        <div className="flex flex-col text-left shrink-0">
          {s.KOP_KIRI_1 && <span className="text-[14px] tracking-wide leading-snug">{s.KOP_KIRI_1}</span>}
          {s.KOP_KIRI_2 && <span className="text-[14px] tracking-wide leading-snug">{s.KOP_KIRI_2}</span>}
          {s.KOP_KIRI_3 && <span className="text-[18px] font-bold tracking-widest leading-snug mt-0.5">{s.KOP_KIRI_3}</span>}
          {s.KOP_KIRI_4 && <span className="text-[16px] font-bold tracking-widest leading-snug">{s.KOP_KIRI_4}</span>}
        </div>
      </div>
      <div className="flex flex-col text-right text-[10px] leading-tight shrink-0 mt-2">
        {s.KOP_KANAN_1 && <span>{s.KOP_KANAN_1}</span>}
        {s.KOP_KANAN_2 && <span>{s.KOP_KANAN_2}</span>}
        {s.KOP_KANAN_3 && <span>{s.KOP_KANAN_3}</span>}
        {s.KOP_KANAN_4 && <span>{s.KOP_KANAN_4}</span>}
        {s.KOP_KANAN_5 && <span>{s.KOP_KANAN_5}</span>}
      </div>
    </div>
  );
};

const TTD = ({ label, nama, nipNik, isNIK = false }) => (
  <div className="text-center" style={{ width: '180px' }}>
    <p className="text-xs">{label}</p>
    <div style={{ height: '60px' }}></div>
    <p className="font-bold text-xs underline">{nama || '___________________'}</p>
    {nipNik && <p className="text-xs">{isNIK ? 'NIK' : 'NIP'}. {nipNik}</p>}
  </div>
);

const PrintSPK = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [spk, setSpk] = useState(null);
  const [pejabat, setPejabat] = useState([]);
  const [logoUrl, setLogoUrl] = useState(null);
  const [kopSettings, setKopSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [debugError, setDebugError] = useState(null);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [resSPK, resSDM, resLogo, resKop] = await Promise.all([
          axios.get(`${API}/spk/${id}`),
          axios.get(`${API}/signatories`),
          axios.get(`${API}/settings/logo`),
          axios.get(`${API}/settings/kop`)
        ]);
        setSpk(resSPK.data);
        setPejabat(resSDM.data);
        if (resLogo.data.logo_url) {
          const url = resLogo.data.logo_url.startsWith('http')
            ? resLogo.data.logo_url
            : `${API_BASE}${resLogo.data.logo_url}`;
          setLogoUrl(url);
        }
        setKopSettings(resKop.data);
      } catch (err) {
        console.error('Gagal memuat data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [id]);

  useEffect(() => {
    if (!loading && spk) {
      // Manipulasi judul dokumen untuk penamaan file PDF
      const originalTitle = document.title;
      const safeNomorSPK = spk.nomorSPK ? spk.nomorSPK.replace(/\//g, '-') : 'UNHAS';
      const platNomor = spk.vehicle?.nomor_polisi ? spk.vehicle.nomor_polisi.replace(/\s+/g, '-') : 'TANPA-PLAT';
      document.title = `SPK_${safeNomorSPK}_${platNomor}`;

      const queryParams = new URLSearchParams(location.search);
      // Baik autoPrint maupun autoDownload sekarang memicu print native karena limitasi html2canvas
      if (queryParams.get('autoPrint') === 'true' || queryParams.get('autoDownload') === 'true') {
        setTimeout(() => {
          window.print();
        }, 800);
      }

      // Cleanup: mengembalikan judul dokumen semula ketika komponen dilepas (unmount)
      return () => {
        document.title = originalTitle;
      };
    }
  }, [loading, spk, location.search]);

  const handleDownloadPDF = () => {
    // Karena html2pdf.js tidak mendukung oklch (Tailwind v4),
    // kita memanggil fungsi print bawaan sebagai fallback.
    window.print();
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
        <p className="text-gray-500">Memuat dokumen...</p>
      </div>
    </div>
  );
  if (!spk) return <div className="p-8 text-center text-red-500 font-semibold">Data SPK tidak ditemukan.</div>;

  const kasiTU       = pejabat.find(p => p.kategori_peran === 'KASI_TU');
  const teknisi1     = pejabat.filter(p => p.kategori_peran === 'TEKNISI')[0];
  const teknisi2     = pejabat.filter(p => p.kategori_peran === 'TEKNISI')[1];
  const direktur     = pejabat.find(p => p.kategori_peran === 'DIREKTUR');
  const kepalaSubdit = pejabat.find(p => p.kategori_peran === 'KASUBDIT');

  const { vehicle: kendaraan, vendor } = spk;
  
  const parseJSON = (data, fallback) => {
    if (!data) return fallback;
    if (typeof data === 'string') {
      try { return JSON.parse(data); } catch { return fallback; }
    }
    return data;
  };

  const tabelPengecekan = parseJSON(spk.tabelPengecekan, []);
  const tabelPekerjaan  = parseJSON(spk.tabelPekerjaan, []);
  const daftarKerusakan = parseJSON(spk.daftarKerusakan, []);
  const listKerusakanAktif = daftarKerusakan.filter(item => item && item.trim() !== "");

  const pageClass = "bg-white text-black shadow-md mx-auto border border-gray-300 print:shadow-none print:border-none print:m-0 break-after-page last:break-after-auto text-xs w-[210mm] h-[297mm] print:h-auto print:min-h-[297mm] p-[20mm] box-border relative flex flex-col";

  const isAutoDownload = new URLSearchParams(location.search).get('autoDownload') === 'true';

  return (
    <div className={`min-h-screen pb-16 print:bg-white print:p-0 print:pb-0 ${isAutoDownload ? 'bg-white' : 'bg-gray-200'}`}>
      {!isAutoDownload && (
        <div className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center print:hidden sticky top-0 z-10 shadow-sm">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Pratinjau Dokumen SPK</h2>
            <p className="text-blue-600 font-mono text-sm mt-1">{spk.nomorSPK}</p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => navigate(-1)}
              className="bg-gray-100 border border-gray-300 hover:bg-gray-200 text-gray-700 px-5 py-2.5 rounded-lg font-bold shadow-sm transition-colors flex items-center gap-2"
            >
              ⬅️ Kembali
            </button>
            <button
              onClick={handleDownloadPDF}
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 rounded-lg font-bold shadow transition-colors flex items-center gap-2"
            >
              📥 Download PDF
            </button>
            <button
              onClick={() => window.print()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-bold shadow transition-colors flex items-center gap-2"
            >
              🖨️ Cetak Printer
            </button>
          </div>
        </div>
      )}

      <div id="print-container" className={`flex flex-col items-center print:gap-0 print:py-0 ${isAutoDownload ? 'gap-0 py-0' : 'gap-8 py-8'}`}>
        {/* LEMBAR 1 */}
        <div className={pageClass}>
          <KopSurat logoUrl={logoUrl} settings={kopSettings} />
          <table className="mb-6 w-full">
            <tbody>
              <tr>
                <td className="w-20 align-top">Kepada Yth.</td>
                <td className="align-top">:</td>
                <td>
                  <p className="font-semibold">Kepala Subdit. Kerumahtanggaan dan Keprotokolan</p>
                  <p>Universitas Hasanuddin</p>
                  <p>di Makassar</p>
                </td>
              </tr>
            </tbody>
          </table>

          <p className="mb-3 text-justify leading-relaxed">
            Dengan hormat dilaporkan bahwa kendaraan dinas operasional Universitas Hasanuddin:
          </p>

          <table className="mb-4 w-full">
            <tbody>
              <tr><td className="w-1/3 py-0.5">Nomor Polisi</td><td className="w-4">:</td><td className="font-bold">{kendaraan?.nomor_polisi}</td></tr>
              <tr><td className="py-0.5">Merek / Type</td><td>:</td><td>{kendaraan?.merek_type}</td></tr>
              <tr><td className="py-0.5">Jenis Kendaraan</td><td>:</td><td>{kendaraan?.jenis_kendaraan}</td></tr>
              <tr><td className="py-0.5">Nama Pengemudi</td><td>:</td><td>{kendaraan?.nama_sopir}</td></tr>
              <tr><td className="py-0.5">Tanggal Laporan</td><td>:</td><td>Makassar, {formatDate(spk.tanggalLaporan)}</td></tr>
            </tbody>
          </table>

          <p className="mb-2 font-semibold">Adapun dugaan kerusakan sebagai berikut:</p>
          <ol className="list-decimal pl-6 mb-4 space-y-1">
            {listKerusakanAktif.map((item, i) => (
              <li key={i} className="min-h-[20px] border-b border-gray-200 border-dotted w-full">
                {item}
              </li>
            ))}
          </ol>

          <p className="mt-6 mb-8 text-justify">
            Demikian laporan ini dibuat dengan sebenar-benarnya untuk dapat ditindaklanjuti sebagaimana mestinya.
          </p>

          <div className="mt-12 flex justify-end break-inside-avoid">
            <TTD
              label={`Makassar, ${formatDate(spk.tanggalLaporan)}\nSopir / Pengguna Kendaraan,`}
              nama={capitalizeEachWord(kendaraan?.nama_sopir)}
            />
          </div>
        </div>

        {/* LEMBAR 2 */}
        <div className={pageClass}>
          <KopSurat logoUrl={logoUrl} settings={kopSettings} />
          <table className="mb-4 w-full">
            <tbody>
              <tr>
                <td className="w-1/3 py-0.5">Tanggal</td>
                <td className="w-4">:</td>
                <td>Makassar, {formatDate(spk.tanggalLaporan)}</td>
              </tr>
              <tr>
                <td className="py-0.5 align-top">Kepada Yth.</td>
                <td className="align-top">:</td>
                <td>
                  <p>Kepala Seksi Tata Usaha dan Rumah Tangga</p>
                  <p>Universitas Hasanuddin</p>
                  <p>di Makassar</p>
                </td>
              </tr>
            </tbody>
          </table>

          <h3 className="text-center font-bold text-sm underline uppercase mb-6">
            Surat Pengantar Pemeriksaan Kendaraan Dinas
          </h3>

          <p className="mb-4 text-justify leading-relaxed">
            Bersama ini kami sampaikan bahwa berdasarkan bukti pengecekan fisik terlampir pada tanggal&nbsp;
            <span className="font-semibold">{formatDate(spk.tanggalLaporan)}</span>, mohon bantuan
            Tim Teknisi Kendaraan Dinas Universitas Hasanuddin untuk melakukan pemeriksaan/pengecekan fisik
            terhadap kendaraan dinas dengan data sebagai berikut:
          </p>

          <table className="mb-4 w-full ml-4">
            <tbody>
              <tr><td className="w-1/3 py-0.5">Nomor Polisi</td><td className="w-4">:</td><td className="font-bold">{kendaraan?.nomor_polisi}</td></tr>
              <tr><td className="py-0.5">Merek / Type</td><td>:</td><td>{kendaraan?.merek_type}</td></tr>
              <tr><td className="py-0.5">Jenis Kendaraan</td><td>:</td><td>{kendaraan?.jenis_kendaraan}</td></tr>
              <tr><td className="py-0.5">Pengguna / Sopir</td><td>:</td><td>{kendaraan?.nama_sopir}</td></tr>
            </tbody>
          </table>

          <p className="text-justify">
            Demikian surat pengantar ini dibuat untuk dapat ditindaklanjuti sebagaimana mestinya.
          </p>

          <div className="mt-12 flex justify-end pt-10 break-inside-avoid">
            <div className="text-right" style={{ width: '220px' }}>
              <p className="mb-2">Makassar, {formatDate(spk.tanggalLaporan)}</p>
              <p>{kasiTU?.jabatan || 'Kepala Seksi Tata Usaha dan RT'},</p>
              <div style={{ height: '70px' }}></div>
              <p className="font-bold underline">{kasiTU?.nama_lengkap || 'Jayadi Arifin, SE'}</p>
              <p>NIP. {kasiTU?.nip_nik || '197209162014091001'}</p>
            </div>
          </div>
        </div>

        {/* LEMBAR 3 */}
        <div className={pageClass}>
          <KopSurat logoUrl={logoUrl} settings={kopSettings} />
          <h3 className="text-center font-bold text-sm underline uppercase mb-4">
            Bukti Pengecekan / Pemeriksaan Fisik Kendaraan Dinas
          </h3>

          <table className="mb-4 w-full">
            <tbody>
              <tr><td className="w-1/3 py-0.5">Nomor Polisi</td><td className="w-4">:</td><td className="font-bold">{kendaraan?.nomor_polisi}</td></tr>
              <tr><td className="py-0.5">Merek / Type</td><td>:</td><td>{kendaraan?.merek_type}</td></tr>
              <tr><td className="py-0.5">Hari / Tanggal</td><td>:</td><td>{formatHariTanggal(spk.tanggalPengecekan)}</td></tr>
            </tbody>
          </table>

          <table className="w-full border-collapse border border-black mb-6 text-xs">
            <thead>
              <tr className="bg-gray-100">
                <th rowSpan="2" className="border border-black p-1.5 text-center w-8">No.</th>
                <th rowSpan="2" className="border border-black p-1.5 text-left">Komponen Yang Rusak</th>
                <th colSpan="2" className="border border-black p-1.5 text-center w-40">Rekomendasi Hasil Pemeriksaan</th>
                <th rowSpan="2" className="border border-black p-1.5 text-left w-40">Keterangan</th>
              </tr>
              <tr className="bg-gray-100">
                <th className="border border-black p-1.5 text-center w-20">Perbaikan</th>
                <th className="border border-black p-1.5 text-center w-20">Penggantian</th>
              </tr>
            </thead>
            <tbody>
              {tabelPengecekan.length > 0 ? tabelPengecekan.map((row, i) => (
                <tr key={i}>
                  <td className="border border-black p-1.5 text-center">{i + 1}</td>
                  <td className="border border-black p-1.5">{row.komponenRusak}</td>
                  <td className="border border-black p-1.5 text-center">{row.rekomendasi === 'Perbaikan' ? '✓' : ''}</td>
                  <td className="border border-black p-1.5 text-center">{row.rekomendasi === 'Penggantian' ? '✓' : ''}</td>
                  <td className="border border-black p-1.5">{row.keterangan}</td>
                </tr>
              )) : (
                Array.from({length: 5}).map((_, i) => (
                  <tr key={i} style={{ height: '22px' }}>
                    <td className="border border-black p-1 text-center text-gray-400">{i+1}</td>
                    <td className="border border-black p-1"></td>
                    <td className="border border-black p-1"></td>
                    <td className="border border-black p-1"></td>
                    <td className="border border-black p-1"></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="mt-12 pt-8 break-inside-avoid">
            <p className="mb-8">Demikian hasil pengecekan ini kami laporkan untuk dapat ditindaklanjuti.</p>
            <p className="font-semibold mb-4">Tim Teknisi Otomotif Unhas</p>
            <div className="flex flex-col gap-8">
              <div className="flex items-start">
                <div className="w-6">1.</div>
                <div className="w-48">
                  <p className="font-bold underline">{teknisi1?.nama_lengkap || 'Arifuddin, ST'}</p>
                  <p>NIK. {teknisi1?.nip_nik || '7371123008640002'}</p>
                </div>
                <div className="ml-4">(…… …………………………)</div>
              </div>
              <div className="flex items-start">
                <div className="w-6">2.</div>
                <div className="w-48">
                  <p className="font-bold underline">{teknisi2?.nama_lengkap || 'Syaripuddin, S.E'}</p>
                  <p>NIP. {teknisi2?.nip_nik || '198508272018015001'}</p>
                </div>
                <div className="ml-4">(…… …………………………)</div>
              </div>
            </div>
          </div>
        </div>

        {/* LEMBAR 4 */}
        <div className={pageClass}>
          <KopSurat logoUrl={logoUrl} settings={kopSettings} />
          <h3 className="text-center font-bold text-sm underline uppercase mb-0.5">
            PERMINTAAN PEMERIKSAAN / PERBAIKAN KENDARAAN
          </h3>
          <p className="text-center text-xs mb-4">Nomor: <span className="font-semibold">{spk.nomorSPK}</span></p>

          <table className="mb-3 w-full">
            <tbody>
              <tr>
                <td className="w-24 py-0.5 align-top">Kepada Yth.</td>
                <td className="w-4 align-top">:</td>
                <td>
                  <p className="font-semibold">{vendor?.nama_bengkel || '___________________'}</p>
                  <p>{vendor?.alamat_kontak || ''}</p>
                </td>
              </tr>
            </tbody>
          </table>

          <p className="mb-3 text-justify leading-relaxed">
            Mohon diperiksa/ diperbaiki Kendaraan Dinas Universitas Hasanuddin:
          </p>

          <table className="mb-3 w-full ml-4">
            <tbody>
              <tr><td className="w-1/3 py-0.5">Nomor Polisi</td><td className="w-4">:</td><td className="font-bold">{kendaraan?.nomor_polisi}</td></tr>
              <tr><td className="py-0.5">Merek / Type</td><td>:</td><td>{kendaraan?.merek_type}</td></tr>
              <tr><td className="py-0.5">Jenis Kendaraan</td><td>:</td><td>{kendaraan?.jenis_kendaraan}</td></tr>
              <tr><td className="py-0.5">Pengguna / Sopir</td><td>:</td><td>{kendaraan?.nama_sopir}</td></tr>
            </tbody>
          </table>

          <p className="mb-1 font-semibold">Adapun pekerjaan yang dimohonkan:</p>
          <ol className="list-decimal pl-6 mb-4 space-y-0.5">
            {listKerusakanAktif.map((item, i) => <li key={i}>{item}</li>)}
          </ol>

          <p className="text-justify">
            Demikian surat permintaan ini disampaikan, atas perhatian dan kerja samanya diucapkan terima kasih.
          </p>

          <div className="mt-12 pt-6 mb-4 break-inside-avoid">
            <p className="mb-1 text-center">Makassar, {formatDate(spk.tanggalPersetujuan)}</p>
            <p className="font-semibold mb-3 text-center">Disetujui:</p>
            <div className="grid grid-cols-2 gap-8">
              <div className="text-center">
                <p className="text-xs">Direktur Komunikasi /</p>
                <p className="text-xs">Sekretariat Rektor,</p>
                <div style={{ height: '70px' }}></div>
                <p className="font-bold underline text-xs">{direktur?.nama_lengkap || 'Dr. Sawedi Muhammad, S.Sos., M.Sc'}</p>
                <p className="text-xs">NIP. {direktur?.nip_nik || '197109082022043001'}</p>
              </div>
              <div className="text-center">
                <p className="text-xs">Kepala Subdit. Kerumahtanggaan</p>
                <p className="text-xs">dan Keprotokolan,</p>
                <div style={{ height: '70px' }}></div>
                <p className="font-bold underline text-xs">{kepalaSubdit?.nama_lengkap || 'Baharuddin, S.S., M. Si.'}</p>
                <p className="text-xs">NIP. {kepalaSubdit?.nip_nik || '197512172014091003'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* LEMBAR 5 */}
        <div className={pageClass}>
          <KopSurat logoUrl={logoUrl} settings={kopSettings} />
          <h3 className="text-center font-bold text-sm underline uppercase mb-4">
            Tanda Terima Pekerjaan Perbaikan Kendaraan Dinas
          </h3>

          <p className="mb-3 text-justify leading-relaxed">
            Pada hari ini,{' '}
            <span className="font-semibold">{formatHariTanggal(spk.tanggalMasukBengkel)}</span>{' '}
            atau{' '}
            <span className="font-semibold italic">{formatTanggalTerbilang(spk.tanggalMasukBengkel)}</span>,
            telah diserahterimakan kendaraan dinas sebagai berikut:
          </p>

          <table className="mb-3 w-full ml-4">
            <tbody>
              <tr><td className="w-1/3 py-0.5">Nomor Polisi (DD)</td><td className="w-4">:</td><td className="font-bold">{kendaraan?.nomor_polisi}</td></tr>
              <tr><td className="py-0.5">Jenis Kendaraan</td><td>:</td><td>{kendaraan?.jenis_kendaraan}</td></tr>
              <tr><td className="py-0.5">Merek / Type</td><td>:</td><td>{kendaraan?.merek_type}</td></tr>
              <tr><td className="py-0.5">Masuk Tanggal</td><td>:</td><td>{formatDate(spk.tanggalMasukBengkel)}</td></tr>
              <tr><td className="py-0.5">Garansi Perbaikan</td><td>:</td><td className="font-semibold">{spk.masaGaransi || '—'}</td></tr>
            </tbody>
          </table>

          <p className="mb-1 font-semibold">Tabel Pekerjaan:</p>
          <table className="w-full border-collapse border border-black mb-4 text-xs">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-black p-1.5 text-center w-8">No.</th>
                <th className="border border-black p-1.5 text-left">Jenis Pekerjaan & Spesifikasi</th>
                <th className="border border-black p-1.5 text-center w-20">Satuan</th>
                <th className="border border-black p-1.5 text-center w-20">Kuantitas</th>
              </tr>
            </thead>
            <tbody>
              {spk.tabelPekerjaanType === 'Manual' ? (
                Array.from({length: 8}).map((_, i) => (
                  <tr key={i} style={{ height: '24px' }}>
                    <td className="border border-black p-1.5"></td>
                    <td className="border border-black p-1.5"></td>
                    <td className="border border-black p-1.5"></td>
                    <td className="border border-black p-1.5"></td>
                  </tr>
                ))
              ) : tabelPekerjaan.length > 0 ? tabelPekerjaan.map((row, i) => (
                <tr key={i}>
                  <td className="border border-black p-1.5 text-center">{i + 1}</td>
                  <td className="border border-black p-1.5">{row.jenisPekerjaan}</td>
                  <td className="border border-black p-1.5 text-center">{row.satuan}</td>
                  <td className="border border-black p-1.5 text-center">{row.kuantitas}</td>
                </tr>
              )) : Array.from({length: 4}).map((_, i) => (
                <tr key={i} style={{ height: '22px' }}>
                  <td className="border border-black p-1 text-center text-gray-400">{i+1}</td>
                  <td className="border border-black p-1"></td>
                  <td className="border border-black p-1"></td>
                  <td className="border border-black p-1"></td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-6 pt-4 border-t border-gray-400 break-inside-avoid">
            <div className="grid grid-cols-2 gap-8 mb-4">
              <div className="text-center">
                <p className="text-xs">Yang Menerima,</p>
                <p className="text-xs font-semibold">Sopir / Pengguna</p>
                <div style={{ height: '50px' }}></div>
                {spk.penerimaType === 'Manual' ? (
                  <p className="text-xs">(.........................................)</p>
                ) : (
                  <p className="font-bold underline text-xs">{capitalizeEachWord(kendaraan?.nama_sopir) || '___________________'}</p>
                )}
              </div>
              <div className="text-center">
                <p className="text-xs">Yang Menyerahkan,</p>
                <p className="text-xs font-semibold">Pihak Bengkel</p>
                <div style={{ height: '50px' }}></div>
                <p className="text-xs">(.........................................)</p>
                <p className="font-bold text-xs mt-1">{vendor?.nama_bengkel || '___________________'}</p>
              </div>
            </div>
            
            <div className="mt-6 flex justify-between text-left">
              
              {/* Kolom Kiri: Tim Teknisi Unhas */}
              <div className="w-1/2 pr-4">
                <p className="font-semibold mb-4">Tim Teknisi Unhas</p>
                <div className="flex flex-col gap-4">
                  <div className="flex items-start">
                    <div className="w-40">
                      <p className="font-bold underline text-xs">{teknisi1?.nama_lengkap || 'Arifuddin, ST'}</p>
                      <p className="text-xs">NIK. {teknisi1?.nip_nik || '7371123008640002'}</p>
                    </div>
                    <div className="text-xs">(……………………)</div>
                  </div>
                  <div className="flex items-start">
                    <div className="w-40">
                      <p className="font-bold underline text-xs">{teknisi2?.nama_lengkap || 'Syaripuddin, S.E'}</p>
                      <p className="text-xs">NIP. {teknisi2?.nip_nik || '198508272018015001'}</p>
                    </div>
                    <div className="text-xs">(……………………)</div>
                  </div>
                </div>
              </div>

              {/* Kolom Kanan: Mengetahui & Kepala Subdit */}
              <div className="w-1/2 text-center">
                <p className="font-semibold text-xs mb-1">Mengetahui:</p>
                <p>Kepala Subdit. Kerumahtanggaan<br/>dan Keprotokolan,</p>
                <div className="mt-10">
                  <p className="font-bold underline text-xs">{kepalaSubdit?.nama_lengkap || 'Baharuddin, S.S., M. Si.'}</p>
                  <p className="text-xs">NIP. {kepalaSubdit?.nip_nik || '197512172014091003'}</p>
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default PrintSPK;
