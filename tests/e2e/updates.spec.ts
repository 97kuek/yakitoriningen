import { test, expect } from '@playwright/test';
import { historyFixture, openFixture } from './fixtures';

test('表示範囲は標準メニューや二重枠を使わず、開閉しても位置が変わらない', async ({
  page,
}) => {
  await openFixture(page, await historyFixture(0));
  await page.getByRole('button', { name: '売上・履歴', exact: true }).click();
  const control = page.getByRole('combobox', { name: '表示範囲' });
  await expect(page.locator('select')).toHaveCount(0);
  const before = await control.boundingBox();
  await control.click();
  await expect(page.getByRole('listbox', { name: '表示範囲' })).toBeVisible();
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
