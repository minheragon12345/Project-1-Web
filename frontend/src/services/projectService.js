import API from './api';

export const getProjects = async ({ search = '', scope = 'all', status = '' } = {}) => {
  try {
    const params = {};
    if (search) params.search = search;
    if (scope && scope !== 'all') params.scope = scope; // mine | shared
    if (status) params.status = status; // active | archived
    const res = await API.get('/projects', { params });
    return res.data;
  } catch (error) {
    const message = error.response?.data?.message || 'Không thể tải danh sách dự án';
    throw new Error(message);
  }
};

export const getProject = async (id) => {
  try {
    const res = await API.get(`/projects/${id}`);
    return res.data;
  } catch (error) {
    const message = error.response?.data?.message || 'Không thể tải dự án';
    throw new Error(message);
  }
};

export const createProject = async (data) => {
  try {
    const res = await API.post('/projects', data);
    return res.data;
  } catch (error) {
    const message = error.response?.data?.message || 'Lỗi khi tạo dự án';
    throw new Error(message);
  }
};

export const updateProject = async (id, data) => {
  try {
    const res = await API.put(`/projects/${id}`, data);
    return res.data;
  } catch (error) {
    const message = error.response?.data?.message || 'Lỗi khi cập nhật dự án';
    throw new Error(message);
  }
};

export const archiveProject = async (id) => {
  try {
    const res = await API.patch(`/projects/${id}/archive`);
    return res.data;
  } catch (error) {
    const message = error.response?.data?.message || 'Lỗi khi lưu trữ dự án';
    throw new Error(message);
  }
};

export const deleteProject = async (id) => {
  try {
    const res = await API.delete(`/projects/${id}`);
    return res.data;
  } catch (error) {
    const message = error.response?.data?.message || 'Lỗi khi xóa dự án';
    throw new Error(message);
  }
};

export const getProjectMembers = async (id) => {
  try {
    const res = await API.get(`/projects/${id}/members`);
    return res.data;
  } catch (error) {
    const message = error.response?.data?.message || 'Không thể tải danh sách thành viên';
    throw new Error(message);
  }
};

export const addProjectMember = async (id, { email, role }) => {
  try {
    const res = await API.post(`/projects/${id}/members`, { email, role });
    return res.data;
  } catch (error) {
    const message = error.response?.data?.message || 'Không thể thêm thành viên';
    throw new Error(message);
  }
};

export const updateProjectMemberRole = async (id, memberUserId, role) => {
  try {
    const res = await API.patch(`/projects/${id}/members/${memberUserId}`, { role });
    return res.data;
  } catch (error) {
    const message = error.response?.data?.message || 'Không thể cập nhật vai trò';
    throw new Error(message);
  }
};

export const removeProjectMember = async (id, memberUserId) => {
  try {
    const res = await API.delete(`/projects/${id}/members/${memberUserId}`);
    return res.data;
  } catch (error) {
    const message = error.response?.data?.message || 'Không thể xóa thành viên';
    throw new Error(message);
  }
};
