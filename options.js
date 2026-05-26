const {
  DAY_LABELS,
  DEFAULT_LOCK_CONFIG,
  DEFAULT_APPEARANCE_CONFIG,
  ensureLockConfig,
  ensureAppearanceConfig,
  formatTimeInput,
  parseTimeInput,
  createWindowId
} = globalThis.BiliFocusShared;

const weeklyScheduleEnabled = document.getElementById('weeklyScheduleEnabled');
const weeklyWindowsList = document.getElementById('weeklyWindowsList');
const addWeeklyWindow = document.getElementById('addWeeklyWindow');
const dailyUsageEnabled = document.getElementById('dailyUsageEnabled');
const dailyUsageMinutes = document.getElementById('dailyUsageMinutes');
const dailyResetTime = document.getElementById('dailyResetTime');
const saveSettings = document.getElementById('saveSettings');
const saveHint = document.getElementById('saveHint');
const themeInputs = Array.from(document.querySelectorAll('input[name="themeMode"]'));

let workingConfig = ensureLockConfig(DEFAULT_LOCK_CONFIG);
let workingAppearance = ensureAppearanceConfig(DEFAULT_APPEARANCE_CONFIG);

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
}

function markDirty() {
  saveHint.textContent = '';
}

function createWindowRow(windowConfig) {
  const container = document.createElement('div');
  container.className = 'window-item';
  container.dataset.id = windowConfig.id;

  const weekdayField = document.createElement('label');
  weekdayField.className = 'field';
  weekdayField.innerHTML = '<span>星期</span>';
  const weekdaySelect = document.createElement('select');
  DAY_LABELS.forEach((label, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = label;
    option.selected = index === windowConfig.weekday;
    weekdaySelect.appendChild(option);
  });
  weekdayField.appendChild(weekdaySelect);

  const startField = document.createElement('label');
  startField.className = 'field';
  startField.innerHTML = '<span>开始时间</span>';
  const startInput = document.createElement('input');
  startInput.type = 'time';
  startInput.value = formatTimeInput(windowConfig.startMinutes);
  startField.appendChild(startInput);

  const endField = document.createElement('label');
  endField.className = 'field';
  endField.innerHTML = '<span>结束时间</span>';
  const endInput = document.createElement('input');
  endInput.type = 'time';
  endInput.value = formatTimeInput(windowConfig.endMinutes);
  endField.appendChild(endInput);

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'danger-button';
  removeButton.textContent = '删除';
  removeButton.addEventListener('click', () => {
    workingConfig.weeklyWindows = workingConfig.weeklyWindows.filter((item) => item.id !== windowConfig.id);
    renderWeeklyWindows();
  });

  weekdaySelect.addEventListener('change', () => {
    updateWindow(windowConfig.id, { weekday: Number(weekdaySelect.value) });
  });
  startInput.addEventListener('change', () => {
    updateWindow(windowConfig.id, { startMinutes: parseTimeInput(startInput.value) });
  });
  endInput.addEventListener('change', () => {
    updateWindow(windowConfig.id, { endMinutes: parseTimeInput(endInput.value) });
  });

  container.appendChild(weekdayField);
  container.appendChild(startField);
  container.appendChild(endField);
  container.appendChild(removeButton);

  return container;
}

function updateWindow(id, patch) {
  workingConfig.weeklyWindows = workingConfig.weeklyWindows.map((item) => {
    if (item.id !== id) return item;
    return { ...item, ...patch };
  });
}

function renderWeeklyWindows() {
  weeklyWindowsList.innerHTML = '';

  if (!workingConfig.weeklyWindows.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = '还没有固定时段，点击“新增时段”开始配置。';
    weeklyWindowsList.appendChild(empty);
    return;
  }

  workingConfig.weeklyWindows.forEach((windowConfig) => {
    weeklyWindowsList.appendChild(createWindowRow(windowConfig));
  });
}

function applyConfigToForm(config) {
  workingConfig = ensureLockConfig(config);
  weeklyScheduleEnabled.checked = workingConfig.weeklyScheduleEnabled;
  dailyUsageEnabled.checked = workingConfig.dailyUsageLimit.enabled;
  dailyUsageMinutes.value = String(workingConfig.dailyUsageLimit.limitMinutes);
  dailyResetTime.value = formatTimeInput(workingConfig.dailyUsageLimit.resetMinutesAfterMidnight);
  renderWeeklyWindows();
}

function applyAppearanceToForm(appearanceConfig) {
  workingAppearance = ensureAppearanceConfig(appearanceConfig);
  themeInputs.forEach((input) => {
    input.checked = input.value === workingAppearance.theme;
  });
  applyTheme(workingAppearance.theme);
}

function readConfigFromForm() {
  return ensureLockConfig({
    weeklyScheduleEnabled: weeklyScheduleEnabled.checked,
    weeklyWindows: workingConfig.weeklyWindows,
    dailyUsageLimit: {
      enabled: dailyUsageEnabled.checked,
      limitMinutes: Number(dailyUsageMinutes.value),
      resetMinutesAfterMidnight: parseTimeInput(dailyResetTime.value)
    }
  });
}

function readAppearanceFromForm() {
  const selected = themeInputs.find((input) => input.checked);
  return ensureAppearanceConfig({
    theme: selected ? selected.value : workingAppearance.theme
  });
}

async function loadConfig() {
  const { lockConfig, appearanceConfig } = await chrome.storage.sync.get(['lockConfig', 'appearanceConfig']);
  applyConfigToForm(lockConfig || DEFAULT_LOCK_CONFIG);
  applyAppearanceToForm(appearanceConfig || DEFAULT_APPEARANCE_CONFIG);
}

async function saveConfig() {
  const nextConfig = readConfigFromForm();
  const nextAppearance = readAppearanceFromForm();

  await chrome.storage.sync.set({
    lockConfig: nextConfig,
    appearanceConfig: nextAppearance
  });

  workingConfig = nextConfig;
  workingAppearance = nextAppearance;
  applyTheme(workingAppearance.theme);
  saveHint.textContent = `已保存 ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
}

addWeeklyWindow.addEventListener('click', () => {
  workingConfig.weeklyWindows.push({
    id: createWindowId(),
    weekday: 1,
    startMinutes: 540,
    endMinutes: 1080
  });
  renderWeeklyWindows();
});

themeInputs.forEach((input) => {
  input.addEventListener('change', () => {
    workingAppearance = readAppearanceFromForm();
    applyTheme(workingAppearance.theme);
    markDirty();
  });
});

saveSettings.addEventListener('click', saveConfig);
document.addEventListener('input', markDirty);
document.addEventListener('change', markDirty);

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'sync') return;

  if (changes.lockConfig) {
    applyConfigToForm(changes.lockConfig.newValue || DEFAULT_LOCK_CONFIG);
  }

  if (changes.appearanceConfig) {
    applyAppearanceToForm(changes.appearanceConfig.newValue || DEFAULT_APPEARANCE_CONFIG);
  }
});

loadConfig();
