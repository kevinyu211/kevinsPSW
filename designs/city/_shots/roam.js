/* Island city · moving around by hand
   Real mouse input: wheel in towards a building until the camera stops, tilt down with a right-drag, pan with a
   left-drag, wheel all the way out. Prints how close and how far the camera gets, and saves pictures.
     NODE_PATH=$(npm root -g) node designs/city/_shots/roam.js [stop id] [prefix] [query] */
const { chromium } = require('playwright');
const U = process.env.CITY_URL || 'http://localhost:8765/designs/city/';
(async () => {
  const [id = 'books', prefix = 'roam', q = 'time=day&weather=clear'] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push('pageerror ' + e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(`${U}?debug&nointro&${q}`, { waitUntil: 'load' }); await p.waitForFunction(() => window.__city && window.__city.state().phase === 'idle', null, { timeout: 60000 }); await p.waitForTimeout(800);
  const cam = () => p.evaluate(() => { const v = window.__city.view; const c = v.camera.position; const t = v.controls.target; return { dist: +c.distanceTo(t).toFixed(1), camY: +c.y.toFixed(1), tilt: +(Math.acos((c.y - t.y) / c.distanceTo(t)) * 57.3).toFixed(1), target: [+t.x.toFixed(0), +t.y.toFixed(1), +t.z.toFixed(0)] }; });
  console.log('start', JSON.stringify(await cam()));
  const pt = await p.evaluate((id) => window.__city.view.pointOf(id), id); await p.mouse.move(pt[0], pt[1]);
  for (let i = 0; i < 40; i++) { await p.mouse.wheel(0, -260); await p.waitForTimeout(60); const q2 = await p.evaluate((id) => window.__city.view.pointOf(id), id); if (q2 && q2[1] < 740 && q2[1] > 60) await p.mouse.move(q2[0], q2[1]); }
  await p.waitForTimeout(700); console.log('wheel in', JSON.stringify(await cam())); await p.screenshot({ path: `${__dirname}/${prefix}-close.png` });
  await p.mouse.move(700, 400); await p.mouse.down({ button: 'right' }); await p.mouse.move(820, 130, { steps: 12 }); await p.mouse.up({ button: 'right' }); await p.waitForTimeout(700);
  console.log('tilted', JSON.stringify(await cam())); await p.screenshot({ path: `${__dirname}/${prefix}-street.png` });
  await p.mouse.move(700, 420); await p.mouse.down(); await p.mouse.move(420, 380, { steps: 10 }); await p.mouse.up(); await p.waitForTimeout(700);
  console.log('panned', JSON.stringify(await cam())); await p.screenshot({ path: `${__dirname}/${prefix}-pan.png` });
  for (let i = 0; i < 60; i++) { await p.mouse.wheel(0, 400); await p.waitForTimeout(40); } await p.waitForTimeout(900);
  console.log('wheel out', JSON.stringify(await cam())); await p.screenshot({ path: `${__dirname}/${prefix}-far.png` });
  for (let i = 0; i < 12; i++) { await p.mouse.move(300, 300); await p.mouse.down(); await p.mouse.move(1300, 700, { steps: 6 }); await p.mouse.up(); } await p.waitForTimeout(800);
  const far = await cam(); const edge = await p.evaluate(() => { const t = window.__city.view.controls.target; return Math.hypot(t.x / 380, t.z / 235); });
  console.log('dragged hard one way', JSON.stringify(far), 'target at', edge.toFixed(2), 'of the island radius'); await p.screenshot({ path: `${__dirname}/${prefix}-edge.png` });
  await p.click('[data-reset]'); await p.waitForTimeout(1600); console.log('reset', JSON.stringify(await cam()));
  console.log(errs.length ? errs.join('\n') : 'no console errors'); await b.close();
})();
