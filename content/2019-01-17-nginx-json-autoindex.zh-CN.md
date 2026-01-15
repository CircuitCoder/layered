---
title: Nginx 输出 json 格式目录
tags: 踩坑
legacy: true
force_publish_time: 2019-01-16T16:12:02.576Z
force_update_time: 2019-01-16T16:13:32.907Z
---

## TL;DR

```nginx
autoindex on;
autoindex_format json;
```

Who needs a backend?


## Motivation
在写白嫖文库，希望能够完全静态也不需要有 build，所以需要能够拿到后端目录的内容。

原来以为要解析 autoindex 的 html 输出，但是不同版本的 nginx 会给出不一样的格式。用 json 就没问题了。
