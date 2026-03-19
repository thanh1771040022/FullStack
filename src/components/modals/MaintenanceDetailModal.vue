<script setup>
import { computed } from 'vue'
import { Icon } from '@iconify/vue'

const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
  vehicle: {
    type: Object,
    default: null,
  },
  maintenanceRecords: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['close'])

const handleClose = () => {
  emit('close')
}

// Get maintenance records for this vehicle
const vehicleMaintenances = computed(() => {
  if (!props.vehicle || !props.maintenanceRecords.length) return []
  return props.maintenanceRecords.filter(m => m.xe_id === props.vehicle.id)
})

const getDaysRemaining = (dateStr) => {
  if (!dateStr) return null
  const today = new Date()
  const targetDate = new Date(dateStr)
  const diffTime = targetDate - today
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}

const getStatusClass = (days) => {
  if (days === null) return 'status-unknown'
  if (days < 0) return 'status-overdue'
  if (days <= 14) return 'status-warning'
  return 'status-ok'
}

const getStatusText = (days) => {
  if (days === null) return 'Chưa có dữ liệu'
  if (days < 0) return `Quá hạn ${Math.abs(days)} ngày`
  if (days === 0) return 'Hết hạn hôm nay'
  return `Còn ${days} ngày`
}

const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A'
  return new Date(dateStr).toLocaleDateString('vi-VN')
}

const formatCurrency = (value) => {
  if (!value) return '0 ₫'
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)
}

const getMaintenanceTypeName = (typeId) => {
  const types = {
    1: 'Đăng kiểm',
    2: 'Bảo hiểm TNDS',
    3: 'Thay dầu',
    4: 'Bảo dưỡng định kỳ',
    5: 'Thay lốp',
    6: 'Thay má phanh',
    7: 'Thay ắc quy',
    8: 'Bảo dưỡng điều hòa',
    9: 'Cân chỉnh bánh xe',
    10: 'Thay lọc gió',
    11: 'Thay dầu hộp số',
    12: 'Kiểm tra hệ thống điện',
    13: 'Thay dây curoa',
  }
  return types[typeId] || 'Bảo trì khác'
}

const getMaintenanceIcon = (typeId) => {
  const icons = {
    1: 'mdi:file-document-check',
    2: 'mdi:shield-check',
    3: 'mdi:oil',
    4: 'mdi:wrench',
    5: 'mdi:tire',
    6: 'mdi:car-brake-alert',
    7: 'mdi:car-battery',
    8: 'mdi:air-conditioner',
    9: 'mdi:tire',
    10: 'mdi:air-filter',
    11: 'mdi:oil',
    12: 'mdi:flash',
    13: 'mdi:engine',
  }
  return icons[typeId] || 'mdi:wrench'
}

const getStatusBadge = (status) => {
  const badges = {
    'len_lich': { text: 'Đã lên lịch', class: 'badge-info' },
    'dang_lam': { text: 'Đang thực hiện', class: 'badge-warning' },
    'hoan_thanh': { text: 'Hoàn thành', class: 'badge-success' },
    'huy': { text: 'Đã hủy', class: 'badge-secondary' },
    'qua_han': { text: 'Quá hạn', class: 'badge-danger' },
  }
  return badges[status] || { text: status, class: 'badge-secondary' }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="modal-overlay" @click.self="handleClose">
      <div class="modal-container modal-lg">
        <!-- Header -->
        <div class="modal-header">
          <h2 class="modal-title">
            <Icon icon="mdi:car-info" class="icon-md" />
            Chi tiết bảo trì xe {{ vehicle?.licensePlate }}
          </h2>
          <button class="btn-close" @click="handleClose">
            <Icon icon="mdi:close" class="icon-md" />
          </button>
        </div>

        <!-- Body -->
        <div class="modal-body">
          <!-- Vehicle Info Card -->
          <div class="info-card">
            <div class="info-header">
              <Icon icon="mdi:car" class="icon-lg" />
              <div>
                <h3>{{ vehicle?.licensePlate }}</h3>
                <p>{{ vehicle?.brand }} {{ vehicle?.model }}</p>
              </div>
            </div>
            
            <!-- Quick Status -->
            <div class="quick-status">
              <div class="status-item">
                <Icon icon="mdi:file-document-check" class="status-icon" />
                <div class="status-info">
                  <span class="status-label">Đăng kiểm</span>
                  <span class="status-date">{{ formatDate(vehicle?.inspectionDate) }}</span>
                  <span :class="['status-badge', getStatusClass(getDaysRemaining(vehicle?.inspectionDate))]">
                    {{ getStatusText(getDaysRemaining(vehicle?.inspectionDate)) }}
                  </span>
                </div>
              </div>
              
              <div class="status-item">
                <Icon icon="mdi:shield-check" class="status-icon" />
                <div class="status-info">
                  <span class="status-label">Bảo hiểm</span>
                  <span class="status-date">{{ formatDate(vehicle?.insuranceDate) }}</span>
                  <span :class="['status-badge', getStatusClass(getDaysRemaining(vehicle?.insuranceDate))]">
                    {{ getStatusText(getDaysRemaining(vehicle?.insuranceDate)) }}
                  </span>
                </div>
              </div>
              
              <div class="status-item">
                <Icon icon="mdi:tire" class="status-icon" />
                <div class="status-info">
                  <span class="status-label">Thay lốp</span>
                  <span class="status-date">{{ formatDate(vehicle?.tireChangeDate) }}</span>
                  <span :class="['status-badge', getStatusClass(getDaysRemaining(vehicle?.tireChangeDate))]">
                    {{ getStatusText(getDaysRemaining(vehicle?.tireChangeDate)) }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Maintenance History -->
          <div class="history-section">
            <h4 class="section-title">
              <Icon icon="mdi:history" class="icon-md" />
              Lịch sử bảo trì
            </h4>
            
            <div v-if="vehicleMaintenances.length > 0" class="history-list">
              <div v-for="record in vehicleMaintenances" :key="record.id" class="history-item">
                <div class="history-icon">
                  <Icon :icon="getMaintenanceIcon(record.loai_bao_tri_id)" />
                </div>
                <div class="history-content">
                  <div class="history-header">
                    <span class="history-type">{{ record.loai_bao_tri_ten || getMaintenanceTypeName(record.loai_bao_tri_id) }}</span>
                    <span :class="['badge', getStatusBadge(record.trang_thai).class]">
                      {{ getStatusBadge(record.trang_thai).text }}
                    </span>
                  </div>
                  <div class="history-details">
                    <div class="detail-row">
                      <Icon icon="mdi:calendar" class="icon-xs" />
                      <span>Ngày dự kiến: {{ formatDate(record.ngay_du_kien) }}</span>
                    </div>
                    <div v-if="record.ngay_hoan_thanh" class="detail-row">
                      <Icon icon="mdi:calendar-check" class="icon-xs" />
                      <span>Ngày hoàn thành: {{ formatDate(record.ngay_hoan_thanh) }}</span>
                    </div>
                    <div v-if="record.km_luc_bao_tri" class="detail-row">
                      <Icon icon="mdi:speedometer" class="icon-xs" />
                      <span>Km: {{ record.km_luc_bao_tri?.toLocaleString() }} km</span>
                    </div>
                    <div v-if="record.tong_chi_phi" class="detail-row">
                      <Icon icon="mdi:cash" class="icon-xs" />
                      <span>Chi phí: {{ formatCurrency(record.tong_chi_phi) }}</span>
                    </div>
                    <div v-if="record.don_vi_bao_tri" class="detail-row">
                      <Icon icon="mdi:store" class="icon-xs" />
                      <span>Đơn vị: {{ record.don_vi_bao_tri }}</span>
                    </div>
                    <div v-if="record.ghi_chu" class="detail-row note">
                      <Icon icon="mdi:note-text" class="icon-xs" />
                      <span>{{ record.ghi_chu }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div v-else class="empty-history">
              <Icon icon="mdi:clipboard-text-off" class="empty-icon" />
              <p>Chưa có lịch sử bảo trì cho xe này</p>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="handleClose">
            Đóng
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-container {
  background: white;
  border-radius: 16px;
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}

.modal-lg {
  max-width: 700px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.modal-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
}

.btn-close {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  padding: 0.5rem;
  border-radius: 8px;
  cursor: pointer;
  color: white;
  transition: background 0.2s;
}

.btn-close:hover {
  background: rgba(255, 255, 255, 0.3);
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
}

.modal-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

/* Info Card */
.info-card {
  background: #f8fafc;
  border-radius: 12px;
  padding: 1.25rem;
  margin-bottom: 1.5rem;
}

.info-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.25rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.info-header .icon-lg {
  font-size: 2.5rem;
  color: #667eea;
}

.info-header h3 {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0;
}

.info-header p {
  color: #6b7280;
  margin: 0.25rem 0 0;
}

/* Quick Status */
.quick-status {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
}

.status-item {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem;
  background: white;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.status-icon {
  font-size: 1.5rem;
  color: #667eea;
}

.status-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.status-label {
  font-size: 0.75rem;
  color: #6b7280;
  text-transform: uppercase;
  font-weight: 600;
}

.status-date {
  font-size: 0.875rem;
  font-weight: 600;
  color: #1f2937;
}

.status-badge {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-weight: 500;
  width: fit-content;
}

.status-ok {
  background: #d1fae5;
  color: #065f46;
}

.status-warning {
  background: #fef3c7;
  color: #92400e;
}

.status-overdue {
  background: #fee2e2;
  color: #991b1b;
}

.status-unknown {
  background: #e5e7eb;
  color: #6b7280;
}

/* History Section */
.history-section {
  margin-top: 1rem;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 1rem;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.history-item {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  background: #f8fafc;
  border-radius: 10px;
  border-left: 4px solid #667eea;
}

.history-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #eef2ff;
  border-radius: 10px;
  color: #667eea;
  font-size: 1.25rem;
  flex-shrink: 0;
}

.history-content {
  flex: 1;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.history-type {
  font-weight: 600;
  color: #1f2937;
}

.history-details {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.detail-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #6b7280;
}

.detail-row.note {
  margin-top: 0.25rem;
  padding-top: 0.5rem;
  border-top: 1px dashed #e5e7eb;
  font-style: italic;
}

/* Badges */
.badge {
  padding: 0.25rem 0.625rem;
  border-radius: 50px;
  font-size: 0.75rem;
  font-weight: 500;
}

.badge-info {
  background: #dbeafe;
  color: #1e40af;
}

.badge-warning {
  background: #fef3c7;
  color: #92400e;
}

.badge-success {
  background: #d1fae5;
  color: #065f46;
}

.badge-danger {
  background: #fee2e2;
  color: #991b1b;
}

.badge-secondary {
  background: #e5e7eb;
  color: #6b7280;
}

/* Empty State */
.empty-history {
  text-align: center;
  padding: 2rem;
  color: #9ca3af;
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 0.5rem;
}

/* Icons */
.icon-xs {
  font-size: 0.875rem;
}

.icon-md {
  font-size: 1.25rem;
}

.icon-lg {
  font-size: 1.5rem;
}

/* Buttons */
.btn {
  padding: 0.625rem 1.25rem;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  border: none;
  transition: all 0.2s;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
}

.btn-secondary:hover {
  background: #e5e7eb;
}

/* Responsive */
@media (max-width: 640px) {
  .quick-status {
    grid-template-columns: 1fr;
  }
  
  .history-item {
    flex-direction: column;
  }
  
  .history-icon {
    width: 32px;
    height: 32px;
    font-size: 1rem;
  }
}
</style>
