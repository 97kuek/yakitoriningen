import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { historyFixture, openFixture } from './fixtures';

test('初回の準備はパネルと同じ幅のイラストの下に入力を表示する', async ({
  page,
}) => {
  await page.goto('/');
  const art = page.getByRole('img', { name: 'ひよこたちが営む焼き鳥の屋台' });
  const form = page.locator('.startup form');
  await expect(form).toBeVisible();
  const imageBox = (await art.boundingBox())!;
  const formBox = (await form.boundingBox())!;
  expect(imageBox.y + imageBox.height).toBeLessThan(formBox.y);
  expect(
    Math.abs(
      imageBox.width -
        (await page.locator('.startup.panel').boundingBox())!.width,
    ),
  ).toBeLessThan(1);
  await expect(page.locator('.startup [aria-expanded]')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: '新しく作る', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'バックアップから復元', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'バックアップから復元', exact: true }),
  ).toBeVisible();
});

test('再開画面は日付と価格に絞り、保存と読み込み後も履歴を保持する', async ({
  page,
}) => {
  await openFixture(page, await historyFixture(1));
  await page.reload();
  await expect(
    page.getByRole('heading', { name: '会計を始める前に', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.startup-details dt')).toHaveText([
    '日付',
    '価格',
  ]);
  await expect(page.getByText(/直近：/)).toHaveCount(0);
  await expect(page.locator('.startup [aria-expanded]')).toHaveCount(0);
  await expect(
    page.getByText('注文・設定を戻すためのファイル（.json）'),
  ).toBeVisible();
  await expect(page.getByText('Excelなどで開く一覧（.csv）')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'バックアップから復元', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '会計を始める', exact: true }),
  ).toBeDisabled();
  const downloading = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'バックアップを保存', exact: true })
    .click();
  const buffer = await readFile((await (await downloading).path())!);
  const saved = { name: 'saved.json', mimeType: 'application/json', buffer };
  await page
    .getByRole('button', { name: 'バックアップから復元', exact: true })
    .click();
  const dialog = page.getByRole('dialog', {
    name: 'バックアップから復元',
    exact: true,
  });
  await dialog
    .getByLabel('記録ファイル（.json）', { exact: true })
    .setInputFiles(saved);
  await expect(
    dialog.getByRole('button', { name: 'この内容で再開' }),
  ).toBeDisabled();
  await dialog.getByLabel('バックアップ内容を確認した').check();
  await expect(dialog.getByRole('table')).toContainText('開催回');
  await dialog.getByRole('button', { name: 'この内容で再開' }).click();
  await expect(page.locator('.startup-details dt')).toHaveText([
    '日付',
    '価格',
  ]);
  await page.getByLabel('日付・価格を確認した').check();
  await page.getByRole('button', { name: '会計を始める', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '注文', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '注文履歴', exact: true }).click();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);
});

test('注文がない再開画面では直近の記録と確認待ちを表示しない', async ({
  page,
}) => {
  await openFixture(page, await historyFixture(0));
  await page.reload();
  await expect(page.getByText('確定済み 0件')).toHaveCount(0);
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
