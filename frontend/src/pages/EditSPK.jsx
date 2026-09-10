import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || (import.meta.env.PROD ? '' : 'http://localhost:5000');
const API = import.meta.env.VITE_API_URL || `${API_BASE}/api/v1`;

// Komponen untuk satu baris tabel pengecekan (Lembar 3)
const RowPengecekan = ({ row, index, onChange, onRemove }) => (
  <tr className="border-b border-gray-200">
    <td className="p-2 text-center text-gray-500 w-8">{index + 1}</td>
    <td className="p-2">
      <input
        type="text"
        className="w-full p-1.5 border border-gray-300 rounded text-sm focus:ring-blue-500 focus:border-blue-500"
        placeholder="Nama komponen yang rusak..."
        value={row.komponenRusak}
        onChange={e => onChange(index, 'komponenRusak', e.target.value)}
      />
    </td>
    <td className="p-2 w-40">
      <select
        className="w-full p-1.5 border border-gray-300 rounded text-sm"
        value={row.rekomendasi}
        onChange={e => onChange(index, 'rekomendasi', e.target.value)}
      >
        <option value="">-- Pilih --</option>
        <option value="Perbaikan">Perbaikan</option>
        <option value="Penggantian">Penggantian</option>
        <option value="Perbaikan & Penggantian">Perbaikan & Penggantian</option>
      </select>
    </td>
    <td className="p-2">
      <input
        type="text"
        className="w-full p-1.5 border border-gray-300 rounded text-sm"
        placeholder="Keterangan tambahan..."
        value={row.keterangan}
        onChange={e => onChange(index, 'keterangan', e.target.value)}
      />
    </td>
    <td className="p-2 text-center w-10">
      <button type="button" onClick={() => onRemove(index)} className="text-red-400 hover:text-red-600 font-bold text-lg leading-none">×</button>
    </td>
  </tr>
);

// Komponen untuk satu baris tabel pekerjaan (Lembar 5)
const RowPekerjaan = ({ row, index, onChange, onRemove }) => (
  <tr className="border-b border-gray-200">
    <td className="p-2 text-center text-gray-500 w-8">{index + 1}</td>
    <td className="p-2">
      <input
        type="text"
        className="w-full p-1.5 border border-gray-300 rounded text-sm"
        placeholder="Jenis pekerjaan dan spesifikasi..."
        value={row.jenisPekerjaan}
        onChange={e => onChange(index, 'jenisPekerjaan', e.target.value)}
      />
    </td>
    <td className="p-2 w-28">
      <input
        type="text"
        className="w-full p-1.5 border border-gray-300 rounded text-sm"
        placeholder="Unit, Ls..."
        value={row.satuan}
        onChange={e => onChange(index, 'satuan', e.target.value)}
      />
    </td>
    <td className="p-2 w-24">
      <input
        type="number"
        className="w-full p-1.5 border border-gray-300 rounded text-sm"
        placeholder="1"
        value={row.kuantitas}
        onChange={e => onChange(index, 'kuantitas', e.target.value)}
      />
    </td>
    <td className="p-2 text-center w-10">
      <button type="button" onClick={() => onRemove(index)} className="text-red-400 hover:text-red-600 font-bold text-lg leading-none">×</button>
    </td>
  </tr>
);

const EditSPK = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [kendaraans, setKendaraans] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [signatories, setSignatories] = useState([]);
  const [nomorUrut, setNomorUrut] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    kendaraanId: '',
    vendorId: '',
    tanggalLaporan: new Date().toISOString().split('T')[0],
    daftarKerusakan: [''],
    // Lembar 3
    tanggalPengecekan: '',
    tabelPengecekan: [{ komponenRusak: '', rekomendasi: '', keterangan: '' }],
    // Lembar 4
    tanggalPersetujuan: '',
    // Lembar 5
    tanggalMasukBengkel: '',
    masaGaransi: '',
    penerimaType: 'Otomatis',
    tabelPekerjaanType: 'Otomatis',
    tabelPekerjaan: [{ jenisPekerjaan: '', satuan: '', kuantitas: '' }],
  });

  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        const [resK, resV, resS, resSPK] = await Promise.all([
          axios.get(`${API}/vehicles`),
          axios.get(`${API}/vendors`),
          axios.get(`${API}/signatories`),
          axios.get(`${API}/spk/${id}`)
        ]);
        setKendaraans(resK.data);
        setVendors(resV.data);
        setSignatories(resS.data);
        
        const spk = resSPK.data;
        const parseJSON = (str, fallback) => {
          if (!str) return fallback;
          if (typeof str === 'string') {
            try { return JSON.parse(str); } catch { return fallback; }
          }
          return str;
        };
        
        setNomorUrut(spk.nomorUrut.toString());
        setFormData({
          kendaraanId: spk.vehicleId.toString(),
          vendorId: spk.vendorId.toString(),
          tanggalLaporan: spk.tanggalLaporan,
          daftarKerusakan: parseJSON(spk.daftarKerusakan, ['']),
          tanggalPengecekan: spk.tanggalPengecekan || '',
          tabelPengecekan: parseJSON(spk.tabelPengecekan, [{ komponenRusak: '', rekomendasi: '', keterangan: '' }]),
          tanggalPersetujuan: spk.tanggalPersetujuan || '',
          tanggalMasukBengkel: spk.tanggalMasukBengkel || '',
          masaGaransi: spk.masaGaransi || '',
          penerimaType: spk.penerimaType || 'Otomatis',
          tabelPekerjaanType: spk.tabelPekerjaanType || 'Otomatis',
          tabelPekerjaan: parseJSON(spk.tabelPekerjaan, [{ jenisPekerjaan: '', satuan: '', kuantitas: '' }])
        });
      } catch (error) {
        console.error('Error fetching master data:', error);
        setErrorMsg('Gagal memuat data SPK.');
      }
    };
    fetchMasterData();
  }, [id]);

  const selectedKendaraan = kendaraans.find(k => k.id.toString() === formData.kendaraanId);

  // Handlers: Daftar Kerusakan
  const handleKerusakanChange = (i, val) => {
    const newDaftar = [...formData.daftarKerusakan];
    newDaftar[i] = val;
    
    // Auto-sync ke tabel pengecekan (Lembar 3) dan tabel pekerjaan (Lembar 5) jika index ada
    const newPengecekan = [...formData.tabelPengecekan];
    if (newPengecekan[i]) {
      newPengecekan[i] = { ...newPengecekan[i], komponenRusak: val };
    }

    const newPekerjaan = [...formData.tabelPekerjaan];
    if (newPekerjaan[i]) {
      newPekerjaan[i] = { ...newPekerjaan[i], jenisPekerjaan: val };
    }

    setFormData({ 
      ...formData, 
      daftarKerusakan: newDaftar,
      tabelPengecekan: newPengecekan,
      tabelPekerjaan: newPekerjaan
    });
  };

  const addKerusakan = () => {
    setFormData({ 
      ...formData, 
      daftarKerusakan: [...formData.daftarKerusakan, ''],
      tabelPengecekan: [...formData.tabelPengecekan, { komponenRusak: '', rekomendasi: '', keterangan: '' }],
      tabelPekerjaan: [...formData.tabelPekerjaan, { jenisPekerjaan: '', satuan: '', kuantitas: '' }]
    });
  };

  const removeKerusakan = (i) => {
    const newDaftar = formData.daftarKerusakan.filter((_, idx) => idx !== i);
    const newPengecekan = formData.tabelPengecekan.filter((_, idx) => idx !== i);
    const newPekerjaan = formData.tabelPekerjaan.filter((_, idx) => idx !== i);
    
    setFormData({ 
      ...formData, 
      daftarKerusakan: newDaftar.length ? newDaftar : [''],
      tabelPengecekan: newPengecekan.length ? newPengecekan : [{ komponenRusak: '', rekomendasi: '', keterangan: '' }],
      tabelPekerjaan: newPekerjaan.length ? newPekerjaan : [{ jenisPekerjaan: '', satuan: '', kuantitas: '' }]
    });
  };

  // Handlers: Tabel Pengecekan
  const handlePengecekanChange = (i, field, val) => {
    const arr = [...formData.tabelPengecekan];
    arr[i] = { ...arr[i], [field]: val };
    setFormData({ ...formData, tabelPengecekan: arr });
  };
  const addPengecekan = () => setFormData({ ...formData, tabelPengecekan: [...formData.tabelPengecekan, { komponenRusak: '', rekomendasi: '', keterangan: '' }] });
  const removePengecekan = (i) => {
    const arr = formData.tabelPengecekan.filter((_, idx) => idx !== i);
    setFormData({ ...formData, tabelPengecekan: arr.length ? arr : [{ komponenRusak: '', rekomendasi: '', keterangan: '' }] });
  };

  // Handlers: Tabel Pekerjaan
  const handlePekerjaanChange = (i, field, val) => {
    const arr = [...formData.tabelPekerjaan];
    arr[i] = { ...arr[i], [field]: val };
    setFormData({ ...formData, tabelPekerjaan: arr });
  };
  const addPekerjaan = () => setFormData({ ...formData, tabelPekerjaan: [...formData.tabelPekerjaan, { jenisPekerjaan: '', satuan: '', kuantitas: '' }] });
  const removePekerjaan = (i) => {
    const arr = formData.tabelPekerjaan.filter((_, idx) => idx !== i);
    setFormData({ ...formData, tabelPekerjaan: arr.length ? arr : [{ jenisPekerjaan: '', satuan: '', kuantitas: '' }] });
  };

  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');
    try {
      const payload = { ...formData, vehicleId: formData.kendaraanId, nomorUrutInput: nomorUrut };
      await axios.put(`${API}/spk/${id}`, payload);
      navigate(`/print/${id}`);
    } catch (error) {
      if (!error.response) {
        setErrorMsg('Gagal terhubung ke server (Network Error). Pastikan backend aktif.');
      } else {
        const dataErr = error.response?.data?.error || error.response?.data?.message;
        setErrorMsg(`Gagal membuat SPK: ${typeof dataErr === 'string' ? dataErr : JSON.stringify(dataErr) || error.message}`);
      }
      console.error(error);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmitting(false);
    }
  };

  const direktur = signatories.find(s => s.kategori_peran === 'DIREKTUR');
  const kasubdit = signatories.find(s => s.kategori_peran === 'KASUBDIT');

  const inputClass = "w-full p-2.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors";
  const readonlyClass = "w-full p-2.5 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700 font-medium";
  const sectionClass = "bg-white p-6 rounded-xl border border-gray-200 shadow-sm";
  const labelClass = "block text-sm font-semibold text-gray-700 mb-1.5";

  const ErrorAlert = () => errorMsg ? (
    <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 text-sm text-red-700 rounded-r shadow-sm">
      <p className="font-bold">Error!</p>
      <p>{errorMsg}</p>
    </div>
  ) : null;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-700 to-green-500 text-white p-6 rounded-xl mb-6 shadow-lg">
        <h2 className="text-2xl font-bold">Edit SPK Perbaikan Kendaraan</h2>
        <p className="text-green-100 text-sm mt-1">Lakukan perubahan pada form ini untuk menimpa data SPK yang lama</p>
      </div>

      <ErrorAlert />

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* SECTION 1: Data Kendaraan */}
        <div className={sectionClass}>
          <div className="flex items-center gap-2 mb-5">
            <span className="bg-blue-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">1</span>
            <h3 className="text-lg font-bold text-gray-800">Data Kendaraan & Pelapor</h3>
            <span className="ml-auto text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full">Trigger Otomatisasi</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className={labelClass}>Nomor Polisi <span className="text-red-500">*</span></label>
              <select className={inputClass} value={formData.kendaraanId} onChange={e => setFormData({ ...formData, kendaraanId: e.target.value })} required>
                <option value="">-- Pilih No. Polisi --</option>
                {kendaraans.map(k => (
                  <option key={k.id} value={k.id}>{k.nomor_polisi} — {k.merek_type}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Tanggal Laporan <span className="text-red-500">*</span></label>
              <input type="date" className={inputClass} value={formData.tanggalLaporan} onChange={e => setFormData({ ...formData, tanggalLaporan: e.target.value })} required />
            </div>
            <div>
              <label className={labelClass}>Merek / Type <span className="text-xs font-normal text-blue-500">(Auto)</span></label>
              <input type="text" readOnly className={readonlyClass} value={selectedKendaraan?.merek_type || '—'} />
            </div>
            <div>
              <label className={labelClass}>Jenis Kendaraan <span className="text-xs font-normal text-blue-500">(Auto)</span></label>
              <input type="text" readOnly className={readonlyClass} value={selectedKendaraan?.jenis_kendaraan || '—'} />
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>Nama Sopir / Pengguna <span className="text-xs font-normal text-blue-500">(Auto)</span></label>
              <input type="text" readOnly className={readonlyClass} value={selectedKendaraan?.nama_sopir || '—'} />
            </div>
          </div>
        </div>

        {/* SECTION 2: Daftar Kerusakan (Lembar 1 & 4) */}
        <div className={sectionClass}>
          <div className="flex items-center gap-2 mb-5">
            <span className="bg-blue-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">2</span>
            <h3 className="text-lg font-bold text-gray-800">Daftar Dugaan Kerusakan</h3>
            <span className="ml-auto text-xs text-gray-500">Lembar 1 & 4</span>
          </div>
          <div className="space-y-2">
            {formData.daftarKerusakan.map((kerusakan, i) => (
              <div key={i} className="flex gap-2 items-center">
                <span className="text-sm font-bold text-gray-500 w-6 text-right shrink-0">{i + 1}.</span>
                <input
                  type="text"
                  className={`flex-1 p-2.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                  placeholder="Deskripsi kerusakan..."
                  value={kerusakan}
                  onChange={e => handleKerusakanChange(i, e.target.value)}
                  required
                />
                {formData.daftarKerusakan.length > 1 && (
                  <button type="button" onClick={() => removeKerusakan(i)} className="text-red-400 hover:text-red-600 font-bold text-xl w-6">×</button>
                )}
              </div>
            ))}
          </div>
          {formData.daftarKerusakan.length < 17 && (
            <button type="button" onClick={addKerusakan} className="mt-3 text-sm text-blue-600 font-semibold hover:underline">
              + Tambah Kerusakan
            </button>
          )}
        </div>

        {/* SECTION 3: Pengecekan Fisik (Lembar 3) */}
        <div className={sectionClass}>
          <div className="flex items-center gap-2 mb-5">
            <span className="bg-blue-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">3</span>
            <h3 className="text-lg font-bold text-gray-800">Hasil Pengecekan / Pemeriksaan Fisik</h3>
            <span className="ml-auto text-xs text-gray-500">Lembar 3</span>
          </div>
          <div className="mb-4">
            <label className={labelClass}>Hari / Tanggal Pemeriksaan</label>
            <input type="date" className={`${inputClass} max-w-xs`} value={formData.tanggalPengecekan} onChange={e => setFormData({ ...formData, tanggalPengecekan: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>Tabel Pengecekan Komponen</label>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="border-b border-gray-200">
                    <th className="p-2 text-center w-8">#</th>
                    <th className="p-2 text-left">Komponen Yang Rusak</th>
                    <th className="p-2 text-left w-40">Rekomendasi</th>
                    <th className="p-2 text-left">Keterangan</th>
                    <th className="p-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {formData.tabelPengecekan.map((row, i) => (
                    <RowPengecekan key={i} row={row} index={i} onChange={handlePengecekanChange} onRemove={removePengecekan} />
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={addPengecekan} className="mt-2 text-sm text-blue-600 font-semibold hover:underline">
              + Tambah Baris
            </button>
          </div>
        </div>

        {/* SECTION 4: Persetujuan & Bengkel (Lembar 4) */}
        <div className={sectionClass}>
          <div className="flex items-center gap-2 mb-5">
            <span className="bg-blue-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">4</span>
            <h3 className="text-lg font-bold text-gray-800">Persetujuan & Penunjukan Bengkel</h3>
            <span className="ml-auto text-xs text-gray-500">Lembar 4</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className={labelClass}>Nomor Surat Perintah Kerja (SPK) <span className="text-red-500">*</span></label>
              <div className="flex border border-gray-300 rounded-md overflow-hidden shadow-sm">
                <input
                  type="text"
                  className="w-24 p-2.5 text-sm font-mono text-center focus:outline-none focus:ring-0"
                  value={nomorUrut}
                  onChange={e => setNomorUrut(e.target.value)}
                  required
                />
                <div className="bg-gray-200 text-gray-600 px-4 py-2.5 text-sm flex-1 font-mono border-l border-gray-300">
                  /RT/P-Kend/{new Date().getFullYear()}
                </div>
              </div>
            </div>
            <div>
              <label className={labelClass}>Tujuan Bengkel / Vendor <span className="text-red-500">*</span></label>
              <select className={inputClass} value={formData.vendorId} onChange={e => setFormData({ ...formData, vendorId: e.target.value })} required>
                <option value="">-- Pilih Bengkel --</option>
                {vendors.map(v => (
                  <option key={v.id} value={v.id}>{v.nama_bengkel}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Tanggal Persetujuan</label>
              <input type="date" className={inputClass} value={formData.tanggalPersetujuan} onChange={e => setFormData({ ...formData, tanggalPersetujuan: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>Penandatangan Kolom "Disetujui" <span className="text-xs font-normal text-blue-500">(Auto)</span></label>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700 space-y-1">
                <p className="font-semibold">{direktur?.nama_lengkap || 'Dr. Sawedi Muhammad, S.Sos., M.Sc'}</p>
                <p className="text-xs">{direktur?.jabatan || 'Direktur Komunikasi / Sekretariat Rektor'}</p>
                <p className="font-semibold mt-1">{kasubdit?.nama_lengkap || 'Baharuddin, S.S., M. Si.'}</p>
                <p className="text-xs">{kasubdit?.jabatan || 'Kepala Subdit. Kerumahtanggaan dan Keprotokolan'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 5: Tanda Terima Pekerjaan (Lembar 5) */}
        <div className={sectionClass}>
          <div className="flex items-center gap-2 mb-5">
            <span className="bg-blue-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">5</span>
            <h3 className="text-lg font-bold text-gray-800">Tanda Terima Pekerjaan Perbaikan</h3>
            <span className="ml-auto text-xs text-gray-500">Lembar 5</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
            <div>
              <label className={labelClass}>Masuk Tanggal</label>
              <input type="date" className={inputClass} value={formData.tanggalMasukBengkel} onChange={e => setFormData({ ...formData, tanggalMasukBengkel: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>Garansi Perbaikan / Pemeliharaan</label>
              <input type="text" className={inputClass} placeholder="Contoh: 1 (satu) bulan" value={formData.masaGaransi} onChange={e => setFormData({ ...formData, masaGaransi: e.target.value })} />
            </div>
            <div className="md:col-span-3">
              <label className={labelClass}>Pengisian Nama "Yang Menerima" (Sopir/Pengguna)</label>
              <select className={inputClass} value={formData.penerimaType} onChange={e => setFormData({ ...formData, penerimaType: e.target.value })}>
                <option value="Otomatis">Otomatis (Tercetak Nama Sopir)</option>
                <option value="Manual">Manual (.........................................)</option>
              </select>
            </div>
            <div className="md:col-span-3">
              <label className={labelClass}>Pengisian Tabel Pekerjaan</label>
              <select className={inputClass} value={formData.tabelPekerjaanType} onChange={e => setFormData({ ...formData, tabelPekerjaanType: e.target.value })}>
                <option value="Otomatis">Otomatis (Sesuai Daftar Kerusakan)</option>
                <option value="Manual">Manual (Dikosongkan untuk tulis tangan)</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass}>Tabel Pekerjaan</label>
            {formData.tabelPekerjaanType === 'Manual' ? (
              <div className="p-5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500 text-center italic">
                Tabel pekerjaan akan dicetak kosong dengan baris tambahan agar dapat diisi secara manual menggunakan tulisan tangan.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr className="border-b border-gray-200">
                        <th className="p-2 text-center w-8">#</th>
                        <th className="p-2 text-left">Jenis Pekerjaan & Spesifikasi</th>
                        <th className="p-2 text-left w-28">Satuan</th>
                        <th className="p-2 text-left w-24">Kuantitas</th>
                        <th className="p-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.tabelPekerjaan.map((row, i) => (
                        <RowPekerjaan key={i} row={row} index={i} onChange={handlePekerjaanChange} onRemove={removePekerjaan} />
                      ))}
                    </tbody>
                  </table>
                </div>
                <button type="button" onClick={addPekerjaan} className="mt-2 text-sm text-blue-600 font-semibold hover:underline">
                  + Tambah Baris
                </button>
              </>
            )}
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-4 pb-8">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="bg-gray-100 border border-gray-300 text-gray-700 px-8 py-3.5 rounded-xl font-bold text-base hover:bg-gray-200 transition-all shadow-sm"
          >
            ⬅️ Kembali
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="bg-green-600 text-white px-10 py-3.5 rounded-xl font-bold text-base hover:bg-green-700 disabled:opacity-60 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 transform"
          >
            {submitting ? 'Menyimpan Pembaruan...' : '💾 Simpan Pembaruan & Lihat Pratinjau Cetak'}
          </button>
        </div>

      </form>
    </div>
  );
};

export default EditSPK;
