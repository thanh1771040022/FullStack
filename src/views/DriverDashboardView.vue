<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { authService } from '@/services/authService'
import { alertService, fuelService, maintenanceService, tripService, vehicleService, driverService } from '@/services'
import { aiAgentService } from '@/services/aiAgentService'

const router = useRouter()
const user = ref(authService.getUser())
const loading = ref(true)
const driverInfo = ref(null)
const assignedVehicle = ref(null)
const recentTrips = ref([])
const fuelRecords = ref([])
const maintenanceRecords = ref([])
const personalAlerts = ref([])

const fuelForm = ref({
  tram_xang: '',
  so_lit: '',
  gia_moi_lit: '',
  km_sau: '',
  ghi_chu: '',
})

const issueForm = ref({
  tieu_de: '',
  noi_dung: '',
  muc_do: 'trung_binh',
})

const preTripChecks = ref({
  lop: false,
  den: false,
  phanh: false,
  dau: false,
})

const savingFuel = ref(false)
const savingIssue = ref(false)
const savingChecklist = ref(false)

const chatOpen = ref(false)
const chatLoading = ref(false)
const chatInput = ref('')
const chatBodyRef = ref(null)
const chatMessages = ref([
  {
    id: 1,
    role: 'agent',
    text: 'Fleet AI Driver sẵn sàng. Bạn có thể dùng quick action để xem tổng quan hôm nay, cảnh báo ưu tiên, nhiên liệu tháng này hoặc checklist trước chuyến.',
    createdAt: new Date().toISOString(),
  },
])

const driverQuickActions = [
  { label: 'Tổng quan hôm nay', intent: 'driver_today_summary', question: 'Tổng quan hôm nay của tôi' },
  { label: 'Cảnh báo ưu tiên', intent: 'driver_priority_alerts', question: 'Các cảnh báo ưu tiên cần xử lý' },
  { label: 'Nhiên liệu tháng này', intent: 'driver_fuel_month', question: 'Tình hình nhiên liệu tháng này' },
  { label: 'Checklist trước chuyến', intent: 'driver_pretrip_checklist', question: 'Checklist trước chuyến cho tôi' },
]

const driverId = ref(null)

// Fetch driver data
const fetchDriverData = async () => {
  loading.value = true
  try {
    let currentDriverId = user.value?.tai_xe_id || driverId.value
    
    // Nếu chưa có tai_xe_id, thử tìm tài xế theo email hoặc số điện thoại
    if (!currentDriverId) {
      try {
        const driversRes = await driverService.getAll()
        const drivers = driversRes.data || []

        // Tìm tài xế có email hoặc sdt trùng với user (tránh map theo họ tên vì dễ trùng)
        const matchedDriver = drivers.find(d =>
          (user.value?.email && d.email === user.value.email) ||
          (user.value?.so_dien_thoai && d.so_dien_thoai === user.value.so_dien_thoai)
        )

        if (matchedDriver) {
          currentDriverId = matchedDriver.id
          driverInfo.value = matchedDriver
        }
      } catch (error) {
        console.warn('Không thể tải danh sách tài xế để mapping:', error?.response?.data?.message || error?.message)
      }
    }
    
    // Nếu có driverId, lấy thêm thông tin
    if (currentDriverId) {
      driverId.value = currentDriverId

      // Nếu chưa có driverInfo, lấy từ API
      if (!driverInfo.value) {
        try {
          const driverRes = await driverService.getById(currentDriverId)
          driverInfo.value = driverRes.data
        } catch (error) {
          console.warn('Không thể tải hồ sơ tài xế:', error?.response?.data?.message || error?.message)
        }
      }
      
      // Lấy dữ liệu thật từ DB
      const [vehicleRes, tripsRes, fuelRes, alertRes] = await Promise.all([
        vehicleService.getAllWithDetails(),
        tripService.getByDriverId(currentDriverId),
        fuelService.getAll(),
        alertService.getAll(),
      ])
      
      // Lọc xe theo tài xế
      const allVehicles = vehicleRes.data || []
      assignedVehicle.value = allVehicles.find(v => Number(v.tai_xe_hien_tai) === Number(currentDriverId)) || null
      
      // Lấy chuyến đi theo tài xế, fallback thêm chuyến đi theo xe đang gán
      const allTrips = tripsRes.data || []
      let mergedTrips = allTrips
        .filter((t) => Number(t.tai_xe_id) === Number(currentDriverId))

      if (assignedVehicle.value?.id) {
        const vehicleTripsRes = await tripService.getByVehicleId(assignedVehicle.value.id)
        const vehicleTrips = vehicleTripsRes.data || []
        mergedTrips = [...mergedTrips, ...vehicleTrips.filter((t) => !mergedTrips.some((d) => Number(d.id) === Number(t.id)))]
      }

      recentTrips.value = mergedTrips
        .sort((a, b) => new Date(b.ngay_chuyen || b.thoi_gian_xuat_phat || 0) - new Date(a.ngay_chuyen || a.thoi_gian_xuat_phat || 0))
        .slice(0, 5)
      
      // Lọc nhiên liệu theo tài xế, fallback theo xe đang gán
      const allFuel = fuelRes.data || []
      fuelRecords.value = allFuel
        .filter(
          (f) =>
            Number(f.tai_xe_id) === Number(currentDriverId) ||
            (assignedVehicle.value && Number(f.xe_id) === Number(assignedVehicle.value.id))
        )
        .sort((a, b) => new Date(b.thoi_gian_do || 0) - new Date(a.thoi_gian_do || 0))

      const allAlerts = alertRes.data || []
      personalAlerts.value = allAlerts
        .filter((a) => Number(a.tai_xe_id) === Number(currentDriverId) || (assignedVehicle.value && Number(a.xe_id) === Number(assignedVehicle.value.id)))
        .sort((a, b) => new Date(b.tao_luc || 0) - new Date(a.tao_luc || 0))
        .slice(0, 5)

      if (assignedVehicle.value?.id) {
        const maintenanceRes = await maintenanceService.getByVehicleId(assignedVehicle.value.id)
        maintenanceRecords.value = (maintenanceRes.data || [])
          .sort((a, b) => new Date(b.ngay_du_kien || b.tao_luc || 0) - new Date(a.ngay_du_kien || a.tao_luc || 0))
          .slice(0, 5)
      } else {
        maintenanceRecords.value = []
      }

      fuelForm.value.km_sau = ''
      fuelForm.value.so_lit = ''
      fuelForm.value.gia_moi_lit = ''
      fuelForm.value.tram_xang = ''
      fuelForm.value.ghi_chu = ''
    }
  } catch (err) {
    console.error('Error fetching driver data:', err)
  } finally {
    loading.value = false
  }
}

const monthKey = (dateValue) => {
  const d = new Date(dateValue)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const currentMonthKey = computed(() => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
})

const monthFuelRecords = computed(() => {
  return fuelRecords.value.filter((f) => monthKey(f.thoi_gian_do) === currentMonthKey.value)
})

const monthMetrics = computed(() => {
  const records = monthFuelRecords.value
  if (records.length === 0) {
    return {
      totalKm: 0,
      totalRefuels: 0,
      avgConsumption: 0,
      avgVariance: 0,
      status: 'normal',
    }
  }

  const totalKm = records.reduce((sum, r) => sum + Number(r.quang_duong || 0), 0)
  const totalLit = records.reduce((sum, r) => sum + Number(r.so_lit || 0), 0)
  const totalRefuels = records.length
  const avgConsumption = totalKm > 0 ? (totalLit / totalKm) * 100 : 0
  const avgVariance = records.reduce((sum, r) => sum + Number(r.ty_le_vuot_dinh_muc || 0), 0) / totalRefuels

  return {
    totalKm,
    totalRefuels,
    avgConsumption,
    avgVariance,
    status: avgVariance > 5 ? 'warning' : 'normal',
  }
})

const activeTrip = computed(() => {
  const inProgress = recentTrips.value.find((t) => String(t.trang_thai || '').toLowerCase() === 'dang_di')
  if (inProgress) return inProgress
  return recentTrips.value[0] || null
})

const unreadAlerts = computed(() => personalAlerts.value.filter((a) => !a.da_doc))

const recentActivities = computed(() => {
  const fuelItems = fuelRecords.value.slice(0, 5).map((f) => ({
    id: `fuel-${f.id}`,
    type: 'fuel',
    title: `Đổ nhiên liệu ${Number(f.so_lit || 0).toFixed(1)} L`,
    meta: `${formatNumber(f.quang_duong || 0)} km - ${formatCurrency(f.tong_tien || 0)}`,
    date: f.thoi_gian_do,
    status: f.bat_thuong ? 'warning' : 'ok',
  }))

  const tripItems = recentTrips.value.slice(0, 5).map((t) => ({
    id: `trip-${t.id}`,
    type: 'trip',
    title: `${t.diem_di || 'N/A'} -> ${t.diem_den || 'N/A'}`,
    meta: `${formatNumber(t.khoang_cach_thuc_te || 0)} km`,
    date: t.ngay_chuyen || t.thoi_gian_xuat_phat,
    status: t.trang_thai === 'hoan_thanh' ? 'ok' : 'progress',
  }))

  const maintenanceItems = maintenanceRecords.value.slice(0, 5).map((m) => ({
    id: `maintenance-${m.id}`,
    type: 'maintenance',
    title: `Bảo trì: ${m.loai_bao_tri_ten || 'Bảo trì'}`,
    meta: `${formatCurrency(m.tong_chi_phi || 0)}`,
    date: m.ngay_du_kien || m.tao_luc,
    status: m.trang_thai === 'qua_han' ? 'warning' : 'ok',
  }))

  return [...fuelItems, ...tripItems, ...maintenanceItems]
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
    .slice(0, 8)
})

const checklistSavedToday = computed(() => {
  const today = new Date().toISOString().slice(0, 10)
  return personalAlerts.value.some((a) =>
    a.loai_canh_bao === 'he_thong' &&
    typeof a.tieu_de === 'string' &&
    (a.tieu_de.includes(`Kiểm tra trước chuyến ${today}`) || a.tieu_de.includes(`Kiem tra truoc chuyen ${today}`))
  )
})

const toMySqlDateTimeNow = () => {
  const date = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

const toSafeNumber = (value) => {
  if (value === null || value === undefined) return NaN
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN

  const raw = String(value).trim().replace(/\s+/g, '')
  if (!raw) return NaN

  let normalized = raw

  // 165.800,00 -> 165800.00
  if (/^-?\d{1,3}(\.\d{3})+,\d+$/.test(normalized)) {
    normalized = normalized.replace(/\./g, '').replace(',', '.')
  // 165,800.00 -> 165800.00
  } else if (/^-?\d{1,3}(,\d{3})+\.\d+$/.test(normalized)) {
    normalized = normalized.replace(/,/g, '')
  // 165800,00 -> 165800.00
  } else if (normalized.includes(',') && !normalized.includes('.')) {
    normalized = normalized.replace(',', '.')
  }

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : NaN
}

const submitFuelRecord = async () => {
  if (!assignedVehicle.value || !driverId.value) {
    alert('Bạn chưa được gán xe hoặc tài khoản tài xế không hợp lệ.')
    return
  }

  const soLit = toSafeNumber(fuelForm.value.so_lit)
  const giaMoiLit = toSafeNumber(fuelForm.value.gia_moi_lit)
  const kmTruoc = toSafeNumber(assignedVehicle.value.so_km_hien_tai || 0)
  const kmSau = toSafeNumber(fuelForm.value.km_sau)

  const validationErrors = []
  if (!Number.isFinite(soLit) || soLit <= 0) {
    validationErrors.push('Số lít phải lớn hơn 0.')
  }
  if (!Number.isFinite(giaMoiLit) || giaMoiLit <= 0) {
    validationErrors.push('Giá mỗi lít phải lớn hơn 0.')
  }
  if (!Number.isFinite(kmTruoc)) {
    validationErrors.push('KM trước không hợp lệ, vui lòng kiểm tra xe được gán.')
  }
  if (!Number.isFinite(kmSau)) {
    validationErrors.push('KM sau không hợp lệ.')
  }
  if (Number.isFinite(kmTruoc) && Number.isFinite(kmSau) && kmSau <= kmTruoc) {
    validationErrors.push('KM sau phải lớn hơn KM trước.')
  }

  if (validationErrors.length > 0) {
    alert(`Dữ liệu không hợp lệ:\n- ${validationErrors.join('\n- ')}`)
    return
  }

  savingFuel.value = true
  try {
    await fuelService.create({
      xe_id: assignedVehicle.value.id,
      tai_xe_id: driverId.value,
      thoi_gian_do: toMySqlDateTimeNow(),
      tram_xang: fuelForm.value.tram_xang || null,
      loai_nhien_lieu: 'dau_diesel',
      so_lit: soLit,
      gia_moi_lit: giaMoiLit,
      km_truoc: kmTruoc,
      km_sau: kmSau,
      ghi_chu: fuelForm.value.ghi_chu || null,
    })

    alert('Đã ghi nhận đổ nhiên liệu thành công.')
    await fetchDriverData()
  } catch (err) {
    const baseMessage = err?.response?.data?.message || err?.message || 'Không thể ghi nhận đổ nhiên liệu.'
    const details = err?.response?.data?.details
    if (Array.isArray(details) && details.length > 0) {
      alert(`${baseMessage}\n- ${details.join('\n- ')}`)
    } else {
      alert(baseMessage)
    }
  } finally {
    savingFuel.value = false
  }
}

const submitIssueReport = async () => {
  if (!assignedVehicle.value || !driverId.value) {
    alert('Bạn chưa được gán xe hoặc tài khoản tài xế không hợp lệ.')
    return
  }

  if (!issueForm.value.tieu_de.trim() || !issueForm.value.noi_dung.trim()) {
    alert('Vui lòng nhập tiêu đề và nội dung sự cố.')
    return
  }

  savingIssue.value = true
  try {
    await alertService.create({
      xe_id: assignedVehicle.value.id,
      tai_xe_id: driverId.value,
      loai_canh_bao: 'he_thong',
      muc_do: issueForm.value.muc_do,
      tieu_de: issueForm.value.tieu_de.trim(),
      noi_dung: issueForm.value.noi_dung.trim(),
      da_doc: 0,
    })

    issueForm.value.tieu_de = ''
    issueForm.value.noi_dung = ''
    issueForm.value.muc_do = 'trung_binh'

    alert('Đã gửi báo cáo sự cố thành công.')
    await fetchDriverData()
  } catch (err) {
    const message = err?.response?.data?.message || err?.message || 'Không thể gửi báo cáo sự cố.'
    alert(message)
  } finally {
    savingIssue.value = false
  }
}

const savePreTripChecklist = async () => {
  if (!assignedVehicle.value || !driverId.value) {
    alert('Bạn chưa được gán xe hoặc tài khoản tài xế không hợp lệ.')
    return
  }

  savingChecklist.value = true
  try {
    const today = new Date().toISOString().slice(0, 10)
    const checkedItems = Object.entries(preTripChecks.value)
      .filter(([, checked]) => checked)
      .map(([key]) => key)

    await alertService.create({
      xe_id: assignedVehicle.value.id,
      tai_xe_id: driverId.value,
      loai_canh_bao: 'he_thong',
      muc_do: 'thap',
      tieu_de: `Kiểm tra trước chuyến ${today}`,
      noi_dung: `Đã kiểm tra: ${checkedItems.join(', ') || 'không có mục nào được tick'}`,
      da_doc: 0,
    })

    alert('Đã lưu checklist trước chuyến vào hệ thống.')
    await fetchDriverData()
  } catch (err) {
    const message = err?.response?.data?.message || err?.message || 'Không thể lưu checklist.'
    alert(message)
  } finally {
    savingChecklist.value = false
  }
}

const handleLogout = () => {
  authService.logout()
  router.push('/login')
}

const formatDate = (date) => {
  if (!date) return 'N/A'
  return new Date(date).toLocaleDateString('vi-VN')
}

const formatNumber = (num) => {
  if (num === null || num === undefined) return '0'
  return new Intl.NumberFormat('vi-VN').format(num)
}

const formatCurrency = (value) => {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

const getAlertSeverityClass = (level) => {
  if (level === 'nghiem_trong') return 'severity-critical'
  if (level === 'cao') return 'severity-high'
  if (level === 'trung_binh') return 'severity-medium'
  return 'severity-low'
}

const getActivityIcon = (type) => {
  if (type === 'fuel') return 'mdi:gas-station'
  if (type === 'trip') return 'mdi:map-marker-path'
  return 'mdi:wrench'
}

const getActivityClass = (status) => {
  if (status === 'warning') return 'activity-warning'
  if (status === 'progress') return 'activity-progress'
  return 'activity-ok'
}

const formatDateTime = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  })
}

const safeDaysLeft = (value) => {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  const today = new Date()
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const startTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diff = Math.floor((startTarget.getTime() - startToday.getTime()) / (24 * 60 * 60 * 1000))
  return Number.isFinite(diff) ? diff : null
}

const buildDriverContext = () => {
  const vehicle = assignedVehicle.value
  const trip = activeTrip.value

  return {
    vehicle: vehicle
      ? {
          bien_so: vehicle.bien_so,
          trang_thai: vehicle.trang_thai,
          con_han_dang_kiem: safeDaysLeft(vehicle.han_dang_kiem),
          con_han_bao_hiem: safeDaysLeft(vehicle.han_bao_hiem),
          con_han_thay_lop: safeDaysLeft(vehicle.ngay_thay_lop),
        }
      : null,
    trip: trip
      ? {
          trang_thai: trip.trang_thai,
          diem_di: trip.diem_di,
          diem_den: trip.diem_den,
          khoang_cach: Number(trip.khoang_cach_thuc_te || 0),
        }
      : null,
    monthMetrics: {
      totalKm: Number(monthMetrics.value.totalKm || 0),
      totalRefuels: Number(monthMetrics.value.totalRefuels || 0),
      avgConsumption: Number(monthMetrics.value.avgConsumption || 0),
      avgVariance: Number(monthMetrics.value.avgVariance || 0),
      status: monthMetrics.value.status,
    },
    alerts: {
      unread: Number(unreadAlerts.value.length || 0),
      total: Number(personalAlerts.value.length || 0),
    },
  }
}

const buildDriverPromptTemplate = (question, intent, context) => {
  const lines = []

  lines.push(`YEU_CAU: ${question}`)
  lines.push(`INTENT_UU_TIEN: ${intent || 'auto'}`)

  if (context.vehicle) {
    lines.push(
      `XE_HIEN_TAI: bien_so=${context.vehicle.bien_so || 'N/A'}; trang_thai=${context.vehicle.trang_thai || 'N/A'}; ` +
      `dang_kiem=${context.vehicle.con_han_dang_kiem ?? 'N/A'}; bao_hiem=${context.vehicle.con_han_bao_hiem ?? 'N/A'}; thay_lop=${context.vehicle.con_han_thay_lop ?? 'N/A'}`
    )
  } else {
    lines.push('XE_HIEN_TAI: chua_duoc_gan')
  }

  if (context.trip) {
    lines.push(
      `CHUYEN_GAN_NHAT: trang_thai=${context.trip.trang_thai || 'N/A'}; tuyen=${context.trip.diem_di || 'N/A'}->${context.trip.diem_den || 'N/A'}; km=${context.trip.khoang_cach || 0}`
    )
  } else {
    lines.push('CHUYEN_GAN_NHAT: khong_co_du_lieu')
  }

  lines.push(
    `NHIEU_LIEU_THANG: km=${context.monthMetrics.totalKm}; lan_do=${context.monthMetrics.totalRefuels}; ` +
    `tieu_hao_tb=${context.monthMetrics.avgConsumption.toFixed(2)}; vuot_tb=${context.monthMetrics.avgVariance.toFixed(2)}; status=${context.monthMetrics.status}`
  )
  lines.push(`CANH_BAO: unread=${context.alerts.unread}; total=${context.alerts.total}`)

  return lines.join('\n')
}

const buildDriverAgentText = (payload) => {
  if (!payload) return 'Không nhận được dữ liệu từ Fleet AI Driver.'

  const base = payload.answer || 'Đã xử lý yêu cầu.'
  const intent = payload.intent

  if (intent === 'driver_today_summary') {
    const s = payload.summary || {}
    return `${base}\n\n- Chuyến hôm nay: ${s.tong_chuyen_hom_nay || 0}\n- Đổ nhiên liệu: ${s.so_lan_do_hom_nay || 0} lần (${s.tong_lit_hom_nay || 0} L)\n- Cảnh báo chưa đọc: ${s.canh_bao_chua_doc || 0}`
  }

  if (intent === 'driver_priority_alerts') {
    const items = Array.isArray(payload.items) ? payload.items : []
    if (items.length === 0) return `${base}\n\nKhông có cảnh báo ưu tiên mới.`
    const lines = items.slice(0, 6).map((item, index) => `${index + 1}. [${item.muc_do || 'thap'}] ${item.tieu_de || 'Canh bao'} (${item.bien_so || 'N/A'})`)
    return `${base}\n\n${lines.join('\n')}`
  }

  if (intent === 'driver_fuel_month') {
    const s = payload.summary || {}
    const items = Array.isArray(payload.items) ? payload.items : []
    const head = [
      `- Tổng lần đổ: ${s.so_lan_do || 0}`,
      `- Tổng lít: ${s.tong_lit || 0} L`,
      `- Tổng chi phí: ${formatCurrency(s.tong_chi_phi || 0)}`,
      `- Tiêu hao TB: ${s.tieu_hao_tb || 0} L/100km`,
    ].join('\n')

    if (items.length === 0) return `${base}\n\n${head}`
    const lines = items.slice(0, 4).map((item, idx) => `${idx + 1}. ${formatDate(item.thoi_gian_do)} - ${item.bien_so || 'N/A'} - ${Number(item.so_lit || 0).toFixed(1)} L`)
    return `${base}\n\n${head}\n\nGần nhất:\n${lines.join('\n')}`
  }

  const notes = Array.isArray(payload.notes) ? payload.notes : []
  const items = Array.isArray(payload.items) ? payload.items : []
  const checklist = items.map((line, idx) => `${idx + 1}. ${line}`).join('\n')
  const hint = notes.length > 0 ? `\n\nLưu ý:\n${notes.slice(0, 4).map((line) => `- ${line}`).join('\n')}` : ''
  return `${base}\n\nChecklist:\n${checklist || '- Chua co du lieu'}${hint}`
}

const scrollChatToBottom = async (smooth = true) => {
  await nextTick()
  if (!chatBodyRef.value) return
  chatBodyRef.value.scrollTo({
    top: chatBodyRef.value.scrollHeight,
    behavior: smooth ? 'smooth' : 'auto',
  })
}

const askDriverAgent = async (questionText, forcedIntent = null) => {
  const question = (questionText || chatInput.value).trim()
  if (!question || chatLoading.value) return

  const clientContext = buildDriverContext()
  const templatedQuestion = buildDriverPromptTemplate(question, forcedIntent, clientContext)

  chatMessages.value.push({
    id: Date.now(),
    role: 'user',
    text: question,
    createdAt: new Date().toISOString(),
  })

  chatInput.value = ''
  chatLoading.value = true

  const toDate = new Date()
  const fromDate = new Date()
  fromDate.setDate(toDate.getDate() - 30)

  try {
    const response = await aiAgentService.ask({
      question: templatedQuestion,
      intent: forcedIntent,
      user_question: question,
      client_context: clientContext,
      from: fromDate.toISOString().slice(0, 10),
      to: toDate.toISOString().slice(0, 10),
      days: 30,
    })

    chatMessages.value.push({
      id: Date.now() + 1,
      role: 'agent',
      text: buildDriverAgentText(response?.data),
      createdAt: new Date().toISOString(),
    })
  } catch (err) {
    const message = err?.response?.data?.message || err?.message || 'Lỗi không xác định'
    chatMessages.value.push({
      id: Date.now() + 1,
      role: 'agent',
      text: `Không thể lấy dữ liệu từ Fleet AI Driver: ${message}`,
      createdAt: new Date().toISOString(),
    })
  } finally {
    chatLoading.value = false
  }
}

watch(chatOpen, (isOpen) => {
  if (isOpen) {
    scrollChatToBottom(false)
  }
})

watch(
  () => chatMessages.value.length,
  () => {
    scrollChatToBottom(true)
  }
)

watch(chatLoading, () => {
  scrollChatToBottom(true)
})

onMounted(() => {
  fetchDriverData()
})
</script>

<template>
  <div class="driver-dashboard">
    <!-- Header -->
    <header class="dashboard-header">
      <div class="header-left">
        <div class="logo">
          <Icon icon="mdi:truck-fast" class="logo-icon" />
          <span>Fleet Management</span>
        </div>
      </div>
      <div class="header-right">
        <div class="user-info">
          <Icon icon="mdi:account-circle" class="user-icon" />
          <div class="user-details">
            <span class="user-name">{{ user?.ho_ten }}</span>
            <span class="user-role">Tài xế</span>
          </div>
        </div>
        <button class="btn-logout" @click="handleLogout">
          <Icon icon="mdi:logout" />
          <span>Đăng xuất</span>
        </button>
      </div>
    </header>

    <!-- Main Content -->
    <main class="dashboard-main">
      <div v-if="loading" class="loading-state">
        <Icon icon="mdi:loading" class="spin" />
        <span>Đang tải dữ liệu...</span>
      </div>

      <template v-else>
        <!-- Welcome Section -->
        <div class="welcome-section">
          <h1>Xin chào, {{ user?.ho_ten }}!</h1>
          <p>Chúc bạn một ngày làm việc hiệu quả</p>
        </div>

        <div class="quick-actions-grid">
          <div class="content-card quick-card">
            <div class="card-header">
              <Icon icon="mdi:gas-station" />
              <h2>Ghi nhận đổ nhiên liệu</h2>
            </div>
            <div class="card-body action-form">
              <div class="form-row">
                <label>Trạm xăng</label>
                <input v-model="fuelForm.tram_xang" type="text" placeholder="VD: Petrolimex Q9" />
              </div>
              <div class="form-row two-col">
                <div>
                  <label>Số lít</label>
                  <input v-model="fuelForm.so_lit" type="number" min="0" step="0.01" placeholder="0" />
                </div>
                <div>
                  <label>Giá mỗi lít</label>
                  <input v-model="fuelForm.gia_moi_lit" type="number" min="0" step="100" placeholder="0" />
                </div>
              </div>
              <div class="form-row two-col">
                <div>
                  <label>KM trước</label>
                  <input :value="assignedVehicle ? assignedVehicle.so_km_hien_tai : ''" type="number" disabled />
                </div>
                <div>
                  <label>KM sau</label>
                  <input v-model="fuelForm.km_sau" type="number" min="0" step="1" placeholder="0" />
                </div>
              </div>
              <div class="form-row">
                <label>Ghi chú</label>
                <input v-model="fuelForm.ghi_chu" type="text" placeholder="Ghi chú thêm (nếu có)" />
              </div>
              <button class="btn-primary-action" :disabled="savingFuel" @click="submitFuelRecord">
                <Icon icon="mdi:content-save" />
                {{ savingFuel ? 'Đang lưu...' : 'Ghi nhận đổ nhiên liệu' }}
              </button>
            </div>
          </div>

          <div class="content-card quick-card">
            <div class="card-header">
              <Icon icon="mdi:alert-octagon" />
              <h2>Báo sự cố xe</h2>
            </div>
            <div class="card-body action-form">
              <div class="form-row">
                <label>Tiêu đề sự cố</label>
                <input v-model="issueForm.tieu_de" type="text" placeholder="VD: Xe hao nhiên liệu bất thường" />
              </div>
              <div class="form-row">
                <label>Mức độ</label>
                <select v-model="issueForm.muc_do">
                  <option value="thap">Thấp</option>
                  <option value="trung_binh">Trung bình</option>
                  <option value="cao">Cao</option>
                  <option value="nghiem_trong">Nghiêm trọng</option>
                </select>
              </div>
              <div class="form-row">
                <label>Nội dung</label>
                <textarea v-model="issueForm.noi_dung" rows="4" placeholder="Mô tả tình trạng sự cố..."></textarea>
              </div>
              <button class="btn-danger-action" :disabled="savingIssue" @click="submitIssueReport">
                <Icon icon="mdi:send" />
                {{ savingIssue ? 'Đang gửi...' : 'Báo sự cố xe' }}
              </button>
            </div>
          </div>
        </div>

        <div class="stats-grid month-kpi-grid">
          <div class="stat-card">
            <div class="stat-icon trips-icon">
              <Icon icon="mdi:road-variant" />
            </div>
            <div class="stat-content">
              <h3>Tổng KM tháng này</h3>
              <p class="stat-value">{{ formatNumber(monthMetrics.totalKm) }}</p>
              <p class="stat-sub">km</p>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon info-icon">
              <Icon icon="mdi:counter" />
            </div>
            <div class="stat-content">
              <h3>Số lần đổ nhiên liệu</h3>
              <p class="stat-value">{{ monthMetrics.totalRefuels }}</p>
              <p class="stat-sub">Trong tháng hiện tại</p>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon status-icon">
              <Icon icon="mdi:gauge" />
            </div>
            <div class="stat-content">
              <h3>Tiêu hao TB tháng</h3>
              <p class="stat-value">{{ monthMetrics.avgConsumption.toFixed(2) }} L/100km</p>
              <p class="stat-sub">Dữ liệu thực tế DB</p>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon vehicle-icon">
              <Icon icon="mdi:chart-line" />
            </div>
            <div class="stat-content">
              <h3>So với định mức</h3>
              <p class="stat-value" :class="monthMetrics.status === 'warning' ? 'bao_duong' : 'hoat_dong'">
                {{ monthMetrics.status === 'warning' ? 'Cảnh báo' : 'Bình thường' }}
              </p>
              <p class="stat-sub">Tỷ lệ vượt TB: {{ monthMetrics.avgVariance.toFixed(2) }}%</p>
            </div>
          </div>
        </div>

        <!-- Stats Cards -->
        <div class="stats-grid">
          <!-- Xe được gán -->
          <div class="stat-card vehicle-card">
            <div class="stat-icon">
              <Icon icon="mdi:truck" />
            </div>
            <div class="stat-content">
              <h3>Xe được gán</h3>
              <p class="stat-value" v-if="assignedVehicle">
                {{ assignedVehicle.bien_so }}
              </p>
              <p class="stat-value empty" v-else>Chưa được gán xe</p>
              <p class="stat-sub" v-if="assignedVehicle">
                {{ assignedVehicle.hang_xe }} {{ assignedVehicle.dong_xe }}
              </p>
            </div>
          </div>

          <!-- Trạng thái xe -->
          <div class="stat-card status-card">
            <div class="stat-icon">
              <Icon icon="mdi:car-info" />
            </div>
            <div class="stat-content">
              <h3>Trạng thái xe</h3>
              <p class="stat-value" :class="assignedVehicle?.trang_thai">
                {{ assignedVehicle?.trang_thai === 'hoat_dong' ? 'Hoạt động' : 
                   assignedVehicle?.trang_thai === 'bao_duong' ? 'Bảo dưỡng' : 'Không hoạt động' }}
              </p>
              <p class="stat-sub" v-if="assignedVehicle">
                KM: {{ formatNumber(assignedVehicle.so_km_hien_tai) }}
              </p>
            </div>
          </div>

          <!-- Thông tin cá nhân -->
          <div class="stat-card info-card">
            <div class="stat-icon">
              <Icon icon="mdi:card-account-details" />
            </div>
            <div class="stat-content">
              <h3>Bằng lái</h3>
              <p class="stat-value" v-if="driverInfo">
                {{ driverInfo.hang_bang_lai || 'N/A' }}
              </p>
              <p class="stat-sub" v-if="driverInfo">
                Hết hạn: {{ formatDate(driverInfo.han_bang_lai) }}
              </p>
            </div>
          </div>

          <!-- Số chuyến -->
          <div class="stat-card trips-card">
            <div class="stat-icon">
              <Icon icon="mdi:map-marker-path" />
            </div>
            <div class="stat-content">
              <h3>Chuyến đi gần đây</h3>
              <p class="stat-value">{{ recentTrips.length }}</p>
              <p class="stat-sub">Trong tháng này</p>
            </div>
          </div>
        </div>

        <!-- Main Grid -->
        <div class="content-grid">
          <!-- Thông tin cá nhân -->
          <div class="content-card profile-card">
            <div class="card-header">
              <Icon icon="mdi:account-details" />
              <h2>Thông tin cá nhân</h2>
            </div>
            <div class="card-body">
              <div class="info-list" v-if="driverInfo">
                <div class="info-item">
                  <Icon icon="mdi:badge-account" />
                  <div>
                    <label>Mã nhân viên</label>
                    <span>{{ driverInfo.ma_nhan_vien }}</span>
                  </div>
                </div>
                <div class="info-item">
                  <Icon icon="mdi:phone" />
                  <div>
                    <label>Số điện thoại</label>
                    <span>{{ driverInfo.so_dien_thoai || 'Chưa cập nhật' }}</span>
                  </div>
                </div>
                <div class="info-item">
                  <Icon icon="mdi:email" />
                  <div>
                    <label>Email</label>
                    <span>{{ driverInfo.email || 'Chưa cập nhật' }}</span>
                  </div>
                </div>
                <div class="info-item">
                  <Icon icon="mdi:map-marker" />
                  <div>
                    <label>Địa chỉ</label>
                    <span>{{ driverInfo.dia_chi || 'Chưa cập nhật' }}</span>
                  </div>
                </div>
                <div class="info-item">
                  <Icon icon="mdi:calendar" />
                  <div>
                    <label>Ngày vào làm</label>
                    <span>{{ formatDate(driverInfo.ngay_vao_lam) }}</span>
                  </div>
                </div>
              </div>
              <div v-else class="empty-state">
                <Icon icon="mdi:account-question" />
                <p>Chưa liên kết với hồ sơ tài xế</p>
              </div>
            </div>
          </div>

          <!-- Thông tin xe -->
          <div class="content-card vehicle-detail-card">
            <div class="card-header">
              <Icon icon="mdi:truck-outline" />
              <h2>Thông tin xe được gán</h2>
            </div>
            <div class="card-body">
              <div class="info-list" v-if="assignedVehicle">
                <div class="info-item">
                  <Icon icon="mdi:numeric" />
                  <div>
                    <label>Biển số</label>
                    <span class="highlight">{{ assignedVehicle.bien_so }}</span>
                  </div>
                </div>
                <div class="info-item">
                  <Icon icon="mdi:car" />
                  <div>
                    <label>Loại xe</label>
                    <span>{{ assignedVehicle.hang_xe }} {{ assignedVehicle.dong_xe }}</span>
                  </div>
                </div>
                <div class="info-item">
                  <Icon icon="mdi:speedometer" />
                  <div>
                    <label>Số KM hiện tại</label>
                    <span>{{ formatNumber(assignedVehicle.so_km_hien_tai) }} km</span>
                  </div>
                </div>
                <div class="info-item">
                  <Icon icon="mdi:gas-station" />
                  <div>
                    <label>Dung tích bình</label>
                    <span>{{ assignedVehicle.dung_tich_binh || 'N/A' }} lít</span>
                  </div>
                </div>
                <div class="info-item">
                  <Icon icon="mdi:calendar-check" />
                  <div>
                    <label>Hạn đăng kiểm</label>
                    <span>{{ formatDate(assignedVehicle.han_dang_kiem) }}</span>
                  </div>
                </div>
              </div>
              <div v-else class="empty-state">
                <Icon icon="mdi:truck-remove" />
                <p>Bạn chưa được gán xe nào</p>
              </div>
            </div>
          </div>

          <div class="content-card alerts-card">
            <div class="card-header">
              <Icon icon="mdi:bell-alert" />
              <h2>Cảnh báo cá nhân</h2>
              <span class="alerts-badge">{{ unreadAlerts.length }} chưa đọc</span>
            </div>
            <div class="card-body">
              <div v-if="personalAlerts.length > 0" class="alerts-list">
                <div v-for="alert in personalAlerts" :key="alert.id" class="alert-item" :class="getAlertSeverityClass(alert.muc_do)">
                  <div class="alert-main">
                    <p class="alert-title">{{ alert.tieu_de || 'Cảnh báo hệ thống' }}</p>
                    <p class="alert-content">{{ alert.noi_dung || 'Không có nội dung chi tiết' }}</p>
                  </div>
                  <div class="alert-meta">
                    <span class="alert-time">{{ formatDate(alert.tao_luc) }}</span>
                    <span v-if="!alert.da_doc" class="dot-unread"></span>
                  </div>
                </div>
              </div>
              <div v-else class="empty-state">
                <Icon icon="mdi:bell-off" />
                <p>Chưa có cảnh báo nào</p>
              </div>
            </div>
          </div>

          <div class="content-card checklist-card">
            <div class="card-header">
              <Icon icon="mdi:clipboard-check" />
              <h2>Kiểm tra nhanh trước chuyến</h2>
            </div>
            <div class="card-body">
              <label class="check-item"><input type="checkbox" v-model="preTripChecks.lop" /> Kiểm tra lốp xe</label>
              <label class="check-item"><input type="checkbox" v-model="preTripChecks.den" /> Kiểm tra đèn</label>
              <label class="check-item"><input type="checkbox" v-model="preTripChecks.phanh" /> Kiểm tra phanh</label>
              <label class="check-item"><input type="checkbox" v-model="preTripChecks.dau" /> Kiểm tra dầu máy</label>

              <button class="btn-primary-action" :disabled="savingChecklist" @click="savePreTripChecklist">
                <Icon icon="mdi:content-save-check" />
                {{ savingChecklist ? 'Đang lưu...' : 'Lưu checklist hôm nay' }}
              </button>
              <p class="checklist-note" v-if="checklistSavedToday">Bạn đã lưu checklist trong ngày hôm nay.</p>
            </div>
          </div>
        </div>

        <!-- Recent Activity -->
        <div class="content-card activity-card">
          <div class="card-header">
            <Icon icon="mdi:history" />
            <h2>Hoạt động gần đây</h2>
          </div>
          <div class="card-body">
            <div v-if="recentActivities.length > 0" class="activity-list">
              <div v-for="activity in recentActivities" :key="activity.id" class="activity-item" :class="getActivityClass(activity.status)">
                <div class="activity-icon">
                  <Icon :icon="getActivityIcon(activity.type)" />
                </div>
                <div class="activity-content">
                  <p class="activity-title">{{ activity.title }}</p>
                  <p class="activity-meta">
                    <span>{{ formatDate(activity.date) }}</span>
                    <span>{{ activity.meta }}</span>
                  </p>
                </div>
                <div class="activity-status" :class="getActivityClass(activity.status)">
                  {{ activity.status === 'warning' ? 'Cảnh báo' : activity.status === 'progress' ? 'Đang xử lý' : 'Hoàn tất' }}
                </div>
              </div>
            </div>
            <div v-else class="empty-state">
              <Icon icon="mdi:calendar-blank" />
              <p>Chưa có hoạt động nào</p>
            </div>
          </div>
        </div>

        <button class="driver-ai-fab" @click="chatOpen = !chatOpen">
          <Icon :icon="chatOpen ? 'mdi:close' : 'mdi:robot-happy-outline'" />
          <span>{{ chatOpen ? 'Đóng AI' : 'Fleet AI Driver' }}</span>
        </button>

        <div v-if="chatOpen" class="driver-ai-panel">
          <div class="driver-ai-header">
            <div>
              <h3>Fleet AI Driver</h3>
              <p>Trợ lý theo dữ liệu tài xế của bạn</p>
            </div>
            <button class="driver-ai-close" @click="chatOpen = false">
              <Icon icon="mdi:close" />
            </button>
          </div>

          <div class="driver-ai-quick-actions">
            <button
              v-for="qa in driverQuickActions"
              :key="qa.intent"
              class="driver-ai-quick-btn"
              :disabled="chatLoading"
              @click="askDriverAgent(qa.question, qa.intent)"
            >
              {{ qa.label }}
            </button>
          </div>

          <div ref="chatBodyRef" class="driver-ai-body">
            <div v-for="message in chatMessages" :key="message.id" class="driver-ai-msg" :class="message.role">
              <p>{{ message.text }}</p>
              <span>{{ formatDateTime(message.createdAt) }}</span>
            </div>
            <div v-if="chatLoading" class="driver-ai-msg agent loading">
              <p>Đang phân tích dữ liệu...</p>
            </div>
          </div>

          <div class="driver-ai-input-wrap">
            <input
              v-model="chatInput"
              type="text"
              class="driver-ai-input"
              placeholder="Nhập câu hỏi cho Fleet AI Driver"
              :disabled="chatLoading"
              @keydown.enter="askDriverAgent()"
            />
            <button class="driver-ai-send" :disabled="chatLoading || !chatInput.trim()" @click="askDriverAgent()">
              <Icon icon="mdi:send" />
            </button>
          </div>
        </div>
      </template>
    </main>
  </div>
</template>

<style scoped>
.driver-dashboard {
  min-height: 100vh;
  background: #f5f7fa;
}

/* Header */
.dashboard-header {
  background: linear-gradient(135deg, #FFB347 0%, #FFCC33 100%);
  padding: 16px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 4px 20px rgba(255, 179, 71, 0.3);
}

.header-left .logo {
  display: flex;
  align-items: center;
  gap: 12px;
  color: white;
  font-size: 20px;
  font-weight: 700;
}

.logo-icon {
  font-size: 32px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 24px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
  color: white;
}

.user-icon {
  font-size: 40px;
  opacity: 0.9;
}

.user-details {
  display: flex;
  flex-direction: column;
}

.user-name {
  font-weight: 600;
  font-size: 15px;
}

.user-role {
  font-size: 12px;
  opacity: 0.8;
}

.btn-logout {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 10px;
  color: white;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-logout:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* Main */
.dashboard-main {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px;
  color: #666;
  gap: 16px;
  font-size: 16px;
}

.spin {
  font-size: 40px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Welcome */
.welcome-section {
  margin-bottom: 24px;
}

.welcome-section h1 {
  font-size: 28px;
  font-weight: 700;
  color: #1a1a2e;
  margin: 0 0 8px;
}

.welcome-section p {
  color: #666;
  font-size: 15px;
  margin: 0;
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 24px;
}

.stat-card {
  background: white;
  border-radius: 16px;
  padding: 20px;
  display: flex;
  gap: 16px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  color: white;
}

.vehicle-card .stat-icon {
  background: linear-gradient(135deg, #FFB347, #FFCC33);
}

.status-card .stat-icon {
  background: linear-gradient(135deg, #38a169, #2f855a);
}

.info-card .stat-icon {
  background: linear-gradient(135deg, #ed8936, #dd6b20);
}

.trips-card .stat-icon {
  background: linear-gradient(135deg, #4299e1, #3182ce);
}

.vehicle-icon {
  background: linear-gradient(135deg, #FFB347, #FFCC33);
}

.status-icon {
  background: linear-gradient(135deg, #38a169, #2f855a);
}

.info-icon {
  background: linear-gradient(135deg, #ed8936, #dd6b20);
}

.trips-icon {
  background: linear-gradient(135deg, #4299e1, #3182ce);
}

.stat-content h3 {
  font-size: 13px;
  color: #888;
  font-weight: 500;
  margin: 0 0 6px;
}

.stat-value {
  font-size: 20px;
  font-weight: 700;
  color: #1a1a2e;
  margin: 0 0 4px;
}

.stat-value.empty {
  font-size: 14px;
  color: #999;
}

.stat-value.hoat_dong {
  color: #38a169;
}

.stat-value.bao_duong {
  color: #ed8936;
}

.stat-sub {
  font-size: 12px;
  color: #888;
  margin: 0;
}

.month-kpi-grid {
  margin-bottom: 24px;
}

.quick-actions-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 24px;
}

.quick-card .card-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.action-form .form-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.action-form .form-row.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.action-form label {
  font-size: 12px;
  color: #777;
  font-weight: 600;
}

.action-form input,
.action-form select,
.action-form textarea {
  border: 1px solid #d9dee7;
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 14px;
  outline: none;
}

.action-form input:focus,
.action-form select:focus,
.action-form textarea:focus {
  border-color: #FFB347;
  box-shadow: 0 0 0 3px rgba(255, 179, 71, 0.15);
}

.btn-primary-action,
.btn-danger-action {
  border: none;
  border-radius: 10px;
  padding: 11px 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: white;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary-action {
  background: linear-gradient(135deg, #FFB347, #FFCC33);
}

.btn-danger-action {
  background: linear-gradient(135deg, #ef4444, #dc2626);
}

.btn-primary-action:disabled,
.btn-danger-action:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary-action:hover:not(:disabled),
.btn-danger-action:hover:not(:disabled) {
  transform: translateY(-1px);
}

.alerts-card {
  min-height: 330px;
}

.alerts-badge {
  margin-left: auto;
  font-size: 12px;
  color: #7a4a00;
  background: #fff5dd;
  border: 1px solid #ffe3b3;
  padding: 4px 10px;
  border-radius: 999px;
}

.alerts-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.alert-item {
  border-radius: 12px;
  padding: 12px;
  border: 1px solid #e9edf4;
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.alert-main {
  flex: 1;
}

.alert-title {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 700;
  color: #23324a;
}

.alert-content {
  margin: 0;
  font-size: 12px;
  color: #5c6b82;
}

.alert-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  min-width: 84px;
}

.alert-time {
  font-size: 11px;
  color: #7a879b;
}

.dot-unread {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ef4444;
}

.severity-critical {
  border-left: 4px solid #dc2626;
}

.severity-high {
  border-left: 4px solid #f97316;
}

.severity-medium {
  border-left: 4px solid #fbbf24;
}

.severity-low {
  border-left: 4px solid #22c55e;
}

.checklist-card .card-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.check-item {
  font-size: 14px;
  color: #334155;
  display: flex;
  gap: 8px;
  align-items: center;
}

.checklist-note {
  margin: 4px 0 0;
  font-size: 12px;
  color: #2f855a;
}

/* Content Grid */
.content-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 24px;
}

.content-card {
  background: white;
  border-radius: 16px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 24px;
  border-bottom: 1px solid #eee;
  font-size: 20px;
  color: #FFB347;
}

.card-header h2 {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin: 0;
}

.card-body {
  padding: 20px 24px;
}

/* Info List */
.info-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.info-item {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.info-item > svg {
  font-size: 20px;
  color: #667eea;
  margin-top: 2px;
}

.info-item label {
  display: block;
  font-size: 12px;
  color: #888;
  margin-bottom: 2px;
}

.info-item span {
  font-size: 14px;
  color: #333;
  font-weight: 500;
}

.info-item span.highlight {
  color: #667eea;
  font-size: 16px;
  font-weight: 700;
}

/* Activity */
.activity-card {
  grid-column: 1 / -1;
}

.activity-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.activity-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 16px;
  background: #f8f9fa;
  border-radius: 12px;
}

.activity-icon {
  width: 42px;
  height: 42px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 20px;
}

.activity-content {
  flex: 1;
}

.activity-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin: 0 0 4px;
}

.activity-meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #888;
  margin: 0;
}

.activity-status {
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.activity-status.hoan_thanh {
  background: #c6f6d5;
  color: #276749;
}

.activity-status.dang_di {
  background: #bee3f8;
  color: #2b6cb0;
}

.activity-item.activity-warning {
  background: #fff7ed;
}

.activity-item.activity-progress {
  background: #eff6ff;
}

.activity-item.activity-ok {
  background: #f8f9fa;
}

.activity-status.activity-warning {
  background: #fed7aa;
  color: #9a3412;
}

.activity-status.activity-progress {
  background: #bfdbfe;
  color: #1d4ed8;
}

.activity-status.activity-ok {
  background: #c6f6d5;
  color: #276749;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: #999;
}

.empty-state svg {
  font-size: 48px;
  margin-bottom: 12px;
  opacity: 0.5;
}

.empty-state p {
  margin: 0;
  font-size: 14px;
}

/* Responsive */
@media (max-width: 1024px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .quick-actions-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .dashboard-header {
    flex-direction: column;
    gap: 16px;
    text-align: center;
  }
  
  .header-right {
    flex-direction: column;
    gap: 12px;
  }
  
  .stats-grid {
    grid-template-columns: 1fr;
  }
  
  .content-grid {
    grid-template-columns: 1fr;
  }

  .action-form .form-row.two-col {
    grid-template-columns: 1fr;
  }
}

.driver-ai-fab {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 1100;
  border: none;
  border-radius: 999px;
  padding: 12px 16px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: #fff;
  font-weight: 700;
  background: linear-gradient(135deg, #0ea5e9, #2563eb);
  box-shadow: 0 10px 28px rgba(37, 99, 235, 0.35);
}

.driver-ai-panel {
  position: fixed;
  right: 24px;
  bottom: 88px;
  width: min(420px, calc(100vw - 24px));
  max-height: 70vh;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  overflow: hidden;
  z-index: 1099;
  display: flex;
  flex-direction: column;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.2);
}

.driver-ai-header {
  padding: 12px 14px;
  background: linear-gradient(135deg, #eff6ff, #e0f2fe);
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.driver-ai-header h3 {
  margin: 0;
  font-size: 15px;
  color: #0f172a;
}

.driver-ai-header p {
  margin: 2px 0 0;
  font-size: 12px;
  color: #475569;
}

.driver-ai-close {
  border: none;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: #ffffff;
  color: #1e293b;
  cursor: pointer;
}

.driver-ai-quick-actions {
  padding: 10px 12px;
  border-bottom: 1px solid #f1f5f9;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.driver-ai-quick-btn {
  border: 1px solid #dbeafe;
  background: #f8fbff;
  color: #1d4ed8;
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 12px;
  cursor: pointer;
}

.driver-ai-quick-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.driver-ai-body {
  padding: 12px;
  overflow: auto;
  min-height: 220px;
  max-height: 42vh;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.driver-ai-msg {
  max-width: 88%;
  padding: 10px 12px;
  border-radius: 12px;
  white-space: pre-wrap;
}

.driver-ai-msg p {
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
}

.driver-ai-msg span {
  display: block;
  margin-top: 6px;
  font-size: 11px;
  opacity: 0.7;
}

.driver-ai-msg.user {
  align-self: flex-end;
  background: #dbeafe;
  color: #1e3a8a;
}

.driver-ai-msg.agent {
  align-self: flex-start;
  background: #f8fafc;
  color: #0f172a;
  border: 1px solid #e2e8f0;
}

.driver-ai-msg.loading {
  font-style: italic;
}

.driver-ai-input-wrap {
  padding: 10px;
  border-top: 1px solid #e2e8f0;
  display: flex;
  gap: 8px;
}

.driver-ai-input {
  flex: 1;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  padding: 10px;
  font-size: 13px;
}

.driver-ai-send {
  border: none;
  width: 42px;
  height: 42px;
  border-radius: 10px;
  background: linear-gradient(135deg, #0ea5e9, #2563eb);
  color: #fff;
  cursor: pointer;
}

.driver-ai-send:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .driver-ai-fab {
    right: 14px;
    bottom: 14px;
  }

  .driver-ai-panel {
    right: 10px;
    bottom: 68px;
    width: calc(100vw - 20px);
    max-height: 76vh;
  }
}
</style>
