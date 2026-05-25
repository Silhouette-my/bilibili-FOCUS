## 📖 bilibili-FOCUS

看 Bilibili 总是因为大数据推送分心？
相关推荐一看就停不下来？  

这个插件帮你屏蔽掉冗余的推荐内容，让你专注于视频和搜索本身。

---

### ✨ 功能介绍
- **全局专注重定向 (New!)**
  - 自动拦截容易让人分心的首页、动态流等页面，直接重定向到纯净搜索页
  - 内置智能白名单，安全放行视频播放、个人空间、消息中心、账号设置等核心功能
  
- **搜索页优化**  
  - 使用 [https://search.bilibili.com](https://search.bilibili.com) 获得纯净的搜索框页面  
  - 隐藏顶部导航栏和个性推送  
  - 搜索框居中显示，界面简洁无干扰  

- **播放页优化**  
  - 播放页只保留播放器区域  
  - 通过遮罩降低对比度和聚焦光晕效果，视觉更舒适，让你专注于视频内容 
  - 自动关闭播放页的「自动连播」，避免视频结束后继续推荐播放

- **控制面板**  
  - 提供简洁的功能开关  
  - 可独立启用/关闭「播放页遮罩」「自动关闭自动连播」和「搜索页遮罩」

---

### 🛠️ 安装方法

1. 下载或克隆本仓库：
   ```bash
   git clone https://github.com/Silhouette-my/bilibili-FOCUS.git
   ```
2. 打开 Chrome 浏览器，进入扩展管理页面：
   ```
   chrome://extensions
   ```
3. 打开右上角 **开发者模式**  
4. 点击 **加载已解压的扩展程序**  
5. 选择本仓库目录，即可启用插件  

---

### 📂 项目结构

```
bilibili-plugin/
├── manifest.json          # 插件清单
├── redirect.js            # 全局专注重定向逻辑
├── playerOverlay.js       # 播放页遮罩逻辑
├── searchOverlay.js       # 搜索页遮罩逻辑
├── searchOverlay.css      # 搜索页样式优化
├── controlPanel.html      # 控制面板 UI
├── controlPanel.js        # 控制面板逻辑
└── extensionIcon.png      # 插件图标
```

---

### 🚀 使用说明

- 安装完成后，浏览器工具栏会出现插件图标  
- 点击图标打开控制面板，可以自由切换功能开关  
- 在搜索页和播放页体验纯净界面，避免推荐干扰  

---
### :white_circle: 白名单内容
```
'search.bilibili.com',   // 搜索页
'passport.bilibili.com', // 登录认证页
'message.bilibili.com',  // 消息中心
'account.bilibili.com',  // 账户中心
'space.bilibili.com',    // 个人空间
'api.bilibili.com',      // 后台 API
'api.vc.bilibili.com',
'pay.bilibili.com',      // 支付页面
't.bilibili.com'         // 动态页
```
---

### 📌 版本记录

- **v1.0** 为搜索页和结果页添加遮罩  
- **v2.0** 新增播放页遮罩与控制面板  
- **v2.4** 文件结构优化，支持独立开关  
- **v2.5** 新增全局专注重定向功能，智能白名单保护核心体验
- **v2.6** 新增播放页自动关闭「自动连播」功能
