import { expect, test } from '@playwright/test';

// Regression guards for the line split/merge animation when a panel overflows.
//
// In the overflow regime the quote stack is capped (max-h-full) and the panels are
// pinned by flex. Two bugs lived here, both only visible with long text:
//
//  1. Overlap — the animation put an explicit pixel height on the edited scroll box.
//     Flex shrank the box's wrapper below that height, and (wrapper overflow:visible) the
//     box painted straight through into the other panel. Fix: the wrapper clips
//     (overflow-clip) and the height is only animated when the panel can actually grow.
//  2. Jerk — the height was tweened to a target measured in a transient layout that
//     disagreed with the settled one, so the panels snapped on release. Fix: animate the
//     height only when the new content still fits the box; otherwise settle instantly and
//     just reflow the tokens. Either way nothing snaps.
//
// The settled state is self-correcting, so both are sampled *during* the animation.

// Doubled sentence: one copy only overflows the 390x480 panel by a few px now that
// the theme toggle is top-mounted (h=0 in flow) and the quote band is taller.
const SRC = '知命者不怨天，知己者不怨人。知命者不怨天，知己者不怨人。';
const TGT =
	'One who knows his fate does not resent Heaven;\none who knows himself does not resent others.';
const PROVENANCE = 'A New Practical Primer of Literary Chinese (Paul F. Rouzer)';

test.describe('line split in an overflowing panel', () => {
	test.use({ viewport: { width: 390, height: 480 } });

	test('no cross-panel overlap, no end-snap, no ballooning box', async ({ page }) => {
		await page.goto('/');
		await page.locator('#source-text').fill(SRC);
		await page.locator('#target-text').fill(TGT);
		await page.locator('#provenance').fill(PROVENANCE);
		await page.getByRole('button', { name: 'next' }).click();
		await page.getByRole('button', { name: 'line', exact: true }).click();

		const r = await page.evaluate(async () => {
			const sWrap = document.querySelector('[data-zone="source"]') as HTMLElement;
			const tWrap = document.querySelector('[data-zone="target"]') as HTMLElement;
			const sBox = document.querySelector('[data-zone="source"] [data-scrollbox]') as HTMLElement;
			const z = document.querySelector(
				'[data-zone="source"] .split-zone[data-divisor-index="1"]'
			) as HTMLButtonElement;

			const wrapClips =
				getComputedStyle(sWrap).overflow === 'clip' && getComputedStyle(tWrap).overflow === 'clip';
			z.click();

			let worstSrcIntoTgt = -1e9;
			let maxBoxOffset = 0;
			const tgtTops: number[] = [];
			const start = performance.now();
			await new Promise<void>((res) => {
				const tick = () => {
					worstSrcIntoTgt = Math.max(
						worstSrcIntoTgt,
						Math.round(sWrap.getBoundingClientRect().bottom - tWrap.getBoundingClientRect().top)
					);
					maxBoxOffset = Math.max(maxBoxOffset, sBox.offsetHeight);
					tgtTops.push(Math.round(tWrap.getBoundingClientRect().top));
					if (performance.now() - start > 600) res();
					else requestAnimationFrame(tick);
				};
				requestAnimationFrame(tick);
			});
			let maxTgtJump = 0;
			for (let i = 1; i < tgtTops.length; i++)
				maxTgtJump = Math.max(maxTgtJump, Math.abs(tgtTops[i] - tgtTops[i - 1]));
			return {
				wrapClips,
				worstSrcIntoTgt,
				maxTgtJump,
				maxBoxOffset,
				settledScrollHeight: sBox.scrollHeight,
				settledOffset: sBox.offsetHeight
			};
		});

		// Precondition: we are really in the overflow regime.
		expect(r.settledScrollHeight).toBeGreaterThan(r.settledOffset + 20);

		// (1) Panels clip, and the edited panel never reaches into the other one.
		expect(r.wrapClips).toBe(true);
		expect(r.worstSrcIntoTgt).toBeLessThanOrEqual(2);

		// (1b) The edited scroll box never balloons toward its full unclipped content height.
		expect(r.maxBoxOffset).toBeLessThan(r.settledScrollHeight - 20);

		// (2) The other panel slides smoothly — no single-frame snap (the jerk was ~20–40px).
		expect(r.maxTgtJump).toBeLessThanOrEqual(8);
	});
});
