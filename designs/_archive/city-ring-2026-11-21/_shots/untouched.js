/* Island city · the first visit, untouched
   Loads the plain address on the real GPU and touches nothing for 60 s. The opening must play and end by
   itself within 8 s, the train must then keep running round the loop, and the console must stay clean.
     NODE_PATH=$(npm root -g) node designs/city/_shots/untouched.js [1440|390] [seconds=60] */
const { chromium } = require('playwright');
const U = process.env.CITY_URL || 'http://localhost:8765/designs/city/'; const OUT = __dirname + '/';
(async () => {
  const phone = process.argv[2] === '390'; const SECS = +(process.argv[3] || 60);
  const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const p = await b.newPage(phone ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1440, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push('pageerror ' + e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(`${m.text()} ${(m.location() || {}).url || ''}`); });
  await p.goto(`${U}?debug&time=day&weather=clear`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__city, null, { timeout: 60000 }); const t0 = Date.now();
  const log = []; let openingEnd = null; let sawOpening = false; const at = new Set(); let moved = 0; let lastS = null; let stuck = 0; let maxStuck = 0;
  for (let s = 0; s <= SECS; s++) {
    const st = await p.evaluate(() => { const c = window.__city.state(); return { phase: c.phase, s: c.train.s, at: c.train.at, title: (document.querySelector('.opening h1') || {}).textContent, openingShown: !document.querySelector('[data-opening]').hidden }; });
    if (st.phase === 'opening') sawOpening = true; if (sawOpening && st.phase === 'idle' && openingEnd == null) openingEnd = (Date.now() - t0) / 1000;
    if (st.at) at.add(st.at); if (lastS != null && Math.abs(st.s - lastS) > 0.5) { moved++; stuck = 0; } else if (st.phase === 'idle') { stuck++; maxStuck = Math.max(maxStuck, stuck); } lastS = st.s;
    if (s === 0) log.push(`opening line: "${st.title}"`);
    if (s % 10 === 0 || s === 3 || s === 6) { await p.screenshot({ path: `${OUT}untouched${phone ? '-390' : ''}-${String(s).padStart(2, '0')}.png` }); log.push(`${s}s  ${st.phase}  train at ${st.at || 'between stops'} (${Math.round(st.s)} m)`); }
    await p.waitForTimeout(Math.max(0, t0 + (s + 1) * 1000 - Date.now()));
  }
  const real = errs.filter((e) => !/models\/manifest\.json/.test(e));
  console.log(log.join('\n'));
  console.log(`opening seen: ${sawOpening}; it ended by itself after about ${openingEnd == null ? 'never' : openingEnd.toFixed(1) + ' s'}`);
  console.log(`train: moved in ${moved} of ${SECS} one-second samples, called at ${at.size} places (${[...at].join(', ')}), longest still spell ${maxStuck} s`);
  console.log(real.length ? real.join('\n') : `no console errors${errs.length ? ` (+${errs.length} × 404 for models/manifest.json: the model library has not arrived)` : ''}`);
  await b.close(); process.exit(sawOpening && openingEnd != null && openingEnd <= 8.6 && moved > SECS * 0.5 && at.size >= 3 && maxStuck <= 5 && !real.length ? 0 : 1);
})();
