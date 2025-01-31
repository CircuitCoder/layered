---
title: 在线听鸽，或者离线听鸽
tags: 开发
force_publish_time: 2019-01-02T14:44:23.913Z
force_update_time: 2019-06-30T13:04:12.870Z
---

[https://playlist.meow.plus/meow](https://playlist.meow.plus/meow)

是一个从 B 站上扒歌然后提供各种播放器功能的东西。

## Motivation

因为 B 站没有 mylist 类似物，虽然很久之前有过，但是就和我手边的零食一样，之后莫名其妙就没有了。

现在唯一能完成列表顺序播放的，要不然自己投个稿，要不然用只有一个的稍后再看。只能顺序播放，据说稍后再看还会自动帮你清理。看来 B 站已经成熟了，学会自己看视频了，简直是产品鬼才。

所以搞了个管歌单的东西，主要自己用。要不 B 站一纸律师函就不好了。

## Features

- 离线播放：歌单右上角有下载按钮，会同步到浏览器的缓存里，然后断网也可以提供服务
- P W A: Add to Desktop
- 简单的认证
- 直接同步 B 站一个公开收藏夹
- 可以前后端分离，但是大多数的静态资源会活在后端。可以利用这个把前端扔到国外，就不用备案了

## 源码和搭建

GitHub: CircuitCoder/bilicast

依赖 MongoDB，需要进行配置：
- frontend/src/config.example.js -> frontend/src/config.js

然后
```
yarn install --frozen-lockfile
cd frontend
yarn install --frozen-lockfile
yarn build
cd ..
PASSPHRASE=密码 DBURI=数据库 yarn start
```

不带密码的话任何人都可以修改歌单。不加数据库地址的话会直接用 localhost/bilicast

## Rambling
一年前我说我不要写前端了。现在来看估计前面那篇前端踩坑清单还能更新。
