import api from './api'

export const maintenanceService = {
  // Get all maintenance records
  getAll() {
    return api.get('/bao-tri')
  },

  // Get maintenance by ID
  getById(id) {
    return api.get(`/bao-tri/${id}`)
  },

  // Get maintenance by vehicle ID
  getByVehicleId(vehicleId) {
    return api.get(`/bao-tri/xe/${vehicleId}`)
  },

  // Get upcoming maintenance
  getUpcoming() {
    return api.get('/bao-tri/upcoming/list')
  },

  // Create new maintenance record
  create(data) {
    return api.post('/bao-tri', data)
  },

  // Update maintenance record
  update(id, data) {
    return api.put(`/bao-tri/${id}`, data)
  },

  // Delete maintenance record
  delete(id) {
    return api.delete(`/bao-tri/${id}`)
  },
}

export const maintenanceTypeService = {
  // Get all maintenance types
  getAll() {
    return api.get('/loai-bao-tri')
  },

  // Get maintenance type by ID
  getById(id) {
    return api.get(`/loai-bao-tri/${id}`)
  },

  // Create new maintenance type
  create(data) {
    return api.post('/loai-bao-tri', data)
  },

  // Update maintenance type
  update(id, data) {
    return api.put(`/loai-bao-tri/${id}`, data)
  },

  // Delete maintenance type
  delete(id) {
    return api.delete(`/loai-bao-tri/${id}`)
  },
}

export default maintenanceService
