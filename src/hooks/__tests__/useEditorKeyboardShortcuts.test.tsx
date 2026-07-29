import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRef } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEditorKeyboardShortcuts } from '../useEditorKeyboardShortcuts';

const storeMock = vi.hoisted(() => ({
  state: {
    undo: vi.fn(),
    redo: vi.fn(),
    saveCurrentProject: vi.fn(() => Promise.resolve({ status: 'cancelled' })),
    saveCurrentProjectAs: vi.fn(() => Promise.resolve({ status: 'cancelled' })),
    openProject: vi.fn(() => Promise.resolve()),
    snapshot: vi.fn(),
    addTextElement: vi.fn(),
    setSelectedElementId: vi.fn(),
    setSelectedSlotIndex: vi.fn(),
    removeImageFromSlot: vi.fn(),
    removeElement: vi.fn(),
    pruneUnusedAssets: vi.fn(),
    setCurrentPageIndex: vi.fn(),
    selectedSlotIndex: null as number | null,
    selectedElementId: null as string | null,
    currentPageIndex: 0,
    project: {
      pages: [
        {
          elements: [] as Array<{ id: string; type: string }>,
          slotAssignments: {} as Record<number, { assetPath: string }>,
        },
        {
          elements: [] as Array<{ id: string; type: string }>,
          slotAssignments: {} as Record<number, { assetPath: string }>,
        },
      ],
    },
  },
}));

vi.mock('../../store/useProjectStore', () => ({
  default: {
    getState: () => storeMock.state,
  },
}));

function ShortcutHarness({
  deleteUnusedAssetsAfterImageDelete = false,
  onNewProject = vi.fn(),
  onCloseMenu = vi.fn(),
  onSaveError = vi.fn(),
}: {
  deleteUnusedAssetsAfterImageDelete?: boolean;
  onNewProject?: () => void;
  onCloseMenu?: () => void;
  onSaveError?: (error: unknown) => void;
}) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  useEditorKeyboardShortcuts({
    imageInputRef,
    deleteUnusedAssetsAfterImageDelete,
    onNewProject,
    onCloseMenu,
    onSaveError,
  });
  return (
    <>
      <input ref={imageInputRef} aria-label="images" type="file" />
      <input aria-label="text field" />
      <div aria-label="rich text" contentEditable />
    </>
  );
}

describe('useEditorKeyboardShortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeMock.state.selectedSlotIndex = null;
    storeMock.state.selectedElementId = null;
    storeMock.state.currentPageIndex = 0;
    storeMock.state.project.pages = [
      { elements: [], slotAssignments: {} },
      { elements: [], slotAssignments: {} },
    ];
    storeMock.state.saveCurrentProject.mockResolvedValue({ status: 'cancelled' });
    storeMock.state.saveCurrentProjectAs.mockResolvedValue({ status: 'cancelled' });
  });

  it('routes save and save-as shortcuts to the matching store actions', () => {
    render(<ShortcutHarness />);

    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'S', ctrlKey: true, shiftKey: true });

    expect(storeMock.state.saveCurrentProject).toHaveBeenCalledOnce();
    expect(storeMock.state.saveCurrentProjectAs).toHaveBeenCalledOnce();
  });

  it('reports shortcut save failures', async () => {
    const onSaveError = vi.fn();
    const failure = new Error('disk full');
    storeMock.state.saveCurrentProject.mockRejectedValueOnce(failure);
    render(<ShortcutHarness onSaveError={onSaveError} />);

    fireEvent.keyDown(window, { key: 's', ctrlKey: true });

    await waitFor(() => expect(onSaveError).toHaveBeenCalledWith(failure));
  });

  it('does not modify the document while typing in plain or rich text fields', () => {
    render(<ShortcutHarness />);

    fireEvent.keyDown(screen.getByRole('textbox', { name: 'text field' }), {
      key: 't',
      ctrlKey: true,
    });
    fireEvent.keyDown(screen.getByLabelText('rich text'), { key: 'Delete' });

    expect(storeMock.state.addTextElement).not.toHaveBeenCalled();
    expect(storeMock.state.snapshot).not.toHaveBeenCalled();
  });

  it('adds text, opens the image picker and opens the new-project dialog', () => {
    const onNewProject = vi.fn();
    render(<ShortcutHarness onNewProject={onNewProject} />);
    const imageInput = screen.getByLabelText('images');
    const clickSpy = vi.spyOn(imageInput, 'click');

    fireEvent.keyDown(window, { key: 't', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'i', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'n', ctrlKey: true });

    expect(storeMock.state.snapshot).toHaveBeenCalledOnce();
    expect(storeMock.state.addTextElement).toHaveBeenCalledOnce();
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(onNewProject).toHaveBeenCalledOnce();
  });

  it('deletes the selected image and prunes unused assets when configured', () => {
    storeMock.state.selectedElementId = 'image-1';
    storeMock.state.project.pages[0] = {
      elements: [{ id: 'image-1', type: 'image' }],
      slotAssignments: {},
    };
    render(<ShortcutHarness deleteUnusedAssetsAfterImageDelete />);

    fireEvent.keyDown(window, { key: 'Delete' });

    expect(storeMock.state.snapshot).toHaveBeenCalledOnce();
    expect(storeMock.state.removeElement).toHaveBeenCalledWith('image-1');
    expect(storeMock.state.pruneUnusedAssets).toHaveBeenCalledOnce();
  });

  it('navigates pages and clears selection with Escape', () => {
    const onCloseMenu = vi.fn();
    render(<ShortcutHarness onCloseMenu={onCloseMenu} />);

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    storeMock.state.currentPageIndex = 1;
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(storeMock.state.setCurrentPageIndex).toHaveBeenNthCalledWith(1, 1);
    expect(storeMock.state.setCurrentPageIndex).toHaveBeenNthCalledWith(2, 0);
    expect(onCloseMenu).toHaveBeenCalledOnce();
    expect(storeMock.state.setSelectedElementId).toHaveBeenCalledWith(null);
    expect(storeMock.state.setSelectedSlotIndex).toHaveBeenCalledWith(null);
  });
});
