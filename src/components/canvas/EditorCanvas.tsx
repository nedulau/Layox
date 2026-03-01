import { Stage, Layer, Rect, Text, Image as KonvaImage, Transformer, Group } from 'react-konva';
import { useEffect, useRef, useState, useCallback } from 'react';
import type Konva from 'konva';
import useProjectStore from '../../store/useProjectStore';
import type { ImageElement, TextElement, PageElement, LayoutSlot, SlotAssignment } from '../../types';
import { computeLayoutSlots } from '../../utils/layouts';

const CANVAS_W = 800;
const CANVAS_H = 600;

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
        // Adjust crop region: zoom in/out about the crop center
        const cx = (assignment.cropX ?? 0) + (assignment.cropW ?? naturalSize.w) / 2;
        const cy = (assignment.cropY ?? 0) + (assignment.cropH ?? naturalSize.h) / 2;
        const factor = e.evt.deltaY > 0 ? 1.05 : 0.95;
        let newW = (assignment.cropW ?? naturalSize.w) * factor;
        let newH = (assignment.cropH ?? naturalSize.h) * factor;
        // Clamp to image bounds and minimum
        newW = Math.max(20, Math.min(naturalSize.w, newW));
        newH = Math.max(20, Math.min(naturalSize.h, newH));
        let newX = cx - newW / 2;
        let newY = cy - newH / 2;
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
            onClick={onSelect}
            onTap={onSelect}
            onWheel={handleWheel}
            onDblClick={handleDblClick}
            onDblTap={handleDblClick}
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
}: {
  element: TextElement;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (changes: Partial<TextElement>) => void;
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

  const handleDblClick = () => {
    const newText = prompt('Text bearbeiten:', element.content);
    if (newText !== null) {
      onChange({ content: newText });
    }
  };

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
        onTransformEnd={handleTransformEnd}
        onDblClick={handleDblClick}
        onDblTap={handleDblClick}
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
}: {
  element: PageElement;
  assetBlobs: Record<string, Blob>;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (changes: Partial<PageElement>) => void;
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
        />
      );
    default:
      return null;
  }
}

// ─── Main canvas ─────────────────────────────────────────────────────────────

function EditorCanvas() {
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
  const updateSlotCrop = useProjectStore((s) => s.updateSlotCrop);
  const clearSlotCrop = useProjectStore((s) => s.clearSlotCrop);

  const layoutId = currentPage?.layoutId;
  const isLayoutMode = !!layoutId;
  const layoutPadding = currentPage?.layoutPadding ?? 20;
  const layoutGap = currentPage?.layoutGap ?? 10;
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
      setDisplayScale(Math.min(scaleX, scaleY));
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

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
        className="shrink-0"
      >
        <Stage width={CANVAS_W} height={CANVAS_H} onClick={handleStageClick} onTap={handleStageClick}>
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
            {isCover && (
              <>
                <Text
                  x={0}
                  y={CANVAS_H * 0.35}
                  width={CANVAS_W}
                  text={coverTitle || 'Titel (Doppelklick)'}
                  fontSize={48}
                  fontFamily="Arial"
                  fontStyle="bold"
                  fill="#ffffff"
                  shadowColor="#000000"
                  shadowBlur={8}
                  shadowOpacity={0.7}
                  align="center"
                  listening={true}
                  onDblClick={() => {
                    const newTitle = prompt('Titel bearbeiten:', coverTitle);
                    if (newTitle !== null) setCoverTitle(newTitle);
                  }}
                  onDblTap={() => {
                    const newTitle = prompt('Titel bearbeiten:', coverTitle);
                    if (newTitle !== null) setCoverTitle(newTitle);
                  }}
                />
                <Text
                  x={0}
                  y={CANVAS_H * 0.35 + 60}
                  width={CANVAS_W}
                  text={coverSubtitle || 'Untertitel (Doppelklick)'}
                  fontSize={24}
                  fontFamily="Arial"
                  fill="#ffffffcc"
                  shadowColor="#000000"
                  shadowBlur={6}
                  shadowOpacity={0.5}
                  align="center"
                  listening={true}
                  onDblClick={() => {
                    const newSub = prompt('Untertitel bearbeiten:', coverSubtitle);
                    if (newSub !== null) setCoverSubtitle(newSub);
                  }}
                  onDblTap={() => {
                    const newSub = prompt('Untertitel bearbeiten:', coverSubtitle);
                    if (newSub !== null) setCoverSubtitle(newSub);
                  }}
                />
              </>
            )}

            {/* Free elements (all in free mode, text-only in layout mode) */}
            {sortedFreeElements.map((el) => (
              <ElementRenderer
                key={el.id}
                element={el}
                assetBlobs={assetBlobs}
                isSelected={selectedElementId === el.id}
                onSelect={() => setSelectedElementId(el.id)}
                onChange={(changes) => updateElement(el.id, changes)}
              />
            ))}
          </Layer>
        </Stage>
      </div>
    </div>
  );
}

export default EditorCanvas;
