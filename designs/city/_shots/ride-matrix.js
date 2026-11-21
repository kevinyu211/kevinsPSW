/* Island city · ride test
   Real pointer clicks, on the real GPU. Every trip must end with the right page title on screen.
     1. from the main station to every project and to the tower, at real speed, timed
     2. every project from every town (strip clicks), then random trips by the page's Next button and by
        clicking buildings in the 3D view
     3. stations (the town view), a redirect mid-ride, Skip, the page controls, Escape, links and back/forward
   NODE_PATH=$(npm root -g) node designs/city/_shots/ride-matrix.js [1440,390] [random trips=30] [seed]
   CITY_SPEED=4 speeds the sim clock for part 1 too (the timings are then scaled back). */
const { chromium } = require('playwright');
const U = process.env.CITY_URL || 'http://localhost:8765/designs/city/';
const sizes = (process.argv[2] || '1440,390').split(',').map(Number); const TRIPS = +(process.argv[3] || 30); const SEED = +(process.argv[4] || 20261121);
const SP1 = +(process.env.CITY_SPEED || 1); const SP2 = 4; const Q = process.env.CITY_Q || 'time=day&weather=clear';
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const summary = [];
  for (const size of sizes) {
    let seed = SEED + size; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const phone = size < 700; const errs = []; const ext = []; const rows = [];
    const ctx = await b.newContext(phone ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage(); ctx.on('page', (np) => { if (np !== p) np.close().catch(() => {}); });
    p.on('pageerror', (e) => errs.push('pageerror ' + e.message));
    p.on('console', (m) => { if (m.type() !== 'error') return; const url = (m.location() || {}).url || ''; (url && !url.startsWith(new URL(U).origin) ? ext : errs).push(`${m.text()} ${url}`); });
    const open = async (speed) => { await p.goto(`${U}?debug&nointro&speed=${speed}&${Q}`, { waitUntil: 'load' }); await p.waitForFunction(() => window.__city && window.__city.state().phase === 'idle', null, { timeout: 90000 }); await p.waitForTimeout(600); };
    const tap = (loc) => (phone ? loc.tap({ timeout: 8000 }) : loc.click({ timeout: 8000 }));
    const point = (x, y) => (phone ? p.touchscreen.tap(x, y) : p.mouse.click(x, y));
    const state = () => p.evaluate(() => window.__city.state());
    const K = await (async () => { await open(SP1); return p.evaluate(() => ({ ids: window.__city.stops.map((s) => s.id), towns: window.__city.towns.map((t) => t.id), townOf: Object.fromEntries(window.__city.stops.map((s) => [s.id, s.town.id])), titles: Object.fromEntries([...window.__city.stops.map((s) => [s.id, s.title]), ['tower', window.KY.person.name]]) })); })();
    const arrived = (id, ms = 40000) => p.waitForFunction(([id, title]) => { const s = window.__city.state(); const pg = document.querySelector('[data-page]'); const t = document.getElementById('page-title'); return s.page === id && !s.ride && pg && !pg.hidden && pg.classList.contains('is-in') && t && t.textContent === title; }, [id, K.titles[id]], { timeout: ms });
    const run = async (label, fn) => { const t0 = Date.now(); let ok = true; let why = ''; let extra; try { extra = await fn(); } catch (e) { ok = false; why = String(e.message).split('\n')[0].slice(0, 140) + ' | ' + JSON.stringify(await state().catch(() => ({}))).slice(0, 260); } rows.push({ label, ok, s: (Date.now() - t0) / 1000, why, extra }); return ok; };
    const stripClick = async (id) => { const loc = p.locator(`[data-strip] [data-stop="${id}"]`); await loc.scrollIntoViewIfNeeded(); await tap(loc); };
    const closeByButton = async () => { await tap(p.locator('[data-close]')); await p.waitForFunction(() => { const s = window.__city.state(); return !s.page && s.phase === 'idle'; }, null, { timeout: 8000 }); };

    // 1. from the main station to every stop and to the tower, timed
    const times = []; const ONLY3 = process.env.CITY_ONLY === '3';
    for (const id of ONLY3 ? [] : [...K.ids, 'tower']) {
      await p.evaluate(() => window.__city.reset()); await p.waitForTimeout(250);
      await run(`main station to ${id}`, async () => { const t0 = Date.now(); await stripClick(id); await arrived(id); const sec = ((Date.now() - t0) / 1000) * SP1; times.push([id, +sec.toFixed(1)]); return sec; });
    }
    // 2. random stop-to-stop trips
    await open(SP2); let how = { strip: 0, next: 0, building: 0 };
    for (const town of ONLY3 ? [] : K.towns) for (const id of K.ids) { await p.evaluate((t) => window.__city.reset(t), town); await p.waitForTimeout(120); await run(`from ${town} to ${id}`, async () => { await stripClick(id); await arrived(id); const st = await state(); if (st.at !== K.townOf[id]) throw new Error('visitor not in the right town: ' + st.at); }); how.strip++; }
    await p.evaluate(() => window.__city.reset());
    for (let i = 0; i < (ONLY3 ? 0 : TRIPS); i++) {
      const st = await state(); const from = st.page || st.here; let to = K.ids[Math.floor(rnd() * K.ids.length)]; if (to === from) to = K.ids[(K.ids.indexOf(to) + 3) % K.ids.length];
      const r = rnd();
      await run(`trip ${i + 1}: ${from} to ${to}`, async () => {
        if (st.page && r < 0.3) { // the page's own Next button goes one stop on
          to = await p.evaluate(() => { const o = window.__city.stops.map((s) => s.id); const pg = window.__city.state().page; return pg === 'tower' ? o[0] : o[(o.indexOf(pg) + 1) % o.length]; });
          await tap(p.locator('[data-page-next]')); how.next++; await arrived(to); return;
        }
        if (st.page) await closeByButton();
        if (r > 0.62) { // click the building itself in the 3D view, from the default angle
          await tap(p.locator('[data-reset]')); await p.waitForFunction(() => window.__city.state().mode === 'orbit', null, { timeout: 8000 }); await p.waitForTimeout(450);
          const pt = await p.evaluate((id) => { const v = window.__city.view; const q = v.pointOf && v.pointOf(id); if (!q) return null; const el = document.elementFromPoint(q[0], q[1]); return el && el.classList.contains('city-canvas') && v.pick(q[0], q[1]) === id ? q : null; }, to);
          if (pt) { // a click in the view only looks; the card that appears offers the ride
            await point(pt[0], pt[1]); await p.waitForFunction((id) => window.__city.state().focus === id && !document.querySelector('[data-focus]').hidden, to, { timeout: 8000 });
            await tap(p.locator('[data-focus-a] .btn-ink')); how.building++; await arrived(to); return;
          }
        }
        await stripClick(to); how.strip++; await arrived(to);
      });
    }
    // 3. the awkward things
    await p.evaluate(() => window.__city.reset());
    await run('redirect: to the far side, then another stop mid-ride', async () => { await stripClick(K.ids[8]); await p.waitForTimeout(900); await stripClick(K.ids[2]); await arrived(K.ids[2]); if ((await state()).page !== K.ids[2]) throw new Error('wrong page'); });
    await p.evaluate(() => window.__city.reset());
    await run('redirect while the doors are opening', async () => { await stripClick(K.ids.find((i) => K.townOf[i] === K.towns[3])); await p.waitForFunction(() => window.__city.state().mode === 'inside' || document.querySelector('[data-cabin]').classList.contains('is-on'), null, { timeout: 20000 }); /* inside the car (3D) or the drawn cabin (flat map) */ await stripClick(K.ids[12]); await arrived(K.ids[12]); });
    await p.evaluate(() => window.__city.reset());
    await run('a station: ride there and see the whole town, then pick a building', async () => { const town = K.towns[2]; await stripClick(town); await p.waitForFunction((t) => { const s = window.__city.state(); return s.at === t && s.focus === t && !s.ride && s.phase === 'idle' && s.mode === 'orbit'; }, town, { timeout: 30000 }); const first = K.ids.find((i) => K.townOf[i] === town); const n = await p.locator('[data-focus-a] .btn-p').count(); if (n !== K.ids.filter((i) => K.townOf[i] === town).length) throw new Error('town card lists ' + n + ' projects'); await tap(p.locator('[data-focus-a] .btn-p').first()); await arrived(first); });
    await p.evaluate(() => window.__city.reset());
    await run('a second click skips the ride', async () => { await stripClick(K.ids[9]); await p.waitForTimeout(500); await stripClick(K.ids[9]); await arrived(K.ids[9], 3500); });
    await run('Escape closes the page', async () => { await p.keyboard.press('Escape'); await p.waitForFunction(() => { const s = window.__city.state(); return !s.page && s.phase === 'idle' && document.querySelector('[data-page]').hidden; }, null, { timeout: 6000 }); if ((await state()).here !== K.ids[9]) throw new Error('not back at that station'); });
    await run('Next stop button', async () => { await tap(p.locator('[data-next]')); await arrived(K.ids[10]); });
    await run('tower from a stop: train, then the hill tram', async () => { await closeByButton(); await stripClick('tower'); await arrived('tower'); });
    await run('from the tower back down to a project', async () => { await tap(p.locator('[data-page-next]')); await arrived(K.ids[0]); await closeByButton(); await stripClick(K.ids[4]); await arrived(K.ids[4]); });
    await run('the page sits beside the building, not over it', async () => {
      const g = await p.evaluate(() => { const pg = document.querySelector('[data-page]').getBoundingClientRect(); const st = document.querySelector('[data-stage]').getBoundingClientRect(); const s = window.__city.state(); const pt = window.__city.view.pointOf(s.page); return { mode: s.pageMode, pg: [pg.left, pg.top, pg.right, pg.bottom], st: [st.left, st.top, st.right, st.bottom], pt, wide: innerWidth > 760 }; });
      if (g.mode !== 'side') throw new Error('page mode is ' + g.mode);
      const free = g.wide ? (g.pg[0] - g.st[0]) / (g.st[2] - g.st[0]) : (g.pg[1] - g.st[1]) / (g.st[3] - g.st[1]); if (free < 0.33) throw new Error(`only ${(free * 100).toFixed(0)}% of the view is left for the building`);
      await p.waitForTimeout(700); const pt = await p.evaluate(() => window.__city.view.pointOf(window.__city.state().page));
      if (!pt || (g.wide ? pt[0] > g.pg[0] - 20 : pt[1] > g.pg[1] - 20) || pt[0] < 0 || pt[1] < 40) throw new Error('the building is behind the page or off screen: ' + JSON.stringify(pt));
      return free;
    });
    await run('page controls: look at the building, read again, expand, shrink', async () => {
      await tap(p.locator('[data-tuck]')); await p.waitForFunction(() => window.__city.state().pageMode === 'tucked', null, { timeout: 4000 }); await p.waitForTimeout(700);
      const hidden = await p.evaluate(() => { const r = document.querySelector('[data-page]').getBoundingClientRect(); return r.left >= innerWidth - 2 || r.top >= innerHeight - 2; }); if (!hidden) throw new Error('tucked page is still on screen');
      await tap(p.locator('[data-focus-a] .btn-ink')); await p.waitForFunction(() => window.__city.state().pageMode === 'side', null, { timeout: 4000 }); await p.waitForTimeout(700);
      await tap(p.locator('[data-expand]')); await p.waitForFunction(() => window.__city.state().pageMode === 'full', null, { timeout: 4000 }); await p.waitForTimeout(300);
      const full = await p.evaluate(() => { const r = document.querySelector('[data-page]').getBoundingClientRect(); return r.width >= innerWidth - 1 && r.height >= innerHeight - 1; }); if (!full) throw new Error('expanded page does not fill the screen');
      await p.keyboard.press('Escape'); await p.waitForFunction(() => window.__city.state().pageMode === 'side', null, { timeout: 4000 });
    });
    await run('closing the page leaves the visitor at the building, free to move', async () => {
      const id = (await state()).page; await closeByButton(); await p.waitForTimeout(600); const s = await state(); if (s.focus !== id || (s.mode !== 'orbit' && s.mode !== 'tween')) throw new Error('not left looking at the building: ' + JSON.stringify(s).slice(0, 160));
      const pt = await p.evaluate((id) => window.__city.view.pointOf(id), id); const vw = p.viewportSize(); if (!pt || pt[0] < 0 || pt[0] > vw.width || pt[1] < 0 || pt[1] > vw.height) throw new Error('building not on screen');
      await tap(p.locator('[data-focus-a] .btn-ink')); await arrived(id);
    });
    await run('look without riding: click a building, the camera glides, Read now opens its page', async () => {
      if ((await state()).page) await closeByButton(); await tap(p.locator('[data-reset]')); await p.waitForFunction(() => window.__city.state().mode === 'orbit' && !window.__city.state().focus, null, { timeout: 8000 }); await p.waitForTimeout(500);
      let id = null; let pt = null; for (const c of K.ids) { pt = await p.evaluate((c) => { const v = window.__city.view; const q = v.pointOf(c); if (!q) return null; const el = document.elementFromPoint(q[0], q[1]); return el && el.classList.contains('city-canvas') && v.pick(q[0], q[1]) === c ? q : null; }, c); if (pt) { id = c; break; } }
      if (!id) throw new Error('no building could be clicked from the default view');
      await point(pt[0], pt[1]);
      await p.waitForFunction((id) => { const s = window.__city.state(); return s.focus === id && !s.ride && !s.page; }, id, { timeout: 8000 }); await p.waitForFunction(() => window.__city.state().mode === 'orbit', null, { timeout: 8000 });
      const s = await state(); if (s.ride || s.page) throw new Error('a look started a ride or a page');
      await tap(p.locator('[data-focus-a] .btn:not(.btn-ink)')); await arrived(id);
    });
    if (!phone) await run('keyboard: Tab to a project on the strip, Enter', async () => { if ((await state()).page) await closeByButton(); await p.locator(`[data-strip] [data-stop="${K.ids[0]}"]`).focus(); await p.keyboard.press('Tab'); await p.keyboard.press('Enter'); await arrived(K.ids[1]); });
    await run('links: #/stop, back, forward', async () => {
      await p.evaluate((id) => { location.hash = `#/${id}`; }, K.ids[6]); await arrived(K.ids[6]);
      await p.evaluate(() => { location.hash = '#/tower'; }); await arrived('tower');
      await p.goBack(); await arrived(K.ids[6]); await p.goForward(); await arrived('tower');
    });
    await run('a page opens straight from its link', async () => { await p.goto(`${U}?debug&${Q}#/${K.ids[3]}`, { waitUntil: 'load' }); await p.reload({ waitUntil: 'load' }); await p.waitForFunction(() => window.__city, null, { timeout: 60000 }); await arrived(K.ids[3]); });
    const sw = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); rows.push({ label: 'no sideways scroll', ok: sw[0] <= sw[1], s: 0, why: JSON.stringify(sw) });
    const pass = rows.filter((r) => r.ok).length; const real = errs.filter((e) => !/models\/manifest\.json/.test(e)); const manifest = errs.length - real.length;
    console.log(`\n== ${size}: ${pass}/${rows.length} passed · ${real.length} console errors${manifest ? ` (+${manifest} × 404 for models/manifest.json, the model library that has not arrived)` : ''}${ext.length ? ` · ${ext.length} from other sites` : ''}`);
    console.log(`   ride times from the main station, seconds: ${times.map(([id, s]) => `${id} ${s}`).join(', ')}`);
    if (times.length) console.log(`   shortest ${Math.min(...times.map((t) => t[1]))} s, longest ${Math.max(...times.map((t) => t[1]))} s`);
    console.log(`   random trips by: strip ${how.strip}, page Next ${how.next}, 3D building ${how.building}`);
    rows.filter((r) => !r.ok).forEach((r) => console.log(`FAIL  ${r.label}  ${r.s.toFixed(1)}s  ${r.why}`)); real.slice(0, 6).forEach((e) => console.log('  console: ' + e)); ext.slice(0, 3).forEach((e) => console.log('  other site: ' + e));
    summary.push({ size, tried: rows.length, passed: pass, errors: real.length, manifest404: manifest });
    await ctx.close();
  }
  console.log('\nSUMMARY ' + JSON.stringify(summary)); await b.close();
  process.exit(summary.every((s) => s.tried === s.passed && !s.errors) ? 0 : 1);
})();
