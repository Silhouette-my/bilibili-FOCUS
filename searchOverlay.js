/* ====== 搜索页：空输入时隐藏历史/热搜下拉框 ====== */
//
// 目标：在 search.bilibili.com 上，当搜索框为空（或未开始输入）时，
//       隐藏"搜索历史"和"bilibili热搜"下拉面板（.recommend-list-v1）。
//       用户开始输入后，正常的自动补全建议仍然可以显示。
//
// 实现方式：
//   - 当输入为空时，注入一条 CSS 规则将 .recommend-list-v1 隐藏
//   - 当输入非空时，移除该 CSS 规则，还原浏览器默认行为
//   - 使用 MutationObserver 等待 SPA 渲染完成后再挂载

const STYLE_ID = 'bili-search-overlay-style';

function injectHideStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = '.recommend-list-v1 { display: none !important; }';
  document.head.appendChild(style);
}

function removeHideStyle() {
  const style = document.getElementById(STYLE_ID);
  if (style) style.remove();
}

function onSearchInput(e) {
  if (e.target.value.trim() === '') {
    injectHideStyle();
  } else {
    removeHideStyle();
  }
}

let _inputEl = null;

function mountSearchOverlay() {
  if (window.__biliSearchOverlayMounted) return;

  // 等待搜索框出现（SPA 页面可能尚未渲染）
  function tryMount() {
    const input = document.querySelector('input[class*="search-input"], input[placeholder*="关键字"]');
    if (!input) return;

    _inputEl = input;
    window.__biliSearchOverlayMounted = true;

    // 初始状态：输入框为空则隐藏
    if (input.value.trim() === '') {
      injectHideStyle();
    }

    input.addEventListener('input', onSearchInput);

    // 当输入框被清空（如点击 ✕）时也要隐藏
    input.addEventListener('change', onSearchInput);

    // 停止观察
    if (window.__biliSearchMO) {
      window.__biliSearchMO.disconnect();
      window.__biliSearchMO = null;
    }
  }

  tryMount();

  if (!window.__biliSearchOverlayMounted) {
    // SPA 尚未渲染，启动 MutationObserver 等待
    const mo = new MutationObserver(() => {
      tryMount();
    });
    mo.observe(document.body || document.documentElement, { childList: true, subtree: true });
    window.__biliSearchMO = mo;
  }
}

function unmountSearchOverlay() {
  removeHideStyle();

  if (_inputEl) {
    _inputEl.removeEventListener('input', onSearchInput);
    _inputEl.removeEventListener('change', onSearchInput);
    _inputEl = null;
  }

  if (window.__biliSearchMO) {
    window.__biliSearchMO.disconnect();
    window.__biliSearchMO = null;
  }

  window.__biliSearchOverlayMounted = false;
}

// 初始化
chrome.storage.sync.get('searchMaskEnabled', (data) => {
  if (data.searchMaskEnabled === false) return;
  mountSearchOverlay();
});

// 实时响应开关变化，无需刷新页面
chrome.storage.onChanged.addListener((changes) => {
  if (!('searchMaskEnabled' in changes)) return;
  if (changes.searchMaskEnabled.newValue === false) {
    unmountSearchOverlay();
  } else {
    mountSearchOverlay();
  }
});
