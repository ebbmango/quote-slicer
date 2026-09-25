import { expect, test } from '@playwright/test';
import { runInNewContext } from 'node:vm';
import { writeFile } from 'node:fs/promises';
import { validateQuotation } from '../lib/quotationValidation';

test.use({
	viewport: { width: 1800, height: 1100 },
	contextOptions: { reducedMotion: 'reduce', hasTouch: true }
});

test('authors and exports the real Dao quotation without reshaping its payload', async ({
	page
}, info) => {
	test.setTimeout(90000);
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	const source = '惟初太始，道立於一，造分天地，化成萬物。';
	const target =
		'At the very beginning, at the great origin, the Dao was established in One. It created and separated Heaven and Earth, transforming into all things.';
	await page.goto('/');
	await page.locator('#source-text').fill(source);
	await page.locator('#target-text').fill(target);
	await page.locator('#provenance').fill('Shuowen Jiezi');
	await page.getByRole('button', { name: 'next', exact: true }).click();
	await expect(page.getByRole('button', { name: 'line', exact: true })).toBeVisible();
	const mappings = [
		[[1], [6, 4]],
		[[2], [12]],
		[[3], [14]],
		[[5], [18]],
		[[6], [22, 20]],
		[[7], [24]],
		[[8], [26]],
		[[10], [30]],
		[[11], [34]],
		[[12], [36]],
		[[13], [40]],
		[
			[15, 16],
			[42, 44]
		],
		[[17], [46]],
		[[18], [48]]
	];
	for (const [sources, targets] of mappings) {
		for (const [i, index] of sources.entries()) {
			await page
				.locator(`[data-zone="source"] [data-token-index="${index}"]`)
				.click({ modifiers: i ? ['Meta'] : [] });
			await page.waitForTimeout(500); // Existing mapping-entry animation throttles clicks.
		}
		for (const index of targets)
			await page.locator(`[data-zone="target"] [data-token-index="${index}"]`).click();
	}
	await expect(page.locator('[data-mapping-id]')).toHaveCount(14);
	// Preserve the existing quotation's editorial reading of 於 through the pinyin UI.
	const yu = page
		.locator('[data-mapping-id]')
		.filter({ has: page.locator('span', { hasText: /^於$/ }) });
	await yu.locator('input').fill('wu1');
	await yu.locator('input').blur();
	const exportCode = page.locator('.highlighted-code code');
	await expect(exportCode).toContainText('"wu1"');
	const beforeRaw = await exportCode.innerText();
	// This is trusted formatter output from this test's UI input, evaluated as a data expression.
	const before = runInNewContext(`(${beforeRaw})`);
	validateQuotation(before);
	await page.getByRole('button', { name: 'line', exact: true }).click();
	await page.locator('[data-zone="source"] .split-zone[data-divisor-index="9"]').click();
	for (const index of [15, 27, 41])
		await page.locator(`[data-zone="target"] .ws-split[data-divisor-index="${index}"]`).click();
	await expect(exportCode).toContainText('"translation": [16, 28, 42]');
	const raw = await exportCode.innerText();
	const quotation = runInNewContext(`(${raw})`);
	validateQuotation(quotation);
	expect(quotation.attestation.tokens).toEqual(before.attestation.tokens);
	expect(quotation.translation.tokens).toEqual(before.translation.tokens);
	expect(quotation.alignment.mappings).toEqual(before.alignment.mappings);
	expect(quotation.alignment.breaks).toEqual({ attestation: [10], translation: [16, 28, 42] });
	expect(quotation.attestation.tokens.map((t) => t.text).join('')).toBe(source);
	expect(quotation.translation.tokens.map((t) => t.text).join('')).toBe(target);
	for (const [i, [sources, targets]] of mappings.entries()) {
		expect(quotation.alignment.mappings[i].sourceTokenIds).toEqual(
			sources.map((index) => quotation.attestation.tokens[index].id)
		);
		expect(quotation.alignment.mappings[i].targetTokenIds).toEqual(
			targets.map((index) => quotation.translation.tokens[index].id)
		);
	}
	await expect(page.locator('[data-export-provenance]')).toHaveText('"Shuowen Jiezi"');
	await page.getByRole('button', { name: 'view', exact: true }).click();
	await page.waitForTimeout(700); // Let the line-control collapse transition settle before visual verification.
	const rowTops = await page
		.locator('[data-zone="target"] [data-token-index]')
		.evaluateAll((nodes) =>
			[0, 16, 28, 42].map(
				(index) =>
					nodes
						.find((n) => n.getAttribute('data-token-index') === String(index))!
						.getBoundingClientRect().top
			)
		);
	for (let i = 1; i < rowTops.length; i++) expect(rowTops[i] - rowTops[i - 1]).toBeGreaterThan(10);
	await page.screenshot({ path: info.outputPath('dao-one.png'), fullPage: true });
	const exportPath = info.outputPath('dao-one-export.txt');
	await writeFile(exportPath, raw);
	await info.attach('dao-one-export', { path: exportPath, contentType: 'text/plain' });
	expect(errors).toEqual([]);
});

test('reports unrepresentable empty lines before authoring can advance', async ({ page }) => {
	await page.goto('/');
	await page.locator('#source-text').fill('道\n\n一');
	await expect(page.getByRole('alert')).toContainText('Empty authored line');
	await page.getByRole('button', { name: 'next', exact: true }).click();
	await expect(page.locator('#source-text')).toBeVisible();
});

test('keyboard and two-tap touch merge independent breaks while preserving tokens', async ({
	page
}) => {
	await page.goto('/');
	await page.locator('#source-text').fill('道\n一');
	await page.locator('#target-text').fill('One.\nTwo.');
	await page.getByRole('button', { name: 'next', exact: true }).click();
	await page.getByRole('button', { name: 'line', exact: true }).click();
	const code = page.locator('.highlighted-code code');
	await expect(code).toContainText('"translation": [2]');
	const before = runInNewContext(`(${await code.innerText()})`);
	const sourceMerge = page.locator('[data-zone="source"] .merge-zone');
	await sourceMerge.focus();
	await page.keyboard.press('Alt+Space');
	await expect(page.locator('[data-zone="source"] .split-zone')).toBeFocused();
	await expect(code).toContainText('"attestation": []');
	await expect(code).toContainText('"translation": [2]');
	const targetMerge = page.locator('[data-zone="target"] .merge-zone');
	await targetMerge.tap();
	await expect(targetMerge).toHaveClass(/touch-lit/);
	await expect(code).toContainText('"translation": [2]');
	await targetMerge.tap();
	await expect(code).toContainText('"translation": []');
	const after = runInNewContext(`(${await code.innerText()})`);
	expect(after.attestation).toEqual(before.attestation);
	expect(after.translation).toEqual(before.translation);
	expect(after.alignment.mappings).toEqual(before.alignment.mappings);
});
