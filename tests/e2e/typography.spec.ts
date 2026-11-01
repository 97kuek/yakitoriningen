import { test, expect, type Page } from '@playwright/test';
import { historyFixture, openFixture } from './fixtures';

async function expectThreeSizes(page: Page) {
  const visible = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('body *')]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const hasText = [...element.childNodes].some(
          (child) =>
            child.nodeType === Node.TEXT_NODE && child.textContent?.trim(),
        );
        return (
          !element.closest('.sr-only, svg') &&
          rect.width > 2 &&
          rect.height > 2 &&
          style.visibility === 'visible' &&
          style.display !== 'none' &&
          (hasText || element.matches('input, button'))
        );
      })
      .map((element) => ({
        tag: element.tagName,
        text: element.textContent?.trim().slice(0, 30),
        size: getComputedStyle(element).fontSize,
      })),
  );
  expect(
    visible.filter(
      (element) => !['12px', '16px', '24px'].includes(element.size),
    ),
  ).toEqual([]);
}

test('営業開始・会計・売上・設定・返金の文字サイズは3種類', async ({
  page,
}) => {
  await page.goto('/');
  await expectThreeSizes(page);
  await openFixture(page, await historyFixture(0));
  await expectThreeSizes(page);
  await page.getByRole('button', { name: 'ももを1本増やす' }).click();
  await page.getByRole('button', { name: '会計へ', exact: true }).click();
  await page.getByRole('button', { name: 'ちょうど', exact: true }).click();
  await page.getByRole('button', { name: 'お釣りを確認', exact: true }).click();
  await expectThreeSizes(page);
  await page.getByRole('button', { name: '会計を確定', exact: true }).click();
  await page.getByRole('button', { name: '売上・履歴', exact: true }).click();
  await expectThreeSizes(page);
  await page.getByRole('button', { name: '全額返金', exact: true }).click();
  await expectThreeSizes(page);
  await page
    .getByRole('dialog', { name: '全額返金' })
    .getByRole('button', { name: '閉じる', exact: true })
    .click();
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await expectThreeSizes(page);
});
