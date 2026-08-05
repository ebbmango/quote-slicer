import { expect, test, type Page } from '@playwright/test';

test('publishes every layout mode at its exact boundaries', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 740 });
	await page.goto('/');

	const layout = page.locator('.layout');
	const cases = [
		{ size: { width: 899, height: 999 }, mode: 'drawer' },
		{ size: { width: 899, height: 1000 }, mode: 'bottom' },
		{ size: { width: 900, height: 1000 }, mode: 'single' },
		{ size: { width: 1199, height: 740 }, mode: 'single' },
		{ size: { width: 1200, height: 1000 }, mode: 'double' }
	] as const;

	for (const { size, mode } of cases) {
		await page.setViewportSize(size);
		await expect(layout).toHaveAttribute('data-layout-mode', mode);
	}
});

test('derives macro geometry from the published layout mode', async ({ page }) => {
	await page.setViewportSize({ width: 900, height: 740 });
	await page.goto('/');
	await expect(page.locator('.sidebar-left')).toHaveCSS('display', 'block');
	await page.getByRole('button', { name: 'next' }).click();

	const mappings = page.getByRole('listbox', { name: 'Mappings' });
	await expect
		.poll(() =>
			mappings.evaluate(
				(element) => getComputedStyle(element).gridTemplateColumns.split(' ').length
			)
		)
		.toBe(1);

	await page
		.locator('.layout')
		.evaluate((layout) => layout.setAttribute('data-layout-mode', 'drawer'));

	await expect(page.locator('.sidebar-left')).toHaveCSS('display', 'none');

	await page
		.locator('.layout')
		.evaluate((layout) => layout.setAttribute('data-layout-mode', 'bottom'));
	await expect
		.poll(() =>
			mappings.evaluate(
				(element) => getComputedStyle(element).gridTemplateColumns.split(' ').length
			)
		)
		.toBe(2);
});

async function layoutSnapshot(page: Page) {
	return page.evaluate(() => {
		const rectFor = (selector: string) => {
			const element = document.querySelector(selector);
			const rect = element?.getBoundingClientRect();

			if (!element || !rect) {
				throw new Error(`Missing element: ${selector}`);
			}

			return {
				x: Math.round(rect.x),
				y: Math.round(rect.y),
				width: Math.round(rect.width),
				height: Math.round(rect.height),
				display: getComputedStyle(element).display
			};
		};

		return {
			left: rectFor('.sidebar-left'),
			content: rectFor('.content'),
			right: rectFor('.sidebar-right')
		};
	});
}

test('keeps open-panel geometry aligned through every live layout transition', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 740 });
	await page.goto('/');
	await page.getByRole('button', { name: 'next' }).click();
	await expect(page.locator('.layout')).toHaveClass(/panels-open/);

	await expect
		.poll(async () => {
			const { left, content, right } = await layoutSnapshot(page);
			return {
				mode: await page.locator('.layout').getAttribute('data-layout-mode'),
				leftHidden: left.display === 'none',
				rightHidden: right.display === 'none',
				contentVisible: content.width > 300 && content.height > 600
			};
		})
		.toEqual({
			mode: 'drawer',
			leftHidden: true,
			rightHidden: true,
			contentVisible: true
		});

	await page.setViewportSize({ width: 820, height: 1100 });
	await expect
		.poll(async () => {
			const { left, content, right } = await layoutSnapshot(page);
			return {
				mode: await page.locator('.layout').getAttribute('data-layout-mode'),
				leftVisible: left.display === 'block' && left.height > 0,
				rightHidden: right.display === 'none',
				sameWidth: Math.abs(left.width - content.width) <= 1,
				verticalRatio: Math.abs(content.height / left.height - 2) < 0.02,
				stacked: left.y > content.y
			};
		})
		.toEqual({
			mode: 'bottom',
			leftVisible: true,
			rightHidden: true,
			sameWidth: true,
			verticalRatio: true,
			stacked: true
		});

	await page.setViewportSize({ width: 900, height: 740 });
	await expect
		.poll(async () => {
			const { left, content, right } = await layoutSnapshot(page);
			return {
				mode: await page.locator('.layout').getAttribute('data-layout-mode'),
				leftVisible: left.display === 'block' && left.width > 0,
				rightHidden: right.display === 'none',
				horizontalRatio: Math.abs(content.width / left.width - 2) < 0.02,
				sameHeight: Math.abs(left.height - content.height) <= 1
			};
		})
		.toEqual({
			mode: 'single',
			leftVisible: true,
			rightHidden: true,
			horizontalRatio: true,
			sameHeight: true
		});

	await page.setViewportSize({ width: 1440, height: 900 });
	await expect
		.poll(async () => {
			const { left, content, right } = await layoutSnapshot(page);
			return {
				mode: await page.locator('.layout').getAttribute('data-layout-mode'),
				bothVisible:
					left.display === 'block' &&
					right.display === 'block' &&
					left.width > 0 &&
					right.width > 0,
				equalSidebars: Math.abs(left.width - right.width) <= 1,
				horizontalRatio: Math.abs(content.width / left.width - 2) < 0.02,
				sameHeight:
					Math.abs(left.height - content.height) <= 1 &&
					Math.abs(right.height - content.height) <= 1
			};
		})
		.toEqual({
			mode: 'double',
			bothVisible: true,
			equalSidebars: true,
			horizontalRatio: true,
			sameHeight: true
		});
});

test.describe('server-rendered layout fallback', () => {
	test.use({ javaScriptEnabled: false });

	test('keeps the visible content full-sized before layout mode can be measured', async ({
		page
	}) => {
		for (const size of [
			{ width: 390, height: 740 },
			{ width: 1440, height: 900 }
		]) {
			await page.setViewportSize(size);
			await page.goto('/');
			await expect(page.locator('.layout')).toHaveAttribute('data-layout-mode', 'single');

			const { left, content, right } = await layoutSnapshot(page);
			expect(left.width).toBe(0);
			expect(right.display).toBe('none');
			expect(content.width).toBeGreaterThan(size.width - 80);
			expect(content.height).toBeGreaterThan(size.height - 80);
		}
	});
});

test.describe('workbench side panels', () => {
	test.use({ viewport: { width: 1440, height: 900 } });

	test('slides side panels in without reserving double-layout space in text tool', async ({
		page
	}) => {
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

		// Opacity settles before the 500ms grid/transform slide. Poll the final
		// geometry so this assertion cannot sample the sidebars mid-transition.
		await expect
			.poll(async () => {
				const panelMode = await layoutSnapshot(page);
				return {
					leftOnscreen: panelMode.left.x > 0,
					leftWide: panelMode.left.width > 300,
					contentNarrow: panelMode.content.width < 700,
					rightOnscreen: panelMode.right.x + panelMode.right.width <= 1440,
					rightWide: panelMode.right.width > 300
				};
			})
			.toEqual({
				leftOnscreen: true,
				leftWide: true,
				contentNarrow: true,
				rightOnscreen: true,
				rightWide: true
			});
	});
});
