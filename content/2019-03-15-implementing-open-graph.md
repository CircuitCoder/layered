---
title: Open Graph on C3Meow
tags: Meta
force_publish_time: 2019-03-15T09:31:46.411Z
force_update_time: 2019-03-15T13:38:13.136Z
---

为了顺利在 Telegram 上传教，决定打开一年没动的 Repo，重新挑战了一下 `Vue 1` 和 `Webpack 1`

It was a tough one.

## What is [Open Graph](https://ogp.me/)

是 Facebook 搞得一套用来展示链接内容的协议，方式是在 HTML head 里写一堆 namespace 是 `og` 的 meta tag。

```HTML
<meta property="og:title" content="标题" />
<meta property="og:description" content="摘要" />
<!-- And friends... -->
```

显然是非常原创的想法，拥有非常多的新功能，在设计上完全碾压了 HTML 原先标准里 keywords，title，author 之类的 meta tag。

同时，仅仅牺牲了少量前端渲染的网页，就得到了可以使用 Vim 直接编辑的诱人特性，充分体现了 Facebook 大厂在工程上的取舍能力。

这一协议甚至考虑了 HTML 并不从 HTTP 传输的情况，并没有用到显然更适合做这件事情的 HTTP headers，看来是深刻领悟了 W3C 的高屋建瓴，已经预料到了 HTTP/114514 可能删去 headers 这一点，实在是高瞻远瞩。

> SITUATION: There are 15 competing standards -- [xkcd 927. Standards](https://xkcd.com/927/)

然后 Facebook 显然让 OG 成为了事实标准，连这一点也从 JS 之类的前辈借鉴了前端社区的一贯经验：强扭的瓜真香。

故事的结尾是 Telegram 也用了这个标准。巧妙的一件事是，Telegram 也尊重了 Facebook 资深前端大厂的身份，遵从了前端行业的一贯行事标准——那就是看着没写清楚的标准，然后根本不根据它实现协议。

## Open Graph @ Telegram
相比于标准，Telegram只需要以下三个 meta 即可工作:
- og:title
- og:description
- og:url (这个我没测试可不可以删)

至于 `og:image`，如果加上了的话会有个小 Icon，但是如果宽高比离 1 有点远，可能会傲娇。

另一点是，作为事实标准的 Facebook，在解析 Description 的时候有上限，据 [SO 上的无名高手](https://stackoverflow.com/a/35817780)所说，大概有 100~300 char 不等的限制，而且我们也不知道这个 char 是 C 他们家的还是 Rust 他们家的。Telegram 显然没管这件事，因为我传了个几千字的长文进来，Telegram 还是顺利吃下。

有一个坑是 `og:image` 虽然号称自己接受 URL，显然在暗中对 Data URL 进行了种族歧视。为了解决这个问题花了两个小时折腾 Webpack，只为了让他吐一个图片出来。

## SSR
为了在 HTML head 里插入/修改标签，所以需要在之前给爬虫做的 SSR 上进行一点更改。因为之前就需要动态生成 title，所以事实上不太难。

一点吃惊的是，Vue SSR 传给内部进程的 Context，可以用来传东西给 Node 主进程。大概这两个东西虽然被 Node vm 隔了出去，但是其实还是躺在一个 V8 里，甚至共享了 Heap，看来 Node 对 vm 这个词也有领先业界的理解。备受感动，以后一定称呼 Docker 叫 vm。

相比之下，之前是通过在 HTML 里渲染一个不显示的 Tag，然后在主进程的接受字节流的地方写了个小状态机，把这个 Tag 提出来。现在看起来跟弱智一样。

## Next Up
既然可以在 Telegram 生成小卡片了，以后可能魔改一下 [rssbot](https://github.com/iovxw/rssbot)，加一个修改功能，然后自动转发到我的频道里。少点好几次鼠标，真实节约能源。
