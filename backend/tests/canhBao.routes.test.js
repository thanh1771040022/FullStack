const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');

const { pool } = require('../config/database');
const canhBaoRoutes = require('../routes/canhBao.routes');

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.scope = { isManager: true, driverId: null, vehicleIds: [] };
    next();
  });
  app.use('/api/canh-bao', canhBaoRoutes);
  return app;
};

test('POST /api/canh-bao uses tao_luc and not ngay_tao', async () => {
  const app = buildApp();
  const originalQuery = pool.query;
  const calledSql = [];

  pool.query = async (sql) => {
    calledSql.push(sql);
    return [{ insertId: 123 }];
  };

  try {
    const response = await request(app)
      .post('/api/canh-bao')
      .send({
        xe_id: 1,
        tai_xe_id: 2,
        loai_canh_bao: 'he_thong',
        muc_do: 'trung_binh',
        tieu_de: 'Test',
        noi_dung: 'Noi dung test',
        da_doc: 0,
      });

    assert.equal(response.status, 201);
    assert.equal(response.body.success, true);

    const insertSql = calledSql.find((sql) => sql.includes('INSERT INTO canh_bao')) || '';
    assert.ok(insertSql.includes('tao_luc'));
    assert.equal(insertSql.includes('ngay_tao'), false);
  } finally {
    pool.query = originalQuery;
  }
});

test('PUT /api/canh-bao/:id updates only da_doc (no trang_thai column)', async () => {
  const app = buildApp();
  const originalQuery = pool.query;
  const calledSql = [];
  let callIndex = 0;

  pool.query = async (sql) => {
    calledSql.push(sql);
    callIndex += 1;

    if (callIndex === 1) {
      return [[{ id: 1, da_doc: 0 }]];
    }

    return [{ affectedRows: 1 }];
  };

  try {
    const response = await request(app)
      .put('/api/canh-bao/1')
      .send({ da_doc: 1 });

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);

    const updateSql = calledSql.find((sql) => sql.includes('UPDATE canh_bao SET')) || '';
    assert.ok(updateSql.includes('da_doc = ?'));
    assert.equal(updateSql.includes('trang_thai'), false);
  } finally {
    pool.query = originalQuery;
  }
});
