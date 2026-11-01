import 'fake-indexeddb/auto';
import { test, expect, type Page } from '@playwright/test';
import { CashierCommands } from '../../src/application/cashier-commands';
import { Database } from '../../src/storage/database';
import { DexieLedgerRepository } from '../../src/storage/ledger-repository';
import { newId } from '../../src/lib/id';
import { openFixture } from './fixtures';

async function queueFixture(count: number, reused = false) {
  const database = new Database(`handoff-fixture-${newId()}`);
  const cashier = new CashierCommands(
    new DexieLedgerRepository(database),
    newId,
    () => '2026-11-07T03:04:05.000Z',
  );
  try {
    const context = await cashier.initialize('受け渡し試験', '2026-11-07', 20);
    const price = (await cashier.read())!.prices[0];
    for (let index = 0; index < count; index++) {
      const orderId = newId();
      const assignmentId = newId();
      const confirmOperationId = newId();
      const execute = async (
        command: Parameters<typeof cashier.prepare>[2],
        id = newId(),
      ) => {
        await cashier.prepare(id, context, command);
        await cashier.execute(id, context);
      };
      await execute({
        type: 'reserve',
        orderId,
        assignmentId,
        confirmOperationId,
        quantities: { momo: 1 },
        price,
      });
      await execute(
        {
          type: 'pay',
          orderId,
          assignmentId,
          received: index === 0 ? 1000 : 500,
        },
        confirmOperationId,
      );
      if (reused) await execute({ type: 'complete', orderId, assignmentId });
    }
    return (await cashier.read())!;
  } finally {
    await database.delete();
  }
}

const complete = (page: Page) =>
  page
    .getByTestId('waiting-order')
    .getByRole('button', { name: '受け渡し完了（札も回収）', exact: true });

test('同じ位置を150ms間隔で二度押しても一件だけ完了し、次の明示操作は進められる', async ({
  page,
}) => {
  await openFixture(page, await queueFixture(3));
  const secondBefore = await page
    .getByTestId('waiting-order')
    .nth(1)
    .boundingBox();
  const first = await complete(page).first().boundingBox();
  const x = first!.x + first!.width / 2;
  const y = first!.y + first!.height / 2;
  await page.mouse.click(x, y);
  await page.waitForTimeout(150);
  await page.mouse.click(x, y);
  await expect(page.getByTestId('waiting-order')).toHaveCount(2);
  const secondAfter = await page
    .getByTestId('waiting-order')
    .first()
    .boundingBox();
  expect(Math.abs(secondAfter!.y - secondBefore!.y)).toBeLessThan(1);
  await complete(page).first().click();
  await expect(page.getByTestId('waiting-order')).toHaveCount(1);
  await page.getByRole('button', { name: '元に戻す', exact: true }).click();
  await expect(page.getByTestId('waiting-order')).toHaveCount(2);
});

test('Enterの連続入力でも一件だけ完了し、次の札へフォーカスすると続けられる', async ({
  page,
}) => {
  await openFixture(page, await queueFixture(3));
  await complete(page).first().focus();
  await page.keyboard.down('Enter');
  await page.waitForTimeout(150);
  await page.keyboard.down('Enter');
  await page.keyboard.up('Enter');
  await expect(page.getByTestId('waiting-order')).toHaveCount(2);
  await complete(page).first().focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('waiting-order')).toHaveCount(1);
});

test('札を再利用すると完了を戻せない理由が分かる', async ({ page }) => {
  await openFixture(page, await queueFixture(1));
  await complete(page).click();
  await page.getByRole('button', { name: 'ももを1本増やす' }).click();
  await page.getByRole('button', { name: '会計へ', exact: true }).click();
  await page.getByLabel('お預かり金額').fill('500');
  await page.getByRole('button', { name: 'お釣りを確認', exact: true }).click();
  await page.getByRole('button', { name: '会計を確定', exact: true }).click();
  const feedback = page.locator('.waiting-undo-slot');
  await feedback.getByRole('button', { name: '元に戻す', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: '元に戻せません' }),
  ).toContainText('この札は既に再利用されています。完了を取り消せません。');
});

test('同じ秒・札・商品・金額の会計を詳細で区別し、同じ情報を見て返金できる', async ({
  page,
}) => {
  const snapshot = await queueFixture(2, true);
  await openFixture(page, snapshot);
  await page.getByRole('button', { name: '注文履歴', exact: true }).click();
  const rows = page.getByRole('table').locator('tbody tr');
  const receipts: string[] = [];
  const amounts: string[] = [];
  for (let index = 0; index < 2; index++) {
    await rows
      .nth(index)
      .getByRole('button', { name: '注文の詳細', exact: true })
      .click();
    const details = page.getByRole('dialog', {
      name: '注文の詳細',
      exact: true,
    });
    const summary = details.getByTestId('order-details');
    await expect(summary).toContainText('12:04:05');
    await expect(summary).toContainText('受け渡し済み');
    await expect(summary).toContainText('札 1');
    receipts.push((await summary.getByTestId('receipt-number').textContent())!);
    amounts.push((await summary.getByTestId('received-amount').textContent())!);
    const before = await summary.innerText();
    for (const order of snapshot.orders) expect(before).not.toContain(order.id);
    await details
      .getByRole('button', { name: '全額返金', exact: true })
      .click();
    const refund = page.getByRole('dialog', { name: '全額返金', exact: true });
    await expect(refund.getByTestId('order-details')).toHaveText(before, {
      useInnerText: true,
    });
    await refund.getByRole('button', { name: '戻る', exact: true }).click();
  }
  expect(new Set(receipts).size).toBe(2);
  expect(amounts.sort()).toEqual(['￥1,000', '￥500'].sort());
});

test('混雑中は札番号へ絞り込み、完了後も別の札が同じ位置へ現れない', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await openFixture(page, await queueFixture(12));
  const list = await page.locator('.waiting-list').boundingBox();
  const rows = await page.getByTestId('waiting-order').all();
  const bounds = await Promise.all(rows.map((row) => row.boundingBox()));
  expect(
    bounds.filter(
      (row) =>
        row && row.y >= list!.y && row.y + row.height <= list!.y + list!.height,
    ).length,
  ).toBeGreaterThanOrEqual(6);
  await page.getByLabel('待ち注文の札番号').fill('12');
  await expect(page.getByTestId('waiting-order')).toHaveCount(1);
  await expect(page.getByTestId('waiting-order')).toContainText('12');
  await complete(page).click();
  await expect(page.getByTestId('waiting-order')).toHaveCount(0);
  await expect(page.getByLabel('待ち注文の札番号')).toHaveValue('12');
  await page.getByLabel('待ち注文の札番号').fill('');
  await expect(page.getByTestId('waiting-order')).toHaveCount(11);
});
