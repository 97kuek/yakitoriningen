import { expect, test } from '@playwright/test';
import {
  addSkewers,
  completeButton,
  ledgerFixture,
  loadFixture,
  openFixture,
  pay,
  startCounter,
} from './helpers';

test.setTimeout(10_000);

test('入力中は再読み込みを確認し、再開すると注文を復元する', async ({
  page,
}) => {
  await openFixture(page, await ledgerFixture());
  await addSkewers(page, 'もも', 3);
  const confirm = page.waitForEvent('dialog');
  const reload = page.reload();
  const dialog = await confirm;
  expect(dialog.type()).toBe('beforeunload');
  await dialog.accept();
  await reload;
  await startCounter(page);
  await expect(page.getByLabel('ももの本数', { exact: true })).toHaveValue('3');
  await pay(page);
  await expect(page.getByTestId('waiting-order')).toHaveCount(1);
  await page.reload();
  await startCounter(page);
  await expect(page.getByLabel('ももの本数', { exact: true })).toHaveValue('0');
  await expect(page.getByTestId('waiting-order')).toHaveCount(1);
});

test('札は確定画面でだけ変更でき、同じ番号の再選択後もEnterで確定できる', async ({
  page,
}) => {
  await openFixture(page, await ledgerFixture());
  await expect(page.getByRole('button', { name: '渡す札を選ぶ' })).toHaveCount(
    0,
  );
  await addSkewers(page, 'もも', 2);
  await page.getByRole('button', { name: '会計へ', exact: true }).click();
  await expect(page.getByRole('button', { name: '渡す札を選ぶ' })).toHaveCount(
    0,
  );
  await page.getByLabel('お預かり金額').fill('500');
  await page.getByRole('button', { name: 'お釣りを確認', exact: true }).click();
  const picker = page.getByRole('dialog', { name: '渡す札を選ぶ' });
  for (let i = 0; i < 2; i++) {
    await page
      .getByRole('button', { name: '渡す札を選ぶ', exact: true })
      .click();
    await picker
      .getByRole('button', { name: '札12を選ぶ', exact: true })
      .click();
    await expect(picker).not.toBeVisible();
    await expect(
      page.getByRole('button', { name: '会計を確定', exact: true }),
    ).toBeFocused();
    await expect(page.getByTestId('change')).toHaveText('￥200');
  }
  await page.keyboard.press('Enter');
  await expect(
    page.getByTestId('waiting-order').locator('.ticket-chip'),
  ).toContainText('12');
});

test('未回収の札があれば営業を終了できない', async ({ page }) => {
  await openFixture(page, await ledgerFixture({ orders: 1, waiting: 1 }));
  await page
    .getByRole('button', { name: '今日の営業を終了', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: '今日の営業を終了' });
  await expect(
    dialog.getByText('未回収の札：1', { exact: true }),
  ).toBeVisible();
  const downloading = page.waitForEvent('download');
  await dialog
    .getByRole('button', { name: 'バックアップを保存', exact: true })
    .click();
  await downloading;
  await expect(
    dialog.getByRole('button', { name: '保存を確認して終了' }),
  ).toBeDisabled();
  await dialog.getByRole('button', { name: '閉じる', exact: true }).click();
  await completeButton(page).click();
  await page
    .getByRole('button', { name: '今日の営業を終了', exact: true })
    .click();
  await expect(dialog.getByText('未回収の札：1', { exact: true })).toHaveCount(
    0,
  );
});

test('ダウンロードだけでは保存案内を消さず、保存確認後にだけ解除する', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-11-07T08:00:00Z') });
  await openFixture(page, await ledgerFixture({ orders: 1 }));
  const reminder = page.getByText('本日のバックアップを保存してください。', {
    exact: true,
  });
  await expect(reminder).toBeVisible();
  await page
    .getByRole('button', { name: '今日の営業を終了', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: '今日の営業を終了' });
  const downloading = page.waitForEvent('download');
  await dialog
    .getByRole('button', { name: 'バックアップを保存', exact: true })
    .click();
  await downloading;
  await dialog.getByRole('button', { name: '閉じる', exact: true }).click();
  await expect(reminder).toBeVisible();
  await page
    .getByRole('button', { name: '今日の営業を終了', exact: true })
    .click();
  await dialog.getByRole('button', { name: '保存を確認して終了' }).click();
  await startCounter(page);
  await expect(reminder).toHaveCount(0);
});

test('翌朝は本日の営業準備を主操作にし、前日の記録は日付を確認して開く', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-11-08T01:00:00Z') });
  await loadFixture(page, await ledgerFixture());
  await expect(
    page.getByRole('button', { name: '本日の営業を準備', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '会計を始める', exact: true }).click();
  const confirmation = page.getByRole('dialog', { name: '営業日を確認' });
  await expect(confirmation).toContainText('2026-11-07');
  await confirmation
    .getByRole('button', { name: '閉じる', exact: true })
    .click();
  await page
    .getByRole('button', { name: '本日の営業を準備', exact: true })
    .click();
  await expect(
    page
      .getByRole('dialog', { name: '別の日の営業を準備' })
      .getByLabel('営業日', { exact: true }),
  ).toHaveValue('2026-11-08');
});

test('札の確保直後に再起動しても、一時保存から同じ注文を二重に戻さない', async ({
  page,
}) => {
  await openFixture(page, await ledgerFixture());
  await addSkewers(page, 'もも', 2);
  const cached = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((key) =>
      key.startsWith('yakitori-draft:'),
    )!;
    return { key, value: localStorage.getItem(key)! };
  });
  await page.getByRole('button', { name: '会計へ', exact: true }).click();
  await page.getByLabel('お預かり金額').fill('500');
  // Simulate termination after the reservation committed but before cache removal.
  await page.evaluate(
    ({ key, value }) => localStorage.setItem(key, value),
    cached,
  );
  page.once('dialog', (dialog) => void dialog.accept());
  await page.reload();
  await startCounter(page);
  await page.getByLabel('お預かり金額').fill('500');
  await page.getByRole('button', { name: 'お釣りを確認', exact: true }).click();
  await page.getByRole('button', { name: '会計を確定', exact: true }).click();
  await expect(page.getByTestId('waiting-order')).toHaveCount(1);
  await expect(page.getByLabel('ももの本数', { exact: true })).toHaveValue('0');
});
