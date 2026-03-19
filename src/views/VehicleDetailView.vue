<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
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
import VehicleModal from '@/components/modals/VehicleModal.vue'
import MaintenanceModal from '@/components/modals/MaintenanceModal.vue'
import { vehicleService, maintenanceService, fuelService } from '@/services'

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale)

const route = useRoute()
const router = useRouter()

// State
const loading = ref(true)
const error = ref(null)

// Modal states
const showVehicleModal = ref(false)
const showMaintenanceModal = ref(false)

// Data from API
const vehicleData = ref({
  id: '',
  licensePlate: '',
  vehicleType: '',
  driver: '',
  registrationDate: '',
  status: '',
  phoneNumber: '',
  vin: '',
  engineNumber: '',
  color: '',
  year: 0,
})

const fuelData = ref({
  totalKm: 0,
  fuelCost: 0,
  fuelConsumption: 0,
  standardConsumption: 10.0,
})

const maintenanceData = ref({
  inspection: {
    title: 'Đăng kiểm',
    dueDate: '',
    daysRemaining: 0,
    icon: 'mdi:file-document-check',
  },
  insurance: {
    title: 'Bảo hiểm',
    dueDate: '',
    daysRemaining: 0,
    icon: 'mdi:shield-check',
  },
  tireChange: {
    title: 'Thay lốp xe',
    dueDate: '',
    daysRemaining: 0,
    icon: 'mdi:tire',
  },
})

const maintenanceHistory = ref([])
const vehicleFuelHistory = ref([])

// Fetch vehicle data from API
const fetchVehicleData = async () => {
  loading.value = true
  error.value = null
  try {
    const vehicleId = route.params.id
    
    // Fetch vehicle details
    const vehicleRes = await vehicleService.getById(vehicleId)
    const vehicle = vehicleRes.data
    
    vehicleData.value = {
      id: vehicle.id,
      licensePlate: vehicle.bien_so,
      vehicleType: `${vehicle.hang_xe || ''} ${vehicle.dong_xe || ''}`.trim() || 'Chưa xác định',
      driver: vehicle.tai_xe_ten || 'Chưa gán',
      registrationDate: formatDate(vehicle.tao_luc),
      status: vehicle.trang_thai === 'hoat_dong' ? 'active' : 'inactive',
      phoneNumber: vehicle.tai_xe_sdt || 'N/A',
      vin: vehicle.so_khung || 'N/A',
      engineNumber: vehicle.so_may || 'N/A',
      color: vehicle.mau_xe || 'N/A',
      year: vehicle.nam_san_xuat || 0,
    }
    
    // Fetch maintenance data
    const maintenanceRes = await maintenanceService.getByVehicleId(vehicleId)
    maintenanceHistory.value = maintenanceRes.data.map(m => ({
      id: m.id,
      date: formatDate(m.ngay_du_kien || m.ngay_hoan_thanh),
      type: m.loai_bao_tri_ten || 'Bảo trì',
      description: m.ghi_chu || '',
      cost: parseFloat(m.tong_chi_phi) || 0,
      status: m.trang_thai === 'hoan_thanh' ? 'completed' : 'pending'
    }))
    
    // Calculate maintenance schedule from vehicle data
    if (vehicle.han_dang_kiem) {
      const inspectionDate = new Date(vehicle.han_dang_kiem)
      const now = new Date()
      const daysDiff = Math.ceil((inspectionDate - now) / (1000 * 60 * 60 * 24))
      maintenanceData.value.inspection = {
        title: 'Đăng kiểm',
        dueDate: formatDate(vehicle.han_dang_kiem),
        daysRemaining: daysDiff,
        icon: 'mdi:file-document-check',
      }
    }
    
    if (vehicle.han_bao_hiem) {
      const insuranceDate = new Date(vehicle.han_bao_hiem)
      const now = new Date()
      const daysDiff = Math.ceil((insuranceDate - now) / (1000 * 60 * 60 * 24))
      maintenanceData.value.insurance = {
        title: 'Bảo hiểm',
        dueDate: formatDate(vehicle.han_bao_hiem),
        daysRemaining: daysDiff,
        icon: 'mdi:shield-check',
      }
    }

    if (vehicle.ngay_thay_lop) {
      const tireDate = new Date(vehicle.ngay_thay_lop)
      const now = new Date()
      // Tire change is past date, calculate next expected (assume 1 year cycle)
      const nextTireDate = new Date(tireDate)
      nextTireDate.setFullYear(nextTireDate.getFullYear() + 1)
      const daysDiff = Math.ceil((nextTireDate - now) / (1000 * 60 * 60 * 24))
      maintenanceData.value.tireChange = {
        title: 'Thay lốp xe',
        dueDate: formatDate(nextTireDate),
        daysRemaining: daysDiff,
        icon: 'mdi:tire',
      }
    }
    
    // Fetch fuel data
    const fuelRes = await fuelService.getByVehicleId(vehicleId)
    vehicleFuelHistory.value = fuelRes.data
    
    const totalLit = fuelRes.data.reduce((sum, f) => sum + parseFloat(f.so_lit || 0), 0)
    const totalKm = fuelRes.data.reduce((sum, f) => sum + parseFloat(f.quang_duong || 0), 0)
    const totalCost = fuelRes.data.reduce((sum, f) => sum + parseFloat(f.tong_tien || 0), 0)
    
    fuelData.value = {
      totalKm,
      fuelCost: totalCost,
      fuelConsumption: totalKm > 0 ? (totalLit / totalKm * 100).toFixed(1) : 0,
      standardConsumption: 10.0,
    }
    
  } catch (err) {
    console.error('Error fetching vehicle data:', err)
    error.value = 'Không thể tải thông tin xe. Vui lòng thử lại.'
  } finally {
    loading.value = false
  }
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('vi-VN')
}

onMounted(() => {
  fetchVehicleData()
})

// Fuel Chart Data (computed from API data)
const fuelChartData = computed(() => {
  // Group fuel data by month
  const monthlyData = {}
  vehicleFuelHistory.value.forEach(f => {
    if (f.ngay_do) {
      const month = new Date(f.ngay_do).getMonth()
      if (!monthlyData[month]) {
        monthlyData[month] = { totalLit: 0, totalKm: 0 }
      }
      monthlyData[month].totalLit += f.so_lit || 0
      monthlyData[month].totalKm += f.so_km || 0
    }
  })
  
  const months = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12']
  const actualData = months.map((_, i) => {
    if (monthlyData[i] && monthlyData[i].totalKm > 0) {
      return (monthlyData[i].totalLit / monthlyData[i].totalKm * 100).toFixed(1)
    }
    return 0
  })
  const standardData = months.map(() => fuelData.value.standardConsumption)
  
  return {
    labels: months,
    datasets: [
      {
        label: 'Tiêu hao thực tế (L/100km)',
        data: actualData,
        backgroundColor: '#FFB347',
        borderRadius: 4,
      },
      {
        label: 'Định mức (L/100km)',
        data: standardData,
        backgroundColor: '#10b981',
        borderRadius: 4,
      },
    ],
  }
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
    },
    x: {
      grid: {
        display: false,
      },
    },
  },
}

const getMaintenanceStatusClass = (days) => {
  if (days < 0) return 'status-overdue'
  if (days <= 14) return 'status-warning'
  return 'status-ok'
}

const getMaintenanceStatusText = (days) => {
  if (days < 0) return `Quá hạn ${Math.abs(days)} ngày`
  if (days <= 14) return `Còn ${days} ngày`
  return `Còn ${days} ngày`
}

const formatCurrency = (value) => {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(value)
}

const goBack = () => {
  router.push('/vehicles')
}

// Modal operations
const openEditModal = () => {
  showVehicleModal.value = true
}

const handleSaveVehicle = async (data) => {
  try {
    await vehicleService.update(vehicleData.value.id, {
      bien_so_xe: data.licensePlate,
      loai_xe: data.vehicleType,
      trang_thai: data.status === 'active' ? 'hoat_dong' : 'ngung_hoat_dong',
      so_vin: data.vin,
      so_may: data.engineNumber,
      mau_sac: data.color,
    })
    await fetchVehicleData()
    alert('Cập nhật thông tin xe thành công!')
  } catch (err) {
    console.error('Error updating vehicle:', err)
    alert('Có lỗi xảy ra khi cập nhật!')
  }
}

const openMaintenanceModal = () => {
  showMaintenanceModal.value = true
}

const handleSaveMaintenance = async (data) => {
  try {
    // Map maintenance type to ID
    const maintenanceTypeMap = {
      'inspection': 1,
      'insurance': 2,
      'tire-change': 5,
      'oil-change': 3,
      'brake-service': 6,
      'general': 4,
      'repair': 4,
      'ac-service': 8,
    }
    
    await maintenanceService.create({
      xe_id: vehicleData.value.id,
      loai_bao_tri_id: maintenanceTypeMap[data.maintenanceType] || 4,
      ngay_du_kien: data.scheduledDate,
      tong_chi_phi: data.estimatedCost || 0,
      don_vi_bao_tri: data.notes || '',
      trang_thai: 'len_lich',
      ghi_chu: data.description || '',
    })
    await fetchVehicleData()
    alert('Tạo lịch bảo trì thành công!')
  } catch (err) {
    console.error('Error creating maintenance:', err)
    alert('Có lỗi xảy ra khi tạo lịch bảo trì: ' + (err.response?.data?.message || err.message))
  }
}

const fuelVariance = computed(() => {
  const variance = ((fuelData.value.fuelConsumption - fuelData.value.standardConsumption) / fuelData.value.standardConsumption) * 100
  return variance.toFixed(1)
})
</script>

<template>
  <div class="vehicle-detail">
    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <Icon icon="mdi:loading" class="loading-icon" />
      <p>Đang tải dữ liệu...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <Icon icon="mdi:alert-circle" class="error-icon" />
      <p>{{ error }}</p>
      <button class="btn btn-primary" @click="fetchVehicleData">Thử lại</button>
    </div>

    <template v-else>
    <!-- Header -->
    <div class="page-header">
      <div class="header-left">
        <button class="btn-back" @click="goBack">
          <Icon icon="mdi:arrow-left" class="icon-md" />
        </button>
        <div>
          <h1 class="page-title">Chi Tiết Xe</h1>
          <p class="page-subtitle">{{ vehicleData.licensePlate }} - {{ vehicleData.vehicleType }}</p>
        </div>
      </div>
      <div class="header-actions">
        <button class="btn btn-secondary" @click="openEditModal">
          <Icon icon="mdi:pencil" class="icon-sm" />
          Chỉnh sửa
        </button>
        <button class="btn btn-primary" @click="openMaintenanceModal">
          <Icon icon="mdi:wrench" class="icon-sm" />
          Tạo lịch bảo trì
        </button>
      </div>
    </div>

    <div class="content-grid">
      <!-- Left Column -->
      <div class="left-column">
        <!-- Vehicle Info Card -->
        <div class="info-card">
          <div class="card-header">
            <h3>
              <Icon icon="mdi:car" class="icon-md" />
              Thông tin xe
            </h3>
            <span class="status-badge" :class="vehicleData.status === 'active' ? 'status-active' : 'status-inactive'">
              {{ vehicleData.status === 'active' ? 'Đang hoạt động' : 'Ngừng hoạt động' }}
            </span>
          </div>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Biển số xe</span>
              <span class="info-value license-plate">{{ vehicleData.licensePlate }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Loại xe</span>
              <span class="info-value">{{ vehicleData.vehicleType }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Tài xế phụ trách</span>
              <span class="info-value">{{ vehicleData.driver }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Số điện thoại</span>
              <span class="info-value">{{ vehicleData.phoneNumber }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Số VIN</span>
              <span class="info-value">{{ vehicleData.vin }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Số máy</span>
              <span class="info-value">{{ vehicleData.engineNumber }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Ngày đăng ký</span>
              <span class="info-value">{{ vehicleData.registrationDate }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Màu sắc</span>
              <span class="info-value">{{ vehicleData.color }}</span>
            </div>
          </div>
        </div>

        <!-- Fuel Statistics -->
        <div class="info-card">
          <div class="card-header">
            <h3>
              <Icon icon="mdi:fuel" class="icon-md" />
              Thống kê nhiên liệu
            </h3>
          </div>
          <div class="fuel-stats">
            <div class="fuel-stat">
              <div class="fuel-stat-icon blue">
                <Icon icon="mdi:road" class="icon-lg" />
              </div>
              <div>
                <p class="fuel-stat-value">{{ fuelData.totalKm.toLocaleString() }} km</p>
                <p class="fuel-stat-label">Tổng quãng đường</p>
              </div>
            </div>
            <div class="fuel-stat">
              <div class="fuel-stat-icon green">
                <Icon icon="mdi:currency-usd" class="icon-lg" />
              </div>
              <div>
                <p class="fuel-stat-value">{{ formatCurrency(fuelData.fuelCost) }}</p>
                <p class="fuel-stat-label">Chi phí nhiên liệu</p>
              </div>
            </div>
            <div class="fuel-stat">
              <div class="fuel-stat-icon yellow">
                <Icon icon="mdi:gauge" class="icon-lg" />
              </div>
              <div>
                <p class="fuel-stat-value">{{ fuelData.fuelConsumption }} L/100km</p>
                <p class="fuel-stat-label">Tiêu hao thực tế</p>
              </div>
            </div>
            <div class="fuel-stat">
              <div :class="['fuel-stat-icon', parseFloat(fuelVariance) > 0 ? 'red' : 'green']">
                <Icon icon="mdi:trending-up" class="icon-lg" />
              </div>
              <div>
                <p class="fuel-stat-value" :class="parseFloat(fuelVariance) > 0 ? 'text-red' : 'text-green'">
                  {{ fuelVariance > 0 ? '+' : '' }}{{ fuelVariance }}%
                </p>
                <p class="fuel-stat-label">So với định mức</p>
              </div>
            </div>
          </div>
          <div class="chart-container">
            <Bar :data="fuelChartData" :options="chartOptions" />
          </div>
        </div>
      </div>

      <!-- Right Column -->
      <div class="right-column">
        <!-- Maintenance Status -->
        <div class="info-card">
          <div class="card-header">
            <h3>
              <Icon icon="mdi:calendar-check" class="icon-md" />
              Tình trạng bảo trì
            </h3>
          </div>
          <div class="maintenance-items">
            <div
              v-for="(item, key) in maintenanceData"
              :key="key"
              class="maintenance-item"
              :class="getMaintenanceStatusClass(item.daysRemaining)"
            >
              <div class="maintenance-icon">
                <Icon :icon="item.icon" class="icon-lg" />
              </div>
              <div class="maintenance-info">
                <p class="maintenance-title">{{ item.title }}</p>
                <p class="maintenance-date">Hạn: {{ item.dueDate }}</p>
              </div>
              <div class="maintenance-status">
                <span class="maintenance-badge" :class="getMaintenanceStatusClass(item.daysRemaining)">
                  {{ getMaintenanceStatusText(item.daysRemaining) }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Maintenance History -->
        <div class="info-card">
          <div class="card-header">
            <h3>
              <Icon icon="mdi:history" class="icon-md" />
              Lịch sử bảo trì
            </h3>
            <button class="btn-link">Xem tất cả</button>
          </div>
          <div class="history-list">
            <div v-for="item in maintenanceHistory" :key="item.id" class="history-item">
              <div class="history-date">
                <Icon icon="mdi:calendar" class="icon-sm" />
                {{ item.date }}
              </div>
              <div class="history-content">
                <p class="history-type">{{ item.type }}</p>
                <p class="history-desc">{{ item.description }}</p>
              </div>
              <div class="history-cost">{{ formatCurrency(item.cost) }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </template>

    <!-- Edit Vehicle Modal -->
    <VehicleModal
      :show="showVehicleModal"
      mode="edit"
      :vehicle="vehicleData"
      @close="showVehicleModal = false"
      @save="handleSaveVehicle"
    />

    <!-- Maintenance Modal -->
    <MaintenanceModal
      :show="showMaintenanceModal"
      mode="add"
      :vehicles="[{ id: vehicleData.id, licensePlate: vehicleData.licensePlate, brand: vehicleData.vehicleType }]"
      @close="showMaintenanceModal = false"
      @save="handleSaveMaintenance"
    />
  </div>
</template>

<style scoped>
.vehicle-detail {
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

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.btn-back {
  padding: 0.5rem;
  border-radius: 0.5rem;
  border: 1px solid #d1d5db;
  background: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.btn-back:hover {
  background: #f3f4f6;
}

.page-title {
  font-size: 1.5rem;
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

.btn-link {
  background: none;
  border: none;
  color: #F59E0B;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
}
.btn-link:hover {
  color: #D97706;
}

.icon-sm {
  width: 1rem;
  height: 1rem;
}
.icon-md {
  width: 1.25rem;
  height: 1.25rem;
}
.icon-lg {
  width: 1.5rem;
  height: 1.5rem;
}

/* Layout */
.content-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
}

@media (min-width: 1024px) {
  .content-grid {
    grid-template-columns: 1fr 1fr;
  }
}

.left-column,
.right-column {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Cards */
.info-card {
  background: white;
  border-radius: 0.75rem;
  border: 1px solid #e5e7eb;
  overflow: hidden;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
}

.card-header h3 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  color: #111827;
}

/* Info Grid */
.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  padding: 1.5rem;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.info-label {
  font-size: 0.75rem;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.info-value {
  font-size: 0.875rem;
  font-weight: 500;
  color: #111827;
}

.license-plate {
  font-weight: 700;
  color: #111827;
  background: #f3f4f6;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  display: inline-block;
}

/* Status Badges */
.status-badge {
  display: inline-flex;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
}

.status-active {
  background: #dcfce7;
  color: #166534;
}

.status-inactive {
  background: #f3f4f6;
  color: #374151;
}

/* Fuel Stats */
.fuel-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  padding: 1.5rem;
}

.fuel-stat {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.fuel-stat-icon {
  width: 3rem;
  height: 3rem;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fuel-stat-icon.blue {
  background: #eff6ff;
  color: #2563eb;
}
.fuel-stat-icon.green {
  background: #f0fdf4;
  color: #16a34a;
}
.fuel-stat-icon.yellow {
  background: #fefce8;
  color: #ca8a04;
}
.fuel-stat-icon.red {
  background: #fef2f2;
  color: #dc2626;
}

.fuel-stat-value {
  font-size: 1.125rem;
  font-weight: 700;
  color: #111827;
}

.fuel-stat-label {
  font-size: 0.75rem;
  color: #6b7280;
}

.text-red {
  color: #dc2626 !important;
}
.text-green {
  color: #16a34a !important;
}

.chart-container {
  padding: 1.5rem;
  height: 250px;
  border-top: 1px solid #e5e7eb;
}

/* Maintenance Items */
.maintenance-items {
  padding: 1rem;
}

.maintenance-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border-radius: 0.5rem;
  margin-bottom: 0.5rem;
}

.maintenance-item.status-ok {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
}

.maintenance-item.status-warning {
  background: #fefce8;
  border: 1px solid #fef08a;
}

.maintenance-item.status-overdue {
  background: #fef2f2;
  border: 1px solid #fecaca;
}

.maintenance-icon {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
}

.status-ok .maintenance-icon {
  color: #16a34a;
}
.status-warning .maintenance-icon {
  color: #ca8a04;
}
.status-overdue .maintenance-icon {
  color: #dc2626;
}

.maintenance-info {
  flex: 1;
}

.maintenance-title {
  font-weight: 600;
  color: #111827;
}

.maintenance-date {
  font-size: 0.75rem;
  color: #6b7280;
}

.maintenance-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
}

.maintenance-badge.status-ok {
  background: #dcfce7;
  color: #166534;
}

.maintenance-badge.status-warning {
  background: #fef9c3;
  color: #854d0e;
}

.maintenance-badge.status-overdue {
  background: #fee2e2;
  color: #991b1b;
}

/* History */
.history-list {
  padding: 1rem;
}

.history-item {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 1rem;
  padding: 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.history-item:last-child {
  border-bottom: none;
}

.history-date {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: #6b7280;
  white-space: nowrap;
}

.history-type {
  font-weight: 600;
  color: #111827;
  margin-bottom: 0.25rem;
}

.history-desc {
  font-size: 0.875rem;
  color: #6b7280;
}

.history-cost {
  font-weight: 600;
  color: #111827;
  white-space: nowrap;
}
</style>
