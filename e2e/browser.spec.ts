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

async function selectSingleLayout(page: Page) {
  await page.getByRole('button', { name: 'Layout', exact: true }).click();
  await page.getByRole('button', { name: /Cover \(Full\)/ }).click();
  await page.getByRole('button', { name: /Single/ }).click();
}

async function openMenuItem(page: Page, menu: string, item: string) {
  await page.getByRole('button', { name: menu, exact: true }).click();
  await page.getByRole('button', { name: item }).click();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Reflect.deleteProperty(window, 'showOpenFilePicker');
    Reflect.deleteProperty(window, 'showSaveFilePicker');
  });
});

test('creates, edits, crops, undoes and redoes an album', async ({ page }) => {
  await createProject(page);
  await selectSingleLayout(page);

  const chooserPromise = page.waitForEvent('filechooser');
  await openMenuItem(page, 'Einfügen', 'Bild einfügen');
  await (await chooserPromise).setFiles(fixtureImage);
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
  await selectSingleLayout(page);

  const projectDownloadPromise = page.waitForEvent('download');
  await openMenuItem(page, 'Datei', 'Speichern unter');
  const projectDownload = await projectDownloadPromise;
  expect(projectDownload.suggestedFilename()).toBe('Roundtrip Album.layox');
  const projectPath = await projectDownload.path();
  expect(projectPath).toBeTruthy();

  const pngDownloadPromise = page.waitForEvent('download');
  await openMenuItem(page, 'Datei', 'Seite als PNG');
  expect((await pngDownloadPromise).suggestedFilename()).toMatch(/\.png$/);

  const pdfDownloadPromise = page.waitForEvent('download');
  await openMenuItem(page, 'Datei', 'Exportieren als PDF');
  await page.getByRole('dialog', { name: 'PDF-Kompression' }).getByRole('button', { name: /Mittel/ }).click();
  expect((await pdfDownloadPromise).suggestedFilename()).toMatch(/\.pdf$/);

  const openChooserPromise = page.waitForEvent('filechooser');
  await openMenuItem(page, 'Datei', 'Öffnen');
  await (await openChooserPromise).setFiles(projectPath!);
  await expect(page.getByTitle('Projektname bearbeiten')).toHaveValue('Roundtrip Album');
});

test('is usable at tablet width without document overflow', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await createProject(page, 'Tablet');
  await expect(page.locator('.editor-topbar')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
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
