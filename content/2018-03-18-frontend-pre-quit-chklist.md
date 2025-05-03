---
title: 前端踩坑 Checklist
tags: 技术
legacy: true
force_publish_time: 2018-03-17T17:48:48.834Z
force_update_time: 2018-03-17T17:52:38.960Z
---

> 持续更新 as long as 我还在写前端，因为前端的坑是踩不完的

## Vue
- Component 只有一个 Root，附带 transition 不生成 node，所以这样会爆炸:
```html
<transition>
  <div key="1"></div>
  <div key="2"></div>
</transition>
```

## Networking
- fetch API 默认不带 credentials，就算是 same-origin
