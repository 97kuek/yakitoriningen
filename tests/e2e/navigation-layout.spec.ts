import { expect, test } from '@playwright/test';
import {
  addSkewers,
  ledgerFixture,
  openFixture,
  openScreen,
  startCounter,
} from './helpers';

test('ロゴからホームへ戻り、中央のホーム操作も入力を残す', async ({ page }) => {
  await page.setViewportSize({ width: 1001, height: 827 });
  await openFixture(page, await ledgerFixture());
  await addSkewers(page, 'もも', 2);
  await page.locator('.brand').click();
  await expect(
    page.getByRole('button', { name: '営業後の集計', exact: true }),
  ).toBeVisible();
  await startCounter(page);
  await expect(page.getByLabel('ももの本数')).toHaveValue('2');
  const nav = page.getByRole('navigation', { name: '画面の切り替え' });
  const home = nav.getByRole('button', { name: 'ホームへ戻る', exact: true });
  await expect(home).toBeVisible();
  const positions = await Promise.all([
    home.boundingBox(),
    nav.getByRole('button', { name: '会計', exact: true }).boundingBox(),
  ]);
  expect(Math.abs(positions[0]!.y - positions[1]!.y)).toBeLessThan(1);
  await home.click();
  await startCounter(page);
  await expect(page.getByLabel('ももの本数')).toHaveValue('2');
});

test('保存済み営業日の選択欄は日付を省略せず読め、再開操作と重ならない', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1001, height: 827 });
  await openFixture(
    page,
    await ledgerFixture({ orders: 2, days: ['2026-11-07', '2026-11-08'] }),
  );
  await openScreen(page, '設定');
  await page
    .getByRole('button', { name: '新しい営業を作る', exact: true })
    .click();
  const dialog = page.getByRole('dialog', {
    name: '新しい営業を作る',
    exact: true,
  });
  const select = dialog.getByRole('combobox', { name: '保存済みの営業日' });
  const textWidth = await select
    .locator('span')
    .evaluate((el) => ({ available: el.clientWidth, needed: el.scrollWidth }));
  const selectBox = (await select.boundingBox())!;
  const resumeBox = (await dialog
    .getByRole('button', { name: 'この日の営業に戻る' })
    .boundingBox())!;
  expect(selectBox.width).toBeGreaterThanOrEqual(170);
  expect(textWidth.available).toBeGreaterThanOrEqual(textWidth.needed);
  expect(resumeBox.x).toBeGreaterThanOrEqual(selectBox.x + selectBox.width + 8);
  await select.click();
  await expect(
    dialog.getByRole('option', {
      name: '2026-11-07 試験用の開催回',
      exact: true,
    }),
  ).toBeVisible();
  await select.press('Escape');
  await dialog.getByRole('button', { name: 'この日の営業に戻る' }).click();
  await startCounter(page);
  await expect(page.locator('.session-bar')).toContainText('11月7日');
});

test('履歴の全額返金ボタンの枠に文字が収まり、返金だけを開く', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1093, height: 827 });
  await openFixture(page, await ledgerFixture({ orders: 3 }));
  await openScreen(page, '注文履歴');
  const refund = page
    .getByRole('button', { name: '全額返金', exact: true })
    .first();
  const size = await refund.evaluate((el) => ({
    available: el.clientWidth,
    needed: el.scrollWidth,
  }));
  expect(size.available).toBeGreaterThanOrEqual(size.needed);
  expect((await refund.boundingBox())!.width).toBeGreaterThanOrEqual(100);
  await refund.click();
  await expect(
    page.getByRole('dialog', { name: '全額返金', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('dialog', { name: '注文の詳細', exact: true }),
  ).toHaveCount(0);
});
