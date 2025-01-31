---
title: 编译 aur/mingw-w64-bzip2
tags: 技术, 踩坑
force_publish_time: 2018-11-10T16:52:33.500Z
force_update_time: 2018-11-10T16:54:10.204Z
---

最新版的 `mingw-w64-configure` 不知道出了什么锅，不会自动设置 CC，所以要改一下 PKGBUILD. 对于 1.0.6-8 版本:

```diff
--- PKGBUILD.old        2018-11-11 00:47:26.751880500 +0800
+++ PKGBUILD    2018-11-11 00:52:52.561756100 +0800
@@ -33,7 +33,7 @@
   cd "$srcdir/bzip2-$pkgver"
   for _arch in ${_architectures}; do
     mkdir -p build-${_arch} && pushd build-${_arch}
-    ${_arch}-configure
+    CC=${_arch}-gcc CXX=${_arch}-g++ ${_arch}-configure
     make
     popd
   done
```

啊，我死了.jpg
