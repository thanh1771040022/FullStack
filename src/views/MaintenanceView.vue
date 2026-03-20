<script setup>
import { ref, computed, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import MaintenanceModal from '@/components/modals/MaintenanceModal.vue'
import MaintenanceDetailModal from '@/components/modals/MaintenanceDetailModal.vue'
import ConfirmModal from '@/components/modals/ConfirmModal.vue'
import { maintenanceService, vehicleService } from '@/services'

// Loading & Error states
const loading = ref(false)
const error = ref(null)

// Modal states
const showMaintenanceModal = ref(false)
const maintenanceModalMode = ref('add')
const selectedMaintenance = ref(null)

// Detail modal state
const showDetailModal = ref(false)
const selectedVehicleForDetail = ref(null)

const showDeleteModal = ref(false)
const maintenanceToDelete = ref(null)

// Data from API
const maintenanceRecords = ref([])
const vehiclesList = ref([])

// Fetch maintenance data from API
const fetchMaintenanceData = async () => {
  loading.value = true
  error.value = null
  try {
    const [maintenanceRes, vehiclesRes] = await Promise.all([
      maintenanceService.getAll(),
      vehicleService.getAllWithDetails()
    ])
    
    maintenanceRecords.value = maintenanceRes.data
    // Map vehicles with dates from xe table
    vehiclesList.value = vehiclesRes.data.map(v => ({
      id: v.id,
      licensePlate: v.bien_so,
      brand: v.hang_xe || 'N/A',
      model: v.loai_xe_ten || '',
      // Lấy hạn từ bảng xe
      han_dang_kiem: v.han_dang_kiem,
      han_bao_hiem: v.han_bao_hiem,
      han_phi_duong_bo: v.han_phi_duong_bo,
      ngay_thay_lop: v.ngay_thay_lop,
    }))
  } catch (err) {
    error.value = 'Không thể tải dữ liệu bảo trì. Vui lòng thử lại!'
    console.error('Error fetching maintenance:', err)
  } finally {
    loading.value = false
  }
}

// Load data on mount
onMounted(() => {
  fetchMaintenanceData()
})

// Computed vehicles with maintenance dates (from xe table)
const vehicles = computed(() => {
  return vehiclesList.value.map(v => {
    // Keep true data from DB; do not synthesize default expiry dates
    const formatDate = (dateValue) => {
      if (!dateValue) return null
      const d = new Date(dateValue)
      if (Number.isNaN(d.getTime())) return null
      return d.toISOString().split('T')[0]
    }
    
    return {
      id: v.id,
      licensePlate: v.licensePlate,
      brand: v.brand,
      model: v.model,
      inspectionDate: formatDate(v.han_dang_kiem),
      insuranceDate: formatDate(v.han_bao_hiem),
      tireChangeDate: formatDate(v.ngay_thay_lop),
      // Keep original dates for update
      han_dang_kiem: v.han_dang_kiem,
      han_bao_hiem: v.han_bao_hiem,
      ngay_thay_lop: v.ngay_thay_lop,
    }
  })
})

const filterStatus = ref('all')
const searchTerm = ref('')

const getDaysRemaining = (dateStr) => {
  if (!dateStr) return null
  const today = new Date()
  const targetDate = new Date(dateStr)
  if (Number.isNaN(targetDate.getTime())) return null
  const diffTime = targetDate - today
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}

const getStatusText = (days) => {
  if (!Number.isFinite(days)) return 'Thieu du lieu han'
  if (days < 0) return `Quá hạn ${Math.abs(days)} ngày`
  if (days <= 14) return `Còn ${days} ngày`
  return `Còn ${days} ngày`
}

const getStatusBadgeClass = (days) => {
  if (!Number.isFinite(days)) return 'badge-missing'
  if (days < 0) return 'badge-danger'
  if (days <= 14) return 'badge-warning'
  return 'badge-success'
}

const stats = computed(() => {
  let overdue = 0
  let expiring = 0
  let ok = 0

  vehicles.value.forEach((v) => {
    const daysList = [
      getDaysRemaining(v.inspectionDate),
      getDaysRemaining(v.insuranceDate),
      getDaysRemaining(v.tireChangeDate),
    ].filter((days) => Number.isFinite(days))

    if (daysList.length === 0) {
      return
    }

    const minDays = Math.min(...daysList)

    if (minDays < 0) overdue++
    else if (minDays <= 14) expiring++
    else ok++
  })

  return { total: vehicles.value.length, overdue, expiring, ok }
})

const filteredVehicles = computed(() => {
  const search = searchTerm.value.toLowerCase().trim()
  
  return vehicles.value.filter((v) => {
    // Search filter - kiểm tra null/undefined
    const matchesSearch = search === '' || 
      String(v.licensePlate || '').toLowerCase().includes(search) ||
      String(v.brand || '').toLowerCase().includes(search) ||
      String(v.model || '').toLowerCase().includes(search)
    
    if (!matchesSearch) return false
    
    // Status filter
    if (filterStatus.value === 'all') return true
    
    const daysList = [
      getDaysRemaining(v.inspectionDate),
      getDaysRemaining(v.insuranceDate),
      getDaysRemaining(v.tireChangeDate),
    ].filter((days) => Number.isFinite(days))

    if (daysList.length === 0) {
      return false
    }

    const minDays = Math.min(...daysList)

    if (filterStatus.value === 'overdue') return minDays < 0
    if (filterStatus.value === 'expiring') return minDays >= 0 && minDays <= 14
    if (filterStatus.value === 'ok') return minDays > 14
    return true
  })
})

// CRUD Operations
const openAddModal = () => {
  maintenanceModalMode.value = 'add'
  selectedMaintenance.value = null
  showMaintenanceModal.value = true
}

// Open detail modal
const openDetailModal = (vehicle) => {
  selectedVehicleForDetail.value = vehicle
  showDetailModal.value = true
}

const openEditModal = (vehicle) => {
  maintenanceModalMode.value = 'edit'
  // Map vehicle data to maintenance format for modal
  selectedMaintenance.value = { 
    ...vehicle,
    vehicleId: vehicle.id,
    scheduledDate: vehicle.inspectionDate,
  }
  showMaintenanceModal.value = true
}

const handleSaveMaintenance = async (data) => {
  console.log('Saving maintenance data:', data)
  try {
    const resolvedVehicleId = resolveVehicleId(data)
    if (!resolvedVehicleId) {
      alert('Không tìm thấy xe tương ứng để lưu lịch bảo trì. Vui lòng chọn lại xe!')
      return
    }

    if (data.mode === 'add') {
      // Create maintenance record via API
      const payload = {
        xe_id: resolvedVehicleId,
        loai_bao_tri_id: getMaintenanceTypeId(data.maintenanceType),
        ngay_du_kien: data.scheduledDate,
        tong_chi_phi: data.estimatedCost || 0,
        don_vi_bao_tri: '',
        trang_thai: 'len_lich',
        ghi_chu: data.notes || data.description || '',
      }
      await maintenanceService.create(payload)
      
      // Also update vehicle dates based on maintenance type
      const vehicleUpdatePayload = {}
      if (data.maintenanceType === 'inspection') {
        vehicleUpdatePayload.han_dang_kiem = data.scheduledDate
      } else if (data.maintenanceType === 'insurance') {
        vehicleUpdatePayload.han_bao_hiem = data.scheduledDate
      } else if (data.maintenanceType === 'tire-change') {
        vehicleUpdatePayload.ngay_thay_lop = data.scheduledDate
      }
      
      if (Object.keys(vehicleUpdatePayload).length > 0) {
        await vehicleService.update(resolvedVehicleId, vehicleUpdatePayload)
      }
      
      alert('Thêm lịch bảo trì thành công!')
      fetchMaintenanceData()
    } else {
      // Update vehicle dates directly in xe table
      const vehicleId = resolvedVehicleId || selectedMaintenance.value.id
      const vehicleUpdatePayload = {}
      
      // Update based on maintenance type selected
      if (data.maintenanceType === 'inspection') {
        vehicleUpdatePayload.han_dang_kiem = data.scheduledDate
      } else if (data.maintenanceType === 'insurance') {
        vehicleUpdatePayload.han_bao_hiem = data.scheduledDate
      } else if (data.maintenanceType === 'tire-change') {
        vehicleUpdatePayload.ngay_thay_lop = data.scheduledDate
      }
      
      if (Object.keys(vehicleUpdatePayload).length > 0) {
        await vehicleService.update(vehicleId, vehicleUpdatePayload)
      }
      
      alert('Cập nhật thông tin thành công!')
      fetchMaintenanceData()
    }
  } catch (err) {
    console.error('Error saving maintenance:', err)
    alert('Có lỗi xảy ra: ' + (err.response?.data?.message || err.message))
  }
}

// Helper to map maintenance type to ID (based on loai_bao_tri table)
const getMaintenanceTypeId = (type) => {
  const typeMap = {
    'inspection': 1,      // Đăng kiểm
    'insurance': 2,       // Bảo hiểm TNDS
    'oil-change': 3,      // Thay dầu
    'general': 4,         // Bảo dưỡng định kỳ
    'tire-change': 5,     // Thay lốp
    'brake-service': 6,   // Thay má phanh
    'battery': 7,         // Thay ắc quy
    'ac-service': 8,      // Bảo dưỡng điều hòa
    'wheel-alignment': 9, // Cân chỉnh bánh xe
    'repair': 4,          // Default to general
  }
  return typeMap[type] || 4
}

const openDeleteModal = (vehicle) => {
  maintenanceToDelete.value = vehicle
  showDeleteModal.value = true
}

const resolveVehicleId = (data) => {
  if (data.vehicleId) return Number(data.vehicleId)

  const inputPlate = String(data.licensePlate || '').trim().toLowerCase()
  if (!inputPlate) return null

  const matched = vehiclesList.value.find(
    (v) => String(v.licensePlate || '').trim().toLowerCase() === inputPlate
  )
  return matched ? Number(matched.id) : null
}

const exportMaintenanceReport = () => {
  if (!filteredVehicles.value.length) {
    alert('Không có dữ liệu để xuất báo cáo!')
    return
  }

  const headers = ['Biển số', 'Xe', 'Hạn đăng kiểm', 'Hạn bảo hiểm', 'Hạn thay lốp']
  const rows = filteredVehicles.value.map((v) => [
    v.licensePlate,
    `${v.brand} ${v.model}`.trim(),
    v.inspectionDate || 'N/A',
    v.insuranceDate || 'N/A',
    v.tireChangeDate || 'N/A',
  ])

  const csvContent = [headers, ...rows]
    .map((line) => line.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'bao-cao-bao-tri.csv'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

const handleDeleteMaintenance = async () => {
  if (maintenanceToDelete.value) {
    try {
      // Chỉ xóa 1 lịch bảo trì gần nhất để tránh xóa toàn bộ lịch sử
      const vehicleMaintenances = maintenanceRecords.value.filter(
        m => m.xe_id === maintenanceToDelete.value.id
      )

      if (vehicleMaintenances.length === 0) {
        alert('Xe này chưa có lịch sử bảo trì để xóa.')
      } else {
        const target = vehicleMaintenances
          .slice()
          .sort((a, b) => new Date(b.ngay_du_kien || b.tao_luc || 0) - new Date(a.ngay_du_kien || a.tao_luc || 0))[0]

        await maintenanceService.delete(target.id)
        alert('Đã xóa 1 lịch bảo trì gần nhất thành công!')
      }

      fetchMaintenanceData()
    } catch (err) {
      alert('Có lỗi xảy ra: ' + (err.response?.data?.message || err.message))
    }
    maintenanceToDelete.value = null
  }
}
</script>

<template>
  <div class="maintenance-page">
    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <Icon icon="mdi:loading" class="loading-icon" />
      <p>Đang tải dữ liệu...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <Icon icon="mdi:alert-circle" class="error-icon" />
      <p>{{ error }}</p>
      <button class="btn btn-primary" @click="fetchMaintenanceData">Thử lại</button>
    </div>

    <template v-else>
      <!-- Header -->
      <div class="page-header">
        <div class="header-title">
          <div class="header-icon">
            <Icon icon="mdi:car-wrench" class="icon-xl" />
          </div>
          <div>
            <h1 class="page-title">Quản Lý Bảo Trì & Đăng Kiểm Đội Xe</h1>
            <p class="page-subtitle">Theo dõi hạn đăng kiểm, bảo hiểm và thay lốp</p>
          </div>
        </div>
        <div class="header-actions">
          <button class="btn btn-secondary" @click="exportMaintenanceReport">
            <Icon icon="mdi:download" class="icon-sm" />
            Xuất báo cáo
          </button>
          <button class="btn btn-primary" @click="openAddModal">
            <Icon icon="mdi:plus" class="icon-sm" />
            Thêm lịch bảo trì
          </button>
        </div>
      </div>

      <!-- Stats Cards -->
      <div class="stats-grid">
        <div class="stat-card stat-blue">
          <div class="stat-icon">
            <Icon icon="mdi:car" class="icon-lg" />
          </div>
          <div class="stat-content">
            <p class="stat-value">{{ stats.total }}</p>
            <p class="stat-label">Tổng số xe</p>
          </div>
        </div>
        <div class="stat-card stat-red">
          <div class="stat-icon">
            <Icon icon="mdi:alert-circle" class="icon-lg" />
          </div>
          <div class="stat-content">
            <p class="stat-value">{{ stats.overdue }}</p>
            <p class="stat-label">Quá hạn</p>
          </div>
        </div>
        <div class="stat-card stat-yellow">
          <div class="stat-icon">
            <Icon icon="mdi:alert" class="icon-lg" />
          </div>
          <div class="stat-content">
            <p class="stat-value">{{ stats.expiring }}</p>
            <p class="stat-label">Sắp hết hạn</p>
          </div>
        </div>
        <div class="stat-card stat-green">
          <div class="stat-icon">
            <Icon icon="mdi:check-circle" class="icon-lg" />
          </div>
          <div class="stat-content">
            <p class="stat-value">{{ stats.ok }}</p>
            <p class="stat-label">Bình thường</p>
          </div>
        </div>
    </div>

    <!-- Search and Filter -->
    <div class="filter-card">
      <div class="search-box">
        <Icon icon="mdi:magnify" class="search-icon" />
        <input
          v-model="searchTerm"
          type="text"
          placeholder="Tìm kiếm theo biển số, hãng xe..."
          class="search-input"
        />
      </div>
      <div class="filter-buttons">
        <button
          :class="['filter-btn', { active: filterStatus === 'all' }]"
          @click="filterStatus = 'all'"
        >
          Tất cả xe
        </button>
      <button
        :class="['filter-btn filter-red', { active: filterStatus === 'overdue' }]"
        @click="filterStatus = 'overdue'"
      >
        Quá hạn
      </button>
      <button
        :class="['filter-btn filter-yellow', { active: filterStatus === 'expiring' }]"
        @click="filterStatus = 'expiring'"
      >
        Sắp hết hạn
      </button>
      <button
        :class="['filter-btn filter-green', { active: filterStatus === 'ok' }]"
        @click="filterStatus = 'ok'"
      >
        Bình thường
      </button>
      </div>
    </div>

    <!-- Vehicle Table -->
    <div class="table-card">
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Biển số</th>
              <th>Xe</th>
              <th>
                <div class="th-content">
                  <Icon icon="mdi:file-document-check" class="icon-sm" />
                  Đăng kiểm
                </div>
              </th>
              <th>
                <div class="th-content">
                  <Icon icon="mdi:shield-check" class="icon-sm" />
                  Bảo hiểm
                </div>
              </th>
              <th>
                <div class="th-content">
                  <Icon icon="mdi:tire" class="icon-sm" />
                  Thay lốp
                </div>
              </th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="vehicle in filteredVehicles" :key="vehicle.id">
              <td>
                <div class="license-plate">{{ vehicle.licensePlate }}</div>
              </td>
              <td>
                <div class="vehicle-info">
                  <p class="vehicle-brand">{{ vehicle.brand }}</p>
                  <p class="vehicle-model">{{ vehicle.model }}</p>
                </div>
              </td>
              <td>
                <div class="date-cell">
                  <span class="date-value">{{ vehicle.inspectionDate || 'N/A' }}</span>
                  <span
                    class="status-badge"
                    :class="getStatusBadgeClass(getDaysRemaining(vehicle.inspectionDate))"
                  >
                    {{ getStatusText(getDaysRemaining(vehicle.inspectionDate)) }}
                  </span>
                </div>
              </td>
              <td>
                <div class="date-cell">
                  <span class="date-value">{{ vehicle.insuranceDate || 'N/A' }}</span>
                  <span
                    class="status-badge"
                    :class="getStatusBadgeClass(getDaysRemaining(vehicle.insuranceDate))"
                  >
                    {{ getStatusText(getDaysRemaining(vehicle.insuranceDate)) }}
                  </span>
                </div>
              </td>
              <td>
                <div class="date-cell">
                  <span class="date-value">{{ vehicle.tireChangeDate || 'N/A' }}</span>
                  <span
                    class="status-badge"
                    :class="getStatusBadgeClass(getDaysRemaining(vehicle.tireChangeDate))"
                  >
                    {{ getStatusText(getDaysRemaining(vehicle.tireChangeDate)) }}
                  </span>
                </div>
              </td>
              <td>
                <div class="action-buttons">
                  <button class="btn-icon" title="Xem chi tiết" @click="openDetailModal(vehicle)">
                    <Icon icon="mdi:eye" class="icon-sm" />
                  </button>
                  <button class="btn-icon" title="Cập nhật" @click="openEditModal(vehicle)">
                    <Icon icon="mdi:pencil" class="icon-sm" />
                  </button>
                  <button class="btn-icon btn-icon-danger" title="Xóa" @click="openDeleteModal(vehicle)">
                    <Icon icon="mdi:delete" class="icon-sm" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Empty State -->
      <div v-if="filteredVehicles.length === 0" class="empty-state">
        <Icon icon="mdi:car-off" class="empty-icon" />
        <p>Không có xe nào trong danh mục này</p>
      </div>
    </div>

    <!-- Legend -->
    <div class="legend-card">
      <h4>Chú thích:</h4>
      <div class="legend-items">
        <div class="legend-item">
          <span class="legend-dot red"></span>
          <span>Quá hạn - Cần xử lý ngay</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot yellow"></span>
          <span>Sắp hết hạn (≤14 ngày) - Cần lên kế hoạch</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot green"></span>
          <span>Bình thường (&gt;14 ngày) - Không cần xử lý</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot gray"></span>
          <span>Thiếu dữ liệu hạn - Cần bổ sung ngày</span>
        </div>
      </div>
    </div>
    </template>

    <!-- Maintenance Modal -->
    <MaintenanceModal
      :show="showMaintenanceModal"
      :mode="maintenanceModalMode"
      :maintenance="selectedMaintenance"
      :vehicles="vehicles"
      @close="showMaintenanceModal = false"
      @save="handleSaveMaintenance"
    />

    <!-- Maintenance Detail Modal -->
    <MaintenanceDetailModal
      :show="showDetailModal"
      :vehicle="selectedVehicleForDetail"
      :maintenanceRecords="maintenanceRecords"
      @close="showDetailModal = false"
    />

    <!-- Delete Confirmation Modal -->
    <ConfirmModal
      :show="showDeleteModal"
      title="Xác nhận xóa lịch bảo trì"
      :message="`Bạn có chắc chắn muốn xóa lịch bảo trì của xe ${maintenanceToDelete?.licensePlate || ''}? Hành động này không thể hoàn tác.`"
      confirm-text="Xóa"
      type="danger"
      @close="showDeleteModal = false"
      @confirm="handleDeleteMaintenance"
    />
  </div>
</template>

<style scoped>
.maintenance-page {
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

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.header-icon {
  width: 3.5rem;
  height: 3.5rem;
  background: linear-gradient(135deg, #FFB347 0%, #FFCC33 100%);
  border-radius: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  box-shadow: 0 4px 12px rgba(255, 179, 71, 0.3);
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

.btn-icon-danger:hover {
  background: #fef2f2;
  color: #dc2626;
}

.icon-sm {
  width: 1rem;
  height: 1rem;
}
.icon-lg {
  width: 1.5rem;
  height: 1.5rem;
}
.icon-xl {
  width: 2rem;
  height: 2rem;
}

/* Stats */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  margin-bottom: 1.5rem;
}

@media (min-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

.stat-card {
  background: white;
  border-radius: 0.75rem;
  padding: 1.25rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  border: 1px solid #e5e7eb;
}

.stat-icon {
  width: 3rem;
  height: 3rem;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-blue .stat-icon {
  background: #eff6ff;
  color: #2563eb;
}
.stat-red .stat-icon {
  background: #fef2f2;
  color: #dc2626;
}
.stat-yellow .stat-icon {
  background: #fefce8;
  color: #ca8a04;
}
.stat-green .stat-icon {
  background: #f0fdf4;
  color: #16a34a;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #111827;
}

.stat-label {
  font-size: 0.75rem;
  color: #6b7280;
}

/* Filter */
.filter-card {
  background: white;
  border-radius: 0.75rem;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1.5rem;
  border: 1px solid #e5e7eb;
}

.search-box {
  position: relative;
  flex: 1;
  min-width: 250px;
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

.filter-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.filter-btn {
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  background: #f3f4f6;
  color: #374151;
  border: none;
}

.filter-btn:hover {
  background: #e5e7eb;
}

.filter-btn.active {
  background: #2563eb;
  color: white;
}

.filter-btn.filter-red.active {
  background: #dc2626;
}

.filter-btn.filter-yellow.active {
  background: #ca8a04;
}

.filter-btn.filter-green.active {
  background: #16a34a;
}

/* Table */
.table-card {
  background: white;
  border-radius: 0.75rem;
  border: 1px solid #e5e7eb;
  margin-bottom: 1.5rem;
  overflow: hidden;
}

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

.th-content {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

td {
  font-size: 0.875rem;
  color: #374151;
  border-bottom: 1px solid #e5e7eb;
  vertical-align: middle;
}

tbody tr:hover {
  background: #f9fafb;
}

.license-plate {
  font-weight: 600;
  color: #111827;
  background: #f3f4f6;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  display: inline-block;
}

.vehicle-info {
  line-height: 1.3;
}

.vehicle-brand {
  font-weight: 500;
  color: #111827;
}

.vehicle-model {
  font-size: 0.75rem;
  color: #6b7280;
}

.date-cell {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.date-value {
  font-size: 0.875rem;
  color: #374151;
}

.status-badge {
  display: inline-flex;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.625rem;
  font-weight: 500;
  width: fit-content;
}

.badge-danger {
  background: #fee2e2;
  color: #991b1b;
}

.badge-warning {
  background: #fef9c3;
  color: #854d0e;
}

.badge-success {
  background: #dcfce7;
  color: #166534;
}

.badge-missing {
  background: #f3f4f6;
  color: #4b5563;
}

.action-buttons {
  display: flex;
  gap: 0.25rem;
}

/* Empty State */
.empty-state {
  padding: 3rem;
  text-align: center;
  color: #6b7280;
}

.empty-icon {
  width: 3rem;
  height: 3rem;
  margin: 0 auto 1rem;
  color: #9ca3af;
}

/* Legend */
.legend-card {
  background: white;
  border-radius: 0.75rem;
  padding: 1rem 1.5rem;
  border: 1px solid #e5e7eb;
}

.legend-card h4 {
  font-size: 0.875rem;
  font-weight: 600;
  color: #111827;
  margin-bottom: 0.75rem;
}

.legend-items {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: #4b5563;
}

.legend-dot {
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 50%;
}

.legend-dot.red {
  background: #dc2626;
}
.legend-dot.yellow {
  background: #ca8a04;
}
.legend-dot.green {
  background: #16a34a;
}
.legend-dot.gray {
  background: #6b7280;
}
</style>
