(() => {
  'use strict';

  const APP_CONFIG = {
    finder:   { title: 'Finder',   template: 'tpl-finder',   width: 720, height: 460, x: 80,  y: 60  },
    safari:   { title: 'Safari',   template: 'tpl-safari',   width: 680, height: 480, x: 120, y: 80  },
    about:    { title: 'Sobre este Mac', template: 'tpl-about', width: 380, height: 420, x: 0, y: 0, center: true },
    settings: { title: 'Ajustes do Sistema', template: 'tpl-settings', width: 680, height: 460, x: 160, y: 100 },
    messages: { title: 'Mensagens', icon: '💬' },
    mail:     { title: 'Mail',      icon: '✉️' },
    photos:   { title: 'Fotos',     icon: '🖼️' },
    music:    { title: 'Música',    icon: '🎵' },
    trash:    { title: 'Lixeira',   icon: '🗑️' },
  };

  const windowsEl = document.getElementById('windows');
  const dockEl = document.getElementById('dock');
  const menuClock = document.getElementById('menuClock');
  const spotlight = document.getElementById('spotlight');
  const spotlightInput = document.getElementById('spotlightInput');

  const openWindows = new Map();
  let zCounter = 10;
  let dragState = null;

  /* ── Clock ── */
  function updateClock() {
    const now = new Date();
    const opts = { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };
    menuClock.textContent = now.toLocaleDateString('pt-BR', opts);
  }
  updateClock();
  setInterval(updateClock, 30_000);

  /* ── Window Management ── */
  function focusWindow(app) {
    openWindows.forEach((win, key) => {
      win.classList.toggle('focused', key === app);
      if (key === app) win.style.zIndex = ++zCounter;
    });
    dockEl.querySelectorAll('.dock-item').forEach(item => {
      item.classList.toggle('active', item.dataset.app === app && openWindows.has(app) && !openWindows.get(app).classList.contains('minimized'));
    });
    document.querySelector('.menu-app-name').textContent = APP_CONFIG[app]?.title || 'Finder';
  }

  function openApp(app) {
    if (openWindows.has(app)) {
      const win = openWindows.get(app);
      if (win.classList.contains('minimized')) win.classList.remove('minimized');
      focusWindow(app);
      return;
    }

    const config = APP_CONFIG[app];
    if (!config) return;

    let win;
    if (config.template) {
      const tpl = document.getElementById(config.template);
      win = tpl.content.firstElementChild.cloneNode(true);
    } else {
      const tpl = document.getElementById('tpl-generic');
      win = tpl.content.firstElementChild.cloneNode(true);
      win.dataset.app = app;
      win.querySelector('.window-title').textContent = config.title;
      win.querySelector('.generic-icon').textContent = config.icon;
      win.querySelector('h3').textContent = config.title;
    }

    const area = windowsEl.getBoundingClientRect();
    let x = config.x ?? 100;
    let y = config.y ?? 80;

    if (config.center) {
      x = (area.width - config.width) / 2;
      y = (area.height - config.height) / 2;
    }

    win.style.width = config.width + 'px';
    win.style.height = config.height + 'px';
    win.style.left = x + 'px';
    win.style.top = y + 'px';
    win.classList.add('focused');
    win.style.zIndex = ++zCounter;

    bindWindowEvents(win, app);
    windowsEl.appendChild(win);
    openWindows.set(app, win);
    focusWindow(app);
  }

  function closeApp(app) {
    const win = openWindows.get(app);
    if (!win) return;
    win.remove();
    openWindows.delete(app);
    dockEl.querySelector(`[data-app="${app}"]`)?.classList.remove('active');

    const remaining = [...openWindows.keys()];
    if (remaining.length) focusWindow(remaining[remaining.length - 1]);
  }

  function bindWindowEvents(win, app) {
    const titlebar = win.querySelector('.window-titlebar');
    const [closeBtn, minBtn, maxBtn] = win.querySelectorAll('.tl');

    closeBtn.addEventListener('click', () => closeApp(app));
    minBtn.addEventListener('click', () => {
      win.classList.add('minimized');
      dockEl.querySelector(`[data-app="${app}"]`)?.classList.remove('active');
    });
    maxBtn.addEventListener('click', () => win.classList.toggle('maximized'));

    titlebar.addEventListener('mousedown', (e) => {
      if (e.target.closest('.tl')) return;
      focusWindow(app);
      const rect = win.getBoundingClientRect();
      const area = windowsEl.getBoundingClientRect();
      dragState = {
        win, app,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
        areaTop: area.top,
        areaLeft: area.left,
      };
      e.preventDefault();
    });

    win.addEventListener('mousedown', () => focusWindow(app));
  }

  document.addEventListener('mousemove', (e) => {
    if (!dragState) return;
    const { win, offsetX, offsetY, areaTop, areaLeft } = dragState;
    if (win.classList.contains('maximized')) return;
    win.style.left = (e.clientX - areaLeft - offsetX) + 'px';
    win.style.top = (e.clientY - areaTop - offsetY) + 'px';
  });

  document.addEventListener('mouseup', () => { dragState = null; });

  /* ── Dock & Desktop Icons ── */
  dockEl.addEventListener('click', (e) => {
    const item = e.target.closest('.dock-item');
    if (!item) return;
    openApp(item.dataset.app);
  });

  document.querySelectorAll('.desktop-icon').forEach(icon => {
    icon.addEventListener('dblclick', () => openApp(icon.dataset.app));
  });

  /* ── Spotlight ── */
  function toggleSpotlight(show) {
    spotlight.classList.toggle('hidden', !show);
    if (show) {
      spotlightInput.value = '';
      spotlightInput.focus();
    }
  }

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      toggleSpotlight(spotlight.classList.contains('hidden'));
    }
    if (e.key === 'Escape') toggleSpotlight(false);
  });

  spotlight.addEventListener('click', (e) => {
    if (e.target === spotlight) toggleSpotlight(false);
  });

  spotlightInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const q = spotlightInput.value.toLowerCase();
      toggleSpotlight(false);
      if (q.includes('finder') || q.includes('arquivo')) openApp('finder');
      else if (q.includes('safari') || q.includes('web')) openApp('safari');
      else if (q.includes('ajust') || q.includes('config')) openApp('settings');
      else if (q.includes('sobre') || q.includes('mac')) openApp('about');
      else openApp('finder');
    }
  });

  /* ── Dock magnification on hover ── */
  dockEl.addEventListener('mousemove', (e) => {
    const items = [...dockEl.querySelectorAll('.dock-item')];
    items.forEach(item => {
      const rect = item.getBoundingClientRect();
      const center = rect.left + rect.width / 2;
      const dist = Math.abs(e.clientX - center);
      const scale = Math.max(1, 1.4 - dist / 120);
      item.style.transform = `scale(${scale}) translateY(${-(scale - 1) * 20}px)`;
    });
  });

  dockEl.addEventListener('mouseleave', () => {
    dockEl.querySelectorAll('.dock-item').forEach(item => {
      item.style.transform = '';
    });
  });

  /* ── Boot: open Finder ── */
  setTimeout(() => openApp('finder'), 400);
})();
