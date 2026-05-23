import axios from 'axios';
import { authStore } from '../auth';

const gatewayBaseUrl = (import.meta.env.VITE_API_GATEWAY_URL ?? '').replace(/\/$/, '');

export const hrApiBaseUrl = gatewayBaseUrl ? `${gatewayBaseUrl}/api/hr` : '/api/hr';

export const hrClient = axios.create({
  baseURL: hrApiBaseUrl,
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

export async function refreshAccessToken(): Promise<string> {
  const refreshToken = authStore.getRefresh();
  if (!refreshToken) {
    authStore.clear();
    window.location.replace('/signin');
    throw new Error('Missing refresh token');
  }

  if (!refreshing) {
    refreshing = axios
      .post<{ accessToken: string; refreshToken: string }>(
        `${hrApiBaseUrl}/auth/refresh`,
        { refreshToken },
      )
      .then(r => {
        authStore.set(r.data.accessToken, r.data.refreshToken);
        return r.data.accessToken;
      })
      .finally(() => { refreshing = null; });
  }

  return refreshing;
}

hrClient.interceptors.response.use(
  res => res,
  async error => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const newToken = await refreshAccessToken();
        original.headers['Authorization'] = `Bearer ${newToken}`;
        return hrClient(original);
      } catch {
        authStore.clear();
        window.location.replace('/signin');
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  },
);
