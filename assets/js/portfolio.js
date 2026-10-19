(() => {
  'use strict';
  const root = document.documentElement;
  const nav = document.querySelector('[data-nav]');
  const toggle = document.querySelector('.menu-toggle');
  const menu = document.getElementById('primary-nav');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const setMenu = (open, restoreFocus = false) => {
    if (!toggle || !menu || !nav) return;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.classList.toggle('open', open);
    nav.classList.toggle('menu-open', open);
    if (restoreFocus) toggle.focus();
  };
  toggle?.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  menu?.addEventListener('click', (event) => { if (event.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && toggle?.getAttribute('aria-expanded') === 'true') setMenu(false, true); });
  document.addEventListener('click', (event) => { if (nav && !nav.contains(event.target)) setMenu(false); });
  const mobile = matchMedia('(max-width: 900px)');
  mobile.addEventListener('change', () => setMenu(false));
  // Keep the menu usable if JavaScript never loads.
  root.classList.replace('no-js', 'js');

  const hero = document.querySelector('.hero');
  let progress = null;
  if (nav && !reduced.matches) {
    progress = document.createElement('div');
    progress.className = 'scroll-progress';
    progress.setAttribute('aria-hidden', 'true');
    nav.appendChild(progress);
  }
  let ticking = false;
  const onScroll = () => {
    nav?.classList.toggle('scrolled', window.scrollY > 60 || !hero);
    if (progress) {
      const travel = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.transform = `scaleX(${travel > 0 ? Math.min(window.scrollY / travel, 1) : 0})`;
    }
    ticking = false;
  };
  onScroll();
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(onScroll);
  }, { passive: true });

  if ('IntersectionObserver' in window && !reduced.matches) {
    const active = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        menu?.querySelectorAll('[data-section]').forEach((link) => {
          const current = link.dataset.section === entry.target.id;
          link.classList.toggle('active', current);
          if (current) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-20% 0px -60% 0px' });
    document.querySelectorAll('.home-section').forEach((section) => active.observe(section));

    // Entrance reveals. Each element is released once and then left alone.
    const targets = document.querySelectorAll('.reveal, .splat');
    if (targets.length) {
      const reveal = new IntersectionObserver((entries, self) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('revealed');
          self.unobserve(entry.target);
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
      targets.forEach((target) => reveal.observe(target));
      root.classList.add('reveals-armed');
    }
  }

  // Cursor-follow highlight on frosted panels; pointer devices only.
  if (matchMedia('(hover: hover) and (pointer: fine)').matches && !reduced.matches) {
    let frame = 0;
    document.addEventListener('pointermove', (event) => {
      const panel = event.target.closest('.work-card, .research-cell, .contact-card');
      if (!panel || frame) return;
      frame = requestAnimationFrame(() => {
        const box = panel.getBoundingClientRect();
        panel.style.setProperty('--mx', `${((event.clientX - box.left) / box.width) * 100}%`);
        panel.style.setProperty('--my', `${((event.clientY - box.top) / box.height) * 100}%`);
        frame = 0;
      });
    }, { passive: true });
  }

  document.querySelectorAll('[data-filter-group]').forEach((group) => {
    const target = document.getElementById(group.dataset.filterGroup);
    if (!target) return;
    const cards = [...target.querySelectorAll('[data-category]')];
    const status = document.getElementById(group.dataset.status);
    group.hidden = false;
    group.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-filter]');
      if (!button) return;
      group.querySelectorAll('button').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
      let visible = 0;
      cards.forEach((card) => {
        card.hidden = button.dataset.filter !== 'All' && card.dataset.category !== button.dataset.filter;
        if (!card.hidden) { visible++; card.classList.add('revealed'); }
      });
      target.classList.toggle('single-result', visible === 1);
      const label = target.id === 'skill-cloud' ? 'skill' : (group.dataset.itemLabel || 'project');
      const plural = `${label}s`;
      if (status) status.textContent = `${visible} ${visible === 1 ? label : plural} shown`;
    });
    if (target.id === 'skill-cloud') {
      target.addEventListener('click', (event) => {
        const chip = event.target.closest('[data-category]');
        if (!chip) return;
        const active = group.querySelector('button[aria-pressed="true"]');
        const next = active?.dataset.filter === chip.dataset.category ? 'All' : chip.dataset.category;
        [...group.querySelectorAll('button[data-filter]')].find((item) => item.dataset.filter === next)?.click();
      });
    }
  });
  // Circle portrait: VP9 WebM with alpha in Chromium/Firefox, animated WebP in
  // Safari, still PNG for reduced motion, print, and no-JS.
  const live = document.querySelector('.portrait-live');
  const anim = document.querySelector('.portrait-anim');
  const hideLive = () => {
    if (!live) return;
    live.pause();
    live.classList.add('is-hidden');
  };
  const showAnim = () => {
    if (!anim || !anim.dataset.src) return;
    anim.src = anim.dataset.src;
    anim.classList.remove('is-hidden');
  };
  const safari = /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);
  if (reduced.matches) {
    hideLive();
  } else if (live && !safari && live.canPlayType('video/webm; codecs="vp9"')) {
    live.play().catch(() => {
      hideLive();
      showAnim();
    });
    live.addEventListener('error', () => {
      hideLive();
      showAnim();
    });
    if ('IntersectionObserver' in window) {
      const watch = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) live.play().catch(hideLive);
          else live.pause();
        });
      }, { threshold: 0.2 });
      watch.observe(live);
    }
  } else {
    hideLive();
    showAnim();
  }
})();
