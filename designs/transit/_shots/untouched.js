/* Kevin Metro · the first visit, untouched
   Loads the plain address on the real GPU, touches nothing for 90 s, saves a frame every 5 s and records what
   the page did by itself. It must have opened, started the tour and shown at least four stops with captions.
     NODE_PATH=$(npm root -g) node designs/transit/_shots/untouched.js [1440|390] */
const { chromium } = require('playwright');
const U = process.env.KM_URL || 'http://localhost:8765/designs/transit/'; const OUT = __dirname + '/';
(async () => {
  const phone = process.argv[2] === '390';
  const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const p = await b.newPage(phone ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1440, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push('pageerror ' + e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(U, { waitUntil: 'load' }); const t0 = Date.now(); const seen = []; const log = [];
  for (let s = 0; s <= 90; s++) {
    const st = await p.evaluate(() => { const c = document.querySelector('[data-cap]'); const o = document.querySelector('[data-opening]'); return { opening: o && !o.hidden, cap: c && !c.hidden ? (c.querySelector('.cap-title') || {}).textContent : null, one: c && !c.hidden ? (c.querySelector('.cap-one') || {}).textContent : null, dock: (document.querySelector('.tour-now') || document.querySelector('.dock-at') || {}).textContent || '' }; });
    if (st.cap && !seen.includes(st.cap)) { seen.push(st.cap); log.push(`${s}s  stop ${seen.length}: ${st.cap} — ${st.one}`); }
    if (s % 5 === 0) { await p.screenshot({ path: `${OUT}v8-untouched${phone ? '-390' : ''}-${String(s).padStart(2, '0')}.png` }); log.push(`${s}s  ${st.opening ? 'opening' : st.cap ? 'at ' + st.cap : st.dock}`); }
    await p.waitForTimeout(Math.max(0, t0 + (s + 1) * 1000 - Date.now()));
  }
  console.log(log.join('\n')); console.log(`stops with captions in 90 s: ${seen.length} (${seen.join(', ')})`); console.log(errs.length ? errs.join('\n') : 'no console errors');
  await b.close(); process.exit(seen.length >= 4 && !errs.length ? 0 : 1);
})();
