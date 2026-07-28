import { Rect, Text, Image as KonvaImage, Transformer, Group } from 'react-konva';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type Konva from 'konva';
import type { ImageElement, TextElement, PageElement, LayoutSlot, SlotAssignment } from '../../types';
import { useCachedBlobImage } from './useAssetImage';

// ─── Layout slot (for layout mode) ──────────────────────────────────────────

export function SlotComponent({
  slot,
  slotIndex,
  assignment,
  assetBlobs,
  projectId,
  isSelected,
  onSelect,
  onOffsetChange,
  onScaleChange,
  onCropChange,
  onEmptySlotDblClick,
  onRequestDelete,
  imageLabelPrefix,
  deleteImageLabel,
  lowResolutionHintText,
}: {
  slot: LayoutSlot;
  slotIndex: number;
  assignment?: SlotAssignment;
  assetBlobs: Record<string, Blob>;
  projectId: string;
  isSelected: boolean;
  onSelect: () => void;
  onOffsetChange: (slotIndex: number, offsetX: number, offsetY: number) => void;
  onScaleChange: (slotIndex: number, scale: number) => void;
  onCropChange: (slotIndex: number, cropX: number, cropY: number, cropW: number, cropH: number) => void;
  onEmptySlotDblClick: (slotIndex: number) => void;
  onRequestDelete: (slotIndex: number) => void;
  imageLabelPrefix: string;
  deleteImageLabel: string;
  lowResolutionHintText: (qualityPercent: number) => string;
}) {
  const image = useCachedBlobImage(projectId, assignment?.assetPath, assetBlobs);
  const naturalSize = useMemo(
    () => (image ? { w: image.naturalWidth, h: image.naturalHeight } : null),
    [image],
  );
  const [showResolutionHint, setShowResolutionHint] = useState(false);
  const [showSlotAction, setShowSlotAction] = useState(false);

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
    [assignment, naturalSize, hasCrop, zoomScale, slotIndex, onScaleChange, onCropChange, slot],
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

  const handleSlotClick = useCallback(() => {
    if (isSelected && assignment) {
      setShowSlotAction((prev) => !prev);
      return;
    }
    setShowSlotAction(false);
    onSelect();
  }, [assignment, isSelected, onSelect]);

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
        onClick={handleSlotClick}
        onTap={handleSlotClick}
        onDblClick={() => onEmptySlotDblClick(slotIndex)}
        onDblTap={() => onEmptySlotDblClick(slotIndex)}
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
            onClick={handleSlotClick}
            onTap={handleSlotClick}
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
            onClick={handleSlotClick}
            onTap={handleSlotClick}
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

      {showSlotAction && isSelected && assignment && (
        <Group>
          <Rect
            x={slot.x + slot.width - 116}
            y={slot.y + 8}
            width={108}
            height={28}
            fill="rgba(10,10,10,0.88)"
            stroke="#ef4444"
            strokeWidth={1}
            cornerRadius={6}
            onClick={(e) => {
              e.cancelBubble = true;
              onRequestDelete(slotIndex);
              setShowSlotAction(false);
            }}
            onTap={(e) => {
              e.cancelBubble = true;
              onRequestDelete(slotIndex);
              setShowSlotAction(false);
            }}
          />
          <Text
            x={slot.x + slot.width - 116}
            y={slot.y + 15}
            width={108}
            text={deleteImageLabel}
            fontSize={12}
            fill="#fecaca"
            align="center"
            listening={false}
          />
        </Group>
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
                  text={lowResolutionHintText(qualityPercent)}
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
          text={`${imageLabelPrefix} ${slotIndex + 1}`}
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
  projectId,
  isSelected,
  onSelect,
  onChange,
}: {
  element: ImageElement;
  assetBlobs: Record<string, Blob>;
  projectId: string;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (changes: Partial<ImageElement>) => void;
}) {
  const image = useCachedBlobImage(projectId, element.src, assetBlobs);
  const shapeRef = useRef<Konva.Image>(null);
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
        align={element.align ?? 'left'}
        fontStyle={element.fontStyle ?? 'normal'}
        lineHeight={element.lineHeight ?? 1.2}
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

export function ElementRenderer({
  element,
  assetBlobs,
  projectId,
  isSelected,
  onSelect,
  onChange,
  onStartEdit,
  onDragMove,
  isEditing,
}: {
  element: PageElement;
  assetBlobs: Record<string, Blob>;
  projectId: string;
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
          projectId={projectId}
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

