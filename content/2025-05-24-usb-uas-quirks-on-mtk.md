---
title: UAS Quirks on MTK chipsets
tags: 灵车
---

很久之前买了一个 CMCC RAX3000M **算力版**<sup>[1]</sup>路由器放在工位当作内网接入隧道对端（因为工位偷电放了一台共享龙芯 3A6000，从家宽打了个 Socat SSH 出去）。这台路由器正好还有一个 USB3.0 口，这不正好，在路由器上接硬盘，当然是 Network-attached Storage，所以买了条易驱线，从工位翻了块儿没人用的硬盘出来。

不幸的是，路由器的 SoC 是 MT7981B。而 MTK 的 USB Host，有点[和 UAS](https://github.com/openwrt/openwrt/issues/15536) [不对付](https://forum.gl-inet.com/t/usb-3-0-speeds-for-smb-share-on-mt2500/42939/15)。

![dmesg](https://layered-assets.thu.fail/mtk-uas.jpg)

在我这里的现象是当写入到了一定量之后，USB Root bus 的状态可能损坏了，之后根本读写不了东西，读写很少数量就会 Soft reset，之后重新连上。由于硬盘是 ST3000VX000-1CU166 是 ST3000DM001 的马甲，我都担心盘坏了，结果换了三张盘都有问题，感觉不太对劲。硬盘盒也是刚换的，之前以为是电源或者硬盘盒坏了，整体换了一次，这次终于找到了罪魁祸首。

于是只能关闭 UAS，使用 `usb-storage` 驱动，而不是 `usb-storage-uas`。

```
# Disable autoload of usb-storage-uas kmod
rm /etc/modules.d/usb-storage-uas

# Manually claim the device using usb-storage
echo "usb-storage quirks=174c:55aa:u" > /etc/modules.d/usb-storage
```

在线切换 Driver 的方法可以参考[这个 Issue 评论](https://github.com/openwrt/openwrt/issues/15536#issuecomment-2143067555)。

事实上，一共试了两个线，一个是 ORICO 的硬盘盒，一个是绿联的典中典易驱线。前者 USB ID 是 [0080:a001](linux-hardware.org/?id=usb:0080-a001)，`usb-storage` 甚至无法带起来，只有 UAS 才能带起来。所以看起来只能在 x86 上稳定使用了。后者的 ID 是 [174c:55aa](https://linux-hardware.org/?id=usb:174c-55aa)，使用 `usb-storage` 驱动之后至少是可以用的，速度因为挂的是 HDD 所以也没看出来太大的区别。另外购买的一个绿联 USB 硬盘盒也是同一个芯片。所以如果在使用 MTK Chipset 挂 USB 硬盘的话，推荐还是用绿联的，至少 Less 灵一些。

P.S. SMART 和 UAS 在有的时候[也不对付](https://www.smartmontools.org/wiki/SAT-with-UAS-Linux)。我这里看到的现象是当 Root bus 状态坏掉以后，执行任何的 SMART Self-test 也会 soft reset，dmesg 出现的内容也是类似上图中的 `Transfer event for unknown stream ring slot`，感觉也是和 SAT 命令的处理有关，不过这次是 Root hub 没有正确处理。

---

<div class="footnotes">

- [1] 一定要 show off 一下

</div>
