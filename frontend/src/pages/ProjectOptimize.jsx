import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { ArrowLeft, Loader } from 'lucide-react';
import { getProject, getCrashAnalysis } from '../services/projectService';
import './ProjectOptimize.css';

const UNIT_LABEL = { hour: 'h', day: 'd', week: 'w', month: 'mo' };

export default function ProjectOptimize() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      getProject(id).then((r) => r?.project || null),
      getCrashAnalysis(id),
    ])
      .then(([p, a]) => {
        if (cancelled) return;
        setProject(p);
        setAnalysis(a);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || 'Failed to load optimization');
        toast.error(err.message || 'Failed to load optimization');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const unit = analysis?.timeUnit || project?.timeUnit || 'day';
  const unitShort = UNIT_LABEL[unit] || 'd';

  return (
    <div className="project-optimize-container">
      <div className="optimize-header">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => navigate(`/projects/${id}`)}
        >
          <ArrowLeft size={16} /> Back to project
        </button>
        <div className="optimize-title-block">
          <h2>Crashing analysis</h2>
          {project ? (
            <span className="optimize-sub">
              {project.name}
              {' · '}
              {analysis?.lostRevenueMode === 'table' ? (
                <>lost revenue via lookup table ({Object.keys(analysis.lostRevenueByDuration || {}).length} entries)</>
              ) : (
                <>lost revenue {analysis?.lostRevenuePerUnit ?? '?'} / {unitShort} (linear)</>
              )}
            </span>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="projects-loading">
          <Loader className="spin" size={24} /> <span>Computing…</span>
        </div>
      ) : error ? (
        <div className="optimize-error">{error}</div>
      ) : analysis ? (
        <>
          <p className="optimize-blurb">
            Iteratively crashes the critical path one unit at a time, picking the cheapest
            crashable task (or the cheapest cover when multiple paths are simultaneously
            critical). The optimal duration is the row with the lowest total cost.
          </p>

          <table className="synthesis-table">
            <thead>
              <tr>
                <th>Duration</th>
                <th>Cumulative crash cost</th>
                <th>Lost revenue</th>
                <th>Total cost</th>
                <th>Step</th>
              </tr>
            </thead>
            <tbody>
              {analysis.rows.map((row, i) => {
                const step = i < analysis.steps.length ? analysis.steps[i] : null;
                const isOptimal = i === analysis.optimalIndex;
                return (
                  <tr key={row.duration + '-' + i} className={isOptimal ? 'optimal-row' : ''}>
                    <td>
                      {row.duration}{unitShort}
                      {isOptimal ? <span className="badge-optimal">optimum</span> : null}
                    </td>
                    <td>{row.cumulativeCrashCost}</td>
                    <td>{row.lostRevenue}</td>
                    <td className="total-cell">{row.totalCost}</td>
                    <td className="step-cell">
                      {step ? (
                        <>
                          Crash{' '}
                          {step.tasks.map((t, j) => (
                            <span key={t.id}>
                              <strong>{t.title || t.id.slice(-6)}</strong>
                              {j < step.tasks.length - 1 ? ' + ' : ''}
                            </span>
                          ))}{' '}
                          (cost {step.cost})
                        </>
                      ) : (
                        <span className="muted">no further crash possible</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="optimize-footer">
            <strong>Optimal duration: {analysis.rows[analysis.optimalIndex]?.duration}{unitShort}</strong>
            {' · '}
            <span>Total cost: {analysis.rows[analysis.optimalIndex]?.totalCost}</span>
          </div>
        </>
      ) : null}
    </div>
  );
}
