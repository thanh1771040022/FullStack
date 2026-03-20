const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
};

// GET all vehicle types
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM loai_xe');
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET fuel threshold config by vehicle type - MUST be before /:id
router.get('/thresholds/list', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT id, ten_loai_xe, dinh_muc_nhien_lieu, nguong_canh_bao
      FROM loai_xe
      ORDER BY ten_loai_xe ASC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT update only fuel threshold config - MUST be before /:id
router.put('/:id/threshold', async (req, res) => {
  try {
    const dinhMuc = toNumber(req.body.dinh_muc_nhien_lieu);
    const nguong = toNumber(req.body.nguong_canh_bao);

    if (!Number.isFinite(dinhMuc) || dinhMuc <= 0) {
      return res.status(400).json({
        success: false,
        message: 'dinh_muc_nhien_lieu phai lon hon 0',
      });
    }

    if (!Number.isFinite(nguong) || nguong <= 0 || nguong > 200) {
      return res.status(400).json({
        success: false,
        message: 'nguong_canh_bao phai trong khoang (0, 200]',
      });
    }

    const [result] = await pool.query(
      `UPDATE loai_xe SET dinh_muc_nhien_lieu = ?, nguong_canh_bao = ? WHERE id = ?`,
      [dinhMuc, nguong, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy loại xe' });
    }

    res.json({
      success: true,
      message: 'Cập nhật định mức và ngưỡng cảnh báo thành công',
      data: {
        id: Number(req.params.id),
        dinh_muc_nhien_lieu: dinhMuc,
        nguong_canh_bao: nguong,
      },
    });
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
