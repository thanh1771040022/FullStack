<script setup>
import { ref, watch, computed } from 'vue'
import { Icon } from '@iconify/vue'

const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
  mode: {
    type: String,
    default: 'add', // 'add' | 'edit'
  },
  maintenance: {
    type: Object,
    default: null,
  },
  vehicles: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['close', 'save'])

const formData = ref({
  vehicleId: '',
  licensePlate: '',
  maintenanceType: '',
  description: '',
  scheduledDate: '',
  estimatedCost: 0,
  priority: 'normal',
  notes: '',
})

const maintenanceTypes = [
  { value: 'inspection', label: 'Đăng kiểm', icon: 'mdi:file-document-check' },
  { value: 'insurance', label: 'Bảo hiểm', icon: 'mdi:shield-check' },
  { value: 'tire-change', label: 'Thay lốp xe', icon: 'mdi:tire' },
  { value: 'oil-change', label: 'Thay dầu máy', icon: 'mdi:oil' },
  { value: 'brake-service', label: 'Bảo dưỡng phanh', icon: 'mdi:car-brake-alert' },
  { value: 'general', label: 'Bảo dưỡng định kỳ', icon: 'mdi:wrench' },
  { value: 'repair', label: 'Sửa chữa', icon: 'mdi:tools' },
  { value: 'ac-service', label: 'Bảo dưỡng điều hòa', icon: 'mdi:air-conditioner' },
]

const priorityOptions = [
  { value: 'low', label: 'Thấp', color: 'blue' },
  { value: 'normal', label: 'Bình thường', color: 'green' },
  { value: 'high', label: 'Cao', color: 'yellow' },
  { value: 'urgent', label: 'Khẩn cấp', color: 'red' },
]

const modalTitle = computed(() => {
  return props.mode === 'add' ? 'Thêm lịch bảo trì' : 'Chỉnh sửa lịch bảo trì'
})

const resetForm = () => {
  formData.value = {
    vehicleId: '',
    licensePlate: '',
    maintenanceType: '',
    description: '',
    scheduledDate: '',
    estimatedCost: 0,
    priority: 'normal',
    notes: '',
  }
}

watch(
  () => props.show,
  (newVal) => {
    if (newVal) {
      if (props.mode === 'edit' && props.maintenance) {
        // Map data for edit mode
        formData.value = { 
          ...props.maintenance,
          vehicleId: props.maintenance.vehicleId || props.maintenance.id,
          licensePlate: props.maintenance.licensePlate || '',
          scheduledDate: props.maintenance.scheduledDate || '',
          maintenanceType: props.maintenance.maintenanceType || '',
        }
      } else {
        resetForm()
      }
    }
  },
)

// Auto-fill license plate when vehicle is selected
watch(
  () => formData.value.vehicleId,
  (newVal) => {
    if (newVal && props.vehicles.length > 0) {
      const vehicle = props.vehicles.find((v) => v.id === newVal)
      if (vehicle) {
        formData.value.licensePlate = vehicle.licensePlate
      }
    }
  },
)

const handleClose = () => {
  emit('close')
}

const handleSave = () => {
  // Basic validation
  if (props.mode === 'add') {
    if ((!formData.value.vehicleId && !formData.value.licensePlate) || !formData.value.maintenanceType || !formData.value.scheduledDate) {
      alert('Vui lòng điền đầy đủ thông tin bắt buộc!')
      return
    }
  } else {
    // Edit mode - only need type and date
    if (!formData.value.maintenanceType || !formData.value.scheduledDate) {
      alert('Vui lòng chọn loại bảo trì và ngày dự kiến!')
      return
    }
  }
  emit('save', { ...formData.value, mode: props.mode })
  handleClose()
}

</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="modal-overlay" @click.self="handleClose">
      <div class="modal-container">
        <!-- Header -->
        <div class="modal-header">
          <h2 class="modal-title">
            <Icon :icon="mode === 'add' ? 'mdi:calendar-plus' : 'mdi:calendar-edit'" class="icon-md" />
            {{ modalTitle }}
          </h2>
          <button class="btn-close" @click="handleClose">
            <Icon icon="mdi:close" class="icon-md" />
          </button>
        </div>

        <!-- Body -->
        <div class="modal-body">
          <form @submit.prevent="handleSave">
            <div class="form-grid">
              <!-- Chọn xe - disabled when editing -->
              <div class="form-group" v-if="mode === 'add' && vehicles.length > 0">
                <label class="form-label">
                  Chọn xe <span class="required">*</span>
                </label>
                <select v-model="formData.vehicleId" class="form-select" required>
                  <option value="">Chọn xe từ danh sách</option>
                  <option v-for="vehicle in vehicles" :key="vehicle.id" :value="vehicle.id">
                    {{ vehicle.licensePlate }} - {{ vehicle.brand }} {{ vehicle.model || vehicle.vehicleType }}
                  </option>
                </select>
              </div>

              <!-- Show license plate when editing -->
              <div class="form-group" v-else-if="mode === 'edit'">
                <label class="form-label">Biển số xe</label>
                <input
                  :value="formData.licensePlate"
                  type="text"
                  class="form-input"
                  disabled
                />
              </div>

              <!-- Biển số xe (manual input if no vehicles list) -->
              <div class="form-group" v-else>
                <label class="form-label">
                  Biển số xe <span class="required">*</span>
                </label>
                <input
                  v-model="formData.licensePlate"
                  type="text"
                  class="form-input"
                  placeholder="VD: 29A-12345"
                  required
                />
              </div>

              <!-- Loại bảo trì -->
              <div class="form-group">
                <label class="form-label">
                  Loại bảo trì <span class="required">*</span>
                </label>
                <select v-model="formData.maintenanceType" class="form-select" required>
                  <option value="">Chọn loại bảo trì</option>
                  <option v-for="type in maintenanceTypes" :key="type.value" :value="type.value">
                    {{ type.label }}
                  </option>
                </select>
              </div>

              <!-- Ngày dự kiến -->
              <div class="form-group">
                <label class="form-label">
                  Ngày dự kiến <span class="required">*</span>
                </label>
                <input
                  v-model="formData.scheduledDate"
                  type="date"
                  class="form-input"
                  required
                />
              </div>

              <!-- Mức độ ưu tiên -->
              <div class="form-group">
                <label class="form-label">Mức độ ưu tiên</label>
                <select v-model="formData.priority" class="form-select">
                  <option v-for="priority in priorityOptions" :key="priority.value" :value="priority.value">
                    {{ priority.label }}
                  </option>
                </select>
              </div>

              <!-- Chi phí ước tính -->
              <div class="form-group">
                <label class="form-label">Chi phí ước tính (VNĐ)</label>
                <input
                  v-model.number="formData.estimatedCost"
                  type="number"
                  class="form-input"
                  min="0"
                  step="100000"
                  placeholder="0"
                />
              </div>

              <!-- Mô tả công việc -->
              <div class="form-group full-width">
                <label class="form-label">Mô tả công việc</label>
                <textarea
                  v-model="formData.description"
                  class="form-textarea"
                  rows="3"
                  placeholder="Mô tả chi tiết công việc bảo trì..."
                ></textarea>
              </div>

              <!-- Ghi chú -->
              <div class="form-group full-width">
                <label class="form-label">Ghi chú</label>
                <textarea
                  v-model="formData.notes"
                  class="form-textarea"
                  rows="2"
                  placeholder="Ghi chú thêm..."
                ></textarea>
              </div>
            </div>
          </form>
        </div>

        <!-- Footer -->
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="handleClose">
            <Icon icon="mdi:close" class="icon-sm" />
            Hủy bỏ
          </button>
          <button type="button" class="btn btn-primary" @click="handleSave">
            <Icon :icon="mode === 'add' ? 'mdi:calendar-check' : 'mdi:content-save'" class="icon-sm" />
            {{ mode === 'add' ? 'Tạo lịch' : 'Lưu thay đổi' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-container {
  background: white;
  border-radius: 0.75rem;
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.modal-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.25rem;
  font-weight: 600;
  color: #111827;
}

.btn-close {
  padding: 0.5rem;
  border: none;
  background: transparent;
  border-radius: 0.375rem;
  cursor: pointer;
  color: #6b7280;
  transition: all 0.15s ease;
}

.btn-close:hover {
  background: #f3f4f6;
  color: #111827;
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.form-group.full-width {
  grid-column: span 2;
}

@media (max-width: 640px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
  .form-group.full-width {
    grid-column: span 1;
  }
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.form-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
}

.required {
  color: #ef4444;
}

.form-input,
.form-select,
.form-textarea {
  padding: 0.625rem 0.875rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-family: inherit;
  transition: all 0.15s ease;
}

.form-input:focus,
.form-select:focus,
.form-textarea:focus {
  outline: none;
  border-color: #FFB347;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-input::placeholder,
.form-textarea::placeholder {
  color: #9ca3af;
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1.25rem 1.5rem;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;
  border-radius: 0 0 0.75rem 0.75rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: 0.5rem;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
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
  background: #f3f4f6;
}

.icon-sm {
  width: 1rem;
  height: 1rem;
}

.icon-md {
  width: 1.25rem;
  height: 1.25rem;
}
</style>
