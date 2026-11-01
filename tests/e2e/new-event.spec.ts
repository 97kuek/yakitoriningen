import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { historyFixture, openFixture } from './fixtures';

test('バックアップ保存後に再選択なしで新しい開催回に切り替える', async ({
  page,
}) => {
  await openFixture(
    page,
    await historyFixture(1, { unit: 200, discounted: true }),
  );
  await page.reload();
  await page
    .getByRole('button', { name: '新しい開催回を準備', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: '新しい開催回を準備' });
  await dialog.getByLabel('開催回', { exact: true }).fill('早稲田祭 2027');
  await dialog.getByLabel('1日目の日付').fill('2027-11-06');
  await expect(
    dialog.getByRole('button', { name: '新しい開催回に切り替える' }),
  ).toBeEnabled();
  await dialog.getByRole('button', { name: '閉じる' }).click();
  const downloading = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'バックアップを保存', exact: true })
    .click();
  const file = await downloading;
  expect(file.suggestedFilename()).toBe('2026-11-07-yakitori.json');
  const buffer = await readFile((await file.path())!);
  expect(JSON.parse(buffer.toString()).data.orders).toHaveLength(1);
  await expect(page.getByLabel('保存したファイルを確認')).toHaveCount(0);
  await page
    .getByRole('button', { name: '新しい開催回を準備', exact: true })
    .click();
  await dialog
    .getByRole('button', { name: '新しい開催回に切り替える' })
    .click();
  await expect(page.getByText('早稲田祭 2027', { exact: true })).toBeVisible();
  await expect(page.getByText('確定済み 0件')).toHaveCount(0);
  await expect(page.getByText('もも ￥200')).toBeVisible();
});

test('バックアップを省略しても開催回を準備できる', async ({ page }) => {
  await openFixture(page, await historyFixture(1));
  await page.reload();
  await page.getByRole('button', { name: '新しい開催回を準備' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('checkbox')).toHaveCount(0);
  await dialog.getByLabel('開催回', { exact: true }).fill('翌年の早稲田祭');
  await dialog.getByLabel('1日目の日付').fill('2027-11-06');
  await dialog
    .getByRole('button', { name: '新しい開催回に切り替える' })
    .click();
  await expect(page.locator('.startup-event')).toHaveText('翌年の早稲田祭');
});
