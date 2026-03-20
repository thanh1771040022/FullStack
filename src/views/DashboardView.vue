<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { Icon } from '@iconify/vue'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
} from 'chart.js'
import { vehicleService, alertService, fuelService, aiAgentService } from '@/services'

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale)

// State
const vehicles = ref([])
const upcomingExpiries = ref([])
const alertsData = ref([])
const fuelData = ref([])
const loading = ref(true)
const error = ref(null)
const selectedYear = ref(new Date().getFullYear())

const chatOpen = ref(false)
const chatLoading = ref(false)
const chatInput = ref('')
const chatBodyRef = ref(null)
const chatMessages = ref([
  {
    id: 1,
    role: 'agent',
    text: 'Chào bạn. Tôi là Fleet AI Agent. Hãy hỏi về nhiên liệu bất thường, định mức hoặc xe sắp hết hạn.',
    createdAt: new Date().toISOString(),
  },
])
const quickPrompts = [
  'Xe nào nhiên liệu bất thường 30 ngày gần đây?',
  'Top xe vượt định mức cao nhất trong tháng này?',
  'Xe nào sắp hết hạn đăng kiểm trong 30 ngày tới?',
]

const maintenanceVehicleCount = computed(() => {
  const ids = new Set((upcomingExpiries.value || []).map((item) => item.xe_id).filter((id) => Number.isFinite(Number(id))))
  return ids.size
})

const recentFuelAlerts = computed(() => {
  const allAlerts = alertsData.value || []
  const fuelAlerts = allAlerts.filter((item) => item.loai_canh_bao === 'nhien_lieu_bat_thuong')
  const source = fuelAlerts.length > 0 ? fuelAlerts : allAlerts

  return source
    .slice()
    .sort((a, b) => new Date(b.tao_luc || 0) - new Date(a.tao_luc || 0))
    .slice(0, 5)
})

// Danh sách năm có dữ liệu
const availableYears = computed(() => {
  const years = new Set()
  fuelData.value.forEach(f => {
    const dateField = f.thoi_gian_do || f.ngay_do
    if (dateField) {
      years.add(new Date(dateField).getFullYear())
    }
  })
  return Array.from(years).sort((a, b) => b - a) // Sắp xếp giảm dần
})

// Fetch all data from API
const fetchDashboardData = async () => {
  loading.value = true
  error.value = null
  try {
    const [vehicleRes, upcomingRes, alertRes, fuelRes] = await Promise.all([
      vehicleService.getAllWithDetails(),
      vehicleService.getUpcomingExpiries(30),
      alertService.getAll(),
      fuelService.getAll()
    ])
    vehicles.value = vehicleRes.data
    upcomingExpiries.value = upcomingRes.data?.items || []
    alertsData.value = alertRes.data
    fuelData.value = fuelRes.data

    const years = fuelData.value
      .map((f) => {
        const dateField = f.thoi_gian_do || f.ngay_do
        return dateField ? new Date(dateField).getFullYear() : null
      })
      .filter((y) => Number.isFinite(y))
      .sort((a, b) => b - a)

    if (years.length > 0 && !years.includes(selectedYear.value)) {
      selectedYear.value = years[0]
    }
  } catch (err) {
    let errMsg = 'Không thể tải dữ liệu dashboard. Vui lòng thử lại.'
    if (err && err.response && err.response.data && err.response.data.message) {
      errMsg += `\nAPI: ${err.response.data.message}`;
    } else if (err && err.message) {
      errMsg += `\n${err.message}`;
    }
    console.error('Error fetching dashboard data:', err)
    error.value = errMsg
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchDashboardData()
})

// KPI Data (computed from API data)
const kpiData = computed(() => {
  const total = vehicles.value.length
  const active = vehicles.value.filter(v => v.trang_thai === 'hoat_dong').length
  const maintenance = maintenanceVehicleCount.value
  const inactive = vehicles.value.filter(v => ['tam_dung', 'thanh_ly'].includes(v.trang_thai)).length
  
  return [
    {
      title: 'Tổng số xe',
      value: total,
      icon: 'mdi:truck',
      color: 'blue',
      change: `${total} xe`,
      changeType: 'neutral',
    },
    {
      title: 'Xe hoạt động',
      value: active,
      icon: 'mdi:check-circle',
      color: 'green',
      change: total > 0 ? `${((active/total)*100).toFixed(1)}%` : '0%',
      changeType: 'neutral',
    },
    {
      title: 'Xe cần bảo trì',
      value: maintenance,
      icon: 'mdi:alert-circle',
      color: 'yellow',
      change: `${maintenance} xe`,
      changeType: maintenance > 0 ? 'negative' : 'neutral',
    },
    {
      title: 'Xe ngừng hoạt động',
      value: inactive,
      icon: 'mdi:close-circle',
      color: 'red',
      change: `${inactive} xe`,
      changeType: inactive > 0 ? 'negative' : 'positive',
    },
  ]
})

// Fuel Trend Data (computed from API data)
const fuelTrendData = computed(() => {
  // Group fuel data by month, filter by selected year
  const monthlyData = {}
  fuelData.value.forEach(f => {
    // Sử dụng thoi_gian_do thay vì ngay_do
    const dateField = f.thoi_gian_do || f.ngay_do
    if (dateField) {
      const date = new Date(dateField)
      const year = date.getFullYear()
      // Chỉ lấy dữ liệu của năm được chọn
      if (year === selectedYear.value) {
        const month = date.getMonth()
        // Sử dụng tong_tien thay vì chi_phi
        const cost = f.tong_tien || f.chi_phi || 0
        monthlyData[month] = (monthlyData[month] || 0) + parseFloat(cost)
      }
    }
  })
  
  const months = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12']
  const data = months.map((_, i) => (monthlyData[i] || 0) / 1000000) // Convert to millions
  
  return {
    labels: months,
    datasets: [
      {
        label: 'Chi phí nhiên liệu (triệu đồng)',
        data,
        backgroundColor: '#FFB347',
        borderRadius: 6,
        borderSkipped: false,
      },
    ],
  }
})

const fuelTrendOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      grid: {
        color: '#f3f4f6',
      },
    },
    x: {
      grid: {
        display: false,
      },
    },
  },
}

// Fuel Cost Distribution (computed by vehicle type) - Horizontal Bar Chart
const fuelCostData = computed(() => {
  const typeGroups = {}
  
  fuelData.value.forEach(f => {
    const vehicle = vehicles.value.find(v => v.id === f.xe_id)
    const type = vehicle?.loai_xe_ten || 'Khác'
    const cost = parseFloat(f.tong_tien || f.chi_phi || 0)
    typeGroups[type] = (typeGroups[type] || 0) + cost
  })
  
  const labels = Object.keys(typeGroups).length > 0 ? Object.keys(typeGroups) : ['Chưa có dữ liệu']
  const data = Object.values(typeGroups).length > 0 ? Object.values(typeGroups).map(v => v/1000000) : [0]
  
  return {
    labels,
    datasets: [
      {
        label: 'Chi phí (triệu đồng)',
        data,
        backgroundColor: '#FBBF24',
        borderRadius: 4,
        borderSkipped: false,
      },
    ],
  }
})

const fuelCostOptions = {
  indexAxis: 'y',
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
    },
  },
  scales: {
    x: {
      beginAtZero: true,
      grid: {
        color: '#f3f4f6',
      },
    },
    y: {
      grid: {
        display: false,
      },
    },
  },
}

// Maintenance Schedule (computed from xe deadlines API)
const maintenanceSchedule = computed(() => {
  return upcomingExpiries.value
    .map(item => ({
      id: `${item.xe_id}-${item.loai_han}`,
      licensePlate: item.bien_so || 'N/A',
      vehicleType: item.loai_xe_ten || 'N/A',
      maintenanceType: item.loai_han_label || 'Bao tri',
      dueDate: item.due_date,
      daysLeft: item.days_left,
      status: item.muc_do_uu_tien === 'qua_han'
        ? 'urgent'
        : item.muc_do_uu_tien === 'sap_het_han'
          ? 'pending'
          : 'scheduled'
    }))
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 5)
})

const formatDate = (date) => {
  if (!date) return 'N/A'
  return new Date(date).toLocaleDateString('vi-VN')
}

const formatDateTime = (date) => {
  if (!date) return 'N/A'
  return new Date(date).toLocaleString('vi-VN')
}

const getAlertLevelClass = (level) => {
  if (level === 'nghiem_trong') return 'alert-critical'
  if (level === 'cao') return 'alert-high'
  if (level === 'trung_binh') return 'alert-medium'
  return 'alert-low'
}

const getAlertTypeText = (type) => {
  if (type === 'nhien_lieu_bat_thuong') return 'Nhiên liệu bất thường'
  return 'Cảnh báo hệ thống'
}

const getStatusClass = (status) => {
  switch (status) {
    case 'urgent':
      return 'status-urgent'
    case 'pending':
      return 'status-pending'
    case 'scheduled':
      return 'status-scheduled'
    default:
      return ''
  }
}

const getStatusText = (status) => {
  switch (status) {
    case 'urgent':
      return 'Cần xử lý gấp'
    case 'pending':
      return 'Đang chờ'
    case 'scheduled':
      return 'Đã lên lịch'
    default:
      return ''
  }
}

const getColorClass = (color) => {
  return `kpi-${color}`
}

const exportDashboardReport = () => {
  if (loading.value) {
    window.alert('Dữ liệu đang tải, vui lòng thử lại sau vài giây.')
    return
  }

  if (vehicles.value.length === 0 && fuelData.value.length === 0 && alertsData.value.length === 0) {
    window.alert('Không có dữ liệu để xuất báo cáo.')
    return
  }

  const year = selectedYear.value
  const kpi = kpiData.value

  const lines = []
  lines.push(['FleetPro Dashboard Report'])
  lines.push([`Thoi gian xuat`, new Date().toLocaleString('vi-VN')])
  lines.push([`Nam phan tich`, String(year)])
  lines.push([])

  lines.push(['KPI'])
  lines.push(['Chi so', 'Gia tri'])
  kpi.forEach((item) => {
    lines.push([item.title, String(item.value)])
  })
  lines.push([])

  lines.push(['Chi phi nhien lieu theo thang (trieu VND)'])
  lines.push(['Thang', 'Gia tri'])
  const monthlyDataset = fuelTrendData.value?.datasets?.[0]?.data || []
  const monthlyLabels = fuelTrendData.value?.labels || []
  monthlyLabels.forEach((label, index) => {
    lines.push([String(label), String(monthlyDataset[index] || 0)])
  })
  lines.push([])

  lines.push(['Phan bo chi phi nhien lieu theo loai xe (trieu VND)'])
  lines.push(['Loai xe', 'Gia tri'])
  const typeDataset = fuelCostData.value?.datasets?.[0]?.data || []
  const typeLabels = fuelCostData.value?.labels || []
  typeLabels.forEach((label, index) => {
    lines.push([String(label), String(typeDataset[index] || 0)])
  })
  lines.push([])

  lines.push(['Canh bao gan day'])
  lines.push(['Thoi gian', 'Loai', 'Muc do', 'Tieu de'])
  recentFuelAlerts.value.forEach((item) => {
    lines.push([
      formatDateTime(item.tao_luc),
      getAlertTypeText(item.loai_canh_bao),
      String(item.muc_do || ''),
      String(item.tieu_de || 'Canh bao he thong'),
    ])
  })
  lines.push([])

  lines.push(['Lich bao tri sap toi'])
  lines.push(['Bien so', 'Loai xe', 'Loai han', 'Ngay den han', 'Trang thai'])
  maintenanceSchedule.value.forEach((item) => {
    lines.push([
      item.licensePlate,
      item.vehicleType,
      item.maintenanceType,
      formatDate(item.dueDate),
      getStatusText(item.status),
    ])
  })

  const csvContent = lines
    .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `dashboard-report-${year}-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)

  window.alert('Đã xuất báo cáo Dashboard thành công.')
}

const buildAgentText = (payload) => {
  if (!payload) return 'Không nhận được dữ liệu từ AI Agent.'

  const base = payload.answer || 'Đã xử lý xong yêu cầu.'
  const items = Array.isArray(payload.items) ? payload.items : []

  if (items.length === 0) return base

  const lines = items.slice(0, 6).map((item, index) => {
    if (payload.intent === 'deadline_alerts') {
      return `${index + 1}. ${item.bien_so}: Đăng kiểm ${item.con_han_dang_kiem ?? 'N/A'} ngày, Bảo hiểm ${item.con_han_bao_hiem ?? 'N/A'} ngày, Lốp ${item.con_han_thay_lop ?? 'N/A'} ngày`
    }

    if (payload.intent === 'fuel_analysis') {
      return `${index + 1}. ${item.bien_so}: tiêu hao ${item.muc_tieu_hao_thuc_te ?? 'N/A'}L/100km, vượt ${item.ty_le_vuot_dinh_muc ?? 0}%`
    }

    return `${index + 1}. ${item.bien_so}: tiêu hao ${item.muc_tieu_hao ?? 'N/A'}L/100km, vượt ${item.ty_le_vuot_dinh_muc ?? 0}%`
  })

  return `${base}\n\n${lines.join('\n')}`
}

const sendToAgent = async (questionText) => {
  const question = (questionText || chatInput.value).trim()
  if (!question || chatLoading.value) return

  chatMessages.value.push({
    id: Date.now(),
    role: 'user',
    text: question,
    createdAt: new Date().toISOString(),
  })

  chatInput.value = ''
  chatLoading.value = true

  const toDate = new Date()
  const fromDate = new Date()
  fromDate.setDate(toDate.getDate() - 30)

  try {
    const response = await aiAgentService.ask({
      question,
      from: fromDate.toISOString().slice(0, 10),
      to: toDate.toISOString().slice(0, 10),
      days: 30,
    })

    chatMessages.value.push({
      id: Date.now() + 1,
      role: 'agent',
      text: buildAgentText(response.data),
      createdAt: new Date().toISOString(),
    })
  } catch (err) {
    const message = err?.response?.data?.message || err.message || 'Lỗi không xác định'
    chatMessages.value.push({
      id: Date.now() + 1,
      role: 'agent',
      text: `Không thể lấy dữ liệu từ AI Agent: ${message}`,
      createdAt: new Date().toISOString(),
    })
  } finally {
    chatLoading.value = false
  }
}

const scrollChatToBottom = async (smooth = true) => {
  await nextTick()
  if (!chatBodyRef.value) return

  chatBodyRef.value.scrollTo({
    top: chatBodyRef.value.scrollHeight,
    behavior: smooth ? 'smooth' : 'auto',
  })
}

const formatChatTime = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  })
}

watch(chatOpen, (isOpen) => {
  if (isOpen) {
    scrollChatToBottom(false)
  }
})

watch(
  () => chatMessages.value.length,
  () => {
    scrollChatToBottom(true)
  }
)

watch(chatLoading, () => {
  scrollChatToBottom(true)
})
</script>

<template>
  <div class="dashboard">
    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <Icon icon="mdi:loading" class="loading-icon" />
      <p>Đang tải dữ liệu...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <Icon icon="mdi:alert-circle" class="error-icon" />
      <p>{{ error }}</p>
      <button class="btn btn-primary" @click="fetchDashboardData">Thử lại</button>
    </div>

    <template v-else>
    <div class="dashboard-header">
      <div>
        <h1 class="page-title">Dashboard</h1>
        <p class="page-subtitle">Tổng quan hệ thống quản lý đội xe</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-secondary" @click="exportDashboardReport">
          <Icon icon="mdi:download" class="icon-sm" />
          Xuất báo cáo
        </button>
        <button class="btn btn-success" @click="fetchDashboardData">
          <Icon icon="mdi:refresh" class="icon-sm" />
          Làm mới
        </button>
      </div>
    </div>

    <!-- KPI Cards -->
    <div class="kpi-grid">
      <div v-for="kpi in kpiData" :key="kpi.title" class="kpi-card" :class="getColorClass(kpi.color)">
        <div class="kpi-icon">
          <Icon :icon="kpi.icon" class="icon-lg" />
        </div>
        <div class="kpi-content">
          <p class="kpi-title">{{ kpi.title }}</p>
          <p class="kpi-value">{{ kpi.value }}</p>
          <p class="kpi-change" :class="`change-${kpi.changeType}`">{{ kpi.change }}</p>
        </div>
      </div>
    </div>

    <!-- Charts Section -->
    <div class="charts-grid">
      <div class="chart-card">
        <div class="card-header">
          <h3>Xu hướng chi phí nhiên liệu</h3>
          <select class="select-year" v-model="selectedYear">
            <option v-for="year in availableYears" :key="year" :value="year">{{ year }}</option>
            <option v-if="availableYears.length === 0" :value="2025">2025</option>
          </select>
        </div>
        <div class="chart-container">
          <Bar :data="fuelTrendData" :options="fuelTrendOptions" />
        </div>
      </div>

      <div class="chart-card">
        <div class="card-header">
          <h3>Phân bổ chi phí nhiên liệu</h3>
        </div>
        <div class="chart-container-bar">
          <Bar :data="fuelCostData" :options="fuelCostOptions" />
        </div>
      </div>
    </div>

    <div class="table-card alerts-card">
      <div class="card-header">
        <h3>Cảnh báo gần đây</h3>
        <RouterLink to="/alerts" class="link-view-all">
          Xem tất cả
          <Icon icon="mdi:arrow-right" class="icon-sm" />
        </RouterLink>
      </div>
      <div v-if="recentFuelAlerts.length > 0" class="alerts-list">
        <div v-for="item in recentFuelAlerts" :key="item.id" class="alert-item" :class="getAlertLevelClass(item.muc_do)">
          <div class="alert-main">
            <p class="alert-title">{{ item.tieu_de || 'Cảnh báo hệ thống' }}</p>
            <p class="alert-meta">{{ getAlertTypeText(item.loai_canh_bao) }} - {{ formatDateTime(item.tao_luc) }}</p>
          </div>
          <RouterLink to="/alerts" class="btn-icon" title="Xem cảnh báo">
            <Icon icon="mdi:open-in-new" class="icon-sm" />
          </RouterLink>
        </div>
      </div>
      <div v-else class="alerts-empty">
        <Icon icon="mdi:shield-check" class="icon-lg" />
        <p>Chưa có cảnh báo nào trong hệ thống.</p>
      </div>
    </div>

    <!-- Maintenance Table -->
    <div class="table-card">
      <div class="card-header">
        <h3>Lịch bảo trì sắp tới</h3>
        <RouterLink to="/maintenance" class="link-view-all">
          Xem tất cả
          <Icon icon="mdi:arrow-right" class="icon-sm" />
        </RouterLink>
      </div>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Biển số xe</th>
              <th>Loại xe</th>
              <th>Loại bảo trì</th>
                <th>Ngày hết hạn</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in maintenanceSchedule" :key="item.id">
              <td class="font-medium">{{ item.licensePlate }}</td>
              <td>{{ item.vehicleType }}</td>
              <td>{{ item.maintenanceType }}</td>
              <td>{{ formatDate(item.dueDate) }}</td>
              <td>
                <span class="status-badge" :class="getStatusClass(item.status)">
                  {{ getStatusText(item.status) }}
                </span>
              </td>
              <td>
                <RouterLink to="/maintenance" class="btn-icon" title="Xem chi tiết">
                  <Icon icon="mdi:eye" class="icon-sm" />
                </RouterLink>
                <RouterLink to="/maintenance" class="btn-icon" title="Xử lý ngay">
                  <Icon icon="mdi:wrench" class="icon-sm" />
                </RouterLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <button class="ai-chat-fab" @click="chatOpen = !chatOpen">
      <Icon :icon="chatOpen ? 'mdi:close' : 'mdi:robot-happy-outline'" class="icon-lg" />
      <span>{{ chatOpen ? 'Đóng AI' : 'AI Agent' }}</span>
    </button>

    <section v-if="chatOpen" class="ai-chat-panel">
      <div class="ai-chat-header">
        <h3>
          <Icon icon="mdi:robot-happy-outline" class="icon-sm" />
          Trợ lý Fleet AI
        </h3>
      </div>

      <div class="ai-chat-prompts">
        <button
          v-for="prompt in quickPrompts"
          :key="prompt"
          class="ai-prompt-btn"
          @click="sendToAgent(prompt)"
          :disabled="chatLoading"
        >
          {{ prompt }}
        </button>
      </div>

      <div ref="chatBodyRef" class="ai-chat-body">
        <article
          v-for="msg in chatMessages"
          :key="msg.id"
          :class="['ai-message', msg.role === 'user' ? 'ai-message-user' : 'ai-message-agent']"
        >
          <p>{{ msg.text }}</p>
          <time class="ai-message-time">{{ formatChatTime(msg.createdAt) }}</time>
        </article>

        <div v-if="chatLoading" class="ai-message ai-message-agent ai-message-loading">
          <Icon icon="mdi:loading" class="loading-icon-inline" />
          <span>AI đang phân tích dữ liệu...</span>
        </div>
      </div>

      <div class="ai-chat-input-wrap">
        <input
          v-model="chatInput"
          type="text"
          class="ai-chat-input"
          placeholder="Đặt câu hỏi cho AI Agent..."
          :disabled="chatLoading"
          @keyup.enter="sendToAgent()"
        />
        <button class="btn btn-primary" :disabled="chatLoading" @click="sendToAgent()">
          <Icon icon="mdi:send" class="icon-sm" />
          Gửi
        </button>
      </div>
    </section>
    </template>
  </div>
</template>

<style scoped>
.dashboard {
  max-width: 1400px;
  margin: 0 auto;
}

/* Loading and Error States */
.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;
}

.loading-icon {
  font-size: 3rem;
  color: #FFB347;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.error-state .error-icon {
  font-size: 3rem;
  color: #ef4444;
  margin-bottom: 1rem;
}

.error-state p {
  color: #6b7280;
  margin-bottom: 1rem;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.page-title {
  font-size: 1.875rem;
  font-weight: 700;
  color: #111827;
  margin-bottom: 0.25rem;
}

.page-subtitle {
  color: #6b7280;
  font-size: 0.875rem;
}

.header-actions {
  display: flex;
  gap: 0.75rem;
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-weight: 500;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.15s ease;
  border: none;
}

.btn-primary {
  background: linear-gradient(135deg, #FFB347 0%, #FFCC33 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(255, 179, 71, 0.3);
}
.btn-primary:hover {
  box-shadow: 0 4px 12px rgba(255, 179, 71, 0.4);
  transform: translateY(-1px);
}

.btn-success {
  background: linear-gradient(135deg, #10B981 0%, #34D399 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
}
.btn-success:hover {
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
  transform: translateY(-1px);
}

.btn-secondary {
  background: white;
  color: #374151;
  border: 1px solid #d1d5db;
}
.btn-secondary:hover {
  background: #f9fafb;
}

.btn-icon {
  padding: 0.5rem;
  border-radius: 0.375rem;
  border: none;
  background: transparent;
  cursor: pointer;
  color: #6b7280;
}
.btn-icon:hover {
  background: #f3f4f6;
  color: #111827;
}

.icon-sm {
  width: 1rem;
  height: 1rem;
}
.icon-lg {
  width: 1.5rem;
  height: 1.5rem;
}

/* KPI Cards - 30% yellow accents */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(1, 1fr);
  gap: 1rem;
  margin-bottom: 1.5rem;
}

@media (min-width: 640px) {
  .kpi-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1024px) {
  .kpi-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

.kpi-card {
  background: white;
  border-radius: 0.75rem;
  padding: 1.5rem;
  display: flex;
  gap: 1rem;
  border: 1px solid #e5e7eb;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  transition: all 0.2s ease;
}

.kpi-card:hover {
  border-color: #FFE5B4;
  box-shadow: 0 4px 12px rgba(255, 179, 71, 0.15);
}

.kpi-icon {
  width: 3rem;
  height: 3rem;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.kpi-blue .kpi-icon {
  background: #EBF5FF;
  color: #3B82F6;
}
.kpi-green .kpi-icon {
  background: #ECFDF5;
  color: #10B981;
}
.kpi-yellow .kpi-icon {
  background: #FFF8E7;
  color: #F59E0B;
}
.kpi-red .kpi-icon {
  background: #FEF2F2;
  color: #EF4444;
}

.kpi-content {
  flex: 1;
}

.kpi-title {
  font-size: 0.875rem;
  color: #6b7280;
  margin-bottom: 0.25rem;
}

.kpi-value {
  font-size: 1.875rem;
  font-weight: 700;
  color: #111827;
}

.kpi-change {
  font-size: 0.75rem;
  font-weight: 500;
  margin-top: 0.25rem;
}

.change-positive {
  color: #16a34a;
}
.change-negative {
  color: #dc2626;
}
.change-neutral {
  color: #6b7280;
}

/* Charts - with yellow accent borders */
.charts-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
  margin-bottom: 1.5rem;
}

@media (min-width: 1024px) {
  .charts-grid {
    grid-template-columns: 2fr 1fr;
  }
}

.chart-card,
.table-card {
  background: white;
  border-radius: 0.75rem;
  border: 1px solid #e5e7eb;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
}

.chart-card:hover,
.table-card:hover {
  border-color: #FFE5B4;
}

.alerts-card {
  margin-bottom: 1.5rem;
}

.alerts-list {
  display: grid;
  gap: 0.75rem;
  padding: 1rem 1.5rem 1.25rem;
}

.alert-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border: 1px solid #e5e7eb;
  border-left-width: 4px;
  border-radius: 0.5rem;
  padding: 0.75rem;
  background: #ffffff;
}

.alert-main {
  min-width: 0;
}

.alert-title {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: #111827;
}

.alert-meta {
  margin: 0.2rem 0 0;
  font-size: 0.75rem;
  color: #6b7280;
}

.alert-critical {
  border-left-color: #dc2626;
  background: #fef2f2;
}

.alert-high {
  border-left-color: #ea580c;
  background: #fff7ed;
}

.alert-medium {
  border-left-color: #d97706;
  background: #fffbeb;
}

.alert-low {
  border-left-color: #0ea5e9;
  background: #f0f9ff;
}

.alerts-empty {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #6b7280;
  padding: 1rem 1.5rem 1.25rem;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  background: #FFFDF7;
}

.card-header h3 {
  font-size: 1rem;
  font-weight: 600;
  color: #111827;
}

.select-year {
  padding: 0.375rem 0.75rem;
  border: 1px solid #FFE5B4;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  background: white;
}

.select-year:focus {
  outline: none;
  border-color: #FFB347;
  box-shadow: 0 0 0 2px rgba(255, 179, 71, 0.2);
}

.chart-container {
  padding: 1.5rem;
  height: 300px;
}

.chart-container-bar {
  padding: 1.5rem;
  height: 280px;
}

.chart-container-doughnut {
  padding: 1.5rem;
  height: 280px;
  display: flex;
  justify-content: center;
}

.link-view-all {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  color: #F59E0B;
  font-size: 0.875rem;
  font-weight: 500;
  text-decoration: none;
}
.link-view-all:hover {
  color: #D97706;
}

/* Table - 10% yellow accents */
.table-container {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: 0.75rem 1rem;
  text-align: left;
}

th {
  background: #FFFDF7;
  font-weight: 600;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #374151;
  border-bottom: 2px solid #FFE5B4;
}

td {
  font-size: 0.875rem;
  color: #374151;
  border-bottom: 1px solid #f3f4f6;
}

.font-medium {
  font-weight: 500;
  color: #111827;
}

tbody tr:hover {
  background: #FFFDF7;
}

/* Status Badge - 10% accent colors */
.status-badge {
  display: inline-flex;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
}

.status-urgent {
  background: #fef2f2;
  color: #dc2626;
}

.status-pending {
  background: #FFF8E7;
  color: #D97706;
}

.status-scheduled {
  background: #FFFBEB;
  color: #92400E;
}

/* Action Buttons - 10% accent */
.btn-icon {
  padding: 0.375rem;
  background: transparent;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  color: #6b7280;
  transition: all 0.15s ease;
}

.btn-icon:hover {
  background: #FFF8E7;
  color: #F59E0B;
}

.ai-chat-fab {
  position: fixed;
  right: 1.5rem;
  bottom: 1.5rem;
  z-index: 70;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  border: none;
  border-radius: 9999px;
  padding: 0.75rem 1rem;
  cursor: pointer;
  color: #111827;
  font-weight: 700;
  background: linear-gradient(135deg, #fde68a 0%, #fbbf24 100%);
  box-shadow: 0 10px 25px rgba(245, 158, 11, 0.35);
}

.ai-chat-panel {
  position: fixed;
  right: 1.5rem;
  bottom: 5.25rem;
  z-index: 70;
  width: min(430px, calc(100vw - 2rem));
  height: min(560px, calc(100vh - 8rem));
  background: #ffffff;
  border: 1px solid #fde68a;
  border-radius: 0.875rem;
  box-shadow: 0 20px 40px rgba(15, 23, 42, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.ai-chat-header {
  padding: 0.875rem 1rem;
  border-bottom: 1px solid #f3f4f6;
  background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
}

.ai-chat-header h3 {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0;
  font-size: 0.95rem;
  color: #92400e;
}

.ai-chat-prompts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #f3f4f6;
}

.ai-prompt-btn {
  border: 1px solid #fde68a;
  border-radius: 999px;
  background: #fffdf7;
  color: #92400e;
  font-size: 0.75rem;
  padding: 0.35rem 0.65rem;
  cursor: pointer;
}

.ai-prompt-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.ai-chat-body {
  flex: 1;
  padding: 0.75rem 1rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  background: #fafafa;
}

.ai-message {
  max-width: 88%;
  padding: 0.6rem 0.75rem;
  border-radius: 0.65rem;
  white-space: pre-wrap;
  font-size: 0.85rem;
  line-height: 1.35;
}

.ai-message p {
  margin: 0;
}

.ai-message-time {
  display: block;
  margin-top: 0.35rem;
  font-size: 0.7rem;
  opacity: 0.8;
}

.ai-message-user {
  align-self: flex-end;
  background: #f59e0b;
  color: #ffffff;
}

.ai-message-user .ai-message-time {
  color: rgba(255, 255, 255, 0.9);
}

.ai-message-agent {
  align-self: flex-start;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  color: #111827;
}

.ai-message-agent .ai-message-time {
  color: #6b7280;
}

.ai-message-loading {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.loading-icon-inline {
  animation: spin 1s linear infinite;
}

.ai-chat-input-wrap {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem;
  border-top: 1px solid #f3f4f6;
  background: #ffffff;
}

.ai-chat-input {
  flex: 1;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
}

.ai-chat-input:focus {
  outline: none;
  border-color: #f59e0b;
  box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.2);
}

@media (max-width: 768px) {
  .ai-chat-fab {
    right: 1rem;
    bottom: 1rem;
  }

  .ai-chat-panel {
    right: 1rem;
    bottom: 4.9rem;
    width: calc(100vw - 2rem);
    height: calc(100vh - 7rem);
  }
}
</style>
