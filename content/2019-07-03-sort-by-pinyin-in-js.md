---
title: 拼音排序 \w JavaScript
tags: 踩坑
legacy: true
force_publish_time: 2019-07-03T00:07:58.484Z
force_update_time: 2019-07-30T10:23:12.884Z
---

```javascript
array.sort((a, b) => a.localeCompare(b, 'zh-Hans-CN-u-co-pinyin'));
```

... which does not work all the time.

## Explanation
String.localeCompare 可以吃进去第二个参数，是 [BCP 47 language tag](http://tools.ietf.org/html/rfc5646)

`zh-Hans-CN-u-co-pinyin` 这个 Locale 意思是：
- `zh`: 是中文
- `Hans`: 简体中文
- `CN`: 大陆地区
- `u`: 启用之后的 Unicode Extension
- `co`: 使用一个 Collation
- `pinyin`: Pinyin Collation

然后就可以根据拼音排序啦。

除非在用 Node。如果是 Node，这个**偶尔**工作。

## With Node 
比较弱智的方法是用 `node-pinyin`，这个 Works all the time. 但是其实这个也要依赖一个 GYP Module，所以说到底还是 Platform-dependent

上面那个 Locale，在 ArchLinux 的 node 上可以用，NodeSource 给的 node  上不能用，也就是 Node Foundation 的 Distribution。观察了一下 PKGBUILD 和 Node Foundation 的 Makefile，发现编译的时候带的 [ICU 数据](https://nodejs.org/api/intl.html)不同。

所以对于只带有部分 ICU 数据的 Node，可以通过另外下载 ICU 数据然后喂给 Node:
```bash
$ yarn global add full-icu
$ NODE_ICU_DATA=$(dirname $(node-full-icu-path))
$ node
# Or with node --icu-data-dir=$(dirname $(node-full-icu-path))
```

然后 `localeCompare` 给出正确结果

## Alternatives
[`Intl.Collator`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Collator)
```javascript
array.sort(new Collator('zh-Hans-CN-u-co-pinyin').compare);
```
