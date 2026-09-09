import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

const API = 'http://localhost:5000/api/v1';

const MasterDashboard = () => {
  const [activeTab, setActiveTab] = useState('spk');
  
  // States for data
  const [vehicles, setVehicles] = useState([]);
  const [signatories, setSignatories] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [spks, setSpks] = useState([]);
  
  // Search and filter states
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  
  // Settings State
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [kopSettings, setKopSettings] = useState({
    APP_TITLE: '',
    KOP_KIRI_1: '', KOP_KIRI_2: '', KOP_KIRI_3: '', KOP_KIRI_4: '',
    KOP_KANAN_1: '', KOP_KANAN_2: '', KOP_KANAN_3: '', KOP_KANAN_4: '', KOP_KANAN_5: ''
  });
  
  // Loading state
  const [loading, setLoading] = useState(false);

  // States for Modals
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [showSignatoryModal, setShowSignatoryModal] = useState(false);
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [spkToDelete, setSpkToDelete] = useState(null);
  
  // Edit & Error states
  const [editData, setEditData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form Data States
  const [vehicleForm, setVehicleForm] = useState({ nomor_polisi: '', merek_type: '', jenis_kendaraan: '', nama_sopir: '' });
  const [signatoryForm, setSignatoryForm] = useState({ nama_lengkap: '', nip_nik: '', jabatan: '', kategori_peran: 'TEKNISI' });
  const [vendorForm, setVendorForm] = useState({ nama_bengkel: '', alamat_kontak: '' });

  useEffect(() => {
    fetchData(activeTab);
  }, [activeTab]);

  const fetchData = async (tab) => {
    setLoading(true);
    try {
      if (tab === 'spk') {
        const res = await axios.get(`${API}/spk`);
        setSpks(res.data);
      } else if (tab === 'vehicles') {
        const res = await axios.get(`${API}/vehicles`);
        setVehicles(res.data);
      } else if (tab === 'signatories') {
        const res = await axios.get(`${API}/signatories`);
        setSignatories(res.data);
      } else if (tab === 'vendors') {
        const res = await axios.get(`${API}/vendors`);
        setVendors(res.data);
      } else if (tab === 'settings') {
        const resLogo = await axios.get(`${API}/settings/logo`);
        if (resLogo.data.logo_url) {
          setLogoPreview(`http://localhost:5000${resLogo.data.logo_url}`);
        }
        const resKop = await axios.get(`${API}/settings/kop`);
        setKopSettings(resKop.data);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  // --- Modal Helpers --- //
  const openModal = (type, data = null) => {
    setErrorMsg('');
    setEditData(data);
    if (type === 'vehicle') {
      setVehicleForm(data || { nomor_polisi: '', merek_type: '', jenis_kendaraan: '', nama_sopir: '' });
      setShowVehicleModal(true);
    } else if (type === 'signatory') {
      setSignatoryForm(data || { nama_lengkap: '', nip_nik: '', jabatan: '', kategori_peran: 'TEKNISI' });
      setShowSignatoryModal(true);
    } else if (type === 'vendor') {
      setVendorForm(data || { nama_bengkel: '', alamat_kontak: '' });
      setShowVendorModal(true);
    }
  };

  // --- CRUD Handlers --- //
  
  // Helper to extract error message
  const getErrorMessage = (err) => {
    if (!err.response) return 'Gagal terhubung ke server (Network Error). Pastikan backend aktif.';
    if (err.response.status === 404) return 'Fitur atau Endpoint tidak ditemukan. Mohon restart server backend Anda untuk memuat pembaruan terbaru.';
    const dataErr = err.response?.data?.error || err.response?.data?.message;
    if (typeof dataErr === 'string') return dataErr;
    return err.message || 'Terjadi kesalahan sistem.';
  };

  // Vehicle
  const handleSaveVehicle = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      if (editData) {
        await axios.put(`${API}/vehicles/${editData.id}`, vehicleForm);
      } else {
        await axios.post(`${API}/vehicles`, vehicleForm);
      }
      setShowVehicleModal(false);
      fetchData('vehicles');
    } catch (err) { 
      const errMsg = getErrorMessage(err);
      if (errMsg.includes('Validation error')) {
        setErrorMsg('Nomor Polisi tersebut sudah terdaftar di sistem.');
      } else {
        setErrorMsg(`Gagal menyimpan data kendaraan: ${errMsg}`);
      }
    }
  };
  const handleDeleteVehicle = async (id) => {
    if (window.confirm('Yakin hapus kendaraan ini?')) {
      await axios.delete(`${API}/vehicles/${id}`);
      fetchData('vehicles');
    }
  };

  // SPK
  const handleDeleteSPK = async () => {
    if (!spkToDelete) return;
    try {
      await axios.delete(`${API}/spk/${spkToDelete.id}`);
      setSpks(prev => prev.filter(spk => spk.id !== spkToDelete.id));
      setSuccessMsg('SPK berhasil dihapus.');
      setSpkToDelete(null);
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      setErrorMsg(`Gagal menghapus SPK: ${getErrorMessage(err)}`);
      setSpkToDelete(null);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await axios.put(`${API}/spk/${id}`, { status: newStatus });
      setSpks(prevSpks => prevSpks.map(spk => 
        spk.id === id ? { ...spk, status: newStatus } : spk
      ));
      setSuccessMsg('Status SPK berhasil diperbarui.');
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      setErrorMsg(`Gagal mengubah status: ${getErrorMessage(err)}`);
    }
  };

  // Signatory
  const handleSaveSignatory = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      if (editData) {
        await axios.put(`${API}/signatories/${editData.id}`, signatoryForm);
      } else {
        await axios.post(`${API}/signatories`, signatoryForm);
      }
      setShowSignatoryModal(false);
      fetchData('signatories');
    } catch (err) { 
      setErrorMsg(`Gagal menyimpan data pejabat: ${getErrorMessage(err)}`);
    }
  };
  const handleDeleteSignatory = async (id) => {
    if (window.confirm('Yakin hapus pejabat/teknisi ini?')) {
      await axios.delete(`${API}/signatories/${id}`);
      fetchData('signatories');
    }
  };

  // Vendor
  const handleSaveVendor = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      if (editData) {
        await axios.put(`${API}/vendors/${editData.id}`, vendorForm);
      } else {
        await axios.post(`${API}/vendors`, vendorForm);
      }
      setShowVendorModal(false);
      fetchData('vendors');
    } catch (err) { 
      setErrorMsg(`Gagal menyimpan data bengkel: ${getErrorMessage(err)}`);
    }
  };
  const handleDeleteVendor = async (id) => {
    if (window.confirm('Yakin hapus vendor/bengkel ini?')) {
      await axios.delete(`${API}/vendors/${id}`);
      fetchData('vendors');
    }
  };

  // Settings
  const handleSaveLogo = async () => {
    if (!logoFile) return;
    setErrorMsg('');
    setSuccessMsg('');
    const formData = new FormData();
    formData.append('logo', logoFile);
    try {
      await axios.post(`${API}/settings/logo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setSuccessMsg('Logo resmi berhasil diunggah dan disimpan!');
      setLogoFile(null);
      setTimeout(() => setSuccessMsg(''), 5000); // Hilang dalam 5 detik
    } catch (err) {
      setErrorMsg(`Gagal menyimpan logo: ${getErrorMessage(err)}`);
    }
  };

  const handleSaveKopSettings = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await axios.post(`${API}/settings/kop`, kopSettings);
      setSuccessMsg('Pengaturan teks dan tata letak Kop Surat berhasil disimpan!');
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      setErrorMsg(`Gagal menyimpan pengaturan kop surat: ${getErrorMessage(err)}`);
    }
  };


  // --- Helper Classes --- //
  const tabClass = (tabId) => `px-6 py-3 font-semibold text-sm border-b-2 transition-colors duration-200 ${activeTab === tabId ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`;
  const inputClass = "w-full p-2 border border-gray-300 rounded-md mb-4 text-sm focus:ring-blue-500 focus:border-blue-500";
  const btnClass = "bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow text-sm font-medium transition-colors";
  
  // Alert Component for forms
  const ErrorAlert = () => errorMsg ? (
    <div className="bg-red-50 border-l-4 border-red-500 p-3 mb-4 text-sm text-red-700 rounded shadow-sm">
      <p className="font-bold">Error!</p>
      <p>{errorMsg}</p>
    </div>
  ) : null;

  const SuccessAlert = () => successMsg ? (
    <div className="bg-green-50 border-l-4 border-green-500 p-3 mb-4 text-sm text-green-700 rounded shadow-sm flex justify-between items-center">
      <div>
        <p className="font-bold">Sukses!</p>
        <p>{successMsg}</p>
      </div>
      <button onClick={() => setSuccessMsg('')} className="text-green-700 hover:text-green-900 font-bold text-xl leading-none">&times;</button>
    </div>
  ) : null;

  return (
    <div className="max-w-6xl mx-auto py-8">
      
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Administrator Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Kelola data master dan riwayat SPK secara terpusat.</p>
        </div>
        <Link to="/create-spk" className="bg-green-600 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-green-700 transition-colors shadow">
          + Buat SPK Baru
        </Link>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-t-lg shadow-sm border-b border-gray-200 flex overflow-x-auto">
        <button onClick={() => setActiveTab('spk')} className={tabClass('spk')}>Riwayat SPK</button>
        <button onClick={() => setActiveTab('vehicles')} className={tabClass('vehicles')}>Master Kendaraan</button>
        <button onClick={() => setActiveTab('signatories')} className={tabClass('signatories')}>Master Pejabat & Teknisi</button>
        <button onClick={() => setActiveTab('vendors')} className={tabClass('vendors')}>Master Bengkel</button>
        <button onClick={() => setActiveTab('settings')} className={tabClass('settings')}>Pengaturan Sistem</button>
      </div>

      {/* Content Area */}
      <div className="bg-white rounded-b-lg shadow-md p-6 min-h-[500px]">
        {loading ? (
          <div className="flex justify-center items-center h-64"><p className="text-gray-500 animate-pulse">Memuat data...</p></div>
        ) : (
          <>
            {/* TAB: SPK */}
            {activeTab === 'spk' && (() => {
              // Menghasilkan daftar status unik dari data SPK yang ada
              const uniqueStatuses = [...new Set(spks.map(s => s.status))].filter(Boolean);

              // Memfilter spk berdasarkan kata kunci (Nomor SPK atau Nomor Polisi) dan Status
              const filteredSpks = spks.filter(spk => {
                const keywordLower = searchKeyword.toLowerCase();
                const matchesKeyword = 
                  (spk.nomorSPK || '').toLowerCase().includes(keywordLower) ||
                  (spk.vehicle?.nomor_polisi || '').toLowerCase().includes(keywordLower);
                
                const matchesStatus = filterStatus ? spk.status === filterStatus : true;
                
                return matchesKeyword && matchesStatus;
              });

              return (
                <div>
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                    <h2 className="text-xl font-bold">Riwayat SPK Terbaru</h2>
                    <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                      <input 
                        type="text" 
                        placeholder="Cari No. SPK atau Plat..." 
                        className="border border-gray-300 rounded-lg px-4 py-2 text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={searchKeyword}
                        onChange={(e) => setSearchKeyword(e.target.value)}
                      />
                      <select 
                        className="border border-gray-300 rounded-lg px-4 py-2 text-sm w-full sm:w-auto focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                      >
                        <option value="">Semua Status</option>
                        {uniqueStatuses.map(status => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-600">
                      <thead className="bg-gray-50 text-gray-700 border-b">
                        <tr>
                          <th className="p-3">No. SPK</th>
                          <th className="p-3">Tanggal Laporan</th>
                          <th className="p-3">No. Polisi</th>
                          <th className="p-3">Bengkel Tujuan</th>
                          <th className="p-3 text-center">Status</th>
                          <th className="p-3 text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSpks.length === 0 && <tr><td colSpan="6" className="p-4 text-center">Belum ada data SPK yang sesuai.</td></tr>}
                        {filteredSpks.map(spk => (
                          <tr key={spk.id} className="border-b hover:bg-gray-50">
                            <td className="p-3 font-semibold">{spk.nomorSPK}</td>
                            <td className="p-3">{spk.tanggalLaporan}</td>
                            <td className="p-3">{spk.vehicle?.nomor_polisi}</td>
                            <td className="p-3">{spk.vendor?.nama_bengkel}</td>
                            <td className="p-3 text-center">
                              <select
                                value={spk.status || 'DRAFT'}
                                onChange={(e) => handleStatusChange(spk.id, e.target.value)}
                                className={`px-2 py-1.5 text-xs rounded-full font-bold text-center appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400
                                  ${spk.status === 'DRAFT' ? 'bg-gray-200 text-gray-800' : 
                                    spk.status === 'CHECKED' ? 'bg-yellow-100 text-yellow-800' : 
                                    spk.status === 'APPROVED' ? 'bg-blue-100 text-blue-800' : 
                                    spk.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}
                              >
                                <option value="DRAFT" className="bg-white text-black font-normal">DRAFT</option>
                                <option value="CHECKED" className="bg-white text-black font-normal">CHECKED</option>
                                <option value="APPROVED" className="bg-white text-black font-normal">APPROVED</option>
                                <option value="COMPLETED" className="bg-white text-black font-normal">COMPLETED</option>
                              </select>
                            </td>
                            <td className="p-3 text-center space-x-4">
                              <Link to={`/print/${spk.id}`} className="text-gray-600 hover:text-blue-600 transition-colors" title="Pratinjau">👁️</Link>
                              <Link to={`/edit-spk/${spk.id}`} className="text-gray-600 hover:text-green-600 transition-colors" title="Edit">✏️</Link>
                              <Link to={`/print/${spk.id}?autoDownload=true`} target="_blank" className="text-gray-600 hover:text-purple-600 transition-colors" title="Download PDF Langsung">📥</Link>
                              <button onClick={() => setSpkToDelete(spk)} className="text-gray-600 hover:text-red-600 transition-colors" title="Hapus">🗑️</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}

            {/* TAB: VEHICLES */}
            {activeTab === 'vehicles' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold">Data Kendaraan Dinas</h2>
                  <button onClick={() => openModal('vehicle')} className={btnClass}>+ Tambah Kendaraan</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-600">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="p-3">No. Polisi</th>
                        <th className="p-3">Merek / Type</th>
                        <th className="p-3">Jenis Kendaraan</th>
                        <th className="p-3">Pengguna / Sopir</th>
                        <th className="p-3 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vehicles.map(v => (
                        <tr key={v.id} className="border-b hover:bg-gray-50">
                          <td className="p-3 font-bold">{v.nomor_polisi}</td>
                          <td className="p-3">{v.merek_type}</td>
                          <td className="p-3">{v.jenis_kendaraan}</td>
                          <td className="p-3">{v.nama_sopir}</td>
                          <td className="p-3 text-center space-x-4">
                            <button onClick={() => openModal('vehicle', v)} className="text-gray-600 hover:text-green-600 transition-colors" title="Edit">✏️</button>
                            <button onClick={() => handleDeleteVehicle(v.id)} className="text-gray-600 hover:text-red-600 transition-colors" title="Hapus">🗑️</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB: SIGNATORIES */}
            {activeTab === 'signatories' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold">Data Pejabat & Teknisi</h2>
                  <button onClick={() => openModal('signatory')} className={btnClass}>+ Tambah Pejabat</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-600">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="p-3">Nama Lengkap</th>
                        <th className="p-3">NIP / NIK</th>
                        <th className="p-3">Jabatan Cetak</th>
                        <th className="p-3">Kategori (Role)</th>
                        <th className="p-3 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {signatories.map(s => (
                        <tr key={s.id} className="border-b hover:bg-gray-50">
                          <td className="p-3 font-bold">{s.nama_lengkap}</td>
                          <td className="p-3">{s.nip_nik}</td>
                          <td className="p-3">{s.jabatan}</td>
                          <td className="p-3"><span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded text-xs">{s.kategori_peran}</span></td>
                          <td className="p-3 text-center space-x-4">
                            <button onClick={() => openModal('signatory', s)} className="text-gray-600 hover:text-green-600 transition-colors" title="Edit">✏️</button>
                            <button onClick={() => handleDeleteSignatory(s.id)} className="text-gray-600 hover:text-red-600 transition-colors" title="Hapus">🗑️</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB: VENDORS */}
            {activeTab === 'vendors' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold">Data Bengkel / Vendor</h2>
                  <button onClick={() => openModal('vendor')} className={btnClass}>+ Tambah Bengkel</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-600">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="p-3">Nama Bengkel</th>
                        <th className="p-3">Alamat & Kontak</th>
                        <th className="p-3 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vendors.map(v => (
                        <tr key={v.id} className="border-b hover:bg-gray-50">
                          <td className="p-3 font-bold">{v.nama_bengkel}</td>
                          <td className="p-3">{v.alamat_kontak}</td>
                          <td className="p-3 text-center space-x-4">
                            <button onClick={() => openModal('vendor', v)} className="text-gray-600 hover:text-green-600 transition-colors" title="Edit">✏️</button>
                            <button onClick={() => handleDeleteVendor(v.id)} className="text-gray-600 hover:text-red-600 transition-colors" title="Hapus">🗑️</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {/* TAB: SETTINGS */}
            {activeTab === 'settings' && (
              <div>
                <h2 className="text-xl font-bold mb-4">Pengaturan Sistem</h2>
                <ErrorAlert />
                <SuccessAlert />
                
                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 max-w-xl">
                  <h3 className="font-semibold text-lg text-gray-800 mb-2">Identitas Aplikasi</h3>
                  <p className="text-sm text-gray-500 mb-4">Ubah judul aplikasi dan logo resmi yang muncul pada dokumen cetak SPK maupun navbar.</p>
                  
                  <div className="mb-6">
                    <label className="block text-xs font-semibold mb-1 text-gray-600">Judul Aplikasi</label>
                    <input 
                      type="text" 
                      className={inputClass} 
                      value={kopSettings.APP_TITLE || ''} 
                      onChange={e => setKopSettings({...kopSettings, APP_TITLE: e.target.value})} 
                      placeholder="SPK Kendaraan UNHAS" 
                    />
                    <div className="mt-2 text-right">
                      <button onClick={handleSaveKopSettings} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-semibold text-sm transition-colors shadow-sm">
                        💾 Simpan Judul
                      </button>
                    </div>
                  </div>

                  <hr className="my-6 border-gray-300" />
                  
                  <h4 className="font-semibold text-gray-700 border-b border-gray-300 pb-2 mb-3">Logo Institusi</h4>
                  <div className="flex items-center gap-6 mb-4">
                    <div className="w-24 h-24 bg-white border border-gray-300 rounded-md flex items-center justify-center overflow-hidden p-2">
                      {logoPreview ? <img src={logoPreview} alt="Logo Preview" className="max-w-full max-h-full object-contain" /> : <span className="text-xs text-gray-400">Tanpa Logo</span>}
                    </div>
                    <div>
                      <input type="file" accept="image/*" onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          setLogoFile(file);
                          setLogoPreview(URL.createObjectURL(file));
                        }
                      }} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                    </div>
                  </div>
                  <button onClick={handleSaveLogo} disabled={!logoFile} className={`${btnClass} disabled:opacity-50 disabled:cursor-not-allowed`}>💾 Simpan Logo</button>
                </div>
                
                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 mt-6 max-w-4xl">
                  <h3 className="font-semibold text-lg text-gray-800 mb-2">Teks & Tata Letak Kop Surat</h3>
                  <p className="text-sm text-gray-500 mb-4">Atur baris teks identitas institusi (kiri) dan kontak (kanan).</p>
                  
                  <form onSubmit={handleSaveKopSettings} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Bagian Kiri */}
                      <div className="space-y-2">
                        <h4 className="font-semibold text-gray-700 border-b border-gray-300 pb-2 mb-3">Teks Utama (Sebelah Logo)</h4>
                        <div>
                          <label className="block text-xs font-semibold mb-1 text-gray-600">Baris 1</label>
                          <input type="text" className={inputClass} value={kopSettings.KOP_KIRI_1 || ''} onChange={e => setKopSettings({...kopSettings, KOP_KIRI_1: e.target.value})} placeholder="KEMENTERIAN PENDIDIKAN TINGGI, SAINS," />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold mb-1 text-gray-600">Baris 2</label>
                          <input type="text" className={inputClass} value={kopSettings.KOP_KIRI_2 || ''} onChange={e => setKopSettings({...kopSettings, KOP_KIRI_2: e.target.value})} placeholder="DAN TEKNOLOGI" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold mb-1 text-gray-600">Baris 3</label>
                          <input type="text" className={inputClass} value={kopSettings.KOP_KIRI_3 || ''} onChange={e => setKopSettings({...kopSettings, KOP_KIRI_3: e.target.value})} placeholder="UNIVERSITAS HASANUDDIN" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold mb-1 text-gray-600">Baris 4</label>
                          <input type="text" className={inputClass} value={kopSettings.KOP_KIRI_4 || ''} onChange={e => setKopSettings({...kopSettings, KOP_KIRI_4: e.target.value})} placeholder="Cth: FAKULTAS KEDOKTERAN (opsional)" />
                        </div>
                      </div>

                      {/* Bagian Kanan */}
                      <div className="space-y-2">
                        <h4 className="font-semibold text-gray-700 border-b border-gray-300 pb-2 mb-3">Teks Alamat & Kontak (Kanan)</h4>
                        <div>
                          <label className="block text-xs font-semibold mb-1 text-gray-600">Baris 1</label>
                          <input type="text" className={inputClass} value={kopSettings.KOP_KANAN_1 || ''} onChange={e => setKopSettings({...kopSettings, KOP_KANAN_1: e.target.value})} placeholder="Jalan Perintis Kemerdekaan Km. 10" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold mb-1 text-gray-600">Baris 2</label>
                          <input type="text" className={inputClass} value={kopSettings.KOP_KANAN_2 || ''} onChange={e => setKopSettings({...kopSettings, KOP_KANAN_2: e.target.value})} placeholder="Tamalanrea, Makassar 90245" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold mb-1 text-gray-600">Baris 3</label>
                          <input type="text" className={inputClass} value={kopSettings.KOP_KANAN_3 || ''} onChange={e => setKopSettings({...kopSettings, KOP_KANAN_3: e.target.value})} placeholder="Telepon (0411) 586200" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold mb-1 text-gray-600">Baris 4</label>
                          <input type="text" className={inputClass} value={kopSettings.KOP_KANAN_4 || ''} onChange={e => setKopSettings({...kopSettings, KOP_KANAN_4: e.target.value})} placeholder="e-mail: office@unhas.ac.id" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold mb-1 text-gray-600">Baris 5</label>
                          <input type="text" className={inputClass} value={kopSettings.KOP_KANAN_5 || ''} onChange={e => setKopSettings({...kopSettings, KOP_KANAN_5: e.target.value})} placeholder="Laman: www.unhas.ac.id" />
                        </div>
                      </div>
                    </div>
                    
                    <button type="submit" className={btnClass}>💾 Simpan Pengaturan Kop</button>
                  </form>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal Hapus SPK */}
      {spkToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md shadow-xl text-center">
            <div className="text-red-500 text-5xl mb-4">⚠️</div>
            <h3 className="text-lg font-bold mb-2">Konfirmasi Hapus</h3>
            <p className="text-gray-600 text-sm mb-6">
              Apakah Anda yakin ingin menghapus SPK Nomor <span className="font-bold">{spkToDelete.nomorSPK}</span>?<br/>
              Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setSpkToDelete(null)} className="px-5 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 font-semibold rounded-lg transition-colors">Batal</button>
              <button onClick={handleDeleteSPK} className="px-5 py-2.5 text-white bg-red-600 hover:bg-red-700 font-semibold rounded-lg transition-colors shadow">Ya, Hapus</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Vehicle */}
      {showVehicleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold mb-4">{editData ? 'Edit Kendaraan' : 'Tambah Kendaraan Baru'}</h3>
            <ErrorAlert />
            <form onSubmit={handleSaveVehicle}>
              <label className="block text-xs font-semibold mb-1 text-gray-600">Nomor Polisi</label>
              <input type="text" required className={inputClass} value={vehicleForm.nomor_polisi} onChange={e => setVehicleForm({...vehicleForm, nomor_polisi: e.target.value})} placeholder="DD 1234 XX" />
              <label className="block text-xs font-semibold mb-1 text-gray-600">Merek / Type</label>
              <input type="text" required className={inputClass} value={vehicleForm.merek_type} onChange={e => setVehicleForm({...vehicleForm, merek_type: e.target.value})} placeholder="Toyota Innova" />
              <label className="block text-xs font-semibold mb-1 text-gray-600">Jenis Kendaraan</label>
              <input type="text" required className={inputClass} value={vehicleForm.jenis_kendaraan} onChange={e => setVehicleForm({...vehicleForm, jenis_kendaraan: e.target.value})} placeholder="Minibus / SUV" />
              <label className="block text-xs font-semibold mb-1 text-gray-600">Nama Sopir / Pengguna</label>
              <input type="text" className={inputClass} value={vehicleForm.nama_sopir} onChange={e => setVehicleForm({...vehicleForm, nama_sopir: e.target.value})} placeholder="Nama Lengkap" />
              <div className="flex justify-end gap-3 mt-4">
                <button type="button" onClick={() => setShowVehicleModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Batal</button>
                <button type="submit" className={btnClass}>Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Signatory */}
      {showSignatoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold mb-4">{editData ? 'Edit Pejabat' : 'Tambah Pejabat Baru'}</h3>
            <ErrorAlert />
            <form onSubmit={handleSaveSignatory}>
              <label className="block text-xs font-semibold mb-1 text-gray-600">Nama Lengkap (beserta gelar)</label>
              <input type="text" required className={inputClass} value={signatoryForm.nama_lengkap} onChange={e => setSignatoryForm({...signatoryForm, nama_lengkap: e.target.value})} />
              <label className="block text-xs font-semibold mb-1 text-gray-600">NIP / NIK</label>
              <input type="text" required className={inputClass} value={signatoryForm.nip_nik} onChange={e => setSignatoryForm({...signatoryForm, nip_nik: e.target.value})} />
              <label className="block text-xs font-semibold mb-1 text-gray-600">Jabatan Cetak</label>
              <input type="text" required className={inputClass} value={signatoryForm.jabatan} onChange={e => setSignatoryForm({...signatoryForm, jabatan: e.target.value})} />
              <label className="block text-xs font-semibold mb-1 text-gray-600">Kategori Peran (Role)</label>
              <select required className={inputClass} value={signatoryForm.kategori_peran} onChange={e => setSignatoryForm({...signatoryForm, kategori_peran: e.target.value})}>
                <option value="DIREKTUR">Direktur (Penandatangan Lembar 4)</option>
                <option value="KASUBDIT">Kepala Subdit (Lembar 4 & 5)</option>
                <option value="KASI_TU">Kepala Seksi TU (Lembar 2)</option>
                <option value="TEKNISI">Teknisi Otomotif (Lembar 3 & 5)</option>
              </select>
              <div className="flex justify-end gap-3 mt-4">
                <button type="button" onClick={() => setShowSignatoryModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Batal</button>
                <button type="submit" className={btnClass}>Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Vendor */}
      {showVendorModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold mb-4">{editData ? 'Edit Bengkel' : 'Tambah Bengkel Baru'}</h3>
            <ErrorAlert />
            <form onSubmit={handleSaveVendor}>
              <label className="block text-xs font-semibold mb-1 text-gray-600">Nama Bengkel / Vendor</label>
              <input type="text" required className={inputClass} value={vendorForm.nama_bengkel} onChange={e => setVendorForm({...vendorForm, nama_bengkel: e.target.value})} />
              <label className="block text-xs font-semibold mb-1 text-gray-600">Alamat & Kontak</label>
              <textarea required className={inputClass} rows="3" value={vendorForm.alamat_kontak} onChange={e => setVendorForm({...vendorForm, alamat_kontak: e.target.value})}></textarea>
              <div className="flex justify-end gap-3 mt-4">
                <button type="button" onClick={() => setShowVendorModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Batal</button>
                <button type="submit" className={btnClass}>Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default MasterDashboard;
