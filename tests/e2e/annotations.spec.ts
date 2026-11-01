import { expect, test } from '@playwright/test';
import { historyFixture, openFixture } from './fixtures';

test('日付と札枚数は編集時だけ共通の保存を表示し、両方を保持する', async ({
  page,
}) => {
  await page.setViewportSize({ width: 834, height: 827 });
  await openFixture(page, await historyFixture(0));
  await page.getByRole('button', { name: '設定', exact: true }).click();
  const save = page.getByRole('button', { name: '保存', exact: true });
  await expect(save).toHaveCount(0);
  const date = page.getByLabel('会計に記録する日付');
  const tickets = page.getByLabel('番号札の枚数');
  await date.fill('2026-11-08');
  await tickets.fill('30');
  await expect(save).toBeVisible();
  await save.click();
  await expect(save).toHaveCount(0);
  await page.reload();
  await page.getByLabel('日付・価格を確認した').check();
  await page.getByRole('button', { name: '会計を始める', exact: true }).click();
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await expect(date).toHaveValue('2026-11-08');
  await expect(tickets).toHaveValue('30');
  const open = await page
    .getByRole('button', { name: 'バックアップから復元', exact: true })
    .boundingBox();
  const next = await page
    .getByRole('button', { name: '新しい開催回を準備', exact: true })
    .boundingBox();
  expect(open!.y).toBe(next!.y);
  expect(open!.width).toBe(next!.width);
  await page.screenshot({
    path: 'test-results/annotations-settings.png',
    fullPage: true,
  });
});

test('履歴の検索を横一列に揃え、時間帯と並び替えを併用できる', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1089, height: 827 });
  const fixture = await historyFixture(3);
  fixture.orders.forEach((order, index) => {
    order.createdAt = `2026-11-07T0${index + 1}:00:30Z`;
  });
  await openFixture(page, fixture);
  await page.getByRole('button', { name: '注文履歴', exact: true }).click();
  const day = page.getByRole('combobox', { name: '表示する日' });
  const ticket = page.getByLabel('札番号で検索');
  const waiting = page.getByRole('combobox', { name: '注文の状態' });
  const positions = await Promise.all(
    [day, ticket, waiting].map(async (item) => {
      const b = (await item.boundingBox())!;
      return b.y + b.height / 2;
    }),
  );
  expect(Math.max(...positions) - Math.min(...positions)).toBeLessThan(2);
  const hour = page.getByRole('combobox', { name: '時間帯' });
  const rows = page.locator('.history tbody tr');
  await page.getByRole('button', { name: '時刻', exact: true }).click();
  await expect(rows.first()).toContainText('10:00');
  await expect(
    page.getByRole('columnheader', { name: '時刻' }),
  ).toHaveAttribute('aria-sort', 'ascending');
  await page.getByRole('button', { name: '時刻', exact: true }).click();
  await expect(rows.first()).toContainText('12:00');
  await hour.click();
  await page.getByRole('option', { name: '10:00–11:00', exact: true }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('10:00');
  await waiting.click();
  await page.getByRole('option', { name: '未完了', exact: true }).click();
  await expect(rows).toHaveCount(0);
  await waiting.click();
  await page.getByRole('option', { name: 'すべての状態', exact: true }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows.first().locator('td').nth(0)).toContainText('No.');
  for (const width of [1089, 834]) {
    await page.setViewportSize({ width, height: 827 });
    const heading = page.getByRole('heading', {
      name: '注文履歴',
      exact: true,
    });
    expect((await heading.boundingBox())!.height).toBeLessThan(40);
    const fonts = await page
      .locator('.history th, .history td')
      .evaluateAll((items) =>
        items.map((item) => getComputedStyle(item).fontSize),
      );
    expect(new Set(fonts)).toEqual(new Set(['16px']));
    await page.screenshot({
      path: `test-results/annotations-history-${width}.png`,
      fullPage: true,
    });
  }
});

test('空白の通知行を作らず、GIFと簡潔なアプリ情報を表示する', async ({
  page,
}) => {
  await page.setViewportSize({ width: 834, height: 827 });
  await openFixture(page, await historyFixture(0));
  await expect(page.locator('#checkout-title svg')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: '完了表示を片づける' }),
  ).toHaveCount(0);
  await expect(page.locator('.checkout > .checkout-feedback')).toHaveCount(0);
  const prices = await page
    .locator('.product-name small')
    .evaluateAll((items) =>
      items.map((item) => item.getBoundingClientRect().right),
    );
  expect(Math.max(...prices) - Math.min(...prices)).toBeLessThan(1);
  const before = (await page
    .getByRole('button', { name: 'ももを1本増やす' })
    .boundingBox())!;
  await page.getByRole('button', { name: 'ももを1本増やす' }).click();
  await page.getByRole('button', { name: '注文をクリア' }).click();
  expect(
    (await page.getByRole('button', { name: 'ももを1本増やす' }).boundingBox())!
      .y,
  ).toBe(before.y);
  const mascot = page.locator('.waiting .empty img');
  await expect(mascot).toHaveAttribute('src', '/assets/empty-orders.gif');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect
    .poll(() => mascot.evaluate((img: HTMLImageElement) => img.currentSrc))
    .toContain('empty-orders-still.png');
  await page.screenshot({
    path: 'test-results/annotations-counter.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'このアプリについて' }).click();
  const dialog = page.getByRole('dialog');
  await expect(
    dialog.getByRole('link', { name: 'ueki.keitaro@gmail.com' }),
  ).toHaveAttribute('href', 'mailto:ueki.keitaro@gmail.com');
  await expect(dialog.getByRole('link', { name: 'MIT License' })).toBeVisible();
  await expect(dialog.getByText('再開・トラブル時')).toHaveCount(0);
  await page.screenshot({
    path: 'test-results/annotations-about.png',
    fullPage: true,
  });
});
