const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

const hasVehicleAccess = (scope, xeId) => {
  if (scope?.isManager) return true;
  return scope?.vehicleIds?.includes(Number(xeId));
};

const hasTripAccess = (scope, trip) => {
  if (scope?.isManager) return true;
  return Number(trip.tai_xe_id) === Number(scope?.driverId) || hasVehicleAccess(scope, trip.xe_id);
};

// GET all trips
router.get('/', async (req, res) => {
  try {
    let rows;
    if (req.scope?.isManager) {
      [rows] = await pool.query(`
        SELECT cd.*, x.bien_so, tx.ho_ten as tai_xe_ten
        FROM chuyen_di cd
        LEFT JOIN xe x ON cd.xe_id = x.id
        LEFT JOIN tai_xe tx ON cd.tai_xe_id = tx.id
        ORDER BY cd.ngay_chuyen DESC
      `);
    } else {
      const params = [req.scope.driverId];
      let condition = '(cd.tai_xe_id = ?)';
      if (req.scope.vehicleIds.length > 0) {
        const placeholders = req.scope.vehicleIds.map(() => '?').join(',');
        condition = `(${condition} OR cd.xe_id IN (${placeholders}))`;
        params.push(...req.scope.vehicleIds);
      }

      [rows] = await pool.query(
        `SELECT cd.*, x.bien_so, tx.ho_ten as tai_xe_ten
         FROM chuyen_di cd
         LEFT JOIN xe x ON cd.xe_id = x.id
         LEFT JOIN tai_xe tx ON cd.tai_xe_id = tx.id
         WHERE ${condition}
         ORDER BY cd.ngay_chuyen DESC`,
        params
      );
    }
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET trip statistics - MUST be before /:id
router.get('/stats/summary', async (req, res) => {
  try {
    let total;
    let byStatus;
    let totalKm;

    if (req.scope?.isManager) {
      [total] = await pool.query('SELECT COUNT(*) as total FROM chuyen_di');
      [byStatus] = await pool.query('SELECT trang_thai, COUNT(*) as count FROM chuyen_di GROUP BY trang_thai');
      [totalKm] = await pool.query(
        `SELECT SUM(khoang_cach_thuc_te) as tong_km
         FROM chuyen_di
         WHERE khoang_cach_thuc_te IS NOT NULL`
      );
    } else {
      const params = [req.scope.driverId];
      let condition = '(tai_xe_id = ?)';
      if (req.scope.vehicleIds.length > 0) {
        const placeholders = req.scope.vehicleIds.map(() => '?').join(',');
        condition = `(${condition} OR xe_id IN (${placeholders}))`;
        params.push(...req.scope.vehicleIds);
      }

      [total] = await pool.query(`SELECT COUNT(*) as total FROM chuyen_di WHERE ${condition}`, params);
      [byStatus] = await pool.query(`SELECT trang_thai, COUNT(*) as count FROM chuyen_di WHERE ${condition} GROUP BY trang_thai`, params);
      [totalKm] = await pool.query(
        `SELECT SUM(khoang_cach_thuc_te) as tong_km
         FROM chuyen_di
         WHERE khoang_cach_thuc_te IS NOT NULL AND ${condition}`,
        params
      );
    }
    
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
    if (!hasVehicleAccess(req.scope, req.params.xeId)) {
      return res.status(403).json({ success: false, message: 'Ban khong co quyen xem chuyen di cua xe nay' });
    }

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
    if (!req.scope?.isManager && Number(req.params.taiXeId) !== Number(req.scope.driverId)) {
      return res.status(403).json({ success: false, message: 'Ban khong co quyen xem du lieu tai xe nay' });
    }

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

    if (!hasTripAccess(req.scope, rows[0])) {
      return res.status(403).json({ success: false, message: 'Ban khong co quyen xem chuyen di nay' });
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
    
    let xeIdToSave = xe_id;
    let driverIdToSave = tai_xe_id;

    if (!req.scope?.isManager) {
      driverIdToSave = req.scope.driverId;
      if (!hasVehicleAccess(req.scope, xe_id)) {
        return res.status(403).json({ success: false, message: 'Ban khong co quyen tao chuyen di cho xe nay' });
      }
      xeIdToSave = xe_id;
    }

    const [result] = await pool.query(
      `INSERT INTO chuyen_di (xe_id, tai_xe_id, ma_chuyen, ngay_chuyen, diem_di, diem_den, thoi_gian_xuat_phat, thoi_gian_ve, 
       khoang_cach_thuc_te, trang_thai, ghi_chu) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [xeIdToSave, driverIdToSave, ma_chuyen, ngay_chuyen, diem_di, diem_den, thoi_gian_xuat_phat, thoi_gian_ve, 
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
    
    const [current] = await pool.query('SELECT * FROM chuyen_di WHERE id = ?', [req.params.id]);
    if (current.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy chuyến đi' });
    }

    if (!req.scope?.isManager && !hasTripAccess(req.scope, current[0])) {
      return res.status(403).json({ success: false, message: 'Ban khong co quyen cap nhat chuyen di nay' });
    }

    const xeIdToSave = req.scope?.isManager ? (xe_id ?? current[0].xe_id) : current[0].xe_id;
    const driverIdToSave = req.scope?.isManager ? (tai_xe_id ?? current[0].tai_xe_id) : req.scope.driverId;

    const [result] = await pool.query(
      `UPDATE chuyen_di SET xe_id = ?, tai_xe_id = ?, ma_chuyen = ?, ngay_chuyen = ?, diem_di = ?, diem_den = ?, 
       thoi_gian_xuat_phat = ?, thoi_gian_ve = ?, khoang_cach_thuc_te = ?,
       trang_thai = ?, ghi_chu = ? WHERE id = ?`,
      [xeIdToSave, driverIdToSave, ma_chuyen, ngay_chuyen, diem_di, diem_den, thoi_gian_xuat_phat, thoi_gian_ve, 
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
    if (!req.scope?.isManager) {
      const [rows] = await pool.query('SELECT * FROM chuyen_di WHERE id = ?', [req.params.id]);
      if (rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy chuyến đi' });
      }
      if (!hasTripAccess(req.scope, rows[0])) {
        return res.status(403).json({ success: false, message: 'Ban khong co quyen xoa chuyen di nay' });
      }
    }

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
