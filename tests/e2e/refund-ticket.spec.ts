import { test, expect, type Page } from '@playwright/test';
import { historyFixture, openFixture } from './fixtures';

async function sell(page: Page) {
  await page.getByRole('button', { name: 'ももを1本増やす' }).click();
  await page.getByRole('button', { name: '会計へ', exact: true }).click();
  await page.getByRole('button', { name: 'ちょうど', exact: true }).click();
  await page.getByRole('button', { name: 'お釣りを確認', exact: true }).click();
  await page.getByRole('button', { name: '会計を確定', exact: true }).click();
}

async function refundFirst(page: Page) {
  await page.getByRole('button', { name: '注文履歴', exact: true }).click();
  await page
    .getByRole('button', { name: '全額返金', exact: true })
    .first()
    .click();
  const dialog = page.getByRole('dialog', { name: '全額返金', exact: true });
  await dialog.getByLabel('取消理由').fill('注文間違い');
  await dialog.getByRole('button', { name: '返金を始める' }).click();
  await dialog.getByLabel('全額返金し、現金を確認しました').check();
  await dialog.getByRole('button', { name: '返金を記録' }).click();
}

test('返金後に実際の札を回収した場合だけ空きに戻す', async ({ page }) => {
  await openFixture(page, await historyFixture(0));
  await sell(page);
  await refundFirst(page);
  const result = page.getByRole('dialog', {
    name: '返金を記録しました',
    exact: true,
  });
  await expect(result).toContainText('札 1');
  await page.screenshot({ path: 'test-results/refund-ticket-confirm.png' });
  await result
    .getByRole('button', { name: '札を回収した', exact: true })
    .click();
  await page.getByRole('button', { name: '会計', exact: true }).click();
  await expect(page.locator('.ticket-availability')).toContainText('空き 20');
  await expect(page.getByRole('button', { name: /札の回収待ち/ })).toHaveCount(
    0,
  );
});

test('札を後で回収する場合も混雑中の注文一覧を狭めず確認できる', async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => {
    const original = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (
      ...args: Parameters<IDBDatabase['transaction']>
    ) {
      const state = window as Window & { failNextTicketWrite?: boolean };
      if (state.failNextTicketWrite && args[1] === 'readwrite') {
        state.failNextTicketWrite = false;
        throw new DOMException('模擬保存失敗', 'QuotaExceededError');
      }
      return original.apply(this, args);
    };
  });
  await openFixture(page, await historyFixture(0));
  for (let i = 0; i < 10; i++) await sell(page);
  const before = await page.locator('.waiting-list').boundingBox();
  await refundFirst(page);
  const result = page.getByRole('dialog', {
    name: '返金を記録しました',
    exact: true,
  });
  await expect(result).toContainText('札 10');
  await result
    .getByRole('button', { name: 'あとで回収する', exact: true })
    .click();
  await page.getByRole('button', { name: '会計', exact: true }).click();
  const after = await page.locator('.waiting-list').boundingBox();
  expect(after!.height).toBeGreaterThanOrEqual(before!.height - 1);
  await expect(page.locator('.ticket-availability')).toContainText('空き 10');
  await page
    .getByRole('button', { name: '札の回収待ち 1', exact: true })
    .click();
  const recovery = page.getByRole('dialog', {
    name: '札の回収待ち',
    exact: true,
  });
  await expect(recovery).toContainText('札 10');
  await page.screenshot({ path: 'test-results/ticket-recovery.png' });
  await page.evaluate(() => {
    (window as Window & { failNextTicketWrite?: boolean }).failNextTicketWrite =
      true;
  });
  await recovery
    .getByRole('button', { name: '札10を回収した', exact: true })
    .click();
  await expect(recovery.getByRole('alert')).toContainText(
    '空き容量がありません',
  );
  await expect(page.locator('.ticket-availability')).toContainText('空き 10');
  await recovery
    .getByRole('button', { name: '札10を回収した', exact: true })
    .click();
  await expect(page.locator('.ticket-availability')).toContainText('空き 11');
});

test('すでに回収済みの札は返金後に再度回収を求めない', async ({ page }) => {
  await openFixture(page, await historyFixture(0));
  await sell(page);
  await page
    .getByRole('button', { name: '受け渡し完了（札も回収）', exact: true })
    .click();
  await refundFirst(page);
  await expect(
    page.getByRole('dialog', { name: '返金を記録しました', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole('table').locator('tbody tr')).not.toHaveCount(0);
});

test('回収待ちが複数あるとき二度押ししても別の札を回収しない', async ({
  page,
}) => {
  await openFixture(page, await historyFixture(0));
  await sell(page);
  await sell(page);
  for (let i = 0; i < 2; i++) {
    await refundFirst(page);
    await page
      .getByRole('dialog', { name: '返金を記録しました' })
      .getByRole('button', { name: 'あとで回収する' })
      .click();
  }
  await page.getByRole('button', { name: '会計', exact: true }).click();
  await page
    .getByRole('button', { name: '札の回収待ち 2', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: '札の回収待ち' });
  const first = dialog.getByRole('button', { name: '札1を回収した' });
  const second = dialog.getByRole('button', { name: '札2を回収した' });
  await expect(first).toHaveText('回収');
  const before = await second.boundingBox();
  const box = await first.boundingBox();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2, {
    clickCount: 2,
    delay: 150,
  });
  await expect(first).toBeDisabled();
  await expect(second).toBeEnabled();
  expect(Math.abs((await second.boundingBox())!.y - before!.y)).toBeLessThan(1);
  await expect(page.locator('.ticket-availability')).toContainText('空き 19');
});
