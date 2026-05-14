import { useCallback, useEffect, useMemo, useState } from 'react';
import { getProjectSchedule } from '../services/projectService';

/**
 * Hook to fetch and cache a project's CPM schedule.
 * Returns { schedule, byTaskId, loading, error, refresh }.
 *
 * schedule shape (from backend):
 *   { projectDuration, timeUnit, criticalPath: [id], tasks: [{ id, ES, LS, totalSlack, freeSlack, isCritical, ... }] }
 *
 * byTaskId is a Map<string, taskScheduleEntry> for quick lookup when decorating cards.
 */
export function useSchedule(projectId, { auto = true } = {}) {
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getProjectSchedule(projectId);
      setSchedule(data);
    } catch (err) {
      setError(err.message || 'Failed to load schedule');
      setSchedule(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (auto && projectId) refresh();
  }, [auto, projectId, refresh]);

  const byTaskId = useMemo(() => {
    const m = new Map();
    if (Array.isArray(schedule?.tasks)) {
      for (const t of schedule.tasks) {
        if (t?.id) m.set(String(t.id), t);
      }
    }
    return m;
  }, [schedule]);

  return { schedule, byTaskId, loading, error, refresh };
}

export default useSchedule;
