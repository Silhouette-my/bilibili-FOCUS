(function () {
  'use strict';

  const STYLE_ID = 'bili-focus-hide-dynamic-hot-search-style';
  const HOT_SEARCH_SELECTOR = '.bili-dyn-search-trendings';
  const backgroundClient = globalThis.BiliFocusClient;

  const controller = {
    suspended: false,
    style: null,
    unsubscribe: null,
    requestId: 0,
    lifecycleGeneration: 0
  };

  function isDynamicPage() {
    return location.hostname === 't.bilibili.com';
  }

  function ensureStyle() {
    if (!document.head) return;
    if (!controller.style) {
      controller.style = document.getElementById(STYLE_ID);
    }
    if (!controller.style) {
      controller.style = document.createElement('style');
      controller.style.id = STYLE_ID;
      controller.style.textContent = `
        ${HOT_SEARCH_SELECTOR} {
          display: none !important;
        }
      `;
    }
    if (!controller.style.isConnected) {
      document.head.appendChild(controller.style);
    }
  }

  function removeStyle() {
    if (!controller.style) {
      controller.style = document.getElementById(STYLE_ID);
    }
    if (controller.style) {
      controller.style.remove();
      controller.style = null;
    }
  }

  function applySnapshot(snapshot) {
    const enabled = Boolean(
      snapshot &&
      snapshot.effectiveFeatureState &&
      snapshot.effectiveFeatureState.searchMaskEnabled
    );
    if (controller.suspended || !isDynamicPage() || !enabled) {
      removeStyle();
      return;
    }
    ensureStyle();
  }

  function subscribe() {
    if (controller.unsubscribe) return;
    controller.unsubscribe = backgroundClient.subscribe((snapshot) => {
      controller.requestId += 1;
      applySnapshot(snapshot);
    });
  }

  function unsubscribe() {
    if (!controller.unsubscribe) return;
    controller.unsubscribe();
    controller.unsubscribe = null;
  }

  async function refresh() {
    const requestId = ++controller.requestId;
    const snapshot = await backgroundClient.getState({ refresh: true });
    if (requestId !== controller.requestId || controller.suspended) return;
    applySnapshot(snapshot);
  }

  function suspend() {
    controller.suspended = true;
    controller.lifecycleGeneration += 1;
    controller.requestId += 1;
    unsubscribe();
    removeStyle();
  }

  function resume() {
    if (!controller.suspended) return;
    controller.suspended = false;
    const lifecycleGeneration = ++controller.lifecycleGeneration;
    refresh().catch(() => {
      if (
        !controller.suspended &&
        lifecycleGeneration === controller.lifecycleGeneration
      ) {
        applySnapshot(backgroundClient.getCachedState());
      }
    }).finally(() => {
      if (
        !controller.suspended &&
        lifecycleGeneration === controller.lifecycleGeneration
      ) {
        subscribe();
      }
    });
  }

  function initialize() {
    if (!isDynamicPage()) return;
    window.addEventListener('pagehide', suspend);
    window.addEventListener('pageshow', resume);
    subscribe();
    refresh().catch(() => applySnapshot(backgroundClient.getCachedState()));
  }

  initialize();
})();
