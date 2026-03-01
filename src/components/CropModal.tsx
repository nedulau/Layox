import { useState, useEffect, useCallback } from 'react';

interface CropModalProps {
  imageBlob: Blob;
  aspectRatio: number; // slot width / height
  initialCrop?: { x: number; y: number; w: number; h: number };
  onConfirm: (crop: { x: number; y: number; w: number; h: number }) => void;
  onCancel: () => void;
}

export default function CropModal({
  imageBlob,
  aspectRatio,
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

  // Crop state (in natural image pixels)
  const [crop, setCrop] = useState(() => {
    if (initialCrop) return initialCrop;
    if (!naturalSize) return { x: 0, y: 0, w: 100, h: 100 / aspectRatio };
    let w: number, h: number;
    if (naturalSize.w / naturalSize.h > aspectRatio) {
      h = naturalSize.h;
      w = h * aspectRatio;
    } else {
      w = naturalSize.w;
      h = w / aspectRatio;
    }
    return { x: (naturalSize.w - w) / 2, y: (naturalSize.h - h) / 2, w, h };
  });

  // Re-init crop when image loads
  useEffect(() => {
    if (!naturalSize) return;
    if (initialCrop) {
      setCrop(initialCrop);
      return;
    }
    let w: number, h: number;
    if (naturalSize.w / naturalSize.h > aspectRatio) {
      h = naturalSize.h;
      w = h * aspectRatio;
    } else {
      w = naturalSize.w;
      h = w / aspectRatio;
    }
    setCrop({ x: (naturalSize.w - w) / 2, y: (naturalSize.h - h) / 2, w, h });
  }, [naturalSize, aspectRatio, initialCrop]);

  // Interaction state
  const [dragging, setDragging] = useState<'move' | 'nw' | 'ne' | 'sw' | 'se' | null>(null);
  const [dragStart, setDragStart] = useState({ mx: 0, my: 0, crop: { x: 0, y: 0, w: 0, h: 0 } });

  const handleMouseDown = (type: 'move' | 'nw' | 'ne' | 'sw' | 'se', e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(type);
    setDragStart({ mx: e.clientX, my: e.clientY, crop: { ...crop } });
  };

  useEffect(() => {
    if (!dragging || !naturalSize) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = (e.clientX - dragStart.mx) / imgScale;
      const dy = (e.clientY - dragStart.my) / imgScale;
      const sc = dragStart.crop;

      if (dragging === 'move') {
        let nx = sc.x + dx;
        let ny = sc.y + dy;
        nx = Math.max(0, Math.min(naturalSize.w - sc.w, nx));
        ny = Math.max(0, Math.min(naturalSize.h - sc.h, ny));
        setCrop({ ...sc, x: nx, y: ny });
      } else {
        let newW: number, newH: number, newX: number, newY: number;
        if (dragging === 'se') {
          newW = Math.max(40, sc.w + dx);
          newH = newW / aspectRatio;
          newX = sc.x;
          newY = sc.y;
        } else if (dragging === 'sw') {
          newW = Math.max(40, sc.w - dx);
          newH = newW / aspectRatio;
          newX = sc.x + sc.w - newW;
          newY = sc.y;
        } else if (dragging === 'ne') {
          newW = Math.max(40, sc.w + dx);
          newH = newW / aspectRatio;
          newX = sc.x;
          newY = sc.y + sc.h - newH;
        } else {
          // nw
          newW = Math.max(40, sc.w - dx);
          newH = newW / aspectRatio;
          newX = sc.x + sc.w - newW;
          newY = sc.y + sc.h - newH;
        }
        // Clamp to image bounds
        if (newX < 0) { newX = 0; newW = sc.x + sc.w; newH = newW / aspectRatio; }
        if (newY < 0) { newY = 0; }
        if (newX + newW > naturalSize.w) { newW = naturalSize.w - newX; newH = newW / aspectRatio; }
        if (newY + newH > naturalSize.h) { newH = naturalSize.h - newY; newW = newH * aspectRatio; }
        if (newW > 20 && newH > 20) {
          setCrop({ x: newX, y: newY, w: newW, h: newH });
        }
      }
    };

    const handleMouseUp = () => setDragging(null);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, dragStart, aspectRatio, imgScale, naturalSize]);

  // Scroll to scale crop
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      if (!naturalSize) return;
      const factor = e.deltaY > 0 ? 1.05 : 0.95;
      const cx = crop.x + crop.w / 2;
      const cy = crop.y + crop.h / 2;
      let newW = crop.w * factor;
      let newH = newW / aspectRatio;
      newW = Math.max(40, Math.min(naturalSize.w, newW));
      newH = Math.max(40 / aspectRatio, Math.min(naturalSize.h, newH));
      // Re-enforce aspect ratio after clamp
      if (newW / newH > aspectRatio * 1.01) { newW = newH * aspectRatio; }
      if (newH * aspectRatio > newW * 1.01) { newH = newW / aspectRatio; }
      let newX = cx - newW / 2;
      let newY = cy - newH / 2;
      newX = Math.max(0, Math.min(naturalSize.w - newW, newX));
      newY = Math.max(0, Math.min(naturalSize.h - newH, newY));
      setCrop({ x: newX, y: newY, w: newW, h: newH });
    },
    [crop, aspectRatio, naturalSize],
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

  const handleStyle = 'w-4 h-4 bg-white rounded-sm shadow-md';

  return (
    <div className="fixed inset-0 z-[100] bg-black/85 flex flex-col items-center justify-center select-none">
      <div
        className="relative overflow-hidden rounded-lg"
        style={{ width: displayW, height: displayH }}
        onWheel={handleWheel}
      >
        {/* Image */}
        <img
          src={imageUrl}
          alt=""
          style={{ width: displayW, height: displayH }}
          className="pointer-events-none block"
          draggable={false}
        />

        {/* Dark overlay outside crop */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bg-black/60" style={{ top: 0, left: 0, right: 0, height: cd.y }} />
          <div
            className="absolute bg-black/60"
            style={{ top: cd.y + cd.h, left: 0, right: 0, bottom: 0 }}
          />
          <div
            className="absolute bg-black/60"
            style={{ top: cd.y, left: 0, width: cd.x, height: cd.h }}
          />
          <div
            className="absolute bg-black/60"
            style={{
              top: cd.y,
              left: cd.x + cd.w,
              right: 0,
              height: cd.h,
            }}
          />
        </div>

        {/* Crop rectangle */}
        <div
          className="absolute border-2 border-white cursor-move"
          style={{ left: cd.x, top: cd.y, width: cd.w, height: cd.h }}
          onMouseDown={(e) => handleMouseDown('move', e)}
        >
          {/* Rule of thirds grid */}
          <div className="absolute inset-0 pointer-events-none">
            <div
              className="absolute border-l border-white/30"
              style={{ left: '33.33%', top: 0, bottom: 0 }}
            />
            <div
              className="absolute border-l border-white/30"
              style={{ left: '66.67%', top: 0, bottom: 0 }}
            />
            <div
              className="absolute border-t border-white/30"
              style={{ top: '33.33%', left: 0, right: 0 }}
            />
            <div
              className="absolute border-t border-white/30"
              style={{ top: '66.67%', left: 0, right: 0 }}
            />
          </div>
        </div>

        {/* Corner handles */}
        <div
          className={`absolute cursor-nw-resize ${handleStyle}`}
          style={{ left: cd.x - 8, top: cd.y - 8 }}
          onMouseDown={(e) => handleMouseDown('nw', e)}
        />
        <div
          className={`absolute cursor-ne-resize ${handleStyle}`}
          style={{ left: cd.x + cd.w - 8, top: cd.y - 8 }}
          onMouseDown={(e) => handleMouseDown('ne', e)}
        />
        <div
          className={`absolute cursor-sw-resize ${handleStyle}`}
          style={{ left: cd.x - 8, top: cd.y + cd.h - 8 }}
          onMouseDown={(e) => handleMouseDown('sw', e)}
        />
        <div
          className={`absolute cursor-se-resize ${handleStyle}`}
          style={{ left: cd.x + cd.w - 8, top: cd.y + cd.h - 8 }}
          onMouseDown={(e) => handleMouseDown('se', e)}
        />
      </div>

      {/* Buttons */}
      <div className="flex gap-3 mt-5">
        <button
          onClick={() =>
            onConfirm({
              x: Math.round(crop.x),
              y: Math.round(crop.y),
              w: Math.round(crop.w),
              h: Math.round(crop.h),
            })
          }
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
