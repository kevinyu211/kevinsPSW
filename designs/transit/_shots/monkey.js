/* Kevin Metro · monkey test
   300 random real pointer actions per run: clicks on whatever buttons are on screen (the project list, tour
   controls, sheets, the top bar, the camera cluster), clicks on stations and buildings in the
   view, drags, wheel, keys, the browser's back and forward, a resize. On the real GPU, in 3D and 2D, at 1440
   and 390. After every 15 actions it checks that the app is not stuck (a ride in progress ends within a
   bounded time), that there is a visible way to go on, that the page has no sideways scroll, and that the
   console is clean. A seed makes a run repeatable:
     NODE_PATH=$(npm root -g) node designs/transit/_shots/monkey.js [3d,2d] [1440,390] [seed] [actions] */
const { chromium } = require('playwright');
const U = process.env.KM_URL || 'http://localhost:8765/designs/transit/';
const modes = (process.argv[2] || '3d,2d').split(','); const sizes = (process.argv[3] || '1440,390').split(',').map(Number);
const SEED = +(process.argv[4] || 20261120); const N = +(process.argv[5] || 300);
(async () => {
  const b = await chromium.launch({ args: process.env.KM_SWIFT ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const summary = [];
  for (const size of sizes) for (const mode of modes) {
    let seed = SEED + size + (mode === '2d' ? 7 : 0); const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; const pick = (a) => a[Math.floor(rnd() * a.length)];
    const phone = size < 700; const errs = []; const log = []; const fails = [];
    const p = await b.newPage(phone ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1440, height: 900 } });
    p.on('pageerror', (e) => errs.push(`pageerror ${e.message} @ action ${log.length}`)); p.on('console', (m) => { if (m.type() === 'error' && !/ERR_CONNECTION_RESET|ERR_ABORTED|Failed to load resource/.test(m.text())) errs.push(`${m.text()} @ action ${log.length}`); });
    await p.goto(`${U}?debug&speed=6${mode === '2d' ? '&2d' : ''}`, { waitUntil: 'load' });
    await p.waitForFunction(() => window.__kmetro && (window.__kmetro.city || window.__kmetro.map) && !window.__kmetro.state().loading, null, { timeout: 90000 }); await p.waitForTimeout(500);
    const point = (x, y) => (phone ? p.touchscreen.tap(x, y) : p.mouse.click(x, y));
    const vw = () => p.viewportSize();
    const ids = await p.evaluate(() => ({ st: window.__kmetro.net.stations.map((s) => s.id), dest: window.__kmetro.DEST.map((d) => d.id) }));
    // a random button that is really on top at its own centre
    const anyButton = () => p.evaluate((r) => {
      const list = [...document.querySelectorAll('.bar button, .rail button, .rail input, .focus button, .sheet-in button, .ctl button, .opening button, .read-bar button, .pass-dlg button, .tcard button')].filter((el) => { if (el.disabled) return false; const q = el.getBoundingClientRect(); if (q.width < 4 || q.height < 4 || q.top < 0 || q.left < 0 || q.bottom > innerHeight || q.right > innerWidth) return false; const top = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2); return top && (el === top || el.contains(top)); });
      if (!list.length) return null; const el = list[Math.floor(r * list.length)]; const q = el.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2, what: (el.getAttribute('aria-label') || el.textContent || el.className).trim().slice(0, 40) };
    }, rnd());
    const stage = async () => p.evaluate(() => { const q = document.querySelector('[data-stage]').getBoundingClientRect(); return [q.left, q.top, q.width, q.height]; });
    const onStage = async (x, y) => p.evaluate(([x, y]) => { const el = document.elementFromPoint(x, y); return !!el && !!el.closest('[data-stage]'); }, [x, y]);
    const acts = [
      [34, async () => { const t = await anyButton(); if (!t) return 'no button'; await point(t.x, t.y); return `button "${t.what}"`; }],
      [12, async () => { const sid = pick(ids.st); const pt = await p.evaluate(([sid, two]) => (two ? window.__kmetro.map.pointOf(sid) : window.__kmetro.city.projectHover({ type: 'station', id: sid })), [sid, mode === '2d' || (await p.evaluate(() => window.__kmetro.state().mode2d))]).catch(() => null); if (!pt || !(await onStage(pt[0], pt[1]))) return `station ${sid} not reachable`; await point(pt[0], pt[1]); return `station ${sid}`; }],
      [7, async () => { if (await p.evaluate(() => window.__kmetro.state().mode2d || !window.__kmetro.city)) return 'building: 2D'; const id = pick(ids.dest); const pt = await p.evaluate((id) => window.__kmetro.city.projectHover({ type: 'dest', id }), id); if (!pt || !(await onStage(pt[0], pt[1]))) return `building ${id} not reachable`; await point(pt[0], pt[1]); return `building ${id}`; }],
      [10, async () => { const [l, t, w, h] = await stage(); const x0 = l + w * (0.25 + rnd() * 0.5); const y0 = t + h * (0.25 + rnd() * 0.4); if (!(await onStage(x0, y0))) return 'drag: covered'; if (phone) { await p.touchscreen.tap(x0, y0); return 'tap stage'; } await p.mouse.move(x0, y0); await p.mouse.down({ button: rnd() < 0.3 ? 'right' : 'left' }); await p.mouse.move(x0 + (rnd() - 0.5) * 300, y0 + (rnd() - 0.5) * 200, { steps: 5 }); await p.mouse.up({ button: 'left' }); await p.mouse.up({ button: 'right' }).catch(() => {}); return 'drag stage'; }],
      [6, async () => { if (phone) return 'wheel: phone'; const [l, t, w, h] = await stage(); await p.mouse.move(l + w / 2, t + h / 2); await p.mouse.wheel(0, (rnd() - 0.5) * 1600); return 'wheel'; }],
      [8, async () => { const k = pick(['Escape', 'Escape', 'm', ' ', 'q', 'ArrowLeft', '+', 'Tab', 'Enter']); await p.keyboard.press(k); return `key ${k === ' ' ? 'Space' : k}`; }],
      [7, async () => { const back = rnd() < 0.6; const did = await p.evaluate((back) => { const e = navigation.entries(); const i = navigation.currentEntry.index + (back ? -1 : 1); if (i < 0 || i >= e.length || new URL(e[i].url).pathname !== location.pathname) return false; if (back) history.back(); else history.forward(); return true; }, back); return `${back ? 'history back' : 'history forward'}${did ? '' : ' (nothing there)'}`; }], // never back past the page itself
      [3, async () => { if (phone) { const land = vw().width < 500; await p.setViewportSize(land ? { width: 844, height: 390 } : { width: 390, height: 844 }); return land ? 'rotate to landscape' : 'rotate to portrait'; } const w = pick([1440, 1180, 1024, 1440]); await p.setViewportSize({ width: w, height: w === 1024 ? 720 : 900 }); return `resize ${w}`; }],
      [3, async () => { await p.evaluate(() => { location.hash = ['#/station/jazz', '#/hirvo', '#/tour/games', '#/skills/Expo', '#/about', '#/work', '#/contact', ''][Math.floor(Math.random() * 8)]; }); return 'hash link'; }],
    ];
    const total = acts.reduce((a, x) => a + x[0], 0);
    const health = async (i) => {
      // not stuck: a ride under way ends (or is redirected and ends) within a bounded time
      if (await p.evaluate(() => window.__kmetro.state().riding)) { try { await p.waitForFunction(() => !window.__kmetro.state().riding, null, { timeout: 45000 }); } catch (e) { fails.push(`stuck riding after action ${i}: ${JSON.stringify(await p.evaluate(() => { const k = window.__kmetro; const tr = k.sim.trip; return { st: k.state(), trip: tr ? tr.k + ':' + tr.phase : 'none' }; }))}`); await p.evaluate(() => window.__kmetro.reset()); } }
      const h = await p.evaluate(() => { const vis = (el) => { const q = el.getBoundingClientRect(); return q.width > 4 && q.height > 4 && !el.disabled && q.bottom > 0 && q.top < innerHeight; }; return { way: [...document.querySelectorAll('.rail button, .focus button, .sheet-in button, .opening button, .read-bar button, .pass-dlg button')].filter(vis).length, sw: document.documentElement.scrollWidth, iw: innerWidth, st: window.__kmetro.state() }; });
      if (h.way < 1) fails.push(`no way on after action ${i}: ${JSON.stringify(h.st)}`);
      if (h.sw > h.iw + 1) fails.push(`sideways scroll after action ${i}: ${h.sw} > ${h.iw}`);
    };
    for (let i = 1; i <= N; i++) {
      let r = rnd() * total; let fn = acts[0][1]; for (const [w, f] of acts) { if ((r -= w) < 0) { fn = f; break; } }
      let what; try { what = await fn(); } catch (e) { what = 'action error: ' + String(e.message).split('\n')[0].slice(0, 80); }
      log.push(`${i} ${what}`); await p.waitForTimeout(120 + rnd() * 260);
      if (i % 15 === 0) await health(i);
    }
    if (phone) await p.setViewportSize({ width: 390, height: 844 }); await health(N);
    const ok = !fails.length && !errs.length;
    console.log(`\n== monkey ${mode.toUpperCase()} at ${size}, seed ${SEED}: ${N} actions, ${fails.length} failures, ${errs.length} console errors`);
    fails.slice(0, 6).forEach((f) => console.log('  FAIL ' + f)); errs.slice(0, 6).forEach((e) => console.log('  console: ' + e));
    if (!ok) { const at = +(String(fails[0] || errs[0]).match(/action (\d+)/) || [0, N])[1]; console.log('  around it: ' + log.slice(Math.max(0, at - 9), at + 1).join(' | ')); }
    summary.push({ mode, size, actions: N, failures: fails.length, errors: errs.length });
    await p.close();
  }
  console.log('\nSUMMARY ' + JSON.stringify(summary)); await b.close();
  process.exit(summary.every((s) => !s.failures && !s.errors) ? 0 : 1);
})();
