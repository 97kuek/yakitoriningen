import { expect, test } from '@playwright/test';
import {
  ledgerFixture,
  openFixture,
  openScreen,
  startCounter,
} from './helpers';
import { dailySnapshot } from '../../src/application/daily-backup';

test('営業日の準備と再開を同じ入口で行い、他の日を残してバックアップを復元する', async ({
  page,
}) => {
  const snapshot = await ledgerFixture({
    orders: 2,
    days: ['2026-11-07', '2026-11-08'],
  });
  const backup = dailySnapshot(snapshot, '2026-11-07');
  const { encodeBackup } = await import('../../src/application/backup');
  await openFixture(page, snapshot);
  await openScreen(page, '設定');
  await expect(page.getByLabel('営業日', { exact: true })).toHaveCount(0);
  await page
    .getByRole('button', { name: '別の日の営業を準備', exact: true })
    .click();
  const preparation = page.getByRole('dialog', { name: '別の日の営業を準備' });
  await preparation.getByRole('button', { name: 'この日の営業に戻る' }).click();
  await startCounter(page);
  await openScreen(page, '注文履歴');
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);
  await openScreen(page, '設定');
  await page
    .getByRole('button', { name: 'バックアップから復元', exact: true })
    .click();
  const restore = page.getByRole('dialog', { name: 'バックアップから復元' });
  await restore.getByLabel('記録ファイル（.json）').setInputFiles({
    name: 'first.json',
    mimeType: 'application/json',
    buffer: Buffer.from(encodeBackup(backup)),
  });
  await restore.getByLabel('バックアップ内容を確認した').check();
  await restore.getByRole('button', { name: 'この内容で再開' }).click();
  await startCounter(page);
  await openScreen(page, '設定');
  await page
    .getByRole('button', { name: '別の日の営業を準備', exact: true })
    .click();
  await expect(
    preparation.getByRole('combobox', { name: '保存済みの営業日' }),
  ).toContainText('2026-11-08');
  await preparation.getByRole('button', { name: 'この日の営業に戻る' }).click();
  await startCounter(page);
  await openScreen(page, '注文履歴');
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);
});

test('在庫を20本追加・3本廃棄すると会計画面の残りが27本になる', async ({
  page,
}) => {
  await openFixture(page, await ledgerFixture());
  await openScreen(page, '設定');
  await page.getByLabel('ももの在庫', { exact: true }).fill('10');
  await page.getByRole('button', { name: '変更を保存', exact: true }).click();
  await page
    .getByRole('button', { name: 'ももの在庫を調整', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: 'ももの在庫を調整' });
  await dialog.getByLabel('調整する本数', { exact: true }).fill('20');
  await dialog.getByRole('button', { name: '調整を記録' }).click();
  await expect(page.getByLabel('ももの在庫', { exact: true })).toHaveValue(
    '30',
  );
  await page
    .getByRole('button', { name: 'ももの在庫を調整', exact: true })
    .click();
  await dialog.getByRole('button', { name: '廃棄', exact: true }).click();
  await dialog.getByLabel('調整する本数', { exact: true }).fill('3');
  await dialog.getByRole('button', { name: '調整を記録' }).click();
  await openScreen(page, '会計');
  await expect(page.locator('.product-stock')).toHaveText('残り 27本');
});

test('札ごとの経過時間は会計確定時刻から数え、時間経過で更新する', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-11-07T03:00:00Z') });
  await openFixture(
    page,
    await ledgerFixture({ orders: 1, waiting: 1, now: '2026-11-07T02:52:00Z' }),
  );
  await expect(
    page.getByTestId('waiting-order').locator('.order-wait'),
  ).toHaveText('経過8分');
  await page.clock.fastForward(60_000);
  await expect(
    page.getByTestId('waiting-order').locator('.order-wait'),
  ).toHaveText('経過9分');
});
