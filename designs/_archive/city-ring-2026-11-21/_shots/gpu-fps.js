/* Island city · frame rate on the real GPU
   Confirms the renderer is not SwiftShader, then counts the frames the browser drew over 10 s in the overview
   and during a long ride, at 1440×900 (at 1× and at 2× pixels, as on a Retina Mac) and at phone size.
     NODE_PATH=$(npm root -g) node designs/city/_shots/gpu-fps.js [headed] */
const { chromium } = require('playwright');
const U = process.env.CITY_URL || 'http://localhost:8765/designs/city/'; const Q = process.env.CITY_Q || 'time=day&weather=clear';
(async () => {
  const headed = process.argv[2] === 'headed';
  const b = await chromium.launch({ headless: !headed, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const out = [];
  for (const [name, ctx] of [['1440x900 @1x', { viewport: { width: 1440, height: 900 } }], ['1440x900 @2x', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }], ['390x844 @2x phone', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]]) {
    const p = await b.newPage(ctx); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/manifest\.json/.test((m.location() || {}).url || '')) errs.push(m.text()); });
    await p.goto(`${U}?debug&nointro&${Q}`, { waitUntil: 'load' }); await p.waitForFunction(() => window.__city && window.__city.state().phase === 'idle', null, { timeout: 60000 }); await p.waitForTimeout(3000);
    const renderer = await p.evaluate(() => window.__city.view.info().renderer);
    const measure = (sec) => p.evaluate((sec) => new Promise((res) => { const v = window.__city.view; v.resetStats(); let n = 0; let worst = 0; let last = performance.now(); const t0 = last; const tick = (now) => { n++; worst = Math.max(worst, now - last); last = now; if (now - t0 < sec * 1000) requestAnimationFrame(tick); else { const i = v.info(); res({ fps: +(n / ((now - t0) / 1000)).toFixed(1), drawn: +(i.frames / sec).toFixed(1), worstFrameMs: +worst.toFixed(1), calls: i.calls, tris: i.tris }); } }; requestAnimationFrame(tick); }), sec);
    const overview = await measure(10);
    await p.evaluate(() => window.__city.go('yae')); await p.waitForTimeout(900);
    const ride = await measure(8);
    out.push({ size: name, renderer, overview, ride, errors: errs.length }); await p.close();
  }
  console.log(JSON.stringify(out, null, 1)); await b.close();
})();
