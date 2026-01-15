import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { logout } from '../services/authService';
import { LogOut, StickyNote, User } from 'lucide-react';
import './Navbar.css';

const Navbar = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user'));

  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  if (!localStorage.getItem('token')) return null;
  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">
          <StickyNote className="logo-icon" />
          <span>MyNotes</span>
        </Link>

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