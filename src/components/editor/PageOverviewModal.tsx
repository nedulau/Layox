import { useMemo, useRef, useState } from 'react';
import type { Page } from '../../types';
import { getPageSize, type PageFormat } from '../../domain/pageFormat';
import { useDialogFocus } from '../common/useDialogFocus';
import PageThumbnail from './PageThumbnail';

function PagePreviewCard({ page, assetBlobs, pageIndex, active, onClick, metaLabel, defaultLayoutPadding, defaultLayoutGap, pageFormat }: {
  page: Page; assetBlobs: Record<string, Blob>; pageIndex: number; active: boolean;
  onClick: () => void; noPreviewLabel: string; metaLabel: string;
  defaultLayoutPadding: number; defaultLayoutGap: number; pageFormat?: PageFormat;
}) {
  const size = getPageSize(pageFormat);
  return <button onClick={onClick} className={`w-[220px] overflow-hidden rounded-xl border text-left ${active ? 'border-blue-500' : 'border-neutral-700'}`}>
    <PageThumbnail page={page} assetBlobs={assetBlobs} defaultLayoutPadding={defaultLayoutPadding} defaultLayoutGap={defaultLayoutGap} pageFormat={pageFormat} className="w-full" style={{ aspectRatio: `${size.width} / ${size.height}` }} />
    <div className="border-t border-neutral-700 px-2 py-1.5 text-xs text-neutral-300"><div>{pageIndex + 1}</div><div className="truncate text-neutral-500">{metaLabel}</div></div>
  </button>;
}

export default function PageOverviewModal({
  open,
  pages,
  assetBlobs,
  currentPageIndex,
  onSelectPage,
  onMovePage,
  onClose,
  title,
  closeLabel,
  noPreviewLabel,
  dragToReorderLabel,
  chapterNavLabel,
  searchPlaceholder,
  getMetaLabel,
  defaultLayoutPadding,
  defaultLayoutGap,
  pageFormat,
}: {
  open: boolean;
  pages: Page[];
  assetBlobs: Record<string, Blob>;
  currentPageIndex: number;
  onSelectPage: (index: number) => void;
  onMovePage: (fromIndex: number, toIndex: number) => void;
  onClose: () => void;
  title: string;
  closeLabel: string;
  noPreviewLabel: string;
  dragToReorderLabel: string;
  chapterNavLabel: string;
  searchPlaceholder: string;
  getMetaLabel: (page: Page) => string;
  defaultLayoutPadding: number;
  defaultLayoutGap: number;
  pageFormat?: PageFormat;
}) {
  const [dragFromIndex, setDragFromIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const pointerActiveRef = useRef(false);
  const dialogRef = useDialogFocus<HTMLDivElement>(open, onClose);

  const visibleItems = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    if (!needle) return pages.map((page, index) => ({ page, index }));
    return pages
      .map((page, index) => ({ page, index }))
      .filter(({ page }) => getMetaLabel(page).toLowerCase().includes(needle));
  }, [getMetaLabel, pages, searchTerm]);

  const chapterItems = useMemo(
    () => pages.map((page, index) => ({ pageIndex: index, label: getMetaLabel(page) })),
    [getMetaLabel, pages],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-[1px] flex items-center justify-center px-6 py-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="page-overview-title"
        tabIndex={-1}
        className="editor-dropdown w-[min(96vw,1400px)] h-[min(90vh,860px)] bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-700/80">
          <div>
            <h3 id="page-overview-title" className="text-sm font-semibold text-neutral-100">{title}</h3>
            <div className="text-[11px] text-neutral-400 mt-0.5">{dragToReorderLabel}</div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={searchPlaceholder}
              className="editor-input w-52 px-2 py-1 text-xs rounded-md bg-neutral-800 text-white border border-neutral-600"
            />
            <button
              onClick={onClose}
              className="editor-surface-control px-2.5 py-1 rounded-md border border-neutral-600 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs"
            >
              {closeLabel}
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 flex">
          <aside className="w-56 shrink-0 border-r border-neutral-700/80 p-2 overflow-auto">
            <div className="px-2 py-1 text-[11px] text-neutral-400 uppercase tracking-wide">{chapterNavLabel}</div>
            <div className="space-y-1 mt-1">
              {chapterItems.map((item) => (
                <button
                  key={`chapter-overview-${item.pageIndex}`}
                  onClick={() => {
                    onSelectPage(item.pageIndex);
                    onClose();
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg border text-xs transition-colors cursor-pointer select-none ${
                    item.pageIndex === currentPageIndex
                      ? 'border-blue-500 bg-blue-600/20 text-blue-100'
                      : 'border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100'
                  }`}
                  title={item.label}
                >
                  <span className="mr-1.5 text-neutral-500">{item.pageIndex + 1}.</span>
                  {item.label}
                </button>
              ))}
            </div>
          </aside>

          <div className="flex-1 overflow-auto p-4">
            <div
              className="grid gap-3 justify-center"
              style={{
                gridTemplateColumns: 'repeat(auto-fill, 220px)',
                gridAutoRows: 'min-content',
              }}
            >
              {visibleItems.map(({ page, index }) => (
                <div
                  key={page.id}
                  onPointerDown={(event) => {
                    if (event.button !== 0) return;
                    pointerActiveRef.current = true;
                    setDragFromIndex(index);
                    setDragOverIndex(index);
                    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
                  }}
                  onPointerMove={(event) => {
                    if (!pointerActiveRef.current || dragFromIndex === null) return;
                    const el = document.elementFromPoint(event.clientX, event.clientY);
                    if (!el) return;
                    const card = el.closest<HTMLElement>('[data-page-index]');
                    if (card) {
                      const overIdx = Number(card.dataset.pageIndex);
                      if (!Number.isNaN(overIdx)) setDragOverIndex(overIdx);
                    }
                  }}
                  onPointerUp={() => {
                    if (!pointerActiveRef.current) return;
                    pointerActiveRef.current = false;
                    if (dragFromIndex !== null && dragOverIndex !== null && dragFromIndex !== dragOverIndex) {
                      onMovePage(dragFromIndex, dragOverIndex);
                    }
                    setDragFromIndex(null);
                    setDragOverIndex(null);
                  }}
                  onPointerCancel={() => {
                    pointerActiveRef.current = false;
                    setDragFromIndex(null);
                    setDragOverIndex(null);
                  }}
                  data-page-index={index}
                  style={{ touchAction: 'none' }}
                  className={dragOverIndex === index && dragFromIndex !== null && dragFromIndex !== index ? 'ring-2 ring-blue-500 rounded-xl' : ''}
                >
                  <PagePreviewCard
                    pageFormat={pageFormat}
                    page={page}
                    assetBlobs={assetBlobs}
                    pageIndex={index}
                    active={index === currentPageIndex}
                    noPreviewLabel={noPreviewLabel}
                    metaLabel={getMetaLabel(page)}
                    defaultLayoutPadding={defaultLayoutPadding}
                    defaultLayoutGap={defaultLayoutGap}
                    onClick={() => {
                      onSelectPage(index);
                      onClose();
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

