import { expect, test } from '@playwright/test';
import { addSkewers, ledgerFixture, openFixture } from './helpers';

test('PCでは左に待ち注文・右に会計を並べ、狭い画面では会計を先に表示する', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openFixture(page, await ledgerFixture({ orders: 1, waiting: 1 }));
  const waiting = page.locator('.waiting.panel');
  const checkout = page.locator('.checkout.panel');
  const left = (await waiting.boundingBox())!;
  const right = (await checkout.boundingBox())!;
  expect(left.x + left.width).toBeLessThan(right.x);
  expect(left.y).toBe(right.y);
  await addSkewers(page, 'もも');
  await page.getByRole('button', { name: '会計へ', exact: true }).click();
  expect((await checkout.boundingBox())!.x).toBe(right.x);
  await page.setViewportSize({ width: 390, height: 844 });
  expect((await checkout.boundingBox())!.y).toBeLessThan(
    (await waiting.boundingBox())!.y,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
