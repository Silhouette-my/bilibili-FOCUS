const {
  FEATURE_KEYS,
  ensureFeaturePreferences,
  ensureAppearanceConfig,
  ensureEffectiveFeatureState,
  ensureLockStatus,
  ensureFocusSession,
  formatDateTime,
  formatDurationMinutes,
  getLockReasonsSummary
} = globalThis.BiliFocusShared;

const toggleRedirect = document.getElementById('toggleRedirect');
const togglePlayer = document.getElementById('togglePlayer');
const toggleAutoPlayOff = document.getElementById('toggleAutoPlayOff');
const toggleSearch = document.getElementById('toggleSearch');

const lockStatusCard = document.getElementById('lockStatusCard');
const lockStatusTitle = document.getElementById('lockStatusTitle');
const lockStatusReason = document.getElementById('lockStatusReason');
const lockStatusMeta = document.getElementById('lockStatusMeta');
const customFocusMinutes = document.getElementById('customFocusMinutes');
const focusSessionMeta = document.getElementById('focusSessionMeta');
const stopFocusSession = document.getElementById('stopFocusSession');
const openSettings = document.getElementById('openSettings');
const startCustomFocusButton = document.getElementById('startCustomFocus');
const focusPresetButtons = Array.from(document.querySelectorAll('[data-minutes]'));

const toggleMap = {
  redirectEnabled: toggleRedirect,
  playerMaskEnabled: togglePlayer,
  autoPlayOffEnabled: toggleAutoPlayOff,
  searchMaskEnabled: toggleSearch
};

let latestLockStatus = ensureLockStatus();
let latestFocusSession = ensureFocusSession();
let countdownTimer = null;

function applyTheme(appearanceConfig) {
  document.documentElement.dataset.theme = appearanceConfig.theme;
}

function renderFeatureState(featurePreferences, effectiveFeatureState, lockStatus) {
  FEATURE_KEYS.forEach((key) => {
    const input = toggleMap[key];
    input.checked = Boolean(effectiveFeatureState[key]);
    input.disabled = lockStatus.active;
    input.dataset.preferenceValue = String(featurePreferences[key]);
  });
}

function renderLockStatus(lockStatus) {
  lockStatusCard.dataset.state = lockStatus.active ? 'locked' : 'free';

  if (!lockStatus.active) {
    lockStatusTitle.textContent = '当前未锁定';
    lockStatusReason.textContent = '你可以自由切换功能开关。';
    lockStatusMeta.textContent = '';
    return;
  }

  lockStatusTitle.textContent = '当前已锁定';
  lockStatusReason.textContent = `锁定原因：${getLockReasonsSummary(lockStatus.reasons)}`;
  lockStatusMeta.textContent = lockStatus.nextUnlockAt
    ? `预计解锁时间：${formatDateTime(lockStatus.nextUnlockAt)}`
    : '预计解锁时间暂不可用';
}

function renderFocusSession(focusSession) {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }

  if (!focusSession.endsAt || focusSession.endsAt <= Date.now()) {
    focusSessionMeta.textContent = '当前没有进行中的专注倒计时。';
    stopFocusSession.style.display = 'none';
    customFocusMinutes.disabled = false;
    startCustomFocusButton.disabled = false;
    focusPresetButtons.forEach((button) => {
      button.disabled = false;
    });
    return;
  }

  stopFocusSession.style.display = 'block';
  customFocusMinutes.disabled = true;
  startCustomFocusButton.disabled = true;
  focusPresetButtons.forEach((button) => {
    button.disabled = true;
  });

  const updateRemaining = () => {
    const remainingMs = Math.max(0, focusSession.endsAt - Date.now());
    if (!remainingMs) {
      focusSessionMeta.textContent = '专注倒计时已结束。';
      stopFocusSession.style.display = 'none';
      clearInterval(countdownTimer);
      countdownTimer = null;
      return;
    }

    focusSessionMeta.textContent = `本次专注剩余 ${formatDurationMinutes(Math.ceil(remainingMs / 60000))}`;
  };

  updateRemaining();
  countdownTimer = window.setInterval(updateRemaining, 1000);
}

async function refreshPopupState() {
  const syncState = await chrome.storage.sync.get([...FEATURE_KEYS, 'appearanceConfig']);
  const appearanceConfig = ensureAppearanceConfig(syncState.appearanceConfig);

  applyTheme(appearanceConfig);
  await chrome.runtime.sendMessage({ type: 'BF_ENSURE_RUNTIME' }).catch(() => null);

  const localState = await chrome.storage.local.get(['effectiveFeatureState', 'lockStatus', 'focusSession']);

  const featurePreferences = ensureFeaturePreferences(syncState);
  const effectiveFeatureState = ensureEffectiveFeatureState(localState.effectiveFeatureState);
  latestLockStatus = ensureLockStatus(localState.lockStatus);
  latestFocusSession = ensureFocusSession(localState.focusSession);

  renderFeatureState(featurePreferences, effectiveFeatureState, latestLockStatus);
  renderLockStatus(latestLockStatus);
  renderFocusSession(latestFocusSession);
}

async function updatePreference(key, checked) {
  if (latestLockStatus.active) {
    refreshPopupState();
    return;
  }

  await chrome.storage.sync.set({ [key]: checked });
  refreshPopupState();
}

async function startFocusSession(minutes) {
  if (latestFocusSession.endsAt && latestFocusSession.endsAt > Date.now()) {
    refreshPopupState();
    return;
  }

  await chrome.runtime.sendMessage({ type: 'BF_START_FOCUS_SESSION', minutes });
  refreshPopupState();
}

async function stopFocus() {
  await chrome.runtime.sendMessage({ type: 'BF_STOP_FOCUS_SESSION' });
  refreshPopupState();
}

toggleRedirect.addEventListener('change', () => updatePreference('redirectEnabled', toggleRedirect.checked));
togglePlayer.addEventListener('change', () => updatePreference('playerMaskEnabled', togglePlayer.checked));
toggleAutoPlayOff.addEventListener('change', () => updatePreference('autoPlayOffEnabled', toggleAutoPlayOff.checked));
toggleSearch.addEventListener('change', () => updatePreference('searchMaskEnabled', toggleSearch.checked));

focusPresetButtons.forEach((button) => {
  button.addEventListener('click', () => startFocusSession(Number(button.dataset.minutes)));
});

startCustomFocusButton.addEventListener('click', () => {
  startFocusSession(Number(customFocusMinutes.value) || 45);
});

stopFocusSession.addEventListener('click', stopFocus);
openSettings.addEventListener('click', () => chrome.runtime.openOptionsPage());

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' || areaName === 'local') {
    if (
      changes.appearanceConfig ||
      changes.effectiveFeatureState ||
      changes.lockStatus ||
      changes.focusSession ||
      FEATURE_KEYS.some((key) => changes[key])
    ) {
      refreshPopupState();
    }
  }
});

refreshPopupState();
