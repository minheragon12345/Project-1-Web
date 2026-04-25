import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

import {
  getUsersLite,
  getStaffNotes,
  updateAnyNote,
  trashAnyNote,
  restoreAnyNote,
  deleteAnyNotePermanent,
} from '../services/staffService';

import {
  ArrowLeft,
  UserCog,
  Search,
  RefreshCcw,
  Edit3,
  Trash2,
  RotateCcw,
  Save,
  X,
} from 'lucide-react';
import './Staff.css';

const NOTE_CATEGORIES = ['Study', 'Health', 'Finance', 'Work', 'Personal', 'Other'];

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

const Staff = () => {
  const navigate = useNavigate();

  const currentUser = useMemo(() => {
    try {
      const s = localStorage.getItem('user');
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  }, []);

  const isAdmin = currentUser?.role === 'admin';

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);

  const [notes, setNotes] = useState([]);
  const [notesSearch, setNotesSearch] = useState('');
  const [notesIncludeDeleted, setNotesIncludeDeleted] = useState(false);
  const [notesUserId, setNotesUserId] = useState('');

  // edit
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [form, setForm] = useState({
    title: '',
    content: '',
    status: 'not_done',
    progress: 0,
    category: 'Other',
    deadline: '',
    priority: 0,
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
  }, [navigate]);

  const loadUsersLite = async () => {
    try {
      const data = await getUsersLite();
      setUsers(Array.isArray(data?.users) ? data.users : []);
    } catch (err) {
      setUsers([]);
    }
  };

  const loadNotes = async () => {
    setLoading(true);
    try {
      const data = await getStaffNotes({
        userId: notesUserId,
        includeDeleted: notesIncludeDeleted,
        search: notesSearch,
      });
      setNotes(Array.isArray(data?.notes) ? data.notes : []);
    } catch (err) {
      toast.error(err.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadUsersLite(), loadNotes()]);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      loadNotes();
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notesSearch, notesIncludeDeleted, notesUserId]);

  const openEdit = (note) => {
    const p = getProgressValue(note);
    setEditingNote(note);
    setForm({
      title: note?.title || '',
      content: note?.content || '',
      status: note?.status === 'cancelled' ? 'cancelled' : 'not_done',
      progress: p,
      category: note?.category || 'Other',
      deadline: toDateInputValue(note?.deadline),
      priority: typeof note?.priority === 'number' ? note.priority : 0,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingNote(null);
  };

  const onChange = (e) => {
    const { name, value } = e.target;

    if (name === 'progress') {
      const n = Number(value);
      const v = Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
      setForm((prev) => ({ ...prev, progress: v }));
      return;
    }

    if (name === 'priority') {
      const n = Number(value);
      const v = Number.isFinite(n) ? Math.max(0, Math.min(1024, n)) : 0;
      setForm((prev) => ({ ...prev, priority: v }));
      return;
    }

    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onStatusSelect = (e) => {
    const v = e.target.value;
    setForm((prev) => ({
      ...prev,
      status: v === 'cancelled' ? 'cancelled' : 'not_done',
    }));
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    if (!editingNote?._id) return;
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        content: form.content,
        status: form.status === 'cancelled' ? 'cancelled' : 'not_done',
        progress: Math.max(0, Math.min(100, Number(form.progress) || 0)),
        category: form.category,
        deadline: form.deadline,
        priority: Math.max(0, Math.min(1024, Number(form.priority) || 0)),
      };

      await updateAnyNote(editingNote._id, payload);
      toast.success('Task updated');
      closeModal();
      loadNotes();
    } catch (err) {
      toast.error(err.message || 'Could not update');
    } finally {
      setSaving(false);
    }
  };

  const doTrash = async (noteId) => {
    if (!window.confirm('Move this task to trash?')) return;
    try {
      await trashAnyNote(noteId);
      toast.success('Moved to trash');
      loadNotes();
    } catch (err) {
      toast.error(err.message || 'Could not move to trash');
    }
  };

  const doRestore = async (noteId) => {
    try {
      await restoreAnyNote(noteId);
      toast.success('Restored');
      loadNotes();
    } catch (err) {
      toast.error(err.message || 'Could not restore');
    }
  };

  const doDeletePermanent = async (noteId) => {
    if (!isAdmin) return;
    if (!window.confirm('PERMANENTLY delete this task?')) return;
    try {
      await deleteAnyNotePermanent(noteId);
      toast.success('Permanently deleted');
      loadNotes();
    } catch (err) {
      toast.error(err.message || 'Could not delete');
    }
  };

  return (
    <div className="staff-container">
      <div className="staff-header">
        <div className="staff-title">
          <UserCog size={22} />
          <div>
            <h2>Staff Dashboard</h2>
            <p>
              {currentUser ? (
                <>
                  Hi <strong>{currentUser.username}</strong> • role: <strong>{currentUser.role}</strong>
                </>
              ) : (
                'Task management'
              )}
            </p>
          </div>
        </div>

        <div className="staff-actions">
          <button className="btn" onClick={() => navigate('/')}> <ArrowLeft size={18} /> Back to Tasks</button>
        </div>
      </div>

      <div className="staff-card">
        <div className="toolbar">
          <div className="search">
            <Search size={18} />
            <input
              placeholder="Search title / content / category…"
              value={notesSearch}
              onChange={(e) => setNotesSearch(e.target.value)}
            />
          </div>

          <select
            className="select"
            value={notesUserId}
            onChange={(e) => setNotesUserId(e.target.value)}
            title="Filter by user"
          >
            <option value="">All users</option>
            {users.map((u) => (
              <option key={u._id} value={u._id}>
                {u.username} ({u.role}{u.isBanned ? ', banned' : ''})
              </option>
            ))}
          </select>

          <label className="checkbox">
            <input
              type="checkbox"
              checked={notesIncludeDeleted}
              onChange={(e) => setNotesIncludeDeleted(e.target.checked)}
            />
            Include trash
          </label>

          <button className="btn" onClick={loadNotes} title="Refresh">
            <RefreshCcw size={18} />
          </button>
        </div>

        {loading ? (
          <div className="loading">Loading…</div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Progress</th>
                  <th>Status</th>
                  <th>Deadline</th>
                  <th>Priority</th>
                  <th>Trash</th>
                  <th>Last updated</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {notes.map((n) => {
                  const p = getProgressValue(n);
                  return (
                    <tr key={n._id}>
                      <td>
                        {n.user ? (
                          <>
                            <strong>{n.user.username}</strong>
                            <div className="muted">{n.user.email}</div>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        <strong>{n.title || '(no title)'}</strong>
                        <div className="muted line-clamp">{n.content}</div>
                      </td>
                      <td>{n.category || 'Other'}</td>
                      <td>{p}%</td>
                      <td>{n.status}</td>
                      <td>{n.deadline ? new Date(n.deadline).toLocaleDateString('vi-VN') : '—'}</td>
                      <td>{typeof n.priority === 'number' ? n.priority : '—'}</td>
                      <td>{n.isDeleted ? 'Deleted' : 'Active'}</td>
                      <td>{n.updatedAt ? new Date(n.updatedAt).toLocaleString('vi-VN') : '—'}</td>
                      <td className="actions">
                        <button className="btn" onClick={() => openEdit(n)} title="Edit">
                          <Edit3 size={18} />
                        </button>

                        {!n.isDeleted ? (
                          <button className="btn danger" onClick={() => doTrash(n._id)} title="Trash">
                            <Trash2 size={18} />
                          </button>
                        ) : (
                          <button className="btn" onClick={() => doRestore(n._id)} title="Restore">
                            <RotateCcw size={18} />
                          </button>
                        )}

                        {isAdmin && (
                          <button className="btn danger" onClick={() => doDeletePermanent(n._id)} title="Delete permanently">
                            <Trash2 size={18} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {notes.length === 0 && (
                  <tr>
                    <td colSpan={10} className="empty">No tasks</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit task</h3>
              <button className="icon-btn" onClick={closeModal} title="Close">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={saveEdit}>
              <div className="form-group">
                <label>Title</label>
                <input name="title" value={form.title} onChange={onChange} placeholder="Title" />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Category</label>
                  <select name="category" value={form.category} onChange={onChange}>
                    {NOTE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Priority</label>
                  <input name="priority" type="number" min={0} max={1024} value={form.priority} onChange={onChange} />
                </div>
              </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Progress: {form.progress}%</label>
                    <div className="progress-edit">
                      <input
                        name="progress"
                        type="range"
                        min={0}
                        max={100}
                        value={form.progress}
                        disabled={form.status === 'cancelled'}
                        onChange={onChange}
                      />
                      <input
                        name="progress"
                        type="number"
                        min={0}
                        max={100}
                        value={form.progress}
                        disabled={form.status === 'cancelled'}
                        onChange={onChange}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Status</label>
                    <select value={form.status === 'cancelled' ? 'cancelled' : 'active'} onChange={onStatusSelect}>
                      <option value="active">In progress</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Deadline</label>
                  <input name="deadline" type="date" value={form.deadline} onChange={onChange} />
                </div>

              <div className="form-group">
                <label>Content</label>
                <textarea name="content" value={form.content} onChange={onChange} rows={6} placeholder="Content" required />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn" onClick={closeModal}>
                  <X size={18} /> Cancel
                </button>
                <button type="submit" className="btn primary" disabled={saving}>
                  <Save size={18} /> {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Staff;
