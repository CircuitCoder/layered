---
title: 隐藏 navigator.webdriver
tags: 踩坑
force_publish_time: 2019-01-26T16:28:33.956Z
force_update_time: 2019-01-26T16:30:18.362Z
---

**Source**:  [https://intoli.com/blog/not-possible-to-block-chrome-headless/](https://intoli.com/blog/not-possible-to-block-chrome-headless/)

## TL;DR
```javascript
Object.defineProperty(navigator, 'webdriver', {
  get: () => false,
});
```

## Motivation
<del>N/A</del>

要用 Puppeteer 爬淘宝。然而只要有一点自动化测试的意思，Chrome 就会把 `navigator.webdriver` 设置成 `true`。淘宝的登陆页面会判断这个属性。
