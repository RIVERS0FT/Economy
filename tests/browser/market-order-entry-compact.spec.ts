import { expect, test, type Locator } from '@playwright/test';

async function requireBox(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

async function expectEmbeddedStepper(
  input: Locator,
  label: Locator,
  decrease: Locator,
  increase: Locator,
) {
  const inputBox = await requireBox(input);
  const labelBox = await requireBox(label);
  const decreaseBox = await requireBox(decrease);
  const increaseBox = await requireBox(increase);

  expect(Math.abs((labelBox.y + labelBox.height / 2) - (inputBox.y + inputBox.height / 2))).toBeLessThan(3);
  expect(decreaseBox.x).toBeGreaterThanOrEqual(inputBox.x - 1);
  expect(decreaseBox.x + decreaseBox.width).toBeLessThan(inputBox.x + inputBox.width / 2);
  expect(increaseBox.x).toBeGreaterThan(inputBox.x + inputBox.width / 2);
  expect(increaseBox.x + increaseBox.width).toBeLessThanOrEqual(inputBox.x + inputBox.width + 1);
}

test('market order fields keep labels and embedded steppers on one row', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('market-runtime-test.html?scenario=active');

  const tradeCard = page.locator('.market-trade-card');
  const priceInput = page.getByRole('textbox', { name: '价格' });
  const quantityInput = page.getByRole('spinbutton', { name: '数量' });

  await expectEmbeddedStepper(
    priceInput,
    tradeCard.locator('label[for="market-order-price"] > .ui-form-field__label'),
    page.getByRole('button', { name: '价格减少 0.01' }),
    page.getByRole('button', { name: '价格增加 0.01' }),
  );
  await expectEmbeddedStepper(
    quantityInput,
    tradeCard.locator('label[for="market-order-quantity"] > .ui-form-field__label'),
    page.getByRole('button', { name: '数量减少 1' }),
    page.getByRole('button', { name: '数量增加 1' }),
  );

  await expect(tradeCard.locator('.market-order-details')).toHaveCount(0);
  await expect(tradeCard.getByText('交易资产详情', { exact: true })).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileDecrease = await requireBox(page.getByRole('button', { name: '价格减少 0.01' }));
  const mobileIncrease = await requireBox(page.getByRole('button', { name: '价格增加 0.01' }));
  expect(mobileDecrease.width).toBeGreaterThanOrEqual(44);
  expect(mobileDecrease.height).toBeGreaterThanOrEqual(44);
  expect(mobileIncrease.width).toBeGreaterThanOrEqual(44);
  expect(mobileIncrease.height).toBeGreaterThanOrEqual(44);
});

test('focused market price input owns the wheel in 0.01 steps', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 700 });
  await page.goto('market-runtime-test.html?scenario=active');

  const priceInput = page.getByRole('textbox', { name: '价格' });
  const pageScroll = page.locator('.page-scroll');
  await expect(priceInput).toHaveValue('2');
  await priceInput.focus();
  await priceInput.hover();
  const beforeScroll = await pageScroll.evaluate((element) => element.scrollTop);

  await page.mouse.wheel(0, -120);
  await expect(priceInput).toHaveValue('2.01');
  expect(await pageScroll.evaluate((element) => element.scrollTop)).toBe(beforeScroll);

  await page.mouse.wheel(0, 120);
  await expect(priceInput).toHaveValue('2.00');
  expect(await pageScroll.evaluate((element) => element.scrollTop)).toBe(beforeScroll);

  await page.getByRole('button', { name: '买入', exact: true }).focus();
  await priceInput.hover();
  await page.mouse.wheel(0, -120);
  await expect(priceInput).toHaveValue('2.00');
});

test('market order book yields width to the order entry on desktop and mobile', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('market-runtime-test.html?scenario=active');

  const entry = page.locator('.market-trade-entry');
  const book = page.locator('.market-trade-book');
  const desktopEntry = await requireBox(entry);
  const desktopBook = await requireBox(book);
  expect(desktopEntry.width / desktopBook.width).toBeGreaterThan(1.35);
  expect(desktopEntry.width / desktopBook.width).toBeLessThan(1.75);

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileEntry = await requireBox(entry);
  const mobileBook = await requireBox(book);
  expect(Math.abs(mobileEntry.y - mobileBook.y)).toBeLessThan(3);
  expect(mobileEntry.width / mobileBook.width).toBeGreaterThan(1.4);
  expect(mobileEntry.width / mobileBook.width).toBeLessThan(2.3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
