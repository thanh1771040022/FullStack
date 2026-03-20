const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

const hasVehicleAccess = (scope, xeId) => {
  if (scope?.isManager) return true;
  return scope?.vehicleIds?.includes(Number(xeId));
};

const buildDriverVisibility = (scope) => {
  const params = [scope.driverId];
  let condition = '(cb.tai_xe_id = ?)';

  if (scope.vehicleIds.length > 0) {
    const placeholders = scope.vehicleIds.map(() => '?').join(',');
    condition = `(${condition} OR cb.xe_id IN (${placeholders}))`;
    params.push(...scope.vehicleIds);
  }

  return { condition, params };
};

// GET all alerts
router.get('/', async (req, res) => {
  try {
    let rows;
    if (req.scope?.isManager) {
      [rows] = await pool.query(`
        SELECT cb.*, x.bien_so
        FROM canh_bao cb
        LEFT JOIN xe x ON cb.xe_id = x.id
        ORDER BY cb.id DESC
      `);
    } else {
      const visibility = buildDriverVisibility(req.scope);
      [rows] = await pool.query(
        `SELECT cb.*, x.bien_so
         FROM canh_bao cb
         LEFT JOIN xe x ON cb.xe_id = x.id
         WHERE ${visibility.condition}
         ORDER BY cb.id DESC`,
        visibility.params
      );
    }
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET unread alerts - MUST be before /:id
router.get('/unread/list', async (req, res) => {
  try {
    let rows;
    if (req.scope?.isManager) {
      [rows] = await pool.query(`
        SELECT cb.*, x.bien_so
        FROM canh_bao cb
        LEFT JOIN xe x ON cb.xe_id = x.id
        WHERE cb.da_doc = 0
        ORDER BY cb.id DESC
      `);
    } else {
      const visibility = buildDriverVisibility(req.scope);
      [rows] = await pool.query(
        `SELECT cb.*, x.bien_so
         FROM canh_bao cb
         LEFT JOIN xe x ON cb.xe_id = x.id
         WHERE cb.da_doc = 0 AND ${visibility.condition}
         ORDER BY cb.id DESC`,
        visibility.params
      );
    }
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET alert statistics - MUST be before /:id
router.get('/stats/summary', async (req, res) => {
  try {
    let total;
    let unread;
    let byLevel;

    if (req.scope?.isManager) {
      [total] = await pool.query('SELECT COUNT(*) as total FROM canh_bao');
      [unread] = await pool.query('SELECT COUNT(*) as unread FROM canh_bao WHERE da_doc = 0');
      [byLevel] = await pool.query('SELECT muc_do, COUNT(*) as count FROM canh_bao GROUP BY muc_do');
    } else {
      const visibility = buildDriverVisibility(req.scope);
      [total] = await pool.query(`SELECT COUNT(*) as total FROM canh_bao cb WHERE ${visibility.condition}`, visibility.params);
      [unread] = await pool.query(`SELECT COUNT(*) as unread FROM canh_bao cb WHERE cb.da_doc = 0 AND ${visibility.condition}`, visibility.params);
      [byLevel] = await pool.query(
        `SELECT cb.muc_do, COUNT(*) as count FROM canh_bao cb WHERE ${visibility.condition} GROUP BY cb.muc_do`,
        visibility.params
      );
    }
    
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
    if (!hasVehicleAccess(req.scope, req.params.xeId)) {
      return res.status(403).json({ success: false, message: 'Ban khong co quyen xem canh bao cua xe nay' });
    }

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
    if (req.scope?.isManager) {
      await pool.query('UPDATE canh_bao SET da_doc = 1 WHERE da_doc = 0');
    } else {
      const visibility = buildDriverVisibility(req.scope);
      await pool.query(
        `UPDATE canh_bao cb
         SET cb.da_doc = 1
         WHERE cb.da_doc = 0 AND ${visibility.condition}`,
        visibility.params
      );
    }
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

    if (!req.scope?.isManager) {
      const row = rows[0];
      const canAccess = Number(row.tai_xe_id) === Number(req.scope.driverId) || hasVehicleAccess(req.scope, row.xe_id);
      if (!canAccess) {
        return res.status(403).json({ success: false, message: 'Ban khong co quyen xem canh bao nay' });
      }
    }

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST create new alert
router.post('/', async (req, res) => {
  try {
    const { xe_id, tai_xe_id, loai_canh_bao, muc_do, tieu_de, noi_dung, da_doc } = req.body;

    let driverIdToSave = tai_xe_id || null;
    if (!req.scope?.isManager) {
      driverIdToSave = req.scope.driverId;
      if (xe_id && !hasVehicleAccess(req.scope, xe_id)) {
        return res.status(403).json({ success: false, message: 'Ban khong co quyen tao canh bao cho xe nay' });
      }
    }
    
    const [result] = await pool.query(
      `INSERT INTO canh_bao (xe_id, tai_xe_id, loai_canh_bao, muc_do, tieu_de, noi_dung, da_doc, tao_luc) 
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [xe_id, driverIdToSave, loai_canh_bao, muc_do || 'trung_binh', tieu_de, noi_dung, da_doc || 0]
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
    const { da_doc } = req.body;
    
    // Lấy dữ liệu hiện tại
    const [current] = await pool.query('SELECT * FROM canh_bao WHERE id = ?', [req.params.id]);
    if (current.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cảnh báo' });
    }

    if (!req.scope?.isManager) {
      const row = current[0];
      const canAccess = Number(row.tai_xe_id) === Number(req.scope.driverId) || hasVehicleAccess(req.scope, row.xe_id);
      if (!canAccess) {
        return res.status(403).json({ success: false, message: 'Ban khong co quyen cap nhat canh bao nay' });
      }
    }
    
    // Chỉ cập nhật những field được gửi
    const updateDaDoc = da_doc !== undefined ? da_doc : current[0].da_doc;
    
    await pool.query(
      `UPDATE canh_bao SET da_doc = ? WHERE id = ?`,
      [updateDaDoc, req.params.id]
    );
    
    res.json({ success: true, message: 'Cập nhật cảnh báo thành công' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT mark as read
router.put('/:id/read', async (req, res) => {
  try {
    let result;
    if (req.scope?.isManager) {
      [result] = await pool.query('UPDATE canh_bao SET da_doc = 1 WHERE id = ?', [req.params.id]);
    } else {
      const visibility = buildDriverVisibility(req.scope);
      [result] = await pool.query(
        `UPDATE canh_bao cb
         SET cb.da_doc = 1
         WHERE cb.id = ? AND ${visibility.condition}`,
        [req.params.id, ...visibility.params]
      );
    }
    
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
    let result;
    if (req.scope?.isManager) {
      [result] = await pool.query('DELETE FROM canh_bao WHERE id = ?', [req.params.id]);
    } else {
      const visibility = buildDriverVisibility(req.scope);
      [result] = await pool.query(
        `DELETE cb FROM canh_bao cb
         WHERE cb.id = ? AND ${visibility.condition}`,
        [req.params.id, ...visibility.params]
      );
    }
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cảnh báo' });
    }
    
    res.json({ success: true, message: 'Xóa cảnh báo thành công' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
