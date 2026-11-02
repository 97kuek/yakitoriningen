import { expect, test } from '@playwright/test';
import { addSkewers, ledgerFixture, openFixture } from './helpers';

test('札の変更後に会計の保存が失敗しても、選んだ札と金額を保持して再試行できる', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (
      ...args: Parameters<IDBDatabase['transaction']>
    ) {
      const state = window as Window & { writesUntilFailure?: number };
      if (
        args[1] === 'readwrite' &&
        state.writesUntilFailure &&
        --state.writesUntilFailure === 0
      )
        throw new DOMException('模擬保存失敗', 'QuotaExceededError');
      return original.apply(this, args);
    };
  });
  await openFixture(page, await ledgerFixture());
  await addSkewers(page, 'もも', 2);
  await page.getByRole('button', { name: '会計へ', exact: true }).click();
  await page.getByLabel('お預かり金額').fill('500');
  await page.getByRole('button', { name: 'お釣りを確認', exact: true }).click();
  await page.getByRole('button', { name: '会計を確定', exact: true }).click();
  const dialog = page.getByRole('dialog', {
    name: '渡す札を確認',
    exact: true,
  });
  await dialog.getByRole('button', { name: '札12を選ぶ', exact: true }).click();
  await page.evaluate(() => {
    // Select-ticket prepare and execute succeed; executing the payment fails.
    (window as Window & { writesUntilFailure?: number }).writesUntilFailure = 3;
  });
  const finish = dialog.getByRole('button', {
    name: 'この札で確定',
    exact: true,
  });
  await finish.click();
  await expect(dialog.getByRole('alert')).toContainText('空き容量がありません');
  await expect(
    dialog.getByRole('button', { name: '札12を選ぶ', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('waiting-order')).toHaveCount(0);
  await finish.click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByTestId('waiting-order')).toHaveCount(1);
  await expect(
    page.getByTestId('waiting-order').locator('.ticket-chip'),
  ).toHaveText('札 12');
});

test('確定ボタンで札確認を開き、閉じても未確定のまま、選んだ札で一度だけ会計する', async ({
  page,
}) => {
  await openFixture(page, await ledgerFixture({ orders: 1, waiting: 1 }));
  await addSkewers(page, 'かわ');
  await page.getByRole('button', { name: '会計へ', exact: true }).click();
  await page.getByLabel('お預かり金額').fill('500');
  await page.getByRole('button', { name: 'お釣りを確認', exact: true }).click();
  await expect(
    page.locator('.payment .section-heading .ticket-chip'),
  ).toHaveCount(0);
  const confirm = page.getByRole('button', { name: '会計を確定', exact: true });
  await confirm.click();
  const dialog = page.getByRole('dialog', {
    name: '渡す札を確認',
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: '札1を選ぶ', exact: true }),
  ).toBeDisabled();
  await expect(
    dialog.getByRole('button', { name: '札2を選ぶ', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByRole('button', { name: '札12を選ぶ', exact: true }).click();
  await dialog.getByRole('button', { name: '閉じる', exact: true }).click();
  await expect(confirm).toBeFocused();
  await expect(page.getByTestId('waiting-order')).toHaveCount(1);
  await expect(page.getByTestId('change')).toHaveText('￥350');
  await confirm.click();
  await expect(
    dialog.getByRole('button', { name: '札2を選ぶ', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByRole('button', { name: '札12を選ぶ', exact: true }).click();
  await dialog
    .getByRole('button', { name: 'この札で確定', exact: true })
    .dblclick();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByTestId('waiting-order')).toHaveCount(2);
  await expect(
    page.getByTestId('waiting-order').last().locator('.ticket-chip'),
  ).toHaveText('札 12');
});

test('Enterで札確認まで進み、長押しでは確定せず、次のEnterで会計を確定する', async ({
  page,
}) => {
  await openFixture(page, await ledgerFixture());
  await addSkewers(page, 'もも');
  await page.keyboard.press('Enter');
  await page.getByLabel('お預かり金額').fill('500');
  await page.keyboard.press('Enter');
  const confirm = page.getByRole('button', { name: '会計を確定', exact: true });
  await expect(confirm).toBeFocused();
  await page.keyboard.down('Enter');
  const dialog = page.getByRole('dialog', {
    name: '渡す札を確認',
    exact: true,
  });
  const finish = dialog.getByRole('button', {
    name: 'この札で確定',
    exact: true,
  });
  await expect(finish).toBeFocused();
  await page.keyboard.down('Enter');
  await page.keyboard.up('Enter');
  await expect(page.getByTestId('waiting-order')).toHaveCount(0);
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('waiting-order')).toHaveCount(1);
  await expect(
    page.getByTestId('waiting-order').locator('.ticket-chip'),
  ).toHaveText('札 1');
});
