import axios from 'axios';

// Force port 3000 to match your running backend
const API_URL = 'http://localhost:3000/api/v1/';

export const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(config => {
  // Ensure we don't have double slashes if the request already has one
  const targetUrl = config.url.startsWith('/') ? config.url.substring(1) : config.url;
  console.log(`[AXIOS] Requesting: ${config.baseURL}${targetUrl}`);
  return config;
});

apiClient.interceptors.response.use(
  response => response,
  error => {
    console.error(`[AXIOS] Error from ${error.config?.url}:`, error.response?.data || error.message);
    return Promise.reject(error);
  }
);
