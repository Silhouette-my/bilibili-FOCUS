const BF_PLAYER_SELECTORS = [
  '.bpx-player-container',
  '.bpx-player-video-wrap',
  '.bpx-player'
];

const bfPlayerMaskController = {
  active: false,
  style: null,
  elements: null,
  observer: null,
  gap: 12,
  radius: 12,
  onResize: null,
  onScroll: null
};

const bfAutoPlayController = {
  active: false,
  style: null,
  observer: null,
  intervalId: null,
  timeoutId: null,
  pendingCheck: false,
  lastClickTime: 0
};

function bfEnsurePlayerMaskStyle() {
  if (bfPlayerMaskController.style) return;

  const style = document.createElement('style');
  style.id = 'bili-player-mask-style';
  style.textContent = `
    .bili-strip {
      position: fixed;
      z-index: 999999;
      background: rgba(0,0,0,0.22);
      backdrop-filter: grayscale(70%) contrast(80%) brightness(99%);
      pointer-events: auto;
    }
    .bili-corner {
      position: fixed;
      z-index: 1000000;
      width: 12px;
      height: 12px;
      background: rgba(0,0,0,0.22);
      backdrop-filter: grayscale(70%) contrast(80%) brightness(99%);
      pointer-events: none;
    }
    .corner-tl {
      -webkit-mask: radial-gradient(circle at 100% 100%, #000 0px, #000 100%, transparent 100%);
      mask: radial-gradient(circle at 100% 100%, #000 0px, #000 100%, transparent 100%);
    }
    .corner-tr {
      -webkit-mask: radial-gradient(circle at 0% 100%, #000 0px, #000 100%, transparent 100%);
      mask: radial-gradient(circle at 0% 100%, #000 0px, #000 100%, transparent 100%);
    }
    .corner-bl {
      -webkit-mask: radial-gradient(circle at 100% 0%, #000 0px, #000 100%, transparent 100%);
      mask: radial-gradient(circle at 100% 0%, #000 0px, #000 100%, transparent 100%);
    }
    .corner-br {
      -webkit-mask: radial-gradient(circle at 0% 0%, #000 0px, #000 100%, transparent 100%);
      mask: radial-gradient(circle at 0% 0%, #000 0px, #000 100%, transparent 100%);
    }
    .bili-focus-ring {
      position: fixed;
      z-index: 1000001;
      pointer-events: none;
      box-shadow:
        0 0 0 2px rgba(255,255,255,0.14),
        0 18px 54px rgba(0,0,0,0.42);
      border-radius: 12px;
      transition: top .2s ease, left .2s ease, width .2s ease, height .2s ease;
    }
  `;
  document.head.appendChild(style);
  bfPlayerMaskController.style = style;
}

function bfCreatePlayerMaskElements() {
  if (bfPlayerMaskController.elements) return bfPlayerMaskController.elements;

  const topStrip = document.createElement('div');
  topStrip.className = 'bili-strip';
  const bottomStrip = document.createElement('div');
  bottomStrip.className = 'bili-strip';
  const leftStrip = document.createElement('div');
  leftStrip.className = 'bili-strip';
  const rightStrip = document.createElement('div');
  rightStrip.className = 'bili-strip';

  const cornerTL = document.createElement('div');
  cornerTL.className = 'bili-corner corner-tl';
  const cornerTR = document.createElement('div');
  cornerTR.className = 'bili-corner corner-tr';
  const cornerBL = document.createElement('div');
  cornerBL.className = 'bili-corner corner-bl';
  const cornerBR = document.createElement('div');
  cornerBR.className = 'bili-corner corner-br';

  const ring = document.createElement('div');
  ring.className = 'bili-focus-ring';

  bfPlayerMaskController.elements = {
    topStrip,
    bottomStrip,
    leftStrip,
    rightStrip,
    cornerTL,
    cornerTR,
    cornerBL,
    cornerBR,
    ring
  };

  return bfPlayerMaskController.elements;
}

function bfAttachPlayerMaskElements() {
  const elements = bfCreatePlayerMaskElements();
  Object.values(elements).forEach((element) => {
    if (!element.isConnected) {
      document.body.appendChild(element);
    }
  });
}

function bfRemovePlayerMaskElements() {
  if (!bfPlayerMaskController.elements) return;
  Object.values(bfPlayerMaskController.elements).forEach((element) => element.remove());
}

function bfGetPlayerElement() {
  return BF_PLAYER_SELECTORS
    .map((selector) => document.querySelector(selector))
    .find(Boolean) || null;
}

function bfParseRadius(value) {
  if (!value) return NaN;
  const match = value.match(/(\d+(\.\d+)?)px/);
  return match ? Number(match[1]) : NaN;
}

function bfGetPlayerRect() {
  const player = bfGetPlayerElement();
  if (!player) return null;

  const rect = player.getBoundingClientRect();
  const style = getComputedStyle(player);
  const radii = [
    bfParseRadius(style.borderTopLeftRadius),
    bfParseRadius(style.borderTopRightRadius),
    bfParseRadius(style.borderBottomLeftRadius),
    bfParseRadius(style.borderBottomRightRadius)
  ].filter((value) => !Number.isNaN(value));

  if (radii.length) {
    bfPlayerMaskController.radius = Math.round(
      radii.reduce((sum, value) => sum + value, 0) / radii.length
    );
  }

  return {
    top: Math.max(0, rect.top - bfPlayerMaskController.gap),
    left: Math.max(0, rect.left - bfPlayerMaskController.gap),
    right: Math.min(window.innerWidth, rect.right + bfPlayerMaskController.gap),
    bottom: Math.min(window.innerHeight, rect.bottom + bfPlayerMaskController.gap)
  };
}

function bfUpdatePlayerMask() {
  if (!bfPlayerMaskController.active || !bfPlayerMaskController.elements) return;

  const rect = bfGetPlayerRect();
  if (!rect) {
    Object.values(bfPlayerMaskController.elements).forEach((element) => {
      element.style.display = 'none';
    });
    return;
  }

  const { top, left, right, bottom } = rect;
  const { radius } = bfPlayerMaskController;
  const {
    topStrip,
    bottomStrip,
    leftStrip,
    rightStrip,
    cornerTL,
    cornerTR,
    cornerBL,
    cornerBR,
    ring
  } = bfPlayerMaskController.elements;

  Object.values(bfPlayerMaskController.elements).forEach((element) => {
    element.style.display = 'block';
  });

  [cornerTL, cornerTR, cornerBL, cornerBR].forEach((corner) => {
    corner.style.width = `${radius}px`;
    corner.style.height = `${radius}px`;
  });
  ring.style.borderRadius = `${radius}px`;

  topStrip.style.top = '0px';
  topStrip.style.left = '0px';
  topStrip.style.width = '100vw';
  topStrip.style.height = `${top}px`;

  bottomStrip.style.top = `${bottom}px`;
  bottomStrip.style.left = '0px';
  bottomStrip.style.width = '100vw';
  bottomStrip.style.height = `${window.innerHeight - bottom}px`;

  leftStrip.style.top = `${top}px`;
  leftStrip.style.left = '0px';
  leftStrip.style.width = `${left}px`;
  leftStrip.style.height = `${bottom - top}px`;

  rightStrip.style.top = `${top}px`;
  rightStrip.style.left = `${right}px`;
  rightStrip.style.width = `${window.innerWidth - right}px`;
  rightStrip.style.height = `${bottom - top}px`;

  cornerTL.style.top = `${top}px`;
  cornerTL.style.left = `${left}px`;

  cornerTR.style.top = `${top}px`;
  cornerTR.style.left = `${right - radius}px`;

  cornerBL.style.top = `${bottom - radius}px`;
  cornerBL.style.left = `${left}px`;

  cornerBR.style.top = `${bottom - radius}px`;
  cornerBR.style.left = `${right - radius}px`;

  ring.style.top = `${top}px`;
  ring.style.left = `${left}px`;
  ring.style.width = `${right - left}px`;
  ring.style.height = `${bottom - top}px`;
}

function bfEnableScrollLock() {
  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';

  const blockScroll = (event) => event.preventDefault();
  window.addEventListener('wheel', blockScroll, { passive: false });
  window.addEventListener('touchmove', blockScroll, { passive: false });
  window.__biliBlockScroll = blockScroll;
}

function bfDisableScrollLock() {
  document.body.style.overflow = '';
  document.documentElement.style.overflow = '';

  if (window.__biliBlockScroll) {
    window.removeEventListener('wheel', window.__biliBlockScroll, { passive: false });
    window.removeEventListener('touchmove', window.__biliBlockScroll, { passive: false });
    window.__biliBlockScroll = null;
  }
}

function bfStartPlayerMask() {
  if (bfPlayerMaskController.active || !document.body) return;

  bfPlayerMaskController.active = true;
  bfEnsurePlayerMaskStyle();
  bfAttachPlayerMaskElements();
  bfEnableScrollLock();

  bfPlayerMaskController.onResize = () => bfUpdatePlayerMask();
  bfPlayerMaskController.onScroll = () => bfUpdatePlayerMask();
  bfPlayerMaskController.observer = new MutationObserver(() => bfUpdatePlayerMask());
  bfPlayerMaskController.observer.observe(document.body, { childList: true, subtree: true });

  window.addEventListener('resize', bfPlayerMaskController.onResize);
  window.addEventListener('scroll', bfPlayerMaskController.onScroll, { passive: true });

  bfUpdatePlayerMask();
}

function bfStopPlayerMask() {
  if (!bfPlayerMaskController.active) {
    bfDisableScrollLock();
    return;
  }

  bfPlayerMaskController.active = false;
  bfDisableScrollLock();

  if (bfPlayerMaskController.observer) {
    bfPlayerMaskController.observer.disconnect();
    bfPlayerMaskController.observer = null;
  }

  if (bfPlayerMaskController.onResize) {
    window.removeEventListener('resize', bfPlayerMaskController.onResize);
    bfPlayerMaskController.onResize = null;
  }

  if (bfPlayerMaskController.onScroll) {
    window.removeEventListener('scroll', bfPlayerMaskController.onScroll);
    bfPlayerMaskController.onScroll = null;
  }

  bfRemovePlayerMaskElements();

  if (bfPlayerMaskController.style) {
    bfPlayerMaskController.style.remove();
    bfPlayerMaskController.style = null;
  }
}

function bfEnsureEndingStyle() {
  if (bfAutoPlayController.style) return;

  const style = document.createElement('style');
  style.id = 'bili-hide-ending-related-style';
  style.textContent = `
    .bpx-player-ending-related {
      display: none !important;
    }
  `;
  document.head.appendChild(style);
  bfAutoPlayController.style = style;
}

function bfRemoveEndingStyle() {
  if (bfAutoPlayController.style) {
    bfAutoPlayController.style.remove();
    bfAutoPlayController.style = null;
  }
}

function bfFindAutoPlaySwitch() {
  return Array.from(document.querySelectorAll('.continuous-btn .txt'))
    .find((label) => label.textContent.trim() === '自动连播')
    ?.closest('.continuous-btn')
    ?.querySelector('.switch-btn') || null;
}

function bfCloseAutoPlayIfNeeded() {
  const switchButton = bfFindAutoPlaySwitch();
  if (!switchButton || !switchButton.classList.contains('on')) return;

  const now = Date.now();
  if (now - bfAutoPlayController.lastClickTime < 1000) return;

  bfAutoPlayController.lastClickTime = now;
  switchButton.click();
}

function bfScheduleAutoPlayCheck() {
  if (!bfAutoPlayController.active || bfAutoPlayController.pendingCheck) return;

  bfAutoPlayController.pendingCheck = true;
  requestAnimationFrame(() => {
    bfAutoPlayController.pendingCheck = false;
    bfCloseAutoPlayIfNeeded();
  });
}

function bfStartAutoPlayController() {
  if (bfAutoPlayController.active || !document.body) return;

  bfAutoPlayController.active = true;
  bfEnsureEndingStyle();
  bfScheduleAutoPlayCheck();

  bfAutoPlayController.intervalId = window.setInterval(bfScheduleAutoPlayCheck, 1000);
  bfAutoPlayController.timeoutId = window.setTimeout(() => {
    if (bfAutoPlayController.intervalId) {
      window.clearInterval(bfAutoPlayController.intervalId);
      bfAutoPlayController.intervalId = null;
    }
  }, 15000);

  bfAutoPlayController.observer = new MutationObserver(() => bfScheduleAutoPlayCheck());
  bfAutoPlayController.observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class']
  });
}

function bfStopAutoPlayController() {
  bfAutoPlayController.active = false;
  bfAutoPlayController.pendingCheck = false;
  bfAutoPlayController.lastClickTime = 0;

  if (bfAutoPlayController.observer) {
    bfAutoPlayController.observer.disconnect();
    bfAutoPlayController.observer = null;
  }
  if (bfAutoPlayController.intervalId) {
    window.clearInterval(bfAutoPlayController.intervalId);
    bfAutoPlayController.intervalId = null;
  }
  if (bfAutoPlayController.timeoutId) {
    window.clearTimeout(bfAutoPlayController.timeoutId);
    bfAutoPlayController.timeoutId = null;
  }

  bfRemoveEndingStyle();
}

function bfApplyEffectiveFeatureState(featureState) {
  const playerMaskEnabled = !featureState || featureState.playerMaskEnabled !== false;
  const autoPlayOffEnabled = !featureState || featureState.autoPlayOffEnabled !== false;

  if (playerMaskEnabled) {
    bfStartPlayerMask();
  } else {
    bfStopPlayerMask();
  }

  if (autoPlayOffEnabled) {
    bfStartAutoPlayController();
  } else {
    bfStopAutoPlayController();
  }
}

async function bfLoadPlayerRuntime() {
  await chrome.runtime.sendMessage({ type: 'BF_ENSURE_RUNTIME' }).catch(() => null);
  const { effectiveFeatureState } = await chrome.storage.local.get(['effectiveFeatureState']);
  bfApplyEffectiveFeatureState(effectiveFeatureState || {});
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.effectiveFeatureState) {
    bfApplyEffectiveFeatureState(changes.effectiveFeatureState.newValue || {});
  }
});

bfLoadPlayerRuntime();
