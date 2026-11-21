/* Island city · the towns, close up
   One picture of every town (as the visitor sees it after clicking its station), plus the default view.
     NODE_PATH=$(npm root -g) node designs/city/_shots/towns.js [prefix] [query] */
const { chromium } = require('playwright');
const U = process.env.CITY_URL || 'http://localhost:8765/designs/city/';
(async () => {
  const [prefix = 'town', q = 'time=day&weather=clear'] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push('pageerror ' + e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(`${U}?debug&nointro&${q}`, { waitUntil: 'load' }); await p.waitForFunction(() => window.__city && window.__city.state().phase === 'idle', null, { timeout: 60000 }); await p.waitForTimeout(1200);
  await p.screenshot({ path: `${__dirname}/${prefix}-island.png` });
  const ids = await p.evaluate(() => window.__city.towns.map((t) => t.id));
  for (const id of ids) { await p.evaluate((id) => window.__city.look(id), id); await p.waitForTimeout(2200); await p.screenshot({ path: `${__dirname}/${prefix}-${id}.png` }); }
  console.log(errs.length ? [...new Set(errs)].join('\n') : 'no console errors'); await b.close();
})();
