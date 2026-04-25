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
import KanbanBoard from '../components/KanbanBoard';
import './ProjectDetail.css';

const TASK_CATEGORIES = ['Study', 'Health', 'Finance', 'Work', 'Personal', 'Other'];

const TABS = [
  { key: 'board', label: 'Board', icon: LayoutGrid },
  { key: 'list', label: 'List', icon: List },
  { key: 'settings', label: 'Settings', icon: Settings },
];

const MEMBER_ROLE_OPTIONS = [
  { value: 'editor', label: 'Editor — can edit' },
  { value: 'viewer', label: 'Viewer — read-only' },
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
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [taskForm, setTaskForm] = useState({
    title: '',
    content: '',
    priority: 1,
    deadline: '',
    progress: 0,
    category: 'Other',
    cancelled: false,
  });
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
      if (!p) throw new Error('Project not found');
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
      toast.error(err.message || 'Failed to load project');
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
      toast.error(err.message || 'Failed to load members');
    }
  }, [id]);

  const fetchTasks = useCallback(async () => {
    setTasksLoading(true);
    try {
      const data = await getNotes('', 'all', { projectId: id });
      setTasks(Array.isArray(data?.notes) ? data.notes : []);
    } catch (err) {
      toast.error(err.message || 'Failed to load tasks');
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
      toast.error('Project name cannot be empty');
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
      toast.success('Changes saved');
      fetchProject();
    } catch (err) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    try {
      await archiveProject(id);
      toast.success(project?.status === 'archived' ? 'Restored' : 'Archived');
      fetchProject();
    } catch (err) {
      toast.error(err.message || 'Error');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete project "${project?.name}"? This action cannot be undone.`)) return;
    try {
      await deleteProject(id);
      toast.success('Project deleted');
      navigate('/projects');
    } catch (err) {
      toast.error(err.message || 'Failed to delete');
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!memberEmail.trim()) {
      toast.error('Email cannot be empty');
      return;
    }
    setMemberSaving(true);
    try {
      await addProjectMember(id, { email: memberEmail.trim(), role: memberRole });
      toast.success('Member added');
      setMemberEmail('');
      fetchMembers();
    } catch (err) {
      toast.error(err.message || 'Failed to add member');
    } finally {
      setMemberSaving(false);
    }
  };

  const handleChangeMemberRole = async (memberUserId, role) => {
    try {
      await updateProjectMemberRole(id, memberUserId, role);
      toast.success('Role updated');
      fetchMembers();
    } catch (err) {
      toast.error(err.message || 'Error');
    }
  };

  const handleRemoveMember = async (memberUserId) => {
    if (!window.confirm('Remove this member from the project?')) return;
    try {
      await removeProjectMember(id, memberUserId);
      toast.success('Member removed');
      fetchMembers();
    } catch (err) {
      toast.error(err.message || 'Error');
    }
  };

  const resetTaskForm = () => {
    setTaskForm({
      title: '',
      content: '',
      priority: 1,
      deadline: '',
      progress: 0,
      category: 'Other',
      cancelled: false,
    });
    setEditingTaskId(null);
  };

  const handleOpenCreateTask = () => {
    resetTaskForm();
    setShowTaskModal(true);
  };

  const toDateInputValue = (value) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  };

  const handleOpenEditTask = (task) => {
    if (!task) return;
    const editorAccess = task.access === 'owner' || task.access === 'write';
    if (!canEdit && !editorAccess) {
      toast.info('You only have read access to this task.');
      return;
    }
    setEditingTaskId(task._id || task.id);
    setTaskForm({
      title: task.title || '',
      content: task.content || '',
      priority: typeof task.priority === 'number' ? task.priority : 1,
      deadline: toDateInputValue(task.deadline),
      progress: typeof task.progress === 'number' ? task.progress : 0,
      category: task.category || 'Other',
      cancelled: task.status === 'cancelled',
    });
    setShowTaskModal(true);
  };

  const handleSaveTask = async (e) => {
    e.preventDefault();
    const content = (taskForm.content || '').trim();
    if (!content) {
      toast.error('Content cannot be empty');
      return;
    }
    const progress = Math.max(0, Math.min(100, Number(taskForm.progress) || 0));
    const status = taskForm.cancelled ? 'cancelled' : progress >= 100 ? 'done' : 'not_done';
    const payload = {
      title: taskForm.title.trim(),
      content,
      project: id,
      priority: Number(taskForm.priority) || 0,
      deadline: taskForm.deadline || null,
      category: taskForm.category || 'Other',
      progress,
      status,
    };
    setTaskSaving(true);
    try {
      if (editingTaskId) {
        await updateNote(editingTaskId, payload);
        toast.success('Task saved');
      } else {
        await createNote(payload);
        toast.success('Task created');
      }
      setShowTaskModal(false);
      resetTaskForm();
      fetchTasks();
    } catch (err) {
      toast.error(err.message || 'Failed to save task');
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
      toast.error(err.message || 'Could not update');
    }
  };

  const handleTaskMove = async (task, patch) => {
    const tid = task._id || task.id;
    const previous = tasks;
    setTasks((prev) =>
      prev.map((t) => ((t._id || t.id) === tid ? { ...t, ...patch } : t)),
    );
    try {
      await updateNote(tid, patch);
      fetchTasks();
    } catch (err) {
      setTasks(previous);
      toast.error(err.message || 'Could not move task');
    }
  };

  const handleCloseTaskModal = () => {
    if (taskSaving) return;
    setShowTaskModal(false);
    resetTaskForm();
  };

  const toggleTheme = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'));

  if (loading || !project) {
    return (
      <div className={`project-detail-container ${theme === 'dark' ? 'dark-theme' : ''}`}>
        <div className="projects-loading">
          <Loader className="spin" size={28} />
          <span>Loading project…</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`project-detail-container ${theme === 'dark' ? 'dark-theme' : ''}`}>
      <div className="project-detail-header">
        <button className="btn-secondary" onClick={() => navigate('/projects')}>
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>

        <div className="project-title-block">
          <h2>
            <FolderKanban size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />
            {project.name}
            {project.status === 'archived' ? (
              <span className="badge-archived" style={{ marginLeft: 8 }}>Archived</span>
            ) : null}
          </h2>
          <div className="project-sub">
            <span className={`project-role role-${project.role}`}>{project.role}</span>
            <span className="project-sub-dot">•</span>
            <span>
              Project owner: <strong>{project.owner?.username || project.owner?.email || '—'}</strong>
            </span>
            <span className="project-sub-dot">•</span>
            <span>Members: {members?.length || project.members?.length || 0}</span>
          </div>
        </div>

        <div className="action-buttons">
          <button className="icon-btn" onClick={toggleTheme} title="Toggle theme">
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          {isOwner && !project.isPersonal ? (
            <button className="btn-secondary" onClick={handleArchive}>
              <Archive size={16} />
              <span>{project.status === 'archived' ? 'Restore' : 'Archive'}</span>
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
              <p className="board-preview-note">
                Drag a card into a column to change its status. Click a card to edit it.
              </p>
              {canEdit ? (
                <button className="btn-primary" onClick={handleOpenCreateTask}>
                  <Plus size={16} />
                  <span>New task</span>
                </button>
              ) : null}
            </div>
            {tasksLoading ? (
              <div className="projects-loading"><Loader className="spin" size={24} /> <span>Loading…</span></div>
            ) : (
              <KanbanBoard
                tasks={tasks}
                canEdit={canEdit}
                onTaskMove={handleTaskMove}
                onCardClick={handleOpenEditTask}
              />
            )}
          </div>
        ) : tab === 'list' ? (
          <div className="task-list-panel">
            <div className="task-list-header">
              <h3>Tasks in this project ({tasks.length})</h3>
              {canEdit ? (
                <button className="btn-primary" onClick={handleOpenCreateTask}>
                  <Plus size={16} />
                  <span>New task</span>
                </button>
              ) : null}
            </div>
            {tasksLoading ? (
              <div className="projects-loading"><Loader className="spin" size={24} /> <span>Loading…</span></div>
            ) : tasks.length === 0 ? (
              <div className="tab-placeholder">
                <List size={40} />
                <p>No tasks yet. Create the first task to get started.</p>
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
                    <div
                      className={`task-row ${t.status} ${overdue ? 'overdue' : ''}`}
                      key={tid}
                      onClick={() => handleOpenEditTask(t)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleOpenEditTask(t);
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={t.status === 'done'}
                        onChange={() => handleToggleTaskDone(t)}
                        onClick={(e) => e.stopPropagation()}
                        disabled={!canEdit && t.access !== 'owner' && t.access !== 'write'}
                        aria-label="Mark as done"
                      />
                      <div className="task-main">
                        <div className="task-title">
                          {t.title || <span className="task-placeholder">(no title)</span>}
                        </div>
                        <div className="task-sub">
                          <span className="priority-chip">P{t.priority || 0}</span>
                          <span>{t.category || 'Other'}</span>
                          {t.deadline ? (
                            <span className={overdue ? 'overdue-text' : ''}>
                              Due: {new Date(t.deadline).toLocaleDateString('vi-VN')}
                            </span>
                          ) : (
                            <span className="muted">No deadline</span>
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
              <h3>Project info</h3>
              <label>
                <span>Project name *</span>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} disabled={!canEdit} maxLength={120} />
              </label>
              <label>
                <span>Description</span>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} disabled={!canEdit} rows={3} maxLength={2000} />
              </label>

              <div className="form-row">
                <label>
                  <span>Start date</span>
                  <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} disabled={!canEdit} />
                </label>
                <label>
                  <span>End date</span>
                  <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} disabled={!canEdit} />
                </label>
              </div>

              <div className="form-row">
                <label>
                  <span>Budget</span>
                  <input type="number" min="0" step="0.01" value={form.budgetAmount} onChange={(e) => setForm({ ...form, budgetAmount: e.target.value })} disabled={!canEdit} />
                </label>
                <label>
                  <span>Currency</span>
                  <input type="text" maxLength={8} value={form.budgetCurrency} onChange={(e) => setForm({ ...form, budgetCurrency: e.target.value.toUpperCase() })} disabled={!canEdit} />
                </label>
                <label>
                  <span>Type</span>
                  <select value={form.budgetType} onChange={(e) => setForm({ ...form, budgetType: e.target.value })} disabled={!canEdit}>
                    <option value="hourly">Hourly</option>
                    <option value="fixed">Fixed</option>
                  </select>
                </label>
              </div>

              {canEdit ? (
                <div className="settings-actions">
                  <button type="submit" className="btn-primary" disabled={saving}>
                    {saving ? <Loader size={16} className="spin" /> : <Save size={16} />}
                    <span>{saving ? 'Saving…' : 'Save changes'}</span>
                  </button>
                </div>
              ) : null}
            </form>

            <div className="members-section">
              <h3>Members ({members.length})</h3>

              {isOwner ? (
                <form className="member-add-form" onSubmit={handleAddMember}>
                  <input type="email" placeholder="Member email" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} />
                  <select value={memberRole} onChange={(e) => setMemberRole(e.target.value)}>
                    {MEMBER_ROLE_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                  </select>
                  <button type="submit" className="btn-primary" disabled={memberSaving}>
                    {memberSaving ? <Loader size={16} className="spin" /> : <UserPlus size={16} />}
                    <span>Add</span>
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
                        <button className="icon-btn danger" title="Remove member" onClick={() => handleRemoveMember(m.user.id)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ) : (
                      <span className={`project-role role-${m.role}`}>{m.role}</span>
                    )}
                  </div>
                ))}
                {members.length === 0 ? (<div className="member-empty">No members yet besides the project owner.</div>) : null}
              </div>
            </div>

            {isOwner && !project.isPersonal ? (
              <div className="danger-zone">
                <h3>Danger zone</h3>
                <p>Deleting the project moves it to trash (hidden from the list).</p>
                <button className="btn-danger" onClick={handleDelete}>
                  <Trash2 size={16} />
                  <span>Delete project</span>
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {showTaskModal ? (
        <div className="modal-backdrop" onClick={handleCloseTaskModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingTaskId ? 'Edit task' : 'New task'}</h3>
              <button className="icon-btn" onClick={handleCloseTaskModal} title="Close">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveTask} className="modal-form">
              <label>
                <span>Title</span>
                <input type="text" value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} placeholder="e.g. Write landing page copy" maxLength={120} autoFocus />
              </label>
              <label>
                <span>Content *</span>
                <textarea rows={4} value={taskForm.content} onChange={(e) => setTaskForm({ ...taskForm, content: e.target.value })} maxLength={5000} placeholder="Task details…" />
              </label>
              <div className="form-row">
                <label>
                  <span>Deadline</span>
                  <input type="date" value={taskForm.deadline} onChange={(e) => setTaskForm({ ...taskForm, deadline: e.target.value })} />
                </label>
                <label>
                  <span>Priority</span>
                  <input type="number" min="0" max="1024" value={taskForm.priority} onChange={(e) => setTaskForm({ ...taskForm, priority: parseInt(e.target.value || '0', 10) })} />
                </label>
                <label>
                  <span>Category</span>
                  <select value={taskForm.category} onChange={(e) => setTaskForm({ ...taskForm, category: e.target.value })}>
                    {TASK_CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
                  </select>
                </label>
              </div>
              <label>
                <span>Progress: {Math.max(0, Math.min(100, Number(taskForm.progress) || 0))}%</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={taskForm.progress}
                  onChange={(e) => setTaskForm({ ...taskForm, progress: Number(e.target.value) })}
                  disabled={taskForm.cancelled}
                />
              </label>
              <label className="modal-checkbox">
                <input
                  type="checkbox"
                  checked={taskForm.cancelled}
                  onChange={(e) => setTaskForm({ ...taskForm, cancelled: e.target.checked })}
                />
                <span>Mark as cancelled</span>
              </label>
              <div className="settings-actions">
                <button type="button" className="btn-secondary" onClick={handleCloseTaskModal} disabled={taskSaving}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={taskSaving}>
                  {taskSaving ? <Loader size={16} className="spin" /> : editingTaskId ? <Save size={16} /> : <Plus size={16} />}
                  <span>{taskSaving ? 'Saving…' : editingTaskId ? 'Save' : 'Create task'}</span>
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
