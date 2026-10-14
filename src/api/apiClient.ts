import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

const apiClient = axios.create({
  baseURL: API_URL,
});

// Interceptor to add Auth token to every request
apiClient.interceptors.request.use(
  (config) => {
    // TASK 3: Use 'token' as the single source of truth
    const token = localStorage.getItem('token');
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor to handle 401 errors globally (Task 1)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.error('[API CLIENT] 401 Unauthorized - Invalid or missing token');
      
      // Clear all potential token keys to be safe
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('pharmavault_user');
      
      // Notify and redirect
      if (typeof window !== 'undefined') {
        alert('Session expired or invalid. Please login again.');
        window.location.href = '/auth';
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
