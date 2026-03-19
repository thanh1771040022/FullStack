import api from './api'

export const userService = {
  getAll() {
    return api.get('/users')
  },

  create(data) {
    return api.post('/users', data)
  },

  update(id, data) {
    return api.put(`/users/${id}`, data)
  },

  updateStatus(id, trang_thai) {
    return api.patch(`/users/${id}/status`, { trang_thai })
  },
}

export default userService
