import { expect, test } from '@playwright/test';
import { ledgerFixture, loadFixture } from './helpers';

test('アプリ内でREADMEと同じ使い方と画面画像を読める', async ({ page }) => {
  await loadFixture(page, await ledgerFixture());
  await page.getByRole('button', { name: 'このアプリについて' }).click();
  const help = page.getByRole('dialog');
  expect((await help.boundingBox())!.width).toBeGreaterThan(800);
  await expect(
    help.getByRole('heading', { name: '会計担当者向け', exact: true }),
  ).toBeVisible();
  await expect(
    help.getByRole('img', { name: '会計画面', exact: true }),
  ).toBeVisible();
  await expect(
    help.getByRole('heading', { name: '営業終了後', exact: true }),
  ).toHaveCount(1);
  await expect(
    help.getByRole('link', { name: 'GitHub', exact: true }),
  ).toHaveCount(1);
});
