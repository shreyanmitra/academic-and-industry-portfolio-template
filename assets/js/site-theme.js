(() => {
  const root = document.documentElement;
  const initial = root.dataset.theme || 'dark';
  const read = () => { try { return localStorage.getItem('theme'); } catch { return null; } };
  const apply = theme => {
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      button.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`);
      button.setAttribute('aria-pressed', String(theme === 'light'));
    });
    document.dispatchEvent(new CustomEvent('portfolio:themechange', {detail: {theme}}));
  };
  apply(['dark','light'].includes(read()) ? read() : initial);
  document.addEventListener('DOMContentLoaded', () => {
    apply(root.dataset.theme);
    document.querySelectorAll('[data-theme-toggle]').forEach(button => button.addEventListener('click', () => {
      const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('theme', next); } catch { /* Theme switching works without storage. */ }
      apply(next);
    }));
    // The inherited classic control is an anchor; retain keyboard activation.
    document.querySelector('#theme-toggle')?.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.currentTarget.click(); }
    });
  });
})();
