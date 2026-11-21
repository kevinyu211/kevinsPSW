/* Island city · the hero shot of every building and the tower, as it is held before the page comes in
   (the camera pose is the same one the ride ends on). Prints how many of the nine sight lines are blocked.
     NODE_PATH=$(npm root -g) node designs/city/_shots/hero-all.js [prefix] [w] [h] [query] */
const { chromium } = require('playwright');
const U = process.env.CITY_URL || 'http://localhost:8765/designs/city/';
(async () => {
  const [prefix = 'v3-hero', w = 1440, h = 900, q = 'time=day&weather=clear'] = process.argv.slice(2); const phone = +w < 700;
  const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const p = await b.newPage(phone ? { viewport: { width: +w, height: +h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: +w, height: +h } });
  const errs = []; p.on('pageerror', (e) => errs.push('pageerror ' + e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(`${U}?debug&nointro&${q}`, { waitUntil: 'load' }); await p.waitForFunction(() => window.__city && window.__city.state().phase === 'idle', null, { timeout: 60000 }); await p.waitForTimeout(800);
  const ids = await p.evaluate(() => [...window.__city.stops.map((s) => s.id), 'tower']);
  for (const id of ids) {
    const r = await p.evaluate((id) => { const c = window.__city; c.reset(); const s = c.view.heroPose(id); c.view.showStation(id, false); c.S.focus = id; return { hits: s.hits, pos: s.pos.toArray().map((v) => Math.round(v)), dist: Math.round(s.pos.distanceTo(s.target)) }; }, id);
    await p.waitForTimeout(700); await p.screenshot({ path: `${__dirname}/${prefix}-${id}.png` }); console.log(id, JSON.stringify(r));
  }
  console.log(errs.length ? [...new Set(errs)].join('\n') : 'no console errors'); await b.close();
})();
