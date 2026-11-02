import { expect, test, type Page } from '@playwright/test';
import { addSkewers, ledgerFixture, openFixture, openScreen } from './helpers';

async function mockCapacity(page: Page, usage = 20) {
  await page.addInitScript((usage) => {
    const state = { usage, quota: 100 };
    Object.assign(window, { testStorageEstimate: state });
    Object.defineProperty(navigator.storage, 'estimate', {
      configurable: true,
      value: async () => ({ ...state }),
    });
  }, usage);
}

test('起動時と60秒ごとの確認で保存容量の不足を知らせる', async ({ page }) => {
  await page.clock.install();
  await mockCapacity(page, 95);
  await openFixture(page, await ledgerFixture());
  const warning = page.getByRole('dialog', {
    name: '保存容量が少なくなっています',
  });
  await expect(warning).toBeVisible();
  await warning
    .getByRole('button', { name: '閉じる', exact: true })
    .first()
    .click();
  await setCapacity(page, 20);
  await page.evaluate(() => {
    (
      window as unknown as { testStorageEstimate: StorageEstimate }
    ).testStorageEstimate.usage = 95;
  });
  await page.clock.fastForward(60_000);
  await expect(warning).toBeVisible();
});

async function setCapacity(page: Page, usage: number, quota = 100) {
  await page.evaluate(
    ({ usage, quota }) => {
      Object.assign(
        (window as unknown as { testStorageEstimate: StorageEstimate })
          .testStorageEstimate,
        { usage, quota },
      );
      window.dispatchEvent(new Event('focus'));
    },
    { usage, quota },
  );
}

test('容量警告は90%から表示し、85%未満に戻るまで繰り返さない', async ({
  page,
}) => {
  await mockCapacity(page);
  await openFixture(page, await ledgerFixture());
  const warning = page.getByRole('dialog', {
    name: '保存容量が少なくなっています',
  });
  await setCapacity(page, 89);
  await expect(warning).not.toBeVisible();
  await setCapacity(page, 90);
  await expect(warning).toBeVisible();
  await expect(warning).toContainText('バックアップ');
  await warning
    .getByRole('button', { name: '閉じる', exact: true })
    .first()
    .click();
  await setCapacity(page, 95);
  await expect(warning).not.toBeVisible();
  await setCapacity(page, 85);
  await setCapacity(page, 90);
  await expect(warning).not.toBeVisible();
  await setCapacity(page, 84);
  await setCapacity(page, 90);
  await expect(warning).toBeVisible();
});

test('会計入力と設定の未保存中は容量警告を待ち、入力を失わせない', async ({
  page,
}) => {
  await mockCapacity(page);
  await openFixture(page, await ledgerFixture());
  const warning = page.getByRole('dialog', {
    name: '保存容量が少なくなっています',
  });
  await addSkewers(page, 'もも');
  await setCapacity(page, 95);
  await expect(warning).not.toBeVisible();
  await expect(page.getByLabel('ももの本数', { exact: true })).toHaveValue('1');
  await page.getByRole('button', { name: '注文をクリア', exact: true }).click();
  await expect(warning).toBeVisible();
  await warning
    .getByRole('button', { name: '閉じる', exact: true })
    .first()
    .click();
  await setCapacity(page, 20);
  await openScreen(page, '設定');
  const price = page.getByLabel('ももの通常価格（円）');
  await price.fill('180');
  await setCapacity(page, 95);
  await expect(warning).not.toBeVisible();
  await expect(price).toHaveValue('180');
  await price.fill('150');
  await expect(warning).toBeVisible();
});

test('保存上限が不明または0なら警告せず、設定の容量表示を16pxで揃える', async ({
  page,
}) => {
  await mockCapacity(page);
  await openFixture(page, await ledgerFixture());
  await setCapacity(page, 100, 0);
  await expect(
    page.getByRole('dialog', { name: '保存容量が少なくなっています' }),
  ).not.toBeVisible();
  await page.evaluate(() => {
    (
      window as unknown as { testStorageEstimate: StorageEstimate }
    ).testStorageEstimate.quota = undefined;
    window.dispatchEvent(new Event('focus'));
  });
  await expect(
    page.getByRole('dialog', { name: '保存容量が少なくなっています' }),
  ).not.toBeVisible();
  await setCapacity(page, 20);
  await openScreen(page, '設定');
  const capacity = page
    .locator('.storage-capacity')
    .getByRole('definition')
    .locator('..');
  await expect(capacity).toHaveCount(2);
  const sizes = await page
    .locator('.storage-capacity dt, .storage-capacity dd')
    .evaluateAll((elements) =>
      elements.map((element) => getComputedStyle(element).fontSize),
    );
  expect(sizes).toEqual(['16px', '16px', '16px', '16px']);
  const labels = await page
    .locator('.storage-capacity dt')
    .evaluateAll((elements) =>
      elements.map((element) => element.getBoundingClientRect().x),
    );
  expect(labels[0]).toBe(labels[1]);
});
