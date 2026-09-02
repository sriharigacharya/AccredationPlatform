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
  generate:     (data)            => api.post('/reports/generate', data),
  // Dynamic criteria discovery
  getCriteria:  (sarFormat)       => api.get('/criteria', {
    params: sarFormat ? { sar_format: sarFormat } : {},
  }),
  // Event detailed summary sheets
  getEventSummarySheets: (eventIds) => api.get('/reports/clubs-activities/summary-sheets', {
    params: { event_ids: Array.isArray(eventIds) ? eventIds.join(',') : eventIds },
  }),
  // Criterion 4 live preview
  previewCriterion4: (params) => api.get('/reports/criterion-4/preview', { params }),
  // Narratives management (e.g. 4.6.2)
  getNarrative:  (nodeId, params) => api.get(`/reports/narratives/${nodeId}`, { params }),
  saveNarrative: (nodeId, data)   => api.post(`/reports/narratives/${nodeId}`, data),
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

// ── Clubs ─────────────────────────────────────────────────────────────────────
export const clubsAPI = {
  list:    (params)       => api.get('/clubs/', { params }),
  get:     (id)           => api.get(`/clubs/${id}`),
  create:  (data)         => api.post('/clubs/', data),
  update:  (id, data)     => api.patch(`/clubs/${id}`, data),
}

// ── Student Roles ─────────────────────────────────────────────────────────────
export const studentRolesAPI = {
  list:    (params)       => api.get('/student-roles/', { params }),
  create:  (data)         => api.post('/student-roles/', data),
  delete:  (id)           => api.delete(`/student-roles/${id}`),
}

// ── Events ────────────────────────────────────────────────────────────────────
export const eventsAPI = {
  listByClub: (clubId, params) => api.get(`/clubs/${clubId}/events`, { params }),
  listAll:    (params)         => api.get('/events/', { params }),
  list:       (params)         => api.get('/events/', { params }),
  getSummarySheets: (params)   => api.get('/events/summary-sheets', { params }),
  get:        (id)             => api.get(`/events/${id}`),
  create:     (clubId, formData) => api.post(`/clubs/${clubId}/events`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  update:     (id, data)       => api.patch(`/events/${id}`, data),
  approve:    (id, data)       => api.patch(`/events/${id}/approve`, data),
  reject:     (id, data)       => api.patch(`/events/${id}/reject`, data),

  photos:     (id)             => api.get(`/events/${id}/photos`),
}

// ── Placements ────────────────────────────────────────────────────────────────
export const placementsAPI = {
  myPlacement:   ()          => api.get('/profile/placement', { params: { student_id: 'me' } }),
  getForStudent: (studentId) => api.get(`/placements/student/${studentId}`),
  submit:        (formData)  => api.post('/profile/placement', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  list:          (params)    => api.get('/placements/', { params }),
  get:           (id)        => api.get(`/placements/${id}`),
  verify:        (id)        => api.patch(`/placements/${id}/verify`),
  unverify:      (id)        => api.patch(`/placements/${id}/unverify`),
  summary:       (params)    => api.get('/placements/summary', { params }),
}

// ── Student Achievements (External Competitions) ──────────────────────────────
export const achievementsAPI = {
  list:          (params)    => api.get('/student-achievements', { params }),
  get:           (id)        => api.get(`/student-achievements/${id}`),
  myList:        (params)    => api.get('/student-achievements', { params: { student_id: 'me', ...params } }),
  create:        (formData)  => api.post('/student-achievements', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  update:        (id, formData) => api.patch(`/student-achievements/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  verify:        (id)        => api.patch(`/student-achievements/${id}/verify`),
  reject:        (id, data)  => api.patch(`/student-achievements/${id}/reject`, data),
  delete:        (id)        => api.delete(`/student-achievements/${id}`),
  report:        (params)    => api.get('/student-achievements/report', { params }),
}

// ── Historical Criterion 4 Data (Admission, Batch Progress, Academic Performance) ──
export const historicalAPI = {
  admission: {
    list:         (params)   => api.get('/admission-records', { params }),
    create:       (data)     => api.post('/admission-records', data),
    bulkImport:   (formData) => api.post('/admission-records/bulk-import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
    verify:       (id)       => api.patch(`/admission-records/${id}/verify`),
    reject:       (id, data) => api.patch(`/admission-records/${id}/reject`, data),
    update:       (id, data) => api.patch(`/admission-records/${id}`, data),
    delete:       (id)       => api.delete(`/admission-records/${id}`),
    downloadTemplateUrl: '/api/v1/admission-records/template.csv',
  },

  batchProgress: {
    list:         (params)   => api.get('/batch-progress', { params }),
    summary:      (params)   => api.get('/batch-progress/summary', { params }),
    create:       (data)     => api.post('/batch-progress', data),
    bulkImport:   (formData) => api.post('/batch-progress/bulk-import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
    verify:       (id)       => api.patch(`/batch-progress/${id}/verify`),
    reject:       (id, data) => api.patch(`/batch-progress/${id}/reject`, data),
    update:       (id, data) => api.patch(`/batch-progress/${id}`, data),
    delete:       (id)       => api.delete(`/batch-progress/${id}`),
    downloadTemplateUrl: '/api/v1/batch-progress/template.csv',
  },

  academicPerformance: {
    list:         (params)   => api.get('/academic-performance', { params }),
    create:       (data)     => api.post('/academic-performance', data),
    bulkImport:   (formData) => api.post('/academic-performance/bulk-import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
    verify:       (id)       => api.patch(`/academic-performance/${id}/verify`),
    reject:       (id, data) => api.patch(`/academic-performance/${id}/reject`, data),
    update:       (id, data) => api.patch(`/academic-performance/${id}`, data),
    delete:       (id)       => api.delete(`/academic-performance/${id}`),
    downloadTemplateUrl: '/api/v1/academic-performance/template.csv',
  },
}




