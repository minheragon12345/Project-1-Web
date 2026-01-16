import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

import { getUsers, updateUserRole, setUserBan, getAuditLogs } from '../services/adminService';
import { Shield, ArrowLeft, Users, ClipboardList, Search, RefreshCcw, Ban, CheckCircle2, FileText } from 'lucide-react';
import './Admin.css';

const Admin = () => {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('users');

  // users
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [userSearch, setUserSearch] = useState('');

  // audit logs
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logAction, setLogAction] = useState('');
  const [logTargetType, setLogTargetType] = useState('');
  const [logPage, setLogPage] = useState(1);
  const [logTotal, setLogTotal] = useState(0);

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const data = await getUsers(userSearch);
      setUsers(Array.isArray(data?.users) ? data.users : []);
    } catch (err) {
      toast.error(err.message || 'Không thể lấy users');
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadLogs = async (page = logPage) => {
    setLoadingLogs(true);
    try {
      const data = await getAuditLogs({
        page,
        limit: 100,
        action: logAction.trim(),
        targetType: logTargetType.trim(),
      });
      setLogs(Array.isArray(data?.logs) ? data.logs : []);
      setLogTotal(typeof data?.total === 'number' ? data.total : 0);
      setLogPage(typeof data?.page === 'number' ? data.page : page);
    } catch (err) {
      toast.error(err.message || 'Không thể lấy audit logs');
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) navigate('/login');
  }, [navigate]);

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      if (activeTab === 'users') loadUsers();
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userSearch]);

  useEffect(() => {
    if (activeTab === 'logs') loadLogs(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleRoleChange = async (userId, role) => {
    try {
      await updateUserRole(userId, role);
      toast.success('Đã cập nhật role');
      loadUsers();
    } catch (err) {
      toast.error(err.message || 'Không thể cập nhật role');
    }
  };

  const handleBanToggle = async (u) => {
    try {
      if (!u?._id) return;
      if (!u.isBanned) {
        const reason = window.prompt('Nhập lý do ban (tùy chọn):', '') || '';
        await setUserBan(u._id, true, reason);
        toast.success('Đã ban user');
      } else {
        if (!window.confirm('Gỡ ban user này?')) return;
        await setUserBan(u._id, false, '');
        toast.success('Đã gỡ ban');
      }
      loadUsers();
    } catch (err) {
      toast.error(err.message || 'Không thể cập nhật ban');
    }
  };

  return (
    <div className="admin-container">
      <div className="admin-header">
        <div className="admin-title">
          <Shield size={22} />
          <div>
            <h2>Admin</h2>
            <p>Quản lý users, role, ban và audit logs</p>
          </div>
        </div>

        <div className="admin-actions">
          <button className="btn" onClick={() => navigate('/')}>
            <ArrowLeft size={18} /> Về ghi chú
          </button>
        </div>
      </div>

      <div className="admin-tabs">
        <button className={activeTab === 'users' ? 'tab active' : 'tab'} onClick={() => setActiveTab('users')}>
          <Users size={18} /> Users
        </button>
        <button className={activeTab === 'logs' ? 'tab active' : 'tab'} onClick={() => setActiveTab('logs')}>
          <ClipboardList size={18} /> Audit logs
        </button>
      </div>

      {activeTab === 'users' && (
        <div className="admin-card">
          <div className="toolbar">
            <div className="search">
              <Search size={18} />
              <input
                placeholder="Tìm username / email..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />
            </div>

            <button className="btn" onClick={loadUsers} title="Refresh">
              <RefreshCcw size={18} />
            </button>
          </div>

          {loadingUsers ? (
            <div className="loading">Đang tải...</div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Banned</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u._id}>
                      <td>
                        <strong>{u.username}</strong>
                        <div className="muted">{u.email}</div>
                      </td>
                      <td>
                        <select
                          className="select"
                          value={u.role || 'user'}
                          onChange={(e) => handleRoleChange(u._id, e.target.value)}
                        >
                          <option value="user">user</option>
                          <option value="moderator">moderator</option>
                          <option value="admin">admin</option>
                        </select>
                      </td>
                      <td>
                        {u.isBanned ? (
                          <span title={u.banReason || ''}><Ban size={18} /></span>
                        ) : (
                          <span><CheckCircle2 size={18} /></span>
                        )}
                      </td>
                      <td>
                        <button
                          className={u.isBanned ? 'btn' : 'btn danger'}
                          onClick={() => handleBanToggle(u)}
                          title={u.isBanned ? 'Gỡ ban' : 'Ban user'}
                        >
                          {u.isBanned ? 'Unban' : 'Ban'}
                        </button>
                      </td>
                    </tr>
                  ))}

                  {users.length === 0 && (
                    <tr>
                      <td colSpan={4} className="empty">Không có users</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="admin-card">
          <div className="toolbar">
            <div className="search">
              <FileText size={18} />
              <input
                placeholder="Filter action (VD: NOTE_EDIT, USER_BAN, USER_ROLE_UPDATE...)"
                value={logAction}
                onChange={(e) => setLogAction(e.target.value)}
              />
            </div>

            <input
              className="select"
              style={{ minWidth: 160 }}
              placeholder="targetType (User/Note...)"
              value={logTargetType}
              onChange={(e) => setLogTargetType(e.target.value)}
            />

            <button className="btn" onClick={() => loadLogs(1)} title="Refresh">
              <RefreshCcw size={18} />
            </button>
          </div>

          {loadingLogs ? (
            <div className="loading">Đang tải logs...</div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Actor</th>
                    <th>Action</th>
                    <th>Target</th>
                    <th>Metadata</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l._id}>
                      <td>{l.createdAt ? new Date(l.createdAt).toLocaleString('vi-VN') : '—'}</td>
                      <td>
                        {l.actor ? (
                          <>
                            <strong>{l.actor.username}</strong>
                            <div className="muted">{l.actor.email}</div>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        <strong>{l.action}</strong>
                        <div className="muted">role: {l.actorRole}</div>
                      </td>
                      <td>
                        <strong>{l.targetType}</strong>
                        <div className="muted">{String(l.targetId)}</div>
                      </td>
                      <td>
                        <div className="muted line-clamp">{JSON.stringify(l.metadata || {})}</div>
                      </td>
                    </tr>
                  ))}

                  {logs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="empty">Không có logs</td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div style={{ padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="muted">Total: {logTotal}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn" disabled={logPage <= 1} onClick={() => loadLogs(logPage - 1)}>
                    Prev
                  </button>
                  <button className="btn" disabled={logPage * 100 >= logTotal} onClick={() => loadLogs(logPage + 1)}>
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Admin;
