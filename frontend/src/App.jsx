import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import Login from './pages/Login';
import Register from './pages/Register';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import ProjectOptimize from './pages/ProjectOptimize';
import MyTime from './pages/MyTime';
import Reports from './pages/Reports';
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
      }
    })();
  }, [user]);

  return (
    <Router>
      <ToastContainer position="top-right" autoClose={3000} />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/"
          element={isAuthenticated ? <Navigate to="/projects" replace /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/projects"
          element={isAuthenticated ? <Projects /> : <Navigate to="/login" />}
        />
        <Route
          path="/projects/:id"
          element={isAuthenticated ? <ProjectDetail /> : <Navigate to="/login" />}
        />
        <Route
          path="/projects/:id/optimize"
          element={isAuthenticated ? <ProjectOptimize /> : <Navigate to="/login" />}
        />
        <Route
          path="/my-time"
          element={isAuthenticated ? <MyTime /> : <Navigate to="/login" />}
        />
        <Route
          path="/reports"
          element={isAuthenticated ? <Reports /> : <Navigate to="/login" />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
