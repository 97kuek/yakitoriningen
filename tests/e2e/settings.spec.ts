import { expect, test } from '@playwright/test';
import {
  addSkewers,
  leaveIsBlocked,
  ledgerFixture,
  openFixture,
  openScreen,
  pay,
  rows,
  startCounter,
} from './helpers';

const modeButton = (
  page: import('@playwright/test').Page,
  mode: '通常' | '値下げ',
) => page.getByRole('button', { name: `${mode}価格に切り替える`, exact: true });

test('販売価格の切り替えは未保存の商品編集を保持し、入力中と会計済みの価格を変えない', async ({
  page,
}) => {
  await openFixture(page, await ledgerFixture());
  await addSkewers(page, 'もも');
  await openScreen(page, '設定');
  await page.getByLabel('ももの通常価格（円）').fill('220');
  await page.getByLabel('ももの値下げ価格（円）').fill('80');
  await expect(
    page.getByText('未保存の変更があります。', { exact: true }),
  ).toBeVisible();
  await modeButton(page, '値下げ').click();
  await expect(modeButton(page, '値下げ')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByLabel('ももの通常価格（円）')).toHaveValue('220');
  await expect(page.getByLabel('ももの値下げ価格（円）')).toHaveValue('80');
  await openScreen(page, '会計');
  await page.getByRole('button', { name: '未保存のまま移動' }).click();
  await expect(page.getByTestId('total')).toHaveText('￥150');
  await pay(page, '150');
  await addSkewers(page, 'もも');
  await expect(page.getByTestId('total')).toHaveText('￥50');
  await pay(page, '50');
  await openScreen(page, '設定');
  await page.getByRole('button', { name: '変更を保存', exact: true }).click();
  await expect(page.getByText('保存しました。', { exact: true })).toBeVisible();
  await expect(modeButton(page, '値下げ')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(
    page.getByText('未保存の変更があります。', { exact: true }),
  ).toHaveCount(0);
  await openScreen(page, '会計');
  await addSkewers(page, 'もも');
  await expect(page.getByTestId('total')).toHaveText('￥80');
  await pay(page, '80');
  await openScreen(page, '設定');
  await modeButton(page, '通常').click();
  await expect(modeButton(page, '通常')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await openScreen(page, '会計');
  await addSkewers(page, 'もも');
  await expect(page.getByTestId('total')).toHaveText('￥220');
});

test('未入力の商品があっても販売価格だけ切り替えられ、再読み込み後も保存済み商品を使う', async ({
  page,
}) => {
  await openFixture(page, await ledgerFixture());
  await openScreen(page, '設定');
  await page.getByRole('button', { name: '商品を追加', exact: true }).click();
  await modeButton(page, '値下げ').click();
  await expect(modeButton(page, '値下げ')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByLabel('商品4の名前', { exact: true })).toHaveValue('');
  await openScreen(page, '会計');
  await page.getByRole('button', { name: '未保存のまま移動' }).click();
  await addSkewers(page, 'もも');
  await expect(page.getByTestId('total')).toHaveText('￥50');
  await expect(page.getByLabel('名前未入力の本数')).toHaveCount(0);
  await page.reload();
  await startCounter(page);
  await addSkewers(page, 'もも');
  await expect(page.getByTestId('total')).toHaveText('￥50');
  await openScreen(page, '設定');
  await expect(page.getByLabel('商品4の名前', { exact: true })).toHaveCount(0);
});

test('追加商品の対象セットと個別値下げを会計し、削除後も履歴に名前を残す', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1089, height: 827 });
  await openFixture(page, await ledgerFixture());
  await openScreen(page, '設定');
  await expect(page.locator('.menu-selling-current')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: '経費', exact: true }),
  ).toHaveCount(0);
  const row = page.locator('.menu-row').first();
  const remove = (await row
    .getByRole('button', { name: 'ももを削除' })
    .boundingBox())!;
  const name = (await row
    .getByLabel('商品1の名前', { exact: true })
    .boundingBox())!;
  expect(remove.x + remove.width).toBeLessThan(name.x);
  const add = page.getByRole('button', { name: '商品を追加', exact: true });
  const before = (await add.boundingBox())!;
  await add.click();
  const after = (await add.boundingBox())!;
  expect(after.x).toBe(before.x);
  expect(after.y).toBe(before.y);
  await page.getByLabel('商品4の名前', { exact: true }).fill('つくね');
  await page.getByLabel('つくねの通常価格（円）').fill('200');
  await page.getByLabel('つくねの値下げ価格（円）').fill('80');
  await page.getByLabel('つくねをセット対象にする', { exact: true }).check();
  await page.getByLabel('かわをセット対象にする', { exact: true }).uncheck();
  await page.getByLabel('ねぎまをセット対象にする', { exact: true }).uncheck();
  await page.getByLabel('セットの本数', { exact: true }).fill('3');
  await page.getByLabel('セットの価格（円）', { exact: true }).fill('400');
  await page.getByRole('button', { name: '変更を保存', exact: true }).click();
  await expect(page.getByText('保存しました。', { exact: true })).toBeVisible();
  await openScreen(page, '会計');
  await addSkewers(page, 'つくね', 2);
  await addSkewers(page, 'もも');
  await expect(page.getByTestId('total')).toHaveText('￥400');
  await pay(page);
  await openScreen(page, '設定');
  await modeButton(page, '値下げ').click();
  await expect(modeButton(page, '値下げ')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await openScreen(page, '会計');
  await addSkewers(page, 'つくね');
  await addSkewers(page, 'もも');
  await expect(page.getByTestId('total')).toHaveText('￥130');
  await pay(page);
  await openScreen(page, '設定');
  await page.getByRole('button', { name: 'つくねを削除', exact: true }).click();
  await page.getByRole('button', { name: '変更を保存', exact: true }).click();
  await expect(page.getByText('保存しました。', { exact: true })).toBeVisible();
  await openScreen(page, '注文履歴');
  await expect(page.getByRole('table')).toContainText('つくね 2本');
});

test('空欄の価格は保存せず、明示した0円と上限の価格は入力中の注文を変えずに保存する', async ({
  page,
}) => {
  await openFixture(page, await ledgerFixture());
  await addSkewers(page, 'もも', 2);
  await openScreen(page, '設定');
  const price = page.getByLabel('ももの通常価格（円）');
  await price.fill('');
  await page.getByRole('button', { name: '変更を保存' }).click();
  await expect(price).toBeFocused();
  await price.fill('100000000');
  await page.getByLabel('セット価格を使う').uncheck();
  await page.getByRole('button', { name: '変更を保存' }).click();
  await expect(page.getByText('保存しました。', { exact: true })).toBeVisible();
  await openScreen(page, '会計');
  await expect(page.getByTestId('total')).toHaveText('￥300');
  await expect(
    page.getByText(
      '最新の商品・価格には変更できません。この注文は元の内容で会計できます。',
    ),
  ).toBeVisible();
  await page.getByRole('button', { name: '注文をクリア' }).click();
  await openScreen(page, '設定');
  await price.fill('0');
  await page.getByRole('button', { name: '変更を保存' }).click();
  await expect(page.getByText('保存しました。', { exact: true })).toBeVisible();
  await openScreen(page, '会計');
  await addSkewers(page, 'もも');
  await expect(page.getByTestId('total')).toHaveText('￥0');
});

test('未保存の商品編集は画面の往復・ダイアログ・再読み込みの確認で失わず、保存操作が動かない', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 640 });
  await openFixture(page, await ledgerFixture());
  await openScreen(page, '設定');
  const save = page.getByRole('button', { name: '変更を保存', exact: true });
  const price = page.getByLabel('ももの通常価格（円）');
  await expect(save).toBeInViewport({ ratio: 1 });
  await expect(
    page.getByRole('button', { name: '記録・その他', exact: true }),
  ).toHaveCount(0);
  await price.fill('177');
  await expect(save).toBeInViewport({ ratio: 1 });
  await openScreen(page, '会計');
  const leave = page.getByRole('dialog', { name: '変更が保存されていません' });
  await expect(leave).toBeVisible();
  await leave.getByRole('button', { name: '編集に戻る' }).click();
  await expect(price).toHaveValue('177');
  await page.getByRole('link', { name: '焼き鳥人間・会計へ戻る' }).click();
  await leave.getByRole('button', { name: '未保存のまま移動' }).click();
  await openScreen(page, '設定');
  await expect(page.getByLabel('営業日')).toBeVisible();
  await expect(price).toHaveValue('177');

  const trigger = page.getByRole('button', {
    name: 'バックアップから復元',
    exact: true,
  });
  await trigger.scrollIntoViewIfNeeded();
  const before = (await trigger.boundingBox())!;
  await trigger.click();
  const modal = page.getByRole('dialog', { name: 'バックアップから復元' });
  await expect(modal).toBeVisible();
  await modal.getByRole('button', { name: '閉じる', exact: true }).click();
  await expect(modal).not.toBeVisible();
  const after = (await trigger.boundingBox())!;
  expect(Math.abs(after.x - before.x)).toBeLessThan(1);
  expect(Math.abs(after.y - before.y)).toBeLessThan(1);
  await expect(trigger).toBeFocused();
  await expect(price).toHaveValue('177');

  await page.getByLabel('商品1の名前').fill('炭火もも');
  await expect.poll(() => leaveIsBlocked(page)).toBe(true);
  await openScreen(page, '会計');
  await leave.getByRole('button', { name: '未保存のまま移動' }).click();
  await expect.poll(() => leaveIsBlocked(page)).toBe(true);
  const prompt = page.waitForEvent('dialog');
  const reloading = page.evaluate(() => window.location.reload());
  const dialog = await prompt;
  expect(dialog.type()).toBe('beforeunload');
  await dialog.dismiss();
  await reloading;
  await openScreen(page, '設定');
  await expect(page.getByLabel('商品1の名前')).toHaveValue('炭火もも');
  await save.click();
  await expect.poll(() => leaveIsBlocked(page)).toBe(false);

  const heading = page.getByRole('heading', { name: '商品・価格・在庫' });
  const headingBefore = (await heading.boundingBox())!;
  await modeButton(page, '値下げ').click();
  await expect(modeButton(page, '値下げ')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(
    Math.abs((await heading.boundingBox())!.y - headingBefore.y),
  ).toBeLessThanOrEqual(1);
});

test('日付と札枚数は編集時だけ保存を表示して両方を保持し、設定に開発用語を出さない', async ({
  page,
}) => {
  await page.setViewportSize({ width: 834, height: 827 });
  await openFixture(page, await ledgerFixture());
  await openScreen(page, '設定');
  expect(await page.locator('body').innerText()).not.toMatch(
    /JSON|CSV|IndexedDB|操作ID|世代|PWA/,
  );
  await expect(
    page.getByRole('button', { name: 'バックアップを保存', exact: true }),
  ).toBeVisible();
  const restore = (await page
    .getByRole('button', { name: 'バックアップから復元', exact: true })
    .boundingBox())!;
  const next = (await page
    .getByRole('button', { name: '別の日の営業を準備', exact: true })
    .boundingBox())!;
  expect(restore.y).toBe(next.y);
  expect(restore.width).toBe(next.width);

  const save = page.getByRole('button', { name: '保存', exact: true });
  const form = page.locator('.operation-form');
  const formBefore = (await form.boundingBox())!;
  expect(formBefore.height).toBeLessThan(100);
  await expect(save).toHaveCount(0);
  const date = page.getByLabel('営業日');
  const tickets = page.getByLabel('番号札の枚数');
  await date.fill('2026-11-08');
  await tickets.fill('30');
  await expect(save).toBeVisible();
  expect((await form.boundingBox())!.height).toBe(formBefore.height);
  await save.click();
  await expect(save).toHaveCount(0);
  await page.reload();
  await startCounter(page);
  await openScreen(page, '設定');
  await expect(date).toHaveValue('2026-11-08');
  await expect(tickets).toHaveValue('30');
  await openScreen(page, '注文履歴');
  await expect(rows(page)).toHaveCount(0);
});

test('在庫を日別に登録し、残数と未保存の入力を保持する', async ({ page }) => {
  await openFixture(page, await ledgerFixture({ orders: 1 }));
  await openScreen(page, '設定');
  await page.getByLabel('ももの在庫').fill('1000');
  await page.getByRole('button', { name: '変更を保存', exact: true }).click();
  await expect(page.getByLabel('ももの在庫')).toHaveValue('1000');
  await openScreen(page, '会計');
  await expect(page.locator('.product-stock')).toHaveText('残り 999本');
  await openScreen(page, '設定');
  await page.getByLabel('ももの在庫').fill('1001');
  await page.getByLabel('営業日', { exact: true }).fill('2026-11-08');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(
    page
      .getByText('営業日を変える前に、入力中の商品・在庫を保存してください。')
      .first(),
  ).toBeVisible();
  await expect(page.getByLabel('ももの在庫')).toHaveValue('1001');
  await page.getByLabel('ももの在庫').fill('1000');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByLabel('ももの在庫')).toHaveValue('');
  await page.getByLabel('ももの在庫').fill('50');
  await page.getByRole('button', { name: '変更を保存', exact: true }).click();
  await openScreen(page, '会計');
  await expect(page.locator('.product-stock')).toHaveText('残り 50本');
  await openScreen(page, '設定');
  await page.getByLabel('営業日', { exact: true }).fill('2026-11-07');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByLabel('ももの在庫')).toHaveValue('1000');
});
