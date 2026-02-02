import axios from 'axios';

// Create axios instance with default config
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for auth or logging
api.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid - clear auth and redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    } else if (error.response?.status === 500) {
      console.error('Server error:', error.response.data);
    }
    return Promise.reject(error);
  }
);

// Resume endpoints
export const resumeAPI = {
  upload: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/resume/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// Candidate endpoints
export const candidateAPI = {
  list: (status = 'all') => api.get('/candidates', { params: { status } }),
  updateNotes: (candidateId, notes) => api.put(`/candidates/${candidateId}/notes`, { notes }),
  reject: (candidateId) => api.put(`/candidates/${candidateId}/reject`),
  accept: (candidateId) => api.put(`/candidates/${candidateId}/accept`),
  sendAssessment: (candidateId) => api.post(`/candidates/${candidateId}/send-assessment`),
};

export const cliftonStrengthsAPI = {
  upload: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/clifton-strengths/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  list: () => api.get('/clifton-strengths'),
};

// Job endpoints
export const jobAPI = {
  upload: (file, companyName) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('company_name', companyName);
    return api.post('/job/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  list: () => api.get('/jobs'),
  getDetails: (company, title) => api.get(`/jobs/${encodeURIComponent(company)}/${encodeURIComponent(title)}`),
  getCompanies: () => api.get('/companies'),
};

// Matching endpoints
export const matchingAPI = {
  findMatches: (companyName, jobTitle, topK = 10, useCohort = true, config = {}) =>
    api.post('/matches/find', {
      company_name: companyName,
      job_title: jobTitle,
      top_k: topK,
      use_cohort: useCohort,
    }, config),
};

// Authentication endpoints
export const authAPI = {
  login: (email, password) =>
    api.post('/auth/login', { email, password }),
  
  register: (userData) =>
    api.post('/auth/register', userData),
  
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    return api.post('/auth/logout');
  },
  
  getCurrentUser: () => api.get('/auth/me'),
  
  updateStatus: (status) => api.put('/auth/update-status', null, {
    params: { status }
  }),
};

// Dashboard endpoints
export const dashboardAPI = {
  getStats: () => api.get('/dashboard/stats'),
};

// Health check
export const healthCheck = () => api.get('/health');

export default api;