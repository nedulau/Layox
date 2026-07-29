import {
  useCallback,
  useState,
  type DragEvent as ReactDragEvent,
  type RefObject,
} from 'react';
import { CANVAS_H, CANVAS_W } from '../../constants/canvas';
import useProjectStore from '../../store/useProjectStore';
import type { LayoutSlot, SlotAssignment } from '../../types';

export function useCanvasDrop({
  containerRef,
  displayScale,
  computedSlots,
  isLayoutMode,
  selectedSlotIndex,
  slotAssignments,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  displayScale: number;
  computedSlots: LayoutSlot[];
  isLayoutMode: boolean;
  selectedSlotIndex: number | null;
  slotAssignments?: Record<number, SlotAssignment>;
}) {
  const [dragOver, setDragOver] = useState(false);
  const addImageFromFile = useProjectStore((state) => state.addImageFromFile);
  const addImageFromAsset = useProjectStore((state) => state.addImageFromAsset);
  const setSelectedSlotIndex = useProjectStore((state) => state.setSelectedSlotIndex);
  const snapshot = useProjectStore((state) => state.snapshot);

  const handleDragOver = useCallback((event: ReactDragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (
      event.dataTransfer.types.includes('Files')
      || event.dataTransfer.types.includes('application/x-layox-asset')
    ) {
      setDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((event: ReactDragEvent) => {
    event.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(async (event: ReactDragEvent) => {
    event.preventDefault();
    setDragOver(false);
    const existingAssetPath = event.dataTransfer.getData('application/x-layox-asset');
    if (existingAssetPath) {
      snapshot();
      if (isLayoutMode) {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          const canvasWidth = CANVAS_W * displayScale;
          const canvasHeight = CANVAS_H * displayScale;
          const canvasLeft = rect.left + (rect.width - canvasWidth) / 2;
          const canvasTop = rect.top + (rect.height - canvasHeight) / 2;
          const canvasX = (event.clientX - canvasLeft) / displayScale;
          const canvasY = (event.clientY - canvasTop) / displayScale;
          const slotIndex = computedSlots.findIndex((slot) => (
            canvasX >= slot.x
            && canvasX <= slot.x + slot.width
            && canvasY >= slot.y
            && canvasY <= slot.y + slot.height
          ));
          if (slotIndex >= 0) setSelectedSlotIndex(slotIndex);
        }
      }
      await addImageFromAsset(existingAssetPath);
      return;
    }

    const files = Array.from(event.dataTransfer.files).filter(
      (file) => file.type.startsWith('image/'),
    );
    if (files.length > 0) snapshot();
    for (const file of files) {
      await addImageFromFile(file);
    }
  }, [
    addImageFromAsset,
    addImageFromFile,
    computedSlots,
    containerRef,
    displayScale,
    isLayoutMode,
    setSelectedSlotIndex,
    snapshot,
  ]);

  const handleEmptySlotDblClick = useCallback((slotIndex: number) => {
    if (
      !isLayoutMode
      || selectedSlotIndex !== slotIndex
      || slotAssignments?.[slotIndex]
    ) {
      return;
    }
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
        // The selected slot remains active so the user can retry.
      }
    };
    input.click();
  }, [addImageFromFile, isLayoutMode, selectedSlotIndex, slotAssignments, snapshot]);

  return {
    dragOver,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleEmptySlotDblClick,
  };
}
