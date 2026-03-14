document.addEventListener('DOMContentLoaded', () => {
  const toggleRedirect = document.getElementById('toggleRedirect');
  const togglePlayer = document.getElementById('togglePlayer');
  const toggleSearch = document.getElementById('toggleSearch');

  // 从 storage 读取状态
  chrome.storage.sync.get(['redirectEnabled', 'playerMaskEnabled', 'searchMaskEnabled'], (data) => {
    toggleRedirect.checked = data.redirectEnabled !== false; // 默认启用
    togglePlayer.checked = data.playerMaskEnabled !== false; // 默认启用
    toggleSearch.checked = data.searchMaskEnabled !== false; // 默认启用
  });

  // 保存状态
  toggleRedirect.addEventListener('change', () => {
    chrome.storage.sync.set({ redirectEnabled: toggleRedirect.checked });
  });
  togglePlayer.addEventListener('change', () => {
    chrome.storage.sync.set({ playerMaskEnabled: togglePlayer.checked });
  });
  toggleSearch.addEventListener('change', () => {
    chrome.storage.sync.set({ searchMaskEnabled: toggleSearch.checked });
  });
});