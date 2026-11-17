import axios from 'axios';
import { notifySessionExpired } from '../features/navigation/sessionProfile';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

// Web sessions are HttpOnly cookies. Native iOS uses its separate bearer client.
apiClient.interceptors.request.use(
  (config) => {
    config.headers['X-PharmaVault-Client'] = 'web';
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor to handle 401 errors globally (Task 1)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Failed sign-in is not an expired existing session. Let the form handle it
      // without a modal, redirect or accidental credential-bearing error logs.
      if (/\/users\/(?:login|register|profile|logout)$/.test(error.config?.url || '')) return Promise.reject(error);
      notifySessionExpired();
    }
    return Promise.reject(error);
  }
);

export default apiClient;
