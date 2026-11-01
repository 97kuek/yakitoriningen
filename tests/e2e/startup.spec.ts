import { readFile, writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import {
  addSkewers,
  ledgerFixture,
  loadFixture,
  openFixture,
  openScreen,
  pay,
  rows,
  startCounter,
  startNewEvent,
} from './helpers';

test('開始画面はPCではイラストと入力を横に並べてスクロールせずに操作でき、復元ファイルの問題を画面内で示す', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');
  const art = page.getByRole('img', { name: 'ひよこたちが営む焼き鳥の屋台' });
  const panel = page.locator('.startup.panel');
  await expect(page.locator('.startup form')).toBeVisible();
  const initialSetup = page.getByRole('dialog', {
    name: '営業の準備',
    exact: true,
  });
  await expect(initialSetup).toBeVisible();
  await expect(initialSetup.getByLabel('ももの在庫')).toBeVisible();
  await expect(initialSetup.getByLabel('ももの通常価格（円）')).toBeVisible();
  const artBox = (await art.boundingBox())!;
  const panelBox = (await panel.boundingBox())!;
  expect(artBox.x + artBox.width).toBeLessThan(panelBox.x);
  expect(
    Math.abs(artBox.y + artBox.height / 2 - (panelBox.y + panelBox.height / 2)),
  ).toBeLessThan(2);
  const overflow = () =>
    page.evaluate(
      () => document.documentElement.scrollHeight - window.innerHeight,
    );
  expect(await overflow()).toBeLessThanOrEqual(0);
  await page.setViewportSize({ width: 700, height: 900 });
  expect((await art.boundingBox())!.y).toBeLessThan(
    (await panel.boundingBox())!.y,
  );
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(page.locator('.startup [aria-expanded]')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: '新しく作る', exact: true }),
  ).toBeVisible();
  await initialSetup
    .getByRole('button', { name: '閉じる', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'バックアップから復元', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: 'バックアップから復元' });
  const file = dialog.getByLabel('記録ファイル（.json）');
  await expect(file).toHaveAttribute('accept', '.json,application/json');
  await file.setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"bad":true}'),
  });
  await expect(dialog.getByRole('alert')).toContainText(
    '入力内容かバックアップファイルを確認してください。',
  );
});

test('再開画面はタイトルと日付に絞り、保存したバックアップで後の変更を確認して戻せる', async ({
  page,
}) => {
  await loadFixture(page, await ledgerFixture({ orders: 1 }));
  await expect(
    page.getByRole('heading', {
      name: '保存されている記録から再開',
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator('.startup-record')).toContainText('試験用の開催回');
  await expect(page.locator('.startup-record time')).toHaveText('2026-11-07');
  await expect(page.locator('.startup dt')).toHaveCount(0);
  await expect(page.getByText(/直近：|確定済み/)).toHaveCount(0);
  await expect(page.locator('.startup [aria-expanded]')).toHaveCount(0);
  await expect(page.getByText('営業が終わったら、当日分を保存')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: '会計を始める', exact: true }),
  ).toBeEnabled();
  const downloading = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'バックアップを保存', exact: true })
    .click();
  const buffer = await readFile((await (await downloading).path())!);

  // Sell after the backup; restoring must bring back the saved state only.
  await startCounter(page);
  await addSkewers(page, 'かわ');
  await pay(page, '200');
  await expect(page.getByTestId('waiting-order')).toHaveCount(1);
  await openScreen(page, '設定');
  await page
    .getByRole('button', { name: 'バックアップから復元', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: 'バックアップから復元' });
  await dialog
    .getByLabel('記録ファイル（.json）', { exact: true })
    .setInputFiles({
      name: 'saved.json',
      mimeType: 'application/json',
      buffer,
    });
  await expect(dialog.getByRole('table')).toContainText('営業名');
  await expect(
    dialog.getByRole('button', { name: 'この内容で再開' }),
  ).toBeDisabled();
  await dialog.getByLabel('バックアップ内容を確認した').check();
  await dialog.getByRole('button', { name: 'この内容で再開' }).click();
  await expect(page.locator('.startup-record')).toContainText('試験用の開催回');
  await expect(page.locator('.startup-record time')).toHaveText('2026-11-07');
  await expect(page.locator('.startup dt')).toHaveCount(0);
  await startCounter(page);
  await expect(page.getByTestId('waiting-order')).toHaveCount(0);
  await openScreen(page, '注文履歴');
  await expect(rows(page)).toHaveCount(1);
});

test('通信なしで再起動しても途中の会計を札と金額で示し、同じ入金を確定できる', async ({
  page,
  context,
}) => {
  await loadFixture(page, await ledgerFixture(), { offline: true });
  await expect(
    page.getByRole('heading', { name: '確認が必要な会計', exact: true }),
  ).toHaveCount(0);
  await startCounter(page);
  await addSkewers(page, 'もも');
  await page.getByRole('button', { name: '会計へ', exact: true }).click();
  await page.getByLabel('お預かり金額').fill('200');
  await page.getByRole('button', { name: 'お釣りを確認', exact: true }).click();
  await expect(page.getByRole('button', { name: '会計を確定' })).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  const pending = page.getByRole('region', { name: '確認が必要な会計' });
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
  await startCounter(page);
  await expect(page.getByRole('heading', { name: 'お会計' })).toBeVisible();
  await page.getByRole('button', { name: '会計を確定' }).click();
  await expect(page.getByTestId('waiting-order')).toContainText(/もも\s*1本/);
});

test('確認待ちの記録は再試行に失敗しても途中で消えない', async ({ page }) => {
  await startNewEvent(page);
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('yakitoriningen-v1');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction(['meta', 'operations'], 'readwrite');
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
  await startCounter(page);
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

test('二重起動した画面の操作を止め、元の画面を閉じてから再開できる', async ({
  page,
  context,
}) => {
  await startNewEvent(page);
  const second = await context.newPage();
  await second.goto('/');
  await expect(second.getByText('別の画面で使用中です')).toBeVisible();
  await expect(
    second.getByRole('button', { name: '会計を始める' }),
  ).toBeDisabled();
  await page.close();
  await second.getByRole('button', { name: 'この画面で再確認' }).click();
  await startCounter(second);
  await expect(
    second.getByRole('heading', { name: '注文', exact: true }),
  ).toBeVisible();
});

test('別の日の準備は前日の注文を残し、価格と札枚数を引き継ぐ', async ({
  page,
}) => {
  await loadFixture(
    page,
    await ledgerFixture({ orders: 1, price: { unit: 200, discounted: true } }),
  );
  const prepare = page.getByRole('button', {
    name: '別の日の営業を準備',
    exact: true,
  });
  await prepare.click();
  const dialog = page.getByRole('dialog', { name: '別の日の営業を準備' });
  await expect(dialog.getByLabel('前年のバックアップを保存した')).toHaveCount(
    0,
  );
  await expect(dialog.getByLabel('番号札の枚数')).toHaveValue('20');
  await expect(dialog.getByLabel('ももの通常価格（円）')).toHaveValue('200');
  await dialog.getByLabel('営業日').fill('2027-11-06');
  const confirm = dialog.getByRole('button', {
    name: 'この営業日を準備',
  });
  await expect(confirm).toBeEnabled();
  await dialog.getByRole('button', { name: '閉じる' }).click();

  const downloading = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'バックアップを保存', exact: true })
    .click();
  const file = await downloading;
  expect(file.suggestedFilename()).toBe('2026-11-07-yakitori.json');
  const buffer = await readFile((await file.path())!);
  expect(JSON.parse(buffer.toString()).data.orders).toHaveLength(1);
  await expect(page.getByLabel('保存したファイルを確認')).toHaveCount(0);

  await prepare.click();
  await confirm.click();
  await expect(page.locator('.startup-event')).toHaveText('試験用の開催回');
  await startCounter(page);
  await expect(page.locator('.product').first()).toContainText('￥200');
});

test('画面に戻ったとき更新を確認しても入力中の注文を再読み込みしない', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = ServiceWorkerRegistration.prototype.update;
    (window as unknown as { updateChecks: number }).updateChecks = 0;
    ServiceWorkerRegistration.prototype.update = function () {
      (window as unknown as { updateChecks: number }).updateChecks++;
      return original.call(this);
    };
  });
  await openFixture(page, await ledgerFixture(), { offline: true });
  await addSkewers(page, 'もも');
  const checks = () =>
    page.evaluate(
      () => (window as unknown as { updateChecks: number }).updateChecks,
    );
  const before = await checks();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect.poll(checks).toBeGreaterThan(before);
  await expect(page.getByLabel('ももの本数')).toHaveValue('1');
});

test('更新にバックアップの再読込は不要で、入力中・未保存の間は止め、記録を残して適用する', async ({
  page,
}) => {
  const workerPath = 'dist/sw.js';
  const original = await readFile(workerPath, 'utf8');
  try {
    await openFixture(page, await ledgerFixture({ orders: 1 }), {
      offline: true,
    });
    const quantity = page.getByLabel('ももの本数', { exact: true });
    await quantity.fill('1');
    // Serve a new worker from the dedicated test build, like a deployment.
    await writeFile(workerPath, `${original}\n// update-test ${Date.now()}\n`);
    await page.evaluate(async () =>
      (await navigator.serviceWorker.getRegistration())!.update(),
    );
    const update = page.getByRole('button', { name: '更新する', exact: true });
    await expect(update).toBeVisible({ timeout: 15000 });
    await expect(update).toBeDisabled();
    await expect(quantity).toHaveValue('1');
    await quantity.fill('0');
    await expect(update).toBeEnabled();
    await openScreen(page, '設定');
    await page.getByLabel('ももの通常価格（円）').fill('177');
    await expect(update).toBeDisabled();
    await page.getByLabel('ももの通常価格（円）').fill('150');
    await expect(update).toBeEnabled();
    await openScreen(page, '集計');
    await page.getByLabel('当日の経費').fill('100');
    await expect(update).toBeDisabled();
    await page.getByLabel('当日の経費').fill('');
    await expect(update).toBeEnabled();
    await update.click();
    await startCounter(page);
    await openScreen(page, '注文履歴');
    await expect(rows(page)).toHaveCount(1);
    await expect(page.locator('.history tbody')).toContainText('￥150');
  } finally {
    await writeFile(workerPath, original);
  }
});

test('別の日の準備で商品・セット・札・任意在庫を一括保存する', async ({
  page,
}) => {
  await loadFixture(
    page,
    await ledgerFixture({ orders: 1, price: { mix: false } }),
  );
  await page
    .getByRole('button', { name: '別の日の営業を準備', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: '別の日の営業を準備' });
  await dialog.getByLabel('営業日').fill('2027-11-06');
  await dialog.getByLabel('番号札の枚数').fill('25');
  await dialog.getByLabel('商品1の名前').fill('つくね');
  await dialog.getByLabel('つくねの通常価格（円）').fill('180');
  await dialog.getByLabel('セットの価格（円）').fill('700');
  await dialog.getByLabel('つくねの在庫').fill('100');
  await dialog.getByRole('button', { name: 'この営業日を準備' }).click();
  await startCounter(page);
  await expect(page.getByTestId('waiting-order')).toHaveCount(0);
  await expect(page.locator('.product').first()).toContainText('つくね');
  await expect(page.locator('.product').first()).toContainText('￥180');
  await expect(page.locator('.product').first()).toContainText('残り 100本');
  await expect(page.locator('.price-strip')).toContainText('￥700');
  await addSkewers(page, 'つくね', 3);
  await addSkewers(page, 'かわ', 2);
  await expect(page.getByTestId('total')).toHaveText('￥700');
  await openScreen(page, '設定');
  await expect(page.getByLabel('番号札の枚数')).toHaveValue('25');
  await openScreen(page, '注文履歴');
  await expect(rows(page)).toHaveCount(0);
  await expect(page.locator('.history-empty img')).toBeVisible();
});

test('初めてのブラウザでは準備画面が開き、入力エラーを画面内に示して商品と在庫を保存する', async ({
  page,
}) => {
  await page.goto('/');
  const setup = page.getByRole('dialog', { name: '営業の準備', exact: true });
  await expect(setup).toBeVisible();
  await setup.getByLabel('営業名').fill('  初回の練習  ');
  await setup.getByLabel('商品1の名前').fill('   ');
  await setup.getByRole('button', { name: '新しく作る', exact: true }).click();
  await expect(setup.getByRole('alert')).toBeVisible();
  await setup.getByLabel('商品1の名前').fill('もも');
  await setup.getByLabel('ももの在庫').fill('30');
  await setup.getByRole('button', { name: '新しく作る', exact: true }).click();
  await expect(page.locator('.startup-event')).toHaveText('初回の練習');
  await startCounter(page);
  await expect(page.locator('.product-stock')).toHaveText('残り 30本');
});
