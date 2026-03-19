<script setup>
import { ref, computed, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import { alertService } from '@/services'

// State
const alerts = ref([])
const loading = ref(true)
const error = ref(null)

const selectedTypes = ref([])
const selectedSeverities = ref([])
const searchTerm = ref('')

// Modal state
const showDetailModal = ref(false)
const selectedAlert = ref(null)

// Fetch alerts from API
const fetchAlerts = async () => {
  loading.value = true
  error.value = null
  try {
    const response = await alertService.getAll()
    alerts.value = response.data.map(alert => ({
      id: alert.id,
      vehicleId: alert.xe_id,
      vehicleName: alert.bien_so ? `Xe ${alert.bien_so}` : (alert.xe_id ? `Xe #${alert.xe_id}` : 'Hệ thống'),
      type: mapAlertType(alert.loai_canh_bao),
      severity: mapSeverity(alert.muc_do),
      message: alert.noi_dung,
      details: alert.tieu_de || '',
      date: formatDate(alert.tao_luc),
      isRead: alert.da_doc === 1
    }))
  } catch (err) {
    console.error('Error fetching alerts:', err)
    error.value = 'Không thể tải dữ liệu cảnh báo. Vui lòng thử lại.'
  } finally {
    loading.value = false
  }
}

// Map alert type from DB to UI
const mapAlertType = (type) => {
  const typeMap = {
    'nhien_lieu_bat_thuong': 'fuel',
    'sap_het_han_dang_kiem': 'inspection',
    'sap_het_han_bao_hiem': 'insurance',
    'den_han_bao_tri': 'maintenance',
    'qua_han': 'maintenance',
    'he_thong': 'system'
  }
  return typeMap[type] || type
}

// Map severity from DB to UI
const mapSeverity = (severity) => {
  const severityMap = {
    'nghiem_trong': 'high',
    'cao': 'high',
    'trung_binh': 'medium',
    'thap': 'low'
  }
  return severityMap[severity] || severity
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('vi-VN')
}

onMounted(() => {
  fetchAlerts()
})

const alertTypes = [
  { value: 'fuel', label: 'Nhiên liệu', icon: 'mdi:fuel' },
  { value: 'inspection', label: 'Đăng kiểm', icon: 'mdi:file-document-check' },
  { value: 'insurance', label: 'Bảo hiểm', icon: 'mdi:shield-check' },
  { value: 'maintenance', label: 'Bảo trì', icon: 'mdi:wrench' },
  { value: 'system', label: 'Hệ thống', icon: 'mdi:cog' },
]

const severityLevels = [
  { value: 'high', label: 'Nghiêm trọng', color: 'red' },
  { value: 'medium', label: 'Cảnh báo', color: 'yellow' },
  { value: 'low', label: 'Thông tin', color: 'blue' },
]

const filteredAlerts = computed(() => {
  const search = searchTerm.value.toLowerCase().trim()
  
  return alerts.value.filter((alert) => {
    // Search filter - kiểm tra null/undefined
    const matchesSearch = search === '' || 
      String(alert.vehicleName || '').toLowerCase().includes(search) ||
      String(alert.message || '').toLowerCase().includes(search) ||
      String(alert.details || '').toLowerCase().includes(search)
    
    const typeMatch = selectedTypes.value.length === 0 || selectedTypes.value.includes(alert.type)
    const severityMatch = selectedSeverities.value.length === 0 || selectedSeverities.value.includes(alert.severity)
    return matchesSearch && typeMatch && severityMatch
  })
})

const stats = computed(() => ({
  total: alerts.value.length,
  unread: alerts.value.filter((a) => !a.isRead).length,
  high: alerts.value.filter((a) => a.severity === 'high').length,
  medium: alerts.value.filter((a) => a.severity === 'medium').length,
  low: alerts.value.filter((a) => a.severity === 'low').length,
}))

const toggleType = (type) => {
  const index = selectedTypes.value.indexOf(type)
  if (index > -1) {
    selectedTypes.value.splice(index, 1)
  } else {
    selectedTypes.value.push(type)
  }
}

const toggleSeverity = (severity) => {
  const index = selectedSeverities.value.indexOf(severity)
  if (index > -1) {
    selectedSeverities.value.splice(index, 1)
  } else {
    selectedSeverities.value.push(severity)
  }
}

const getAlertTypeIcon = (type) => {
  const found = alertTypes.find((t) => t.value === type)
  return found ? found.icon : 'mdi:alert'
}

const getAlertTypeLabel = (type) => {
  const found = alertTypes.find((t) => t.value === type)
  return found ? found.label : type
}

const getSeverityClass = (severity) => {
  return `severity-${severity}`
}

const markAsRead = async (alertId) => {
  try {
    await alertService.markAsRead(alertId)
    const alert = alerts.value.find((a) => a.id === alertId)
    if (alert) {
      alert.isRead = true
    }
  } catch (err) {
    console.error('Error marking alert as read:', err)
  }
}

const markAllAsRead = async () => {
  try {
    await alertService.markAllAsRead()
    alerts.value.forEach((alert) => {
      alert.isRead = true
    })
  } catch (err) {
    console.error('Error marking all alerts as read:', err)
  }
}

const deleteAlert = async (alertId) => {
  if (!confirm('Bạn có chắc muốn xóa cảnh báo này?')) return
  try {
    await alertService.delete(alertId)
    const index = alerts.value.findIndex((a) => a.id === alertId)
    if (index > -1) {
      alerts.value.splice(index, 1)
    }
  } catch (err) {
    console.error('Error deleting alert:', err)
    alert('Xóa cảnh báo thất bại!')
  }
}

const viewDetail = (alert) => {
  selectedAlert.value = alert
  showDetailModal.value = true
  // Đánh dấu đã đọc khi xem chi tiết
  if (!alert.isRead) {
    markAsRead(alert.id)
  }
}

const closeDetailModal = () => {
  showDetailModal.value = false
  selectedAlert.value = null
}
</script>

<template>
  <div class="alerts-page">
    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <Icon icon="mdi:loading" class="loading-icon" />
      <p>Đang tải dữ liệu...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <Icon icon="mdi:alert-circle" class="error-icon" />
      <p>{{ error }}</p>
      <button class="btn btn-primary" @click="fetchAlerts">Thử lại</button>
    </div>

    <template v-else>
    <!-- Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Cảnh báo và Thông báo</h1>
        <p class="page-subtitle">Theo dõi các cảnh báo về đội xe</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-secondary" @click="markAllAsRead">
          <Icon icon="mdi:check-all" class="icon-sm" />
          Đánh dấu tất cả đã đọc
        </button>
      </div>
    </div>

    <!-- Stats Cards -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon stat-icon-blue">
          <Icon icon="mdi:bell" class="icon-lg" />
        </div>
        <div>
          <p class="stat-value">{{ stats.total }}</p>
          <p class="stat-label">Tổng cảnh báo</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon stat-icon-purple">
          <Icon icon="mdi:bell-badge" class="icon-lg" />
        </div>
        <div>
          <p class="stat-value">{{ stats.unread }}</p>
          <p class="stat-label">Chưa đọc</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon stat-icon-red">
          <Icon icon="mdi:alert-circle" class="icon-lg" />
        </div>
        <div>
          <p class="stat-value">{{ stats.high }}</p>
          <p class="stat-label">Nghiêm trọng</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon stat-icon-yellow">
          <Icon icon="mdi:alert" class="icon-lg" />
        </div>
        <div>
          <p class="stat-value">{{ stats.medium }}</p>
          <p class="stat-label">Cảnh báo</p>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="filters-card">
      <!-- Search box -->
      <div class="filter-section">
        <div class="search-box">
          <Icon icon="mdi:magnify" class="search-icon" />
          <input
            v-model="searchTerm"
            type="text"
            placeholder="Tìm kiếm theo xe, nội dung cảnh báo..."
            class="search-input"
          />
        </div>
      </div>
      <div class="filter-section">
        <h4 class="filter-title">Loại cảnh báo:</h4>
        <div class="filter-buttons">
          <button
            v-for="type in alertTypes"
            :key="type.value"
            :class="['filter-btn', { active: selectedTypes.includes(type.value) }]"
            @click="toggleType(type.value)"
          >
            <Icon :icon="type.icon" class="icon-sm" />
            {{ type.label }}
          </button>
        </div>
      </div>
      <div class="filter-section">
        <h4 class="filter-title">Mức độ:</h4>
        <div class="filter-buttons">
          <button
            v-for="severity in severityLevels"
            :key="severity.value"
            :class="['filter-btn', `filter-${severity.color}`, { active: selectedSeverities.includes(severity.value) }]"
            @click="toggleSeverity(severity.value)"
          >
            {{ severity.label }}
          </button>
        </div>
      </div>
    </div>

    <!-- Alerts List -->
    <div class="alerts-list">
      <div
        v-for="alert in filteredAlerts"
        :key="alert.id"
        :class="['alert-card', getSeverityClass(alert.severity), { unread: !alert.isRead }]"
      >
        <div class="alert-icon" :class="getSeverityClass(alert.severity)">
          <Icon :icon="getAlertTypeIcon(alert.type)" class="icon-lg" />
        </div>
        <div class="alert-content">
          <div class="alert-header">
            <span class="alert-vehicle">{{ alert.vehicleName }}</span>
            <span class="alert-type-badge">{{ getAlertTypeLabel(alert.type) }}</span>
          </div>
          <h4 class="alert-message">{{ alert.message }}</h4>
          <p class="alert-details">{{ alert.details }}</p>
          <div class="alert-footer">
            <span class="alert-date">
              <Icon icon="mdi:clock" class="icon-sm" />
              {{ alert.date }}
            </span>
            <span v-if="!alert.isRead" class="unread-badge">Mới</span>
          </div>
        </div>
        <div class="alert-actions">
          <button v-if="!alert.isRead" class="btn-icon" title="Đánh dấu đã đọc" @click="markAsRead(alert.id)">
            <Icon icon="mdi:check" class="icon-sm" />
          </button>
          <button class="btn-icon" title="Xem chi tiết" @click="viewDetail(alert)">
            <Icon icon="mdi:eye" class="icon-sm" />
          </button>
          <button class="btn-icon btn-icon-danger" title="Xóa" @click="deleteAlert(alert.id)">
            <Icon icon="mdi:delete" class="icon-sm" />
          </button>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="filteredAlerts.length === 0" class="empty-state">
        <Icon icon="mdi:bell-off" class="empty-icon" />
        <p>Không có cảnh báo nào phù hợp</p>
      </div>
    </div>
    </template>

    <!-- Detail Modal -->
    <div v-if="showDetailModal" class="modal-overlay" @click.self="closeDetailModal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Chi tiết cảnh báo</h3>
          <button class="btn-close" @click="closeDetailModal">
            <Icon icon="mdi:close" class="icon-md" />
          </button>
        </div>
        <div v-if="selectedAlert" class="modal-body">
          <div class="detail-row">
            <div class="detail-icon" :class="getSeverityClass(selectedAlert.severity)">
              <Icon :icon="getAlertTypeIcon(selectedAlert.type)" class="icon-xl" />
            </div>
            <div class="detail-info">
              <span class="detail-label">Xe:</span>
              <span class="detail-value">{{ selectedAlert.vehicleName }}</span>
            </div>
          </div>
          
          <div class="detail-section">
            <div class="detail-item">
              <span class="detail-label">Loại cảnh báo:</span>
              <span class="alert-type-badge">{{ getAlertTypeLabel(selectedAlert.type) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Mức độ:</span>
              <span :class="['severity-badge', getSeverityClass(selectedAlert.severity)]">
                {{ selectedAlert.severity === 'high' ? 'Nghiêm trọng' : selectedAlert.severity === 'medium' ? 'Cảnh báo' : 'Thông tin' }}
              </span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Ngày tạo:</span>
              <span class="detail-value">{{ selectedAlert.date }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Trạng thái:</span>
              <span :class="['status-badge', selectedAlert.isRead ? 'read' : 'unread']">
                {{ selectedAlert.isRead ? 'Đã đọc' : 'Chưa đọc' }}
              </span>
            </div>
          </div>

          <div class="detail-section">
            <span class="detail-label">Nội dung:</span>
            <p class="detail-message">{{ selectedAlert.message }}</p>
          </div>

          <div v-if="selectedAlert.details" class="detail-section">
            <span class="detail-label">Chi tiết:</span>
            <p class="detail-description">{{ selectedAlert.details }}</p>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeDetailModal">Đóng</button>
          <button 
            v-if="!selectedAlert?.isRead" 
            class="btn btn-primary" 
            @click="markAsRead(selectedAlert.id); closeDetailModal()"
          >
            Đánh dấu đã đọc
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.alerts-page {
  max-width: 1200px;
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

.btn-primary {
  background: linear-gradient(135deg, #FFB347 0%, #FFCC33 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(255, 179, 71, 0.3);
}
.btn-primary:hover {
  box-shadow: 0 4px 12px rgba(255, 179, 71, 0.4);
  transform: translateY(-1px);
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
  width: 3rem;
  height: 3rem;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-icon-blue {
  background: #eff6ff;
  color: #2563eb;
}
.stat-icon-purple {
  background: #f3e8ff;
  color: #9333ea;
}
.stat-icon-red {
  background: #fef2f2;
  color: #dc2626;
}
.stat-icon-yellow {
  background: #fefce8;
  color: #ca8a04;
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
  padding: 1rem 1.5rem;
  margin-bottom: 1.5rem;
  border: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

@media (min-width: 768px) {
  .filters-card {
    flex-direction: row;
    align-items: center;
    flex-wrap: wrap;
  }
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

.filter-section {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.filter-title {
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  white-space: nowrap;
}

.filter-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.filter-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  background: #f3f4f6;
  color: #374151;
  border: 1px solid transparent;
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

.filter-btn.filter-blue.active {
  background: #2563eb;
}

/* Alerts List */
.alerts-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.alert-card {
  background: white;
  border-radius: 0.75rem;
  padding: 1rem 1.5rem;
  display: flex;
  gap: 1rem;
  border: 1px solid #e5e7eb;
  transition: all 0.15s ease;
}

.alert-card:hover {
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.alert-card.unread {
  background: #fefce8;
  border-color: #fef08a;
}

.alert-icon {
  width: 3rem;
  height: 3rem;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.alert-icon.severity-high {
  background: #fef2f2;
  color: #dc2626;
}

.alert-icon.severity-medium {
  background: #fefce8;
  color: #ca8a04;
}

.alert-icon.severity-low {
  background: #eff6ff;
  color: #2563eb;
}

.alert-content {
  flex: 1;
  min-width: 0;
}

.alert-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.alert-vehicle {
  font-size: 0.875rem;
  font-weight: 600;
  color: #111827;
}

.alert-type-badge {
  font-size: 0.625rem;
  font-weight: 500;
  padding: 0.125rem 0.5rem;
  background: #f3f4f6;
  color: #6b7280;
  border-radius: 9999px;
  text-transform: uppercase;
}

.alert-message {
  font-size: 1rem;
  font-weight: 600;
  color: #111827;
  margin-bottom: 0.25rem;
}

.alert-details {
  font-size: 0.875rem;
  color: #6b7280;
  margin-bottom: 0.5rem;
}

.alert-footer {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.alert-date {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: #9ca3af;
}

.unread-badge {
  font-size: 0.625rem;
  font-weight: 600;
  padding: 0.125rem 0.5rem;
  background: #dc2626;
  color: white;
  border-radius: 9999px;
}

.alert-actions {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

/* Empty State */
.empty-state {
  padding: 3rem;
  text-align: center;
  color: #6b7280;
  background: white;
  border-radius: 0.75rem;
  border: 1px solid #e5e7eb;
}

.empty-icon {
  width: 3rem;
  height: 3rem;
  margin: 0 auto 1rem;
  color: #9ca3af;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal-content {
  background: white;
  border-radius: 0.75rem;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #111827;
}

.btn-close {
  background: none;
  border: none;
  cursor: pointer;
  color: #6b7280;
  padding: 0.25rem;
  border-radius: 0.25rem;
}

.btn-close:hover {
  background: #f3f4f6;
  color: #111827;
}

.modal-body {
  padding: 1.5rem;
}

.detail-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.detail-icon {
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.detail-icon.severity-high {
  background: #fef2f2;
  color: #dc2626;
}

.detail-icon.severity-medium {
  background: #fefce8;
  color: #ca8a04;
}

.detail-icon.severity-low {
  background: #eff6ff;
  color: #2563eb;
}

.icon-xl {
  width: 2rem;
  height: 2rem;
}

.detail-info {
  flex: 1;
}

.detail-section {
  margin-bottom: 1rem;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px dashed #e5e7eb;
}

.detail-label {
  font-size: 0.875rem;
  color: #6b7280;
  font-weight: 500;
}

.detail-value {
  font-size: 0.875rem;
  color: #111827;
  font-weight: 500;
}

.detail-message {
  font-size: 1rem;
  color: #111827;
  font-weight: 500;
  margin-top: 0.5rem;
  line-height: 1.5;
}

.detail-description {
  font-size: 0.875rem;
  color: #4b5563;
  margin-top: 0.5rem;
  line-height: 1.5;
}

.severity-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
}

.severity-badge.severity-high {
  background: #fef2f2;
  color: #dc2626;
}

.severity-badge.severity-medium {
  background: #fefce8;
  color: #ca8a04;
}

.severity-badge.severity-low {
  background: #eff6ff;
  color: #2563eb;
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
}

.status-badge.read {
  background: #f0fdf4;
  color: #16a34a;
}

.status-badge.unread {
  background: #fef2f2;
  color: #dc2626;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-weight: 500;
  font-size: 0.875rem;
  cursor: pointer;
  border: none;
  transition: all 0.15s ease;
}

.btn-primary {
  background: linear-gradient(135deg, #f3c81e 0%, #f59e0b 100%);
  color: white;
}

.btn-primary:hover {
  box-shadow: 0 4px 12px rgba(243, 200, 30, 0.4);
}

.btn-secondary {
  background: white;
  color: #374151;
  border: 1px solid #d1d5db;
}

.btn-secondary:hover {
  background: #f9fafb;
}
</style>
