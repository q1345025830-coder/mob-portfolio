(() => {
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const key = location.pathname + location.search + location.hash;
  let intent;
  try {
    const record = JSON.parse(sessionStorage.getItem('mobCaseArrival'));
    if (record?.destination === key) {
      sessionStorage.removeItem('mobCaseArrival');
      if (!reduced.matches && performance.getEntriesByType('navigation')[0]?.type === 'navigate'
        && Date.now() - record.sentAt < 45000) intent = record;
    }
  } catch { /* The canonical page also works without stored handoff state. */ }

  let optIn, transition, firstReveal = false, ready = false, opened = false;
  if (intent) {
    root.dataset.mobArrival = 'holding';
    if ('PageRevealEvent' in window) {
      optIn = document.createElement('style');
      optIn.textContent = '@view-transition { navigation: auto; types: mob-entry; }';
      document.head.append(optIn);
    }
    if (intent.color && CSS.supports('color', intent.color)) root.style.setProperty('--mob-handoff', intent.color);
  }

  function upgradeHero() {
    const hero = document.querySelector('img[data-entry-srcset]');
    if (!hero) return;
    const width = hero.clientWidth || innerWidth;
    if (width * devicePixelRatio <= 896) return;
    const upgrade = () => {
      const next = new Image();
      next.fetchPriority = 'low';
      next.sizes = hero.dataset.entrySizes;
      next.srcset = hero.dataset.entrySrcset;
      next.src = hero.dataset.entrySrc;
      next.decode().then(() => {
        hero.sizes = next.sizes;
        hero.srcset = next.srcset;
        hero.src = hero.dataset.entrySrc;
      }, () => {});
    };
    // Keep the light rendition on screen while the responsive image is decoded.
    if (hero.complete && hero.naturalWidth) upgrade();
    else {
      hero.addEventListener('load', upgrade, { once: true });
      hero.addEventListener('error', upgrade, { once: true });
    }
  }

  function finish() {
    if (!ready || opened) return;
    opened = true;
    if (intent) {
      root.dataset.mobArrival = 'shown';
      if (optIn) {
        optIn.textContent = '@view-transition { navigation: none; }';
        document.head.append(optIn);
      }
    }
    upgradeHero();
  }

  function reveal() {
    if (ready) return;
    if (intent && (!document.querySelector('main h1') ||
      (root.hasAttribute('data-entry-intro') && !document.querySelector('[data-case-entry-intro]')))) return;
    if (!document.body || (root.hasAttribute('data-entry-intro') && !document.querySelector('img[data-entry-srcset]'))) return;
    ready = true;
    observer.disconnect();
    if (optIn && !firstReveal) return;
    if (transition) transition.finished.then(finish, finish);
    else requestAnimationFrame(() => requestAnimationFrame(finish));
  }

  addEventListener('pagereveal', event => {
    firstReveal = true;
    transition = intent ? event.viewTransition : null;
    if (transition) {
      transition.types?.add('mob-entry');
      transition.ready.catch(() => {});
      transition.finished.then(finish, finish);
    } else requestAnimationFrame(() => requestAnimationFrame(finish));
  }, { once: true });

  const observer = new MutationObserver(reveal);
  observer.observe(root, { childList: true, subtree: true });
  addEventListener('DOMContentLoaded', reveal, { once: true });
  setTimeout(() => {
    if (opened) return;
    observer.disconnect();
    ready = true;
    finish();
  }, 2600);
  addEventListener('pageshow', event => {
    if (event.persisted && intent) root.dataset.mobArrival = 'shown';
  });
  reduced.addEventListener('change', () => {
    if (reduced.matches && intent) root.dataset.mobArrival = 'shown';
  });
})();
