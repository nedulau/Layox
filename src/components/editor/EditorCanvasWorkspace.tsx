import type { Translator } from '../../i18n';
import useProjectStore from '../../store/useProjectStore';
import EditorCanvas from '../canvas/EditorCanvas';

export default function EditorCanvasWorkspace({
  t,
  zoomMode,
  manualZoom,
  onDisplayScaleChange,
  onRequestSlotDelete,
}: {
  t: Translator;
  zoomMode: 'fit' | 'manual';
  manualZoom: number;
  onDisplayScaleChange: (scale: number) => void;
  onRequestSlotDelete: (slotIndex: number) => void;
}) {
  const pageCount = useProjectStore((state) => state.project.pages.length);
  const currentPageIndex = useProjectStore((state) => state.currentPageIndex);
  const setCurrentPageIndex = useProjectStore((state) => state.setCurrentPageIndex);
  const snapshot = useProjectStore((state) => state.snapshot);
  const addPage = useProjectStore((state) => state.addPage);

  return (
    <div className="relative z-0 flex-1 min-h-0 flex items-center justify-center overflow-hidden gap-2 px-0 py-2">
      <button
        type="button"
        onClick={() => setCurrentPageIndex(currentPageIndex - 1)}
        disabled={currentPageIndex === 0}
        aria-label={t('pagePrev')}
        className="editor-side-nav shrink-0 w-11 h-11 flex items-center justify-center rounded-2xl border border-neutral-600
                   bg-gradient-to-b from-neutral-800 to-neutral-900 hover:from-neutral-700 hover:to-neutral-800 text-neutral-200 disabled:opacity-25
                   disabled:cursor-not-allowed transition-all shadow-[0_8px_18px_rgba(0,0,0,0.35)] cursor-pointer select-none"
        title={t('pagePrev')}
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 12H6" />
          <path d="M12 18l-6-6 6-6" />
        </svg>
      </button>

      <div className="h-full max-w-full aspect-[4/3] min-w-0">
        <EditorCanvas
          zoomMode={zoomMode}
          manualZoom={manualZoom}
          onDisplayScaleChange={onDisplayScaleChange}
          onRequestSlotDelete={onRequestSlotDelete}
          dropImagesLabel={t('dropImagesHere')}
          imageLabelPrefix={t('imageSlotLabel')}
          editTextPlaceholder={t('editTextPlaceholder')}
          deleteImageLabel={t('imageDelete')}
          coverTitleFallback={t('title')}
          coverSubtitleFallback={t('subtitle')}
          lowResolutionHintText={(percent) => (
            t('lowResolutionHint').replace('{percent}', String(percent))
          )}
        />
      </div>

      {currentPageIndex >= pageCount - 1 ? (
        <button
          type="button"
          onClick={() => {
            snapshot();
            addPage();
          }}
          aria-label={t('pageAdd')}
          className="editor-side-nav shrink-0 w-11 h-11 flex items-center justify-center rounded-xl border border-green-700/50
                     bg-neutral-900 hover:bg-green-900/40 text-green-300
                     transition-all cursor-pointer select-none text-2xl leading-none"
          title={t('pageAdd')}
        >
          +
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setCurrentPageIndex(currentPageIndex + 1)}
          aria-label={t('pageNext')}
          className="editor-side-nav shrink-0 w-11 h-11 flex items-center justify-center rounded-2xl border border-neutral-600
                     bg-gradient-to-b from-neutral-800 to-neutral-900 hover:from-neutral-700 hover:to-neutral-800 text-neutral-200
                     transition-all shadow-[0_8px_18px_rgba(0,0,0,0.35)] cursor-pointer select-none"
          title={t('pageNext')}
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 12h14" />
            <path d="M12 6l6 6-6 6" />
          </svg>
        </button>
      )}
    </div>
  );
}
