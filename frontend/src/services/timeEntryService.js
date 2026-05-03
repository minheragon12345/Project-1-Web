import API from './api';

export const listTimeEntries = async (params = {}) => {
  try {
    const response = await API.get('/time-entries', { params });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || 'Could not load time entries';
    throw new Error(message);
  }
};

export const createTimeEntry = async (body) => {
  try {
    const response = await API.post('/time-entries', body);
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || 'Could not create time entry';
    throw new Error(message);
  }
};

export const updateTimeEntry = async (id, body) => {
  try {
    const response = await API.put(`/time-entries/${id}`, body);
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || 'Could not update time entry';
    throw new Error(message);
  }
};

export const deleteTimeEntry = async (id) => {
  try {
    const response = await API.delete(`/time-entries/${id}`);
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || 'Could not delete time entry';
    throw new Error(message);
  }
};

export const getTimeSummaryByTask = async (projectId) => {
  try {
    const response = await API.get('/time-entries/summary/by-task', {
      params: { project: projectId },
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || 'Could not load time summary';
    throw new Error(message);
  }
};
