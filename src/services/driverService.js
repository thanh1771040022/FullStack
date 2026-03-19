import api from './api'

export const driverService = {
  // Get all drivers
  getAll() {
    return api.get('/tai-xe')
  },

  // Get driver by ID
  getById(id) {
    return api.get(`/tai-xe/${id}`)
  },

  // Create new driver
  create(data) {
    return api.post('/tai-xe', data)
  },

  // Update driver
  update(id, data) {
    return api.put(`/tai-xe/${id}`, data)
  },

  // Delete driver
  delete(id) {
    return api.delete(`/tai-xe/${id}`)
  },
}

export default driverService
