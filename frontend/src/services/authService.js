import API from './api';
export const login = async (email, password) => {
  try {
    const response = await API.post('/auth/login', { email, password });
    return response.data; 
  } catch (error) {
    const message = error.response?.data?.message || "Đăng nhập thất bại!";
    throw new Error(message);
  }
};
export const register = async (username, email, password) => {
  try {
    const response = await API.post('/auth/register', { username, email, password });
    
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || "Đăng ký thất bại!";
    throw new Error(message);
  }
};
export const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.dispatchEvent(new Event('authChange'));
};