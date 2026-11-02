import { readFile } from 'node:fs/promises';
import { expect, test, type Download } from '@playwright/test';
import {
  addSkewers,
  ledgerFixture,
  openFixture,
  openScreen,
  pay,
  startCounter,
} from './helpers';

test('画面を切り替えても日付と上端が動かず、左右の枠と分かりやすい接続表示を揃える', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1435, height: 984 });
  await openFixture(page, await ledgerFixture());
  const checkout = (await page.locator('.checkout').boundingBox())!;
  const session = (await page.locator('.session-bar').boundingBox())!;
  await expect(page.locator('.checkout')).toHaveCSS(
    'border-top-color',
    await page
      .locator('.waiting')
      .evaluate((node) => getComputedStyle(node).borderTopColor),
  );
  await expect(page.locator('.storage-status')).toHaveCount(0);
  await expect(page.locator('.connection-status')).toContainText('オンライン');
  await openScreen(page, '注文履歴');
  expect((await page.locator('.history').boundingBox())!.y).toBe(checkout.y);
  expect((await page.locator('.session-bar').boundingBox())!.y).toBe(session.y);
  await openScreen(page, '設定');
  expect((await page.locator('.settings').boundingBox())!.y).toBe(checkout.y);
  await expect(page.getByText('用意した本数', { exact: true })).toHaveCount(0);
  await expect(page.getByText('在庫数', { exact: true })).toBeVisible();
  await expect(page.getByText('セット対象', { exact: true })).toBeVisible();
  await expect(page.getByText('商品名', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'ももの在庫を調整' }),
  ).toHaveCount(0);
});

test('17時にバックアップを案内し、当日分のJSONと全件CSVを保存して営業を終了できる', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-11-07T07:59:00Z') });
  await openFixture(
    page,
    await ledgerFixture({
      orders: 3,
      days: ['2026-11-06', '2026-11-07', '2026-11-07'],
    }),
  );
  await expect(
    page.getByText('本日のバックアップを保存してください。', { exact: true }),
  ).toHaveCount(0);
  await page.clock.fastForward(60_000);
  await expect(
    page.getByText('本日のバックアップを保存してください。', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: '今日の営業を終了', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: '1日、お疲れさまでした！' });
  const result = dialog.getByLabel('本日の営業結果');
  await expect(result).toContainText('2本');
  await expect(result).toContainText('￥300');
  await expect(
    dialog.getByRole('button', { name: '保存を確認して終了' }),
  ).toBeDisabled();
  const files: Download[] = [];
  page.on('download', (file) => files.push(file));
  await dialog
    .getByRole('button', { name: 'JSON・CSVを保存', exact: true })
    .click();
  await expect
    .poll(() => files.map((file) => file.suggestedFilename()).sort())
    .toEqual(['2026-11-07-yakitori.csv', '2026-11-07-yakitori.json']);
  const json = files.find((file) =>
    file.suggestedFilename().endsWith('.json'),
  )!;
  expect(
    JSON.parse(await readFile((await json.path())!, 'utf8')).data.orders,
  ).toHaveLength(2);
  const csvFile = files.find((file) =>
    file.suggestedFilename().endsWith('.csv'),
  )!;
  const csv = await readFile((await csvFile.path())!, 'utf8');
  expect(csv.split('\r\n')).toHaveLength(3);
  expect(csv).not.toContain('2026-11-06');
  await dialog.getByRole('button', { name: '保存を確認して終了' }).click();
  await expect(
    page.getByRole('heading', { name: '保存されている記録から再開' }),
  ).toBeVisible();
  await page.reload();
  await startCounter(page);
  await expect(
    page.getByText('本日のバックアップを保存してください。', { exact: true }),
  ).toHaveCount(0);
  await addSkewers(page, 'もも');
  await pay(page);
  await expect(
    page.getByText('本日のバックアップを保存してください。', { exact: true }),
  ).toBeVisible();
});

test('設定でJSONだけ保存しても営業終了の保存確認を解除しない', async ({
  page,
}) => {
  await openFixture(page, await ledgerFixture({ orders: 1 }));
  await openScreen(page, '設定');
  const downloading = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'バックアップを保存', exact: true })
    .click();
  expect((await downloading).suggestedFilename()).toBe(
    '2026-11-07-yakitori.json',
  );
  await page
    .getByRole('button', { name: '今日の営業を終了', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: '1日、お疲れさまでした！' });
  await expect(
    dialog.getByRole('button', { name: '保存を確認して終了' }),
  ).toBeDisabled();
});

test('設定でこのアプリの使用量と保存上限の目安を確認できる', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.storage, 'estimate', {
      value: async () => ({ usage: 5_000_000, quota: 10_000_000_000 }),
    });
  });
  await openFixture(page, await ledgerFixture());
  await openScreen(page, '設定');
  await expect(page.getByLabel('保存容量の目安')).toContainText('5 MB');
  await expect(page.getByLabel('保存容量の目安')).toContainText('10 GB');
});

test('会計中は営業を終了できず、お預かり金額を保持する', async ({ page }) => {
  await openFixture(page, await ledgerFixture());
  await addSkewers(page, 'もも', 2);
  await page.getByRole('button', { name: '会計へ', exact: true }).click();
  await page.getByLabel('お預かり金額').fill('500');
  await page
    .getByRole('button', { name: '今日の営業を終了', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: '1日、お疲れさまでした！' });
  await expect(
    dialog.getByRole('button', { name: 'JSON・CSVを保存', exact: true }),
  ).toBeDisabled();
  await expect(
    dialog.getByRole('button', { name: '保存を確認して終了' }),
  ).toBeDisabled();
  await dialog.getByRole('button', { name: '閉じる', exact: true }).click();
  await expect(page.getByLabel('お預かり金額')).toHaveValue('500');
});
