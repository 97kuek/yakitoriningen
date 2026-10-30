import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
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
  await page.getByRole('button', { name: 'データを作成' }).click();
  await page.getByLabel('価格・営業日・保存件数を確認しました').check();
  await page.getByRole('button', { name: '営業を始める' }).click();
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
  await page.getByLabel('価格・営業日・保存件数を確認しました').check();
  await page.getByRole('button', { name: '営業を始める' }).click();
  await page.getByRole('button', { name: '売上・履歴', exact: true }).click();
  await expect(page.getByTestId('net-sales')).toHaveText('￥600');
  await page.getByRole('button', { name: '全額返金' }).click();
  await page.getByLabel('取消理由').fill('返金済み');
  await page.getByRole('button', { name: '返金を始める' }).click();
  await expect(page.getByText('返金の準備ができました。')).toBeVisible();
  await page.getByLabel('全額返金し、現金を確認しました').check();
  await page.getByRole('button', { name: '返金を記録' }).click();
  await expect(page.getByTestId('net-sales')).toHaveText('￥0');
});
test('価格変更は入力中の注文を変えず次の空注文へ適用する', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: 'ももを1本増やす' }).click();
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByRole('button', { name: '値下げ 1本50円' }).click();
  await page.getByRole('button', { name: 'この価格を使う' }).click();
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
  await expect(page.getByText('保留会計 1件')).toBeVisible();
  await page.getByLabel('価格・営業日・保存件数を確認しました').check();
  await page.getByRole('button', { name: '営業を始める' }).click();
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
  await page.getByRole('button', { name: 'バックアップ', exact: true }).click();
  const firstDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'バックアップを保存' }).click();
  const first = await readFile((await (await firstDownload).path())!);
  await page.getByRole('button', { name: '会計', exact: true }).click();
  await page.getByRole('button', { name: 'かわを1本増やす' }).click();
  await pay(page, '200');
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByRole('button', { name: 'バックアップ', exact: true }).click();
  const archiveDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'バックアップを保存' }).click();
  const archive = await readFile((await (await archiveDownload).path())!);
  await page.getByLabel('保存したバックアップを確認').setInputFiles({
    name: 'archive.json',
    mimeType: 'application/json',
    buffer: archive,
  });
  await expect(page.getByText('保存したファイルを確認済み')).toBeVisible();
  await page.getByRole('button', { name: 'バックアップ', exact: true }).click();
  await page
    .getByRole('button', { name: 'バックアップから戻す', exact: true })
    .click();
  await page.getByLabel('戻すバックアップ').setInputFiles({
    name: 'restore.json',
    mimeType: 'application/json',
    buffer: first,
  });
  await page
    .getByLabel('会計を止め、戻す内容と現在の記録の保存を確認しました')
    .check();
  await page.getByRole('button', { name: 'この内容に戻す' }).click();
  await expect(page.getByText('確定済み 1件')).toBeVisible();
  await page.getByLabel('価格・営業日・保存件数を確認しました').check();
  await page.getByRole('button', { name: '営業を始める' }).click();
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
    second.getByRole('button', { name: '営業を始める' }),
  ).toBeDisabled();
  await page.close();
  await second.getByRole('button', { name: 'この画面で再確認' }).click();
  await second.getByLabel('価格・営業日・保存件数を確認しました').check();
  await second.getByRole('button', { name: '営業を始める' }).click();
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
  await page.getByRole('button', { name: '自由に設定', exact: true }).click();
  await page.getByLabel('単品の価格（円）').fill('100000000');
  await page.getByLabel('安くなる場合にセットを自動適用').uncheck();
  await page.getByRole('button', { name: 'この価格を使う' }).click();
  await page.getByRole('button', { name: '会計', exact: true }).click();
  await expect(page.getByTestId('total')).toHaveText('￥300');
  await expect(
    page.getByText('最新価格では合計金額が上限を超えます。'),
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
  await page.getByRole('button', { name: 'バックアップ', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'バックアップを保存', exact: true }),
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
  await page.getByRole('button', { name: '自由に設定', exact: true }).click();
  await page.getByLabel('価格名').fill('テスト中の価格');
  await page.getByRole('button', { name: 'バックアップ', exact: true }).click();
  const trigger = page.getByRole('button', {
    name: 'バックアップから戻す',
    exact: true,
  });
  await trigger.scrollIntoViewIfNeeded();
  const before = await trigger.boundingBox();
  await trigger.click();
  const modal = page.getByRole('dialog', { name: 'バックアップから戻す' });
  await expect(modal).toBeVisible();
  await modal.getByRole('button', { name: '閉じる', exact: true }).click();
  await expect(modal).not.toBeVisible();
  const after = await trigger.boundingBox();
  expect(Math.abs(after!.x - before!.x)).toBeLessThan(1);
  expect(Math.abs(after!.y - before!.y)).toBeLessThan(1);
  await expect(trigger).toBeFocused();
  await page.getByRole('button', { name: '価格', exact: true }).click();
  await expect(page.getByLabel('価格名')).toHaveValue('テスト中の価格');
});
test('履歴には当日の重複日付や内部番号を表示しない', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: 'ももを1本増やす' }).click();
  await pay(page, '1000');
  await page.getByRole('button', { name: '売上・履歴', exact: true }).click();
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
  await page.getByRole('button', { name: 'バックアップ', exact: true }).click();
  await page
    .getByRole('button', { name: 'バックアップから戻す', exact: true })
    .click();
  const modal = page.getByRole('dialog', { name: 'バックアップから戻す' });
  await modal.getByLabel('戻すバックアップ').setInputFiles({
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
  await page.getByLabel('価格・営業日・保存件数を確認しました').check();
  await page.getByRole('button', { name: '営業を始める' }).click();
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
    page.getByRole('button', { name: '営業日・札', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '自由に設定', exact: true }).click();
  await page.getByLabel('価格名').fill('翌日の価格');
  await page.getByRole('button', { name: '営業日・札', exact: true }).click();
  await expect(page.getByLabel('価格名')).not.toBeVisible();
  await expect(page.getByLabel('切り替え先の営業日')).toBeVisible();
  await page.getByRole('button', { name: '価格', exact: true }).click();
  await expect(page.getByLabel('価格名')).toHaveValue('翌日の価格');
  const panelBeforeSwitch = await page.locator('.settings').boundingBox();
  await page.screenshot({
    path: 'test-results/settings-price.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: '営業日・札', exact: true }).click();
  const panelAfterSwitch = await page.locator('.settings').boundingBox();
  expect(
    Math.abs(panelAfterSwitch!.height - panelBeforeSwitch!.height),
  ).toBeLessThan(1);
  await page.screenshot({
    path: 'test-results/settings-operation.png',
    fullPage: true,
  });
});
test('開催全体の経費から利益を計算し、売上と販売本数をグラフで確認できる', async ({
  page,
}) => {
  await setup(page);
  await page.getByRole('button', { name: 'ももを1本増やす' }).click();
  await pay(page, '1000');
  await page.getByRole('button', { name: '売上・履歴', exact: true }).click();
  await expect(page.getByTestId('net-sales')).toHaveText('￥150');
  await expect(page.getByTestId('profit')).toHaveText('未登録');
  await page.getByRole('button', { name: '経費を登録', exact: true }).click();
  await page.getByLabel('開催回全体の経費（円）').fill('50');
  await page.getByRole('button', { name: '経費を保存', exact: true }).click();
  await page.getByRole('button', { name: '売上・履歴', exact: true }).click();
  await expect(page.getByTestId('expense-total')).toHaveText('￥50');
  await expect(page.getByTestId('profit')).toHaveText('￥100');
  await expect(page.getByRole('figure', { name: '日別の売上' })).toBeVisible();
  await expect(
    page.getByRole('figure', { name: '種類別の販売本数' }),
  ).toContainText(/もも\s*1本/);
  await page.screenshot({
    path: 'test-results/sales-profit.png',
    fullPage: true,
  });
});
test('営業日別の内訳に変えても開催回全体の経費・利益を保ち、0円と赤字を表示する', async ({
  page,
}) => {
  await setup(page);
  await page.getByRole('button', { name: 'ももを1本増やす' }).click();
  await pay(page, '1000');
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByRole('button', { name: '経費', exact: true }).click();
  await page.getByLabel('開催回全体の経費（円）').fill('200');
  await page.getByRole('button', { name: '経費を保存', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('経費を保存しました。');
  await page.getByRole('button', { name: '営業日・札', exact: true }).click();
  await page.getByLabel('切り替え先の営業日').fill('2026-11-08');
  await page
    .getByRole('button', { name: '営業日を切り替える', exact: true })
    .click();
  await expect(page.getByRole('status')).toContainText(
    '営業日を変更しました。',
  );
  await page.getByRole('button', { name: '売上・履歴', exact: true }).click();
  await page.getByLabel('表示範囲').selectOption('day');
  await expect(page.getByTestId('profit')).toHaveText('-￥50');
  await expect(page.getByTestId('expense-total')).toHaveText('￥200');
  await expect(
    page.getByText('この日の売上 ￥0', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('figure', { name: '時刻別の売上' }),
  ).toContainText('会計が入ると表示されます。');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: 'test-results/sales-mobile.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: '経費を変更', exact: true }).click();
  await page.getByLabel('開催回全体の経費（円）').fill('0');
  await page.getByRole('button', { name: '経費を保存', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('経費を保存しました。');
  await page.reload();
  await page.getByLabel('価格・営業日・保存件数を確認しました').check();
  await page.getByRole('button', { name: '営業を始める' }).click();
  await page.getByRole('button', { name: '売上・履歴', exact: true }).click();
  await expect(page.getByTestId('profit')).toHaveText('￥150');
  await expect(page.getByTestId('expense-total')).toHaveText('￥0');
});
