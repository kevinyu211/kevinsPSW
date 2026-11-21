/* Kevin Metro · the camera never leaves the built city
   Sweeps azimuth × tilt × pan extremes, asking each time for the widest zoom, and reads back what the limits
   allowed. The four corners of the frame, projected on the ground, must lie inside the allowed region (the
   city grid, extended east over the sea). 1440×900, 390×844 and a phone on its side. Also saves eight frames
   at the extremes to look at:   NODE_PATH=$(npm root -g) node designs/transit/_shots/clamp-sweep.js */
const { chromium } = require('playwright');
const U = process.env.KM_URL || 'http://localhost:8765/designs/transit/'; const OUT = __dirname + '/';
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] }); let bad = 0; let n = 0; const out = [];
  for (const [name, ctx] of [['1440', { viewport: { width: 1440, height: 900 } }], ['390', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }], ['844x390', { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]]) {
    const p = await b.newPage(ctx); await p.goto(U + '?debug&nointro', { waitUntil: 'load' }); await p.waitForFunction(() => window.__kmetro && window.__kmetro.city && !window.__kmetro.state().loading, null, { timeout: 90000 }); await p.waitForTimeout(600);
    const res = await p.evaluate(() => {
      const c = window.__kmetro.city; const R = c.region(); const rows = []; let bad = 0; let worst = 0;
      for (let ti = 0; ti < 24; ti++) for (const ph of [0.35, 0.5, 0.74, 1.0, 1.3, 1.553]) for (const [x, z] of [[0, 0], [-5000, -5000], [5000, -5000], [-5000, 5000], [5000, 5000], [-5000, 0], [0, 5000], [0, -5000]]) {
        const th = (ti / 24) * Math.PI * 2; const r = c.setPose({ th, ph, F: 99999, x, z });
        const out = Math.max(...r.corners.map(([cx, cz]) => Math.max(R.x0 - cx, cx - R.x1, R.z0 - cz, cz - R.z1))); worst = Math.max(worst, out); if (out > 0.5) { bad++; if (rows.length < 5) rows.push({ th: +th.toFixed(2), ph, x, z, out: +out.toFixed(1) }); }
      }
      return { poses: 24 * 6 * 8, bad, worst: +worst.toFixed(2), rows, region: R };
    });
    n += res.poses; bad += res.bad; out.push(`${name}: ${res.poses} poses, ${res.bad} outside, worst overshoot ${res.worst} m`); if (res.rows.length) out.push(JSON.stringify(res.rows));
    if (name === '1440') { let k = 0; for (const [th, ph, x, z] of [[0, 0.35, -5000, -5000], [Math.PI / 2, 0.35, -5000, 5000], [Math.PI, 0.35, 5000, 5000], [-Math.PI / 2, 0.35, -5000, -5000], [0.78, 0.74, -5000, 5000], [2.36, 0.74, -5000, -5000], [3.93, 1.553, 5000, -5000], [5.5, 0.5, -5000, 0]]) { await p.evaluate(([th, ph, x, z]) => window.__kmetro.city.setPose({ th, ph, F: 99999, x, z }), [th, ph, x, z]); await p.waitForTimeout(900); await p.screenshot({ path: `${OUT}v9-widest-${++k}.png` }); } }
    await p.close();
  }
  console.log(out.join('\n')); console.log(`TOTAL ${n} poses, ${bad} outside the city`); await b.close(); process.exit(bad ? 1 : 0);
})();
