import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  Plus,
  Search,
  Loader,
  Moon,
  Sun,
  Archive,
  Trash2,
  FolderKanban,
  Users,
  X,
} from 'lucide-react';
import {
  getProjects,
  createProject,
  archiveProject,
  deleteProject,
} from '../services/projectService';
import './Projects.css';

const SCOPE_OPTIONS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'mine', label: 'Của tôi' },
  { value: 'shared', label: 'Được chia sẻ' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Đang hoạt động' },
  { value: 'archived', label: 'Đã lưu trữ' },
];

const BUDGET_TYPES = [
  { value: 'hourly', label: 'Theo giờ' },
  { value: 'fixed', label: 'Cố định' },
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
  const [theme, setTheme] = useState('light');

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
      toast.error(err.message || 'Không thể tải danh sách dự án');
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
      toast.error('Tên dự án không được để trống');
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
      toast.success('Đã tạo dự án');
      setShowModal(false);
      fetchProjects();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi tạo dự án');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (project) => {
    try {
      await archiveProject(project.id);
      toast.success(project.status === 'archived' ? 'Đã khôi phục dự án' : 'Đã lưu trữ dự án');
      fetchProjects();
    } catch (err) {
      toast.error(err.message || 'Lỗi');
    }
  };

  const handleDelete = async (project) => {
    if (!window.confirm(`Xóa dự án "${project.name}"? Hành động này không thể hoàn tác.`)) return;
    try {
      await deleteProject(project.id);
      toast.success('Đã xóa dự án');
      fetchProjects();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi xóa dự án');
    }
  };

  const toggleTheme = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'));

  return (
    <div className={`projects-container ${theme === 'dark' ? 'dark-theme' : ''}`}>
      <div className="projects-action-bar">
        <div className="header-top-row">
          <h2>
            <FolderKanban size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />
            Dự án
          </h2>
          <div className="user-greeting">
            Chào, <strong style={{ marginLeft: 4 }}>{user?.username || 'Bạn'}</strong>
          </div>
        </div>

        <div className="header-bottom-row">
          <div className="search-box">
            <Search size={18} />
            <input
              type="text"
              placeholder="Tìm kiếm dự án..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchProjects()}
            />
          </div>

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
            <button className="btn-secondary" onClick={toggleTheme} title="Đổi giao diện">
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button className="btn-primary" onClick={handleOpenCreate}>
              <Plus size={18} />
              <span>Dự án mới</span>
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="projects-loading">
          <Loader className="spin" size={28} />
          <span>Đang tải dự án...</span>
        </div>
      ) : projects.length === 0 ? (
        <div className="projects-empty">
          <FolderKanban size={40} />
          <p>Chưa có dự án nào. Nhấn "Dự án mới" để tạo dự án đầu tiên.</p>
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
                <span title="Thành viên">
                  <Users size={14} /> {p.memberCount}
                </span>
                {p.budget?.amount > 0 ? (
                  <span title="Ngân sách">
                    {p.budget.currency} {Number(p.budget.amount).toLocaleString()}
                  </span>
                ) : null}
                {p.isPersonal ? <span className="badge-personal">Cá nhân</span> : null}
                {p.status === 'archived' ? <span className="badge-archived">Đã lưu trữ</span> : null}
              </div>

              {p.role === 'owner' && !p.isPersonal ? (
                <div className="project-card-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="icon-btn"
                    title={p.status === 'archived' ? 'Khôi phục' : 'Lưu trữ'}
                    onClick={() => handleArchive(p)}
                  >
                    <Archive size={16} />
                  </button>
                  <button
                    className="icon-btn danger"
                    title="Xóa dự án"
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
              <h3>Tạo dự án mới</h3>
              <button className="icon-btn" onClick={handleCloseModal} title="Đóng">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="modal-form">
              <label>
                <span>Tên dự án *</span>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ví dụ: Redesign Landing Page"
                  maxLength={120}
                  autoFocus
                />
              </label>

              <label>
                <span>Mô tả</span>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Mục tiêu, phạm vi, ghi chú..."
                  rows={3}
                  maxLength={2000}
                />
              </label>

              <div className="form-row">
                <label>
                  <span>Ngày bắt đầu</span>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  />
                </label>
                <label>
                  <span>Ngày kết thúc</span>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  />
                </label>
              </div>

              <div className="form-row">
                <label>
                  <span>Ngân sách</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.budgetAmount}
                    onChange={(e) => setForm({ ...form, budgetAmount: e.target.value })}
                  />
                </label>
                <label>
                  <span>Tiền tệ</span>
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
                  <span>Loại</span>
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
                  Hủy
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? <Loader size={16} className="spin" /> : <Plus size={16} />}
                  <span>{saving ? 'Đang tạo...' : 'Tạo dự án'}</span>
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
