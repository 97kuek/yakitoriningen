import { expect, test } from '@playwright/test';
import {
  leaveIsBlocked,
  ledgerFixture,
  openFixture,
  openScreen,
} from './helpers';

test('日別の売上・30分ごとのグラフ・商品内訳と経費を確認し、未保存の経費を保つ', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1089, height: 827 });
  const fixture = await ledgerFixture({
    orders: 3,
    days: ['2026-11-07', '2026-11-07', '2026-11-08'],
  });
  // Stored order is by random ID, so pick orders by business day.
  const [first, second] = fixture.orders.filter((o) => o.day === '2026-11-07');
  const third = fixture.orders.find((o) => o.day === '2026-11-08')!;
  first.paidAt = '2026-11-07T01:05:00Z';
  second.paidAt = '2026-11-07T02:05:00Z';
  third.paidAt = '2026-11-08T01:35:00Z';
  await openFixture(page, fixture);
  await expect(page.locator('.session-bar')).toContainText(
    '2026年度 早稲田祭　11月8日',
  );
  await openScreen(page, '集計');

  const table = page.getByRole('table', { name: '日別の集計' });
  await expect(table.locator('tbody tr').nth(0)).toContainText('￥300');
  await expect(table.locator('tbody tr').nth(1)).toContainText('￥150');
  await expect(table.locator('tfoot')).toContainText('￥450');

  const charts = page.getByRole('region', { name: '日別のグラフ' });
  const bars = charts.locator('.bar-track');
  await expect(bars).toHaveCount(1);
  await expect(bars).toHaveAttribute('aria-label', '10:30〜11:00 ￥150');
  await expect(charts.getByRole('img')).toHaveAccessibleName('もも 1本');
  await charts.getByRole('combobox', { name: 'グラフの日付' }).click();
  await page.getByRole('option', { name: '11/7', exact: true }).click();
  await expect(bars).toHaveCount(3);
  await expect(bars.nth(1)).toHaveAttribute('aria-label', '10:30〜11:00 ￥0');
  await expect(charts.getByRole('img')).toHaveAccessibleName('もも 2本');
  await expect(charts.locator('.chart-legend')).toContainText('100%');

  const expense = page.getByLabel('開催回全体の経費（円）');
  await expense.fill('00100');
  await expect.poll(() => leaveIsBlocked(page)).toBe(true);
  await openScreen(page, '会計');
  await openScreen(page, '集計');
  await expect(expense).toHaveValue('00100');
  await page.getByRole('button', { name: '経費を保存', exact: true }).click();
  await expect(
    page.getByText('経費を保存しました。', { exact: true }),
  ).toBeVisible();
  await expect(page.locator('.summary-profit')).toContainText('￥350');
  await expect.poll(() => leaveIsBlocked(page)).toBe(false);
});

test('記録のない営業日を訂正したらグラフも新しい日付を選ぶ', async ({
  page,
}) => {
  await openFixture(page, await ledgerFixture());
  await openScreen(page, '設定');
  await page.getByLabel('会計に記録する日付').fill('2026-11-08');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await openScreen(page, '集計');
  await expect(
    page.getByRole('combobox', { name: 'グラフの日付' }),
  ).toContainText('11/8');
  await expect(
    page.getByText('売上はまだありません', { exact: true }),
  ).toBeVisible();
});
