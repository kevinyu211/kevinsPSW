/* Island city · the first visit, untouched
   Loads the plain address on the real GPU and touches nothing for 60 s. The opening must play and end by
   itself within 8 s. Then every train must keep running by itself and call at stations properly: stopped
   exactly at a station with its doors open, never fast through a platform. The console must stay clean.
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
  const stations = await p.evaluate(() => window.__city.towns.map((t) => ({ id: t.id, s: t.s }))); const L = await p.evaluate(() => window.__city.sim.LOOP_LEN);
  const near = (s) => { let best = 1e9; let id = null; for (const st of stations) { const d = Math.abs(((s - st.s + L * 1.5) % L) - L / 2); if (d < best) { best = d; id = st.id; } } return [best, id]; };
  const log = []; let openingEnd = null; let sawOpening = false; const calls = {}; const bad = []; const was = {}; let n = 0;
  while (Date.now() - t0 < SECS * 1000) {
    const st = await p.evaluate(() => { const c = window.__city.state(); return { phase: c.phase, trains: c.trains, tram: c.tram }; }); const sec = (Date.now() - t0) / 1000;
    if (st.phase === 'opening') sawOpening = true; if (sawOpening && st.phase === 'idle' && openingEnd == null) openingEnd = sec;
    for (const t of st.trains) {
      const [d, id] = near(t.s); const stopped = Math.abs(t.v) < 0.05;
      if (stopped && t.doors > 0.9) { if (d > 1) bad.push(`${t.id} stood with doors open ${d.toFixed(1)} m from ${id}`); if (was[t.id] !== id) { calls[t.id] = (calls[t.id] || []).concat(id); was[t.id] = id; } } else if (!stopped) was[t.id] = null;
      if (d < 4 && Math.abs(t.v) > 7) bad.push(`${t.id} went through ${id} at ${Math.abs(t.v).toFixed(1)} m/s`);
      if (!stopped && t.doors > 0.5) bad.push(`${t.id} moving with its doors open`);
    }
    if (n % 100 === 0) { const s = Math.round(sec); await p.screenshot({ path: `${OUT}untouched${phone ? '-390' : ''}-${String(s).padStart(2, '0')}.png` }); log.push(`${s}s  ${st.phase}  ${st.trains.map((t) => `${t.id}:${t.at || Math.round(t.s) + 'm'}`).join(' ')}  tram ${st.tram}`); }
    n++; await p.waitForTimeout(100);
  }
  const real = errs.filter((e) => !/models\/manifest\.json/.test(e)); const each = Object.entries(calls).map(([k, v]) => `${k}: ${v.length} (${v.join(' ')})`);
  console.log(log.join('\n'));
  console.log(`opening seen: ${sawOpening}; it ended by itself after about ${openingEnd == null ? 'never' : openingEnd.toFixed(1) + ' s'}`);
  console.log(`station calls in ${SECS} s, doors open: ${each.join(' · ')}`);
  console.log(bad.length ? `WRONG: ${[...new Set(bad)].slice(0, 6).join(' | ')}` : 'every stop was exactly at a station; no train passed a platform at speed or moved with its doors open');
  console.log(real.length ? real.join('\n') : 'no console errors');
  const ok = sawOpening && openingEnd != null && openingEnd <= 8.8 && Object.keys(calls).length >= 4 && Object.values(calls).every((v) => v.length >= 2) && !bad.length && !real.length;
  await b.close(); process.exit(ok ? 0 : 1);
})();
