const { pool } = require('../config/database');

const DEFAULT_SLA_DAYS = [30, 14, 7, 3, 1];
const DEFAULT_INTERVAL_MINUTES = 30;

const parseSlaDays = () => {
  const raw = process.env.ALERT_SLA_DAYS;
  if (!raw) return DEFAULT_SLA_DAYS;

  const values = raw
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0);

  if (values.length === 0) return DEFAULT_SLA_DAYS;

  return Array.from(new Set(values)).sort((a, b) => b - a);
};

const SLA_DAYS = parseSlaDays();

const getIntervalMs = () => {
  const minutes = Number(process.env.ALERT_CHECK_INTERVAL_MINUTES || DEFAULT_INTERVAL_MINUTES);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return DEFAULT_INTERVAL_MINUTES * 60 * 1000;
  }
  return minutes * 60 * 1000;
};

const formatDateVN = (dateValue) => {
  if (!dateValue) return 'N/A';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString('vi-VN');
};

const toSeverity = (daysLeft) => {
  if (daysLeft < 0) return daysLeft <= -7 ? 'nghiem_trong' : 'cao';
  if (daysLeft <= 1) return 'cao';
  if (daysLeft <= 7) return 'trung_binh';
  return 'thap';
};

const getDeadlineConfigs = (row) => [
  {
    field: 'han_dang_kiem',
    date: row.han_dang_kiem,
    daysLeft: Number(row.ngay_con_lai_dang_kiem),
    warningType: 'sap_het_han_dang_kiem',
    warningLabel: 'Đăng kiểm',
  },
  {
    field: 'han_bao_hiem',
    date: row.han_bao_hiem,
    daysLeft: Number(row.ngay_con_lai_bao_hiem),
    warningType: 'sap_het_han_bao_hiem',
    warningLabel: 'Bảo hiểm',
  },
  {
    field: 'ngay_thay_lop',
    date: row.ngay_thay_lop,
    daysLeft: Number(row.ngay_con_lai_thay_lop),
    warningType: 'den_han_bao_tri',
    warningLabel: 'Thay lốp',
  },
];

const buildAlertPayload = (vehicle, config) => {
  const isOverdue = config.daysLeft < 0;
  const absDays = Math.abs(config.daysLeft);

  const loaiCanhBao = isOverdue ? 'qua_han' : config.warningType;
  const mucDo = toSeverity(config.daysLeft);
  const dueDateText = formatDateVN(config.date);

  const milestone = isOverdue ? `OVERDUE_${absDays}` : `D${config.daysLeft}`;
  const marker = `[AUTO_DEADLINE|${config.field}|${milestone}|${dueDateText}]`;

  const tieuDe = isOverdue
    ? `Quá hạn ${config.warningLabel} - ${vehicle.bien_so}`
    : `Sắp hết hạn ${config.warningLabel} (${config.daysLeft} ngày) - ${vehicle.bien_so}`;

  const noiDung = isOverdue
    ? `${marker} Xe ${vehicle.bien_so} đã quá hạn ${config.warningLabel.toLowerCase()} ${absDays} ngày (hạn ${dueDateText}).`
    : `${marker} Xe ${vehicle.bien_so} còn ${config.daysLeft} ngày đến hạn ${config.warningLabel.toLowerCase()} (hạn ${dueDateText}).`;

  return {
    marker,
    loaiCanhBao,
    mucDo,
    tieuDe,
    noiDung,
  };
};

const shouldCreateAlert = (daysLeft) => {
  if (!Number.isFinite(daysLeft)) return false;
  if (daysLeft < 0) return true;
  return SLA_DAYS.includes(daysLeft);
};

const scanVehicles = async () => {
  const [rows] = await pool.query(
    `SELECT
      x.id,
      x.bien_so,
      x.trang_thai,
      x.han_dang_kiem,
      x.han_bao_hiem,
      x.ngay_thay_lop,
      DATEDIFF(x.han_dang_kiem, CURDATE()) AS ngay_con_lai_dang_kiem,
      DATEDIFF(x.han_bao_hiem, CURDATE()) AS ngay_con_lai_bao_hiem,
      DATEDIFF(x.ngay_thay_lop, CURDATE()) AS ngay_con_lai_thay_lop
    FROM xe x
    WHERE x.trang_thai <> 'thanh_ly'`
  );

  return rows;
};

const alertExistsToday = async (connection, xeId, loaiCanhBao, marker) => {
  const [rows] = await connection.query(
    `SELECT id
     FROM canh_bao
     WHERE xe_id = ?
       AND loai_canh_bao = ?
       AND DATE(tao_luc) = CURDATE()
       AND noi_dung LIKE ?
     LIMIT 1`,
    [xeId, loaiCanhBao, `%${marker}%`]
  );

  return rows.length > 0;
};

const createDeadlineAlerts = async () => {
  const vehicles = await scanVehicles();
  let createdCount = 0;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    for (const vehicle of vehicles) {
      const configs = getDeadlineConfigs(vehicle);

      for (const config of configs) {
        if (!config.date || !shouldCreateAlert(config.daysLeft)) continue;

        const payload = buildAlertPayload(vehicle, config);
        const existed = await alertExistsToday(connection, vehicle.id, payload.loaiCanhBao, payload.marker);
        if (existed) continue;

        await connection.query(
          `INSERT INTO canh_bao (xe_id, loai_canh_bao, muc_do, tieu_de, noi_dung, da_doc, tao_luc)
           VALUES (?, ?, ?, ?, ?, 0, NOW())`,
          [vehicle.id, payload.loaiCanhBao, payload.mucDo, payload.tieuDe, payload.noiDung]
        );
        createdCount += 1;
      }
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return createdCount;
};

let intervalRef = null;
let running = false;

const runDeadlineAlertCycle = async () => {
  if (running) return;
  running = true;

  try {
    const created = await createDeadlineAlerts();
    const now = new Date().toLocaleString('vi-VN');
    console.log(`[DEADLINE_ALERT_JOB] ${now} - Đã tạo ${created} cảnh báo tự động.`);
  } catch (error) {
    console.error('[DEADLINE_ALERT_JOB] Lỗi khi tạo cảnh báo hạn mục tự động:', error.message);
  } finally {
    running = false;
  }
};

const startDeadlineAlertJob = () => {
  const enabled = String(process.env.ENABLE_DEADLINE_ALERT_JOB || 'true').toLowerCase() !== 'false';
  if (!enabled) {
    console.log('[DEADLINE_ALERT_JOB] Đã tắt bởi cấu hình ENABLE_DEADLINE_ALERT_JOB=false');
    return;
  }

  if (intervalRef) return;

  const intervalMs = getIntervalMs();
  console.log(
    `[DEADLINE_ALERT_JOB] Khởi động scheduler, chu kỳ ${Math.round(intervalMs / 60000)} phút, SLA: ${SLA_DAYS.join('/')}/quá hạn.`
  );

  runDeadlineAlertCycle();
  intervalRef = setInterval(runDeadlineAlertCycle, intervalMs);
};

const stopDeadlineAlertJob = () => {
  if (intervalRef) {
    clearInterval(intervalRef);
    intervalRef = null;
  }
};

module.exports = {
  startDeadlineAlertJob,
  stopDeadlineAlertJob,
  runDeadlineAlertCycle,
};
