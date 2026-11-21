/* Island city · close looks at places, from outside
   NODE_PATH=$(npm root -g) node designs/city/_shots/closeups.js [ids,comma] [prefix] [query] */
const { chromium } = require('playwright');
const U = process.env.CITY_URL || 'http://localhost:8765/designs/city/';
(async () => {
  const [ids = 'main,hirvo,trade,tower', prefix = 'close', q = 'time=day&weather=clear'] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push('pageerror ' + e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(`${U}?debug&nointro&${q}`, { waitUntil: 'load' }); await p.waitForFunction(() => window.__city && window.__city.state().phase === 'idle', null, { timeout: 60000 }); await p.waitForTimeout(800);
  for (const id of ids.split(',')) { await p.evaluate((id) => { window.__city.reset(id); window.__city.view.showStation(id, false); }, id); await p.waitForTimeout(900); await p.screenshot({ path: `${__dirname}/${prefix}-${id}.png` }); }
  console.log(errs.length ? [...new Set(errs)].join('\n') : 'no console errors'); await b.close();
})();
