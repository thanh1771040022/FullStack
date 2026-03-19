import api from './api'

export const authService = {
  // Đăng nhập
  async login(username, password) {
    const response = await api.post('/auth/login', { username, password })
    if (response.success) {
      localStorage.setItem('token', response.data.token)
      localStorage.setItem('user', JSON.stringify(response.data))
    }
    return response
  },

  // Đăng ký
  async register(userData) {
    const response = await api.post('/auth/register', userData)
    if (response.success) {
      localStorage.setItem('token', response.data.token)
      localStorage.setItem('user', JSON.stringify(response.data))
    }
    return response
  },

  // Đăng xuất
  logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  },

  // Lấy thông tin user hiện tại
  async getCurrentUser() {
    return api.get('/auth/me')
  },

  // Kiểm tra đã đăng nhập chưa
  isAuthenticated() {
    const token = localStorage.getItem('token')
    return !!token
  },

  // Lấy token
  getToken() {
    return localStorage.getItem('token')
  },

  // Lấy user từ localStorage
  getUser() {
    const userStr = localStorage.getItem('user')
    return userStr ? JSON.parse(userStr) : null
  },

  // Kiểm tra vai trò
  hasRole(role) {
    const user = this.getUser()
    return user && user.vai_tro === role
  },

  // Kiểm tra là quản lý
  isManager() {
    return this.hasRole('quan_ly')
  },

  // Kiểm tra là tài xế
  isDriver() {
    return this.hasRole('tai_xe')
  }
}

export default authService
