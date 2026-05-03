import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  Plus,
  Search,
  Loader,
  Moon,
  Sun,
  Monitor,
  Clock,
  FileText,
  Archive,
  Trash2,
  FolderKanban,
  Users,
  X,
  Home,
} from 'lucide-react';
import {
  getProjects,
  createProject,
  archiveProject,
  deleteProject,
} from '../services/projectService';
import { useTheme } from '../hooks/useTheme';
import './Projects.css';

const SCOPE_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'mine', label: 'Mine' },
  { value: 'shared', label: 'Shared' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
];

const BUDGET_TYPES = [
  { value: 'hourly', label: 'Hourly' },
  { value: 'fixed', label: 'Fixed' },
];

const INITIAL_FORM = {
  name: '',
  description: '',
  startDate: '',
  endDate: '',
  budgetAmount: 0,
  budgetCurrency: 'USD',
  budgetType: 'hourly',
};

const Projects = () => {
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const { pref: themePref, resolved: theme, cycle: cycleTheme } = useTheme();

  const [search, setSearch] = useState('');
  const [scope, setScope] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);

  const user = useMemo(() => {
    try {
      const s = localStorage.getItem('user');
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  }, []);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getProjects({ search, scope, status: statusFilter });
      setProjects(Array.isArray(data?.projects) ? data.projects : []);
    } catch (err) {
      toast.error(err.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, [search, scope, statusFilter]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    fetchProjects();
  }, [fetchProjects, navigate]);

  const handleOpenCreate = () => {
    setForm(INITIAL_FORM);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    if (saving) return;
    setShowModal(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Project name cannot be empty');
      return;
    }
    setSaving(true);
    try {
      await createProject({
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
      toast.success('Project created');
      setShowModal(false);
      fetchProjects();
    } catch (err) {
      toast.error(err.message || 'Failed to create project');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (project) => {
    try {
      await archiveProject(project.id);
      toast.success(project.status === 'archived' ? 'Project restored' : 'Project archived');
      fetchProjects();
    } catch (err) {
      toast.error(err.message || 'Error');
    }
  };

  const handleDelete = async (project) => {
    if (!window.confirm(`Delete project "${project.name}"? This action cannot be undone.`)) return;
    try {
      await deleteProject(project.id);
      toast.success('Project deleted');
      fetchProjects();
    } catch (err) {
      toast.error(err.message || 'Failed to delete project');
    }
  };

  const toggleTheme = cycleTheme;

  return (
    <div className={`projects-container ${theme === 'dark' ? 'dark-theme' : ''}`}>
      <div className="projects-action-bar">
        <div className="header-top-row">
          <h2>
            <FolderKanban size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />
            Projects
          </h2>
          <div className="user-greeting">
            Hi, <strong style={{ marginLeft: 4 }}>{user?.username || 'there'}</strong>
          </div>
        </div>

        <div className="header-bottom-row">
          <div className="search-box">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search projects…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchProjects()}
            />
          </div>

          <button
            className="btn-admin nav-btn"
            onClick={() => navigate('/')}
            title="My Tasks"
            style={{ backgroundColor: '#eef2ff', color: '#4f46e5' }}
          >
            <Home size={20} /> My Tasks
          </button>

          <button
            className="btn-admin nav-btn"
            onClick={() => navigate('/my-time')}
            title="My Time"
          >
            <Clock size={20} /> My Time
          </button>

          <button
            className="btn-admin nav-btn"
            onClick={() => navigate('/reports')}
            title="Reports"
          >
            <FileText size={20} /> Reports
          </button>

          <div className="filter-group">
            <select value={scope} onChange={(e) => setScope(e.target.value)}>
              {SCOPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>

            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="action-buttons">
            <button className="btn-secondary" onClick={toggleTheme} title={`Theme: ${themePref}`}>
              {themePref === 'light' ? (
                <Sun size={18} />
              ) : themePref === 'dark' ? (
                <Moon size={18} />
              ) : (
                <Monitor size={18} />
              )}
            </button>
            <button className="btn-primary" onClick={handleOpenCreate}>
              <Plus size={18} />
              <span>New project</span>
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="projects-loading">
          <Loader className="spin" size={28} />
          <span>Loading projects…</span>
        </div>
      ) : projects.length === 0 ? (
        <div className="projects-empty">
          <FolderKanban size={40} />
          <p>No projects yet. Click "New project" to create the first one.</p>
        </div>
      ) : (
        <div className="projects-grid">
          {projects.map((p) => (
            <div
              key={p.id}
              className={`project-card ${p.status === 'archived' ? 'archived' : ''}`}
              onClick={() => navigate(`/projects/${p.id}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigate(`/projects/${p.id}`);
                }
              }}
            >
              <div className="project-card-header">
                <h3 className="project-name" title={p.name}>
                  {p.name}
                </h3>
                <span className={`project-role role-${p.role}`}>{p.role}</span>
              </div>

              {p.description ? <p className="project-description">{p.description}</p> : null}

              <div className="project-meta">
                <span title="Members">
                  <Users size={14} /> {p.memberCount}
                </span>
                {p.budget?.amount > 0 ? (
                  <span title="Budget">
                    {p.budget.currency} {Number(p.budget.amount).toLocaleString()}
                  </span>
                ) : null}
                {p.isPersonal ? <span className="badge-personal">Personal</span> : null}
                {p.status === 'archived' ? <span className="badge-archived">Archived</span> : null}
              </div>

              {p.role === 'owner' && !p.isPersonal ? (
                <div className="project-card-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="icon-btn"
                    title={p.status === 'archived' ? 'Restore' : 'Archive'}
                    onClick={() => handleArchive(p)}
                  >
                    <Archive size={16} />
                  </button>
                  <button
                    className="icon-btn danger"
                    title="Delete project"
                    onClick={() => handleDelete(p)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {showModal ? (
        <div className="modal-backdrop" onClick={handleCloseModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>New project</h3>
              <button className="icon-btn" onClick={handleCloseModal} title="Close">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="modal-form">
              <label>
                <span>Project name *</span>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Redesign Landing Page"
                  maxLength={120}
                  autoFocus
                />
              </label>

              <label>
                <span>Description</span>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Goals, scope, notes…"
                  rows={3}
                  maxLength={2000}
                />
              </label>

              <div className="form-row">
                <label>
                  <span>Start date</span>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  />
                </label>
                <label>
                  <span>End date</span>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  />
                </label>
              </div>

              <div className="form-row">
                <label>
                  <span>Budget</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.budgetAmount}
                    onChange={(e) => setForm({ ...form, budgetAmount: e.target.value })}
                  />
                </label>
                <label>
                  <span>Currency</span>
                  <input
                    type="text"
                    maxLength={8}
                    value={form.budgetCurrency}
                    onChange={(e) =>
                      setForm({ ...form, budgetCurrency: e.target.value.toUpperCase() })
                    }
                  />
                </label>
                <label>
                  <span>Type</span>
                  <select
                    value={form.budgetType}
                    onChange={(e) => setForm({ ...form, budgetType: e.target.value })}
                  >
                    {BUDGET_TYPES.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleCloseModal}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? <Loader size={16} className="spin" /> : <Plus size={16} />}
                  <span>{saving ? 'Creating…' : 'Create project'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default Projects;
