const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

// GET all vehicle types
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM loai_xe');
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET vehicle type by ID
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM loai_xe WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy loại xe' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST create new vehicle type
router.post('/', async (req, res) => {
  try {
    const { ten_loai_xe, mo_ta, dinh_muc_nhien_lieu, nguong_canh_bao } = req.body;
    
    const [result] = await pool.query(
      `INSERT INTO loai_xe (ten_loai_xe, mo_ta, dinh_muc_nhien_lieu, nguong_canh_bao) VALUES (?, ?, ?, ?)`,
      [ten_loai_xe, mo_ta, dinh_muc_nhien_lieu || 0, nguong_canh_bao || 0]
    );
    
    res.status(201).json({ 
      success: true, 
      message: 'Thêm loại xe thành công',
      data: { id: result.insertId, ...req.body }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT update vehicle type
router.put('/:id', async (req, res) => {
  try {
    const { ten_loai_xe, mo_ta, dinh_muc_nhien_lieu, nguong_canh_bao } = req.body;
    
    const [result] = await pool.query(
      `UPDATE loai_xe SET ten_loai_xe = ?, mo_ta = ?, dinh_muc_nhien_lieu = ?, nguong_canh_bao = ? WHERE id = ?`,
      [ten_loai_xe, mo_ta, dinh_muc_nhien_lieu, nguong_canh_bao, req.params.id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy loại xe' });
    }
    
    res.json({ success: true, message: 'Cập nhật loại xe thành công' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE vehicle type
router.delete('/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM loai_xe WHERE id = ?', [req.params.id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy loại xe' });
    }
    
    res.json({ success: true, message: 'Xóa loại xe thành công' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
