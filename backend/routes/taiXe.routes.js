const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

const requireManager = (req, res) => {
  if (req.user?.vai_tro !== 'quan_ly') {
    res.status(403).json({ success: false, message: 'Ban khong co quyen truy cap tai nguyen nay' });
    return false;
  }
  return true;
};

// GET all drivers
router.get('/', async (req, res) => {
  if (!requireManager(req, res)) return;
  try {
    const [rows] = await pool.query('SELECT * FROM tai_xe');
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET driver by ID
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM tai_xe WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài xế' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST create new driver
router.post('/', async (req, res) => {
  if (!requireManager(req, res)) return;
  try {
    const { ma_nhan_vien, ho_ten, so_dien_thoai, email, dia_chi, so_bang_lai, hang_bang_lai, han_bang_lai, ngay_sinh, ngay_vao_lam, trang_thai } = req.body;
    
    const [result] = await pool.query(
      `INSERT INTO tai_xe (ma_nhan_vien, ho_ten, so_dien_thoai, email, dia_chi, so_bang_lai, hang_bang_lai, han_bang_lai, ngay_sinh, ngay_vao_lam, trang_thai) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [ma_nhan_vien, ho_ten, so_dien_thoai, email, dia_chi, so_bang_lai, hang_bang_lai, han_bang_lai, ngay_sinh, ngay_vao_lam, trang_thai || 'dang_lam']
    );
    
    res.status(201).json({ 
      success: true, 
      message: 'Thêm tài xế thành công',
      data: { id: result.insertId, ...req.body }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT update driver
router.put('/:id', async (req, res) => {
  if (!requireManager(req, res)) return;
  try {
    const { ma_nhan_vien, ho_ten, so_dien_thoai, email, dia_chi, so_bang_lai, hang_bang_lai, han_bang_lai, ngay_sinh, ngay_vao_lam, trang_thai } = req.body;
    
    const [result] = await pool.query(
      `UPDATE tai_xe SET ma_nhan_vien = ?, ho_ten = ?, so_dien_thoai = ?, email = ?, dia_chi = ?, so_bang_lai = ?, 
       hang_bang_lai = ?, han_bang_lai = ?, ngay_sinh = ?, ngay_vao_lam = ?, trang_thai = ? WHERE id = ?`,
      [ma_nhan_vien, ho_ten, so_dien_thoai, email, dia_chi, so_bang_lai, hang_bang_lai, han_bang_lai, ngay_sinh, ngay_vao_lam, trang_thai, req.params.id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài xế' });
    }
    
    res.json({ success: true, message: 'Cập nhật tài xế thành công' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE driver
router.delete('/:id', async (req, res) => {
  if (!requireManager(req, res)) return;
  try {
    const [result] = await pool.query('DELETE FROM tai_xe WHERE id = ?', [req.params.id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài xế' });
    }
    
    res.json({ success: true, message: 'Xóa tài xế thành công' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
