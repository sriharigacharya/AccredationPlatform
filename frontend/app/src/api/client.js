import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

const api = axios.create({ baseURL: API_URL })

// Attach JWT on every request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Auto-logout on 401
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.clear()
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api

// ── Auth ─────────────────────────────────────────────────────────────────────
export const authAPI = {
  login:      (email, password) => api.post('/auth/login', { email, password }),
  register:   (data)           => api.post('/auth/register', data),
  me:         ()               => api.get('/auth/me'),
  users:      ()               => api.get('/auth/users'),
  updateUser: (pk, data)       => api.put(`/auth/users/${pk}`, data),
  deleteUser: (pk)             => api.delete(`/auth/users/${pk}`),
}

// ── Students ──────────────────────────────────────────────────────────────────
export const studentsAPI = {
  list:      (params)     => api.get('/students/', { params }),
  get:       (id)         => api.get(`/students/${id}`),
  create:    (data)       => api.post('/students/', data),
  update:    (id, data)   => api.put(`/students/${id}`, data),
  delete:    (id)         => api.delete(`/students/${id}`),
  analytics: (id)         => api.get(`/students/${id}/analytics`),
  stats:     ()           => api.get('/students/stats/overview'),
}

// ── Faculty ───────────────────────────────────────────────────────────────────
export const facultyAPI = {
  list:    (params)   => api.get('/faculty/', { params }),
  get:     (id)       => api.get(`/faculty/${id}`),
  create:  (data)     => api.post('/faculty/', data),
  update:  (id, data) => api.put(`/faculty/${id}`, data),
  delete:  (id)       => api.delete(`/faculty/${id}`),
  report:  (id)       => api.get(`/faculty/${id}/report`),
  stats:   ()         => api.get('/faculty/stats/overview'),
}

// ── Departments ───────────────────────────────────────────────────────────────
export const departmentsAPI = {
  list:    ()         => api.get('/departments/'),
  get:     (id)       => api.get(`/departments/${id}`),
  create:  (data)     => api.post('/departments/', data),
  update:  (id, data) => api.put(`/departments/${id}`, data),
  summary: (id)       => api.get(`/departments/${id}/summary`),
}

// ── Parents / Contact ─────────────────────────────────────────────────────────
export const parentsAPI = {
  get:     (studentId) => api.get(`/parents/${studentId}`),
  upsert:  (data)      => api.post('/parents/', data),
  delete:  (studentId) => api.delete(`/parents/${studentId}`),
}

export const contactAPI = {
  call:  (studentId, useProxy = true) => api.post('/contact/call',  { student_id: studentId, use_proxy: useProxy }),
  sms:   (studentId, message)         => api.post('/contact/sms',   { student_id: studentId, message }),
  log:   (studentId)                  => api.get('/contact/log',    { params: { student_id: studentId } }),
}

// ── Documents ─────────────────────────────────────────────────────────────────
export const documentsAPI = {
  list:    (params)  => api.get('/documents/', { params }),
  get:     (id)      => api.get(`/documents/${id}`),
  delete:  (id)      => api.delete(`/documents/${id}`),
  jobStatus:(jobId)  => api.get(`/documents/job/${jobId}`),
  upload:  (formData)=> api.post('/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
}

// ── RAG ───────────────────────────────────────────────────────────────────────
export const ragAPI = {
  query:      (data)          => api.post('/rag/query', data),
  summarize:  (text, maxLen)  => api.post('/rag/summarize', { text, max_length: maxLen }),
  stats:      ()              => api.get('/rag/stats'),
  collections:()              => api.get('/collections'),
}

// ── Reports ───────────────────────────────────────────────────────────────────
export const reportsAPI = {
  // NBA SAR report generation
  generateNba:  (data)            => api.post('/reports/nba/generate', data),
  // Ad-hoc free-text report
  adhoc:        (query, format)   => api.post('/reports/adhoc', { query, format }),
  // Download a completed report (returns blob)
  download:     (reportId, fmt)   => api.get(`/reports/${reportId}/download`, {
    params: { format: fmt },
    responseType: 'blob',
  }),
  // History
  history:      ()                => api.get('/reports/history'),
}

// ── Predictions ───────────────────────────────────────────────────────────────
export const predictAPI = {
  student:  (data)        => api.post('/predict/student', data),
  batch:    (students)    => api.post('/predict/batch',   { students }),
  atRisk:   (threshold)   => api.get('/predict/atrisk',   { params: { threshold } }),
  train:    ()            => api.post('/predict/train'),
  modelInfo:()            => api.get('/predict/model/info'),
}

// ── Assignments ───────────────────────────────────────────────────────────────
export const assignmentsAPI = {
  list:       (params)       => api.get('/assignments/', { params }),
  get:        (id)           => api.get(`/assignments/${id}`),
  create:     (data)         => api.post('/assignments/', data),
  delete:     (id)           => api.delete(`/assignments/${id}`),
  students:   (id)           => api.get(`/assignments/${id}/students`),
  myList:     ()             => api.get('/assignments/', { params: { student_id: 'me' } }),
}
