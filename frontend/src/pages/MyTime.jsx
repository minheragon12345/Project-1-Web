import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader,
  Moon,
  Monitor,
  Sun,
  Trash2,
  CalendarDays,
} from 'lucide-react';
import { listTimeEntries, deleteTimeEntry } from '../services/timeEntryService';
import { useTheme } from '../hooks/useTheme';
import './MyTime.css';

function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  // Monday-based week
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

function formatRange(start) {
  const end = addDays(start, 6);
  const fmt = { day: '2-digit', month: 'short' };
  return `${start.toLocaleDateString('vi-VN', fmt)} – ${end.toLocaleDateString('vi-VN', fmt)} ${end.getFullYear()}`;
}

function dayLabel(date) {
  return date.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: 'short' });
}

const MyTime = () => {
  const navigate = useNavigate();
  const { pref: themePref, resolved: theme, cycle: cycleTheme } = useTheme();

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [entries, setEntries] = useState([]);
  const [totalHours, setTotalHours] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState(null);

  const currentUser = useMemo(() => {
    try {
      const s = localStorage.getItem('user');
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  }, []);

  const fetchWeek = useCallback(async () => {
    setLoading(true);
    try {
      const from = toISODate(weekStart);
      const to = toISODate(addDays(weekStart, 6));
      const data = await listTimeEntries({
        from,
        to: to + 'T23:59:59.999Z',
        limit: 500,
      });
      setEntries(Array.isArray(data?.entries) ? data.entries : []);
      setTotalHours(typeof data?.totalHours === 'number' ? data.totalHours : 0);
    } catch (err) {
      toast.error(err.message || 'Could not load time entries');
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    fetchWeek();
  }, [fetchWeek, navigate]);

  const days = useMemo(() => {
    const out = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(weekStart, i);
      const iso = toISODate(date);
      const dayEntries = entries.filter((e) => toISODate(new Date(e.date)) === iso);
      const dayTotal = dayEntries.reduce((s, e) => s + (Number(e.hours) || 0), 0);
      const billable = dayEntries.reduce((s, e) => s + (e.billable ? Number(e.hours) || 0 : 0), 0);
      out.push({ date, iso, entries: dayEntries, total: dayTotal, billable });
    }
    return out;
  }, [weekStart, entries]);

  const billableTotal = useMemo(
    () => entries.reduce((s, e) => s + (e.billable ? Number(e.hours) || 0 : 0), 0),
    [entries],
  );

  const handleDelete = async (entry) => {
    if (!window.confirm(`Delete this ${entry.hours}h entry?`)) return;
    setPendingId(entry.id);
    try {
      await deleteTimeEntry(entry.id);
      toast.success('Entry deleted');
      fetchWeek();
    } catch (err) {
      toast.error(err.message || 'Could not delete');
    } finally {
      setPendingId(null);
    }
  };

  const goPrev = () => setWeekStart((d) => addDays(d, -7));
  const goNext = () => setWeekStart((d) => addDays(d, 7));
  const goToday = () => setWeekStart(startOfWeek(new Date()));

  return (
    <div className={`mytime-container ${theme}-theme`}>
      <div className="mytime-header">
        <div className="mytime-title">
          <Clock size={22} />
          <div>
            <h2>My Time</h2>
            <p>
              {currentUser ? (
                <>Hours logged for <strong>{currentUser.username}</strong></>
              ) : (
                'Weekly time tracking'
              )}
            </p>
          </div>
        </div>

        <div className="mytime-actions">
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
        </div>
      </div>

      <div className="mytime-week-bar">
        <button className="btn" onClick={goPrev} title="Previous week">
          <ChevronLeft size={18} />
        </button>
        <div className="mytime-week-label">
          <CalendarDays size={16} />
          <span>{formatRange(weekStart)}</span>
        </div>
        <button className="btn" onClick={goNext} title="Next week">
          <ChevronRight size={18} />
        </button>
        <button className="btn" onClick={goToday}>This week</button>

        <div className="mytime-week-totals">
          <span className="mytime-stat">
            Total: <strong>{totalHours.toFixed(2)}h</strong>
          </span>
          <span className="mytime-stat">
            Billable: <strong>{billableTotal.toFixed(2)}h</strong>
          </span>
        </div>
      </div>

      {loading ? (
        <div className="mytime-loading">
          <Loader className="spin" size={28} />
          <span>Loading…</span>
        </div>
      ) : (
        <div className="mytime-days">
          {days.map((day) => (
            <div className="mytime-day" key={day.iso}>
              <div className="mytime-day-header">
                <span className="mytime-day-label">{dayLabel(day.date)}</span>
                <span className="mytime-day-total">
                  {day.total.toFixed(2)}h
                  {day.billable > 0 && day.billable !== day.total ? (
                    <span className="mytime-day-billable"> ({day.billable.toFixed(2)}h billable)</span>
                  ) : null}
                </span>
              </div>
              <div className="mytime-day-body">
                {day.entries.length === 0 ? (
                  <div className="mytime-day-empty">No entries</div>
                ) : (
                  day.entries.map((e) => {
                    const pending = pendingId === e.id;
                    return (
                      <div className={`mytime-entry ${pending ? 'is-pending' : ''}`} key={e.id}>
                        <span className="mytime-entry-hours">{Number(e.hours).toFixed(2)}h</span>
                        <div className="mytime-entry-body">
                          <div className="mytime-entry-task">
                            {e.task?.title || e.task?.content?.slice(0, 80) || 'Task'}
                            {e.project?.name ? (
                              <span className="mytime-entry-project">in {e.project.name}</span>
                            ) : null}
                          </div>
                          {e.description ? (
                            <div className="mytime-entry-desc">{e.description}</div>
                          ) : null}
                        </div>
                        {e.billable ? (
                          <span className="mytime-chip billable">Billable</span>
                        ) : (
                          <span className="mytime-chip">Non-billable</span>
                        )}
                        <button
                          type="button"
                          className="icon-btn danger"
                          onClick={() => handleDelete(e)}
                          disabled={pending}
                          title="Delete entry"
                        >
                          {pending ? <Loader size={14} className="spin" /> : <Trash2 size={14} />}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyTime;
