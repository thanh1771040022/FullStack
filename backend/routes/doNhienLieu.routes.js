const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

const round = (value, decimals = 2) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const APPROVAL_STATUSES = new Set(['cho_duyet', 'da_duyet', 'tu_choi']);

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
};

const parseAuditJson = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const pad2 = (n) => String(n).padStart(2, '0');

const toMysqlDateTime = (value) => {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())} ${pad2(value.getHours())}:${pad2(value.getMinutes())}:${pad2(value.getSeconds())}`;
  }

  const asString = String(value).trim();
  if (!asString) return null;

  // Accept already-correct format.
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(asString)) {
    return asString;
  }

  // Accept HTML datetime-local format and convert to MySQL DATETIME.
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(asString)) {
    return `${asString.replace('T', ' ')}${asString.length === 16 ? ':00' : ''}`;
  }

  const date = new Date(asString);
  if (Number.isNaN(date.getTime())) return null;

  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
};

const buildBadRequest = (message, details = []) => ({
  status: 400,
  message,
  details,
});

let auditTableReady = false;

const isManager = (req) => req.user?.vai_tro === 'quan_ly';

const ensureAuditTable = async (connection) => {
  if (auditTableReady) return;

  await connection.query(
    `CREATE TABLE IF NOT EXISTS nhat_ky_du_lieu (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      bang_du_lieu VARCHAR(100) NOT NULL,
      ban_ghi_id BIGINT NULL,
      hanh_dong ENUM('tao','cap_nhat','xoa','duyet','tu_choi') NOT NULL,
      du_lieu_cu JSON NULL,
      du_lieu_moi JSON NULL,
      nguoi_thuc_hien_id INT NULL,
      vai_tro_nguoi_thuc_hien VARCHAR(30) NULL,
      tao_luc TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_nhat_ky_bang (bang_du_lieu),
      INDEX idx_nhat_ky_ban_ghi (ban_ghi_id),
      INDEX idx_nhat_ky_nguoi_dung (nguoi_thuc_hien_id),
      INDEX idx_nhat_ky_tao_luc (tao_luc)
    )`
  );

  auditTableReady = true;
};

const appendApprovalNote = (oldNote, approvalStatus, reviewerName, reason) => {
  const action = approvalStatus === 'da_duyet' ? 'DUYET' : 'TU_CHOI';
  const actor = reviewerName || 'N/A';
  const message = String(reason || '').trim();
  const noteLine = `[${action}] boi ${actor}${message ? `: ${message}` : ''}`;
  if (!oldNote) return noteLine;
  return `${oldNote}\n${noteLine}`;
};

const writeAuditLog = async (connection, req, payload) => {
  await ensureAuditTable(connection);

  await connection.query(
    `INSERT INTO nhat_ky_du_lieu (
      bang_du_lieu,
      ban_ghi_id,
      hanh_dong,
      du_lieu_cu,
      du_lieu_moi,
      nguoi_thuc_hien_id,
      vai_tro_nguoi_thuc_hien
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.bang_du_lieu,
      payload.ban_ghi_id || null,
      payload.hanh_dong,
      payload.du_lieu_cu ? JSON.stringify(payload.du_lieu_cu) : null,
      payload.du_lieu_moi ? JSON.stringify(payload.du_lieu_moi) : null,
      req.user?.id || null,
      req.user?.vai_tro || null,
    ]
  );
};

const getRequesterDriverId = async (connection, req) => {
  if (isManager(req)) return null;
  const [users] = await connection.query(
    'SELECT id, tai_xe_id, email, so_dien_thoai, ho_ten FROM nguoi_dung WHERE id = ?',
    [req.user?.id]
  );

  if (users.length === 0) return null;
  const user = users[0];

  // Prefer deterministic identity matching (email/phone/name) to avoid stale tai_xe_id links.
  const [matches] = await connection.query(
    `SELECT id
     FROM tai_xe
     WHERE (email IS NOT NULL AND email <> '' AND email = ?)
        OR (so_dien_thoai IS NOT NULL AND so_dien_thoai <> '' AND so_dien_thoai = ?)
        OR (ho_ten IS NOT NULL AND ho_ten <> '' AND ho_ten = ?)
     ORDER BY
       CASE
         WHEN email = ? THEN 1
         WHEN so_dien_thoai = ? THEN 2
         WHEN ho_ten = ? THEN 3
         ELSE 4
       END,
       id ASC
     LIMIT 1`,
    [user.email || '', user.so_dien_thoai || '', user.ho_ten || '', user.email || '', user.so_dien_thoai || '', user.ho_ten || '']
  );

  if (matches.length > 0) {
    const resolvedDriverId = Number(matches[0].id);
    if (!Number.isFinite(Number(user.tai_xe_id)) || Number(user.tai_xe_id) !== resolvedDriverId) {
      await connection.query('UPDATE nguoi_dung SET tai_xe_id = ?, cap_nhat_luc = NOW() WHERE id = ?', [resolvedDriverId, user.id]);
    }
    return resolvedDriverId;
  }

  return user.tai_xe_id ? Number(user.tai_xe_id) : null;
};

const buildFuelScopeFilter = (scope, alias = 'dnl') => {
  if (scope?.isManager) {
    return { clause: '1=1', params: [] };
  }

  const params = [scope.driverId];
  let clause = `(${alias}.tai_xe_id = ?)`;

  if (scope.vehicleIds.length > 0) {
    const placeholders = scope.vehicleIds.map(() => '?').join(',');
    clause = `(${clause} OR ${alias}.xe_id IN (${placeholders}))`;
    params.push(...scope.vehicleIds);
  }

  return { clause, params };
};

const canAccessFuelRecord = (scope, record) => {
  if (scope?.isManager) return true;
  return Number(record.tai_xe_id) === Number(scope?.driverId) || scope?.vehicleIds?.includes(Number(record.xe_id));
};

const validateAndComputeFuelMetrics = async (connection, payload) => {
  const errors = [];

  const xeId = toNumber(payload.xe_id);
  const taiXeId = toNumber(payload.tai_xe_id);
  const soLit = toNumber(payload.so_lit);
  const giaMoiLit = toNumber(payload.gia_moi_lit);
  const kmTruoc = toNumber(payload.km_truoc);
  const kmSau = toNumber(payload.km_sau);
  const suppliedTongTien = payload.tong_tien !== undefined && payload.tong_tien !== null
    ? toNumber(payload.tong_tien)
    : null;
  const trangThaiDuyet = payload.trang_thai_duyet || 'cho_duyet';
  const normalizedDateTime = toMysqlDateTime(payload.thoi_gian_do);

  if (!xeId || xeId <= 0) errors.push('xe_id phai la so duong.');
  if (!taiXeId || taiXeId <= 0) errors.push('tai_xe_id phai la so duong.');
  if (!payload.thoi_gian_do) errors.push('thoi_gian_do la truong bat buoc.');
  if (payload.thoi_gian_do && !normalizedDateTime) {
    errors.push('thoi_gian_do khong dung dinh dang thoi gian hop le.');
  }
  if (!Number.isFinite(soLit) || soLit <= 0) errors.push('so_lit phai lon hon 0.');
  if (!Number.isFinite(giaMoiLit) || giaMoiLit <= 0) errors.push('gia_moi_lit phai lon hon 0.');
  if (!Number.isFinite(kmTruoc)) errors.push('km_truoc phai la so hop le.');
  if (!Number.isFinite(kmSau)) errors.push('km_sau phai la so hop le.');
  if (!APPROVAL_STATUSES.has(trangThaiDuyet)) {
    errors.push('trang_thai_duyet khong hop le.');
  }

  if (Number.isFinite(kmTruoc) && Number.isFinite(kmSau) && kmSau <= kmTruoc) {
    errors.push('km_sau phai lon hon km_truoc.');
  }

  if (errors.length > 0) {
    throw buildBadRequest('Du lieu nhien lieu khong hop le.', errors);
  }

  const [vehicles] = await connection.query(
    `SELECT x.id, x.bien_so, lx.ten_loai_xe, lx.dinh_muc_nhien_lieu, lx.nguong_canh_bao
     FROM xe x
     LEFT JOIN loai_xe lx ON x.loai_xe_id = lx.id
     WHERE x.id = ?`,
    [xeId]
  );

  if (vehicles.length === 0) {
    throw buildBadRequest('xe_id khong ton tai trong he thong.');
  }

  const vehicle = vehicles[0];
  const quangDuong = round(kmSau - kmTruoc, 2);

  if (quangDuong <= 0) {
    throw buildBadRequest('Quang duong tinh duoc khong hop le. Vui long kiem tra km_truoc va km_sau.');
  }

  const mucTieuHao = round((soLit / quangDuong) * 100, 2);
  const dinhMucNhienLieu = toNumber(vehicle.dinh_muc_nhien_lieu);
  const nguongCanhBao = Number.isFinite(toNumber(vehicle.nguong_canh_bao))
    ? toNumber(vehicle.nguong_canh_bao)
    : 20;
  const rawTyLeVuotDinhMuc = Number.isFinite(dinhMucNhienLieu) && dinhMucNhienLieu > 0
    ? round(((mucTieuHao - dinhMucNhienLieu) / dinhMucNhienLieu) * 100, 2)
    : 0;
  const tyLeVuotDinhMuc = clamp(rawTyLeVuotDinhMuc, -999.99, 999.99);

  const vuotDinhMuc = Number.isFinite(dinhMucNhienLieu) && dinhMucNhienLieu > 0
    ? rawTyLeVuotDinhMuc > nguongCanhBao
    : false;

  // Nghi van khai khong: quang duong rat nho so voi luong nhien lieu, hoac tieu hao qua cao.
  const nghiVanKhaiKhong =
    (quangDuong < 3 && soLit >= 15) ||
    (mucTieuHao > 40) ||
    (Number.isFinite(dinhMucNhienLieu) && dinhMucNhienLieu > 0 && mucTieuHao > dinhMucNhienLieu * 2.2);

  const batThuong = vuotDinhMuc || nghiVanKhaiKhong;
  const tongTien = Number.isFinite(suppliedTongTien) && suppliedTongTien > 0
    ? round(suppliedTongTien, 2)
    : round(soLit * giaMoiLit, 2);

  let mucDoCanhBao = 'trung_binh';
  if (nghiVanKhaiKhong || rawTyLeVuotDinhMuc > 50) {
    mucDoCanhBao = 'nghiem_trong';
  } else if (rawTyLeVuotDinhMuc > 25) {
    mucDoCanhBao = 'cao';
  }

  return {
    normalized: {
      xe_id: xeId,
      tai_xe_id: taiXeId,
      thoi_gian_do: normalizedDateTime,
      tram_xang: payload.tram_xang || null,
      loai_nhien_lieu: payload.loai_nhien_lieu || 'dau_diesel',
      so_lit: round(soLit, 2),
      gia_moi_lit: round(giaMoiLit, 2),
      tong_tien: tongTien,
      km_truoc: round(kmTruoc, 2),
      km_sau: round(kmSau, 2),
      quang_duong: quangDuong,
      muc_tieu_hao: mucTieuHao,
      bat_thuong: batThuong,
      ty_le_vuot_dinh_muc: tyLeVuotDinhMuc,
      trang_thai_duyet: trangThaiDuyet,
      ghi_chu: payload.ghi_chu || null,
    },
    analysis: {
      vehicle,
      dinh_muc_nhien_lieu: Number.isFinite(dinhMucNhienLieu) ? dinhMucNhienLieu : null,
      nguong_canh_bao: nguongCanhBao,
      vuot_dinh_muc: vuotDinhMuc,
      nghi_van_khai_khong: nghiVanKhaiKhong,
      muc_do_canh_bao: mucDoCanhBao,
    },
  };
};

const createFuelAlert = async (connection, metrics) => {
  const { normalized, analysis } = metrics;
  if (!normalized.bat_thuong) return;

  const dinhMucText = analysis.dinh_muc_nhien_lieu
    ? `${analysis.dinh_muc_nhien_lieu} L/100km`
    : 'chua cau hinh';
  const lyDo = analysis.nghi_van_khai_khong
    ? 'Nghi van khai khong nhien lieu.'
    : 'Vuot dinh muc nhien lieu cho phep.';

  const tieuDe = `Canh bao nhien lieu bat thuong - ${analysis.vehicle.bien_so}`;
  const noiDung = [
    `Xe: ${analysis.vehicle.bien_so}`,
    `Muc tieu hao: ${normalized.muc_tieu_hao} L/100km`,
    `Dinh muc: ${dinhMucText}`,
    `Ty le vuot: ${normalized.ty_le_vuot_dinh_muc}%`,
    `Quang duong: ${normalized.quang_duong} km, So lit: ${normalized.so_lit} L`,
    lyDo,
  ].join(' | ');

  await connection.query(
    `INSERT INTO canh_bao (xe_id, tai_xe_id, loai_canh_bao, muc_do, tieu_de, noi_dung, da_doc, tao_luc)
     VALUES (?, ?, 'nhien_lieu_bat_thuong', ?, ?, ?, 0, NOW())`,
    [
      normalized.xe_id,
      normalized.tai_xe_id,
      analysis.muc_do_canh_bao,
      tieuDe,
      noiDung,
    ]
  );
};

// GET all fuel records
router.get('/', async (req, res) => {
  try {
    const scopeFilter = buildFuelScopeFilter(req.scope, 'dnl');
    const [rows] = await pool.query(
      `SELECT dnl.*, x.bien_so
       FROM do_nhien_lieu dnl
       LEFT JOIN xe x ON dnl.xe_id = x.id
       WHERE ${scopeFilter.clause}
       ORDER BY dnl.id DESC`,
      scopeFilter.params
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET fuel statistics summary - MUST be before /:id
router.get('/stats/summary', async (req, res) => {
  try {
    const scopeFilter = buildFuelScopeFilter(req.scope, 'do_nhien_lieu');

    const [total] = await pool.query(`
      SELECT 
        SUM(so_lit) as tong_lit,
        SUM(tong_tien) as tong_chi_phi,
        AVG(gia_moi_lit) as gia_trung_binh
      FROM do_nhien_lieu
      WHERE ${scopeFilter.clause}
    `, scopeFilter.params);
    
    const [byVehicle] = await pool.query(`
      SELECT x.bien_so, SUM(dnl.so_lit) as tong_lit, SUM(dnl.tong_tien) as tong_tien
      FROM do_nhien_lieu dnl
      LEFT JOIN xe x ON dnl.xe_id = x.id
      WHERE ${buildFuelScopeFilter(req.scope, 'dnl').clause}
      GROUP BY dnl.xe_id, x.bien_so
      ORDER BY tong_tien DESC
    `, buildFuelScopeFilter(req.scope, 'dnl').params);
    
    res.json({ 
      success: true, 
      data: {
        summary: total[0],
        byVehicle: byVehicle
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET monthly fuel statistics - MUST be before /:id
router.get('/stats/monthly', async (req, res) => {
  try {
    const year = req.query.year || new Date().getFullYear();
    const scopeFilter = buildFuelScopeFilter(req.scope, 'do_nhien_lieu');
    
    const [rows] = await pool.query(`
      SELECT 
        MONTH(thoi_gian_do) as thang,
        SUM(so_lit) as tong_lit,
        SUM(tong_tien) as tong_chi_phi
      FROM do_nhien_lieu
      WHERE YEAR(thoi_gian_do) = ? AND ${scopeFilter.clause}
      GROUP BY MONTH(thoi_gian_do)
      ORDER BY thang
    `, [year, ...scopeFilter.params]);
    
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET fuel analysis by vehicle in a date range - MUST be before /:id
router.get('/analysis/by-vehicle', async (req, res) => {
  try {
    const { from, to, xeId } = req.query;
    const where = ['1=1'];
    const params = [];

    if (from) {
      where.push('DATE(dnl.thoi_gian_do) >= ?');
      params.push(from);
    }
    if (to) {
      where.push('DATE(dnl.thoi_gian_do) <= ?');
      params.push(to);
    }
    if (xeId) {
      where.push('dnl.xe_id = ?');
      params.push(xeId);
    }

    if (!req.scope?.isManager) {
      const scopeFilter = buildFuelScopeFilter(req.scope, 'dnl');
      where.push(scopeFilter.clause);
      params.push(...scopeFilter.params);
    }

    const [rows] = await pool.query(
      `SELECT
        x.id AS xe_id,
        x.bien_so,
        lx.ten_loai_xe,
        lx.dinh_muc_nhien_lieu,
        lx.nguong_canh_bao,
        SUM(dnl.so_lit) AS tong_so_lit,
        SUM(dnl.tong_tien) AS tong_tien,
        SUM(dnl.quang_duong) AS tong_quang_duong,
        COUNT(dnl.id) AS so_lan_do,
        ROUND((SUM(dnl.so_lit) / NULLIF(SUM(dnl.quang_duong), 0)) * 100, 2) AS muc_tieu_hao_thuc_te,
        ROUND(
          ((SUM(dnl.so_lit) / NULLIF(SUM(dnl.quang_duong), 0)) * 100 - lx.dinh_muc_nhien_lieu)
          / NULLIF(lx.dinh_muc_nhien_lieu, 0) * 100,
          2
        ) AS ty_le_vuot_dinh_muc
      FROM do_nhien_lieu dnl
      JOIN xe x ON dnl.xe_id = x.id
      JOIN loai_xe lx ON x.loai_xe_id = lx.id
      WHERE ${where.join(' AND ')}
      GROUP BY x.id, x.bien_so, lx.ten_loai_xe, lx.dinh_muc_nhien_lieu, lx.nguong_canh_bao
      ORDER BY ty_le_vuot_dinh_muc DESC, x.bien_so ASC`,
      params
    );

    const data = rows.map((row) => {
      const nguong = Number.isFinite(toNumber(row.nguong_canh_bao)) ? toNumber(row.nguong_canh_bao) : 20;
      const tyLeVuot = Number.isFinite(toNumber(row.ty_le_vuot_dinh_muc)) ? toNumber(row.ty_le_vuot_dinh_muc) : 0;

      return {
        ...row,
        tong_so_lit: round(toNumber(row.tong_so_lit) || 0, 2),
        tong_tien: round(toNumber(row.tong_tien) || 0, 2),
        tong_quang_duong: round(toNumber(row.tong_quang_duong) || 0, 2),
        muc_tieu_hao_thuc_te: round(toNumber(row.muc_tieu_hao_thuc_te) || 0, 2),
        ty_le_vuot_dinh_muc: round(tyLeVuot, 2),
        bat_thuong: tyLeVuot > nguong,
      };
    });

    res.json({
      success: true,
      data,
      meta: {
        filters: { from: from || null, to: to || null, xeId: xeId || null },
        total: data.length,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET abnormal fuel records - MUST be before /:id
router.get('/anomalies', async (req, res) => {
  try {
    const { from, to, xeId, minDeviation } = req.query;
    const where = ['1=1'];
    const params = [];

    if (from) {
      where.push('DATE(dnl.thoi_gian_do) >= ?');
      params.push(from);
    }
    if (to) {
      where.push('DATE(dnl.thoi_gian_do) <= ?');
      params.push(to);
    }
    if (xeId) {
      where.push('dnl.xe_id = ?');
      params.push(xeId);
    }

    if (!req.scope?.isManager) {
      const scopeFilter = buildFuelScopeFilter(req.scope, 'dnl');
      where.push(scopeFilter.clause);
      params.push(...scopeFilter.params);
    }

    const [rows] = await pool.query(
      `SELECT
        dnl.id,
        dnl.xe_id,
        dnl.tai_xe_id,
        dnl.thoi_gian_do,
        dnl.so_lit,
        dnl.tong_tien,
        dnl.quang_duong,
        dnl.muc_tieu_hao,
        dnl.ty_le_vuot_dinh_muc,
        dnl.bat_thuong,
        x.bien_so,
        lx.ten_loai_xe,
        lx.dinh_muc_nhien_lieu,
        lx.nguong_canh_bao
      FROM do_nhien_lieu dnl
      JOIN xe x ON dnl.xe_id = x.id
      JOIN loai_xe lx ON x.loai_xe_id = lx.id
      WHERE ${where.join(' AND ')}
      ORDER BY dnl.thoi_gian_do DESC`,
      params
    );

    const minDeviationValue = Number.isFinite(toNumber(minDeviation)) ? toNumber(minDeviation) : null;

    const items = rows.filter((row) => {
      const tyLeVuot = Number.isFinite(toNumber(row.ty_le_vuot_dinh_muc)) ? toNumber(row.ty_le_vuot_dinh_muc) : 0;
      const nguong = Number.isFinite(toNumber(row.nguong_canh_bao)) ? toNumber(row.nguong_canh_bao) : 20;

      if (minDeviationValue !== null) {
        return tyLeVuot >= minDeviationValue;
      }

      return Boolean(row.bat_thuong) || tyLeVuot > nguong;
    }).map((row) => ({
      ...row,
      so_lit: round(toNumber(row.so_lit) || 0, 2),
      tong_tien: round(toNumber(row.tong_tien) || 0, 2),
      quang_duong: round(toNumber(row.quang_duong) || 0, 2),
      muc_tieu_hao: round(toNumber(row.muc_tieu_hao) || 0, 2),
      ty_le_vuot_dinh_muc: round(toNumber(row.ty_le_vuot_dinh_muc) || 0, 2),
      risk_score: round(Math.max(toNumber(row.ty_le_vuot_dinh_muc) || 0, 0), 2),
    }));

    res.json({
      success: true,
      data: {
        total: items.length,
        items,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST validate fuel payload for approval flow - MUST be before /:id
router.post('/validate', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    try {
      const metrics = await validateAndComputeFuelMetrics(connection, req.body);
      const response = {
        ...metrics.normalized,
        dinh_muc_nhien_lieu: metrics.analysis.dinh_muc_nhien_lieu,
        nguong_canh_bao: metrics.analysis.nguong_canh_bao,
        vuot_dinh_muc: metrics.analysis.vuot_dinh_muc,
        nghi_van_khai_khong: metrics.analysis.nghi_van_khai_khong,
        muc_do_canh_bao: metrics.analysis.muc_do_canh_bao,
      };

      res.json({ success: true, data: response });
    } finally {
      connection.release();
    }
  } catch (error) {
    if (error.status === 400) {
      return res.status(400).json({
        success: false,
        message: error.message,
        details: error.details || [],
      });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET pending fuel approvals (manager only) - MUST be before /:id
router.get('/approval/pending', async (req, res) => {
  let connection;
  try {
    if (!isManager(req)) {
      return res.status(403).json({ success: false, message: 'Ban khong co quyen duyet nhien lieu.' });
    }

    connection = await pool.getConnection();
    await ensureAuditTable(connection);

    const [rows] = await connection.query(
      `SELECT
        dnl.*,
        x.bien_so,
        tx.ho_ten AS tai_xe_ten,
        nd_submit.ho_ten AS nguoi_gui_ho_ten,
        nd_submit.username AS nguoi_gui_username,
        lx.dinh_muc_nhien_lieu,
        lx.nguong_canh_bao
      FROM do_nhien_lieu dnl
      JOIN xe x ON dnl.xe_id = x.id
      JOIN tai_xe tx ON dnl.tai_xe_id = tx.id
      LEFT JOIN (
        SELECT nk.ban_ghi_id, MAX(nk.id) AS latest_log_id
        FROM nhat_ky_du_lieu nk
        WHERE nk.bang_du_lieu = 'do_nhien_lieu' AND nk.hanh_dong = 'tao'
        GROUP BY nk.ban_ghi_id
      ) lk ON lk.ban_ghi_id = dnl.id
      LEFT JOIN nhat_ky_du_lieu nk_submit ON nk_submit.id = lk.latest_log_id
      LEFT JOIN nguoi_dung nd_submit ON nd_submit.id = nk_submit.nguoi_thuc_hien_id
      LEFT JOIN loai_xe lx ON x.loai_xe_id = lx.id
      WHERE dnl.trang_thai_duyet = 'cho_duyet'
      ORDER BY dnl.tao_luc ASC`
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// GET audit history by fuel record ID (manager only) - MUST be before /:id
router.get('/:id/audit', async (req, res) => {
  let connection;
  try {
    if (!isManager(req)) {
      return res.status(403).json({ success: false, message: 'Ban khong co quyen xem lich su audit.' });
    }

    const recordId = Number(req.params.id);
    if (!Number.isFinite(recordId) || recordId <= 0) {
      return res.status(400).json({ success: false, message: 'id ban ghi khong hop le.' });
    }

    connection = await pool.getConnection();
    await ensureAuditTable(connection);

    const [rows] = await connection.query(
      `SELECT
        nk.id,
        nk.bang_du_lieu,
        nk.ban_ghi_id,
        nk.hanh_dong,
        nk.du_lieu_cu,
        nk.du_lieu_moi,
        nk.nguoi_thuc_hien_id,
        nk.vai_tro_nguoi_thuc_hien,
        nk.tao_luc,
        nd.username AS nguoi_thuc_hien_username,
        nd.ho_ten AS nguoi_thuc_hien_ho_ten
      FROM nhat_ky_du_lieu nk
      LEFT JOIN nguoi_dung nd ON nk.nguoi_thuc_hien_id = nd.id
      WHERE nk.bang_du_lieu = 'do_nhien_lieu' AND nk.ban_ghi_id = ?
      ORDER BY nk.id DESC`,
      [recordId]
    );

    const data = rows.map((row) => ({
      ...row,
      du_lieu_cu: parseAuditJson(row.du_lieu_cu),
      du_lieu_moi: parseAuditJson(row.du_lieu_moi),
    }));

    res.json({
      success: true,
      data: {
        recordId,
        total: data.length,
        items: data,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// GET fuel records by vehicle ID - MUST be before /:id
router.get('/xe/:xeId', async (req, res) => {
  try {
    if (!req.scope?.isManager && !req.scope?.vehicleIds?.includes(Number(req.params.xeId))) {
      return res.status(403).json({ success: false, message: 'Ban khong co quyen xem du lieu nhien lieu cua xe nay.' });
    }

    const [rows] = await pool.query(`
      SELECT * FROM do_nhien_lieu WHERE xe_id = ? ORDER BY id DESC
    `, [req.params.xeId]);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET fuel record by ID
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM do_nhien_lieu WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bản ghi nhiên liệu' });
    }

    if (!canAccessFuelRecord(req.scope, rows[0])) {
      return res.status(403).json({ success: false, message: 'Ban khong co quyen xem ban ghi nhien lieu nay.' });
    }

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST create new fuel record
router.post('/', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const driverId = await getRequesterDriverId(connection, req);
    if (!isManager(req) && !driverId) {
      await connection.rollback();
      return res.status(403).json({ success: false, message: 'Tai khoan tai xe chua duoc gan ho so tai xe.' });
    }

    const payloadInput = { ...req.body };
    if (isManager(req)) {
      payloadInput.trang_thai_duyet = APPROVAL_STATUSES.has(req.body.trang_thai_duyet)
        ? req.body.trang_thai_duyet
        : 'da_duyet';
    } else {
      payloadInput.tai_xe_id = driverId;
      payloadInput.trang_thai_duyet = 'cho_duyet';
    }

    const metrics = await validateAndComputeFuelMetrics(connection, payloadInput);
    const payload = metrics.normalized;

    const [result] = await connection.query(
      `INSERT INTO do_nhien_lieu (xe_id, tai_xe_id, thoi_gian_do, tram_xang, loai_nhien_lieu, so_lit, gia_moi_lit, tong_tien, km_truoc, km_sau, quang_duong, muc_tieu_hao, bat_thuong, ty_le_vuot_dinh_muc, trang_thai_duyet, ghi_chu) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.xe_id,
        payload.tai_xe_id,
        payload.thoi_gian_do,
        payload.tram_xang,
        payload.loai_nhien_lieu,
        payload.so_lit,
        payload.gia_moi_lit,
        payload.tong_tien,
        payload.km_truoc,
        payload.km_sau,
        payload.quang_duong,
        payload.muc_tieu_hao,
        payload.bat_thuong,
        payload.ty_le_vuot_dinh_muc,
        payload.trang_thai_duyet,
        payload.ghi_chu,
      ]
    );

    if (payload.trang_thai_duyet === 'da_duyet') {
      await createFuelAlert(connection, metrics);
    }

    await writeAuditLog(connection, req, {
      bang_du_lieu: 'do_nhien_lieu',
      ban_ghi_id: result.insertId,
      hanh_dong: 'tao',
      du_lieu_cu: null,
      du_lieu_moi: payload,
    });

    await connection.commit();

    res.status(201).json({ 
      success: true, 
      message: 'Thêm bản ghi nhiên liệu thành công',
      data: {
        id: result.insertId,
        ...payload,
        canh_bao_duoc_tao: payload.bat_thuong && payload.trang_thai_duyet === 'da_duyet',
      }
    });
  } catch (error) {
    if (connection) await connection.rollback();

    if (error.status === 400) {
      return res.status(400).json({
        success: false,
        message: error.message,
        details: error.details || [],
      });
    }

    res.status(500).json({ success: false, message: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// PUT update fuel record
router.put('/:id', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [existingRows] = await connection.query(
      'SELECT * FROM do_nhien_lieu WHERE id = ?',
      [req.params.id]
    );

    if (existingRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Không tìm thấy bản ghi nhiên liệu' });
    }

    const existing = existingRows[0];
    const driverId = await getRequesterDriverId(connection, req);
    if (!isManager(req)) {
      if (!driverId || Number(existing.tai_xe_id) !== Number(driverId)) {
        await connection.rollback();
        return res.status(403).json({ success: false, message: 'Ban khong co quyen sua ban ghi nay.' });
      }
      if (existing.trang_thai_duyet !== 'cho_duyet') {
        await connection.rollback();
        return res.status(400).json({ success: false, message: 'Chi duoc sua ban ghi dang cho duyet.' });
      }
    }

    const mergedPayload = {
      ...existing,
      ...req.body,
    };

    if (isManager(req)) {
      mergedPayload.trang_thai_duyet = APPROVAL_STATUSES.has(req.body.trang_thai_duyet)
        ? req.body.trang_thai_duyet
        : existing.trang_thai_duyet;
    } else {
      mergedPayload.tai_xe_id = driverId;
      mergedPayload.trang_thai_duyet = 'cho_duyet';
    }

    const metrics = await validateAndComputeFuelMetrics(connection, mergedPayload);
    const payload = metrics.normalized;

    await connection.query(
      `UPDATE do_nhien_lieu SET xe_id = ?, tai_xe_id = ?, thoi_gian_do = ?, tram_xang = ?, loai_nhien_lieu = ?, so_lit = ?, gia_moi_lit = ?, 
       tong_tien = ?, km_truoc = ?, km_sau = ?, quang_duong = ?, muc_tieu_hao = ?, bat_thuong = ?, ty_le_vuot_dinh_muc = ?, trang_thai_duyet = ?, ghi_chu = ? WHERE id = ?`,
      [
        payload.xe_id,
        payload.tai_xe_id,
        payload.thoi_gian_do,
        payload.tram_xang,
        payload.loai_nhien_lieu,
        payload.so_lit,
        payload.gia_moi_lit,
        payload.tong_tien,
        payload.km_truoc,
        payload.km_sau,
        payload.quang_duong,
        payload.muc_tieu_hao,
        payload.bat_thuong,
        payload.ty_le_vuot_dinh_muc,
        payload.trang_thai_duyet,
        payload.ghi_chu,
        req.params.id,
      ]
    );

    const wasAbnormal = Boolean(existing.bat_thuong);
    const wasApproved = existing.trang_thai_duyet === 'da_duyet';
    const isApproved = payload.trang_thai_duyet === 'da_duyet';
    if (isApproved && payload.bat_thuong && (!wasAbnormal || !wasApproved)) {
      await createFuelAlert(connection, metrics);
    }

    await writeAuditLog(connection, req, {
      bang_du_lieu: 'do_nhien_lieu',
      ban_ghi_id: Number(req.params.id),
      hanh_dong: 'cap_nhat',
      du_lieu_cu: existing,
      du_lieu_moi: payload,
    });

    await connection.commit();
    
    res.json({ success: true, message: 'Cập nhật bản ghi nhiên liệu thành công' });
  } catch (error) {
    if (connection) await connection.rollback();

    if (error.status === 400) {
      return res.status(400).json({
        success: false,
        message: error.message,
        details: error.details || [],
      });
    }

    res.status(500).json({ success: false, message: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// DELETE fuel record
router.delete('/:id', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [existingRows] = await connection.query('SELECT * FROM do_nhien_lieu WHERE id = ?', [req.params.id]);

    if (existingRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Không tìm thấy bản ghi nhiên liệu' });
    }

    const existing = existingRows[0];
    const driverId = await getRequesterDriverId(connection, req);

    if (!isManager(req)) {
      if (!driverId || Number(existing.tai_xe_id) !== Number(driverId)) {
        await connection.rollback();
        return res.status(403).json({ success: false, message: 'Ban khong co quyen xoa ban ghi nay.' });
      }
      if (existing.trang_thai_duyet !== 'cho_duyet') {
        await connection.rollback();
        return res.status(400).json({ success: false, message: 'Chi duoc xoa ban ghi dang cho duyet.' });
      }
    }

    const [result] = await connection.query('DELETE FROM do_nhien_lieu WHERE id = ?', [req.params.id]);
    
    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Không tìm thấy bản ghi nhiên liệu' });
    }

    await writeAuditLog(connection, req, {
      bang_du_lieu: 'do_nhien_lieu',
      ban_ghi_id: Number(req.params.id),
      hanh_dong: 'xoa',
      du_lieu_cu: existing,
      du_lieu_moi: null,
    });

    await connection.commit();
    
    res.json({ success: true, message: 'Xóa bản ghi nhiên liệu thành công' });
  } catch (error) {
    if (connection) await connection.rollback();
    res.status(500).json({ success: false, message: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// PATCH approve/reject fuel record (manager only)
router.patch('/:id/approval', async (req, res) => {
  let connection;
  try {
    if (!isManager(req)) {
      return res.status(403).json({ success: false, message: 'Ban khong co quyen duyet nhien lieu.' });
    }

    const reviewStatus = req.body.trang_thai_duyet;
    if (reviewStatus !== 'da_duyet' && reviewStatus !== 'tu_choi') {
      return res.status(400).json({ success: false, message: 'trang_thai_duyet chi nhan da_duyet hoac tu_choi.' });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query('SELECT * FROM do_nhien_lieu WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Khong tim thay ban ghi nhien lieu.' });
    }

    const current = rows[0];
    const merged = {
      ...current,
      ...req.body,
      trang_thai_duyet: reviewStatus,
      ghi_chu: appendApprovalNote(
        current.ghi_chu,
        reviewStatus,
        req.user?.username,
        req.body.ly_do || req.body.ghi_chu
      ),
    };

    const metrics = await validateAndComputeFuelMetrics(connection, merged);
    const payload = metrics.normalized;

    await connection.query(
      `UPDATE do_nhien_lieu
       SET xe_id = ?, tai_xe_id = ?, thoi_gian_do = ?, tram_xang = ?, loai_nhien_lieu = ?, so_lit = ?, gia_moi_lit = ?,
           tong_tien = ?, km_truoc = ?, km_sau = ?, quang_duong = ?, muc_tieu_hao = ?, bat_thuong = ?, ty_le_vuot_dinh_muc = ?, trang_thai_duyet = ?, ghi_chu = ?
       WHERE id = ?`,
      [
        payload.xe_id,
        payload.tai_xe_id,
        payload.thoi_gian_do,
        payload.tram_xang,
        payload.loai_nhien_lieu,
        payload.so_lit,
        payload.gia_moi_lit,
        payload.tong_tien,
        payload.km_truoc,
        payload.km_sau,
        payload.quang_duong,
        payload.muc_tieu_hao,
        payload.bat_thuong,
        payload.ty_le_vuot_dinh_muc,
        payload.trang_thai_duyet,
        payload.ghi_chu,
        req.params.id,
      ]
    );

    if (reviewStatus === 'da_duyet' && payload.bat_thuong && current.trang_thai_duyet !== 'da_duyet') {
      await createFuelAlert(connection, metrics);
    }

    await writeAuditLog(connection, req, {
      bang_du_lieu: 'do_nhien_lieu',
      ban_ghi_id: Number(req.params.id),
      hanh_dong: reviewStatus === 'da_duyet' ? 'duyet' : 'tu_choi',
      du_lieu_cu: current,
      du_lieu_moi: payload,
    });

    await connection.commit();

    res.json({
      success: true,
      message: reviewStatus === 'da_duyet' ? 'Duyet ban ghi nhien lieu thanh cong' : 'Tu choi ban ghi nhien lieu thanh cong',
      data: payload,
    });
  } catch (error) {
    if (connection) await connection.rollback();
    if (error.status === 400) {
      return res.status(400).json({
        success: false,
        message: error.message,
        details: error.details || [],
      });
    }
    res.status(500).json({ success: false, message: error.message });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;
