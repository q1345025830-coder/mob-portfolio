(() => {
  const el = id => document.getElementById(id);
  const frame = el('work');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const reasonLabels = {
    'webgl-unavailable': '浏览器未创建 WebGL',
    'webgl-context-error': '创建 WebGL 时出错',
    'webgl-shader': '绘制程序初始化失败',
    'webgl-start-error': '网格初始化中断',
    'webgl-render-error': '网格绘制中断',
    'webgl-context-lost': '浏览器丢失 WebGL 上下文',
    'texture-upload': '封面纹理上传失败',
  };
  let started, recent, marks, state, resource, seen;
  function record(name, more = {}) {
    if (seen.has(name)) return;
    seen.add(name);
    marks.push({ step: name, ms: Math.round(performance.now() - started), ...more });
  }
  function reset() {
    started = performance.now();
    recent = null;
    seen = new Set();
    marks = [];
    state = { build: '检测中', renderer: '等待网格', follow: '待操作', drag: '待操作', hover: '待操作', entry: '待操作' };
    resource = { release: null, references: {} };
    el('status').textContent = '';
  }
  const sameOriginPath = value => {
    const url = new URL(value, location.href);
    return url.origin === location.origin ? url.pathname + url.search : null;
  };
  async function loadVersion() {
    try {
      const response = await fetch('../release.json', { cache: 'no-store' });
      resource.release = response.ok ? (await response.json()).version : null;
    } catch {
      resource.release = null;
    }
  }
  function reportText() {
    return JSON.stringify({
      device: { browser: navigator.userAgent, viewport: [innerWidth, innerHeight], dpr: devicePixelRatio, reducedMotion: motion.matches },
      state, resources: resource, observations: marks,
    }, null, 2);
  }
  async function checkAsset(href) {
    try {
      const response = await fetch(href, { method: 'HEAD', cache: 'no-cache' });
      resource.references[href].http = response.status;
    } catch {
      if (resource.references[href]) resource.references[href].http = '网络请求失败';
    }
  }
  function sample() {
    el('motion').textContent = motion.matches ? '已开启 · 跟随、惯性和进场停用' : '关闭 · 允许动效';
    const doc = frame.contentDocument;
    if (!doc?.body || doc.URL === 'about:blank') return;
    const win = frame.contentWindow;
    const stage = doc.querySelector('.stage');
    if (stage) {
      const app = doc.querySelector('script[type="module"][src*="app.js"]');
      const surface = doc.querySelector('link[rel="modulepreload"][href*="surface.js"]');
      for (const url of [app?.src, surface?.href].filter(Boolean)) {
        const href = sameOriginPath(url);
        if (!href) continue;
        if (!resource.references[href]) {
          resource.references[href] = { http: '检测中', requestObserved: false };
          checkAsset(href);
        }
        const timing = win.performance.getEntriesByName(url).at(-1);
        if (timing) resource.references[href].requestObserved = true;
      }
      resource.gridViewport = [win.innerWidth, win.innerHeight];
      const engine = stage.dataset.renderer;
      const reason = stage.dataset.renderReason;
      if (engine === 'webgl') {
        state.renderer = 'WebGL 已启动';
        record('WebGL 已启动', { canvas: Boolean(stage.querySelector('canvas.scene')) });
      } else if (engine === 'flat') {
        state.renderer = '平面网格 · ' + (reasonLabels[reason] || reason || '原因未记录');
        record('平面回退', { reason });
        if (!seen.has('出现鼠标跟随')) state.follow = '平面模式不使用空间跟随';
      } else {
        state.renderer = engine === 'starting' ? '脚本已运行 · 等待图形初始化' : '未见应用启动';
      }
      const version = app?.src ? new URL(app.src).searchParams.get('entry') : null;
      state.build = [resource.release || '发布版本未知', version ? '脚本 ' + version : '无版本标记', engine ? '应用已执行' : '应用未报告执行'].join(' · ');
      const grid = stage.mobMotionSample?.();
      if (grid?.hovering || (engine === 'flat' && stage.querySelector('a.project:hover'))) {
        state.hover = '已出现单格悬停';
        record('出现悬停');
      }
      if (grid && Math.hypot(grid.driftX, grid.driftY) > .35) {
        state.follow = '已出现空间跟随';
        record('出现鼠标跟随');
      }
      if (grid?.dragging) {
        state.drag = '已拖动 · 等待松手';
        record('开始拖动');
      }
      if (seen.has('开始拖动') && recent?.dragging && !grid?.dragging && !seen.has('出现松手惯性')) {
        state.drag = '已松手 · 暂未测到惯性';
        record('已松手');
      }
      if (grid?.gliding && !grid.dragging) {
        state.drag = '已测到松手惯性';
        record('出现松手惯性');
      }
      recent = grid;
      const curtain = doc.querySelector('.mob-entry-curtain');
      if (curtain?.classList.contains('is-rising')) {
        state.entry = '已测到色层上推';
        record('色层上推');
      }
      if (seen.has('详情文档') && stage.classList.contains('is-ready') && !seen.has('已返回网格')) {
        record('已返回网格', { project: doc.activeElement?.dataset.project || null });
      }
    } else if (doc.querySelector('main h1')) {
      record('详情文档', { path: sameOriginPath(doc.URL) });
      state.entry = seen.has('色层上推') ? '已测到上推与详情打开' : motion.matches ? '按系统设置直达' : '详情已打开 · 未测到色层';
      if (doc.documentElement.dataset.mobArrival === 'shown') record('详情标题入场');
      const hero = doc.querySelector('.hero-figure img, .opening-view img, .case-screen img');
      if (hero?.complete && hero.naturalWidth) record('详情首图已加载');
    }
    for (const key of Object.keys(state)) el(key).textContent = state[key];
    if (el('log') !== document.activeElement) el('log').value = reportText();
  }
  el('reset').addEventListener('click', () => {
    reset();
    loadVersion();
    frame.src = 'index.html?diagnose=1';
  });
  el('copy').addEventListener('click', async () => {
    const log = el('log');
    log.value = reportText();
    try {
      await navigator.clipboard.writeText(log.value);
      el('status').textContent = '诊断结果已复制';
    } catch {
      log.parentElement.open = true;
      log.focus();
      log.select();
      el('status').textContent = '已选中诊断结果，请手动复制';
    }
  });
  reset();
  loadVersion();
  setInterval(sample, 65);
})();
