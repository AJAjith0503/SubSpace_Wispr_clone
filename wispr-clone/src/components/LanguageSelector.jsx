import { Globe } from 'lucide-react';

const LANGUAGES = [
    { code: 'en', name: 'English', model: 'nova-2' },
    { code: 'hi', name: 'Hindi', model: 'nova-2' },
    { code: 'es', name: 'Spanish', model: 'nova-2' },
    { code: 'fr', name: 'French', model: 'nova-2' },
];

export function LanguageSelector({ selectedLanguage, onLanguageChange, disabled }) {
    return (
        <div className="language-selector">
            <Globe size={18} className="icon" />
            <select
                value={selectedLanguage}
                onChange={(e) => onLanguageChange(e.target.value)}
                disabled={disabled}
            >
                {LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                        {lang.name}
                    </option>
                ))}
            </select>

            <style>{`
        .language-selector {
          display: flex;
          align-items: center;
          gap: 10px;
          background: var(--bg-card);
          padding: 8px 12px;
          border-radius: 8px;
          border: 1px solid var(--glass-border);
          margin-bottom: 20px;
        }
        
        .language-selector .icon {
          color: var(--text-muted);
        }

        select {
          background: transparent;
          color: var(--text-main);
          border: none;
          font-family: inherit;
          font-size: 0.95rem;
          cursor: pointer;
        }

        select:focus {
          outline: none;
        }

        select option {
          background: #1a1a1a; /* Needed for dropdown visibility in dark mode */
          color: white;
        }
      `}</style>
        </div>
    );
}
