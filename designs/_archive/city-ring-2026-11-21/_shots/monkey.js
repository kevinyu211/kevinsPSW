/* Island city · random-click test
   300 random real pointer actions per run: any button on screen (the strip, the top bar, the page, the
   opening), clicks and drags on the island, the wheel, keys, back and forward, a resize, a link. On the real
   GPU at 1440 and 390. After every 15 actions it checks the page is not stuck (a ride ends within a bounded
   time), that there is a visible way to go on, that nothing scrolls sideways, and that the console is clean.
     NODE_PATH=$(npm root -g) node designs/city/_shots/monkey.js [1440,390] [seed] [actions=300] */
const { chromium } = require('playwright');
const U = process.env.CITY_URL || 'http://localhost:8765/designs/city/';
const sizes = (process.argv[2] || '1440,390').split(',').map(Number); const SEED = +(process.argv[3] || 20261121); const N = +(process.argv[4] || 300);
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const summary = [];
  for (const size of sizes) {
    let seed = SEED + size; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; const pick = (a) => a[Math.floor(rnd() * a.length)];
    const phone = size < 700; const errs = []; const log = []; const fails = []; let manifest = 0;
    const ctx = await b.newContext(phone ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage(); ctx.on('page', (np) => { if (np !== p) np.close().catch(() => {}); });
    p.on('pageerror', (e) => errs.push(`pageerror ${e.message} @ action ${log.length}`));
    p.on('console', (m) => { if (m.type() !== 'error') return; const url = (m.location() || {}).url || ''; if (/models\/manifest\.json/.test(url)) { manifest++; return; } if (url && !url.startsWith(new URL(U).origin)) return; errs.push(`${m.text()} ${url} @ action ${log.length}`); });
    await p.goto(`${U}?debug&speed=3&time=day&weather=clear`, { waitUntil: 'load' });
    await p.waitForFunction(() => window.__city && window.__city.state().phase !== 'loading', null, { timeout: 90000 }); await p.waitForTimeout(400);
    const here = () => p.url().startsWith(U.replace(/\/$/, ''));
    const point = (x, y) => (phone ? p.touchscreen.tap(x, y) : p.mouse.click(x, y));
    const ids = await p.evaluate(() => ['main', 'tower', ...window.__city.stops.map((s) => s.id)]);
    // a random button that is really on top at its own centre (links that leave the page are left alone)
    const anyButton = () => p.evaluate((r) => {
      const list = [...document.querySelectorAll('button')].filter((el) => { if (el.disabled || el.closest('[inert]') || el.classList.contains('yt')) return false; const q = el.getBoundingClientRect(); if (q.width < 4 || q.height < 4 || q.top < 0 || q.left < 0 || q.bottom > innerHeight || q.right > innerWidth) return false; const top = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2); return top && (el === top || el.contains(top)); });
      if (!list.length) return null; const el = list[Math.floor(r * list.length)]; const q = el.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2, what: (el.getAttribute('aria-label') || el.textContent || el.className).trim().replace(/\s+/g, ' ').slice(0, 44) };
    }, rnd());
    const stage = () => p.evaluate(() => { const q = document.querySelector('[data-stage]').getBoundingClientRect(); return [q.left, q.top, q.width, q.height]; });
    const onStage = (x, y) => p.evaluate(([x, y]) => { const el = document.elementFromPoint(x, y); return !!el && !!el.closest('[data-stage]'); }, [x, y]);
    const acts = [
      [36, async () => { const t = await anyButton(); if (!t) return 'no button'; await point(t.x, t.y); return `button "${t.what}"`; }],
      [12, async () => { const id = pick(ids); const pt = await p.evaluate((id) => { const v = window.__city.view; return v.pointOf ? v.pointOf(id) : null; }, id).catch(() => null); if (!pt || !(await onStage(pt[0], pt[1]))) return `building ${id} not reachable`; await point(pt[0], pt[1]); return `building ${id}`; }],
      [8, async () => { const [l, t, w, h] = await stage(); const x = l + w * rnd(); const y = t + h * rnd(); if (!(await onStage(x, y))) return 'stage point covered'; await point(x, y); return 'click the island somewhere'; }],
      [10, async () => { const [l, t, w, h] = await stage(); const x0 = l + w * (0.25 + rnd() * 0.5); const y0 = t + h * (0.25 + rnd() * 0.4); if (!(await onStage(x0, y0))) return 'drag: covered'; if (phone) { const cdp = await ctx.newCDPSession(p); const x1 = x0 + (rnd() - 0.5) * 160; const y1 = y0 + (rnd() - 0.5) * 160; await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] }); for (let k = 1; k <= 4; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + ((x1 - x0) * k) / 4, y: y0 + ((y1 - y0) * k) / 4 }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await cdp.detach(); return 'swipe the island'; } await p.mouse.move(x0, y0); await p.mouse.down({ button: rnd() < 0.3 ? 'right' : 'left' }); await p.mouse.move(x0 + (rnd() - 0.5) * 300, y0 + (rnd() - 0.5) * 200, { steps: 5 }); await p.mouse.up({ button: 'left' }); await p.mouse.up({ button: 'right' }).catch(() => {}); return 'drag the island'; }],
      [7, async () => { if (phone) return 'wheel: phone'; const [l, t, w, h] = await stage(); await p.mouse.move(l + w / 2, t + h / 2); await p.mouse.wheel(0, (rnd() - 0.5) * 1800); return 'wheel'; }],
      [9, async () => { const k = pick(['Escape', 'Escape', 'Tab', 'Tab', 'Enter', ' ', 'ArrowRight', 'ArrowLeft', 'Home', 'End']); await p.keyboard.press(k); return `key ${k === ' ' ? 'Space' : k}`; }],
      [7, async () => { const back = rnd() < 0.6; const did = await p.evaluate((back) => { const e = navigation.entries(); const i = navigation.currentEntry.index + (back ? -1 : 1); if (i < 0 || i >= e.length || new URL(e[i].url).pathname !== location.pathname) return false; if (back) history.back(); else history.forward(); return true; }, back); return `${back ? 'history back' : 'history forward'}${did ? '' : ' (nothing there)'}`; }],
      [4, async () => { if (phone) { const land = p.viewportSize().width < 500; await p.setViewportSize(land ? { width: 844, height: 390 } : { width: 390, height: 844 }); return land ? 'rotate to landscape' : 'rotate to portrait'; } const w = pick([1440, 1180, 1024, 1440]); await p.setViewportSize({ width: w, height: w === 1024 ? 720 : 900 }); return `resize ${w}`; }],
      [4, async () => { await p.evaluate((h) => { location.hash = h; }, pick(['#/yae', '#/tower', '#/main', '#/hirvo', '#/nonsense', ''])); return 'hash link'; }],
      [3, async () => { await p.mouse.wheel(0, (rnd() - 0.3) * 1400).catch(() => {}); return 'scroll the page'; }],
    ];
    const total = acts.reduce((a, x) => a + x[0], 0);
    const health = async (i) => {
      if (!here()) { fails.push(`left the page after action ${i}: ${p.url()}`); await p.goto(`${U}?debug&speed=3&nointro&time=day&weather=clear`); await p.waitForFunction(() => window.__city && window.__city.state().phase !== 'loading', null, { timeout: 60000 }); return; }
      if (await p.evaluate(() => !!window.__city.state().ride)) { try { await p.waitForFunction(() => !window.__city.state().ride, null, { timeout: 30000 }); } catch (e) { fails.push(`stuck riding after action ${i}: ${JSON.stringify(await p.evaluate(() => window.__city.state())).slice(0, 220)}`); await p.evaluate(() => window.__city.reset()); } }
      const h = await p.evaluate(() => { const vis = (el) => { const q = el.getBoundingClientRect(); if (q.width < 4 || q.height < 4 || el.disabled || el.closest('[inert]') || q.bottom <= 0 || q.top >= innerHeight) return false; const top = document.elementFromPoint(Math.min(innerWidth - 1, Math.max(0, q.left + q.width / 2)), Math.min(innerHeight - 1, Math.max(0, q.top + q.height / 2))); return !!top && (el === top || el.contains(top)); }; const st = window.__city.state(); const pg = document.querySelector('[data-page]'); return { way: [...document.querySelectorAll('.strip button, .page button')].filter(vis).length, sw: document.documentElement.scrollWidth, iw: innerWidth, st: { phase: st.phase, here: st.here, page: st.page, ride: st.ride, mode: st.mode }, pageShown: !pg.hidden, cabin: document.querySelector('[data-cabin]').className }; });
      if (h.way < 1) fails.push(`no way on after action ${i}: ${JSON.stringify(h)}`);
      if (h.sw > h.iw + 1) fails.push(`sideways scroll after action ${i}: ${h.sw} > ${h.iw}`);
      if (h.st.page && !h.pageShown) fails.push(`page state without a page after action ${i}: ${JSON.stringify(h.st)}`);
      if (!h.st.page && h.st.phase === 'page') fails.push(`phase "page" with no page after action ${i}: ${JSON.stringify(h.st)}`);
      if (!h.st.ride && /is-on/.test(h.cabin) && !/is-out/.test(h.cabin)) fails.push(`train doors left on screen after action ${i}: ${JSON.stringify(h.st)}`);
    };
    for (let i = 1; i <= N; i++) {
      let r = rnd() * total; let fn = acts[0][1]; for (const [w, f] of acts) { if ((r -= w) < 0) { fn = f; break; } }
      let what; try { what = await fn(); } catch (e) { what = 'action error: ' + String(e.message).split('\n')[0].slice(0, 80); }
      log.push(`${i} ${what}`); await p.waitForTimeout(120 + rnd() * 260);
      if (i % 15 === 0) await health(i);
    }
    if (phone) await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(600); await health(N);
    // and it still works afterwards: one clean ride
    try { await p.evaluate(() => window.__city.reset('main')); await p.waitForTimeout(300); const loc = p.locator('.stop-b[data-stop="hirvo"]'); await loc.scrollIntoViewIfNeeded(); await (phone ? loc.tap() : loc.click()); await p.waitForFunction(() => window.__city.state().page === 'hirvo' && !window.__city.state().ride, null, { timeout: 30000 }); } catch (e) { fails.push('after the run, a plain ride to the first stop did not arrive: ' + String(e.message).split('\n')[0]); }
    const ok = !fails.length && !errs.length;
    console.log(`\n== random clicks at ${size}, seed ${SEED}: ${N} actions, ${fails.length} failures, ${errs.length} console errors${manifest ? ` (+${manifest} × 404 for models/manifest.json)` : ''}`);
    fails.slice(0, 8).forEach((f) => console.log('  FAIL ' + f)); errs.slice(0, 6).forEach((e) => console.log('  console: ' + e));
    if (!ok) { const at = +(String(fails[0] || errs[0]).match(/action (\d+)/) || [0, N])[1]; console.log('  around it: ' + log.slice(Math.max(0, at - 16), at + 1).join(' | ')); }
    summary.push({ size, actions: N, failures: fails.length, errors: errs.length });
    await ctx.close();
  }
  console.log('\nSUMMARY ' + JSON.stringify(summary)); await b.close();
  process.exit(summary.every((s) => !s.failures && !s.errors) ? 0 : 1);
})();
