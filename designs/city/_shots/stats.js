/* Island city · draw calls, triangles, GPU memory in a few states
   NODE_PATH=$(npm root -g) node designs/city/_shots/stats.js */
const { chromium } = require('playwright');
const U = process.env.CITY_URL || 'http://localhost:8765/designs/city/';
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const out = {};
  for (const [name, q] of [['day', 'time=day&weather=clear'], ['night-rain', 'time=night&weather=rain'], ['model', 'time=day&weather=clear&look=model']]) {
    const p = await b.newPage({ viewport: { width: 1440, height: 900 } }); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    await p.goto(`${U}?debug&nointro&${q}`); await p.waitForFunction(() => window.__city && window.__city.state().phase === 'idle', null, { timeout: 60000 }); await p.waitForTimeout(2500);
    out[name] = await p.evaluate(() => { const r = window.__city.view.renderer; const i = r.info; return { calls: i.render.calls, tris: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures, programs: (i.programs || []).length }; });
    out[name].errors = errs.length; await p.close();
  }
  console.log(JSON.stringify(out, null, 1)); await b.close();
})();
