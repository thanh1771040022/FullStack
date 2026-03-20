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

  // Validate fuel payload before creating/updating
  validate(data) {
    return api.post('/do-nhien-lieu/validate', data)
  },

  // Get fuel analysis grouped by vehicle
  getAnalysisByVehicle(params = {}) {
    const query = new URLSearchParams(params).toString()
    return api.get(`/do-nhien-lieu/analysis/by-vehicle${query ? `?${query}` : ''}`)
  },

  // Get abnormal fuel records
  getAnomalies(params = {}) {
    const query = new URLSearchParams(params).toString()
    return api.get(`/do-nhien-lieu/anomalies${query ? `?${query}` : ''}`)
  },

  // Get pending approvals (manager)
  getPendingApprovals() {
    return api.get('/do-nhien-lieu/approval/pending')
  },

  // Approve or reject a fuel record (manager)
  reviewApproval(id, data) {
    return api.patch(`/do-nhien-lieu/${id}/approval`, data)
  },

  // Get audit history for a fuel record (manager)
  getAuditHistory(id) {
    return api.get(`/do-nhien-lieu/${id}/audit`)
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
