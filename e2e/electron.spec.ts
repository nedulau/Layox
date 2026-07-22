import { _electron as electron, expect, test } from '@playwright/test';
import { mkdtemp, readFile, readdir, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

async function fileSize(filePath: string): Promise<number> {
  try {
    return (await stat(filePath)).size;
  } catch {
    return 0;
  }
}

test('Electron saves in place, saves as and blocks external windows', async () => {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'layox-e2e-'));
  const firstPath = path.join(temporaryDirectory, 'first.layox');
  const secondPath = path.join(temporaryDirectory, 'second.layox');
  const electronEnvironment = { ...process.env, LAYOX_E2E: '1' };
  delete electronEnvironment.ELECTRON_RUN_AS_NODE;
  const electronApp = await electron.launch({
    args: ['./electron/main/index.mjs'],
    env: electronEnvironment,
  });

  try {
    const window = await electronApp.firstWindow();
    await window.getByRole('button', { name: 'Neues Projekt' }).click();
    const dialog = window.getByRole('dialog', { name: 'Neues Projekt' });
    await dialog.getByRole('textbox').fill('Electron Album');
    await dialog.getByRole('button', { name: 'Erstellen' }).click();
    expect(await window.evaluate(() => Boolean(window.electronBridge?.saveProject))).toBe(true);

    await electronApp.evaluate(({ dialog }, targetPath) => {
      const state = globalThis as typeof globalThis & { layoxSaveDialogs?: number };
      state.layoxSaveDialogs = 0;
      dialog.showSaveDialog = async () => {
        state.layoxSaveDialogs = (state.layoxSaveDialogs ?? 0) + 1;
        return { canceled: false, filePath: targetPath };
      };
    }, firstPath);

    await window.getByRole('button', { name: 'Datei', exact: true }).click();
    await window.getByRole('button', { name: 'Speichern Ctrl+S', exact: true }).click();
    await expect.poll(() => fileSize(firstPath)).toBeGreaterThan(0);
    await window.getByTitle('Projektname bearbeiten').fill('Electron Album changed');
    await window.keyboard.press('Control+s');
    await expect.poll(() => electronApp.evaluate(() => (
      globalThis as typeof globalThis & { layoxSaveDialogs?: number }
    ).layoxSaveDialogs)).toBe(1);

    await electronApp.evaluate(({ dialog }, targetPath) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: targetPath });
    }, secondPath);
    await window.keyboard.press('Control+Shift+s');
    await expect.poll(() => fileSize(secondPath)).toBeGreaterThan(0);

    await electronApp.evaluate(({ dialog }, sourcePath) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [sourcePath] });
    }, firstPath);
    await window.keyboard.press('Control+n');
    await window.getByRole('dialog', { name: 'Neues Projekt' }).getByRole('button', { name: 'Abbrechen' }).click();
    await window.keyboard.press('Control+o');
    await expect(window.getByTitle('Projektname bearbeiten')).toHaveValue('Electron Album changed');

    const originalUrl = window.url();
    expect(await window.evaluate(() => window.open('https://example.com'))).toBeNull();
    const externalNavigationWasBlocked = await electronApp.evaluate(({ BrowserWindow }) => {
      const mainWindow = BrowserWindow.getAllWindows()[0];
      let prevented = false;
      mainWindow.webContents.emit('will-navigate', {
        preventDefault: () => { prevented = true; },
      } as Electron.Event, 'https://example.com');
      return prevented;
    });
    expect(externalNavigationWasBlocked).toBe(true);
    expect(window.url()).toBe(originalUrl);
    expect((await readFile(firstPath)).subarray(0, 2).toString()).toBe('PK');

    const intactArchive = await readFile(firstPath);
    await electronApp.evaluate(() => {
      const state = globalThis as typeof globalThis & {
        __layoxE2E?: { failNextAtomicSave: boolean };
      };
      if (state.__layoxE2E) state.__layoxE2E.failNextAtomicSave = true;
    });
    await window.getByTitle('Projektname bearbeiten').fill('Must not be persisted');
    await window.keyboard.press('Control+s');
    await expect(window.getByRole('alert')).toContainText('simulated atomic failure');
    expect(await readFile(firstPath)).toEqual(intactArchive);
    expect((await readdir(temporaryDirectory)).some((name) => name.endsWith('.tmp'))).toBe(false);

  } finally {
    await electronApp.evaluate(({ app }) => app.exit(0)).catch(() => undefined);
  }
});
