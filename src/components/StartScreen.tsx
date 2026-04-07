import { useRef, useState } from 'react';
import useProjectStore from '../store/useProjectStore';
import { getHandle } from '../utils/handleStore';
import NewProjectModal from './NewProjectModal';
import { tr, type Language } from '../i18n';
import { getFileSystemPort } from '../infra/fileSystem';
import type { RecentProject } from '../store/useProjectStore';

type UiTheme = 'dark' | 'light';

type StartScreenProps = {
  uiTheme: UiTheme;
  setUiTheme: (theme: UiTheme) => void;
  language: Language;
  setLanguage: (language: Language) => void;
};

function StartScreen({ uiTheme, setUiTheme, language, setLanguage }: StartScreenProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const t = (key: string) => tr(language, key);

  const resetProject = useProjectStore((s) => s.resetProject);
  const openProject = useProjectStore((s) => s.openProject);
  const openRecentProjectByPath = useProjectStore((s) => s.openRecentProjectByPath);
  const loadFromFile = useProjectStore((s) => s.loadFromFile);
  const recentProjects = useProjectStore((s) => s.recentProjects);

  const hasFileSystemAccess = getFileSystemPort().supportsNativePicker();

  const handleNewProject = () => {
    setShowNewProjectModal(true);
  };

  const handleOpen = async () => {
    if (hasFileSystemAccess) {
      try {
        await openProject();
      } catch (err) {
        console.error(t('openError'), err);
        alert(`${t('openError')}: ${err instanceof Error ? err.message : err}`);
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await loadFromFile(file);
    } catch (err) {
      console.error(t('loadError'), err);
      alert(`${t('loadError')}: ${err instanceof Error ? err.message : err}`);
    }
    e.target.value = '';
  };

  // Double-click on a recent project: try to re-open from stored handle, fall back to file picker
  const handleRecentDoubleClick = async (recentProject: RecentProject) => {
    if (recentProject.filePath) {
      const opened = await openRecentProjectByPath(recentProject.filePath);
      if (opened) return;
    }

    try {
      const handle = await getHandle(recentProject.fileName);
      if (handle) {
        // Request permission (needed after page reload)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const perm = await (handle as any).requestPermission?.({ mode: 'readwrite' });
        if (perm === 'granted' || perm === undefined) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const file = await (handle as any).getFile();
          await loadFromFile(file, handle as any);
          return;
        }
      }
    } catch {
      // IndexedDB or permission error — fall through to open dialog
    }
    await handleOpen();
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="app-ui start-ui w-screen h-screen flex items-center justify-center" data-ui-theme={uiTheme}>
      <div className="flex flex-col items-center gap-8 max-w-lg w-full px-6">
        <div className="w-full flex items-center justify-end gap-2">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value === 'en' ? 'en' : 'de')}
            className="editor-input px-2 py-1 text-xs rounded-md bg-neutral-800 text-white border border-neutral-600"
            title={t('language')}
          >
            <option value="de">{t('german')}</option>
            <option value="en">{t('english')}</option>
          </select>
          <select
            value={uiTheme}
            onChange={(e) => setUiTheme(e.target.value === 'light' ? 'light' : 'dark')}
            className="editor-input px-2 py-1 text-xs rounded-md bg-neutral-800 text-white border border-neutral-600"
            title={t('uiMode')}
          >
            <option value="dark">{t('dark')}</option>
            <option value="light">{t('light')}</option>
          </select>
        </div>

        {/* Logo / Title */}
        <div className="text-center">
          <h1 className="text-5xl font-bold start-title tracking-tight">Layox</h1>
          <p className="start-subtitle mt-2 text-sm">
            {t('startSubtitle')}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleNewProject}
            className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium
                       transition-colors cursor-pointer select-none"
          >
            {t('newProject')}
          </button>
          <button
            onClick={handleOpen}
            className="start-open-btn px-5 py-2.5 rounded-lg bg-neutral-700 hover:bg-neutral-600 text-white font-medium
                       transition-colors cursor-pointer select-none"
          >
            {t('openProject')}
          </button>
        </div>

        {/* Recent projects */}
        {recentProjects.length > 0 && (
          <div className="w-full">
            <h2 className="text-sm start-recent-title font-medium mb-2 uppercase tracking-wider">
              {t('recentOpened')}
            </h2>
            <div className="flex flex-col gap-1">
              {recentProjects.map((rp, i) => (
                <div
                  key={`${rp.fileName}-${i}`}
                  onDoubleClick={() => handleRecentDoubleClick(rp)}
                  className="flex items-center justify-between px-4 py-2.5 rounded-lg
                             start-recent-item bg-neutral-800/60 hover:bg-neutral-700/80 transition-colors
                             cursor-pointer select-none"
                  title={t('doubleClickOpen')}
                >
                  <div className="flex flex-col min-w-0">
                    <span className="start-recent-name text-sm font-medium truncate">
                      {rp.name}
                    </span>
                    <span className="text-neutral-500 text-xs truncate">
                      {rp.filePath ?? rp.fileName}
                    </span>
                  </div>
                  <span className="text-neutral-600 text-xs shrink-0 ml-4">
                    {formatDate(rp.lastOpened)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Hidden file input for browsers without File System Access */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".layox"
          className="hidden"
          onChange={handleFileSelected}
        />
      </div>

      <NewProjectModal
        open={showNewProjectModal}
        onClose={() => setShowNewProjectModal(false)}
        title={t('newProject')}
        description={t('enterProjectName')}
        cancelLabel={t('cancel')}
        confirmLabel={t('create')}
        placeholder={t('projectNamePlaceholder')}
        onConfirm={(name) => {
          resetProject(name);
          setShowNewProjectModal(false);
        }}
      />
    </div>
  );
}

export default StartScreen;
