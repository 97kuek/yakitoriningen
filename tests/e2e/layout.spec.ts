import { expect, test, type Page } from '@playwright/test';
import { addSkewers, ledgerFixture, openFixture, openScreen } from './helpers';

/** Every visible text uses one of the three font sizes. */
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
  await openFixture(page, await ledgerFixture());
  await expectThreeSizes(page);
  await addSkewers(page, 'もも');
  await page.getByRole('button', { name: '会計へ', exact: true }).click();
  await page.getByRole('button', { name: 'ちょうど', exact: true }).click();
  await page.getByRole('button', { name: 'お釣りを確認', exact: true }).click();
  await expectThreeSizes(page);
  await page.getByRole('button', { name: '会計を確定', exact: true }).click();
  await openScreen(page, '注文履歴');
  await expectThreeSizes(page);
  await page.getByRole('button', { name: '全額返金', exact: true }).click();
  await expectThreeSizes(page);
  await page
    .getByRole('dialog', { name: '全額返金' })
    .getByRole('button', { name: '閉じる', exact: true })
    .click();
  await openScreen(page, '設定');
  await expectThreeSizes(page);
  await openScreen(page, '集計');
  await expectThreeSizes(page);
});

test('選択欄は標準メニューや二重枠を使わず、開閉しても位置が変わらずキーボードで操作できる', async ({
  page,
}) => {
  await openFixture(page, await ledgerFixture());
  await openScreen(page, '注文履歴');
  await expect(page.locator('select')).toHaveCount(0);
  const select = page.getByRole('combobox', { name: '表示する日' });
  const listbox = page.getByRole('listbox', { name: '表示する日' });
  const before = await select.boundingBox();
  await select.click();
  await expect(listbox).toBeVisible();
  await expect(select).toHaveCSS('outline-style', 'none');
  await expect(select).toHaveCSS('box-shadow', 'none');
  expect(await select.boundingBox()).toEqual(before);
  await select.press('Escape');
  await expect(listbox).not.toBeVisible();
  await expect(select).toBeFocused();
  await select.press('ArrowDown');
  await expect(listbox).toBeVisible();
  await select.press('ArrowDown');
  await select.press('Enter');
  await expect(select).toHaveText('11/7');
  await expect(select).toBeFocused();
  await select.press('Enter');
  await select.press('Escape');
  await expect(page.getByRole('listbox')).not.toBeVisible();
  await expect(select).toBeFocused();
});

test('会計画面は空の通知行を作らず価格を揃え、ロゴで入力を残して戻り、簡潔なアプリ情報を示す', async ({
  page,
}) => {
  await page.setViewportSize({ width: 834, height: 827 });
  await openFixture(page, await ledgerFixture());
  await expect(page.locator('#checkout-title svg')).toHaveCount(0);
  await expect(page.locator('.checkout > .checkout-feedback')).toHaveCount(0);
  const prices = await page
    .locator('.product-name small')
    .evaluateAll((items) =>
      items.map((item) => item.getBoundingClientRect().right),
    );
  expect(Math.max(...prices) - Math.min(...prices)).toBeLessThan(1);
  const plus = page.getByRole('button', { name: 'ももを1本増やす' });
  const before = (await plus.boundingBox())!;
  await plus.click();
  await page.getByRole('button', { name: '注文をクリア' }).click();
  expect((await plus.boundingBox())!.y).toBe(before.y);

  const mascot = page.locator('.waiting .empty img');
  await expect(mascot).toHaveAttribute('src', '/assets/empty-orders.gif');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect
    .poll(() => mascot.evaluate((img: HTMLImageElement) => img.currentSrc))
    .toContain('empty-orders-still.png');

  await page.getByLabel('ももの本数', { exact: true }).fill('2');
  await openScreen(page, '注文履歴');
  await expect(page.locator('.history .empty-text')).toHaveCSS(
    'text-align',
    'center',
  );
  await page.getByRole('link', { name: '焼き鳥人間・会計へ戻る' }).click();
  await expect(page.getByLabel('ももの本数', { exact: true })).toHaveValue('2');

  await page.getByRole('button', { name: 'このアプリについて' }).click();
  const dialog = page.getByRole('dialog');
  await expect(
    dialog.getByRole('link', { name: 'ueki.keitaro@gmail.com' }),
  ).toHaveAttribute('href', 'mailto:ueki.keitaro@gmail.com');
  await expect(
    dialog.getByRole('link', { name: 'GitHub', exact: true }),
  ).toHaveAttribute('href', 'https://github.com/97kuek/yakitoriningen');
  await expect(dialog.getByRole('link', { name: 'MIT License' })).toBeVisible();
  const labels = await page.locator('.about-details dt').all();
  const values = await page.locator('.about-details dd').all();
  for (let i = 0; i < labels.length; i++)
    expect(
      Math.abs(
        (await labels[i].boundingBox())!.y - (await values[i].boundingBox())!.y,
      ),
    ).toBeLessThan(1);
});

test('合計の横にセット内訳を置き、お釣りを筆算順に揃え、待ち本数と札を見やすく示す', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1019, height: 827 });
  await openFixture(page, await ledgerFixture());
  await expect(page.locator('.price-strip')).toContainText('通常価格');
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
  await expect(page.locator('.receipt-items')).toHaveCSS('font-size', '16px');
  await expect(page.locator('.payment .ticket-chip')).toHaveText('札 1');
  await page.getByRole('button', { name: '￥2,000', exact: true }).click();
  await page.getByRole('button', { name: 'お釣りを確認' }).click();
  const calculation = page.locator('.cash-calculation > div');
  await expect(calculation.locator('.cash-label')).toHaveText([
    'お預かり',
    '−お会計',
    'お釣り',
  ]);
  // The minus sits in its own slot, so the label names start on one line.
  const starts = await calculation
    .locator('.cash-name')
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getBoundingClientRect().left),
    );
  expect(Math.max(...starts) - Math.min(...starts)).toBeLessThanOrEqual(1);
  const edges = await calculation
    .locator('strong')
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getBoundingClientRect().right),
    );
  expect(Math.max(...edges) - Math.min(...edges)).toBeLessThanOrEqual(1);
  await page.getByRole('button', { name: '会計を確定' }).click();
  await expect(page.locator('.waiting .ticket-chip')).toHaveText('札 1');
  await expect(page.getByTestId('checkout-feedback')).toBeEmpty();

  const totals = page.getByRole('group', {
    name: '未受け渡しの本数（調理済み分を含む）',
  });
  await expect(totals).toContainText('もも3本');
  await expect(totals).toContainText('かわ3本');
  await expect(totals.locator('strong').first()).toHaveCSS('font-size', '24px');
  await openScreen(page, '注文履歴');
  await page.getByRole('button', { name: '注文の詳細', exact: true }).click();
  await expect(
    page.getByRole('list', { name: '注文した商品' }).locator('li'),
  ).toHaveCount(3);
});
