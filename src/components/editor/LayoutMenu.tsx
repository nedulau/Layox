import {
  DEFAULT_LAYOUT_GAP,
  DEFAULT_LAYOUT_PADDING,
} from '../../domain/projectDefaults';
import type { TranslationKey, Translator } from '../../i18n';
import useProjectStore from '../../store/useProjectStore';
import LayoutPicker from '../LayoutPicker';
import { MenuButton } from './MenuComponents';

const LAYOUT_NAME_KEYS: Partial<Record<string, TranslationKey>> = {
  'cover-full': 'layoutCoverFull',
  'cover-center': 'layoutCoverCentered',
  single: 'layoutSingle',
  'two-side': 'layoutTwoSide',
  'two-stack': 'layoutTwoStack',
  'three-cols': 'layoutThreeColumns',
  'grid-4': 'layoutGrid4',
  'one-big-two-small': 'layoutLargeTwoSmall',
  'three-rows': 'layoutThreeRows',
  'grid-6': 'layoutGrid6',
  'one-top-two-bottom': 'layoutTopTwoBottom',
  'two-top-one-bottom': 'layoutTwoTopBottom',
  'sidebar-left': 'layoutSidebarLeft',
  'mosaic-5': 'layoutMosaic5',
};

export default function LayoutMenu({
  t,
  open,
  uiTheme,
  onToggle,
  onClose,
  onLayoutChange,
}: {
  t: Translator;
  open: boolean;
  uiTheme: 'dark' | 'light';
  onToggle: () => void;
  onClose: () => void;
  onLayoutChange: () => void;
}) {
  const currentLayoutId = useProjectStore(
    (state) => state.project.pages[state.currentPageIndex]?.layoutId,
  );
  const currentLayoutPadding = useProjectStore((state) => (
    state.project.pages[state.currentPageIndex]?.layoutPadding
      ?? state.project.meta.defaultLayoutPadding
      ?? DEFAULT_LAYOUT_PADDING
  ));
  const currentLayoutGap = useProjectStore((state) => (
    state.project.pages[state.currentPageIndex]?.layoutGap
      ?? state.project.meta.defaultLayoutGap
      ?? DEFAULT_LAYOUT_GAP
  ));
  const defaultLayoutPadding = useProjectStore(
    (state) => state.project.meta.defaultLayoutPadding ?? DEFAULT_LAYOUT_PADDING,
  );
  const defaultLayoutGap = useProjectStore(
    (state) => state.project.meta.defaultLayoutGap ?? DEFAULT_LAYOUT_GAP,
  );
  const snapshot = useProjectStore((state) => state.snapshot);
  const applyLayout = useProjectStore((state) => state.applyLayout);
  const clearLayout = useProjectStore((state) => state.clearLayout);
  const setLayoutPadding = useProjectStore((state) => state.setLayoutPadding);
  const setLayoutGap = useProjectStore((state) => state.setLayoutGap);
  const setDefaultLayoutPadding = useProjectStore((state) => state.setDefaultLayoutPadding);
  const setDefaultLayoutGap = useProjectStore((state) => state.setDefaultLayoutGap);
  const applyLayoutDefaultsToAllPages = useProjectStore(
    (state) => state.applyLayoutDefaultsToAllPages,
  );

  return (
    <div className="relative" data-menu>
      <MenuButton label={t('layout')} isOpen={open} onClick={onToggle} />
      {open && (
        <div className="editor-dropdown absolute top-full left-0 mt-2 bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl z-[90] py-3 px-3 min-w-[280px]">
          <div className="mb-2">
            <LayoutPicker
              currentLayoutId={currentLayoutId}
              uiTheme={uiTheme}
              layoutPlaceholder={`${t('layout')}...`}
              freeLabel={t('freeArrangement')}
              freeThumbLabel={t('freeShort')}
              slotSingularLabel={t('slotSingular')}
              slotPluralLabel={t('slotPlural')}
              getLayoutName={(layout) => {
                const key = LAYOUT_NAME_KEYS[layout.id];
                return key ? t(key) : layout.name;
              }}
              onSelect={(layoutId) => {
                onLayoutChange();
                snapshot();
                if (layoutId) applyLayout(layoutId);
                else clearLayout();
                onClose();
              }}
            />
          </div>
          {currentLayoutId && (
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-neutral-700">
              <label className="text-xs text-neutral-500">{t('margin')}</label>
              <input
                type="number"
                min={0}
                max={100}
                value={currentLayoutPadding}
                onFocus={snapshot}
                onChange={(event) => setLayoutPadding(
                  Math.max(0, Number.parseInt(event.target.value, 10) || 0),
                )}
                className="editor-input w-16 px-2 py-1 text-sm rounded-md bg-neutral-800 text-white border border-neutral-600"
              />
              {currentLayoutId !== 'single' && (
                <>
                  <label className="text-xs text-neutral-500">{t('gap')}</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={currentLayoutGap}
                    onFocus={snapshot}
                    onChange={(event) => setLayoutGap(
                      Math.max(0, Number.parseInt(event.target.value, 10) || 0),
                    )}
                    className="editor-input w-16 px-2 py-1 text-sm rounded-md bg-neutral-800 text-white border border-neutral-600"
                  />
                </>
              )}
            </div>
          )}

          <div className="mt-3 pt-3 border-t border-neutral-700 space-y-2">
            <div className="text-xs text-neutral-400">{t('projectDefault')}</div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-neutral-500">{t('margin')}</label>
              <input
                type="number"
                min={0}
                max={100}
                value={defaultLayoutPadding}
                onFocus={snapshot}
                onChange={(event) => setDefaultLayoutPadding(
                  Math.max(0, Number.parseInt(event.target.value, 10) || 0),
                )}
                className="editor-input w-16 px-2 py-1 text-sm rounded-md bg-neutral-800 text-white border border-neutral-600"
              />
              <label className="text-xs text-neutral-500">{t('gap')}</label>
              <input
                type="number"
                min={0}
                max={100}
                value={defaultLayoutGap}
                onFocus={snapshot}
                onChange={(event) => setDefaultLayoutGap(
                  Math.max(0, Number.parseInt(event.target.value, 10) || 0),
                )}
                className="editor-input w-16 px-2 py-1 text-sm rounded-md bg-neutral-800 text-white border border-neutral-600"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                snapshot();
                applyLayoutDefaultsToAllPages();
              }}
              className="editor-surface-control w-full mt-1 px-2.5 py-1.5 text-xs rounded-md border border-neutral-600 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors cursor-pointer select-none"
              title={t('applyToAllPages')}
            >
              {t('applyToAllPages')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
