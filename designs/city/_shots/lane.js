/* Island city · the flying trains, close up
   Pictures of: a train docked at a station with its doors and the platform gates open, a train floating
   between stations, and a pod going up the hill.
     NODE_PATH=$(npm root -g) node designs/city/_shots/lane.js [prefix] [query] */
const { chromium } = require('playwright');
const U = process.env.CITY_URL || 'http://localhost:8765/designs/city/';
(async () => {
  const [prefix = 'lane', q = 'time=day&weather=clear'] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push('pageerror ' + e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(`${U}?debug&nointro&${q}`, { waitUntil: 'load' }); await p.waitForFunction(() => window.__city && window.__city.state().phase === 'idle', null, { timeout: 60000 }); await p.waitForTimeout(800);
  const aim = (fn) => p.evaluate(fn);
  // a train standing at a station, doors open
  await p.waitForFunction(() => window.__city.sim.trains.some((t) => t.at && !t.move && t.doors > 0.95 && t.dwell > 4), null, { timeout: 60000 });
  await aim(() => { const c = window.__city; const t = c.sim.trains.find((x) => x.at && !x.move && x.doors > 0.95 && x.dwell > 4); const T = c.view.byId[t.at]; const v = c.view; const side = t.dir > 0 ? 1 : -1; v.flyTo(new v.camera.position.constructor(T.x + T.nx * side * 26 + T.tx * 22, T.y + 9, T.z + T.nz * side * 26 + T.tz * 22), new v.camera.position.constructor(T.x, T.y + 2, T.z), 40, 0); });
  await p.waitForTimeout(700); await p.screenshot({ path: `${__dirname}/${prefix}-docked.png` });
  // a train on the move between stations
  await p.waitForFunction(() => window.__city.sim.trains.some((t) => t.move && Math.abs(t.v) > 14), null, { timeout: 60000 });
  await aim(() => { const c = window.__city; const t = c.sim.trains.find((x) => x.move && Math.abs(x.v) > 14); c.view.follow(c.view.trainSubject(t, false)); });
  await p.waitForTimeout(2600); await p.screenshot({ path: `${__dirname}/${prefix}-floating.png` });
  // a pod on its way up the hill
  await p.waitForFunction(() => { const tr = window.__city.sim.tram; return tr.move && tr.u > 0.3 && tr.u < 0.6; }, null, { timeout: 90000 });
  await aim(() => { const c = window.__city; c.view.follow(c.view.tramSubject(c.sim, c.sim.tram.dir > 0 ? 1 : -1, false)); });
  await p.waitForTimeout(2200); await p.screenshot({ path: `${__dirname}/${prefix}-pod.png` });
  await aim(() => { const c = window.__city; const v = c.view; const u = c.sim.tramU(1); const V3 = v.camera.position.constructor; const q = v.byId.tower; const h = v.byId[c.towns[0].id]; const x = h.cx + (q.x - h.cx) * 0.5; const z = h.cz + (q.z - h.cz) * 0.5; v.flyTo(new V3(x + 46, 34, z + 60), new V3(x, 16, z), 40, 0); void u; }); await p.waitForTimeout(600); await p.screenshot({ path: `${__dirname}/${prefix}-pod-side.png` });
  console.log(errs.length ? [...new Set(errs)].join('\n') : 'no console errors'); await b.close();
})();
