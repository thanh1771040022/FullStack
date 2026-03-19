import axios from 'axios'

// Create axios instance
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response.data
  },
  (error) => {
    // Xử lý lỗi network (không kết nối được server)
    if (!error.response) {
      console.error('Network Error: Không thể kết nối đến server. Hãy đảm bảo backend đang chạy!')
      error.message = 'Không thể kết nối đến server. Vui lòng kiểm tra backend!'
    } else {
      const message = error.response?.data?.message || error.message || 'Có lỗi xảy ra'
      console.error('API Error:', message)
    }
    return Promise.reject(error)
  }
)

export default api
