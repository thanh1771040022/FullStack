const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET ||
  (process.env.NODE_ENV !== 'production' ? 'dev_only_change_me_jwt_secret' : undefined);
const JWT_EXPIRES_IN = '24h';

if (!JWT_SECRET) {
  throw new Error('Missing JWT_SECRET in environment variables');
}

// Đăng ký
router.post('/register', async (req, res) => {
  try {
    const { username, password, email, ho_ten, so_dien_thoai } = req.body;

    // Validate required fields
    if (!username || !password || !email || !ho_ten) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng điền đầy đủ thông tin bắt buộc'
      });
    }

    if (req.body.vai_tro && req.body.vai_tro !== 'tai_xe') {
      return res.status(403).json({
        success: false,
        message: 'Không được phép tự đăng ký tài khoản quản lý'
      });
    }

    const vai_tro = 'tai_xe';

    // Check if username already exists
    const [existingUser] = await pool.query(
      'SELECT id FROM nguoi_dung WHERE username = ?',
      [username]
    );

    if (existingUser.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Tên đăng nhập đã tồn tại'
      });
    }

    // Check if email already exists
    const [existingEmail] = await pool.query(
      'SELECT id FROM nguoi_dung WHERE email = ?',
      [email]
    );

    if (existingEmail.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Email đã được sử dụng'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert new user
    const [result] = await pool.query(
      `INSERT INTO nguoi_dung (username, password, email, ho_ten, vai_tro, so_dien_thoai) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [username, hashedPassword, email, ho_ten, vai_tro, so_dien_thoai || null]
    );

    // Generate token
    const token = jwt.sign(
      { id: result.insertId, username, vai_tro },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.status(201).json({
      success: true,
      message: 'Đăng ký thành công',
      data: {
        id: result.insertId,
        username,
        email,
        ho_ten,
        vai_tro,
        token
      }
    });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi đăng ký'
    });
  }
});

// Đăng nhập
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập tên đăng nhập và mật khẩu'
      });
    }

    // Find user
    const [users] = await pool.query(
      `SELECT id, username, password, email, ho_ten, vai_tro, so_dien_thoai, trang_thai, tai_xe_id 
       FROM nguoi_dung WHERE username = ?`,
      [username]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Tên đăng nhập hoặc mật khẩu không đúng'
      });
    }

    const user = users[0];

    // Check if user is active
    if (user.trang_thai !== 'hoat_dong') {
      return res.status(401).json({
        success: false,
        message: 'Tài khoản đã bị khóa'
      });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Tên đăng nhập hoặc mật khẩu không đúng'
      });
    }

    // Generate token
    const token = jwt.sign(
      { id: user.id, username: user.username, vai_tro: user.vai_tro },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      success: true,
      message: 'Đăng nhập thành công',
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        ho_ten: user.ho_ten,
        vai_tro: user.vai_tro,
        so_dien_thoai: user.so_dien_thoai,
        tai_xe_id: user.tai_xe_id,
        token
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi đăng nhập'
    });
  }
});

// Lấy thông tin user hiện tại (từ token)
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const [users] = await pool.query(
      `SELECT id, username, email, ho_ten, vai_tro, so_dien_thoai, trang_thai, tao_luc 
       FROM nguoi_dung WHERE id = ?`,
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng'
      });
    }

    res.json({
      success: true,
      data: users[0]
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server'
    });
  }
});

// Middleware xác thực token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Không có token xác thực'
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Token không hợp lệ hoặc đã hết hạn'
      });
    }
    req.user = user;
    next();
  });
}

// Export middleware để sử dụng ở các routes khác
router.authenticateToken = authenticateToken;

module.exports = router;
