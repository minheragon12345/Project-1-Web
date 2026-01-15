import API from './api';
export const getNotes = async (search = '') => {
  try {
    const params = {};
    if (search) params.search = search;
    const response = await API.get('/notes', { params });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || "Không thể lấy danh sách ghi chú";
    throw new Error(message);
  }
};
export const createNote = async (noteData) => {
  try {
    const response = await API.post('/notes', noteData);
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || "Lỗi khi tạo ghi chú";
    throw new Error(message);
  }
};
export const deleteNote = async (id) => {
  try {
    const response = await API.delete(`/notes/${id}`);
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || "Lỗi khi xóa ghi chú";
    throw new Error(message);
  }
};
export const updateNote = async (id, updatedData) => {
  try {
    const response = await API.put(`/notes/${id}`, updatedData);
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || "Lỗi khi cập nhật ghi chú";
    throw new Error(message);
  }
};

export const getTrashNotes = async () => {
  try {
    const response = await API.get('/notes/trash');
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || "Không thể lấy danh sách thùng rác";
    throw new Error(message);
  }
};

export const restoreNote = async (id) => {
  try {
    const response = await API.patch(`/notes/${id}/restore`);
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || "Lỗi khi khôi phục ghi chú";
    throw new Error(message);
  }
};

export const deleteNotePermanent = async (id) => {
  try {
    const response = await API.delete(`/notes/${id}/hard`);
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || "Lỗi khi xóa vĩnh viễn";
    throw new Error(message);
  }
};