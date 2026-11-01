import { expect, test, type Page } from '@playwright/test';
import {
  addSkewers,
  freeTicketCount,
  completeButton,
  ledgerFixture,
  openFixture,
  openScreen,
  pay,
  refundNewest,
} from './helpers';

/** Paid orders waiting for handoff, each on its own ticket. */
const queue = (orders: number) =>
  ledgerFixture({
    orders,
    waiting: orders,
    now: '2026-11-07T03:04:05.000Z',
    received: (index) => (index === 0 ? 1000 : 500),
  });

/** Sells one もも for the exact amount. */
async function sell(page: Page) {
  await addSkewers(page, 'もも');
  await page.getByRole('button', { name: '会計へ', exact: true }).click();
  await page.getByRole('button', { name: 'ちょうど', exact: true }).click();
  await page.getByRole('button', { name: 'お釣りを確認', exact: true }).click();
  await page.getByRole('button', { name: '会計を確定', exact: true }).click();
}

// The app ignores a second handoff within this window (see Waiting.tsx).
const HANDOFF_GUARD_MS = 500;

test('同じ位置を150ms間隔で二度押しても一件だけ完了し、次の明示操作は進められる', async ({
  page,
}) => {
  await openFixture(page, await queue(3));
  const first = (await completeButton(page).first().boundingBox())!;
  const x = first.x + first.width / 2;
  const y = first.y + first.height / 2;
  await page.mouse.click(x, y);
  await page.waitForTimeout(150);
  await page.mouse.click(x, y);
  await expect(page.getByTestId('waiting-order')).toHaveCount(2);
  await page.waitForTimeout(HANDOFF_GUARD_MS);
  await completeButton(page).first().click();
  await expect(page.getByTestId('waiting-order')).toHaveCount(1);
  await page.getByRole('button', { name: '元に戻す', exact: true }).click();
  await expect(page.getByTestId('waiting-order')).toHaveCount(2);
});

test('Enterの連続入力でも一件だけ完了し、次の札へフォーカスすると続けられる', async ({
  page,
}) => {
  await openFixture(page, await queue(3));
  await completeButton(page).first().focus();
  await page.keyboard.down('Enter');
  await page.waitForTimeout(150);
  await page.keyboard.down('Enter');
  await page.keyboard.up('Enter');
  await expect(page.getByTestId('waiting-order')).toHaveCount(2);
  await page.waitForTimeout(HANDOFF_GUARD_MS);
  await completeButton(page).first().focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('waiting-order')).toHaveCount(1);
});

test('受け渡しは1回で記録して入力中の注文と位置を保ち、札が再利用されるまで元に戻せる', async ({
  page,
}) => {
  await openFixture(page, await queue(1));
  await addSkewers(page, 'ねぎま');
  const before = await page.locator('.checkout').boundingBox();
  await page.evaluate(() => {
    const observed: string[] = [];
    Object.defineProperty(window, '__unexpectedRecovery', { value: observed });
    new MutationObserver(() => {
      if (document.querySelector('.recovery')) observed.push('unexpected');
    }).observe(document.body, { childList: true, subtree: true });
  });
  await completeButton(page).click();
  await expect(page.getByTestId('waiting-order')).toHaveCount(0);
  await expect(page.getByTestId('unreturned')).toHaveCount(0);
  await expect(page.getByLabel('ねぎまの本数')).toHaveValue('1');
  await expect.poll(() => freeTicketCount(page)).toBe(20);
  const after = await page.locator('.checkout').boundingBox();
  expect(Math.abs(after!.y - before!.y)).toBeLessThan(1);
  expect(Math.abs(after!.height - before!.height)).toBeLessThan(1);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __unexpectedRecovery: string[] })
          .__unexpectedRecovery,
    ),
  ).toEqual([]);

  const undo = page
    .locator('.waiting-undo-slot')
    .getByRole('button', { name: '元に戻す', exact: true });
  await undo.click();
  await expect(page.getByTestId('waiting-order')).toHaveCount(1);
  await expect(page.getByLabel('ねぎまの本数')).toHaveValue('1');

  await page.waitForTimeout(HANDOFF_GUARD_MS);
  await completeButton(page).click();
  await expect(page.getByTestId('waiting-order')).toHaveCount(0);
  await pay(page, '500');
  await undo.click();
  await expect(
    page.getByRole('dialog', { name: '元に戻せません' }),
  ).toContainText('この札は既に再利用されています。完了を取り消せません。');
});

test('札検索欄を表示せず、完了後も別の札が同じ位置へ現れない', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await openFixture(page, await queue(12));
  const list = (await page.locator('.waiting-list').boundingBox())!;
  const bounds = await Promise.all(
    (await page.getByTestId('waiting-order').all()).map((row) =>
      row.boundingBox(),
    ),
  );
  expect(
    bounds.filter(
      (row) =>
        row && row.y >= list.y && row.y + row.height <= list.y + list.height,
    ).length,
  ).toBeGreaterThanOrEqual(6);
  await expect(page.getByLabel('待ち注文の札番号')).toHaveCount(0);
  await page
    .getByTestId('waiting-order')
    .last()
    .getByRole('button', { name: '受け渡し完了（札も回収）' })
    .click();
  await expect(page.getByTestId('waiting-order')).toHaveCount(11);
});

test('保存に時間がかかっても完了直後の再クリックで次の札を完了しない', async ({
  page,
}) => {
  await openFixture(page, await queue(3));
  // Keep the write lock until the test releases it, so the delay starts after
  // the click rather than expiring while Playwright waits for actionability.
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('yakitoriningen-v1');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const tx = database.transaction('meta', 'readwrite');
          let held = true;
          (
            window as unknown as { releaseHandoffLock: () => void }
          ).releaseHandoffLock = () => {
            held = false;
          };
          const keepAlive = () => {
            const read = tx.objectStore('meta').get('main');
            read.onsuccess = () => {
              if (held) keepAlive();
            };
          };
          keepAlive();
          tx.oncomplete = () => database.close();
          resolve();
        };
      }),
  );
  await completeButton(page).first().click();
  await expect(page.locator('.app-content')).toHaveAttribute(
    'aria-busy',
    'true',
  );
  await page.waitForTimeout(650);
  await expect(page.getByTestId('waiting-order')).toHaveCount(3);
  await page.evaluate(() =>
    (
      window as unknown as { releaseHandoffLock: () => void }
    ).releaseHandoffLock(),
  );
  await expect(page.getByTestId('waiting-order')).toHaveCount(2);
  await expect(completeButton(page).first()).toBeEnabled();
  // Do not let the count assertion succeed before an erroneous second write
  // has had time to commit. DOM click avoids another actionability wait here.
  await completeButton(page)
    .first()
    .evaluate((button: HTMLButtonElement) => button.click());
  await page.waitForTimeout(550);
  await expect(page.getByTestId('waiting-order')).toHaveCount(2);
  await completeButton(page).first().click();
  await expect(page.getByTestId('waiting-order')).toHaveCount(1);
});

test('30商品の注文でも数量と商品IDが干渉せず、受け渡し後も一覧の高さが変わらない', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const items = Array.from({ length: 30 }, (_, index) => ({
    id: `item-${index}`,
    name: `商品${index + 1}`,
    price: 100,
    discountPrice: 50,
  }));
  await openFixture(
    page,
    await ledgerFixture({ price: { items, bundleEnabled: false } }),
  );
  for (const item of items) await addSkewers(page, item.name);
  await expect(page.getByTestId('total')).toHaveText('￥3,000');
  await pay(page, '5000');
  await expect(page.getByTestId('waiting-order')).toContainText(/商品30\s*1本/);
  await addSkewers(page, '商品1');
  await pay(page, '5000');
  const totals = page.locator('.waiting-totals');
  const list = page.locator('.waiting-list');
  const before = [await totals.boundingBox(), await list.boundingBox()];
  await completeButton(page).first().click();
  await expect(page.getByTestId('waiting-order')).toHaveCount(1);
  const after = [await totals.boundingBox(), await list.boundingBox()];
  for (let index = 0; index < 2; index++)
    expect(Math.abs(before[index]!.height - after[index]!.height)).toBeLessThan(
      1,
    );
});

test('返金後の札は実物を回収したときだけ空きに戻し、二度押しで別の札を回収しない', async ({
  page,
}) => {
  await openFixture(page, await ledgerFixture());
  const result = page.getByRole('dialog', { name: '返金を記録しました' });

  // Collected right after the refund.
  await sell(page);
  await refundNewest(page);
  await expect(result).toContainText('札 1');
  await result.getByRole('button', { name: '札を回収した' }).click();
  await openScreen(page, '会計');
  await expect.poll(() => freeTicketCount(page)).toBe(20);
  await expect(page.getByRole('button', { name: /札の回収待ち/ })).toHaveCount(
    0,
  );

  // Already collected at handoff: no second request.
  await sell(page);
  await completeButton(page).click();
  await refundNewest(page);
  await expect(result).toHaveCount(0);
  await expect(page.getByRole('table').locator('tbody tr')).not.toHaveCount(0);

  // Two tickets collected later from the list.
  await openScreen(page, '会計');
  await sell(page);
  await sell(page);
  for (let i = 0; i < 2; i++) {
    await refundNewest(page);
    await result.getByRole('button', { name: 'あとで回収する' }).click();
  }
  await openScreen(page, '会計');
  await page
    .getByRole('button', { name: '札の回収待ち 2', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: '札の回収待ち' });
  const first = dialog.getByRole('button', { name: '札1を回収した' });
  const second = dialog.getByRole('button', { name: '札2を回収した' });
  await expect(first).toHaveText('回収');
  const before = await second.boundingBox();
  const box = (await first.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, {
    clickCount: 2,
    delay: 150,
  });
  await expect(first).toBeDisabled();
  await expect(second).toBeEnabled();
  expect(Math.abs((await second.boundingBox())!.y - before!.y)).toBeLessThan(1);
  await expect.poll(() => freeTicketCount(page)).toBe(19);
});

test('札を後で回収する場合も一覧を狭めず、回収の保存に失敗しても空きを増やさない', async ({
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
  await openFixture(page, await ledgerFixture());
  for (let i = 0; i < 10; i++) await sell(page);
  const before = await page.locator('.waiting-list').boundingBox();
  await refundNewest(page);
  const result = page.getByRole('dialog', { name: '返金を記録しました' });
  await expect(result).toContainText('札 10');
  await result.getByRole('button', { name: 'あとで回収する' }).click();
  await openScreen(page, '会計');
  const after = await page.locator('.waiting-list').boundingBox();
  expect(after!.height).toBeGreaterThanOrEqual(before!.height - 1);
  await expect.poll(() => freeTicketCount(page)).toBe(10);
  await page
    .getByRole('button', { name: '札の回収待ち 1', exact: true })
    .click();
  const recovery = page.getByRole('dialog', { name: '札の回収待ち' });
  await expect(recovery).toContainText('札 10');
  await page.evaluate(() => {
    (window as Window & { failNextTicketWrite?: boolean }).failNextTicketWrite =
      true;
  });
  const collect = recovery.getByRole('button', { name: '札10を回収した' });
  await collect.click();
  await expect(recovery.getByRole('alert')).toContainText(
    '空き容量がありません',
  );
  await expect.poll(() => freeTicketCount(page)).toBe(10);
  await collect.click();
  await expect.poll(() => freeTicketCount(page)).toBe(11);
});
