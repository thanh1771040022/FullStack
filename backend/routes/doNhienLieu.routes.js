const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

const round = (value, decimals = 2) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
};

const buildBadRequest = (message, details = []) => ({
  status: 400,
  message,
  details,
});

const validateAndComputeFuelMetrics = async (connection, payload) => {
  const errors = [];

  const xeId = toNumber(payload.xe_id);
  const taiXeId = toNumber(payload.tai_xe_id);
  const soLit = toNumber(payload.so_lit);
  const giaMoiLit = toNumber(payload.gia_moi_lit);
  const kmTruoc = toNumber(payload.km_truoc);
  const kmSau = toNumber(payload.km_sau);
  const suppliedTongTien = payload.tong_tien !== undefined && payload.tong_tien !== null
    ? toNumber(payload.tong_tien)
    : null;

  if (!xeId || xeId <= 0) errors.push('xe_id phai la so duong.');
  if (!taiXeId || taiXeId <= 0) errors.push('tai_xe_id phai la so duong.');
  if (!payload.thoi_gian_do) errors.push('thoi_gian_do la truong bat buoc.');
  if (!Number.isFinite(soLit) || soLit <= 0) errors.push('so_lit phai lon hon 0.');
  if (!Number.isFinite(giaMoiLit) || giaMoiLit <= 0) errors.push('gia_moi_lit phai lon hon 0.');
  if (!Number.isFinite(kmTruoc)) errors.push('km_truoc phai la so hop le.');
  if (!Number.isFinite(kmSau)) errors.push('km_sau phai la so hop le.');

  if (Number.isFinite(kmTruoc) && Number.isFinite(kmSau) && kmSau <= kmTruoc) {
    errors.push('km_sau phai lon hon km_truoc.');
  }

  if (errors.length > 0) {
    throw buildBadRequest('Du lieu nhien lieu khong hop le.', errors);
  }

  const [vehicles] = await connection.query(
    `SELECT x.id, x.bien_so, lx.ten_loai_xe, lx.dinh_muc_nhien_lieu, lx.nguong_canh_bao
     FROM xe x
     LEFT JOIN loai_xe lx ON x.loai_xe_id = lx.id
     WHERE x.id = ?`,
    [xeId]
  );

  if (vehicles.length === 0) {
    throw buildBadRequest('xe_id khong ton tai trong he thong.');
  }

  const vehicle = vehicles[0];
  const quangDuong = round(kmSau - kmTruoc, 2);

  if (quangDuong <= 0) {
    throw buildBadRequest('Quang duong tinh duoc khong hop le. Vui long kiem tra km_truoc va km_sau.');
  }

  const mucTieuHao = round((soLit / quangDuong) * 100, 2);
  const dinhMucNhienLieu = toNumber(vehicle.dinh_muc_nhien_lieu);
  const nguongCanhBao = Number.isFinite(toNumber(vehicle.nguong_canh_bao))
    ? toNumber(vehicle.nguong_canh_bao)
    : 20;
  const rawTyLeVuotDinhMuc = Number.isFinite(dinhMucNhienLieu) && dinhMucNhienLieu > 0
    ? round(((mucTieuHao - dinhMucNhienLieu) / dinhMucNhienLieu) * 100, 2)
    : 0;
  const tyLeVuotDinhMuc = clamp(rawTyLeVuotDinhMuc, -999.99, 999.99);

  const vuotDinhMuc = Number.isFinite(dinhMucNhienLieu) && dinhMucNhienLieu > 0
    ? rawTyLeVuotDinhMuc > nguongCanhBao
    : false;

  // Nghi van khai khong: quang duong rat nho so voi luong nhien lieu, hoac tieu hao qua cao.
  const nghiVanKhaiKhong =
    (quangDuong < 3 && soLit >= 15) ||
    (mucTieuHao > 40) ||
    (Number.isFinite(dinhMucNhienLieu) && dinhMucNhienLieu > 0 && mucTieuHao > dinhMucNhienLieu * 2.2);

  const batThuong = vuotDinhMuc || nghiVanKhaiKhong;
  const tongTien = Number.isFinite(suppliedTongTien) && suppliedTongTien > 0
    ? round(suppliedTongTien, 2)
    : round(soLit * giaMoiLit, 2);

  let mucDoCanhBao = 'trung_binh';
  if (nghiVanKhaiKhong || rawTyLeVuotDinhMuc > 50) {
    mucDoCanhBao = 'nghiem_trong';
  } else if (rawTyLeVuotDinhMuc > 25) {
    mucDoCanhBao = 'cao';
  }

  return {
    normalized: {
      xe_id: xeId,
      tai_xe_id: taiXeId,
      thoi_gian_do: payload.thoi_gian_do,
      tram_xang: payload.tram_xang || null,
      loai_nhien_lieu: payload.loai_nhien_lieu || 'dau_diesel',
      so_lit: round(soLit, 2),
      gia_moi_lit: round(giaMoiLit, 2),
      tong_tien: tongTien,
      km_truoc: round(kmTruoc, 2),
      km_sau: round(kmSau, 2),
      quang_duong: quangDuong,
      muc_tieu_hao: mucTieuHao,
      bat_thuong: batThuong,
      ty_le_vuot_dinh_muc: tyLeVuotDinhMuc,
      ghi_chu: payload.ghi_chu || null,
    },
    analysis: {
      vehicle,
      dinh_muc_nhien_lieu: Number.isFinite(dinhMucNhienLieu) ? dinhMucNhienLieu : null,
      nguong_canh_bao: nguongCanhBao,
      vuot_dinh_muc: vuotDinhMuc,
      nghi_van_khai_khong: nghiVanKhaiKhong,
      muc_do_canh_bao: mucDoCanhBao,
    },
  };
};

const createFuelAlert = async (connection, metrics) => {
  const { normalized, analysis } = metrics;
  if (!normalized.bat_thuong) return;

  const dinhMucText = analysis.dinh_muc_nhien_lieu
    ? `${analysis.dinh_muc_nhien_lieu} L/100km`
    : 'chua cau hinh';
  const lyDo = analysis.nghi_van_khai_khong
    ? 'Nghi van khai khong nhien lieu.'
    : 'Vuot dinh muc nhien lieu cho phep.';

  const tieuDe = `Canh bao nhien lieu bat thuong - ${analysis.vehicle.bien_so}`;
  const noiDung = [
    `Xe: ${analysis.vehicle.bien_so}`,
    `Muc tieu hao: ${normalized.muc_tieu_hao} L/100km`,
    `Dinh muc: ${dinhMucText}`,
    `Ty le vuot: ${normalized.ty_le_vuot_dinh_muc}%`,
    `Quang duong: ${normalized.quang_duong} km, So lit: ${normalized.so_lit} L`,
    lyDo,
  ].join(' | ');

  await connection.query(
    `INSERT INTO canh_bao (xe_id, tai_xe_id, loai_canh_bao, muc_do, tieu_de, noi_dung, da_doc, tao_luc)
     VALUES (?, ?, 'nhien_lieu_bat_thuong', ?, ?, ?, 0, NOW())`,
    [
      normalized.xe_id,
      normalized.tai_xe_id,
      analysis.muc_do_canh_bao,
      tieuDe,
      noiDung,
    ]
  );
};

// GET all fuel records
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT dnl.*, x.bien_so
      FROM do_nhien_lieu dnl
      LEFT JOIN xe x ON dnl.xe_id = x.id
      ORDER BY dnl.id DESC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET fuel statistics summary - MUST be before /:id
router.get('/stats/summary', async (req, res) => {
  try {
    const [total] = await pool.query(`
      SELECT 
        SUM(so_lit) as tong_lit,
        SUM(tong_tien) as tong_chi_phi,
        AVG(gia_moi_lit) as gia_trung_binh
      FROM do_nhien_lieu
    `);
    
    const [byVehicle] = await pool.query(`
      SELECT x.bien_so, SUM(dnl.so_lit) as tong_lit, SUM(dnl.tong_tien) as tong_tien
      FROM do_nhien_lieu dnl
      LEFT JOIN xe x ON dnl.xe_id = x.id
      GROUP BY dnl.xe_id, x.bien_so
      ORDER BY tong_tien DESC
    `);
    
    res.json({ 
      success: true, 
      data: {
        summary: total[0],
        byVehicle: byVehicle
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET monthly fuel statistics - MUST be before /:id
router.get('/stats/monthly', async (req, res) => {
  try {
    const year = req.query.year || new Date().getFullYear();
    
    const [rows] = await pool.query(`
      SELECT 
        MONTH(thoi_gian_do) as thang,
        SUM(so_lit) as tong_lit,
        SUM(tong_tien) as tong_chi_phi
      FROM do_nhien_lieu
      WHERE YEAR(thoi_gian_do) = ?
      GROUP BY MONTH(thoi_gian_do)
      ORDER BY thang
    `, [year]);
    
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET fuel records by vehicle ID - MUST be before /:id
router.get('/xe/:xeId', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT * FROM do_nhien_lieu WHERE xe_id = ? ORDER BY id DESC
    `, [req.params.xeId]);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET fuel record by ID
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM do_nhien_lieu WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bản ghi nhiên liệu' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST create new fuel record
router.post('/', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const metrics = await validateAndComputeFuelMetrics(connection, req.body);
    const payload = metrics.normalized;

    const [result] = await connection.query(
      `INSERT INTO do_nhien_lieu (xe_id, tai_xe_id, thoi_gian_do, tram_xang, loai_nhien_lieu, so_lit, gia_moi_lit, tong_tien, km_truoc, km_sau, quang_duong, muc_tieu_hao, bat_thuong, ty_le_vuot_dinh_muc, ghi_chu) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.xe_id,
        payload.tai_xe_id,
        payload.thoi_gian_do,
        payload.tram_xang,
        payload.loai_nhien_lieu,
        payload.so_lit,
        payload.gia_moi_lit,
        payload.tong_tien,
        payload.km_truoc,
        payload.km_sau,
        payload.quang_duong,
        payload.muc_tieu_hao,
        payload.bat_thuong,
        payload.ty_le_vuot_dinh_muc,
        payload.ghi_chu,
      ]
    );

    await createFuelAlert(connection, metrics);
    await connection.commit();

    res.status(201).json({ 
      success: true, 
      message: 'Thêm bản ghi nhiên liệu thành công',
      data: {
        id: result.insertId,
        ...payload,
        canh_bao_duoc_tao: payload.bat_thuong,
      }
    });
  } catch (error) {
    if (connection) await connection.rollback();

    if (error.status === 400) {
      return res.status(400).json({
        success: false,
        message: error.message,
        details: error.details || [],
      });
    }

    res.status(500).json({ success: false, message: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// PUT update fuel record
router.put('/:id', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [existingRows] = await connection.query(
      'SELECT * FROM do_nhien_lieu WHERE id = ?',
      [req.params.id]
    );

    if (existingRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Không tìm thấy bản ghi nhiên liệu' });
    }

    const mergedPayload = {
      ...existingRows[0],
      ...req.body,
    };

    const metrics = await validateAndComputeFuelMetrics(connection, mergedPayload);
    const payload = metrics.normalized;

    await connection.query(
      `UPDATE do_nhien_lieu SET xe_id = ?, tai_xe_id = ?, thoi_gian_do = ?, tram_xang = ?, loai_nhien_lieu = ?, so_lit = ?, gia_moi_lit = ?, 
       tong_tien = ?, km_truoc = ?, km_sau = ?, quang_duong = ?, muc_tieu_hao = ?, bat_thuong = ?, ty_le_vuot_dinh_muc = ?, ghi_chu = ? WHERE id = ?`,
      [
        payload.xe_id,
        payload.tai_xe_id,
        payload.thoi_gian_do,
        payload.tram_xang,
        payload.loai_nhien_lieu,
        payload.so_lit,
        payload.gia_moi_lit,
        payload.tong_tien,
        payload.km_truoc,
        payload.km_sau,
        payload.quang_duong,
        payload.muc_tieu_hao,
        payload.bat_thuong,
        payload.ty_le_vuot_dinh_muc,
        payload.ghi_chu,
        req.params.id,
      ]
    );

    const wasAbnormal = Boolean(existingRows[0].bat_thuong);
    if (!wasAbnormal && payload.bat_thuong) {
      await createFuelAlert(connection, metrics);
    }

    await connection.commit();
    
    res.json({ success: true, message: 'Cập nhật bản ghi nhiên liệu thành công' });
  } catch (error) {
    if (connection) await connection.rollback();

    if (error.status === 400) {
      return res.status(400).json({
        success: false,
        message: error.message,
        details: error.details || [],
      });
    }

    res.status(500).json({ success: false, message: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// DELETE fuel record
router.delete('/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM do_nhien_lieu WHERE id = ?', [req.params.id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bản ghi nhiên liệu' });
    }
    
    res.json({ success: true, message: 'Xóa bản ghi nhiên liệu thành công' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
