import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { historyFixture, openFixture } from './fixtures';

async function settings(page: Page) {
  await page.getByRole('button', { name: '設定', exact: true }).click();
}

async function checkout(page: Page) {
  await page.getByRole('button', { name: '会計', exact: true }).click();
}

async function pay(page: Page, received: string) {
  await page.getByRole('button', { name: '会計へ', exact: true }).click();
  await page.getByLabel('お預かり金額').fill(received);
  await page.getByRole('button', { name: 'お釣りを確認', exact: true }).click();
  await page.getByRole('button', { name: '会計を確定', exact: true }).click();
}

test('販売価格の切り替えは未保存の商品編集を保持し、入力中と会計済みの価格を変えない', async ({
  page,
}) => {
  await openFixture(page, await historyFixture(0));
  await page.getByRole('button', { name: 'ももを1本増やす' }).click();
  await settings(page);
  await page.getByLabel('ももの通常価格（円）').fill('220');
  await page.getByLabel('ももの値下げ価格（円）').fill('80');
  await expect(
    page.getByText('未保存の変更があります。', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: '値下げ価格に切り替える', exact: true })
    .click();
  await expect(
    page.getByText('販売中：値下げ価格', { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('ももの通常価格（円）')).toHaveValue('220');
  await expect(page.getByLabel('ももの値下げ価格（円）')).toHaveValue('80');
  await checkout(page);
  await expect(page.getByTestId('total')).toHaveText('￥150');
  await pay(page, '150');
  await page.getByRole('button', { name: 'ももを1本増やす' }).click();
  await expect(page.getByTestId('total')).toHaveText('￥50');
  await pay(page, '50');
  await settings(page);
  await page.getByRole('button', { name: '変更を保存', exact: true }).click();
  await expect(
    page.getByText('保存しました。', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText('販売中：値下げ価格', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('未保存の変更があります。', { exact: true }),
  ).toHaveCount(0);
  await checkout(page);
  await page.getByRole('button', { name: 'ももを1本増やす' }).click();
  await expect(page.getByTestId('total')).toHaveText('￥80');
  await pay(page, '80');
  await page.getByRole('button', { name: '売上・履歴', exact: true }).click();
  await expect(page.getByTestId('net-sales')).toHaveText('￥280');
  await settings(page);
  await page
    .getByRole('button', { name: '通常価格に切り替える', exact: true })
    .click();
  await expect(
    page.getByText('販売中：通常価格', { exact: true }),
  ).toBeVisible();
  await checkout(page);
  await page.getByRole('button', { name: 'ももを1本増やす' }).click();
  await expect(page.getByTestId('total')).toHaveText('￥220');
});

test('未入力の商品があっても販売価格だけ切り替えられ、再読み込み後も保存済み商品を使う', async ({
  page,
}) => {
  await openFixture(page, await historyFixture(0));
  await settings(page);
  await page.getByRole('button', { name: '商品を追加', exact: true }).click();
  await page
    .getByRole('button', { name: '値下げ価格に切り替える', exact: true })
    .click();
  await expect(
    page.getByText('販売中：値下げ価格', { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('商品4の名前', { exact: true })).toHaveValue('');
  await checkout(page);
  await page.getByRole('button', { name: 'ももを1本増やす' }).click();
  await expect(page.getByTestId('total')).toHaveText('￥50');
  await expect(page.getByLabel('名前未入力の本数')).toHaveCount(0);
  await page.reload();
  await page.getByLabel('日付・価格・件数を確認した').check();
  await page.getByRole('button', { name: '会計を始める', exact: true }).click();
  await page.getByRole('button', { name: 'ももを1本増やす' }).click();
  await expect(page.getByTestId('total')).toHaveText('￥50');
  await settings(page);
  await expect(page.getByLabel('商品4の名前', { exact: true })).toHaveCount(0);
});

test('旧値下げ価格を通常へ切り替えても単価50円を通常価格として保存しない', async ({
  page,
}) => {
  await openFixture(
    page,
    await historyFixture(0, {
      label: '値下げ',
      unit: 50,
      bundleEnabled: false,
    }),
  );
  await settings(page);
  await expect(
    page.getByText('販売中：値下げ価格', { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('ももの通常価格（円）')).toHaveValue('150');
  await page
    .getByRole('button', { name: '通常価格に切り替える', exact: true })
    .click();
  await expect(
    page.getByText('販売中：通常価格', { exact: true }),
  ).toBeVisible();
  await checkout(page);
  await page.getByRole('button', { name: 'ももを1本増やす' }).click();
  await expect(page.getByTestId('total')).toHaveText('￥150');
});

test('低い画面でも商品編集の保存操作をすぐ見つけられる', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 640 });
  await openFixture(page, await historyFixture(0));
  await settings(page);
  const save = page.getByRole('button', { name: '変更を保存', exact: true });
  await expect(save).toBeInViewport({ ratio: 1 });
  await page.getByLabel('ももの通常価格（円）').fill('200');
  await expect(save).toBeInViewport({ ratio: 1 });
});
