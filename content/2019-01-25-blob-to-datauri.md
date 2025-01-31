---
title: Blob -> Data URI
tags: 踩坑
force_publish_time: 2019-01-24T17:16:22.192Z
force_update_time: 2019-01-24T17:16:22.192Z
---

> 你知道吗，blob 有四种读法

# TL;DR
```javascript
async function blobToDataURI(blob) {
  const reader = new FileReader();
  const result = new Promise(resolve => {
    reader.addEventListener('load', () => resolve(reader.result));
  });
  
  reader.readAsDataURL(blob);
  return result;
}
```

# 四种读法
Literally...

- CreateObjectURL + XHR
- new Response(blob).text() -> Promise
- 全新的 FileReader
- 转 ArrayBuffer 然后 atob

FileReader 是全新 ES5 功能，简直是 JS 集大成者。短短五行代码，竟然包含了 Async/Await 全家桶，Event Emitter 全家桶，甚至还有一点 XHR 的味道，佩服佩服。
