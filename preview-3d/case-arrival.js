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

  let opened = false;
  let optOut;
  if (intent) {
    root.dataset.mobArrival = 'holding';
    optOut = document.createElement('style');
    optOut.textContent = '@view-transition { navigation: none; }';
    document.head.append(optOut);
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

  function show() {
    if (intent) {
      document.head.append(optOut);
      root.dataset.mobArrival = 'shown';
    }
    upgradeHero();
  }

  function reveal() {
    if (opened || !document.body) return;
    if (intent && !document.querySelector('main h1')) return;
    if (root.hasAttribute('data-entry-intro') && (!document.querySelector('[data-case-entry-intro]') || !document.querySelector('img[data-entry-srcset]'))) return;
    opened = true;
    observer.disconnect();
    requestAnimationFrame(() => requestAnimationFrame(show));
  }

  addEventListener('pageswap', event => {
    const outgoing = event.viewTransition;
    if (!outgoing) return;
    outgoing.ready.catch(() => {});
    outgoing.finished.catch(() => {});
    outgoing.updateCallbackDone.catch(() => {});
    if (intent) outgoing.skipTransition();
  });

  const observer = new MutationObserver(reveal);
  observer.observe(root, { childList: true, subtree: true });
  addEventListener('DOMContentLoaded', reveal, { once: true });
  setTimeout(() => {
    if (opened) return;
    observer.disconnect();
    opened = true;
    show();
  }, 2600);
  addEventListener('pageshow', event => {
    if (event.persisted && intent) root.dataset.mobArrival = 'shown';
  });
  reduced.addEventListener('change', () => {
    if (reduced.matches && intent) root.dataset.mobArrival = 'shown';
  });
})();
