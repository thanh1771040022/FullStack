<script setup>
import { ref, computed, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import { useRouter } from 'vue-router'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
} from 'chart.js'
import { fuelService, vehicleService, vehicleTypeService } from '@/services'
import { authService } from '@/services/authService'

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale)
const router = useRouter()

// State
const fuelData = ref([])
const vehicles = ref([])
const loading = ref(true)
const error = ref(null)
const searchTerm = ref('')
const selectedMonth = ref('') // Format: YYYY-MM
const showThresholdModal = ref(false)
const thresholdLoading = ref(false)
const thresholdSaving = ref(false)
const thresholdError = ref('')
const vehicleTypes = ref([])
const pendingApprovals = ref([])
const approvalLoading = ref(false)
const approvalError = ref('')
const processingApprovalId = ref(null)
const showAuditModal = ref(false)
const selectedAuditRecord = ref(null)
const auditLoading = ref(false)
const auditError = ref('')
const auditHistory = ref([])

const getMonthKey = (dateValue) => {
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return null
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

const formatMonthLabel = (monthKey) => {
  const [year, month] = monthKey.split('-')
  return `Tháng ${month}/${year}`
}

const getPreviousMonthKey = (monthKey) => {
  if (!monthKey) return null
  const [yearStr, monthStr] = monthKey.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)
  if (!year || !month) return null

  const date = new Date(year, month - 2, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

const aggregateFuelData = (rows) => {
  const totalFuel = rows.reduce((sum, item) => sum + (parseFloat(item.so_lit) || 0), 0)
  const totalFuelCost = rows.reduce((sum, item) => sum + (parseFloat(item.tong_tien) || 0), 0)
  const totalDistance = rows.reduce((sum, item) => sum + (parseFloat(item.quang_duong) || 0), 0)

  return {
    totalFuel,
    totalFuelCost,
    totalDistance,
    averageConsumption: totalDistance > 0 ? (totalFuel / totalDistance * 100) : 0,
  }
}

// Month options generated from real fuel data, newest first
const monthOptions = computed(() => {
  const uniqueMonths = new Set()

  fuelData.value.forEach((item) => {
    const monthKey = item.thoi_gian_do ? getMonthKey(item.thoi_gian_do) : null
    if (monthKey) uniqueMonths.add(monthKey)
  })

  return Array.from(uniqueMonths)
    .sort((a, b) => b.localeCompare(a))
    .map((value) => ({ value, label: formatMonthLabel(value) }))
})

// Filter fuel data by selected month
const filteredFuelData = computed(() => {
  if (!selectedMonth.value) return fuelData.value
  
  return fuelData.value.filter(item => {
    if (!item.thoi_gian_do) return false
    const date = new Date(item.thoi_gian_do)
    const itemMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    return itemMonth === selectedMonth.value
  })
})

// Fetch data from API
const fetchData = async () => {
  loading.value = true
  error.value = null
  approvalError.value = ''
  try {
    const [fuelResult, vehicleResult, pendingResult] = await Promise.allSettled([
      fuelService.getAll(),
      vehicleService.getAllWithDetails(),
      fuelService.getPendingApprovals(),
    ])

    if (fuelResult.status !== 'fulfilled' || vehicleResult.status !== 'fulfilled') {
      throw new Error('Không thể tải dữ liệu nhiên liệu hoặc danh sách xe.')
    }

    fuelData.value = fuelResult.value.data
    vehicles.value = vehicleResult.value.data

    if (pendingResult.status === 'fulfilled') {
      pendingApprovals.value = pendingResult.value.data || []
    } else {
      pendingApprovals.value = []
      approvalError.value = pendingResult.reason?.response?.data?.message || 'Không thể tải danh sách chờ duyệt.'
    }

    if (monthOptions.value.length > 0) {
      selectedMonth.value = monthOptions.value[0].value
    } else {
      selectedMonth.value = ''
    }
  } catch (err) {
    console.error('Error fetching fuel data:', err)
    error.value = 'Không thể tải dữ liệu nhiên liệu. Vui lòng thử lại.'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchData()
})

// Summary Data (computed from filtered API data)
const summaryData = computed(() => {
  if (filteredFuelData.value.length === 0) {
    return {
      totalDistance: 0,
      totalFuelCost: 0,
      totalFuel: 0,
      averageConsumption: 0,
    }
  }
  
  const metrics = aggregateFuelData(filteredFuelData.value)
  
  return {
    totalDistance: Math.round(metrics.totalDistance),
    totalFuelCost: Math.round(metrics.totalFuelCost),
    totalFuel: Math.round(metrics.totalFuel * 10) / 10,
    averageConsumption: metrics.averageConsumption.toFixed(2),
  }
})

const comparisonData = computed(() => {
  const previousMonth = getPreviousMonthKey(selectedMonth.value)
  if (!previousMonth) {
    return { distanceChange: 0, fuelCostChange: 0 }
  }

  const previousRows = fuelData.value.filter((item) => getMonthKey(item.thoi_gian_do) === previousMonth)
  const currentMetrics = aggregateFuelData(filteredFuelData.value)
  const previousMetrics = aggregateFuelData(previousRows)

  const calcChange = (current, previous) => {
    if (previous <= 0) return current > 0 ? 100 : 0
    return ((current - previous) / previous) * 100
  }

  return {
    distanceChange: calcChange(currentMetrics.totalDistance, previousMetrics.totalDistance),
    fuelCostChange: calcChange(currentMetrics.totalFuelCost, previousMetrics.totalFuelCost),
  }
})

const averageStandard = computed(() => {
  if (vehicles.value.length === 0) return 0
  const standards = vehicles.value.map((v) => Number(v.dinh_muc_nhien_lieu || v.dinh_muc || 0)).filter((v) => v > 0)
  if (standards.length === 0) return 0
  return standards.reduce((sum, item) => sum + item, 0) / standards.length
})

// Chart Data (computed from filtered API data)
const chartData = computed(() => {
  const vehicleLabels = vehicles.value.slice(0, 8).map(v => v.bien_so)
  const standardData = vehicles.value.slice(0, 8).map(v => Number(v.dinh_muc_nhien_lieu || v.dinh_muc || 8.0))
  
  // Calculate actual consumption per vehicle using filtered data
  const actualData = vehicleLabels.map(plate => {
    const vehicleFuel = filteredFuelData.value.filter(f => {
      const vehicle = vehicles.value.find(v => v.id === f.xe_id)
      return vehicle && vehicle.bien_so === plate
    })
    const totalLit = vehicleFuel.reduce((sum, f) => sum + (parseFloat(f.so_lit) || 0), 0)
    const totalKm = vehicleFuel.reduce((sum, f) => sum + (parseFloat(f.quang_duong) || 0), 0)
    return totalKm > 0 ? (totalLit / totalKm * 100).toFixed(1) : 0
  })
  
  return {
    labels: vehicleLabels.length > 0 ? vehicleLabels : ['Không có dữ liệu'],
    datasets: [
      {
        label: 'Định mức (L/100km)',
        data: standardData.length > 0 ? standardData : [0],
        backgroundColor: '#10b981',
        borderRadius: 4,
      },
      {
        label: 'Thực tế (L/100km)',
        data: actualData.length > 0 ? actualData : [0],
        backgroundColor: '#FFB347',
        borderRadius: 4,
      },
    ],
  }
})

// Abnormal Vehicles (computed from filtered API data)
const abnormalVehicles = computed(() => {
  return vehicles.value
    .map(vehicle => {
      const vehicleFuel = filteredFuelData.value.filter(f => f.xe_id === vehicle.id)
      const totalLit = vehicleFuel.reduce((sum, f) => sum + (parseFloat(f.so_lit) || 0), 0)
      const totalKm = vehicleFuel.reduce((sum, f) => sum + (parseFloat(f.quang_duong) || 0), 0)
      const totalCost = vehicleFuel.reduce((sum, f) => sum + (parseFloat(f.tong_tien) || 0), 0)
      const consumption = totalKm > 0 ? (totalLit / totalKm * 100) : 0
      const standard = Number(vehicle.dinh_muc_nhien_lieu || vehicle.dinh_muc || 8.0)
      const variance = standard > 0 ? ((consumption - standard) / standard * 100) : 0
      
      return {
        id: vehicle.id,
        licensePlate: vehicle.bien_so,
        driver: vehicle.tai_xe_ten || 'Chưa gán',
        distance: totalKm,
        fuelUsed: totalLit,
        fuelCost: totalCost,
        consumption: consumption.toFixed(1),
        standard,
        variance: variance.toFixed(1),
        status: variance > 15 ? 'danger' : variance > 5 ? 'warning' : 'normal',
      }
    })
    .filter(v => {
      // Search filter
      const matchesSearch = searchTerm.value === '' || 
        (v.licensePlate && v.licensePlate.toLowerCase().includes(searchTerm.value.toLowerCase())) ||
        (v.driver && v.driver.toLowerCase().includes(searchTerm.value.toLowerCase()))
      return matchesSearch && parseFloat(v.variance) > 5
    })
    .sort((a, b) => parseFloat(b.variance) - parseFloat(a.variance))
    .slice(0, 10)
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom',
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      grid: {
        color: '#f3f4f6',
      },
      title: {
        display: true,
        text: 'L/100km',
      },
    },
    x: {
      grid: {
        display: false,
      },
    },
  },
}

const formatCurrency = (value) => {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(value)
}

const formatMaybeText = (value) => {
  const text = String(value ?? '').trim()
  return text || 'N/A'
}

const getStatusClass = (status) => {
  return status === 'danger' ? 'status-danger' : 'status-warning'
}

// Get current selected month label
const selectedMonthLabel = computed(() => {
  const found = monthOptions.value.find(m => m.value === selectedMonth.value)
  return found ? found.label : 'Chưa có dữ liệu theo tháng'
})

const hasAnyFuelData = computed(() => fuelData.value.length > 0)

const formatTrend = (value) => {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}% so với tháng trước`
}

const trendClass = (value) => (value > 0 ? 'negative' : value < 0 ? 'positive' : 'neutral')

const formatDateTime = (value) => {
  if (!value) return 'N/A'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'N/A'
  return parsed.toLocaleString('vi-VN')
}

const formatApprovalStatus = (status) => {
  if (status === 'da_duyet') return 'Đã duyệt'
  if (status === 'tu_choi') return 'Từ chối'
  return 'Chờ duyệt'
}

const getApprovalBadgeClass = (status) => {
  if (status === 'da_duyet') return 'badge-approved'
  if (status === 'tu_choi') return 'badge-rejected'
  return 'badge-pending'
}

const reviewFuelRecord = async (record, status) => {
  let reason = ''
  if (status === 'tu_choi') {
    const input = window.prompt('Nhập lý do từ chối bản ghi nhiên liệu:', '')
    if (input === null) return
    reason = String(input).trim()
  }

  processingApprovalId.value = record.id
  approvalError.value = ''

  try {
    await fuelService.reviewApproval(record.id, {
      trang_thai_duyet: status,
      ly_do: reason || undefined,
    })

    await fetchData()
  } catch (err) {
    approvalError.value = err?.response?.data?.message || 'Không thể cập nhật trạng thái duyệt.'
  } finally {
    processingApprovalId.value = null
  }
}

const openAuditHistory = async (record) => {
  showAuditModal.value = true
  selectedAuditRecord.value = record
  auditLoading.value = true
  auditError.value = ''
  auditHistory.value = []

  try {
    const response = await fuelService.getAuditHistory(record.id)
    auditHistory.value = response.data?.items || []
  } catch (err) {
    auditError.value = err?.response?.data?.message || 'Không thể tải lịch sử audit.'
  } finally {
    auditLoading.value = false
  }
}

const closeAuditModal = () => {
  showAuditModal.value = false
  selectedAuditRecord.value = null
  auditError.value = ''
  auditHistory.value = []
}

const exportFuelReport = () => {
  const rows = abnormalVehicles.value
  if (rows.length === 0) {
    alert('Không có dữ liệu để xuất báo cáo.')
    return
  }

  const headers = [
    'Biển số xe',
    'Tài xế',
    'Quãng đường (km)',
    'Tiêu hao (L)',
    'Chi phí (VND)',
    'L/100km',
    'Định mức',
    'Chênh lệch (%)',
  ]

  const csvRows = rows.map((item) => [
    item.licensePlate,
    item.driver,
    item.distance,
    item.fuelUsed,
    item.fuelCost,
    item.consumption,
    item.standard,
    item.variance,
  ])

  const csvContent = [headers, ...csvRows]
    .map((line) => line.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `bao-cao-nhien-lieu-${selectedMonth.value || 'tong-hop'}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

const openThresholdSettings = async () => {
  showThresholdModal.value = true
  thresholdError.value = ''
  thresholdLoading.value = true

  try {
    const response = await vehicleTypeService.getThresholds()
    vehicleTypes.value = (response.data || []).map((item) => ({
      ...item,
      dinh_muc_nhien_lieu: Number(item.dinh_muc_nhien_lieu || 0),
      nguong_canh_bao: Number(item.nguong_canh_bao || 0),
    }))
  } catch (err) {
    thresholdError.value = err?.response?.data?.message || 'Không thể tải danh sách định mức.'
  } finally {
    thresholdLoading.value = false
  }
}

const closeThresholdSettings = () => {
  showThresholdModal.value = false
}

const saveThresholdSettings = async () => {
  thresholdSaving.value = true
  thresholdError.value = ''

  try {
    await Promise.all(
      vehicleTypes.value.map((item) =>
        vehicleTypeService.updateThreshold(item.id, {
          dinh_muc_nhien_lieu: Number(item.dinh_muc_nhien_lieu),
          nguong_canh_bao: Number(item.nguong_canh_bao),
        })
      )
    )

    await fetchData()
    showThresholdModal.value = false
  } catch (err) {
    thresholdError.value = err?.response?.data?.message || 'Không thể lưu định mức.'
  } finally {
    thresholdSaving.value = false
  }
}

const viewVehicleDetail = (vehicleId) => {
  router.push(`/vehicles/${vehicleId}`)
}

const inspectVehicle = (vehicleId) => {
  router.push({ path: '/maintenance', query: { xeId: String(vehicleId) } })
}

const isManager = computed(() => {
  const user = authService.getUser()
  return user?.vai_tro === 'quan_ly'
})
</script>

<template>
  <div class="fuel-page">
    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <Icon icon="mdi:loading" class="loading-icon" />
      <p>Đang tải dữ liệu...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <Icon icon="mdi:alert-circle" class="error-icon" />
      <p>{{ error }}</p>
      <button class="btn btn-primary" @click="fetchData">Thử lại</button>
    </div>

    <template v-else>
    <!-- Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Phân tích Chi phí & Tiêu hao Nhiên liệu</h1>
        <p class="page-subtitle">Hệ thống Quản lý Đội xe - {{ selectedMonthLabel }}</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-secondary" @click="exportFuelReport">
          <Icon icon="mdi:download" class="icon-sm" />
          Xuất báo cáo
        </button>
        <button class="btn btn-primary" @click="openThresholdSettings">
          <Icon icon="mdi:cog" class="icon-sm" />
          Cài đặt định mức
        </button>
      </div>
    </div>

    <!-- Summary Cards -->
    <div class="summary-grid">
      <div class="summary-card">
        <div class="summary-icon blue">
          <Icon icon="mdi:road-variant" class="icon-xl" />
        </div>
        <div class="summary-content">
          <p class="summary-label">Tổng quãng đường</p>
          <p class="summary-value">{{ Number(summaryData.totalDistance).toLocaleString('vi-VN') }} km</p>
          <p class="summary-trend" :class="trendClass(comparisonData.distanceChange)">
            <Icon icon="mdi:trending-up" class="icon-sm" />
            {{ formatTrend(comparisonData.distanceChange) }}
          </p>
        </div>
      </div>

      <div class="summary-card">
        <div class="summary-icon green">
          <Icon icon="mdi:currency-usd" class="icon-xl" />
        </div>
        <div class="summary-content">
          <p class="summary-label">Tổng chi phí nhiên liệu</p>
          <p class="summary-value">{{ (Number(summaryData.totalFuelCost) / 1000000).toFixed(1) }}M đ</p>
          <p class="summary-trend" :class="trendClass(comparisonData.fuelCostChange)">
            <Icon icon="mdi:trending-up" class="icon-sm" />
            {{ formatTrend(comparisonData.fuelCostChange) }}
          </p>
        </div>
      </div>

      <div class="summary-card">
        <div class="summary-icon yellow">
          <Icon icon="mdi:gas-station" class="icon-xl" />
        </div>
        <div class="summary-content">
          <p class="summary-label">Tổng lượng nhiên liệu</p>
          <p class="summary-value">{{ Number(summaryData.totalFuel).toLocaleString('vi-VN') }} L</p>
          <p class="summary-subtitle">Trung bình {{ vehicles.length > 0 ? (summaryData.totalFuel / vehicles.length).toFixed(1) : 0 }}L/xe</p>
        </div>
      </div>

      <div class="summary-card">
        <div class="summary-icon purple">
          <Icon icon="mdi:gauge" class="icon-xl" />
        </div>
        <div class="summary-content">
          <p class="summary-label">Tiêu hao trung bình</p>
          <p class="summary-value">{{ summaryData.averageConsumption }} L/100km</p>
          <p class="summary-subtitle">Định mức TB: {{ averageStandard.toFixed(1) }} L/100km</p>
        </div>
      </div>
    </div>

    <!-- Fuel Analysis Chart -->
    <div class="chart-card">
      <div class="card-header">
        <h3>
          <Icon icon="mdi:chart-bar" class="icon-md" />
          So sánh tiêu hao nhiên liệu theo xe
        </h3>
        <select v-model="selectedMonth" class="select-period" :disabled="monthOptions.length === 0">
          <option v-for="month in monthOptions" :key="month.value" :value="month.value">
            {{ month.label }}
          </option>
          <option v-if="monthOptions.length === 0" value="">Không có dữ liệu tháng</option>
        </select>
      </div>
      <div class="chart-container">
        <Bar :data="chartData" :options="chartOptions" />
      </div>
    </div>

    <div v-if="!hasAnyFuelData" class="empty-state-card">
      <Icon icon="mdi:database-off" class="empty-icon" />
      <p>Chưa có dữ liệu đổ nhiên liệu để phân tích.</p>
    </div>

    <div v-else-if="filteredFuelData.length === 0" class="empty-state-card">
      <Icon icon="mdi:calendar-remove" class="empty-icon" />
      <p>Không có dữ liệu trong tháng đã chọn.</p>
    </div>

    <!-- Abnormal Vehicles Table -->
    <div v-else class="table-card">
      <div class="card-header">
        <h3>
          <Icon icon="mdi:alert-circle" class="icon-md" />
          Xe tiêu hao nhiên liệu bất thường
        </h3>
        <span class="badge badge-danger">{{ abnormalVehicles.length }} xe cần kiểm tra</span>
      </div>
      <div class="search-box-container">
        <div class="search-box">
          <Icon icon="mdi:magnify" class="search-icon" />
          <input
            v-model="searchTerm"
            type="text"
            placeholder="Tìm kiếm theo biển số, tài xế..."
            class="search-input"
          />
        </div>
      </div>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Biển số xe</th>
              <th>Tài xế</th>
              <th>Quãng đường (km)</th>
              <th>Tiêu hao (L)</th>
              <th>Chi phí</th>
              <th>L/100km</th>
              <th>Định mức</th>
              <th>Chênh lệch</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="vehicle in abnormalVehicles" :key="vehicle.id">
              <td class="font-medium">{{ vehicle.licensePlate }}</td>
              <td>{{ vehicle.driver }}</td>
              <td>{{ vehicle.distance.toLocaleString() }}</td>
              <td>{{ vehicle.fuelUsed.toLocaleString() }}</td>
              <td>{{ formatCurrency(vehicle.fuelCost) }}</td>
              <td class="font-medium">{{ vehicle.consumption }}</td>
              <td>{{ vehicle.standard }}</td>
              <td>
                <span class="variance-badge" :class="getStatusClass(vehicle.status)">
                  +{{ vehicle.variance }}%
                </span>
              </td>
              <td>
                <button class="btn-icon" title="Xem chi tiết" @click="viewVehicleDetail(vehicle.id)">
                  <Icon icon="mdi:eye" class="icon-sm" />
                </button>
                <button class="btn-icon" title="Kiểm tra xe" @click="inspectVehicle(vehicle.id)">
                  <Icon icon="mdi:wrench" class="icon-sm" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="isManager" class="table-card">
      <div class="card-header">
        <h3>
          <Icon icon="mdi:clipboard-check-outline" class="icon-md" />
          Danh sách bản ghi nhiên liệu chờ duyệt
        </h3>
        <span class="badge badge-pending">{{ pendingApprovals.length }} bản ghi</span>
      </div>

      <div v-if="approvalError" class="error-text" style="margin: 1rem 1.5rem 0;">{{ approvalError }}</div>

      <div v-if="loading || approvalLoading" class="loading-text" style="padding: 1rem 1.5rem;">Đang tải danh sách chờ duyệt...</div>

      <div v-else-if="pendingApprovals.length === 0" class="empty-state-card" style="margin: 1rem 1.5rem;">
        <Icon icon="mdi:check-decagram" class="empty-icon" />
        <p>Không có bản ghi nào đang chờ duyệt.</p>
      </div>

      <div v-else class="table-container">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Thời gian đổ</th>
              <th>Biển số</th>
              <th>Người gửi</th>
              <th>Tài xế</th>
              <th>Trạm xăng</th>
              <th>Số lít</th>
              <th>Giá/lít</th>
              <th>KM trước</th>
              <th>KM sau</th>
              <th>L/100km</th>
              <th>Vượt định mức</th>
              <th>Trạng thái</th>
              <th>Ghi chú</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in pendingApprovals" :key="item.id">
              <td>{{ item.id }}</td>
              <td>{{ formatDateTime(item.thoi_gian_do) }}</td>
              <td class="font-medium">{{ item.bien_so }}</td>
              <td>{{ item.nguoi_gui_ho_ten || item.nguoi_gui_username || 'N/A' }}</td>
              <td>{{ item.tai_xe_ten || 'N/A' }}</td>
              <td>{{ formatMaybeText(item.tram_xang) }}</td>
              <td>{{ Number(item.so_lit || 0).toFixed(2) }}</td>
              <td>{{ formatCurrency(Number(item.gia_moi_lit || 0)) }}</td>
              <td>{{ Number(item.km_truoc || 0).toLocaleString('vi-VN') }}</td>
              <td>{{ Number(item.km_sau || 0).toLocaleString('vi-VN') }}</td>
              <td>{{ Number(item.muc_tieu_hao || 0).toFixed(2) }}</td>
              <td>{{ Number(item.ty_le_vuot_dinh_muc || 0).toFixed(2) }}%</td>
              <td>
                <span class="badge" :class="getApprovalBadgeClass(item.trang_thai_duyet)">
                  {{ formatApprovalStatus(item.trang_thai_duyet) }}
                </span>
              </td>
              <td class="note-cell" :title="formatMaybeText(item.ghi_chu)">{{ formatMaybeText(item.ghi_chu) }}</td>
              <td class="approval-actions-cell">
                <button class="btn btn-approve" :disabled="processingApprovalId === item.id" @click="reviewFuelRecord(item, 'da_duyet')">
                  Duyệt
                </button>
                <button class="btn btn-reject" :disabled="processingApprovalId === item.id" @click="reviewFuelRecord(item, 'tu_choi')">
                  Từ chối
                </button>
                <button class="btn btn-secondary" :disabled="processingApprovalId === item.id" @click="openAuditHistory(item)">
                  Lịch sử
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Notes -->
    <div class="notes-grid">
      <div class="notes-card">
        <h4>
          <Icon icon="mdi:information" class="icon-md" />
          Ghi chú
        </h4>
        <ul class="notes-list">
          <li>
            <span class="note-dot green"></span>
            Tiêu hao thấp hơn định mức: Hiệu quả tốt
          </li>
          <li>
            <span class="note-dot yellow"></span>
            Vượt định mức 5-15%: Cảnh báo, cần kiểm tra
          </li>
          <li>
            <span class="note-dot red"></span>
            Vượt định mức &gt;15%: Nghiêm trọng, yêu cầu kiểm tra ngay
          </li>
        </ul>
      </div>

      <div class="notes-card">
        <h4>
          <Icon icon="mdi:lightbulb" class="icon-md" />
          Đề xuất
        </h4>
        <ul class="suggestions-list">
          <li>Kiểm tra hệ thống phun nhiên liệu xe 51C-11111</li>
          <li>Đánh giá lại thói quen lái xe của tài xế</li>
          <li>Xem xét lộ trình vận chuyển để tối ưu hóa</li>
        </ul>
      </div>
    </div>

    <div v-if="showThresholdModal" class="modal-overlay" @click.self="closeThresholdSettings">
      <div class="modal-card">
        <h3>Cài đặt định mức theo loại xe</h3>

        <div v-if="thresholdError" class="error-text">{{ thresholdError }}</div>
        <div v-if="thresholdLoading" class="loading-text">Đang tải dữ liệu...</div>

        <div v-else class="threshold-list">
          <div v-for="item in vehicleTypes" :key="item.id" class="threshold-row">
            <div class="threshold-name">{{ item.ten_loai_xe }}</div>
            <div class="threshold-inputs">
              <label>
                Định mức
                <input v-model.number="item.dinh_muc_nhien_lieu" type="number" min="0" step="0.1" />
              </label>
              <label>
                Ngưỡng (%)
                <input v-model.number="item.nguong_canh_bao" type="number" min="0" step="0.1" />
              </label>
            </div>
          </div>
        </div>

        <div class="modal-actions">
          <button class="btn btn-secondary" @click="closeThresholdSettings">Đóng</button>
          <button class="btn btn-primary" :disabled="thresholdSaving || thresholdLoading" @click="saveThresholdSettings">
            {{ thresholdSaving ? 'Đang lưu...' : 'Lưu định mức' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="showAuditModal" class="modal-overlay" @click.self="closeAuditModal">
      <div class="modal-card">
        <h3>
          Lịch sử audit bản ghi #{{ selectedAuditRecord?.id }}
        </h3>

        <div v-if="auditError" class="error-text">{{ auditError }}</div>
        <div v-if="auditLoading" class="loading-text">Đang tải lịch sử audit...</div>

        <div v-else-if="auditHistory.length === 0" class="loading-text">Chưa có bản ghi audit.</div>

        <div v-else class="audit-timeline">
          <div v-for="entry in auditHistory" :key="entry.id" class="audit-item">
            <div class="audit-top">
              <span class="badge" :class="entry.hanh_dong === 'duyet' ? 'badge-approved' : entry.hanh_dong === 'tu_choi' ? 'badge-rejected' : 'badge-pending'">
                {{ entry.hanh_dong }}
              </span>
              <span class="audit-time">{{ formatDateTime(entry.tao_luc) }}</span>
            </div>
            <p class="audit-user">
              Người thực hiện:
              <strong>{{ entry.nguoi_thuc_hien_ho_ten || entry.nguoi_thuc_hien_username || 'N/A' }}</strong>
              ({{ entry.vai_tro_nguoi_thuc_hien || 'N/A' }})
            </p>
            <p class="audit-note" v-if="entry.du_lieu_moi?.ghi_chu">Ghi chú: {{ entry.du_lieu_moi.ghi_chu }}</p>
          </div>
        </div>

        <div class="modal-actions">
          <button class="btn btn-secondary" @click="closeAuditModal">Đóng</button>
        </div>
      </div>
    </div>
    </template>
  </div>
</template>

<style scoped>
.fuel-page {
  max-width: 1400px;
  margin: 0 auto;
}

/* Loading and Error States */
.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;
}

.loading-icon {
  font-size: 3rem;
  color: #2563eb;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.error-state .error-icon {
  font-size: 3rem;
  color: #ef4444;
  margin-bottom: 1rem;
}

.error-state p {
  color: #6b7280;
  margin-bottom: 1rem;
}

.empty-state-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  padding: 2rem 1rem;
  text-align: center;
  color: #6b7280;
  margin-bottom: 1.5rem;
}

.empty-icon {
  width: 2.25rem;
  height: 2.25rem;
  color: #9ca3af;
  margin-bottom: 0.5rem;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.page-title {
  font-size: 1.875rem;
  font-weight: 700;
  color: #111827;
  margin-bottom: 0.25rem;
}

.page-subtitle {
  color: #6b7280;
  font-size: 0.875rem;
}

.header-actions {
  display: flex;
  gap: 0.75rem;
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-weight: 500;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.15s ease;
  border: none;
}

.btn-primary {
  background: linear-gradient(135deg, #FFB347 0%, #FFCC33 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(255, 179, 71, 0.3);
}
.btn-primary:hover {
  box-shadow: 0 4px 12px rgba(255, 179, 71, 0.4);
  transform: translateY(-1px);
}

.btn-secondary {
  background: white;
  color: #374151;
  border: 1px solid #d1d5db;
}
.btn-secondary:hover {
  background: #f9fafb;
}

.btn-icon {
  padding: 0.5rem;
  border-radius: 0.375rem;
  border: none;
  background: transparent;
  cursor: pointer;
  color: #6b7280;
}
.btn-icon:hover {
  background: #f3f4f6;
  color: #111827;
}

.icon-sm {
  width: 1rem;
  height: 1rem;
}
.icon-md {
  width: 1.25rem;
  height: 1.25rem;
}
.icon-xl {
  width: 2rem;
  height: 2rem;
}

/* Summary Cards */
.summary-grid {
  display: grid;
  grid-template-columns: repeat(1, 1fr);
  gap: 1rem;
  margin-bottom: 1.5rem;
}

@media (min-width: 640px) {
  .summary-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1024px) {
  .summary-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

.summary-card {
  background: white;
  border-radius: 0.75rem;
  padding: 1.5rem;
  display: flex;
  gap: 1rem;
  border: 1px solid #e5e7eb;
}

.summary-icon {
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.summary-icon.blue {
  background: #eff6ff;
  color: #2563eb;
}
.summary-icon.green {
  background: #f0fdf4;
  color: #16a34a;
}
.summary-icon.yellow {
  background: #fefce8;
  color: #ca8a04;
}
.summary-icon.purple {
  background: #f3e8ff;
  color: #9333ea;
}

.summary-content {
  flex: 1;
}

.summary-label {
  font-size: 0.75rem;
  color: #6b7280;
  margin-bottom: 0.25rem;
}

.summary-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #111827;
  margin-bottom: 0.25rem;
}

.summary-trend {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
}

.summary-trend.positive {
  color: #16a34a;
}

.summary-trend.negative {
  color: #dc2626;
}

.summary-subtitle {
  font-size: 0.75rem;
  color: #6b7280;
}

/* Chart Card */
.chart-card,
.table-card {
  background: white;
  border-radius: 0.75rem;
  border: 1px solid #e5e7eb;
  margin-bottom: 1.5rem;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.card-header h3 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  color: #111827;
}

.search-box-container {
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.search-box {
  position: relative;
  max-width: 400px;
}

.search-icon {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: #9ca3af;
  width: 1.25rem;
  height: 1.25rem;
}

.search-input {
  width: 100%;
  padding: 0.5rem 1rem 0.5rem 2.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  font-size: 0.875rem;
}
.search-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.select-period {
  padding: 0.375rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  background: white;
}

.chart-container {
  padding: 1.5rem;
  height: 350px;
}

/* Table */
.table-container {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: 0.75rem 1rem;
  text-align: left;
}

th {
  background: #f9fafb;
  font-weight: 600;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #374151;
  white-space: nowrap;
}

td {
  font-size: 0.875rem;
  color: #374151;
  border-bottom: 1px solid #e5e7eb;
}

.font-medium {
  font-weight: 500;
  color: #111827;
}

tbody tr:hover {
  background: #f9fafb;
}

/* Badges */
.badge {
  display: inline-flex;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
}

.badge-danger {
  background: #fef2f2;
  color: #dc2626;
}

.badge-pending {
  background: #fff7ed;
  color: #c2410c;
}

.badge-approved {
  background: #f0fdf4;
  color: #15803d;
}

.badge-rejected {
  background: #fef2f2;
  color: #dc2626;
}

.variance-badge {
  display: inline-flex;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
}

.variance-badge.status-danger {
  background: #fef2f2;
  color: #dc2626;
}

.variance-badge.status-warning {
  background: #fefce8;
  color: #ca8a04;
}

/* Notes */
.notes-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

@media (min-width: 768px) {
  .notes-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.notes-card {
  background: white;
  border-radius: 0.75rem;
  padding: 1.5rem;
  border: 1px solid #e5e7eb;
}

.notes-card h4 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  color: #111827;
  margin-bottom: 1rem;
}

.notes-list,
.suggestions-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.notes-list li,
.suggestions-list li {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #4b5563;
  padding: 0.5rem 0;
}

.note-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  margin-top: 0.375rem;
  flex-shrink: 0;
}

.note-dot.green {
  background: #16a34a;
}
.note-dot.yellow {
  background: #ca8a04;
}
.note-dot.red {
  background: #dc2626;
}

.suggestions-list li::before {
  content: '•';
  color: #2563eb;
  font-weight: bold;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.35);
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.modal-card {
  width: min(760px, 100%);
  max-height: 85vh;
  overflow: auto;
  background: #fff;
  border-radius: 0.75rem;
  border: 1px solid #e5e7eb;
  padding: 1rem;
}

.modal-card h3 {
  margin: 0 0 0.75rem;
  font-size: 1.05rem;
}

.threshold-list {
  display: grid;
  gap: 0.75rem;
}

.threshold-row {
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  padding: 0.75rem;
  display: grid;
  gap: 0.5rem;
}

.threshold-name {
  font-weight: 600;
  color: #111827;
}

.threshold-inputs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
}

.threshold-inputs label {
  display: grid;
  gap: 0.25rem;
  font-size: 0.8rem;
  color: #4b5563;
}

.threshold-inputs input {
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  padding: 0.45rem 0.6rem;
}

.modal-actions {
  margin-top: 1rem;
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.error-text {
  background: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fecaca;
  border-radius: 0.5rem;
  padding: 0.6rem 0.75rem;
  font-size: 0.85rem;
  margin-bottom: 0.75rem;
}

.loading-text {
  color: #6b7280;
  font-size: 0.9rem;
  padding: 0.5rem 0;
}

.approval-actions-cell {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.note-cell {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.btn-approve {
  background: #16a34a;
  color: #fff;
}

.btn-approve:hover {
  background: #15803d;
}

.btn-reject {
  background: #dc2626;
  color: #fff;
}

.btn-reject:hover {
  background: #b91c1c;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.audit-timeline {
  display: grid;
  gap: 0.75rem;
}

.audit-item {
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  padding: 0.75rem;
}

.audit-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.audit-time {
  font-size: 0.8rem;
  color: #6b7280;
}

.audit-user,
.audit-note {
  margin-top: 0.45rem;
  font-size: 0.86rem;
  color: #374151;
}

@media (max-width: 700px) {
  .threshold-inputs {
    grid-template-columns: 1fr;
  }
}
</style>
