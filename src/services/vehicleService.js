import api from './api'

export const vehicleService = {
  // Get all vehicles
  getAll() {
    return api.get('/xe')
  },

  // Get all vehicles with full details (joined with driver, vehicle type)
  getAllWithDetails() {
    return api.get('/xe/full/details')
  },

  // Get upcoming expiry deadlines from xe table
  getUpcomingExpiries(days = 30) {
    return api.get(`/xe/stats/upcoming-expiries?days=${days}`)
  },

  // Get vehicle by ID
  getById(id) {
    return api.get(`/xe/${id}`)
  },

  // Create new vehicle
  create(data) {
    return api.post('/xe', data)
  },

  // Update vehicle
  update(id, data) {
    return api.put(`/xe/${id}`, data)
  },

  // Delete vehicle
  delete(id) {
    return api.delete(`/xe/${id}`)
  },
}

export default vehicleService
