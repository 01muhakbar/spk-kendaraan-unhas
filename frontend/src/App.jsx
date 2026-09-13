import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { fetchLogo, fetchKop, resolveLogoUrl } from './settings';
import MasterDashboard from './pages/MasterDashboard';
import CreateSPK from './pages/CreateSPK';
import PrintSPK from './pages/PrintSPK';
import EditSPK from './pages/EditSPK';

function App() {
  const [logoUrl, setLogoUrl] = useState(null);

  const [appTitle, setAppTitle] = useState('SPK Kendaraan UNHAS');

  useEffect(() => {
    const controller = new AbortController();
    const fetchSettings = async () => {
      const options = { signal: controller.signal };
      const [logo, kop] = await Promise.allSettled([fetchLogo(options), fetchKop(options)]);
      if (controller.signal.aborted) return;
      if (logo.status === 'fulfilled') setLogoUrl(resolveLogoUrl(logo.value.logo_url));
      if (kop.status === 'fulfilled') setAppTitle(kop.value.APP_TITLE || 'SPK Kendaraan UNHAS');
      for (const result of [logo, kop]) {
        if (result.status === 'rejected') console.error('Gagal memuat pengaturan aplikasi:', result.reason);
      }
    };
    fetchSettings();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!logoUrl) return;
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = logoUrl;
  }, [logoUrl]);

  const handleSettingsSaved = (settings) => {
    if (Object.hasOwn(settings, 'logo_url')) setLogoUrl(resolveLogoUrl(settings.logo_url));
    if (Object.hasOwn(settings, 'APP_TITLE')) setAppTitle(settings.APP_TITLE || 'SPK Kendaraan UNHAS');
  };
  return (
    <Router>
      <div className="min-h-screen flex flex-col bg-gray-100">
        <nav className="bg-blue-800 text-white p-4 shadow-md print:hidden">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              {logoUrl && (
                <div className="bg-white p-1 rounded-md shadow-sm flex items-center justify-center">
                  <img src={logoUrl} alt="Logo" className="h-8 w-8 object-contain" />
                </div>
              )}
              <Link to="/" className="text-xl font-bold tracking-wide text-center sm:text-left">{appTitle}</Link>
            </div>
            <div className="space-x-4 flex items-center">
              <Link to="/" className="hover:text-blue-200 transition-colors hidden sm:inline">Master Dashboard</Link>
              <Link to="/create-spk" className="bg-white text-blue-800 px-4 py-2 rounded-md font-bold hover:bg-gray-100 transition-colors shadow-sm text-sm sm:text-base">
                + Buat SPK
              </Link>
            </div>
          </div>
        </nav>
        
        <main className="flex-1 w-full print:p-0 print:m-0">
          <Routes>
            <Route path="/" element={<MasterDashboard onSettingsSaved={handleSettingsSaved} />} />
            <Route path="/create-spk" element={<CreateSPK />} />
            <Route path="/edit-spk/:id" element={<EditSPK />} />
            <Route path="/print/:id" element={<PrintSPK />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
