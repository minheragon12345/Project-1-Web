import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  getNotes, getTrashNotes, deleteNote, createNote, updateNote, 
  restoreNote, deleteNotePermanent 
} from '../services/noteService';
import { toast } from 'react-toastify';
import { Plus, Trash2, Edit3, X, LogOut, Loader, RefreshCcw, Archive, ChevronLeft, ChevronRight, Moon, Sun, Search } from 'lucide-react'; 
import './Home.css';

const Home = () => {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState('light');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('active'); 
  
  const [currentPage, setCurrentPage] = useState(1);
  const notesPerPage = 6;
  const [showModal, setShowModal] = useState(false);
  
  const [newNote, setNewNote] = useState({ 
    title: '', content: '', status: 'not_done', priority: 1 
  });
  
  const [isEditing, setIsEditing] = useState(false);
  const [currentNoteId, setCurrentNoteId] = useState(null);
  
  const [user] = useState(() => {
    try {
      const userStr = localStorage.getItem('user');
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  });

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
    setSearchQuery('');
    fetchData();
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
        notesData = notesData.filter(n => 
          (n.title && n.title.toLowerCase().includes(lowerQ)) || 
          (n.content && n.content.toLowerCase().includes(lowerQ))
        );
      }

      notesData.sort((a, b) => (a.priority || 0) - (b.priority || 0));

      setNotes(notesData);
    } catch (err) {
      console.error("Lỗi fetch:", err);
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
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, fetchData]);

  const handleOpenAddModal = () => {
    setNewNote({ title: '', content: '', status: 'not_done', priority: 1 });
    setIsEditing(false);
    setShowModal(true);
  };

  const handleEditClick = (note) => {
    setNewNote({ 
      title: note.title, 
      content: note.content, 
      status: note.status || 'not_done', 
      priority: note.priority || 1 
    });
    setCurrentNoteId(note._id || note.id);
    setIsEditing(true);
    setShowModal(true);
  };

  const handleSaveNote = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await updateNote(currentNoteId, newNote);
        toast.success("Đã cập nhật!");
      } else {
        await createNote(newNote);
        toast.success("Đã tạo mới!");
      }
      setShowModal(false);
      fetchData(); 
    } catch (err) {
      toast.error(err.message || 'Lưu thất bại.');
    }
  };

  const handleDeleteAction = async (id) => {
    if (viewMode === 'active') {
      if (window.confirm('Chuyển ghi chú này vào thùng rác?')) {
        try {
          await deleteNote(id);
          toast.success('Đã chuyển vào thùng rác!');
          fetchData();
        } catch (err) { toast.error(err.message || 'Lỗi xóa.'); }
      }
    } else {
      if (window.confirm('CẢNH BÁO: Hành động này không thể hoàn tác. Xóa vĩnh viễn?')) {
        try {
          await deleteNotePermanent(id);
          toast.success('Đã xóa vĩnh viễn!');
          fetchData();
        } catch (err) { toast.error(err.message || 'Lỗi xóa vĩnh viễn.'); }
      }
    }
  };

  const handleRestore = async (id) => {
    try {
      await restoreNote(id);
      toast.success('Đã khôi phục ghi chú!');
      fetchData();
    } catch (err) { toast.error(err.message || 'Lỗi khôi phục.'); }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'done': return <span className="status-badge done">Đã xong</span>;
      case 'cancelled': return <span className="status-badge cancelled">Đã hủy</span>;
      default: return <span className="status-badge not-done">Chưa xong</span>;
    }
  };

  const indexOfLastNote = currentPage * notesPerPage;
  const indexOfFirstNote = indexOfLastNote - notesPerPage;
  const currentNotes = notes.slice(indexOfFirstNote, indexOfLastNote);
  const totalPages = Math.ceil(notes.length / notesPerPage);

  return (
    <div className={`home-container ${theme}-theme`}>
      <div className="home-action-bar">
        <div className="header-top-row">
          <h2>{viewMode === 'active' ? 'Ghi chú của tôi' : 'Thùng rác'}</h2>
          {user && <span className="user-greeting">Xin chào, <strong>{user.username}</strong></span>}
        </div>
        
        <div className="header-bottom-row">
          <div className="search-box">
            <Search size={18} />
            <input 
              type="text" 
              placeholder="Tìm kiếm..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="action-buttons">
            <button className="btn-theme-toggle" onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')} title="Đổi giao diện">
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
            <button className="btn-logout" onClick={handleLogout} title="Đăng xuất"><LogOut size={20} /></button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-state"><Loader className="animate-spin" /></div>
      ) : (
        <div className="notes-grid">
          {currentNotes.length > 0 ? (
            currentNotes.map((note) => (
              <div key={note._id || note.id} className="note-card">
                <div className="note-header-row">
                   {getStatusBadge(note.status)}
                   <span className="priority-badge"> {note.priority || 0}</span>
                </div>
                
                <div className="note-body">
                  <h3>{note.title}</h3>
                  <p>{note.content}</p>
                </div>
                
                <div className="note-footer">
                  <span className="note-date">
                    {note.createdAt ? new Date(note.createdAt).toLocaleDateString('vi-VN') : '—'}
                  </span>
                  
                  <div className="note-actions">
                    {viewMode === 'active' ? (
                      <>
                        <button className="action-btn edit" onClick={() => handleEditClick(note)}>
                          <Edit3 size={18} />
                        </button>
                        <button className="action-btn delete" onClick={() => handleDeleteAction(note._id || note.id)} title="Chuyển vào thùng rác">
                          <Trash2 size={18} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="action-btn restore" onClick={() => handleRestore(note._id || note.id)} title="Khôi phục">
                          <RefreshCcw size={18} />
                        </button>
                        <button className="action-btn delete-forever" onClick={() => handleDeleteAction(note._id || note.id)} title="Xóa vĩnh viễn">
                          <Trash2 size={18} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state">
              <p>{viewMode === 'active' ? 'Chưa có ghi chú nào.' : 'Thùng rác trống.'}</p>
            </div>
          )}
        </div>
      )}

      {notes.length > notesPerPage && (
        <div className="pagination">
          <button 
            className="page-btn" 
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft size={20} />
          </button>
          
          <span className="page-info">Trang {currentPage} / {totalPages}</span>
          
          <button 
            className="page-btn" 
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{isEditing ? 'Sửa ghi chú' : 'Ghi chú mới'}</h3>
              <button className="btn-close" onClick={() => setShowModal(false)}><X size={24} /></button>
            </div>
            <form onSubmit={handleSaveNote}>
              <div className="form-row">
                 <div className="form-group half">
                    <label>Trạng thái</label>
                    <select 
                      className="custom-select"
                      value={newNote.status}
                      onChange={(e) => setNewNote({...newNote, status: e.target.value})}
                    >
                      <option value="not_done">Chưa xong</option>
                      <option value="done">Đã xong</option>
                      <option value="cancelled">Đã hủy</option>
                    </select>
                 </div>
                 <div className="form-group half">
                    <label>Ưu tiên</label>
                    <input 
                      type="number" 
                      className="custom-input"
                      value={newNote.priority}
                      onChange={(e) => setNewNote({...newNote, priority: parseInt(e.target.value)})}
                    />
                 </div>
              </div>

              <div className="form-group">
                <input 
                  type="text" 
                  className="custom-input title-input"
                  placeholder="Tiêu đề..." 
                  value={newNote.title}
                  onChange={(e) => setNewNote({...newNote, title: e.target.value})}
                  required 
                />
              </div>
              <div className="form-group">
                <textarea 
                  className="custom-input"
                  placeholder="Nội dung..." 
                  rows="6"
                  value={newNote.content}
                  onChange={(e) => setNewNote({...newNote, content: e.target.value})}
                  required
                ></textarea>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>Hủy</button>
                <button type="submit" className="btn-save">{isEditing ? 'Lưu' : 'Tạo'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;