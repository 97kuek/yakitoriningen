import { expect, test } from '@playwright/test';
import { ledgerFixture, loadFixture, startCounter } from './helpers';

test('ホームで当日の営業名を編集し、新しい営業にも別の名前を付けて再開する', async ({
  page,
}) => {
  await loadFixture(page, await ledgerFixture({ orders: 1 }));
  await page.getByRole('button', { name: '営業名を変更', exact: true }).click();
  const rename = page.getByRole('dialog', { name: '営業名を変更' });
  await rename.getByLabel('営業名', { exact: true }).fill('土曜の焼き鳥');
  await rename.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.locator('.startup-event')).toHaveText('土曜の焼き鳥');
  await page.reload();
  await expect(page.locator('.startup-event')).toHaveText('土曜の焼き鳥');
  await page
    .getByRole('button', { name: '新しい営業を作る', exact: true })
    .click();
  const setup = page.getByRole('dialog', { name: '新しい営業を作る' });
  await setup.getByLabel('営業名', { exact: true }).fill('日曜の焼き鳥');
  await setup.getByLabel('営業日', { exact: true }).fill('2026-11-08');
  await setup
    .getByRole('button', { name: 'この営業日を準備', exact: true })
    .click();
  await expect(page.locator('.startup-event')).toHaveText('日曜の焼き鳥');
  await startCounter(page);
  await expect(page.locator('.session-bar')).toContainText('日曜の焼き鳥');
  await page.getByRole('button', { name: 'ホームへ戻る', exact: true }).click();
  await page
    .getByRole('button', { name: '新しい営業を作る', exact: true })
    .click();
  await setup.getByRole('button', { name: 'この日の営業に戻る' }).click();
  await expect(page.locator('.startup-event')).toHaveText('土曜の焼き鳥');
});
