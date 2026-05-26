importScripts('lockShared.js');

const {
  FEATURE_KEYS,
  DEFAULT_FEATURE_PREFERENCES,
  DEFAULT_LOCK_CONFIG,
  DEFAULT_APPEARANCE_CONFIG,
  DEFAULT_FOCUS_SESSION,
  DEFAULT_USAGE_STATE,
  DEFAULT_LOCK_STATUS,
  ensureFeaturePreferences,
  ensureLockConfig,
  ensureAppearanceConfig,
  ensureFocusSession,
  ensureUsageState,
  getLogicalDayInfo,
  getActiveWeeklyWindows,
  getUpcomingScheduleChanges,
  getNextScheduleChangeAt,
  computeEffectiveFeatureState,
  isRedirectCandidateUrl
} = globalThis.BiliFocusShared;

const LOCAL_KEYS = ['effectiveFeatureState', 'lockStatus', 'focusSession', 'usageState'];
const SYNC_KEYS = [...FEATURE_KEYS, 'lockConfig', 'appearanceConfig'];
const EVALUATE_ALARM = 'bili-focus-evaluate';

async function ensureDefaults() {
  const syncState = await chrome.storage.sync.get(SYNC_KEYS);
  const syncUpdates = {};

  FEATURE_KEYS.forEach((key) => {
    if (typeof syncState[key] !== 'boolean') {
      syncUpdates[key] = DEFAULT_FEATURE_PREFERENCES[key];
    }
  });

  if (!syncState.lockConfig) {
    syncUpdates.lockConfig = DEFAULT_LOCK_CONFIG;
  }

  const appearanceConfig = ensureAppearanceConfig(syncState.appearanceConfig);
  if (!syncState.appearanceConfig || syncState.appearanceConfig.theme !== appearanceConfig.theme) {
    syncUpdates.appearanceConfig = appearanceConfig || DEFAULT_APPEARANCE_CONFIG;
  }

  if (Object.keys(syncUpdates).length) {
    await chrome.storage.sync.set(syncUpdates);
  }

  const localState = await chrome.storage.local.get(LOCAL_KEYS);
  const localUpdates = {};

  if (!localState.effectiveFeatureState) {
    localUpdates.effectiveFeatureState = DEFAULT_FEATURE_PREFERENCES;
  }
  if (!localState.lockStatus) {
    localUpdates.lockStatus = DEFAULT_LOCK_STATUS;
  }
  if (!localState.focusSession) {
    localUpdates.focusSession = DEFAULT_FOCUS_SESSION;
  }
  if (!localState.usageState) {
    localUpdates.usageState = DEFAULT_USAGE_STATE;
  }

  if (Object.keys(localUpdates).length) {
    await chrome.storage.local.set(localUpdates);
  }
}

async function ensureAlarm() {
  const alarm = await chrome.alarms.get(EVALUATE_ALARM);
  if (!alarm) {
    await chrome.alarms.create(EVALUATE_ALARM, { periodInMinutes: 1 });
  }
}

function getFocusSessionActive(now, focusSession) {
  return Boolean(focusSession.endsAt && focusSession.endsAt > now.getTime());
}

function getDailyExceeded(now, usageState, lockConfig) {
  if (!lockConfig.dailyUsageLimit.enabled) return false;

  const info = getLogicalDayInfo(now, lockConfig.dailyUsageLimit.resetMinutesAfterMidnight);
  if (usageState.dayKey !== info.dayKey) return false;

  return usageState.accumulatedMs >= lockConfig.dailyUsageLimit.limitMinutes * 60 * 1000;
}

function computeNextUnlockAt(now, context) {
  const candidates = [];

  if (context.focusActive && context.focusSession.endsAt) {
    candidates.push(context.focusSession.endsAt);
  }

  if (context.dailyExceeded) {
    candidates.push(context.dailyInfo.nextResetAt);
  }

  if (context.scheduleActive) {
    candidates.push(...getUpcomingScheduleChanges(now, context.lockConfig.weeklyWindows, 8));
  }

  if (!candidates.length) return null;

  const sorted = candidates
    .filter((value) => value > now.getTime())
    .sort((a, b) => a - b);

  for (let i = 0; i < sorted.length; i += 1) {
    const probe = new Date(sorted[i] + 1000);
    const stillScheduled = context.lockConfig.weeklyScheduleEnabled &&
      getActiveWeeklyWindows(probe, context.lockConfig.weeklyWindows).length > 0;
    const stillFocused = Boolean(context.focusSession.endsAt && context.focusSession.endsAt > probe.getTime());
    const stillDailyExceeded = context.dailyExceeded && probe.getTime() < context.dailyInfo.nextResetAt;

    if (!stillScheduled && !stillFocused && !stillDailyExceeded) {
      return sorted[i];
    }
  }

  return sorted.length ? sorted[sorted.length - 1] : null;
}

function pruneUsageState(now, usageState, resetMinutesAfterMidnight) {
  const dailyInfo = getLogicalDayInfo(now, resetMinutesAfterMidnight);
  const nextUsageState = ensureUsageState(usageState);

  if (nextUsageState.dayKey !== dailyInfo.dayKey) {
    return {
      usageState: {
        dayKey: dailyInfo.dayKey,
        accumulatedMs: 0,
        exceeded: false,
        limitExceededAt: null,
        lastPingByTab: {}
      },
      dailyInfo
    };
  }

  Object.keys(nextUsageState.lastPingByTab).forEach((tabId) => {
    const lastPing = Number(nextUsageState.lastPingByTab[tabId]);
    if (!Number.isFinite(lastPing) || now.getTime() - lastPing > 60 * 1000) {
      delete nextUsageState.lastPingByTab[tabId];
    }
  });

  return {
    usageState: nextUsageState,
    dailyInfo
  };
}

async function refreshRuntimeState(options = {}) {
  await ensureDefaults();
  await ensureAlarm();

  const [syncState, localState] = await Promise.all([
    chrome.storage.sync.get(SYNC_KEYS),
    chrome.storage.local.get(LOCAL_KEYS)
  ]);

  const featurePreferences = ensureFeaturePreferences(syncState);
  const lockConfig = ensureLockConfig(syncState.lockConfig);
  const focusSession = ensureFocusSession(localState.focusSession);
  const previousEffective = localState.effectiveFeatureState || DEFAULT_FEATURE_PREFERENCES;
  const previousLockStatus = localState.lockStatus || DEFAULT_LOCK_STATUS;

  const now = new Date();
  const { usageState, dailyInfo } = pruneUsageState(
    now,
    localState.usageState,
    lockConfig.dailyUsageLimit.resetMinutesAfterMidnight
  );

  const activeWeeklyWindows = lockConfig.weeklyScheduleEnabled
    ? getActiveWeeklyWindows(now, lockConfig.weeklyWindows)
    : [];

  const scheduleActive = activeWeeklyWindows.length > 0;
  const focusActive = getFocusSessionActive(now, focusSession);
  const dailyExceeded = getDailyExceeded(now, usageState, lockConfig);

  const reasons = [];
  if (scheduleActive) reasons.push('schedule');
  if (focusActive) reasons.push('focus');
  if (dailyExceeded) reasons.push('dailyLimit');

  const lockActive = reasons.length > 0;
  const lockStatus = {
    active: lockActive,
    reasons,
    nextUnlockAt: computeNextUnlockAt(now, {
      focusActive,
      focusSession,
      dailyExceeded,
      dailyInfo,
      scheduleActive,
      lockConfig
    }),
    lockedBySchedule: scheduleActive,
    lockedByFocusSession: focusActive,
    lockedByDailyLimit: dailyExceeded,
    updatedAt: now.getTime()
  };

  const effectiveFeatureState = computeEffectiveFeatureState(featurePreferences, lockActive);

  if (lockConfig.dailyUsageLimit.enabled && dailyExceeded && !usageState.exceeded) {
    usageState.exceeded = true;
    usageState.limitExceededAt = now.getTime();
  }

  await chrome.storage.local.set({
    effectiveFeatureState,
    lockStatus,
    focusSession: focusActive ? focusSession : { ...DEFAULT_FOCUS_SESSION },
    usageState
  });

  if (
    options.reloadRedirectTabs &&
    previousEffective.redirectEnabled === false &&
    effectiveFeatureState.redirectEnabled === true
  ) {
    await reloadRedirectCandidateTabs();
  }

  if (
    options.reloadRedirectTabs &&
    previousLockStatus.active === false &&
    lockStatus.active === true &&
    effectiveFeatureState.redirectEnabled
  ) {
    await reloadRedirectCandidateTabs();
  }

  return {
    effectiveFeatureState,
    lockStatus,
    usageState
  };
}

async function reloadRedirectCandidateTabs() {
  const tabs = await chrome.tabs.query({ url: ['*://*.bilibili.com/*'] });

  await Promise.all(
    tabs
      .filter((tab) => tab.id && tab.url && isRedirectCandidateUrl(tab.url))
      .map((tab) => chrome.tabs.reload(tab.id).catch(() => null))
  );
}

async function startFocusSession(minutes) {
  const safeMinutes = Math.min(24 * 60, Math.max(1, Number(minutes) || 0));
  const now = Date.now();
  const { focusSession: rawFocusSession } = await chrome.storage.local.get(['focusSession']);
  const focusSession = ensureFocusSession(rawFocusSession);

  if (focusSession.endsAt && focusSession.endsAt > now) {
    return refreshRuntimeState({ reloadRedirectTabs: false });
  }

  await chrome.storage.local.set({
    focusSession: {
      startedAt: now,
      endsAt: now + safeMinutes * 60 * 1000
    }
  });

  return refreshRuntimeState({ reloadRedirectTabs: true });
}

async function stopFocusSession() {
  await chrome.storage.local.set({ focusSession: { ...DEFAULT_FOCUS_SESSION } });
  return refreshRuntimeState({ reloadRedirectTabs: false });
}

async function recordActivityPing(sender) {
  const tabId = sender.tab && sender.tab.id;
  if (typeof tabId !== 'number') return refreshRuntimeState({ reloadRedirectTabs: false });

  const [syncState, localState] = await Promise.all([
    chrome.storage.sync.get(['lockConfig']),
    chrome.storage.local.get(['usageState'])
  ]);

  const lockConfig = ensureLockConfig(syncState.lockConfig);
  const now = new Date();
  const { usageState, dailyInfo } = pruneUsageState(
    now,
    localState.usageState,
    lockConfig.dailyUsageLimit.resetMinutesAfterMidnight
  );

  const lastPing = Number(usageState.lastPingByTab[tabId]);
  let deltaMs = 0;
  if (Number.isFinite(lastPing)) {
    deltaMs = Math.min(Math.max(0, now.getTime() - lastPing), 30 * 1000);
  }

  usageState.dayKey = dailyInfo.dayKey;
  usageState.lastPingByTab[tabId] = now.getTime();
  usageState.accumulatedMs += deltaMs;

  if (
    lockConfig.dailyUsageLimit.enabled &&
    usageState.accumulatedMs >= lockConfig.dailyUsageLimit.limitMinutes * 60 * 1000
  ) {
    usageState.exceeded = true;
    if (!usageState.limitExceededAt) {
      usageState.limitExceededAt = now.getTime();
    }
  }

  await chrome.storage.local.set({ usageState });
  return refreshRuntimeState({ reloadRedirectTabs: true });
}

chrome.runtime.onInstalled.addListener(() => {
  refreshRuntimeState({ reloadRedirectTabs: false });
});

chrome.runtime.onStartup.addListener(() => {
  refreshRuntimeState({ reloadRedirectTabs: false });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === EVALUATE_ALARM) {
    refreshRuntimeState({ reloadRedirectTabs: false });
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync') {
    if (SYNC_KEYS.some((key) => Object.prototype.hasOwnProperty.call(changes, key))) {
      refreshRuntimeState({ reloadRedirectTabs: true });
    }
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== 'object') return undefined;

  if (message.type === 'BF_ENSURE_RUNTIME') {
    refreshRuntimeState({ reloadRedirectTabs: false })
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === 'BF_START_FOCUS_SESSION') {
    startFocusSession(message.minutes)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === 'BF_STOP_FOCUS_SESSION') {
    stopFocusSession()
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === 'BF_ACTIVITY_PING') {
    recordActivityPing(sender)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  return undefined;
});

refreshRuntimeState({ reloadRedirectTabs: false });
