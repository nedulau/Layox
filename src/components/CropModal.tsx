import { useState, useEffect, useCallback } from 'react';

interface CropModalProps {
  imageBlob: Blob;
  initialCrop?: { x: number; y: number; w: number; h: number };
  onConfirm: (crop: { x: number; y: number; w: number; h: number }) => void;
  onCancel: () => void;
}

type HandleType = 'move' | 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export default function CropModal({
  imageBlob,
  initialCrop,
  onConfirm,
  onCancel,
}: CropModalProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(imageBlob);
    const img = new window.Image();
    img.onload = () => {
      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
      setImageUrl(url);
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [imageBlob]);

  // Display dimensions (fit image in 80% viewport)
  const maxW = window.innerWidth * 0.8;
  const maxH = window.innerHeight * 0.75;
  const imgScale = naturalSize ? Math.min(maxW / naturalSize.w, maxH / naturalSize.h, 1) : 1;
  const displayW = naturalSize ? naturalSize.w * imgScale : 0;
  const displayH = naturalSize ? naturalSize.h * imgScale : 0;

  const MIN_SIZE = 30;

  // Crop state (in natural image pixels) — free aspect ratio
  const [crop, setCrop] = useState(() => {
    if (initialCrop) return initialCrop;
    if (!naturalSize) return { x: 0, y: 0, w: 100, h: 100 };
    return { x: 0, y: 0, w: naturalSize.w, h: naturalSize.h };
  });

  // Re-init crop when image loads
  useEffect(() => {
    if (!naturalSize) return;
    if (initialCrop) {
      setCrop(initialCrop);
      return;
    }
    setCrop({ x: 0, y: 0, w: naturalSize.w, h: naturalSize.h });
  }, [naturalSize, initialCrop]);

  // Interaction state
  const [dragging, setDragging] = useState<HandleType | null>(null);
  const [dragStart, setDragStart] = useState({ mx: 0, my: 0, crop: { x: 0, y: 0, w: 0, h: 0 } });

  const handlePointerDown = (type: HandleType, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(type);
    setDragStart({ mx: e.clientX, my: e.clientY, crop: { ...crop } });
  };

  useEffect(() => {
    if (!dragging || !naturalSize) return;

    const handlePointerMove = (e: PointerEvent) => {
      const dx = (e.clientX - dragStart.mx) / imgScale;
      const dy = (e.clientY - dragStart.my) / imgScale;
      const sc = dragStart.crop;

      if (dragging === 'move') {
        let nx = sc.x + dx;
        let ny = sc.y + dy;
        nx = Math.max(0, Math.min(naturalSize.w - sc.w, nx));
        ny = Math.max(0, Math.min(naturalSize.h - sc.h, ny));
        setCrop({ ...sc, x: nx, y: ny });
        return;
      }

      let newX = sc.x;
      let newY = sc.y;
      let newW = sc.w;
      let newH = sc.h;

      // Left edge
      if (dragging === 'nw' || dragging === 'w' || dragging === 'sw') {
        newX = sc.x + dx;
        newW = sc.w - dx;
      }
      // Right edge
      if (dragging === 'ne' || dragging === 'e' || dragging === 'se') {
        newW = sc.w + dx;
      }
      // Top edge
      if (dragging === 'nw' || dragging === 'n' || dragging === 'ne') {
        newY = sc.y + dy;
        newH = sc.h - dy;
      }
      // Bottom edge
      if (dragging === 'sw' || dragging === 's' || dragging === 'se') {
        newH = sc.h + dy;
      }

      // Enforce minimum size
      if (newW < MIN_SIZE) {
        if (dragging === 'nw' || dragging === 'w' || dragging === 'sw') {
          newX = sc.x + sc.w - MIN_SIZE;
        }
        newW = MIN_SIZE;
      }
      if (newH < MIN_SIZE) {
        if (dragging === 'nw' || dragging === 'n' || dragging === 'ne') {
          newY = sc.y + sc.h - MIN_SIZE;
        }
        newH = MIN_SIZE;
      }

      // Clamp to image bounds
      if (newX < 0) { newW += newX; newX = 0; }
      if (newY < 0) { newH += newY; newY = 0; }
      if (newX + newW > naturalSize.w) { newW = naturalSize.w - newX; }
      if (newY + newH > naturalSize.h) { newH = naturalSize.h - newY; }

      if (newW >= MIN_SIZE && newH >= MIN_SIZE) {
        setCrop({ x: newX, y: newY, w: newW, h: newH });
      }
    };

    const handlePointerUp = () => setDragging(null);

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragging, dragStart, imgScale, naturalSize]);

  // Scroll to scale crop proportionally
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      if (!naturalSize) return;
      const factor = e.deltaY > 0 ? 1.05 : 0.95;
      const cx = crop.x + crop.w / 2;
      const cy = crop.y + crop.h / 2;
      let newW = crop.w * factor;
      let newH = crop.h * factor;
      newW = Math.max(MIN_SIZE, Math.min(naturalSize.w, newW));
      newH = Math.max(MIN_SIZE, Math.min(naturalSize.h, newH));
      let newX = cx - newW / 2;
      let newY = cy - newH / 2;
      newX = Math.max(0, Math.min(naturalSize.w - newW, newX));
      newY = Math.max(0, Math.min(naturalSize.h - newH, newY));
      setCrop({ x: newX, y: newY, w: newW, h: newH });
    },
    [crop, naturalSize],
  );

  // Keyboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm({ x: Math.round(crop.x), y: Math.round(crop.y), w: Math.round(crop.w), h: Math.round(crop.h) });
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel, onConfirm, crop]);

  if (!imageUrl || !naturalSize) {
    return (
      <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center">
        <span className="text-neutral-400 text-sm">Bild wird geladen…</span>
      </div>
    );
  }

  const cd = {
    x: crop.x * imgScale,
    y: crop.y * imgScale,
    w: crop.w * imgScale,
    h: crop.h * imgScale,
  };

  const cornerHandle = 'w-4 h-4 bg-white rounded-sm shadow-md';
  const edgeHandleH = 'h-3 bg-white rounded-sm shadow-md';
  const edgeHandleV = 'w-3 bg-white rounded-sm shadow-md';

  return (
    <div className="fixed inset-0 z-[100] bg-black/85 flex flex-col items-center justify-center select-none">
      <div
        className="relative overflow-hidden rounded-lg"
        style={{ width: displayW, height: displayH }}
        onWheel={handleWheel}
      >
        {/* Image */}
        <img src={imageUrl} alt="" style={{ width: displayW, height: displayH }} className="pointer-events-none block" draggable={false} />

        {/* Dark overlay outside crop */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bg-black/60" style={{ top: 0, left: 0, right: 0, height: cd.y }} />
          <div className="absolute bg-black/60" style={{ top: cd.y + cd.h, left: 0, right: 0, bottom: 0 }} />
          <div className="absolute bg-black/60" style={{ top: cd.y, left: 0, width: cd.x, height: cd.h }} />
          <div className="absolute bg-black/60" style={{ top: cd.y, left: cd.x + cd.w, right: 0, height: cd.h }} />
        </div>

        {/* Crop rectangle */}
        <div
          className="absolute border-2 border-white cursor-move"
          onPointerDown={(e) => handlePointerDown('move', e)}
          style={{ left: cd.x, top: cd.y, width: cd.w, height: cd.h, touchAction: 'none' }}
        >
          {/* Rule of thirds grid */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute border-l border-white/30" style={{ left: '33.33%', top: 0, bottom: 0 }} />
            <div className="absolute border-l border-white/30" style={{ left: '66.67%', top: 0, bottom: 0 }} />
            <div className="absolute border-t border-white/30" style={{ top: '33.33%', left: 0, right: 0 }} />
            <div className="absolute border-t border-white/30" style={{ top: '66.67%', left: 0, right: 0 }} />
          </div>
        </div>

        {/* Corner handles */}
        <div className={`absolute cursor-nw-resize ${cornerHandle}`} style={{ left: cd.x - 8, top: cd.y - 8, touchAction: 'none' }} onPointerDown={(e) => handlePointerDown('nw', e)} />
        <div className={`absolute cursor-ne-resize ${cornerHandle}`} style={{ left: cd.x + cd.w - 8, top: cd.y - 8, touchAction: 'none' }} onPointerDown={(e) => handlePointerDown('ne', e)} />
        <div className={`absolute cursor-sw-resize ${cornerHandle}`} style={{ left: cd.x - 8, top: cd.y + cd.h - 8, touchAction: 'none' }} onPointerDown={(e) => handlePointerDown('sw', e)} />
        <div className={`absolute cursor-se-resize ${cornerHandle}`} style={{ left: cd.x + cd.w - 8, top: cd.y + cd.h - 8, touchAction: 'none' }} onPointerDown={(e) => handlePointerDown('se', e)} />

        {/* Edge handles */}
        <div className={`absolute cursor-n-resize ${edgeHandleH}`} style={{ left: cd.x + cd.w / 2 - 16, top: cd.y - 6, width: 32, touchAction: 'none' }} onPointerDown={(e) => handlePointerDown('n', e)} />
        <div className={`absolute cursor-s-resize ${edgeHandleH}`} style={{ left: cd.x + cd.w / 2 - 16, top: cd.y + cd.h - 6, width: 32, touchAction: 'none' }} onPointerDown={(e) => handlePointerDown('s', e)} />
        <div className={`absolute cursor-w-resize ${edgeHandleV}`} style={{ left: cd.x - 6, top: cd.y + cd.h / 2 - 16, height: 32, touchAction: 'none' }} onPointerDown={(e) => handlePointerDown('w', e)} />
        <div className={`absolute cursor-e-resize ${edgeHandleV}`} style={{ left: cd.x + cd.w - 6, top: cd.y + cd.h / 2 - 16, height: 32, touchAction: 'none' }} onPointerDown={(e) => handlePointerDown('e', e)} />

        {/* Dimension display */}
        <div className="absolute pointer-events-none text-white/70 text-xs bg-black/50 px-1.5 py-0.5 rounded"
          style={{ left: cd.x + cd.w / 2 - 30, top: cd.y + cd.h + 8 }}>
          {Math.round(crop.w)} × {Math.round(crop.h)}
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-3 mt-5">
        <button
          onClick={() => onConfirm({ x: Math.round(crop.x), y: Math.round(crop.y), w: Math.round(crop.w), h: Math.round(crop.h) })}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg cursor-pointer select-none transition-colors"
        >
          Fertig
        </button>
        <button
          onClick={onCancel}
          className="px-5 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg cursor-pointer select-none transition-colors"
        >
          Abbrechen
        </button>
      </div>
    </div>
  );
}
