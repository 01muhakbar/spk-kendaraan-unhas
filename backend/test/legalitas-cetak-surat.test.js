const { test, before, after, beforeEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('test', 'test', 'test', { dialect: 'mysql', logging: false });
const databasePath = require.resolve('../config/database');
require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true, exports: sequelize };
process.env.NODE_ENV = 'production';

const { Vehicle, Signatory, SystemSetting } = require('../models');
const app = require('../index');

let server, base;

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}/api/v1`;
});

after(async () => {
  mock.restoreAll();
  await new Promise(resolve => server.close(resolve));
  await sequelize.close();
});

beforeEach(() => {
  mock.restoreAll();
});

test('POST /legalitas/cetak-surat returns 400 if required parameters are missing', async () => {
  const res = await fetch(`${base}/legalitas/cetak-surat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vehicleId: 'v-1' })
  });

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.match(data.error, /Parameter tidak lengkap/);
});

test('POST /legalitas/cetak-surat returns 404 if vehicle is not found', async () => {
  mock.method(Vehicle, 'findOne', async () => null);
  mock.method(Vehicle, 'findByPk', async () => null);

  const res = await fetch(`${base}/legalitas/cetak-surat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      vehicleId: 'v-404',
      pemberiKuasaId: 'p-1',
      penerimaKuasaId: 'p-2',
      nomorSurat: '65969/UN4.1.6.1.3/PL.10.04/2026'
    })
  });

  assert.equal(res.status, 404);
  const data = await res.json();
  assert.equal(data.error, 'Data kendaraan tidak ditemukan.');
});

test('POST /legalitas/cetak-surat successfully returns PDF binary with correct headers', async () => {
  const mockVehicle = {
    id: 'v-100',
    nomor_polisi: 'DD 1234 AH',
    merek_type: 'Toyota Innova Reborn',
    model: 'Minibus',
    warna: 'Hitam Metalik',
    isi_silinder: 1998,
    no_rangka: 'MHKW123456789',
    no_mesin: '1TR1234567'
  };

  const mockPemberi = {
    id: 'p-1',
    nama_lengkap: 'Dr. Pemberi Kuasa, M.Si',
    nip_nik: '197501012000011001',
    jabatan: 'Kepala Subdirektorat Pengelolaan Aset'
  };

  const mockPenerima = {
    id: 'p-2',
    nama_lengkap: 'Staf Penerima Kuasa, S.Kom',
    nip_nik: '198502022010011002',
    jabatan: 'Staf Operasional Kendaraan Dinas'
  };

  mock.method(Vehicle, 'findOne', async () => mockVehicle);
  mock.method(Vehicle, 'findByPk', async () => mockVehicle);
  mock.method(Signatory, 'findByPk', async (id) => {
    if (id === 'p-1') return mockPemberi;
    if (id === 'p-2') return mockPenerima;
    return null;
  });
  mock.method(SystemSetting, 'findAll', async () => [
    { setting_key: 'KOP_KIRI_1', setting_value: 'KEMENTERIAN PENDIDIKAN TINGGI, SAINS,' },
    { setting_key: 'KOP_KIRI_2', setting_value: 'DAN TEKNOLOGI' },
    { setting_key: 'KOP_KIRI_3', setting_value: 'UNIVERSITAS HASANUDDIN' }
  ]);

  const res = await fetch(`${base}/legalitas/cetak-surat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      vehicleId: 'v-100',
      pemberiKuasaId: 'p-1',
      penerimaKuasaId: 'p-2',
      perihalSurat: 'Pembayaran Pajak Tahunan Dan Pergantian STNK',
      nomorSurat: '65969/UN4.1.6.1.3/PL.10.04/2026'
    })
  });

  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'application/pdf');
  const contentDisp = res.headers.get('content-disposition');
  assert.match(contentDisp, /Surat_Kuasa_SAMSAT_DD_1234_AH/);

  const arrayBuffer = await res.arrayBuffer();
  assert.ok(arrayBuffer.byteLength > 1000);
  // Verify PDF magic header bytes "%PDF"
  const header = Buffer.from(arrayBuffer.slice(0, 4)).toString('ascii');
  assert.equal(header, '%PDF');
});

test('POST /legalitas/cetak-surat returns 400 if penerimaKuasaId is missing', async () => {
  const res = await fetch(`${base}/legalitas/cetak-surat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      vehicleId: 'v-100',
      pemberiKuasaId: 'p-1',
      nomorSurat: '65969/UN4.1.6.1.3/PL.10.04/2026'
    })
  });

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.match(data.error, /penerimaKuasaId wajib diisi/);
});

test('pdfkitFontResolver successfully resolves missing font requests to local standard-fonts', () => {
  const { localFontsDir } = require('../services/pdfkitFontResolver');
  const fs = require('fs');
  const path = require('path');

  assert.ok(fs.existsSync(path.join(localFontsDir, 'Helvetica.cjs')));
  assert.ok(fs.existsSync(path.join(localFontsDir, 'HelveticaBold.cjs')));
  assert.ok(fs.existsSync(path.join(localFontsDir, 'TimesRoman.cjs')));
  assert.ok(fs.existsSync(path.join(localFontsDir, 'TimesBold.cjs')));

  // Test loading standard font via simulated serverless path
  const simulatedPath = '/var/task/backend/node_modules/pdfkit/js/standard-fonts/Helvetica.cjs';
  const resolvedFont = require(simulatedPath);
  assert.equal(resolvedFont.name, 'Helvetica');
});

test('formatWheelDescription correctly maps wheel counts and falls back to smart inference', () => {
  const { formatWheelDescription } = require('../services/samsatPdfGenerator');

  // Explicit counts
  assert.equal(formatWheelDescription(2), 'roda 2 (dua)');
  assert.equal(formatWheelDescription('2'), 'roda 2 (dua)');
  assert.equal(formatWheelDescription(3), 'roda 3 (tiga)');
  assert.equal(formatWheelDescription(4), 'roda 4 (empat)');
  assert.equal(formatWheelDescription(6), 'roda 6 (enam)');
  assert.equal(formatWheelDescription(8), 'roda 8 (delapan)');
  assert.equal(formatWheelDescription(10), 'roda 10 (sepuluh)');

  // Fallback smart inference when null or undefined
  assert.equal(formatWheelDescription(null, 'Sepeda Motor', 'Honda Beat'), 'roda 2 (dua)');
  assert.equal(formatWheelDescription(null, 'Motor Roda Tiga', 'Viar'), 'roda 3 (tiga)');
  assert.equal(formatWheelDescription(null, 'Bus Kampus', 'Hino Dutro'), 'roda 6 (enam)');
  assert.equal(formatWheelDescription(null, 'Truk Tangki Air', 'Dyna'), 'roda 6 (enam)');
  assert.equal(formatWheelDescription(null, 'MB PENUMPANG', 'MINIBUS'), 'roda 4 (empat)');
  assert.equal(formatWheelDescription(null, 'Sedan', 'Toyota Camry'), 'roda 4 (empat)');
});

test('POST /legalitas/cetak-surat accepts explicit jumlahRoda parameter', async () => {
  const mockVehicle = {
    id: 'v-200',
    nomor_polisi: 'DD 6789 BUS',
    merek_type: 'Hino Bus',
    jenis_kendaraan: 'Bus Besar',
    model: 'Bus',
    warna: 'Merah',
    isi_silinder: 4000,
    jumlah_roda: 6,
    no_rangka: 'RANGKABUS1234',
    no_mesin: 'MESINBUS1234'
  };

  const mockPemberi = {
    id: 'p-1',
    nama_lengkap: 'Baharuddin, S.S., M. Si.',
    nip_nik: '197512172014091003',
    jabatan: 'Kepala Subdit. Kerumahtanggaan dan Keprotokolan'
  };

  const mockPenerima = {
    id: 'p-2',
    nama_lengkap: 'Syaripuddin, S.E',
    nip_nik: '198508272018015001',
    jabatan: 'Tim Teknisi Otomotif'
  };

  mock.method(Vehicle, 'findOne', async () => mockVehicle);
  mock.method(Vehicle, 'findByPk', async () => mockVehicle);
  mock.method(Signatory, 'findByPk', async (id) => (id === 'p-1' ? mockPemberi : mockPenerima));
  mock.method(SystemSetting, 'findAll', async () => []);

  const res = await fetch(`${base}/legalitas/cetak-surat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      vehicleId: 'v-200',
      pemberiKuasaId: 'p-1',
      penerimaKuasaId: 'p-2',
      nomorSurat: '65969/UN4.1.6.1.3/PL.10.04/2026',
      perihalSurat: 'Pembayaran Pajak Tahunan dan Pergantian STNK',
      jumlahRoda: 6
    })
  });

  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'application/pdf');
  const arrayBuffer = await res.arrayBuffer();
  assert.ok(arrayBuffer.byteLength > 1000);
});
