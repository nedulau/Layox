import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useProjectStore from '../store/useProjectStore';
import { getHandle } from '../utils/handleStore';
import NewProjectModal from './NewProjectModal';
import { tr, type Language, type TranslationKey } from '../i18n';
import { getFileSystemPort } from '../infra/fileSystem';
import type { RecentProject } from '../store/useProjectStore';
import type { FileSystemFileHandleExt } from '../types';
import { recoveryRepository, type RecoverySummary } from '../utils/recoveryRepository';
import ConfirmDialog from './common/ConfirmDialog';
import RecoveryPreview from './editor/RecoveryPreview';

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
  const t = useCallback((key: TranslationKey) => tr(language, key), [language]);

  const resetProject = useProjectStore((state) => state.resetProject);
  const openProject = useProjectStore((state) => state.openProject);
  const openRecentProjectByPath = useProjectStore((state) => state.openRecentProjectByPath);
  const loadFromFile = useProjectStore((state) => state.loadFromFile);
  const recentProjects = useProjectStore((state) => state.recentProjects);
  const removeRecentProject = useProjectStore((state) => state.removeRecentProject);
  const restoreRecoveredProject = useProjectStore((state) => state.restoreRecoveredProject);

  const hasFileSystemAccess = getFileSystemPort().supportsNativePicker();

  const refreshRecovery = useCallback(async () => {
    try {
      setRecoveryPoints(await recoveryRepository.list());
      setRecoveryError(null);
    } catch (error) {
      setRecoveryError(error instanceof Error ? error.message : String(error));
    }
  }, []);

  useEffect(() => {
    let active = true;
    void recoveryRepository.list()
      .then((points) => {
        if (!active) return;
        setRecoveryPoints(points);
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

  const recoveryGroups = useMemo(() => {
    const groups = new Map<string, RecoverySummary[]>();
    for (const point of recoveryPoints) {
      const current = groups.get(point.projectId) ?? [];
      current.push(point);
      groups.set(point.projectId, current);
    }
    return [...groups.values()].sort((first, second) => second[0].createdAt - first[0].createdAt);
  }, [recoveryPoints]);

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

  const latestRecent = recentProjects[0];

  return (
    <div className="app-ui start-ui h-screen w-screen overflow-y-auto" data-ui-theme={uiTheme}>
      <main className="mx-auto flex min-h-full w-full max-w-6xl flex-col px-5 py-6 md:px-8">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="start-title text-3xl font-bold tracking-tight">Layox</h1>
            <p className="start-subtitle mt-1 text-sm">{t('startSubtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value === 'en' ? 'en' : 'de')}
              className="editor-input min-h-11 rounded-lg border border-neutral-600 bg-neutral-800 px-3 text-xs text-white"
              aria-label={t('language')}
            >
              <option value="de">{t('german')}</option>
              <option value="en">{t('english')}</option>
            </select>
            <select
              value={uiTheme}
              onChange={(event) => setUiTheme(event.target.value === 'light' ? 'light' : 'dark')}
              className="editor-input min-h-11 rounded-lg border border-neutral-600 bg-neutral-800 px-3 text-xs text-white"
              aria-label={t('uiMode')}
            >
              <option value="dark">{t('dark')}</option>
              <option value="light">{t('light')}</option>
            </select>
          </div>
        </header>

        <section className="mt-8 rounded-3xl border border-neutral-800 bg-neutral-900/70 p-6 shadow-xl md:flex md:items-center md:justify-between md:gap-8">
          <div>
            <h2 className="start-title text-2xl font-semibold">{t('projectDashboard')}</h2>
            <p className="start-subtitle mt-2 max-w-xl text-sm leading-6">{t('recentProjectsDescription')}</p>
          </div>
          <div className="mt-5 flex flex-wrap gap-3 md:mt-0">
            {latestRecent && (
              <button
                type="button"
                onClick={() => void handleRecentOpen(latestRecent)}
                className="min-h-12 rounded-xl bg-blue-600 px-5 font-semibold text-white hover:bg-blue-500"
              >
                {t('continueEditing')}
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowNewProjectModal(true)}
              className="min-h-12 rounded-xl bg-blue-600 px-5 font-semibold text-white hover:bg-blue-500"
            >
              {t('newProject')}
            </button>
            <button
              type="button"
              onClick={() => void handleOpen()}
              className="start-open-btn min-h-12 rounded-xl bg-neutral-700 px-5 font-semibold text-white hover:bg-neutral-600"
            >
              {t('openProject')}
            </button>
          </div>
        </section>

        {(uiError || recoveryError) && (
          <div className="mt-5 rounded-xl border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-200" role="alert">
            {uiError ?? recoveryError}
          </div>
        )}

        <div className="mt-8 grid flex-1 gap-8 lg:grid-cols-[1fr_1.1fr]">
          <section>
            <h2 className="start-recent-title text-xs font-semibold uppercase tracking-wider">{t('recentOpened')}</h2>
            <div className="mt-3 space-y-2">
              {recentProjects.length === 0 ? (
                <div className="rounded-xl border border-dashed border-neutral-700 p-6 text-sm text-neutral-500">
                  {t('recentProjectsDescription')}
                </div>
              ) : recentProjects.map((recentProject) => {
                const unavailable = unavailableRecents.has(recentKey(recentProject));
                return (
                  <article key={recentKey(recentProject)} className="start-recent-item rounded-xl border border-neutral-800 bg-neutral-900/70 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <button type="button" onClick={() => void handleRecentOpen(recentProject)} className="min-w-0 flex-1 text-left">
                        <div className="start-recent-name truncate text-sm font-semibold">{recentProject.name}</div>
                        <div className="mt-1 truncate text-xs text-neutral-500">{recentProject.filePath ?? recentProject.fileName}</div>
                        <div className="mt-2 text-[11px] text-neutral-600">{formatDate(recentProject.lastOpened)}</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeRecentProject(recentProject.fileName, recentProject.filePath)}
                        className="min-h-11 min-w-11 rounded-lg text-neutral-500 hover:bg-neutral-800 hover:text-red-300"
                        aria-label={t('removeRecent')}
                        title={t('removeRecent')}
                      >
                        ×
                      </button>
                    </div>
                    {unavailable && (
                      <button type="button" onClick={() => void handleOpen()} className="mt-3 w-full rounded-lg border border-amber-800 bg-amber-950/30 px-3 py-2 text-left text-xs text-amber-200">
                        <span className="block">{t('fileUnavailable')}</span>
                        <span className="mt-1 block font-semibold">{t('chooseFileAgain')}</span>
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          </section>

          <section>
            <h2 className="start-recent-title text-xs font-semibold uppercase tracking-wider">{t('recovery')}</h2>
            <p className="mt-2 text-xs text-neutral-500">{t('recoveryDescription')}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {recoveryGroups.length === 0 ? (
                <div className="col-span-full rounded-xl border border-dashed border-neutral-700 p-6 text-sm text-neutral-500">
                  {t('noRestorePoints')}
                </div>
              ) : recoveryGroups.map((points) => {
                const latest = points[0];
                return (
                  <article key={latest.projectId} className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/70">
                    <button type="button" onClick={() => void handleRecovery(latest)} className="block w-full text-left">
                      <RecoveryPreview snapshotId={latest.id} />
                      <div className="p-3">
                        <div className="start-recent-name truncate text-sm font-semibold">{latest.projectName}</div>
                        <div className="mt-1 text-xs text-neutral-500">
                          {t('recoverySnapshots').replace('{count}', String(points.length))} · {latest.pageCount} {t('pages')}
                        </div>
                        <div className="mt-1 text-[11px] text-neutral-600">{formatDate(latest.createdAt)}</div>
                        <div className="mt-2 text-[10px] text-blue-300">{t('recoveredCopy')}</div>
                      </div>
                    </button>
                    <details className="border-t border-neutral-800">
                      <summary className="cursor-pointer px-3 py-2 text-xs text-neutral-400">{t('recoverySnapshots').replace('{count}', String(points.length))}</summary>
                      <div className="space-y-1 px-2 pb-2">
                        {points.map((point) => (
                          <div key={point.id} className="flex items-center gap-1 rounded-lg bg-neutral-950/50 p-1">
                            <button type="button" onClick={() => void handleRecovery(point)} className="min-h-10 min-w-0 flex-1 rounded px-2 text-left text-[11px] text-neutral-300 hover:bg-neutral-800">
                              {formatDate(point.createdAt)} · {point.pageIndex + 1}/{point.pageCount}
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteRecoveryPoint(point)}
                              className="min-h-10 min-w-10 rounded text-red-300 hover:bg-red-950"
                              aria-label={t('deleteRecovery')}
                              title={t('deleteRecovery')}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </details>
                  </article>
                );
              })}
            </div>
          </section>
        </div>

        <input ref={fileInputRef} type="file" accept=".layox" className="hidden" onChange={handleFileSelected} />
      </main>

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
