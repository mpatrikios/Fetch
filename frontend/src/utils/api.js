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
    // Add auth token if needed in future
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
    if (error.response?.status === 500) {
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
  list: () => api.get('/candidates'),
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
  getCompanies: () => api.get('/companies'),
};

// Matching endpoints
export const matchingAPI = {
  findMatches: (companyName, jobTitle, topK = 10) =>
    api.post('/matches/find', {
      company_name: companyName,
      job_title: jobTitle,
      top_k: topK,
    }),
};

// Health check
export const healthCheck = () => api.get('/health');

export default api;