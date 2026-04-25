import API from './api';

export const login = async (email, password) => {
  try {
    const response = await API.post('/auth/login', { email, password });
    return response.data; 
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Login failed!";
    throw new Error(message);
  }
};

export const me = async () => {
  try {
    const response = await API.get('/auth/me');
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || 'Could not load user info';
    throw new Error(message);
  }
};
export const register = async (username, email, password) => {
  try {
    const response = await API.post('/auth/register', { username, email, password });

    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || "Registration failed!";
    throw new Error(message);
  }
};
export const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.dispatchEvent(new Event('authChange'));
};