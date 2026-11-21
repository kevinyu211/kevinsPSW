/* Island city · the arrival shot
   The hero shot (the look at the building that is held before its page arrives) and the page beside it, for
   several buildings and the tower.   NODE_PATH=$(npm root -g) node designs/city/_shots/heroes.js [ids] [prefix] [w] [h] [query] */
const { chromium } = require('playwright');
const U = process.env.CITY_URL || 'http://localhost:8765/designs/city/';
(async () => {
  const [ids = 'hirvo,noir,stickers,tower', prefix = 'hero', w = 1440, h = 900, q = 'time=day&weather=clear'] = process.argv.slice(2); const phone = +w < 700;
  const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const p = await b.newPage(phone ? { viewport: { width: +w, height: +h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: +w, height: +h } });
  const errs = []; p.on('pageerror', (e) => errs.push('pageerror ' + e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(`${U}?debug&nointro&${q}`, { waitUntil: 'load' }); await p.waitForFunction(() => window.__city && window.__city.state().phase === 'idle', null, { timeout: 60000 }); await p.waitForTimeout(800);
  for (const id of ids.split(',')) {
    await p.evaluate((id) => { window.__city.reset(); window.__city.go(id); }, id);
    await p.waitForFunction(() => window.__city.state().out, null, { timeout: 40000 }); const left = await p.evaluate(() => { const r = window.__city.S.ride; return r ? r.pageAt - r.t : 0; });
    await p.waitForTimeout(Math.max(200, (left - 0.35) * 1000)); await p.screenshot({ path: `${__dirname}/${prefix}-${id}-hero.png` });
    await p.waitForFunction((id) => window.__city.state().page === id, id, { timeout: 20000 }); await p.waitForTimeout(1500); await p.screenshot({ path: `${__dirname}/${prefix}-${id}-page.png` });
  }
  console.log(errs.length ? [...new Set(errs)].join('\n') : 'no console errors'); await b.close();
})();
