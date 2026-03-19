# 🚛 FleetPro - Hệ thống Quản lý Đội xe Vận tải & Container

Ứng dụng quản lý đội xe toàn diện được xây dựng bằng Vue 3 + Vite, cung cấp các tính năng theo dõi xe, phân tích nhiên liệu, quản lý bảo trì và cảnh báo hệ thống.

![Vue.js](https://img.shields.io/badge/Vue.js-3.5.25-4FC08D?style=flat-square&logo=vue.js)
![Vite](https://img.shields.io/badge/Vite-7.2.4-646CFF?style=flat-square&logo=vite)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)

---

## 🎯 Bối cảnh & Vấn đề cần giải quyết

### Bối cảnh thực tế
Các công ty vận tải có hàng chục đầu xe cần quản lý:
- **Lịch trình vận chuyển** của từng xe
- **Chi phí xăng dầu** hàng tháng
- **Lịch bảo trì, đăng kiểm** định kỳ

### Vấn đề gặp phải
| Vấn đề | Hậu quả |
|--------|---------|
| 🔴 Tài xế khai khống xăng dầu | Thất thoát chi phí, khó kiểm soát |
| 🔴 Xe đến hạn đăng kiểm nhưng quên | Bị phạt, xe không được lưu thông |
| 🔴 Không có hệ thống cảnh báo | Phản ứng chậm, thiệt hại lớn |
| 🔴 Dữ liệu phân tán, không tập trung | Khó ra quyết định quản lý |

### Giải pháp đề xuất
Xây dựng hệ thống **FleetPro** với các tính năng:
1. **Cost Analysis**: Phân tích định mức tiêu hao nhiên liệu (Lít/100km)
2. **Maintenance Schedule**: Quản lý hạn đăng kiểm, bảo hiểm, thay lốp
3. **Alert System**: Cảnh báo tự động khi vượt định mức hoặc sắp hết hạn

---

## 📋 Mô tả chi tiết các bước xây dựng dự án

### **Bước 1: Khởi tạo dự án Vue 3 với Vite**

#### 1.1. Tạo dự án mới
```bash
npm create vue@latest VUE_01
```
Chọn các options:
- ✅ Add Vue Router for Single Page Application development
- ✅ Add Pinia for state management
- ❌ Add Vitest for Unit Testing
- ❌ Add an End-to-End Testing Solution
- ✅ Add ESLint for code quality
- ✅ Add Prettier for code formatting

#### 1.2. Cài đặt dependencies bổ sung
```bash
npm install @iconify/vue chart.js vue-chartjs
```

| Package | Mục đích |
|---------|----------|
| `@iconify/vue` | Thư viện icons phong phú (Material Design, FontAwesome...) |
| `chart.js` | Thư viện vẽ biểu đồ |
| `vue-chartjs` | Wrapper Vue cho Chart.js |

#### 1.3. Cấu trúc package.json
```json
{
  "dependencies": {
    "@iconify/vue": "^5.0.0",
    "chart.js": "^4.5.1",
    "pinia": "^3.0.4",
    "vue": "^3.5.25",
    "vue-chartjs": "^5.3.3",
    "vue-router": "^4.6.3"
  }
}
```

---

### **Bước 2: Thiết kế Layout chính (App.vue)**

#### 2.1. Phân tích yêu cầu UI
```
┌─────────────────────────────────────────────────────────────┐
│                        TOPBAR                                │
│  [☰]  🚛 FleetPro     [🔍 Tìm kiếm...]     [🔔] [User ▼]   │
├──────────┬──────────────────────────────────────────────────┤
│ SIDEBAR  │                                                   │
│          │                                                   │
│ Dashboard│              MAIN CONTENT                         │
│ Xe       │              (RouterView)                         │
│ Nhiên liệu│                                                  │
│ Bảo trì  │                                                   │
│ Cảnh báo │                                                   │
│          │                                                   │
└──────────┴──────────────────────────────────────────────────┘
```

#### 2.2. Thiết kế Topbar
```vue
<header class="topbar">
  <!-- Logo & Brand -->
  <div class="brand">
    <Icon icon="mdi:truck" />
    <h1>FleetPro</h1>
    <p>Quản lý đội xe</p>
  </div>
  
  <!-- Search Bar -->
  <div class="search-container">
    <Icon icon="mdi:magnify" />
    <input placeholder="Tìm kiếm xe, tài xế..." />
  </div>
  
  <!-- User Info & Notifications -->
  <div class="topbar-right">
    <button class="notification-btn">
      <Icon icon="mdi:bell" />
      <span class="badge"></span>  <!-- Hiển thị số cảnh báo -->
    </button>
    <div class="user-info">
      <p>Nguyễn Văn A</p>
      <p>Quản lý</p>
    </div>
  </div>
</header>
```

#### 2.3. Thiết kế Sidebar Navigation
```javascript
const menuItems = [
  { path: '/', label: 'Dashboard', icon: 'mdi:view-dashboard' },
  { path: '/vehicles', label: 'Danh sách xe', icon: 'mdi:truck' },
  { path: '/fuel', label: 'Phân tích nhiên liệu', icon: 'mdi:fuel' },
  { path: '/maintenance', label: 'Bảo trì & Đăng kiểm', icon: 'mdi:wrench' },
  { path: '/alerts', label: 'Cảnh báo', icon: 'mdi:bell-alert' },
]
```

#### 2.4. Responsive Design
- **Desktop (>1024px)**: Sidebar cố định bên trái
- **Tablet (768-1024px)**: Sidebar thu gọn, chỉ hiện icon
- **Mobile (<768px)**: Sidebar ẩn, click menu button để mở overlay

---

### **Bước 3: Cấu hình Vue Router**

#### 3.1. Tạo file router/index.js
```javascript
import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'dashboard',
    component: () => import('../views/DashboardView.vue'),
    meta: { title: 'Tổng quan' }
  },
  {
    path: '/vehicles',
    name: 'vehicles',
    component: () => import('../views/VehiclesView.vue'),
    meta: { title: 'Danh sách xe' }
  },
  {
    path: '/vehicles/:id',
    name: 'vehicle-detail',
    component: () => import('../views/VehicleDetailView.vue'),
    meta: { title: 'Chi tiết xe' }
  },
  // ... các routes khác
]
```

#### 3.2. Lazy Loading
Sử dụng `() => import(...)` để **lazy load** các view, giúp:
- Giảm bundle size ban đầu
- Tải component khi cần thiết
- Cải thiện performance

---

### **Bước 4: Xây dựng DashboardView - Trang tổng quan**

#### 4.1. Phân tích yêu cầu Dashboard
Dashboard cần hiển thị:
1. **KPI Cards**: Tổng quan nhanh về đội xe
2. **Biểu đồ xu hướng**: Chi phí nhiên liệu theo thời gian
3. **Biểu đồ phân bố**: Phân loại chi phí theo loại xe
4. **Bảng cảnh báo**: Xe sắp hết hạn đăng kiểm/bảo hiểm

#### 4.2. Thiết kế KPI Cards
```javascript
const kpiData = [
  {
    title: 'Tổng số xe',
    value: 48,
    icon: 'mdi:truck',
    color: 'blue',
    change: '+2',           // So với tháng trước
    changeType: 'positive'  // positive/negative/neutral
  },
  {
    title: 'Xe hoạt động',
    value: 42,
    icon: 'mdi:check-circle',
    color: 'green',
    change: '87.5%',        // Tỷ lệ hoạt động
    changeType: 'neutral'
  },
  {
    title: 'Xe cần bảo trì',
    value: 5,
    icon: 'mdi:alert-circle',
    color: 'yellow',
    change: '+1',
    changeType: 'negative'  // Tăng = xấu
  },
  {
    title: 'Xe ngừng hoạt động',
    value: 1,
    icon: 'mdi:close-circle',
    color: 'red',
    change: '-1',
    changeType: 'positive'  // Giảm = tốt
  },
]
```

#### 4.3. Biểu đồ Chi phí Nhiên liệu (Bar Chart)
```javascript
// Sử dụng vue-chartjs
import { Bar } from 'vue-chartjs'

const fuelTrendData = {
  labels: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'],
  datasets: [{
    label: 'Chi phí nhiên liệu (triệu đồng)',
    data: [85, 92, 88, 95, 102, 98, 105, 110, 108, 115, 120, 125],
    backgroundColor: '#3b82f6',
    borderRadius: 4,
  }]
}
```

#### 4.4. Biểu đồ Phân bố Chi phí (Doughnut Chart)
```javascript
import { Doughnut } from 'vue-chartjs'

const fuelCostData = {
  labels: ['Xe tải', 'Xe khách', 'Xe con', 'Xe máy'],
  datasets: [{
    data: [45, 30, 20, 5],  // Phần trăm
    backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'],
  }]
}
```

#### 4.5. Bảng Lịch Bảo trì sắp tới
```javascript
const maintenanceSchedule = [
  {
    licensePlate: '29A-12345',
    vehicleType: 'Xe tải',
    maintenanceType: 'Bảo dưỡng định kỳ',
    dueDate: '2026-01-15',
    status: 'pending'       // pending/urgent/scheduled
  },
  {
    licensePlate: '30B-67890',
    vehicleType: 'Xe khách',
    maintenanceType: 'Đăng kiểm',
    dueDate: '2026-01-10',
    status: 'urgent'        // Còn < 7 ngày
  },
  // ...
]
```

**Logic xác định status:**
```javascript
function getMaintenanceStatus(dueDate) {
  const today = new Date()
  const due = new Date(dueDate)
  const daysLeft = Math.ceil((due - today) / (1000 * 60 * 60 * 24))
  
  if (daysLeft <= 7) return 'urgent'      // 🔴 Khẩn cấp
  if (daysLeft <= 30) return 'pending'    // 🟡 Sắp đến hạn
  return 'scheduled'                       // 🟢 Đã lên lịch
}
```

---

### **Bước 5: Xây dựng VehiclesView - Quản lý danh sách xe**

#### 5.1. Cấu trúc dữ liệu xe
```javascript
const vehicles = [
  {
    id: 'VH001',
    licensePlate: '29A-12345',      // Biển số
    driver: 'Nguyễn Văn An',        // Tài xế
    status: 'active',               // active/maintenance/inactive
    fuelConsumption: 8.5,           // Lít/100km (định mức)
    maintenanceStatus: 'normal',    // normal/warning/overdue
    vehicleType: 'Xe tải 5 tấn',
    brand: 'Hyundai Mighty',
  },
  // ...
]
```

#### 5.2. Tính năng Tìm kiếm & Lọc
```javascript
const searchTerm = ref('')
const statusFilter = ref('all')
const maintenanceFilter = ref('all')

const filteredVehicles = computed(() => {
  return vehicles.value.filter((vehicle) => {
    // Lọc theo từ khóa tìm kiếm
    const matchesSearch =
      vehicle.id.toLowerCase().includes(searchTerm.value.toLowerCase()) ||
      vehicle.licensePlate.toLowerCase().includes(searchTerm.value.toLowerCase()) ||
      vehicle.driver.toLowerCase().includes(searchTerm.value.toLowerCase())
    
    // Lọc theo trạng thái
    const matchesStatus = 
      statusFilter.value === 'all' || vehicle.status === statusFilter.value
    
    // Lọc theo tình trạng bảo trì
    const matchesMaintenance = 
      maintenanceFilter.value === 'all' || vehicle.maintenanceStatus === maintenanceFilter.value
    
    return matchesSearch && matchesStatus && matchesMaintenance
  })
})
```

#### 5.3. Hiển thị trạng thái bằng màu sắc
```javascript
function getStatusColor(status) {
  const colors = {
    active: 'bg-green-100 text-green-800',      // 🟢 Đang hoạt động
    maintenance: 'bg-yellow-100 text-yellow-800', // 🟡 Đang bảo trì
    inactive: 'bg-red-100 text-red-800',        // 🔴 Ngừng hoạt động
  }
  return colors[status]
}

function getMaintenanceStatusColor(status) {
  const colors = {
    normal: 'bg-green-100 text-green-800',      // 🟢 Bình thường
    warning: 'bg-yellow-100 text-yellow-800',   // 🟡 Cần chú ý
    overdue: 'bg-red-100 text-red-800',         // 🔴 Quá hạn
  }
  return colors[status]
}
```

---

### **Bước 6: Xây dựng FuelAnalysisView - Phân tích Nhiên liệu (Cost Analysis)**

#### 6.1. Yêu cầu nghiệp vụ
> **Tính định mức tiêu hao nhiên liệu (Lít/100km)** dựa trên số km đi được và số tiền đổ xăng → **Cảnh báo nếu vượt định mức**

#### 6.2. Công thức tính toán
```javascript
// Định mức tiêu chuẩn theo loại xe
const standardConsumption = {
  'Xe tải 5 tấn': 12,      // 12 Lít/100km
  'Xe tải 8 tấn': 15,
  'Xe khách 16 chỗ': 10,
  'Xe khách 29 chỗ': 14,
  'Xe con': 8,
}

// Tính tiêu hao thực tế
function calculateActualConsumption(liters, kilometers) {
  return (liters / kilometers) * 100  // Lít/100km
}

// So sánh với định mức
function checkFuelConsumption(vehicleType, actualConsumption) {
  const standard = standardConsumption[vehicleType]
  const deviation = ((actualConsumption - standard) / standard) * 100
  
  if (deviation > 20) return { status: 'danger', message: 'Vượt định mức >20%' }
  if (deviation > 10) return { status: 'warning', message: 'Vượt định mức >10%' }
  if (deviation > 0) return { status: 'caution', message: 'Vượt định mức nhẹ' }
  return { status: 'normal', message: 'Trong định mức' }
}
```

#### 6.3. Cấu trúc dữ liệu phân tích
```javascript
const fuelRecords = [
  {
    id: 1,
    vehicleId: 'VH001',
    licensePlate: '29A-12345',
    vehicleType: 'Xe tải 5 tấn',
    date: '2026-01-05',
    kilometers: 450,           // Số km đi được
    liters: 58,                // Số lít đổ
    amount: 1160000,           // Số tiền (VNĐ)
    pricePerLiter: 20000,      // Giá xăng
    actualConsumption: 12.89,  // Lít/100km thực tế
    standardConsumption: 12,   // Lít/100km định mức
    deviation: 7.4,            // % chênh lệch
    status: 'caution'          // normal/caution/warning/danger
  },
  // ...
]
```

#### 6.4. Giao diện Phân tích Nhiên liệu
```
┌─────────────────────────────────────────────────────────────────┐
│                    PHÂN TÍCH NHIÊN LIỆU                         │
├─────────────────────────────────────────────────────────────────┤
│ [Lọc theo xe ▼] [Từ ngày] [Đến ngày] [🔍 Phân tích]            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  📊 Tổng quan tháng này                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │Tổng chi  │ │Tổng km   │ │TB Lít/   │ │Xe vượt   │           │
│  │phí       │ │đã chạy   │ │100km     │ │định mức  │           │
│  │125 triệu │ │45,000 km │ │11.2      │ │5 xe      │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
│                                                                  │
│  📈 Biểu đồ xu hướng tiêu hao                                   │
│  [======================================] Bar Chart              │
│                                                                  │
│  📋 Chi tiết theo xe                                            │
│  ┌────────┬────────┬────────┬────────┬────────┬────────┐       │
│  │Biển số │Loại xe │Km chạy │Lít đổ  │Thực tế │Trạng   │       │
│  │        │        │        │        │Lít/100 │thái    │       │
│  ├────────┼────────┼────────┼────────┼────────┼────────┤       │
│  │29A-123 │Xe tải  │450 km  │58 L    │12.89   │⚠️ +7%  │       │
│  │30B-678 │Xe khách│380 km  │42 L    │11.05   │✅ OK   │       │
│  │51C-111 │Xe tải  │520 km  │85 L    │16.35   │🔴 +36% │       │
│  └────────┴────────┴────────┴────────┴────────┴────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

---

### **Bước 7: Xây dựng MaintenanceView - Quản lý Bảo trì & Đăng kiểm**

#### 7.1. Yêu cầu nghiệp vụ
> **Quản lý hạn đăng kiểm, hạn bảo hiểm, hạn thay lốp. Hiển thị Dashboard các xe sắp hết hạn.**

#### 7.2. Các loại bảo trì cần theo dõi
| Loại | Chu kỳ | Cảnh báo trước |
|------|--------|----------------|
| Đăng kiểm | 6-12 tháng | 30 ngày |
| Bảo hiểm | 12 tháng | 30 ngày |
| Thay dầu | 5,000 km hoặc 3 tháng | 500 km hoặc 7 ngày |
| Thay lốp | 40,000 km | 5,000 km |
| Bảo dưỡng định kỳ | 10,000 km | 1,000 km |

#### 7.3. Cấu trúc dữ liệu bảo trì
```javascript
const maintenanceRecords = [
  {
    id: 1,
    vehicleId: 'VH001',
    licensePlate: '29A-12345',
    vehicleType: 'Xe tải 5 tấn',
    maintenanceType: 'registration',  // đăng kiểm
    lastDate: '2025-07-15',
    nextDate: '2026-01-15',
    daysRemaining: 6,
    status: 'urgent',
    cost: 500000,
  },
  {
    id: 2,
    vehicleId: 'VH002',
    licensePlate: '30B-67890',
    maintenanceType: 'insurance',     // bảo hiểm
    lastDate: '2025-01-20',
    nextDate: '2026-01-20',
    daysRemaining: 11,
    status: 'warning',
    cost: 3500000,
  },
  // ...
]
```

#### 7.4. Logic xác định trạng thái cảnh báo
```javascript
function getMaintenanceStatus(nextDate, maintenanceType) {
  const today = new Date()
  const due = new Date(nextDate)
  const daysLeft = Math.ceil((due - today) / (1000 * 60 * 60 * 24))
  
  // Ngưỡng cảnh báo theo loại
  const thresholds = {
    registration: { urgent: 7, warning: 30 },   // Đăng kiểm
    insurance: { urgent: 7, warning: 30 },      // Bảo hiểm
    oil_change: { urgent: 3, warning: 7 },      // Thay dầu
    tire_change: { urgent: 7, warning: 14 },    // Thay lốp
    maintenance: { urgent: 7, warning: 14 },    // Bảo dưỡng
  }
  
  const threshold = thresholds[maintenanceType]
  
  if (daysLeft <= 0) return { status: 'overdue', label: 'Quá hạn', color: 'red' }
  if (daysLeft <= threshold.urgent) return { status: 'urgent', label: 'Khẩn cấp', color: 'red' }
  if (daysLeft <= threshold.warning) return { status: 'warning', label: 'Sắp đến hạn', color: 'yellow' }
  return { status: 'normal', label: 'Bình thường', color: 'green' }
}
```

#### 7.5. Giao diện Quản lý Bảo trì
```
┌─────────────────────────────────────────────────────────────────┐
│                    BẢO TRÌ & ĐĂNG KIỂM                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  🔴 CẢNH BÁO KHẨN CẤP (3 xe)                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 29A-12345 │ Đăng kiểm │ Còn 6 ngày │ [Xem chi tiết]    │   │
│  │ 30B-67890 │ Bảo hiểm  │ Còn 2 ngày │ [Xem chi tiết]    │   │
│  │ 51C-11111 │ Thay dầu  │ QUÁ HẠN    │ [Xem chi tiết]    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  🟡 SẮP ĐẾN HẠN (5 xe)                                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 29D-22222 │ Bảo dưỡng │ Còn 15 ngày │ [Lên lịch]       │   │
│  │ 30E-33333 │ Thay lốp  │ Còn 20 ngày │ [Lên lịch]       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  📅 LỊCH BẢO TRÌ THÁNG NÀY                                     │
│  [Calendar View với các mốc bảo trì]                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

### **Bước 8: Xây dựng AlertsView - Hệ thống Cảnh báo**

#### 8.1. Các loại cảnh báo
```javascript
const alertTypes = {
  fuel_excess: {
    icon: 'mdi:fuel',
    title: 'Vượt định mức nhiên liệu',
    severity: 'high',
    color: 'red'
  },
  registration_due: {
    icon: 'mdi:certificate',
    title: 'Đăng kiểm sắp hết hạn',
    severity: 'high',
    color: 'red'
  },
  insurance_due: {
    icon: 'mdi:shield-check',
    title: 'Bảo hiểm sắp hết hạn',
    severity: 'high',
    color: 'red'
  },
  maintenance_due: {
    icon: 'mdi:wrench',
    title: 'Cần bảo dưỡng',
    severity: 'medium',
    color: 'yellow'
  },
  tire_change: {
    icon: 'mdi:tire',
    title: 'Cần thay lốp',
    severity: 'medium',
    color: 'yellow'
  }
}
```

#### 8.2. Cấu trúc dữ liệu cảnh báo
```javascript
const alerts = [
  {
    id: 1,
    type: 'fuel_excess',
    vehicleId: 'VH003',
    licensePlate: '51C-11111',
    message: 'Xe 51C-11111 tiêu hao nhiên liệu vượt 36% so với định mức',
    details: {
      actual: 16.35,
      standard: 12,
      deviation: 36.25
    },
    timestamp: '2026-01-09T08:30:00',
    isRead: false,
    severity: 'high'
  },
  {
    id: 2,
    type: 'registration_due',
    vehicleId: 'VH001',
    licensePlate: '29A-12345',
    message: 'Xe 29A-12345 còn 6 ngày đến hạn đăng kiểm',
    details: {
      dueDate: '2026-01-15',
      daysRemaining: 6
    },
    timestamp: '2026-01-09T07:00:00',
    isRead: false,
    severity: 'high'
  },
  // ...
]
```

#### 8.3. Giao diện Cảnh báo
```
┌─────────────────────────────────────────────────────────────────┐
│  🔔 CẢNH BÁO HỆ THỐNG                    [Đánh dấu đã đọc tất cả] │
├─────────────────────────────────────────────────────────────────┤
│ [Tất cả] [🔴 Cao (5)] [🟡 Trung bình (3)] [🟢 Thấp (1)]        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ 🔴 HÔM NAY                                                      │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ⛽ Vượt định mức nhiên liệu                    08:30        │ │
│ │    Xe 51C-11111 tiêu hao vượt 36% định mức                  │ │
│ │    Thực tế: 16.35 L/100km | Định mức: 12 L/100km           │ │
│ │    [Xem chi tiết] [Bỏ qua]                                  │ │
│ ├─────────────────────────────────────────────────────────────┤ │
│ │ 📋 Đăng kiểm sắp hết hạn                      07:00        │ │
│ │    Xe 29A-12345 còn 6 ngày đến hạn đăng kiểm               │ │
│ │    Hạn: 15/01/2026                                          │ │
│ │    [Lên lịch] [Bỏ qua]                                      │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ 🟡 HÔM QUA                                                      │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 🔧 Cần bảo dưỡng định kỳ                      15:00        │ │
│ │    Xe 30E-33333 đã chạy 9,500km từ lần bảo dưỡng trước     │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

### **Bước 9: Xây dựng VehicleDetailView - Chi tiết xe**

#### 9.1. Thông tin hiển thị
```javascript
const vehicleDetail = {
  // Thông tin cơ bản
  id: 'VH001',
  licensePlate: '29A-12345',
  brand: 'Hyundai Mighty',
  vehicleType: 'Xe tải 5 tấn',
  year: 2022,
  color: 'Trắng',
  
  // Thông tin tài xế
  driver: {
    name: 'Nguyễn Văn An',
    phone: '0901234567',
    license: 'B2',
    experience: '5 năm'
  },
  
  // Thông tin kỹ thuật
  technical: {
    engineCapacity: '2500cc',
    fuelType: 'Diesel',
    standardConsumption: 12, // Lít/100km
    currentOdometer: 45000   // km
  },
  
  // Lịch sử bảo trì
  maintenanceHistory: [
    { date: '2025-12-01', type: 'Thay dầu', cost: 800000 },
    { date: '2025-10-15', type: 'Bảo dưỡng định kỳ', cost: 2500000 },
    // ...
  ],
  
  // Lịch sử đổ xăng
  fuelHistory: [
    { date: '2026-01-05', liters: 58, amount: 1160000, km: 450 },
    { date: '2026-01-02', liters: 55, amount: 1100000, km: 420 },
    // ...
  ]
}
```

---

### **Bước 10: Styling - CSS Design System**

#### 10.1. Color Palette
```css
:root {
  /* Primary Colors */
  --primary-50: #eff6ff;
  --primary-500: #3b82f6;
  --primary-600: #2563eb;
  --primary-700: #1d4ed8;
  
  /* Success Colors */
  --success-50: #ecfdf5;
  --success-500: #10b981;
  --success-700: #047857;
  
  /* Warning Colors */
  --warning-50: #fffbeb;
  --warning-500: #f59e0b;
  --warning-700: #b45309;
  
  /* Danger Colors */
  --danger-50: #fef2f2;
  --danger-500: #ef4444;
  --danger-700: #b91c1c;
  
  /* Neutral Colors */
  --gray-50: #f9fafb;
  --gray-100: #f3f4f6;
  --gray-200: #e5e7eb;
  --gray-500: #6b7280;
  --gray-700: #374151;
  --gray-900: #111827;
}
```

#### 10.2. Typography
```css
/* Font Family */
font-family: 'Inter', sans-serif;

/* Font Sizes */
--text-xs: 0.75rem;    /* 12px */
--text-sm: 0.875rem;   /* 14px */
--text-base: 1rem;     /* 16px */
--text-lg: 1.125rem;   /* 18px */
--text-xl: 1.25rem;    /* 20px */
--text-2xl: 1.5rem;    /* 24px */
--text-3xl: 1.875rem;  /* 30px */
```

#### 10.3. Spacing System
```css
/* Spacing Scale */
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
```

---

## 🛠️ Công nghệ sử dụng

| Công nghệ | Phiên bản | Mục đích |
|-----------|-----------|----------|
| Vue 3 | 3.5.25 | Framework |
| Vite | 7.2.4 | Build tool |
| Vue Router | 4.6.3 | Routing |
| Pinia | 3.0.4 | State management |
| Chart.js | 4.5.1 | Biểu đồ |
| Iconify | 5.0.0 | Icons |

---

## 📁 Cấu trúc thư mục

```
src/
├── App.vue                 # Layout chính (Topbar + Sidebar)
├── main.js                 # Entry point
├── assets/
│   ├── base.css           # CSS reset & variables
│   └── main.css           # Global styles
├── components/
│   ├── HelloWorld.vue
│   ├── ProductCard.vue
│   └── icons/             # Icon components
├── router/
│   └── index.js           # Cấu hình routes
├── stores/
│   └── counter.js         # Pinia store
└── views/
    ├── DashboardView.vue      # Trang tổng quan + KPI
    ├── VehiclesView.vue       # Danh sách xe + Tìm kiếm/Lọc
    ├── VehicleDetailView.vue  # Chi tiết từng xe
    ├── FuelAnalysisView.vue   # Phân tích nhiên liệu (Cost Analysis)
    ├── MaintenanceView.vue    # Bảo trì & Đăng kiểm (Maintenance Schedule)
    └── AlertsView.vue         # Cảnh báo hệ thống
```

---

## 🚀 Cài đặt và Chạy

### Yêu cầu hệ thống
- Node.js >= 20.19.0 hoặc >= 22.12.0
- npm hoặc yarn

### Cài đặt dependencies

```sh
npm install
```

### Chạy môi trường Development

```sh
npm run dev
```

### Build cho Production

```sh
npm run build
```

### Lint với ESLint

```sh
npm run lint
```

### Format code với Prettier

```sh
npm run format
```

---

## 🖥️ Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur)

### Recommended Browser Setup

- **Chromium-based browsers** (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
- **Firefox**:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)

---

## 📸 Screenshots

### Dashboard
- Hiển thị KPI cards với số liệu tổng quan
- Biểu đồ xu hướng chi phí nhiên liệu
- Lịch bảo trì sắp tới

### Danh sách xe
- Bảng danh sách xe với tìm kiếm và lọc
- Trạng thái xe được hiển thị bằng màu sắc
- Click để xem chi tiết xe

### Phân tích nhiên liệu
- Tính toán định mức tiêu hao Lít/100km
- Cảnh báo xe vượt định mức
- Biểu đồ so sánh giữa các xe

### Bảo trì & Đăng kiểm
- Danh sách xe sắp hết hạn đăng kiểm/bảo hiểm
- Lịch bảo dưỡng định kỳ
- Cảnh báo xe quá hạn

---

## 📝 License

MIT License - Xem file [LICENSE](LICENSE) để biết thêm chi tiết.

---

## 👥 Tác giả

Dự án được phát triển bởi team FleetPro.

---

## 🔗 Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).
