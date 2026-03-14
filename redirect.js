chrome.storage.sync.get('redirectEnabled', (data) => {
  // 默认开启重定向
  if (data.redirectEnabled === false) return;

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
    'api.bilibili.com',      // 后台 API
    'api.vc.bilibili.com',
    'pay.bilibili.com'       // 支付页面
  ];

  if (whitelistHosts.includes(host)) return;

  // 放行所有视频和番剧播放页
  if (pathname.startsWith('/video/') || pathname.startsWith('/bangumi/play/')) return;

  // 目标入口 URL
  const targetUrl = "https://search.bilibili.com/all?vt=64450376";

  // 如果当前不是目标页面，则执行替换跳转
  if (window.location.href !== targetUrl) {
    window.location.replace(targetUrl);
  }
});