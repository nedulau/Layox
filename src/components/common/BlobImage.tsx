import { useEffect, useRef } from 'react';

export default function BlobImage({
  blob,
  ...props
}: { blob: Blob } & Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'>) {
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const url = URL.createObjectURL(blob);
    if (imageRef.current) imageRef.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  return <img {...props} ref={imageRef} />;
}
