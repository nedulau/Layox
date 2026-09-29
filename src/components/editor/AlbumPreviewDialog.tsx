import { useEffect, useMemo, useRef, useState } from 'react';
import type { Page } from '../../types';
import type { Translator } from '../../i18n';
import type { ProjectExportContext } from '../../utils/exportProject';
import { getPageSize } from '../../domain/pageFormat';
import { buildAlbumSpreads, spreadForPage } from '../../domain/albumSpreads';
import { useDialogFocus } from '../common/useDialogFocus';
import BlobImage from '../common/BlobImage';

function PrintedPage({ page, context, t }: { page: Page; context: ProjectExportContext; t: Translator }) {
  const [rendered, setRendered] = useState<{ page: Page; context: ProjectExportContext; blob?: Blob; error?: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void context.renderer.renderPage(page, context.assets, {
      pageFormat: context.pageFormat,
      mimeType: 'image/png', quality: 1, pixelRatio: 1,
      defaultLayoutPadding: context.defaultLayoutPadding, defaultLayoutGap: context.defaultLayoutGap,
      signal: controller.signal,
    }).then((blob) => {
      if (!controller.signal.aborted) setRendered({ page, context, blob });
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setRendered({ page, context, error: error instanceof Error ? error.message : String(error) });
    });
    return () => controller.abort();
  }, [context, page]);
  const current = rendered?.page === page && rendered.context === context ? rendered : null;
  return current?.blob
    ? <BlobImage blob={current.blob} alt={page.chapterTitle || page.coverTitle || t('pageLabel')} draggable={false} className="h-full w-full object-contain" />
    : <div role={current?.error ? 'alert' : 'status'} className="flex h-full items-center justify-center p-4 text-center text-sm text-neutral-400">{current?.error ? `${t('previewFailed')}: ${current.error}` : t('previewLoading')}</div>;
}

export default function AlbumPreviewDialog({ context, currentPageIndex, t, onClose, onEditPage }: {
  context: ProjectExportContext; currentPageIndex: number; t: Translator; onClose: () => void; onEditPage: (index: number) => void;
}) {
  const spreads = useMemo(() => buildAlbumSpreads(context.pages), [context.pages]);
  const [spreadIndex, setSpreadIndex] = useState(() => spreadForPage(spreads, currentPageIndex));
  const index = Math.max(0, Math.min(spreadIndex, spreads.length - 1));
  const spread = spreads[index] ?? [null, null];
  const dialogRef = useDialogFocus<HTMLDivElement>(true, onClose);
  const viewportRef = useRef<HTMLDivElement>(null);
  const swipeRef = useRef<{ x: number; y: number } | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const measure = () => {
      const rect = element.getBoundingClientRect();
      setViewport({ width: rect.width, height: rect.height });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element); measure();
    return () => observer.disconnect();
  }, []);
  const size = getPageSize(context.pageFormat);
  const width = Math.max(0, Math.min((viewport.width - 8) / 2, (viewport.height - 48) * size.width / size.height));
  const height = width * size.height / size.width;
  const move = (offset: number) => setSpreadIndex(Math.max(0, Math.min(spreads.length - 1, index + offset)));

  return <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/90 p-3" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="album-preview-title" tabIndex={-1} className="editor-dropdown flex h-[94vh] w-[96vw] flex-col rounded-2xl border border-neutral-700 bg-neutral-950 p-4" onKeyDown={(event) => {
      if (event.target instanceof HTMLSelectElement) return;
      if (event.key === 'ArrowLeft' || event.key === 'PageUp') { event.preventDefault(); move(-1); }
      if (event.key === 'ArrowRight' || event.key === 'PageDown') { event.preventDefault(); move(1); }
      if (event.key === 'Home') { event.preventDefault(); setSpreadIndex(0); }
      if (event.key === 'End') { event.preventDefault(); setSpreadIndex(spreads.length - 1); }
    }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 id="album-preview-title" className="text-lg font-semibold text-neutral-100">{t('albumPreview')}</h2><p className="text-xs text-neutral-400">{context.projectName}</p></div>
        <button type="button" onClick={onClose} className="min-h-11 rounded-lg border border-neutral-700 px-4 text-sm text-neutral-200">{t('close')}</button>
      </div>
      <div ref={viewportRef} className="my-3 min-h-0 flex-1" onPointerDown={(event) => { if (event.pointerType !== 'mouse') swipeRef.current = { x: event.clientX, y: event.clientY }; }} onPointerCancel={() => { swipeRef.current = null; }} onPointerUp={(event) => {
        const start = swipeRef.current; swipeRef.current = null;
        if (start) { const dx = event.clientX - start.x; const dy = event.clientY - start.y; if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) move(dx < 0 ? 1 : -1); }
      }} style={{ touchAction: 'pan-y' }}>
        <div className="flex h-full items-center justify-center gap-1">{spread.map((pageIndex, side) => <figure key={side} className="min-w-0" style={{ width }}>
          <div className={pageIndex === null ? 'rounded-sm border border-neutral-800 bg-neutral-900/20' : 'overflow-hidden bg-white shadow-xl'} style={{ width, height }}>
            {pageIndex !== null && <PrintedPage key={context.pages[pageIndex].id} page={context.pages[pageIndex]} context={context} t={t} />}
          </div>
          <figcaption className="h-12 truncate pt-1 text-center text-xs text-neutral-400">{pageIndex !== null && <button type="button" onClick={() => onEditPage(pageIndex)} className="min-h-11 max-w-full truncate px-2" aria-label={`${t('editPreviewPage')} ${pageIndex + 1}`}>
            {t('pageLabel')} {pageIndex + 1}{context.pages[pageIndex].chapterTitle ? ` · ${context.pages[pageIndex].chapterTitle}` : ''}
          </button>}</figcaption>
        </figure>)}</div>
      </div>
      <nav className="flex flex-wrap items-center justify-center gap-3" aria-label={t('previewNavigation')}>
        <button type="button" onClick={() => move(-1)} disabled={index === 0} className="min-h-11 rounded-lg border border-neutral-700 px-4 text-neutral-200 disabled:opacity-30" aria-label={t('previewPrevious')}>←</button>
        <label className="text-xs text-neutral-400">{t('previewSpread')}<select value={index} onChange={(event) => setSpreadIndex(Number(event.target.value))} className="editor-input ml-2 min-h-11 rounded-lg border border-neutral-700 bg-neutral-800 px-3 text-neutral-200">
          {spreads.map((item, i) => <option key={i} value={i}>{item.filter((value) => value !== null).map((value) => value + 1).join('–')}</option>)}
        </select></label>
        <span role="status" aria-live="polite" className="text-sm text-neutral-400">{index + 1} / {spreads.length}</span>
        <button type="button" onClick={() => move(1)} disabled={index === spreads.length - 1} className="min-h-11 rounded-lg border border-neutral-700 px-4 text-neutral-200 disabled:opacity-30" aria-label={t('previewNext')}>→</button>
      </nav>
    </div>
  </div>;
}
