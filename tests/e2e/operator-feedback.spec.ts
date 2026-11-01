import { expect, test } from '@playwright/test';
import { historyFixture, openFixture } from './fixtures';

test('お釣り確認と会計確定のボタン位置を揃える', async ({ page }) => {
  await page.setViewportSize({ width: 834, height: 827 });
  await openFixture(page, await historyFixture(0));
  await page.getByRole('button', { name: 'ももを1本増やす' }).click();
  await page.getByRole('button', { name: '会計へ', exact: true }).click();
  await page.getByLabel('お預かり金額').fill('1000');
  const before = await page
    .getByRole('button', { name: 'お釣りを確認' })
    .boundingBox();
  await page.getByRole('button', { name: 'お釣りを確認' }).click();
  const after = await page
    .getByRole('button', { name: '会計を確定' })
    .boundingBox();
  expect(Math.abs(before!.y - after!.y)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: 'test-results/payment-feedback.png' });
});

test('初回準備とファイル選択は形式が分かる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'バックアップから復元' }).click();
  const dialog = page.getByRole('dialog', { name: 'バックアップから復元' });
  await page.screenshot({ path: 'test-results/file-feedback.png' });
  await expect(dialog.getByLabel('記録ファイル（.json）')).toHaveAttribute(
    'accept',
    '.json,application/json',
  );
});

test('お釣り確認後の二度押しでは会計を確定しない', async ({ page }) => {
  await page.setViewportSize({ width: 834, height: 827 });
  await openFixture(page, await historyFixture(0));
  await page.getByRole('button', { name: 'ももを1本増やす' }).click();
  await page.getByRole('button', { name: '会計へ', exact: true }).click();
  await page.getByLabel('お預かり金額').fill('1000');
  const button = page.getByRole('button', { name: 'お釣りを確認' });
  const box = (await button.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const confirm = page.getByRole('button', { name: '会計を確定' });
  await expect(confirm).toBeVisible();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, {
    clickCount: 2,
  });
  await expect(confirm).toBeVisible();
  await expect(page.getByTestId('waiting-order')).toHaveCount(0);
  await confirm.click();
  await expect(page.getByTestId('waiting-order')).toHaveCount(1);
});
