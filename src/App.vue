<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { RouterView, RouterLink, useRoute, useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { authService } from '@/services/authService'
import { vehicleService, alertService } from '@/services'

const sidebarOpen = ref(false)
const route = useRoute()
const router = useRouter()
const currentUser = ref(authService.getUser())

const refreshAuthState = () => {
  currentUser.value = authService.getUser()
}

// Auth state
const isAuthenticated = computed(() => !!authService.getToken())
const user = computed(() => currentUser.value)
const isManager = computed(() => user.value?.vai_tro === 'quan_ly')

// Check if current route is auth page
const isAuthPage = computed(() => {
  return route.path === '/login' || route.path === '/register'
})

// Show main layout only for authenticated manager
const showMainLayout = computed(() => {
  return isAuthenticated.value && isManager.value && !isAuthPage.value
})

// Global search
const searchQuery = ref('')
const searchResults = ref([])
const showSearchResults = ref(false)
const allVehicles = ref([])
const unreadAlertCount = ref(0)
let unreadPollingTimer = null

// Fetch vehicles for search
const fetchVehicles = async () => {
  try {
    const response = await vehicleService.getAllWithDetails()
    allVehicles.value = response.data
  } catch (err) {
    console.error('Error fetching vehicles:', err)
  }
}

// Search vehicles
const handleSearch = () => {
  if (!searchQuery.value.trim()) {
    searchResults.value = []
    showSearchResults.value = false
    return
  }
  
  const query = searchQuery.value.toLowerCase()
  searchResults.value = allVehicles.value.filter(v => 
    v.bien_so?.toLowerCase().includes(query) ||
    v.loai_xe_ten?.toLowerCase().includes(query) ||
    v.tai_xe_ten?.toLowerCase().includes(query)
  ).slice(0, 5) // Limit to 5 results
  
  showSearchResults.value = searchResults.value.length > 0
}

// Watch search query
watch(searchQuery, handleSearch)

watch(
  () => route.fullPath,
  () => {
    // Keep user state in sync after login/logout navigation.
    refreshAuthState()
  },
  { immediate: true }
)

// Go to vehicle detail
const goToVehicle = (vehicleId) => {
  searchQuery.value = ''
  showSearchResults.value = false
  router.push(`/vehicles/${vehicleId}`)
}

// Close search results when clicking outside
const closeSearchResults = () => {
  showSearchResults.value = false
}

const fetchUnreadAlerts = async () => {
  if (!isAuthenticated.value || !isManager.value) {
    unreadAlertCount.value = 0
    return
  }

  try {
    const response = await alertService.getUnread()
    unreadAlertCount.value = Array.isArray(response?.data) ? response.data.length : 0
  } catch (err) {
    console.error('Error fetching unread alerts:', err)
  }
}

const handleNotificationClick = async () => {
  if (route.path !== '/alerts') {
    await router.push('/alerts')
    return
  }

  await fetchUnreadAlerts()
}

// Load vehicles when authenticated
watch(isAuthenticated, (val) => {
  if (val) {
    fetchVehicles()
    fetchUnreadAlerts()
  } else {
    unreadAlertCount.value = 0
  }
}, { immediate: true })

watch(() => route.path, () => {
  if (isManager.value) {
    fetchUnreadAlerts()
  }
})

onMounted(() => {
  refreshAuthState()
  window.addEventListener('storage', refreshAuthState)

  if (isManager.value) {
    fetchUnreadAlerts()
    unreadPollingTimer = setInterval(fetchUnreadAlerts, 60000)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('storage', refreshAuthState)

  if (unreadPollingTimer) {
    clearInterval(unreadPollingTimer)
  }
})

const menuItems = [
  { id: 'dashboard', path: '/', label: 'Dashboard', icon: 'mdi:view-dashboard' },
  { id: 'vehicles', path: '/vehicles', label: 'Danh sách xe', icon: 'mdi:truck' },
  { id: 'fuel', path: '/fuel', label: 'Phân tích nhiên liệu', icon: 'mdi:fuel' },
  { id: 'maintenance', path: '/maintenance', label: 'Bảo trì & Đăng kiểm', icon: 'mdi:wrench' },
  { id: 'alerts', path: '/alerts', label: 'Cảnh báo', icon: 'mdi:bell-alert' },
  { id: 'users', path: '/users', label: 'Quản lý người dùng', icon: 'mdi:account-cog' },
]

const handleLogout = () => {
  authService.logout()
  router.push('/login')
}

// Get user initials
const userInitials = computed(() => {
  if (!user.value?.ho_ten) return 'U'
  return user.value.ho_ten
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase()
})
</script>

<template>
  <!-- Auth pages (Login/Register) or Driver Dashboard - no main layout -->
  <div v-if="!showMainLayout">
    <RouterView />
  </div>
  
  <!-- Manager Layout with sidebar -->
  <div v-else class="min-h-screen bg-gray-50">
    <!-- Topbar -->
    <header class="topbar">
      <div class="topbar-content">
        <div class="topbar-left">
          <button class="menu-btn" @click="sidebarOpen = !sidebarOpen">
            <Icon icon="mdi:menu" class="icon-md" />
          </button>
          <div class="brand">
            <div class="brand-logo">
              <Icon icon="mdi:truck" class="icon-lg text-white" />
            </div>
            <div>
              <h1 class="brand-title">FleetPro</h1>
              <p class="brand-subtitle">Quản lý đội xe</p>
            </div>
          </div>
        </div>

        <div class="search-container" @click.stop>
          <Icon icon="mdi:magnify" class="search-icon" />
          <input 
            v-model="searchQuery"
            type="text" 
            placeholder="Tìm kiếm xe, biển số, tài xế..." 
            class="search-input"
            @focus="handleSearch"
            @blur="setTimeout(() => closeSearchResults(), 200)"
          />
          <!-- Search Results Dropdown -->
          <div v-if="showSearchResults" class="search-results">
            <div 
              v-for="vehicle in searchResults" 
              :key="vehicle.id"
              class="search-result-item"
              @mousedown="goToVehicle(vehicle.id)"
            >
              <Icon icon="mdi:truck" class="result-icon" />
              <div class="result-info">
                <span class="result-plate">{{ vehicle.bien_so }}</span>
                <span class="result-type">{{ vehicle.loai_xe_ten }} - {{ vehicle.tai_xe_ten || 'Chưa có tài xế' }}</span>
              </div>
              <span :class="['result-status', vehicle.trang_thai === 'hoat_dong' ? 'active' : 'inactive']">
                {{ vehicle.trang_thai === 'hoat_dong' ? 'Hoạt động' : vehicle.trang_thai === 'bao_duong' ? 'Bảo trì' : 'Ngừng' }}
              </span>
            </div>
            <div v-if="searchResults.length === 0" class="no-results">
              Không tìm thấy kết quả
            </div>
          </div>
        </div>

        <div class="topbar-right">
          <button class="notification-btn" @click="handleNotificationClick" title="Xem cảnh báo">
            <Icon icon="mdi:bell" class="icon-md" />
            <span v-if="unreadAlertCount > 0" class="notification-badge">{{ unreadAlertCount > 99 ? '99+' : unreadAlertCount }}</span>
          </button>
          <div class="user-info">
            <div class="user-text">
              <p class="user-name">{{ user?.ho_ten || 'Người dùng' }}</p>
              <p class="user-role">{{ user?.vai_tro === 'quan_ly' ? 'Quản lý' : 'Tài xế' }}</p>
            </div>
            <div class="user-avatar">{{ userInitials }}</div>
            <button class="logout-btn" @click="handleLogout" title="Đăng xuất">
              <Icon icon="mdi:logout" class="icon-md" />
            </button>
          </div>
        </div>
      </div>
    </header>

    <div class="app-container">
      <!-- Sidebar -->
      <aside :class="['sidebar', { open: sidebarOpen }]">
        <nav class="sidebar-nav">
          <RouterLink
            v-for="item in menuItems"
            :key="item.id"
            :to="item.path"
            :class="['nav-item', { active: route.path === item.path }]"
            @click="sidebarOpen = false"
          >
            <Icon :icon="item.icon" class="icon-md" />
            <span>{{ item.label }}</span>
          </RouterLink>
        </nav>
      </aside>

      <!-- Overlay for mobile -->
      <div v-if="sidebarOpen" class="sidebar-overlay" @click="sidebarOpen = false"></div>

      <!-- Main Content -->
      <main class="main-content">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Inter', sans-serif;
}

.min-h-screen {
  min-height: 100vh;
}

.bg-gray-50 {
  background-color: #f9fbf9;
}

/* Icons */
.icon-sm {
  width: 1rem;
  height: 1rem;
}
.icon-md {
  width: 1.25rem;
  height: 1.25rem;
}
.icon-lg {
  width: 1.5rem;
  height: 1.5rem;
}
.text-white {
  color: white;
}
.text-gray-400 {
  color: #9ca3af;
}

/* Topbar - Yellow background like sidebar */
.topbar {
  background: #f4d03f;
  border-bottom: none;
  position: sticky;
  top: 0;
  z-index: 50;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.topbar-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.menu-btn {
  display: none;
  padding: 0.5rem;
  border-radius: 0.375rem;
  border: none;
  background: transparent;
  cursor: pointer;
}
.menu-btn:hover {
  background: #f3f4f6;
}

@media (max-width: 1023px) {
  .menu-btn {
    display: flex;
  }
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.brand-logo {
  width: 2.5rem;
  height: 2.5rem;
  background: linear-gradient(135deg, #4ef63b 0%, #3BD52A 100%);
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(78, 246, 59, 0.3);
}

.brand-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: #4ef63b;
}

.brand-subtitle {
  font-size: 0.75rem;
  color: #6b7280;
}

.search-container {
  display: none;
  position: relative;
  flex: 1;
  max-width: 28rem;
  margin: 0 2rem;
}

@media (min-width: 768px) {
  .search-container {
    display: block;
  }
}

.search-icon {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: #9ca3af;
  width: 1.25rem;
  height: 1.25rem;
}

.search-input {
  width: 100%;
  padding: 0.5rem 1rem 0.5rem 2.5rem;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  font-size: 0.875rem;
}
.search-input:focus {
  outline: none;
  border-color: #eb9722;
  box-shadow: 0 0 0 2px rgba(255, 179, 71, 0.2);
}

/* Search Results Dropdown */
.search-results {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 0.5rem;
  background: white;
  border-radius: 0.5rem;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  border: 1px solid #e5e7eb;
  max-height: 300px;
  overflow-y: auto;
  z-index: 100;
}

.search-result-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  cursor: pointer;
  transition: background 0.15s ease;
}

.search-result-item:hover {
  background: #FEF9E7;
}

.search-result-item:not(:last-child) {
  border-bottom: 1px solid #f3f4f6;
}

.result-icon {
  width: 1.5rem;
  height: 1.5rem;
  color: #f3c81e;
}

.result-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.result-plate {
  font-weight: 600;
  color: #111827;
  font-size: 0.875rem;
}

.result-type {
  font-size: 0.75rem;
  color: #6b7280;
}

.result-status {
  font-size: 0.625rem;
  font-weight: 500;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
}

.result-status.active {
  background: #dcfce7;
  color: #16a34a;
}

.result-status.inactive {
  background: #fef2f2;
  color: #dc2626;
}

.no-results {
  padding: 1rem;
  text-align: center;
  color: #6b7280;
  font-size: 0.875rem;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.notification-btn {
  position: relative;
  padding: 0.5rem;
  border-radius: 0.375rem;
  border: none;
  background: transparent;
  cursor: pointer;
}
.notification-btn:hover {
  background: #f3f4f6;
}

.notification-badge {
  position: absolute;
  top: -0.2rem;
  right: -0.2rem;
  min-width: 1.1rem;
  height: 1.1rem;
  padding: 0 0.2rem;
  background: #ef4444;
  color: #fff;
  border-radius: 9999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.65rem;
  font-weight: 700;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding-left: 1rem;
  border-left: 1px solid #e5e7eb;
}

.user-text {
  display: none;
  text-align: right;
}

@media (min-width: 640px) {
  .user-text {
    display: block;
  }
}

.user-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: #111827;
}

.user-role {
  font-size: 0.75rem;
  color: #6b7280;
}

.user-avatar {
  width: 2.5rem;
  height: 2.5rem;
  background: linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: 0.875rem;
  box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);
}

.logout-btn {
  padding: 0.5rem;
  border-radius: 0.375rem;
  border: none;
  background: transparent;
  cursor: pointer;
  color: #6b7280;
  transition: all 0.15s ease;
}

.logout-btn:hover {
  background: #fee2e2;
  color: #dc2626;
}

/* Layout */
.app-container {
  display: flex;
}

/* Sidebar - Yellow background like reference */
.sidebar {
  position: fixed;
  top: 73px;
  left: 0;
  height: calc(100vh - 73px);
  width: 16rem;
  background: #f3c81e;
  border-right: none;
  transform: translateX(-100%);
  transition: transform 0.3s ease;
  z-index: 40;
}

.sidebar.open {
  transform: translateX(0);
}

@media (min-width: 1024px) {
  .sidebar {
    position: sticky;
    transform: translateX(0);
  }
}

.sidebar-nav {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  color: #374151;
  text-decoration: none;
  font-weight: 500;
  transition: all 0.15s ease;
}

.nav-item:hover {
  background: white;
  color: #374151;
}

.nav-item.active {
  background: white;
  color: #374151;
  font-weight: 600;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.sidebar-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 30;
}

@media (min-width: 1024px) {
  .sidebar-overlay {
    display: none;
  }
}

/* Main Content */
.main-content {
  flex: 1;
  padding: 1.5rem;
  min-height: calc(100vh - 73px);
}

@media (min-width: 1024px) {
  .main-content {
    margin-left: 0;
  }
}
</style>