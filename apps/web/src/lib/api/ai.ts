import axios from 'axios';
import { authStore } from '../auth';

const gatewayBaseUrl = (import.meta.env.VITE_API_GATEWAY_URL ?? '').replace(/\/$/, '');

export const aiClient = axios.create({
  baseURL: gatewayBaseUrl ? `${gatewayBaseUrl}/api/ai` : '/api/ai',
  headers: { 'Content-Type': 'application/json' },
});

aiClient.interceptors.request.use((config) => {
  const token = authStore.getAccess();
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});

export const aiApi = {
  client: aiClient,
};
