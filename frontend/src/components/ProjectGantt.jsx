import { useEffect, useMemo, useRef, useState } from 'react';
import Gantt from 'frappe-gantt';
// frappe-gantt's package.json exports only `.` — the dist CSS isn't a separately
// exported subpath, so we ship a vendored copy alongside this component.
import './frappe-gantt.css';
import './ProjectGantt.css';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const UNIT_TO_MS = {
  hour: 60 * 60 * 1000,
  day: MS_PER_DAY,
  week: 7 * MS_PER_DAY,
  month: 30 * MS_PER_DAY, // approximation, fine for visual layout
};

function unitMs(unit) {
  return UNIT_TO_MS[unit] || MS_PER_DAY;
}

function addUnits(date, n, unit) {
  return new Date(date.getTime() + n * unitMs(unit));
}

function formatYMD(date) {
  // YYYY-MM-DD in local time
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Wraps frappe-gantt around the schedule produced by useSchedule.
 *
 * Props:
 *   schedule: { projectDuration, timeUnit, criticalPath, tasks } (from /schedule endpoint)
 *   projectStart: Date | string (origin for ES=0); defaults to today
 *   viewMode: 'Earliest' | 'Latest' — which start to anchor bars on
 *   ganttViewMode: frappe-gantt view_mode string (Day/Week/Month/Year/Quarter Day/Half Day)
 *   onTaskClick: (taskId) => void
 */
export default function ProjectGantt({
  schedule,
  projectStart,
  viewMode = 'Earliest',
  ganttViewMode = 'Day',
  onTaskClick,
}) {
  const containerRef = useRef(null);
  const ganttRef = useRef(null);

  const origin = useMemo(() => {
    if (!projectStart) return new Date(new Date().setHours(0, 0, 0, 0));
    const d = new Date(projectStart);
    if (Number.isNaN(d.getTime())) return new Date(new Date().setHours(0, 0, 0, 0));
    d.setHours(0, 0, 0, 0);
    return d;
  }, [projectStart]);

  const ganttTasks = useMemo(() => {
    if (!schedule || !Array.isArray(schedule.tasks) || schedule.tasks.length === 0) {
      return [];
    }
    const unit = schedule.timeUnit || 'day';
    const useLatest = viewMode === 'Latest';
    const criticalSet = new Set((schedule.criticalPath || []).map(String));

    return schedule.tasks.map((t) => {
      const startOffset = useLatest ? t.LS : t.ES;
      const endOffset = startOffset + (Number(t.duration) || 0);
      const startDate = addUnits(origin, startOffset, unit);
      // frappe-gantt v1.2.x treats `end` as the day AFTER the last day for Day mode.
      // Add 1 day so a 1-day task renders as a single bar, not a hairline.
      const endDate = endOffset === startOffset
        ? addUnits(startDate, 1, 'day')
        : addUnits(origin, endOffset, unit);

      return {
        id: String(t.id),
        name: t.title || '(untitled)',
        start: formatYMD(startDate),
        end: formatYMD(endDate),
        progress: 0,
        dependencies: (t.dependencies || []).map(String).join(','),
        custom_class: criticalSet.has(String(t.id)) ? 'gantt-critical' : '',
      };
    });
  }, [schedule, origin, viewMode]);

  useEffect(() => {
    if (!containerRef.current) return;
    // Wipe any prior render — frappe-gantt mutates the container's innerHTML.
    containerRef.current.innerHTML = '';

    if (ganttTasks.length === 0) {
      ganttRef.current = null;
      return;
    }

    try {
      ganttRef.current = new Gantt(containerRef.current, ganttTasks, {
        view_mode: ganttViewMode,
        bar_height: 22,
        padding: 16,
        on_click: (task) => {
          if (onTaskClick) onTaskClick(task.id);
        },
      });
    } catch (err) {
      console.error('frappe-gantt init failed:', err);
      ganttRef.current = null;
    }

    return () => {
      if (containerRef.current) containerRef.current.innerHTML = '';
      ganttRef.current = null;
    };
  }, [ganttTasks, ganttViewMode, onTaskClick]);

  return <div ref={containerRef} className="project-gantt-container" />;
}
