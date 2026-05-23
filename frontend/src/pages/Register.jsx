import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { register } from '../services/authService';
import { toast } from 'react-toastify';
import { useI18n } from '../i18n';
import LanguageSwitcher from '../components/LanguageSwitcher';
import './Register.css';

const Register = () => {
  const { t } = useI18n();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { username, email, password, confirmPassword } = formData;

  const onChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      return toast.error(t('auth.passwordMismatch'));
    }

    setLoading(true);
    try {
      await register(username, email, password);

      toast.success(t('auth.signUpToast'));

      navigate('/login');
    } catch (err) {
      toast.error(err.message || t('auth.signUpFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div style={{ position: 'absolute', top: 16, right: 16 }}>
        <LanguageSwitcher />
      </div>
      <div className="auth-card">
        <h2>{t('auth.createAccount')}</h2>
        <form onSubmit={onSubmit}>
          <div className="form-group">
            <label>{t('auth.username')}</label>
            <input
              type="text"
              name="username"
              value={username}
              onChange={onChange}
              placeholder={t('auth.usernamePlaceholder')}
              required
            />
          </div>
          <div className="form-group">
            <label>{t('auth.email')}</label>
            <input
              type="email"
              name="email"
              value={email}
              onChange={onChange}
              placeholder="email@example.com"
              required
            />
          </div>
          <div className="form-group">
            <label>{t('auth.password')}</label>
            <input
              type="password"
              name="password"
              value={password}
              onChange={onChange}
              placeholder={t('auth.passwordHint')}
              required
            />
          </div>
          <div className="form-group">
            <label>{t('auth.confirmPassword')}</label>
            <input
              type="password"
              name="confirmPassword"
              value={confirmPassword}
              onChange={onChange}
              placeholder={t('auth.confirmPlaceholder')}
              required
            />
          </div>
          <button type="submit" className="btn-auth" disabled={loading}>
            {loading ? t('common.processing') : t('auth.signUp')}
          </button>
        </form>
        <p className="auth-footer">
          {t('auth.hasAccount')} <Link to="/login">{t('auth.signInNow')}</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
