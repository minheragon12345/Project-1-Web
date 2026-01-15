import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

API.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const data = error?.response?.data;

    // Token invalid / expired
    if (status === 401) {
      try {
        sessionStorage.setItem('auth_error', data?.message || 'Lỗi xác thực, vui lòng đăng nhập lại');
      } catch {}
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
      return Promise.reject(error);
    }

    // Banned user (force logout)
    if (status === 403 && data?.code === 'USER_BANNED') {
    const url = error?.config?.url || '';
    const isLoginRequest = url.includes('/auth/login');
    const hasToken = !!localStorage.getItem('token');
    if (hasToken && !isLoginRequest) {
      try {
        sessionStorage.setItem('auth_error', data?.message || 'Tài khoản đã bị khóa');
      } catch {}

      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }

    return Promise.reject(error);
  }
);

export default API;
