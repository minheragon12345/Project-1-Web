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
      const dur = Number(t.duration) || 0;
      const endOffset = startOffset + dur;
      const startDate = addUnits(origin, startOffset, unit);
      // frappe-gantt v1.2.x treats `end` as the INCLUSIVE last day of the bar
      // in Day view: a task with start=2026-05-23 and end=2026-05-26 fills
      // 4 cells (23, 24, 25, 26). So we point `end` at the last working unit:
      //   startOffset + duration − 1 unit
      // and then back off by 1 day to make sure cross-unit math still lands
      // on the right rendered cell. For 0-duration tasks we collapse end to
      // start so frappe-gantt draws a single-cell bar.
      let endDate;
      if (dur <= 0) {
        endDate = startDate;
      } else {
        endDate = new Date(addUnits(origin, endOffset, unit).getTime() - MS_PER_DAY);
      }

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
