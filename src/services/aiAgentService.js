import api from './api'

export const aiAgentService = {
  ask(data) {
    return api.post('/ai-agent/ask', data)
  },
}

export default aiAgentService
