import { expect, test } from '@playwright/test';
import { historyFixture, openFixture } from './fixtures';

test('商品追加の位置を保ち、商品名の横でセット対象を選べる', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1089, height: 827 });
  await openFixture(page, await historyFixture(0));
  await page.getByRole('button', { name: '設定', exact: true }).click();
  const add = page.getByRole('button', { name: '商品を追加', exact: true });
  const before = (await add.boundingBox())!;
  await add.click();
  await add.click();
  const after = (await add.boundingBox())!;
  expect(after.y).toBe(before.y);
  expect(after.x).toBe(before.x);
  await expect(page.getByLabel('商品5の名前')).toBeVisible();
  const row = page.locator('.menu-row').first();
  await row.getByRole('checkbox', { name: 'ももをセット対象にする' }).uncheck();
  await expect(row.getByRole('checkbox')).not.toBeChecked();
  await expect(page.locator('.bundle-item-options')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: '経費', exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: 'test-results/festival-menu.png',
    fullPage: true,
  });
});

test('営業後の集計で日別の売上と経費を確認し、経費の編集を画面往復で保つ', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1089, height: 827 });
  const snapshot = await historyFixture(3, undefined, [
    '2026-11-07',
    '2026-11-07',
    '2026-11-08',
  ]);
  await openFixture(page, snapshot);
  await expect(page.locator('.session-bar')).toContainText(
    '2026年度 早稲田祭　11月8日',
  );
  await expect(page.locator('.session-bar')).not.toContainText('保存済み');
  await page.getByRole('button', { name: '集計', exact: true }).click();
  const table = page.getByRole('table', { name: '日別の集計' });
  await expect(table.locator('tbody tr').nth(0)).toContainText('￥300');
  await expect(table.locator('tbody tr').nth(1)).toContainText('￥150');
  await expect(table.locator('tfoot')).toContainText('￥450');
  await page.getByLabel('開催回全体の経費（円）').fill('100');
  await page.getByRole('button', { name: '会計', exact: true }).click();
  await page.getByRole('button', { name: '集計', exact: true }).click();
  await expect(page.getByLabel('開催回全体の経費（円）')).toHaveValue('100');
  await page.getByRole('button', { name: '経費を保存' }).click();
  await expect(page.locator('.summary-profit')).toContainText('￥350');
  await page.screenshot({
    path: 'test-results/festival-summary.png',
    fullPage: true,
  });
});

test('時間帯の選択も横一列に並び、設定の保存で余分な空行を作らない', async ({
  page,
}) => {
  await page.setViewportSize({ width: 834, height: 827 });
  await openFixture(page, await historyFixture(0));
  await page.getByRole('button', { name: '注文履歴', exact: true }).click();
  const boxes = await Promise.all(
    [
      page.getByRole('combobox', { name: '表示する日' }),
      page.getByRole('combobox', { name: '時間帯' }),
      page.getByLabel('札番号で検索'),
      page.getByRole('combobox', { name: '注文の状態' }),
    ].map(async (el) => {
      const b = (await el.boundingBox())!;
      return b.y + b.height / 2;
    }),
  );
  expect(Math.max(...boxes) - Math.min(...boxes)).toBeLessThan(2);
  await page.screenshot({
    path: 'test-results/festival-history.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: '設定', exact: true }).click();
  const form = page.locator('.operation-form');
  const before = (await form.boundingBox())!;
  await page.getByLabel('番号札の枚数').fill('25');
  expect((await form.boundingBox())!.height).toBe(before.height);
  expect(before.height).toBeLessThan(100);
  await page.screenshot({
    path: 'test-results/festival-backup.png',
    fullPage: true,
  });
});

test('履歴のCSVは表示条件に合う全ページ分を保存する', async ({ page }) => {
  const { readFile } = await import('node:fs/promises');
  const days = [...Array<string>(51).fill('2026-11-07'), '2026-11-08'];
  await openFixture(page, await historyFixture(52, undefined, days));
  await page.getByRole('button', { name: '注文履歴', exact: true }).click();
  await page.getByRole('combobox', { name: '表示する日' }).click();
  await page.getByRole('option', { name: '11/7', exact: true }).click();
  await expect(page.locator('.history tbody tr')).toHaveCount(50);
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: '表示条件の注文をCSVで保存' }).click();
  const file = await downloading;
  expect(file.suggestedFilename()).toContain('2026-11-07.csv');
  const csv = await readFile((await file.path())!, 'utf8');
  expect(csv.split('\r\n')).toHaveLength(52);
  expect(csv).not.toContain('2026-11-08');
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await expect(page.locator('.settings')).not.toContainText('売上一覧');
});

test('合計の横にセット内訳を置き、受け渡し待ち本数を大きく表示する', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1019, height: 827 });
  await openFixture(page, await historyFixture(0));
  await page.getByLabel('ももの本数', { exact: true }).fill('3');
  await page.getByLabel('かわの本数', { exact: true }).fill('3');
  await page.getByLabel('ねぎまの本数', { exact: true }).fill('1');
  const total = (await page
    .locator('.checkout-total > div > span')
    .boundingBox())!;
  const breakdown = (await page
    .locator('.checkout-total small')
    .boundingBox())!;
  expect(breakdown.x).toBeGreaterThan(total.x + total.width);
  expect(breakdown.y).toBeLessThan(total.y + total.height);
  await page.getByRole('button', { name: '会計へ', exact: true }).click();
  await page.getByLabel('お預かり金額', { exact: true }).fill('1000');
  await page.getByRole('button', { name: 'お釣りを確認', exact: true }).click();
  await page.getByRole('button', { name: '会計を確定', exact: true }).click();
  const totals = page.getByRole('group', {
    name: '未受け渡しの本数（調理済み分を含む）',
  });
  await expect(totals).toContainText('もも3本');
  await expect(totals).toContainText('かわ3本');
  await expect(totals.locator('strong').first()).toHaveCSS('font-size', '24px');
  await page.screenshot({
    path: 'test-results/festival-waiting.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: '注文履歴', exact: true }).click();
  await page.getByRole('button', { name: '注文の詳細', exact: true }).click();
  await expect(
    page.getByRole('list', { name: '注文した商品' }).locator('li'),
  ).toHaveCount(3);
  await page.screenshot({
    path: 'test-results/festival-details.png',
    fullPage: true,
  });
});

test('ロゴで入力を残して会計へ戻り、アプリ情報の行を揃える', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1019, height: 827 });
  await openFixture(page, await historyFixture(0));
  await page.getByLabel('ももの本数', { exact: true }).fill('2');
  await page.getByRole('button', { name: '注文履歴', exact: true }).click();
  await expect(page.locator('.history .empty-text')).toHaveCSS(
    'text-align',
    'center',
  );
  await page.getByRole('link', { name: '焼き鳥人間・会計へ戻る' }).click();
  await expect(page.getByLabel('ももの本数', { exact: true })).toHaveValue('2');
  await page.getByRole('button', { name: 'このアプリについて' }).click();
  await expect(
    page.getByRole('link', { name: 'GitHub', exact: true }),
  ).toHaveAttribute('href', 'https://github.com/97kuek/yakitoriningen');
  const labels = await page.locator('.about-details dt').all();
  const values = await page.locator('.about-details dd').all();
  for (let i = 0; i < labels.length; i++) {
    expect(
      Math.abs(
        (await labels[i].boundingBox())!.y - (await values[i].boundingBox())!.y,
      ),
    ).toBeLessThan(1);
  }
  await page.screenshot({
    path: 'test-results/festival-about.png',
    fullPage: true,
  });
});

test('会計番号を先頭列に置き、完了と未完了を切り替えられる', async ({
  page,
}) => {
  await openFixture(page, await historyFixture(1));
  await page.getByLabel('ももの本数', { exact: true }).fill('2');
  await page.getByRole('button', { name: '会計へ', exact: true }).click();
  await page.getByLabel('お預かり金額', { exact: true }).fill('1000');
  await page.getByRole('button', { name: 'お釣りを確認', exact: true }).click();
  await page.getByRole('button', { name: '会計を確定', exact: true }).click();
  await page.getByRole('button', { name: '注文履歴', exact: true }).click();
  await expect(page.locator('.history th').first()).toHaveText('会計番号');
  const state = page.getByRole('combobox', { name: '注文の状態' });
  await state.click();
  await page.getByRole('option', { name: '完了', exact: true }).click();
  await expect(page.locator('.history tbody tr')).toHaveCount(1);
  await expect(page.locator('.history tbody')).toContainText('￥150');
  await state.click();
  await page.getByRole('option', { name: '未完了', exact: true }).click();
  await expect(page.locator('.history tbody tr')).toHaveCount(1);
  await expect(page.locator('.history tbody')).toContainText('￥300');
  await state.click();
  await page.getByRole('option', { name: '取消', exact: true }).click();
  await expect(page.locator('.history tbody tr')).toHaveCount(0);
});
