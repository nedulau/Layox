import type { ReactNode } from 'react';
import type { Translator } from '../../i18n';
import useProjectStore from '../../store/useProjectStore';

type PageItem = number | 'ellipsis-left' | 'ellipsis-right';

function getVisiblePageItems(total: number, current: number): PageItem[] {
  if (total <= 9) return Array.from({ length: total }, (_, index) => index);

  const items: PageItem[] = [0];
  let start = Math.max(1, current - 1);
  let end = Math.min(total - 2, current + 1);

  if (current <= 2) {
    start = 1;
    end = 3;
  } else if (current >= total - 3) {
    start = total - 4;
    end = total - 2;
  }

  if (start > 1) items.push('ellipsis-left');
  for (let index = start; index <= end; index += 1) items.push(index);
  if (end < total - 2) items.push('ellipsis-right');
  items.push(total - 1);
  return items;
}

export default function EditorPageNavigation({
  t,
  buttonClassName,
  settings,
  onOpenOverview,
  onDeletePage,
}: {
  t: Translator;
  buttonClassName: string;
  settings: ReactNode;
  onOpenOverview: () => void;
  onDeletePage: (index: number) => void;
}) {
  const pageCount = useProjectStore((state) => state.project.pages.length);
  const currentPageIndex = useProjectStore((state) => state.currentPageIndex);
  const setCurrentPageIndex = useProjectStore((state) => state.setCurrentPageIndex);
  const snapshot = useProjectStore((state) => state.snapshot);
  const addPage = useProjectStore((state) => state.addPage);
  const pageItems = getVisiblePageItems(pageCount, currentPageIndex);

  return (
    <div className="relative flex items-center" data-menu>
      {settings}
      <button
        type="button"
        onClick={onOpenOverview}
        className="editor-page-label mr-2 px-2.5 py-1 rounded-md border border-neutral-700 bg-neutral-900 text-[11px] uppercase tracking-wide text-neutral-400 hover:bg-neutral-800 transition-colors cursor-pointer select-none"
        title={t('openPageOverview')}
      >
        {t('pages')}
      </button>

      <div className="flex items-center gap-1">
        {pageItems.map((item) => (
          typeof item === 'number' ? (
            <button
              key={item}
              type="button"
              onClick={() => setCurrentPageIndex(item)}
              className={`editor-page-chip ${buttonClassName} ${
                item === currentPageIndex
                  ? 'is-active bg-blue-600/90 border-blue-500 text-white shadow-sm'
                  : 'bg-neutral-900 border-neutral-700 hover:bg-neutral-800 text-neutral-300'
              }`}
            >
              {item + 1}
            </button>
          ) : (
            <span key={item} className="px-1 text-neutral-500 text-sm select-none">…</span>
          )
        ))}
      </div>

      <span className="editor-page-count ml-2 text-xs text-neutral-400 tabular-nums select-none">
        {currentPageIndex + 1} / {pageCount}
      </span>

      <div className="flex items-center gap-1 ml-3 pl-3 border-l border-neutral-700/80">
        <button
          type="button"
          onClick={() => {
            snapshot();
            addPage();
          }}
          className={`editor-page-chip ${buttonClassName} bg-neutral-900 border-neutral-700 hover:bg-neutral-800 text-neutral-300`}
          title={t('pageNew')}
        >
          +
        </button>
        {pageCount > 1 && (
          <button
            type="button"
            onClick={() => onDeletePage(currentPageIndex)}
            className={`editor-page-chip editor-page-chip-danger ${buttonClassName} bg-red-900/60 border-red-800 hover:bg-red-800/70 text-red-200`}
            title={t('pageDelete')}
          >
            −
          </button>
        )}
      </div>
    </div>
  );
}
