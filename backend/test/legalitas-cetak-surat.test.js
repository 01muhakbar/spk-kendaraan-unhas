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
