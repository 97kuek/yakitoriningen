import { expect, test } from '@playwright/test';
import { ledgerFixture, openFixture, openScreen, rows } from './helpers';

test('履歴の行と会計番号から詳細を開き、閉じると会計番号へ戻る', async ({
  page,
}) => {
  await openFixture(page, await ledgerFixture({ orders: 1 }));
  await openScreen(page, '注文履歴');
  const row = rows(page).first();
  const trigger = row.getByRole('button', { name: '注文の詳細', exact: true });
  await expect(trigger).toHaveText(/No\./);
  await expect(row.getByText('詳細', { exact: true })).toHaveCount(0);
  await row.locator('td').nth(3).click();
  const details = page.getByRole('dialog', { name: '注文の詳細', exact: true });
  await expect(details).toBeVisible();
  await details
    .getByRole('button', { name: '閉じる', exact: true })
    .first()
    .click();
  await expect(trigger).toBeFocused();
  await trigger.press('Enter');
  await expect(details).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  const refund = row.getByRole('button', { name: '全額返金', exact: true });
  await refund.click();
  await expect(
    page.getByRole('dialog', { name: '全額返金', exact: true }),
  ).toBeVisible();
  await expect(details).not.toBeVisible();
  await page
    .getByRole('dialog', { name: '全額返金', exact: true })
    .getByRole('button', { name: '戻る', exact: true })
    .click();
  await expect(refund).toBeFocused();
  await expect(
    page.getByRole('button', { name: '表示条件の注文をCSVで保存' }),
  ).toHaveAttribute('title', '注文履歴（.csv）を保存');
});
