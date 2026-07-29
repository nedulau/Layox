import { useEffect, useRef, useState } from 'react';
import useProjectStore from '../store/useProjectStore';
import { getHandle } from '../utils/handleStore';
import NewProjectModal from './NewProjectModal';
import { tr, type Language, type TranslationKey } from '../i18n';
import { getFileSystemPort } from '../infra/fileSystem';
import type { RecentProject } from '../store/useProjectStore';
import type { FileSystemFileHandleExt } from '../types';
import { recoveryRepository, type RecoverySummary } from '../utils/recoveryRepository';
import ConfirmDialog from './common/ConfirmDialog';

type PermissionAwareFileHandle = FileSystemFileHandleExt & {
  requestPermission?: (options: { mode: 'readwrite' }) => Promise<PermissionState>;
};

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
  const [recoveryPoints, setRecoveryPoints] = useState<RecoverySummary[]>([]);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [uiError, setUiError] = useState<string | null>(null);
  const [unavailableRecents, setUnavailableRecents] = useState<Set<string>>(() => new Set());
  const [deleteRecoveryPoint, setDeleteRecoveryPoint] = useState<RecoverySummary | null>(null);
  const t = (key: TranslationKey) => tr(language, key);

  const resetProject = useProjectStore((state) => state.resetProject);
  const openProject = useProjectStore((state) => state.openProject);
  const openRecentProjectByPath = useProjectStore((state) => state.openRecentProjectByPath);
  const loadFromFile = useProjectStore((state) => state.loadFromFile);
  const recentProjects = useProjectStore((state) => state.recentProjects);
  const removeRecentProject = useProjectStore((state) => state.removeRecentProject);
  const restoreRecoveredProject = useProjectStore((state) => state.restoreRecoveredProject);

  const hasFileSystemAccess = getFileSystemPort().supportsNativePicker();

  const refreshRecovery = async () => {
    try {
      setRecoveryPoints((await recoveryRepository.list()).slice(0, 8));
      setRecoveryError(null);
    } catch (error) {
      setRecoveryError(error instanceof Error ? error.message : String(error));
    }
  };

  useEffect(() => {
    let active = true;
    void recoveryRepository.list()
      .then((points) => {
        if (!active) return;
        setRecoveryPoints(points.slice(0, 8));
        setRecoveryError(null);
      })
      .catch((error) => {
        if (!active) return;
        setRecoveryError(error instanceof Error ? error.message : String(error));
      });
    return () => {
      active = false;
    };
  }, []);

  const recentKey = (recentProject: RecentProject) => recentProject.filePath ?? recentProject.fileName;

  const handleOpen = async () => {
    if (hasFileSystemAccess) {
      try {
        await openProject();
      } catch (error) {
        setUiError(`${t('openError')}: ${error instanceof Error ? error.message : error}`);
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      await loadFromFile(file);
    } catch (error) {
      setUiError(`${t('loadError')}: ${error instanceof Error ? error.message : error}`);
    }
    event.target.value = '';
  };

  const handleRecentOpen = async (recentProject: RecentProject) => {
    const key = recentKey(recentProject);
    if (recentProject.filePath) {
      const opened = await openRecentProjectByPath(recentProject.filePath);
      if (opened) return;
      setUnavailableRecents((current) => new Set(current).add(key));
    }

    try {
      const handle = await getHandle(recentProject.fileName);
      if (handle) {
        const permissionHandle = handle as unknown as PermissionAwareFileHandle;
        const permission = await permissionHandle.requestPermission?.({ mode: 'readwrite' });
        if (permission === 'granted' || permission === undefined) {
          const file = await permissionHandle.getFile();
          await loadFromFile(file, { kind: 'web-handle', handle: permissionHandle });
          return;
        }
      }
    } catch {
      setUnavailableRecents((current) => new Set(current).add(key));
    }
    await handleOpen();
  };

  const formatDate = (timestamp: number) => new Date(timestamp).toLocaleDateString(
    language === 'de' ? 'de-DE' : 'en-US',
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    },
  );

  const handleRecovery = async (point: RecoverySummary) => {
    try {
      const recovered = await recoveryRepository.restore(point.id);
      restoreRecoveredProject(recovered.project, recovered.assetBlobs, recovered.pageIndex);
    } catch (error) {
      setRecoveryError(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <div className="app-ui start-ui w-screen h-screen flex items-center justify-center" data-ui-theme={uiTheme}>
      <div className="flex flex-col items-center gap-8 max-w-lg w-full px-6">
        <div className="w-full flex items-center justify-end gap-2">
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value === 'en' ? 'en' : 'de')}
            className="editor-input px-2 py-1 text-xs rounded-md bg-neutral-800 text-white border border-neutral-600"
            title={t('language')}
          >
            <option value="de">{t('german')}</option>
            <option value="en">{t('english')}</option>
          </select>
          <select
            value={uiTheme}
            onChange={(event) => setUiTheme(event.target.value === 'light' ? 'light' : 'dark')}
            className="editor-input px-2 py-1 text-xs rounded-md bg-neutral-800 text-white border border-neutral-600"
            title={t('uiMode')}
          >
            <option value="dark">{t('dark')}</option>
            <option value="light">{t('light')}</option>
          </select>
        </div>

        <div className="text-center">
          <h1 className="text-5xl font-bold start-title tracking-tight">Layox</h1>
          <p className="start-subtitle mt-2 text-sm">{t('startSubtitle')}</p>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setShowNewProjectModal(true)}
            className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium
                       transition-colors cursor-pointer select-none"
          >
            {t('newProject')}
          </button>
          <button
            type="button"
            onClick={() => void handleOpen()}
            className="start-open-btn px-5 py-2.5 rounded-lg bg-neutral-700 hover:bg-neutral-600 text-white font-medium
                       transition-colors cursor-pointer select-none"
          >
            {t('openProject')}
          </button>
        </div>

        {recoveryPoints.length > 0 && (
          <div className="w-full">
            <h2 className="text-sm start-recent-title font-medium mb-2 uppercase tracking-wider">
              {t('recovery')}
            </h2>
            <div className="flex flex-col gap-1">
              {recoveryPoints.map((point) => (
                <div
                  key={point.id}
                  className="w-full flex items-center rounded-lg start-recent-item bg-neutral-800/60 hover:bg-neutral-700/80 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => void handleRecovery(point)}
                    className="min-w-0 flex-1 flex items-center justify-between px-4 py-2.5 text-left cursor-pointer select-none"
                  >
                    <span className="flex flex-col min-w-0">
                      <span className="start-recent-name text-sm font-medium truncate">{point.projectName}</span>
                      <span className="text-neutral-500 text-xs">
                        {point.pageCount} {t('pages')} · {t('restore')}
                      </span>
                    </span>
                    <span className="text-neutral-600 text-xs shrink-0 ml-4">{formatDate(point.createdAt)}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteRecoveryPoint(point)}
                    className="min-h-11 min-w-11 text-neutral-500 hover:text-red-300"
                    aria-label={t('deleteRecovery')}
                    title={t('deleteRecovery')}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {recoveryError && (
          <div className="w-full rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-xs text-red-200">
            {recoveryError}
          </div>
        )}

        {uiError && (
          <div className="w-full rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-xs text-red-200" role="alert">
            {uiError}
          </div>
        )}

        {recentProjects.length > 0 && (
          <div className="w-full">
            <h2 className="text-sm start-recent-title font-medium mb-2 uppercase tracking-wider">
              {t('recentOpened')}
            </h2>
            <div className="flex flex-col gap-1">
              {recentProjects.map((recentProject) => {
                const unavailable = unavailableRecents.has(recentKey(recentProject));
                return (
                  <div
                    key={recentKey(recentProject)}
                    className="w-full flex items-center rounded-lg start-recent-item bg-neutral-800/60 hover:bg-neutral-700/80 transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => void handleRecentOpen(recentProject)}
                      className="min-w-0 flex-1 flex items-center justify-between px-4 py-2.5 text-left cursor-pointer select-none"
                    >
                      <span className="flex flex-col min-w-0">
                        <span className="start-recent-name text-sm font-medium truncate">{recentProject.name}</span>
                        <span className={`text-xs truncate ${unavailable ? 'text-amber-300' : 'text-neutral-500'}`}>
                          {unavailable ? t('fileUnavailable') : (recentProject.filePath ?? recentProject.fileName)}
                        </span>
                      </span>
                      <span className="text-neutral-600 text-xs shrink-0 ml-4">
                        {formatDate(recentProject.lastOpened)}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeRecentProject(recentProject.fileName, recentProject.filePath)}
                      className="min-h-11 min-w-11 text-neutral-500 hover:text-red-300"
                      aria-label={t('removeRecent')}
                      title={t('removeRecent')}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

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

      <ConfirmDialog
        open={deleteRecoveryPoint !== null}
        title={t('deleteRecovery')}
        message={t('deleteRecoveryConfirm')}
        cancelLabel={t('cancel')}
        confirmLabel={t('delete')}
        danger
        onCancel={() => setDeleteRecoveryPoint(null)}
        onConfirm={() => {
          const point = deleteRecoveryPoint;
          setDeleteRecoveryPoint(null);
          if (!point) return;
          void recoveryRepository.remove(point.id)
            .then(refreshRecovery)
            .catch((error) => setRecoveryError(error instanceof Error ? error.message : String(error)));
        }}
      />
    </div>
  );
}

export default StartScreen;
