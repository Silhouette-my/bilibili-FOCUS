function tryRedirect() {
  const host = window.location.hostname;
  const pathname = window.location.pathname;

  // 【核心功能保护白名单】
  // 避免插件把必要的系统页面也重定向了，导致网站无法正常使用
  const whitelistHosts = [
    'search.bilibili.com',   // 搜索页本身（重定向目标，必须放行）
    'passport.bilibili.com', // 登录认证页
    'message.bilibili.com',  // 消息中心
    'account.bilibili.com',  // 账户中心
    'space.bilibili.com',    // 个人空间
    'live.bilibili.com',     // 直播间
    'api.bilibili.com',      // 后台 API
    'api.vc.bilibili.com',
    'pay.bilibili.com'       // 支付页面
  ];

  if (whitelistHosts.includes(host)) return;

  // 放行视频、番剧播放页、番剧详情页、合集/播放列表页
  if (
    pathname.startsWith('/video/') ||
    pathname.startsWith('/bangumi/play/') ||
    pathname.startsWith('/bangumi/media/') ||
    pathname.startsWith('/list/') ||
    pathname.startsWith('/medialist/')
  ) return;

  // 目标入口 URL
  const targetUrl = "https://search.bilibili.com/all?vt=64450376";

  // 如果当前不是目标页面，则执行替换跳转
  if (window.location.hostname !== 'search.bilibili.com') {
    window.location.replace(targetUrl);
  }
}

// 初始化时执行一次
chrome.storage.sync.get('redirectEnabled', (data) => {
  // 默认开启重定向
  if (data.redirectEnabled === false) return;
  tryRedirect();
});

// 实时响应开关变化，无需刷新页面
chrome.storage.onChanged.addListener((changes) => {
  if (!('redirectEnabled' in changes)) return;
  if (changes.redirectEnabled.newValue === false) {
    // 关闭：当前页面已加载，无需操作，下次导航自然不触发
    return;
  }
  // 开启：对当前页面立即执行一次重定向判断
  tryRedirect();
});
