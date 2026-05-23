import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { login } from '../services/authService';
import { toast } from 'react-toastify';
import { useI18n } from '../i18n';
import LanguageSwitcher from '../components/LanguageSwitcher';
import './Login.css';

const Login = () => {
  const { t } = useI18n();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { email, password } = formData;

  useEffect(() => {
    try {
      const msg = sessionStorage.getItem('auth_error');
      if (msg) {
        sessionStorage.removeItem('auth_error');
        toast.error(msg);
      }
    } catch {
      // ignore
    }
  }, []);

  const onChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = await login(email, password);

      localStorage.setItem('token', data.token);
      if (data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
      } else {
        localStorage.removeItem('user');
      }

      window.dispatchEvent(new Event('authChange'));
      toast.success(t('auth.signInToast'));
      navigate('/');
    } catch (err) {
      toast.error(err.message || t('auth.signInFailed'));
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
        <h2>{t('auth.signIn')}</h2>
        <form onSubmit={onSubmit}>
          <div className="form-group">
            <label>{t('auth.email')}</label>
            <input
              type="email"
              name="email"
              value={email}
              onChange={onChange}
              placeholder={t('auth.emailPlaceholder')}
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
              placeholder={t('auth.passwordPlaceholder')}
              required
            />
          </div>
          <button type="submit" className="btn-auth" disabled={loading}>
            {loading ? t('common.processing') : t('auth.signIn')}
          </button>
        </form>
        <p className="auth-footer">
          {t('auth.noAccount')} <Link to="/register">{t('auth.signUpNow')}</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
