import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { historyFixture, openFixture } from './fixtures';
import { readFile } from 'node:fs/promises';
async function setup(page: Page, capture = false) {
  await page.goto('/');
  if (capture) {
    await page.getByRole('heading', { name: '営業の準備' }).waitFor();
    await page.waitForFunction(() =>
      [...document.images].every((img) => img.complete),
    );
    await page.screenshot({
      path: 'test-results/welcome-screen.png',
      fullPage: true,
    });
  }
  await page.getByLabel('開催回').fill('早稲田祭 2026');
  await page.getByLabel('営業日').fill('2026-11-07');
  await page.getByRole('button', { name: '新しく作る' }).click();
  await page.getByLabel('日付・価格を確認した').check();
  await page.getByRole('button', { name: '会計を始める' }).click();
  if (capture) {
    await page.getByRole('heading', { name: '注文', exact: true }).waitFor();
    await page.waitForFunction(() =>
      [...document.images].every((img) => img.complete),
    );
    await page.screenshot({
      path: 'test-results/empty-counter.png',
      fullPage: true,
    });
  }
}
async function pay(page: Page, received = '1000') {
  await page.getByRole('button', { name: '会計へ' }).click();
  await expect(page.getByRole('heading', { name: 'お会計' })).toBeVisible();
  await page.getByLabel('お預かり金額').fill(received);
  await page.getByRole('button', { name: 'お釣りを確認' }).click();
  await page.getByRole('button', { name: '会計を確定' }).click();
}
test('会計・受け渡し・札回収・入力保持・再起動・取消', async ({ page }) => {
  await setup(page, true);
  for (let i = 0; i < 3; i++)
    await page.getByRole('button', { name: 'ももを1本増やす' }).click();
  for (let i = 0; i < 2; i++)
    await page.getByRole('button', { name: 'かわを1本増やす' }).click();
  await expect(page.getByTestId('total')).toHaveText('￥600');
  await pay(page);
  const order = page.getByTestId('waiting-order').first();
  await expect(order).toContainText(/もも\s*3本/);
  await page.getByRole('button', { name: 'ねぎまを1本増やす' }).click();
  await page.screenshot({
    path: 'test-results/desktop-counter.png',
    fullPage: true,
  });
  await order
    .getByRole('button', { name: '受け渡し完了（札も回収）', exact: true })
    .click();
  await expect(page.getByLabel('ねぎまの本数')).toHaveValue('1');
  await expect(page.getByTestId('unreturned')).toHaveCount(0);
  await expect(page.getByText('別々に記録', { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('確定済み 1件')).toBeVisible();
  await page.getByLabel('日付・価格を確認した').check();
  await page.getByRole('button', { name: '会計を始める' }).click();
  await page.getByRole('button', { name: '注文履歴', exact: true }).click();
  await expect(page.getByRole('table')).toContainText('￥600');
  await page.getByRole('button', { name: '全額返金' }).click();
  await page.getByLabel('取消理由').fill('返金済み');
  await page.getByRole('button', { name: '返金を始める' }).click();
  await expect(page.getByText('返金の準備ができました。')).toBeVisible();
  await page.getByLabel('全額返金し、現金を確認しました').check();
  await page.getByRole('button', { name: '返金を記録' }).click();
  await expect(page.getByRole('table')).toContainText('取消済み');
});
test('価格変更は入力中の注文を変えず次の空注文へ適用する', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: 'ももを1本増やす' }).click();
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page
    .getByRole('button', { name: '値下げ価格に切り替える', exact: true })
    .click();
  await expect(
    page.getByText('販売中：値下げ価格', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '会計', exact: true }).click();
  await expect(page.getByTestId('total')).toHaveText('￥150');
  await pay(page, '150');
  await page.getByRole('button', { name: 'ももを1本増やす' }).click();
  await expect(page.getByTestId('total')).toHaveText('￥50');
});
test('オフラインで再起動して保留注文を照合できる', async ({
  page,
  context,
}) => {
  await setup(page);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await page.getByRole('button', { name: 'ももを1本増やす' }).click();
  await page.getByRole('button', { name: '会計へ' }).click();
  await page.getByLabel('お預かり金額').fill('200');
  await page.getByRole('button', { name: 'お釣りを確認' }).click();
  await expect(page.getByRole('button', { name: '会計を確定' })).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('途中の会計 1件')).toBeVisible();
  await page.getByLabel('日付・価格を確認した').check();
  await page.getByRole('button', { name: '会計を始める' }).click();
  await expect(page.getByRole('heading', { name: 'お会計' })).toBeVisible();
  await page.getByRole('button', { name: '会計を確定' }).click();
  await expect(page.getByTestId('waiting-order')).toHaveCount(1);
  await expect(page.getByTestId('waiting-order')).toContainText(/もも\s*1本/);
});
test('JSONを出力・読み直し、確認した内容へ復元する', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: 'ももを1本増やす' }).click();
  await pay(page, '200');
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByRole('button', { name: '記録・その他', exact: true }).click();
  const firstDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: '記録を保存' }).click();
  const first = await readFile((await (await firstDownload).path())!);
  await page.getByRole('button', { name: '会計', exact: true }).click();
  await page.getByRole('button', { name: 'かわを1本増やす' }).click();
  await pay(page, '200');
  await page.getByRole('button', { name: '設定', exact: true }).click();
  const archiveDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: '記録を保存' }).click();
  const archive = await readFile((await (await archiveDownload).path())!);
  await page.getByLabel('保存したファイルを確認').setInputFiles({
    name: 'archive.json',
    mimeType: 'application/json',
    buffer: archive,
  });
  await expect(page.getByText('保存したファイルを確認済み')).toBeVisible();
  await page.getByRole('button', { name: '記録・その他', exact: true }).click();
  await page
    .getByRole('button', { name: '保存した記録を開く', exact: true })
    .click();
  await page.getByLabel('記録ファイル（.json）').setInputFiles({
    name: 'restore.json',
    mimeType: 'application/json',
    buffer: first,
  });
  await page.getByLabel('開く内容と現在の記録の保存を確認した').check();
  await page.getByRole('button', { name: 'この記録に置き換える' }).click();
  await expect(page.getByText('確定済み 1件')).toBeVisible();
  await page.getByLabel('日付・価格を確認した').check();
  await page.getByRole('button', { name: '会計を始める' }).click();
  await expect(page.getByTestId('waiting-order')).toHaveCount(1);
});
test('実際のIndexedDB書込でstrict durabilityを要求する', async ({ page }) => {
  await page.addInitScript(() => {
    const original = IDBDatabase.prototype.transaction;
    const modes: string[] = [];
    Object.defineProperty(window, '__durabilities', { value: modes });
    IDBDatabase.prototype.transaction = function (stores, mode, options) {
      const tx = original.call(this, stores, mode, options);
      if (mode === 'readwrite') modes.push(tx.durability);
      return tx;
    };
  });
  await setup(page);
  await page.getByRole('button', { name: 'ももを1本増やす' }).click();
  await pay(page, '200');
  const modes = await page.evaluate(
    () => (window as unknown as { __durabilities: string[] }).__durabilities,
  );
  expect(modes.length).toBeGreaterThan(0);
  expect(modes.every((mode) => mode === 'strict')).toBe(true);
});
test('狭い画面でも会計を操作でき横にはみ出さない', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await page.getByRole('button', { name: 'ももを1本増やす' }).click();
  await pay(page, '200');
  await expect(page.getByTestId('waiting-order')).toHaveCount(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: 'test-results/mobile-counter.png',
    fullPage: true,
  });
});
test('二重起動した画面の操作を止め、元の画面を閉じてから再開できる', async ({
  page,
  context,
}) => {
  await setup(page);
  const second = await context.newPage();
  await second.goto('/');
  await expect(second.getByText('別の画面で使用中です')).toBeVisible();
  await expect(
    second.getByRole('button', { name: '会計を始める' }),
  ).toBeDisabled();
  await page.close();
  await second.getByRole('button', { name: 'この画面で再確認' }).click();
  await second.getByLabel('日付・価格を確認した').check();
  await second.getByRole('button', { name: '会計を始める' }).click();
  await expect(
    second.getByRole('heading', { name: '注文', exact: true }),
  ).toBeVisible();
});
test('最新価格で上限超過しても入力中の価格を保持して画面を使える', async ({
  page,
}) => {
  await setup(page);
  await page.getByRole('button', { name: 'ももを1本増やす' }).click();
  await page.getByRole('button', { name: 'ももを1本増やす' }).click();
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByLabel('ももの通常価格（円）').fill('100000000');
  await page.getByLabel('セット価格を使う').uncheck();
  await page.getByRole('button', { name: '変更を保存' }).click();
  await page.getByRole('button', { name: '会計', exact: true }).click();
  await expect(page.getByTestId('total')).toHaveText('￥300');
  await expect(
    page.getByText(
      '最新の商品・価格には変更できません。この注文は元の内容で会計できます。',
    ),
  ).toBeVisible();
});
test('会計へ進むと数量入力を隠し、支払いとお釣りに集中できる', async ({
  page,
}) => {
  await setup(page);
  await page.getByRole('button', { name: 'ももを1本増やす' }).click();
  await page.getByRole('button', { name: '会計へ' }).click();
  await expect(page.getByLabel('ももの本数')).not.toBeVisible();
  await expect(page.getByLabel('お預かり金額')).toBeFocused();
  await expect(page.getByTestId('payment-total')).toHaveText('￥150');
  await page.getByLabel('お預かり金額').fill('1000');
  await page.getByRole('button', { name: 'お釣りを確認' }).click();
  await expect(page.getByTestId('change')).toHaveText('￥850');
  await expect(
    page.getByRole('heading', { name: '受け渡し待ち', exact: false }),
  ).toBeVisible();
});
test('設定の操作はファイル形式や開発用語を知らずに選べる', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByRole('button', { name: '記録・その他', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '記録を保存', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '売上一覧を保存', exact: true }),
  ).toBeVisible();
  expect(await page.locator('body').innerText()).not.toMatch(
    /JSON|CSV|IndexedDB|操作ID|世代|PWA/,
  );
});
test('データを戻す画面を開閉しても設定の位置や入力が変わらない', async ({
  page,
}) => {
  await setup(page);
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByLabel('ももの通常価格（円）').fill('177');
  await page.getByRole('button', { name: '記録・その他', exact: true }).click();
  const trigger = page.getByRole('button', {
    name: '保存した記録を開く',
    exact: true,
  });
  await trigger.scrollIntoViewIfNeeded();
  const before = await trigger.boundingBox();
  await trigger.click();
  const modal = page.getByRole('dialog', { name: '保存した記録を開く' });
  await expect(modal).toBeVisible();
  await modal.getByRole('button', { name: '閉じる', exact: true }).click();
  await expect(modal).not.toBeVisible();
  const after = await trigger.boundingBox();
  expect(Math.abs(after!.x - before!.x)).toBeLessThan(1);
  expect(Math.abs(after!.y - before!.y)).toBeLessThan(1);
  await expect(trigger).toBeFocused();
  await page.getByRole('button', { name: '商品・価格', exact: true }).click();
  await expect(page.getByLabel('ももの通常価格（円）')).toHaveValue('177');
});
test('履歴には当日の重複日付や内部番号を表示しない', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: 'ももを1本増やす' }).click();
  await pay(page, '1000');
  await page.getByRole('button', { name: '注文履歴', exact: true }).click();
  const table = page.getByRole('table');
  await expect(table).not.toContainText('2026-11-07');
  expect(await table.innerText()).not.toMatch(/\b[a-f0-9]{8}\b/);
  await page.screenshot({
    path: 'test-results/sales-history.png',
    fullPage: true,
  });
});
test('普段の受け渡しは1回で記録し、次の注文と画面位置を保つ', async ({
  page,
}) => {
  await setup(page);
  await page.getByRole('button', { name: 'ももを1本増やす' }).click();
  await pay(page, '1000');
  await expect(page.getByTestId('checkout-feedback')).toContainText('札 1');
  await page.getByRole('button', { name: 'ねぎまを1本増やす' }).click();
  const complete = page.getByRole('button', {
    name: '受け渡し完了（札も回収）',
    exact: true,
  });
  await expect(complete).toBeVisible();
  const before = await page.locator('.checkout').boundingBox();
  await page.evaluate(() => {
    const observed: string[] = [];
    Object.defineProperty(window, '__unexpectedRecovery', { value: observed });
    new MutationObserver(() => {
      if (document.querySelector('.recovery')) observed.push('unexpected');
    }).observe(document.body, { childList: true, subtree: true });
  });
  await complete.click();
  await expect(page.getByTestId('waiting-order')).toHaveCount(0);
  await expect(page.getByTestId('unreturned')).toHaveCount(0);
  await expect(page.getByLabel('ねぎまの本数')).toHaveValue('1');
  await expect(page.locator('.ticket-availability')).toContainText(/空き\s*20/);
  const after = await page.locator('.checkout').boundingBox();
  expect(Math.abs(after!.y - before!.y)).toBeLessThan(1);
  expect(Math.abs(after!.height - before!.height)).toBeLessThan(1);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __unexpectedRecovery: string[] })
          .__unexpectedRecovery,
    ),
  ).toEqual([]);
});
test('戻すファイルに問題があれば開いている画面の中で理由が分かる', async ({
  page,
}) => {
  await setup(page);
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByRole('button', { name: '記録・その他', exact: true }).click();
  await page
    .getByRole('button', { name: '保存した記録を開く', exact: true })
    .click();
  const modal = page.getByRole('dialog', { name: '保存した記録を開く' });
  await modal.getByLabel('記録ファイル（.json）').setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"bad":true}'),
  });
  await expect(modal.getByRole('alert')).toContainText(
    '入力内容かバックアップファイルを確認してください。',
  );
});
test('確認待ちの記録は再試行に失敗しても途中で消えない', async ({ page }) => {
  await setup(page);
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('yakitoriningen-v1');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result,
            tx = db.transaction(['meta', 'operations'], 'readwrite');
          const metaRequest = tx.objectStore('meta').get('main');
          metaRequest.onsuccess = () => {
            const meta = metaRequest.result;
            tx.objectStore('operations').add({
              id: 'pending-test',
              context: {
                databaseId: meta.databaseId,
                generation: meta.generation,
              },
              event: meta.event,
              day: meta.day,
              command: {
                type: 'deliver',
                orderId: 'missing-order',
                assignmentId: 'missing-assignment',
              },
              status: 'pending',
              result: null,
              createdAt: new Date().toISOString(),
            });
          };
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onabort = () => reject(tx.error);
        };
      }),
  );
  await page.reload();
  await page.getByLabel('日付・価格を確認した').check();
  await page.getByRole('button', { name: '会計を始める' }).click();
  await expect(
    page.getByRole('heading', { name: '確認が必要な記録' }),
  ).toBeVisible();
  await page.evaluate(() => {
    const missing: string[] = [];
    Object.defineProperty(window, '__missingRecovery', { value: missing });
    new MutationObserver(() => {
      if (!document.querySelector('.recovery')) missing.push('missing');
    }).observe(document.body, { childList: true, subtree: true });
  });
  await page.getByRole('button', { name: '確認して記録', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __missingRecovery: string[] })
          .__missingRecovery,
    ),
  ).toEqual([]);
});
test('キーボードで支払いへ進み、確認ボタンへ迷わず移れる', async ({ page }) => {
  await setup(page);
  const plus = page.getByRole('button', { name: 'ももを1本増やす' });
  await plus.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: '会計へ', exact: true }).focus();
  await page.keyboard.press('Enter');
  const received = page.getByLabel('お預かり金額');
  await expect(received).toBeFocused();
  await received.fill('1000');
  await received.press('Enter');
  const confirm = page.getByRole('button', { name: '会計を確定', exact: true });
  await expect(confirm).toBeFocused();
  await expect(page.getByTestId('change')).toHaveText('￥850');
  await page.screenshot({
    path: 'test-results/payment-confirm.png',
    fullPage: true,
  });
  await confirm.press('Enter');
  await expect(page.getByTestId('waiting-order')).toHaveCount(1);
});
test('お預かり金額はフォーカスしても二重枠やハイライトを出さない', async ({
  page,
}) => {
  await setup(page);
  await page.getByRole('button', { name: 'ももを1本増やす' }).click();
  await page.getByRole('button', { name: '会計へ', exact: true }).click();
  const amount = page.getByLabel('お預かり金額');
  await expect(amount).toBeFocused();
  await expect(amount).toHaveCSS('outline-style', 'none');
  const bounds = await amount.evaluate((input) => {
    const field = input.getBoundingClientRect(),
      frame = input.parentElement!.getBoundingClientRect();
    return (
      field.left >= frame.left &&
      field.right <= frame.right &&
      field.top >= frame.top &&
      field.bottom <= frame.bottom
    );
  });
  expect(bounds).toBe(true);
  await page.screenshot({
    path: 'test-results/payment-input.png',
    fullPage: true,
  });
});
test('設定は項目ごとに分かれ、入力を保ったまま切り替えられる', async ({
  page,
}) => {
  await setup(page);
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '記録・その他', exact: true }),
  ).toBeVisible();
  await page.getByLabel('ももの通常価格（円）').fill('177');
  await page.getByRole('button', { name: '記録・その他', exact: true }).click();
  await expect(page.getByLabel('ももの通常価格（円）')).not.toBeVisible();
  await expect(page.getByLabel('会計に記録する日付')).toBeVisible();
  await page.getByRole('button', { name: '商品・価格', exact: true }).click();
  await expect(page.getByLabel('ももの通常価格（円）')).toHaveValue('177');
  const panelBeforeSwitch = await page.locator('.settings').boundingBox();
  await page.screenshot({
    path: 'test-results/settings-price.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: '記録・その他', exact: true }).click();
  const panelAfterSwitch = await page.locator('.settings').boundingBox();
  expect(
    Math.abs(panelAfterSwitch!.height - panelBeforeSwitch!.height),
  ).toBeLessThan(1);
  await page.screenshot({
    path: 'test-results/settings-operation.png',
    fullPage: true,
  });
});
test('営業日の切り替え後も注文履歴を日ごとに確認できる', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: 'ももを1本増やす' }).click();
  await pay(page, '1000');
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByRole('button', { name: '記録・その他', exact: true }).click();
  await page.getByLabel('会計に記録する日付').fill('2026-11-08');
  await page.getByRole('button', { name: '日付を変更', exact: true }).click();
  await page.getByRole('button', { name: '注文履歴', exact: true }).click();
  const select = page.getByRole('combobox', { name: '表示する日' });
  await select.click();
  await page.getByRole('option', { name: '2日目（11/8）' }).click();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(0);
  await select.click();
  await page.getByRole('option', { name: '1日目（11/7）' }).click();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);
});
test('保存前の設定は会計や売上へ移動しても残る', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByRole('button', { name: '経費', exact: true }).click();
  await page.getByLabel('開催回全体の経費（円）').fill('12345');
  await page.getByRole('button', { name: '会計', exact: true }).click();
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByRole('button', { name: '経費', exact: true }).click();
  await expect(page.getByLabel('開催回全体の経費（円）')).toHaveValue('12345');
});
test('入金前に本数を修正し、設定変更前の価格で会計できる', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: 'ももを1本増やす' }).click();
  await page.getByRole('button', { name: '会計へ', exact: true }).click();
  await page.getByRole('button', { name: '戻る', exact: true }).click();
  await expect(page.getByLabel('ももの本数')).toHaveValue('1');
  await page.getByRole('button', { name: 'かわを1本増やす' }).click();
  await pay(page, '1000');
  await expect(page.getByTestId('waiting-order')).toHaveCount(1);
  await expect(page.getByTestId('waiting-order')).toContainText(/もも\s*1本/);
  await expect(page.getByTestId('waiting-order')).toContainText(/かわ\s*1本/);
});
test('受け渡し完了を戻しても次の注文の入力と売上は変わらない', async ({
  page,
}) => {
  await setup(page);
  await page.getByRole('button', { name: 'ももを1本増やす' }).click();
  await pay(page);
  await page.getByRole('button', { name: 'かわを1本増やす' }).click();
  await page
    .getByRole('button', { name: '受け渡し完了（札も回収）', exact: true })
    .click();
  await expect(page.getByTestId('waiting-order')).toHaveCount(0);
  await page.getByRole('button', { name: '元に戻す', exact: true }).click();
  await expect(page.getByTestId('waiting-order')).toHaveCount(1);
  await expect(page.getByLabel('かわの本数')).toHaveValue('1');
  await page.getByRole('button', { name: '注文履歴', exact: true }).click();
});
test('履歴は札番号と受け渡し状態で探せて集計額は変わらない', async ({
  page,
}) => {
  await setup(page);
  await page.getByRole('button', { name: 'ももを1本増やす' }).click();
  await pay(page);
  await page.getByRole('button', { name: 'かわを1本増やす' }).click();
  await pay(page);
  await page
    .getByTestId('waiting-order')
    .first()
    .getByRole('button', { name: '受け渡し完了（札も回収）', exact: true })
    .click();
  await page.getByRole('button', { name: '注文履歴', exact: true }).click();
  await page.getByLabel('札番号で検索').fill('2');
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);
  await expect(page.getByRole('table')).toContainText('かわ');
  await page.getByLabel('札番号で検索').fill('');
  await page.getByLabel('未受け渡しだけ表示').check();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);
});
test('返金は段階ごとに操作を1つ示し、入力に二重枠を出さない', async ({
  page,
}) => {
  await setup(page);
  await page.getByRole('button', { name: 'ももを1本増やす' }).click();
  await pay(page);
  await page.getByRole('button', { name: '注文履歴', exact: true }).click();
  await page.getByRole('button', { name: '全額返金', exact: true }).click();
  const modal = page.getByRole('dialog', { name: '全額返金', exact: true });
  await expect(
    modal.getByRole('button', { name: '返金を記録', exact: true }),
  ).not.toBeVisible();
  await modal.getByLabel('取消理由').fill('注文間違い');
  await expect(modal.getByLabel('取消理由')).toHaveCSS('outline-style', 'none');
  await page.screenshot({
    path: 'test-results/refund-prepare.png',
    fullPage: false,
  });
});
test('追加商品の対象セットと個別値下げを会計し、削除後も履歴に名前を残す', async ({
  page,
}) => {
  await setup(page);
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByRole('button', { name: '商品を追加', exact: true }).click();
  await page.getByLabel('商品4の名前', { exact: true }).fill('つくね');
  await page.getByLabel('つくねの通常価格（円）').fill('200');
  await page.getByLabel('つくねの値下げ価格（円）').fill('80');
  await page.getByLabel('つくね', { exact: true }).check();
  await page.getByLabel('かわ', { exact: true }).uncheck();
  await page.getByLabel('ねぎま', { exact: true }).uncheck();
  await page.getByLabel('セットの本数', { exact: true }).fill('3');
  await page.getByLabel('セットの価格（円）', { exact: true }).fill('400');
  await page.getByRole('button', { name: '変更を保存', exact: true }).click();
  await expect(
    page.getByText('保存しました。', {
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: 'test-results/menu-settings.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: '会計', exact: true }).click();
  await page.getByRole('button', { name: 'つくねを1本増やす' }).click();
  await page.getByRole('button', { name: 'つくねを1本増やす' }).click();
  await page.getByRole('button', { name: 'ももを1本増やす' }).click();
  await expect(page.getByTestId('total')).toHaveText('￥400');
  await pay(page);
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page
    .getByRole('button', { name: '値下げ価格に切り替える', exact: true })
    .click();
  await expect(
    page.getByText('販売中：値下げ価格', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '会計', exact: true }).click();
  await page.getByRole('button', { name: 'つくねを1本増やす' }).click();
  await page.getByRole('button', { name: 'ももを1本増やす' }).click();
  await expect(page.getByTestId('total')).toHaveText('￥130');
  await pay(page);
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByRole('button', { name: 'つくねを削除', exact: true }).click();
  await page.getByRole('button', { name: '変更を保存', exact: true }).click();
  await expect(
    page.getByText('保存しました。', {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole('button', { name: '注文履歴', exact: true }).click();
  await expect(page.getByRole('table')).toContainText('つくね 2本');
});
test('表示範囲は共通の選択UIをキーボードで操作できる', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: '注文履歴', exact: true }).click();
  const select = page.getByRole('combobox', { name: '表示する日' });
  await select.focus();
  await select.press('ArrowDown');
  await expect(page.getByRole('listbox', { name: '表示する日' })).toBeVisible();
  await select.press('ArrowDown');
  await select.press('Enter');
  await expect(select).toHaveText('1日目（11/7）');
  await expect(select).toBeFocused();
  await select.press('Enter');
  await select.press('Escape');
  await expect(page.getByRole('listbox')).not.toBeVisible();
  await expect(select).toBeFocused();
});
test('履歴が51件以上あっても50件ずつ表示し、全体の売上は変わらない', async ({
  page,
}) => {
  await openFixture(page, await historyFixture(51));
  await page.getByRole('button', { name: '注文履歴', exact: true }).click();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(50);
  await page.getByRole('button', { name: '前の50件', exact: true }).click();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);
  await expect(
    page.getByText('51〜51件 / 51件', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '新しい50件', exact: true }).click();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(50);
});
test('既定商品を置き換えた30商品でも数量上限と旧IDが干渉しない', async ({
  page,
}) => {
  await openFixture(
    page,
    await historyFixture(0, {
      items: Array.from({ length: 30 }, (_, index) => ({
        id: `item-${index}`,
        name: `商品${index + 1}`,
        price: 100,
        discountPrice: 50,
      })),
      bundleEnabled: false,
    }),
  );
  for (let index = 1; index <= 30; index++)
    await page
      .getByRole('button', { name: `商品${index}を1本増やす`, exact: true })
      .click();
  await expect(page.getByTestId('total')).toHaveText('￥3,000');
  await pay(page, '5000');
  await expect(page.getByTestId('waiting-order')).toHaveCount(1);
  await expect(page.getByTestId('waiting-order')).toContainText(/商品30\s*1本/);
});
test('旧値下げプリセットを通常価格へ戻せる', async ({ page }) => {
  await openFixture(
    page,
    await historyFixture(0, {
      label: '値下げ',
      unit: 50,
      bundleEnabled: false,
    }),
  );
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await expect(page.getByLabel('ももの通常価格（円）')).toHaveValue('150');
  await expect(
    page.getByRole('button', { name: '値下げ価格に切り替える', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page
    .getByRole('button', { name: '通常価格に切り替える', exact: true })
    .click();
  await expect(
    page.getByText('販売中：通常価格', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '会計', exact: true }).click();
  await page
    .getByRole('button', { name: 'ももを1本増やす', exact: true })
    .click();
  await expect(page.getByTestId('total')).toHaveText('￥150');
});
test('旧同種セットの案内と会計額が一致する', async ({ page }) => {
  await openFixture(page, await historyFixture(0, { mix: false }));
  await expect(
    page.getByText('同じ種類でセット', { exact: true }),
  ).toBeVisible();
  for (let index = 0; index < 3; index++)
    await page
      .getByRole('button', { name: 'ももを1本増やす', exact: true })
      .click();
  for (let index = 0; index < 2; index++)
    await page
      .getByRole('button', { name: 'かわを1本増やす', exact: true })
      .click();
  await expect(page.getByTestId('total')).toHaveText('￥750');
});
