import type { Translator } from '../../i18n';
import type { ExportProgress } from '../../hooks/useEditorExport';
import { useDialogFocus } from '../common/useDialogFocus';

interface ImportProgress {
  completed: number;
  total: number;
}

export default function EditorFeedback({
  t,
  exportJob,
  exportError,
  uiError,
  uiNotice,
  importJob,
  noticeCanUndo,
  onCancelExport,
  onClearExportError,
  onClearUiError,
  onUndoNotice,
  onClearNotice,
}: {
  t: Translator;
  exportJob: ExportProgress | null;
  exportError: string | null;
  uiError: string | null;
  uiNotice: string | null;
  importJob: ImportProgress | null;
  noticeCanUndo: boolean;
  onCancelExport: () => void;
  onClearExportError: () => void;
  onClearUiError: () => void;
  onUndoNotice: () => void;
  onClearNotice: () => void;
}) {
  const exportDialogRef = useDialogFocus<HTMLDivElement>(exportJob !== null, onCancelExport);

  return (
    <>
      {exportJob && (
        <div ref={exportDialogRef} className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70" role="dialog" aria-modal="true" aria-labelledby="layox-export-progress-title" tabIndex={-1}>
          <div className="editor-dropdown w-80 rounded-2xl border border-neutral-700 bg-neutral-900 p-5 shadow-2xl">
            <h3 id="layox-export-progress-title" className="text-base font-semibold text-white">
              {t('exportProgress').replace('{format}', exportJob.label)}
            </h3>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-700">
              <div className="h-full bg-blue-500 transition-[width]" style={{ width: `${exportJob.total > 0 ? (exportJob.completed / exportJob.total) * 100 : 0}%` }} />
            </div>
            <div className="mt-2 text-xs text-neutral-400" aria-live="polite">{exportJob.completed} / {exportJob.total}</div>
            <button type="button" onClick={onCancelExport} className="mt-4 w-full rounded-lg border border-neutral-600 bg-neutral-800 py-2 text-sm text-neutral-200 hover:bg-neutral-700">
              {t('cancel')}
            </button>
          </div>
        </div>
      )}

      {exportError && (
        <div className="fixed bottom-5 left-1/2 z-[140] flex max-w-lg -translate-x-1/2 items-center gap-3 rounded-xl border border-red-700 bg-red-950 px-4 py-3 text-sm text-red-100 shadow-2xl" role="alert">
          <span>{t('exportFailed')}: {exportError}</span>
          <button type="button" onClick={onClearExportError} className="rounded px-2 py-1 hover:bg-red-900" aria-label={t('close')}>×</button>
        </div>
      )}

      {uiError && (
        <div className="fixed bottom-5 left-1/2 z-[140] flex max-w-lg -translate-x-1/2 items-center gap-3 rounded-xl border border-red-700 bg-red-950 px-4 py-3 text-sm text-red-100 shadow-2xl" role="alert">
          <span>{uiError}</span>
          <button type="button" onClick={onClearUiError} className="rounded px-2 py-1 hover:bg-red-900" aria-label={t('close')}>×</button>
        </div>
      )}

      {(uiNotice || importJob) && (
        <div className="fixed bottom-5 left-1/2 z-[140] flex max-w-lg -translate-x-1/2 items-center gap-3 rounded-xl border border-blue-700 bg-blue-950 px-4 py-3 text-sm text-blue-100 shadow-2xl" role="status" aria-live="polite">
          <span>{importJob ? `${t('importingImages')} ${importJob.completed} / ${importJob.total}` : uiNotice}</span>
          {!importJob && noticeCanUndo && (
            <button type="button" onClick={onUndoNotice} className="min-h-9 rounded-lg bg-blue-800 px-3 font-medium hover:bg-blue-700">{t('undo')}</button>
          )}
          {!importJob && (
            <button type="button" onClick={onClearNotice} className="rounded px-2 py-1 hover:bg-blue-900" aria-label={t('close')}>×</button>
          )}
        </div>
      )}
    </>
  );
}
