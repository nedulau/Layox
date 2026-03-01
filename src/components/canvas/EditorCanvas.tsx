import { Stage, Layer, Rect, Text, Image as KonvaImage, Transformer, Group } from 'react-konva';
import { useEffect, useRef, useState, useCallback } from 'react';
import type Konva from 'konva';
import useProjectStore from '../../store/useProjectStore';
import type { ImageElement, TextElement, PageElement, LayoutSlot, SlotAssignment } from '../../types';
import { computeLayoutSlots } from '../../utils/layouts';

// ─── Layout slot (for layout mode) ──────────────────────────────────────────

function SlotComponent({
  slot,
  slotIndex,
  assignment,
  assetBlobs,
  isSelected,
  onSelect,
  onOffsetChange,
}: {
  slot: LayoutSlot;
  slotIndex: number;
  assignment?: SlotAssignment;
  assetBlobs: Record<string, Blob>;
  isSelected: boolean;
  onSelect: () => void;
  onOffsetChange: (slotIndex: number, offsetX: number, offsetY: number) => void;
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

  // Compute cover-fill dimensions
  const coverInfo = (() => {
    if (!naturalSize) return null;
    const scale = Math.max(slot.width / naturalSize.w, slot.height / naturalSize.h);
    const renderedW = naturalSize.w * scale;
    const renderedH = naturalSize.h * scale;
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

      {/* Clipped image – draggable within slot */}
      {image && coverInfo && (
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
    <Stage width={800} height={600} onClick={handleStageClick} onTap={handleStageClick}>
      <Layer>
        {/* Page background */}
        <Rect x={0} y={0} width={800} height={600} fill={currentPage?.background ?? '#ffffff'} />

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
            />
          ))}

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
  );
}

export default EditorCanvas;
