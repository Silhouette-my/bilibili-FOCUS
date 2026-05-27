(function (global) {
  const FEATURE_KEYS = [
    'redirectEnabled',
    'playerMaskEnabled',
    'autoPlayOffEnabled',
    'searchMaskEnabled'
  ];

  const DEFAULT_FEATURE_PREFERENCES = {
    redirectEnabled: true,
    playerMaskEnabled: true,
    autoPlayOffEnabled: true,
    searchMaskEnabled: true
  };

  const DEFAULT_LOCK_CONFIG = {
    weeklyScheduleEnabled: false,
    weeklyWindows: [],
    dailyUsageLimit: {
      enabled: false,
      limitMinutes: 120,
      resetMinutesAfterMidnight: 240
    }
  };

  const DEFAULT_APPEARANCE_CONFIG = {
    theme: 'light'
  };

  const DEFAULT_FOCUS_SESSION = {
    endsAt: null,
    startedAt: null
  };

  const DEFAULT_USAGE_STATE = {
    dayKey: '',
    accumulatedMs: 0,
    exceeded: false,
    limitExceededAt: null,
    lastPingByTab: {}
  };

  const DEFAULT_LOCK_STATUS = {
    active: false,
    reasons: [],
    nextUnlockAt: null,
    lockedBySchedule: false,
    lockedByFocusSession: false,
    lockedByDailyLimit: false,
    updatedAt: null
  };

  const DEFAULT_EFFECTIVE_FEATURE_STATE = { ...DEFAULT_FEATURE_PREFERENCES };

  const DAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  const REDIRECT_WHITELIST_HOSTS = [
    'search.bilibili.com',
    'passport.bilibili.com',
    'message.bilibili.com',
    'account.bilibili.com',
    'space.bilibili.com',
    'live.bilibili.com',
    'api.bilibili.com',
    'api.vc.bilibili.com',
    'pay.bilibili.com',
    't.bilibili.com'
  ];

  function clampNumber(value, min, max, fallback) {
    const num = Number(value);
    if (Number.isNaN(num)) return fallback;
    return Math.min(max, Math.max(min, num));
  }

  function ensureFeaturePreferences(raw) {
    const next = { ...DEFAULT_FEATURE_PREFERENCES };
    const source = raw || {};

    FEATURE_KEYS.forEach((key) => {
      if (typeof source[key] === 'boolean') {
        next[key] = source[key];
      }
    });

    return next;
  }

  function normalizeWeeklyWindow(rawWindow, index) {
    const source = rawWindow || {};
    return {
      id: typeof source.id === 'string' && source.id ? source.id : `window-${index}-${Date.now()}`,
      weekday: clampNumber(source.weekday, 0, 6, 1),
      startMinutes: clampNumber(source.startMinutes, 0, 1439, 540),
      endMinutes: clampNumber(source.endMinutes, 0, 1439, 1080)
    };
  }

  function ensureLockConfig(raw) {
    const source = raw || {};
    const dailySource = source.dailyUsageLimit || {};

    return {
      weeklyScheduleEnabled: Boolean(source.weeklyScheduleEnabled),
      weeklyWindows: Array.isArray(source.weeklyWindows)
        ? source.weeklyWindows.map(normalizeWeeklyWindow)
        : [],
      dailyUsageLimit: {
        enabled: Boolean(dailySource.enabled),
        limitMinutes: clampNumber(dailySource.limitMinutes, 1, 24 * 60, 120),
        resetMinutesAfterMidnight: clampNumber(dailySource.resetMinutesAfterMidnight, 0, 1439, 240)
      }
    };
  }

  function ensureFocusSession(raw) {
    const source = raw || {};
    const endsAt = Number(source.endsAt);
    const startedAt = Number(source.startedAt);

    return {
      endsAt: Number.isFinite(endsAt) ? endsAt : null,
      startedAt: Number.isFinite(startedAt) ? startedAt : null
    };
  }

  function ensureAppearanceConfig(raw) {
    const source = raw || {};
    const theme = source.theme === 'dark' ? 'dark' : 'light';

    return { theme };
  }

  function ensureUsageState(raw) {
    const source = raw || {};
    return {
      dayKey: typeof source.dayKey === 'string' ? source.dayKey : '',
      accumulatedMs: Math.max(0, Number(source.accumulatedMs) || 0),
      exceeded: Boolean(source.exceeded),
      limitExceededAt: Number.isFinite(Number(source.limitExceededAt)) ? Number(source.limitExceededAt) : null,
      lastPingByTab: source.lastPingByTab && typeof source.lastPingByTab === 'object' ? source.lastPingByTab : {}
    };
  }

  function ensureLockStatus(raw) {
    const source = raw || {};
    return {
      active: Boolean(source.active),
      reasons: Array.isArray(source.reasons) ? source.reasons.slice() : [],
      nextUnlockAt: Number.isFinite(Number(source.nextUnlockAt)) ? Number(source.nextUnlockAt) : null,
      lockedBySchedule: Boolean(source.lockedBySchedule),
      lockedByFocusSession: Boolean(source.lockedByFocusSession),
      lockedByDailyLimit: Boolean(source.lockedByDailyLimit),
      updatedAt: Number.isFinite(Number(source.updatedAt)) ? Number(source.updatedAt) : null
    };
  }

  function ensureEffectiveFeatureState(raw) {
    return ensureFeaturePreferences(raw);
  }

  function getMinutesOfDay(date) {
    return date.getHours() * 60 + date.getMinutes();
  }

  function parseTimeInput(value) {
    if (typeof value !== 'string' || !value.includes(':')) return 0;
    const [hours, minutes] = value.split(':').map((part) => Number(part));
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0;
    return clampNumber(hours * 60 + minutes, 0, 1439, 0);
  }

  function formatTimeInput(minutes) {
    const safe = clampNumber(minutes, 0, 1439, 0);
    const hours = String(Math.floor(safe / 60)).padStart(2, '0');
    const mins = String(safe % 60).padStart(2, '0');
    return `${hours}:${mins}`;
  }

  function getLogicalDayStart(date, resetMinutesAfterMidnight) {
    const start = new Date(date);
    start.setSeconds(0, 0);
    start.setHours(0, 0, 0, 0);
    start.setMinutes(resetMinutesAfterMidnight);

    if (date.getTime() < start.getTime()) {
      start.setDate(start.getDate() - 1);
    }

    return start;
  }

  function getLogicalDayInfo(date, resetMinutesAfterMidnight) {
    const dayStart = getLogicalDayStart(date, resetMinutesAfterMidnight);
    const nextReset = new Date(dayStart);
    nextReset.setDate(nextReset.getDate() + 1);

    const dayKey = [
      dayStart.getFullYear(),
      String(dayStart.getMonth() + 1).padStart(2, '0'),
      String(dayStart.getDate()).padStart(2, '0')
    ].join('-');

    return {
      dayKey,
      dayStart,
      nextResetAt: nextReset.getTime()
    };
  }

  function isWeeklyWindowActiveAt(date, windowConfig) {
    const weekday = date.getDay();
    const minutes = getMinutesOfDay(date);

    if (windowConfig.endMinutes > windowConfig.startMinutes) {
      return (
        weekday === windowConfig.weekday &&
        minutes >= windowConfig.startMinutes &&
        minutes < windowConfig.endMinutes
      );
    }

    const nextDay = (windowConfig.weekday + 1) % 7;
    return (
      (weekday === windowConfig.weekday && minutes >= windowConfig.startMinutes) ||
      (weekday === nextDay && minutes < windowConfig.endMinutes)
    );
  }

  function getActiveWeeklyWindows(date, windows) {
    return windows.filter((windowConfig) => isWeeklyWindowActiveAt(date, windowConfig));
  }

  function buildWindowOccurrences(fromDate, windows, daysAhead) {
    const items = [];
    const startDate = new Date(fromDate);
    startDate.setHours(0, 0, 0, 0);

    for (let offset = 0; offset <= daysAhead; offset += 1) {
      const baseDate = new Date(startDate);
      baseDate.setDate(baseDate.getDate() + offset);
      const weekday = baseDate.getDay();

      windows.forEach((windowConfig) => {
        if (windowConfig.weekday !== weekday) return;

        const start = new Date(baseDate);
        start.setMinutes(windowConfig.startMinutes);

        const end = new Date(baseDate);
        if (windowConfig.endMinutes > windowConfig.startMinutes) {
          end.setMinutes(windowConfig.endMinutes);
        } else {
          end.setDate(end.getDate() + 1);
          end.setMinutes(windowConfig.endMinutes);
        }

        items.push(start.getTime(), end.getTime());
      });
    }

    return items;
  }

  function getUpcomingScheduleChanges(date, windows, daysAhead) {
    return buildWindowOccurrences(date, windows, daysAhead)
      .filter((time) => time > date.getTime())
      .sort((a, b) => a - b);
  }

  function getNextScheduleChangeAt(date, windows) {
    const futureTimes = getUpcomingScheduleChanges(date, windows, 8);

    return futureTimes.length ? futureTimes[0] : null;
  }

  function computeEffectiveFeatureState(featurePreferences, lockActive) {
    if (!lockActive) return { ...featurePreferences };

    return FEATURE_KEYS.reduce((accumulator, key) => {
      accumulator[key] = true;
      return accumulator;
    }, {});
  }

  function getLockReasonsSummary(reasons) {
    const labels = {
      schedule: '固定时段',
      focus: '专注倒计时',
      dailyLimit: '累计使用超时'
    };

    return reasons.map((reason) => labels[reason] || reason).join('、');
  }

  function formatDateTime(value) {
    if (!value) return '未设置';
    const date = new Date(value);
    return [
      `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`,
      `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
    ].join(' ');
  }

  function formatDurationMinutes(minutes) {
    const totalMinutes = Math.max(0, Math.round(minutes));
    const hours = Math.floor(totalMinutes / 60);
    const remainMinutes = totalMinutes % 60;

    if (hours && remainMinutes) return `${hours}小时${remainMinutes}分钟`;
    if (hours) return `${hours}小时`;
    return `${remainMinutes}分钟`;
  }

  function createWindowId() {
    return `window-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  }

  function isRedirectCandidateUrl(rawUrl) {
    try {
      const url = new URL(rawUrl);
      const host = url.hostname;
      const pathname = url.pathname;

      if (!host.endsWith('bilibili.com')) return false;
      if (REDIRECT_WHITELIST_HOSTS.includes(host)) return false;
      if (
        pathname.startsWith('/video/') ||
        pathname.startsWith('/bangumi/play/') ||
        pathname.startsWith('/bangumi/media/') ||
        pathname.startsWith('/list/') ||
        pathname.startsWith('/medialist/')
      ) return false;

      return true;
    } catch (error) {
      return false;
    }
  }

  function getDefaultSyncState() {
    return {
      ...DEFAULT_FEATURE_PREFERENCES,
      lockConfig: { ...DEFAULT_LOCK_CONFIG },
      appearanceConfig: { ...DEFAULT_APPEARANCE_CONFIG }
    };
  }

  global.BiliFocusShared = {
    FEATURE_KEYS,
    DAY_LABELS,
    DEFAULT_FEATURE_PREFERENCES,
    DEFAULT_LOCK_CONFIG,
    DEFAULT_APPEARANCE_CONFIG,
    DEFAULT_FOCUS_SESSION,
    DEFAULT_USAGE_STATE,
    DEFAULT_LOCK_STATUS,
    DEFAULT_EFFECTIVE_FEATURE_STATE,
    REDIRECT_WHITELIST_HOSTS,
    ensureFeaturePreferences,
    ensureLockConfig,
    ensureFocusSession,
    ensureAppearanceConfig,
    ensureUsageState,
    ensureLockStatus,
    ensureEffectiveFeatureState,
    parseTimeInput,
    formatTimeInput,
    formatDateTime,
    formatDurationMinutes,
    getMinutesOfDay,
    getLogicalDayInfo,
    getActiveWeeklyWindows,
    getUpcomingScheduleChanges,
    getNextScheduleChangeAt,
    computeEffectiveFeatureState,
    getLockReasonsSummary,
    createWindowId,
    isRedirectCandidateUrl,
    getDefaultSyncState
  };
})(globalThis);
