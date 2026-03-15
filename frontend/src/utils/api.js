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
  updateProfile: (candidateId, profileData) => api.put(`/candidates/${candidateId}/profile`, profileData),
  reject: (candidateId) => api.put(`/candidates/${candidateId}/reject`),
  accept: (candidateId) => api.put(`/candidates/${candidateId}/accept`),
  sendAssessment: (candidateId) => api.post(`/candidates/${candidateId}/send-assessment`),
  deleteCandidate: (candidateId) => api.delete(`/candidates/${candidateId}`),
};

// Client endpoints
export const clientAPI = {
  list: (status = null) => {
    const params = status ? { status } : {};
    return api.get('/clients', { params });
  },
  getDetails: (clientId) => api.get(`/clients/${clientId}`),
  updateClient: (clientId, clientData) => api.put(`/clients/${clientId}/update`, clientData),
  activate: (clientId) => api.post(`/clients/${clientId}/activate`),
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
  updateJob: (jobId, jobData) => api.put(`/jobs/${jobId}/update`, jobData),
  deleteJob: (jobId) => api.delete(`/jobs/${jobId}`),
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
  updateReview: (matchId, candidateId, reviewStatus, config = {}) =>
    api.patch(`/matches/${matchId}/candidates/${candidateId}/review`, {
      review_status: reviewStatus,
    }, config),
  getStoredMatches: (companyName, jobTitle, config = {}) =>
    api.get(`/matches/stored/${encodeURIComponent(companyName)}/${encodeURIComponent(jobTitle)}`, config),
  getMatchHistory: (companyName, jobTitle, config = {}) =>
    api.get(`/matches/history/${encodeURIComponent(companyName)}/${encodeURIComponent(jobTitle)}`, config),
  getMatchById: (matchId, config = {}) =>
    api.get(`/matches/${matchId}`, config),
};

// Candidate Jobs endpoints (recruiter-facing)
export const candidateJobsAPI = {
  recommendJob: (candidateId, jobData) =>
    api.post(`/candidates/${candidateId}/recommend-job`, jobData),
  removeRecommendation: (candidateId, recId) =>
    api.delete(`/candidates/${candidateId}/recommendations/${recId}`),
  updateStatus: (candidateId, recId, status) =>
    api.put(`/candidates/${candidateId}/recommendations/${recId}/status`, { status }),
  getJobRecommendations: (companyName, jobTitle) =>
    api.get(`/jobs/${encodeURIComponent(companyName)}/${encodeURIComponent(jobTitle)}/recommendations`),
};

// Profile endpoints (candidate self-service)
export const profileAPI = {
  getProfile: () => api.get('/profile'),
  updateProfile: (data) => api.put('/profile', data),
  getRecommendations: () => api.get('/profile/recommendations'),
  expressInterest: (recId) => api.post(`/profile/recommendations/${recId}/apply`),
  getApplications: () => api.get('/profile/applications'),
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

// Document download endpoints
export const documentAPI = {
  getResumeDownloadUrl: (candidateId) => api.get(`/documents/resume/${candidateId}/download`),
  getJobDownloadUrl: (jobId) => api.get(`/documents/job/${jobId}/download`),
  getCliftonDownloadUrl: (candidateId) => api.get(`/documents/clifton/${candidateId}/download`),
};

// Health check
export const healthCheck = () => api.get('/health');

// --- General utilities ---

export function parseDelimitedString(str, delimiter = ',') {
  if (!str) return [];
  return str.split(delimiter).map(s => s.trim()).filter(s => s.length > 0);
}

export function getUniqueValues(items, field) {
  const vals = items.flatMap(item => {
    const v = item[field];
    return Array.isArray(v) ? v : [v];
  }).filter(v => v && String(v).trim() !== '');
  return [...new Set(vals)].sort();
}

export default api;