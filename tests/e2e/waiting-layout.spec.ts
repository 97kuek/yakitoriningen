import { expect, test } from '@playwright/test';
import { completeButton, ledgerFixture, openFixture } from './helpers';

for (const width of [1280, 1089]) {
  test(`札回収の前後で平均待ちの位置が変わらない (${width}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 640 });
    await openFixture(page, await ledgerFixture({ orders: 2, waiting: 2 }));
    const estimate = page.locator('.wait-estimate');
    const before = (await estimate.boundingBox())!;
    await completeButton(page).first().click();
    await expect(page.getByTestId('waiting-order')).toHaveCount(1);
    const undo = page.getByRole('button', {
      name: '直前の回収を取り消す',
      exact: true,
    });
    await expect(undo).toHaveText('回収取消');
    const after = (await estimate.boundingBox())!;
    expect(after.x).toBe(before.x);
    expect(after.x + after.width).toBe(before.x + before.width);
    expect(after.y).toBe(before.y);
    expect(
      await undo.evaluate((element) => !!element.closest('.section-heading')),
    ).toBe(false);
    await undo.click();
    await expect(page.getByTestId('waiting-order')).toHaveCount(2);
  });
}
