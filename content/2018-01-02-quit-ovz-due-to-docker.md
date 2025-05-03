---
title: 当你想在 OpenVZ 上装 Docker 时
tags: 技术
legacy: true
force_publish_time: 2018-01-01T16:30:39.321Z
force_update_time: 2018-01-01T16:30:58.266Z
---

**赶紧停下来，千万别这么想**

因为你（很）可能会（依次）遇到以下问题：
- 很大可能 Host 在用 OpenVZ 6，内核 2.6，只有 RHEL 才在 backport 一些内核补丁到 2.6，导致你想用到**比较**新的 Docker，只能用 CentOS / RHEL。
- 需要 Host 启动 tuntap、bridge 等一系列模块，然而你在容器里根本查不出来什么有什么没有。
- 就算你用了续命内核，Docker 也只活到 1.7，新版本仍旧炸。
- 1.7.0 会在用 bridge 的时候会有 **Operation not supported**，然而 strace 都看不到有 supported 这个词。
- 可以用 --net=host 规避，但是 docker build 没有这个选项。
- 在邮件列表里可以查出来上面那个是什么问题：虽然说文档称 1.7 支持 2.6 内核，但是 1.7.0 引入了 Regression。1.7.1 可以工作，但是 1.7 的文档页上没有 1.7.1 的下载链接。
- 好不容易跑起来了，只支持 aufs，性能爆炸。
- Docker-compose 的配套版本要从 Github releases 里面翻找，是 1.5。
- 1.5 不支持 File version。
- Dockerfile 不支持 Add 等一堆东西。

除非当 Webserver，我这辈子再也不贪便宜买 OpenVZ 的服务器了。
