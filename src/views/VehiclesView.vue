<script setup>
import { ref, computed, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import { useRouter } from 'vue-router'
import VehicleModal from '@/components/modals/VehicleModal.vue'
import ConfirmModal from '@/components/modals/ConfirmModal.vue'
import { vehicleService } from '@/services'
import api from '@/services/api'

const router = useRouter()

// Loading & Error states
const loading = ref(false)
const error = ref(null)

// Modal states
const showVehicleModal = ref(false)
const vehicleModalMode = ref('add')
const selectedVehicle = ref(null)

const showDeleteModal = ref(false)
const vehicleToDelete = ref(null)

// Data from API
const vehicles = ref([])
const vehicleTypes = ref([])
const drivers = ref([])

// Fetch vehicle types
const fetchVehicleTypes = async () => {
  try {
    const response = await api.get('/loai-xe')
    vehicleTypes.value = response.data
  } catch (err) {
    console.error('Error fetching vehicle types:', err)
  }
}

// Fetch drivers
const fetchDrivers = async () => {
  try {
    const response = await api.get('/tai-xe')
    drivers.value = response.data.filter(d => d.trang_thai === 'dang_lam')
  } catch (err) {
    console.error('Error fetching drivers:', err)
  }
}

// Fetch vehicles from API
const fetchVehicles = async () => {
  loading.value = true
  error.value = null
  try {
    const response = await vehicleService.getAllWithDetails()
    // Map API response to frontend format
    vehicles.value = response.data.map((item) => ({
      id: item.id,
      licensePlate: item.bien_so,
      driver: item.tai_xe_ten || 'Chưa phân công',
      phoneNumber: item.tai_xe_sdt || '',
      status: mapStatus(item.trang_thai),
      fuelConsumption: item.muc_tieu_hao || 0,
      maintenanceStatus: 'normal', // Will be calculated from maintenance table
      vehicleType: item.loai_xe_ten || 'Chưa xác định',
      brand: item.hang_xe || '',
      year: item.nam_san_xuat,
      color: item.mau_xe,
      vin: item.so_khung,
      engineNumber: item.so_may,
      loaiXeId: item.loai_xe_id,
      taiXeId: item.tai_xe_hien_tai,
      dongXe: item.dong_xe,
      dungTichBinh: item.dung_tich_binh,
      soKmHienTai: item.so_km_hien_tai,
      maGps: item.ma_gps,
      ghiChu: item.ghi_chu,
    }))
  } catch (err) {
    error.value = 'Không thể tải dữ liệu xe. Vui lòng thử lại!'
    console.error('Error fetching vehicles:', err)
  } finally {
    loading.value = false
  }
}

// Map status from DB to frontend
const mapStatus = (dbStatus) => {
  const statusMap = {
    hoat_dong: 'active',
    tam_dung: 'inactive',
    bao_duong: 'maintenance',
    thanh_ly: 'disposed',
  }
  return statusMap[dbStatus] || 'active'
}

// Map status from frontend to DB
const mapStatusToDB = (frontendStatus) => {
  const statusMap = {
    active: 'hoat_dong',
    inactive: 'tam_dung',
    maintenance: 'bao_duong',
    disposed: 'thanh_ly',
  }
  return statusMap[frontendStatus] || 'hoat_dong'
}

// Load data on mount
onMounted(() => {
  fetchVehicles()
  fetchVehicleTypes()
  fetchDrivers()
})

const searchTerm = ref('')
const statusFilter = ref('all')
const maintenanceFilter = ref('all')

const filteredVehicles = computed(() => {
  const search = searchTerm.value.toLowerCase().trim()
  
  return vehicles.value.filter((vehicle) => {
    // Search filter - kiểm tra null/undefined
    const matchesSearch = search === '' ||
      String(vehicle.id || '').toLowerCase().includes(search) ||
      String(vehicle.licensePlate || '').toLowerCase().includes(search) ||
      String(vehicle.driver || '').toLowerCase().includes(search) ||
      String(vehicle.brand || '').toLowerCase().includes(search) ||
      String(vehicle.vehicleType || '').toLowerCase().includes(search)

    const matchesStatus = statusFilter.value === 'all' || vehicle.status === statusFilter.value
    const matchesMaintenance =
      maintenanceFilter.value === 'all' || vehicle.maintenanceStatus === maintenanceFilter.value

    return matchesSearch && matchesStatus && matchesMaintenance
  })
})

const vehicleStatusMap = {
  active: 'Hoạt động',
  inactive: 'Không hoạt động',
  maintenance: 'Bảo trì',
}

const maintenanceStatusMap = {
  normal: 'Bình thường',
  warning: 'Cảnh báo',
  overdue: 'Quá hạn',
}

const getStatusClass = (status) => {
  switch (status) {
    case 'active':
      return 'status-active'
    case 'inactive':
      return 'status-inactive'
    case 'maintenance':
      return 'status-maintenance'
    default:
      return ''
  }
}

const getMaintenanceClass = (status) => {
  switch (status) {
    case 'normal':
      return 'maintenance-normal'
    case 'warning':
      return 'maintenance-warning'
    case 'overdue':
      return 'maintenance-overdue'
    default:
      return ''
  }
}

const viewVehicle = (id) => {
  router.push(`/vehicles/${id}`)
}

// CRUD Operations
const openAddModal = () => {
  vehicleModalMode.value = 'add'
  selectedVehicle.value = null
  showVehicleModal.value = true
}

const openEditModal = (vehicle) => {
  vehicleModalMode.value = 'edit'
  selectedVehicle.value = { ...vehicle }
  showVehicleModal.value = true
}

const handleSaveVehicle = async (data) => {
  console.log('Modal data received:', data)
  try {
    if (data.mode === 'add') {
      // Create vehicle via API
      const payload = {
        bien_so: data.licensePlate,
        loai_xe_id: data.loaiXeId,
        tai_xe_hien_tai: data.taiXeId || null,
        trang_thai: mapStatusToDB(data.status),
        nam_san_xuat: data.year,
        hang_xe: data.brand,
        dong_xe: data.dongXe || '',
        mau_xe: data.color,
        so_khung: data.vin,
        so_may: data.engineNumber,
        dung_tich_binh: data.dungTichBinh || null,
        so_km_hien_tai: data.soKmHienTai || 0,
        ma_gps: data.maGps || '',
        ghi_chu: data.ghiChu || '',
      }
      await vehicleService.create(payload)
      alert('Thêm xe mới thành công!')
      fetchVehicles() // Reload data
    } else {
      // Update vehicle via API
      const payload = {
        bien_so: data.licensePlate,
        loai_xe_id: data.loaiXeId || selectedVehicle.value.loaiXeId,
        tai_xe_hien_tai: data.taiXeId || null,
        trang_thai: mapStatusToDB(data.status),
        nam_san_xuat: data.year,
        hang_xe: data.brand,
        dong_xe: data.dongXe || '',
        mau_xe: data.color,
        so_khung: data.vin,
        so_may: data.engineNumber,
        dung_tich_binh: data.dungTichBinh || null,
        so_km_hien_tai: data.soKmHienTai || 0,
        ma_gps: data.maGps || '',
        ghi_chu: data.ghiChu || '',
      }
      await vehicleService.update(selectedVehicle.value.id, payload)
      alert('Cập nhật thông tin xe thành công!')
      fetchVehicles() // Reload data
    }
  } catch (err) {
    alert('Có lỗi xảy ra: ' + (err.response?.data?.message || err.message))
  }
}

const openDeleteModal = (vehicle) => {
  vehicleToDelete.value = vehicle
  showDeleteModal.value = true
}

const handleDeleteVehicle = async () => {
  if (vehicleToDelete.value) {
    try {
      await vehicleService.delete(vehicleToDelete.value.id)
      alert('Xóa xe thành công!')
      fetchVehicles() // Reload data
    } catch (err) {
      alert('Có lỗi xảy ra: ' + (err.response?.data?.message || err.message))
    }
    vehicleToDelete.value = null
  }
}

// Statistics
const stats = computed(() => ({
  total: vehicles.value.length,
  active: vehicles.value.filter((v) => v.status === 'active').length,
  inactive: vehicles.value.filter((v) => v.status === 'inactive').length,
  maintenance: vehicles.value.filter((v) => v.status === 'maintenance').length,
}))
</script>

<template>
  <div class="vehicles-page">
    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <Icon icon="mdi:loading" class="loading-icon" />
      <p>Đang tải dữ liệu...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <Icon icon="mdi:alert-circle" class="error-icon" />
      <p>{{ error }}</p>
      <button class="btn btn-primary" @click="fetchVehicles">Thử lại</button>
    </div>

    <template v-else>
      <!-- Header -->
      <div class="page-header">
        <div>
          <h1 class="page-title">Danh sách xe</h1>
          <p class="page-subtitle">Quản lý và theo dõi toàn bộ đội xe</p>
        </div>
        <button class="btn btn-primary" @click="openAddModal">
          <Icon icon="mdi:plus" class="icon-sm" />
          Thêm xe mới
        </button>
      </div>

      <!-- Stats -->
      <div class="stats-grid">
        <div class="stat-card stat-blue">
          <Icon icon="mdi:truck" class="stat-icon" />
          <div>
            <p class="stat-value">{{ stats.total }}</p>
            <p class="stat-label">Tổng số xe</p>
          </div>
        </div>
        <div class="stat-card stat-green">
          <Icon icon="mdi:check-circle" class="stat-icon" />
          <div>
            <p class="stat-value">{{ stats.active }}</p>
            <p class="stat-label">Đang hoạt động</p>
          </div>
        </div>
        <div class="stat-card stat-yellow">
          <Icon icon="mdi:wrench" class="stat-icon" />
          <div>
            <p class="stat-value">{{ stats.maintenance }}</p>
            <p class="stat-label">Đang bảo trì</p>
        </div>
      </div>
      <div class="stat-card stat-red">
        <Icon icon="mdi:close-circle" class="stat-icon" />
        <div>
          <p class="stat-value">{{ stats.inactive }}</p>
          <p class="stat-label">Ngừng hoạt động</p>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="filters-card">
      <div class="filters-grid">
        <div class="search-box">
          <Icon icon="mdi:magnify" class="search-icon" />
          <input
            v-model="searchTerm"
            type="text"
            placeholder="Tìm kiếm theo mã xe, biển số, tài xế..."
            class="search-input"
          />
        </div>
        <select v-model="statusFilter" class="filter-select">
          <option value="all">Tất cả trạng thái</option>
          <option value="active">Hoạt động</option>
          <option value="inactive">Không hoạt động</option>
          <option value="maintenance">Bảo trì</option>
        </select>
        <select v-model="maintenanceFilter" class="filter-select">
          <option value="all">Tất cả tình trạng</option>
          <option value="normal">Bình thường</option>
          <option value="warning">Cảnh báo</option>
          <option value="overdue">Quá hạn</option>
        </select>
      </div>
    </div>

    <!-- Vehicle Table -->
    <div class="table-card">
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Mã xe</th>
              <th>Biển số</th>
              <th>Loại xe</th>
              <th>Tài xế</th>
              <th>Trạng thái</th>
              <th>Tiêu hao NL</th>
              <th>Bảo trì</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="vehicle in filteredVehicles" :key="vehicle.id">
              <td class="font-medium">{{ vehicle.id }}</td>
              <td>
                <div class="license-plate">{{ vehicle.licensePlate }}</div>
              </td>
              <td>
                <div>
                  <p class="vehicle-type">{{ vehicle.vehicleType }}</p>
                  <p class="vehicle-brand">{{ vehicle.brand }}</p>
                </div>
              </td>
              <td>{{ vehicle.driver }}</td>
              <td>
                <span class="status-badge" :class="getStatusClass(vehicle.status)">
                  {{ vehicleStatusMap[vehicle.status] }}
                </span>
              </td>
              <td>{{ vehicle.fuelConsumption }} L/100km</td>
              <td>
                <span class="maintenance-badge" :class="getMaintenanceClass(vehicle.maintenanceStatus)">
                  {{ maintenanceStatusMap[vehicle.maintenanceStatus] }}
                </span>
              </td>
              <td>
                <div class="action-buttons">
                  <button class="btn-icon" title="Xem chi tiết" @click="viewVehicle(vehicle.id)">
                    <Icon icon="mdi:eye" class="icon-sm" />
                  </button>
                  <button class="btn-icon" title="Chỉnh sửa" @click="openEditModal(vehicle)">
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
        <p>Không tìm thấy xe nào phù hợp</p>
      </div>

      <!-- Pagination -->
      <div class="pagination">
        <p class="pagination-info">Hiển thị {{ filteredVehicles.length }} / {{ vehicles.length }} xe</p>
        <div class="pagination-buttons">
          <button class="btn btn-secondary" disabled>
            <Icon icon="mdi:chevron-left" class="icon-sm" />
            Trước
          </button>
          <button class="btn btn-secondary" disabled>
            Sau
            <Icon icon="mdi:chevron-right" class="icon-sm" />
          </button>
        </div>
      </div>
    </div>
    </template>

    <!-- Vehicle Modal -->
    <VehicleModal
      :show="showVehicleModal"
      :mode="vehicleModalMode"
      :vehicle="selectedVehicle"
      :vehicleTypes="vehicleTypes"
      :drivers="drivers"
      @close="showVehicleModal = false"
      @save="handleSaveVehicle"
    />

    <!-- Delete Confirmation Modal -->
    <ConfirmModal
      :show="showDeleteModal"
      title="Xác nhận xóa xe"
      :message="`Bạn có chắc chắn muốn xóa xe ${vehicleToDelete?.licensePlate || ''}? Hành động này không thể hoàn tác.`"
      confirm-text="Xóa xe"
      type="danger"
      @close="showDeleteModal = false"
      @confirm="handleDeleteVehicle"
    />
  </div>
</template>

<style scoped>
.vehicles-page {
  max-width: 1400px;
  margin: 0 auto;
}

/* Loading & Error States */
.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem;
  text-align: center;
  color: #6b7280;
}

.loading-icon {
  width: 3rem;
  height: 3rem;
  animation: spin 1s linear infinite;
  color: #2563eb;
  margin-bottom: 1rem;
}

.error-icon {
  width: 3rem;
  height: 3rem;
  color: #dc2626;
  margin-bottom: 1rem;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
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
.btn-secondary:hover:not(:disabled) {
  background: #f9fafb;
}
.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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
  padding: 1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  border: 1px solid #e5e7eb;
}

.stat-icon {
  width: 2.5rem;
  height: 2.5rem;
  padding: 0.5rem;
  border-radius: 0.5rem;
}

.stat-blue .stat-icon {
  background: #eff6ff;
  color: #2563eb;
}
.stat-green .stat-icon {
  background: #f0fdf4;
  color: #16a34a;
}
.stat-yellow .stat-icon {
  background: #fefce8;
  color: #ca8a04;
}
.stat-red .stat-icon {
  background: #fef2f2;
  color: #dc2626;
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

/* Filters */
.filters-card {
  background: white;
  border-radius: 0.75rem;
  padding: 1rem;
  margin-bottom: 1.5rem;
  border: 1px solid #e5e7eb;
}

.filters-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

@media (min-width: 768px) {
  .filters-grid {
    grid-template-columns: 2fr 1fr 1fr;
  }
}

.search-box {
  position: relative;
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
  border-color: #FFB347;
  box-shadow: 0 0 0 2px rgba(255, 179, 71, 0.2);
}

.filter-select {
  padding: 0.5rem 2rem 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  background: white;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E");
  background-position: right 0.5rem center;
  background-repeat: no-repeat;
  background-size: 1.5em 1.5em;
}
.filter-select:focus {
  outline: none;
  border-color: #FFB347;
  box-shadow: 0 0 0 2px rgba(255, 179, 71, 0.2);
}

/* Table */
.table-card {
  background: white;
  border-radius: 0.75rem;
  border: 1px solid #e5e7eb;
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

.license-plate {
  font-weight: 600;
  color: #111827;
  background: #f3f4f6;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  display: inline-block;
}

.vehicle-type {
  font-weight: 500;
  color: #111827;
}

.vehicle-brand {
  font-size: 0.75rem;
  color: #6b7280;
}

/* Status Badges */
.status-badge,
.maintenance-badge {
  display: inline-flex;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
}

.status-active {
  background: #dbeafe;
  color: #1e40af;
}

.status-inactive {
  background: #f3f4f6;
  color: #374151;
}

.status-maintenance {
  background: #ffedd5;
  color: #9a3412;
}

.maintenance-normal {
  background: #dcfce7;
  color: #166534;
}

.maintenance-warning {
  background: #fef9c3;
  color: #854d0e;
}

.maintenance-overdue {
  background: #fee2e2;
  color: #991b1b;
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

/* Pagination */
.pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-top: 1px solid #e5e7eb;
  flex-wrap: wrap;
  gap: 1rem;
}

.pagination-info {
  font-size: 0.875rem;
  color: #6b7280;
}

.pagination-buttons {
  display: flex;
  gap: 0.5rem;
}
</style>
