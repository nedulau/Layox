import { useState } from 'react';
import type { Translator } from '../../i18n';
import type { Page } from '../../types';
import PageThumbnail from './PageThumbnail';

export default function PageFilmstrip({
  t,
  pages,
  assetBlobs,
  currentPageIndex,
  defaultLayoutPadding,
  defaultLayoutGap,
  getMetaLabel,
  onSelect,
  onMove,
  onDuplicate,
  onDelete,
  onAdd,
}: {
  t: Translator;
  pages: Page[];
  assetBlobs: Record<string, Blob>;
  currentPageIndex: number;
  defaultLayoutPadding: number;
  defaultLayoutGap: number;
  getMetaLabel: (page: Page) => string;
  onSelect: (index: number) => void;
  onMove: (fromIndex: number, toIndex: number) => void;
  onDuplicate: (index: number) => void;
  onDelete: (index: number) => void;
  onAdd: () => void;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  return (
    <aside className="editor-filmstrip hidden h-full w-48 shrink-0 flex-col overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/95 xl:flex">
      <div className="flex min-h-11 items-center justify-between border-b border-neutral-800 px-2">
        <strong className="text-xs font-semibold text-neutral-200">{t('pages')}</strong>
        <button
          type="button"
          onClick={onAdd}
          className="editor-surface-control min-h-9 min-w-9 rounded-lg border border-neutral-700 bg-neutral-800 text-neutral-200 hover:bg-neutral-700"
          aria-label={t('pageAdd')}
          title={t('pageAdd')}
        >
          +
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
        {pages.map((page, index) => (
          <article
            key={page.id}
            onDragOver={(event) => {
              if (dragIndex !== null) event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (dragIndex !== null && dragIndex !== index) onMove(dragIndex, index);
              setDragIndex(null);
            }}
            className={`group rounded-lg border p-1 transition-colors ${
              index === currentPageIndex
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-neutral-700 bg-neutral-950/50 hover:border-neutral-500'
            }`}
          >
            <div className="mb-1 flex items-center justify-between gap-1">
              <button
                type="button"
                draggable
                onDragStart={(event) => {
                  setDragIndex(index);
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', String(index));
                }}
                onDragEnd={() => setDragIndex(null)}
                className="min-h-8 min-w-8 cursor-grab rounded text-xs text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200 active:cursor-grabbing"
                aria-label={t('dragToReorder')}
                title={t('dragToReorder')}
              >
                ⠿
              </button>
              <span className="text-xs font-semibold text-neutral-300">{index + 1}</span>
              <div className="flex">
                <button
                  type="button"
                  onClick={() => onDuplicate(index)}
                  className="min-h-8 min-w-8 rounded text-xs text-neutral-400 hover:bg-neutral-800 hover:text-white"
                  aria-label={t('duplicatePage')}
                  title={t('duplicatePage')}
                >
                  ⧉
                </button>
                {pages.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onDelete(index)}
                    className="min-h-8 min-w-8 rounded text-sm text-red-300 hover:bg-red-950"
                    aria-label={t('pageDelete')}
                    title={t('pageDelete')}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
            <button type="button" onClick={() => onSelect(index)} className="block w-full text-left">
              <PageThumbnail
                page={page}
                assetBlobs={assetBlobs}
                defaultLayoutPadding={defaultLayoutPadding}
                defaultLayoutGap={defaultLayoutGap}
                className="aspect-[4/3] w-full rounded"
              />
              <div className="mt-1 truncate px-0.5 text-[10px] text-neutral-500">{getMetaLabel(page)}</div>
            </button>
          </article>
        ))}
      </div>
    </aside>
  );
}
