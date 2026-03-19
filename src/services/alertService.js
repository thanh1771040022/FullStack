import api from './api'

export const alertService = {
  // Get all alerts
  getAll() {
    return api.get('/canh-bao')
  },

  // Get alert by ID
  getById(id) {
    return api.get(`/canh-bao/${id}`)
  },

  // Get unread alerts
  getUnread() {
    return api.get('/canh-bao/unread/list')
  },

  // Get alerts by vehicle ID
  getByVehicleId(vehicleId) {
    return api.get(`/canh-bao/xe/${vehicleId}`)
  },

  // Get alert statistics
  getStats() {
    return api.get('/canh-bao/stats/summary')
  },

  // Create new alert
  create(data) {
    return api.post('/canh-bao', data)
  },

  // Update alert
  update(id, data) {
    return api.put(`/canh-bao/${id}`, data)
  },

  // Mark as read
  markAsRead(id) {
    return api.put(`/canh-bao/${id}/read`)
  },

  // Mark all as read
  markAllAsRead() {
    return api.put('/canh-bao/all/read')
  },

  // Delete alert
  delete(id) {
    return api.delete(`/canh-bao/${id}`)
  },
}

export default alertService
