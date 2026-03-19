const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

// GET all maintenance types
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM loai_bao_tri');
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET maintenance type by ID
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM loai_bao_tri WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy loại bảo trì' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST create new maintenance type
router.post('/', async (req, res) => {
  try {
    const { ten_loai, mo_ta, chu_ky_bao_tri } = req.body;
    
    const [result] = await pool.query(
      `INSERT INTO loai_bao_tri (ten_loai, mo_ta, chu_ky_bao_tri) VALUES (?, ?, ?)`,
      [ten_loai, mo_ta, chu_ky_bao_tri]
    );
    
    res.status(201).json({ 
      success: true, 
      message: 'Thêm loại bảo trì thành công',
      data: { id: result.insertId, ...req.body }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT update maintenance type
router.put('/:id', async (req, res) => {
  try {
    const { ten_loai, mo_ta, chu_ky_bao_tri } = req.body;
    
    const [result] = await pool.query(
      `UPDATE loai_bao_tri SET ten_loai = ?, mo_ta = ?, chu_ky_bao_tri = ? WHERE id = ?`,
      [ten_loai, mo_ta, chu_ky_bao_tri, req.params.id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy loại bảo trì' });
    }
    
    res.json({ success: true, message: 'Cập nhật loại bảo trì thành công' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE maintenance type
router.delete('/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM loai_bao_tri WHERE id = ?', [req.params.id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy loại bảo trì' });
    }
    
    res.json({ success: true, message: 'Xóa loại bảo trì thành công' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
