import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getNotes,
  getTrashNotes,
  deleteNote,
  createNote,
  updateNote,
  restoreNote,
  deleteNotePermanent,
  getNoteShares,
  shareNote,
  updateNoteShare,
  removeNoteShare,
  getNoteComments,
  addNoteComment,
} from '../services/noteService';
import { getProjects, getProject } from '../services/projectService';
import { toast } from 'react-toastify';
import {
  Plus,
  Trash2,
  Edit3,
  X,
  LogOut,
  Loader,
  RefreshCcw,
  Archive,
  ChevronLeft,
  ChevronRight,
  Moon,
  Sun,
  Monitor,
  Clock,
  FileText,
  Search,
  Shield,
  UserCog,
  Share2,
  MessageSquare,
  FolderKanban,
} from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import TimeLogSection from '../components/TimeLogSection';
import './Home.css';

const NOTE_CATEGORIES = ['Study', 'Health', 'Finance', 'Work', 'Personal', 'Other'];
const SHARE_PERMISSIONS = [
  { value: 'read', label: 'View only' },
  { value: 'comment', label: 'Comment only' },
  { value: 'write', label: 'Can edit' },
];

const DUE_SOON_DAYS = 3;

function getProgressValue(note) {
  if (typeof note?.progress === 'number') return Math.max(0, Math.min(100, note.progress));
  if (note?.status === 'done') return 100;
  return 0;
}

function toDateInputValue(dateLike) {
  if (!dateLike) return '';
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function normalizeDay(dateLike) {
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

function isOverdue(deadlineLike, progress, status) {
  if (!deadlineLike) return false;
  if (status === 'cancelled') return false;
  if (progress >= 100) return false;
  const d = normalizeDay(deadlineLike);
  if (!d) return false;
  const today = normalizeDay(new Date());
  return d < today;
}

function isDueSoon(deadlineLike, progress, status, days = DUE_SOON_DAYS) {
  if (!deadlineLike) return false;
  if (status === 'cancelled') return false;
  if (progress >= 100) return false;
  const d = normalizeDay(deadlineLike);
  if (!d) return false;
  const today = normalizeDay(new Date());
  if (d < today) return false;
  const diffDays = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays <= days;
}

function accessOf(note) {
  return note?.access || 'owner';
}

function canEdit(note) {
  const a = accessOf(note);
  return a === 'owner' || a === 'write';
}

function canManageShares(note) {
  return accessOf(note) === 'owner';
}

function canComment(note) {
  const a = accessOf(note);
  return a === 'owner' || a === 'write' || a === 'comment';
}

const Home = () => {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const { pref: themePref, resolved: theme, cycle: cycleTheme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('active');

  // Filter
  const [scopeFilter, setScopeFilter] = useState('all'); // all | mine | shared
  const [dueFilter, setDueFilter] = useState('all'); // all | overdue | dueSoon | noDeadline | done

  // Projects
  const [projects, setProjects] = useState([]);
  const [projectFilter, setProjectFilter] = useState('all'); // 'all' | projectId

  const [currentPage, setCurrentPage] = useState(1);
  const notesPerPage = 6;

  // Note edit
  const [showModal, setShowModal] = useState(false);
  const [newNote, setNewNote] = useState({
    title: '',
    content: '',
    status: 'not_done',
    progress: 0,
    category: 'Other',
    deadline: '',
    priority: 1,
    project: '',
    assignee: '',
    estimatedHours: 0,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [currentNoteId, setCurrentNoteId] = useState(null);
  const [assigneeOptions, setAssigneeOptions] = useState([]);

  // Share
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareTargetNote, setShareTargetNote] = useState(null);
  const [shares, setShares] = useState([]);
  const [shareEmail, setShareEmail] = useState('');
  const [sharePermission, setSharePermission] = useState('read');
  const [shareLoading, setShareLoading] = useState(false);

  // Comments
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [commentsTargetNote, setCommentsTargetNote] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [commentsLoading, setCommentsLoading] = useState(false);

  const [user, setUser] = useState(() => {
    try {
      const userStr = localStorage.getItem('user');
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const handler = () => {
      try {
        const userStr = localStorage.getItem('user');
        setUser(userStr ? JSON.parse(userStr) : null);
      } catch {
        setUser(null);
      }
    };
    window.addEventListener('authChange', handler);
    return () => window.removeEventListener('authChange', handler);
  }, []);

  const navigate = useNavigate();

  const performLogout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.dispatchEvent(new Event('authChange'));
    navigate('/login');
  }, [navigate]);

  const handleLogout = () => {
    performLogout();
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    setCurrentPage(1);
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let response;
      if (viewMode === 'active') {
        const extra = {};
        if (projectFilter && projectFilter !== 'all') extra.projectId = projectFilter;
        response = await getNotes(searchQuery, 'all', extra);
      } else {
        response = await getTrashNotes();
      }

      let notesData = [];
      if (Array.isArray(response)) notesData = response;
      else if (response?.notes && Array.isArray(response.notes)) notesData = response.notes;
      else if (response?.data && Array.isArray(response.data)) notesData = response.data;

      if (viewMode === 'trash' && searchQuery) {
        const lowerQ = searchQuery.toLowerCase();
        notesData = notesData.filter((n) =>
          (n.title && n.title.toLowerCase().includes(lowerQ)) ||
          (n.content && n.content.toLowerCase().includes(lowerQ)) ||
          (n.category && String(n.category).toLowerCase().includes(lowerQ))
        );
      }

      notesData.sort((a, b) => {
        const pa = typeof a.priority === 'number' ? a.priority : 0;
        const pb = typeof b.priority === 'number' ? b.priority : 0;
        if (pb !== pa) return pb - pa;
        const ta = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const tb = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return tb - ta;
      });

      setNotes(notesData);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Fetch error:', err);
      if (err.response && (err.response.status === 401 || err.response.status === 403)) {
        toast.error('Your session has expired.');
        performLogout();
      } else {
        toast.error('Failed to load data.');
      }
    } finally {
      setLoading(false);
    }
  }, [viewMode, searchQuery, projectFilter, performLogout]);

  // Load projects once for filter + modal dropdown
  useEffect(() => {
    (async () => {
      try {
        const data = await getProjects({ scope: 'all', status: 'active' });
        setProjects(Array.isArray(data?.projects) ? data.projects : []);
      } catch {
        // non-fatal: Home still works without project options
      }
    })();
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchData();
    }, 400);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, fetchData]);

  useEffect(() => {
    setCurrentPage(1);
  }, [scopeFilter, dueFilter, projectFilter]);

  useEffect(() => {
    if (!showModal) return;
    const pid = newNote.project;
    if (!pid) {
      setAssigneeOptions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await getProject(pid);
        const p = data?.project;
        if (cancelled || !p) return;
        const out = [];
        if (p.owner?.id) {
          out.push({ id: p.owner.id, label: p.owner.username || p.owner.email || 'Owner', role: 'owner' });
        }
        for (const m of p.members || []) {
          const u = m.user;
          if (!u?.id) continue;
          if (p.owner?.id && u.id === p.owner.id) continue;
          out.push({ id: u.id, label: u.username || u.email || 'Member', role: m.role });
        }
        setAssigneeOptions(out);
      } catch {
        if (!cancelled) setAssigneeOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showModal, newNote.project]);

  const handleOpenAddModal = () => {
    setNewNote({
      title: '',
      content: '',
      status: 'not_done',
      progress: 0,
      category: 'Other',
      deadline: '',
      priority: 1,
      project: projectFilter && projectFilter !== 'all' ? projectFilter : '',
      assignee: '',
      estimatedHours: 0,
    });
    setIsEditing(false);
    setCurrentNoteId(null);
    setShowModal(true);
  };

  const handleEditClick = (note) => {
    if (!canEdit(note)) {
      toast.info('You only have view/comment access to this task.');
      return;
    }

    const progress = getProgressValue(note);

    setNewNote({
      title: note.title || '',
      content: note.content || '',
      status: note.status === 'cancelled' ? 'cancelled' : 'not_done',
      progress,
      category: note.category || 'Other',
      deadline: toDateInputValue(note.deadline),
      priority: typeof note.priority === 'number' ? note.priority : 1,
      project: note.project?.id || note.project || '',
      assignee: note.assignee?.id || note.assignee?._id || note.assignee || '',
      estimatedHours: typeof note.estimatedHours === 'number' ? note.estimatedHours : 0,
    });

    setCurrentNoteId(note._id || note.id);
    setIsEditing(true);
    setShowModal(true);
  };

  const handleSaveNote = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...newNote,
        progress: Math.max(0, Math.min(100, Number(newNote.progress) || 0)),
        project: newNote.project || null,
        assignee: newNote.assignee || null,
        estimatedHours: Math.max(0, Number(newNote.estimatedHours) || 0),
      };

      if (isEditing) {
        await updateNote(currentNoteId, payload);
        toast.success('Task updated!');
      } else {
        await createNote(payload);
        toast.success('Task created!');
      }
      setShowModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to save.');
    }
  };

  const handleDeleteAction = async (id, note) => {
    if (viewMode === 'active') {
      if (note && accessOf(note) !== 'owner') {
        toast.info('You cannot move a shared task to the trash.');
        return;
      }

      if (window.confirm('Move this task to trash?')) {
        try {
          await deleteNote(id);
          toast.success('Moved to trash!');
          fetchData();
        } catch (err) {
          toast.error(err.message || 'Failed to delete.');
        }
      }
    } else {
      if (window.confirm('WARNING: This action cannot be undone. Delete permanently?')) {
        try {
          await deleteNotePermanent(id);
          toast.success('Permanently deleted!');
          fetchData();
        } catch (err) {
          toast.error(err.message || 'Failed to permanently delete.');
        }
      }
    }
  };

  const handleRestore = async (id) => {
    try {
      await restoreNote(id);
      toast.success('Task restored!');
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to restore.');
    }
  };

  const getStatusBadge = (note) => {
    const progress = getProgressValue(note);

    if (note?.status === 'cancelled') {
      return <span className="status-badge cancelled">Cancelled</span>;
    }

    if (progress >= 100) {
      return <span className="status-badge done">Done</span>;
    }

    if (progress <= 0) {
      return <span className="status-badge not-started">Not started</span>;
    }

    return <span className="status-badge in-progress">In progress {progress}%</span>;
  };

  const filteredNotes = useMemo(() => {
    if (viewMode !== 'active') return notes;

    return notes.filter((note) => {
      const access = accessOf(note);
      if (scopeFilter === 'mine' && access !== 'owner') return false;
      if (scopeFilter === 'shared' && access === 'owner') return false;

      const progress = getProgressValue(note);
      const overdue = isOverdue(note.deadline, progress, note.status);
      const dueSoon = isDueSoon(note.deadline, progress, note.status);

      if (dueFilter === 'overdue' && !overdue) return false;
      if (dueFilter === 'dueSoon' && (overdue || !dueSoon)) return false;
      if (dueFilter === 'noDeadline' && !!note.deadline) return false;
      if (dueFilter === 'done' && progress < 100 && note.status !== 'done') return false;

      return true;
    });
  }, [notes, viewMode, scopeFilter, dueFilter]);

  const totalPages = Math.ceil(filteredNotes.length / notesPerPage) || 1;
  const indexOfLastNote = currentPage * notesPerPage;
  const indexOfFirstNote = indexOfLastNote - notesPerPage;
  const currentNotes = filteredNotes.slice(indexOfFirstNote, indexOfLastNote);

  // Share
  const openShareModal = async (note) => {
    if (!canManageShares(note)) {
      toast.info('Only the task owner can share.');
      return;
    }

    setShareTargetNote(note);
    setShareEmail('');
    setSharePermission('read');
    setShares([]);
    setShowShareModal(true);

    try {
      setShareLoading(true);
      const res = await getNoteShares(note._id || note.id);
      setShares(res?.shares || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load share list');
    } finally {
      setShareLoading(false);
    }
  };

  const refreshShares = async () => {
    if (!shareTargetNote) return;
    const res = await getNoteShares(shareTargetNote._id || shareTargetNote.id);
    setShares(res?.shares || []);
  };

  const handleAddShare = async () => {
    if (!shareTargetNote) return;
    if (!shareEmail.trim()) {
      toast.error('Enter an email to share with');
      return;
    }

    try {
      setShareLoading(true);
      await shareNote(shareTargetNote._id || shareTargetNote.id, {
        email: shareEmail.trim(),
        permission: sharePermission,
      });
      toast.success('Share updated');
      setShareEmail('');
      await refreshShares();
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to share');
    } finally {
      setShareLoading(false);
    }
  };

  const handleUpdateSharePermission = async (shareUserId, permission) => {
    if (!shareTargetNote) return;
    try {
      setShareLoading(true);
      await updateNoteShare(shareTargetNote._id || shareTargetNote.id, shareUserId, permission);
      await refreshShares();
      toast.success('Permission updated');
    } catch (err) {
      toast.error(err.message || 'Failed to update permission');
    } finally {
      setShareLoading(false);
    }
  };

  const handleRemoveShare = async (shareUserId) => {
    if (!shareTargetNote) return;
    if (!window.confirm('Remove this user\'s share?')) return;

    try {
      setShareLoading(true);
      await removeNoteShare(shareTargetNote._id || shareTargetNote.id, shareUserId);
      await refreshShares();
      toast.success('Share removed');
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to remove share');
    } finally {
      setShareLoading(false);
    }
  };

  // Comments
  const openCommentsModal = async (note) => {
    setCommentsTargetNote(note);
    setCommentText('');
    setComments([]);
    setShowCommentsModal(true);

    try {
      setCommentsLoading(true);
      const res = await getNoteComments(note._id || note.id);
      setComments(res?.comments || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load comments');
    } finally {
      setCommentsLoading(false);
    }
  };

  const refreshComments = async () => {
    if (!commentsTargetNote) return;
    const res = await getNoteComments(commentsTargetNote._id || commentsTargetNote.id);
    setComments(res?.comments || []);
  };

  const handleSendComment = async () => {
    if (!commentsTargetNote) return;
    if (!canComment(commentsTargetNote)) {
      toast.info('You do not have permission to comment on this task.');
      return;
    }
    if (!commentText.trim()) return;

    try {
      setCommentsLoading(true);
      await addNoteComment(commentsTargetNote._id || commentsTargetNote.id, commentText.trim());
      setCommentText('');
      await refreshComments();
      toast.success('Comment posted');
    } catch (err) {
      toast.error(err.message || 'Failed to post comment');
    } finally {
      setCommentsLoading(false);
    }
  };

  return (
    <div className={`home-container ${theme}-theme`}>
      <div className="home-action-bar">
        <div className="header-top-row">
          <h2>{viewMode === 'active' ? 'My Tasks' : 'Trash'}</h2>
          {user && (
            <span className="user-greeting">
              <span>Hi, <strong>{user?.username || 'there'}</strong></span>
            </span>
          )}
        </div>

        <div className="header-bottom-row">
          <div className="search-box">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search (title / content / category)…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <button
            className="btn-admin nav-btn"
            onClick={() => navigate('/projects')}
            title="Projects"
            style={{ backgroundColor: '#eef2ff', color: '#4f46e5' }}
          >
            <FolderKanban size={20} /> Projects
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

          <div className="action-buttons">
            {user?.role === 'admin' && (
              <button className="btn-admin" onClick={() => navigate('/admin')} title="Admin">
                <Shield size={20} /> Admin
              </button>
            )}
            {(user?.role === 'admin' || user?.role === 'moderator') && (
              <button className="btn-staff" onClick={() => navigate('/staff')} title="Staff Notes">
                <UserCog size={20} /> Staff
              </button>
            )}
            <button
              className="btn-theme-toggle"
              onClick={cycleTheme}
              title={`Theme: ${themePref}`}
            >
              {themePref === 'light' ? (
                <Sun size={20} />
              ) : themePref === 'dark' ? (
                <Moon size={20} />
              ) : (
                <Monitor size={20} />
              )}
            </button>

            {viewMode === 'active' ? (
              <>
                <button className="btn-add" onClick={handleOpenAddModal}>
                  <Plus size={20} /> <span>New</span>
                </button>
                <button className="btn-trash-view" onClick={() => setViewMode('trash')}>
                  <Trash2 size={20} /> Trash
                </button>
              </>
            ) : (
              <button className="btn-back" onClick={() => setViewMode('active')}>
                <Archive size={20} /> Back
              </button>
            )}
            <button className="btn-logout" onClick={handleLogout} title="Sign out">
              <LogOut size={20} />
            </button>
          </div>
        </div>

        {viewMode === 'active' && (
          <div className="filters-wrap">
            <div className="filter-row">
              <span className="filter-label">Scope:</span>
              <button
                className={`filter-chip ${scopeFilter === 'all' ? 'active' : ''}`}
                onClick={() => setScopeFilter('all')}
              >
                All
              </button>
              <button
                className={`filter-chip ${scopeFilter === 'mine' ? 'active' : ''}`}
                onClick={() => setScopeFilter('mine')}
              >
                Mine
              </button>
              <button
                className={`filter-chip ${scopeFilter === 'shared' ? 'active' : ''}`}
                onClick={() => setScopeFilter('shared')}
              >
                Shared
              </button>
            </div>

            <div className="filter-row">
              <span className="filter-label">Project:</span>
              <select
                className="filter-chip"
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: 999 }}
              >
                <option value="all">All projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.isPersonal ? ' (Personal)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-row">
              <span className="filter-label">Deadline:</span>
              <button
                className={`filter-chip ${dueFilter === 'all' ? 'active' : ''}`}
                onClick={() => setDueFilter('all')}
              >
                All
              </button>
              <button
                className={`filter-chip ${dueFilter === 'overdue' ? 'active' : ''}`}
                onClick={() => setDueFilter('overdue')}
              >
                Overdue
              </button>
              <button
                className={`filter-chip ${dueFilter === 'dueSoon' ? 'active' : ''}`}
                onClick={() => setDueFilter('dueSoon')}
              >
                Due soon
              </button>
              <button
                className={`filter-chip ${dueFilter === 'noDeadline' ? 'active' : ''}`}
                onClick={() => setDueFilter('noDeadline')}
              >
                No deadline
              </button>
              <button
                className={`filter-chip ${dueFilter === 'done' ? 'active' : ''}`}
                onClick={() => setDueFilter('done')}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="loading-state">
          <Loader className="animate-spin" />
        </div>
      ) : (
        <div className="notes-grid">
          {currentNotes.length > 0 ? (
            currentNotes.map((note) => {
              const progress = getProgressValue(note);
              const overdue = isOverdue(note.deadline, progress, note.status);
              const dueSoon = isDueSoon(note.deadline, progress, note.status);
              const access = accessOf(note);
              const shared = access !== 'owner';

              return (
                <div
                  key={note._id || note.id}
                  className={`note-card ${overdue ? 'is-overdue' : ''} ${!overdue && dueSoon ? 'is-due-soon' : ''}`}
                >
                  <div className="note-header-row">
                    <div className="note-header-left">
                      {getStatusBadge(note)}
                      {shared && (
                        <span className="shared-badge" title="Shared task">
                          Shared
                        </span>
                      )}
                      {overdue && <span className="due-badge overdue">Overdue</span>}
                      {!overdue && dueSoon && <span className="due-badge soon">Due soon</span>}
                    </div>

                    <div className="note-header-right">
                      {note.project?.name ? (
                        <span
                          className="category-badge"
                          title={`Project: ${note.project.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (note.project?.id) navigate(`/projects/${note.project.id}`);
                          }}
                          style={{ cursor: 'pointer', backgroundColor: '#eef2ff', color: '#4f46e5' }}
                        >
                          <FolderKanban size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                          {note.project.name}
                        </span>
                      ) : null}
                      <span className="category-badge">{note.category || 'Other'}</span>
                      <span className="priority-badge">{note.priority || 0}</span>
                    </div>
                  </div>

                  <div className="note-body">
                    <h3>{note.title}</h3>
                    <p>{note.content}</p>

                    <div className="progress-wrap" aria-label="progress">
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${progress}%` }} />
                      </div>
                      <div className="progress-text">{progress}%</div>
                    </div>

                    <div className={`deadline ${overdue ? 'overdue' : ''} ${!overdue && dueSoon ? 'soon' : ''}`}>
                      Due:{' '}
                      {note.deadline
                        ? new Date(note.deadline).toLocaleDateString('vi-VN')
                        : '—'}
                    </div>

                    {(note.assignee?.username || note.estimatedHours > 0) && (
                      <div className="note-extras">
                        {note.assignee?.username ? (
                          <span className="assignee-pill" title={note.assignee.email || ''}>
                            @{note.assignee.username}
                          </span>
                        ) : null}
                        {note.estimatedHours > 0 ? (
                          <span className="estimate-pill">~{note.estimatedHours}h</span>
                        ) : null}
                      </div>
                    )}

                    {shared && (
                      <div className="shared-from">
                        Shared from: <strong>{note.owner?.username || note.owner?.email || '—'}</strong>
                      </div>
                    )}
                  </div>

                  <div className="note-footer">
                    <span className="note-date">
                      {note.createdAt ? new Date(note.createdAt).toLocaleDateString('vi-VN') : '—'}
                    </span>

                    <div className="note-actions">
                      {viewMode === 'active' ? (
                        <>
                          <button
                            className="action-btn comment"
                            onClick={() => openCommentsModal(note)}
                            title={canComment(note) ? 'Comment' : 'View comments'}
                          >
                            <MessageSquare size={18} />
                          </button>

                          {canManageShares(note) && (
                            <button
                              className="action-btn share"
                              onClick={() => openShareModal(note)}
                              title="Share"
                            >
                              <Share2 size={18} />
                            </button>
                          )}

                          {canEdit(note) && (
                            <button className="action-btn edit" onClick={() => handleEditClick(note)} title="Edit">
                              <Edit3 size={18} />
                            </button>
                          )}

                          {access === 'owner' && (
                            <button
                              className="action-btn delete"
                              onClick={() => handleDeleteAction(note._id || note.id, note)}
                              title="Move to trash"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          <button
                            className="action-btn restore"
                            onClick={() => handleRestore(note._id || note.id)}
                            title="Restore"
                          >
                            <RefreshCcw size={18} />
                          </button>
                          <button
                            className="action-btn delete-forever"
                            onClick={() => handleDeleteAction(note._id || note.id)}
                            title="Delete permanently"
                          >
                            <Trash2 size={18} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="empty-state">
              <p>{viewMode === 'active' ? 'No tasks yet.' : 'Trash is empty.'}</p>
            </div>
          )}
        </div>
      )}

      {filteredNotes.length > notesPerPage && (
        <div className="pagination">
          <button
            className="page-btn"
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft size={20} />
          </button>

          <span className="page-info">
            Page {currentPage} / {totalPages}
          </span>

          <button
            className="page-btn"
            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}

      {/* Note editor modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{isEditing ? 'Edit Task' : 'New Task'}</h3>
              <button className="btn-close" onClick={() => setShowModal(false)}>
                <X size={24} />
              </button>
            </div>

            <div className="form-group">
              <label>Title</label>
                <input
                  type="text"
                  className="custom-input title-input"
                  placeholder="Title…"
                  value={newNote.title}
                  onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
                  required
                />
              </div>

            <form onSubmit={handleSaveNote}>
              <div className="form-row">
                <div className="form-group half">
                  <label>Category</label>
                  <select
                    className="custom-select"
                    value={newNote.category}
                    onChange={(e) => setNewNote({ ...newNote, category: e.target.value })}
                  >
                    {NOTE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group half">
                  <label>Priority</label>
                  <input
                    type="number"
                    className="custom-input"
                    min={0}
                    max={1024}
                    value={newNote.priority}
                    onChange={(e) => setNewNote({ ...newNote, priority: parseInt(e.target.value || '0', 10) })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group half">
                  <label>Progress: {newNote.progress}%</label>
                  <div className="progress-edit">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={newNote.progress}
                      disabled={newNote.status === 'cancelled'}
                      onChange={(e) => setNewNote({ ...newNote, progress: parseInt(e.target.value || '0', 10) })}
                    />
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={newNote.progress}
                      disabled={newNote.status === 'cancelled'}
                      onChange={(e) => setNewNote({ ...newNote, progress: parseInt(e.target.value || '0', 10) })}
                    />
                  </div>
                </div>

                <div className="form-group half">
                  <label>Status</label>
                  <select
                    className="custom-select"
                    value={newNote.status === 'cancelled' ? 'cancelled' : 'active'}
                    onChange={(e) =>
                      setNewNote({
                        ...newNote,
                        status: e.target.value === 'cancelled' ? 'cancelled' : 'not_done',
                      })
                    }
                  >
                    <option value="active">In progress</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Project</label>
                <select
                  className="custom-select"
                  value={newNote.project || ''}
                  onChange={(e) => setNewNote({ ...newNote, project: e.target.value, assignee: '' })}
                >
                  <option value="">— No project,</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}{p.isPersonal ? ' (Personal)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group half">
                  <label>Assignee</label>
                  <select
                    className="custom-select"
                    value={newNote.assignee}
                    onChange={(e) => setNewNote({ ...newNote, assignee: e.target.value })}
                    disabled={!newNote.project}
                  >
                    <option value="">
                      {newNote.project ? '— Unassigned,' : 'Pick a project first'}
                    </option>
                    {assigneeOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}{o.role === 'owner' ? ' (owner)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group half">
                  <label>Estimated hours</label>
                  <input
                    type="number"
                    className="custom-input"
                    min={0}
                    max={10000}
                    step={0.25}
                    value={newNote.estimatedHours}
                    onChange={(e) => setNewNote({ ...newNote, estimatedHours: Number(e.target.value || 0) })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Deadline</label>
                <input
                  type="date"
                  className="custom-input"
                  value={newNote.deadline}
                  onChange={(e) => setNewNote({ ...newNote, deadline: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Content</label>
                <textarea
                  className="custom-input"
                  placeholder="Content…"
                  rows="6"
                  value={newNote.content}
                  onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
                  required
                ></textarea>
              </div>

              {isEditing && currentNoteId ? (
                <TimeLogSection
                  taskId={currentNoteId}
                  canWrite={true}
                  currentUserId={user?.id}
                  onChange={fetchData}
                />
              ) : null}

              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-save">
                  {isEditing ? 'Save' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Share modal */}
      {showShareModal && (
        <div className="modal-overlay">
          <div className="modal-content modal-wide">
            <div className="modal-header">
              <h3>Share Task</h3>
              <button className="btn-close" onClick={() => setShowShareModal(false)}>
                <X size={24} />
              </button>
            </div>

            <div className="modal-subtitle">
              <div className="modal-subtitle-title">{shareTargetNote?.title || '—'}</div>
              <div className="modal-subtitle-hint">Share by email (read / comment / write)</div>
            </div>

            <div className="share-form">
              <input
                className="custom-input"
                type="email"
                placeholder="email@example.com"
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
              />
              <select
                className="custom-select"
                value={sharePermission}
                onChange={(e) => setSharePermission(e.target.value)}
              >
                {SHARE_PERMISSIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
              <button className="btn-save" type="button" onClick={handleAddShare} disabled={shareLoading}>
                Add
              </button>
            </div>

            <div className="share-list">
              {shareLoading ? (
                <div className="inline-loading">
                  <Loader className="animate-spin" />
                </div>
              ) : shares.length === 0 ? (
                <div className="muted">Not shared with anyone yet.</div>
              ) : (
                shares.map((s) => (
                  <div key={s.user?.id} className="share-item">
                    <div className="share-user">
                      <div className="share-name">{s.user?.username || s.user?.email || s.user?.id}</div>
                      <div className="share-email">{s.user?.email || ''}</div>
                    </div>

                    <div className="share-actions">
                      <select
                        className="custom-select"
                        value={s.permission}
                        onChange={(e) => handleUpdateSharePermission(s.user?.id, e.target.value)}
                        disabled={shareLoading}
                      >
                        {SHARE_PERMISSIONS.map((p) => (
                          <option key={p.value} value={p.value}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn-danger"
                        onClick={() => handleRemoveShare(s.user?.id)}
                        disabled={shareLoading}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Comments modal */}
      {showCommentsModal && (
        <div className="modal-overlay">
          <div className="modal-content modal-wide">
            <div className="modal-header">
              <h3>Comments</h3>
              <button className="btn-close" onClick={() => setShowCommentsModal(false)}>
                <X size={24} />
              </button>
            </div>

            <div className="modal-subtitle">
              <div className="modal-subtitle-title">{commentsTargetNote?.title || '—'}</div>
              <div className="modal-subtitle-hint">
                {canComment(commentsTargetNote) ? 'You can post comments.' : 'You can only view comments.'}
              </div>
            </div>

            <div className="comment-list">
              {commentsLoading ? (
                <div className="inline-loading">
                  <Loader className="animate-spin" />
                </div>
              ) : comments.length === 0 ? (
                <div className="muted">No comments yet.</div>
              ) : (
                comments.map((c, idx) => (
                  <div key={c._id || idx} className="comment-item">
                    <div className="comment-meta">
                      <span className="comment-author">{c.user?.username || c.user?.email || 'Unknown'}</span>
                      <span className="comment-date">
                        {c.createdAt ? new Date(c.createdAt).toLocaleString('vi-VN') : ''}
                      </span>
                    </div>
                    <div className="comment-text">{c.text}</div>
                  </div>
                ))
              )}
            </div>

            <div className="comment-box">
              <textarea
                className="custom-input"
                rows={3}
                placeholder={canComment(commentsTargetNote) ? 'Write a comment…' : 'You do not have permission to comment.'}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                disabled={!canComment(commentsTargetNote) || commentsLoading}
              />
              <button
                type="button"
                className="btn-save"
                onClick={handleSendComment}
                disabled={!canComment(commentsTargetNote) || commentsLoading || !commentText.trim()}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
