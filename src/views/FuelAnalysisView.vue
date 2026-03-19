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
import { fuelService, vehicleService } from '@/services'

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale)

// State
const fuelData = ref([])
const vehicles = ref([])
const loading = ref(true)
const error = ref(null)
const searchTerm = ref('')
const selectedMonth = ref('') // Format: YYYY-MM

const getMonthKey = (dateValue) => {
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return null
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

const formatMonthLabel = (monthKey) => {
  const [year, month] = monthKey.split('-')
  return `Thang ${month}/${year}`
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
  try {
    const [fuelResponse, vehicleResponse] = await Promise.all([
      fuelService.getAll(),
      vehicleService.getAllWithDetails()
    ])
    fuelData.value = fuelResponse.data
    vehicles.value = vehicleResponse.data

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
  
  const totalFuel = filteredFuelData.value.reduce((sum, item) => sum + (parseFloat(item.so_lit) || 0), 0)
  const totalFuelCost = filteredFuelData.value.reduce((sum, item) => sum + (parseFloat(item.tong_tien) || 0), 0)
  const totalDistance = filteredFuelData.value.reduce((sum, item) => sum + (parseFloat(item.quang_duong) || 0), 0)
  
  return {
    totalDistance: Math.round(totalDistance),
    totalFuelCost: Math.round(totalFuelCost),
    totalFuel: Math.round(totalFuel * 10) / 10,
    averageConsumption: totalDistance > 0 ? (totalFuel / totalDistance * 100).toFixed(2) : 0,
  }
})

// Chart Data (computed from filtered API data)
const chartData = computed(() => {
  const vehicleLabels = vehicles.value.slice(0, 8).map(v => v.bien_so)
  const standardData = vehicles.value.slice(0, 8).map(v => v.dinh_muc || 8.0)
  
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
      const standard = vehicle.dinh_muc || 8.0
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

const getStatusClass = (status) => {
  return status === 'danger' ? 'status-danger' : 'status-warning'
}

// Get current selected month label
const selectedMonthLabel = computed(() => {
  const found = monthOptions.value.find(m => m.value === selectedMonth.value)
  return found ? found.label : 'Chua co du lieu theo thang'
})

const hasAnyFuelData = computed(() => fuelData.value.length > 0)
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
        <button class="btn btn-secondary">
          <Icon icon="mdi:download" class="icon-sm" />
          Xuất báo cáo
        </button>
        <button class="btn btn-primary">
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
          <p class="summary-trend positive">
            <Icon icon="mdi:trending-up" class="icon-sm" />
            +12.5% so với tháng trước
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
          <p class="summary-trend negative">
            <Icon icon="mdi:trending-up" class="icon-sm" />
            +8.3% so với tháng trước
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
          <p class="summary-subtitle">Định mức: 8.4 L/100km</p>
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
          <option v-if="monthOptions.length === 0" value="">Khong co du lieu thang</option>
        </select>
      </div>
      <div class="chart-container">
        <Bar :data="chartData" :options="chartOptions" />
      </div>
    </div>

    <div v-if="!hasAnyFuelData" class="empty-state-card">
      <Icon icon="mdi:database-off" class="empty-icon" />
      <p>Chua co du lieu do nhien lieu de phan tich.</p>
    </div>

    <div v-else-if="filteredFuelData.length === 0" class="empty-state-card">
      <Icon icon="mdi:calendar-remove" class="empty-icon" />
      <p>Khong co du lieu trong thang da chon.</p>
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
                <button class="btn-icon" title="Xem chi tiết">
                  <Icon icon="mdi:eye" class="icon-sm" />
                </button>
                <button class="btn-icon" title="Kiểm tra xe">
                  <Icon icon="mdi:wrench" class="icon-sm" />
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
</style>
