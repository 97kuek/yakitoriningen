import { expect, test } from '@playwright/test';
import { historyFixture, openFixture } from './fixtures';

test('お預かり入力は履歴と設定を往復しても残り、次の注文へ持ち越さない', async ({
  page,
}) => {
  await openFixture(page, await historyFixture(0));
  await page.getByRole('button', { name: 'ももを1本増やす' }).click();
  await page.getByRole('button', { name: '会計へ', exact: true }).click();
  await page.getByLabel('お預かり金額').fill('1000');
  for (const name of ['注文履歴', '設定']) {
    await page.getByRole('button', { name, exact: true }).click();
    await page.getByRole('button', { name: '会計', exact: true }).click();
    await expect(page.getByLabel('お預かり金額')).toHaveValue('1000');
  }
  await page.getByRole('button', { name: 'お釣りを確認' }).click();
  await expect(page.getByTestId('change')).toHaveText('￥850');
  await page.getByRole('button', { name: '会計を確定' }).click();
  await page.getByRole('button', { name: 'ももを1本増やす' }).click();
  await page.getByRole('button', { name: '会計へ', exact: true }).click();
  await expect(page.getByLabel('お預かり金額')).toHaveValue('');
});

test('空欄の価格は保存できず、明示した0円は保存できる', async ({ page }) => {
  await openFixture(page, await historyFixture(0));
  await page.getByRole('button', { name: '設定', exact: true }).click();
  const price = page.getByLabel('ももの通常価格（円）');
  await price.fill('');
  await expect(price).toHaveValue('');
  await page.getByRole('button', { name: '変更を保存' }).click();
  await expect(price).toBeFocused();
  await page.getByRole('button', { name: '会計', exact: true }).click();
  await page.getByRole('button', { name: 'ももを1本増やす' }).click();
  await expect(page.getByTestId('total')).toHaveText('￥150');
  await page.getByRole('button', { name: '注文をクリア' }).click();
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await price.fill('0');
  await page.getByRole('button', { name: '変更を保存' }).click();
  await expect(page.getByText('保存しました。', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '会計', exact: true }).click();
  await page.getByRole('button', { name: 'ももを1本増やす' }).click();
  await expect(page.getByTestId('total')).toHaveText('￥0');
});

test('未保存の商品編集は再読み込み前に確認し、保存後は確認しない', async ({
  page,
}) => {
  await openFixture(page, await historyFixture(0));
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByLabel('商品1の名前').fill('炭火もも');
  // Dispatch the same cancelable event used by navigation, without losing the test page on failure.
  const blocked = () =>
    page.evaluate(
      () =>
        !window.dispatchEvent(new Event('beforeunload', { cancelable: true })),
    );
  await expect.poll(blocked).toBe(true);
  await page.getByRole('button', { name: '会計', exact: true }).click();
  await expect.poll(blocked).toBe(true);
  const prompt = page.waitForEvent('dialog');
  const reloading = page.evaluate(() => window.location.reload());
  const dialog = await prompt;
  expect(dialog.type()).toBe('beforeunload');
  await dialog.dismiss();
  await reloading;
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await expect(page.getByLabel('商品1の名前')).toHaveValue('炭火もも');
  await page.getByRole('button', { name: '変更を保存' }).click();
  await expect.poll(blocked).toBe(false);
});

test('販売価格を切り替えても商品編集欄は動かない', async ({ page }) => {
  await page.setViewportSize({ width: 834, height: 827 });
  await openFixture(page, await historyFixture(0));
  await page.getByRole('button', { name: '設定', exact: true }).click();
  const heading = page.getByRole('heading', { name: '商品・セットの編集' });
  const before = (await heading.boundingBox())!;
  await page.getByRole('button', { name: '値下げ価格に切り替える' }).click();
  await expect(
    page.getByText('販売中：値下げ価格', { exact: true }),
  ).toBeVisible();
  const after = (await heading.boundingBox())!;
  expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(1);
});

test('経費を保存すると先頭の0があっても未保存の確認を解除する', async ({
  page,
}) => {
  await openFixture(page, await historyFixture(0));
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByRole('button', { name: '経費', exact: true }).click();
  await page.getByLabel('開催回全体の経費（円）').fill('00100');
  const blocked = () =>
    page.evaluate(
      () =>
        !window.dispatchEvent(new Event('beforeunload', { cancelable: true })),
    );
  await expect.poll(blocked).toBe(true);
  await page.getByRole('button', { name: '経費を保存', exact: true }).click();
  await expect(
    page.getByText('経費を保存しました。', { exact: true }),
  ).toBeVisible();
  await expect.poll(blocked).toBe(false);
});
