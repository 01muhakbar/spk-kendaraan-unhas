import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

const BudgetWidget = () => {
  const [data, setData] = useState({ totalBudget: 0, vehicleCount: 0, details: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBudget = async () => {
      try {
        const res = await axios.get(`${API}/analytics/budget-proyeksi`);
        setData(res.data);
      } catch (err) {
        console.error('Gagal memuat proyeksi anggaran', err);
      } finally {
        setLoading(false);
      }
    };
    fetchBudget();
  }, []);

  if (loading) {
    return <div className="animate-pulse bg-blue-50 p-4 rounded-lg">Memuat analitik anggaran...</div>;
  }

  if (data.vehicleCount === 0) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white p-6 rounded-xl shadow-lg mb-6 flex flex-col md:flex-row items-center justify-between">
      <div>
        <h3 className="text-blue-100 text-sm font-bold tracking-wider uppercase mb-1">Proyeksi Anggaran Pajak Bulan Depan</h3>
        <p className="text-3xl font-extrabold tracking-tight">
          Rp {data.totalBudget.toLocaleString('id-ID')}
        </p>
        <p className="text-sm mt-1 text-blue-200">
          Diperlukan untuk {data.vehicleCount} kendaraan yang jatuh tempo.
        </p>
      </div>
      <div className="mt-4 md:mt-0 text-3xl opacity-50 hover:opacity-100 transition-opacity cursor-default">
        📊
      </div>
    </div>
  );
};

export default BudgetWidget;
