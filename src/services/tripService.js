import api from './api'

export const tripService = {
  // Get all trips
  getAll() {
    return api.get('/chuyen-di')
  },

  // Get trip by ID
  getById(id) {
    return api.get(`/chuyen-di/${id}`)
  },

  // Get trips by vehicle ID
  getByVehicleId(vehicleId) {
    return api.get(`/chuyen-di/xe/${vehicleId}`)
  },

  // Get trips by driver ID
  getByDriverId(driverId) {
    return api.get(`/chuyen-di/tai-xe/${driverId}`)
  },

  // Get trip statistics
  getStats() {
    return api.get('/chuyen-di/stats/summary')
  },

  // Create new trip
  create(data) {
    return api.post('/chuyen-di', data)
  },

  // Update trip
  update(id, data) {
    return api.put(`/chuyen-di/${id}`, data)
  },

  // Delete trip
  delete(id) {
    return api.delete(`/chuyen-di/${id}`)
  },
}

export default tripService
