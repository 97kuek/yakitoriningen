import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import {
  addSkewers,
  ledgerFixture,
  openFixture,
  openScreen,
  startCounter,
} from './helpers';

test('ホームへ戻っても入力中の本数とお預かり金額を失わない', async ({
  page,
}) => {
  await openFixture(page, await ledgerFixture());
  await addSkewers(page, 'もも', 2);
  await page.getByRole('button', { name: 'ホームへ戻る', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '営業後の集計', exact: true }),
  ).toBeVisible();
  await startCounter(page);
  await expect(page.getByLabel('ももの本数')).toHaveValue('2');
  await page.getByRole('button', { name: '会計へ', exact: true }).click();
  await page.getByLabel('お預かり金額').fill('500');
  await page.getByRole('button', { name: 'ホームへ戻る', exact: true }).click();
  await startCounter(page);
  await expect(page.getByLabel('お預かり金額')).toHaveValue('500');
});

test('営業を始めずホームから集計でき、会計中のナビゲーションには集計を出さない', async ({
  page,
}) => {
  await page.goto('/');
  await expect(
    page.getByRole('dialog', { name: '営業の準備', exact: true }),
  ).not.toBeVisible();
  await page.getByRole('button', { name: '営業後の集計', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '営業後の集計', exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('日別のバックアップを集計')).toBeVisible();
  await expect(
    page.getByRole('button', { name: '経費を保存', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'ホームへ戻る', exact: true }).click();
  await openFixture(page, await ledgerFixture());
  await expect(
    page
      .getByRole('navigation', { name: '画面の切り替え' })
      .getByRole('button', { name: '集計', exact: true }),
  ).toHaveCount(0);
});

test('ホームからの営業準備でも未保存の価格を破棄しない', async ({ page }) => {
  await openFixture(page, await ledgerFixture());
  await openScreen(page, '設定');
  await page.getByLabel('ももの通常価格（円）').fill('200');
  await page.getByRole('button', { name: 'ホームへ戻る', exact: true }).click();
  await page
    .getByRole('button', { name: '未保存のまま移動', exact: true })
    .click();
  await page
    .getByRole('button', { name: '新しい営業を作る', exact: true })
    .click();
  const setup = page.getByRole('dialog', {
    name: '新しい営業を作る',
    exact: true,
  });
  await expect(
    setup.getByRole('button', { name: 'この営業日を準備', exact: true }),
  ).toBeDisabled();
  await setup.getByRole('button', { name: '閉じる', exact: true }).click();
  await startCounter(page);
  await openScreen(page, '設定');
  await expect(page.getByLabel('ももの通常価格（円）')).toHaveValue('200');
});

test('同日のバックアップ復元後は集計の経費も復元内容へ更新する', async ({
  page,
}) => {
  await openFixture(page, await ledgerFixture());
  await openScreen(page, '集計');
  await page.getByLabel('当日の経費', { exact: true }).fill('100');
  await page.getByRole('button', { name: '経費を保存', exact: true }).click();
  await page.getByRole('button', { name: 'ホームへ戻る', exact: true }).click();
  const downloading = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'バックアップを保存', exact: true })
    .click();
  const backup = await readFile((await (await downloading).path())!);
  await page.getByRole('button', { name: '営業後の集計', exact: true }).click();
  await page.getByLabel('当日の経費', { exact: true }).fill('200');
  await page.getByRole('button', { name: '経費を保存', exact: true }).click();
  await page.getByRole('button', { name: 'ホームへ戻る', exact: true }).click();
  await page
    .getByRole('button', { name: 'バックアップから復元', exact: true })
    .click();
  const restore = page.getByRole('dialog', {
    name: 'バックアップから復元',
    exact: true,
  });
  await restore
    .getByLabel('記録ファイル（.json）', { exact: true })
    .setInputFiles({
      name: 'day.json',
      mimeType: 'application/json',
      buffer: backup,
    });
  await restore.getByLabel('バックアップ内容を確認した').check();
  await restore
    .getByRole('button', { name: 'この内容で再開', exact: true })
    .click();
  await page.getByRole('button', { name: '営業後の集計', exact: true }).click();
  await expect(page.getByLabel('当日の経費', { exact: true })).toHaveValue(
    '100',
  );
});
