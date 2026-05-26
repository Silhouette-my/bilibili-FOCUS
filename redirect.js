const BF_REDIRECT_TARGET_URL = 'https://search.bilibili.com/all?vt=64450376';
const BF_REDIRECT_WHITELIST_HOSTS = [
  'search.bilibili.com',
  'passport.bilibili.com',
  'message.bilibili.com',
  'account.bilibili.com',
  'space.bilibili.com',
  'api.bilibili.com',
  'api.vc.bilibili.com',
  'pay.bilibili.com',
  't.bilibili.com'
];

let bfRedirectEnabled = true;
let bfHeartbeatTimer = null;
let bfHeartbeatActive = false;

function bfIsRedirectCandidate() {
  const host = window.location.hostname;
  const pathname = window.location.pathname;

  if (BF_REDIRECT_WHITELIST_HOSTS.includes(host)) return false;
  if (pathname.startsWith('/video/') || pathname.startsWith('/bangumi/play/')) return false;
  if (window.location.href === BF_REDIRECT_TARGET_URL) return false;

  return true;
}

function bfApplyRedirectState(enabled) {
  bfRedirectEnabled = enabled !== false;

  if (bfRedirectEnabled && bfIsRedirectCandidate()) {
    window.location.replace(BF_REDIRECT_TARGET_URL);
  }
}

function bfHandleEffectiveFeatureState(featureState) {
  const redirectEnabled = !featureState || featureState.redirectEnabled !== false;
  bfApplyRedirectState(redirectEnabled);
}

function bfSendActivityPing() {
  chrome.runtime.sendMessage({ type: 'BF_ACTIVITY_PING' }).catch(() => null);
}

function bfStopHeartbeat() {
  if (bfHeartbeatTimer) {
    window.clearInterval(bfHeartbeatTimer);
    bfHeartbeatTimer = null;
  }
  bfHeartbeatActive = false;
}

function bfStartHeartbeat() {
  if (bfHeartbeatActive) return;
  bfHeartbeatActive = true;
  bfSendActivityPing();
  bfHeartbeatTimer = window.setInterval(bfSendActivityPing, 15000);
}

function bfSyncHeartbeat() {
  const shouldBeActive = document.visibilityState === 'visible' && document.hasFocus();

  if (shouldBeActive) {
    bfStartHeartbeat();
    return;
  }

  if (bfHeartbeatActive) {
    bfSendActivityPing();
    bfStopHeartbeat();
  }
}

async function bfLoadRuntimeState() {
  await chrome.runtime.sendMessage({ type: 'BF_ENSURE_RUNTIME' }).catch(() => null);
  const { effectiveFeatureState } = await chrome.storage.local.get(['effectiveFeatureState']);
  bfHandleEffectiveFeatureState(effectiveFeatureState || {});
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.effectiveFeatureState) {
    bfHandleEffectiveFeatureState(changes.effectiveFeatureState.newValue || {});
  }
});

document.addEventListener('visibilitychange', bfSyncHeartbeat);
window.addEventListener('focus', bfSyncHeartbeat);
window.addEventListener('blur', bfSyncHeartbeat);
window.addEventListener('pagehide', () => {
  if (bfHeartbeatActive) {
    bfSendActivityPing();
    bfStopHeartbeat();
  }
});

bfLoadRuntimeState();
bfSyncHeartbeat();
