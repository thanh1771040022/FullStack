<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import api from '@/services/api'

const router = useRouter()

const form = ref({
  username: '',
  email: '',
  ho_ten: '',
  password: '',
  confirmPassword: '',
  vai_tro: 'tai_xe',
  so_dien_thoai: ''
})

const showPassword = ref(false)
const showConfirmPassword = ref(false)
const loading = ref(false)
const error = ref('')
const success = ref('')
const managerRegistrationEnabled = false

const isFormValid = computed(() => {
  return (
    form.value.username.trim() !== '' &&
    form.value.email.trim() !== '' &&
    form.value.ho_ten.trim() !== '' &&
    form.value.password.trim() !== '' &&
    form.value.password === form.value.confirmPassword &&
    form.value.password.length >= 6
  )
})

const passwordMatch = computed(() => {
  if (!form.value.confirmPassword) return null
  return form.value.password === form.value.confirmPassword
})

const handleRegister = async () => {
  if (!isFormValid.value) return
  
  loading.value = true
  error.value = ''
  success.value = ''
  
  try {
    const response = await api.post('/auth/register', {
      username: form.value.username,
      email: form.value.email,
      ho_ten: form.value.ho_ten,
      password: form.value.password,
      vai_tro: form.value.vai_tro,
      so_dien_thoai: form.value.so_dien_thoai || null
    })
    
    if (response.success) {
      success.value = 'Đăng ký thành công! Đang chuyển hướng...'
      
      // Lưu token và user info
      localStorage.setItem('token', response.data.token)
      localStorage.setItem('user', JSON.stringify(response.data))
      
      setTimeout(() => {
        if (response.data.vai_tro === 'quan_ly') {
          router.push('/dashboard')
        } else {
          router.push('/driver-dashboard')
        }
      }, 1500)
    }
  } catch (err) {
    error.value = err.response?.data?.message || 'Đăng ký thất bại. Vui lòng thử lại!'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="register-container">
    <div class="register-card">
      <div class="register-header">
        <div class="logo">
          <Icon icon="mdi:truck-fast" class="logo-icon" />
        </div>
        <h1>Đăng ký tài khoản</h1>
        <p>Tạo tài khoản để sử dụng hệ thống</p>
      </div>
      
      <form @submit.prevent="handleRegister" class="register-form">
        <!-- Vai trò -->
        <div class="form-group">
          <label>Loại tài khoản</label>
          <div class="role-selector">
            <label
              class="role-option"
              :class="{ active: form.vai_tro === 'quan_ly', disabled: !managerRegistrationEnabled }"
            >
              <input
                type="radio"
                v-model="form.vai_tro"
                value="quan_ly"
                :disabled="loading || !managerRegistrationEnabled"
              />
              <Icon icon="mdi:shield-account" class="role-icon" />
              <span class="role-name">Quản lý</span>
              <span class="role-desc">Tài khoản nội bộ (admin tạo)</span>
            </label>
            <label
              class="role-option"
              :class="{ active: form.vai_tro === 'tai_xe' }"
            >
              <input
                type="radio"
                v-model="form.vai_tro"
                value="tai_xe"
                :disabled="loading"
              />
              <Icon icon="mdi:steering" class="role-icon" />
              <span class="role-name">Tài xế</span>
              <span class="role-desc">Xem thông tin cá nhân</span>
            </label>
          </div>
        </div>
        
        <div class="form-row">
          <!-- Họ tên -->
          <div class="form-group">
            <label for="ho_ten">Họ và tên <span class="required">*</span></label>
            <div class="input-wrapper">
              <Icon icon="mdi:account" class="input-icon" />
              <input
                id="ho_ten"
                v-model="form.ho_ten"
                type="text"
                placeholder="Nhập họ và tên"
                :disabled="loading"
              />
            </div>
          </div>
          
          <!-- Số điện thoại -->
          <div class="form-group">
            <label for="so_dien_thoai">Số điện thoại</label>
            <div class="input-wrapper">
              <Icon icon="mdi:phone" class="input-icon" />
              <input
                id="so_dien_thoai"
                v-model="form.so_dien_thoai"
                type="tel"
                placeholder="Nhập số điện thoại"
                :disabled="loading"
              />
            </div>
          </div>
        </div>
        
        <!-- Email -->
        <div class="form-group">
          <label for="email">Email <span class="required">*</span></label>
          <div class="input-wrapper">
            <Icon icon="mdi:email" class="input-icon" />
            <input
              id="email"
              v-model="form.email"
              type="email"
              placeholder="Nhập địa chỉ email"
              :disabled="loading"
              autocomplete="email"
            />
          </div>
        </div>
        
        <!-- Username -->
        <div class="form-group">
          <label for="username">Tên đăng nhập <span class="required">*</span></label>
          <div class="input-wrapper">
            <Icon icon="mdi:account-circle" class="input-icon" />
            <input
              id="username"
              v-model="form.username"
              type="text"
              placeholder="Chọn tên đăng nhập"
              :disabled="loading"
              autocomplete="username"
            />
          </div>
        </div>
        
        <div class="form-row">
          <!-- Password -->
          <div class="form-group">
            <label for="password">Mật khẩu <span class="required">*</span></label>
            <div class="input-wrapper">
              <Icon icon="mdi:lock" class="input-icon" />
              <input
                id="password"
                v-model="form.password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="Tối thiểu 6 ký tự"
                :disabled="loading"
                autocomplete="new-password"
              />
              <button
                type="button"
                class="toggle-password"
                @click="showPassword = !showPassword"
                tabindex="-1"
              >
                <Icon :icon="showPassword ? 'mdi:eye-off' : 'mdi:eye'" />
              </button>
            </div>
          </div>
          
          <!-- Confirm Password -->
          <div class="form-group">
            <label for="confirmPassword">Xác nhận mật khẩu <span class="required">*</span></label>
            <div class="input-wrapper" :class="{ 'error': passwordMatch === false, 'success': passwordMatch === true }">
              <Icon icon="mdi:lock-check" class="input-icon" />
              <input
                id="confirmPassword"
                v-model="form.confirmPassword"
                :type="showConfirmPassword ? 'text' : 'password'"
                placeholder="Nhập lại mật khẩu"
                :disabled="loading"
                autocomplete="new-password"
              />
              <button
                type="button"
                class="toggle-password"
                @click="showConfirmPassword = !showConfirmPassword"
                tabindex="-1"
              >
                <Icon :icon="showConfirmPassword ? 'mdi:eye-off' : 'mdi:eye'" />
              </button>
            </div>
            <small v-if="passwordMatch === false" class="hint error">Mật khẩu không khớp</small>
          </div>
        </div>
        
        <div v-if="error" class="message error-message">
          <Icon icon="mdi:alert-circle" />
          <span>{{ error }}</span>
        </div>
        
        <div v-if="success" class="message success-message">
          <Icon icon="mdi:check-circle" />
          <span>{{ success }}</span>
        </div>
        
        <button
          type="submit"
          class="btn-register"
          :disabled="!isFormValid || loading"
        >
          <Icon v-if="loading" icon="mdi:loading" class="spin" />
          <Icon v-else icon="mdi:account-plus" />
          <span>{{ loading ? 'Đang đăng ký...' : 'Đăng ký' }}</span>
        </button>
      </form>
      
      <div class="register-footer">
        <p>Đã có tài khoản?
          <router-link to="/login" class="login-link">Đăng nhập</router-link>
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.register-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f0f2f5;
  padding: 20px;
}

.register-card {
  background: white;
  border-radius: 24px;
  padding: 40px;
  width: 100%;
  max-width: 560px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.register-header {
  text-align: center;
  margin-bottom: 28px;
}

.logo {
  width: 70px;
  height: 70px;
  background: linear-gradient(135deg, #FFB347 0%, #FFCC33 100%);
  border-radius: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
  box-shadow: 0 8px 24px rgba(255, 179, 71, 0.35);
}

.logo-icon {
  font-size: 36px;
  color: white;
}

.register-header h1 {
  font-size: 24px;
  font-weight: 700;
  color: #1a1a2e;
  margin: 0 0 6px;
}

.register-header p {
  color: #888;
  font-size: 14px;
  margin: 0;
}

.register-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 13px;
  font-weight: 500;
  color: #666;
}

.required {
  color: #e53e3e;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 14px;
  font-size: 18px;
  color: #bbb;
  pointer-events: none;
}

.input-wrapper input {
  width: 100%;
  padding: 14px 44px;
  font-size: 14px;
  border: 1px solid #e8e8e8;
  border-radius: 12px;
  background: #fafafa;
  transition: all 0.3s ease;
}

.input-wrapper input:focus {
  outline: none;
  border-color: #FFB347;
  background: white;
  box-shadow: 0 0 0 4px rgba(255, 179, 71, 0.1);
}

.input-wrapper input::placeholder {
  color: #bbb;
}

.input-wrapper.error input {
  border-color: #e53e3e;
}

.input-wrapper.success input {
  border-color: #38a169;
}

.toggle-password {
  position: absolute;
  right: 10px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px;
  color: #bbb;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toggle-password:hover {
  color: #FFB347;
}

.hint {
  font-size: 12px;
  margin-top: 2px;
}

.hint.error {
  color: #e53e3e;
}

/* Role Selector */
.role-selector {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.role-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 12px;
  border: 1px solid #e8e8e8;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  background: #fafafa;
}

.role-option input {
  display: none;
}

.role-option:hover {
  border-color: #FFB347;
}

.role-option.disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.role-option.disabled:hover {
  border-color: #e8e8e8;
}

.role-option.active {
  border-color: #FFB347;
  background: linear-gradient(135deg, rgba(255, 179, 71, 0.1) 0%, rgba(255, 204, 51, 0.1) 100%);
}

.role-icon {
  font-size: 32px;
  color: #FFB347;
  margin-bottom: 8px;
}

.role-name {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 4px;
}

.role-desc {
  font-size: 11px;
  color: #888;
  text-align: center;
}

/* Messages */
.message {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-radius: 10px;
  font-size: 13px;
}

.error-message {
  background: #fff5f5;
  border: 1px solid #fed7d7;
  color: #c53030;
}

.success-message {
  background: #f0fff4;
  border: 1px solid #c6f6d5;
  color: #276749;
}

.btn-register {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 16px 24px;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.5px;
  color: white;
  background: linear-gradient(135deg, #FFB347 0%, #FFCC33 100%);
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-top: 4px;
}

.btn-register:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(255, 179, 71, 0.4);
}

.btn-register:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.register-footer {
  text-align: center;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #e8e8e8;
}

.register-footer p {
  color: #888;
  font-size: 14px;
  margin: 0;
}

.login-link {
  color: #FFB347;
  font-weight: 600;
  text-decoration: none;
}

.login-link:hover {
  text-decoration: underline;
}

@media (max-width: 600px) {
  .register-card {
    padding: 28px 20px;
  }
  
  .form-row {
    grid-template-columns: 1fr;
  }
  
  .role-selector {
    grid-template-columns: 1fr;
  }
}
</style>
