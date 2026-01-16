import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import Admin from './pages/Admin';
import Staff from './pages/Staff';
import { me } from './services/authService';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));
  const [user, setUser] = useState(() => {
    try {
      const s = localStorage.getItem('user');
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const handler = () => {
      setIsAuthenticated(!!localStorage.getItem('token'));
      try {
        const s = localStorage.getItem('user');
        setUser(s ? JSON.parse(s) : null);
      } catch {
        setUser(null);
      }
    };
    window.addEventListener('authChange', handler);
    return () => window.removeEventListener('authChange', handler);
  }, []);

  // On app load, if we have a token but no user in storage, fetch /auth/me
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    if (user) return;

    (async () => {
      try {
        const data = await me();
        if (data?.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
          setUser(data.user);
          window.dispatchEvent(new Event('authChange'));
        }
      } catch {
        // handled by interceptor
      }
    })();
  }, [user]);

  const isAdmin = user?.role === 'admin';
  const isStaff = user?.role === 'admin' || user?.role === 'moderator';

  return (
    <Router>
      <ToastContainer position="top-right" autoClose={3000} />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/"
          element={isAuthenticated ? <Home /> : <Navigate to="/login" />}
        />
        <Route
          path="/staff"
          element={isAuthenticated && isStaff ? <Staff /> : <Navigate to="/" />}
        />
        <Route
          path="/admin"
          element={isAuthenticated && isAdmin ? <Admin /> : <Navigate to="/" />}
        />
      </Routes>
    </Router>
  );
}

export default App;
