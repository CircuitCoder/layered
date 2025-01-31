---
title: 捏造 tuoj-buildfs
tags: 技术
force_publish_time: 2018-04-26T18:20:30.284Z
force_update_time: 2018-04-26T18:20:49.205Z
---

希望能够给算协的系统弄一个稳定可复现的构建过程，于是：

### 发现 Ubuntu 的仓库没有过去版本的包

这个其实是可以理解的，因为如果加上过去的包，Index 就要无限大了。不过为什么连过去某一天的 Snapshot 都没有啊！连 ArchLinux 这种仓库都可以有，Debian 也可以有，估计就是 Ubuntu 摸了。

本来的配置文件设计希望能够写死版本：

```yaml
install:
  g++: 4:5.3.1-1ubuntu1
```

现在只能不写版本了，在构建结尾输出包的版本号，并且保证 Judger 和 Client(Dist) 的这些包版本相同。

### 发现 Docker-in-Docker Image 的上游是 Alpine

Alpine 的包真多，基本上全都有了，Randisk 用的挺爽的，准备过两天往 RaspberryPi 上来一个。

坑爹的地方在于，我在搞 Ubuntu 系统，外面是 Alpine，目录结构都不太一样。后面搞 Grub 的时候基本上是在 CI 上 Trial & Error，制造了大量垃圾提交

用到了上次测试 CI 时候的技能：
```
git commit -m "No-op: trigger CI update" --allow-empty
```

可以提交一个空 Commit 干扰其他 Collaborator 的工作。

### 发现 ISOLinux 根本没有错误输出
说不出话了，我到现在都不知道 ISOLinux 为什么不工作。最开始的时候提示没有 ldlinux.c32，发现新的 ldlinux.c32 在 /usr/lib/syslinux/modules 里，但是没有 isolinux，isolinux 在另一个包 isolinux 里，路径在 /usr/lib/ISOLINUX/isolinux.bin。

改了之后还是不行，发现最新版改配置格式了，格式错了也没有输出。改了下格式，有 menu 了，虽然还是启动不了，放到 CI 上跑了一下，又炸了。

原因是在 Alpine 下面，所有东西都在 /usr/lib/syslinux/modules/bios/\*，但是改了我在本地就没办法调试了。

### 发现 grub-mkstandalone 基本不能用在 Bios 上
Bios 模式希望把 Ramdisk 在 Real mode 就加载上去，导致内存超小，连一个 linux 模块都放不到 Ramdisk 里，所以 grub-mkstandalone 基本没办法 i386-pc。因为很懒最后就只做了 UEFI 的版本。

### 发现了一个 Go 的 Feature
因为特殊原因 git.thusaac.org 走了个代理。 gitlab-runner 虽然在同一台机器上但是跑了一个绕行，走了香港 VPS 的双倍延时+双倍流量。加 extra_hosts 都没用，发现是 Go 如果不用 cgo 的话，是会忽略 /etc/hosts 的。Go 说这是 GNU 的默认行为，只能作罢，加了个 GODEBUG 用 cgo 处理网络问题。

### 发现我选择了一个错误的时间

刚写完脚本，就看到了：

- Atom 1.27
- Ubuntu 18.04 LTS
- Node 10

## Status
现在还在组织当中。选手机的镜像里面由于是从 Ubuntu Base 开始搞得，装完桌面环境，没有计算器，没有终端模拟器，没有 LibreOffice，没有 gnome-mines，还要装很多东西。

以及 Judger 的封装还没做好。但是上传到 Docker Hub 已经调试完了。docker 命令行居然不能在参数里接受有特殊字符的密码，服气。
