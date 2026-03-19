const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

// GET all alerts
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT cb.*, x.bien_so
      FROM canh_bao cb
      LEFT JOIN xe x ON cb.xe_id = x.id
      ORDER BY cb.id DESC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET unread alerts - MUST be before /:id
router.get('/unread/list', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT cb.*, x.bien_so
      FROM canh_bao cb
      LEFT JOIN xe x ON cb.xe_id = x.id
      WHERE cb.da_doc = 0
      ORDER BY cb.id DESC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET alert statistics - MUST be before /:id
router.get('/stats/summary', async (req, res) => {
  try {
    const [total] = await pool.query('SELECT COUNT(*) as total FROM canh_bao');
    const [unread] = await pool.query('SELECT COUNT(*) as unread FROM canh_bao WHERE da_doc = 0');
    const [byLevel] = await pool.query(`
      SELECT muc_do, COUNT(*) as count FROM canh_bao GROUP BY muc_do
    `);
    
    res.json({ 
      success: true, 
      data: {
        total: total[0].total,
        unread: unread[0].unread,
        byLevel: byLevel
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET alerts by vehicle ID - MUST be before /:id
router.get('/xe/:xeId', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT * FROM canh_bao WHERE xe_id = ? ORDER BY id DESC
    `, [req.params.xeId]);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT mark all as read - MUST be before /:id
router.put('/all/read', async (req, res) => {
  try {
    await pool.query(`UPDATE canh_bao SET da_doc = 1 WHERE da_doc = 0`);
    res.json({ success: true, message: 'Đã đánh dấu tất cả đã đọc' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET alert by ID
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT cb.*, x.bien_so
      FROM canh_bao cb
      LEFT JOIN xe x ON cb.xe_id = x.id
      WHERE cb.id = ?
    `, [req.params.id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cảnh báo' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST create new alert
router.post('/', async (req, res) => {
  try {
    const { xe_id, loai_canh_bao, muc_do, tieu_de, noi_dung, da_doc } = req.body;
    
    const [result] = await pool.query(
      `INSERT INTO canh_bao (xe_id, loai_canh_bao, muc_do, tieu_de, noi_dung, da_doc, ngay_tao) 
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [xe_id, loai_canh_bao, muc_do || 'trung_binh', tieu_de, noi_dung, da_doc || 0]
    );
    
    res.status(201).json({ 
      success: true, 
      message: 'Thêm cảnh báo thành công',
      data: { id: result.insertId, ...req.body }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT update alert (mark as read)
router.put('/:id', async (req, res) => {
  try {
    const { da_doc, trang_thai } = req.body;
    
    // Lấy dữ liệu hiện tại
    const [current] = await pool.query('SELECT * FROM canh_bao WHERE id = ?', [req.params.id]);
    if (current.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cảnh báo' });
    }
    
    // Chỉ cập nhật những field được gửi
    const updateDaDoc = da_doc !== undefined ? da_doc : current[0].da_doc;
    const updateTrangThai = trang_thai !== undefined ? trang_thai : current[0].trang_thai;
    
    await pool.query(
      `UPDATE canh_bao SET da_doc = ?, trang_thai = ? WHERE id = ?`,
      [updateDaDoc, updateTrangThai, req.params.id]
    );
    
    res.json({ success: true, message: 'Cập nhật cảnh báo thành công' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT mark as read
router.put('/:id/read', async (req, res) => {
  try {
    const [result] = await pool.query(
      `UPDATE canh_bao SET da_doc = 1 WHERE id = ?`,
      [req.params.id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cảnh báo' });
    }
    
    res.json({ success: true, message: 'Đã đánh dấu đã đọc' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE alert
router.delete('/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM canh_bao WHERE id = ?', [req.params.id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cảnh báo' });
    }
    
    res.json({ success: true, message: 'Xóa cảnh báo thành công' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
