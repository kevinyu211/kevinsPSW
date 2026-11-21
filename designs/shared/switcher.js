/* Kevin Yu · design switcher
   One small "Designs" button that jumps between the site's designs. Shared by every design.
   Use:  <div data-design-switch></div>
         <script src="…/designs/shared/switcher.js" data-root="../../" data-current="transit" data-shape="pill" defer></script>
   data-root     path from the page to the repo root
   data-current  city | transit | monograph | editorial | swiss
   data-shape    pill (default) | square
   With no [data-design-switch] element on the page, the button sits fixed in the bottom-right corner. */
(function () {
  var me = document.currentScript;
  var root = (me && me.getAttribute('data-root')) || './';
  var current = (me && me.getAttribute('data-current')) || '';
  if (current === 'auto') current = document.documentElement.getAttribute('data-design') || '';
  var square = me && me.getAttribute('data-shape') === 'square';
  var DESIGNS = [
    { id: 'city', name: 'Island city', note: 'A small 3D island. One metro line, a stop for every project.', href: root + 'designs/city/' },
    { id: 'transit', name: 'Metro city', note: 'A 3D city. Every station is a project.', href: root + 'designs/transit/' },
    { id: 'monograph', name: 'Monograph', note: 'Black, white and blue. Line drawings.', href: root + 'designs/monograph/' },
    { id: 'editorial', name: 'Editorial', note: 'Magazine serif, ink lines.', href: root + '?design=editorial' },
    { id: 'swiss', name: 'Swiss', note: 'Strict grid, one red accent.', href: root + '?design=swiss' },
  ];

  var css = '' +
    '.ky-sw{position:relative;display:inline-flex;font:inherit}' +
    '.ky-sw.is-fixed{position:fixed;right:16px;bottom:16px;z-index:200}' +
    '.ky-sw-b{display:inline-flex;align-items:center;gap:6px;min-height:40px;padding:0 14px;border:1px solid currentColor;border-radius:' + (square ? '0' : '999px') + ';background:transparent;color:inherit;font:inherit;font-weight:600;font-size:.875rem;line-height:1;cursor:pointer}' +
    '.ky-sw.is-fixed .ky-sw-b{background:#fff;color:#111}' +
    '.ky-sw-b svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;transition:transform .2s}' +
    '.ky-sw-b[aria-expanded="true"] svg{transform:rotate(180deg)}' +
    '.ky-sw-b:focus-visible,.ky-sw-m a:focus-visible{outline:2px solid #1f4fd8;outline-offset:2px}' +
    '.ky-sw-m{position:absolute;right:0;top:calc(100% + 8px);z-index:200;width:min(280px,calc(100vw - 24px));margin:0;padding:6px;list-style:none;background:#fff;color:#111;border:1px solid rgba(17,17,17,.16);border-radius:' + (square ? '0' : '14px') + ';box-shadow:0 18px 40px -18px rgba(0,0,0,.45);text-align:left}' +
    '.ky-sw.is-fixed .ky-sw-m{top:auto;bottom:calc(100% + 8px)}' +
    '.ky-sw-m[hidden]{display:none}' +
    '.ky-sw-m a{display:grid;gap:3px;padding:10px 12px;border-radius:' + (square ? '0' : '9px') + ';color:#111;text-decoration:none}' +
    '.ky-sw-m a:hover{background:#f1f1ee}' +
    '.ky-sw-m b{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:.9375rem;font-weight:700;line-height:1.2}' +
    '.ky-sw-m span{font-size:.8125rem;line-height:1.35;color:#55554f;font-weight:400}' +
    '.ky-sw-m i{font-style:normal;font-size:.6875rem;font-weight:700;color:#1f4fd8}' +
    '.ky-sw-m a[aria-current="page"]{background:#f1f1ee}' +
    '@media (max-width:760px){.ky-sw:not(.is-fixed) .ky-sw-b{padding:0 10px;font-size:.8125rem}body:has(.design-dock) .ky-sw.is-fixed{bottom:76px}}' +
    '@media (prefers-reduced-motion:reduce){.ky-sw-b svg{transition:none}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  function build() {
    var host = document.querySelector('[data-design-switch]');
    var wrap = document.createElement('div'); wrap.className = 'ky-sw' + (host ? '' : ' is-fixed');
    var b = document.createElement('button'); b.type = 'button'; b.className = 'ky-sw-b';
    b.setAttribute('aria-haspopup', 'true'); b.setAttribute('aria-expanded', 'false'); b.setAttribute('aria-controls', 'ky-sw-menu');
    b.innerHTML = 'Designs<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
    var m = document.createElement('ul'); m.className = 'ky-sw-m'; m.id = 'ky-sw-menu'; m.hidden = true; m.setAttribute('aria-label', 'Switch to another design');
    DESIGNS.forEach(function (d) {
      var li = document.createElement('li'); var a = document.createElement('a'); a.href = d.href;
      var t = document.createElement('b'); t.textContent = d.name;
      if (d.id === current) { a.setAttribute('aria-current', 'page'); var tag = document.createElement('i'); tag.textContent = 'Viewing'; t.appendChild(tag); }
      var n = document.createElement('span'); n.textContent = d.note;
      a.appendChild(t); a.appendChild(n); li.appendChild(a); m.appendChild(li);
    });
    var open = function (on) { m.hidden = !on; b.setAttribute('aria-expanded', String(on)); if (on) { var f = m.querySelector('a'); if (f) f.focus({ preventScroll: true }); } };
    b.addEventListener('click', function (e) { e.stopPropagation(); open(m.hidden); });
    document.addEventListener('click', function (e) { if (!m.hidden && !wrap.contains(e.target)) open(false); });
    wrap.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !m.hidden) { e.stopPropagation(); open(false); b.focus({ preventScroll: true }); } });
    wrap.appendChild(b); wrap.appendChild(m);
    if (host) host.appendChild(wrap); else document.body.appendChild(wrap);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
