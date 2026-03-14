## 📖 bilibili-FOCUS

看 Bilibili 总是因为大数据推送分心？
相关推荐一看就停不下来？  

这个插件帮你屏蔽掉冗余的推荐内容，让你专注于视频和搜索本身。

---

### ✨ 功能介绍
- **全局专注重定向 (New!)**
  - 自动拦截容易让人分心的首页、动态流等页面，直接重定向到纯净搜索页
  - 内置智能白名单，安全放行视频播放、直播间、个人空间、消息中心、账号设置等核心功能

- **搜索页优化 (New!)**
  - 在 `search.bilibili.com` 上，当搜索框为空时，自动隐藏"搜索历史"和"bilibili热搜"下拉面板
  - 一旦开始输入，正常的自动补全建议照常显示，不影响搜索体验
  - 可在控制面板中独立开关

- **播放页优化**  
  - 播放页只保留播放器区域  
  - 通过遮罩降低对比度和聚焦光晕效果，视觉更舒适，让你专注于视频内容 

- **控制面板**  
  - 提供简洁的功能开关  
  - 可独立启用/关闭「全局专注重定向」、「播放页遮罩」和「搜索页历史热搜屏蔽」  

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
bilibili-FOCUS/
├── manifest.json          # 插件清单
├── redirect.js            # 全局专注重定向逻辑
├── playerOverlay.js       # 播放页遮罩逻辑
├── searchOverlay.js       # 搜索页历史热搜屏蔽逻辑
├── controlPanel.html      # 控制面板 UI
├── controlPanel.js        # 控制面板逻辑
└── extensionIcon.png      # 插件图标
```

---

### 🚀 使用说明

- 安装完成后，浏览器工具栏会出现插件图标  
- 点击图标打开控制面板，可以自由切换功能开关  
- 在播放页体验纯净界面，避免推荐干扰  

---
### :white_circle: 白名单内容
```
'search.bilibili.com',   // 搜索页
'passport.bilibili.com', // 登录认证页
'message.bilibili.com',  // 消息中心
'account.bilibili.com',  // 账户中心
'space.bilibili.com',    // 个人空间
'live.bilibili.com',     // 直播间
'api.bilibili.com',      // 后台 API
'api.vc.bilibili.com',
'pay.bilibili.com'       // 支付页面
```
---

### 📌 版本记录

- **v1.0** 为搜索页和结果页添加遮罩  
- **v2.0** 新增播放页遮罩与控制面板  
- **v2.4** 文件结构优化，支持独立开关  
- **v2.5** 新增全局专注重定向功能，智能白名单保护核心体验
- **v2.6** 移除搜索页遮罩功能：经验证，`search.bilibili.com` 本身已是纯净搜索页，无视频推荐流，该功能实际无效果；且 B站改版后相关 CSS 选择器已失效，导致搜索框下拉候选宽度异常，故移除
- **v2.7** 重新实现搜索页优化：当搜索框为空时隐藏"搜索历史"和"bilibili热搜"下拉面板，输入后自动恢复自动补全建议
