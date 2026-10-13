import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test.describe('shared base components', () => {
  test('render without page errors, keep roles and 44 pt targets', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/?ui-kit');
    await expect(page.getByTestId('kit-card')).toBeVisible();
    const save = page.getByRole('button', { name: 'Guardar', exact: true });
    expect((await save.boundingBox()).height).toBeGreaterThanOrEqual(44);
    expect((await page.getByRole('button', { name: 'Cerrar kit' }).boundingBox()).width).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });

  test('a loading or disabled button does not fire onPress; enabled one does', async ({ page }) => {
    await page.goto('/?ui-kit');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page.getByTestId('kit-presses')).toHaveText('pulsaciones:1');
    await expect(page.getByRole('button', { name: 'Deshabilitado' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Enviando' })).toBeDisabled();
  });

  test('text field forwards nativeID and chips expose selected state', async ({ page }) => {
    await page.goto('/?ui-kit');
    await expect(page.locator('#kit-field')).toBeVisible();
    await page.getByRole('button', { name: 'Opción B' }).click();
    await expect(page.getByRole('button', { name: 'Opción B' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Opción A' })).toHaveAttribute('aria-pressed', 'false');
  });

  test('sheet closes on outside tap without adding a second Cerrar button', async ({ page }) => {
    await page.goto('/?ui-kit');
    await page.getByRole('button', { name: 'Abrir sheet' }).click();
    await expect(page.getByTestId('kit-sheet')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cerrar', exact: true })).toHaveCount(1);
    await page.mouse.click(195, 40);
    await expect(page.getByTestId('kit-sheet')).toHaveCount(0);
  });

  test('numbers use tabular figures in Work Sans', async ({ page }) => {
    await page.goto('/?ui-kit');
    const style = await page.getByTestId('kit-number').evaluate((el) => getComputedStyle(el));
    expect(style.fontFamily).toContain('WorkSans_700Bold');
    expect(style.fontVariantNumeric).toContain('tabular-nums');
  });
});
