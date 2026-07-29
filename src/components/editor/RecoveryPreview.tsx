import { useEffect, useState } from 'react';
import type { RecoveredProject } from '../../utils/recoveryRepository';
import { recoveryRepository } from '../../utils/recoveryRepository';
import { DEFAULT_LAYOUT_GAP, DEFAULT_LAYOUT_PADDING } from '../../domain/projectDefaults';
import PageThumbnail from './PageThumbnail';

export default function RecoveryPreview({ snapshotId }: { snapshotId: string }) {
  const [recovered, setRecovered] = useState<RecoveredProject | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    void recoveryRepository.restore(snapshotId).then((result) => {
      if (active) setRecovered(result);
    }).catch(() => {
      if (active) setFailed(true);
    });
    return () => {
      active = false;
    };
  }, [snapshotId]);

  const page = recovered?.project.pages[recovered.pageIndex] ?? recovered?.project.pages[0];
  if (!recovered || !page) {
    return (
      <div className="flex aspect-[4/3] w-full items-center justify-center bg-neutral-950 text-xs text-neutral-500">
        {failed ? '!' : '…'}
      </div>
    );
  }

  return (
    <PageThumbnail
      page={page}
      assetBlobs={recovered.assetBlobs}
      defaultLayoutPadding={recovered.project.meta.defaultLayoutPadding ?? DEFAULT_LAYOUT_PADDING}
      defaultLayoutGap={recovered.project.meta.defaultLayoutGap ?? DEFAULT_LAYOUT_GAP}
      className="aspect-[4/3] w-full"
    />
  );
}
