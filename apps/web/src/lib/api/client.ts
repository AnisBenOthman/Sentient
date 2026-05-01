import axios from 'axios';
import { authStore } from '../auth';

export const hrClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_HR_CORE_URL ?? 'http://localhost:3001',
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT to every request
hrClient.interceptors.request.use(config => {
  const token = authStore.getAccess();
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});

// Attempt silent refresh on 401
let refreshing: Promise<string> | null = null;

hrClient.interceptors.response.use(
  res => res,
  async error => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refreshToken = authStore.getRefresh();
      if (!refreshToken) {
        authStore.clear();
        window.location.replace('/login');
        return Promise.reject(error);
      }
      try {
        if (!refreshing) {
          refreshing = axios
            .post<{ accessToken: string; refreshToken: string }>(
              `${hrClient.defaults.baseURL}/auth/refresh`,
              { refreshToken },
            )
            .then(r => {
              authStore.set(r.data.accessToken, r.data.refreshToken);
              return r.data.accessToken;
            })
            .finally(() => { refreshing = null; });
        }
        const newToken = await refreshing;
        original.headers['Authorization'] = `Bearer ${newToken}`;
        return hrClient(original);
      } catch {
        authStore.clear();
        window.location.replace('/login');
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  },
);
