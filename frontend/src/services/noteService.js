import API from './api';

export const getNotes = async (search = '', scope = 'all', extra = {}) => {
  try {
    const params = {};
    if (search) params.search = search;
    if (scope && scope !== 'all') params.scope = scope; // mine | shared
    if (extra.projectId) params.projectId = extra.projectId;
    if (extra.status) params.status = extra.status;
    if (extra.category) params.category = extra.category;
    const response = await API.get('/notes', { params });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || 'Could not load tasks';
    throw new Error(message);
  }
};

export const createNote = async (noteData) => {
  try {
    const response = await API.post('/notes', noteData);
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || 'Failed to create task';
    throw new Error(message);
  }
};

export const deleteNote = async (id) => {
  try {
    const response = await API.delete(`/notes/${id}`);
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || 'Failed to delete task';
    throw new Error(message);
  }
};

export const updateNote = async (id, updatedData) => {
  try {
    const response = await API.put(`/notes/${id}`, updatedData);
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || 'Failed to update task';
    throw new Error(message);
  }
};

export const getTrashNotes = async () => {
  try {
    const response = await API.get('/notes/trash');
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || 'Could not load trash';
    throw new Error(message);
  }
};

export const restoreNote = async (id) => {
  try {
    const response = await API.patch(`/notes/${id}/restore`);
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || 'Failed to restore task';
    throw new Error(message);
  }
};

export const deleteNotePermanent = async (id) => {
  try {
    const response = await API.delete(`/notes/${id}/hard`);
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || 'Failed to delete permanently';
    throw new Error(message);
  }
};

// Share
export const getNoteShares = async (noteId) => {
  try {
    const res = await API.get(`/notes/${noteId}/shares`);
    return res.data;
  } catch (error) {
    const message = error.response?.data?.message || 'Could not load shares';
    throw new Error(message);
  }
};

export const shareNote = async (noteId, body) => {
  try {
    const res = await API.post(`/notes/${noteId}/share`, body);
    return res.data;
  } catch (error) {
    const message = error.response?.data?.message || 'Could not share task';
    throw new Error(message);
  }
};

export const updateNoteShare = async (noteId, shareUserId, permission) => {
  try {
    const res = await API.patch(`/notes/${noteId}/share/${shareUserId}`, { permission });
    return res.data;
  } catch (error) {
    const message = error.response?.data?.message || 'Could not update share permission';
    throw new Error(message);
  }
};

export const removeNoteShare = async (noteId, shareUserId) => {
  try {
    const res = await API.delete(`/notes/${noteId}/share/${shareUserId}`);
    return res.data;
  } catch (error) {
    const message = error.response?.data?.message || 'Could not remove share';
    throw new Error(message);
  }
};

// Comment
export const getNoteComments = async (noteId) => {
  try {
    const res = await API.get(`/notes/${noteId}/comments`);
    return res.data;
  } catch (error) {
    const message = error.response?.data?.message || 'Could not load comments';
    throw new Error(message);
  }
};

export const addNoteComment = async (noteId, text) => {
  try {
    const res = await API.post(`/notes/${noteId}/comments`, { text });
    return res.data;
  } catch (error) {
    const message = error.response?.data?.message || 'Could not post comment';
    throw new Error(message);
  }
};
