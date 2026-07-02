import { test, expect } from '@playwright/test';

test('rapid clicks freeze detection - stress', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (err) => errors.push('PAGE ERROR: ' + err.message));

	await page.goto('/');
	await page.getByRole('button', { name: 'next' }).click();
	await page.waitForTimeout(1500);

	const firstToken = page.locator('[data-zone="source"] [role="option"]').first();
	await firstToken.waitFor({ state: 'visible' });

	// Simulate very rapid clicks with NO pauses (100 clicks)
	for (let i = 0; i < 100; i++) {
		await firstToken.click({ delay: 0 });
	}

	// Wait for all animations to settle
	await page.waitForTimeout(2000);

	const finalState = await page.evaluate(() => {
		const ol = document.querySelector('ol[role="listbox"]');
		const lis = Array.from(ol?.querySelectorAll('li[data-mapping-id]') ?? []);
		return {
			liCount: lis.length,
			styles: lis.map((li) => ({
				opacity: getComputedStyle(li).opacity,
				transform: getComputedStyle(li).transform
			}))
		};
	});

	console.log('Final DOM state after 100 rapid clicks:', JSON.stringify(finalState));
	console.log('Errors:', errors.length > 0 ? errors : 'none');

	// Test responsiveness
	const secondToken = page.locator('[data-zone="source"] [role="option"]').nth(2);
	await secondToken.click({ timeout: 3000 });
	await page.waitForTimeout(500);

	const cardCount = await page.locator('[data-mapping-id]').count();
	console.log('Responsive check - cards visible:', cardCount);

	expect(errors, 'No JS errors').toHaveLength(0);
	expect(cardCount, 'App still responds').toBeGreaterThan(0);
});
