import { createRouter, createWebHistory } from 'vue-router'
import { authService } from '@/services/authService'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // Public routes
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: { requiresGuest: true }
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('../views/RegisterView.vue'),
      meta: { requiresGuest: true }
    },
    
    // Protected routes - Manager only
    {
      path: '/',
      name: 'dashboard',
      component: () => import('../views/DashboardView.vue'),
      meta: { requiresAuth: true, roles: ['quan_ly'] }
    },
    {
      path: '/dashboard',
      redirect: '/'
    },
    {
      path: '/vehicles',
      name: 'vehicles',
      component: () => import('../views/VehiclesView.vue'),
      meta: { requiresAuth: true, roles: ['quan_ly'] }
    },
    {
      path: '/vehicles/:id',
      name: 'vehicle-detail',
      component: () => import('../views/VehicleDetailView.vue'),
      meta: { requiresAuth: true, roles: ['quan_ly'] }
    },
    {
      path: '/fuel',
      name: 'fuel-analysis',
      component: () => import('../views/FuelAnalysisView.vue'),
      meta: { requiresAuth: true, roles: ['quan_ly'] }
    },
    {
      path: '/maintenance',
      name: 'maintenance',
      component: () => import('../views/MaintenanceView.vue'),
      meta: { requiresAuth: true, roles: ['quan_ly'] }
    },
    {
      path: '/alerts',
      name: 'alerts',
      component: () => import('../views/AlertsView.vue'),
      meta: { requiresAuth: true, roles: ['quan_ly'] }
    },
    {
      path: '/users',
      name: 'users-management',
      component: () => import('../views/UsersManagementView.vue'),
      meta: { requiresAuth: true, roles: ['quan_ly'] }
    },
    
    // Protected routes - Driver only
    {
      path: '/driver-dashboard',
      name: 'driver-dashboard',
      component: () => import('../views/DriverDashboardView.vue'),
      meta: { requiresAuth: true, roles: ['tai_xe'] }
    },
    
    // 404 redirect
    {
      path: '/:pathMatch(.*)*',
      redirect: '/login'
    }
  ],
})

// Navigation guard
router.beforeEach((to, from, next) => {
  const isAuthenticated = authService.isAuthenticated()
  const user = authService.getUser()
  
  // Route yêu cầu đăng nhập
  if (to.meta.requiresAuth) {
    if (!isAuthenticated) {
      return next('/login')
    }
    // Kiểm tra quyền
    if (to.meta.roles && user) {
      if (!to.meta.roles.includes(user.vai_tro)) {
        // Nếu đã ở đúng dashboard thì không redirect nữa để tránh vòng lặp
        if (user.vai_tro === 'quan_ly' && to.path !== '/') {
          return next('/')
        } else if (user.vai_tro === 'tai_xe' && to.path !== '/driver-dashboard') {
          return next('/driver-dashboard')
        } else {
          // Nếu đã ở đúng dashboard mà vẫn không hợp lệ, cho về login hoặc abort
          return next('/login')
        }
      }
    }
  }
  
  // Route chỉ dành cho guest (chưa đăng nhập)
  if (to.meta.requiresGuest && isAuthenticated) {
    if (user?.vai_tro === 'quan_ly') {
      return next('/')
    } else {
      return next('/driver-dashboard')
    }
  }
  
  next()
})

export default router

