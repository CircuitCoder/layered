---
title: 测试 KPTI 对 IO 的性能影响
tags: 技术
force_publish_time: 2018-01-06T14:17:32.945Z
force_update_time: 2018-01-20T07:59:28.847Z
---

<script>
alert('ha');
</script>

<style>
.hi-img {
  display:  block;
}

.hi-img > img {
  margin: 20px auto;
  width: 100%;
}
</style>

<div class="hi-img">
  <img alt="Intel sale" src="https://storage.c-3.moe/meow/intel-sale-30.jpg"></img>
</div>

看到狂吹 KPTI 造成 5% ~ 30% 的性能损失，自己测试了一下。环境如下:

- 服务器: Aliyun 计算型 c5.large
- 操作系统: Ubuntu 16.04.3 LTS
- 内核版本: 4.4.0-62-generic / 4.14.12-041412-generic
  - 4.4.0 内核是 Ubuntu Mainline
  - 4.14.12 内核是在 [http://kernel.ubuntu.com/~kernel-ppa/mainline/](http://kernel.ubuntu.com/~kernel-ppa/mainline/) 下载的。
- 一共三组:
  - A: 4.4.0-62: no KPTI
  - B: 4.14.12-041412: \w KPTI & PCID
  - C: 4.14.12-041412: \w KPTI, no PCID
- 通过添加内核参数 `nopcid noinvpcid` 禁用 PCID
- 测试科目:
  - MongoDB 读写，具体见下方 Gist
  - 这个博客(C3Blog)，数据库内容和在线版本相同，使用 `wrk -c100 -t2 -d10s http://localhost/posts --latency` 测试

## TL;DR
在开启 PCID 时，KPTI 未造成肉眼可见的性能损失。

在关闭 PCID 后，C3Blog 出现了 10% 左右的 rps 损失，但是 MongoDB 依旧没有明显的性能区别。可能 JavaScript/Mongoose 带来的 Overhead >> KPTI

## 具体结果
贴在了这个 Gist 上: [https://gist.github.com/anonymous/879353087717b1eec1e6435b22d94a8c](https://gist.github.com/anonymous/879353087717b1eec1e6435b22d94a8c)

一不小心贴到 Anonymous 上了，嘻嘻，改天挪到自己的 Namespace 下。

格式是: `[Group].[Test].txt`
- Group: A\B\C
- Test:
  - uname: `uname -r` 输出
  - c: C3Blog
  - m: MongoDB
  
<style>
iframe.gist {
  border: none;
  width: 100%;
}
</style>
  
<iframe class="gist" src="data:text/html;charset=utf-8,%3Cstyle%3E%0D%0Abody%20%7B%20margin%3A%200%20%7D%0D%0A%3C%2Fstyle%3E%0D%0A%3Cscript%3E%0D%0Awindow.addEventListener%28%27message%27%2C%20function%28%29%20%7B%0D%0A%20%20window.parent.postMessage%28%7B%20gist%3Atrue%2C%20height%3A%20document.body.scrollHeight%20%7D%2C%20%27%2A%27%29%3B%0D%0A%7D%2C%20false%29%3B%0D%0A%3C%2Fscript%3E%0D%0A%0D%0A%3Cscript%20src%3D%22https%3A%2F%2Fgist.github.com%2Fanonymous%2F879353087717b1eec1e6435b22d94a8c.js%22%3E%3C%2Fscript%3E" onload="frame=this;window.addEventListener('message',function cb(msg){console.log(msg.data);if(msg.data.gist){frame.height=msg.data.height;window.removeEventListener('message', frame,false)}},false);this.contentWindow.postMessage('', '*')"></iframe>
