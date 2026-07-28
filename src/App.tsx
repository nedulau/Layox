import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import './index.css';
import EditorCanvas from './components/canvas/EditorCanvas';
import LayoutPicker from './components/LayoutPicker';
import StartScreen from './components/StartScreen';
import CropModal from './components/CropModal';
import NewProjectModal from './components/NewProjectModal';
import useProjectStore from './store/useProjectStore';
import { exportAsPdf, exportCurrentPageAsPng, exportCurrentPageAsJpeg, exportAllPagesAsZip, PDF_COMPRESSION_PRESETS } from './utils/exportProject';
import type { ExportJobOptions, PdfCompressionLevel, ProjectExportContext } from './utils/exportProject';
import { tr, type Language, type TranslationKey } from './i18n';
import type { Page } from './types';
import { readStoredBoolean, readStoredString, removeStoredValue, writeStoredString } from './infra/storage';
import { getFileSystemPort } from './infra/fileSystem';
import { recoveryRepository, type RecoverySummary } from './utils/recoveryRepository';
import { konvaPageRenderer } from './utils/konvaPageRenderer';
import { v4 as uuidv4 } from 'uuid';
import {
  DEFAULT_COVER_SUBTITLE_COLOR,
  DEFAULT_COVER_SUBTITLE_FONT_FAMILY,
  DEFAULT_COVER_SUBTITLE_FONT_SIZE,
  DEFAULT_COVER_TITLE_COLOR,
  DEFAULT_COVER_TITLE_FONT_FAMILY,
  DEFAULT_COVER_TITLE_FONT_SIZE,
  DEFAULT_LAYOUT_GAP,
  DEFAULT_LAYOUT_PADDING,
} from './domain/projectDefaults';
import { MenuButton, MenuDivider, MenuItem } from './components/editor/MenuComponents';
import AssetLibraryModal from './components/editor/AssetLibraryModal';
import { useDialogFocus } from './components/common/useDialogFocus';
import { useMediaQuery } from './hooks/useMediaQuery';
import ConfirmDialog from './components/common/ConfirmDialog';
import PwaUpdatePrompt from './components/PwaUpdatePrompt';
import { useAutoSave } from './hooks/useAutoSave';

const FONTS = ['Arial', 'Times New Roman', 'Georgia', 'Verdana', 'Courier New', 'Trebuchet MS', 'Impact', 'Comic Sans MS'];
type UiTheme = 'dark' | 'light';
const fileSystemPort = getFileSystemPort();

function App() {
  const [uiTheme, setUiTheme] = useState<UiTheme>(() => {
    const saved = readStoredString('layox_uiTheme', 'dark');
    return saved === 'light' ? 'light' : 'dark';
  });
  const [language, setLanguage] = useState<Language>(() => {
    const saved = readStoredString('layox_language', 'de');
    return saved === 'en' ? 'en' : 'de';
  });

  useEffect(() => {
    writeStoredString('layox_uiTheme', uiTheme);
  }, [uiTheme]);

  useEffect(() => {
    writeStoredString('layox_language', language);
  }, [language]);

  const showEditor = useProjectStore((s) => s.showEditor);
  const setShowEditor = useProjectStore((s) => s.setShowEditor);
  const isDirty = useProjectStore((s) => s.isDirty);
  const phoneViewport = useMediaQuery('(max-width: 767px)');
  if (!showEditor) {
    return (
      <>
        <StartScreen uiTheme={uiTheme} setUiTheme={setUiTheme} language={language} setLanguage={setLanguage} />
        <PwaUpdatePrompt language={language} isDirty={isDirty} />
      </>
    );
  }
  if (phoneViewport) {
    return (
      <>
      <div className="app-ui start-ui flex h-screen w-screen items-center justify-center px-6" data-ui-theme={uiTheme}>
        <div className="max-w-md rounded-2xl border border-neutral-700 bg-neutral-900 p-6 text-center shadow-2xl">
          <h1 className="text-xl font-semibold text-white">{tr(language, 'phoneEditorTitle')}</h1>
          <p className="mt-3 text-sm leading-6 text-neutral-300">{tr(language, 'phoneEditorMessage')}</p>
          <button type="button" onClick={() => setShowEditor(false)} className="mt-5 min-h-11 rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-500">
            {tr(language, 'backHome')}
          </button>
        </div>
      </div>
      <PwaUpdatePrompt language={language} isDirty={isDirty} />
      </>
    );
  }
  return (
    <>
      <Editor uiTheme={uiTheme} setUiTheme={setUiTheme} language={language} setLanguage={setLanguage} />
      <PwaUpdatePrompt language={language} isDirty={isDirty} />
    </>
  );
}

import PageOverviewModal from './components/editor/PageOverviewModal';
import FileMenu from './components/editor/FileMenu';
import SaveStatus from './components/editor/SaveStatus';
import QuickSettingsMenu from './components/editor/QuickSettingsMenu';
import KeyboardShortcutsDialog from './components/editor/KeyboardShortcutsDialog';
import AssetTray, { type AssetTrayItem } from './components/editor/AssetTray';
import PageFilmstrip from './components/editor/PageFilmstrip';

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
  const t = useCallback((key: TranslationKey) => tr(language, key), [language]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Store selectors
  const saveCurrentProject = useProjectStore((s) => s.saveCurrentProject);
  const saveCurrentProjectAs = useProjectStore((s) => s.saveCurrentProjectAs);
  const openProject = useProjectStore((s) => s.openProject);
  const loadFromFile = useProjectStore((s) => s.loadFromFile);
  const restoreRecoveredProject = useProjectStore((s) => s.restoreRecoveredProject);
  const resetProject = useProjectStore((s) => s.resetProject);
  const setProjectName = useProjectStore((s) => s.setProjectName);
  const projectName = useProjectStore((s) => s.project.meta.name);
  const projectId = useProjectStore((s) => s.project.meta.id);
  const snapshot = useProjectStore((s) => s.snapshot);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const canUndo = useProjectStore((s) => s.historyPast.length > 0);
  const canRedo = useProjectStore((s) => s.historyFuture.length > 0);

  const addImageFromFile = useProjectStore((s) => s.addImageFromFile);
  const addImageFromAsset = useProjectStore((s) => s.addImageFromAsset);
  const removeAsset = useProjectStore((s) => s.removeAsset);
  const addTextElement = useProjectStore((s) => s.addTextElement);
  const removeElement = useProjectStore((s) => s.removeElement);
  const removeImageFromSlot = useProjectStore((s) => s.removeImageFromSlot);
  const pruneUnusedAssets = useProjectStore((s) => s.pruneUnusedAssets);
  const clearSlotCrop = useProjectStore((s) => s.clearSlotCrop);
  const updateSlotCrop = useProjectStore((s) => s.updateSlotCrop);
  const selectedElementId = useProjectStore((s) => s.selectedElementId);
  const selectedSlotIndex = useProjectStore((s) => s.selectedSlotIndex);
  const setSelectedElementId = useProjectStore((s) => s.setSelectedElementId);
  const setSelectedSlotIndex = useProjectStore((s) => s.setSelectedSlotIndex);
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
  const setCurrentPageSubchapterTitle = useProjectStore((s) => s.setCurrentPageSubchapterTitle);
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
    (s) => s.project.meta.defaultLayoutPadding ?? DEFAULT_LAYOUT_PADDING,
  );
  const defaultLayoutGap = useProjectStore(
    (s) => s.project.meta.defaultLayoutGap ?? DEFAULT_LAYOUT_GAP,
  );
  const currentLayoutPadding = useProjectStore(
    (s) => s.project.pages[s.currentPageIndex]?.layoutPadding ?? (s.project.meta.defaultLayoutPadding ?? DEFAULT_LAYOUT_PADDING),
  );
  const currentLayoutGap = useProjectStore(
    (s) => s.project.pages[s.currentPageIndex]?.layoutGap ?? (s.project.meta.defaultLayoutGap ?? DEFAULT_LAYOUT_GAP),
  );
  const setCurrentPageIndex = useProjectStore((s) => s.setCurrentPageIndex);
  const addPage = useProjectStore((s) => s.addPage);
  const removePage = useProjectStore((s) => s.removePage);
  const movePage = useProjectStore((s) => s.movePage);
  const duplicatePage = useProjectStore((s) => s.duplicatePage);

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
    (s) => s.project.pages[s.currentPageIndex]?.coverTitleFontSize ?? DEFAULT_COVER_TITLE_FONT_SIZE,
  );
  const currentCoverTitleFontFamily = useProjectStore(
    (s) => s.project.pages[s.currentPageIndex]?.coverTitleFontFamily ?? DEFAULT_COVER_TITLE_FONT_FAMILY,
  );
  const currentCoverTitleColor = useProjectStore(
    (s) => s.project.pages[s.currentPageIndex]?.coverTitleColor ?? DEFAULT_COVER_TITLE_COLOR,
  );
  const currentCoverSubtitleFontSize = useProjectStore(
    (s) => s.project.pages[s.currentPageIndex]?.coverSubtitleFontSize ?? DEFAULT_COVER_SUBTITLE_FONT_SIZE,
  );
  const currentCoverSubtitleFontFamily = useProjectStore(
    (s) => s.project.pages[s.currentPageIndex]?.coverSubtitleFontFamily ?? DEFAULT_COVER_SUBTITLE_FONT_FAMILY,
  );
  const currentCoverSubtitleColor = useProjectStore(
    (s) => s.project.pages[s.currentPageIndex]?.coverSubtitleColor ?? DEFAULT_COVER_SUBTITLE_COLOR,
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
  const currentSubchapterTitle = useProjectStore(
    (s) => s.project.pages[s.currentPageIndex]?.subchapterTitle ?? '',
  );
  const autoSaveEnabled = useProjectStore((s) => s.autoSaveEnabled);
  const autoSaveInterval = useProjectStore((s) => s.autoSaveInterval);
  const setAutoSaveEnabled = useProjectStore((s) => s.setAutoSaveEnabled);
  const setAutoSaveInterval = useProjectStore((s) => s.setAutoSaveInterval);
  const isDirty = useProjectStore((s) => s.isDirty);
  const isSaving = useProjectStore((s) => s.isSaving);
  const saveError = useProjectStore((s) => s.saveError);

  const hasFileSystemAccess = fileSystemPort.supportsNativePicker();

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
  const [showQuickImageBar, setShowQuickImageBar] = useState<boolean>(() => readStoredBoolean('layox_showQuickImageBar', true));
  const [deleteFromLibraryOnImageDelete, setDeleteFromLibraryOnImageDelete] = useState<boolean>(() => readStoredBoolean('layox_deleteFromLibraryOnImageDelete', false));
  const [quickInsertAssetPath, setQuickInsertAssetPath] = useState<string | null>(null);
  const [canvasZoomMode, setCanvasZoomMode] = useState<'fit' | 'manual'>('fit');
  const [canvasManualZoom, setCanvasManualZoom] = useState(1);
  const [canvasDisplayScale, setCanvasDisplayScale] = useState(1);
  const [recoveryPoints, setRecoveryPoints] = useState<RecoverySummary[]>([]);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const exportAbortRef = useRef<AbortController | null>(null);
  const [exportJob, setExportJob] = useState<{ label: string; completed: number; total: number } | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [uiError, setUiError] = useState<string | null>(null);
  const [uiNotice, setUiNotice] = useState<string | null>(null);
  const [noticeCanUndo, setNoticeCanUndo] = useState(false);
  const [importJob, setImportJob] = useState<{ completed: number; total: number } | null>(null);
  const [showHomeConfirm, setShowHomeConfirm] = useState(false);
  const [showPdfDialog, setShowPdfDialog] = useState(false);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const pdfDialogRef = useDialogFocus<HTMLDivElement>(showPdfDialog, () => setShowPdfDialog(false));
  const exportDialogRef = useDialogFocus<HTMLDivElement>(exportJob !== null, () => exportAbortRef.current?.abort());
  const [pdfDefaultLevel, setPdfDefaultLevel] = useState<PdfCompressionLevel>(() => {
    const saved = readStoredString('layox_pdfDefaultLevel', 'medium');
    if (saved && PDF_COMPRESSION_PRESETS.some((preset) => preset.id === saved)) {
      return saved as PdfCompressionLevel;
    }
    return 'medium';
  });

  useEffect(() => {
    writeStoredString('layox_pdfDefaultLevel', pdfDefaultLevel);
  }, [pdfDefaultLevel]);

  useEffect(() => {
    writeStoredString('layox_showQuickImageBar', String(showQuickImageBar));
  }, [showQuickImageBar]);

  useEffect(() => {
    writeStoredString('layox_deleteFromLibraryOnImageDelete', String(deleteFromLibraryOnImageDelete));
  }, [deleteFromLibraryOnImageDelete]);

  useEffect(() => {
    if (!uiNotice) return;
    const timeout = window.setTimeout(() => {
      setUiNotice(null);
      setNoticeCanUndo(false);
    }, 6_000);
    return () => window.clearTimeout(timeout);
  }, [uiNotice]);

  const quickInsertAssetPaths = useMemo(() => Object.keys(assetBlobs).sort(), [assetBlobs]);
  const assetTrayItems = useMemo<AssetTrayItem[]>(() => {
    const usage = new Map<string, number>();
    for (const page of pages) {
      for (const element of page.elements) {
        if (element.type === 'image') usage.set(element.src, (usage.get(element.src) ?? 0) + 1);
      }
      for (const assignment of Object.values(page.slotAssignments ?? {})) {
        usage.set(assignment.assetPath, (usage.get(assignment.assetPath) ?? 0) + 1);
      }
    }
    return quickInsertAssetPaths.map((assetPath) => ({
      assetPath,
      blob: assetBlobs[assetPath],
      usageCount: usage.get(assetPath) ?? 0,
    }));
  }, [assetBlobs, pages, quickInsertAssetPaths]);
  const assetUsageCounts = useMemo(
    () => Object.fromEntries(assetTrayItems.map((item) => [item.assetPath, item.usageCount])),
    [assetTrayItems],
  );

  const refreshRecoveryPoints = useCallback(async () => {
    try {
      setRecoveryPoints(await recoveryRepository.list(projectId));
      setRecoveryError(null);
    } catch (error) {
      setRecoveryError(error instanceof Error ? error.message : String(error));
    }
  }, [projectId]);

  useEffect(() => {
    removeStoredValue('layox_autoSaveTimeline');
    void refreshRecoveryPoints();
  }, [refreshRecoveryPoints]);

  const createRecoveryPoint = useCallback(async () => {
    const state = useProjectStore.getState();
    const projectCopy = structuredClone(state.project);
    await recoveryRepository.save({
      id: uuidv4(),
      projectId: projectCopy.meta.id,
      createdAt: Date.now(),
      pageIndex: state.currentPageIndex,
      pageCount: projectCopy.pages.length,
      projectName: projectCopy.meta.name,
      project: projectCopy,
    }, state.assetBlobs);
    await refreshRecoveryPoints();
  }, [refreshRecoveryPoints]);

  const handleAutoSaveSuccess = useCallback(() => setRecoveryError(null), []);
  const handleAutoSaveError = useCallback((error: unknown) => {
    setRecoveryError(error instanceof Error ? error.message : String(error));
  }, []);
  useAutoSave({
    enabled: autoSaveEnabled,
    intervalSeconds: autoSaveInterval,
    createRecoveryPoint,
    onSuccess: handleAutoSaveSuccess,
    onError: handleAutoSaveError,
  });

  const handleRestoreRecoveryPoint = useCallback(async (point: RecoverySummary) => {
    try {
      const recovered = await recoveryRepository.restore(point.id);
      snapshot();
      restoreRecoveredProject(recovered.project, recovered.assetBlobs, recovered.pageIndex);
      setRecoveryError(null);
      setOpenMenu(null);
    } catch (error) {
      setRecoveryError(error instanceof Error ? error.message : String(error));
    }
  }, [restoreRecoveredProject, snapshot]);

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
      const key = e.key.toLowerCase();

      // Ctrl+Z – Undo
      if ((e.ctrlKey || e.metaKey) && key === 'z' && !e.shiftKey) {
        e.preventDefault();
        useProjectStore.getState().undo();
        return;
      }
      // Ctrl+Y or Ctrl+Shift+Z – Redo
      if ((e.ctrlKey || e.metaKey) && (key === 'y' || (key === 'z' && e.shiftKey))) {
        e.preventDefault();
        useProjectStore.getState().redo();
        return;
      }
      // Ctrl+S / Ctrl+Shift+S
      if ((e.ctrlKey || e.metaKey) && key === 's') {
        e.preventDefault();
        const reportSaveFailure = (error: unknown) => {
          setUiError(`${t('saveError')}: ${error instanceof Error ? error.message : String(error)}`);
        };
        if (e.shiftKey) {
          void useProjectStore.getState().saveCurrentProjectAs().catch(reportSaveFailure);
        } else {
          void useProjectStore.getState().saveCurrentProject().catch(reportSaveFailure);
        }
        return;
      }
      // Ctrl+O – Open
      if ((e.ctrlKey || e.metaKey) && key === 'o') {
        e.preventDefault();
        useProjectStore.getState().openProject();
        return;
      }
      // Ctrl+N – New project
      if ((e.ctrlKey || e.metaKey) && key === 'n') {
        e.preventDefault();
        setShowNewProjectModal(true);
        return;
      }
      // Ctrl+T – Add text
      if ((e.ctrlKey || e.metaKey) && key === 't') {
        if (!isInput) {
          e.preventDefault();
          useProjectStore.getState().snapshot();
          addTextElement();
        }
        return;
      }
      // Ctrl+I – Add image
      if ((e.ctrlKey || e.metaKey) && key === 'i') {
        e.preventDefault();
        imageInputRef.current?.click();
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
          if (deleteFromLibraryOnImageDelete) state.pruneUnusedAssets();
        } else if (state.selectedElementId) {
          const selectedEl = state.project.pages[state.currentPageIndex]?.elements.find((el) => el.id === state.selectedElementId);
          removeElement(state.selectedElementId);
          if (deleteFromLibraryOnImageDelete && selectedEl?.type === 'image') state.pruneUnusedAssets();
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
  }, [addTextElement, deleteFromLibraryOnImageDelete, removeElement, removeImageFromSlot, resetProject, t]);

  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // ─── Handlers ─────────────────────────────────────────────────────────
  const handleOpen = async () => {
    closeMenu();
    if (hasFileSystemAccess) {
      try { await openProject(); } catch (err) {
        console.error(t('openError'), err);
        setUiError(`${t('openError')}: ${err instanceof Error ? err.message : err}`);
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
      setUiError(`${t('loadError')}: ${err instanceof Error ? err.message : err}`);
    }
    e.target.value = '';
  };

  const handleSave = async () => { closeMenu(); try { await saveCurrentProject(); } catch (err) { setUiError(`${t('saveError')}: ${err}`); } };
  const handleSaveAs = async () => { closeMenu(); try { await saveCurrentProjectAs(); } catch (err) { setUiError(`${t('saveError')}: ${err}`); } };

  const handleNewProject = () => {
    closeMenu();
    setShowNewProjectModal(true);
  };

  const handleAddImage = () => { closeMenu(); imageInputRef.current?.click(); };
  const handleImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter((file) => file.type.startsWith('image/'));
    if (files.length === 0) return;
    snapshot();
    setImportJob({ completed: 0, total: files.length });
    let unplaced = 0;
    try {
      for (let index = 0; index < files.length; index += 1) {
        const result = await addImageFromFile(files[index]);
        if (result.placement === 'library-only') unplaced += 1;
        setImportJob({ completed: index + 1, total: files.length });
      }
      setUiNotice(
        t('importSummary')
          .replace('{count}', String(files.length))
          .replace('{unplaced}', String(unplaced)),
      );
      setNoticeCanUndo(false);
    } catch (err) {
      setUiError(err instanceof Error ? err.message : String(err));
    } finally {
      setImportJob(null);
    }
    e.target.value = '';
  };

  const handleAddText = () => { closeMenu(); snapshot(); addTextElement(); };
  const handleOpenAssetLibrary = () => { closeMenu(); setShowAssetLibrary(true); };
  const handleInsertFromAssetLibrary = async (assetPath: string) => {
    snapshot();
    await addImageFromAsset(assetPath);
  };
  const handleQuickInsertAssetPick = useCallback((assetPath: string) => {
    if (selectedSlotIndex !== null) {
      snapshot();
      void addImageFromAsset(assetPath).catch((err) => console.error(err));
      setQuickInsertAssetPath(null);
      return;
    }
    if (!currentLayoutId) {
      snapshot();
      void addImageFromAsset(assetPath).catch((err) => console.error(err));
      return;
    }
    setQuickInsertAssetPath(assetPath);
    setSelectedElementId(null);
    setSelectedSlotIndex(null);
  }, [addImageFromAsset, currentLayoutId, selectedSlotIndex, setSelectedElementId, setSelectedSlotIndex, snapshot]);

  useEffect(() => {
    if (!quickInsertAssetPath) return;
    if (!currentLayoutId) return;
    if (selectedSlotIndex === null) return;

    snapshot();
    void addImageFromAsset(quickInsertAssetPath)
      .catch((err) => console.error(err))
      .finally(() => setQuickInsertAssetPath(null));
  }, [addImageFromAsset, currentLayoutId, quickInsertAssetPath, selectedSlotIndex, snapshot]);
  const handleRemoveCover = () => { closeMenu(); snapshot(); toggleCover(false); };
  const handleMakeCover = () => { closeMenu(); snapshot(); toggleCover(true); };
  const handleAddPageFromMenu = () => { closeMenu(); snapshot(); addPage(); };
  const handleDuplicatePage = useCallback((index: number) => {
    snapshot();
    duplicatePage(index);
  }, [duplicatePage, snapshot]);
  const handleDeletePage = useCallback((index: number) => {
    if (pages.length <= 1) return;
    snapshot();
    removePage(index);
    setUiNotice(t('pageDeleted'));
    setNoticeCanUndo(true);
  }, [pages.length, removePage, snapshot, t]);

  const handleLayoutSelect = (layoutId: string | null) => {
    snapshot();
    setQuickInsertAssetPath(null);
    if (layoutId) applyLayout(layoutId); else clearLayout();
  };

  const handleDelete = () => {
    closeMenu();
    snapshot();
    if (canDeleteSlot && selectedSlotIndex !== null) {
      removeImageFromSlot(selectedSlotIndex);
      if (deleteFromLibraryOnImageDelete) pruneUnusedAssets();
    } else if (selectedElementId) {
      const selectedElement = pages[currentPageIndex]?.elements.find((el) => el.id === selectedElementId);
      removeElement(selectedElementId);
      if (deleteFromLibraryOnImageDelete && selectedElement?.type === 'image') pruneUnusedAssets();
    }
  };

  const handleSlotDeleteFromCanvas = useCallback((slotIndex: number) => {
    if (!currentSlotAssignments?.[slotIndex]) return;
    snapshot();
    removeImageFromSlot(slotIndex);
    if (deleteFromLibraryOnImageDelete) pruneUnusedAssets();
  }, [currentSlotAssignments, deleteFromLibraryOnImageDelete, pruneUnusedAssets, removeImageFromSlot, snapshot]);

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
    if (isDirty) setShowHomeConfirm(true);
    else setShowEditor(false);
  };

  // ─── Export handlers ──────────────────────────────────────────────────
  const exportContext = useMemo<ProjectExportContext>(() => ({
    pages,
    assets: assetBlobs,
    projectName,
    renderer: konvaPageRenderer,
    defaultLayoutPadding,
    defaultLayoutGap,
  }), [assetBlobs, defaultLayoutGap, defaultLayoutPadding, pages, projectName]);

  const runExport = useCallback(async (
    label: string,
    total: number,
    operation: (job: ExportJobOptions) => Promise<void>,
  ) => {
    if (exportAbortRef.current) return;
    const controller = new AbortController();
    exportAbortRef.current = controller;
    setExportError(null);
    setExportJob({ label, completed: 0, total });
    try {
      await operation({
        signal: controller.signal,
        onProgress: (completed, progressTotal) => {
          setExportJob({ label, completed, total: progressTotal });
        },
      });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        setExportError(error instanceof Error ? error.message : String(error));
      }
    } finally {
      exportAbortRef.current = null;
      setExportJob(null);
    }
  }, []);

  const handleExportPdfPrompt = () => {
    closeMenu();
    setShowPdfDialog(true);
  };

  const handleExportPdfConfirm = async (level: PdfCompressionLevel) => {
    setShowPdfDialog(false);
    setPdfDefaultLevel(level);
    await runExport('PDF', pages.length, (job) => exportAsPdf(exportContext, level, job));
  };

  const handleExportPng = async () => {
    closeMenu();
    await runExport('PNG', 1, (job) => exportCurrentPageAsPng(exportContext, currentPageIndex, job));
  };

  const handleExportJpeg = async () => {
    closeMenu();
    await runExport('JPEG', 1, (job) => exportCurrentPageAsJpeg(exportContext, currentPageIndex, job));
  };

  const handleExportZipPng = async () => {
    closeMenu();
    await runExport('PNG ZIP', pages.length, (job) => exportAllPagesAsZip(exportContext, 'png', job));
  };

  const handleExportZipJpeg = async () => {
    closeMenu();
    await runExport('JPEG ZIP', pages.length, (job) => exportAllPagesAsZip(exportContext, 'jpeg', job));
  };

  const setManualCanvasZoom = (scale: number) => {
    setCanvasZoomMode('manual');
    setCanvasManualZoom(Math.max(0.2, Math.min(3, scale)));
  };

  const changeCanvasZoom = (delta: number) => {
    const currentScale = canvasZoomMode === 'manual' ? canvasManualZoom : canvasDisplayScale;
    setManualCanvasZoom(Math.round((currentScale + delta) * 10) / 10);
  };

  const btnPageNav =
    'min-w-11 h-11 px-2 flex items-center justify-center rounded-lg border text-sm transition-all cursor-pointer select-none';
  const btnIcon =
    'w-11 h-11 flex items-center justify-center rounded-lg border text-sm transition-all cursor-pointer select-none disabled:opacity-35 disabled:cursor-not-allowed';

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
    const subchapter = (page.subchapterTitle ?? '').trim();
    if (chapter && subchapter) return `${chapter} • ${subchapter}`;
    if (chapter) return chapter;
    if (subchapter) return subchapter;
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
          <SaveStatus t={t} isDirty={isDirty} isSaving={isSaving} error={saveError} />
        </div>

        {/* Undo / Redo */}
        <button onClick={handleUndo} disabled={!canUndo} className={`${btnIcon} editor-surface-control editor-toolbar-icon border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800`} title={`${t('undo')} (Ctrl+Z)`} aria-label={t('undo')}>
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 7H4v5" />
            <path d="M4 12c1.6-3.8 4.8-5.8 8.7-5.8 5.1 0 8.3 3.6 8.3 8.8" />
          </svg>
        </button>
        <button onClick={handleRedo} disabled={!canRedo} className={`${btnIcon} editor-surface-control editor-toolbar-icon border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800`} title={`${t('redo')} (Ctrl+Y)`} aria-label={t('redo')}>
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 7h5v5" />
            <path d="M20 12c-1.6-3.8-4.8-5.8-8.7-5.8-5.1 0-8.3 3.6-8.3 8.8" />
          </svg>
        </button>

        <div className="w-px h-5 bg-neutral-700/80" />

        <FileMenu
          t={t}
          open={openMenu === 'file'}
          isSaving={isSaving}
          onToggle={() => toggleMenu('file')}
          onNew={handleNewProject}
          onOpen={handleOpen}
          onSave={handleSave}
          onSaveAs={handleSaveAs}
          onExportPdf={handleExportPdfPrompt}
          onExportPng={handleExportPng}
          onExportJpeg={handleExportJpeg}
          onExportZipPng={handleExportZipPng}
          onExportZipJpeg={handleExportZipJpeg}
          onHome={handleGoHome}
        />

        {/* ── Edit menu ── */}
        <div className="relative" data-menu>
          <MenuButton label={t('edit')} isOpen={openMenu === 'edit'} onClick={() => toggleMenu('edit')} />
          {openMenu === 'edit' && (
            <div className="editor-dropdown absolute top-full left-0 mt-2 min-w-[230px] bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl z-[90] p-1">
              <MenuItem label={t('undo')} shortcut="Ctrl+Z" onClick={handleUndo} disabled={!canUndo} />
              <MenuItem label={t('redo')} shortcut="Ctrl+Y" onClick={handleRedo} disabled={!canRedo} />
              <MenuDivider />
              <MenuItem label={t('delete')} shortcut="Del" onClick={handleDelete} disabled={!canDelete} danger />
              <MenuItem label={t('shortcutOverview')} onClick={() => {
                closeMenu();
                setShowKeyboardShortcuts(true);
              }} />
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
                  getLayoutName={(layout) => {
                    const key = LAYOUT_NAME_KEYS[layout.id];
                    return key ? t(key) : layout.name;
                  }}
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
                <input
                  type="text"
                  placeholder={t('subchapter')}
                  value={currentSubchapterTitle}
                  onFocus={() => snapshot()}
                  onChange={(e) => setCurrentPageSubchapterTitle(e.target.value)}
                  className="editor-input w-full px-2 py-1 text-xs rounded-md bg-neutral-800 text-white border border-neutral-600"
                  title={t('subchapter')}
                />
                {currentChapterTitle && (
                  <button
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

        <div className="editor-zoom-controls flex items-center gap-1" role="group" aria-label={t('zoomLevel')}>
          <button type="button" onClick={() => changeCanvasZoom(-0.1)} className={`${btnIcon} editor-surface-control`} title={t('zoomOut')} aria-label={t('zoomOut')}>−</button>
          <button type="button" onClick={() => setCanvasZoomMode('fit')} className={`${btnPageNav} editor-surface-control text-xs`} title={t('zoomFit')}>{t('zoomFit')}</button>
          <button type="button" onClick={() => setManualCanvasZoom(1)} className={`${btnPageNav} editor-surface-control text-xs`} title={t('zoom100')}>{t('zoom100')}</button>
          <button type="button" onClick={() => changeCanvasZoom(0.1)} className={`${btnIcon} editor-surface-control`} title={t('zoomIn')} aria-label={t('zoomIn')}>+</button>
          <span className="min-w-11 text-center text-[11px] text-neutral-400" aria-live="polite">
            {Math.round(canvasDisplayScale * 100)}%
          </span>
        </div>

        {/* ── Spacer ── */}
        <div className="flex-1" />

        {/* ── Page navigation (numbers + add/delete) ── */}
        <div className="relative flex items-center" data-menu>
          <QuickSettingsMenu
            t={t}
            buttonClassName={btnPageNav}
            open={openMenu === 'quick-settings'}
            onToggle={() => toggleMenu('quick-settings')}
            uiTheme={uiTheme}
            setUiTheme={setUiTheme}
            language={language}
            setLanguage={setLanguage}
            showQuickImageBar={showQuickImageBar}
            setShowQuickImageBar={setShowQuickImageBar}
            deleteFromLibraryOnImageDelete={deleteFromLibraryOnImageDelete}
            setDeleteFromLibraryOnImageDelete={setDeleteFromLibraryOnImageDelete}
            autoSaveEnabled={autoSaveEnabled}
            setAutoSaveEnabled={setAutoSaveEnabled}
            autoSaveInterval={autoSaveInterval}
            setAutoSaveInterval={setAutoSaveInterval}
            recoveryPoints={recoveryPoints}
            recoveryError={recoveryError}
            onRestore={(point) => void handleRestoreRecoveryPoint(point)}
          />

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
                onClick={() => handleDeletePage(currentPageIndex)}
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
        <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageSelected} />

        {(selectedTextElement || currentIsCover) && (
          <div className="editor-context-bar order-2 basis-full mt-2 pt-2 border-t border-neutral-800/90 flex items-center gap-3 px-1 pb-1 text-sm">
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
        <PageFilmstrip
          t={t}
          pages={pages}
          assetBlobs={assetBlobs}
          currentPageIndex={currentPageIndex}
          defaultLayoutPadding={defaultLayoutPadding}
          defaultLayoutGap={defaultLayoutGap}
          getMetaLabel={getPageOverviewMetaLabel}
          onSelect={setCurrentPageIndex}
          onMove={(fromIndex, toIndex) => {
            snapshot();
            movePage(fromIndex, toIndex);
          }}
          onDuplicate={handleDuplicatePage}
          onDelete={handleDeletePage}
          onAdd={() => {
            snapshot();
            addPage();
          }}
        />
        {/* Left arrow */}
        <button
          onClick={goPrevPage}
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
            zoomMode={canvasZoomMode}
            manualZoom={canvasManualZoom}
            onDisplayScaleChange={setCanvasDisplayScale}
            onRequestSlotDelete={handleSlotDeleteFromCanvas}
            dropImagesLabel={t('dropImagesHere')}
            imageLabelPrefix={t('imageSlotLabel')}
            editTextPlaceholder={t('editTextPlaceholder')}
            deleteImageLabel={t('imageDelete')}
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
            onClick={goNextPage}
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

      {showQuickImageBar && (
        <AssetTray
          t={t}
          items={assetTrayItems}
          selectedAssetPath={quickInsertAssetPath}
          importing={importJob !== null}
          onImport={() => imageInputRef.current?.click()}
          onSelect={handleQuickInsertAssetPick}
          onOpenLibrary={() => setShowAssetLibrary(true)}
          onRemove={(assetPath) => {
            if (removeAsset(assetPath) && quickInsertAssetPath === assetPath) {
              setQuickInsertAssetPath(null);
            }
          }}
        />
      )}

      {exportJob && (
        <div
          ref={exportDialogRef}
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70"
          role="dialog"
          aria-modal="true"
          aria-labelledby="layox-export-progress-title"
          tabIndex={-1}
        >
          <div className="editor-dropdown w-80 rounded-2xl border border-neutral-700 bg-neutral-900 p-5 shadow-2xl">
            <h3 id="layox-export-progress-title" className="text-base font-semibold text-white">
              {t('exportProgress').replace('{format}', exportJob.label)}
            </h3>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-700">
              <div
                className="h-full bg-blue-500 transition-[width]"
                style={{ width: `${exportJob.total > 0 ? (exportJob.completed / exportJob.total) * 100 : 0}%` }}
              />
            </div>
            <div className="mt-2 text-xs text-neutral-400" aria-live="polite">
              {exportJob.completed} / {exportJob.total}
            </div>
            <button
              type="button"
              onClick={() => exportAbortRef.current?.abort()}
              className="mt-4 w-full rounded-lg border border-neutral-600 bg-neutral-800 py-2 text-sm text-neutral-200 hover:bg-neutral-700"
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      )}

      {exportError && (
        <div className="fixed bottom-5 left-1/2 z-[140] flex max-w-lg -translate-x-1/2 items-center gap-3 rounded-xl border border-red-700 bg-red-950 px-4 py-3 text-sm text-red-100 shadow-2xl" role="alert">
          <span>{t('exportFailed')}: {exportError}</span>
          <button type="button" onClick={() => setExportError(null)} className="rounded px-2 py-1 hover:bg-red-900" aria-label={t('close')}>×</button>
        </div>
      )}

      {uiError && (
        <div className="fixed bottom-5 left-1/2 z-[140] flex max-w-lg -translate-x-1/2 items-center gap-3 rounded-xl border border-red-700 bg-red-950 px-4 py-3 text-sm text-red-100 shadow-2xl" role="alert">
          <span>{uiError}</span>
          <button type="button" onClick={() => setUiError(null)} className="rounded px-2 py-1 hover:bg-red-900" aria-label={t('close')}>×</button>
        </div>
      )}

      {(uiNotice || importJob) && (
        <div className="fixed bottom-5 left-1/2 z-[140] flex max-w-lg -translate-x-1/2 items-center gap-3 rounded-xl border border-blue-700 bg-blue-950 px-4 py-3 text-sm text-blue-100 shadow-2xl" role="status" aria-live="polite">
          <span>
            {importJob
              ? `${t('importingImages')} ${importJob.completed} / ${importJob.total}`
              : uiNotice}
          </span>
          {!importJob && noticeCanUndo && (
            <button
              type="button"
              onClick={() => {
                undo();
                setUiNotice(null);
                setNoticeCanUndo(false);
              }}
              className="min-h-9 rounded-lg bg-blue-800 px-3 font-medium hover:bg-blue-700"
            >
              {t('undo')}
            </button>
          )}
          {!importJob && (
            <button type="button" onClick={() => {
              setUiNotice(null);
              setNoticeCanUndo(false);
            }} className="rounded px-2 py-1 hover:bg-blue-900" aria-label={t('close')}>×</button>
          )}
        </div>
      )}

      <ConfirmDialog
        open={showHomeConfirm}
        title={t('attention')}
        message={t('homeConfirm')}
        cancelLabel={t('cancel')}
        confirmLabel={t('discardChanges')}
        danger
        onCancel={() => setShowHomeConfirm(false)}
        onConfirm={() => {
          setShowHomeConfirm(false);
          setShowEditor(false);
        }}
      />

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
          <div
            ref={pdfDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pdf-compression-title"
            tabIndex={-1}
            className="editor-dropdown bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl p-5 w-80"
          >
            <h3 id="pdf-compression-title" className="text-white font-semibold text-base mb-3">{t('pdfCompression')}</h3>
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
                    {t(preset.labelKey)}
                    {preset.id === pdfDefaultLevel && (
                      <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border border-blue-500/70 text-blue-200">
                        {t('pdfDefault')}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-neutral-400 mt-0.5">{t(preset.descriptionKey)}</div>
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
        defaultLayoutPadding={defaultLayoutPadding}
        defaultLayoutGap={defaultLayoutGap}
      />

      <AssetLibraryModal
        open={showAssetLibrary}
        assetBlobs={assetBlobs}
        title={t('assetLibrary')}
        closeLabel={t('close')}
        emptyLabel={t('noAssets')}
        searchPlaceholder={t('searchImages')}
        usageLabel={(count) => t('imageUsage').replace('{count}', String(count))}
        removeLabel={t('removeUnusedAsset')}
        unusedLabel={t('assetsUnused')}
        usageCounts={assetUsageCounts}
        onInsert={handleInsertFromAssetLibrary}
        onRemove={(assetPath) => {
          removeAsset(assetPath);
        }}
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

      <KeyboardShortcutsDialog
        open={showKeyboardShortcuts}
        t={t}
        onClose={() => setShowKeyboardShortcuts(false)}
      />
    </div>
  );
}

export default App;
