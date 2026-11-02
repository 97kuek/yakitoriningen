import { expect, test } from '@playwright/test';
import { ledgerFixture, openFixture, openScreen } from './helpers';

test('札検索は数字だけを受け付け、文字や記号を混ぜない', async ({ page }) => {
  await openFixture(page, await ledgerFixture({ orders: 1 }));
  await openScreen(page, '注文履歴');
  const ticket = page.getByLabel('札番号で検索');
  await expect(ticket).toHaveAttribute('type', 'text');
  await expect(ticket).toHaveAttribute('inputmode', 'numeric');
  await ticket.pressSequentially('1e+-.a');
  await expect(ticket).toHaveValue('1');
  await ticket.fill('2x');
  await expect(ticket).toHaveValue('1');
  await ticket.evaluate((element) => {
    const clipboard = new DataTransfer();
    clipboard.setData('text', '4abc');
    const event = new ClipboardEvent('paste', {
      clipboardData: clipboard,
      cancelable: true,
      bubbles: true,
    });
    if (element.dispatchEvent(event))
      throw new Error('Invalid paste was not prevented');
  });
  await expect(ticket).toHaveValue('1');
  await ticket.fill('１２');
  await expect(ticket).toHaveValue('12');
  await ticket.fill('');
  await expect(ticket).toHaveValue('');
});

test('価格・在庫・札枚数は空欄と0を区別し、範囲外を保存しない', async ({
  page,
}) => {
  await openFixture(page, await ledgerFixture());
  await openScreen(page, '設定');
  const price = page.getByLabel('ももの通常価格（円）');
  const stock = page.getByLabel('ももの在庫', { exact: true });
  const tickets = page.getByLabel('番号札の枚数');
  for (const field of [
    price,
    stock,
    tickets,
    page.getByLabel('セットの本数', { exact: true }),
  ]) {
    await expect(field).toHaveAttribute('type', 'text');
    await expect(field).toHaveAttribute('inputmode', 'numeric');
  }
  await price.fill('');
  const save = page.getByRole('button', { name: '変更を保存', exact: true });
  await save.click();
  await expect(price).toBeFocused();
  await expect(price).toHaveValue('');
  await price.fill('100000001');
  await save.click();
  await expect(price).toBeFocused();
  expect(
    await price.evaluate((element: HTMLInputElement) => element.validity.valid),
  ).toBe(false);
  await price.fill('0');
  await stock.fill('');
  await save.click();
  await expect(
    page.getByText('保存しました。', { exact: true }).first(),
  ).toBeVisible();
  await expect(price).toHaveValue('0');
  await tickets.fill('0');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(tickets).toHaveValue('0');
  expect(
    await tickets.evaluate(
      (element: HTMLInputElement) => element.validity.valid,
    ),
  ).toBe(false);
  await tickets.fill('21');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '保存', exact: true }),
  ).toHaveCount(0);
});
