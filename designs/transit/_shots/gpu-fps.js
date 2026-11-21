/* Kevin Metro · frame rate on the real GPU
   Launches Chromium with hardware rendering, confirms the WebGL renderer is not SwiftShader, and measures the
   average frames per second over 10 s in the overview, during a ride and in the 2D map, at 1440×900 and at
   phone size.   NODE_PATH=$(npm root -g) node designs/transit/_shots/gpu-fps.js [headed] */
const { chromium } = require('playwright');
const U = process.env.KM_URL || 'http://localhost:8765/designs/transit/';
(async () => {
  const headed = process.argv[2] === 'headed';
  const b = await chromium.launch({ headless: !headed, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const out = [];
  for (const [name, ctx] of [['1440x900', { viewport: { width: 1440, height: 900 } }], ['390x844', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]]) {
    const p = await b.newPage(ctx); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    await p.goto(U + '?debug&nointro', { waitUntil: 'load' }); await p.waitForFunction(() => window.__kmetro && window.__kmetro.city, null, { timeout: 60000 }); await p.waitForTimeout(4000);
    const renderer = await p.evaluate(() => window.__kmetro.city.info().renderer);
    // frames the engine drew, and frames the browser offered (requestAnimationFrame), over `sec` seconds
    const measure = (sec) => p.evaluate((sec) => new Promise((res) => { const k = window.__kmetro; k.city.resetStats(); let n = 0; const t0 = performance.now(); const tick = () => { n++; if (performance.now() - t0 < sec * 1000) requestAnimationFrame(tick); else { const i = k.city.info(); res({ engine: +(i.frames / sec).toFixed(1), raf: +(n / sec).toFixed(1), calls: i.maxCalls, tris: i.maxTris }); } }; requestAnimationFrame(tick); }), sec);
    const overview = await measure(10);
    await p.evaluate(() => window.__kmetro.rideToStation('harbour')); await p.waitForFunction(() => window.__kmetro.sim.trip && window.__kmetro.sim.trip.phase === 'ride', null, { timeout: 30000 });
    const ride = await measure(10);
    await p.evaluate(() => { window.__kmetro.sim.skip(); window.__kmetro.reset(); window.__kmetro.set2D(true); }); await p.waitForTimeout(800);
    const map2d = await measure(10);
    out.push({ size: name, renderer, overview, ride, map2d: { raf: map2d.raf }, errors: errs.length });
    await p.close();
  }
  console.log(JSON.stringify(out, null, 1)); await b.close();
})();
