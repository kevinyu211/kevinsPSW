/* Kevin Metro · ride matrix
   Every row of the project list, clicked from three different origins; direct clicks on stations and
   buildings in the view; "Connected to" hops; interruptions; the tour controls; the rail's filter and
   keyboard; links and the browser's back and forward. Real pointer clicks throughout (a click whose target
   is covered fails). Asserts arrival (the focus panel names the right station) and a clean console.
   3D and 2D, 1440 and 390.
     NODE_PATH=$(npm root -g) node designs/transit/_shots/ride-matrix.js [3d,2d] [1440,390]
   KM_SWIFT=1 uses the software renderer. The sim clock is sped up (?speed=); nothing else is changed. */
const { chromium } = require('playwright');
const U = process.env.KM_URL || 'http://localhost:8765/designs/transit/';
const modes = (process.argv[2] || '3d,2d').split(','); const sizes = (process.argv[3] || '1440,390').split(',').map(Number);
const SPEED = process.env.KM_SPEED || 8;
(async () => {
  const b = await chromium.launch({ args: process.env.KM_SWIFT ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const summary = [];
  for (const size of sizes) for (const mode of modes) {
    const phone = size < 700; const errs = []; const rows = [];
    const p = await b.newPage(phone ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1440, height: 900 } });
    p.on('pageerror', (e) => errs.push('pageerror ' + e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/ERR_CONNECTION_RESET/.test(m.text())) errs.push(m.text()); });
    await p.goto(`${U}?debug&nointro&speed=${SPEED}${mode === '2d' ? '&2d' : ''}`, { waitUntil: 'load' });
    await p.waitForFunction(() => window.__kmetro && (window.__kmetro.city || window.__kmetro.map) && !window.__kmetro.state().loading, null, { timeout: 90000 }); await p.waitForTimeout(800);
    const tap = (loc) => (phone ? loc.tap({ timeout: 8000 }) : loc.click({ timeout: 8000 }));
    const point = (x, y) => (phone ? p.touchscreen.tap(x, y) : p.mouse.click(x, y));
    const K = await p.evaluate(() => ({ stations: window.__kmetro.net.stations.map((s) => ({ id: s.id, name: s.name })), places: window.__kmetro.DEST.map((d) => ({ id: d.id, station: d.station })), rows: [...document.querySelectorAll('.rail-row')].map((r) => ({ key: r.dataset.key, place: r.dataset.place })) }));
    const nameOf = (sid) => K.stations.find((s) => s.id === sid).name; const placeAt = (sid) => K.places.find((d) => d.station === sid).id;
    const reset = (sid = 'kevin') => p.evaluate((sid) => window.__kmetro.reset(sid), sid);
    const state = () => p.evaluate(() => window.__kmetro.state());
    const arrived = (name, ms = 60000) => p.waitForFunction((name) => { const f = document.querySelector('[data-focus]'); const w = document.querySelector('[data-focus-where] b'); return f && !f.hidden && w && w.textContent === name && !window.__kmetro.state().riding; }, name, { timeout: ms });
    const dump = () => p.evaluate(() => { const k = window.__kmetro; const tr = k.sim.trip; return JSON.stringify({ st: k.state(), trip: tr ? tr.k + ':' + tr.phase + ' ' + tr.legs.map((l) => l.line + '>' + l.to).join(',') : 'none', where: (document.querySelector('[data-focus-where] b') || {}).textContent }); }).catch(() => '');
    const run = async (label, fn) => { const t0 = Date.now(); let ok = true; let why = ''; try { await fn(); } catch (e) { ok = false; why = String(e.message).split('\n')[0].slice(0, 100) + ' | ' + await dump(); } rows.push({ label, ok, s: ((Date.now() - t0) / 1000).toFixed(1), why }); };
    // click a row of the project list (on a phone the list is opened first)
    const row = async (key) => { if (phone && !(await state()).rail) await tap(p.locator('[data-rail-toggle]')); const loc = p.locator(`.rail-row[data-key="${key}"]`); await loc.scrollIntoViewIfNeeded(); await tap(loc); };
    const stationOf = (key) => K.places.find((d) => d.id === K.rows.find((r) => r.key === key).place).station;
    // 1. every project row, from three origins
    for (const from of ['kevin', 'hackhall', 'oldtown']) for (const r of K.rows) {
      const sid = stationOf(r.key); await reset(from);
      await run(`row ${r.key}: from ${nameOf(from)}`, async () => { await row(r.key); await arrived(nameOf(sid)); const s2 = await state(); if (s2.sel !== r.key) throw new Error(`row not marked: ${s2.sel}`); });
    }
    // 2. "Connected to": three hops in a row from the focus panel
    await reset('kevin');
    await run('connected to: three hops', async () => {
      await row('hirvo'); await arrived('East Gate');
      for (let i = 0; i < 3; i++) { const loc = p.locator('.focus-links .lk').first(); const lab = await loc.getAttribute('aria-label'); const name = lab.match(/^Ride to .*?, (.*?)\. /)[1]; await loc.scrollIntoViewIfNeeded(); await tap(loc); await arrived(name); }
    });
    // 3. direct clicks in the view itself
    if (mode === '2d') {
      for (const sid of ['harbour', 'jazz', 'university', 'hackhall', 'sports', 'party']) { await reset(); await run(`map: station ${nameOf(sid)}`, async () => { const [x, y] = await p.evaluate((sid) => window.__kmetro.map.pointOf(sid), sid); await point(x, y); await arrived(nameOf(sid)); }); }
      await reset(); await run('map: pin Hirvo', async () => { await tap(p.locator('.m-pin[aria-label^="Hirvo"] .m-pin-dot')); await arrived('East Gate'); });
    } else {
      // the view is brought near first (station names only show close up); the click itself is a real one
      const near = (sid, F) => p.evaluate(([sid, F]) => { const st = window.__kmetro.net.stById[sid]; window.__kmetro.city.setPose({ th: 1.2, ph: 0.8, F, x: st.pos[0], z: st.pos[1] }); }, [sid, F]);
      for (const sid of ['eastgate', 'cinema', 'medical']) { await reset(); await run(`3D: station label ${nameOf(sid)}`, async () => { await near(sid, 260); await p.waitForTimeout(700); await tap(p.locator(`.tag-st[data-id="${sid}"]`)); await arrived(nameOf(sid)); }); }
      for (const [id, name] of [['hirvo', 'East Gate'], ['snuggle', 'Old Town']]) { await reset(); await run(`3D: building ${id}`, async () => { await p.evaluate((id) => { const d = window.__kmetro.DEST.find((x) => x.id === id); window.__kmetro.city.setPose({ th: 0, ph: 1.45, F: 240, x: d.plot.x, z: d.plot.z }); }, id); await p.waitForTimeout(700); const pt = await p.evaluate((id) => window.__kmetro.city.projectHover({ type: 'dest', id }), id); await point(pt[0], pt[1]); await arrived(name); }); }
    }
    // 4. interruptions: a new destination while riding takes over; a second straight after replaces the first; skip
    await reset(); await run('interrupt: to Harbour, then to Jazz Alley mid-ride', async () => { await row('trade'); await p.waitForFunction(() => window.__kmetro.sim.trip && window.__kmetro.sim.trip.phase === 'ride', null, { timeout: 30000 }); await row('noir'); await arrived('Jazz Alley'); });
    await reset(); await run('interrupt: to Party House, then at once to Hackathon Hall', async () => { await row('party'); await row('hackathons'); await arrived('Hackathon Hall'); });
    await reset(); await run('skip the ride', async () => { await row('court'); await tap(p.locator('[data-skip]')); await arrived('Sports Park'); });
    // 5. the tour: pick one, a stop shows, next, pause, leave it
    await reset(); await run('tour: pick, next, pause, explore', async () => {
      if (phone && !(await state()).rail) await tap(p.locator('[data-rail-toggle]')); await tap(p.locator('.rail-foot [data-tour-open]')); await tap(p.locator('.tour-b[data-tour-id="software"]'));
      await p.waitForFunction(() => { const s = window.__kmetro.state(); return s.mode === 'tour' && s.tour.i === 0 && s.tour.shown; }, null, { timeout: 60000 });
      await tap(p.locator('[data-tour="next"]')); await p.waitForFunction(() => { const s = window.__kmetro.state(); return s.tour && s.tour.i === 1; }, null, { timeout: 8000 });
      await p.waitForFunction(() => window.__kmetro.state().tour.shown, null, { timeout: 60000 });
      await tap(p.locator('[data-tour="pause"]')); if (!(await state()).tour.paused) throw new Error('did not pause');
      await tap(p.locator('[data-tour="exit"]')); const s = await state(); if (s.mode !== 'explore' || !s.focusId) throw new Error('did not hand over to explore with the place open');
    });
    // 6. sheets, links, back and forward
    await reset(); await run('skills: pick a tag, ride to a match', async () => { if (phone && !(await state()).rail) await tap(p.locator('[data-rail-toggle]')); await tap(p.locator('.rail-foot [data-nav="skills"]')); await tap(p.locator('.skill-b[data-tag="Supabase"]')); if ((await state()).skill !== 'Supabase') throw new Error('tag not picked'); await tap(p.locator('.skill-res .stop-row').first()); await arrived('East Gate'); });
    await reset(); await run('links: #/station, #/about, back, forward', async () => {
      await p.evaluate(() => { location.hash = '#/station/jazz'; }); await arrived('Jazz Alley');
      await p.evaluate(() => { location.hash = '#/about'; }); await p.waitForFunction(() => window.__kmetro.state().sheet === 'about', null, { timeout: 5000 });
      await p.goBack(); await p.waitForFunction(() => window.__kmetro.state().sheet === null && window.__kmetro.state().focusId === 'jazz', null, { timeout: 5000 });
      await p.goForward(); await p.waitForFunction(() => window.__kmetro.state().sheet === 'about', null, { timeout: 5000 });
    });
    // the rail itself: the filter (and its empty state), and the keyboard
    await reset(); await run('rail: filter, empty state, keyboard', async () => {
      if (phone && !(await state()).rail) await tap(p.locator('[data-rail-toggle]'));
      await p.locator('.rail .filter').fill('zzzz'); if (!(await p.locator('.rail-none').isVisible())) throw new Error('no empty state'); await tap(p.locator('.rail-none button'));
      await p.locator('.rail .filter').fill('supabase'); const n = await p.locator('.rail-row:visible').count(); if (n !== 2) throw new Error(`filter "supabase" shows ${n} rows`);
      await p.locator('.rail .filter').fill(''); await p.locator('.rail-row[tabindex="0"]').focus(); await p.keyboard.press('Home'); await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter'); await arrived('East Gate');
      await p.keyboard.press('Escape'); await p.waitForFunction(() => !window.__kmetro.state().focusId, null, { timeout: 4000 });
    });
    const sw = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); rows.push({ label: 'no sideways scroll', ok: sw[0] <= sw[1], s: '-', why: JSON.stringify(sw) });
    const pass = rows.filter((r) => r.ok).length;
    console.log(`\n== ${mode.toUpperCase()} at ${size}: ${pass}/${rows.length} passed, ${errs.length} console errors`);
    rows.filter((r) => !r.ok).forEach((r) => console.log(`FAIL  ${r.label}  ${r.s}s  ${r.why}`)); errs.slice(0, 5).forEach((e) => console.log('  console: ' + e));
    summary.push({ mode, size, tried: rows.length, passed: pass, errors: errs.length });
    await p.close();
  }
  console.log('\nSUMMARY ' + JSON.stringify(summary)); await b.close();
  process.exit(summary.every((s) => s.tried === s.passed && !s.errors) ? 0 : 1);
})();
