import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || (import.meta.env.PROD ? '' : 'http://localhost:5000');
const API = import.meta.env.VITE_API_URL || `${API_BASE}/api/v1`;

const ModalCetakSuratSamsat = ({ isOpen, onClose, vehicle, signatories: initialSignatories = [] }) => {
  const currentYear = new Date().getFullYear();
  const defaultNomorSurat = `65969/UN4.1.6.1.3/PL.10.04/${currentYear}`;

  const [nomorSurat, setNomorSurat] = useState(defaultNomorSurat);
  const [pemberiKuasaId, setPemberiKuasaId] = useState('');
  const [penerimaKuasaId, setPenerimaKuasaId] = useState('');
  const [signatoriesList, setSignatoriesList] = useState(initialSignatories);
  const [loadingSignatories, setLoadingSignatories] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Fetch signatories if not provided or empty
  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setSuccessMsg('');
      setNomorSurat(defaultNomorSurat);

      if (initialSignatories && initialSignatories.length > 0) {
        setSignatoriesList(initialSignatories);
        autoSelectSignatories(initialSignatories);
      } else {
        setLoadingSignatories(true);
        axios.get(`${API}/signatories`)
          .then(res => {
            setSignatoriesList(res.data);
            autoSelectSignatories(res.data);
          })
          .catch(err => {
            console.error('Gagal memuat pejabat:', err);
            setErrorMsg('Gagal memuat daftar pejabat: ' + (err.response?.data?.error || err.message));
          })
          .finally(() => {
            setLoadingSignatories(false);
          });
      }
    }
  }, [isOpen, vehicle]);

  const autoSelectSignatories = (list) => {
    if (!list || list.length === 0) return;

    // Pemberi Kuasa: Prioritaskan KASUBDIT atau jabatan yang mengandung Kasubdit / Kepala
    const kasubdit = list.find(s => 
      s.kategori_peran === 'KASUBDIT' || 
      (s.jabatan && s.jabatan.toLowerCase().includes('kasubdit')) ||
      (s.jabatan && s.jabatan.toLowerCase().includes('kepala subdirektorat'))
    );
    if (kasubdit) {
      setPemberiKuasaId(kasubdit.id);
    } else {
      setPemberiKuasaId(list[0].id);
    }

    // Penerima Kuasa: Prioritaskan TEKNISI atau staf operasional
    const teknisi = list.find(s => 
      s.kategori_peran === 'TEKNISI' || 
      (s.jabatan && s.jabatan.toLowerCase().includes('teknisi')) ||
      (s.jabatan && s.jabatan.toLowerCase().includes('staf'))
    );
    if (teknisi) {
      setPenerimaKuasaId(teknisi.id);
    } else if (list.length > 1) {
      setPenerimaKuasaId(list[1].id);
    } else {
      setPenerimaKuasaId(list[0].id);
    }
  };

  if (!isOpen || !vehicle) return null;

  const kasubditList = signatoriesList.filter(s => 
    s.kategori_peran === 'KASUBDIT' || 
    (s.jabatan && s.jabatan.toLowerCase().includes('kasubdit'))
  );
  const otherPemberiList = signatoriesList.filter(s => !kasubditList.includes(s));

  const teknisiList = signatoriesList.filter(s => 
    s.kategori_peran === 'TEKNISI' || 
    (s.jabatan && s.jabatan.toLowerCase().includes('teknisi')) ||
    (s.jabatan && s.jabatan.toLowerCase().includes('staf'))
  );
  const otherPenerimaList = signatoriesList.filter(s => !teknisiList.includes(s));

  const handleGeneratePdf = async (e) => {
    e.preventDefault();
    if (!nomorSurat.trim()) {
      setErrorMsg('Nomor surat wajib diisi.');
      return;
    }
    if (!pemberiKuasaId) {
      setErrorMsg('Pemberi kuasa wajib dipilih.');
      return;
    }
    if (!penerimaKuasaId) {
      setErrorMsg('Penerima kuasa wajib dipilih.');
      return;
    }

    setIsGenerating(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const payload = {
        vehicleId: vehicle.id,
        nomorSurat: nomorSurat.trim(),
        pemberiKuasaId,
        penerimaKuasaId
      };

      const response = await axios.post(`${API}/legalitas/cetak-surat`, payload, {
        responseType: 'blob'
      });

      // Construct filename from vehicle or header
      let filename = `Surat_Kuasa_SAMSAT_${(vehicle.nomor_polisi || 'KENDARAAN').replace(/\s+/g, '_')}_${currentYear}.pdf`;
      const disposition = response.headers['content-disposition'];
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (match && match[1]) {
          filename = match[1].replace(/['"]/g, '');
        }
      }

      // Create blob download
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setSuccessMsg('Surat Rekomendasi & Kuasa SAMSAT berhasil dibuat dan diunduh!');
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Error saat cetak surat:', err);
      // In case server responded with error blob containing JSON
      if (err.response && err.response.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const parsed = JSON.parse(text);
          setErrorMsg(parsed.error || 'Gagal membuat dokumen surat');
        } catch {
          setErrorMsg('Gagal membuat dokumen surat SAMSAT: ' + (err.message || 'Server error'));
        }
      } else {
        setErrorMsg(err.response?.data?.error || err.message || 'Terjadi kesalahan sistem');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-opacity">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Header Modal */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 p-5 text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="text-2xl p-2 bg-white/10 rounded-lg">📄</span>
            <div>
              <h3 className="text-lg font-bold leading-tight">Konfigurasi Surat Rekomendasi & Kuasa SAMSAT</h3>
              <p className="text-xs text-blue-100 mt-0.5">Penerbitan surat pengurusan STNK & Pajak resmi UNHAS</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors text-lg"
            title="Tutup"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleGeneratePdf} className="p-6 space-y-4">
          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg flex items-start gap-2">
              <span className="font-bold text-red-600">⚠️</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="bg-green-50 border border-green-200 text-green-700 text-sm p-3 rounded-lg flex items-start gap-2">
              <span className="font-bold text-green-600">✅</span>
              <span>{successMsg}</span>
            </div>
          )}

          {/* Vehicle Info Badge */}
          <div className="bg-blue-50/70 border border-blue-200/80 rounded-lg p-3.5">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[11px] font-semibold tracking-wider text-blue-600 uppercase">Aset Kendaraan Terpilih</span>
                <h4 className="text-base font-bold text-gray-900 mt-0.5">{vehicle.nomor_polisi}</h4>
                <p className="text-xs text-gray-600 font-medium">
                  {vehicle.merek_type} {vehicle.model ? `• ${vehicle.model}` : ''}
                </p>
              </div>
              <div className="text-right text-xs text-gray-500">
                <span className="block font-mono bg-white px-2 py-0.5 rounded border border-blue-200 text-gray-700">
                  {vehicle.no_mesin ? `Mesin: ${vehicle.no_mesin}` : 'Mesin: -'}
                </span>
                <span className="block font-mono bg-white px-2 py-0.5 rounded border border-blue-200 text-gray-700 mt-1">
                  {vehicle.no_rangka ? `Rangka: ${vehicle.no_rangka}` : 'Rangka: -'}
                </span>
              </div>
            </div>
          </div>

          {/* Input Nomor Surat */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">
              Nomor Surat Keluar <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={nomorSurat}
              onChange={(e) => setNomorSurat(e.target.value)}
              placeholder="Contoh: 65969/UN4.1.6.1.3/PL.10.04/2026"
              className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-xs"
            />
            <p className="text-[11px] text-gray-500 mt-1">
              Format registrasi surat resmi universitas (Direktorat Logistik / Rumah Tangga).
            </p>
          </div>

          {/* Dropdown Pemberi Kuasa */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">
              Pemberi Kuasa (Pejabat Berwenang) <span className="text-red-500">*</span>
            </label>
            <select
              value={pemberiKuasaId}
              onChange={(e) => setPemberiKuasaId(e.target.value)}
              required
              disabled={loadingSignatories}
              className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-xs bg-white disabled:bg-gray-100"
            >
              <option value="">-- Pilih Pejabat Pemberi Kuasa --</option>
              {kasubditList.length > 0 && (
                <optgroup label="Kepala Subdirektorat (Direkomendasikan)">
                  {kasubditList.map(s => (
                    <option key={`pemberi-${s.id}`} value={s.id}>
                      {s.nama_lengkap} — {s.jabatan} (NIP: {s.nip_nik || '-'})
                    </option>
                  ))}
                </optgroup>
              )}
              {otherPemberiList.length > 0 && (
                <optgroup label="Pejabat / Pegawai Lainnya">
                  {otherPemberiList.map(s => (
                    <option key={`pemberi-other-${s.id}`} value={s.id}>
                      {s.nama_lengkap} — {s.jabatan} ({s.kategori_peran})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <p className="text-[11px] text-gray-500 mt-1">
              Pihak Pertama yang bertindak atas nama Universitas Hasanuddin.
            </p>
          </div>

          {/* Dropdown Penerima Kuasa */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">
              Penerima Kuasa (Staf Operasional / Teknisi) <span className="text-red-500">*</span>
            </label>
            <select
              value={penerimaKuasaId}
              onChange={(e) => setPenerimaKuasaId(e.target.value)}
              required
              disabled={loadingSignatories}
              className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-xs bg-white disabled:bg-gray-100"
            >
              <option value="">-- Pilih Penerima Kuasa --</option>
              {teknisiList.length > 0 && (
                <optgroup label="Staf Operasional / Teknisi (Direkomendasikan)">
                  {teknisiList.map(s => (
                    <option key={`penerima-${s.id}`} value={s.id}>
                      {s.nama_lengkap} — {s.jabatan} (NIP/NIK: {s.nip_nik || '-'})
                    </option>
                  ))}
                </optgroup>
              )}
              {otherPenerimaList.length > 0 && (
                <optgroup label="Pegawai Lainnya">
                  {otherPenerimaList.map(s => (
                    <option key={`penerima-other-${s.id}`} value={s.id}>
                      {s.nama_lengkap} — {s.jabatan} ({s.kategori_peran})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <p className="text-[11px] text-gray-500 mt-1">
              Pihak Kedua yang ditugaskan melakukan pengurusan dokumen langsung di SAMSAT.
            </p>
          </div>

          {/* Footer Buttons */}
          <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isGenerating}
              className="px-4 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isGenerating || loadingSignatories}
              className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Membuat PDF...</span>
                </>
              ) : (
                <>
                  <span>📥</span>
                  <span>Generate & Unduh PDF</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ModalCetakSuratSamsat;
