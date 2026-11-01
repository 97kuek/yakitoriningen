import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { historyFixture, openFixture } from './fixtures';

test('初回の準備は小さなイラストの下に入力と読み込みを表示する', async ({
  page,
}) => {
  await page.goto('/');
  const art = page.getByRole('img', { name: 'ひよこたちが営む焼き鳥の屋台' });
  const form = page.locator('.startup form');
  await expect(form).toBeVisible();
  const imageBox = (await art.boundingBox())!;
  const formBox = (await form.boundingBox())!;
  expect(imageBox.y + imageBox.height).toBeLessThan(formBox.y);
  expect(imageBox.width).toBeLessThanOrEqual(320);
  await expect(page.locator('.startup [aria-expanded]')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: '新しく作る', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '保存した記録を開く', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '保存した記録を開く', exact: true }),
  ).toBeVisible();
});

test('再開画面で件数を確認し、そのまま保存と読み込みができる', async ({
  page,
}) => {
  await openFixture(page, await historyFixture(1));
  await page.reload();
  await expect(
    page.getByRole('heading', { name: '会計を始める前に', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('確定済み 1件')).toBeVisible();
  await expect(page.getByText(/直近：/)).toHaveCount(0);
  await expect(page.locator('.startup [aria-expanded]')).toHaveCount(0);
  await expect(page.getByText('再開やPCの引き継ぎに使います。')).toBeVisible();
  await expect(page.getByText('売上を表で確認できます。')).toBeVisible();
  await expect(
    page.getByRole('button', { name: '保存した記録を開く', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '会計を始める', exact: true }),
  ).toBeDisabled();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: '記録を保存', exact: true }).click();
  const buffer = await readFile((await (await downloading).path())!);
  const saved = { name: 'saved.json', mimeType: 'application/json', buffer };
  await page
    .getByRole('button', { name: '保存した記録を開く', exact: true })
    .click();
  const dialog = page.getByRole('dialog', {
    name: '保存した記録を開く',
    exact: true,
  });
  await dialog.getByLabel('開くファイル', { exact: true }).setInputFiles(saved);
  await dialog.getByLabel('開く内容と現在の記録の保存を確認した').check();
  await expect(
    dialog.getByRole('button', { name: 'この記録に置き換える', exact: true }),
  ).toBeDisabled();
  await dialog.getByRole('button', { name: '閉じる', exact: true }).click();
  await page
    .getByLabel('保存したファイルを確認', { exact: true })
    .setInputFiles(saved);
  await expect(page.getByText('保存したファイルを確認済み')).toBeVisible();
  await page
    .getByRole('button', { name: '保存した記録を開く', exact: true })
    .click();
  await dialog
    .getByRole('button', { name: 'この記録に置き換える', exact: true })
    .click();
  await expect(page.getByText('確定済み 1件')).toBeVisible();
  await page.getByLabel('日付・価格・件数を確認した').check();
  await page.getByRole('button', { name: '会計を始める', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '注文', exact: true }),
  ).toBeVisible();
});

test('注文がない再開画面では直近の記録と確認待ちを表示しない', async ({
  page,
}) => {
  await openFixture(page, await historyFixture(0));
  await page.reload();
  await expect(page.getByText('確定済み 0件')).toBeVisible();
  await expect(page.getByText(/直近：/)).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: '確認が必要な会計', exact: true }),
  ).toHaveCount(0);
});

test('保留の会計と入金の確認待ちは開閉せず札と金額が分かる', async ({
  page,
}) => {
  await openFixture(page, await historyFixture(0));
  await page
    .getByRole('button', { name: 'ももを1本増やす', exact: true })
    .click();
  await page.getByRole('button', { name: '会計へ', exact: true }).click();
  await page.getByLabel('お預かり金額').fill('200');
  await page.getByRole('button', { name: 'お釣りを確認', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '会計を確定', exact: true }),
  ).toBeVisible();
  await page.reload();
  const pending = page.getByRole('region', {
    name: '確認が必要な会計',
    exact: true,
  });
  await expect(
    pending.getByText('途中の会計 1件', { exact: true }),
  ).toBeVisible();
  await expect(
    pending.getByText('結果の確認待ち 1件', { exact: true }),
  ).toHaveCount(0);
  await expect(
    pending.getByText('札 1 / ￥150', { exact: true }),
  ).toBeVisible();
  await expect(pending.locator('li')).toHaveCount(1);
  await expect(
    pending.getByText('現金と札を確認し、二度受け取らないでください。'),
  ).toBeVisible();
  await expect(page.locator('.startup [aria-expanded]')).toHaveCount(0);
});
