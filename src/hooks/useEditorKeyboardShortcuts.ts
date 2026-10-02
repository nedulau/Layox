import { useEffect, type RefObject } from 'react';
import useProjectStore from '../store/useProjectStore';

interface EditorKeyboardShortcutOptions {
  imageInputRef: RefObject<HTMLInputElement | null>;
  deleteUnusedAssetsAfterImageDelete: boolean;
  onNewProject: () => void;
  onOpenProject: () => void;
  onCloseMenu: () => void;
  onSaveError: (error: unknown) => void;
}

function isTextEntryTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement
    && (
      target.tagName === 'INPUT'
      || target.tagName === 'TEXTAREA'
      || target.isContentEditable
      || target.closest('[contenteditable]:not([contenteditable="false"])') !== null
    );
}

/** Registers the editor's global keyboard shortcuts. */
export function useEditorKeyboardShortcuts({
  imageInputRef,
  deleteUnusedAssetsAfterImageDelete,
  onNewProject,
  onOpenProject,
  onCloseMenu,
  onSaveError,
}: EditorKeyboardShortcutOptions): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (document.querySelector('[role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"]')) return;
      const isTextEntry = isTextEntryTarget(event.target);
      const key = event.key.toLowerCase();
      const hasCommandModifier = event.ctrlKey || event.metaKey;

      if (hasCommandModifier && key === 'z' && !event.shiftKey) {
        event.preventDefault();
        useProjectStore.getState().undo();
        return;
      }

      if (hasCommandModifier && (key === 'y' || (key === 'z' && event.shiftKey))) {
        event.preventDefault();
        useProjectStore.getState().redo();
        return;
      }

      if (hasCommandModifier && key === 's') {
        event.preventDefault();
        const state = useProjectStore.getState();
        const save = event.shiftKey ? state.saveCurrentProjectAs : state.saveCurrentProject;
        void save().catch(onSaveError);
        return;
      }

      if (hasCommandModifier && key === 'o') {
        event.preventDefault();
        onOpenProject();
        return;
      }

      if (hasCommandModifier && key === 'n') {
        event.preventDefault();
        onNewProject();
        return;
      }

      if (hasCommandModifier && key === 't') {
        if (!isTextEntry) {
          event.preventDefault();
          const state = useProjectStore.getState();
          state.snapshot();
          state.addTextElement();
        }
        return;
      }

      if (hasCommandModifier && key === 'i') {
        event.preventDefault();
        imageInputRef.current?.click();
        return;
      }

      if (event.key === 'Escape') {
        onCloseMenu();
        const state = useProjectStore.getState();
        state.setSelectedElementId(null);
        state.setSelectedSlotIndex(null);
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (isTextEntry) return;
        event.preventDefault();
        const state = useProjectStore.getState();
        state.snapshot();
        if (
          state.selectedSlotIndex !== null
          && state.project.pages[state.currentPageIndex]?.slotAssignments?.[state.selectedSlotIndex]
        ) {
          state.removeImageFromSlot(state.selectedSlotIndex);
          if (deleteUnusedAssetsAfterImageDelete) state.pruneUnusedAssets();
        } else if (state.selectedElementId) {
          const selectedElement = state.project.pages[state.currentPageIndex]?.elements.find(
            (element) => element.id === state.selectedElementId,
          );
          state.removeElement(state.selectedElementId);
          if (deleteUnusedAssetsAfterImageDelete && selectedElement?.type === 'image') {
            state.pruneUnusedAssets();
          }
        }
        return;
      }

      if (isTextEntry) return;
      const state = useProjectStore.getState();
      if (event.key === 'ArrowLeft' && state.currentPageIndex > 0) {
        state.setCurrentPageIndex(state.currentPageIndex - 1);
      } else if (
        event.key === 'ArrowRight'
        && state.currentPageIndex < state.project.pages.length - 1
      ) {
        state.setCurrentPageIndex(state.currentPageIndex + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    deleteUnusedAssetsAfterImageDelete,
    imageInputRef,
    onCloseMenu,
    onNewProject,
    onOpenProject,
    onSaveError,
  ]);
}
