const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

// GET all trips
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT cd.*, x.bien_so, tx.ho_ten as tai_xe_ten
      FROM chuyen_di cd
      LEFT JOIN xe x ON cd.xe_id = x.id
      LEFT JOIN tai_xe tx ON cd.tai_xe_id = tx.id
      ORDER BY cd.ngay_chuyen DESC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET trip statistics - MUST be before /:id
router.get('/stats/summary', async (req, res) => {
  try {
    const [total] = await pool.query('SELECT COUNT(*) as total FROM chuyen_di');
    const [byStatus] = await pool.query(`
      SELECT trang_thai, COUNT(*) as count FROM chuyen_di GROUP BY trang_thai
    `);
    const [totalKm] = await pool.query(`
      SELECT SUM(khoang_cach_thuc_te) as tong_km
      FROM chuyen_di
      WHERE khoang_cach_thuc_te IS NOT NULL
    `);
    
    res.json({ 
      success: true, 
      data: {
        total: total[0].total,
        totalKm: totalKm[0].tong_km || 0,
        byStatus: byStatus
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET trips by vehicle ID - MUST be before /:id
router.get('/xe/:xeId', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT cd.*, tx.ho_ten as tai_xe_ten
      FROM chuyen_di cd
      LEFT JOIN tai_xe tx ON cd.tai_xe_id = tx.id
      WHERE cd.xe_id = ?
      ORDER BY cd.ngay_chuyen DESC
    `, [req.params.xeId]);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET trips by driver ID - MUST be before /:id
router.get('/tai-xe/:taiXeId', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT cd.*, x.bien_so
      FROM chuyen_di cd
      LEFT JOIN xe x ON cd.xe_id = x.id
      WHERE cd.tai_xe_id = ?
      ORDER BY cd.ngay_chuyen DESC
    `, [req.params.taiXeId]);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET trip by ID
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT cd.*, x.bien_so, tx.ho_ten as tai_xe_ten
      FROM chuyen_di cd
      LEFT JOIN xe x ON cd.xe_id = x.id
      LEFT JOIN tai_xe tx ON cd.tai_xe_id = tx.id
      WHERE cd.id = ?
    `, [req.params.id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy chuyến đi' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST create new trip
router.post('/', async (req, res) => {
  try {
    const { 
      xe_id, tai_xe_id, ma_chuyen, ngay_chuyen, diem_di, diem_den, 
      thoi_gian_xuat_phat, thoi_gian_ve, khoang_cach_thuc_te,
      trang_thai, ghi_chu 
    } = req.body;
    
    const [result] = await pool.query(
      `INSERT INTO chuyen_di (xe_id, tai_xe_id, ma_chuyen, ngay_chuyen, diem_di, diem_den, thoi_gian_xuat_phat, thoi_gian_ve, 
       khoang_cach_thuc_te, trang_thai, ghi_chu) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [xe_id, tai_xe_id, ma_chuyen, ngay_chuyen, diem_di, diem_den, thoi_gian_xuat_phat, thoi_gian_ve, 
       khoang_cach_thuc_te, trang_thai || 'ke_hoach', ghi_chu]
    );
    
    res.status(201).json({ 
      success: true, 
      message: 'Thêm chuyến đi thành công',
      data: { id: result.insertId, ...req.body }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT update trip
router.put('/:id', async (req, res) => {
  try {
    const { 
      xe_id, tai_xe_id, ma_chuyen, ngay_chuyen, diem_di, diem_den, 
      thoi_gian_xuat_phat, thoi_gian_ve, khoang_cach_thuc_te,
      trang_thai, ghi_chu 
    } = req.body;
    
    const [result] = await pool.query(
      `UPDATE chuyen_di SET xe_id = ?, tai_xe_id = ?, ma_chuyen = ?, ngay_chuyen = ?, diem_di = ?, diem_den = ?, 
       thoi_gian_xuat_phat = ?, thoi_gian_ve = ?, khoang_cach_thuc_te = ?,
       trang_thai = ?, ghi_chu = ? WHERE id = ?`,
      [xe_id, tai_xe_id, ma_chuyen, ngay_chuyen, diem_di, diem_den, thoi_gian_xuat_phat, thoi_gian_ve, 
       khoang_cach_thuc_te, trang_thai, ghi_chu, req.params.id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy chuyến đi' });
    }
    
    res.json({ success: true, message: 'Cập nhật chuyến đi thành công' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE trip
router.delete('/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM chuyen_di WHERE id = ?', [req.params.id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy chuyến đi' });
    }
    
    res.json({ success: true, message: 'Xóa chuyến đi thành công' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
