const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = fs.readFileSync(path.join(ROOT, 'dynamicHotSearch.js'), 'utf8');

function createEventTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, []);
      if (!listeners.get(type).includes(listener)) listeners.get(type).push(listener);
    },
    dispatch(type) {
      for (const listener of [...(listeners.get(type) || [])]) listener({});
    }
  };
}

class FakeElement {
  constructor(tagName) {
    this.tagName = String(tagName).toUpperCase();
    this.parentNode = null;
    this.children = [];
    this.id = '';
    this.textContent = '';
  }

  get isConnected() {
    return Boolean(this.parentNode);
  }

  appendChild(child) {
    if (child.parentNode) child.remove();
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
    this.parentNode = null;
  }
}

class FakeDocument {
  constructor() {
    this.head = new FakeElement('head');
  }

  createElement(tagName) {
    return new FakeElement(tagName);
  }

  getElementById(id) {
    return this.head.children.find((child) => child.id === id) || null;
  }
}

function createClient(initialEnabled) {
  let enabled = initialEnabled;
  const subscribers = new Set();
  const snapshot = () => ({
    effectiveFeatureState: { searchMaskEnabled: enabled }
  });
  return {
    async getState() {
      return snapshot();
    },
    getCachedState() {
      return snapshot();
    },
    subscribe(listener) {
      subscribers.add(listener);
      return () => subscribers.delete(listener);
    },
    publish(nextEnabled) {
      enabled = nextEnabled;
      subscribers.forEach((listener) => listener(snapshot()));
    },
    subscriberCount() {
      return subscribers.size;
    }
  };
}

async function createHarness(initialEnabled, hostname = 't.bilibili.com') {
  const events = createEventTarget();
  const document = new FakeDocument();
  const client = createClient(initialEnabled);
  const context = vm.createContext({
    console,
    document,
    location: { hostname },
    Promise,
    BiliFocusClient: client,
    window: {
      addEventListener: events.addEventListener
    }
  });
  vm.runInContext(SOURCE, context, { filename: 'dynamicHotSearch.js' });
  await new Promise((resolve) => setImmediate(resolve));
  return {
    client,
    document,
    events,
    async settle() {
      await new Promise((resolve) => setImmediate(resolve));
    },
    styles() {
      return document.head.children.filter((child) => child.tagName === 'STYLE');
    }
  };
}

test('dynamic hot search style is precise, switchable, and idempotent', async () => {
  const harness = await createHarness(true);
  assert.equal(harness.styles().length, 1);
  assert.match(harness.styles()[0].textContent, /\.bili-dyn-search-trendings/);
  assert.doesNotMatch(harness.styles()[0].textContent, /\.right\s*\{/);

  harness.client.publish(true);
  assert.equal(harness.styles().length, 1);
  harness.client.publish(false);
  assert.equal(harness.styles().length, 0);
  harness.client.publish(true);
  assert.equal(harness.styles().length, 1);
});

test('dynamic hot search style cleans up for BFCache and restores current state', async () => {
  const harness = await createHarness(true);
  assert.equal(harness.client.subscriberCount(), 1);

  harness.events.dispatch('pagehide');
  assert.equal(harness.styles().length, 0);
  assert.equal(harness.client.subscriberCount(), 0);

  harness.events.dispatch('pageshow');
  await harness.settle();
  assert.equal(harness.styles().length, 1);
  assert.equal(harness.client.subscriberCount(), 1);
});

test('dynamic hot search controller stays inert outside t.bilibili.com', async () => {
  const harness = await createHarness(true, 'www.bilibili.com');
  assert.equal(harness.styles().length, 0);
  assert.equal(harness.client.subscriberCount(), 0);
});
