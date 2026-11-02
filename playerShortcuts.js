(function () {
  'use strict';

  const {
    PLAYER_SHORTCUT_ACTION_IDS,
    PLAYER_SHORTCUT_REPEATABLE_ACTIONS,
    ensurePlayerShortcutConfig,
    shortcutBindingMatchesEvent
  } = globalThis.BiliFocusShared;
  const backgroundClient = globalThis.BiliFocusClient;
  const PLAYER_SELECTORS = [
    '.bpx-player-container',
    '.bpx-player',
    '.bpx-player-video-wrap'
  ];
  const SPEED_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
  const SEEK_STEP_SECONDS = 5;
  const VOLUME_STEP = 0.1;
  const BRIGHTNESS_STEP = 0.1;
  const MIN_BRIGHTNESS = 0.5;
  const MAX_BRIGHTNESS = 2;
  const TOAST_DURATION_MS = 1600;
  const repeatableActions = new Set(PLAYER_SHORTCUT_REPEATABLE_ACTIONS);

  const controller = {
    active: false,
    config: ensurePlayerShortcutConfig(),
    unsubscribe: null,
    toast: null,
    toastTimer: null,
    onKeyDown: null,
    brightnessByVideo: new WeakMap()
  };

  function isVideoPage() {
    return location.hostname === 'www.bilibili.com' &&
      location.pathname.startsWith('/video/');
  }

  function getPlayerElement() {
    return PLAYER_SELECTORS
      .map((selector) => document.querySelector(selector))
      .find(Boolean) || null;
  }

  function getVideoElement(player) {
    return player && player.querySelector('video') || null;
  }

  function isEditableTarget(event) {
    const path = typeof event.composedPath === 'function'
      ? event.composedPath()
      : [event.target];
    return path.some((node) => {
      if (!node || node.nodeType !== 1) return false;
      const tagName = node.tagName && node.tagName.toLowerCase();
      return (
        tagName === 'input' ||
        tagName === 'textarea' ||
        tagName === 'select' ||
        node.isContentEditable ||
        node.getAttribute('role') === 'textbox'
      );
    });
  }

  function removeToast() {
    if (controller.toastTimer !== null) {
      window.clearTimeout(controller.toastTimer);
      controller.toastTimer = null;
    }
    if (controller.toast) {
      controller.toast.remove();
      controller.toast = null;
    }
  }

  function showToast(player, message, tone = 'normal') {
    if (!player || !document.documentElement) return;
    if (!controller.toast) {
      const toast = document.createElement('div');
      toast.id = 'bili-focus-shortcut-toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      Object.assign(toast.style, {
        position: 'fixed',
        zIndex: '1000002',
        maxWidth: 'min(360px, 80vw)',
        padding: '9px 14px',
        borderRadius: '999px',
        background: 'rgba(15, 18, 26, 0.88)',
        color: '#ffffff',
        fontSize: '14px',
        lineHeight: '1.4',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        textAlign: 'center',
        pointerEvents: 'none',
        transform: 'translate(-50%, -50%)',
        boxShadow: '0 12px 30px rgba(0, 0, 0, 0.3)'
      });
      document.documentElement.appendChild(toast);
      controller.toast = toast;
    }

    const rect = player.getBoundingClientRect();
    controller.toast.style.left = `${Math.max(20, Math.min(window.innerWidth - 20, rect.left + rect.width / 2))}px`;
    controller.toast.style.top = `${Math.max(20, Math.min(window.innerHeight - 20, rect.top + rect.height * 0.78))}px`;
    controller.toast.style.background = tone === 'error'
      ? 'rgba(160, 38, 71, 0.92)'
      : 'rgba(15, 18, 26, 0.88)';
    controller.toast.textContent = message;

    if (controller.toastTimer !== null) {
      window.clearTimeout(controller.toastTimer);
    }
    controller.toastTimer = window.setTimeout(removeToast, TOAST_DURATION_MS);
  }

  function requireVideo(player) {
    const video = getVideoElement(player);
    if (!video) {
      showToast(player, '未找到可操作的播放器', 'error');
      return null;
    }
    return video;
  }

  function togglePlay(player) {
    const video = requireVideo(player);
    if (!video) return;
    if (video.paused) {
      Promise.resolve()
        .then(() => video.play())
        .then(() => showToast(player, '继续播放'))
        .catch(() => showToast(player, '无法开始播放', 'error'));
    } else {
      video.pause();
      showToast(player, '已暂停');
    }
  }

  function seek(player, delta) {
    const video = requireVideo(player);
    if (!video) return;
    const currentTime = Number(video.currentTime) || 0;
    const duration = Number(video.duration);
    const upperBound = Number.isFinite(duration) && duration >= 0
      ? duration
      : Number.POSITIVE_INFINITY;
    video.currentTime = Math.min(upperBound, Math.max(0, currentTime + delta));
    showToast(player, delta > 0 ? '前进 5 秒' : '后退 5 秒');
  }

  function toggleMute(player) {
    const video = requireVideo(player);
    if (!video) return;
    video.muted = !video.muted;
    showToast(player, video.muted ? '已静音' : '已恢复声音');
  }

  function roundMediaStep(value) {
    return Math.round(value * 10) / 10;
  }

  function adjustVolume(player, direction) {
    const video = requireVideo(player);
    if (!video) return;
    const currentVolume = Number.isFinite(Number(video.volume))
      ? Number(video.volume)
      : 1;
    const targetVolume = Math.min(
      1,
      Math.max(0, roundMediaStep(currentVolume + direction * VOLUME_STEP))
    );
    video.volume = targetVolume;
    const mutedSuffix = video.muted ? '（当前静音）' : '';
    showToast(player, `音量 ${Math.round(targetVolume * 100)}%${mutedSuffix}`);
  }

  function getBrightnessState(video) {
    let state = controller.brightnessByVideo.get(video);
    if (!state) {
      state = {
        value: 1,
        baseFilter: typeof video.style.filter === 'string'
          ? video.style.filter.trim()
          : ''
      };
      controller.brightnessByVideo.set(video, state);
    }
    return state;
  }

  function adjustBrightness(player, direction) {
    const video = requireVideo(player);
    if (!video) return;
    const state = getBrightnessState(video);
    const targetBrightness = Math.min(
      MAX_BRIGHTNESS,
      Math.max(
        MIN_BRIGHTNESS,
        roundMediaStep(state.value + direction * BRIGHTNESS_STEP)
      )
    );
    state.value = targetBrightness;
    video.style.filter = targetBrightness === 1
      ? state.baseFilter
      : `${state.baseFilter} brightness(${targetBrightness})`.trim();
    showToast(player, `亮度 ${Math.round(targetBrightness * 100)}%`);
  }

  function getNextSpeed(currentRate, direction) {
    const current = Number(currentRate) || 1;
    if (direction > 0) {
      return SPEED_STEPS.find((rate) => rate > current + 0.001) ||
        SPEED_STEPS[SPEED_STEPS.length - 1];
    }
    return SPEED_STEPS.slice().reverse()
      .find((rate) => rate < current - 0.001) || SPEED_STEPS[0];
  }

  function setSpeed(player, targetRate) {
    const video = requireVideo(player);
    if (!video) return;
    const menuItem = Array.from(
      player.querySelectorAll('.bpx-player-ctrl-playbackrate-menu-item[data-value]')
    ).find((item) => Number(item.getAttribute('data-value')) === targetRate);

    if (menuItem) {
      menuItem.click();
    } else {
      video.playbackRate = targetRate;
    }
    showToast(player, `倍速 ${targetRate}×`);
  }

  function changeSpeed(player, direction) {
    const video = requireVideo(player);
    if (!video) return;
    setSpeed(player, getNextSpeed(video.playbackRate, direction));
  }

  function toggleSubtitle(player) {
    const subtitleControl = player.querySelector('.bpx-player-ctrl-subtitle');
    const closeSwitch = player.querySelector('.bpx-player-ctrl-subtitle-close-switch');
    const languageItems = Array.from(player.querySelectorAll(
      '.bpx-player-ctrl-subtitle-language-item'
    )).filter((item) => (
      item !== closeSwitch &&
      !item.classList.contains('bpx-player-ctrl-subtitle-language-unlogin')
    ));
    const loginRequired = player.querySelector(
      '.bpx-player-ctrl-subtitle-language-unlogin'
    );
    if (!subtitleControl || !closeSwitch) {
      showToast(player, '当前播放器不支持字幕切换', 'error');
      return;
    }

    const wasClosed = closeSwitch.classList.contains('bpx-state-active');
    if (wasClosed && !languageItems.length) {
      showToast(
        player,
        loginRequired ? '登录后才能使用字幕' : '当前视频没有可用字幕',
        'error'
      );
      return;
    }

    if (wasClosed) {
      languageItems[0].click();
    } else {
      closeSwitch.click();
    }
    showToast(player, wasClosed ? '字幕已开启' : '字幕已关闭');
  }

  function toggleDanmaku(player) {
    const switchRoot = player.querySelector('.bpx-player-dm-switch');
    const switchInput = switchRoot?.querySelector('.bui-danmaku-switch-input') ||
      player.querySelector('.bui-danmaku-switch-input');
    const control = switchInput || switchRoot;
    if (!control) {
      showToast(player, '当前播放器不支持弹幕切换', 'error');
      return;
    }

    const wasChecked = switchInput && typeof switchInput.checked === 'boolean'
      ? switchInput.checked
      : null;
    control.click();
    showToast(
      player,
      wasChecked === null
        ? '已切换弹幕显示'
        : (wasChecked ? '弹幕已关闭' : '弹幕已开启')
    );
  }

  function clickControl(player, selector, successMessage, unavailableMessage) {
    const control = player.querySelector(selector);
    if (!control) {
      showToast(player, unavailableMessage, 'error');
      return;
    }
    control.click();
    showToast(player, successMessage);
  }

  const ACTION_HANDLERS = Object.freeze({
    togglePlay,
    seekBackward: (player) => seek(player, -SEEK_STEP_SECONDS),
    seekForward: (player) => seek(player, SEEK_STEP_SECONDS),
    toggleMute,
    volumeDown: (player) => adjustVolume(player, -1),
    volumeUp: (player) => adjustVolume(player, 1),
    brightnessDown: (player) => adjustBrightness(player, -1),
    brightnessUp: (player) => adjustBrightness(player, 1),
    speedDown: (player) => changeSpeed(player, -1),
    speedUp: (player) => changeSpeed(player, 1),
    speedReset: (player) => setSpeed(player, 1),
    toggleSubtitle,
    toggleDanmaku,
    toggleWebFullscreen: (player) => clickControl(
      player,
      '.bpx-player-ctrl-web',
      '已切换网页全屏',
      '当前播放器不支持网页全屏'
    ),
    toggleFullscreen: (player) => clickControl(
      player,
      '.bpx-player-ctrl-full',
      '已切换全屏',
      '当前播放器不支持全屏'
    )
  });

  function findBoundAction(event) {
    return PLAYER_SHORTCUT_ACTION_IDS.find((actionId) => (
      shortcutBindingMatchesEvent(controller.config.bindings[actionId], event)
    )) || null;
  }

  function handleKeyDown(event) {
    if (
      !isVideoPage() ||
      !controller.config.enabled ||
      event.isComposing ||
      event.keyCode === 229 ||
      isEditableTarget(event)
    ) {
      return;
    }

    const actionId = findBoundAction(event);
    if (!actionId) return;

    const player = getPlayerElement();
    if (!player) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.repeat && !repeatableActions.has(actionId)) return;
    try {
      ACTION_HANDLERS[actionId](player);
    } catch (error) {
      showToast(player, '播放器操作失败', 'error');
    }
  }

  function applySnapshot(snapshot) {
    controller.config = ensurePlayerShortcutConfig(
      snapshot && snapshot.playerShortcutConfig
    );
  }

  function start() {
    if (controller.active) return;
    controller.active = true;
    controller.onKeyDown = handleKeyDown;
    window.addEventListener('keydown', controller.onKeyDown, true);
    controller.unsubscribe = backgroundClient.subscribe(applySnapshot);
    backgroundClient.getState({ refresh: true }).then(applySnapshot).catch(() => null);
  }

  function stop() {
    if (!controller.active) return;
    controller.active = false;
    window.removeEventListener('keydown', controller.onKeyDown, true);
    controller.onKeyDown = null;
    if (controller.unsubscribe) {
      controller.unsubscribe();
      controller.unsubscribe = null;
    }
    removeToast();
  }

  window.addEventListener('pagehide', stop);
  window.addEventListener('pageshow', start);
  start();
})();
