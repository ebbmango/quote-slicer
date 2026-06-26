import { chromium } from 'playwright';
const BASE = 'http://localhost:5190/';
const browser = await chromium.launch();

async function run(gap, n) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  let errs = 0;
  page.on('pageerror', () => errs++);
  page.on('console', (m) => { if (m.type() === 'error') errs++; });
  await page.goto(BASE);
  await page.locator('[aria-label="next"]').click();
  await page.waitForTimeout(1500);
  await page.locator('[data-zone="source"] [role="option"]').first().waitFor({ state: 'visible', timeout: 10000 });
  const lastChange = await page.evaluate(async ({ gap, n }) => {
    const el = document.querySelector('[data-zone="source"] [role="option"]');
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const ids = () => [...document.querySelectorAll('li[data-mapping-id]')].map(li => li.getAttribute('data-mapping-id')).join(',');
    const snaps = [];
    for (let i = 0; i < n; i++) { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); await sleep(gap); snaps.push(ids()); }
    let lc = -1; for (let i = 1; i < snaps.length; i++) if (snaps[i] !== snaps[i-1]) lc = i; return lc;
  }, { gap, n });
  await page.waitForTimeout(1000);
  await page.locator('#authorship').focus();
  await page.keyboard.press('End');
  await page.keyboard.type('@MARK@', { delay: 0 });
  await page.waitForTimeout(700);
  const json = await page.locator('.highlighted-code').first().textContent();
  const alive = (json || '').includes('@MARK@');
  console.log(`gap=${gap}ms n=${n} | lastChangeIdx=${lastChange}/${n-1} | reactivity ${alive ? 'ALIVE' : 'DEAD'} | errors=${errs}`);
  await page.close();
}

await run(80, 100);
await run(40, 150);
await run(25, 200);
await run(60, 120);
await browser.close();
process.exit(0);
