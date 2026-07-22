import { useMemo, useRef, useState } from 'react';
import type { Page } from '../../types';
import { computeLayoutSlots } from '../../utils/layouts';
import { CANVAS_H, CANVAS_W } from '../../constants/canvas';
import BlobImage from '../common/BlobImage';
import { useDialogFocus } from '../common/useDialogFocus';

function PagePreviewCard({
  page,
  assetBlobs,
  pageIndex,
  active,
  onClick,
  noPreviewLabel,
  metaLabel,
  defaultLayoutPadding,
  defaultLayoutGap,
}: {
  page: Page;
  assetBlobs: Record<string, Blob>;
  pageIndex: number;
  active: boolean;
  onClick: () => void;
  noPreviewLabel: string;
  metaLabel: string;
  defaultLayoutPadding: number;
  defaultLayoutGap: number;
}) {
  const slots = useMemo(() => {
    if (!page.layoutId) return [];
    const padding = page.layoutPadding ?? defaultLayoutPadding;
    const gap = page.layoutGap ?? defaultLayoutGap;
    return computeLayoutSlots(page.layoutId, padding, gap);
  }, [defaultLayoutGap, defaultLayoutPadding, page.layoutGap, page.layoutId, page.layoutPadding]);

  const hasPreview =
    slots.some((_, slotIndex) => {
      const assignment = page.slotAssignments?.[slotIndex];
      return !!assignment && !!assetBlobs[assignment.assetPath];
    }) ||
    page.elements.some((element) => element.type === 'image' && !!assetBlobs[element.src]);

  return (
    <button
      onClick={onClick}
      className={`group text-left rounded-xl border overflow-hidden transition-colors cursor-pointer select-none ${
        active
          ? 'border-blue-500 bg-blue-500/10'
          : 'border-neutral-700 bg-neutral-900/80 hover:bg-neutral-800/90'
      }`}
      style={{ width: 220 }}
      title={`Page ${pageIndex + 1}`}
    >
      <div
        className="relative bg-neutral-950"
        style={{ width: 220, height: 165 }}
      >
        <div className="absolute inset-0" style={{ background: page.background || '#111111' }} />

        {slots.map((slot, slotIndex) => {
          const assignment = page.slotAssignments?.[slotIndex];
          const blob = assignment ? assetBlobs[assignment.assetPath] : undefined;

          return (
            <div
              key={`${page.id}-slot-${slotIndex}`}
              className="absolute overflow-hidden rounded-[2px] border border-white/15"
              style={{
                left: `${(slot.x / CANVAS_W) * 100}%`,
                top: `${(slot.y / CANVAS_H) * 100}%`,
                width: `${(slot.width / CANVAS_W) * 100}%`,
                height: `${(slot.height / CANVAS_H) * 100}%`,
                background: blob ? '#0f172a' : 'rgba(255,255,255,0.08)',
              }}
            >
              {blob && (
                <BlobImage
                  blob={blob}
                  alt=""
                  className="w-full h-full object-cover"
                  draggable={false}
                />
              )}
            </div>
          );
        })}

        {page.elements
          .slice()
          .sort((firstElement, secondElement) => firstElement.zIndex - secondElement.zIndex)
          .map((element) => {
            if (element.type === 'image') {
              const blob = assetBlobs[element.src];
              if (!blob) return null;
              return (
                <BlobImage
                  key={element.id}
                  blob={blob}
                  alt=""
                  draggable={false}
                  className="absolute object-cover rounded-[2px]"
                  style={{
                    left: `${(element.x / CANVAS_W) * 100}%`,
                    top: `${(element.y / CANVAS_H) * 100}%`,
                    width: `${(element.width / CANVAS_W) * 100}%`,
                    height: `${(element.height / CANVAS_H) * 100}%`,
                    transform: `rotate(${element.rotation}deg)`,
                    transformOrigin: 'top left',
                  }}
                />
              );
            }

            return (
              <div
                key={element.id}
                className="absolute whitespace-nowrap truncate"
                style={{
                  left: `${(element.x / CANVAS_W) * 100}%`,
                  top: `${(element.y / CANVAS_H) * 100}%`,
                  width: `${(((element.width ?? 240) / CANVAS_W) * 100)}%`,
                  color: element.color,
                  fontFamily: element.fontFamily,
                  fontSize: `${Math.max(7, element.fontSize * 0.15)}px`,
                  transform: `rotate(${element.rotation}deg)`,
                  transformOrigin: 'top left',
                }}
              >
                {element.content}
              </div>
            );
          })}

        {!hasPreview && (
          <div className="absolute inset-0 flex items-center justify-center text-[11px] text-neutral-400">
            {noPreviewLabel}
          </div>
        )}
      </div>

      <div className="px-2 py-1.5 text-xs text-neutral-300 border-t border-neutral-700/80">
        <div className="font-medium">{pageIndex + 1}</div>
        <div className="text-[11px] text-neutral-500 truncate mt-0.5">{metaLabel}</div>
      </div>
    </button>
  );
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


