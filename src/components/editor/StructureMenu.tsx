import { useMemo } from 'react';
import type { Translator } from '../../i18n';
import useProjectStore from '../../store/useProjectStore';
import { MenuButton, MenuDivider } from './MenuComponents';

export default function StructureMenu({
  t,
  open,
  onToggle,
  onClose,
}: {
  t: Translator;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const pages = useProjectStore((state) => state.project.pages);
  const currentChapterTitle = useProjectStore((state) => {
    const page = state.project.pages[state.currentPageIndex];
    if (!page) return '';
    return page.chapterTitle ?? (page.isCover ? (page.coverTitle ?? '') : '');
  });
  const currentSubchapterTitle = useProjectStore(
    (state) => state.project.pages[state.currentPageIndex]?.subchapterTitle ?? '',
  );
  const snapshot = useProjectStore((state) => state.snapshot);
  const setCurrentPageChapterTitle = useProjectStore(
    (state) => state.setCurrentPageChapterTitle,
  );
  const setCurrentPageSubchapterTitle = useProjectStore(
    (state) => state.setCurrentPageSubchapterTitle,
  );
  const setCurrentPageIndex = useProjectStore((state) => state.setCurrentPageIndex);

  const chapterJumpTargets = useMemo(() => {
    const seen = new Set<string>();
    return pages
      .map((page, pageIndex) => {
        if (page.isCover) {
          const coverLabel = (page.coverTitle ?? '').trim();
          return {
            pageIndex,
            label: coverLabel ? `${t('deckblatt')} • ${coverLabel}` : t('deckblatt'),
          };
        }
        const chapter = (page.chapterTitle ?? '').trim();
        if (!chapter || seen.has(chapter)) return null;
        seen.add(chapter);
        return { pageIndex, label: chapter };
      })
      .filter((item): item is { pageIndex: number; label: string } => item !== null);
  }, [pages, t]);

  return (
    <div className="relative" data-menu>
      <MenuButton label={t('structure')} isOpen={open} onClick={onToggle} />
      {open && (
        <div className="editor-dropdown absolute top-full left-0 mt-2 min-w-[290px] bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl z-[90] p-1">
          <div className="px-3 py-2 space-y-2">
            <div className="text-xs text-neutral-400">{t('currentPage')}</div>
            <input
              type="text"
              placeholder={t('chapter')}
              value={currentChapterTitle}
              onFocus={snapshot}
              onChange={(event) => setCurrentPageChapterTitle(event.target.value)}
              className="editor-input w-full px-2 py-1 text-xs rounded-md bg-neutral-800 text-white border border-neutral-600"
              title={t('chapter')}
            />
            <input
              type="text"
              placeholder={t('subchapter')}
              value={currentSubchapterTitle}
              onFocus={snapshot}
              onChange={(event) => setCurrentPageSubchapterTitle(event.target.value)}
              className="editor-input w-full px-2 py-1 text-xs rounded-md bg-neutral-800 text-white border border-neutral-600"
              title={t('subchapter')}
            />
            {currentChapterTitle && (
              <button
                type="button"
                onClick={() => {
                  snapshot();
                  setCurrentPageChapterTitle('');
                }}
                className="editor-surface-control w-full px-2 py-1 text-xs rounded-md border border-neutral-600 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors cursor-pointer select-none"
              >
                {t('removeChapter')}
              </button>
            )}
            {currentSubchapterTitle && (
              <button
                type="button"
                onClick={() => {
                  snapshot();
                  setCurrentPageSubchapterTitle('');
                }}
                className="editor-surface-control w-full px-2 py-1 text-xs rounded-md border border-neutral-600 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors cursor-pointer select-none"
              >
                {t('removeSubchapter')}
              </button>
            )}
          </div>

          {chapterJumpTargets.length > 0 && (
            <>
              <MenuDivider />
              <div className="px-3 py-2 space-y-1">
                <div className="text-xs text-neutral-400">{t('jumpChapter')}</div>
                <select
                  value=""
                  onChange={(event) => {
                    if (!event.target.value) return;
                    setCurrentPageIndex(Number.parseInt(event.target.value, 10));
                    onClose();
                  }}
                  className="editor-input w-full px-2 py-1 text-xs rounded-md bg-neutral-800 text-white border border-neutral-600"
                >
                  <option value="">{t('chooseChapter')}</option>
                  {chapterJumpTargets.map((target) => (
                    <option key={`${target.pageIndex}-${target.label}`} value={target.pageIndex}>
                      {target.label} (p. {target.pageIndex + 1})
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
