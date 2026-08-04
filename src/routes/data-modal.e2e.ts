import { expect, test, type Page } from '@playwright/test';

// Regression guard for the drawer layout's data modal slide transitions.
//
// The modal previously used separate `in:fly` / `out:fly` directives. Those are
// not bidirectional: reopening (or switching sides) while the outro was still
// running started the intro on top of it, and the two transforms composed —
// the panel jumped to ±2× the slide distance, teleported across the screen, or
// parked fully off-screen while "open". A single `transition:fly` reverses the
// in-flight animation instead, so the panel can never leave the ±(viewport
// width) slide range and always settles at translateX(0) when open.

async function startTransformRecorder(page: Page) {
	await page.evaluate(() => {
		const rec: (number | null)[] = [];
		(window as unknown as { __rec: (number | null)[] }).__rec = rec;
		const tick = () => {
			const el = document.querySelector('.data-modal');
			let tx: number | null = null;
			if (el) {
				const tr = getComputedStyle(el).transform;
				tx = tr === 'none' ? 0 : Math.round(parseFloat(tr.slice('matrix('.length).split(',')[4]));
			}
			rec.push(tx);
			requestAnimationFrame(tick);
		};
		requestAnimationFrame(tick);
	});
}

test.describe('data modal slide transitions (drawer layout)', () => {
	test.use({ viewport: { width: 390, height: 740 } });

	test('rapid open/close/swap taps never compose transforms or strand the panel', async ({
		page
	}) => {
		await page.goto('/');
		// Give hydration a beat: the arrow's click handler only exists post-mount.
		await page.waitForLoadState('networkidle');
		await page.waitForTimeout(500);
		await page.getByRole('button', { name: 'next' }).click();

		const maps = page.getByTestId('maps-modal');
		const json = page.getByTestId('json-modal');
		await expect(maps).toBeVisible();

		await startTransformRecorder(page);

		// Thumb-speed hammer: open, close and swap in every combination, with
		// gaps shorter than the 450ms slide so taps land mid-transition.
		const sequence = [maps, maps, maps, json, json, maps, json, maps, maps, json, json, maps];
		for (const [i, button] of sequence.entries()) {
			await button.click();
			await page.waitForTimeout(90 + (i % 4) * 110);
		}
		// Sequence ends on an odd number of net opens: the modal must settle open.
		await page.waitForTimeout(1500);

		const rec = await page.evaluate(
			() => (window as unknown as { __rec: (number | null)[] }).__rec
		);
		const present = rec.filter((tx): tx is number => tx !== null);
		expect(present.length).toBeGreaterThan(50);

		// Composed in/out animations previously reached ±2× the slide distance.
		const maxAbs = Math.max(...present.map(Math.abs));
		expect(maxAbs).toBeLessThanOrEqual(391);

		// The panel must end open, on-screen, at rest — not parked off-screen.
		expect(rec[rec.length - 1]).toBe(0);
		await expect(page.locator('.data-modal')).toBeVisible();

		// And a calm close must still slide it out and unmount it.
		await maps.click();
		await expect(page.locator('.data-modal')).toHaveCount(0);
	});
});

test.describe('layout mode toolbar routing', () => {
	const asideLayouts = [
		{ name: 'single', size: { width: 1000, height: 740 } },
		{ name: 'bottom', size: { width: 820, height: 1100 } }
	];

	for (const { name, size } of asideLayouts) {
		test(`${name} layout uses the aside toggle, not modal controls`, async ({ page }) => {
			await page.setViewportSize(size);
			await page.goto('/');
			await page.waitForLoadState('networkidle');
			await page.waitForTimeout(500);
			await page.getByRole('button', { name: 'next' }).click();

			const maps = page.getByTestId('maps-aside');
			const json = page.getByTestId('json-aside');
			await expect(maps).toBeVisible();
			await expect(json).toBeVisible();
			await expect(page.getByTestId('maps-modal')).toHaveCount(0);
			await expect(page.getByTestId('json-modal')).toHaveCount(0);

			await expect(maps).toHaveCSS('opacity', '1');
			await expect(json).toHaveCSS('opacity', '0.2');

			await json.click();
			await expect(page.locator('.data-modal')).toHaveCount(0);
			await expect(maps).toHaveCSS('opacity', '0.2');
			await expect(json).toHaveCSS('opacity', '1');
		});
	}

	test('reroutes the toolbar when the viewport changes after mount', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 740 });
		await page.goto('/');
		await page.waitForLoadState('networkidle');
		await page.waitForTimeout(500);
		await page.getByRole('button', { name: 'next' }).click();
		await expect(page.getByTestId('maps-modal')).toBeVisible();

		await page.setViewportSize({ width: 820, height: 1100 });
		await expect(page.getByTestId('maps-aside')).toBeVisible();

		await page.setViewportSize({ width: 1440, height: 900 });
		await expect(page.getByTestId('maps-aside')).toHaveCount(0);

		await page.setViewportSize({ width: 390, height: 740 });
		await expect(page.getByTestId('maps-modal')).toBeVisible();
	});

	test('reroutes and force-closes at the tall boundary without a width change', async ({
		page
	}) => {
		await page.setViewportSize({ width: 820, height: 999 });
		await page.goto('/');
		await page.waitForLoadState('networkidle');
		await page.waitForTimeout(500);
		await page.getByRole('button', { name: 'next' }).click();

		const mapsModal = page.getByTestId('maps-modal');
		await expect(mapsModal).toBeVisible();
		await expect(page.locator('.sidebar-left')).toHaveCSS('display', 'none');

		await mapsModal.click();
		await expect(page.locator('.data-modal')).toBeVisible();

		// At a fixed narrow width, 1000px is the inclusive tall threshold. This must
		// switch both JS routing and the CSS grid, then force-close the modal copy as
		// the aside takes ownership.
		await page.setViewportSize({ width: 820, height: 1000 });
		await expect(page.getByTestId('maps-aside')).toBeVisible();
		await expect(page.locator('.sidebar-left')).toHaveCSS('display', 'block');
		await expect(page.locator('.data-modal')).toHaveCount(0);

		await page.setViewportSize({ width: 820, height: 999 });
		await expect(page.getByTestId('maps-modal')).toBeVisible();
		await expect(page.locator('.sidebar-left')).toHaveCSS('display', 'none');
	});
});
