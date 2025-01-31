---
title: Nginx Listen IP
tags: 技术
force_publish_time: 2018-05-17T16:05:53.163Z
force_update_time: 2018-05-17T16:10:42.187Z
---

当你调不出来为什么一个 server_name 匹配不上的时候，请关注是否有另一个 server 块直接听了某个 IP，而不是 0.0.0.0

因为 Nginx 对 server 块的匹配是先找符合的 listen，随后再看符合的 listen 下面的 server_name。其中找 listen 的时候是先找对应 IP 的，没有再找 0.0.0.0。如果有完全相同的 IP，就不会看监听到 0.0.0.0 上的 server 块了。

举例: 有以下配置
```
eth0 -> 10.1.1.1
eth1 -> 10.1.2.1
```

```
server {
  listen 10.1.1.1:80;
  server_name a.example.com;
}

server {
  listen 0.0.0.0:80;
  server_name b.example.com;
}
```

一个 Host: b.example.com，如果从 eth1 走，会走到第二个块里。如果从 eth0 走，会走到第一个块里。

我算是服了
