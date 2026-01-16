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
  Search,
  Shield,
  UserCog,
  Share2,
  MessageSquare,
} from 'lucide-react';
import './Home.css';

const NOTE_CATEGORIES = ['Study', 'Health', 'Finance', 'Work', 'Personal', 'Other'];
const SHARE_PERMISSIONS = [
  { value: 'read', label: 'Chỉ xem' },
  { value: 'comment', label: 'Chỉ bình luận' },
  { value: 'write', label: 'Có thể sửa' },
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
  const [theme, setTheme] = useState('light');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('active');

  // Filter
  const [scopeFilter, setScopeFilter] = useState('all'); // all | mine | shared
  const [dueFilter, setDueFilter] = useState('all'); // all | overdue | dueSoon | noDeadline | done

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
  });
  const [isEditing, setIsEditing] = useState(false);
  const [currentNoteId, setCurrentNoteId] = useState(null);

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
        response = await getNotes(searchQuery);
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
      console.error('Lỗi fetch:', err);
      if (err.response && (err.response.status === 401 || err.response.status === 403)) {
        toast.error('Phiên đăng nhập hết hạn.');
        performLogout();
      } else {
        toast.error('Lỗi tải dữ liệu.');
      }
    } finally {
      setLoading(false);
    }
  }, [viewMode, searchQuery, performLogout]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchData();
    }, 400);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, fetchData]);

  useEffect(() => {
    setCurrentPage(1);
  }, [scopeFilter, dueFilter]);

  const handleOpenAddModal = () => {
    setNewNote({
      title: '',
      content: '',
      status: 'not_done',
      progress: 0,
      category: 'Other',
      deadline: '',
      priority: 1,
    });
    setIsEditing(false);
    setCurrentNoteId(null);
    setShowModal(true);
  };

  const handleEditClick = (note) => {
    if (!canEdit(note)) {
      toast.info('Bạn chỉ có quyền xem/bình luận task này.');
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
      };

      if (isEditing) {
        await updateNote(currentNoteId, payload);
        toast.success('Đã cập nhật!');
      } else {
        await createNote(payload);
        toast.success('Đã tạo mới!');
      }
      setShowModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Lưu thất bại.');
    }
  };

  const handleDeleteAction = async (id, note) => {
    if (viewMode === 'active') {
      if (note && accessOf(note) !== 'owner') {
        toast.info('Bạn không thể đưa task được chia sẻ vào thùng rác.');
        return;
      }

      if (window.confirm('Chuyển task này vào thùng rác?')) {
        try {
          await deleteNote(id);
          toast.success('Đã chuyển vào thùng rác!');
          fetchData();
        } catch (err) {
          toast.error(err.message || 'Lỗi xóa.');
        }
      }
    } else {
      if (window.confirm('CẢNH BÁO: Hành động này không thể hoàn tác. Xóa vĩnh viễn?')) {
        try {
          await deleteNotePermanent(id);
          toast.success('Đã xóa vĩnh viễn!');
          fetchData();
        } catch (err) {
          toast.error(err.message || 'Lỗi xóa vĩnh viễn.');
        }
      }
    }
  };

  const handleRestore = async (id) => {
    try {
      await restoreNote(id);
      toast.success('Đã khôi phục task!');
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Lỗi khôi phục.');
    }
  };

  const getStatusBadge = (note) => {
    const progress = getProgressValue(note);

    if (note?.status === 'cancelled') {
      return <span className="status-badge cancelled">Đã hủy</span>;
    }

    if (progress >= 100) {
      return <span className="status-badge done">Đã xong</span>;
    }

    if (progress <= 0) {
      return <span className="status-badge not-started">Chưa bắt đầu</span>;
    }

    return <span className="status-badge in-progress">Đang làm {progress}%</span>;
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
      toast.info('Chỉ chủ task mới có thể chia sẻ.');
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
      toast.error(err.message || 'Không thể tải danh sách chia sẻ');
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
      toast.error('Nhập email để chia sẻ');
      return;
    }

    try {
      setShareLoading(true);
      await shareNote(shareTargetNote._id || shareTargetNote.id, {
        email: shareEmail.trim(),
        permission: sharePermission,
      });
      toast.success('Đã cập nhật chia sẻ');
      setShareEmail('');
      await refreshShares();
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Chia sẻ thất bại');
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
      toast.success('Đã cập nhật quyền');
    } catch (err) {
      toast.error(err.message || 'Lỗi cập nhật quyền');
    } finally {
      setShareLoading(false);
    }
  };

  const handleRemoveShare = async (shareUserId) => {
    if (!shareTargetNote) return;
    if (!window.confirm('Xóa chia sẻ người dùng này?')) return;

    try {
      setShareLoading(true);
      await removeNoteShare(shareTargetNote._id || shareTargetNote.id, shareUserId);
      await refreshShares();
      toast.success('Đã xóa chia sẻ');
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Lỗi xóa chia sẻ');
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
      toast.error(err.message || 'Không thể tải bình luận');
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
      toast.info('Bạn không có quyền bình luận task này.');
      return;
    }
    if (!commentText.trim()) return;

    try {
      setCommentsLoading(true);
      await addNoteComment(commentsTargetNote._id || commentsTargetNote.id, commentText.trim());
      setCommentText('');
      await refreshComments();
      toast.success('Đã gửi bình luận');
    } catch (err) {
      toast.error(err.message || 'Gửi bình luận thất bại');
    } finally {
      setCommentsLoading(false);
    }
  };

  return (
    <div className={`home-container ${theme}-theme`}>
      <div className="home-action-bar">
        <div className="header-top-row">
          <h2>{viewMode === 'active' ? 'Goal Planner' : 'Thùng rác'}</h2>
          {user && (
            <span className="user-greeting">
              Xin chào, <strong>{user.username}</strong>
            </span>
          )}
        </div>

        <div className="header-bottom-row">
          <div className="search-box">
            <Search size={18} />
            <input
              type="text"
              placeholder="Tìm kiếm (title / content / category)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

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
              onClick={() => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))}
              title="Đổi giao diện"
            >
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>

            {viewMode === 'active' ? (
              <>
                <button className="btn-add" onClick={handleOpenAddModal}>
                  <Plus size={20} /> <span>Tạo mới</span>
                </button>
                <button className="btn-trash-view" onClick={() => setViewMode('trash')}>
                  <Trash2 size={20} /> Thùng rác
                </button>
              </>
            ) : (
              <button className="btn-back" onClick={() => setViewMode('active')}>
                <Archive size={20} /> Quay lại
              </button>
            )}
            <button className="btn-logout" onClick={handleLogout} title="Đăng xuất">
              <LogOut size={20} />
            </button>
          </div>
        </div>

        {viewMode === 'active' && (
          <div className="filters-wrap">
            <div className="filter-row">
              <span className="filter-label">Phạm vi:</span>
              <button
                className={`filter-chip ${scopeFilter === 'all' ? 'active' : ''}`}
                onClick={() => setScopeFilter('all')}
              >
                Tất cả
              </button>
              <button
                className={`filter-chip ${scopeFilter === 'mine' ? 'active' : ''}`}
                onClick={() => setScopeFilter('mine')}
              >
                Của tôi
              </button>
              <button
                className={`filter-chip ${scopeFilter === 'shared' ? 'active' : ''}`}
                onClick={() => setScopeFilter('shared')}
              >
                Được chia sẻ
              </button>
            </div>

            <div className="filter-row">
              <span className="filter-label">Deadline:</span>
              <button
                className={`filter-chip ${dueFilter === 'all' ? 'active' : ''}`}
                onClick={() => setDueFilter('all')}
              >
                Tất cả
              </button>
              <button
                className={`filter-chip ${dueFilter === 'overdue' ? 'active' : ''}`}
                onClick={() => setDueFilter('overdue')}
              >
                Quá hạn
              </button>
              <button
                className={`filter-chip ${dueFilter === 'dueSoon' ? 'active' : ''}`}
                onClick={() => setDueFilter('dueSoon')}
              >
                Sắp đến hạn
              </button>
              <button
                className={`filter-chip ${dueFilter === 'noDeadline' ? 'active' : ''}`}
                onClick={() => setDueFilter('noDeadline')}
              >
                Không hạn
              </button>
              <button
                className={`filter-chip ${dueFilter === 'done' ? 'active' : ''}`}
                onClick={() => setDueFilter('done')}
              >
                Đã xong
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
                        <span className="shared-badge" title="Task được chia sẻ">
                          Shared
                        </span>
                      )}
                      {overdue && <span className="due-badge overdue">Quá hạn</span>}
                      {!overdue && dueSoon && <span className="due-badge soon">Sắp đến hạn</span>}
                    </div>

                    <div className="note-header-right">
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
                      Hạn:{' '}
                      {note.deadline
                        ? new Date(note.deadline).toLocaleDateString('vi-VN')
                        : '—'}
                    </div>

                    {shared && (
                      <div className="shared-from">
                        Chia sẻ từ: <strong>{note.owner?.username || note.owner?.email || '—'}</strong>
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
                            title={canComment(note) ? 'Bình luận' : 'Xem bình luận'}
                          >
                            <MessageSquare size={18} />
                          </button>

                          {canManageShares(note) && (
                            <button
                              className="action-btn share"
                              onClick={() => openShareModal(note)}
                              title="Chia sẻ"
                            >
                              <Share2 size={18} />
                            </button>
                          )}

                          {canEdit(note) && (
                            <button className="action-btn edit" onClick={() => handleEditClick(note)} title="Sửa">
                              <Edit3 size={18} />
                            </button>
                          )}

                          {access === 'owner' && (
                            <button
                              className="action-btn delete"
                              onClick={() => handleDeleteAction(note._id || note.id, note)}
                              title="Chuyển vào thùng rác"
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
                            title="Khôi phục"
                          >
                            <RefreshCcw size={18} />
                          </button>
                          <button
                            className="action-btn delete-forever"
                            onClick={() => handleDeleteAction(note._id || note.id)}
                            title="Xóa vĩnh viễn"
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
              <p>{viewMode === 'active' ? 'Chưa có task nào.' : 'Thùng rác trống.'}</p>
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
            Trang {currentPage} / {totalPages}
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
              <h3>{isEditing ? 'Sửa Task' : 'Task mới'}</h3>
              <button className="btn-close" onClick={() => setShowModal(false)}>
                <X size={24} />
              </button>
            </div>

            <div className="form-group">
              <label>Tiêu đề</label>
                <input
                  type="text"
                  className="custom-input title-input"
                  placeholder="Tiêu đề..."
                  value={newNote.title}
                  onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
                  required
                />
              </div>

            <form onSubmit={handleSaveNote}>
              <div className="form-row">
                <div className="form-group half">
                  <label>Danh mục</label>
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
                  <label>Ưu tiên</label>
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
                  <label>Tiến độ: {newNote.progress}%</label>
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
                  <label>Trạng thái</label>
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
                    <option value="active">Đang làm</option>
                    <option value="cancelled">Đã hủy</option>
                  </select>
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
                <label>Thông tin</label>
                <textarea
                  className="custom-input"
                  placeholder="Nội dung..."
                  rows="6"
                  value={newNote.content}
                  onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
                  required
                ></textarea>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>
                  Hủy
                </button>
                <button type="submit" className="btn-save">
                  {isEditing ? 'Lưu' : 'Tạo'}
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
              <h3>Chia sẻ Task</h3>
              <button className="btn-close" onClick={() => setShowShareModal(false)}>
                <X size={24} />
              </button>
            </div>

            <div className="modal-subtitle">
              <div className="modal-subtitle-title">{shareTargetNote?.title || '—'}</div>
              <div className="modal-subtitle-hint">Chia sẻ theo email (read / comment / write)</div>
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
                Thêm
              </button>
            </div>

            <div className="share-list">
              {shareLoading ? (
                <div className="inline-loading">
                  <Loader className="animate-spin" />
                </div>
              ) : shares.length === 0 ? (
                <div className="muted">Chưa chia sẻ cho ai.</div>
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
                        Xóa
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
              <h3>Bình luận</h3>
              <button className="btn-close" onClick={() => setShowCommentsModal(false)}>
                <X size={24} />
              </button>
            </div>

            <div className="modal-subtitle">
              <div className="modal-subtitle-title">{commentsTargetNote?.title || '—'}</div>
              <div className="modal-subtitle-hint">
                {canComment(commentsTargetNote) ? 'Bạn có thể bình luận.' : 'Bạn chỉ có thể xem bình luận.'}
              </div>
            </div>

            <div className="comment-list">
              {commentsLoading ? (
                <div className="inline-loading">
                  <Loader className="animate-spin" />
                </div>
              ) : comments.length === 0 ? (
                <div className="muted">Chưa có bình luận.</div>
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
                placeholder={canComment(commentsTargetNote) ? 'Viết bình luận...' : 'Bạn không có quyền bình luận.'}
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
                Gửi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
