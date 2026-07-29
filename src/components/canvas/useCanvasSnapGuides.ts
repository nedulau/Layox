import { useCallback, useState } from 'react';
import type Konva from 'konva';
import { CANVAS_H, CANVAS_W } from '../../constants/canvas';
import type { LayoutSlot, PageElement } from '../../types';

export interface SnapGuide {
  x?: number;
  y?: number;
}

export function useCanvasSnapGuides({
  elements,
  computedSlots,
  isLayoutMode,
}: {
  elements: PageElement[];
  computedSlots: LayoutSlot[];
  isLayoutMode: boolean;
}) {
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);

  const handleElementDragMove = useCallback((
    event: Konva.KonvaEventObject<DragEvent>,
    elementId: string,
  ) => {
    const node = event.target;
    const snapDistance = 8;
    const x = node.x();
    const y = node.y();
    const width = node.width() * (node.scaleX() || 1);
    const height = (node.height() || 30) * (node.scaleY() || 1);
    const xTargets = [0, CANVAS_W, CANVAS_W / 2];
    const yTargets = [0, CANVAS_H, CANVAS_H / 2];

    if (isLayoutMode) {
      for (const slot of computedSlots) {
        xTargets.push(slot.x, slot.x + slot.width);
        yTargets.push(slot.y, slot.y + slot.height);
      }
    }
    for (const element of elements) {
      if (element.id === elementId) continue;
      xTargets.push(element.x);
      yTargets.push(element.y);
      if (element.type === 'image') {
        xTargets.push(element.x + element.width);
        yTargets.push(element.y + element.height);
      } else if (element.width) {
        xTargets.push(element.x + element.width);
      }
    }

    let snappedX = x;
    let snappedY = y;
    const nextGuides: SnapGuide[] = [];
    for (const target of xTargets) {
      if (Math.abs(x - target) < snapDistance) {
        snappedX = target;
        nextGuides.push({ x: target });
        break;
      }
      if (Math.abs(x + width - target) < snapDistance) {
        snappedX = target - width;
        nextGuides.push({ x: target });
        break;
      }
      if (Math.abs(x + width / 2 - target) < snapDistance) {
        snappedX = target - width / 2;
        nextGuides.push({ x: target });
        break;
      }
    }
    for (const target of yTargets) {
      if (Math.abs(y - target) < snapDistance) {
        snappedY = target;
        nextGuides.push({ y: target });
        break;
      }
      if (Math.abs(y + height - target) < snapDistance) {
        snappedY = target - height;
        nextGuides.push({ y: target });
        break;
      }
      if (Math.abs(y + height / 2 - target) < snapDistance) {
        snappedY = target - height / 2;
        nextGuides.push({ y: target });
        break;
      }
    }
    node.x(snappedX);
    node.y(snappedY);
    setSnapGuides(nextGuides);
  }, [computedSlots, elements, isLayoutMode]);

  const clearSnapGuides = useCallback(() => setSnapGuides([]), []);

  return {
    clearSnapGuides,
    handleElementDragMove,
    snapGuides,
  };
}
