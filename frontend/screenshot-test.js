const { chromium } = require('playwright');
const http = require('http');

async function waitForServer(url, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await new Promise((resolve, reject) => {
        const req = http.get(url, (res) => resolve(res));
        req.on('error', reject);
        req.setTimeout(2000, () => { req.destroy(); reject(new Error('timeout')); });
      });
      if (res.statusCode === 200) return;
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('Server did not start in time');
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await waitForServer('http://localhost:3000');

  // Home page - check marquee full width
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: '/home/itsfuad/Dev/amirlab_new_site/frontend/screenshots/home-marquee.png', fullPage: false });

  // Scroll to marquee area
  const marquee = await page.locator('section[class*="marqueeBand"]').first();
  if (await marquee.isVisible().catch(() => false)) {
    await marquee.screenshot({ path: '/home/itsfuad/Dev/amirlab_new_site/frontend/screenshots/marquee-section.png' });
  }

  await browser.close();
  console.log('Screenshots saved');
})();
