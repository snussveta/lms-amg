import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for auth expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // If unauthorized and not already on auth page or public test routes, redirect to login
      const path = window.location.pathname;
      const isPublicRoute =
        path.startsWith('/login') ||
        path.startsWith('/register') ||
        path.startsWith('/t/') ||
        path.startsWith('/public-test/');

      if (!isPublicRoute) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const getErrorMessage = (error, defaultMessage = 'Произошла ошибка при отправке') => {
  if (!error) return defaultMessage;
  const detail = error.response?.data?.detail;
  if (typeof detail === 'string' && detail.trim().length > 0) {
    return detail;
  }
  if (Array.isArray(detail)) {
    // FastAPI / Pydantic validation errors format: [{ loc, msg, type }]
    const messages = detail
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item?.msg) {
          const loc = Array.isArray(item.loc)
            ? item.loc.filter((l) => l !== 'body').join('.')
            : '';
          return loc ? `${loc}: ${item.msg}` : item.msg;
        }
        return JSON.stringify(item);
      })
      .filter(Boolean);
    if (messages.length > 0) {
      return messages.join('; ');
    }
  }
  if (detail && typeof detail === 'object') {
    return detail.msg || detail.message || JSON.stringify(detail);
  }
  return error.response?.data?.message || error.message || defaultMessage;
};

export default api;

