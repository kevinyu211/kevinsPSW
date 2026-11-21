/* Island city · one screenshot
   NODE_PATH=$(npm root -g) node designs/city/_shots/shot.js "<query and hash>" out.png [width] [height] [wait ms] ["js to run first"]
   Uses the real GPU. Prints console errors. */
const { chromium } = require('playwright');
const U = process.env.CITY_URL || 'http://localhost:8765/designs/city/';
(async () => {
  const [q = '', out = 'shot.png', w = 1440, h = 900, wait = 2500, js = ''] = process.argv.slice(2);
  const phone = +w < 700;
  const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const p = await b.newPage(phone ? { viewport: { width: +w, height: +h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: +w, height: +h }, deviceScaleFactor: +(process.env.DPR || 1) });
  const errs = []; p.on('pageerror', (e) => errs.push('pageerror ' + e.message)); p.on('console', (m) => { if (m.type() === 'error' || (process.env.WARN && m.type() === 'warning')) errs.push(m.type() + ' ' + m.text()); });
  await p.goto(U + q, { waitUntil: 'load' });
  await p.waitForFunction(() => !document.body.classList.contains('is-loading'), null, { timeout: 60000 }).catch(() => errs.push('still loading after 60 s'));
  if (js) { await p.waitForTimeout(400); const r = await p.evaluate(js).catch((e) => 'eval error ' + e.message); if (r !== undefined) console.log('eval:', JSON.stringify(r)); }
  await p.waitForTimeout(+wait);
  await p.screenshot({ path: __dirname + '/' + out });
  const st = await p.evaluate(() => (window.__city ? window.__city.state() : null)).catch(() => null);
  if (st) console.log(JSON.stringify(st));
  console.log(errs.length ? errs.join('\n') : 'no console errors'); await b.close();
})();
