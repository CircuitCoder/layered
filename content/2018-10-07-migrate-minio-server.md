---
title: 搭建/迁移 Minio 服务器
tags: 技术
force_publish_time: 2018-10-07T09:52:28.759Z
force_update_time: 2018-10-07T10:07:11.811Z
---

今天要迁移服务器，重新搭了个 Minio 的服务器，记一下踩的坑。

## Nginx 代理配置
一定要写上 Host Header 的代理，否则请求签名两边对不上。
```nginx
proxy_set_header Host $http_host;
```

最大 Body 限制也要增加，5MB 是最小的，因为 minio-js 会把大文件切分成 5M Chunk

## 迁移数据
直接把 store 复制过去是不行的，需要用 mc mirror

因为听了文档的鬼话用了 Client 的 Docker Image，所以需要做额外的 host config。然后因为要直接用外面的端口，需要加个 `--net=host`

```
$ docker run -it --net=host --entrypoint=/bin/sh minio/mc
> mc config host add local http://localhost:9000 xxx xxxxx
```

## 升级 minio-js
鬼知道哪个大版本内部搞了个 Breaking change，fPutObject的第四个参数变成对象了。换了 yarn.lock 毫不知情，结果调了一下午。升级到 ^7.0.0 之后改了调用签名，之后写死在 lock 里了，希望以后不要爆炸。
