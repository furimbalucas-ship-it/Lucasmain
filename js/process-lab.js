(() => {
  'use strict';

  /**
   * Process Lab — testes no navegador do cliente.
   * JavaScript tenta se comportar como processos do motor do navegador
   * (renderer, GPU, network, utility) usando APIs disponíveis no client-side.
   */
  const ProcessLab = {
    logs: [],
    workers: [],
    channels: [],
    listeners: new Set(),

    onUpdate(fn) {
      this.listeners.add(fn);
      return () => this.listeners.delete(fn);
    },

    emit() {
      this.listeners.forEach((fn) => fn(this.logs.slice()));
    },

    log(message, status = 'info') {
      const entry = {
        time: new Date().toLocaleTimeString('pt-BR'),
        message,
        status,
      };
      this.logs.push(entry);
      this.emit();
      return entry;
    },

    blobUrl(code, type = 'application/javascript') {
      return URL.createObjectURL(new Blob([code], { type }));
    },

    async runAll() {
      this.logs = [];
      this.log('Iniciando testagem — execução 100% no navegador do cliente', 'info');
      this.log(`User-Agent: ${navigator.userAgent}`, 'info');
      this.log(`Origem: ${location.origin}${location.pathname}`, 'info');

      await this.attemptDedicatedWorkers();
      await this.attemptSharedWorker();
      await this.attemptServiceWorker();
      await this.attemptPopupRenderer();
      await this.attemptMessageChannel();
      await this.attemptBroadcastChannel();
      await this.attemptNavigatorLocks();
      await this.attemptSharedArrayBuffer();
      await this.attemptIframeProcess();

      this.log('Sequência concluída — verifique o que o sandbox permitiu', 'info');
    },

    async attemptDedicatedWorkers() {
      this.log('── Web Workers (processos renderer dedicados) ──', 'info');

      const roles = ['renderer-main', 'renderer-gpu', 'renderer-network'];
      for (const role of roles) {
        try {
          const code = `
            const pid = '${role}-' + Math.random().toString(36).slice(2, 8);
            self.postMessage({ ok: true, role: '${role}', pid, thread: 'dedicated' });
            self.onmessage = (e) => {
              self.postMessage({ ok: true, role: '${role}', pid, echo: e.data });
            };
          `;
          const url = this.blobUrl(code);
          const worker = new Worker(url);
          this.workers.push(worker);

          await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('timeout')), 3000);
            worker.onmessage = (e) => {
              clearTimeout(timer);
              this.log(`Worker ${role} ativo — pid ${e.data.pid}`, 'ok');
              worker.postMessage({ ping: true, from: 'main-thread' });
              resolve();
            };
            worker.onerror = (e) => {
              clearTimeout(timer);
              reject(e.error || new Error(e.message));
            };
          });

          URL.revokeObjectURL(url);
        } catch (err) {
          this.log(`Worker ${role} falhou: ${err.message}`, 'fail');
        }
      }
    },

    async attemptSharedWorker() {
      this.log('── SharedWorker (processo compartilhado entre abas) ──', 'info');

      if (typeof SharedWorker === 'undefined') {
        this.log('SharedWorker não disponível neste navegador', 'fail');
        return;
      }

      try {
        const code = `
          let clients = 0;
          self.onconnect = (e) => {
            clients++;
            const port = e.ports[0];
            port.start();
            port.postMessage({ ok: true, role: 'shared-renderer', clients, pid: 'shared-' + clients });
            port.onmessage = (ev) => port.postMessage({ echo: ev.data, clients });
          };
        `;
        const url = this.blobUrl(code);
        const shared = new SharedWorker(url, { name: 'lucasmain-shared-process' });

        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('timeout')), 3000);
          shared.port.onmessage = (e) => {
            clearTimeout(timer);
            this.log(`SharedWorker conectado — ${e.data.clients} cliente(s), pid ${e.data.pid}`, 'ok');
            shared.port.postMessage({ probe: 'main-thread' });
            resolve();
          };
          shared.port.onerror = (e) => {
            clearTimeout(timer);
            reject(e);
          };
          shared.port.start();
        });

        URL.revokeObjectURL(url);
      } catch (err) {
        this.log(`SharedWorker bloqueado: ${err.message}`, 'fail');
      }
    },

    async attemptServiceWorker() {
      this.log('── Service Worker (processo em background do navegador) ──', 'info');

      if (!('serviceWorker' in navigator)) {
        this.log('Service Workers não suportados', 'fail');
        return;
      }

      try {
        const code = `
          self.addEventListener('install', (e) => self.skipWaiting());
          self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
          self.addEventListener('message', (e) => {
            e.source.postMessage({
              ok: true,
              role: 'browser-process-sw',
              pid: 'sw-' + Date.now(),
              received: e.data
            });
          });
        `;
        const url = this.blobUrl(code);
        const reg = await navigator.serviceWorker.register(url);
        await navigator.serviceWorker.ready;

        const reply = await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('timeout')), 4000);
          navigator.serviceWorker.addEventListener('message', function handler(e) {
            clearTimeout(timer);
            navigator.serviceWorker.removeEventListener('message', handler);
            resolve(e.data);
          });
          reg.active?.postMessage({ probe: 'main-thread', intent: 'become-browser-process' });
        });

        this.log(`Service Worker ativo — pid ${reply.pid}, scope ${reg.scope}`, 'ok');
        URL.revokeObjectURL(url);
      } catch (err) {
        this.log(`Service Worker recusado (sandbox/CORS): ${err.message}`, 'fail');
      }
    },

    attemptPopupRenderer() {
      this.log('── window.open (novo processo renderer / aba filha) ──', 'info');

      return new Promise((resolve) => {
        const handler = (e) => {
          if (e.data?.type === 'process-lab-child') {
            window.removeEventListener('message', handler);
            this.log(`Popup filho respondeu — pid ${e.data.pid}`, 'ok');
            resolve();
          }
        };
        window.addEventListener('message', handler);

        const child = window.open('about:blank', 'lucasmain-renderer-child', 'width=420,height=280');
        if (!child) {
          this.log('Popup bloqueado pelo navegador — sem processo filho', 'fail');
          window.removeEventListener('message', handler);
          resolve();
          return;
        }

        const pid = 'popup-' + Math.random().toString(36).slice(2, 8);
        child.document.open();
        child.document.write(`<!DOCTYPE html><html><body style="font:14px system-ui;background:#111;color:#0f0;padding:16px">
          <p>Processo renderer filho</p>
          <p id="pid">${pid}</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'process-lab-child', pid: '${pid}', role: 'popup-renderer' }, '*');
            }
          <\/script>
        </body></html>`);
        child.document.close();

        setTimeout(() => {
          window.removeEventListener('message', handler);
          if (!child.closed) child.close();
          resolve();
        }, 1500);
      });
    },

    async attemptMessageChannel() {
      this.log('── MessageChannel (IPC entre threads) ──', 'info');

      try {
        const code = `
          self.onmessage = (e) => {
            const port = e.ports[0];
            port.postMessage({ ok: true, role: 'utility-process', pid: 'utility-' + Date.now() });
            port.onmessage = (ev) => port.postMessage({ ack: ev.data });
          };
        `;
        const url = this.blobUrl(code);
        const worker = new Worker(url);
        this.workers.push(worker);

        const channel = new MessageChannel();
        this.channels.push(channel);

        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('timeout')), 3000);
          channel.port1.onmessage = (e) => {
            clearTimeout(timer);
            this.log(`MessageChannel — utility pid ${e.data.pid}`, 'ok');
            channel.port1.postMessage({ ping: true });
            resolve();
          };
          worker.postMessage({ init: true }, [channel.port2]);
        });

        URL.revokeObjectURL(url);
      } catch (err) {
        this.log(`MessageChannel falhou: ${err.message}`, 'fail');
      }
    },

    attemptBroadcastChannel() {
      this.log('── BroadcastChannel (bus entre contextos) ──', 'info');

      if (typeof BroadcastChannel === 'undefined') {
        this.log('BroadcastChannel indisponível', 'fail');
        return Promise.resolve();
      }

      return new Promise((resolve) => {
        const bus = new BroadcastChannel('lucasmain-process-bus');
        const pid = 'bc-' + Math.random().toString(36).slice(2, 8);

        bus.onmessage = (e) => {
          if (e.data?.from !== pid) {
            this.log(`BroadcastChannel — mensagem de ${e.data.from}`, 'ok');
            bus.close();
            resolve();
          }
        };

        bus.postMessage({ from: pid, role: 'network-process', intent: 'spawn' });
        setTimeout(() => {
          this.log('BroadcastChannel — sem segunda aba para eco (esperado em teste isolado)', 'info');
          bus.close();
          resolve();
        }, 800);
      });
    },

    async attemptNavigatorLocks() {
      this.log('── Navigator Locks (exclusão de processo) ──', 'info');

      if (!navigator.locks) {
        this.log('Web Locks API indisponível', 'fail');
        return;
      }

      try {
        await navigator.locks.request('lucasmain-browser-process', { mode: 'exclusive' }, async () => {
          this.log('Lock exclusivo adquirido — simula processo único do navegador', 'ok');
          await new Promise((r) => setTimeout(r, 200));
        });
      } catch (err) {
        this.log(`Navigator Locks falhou: ${err.message}`, 'fail');
      }
    },

    attemptSharedArrayBuffer() {
      this.log('── SharedArrayBuffer (memória compartilhada entre processos) ──', 'info');

      try {
        if (typeof SharedArrayBuffer === 'undefined') {
          throw new Error('SharedArrayBuffer desabilitado (COOP/COEP ou política do navegador)');
        }
        const sab = new SharedArrayBuffer(4);
        const view = new Int32Array(sab);
        Atomics.store(view, 0, 42);
        this.log(`SharedArrayBuffer alocado — valor ${Atomics.load(view, 0)}`, 'ok');
      } catch (err) {
        this.log(`SharedArrayBuffer bloqueado: ${err.message}`, 'fail');
      }

      return Promise.resolve();
    },

    attemptIframeProcess() {
      this.log('── iframe sandbox (site-isolated renderer) ──', 'info');

      return new Promise((resolve) => {
        const iframe = document.createElement('iframe');
        iframe.sandbox = 'allow-scripts';
        iframe.style.cssText = 'position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none';
        iframe.srcdoc = `<!DOCTYPE html><script>
          parent.postMessage({ type: 'process-lab-iframe', pid: 'iframe-' + Date.now(), role: 'site-isolated-renderer' }, '*');
        <\/script>`;

        const handler = (e) => {
          if (e.data?.type === 'process-lab-iframe') {
            window.removeEventListener('message', handler);
            this.log(`iframe isolado ativo — pid ${e.data.pid}`, 'ok');
            iframe.remove();
            resolve();
          }
        };

        window.addEventListener('message', handler);
        document.body.appendChild(iframe);

        setTimeout(() => {
          window.removeEventListener('message', handler);
          iframe.remove();
          this.log('iframe sandbox — timeout', 'fail');
          resolve();
        }, 3000);
      });
    },

    destroy() {
      this.workers.forEach((w) => w.terminate());
      this.workers = [];
      this.channels = [];
    },
  };

  window.ProcessLab = ProcessLab;

  function renderProcessLab(container) {
    const logEl = container.querySelector('.process-log');
    const statusEl = container.querySelector('.process-status');
    const runBtn = container.querySelector('.process-run-btn');

    function paint(logs) {
      logEl.innerHTML = logs
        .map(
          (l) =>
            `<div class="process-line process-${l.status}"><time>${l.time}</time><span>${l.message}</span></div>`
        )
        .join('');
      logEl.scrollTop = logEl.scrollHeight;

      const ok = logs.filter((l) => l.status === 'ok').length;
      const fail = logs.filter((l) => l.status === 'fail').length;
      statusEl.textContent = `${ok} processo(s) spawn OK · ${fail} bloqueado(s)`;
    }

    const unsub = ProcessLab.onUpdate(paint);

    runBtn.addEventListener('click', () => {
      ProcessLab.destroy();
      ProcessLab.runAll();
    });

    container._processLabCleanup = () => {
      unsub();
      ProcessLab.destroy();
    };

    ProcessLab.runAll();
  }

  window.renderProcessLab = renderProcessLab;
})();
