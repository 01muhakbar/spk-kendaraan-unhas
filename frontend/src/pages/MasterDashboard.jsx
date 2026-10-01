import { useState, useEffect, useRef } from 'react';
import { Link, MemoryRouter, Routes, Route } from 'react-router-dom';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import Papa from 'papaparse';
import { fetchLogo, fetchKop, resolveLogoUrl, MAX_LOGO_BYTES, LOGO_TYPES, fetchLembar } from '../settings';
import PrintSPK from './PrintSPK';
import JSZip from 'jszip';
import html2pdf from 'html2pdf.js';

const API_BASE = import.meta.env.VITE_API_BASE || (import.meta.env.PROD ? '' : 'http://localhost:5000');
const API = import.meta.env.VITE_API_URL || `${API_BASE}/api/v1`;

const MasterDashboard = ({ onSettingsSaved }) => {
  const [activeTab, setActiveTab] = useState('spk');
  
  // States for data
  const [vehicles, setVehicles] = useState([]);
  const [signatories, setSignatories] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [spks, setSpks] = useState([]);
  
  const [searchKeyword, setSearchKeyword] = useState('');
  const [vehicleSearchQuery, setVehicleSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  
  // Pagination State
  const [spkPage, setSpkPage] = useState(1);
  const [vehiclePage, setVehiclePage] = useState(1);
  const ROWS_PER_PAGE = 10;
  
  // Bulk Download States
  const [selectedSpkIds, setSelectedSpkIds] = useState([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0 });
  
  // Settings State
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [savedLogoUrl, setSavedLogoUrl] = useState(null);
  const [kopLoaded, setKopLoaded] = useState(false);
  const [savingLogo, setSavingLogo] = useState(false);
  const [savingKop, setSavingKop] = useState(false);
  const [logoError, setLogoError] = useState('');
  const [kopError, setKopError] = useState('');
  const logoInput = useRef(null);
  const logoSaveLock = useRef(false);
  const kopSaveLock = useRef(false);
  const loadRequest = useRef(0);
  const [kopSettings, setKopSettings] = useState({
    APP_TITLE: '',
    KOP_KIRI_1: '', KOP_KIRI_2: '', KOP_KIRI_3: '', KOP_KIRI_4: '',
    KOP_KANAN_1: '', KOP_KANAN_2: '', KOP_KANAN_3: '', KOP_KANAN_4: '', KOP_KANAN_5: ''
  });
  
  const [lembarSettings, setLembarSettings] = useState({
    LEMBAR1_PENGANTAR: '', LEMBAR1_DUGAAN: '', LEMBAR1_PENUTUP: '',
    LEMBAR2_JUDUL: '', LEMBAR2_PENGANTAR: '', LEMBAR2_PENUTUP: '',
    LEMBAR3_JUDUL: '', LEMBAR3_PENUTUP: '',
    LEMBAR4_JUDUL: '', LEMBAR4_PENGANTAR: '', LEMBAR4_PEKERJAAN: '', LEMBAR4_PENUTUP: '',
    LEMBAR5_JUDUL: '', LEMBAR5_PENGANTAR: ''
  });
  const [lembarLoaded, setLembarLoaded] = useState(false);
  const [savingLembar, setSavingLembar] = useState(false);
  const [lembarError, setLembarError] = useState('');
  const lembarSaveLock = useRef(false);
  
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

  const fileInputRef = useRef(null);
  const vehicleFileInputRef = useRef(null);

  useEffect(() => {
    fetchData(activeTab);
    return () => { loadRequest.current += 1; };
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'vehicles') {
      const delayDebounceFn = setTimeout(() => {
        fetchData('vehicles');
      }, 500);
      return () => clearTimeout(delayDebounceFn);
    }
  }, [vehicleSearchQuery]);

  useEffect(() => {
    if (!logoFile) {
      setLogoPreview(savedLogoUrl);
      return;
    }
    const url = URL.createObjectURL(logoFile);
    setLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile, savedLogoUrl]);

  const fetchData = async (tab) => {
    const request = ++loadRequest.current;
    setLoading(true);
    setErrorMsg('');
    if (tab === 'settings') setKopLoaded(false);
    try {
      if (tab === 'spk') {
        const res = await axios.get(`${API}/spk`);
        if (request !== loadRequest.current) return;
        setSpks(res.data);
      } else if (tab === 'vehicles') {
        const res = await axios.get(`${API}/vehicles`, { params: { search: vehicleSearchQuery } });
        if (request !== loadRequest.current) return;
        setVehicles(res.data);
      } else if (tab === 'signatories') {
        const res = await axios.get(`${API}/signatories`);
        if (request !== loadRequest.current) return;
        setSignatories(res.data);
      } else if (tab === 'vendors') {
        const res = await axios.get(`${API}/vendors`);
        if (request !== loadRequest.current) return;
        setVendors(res.data);
      } else if (tab === 'settings') {
        const [logo, kop, lembar] = await Promise.allSettled([fetchLogo(), fetchKop(), fetchLembar()]);
        if (request !== loadRequest.current) return;
        
        if (logo.status === 'fulfilled') {
          setSavedLogoUrl(resolveLogoUrl(logo.value.logo_url));
          setLogoError('');
        } else {
          setLogoError('Gagal memuat logo institusi.');
        }
        
        if (kop.status === 'fulfilled') {
          setKopSettings(kop.value);
          setKopLoaded(true);
          setKopError('');
        } else {
          setKopError('Gagal memuat kop surat. Penyimpanan judul dan kop belum tersedia.');
        }

        if (lembar.status === 'fulfilled') {
          setLembarSettings(lembar.value);
          setLembarLoaded(true);
          setLembarError('');
        } else {
          setLembarError('Gagal memuat pengaturan teks lembar cetak.');
        }
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      if (request === loadRequest.current) setErrorMsg(`Gagal memuat data: ${getErrorMessage(err)}`);
    } finally {
      if (request === loadRequest.current) setLoading(false);
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
    if (err.response.status === 413) return 'Ukuran logo maksimal 4 MB.';
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

  const handleExportJSON = (dataToExport) => {
    const jsonString = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Riwayat_SPK_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
  };

  const handleExportCSV = (dataToExport) => {
    const flattenJSON = (field, key) => {
      if (!field) return '';
      try {
        const parsed = typeof field === 'string' ? JSON.parse(field) : field;
        if (!Array.isArray(parsed)) return '';
        if (key) return parsed.map(k => k[key]).filter(Boolean).join(', ');
        return parsed.join(', ');
      } catch (e) {
        return '';
      }
    };

    const flattenedData = dataToExport.map(item => {
      const { 
        id, createdAt, updatedAt, deletedAt, vehicleId, vendorId, 
        vehicle, vendor, signatoryPejabat, signatoryTeknisi,
        daftarKerusakan, tabelPengecekan, tabelPekerjaan,
        nomorSPK, tanggalLaporan, status,
        ...rest 
      } = item;

      return {
        Nomor_SPK: nomorSPK || '-',
        Tanggal_Laporan: tanggalLaporan || '-',
        Nomor_Polisi: vehicle?.nomor_polisi || '-',
        Nama_Bengkel: vendor?.nama_bengkel || '-',
        Status: status || '-',
        Daftar_Kerusakan: flattenJSON(daftarKerusakan),
        Tabel_Pengecekan: flattenJSON(tabelPengecekan, 'komponenRusak'),
        Tabel_Pekerjaan: flattenJSON(tabelPekerjaan, 'jenisPekerjaan'),
        ...rest 
      };
    });
    const csvString = Papa.unparse(flattenedData);
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Riwayat_SPK_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  const downloadSpkTemplate = () => {
    const templateData = [{
      Nomor_SPK: "001/RT/P-Kend/2026",
      Tanggal_Laporan: "2026-01-01",
      Nomor_Polisi: "DD 1234 XX",
      Nama_Bengkel: "Bengkel Sejahtera",
      Daftar_Kerusakan: "Ganti Oli, Service Rutin, Rem"
    }];
    const csvString = Papa.unparse(templateData);
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "Template_Import_SPK.csv";
    link.click();
  };

  const handleBulkDownload = async () => {
    setIsDownloading(true);
    setDownloadProgress({ current: 0, total: selectedSpkIds.length });
    try {
      const zip = new JSZip();

      // [MENDALAM] Persiapkan CSS yang aman dari oklch untuk html2canvas
      let safeCssText = '';
      
      // Kumpulkan CSS dari <style> bawaan
      document.querySelectorAll('style').forEach(style => {
        safeCssText += style.innerHTML + '\n';
      });

      // Kumpulkan CSS dari <link rel="stylesheet"> (File CSS produksi Vite)
      const links = document.querySelectorAll('link[rel="stylesheet"]');
      for (const link of links) {
        try {
          const res = await fetch(link.href);
          const css = await res.text();
          safeCssText += css + '\n';
        } catch (e) {
          console.warn("Gagal fetch external CSS:", link.href, e);
        }
      }

      // Terapkan Smart Regex Parser untuk mengganti oklch menjadi HEX standar
      safeCssText = safeCssText
        .replace(/oklch\(\s*([\d.]+)(%?)[^)]*\)/g, (match, l, pct) => {
          let lightness = parseFloat(l);
          if (pct) lightness /= 100;
          if (lightness > 0.85) return '#f3f4f6'; // Background terang
          if (lightness > 0.5) return '#9ca3af';  // Border abu-abu
          return '#111827';                       // Teks gelap
        })
        .replace(/color-mix\([^)]+\)/g, 'inherit');

      for (let i = 0; i < selectedSpkIds.length; i++) {
        const id = selectedSpkIds[i];
        setDownloadProgress({ current: i + 1, total: selectedSpkIds.length });
        
        await new Promise((resolve) => {
          const container = document.createElement('div');
          container.style.position = 'absolute';
          container.style.left = '-9999px';
          container.style.top = '-9999px';
          container.style.width = '210mm';
          container.style.zIndex = '-1000';
          document.body.appendChild(container);
          
          const root = createRoot(container);
          
          const handleReady = async (element) => {
            try {
              const spkData = spks.find(s => s.id === id);
              const spkNum = spkData ? spkData.nomorSPK.replace(/\//g, '-') : id;
              
              const opt = {
                margin: 0,
                filename: `SPK_${spkNum}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { 
                  scale: 2, 
                  useCORS: true, 
                  windowWidth: 800,
                  onclone: (clonedDoc) => {
                    // Hapus SEMUA stylesheet asli dari clone agar html2canvas tidak mencoba me-load-nya dan crash
                    clonedDoc.querySelectorAll('style, link[rel="stylesheet"]').forEach(el => el.remove());
                    
                    // Suntikkan CSS buatan kita yang sudah bebas dari oklch dan color-mix
                    const safeStyle = clonedDoc.createElement('style');
                    safeStyle.innerHTML = safeCssText;
                    clonedDoc.head.appendChild(safeStyle);
                  }
                },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
              };
              
              const pdfBlob = await html2pdf().set(opt).from(element).outputPdf('blob');
              zip.file(`SPK_${spkNum}.pdf`, pdfBlob);
            } catch (err) {
              console.error("Gagal merender PDF untuk SPK ID:", id, err);
              zip.file(`ERROR_SPK_${id}.txt`, err.toString() + "\n" + (err.stack || ""));
            } finally {
              root.unmount();
              document.body.removeChild(container);
              resolve();
            }
          };
          
          root.render(
            <MemoryRouter initialEntries={[`/print/${id}?headless=true`]}>
              <Routes>
                <Route path="/print/:id" element={<PrintSPK onReady={handleReady} />} />
              </Routes>
            </MemoryRouter>
          );
        });
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const url = window.URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Batch_SPK_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      link.remove();
      
      setSuccessMsg('Berhasil mengunduh batch SPK!');
      setSelectedSpkIds([]);
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (error) {
      console.error("Download gagal", error);
      setErrorMsg("Gagal mengunduh dokumen batch. Silakan coba lagi.");
    } finally {
      setIsDownloading(false);
      setDownloadProgress({ current: 0, total: 0 });
    }
  };

  const handleImportFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const extension = file.name.split('.').pop().toLowerCase();
    
    const processData = async (parsedData) => {
      try {
        setLoading(true);
        await axios.post(`${API}/spk/import`, parsedData);
        setSuccessMsg('Data SPK berhasil diimpor!');
        fetchData('spk');
        setTimeout(() => setSuccessMsg(''), 5000);
      } catch (err) {
        setErrorMsg(`Gagal mengimpor data: ${getErrorMessage(err)}`);
      } finally {
        setLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    if (extension === 'json') {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsedData = JSON.parse(event.target.result);
          processData(parsedData);
        } catch (error) {
          setErrorMsg('File JSON tidak valid.');
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
      reader.readAsText(file);
    } else if (extension === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const data = results.data.map(row => {
            try {
              if (row.daftarKerusakan) row.daftarKerusakan = JSON.parse(row.daftarKerusakan);
              if (row.tabelPengecekan) row.tabelPengecekan = JSON.parse(row.tabelPengecekan);
              if (row.tabelPekerjaan) row.tabelPekerjaan = JSON.parse(row.tabelPekerjaan);
            } catch(err) {}
            return row;
          });
          processData(data);
        },
        error: (error) => {
          setErrorMsg(`Gagal membaca CSV: ${error.message}`);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      });
    } else {
      setErrorMsg('Format file tidak didukung. Gunakan .json atau .csv');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleExportVehicleCSV = () => {
    const csvString = Papa.unparse(vehicles);
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Master_Kendaraan_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  const handleImportVehicleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          setLoading(true);
          await axios.post(`${API}/vehicles/bulk`, results.data);
          setSuccessMsg('Data Kendaraan berhasil diimpor!');
          fetchData('vehicles');
          setTimeout(() => setSuccessMsg(''), 5000);
        } catch (err) {
          setErrorMsg(`Gagal mengimpor data kendaraan: ${getErrorMessage(err)}`);
        } finally {
          setLoading(false);
          if (vehicleFileInputRef.current) vehicleFileInputRef.current.value = '';
        }
      },
      error: (error) => {
        setErrorMsg(`Gagal membaca CSV: ${error.message}`);
        if (vehicleFileInputRef.current) vehicleFileInputRef.current.value = '';
      }
    });
  };

  const downloadVehicleTemplate = () => {
    const templateData = [{ nomor_polisi: "DD 1234 XX", merek_type: "Toyota Kijang", jenis_kendaraan: "Minibus", nama_sopir: "Budi" }];
    const csvString = Papa.unparse(templateData);
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "Template_Import_Kendaraan.csv";
    link.click();
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
  const handleLogoSelection = (event) => {
    const file = event.target.files[0];
    setErrorMsg('');
    setSuccessMsg('');
    if (!file) {
      setLogoFile(null);
      return;
    }
    if (!LOGO_TYPES.includes(file.type) || file.size > MAX_LOGO_BYTES) {
      setErrorMsg(!LOGO_TYPES.includes(file.type) ? 'Format logo harus JPG, PNG, atau GIF.' : 'Ukuran logo maksimal 4 MB.');
      setLogoFile(null);
      event.target.value = '';
      return;
    }
    setLogoFile(file);
  };

  const handleSaveLogo = async () => {
    if (!logoFile || logoSaveLock.current) return;
    logoSaveLock.current = true;
    setSavingLogo(true);
    setErrorMsg('');
    setSuccessMsg('');
    const formData = new FormData();
    formData.append('logo', logoFile);
    try {
      const { data } = await axios.post(`${API}/settings/logo`, formData);
      setSavedLogoUrl(resolveLogoUrl(data.logo_url));
      onSettingsSaved?.({ logo_url: data.logo_url });
      setSuccessMsg('Logo resmi berhasil diunggah dan disimpan!');
      setLogoError('');
      setLogoFile(null);
      if (logoInput.current) logoInput.current.value = '';
      setTimeout(() => setSuccessMsg(''), 5000); // Hilang dalam 5 detik
    } catch (err) {
      setLogoError(`Gagal menyimpan logo: ${getErrorMessage(err)}`);
    } finally {
      logoSaveLock.current = false;
      setSavingLogo(false);
    }
  };

  const handleSaveKopSettings = async (e, titleOnly = false) => {
    e.preventDefault();
    if (!kopLoaded || kopSaveLock.current) return;
    kopSaveLock.current = true;
    setSavingKop(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const values = titleOnly ? { APP_TITLE: kopSettings.APP_TITLE } : { ...kopSettings };
      await axios.post(`${API}/settings/kop`, values);
      onSettingsSaved?.(values);
      setSuccessMsg('Pengaturan teks dan tata letak Kop Surat berhasil disimpan!');
      setKopError('');
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      setKopError(`Gagal menyimpan pengaturan kop surat: ${getErrorMessage(err)}`);
    } finally {
      kopSaveLock.current = false;
      setSavingKop(false);
    }
  };

  const handleSaveLembarSettings = async (e) => {
    e.preventDefault();
    if (!lembarLoaded || lembarSaveLock.current) return;
    lembarSaveLock.current = true;
    setSavingLembar(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await axios.post(`${API}/settings/lembar`, lembarSettings);
      setSuccessMsg('Pengaturan teks lembar cetak berhasil disimpan!');
      setLembarError('');
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      setLembarError(`Gagal menyimpan pengaturan teks lembar: ${getErrorMessage(err)}`);
    } finally {
      lembarSaveLock.current = false;
      setSavingLembar(false);
    }
  };


  // --- Helper Classes --- //
  const tabClass = (tabId) => `px-6 py-3 font-semibold text-sm border-b-2 transition-colors duration-200 whitespace-nowrap ${activeTab === tabId ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`;
  const inputClass = "w-full p-2 border border-gray-300 rounded-md mb-4 text-sm focus:ring-blue-500 focus:border-blue-500";
  const btnClass = "bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow text-sm font-medium transition-colors";
  
  // Alert Component for forms
  const ErrorAlert = () => errorMsg ? (
    <div role="alert" className="bg-red-50 border-l-4 border-red-500 p-3 mb-4 text-sm text-red-700 rounded shadow-sm">
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
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Administrator Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Kelola data master dan riwayat SPK secara terpusat.</p>
        </div>
        <Link to="/create-spk" className="bg-green-600 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-green-700 transition-colors shadow w-full sm:w-auto text-center">
          + Buat SPK Baru
        </Link>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-t-lg shadow-sm border-b border-gray-200 flex overflow-x-auto [&::-webkit-scrollbar]:hidden">
        <button onClick={() => setActiveTab('spk')} className={tabClass('spk')}>Riwayat SPK</button>
        <button onClick={() => setActiveTab('vehicles')} className={tabClass('vehicles')}>Master Kendaraan</button>
        <button onClick={() => setActiveTab('signatories')} className={tabClass('signatories')}>Master Pejabat & Teknisi</button>
        <button onClick={() => setActiveTab('vendors')} className={tabClass('vendors')}>Master Bengkel</button>
        <button onClick={() => setActiveTab('settings')} className={tabClass('settings')}>Pengaturan Sistem</button>
      </div>

      {/* Content Area */}
      <div className="bg-white rounded-b-lg shadow-md p-6 min-h-[500px]">
        {activeTab !== 'settings' && errorMsg && <ErrorAlert />}
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

              const totalSpkPages = Math.ceil(filteredSpks.length / ROWS_PER_PAGE);
              const currentSpks = filteredSpks.slice((spkPage - 1) * ROWS_PER_PAGE, spkPage * ROWS_PER_PAGE);

              return (
                <div>
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                    <h2 className="text-xl font-bold">Riwayat SPK Terbaru</h2>
                    <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto items-center">
                      <div className="flex gap-2 w-full sm:w-auto justify-end">
                        <button onClick={downloadSpkTemplate} className="text-blue-600 hover:text-blue-800 text-xs font-semibold underline px-2">Template CSV</button>
                        <button onClick={() => handleExportJSON(filteredSpks)} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded text-sm font-medium border border-gray-300">Export JSON</button>
                        <button onClick={() => handleExportCSV(filteredSpks)} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded text-sm font-medium border border-gray-300">Export CSV</button>
                        <button onClick={() => fileInputRef.current?.click()} disabled={loading} className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded text-sm font-medium border border-blue-200 disabled:opacity-50">
                          {loading ? 'Mengimpor...' : 'Import Data'}
                        </button>
                        <input type="file" accept=".csv, .json" className="hidden" ref={fileInputRef} onChange={handleImportFile} disabled={loading} />
                      </div>
                      <input 
                        type="text" 
                        placeholder="Cari No. SPK atau Plat..." 
                        className="border border-gray-300 rounded-lg px-4 py-2 text-sm w-full sm:w-48 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                          <th className="p-3 text-center w-10">
                            <input 
                              type="checkbox" 
                              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                              checked={filteredSpks.length > 0 && selectedSpkIds.length === filteredSpks.length}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedSpkIds(filteredSpks.map(s => s.id));
                                } else {
                                  setSelectedSpkIds([]);
                                }
                              }}
                            />
                          </th>
                          <th className="p-3 whitespace-nowrap">No. SPK</th>
                          <th className="p-3 whitespace-nowrap hidden md:table-cell">Tanggal Laporan</th>
                          <th className="p-3 whitespace-nowrap">No. Polisi</th>
                          <th className="p-3 whitespace-nowrap">Bengkel Tujuan</th>
                          <th className="p-3 text-center whitespace-nowrap">Status</th>
                          <th className="p-3 text-center whitespace-nowrap">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSpks.length === 0 && <tr><td colSpan="6" className="p-4 text-center">Belum ada data SPK yang sesuai.</td></tr>}
                        {currentSpks.map(spk => (
                          <tr key={spk.id} className={`border-b hover:bg-gray-50 ${selectedSpkIds.includes(spk.id) ? 'bg-blue-50/50' : ''}`}>
                            <td className="p-3 text-center">
                              <input 
                                type="checkbox"
                                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                                checked={selectedSpkIds.includes(spk.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedSpkIds(prev => [...prev, spk.id]);
                                  } else {
                                    setSelectedSpkIds(prev => prev.filter(id => id !== spk.id));
                                  }
                                }}
                              />
                            </td>
                            <td className="p-3 font-semibold">{spk.nomorSPK}</td>
                            <td className="p-3 hidden md:table-cell">{spk.tanggalLaporan}</td>
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
                  
                  {/* Paginasi SPK */}
                  {totalSpkPages > 1 && (
                    <div className="flex justify-between items-center px-4 py-3 border-t bg-white sm:px-6 mt-2">
                      <div className="text-sm text-gray-700">
                        Menampilkan <span className="font-medium">{(spkPage - 1) * ROWS_PER_PAGE + 1}</span> hingga <span className="font-medium">{Math.min(spkPage * ROWS_PER_PAGE, filteredSpks.length)}</span> dari <span className="font-medium">{filteredSpks.length}</span> hasil
                      </div>
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => setSpkPage(p => Math.max(1, p - 1))}
                          disabled={spkPage === 1}
                          className="px-3 py-1 border rounded text-sm font-medium disabled:opacity-50"
                        >
                          Sebelumnya
                        </button>
                        <button 
                          onClick={() => setSpkPage(p => Math.min(totalSpkPages, p + 1))}
                          disabled={spkPage === totalSpkPages}
                          className="px-3 py-1 border rounded text-sm font-medium disabled:opacity-50"
                        >
                          Selanjutnya
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* TAB: VEHICLES */}
            {activeTab === 'vehicles' && (() => {
              const totalVehiclePages = Math.ceil(vehicles.length / ROWS_PER_PAGE);
              const currentVehicles = vehicles.slice((vehiclePage - 1) * ROWS_PER_PAGE, vehiclePage * ROWS_PER_PAGE);
              return (
              <div>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full sm:w-auto">
                    <h2 className="text-xl font-bold">Data Kendaraan Dinas</h2>
                    <input
                      type="text"
                      placeholder="Cari Nopol, Merek, atau Sopir..."
                      className="border border-gray-300 rounded-lg px-4 py-2 text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={vehicleSearchQuery}
                      onChange={(e) => setVehicleSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2 items-center w-full sm:w-auto flex-wrap sm:flex-nowrap justify-end">
                    <button onClick={downloadVehicleTemplate} className="text-blue-600 hover:text-blue-800 text-xs font-semibold underline px-2">Template CSV</button>
                    <button onClick={handleExportVehicleCSV} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded text-sm font-medium border border-gray-300">📥 Export CSV</button>
                    <button onClick={() => vehicleFileInputRef.current?.click()} className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded text-sm font-medium border border-blue-200">📤 Import CSV</button>
                    <input type="file" accept=".csv" className="hidden" ref={vehicleFileInputRef} onChange={handleImportVehicleFile} />
                    <button onClick={() => openModal('vehicle')} className={`${btnClass} whitespace-nowrap`}>+ Tambah Kendaraan</button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-600">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="p-3 whitespace-nowrap">No. Polisi</th>
                        <th className="p-3 whitespace-nowrap">Merek / Type</th>
                        <th className="p-3 whitespace-nowrap hidden md:table-cell">Jenis Kendaraan</th>
                        <th className="p-3 whitespace-nowrap">Pengguna / Sopir</th>
                        <th className="p-3 text-center whitespace-nowrap">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentVehicles.map(v => (
                        <tr key={v.id} className="border-b hover:bg-gray-50">
                          <td className="p-3 font-bold uppercase">{v.nomor_polisi}</td>
                          <td className="p-3 capitalize">{v.merek_type?.toLowerCase()}</td>
                          <td className="p-3 hidden md:table-cell capitalize">{v.jenis_kendaraan?.toLowerCase()}</td>
                          <td className="p-3 capitalize">{v.nama_sopir?.toLowerCase()}</td>
                          <td className="p-3 text-center space-x-4">
                            <button onClick={() => openModal('vehicle', v)} className="text-gray-600 hover:text-green-600 transition-colors" title="Edit">✏️</button>
                            <button onClick={() => handleDeleteVehicle(v.id)} className="text-gray-600 hover:text-red-600 transition-colors" title="Hapus">🗑️</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {/* Paginasi Kendaraan */}
                {totalVehiclePages > 1 && (
                  <div className="flex justify-between items-center px-4 py-3 border-t bg-white sm:px-6 mt-2">
                    <div className="text-sm text-gray-700">
                      Menampilkan <span className="font-medium">{(vehiclePage - 1) * ROWS_PER_PAGE + 1}</span> hingga <span className="font-medium">{Math.min(vehiclePage * ROWS_PER_PAGE, vehicles.length)}</span> dari <span className="font-medium">{vehicles.length}</span> hasil
                    </div>
                    <div className="flex space-x-2">
                      <button 
                        onClick={() => setVehiclePage(p => Math.max(1, p - 1))}
                        disabled={vehiclePage === 1}
                        className="px-3 py-1 border rounded text-sm font-medium disabled:opacity-50"
                      >
                        Sebelumnya
                      </button>
                      <button 
                        onClick={() => setVehiclePage(p => Math.min(totalVehiclePages, p + 1))}
                        disabled={vehiclePage === totalVehiclePages}
                        className="px-3 py-1 border rounded text-sm font-medium disabled:opacity-50"
                      >
                        Selanjutnya
                      </button>
                    </div>
                  </div>
                )}
              </div>
              );
            })()}

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
                        <th className="p-3 whitespace-nowrap">Nama Lengkap</th>
                        <th className="p-3 whitespace-nowrap hidden md:table-cell">NIP / NIK</th>
                        <th className="p-3 whitespace-nowrap">Jabatan Cetak</th>
                        <th className="p-3 whitespace-nowrap">Kategori (Role)</th>
                        <th className="p-3 text-center whitespace-nowrap">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {signatories.map(s => (
                        <tr key={s.id} className="border-b hover:bg-gray-50">
                          <td className="p-3 font-bold">{s.nama_lengkap}</td>
                          <td className="p-3 hidden md:table-cell">{s.nip_nik}</td>
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
                        <th className="p-3 whitespace-nowrap">Nama Bengkel</th>
                        <th className="p-3 whitespace-nowrap">Alamat & Kontak</th>
                        <th className="p-3 text-center whitespace-nowrap">Aksi</th>
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
                <SuccessAlert />
                
                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 max-w-xl">
                  <h3 className="font-semibold text-lg text-gray-800 mb-2">Identitas Aplikasi</h3>
                  <p className="text-sm text-gray-500 mb-4">Ubah judul aplikasi dan logo resmi yang muncul pada dokumen cetak SPK maupun navbar.</p>
                  
                  {kopError && (
                    <div className="bg-red-50 border-l-4 border-red-500 p-3 mb-4 text-sm text-red-700 rounded shadow-sm">
                      <p>{kopError}</p>
                      <button type="button" onClick={() => fetchData('settings')} className="text-blue-700 underline mt-1">Coba Muat Ulang</button>
                    </div>
                  )}

                  <fieldset disabled={!kopLoaded || savingKop} className="mb-6 min-w-0 disabled:opacity-60">
                    <label className="block text-xs font-semibold mb-1 text-gray-600">Judul Aplikasi</label>
                    <input 
                      type="text" 
                      className={inputClass} 
                      value={kopSettings.APP_TITLE || ''} 
                      onChange={e => setKopSettings({...kopSettings, APP_TITLE: e.target.value})} 
                      placeholder="SPK Kendaraan UNHAS" 
                    />
                    <div className="mt-2 text-right">
                      <button onClick={e => handleSaveKopSettings(e, true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-semibold text-sm transition-colors shadow-sm">
                        💾 Simpan Judul
                      </button>
                    </div>
                  </fieldset>

                  <hr className="my-6 border-gray-300" />
                  
                  <h4 className="font-semibold text-gray-700 border-b border-gray-300 pb-2 mb-3">Logo Institusi</h4>
                  
                  {logoError && (
                    <div className="bg-red-50 border-l-4 border-red-500 p-3 mb-4 text-sm text-red-700 rounded shadow-sm">
                      <p>{logoError}</p>
                      <button type="button" onClick={() => fetchData('settings')} className="text-blue-700 underline mt-1">Coba Muat Ulang</button>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-6 mb-4">
                    <div className="w-24 h-24 shrink-0 bg-white border border-gray-300 rounded-md flex items-center justify-center overflow-hidden p-2">
                      {logoPreview ? <img src={logoPreview} alt="Logo Preview" className="max-w-full max-h-full object-contain" /> : <span className="text-xs text-gray-400">Tanpa Logo</span>}
                    </div>
                    <div className="min-w-0 max-w-full flex-1 basis-48">
                      <input ref={logoInput} aria-label="Logo Institusi" type="file" accept="image/jpeg,image/png,image/gif" disabled={savingLogo} onChange={handleLogoSelection} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                    </div>
                  </div>
                  <button onClick={handleSaveLogo} disabled={!logoFile || savingLogo} aria-busy={savingLogo} className={`${btnClass} min-w-32 disabled:opacity-50 disabled:cursor-not-allowed`}>{savingLogo ? 'Menyimpan...' : '💾 Simpan Logo'}</button>
                </div>
                
                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 mt-6 max-w-4xl">
                  <h3 className="font-semibold text-lg text-gray-800 mb-2">Teks & Tata Letak Kop Surat</h3>
                  <p className="text-sm text-gray-500 mb-4">Atur baris teks identitas institusi (kiri) dan kontak (kanan).</p>
                  
                  {kopError && (
                    <div className="bg-red-50 border-l-4 border-red-500 p-3 mb-4 text-sm text-red-700 rounded shadow-sm">
                      <p>{kopError}</p>
                    </div>
                  )}

                  <form onSubmit={handleSaveKopSettings} className="space-y-6">
                    <fieldset disabled={!kopLoaded || savingKop} className="min-w-0 space-y-6 disabled:opacity-60">
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
                    </fieldset>
                  </form>
                </div>

                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 mt-6 max-w-4xl mb-8">
                  <h3 className="font-semibold text-lg text-gray-800 mb-2">Pengaturan Teks Lembar Cetak (1-5)</h3>
                  <p className="text-sm text-gray-500 mb-4">Ubah teks statis pada masing-masing lembar SPK. Gunakan <code>{'{'}{'{'}tanggal_laporan{'}'}{'}'}</code> atau <code>{'{'}{'{'}tanggal_masuk_bengkel{'}'}{'}'}</code> untuk menyisipkan variabel tanggal yang dinamis.</p>

                  {lembarError && (
                    <div className="bg-red-50 border-l-4 border-red-500 p-3 mb-4 text-sm text-red-700 rounded shadow-sm">
                      <p>{lembarError}</p>
                    </div>
                  )}

                  <form onSubmit={handleSaveLembarSettings} className="space-y-6">
                    <fieldset disabled={!lembarLoaded || savingLembar} className="min-w-0 space-y-6 disabled:opacity-60">
                      
                      {/* LEMBAR 1 */}
                      <div className="p-4 border border-gray-300 rounded bg-white shadow-sm">
                        <h4 className="font-bold text-gray-800 mb-3 text-lg border-b pb-2">Lembar 1</h4>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-semibold mb-1 text-gray-600">Teks Pengantar</label>
                            <textarea className={inputClass} rows="2" value={lembarSettings.LEMBAR1_PENGANTAR || ''} onChange={e => setLembarSettings({...lembarSettings, LEMBAR1_PENGANTAR: e.target.value})}></textarea>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold mb-1 text-gray-600">Teks Dugaan Kerusakan</label>
                            <textarea className={inputClass} rows="2" value={lembarSettings.LEMBAR1_DUGAAN || ''} onChange={e => setLembarSettings({...lembarSettings, LEMBAR1_DUGAAN: e.target.value})}></textarea>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold mb-1 text-gray-600">Teks Penutup</label>
                            <textarea className={inputClass} rows="2" value={lembarSettings.LEMBAR1_PENUTUP || ''} onChange={e => setLembarSettings({...lembarSettings, LEMBAR1_PENUTUP: e.target.value})}></textarea>
                          </div>
                        </div>
                      </div>

                      {/* LEMBAR 2 */}
                      <div className="p-4 border border-gray-300 rounded bg-white shadow-sm">
                        <h4 className="font-bold text-gray-800 mb-3 text-lg border-b pb-2">Lembar 2</h4>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-semibold mb-1 text-gray-600">Judul Lembar</label>
                            <input type="text" className={inputClass} value={lembarSettings.LEMBAR2_JUDUL || ''} onChange={e => setLembarSettings({...lembarSettings, LEMBAR2_JUDUL: e.target.value})} />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold mb-1 text-gray-600">Teks Pengantar (Gunakan {'{'}{'{'}tanggal_laporan{'}'}{'}'})</label>
                            <textarea className={inputClass} rows="3" value={lembarSettings.LEMBAR2_PENGANTAR || ''} onChange={e => setLembarSettings({...lembarSettings, LEMBAR2_PENGANTAR: e.target.value})}></textarea>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold mb-1 text-gray-600">Teks Penutup</label>
                            <textarea className={inputClass} rows="2" value={lembarSettings.LEMBAR2_PENUTUP || ''} onChange={e => setLembarSettings({...lembarSettings, LEMBAR2_PENUTUP: e.target.value})}></textarea>
                          </div>
                        </div>
                      </div>

                      {/* LEMBAR 3 */}
                      <div className="p-4 border border-gray-300 rounded bg-white shadow-sm">
                        <h4 className="font-bold text-gray-800 mb-3 text-lg border-b pb-2">Lembar 3</h4>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-semibold mb-1 text-gray-600">Judul Lembar</label>
                            <input type="text" className={inputClass} value={lembarSettings.LEMBAR3_JUDUL || ''} onChange={e => setLembarSettings({...lembarSettings, LEMBAR3_JUDUL: e.target.value})} />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold mb-1 text-gray-600">Teks Penutup</label>
                            <textarea className={inputClass} rows="2" value={lembarSettings.LEMBAR3_PENUTUP || ''} onChange={e => setLembarSettings({...lembarSettings, LEMBAR3_PENUTUP: e.target.value})}></textarea>
                          </div>
                        </div>
                      </div>

                      {/* LEMBAR 4 */}
                      <div className="p-4 border border-gray-300 rounded bg-white shadow-sm">
                        <h4 className="font-bold text-gray-800 mb-3 text-lg border-b pb-2">Lembar 4</h4>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-semibold mb-1 text-gray-600">Judul Lembar</label>
                            <input type="text" className={inputClass} value={lembarSettings.LEMBAR4_JUDUL || ''} onChange={e => setLembarSettings({...lembarSettings, LEMBAR4_JUDUL: e.target.value})} />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold mb-1 text-gray-600">Teks Pengantar</label>
                            <textarea className={inputClass} rows="2" value={lembarSettings.LEMBAR4_PENGANTAR || ''} onChange={e => setLembarSettings({...lembarSettings, LEMBAR4_PENGANTAR: e.target.value})}></textarea>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold mb-1 text-gray-600">Teks Pekerjaan</label>
                            <textarea className={inputClass} rows="2" value={lembarSettings.LEMBAR4_PEKERJAAN || ''} onChange={e => setLembarSettings({...lembarSettings, LEMBAR4_PEKERJAAN: e.target.value})}></textarea>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold mb-1 text-gray-600">Teks Penutup</label>
                            <textarea className={inputClass} rows="2" value={lembarSettings.LEMBAR4_PENUTUP || ''} onChange={e => setLembarSettings({...lembarSettings, LEMBAR4_PENUTUP: e.target.value})}></textarea>
                          </div>
                        </div>
                      </div>

                      {/* LEMBAR 5 */}
                      <div className="p-4 border border-gray-300 rounded bg-white shadow-sm">
                        <h4 className="font-bold text-gray-800 mb-3 text-lg border-b pb-2">Lembar 5</h4>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-semibold mb-1 text-gray-600">Judul Lembar</label>
                            <input type="text" className={inputClass} value={lembarSettings.LEMBAR5_JUDUL || ''} onChange={e => setLembarSettings({...lembarSettings, LEMBAR5_JUDUL: e.target.value})} />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold mb-1 text-gray-600">Teks Pengantar (Gunakan {'{'}{'{'}tanggal_masuk_bengkel{'}'}{'}'} dan {'{'}{'{'}tanggal_masuk_terbilang{'}'}{'}'})</label>
                            <textarea className={inputClass} rows="3" value={lembarSettings.LEMBAR5_PENGANTAR || ''} onChange={e => setLembarSettings({...lembarSettings, LEMBAR5_PENGANTAR: e.target.value})}></textarea>
                          </div>
                        </div>
                      </div>

                      <button type="submit" className={btnClass}>💾 Simpan Pengaturan Teks Lembar</button>
                    </fieldset>
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

      {/* Floating Action Bar untuk Bulk Download */}
      {selectedSpkIds.length > 0 && activeTab === 'spk' && (
        <div className="fixed bottom-10 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center space-x-6 z-50 border border-blue-500 transition-all duration-300">
          <div className="flex items-center space-x-2">
            <span className="bg-white text-blue-600 font-bold w-6 h-6 rounded-full flex items-center justify-center text-sm">
              {selectedSpkIds.length}
            </span>
            <span className="font-medium text-sm md:text-base">SPK Terpilih</span>
          </div>
          <button 
            onClick={handleBulkDownload} 
            disabled={isDownloading}
            className="bg-white text-blue-600 px-5 py-2 rounded-full font-bold text-sm hover:bg-gray-50 transition-all disabled:opacity-80 flex items-center gap-2 shadow-sm"
          >
            {isDownloading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                Memproses {downloadProgress.current}/{downloadProgress.total}...
              </>
            ) : (
              <>📥 Unduh ZIP</>
            )}
          </button>
        </div>
      )}

    </div>
  );
};

export default MasterDashboard;
