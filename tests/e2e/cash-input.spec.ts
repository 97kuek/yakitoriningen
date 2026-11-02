import { expect, test } from '@playwright/test';
import { addSkewers, ledgerFixture, openFixture, openScreen } from './helpers';

test('金額ボタンは不足額からも加算でき、連打と手入力・ちょうどを組み合わせられる', async ({
  page,
}) => {
  await openFixture(page, await ledgerFixture());
  await addSkewers(page, 'もも');
  await page.getByRole('button', { name: '会計へ', exact: true }).click();
  const received = page.getByLabel('お預かり金額');
  const add = (name: string) => page.getByRole('button', { name, exact: true });

  await add('＋100').click();
  await expect(received).toHaveValue('100');
  await expect(
    page.getByRole('button', { name: 'お釣りを確認' }),
  ).toBeDisabled();
  await add('＋100').dblclick();
  await expect(received).toHaveValue('300');
  await add('＋500').click();
  await expect(received).toHaveValue('800');
  await add('＋1,000').click();
  await expect(received).toHaveValue('1800');
  await add('＋5,000').click();
  await expect(received).toHaveValue('6800');
  await add('＋10,000').click();
  await expect(received).toHaveValue('16800');
  await received.fill('200');
  await add('＋500').click();
  await expect(received).toHaveValue('700');
  await add('ちょうど').click();
  await expect(received).toHaveValue('150');
  await add('＋100').click();
  await expect(received).toHaveValue('250');

  await openScreen(page, '注文履歴');
  await openScreen(page, '会計');
  await expect(received).toHaveValue('250');
  await add('＋500').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('change')).toHaveText('￥100');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: '入金額を修正', exact: true }).click();
  await received.fill('250');
  await add('＋500').click();
  await expect(received).toHaveValue('750');
});

test('加算は金額上限を超えず、不正な手入力を上書きしない', async ({ page }) => {
  await openFixture(page, await ledgerFixture());
  await addSkewers(page, 'もも');
  await page.getByRole('button', { name: '会計へ', exact: true }).click();
  const received = page.getByLabel('お預かり金額');
  const hundred = page.getByRole('button', { name: '＋100', exact: true });
  const check = page.getByRole('button', { name: 'お釣りを確認' });

  await received.fill('99999900');
  await expect(
    page.getByRole('button', { name: '＋500', exact: true }),
  ).toBeDisabled();
  await hundred.click();
  await expect(received).toHaveValue('100000000');
  await expect(hundred).toBeDisabled();
  await expect(check).toBeEnabled();

  for (const invalid of ['-1', '1.5', '100000001']) {
    await received.fill(invalid);
    await expect(hundred).toBeDisabled();
    await expect(check).toBeDisabled();
    await expect(received).toHaveValue(invalid);
  }
  await received.fill('');
  await received.press('e');
  expect(
    await received.evaluate(
      (input: HTMLInputElement) => input.validity.badInput,
    ),
  ).toBe(true);
  await hundred.click();
  expect(
    await received.evaluate(
      (input: HTMLInputElement) => input.validity.badInput,
    ),
  ).toBe(true);
  await expect(check).toBeDisabled();
  await received.fill('');
  await hundred.click();
  await expect(received).toHaveValue('100');
});
