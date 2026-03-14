import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import './index.css';
import EditorCanvas from './components/canvas/EditorCanvas';
import LayoutPicker from './components/LayoutPicker';
import StartScreen from './components/StartScreen';
import CropModal from './components/CropModal';
import NewProjectModal from './components/NewProjectModal';
import useProjectStore from './store/useProjectStore';
import { exportAsPdf, exportCurrentPageAsPng, exportCurrentPageAsJpeg, exportAllPagesAsZip, PDF_COMPRESSION_PRESETS } from './utils/exportProject';
import type { PdfCompressionLevel } from './utils/exportProject';
import { tr, type Language } from './i18n';
import type { Page, Project } from './types';
import { computeLayoutSlots } from './utils/layouts';
import { CANVAS_H, CANVAS_W } from './constants/canvas';
import { Analytics } from '@vercel/analytics/react';

const FONTS = ['Arial', 'Times New Roman', 'Georgia', 'Verdana', 'Courier New', 'Trebuchet MS', 'Impact', 'Comic Sans MS'];
type UiTheme = 'dark' | 'light';
type AutoSaveRestorePoint = {
  id: string;
  createdAt: number;
  pageIndex: number;
  pageCount: number;
  projectName: string;
  project: Project;
};

function App() {
  const [uiTheme, setUiTheme] = useState<UiTheme>(() => {
    const saved = localStorage.getItem('layox_uiTheme');
    return saved === 'light' ? 'light' : 'dark';
  });
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('layox_language');
    return saved === 'en' ? 'en' : 'de';
  });

  useEffect(() => {
    localStorage.setItem('layox_uiTheme', uiTheme);
  }, [uiTheme]);

  useEffect(() => {
    localStorage.setItem('layox_language', language);
  }, [language]);

  const showEditor = useProjectStore((s) => s.showEditor);
  if (!showEditor) {
    return (
      <>
        <StartScreen uiTheme={uiTheme} setUiTheme={setUiTheme} language={language} setLanguage={setLanguage} />
        <Analytics />
      </>
    );
  }
  return (
    <>
      <Editor uiTheme={uiTheme} setUiTheme={setUiTheme} language={language} setLanguage={setLanguage} />
      <Analytics />
    </>
  );
}

// ─── Dropdown menu helper ────────────────────────────────────────────────────

function MenuButton({
  label,
  isOpen,
  onClick,
}: {
  label: string;
  isOpen: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      data-menu
      className={`editor-surface-control px-3 py-1 text-[13px] rounded-lg border transition-all duration-150 cursor-pointer select-none ${
        isOpen
          ? 'bg-neutral-800 border-neutral-500 text-white shadow-sm'
          : 'bg-neutral-900 border-neutral-700 text-neutral-200 hover:bg-neutral-800 hover:border-neutral-600 hover:text-white'
      }`}
    >
      {label}
    </button>
  );
}

function MenuItem({
  label,
  shortcut,
  onClick,
  disabled,
  danger,
}: {
  label: string;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`editor-surface-control w-full text-left px-3 py-2 text-sm flex justify-between items-center rounded-md transition-colors cursor-pointer select-none
                  ${disabled ? 'text-neutral-600 cursor-not-allowed' : danger ? 'text-red-300 hover:bg-red-500/15' : 'text-neutral-200 hover:bg-neutral-700 hover:text-white'}`}
    >
      <span>{label}</span>
      {shortcut && <span className="text-neutral-500 text-xs ml-6">{shortcut}</span>}
    </button>
  );
}

function MenuDivider() {
  return <div className="h-px bg-neutral-700/80 my-1" />;
}

function PagePreviewCard({
  page,
  assetBlobs,
  pageIndex,
  active,
  onClick,
  noPreviewLabel,
  metaLabel,
}: {
  page: Page;
  assetBlobs: Record<string, Blob>;
  pageIndex: number;
  active: boolean;
  onClick: () => void;
  noPreviewLabel: string;
  metaLabel: string;
}) {
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const paths = new Set<string>();
    Object.values(page.slotAssignments ?? {}).forEach((slot) => {
      if (slot?.assetPath) paths.add(slot.assetPath);
    });
    page.elements.forEach((element) => {
      if (element.type === 'image') paths.add(element.src);
    });

    const nextUrls: Record<string, string> = {};
    paths.forEach((path) => {
      const blob = assetBlobs[path];
      if (!blob) return;
      nextUrls[path] = URL.createObjectURL(blob);
    });
    setPreviewUrls(nextUrls);

    return () => {
      Object.values(nextUrls).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [assetBlobs, page]);

  const slots = useMemo(() => {
    if (!page.layoutId) return [];
    const padding = page.layoutPadding ?? 20;
    const gap = page.layoutGap ?? 10;
    return computeLayoutSlots(page.layoutId, padding, gap);
  }, [page.layoutGap, page.layoutId, page.layoutPadding]);

  const hasPreview =
    slots.some((_, slotIndex) => {
      const assignment = page.slotAssignments?.[slotIndex];
      return !!assignment && !!previewUrls[assignment.assetPath];
    }) ||
    page.elements.some((element) => element.type === 'image' && !!previewUrls[element.src]);

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
          const src = assignment ? previewUrls[assignment.assetPath] : undefined;

          return (
            <div
              key={`${page.id}-slot-${slotIndex}`}
              className="absolute overflow-hidden rounded-[2px] border border-white/15"
              style={{
                left: `${(slot.x / CANVAS_W) * 100}%`,
                top: `${(slot.y / CANVAS_H) * 100}%`,
                width: `${(slot.width / CANVAS_W) * 100}%`,
                height: `${(slot.height / CANVAS_H) * 100}%`,
                background: src ? '#0f172a' : 'rgba(255,255,255,0.08)',
              }}
            >
              {src && (
                <img
                  src={src}
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
              const src = previewUrls[element.src];
              if (!src) return null;
              return (
                <img
                  key={element.id}
                  src={src}
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

function PageOverviewModal({
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
}) {
  const [dragFromIndex, setDragFromIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const pointerActiveRef = useRef(false);

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

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-[1px] flex items-center justify-center px-6 py-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="editor-dropdown w-[min(96vw,1400px)] h-[min(90vh,860px)] bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-700/80">
          <div>
            <h3 className="text-sm font-semibold text-neutral-100">{title}</h3>
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

function AssetLibraryModal({
  open,
  assetBlobs,
  title,
  closeLabel,
  emptyLabel,
  onInsert,
  onClose,
}: {
  open: boolean;
  assetBlobs: Record<string, Blob>;
  title: string;
  closeLabel: string;
  emptyLabel: string;
  onInsert: (assetPath: string) => void;
  onClose: () => void;
}) {
  const assetPaths = useMemo(() => Object.keys(assetBlobs).sort(), [assetBlobs]);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    const nextUrls: Record<string, string> = {};
    assetPaths.forEach((path) => {
      const blob = assetBlobs[path];
      if (!blob) return;
      nextUrls[path] = URL.createObjectURL(blob);
    });
    setPreviewUrls(nextUrls);
    return () => {
      Object.values(nextUrls).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [open, assetBlobs, assetPaths]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[112] bg-black/60 backdrop-blur-[1px] flex items-center justify-center px-6 py-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="editor-dropdown w-[min(94vw,980px)] h-[min(86vh,760px)] bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-700/80">
          <h3 className="text-sm font-semibold text-neutral-100">{title}</h3>
          <button
            onClick={onClose}
            className="editor-surface-control px-2.5 py-1 rounded-md border border-neutral-600 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs"
          >
            {closeLabel}
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {assetPaths.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-neutral-400">{emptyLabel}</div>
          ) : (
            <div className="grid gap-3 justify-center" style={{ gridTemplateColumns: 'repeat(auto-fill, 180px)' }}>
              {assetPaths.map((assetPath) => (
                <button
                  key={assetPath}
                  onClick={() => {
                    onInsert(assetPath);
                    onClose();
                  }}
                  className="group text-left rounded-xl border border-neutral-700 bg-neutral-900/80 hover:bg-neutral-800/90 transition-colors overflow-hidden"
                >
                  <div className="w-[180px] h-[135px] bg-neutral-950 flex items-center justify-center overflow-hidden">
                    {previewUrls[assetPath] ? (
                      <img src={previewUrls[assetPath]} alt="" className="w-full h-full object-cover" draggable={false} />
                    ) : (
                      <span className="text-xs text-neutral-500">…</span>
                    )}
                  </div>
                  <div className="px-2 py-1.5 border-t border-neutral-700/80 text-[11px] text-neutral-400 truncate">
                    {assetPath.split('/').pop() || assetPath}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Editor ──────────────────────────────────────────────────────────────────

function Editor({
  uiTheme,
  setUiTheme,
  language,
  setLanguage,
}: {
  uiTheme: UiTheme;
  setUiTheme: (theme: UiTheme) => void;
  language: Language;
  setLanguage: (language: Language) => void;
}) {
  const t = (key: string) => tr(language, key);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Store selectors
  const saveCurrentProject = useProjectStore((s) => s.saveCurrentProject);
  const saveCurrentProjectAs = useProjectStore((s) => s.saveCurrentProjectAs);
  const openProject = useProjectStore((s) => s.openProject);
  const loadFromFile = useProjectStore((s) => s.loadFromFile);
  const setProject = useProjectStore((s) => s.setProject);
  const resetProject = useProjectStore((s) => s.resetProject);
  const setProjectName = useProjectStore((s) => s.setProjectName);
  const projectName = useProjectStore((s) => s.project.meta.name);
  const snapshot = useProjectStore((s) => s.snapshot);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const canUndo = useProjectStore((s) => s.historyPast.length > 0);
  const canRedo = useProjectStore((s) => s.historyFuture.length > 0);

  const addImageFromFile = useProjectStore((s) => s.addImageFromFile);
  const addImageFromAsset = useProjectStore((s) => s.addImageFromAsset);
  const addTextElement = useProjectStore((s) => s.addTextElement);
  const removeElement = useProjectStore((s) => s.removeElement);
  const removeImageFromSlot = useProjectStore((s) => s.removeImageFromSlot);
  const clearSlotCrop = useProjectStore((s) => s.clearSlotCrop);
  const updateSlotCrop = useProjectStore((s) => s.updateSlotCrop);
  const selectedElementId = useProjectStore((s) => s.selectedElementId);
  const selectedSlotIndex = useProjectStore((s) => s.selectedSlotIndex);
  const applyLayout = useProjectStore((s) => s.applyLayout);
  const clearLayout = useProjectStore((s) => s.clearLayout);
  const updateElement = useProjectStore((s) => s.updateElement);
  const setLayoutPadding = useProjectStore((s) => s.setLayoutPadding);
  const setLayoutGap = useProjectStore((s) => s.setLayoutGap);
  const setDefaultLayoutPadding = useProjectStore((s) => s.setDefaultLayoutPadding);
  const setDefaultLayoutGap = useProjectStore((s) => s.setDefaultLayoutGap);
  const applyLayoutDefaultsToAllPages = useProjectStore((s) => s.applyLayoutDefaultsToAllPages);
  const setCoverSubtitleVisible = useProjectStore((s) => s.setCoverSubtitleVisible);
  const setCoverTitleStyle = useProjectStore((s) => s.setCoverTitleStyle);
  const setCoverSubtitleStyle = useProjectStore((s) => s.setCoverSubtitleStyle);
  const setCurrentPageChapterTitle = useProjectStore((s) => s.setCurrentPageChapterTitle);
  const setCoverTitle = useProjectStore((s) => s.setCoverTitle);
  const setCoverSubtitle = useProjectStore((s) => s.setCoverSubtitle);
  const toggleCover = useProjectStore((s) => s.toggleCover);
  const assetBlobs = useProjectStore((s) => s.assetBlobs);
  const setShowEditor = useProjectStore((s) => s.setShowEditor);

  const pages = useProjectStore((s) => s.project.pages);
  const currentPageIndex = useProjectStore((s) => s.currentPageIndex);
  const currentLayoutId = useProjectStore(
    (s) => s.project.pages[s.currentPageIndex]?.layoutId,
  );
  const currentSlotAssignments = useProjectStore(
    (s) => s.project.pages[s.currentPageIndex]?.slotAssignments,
  );
  const defaultLayoutPadding = useProjectStore(
    (s) => s.project.meta.defaultLayoutPadding ?? 20,
  );
  const defaultLayoutGap = useProjectStore(
    (s) => s.project.meta.defaultLayoutGap ?? 10,
  );
  const currentLayoutPadding = useProjectStore(
    (s) => s.project.pages[s.currentPageIndex]?.layoutPadding ?? (s.project.meta.defaultLayoutPadding ?? 20),
  );
  const currentLayoutGap = useProjectStore(
    (s) => s.project.pages[s.currentPageIndex]?.layoutGap ?? (s.project.meta.defaultLayoutGap ?? 10),
  );
  const setCurrentPageIndex = useProjectStore((s) => s.setCurrentPageIndex);
  const addPage = useProjectStore((s) => s.addPage);
  const removePage = useProjectStore((s) => s.removePage);
  const movePage = useProjectStore((s) => s.movePage);

  const currentIsCover = useProjectStore(
    (s) => s.project.pages[s.currentPageIndex]?.isCover ?? false,
  );
  const currentCoverTitle = useProjectStore(
    (s) => s.project.pages[s.currentPageIndex]?.coverTitle ?? '',
  );
  const currentCoverSubtitle = useProjectStore(
    (s) => s.project.pages[s.currentPageIndex]?.coverSubtitle ?? '',
  );
  const currentCoverTitleFontSize = useProjectStore(
    (s) => s.project.pages[s.currentPageIndex]?.coverTitleFontSize ?? 48,
  );
  const currentCoverTitleFontFamily = useProjectStore(
    (s) => s.project.pages[s.currentPageIndex]?.coverTitleFontFamily ?? 'Arial',
  );
  const currentCoverTitleColor = useProjectStore(
    (s) => s.project.pages[s.currentPageIndex]?.coverTitleColor ?? '#ffffff',
  );
  const currentCoverSubtitleFontSize = useProjectStore(
    (s) => s.project.pages[s.currentPageIndex]?.coverSubtitleFontSize ?? 24,
  );
  const currentCoverSubtitleFontFamily = useProjectStore(
    (s) => s.project.pages[s.currentPageIndex]?.coverSubtitleFontFamily ?? 'Arial',
  );
  const currentCoverSubtitleColor = useProjectStore(
    (s) => s.project.pages[s.currentPageIndex]?.coverSubtitleColor ?? '#ffffffcc',
  );
  const currentShowCoverSubtitle = useProjectStore(
    (s) => s.project.pages[s.currentPageIndex]?.showCoverSubtitle ?? false,
  );
  const currentChapterTitle = useProjectStore(
    (s) => {
      const page = s.project.pages[s.currentPageIndex];
      if (!page) return '';
      return page.chapterTitle ?? (page.isCover ? (page.coverTitle ?? '') : '');
    },
  );
  const autoSaveEnabled = useProjectStore((s) => s.autoSaveEnabled);
  const autoSaveInterval = useProjectStore((s) => s.autoSaveInterval);
  const setAutoSaveEnabled = useProjectStore((s) => s.setAutoSaveEnabled);
  const setAutoSaveInterval = useProjectStore((s) => s.setAutoSaveInterval);

  const hasFileSystemAccess = 'showOpenFilePicker' in window;

  // Derived state
  const canDeleteSlot =
    selectedSlotIndex !== null &&
    currentSlotAssignments?.[selectedSlotIndex] !== undefined;
  const slotHasCrop =
    selectedSlotIndex !== null &&
    currentSlotAssignments?.[selectedSlotIndex]?.cropX !== undefined;
  const canDelete = !!selectedElementId || canDeleteSlot;
  const isSingleLayout = currentLayoutId === 'single';
  const showGap = !!currentLayoutId && !isSingleLayout;

  const selectedTextElement = useProjectStore((s) => {
    if (!s.selectedElementId) return null;
    const page = s.project.pages[s.currentPageIndex];
    if (!page) return null;
    const el = page.elements.find((e) => e.id === s.selectedElementId);
    if (el && el.type === 'text') return el;
    return null;
  });

  // ─── Dropdown menu state ────────────────────────────────────────────────
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [showPageOverview, setShowPageOverview] = useState(false);
  const [showAssetLibrary, setShowAssetLibrary] = useState(false);
  const [canvasZoomMode] = useState<'fit' | 'manual'>('fit');
  const [canvasManualZoom] = useState(1);
  const [autoSaveTimeline, setAutoSaveTimeline] = useState<AutoSaveRestorePoint[]>(() => {
    try {
      const raw = localStorage.getItem('layox_autoSaveTimeline');
      if (!raw) return [];
      const parsed = JSON.parse(raw) as AutoSaveRestorePoint[];
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item) => !!item && typeof item.createdAt === 'number' && item.project && typeof item.pageIndex === 'number');
    } catch {
      return [];
    }
  });
  const [pdfDefaultLevel, setPdfDefaultLevel] = useState<PdfCompressionLevel>(() => {
    const saved = localStorage.getItem('layox_pdfDefaultLevel');
    if (saved && PDF_COMPRESSION_PRESETS.some((preset) => preset.id === saved)) {
      return saved as PdfCompressionLevel;
    }
    return 'medium';
  });

  useEffect(() => {
    localStorage.setItem('layox_pdfDefaultLevel', pdfDefaultLevel);
  }, [pdfDefaultLevel]);

  useEffect(() => {
    localStorage.setItem('layox_autoSaveTimeline', JSON.stringify(autoSaveTimeline));
  }, [autoSaveTimeline]);

  const pushAutoSaveRestorePoint = useCallback((projectSnapshot: Project, pageIndex: number) => {
    const clone = JSON.parse(JSON.stringify(projectSnapshot)) as Project;
    const point: AutoSaveRestorePoint = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
      pageIndex,
      pageCount: clone.pages.length,
      projectName: clone.meta.name,
      project: clone,
    };

    setAutoSaveTimeline((prev) => [point, ...prev].slice(0, 12));
  }, []);

  const handleRestoreAutoSavePoint = useCallback((point: AutoSaveRestorePoint) => {
    snapshot();
    setProject(point.project);
    setCurrentPageIndex(Math.max(0, Math.min(point.pageIndex, point.project.pages.length - 1)));
    setOpenMenu(null);
  }, [setCurrentPageIndex, setProject, snapshot]);

  const toggleMenu = useCallback(
    (name: string) => setOpenMenu((prev) => (prev === name ? null : name)),
    [],
  );
  const closeMenu = useCallback(() => setOpenMenu(null), []);

  // Close menu on outside click
  useEffect(() => {
    if (!openMenu) return;
    const handle = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-menu]')) setOpenMenu(null);
    };
    requestAnimationFrame(() => document.addEventListener('mousedown', handle));
    return () => document.removeEventListener('mousedown', handle);
  }, [openMenu]);

  // ─── Crop modal state ──────────────────────────────────────────────────
  const [cropModal, setCropModal] = useState<{
    blob: Blob;
    initialCrop?: { x: number; y: number; w: number; h: number };
    slotIndex: number;
  } | null>(null);

  // ─── Page navigation ──────────────────────────────────────────────────
  const goPrevPage = () => {
    if (currentPageIndex > 0) setCurrentPageIndex(currentPageIndex - 1);
  };
  const goNextPage = () => {
    if (currentPageIndex < pages.length - 1) setCurrentPageIndex(currentPageIndex + 1);
  };

  // ─── Keyboard shortcuts ─────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA';

      // Ctrl+Z – Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        useProjectStore.getState().undo();
        return;
      }
      // Ctrl+Y or Ctrl+Shift+Z – Redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey) || (e.key === 'Z' && e.shiftKey))) {
        e.preventDefault();
        useProjectStore.getState().redo();
        return;
      }
      // Ctrl+S / Ctrl+Shift+S
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (e.shiftKey) {
          useProjectStore.getState().saveCurrentProjectAs();
        } else {
          useProjectStore.getState().saveCurrentProject();
        }
        return;
      }
      // Ctrl+O – Open
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        useProjectStore.getState().openProject();
        return;
      }
      // Ctrl+N – New project
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        setShowNewProjectModal(true);
        return;
      }
      // Ctrl+T – Add text
      if ((e.ctrlKey || e.metaKey) && e.key === 't') {
        if (!isInput) {
          e.preventDefault();
          useProjectStore.getState().snapshot();
          addTextElement();
        }
        return;
      }
      // Escape – Deselect / close menu
      if (e.key === 'Escape') {
        setOpenMenu(null);
        useProjectStore.getState().setSelectedElementId(null);
        useProjectStore.getState().setSelectedSlotIndex(null);
        return;
      }
      // Delete / Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (isInput) return;
        e.preventDefault();
        const state = useProjectStore.getState();
        state.snapshot();
        if (
          state.selectedSlotIndex !== null &&
          state.project.pages[state.currentPageIndex]?.slotAssignments?.[state.selectedSlotIndex]
        ) {
          removeImageFromSlot(state.selectedSlotIndex);
        } else if (state.selectedElementId) {
          removeElement(state.selectedElementId);
        }
        return;
      }
      // Arrow keys for page navigation
      if (isInput) return;
      if (e.key === 'ArrowLeft') {
        const s = useProjectStore.getState();
        if (s.currentPageIndex > 0) s.setCurrentPageIndex(s.currentPageIndex - 1);
      } else if (e.key === 'ArrowRight') {
        const s = useProjectStore.getState();
        if (s.currentPageIndex < s.project.pages.length - 1) s.setCurrentPageIndex(s.currentPageIndex + 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [removeElement, removeImageFromSlot, addTextElement, resetProject]);

  // Auto-save
  useEffect(() => {
    if (!autoSaveEnabled || autoSaveInterval <= 0) return;
    const id = setInterval(() => {
      const state = useProjectStore.getState();
      if (state.fileHandle) {
        state.saveCurrentProject()
          .then(() => {
            pushAutoSaveRestorePoint(state.project, state.currentPageIndex);
          })
          .catch((err) => console.error('Auto-save error:', err));
        return;
      }

      pushAutoSaveRestorePoint(state.project, state.currentPageIndex);
    }, autoSaveInterval * 1000);
    return () => clearInterval(id);
  }, [autoSaveEnabled, autoSaveInterval, pushAutoSaveRestorePoint]);

  // ─── Handlers ─────────────────────────────────────────────────────────
  const handleOpen = async () => {
    closeMenu();
    if (hasFileSystemAccess) {
      try { await openProject(); } catch (err) {
        console.error(t('openError'), err);
        alert(`${t('openError')}: ${err instanceof Error ? err.message : err}`);
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try { await loadFromFile(file); } catch (err) {
      console.error(t('loadError'), err);
      alert(`${t('loadError')}: ${err instanceof Error ? err.message : err}`);
    }
    e.target.value = '';
  };

  const handleSave = async () => { closeMenu(); try { await saveCurrentProject(); } catch (err) { alert(`${t('saveError')}: ${err}`); } };
  const handleSaveAs = async () => { closeMenu(); try { await saveCurrentProjectAs(); } catch (err) { alert(`${t('saveError')}: ${err}`); } };

  const handleNewProject = () => {
    closeMenu();
    setShowNewProjectModal(true);
  };

  const handleAddImage = () => { closeMenu(); imageInputRef.current?.click(); };
  const handleImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    snapshot();
    try { await addImageFromFile(file); } catch (err) { console.error(err); }
    e.target.value = '';
  };

  const handleAddText = () => { closeMenu(); snapshot(); addTextElement(); };
  const handleOpenAssetLibrary = () => { closeMenu(); setShowAssetLibrary(true); };
  const handleInsertFromAssetLibrary = async (assetPath: string) => {
    snapshot();
    await addImageFromAsset(assetPath);
  };
  const handleRemoveCover = () => { closeMenu(); snapshot(); toggleCover(false); };
  const handleMakeCover = () => { closeMenu(); snapshot(); toggleCover(true); };
  const handleAddPageFromMenu = () => { closeMenu(); snapshot(); addPage(); };

  const handleLayoutSelect = (layoutId: string | null) => {
    snapshot();
    if (layoutId) applyLayout(layoutId); else clearLayout();
  };

  const handleDelete = () => {
    closeMenu();
    snapshot();
    if (canDeleteSlot && selectedSlotIndex !== null) {
      removeImageFromSlot(selectedSlotIndex);
    } else if (selectedElementId) {
      removeElement(selectedElementId);
    }
  };

  const handleUndo = () => { closeMenu(); undo(); };
  const handleRedo = () => { closeMenu(); redo(); };

  const handleStartCrop = async () => {
    closeMenu();
    if (selectedSlotIndex === null) return;
    const assignment = currentSlotAssignments?.[selectedSlotIndex];
    if (!assignment) return;
    const blob = assetBlobs[assignment.assetPath];
    if (!blob) return;
    const initial = assignment.cropX !== undefined
      ? { x: assignment.cropX, y: assignment.cropY!, w: assignment.cropW!, h: assignment.cropH! }
      : undefined;
    setCropModal({ blob, initialCrop: initial, slotIndex: selectedSlotIndex });
  };

  const handleCropConfirm = (crop: { x: number; y: number; w: number; h: number }) => {
    snapshot();
    updateSlotCrop(cropModal!.slotIndex, crop.x, crop.y, crop.w, crop.h);
    setCropModal(null);
  };

  const handleCropCancel = () => setCropModal(null);

  const handleClearCrop = () => {
    closeMenu();
    if (selectedSlotIndex !== null) { snapshot(); clearSlotCrop(selectedSlotIndex); }
  };

  const handleGoHome = () => {
    closeMenu();
    const confirmed = window.confirm(t('homeConfirm'));
    if (confirmed) setShowEditor(false);
  };

  // ─── Export handlers ──────────────────────────────────────────────────
  const [showPdfDialog, setShowPdfDialog] = useState(false);

  const handleExportPdfPrompt = () => {
    closeMenu();
    setShowPdfDialog(true);
  };

  const handleExportPdfConfirm = async (level: PdfCompressionLevel) => {
    setShowPdfDialog(false);
    setPdfDefaultLevel(level);
    await exportAsPdf(pages.length, setCurrentPageIndex, projectName, level);
  };

  const handleExportPng = () => {
    closeMenu();
    exportCurrentPageAsPng(projectName, currentPageIndex);
  };

  const handleExportJpeg = () => {
    closeMenu();
    exportCurrentPageAsJpeg(projectName, currentPageIndex);
  };

  const handleExportZipPng = async () => {
    closeMenu();
    await exportAllPagesAsZip(pages.length, setCurrentPageIndex, projectName, 'png');
  };

  const handleExportZipJpeg = async () => {
    closeMenu();
    await exportAllPagesAsZip(pages.length, setCurrentPageIndex, projectName, 'jpeg');
  };

  const btnPageNav =
    'min-w-8 h-8 px-2 flex items-center justify-center rounded-lg border text-sm transition-all cursor-pointer select-none';
  const btnIcon =
    'w-7 h-7 flex items-center justify-center rounded-lg border text-sm transition-all cursor-pointer select-none disabled:opacity-35 disabled:cursor-not-allowed';

  const getVisiblePageItems = useCallback((total: number, current: number): Array<number | 'ellipsis-left' | 'ellipsis-right'> => {
    if (total <= 9) return Array.from({ length: total }, (_, i) => i);

    const items: Array<number | 'ellipsis-left' | 'ellipsis-right'> = [0];

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
    for (let i = start; i <= end; i++) items.push(i);
    if (end < total - 2) items.push('ellipsis-right');

    items.push(total - 1);
    return items;
  }, []);

  const pageItems = getVisiblePageItems(pages.length, currentPageIndex);

  const chapterJumpTargets = useMemo(() => {
    const seen = new Set<string>();
    return pages
      .map((page, index) => {
        if (page.isCover) {
          const coverLabel = (page.coverTitle ?? '').trim();
          return {
            pageIndex: index,
            label: coverLabel ? `${t('deckblatt')} • ${coverLabel}` : t('deckblatt'),
          };
        }

        const chapter = (page.chapterTitle ?? '').trim();
        if (!chapter) return null;
        const key = chapter;
        if (seen.has(key)) return null;
        seen.add(key);
        const label = chapter;
        return { pageIndex: index, label };
      })
      .filter((item): item is { pageIndex: number; label: string } => item !== null);
  }, [pages, t]);

  const getPageOverviewMetaLabel = useCallback((page: Page) => {
    if (page.isCover) {
      const coverLabel = (page.coverTitle ?? '').trim();
      return coverLabel ? `${t('deckblatt')} • ${coverLabel}` : t('deckblatt');
    }

    const chapter = (page.chapterTitle ?? '').trim();
    if (chapter) return chapter;
    return '—';
  }, [t]);

  return (
    <div className="editor-ui relative isolate flex flex-col w-screen h-screen bg-neutral-950 text-neutral-100" data-ui-theme={uiTheme}>
      {/* ─── Menu Bar ─── */}
      <div className="editor-topbar relative z-40 flex flex-wrap items-center gap-1.5 px-3 py-1.5 bg-neutral-900/95 border border-neutral-800 rounded-xl shadow-lg mx-4 mt-4 shrink-0 backdrop-blur-sm">

        <div className="order-first basis-full flex justify-center xl:order-none xl:basis-full xl:absolute xl:inset-x-0 xl:top-[21px] xl:-translate-y-1/2 xl:flex xl:justify-center xl:pointer-events-none">
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            onFocus={() => snapshot()}
            className="editor-input xl:pointer-events-auto w-full max-w-[380px] xl:w-[320px] xl:max-w-[320px] text-center text-sm text-neutral-300 font-semibold bg-neutral-900 border border-neutral-700 rounded-lg
                       outline-none focus:text-white focus:border-blue-500 py-0.5 px-2 hover:border-neutral-500 transition-colors"
            title={t('projectNameEdit')}
          />
        </div>

        {/* Undo / Redo */}
        <button onClick={handleUndo} disabled={!canUndo} className={`${btnIcon} editor-surface-control editor-toolbar-icon border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800`} title={`${t('undo')} (Ctrl+Z)`}>
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 7H4v5" />
            <path d="M4 12c1.6-3.8 4.8-5.8 8.7-5.8 5.1 0 8.3 3.6 8.3 8.8" />
          </svg>
        </button>
        <button onClick={handleRedo} disabled={!canRedo} className={`${btnIcon} editor-surface-control editor-toolbar-icon border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800`} title={`${t('redo')} (Ctrl+Y)`}>
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 7h5v5" />
            <path d="M20 12c-1.6-3.8-4.8-5.8-8.7-5.8-5.1 0-8.3 3.6-8.3 8.8" />
          </svg>
        </button>

        <div className="w-px h-5 bg-neutral-700/80" />

        {/* ── File menu ── */}
        <div className="relative" data-menu>
          <MenuButton label={t('file')} isOpen={openMenu === 'file'} onClick={() => toggleMenu('file')} />
          {openMenu === 'file' && (
            <div className="editor-dropdown absolute top-full left-0 mt-2 min-w-[230px] bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl z-[90] p-1">
              <MenuItem label={t('newProject')} shortcut="Ctrl+N" onClick={handleNewProject} />
              <MenuItem label={t('open')} shortcut="Ctrl+O" onClick={handleOpen} />
              <MenuDivider />
              <MenuItem label={t('save')} shortcut="Ctrl+S" onClick={handleSave} />
              <MenuItem label={t('saveAs')} shortcut="Ctrl+Shift+S" onClick={handleSaveAs} />
              <MenuDivider />
              <MenuItem label={t('exportPdf')} onClick={handleExportPdfPrompt} />
              <MenuItem label={t('exportPng')} onClick={handleExportPng} />
              <MenuItem label={t('exportJpeg')} onClick={handleExportJpeg} />
              <MenuItem label={t('exportZipPng')} onClick={handleExportZipPng} />
              <MenuItem label={t('exportZipJpeg')} onClick={handleExportZipJpeg} />
              <MenuDivider />
              <MenuItem label={t('home')} onClick={handleGoHome} />
            </div>
          )}
        </div>

        {/* ── Edit menu ── */}
        <div className="relative" data-menu>
          <MenuButton label={t('edit')} isOpen={openMenu === 'edit'} onClick={() => toggleMenu('edit')} />
          {openMenu === 'edit' && (
            <div className="editor-dropdown absolute top-full left-0 mt-2 min-w-[230px] bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl z-[90] p-1">
              <MenuItem label={t('undo')} shortcut="Ctrl+Z" onClick={handleUndo} disabled={!canUndo} />
              <MenuItem label={t('redo')} shortcut="Ctrl+Y" onClick={handleRedo} disabled={!canRedo} />
              <MenuDivider />
              <MenuItem label={t('delete')} shortcut="Del" onClick={handleDelete} disabled={!canDelete} danger />
              {canDeleteSlot && (
                <>
                  <MenuDivider />
                  <MenuItem label={t('crop')} onClick={handleStartCrop} disabled={!canDeleteSlot} />
                  <MenuItem label={t('resetCrop')} onClick={handleClearCrop} disabled={!slotHasCrop} />
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Insert menu ── */}
        <div className="relative" data-menu>
          <MenuButton label={t('insert')} isOpen={openMenu === 'insert'} onClick={() => toggleMenu('insert')} />
          {openMenu === 'insert' && (
            <div className="editor-dropdown absolute top-full left-0 mt-2 min-w-[220px] bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl z-[90] p-1">
              <MenuItem label={t('pageNew')} onClick={handleAddPageFromMenu} />
              <MenuDivider />
              <MenuItem label={t('addImageLabel')} shortcut="Ctrl+I" onClick={handleAddImage} />
              <MenuItem label={t('insertFromLibrary')} onClick={handleOpenAssetLibrary} />
              <MenuItem label={t('addTextLabel')} shortcut="Ctrl+T" onClick={handleAddText} />
              <MenuDivider />
              {currentIsCover ? (
                <MenuItem label={t('removeCoverLabel')} onClick={handleRemoveCover} danger />
              ) : (
                <MenuItem label={t('addCoverLabel')} onClick={handleMakeCover} />
              )}
            </div>
          )}
        </div>

        {/* ── Layout menu ── */}
        <div className="relative" data-menu>
          <MenuButton label={t('layout')} isOpen={openMenu === 'layout'} onClick={() => toggleMenu('layout')} />
          {openMenu === 'layout' && (
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
                  onSelect={(id) => { handleLayoutSelect(id); closeMenu(); }}
                />
              </div>
              {currentLayoutId && (
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-neutral-700">
                  <label className="text-xs text-neutral-500">{t('margin')}</label>
                  <input
                    type="number" min={0} max={100} value={currentLayoutPadding}
                    onFocus={() => snapshot()}
                    onChange={(e) => setLayoutPadding(Math.max(0, parseInt(e.target.value) || 0))}
                    className="editor-input w-16 px-2 py-1 text-sm rounded-md bg-neutral-800 text-white border border-neutral-600"
                  />
                  {showGap && (
                    <>
                      <label className="text-xs text-neutral-500">{t('gap')}</label>
                      <input
                        type="number" min={0} max={100} value={currentLayoutGap}
                        onFocus={() => snapshot()}
                        onChange={(e) => setLayoutGap(Math.max(0, parseInt(e.target.value) || 0))}
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
                    onFocus={() => snapshot()}
                    onChange={(e) => setDefaultLayoutPadding(Math.max(0, parseInt(e.target.value) || 0))}
                    className="editor-input w-16 px-2 py-1 text-sm rounded-md bg-neutral-800 text-white border border-neutral-600"
                  />
                  <label className="text-xs text-neutral-500">{t('gap')}</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={defaultLayoutGap}
                    onFocus={() => snapshot()}
                    onChange={(e) => setDefaultLayoutGap(Math.max(0, parseInt(e.target.value) || 0))}
                    className="editor-input w-16 px-2 py-1 text-sm rounded-md bg-neutral-800 text-white border border-neutral-600"
                  />
                </div>
                <button
                  onClick={() => { snapshot(); applyLayoutDefaultsToAllPages(); }}
                  className="editor-surface-control w-full mt-1 px-2.5 py-1.5 text-xs rounded-md border border-neutral-600 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors cursor-pointer select-none"
                  title={t('applyToAllPages')}
                >
                  {t('applyToAllPages')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Structure menu ── */}
        <div className="relative" data-menu>
          <MenuButton label={t('structure')} isOpen={openMenu === 'structure'} onClick={() => toggleMenu('structure')} />
          {openMenu === 'structure' && (
            <div className="editor-dropdown absolute top-full left-0 mt-2 min-w-[290px] bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl z-[90] p-1">
              <div className="px-3 py-2 space-y-2">
                <div className="text-xs text-neutral-400">{t('currentPage')}</div>
                <input
                  type="text"
                  placeholder={t('chapter')}
                  value={currentChapterTitle}
                  onFocus={() => snapshot()}
                  onChange={(e) => setCurrentPageChapterTitle(e.target.value)}
                  className="editor-input w-full px-2 py-1 text-xs rounded-md bg-neutral-800 text-white border border-neutral-600"
                  title={t('chapter')}
                />
                {currentChapterTitle && (
                  <button
                    onClick={() => {
                      snapshot();
                      setCurrentPageChapterTitle('');
                    }}
                    className="editor-surface-control w-full px-2 py-1 text-xs rounded-md border border-neutral-600 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors cursor-pointer select-none"
                  >
                    Remove {t('chapter')}
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
                      onChange={(e) => {
                        if (!e.target.value) return;
                        setCurrentPageIndex(parseInt(e.target.value, 10));
                        closeMenu();
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

        {/* ── Spacer ── */}
        <div className="flex-1" />

        {/* ── Page navigation (numbers + add/delete) ── */}
        <div className="relative flex items-center" data-menu>
          <div className="relative mr-1.5">
            <button
              onClick={() => toggleMenu('quick-settings')}
              className={`${btnPageNav} editor-surface-control border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800`}
              title={t('settingsQuick')}
              aria-label={t('settingsQuick')}
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33h0A1.65 1.65 0 0 0 10 3.09V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>

            {openMenu === 'quick-settings' && (
              <div className="editor-dropdown absolute top-full left-0 mt-2 w-64 max-w-[calc(100vw-2rem)] bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl z-[90] p-2">
              <div className="px-2 pt-1 pb-2">
                <div className="text-xs text-neutral-400 mb-1.5">{t('uiMode')}</div>
                <select
                  value={uiTheme}
                  onChange={(e) => setUiTheme(e.target.value === 'light' ? 'light' : 'dark')}
                  className="editor-input w-full px-2 py-1 text-xs rounded-md bg-neutral-800 text-white border border-neutral-600"
                >
                  <option value="dark">{t('dark')}</option>
                  <option value="light">{t('light')}</option>
                </select>
              </div>

              <MenuDivider />

              <div className="px-2 pt-1 pb-2">
                <div className="text-xs text-neutral-400 mb-1.5">{t('language')}</div>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value === 'en' ? 'en' : 'de')}
                  className="editor-input w-full px-2 py-1 text-xs rounded-md bg-neutral-800 text-white border border-neutral-600"
                >
                  <option value="de">{t('german')}</option>
                  <option value="en">{t('english')}</option>
                </select>
              </div>

              <MenuDivider />

              <div className="px-2 pt-1 pb-2">
                <label className="text-xs text-neutral-400 flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoSaveEnabled}
                    onChange={(e) => setAutoSaveEnabled(e.target.checked)}
                    className="accent-blue-500"
                  />
                  {t('autoSaveEnable')}
                </label>

                {autoSaveEnabled && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-neutral-500">{t('interval')}</span>
                    <select
                      value={autoSaveInterval}
                      onChange={(e) => setAutoSaveInterval(parseInt(e.target.value, 10))}
                      className="editor-input px-2 py-1 text-xs rounded-md bg-neutral-800 text-white border border-neutral-600"
                    >
                      <option value={10}>10s</option>
                      <option value={30}>30s</option>
                      <option value={60}>60s</option>
                      <option value={120}>2min</option>
                      <option value={300}>5min</option>
                    </select>
                  </div>
                )}

                <div className="mt-2 pt-2 border-t border-neutral-700/70">
                  <div className="text-xs text-neutral-400 mb-1.5">{t('autoSaveHistory')}</div>
                  {autoSaveTimeline.length === 0 ? (
                    <div className="text-[11px] text-neutral-500">{t('noRestorePoints')}</div>
                  ) : (
                    <div className="max-h-36 overflow-auto space-y-1 pr-1">
                      {autoSaveTimeline.map((point) => (
                        <button
                          key={point.id}
                          onClick={() => handleRestoreAutoSavePoint(point)}
                          className="editor-surface-control w-full px-2 py-1.5 rounded-md border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-left transition-colors cursor-pointer"
                          title={t('restorePoint')}
                        >
                          <div className="text-[11px] text-neutral-200">{new Date(point.createdAt).toLocaleTimeString(language === 'de' ? 'de-DE' : 'en-US')}</div>
                          <div className="text-[10px] text-neutral-500 truncate">{point.projectName} • {point.pageCount} {t('pages')}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              </div>
            )}
          </div>

          <div className="w-px h-5 bg-neutral-700/80 mx-1" />

          <button
            onClick={() => setShowPageOverview(true)}
            className="editor-page-label mr-2 px-2.5 py-1 rounded-md border border-neutral-700 bg-neutral-900 text-[11px] uppercase tracking-wide text-neutral-400 hover:bg-neutral-800 transition-colors cursor-pointer select-none"
            title={t('openPageOverview')}
          >
            {t('pages')}
          </button>

          <div className="flex items-center gap-1">
            {pageItems.map((item) => {
              if (item === 'ellipsis-left' || item === 'ellipsis-right') {
                return (
                  <span key={item} className="px-1 text-neutral-500 text-sm select-none">…</span>
                );
              }

              const i = item;
              return (
                <button
                  key={i}
                  onClick={() => setCurrentPageIndex(i)}
                  className={`editor-page-chip ${btnPageNav} ${
                    i === currentPageIndex
                      ? 'is-active bg-blue-600/90 border-blue-500 text-white shadow-sm'
                      : 'bg-neutral-900 border-neutral-700 hover:bg-neutral-800 text-neutral-300'
                  }`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>

          <span className="editor-page-count ml-2 text-xs text-neutral-400 tabular-nums select-none">
            {currentPageIndex + 1} / {pages.length}
          </span>

          <div className="flex items-center gap-1 ml-3 pl-3 border-l border-neutral-700/80">
            <button
              onClick={() => { snapshot(); addPage(); }}
              className={`editor-page-chip ${btnPageNav} bg-neutral-900 border-neutral-700 hover:bg-neutral-800 text-neutral-300`}
              title={t('pageNew')}
            >
              +
            </button>
            {pages.length > 1 && (
              <button
                onClick={() => { snapshot(); removePage(currentPageIndex); }}
                className={`editor-page-chip editor-page-chip-danger ${btnPageNav} bg-red-900/60 border-red-800 hover:bg-red-800/70 text-red-200`}
                title={t('pageDelete')}
              >
                −
              </button>
            )}
          </div>

        </div>

        {/* Hidden file inputs */}
        <input ref={fileInputRef} type="file" accept=".layox" className="hidden" onChange={handleFileSelected} />
        <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelected} />

        {(selectedTextElement || currentIsCover) && (
          <div className="editor-context-bar basis-full mt-2 pt-2 border-t border-neutral-800/90 flex items-center gap-3 px-1 pb-1 text-sm">
            {selectedTextElement ? (
              <>
            <label className="text-xs text-neutral-500">{t('font')}</label>
            <select
              value={selectedTextElement.fontFamily}
              onChange={(e) => { snapshot(); updateElement(selectedTextElement.id, { fontFamily: e.target.value }); }}
              className="editor-input px-2 py-0.5 text-sm rounded-md bg-neutral-800 text-white border border-neutral-600"
            >
              {FONTS.map((f) => (
                <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
              ))}
            </select>
            <label className="text-xs text-neutral-500">{t('size')}</label>
            <input
              type="number" min={1} max={200} value={selectedTextElement.fontSize}
              onFocus={() => snapshot()}
              onChange={(e) => updateElement(selectedTextElement.id, { fontSize: Math.max(1, parseInt(e.target.value) || 24) })}
              className="editor-input w-16 px-2 py-0.5 text-sm rounded-md bg-neutral-800 text-white border border-neutral-600"
            />
            <label className="text-xs text-neutral-500">{t('color')}</label>
            <input
              type="color" value={selectedTextElement.color}
              onFocus={() => snapshot()}
              onChange={(e) => updateElement(selectedTextElement.id, { color: e.target.value })}
              className="editor-color-input w-8 h-8 rounded-md border border-neutral-600 cursor-pointer p-0.5 bg-neutral-800"
            />
              </>
            ) : currentIsCover ? (
              <>
            <label className="text-[11px] text-neutral-500">{t('title')}</label>
            <input
              type="text" value={currentCoverTitle}
              onFocus={() => snapshot()}
              onChange={(e) => setCoverTitle(e.target.value)}
              className="editor-input w-36 px-2 py-0.5 text-xs rounded-md bg-neutral-800 text-white border border-neutral-600"
              placeholder={t('title')}
            />
            <select
              value={currentCoverTitleFontFamily}
              onChange={(e) => { snapshot(); setCoverTitleStyle({ fontFamily: e.target.value }); }}
              className="editor-input w-24 px-1.5 py-0.5 text-xs rounded-md bg-neutral-800 text-white border border-neutral-600"
            >
              {FONTS.map((f) => (
                <option key={`cover-title-${f}`} value={f}>{f}</option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              max={300}
              value={currentCoverTitleFontSize}
              onFocus={() => snapshot()}
              onChange={(e) => setCoverTitleStyle({ fontSize: Math.max(1, parseInt(e.target.value) || 48) })}
              className="editor-input w-14 px-1.5 py-0.5 text-xs rounded-md bg-neutral-800 text-white border border-neutral-600"
            />
            <input
              type="color"
              value={currentCoverTitleColor}
              onFocus={() => snapshot()}
              onChange={(e) => setCoverTitleStyle({ color: e.target.value })}
              className="editor-color-input w-7 h-7 rounded-md border border-neutral-600 cursor-pointer p-0.5 bg-neutral-800"
            />

            <label className="text-[11px] text-neutral-400 flex items-center gap-1 ml-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={currentShowCoverSubtitle}
                onChange={(e) => {
                  snapshot();
                  setCoverSubtitleVisible(e.target.checked);
                }}
                className="accent-blue-500"
              />
              {t('showSubtitle')}
            </label>

            {currentShowCoverSubtitle && (
              <>
                <label className="text-[11px] text-neutral-500">{t('subtitle')}</label>
                <input
                  type="text" value={currentCoverSubtitle}
                  onFocus={() => snapshot()}
                  onChange={(e) => setCoverSubtitle(e.target.value)}
                  className="editor-input w-28 px-2 py-0.5 text-xs rounded-md bg-neutral-800 text-white border border-neutral-600"
                  placeholder={t('subtitle')}
                />
                <select
                  value={currentCoverSubtitleFontFamily}
                  onChange={(e) => { snapshot(); setCoverSubtitleStyle({ fontFamily: e.target.value }); }}
                  className="editor-input w-24 px-1.5 py-0.5 text-xs rounded-md bg-neutral-800 text-white border border-neutral-600"
                >
                  {FONTS.map((f) => (
                    <option key={`cover-sub-${f}`} value={f}>{f}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  max={300}
                  value={currentCoverSubtitleFontSize}
                  onFocus={() => snapshot()}
                  onChange={(e) => setCoverSubtitleStyle({ fontSize: Math.max(1, parseInt(e.target.value) || 24) })}
                  className="editor-input w-14 px-1.5 py-0.5 text-xs rounded-md bg-neutral-800 text-white border border-neutral-600"
                />
                <input
                  type="color"
                  value={currentCoverSubtitleColor}
                  onFocus={() => snapshot()}
                  onChange={(e) => setCoverSubtitleStyle({ color: e.target.value })}
                  className="editor-color-input w-7 h-7 rounded-md border border-neutral-600 cursor-pointer p-0.5 bg-neutral-800"
                />
              </>
            )}

            <button
              onClick={() => { snapshot(); toggleCover(false); }}
              className="ml-auto px-2 py-0.5 text-[11px] rounded-md border border-red-800 bg-red-900/50 hover:bg-red-800/60 text-red-200 transition-colors cursor-pointer select-none"
              title={t('removeCoverLabel')}
            >
              {t('removeCoverLabel')}
            </button>
              </>
            ) : null}
          </div>
        )}
      </div>

      {/* ─── Canvas area with page arrows on sides ─── */}
      <div className="relative z-0 flex-1 min-h-0 flex items-center justify-center overflow-hidden gap-2 px-0 py-2">
        {/* Left arrow */}
        <button
          onClick={goPrevPage}
          disabled={currentPageIndex === 0}
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
            zoomMode={canvasZoomMode}
            manualZoom={canvasManualZoom}
            dropImagesLabel={t('dropImagesHere')}
            imageLabelPrefix={t('imageSlotLabel')}
            editTextPlaceholder={t('editTextPlaceholder')}
            coverTitleFallback={t('title')}
            coverSubtitleFallback={t('subtitle')}
            lowResolutionHintText={(percent) =>
              t('lowResolutionHint').replace('{percent}', String(percent))
            }
          />
        </div>

        {/* Right arrow / Add page */}
        {currentPageIndex >= pages.length - 1 ? (
          <button
            onClick={() => { snapshot(); addPage(); }}
            className="editor-side-nav shrink-0 w-11 h-11 flex items-center justify-center rounded-xl border border-green-700/50
                       bg-neutral-900 hover:bg-green-900/40 text-green-300
                       transition-all cursor-pointer select-none text-2xl leading-none"
            title={t('pageAdd')}
          >
            +
          </button>
        ) : (
          <button
            onClick={goNextPage}
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

      {/* ─── Crop modal ─── */}
      {cropModal && (
        <CropModal
          imageBlob={cropModal.blob}
          initialCrop={cropModal.initialCrop}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
          loadingLabel={t('loadingImage')}
          doneLabel={t('done')}
          cancelLabel={t('cancel')}
        />
      )}

      {/* ─── PDF compression dialog ─── */}
      {showPdfDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
          <div className="editor-dropdown bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl p-5 w-80">
            <h3 className="text-white font-semibold text-base mb-3">{t('pdfCompression')}</h3>
            <div className="flex flex-col gap-2">
              {PDF_COMPRESSION_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handleExportPdfConfirm(preset.id)}
                  className={`text-left px-3 py-2.5 rounded-lg border transition-colors
                             cursor-pointer select-none ${
                               preset.id === pdfDefaultLevel
                                 ? 'bg-blue-600/15 border-blue-500'
                                 : 'bg-neutral-800 border-neutral-600 hover:bg-blue-600/20 hover:border-blue-500'
                             }`}
                >
                  <div className="text-sm text-white font-medium flex items-center gap-2">
                    {preset.label}
                    {preset.id === pdfDefaultLevel && (
                      <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border border-blue-500/70 text-blue-200">
                        {t('pdfDefault')}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-neutral-400 mt-0.5">{preset.description}</div>
                </button>
              ))}
            </div>
            <div className="mt-2 text-[11px] text-neutral-500">{t('pdfRemembered')}</div>
            <button
              onClick={() => setShowPdfDialog(false)}
              className="mt-3 w-full py-1.5 text-sm rounded-lg bg-neutral-800 hover:bg-neutral-700
                         text-neutral-300 border border-neutral-600 cursor-pointer select-none transition-colors"
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      )}

      <PageOverviewModal
        open={showPageOverview}
        pages={pages}
        assetBlobs={assetBlobs}
        currentPageIndex={currentPageIndex}
        onSelectPage={(index) => setCurrentPageIndex(index)}
        onMovePage={(fromIndex, toIndex) => {
          snapshot();
          movePage(fromIndex, toIndex);
        }}
        onClose={() => setShowPageOverview(false)}
        title={t('pageOverview')}
        closeLabel={t('close')}
        noPreviewLabel={t('noPreview')}
        dragToReorderLabel={t('dragToReorder')}
        chapterNavLabel={t('chapterPanel')}
        searchPlaceholder={t('searchChapter')}
        getMetaLabel={getPageOverviewMetaLabel}
      />

      <AssetLibraryModal
        open={showAssetLibrary}
        assetBlobs={assetBlobs}
        title={t('assetLibrary')}
        closeLabel={t('close')}
        emptyLabel={t('noAssets')}
        onInsert={handleInsertFromAssetLibrary}
        onClose={() => setShowAssetLibrary(false)}
      />

      <NewProjectModal
        open={showNewProjectModal}
        onClose={() => setShowNewProjectModal(false)}
        title={t('newProject')}
        description={t('enterProjectName')}
        cancelLabel={t('cancel')}
        confirmLabel={t('create')}
        placeholder={t('projectNamePlaceholder')}
        onConfirm={(name) => {
          resetProject(name);
          setShowNewProjectModal(false);
        }}
      />
    </div>
  );
}

export default App;
