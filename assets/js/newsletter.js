/* Newsletter: English / 中文 switch, archive filters and search, and (on the newsletter's own
   pages) the theme switch, header state and reading progress. The home page only uses the
   language switch; main.js runs everything else there. */
(() => {
  'use strict';

  const doc = document.documentElement;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } },
  };
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const standalone = document.body.classList.contains('nl-page');
  let onLang = null;

  /* ---------- Language ---------- */
  const setLang = (lang, save) => {
    doc.dataset.nlLang = lang;
    $$('[data-lang-btn]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.langBtn === lang)));
    if (save) store.set('ky-nl-lang', lang);
    if (onLang) onLang(lang);
  };
  $$('[data-lang-btn]').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.langBtn, true)));
  setLang(doc.dataset.nlLang === 'zh' ? 'zh' : 'en', false);

  /* ---------- Archive: topic chips and search ---------- */
  const archive = $('[data-nl-archive]');
  if (archive) {
    const rows = $$('.nl-row', archive);
    const months = $$('.nl-month', archive);
    const chips = $$('[data-topic-btn]');
    const input = $('.nl-search input');
    const empty = $('.nl-empty', archive);
    const count = $('[data-nl-count]');
    let topic = 'all';

    const apply = () => {
      const q = (input && input.value || '').trim().toLowerCase();
      let shown = 0;
      rows.forEach((r) => {
        const ok = (topic === 'all' || r.dataset.topic === topic) && (!q || r.dataset.search.includes(q));
        r.hidden = !ok;
        if (ok) shown += 1;
      });
      months.forEach((m) => { m.hidden = !$$('.nl-row', m).some((r) => !r.hidden); });
      if (empty) empty.hidden = shown > 0;
      if (count) count.textContent = String(shown);
    };
    chips.forEach((c) => c.addEventListener('click', () => {
      topic = c.dataset.topicBtn;
      chips.forEach((x) => x.setAttribute('aria-pressed', String(x === c)));
      apply();
    }));
    if (input) {
      input.addEventListener('input', apply);
      input.addEventListener('keydown', (e) => { if (e.key === 'Escape') { input.value = ''; apply(); } });
    }
    onLang = (lang) => { if (input) input.placeholder = input.dataset[lang === 'zh' ? 'phZh' : 'phEn']; };
    onLang(doc.dataset.nlLang);
    apply();
  }

  if (!standalone) return;

  /* ---------- Theme switch with a circular reveal ---------- */
  const themeBtn = $('.theme-toggle');
  const isDark = () => (doc.dataset.theme
    ? doc.dataset.theme === 'dark'
    : window.matchMedia('(prefers-color-scheme: dark)').matches);
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const next = isDark() ? 'light' : 'dark';
      const apply = () => { doc.dataset.theme = next; store.set('ky-theme', next); };
      if (!document.startViewTransition || reduce) { apply(); return; }
      const r = themeBtn.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      const end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      document.startViewTransition(apply).ready.then(() => {
        doc.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`] },
          { duration: 750, easing: 'cubic-bezier(.16,1,.3,1)', pseudoElement: '::view-transition-new(root)' },
        );
      });
    });
  }

  /* ---------- Header state and reading progress ---------- */
  const header = $('.site-header');
  const bar = $('.progress span');
  const article = $('.nl-article');
  let ticking = false;
  const onScroll = () => {
    ticking = false;
    const y = window.scrollY;
    if (header) header.classList.toggle('is-scrolled', y > 8);
    if (bar && article) {
      const r = article.getBoundingClientRect();
      const total = r.height - window.innerHeight * 0.6;
      const p = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 1;
      bar.style.transform = `scaleX(${p})`;
    }
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();
})();
