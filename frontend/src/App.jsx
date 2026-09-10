import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import axios from 'axios';
import MasterDashboard from './pages/MasterDashboard';
import CreateSPK from './pages/CreateSPK';
import PrintSPK from './pages/PrintSPK';
import EditSPK from './pages/EditSPK';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';
const API = import.meta.env.VITE_API_URL || `${API_BASE}/api/v1`;

function App() {
  const [logoUrl, setLogoUrl] = useState(null);

  const [appTitle, setAppTitle] = useState('SPK Kendaraan UNHAS');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const [logoRes, kopRes] = await Promise.all([
          axios.get(`${API}/settings/logo`),
          axios.get(`${API}/settings/kop`)
        ]);

        if (logoRes.data.logo_url) {
          const fullLogoUrl = `${API_BASE}${logoRes.data.logo_url}`;
          setLogoUrl(fullLogoUrl);
          
          // Inject favicon
          let link = document.querySelector("link[rel~='icon']");
          if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
          }
          link.href = fullLogoUrl;
        }

        if (kopRes.data && kopRes.data.APP_TITLE) {
          setAppTitle(kopRes.data.APP_TITLE);
        }
      } catch (err) {
        console.error('Gagal memuat pengaturan aplikasi:', err);
      }
    };
    fetchSettings();
  }, []);
  return (
    <Router>
      <div className="min-h-screen flex flex-col bg-gray-100">
        <nav className="bg-blue-800 text-white p-4 shadow-md print:hidden">
          <div className="max-w-6xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-3">
              {logoUrl && (
                <div className="bg-white p-1 rounded-md shadow-sm flex items-center justify-center">
                  <img src={logoUrl} alt="Logo" className="h-8 w-8 object-contain" />
                </div>
              )}
              <Link to="/" className="text-xl font-bold tracking-wide">{appTitle}</Link>
            </div>
            <div className="space-x-4">
              <Link to="/" className="hover:text-blue-200 transition-colors">Master Dashboard</Link>
              <Link to="/create-spk" className="bg-white text-blue-800 px-4 py-2 rounded-md font-bold hover:bg-gray-100 transition-colors shadow-sm">
                + Buat SPK
              </Link>
            </div>
          </div>
        </nav>
        
        <main className="flex-1 w-full print:p-0 print:m-0">
          <Routes>
            <Route path="/" element={<MasterDashboard />} />
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
