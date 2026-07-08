import { expect, test, type Page } from '@playwright/test';

async function layoutSnapshot(page: Page) {
	return page.evaluate(() => {
		const rectFor = (selector: string) => {
			const rect = document.querySelector(selector)?.getBoundingClientRect();

			if (!rect) {
				throw new Error(`Missing element: ${selector}`);
			}

			return {
				x: Math.round(rect.x),
				width: Math.round(rect.width)
			};
		};

		return {
			left: rectFor('.sidebar-left'),
			content: rectFor('.content'),
			right: rectFor('.sidebar-right')
		};
	});
}

test.describe('workbench side panels', () => {
	test.use({ viewport: { width: 1440, height: 900 } });

	test('slides side panels in without reserving desktop space in text tool', async ({ page }) => {
		await page.goto('/');

		await expect(page.locator('.sidebar-left')).toHaveCSS('opacity', '0');
		await expect(page.locator('.sidebar-right')).toHaveCSS('opacity', '0');

		const textMode = await layoutSnapshot(page);
		expect(textMode.left.width).toBe(0);
		expect(textMode.content.width).toBeGreaterThan(1300);
		expect(textMode.right.width).toBe(0);

		await page.getByRole('button', { name: 'next' }).click();

		await expect(page.locator('.sidebar-left')).toHaveCSS('opacity', '1');
		await expect(page.locator('.sidebar-right')).toHaveCSS('opacity', '1');

		const panelMode = await layoutSnapshot(page);
		expect(panelMode.left.x).toBeGreaterThan(0);
		expect(panelMode.left.width).toBeGreaterThan(300);
		expect(panelMode.content.width).toBeLessThan(700);
		expect(panelMode.right.x + panelMode.right.width).toBeLessThanOrEqual(1440);
		expect(panelMode.right.width).toBeGreaterThan(300);
	});
});
