import { Group, Image as KonvaImage, Rect, Text } from 'react-konva';
import { useCallback, useMemo, useState } from 'react';
import type Konva from 'konva';
import type { LayoutSlot, SlotAssignment } from '../../types';
import { useCachedBlobImage } from './useAssetImage';

export default function SlotComponent({
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
  onCropChange: (
    slotIndex: number,
    cropX: number,
    cropY: number,
    cropW: number,
    cropH: number,
  ) => void;
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

  const coverInfo = (() => {
    if (!naturalSize || hasCrop) return null;
    const baseScale = Math.max(slot.width / naturalSize.w, slot.height / naturalSize.h);
    const finalScale = baseScale * zoomScale;
    const renderedW = naturalSize.w * finalScale;
    const renderedH = naturalSize.h * finalScale;
    return {
      renderedW,
      renderedH,
      excessW: renderedW - slot.width,
      excessH: renderedH - slot.height,
    };
  })();

  const rawOffsetX = assignment?.offsetX ?? 0;
  const rawOffsetY = assignment?.offsetY ?? 0;
  const clampedOffsetX = coverInfo
    ? Math.max(-coverInfo.excessW / 2, Math.min(coverInfo.excessW / 2, rawOffsetX))
    : 0;
  const clampedOffsetY = coverInfo
    ? Math.max(-coverInfo.excessH / 2, Math.min(coverInfo.excessH / 2, rawOffsetY))
    : 0;

  const handleDragEnd = (event: Konva.KonvaEventObject<DragEvent>) => {
    if (!coverInfo) return;
    onOffsetChange(
      slotIndex,
      event.target.x() - slot.x + coverInfo.excessW / 2,
      event.target.y() - slot.y + coverInfo.excessH / 2,
    );
  };

  const handleCropDragEnd = (event: Konva.KonvaEventObject<DragEvent>) => {
    if (!assignment || !naturalSize || !hasCrop) return;
    const cropW = assignment.cropW ?? naturalSize.w;
    const cropH = assignment.cropH ?? naturalSize.h;
    const newCropX = Math.max(
      0,
      Math.min(
        naturalSize.w - cropW,
        (assignment.cropX ?? 0) - (event.target.x() - slot.x) * (cropW / slot.width),
      ),
    );
    const newCropY = Math.max(
      0,
      Math.min(
        naturalSize.h - cropH,
        (assignment.cropY ?? 0) - (event.target.y() - slot.y) * (cropH / slot.height),
      ),
    );
    event.target.position({ x: slot.x, y: slot.y });
    onCropChange(
      slotIndex,
      Math.round(newCropX),
      Math.round(newCropY),
      Math.round(cropW),
      Math.round(cropH),
    );
  };

  const dragBoundFunc = (position: { x: number; y: number }) => {
    if (!coverInfo) return position;
    return {
      x: Math.max(slot.x - coverInfo.excessW, Math.min(slot.x, position.x)),
      y: Math.max(slot.y - coverInfo.excessH, Math.min(slot.y, position.y)),
    };
  };

  const handleWheel = useCallback(
    (event: Konva.KonvaEventObject<WheelEvent>) => {
      if (!assignment || !naturalSize) return;
      event.evt.preventDefault();
      if (hasCrop) {
        const cropX = assignment.cropX ?? 0;
        const cropY = assignment.cropY ?? 0;
        const cropW = assignment.cropW ?? naturalSize.w;
        const cropH = assignment.cropH ?? naturalSize.h;
        const pointer = event.target.getStage()?.getPointerPosition();
        const localX = pointer
          ? Math.max(0, Math.min(slot.width, pointer.x - slot.x))
          : slot.width / 2;
        const localY = pointer
          ? Math.max(0, Math.min(slot.height, pointer.y - slot.y))
          : slot.height / 2;
        const anchorX = cropX + (localX / slot.width) * cropW;
        const anchorY = cropY + (localY / slot.height) * cropH;
        const factor = event.evt.deltaY > 0 ? 1.05 : 0.95;
        const newW = Math.max(20, Math.min(naturalSize.w, cropW * factor));
        const newH = Math.max(20, Math.min(naturalSize.h, cropH * factor));
        const newX = Math.max(
          0,
          Math.min(naturalSize.w - newW, anchorX - (localX / slot.width) * newW),
        );
        const newY = Math.max(
          0,
          Math.min(naturalSize.h - newH, anchorY - (localY / slot.height) * newH),
        );
        onCropChange(
          slotIndex,
          Math.round(newX),
          Math.round(newY),
          Math.round(newW),
          Math.round(newH),
        );
      } else {
        const delta = event.evt.deltaY > 0 ? -0.05 : 0.05;
        onScaleChange(slotIndex, Math.max(1, Math.min(5, zoomScale + delta)));
      }
    },
    [assignment, hasCrop, naturalSize, onCropChange, onScaleChange, slot, slotIndex, zoomScale],
  );

  const handleDblClick = useCallback(() => {
    if (!assignment || !naturalSize || hasCrop) return;
    const baseScale = Math.max(slot.width / naturalSize.w, slot.height / naturalSize.h);
    const finalScale = baseScale * zoomScale;
    const excessW = naturalSize.w * finalScale - slot.width;
    const excessH = naturalSize.h * finalScale - slot.height;
    const cropX = Math.max(
      0,
      Math.round((excessW / 2 - (assignment.offsetX ?? 0)) / finalScale),
    );
    const cropY = Math.max(
      0,
      Math.round((excessH / 2 - (assignment.offsetY ?? 0)) / finalScale),
    );
    onCropChange(
      slotIndex,
      cropX,
      cropY,
      Math.min(naturalSize.w - cropX, Math.round(slot.width / finalScale)),
      Math.min(naturalSize.h - cropY, Math.round(slot.height / finalScale)),
    );
  }, [assignment, hasCrop, naturalSize, onCropChange, slot, slotIndex, zoomScale]);

  const handleSlotClick = useCallback(() => {
    if (isSelected && assignment) {
      setShowSlotAction((visible) => !visible);
      return;
    }
    setShowSlotAction(false);
    onSelect();
  }, [assignment, isSelected, onSelect]);

  const resolutionWarning = image && naturalSize && (() => {
    const effectiveNaturalWidth = hasCrop
      ? (assignment?.cropW ?? naturalSize.w)
      : naturalSize.w;
    const effectiveNaturalHeight = hasCrop
      ? (assignment?.cropH ?? naturalSize.h)
      : naturalSize.h;
    const ratio = Math.min(
      effectiveNaturalWidth / slot.width,
      effectiveNaturalHeight / slot.height,
    );
    if (ratio >= 1) return null;
    const qualityPercent = Math.max(1, Math.round(ratio * 100));
    const tooltipX = Math.max(slot.x + 8, slot.x + slot.width - 314);
    return (
      <>
        <Group
          onMouseEnter={() => setShowResolutionHint(true)}
          onMouseLeave={() => setShowResolutionHint(false)}
          onTap={() => setShowResolutionHint((visible) => !visible)}
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
  })();

  return (
    <>
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

      {image && hasCrop && assignment && (
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
              x: assignment.cropX ?? 0,
              y: assignment.cropY ?? 0,
              width: assignment.cropW ?? image.naturalWidth,
              height: assignment.cropH ?? image.naturalHeight,
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
            onClick={(event) => {
              event.cancelBubble = true;
              onRequestDelete(slotIndex);
              setShowSlotAction(false);
            }}
            onTap={(event) => {
              event.cancelBubble = true;
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

      {resolutionWarning}

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
