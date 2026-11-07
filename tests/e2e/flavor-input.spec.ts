import { expect, test } from '@playwright/test';
import { ledgerFixture, openFixture } from './helpers';

const flavors = [
  { id: 'tare', name: 'たれ' },
  { id: 'shio', name: '塩だれ' },
  { id: 'spice', name: '七味' },
  { id: 'plain', name: '味なし' },
];

test('味が4種類でも商品ごとの本数操作は1組で、味を切り替えても位置と本数を保つ', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openFixture(page, await ledgerFixture({ price: { flavors } }));
  for (const product of await page.locator('.product').all())
    await expect(product.locator('.stepper')).toHaveCount(1);
  for (const width of [1280, 1174, 864, 390]) {
    await page.setViewportSize({ width, height: 720 });
    for (const product of await page.locator('.product').all()) {
      const info = (await product.locator('.product-title').boundingBox())!;
      const flavor = (await product.getByRole('combobox').boundingBox())!;
      const counter = (await product.locator('.stepper').boundingBox())!;
      expect(flavor.x).toBeGreaterThanOrEqual(info.x + info.width);
      expect(flavor.x + flavor.width).toBeLessThanOrEqual(counter.x);
      expect(flavor.y).toBeLessThan(info.y + info.height);
      expect(flavor.y + flavor.height).toBeGreaterThan(info.y);
      expect(Math.abs(flavor.y - counter.y)).toBeLessThan(1);
    }
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  const momo = page.locator('.product').first();
  const plus = momo.getByRole('button', {
    name: 'ももを1本増やす',
    exact: true,
  });
  const before = await plus.boundingBox();
  await plus.click();
  const taste = momo.getByRole('combobox', { name: 'ももの味', exact: true });
  await taste.click();
  await page.getByRole('option', { name: '塩だれ', exact: true }).click();
  await plus.click();
  await expect(momo.getByRole('spinbutton')).toHaveValue('1');
  await expect(momo.locator('.product-flavor-summary')).toContainText(
    'たれ 1本',
  );
  await expect(momo.locator('.product-flavor-summary')).toContainText(
    '塩だれ 1本',
  );
  expect(await plus.boundingBox()).toEqual(before);
  await taste.click();
  await taste.press('1');
  await expect(momo.getByRole('spinbutton')).toHaveValue('1');
  await taste.press('Escape');
  await taste.press('1');
  await expect(momo.getByRole('spinbutton')).toHaveValue('2');
  await taste.click();
  await page.getByRole('option', { name: 'たれ', exact: true }).click();
  await expect(momo.getByRole('spinbutton')).toHaveValue('1');
  await expect(page.getByTestId('total')).toHaveText('￥450');
  await taste.press('1');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('payment-total')).toHaveText('￥600');
});

test('低い画面の末尾商品でも10種類の味を画面内で選べる', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 640 });
  const tastes = Array.from({ length: 10 }, (_, index) => ({
    id: `taste-${index}`,
    name: `味${index + 1}`,
  }));
  await openFixture(page, await ledgerFixture({ price: { flavors: tastes } }));
  const taste = page.getByRole('combobox', { name: 'ねぎまの味', exact: true });
  await taste.click();
  await taste.press('End');
  const option = page.getByRole('option', { name: '味10', exact: true });
  await expect(option).toBeVisible();
  const box = (await option.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(640);
  await option.click();
  await expect(taste).toContainText('味10');
  for (const item of tastes) {
    await taste.click();
    await page.getByRole('option', { name: item.name, exact: true }).click();
    await page.getByLabel('ねぎまの本数', { exact: true }).fill('1');
  }
  const summary = page.getByLabel('ねぎまの味別本数', { exact: true });
  expect(
    await summary.evaluate((node) => node.clientHeight),
  ).toBeGreaterThanOrEqual(24);
  await expect(summary).toContainText('味10 1本');
  await taste.click();
  await page.locator('.products').evaluate((node) => {
    node.scrollTop = node.scrollTop > 0 ? 0 : node.scrollHeight;
  });
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(page.locator('.product').last().locator('.stepper')).toHaveCount(
    1,
  );
});
