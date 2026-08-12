import { test, expect, type Page, type Browser } from '@playwright/test';

const PLAYGROUND = '/playground/renderer/';

const INVALID_JSON = '{bad json}}}';

const VALIDATOR_INVALID_JSON = JSON.stringify({
  frames: [
    {
      id: 'f1',
      actions: [
        { player: 'ghost_1', type: 'pass', to_player: 'ghost_2' },
      ],
    },
  ],
});

async function goToPlayground(page: Page) {
  await page.goto(PLAYGROUND, { waitUntil: 'networkidle' });
  await expect(page.locator('#rp-editor')).toBeVisible();
}

async function validate(page: Page) {
  await page.locator('#rp-validate-btn').click();
  await expect(page.locator('#rp-validation-output')).not.toHaveText('Click Validate to check the document.', { timeout: 30_000 });
}

async function validateAndRender(page: Page) {
  await validate(page);
  const renderBtn = page.locator('#rp-render-btn');
  await expect(renderBtn).toBeEnabled({ timeout: 15_000 });
  await renderBtn.click();
  await expect(page.locator('#rp-frame-nav')).toBeVisible({ timeout: 15_000 });
}

test.describe('renderer playground', () => {
  test('shows experimental notice and seeded example', async ({ page }) => {
    await goToPlayground(page);
    await expect(page.locator('.notice')).toContainText(/Experimental/);
    await expect(page.locator('.notice')).toContainText(/not final/);
    const editorValue = await page.locator('#rp-editor').inputValue();
    expect(editorValue).toContain('quick-mode');
    expect(editorValue).toContain('frames');
  });

  test('valid example validates, renders, and navigates frames', async ({ page }) => {
    await goToPlayground(page);
    await validate(page);
    await expect(page.locator('#rp-validation-output')).toContainText(/ok|warn/);

    const renderBtn = page.locator('#rp-render-btn');
    await expect(renderBtn).toBeEnabled({ timeout: 15_000 });
    await renderBtn.click();

    await expect(page.locator('#rp-frame-nav')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#rp-frame-info')).toHaveText('frame 1 / 2');

    const canvas = page.locator('#rp-canvas');
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);

    await page.locator('#rp-next-btn').click();
    await expect(page.locator('#rp-frame-info')).toHaveText('frame 2 / 2');

    await page.locator('#rp-prev-btn').click();
    await expect(page.locator('#rp-frame-info')).toHaveText('frame 1 / 2');
  });

  test('invalid JSON shows parse error and keeps Render disabled', async ({ page }) => {
    await goToPlayground(page);
    await page.locator('#rp-editor').fill(INVALID_JSON);
    await page.locator('#rp-validate-btn').click();
    await expect(page.locator('#rp-validation-output')).not.toHaveText('Click Validate to check the document.', { timeout: 5_000 });
    await expect(page.locator('#rp-validation-output')).toContainText('error');
    await expect(page.locator('#rp-validation-output')).toContainText(/JSON/);
    await expect(page.locator('#rp-render-btn')).toBeDisabled();
  });

  test('validator-invalid document shows errors and does not render', async ({ page }) => {
    await goToPlayground(page);
    await page.locator('#rp-editor').fill(VALIDATOR_INVALID_JSON);
    await validate(page);
    await expect(page.locator('#rp-validation-output')).toContainText(/fail|error/);
    await expect(page.locator('#rp-render-btn')).toBeDisabled();
    await expect(page.locator('#rp-frame-nav')).toBeHidden();
  });

  test('desktop layout has editor and preview in separate columns', async ({ page }) => {
    test.skip(test.info().project.name !== 'chromium-desktop');
    await goToPlayground(page);
    const editorPane = page.locator('.editor-pane');
    const previewPane = page.locator('.preview-pane');
    await expect(editorPane).toBeVisible();
    await expect(previewPane).toBeVisible();
    const editorBox = await editorPane.boundingBox();
    const previewBox = await previewPane.boundingBox();
    expect(editorBox).not.toBeNull();
    expect(previewBox).not.toBeNull();
    expect(editorBox!.x).toBeLessThan(previewBox!.x);
  });

  test('mobile viewport has no horizontal overflow and controls are reachable', async ({ page }) => {
    test.skip(test.info().project.name !== 'chromium-mobile');
    await goToPlayground(page);
    const viewportWidth = page.viewportSize()!.width;
    const bodyWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);

    await expect(page.locator('#rp-validate-btn')).toBeVisible();
    await expect(page.locator('#rp-render-btn')).toBeVisible();
    await expect(page.locator('#rp-reset-btn')).toBeVisible();
    await expect(page.locator('#rp-feedback-btn')).toBeVisible();
    await expect(page.locator('#rp-editor')).toBeVisible();
  });

  test('feedback dialog shows Markdown bundle with clipboard unchecked', async ({ page }) => {
    await goToPlayground(page);
    await page.locator('#rp-feedback-btn').click();
    const dialog = page.locator('#rp-feedback-dialog');
    await expect(dialog).toBeVisible();

    const preview = page.locator('#rp-feedback-preview');
    const text = await preview.textContent();
    expect(text).toContain('OCF Renderer Playground Feedback');
    expect(text).toContain('```json');
    expect(text).toContain('**Frame:**');
    expect(text).toContain('**Renderer:**');
    expect(text).toContain('**Validator:**');

    const checkbox = page.locator('#rp-feedback-copy');
    await expect(checkbox).not.toBeChecked();

    await expect(page.locator('#rp-feedback-copy-open-btn')).toBeDisabled();
  });

  test('no-copy action navigates to Discussions fallback', async ({ page }) => {
    // Stub window.open before page scripts run so headless Chromium does not
    // attempt to navigate to an external GitHub URL. The stub records the
    // requested URL for assertion without opening a real popup.
    await page.addInitScript(() => {
      (window as any).__openedUrls = [];
      window.open = (url?: string | URL) => {
        (window as any).__openedUrls.push(String(url));
        return null;
      };
    });
    await goToPlayground(page);
    await page.locator('#rp-feedback-btn').click();
    await expect(page.locator('#rp-feedback-dialog')).toBeVisible();

    await page.locator('#rp-feedback-open-btn').click();

    const openedUrls = await page.evaluate(() => (window as any).__openedUrls as string[]);
    expect(openedUrls.length).toBeGreaterThan(0);
    const url = openedUrls[openedUrls.length - 1];
    expect(url).toContain('github.com');
    expect(url).toContain('discussions');
  });

  test('clipboard copy occurs only after opt-in and explicit action', async ({ browser }) => {
    const context = await browser.newContext({
      permissions: ['clipboard-read', 'clipboard-write'],
    });
    const page = await context.newPage();
    // Stub window.open so headless Chromium does not attempt external navigation.
    await page.addInitScript(() => {
      (window as any).__openedUrls = [];
      window.open = (url?: string | URL) => {
        (window as any).__openedUrls.push(String(url));
        return null;
      };
    });
    await page.goto(PLAYGROUND, { waitUntil: 'networkidle' });
    await expect(page.locator('#rp-editor')).toBeVisible();

    await page.locator('#rp-feedback-btn').click();
    await expect(page.locator('#rp-feedback-dialog')).toBeVisible();

    await expect(page.locator('#rp-feedback-copy-open-btn')).toBeDisabled();

    await page.locator('#rp-feedback-copy').check();
    await expect(page.locator('#rp-feedback-copy-open-btn')).toBeEnabled();

    await page.locator('#rp-feedback-copy-open-btn').click();

    const openedUrls = await page.evaluate(() => (window as any).__openedUrls as string[]);
    expect(openedUrls.length).toBeGreaterThan(0);
    expect(openedUrls[openedUrls.length - 1]).toContain('github.com');

    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toContain('OCF Renderer Playground Feedback');
    expect(clipboardText).toContain('```json');

    await context.close();
  });

  test('clipboard denial leaves manual-copy content visible', async ({ browser }) => {
    const context = await browser.newContext({
      permissions: [],
    });
    const page = await context.newPage();
    await page.goto(PLAYGROUND, { waitUntil: 'networkidle' });
    await expect(page.locator('#rp-editor')).toBeVisible();

    await page.locator('#rp-feedback-btn').click();
    await expect(page.locator('#rp-feedback-dialog')).toBeVisible();

    await page.locator('#rp-feedback-copy').check();

    await page.locator('#rp-feedback-copy-open-btn').click();

    await expect(page.locator('#rp-feedback-clipboard-error')).toBeVisible({ timeout: 5_000 });

    const preview = page.locator('#rp-feedback-preview');
    await expect(preview).toBeVisible();
    const text = await preview.textContent();
    expect(text).toContain('OCF Renderer Playground Feedback');

    await context.close();
  });

  test('PNG download is offered after rendering', async ({ page }) => {
    await goToPlayground(page);
    await validateAndRender(page);

    await expect(page.locator('#rp-export-row')).toBeVisible();
    const downloadBtn = page.locator('#rp-download-btn');
    await expect(downloadBtn).toBeVisible();
    await expect(downloadBtn).toContainText('Download PNG');

    const hasDataUrl = await page.evaluate(() => {
      const c = document.getElementById('rp-canvas') as HTMLCanvasElement;
      const dataUrl = c.toDataURL('image/png');
      return dataUrl.startsWith('data:image/png') && dataUrl.length > 100;
    });
    expect(hasDataUrl).toBe(true);
  });
});
