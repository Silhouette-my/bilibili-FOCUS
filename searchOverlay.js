const bfSearchController = {
  active: false,
  observer: null,
  scrollHandler: null,
  resizeHandler: null,
  maskHideTimer: null
};

const BF_HEADER_HEIGHT = 64;
const BF_LEFT_MASK_WIDTH = 240;
const BF_Z_MASK = 999998;
const BF_Z_FLOAT = 100000;
const BF_SHOW_THRESHOLD = 12;
const BF_ACTIVE_CLASS = 'bili-search-mask-active';

function bfDetectSearchPageType() {
  const isEntry = !!document.querySelector('.search-entry-page');
  const isResults = !isEntry && !!document.querySelector('.search-layout');
  document.documentElement.classList.toggle('is-entry', bfSearchController.active && isEntry);
  document.documentElement.classList.toggle('is-results', bfSearchController.active && isResults);
  return { isEntry, isResults };
}

function bfEnsureLeftMask() {
  let mask = document.querySelector('#bili-header-mask-left');
  if (!mask) {
    mask = document.createElement('div');
    mask.id = 'bili-header-mask-left';
    document.body.appendChild(mask);
  }

  Object.assign(mask.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: `${BF_LEFT_MASK_WIDTH}px`,
    height: `${BF_HEADER_HEIGHT}px`,
    background: '#fff',
    zIndex: BF_Z_MASK,
    pointerEvents: 'auto',
    display: 'none',
    opacity: '0',
    transition: 'opacity 120ms ease'
  });

  return mask;
}

function bfRemoveLeftMask() {
  const mask = document.querySelector('#bili-header-mask-left');
  if (mask) {
    mask.remove();
  }
}

function bfFloatSearchElements() {
  ['.search-input-wrap', '.search-center-title', '.search-logo'].forEach((selector) => {
    const element = document.querySelector(selector);
    if (element) {
      element.style.position = 'relative';
      element.style.zIndex = BF_Z_FLOAT;
      element.style.pointerEvents = 'auto';
    }
  });
}

function bfRestoreSearchElements() {
  ['.search-input-wrap', '.search-center-title', '.search-logo'].forEach((selector) => {
    const element = document.querySelector(selector);
    if (element) {
      element.style.position = '';
      element.style.zIndex = '';
      element.style.pointerEvents = '';
    }
  });

  const title = document.querySelector('.search-center-title');
  if (title) {
    title.style.marginTop = '';
    title.style.marginBottom = '';
  }

  const stage = document.querySelector('#i_cecream');
  if (stage) {
    stage.style.minHeight = '';
  }
}

function bfAdjustEntryPage() {
  const stage = document.querySelector('#i_cecream');
  if (stage) stage.style.minHeight = '100vh';

  const title = document.querySelector('.search-center-title');
  if (title) {
    title.style.marginTop = '0';
    title.style.marginBottom = '16px';
    title.style.position = 'relative';
    title.style.zIndex = BF_Z_FLOAT;
  }
}

function bfResetEntryAdjustments() {
  const stage = document.querySelector('#i_cecream');
  if (stage) stage.style.minHeight = '';

  const title = document.querySelector('.search-center-title');
  if (title) {
    title.style.marginTop = '';
    title.style.marginBottom = '';
  }
}

function bfUpdateMaskVisibility() {
  const mask = document.querySelector('#bili-header-mask-left');
  if (!mask || !bfSearchController.active) return;

  const { isEntry, isResults } = bfDetectSearchPageType();
  const atTop = window.scrollY <= BF_SHOW_THRESHOLD;

  const inputWrap = document.querySelector('.search-input-wrap');
  let inputInHeaderBand = false;
  if (inputWrap) {
    const rect = inputWrap.getBoundingClientRect();
    inputInHeaderBand = rect.top >= -BF_SHOW_THRESHOLD && rect.top < BF_HEADER_HEIGHT + BF_SHOW_THRESHOLD;
  }

  const shouldShow = atTop && inputInHeaderBand && (isEntry || isResults);

  if (shouldShow) {
    if (bfSearchController.maskHideTimer) {
      clearTimeout(bfSearchController.maskHideTimer);
      bfSearchController.maskHideTimer = null;
    }
    mask.style.display = 'block';
    requestAnimationFrame(() => {
      mask.style.opacity = '1';
    });
    return;
  }

  mask.style.opacity = '0';
  bfSearchController.maskHideTimer = window.setTimeout(() => {
    mask.style.display = 'none';
  }, 130);
}

function bfApplySearchMaskLayout() {
  if (!bfSearchController.active || !document.body) return;

  document.documentElement.classList.add(BF_ACTIVE_CLASS);
  const pageType = bfDetectSearchPageType();
  bfEnsureLeftMask();
  bfResetEntryAdjustments();
  bfFloatSearchElements();
  if (pageType.isEntry) {
    bfAdjustEntryPage();
  }
  bfUpdateMaskVisibility();
}

function bfStartSearchMask() {
  if (bfSearchController.active || !document.body) return;

  bfSearchController.active = true;
  bfApplySearchMaskLayout();

  bfSearchController.observer = new MutationObserver(() => {
    bfApplySearchMaskLayout();
  });
  bfSearchController.observer.observe(document.body, { childList: true, subtree: true });

  let scheduled = false;
  const scheduleUpdate = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      bfUpdateMaskVisibility();
    });
  };

  bfSearchController.scrollHandler = scheduleUpdate;
  bfSearchController.resizeHandler = scheduleUpdate;
  window.addEventListener('scroll', bfSearchController.scrollHandler, { passive: true });
  window.addEventListener('resize', bfSearchController.resizeHandler);
}

function bfStopSearchMask() {
  bfSearchController.active = false;

  if (bfSearchController.observer) {
    bfSearchController.observer.disconnect();
    bfSearchController.observer = null;
  }

  if (bfSearchController.scrollHandler) {
    window.removeEventListener('scroll', bfSearchController.scrollHandler);
    bfSearchController.scrollHandler = null;
  }

  if (bfSearchController.resizeHandler) {
    window.removeEventListener('resize', bfSearchController.resizeHandler);
    bfSearchController.resizeHandler = null;
  }

  if (bfSearchController.maskHideTimer) {
    clearTimeout(bfSearchController.maskHideTimer);
    bfSearchController.maskHideTimer = null;
  }

  document.documentElement.classList.remove(BF_ACTIVE_CLASS, 'is-entry', 'is-results');
  bfRemoveLeftMask();
  bfRestoreSearchElements();
}

function bfApplySearchFeatureState(featureState) {
  const enabled = !featureState || featureState.searchMaskEnabled !== false;

  if (enabled) {
    bfStartSearchMask();
  } else {
    bfStopSearchMask();
  }
}

async function bfLoadSearchRuntime() {
  await chrome.runtime.sendMessage({ type: 'BF_ENSURE_RUNTIME' }).catch(() => null);
  const { effectiveFeatureState } = await chrome.storage.local.get(['effectiveFeatureState']);
  bfApplySearchFeatureState(effectiveFeatureState || {});
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.effectiveFeatureState) {
    bfApplySearchFeatureState(changes.effectiveFeatureState.newValue || {});
  }
});

bfLoadSearchRuntime();
