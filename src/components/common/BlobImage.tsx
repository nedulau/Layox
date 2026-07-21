import { useEffect, useMemo } from 'react';

export default function BlobImage({
  blob,
  ...props
}: { blob: Blob } & Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'>) {
  const url = useMemo(() => URL.createObjectURL(blob), [blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return <img {...props} src={url} />;
}
