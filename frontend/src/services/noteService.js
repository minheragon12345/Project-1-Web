import API from './api';

export const getNotes = async (search = '', scope = 'all') => {
  try {
    const params = {};
    if (search) params.search = search;
    if (scope && scope !== 'all') params.scope = scope; // mine | shared
    const response = await API.get('/notes', { params });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || 'Không thể lấy danh sách task';
    throw new Error(message);
  }
};

export const createNote = async (noteData) => {
  try {
    const response = await API.post('/notes', noteData);
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || 'Lỗi khi tạo task';
    throw new Error(message);
  }
};

export const deleteNote = async (id) => {
  try {
    const response = await API.delete(`/notes/${id}`);
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || 'Lỗi khi xóa task';
    throw new Error(message);
  }
};

export const updateNote = async (id, updatedData) => {
  try {
    const response = await API.put(`/notes/${id}`, updatedData);
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || 'Lỗi khi cập nhật task';
    throw new Error(message);
  }
};

export const getTrashNotes = async () => {
  try {
    const response = await API.get('/notes/trash');
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || 'Không thể lấy danh sách thùng rác';
    throw new Error(message);
  }
};

export const restoreNote = async (id) => {
  try {
    const response = await API.patch(`/notes/${id}/restore`);
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || 'Lỗi khi khôi phục task';
    throw new Error(message);
  }
};

export const deleteNotePermanent = async (id) => {
  try {
    const response = await API.delete(`/notes/${id}/hard`);
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || 'Lỗi khi xóa vĩnh viễn';
    throw new Error(message);
  }
};

// Share
export const getNoteShares = async (noteId) => {
  try {
    const res = await API.get(`/notes/${noteId}/shares`);
    return res.data;
  } catch (error) {
    const message = error.response?.data?.message || 'Không thể lấy danh sách chia sẻ';
    throw new Error(message);
  }
};

export const shareNote = async (noteId, body) => {
  try {
    const res = await API.post(`/notes/${noteId}/share`, body);
    return res.data;
  } catch (error) {
    const message = error.response?.data?.message || 'Không thể chia sẻ task';
    throw new Error(message);
  }
};

export const updateNoteShare = async (noteId, shareUserId, permission) => {
  try {
    const res = await API.patch(`/notes/${noteId}/share/${shareUserId}`, { permission });
    return res.data;
  } catch (error) {
    const message = error.response?.data?.message || 'Không thể cập nhật quyền chia sẻ';
    throw new Error(message);
  }
};

export const removeNoteShare = async (noteId, shareUserId) => {
  try {
    const res = await API.delete(`/notes/${noteId}/share/${shareUserId}`);
    return res.data;
  } catch (error) {
    const message = error.response?.data?.message || 'Không thể xóa chia sẻ';
    throw new Error(message);
  }
};

// Comment
export const getNoteComments = async (noteId) => {
  try {
    const res = await API.get(`/notes/${noteId}/comments`);
    return res.data;
  } catch (error) {
    const message = error.response?.data?.message || 'Không thể tải bình luận';
    throw new Error(message);
  }
};

export const addNoteComment = async (noteId, text) => {
  try {
    const res = await API.post(`/notes/${noteId}/comments`, { text });
    return res.data;
  } catch (error) {
    const message = error.response?.data?.message || 'Không thể gửi bình luận';
    throw new Error(message);
  }
};
