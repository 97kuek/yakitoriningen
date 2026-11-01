import { expect, test } from '@playwright/test';
import {
  addSkewers,
  completeButton,
  ledgerFixture,
  openFixture,
  openScreen,
  pay,
  refundNewest,
  startCounter,
  startNewEvent,
} from './helpers';

test('会計・受け渡し・再起動・返金を通しで行い、書込はstrict durabilityを要求する', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = IDBDatabase.prototype.transaction;
    const modes: string[] = [];
    Object.defineProperty(window, '__durabilities', { value: modes });
    IDBDatabase.prototype.transaction = function (stores, mode, options) {
      const tx = original.call(this, stores, mode, options);
      if (mode === 'readwrite') modes.push(tx.durability);
      return tx;
    };
  });
  await startNewEvent(page);
  await addSkewers(page, 'もも', 3);
  await addSkewers(page, 'かわ', 2);
  await expect(page.getByTestId('total')).toHaveText('￥600');
  await pay(page);
  await expect(page.getByTestId('checkout-feedback')).toBeEmpty();
  const order = page.getByTestId('waiting-order').first();
  await expect(order).toContainText(/もも\s*3本/);
  await addSkewers(page, 'ねぎま');
  await completeButton(page).click();
  await expect(page.getByLabel('ねぎまの本数')).toHaveValue('1');
  await expect(page.getByTestId('unreturned')).toHaveCount(0);
  await page.reload();
  await startCounter(page);
  await refundNewest(page, '返金済み');
  await expect(page.getByRole('table')).toContainText('取消');
  const modes = await page.evaluate(
    () => (window as unknown as { __durabilities: string[] }).__durabilities,
  );
  expect(modes.length).toBeGreaterThan(0);
  expect(modes.every((mode) => mode === 'strict')).toBe(true);
});

test('キーボードだけで会計でき、お預かり金額は二重枠を出さず画面を往復しても残る', async ({
  page,
}) => {
  await openFixture(page, await ledgerFixture());
  await page.getByRole('button', { name: 'ももを1本増やす' }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: '会計へ', exact: true }).focus();
  await page.keyboard.press('Enter');
  const received = page.getByLabel('お預かり金額');
  await expect(received).toBeFocused();
  await expect(page.getByLabel('ももの本数')).not.toBeVisible();
  await expect(page.getByTestId('payment-total')).toHaveText('￥150');
  await expect(received).toHaveCSS('outline-style', 'none');
  expect(
    await received.evaluate((input) => {
      const field = input.getBoundingClientRect();
      const frame = input.parentElement!.getBoundingClientRect();
      return (
        field.left >= frame.left &&
        field.right <= frame.right &&
        field.top >= frame.top &&
        field.bottom <= frame.bottom
      );
    }),
  ).toBe(true);
  await received.fill('1000');
  for (const screen of ['注文履歴', '設定'] as const) {
    await openScreen(page, screen);
    await openScreen(page, '会計');
    await expect(received).toHaveValue('1000');
  }
  await received.press('Enter');
  const confirm = page.getByRole('button', { name: '会計を確定', exact: true });
  await expect(confirm).toBeFocused();
  await expect(page.getByTestId('change')).toHaveText('￥850');
  await expect(
    page.getByRole('heading', { name: '受け渡し待ち', exact: false }),
  ).toBeVisible();
  await confirm.press('Enter');
  await expect(page.getByTestId('waiting-order')).toHaveCount(1);
  await addSkewers(page, 'もも');
  await page.getByRole('button', { name: '会計へ', exact: true }).click();
  await expect(received).toHaveValue('');
});

test('お釣り確認と確定は同じ位置にあり、二度押しでは確定せず預かり金を直接直せる', async ({
  page,
}) => {
  await page.setViewportSize({ width: 834, height: 827 });
  let nativeDialogs = 0;
  page.on('dialog', async (dialog) => {
    nativeDialogs++;
    await dialog.dismiss();
  });
  await openFixture(page, await ledgerFixture());
  await addSkewers(page, 'もも');
  await page.getByRole('button', { name: '会計へ', exact: true }).click();
  await page.getByLabel('お預かり金額').fill('1000');
  const check = page.getByRole('button', { name: 'お釣りを確認' });
  const box = (await check.boundingBox())!;
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.click(center.x, center.y);
  const confirm = page.getByRole('button', { name: '会計を確定' });
  await expect(confirm).toBeVisible();
  expect(
    Math.abs((await confirm.boundingBox())!.y - box.y),
  ).toBeLessThanOrEqual(1);
  await page.mouse.click(center.x, center.y, { clickCount: 2 });
  await expect(confirm).toBeVisible();
  await expect(page.getByTestId('waiting-order')).toHaveCount(0);
  await page.getByRole('button', { name: '入金額を修正', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel('お預かり金額', { exact: true }).fill('500');
  await page.getByRole('button', { name: 'お釣りを確認', exact: true }).click();
  await expect(page.getByTestId('change')).toHaveText('￥350');
  await expect(page.getByTestId('waiting-order')).toHaveCount(0);
  await confirm.click();
  await expect(page.getByTestId('waiting-order')).toHaveCount(1);
  expect(nativeDialogs).toBe(0);
});

test('未入金の注文は取り消し・本数修正でき、クリアした注文は元に戻せる', async ({
  page,
}) => {
  await openFixture(page, await ledgerFixture());
  // Cancel before payment: fixed cash shortcuts, separated secondary action.
  await page.getByLabel('ももの本数').fill('6');
  await page.getByRole('button', { name: '会計へ', exact: true }).click();
  await expect(page.locator('.cash-buttons button')).toHaveText([
    'ちょうど',
    '￥500',
    '￥1,000',
    '￥2,000',
    '￥5,000',
    '￥10,000',
  ]);
  await expect(
    page.locator('.cash-buttons').getByRole('button', { name: '￥500' }),
  ).toBeDisabled();
  const primary = (await page
    .getByRole('button', { name: 'お釣りを確認', exact: true })
    .boundingBox())!;
  const cancel = page.getByRole('button', { name: '注文を取り消す' });
  const secondary = (await cancel.boundingBox())!;
  expect(secondary.y - primary.y - primary.height).toBeGreaterThanOrEqual(24);
  await cancel.click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByTestId('total')).toHaveText('￥0');
  await expect(page.locator('.ticket-availability')).toContainText('20');

  // Go back to edit quantities before payment.
  await addSkewers(page, 'もも');
  await page.getByRole('button', { name: '会計へ', exact: true }).click();
  await page.getByRole('button', { name: '戻る', exact: true }).click();
  await expect(page.getByLabel('ももの本数')).toHaveValue('1');
  await addSkewers(page, 'かわ');
  await pay(page);
  await expect(page.getByTestId('waiting-order')).toContainText(/もも\s*1本/);
  await expect(page.getByTestId('waiting-order')).toContainText(/かわ\s*1本/);

  // Clear keeps the original quantities and price until a new entry starts.
  await page.getByLabel('ももの本数').fill('2');
  await page.getByLabel('かわの本数').fill('1');
  await openScreen(page, '設定');
  await page.getByRole('button', { name: '値下げ価格に切り替える' }).click();
  await expect(
    page.getByRole('button', { name: '値下げ価格に切り替える' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await openScreen(page, '会計');
  await page.getByRole('button', { name: '注文をクリア' }).click();
  await expect(page.getByTestId('total')).toHaveText('￥0');
  const undo = page
    .locator('.checkout-feedback')
    .getByRole('button', { name: '元に戻す', exact: true });
  await undo.click();
  await expect(page.getByLabel('ももの本数')).toHaveValue('2');
  await expect(page.getByLabel('かわの本数')).toHaveValue('1');
  await expect(page.getByTestId('total')).toHaveText('￥450');
  await page.getByRole('button', { name: '注文をクリア' }).click();
  await page.getByLabel('ねぎまの本数').fill('1');
  await expect(undo).toHaveCount(0);
  await expect(page.getByTestId('total')).toHaveText('￥50');
  await openScreen(page, '注文履歴');
  await expect(page.getByRole('table')).toContainText('取消');
});

test('低いPC画面では30商品でも商品欄だけがスクロールし、主操作が動かず見える', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 640 });
  const items = Array.from({ length: 30 }, (_, i) => ({
    id: `p${i}`,
    name: `長い商品名称その${i + 1}`,
    price: 150,
    discountPrice: 50,
  }));
  await openFixture(
    page,
    await ledgerFixture({ price: { items, bundleEnabled: false } }),
  );
  const inViewport = async (name: string) => {
    await page.evaluate(() => window.scrollTo(0, 0));
    const box = (await page
      .getByRole('button', { name, exact: true })
      .boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(640);
    return box;
  };
  const before = await inViewport('会計へ');
  await page.getByLabel(`${items[0].name}の本数`, { exact: true }).fill('2');
  await page.getByLabel(`${items[1].name}の本数`, { exact: true }).fill('3');
  expect(Math.abs((await inViewport('会計へ')).y - before.y)).toBeLessThan(1);
  const products = await page
    .locator('.products')
    .evaluate((el) => ({ client: el.clientHeight, scroll: el.scrollHeight }));
  expect(products.scroll).toBeGreaterThan(products.client);
  for (const item of items.slice(2))
    await page.getByLabel(`${item.name}の本数`, { exact: true }).fill('1');
  await expect(page.getByTestId('total')).toHaveText('￥4,950');
  await page.getByRole('button', { name: '会計へ', exact: true }).click();
  await inViewport('お釣りを確認');
  await page.getByLabel('お預かり金額', { exact: true }).fill('5000');
  await page.getByRole('button', { name: 'お釣りを確認', exact: true }).click();
  await inViewport('会計を確定');
  await expect(page.getByTestId('change')).toHaveText('￥50');
});

test('狭い画面でも会計を操作でき横にはみ出さない', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startNewEvent(page);
  await addSkewers(page, 'もも');
  await pay(page, '200');
  await expect(page.getByTestId('waiting-order')).toHaveCount(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test('旧形式の価格：値下げプリセットは単価50円を通常価格にせず戻し、同種セットは案内と金額が一致する', async ({
  page,
}) => {
  await openFixture(
    page,
    await ledgerFixture({
      price: { label: '値下げ', unit: 50, bundleEnabled: false },
    }),
  );
  await openScreen(page, '設定');
  await expect(page.getByLabel('ももの通常価格（円）')).toHaveValue('150');
  await expect(
    page.getByRole('button', { name: '値下げ価格に切り替える' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '通常価格に切り替える' }).click();
  await expect(
    page.getByRole('button', { name: '通常価格に切り替える' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await openScreen(page, '会計');
  await addSkewers(page, 'もも');
  await expect(page.getByTestId('total')).toHaveText('￥150');

  await openFixture(page, await ledgerFixture({ price: { mix: false } }));
  await expect(
    page.getByText('同じ種類でセット', { exact: true }),
  ).toBeVisible();
  await addSkewers(page, 'もも', 3);
  await addSkewers(page, 'かわ', 2);
  await expect(page.getByTestId('total')).toHaveText('￥750');
});
