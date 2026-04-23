import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  ArrowLeft,
  LayoutGrid,
  List,
  Settings,
  Save,
  Loader,
  UserPlus,
  Trash2,
  Archive,
  Moon,
  Sun,
  FolderKanban,
  Plus,
  X,
} from 'lucide-react';
import {
  getProject,
  updateProject,
  archiveProject,
  deleteProject,
  getProjectMembers,
  addProjectMember,
  updateProjectMemberRole,
  removeProjectMember,
} from '../services/projectService';
import { getNotes, createNote, updateNote } from '../services/noteService';
import './ProjectDetail.css';

const TABS = [
  { key: 'board', label: 'Bảng', icon: LayoutGrid },
  { key: 'list', label: 'Danh sách', icon: List },
  { key: 'settings', label: 'Cài đặt', icon: Settings },
];

const MEMBER_ROLE_OPTIONS = [
  { value: 'editor', label: 'Editor — có thể chỉnh sửa' },
  { value: 'viewer', label: 'Viewer — chỉ xem' },
];

const ProjectDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState('light');
  const [tab, setTab] = useState('board');

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    budgetAmount: 0,
    budgetCurrency: 'USD',
    budgetType: 'hourly',
  });

  const [members, setMembers] = useState([]);
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState('editor');
  const [memberSaving, setMemberSaving] = useState(false);

  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', content: '', priority: 1, deadline: '' });
  const [taskSaving, setTaskSaving] = useState(false);

  const user = useMemo(() => {
    try {
      const s = localStorage.getItem('user');
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  }, []);

  const fetchProject = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getProject(id);
      const p = data?.project;
      if (!p) throw new Error('Không tìm thấy dự án');
      setProject(p);
      setForm({
        name: p.name || '',
        description: p.description || '',
        startDate: p.startDate ? new Date(p.startDate).toISOString().slice(0, 10) : '',
        endDate: p.endDate ? new Date(p.endDate).toISOString().slice(0, 10) : '',
        budgetAmount: p.budget?.amount ?? 0,
        budgetCurrency: p.budget?.currency || 'USD',
        budgetType: p.budget?.type || 'hourly',
      });
    } catch (err) {
      toast.error(err.message || 'Không thể tải dự án');
      navigate('/projects');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  const fetchMembers = useCallback(async () => {
    try {
      const data = await getProjectMembers(id);
      setMembers(Array.isArray(data?.members) ? data.members : []);
    } catch (err) {
      toast.error(err.message || 'Không thể tải thành viên');
    }
  }, [id]);

  const fetchTasks = useCallback(async () => {
    setTasksLoading(true);
    try {
      const data = await getNotes('', 'all', { projectId: id });
      setTasks(Array.isArray(data?.notes) ? data.notes : []);
    } catch (err) {
      toast.error(err.message || 'Không thể tải công việc');
    } finally {
      setTasksLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    fetchProject();
  }, [fetchProject, navigate]);

  useEffect(() => {
    if (project && tab === 'settings') fetchMembers();
    if (project && (tab === 'board' || tab === 'list')) fetchTasks();
  }, [project, tab, fetchMembers, fetchTasks]);

  const isOwner = project?.role === 'owner';
  const canEdit = project?.role === 'owner' || project?.role === 'editor';

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Tên dự án không được để trống');
      return;
    }
    setSaving(true);
    try {
      await updateProject(id, {
        name: form.name.trim(),
        description: form.description.trim(),
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        budget: {
          amount: Number(form.budgetAmount) || 0,
          currency: form.budgetCurrency || 'USD',
          type: form.budgetType || 'hourly',
        },
      });
      toast.success('Đã lưu thay đổi');
      fetchProject();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi lưu');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    try {
      await archiveProject(id);
      toast.success(project?.status === 'archived' ? 'Đã khôi phục' : 'Đã lưu trữ');
      fetchProject();
    } catch (err) {
      toast.error(err.message || 'Lỗi');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Xóa dự án "${project?.name}"? Hành động này không thể hoàn tác.`)) return;
    try {
      await deleteProject(id);
      toast.success('Đã xóa dự án');
      navigate('/projects');
    } catch (err) {
      toast.error(err.message || 'Lỗi khi xóa');
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!memberEmail.trim()) {
      toast.error('Email không được để trống');
      return;
    }
    setMemberSaving(true);
    try {
      await addProjectMember(id, { email: memberEmail.trim(), role: memberRole });
      toast.success('Đã thêm thành viên');
      setMemberEmail('');
      fetchMembers();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi thêm thành viên');
    } finally {
      setMemberSaving(false);
    }
  };

  const handleChangeMemberRole = async (memberUserId, role) => {
    try {
      await updateProjectMemberRole(id, memberUserId, role);
      toast.success('Đã cập nhật vai trò');
      fetchMembers();
    } catch (err) {
      toast.error(err.message || 'Lỗi');
    }
  };

  const handleRemoveMember = async (memberUserId) => {
    if (!window.confirm('Xóa thành viên này khỏi dự án?')) return;
    try {
      await removeProjectMember(id, memberUserId);
      toast.success('Đã xóa thành viên');
      fetchMembers();
    } catch (err) {
      toast.error(err.message || 'Lỗi');
    }
  };

  const handleOpenCreateTask = () => {
    setTaskForm({ title: '', content: '', priority: 1, deadline: '' });
    setShowTaskModal(true);
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    const content = (taskForm.content || '').trim();
    if (!content) {
      toast.error('Nội dung không được để trống');
      return;
    }
    setTaskSaving(true);
    try {
      await createNote({
        title: taskForm.title.trim(),
        content,
        project: id,
        priority: Number(taskForm.priority) || 0,
        deadline: taskForm.deadline || null,
        status: 'not_done',
        progress: 0,
      });
      toast.success('Đã tạo task');
      setShowTaskModal(false);
      fetchTasks();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi tạo task');
    } finally {
      setTaskSaving(false);
    }
  };

  const handleToggleTaskDone = async (task) => {
    const newStatus = task.status === 'done' ? 'not_done' : 'done';
    try {
      await updateNote(task._id || task.id, {
        status: newStatus,
        progress: newStatus === 'done' ? 100 : 0,
      });
      fetchTasks();
    } catch (err) {
      toast.error(err.message || 'Không thể cập nhật');
    }
  };

  const toggleTheme = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'));

  if (loading || !project) {
    return (
      <div className={`project-detail-container ${theme === 'dark' ? 'dark-theme' : ''}`}>
        <div className="projects-loading">
          <Loader className="spin" size={28} />
          <span>Đang tải dự án...</span>
        </div>
      </div>
    );
  }

  const boardColumns = [
    { key: 'not_done', label: 'Chưa làm' },
    { key: 'in_progress', label: 'Đang làm' },
    { key: 'done', label: 'Đã xong' },
    { key: 'cancelled', label: 'Đã hủy' },
  ];

  return (
    <div className={`project-detail-container ${theme === 'dark' ? 'dark-theme' : ''}`}>
      <div className="project-detail-header">
        <button className="btn-secondary" onClick={() => navigate('/projects')}>
          <ArrowLeft size={16} />
          <span>Quay lại</span>
        </button>

        <div className="project-title-block">
          <h2>
            <FolderKanban size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />
            {project.name}
            {project.status === 'archived' ? (
              <span className="badge-archived" style={{ marginLeft: 8 }}>Đã lưu trữ</span>
            ) : null}
          </h2>
          <div className="project-sub">
            <span className={`project-role role-${project.role}`}>{project.role}</span>
            <span className="project-sub-dot">•</span>
            <span>
              Chủ dự án: <strong>{project.owner?.username || project.owner?.email || '—'}</strong>
            </span>
            <span className="project-sub-dot">•</span>
            <span>Thành viên: {members?.length || project.members?.length || 0}</span>
          </div>
        </div>

        <div className="action-buttons">
          <button className="icon-btn" onClick={toggleTheme} title="Đổi giao diện">
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          {isOwner && !project.isPersonal ? (
            <button className="btn-secondary" onClick={handleArchive}>
              <Archive size={16} />
              <span>{project.status === 'archived' ? 'Khôi phục' : 'Lưu trữ'}</span>
            </button>
          ) : null}
        </div>
      </div>

      <div className="project-tabs">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            className={`tab ${tab === key ? 'active' : ''}`}
            onClick={() => setTab(key)}
          >
            <Icon size={16} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="project-tab-content">
        {tab === 'board' ? (
          <div className="board-preview">
            <div className="board-preview-header">
              <p className="board-preview-note">Xem nhanh theo trạng thái. Kéo-thả sẽ được thêm vào Ngày 3.</p>
              {canEdit ? (
                <button className="btn-primary" onClick={handleOpenCreateTask}>
                  <Plus size={16} />
                  <span>Task mới</span>
                </button>
              ) : null}
            </div>
            {tasksLoading ? (
              <div className="projects-loading"><Loader className="spin" size={24} /> <span>Đang tải...</span></div>
            ) : (
              <div className="board-columns">
                {boardColumns.map((col) => {
                  const items = tasks.filter((t) => {
                    if (col.key === 'in_progress') {
                      const p = Number(t.progress) || 0;
                      return t.status !== 'done' && t.status !== 'cancelled' && p > 0 && p < 100;
                    }
                    if (col.key === 'not_done') {
                      const p = Number(t.progress) || 0;
                      return t.status === 'not_done' && !(p > 0);
                    }
                    return t.status === col.key;
                  });
                  return (
                    <div className="board-column" key={col.key}>
                      <div className="board-column-header">
                        <span>{col.label}</span>
                        <span className="board-count">{items.length}</span>
                      </div>
                      <div className="board-column-body">
                        {items.length === 0 ? (
                          <div className="board-empty">—</div>
                        ) : (
                          items.slice(0, 10).map((t) => (
                            <div className="board-card" key={t._id || t.id}>
                              <div className="board-card-title">{t.title || t.content?.slice(0, 60) || 'Không tiêu đề'}</div>
                              <div className="board-card-meta">
                                <span className="priority-chip">P{t.priority || 0}</span>
                                {t.deadline ? (
                                  <span>{new Date(t.deadline).toLocaleDateString('vi-VN')}</span>
                                ) : null}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : tab === 'list' ? (
          <div className="task-list-panel">
            <div className="task-list-header">
              <h3>Công việc trong dự án ({tasks.length})</h3>
              {canEdit ? (
                <button className="btn-primary" onClick={handleOpenCreateTask}>
                  <Plus size={16} />
                  <span>Task mới</span>
                </button>
              ) : null}
            </div>
            {tasksLoading ? (
              <div className="projects-loading"><Loader className="spin" size={24} /> <span>Đang tải...</span></div>
            ) : tasks.length === 0 ? (
              <div className="tab-placeholder">
                <List size={40} />
                <p>Chưa có công việc nào. Tạo task đầu tiên để bắt đầu.</p>
              </div>
            ) : (
              <div className="task-list">
                {tasks.map((t) => {
                  const tid = t._id || t.id;
                  const progress = typeof t.progress === 'number' ? t.progress : 0;
                  const overdue =
                    t.deadline &&
                    t.status !== 'done' &&
                    t.status !== 'cancelled' &&
                    new Date(t.deadline).getTime() < Date.now() &&
                    progress < 100;
                  return (
                    <div className={`task-row ${t.status} ${overdue ? 'overdue' : ''}`} key={tid}>
                      <input
                        type="checkbox"
                        checked={t.status === 'done'}
                        onChange={() => handleToggleTaskDone(t)}
                        disabled={!canEdit && t.access !== 'owner' && t.access !== 'write'}
                        aria-label="Hoàn thành"
                      />
                      <div className="task-main">
                        <div className="task-title">
                          {t.title || <span className="task-placeholder">(không tiêu đề)</span>}
                        </div>
                        <div className="task-sub">
                          <span className="priority-chip">P{t.priority || 0}</span>
                          <span>{t.category || 'Other'}</span>
                          {t.deadline ? (
                            <span className={overdue ? 'overdue-text' : ''}>
                              Hạn: {new Date(t.deadline).toLocaleDateString('vi-VN')}
                            </span>
                          ) : (
                            <span className="muted">Không hạn</span>
                          )}
                          {t.owner?.username ? <span className="muted">• {t.owner.username}</span> : null}
                        </div>
                        <div className="task-progress">
                          <div className="task-progress-bar">
                            <div className="task-progress-fill" style={{ width: `${progress}%` }} />
                          </div>
                          <span className="task-progress-text">{progress}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="settings-panel">
            <form className="settings-form" onSubmit={handleSaveSettings}>
              <h3>Thông tin dự án</h3>
              <label>
                <span>Tên dự án *</span>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} disabled={!canEdit} maxLength={120} />
              </label>
              <label>
                <span>Mô tả</span>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} disabled={!canEdit} rows={3} maxLength={2000} />
              </label>

              <div className="form-row">
                <label>
                  <span>Ngày bắt đầu</span>
                  <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} disabled={!canEdit} />
                </label>
                <label>
                  <span>Ngày kết thúc</span>
                  <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} disabled={!canEdit} />
                </label>
              </div>

              <div className="form-row">
                <label>
                  <span>Ngân sách</span>
                  <input type="number" min="0" step="0.01" value={form.budgetAmount} onChange={(e) => setForm({ ...form, budgetAmount: e.target.value })} disabled={!canEdit} />
                </label>
                <label>
                  <span>Tiền tệ</span>
                  <input type="text" maxLength={8} value={form.budgetCurrency} onChange={(e) => setForm({ ...form, budgetCurrency: e.target.value.toUpperCase() })} disabled={!canEdit} />
                </label>
                <label>
                  <span>Loại</span>
                  <select value={form.budgetType} onChange={(e) => setForm({ ...form, budgetType: e.target.value })} disabled={!canEdit}>
                    <option value="hourly">Theo giờ</option>
                    <option value="fixed">Cố định</option>
                  </select>
                </label>
              </div>

              {canEdit ? (
                <div className="settings-actions">
                  <button type="submit" className="btn-primary" disabled={saving}>
                    {saving ? <Loader size={16} className="spin" /> : <Save size={16} />}
                    <span>{saving ? 'Đang lưu...' : 'Lưu thay đổi'}</span>
                  </button>
                </div>
              ) : null}
            </form>

            <div className="members-section">
              <h3>Thành viên ({members.length})</h3>

              {isOwner ? (
                <form className="member-add-form" onSubmit={handleAddMember}>
                  <input type="email" placeholder="Email thành viên" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} />
                  <select value={memberRole} onChange={(e) => setMemberRole(e.target.value)}>
                    {MEMBER_ROLE_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                  </select>
                  <button type="submit" className="btn-primary" disabled={memberSaving}>
                    {memberSaving ? <Loader size={16} className="spin" /> : <UserPlus size={16} />}
                    <span>Thêm</span>
                  </button>
                </form>
              ) : null}

              <div className="members-list">
                <div className="member-row owner-row">
                  <div className="member-info">
                    <strong>{project.owner?.username || '—'}</strong>
                    <span className="member-email">{project.owner?.email}</span>
                  </div>
                  <span className="project-role role-owner">owner</span>
                </div>
                {members.map((m) => (
                  <div className="member-row" key={m.user?.id}>
                    <div className="member-info">
                      <strong>{m.user?.username || '—'}</strong>
                      <span className="member-email">{m.user?.email}</span>
                    </div>
                    {isOwner ? (
                      <div className="member-actions">
                        <select value={m.role} onChange={(e) => handleChangeMemberRole(m.user.id, e.target.value)}>
                          {MEMBER_ROLE_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                        </select>
                        <button className="icon-btn danger" title="Xóa thành viên" onClick={() => handleRemoveMember(m.user.id)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ) : (
                      <span className={`project-role role-${m.role}`}>{m.role}</span>
                    )}
                  </div>
                ))}
                {members.length === 0 ? (<div className="member-empty">Chưa có thành viên nào ngoài chủ dự án.</div>) : null}
              </div>
            </div>

            {isOwner && !project.isPersonal ? (
              <div className="danger-zone">
                <h3>Vùng nguy hiểm</h3>
                <p>Xóa dự án sẽ chuyển vào thùng rác (ẩn khỏi danh sách).</p>
                <button className="btn-danger" onClick={handleDelete}>
                  <Trash2 size={16} />
                  <span>Xóa dự án</span>
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {showTaskModal ? (
        <div className="modal-backdrop" onClick={() => !taskSaving && setShowTaskModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Tạo task mới</h3>
              <button className="icon-btn" onClick={() => !taskSaving && setShowTaskModal(false)} title="Đóng">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateTask} className="modal-form">
              <label>
                <span>Tiêu đề</span>
                <input type="text" value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} placeholder="Ví dụ: Viết landing page copy" maxLength={120} autoFocus />
              </label>
              <label>
                <span>Nội dung *</span>
                <textarea rows={4} value={taskForm.content} onChange={(e) => setTaskForm({ ...taskForm, content: e.target.value })} maxLength={5000} placeholder="Chi tiết công việc..." />
              </label>
              <div className="form-row">
                <label>
                  <span>Deadline</span>
                  <input type="date" value={taskForm.deadline} onChange={(e) => setTaskForm({ ...taskForm, deadline: e.target.value })} />
                </label>
                <label>
                  <span>Ưu tiên</span>
                  <input type="number" min="0" max="1024" value={taskForm.priority} onChange={(e) => setTaskForm({ ...taskForm, priority: parseInt(e.target.value || '0', 10) })} />
                </label>
              </div>
              <div className="settings-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowTaskModal(false)} disabled={taskSaving}>Hủy</button>
                <button type="submit" className="btn-primary" disabled={taskSaving}>
                  {taskSaving ? <Loader size={16} className="spin" /> : <Plus size={16} />}
                  <span>{taskSaving ? 'Đang tạo...' : 'Tạo task'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ProjectDetail;
