import type { Language, Translator } from '../../i18n';
import type { RecoverySummary } from '../../utils/recoveryRepository';
import { MenuDivider } from './MenuComponents';

export default function QuickSettingsMenu({
  t,
  buttonClassName,
  open,
  onToggle,
  uiTheme,
  setUiTheme,
  language,
  setLanguage,
  showQuickImageBar,
  setShowQuickImageBar,
  deleteFromLibraryOnImageDelete,
  setDeleteFromLibraryOnImageDelete,
  autoSaveEnabled,
  setAutoSaveEnabled,
  autoSaveInterval,
  setAutoSaveInterval,
  recoveryPoints,
  recoveryError,
  onRestore,
}: {
  t: Translator;
  buttonClassName: string;
  open: boolean;
  onToggle: () => void;
  uiTheme: 'dark' | 'light';
  setUiTheme: (theme: 'dark' | 'light') => void;
  language: Language;
  setLanguage: (language: Language) => void;
  showQuickImageBar: boolean;
  setShowQuickImageBar: (show: boolean) => void;
  deleteFromLibraryOnImageDelete: boolean;
  setDeleteFromLibraryOnImageDelete: (remove: boolean) => void;
  autoSaveEnabled: boolean;
  setAutoSaveEnabled: (enabled: boolean) => void;
  autoSaveInterval: number;
  setAutoSaveInterval: (seconds: number) => void;
  recoveryPoints: RecoverySummary[];
  recoveryError: string | null;
  onRestore: (point: RecoverySummary) => void;
}) {
  return (
    <>
    <div className="relative mr-1.5">
      <button
        onClick={() => onToggle()}
        className={`${buttonClassName} editor-surface-control border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800`}
        title={t('settingsQuick')}
        aria-label={t('settingsQuick')}
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33h0A1.65 1.65 0 0 0 10 3.09V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
    
      {open && (
        <div className="editor-dropdown absolute top-full left-0 mt-2 w-64 max-w-[calc(100vw-2rem)] bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl z-[90] p-2">
          <div className="px-2 pt-1 pb-2">
            <div className="text-[11px] text-neutral-400 uppercase tracking-wide mb-1.5">{t('uiMode')}</div>
            <select
              value={uiTheme}
              onChange={(e) => setUiTheme(e.target.value === 'light' ? 'light' : 'dark')}
              className="editor-input w-full px-2 py-1 text-xs rounded-md bg-neutral-800 text-white border border-neutral-600"
            >
              <option value="dark">{t('dark')}</option>
              <option value="light">{t('light')}</option>
            </select>
          </div>
    
          <MenuDivider />
    
          <div className="px-2 pt-1 pb-2">
            <div className="text-[11px] text-neutral-400 uppercase tracking-wide mb-1.5">{t('language')}</div>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value === 'en' ? 'en' : 'de')}
              className="editor-input w-full px-2 py-1 text-xs rounded-md bg-neutral-800 text-white border border-neutral-600"
            >
              <option value="de">{t('german')}</option>
              <option value="en">{t('english')}</option>
            </select>
          </div>
    
          <MenuDivider />
    
          <div className="px-2 pt-1 pb-2">
            <div className="text-[11px] text-neutral-400 uppercase tracking-wide mb-1.5">{t('assetsSettings')}</div>
            <label className="text-xs text-neutral-400 flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showQuickImageBar}
                onChange={(e) => setShowQuickImageBar(e.target.checked)}
                className="accent-blue-500"
              />
              {t('showAssetBar')}
            </label>
    
            <label className="text-xs text-neutral-400 flex items-center gap-2 cursor-pointer select-none mt-2">
              <input
                type="checkbox"
                checked={deleteFromLibraryOnImageDelete}
                onChange={(e) => setDeleteFromLibraryOnImageDelete(e.target.checked)}
                className="accent-blue-500"
              />
              {t('removeAssetOnDelete')}
            </label>
          </div>
    
          <MenuDivider />
    
          <div className="px-2 pt-1 pb-2">
            <div className="text-[11px] text-neutral-400 uppercase tracking-wide mb-1.5">{t('autoSave')}</div>
            <label className="text-xs text-neutral-400 flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoSaveEnabled}
                onChange={(e) => setAutoSaveEnabled(e.target.checked)}
                className="accent-blue-500"
              />
              {t('autoSaveEnable')}
            </label>
    
            {autoSaveEnabled && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-neutral-500">{t('interval')}</span>
                <select
                  value={autoSaveInterval}
                  onChange={(e) => setAutoSaveInterval(parseInt(e.target.value, 10))}
                  className="editor-input px-2 py-1 text-xs rounded-md bg-neutral-800 text-white border border-neutral-600"
                >
                  <option value={10}>10s</option>
                  <option value={30}>30s</option>
                  <option value={60}>60s</option>
                  <option value={120}>2min</option>
                  <option value={300}>5min</option>
                </select>
              </div>
            )}
    
            <div className="mt-2 pt-2 border-t border-neutral-700/70">
              <div className="text-xs text-neutral-400 mb-1.5">{t('autoSaveHistory')}</div>
              {recoveryPoints.length === 0 ? (
                <div className="text-[11px] text-neutral-500">{t('noRestorePoints')}</div>
              ) : (
                <div className="max-h-36 overflow-auto space-y-1 pr-1">
                  {recoveryPoints.map((point) => (
                    <button
                      key={point.id}
                      onClick={() => void onRestore(point)}
                      className="editor-surface-control w-full px-2 py-1.5 rounded-md border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-left transition-colors cursor-pointer"
                      title={t('restorePoint')}
                    >
                      <div className="text-[11px] text-neutral-200">{new Date(point.createdAt).toLocaleTimeString(language === 'de' ? 'de-DE' : 'en-US')}</div>
                      <div className="text-[10px] text-neutral-500 truncate">{point.projectName} • {point.pageCount} {t('pages')}</div>
                    </button>
                  ))}
                </div>
              )}
              {recoveryError && (
                <div className="mt-1.5 text-[10px] text-red-300 break-words">{recoveryError}</div>
              )}
            </div>
          </div>
    
        </div>
      )}
    </div>
    
      <div className="w-px h-5 bg-neutral-700/80 mx-1" />
    </>
  );
}
