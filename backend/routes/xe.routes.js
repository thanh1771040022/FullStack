const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

// GET all vehicles
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM xe');
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET vehicles with driver info (JOIN) - MUST be before /:id
router.get('/full/details', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT x.*, lx.ten_loai_xe as loai_xe_ten, tx.ho_ten as tai_xe_ten, tx.so_dien_thoai as tai_xe_sdt
      FROM xe x
      LEFT JOIN loai_xe lx ON x.loai_xe_id = lx.id
      LEFT JOIN tai_xe tx ON x.tai_xe_hien_tai = tx.id
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET upcoming expiries from vehicle deadlines - MUST be before /:id
router.get('/stats/upcoming-expiries', async (req, res) => {
  try {
    const days = Number.parseInt(req.query.days, 10);
    const thresholdDays = Number.isFinite(days) && days > 0 ? days : 30;

    const [rows] = await pool.query(
      `SELECT
        x.id AS xe_id,
        x.bien_so,
        lx.ten_loai_xe AS loai_xe_ten,
        x.trang_thai,
        x.han_dang_kiem,
        x.han_bao_hiem,
        x.ngay_thay_lop,
        DATEDIFF(x.han_dang_kiem, CURDATE()) AS ngay_con_lai_dang_kiem,
        DATEDIFF(x.han_bao_hiem, CURDATE()) AS ngay_con_lai_bao_hiem,
        DATEDIFF(x.ngay_thay_lop, CURDATE()) AS ngay_con_lai_thay_lop
      FROM xe x
      LEFT JOIN loai_xe lx ON x.loai_xe_id = lx.id
      WHERE
        (x.han_dang_kiem IS NOT NULL AND DATEDIFF(x.han_dang_kiem, CURDATE()) <= ?)
        OR (x.han_bao_hiem IS NOT NULL AND DATEDIFF(x.han_bao_hiem, CURDATE()) <= ?)
        OR (x.ngay_thay_lop IS NOT NULL AND DATEDIFF(x.ngay_thay_lop, CURDATE()) <= ?)
      ORDER BY x.id`,
      [thresholdDays, thresholdDays, thresholdDays]
    );

    const events = [];
    rows.forEach((row) => {
      const baseInfo = {
        xe_id: row.xe_id,
        bien_so: row.bien_so,
        loai_xe_ten: row.loai_xe_ten || 'N/A',
        trang_thai: row.trang_thai,
      };

      const candidates = [
        {
          loai_han: 'dang_kiem',
          label: 'Dang kiem',
          dueDate: row.han_dang_kiem,
          daysLeft: row.ngay_con_lai_dang_kiem,
        },
        {
          loai_han: 'bao_hiem',
          label: 'Bao hiem',
          dueDate: row.han_bao_hiem,
          daysLeft: row.ngay_con_lai_bao_hiem,
        },
        {
          loai_han: 'thay_lop',
          label: 'Thay lop',
          dueDate: row.ngay_thay_lop,
          daysLeft: row.ngay_con_lai_thay_lop,
        },
      ];

      candidates.forEach((candidate) => {
        if (!candidate.dueDate || candidate.daysLeft > thresholdDays) {
          return;
        }

        let mucDo = 'binh_thuong';
        if (candidate.daysLeft < 0) {
          mucDo = 'qua_han';
        } else if (candidate.daysLeft <= 7) {
          mucDo = 'sap_het_han';
        }

        events.push({
          ...baseInfo,
          loai_han: candidate.loai_han,
          loai_han_label: candidate.label,
          due_date: candidate.dueDate,
          days_left: candidate.daysLeft,
          muc_do_uu_tien: mucDo,
        });
      });
    });

    events.sort((a, b) => a.days_left - b.days_left);

    res.json({
      success: true,
      data: {
        thresholdDays,
        total: events.length,
        items: events,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET vehicle by ID
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT x.*, lx.ten_loai_xe as loai_xe_ten, tx.ho_ten as tai_xe_ten, tx.so_dien_thoai as tai_xe_sdt
       FROM xe x
       LEFT JOIN loai_xe lx ON x.loai_xe_id = lx.id
       LEFT JOIN tai_xe tx ON x.tai_xe_hien_tai = tx.id
       WHERE x.id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy xe' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST create new vehicle
router.post('/', async (req, res) => {
  try {
    const { 
      bien_so, loai_xe_id, tai_xe_hien_tai, trang_thai, 
      nam_san_xuat, hang_xe, dong_xe, mau_xe, so_khung, so_may,
      dung_tich_binh, so_km_hien_tai, han_dang_kiem, han_bao_hiem,
      han_phi_duong_bo, ma_gps, ghi_chu
    } = req.body;
    
    const [result] = await pool.query(
      `INSERT INTO xe (bien_so, loai_xe_id, tai_xe_hien_tai, trang_thai, 
       nam_san_xuat, hang_xe, dong_xe, mau_xe, so_khung, so_may,
       dung_tich_binh, so_km_hien_tai, han_dang_kiem, han_bao_hiem,
       han_phi_duong_bo, ma_gps, ghi_chu) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [bien_so, loai_xe_id, tai_xe_hien_tai || null, trang_thai || 'hoat_dong', 
       nam_san_xuat, hang_xe, dong_xe, mau_xe, so_khung, so_may,
       dung_tich_binh, so_km_hien_tai || 0, han_dang_kiem, han_bao_hiem,
       han_phi_duong_bo, ma_gps, ghi_chu]
    );
    
    res.status(201).json({ 
      success: true, 
      message: 'Thêm xe thành công',
      data: { id: result.insertId, ...req.body }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT update vehicle
router.put('/:id', async (req, res) => {
  try {
    // Lấy dữ liệu xe hiện tại trước
    const [currentVehicle] = await pool.query('SELECT * FROM xe WHERE id = ?', [req.params.id]);
    if (currentVehicle.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy xe' });
    }
    
    const current = currentVehicle[0];
    const body = req.body;
    
    // Merge dữ liệu mới với dữ liệu cũ
    const updateData = {
      bien_so: body.bien_so ?? current.bien_so,
      loai_xe_id: body.loai_xe_id ?? current.loai_xe_id,
      tai_xe_hien_tai: body.tai_xe_hien_tai !== undefined ? body.tai_xe_hien_tai : current.tai_xe_hien_tai,
      trang_thai: body.trang_thai ?? current.trang_thai,
      nam_san_xuat: body.nam_san_xuat ?? current.nam_san_xuat,
      hang_xe: body.hang_xe ?? current.hang_xe,
      dong_xe: body.dong_xe !== undefined ? body.dong_xe : current.dong_xe,
      mau_xe: body.mau_xe !== undefined ? body.mau_xe : current.mau_xe,
      so_khung: body.so_khung !== undefined ? body.so_khung : current.so_khung,
      so_may: body.so_may !== undefined ? body.so_may : current.so_may,
      dung_tich_binh: body.dung_tich_binh !== undefined ? body.dung_tich_binh : current.dung_tich_binh,
      so_km_hien_tai: body.so_km_hien_tai !== undefined ? body.so_km_hien_tai : current.so_km_hien_tai,
      han_dang_kiem: body.han_dang_kiem !== undefined ? body.han_dang_kiem : current.han_dang_kiem,
      han_bao_hiem: body.han_bao_hiem !== undefined ? body.han_bao_hiem : current.han_bao_hiem,
      han_phi_duong_bo: body.han_phi_duong_bo !== undefined ? body.han_phi_duong_bo : current.han_phi_duong_bo,
      ma_gps: body.ma_gps !== undefined ? body.ma_gps : current.ma_gps,
      ghi_chu: body.ghi_chu !== undefined ? body.ghi_chu : current.ghi_chu,
    };
    
    await pool.query(
      `UPDATE xe SET bien_so = ?, loai_xe_id = ?, tai_xe_hien_tai = ?, trang_thai = ?, 
       nam_san_xuat = ?, hang_xe = ?, dong_xe = ?, mau_xe = ?, so_khung = ?, so_may = ?,
       dung_tich_binh = ?, so_km_hien_tai = ?, han_dang_kiem = ?, han_bao_hiem = ?,
       han_phi_duong_bo = ?, ma_gps = ?, ghi_chu = ? WHERE id = ?`,
      [
        updateData.bien_so,
        updateData.loai_xe_id,
        updateData.tai_xe_hien_tai,
        updateData.trang_thai,
        updateData.nam_san_xuat,
        updateData.hang_xe,
        updateData.dong_xe,
        updateData.mau_xe,
        updateData.so_khung,
        updateData.so_may,
        updateData.dung_tich_binh,
        updateData.so_km_hien_tai,
        updateData.han_dang_kiem,
        updateData.han_bao_hiem,
        updateData.han_phi_duong_bo,
        updateData.ma_gps,
        updateData.ghi_chu,
        req.params.id
      ]
    );
    
    res.json({ success: true, message: 'Cập nhật xe thành công' });
  } catch (error) {
    console.error('Update vehicle error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE vehicle
router.delete('/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM xe WHERE id = ?', [req.params.id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy xe' });
    }
    
    res.json({ success: true, message: 'Xóa xe thành công' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
