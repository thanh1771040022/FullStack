<script setup>
import { ref, computed, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import { userService } from '@/services'

const loading = ref(false)
const saving = ref(false)
const error = ref('')
const users = ref([])
const searchTerm = ref('')

const showModal = ref(false)
const mode = ref('create')
const editingUserId = ref(null)

const form = ref({
  username: '',
  password: '',
  email: '',
  ho_ten: '',
  vai_tro: 'tai_xe',
  so_dien_thoai: '',
  trang_thai: 'hoat_dong',
})

const resetForm = () => {
  form.value = {
    username: '',
    password: '',
    email: '',
    ho_ten: '',
    vai_tro: 'tai_xe',
    so_dien_thoai: '',
    trang_thai: 'hoat_dong',
  }
}

const fetchUsers = async () => {
  loading.value = true
  error.value = ''
  try {
    const response = await userService.getAll()
    users.value = response.data || []
  } catch (err) {
    error.value = err.response?.data?.message || 'Khong the tai danh sach nguoi dung.'
  } finally {
    loading.value = false
  }
}

const filteredUsers = computed(() => {
  const q = searchTerm.value.trim().toLowerCase()
  if (!q) return users.value

  return users.value.filter((u) => {
    return (
      String(u.username || '').toLowerCase().includes(q) ||
      String(u.ho_ten || '').toLowerCase().includes(q) ||
      String(u.email || '').toLowerCase().includes(q) ||
      String(u.vai_tro || '').toLowerCase().includes(q)
    )
  })
})

const stats = computed(() => {
  const total = users.value.length
  const managers = users.value.filter((u) => u.vai_tro === 'quan_ly').length
  const drivers = users.value.filter((u) => u.vai_tro === 'tai_xe').length
  const locked = users.value.filter((u) => u.trang_thai !== 'hoat_dong').length
  return { total, managers, drivers, locked }
})

const openCreateManagerModal = () => {
  mode.value = 'create'
  editingUserId.value = null
  resetForm()
  form.value.vai_tro = 'quan_ly'
  showModal.value = true
}

const openCreateUserModal = () => {
  mode.value = 'create'
  editingUserId.value = null
  resetForm()
  showModal.value = true
}

const openEditModal = (user) => {
  mode.value = 'edit'
  editingUserId.value = user.id
  form.value = {
    username: user.username || '',
    password: '',
    email: user.email || '',
    ho_ten: user.ho_ten || '',
    vai_tro: user.vai_tro || 'tai_xe',
    so_dien_thoai: user.so_dien_thoai || '',
    trang_thai: user.trang_thai || 'hoat_dong',
  }
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
  editingUserId.value = null
  resetForm()
}

const submitForm = async () => {
  saving.value = true
  error.value = ''
  try {
    const normalizedPhone = String(form.value.so_dien_thoai || '').trim().slice(0, 15)

    if (mode.value === 'create') {
      await userService.create({
        username: form.value.username,
        password: form.value.password,
        email: form.value.email,
        ho_ten: form.value.ho_ten,
        vai_tro: form.value.vai_tro,
        so_dien_thoai: normalizedPhone || null,
        trang_thai: form.value.trang_thai,
      })
    } else {
      const payload = {
        username: form.value.username,
        email: form.value.email,
        ho_ten: form.value.ho_ten,
        vai_tro: form.value.vai_tro,
        so_dien_thoai: normalizedPhone || null,
        trang_thai: form.value.trang_thai,
      }

      if (form.value.password.trim()) {
        payload.password = form.value.password
      }

      await userService.update(editingUserId.value, payload)
    }

    closeModal()
    await fetchUsers()
  } catch (err) {
    error.value = err.response?.data?.message || 'Khong the luu nguoi dung.'
  } finally {
    saving.value = false
  }
}

const toggleUserStatus = async (user) => {
  const nextStatus = user.trang_thai === 'hoat_dong' ? 'khoa' : 'hoat_dong'
  try {
    await userService.updateStatus(user.id, nextStatus)
    await fetchUsers()
  } catch (err) {
    error.value = err.response?.data?.message || 'Khong the cap nhat trang thai user.'
  }
}

const formatRole = (role) => (role === 'quan_ly' ? 'Quan ly' : 'Tai xe')
const formatStatus = (status) => (status === 'hoat_dong' ? 'Hoat dong' : 'Da khoa')

onMounted(() => {
  fetchUsers()
})
</script>

<template>
  <div class="users-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">Quan ly nguoi dung</h1>
        <p class="page-subtitle">Admin tao/sua/khoa tai khoan va gan role</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-secondary" @click="openCreateUserModal">
          <Icon icon="mdi:account-plus" class="icon-sm" />
          Tao user
        </button>
        <button class="btn btn-primary" @click="openCreateManagerModal">
          <Icon icon="mdi:shield-account" class="icon-sm" />
          Tao tai khoan quan ly
        </button>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <p class="label">Tong user</p>
        <p class="value">{{ stats.total }}</p>
      </div>
      <div class="stat-card">
        <p class="label">Quan ly</p>
        <p class="value">{{ stats.managers }}</p>
      </div>
      <div class="stat-card">
        <p class="label">Tai xe</p>
        <p class="value">{{ stats.drivers }}</p>
      </div>
      <div class="stat-card">
        <p class="label">Dang khoa</p>
        <p class="value">{{ stats.locked }}</p>
      </div>
    </div>

    <div class="toolbar">
      <div class="search-box">
        <Icon icon="mdi:magnify" class="icon-sm" />
        <input v-model="searchTerm" type="text" placeholder="Tim username, ho ten, email, role..." />
      </div>
    </div>

    <div v-if="error" class="error-banner">{{ error }}</div>

    <div class="table-card">
      <div v-if="loading" class="loading-state">Dang tai du lieu...</div>
      <table v-else>
        <thead>
          <tr>
            <th>ID</th>
            <th>Username</th>
            <th>Ho ten</th>
            <th>Email</th>
            <th>Vai tro</th>
            <th>Trang thai</th>
            <th>Thao tac</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in filteredUsers" :key="u.id">
            <td>{{ u.id }}</td>
            <td>{{ u.username }}</td>
            <td>{{ u.ho_ten }}</td>
            <td>{{ u.email }}</td>
            <td>
              <span :class="['badge', u.vai_tro === 'quan_ly' ? 'badge-manager' : 'badge-driver']">
                {{ formatRole(u.vai_tro) }}
              </span>
            </td>
            <td>
              <span :class="['badge', u.trang_thai === 'hoat_dong' ? 'badge-active' : 'badge-locked']">
                {{ formatStatus(u.trang_thai) }}
              </span>
            </td>
            <td class="actions">
              <button class="btn-icon" @click="openEditModal(u)" title="Sua">
                <Icon icon="mdi:pencil" class="icon-sm" />
              </button>
              <button
                class="btn-icon"
                :title="u.trang_thai === 'hoat_dong' ? 'Khoa tai khoan' : 'Mo khoa tai khoan'"
                @click="toggleUserStatus(u)"
              >
                <Icon :icon="u.trang_thai === 'hoat_dong' ? 'mdi:lock' : 'mdi:lock-open-variant'" class="icon-sm" />
              </button>
            </td>
          </tr>
          <tr v-if="filteredUsers.length === 0">
            <td colspan="7" class="empty">Khong co nguoi dung nao.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-card">
        <h3>{{ mode === 'create' ? 'Tao nguoi dung moi' : 'Cap nhat nguoi dung' }}</h3>

        <div class="form-grid">
          <div class="form-group">
            <label>Username</label>
            <input v-model="form.username" type="text" />
          </div>
          <div class="form-group">
            <label>Ho ten</label>
            <input v-model="form.ho_ten" type="text" />
          </div>
          <div class="form-group">
            <label>Email</label>
            <input v-model="form.email" type="email" />
          </div>
          <div class="form-group">
            <label>So dien thoai</label>
            <input v-model="form.so_dien_thoai" type="text" maxlength="15" />
          </div>
          <div class="form-group">
            <label>Vai tro</label>
            <select v-model="form.vai_tro">
              <option value="quan_ly">Quan ly</option>
              <option value="tai_xe">Tai xe</option>
            </select>
          </div>
          <div class="form-group">
            <label>Trang thai</label>
            <select v-model="form.trang_thai">
              <option value="hoat_dong">Hoat dong</option>
              <option value="khoa">Da khoa</option>
            </select>
          </div>
          <div class="form-group full-width">
            <label>
              {{ mode === 'create' ? 'Mat khau' : 'Mat khau moi (de trong neu khong doi)' }}
            </label>
            <input v-model="form.password" type="password" />
          </div>
        </div>

        <div class="modal-actions">
          <button class="btn btn-secondary" @click="closeModal">Huy</button>
          <button class="btn btn-primary" :disabled="saving" @click="submitForm">
            {{ saving ? 'Dang luu...' : 'Luu' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.users-page {
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.page-title {
  font-size: 1.875rem;
  font-weight: 700;
  color: #111827;
}

.page-subtitle {
  color: #6b7280;
  font-size: 0.9rem;
}

.header-actions {
  display: flex;
  gap: 0.75rem;
}

.btn {
  border: none;
  cursor: pointer;
  border-radius: 0.5rem;
  padding: 0.55rem 1rem;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-weight: 600;
}

.btn-primary {
  background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%);
  color: #fff;
}

.btn-secondary {
  background: #fff;
  color: #374151;
  border: 1px solid #d1d5db;
}

.icon-sm {
  width: 1rem;
  height: 1rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.stat-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  padding: 0.85rem 1rem;
}

.stat-card .label {
  font-size: 0.8rem;
  color: #6b7280;
}

.stat-card .value {
  font-size: 1.35rem;
  font-weight: 700;
  color: #111827;
}

.toolbar {
  margin-bottom: 0.75rem;
}

.search-box {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 0.65rem;
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.55rem 0.8rem;
  max-width: 420px;
}

.search-box input {
  border: none;
  outline: none;
  width: 100%;
  font-size: 0.9rem;
}

.error-banner {
  background: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fecaca;
  padding: 0.7rem 0.9rem;
  border-radius: 0.55rem;
  margin-bottom: 0.8rem;
}

.table-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  overflow-x: auto;
}

.loading-state {
  padding: 2rem 1rem;
  text-align: center;
  color: #6b7280;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: 0.7rem 0.8rem;
  border-bottom: 1px solid #f1f5f9;
  text-align: left;
  font-size: 0.88rem;
}

th {
  background: #fffdf7;
  color: #374151;
  font-weight: 700;
}

.badge {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 0.16rem 0.58rem;
  font-size: 0.72rem;
  font-weight: 600;
}

.badge-manager {
  background: #eef2ff;
  color: #3730a3;
}

.badge-driver {
  background: #f0fdf4;
  color: #166534;
}

.badge-active {
  background: #dcfce7;
  color: #166534;
}

.badge-locked {
  background: #fee2e2;
  color: #991b1b;
}

.actions {
  display: flex;
  gap: 0.35rem;
}

.btn-icon {
  width: 2rem;
  height: 2rem;
  border-radius: 0.45rem;
  border: 1px solid #e5e7eb;
  background: #fff;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.empty {
  text-align: center;
  color: #6b7280;
  padding: 1.1rem;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(17, 24, 39, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-card {
  width: min(760px, 100%);
  background: #fff;
  border-radius: 0.9rem;
  border: 1px solid #e5e7eb;
  padding: 1rem;
}

.modal-card h3 {
  margin-bottom: 0.75rem;
  color: #111827;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.7rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.form-group label {
  font-size: 0.82rem;
  color: #374151;
  font-weight: 600;
}

.form-group input,
.form-group select {
  border: 1px solid #d1d5db;
  border-radius: 0.55rem;
  padding: 0.52rem 0.7rem;
  outline: none;
  font-size: 0.9rem;
}

.full-width {
  grid-column: 1 / -1;
}

.modal-actions {
  margin-top: 0.9rem;
  display: flex;
  justify-content: flex-end;
  gap: 0.55rem;
}

@media (max-width: 900px) {
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
