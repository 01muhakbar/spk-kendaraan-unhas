import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Select from 'react-select';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

const ModulLegalitas = ({ vehicles, setVehicles }) => {
  const [activeTab, setActiveTab] = useState('jatuh-tempo');
  const [riwayat, setRiwayat] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showModal, setShowModal] = useState(false);
  
  const [formData, setFormData] = useState({
    vehicleId: '',
    jenisPengurusan: 'PAJAK_1_TAHUN',
    tanggalPembayaran: new Date().toISOString().split('T')[0],
    biayaPengurusan: '',
    dokumenBuktiUrl: ''
  });

  const fetchRiwayat = async () => {
    try {
      const res = await axios.get(`${API}/legalitas/riwayat`);
      setRiwayat(res.data);
    } catch (err) {
      console.error("Gagal mengambil riwayat:", err);
    }
  };

  useEffect(() => {
    if (activeTab === 'selesai' || activeTab === 'tco') {
      fetchRiwayat();
    }
  }, [activeTab]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await axios.post(`${API}/legalitas`, formData);
      setSuccessMsg(res.data.message);
      setShowModal(false);
      
      // Update vehicles in the parent component locally to avoid full fetch
      setVehicles(prev => prev.map(v => {
        if (v.id === formData.vehicleId) {
          // just marking it active, full refresh should ideally happen
          return { ...v, status_legalitas: 'AKTIF' };
        }
        return v;
      }));

    } catch (err) {
      setErrorMsg(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const getUrgentVehicles = () => {
    return vehicles.filter(v => v.status_legalitas === 'WARNING' || v.status_legalitas === 'EXPIRED');
  };

  const tabClass = (tab) => `flex-1 py-3 px-4 text-center font-semibold text-sm transition-all border-b-2 ${activeTab === tab ? 'border-blue-600 text-blue-700 bg-blue-50' : 'border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`;

  return (
    <div className="bg-white rounded-lg p-2">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-bold">Papan Kerja Pengurusan Legalitas</h2>
          <p className="text-sm text-gray-500">Kelola pajak tahunan dan pergantian plat 5 tahunan kendaraan dinas.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700">
          + Proses Pembayaran
        </button>
      </div>

      {errorMsg && <div className="bg-red-50 text-red-700 p-3 rounded mb-4">{errorMsg}</div>}
      {successMsg && <div className="bg-green-50 text-green-700 p-3 rounded mb-4">{successMsg}</div>}

      <div className="flex border-b mb-4">
        <button onClick={() => setActiveTab('jatuh-tempo')} className={tabClass('jatuh-tempo')}>Jatuh Tempo ({getUrgentVehicles().length})</button>
        <button onClick={() => setActiveTab('selesai')} className={tabClass('selesai')}>Selesai (Riwayat)</button>
        <button onClick={() => setActiveTab('tco')} className={tabClass('tco')}>Laporan TCO</button>
      </div>

      {activeTab === 'tco' && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-3">No. Polisi</th>
                <th className="p-3">Merek / Type</th>
                <th className="p-3">Total Biaya SPK (YTD)</th>
                <th className="p-3">Total Biaya Legalitas (YTD)</th>
                <th className="p-3">Grand Total Beban</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map(v => {
                const vehicleRiwayat = riwayat.filter(r => r.vehicleId === v.id && r.tanggal_pembayaran.startsWith(new Date().getFullYear().toString()));
                const totalLegalitas = vehicleRiwayat.reduce((sum, curr) => sum + curr.biaya_pengurusan, 0);
                const totalSpk = 0; // Belum ada modul biaya di SPK
                const grandTotal = totalSpk + totalLegalitas;
                
                if (grandTotal === 0) return null; // Sembunyikan kendaraan dengan 0 biaya untuk fokus pada laporan

                return (
                  <tr key={v.id} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-bold">{v.nomor_polisi}</td>
                    <td className="p-3">{v.merek_type}</td>
                    <td className="p-3 text-gray-400">Rp 0 (Belum Tersedia)</td>
                    <td className="p-3">Rp {totalLegalitas.toLocaleString('id-ID')}</td>
                    <td className="p-3 font-bold text-red-600">Rp {grandTotal.toLocaleString('id-ID')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'jatuh-tempo' && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-3">No. Polisi</th>
                <th className="p-3">Merek / Type</th>
                <th className="p-3">Jatuh Tempo Pajak</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {getUrgentVehicles().map(v => (
                <tr key={v.id} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-bold">{v.nomor_polisi}</td>
                  <td className="p-3">{v.merek_type}</td>
                  <td className="p-3">{v.tgl_jatuh_tempo_pajak || '-'}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${v.status_legalitas === 'EXPIRED' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {v.status_legalitas}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <button 
                      onClick={() => {
                        setFormData({ ...formData, vehicleId: v.id });
                        setShowModal(true);
                      }}
                      className="bg-green-100 text-green-700 px-3 py-1 rounded font-semibold text-xs hover:bg-green-200"
                    >
                      Bayar
                    </button>
                  </td>
                </tr>
              ))}
              {getUrgentVehicles().length === 0 && (
                <tr>
                  <td colSpan="5" className="p-6 text-center text-gray-500">
                    Semua kendaraan dalam kondisi pajak aman.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'selesai' && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-3">Tgl Pembayaran</th>
                <th className="p-3">No. Polisi</th>
                <th className="p-3">Jenis Pengurusan</th>
                <th className="p-3">Biaya</th>
                <th className="p-3 text-center">Bukti Dokumen</th>
              </tr>
            </thead>
            <tbody>
              {riwayat.map(r => (
                <tr key={r.id} className="border-b hover:bg-gray-50">
                  <td className="p-3">{r.tanggal_pembayaran}</td>
                  <td className="p-3 font-bold">{r.vehicle?.nomor_polisi}</td>
                  <td className="p-3">{r.jenis_pengurusan === 'PAJAK_1_TAHUN' ? 'Pajak Tahunan' : 'Ganti Plat 5 Tahun'}</td>
                  <td className="p-3">Rp {r.biaya_pengurusan.toLocaleString('id-ID')}</td>
                  <td className="p-3 text-center">
                    {r.bukti_dokumen_url ? (
                      <a href={r.bukti_dokumen_url} target="_blank" rel="noreferrer" className="text-blue-600 underline">Lihat</a>
                    ) : '-'}
                  </td>
                </tr>
              ))}
              {riwayat.length === 0 && (
                <tr>
                  <td colSpan="5" className="p-6 text-center text-gray-500">Belum ada riwayat pembayaran.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Pembayaran */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold mb-4">Proses Pembayaran Pajak</h3>
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="block text-xs font-semibold mb-1 text-gray-600">Pilih Kendaraan</label>
                <Select 
                  options={vehicles.map(v => ({ value: v.id, label: `${v.nomor_polisi} - ${v.merek_type}` }))}
                  value={vehicles.map(v => ({ value: v.id, label: `${v.nomor_polisi} - ${v.merek_type}` })).find(opt => opt.value.toString() === formData.vehicleId?.toString()) || null}
                  onChange={selected => setFormData({...formData, vehicleId: selected ? selected.value : ''})}
                  placeholder="-- Cari/Pilih Kendaraan --"
                  isClearable
                  styles={{ 
                    control: (base) => ({ ...base, minHeight: '42px', borderRadius: '0.375rem', borderColor: '#d1d5db' })
                  }}
                  required={true}
                />
              </div>

              <div className="mb-3">
                <label className="block text-xs font-semibold mb-1 text-gray-600">Jenis Pengurusan</label>
                <select 
                  className="w-full border rounded px-3 py-2 text-sm focus:ring focus:ring-blue-200"
                  value={formData.jenisPengurusan}
                  onChange={e => setFormData({...formData, jenisPengurusan: e.target.value})}
                >
                  <option value="PAJAK_1_TAHUN">Pajak Tahunan (1 Tahun)</option>
                  <option value="PLAT_5_TAHUN">Pergantian Plat (5 Tahun)</option>
                </select>
              </div>

              <div className="mb-3">
                <label className="block text-xs font-semibold mb-1 text-gray-600">Tanggal Pembayaran</label>
                <input 
                  type="date" 
                  required 
                  className="w-full border rounded px-3 py-2 text-sm focus:ring focus:ring-blue-200"
                  value={formData.tanggalPembayaran}
                  onChange={e => setFormData({...formData, tanggalPembayaran: e.target.value})}
                />
              </div>

              <div className="mb-3">
                <label className="block text-xs font-semibold mb-1 text-gray-600">Biaya Pengurusan (Rp)</label>
                <input 
                  type="number" 
                  required 
                  min="0"
                  placeholder="Misal: 3500000"
                  className="w-full border rounded px-3 py-2 text-sm focus:ring focus:ring-blue-200"
                  value={formData.biayaPengurusan}
                  onChange={e => setFormData({...formData, biayaPengurusan: parseInt(e.target.value) || ''})}
                />
              </div>

              <div className="mb-4">
                <label className="block text-xs font-semibold mb-1 text-gray-600">Link Bukti Pembayaran (Opsional)</label>
                <input 
                  type="url" 
                  placeholder="https://..."
                  className="w-full border rounded px-3 py-2 text-sm focus:ring focus:ring-blue-200"
                  value={formData.dokumenBuktiUrl}
                  onChange={e => setFormData({...formData, dokumenBuktiUrl: e.target.value})}
                />
                <p className="text-xs text-gray-400 mt-1">Masukkan URL file jika diunggah di cloud drive.</p>
              </div>

              <div className="flex justify-end gap-3 mt-4">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Batal</button>
                <button type="submit" disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700 disabled:opacity-50">
                  {loading ? 'Menyimpan...' : 'Simpan Pembayaran'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModulLegalitas;
