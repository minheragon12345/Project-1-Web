import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  ArrowLeft,
  Download,
  FileText,
  Loader,
  Moon,
  Monitor,
  RefreshCcw,
  Sun,
  LogOut,
} from 'lucide-react';
import { getProjects, getProject } from '../services/projectService';
import { listTimeEntries } from '../services/timeEntryService';
import { useTheme } from '../hooks/useTheme';
import './Reports.css';

function toISODate(d) {
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  return x.toISOString().slice(0, 10);
}

function startOfMonth(d = new Date()) {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}

function downloadCsv(filename, rows) {
  if (!rows || rows.length === 0) {
    toast.info('Nothing to export');
    return;
  }
  const headers = Object.keys(rows[0]);
  const escape = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(',')),
  ];
  const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const Reports = () => {
  const navigate = useNavigate();
  const { pref: themePref, resolved: theme, cycle: cycleTheme } = useTheme();

  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [from, setFrom] = useState(() => toISODate(startOfMonth()));
  const [to, setTo] = useState(() => toISODate(new Date()));

  const [entries, setEntries] = useState([]);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    (async () => {
      try {
        const data = await getProjects({ scope: 'all', status: 'active' });
        const list = Array.isArray(data?.projects) ? data.projects : [];
        setProjects(list);
        if (list.length > 0 && !projectId) setProjectId(list[0].id);
      } catch (err) {
        toast.error(err.message || 'Could not load projects');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const fetchData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const params = { project: projectId, limit: 10000 };
      if (from) params.from = from;
      if (to) params.to = to + 'T23:59:59.999Z';
      const [entriesData, projectData] = await Promise.all([
        listTimeEntries(params),
        getProject(projectId),
      ]);
      setEntries(Array.isArray(entriesData?.entries) ? entriesData.entries : []);
      setProject(projectData?.project || null);
    } catch (err) {
      toast.error(err.message || 'Could not load report data');
    } finally {
      setLoading(false);
    }
  }, [projectId, from, to]);

  useEffect(() => {
    if (projectId) fetchData();
  }, [fetchData, projectId]);

  const rateMap = useMemo(() => {
    const map = new Map();
    if (!project) return map;
    if (project.owner?.id) {
      map.set(project.owner.id, {
        rate: Number(project.owner.billingRate) || 0,
        currency: project.owner.billingCurrency || 'USD',
      });
    }
    for (const m of project.members || []) {
      if (m.user?.id) {
        map.set(m.user.id, {
          rate: Number(m.user.billingRate) || 0,
          currency: m.user.billingCurrency || 'USD',
        });
      }
    }
    return map;
  }, [project]);

  const projectCurrency = project?.budget?.currency || 'USD';

  const hoursByUser = useMemo(() => {
    const map = new Map();
    for (const e of entries) {
      const uid = e.user?.id || 'unknown';
      const cur = map.get(uid) || {
        userId: uid,
        username: e.user?.username || '—',
        email: e.user?.email || '',
        hours: 0,
        billable: 0,
        entries: 0,
      };
      cur.hours += Number(e.hours) || 0;
      if (e.billable) cur.billable += Number(e.hours) || 0;
      cur.entries += 1;
      map.set(uid, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.hours - a.hours);
  }, [entries]);

  const hoursByTask = useMemo(() => {
    const map = new Map();
    for (const e of entries) {
      const tid = e.task?.id || 'unknown';
      const cur = map.get(tid) || {
        taskId: tid,
        title: e.task?.title || e.task?.content?.slice(0, 60) || '—',
        hours: 0,
        billable: 0,
        entries: 0,
      };
      cur.hours += Number(e.hours) || 0;
      if (e.billable) cur.billable += Number(e.hours) || 0;
      cur.entries += 1;
      map.set(tid, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.hours - a.hours);
  }, [entries]);

  const costByUser = useMemo(() => {
    return hoursByUser.map((u) => {
      const rateInfo = rateMap.get(u.userId);
      const rate = rateInfo?.rate || 0;
      const currency = rateInfo?.currency || 'USD';
      const cost = u.hours * rate;
      const billableCost = u.billable * rate;
      return { ...u, rate, currency, cost, billableCost };
    });
  }, [hoursByUser, rateMap]);

  const totals = useMemo(() => {
    const totalHours = hoursByUser.reduce((s, u) => s + u.hours, 0);
    const totalBillable = hoursByUser.reduce((s, u) => s + u.billable, 0);
    const totalCost = costByUser.reduce((s, u) => s + u.cost, 0);
    const billableCost = costByUser.reduce((s, u) => s + u.billableCost, 0);
    return {
      totalHours,
      totalBillable,
      totalCost,
      billableCost,
    };
  }, [hoursByUser, costByUser]);

  const handleExportHoursByUser = () => {
    downloadCsv(`hours-by-user_${projectId}_${from}_${to}.csv`,
      hoursByUser.map((u) => ({
        username: u.username,
        email: u.email,
        hours: u.hours.toFixed(2),
        billableHours: u.billable.toFixed(2),
        entries: u.entries,
      })));
  };

  const handleExportHoursByTask = () => {
    downloadCsv(`hours-by-task_${projectId}_${from}_${to}.csv`,
      hoursByTask.map((t) => ({
        taskId: t.taskId,
        title: t.title,
        hours: t.hours.toFixed(2),
        billableHours: t.billable.toFixed(2),
        entries: t.entries,
      })));
  };

  const handleExportCostByUser = () => {
    downloadCsv(`cost-by-user_${projectId}_${from}_${to}.csv`,
      costByUser.map((u) => ({
        username: u.username,
        email: u.email,
        hours: u.hours.toFixed(2),
        billableHours: u.billable.toFixed(2),
        rate: u.rate.toFixed(2),
        currency: u.currency,
        cost: u.cost.toFixed(2),
        billableCost: u.billableCost.toFixed(2),
      })));
  };

  return (
    <div className={`reports-container ${theme}-theme`}>
      <div className="reports-header">
        <div className="reports-title">
          <FileText size={22} />
          <div>
            <h2>Reports</h2>
            <p>Hours and cost breakdowns per project</p>
          </div>
        </div>

        <div className="reports-actions">
          <button className="btn" onClick={cycleTheme} title={`Theme: ${themePref}`}>
            {themePref === 'light' ? (
              <Sun size={18} />
            ) : themePref === 'dark' ? (
              <Moon size={18} />
            ) : (
              <Monitor size={18} />
            )}
          </button>
          <button
            className="btn"
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
          >
            <ArrowLeft size={18} /> Back
          </button>
          <button
            className="btn"
            onClick={() => {
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              window.dispatchEvent(new Event('authChange'));
              navigate('/login');
            }}
            title="Sign out"
          >
            <LogOut size={18} /> Logout
          </button>
        </div>
      </div>

      <div className="reports-filters">
        <label>
          <span>Project</span>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            {projects.length === 0 ? <option value="">No projects</option> : null}
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}{p.isPersonal ? ' (Personal)' : ''}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>From</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          <span>To</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button className="btn" onClick={fetchData} disabled={loading || !projectId}>
          {loading ? <Loader size={14} className="spin" /> : <RefreshCcw size={14} />}
          <span>{loading ? 'Loading…' : 'Refresh'}</span>
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="reports-empty-state">
          <FileText size={40} />
          <p>No projects yet. Create a project before running reports.</p>
        </div>
      ) : null}

      <div className="reports-totals">
        <div className="reports-total-card">
          <span className="reports-total-label">Total hours</span>
          <strong>{totals.totalHours.toFixed(2)}h</strong>
          <span className="reports-total-sub">{totals.totalBillable.toFixed(2)}h billable</span>
        </div>
        <div className="reports-total-card">
          <span className="reports-total-label">Total cost</span>
          <strong>
            {totals.totalCost.toLocaleString(undefined, { maximumFractionDigits: 2 })} {projectCurrency}
          </strong>
          <span className="reports-total-sub">
            {totals.billableCost.toLocaleString(undefined, { maximumFractionDigits: 2 })} {projectCurrency} billable
          </span>
        </div>
        <div className="reports-total-card">
          <span className="reports-total-label">Entries</span>
          <strong>{entries.length}</strong>
          <span className="reports-total-sub">
            {hoursByUser.length} user{hoursByUser.length === 1 ? '' : 's'} • {hoursByTask.length} task{hoursByTask.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      <div className="reports-section">
        <div className="reports-section-header">
          <h3>Hours by user</h3>
          <button className="btn" onClick={handleExportHoursByUser} disabled={hoursByUser.length === 0}>
            <Download size={14} /> CSV
          </button>
        </div>
        <div className="reports-table-wrap">
          <table className="reports-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Hours</th>
                <th>Billable</th>
                <th>Entries</th>
              </tr>
            </thead>
            <tbody>
              {hoursByUser.length === 0 ? (
                <tr><td colSpan={4} className="reports-empty">No data</td></tr>
              ) : (
                hoursByUser.map((u) => (
                  <tr key={u.userId}>
                    <td>
                      <strong>{u.username}</strong>
                      <div className="muted-inline">{u.email}</div>
                    </td>
                    <td>{u.hours.toFixed(2)}h</td>
                    <td>{u.billable.toFixed(2)}h</td>
                    <td>{u.entries}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="reports-section">
        <div className="reports-section-header">
          <h3>Hours by task</h3>
          <button className="btn" onClick={handleExportHoursByTask} disabled={hoursByTask.length === 0}>
            <Download size={14} /> CSV
          </button>
        </div>
        <div className="reports-table-wrap">
          <table className="reports-table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Hours</th>
                <th>Billable</th>
                <th>Entries</th>
              </tr>
            </thead>
            <tbody>
              {hoursByTask.length === 0 ? (
                <tr><td colSpan={4} className="reports-empty">No data</td></tr>
              ) : (
                hoursByTask.map((t) => (
                  <tr key={t.taskId}>
                    <td className="reports-task-cell">
                      <strong>{t.title || '(no title)'}</strong>
                      <div className="muted-inline">{t.taskId}</div>
                    </td>
                    <td>{t.hours.toFixed(2)}h</td>
                    <td>{t.billable.toFixed(2)}h</td>
                    <td>{t.entries}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="reports-section">
        <div className="reports-section-header">
          <h3>Cost by user</h3>
          <button className="btn" onClick={handleExportCostByUser} disabled={costByUser.length === 0}>
            <Download size={14} /> CSV
          </button>
        </div>
        <div className="reports-table-wrap">
          <table className="reports-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Hours</th>
                <th>Rate</th>
                <th>Cost</th>
                <th>Billable cost</th>
              </tr>
            </thead>
            <tbody>
              {costByUser.length === 0 ? (
                <tr><td colSpan={5} className="reports-empty">No data</td></tr>
              ) : (
                costByUser.map((u) => (
                  <tr key={u.userId}>
                    <td>
                      <strong>{u.username}</strong>
                      <div className="muted-inline">{u.email}</div>
                    </td>
                    <td>{u.hours.toFixed(2)}h</td>
                    <td>{u.rate.toFixed(2)} {u.currency}/h</td>
                    <td>
                      <strong>
                        {u.cost.toLocaleString(undefined, { maximumFractionDigits: 2 })} {projectCurrency}
                      </strong>
                    </td>
                    <td>
                      {u.billableCost.toLocaleString(undefined, { maximumFractionDigits: 2 })} {projectCurrency}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Reports;
