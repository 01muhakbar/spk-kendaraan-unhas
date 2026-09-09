require('dotenv').config();
const { syncDatabase, Vehicle, Signatory, VendorMaster } = require('./models');

const seedData = async () => {
  await syncDatabase();

  console.log('Seeding Master Kendaraan...');
  await Vehicle.bulkCreate([
    { nomor_polisi: 'DD 1234 AH', merek_type: 'Toyota Innova Reborn', jenis_kendaraan: 'Minibus', nama_sopir: 'Budi Santoso' },
    { nomor_polisi: 'DD 5678 UX', merek_type: 'Honda HR-V', jenis_kendaraan: 'SUV', nama_sopir: 'Ahmad Yani' },
    { nomor_polisi: 'DD 9012 BB', merek_type: 'Toyota Avanza', jenis_kendaraan: 'Minibus', nama_sopir: 'Rudi Hartono' },
  ], { ignoreDuplicates: true });

  console.log('Seeding Master SDM Pejabat...');
  await Signatory.bulkCreate([
    {
      nama_lengkap: 'Dr. Sawedi Muhammad, S.Sos., M.Sc',
      nip_nik: '197109082022043001',
      jabatan: 'Direktur Komunikasi / Sekretariat Rektor',
      kategori_peran: 'DIREKTUR'
    },
    {
      nama_lengkap: 'Baharuddin, S.S., M. Si.',
      nip_nik: '197512172014091003',
      jabatan: 'Kepala Subdit. Kerumahtanggaan dan Keprotokolan',
      kategori_peran: 'KASUBDIT'
    },
    {
      nama_lengkap: 'Jayadi Arifin, SE',
      nip_nik: '197209162014091001',
      jabatan: 'Kepala Seksi Tata Usaha dan Rumah Tangga',
      kategori_peran: 'KASI_TU'
    },
    {
      nama_lengkap: 'Arifuddin, ST',
      nip_nik: '7371123008640002',
      jabatan: 'Tim Teknisi Otomotif',
      kategori_peran: 'TEKNISI'
    },
    {
      nama_lengkap: 'Syaripuddin, S.E',
      nip_nik: '198508272018015001',
      jabatan: 'Tim Teknisi Otomotif',
      kategori_peran: 'TEKNISI'
    },
  ], { ignoreDuplicates: true });

  console.log('Seeding Master Vendor/Bengkel...');
  await VendorMaster.bulkCreate([
    { nama_bengkel: 'Kalla Toyota Makassar', alamat_kontak: 'Jl. Urip Sumoharjo No.1, Makassar | 0411-123456' },
    { nama_bengkel: 'Honda Remaja Motor', alamat_kontak: 'Jl. Veteran Selatan No.12, Makassar | 0411-654321' },
    { nama_bengkel: 'Bengkel Resmi Daihatsu Makassar', alamat_kontak: 'Jl. Sultan Alauddin No.88, Makassar | 0411-887766' },
  ], { ignoreDuplicates: true });

  console.log('✅ Seeding Master Data v1 selesai!');
  process.exit(0);
};

seedData().catch(err => {
  console.error('❌ Seeding gagal:', err.message);
  process.exit(1);
});
