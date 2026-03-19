const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { pool } = require('../config/database');

const allowedRoles = new Set(['quan_ly', 'tai_xe']);
const allowedStatuses = new Set(['hoat_dong', 'khoa']);
const MAX_PHONE_LENGTH = 15;

const normalizePhone = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const normalized = String(value).trim();
  if (!normalized) return null;

  if (normalized.length > MAX_PHONE_LENGTH) {
    const err = new Error(`so_dien_thoai khong duoc vuot qua ${MAX_PHONE_LENGTH} ky tu`);
    err.status = 400;
    throw err;
  }

  return normalized;
};

const sanitizeUser = (user) => ({
  id: user.id,
  username: user.username,
  email: user.email,
  ho_ten: user.ho_ten,
  vai_tro: user.vai_tro,
  so_dien_thoai: user.so_dien_thoai,
  tai_xe_id: user.tai_xe_id,
  trang_thai: user.trang_thai,
  tao_luc: user.tao_luc,
  cap_nhat_luc: user.cap_nhat_luc,
});

// GET all users (admin only)
router.get('/', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, username, email, ho_ten, vai_tro, so_dien_thoai, tai_xe_id, trang_thai, tao_luc, cap_nhat_luc
       FROM nguoi_dung
       ORDER BY tao_luc DESC`
    );

    res.json({ success: true, data: rows.map(sanitizeUser) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST create user (admin only)
router.post('/', async (req, res) => {
  try {
    const {
      username,
      password,
      email,
      ho_ten,
      vai_tro,
      so_dien_thoai,
      tai_xe_id,
      trang_thai,
    } = req.body;
    const normalizedPhone = normalizePhone(so_dien_thoai);

    if (!username || !password || !email || !ho_ten || !vai_tro) {
      return res.status(400).json({
        success: false,
        message: 'Vui long nhap day du username, password, email, ho_ten va vai_tro',
      });
    }

    if (!allowedRoles.has(vai_tro)) {
      return res.status(400).json({
        success: false,
        message: 'vai_tro khong hop le',
      });
    }

    const newStatus = trang_thai || 'hoat_dong';
    if (!allowedStatuses.has(newStatus)) {
      return res.status(400).json({
        success: false,
        message: 'trang_thai khong hop le',
      });
    }

    const [existingUsername] = await pool.query('SELECT id FROM nguoi_dung WHERE username = ?', [username]);
    if (existingUsername.length > 0) {
      return res.status(400).json({ success: false, message: 'Ten dang nhap da ton tai' });
    }

    const [existingEmail] = await pool.query('SELECT id FROM nguoi_dung WHERE email = ?', [email]);
    if (existingEmail.length > 0) {
      return res.status(400).json({ success: false, message: 'Email da duoc su dung' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      `INSERT INTO nguoi_dung (username, password, email, ho_ten, vai_tro, so_dien_thoai, tai_xe_id, trang_thai)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        username,
        hashedPassword,
        email,
        ho_ten,
        vai_tro,
        normalizedPhone,
        tai_xe_id || null,
        newStatus,
      ]
    );

    const [rows] = await pool.query(
      `SELECT id, username, email, ho_ten, vai_tro, so_dien_thoai, tai_xe_id, trang_thai, tao_luc, cap_nhat_luc
       FROM nguoi_dung
       WHERE id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: 'Tao nguoi dung thanh cong',
      data: sanitizeUser(rows[0]),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT update user info/role (admin only)
router.put('/:id', async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(400).json({ success: false, message: 'id khong hop le' });
    }

    const [existingRows] = await pool.query('SELECT * FROM nguoi_dung WHERE id = ?', [userId]);
    if (existingRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Khong tim thay nguoi dung' });
    }

    const current = existingRows[0];
    const normalizedPhone = normalizePhone(req.body.so_dien_thoai);
    const nextRole = req.body.vai_tro ?? current.vai_tro;
    const nextStatus = req.body.trang_thai ?? current.trang_thai;

    if (!allowedRoles.has(nextRole)) {
      return res.status(400).json({ success: false, message: 'vai_tro khong hop le' });
    }
    if (!allowedStatuses.has(nextStatus)) {
      return res.status(400).json({ success: false, message: 'trang_thai khong hop le' });
    }

    const nextUsername = req.body.username ?? current.username;
    const nextEmail = req.body.email ?? current.email;

    const [dupUsername] = await pool.query('SELECT id FROM nguoi_dung WHERE username = ? AND id <> ?', [nextUsername, userId]);
    if (dupUsername.length > 0) {
      return res.status(400).json({ success: false, message: 'Ten dang nhap da ton tai' });
    }

    const [dupEmail] = await pool.query('SELECT id FROM nguoi_dung WHERE email = ? AND id <> ?', [nextEmail, userId]);
    if (dupEmail.length > 0) {
      return res.status(400).json({ success: false, message: 'Email da duoc su dung' });
    }

    let nextPassword = current.password;
    if (req.body.password) {
      nextPassword = await bcrypt.hash(req.body.password, 10);
    }

    await pool.query(
      `UPDATE nguoi_dung
       SET username = ?, password = ?, email = ?, ho_ten = ?, vai_tro = ?, so_dien_thoai = ?, tai_xe_id = ?, trang_thai = ?, cap_nhat_luc = NOW()
       WHERE id = ?`,
      [
        nextUsername,
        nextPassword,
        nextEmail,
        req.body.ho_ten ?? current.ho_ten,
        nextRole,
        normalizedPhone !== undefined ? normalizedPhone : current.so_dien_thoai,
        req.body.tai_xe_id !== undefined ? req.body.tai_xe_id : current.tai_xe_id,
        nextStatus,
        userId,
      ]
    );

    const [rows] = await pool.query(
      `SELECT id, username, email, ho_ten, vai_tro, so_dien_thoai, tai_xe_id, trang_thai, tao_luc, cap_nhat_luc
       FROM nguoi_dung
       WHERE id = ?`,
      [userId]
    );

    res.json({
      success: true,
      message: 'Cap nhat nguoi dung thanh cong',
      data: sanitizeUser(rows[0]),
    });
  } catch (error) {
    if (error.status === 400) {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error.code === 'ER_DATA_TOO_LONG') {
      return res.status(400).json({ success: false, message: 'Du lieu vuot gioi han do dai cho phep' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH lock/unlock account (admin only)
router.patch('/:id/status', async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const { trang_thai } = req.body;

    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(400).json({ success: false, message: 'id khong hop le' });
    }

    if (!allowedStatuses.has(trang_thai)) {
      return res.status(400).json({ success: false, message: 'trang_thai khong hop le' });
    }

    const [result] = await pool.query(
      'UPDATE nguoi_dung SET trang_thai = ?, cap_nhat_luc = NOW() WHERE id = ?',
      [trang_thai, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Khong tim thay nguoi dung' });
    }

    res.json({ success: true, message: 'Cap nhat trang thai thanh cong' });
  } catch (error) {
    if (error.status === 400) {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error.code === 'ER_DATA_TOO_LONG') {
      return res.status(400).json({ success: false, message: 'Du lieu vuot gioi han do dai cho phep' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
