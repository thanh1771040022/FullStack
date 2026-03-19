const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

// GET all maintenance records
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT bt.*, x.bien_so, lbt.ten_loai as loai_bao_tri_ten
      FROM bao_tri bt
      LEFT JOIN xe x ON bt.xe_id = x.id
      LEFT JOIN loai_bao_tri lbt ON bt.loai_bao_tri_id = lbt.id
      ORDER BY bt.id DESC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET upcoming maintenance (sắp đến hạn) - MUST be before /:id
router.get('/upcoming/list', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT bt.*, x.bien_so, lbt.ten_loai as loai_bao_tri_ten,
             DATEDIFF(bt.ngay_du_kien, CURDATE()) as so_ngay_con_lai
      FROM bao_tri bt
      LEFT JOIN xe x ON bt.xe_id = x.id
      LEFT JOIN loai_bao_tri lbt ON bt.loai_bao_tri_id = lbt.id
      WHERE bt.ngay_du_kien >= CURDATE() AND bt.trang_thai = 'len_lich'
      ORDER BY bt.ngay_du_kien ASC
      LIMIT 10
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET maintenance by vehicle ID - MUST be before /:id
router.get('/xe/:xeId', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT bt.*, lbt.ten_loai as loai_bao_tri_ten
      FROM bao_tri bt
      LEFT JOIN loai_bao_tri lbt ON bt.loai_bao_tri_id = lbt.id
      WHERE bt.xe_id = ?
      ORDER BY bt.id DESC
    `, [req.params.xeId]);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET maintenance by ID
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT bt.*, x.bien_so, lbt.ten_loai as loai_bao_tri_ten
      FROM bao_tri bt
      LEFT JOIN xe x ON bt.xe_id = x.id
      LEFT JOIN loai_bao_tri lbt ON bt.loai_bao_tri_id = lbt.id
      WHERE bt.id = ?
    `, [req.params.id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bản ghi bảo trì' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST create new maintenance record
router.post('/', async (req, res) => {
  try {
    const { 
      xe_id, loai_bao_tri_id, ngay_du_kien, ngay_hoan_thanh, km_luc_bao_tri,
      chi_phi_nhan_cong, chi_phi_phu_tung, chi_phi_khac, tong_chi_phi,
      don_vi_bao_tri, trang_thai, ghi_chu 
    } = req.body;
    
    const [result] = await pool.query(
      `INSERT INTO bao_tri (xe_id, loai_bao_tri_id, ngay_du_kien, ngay_hoan_thanh, km_luc_bao_tri,
       chi_phi_nhan_cong, chi_phi_phu_tung, chi_phi_khac, tong_chi_phi,
       don_vi_bao_tri, trang_thai, ghi_chu) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [xe_id, loai_bao_tri_id, ngay_du_kien, ngay_hoan_thanh || null, km_luc_bao_tri || null,
       chi_phi_nhan_cong || 0, chi_phi_phu_tung || 0, chi_phi_khac || 0, tong_chi_phi || 0,
       don_vi_bao_tri || null, trang_thai || 'len_lich', ghi_chu || null]
    );
    
    res.status(201).json({ 
      success: true, 
      message: 'Thêm bảo trì thành công',
      data: { id: result.insertId, ...req.body }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT update maintenance record
router.put('/:id', async (req, res) => {
  try {
    const { 
      xe_id, loai_bao_tri_id, ngay_du_kien, ngay_hoan_thanh, km_luc_bao_tri,
      chi_phi_nhan_cong, chi_phi_phu_tung, chi_phi_khac, tong_chi_phi,
      don_vi_bao_tri, trang_thai, ghi_chu 
    } = req.body;
    
    const [result] = await pool.query(
      `UPDATE bao_tri SET xe_id = ?, loai_bao_tri_id = ?, ngay_du_kien = ?, ngay_hoan_thanh = ?, 
       km_luc_bao_tri = ?, chi_phi_nhan_cong = ?, chi_phi_phu_tung = ?, chi_phi_khac = ?,
       tong_chi_phi = ?, don_vi_bao_tri = ?, trang_thai = ?, ghi_chu = ? WHERE id = ?`,
      [xe_id, loai_bao_tri_id, ngay_du_kien, ngay_hoan_thanh || null, km_luc_bao_tri || null,
       chi_phi_nhan_cong || 0, chi_phi_phu_tung || 0, chi_phi_khac || 0, tong_chi_phi || 0,
       don_vi_bao_tri || null, trang_thai, ghi_chu || null, req.params.id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bản ghi bảo trì' });
    }
    
    res.json({ success: true, message: 'Cập nhật bảo trì thành công' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE maintenance record
router.delete('/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM bao_tri WHERE id = ?', [req.params.id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bản ghi bảo trì' });
    }
    
    res.json({ success: true, message: 'Xóa bảo trì thành công' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
