import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { ArrowLeft } from 'lucide-react';
import { getProject } from '../services/projectService';
import { useI18n } from '../i18n';
import LanguageSwitcher from '../components/LanguageSwitcher';
import CrashingAnalysis from '../components/CrashingAnalysis';
import './ProjectOptimize.css';

const UNIT_LABEL = { hour: 'h', day: 'd', week: 'w', month: 'mo' };

export default function ProjectOptimize() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [project, setProject] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getProject(id)
      .then((r) => { if (!cancelled) setProject(r?.project || null); })
      .catch((err) => {
        if (!cancelled) toast.error(err.message || 'Failed to load project');
      });
    return () => { cancelled = true; };
  }, [id]);

  const unit = project?.timeUnit || 'day';
  const unitShort = UNIT_LABEL[unit] || 'd';
  const lostRevByDur = project?.lostRevenueByDuration || {};
  const tableEntries = Object.keys(lostRevByDur).length;

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
              {tableEntries > 0
                ? t('opt.modeTable', { n: tableEntries })
                : t('opt.modeLinear', { rate: project?.lostRevenuePerUnit ?? '?', unit: unitShort })}
            </span>
          ) : null}
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <LanguageSwitcher />
        </div>
      </div>

      <CrashingAnalysis projectId={id} project={project} />
    </div>
  );
}
