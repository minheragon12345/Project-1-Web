import API from './api';

export const getUsersLite = async () => {
  try {
    const response = await API.get('/admin/users-lite');
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || 'Không thể lấy danh sách users';
    throw new Error(message);
  }
};

export const getStaffNotes = async ({ userId = '', includeDeleted = false, search = '' } = {}) => {
  try {
    const params = {};
    if (userId) params.userId = userId;
    if (includeDeleted) params.includeDeleted = 'true';
    if (search) params.search = search;
    const response = await API.get('/admin/notes', { params });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || 'Không thể lấy danh sách ghi chú';
    throw new Error(message);
  }
};

export const updateAnyNote = async (noteId, payload) => {
  try {
    const response = await API.patch(`/admin/notes/${noteId}`, payload);
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || 'Không thể cập nhật ghi chú';
    throw new Error(message);
  }
};

export const trashAnyNote = async (noteId) => {
  try {
    const response = await API.patch(`/admin/notes/${noteId}/trash`);
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || 'Không thể chuyển vào thùng rác';
    throw new Error(message);
  }
};

export const restoreAnyNote = async (noteId) => {
  try {
    const response = await API.patch(`/admin/notes/${noteId}/restore`);
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || 'Không thể khôi phục ghi chú';
    throw new Error(message);
  }
};

export const deleteAnyNotePermanent = async (noteId) => {
  try {
    const response = await API.delete(`/admin/notes/${noteId}`);
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || 'Không thể xóa vĩnh viễn';
    throw new Error(message);
  }
};
