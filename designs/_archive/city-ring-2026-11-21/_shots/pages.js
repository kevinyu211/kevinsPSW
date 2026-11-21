/* Island city · full-page pictures of the pages
   NODE_PATH=$(npm root -g) node designs/city/_shots/pages.js [ids,comma] [width] [height] [prefix] */
const { chromium } = require('playwright');
const U = process.env.CITY_URL || 'http://localhost:8765/designs/city/';
(async () => {
  const [ids = 'hirvo,tower,main', w = 1440, h = 900, prefix = 'page'] = process.argv.slice(2); const phone = +w < 700;
  const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const p = await b.newPage(phone ? { viewport: { width: +w, height: +h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: +w, height: +h } });
  const errs = []; p.on('pageerror', (e) => errs.push('pageerror ' + e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  for (const id of ids.split(',')) {
    await p.goto(`${U}?debug&time=day&weather=clear#/${id}`, { waitUntil: 'load' }); await p.reload({ waitUntil: 'load' });
    await p.waitForFunction((id) => window.__city && window.__city.state().page === id, id, { timeout: 60000 }); await p.waitForTimeout(1500);
    await p.screenshot({ path: `${__dirname}/${prefix}-${id}-top.png` });
    // the whole article in one tall picture: let the page grow to its full height
    const full = await p.evaluate(() => { const pg = document.querySelector('[data-page]'); return pg.scrollHeight; });
    await p.setViewportSize({ width: +w, height: Math.min(full, 9000) }); await p.waitForTimeout(900);
    await p.screenshot({ path: `${__dirname}/${prefix}-${id}-full.png` }); await p.setViewportSize({ width: +w, height: +h });
    const over = await p.evaluate(() => { const pg = document.querySelector('[data-page]'); return { sw: pg.scrollWidth, cw: pg.clientWidth }; }); console.log(id, 'height', full, 'sideways', over.sw > over.cw + 1 ? 'YES ' + JSON.stringify(over) : 'no');
  }
  console.log(errs.length ? [...new Set(errs)].join('\n') : 'no console errors'); await b.close();
})();
