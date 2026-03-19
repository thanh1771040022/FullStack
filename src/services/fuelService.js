import api from './api'

export const fuelService = {
  // Get all fuel records
  getAll() {
    return api.get('/do-nhien-lieu')
  },

  // Get fuel record by ID
  getById(id) {
    return api.get(`/do-nhien-lieu/${id}`)
  },

  // Get fuel records by vehicle ID
  getByVehicleId(vehicleId) {
    return api.get(`/do-nhien-lieu/xe/${vehicleId}`)
  },

  // Get fuel statistics summary
  getStats() {
    return api.get('/do-nhien-lieu/stats/summary')
  },

  // Get monthly fuel statistics
  getMonthlyStats(year) {
    return api.get(`/do-nhien-lieu/stats/monthly?year=${year}`)
  },

  // Create new fuel record
  create(data) {
    return api.post('/do-nhien-lieu', data)
  },

  // Update fuel record
  update(id, data) {
    return api.put(`/do-nhien-lieu/${id}`, data)
  },

  // Delete fuel record
  delete(id) {
    return api.delete(`/do-nhien-lieu/${id}`)
  },
}

export default fuelService
