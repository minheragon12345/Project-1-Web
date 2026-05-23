import React from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { logout } from '../services/authService';
import { LogOut, StickyNote, User, FolderKanban } from 'lucide-react';
import { useI18n } from '../i18n';
import LanguageSwitcher from './LanguageSwitcher';
import './Navbar.css';

const Navbar = () => {
  const { t } = useI18n();
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
            <span>{t('nav.tasks')}</span>
          </Link>
          <Link to="/projects" className={`nav-link ${isActive('/projects') ? 'active' : ''}`}>
            <FolderKanban size={16} />
            <span>{t('nav.projects')}</span>
          </Link>
        </div>

        <div className="navbar-menu">
          <LanguageSwitcher />
          <div className="user-info">
            <User size={18} />
            <span>{t('nav.greeting', { name: user?.username || t('nav.guest') })}</span>
          </div>
          <button className="btn-logout-nav" onClick={handleLogout} title={t('common.signOut')}>
            <LogOut size={20} />
            <span>{t('common.signOut')}</span>
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
