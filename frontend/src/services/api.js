import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:8000/api/';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('fairshare_token');
    if (token) {
      config.headers.Authorization = `Token ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for 401 handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('fairshare_token');
      localStorage.removeItem('fairshare_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ============ AUTH ============
export const authAPI = {
  login: (credentials) => api.post('auth/login/', credentials),
  register: (data) => api.post('auth/register/', data),
  logout: () => api.post('auth/logout/'),
  getProfile: () => api.get('auth/profile/'),
  demoLogin: () => api.post('auth/demo/'),
  forgotPassword: (data) => api.post('auth/forgot-password/', data),
  verifyOTP: (data) => api.post('auth/verify-otp/', data),
  resetPassword: (data) => api.post('auth/reset-password/', data),
};

// ============ GROUPS ============
export const groupsAPI = {
  list: () => api.get('groups/'),
  create: (data) => api.post('groups/', data),
  detail: (id) => api.get(`groups/${id}/`),
  update: (id, data) => api.put(`groups/${id}/`, data),
  delete: (id) => api.delete(`groups/${id}/`),
  addMember: (groupId, data) => api.post(`groups/${groupId}/memberships/`, data),
  removeMember: (groupId, membershipId) => api.delete(`groups/${groupId}/memberships/${membershipId}/`),
  seed: (id) => api.post(`groups/${id}/seed/`),
  join: (code) => api.post('groups/join/', { invite_code: code }),
  getAIAssistance: (id, data) => api.post(`groups/${id}/ai-advise/`, data),
};

// ============ EXPENSES ============
export const expensesAPI = {
  list: (groupId) => api.get(`expenses/?group=${groupId}`),
  create: (groupId, data) => api.post(`expenses/`, { ...data, group: groupId }),
  detail: (groupId, id) => api.get(`expenses/${id}/`),
  update: (groupId, id, data) => api.put(`expenses/${id}/`, data),
  delete: (groupId, id) => api.delete(`expenses/${id}/`),
};

// ============ SETTLEMENTS ============
export const settlementsAPI = {
  list: (groupId) => api.get(`settlements/?group=${groupId}`),
  create: (groupId, data) => api.post(`settlements/`, { ...data, group: groupId }),
};

// ============ IMPORT ============
export const importAPI = {
  uploadCSV: (groupId, formData) => {
    if (!formData.has('group_id') && !formData.has('group')) {
      formData.append('group_id', groupId);
    }
    return api.post(`import/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }
};

// ============ BALANCES ============
export const balancesAPI = {
  getSummary: (groupId) => api.get(`groups/${groupId}/balances/`),
  getDetailed: (groupId) => api.get(`groups/${groupId}/balances/detail/`),
  getTimeline: (groupId) => api.get(`groups/${groupId}/timeline/`),
};

// ============ REPORTS ============
export const reportsAPI = {
  list: (groupId) => api.get(`import-reports/?group=${groupId}`),
  detail: (groupId, id) => api.get(`import-reports/${id}/`),
};

export default api;
