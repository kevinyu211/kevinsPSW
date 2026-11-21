/* Island city · stability
   Switches look, time and weather 60 times, resizes 30 times, and loses and restores the WebGL context,
   checking GPU objects (geometries, textures, programs) and the JS heap do not keep growing, and that the
   island draws again after the context comes back.
     NODE_PATH=$(npm root -g) node designs/city/_shots/stability.js */
const { chromium } = require('playwright');
const U = process.env.CITY_URL || 'http://localhost:8765/designs/city/';
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-precise-memory-info'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } }); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(`${U}?debug&nointro&time=day&weather=clear`); await p.waitForFunction(() => window.__city && window.__city.state().phase === 'idle', null, { timeout: 60000 }); await p.waitForTimeout(1500);
  const snap = () => p.evaluate(() => { const i = window.__city.view.renderer.info; return { geo: i.memory.geometries, tex: i.memory.textures, prog: (i.programs || []).length, heapMB: +(performance.memory.usedJSHeapSize / 1048576).toFixed(1), frames: window.__city.view.info().frames }; });
  const out = { start: await snap() };
  for (let k = 0; k < 60; k++) { await p.evaluate((k) => { const v = window.__city.view; v.setLook(k % 2 ? 'model' : 'film'); v.setTime(['day', 'night', 'dawn', 'golden'][k % 4]); v.setWeather(['clear', 'rain', 'fog'][k % 3]); }, k); await p.waitForTimeout(60); }
  out.afterSwitches = await snap();
  for (let k = 0; k < 30; k++) { await p.setViewportSize(k % 2 ? { width: 1440, height: 900 } : { width: 1024, height: 720 }); await p.waitForTimeout(80); }
  out.afterResizes = await snap();
  const f0 = (await snap()).frames; await p.evaluate(() => window.__city.loseContext(true)); await p.waitForTimeout(800); out.whileLost = await p.evaluate(() => window.__city.view.lost); await p.waitForTimeout(2500);
  out.afterRestore = { ...(await snap()), lost: await p.evaluate(() => window.__city.view.lost), drewAgain: (await snap()).frames > f0 };
  await p.screenshot({ path: `${__dirname}/v3-after-context-restore.png` });
  out.errors = errs; console.log(JSON.stringify(out, null, 1)); await b.close();
})();
