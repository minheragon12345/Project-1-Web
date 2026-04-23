import React from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { logout } from '../services/authService';
import { LogOut, StickyNote, User, FolderKanban } from 'lucide-react';
import './Navbar.css';

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!localStorage.getItem('token')) return null;

  const isActive = (prefix) =>
    prefix === '/' ? location.pathname === '/' : location.pathname.startsWith(prefix);

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">
          <StickyNote className="logo-icon" />
          <span>MyNotes</span>
        </Link>

        <div className="navbar-links">
          <Link to="/" className={`nav-link ${isActive('/') && !isActive('/projects') ? 'active' : ''}`}>
            <StickyNote size={16} />
            <span>Công việc</span>
          </Link>
          <Link to="/projects" className={`nav-link ${isActive('/projects') ? 'active' : ''}`}>
            <FolderKanban size={16} />
            <span>Dự án</span>
          </Link>
        </div>

        <div className="navbar-menu">
          <div className="user-info">
            <User size={18} />
            <span>Chào, <strong>{user?.username || 'Bạn'}</strong></span>
          </div>
          <button className="btn-logout-nav" onClick={handleLogout} title="Đăng xuất">
            <LogOut size={20} />
            <span>Đăng xuất</span>
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
