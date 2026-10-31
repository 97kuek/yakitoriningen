import { test, expect, type Page } from '@playwright/test';
import { historyFixture, openFixture } from './fixtures';

async function setup(page: Page) {
  await openFixture(page, await historyFixture(0));
}

test('注文を消しても元の本数と価格へ戻せ、新しい入力は上書きしない', async ({
  page,
}) => {
  await setup(page);
  await page.getByLabel('ももの本数').fill('2');
  await page.getByLabel('かわの本数').fill('1');
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page
    .getByRole('button', { name: '値下げ価格に切り替える', exact: true })
    .click();
  await expect(
    page.getByText('販売中：値下げ価格', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '会計', exact: true }).click();
  await page.getByRole('button', { name: '注文をクリア', exact: true }).click();
  await expect(page.getByTestId('total')).toHaveText('￥0');
  const undo = page
    .locator('.checkout-feedback')
    .getByRole('button', { name: '元に戻す', exact: true });
  await undo.click();
  await expect(page.getByLabel('ももの本数')).toHaveValue('2');
  await expect(page.getByLabel('かわの本数')).toHaveValue('1');
  await expect(page.getByTestId('total')).toHaveText('￥450');
  await page.getByRole('button', { name: '注文をクリア', exact: true }).click();
  await page.getByLabel('ねぎまの本数').fill('1');
  await expect(undo).toHaveCount(0);
  await expect(page.getByTestId('total')).toHaveText('￥50');
});

test('30商品の会計でも明細だけがスクロールし主操作が画面内に残る', async ({
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
    await historyFixture(0, { items, bundleEnabled: false }),
  );
  for (const item of items)
    await page.getByLabel(`${item.name}の本数`, { exact: true }).fill('1');
  await page.getByRole('button', { name: '会計へ', exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  const before = await page
    .getByRole('button', { name: 'お釣りを確認', exact: true })
    .boundingBox();
  expect(before!.y + before!.height).toBeLessThanOrEqual(640);
  await page.getByLabel('お預かり金額', { exact: true }).fill('5000');
  await page.getByRole('button', { name: 'お釣りを確認', exact: true }).click();
  const after = await page
    .getByRole('button', { name: '会計を確定', exact: true })
    .boundingBox();
  expect(after!.y + after!.height).toBeLessThanOrEqual(640);
  await expect(page.getByTestId('change')).toHaveText('￥500');
});

test('多商品の受け渡しを終えても集計領域と一覧の高さが変わらない', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const items = Array.from({ length: 30 }, (_, i) => ({
    id: `p${i}`,
    name: `長い商品名称その${i + 1}`,
    price: 150,
    discountPrice: 50,
  }));
  await openFixture(
    page,
    await historyFixture(0, { items, bundleEnabled: false }),
  );
  for (let order = 0; order < 2; order++) {
    for (const item of order === 0 ? items : [items[0]])
      await page.getByLabel(`${item.name}の本数`, { exact: true }).fill('1');
    await page.getByRole('button', { name: '会計へ', exact: true }).click();
    await page.getByLabel('お預かり金額', { exact: true }).fill('5000');
    await page
      .getByRole('button', { name: 'お釣りを確認', exact: true })
      .click();
    await page.getByRole('button', { name: '会計を確定', exact: true }).click();
  }
  const before = await page.locator('.waiting-totals').boundingBox();
  const listBefore = await page.locator('.waiting-list').boundingBox();
  await page
    .getByTestId('waiting-order')
    .first()
    .getByRole('button', { name: '受け渡し完了（札も回収）', exact: true })
    .click();
  await expect(page.getByTestId('waiting-order')).toHaveCount(1);
  const after = await page.locator('.waiting-totals').boundingBox();
  const listAfter = await page.locator('.waiting-list').boundingBox();
  expect(Math.abs(before!.height - after!.height)).toBeLessThan(1);
  expect(Math.abs(listBefore!.height - listAfter!.height)).toBeLessThan(1);
});

test('預かり金の修正は共通ダイアログで確認し会計を確定せず入力へ戻る', async ({
  page,
}) => {
  await setup(page);
  let nativeDialogs = 0;
  page.on('dialog', async (dialog) => {
    nativeDialogs++;
    await dialog.dismiss();
  });
  await page.getByLabel('ももの本数').fill('1');
  await page.getByRole('button', { name: '会計へ', exact: true }).click();
  await page.getByLabel('お預かり金額', { exact: true }).fill('1000');
  await page.getByRole('button', { name: 'お釣りを確認', exact: true }).click();
  await page.getByRole('button', { name: '入金額を修正', exact: true }).click();
  const dialog = page.getByRole('dialog', {
    name: 'お預かり金額を修正',
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: '戻る', exact: true }).click();
  await expect(page.getByTestId('change')).toHaveText('￥850');
  await page.getByRole('button', { name: '入金額を修正', exact: true }).click();
  await dialog.getByRole('button', { name: '入力し直す', exact: true }).click();
  await page.getByLabel('お預かり金額', { exact: true }).fill('500');
  await page.getByRole('button', { name: 'お釣りを確認', exact: true }).click();
  await expect(page.getByTestId('change')).toHaveText('￥350');
  await expect(page.getByTestId('waiting-order')).toHaveCount(0);
  expect(nativeDialogs).toBe(0);
  await page.getByRole('button', { name: '会計を確定', exact: true }).click();
  await expect(page.getByTestId('waiting-order')).toHaveCount(1);
});

test('低いPC画面でも会計の主操作が見え、本数入力で位置が動かない', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 640 });
  await setup(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  const button = page.getByRole('button', { name: '会計へ', exact: true });
  const before = await button.boundingBox();
  expect(before!.y + before!.height).toBeLessThanOrEqual(640);
  await page.getByLabel('ももの本数').fill('2');
  await page.getByLabel('かわの本数').fill('3');
  const after = await button.boundingBox();
  expect(Math.abs(before!.y - after!.y)).toBeLessThan(1);
  await button.click();
  await page.evaluate(() => window.scrollTo(0, 0));
  const changeButton = page.getByRole('button', {
    name: 'お釣りを確認',
    exact: true,
  });
  const changeBox = await changeButton.boundingBox();
  expect(changeBox!.y + changeBox!.height).toBeLessThanOrEqual(640);
  await page.getByLabel('お預かり金額').fill('1000');
  await changeButton.click();
  const confirmBox = await page
    .getByRole('button', { name: '会計を確定', exact: true })
    .boundingBox();
  expect(confirmBox!.y + confirmBox!.height).toBeLessThanOrEqual(640);
});

test('商品が多くても商品欄だけをスクロールし合計と会計ボタンは見える', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 640 });
  const items = Array.from({ length: 12 }, (_, index) => ({
    id: `item${index}`,
    name: `商品${index + 1}`,
    price: 150,
    discountPrice: 50,
  }));
  await openFixture(
    page,
    await historyFixture(0, { items, bundleEnabled: false }),
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByLabel('商品12の本数').fill('1');
  const box = await page
    .getByRole('button', { name: '会計へ', exact: true })
    .boundingBox();
  expect(box!.y + box!.height).toBeLessThanOrEqual(640);
  const products = await page
    .locator('.products')
    .evaluate((el) => ({ client: el.clientHeight, scroll: el.scrollHeight }));
  expect(products.scroll).toBeGreaterThan(products.client);
  await expect(page.getByTestId('total')).toHaveText('￥150');
});
