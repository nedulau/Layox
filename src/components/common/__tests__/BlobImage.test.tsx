import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import BlobImage from '../BlobImage';

afterEach(() => vi.unstubAllGlobals());

describe('BlobImage', () => {
  it('keeps the displayed URL alive through StrictMode replay and releases replaced images', () => {
    const activeUrls = new Set<string>();
    let nextId = 0;
    const createObjectURL = vi.fn(() => {
      const url = `blob:image-${++nextId}`;
      activeUrls.add(url);
      return url;
    });
    const revokeObjectURL = vi.fn((url: string) => activeUrls.delete(url));
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    const firstBlob = new Blob(['first']);
    const { rerender, unmount } = render(
      <StrictMode><BlobImage blob={firstBlob} alt="Preview" /></StrictMode>,
    );
    const image = screen.getByRole('img', { name: 'Preview' });
    const firstUrl = image.getAttribute('src');
    expect(activeUrls).toEqual(new Set([firstUrl]));

    rerender(<StrictMode><BlobImage blob={firstBlob} alt="Preview" className="selected" /></StrictMode>);
    expect(image.getAttribute('src')).toBe(firstUrl);
    expect(activeUrls).toEqual(new Set([firstUrl]));

    rerender(<StrictMode><BlobImage blob={new Blob(['second'])} alt="Preview" /></StrictMode>);
    const secondUrl = image.getAttribute('src');
    expect(secondUrl).not.toBe(firstUrl);
    expect(activeUrls).toEqual(new Set([secondUrl]));

    unmount();
    expect(activeUrls.size).toBe(0);
    expect(revokeObjectURL).toHaveBeenCalledTimes(createObjectURL.mock.calls.length);
  });
});
