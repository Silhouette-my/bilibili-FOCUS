const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

test('blur and pagehide end an activity interval, refocus starts a fresh one', () => {
  const listeners = new Map();
  const addEventListener = (name, listener) => {
    const handlers = listeners.get(name) || [];
    handlers.push(listener);
    listeners.set(name, handlers);
  };
  let focused = true;
  let activeTimers = 0;
  const pings = [];
  const context = vm.createContext({
    document: { visibilityState: 'visible', hasFocus: () => focused, addEventListener },
    window: { addEventListener, setInterval: () => { activeTimers++; return 1; }, clearInterval: () => { activeTimers--; } },
    BiliFocusClient: { activityPing: async (final) => { pings.push(final); }, ensureRuntime: async () => {} },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../redirect.js'), 'utf8'), context);
  const emit = (name) => listeners.get(name).forEach((listener) => listener({ persisted: true }));
  assert.deepEqual(pings, [false]);
  focused = false;
  emit('blur');
  assert.deepEqual(pings, [false, true]);
  assert.equal(activeTimers, 0);
  focused = true;
  emit('focus');
  assert.deepEqual(pings, [false, true, false]);
  emit('pagehide');
  assert.deepEqual(pings, [false, true, false, true]);
  assert.equal(activeTimers, 0);
});
