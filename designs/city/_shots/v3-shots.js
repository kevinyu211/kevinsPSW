/* Island city · the v3 picture set
   Default view, night, rain, Model look, each town, a train floating and docked (day and night), inside the
   train as the doors open, a page beside its building, and the phone. (The 16 hero shots: hero-all.js v3-hero.)
     NODE_PATH=$(npm root -g) node designs/city/_shots/v3-shots.js */
const { chromium } = require('playwright');
const U = process.env.CITY_URL || 'http://localhost:8765/designs/city/';
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] }); const errs = [];
  const open = async (q, phone) => { const p = await b.newPage(phone ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1440, height: 900 } }); p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); }); await p.goto(`${U}?debug&nointro&${q}`); await p.waitForFunction(() => window.__city && window.__city.state().phase === 'idle', null, { timeout: 60000 }); await p.waitForTimeout(1500); return p; };
  const shot = (p, n) => p.screenshot({ path: `${__dirname}/v3-${n}.png` });
  for (const [n, q] of [['default', 'time=day&weather=clear'], ['night', 'time=night&weather=clear'], ['rain', 'time=day&weather=rain'], ['model', 'time=day&weather=clear&look=model'], ['golden', 'time=golden&weather=clear']]) { const p = await open(q); await shot(p, n); await p.close(); }
  { const p = await open('time=day&weather=clear'); for (const t of await p.evaluate(() => window.__city.towns.map((x) => x.id))) { await p.evaluate((t) => { window.__city.reset(); window.__city.view.showStation(t); }, t); await p.waitForTimeout(700); await shot(p, `town-${t}`); } await p.close(); }
  // a train docked at a station, and one floating between stations, seen from beside the lane
  for (const tm of ['day', 'night']) {
    const p = await open(`time=${tm}&weather=clear`);
    for (const kind of ['docked', 'floating']) {
      await p.evaluate((kind) => { const c = window.__city; c.reset(); if (kind === 'docked') c.sim.putAt('north'); }, kind);
      if (kind === 'floating') await p.waitForFunction(() => { const c = window.__city; const P = c.towns.map((t) => t.s); const L = c.sim.LOOP_LEN; return c.sim.trains.some((t) => t.move && Math.abs(t.v) > 3 && P.every((s) => Math.min(Math.abs(t.s - s), L - Math.abs(t.s - s)) > 70)); }, null, { timeout: 60000 });
      await p.waitForTimeout(kind === 'docked' ? 1500 : 0);
      await p.evaluate((kind) => { const c = window.__city; const v = c.view; const P = c.towns.map((t) => t.s); const L = c.sim.LOOP_LEN; const tr = kind === 'docked' ? c.sim.trains.find((t) => t.at === 'north' && !t.move) : c.sim.trains.find((t) => t.move && Math.abs(t.v) > 3 && P.every((s) => Math.min(Math.abs(t.s - s), L - Math.abs(t.s - s)) > 70)); const s = v.trainSubject(tr, false)(); const V3 = v.camera.position.constructor;
        // docked: from beyond the end of the platform, looking back along the lane at the train between the platforms; floating: from beside it, a little below
        const pos = kind === 'docked' ? new V3(s.x + s.fx * 46 - s.ox * 7, s.y + 4, s.z + s.fz * 46 - s.oz * 7) : new V3(s.x + s.fx * 16 + s.ox * 24, s.y - 1, s.z + s.fz * 16 + s.oz * 24);
        v.flyTo(pos, new V3(s.x - s.fx * 6, s.y + 1.8, s.z - s.fz * 6), kind === 'docked' ? 38 : 44, 0); v.controls.enabled = false; c.sim.release(999); }, kind);
      await p.waitForTimeout(400); await shot(p, `train-${kind}-${tm}`);
    }
    await p.close();
  }
  // inside the train as the doors open, then the page beside its building
  { const p = await open('time=day&weather=clear'); await p.evaluate(() => window.__city.go('noir')); const c = await p.evaluate(() => { const r = window.__city.S.ride; return { cut: r.cutIn, doors: r.doorsAt, step: r.stepAt, page: r.pageAt }; }); const t0 = Date.now(); const at = (s) => p.waitForTimeout(Math.max(0, s * 1000 - (Date.now() - t0)));
    await at(c.cut + 1.4); await shot(p, 'inside-gliding'); await at(c.doors + 0.55); await shot(p, 'inside-doors'); await at(c.step + 0.7); await shot(p, 'inside-stepout'); await at(c.page + 1.6); await shot(p, 'page-beside'); await p.close(); }
  { const p = await open('time=night&weather=clear'); await p.evaluate(() => window.__city.arrive('yae')); await p.waitForTimeout(1800); await shot(p, 'page-beside-night'); await p.close(); }
  { const p = await open('time=day&weather=clear', true); await shot(p, 'phone'); await p.evaluate(() => window.__city.arrive('hirvo')); await p.waitForTimeout(1800); await shot(p, 'phone-page'); await p.close(); }
  console.log(errs.length ? [...new Set(errs)].join('\n') : 'no console errors'); await b.close();
})();
