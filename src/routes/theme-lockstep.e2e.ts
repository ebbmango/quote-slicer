import { test, expect } from '@playwright/test';

// Theme flip must recolor every surface in lockstep. Two regressions guarded here:
// 1. Easing drift — mapping cards use Tailwind transition utilities; if Tailwind's
//    default timing function (cubic-bezier(0.4, 0, 0.2, 1)) diverges from the page's
//    `ease` (html/body in layout.css), cards trail the page mid-flip even at equal
//    durations. layout.css pins --default-transition-timing-function to `ease`.
// 2. Late start — card colors are Svelte-driven inline styles; without the theme
//    controller's flushSync (systemTheme.ts), Chromium applies them one frame after
//    the .dark class flip, so the card transition starts a frame behind the page's.
test('theme flip: page and mapping cards transition in lockstep', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'next' }).click();
	await page.waitForTimeout(1500);

	// create one mapping so a card exists
	await page.locator('[data-zone="source"] [role="option"]').first().click();
	await page.locator('[data-zone="target"] [role="option"]').first().click();
	await page.waitForTimeout(400);

	const eases = await page.evaluate(() => {
		const li = document.querySelector('li[data-mapping-id]')!;
		const surfaces = [
			document.body,
			li.querySelector(':scope > div')!,
			li.querySelector(':scope > div:last-child')!
		];
		return surfaces.map((el) => getComputedStyle(el).transitionTimingFunction.split(',')[0].trim());
	});
	expect(new Set(eases).size, 'body and card surfaces share one timing function').toBe(1);

	const sync = await page.evaluate(() => {
		const cardTop = document.querySelector('li[data-mapping-id] > div') as HTMLElement;
		const before = cardTop.getAttribute('style');
		const toggle = document.querySelector(
			'button[aria-label="Switch to dark theme"], button[aria-label="Switch to light theme"]'
		) as HTMLElement;
		toggle.click();
		// read back in the same task — no awaits, no frames in between
		const after = cardTop.getAttribute('style');
		return { before, after };
	});
	expect(sync.after, 'card inline colors update in the same task as the class flip').not.toBe(
		sync.before
	);
});

// Three structural invariants behind the "every surface in lockstep" rule. Each one
// regressed independently; all were found by painted-pixel measurement, so guard the
// structure rather than re-measuring timings (flaky in CI):
// 1. Resting textareas must NOT transition `color`. Their colour is inherited, and a
//    text field with its own colour transition eases toward <body>'s already-easing
//    value — it settles at ~2× the page's 500ms (WebKit shows it in computed style;
//    Chromium paints it while reporting lockstep). The morph transitions live only
//    under `.exiting`.
// 2. The mapping card's bottom text opacity is isDark-dependent inline style; without
//    `opacity` in its transition it snaps in one frame while colours ease 500ms.
// 3. Live color-scheme goes on <body>, never <html>: Chromium half-rates every
//    `color` transition that starts within ~500ms after a ROOT color-scheme change,
//    so any root write (even deferred) leaves a poison window for the next flip.
test('theme flip: lockstep structural invariants', async ({ page }) => {
	await page.goto('/');

	const fieldTransitions = await page.evaluate(() =>
		['#source-text', '#target-text', '#provenance'].map(
			(sel) => getComputedStyle(document.querySelector(sel)!).transitionProperty
		)
	);
	for (const tp of fieldTransitions) {
		expect(tp, 'resting text fields must not transition color').not.toContain('color');
	}

	await page.getByRole('button', { name: 'next' }).click();
	await page.waitForTimeout(1500);
	await page.locator('[data-zone="source"] [role="option"]').first().click();
	await page.locator('[data-zone="target"] [role="option"]').first().click();
	await page.waitForTimeout(400);

	const botTransition = await page.evaluate(
		() =>
			getComputedStyle(document.querySelector('li[data-mapping-id] > div:last-child span')!)
				.transitionProperty
	);
	expect(botTransition, 'card bottom text transitions its isDark-dependent opacity').toContain(
		'opacity'
	);

	const schemes = await page.evaluate(() => {
		const htmlBefore = document.documentElement.style.colorScheme;
		(
			document.querySelector(
				'button[aria-label="Switch to dark theme"], button[aria-label="Switch to light theme"]'
			) as HTMLElement
		).click();
		return {
			htmlBefore,
			htmlAfter: document.documentElement.style.colorScheme,
			body: document.body.style.colorScheme
		};
	});
	expect(schemes.body, 'live color-scheme lands on <body> in the same task').toMatch(
		/^(light|dark)$/
	);
	expect(schemes.htmlAfter, 'the flip never writes the root color-scheme').toBe(schemes.htmlBefore);
});

// Dark-OS placeholder ink. When the OS prefers dark (the prepaint stamps
// color-scheme: dark on <html>), Chromium fails to recompute ::placeholder colours
// built from colour FUNCTIONS of currentColor (color-mix / relative-color — the UA
// default is such a color-mix) when the inherited colour changes: after a toggle the
// placeholder keeps the previous theme's ink and camouflages into the new background.
// The fields therefore declare plain `color: currentColor` with the 50% dimming on
// the pseudo-element's opacity. Asserting the exact rgb value guards both halves:
// a colour-function declaration computes to an oklab()/color() string (not rgb), and
// a stale value is the opposite theme's ink.
test('theme flip: placeholder ink tracks the theme under a dark OS scheme', async ({ page }) => {
	await page.emulateMedia({ colorScheme: 'dark' });
	await page.goto('/');
	const placeholderInk = () =>
		page.evaluate(
			() => getComputedStyle(document.querySelector('#target-text')!, '::placeholder').color
		);

	await page.click('button[aria-label="Switch to light theme"]');
	await page.waitForTimeout(700);
	expect(await placeholderInk(), 'light theme uses the light ink').toBe('rgb(27, 27, 27)');

	await page.click('button[aria-label="Switch to dark theme"]');
	await page.waitForTimeout(700);
	expect(await placeholderInk(), 'dark theme uses the dark ink').toBe('rgb(244, 244, 244)');
});
