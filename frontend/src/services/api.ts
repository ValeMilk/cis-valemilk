import axios from 'axios';

// Em produção (container), usa URL relativa para nginx fazer proxy
// Em desenvolvimento, usa a URL configurada ou fallback localhost:5888
const getBaseURL = () => {
  if (import.meta.env.PROD) {
    return '/api'; // Nginx faz proxy para backend
  }
  return import.meta.env.VITE_API_URL || 'http://localhost:5888/api';
};

const api = axios.create({
  baseURL: getBaseURL(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
