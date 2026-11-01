import { encodeBackup } from '../../src/application/backup';
import { dailySnapshot } from '../../src/application/daily-backup';
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
  await expect(table.locator('tbody tr')).toHaveCount(1);
  await expect(table.locator('tfoot')).toContainText('￥150');

  const charts = page.getByRole('region', { name: '日別のグラフ' });
  // Sales span business hours 10:00–17:00 in 30-minute slots.
  const sales = charts
    .getByRole('figure', { name: '30分ごとの売上' })
    .locator('.bar-track');
  await expect(sales).toHaveCount(14);
  await expect(charts.getByRole('figure')).toHaveCount(2);
  await expect(sales.nth(0)).toHaveAttribute('aria-label', '10:00〜10:30 ￥0');
  await expect(sales.nth(1)).toHaveAttribute(
    'aria-label',
    '10:30〜11:00 ￥150',
  );
  await expect(sales.last()).toHaveAttribute('aria-label', '16:30〜17:00 ￥0');
  await expect(charts.getByRole('img')).toHaveAccessibleName('もも 1本');
  const expense = page.getByLabel('当日の経費');
  await expense.fill('00100');
  await expect.poll(() => leaveIsBlocked(page)).toBe(true);
  await openScreen(page, '会計');
  await page
    .getByRole('dialog', { name: '変更が保存されていません' })
    .getByRole('button', { name: '未保存のまま移動' })
    .click();
  await openScreen(page, '集計');
  await expect(expense).toHaveValue('00100');
  await page.getByRole('button', { name: '経費を保存', exact: true }).click();
  await expect(
    page.getByText('経費を保存しました。', { exact: true }),
  ).toBeVisible();
  await expect(page.locator('.summary-profit')).toContainText('￥50');
  await expect.poll(() => leaveIsBlocked(page)).toBe(false);
  const files = ['2026-11-07', '2026-11-08'].map((day) => ({
    name: `${day}-yakitori.json`,
    mimeType: 'application/json',
    buffer: Buffer.from(encodeBackup(dailySnapshot(fixture, day))),
  }));
  await page.getByLabel('日別のバックアップを集計').setInputFiles(files);
  await expect(table.locator('tbody tr')).toHaveCount(2);
  await expect(table.locator('tfoot')).toContainText('￥450');
  await charts.getByRole('combobox', { name: 'グラフの日付' }).click();
  await page.getByRole('option', { name: '11/7', exact: true }).click();
  await expect(sales.nth(0)).toHaveAttribute(
    'aria-label',
    '10:00〜10:30 ￥150',
  );
  await expect(sales.nth(1)).toHaveAttribute('aria-label', '10:30〜11:00 ￥0');
  await expect(sales.nth(2)).toHaveAttribute(
    'aria-label',
    '11:00〜11:30 ￥150',
  );
  // Empty slots keep their place and the axis line does not break between them.
  const edges = await sales.evaluateAll((tracks) =>
    tracks.map((track) => track.getBoundingClientRect()),
  );
  for (let index = 1; index < edges.length; index++)
    expect(Math.abs(edges[index].left - edges[index - 1].right)).toBeLessThan(
      1,
    );
  await expect(charts.getByRole('img')).toHaveAccessibleName('もも 2本');
  await expect(charts.locator('.chart-legend')).toContainText('100%');

  await expect(page.getByLabel('当日の経費')).toHaveCount(0);
  await page.getByRole('button', { name: '当日の集計に戻る' }).click();
  await expect(table.locator('tfoot')).toContainText('￥150');
  await expect(expense).toHaveValue('100');
});

test('記録のない営業日を訂正したらグラフも新しい日付を選ぶ', async ({
  page,
}) => {
  await openFixture(page, await ledgerFixture());
  await openScreen(page, '設定');
  await page.getByLabel('営業日').fill('2026-11-08');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await openScreen(page, '集計');
  await expect(
    page.getByRole('combobox', { name: 'グラフの日付' }),
  ).toContainText('11/8');
  await expect(
    page.getByText('売上はまだありません', { exact: true }),
  ).toBeVisible();
});
