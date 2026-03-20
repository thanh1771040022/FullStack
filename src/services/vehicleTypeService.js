import api from './api'

export const vehicleTypeService = {
  getAll() {
    return api.get('/loai-xe')
  },

  getById(id) {
    return api.get(`/loai-xe/${id}`)
  },

  getThresholds() {
    return api.get('/loai-xe/thresholds/list')
  },

  updateThreshold(id, data) {
    return api.put(`/loai-xe/${id}/threshold`, data)
  },
}

export default vehicleTypeService
