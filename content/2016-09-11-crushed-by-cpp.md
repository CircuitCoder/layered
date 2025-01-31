---
title: 感受到了力量
tags: Meta, 扯淡
force_publish_time: 2016-09-11T12:48:12.720Z
force_update_time: 2016-12-26T11:48:38.500Z
---

最近更新了一下博客，成功把并发弄到 10k+，还把 Sitemap 给搞好了。中间遇到了很多坑：

- C++ 标准库不要求容器的写操作是原子的，所以开多线程的时候 Session 存储瞬间崩
- Atom 标准里链接的关系是 Alternate。亲爱的我怎么记得这个用作形容词不是这个意思啊... 之前写成 Alternative，Feedly 不认，我还骂了一通。
- RFC3999 里面日期时间前面要补 0
- Google Search Console 里面 Sitemap 只能交当前域名下的。前后端分离瞬间爆炸。
- 之前忘了把 Leveldb 的 Iterator 释放了，因为文档只给了中间一部分示例没有初始化没有删除。当时差点蒙圈，因为好多都是在循环中间 return 的。还好有 unique\_ptr，我只能说 C++ 还是好。
- 把 CMAKE\_BUILD\_TYPE 写死在 CMakeList 里了。后来在外面设成 Release 会被覆盖，导致一直是不带优化编译的。

这样一看，简直跟我不会写 C++ 一样，真是惨
