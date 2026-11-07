import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import {
  ledgerFixture,
  openFixture,
  openScreen,
  pay,
  startCounter,
} from './helpers';

test('味を追加・改名し、味別の本数を再開・会計・履歴・出力へ引き継ぐ', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openFixture(page, await ledgerFixture());
  await openScreen(page, '設定');
  await page.getByRole('button', { name: '味を追加', exact: true }).click();
  await page.getByLabel('味3の名前', { exact: true }).fill('塩');
  await page.getByLabel('ももの在庫', { exact: true }).fill('5');
  await page.getByRole('button', { name: '変更を保存', exact: true }).click();
  await expect(page.getByText('保存しました。', { exact: true })).toBeVisible();
  await openScreen(page, '会計');
  await page
    .getByRole('group', { name: 'もも たれ', exact: true })
    .getByRole('spinbutton')
    .fill('2');
  await page
    .getByRole('group', { name: 'もも 塩だれ', exact: true })
    .getByRole('spinbutton')
    .fill('1');
  await page
    .getByRole('group', { name: 'かわ 塩', exact: true })
    .getByRole('spinbutton')
    .fill('2');
  await expect(page.getByTestId('total')).toHaveText('￥600');
  await page.reload();
  await startCounter(page);
  await expect(
    page
      .getByRole('group', { name: 'もも たれ', exact: true })
      .getByRole('spinbutton'),
  ).toHaveValue('2');
  await expect(
    page
      .getByRole('group', { name: 'もも 塩だれ', exact: true })
      .getByRole('spinbutton'),
  ).toHaveValue('1');
  await pay(page);
  const waiting = page.getByTestId('waiting-order');
  await expect(waiting).toContainText('たれ');
  await expect(waiting).toContainText('塩だれ');
  await expect(waiting).toContainText('塩');
  await expect(page.locator('.product').first()).toContainText('残り 2本');
  await openScreen(page, '設定');
  await page.getByLabel('味1の名前', { exact: true }).fill('甘だれ');
  await page.getByRole('button', { name: '変更を保存', exact: true }).click();
  await expect(page.getByText('保存しました。', { exact: true })).toBeVisible();
  await openScreen(page, '会計');
  await expect(
    page.getByRole('group', { name: 'もも 甘だれ', exact: true }),
  ).toBeVisible();
  await expect(waiting.locator('.order-quantities')).not.toContainText(
    '甘だれ',
  );
  await openScreen(page, '注文履歴');
  const row = page.locator('tbody tr').first();
  await expect(row).toContainText('もも（たれ） 2本');
  await expect(row).toContainText('もも（塩だれ） 1本');
  await row.locator('td').first().click();
  await expect(
    page.getByRole('dialog', { name: '注文の詳細', exact: true }),
  ).toContainText('塩だれ');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '閉じる', exact: true })
    .last()
    .click();
  const download = page.waitForEvent('download');
  await page
    .getByRole('button', { name: '表示条件の注文をCSVで保存', exact: true })
    .click();
  const file = await download;
  const csv = await readFile((await file.path())!, 'utf8');
  expect(csv).toContain('味別内訳');
  expect(csv).toContain('もも（たれ） 2本');
  expect(csv).toContain('かわ（塩） 2本');
  await openScreen(page, '設定');
  const backup = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'バックアップを保存', exact: true })
    .click();
  const saved = JSON.parse(
    await readFile((await (await backup).path())!, 'utf8'),
  );
  // Backup envelope may include metadata; serialized records must retain both flavor versions.
  expect(JSON.stringify(saved)).toContain('甘だれ');
  expect(JSON.stringify(saved)).toContain('"tare":2');
  expect(JSON.stringify(saved)).toContain('"shio":1');
});

test('味を分けても同じ商品の在庫上限を共有し、数字キーは先頭の味へ追加する', async ({
  page,
}) => {
  await openFixture(page, await ledgerFixture());
  await openScreen(page, '設定');
  await page.getByLabel('ももの在庫', { exact: true }).fill('2');
  await page.getByRole('button', { name: '変更を保存', exact: true }).click();
  await expect(page.getByText('保存しました。', { exact: true })).toBeVisible();
  await openScreen(page, '会計');
  await page.locator('body').click({ position: { x: 5, y: 120 } });
  await page.keyboard.press('1');
  const tare = page.getByRole('group', { name: 'もも たれ', exact: true });
  const shio = page.getByRole('group', { name: 'もも 塩だれ', exact: true });
  await expect(tare.getByRole('spinbutton')).toHaveValue('1');
  await shio.getByRole('button', { name: /増やす/ }).click();
  await expect(tare.getByRole('button', { name: /増やす/ })).toBeDisabled();
  await expect(shio.getByRole('button', { name: /増やす/ })).toBeDisabled();
  await expect(page.getByTestId('total')).toHaveText('￥300');
  await shio.getByRole('button', { name: /減らす/ }).click();
  await tare.getByRole('button', { name: /増やす/ }).click();
  await expect(tare.getByRole('spinbutton')).toHaveValue('2');
  await expect(shio.getByRole('spinbutton')).toHaveValue('0');
  await expect(page.getByTestId('total')).toHaveText('￥300');
});

test('0本に戻した味を削除しても、残った味の注文を最新価格へ変更できる', async ({
  page,
}) => {
  await openFixture(page, await ledgerFixture());
  const tare = page.getByRole('group', { name: 'もも たれ', exact: true });
  const shio = page.getByRole('group', { name: 'もも 塩だれ', exact: true });
  await tare.getByRole('spinbutton').fill('1');
  await shio.getByRole('spinbutton').fill('1');
  await tare.getByRole('spinbutton').fill('0');
  await openScreen(page, '設定');
  await page.getByRole('button', { name: 'たれを削除', exact: true }).click();
  await page.getByLabel('ももの通常価格（円）', { exact: true }).fill('200');
  await page.getByRole('button', { name: '変更を保存', exact: true }).click();
  await expect(page.getByText('保存しました。', { exact: true })).toBeVisible();
  await openScreen(page, '会計');
  await page.getByRole('button', { name: '￥200に変更', exact: true }).click();
  await expect(page.getByTestId('total')).toHaveText('￥200');
  await expect(shio.getByRole('spinbutton')).toHaveValue('1');
  await expect(tare).toHaveCount(0);
  await pay(page, '200');
  await expect(page.getByTestId('waiting-order')).toContainText('塩だれ');
});
