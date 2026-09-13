const { test, before, after, beforeEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { Writable } = require('node:stream');
const { once } = require('node:events');
const { Sequelize } = require('sequelize');

// Use real models, routes, Express and Multer without connecting to external services.
const sequelize = new Sequelize('test', 'test', 'test', { dialect: 'mysql', logging: false });
const databasePath = require.resolve('../config/database');
require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true, exports: sequelize };
process.env.NODE_ENV = 'production';
const models = require('../models');
const cloudinary = require('cloudinary').v2;
const app = require('../index');
let server, base, settings, uploads, deleted, uploadError, writeError, readError, reloadError, record;
const logoURL = 'https://res.cloudinary.com/test/image/upload/new-logo.png';

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
  settings = new Map();
  uploads = 0;
  deleted = [];
  uploadError = writeError = readError = reloadError = null;
  record = { id: 'spk-test', status: 'DRAFT', vehicle: { nomor_polisi: 'TEST' }, vendor: { nama_bengkel: 'TEST' } };
  mock.method(models.SystemSetting, 'findOne', async () => {
    if (readError) throw readError;
    return settings.has('LOGO_KOP_SURAT') ? { setting_value: settings.get('LOGO_KOP_SURAT') } : null;
  });
  mock.method(models.SystemSetting, 'findAll', async () => [...settings].map(([setting_key, setting_value]) => ({ setting_key, setting_value })));
  mock.method(models.SystemSetting, 'upsert', async (values) => {
    if (writeError) throw writeError;
    settings.set(values.setting_key, values.setting_value);
  });
  mock.method(sequelize, 'transaction', async (callback) => {
    const beforeSettings = new Map(settings);
    const beforeRecord = structuredClone(record);
    try { return await callback({ id: 'test-transaction' }); }
    catch (error) { settings = beforeSettings; record = beforeRecord; throw error; }
  });
  const checkIncludes = options => {
    assert.deepEqual(options.include, [
      { model: models.Vehicle, as: 'vehicle' },
      { model: models.VendorMaster, as: 'vendor' }
    ]);
  };
  mock.method(models.SPK, 'findAll', async (options) => {
    checkIncludes(options);
    return [record];
  });
  mock.method(models.SPK, 'findByPk', async (id, options) => {
    checkIncludes(options);
    if (id !== record.id) return null;
    return {
      ...record,
      async update(values, { transaction }) {
        assert.ok(transaction);
        Object.assign(record, values);
      },
      async reload({ transaction }) {
        assert.ok(transaction);
        if (reloadError) throw reloadError;
        return record;
      }
    };
  });
  mock.method(cloudinary.uploader, 'upload_stream', (options, callback) => {
    uploads++;
    assert.deepEqual(options.allowed_formats, ['jpg', 'jpeg', 'png', 'gif']);
    let bytes = 0;
    return new Writable({
      write(chunk, encoding, done) { bytes += chunk.length; done(); },
      final(done) {
        callback(uploadError, { secure_url: logoURL, public_id: 'spk_unhas/new-logo', bytes });
        done();
      }
    });
  });
  mock.method(cloudinary.uploader, 'destroy', async (id, options, callback) => {
    deleted.push(id);
    callback?.(null, { result: 'ok' });
    return { result: 'ok' };
  });
});

async function json(path, options) {
  const response = await fetch(`${base}${path}`, options);
  return { status: response.status, body: await response.json() };
}

function postJSON(body, method = 'POST') {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

function upload({ type = 'image/png', size = 32, field = 'logo' } = {}) {
  const form = new FormData();
  form.append(field, new Blob([Buffer.alloc(size)], { type }), 'logo.png');
  return json('/settings/logo', { method: 'POST', body: form });
}

test('all five models are registered before schema preparation', async () => {
  assert.deepEqual(Object.keys(sequelize.models).sort(), ['SPK', 'Signatory', 'SystemSetting', 'Vehicle', 'VendorMaster']);
  const sync = mock.method(sequelize, 'sync', async (...args) => assert.deepEqual(args, []));
  await models.syncDatabase();
  assert.equal(sync.mock.callCount(), 1);
});

test('schema preparation propagates errors instead of continuing with seeding', async () => {
  mock.method(sequelize, 'sync', async () => { throw new Error('schema failure'); });
  await assert.rejects(models.syncDatabase, /schema failure/);
});

test('empty settings return a null logo and default kop', async () => {
  assert.deepEqual(await json('/settings/logo'), { status: 200, body: { logo_url: null } });
  const kop = await json('/settings/kop');
  assert.equal(kop.status, 200);
  assert.equal(kop.body.APP_TITLE, 'SPK Kendaraan UNHAS');
});

test('first logo upload and replacement persist the URL without duplicate settings', async () => {
  assert.equal((await upload()).status, 200);
  assert.equal((await json('/settings/logo')).body.logo_url, logoURL);
  assert.equal((await upload()).status, 200);
  assert.equal(settings.size, 1);
  assert.equal(uploads, 2);
  assert.deepEqual(deleted, []);
});

test('missing file, unsupported MIME type and wrong field return JSON 400', async () => {
  assert.equal((await json('/settings/logo', { method: 'POST', body: new FormData() })).status, 400);
  assert.equal((await upload({ type: 'image/svg+xml' })).status, 400);
  assert.equal((await upload({ field: 'other' })).status, 400);
  assert.equal(uploads, 0);
});

test('oversized upload returns JSON 413 and does not persist', async () => {
  const response = await upload({ size: 4 * 1024 * 1024 + 1 });
  assert.equal(response.status, 413);
  assert.match(response.body.error, /4 MB/);
  assert.equal(settings.size, 0);
});

test('unavailable database prevents an external upload', async () => {
  readError = new Error('database unavailable');
  assert.equal((await upload()).status, 500);
  assert.equal(uploads, 0);
});

test('Cloudinary failure returns JSON 502 and preserves old logo', async () => {
  settings.set('LOGO_KOP_SURAT', 'old-logo');
  uploadError = Object.assign(new Error('private service failure'), { http_code: 503 });
  const response = await upload();
  assert.equal(response.status, 502);
  assert.doesNotMatch(response.body.error, /private/);
  assert.equal(settings.get('LOGO_KOP_SURAT'), 'old-logo');
});

test('Cloudinary rejection of invalid image bytes returns JSON 400', async () => {
  uploadError = Object.assign(new Error('invalid image'), { http_code: 400 });
  assert.equal((await upload()).status, 400);
  assert.equal(settings.size, 0);
});

test('failed persistence cleans up only the new asset and preserves the old URL', async () => {
  settings.set('LOGO_KOP_SURAT', 'old-logo');
  writeError = new Error('write failure');
  assert.equal((await upload()).status, 500);
  assert.equal(settings.get('LOGO_KOP_SURAT'), 'old-logo');
  assert.deepEqual(deleted, ['spk_unhas/new-logo']);
});

test('uncertain persistence never deletes an asset that was committed', async () => {
  mock.method(models.SystemSetting, 'upsert', async ({ setting_key, setting_value }) => {
    settings.set(setting_key, setting_value);
    throw new Error('connection lost after commit');
  });
  assert.equal((await upload()).status, 500);
  assert.equal(settings.get('LOGO_KOP_SURAT'), logoURL);
  assert.deepEqual(deleted, []);
});

test('saving title only preserves kop and persists after a fresh GET', async () => {
  settings.set('KOP_KIRI_3', 'UNIVERSITAS HASANUDDIN');
  assert.equal((await json('/settings/kop', postJSON({ APP_TITLE: 'Judul Baru' }))).status, 200);
  const kop = await json('/settings/kop');
  assert.equal(kop.body.APP_TITLE, 'Judul Baru');
  assert.equal(kop.body.KOP_KIRI_3, 'UNIVERSITAS HASANUDDIN');
});

test('invalid kop payload is rejected before writing', async () => {
  assert.equal((await json('/settings/kop', postJSON({ APP_TITLE: {}, KOP_KIRI_1: 'Text' }))).status, 400);
  assert.equal(settings.size, 0);
});

test('kop changes roll back together when a later key fails', async () => {
  settings.set('APP_TITLE', 'Old title');
  mock.method(models.SystemSetting, 'upsert', async ({ setting_key, setting_value }, { transaction }) => {
    assert.ok(transaction);
    if (setting_key === 'KOP_KIRI_1') throw new Error('write failure');
    settings.set(setting_key, setting_value);
  });
  assert.equal((await json('/settings/kop', postJSON({ APP_TITLE: 'New title', KOP_KIRI_1: 'Text' }))).status, 500);
  assert.equal(settings.get('APP_TITLE'), 'Old title');
});

test('SPK list and detail load vehicle and vendor associations', async () => {
  const list = await json('/spk');
  assert.equal(list.status, 200);
  assert.equal(list.body[0].vehicle.nomor_polisi, 'TEST');
  const detail = await json('/spk/spk-test');
  assert.equal(detail.status, 200);
  assert.equal(detail.body.vendor.nama_bengkel, 'TEST');
});

test('SPK update responds with saved state and associations', async () => {
  const response = await json('/spk/spk-test', postJSON({ status: 'CHECKED' }, 'PUT'));
  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'CHECKED');
  assert.equal(response.body.vehicle.nomor_polisi, 'TEST');
});

test('SPK update rollback prevents saved state when response reload fails', async () => {
  reloadError = new Error('reload failed');
  assert.equal((await json('/spk/spk-test', postJSON({ status: 'CHECKED' }, 'PUT'))).status, 400);
  assert.equal(record.status, 'DRAFT');
});

test('missing SPK update returns 404', async () => {
  assert.equal((await json('/spk/missing', postJSON({ status: 'CHECKED' }, 'PUT'))).status, 404);
});
