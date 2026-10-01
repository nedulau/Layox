import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

const fixtureImage = path.resolve('public/icon-512.png');

async function createProject(page: Page, name = 'E2E Album') {
  await page.goto('/');
  await page.getByRole('button', { name: 'Neues Projekt' }).click();
  const dialog = page.getByRole('dialog', { name: 'Neues Projekt' });
  await dialog.getByRole('textbox').fill(name);
  await dialog.getByRole('button', { name: 'Erstellen' }).click();
  await expect(page.locator('.editor-ui')).toBeVisible();
}

async function selectLayout(page: Page, layoutName: RegExp) {
  await page.getByRole('button', { name: 'Layout', exact: true }).click();
  await page.getByRole('button', { name: /Deckblatt \(vollflächig\)/ }).click();
  await page.getByRole('button', { name: layoutName }).click();
}

async function openMenuItem(page: Page, menu: string, item: string) {
  await page.getByRole('button', { name: menu, exact: true }).click();
  const escapedItem = item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  await page.getByRole('button', { name: new RegExp(`^${escapedItem}(?:\\s|$)`) }).click();
}

async function insertFixtureImage(page: Page) {
  const chooserPromise = page.waitForEvent('filechooser');
  await openMenuItem(page, 'Einfügen', 'Bild einfügen');
  await (await chooserPromise).setFiles(fixtureImage);
}

async function openExportDialog(page: Page) {
  await openMenuItem(page, 'Datei', 'Exportieren');
  return page.getByRole('dialog', { name: 'Exportieren' });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Reflect.deleteProperty(window, 'showOpenFilePicker');
    Reflect.deleteProperty(window, 'showSaveFilePicker');
  });
});

test('production policy excludes development-only network destinations', async ({ page }) => {
  await page.goto('/');
  const policy = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(policy).toContain("connect-src 'self'");
  expect(policy).toContain("form-action 'none'");
  expect(policy).not.toContain('localhost');
  expect(policy).not.toContain('127.0.0.1');
});

test('creates, edits, crops, undoes and redoes an album', async ({ page }) => {
  await createProject(page);
  await selectLayout(page, /Raster \(4\)/);
  await insertFixtureImage(page);
  await insertFixtureImage(page);
  await expect(page.getByRole('button', { name: /icon-512\.png/ })).toHaveCount(2);
  await expect(page.locator('canvas')).toBeVisible();
  await page.locator('.konvajs-content').click({ position: { x: 120, y: 120 } });

  await openMenuItem(page, 'Bearbeiten', 'Beschneiden');
  const cropDialog = page.getByRole('dialog');
  await expect(cropDialog).toBeVisible();
  await cropDialog.getByRole('button', { name: 'Fertig' }).click();

  await openMenuItem(page, 'Einfügen', 'Text einfügen');
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+y');
  await expect(page.getByLabel('Rückgängig')).toBeEnabled();
});

test('downloads, reopens and exports a project without changing the editor page', async ({ page }) => {
  await createProject(page, 'Roundtrip Album');
  await selectLayout(page, /Einzelbild/);
  await insertFixtureImage(page);

  const projectDownloadPromise = page.waitForEvent('download');
  await openMenuItem(page, 'Datei', 'Speichern unter');
  const projectDownload = await projectDownloadPromise;
  expect(projectDownload.suggestedFilename()).toBe('Roundtrip Album.layox');
  const projectPath = await projectDownload.path();
  expect(projectPath).toBeTruthy();

  const pngDownloadPromise = page.waitForEvent('download');
  let exportDialog = await openExportDialog(page);
  await exportDialog.getByRole('combobox', { name: 'Format' }).selectOption('png');
  await exportDialog.getByRole('button', { name: 'Aktuelle Seite' }).click();
  await exportDialog.getByRole('button', { name: 'Export starten' }).click();
  expect((await pngDownloadPromise).suggestedFilename()).toMatch(/\.png$/);

  const pdfDownloadPromise = page.waitForEvent('download');
  exportDialog = await openExportDialog(page);
  await exportDialog.getByRole('combobox', { name: 'Format' }).selectOption('pdf');
  await exportDialog.getByRole('button', { name: 'Export starten' }).click();
  expect((await pdfDownloadPromise).suggestedFilename()).toMatch(/\.pdf$/);

  const zipDownloadPromise = page.waitForEvent('download');
  exportDialog = await openExportDialog(page);
  await exportDialog.getByRole('combobox', { name: 'Format' }).selectOption('png');
  await exportDialog.getByRole('button', { name: 'Alle Seiten' }).click();
  await exportDialog.getByRole('button', { name: 'Export starten' }).click();
  expect((await zipDownloadPromise).suggestedFilename()).toMatch(/\.zip$/);

  const openChooserPromise = page.waitForEvent('filechooser');
  await openMenuItem(page, 'Datei', 'Öffnen');
  await (await openChooserPromise).setFiles(projectPath!);
  await expect(page.getByTitle('Projektname bearbeiten')).toHaveValue('Roundtrip Album');
  await expect(page.getByRole('button', { name: /icon-512\.png/ })).toBeVisible();
});

test('is usable at tablet width without document overflow', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await createProject(page, 'Tablet');
  await expect(page.locator('.editor-topbar')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('centers the project name and automatically fits the canvas at every editor width', async ({ page }, testInfo) => {
  await createProject(page, 'A long album title that stays centered while editing');
  const title = page.getByRole('textbox', { name: 'Projektname bearbeiten' });
  const status = page.locator('.editor-save-status');
  const navigation = page.locator('.editor-page-navigation');
  const toolbar = page.locator('.editor-toolbar');
  await page.setViewportSize({ width: 1440, height: 1024 });
  await expect.poll(() => toolbar.evaluate((element) => element.getBoundingClientRect().height)).toBeLessThanOrEqual(44);
  const initialTitleBounds = (await title.boundingBox())!;
  const initialStatusBounds = (await status.boundingBox())!;
  const initialMenuBounds = (await page.getByRole('button', { name: 'Rückgängig' }).boundingBox())!;
  expect(Math.abs(initialTitleBounds.y + initialTitleBounds.height / 2 - initialMenuBounds.y - initialMenuBounds.height / 2)).toBeLessThan(1);
  expect(Math.abs(initialStatusBounds.y + initialStatusBounds.height / 2 - initialMenuBounds.y - initialMenuBounds.height / 2)).toBeLessThan(1);
  for (let count = 2; count < 9; count++) await navigation.getByTitle('Neue Seite').click();

  for (const width of [2048, 1440, 1280, 1024, 768]) {
    await page.setViewportSize({ width, height: 1024 });
    await expect.poll(async () => title.evaluate((input) => {
      const rect = input.getBoundingClientRect();
      return Math.abs(rect.left + rect.width / 2 - window.innerWidth / 2);
    })).toBeLessThan(1);
    const titleBounds = (await title.boundingBox())!;
    const statusBounds = (await status.boundingBox())!;
    expect(statusBounds.x).toBeGreaterThanOrEqual(titleBounds.x + titleBounds.width);
    expect(await toolbar.locator('button:visible').evaluateAll((buttons) => {
      const title = document.querySelector('.editor-project-name')!.getBoundingClientRect();
      return buttons.every((button) => {
        const rect = button.getBoundingClientRect();
        return rect.right <= title.left || rect.left >= title.right
          || rect.bottom <= title.top || rect.top >= title.bottom;
      });
    })).toBe(true);
    if (width === 2048) expect((await toolbar.boundingBox())!.height).toBeLessThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await navigation.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await expect.poll(() => page.locator('.konvajs-content').evaluate((canvas) => {
      const rect = canvas.getBoundingClientRect();
      const header = document.querySelector('.editor-topbar')!.getBoundingClientRect();
      return rect.left >= 0 && rect.right <= window.innerWidth + 1
        && rect.top >= header.bottom && rect.bottom <= window.innerHeight + 1;
    })).toBe(true);
    if (width === 1440 || width === 768) {
      await page.screenshot({ path: testInfo.outputPath(`header-${width}.png`) });
    }
  }

  const download = page.waitForEvent('download');
  await openMenuItem(page, 'Datei', 'Speichern unter');
  await download;
  await expect(status).toHaveText('Gespeichert');
  const savedTitleBounds = (await title.boundingBox())!;
  await title.fill('Renamed album');
  await expect(status).toHaveText('Ungespeichert');
  expect(await title.boundingBox()).toEqual(savedTitleBounds);
});

test('keeps image previews loaded and the library button fixed outside the scrolling strip', async ({ page }) => {
  await createProject(page, 'Image previews');
  const libraryButton = page.locator('.editor-asset-library-button');
  const emptyBounds = (await libraryButton.boundingBox())!;
  await libraryButton.click();
  let dialog = page.getByRole('dialog', { name: 'Asset-Bibliothek' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Schließen' }).click();

  const chooser = page.waitForEvent('filechooser');
  await openMenuItem(page, 'Einfügen', 'Bild einfügen');
  await (await chooser).setFiles(Array.from({ length: 12 }, () => fixtureImage));
  const strip = page.locator('.editor-asset-strip');
  await expect(strip.locator('img')).toHaveCount(12);
  await expect.poll(() => strip.locator('img').evaluateAll((images) =>
    images.every((image) => (image as HTMLImageElement).naturalWidth > 0),
  )).toBe(true);
  expect(await libraryButton.boundingBox()).toEqual(emptyBounds);

  const source = await strip.locator('img').first().getAttribute('src');
  await page.getByRole('textbox', { name: 'Projektname bearbeiten' }).fill('Changed title');
  await expect(strip.locator('img').first()).toHaveAttribute('src', source!);
  await page.setViewportSize({ width: 768, height: 1024 });
  const beforeScroll = await libraryButton.boundingBox();
  await strip.evaluate((element) => { element.scrollLeft = element.scrollWidth; });
  expect(await strip.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  expect(await libraryButton.boundingBox()).toEqual(beforeScroll);

  await libraryButton.click();
  dialog = page.getByRole('dialog', { name: 'Asset-Bibliothek' });
  await expect.poll(() => dialog.locator('img').evaluateAll((images) =>
    images.length === 12 && images.every((image) => (image as HTMLImageElement).naturalWidth > 0),
  )).toBe(true);
  await dialog.getByRole('button', { name: 'Schließen' }).click();
  await expect(strip.locator('img').first()).toHaveAttribute('src', source!);
});

test('keeps opening available on phones and restricts editing clearly', async ({ page }) => {
  await createProject(page, 'Phone');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('heading', { name: 'Bearbeitung benötigt ein größeres Display' })).toBeVisible();
  await page.getByRole('button', { name: 'Zur Startseite' }).click();
  await expect(page.getByRole('button', { name: 'Projekt öffnen' })).toBeVisible();
});

test('reloads from the service worker while offline after the first load', async ({ page, context }) => {
  await page.goto('/');
  await page.waitForFunction(async () => {
    if (!('serviceWorker' in navigator)) return false;
    await navigator.serviceWorker.ready;
    return navigator.serviceWorker.controller !== null;
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Layox' })).toBeVisible();
});

test('auto-saves a complete recovery point and restores it after reload', async ({ page }) => {
  await createProject(page, 'Recovery E2E');
  await insertFixtureImage(page);
  await expect(page.getByRole('button', { name: /icon-512\.png/ })).toBeVisible();

  await page.getByRole('button', { name: 'Schnelleinstellungen' }).click();
  await page.getByRole('checkbox', { name: 'Auto-Save aktivieren' }).check();
  await page.getByText('Intervall', { exact: true }).locator('..').getByRole('combobox').selectOption('10');
  await page.waitForTimeout(11_000);

  page.once('dialog', (dialog) => void dialog.accept());
  await page.reload();
  await page.getByRole('button', { name: /Recovery E2E/ }).click();
  await expect(page.getByTitle('Projektname bearbeiten')).toHaveValue('Recovery E2E');
  await expect(page.getByRole('button', { name: /icon-512\.png/ })).toBeVisible();
});

test('persists the page format and exports the selected pixel resolution', async ({ page }) => {
  await createProject(page, 'Print format');
  await page.getByRole('button', { name: 'Layout', exact: true }).click();
  await page.getByLabel('Seitenformat', { exact: false }).selectOption('square');
  await page.getByRole('button', { name: 'Layout', exact: true }).click();
  const content = page.locator('.konvajs-content');
  await expect(content).toHaveCSS('width', '1200px');
  await expect(content).toHaveCSS('height', '1200px');

  const saving = page.waitForEvent('download');
  await openMenuItem(page, 'Datei', 'Speichern unter');
  const projectPath = await (await saving).path();
  const chooser = page.waitForEvent('filechooser');
  await openMenuItem(page, 'Datei', 'Öffnen');
  await (await chooser).setFiles(projectPath!);
  await expect(content).toHaveCSS('height', '1200px');

  const exporting = page.waitForEvent('download');
  const dialog = await openExportDialog(page);
  await dialog.getByRole('combobox', { name: 'Format', exact: true }).selectOption('png');
  await dialog.getByLabel('Exportauflösung', { exact: false }).selectOption('150');
  await dialog.getByRole('button', { name: 'Aktuelle Seite' }).click();
  await dialog.getByRole('button', { name: 'Export starten' }).click();
  const outputPath = await (await exporting).path();
  const { readFile } = await import('node:fs/promises');
  const bytes = await readFile(outputPath!);
  // PNG IHDR records the actual raster size, independently of UI labels.
  expect(bytes.readUInt32BE(16)).toBe(1240);
  expect(bytes.readUInt32BE(20)).toBe(1240);
});
