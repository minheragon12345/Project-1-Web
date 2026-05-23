import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { ArrowLeft, Loader } from 'lucide-react';
import { getProject, getCrashAnalysis } from '../services/projectService';
import { useI18n } from '../i18n';
import LanguageSwitcher from '../components/LanguageSwitcher';
import './ProjectOptimize.css';

const UNIT_LABEL = { hour: 'h', day: 'd', week: 'w', month: 'mo' };

export default function ProjectOptimize() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
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
          <ArrowLeft size={16} /> {t('opt.back')}
        </button>
        <div className="optimize-title-block">
          <h2>{t('opt.heading')}</h2>
          {project ? (
            <span className="optimize-sub">
              {project.name}
              {' · '}
              {analysis?.lostRevenueMode === 'table'
                ? t('opt.modeTable', { n: Object.keys(analysis.lostRevenueByDuration || {}).length })
                : t('opt.modeLinear', { rate: analysis?.lostRevenuePerUnit ?? '?', unit: unitShort })}
            </span>
          ) : null}
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <LanguageSwitcher />
        </div>
      </div>

      {loading ? (
        <div className="projects-loading">
          <Loader className="spin" size={24} /> <span>{t('opt.computing')}</span>
        </div>
      ) : error ? (
        <div className="optimize-error">{error}</div>
      ) : analysis ? (
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
                const step = i < analysis.steps.length ? analysis.steps[i] : null;
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
      ) : null}
    </div>
  );
}
