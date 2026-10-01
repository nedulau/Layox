import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { PageFormat } from '../../domain/pageFormat';
import type { Page } from '../../types';
import { konvaPageRenderer } from '../../utils/konvaPageRenderer';
import BlobImage from '../common/BlobImage';

export default function PageThumbnail({
  page,
  assetBlobs,
  defaultLayoutPadding,
  defaultLayoutGap,
  className = '',
  pageFormat,
  style,
}: {
  page: Page;
  assetBlobs: Record<string, Blob>;
  defaultLayoutPadding: number;
  defaultLayoutGap: number;
  className?: string;
  pageFormat?: PageFormat;
  style?: CSSProperties;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [thumbnail, setThumbnail] = useState<Blob | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '240px' },
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    void konvaPageRenderer.renderPage(page, assetBlobs, {
      pageFormat,
      mimeType: 'image/jpeg',
      quality: 0.74,
      pixelRatio: 0.24,
      defaultLayoutPadding,
      defaultLayoutGap,
      signal: controller.signal,
    }).then((blob) => {
      if (!controller.signal.aborted) {
        setFailed(false);
        setThumbnail(blob);
      }
    }).catch(() => {
      if (!controller.signal.aborted) setFailed(true);
    });
    return () => controller.abort();
  }, [assetBlobs, defaultLayoutGap, defaultLayoutPadding, page, pageFormat, visible]);

  return (
    <div style={style} ref={rootRef} className={`relative overflow-hidden bg-neutral-950 ${className}`}>
      {thumbnail ? (
        <BlobImage blob={thumbnail} alt="" draggable={false} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[10px] text-neutral-500">
          {failed ? '!' : '…'}
        </div>
      )}
    </div>
  );
}
