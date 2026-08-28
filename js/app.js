(() => {
  'use strict';

  const APP_CONFIG = {
    finder:   { title: 'Finder',   template: 'tpl-finder',   width: 720, height: 460, x: 80,  y: 60  },
    safari:   { title: 'Safari',   template: 'tpl-safari',   width: 680, height: 480, x: 120, y: 80  },
    about:    { title: 'Sobre este Mac', template: 'tpl-about', width: 380, height: 420, center: true },
    settings: { title: 'Ajustes do Sistema', template: 'tpl-settings', width: 680, height: 460, x: 160, y: 100 },
    processlab: { title: 'Process Lab', template: 'tpl-processlab', width: 640, height: 480, x: 100, y: 70 },
    messages: { title: 'Mensagens', icon: '💬', width: 420, height: 340, x: 200, y: 120 },
    mail:     { title: 'Mail',      icon: '✉️', width: 520, height: 400, x: 140, y: 90 },
    photos:   { title: 'Fotos',     icon: '🖼️', width: 600, height: 440, x: 100, y: 70 },
    music:    { title: 'Música',    icon: '🎵', width: 480, height: 420, x: 180, y: 100 },
    trash:    { title: 'Lixeira',   icon: '🗑️', width: 360, height: 300, x: 220, y: 140 },
  };

  const bootScreen = document.getElementById('bootScreen');
  const bootProgressBar = document.getElementById('bootProgressBar');
  const desktop = document.getElementById('desktop');
  const windowsEl = document.getElementById('windows');
  const dockEl = document.getElementById('dock');
  const menuClock = document.getElementById('menuClock');
  const spotlight = document.getElementById('spotlight');
  const spotlightInput = document.getElementById('spotlightInput');
  const contextMenu = document.getElementById('contextMenu');
  const appleMenu = document.getElementById('appleMenu');
  const menuApple = document.querySelector('.menu-apple');

  const openWindows = new Map();
  let zCounter = 10;
  let dragState = null;
  let resizeState = null;
  let selectedDesktopIcon = null;
  let bootComplete = false;

  /* ── Boot Screen ── */
  function runBootSequence() {
    let progress = 0;
    const duration = 3200;
    const start = performance.now();

    function tick(now) {
      const elapsed = now - start;
      progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 2.5);
      bootProgressBar.style.width = (eased * 100) + '%';
      bootScreen.querySelector('[role="progressbar"]')?.setAttribute('aria-valuenow', Math.round(eased * 100));

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        finishBoot();
      }
    }
    requestAnimationFrame(tick);
  }

  function finishBoot() {
    bootScreen.classList.add('boot-fade-out');
    setTimeout(() => {
      bootScreen.classList.add('hidden');
      desktop.classList.remove('hidden');
      desktop.classList.add('desktop-reveal');
      bootComplete = true;
      setTimeout(() => {
        openApp('finder', true);
        setTimeout(() => openApp('processlab', true), 500);
      }, 300);
    }, 600);
  }

  /* ── Clock ── */
  function updateClock() {
    const now = new Date();
    menuClock.textContent = now.toLocaleDateString('pt-BR', {
      weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  }
  updateClock();
  setInterval(updateClock, 30_000);

  /* ── Helpers ── */
  function getWorkArea() {
    const rect = windowsEl.getBoundingClientRect();
    return { left: 0, top: 0, width: rect.width, height: rect.height };
  }

  function clampWindowPosition(win, x, y) {
    const area = getWorkArea();
    const w = win.offsetWidth;
    const h = win.offsetHeight;
    const minVisible = 60;
    return {
      x: Math.max(-w + minVisible, Math.min(x, area.width - minVisible)),
      y: Math.max(0, Math.min(y, area.height - 40)),
    };
  }

  function getDockIconRect(app) {
    const icon = dockEl.querySelector(`[data-app="${app}"]`);
    if (!icon) return { x: window.innerWidth / 2, y: window.innerHeight - 40, width: 52, height: 52 };
    const r = icon.getBoundingClientRect();
    const area = windowsEl.getBoundingClientRect();
    return {
      x: r.left + r.width / 2 - area.left,
      y: r.top + r.height / 2 - area.top,
      width: r.width,
      height: r.height,
    };
  }

  function bounceDockIcon(app) {
    const icon = dockEl.querySelector(`[data-app="${app}"]`);
    if (!icon) return;
    icon.classList.add('dock-bounce');
    setTimeout(() => icon.classList.remove('dock-bounce'), 600);
  }

  /* ── Window Management ── */
  function focusWindow(app) {
    openWindows.forEach((data, key) => {
      const win = data.el;
      win.classList.toggle('focused', key === app);
      win.classList.toggle('unfocused', key !== app);
      if (key === app) win.style.zIndex = ++zCounter;
    });
    dockEl.querySelectorAll('.dock-item').forEach(item => {
      const win = openWindows.get(item.dataset.app);
      const active = win && !win.el.classList.contains('minimized') && !win.el.classList.contains('closing');
      item.classList.toggle('active', item.dataset.app === app && active);
    });
    document.querySelector('.menu-app-name').textContent = APP_CONFIG[app]?.title || 'Finder';
  }

  function animateWindowOpen(win, app, finalX, finalY) {
    const dock = getDockIconRect(app);
    const config = APP_CONFIG[app];
    win.style.left = (dock.x - config.width / 2) + 'px';
    win.style.top = (dock.y - config.height / 2) + 'px';
    win.style.transform = 'scale(0.15)';
    win.style.opacity = '0';
    win.classList.add('opening');

    requestAnimationFrame(() => {
      win.style.left = finalX + 'px';
      win.style.top = finalY + 'px';
      win.style.transform = 'scale(1)';
      win.style.opacity = '1';
    });

    setTimeout(() => {
      win.classList.remove('opening');
      win.style.transform = '';
      win.style.opacity = '';
      const data = openWindows.get(app);
      if (data) data.animTimer = null;
    }, 450);
  }

  function openApp(app, fromBoot = false) {
    if (!bootComplete && !fromBoot) return;

    if (openWindows.has(app)) {
      const { el: win } = openWindows.get(app);
      if (win.classList.contains('minimized')) {
        restoreWindow(app);
        return;
      }
      focusWindow(app);
      win.classList.add('window-shake');
      setTimeout(() => win.classList.remove('window-shake'), 400);
      return;
    }

    const config = APP_CONFIG[app];
    if (!config) return;

    bounceDockIcon(app);

    let win;
    if (config.template) {
      win = document.getElementById(config.template).content.firstElementChild.cloneNode(true);
    } else {
      win = document.getElementById('tpl-generic').content.firstElementChild.cloneNode(true);
      win.dataset.app = app;
      win.querySelector('.window-title').textContent = config.title;
      win.querySelector('.generic-icon').textContent = config.icon;
      win.querySelector('h3').textContent = config.title;
    }

    const area = getWorkArea();
    const w = config.width || 420;
    const h = config.height || 340;
    let x = config.x ?? 100;
    let y = config.y ?? 80;

    if (config.center) {
      x = (area.width - w) / 2;
      y = (area.height - h) / 2;
    }

    // Cascade offset for multiple windows
    const offset = openWindows.size * 24;
    x += offset;
    y += offset;

    win.style.width = w + 'px';
    win.style.height = h + 'px';
    win.classList.add('focused');
    win.style.zIndex = ++zCounter;

    bindWindowEvents(win, app);
    windowsEl.appendChild(win);
    openWindows.set(app, { el: win, bounds: { x, y, w, h }, animTimer: null, closeTimer: null });

    animateWindowOpen(win, app, x, y);
    win.style.left = x + 'px';
    win.style.top = y + 'px';

    focusWindow(app);
  }

  function restoreWindow(app) {
    const { el: win } = openWindows.get(app);
    const dock = getDockIconRect(app);
    win.classList.remove('minimized');
    win.style.pointerEvents = 'all';
    win.style.transform = 'scale(0.1)';
    win.style.opacity = '0';
    win.style.left = (dock.x - win.offsetWidth / 2) + 'px';
    win.style.top = (dock.y - win.offsetHeight / 2) + 'px';

    const data = openWindows.get(app);
    requestAnimationFrame(() => {
      win.style.transform = 'scale(1)';
      win.style.opacity = '1';
      win.style.left = data.bounds.x + 'px';
      win.style.top = data.bounds.y + 'px';
    });

    setTimeout(() => {
      win.style.transform = '';
      win.style.opacity = '';
    }, 400);

    focusWindow(app);
    bounceDockIcon(app);
  }

  function minimizeWindow(app) {
    const { el: win } = openWindows.get(app);
    if (!win || win.classList.contains('minimized')) return;

    const dock = getDockIconRect(app);
    const data = openWindows.get(app);
    data.bounds = {
      x: parseFloat(win.style.left) || data.bounds?.x || 0,
      y: parseFloat(win.style.top) || data.bounds?.y || 0,
      w: win.offsetWidth,
      h: win.offsetHeight,
    };

    win.classList.add('minimizing');
    win.style.left = (dock.x - win.offsetWidth / 2) + 'px';
    win.style.top = (dock.y - win.offsetHeight / 2) + 'px';
    win.style.transform = 'scale(0.08)';
    win.style.opacity = '0';

    setTimeout(() => {
      win.classList.remove('minimizing');
      win.classList.add('minimized');
      win.style.transform = '';
      win.style.opacity = '';
      win.style.pointerEvents = 'none';
      const data = openWindows.get(app);
      if (data) data.animTimer = null;
    }, 380);

    dockEl.querySelector(`[data-app="${app}"]`)?.classList.remove('active');
  }

  function closeApp(app) {
    const data = openWindows.get(app);
    if (!data) return;
    const win = data.el;

    if (win.classList.contains('closing')) return;

    if (data.animTimer) clearTimeout(data.animTimer);

    win.classList.remove('opening', 'minimizing', 'minimized', 'window-shake', 'dragging', 'maximized');
    win.style.visibility = 'visible';
    win.style.pointerEvents = 'none';
    win.style.transform = 'scale(0.85)';
    win.style.opacity = '0';
    win.classList.add('closing');

    data.closeTimer = setTimeout(() => {
      win.querySelector('.processlab-body')?._processLabCleanup?.();
      win.remove();
      openWindows.delete(app);
      dockEl.querySelector(`[data-app="${app}"]`)?.classList.remove('active');
      const remaining = [...openWindows.keys()];
      if (remaining.length) focusWindow(remaining[remaining.length - 1]);
      else document.querySelector('.menu-app-name').textContent = 'Finder';
    }, 250);
  }

  function toggleMaximize(win, app) {
    const data = openWindows.get(app);
    if (win.classList.contains('maximized')) {
      win.classList.remove('maximized');
      win.style.width = data.savedBounds.w + 'px';
      win.style.height = data.savedBounds.h + 'px';
      win.style.left = data.savedBounds.x + 'px';
      win.style.top = data.savedBounds.y + 'px';
    } else {
      data.savedBounds = {
        x: parseFloat(win.style.left) || 0,
        y: parseFloat(win.style.top) || 0,
        w: win.offsetWidth,
        h: win.offsetHeight,
      };
      win.classList.add('maximized');
    }
  }

  function bindTrafficLight(btn, action) {
    const handler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      action();
    };
    btn.addEventListener('mousedown', handler);
    btn.addEventListener('click', handler);
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      action();
    }, { passive: false });
  }

  function bindWindowEvents(win, app) {
    win.dataset.app = app;
    const titlebar = win.querySelector('.window-titlebar');
    const closeBtn = win.querySelector('.tl-close');
    const minBtn = win.querySelector('.tl-minimize');
    const maxBtn = win.querySelector('.tl-maximize');

    if (!closeBtn || !minBtn || !maxBtn) return;

    bindTrafficLight(closeBtn, () => closeApp(app));
    bindTrafficLight(minBtn, () => minimizeWindow(app));
    bindTrafficLight(maxBtn, () => toggleMaximize(win, app));

    titlebar.addEventListener('dblclick', (e) => {
      if (e.target.closest('.tl')) return;
      toggleMaximize(win, app);
    });

    const startDrag = (clientX, clientY, target) => {
      if (target.closest('.tl')) return;
      if (win.classList.contains('maximized')) return;
      focusWindow(app);
      const rect = win.getBoundingClientRect();
      const area = windowsEl.getBoundingClientRect();
      dragState = {
        win, app,
        offsetX: clientX - rect.left,
        offsetY: clientY - rect.top,
        areaTop: area.top,
        areaLeft: area.left,
      };
      win.classList.add('dragging');
    };

    titlebar.addEventListener('mousedown', (e) => startDrag(e.clientX, e.clientY, e.target));
    titlebar.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      startDrag(t.clientX, t.clientY, e.target);
      e.preventDefault();
    }, { passive: false });

    win.addEventListener('mousedown', () => focusWindow(app));

    // Resize handle
    const handle = document.createElement('div');
    handle.className = 'resize-handle';
    handle.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      if (win.classList.contains('maximized')) return;
      focusWindow(app);
      const area = windowsEl.getBoundingClientRect();
      resizeState = {
        win, app,
        startX: e.clientX,
        startY: e.clientY,
        startW: win.offsetWidth,
        startH: win.offsetHeight,
        areaLeft: area.left,
        areaTop: area.top,
      };
      e.preventDefault();
    });
    win.appendChild(handle);

    // Finder interactions
    win.querySelectorAll('.finder-item').forEach(item => {
      item.addEventListener('dblclick', () => {
        item.classList.add('selected');
        setTimeout(() => item.classList.remove('selected'), 200);
      });
    });

    win.querySelectorAll('.sidebar-section li, .settings-sidebar li').forEach(li => {
      li.addEventListener('click', () => {
        li.closest('ul')?.querySelectorAll('li').forEach(s => s.classList.remove('active'));
        li.classList.add('active');
      });
    });

    if (app === 'processlab' && typeof renderProcessLab === 'function') {
      renderProcessLab(win.querySelector('.processlab-body'));
    }
  }

  function onPointerMove(clientX, clientY) {
    if (dragState) {
      const { win, offsetX, offsetY, areaTop, areaLeft } = dragState;
      const pos = clampWindowPosition(
        win,
        clientX - areaLeft - offsetX,
        clientY - areaTop - offsetY
      );
      win.style.left = pos.x + 'px';
      win.style.top = pos.y + 'px';
    }

    if (resizeState) {
      const { win, app, startX, startY, startW, startH } = resizeState;
      const newW = Math.max(320, startW + (clientX - startX));
      const newH = Math.max(200, startH + (clientY - startY));
      win.style.width = newW + 'px';
      win.style.height = newH + 'px';
      const data = openWindows.get(app);
      if (data) data.bounds = { ...data.bounds, w: newW, h: newH };
    }
  }

  document.addEventListener('mousemove', (e) => onPointerMove(e.clientX, e.clientY));
  document.addEventListener('touchmove', (e) => {
    if (dragState || resizeState) {
      const t = e.touches[0];
      onPointerMove(t.clientX, t.clientY);
      e.preventDefault();
    }
  }, { passive: false });

  function endPointer() {
    if (dragState) dragState.win.classList.remove('dragging');
    dragState = null;
    resizeState = null;
  }

  document.addEventListener('mouseup', endPointer);
  document.addEventListener('touchend', endPointer);

  /* ── Dock & Desktop ── */
  dockEl.addEventListener('click', (e) => {
    const item = e.target.closest('.dock-item');
    if (!item) return;
    openApp(item.dataset.app);
  });

  dockEl.addEventListener('contextmenu', (e) => {
    const item = e.target.closest('.dock-item');
    if (!item) return;
    e.preventDefault();
    const app = item.dataset.app;
    if (openWindows.has(app)) closeApp(app);
  });

  document.querySelectorAll('.desktop-icon').forEach(icon => {
    icon.addEventListener('click', () => {
      if (selectedDesktopIcon) selectedDesktopIcon.classList.remove('selected');
      icon.classList.add('selected');
      selectedDesktopIcon = icon;
    });
    icon.addEventListener('dblclick', () => openApp(icon.dataset.app));
  });

  desktop.addEventListener('click', (e) => {
    if (
      e.target.closest('.window') ||
      e.target.closest('.dock-container') ||
      e.target.closest('.menu-bar') ||
      e.target.closest('.context-menu') ||
      e.target.closest('.apple-menu') ||
      e.target.closest('.spotlight-overlay') ||
      e.target.closest('.desktop-icon')
    ) return;

    if (selectedDesktopIcon) {
      selectedDesktopIcon.classList.remove('selected');
      selectedDesktopIcon = null;
    }
    hideMenus();
  });

  desktop.addEventListener('contextmenu', (e) => {
    if (e.target.closest('.window') || e.target.closest('.dock-container') || e.target.closest('.menu-bar')) return;
    e.preventDefault();
    hideMenus();
    contextMenu.style.left = e.clientX + 'px';
    contextMenu.style.top = e.clientY + 'px';
    contextMenu.classList.remove('hidden');
  });

  contextMenu.querySelector('button:first-child')?.addEventListener('click', () => {
    hideMenus();
    openApp('finder');
  });

  contextMenu.querySelector('button:nth-child(2)')?.addEventListener('click', () => {
    hideMenus();
    openApp('about');
  });

  /* ── Apple Menu ── */
  menuApple.addEventListener('click', (e) => {
    e.stopPropagation();
    appleMenu.classList.toggle('hidden');
    contextMenu.classList.add('hidden');
  });

  appleMenu.querySelector('button:first-child')?.addEventListener('click', () => {
    hideMenus();
    openApp('about');
  });

  appleMenu.querySelector('button:nth-child(3)')?.addEventListener('click', () => {
    hideMenus();
    openApp('settings');
  });

  appleMenu.querySelector('button:last-child')?.addEventListener('click', () => {
    hideMenus();
    location.reload();
  });

  function hideMenus() {
    contextMenu.classList.add('hidden');
    appleMenu.classList.add('hidden');
  }

  document.addEventListener('click', hideMenus);

  /* ── Spotlight ── */
  function toggleSpotlight(show) {
    spotlight.classList.toggle('hidden', !show);
    if (show) {
      spotlightInput.value = '';
      setTimeout(() => spotlightInput.focus(), 50);
    }
  }

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      toggleSpotlight(spotlight.classList.contains('hidden'));
    }
    if (e.key === 'Escape') {
      toggleSpotlight(false);
      hideMenus();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'w') {
      const focused = [...openWindows.entries()].find(([, d]) => d.el.classList.contains('focused'));
      if (focused) { e.preventDefault(); closeApp(focused[0]); }
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'm') {
      const focused = [...openWindows.entries()].find(([, d]) => d.el.classList.contains('focused'));
      if (focused) { e.preventDefault(); minimizeWindow(focused[0]); }
    }
  });

  document.querySelector('.menu-icon[title="Buscar"]')?.addEventListener('click', () => {
    toggleSpotlight(true);
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
      else if (q.includes('mail') || q.includes('email')) openApp('mail');
      else if (q.includes('foto')) openApp('photos');
      else if (q.includes('music') || q.includes('música')) openApp('music');
      else if (q.includes('process') || q.includes('lab') || q.includes('spawn')) openApp('processlab');
      else openApp('finder');
    }
  });

  /* ── Dock magnification ── */
  dockEl.addEventListener('mousemove', (e) => {
    dockEl.querySelectorAll('.dock-item').forEach(item => {
      const rect = item.getBoundingClientRect();
      const center = rect.left + rect.width / 2;
      const dist = Math.abs(e.clientX - center);
      const scale = Math.max(1, 1.45 - dist / 100);
      item.style.transform = `scale(${scale}) translateY(${-(scale - 1) * 22}px)`;
    });
  });

  dockEl.addEventListener('mouseleave', () => {
    dockEl.querySelectorAll('.dock-item').forEach(item => {
      if (!item.classList.contains('dock-bounce')) item.style.transform = '';
    });
  });

  /* ── Start ── */
  runBootSequence();
})();
