import API from './api';

export const getUsers = async (search = '') => {
  try {
    const params = {};
    if (search) params.search = search;
    const response = await API.get('/admin/users', { params });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || 'Không thể lấy danh sách người dùng';
    throw new Error(message);
  }
};

export const updateUserRole = async (userId, role) => {
  try {
    const response = await API.patch(`/admin/users/${userId}/role`, { role });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || 'Không thể cập nhật role';
    throw new Error(message);
  }
};

export const setUserBan = async (userId, isBanned, reason = '') => {
  try {
    const response = await API.patch(`/admin/users/${userId}/ban`, { isBanned, reason });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || 'Không thể cập nhật trạng thái ban';
    throw new Error(message);
  }
};

export const getAuditLogs = async ({ page = 1, limit = 100, action = '', targetType = '', actorId = '' } = {}) => {
  try {
    const params = { page, limit };
    if (action) params.action = action;
    if (targetType) params.targetType = targetType;
    if (actorId) params.actorId = actorId;
    const response = await API.get('/admin/audit-logs', { params });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || 'Không thể lấy audit logs';
    throw new Error(message);
  }
};
