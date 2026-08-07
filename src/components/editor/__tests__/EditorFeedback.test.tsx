import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Translator } from '../../../i18n'
import EditorFeedback from '../EditorFeedback'

const translations: Record<string, string> = {
  exportProgress: 'Export {format}',
  cancel: 'Abbrechen',
  close: 'Schließen',
  undo: 'Rückgängig',
}
const t = ((key: string) => translations[key] ?? key) as Translator

describe('EditorFeedback', () => {
  it('shows export progress and allows cancellation', () => {
    const onCancelExport = vi.fn()

    render(
      <EditorFeedback
        t={t}
        exportJob={{ label: 'PDF', completed: 1, total: 2 }}
        exportError={null}
        uiError={null}
        uiNotice={null}
        importJob={null}
        noticeCanUndo={false}
        onCancelExport={onCancelExport}
        onClearExportError={vi.fn()}
        onClearUiError={vi.fn()}
        onClearNotice={vi.fn()}
        onUndoNotice={vi.fn()}
      />,
    )

    expect(screen.getByRole('dialog')).toHaveTextContent('PDF')
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
    expect(onCancelExport).toHaveBeenCalledOnce()
  })

  it('renders dismissible errors and undoable notices', () => {
    const onCloseExportError = vi.fn()
    const onCloseUiNotice = vi.fn()
    const onUndoNotice = vi.fn()
    const { rerender } = render(
      <EditorFeedback
        t={t}
        exportJob={null}
        exportError="Export fehlgeschlagen"
        uiError={null}
        uiNotice={null}
        importJob={null}
        noticeCanUndo={false}
        onCancelExport={vi.fn()}
        onClearExportError={onCloseExportError}
        onClearUiError={vi.fn()}
        onClearNotice={onCloseUiNotice}
        onUndoNotice={onUndoNotice}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Export fehlgeschlagen')
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }))
    expect(onCloseExportError).toHaveBeenCalledOnce()

    rerender(
      <EditorFeedback
        t={t}
        exportJob={null}
        exportError={null}
        uiError={null}
        uiNotice="Seite entfernt"
        importJob={null}
        noticeCanUndo
        onCancelExport={vi.fn()}
        onClearExportError={onCloseExportError}
        onClearUiError={vi.fn()}
        onClearNotice={onCloseUiNotice}
        onUndoNotice={onUndoNotice}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent('Seite entfernt')
    fireEvent.click(screen.getByRole('button', { name: 'Rückgängig' }))
    expect(onUndoNotice).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }))
    expect(onCloseUiNotice).toHaveBeenCalledOnce()
  })
})
