import axios from 'axios';
import { notifySessionExpired } from '../features/navigation/sessionProfile';

function resolveApiUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL;
  if (typeof window !== 'undefined' && window.location) {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return `${window.location.protocol}//${host}:5001/api`;
    }
  }
  return envUrl || 'http://127.0.0.1:5001/api';
}

const apiClient = axios.create({
  baseURL: resolveApiUrl(),
  withCredentials: true,
});

// Web sessions are HttpOnly cookies. Native iOS uses its separate bearer client.
apiClient.interceptors.request.use(
  (config) => {
    config.headers['X-PharmaVault-Client'] = 'web';
    if (typeof window !== 'undefined' && window.location) {
      const host = window.location.hostname;
      if (host === 'localhost' || host === '127.0.0.1') {
        config.baseURL = `${window.location.protocol}//${host}:5001/api`;
      }
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
      // Failed sign-in is not an expired existing session. Let the form handle it
      // without a modal, redirect or accidental credential-bearing error logs.
      if (/\/users\/(?:login|register|profile|logout)$/.test(error.config?.url || '')) return Promise.reject(error);
      notifySessionExpired();
    }
    // Staff account without MFA while MFA_REQUIRED_FOR_STAFF is on: refresh the profile so RoleRoute sends the person to setup.
    if (error.response?.status === 403 && error.response?.data?.code === 'MFA_SETUP_REQUIRED' && typeof window !== 'undefined') {
      window.dispatchEvent(new Event('pharmavault:mfa-setup-required'));
    }
    return Promise.reject(error);
  }
);

export default apiClient;
