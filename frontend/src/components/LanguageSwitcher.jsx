import { Languages } from 'lucide-react';
import { useI18n, SUPPORTED_LANGS } from '../i18n';
import './LanguageSwitcher.css';

const LABELS = { en: 'EN', vi: 'VI' };

export default function LanguageSwitcher({ compact = true }) {
  const { lang, setLang } = useI18n();
  return (
    <div className="lang-switcher" role="group" aria-label="Language">
      {compact ? <Languages size={14} className="lang-switcher-icon" aria-hidden="true" /> : null}
      {SUPPORTED_LANGS.map((code) => (
        <button
          key={code}
          type="button"
          className={`lang-switcher-btn ${code === lang ? 'active' : ''}`}
          onClick={() => setLang(code)}
        >
          {LABELS[code] || code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
