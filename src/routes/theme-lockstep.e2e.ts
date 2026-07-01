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
      'button[aria-label="Switch to dark mode"], button[aria-label="Switch to light mode"]'
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
