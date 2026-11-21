/* Island city · one ride, frame by frame
   Plays a ride at real speed and saves frames at its key moments: outside following the train, the cut
   inside, the doors, the step out onto the building (the hero shot), and the page arriving beside it.
     NODE_PATH=$(npm root -g) node designs/city/_shots/ride-film.js [stop id] [prefix] [width] [height] [query] */
const { chromium } = require('playwright');
const U = process.env.CITY_URL || 'http://localhost:8765/designs/city/';
(async () => {
  const [id = 'yae', prefix = 'ride', w = 1440, h = 900, q = 'time=day&weather=clear'] = process.argv.slice(2);
  const phone = +w < 700;
  const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const p = await b.newPage(phone ? { viewport: { width: +w, height: +h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: +w, height: +h } });
  const errs = []; p.on('pageerror', (e) => errs.push('pageerror ' + e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(`${U}?debug&nointro&${q}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__city && window.__city.state().phase === 'idle', null, { timeout: 60000 }); await p.waitForTimeout(1200);
  const t0 = Date.now(); await p.evaluate((id) => window.__city.go(id), id);
  const cues = await p.evaluate(() => { const r = window.__city.S.ride; return r ? { T: r.T, end: r.end, cutIn: r.cutIn, doorsAt: r.doorsAt, stepAt: r.stepAt, outAt: r.outAt, pageAt: r.pageAt } : null; }); console.log('cues', JSON.stringify(cues));
  const marks = cues && cues.T > 0 ? [['follow', Math.min(1.6, cues.cutIn * 0.5)], ['follow2', cues.cutIn - 0.3], ['inside', cues.cutIn + 1.3], ['inside2', cues.end - 0.2], ['doors', cues.stepAt - 0.1], ['stepout', cues.stepAt + 0.8], ['walk', cues.outAt + 0.9], ['hero', cues.pageAt - 0.3], ['page', cues.pageAt + 1.6]] : [['walk', 0.8], ['hero', (cues ? cues.pageAt : 4) - 0.3], ['page', (cues ? cues.pageAt : 4) + 1.6]];
  for (const [name, at] of marks) { await p.waitForTimeout(Math.max(0, at * 1000 - (Date.now() - t0))); await p.screenshot({ path: `${__dirname}/${prefix}-${name}.png` }); const st = await p.evaluate(() => window.__city.state()); console.log(name, at.toFixed(2) + 's', st.phase, st.mode, st.page, st.pageMode); }
  console.log(errs.length ? errs.join('\n') : 'no console errors'); await b.close();
})();
