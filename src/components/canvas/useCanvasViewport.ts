import { useEffect, useRef, useState } from 'react';
import { CANVAS_H, CANVAS_W } from '../../constants/canvas';

export function useCanvasViewport({
  zoomMode,
  manualZoom,
  onDisplayScaleChange,
}: {
  zoomMode: 'fit' | 'manual';
  manualZoom: number;
  onDisplayScaleChange?: (scale: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [displayScale, setDisplayScale] = useState(1);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateScale = () => {
      const rect = container.getBoundingClientRect();
      const fitScale = Math.max(
        0.12,
        Math.min(3, Math.min(rect.width / CANVAS_W, rect.height / CANVAS_H)),
      );
      const nextScale = zoomMode === 'fit'
        ? fitScale
        : Math.min(3, Math.max(0.2, manualZoom));
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

  return {
    containerRef,
    containerSize,
    displayScale,
  };
}
