---
title: NFS on Android
tags: 灵车
---

出于多设备共享、偷 NAS 上的存储空间等原因，最近折腾了一下 Android 挂载 NFS，简单做一下记录。

由于 Android 默认的内核没编译 NFS，所以需要自己编译一下内核，并且有一些额外设置以保证 App 可以正常访问挂载的内容。

因此使用如下方法在 Android 上用 NFS 需要：
- 可以刷机
- 必须得有 Root，不过形式不一定是类似 Magisk 这样的方案。

我使用的环境：
- OnePlus 7 (guacamoleb)
- [LineageOS 22.1 (Android 15)](https://wiki.lineageos.org/devices/guacamoleb/build/)

## 内核

具体而言，需要至少开 NFS，以及希望支持的 NFS 版本相关的内容。正常 clone AOSP 或者希望使用的 ROM，在内核目录下（`$ANDROID_ROOD/kernel/$BRAND/$PRODUCT`）执行 `make menuconfig` 即可。

我开了以下这些东西：

```diff
+CONFIG_NFS_FS=y
+CONFIG_NFS_V4=y
+CONFIG_NFS_V4_1=y
+CONFIG_NFS_V4_2=y
+CONFIG_NFSD=y
+CONFIG_NFSD_V4=y
+CONFIG_CIFS=m
+CONFIG_AFS_FS=m
```

之后直接 Build 出来的 ROM 刷进去，可以看到内核的 NFS 支持已经出来了：

```shell
OnePlus7:# zcat /proc/config.gz | grep CONFIG_NFS_FS=
CONFIG_NFS_FS=y
```

## Root

后续操作需要 Root，关 SELinux 和挂载这个操作本身都需要，所以基本没法绕过。不过 LineageOS 自带了 Root through ADB。然后不知道为什么，Termux 可以看到本机的 ADB：

```bash
~ $ adb devices
List of devices attached
emulator-5554 device
```

所以其实直接在 Termux 里面 `adb root; adb shell` 就提权了，没用到 su...然后再把 Termux 的 PATH 给进去，就可以用 Termux 下面装的 bash 和所有其他二进制了。以后有时间研究一下 Termux 是怎么看到本机的 ADB 的...

如果上述方法不工作，更通用的方法是开 Wireless debugging，然后在本机连接<sup>[2]</sup>。

如果其他的 ROM，可以在编译的时候使用 `userdebug` / `eng` build variant<sup>[3][4]</sup>，效果也是可以打开 `adb root`；LineageOS 的 [`adbd` fork](https://github.com/LineageOS/android_packages_modules_adb/) Apparently 加了一些额外的东西，看上去是和开发者选项里的开关相关的。

当然使用类似 Magisk 的 su-based 方案也可以，或者下面进行挂载的脚本加上 setuid。

题外话：赞美 LineageOS，自带了 VIM

## 挂载

主要参考了 [这个 Gist](https://gist.github.com/aldur/4a3f90a111b71662f056)。需要注意的是 Android 自己带的 mount 二进制不认识 NFS，上述 Gist 中给出的方案是使用 `busybox mount`。使用 termux 安装的 busybox 即可；termux 安装的 mount 二进制应该也可以，但是没有实测。

另一个需要注意的事情是，由于 `/sdcard -> /storage/emulated/0` 是一个 FUSE<sup>[1]</sup>，没法直接 mount 进去。上述 Gist 的方案是挂到 `/data/media/0` 下面，但是实测应用看不到挂载内的内容。可以看到内容的方法是搞一些扭曲 bind mount，相当于绕过了 FUSE 的权限控制：

```bash
#!/data/data/com.termux/usr/bin/bash
export PATH="/data/data/com.termux/usr/bin:$PATH"
setenforce Permissive

mkdir -p /tmp/mnt/nfs # Ensure /tmp is tmpfs
busybox mount -o ro,nolock,local_lock=all 1.2.3.4:/path/to/export /tmp/mnt/nfs
# Mount other subdirectories...

mkdir -p /storage/emulated/0/nfs
busybox mount --rbind /tmp/mnt/nfs /storage/emulated/0/nfs
```

上述例子中给的 Readonly mount，实测 Read-write 也正常<sup>[5]</sup>，App 可以写入。不过 `nolock` 不能去掉，原因有待研究。脚本放在 `/data/media/0` 下可以 `chmod +x`。

- [1] [Android Emulated Storage 结构浅析 - LibXZR 的小本本](https://blog.xzr.moe/archives/191/)
- [2] [Instructions for connecting Termux's android-tools adb to the current device via Wireless debugging and fixing phantom process killing](https://gist.github.com/kairusds/1d4e32d3cf0d6ca44dc126c1a383a48d)
- [3] [AOSP `adbd` 相关代码](https://android.googlesource.com/platform//packages/modules/adb/+/1cf2f017d312f73b3dc53bda85ef2610e35a80e9/daemon/main.cpp#87)
- [4] [LineageOS 设置 Build variant 的位置](https://github.com/LineageOS/android_vendor_lineage/blob/fac22bf2792973a7bb85b37744ae4cb851174e24/build/envsetup.sh#L53)
- [5] 我 `rm -rf` 了一个 NFS 挂载点...要不是花了两天恢复数据，这篇灵车文章两天前就写出来了。
