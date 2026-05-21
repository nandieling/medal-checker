# PT勋章扫描器油猴版

油猴脚本文件：

```text
pt-medal-scanner.user.js
```

## 安装

1. 打开 Tampermonkey 管理面板。
2. 新建脚本。
3. 将 `pt-medal-scanner.user.js` 的内容粘贴进去并保存。
4. 打开任意网页，右下角会出现 `PT` 按钮，也可以从 Tampermonkey 菜单选择“打开 PT 勋章扫描器”。

## 和 Chrome 扩展版的差异

- 油猴脚本不能使用 `chrome.cookies` 枚举其它域名 Cookie。
- “检测内置站点”改为请求页面并判断是否可访问，结果是“疑似已登录/可访问”，不是精确 Cookie 检测。
- 扫描请求使用 `GM_xmlhttpRequest`，浏览器会随对应站点请求携带已有登录 Cookie。
- 定时任务只有在装载脚本的网页保持打开时才会执行；油猴没有 Chrome 扩展后台 service worker 那样的常驻后台。
- 增加了检测失败展示和跳转

## 保留功能

- 手动配置站点。
- 导入/导出配置。
- 扫描可购买勋章。
- 差异模式、永久勋章、限时售卖、正收益过滤。
- 打开全部站点、打开过滤结果。
- 导出调试包。
- 飞书 Webhook 测试和推送。
