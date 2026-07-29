import { Stage, Layer, Rect, Text, Line } from 'react-konva';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type Konva from 'konva';
import useProjectStore from '../../store/useProjectStore';
import { computeLayoutSlots } from '../../utils/layouts';
import { CANVAS_H, CANVAS_W } from '../../constants/canvas';
import {
  DEFAULT_COVER_SUBTITLE_COLOR,
  DEFAULT_COVER_SUBTITLE_FONT_FAMILY,
  DEFAULT_COVER_SUBTITLE_FONT_SIZE,
  DEFAULT_COVER_TITLE_COLOR,
  DEFAULT_COVER_TITLE_FONT_FAMILY,
  DEFAULT_COVER_TITLE_FONT_SIZE,
  DEFAULT_LAYOUT_GAP,
  DEFAULT_LAYOUT_PADDING,
  DEFAULT_PAGE_BACKGROUND,
} from '../../domain/projectDefaults';
import {
  bindImageCacheToProject,
  collectImagePathsFromPage,
  loadCachedBlobImage,
} from './useAssetImage';

import { ElementRenderer, SlotComponent } from './EditorCanvasElements';

// ─── Main canvas ─────────────────────────────────────────────────────────────

function EditorCanvas({
  zoomMode = 'fit',
  manualZoom = 1,
  onDisplayScaleChange,
  onRequestSlotDelete,
  dropImagesLabel = 'Drop image(s) here',
  imageLabelPrefix = 'Image',
  deleteImageLabel = 'Delete image',
  editTextPlaceholder = 'Edit text',
  coverTitleFallback = 'Title',
  coverSubtitleFallback = 'Subtitle',
  lowResolutionHintText = (qualityPercent: number) =>
    `Low resolution - may appear pixelated\nAbout ${qualityPercent}% of the recommended size`,
}: {
  zoomMode?: 'fit' | 'manual';
  manualZoom?: number;
  onDisplayScaleChange?: (scale: number) => void;
  onRequestSlotDelete?: (slotIndex: number) => void;
  dropImagesLabel?: string;
  imageLabelPrefix?: string;
  deleteImageLabel?: string;
  editTextPlaceholder?: string;
  coverTitleFallback?: string;
  coverSubtitleFallback?: string;
  lowResolutionHintText?: (qualityPercent: number) => string;
}) {
  const currentPageIndex = useProjectStore((s) => s.currentPageIndex);
  const projectId = useProjectStore((s) => s.project.meta.id);
  const pages = useProjectStore((s) => s.project.pages);
  const currentPage = useProjectStore((s) => s.project.pages[s.currentPageIndex]);
  const assetBlobs = useProjectStore((s) => s.assetBlobs);
  const selectedElementId = useProjectStore((s) => s.selectedElementId);
  const selectedSlotIndex = useProjectStore((s) => s.selectedSlotIndex);
  const setSelectedElementId = useProjectStore((s) => s.setSelectedElementId);
  const setSelectedSlotIndex = useProjectStore((s) => s.setSelectedSlotIndex);
  const updateElement = useProjectStore((s) => s.updateElement);
  const updateSlotOffset = useProjectStore((s) => s.updateSlotOffset);
  const updateSlotScale = useProjectStore((s) => s.updateSlotScale);
  const addImageFromFile = useProjectStore((s) => s.addImageFromFile);
  const addImageFromAsset = useProjectStore((s) => s.addImageFromAsset);
  const setCoverTitle = useProjectStore((s) => s.setCoverTitle);
  const setCoverSubtitle = useProjectStore((s) => s.setCoverSubtitle);
  const setCoverTitlePosition = useProjectStore((s) => s.setCoverTitlePosition);
  const setCoverSubtitlePosition = useProjectStore((s) => s.setCoverSubtitlePosition);
  const updateSlotCrop = useProjectStore((s) => s.updateSlotCrop);
  const snapshot = useProjectStore((s) => s.snapshot);
  const defaultLayoutPadding = useProjectStore((s) => s.project.meta.defaultLayoutPadding ?? DEFAULT_LAYOUT_PADDING);
  const defaultLayoutGap = useProjectStore((s) => s.project.meta.defaultLayoutGap ?? DEFAULT_LAYOUT_GAP);

  const layoutId = currentPage?.layoutId;
  const isLayoutMode = !!layoutId;
  const layoutPadding = currentPage?.layoutPadding ?? defaultLayoutPadding;
  const layoutGap = currentPage?.layoutGap ?? defaultLayoutGap;
  const computedSlots = useMemo(
    () => (layoutId ? computeLayoutSlots(layoutId, layoutPadding, layoutGap) : []),
    [layoutGap, layoutId, layoutPadding],
  );

  useEffect(() => {
    bindImageCacheToProject(projectId, assetBlobs);
  }, [assetBlobs, projectId]);

  useEffect(() => {
    const neighborPages = [pages[currentPageIndex - 1], pages[currentPageIndex + 1]].filter(Boolean);
    const neighborPaths = new Set<string>();

    neighborPages.forEach((page) => {
      collectImagePathsFromPage(page).forEach((path) => {
        neighborPaths.add(path);
      });
    });

    neighborPaths.forEach((path) => {
      const blob = assetBlobs[path];
      if (!blob) return;
      void loadCachedBlobImage(projectId, path, blob).catch(() => undefined);
    });
  }, [assetBlobs, currentPageIndex, pages, projectId]);

  // In layout mode: only text elements are free. In free mode: all elements.
  const elements = useMemo(() => currentPage?.elements ?? [], [currentPage?.elements]);
  const freeElements = isLayoutMode
    ? elements.filter((el) => el.type === 'text')
    : elements;
  const sortedFreeElements = [...freeElements].sort((a, b) => a.zIndex - b.zIndex);

  // Cover page
  const isCover = currentPage?.isCover;
  const coverTitle = currentPage?.coverTitle ?? '';
  const coverSubtitle = currentPage?.coverSubtitle ?? '';
  const showCoverSubtitle = currentPage?.showCoverSubtitle ?? false;
  const coverTitleFontSize = currentPage?.coverTitleFontSize ?? DEFAULT_COVER_TITLE_FONT_SIZE;
  const coverTitleFontFamily = currentPage?.coverTitleFontFamily ?? DEFAULT_COVER_TITLE_FONT_FAMILY;
  const coverTitleColor = currentPage?.coverTitleColor ?? DEFAULT_COVER_TITLE_COLOR;
  const coverTitleX = currentPage?.coverTitleX ?? 0;
  const coverTitleY = currentPage?.coverTitleY ?? CANVAS_H * 0.35;
  const coverSubtitleFontSize = currentPage?.coverSubtitleFontSize ?? DEFAULT_COVER_SUBTITLE_FONT_SIZE;
  const coverSubtitleFontFamily = currentPage?.coverSubtitleFontFamily ?? DEFAULT_COVER_SUBTITLE_FONT_FAMILY;
  const coverSubtitleColor = currentPage?.coverSubtitleColor ?? DEFAULT_COVER_SUBTITLE_COLOR;
  const coverSubtitleX = currentPage?.coverSubtitleX ?? 0;
  const coverSubtitleY = currentPage?.coverSubtitleY ?? CANVAS_H * 0.35 + 60;

  // ─── Inline editing state ────────────────────────────────────────────────
  const [inlineEdit, setInlineEdit] = useState<{
    type: 'element' | 'coverTitle' | 'coverSubtitle';
    id?: string;
    text: string;
    x: number;
    y: number;
    width: number;
    fontSize: number;
    fontFamily: string;
    color: string;
    align?: string;
    fontStyle?: string;
  } | null>(null);
  const inlineTextareaRef = useRef<HTMLTextAreaElement>(null);

  // ─── Snap guide state ────────────────────────────────────────────────────
  const [snapGuides, setSnapGuides] = useState<{ x?: number; y?: number }[]>([]);

  // ─── Responsive scaling ──────────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const [displayScale, setDisplayScale] = useState(1);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateScale = () => {
      const rect = container.getBoundingClientRect();
      const scaleX = rect.width / CANVAS_W;
      const scaleY = rect.height / CANVAS_H;
      const fitScale = Math.max(0.12, Math.min(3, Math.min(scaleX, scaleY)));
      const manualScale = Math.min(3, Math.max(0.2, manualZoom));
      const nextScale = zoomMode === 'fit' ? fitScale : manualScale;
      setContainerSize((current) => (
        current.width === rect.width && current.height === rect.height
          ? current
          : { width: rect.width, height: rect.height }
      ));
      setDisplayScale(nextScale);
      onDisplayScaleChange?.(nextScale);
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(container);
    return () => observer.disconnect();
  }, [manualZoom, onDisplayScaleChange, zoomMode]);

  // ─── Drag & drop ─────────────────────────────────────────────────────────
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (
      e.dataTransfer.types.includes('Files') ||
      e.dataTransfer.types.includes('application/x-layox-asset')
    ) {
      setDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const existingAssetPath = e.dataTransfer.getData('application/x-layox-asset');
      if (existingAssetPath) {
        snapshot();
        if (isLayoutMode) {
          const rect = containerRef.current?.getBoundingClientRect();
          if (rect) {
            const canvasWidth = CANVAS_W * displayScale;
            const canvasHeight = CANVAS_H * displayScale;
            const canvasLeft = rect.left + (rect.width - canvasWidth) / 2;
            const canvasTop = rect.top + (rect.height - canvasHeight) / 2;
            const canvasX = (e.clientX - canvasLeft) / displayScale;
            const canvasY = (e.clientY - canvasTop) / displayScale;
            const slotIndex = computedSlots.findIndex((slot) =>
              canvasX >= slot.x &&
              canvasX <= slot.x + slot.width &&
              canvasY >= slot.y &&
              canvasY <= slot.y + slot.height,
            );
            if (slotIndex >= 0) setSelectedSlotIndex(slotIndex);
          }
        }
        await addImageFromAsset(existingAssetPath);
        return;
      }

      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith('image/'),
      );
      if (files.length > 0) snapshot();
      for (const file of files) {
        await addImageFromFile(file);
      }
    },
    [
      addImageFromAsset,
      addImageFromFile,
      computedSlots,
      displayScale,
      isLayoutMode,
      setSelectedSlotIndex,
      snapshot,
    ],
  );

  const handleEmptySlotDblClick = useCallback(
    (slotIndex: number) => {
      if (!isLayoutMode) return;
      if (selectedSlotIndex !== slotIndex) return;
      if (currentPage?.slotAssignments?.[slotIndex]) return;

      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = false;
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        snapshot();
        try {
          await addImageFromFile(file);
        } catch {
          // Keep UI responsive; selection remains and user can retry.
        }
      };
      input.click();
    },
    [addImageFromFile, currentPage?.slotAssignments, isLayoutMode, selectedSlotIndex, snapshot],
  );

  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (e.target === e.target.getStage()) {
        setSelectedElementId(null);
        setSelectedSlotIndex(null);
      }
    },
    [setSelectedElementId, setSelectedSlotIndex],
  );

  // ─── Snapshot on drag start ───────────────────────────────────────────────
  const handleDragStart = useCallback(() => {
    snapshot();
  }, [snapshot]);

  // ─── Inline editing helpers ──────────────────────────────────────────────
  const startInlineEdit = (elementId: string) => {
    const element = freeElements.find((candidate) => candidate.id === elementId);
    if (!element || element.type !== 'text') return;
    snapshot();
    const isDefaultText = element.content === editTextPlaceholder;
    setInlineEdit({
      type: 'element',
      id: elementId,
      text: isDefaultText ? '' : element.content,
      x: element.x,
      y: element.y,
      width: element.width || 200,
      fontSize: element.fontSize,
      fontFamily: element.fontFamily,
      color: element.color,
      align: element.align,
      fontStyle: element.fontStyle,
    });
  };

  const startCoverEdit = (field: 'coverTitle' | 'coverSubtitle') => {
    snapshot();
    const isTitle = field === 'coverTitle';
    setInlineEdit({
      type: field,
      text: isTitle ? coverTitle : coverSubtitle,
      x: isTitle ? coverTitleX : coverSubtitleX,
      y: isTitle ? coverTitleY : coverSubtitleY,
      width: CANVAS_W,
      fontSize: isTitle ? coverTitleFontSize : coverSubtitleFontSize,
      fontFamily: isTitle ? coverTitleFontFamily : coverSubtitleFontFamily,
      color: isTitle ? coverTitleColor : coverSubtitleColor,
      align: 'center',
      fontStyle: isTitle ? 'bold' : undefined,
    });
  };

  const commitInlineEdit = () => {
    if (!inlineEdit) return;
    const finalText = inlineEdit.text.trim() || (inlineEdit.type === 'element' ? editTextPlaceholder : '');
    if (inlineEdit.type === 'element' && inlineEdit.id) {
      updateElement(inlineEdit.id, { content: finalText });
    } else if (inlineEdit.type === 'coverTitle') {
      setCoverTitle(finalText);
    } else if (inlineEdit.type === 'coverSubtitle') {
      setCoverSubtitle(finalText);
    }
    setInlineEdit(null);
  };

  const cancelInlineEdit = () => {
    setInlineEdit(null);
  };

  useEffect(() => {
    if (!inlineEdit || !inlineTextareaRef.current) return;
    const textarea = inlineTextareaRef.current;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [inlineEdit]);

  // ─── Snap logic for element dragging ─────────────────────────────────────
  const handleElementDragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>, elementId: string) => {
      const node = e.target;
      const SNAP = 8;
      const x = node.x();
      const y = node.y();
      const w = node.width() * (node.scaleX() || 1);
      const h = (node.height() || 30) * (node.scaleY() || 1);

      // Compute snap targets (excluding this element)
      const xTargets = [0, CANVAS_W, CANVAS_W / 2];
      const yTargets = [0, CANVAS_H, CANVAS_H / 2];

      if (isLayoutMode) {
        for (const slot of computedSlots) {
          xTargets.push(slot.x, slot.x + slot.width);
          yTargets.push(slot.y, slot.y + slot.height);
        }
      }

      for (const el of elements) {
        if (el.id === elementId) continue;
        xTargets.push(el.x);
        yTargets.push(el.y);
        if (el.type === 'image') {
          xTargets.push(el.x + el.width);
          yTargets.push(el.y + el.height);
        }
        if (el.type === 'text' && el.width) {
          xTargets.push(el.x + el.width);
        }
      }

      let snappedX = x;
      let snappedY = y;
      const newGuides: { x?: number; y?: number }[] = [];

      for (const target of xTargets) {
        if (Math.abs(x - target) < SNAP) { snappedX = target; newGuides.push({ x: target }); break; }
        if (Math.abs(x + w - target) < SNAP) { snappedX = target - w; newGuides.push({ x: target }); break; }
        if (Math.abs(x + w / 2 - target) < SNAP) { snappedX = target - w / 2; newGuides.push({ x: target }); break; }
      }

      for (const target of yTargets) {
        if (Math.abs(y - target) < SNAP) { snappedY = target; newGuides.push({ y: target }); break; }
        if (Math.abs(y + h - target) < SNAP) { snappedY = target - h; newGuides.push({ y: target }); break; }
        if (Math.abs(y + h / 2 - target) < SNAP) { snappedY = target - h / 2; newGuides.push({ y: target }); break; }
      }

      node.x(snappedX);
      node.y(snappedY);
      setSnapGuides(newGuides);
    },
    [isLayoutMode, computedSlots, elements],
  );

  const handleElementDragEnd = useCallback(() => {
    setSnapGuides([]);
  }, []);

  const inlineEditorMetrics = inlineEdit && containerSize.width > 0 && containerSize.height > 0
    ? {
        left: (containerSize.width - CANVAS_W * displayScale) / 2 + inlineEdit.x * displayScale,
        top: (containerSize.height - CANVAS_H * displayScale) / 2 + inlineEdit.y * displayScale,
        width: inlineEdit.width * displayScale,
        fontSize: inlineEdit.fontSize * displayScale,
      }
    : null;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full flex items-center justify-center"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drop overlay */}
      {dragOver && (
        <div className="absolute inset-0 bg-blue-500/20 border-4 border-dashed border-blue-400 rounded-xl z-50 flex items-center justify-center pointer-events-none">
          <span className="text-blue-300 text-xl font-medium">{dropImagesLabel}</span>
        </div>
      )}

      <div
        style={{
          width: CANVAS_W,
          height: CANVAS_H,
          transform: `scale(${displayScale})`,
          transformOrigin: 'center center',
        }}
        className="shrink-0 overflow-hidden"
      >
        <Stage width={CANVAS_W} height={CANVAS_H} onClick={handleStageClick} onTap={handleStageClick} onDragStart={handleDragStart}>
          <Layer>
            {/* Page background */}
            <Rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill={currentPage?.background ?? DEFAULT_PAGE_BACKGROUND} />

            {/* Layout slots (layout mode only) */}
            {isLayoutMode &&
              computedSlots.map((slot, i) => (
                <SlotComponent
                  key={i}
                  slot={slot}
                  slotIndex={i}
                  assignment={currentPage?.slotAssignments?.[i]}
                  assetBlobs={assetBlobs}
                  projectId={projectId}
                  isSelected={selectedSlotIndex === i}
                  onSelect={() => {
                    setSelectedElementId(null);
                    setSelectedSlotIndex(i);
                  }}
                  onOffsetChange={updateSlotOffset}
                  onScaleChange={updateSlotScale}
                  onCropChange={updateSlotCrop}
                  onEmptySlotDblClick={handleEmptySlotDblClick}
                  onRequestDelete={(slotIndex) => onRequestSlotDelete?.(slotIndex)}
                  imageLabelPrefix={imageLabelPrefix}
                  deleteImageLabel={deleteImageLabel}
                  lowResolutionHintText={lowResolutionHintText}
                />
              ))}

            {/* Cover page title overlay */}
            {isCover && !inlineEdit?.type?.startsWith('cover') && (
              <>
                <Text
                  x={coverTitleX}
                  y={coverTitleY}
                  width={CANVAS_W}
                  text={coverTitle || coverTitleFallback}
                  fontSize={coverTitleFontSize}
                  fontFamily={coverTitleFontFamily}
                  fontStyle="bold"
                  fill={coverTitleColor}
                  shadowColor="#000000"
                  shadowBlur={8}
                  shadowOpacity={0.7}
                  align="center"
                  draggable
                  listening={true}
                  onDragStart={handleDragStart}
                  onDragEnd={(e) => setCoverTitlePosition(Math.round(e.target.x()), Math.round(e.target.y()))}
                  onDblClick={() => startCoverEdit('coverTitle')}
                  onDblTap={() => startCoverEdit('coverTitle')}
                />
                {showCoverSubtitle && (
                  <Text
                    x={coverSubtitleX}
                    y={coverSubtitleY}
                    width={CANVAS_W}
                    text={coverSubtitle || coverSubtitleFallback}
                    fontSize={coverSubtitleFontSize}
                    fontFamily={coverSubtitleFontFamily}
                    fill={coverSubtitleColor}
                    shadowColor="#000000"
                    shadowBlur={6}
                    shadowOpacity={0.5}
                    align="center"
                    draggable
                    listening={true}
                    onDragStart={handleDragStart}
                    onDragEnd={(e) => setCoverSubtitlePosition(Math.round(e.target.x()), Math.round(e.target.y()))}
                    onDblClick={() => startCoverEdit('coverSubtitle')}
                    onDblTap={() => startCoverEdit('coverSubtitle')}
                  />
                )}
              </>
            )}

            {/* Free elements (all in free mode, text-only in layout mode) */}
            {sortedFreeElements.map((el) => (
              <ElementRenderer
                key={el.id}
                element={el}
                assetBlobs={assetBlobs}
                projectId={projectId}
                isSelected={selectedElementId === el.id && inlineEdit?.id !== el.id}
                onSelect={() => {
                  setSelectedSlotIndex(null);
                  setSelectedElementId(el.id);
                }}
                onChange={(changes) => {
                  updateElement(el.id, changes);
                  handleElementDragEnd();
                }}
                onStartEdit={el.type === 'text' ? () => startInlineEdit(el.id) : undefined}
                onDragMove={(e) => handleElementDragMove(e, el.id)}
                isEditing={inlineEdit?.id === el.id}
              />
            ))}

            {/* Snap guide lines */}
            {snapGuides.map((guide, i) =>
              guide.x !== undefined ? (
                <Line key={`sx${i}`} points={[guide.x, 0, guide.x, CANVAS_H]} stroke="#ff6b6b" strokeWidth={1} dash={[4, 4]} listening={false} />
              ) : guide.y !== undefined ? (
                <Line key={`sy${i}`} points={[0, guide.y, CANVAS_W, guide.y]} stroke="#ff6b6b" strokeWidth={1} dash={[4, 4]} listening={false} />
              ) : null,
            )}
          </Layer>
        </Stage>
      </div>

      {/* Inline text editing overlay */}
      {inlineEdit && inlineEditorMetrics && (
        <textarea
          ref={inlineTextareaRef}
          autoFocus
          value={inlineEdit.text}
          onChange={(event) => {
            const target = event.target;
            target.style.height = 'auto';
            target.style.height = `${target.scrollHeight}px`;
            setInlineEdit((previous) => previous ? { ...previous, text: target.value } : null);
          }}
          onBlur={commitInlineEdit}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              cancelInlineEdit();
            }
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              commitInlineEdit();
            }
          }}
          style={{
            position: 'absolute',
            left: inlineEditorMetrics.left,
            top: inlineEditorMetrics.top,
            width: inlineEditorMetrics.width,
            minHeight: inlineEditorMetrics.fontSize * 1.5,
            fontSize: inlineEditorMetrics.fontSize,
            fontFamily: inlineEdit.fontFamily,
            color: inlineEdit.color,
            textAlign: (inlineEdit.align || 'left') as React.CSSProperties['textAlign'],
            fontWeight: inlineEdit.fontStyle?.includes('bold') ? 'bold' : 'normal',
            fontStyle: inlineEdit.fontStyle?.includes('italic') ? 'italic' : 'normal',
            lineHeight: 1.2,
            background: 'rgba(0,0,0,0.4)',
            border: '2px solid #3b82f6',
            outline: 'none',
            resize: 'vertical',
            overflow: 'hidden',
            padding: 4,
            zIndex: 50,
          }}
        />
      )}
    </div>
  );
}

export default EditorCanvas;
