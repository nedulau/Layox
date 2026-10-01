import { useEffect, useState } from 'react';
import { analyzeExportPreflight, type ExportPreflight, type ProjectExportContext } from '../utils/exportProject';

/** Never expose a previous range/resolution result while its replacement is pending. */
export function useExportPreflight(context: ProjectExportContext, indices: number[], dpi: number) {
  const [completed, setCompleted] = useState<{
    context: ProjectExportContext; indices: number[]; dpi: number; result?: ExportPreflight; error?: string;
  } | null>(null);
  useEffect(() => {
    if (indices.length === 0) return;
    const controller = new AbortController();
    void analyzeExportPreflight(context, indices, dpi, controller.signal).then((result) => {
      if (!controller.signal.aborted) setCompleted({ context, indices, dpi, result });
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setCompleted({ context, indices, dpi, error: error instanceof Error ? error.message : String(error) });
    });
    return () => controller.abort();
  }, [context, indices, dpi]);
  const current = completed?.context === context && completed.indices === indices && completed.dpi === dpi ? completed : null;
  return { preflight: current?.result ?? null, error: current?.error ?? null };
}
