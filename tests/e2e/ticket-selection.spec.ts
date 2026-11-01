import { expect, test } from '@playwright/test';
import {
  addSkewers,
  completeButton,
  ledgerFixture,
  openFixture,
  openScreen,
  pay,
} from './helpers';

test('渡す札を空き番号から選んで会計し、使用中の札を選べず回収後は再利用できる', async ({
  page,
}) => {
  await openFixture(page, await ledgerFixture());
  await addSkewers(page, 'もも', 2);
  await page.getByRole('button', { name: '渡す札を選ぶ', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '渡す札を選ぶ' });
  await dialog.getByRole('button', { name: '札12を選ぶ', exact: true }).click();
  await page.keyboard.press('Enter');
  await expect(page.locator('.payment .ticket-chip')).toContainText('12');
  await page.getByLabel('お預かり金額').fill('500');
  await page.getByRole('button', { name: 'お釣りを確認', exact: true }).click();
  await page.getByRole('button', { name: '会計を確定', exact: true }).click();
  await expect(
    page.getByTestId('waiting-order').locator('.ticket-chip'),
  ).toContainText('12');
  await page.getByRole('button', { name: '渡す札を選ぶ', exact: true }).click();
  await expect(
    dialog.getByRole('button', { name: '札12を選ぶ', exact: true }),
  ).toBeDisabled();
  await dialog.getByRole('button', { name: '閉じる', exact: true }).click();
  await completeButton(page).click();
  await page.getByRole('button', { name: '渡す札を選ぶ', exact: true }).click();
  await expect(
    dialog.getByRole('button', { name: '札12を選ぶ', exact: true }),
  ).toBeEnabled();
});

test('商品名と在庫の字頭を揃えて離し、平均時間を大きくし件数バッジを表示しない', async ({
  page,
}) => {
  for (const width of [1435, 864]) {
    await page.setViewportSize({ width, height: 984 });
    if (width === 1435) {
      await openFixture(page, await ledgerFixture());
      await openScreen(page, '設定');
      await page.getByLabel('ももの在庫', { exact: true }).fill('19');
      await page.getByLabel('かわの在庫', { exact: true }).fill('4');
      await page.getByLabel('ねぎまの在庫', { exact: true }).fill('0');
      await page
        .getByRole('button', { name: '変更を保存', exact: true })
        .click();
      await openScreen(page, '会計');
    }
    const names = await page.locator('.product-title > strong').all();
    const stock = await page.locator('.product-stock').all();
    const nameBoxes = await Promise.all(
      names.map((name) => name.boundingBox()),
    );
    const stockBoxes = await Promise.all(
      stock.map((item) => item.boundingBox()),
    );
    for (let i = 0; i < 3; i++) {
      expect(Math.abs(nameBoxes[i]!.x - stockBoxes[i]!.x)).toBeLessThan(1);
      expect(
        stockBoxes[i]!.y - nameBoxes[i]!.y - nameBoxes[i]!.height,
      ).toBeGreaterThanOrEqual(4);
    }
    expect(
      Math.max(...stockBoxes.map((box) => box!.x)) -
        Math.min(...stockBoxes.map((box) => box!.x)),
    ).toBeLessThan(1);
    await expect(page.locator('#waiting-title .count-badge')).toHaveCount(0);
    await expect(page.locator('.wait-estimate strong')).toHaveCSS(
      'font-size',
      '24px',
    );
  }
});
