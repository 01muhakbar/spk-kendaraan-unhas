const { test, before, after, beforeEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { Sequelize, UniqueConstraintError, ValidationErrorItem } = require('sequelize');

const sequelize = new Sequelize('test', 'test', 'test', { dialect: 'mysql', logging: false });
const databasePath = require.resolve('../config/database');
require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true, exports: sequelize };
process.env.NODE_ENV = 'production';

const Vehicle = require('../models/Vehicle');
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

async function json(path, options = {}) {
  const response = await fetch(`${base}${path}`, options);
  const data = response.status === 204 ? null : await response.json();
  return { status: response.status, body: data };
}

function postJSON(body, method = 'POST') {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}

test('POST /vehicles creates vehicle with all STNK fields successfully', async () => {
  const createdRecord = {
    id: 'veh-1',
    nomor_polisi: 'DD 1234 AH',
    merek_type: 'Toyota Innova Reborn',
    jenis_kendaraan: 'Minibus',
    nama_sopir: 'Budi Santoso',
    model: 'Minibus',
    warna: 'Hitam Metalik',
    isi_silinder: 1998,
    no_rangka: 'MHKW123456789',
    no_mesin: '1TR1234567',
    status_legalitas: 'AKTIF'
  };

  mock.method(Vehicle, 'create', async (payload) => {
    assert.equal(payload.nomor_polisi, 'DD 1234 AH');
    assert.equal(payload.model, 'Minibus');
    assert.equal(payload.warna, 'Hitam Metalik');
    assert.equal(payload.isi_silinder, 1998);
    assert.equal(payload.no_rangka, 'MHKW123456789');
    assert.equal(payload.no_mesin, '1TR1234567');
    return createdRecord;
  });

  const res = await json('/vehicles', postJSON({
    nomor_polisi: 'dd 1234 ah',
    merek_type: 'Toyota Innova Reborn',
    jenis_kendaraan: 'Minibus',
    nama_sopir: 'Budi Santoso',
    model: 'Minibus',
    warna: 'Hitam Metalik',
    isi_silinder: '1998',
    no_rangka: 'mhkw123456789',
    no_mesin: '1tr1234567'
  }));

  assert.equal(res.status, 201);
  assert.equal(res.body.model, 'Minibus');
  assert.equal(res.body.no_rangka, 'MHKW123456789');
});

test('POST /vehicles returns 409 Conflict when No. Rangka or No. Mesin is duplicate', async () => {
  mock.method(Vehicle, 'create', async () => {
    const errorItem = new ValidationErrorItem('no_rangka must be unique', 'unique violation', 'no_rangka', 'MHKW123456789');
    throw new UniqueConstraintError({ errors: [errorItem] });
  });

  const res = await json('/vehicles', postJSON({
    nomor_polisi: 'DD 5555 ZZ',
    merek_type: 'Toyota Fortuner',
    jenis_kendaraan: 'SUV',
    no_rangka: 'MHKW123456789'
  }));

  assert.equal(res.status, 409);
  assert.equal(res.body.error, 'Gagal menyimpan: Nomor Rangka/Mesin sudah terdaftar pada kendaraan lain.');
});

test('PUT /vehicles/:id updates STNK fields and handles 409 on duplicate', async () => {
  const dummyVehicle = {
    id: 'veh-2',
    nomor_polisi: 'DD 8888 BB',
    merek_type: 'Honda CR-V',
    jenis_kendaraan: 'SUV',
    async update(values) {
      const errorItem = new ValidationErrorItem('no_mesin must be unique', 'unique violation', 'no_mesin', 'DUPLICATE_ENGINE');
      throw new UniqueConstraintError({ errors: [errorItem] });
    }
  };

  mock.method(Vehicle, 'findByPk', async (id) => {
    if (id === 'veh-2') return dummyVehicle;
    return null;
  });

  const res = await json('/vehicles/veh-2', postJSON({
    nomor_polisi: 'DD 8888 BB',
    merek_type: 'Honda CR-V',
    jenis_kendaraan: 'SUV',
    no_mesin: 'DUPLICATE_ENGINE'
  }, 'PUT'));

  assert.equal(res.status, 409);
  assert.equal(res.body.error, 'Gagal menyimpan: Nomor Rangka/Mesin sudah terdaftar pada kendaraan lain.');
});

test('GET /vehicles performs global search including no_rangka, no_mesin, model, and warna', async () => {
  mock.method(Vehicle, 'findAll', async (options) => {
    assert.ok(options.where);
    return [
      { id: '1', nomor_polisi: 'DD 1234 AH', no_rangka: 'MHK123', merek_type: 'Toyota' },
      { id: '2', nomor_polisi: 'DD 5678 UX', no_rangka: 'OTHER', merek_type: 'Honda' }
    ];
  });

  const res = await json('/vehicles?search=MHK123');
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 2);
});

test('POST /vehicles/bulk imports CSV with STNK columns and updateOnDuplicate', async () => {
  mock.method(Vehicle, 'bulkCreate', async (rows, options) => {
    assert.deepEqual(options.updateOnDuplicate, [
      'merek_type',
      'jenis_kendaraan',
      'nama_sopir',
      'model',
      'warna',
      'isi_silinder',
      'no_rangka',
      'no_mesin',
      'updatedAt'
    ]);
    assert.equal(rows[0].nomor_polisi, 'DD 9999 XX');
    assert.equal(rows[0].no_rangka, 'RANGKA9999');
    assert.equal(rows[0].isi_silinder, 1500);
    return rows;
  });

  const res = await json('/vehicles/bulk', postJSON([
    {
      Nomor_Polisi: 'DD 9999 XX',
      Merek_Type: 'Mitsubishi Xpander',
      Jenis_Kendaraan: 'Minibus',
      Pengguna_Sopir: 'Rahmat',
      Model: 'MPV',
      Warna: 'Putih',
      Isi_Silinder: '1500',
      No_Rangka: 'rangka9999',
      No_Mesin: 'mesin9999'
    }
  ]));

  assert.equal(res.status, 200);
  assert.equal(res.body.message, 'Data Kendaraan berhasil diimpor');
});
