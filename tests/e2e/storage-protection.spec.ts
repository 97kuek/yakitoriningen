import { expect, test, type Page } from '@playwright/test';
import {
  addSkewers,
  ledgerFixture,
  openFixture,
  openScreen,
  pay,
  startCounter,
} from './helpers';

async function storagePermission(
  page: Page,
  result: 'granted' | 'protected' | 'denied' | 'unsupported' | 'error',
) {
  await page.addInitScript((result) => {
    const state = { checks: 0, requests: 0 };
    Object.assign(window, { testProtection: state });
    Object.defineProperty(navigator.storage, 'persisted', {
      configurable: true,
      value: async () => {
        state.checks++;
        return result === 'protected';
      },
    });
    Object.defineProperty(navigator.storage, 'persist', {
      configurable: true,
      value:
        result === 'unsupported'
          ? undefined
          : async () => {
              state.requests++;
              if (result === 'error') throw new Error('Storage unavailable');
              return result === 'granted';
            },
    });
  }, result);
}

const protectionCalls = (page: Page) =>
  page.evaluate(
    () =>
      (
        window as unknown as {
          testProtection: { checks: number; requests: number };
        }
      ).testProtection,
  );

test('初回の営業準備後に記録保護を自動要求し、画面の往復では繰り返さない', async ({
  page,
}) => {
  await storagePermission(page, 'granted');
  await page.goto('/');
  await page.getByRole('button', { name: '営業を準備', exact: true }).click();
  await page.getByLabel('営業名').fill('自動保護の試験');
  await expect
    .poll(() => protectionCalls(page))
    .toEqual({
      checks: 0,
      requests: 0,
    });
  await page.getByRole('button', { name: '新しく作る', exact: true }).click();
  await expect
    .poll(() => protectionCalls(page))
    .toEqual({
      checks: 1,
      requests: 1,
    });
  await startCounter(page);
  await openScreen(page, '設定');
  await expect(
    page.getByText('自動削除の防止：有効', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '記録を保護する' }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'ホームへ戻る', exact: true }).click();
  await startCounter(page);
  await openScreen(page, '設定');
  expect(await protectionCalls(page)).toEqual({ checks: 1, requests: 1 });
});

test('保護済みのブラウザでは許可要求を省き、再起動しても状態を読み取る', async ({
  page,
}) => {
  await storagePermission(page, 'protected');
  await openFixture(page, await ledgerFixture());
  await openScreen(page, '設定');
  await expect(
    page.getByText('自動削除の防止：有効', { exact: true }),
  ).toBeVisible();
  expect(await protectionCalls(page)).toEqual({ checks: 1, requests: 0 });
  await page.reload();
  await startCounter(page);
  await openScreen(page, '設定');
  await expect(
    page.getByText('自動削除の防止：有効', { exact: true }),
  ).toBeVisible();
  expect(await protectionCalls(page)).toEqual({ checks: 1, requests: 0 });
});

for (const result of ['denied', 'unsupported', 'error'] as const) {
  test(`記録保護が${result}でも会計を止めず、設定に結果を表示する`, async ({
    page,
  }) => {
    await storagePermission(page, result);
    await openFixture(page, await ledgerFixture());
    await openScreen(page, '設定');
    await expect(
      page.getByText(
        result === 'denied'
          ? '自動削除の防止は許可されていません。バックアップを保存してください。'
          : '自動削除の防止を設定できません。バックアップを保存してください。',
        { exact: true },
      ),
    ).toBeVisible();
    await openScreen(page, '会計');
    await addSkewers(page, 'もも');
    await pay(page, '500');
    await expect(page.getByTestId('waiting-order')).toHaveCount(1);
    expect((await protectionCalls(page)).requests).toBe(
      result === 'unsupported' ? 0 : 1,
    );
  });
}
