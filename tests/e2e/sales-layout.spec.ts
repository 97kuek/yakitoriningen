import { expect, test } from '@playwright/test';
import { historyFixture, openFixture } from './fixtures';

test('日別のグラフは30分の会計額と販売本数を表示し、日付で切り替える', async ({
  page,
}) => {
  const fixture = await historyFixture(3, undefined, [
    '2026-11-07',
    '2026-11-07',
    '2026-11-08',
  ]);
  const firstDay = fixture.orders.filter((order) => order.day === '2026-11-07');
  firstDay[0].paidAt = '2026-11-07T01:05:00Z';
  firstDay[1].paidAt = '2026-11-07T02:05:00Z';
  fixture.orders.find((order) => order.day === '2026-11-08')!.paidAt =
    '2026-11-08T01:35:00Z';
  await openFixture(page, fixture);
  await page.getByRole('button', { name: '集計', exact: true }).click();
  const charts = page.getByRole('region', { name: '日別のグラフ' });
  await expect(charts.locator('.bar-track')).toHaveCount(1);
  await expect(charts.locator('.bar-track')).toHaveAttribute(
    'aria-label',
    '10:30〜11:00 ￥150',
  );
  await expect(charts.getByRole('img')).toHaveAccessibleName('もも 1本');
  await charts.getByRole('combobox', { name: 'グラフの日付' }).click();
  await page.getByRole('option', { name: '11/7', exact: true }).click();
  await expect(charts.locator('.bar-track')).toHaveCount(3);
  await expect(charts.locator('.bar-track').nth(1)).toHaveAttribute(
    'aria-label',
    '10:30〜11:00 ￥0',
  );
  await expect(charts.getByRole('img')).toHaveAccessibleName('もも 2本');
  await expect(charts.locator('.chart-legend')).toContainText('100%');
  await page.screenshot({
    path: 'test-results/sales-charts.png',
    fullPage: true,
  });
});

test('お釣りを筆算順に揃え、札の表示を会計と待ち一覧で共用する', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1019, height: 827 });
  await openFixture(page, await historyFixture(0));
  await expect(page.locator('.price-strip')).toContainText('通常価格');
  await page.getByRole('button', { name: 'ももを1本増やす' }).click();
  await page.getByRole('button', { name: '会計へ', exact: true }).click();
  await expect(page.locator('.receipt-items')).toHaveCSS('font-size', '16px');
  await expect(page.locator('.payment .ticket-chip')).toHaveText('札 1');
  await page.getByRole('button', { name: '￥1,000', exact: true }).click();
  await page.getByRole('button', { name: 'お釣りを確認' }).click();
  const rows = page.locator('.cash-calculation > div');
  await expect(rows.locator('span')).toHaveText([
    'お預かり',
    '− お会計',
    'お釣り',
  ]);
  const edges = await rows
    .locator('strong')
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getBoundingClientRect().right),
    );
  expect(Math.max(...edges) - Math.min(...edges)).toBeLessThanOrEqual(1);
  await expect(rows.locator('strong').nth(2)).toHaveText('￥850');
  await page.screenshot({ path: 'test-results/payment-aligned.png' });
  await page.getByRole('button', { name: '会計を確定' }).click();
  await expect(page.locator('.waiting .ticket-chip')).toHaveText('札 1');
  await expect(page.getByTestId('checkout-feedback')).toBeEmpty();
});

test('商品削除を左端に置き、空の通知行を作らない', async ({ page }) => {
  await openFixture(page, await historyFixture(0));
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await expect(
    page.locator('.menu-selling-current, .menu-settings > .settings-result'),
  ).toHaveCount(0);
  const row = page.locator('.menu-row').first();
  const remove = await row
    .getByRole('button', { name: 'ももを削除' })
    .boundingBox();
  const name = await row
    .getByLabel('商品1の名前', { exact: true })
    .boundingBox();
  expect(remove!.x + remove!.width).toBeLessThan(name!.x);
});

test('記録のない営業日を訂正したらグラフも新しい日付を選ぶ', async ({
  page,
}) => {
  await openFixture(page, await historyFixture(0));
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByLabel('会計に記録する日付').fill('2026-11-08');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await page.getByRole('button', { name: '集計', exact: true }).click();
  await expect(
    page.getByRole('combobox', { name: 'グラフの日付' }),
  ).toContainText('11/8');
  await expect(
    page.getByText('売上はまだありません', { exact: true }),
  ).toBeVisible();
});
