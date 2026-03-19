const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { testConnection } = require('./config/database');

// Import routes
const xeRoutes = require('./routes/xe.routes');
const taiXeRoutes = require('./routes/taiXe.routes');
const loaiXeRoutes = require('./routes/loaiXe.routes');
const baoTriRoutes = require('./routes/baoTri.routes');
const loaiBaoTriRoutes = require('./routes/loaiBaoTri.routes');
const canhBaoRoutes = require('./routes/canhBao.routes');
const doNhienLieuRoutes = require('./routes/doNhienLieu.routes');
const chuyenDiRoutes = require('./routes/chuyenDi.routes');
const authRoutes = require('./routes/auth.routes');
const userManagementRoutes = require('./routes/userManagement.routes');
const authenticateToken = authRoutes.authenticateToken;

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const requireRoles = (...roles) => (req, res, next) => {
  const userRole = req.user?.vai_tro;
  if (!userRole || !roles.includes(userRole)) {
    return res.status(403).json({
      success: false,
      message: 'Ban khong co quyen truy cap tai nguyen nay',
    });
  }
  return next();
};

// Request logging middleware
app.use((req, res, next) => {
  console.log(`📨 ${new Date().toLocaleTimeString()} ${req.method} ${req.url}`);
  next();
});

// Test database connection
testConnection();

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/xe', authenticateToken, xeRoutes);
app.use('/api/tai-xe', authenticateToken, taiXeRoutes);
app.use('/api/loai-xe', authenticateToken, requireRoles('quan_ly'), loaiXeRoutes);
app.use('/api/bao-tri', authenticateToken, baoTriRoutes);
app.use('/api/loai-bao-tri', authenticateToken, requireRoles('quan_ly'), loaiBaoTriRoutes);
app.use('/api/canh-bao', authenticateToken, canhBaoRoutes);
app.use('/api/do-nhien-lieu', authenticateToken, doNhienLieuRoutes);
app.use('/api/chuyen-di', authenticateToken, chuyenDiRoutes);
app.use('/api/users', authenticateToken, requireRoles('quan_ly'), userManagementRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Fleet Management API is running',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, _next) => {
  console.error('Error:', err.message);
  res.status(500).json({ 
    success: false, 
    message: 'Internal Server Error',
    error: err.message 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'Route not found' 
  });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
  console.log(`📡 API endpoint: http://localhost:${PORT}/api`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} đang được sử dụng. Hãy đóng ứng dụng khác hoặc đổi port.`);
  } else {
    console.error('❌ Server error:', err);
  }
  process.exit(1);
});

server.on('listening', () => {
  const addr = server.address();
  console.log(`✅ Server listening on ${addr.address}:${addr.port}`);
});
