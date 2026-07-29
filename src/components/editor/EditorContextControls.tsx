import {
  DEFAULT_COVER_SUBTITLE_COLOR,
  DEFAULT_COVER_SUBTITLE_FONT_FAMILY,
  DEFAULT_COVER_SUBTITLE_FONT_SIZE,
  DEFAULT_COVER_TITLE_COLOR,
  DEFAULT_COVER_TITLE_FONT_FAMILY,
  DEFAULT_COVER_TITLE_FONT_SIZE,
} from '../../domain/projectDefaults';
import type { Translator } from '../../i18n';
import useProjectStore from '../../store/useProjectStore';

const FONTS = [
  'Arial',
  'Times New Roman',
  'Georgia',
  'Verdana',
  'Courier New',
  'Trebuchet MS',
  'Impact',
  'Comic Sans MS',
];

export default function EditorContextControls({ t }: { t: Translator }) {
  const currentPage = useProjectStore(
    (state) => state.project.pages[state.currentPageIndex],
  );
  const selectedTextElement = useProjectStore((state) => {
    if (!state.selectedElementId) return null;
    const page = state.project.pages[state.currentPageIndex];
    const element = page?.elements.find((item) => item.id === state.selectedElementId);
    return element?.type === 'text' ? element : null;
  });
  const snapshot = useProjectStore((state) => state.snapshot);
  const updateElement = useProjectStore((state) => state.updateElement);
  const setCoverTitle = useProjectStore((state) => state.setCoverTitle);
  const setCoverSubtitle = useProjectStore((state) => state.setCoverSubtitle);
  const setCoverSubtitleVisible = useProjectStore((state) => state.setCoverSubtitleVisible);
  const setCoverTitleStyle = useProjectStore((state) => state.setCoverTitleStyle);
  const setCoverSubtitleStyle = useProjectStore((state) => state.setCoverSubtitleStyle);
  const toggleCover = useProjectStore((state) => state.toggleCover);

  if (!selectedTextElement && !currentPage?.isCover) return null;

  return (
    <div className="editor-context-bar order-2 basis-full mt-2 pt-2 border-t border-neutral-800/90 flex items-center gap-3 px-1 pb-1 text-sm">
      {selectedTextElement ? (
        <>
          <label className="text-xs text-neutral-500">{t('font')}</label>
          <select
            value={selectedTextElement.fontFamily}
            onChange={(event) => {
              snapshot();
              updateElement(selectedTextElement.id, { fontFamily: event.target.value });
            }}
            className="editor-input px-2 py-0.5 text-sm rounded-md bg-neutral-800 text-white border border-neutral-600"
          >
            {FONTS.map((font) => (
              <option key={font} value={font} style={{ fontFamily: font }}>{font}</option>
            ))}
          </select>
          <label className="text-xs text-neutral-500">{t('size')}</label>
          <input
            type="number"
            min={1}
            max={200}
            value={selectedTextElement.fontSize}
            onFocus={snapshot}
            onChange={(event) => updateElement(selectedTextElement.id, {
              fontSize: Math.max(1, Number.parseInt(event.target.value, 10) || 24),
            })}
            className="editor-input w-16 px-2 py-0.5 text-sm rounded-md bg-neutral-800 text-white border border-neutral-600"
          />
          <label className="text-xs text-neutral-500">{t('color')}</label>
          <input
            type="color"
            value={selectedTextElement.color}
            onFocus={snapshot}
            onChange={(event) => updateElement(selectedTextElement.id, { color: event.target.value })}
            className="editor-color-input w-8 h-8 rounded-md border border-neutral-600 cursor-pointer p-0.5 bg-neutral-800"
          />
        </>
      ) : (
        <>
          <label className="text-[11px] text-neutral-500">{t('title')}</label>
          <input
            type="text"
            value={currentPage.coverTitle ?? ''}
            onFocus={snapshot}
            onChange={(event) => setCoverTitle(event.target.value)}
            className="editor-input w-36 px-2 py-0.5 text-xs rounded-md bg-neutral-800 text-white border border-neutral-600"
            placeholder={t('title')}
          />
          <select
            value={currentPage.coverTitleFontFamily ?? DEFAULT_COVER_TITLE_FONT_FAMILY}
            onChange={(event) => {
              snapshot();
              setCoverTitleStyle({ fontFamily: event.target.value });
            }}
            className="editor-input w-24 px-1.5 py-0.5 text-xs rounded-md bg-neutral-800 text-white border border-neutral-600"
          >
            {FONTS.map((font) => (
              <option key={`cover-title-${font}`} value={font}>{font}</option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            max={300}
            value={currentPage.coverTitleFontSize ?? DEFAULT_COVER_TITLE_FONT_SIZE}
            onFocus={snapshot}
            onChange={(event) => setCoverTitleStyle({
              fontSize: Math.max(1, Number.parseInt(event.target.value, 10) || 48),
            })}
            className="editor-input w-14 px-1.5 py-0.5 text-xs rounded-md bg-neutral-800 text-white border border-neutral-600"
          />
          <input
            type="color"
            value={currentPage.coverTitleColor ?? DEFAULT_COVER_TITLE_COLOR}
            onFocus={snapshot}
            onChange={(event) => setCoverTitleStyle({ color: event.target.value })}
            className="editor-color-input w-7 h-7 rounded-md border border-neutral-600 cursor-pointer p-0.5 bg-neutral-800"
          />

          <label className="text-[11px] text-neutral-400 flex items-center gap-1 ml-1 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={currentPage.showCoverSubtitle ?? false}
              onChange={(event) => {
                snapshot();
                setCoverSubtitleVisible(event.target.checked);
              }}
              className="accent-blue-500"
            />
            {t('showSubtitle')}
          </label>

          {currentPage.showCoverSubtitle && (
            <>
              <label className="text-[11px] text-neutral-500">{t('subtitle')}</label>
              <input
                type="text"
                value={currentPage.coverSubtitle ?? ''}
                onFocus={snapshot}
                onChange={(event) => setCoverSubtitle(event.target.value)}
                className="editor-input w-28 px-2 py-0.5 text-xs rounded-md bg-neutral-800 text-white border border-neutral-600"
                placeholder={t('subtitle')}
              />
              <select
                value={currentPage.coverSubtitleFontFamily ?? DEFAULT_COVER_SUBTITLE_FONT_FAMILY}
                onChange={(event) => {
                  snapshot();
                  setCoverSubtitleStyle({ fontFamily: event.target.value });
                }}
                className="editor-input w-24 px-1.5 py-0.5 text-xs rounded-md bg-neutral-800 text-white border border-neutral-600"
              >
                {FONTS.map((font) => (
                  <option key={`cover-sub-${font}`} value={font}>{font}</option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                max={300}
                value={currentPage.coverSubtitleFontSize ?? DEFAULT_COVER_SUBTITLE_FONT_SIZE}
                onFocus={snapshot}
                onChange={(event) => setCoverSubtitleStyle({
                  fontSize: Math.max(1, Number.parseInt(event.target.value, 10) || 24),
                })}
                className="editor-input w-14 px-1.5 py-0.5 text-xs rounded-md bg-neutral-800 text-white border border-neutral-600"
              />
              <input
                type="color"
                value={currentPage.coverSubtitleColor ?? DEFAULT_COVER_SUBTITLE_COLOR}
                onFocus={snapshot}
                onChange={(event) => setCoverSubtitleStyle({ color: event.target.value })}
                className="editor-color-input w-7 h-7 rounded-md border border-neutral-600 cursor-pointer p-0.5 bg-neutral-800"
              />
            </>
          )}

          <button
            type="button"
            onClick={() => {
              snapshot();
              toggleCover(false);
            }}
            className="ml-auto px-2 py-0.5 text-[11px] rounded-md border border-red-800 bg-red-900/50 hover:bg-red-800/60 text-red-200 transition-colors cursor-pointer select-none"
            title={t('removeCoverLabel')}
          >
            {t('removeCoverLabel')}
          </button>
        </>
      )}
    </div>
  );
}
