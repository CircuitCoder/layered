---
title: Fixing libvirt GPU passthrough
tags: 灵车
---

最近灵车 Libvirt GPU Passthrough 爆炸了，记录一下踩到的坑。

## Unknown PCI header type '127'

According to 有能群友 127 是 PCIe 读取字段超时返回的错误值，在这里是由于显卡没有正确 Reset。

通常进行 GPU passthrough 的设置时需要使用 vfio-pci 驱动，以防止驱动在显卡上电之后进行设置导致无法正确 Reset。然而对于 NVIDIA 20xx 显卡，**使用 Nouveau 驱动可以正常在直通后 Reset，但是使用 vfio-pci 会出 127**。这个现象和 AMD 显卡是正好相反的。

一个好处是，这样可以在直通前让 BIOS / GRUB / Host 直接用这个显卡输出，就算只有一个显示器也不用拔拔插插了。

## 启动虚拟机后黑屏没反应

没反应指就连 OVMF 的 Logo 都没出现。我一开始以为是直通挂了，但是观察 CPU usage 发现有一个核心狂转。

最后发现这是近期另一个修改导致的：ArchLinux 在最近把 `edk2-ovmf` 包中的数个 2M 版本的固件/模板文件删除了，[ArchLinux 论坛](https://bbs.archlinux.org/viewtopic.php?id=300862) 给出的解决方法是直接用 4M 版本。**但是在我这里额外需要清空 NVRAM:**

```
virsh start vm --reset-nvram
```

之后正常启动。
