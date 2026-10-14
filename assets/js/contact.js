/* Kevin Yu · contact
   Copy button for the phone number. Uses the async clipboard; if that is blocked,
   it selects the number so a keyboard copy finishes the job. */
(() => {
  'use strict';

  const btn = document.querySelector('.contact-copy');
  if (!btn) return;

  const label = btn.querySelector('.contact-copy-label');
  const number = document.getElementById(btn.dataset.copyTarget || '');
  const status = document.querySelector('[data-copy-status]');
  const text = btn.dataset.copy || (number ? number.textContent.trim() : '');
  const idle = label ? label.textContent : 'Copy';
  const apple = /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent || '');
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  let timer = 0;

  const show = (state, shown, spoken, ms) => {
    clearTimeout(timer);
    btn.dataset.state = state;
    if (label) label.textContent = shown;
    if (status) status.textContent = spoken;
    timer = setTimeout(() => {
      delete btn.dataset.state;
      if (label) label.textContent = idle;
      if (status) status.textContent = '';
    }, ms);
  };

  // Fallback: select the number text so Cmd/Ctrl+C (or the system menu) can copy it.
  const selectNumber = () => {
    if (!number || !window.getSelection || !document.createRange) return;
    const range = document.createRange();
    range.selectNodeContents(number);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    const keys = apple ? '⌘C' : 'Ctrl+C';
    show('selected', coarse ? 'Selected' : `Press ${keys}`,
      `Number selected. Press ${apple ? 'Command' : 'Control'} C to copy it.`, 4000);
  };

  btn.addEventListener('click', () => {
    if (!text) return;
    // Called straight from the click so the browser counts it as a user gesture.
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => show('copied', 'Copied', 'Phone number copied.', 2000))
        .catch(selectNumber);
    } else {
      selectNumber();
    }
  });
})();
