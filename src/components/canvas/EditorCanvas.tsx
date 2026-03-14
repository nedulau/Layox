import { Stage, Layer, Rect, Text, Image as KonvaImage, Transformer, Group, Line } from 'react-konva';
import { useEffect, useRef, useState, useCallback } from 'react';
import type Konva from 'konva';
import useProjectStore from '../../store/useProjectStore';
import type { ImageElement, TextElement, PageElement, LayoutSlot, SlotAssignment } from '../../types';
import { computeLayoutSlots } from '../../utils/layouts';
import { CANVAS_H, CANVAS_W } from '../../constants/canvas';

// ─── Layout slot (for layout mode) ──────────────────────────────────────────

function SlotComponent({
  slot,
  slotIndex,
  assignment,
  assetBlobs,
  isSelected,
  onSelect,
  onOffsetChange,
  onScaleChange,
  onCropChange,
}: {
  slot: LayoutSlot;
  slotIndex: number;
  assignment?: SlotAssignment;
  assetBlobs: Record<string, Blob>;
  isSelected: boolean;
  onSelect: () => void;
  onOffsetChange: (slotIndex: number, offsetX: number, offsetY: number) => void;
  onScaleChange: (slotIndex: number, scale: number) => void;
  onCropChange: (slotIndex: number, cropX: number, cropY: number, cropW: number, cropH: number) => void;
}) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [showResolutionHint, setShowResolutionHint] = useState(false);

  useEffect(() => {
    if (!assignment?.assetPath) {
      setImage(null);
      setNaturalSize(null);
      return;
    }
    const blob = assetBlobs[assignment.assetPath];
    if (!blob) {
      setImage(null);
      setNaturalSize(null);
      return;
    }
    const url = URL.createObjectURL(blob);
    const img = new window.Image();
    img.onload = () => {
      setImage(img);
      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [assignment?.assetPath, assetBlobs]);

  const zoomScale = assignment?.scale ?? 1;
  const hasCrop = assignment?.cropX !== undefined && assignment?.cropW !== undefined;

  // Compute cover-fill dimensions (with user zoom) — used when no crop is set
  const coverInfo = (() => {
    if (!naturalSize || hasCrop) return null;
    const baseScale = Math.max(slot.width / naturalSize.w, slot.height / naturalSize.h);
    const finalScale = baseScale * zoomScale;
    const renderedW = naturalSize.w * finalScale;
    const renderedH = naturalSize.h * finalScale;
    const excessW = renderedW - slot.width;
    const excessH = renderedH - slot.height;
    return { renderedW, renderedH, excessW, excessH };
  })();

  // Clamp offsets so image always covers the slot
  const rawOffsetX = assignment?.offsetX ?? 0;
  const rawOffsetY = assignment?.offsetY ?? 0;
  const clampedOffsetX = coverInfo
    ? Math.max(-coverInfo.excessW / 2, Math.min(coverInfo.excessW / 2, rawOffsetX))
    : 0;
  const clampedOffsetY = coverInfo
    ? Math.max(-coverInfo.excessH / 2, Math.min(coverInfo.excessH / 2, rawOffsetY))
    : 0;

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    if (!coverInfo) return;
    const newOffsetX = e.target.x() - slot.x + coverInfo.excessW / 2;
    const newOffsetY = e.target.y() - slot.y + coverInfo.excessH / 2;
    onOffsetChange(slotIndex, newOffsetX, newOffsetY);
  };

  const handleCropDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    if (!assignment || !naturalSize || !hasCrop) return;
    const dx = e.target.x() - slot.x;
    const dy = e.target.y() - slot.y;
    const cropW = assignment.cropW ?? naturalSize.w;
    const cropH = assignment.cropH ?? naturalSize.h;
    const pxToCropX = cropW / slot.width;
    const pxToCropY = cropH / slot.height;

    let newCropX = (assignment.cropX ?? 0) - dx * pxToCropX;
    let newCropY = (assignment.cropY ?? 0) - dy * pxToCropY;

    newCropX = Math.max(0, Math.min(naturalSize.w - cropW, newCropX));
    newCropY = Math.max(0, Math.min(naturalSize.h - cropH, newCropY));

    e.target.position({ x: slot.x, y: slot.y });
    onCropChange(slotIndex, Math.round(newCropX), Math.round(newCropY), Math.round(cropW), Math.round(cropH));
  };

  const dragBoundFunc = (pos: { x: number; y: number }) => {
    if (!coverInfo) return pos;
    return {
      x: Math.max(slot.x - coverInfo.excessW, Math.min(slot.x, pos.x)),
      y: Math.max(slot.y - coverInfo.excessH, Math.min(slot.y, pos.y)),
    };
  };

  // Scroll-to-zoom on image (adjusts scale when no crop, or adjusts crop region when cropped)
  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      if (!assignment || !naturalSize) return;
      e.evt.preventDefault();
      if (hasCrop) {
        const cropX = assignment.cropX ?? 0;
        const cropY = assignment.cropY ?? 0;
        const cropW = assignment.cropW ?? naturalSize.w;
        const cropH = assignment.cropH ?? naturalSize.h;

        const stage = e.target.getStage();
        const pointer = stage?.getPointerPosition();
        const localX = pointer ? Math.max(0, Math.min(slot.width, pointer.x - slot.x)) : slot.width / 2;
        const localY = pointer ? Math.max(0, Math.min(slot.height, pointer.y - slot.y)) : slot.height / 2;

        const anchorX = cropX + (localX / slot.width) * cropW;
        const anchorY = cropY + (localY / slot.height) * cropH;
        const factor = e.evt.deltaY > 0 ? 1.05 : 0.95;
        let newW = cropW * factor;
        let newH = cropH * factor;
        // Clamp to image bounds and minimum
        newW = Math.max(20, Math.min(naturalSize.w, newW));
        newH = Math.max(20, Math.min(naturalSize.h, newH));

        let newX = anchorX - (localX / slot.width) * newW;
        let newY = anchorY - (localY / slot.height) * newH;
        newX = Math.max(0, Math.min(naturalSize.w - newW, newX));
        newY = Math.max(0, Math.min(naturalSize.h - newH, newY));
        onCropChange(slotIndex, Math.round(newX), Math.round(newY), Math.round(newW), Math.round(newH));
      } else {
        const delta = e.evt.deltaY > 0 ? -0.05 : 0.05;
        const newScale = Math.max(1, Math.min(5, zoomScale + delta));
        onScaleChange(slotIndex, newScale);
      }
    },
    [assignment, naturalSize, hasCrop, zoomScale, slotIndex, onScaleChange, onCropChange],
  );

  // Double-click to crop: initialize crop to current visible region or prompt-like behavior
  const handleDblClick = useCallback(() => {
    if (!assignment || !naturalSize) return;
    if (!hasCrop) {
      // Initialize crop from the current zoom/pan view
      const baseScale = Math.max(slot.width / naturalSize.w, slot.height / naturalSize.h);
      const finalScale = baseScale * zoomScale;
      const renderedW = naturalSize.w * finalScale;
      const renderedH = naturalSize.h * finalScale;
      const excessW = renderedW - slot.width;
      const excessH = renderedH - slot.height;
      const ox = assignment.offsetX ?? 0;
      const oy = assignment.offsetY ?? 0;
      // Visible region origin in rendered-px
      const visX = excessW / 2 - ox;
      const visY = excessH / 2 - oy;
      // Convert to natural pixels
      const cropX = Math.max(0, Math.round(visX / finalScale));
      const cropY = Math.max(0, Math.round(visY / finalScale));
      const cropW = Math.min(naturalSize.w - cropX, Math.round(slot.width / finalScale));
      const cropH = Math.min(naturalSize.h - cropY, Math.round(slot.height / finalScale));
      onCropChange(slotIndex, cropX, cropY, cropW, cropH);
    }
  }, [assignment, naturalSize, hasCrop, slot, zoomScale, slotIndex, onCropChange]);

  return (
    <>
      {/* Slot background */}
      <Rect
        x={slot.x}
        y={slot.y}
        width={slot.width}
        height={slot.height}
        fill={image ? undefined : '#f0f0f0'}
        stroke={isSelected ? '#3b82f6' : '#ddd'}
        strokeWidth={isSelected ? 3 : 2}
        dash={image ? undefined : [8, 4]}
        cornerRadius={4}
        onClick={onSelect}
        onTap={onSelect}
      />

      {/* Clipped image – draggable within slot, scroll to zoom, dblclick to crop */}
      {image && hasCrop && (
        <Group
          clipX={slot.x}
          clipY={slot.y}
          clipWidth={slot.width}
          clipHeight={slot.height}
        >
          <KonvaImage
            image={image}
            x={slot.x}
            y={slot.y}
            width={slot.width}
            height={slot.height}
            crop={{
              x: assignment!.cropX!,
              y: assignment!.cropY!,
              width: assignment!.cropW!,
              height: assignment!.cropH!,
            }}
            draggable
            dragBoundFunc={() => ({ x: slot.x, y: slot.y })}
            onClick={onSelect}
            onTap={onSelect}
            onDragEnd={handleCropDragEnd}
            onWheel={handleWheel}
            onDblClick={handleDblClick}
            onDblTap={handleDblClick}
            listening
          />
        </Group>
      )}
      {image && coverInfo && !hasCrop && (
        <Group
          clipX={slot.x}
          clipY={slot.y}
          clipWidth={slot.width}
          clipHeight={slot.height}
        >
          <KonvaImage
            image={image}
            x={slot.x - coverInfo.excessW / 2 + clampedOffsetX}
            y={slot.y - coverInfo.excessH / 2 + clampedOffsetY}
            width={coverInfo.renderedW}
            height={coverInfo.renderedH}
            draggable
            dragBoundFunc={dragBoundFunc}
            onClick={onSelect}
            onTap={onSelect}
            onDragEnd={handleDragEnd}
            onWheel={handleWheel}
            onDblClick={handleDblClick}
            onDblTap={handleDblClick}
          />
        </Group>
      )}

      {/* Selected overlay */}
      {isSelected && (
        <Rect
          x={slot.x}
          y={slot.y}
          width={slot.width}
          height={slot.height}
          stroke="#3b82f6"
          strokeWidth={3}
          cornerRadius={4}
          listening={false}
        />
      )}

      {/* Pixelated / low-resolution warning */}
      {image && naturalSize && (() => {
        // Compare natural image pixels to the slot's display size.
        // A pixelRatio of 2 is used for export (retina), so we expect
        // at least 1× coverage. Below that the image will look blurry.
        const effectiveNatW = hasCrop ? (assignment!.cropW ?? naturalSize.w) : naturalSize.w;
        const effectiveNatH = hasCrop ? (assignment!.cropH ?? naturalSize.h) : naturalSize.h;
        const ratio = Math.min(effectiveNatW / slot.width, effectiveNatH / slot.height);
        if (ratio >= 1) return null;
        const qualityPercent = Math.max(1, Math.round(ratio * 100));
        const tooltipX = Math.max(slot.x + 8, slot.x + slot.width - 314);
        return (
          <>
            <Group
              onMouseEnter={() => setShowResolutionHint(true)}
              onMouseLeave={() => setShowResolutionHint(false)}
              onTap={() => setShowResolutionHint((v) => !v)}
            >
              <Rect
                x={slot.x + slot.width - 46}
                y={slot.y + 4}
                width={40}
                height={30}
                fill="rgba(0,0,0,0.7)"
                stroke="#f59e0b"
                strokeWidth={1.5}
                cornerRadius={6}
              />
              <Text
                x={slot.x + slot.width - 46}
                y={slot.y + 10}
                width={40}
                text="⚠"
                fontSize={20}
                fill="#fbbf24"
                align="center"
              />
            </Group>

            {showResolutionHint && (
              <Group listening={false}>
                <Rect
                  x={tooltipX}
                  y={slot.y + 38}
                  width={308}
                  height={84}
                  fill="rgba(10,10,10,0.88)"
                  stroke="#525252"
                  strokeWidth={1}
                  cornerRadius={8}
                />
                <Text
                  x={tooltipX + 10}
                  y={slot.y + 47}
                  width={288}
                  text={`Niedrige Auflösung – kann pixelig wirken\nCa. ${qualityPercent}% der empfohlenen Größe`}
                  fontSize={14}
                  lineHeight={1.35}
                  fill="#e5e5e5"
                />
              </Group>
            )}
          </>
        );
      })()}

      {/* Empty slot placeholder */}
      {!image && (
        <Text
          x={slot.x}
          y={slot.y + slot.height / 2 - 10}
          width={slot.width}
          text={`Bild ${slotIndex + 1}`}
          fontSize={16}
          fill="#bbb"
          align="center"
          listening={false}
        />
      )}
    </>
  );
}

// ─── Free Image element (free mode only) ─────────────────────────────────────

function ImageElementComponent({
  element,
  assetBlobs,
  isSelected,
  onSelect,
  onChange,
}: {
  element: ImageElement;
  assetBlobs: Record<string, Blob>;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (changes: Partial<ImageElement>) => void;
}) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const shapeRef = useRef<Konva.Image>(null);
  const trRef = useRef<Konva.Transformer>(null);

  useEffect(() => {
    const blob = assetBlobs[element.src];
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const img = new window.Image();
    img.onload = () => setImage(img);
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [element.src, assetBlobs]);

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    onChange({ x: Math.round(e.target.x()), y: Math.round(e.target.y()) });
  };

  const handleTransformEnd = () => {
    const node = shapeRef.current;
    if (!node) return;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    onChange({
      x: Math.round(node.x()),
      y: Math.round(node.y()),
      width: Math.round(node.width() * scaleX),
      height: Math.round(node.height() * scaleY),
      rotation: Math.round(node.rotation()),
    });
  };

  if (!image) {
    return (
      <Rect
        x={element.x}
        y={element.y}
        width={element.width}
        height={element.height}
        fill="#555"
        rotation={element.rotation}
        onClick={onSelect}
        onTap={onSelect}
      />
    );
  }

  return (
    <>
      <KonvaImage
        ref={shapeRef}
        image={image}
        x={element.x}
        y={element.y}
        width={element.width}
        height={element.height}
        rotation={element.rotation}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          rotateEnabled
          keepRatio={false}
          boundBoxFunc={(oldBox, newBox) =>
            newBox.width < 20 || newBox.height < 20 ? oldBox : newBox
          }
        />
      )}
    </>
  );
}

// ─── Text element (both modes) ───────────────────────────────────────────────

function TextElementComponent({
  element,
  isSelected,
  onSelect,
  onChange,
  onStartEdit,
  onDragMove,
  isEditing,
}: {
  element: TextElement;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (changes: Partial<TextElement>) => void;
  onStartEdit: () => void;
  onDragMove?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  isEditing?: boolean;
}) {
  const shapeRef = useRef<Konva.Text>(null);
  const trRef = useRef<Konva.Transformer>(null);

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    onChange({ x: Math.round(e.target.x()), y: Math.round(e.target.y()) });
  };

  const handleTransformEnd = () => {
    const node = shapeRef.current;
    if (!node) return;
    const scaleX = node.scaleX();
    node.scaleX(1);
    node.scaleY(1);
    onChange({
      x: Math.round(node.x()),
      y: Math.round(node.y()),
      fontSize: Math.round(element.fontSize * scaleX),
      width: Math.round(node.width() * scaleX),
      rotation: Math.round(node.rotation()),
    });
  };

  // Hide the Konva text node when inline editing is active (prevents doubled/offset display)
  if (isEditing) return null;

  return (
    <>
      <Text
        ref={shapeRef}
        x={element.x}
        y={element.y}
        text={element.content}
        fontSize={element.fontSize}
        fontFamily={element.fontFamily}
        fill={element.color}
        width={element.width}
        rotation={element.rotation}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={handleDragEnd}
        onDragMove={onDragMove}
        onTransformEnd={handleTransformEnd}
        onDblClick={onStartEdit}
        onDblTap={onStartEdit}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          rotateEnabled
          enabledAnchors={['middle-left', 'middle-right']}
          boundBoxFunc={(oldBox, newBox) =>
            newBox.width < 20 ? oldBox : newBox
          }
        />
      )}
    </>
  );
}

// ─── Element renderer (free elements) ────────────────────────────────────────

function ElementRenderer({
  element,
  assetBlobs,
  isSelected,
  onSelect,
  onChange,
  onStartEdit,
  onDragMove,
  isEditing,
}: {
  element: PageElement;
  assetBlobs: Record<string, Blob>;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (changes: Partial<PageElement>) => void;
  onStartEdit?: () => void;
  onDragMove?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  isEditing?: boolean;
}) {
  switch (element.type) {
    case 'image':
      return (
        <ImageElementComponent
          element={element}
          assetBlobs={assetBlobs}
          isSelected={isSelected}
          onSelect={onSelect}
          onChange={onChange}
        />
      );
    case 'text':
      return (
        <TextElementComponent
          element={element}
          isSelected={isSelected}
          onSelect={onSelect}
          onChange={onChange}
          onStartEdit={onStartEdit || (() => {})}
          onDragMove={onDragMove}
          isEditing={isEditing}
        />
      );
    default:
      return null;
  }
}

// ─── Main canvas ─────────────────────────────────────────────────────────────

function EditorCanvas({
  zoomMode = 'fit',
  manualZoom = 1,
  onDisplayScaleChange,
}: {
  zoomMode?: 'fit' | 'manual';
  manualZoom?: number;
  onDisplayScaleChange?: (scale: number) => void;
}) {
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
  const setCoverTitle = useProjectStore((s) => s.setCoverTitle);
  const setCoverSubtitle = useProjectStore((s) => s.setCoverSubtitle);
  const setCoverTitlePosition = useProjectStore((s) => s.setCoverTitlePosition);
  const setCoverSubtitlePosition = useProjectStore((s) => s.setCoverSubtitlePosition);
  const updateSlotCrop = useProjectStore((s) => s.updateSlotCrop);
  const snapshot = useProjectStore((s) => s.snapshot);
  const defaultLayoutPadding = useProjectStore((s) => s.project.meta.defaultLayoutPadding ?? 20);
  const defaultLayoutGap = useProjectStore((s) => s.project.meta.defaultLayoutGap ?? 10);

  const layoutId = currentPage?.layoutId;
  const isLayoutMode = !!layoutId;
  const layoutPadding = currentPage?.layoutPadding ?? defaultLayoutPadding;
  const layoutGap = currentPage?.layoutGap ?? defaultLayoutGap;
  const computedSlots = layoutId ? computeLayoutSlots(layoutId, layoutPadding, layoutGap) : [];

  // In layout mode: only text elements are free. In free mode: all elements.
  const elements = currentPage?.elements ?? [];
  const freeElements = isLayoutMode
    ? elements.filter((el) => el.type === 'text')
    : elements;
  const sortedFreeElements = [...freeElements].sort((a, b) => a.zIndex - b.zIndex);

  // Cover page
  const isCover = currentPage?.isCover;
  const coverTitle = currentPage?.coverTitle ?? '';
  const coverSubtitle = currentPage?.coverSubtitle ?? '';
  const showCoverSubtitle = currentPage?.showCoverSubtitle ?? false;
  const coverTitleFontSize = currentPage?.coverTitleFontSize ?? 48;
  const coverTitleFontFamily = currentPage?.coverTitleFontFamily ?? 'Arial';
  const coverTitleColor = currentPage?.coverTitleColor ?? '#ffffff';
  const coverTitleX = currentPage?.coverTitleX ?? 0;
  const coverTitleY = currentPage?.coverTitleY ?? CANVAS_H * 0.35;
  const coverSubtitleFontSize = currentPage?.coverSubtitleFontSize ?? 24;
  const coverSubtitleFontFamily = currentPage?.coverSubtitleFontFamily ?? 'Arial';
  const coverSubtitleColor = currentPage?.coverSubtitleColor ?? '#ffffffcc';
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
    if (e.dataTransfer.types.includes('Files')) {
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
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith('image/'),
      );
      for (const file of files) {
        await addImageFromFile(file);
      }
    },
    [addImageFromFile],
  );

  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
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
  const startInlineEdit = useCallback(
    (elementId: string) => {
      const el = freeElements.find((e) => e.id === elementId);
      if (!el || el.type !== 'text') return;
      snapshot();
      const isDefaultText = el.content === 'Text bearbeiten';
      setInlineEdit({
        type: 'element',
        id: elementId,
        text: isDefaultText ? '' : el.content,
        x: el.x,
        y: el.y,
        width: el.width || 200,
        fontSize: el.fontSize,
        fontFamily: el.fontFamily,
        color: el.color,
      });
    },
    [freeElements, snapshot],
  );

  const startCoverEdit = useCallback(
    (field: 'coverTitle' | 'coverSubtitle') => {
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
    },
    [coverTitle, coverSubtitle, coverTitleX, coverTitleY, coverSubtitleX, coverSubtitleY, coverTitleFontSize, coverSubtitleFontSize, coverTitleFontFamily, coverSubtitleFontFamily, coverTitleColor, coverSubtitleColor, snapshot],
  );

  const commitInlineEdit = useCallback(() => {
    if (!inlineEdit) return;
    const finalText = inlineEdit.text.trim() || (inlineEdit.type === 'element' ? 'Text bearbeiten' : '');
    if (inlineEdit.type === 'element' && inlineEdit.id) {
      updateElement(inlineEdit.id, { content: finalText });
    } else if (inlineEdit.type === 'coverTitle') {
      setCoverTitle(finalText);
    } else if (inlineEdit.type === 'coverSubtitle') {
      setCoverSubtitle(finalText);
    }
    setInlineEdit(null);
  }, [inlineEdit, updateElement, setCoverTitle, setCoverSubtitle]);

  const cancelInlineEdit = useCallback(() => {
    setInlineEdit(null);
  }, []);

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
          <span className="text-blue-300 text-xl font-medium">Bild(er) hier ablegen</span>
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
        <Stage width={CANVAS_W} height={CANVAS_H} onClick={handleStageClick} onTap={handleStageClick as any} onDragStart={handleDragStart}>
          <Layer>
            {/* Page background */}
            <Rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill={currentPage?.background ?? '#ffffff'} />

            {/* Layout slots (layout mode only) */}
            {isLayoutMode &&
              computedSlots.map((slot, i) => (
                <SlotComponent
                  key={i}
                  slot={slot}
                  slotIndex={i}
                  assignment={currentPage?.slotAssignments?.[i]}
                  assetBlobs={assetBlobs}
                  isSelected={selectedSlotIndex === i}
                  onSelect={() => setSelectedSlotIndex(i)}
                  onOffsetChange={updateSlotOffset}
                  onScaleChange={updateSlotScale}
                  onCropChange={updateSlotCrop}
                />
              ))}

            {/* Cover page title overlay */}
            {isCover && !inlineEdit?.type?.startsWith('cover') && (
              <>
                <Text
                  x={coverTitleX}
                  y={coverTitleY}
                  width={CANVAS_W}
                  text={coverTitle || 'Titel'}
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
                    text={coverSubtitle || 'Untertitel'}
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
                isSelected={selectedElementId === el.id && inlineEdit?.id !== el.id}
                onSelect={() => setSelectedElementId(el.id)}
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
      {inlineEdit && containerRef.current && (() => {
        const rect = containerRef.current!.getBoundingClientRect();
        const canvasScreenW = CANVAS_W * displayScale;
        const canvasScreenH = CANVAS_H * displayScale;
        const offsetX = (rect.width - canvasScreenW) / 2;
        const offsetY = (rect.height - canvasScreenH) / 2;
        const left = offsetX + inlineEdit.x * displayScale;
        const top = offsetY + inlineEdit.y * displayScale;
        const width = inlineEdit.width * displayScale;
        const fontSize = inlineEdit.fontSize * displayScale;

        return (
          <textarea
            ref={inlineTextareaRef}
            autoFocus
            value={inlineEdit.text}
            onChange={(e) => {
              const target = e.target;
              target.style.height = 'auto';
              target.style.height = `${target.scrollHeight}px`;
              setInlineEdit((prev) => prev ? { ...prev, text: target.value } : null);
            }}
            onBlur={commitInlineEdit}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { e.preventDefault(); cancelInlineEdit(); }
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); commitInlineEdit(); }
            }}
            style={{
              position: 'absolute',
              left,
              top,
              width,
              minHeight: fontSize * 1.5,
              fontSize,
              fontFamily: inlineEdit.fontFamily,
              color: inlineEdit.color,
              textAlign: (inlineEdit.align || 'left') as React.CSSProperties['textAlign'],
              fontWeight: inlineEdit.fontStyle?.includes('bold') ? 'bold' : 'normal',
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
        );
      })()}
    </div>
  );
}

export default EditorCanvas;
