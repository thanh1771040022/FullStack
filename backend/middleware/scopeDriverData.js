const { pool } = require('../config/database');

const scopeDriverData = async (req, res, next) => {
  try {
    const role = req.user?.vai_tro;

    if (role === 'quan_ly') {
      req.scope = {
        isManager: true,
        driverId: null,
        vehicleIds: [],
      };
      return next();
    }

    if (role !== 'tai_xe') {
      return res.status(403).json({ success: false, message: 'Vai tro khong hop le de truy cap.' });
    }

    const [users] = await pool.query(
      'SELECT id, tai_xe_id FROM nguoi_dung WHERE id = ? LIMIT 1',
      [req.user?.id]
    );

    if (users.length === 0 || !users[0].tai_xe_id) {
      return res.status(403).json({ success: false, message: 'Tai khoan tai xe chua duoc gan ho so tai xe.' });
    }

    const driverId = Number(users[0].tai_xe_id);

    const [vehicles] = await pool.query(
      'SELECT id FROM xe WHERE tai_xe_hien_tai = ?',
      [driverId]
    );

    req.scope = {
      isManager: false,
      driverId,
      vehicleIds: vehicles.map((row) => Number(row.id)).filter((id) => Number.isFinite(id)),
    };

    return next();
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = scopeDriverData;
