import { useEffect, useState } from 'react';
import { Loader } from 'lucide-react';
import { getCrashAnalysis } from '../services/projectService';
import { useI18n } from '../i18n';
import '../pages/ProjectOptimize.css';

const UNIT_LABEL = { hour: 'h', day: 'd', week: 'w', month: 'mo' };

// Embeddable crashing analysis. Reused by /optimize page and Timeline tab.
// Self-fetches via getCrashAnalysis(projectId). Caller may pass `project` so
// we can render the linear/table mode subline even before analysis arrives.
export default function CrashingAnalysis({ projectId, project = null, refreshKey = 0 }) {
  const { t } = useI18n();
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    getCrashAnalysis(projectId)
      .then((a) => { if (!cancelled) setAnalysis(a); })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || 'Failed to load optimization');
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [projectId, refreshKey]);

  const unit = analysis?.timeUnit || project?.timeUnit || 'day';
  const unitShort = UNIT_LABEL[unit] || 'd';

  if (loading) {
    return (
      <div className="projects-loading">
        <Loader className="spin" size={20} /> <span>{t('opt.computing')}</span>
      </div>
    );
  }
  if (error) return <div className="optimize-error">{error}</div>;
  if (!analysis) return null;

  return (
    <>
      <p className="optimize-blurb">{t('opt.blurb')}</p>

      <table className="synthesis-table">
        <thead>
          <tr>
            <th>{t('opt.col.duration')}</th>
            <th>{t('opt.col.crashCost')}</th>
            <th>{t('opt.col.lostRev')}</th>
            <th>{t('opt.col.total')}</th>
            <th>{t('opt.col.step')}</th>
          </tr>
        </thead>
        <tbody>
          {analysis.rows.map((row, i) => {
            // Backward-looking: step on row i = the crash that brought us
            // here from row i-1. Row 0 is the initial state — no prior step.
            const step = i > 0 && i - 1 < analysis.steps.length ? analysis.steps[i - 1] : null;
            const isOptimal = i === analysis.optimalIndex;
            const taskNames = step
              ? step.tasks.map((tk) => tk.title || tk.id.slice(-6)).join(' + ')
              : '';
            return (
              <tr key={row.duration + '-' + i} className={isOptimal ? 'optimal-row' : ''}>
                <td>
                  {row.duration}{unitShort}
                  {isOptimal ? <span className="badge-optimal">{t('opt.badge.optimum')}</span> : null}
                </td>
                <td>{row.cumulativeCrashCost}</td>
                <td>{row.lostRevenue}</td>
                <td className="total-cell">{row.totalCost}</td>
                <td className="step-cell">
                  {step
                    ? t('opt.step.crash', { tasks: taskNames, cost: step.cost })
                    : i === 0
                      ? <span className="muted">{t('opt.step.start')}</span>
                      : <span className="muted">{t('opt.step.none')}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="optimize-footer">
        <strong>
          {t('opt.footer', {
            dur: analysis.rows[analysis.optimalIndex]?.duration ?? '?',
            unit: unitShort,
            total: analysis.rows[analysis.optimalIndex]?.totalCost ?? '?',
          })}
        </strong>
      </div>
    </>
  );
}
