<script setup>
import { ref, computed, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
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
import { vehicleService, alertService, fuelService } from '@/services'

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale)

// State
const vehicles = ref([])
const upcomingExpiries = ref([])
const alertsData = ref([])
const fuelData = ref([])
const loading = ref(true)
const error = ref(null)
const selectedYear = ref(new Date().getFullYear())

const maintenanceVehicleCount = computed(() => {
  const ids = new Set((upcomingExpiries.value || []).map((item) => item.xe_id).filter((id) => Number.isFinite(Number(id))))
  return ids.size
})

const recentFuelAlerts = computed(() => {
  const allAlerts = alertsData.value || []
  const fuelAlerts = allAlerts.filter((item) => item.loai_canh_bao === 'nhien_lieu_bat_thuong')
  const source = fuelAlerts.length > 0 ? fuelAlerts : allAlerts

  return source
    .slice()
    .sort((a, b) => new Date(b.tao_luc || 0) - new Date(a.tao_luc || 0))
    .slice(0, 5)
})

// Danh sách năm có dữ liệu
const availableYears = computed(() => {
  const years = new Set()
  fuelData.value.forEach(f => {
    const dateField = f.thoi_gian_do || f.ngay_do
    if (dateField) {
      years.add(new Date(dateField).getFullYear())
    }
  })
  return Array.from(years).sort((a, b) => b - a) // Sắp xếp giảm dần
})

// Fetch all data from API
const fetchDashboardData = async () => {
  loading.value = true
  error.value = null
  try {
    const [vehicleRes, upcomingRes, alertRes, fuelRes] = await Promise.all([
      vehicleService.getAllWithDetails(),
      vehicleService.getUpcomingExpiries(30),
      alertService.getAll(),
      fuelService.getAll()
    ])
    vehicles.value = vehicleRes.data
    upcomingExpiries.value = upcomingRes.data?.items || []
    alertsData.value = alertRes.data
    fuelData.value = fuelRes.data

    const years = fuelData.value
      .map((f) => {
        const dateField = f.thoi_gian_do || f.ngay_do
        return dateField ? new Date(dateField).getFullYear() : null
      })
      .filter((y) => Number.isFinite(y))
      .sort((a, b) => b - a)

    if (years.length > 0 && !years.includes(selectedYear.value)) {
      selectedYear.value = years[0]
    }
  } catch (err) {
    let errMsg = 'Không thể tải dữ liệu dashboard. Vui lòng thử lại.'
    if (err && err.response && err.response.data && err.response.data.message) {
      errMsg += `\nAPI: ${err.response.data.message}`;
    } else if (err && err.message) {
      errMsg += `\n${err.message}`;
    }
    console.error('Error fetching dashboard data:', err)
    error.value = errMsg
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchDashboardData()
})

// KPI Data (computed from API data)
const kpiData = computed(() => {
  const total = vehicles.value.length
  const active = vehicles.value.filter(v => v.trang_thai === 'hoat_dong').length
  const maintenance = maintenanceVehicleCount.value
  const inactive = vehicles.value.filter(v => ['tam_dung', 'thanh_ly'].includes(v.trang_thai)).length
  
  return [
    {
      title: 'Tổng số xe',
      value: total,
      icon: 'mdi:truck',
      color: 'blue',
      change: `${total} xe`,
      changeType: 'neutral',
    },
    {
      title: 'Xe hoạt động',
      value: active,
      icon: 'mdi:check-circle',
      color: 'green',
      change: total > 0 ? `${((active/total)*100).toFixed(1)}%` : '0%',
      changeType: 'neutral',
    },
    {
      title: 'Xe cần bảo trì',
      value: maintenance,
      icon: 'mdi:alert-circle',
      color: 'yellow',
      change: `${maintenance} xe`,
      changeType: maintenance > 0 ? 'negative' : 'neutral',
    },
    {
      title: 'Xe ngừng hoạt động',
      value: inactive,
      icon: 'mdi:close-circle',
      color: 'red',
      change: `${inactive} xe`,
      changeType: inactive > 0 ? 'negative' : 'positive',
    },
  ]
})

// Fuel Trend Data (computed from API data)
const fuelTrendData = computed(() => {
  // Group fuel data by month, filter by selected year
  const monthlyData = {}
  fuelData.value.forEach(f => {
    // Sử dụng thoi_gian_do thay vì ngay_do
    const dateField = f.thoi_gian_do || f.ngay_do
    if (dateField) {
      const date = new Date(dateField)
      const year = date.getFullYear()
      // Chỉ lấy dữ liệu của năm được chọn
      if (year === selectedYear.value) {
        const month = date.getMonth()
        // Sử dụng tong_tien thay vì chi_phi
        const cost = f.tong_tien || f.chi_phi || 0
        monthlyData[month] = (monthlyData[month] || 0) + parseFloat(cost)
      }
    }
  })
  
  const months = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12']
  const data = months.map((_, i) => (monthlyData[i] || 0) / 1000000) // Convert to millions
  
  return {
    labels: months,
    datasets: [
      {
        label: 'Chi phí nhiên liệu (triệu đồng)',
        data,
        backgroundColor: '#FFB347',
        borderRadius: 6,
        borderSkipped: false,
      },
    ],
  }
})

const fuelTrendOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      grid: {
        color: '#f3f4f6',
      },
    },
    x: {
      grid: {
        display: false,
      },
    },
  },
}

// Fuel Cost Distribution (computed by vehicle type) - Horizontal Bar Chart
const fuelCostData = computed(() => {
  const typeGroups = {}
  
  fuelData.value.forEach(f => {
    const vehicle = vehicles.value.find(v => v.id === f.xe_id)
    const type = vehicle?.loai_xe_ten || 'Khác'
    const cost = parseFloat(f.tong_tien || f.chi_phi || 0)
    typeGroups[type] = (typeGroups[type] || 0) + cost
  })
  
  const labels = Object.keys(typeGroups).length > 0 ? Object.keys(typeGroups) : ['Chưa có dữ liệu']
  const data = Object.values(typeGroups).length > 0 ? Object.values(typeGroups).map(v => v/1000000) : [0]
  
  return {
    labels,
    datasets: [
      {
        label: 'Chi phí (triệu đồng)',
        data,
        backgroundColor: '#FBBF24',
        borderRadius: 4,
        borderSkipped: false,
      },
    ],
  }
})

const fuelCostOptions = {
  indexAxis: 'y',
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
    },
  },
  scales: {
    x: {
      beginAtZero: true,
      grid: {
        color: '#f3f4f6',
      },
    },
    y: {
      grid: {
        display: false,
      },
    },
  },
}

// Maintenance Schedule (computed from xe deadlines API)
const maintenanceSchedule = computed(() => {
  return upcomingExpiries.value
    .map(item => ({
      id: `${item.xe_id}-${item.loai_han}`,
      licensePlate: item.bien_so || 'N/A',
      vehicleType: item.loai_xe_ten || 'N/A',
      maintenanceType: item.loai_han_label || 'Bao tri',
      dueDate: item.due_date,
      daysLeft: item.days_left,
      status: item.muc_do_uu_tien === 'qua_han'
        ? 'urgent'
        : item.muc_do_uu_tien === 'sap_het_han'
          ? 'pending'
          : 'scheduled'
    }))
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 5)
})

const formatDate = (date) => {
  if (!date) return 'N/A'
  return new Date(date).toLocaleDateString('vi-VN')
}

const formatDateTime = (date) => {
  if (!date) return 'N/A'
  return new Date(date).toLocaleString('vi-VN')
}

const getAlertLevelClass = (level) => {
  if (level === 'nghiem_trong') return 'alert-critical'
  if (level === 'cao') return 'alert-high'
  if (level === 'trung_binh') return 'alert-medium'
  return 'alert-low'
}

const getAlertTypeText = (type) => {
  if (type === 'nhien_lieu_bat_thuong') return 'Nhien lieu bat thuong'
  return 'Canh bao he thong'
}

const getStatusClass = (status) => {
  switch (status) {
    case 'urgent':
      return 'status-urgent'
    case 'pending':
      return 'status-pending'
    case 'scheduled':
      return 'status-scheduled'
    default:
      return ''
  }
}

const getStatusText = (status) => {
  switch (status) {
    case 'urgent':
      return 'Cần xử lý gấp'
    case 'pending':
      return 'Đang chờ'
    case 'scheduled':
      return 'Đã lên lịch'
    default:
      return ''
  }
}

const getColorClass = (color) => {
  return `kpi-${color}`
}
</script>

<template>
  <div class="dashboard">
    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <Icon icon="mdi:loading" class="loading-icon" />
      <p>Đang tải dữ liệu...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <Icon icon="mdi:alert-circle" class="error-icon" />
      <p>{{ error }}</p>
      <button class="btn btn-primary" @click="fetchDashboardData">Thử lại</button>
    </div>

    <template v-else>
    <div class="dashboard-header">
      <div>
        <h1 class="page-title">Dashboard</h1>
        <p class="page-subtitle">Tổng quan hệ thống quản lý đội xe</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-secondary">
          <Icon icon="mdi:download" class="icon-sm" />
          Xuất báo cáo
        </button>
        <button class="btn btn-success" @click="fetchDashboardData">
          <Icon icon="mdi:refresh" class="icon-sm" />
          Làm mới
        </button>
      </div>
    </div>

    <!-- KPI Cards -->
    <div class="kpi-grid">
      <div v-for="kpi in kpiData" :key="kpi.title" class="kpi-card" :class="getColorClass(kpi.color)">
        <div class="kpi-icon">
          <Icon :icon="kpi.icon" class="icon-lg" />
        </div>
        <div class="kpi-content">
          <p class="kpi-title">{{ kpi.title }}</p>
          <p class="kpi-value">{{ kpi.value }}</p>
          <p class="kpi-change" :class="`change-${kpi.changeType}`">{{ kpi.change }}</p>
        </div>
      </div>
    </div>

    <!-- Charts Section -->
    <div class="charts-grid">
      <div class="chart-card">
        <div class="card-header">
          <h3>Xu hướng chi phí nhiên liệu</h3>
          <select class="select-year" v-model="selectedYear">
            <option v-for="year in availableYears" :key="year" :value="year">{{ year }}</option>
            <option v-if="availableYears.length === 0" :value="2025">2025</option>
          </select>
        </div>
        <div class="chart-container">
          <Bar :data="fuelTrendData" :options="fuelTrendOptions" />
        </div>
      </div>

      <div class="chart-card">
        <div class="card-header">
          <h3>Phân bổ chi phí nhiên liệu</h3>
        </div>
        <div class="chart-container-bar">
          <Bar :data="fuelCostData" :options="fuelCostOptions" />
        </div>
      </div>
    </div>

    <div class="table-card alerts-card">
      <div class="card-header">
        <h3>Canh bao gan day</h3>
        <RouterLink to="/alerts" class="link-view-all">
          Xem tat ca
          <Icon icon="mdi:arrow-right" class="icon-sm" />
        </RouterLink>
      </div>
      <div v-if="recentFuelAlerts.length > 0" class="alerts-list">
        <div v-for="item in recentFuelAlerts" :key="item.id" class="alert-item" :class="getAlertLevelClass(item.muc_do)">
          <div class="alert-main">
            <p class="alert-title">{{ item.tieu_de || 'Canh bao he thong' }}</p>
            <p class="alert-meta">{{ getAlertTypeText(item.loai_canh_bao) }} - {{ formatDateTime(item.tao_luc) }}</p>
          </div>
          <RouterLink to="/alerts" class="btn-icon" title="Xem canh bao">
            <Icon icon="mdi:open-in-new" class="icon-sm" />
          </RouterLink>
        </div>
      </div>
      <div v-else class="alerts-empty">
        <Icon icon="mdi:shield-check" class="icon-lg" />
        <p>Chua co canh bao nao trong he thong.</p>
      </div>
    </div>

    <!-- Maintenance Table -->
    <div class="table-card">
      <div class="card-header">
        <h3>Lịch bảo trì sắp tới</h3>
        <RouterLink to="/maintenance" class="link-view-all">
          Xem tất cả
          <Icon icon="mdi:arrow-right" class="icon-sm" />
        </RouterLink>
      </div>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Biển số xe</th>
              <th>Loại xe</th>
              <th>Loại bảo trì</th>
                <th>Ngay het han</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in maintenanceSchedule" :key="item.id">
              <td class="font-medium">{{ item.licensePlate }}</td>
              <td>{{ item.vehicleType }}</td>
              <td>{{ item.maintenanceType }}</td>
              <td>{{ formatDate(item.dueDate) }}</td>
              <td>
                <span class="status-badge" :class="getStatusClass(item.status)">
                  {{ getStatusText(item.status) }}
                </span>
              </td>
              <td>
                <RouterLink to="/maintenance" class="btn-icon" title="Xem chi tiet">
                  <Icon icon="mdi:eye" class="icon-sm" />
                </RouterLink>
                <RouterLink to="/maintenance" class="btn-icon" title="Xu ly ngay">
                  <Icon icon="mdi:wrench" class="icon-sm" />
                </RouterLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    </template>
  </div>
</template>

<style scoped>
.dashboard {
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
  color: #FFB347;
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

.dashboard-header {
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

.btn-success {
  background: linear-gradient(135deg, #10B981 0%, #34D399 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
}
.btn-success:hover {
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
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
.icon-lg {
  width: 1.5rem;
  height: 1.5rem;
}

/* KPI Cards - 30% yellow accents */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(1, 1fr);
  gap: 1rem;
  margin-bottom: 1.5rem;
}

@media (min-width: 640px) {
  .kpi-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1024px) {
  .kpi-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

.kpi-card {
  background: white;
  border-radius: 0.75rem;
  padding: 1.5rem;
  display: flex;
  gap: 1rem;
  border: 1px solid #e5e7eb;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  transition: all 0.2s ease;
}

.kpi-card:hover {
  border-color: #FFE5B4;
  box-shadow: 0 4px 12px rgba(255, 179, 71, 0.15);
}

.kpi-icon {
  width: 3rem;
  height: 3rem;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.kpi-blue .kpi-icon {
  background: #EBF5FF;
  color: #3B82F6;
}
.kpi-green .kpi-icon {
  background: #ECFDF5;
  color: #10B981;
}
.kpi-yellow .kpi-icon {
  background: #FFF8E7;
  color: #F59E0B;
}
.kpi-red .kpi-icon {
  background: #FEF2F2;
  color: #EF4444;
}

.kpi-content {
  flex: 1;
}

.kpi-title {
  font-size: 0.875rem;
  color: #6b7280;
  margin-bottom: 0.25rem;
}

.kpi-value {
  font-size: 1.875rem;
  font-weight: 700;
  color: #111827;
}

.kpi-change {
  font-size: 0.75rem;
  font-weight: 500;
  margin-top: 0.25rem;
}

.change-positive {
  color: #16a34a;
}
.change-negative {
  color: #dc2626;
}
.change-neutral {
  color: #6b7280;
}

/* Charts - with yellow accent borders */
.charts-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
  margin-bottom: 1.5rem;
}

@media (min-width: 1024px) {
  .charts-grid {
    grid-template-columns: 2fr 1fr;
  }
}

.chart-card,
.table-card {
  background: white;
  border-radius: 0.75rem;
  border: 1px solid #e5e7eb;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
}

.chart-card:hover,
.table-card:hover {
  border-color: #FFE5B4;
}

.alerts-card {
  margin-bottom: 1.5rem;
}

.alerts-list {
  display: grid;
  gap: 0.75rem;
  padding: 1rem 1.5rem 1.25rem;
}

.alert-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border: 1px solid #e5e7eb;
  border-left-width: 4px;
  border-radius: 0.5rem;
  padding: 0.75rem;
  background: #ffffff;
}

.alert-main {
  min-width: 0;
}

.alert-title {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: #111827;
}

.alert-meta {
  margin: 0.2rem 0 0;
  font-size: 0.75rem;
  color: #6b7280;
}

.alert-critical {
  border-left-color: #dc2626;
  background: #fef2f2;
}

.alert-high {
  border-left-color: #ea580c;
  background: #fff7ed;
}

.alert-medium {
  border-left-color: #d97706;
  background: #fffbeb;
}

.alert-low {
  border-left-color: #0ea5e9;
  background: #f0f9ff;
}

.alerts-empty {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #6b7280;
  padding: 1rem 1.5rem 1.25rem;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  background: #FFFDF7;
}

.card-header h3 {
  font-size: 1rem;
  font-weight: 600;
  color: #111827;
}

.select-year {
  padding: 0.375rem 0.75rem;
  border: 1px solid #FFE5B4;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  background: white;
}

.select-year:focus {
  outline: none;
  border-color: #FFB347;
  box-shadow: 0 0 0 2px rgba(255, 179, 71, 0.2);
}

.chart-container {
  padding: 1.5rem;
  height: 300px;
}

.chart-container-bar {
  padding: 1.5rem;
  height: 280px;
}

.chart-container-doughnut {
  padding: 1.5rem;
  height: 280px;
  display: flex;
  justify-content: center;
}

.link-view-all {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  color: #F59E0B;
  font-size: 0.875rem;
  font-weight: 500;
  text-decoration: none;
}
.link-view-all:hover {
  color: #D97706;
}

/* Table - 10% yellow accents */
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
  background: #FFFDF7;
  font-weight: 600;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #374151;
  border-bottom: 2px solid #FFE5B4;
}

td {
  font-size: 0.875rem;
  color: #374151;
  border-bottom: 1px solid #f3f4f6;
}

.font-medium {
  font-weight: 500;
  color: #111827;
}

tbody tr:hover {
  background: #FFFDF7;
}

/* Status Badge - 10% accent colors */
.status-badge {
  display: inline-flex;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
}

.status-urgent {
  background: #fef2f2;
  color: #dc2626;
}

.status-pending {
  background: #FFF8E7;
  color: #D97706;
}

.status-scheduled {
  background: #FFFBEB;
  color: #92400E;
}

/* Action Buttons - 10% accent */
.btn-icon {
  padding: 0.375rem;
  background: transparent;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  color: #6b7280;
  transition: all 0.15s ease;
}

.btn-icon:hover {
  background: #FFF8E7;
  color: #F59E0B;
}
</style>
