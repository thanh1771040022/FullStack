const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

const normalizeText = (text) => String(text || '').toLowerCase().trim();

const isManager = (user) => user?.vai_tro === 'quan_ly';

const DRIVER_INTENTS = new Set([
  'driver_today_summary',
  'driver_priority_alerts',
  'driver_fuel_month',
  'driver_pretrip_checklist',
]);

const MANAGER_INTENTS = new Set([
  'fuel_anomalies',
  'fuel_analysis',
  'deadline_alerts',
  'summary',
]);

const parseDateRange = (body) => {
  const to = body.to || new Date().toISOString().slice(0, 10);
  const from = body.from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return { from, to };
};

const toSafeArray = (items) => (Array.isArray(items) ? items : []);

const uniqueNumbers = (items) => [...new Set(toSafeArray(items).map((v) => Number(v)).filter((v) => Number.isFinite(v) && v > 0))];

const buildScopeClause = (scope, alias = '') => {
  if (scope?.isManager) return { clause: '1=1', params: [] };

  const prefix = alias ? `${alias}.` : '';
  const params = [scope.driverId];
  let clause = `(${prefix}tai_xe_id = ?)`;

  if (scope.vehicleIds.length > 0) {
    const placeholders = scope.vehicleIds.map(() => '?').join(',');
    clause = `(${clause} OR ${prefix}xe_id IN (${placeholders}))`;
    params.push(...scope.vehicleIds);
  }

  return { clause, params };
};

const sanitizeClientContext = (raw) => {
  if (!raw || typeof raw !== 'object') return null;

  const vehicle = raw.vehicle && typeof raw.vehicle === 'object' ? raw.vehicle : null;
  const trip = raw.trip && typeof raw.trip === 'object' ? raw.trip : null;
  const metrics = raw.monthMetrics && typeof raw.monthMetrics === 'object' ? raw.monthMetrics : null;
  const alerts = raw.alerts && typeof raw.alerts === 'object' ? raw.alerts : null;

  return {
    vehicle: vehicle ? {
      bien_so: String(vehicle.bien_so || '').slice(0, 30),
      trang_thai: String(vehicle.trang_thai || '').slice(0, 30),
      con_han_dang_kiem: Number(vehicle.con_han_dang_kiem),
      con_han_bao_hiem: Number(vehicle.con_han_bao_hiem),
      con_han_thay_lop: Number(vehicle.con_han_thay_lop),
    } : null,
    trip: trip ? {
      trang_thai: String(trip.trang_thai || '').slice(0, 30),
      diem_di: String(trip.diem_di || '').slice(0, 100),
      diem_den: String(trip.diem_den || '').slice(0, 100),
      khoang_cach: Number(trip.khoang_cach),
    } : null,
    monthMetrics: metrics ? {
      totalKm: Number(metrics.totalKm),
      totalRefuels: Number(metrics.totalRefuels),
      avgConsumption: Number(metrics.avgConsumption),
      avgVariance: Number(metrics.avgVariance),
      status: String(metrics.status || '').slice(0, 30),
    } : null,
    alerts: alerts ? {
      unread: Number(alerts.unread),
      total: Number(alerts.total),
    } : null,
  };
};

const buildDriverActionHints = (intent, clientContext) => {
  if (!clientContext) return [];

  const hints = [];
  const vehicle = clientContext.vehicle;
  const trip = clientContext.trip;
  const alerts = clientContext.alerts;
  const metrics = clientContext.monthMetrics;

  if (intent === 'driver_today_summary') {
    if (trip?.trang_thai === 'dang_di') {
      hints.push('Bạn đang có chuyến ở trạng thái dang_di, ưu tiên cập nhật tiến độ và điểm đến khi hoàn tất.');
    }
    if (alerts && Number.isFinite(alerts.unread) && alerts.unread > 0) {
      hints.push(`Bạn còn ${alerts.unread} cảnh báo chưa đọc, nên xử lý cảnh báo cao trước.`);
    }
  }

  if (intent === 'driver_fuel_month') {
    if (metrics?.status === 'warning' || (Number.isFinite(metrics?.avgVariance) && metrics.avgVariance > 5)) {
      hints.push('Mức tiêu hao đang vượt ngưỡng khuyến nghị, nên kiểm tra tải trọng, lốp và thói quen tăng/giảm ga.');
    }
  }

  if (intent === 'driver_pretrip_checklist' && vehicle) {
    const minDays = Math.min(
      Number.isFinite(vehicle.con_han_dang_kiem) ? vehicle.con_han_dang_kiem : 99999,
      Number.isFinite(vehicle.con_han_bao_hiem) ? vehicle.con_han_bao_hiem : 99999,
      Number.isFinite(vehicle.con_han_thay_lop) ? vehicle.con_han_thay_lop : 99999
    );

    if (minDays <= 0) {
      hints.push('Xe đã có hạng mục quá hạn, cần báo quản lý trước khi nhận chuyến mới.');
    } else if (minDays <= 7) {
      hints.push(`Có hạng mục còn ${minDays} ngày đến hạn, cần kiểm tra kỹ trước khi xuất phát.`);
    }
  }

  if (intent === 'driver_priority_alerts' && vehicle?.trang_thai === 'bao_duong') {
    hints.push('Xe đang ở trạng thái bao_duong, nên tránh nhận chuyến phát sinh cho tới khi xác nhận hoàn tất bảo trì.');
  }

  return hints.slice(0, 3);
};

const mapSeverityScore = (mucDo) => {
  if (mucDo === 'nghiem_trong') return 4;
  if (mucDo === 'cao') return 3;
  if (mucDo === 'trung_binh') return 2;
  return 1;
};

const detectIntent = (question) => {
  const q = normalizeText(question);

  if (
    q.includes('hom nay') ||
    q.includes('hôm nay') ||
    q.includes('tong quan') ||
    q.includes('tổng quan')
  ) {
    return 'driver_today_summary';
  }

  if (
    q.includes('uu tien') ||
    q.includes('ưu tiên') ||
    q.includes('canh bao') ||
    q.includes('cảnh báo') ||
    q.includes('su co') ||
    q.includes('sự cố')
  ) {
    return 'driver_priority_alerts';
  }

  if (
    q.includes('thang nay') ||
    q.includes('tháng này') ||
    q.includes('chi phi nhien lieu') ||
    q.includes('chi phí nhiên liệu')
  ) {
    return 'driver_fuel_month';
  }

  if (
    q.includes('checklist') ||
    q.includes('truoc chuyen') ||
    q.includes('trước chuyến') ||
    q.includes('kiem tra nhanh') ||
    q.includes('kiểm tra nhanh')
  ) {
    return 'driver_pretrip_checklist';
  }

  if (q.includes('bat thuong') || q.includes('bất thường') || q.includes('gian lan') || q.includes('khai khong')) {
    return 'fuel_anomalies';
  }

  if (q.includes('tieu hao') || q.includes('tiêu hao') || q.includes('dinh muc') || q.includes('định mức')) {
    return 'fuel_analysis';
  }

  if (q.includes('dang kiem') || q.includes('đăng kiểm') || q.includes('bao hiem') || q.includes('bảo hiểm') || q.includes('thay lop') || q.includes('lốp') || q.includes('het han') || q.includes('hết hạn')) {
    return 'deadline_alerts';
  }

  return 'summary';
};

const resolveDriverScope = async (connection, req) => {
  if (isManager(req.user)) {
    return { isManager: true, driverId: null, vehicleIds: [] };
  }

  const [users] = await connection.query(
    'SELECT id, tai_xe_id, email, so_dien_thoai FROM nguoi_dung WHERE id = ?',
    [req.user?.id]
  );

  if (users.length === 0) {
    throw new Error('Không tìm thấy hồ sơ người dùng hiện tại.');
  }

  const user = users[0];
  let driverId = Number(user.tai_xe_id);

  const [matchedDrivers] = await connection.query(
    `SELECT id
     FROM tai_xe
     WHERE (email IS NOT NULL AND email <> '' AND email = ?)
        OR (so_dien_thoai IS NOT NULL AND so_dien_thoai <> '' AND so_dien_thoai = ?)
     ORDER BY id ASC
     LIMIT 1`,
    [user.email || '', user.so_dien_thoai || '']
  );

  if (matchedDrivers.length > 0) {
    const matchedDriverId = Number(matchedDrivers[0].id);
    if (!Number.isFinite(driverId) || driverId !== matchedDriverId) {
      await connection.query('UPDATE nguoi_dung SET tai_xe_id = ?, cap_nhat_luc = NOW() WHERE id = ?', [matchedDriverId, user.id]);
      driverId = matchedDriverId;
    }
  }

  if (!Number.isFinite(driverId) || driverId <= 0) {
    throw new Error('Tài khoản chưa liên kết tài xế. Vui lòng liên hệ quản lý để cập nhật hồ sơ.');
  }

  const [vehicleRows] = await connection.query(
    'SELECT id FROM xe WHERE tai_xe_hien_tai = ?',
    [driverId]
  );

  return {
    isManager: false,
    driverId,
    vehicleIds: uniqueNumbers(vehicleRows.map((v) => v.id)),
  };
};

const getFuelAnomalies = async ({ from, to }) => {
  const [rows] = await pool.query(
    `SELECT
      dnl.id,
      x.bien_so,
      dnl.thoi_gian_do,
      dnl.muc_tieu_hao,
      dnl.ty_le_vuot_dinh_muc,
      lx.dinh_muc_nhien_lieu,
      lx.nguong_canh_bao
    FROM do_nhien_lieu dnl
    JOIN xe x ON dnl.xe_id = x.id
    JOIN loai_xe lx ON x.loai_xe_id = lx.id
    WHERE DATE(dnl.thoi_gian_do) BETWEEN ? AND ?
      AND (
        dnl.bat_thuong = 1
        OR dnl.ty_le_vuot_dinh_muc > lx.nguong_canh_bao
      )
    ORDER BY dnl.ty_le_vuot_dinh_muc DESC
    LIMIT 10`,
    [from, to]
  );

  return rows;
};

const getFuelAnalysis = async ({ from, to }) => {
  const [rows] = await pool.query(
    `SELECT
      x.bien_so,
      lx.dinh_muc_nhien_lieu,
      lx.nguong_canh_bao,
      ROUND(SUM(dnl.so_lit), 2) AS tong_lit,
      ROUND(SUM(dnl.quang_duong), 2) AS tong_km,
      ROUND((SUM(dnl.so_lit) / NULLIF(SUM(dnl.quang_duong), 0)) * 100, 2) AS muc_tieu_hao_thuc_te,
      ROUND(
        ((SUM(dnl.so_lit) / NULLIF(SUM(dnl.quang_duong), 0)) * 100 - lx.dinh_muc_nhien_lieu)
        / NULLIF(lx.dinh_muc_nhien_lieu, 0) * 100,
        2
      ) AS ty_le_vuot_dinh_muc
    FROM do_nhien_lieu dnl
    JOIN xe x ON dnl.xe_id = x.id
    JOIN loai_xe lx ON x.loai_xe_id = lx.id
    WHERE DATE(dnl.thoi_gian_do) BETWEEN ? AND ?
    GROUP BY x.id, x.bien_so, lx.dinh_muc_nhien_lieu, lx.nguong_canh_bao
    ORDER BY ty_le_vuot_dinh_muc DESC
    LIMIT 10`,
    [from, to]
  );

  return rows;
};

const getDeadlineAlerts = async (days) => {
  const [rows] = await pool.query(
    `SELECT
      id,
      bien_so,
      han_dang_kiem,
      han_bao_hiem,
      ngay_thay_lop,
      DATEDIFF(han_dang_kiem, CURDATE()) AS con_han_dang_kiem,
      DATEDIFF(han_bao_hiem, CURDATE()) AS con_han_bao_hiem,
      DATEDIFF(ngay_thay_lop, CURDATE()) AS con_han_thay_lop
    FROM xe
    WHERE (
      han_dang_kiem IS NOT NULL AND DATEDIFF(han_dang_kiem, CURDATE()) <= ?
    ) OR (
      han_bao_hiem IS NOT NULL AND DATEDIFF(han_bao_hiem, CURDATE()) <= ?
    ) OR (
      ngay_thay_lop IS NOT NULL AND DATEDIFF(ngay_thay_lop, CURDATE()) <= ?
    )
    ORDER BY LEAST(
      IFNULL(DATEDIFF(han_dang_kiem, CURDATE()), 99999),
      IFNULL(DATEDIFF(han_bao_hiem, CURDATE()), 99999),
      IFNULL(DATEDIFF(ngay_thay_lop, CURDATE()), 99999)
    ) ASC
    LIMIT 20`,
    [days, days, days]
  );

  return rows;
};

const getDriverTodaySummary = async (connection, scope) => {
  const scopeFilterTrip = buildScopeClause(scope, 'cd');
  const scopeFilterFuel = buildScopeClause(scope, 'dnl');
  const scopeFilterAlert = buildScopeClause(scope, 'cb');

  const [tripRows] = await connection.query(
    `SELECT COUNT(*) AS tong_chuyen
     FROM chuyen_di cd
     WHERE ${scopeFilterTrip.clause}
       AND DATE(COALESCE(cd.ngay_chuyen, cd.thoi_gian_xuat_phat)) = CURDATE()`,
    scopeFilterTrip.params
  );

  const [fuelRows] = await connection.query(
    `SELECT
      COUNT(*) AS so_lan_do,
      ROUND(COALESCE(SUM(dnl.so_lit), 0), 2) AS tong_lit,
      ROUND(COALESCE(SUM(dnl.tong_tien), 0), 0) AS tong_chi_phi
     FROM do_nhien_lieu dnl
     WHERE ${scopeFilterFuel.clause}
       AND DATE(dnl.thoi_gian_do) = CURDATE()`,
    scopeFilterFuel.params
  );

  const [alertRows] = await connection.query(
    `SELECT
      COUNT(*) AS tong_canh_bao,
      SUM(CASE WHEN cb.da_doc = 0 THEN 1 ELSE 0 END) AS chua_doc
     FROM canh_bao cb
     WHERE ${scopeFilterAlert.clause}`,
    scopeFilterAlert.params
  );

  return {
    tong_chuyen_hom_nay: Number(tripRows[0]?.tong_chuyen || 0),
    so_lan_do_hom_nay: Number(fuelRows[0]?.so_lan_do || 0),
    tong_lit_hom_nay: Number(fuelRows[0]?.tong_lit || 0),
    tong_chi_phi_hom_nay: Number(fuelRows[0]?.tong_chi_phi || 0),
    canh_bao_tong: Number(alertRows[0]?.tong_canh_bao || 0),
    canh_bao_chua_doc: Number(alertRows[0]?.chua_doc || 0),
  };
};

const getDriverPriorityAlerts = async (connection, scope) => {
  const scopeFilterAlert = buildScopeClause(scope, 'cb');

  const [rows] = await connection.query(
    `SELECT
      cb.id,
      cb.muc_do,
      cb.tieu_de,
      cb.noi_dung,
      cb.da_doc,
      cb.tao_luc,
      x.bien_so
     FROM canh_bao cb
     LEFT JOIN xe x ON cb.xe_id = x.id
     WHERE ${scopeFilterAlert.clause}
     ORDER BY cb.da_doc ASC, cb.tao_luc DESC
     LIMIT 15`,
    scopeFilterAlert.params
  );

  return rows
    .slice()
    .sort((a, b) => {
      const scoreDiff = mapSeverityScore(b.muc_do) - mapSeverityScore(a.muc_do);
      if (scoreDiff !== 0) return scoreDiff;
      return new Date(b.tao_luc || 0) - new Date(a.tao_luc || 0);
    })
    .slice(0, 8);
};

const getDriverFuelMonth = async (connection, scope) => {
  const scopeFilterFuel = buildScopeClause(scope, 'dnl');

  const [summaryRows] = await connection.query(
    `SELECT
      ROUND(COALESCE(SUM(dnl.so_lit), 0), 2) AS tong_lit,
      ROUND(COALESCE(SUM(dnl.tong_tien), 0), 0) AS tong_chi_phi,
      ROUND(COALESCE(SUM(dnl.quang_duong), 0), 2) AS tong_km,
      ROUND(COALESCE(AVG(dnl.muc_tieu_hao), 0), 2) AS tieu_hao_tb,
      ROUND(COALESCE(AVG(dnl.ty_le_vuot_dinh_muc), 0), 2) AS vuot_dinh_muc_tb,
      COUNT(*) AS so_lan_do
     FROM do_nhien_lieu dnl
     WHERE ${scopeFilterFuel.clause}
       AND YEAR(dnl.thoi_gian_do) = YEAR(CURDATE())
       AND MONTH(dnl.thoi_gian_do) = MONTH(CURDATE())`,
    scopeFilterFuel.params
  );

  const [recentRows] = await connection.query(
    `SELECT
      dnl.id,
      dnl.thoi_gian_do,
      dnl.so_lit,
      dnl.tong_tien,
      dnl.quang_duong,
      dnl.muc_tieu_hao,
      dnl.ty_le_vuot_dinh_muc,
      dnl.trang_thai_duyet,
      x.bien_so
     FROM do_nhien_lieu dnl
     LEFT JOIN xe x ON dnl.xe_id = x.id
     WHERE ${scopeFilterFuel.clause}
       AND YEAR(dnl.thoi_gian_do) = YEAR(CURDATE())
       AND MONTH(dnl.thoi_gian_do) = MONTH(CURDATE())
     ORDER BY dnl.thoi_gian_do DESC
     LIMIT 6`,
    scopeFilterFuel.params
  );

  return {
    summary: {
      tong_lit: Number(summaryRows[0]?.tong_lit || 0),
      tong_chi_phi: Number(summaryRows[0]?.tong_chi_phi || 0),
      tong_km: Number(summaryRows[0]?.tong_km || 0),
      tieu_hao_tb: Number(summaryRows[0]?.tieu_hao_tb || 0),
      vuot_dinh_muc_tb: Number(summaryRows[0]?.vuot_dinh_muc_tb || 0),
      so_lan_do: Number(summaryRows[0]?.so_lan_do || 0),
    },
    recent: recentRows,
  };
};

const getDriverPretripChecklist = async (connection, scope) => {
  const items = [
    'Kiểm tra áp suất và tình trạng lốp trước khi xuất phát.',
    'Kiểm tra đèn chiếu sáng, xi nhan, đèn phanh.',
    'Kiểm tra dầu máy và nước làm mát.',
    'Xác nhận giấy tờ xe, đăng kiểm, bảo hiểm còn hiệu lực.',
  ];

  if (scope.vehicleIds.length === 0) {
    return {
      items,
      notes: ['Bạn chưa được gán xe cố định. Hãy xác nhận xe trước khi nhận chuyến.'],
      vehicles: [],
    };
  }

  const placeholders = scope.vehicleIds.map(() => '?').join(',');
  const [vehicleRows] = await connection.query(
    `SELECT
      id,
      bien_so,
      so_km_hien_tai,
      han_dang_kiem,
      han_bao_hiem,
      ngay_thay_lop,
      DATEDIFF(han_dang_kiem, CURDATE()) AS con_han_dang_kiem,
      DATEDIFF(han_bao_hiem, CURDATE()) AS con_han_bao_hiem,
      DATEDIFF(ngay_thay_lop, CURDATE()) AS con_han_thay_lop
     FROM xe
     WHERE id IN (${placeholders})`,
    scope.vehicleIds
  );

  const notes = [];

  vehicleRows.forEach((v) => {
    const minDays = Math.min(
      Number.isFinite(Number(v.con_han_dang_kiem)) ? Number(v.con_han_dang_kiem) : 99999,
      Number.isFinite(Number(v.con_han_bao_hiem)) ? Number(v.con_han_bao_hiem) : 99999,
      Number.isFinite(Number(v.con_han_thay_lop)) ? Number(v.con_han_thay_lop) : 99999
    );

    if (minDays <= 0) {
      notes.push(`Xe ${v.bien_so}: có hạng mục đã quá hạn, cần báo quản lý ngay.`);
    } else if (minDays <= 7) {
      notes.push(`Xe ${v.bien_so}: có hạn mục còn ${minDays} ngày, ưu tiên kiểm tra trước chuyến.`);
    }
  });

  const scopeFilterFuel = buildScopeClause(scope, 'dnl');
  const [latestAnomaly] = await connection.query(
    `SELECT
      dnl.id,
      dnl.thoi_gian_do,
      dnl.muc_tieu_hao,
      dnl.ty_le_vuot_dinh_muc,
      x.bien_so
     FROM do_nhien_lieu dnl
     LEFT JOIN xe x ON dnl.xe_id = x.id
     WHERE ${scopeFilterFuel.clause}
       AND dnl.bat_thuong = 1
     ORDER BY dnl.thoi_gian_do DESC
     LIMIT 1`,
    scopeFilterFuel.params
  );

  if (latestAnomaly.length > 0) {
    notes.push(
      `Lần đổ gần nhất bất thường: xe ${latestAnomaly[0].bien_so || 'N/A'}, vượt ${latestAnomaly[0].ty_le_vuot_dinh_muc || 0}%. Nên kiểm tra rò rỉ và tải trọng.`
    );
  }

  if (notes.length === 0) {
    notes.push('Không có cảnh báo ưu tiên cao tại thời điểm hiện tại. Vẫn cần thực hiện checklist đầy đủ.');
  }

  return {
    items,
    notes,
    vehicles: vehicleRows,
  };
};

const buildDriverText = (intent, payload, clientContext = null) => {
  const hints = buildDriverActionHints(intent, clientContext);

  if (intent === 'driver_today_summary') {
    const base = `Hôm nay bạn có ${payload.tong_chuyen_hom_nay} chuyến, ${payload.so_lan_do_hom_nay} lần đổ nhiên liệu (${payload.tong_lit_hom_nay} L), ${payload.canh_bao_chua_doc} cảnh báo chưa đọc.`;
    if (hints.length === 0) return base;
    return `${base} ${hints.join(' ')}`;
  }

  if (intent === 'driver_priority_alerts') {
    const base = `Đã tổng hợp ${payload.length} cảnh báo ưu tiên cho bạn.`;
    if (hints.length === 0) return base;
    return `${base} ${hints.join(' ')}`;
  }

  if (intent === 'driver_fuel_month') {
    const base = `Tháng này: ${payload.summary.so_lan_do} lần đổ, ${payload.summary.tong_lit} L, chi phí ${payload.summary.tong_chi_phi} VND.`;
    if (hints.length === 0) return base;
    return `${base} ${hints.join(' ')}`;
  }

  if (hints.length === 0) {
    return 'Checklist trước chuyến và các lưu ý ưu tiên đã sẵn sàng.';
  }
  return `Checklist trước chuyến và các lưu ý ưu tiên đã sẵn sàng. ${hints.join(' ')}`;
};

const normalizeIntentForRole = (rawIntent, req) => {
  const normalized = normalizeText(rawIntent);
  if (isManager(req.user)) {
    if (MANAGER_INTENTS.has(normalized)) return normalized;
    return detectIntent(rawIntent);
  }

  if (DRIVER_INTENTS.has(normalized)) return normalized;

  if (normalized === 'fuel_analysis') return 'driver_fuel_month';
  if (normalized === 'fuel_anomalies') return 'driver_priority_alerts';
  if (normalized === 'deadline_alerts') return 'driver_pretrip_checklist';
  if (normalized === 'summary') return 'driver_today_summary';

  const detected = detectIntent(rawIntent);
  if (DRIVER_INTENTS.has(detected)) return detected;

  if (detected === 'fuel_analysis') return 'driver_fuel_month';
  if (detected === 'fuel_anomalies') return 'driver_priority_alerts';
  if (detected === 'deadline_alerts') return 'driver_pretrip_checklist';
  return 'driver_today_summary';
};

router.post('/ask', async (req, res) => {
  try {
    const question = req.body.question || '';
    const intent = normalizeIntentForRole(req.body.intent || question, req);
    const { from, to } = parseDateRange(req.body);
    const clientContext = sanitizeClientContext(req.body.client_context);

    const connection = pool;
    const scope = await resolveDriverScope(connection, req);

    if (!scope.isManager) {
      if (intent === 'driver_today_summary') {
        const summary = await getDriverTodaySummary(connection, scope);
        return res.json({
          success: true,
          data: {
            intent,
            answer: buildDriverText(intent, summary, clientContext),
            summary,
            context_used: Boolean(clientContext),
          },
        });
      }

      if (intent === 'driver_priority_alerts') {
        const items = await getDriverPriorityAlerts(connection, scope);
        return res.json({
          success: true,
          data: {
            intent,
            answer: buildDriverText(intent, items, clientContext),
            items,
            context_used: Boolean(clientContext),
          },
        });
      }

      if (intent === 'driver_fuel_month') {
        const stats = await getDriverFuelMonth(connection, scope);
        return res.json({
          success: true,
          data: {
            intent,
            answer: buildDriverText(intent, stats, clientContext),
            summary: stats.summary,
            items: stats.recent,
            context_used: Boolean(clientContext),
          },
        });
      }

      const checklist = await getDriverPretripChecklist(connection, scope);
      return res.json({
        success: true,
        data: {
          intent: 'driver_pretrip_checklist',
          answer: buildDriverText('driver_pretrip_checklist', checklist, clientContext),
          items: checklist.items,
          notes: checklist.notes,
          vehicles: checklist.vehicles,
          context_used: Boolean(clientContext),
        },
      });
    }

    if (intent === 'fuel_anomalies') {
      const items = await getFuelAnomalies({ from, to });
      return res.json({
        success: true,
        data: {
          intent,
          answer: `Tìm thấy ${items.length} bản ghi nhiên liệu bất thường trong giai đoạn ${from} đến ${to}.`,
          items,
        },
      });
    }

    if (intent === 'fuel_analysis') {
      const items = await getFuelAnalysis({ from, to });
      return res.json({
        success: true,
        data: {
          intent,
          answer: `Đã tổng hợp tiêu hao nhiên liệu theo xe trong giai đoạn ${from} đến ${to}.`,
          items,
        },
      });
    }

    if (intent === 'deadline_alerts') {
      const days = Number.isFinite(Number(req.body.days)) ? Number(req.body.days) : 30;
      const items = await getDeadlineAlerts(days);
      return res.json({
        success: true,
        data: {
          intent,
          answer: `Có ${items.length} xe sắp hết hạn/quá hạn trong ${days} ngày tới.`,
          items,
        },
      });
    }

    const [summary] = await connection.query(
      `SELECT
        (SELECT COUNT(*) FROM xe) AS tong_xe,
        (SELECT COUNT(*) FROM do_nhien_lieu WHERE bat_thuong = 1) AS tong_nhien_lieu_bat_thuong,
        (SELECT COUNT(*) FROM canh_bao WHERE da_doc = 0) AS canh_bao_chua_doc`
    );

    return res.json({
      success: true,
      data: {
        intent,
        answer: 'Tổng quan nhanh: đã lấy số liệu hệ thống hiện tại.',
        summary: summary[0],
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
