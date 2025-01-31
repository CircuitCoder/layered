---
title: 使用 DNSPod 与 ACME
tags: 踩坑
force_publish_time: 2019-02-10T14:36:12.129Z
force_update_time: 2019-03-15T08:26:24.148Z
---

其实是因为 CNAME 和别的记录不兼容。是我肤浅了，伤害了大家的感情，对不起

---

如果使用 DNSPod 或者腾讯云解析的时候，ACME 遇到了
```
DNS problem: SERVFAIL looking up CAA for [DOMAIN HERE]
```

请检查你的 @ 解析是不是 CNAME 到了其他域名上。据经验，如果有 @ 解析 CNAME 的话，CAA 查询会爆炸。

截止到目前，ACME 还没有要求强制 CAA，但是会检查 CAA。如果这个检查得到的来自 DNS 回应是非法的，这个签发请求会被拒绝。

> CAA 记录在做了 —— 腾讯云 @ 2017
