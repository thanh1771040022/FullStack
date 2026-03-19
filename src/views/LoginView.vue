<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import api from '@/services/api'

const router = useRouter()

const form = ref({
  username: '',
  password: ''
})

const showPassword = ref(false)
const loading = ref(false)
const error = ref('')

const isFormValid = computed(() => {
  return form.value.username.trim() !== '' && form.value.password.trim() !== ''
})

const handleLogin = async () => {
  if (!isFormValid.value) return
  
  loading.value = true
  error.value = ''
  
  try {
    const response = await api.post('/auth/login', {
      username: form.value.username,
      password: form.value.password
    })
    
    if (response.success) {
      localStorage.setItem('token', response.data.token)
      localStorage.setItem('user', JSON.stringify(response.data))
      
      if (response.data.vai_tro === 'quan_ly') {
        router.push('/dashboard')
      } else {
        router.push('/driver-dashboard')
      }
    }
  } catch (err) {
    // Kiểm tra lỗi network (backend không chạy)
    if (!err.response) {
      error.value = 'Không thể kết nối đến server. Hãy chạy backend trước (cd backend && npm start)!'
    } else {
      error.value = err.response?.data?.message || 'Đăng nhập thất bại. Vui lòng thử lại!'
    }
  } finally {
    loading.value = false
  }
}

const togglePassword = () => {
  showPassword.value = !showPassword.value
}
</script>

<template>
  <div class="login-container">
    <div class="login-card">
      <div class="login-header">
        <div class="logo">
          <Icon icon="mdi:truck-fast" class="logo-icon" />
        </div>
        <h1>Fleet Management</h1>
        <p>Hệ thống quản lý đội xe</p>
      </div>
      
      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label for="username">Tên đăng nhập</label>
          <div class="input-wrapper">
            <Icon icon="mdi:account" class="input-icon" />
            <input
              id="username"
              v-model="form.username"
              type="text"
              placeholder="Nhập tên đăng nhập"
              :disabled="loading"
              autocomplete="username"
            />
          </div>
        </div>
        
        <div class="form-group">
          <div class="label-row">
            <label for="password">Mật khẩu</label>
            <a href="#" class="forgot-link">Quên mật khẩu?</a>
          </div>
          <div class="input-wrapper">
            <Icon icon="mdi:lock" class="input-icon" />
            <input
              id="password"
              v-model="form.password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="Nhập mật khẩu"
              :disabled="loading"
              autocomplete="current-password"
            />
            <button
              type="button"
              class="toggle-password"
              @click="togglePassword"
              tabindex="-1"
            >
              <Icon :icon="showPassword ? 'mdi:eye-off' : 'mdi:eye'" />
            </button>
          </div>
        </div>
        
        <div v-if="error" class="error-message">
          <Icon icon="mdi:alert-circle" />
          <span>{{ error }}</span>
        </div>
        
        <button
          type="submit"
          class="btn-login"
          :disabled="!isFormValid || loading"
        >
          <Icon v-if="loading" icon="mdi:loading" class="spin" />
          <span>{{ loading ? 'Đang đăng nhập...' : 'ĐĂNG NHẬP' }}</span>
        </button>
      </form>
      
      <div class="login-footer">
        <p>Chưa có tài khoản?
          <router-link to="/register" class="register-link">Đăng ký ngay</router-link>
        </p>
      </div>
      
      <div class="social-divider">
        <span>Hoặc đăng nhập với</span>
      </div>
      
      <div class="social-buttons">
        <button type="button" class="social-btn facebook">
          <Icon icon="mdi:facebook" />
        </button>
        <button type="button" class="social-btn google">
          <Icon icon="mdi:google" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  /* Background image - thay URL ảnh tại đây */
  background-image: url('https://s.widget-club.com/images/YyiR86zpwIMIfrCZoSs4ulVD9RF3/73c6806ebc27e23b07786f7a673dc27e/fLVuk7rKbaW1piQGRUIz.jpg?q=70&w=500');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  background-attachment: fixed;
  padding: 20px;
}

.login-card {
  background: white;
  border-radius: 24px;
  padding: 48px 40px;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.login-header {
  text-align: center;
  margin-bottom: 36px;
}

.logo {
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, #FFB347 0%, #FFCC33 100%);
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
  box-shadow: 0 8px 24px rgba(255, 179, 71, 0.35);
}

.logo-icon {
  font-size: 40px;
  color: white;
}

.login-header h1 {
  font-size: 26px;
  font-weight: 700;
  color: #1a1a2e;
  margin: 0 0 8px;
}

.login-header p {
  color: #888;
  font-size: 14px;
  margin: 0;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.form-group label {
  font-size: 13px;
  font-weight: 500;
  color: #666;
}

.forgot-link {
  font-size: 13px;
  color: #FFB347;
  text-decoration: none;
  font-weight: 500;
}

.forgot-link:hover {
  text-decoration: underline;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 16px;
  font-size: 20px;
  color: #bbb;
  pointer-events: none;
}

.input-wrapper input {
  width: 100%;
  padding: 16px 48px;
  font-size: 15px;
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

.toggle-password {
  position: absolute;
  right: 12px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
  color: #bbb;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s;
}

.toggle-password:hover {
  color: #FFB347;
}

.error-message {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #fff5f5;
  border: 1px solid #fed7d7;
  border-radius: 10px;
  color: #c53030;
  font-size: 14px;
}

.btn-login {
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
  margin-top: 8px;
}

.btn-login:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(255, 179, 71, 0.4);
}

.btn-login:disabled {
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

.login-footer {
  text-align: center;
  margin-top: 24px;
}

.login-footer p {
  color: #888;
  font-size: 14px;
  margin: 0;
}

.register-link {
  color: #FFB347;
  font-weight: 600;
  text-decoration: none;
  transition: color 0.2s;
}

.register-link:hover {
  text-decoration: underline;
}

.social-divider {
  display: flex;
  align-items: center;
  margin: 28px 0 20px;
}

.social-divider::before,
.social-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #e8e8e8;
}

.social-divider span {
  padding: 0 16px;
  color: #999;
  font-size: 13px;
}

.social-buttons {
  display: flex;
  justify-content: center;
  gap: 16px;
}

.social-btn {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  border: 1px solid #e8e8e8;
  background: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  transition: all 0.3s ease;
}

.social-btn:hover {
  border-color: #ddd;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.social-btn.facebook {
  color: #1877f2;
}

.social-btn.google {
  color: #ea4335;
}

@media (max-width: 480px) {
  .login-card {
    padding: 32px 24px;
  }
  
  .login-header h1 {
    font-size: 22px;
  }
}
</style>
