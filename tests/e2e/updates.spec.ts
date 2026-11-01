import { test, expect } from '@playwright/test';
import { historyFixture, openFixture } from './fixtures';

test('表示範囲は標準メニューや二重枠を使わず、開閉しても位置が変わらない', async ({
  page,
}) => {
  await openFixture(page, await historyFixture(0));
  await page.getByRole('button', { name: '注文履歴', exact: true }).click();
  const control = page.getByRole('combobox', { name: '表示する日' });
  await expect(page.locator('select')).toHaveCount(0);
  const before = await control.boundingBox();
  await control.click();
  await expect(page.getByRole('listbox', { name: '表示する日' })).toBeVisible();
  await expect(control).toHaveCSS('outline-style', 'none');
  await expect(control).toHaveCSS('box-shadow', 'none');
  const after = await control.boundingBox();
  expect(after).toEqual(before);
  await page.screenshot({
    path: 'test-results/display-range-open.png',
    fullPage: true,
  });
  await control.press('Escape');
  await expect(page.getByRole('listbox')).not.toBeVisible();
  await expect(control).toBeFocused();
});

test('画面に戻ったとき更新を確認しても入力中の注文を再読み込みしない', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = ServiceWorkerRegistration.prototype.update;
    (window as unknown as { updateChecks: number }).updateChecks = 0;
    ServiceWorkerRegistration.prototype.update = function () {
      (window as unknown as { updateChecks: number }).updateChecks++;
      return original.call(this);
    };
  });
  await openFixture(page, await historyFixture(0));
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await page
    .getByRole('button', { name: 'ももを1本増やす', exact: true })
    .click();
  const before = await page.evaluate(
    () => (window as unknown as { updateChecks: number }).updateChecks,
  );
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { updateChecks: number }).updateChecks,
      ),
    )
    .toBeGreaterThan(before);
  await expect(page.getByLabel('ももの本数')).toHaveValue('1');
});

test('更新にバックアップの再読込は不要で、編集中は更新せず記録も残る', async ({
  page,
}) => {
  const { readFile, writeFile } = await import('node:fs/promises');
  const workerPath = 'dist/sw.js';
  const original = await readFile(workerPath, 'utf8');
  try {
    await openFixture(page, await historyFixture(1));
    await page.waitForFunction(
      () => navigator.serviceWorker.controller !== null,
    );
    await page.getByLabel('ももの本数', { exact: true }).fill('1');
    // Serve a new worker from the dedicated test build, like a deployment.
    await writeFile(workerPath, `${original}\n// update-test ${Date.now()}\n`);
    await page.evaluate(async () =>
      (await navigator.serviceWorker.getRegistration())!.update(),
    );
    const update = page.getByRole('button', { name: '更新する', exact: true });
    await expect(update).toBeVisible({ timeout: 15000 });
    await expect(update).toBeDisabled();
    await expect(page.getByLabel('ももの本数', { exact: true })).toHaveValue(
      '1',
    );
    await page.getByLabel('ももの本数', { exact: true }).fill('0');
    await expect(update).toBeEnabled();
    await page.getByRole('button', { name: '設定', exact: true }).click();
    await page.getByLabel('ももの通常価格（円）').fill('177');
    await expect(update).toBeDisabled();
    await page.getByLabel('ももの通常価格（円）').fill('150');
    await expect(update).toBeEnabled();
    await page.getByRole('button', { name: '集計', exact: true }).click();
    await page.getByLabel('開催回全体の経費（円）').fill('100');
    await expect(update).toBeDisabled();
    await page.getByLabel('開催回全体の経費（円）').fill('');
    await expect(update).toBeEnabled();
    await update.click();
    await expect(page.getByLabel('日付・価格を確認した')).toBeVisible();
    await page.getByLabel('日付・価格を確認した').check();
    await page
      .getByRole('button', { name: '会計を始める', exact: true })
      .click();
    await page.getByRole('button', { name: '注文履歴', exact: true }).click();
    await expect(page.locator('.history tbody tr')).toHaveCount(1);
    await expect(page.locator('.history tbody')).toContainText('￥150');
  } finally {
    await writeFile(workerPath, original);
  }
});
