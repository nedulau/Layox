import type { Translator } from '../../i18n';

export default function SaveStatus({
  t,
  isDirty,
  isSaving,
  error,
}: {
  t: Translator;
  isDirty: boolean;
  isSaving: boolean;
  error: string | null;
}) {
  const state = error ? 'error' : isSaving ? 'saving' : isDirty ? 'unsaved' : 'saved';

  return (
    <span
      className="editor-save-status"
      data-state={state}
      title={error ?? undefined}
      role="status"
      aria-live="polite"
    >
      <span className="editor-save-status-dot" aria-hidden="true" />
      {error ? t('saveFailed') : isSaving ? t('saving') : isDirty ? t('unsaved') : t('saved')}
    </span>
  );
}
