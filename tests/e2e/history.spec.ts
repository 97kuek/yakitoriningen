import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import {
  centersY,
  ledgerFixture,
  openFixture,
  openScreen,
  rows,
} from './helpers';

test('検索欄を横一列に揃え、30分の時間帯・状態・札番号・並べ替えを併用できる', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1089, height: 827 });
  // The first order waits for handoff on ticket 1; the others are complete on ticket 2.
  const fixture = await ledgerFixture({ orders: 3, waiting: 1 });
  // Stored order is by random ID, so place the waiting order first explicitly.
  [...fixture.orders]
    .sort((a, b) => Number(a.delivered) - Number(b.delivered))
    .forEach((order, index) => {
      order.createdAt = `2026-11-07T0${index + 1}:00:30Z`;
    });
  await openFixture(page, fixture);
  await openScreen(page, '注文履歴');
  await expect(page.getByRole('combobox', { name: '表示する日' })).toHaveCount(
    0,
  );
  const slot = page.getByRole('combobox', { name: '時間帯' });
  const ticket = page.getByLabel('札番号で検索');
  const state = page.getByRole('combobox', { name: '注文の状態' });
  const choose = async (
    control: typeof slot,
    option: string,
    expected: number,
  ) => {
    await control.click();
    await page.getByRole('option', { name: option, exact: true }).click();
    await expect(rows(page)).toHaveCount(expected);
  };

  await expect(page.locator('.history th').first()).toHaveText('会計番号');
  await expect(rows(page).first().locator('td').nth(0)).toContainText('No.');
  const table = page.getByRole('table');
  await expect(table).not.toContainText('2026-11-07');
  expect(await table.innerText()).not.toMatch(/\b[a-f0-9]{8}\b/);

  await page.getByRole('button', { name: '時刻', exact: true }).click();
  await expect(rows(page).first()).toContainText('10:00');
  await expect(
    page.getByRole('columnheader', { name: '時刻' }),
  ).toHaveAttribute('aria-sort', 'ascending');
  await page.getByRole('button', { name: '時刻', exact: true }).click();
  await expect(rows(page).first()).toContainText('12:00');

  await slot.click();
  await expect(page.getByRole('option')).toHaveCount(15);
  await expect(page.getByRole('option').last()).toHaveText('16:30–17:00');
  await page.getByRole('option', { name: '10:00–10:30', exact: true }).click();
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText('10:00');
  await choose(slot, '10:30–11:00', 0);
  await choose(slot, 'すべての時間', 3);

  await choose(state, '完了', 2);
  await choose(state, '未完了', 1);
  await expect(rows(page)).toContainText('10:00');
  await choose(state, '取消', 0);
  await choose(state, 'すべての状態', 3);
  await ticket.fill('1');
  await expect(rows(page)).toHaveCount(1);
  await ticket.fill('');

  for (const width of [1089, 834]) {
    await page.setViewportSize({ width, height: 827 });
    const centers = await centersY([slot, ticket, state]);
    expect(Math.max(...centers) - Math.min(...centers)).toBeLessThan(2);
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
  }
});

test('50件ずつページを分け、CSVは表示条件に合う全ページ分を保存する', async ({
  page,
}) => {
  const days = [...Array<string>(51).fill('2026-11-07'), '2026-11-08'];
  const fixture = await ledgerFixture({ orders: 52, days });
  fixture.meta.day = '2026-11-07';
  await openFixture(page, fixture);
  await openScreen(page, '注文履歴');

  await expect(rows(page)).toHaveCount(50);
  await page.getByRole('button', { name: '次のページ', exact: true }).click();
  await expect(rows(page)).toHaveCount(1);
  await expect(
    page.getByText('51〜51件 / 51件', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '前のページ', exact: true }).click();
  await expect(rows(page)).toHaveCount(50);
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: '表示条件の注文をCSVで保存' }).click();
  const file = await downloading;
  expect(file.suggestedFilename()).toContain('2026-11-07.csv');
  const csv = await readFile((await file.path())!, 'utf8');
  expect(csv.split('\r\n')).toHaveLength(52);
  expect(csv).not.toContain('2026-11-08');
  await openScreen(page, '設定');
  await expect(page.locator('.settings')).not.toContainText('売上一覧');
});

test('同じ秒・札・商品・金額の会計を詳細で区別し、同じ情報を見て段階的に返金できる', async ({
  page,
}) => {
  const snapshot = await ledgerFixture({
    orders: 2,
    now: '2026-11-07T03:04:05.000Z',
    received: (index) => (index === 0 ? 1000 : 500),
  });
  await openFixture(page, snapshot);
  await openScreen(page, '注文履歴');
  const receipts: string[] = [];
  const amounts: string[] = [];
  for (let index = 0; index < 2; index++) {
    await rows(page)
      .nth(index)
      .getByRole('button', { name: '注文の詳細', exact: true })
      .click();
    const details = page.getByRole('dialog', { name: '注文の詳細' });
    const summary = details.getByTestId('order-details');
    await expect(summary).toContainText('12:04:05');
    await expect(summary).toContainText('完了');
    await expect(summary).toContainText('札 1');
    receipts.push((await summary.getByTestId('receipt-number').textContent())!);
    amounts.push((await summary.getByTestId('received-amount').textContent())!);
    const text = await summary.innerText();
    for (const order of snapshot.orders) expect(text).not.toContain(order.id);
    await details
      .getByRole('button', { name: '全額返金', exact: true })
      .click();
    const refund = page.getByRole('dialog', { name: '全額返金', exact: true });
    await expect(refund.getByTestId('order-details')).toHaveText(text, {
      useInnerText: true,
    });
    await expect(
      refund.getByRole('button', { name: '返金を記録', exact: true }),
    ).not.toBeVisible();
    await refund.getByLabel('取消理由').fill('注文間違い');
    await expect(refund.getByLabel('取消理由')).toHaveCSS(
      'outline-style',
      'none',
    );
    await refund.getByRole('button', { name: '戻る', exact: true }).click();
  }
  expect(new Set(receipts).size).toBe(2);
  expect(amounts.sort()).toEqual(['￥1,000', '￥500'].sort());
});

test('営業日を変更すると履歴とCSVの対象日が変わり、前日の記録は残る', async ({
  page,
}) => {
  await openFixture(page, await ledgerFixture({ orders: 1 }));
  await openScreen(page, '設定');
  await page.getByLabel('営業日').fill('2026-11-08');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await openScreen(page, '注文履歴');
  await expect(rows(page)).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: '表示する日' })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole('button', { name: '表示条件の注文をCSVで保存' }),
  ).toBeDisabled();
  await openScreen(page, '設定');
  await page.getByLabel('営業日', { exact: true }).fill('2026-11-07');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await openScreen(page, '注文履歴');
  await expect(rows(page)).toHaveCount(1);
});
