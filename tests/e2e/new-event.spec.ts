import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { historyFixture, openFixture } from './fixtures';

test('保存した前年の記録を確認してから新しい開催回に切り替える', async ({
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
  await dialog.getByLabel('前年の記録を保存した').check();
  await expect(
    dialog.getByRole('button', { name: '新しい開催回に切り替える' }),
  ).toBeDisabled();
  await dialog.getByRole('button', { name: '閉じる' }).click();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: '記録を保存', exact: true }).click();
  const buffer = await readFile((await (await downloading).path())!);
  const saved = { name: 'saved.json', mimeType: 'application/json', buffer };
  expect(JSON.parse(buffer.toString()).data.orders).toHaveLength(1);
  await page.getByLabel('保存したファイルを確認').setInputFiles(saved);
  await page
    .getByRole('button', { name: '新しい開催回を準備', exact: true })
    .click();
  await dialog
    .getByRole('button', { name: '新しい開催回に切り替える' })
    .click();
  await expect(page.getByText('早稲田祭 2027', { exact: true })).toBeVisible();
  await expect(page.getByText('確定済み 0件')).toBeVisible();
  await expect(page.getByText('もも ￥200')).toBeVisible();
});
