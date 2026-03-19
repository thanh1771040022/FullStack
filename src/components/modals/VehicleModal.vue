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
  vehicle: {
    type: Object,
    default: null,
  },
  vehicleTypes: {
    type: Array,
    default: () => [],
  },
  drivers: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['close', 'save'])

const formData = ref({
  licensePlate: '',
  loaiXeId: null,
  vehicleType: '',
  brand: '',
  taiXeId: null,
  driver: '',
  phoneNumber: '',
  vin: '',
  engineNumber: '',
  color: '',
  year: new Date().getFullYear(),
  status: 'active',
  fuelConsumption: 0,
  maintenanceStatus: 'normal',
  dongXe: '',
  dungTichBinh: null,
  soKmHienTai: 0,
  maGps: '',
  ghiChu: '',
})

// vehicleTypes từ props

const brands = [
  'Toyota',
  'Honda',
  'Hyundai',
  'Ford',
  'Mazda',
  'Kia',
  'Mitsubishi',
  'Isuzu',
  'Hino',
  'Mercedes',
]

const statusOptions = [
  { value: 'active', label: 'Hoạt động' },
  { value: 'inactive', label: 'Tạm dừng' },
  { value: 'maintenance', label: 'Đang bảo dưỡng' },
  { value: 'disposed', label: 'Đã thanh lý' },
]

const maintenanceStatusOptions = [
  { value: 'normal', label: 'Bình thường' },
  { value: 'warning', label: 'Cảnh báo' },
  { value: 'overdue', label: 'Quá hạn' },
]

const modalTitle = computed(() => {
  return props.mode === 'add' ? 'Thêm xe mới' : 'Chỉnh sửa thông tin xe'
})

const resetForm = () => {
  formData.value = {
    licensePlate: '',
    loaiXeId: null,
    vehicleType: '',
    brand: '',
    taiXeId: null,
    driver: '',
    phoneNumber: '',
    vin: '',
    engineNumber: '',
    color: '',
    year: new Date().getFullYear(),
    status: 'active',
    fuelConsumption: 0,
    maintenanceStatus: 'normal',
    dongXe: '',
    dungTichBinh: null,
    soKmHienTai: 0,
    maGps: '',
    ghiChu: '',
  }
}

watch(
  () => props.show,
  (newVal) => {
    if (newVal) {
      if (props.mode === 'edit' && props.vehicle) {
        formData.value = { ...props.vehicle }
      } else {
        resetForm()
      }
    }
  },
)

const handleClose = () => {
  emit('close')
}

const handleSave = () => {
  // Basic validation
  if (!formData.value.licensePlate || !formData.value.loaiXeId) {
    alert('Vui lòng điền đầy đủ thông tin bắt buộc (Biển số và Loại xe)!')
    return
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
            <Icon :icon="mode === 'add' ? 'mdi:plus-circle' : 'mdi:pencil'" class="icon-md" />
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
              <!-- Biển số xe -->
              <div class="form-group">
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

              <!-- Loại xe -->
              <div class="form-group">
                <label class="form-label">
                  Loại xe <span class="required">*</span>
                </label>
                <select v-model="formData.loaiXeId" class="form-select" required>
                  <option :value="null">Chọn loại xe</option>
                  <option v-for="type in vehicleTypes" :key="type.id" :value="type.id">
                    {{ type.ten_loai_xe }}
                  </option>
                </select>
              </div>

              <!-- Hãng xe -->
              <div class="form-group">
                <label class="form-label">
                  Hãng xe <span class="required">*</span>
                </label>
                <select v-model="formData.brand" class="form-select" required>
                  <option value="">Chọn hãng xe</option>
                  <option v-for="brand in brands" :key="brand" :value="brand">
                    {{ brand }}
                  </option>
                </select>
              </div>

              <!-- Năm sản xuất -->
              <div class="form-group">
                <label class="form-label">Năm sản xuất</label>
                <input
                  v-model.number="formData.year"
                  type="number"
                  class="form-input"
                  min="2000"
                  :max="new Date().getFullYear()"
                />
              </div>

              <!-- Tài xế -->
              <div class="form-group">
                <label class="form-label">Tài xế phụ trách</label>
                <select v-model="formData.taiXeId" class="form-select">
                  <option :value="null">Chưa phân công</option>
                  <option v-for="driver in drivers" :key="driver.id" :value="driver.id">
                    {{ driver.ho_ten }} - {{ driver.ma_nhan_vien }}
                  </option>
                </select>
              </div>

              <!-- Số điện thoại -->
              <div class="form-group">
                <label class="form-label">Số điện thoại</label>
                <input
                  v-model="formData.phoneNumber"
                  type="tel"
                  class="form-input"
                  placeholder="VD: 0912-345-678"
                />
              </div>

              <!-- Số VIN -->
              <div class="form-group">
                <label class="form-label">Số VIN</label>
                <input
                  v-model="formData.vin"
                  type="text"
                  class="form-input"
                  placeholder="Số khung xe"
                />
              </div>

              <!-- Số máy -->
              <div class="form-group">
                <label class="form-label">Số máy</label>
                <input
                  v-model="formData.engineNumber"
                  type="text"
                  class="form-input"
                  placeholder="Số động cơ"
                />
              </div>

              <!-- Màu sắc -->
              <div class="form-group">
                <label class="form-label">Màu sắc</label>
                <input
                  v-model="formData.color"
                  type="text"
                  class="form-input"
                  placeholder="VD: Trắng, Đen, Xanh"
                />
              </div>

              <!-- Mức tiêu hao nhiên liệu -->
              <div class="form-group">
                <label class="form-label">Tiêu hao nhiên liệu (L/100km)</label>
                <input
                  v-model.number="formData.fuelConsumption"
                  type="number"
                  class="form-input"
                  step="0.1"
                  min="0"
                />
              </div>

              <!-- Trạng thái xe -->
              <div class="form-group">
                <label class="form-label">Trạng thái xe</label>
                <select v-model="formData.status" class="form-select">
                  <option v-for="status in statusOptions" :key="status.value" :value="status.value">
                    {{ status.label }}
                  </option>
                </select>
              </div>

              <!-- Trạng thái bảo trì -->
              <div class="form-group">
                <label class="form-label">Trạng thái bảo trì</label>
                <select v-model="formData.maintenanceStatus" class="form-select">
                  <option
                    v-for="status in maintenanceStatusOptions"
                    :key="status.value"
                    :value="status.value"
                  >
                    {{ status.label }}
                  </option>
                </select>
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
            <Icon :icon="mode === 'add' ? 'mdi:plus' : 'mdi:content-save'" class="icon-sm" />
            {{ mode === 'add' ? 'Thêm xe' : 'Lưu thay đổi' }}
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
  max-width: 700px;
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

@media (max-width: 640px) {
  .form-grid {
    grid-template-columns: 1fr;
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
.form-select {
  padding: 0.625rem 0.875rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  transition: all 0.15s ease;
}

.form-input:focus,
.form-select:focus {
  outline: none;
  border-color: #FFB347;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-input::placeholder {
  color: #9ca3af;
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
