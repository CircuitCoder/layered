---
title: 在 2025 年被电信诈骗
tags: 灵车
---

2025 年还能被电信诈骗，实在是非常丢人。不过更搞笑的是之后的损管和恢复过程，自己的灵车 Infra 真的是随便戳一下就轰然倒塌，最后整个国庆假期都花在这上了。

## What happened?

以管理员权限运行了一个恶意软件。

这个恶意软件伪装成了一个会议软件的客户端 (https://weconne.app)，但是其实是扫描 AppData 里面的文件，并且应该有 Keylogger，是用来骗钱包私钥的。

互联网实在是太坏了。

## Then?

还好我这台电脑上没装钱包。不过这台系统是肯定要重装了。然而在重装过程中发生了巨量神秘倒闭事件。

### 数据移动

目前这个系统是一个 Linux Host 上运行的 Windows Guest，正好顺便把 Host 也挪动到一个更大的硬盘上。Host 的 rootfs 放在一个 2.5 寸 SATA SSD 硬盘上，拿了另外一个挂在易驱线上开始 `dd`。

然后发现 `dmesg` 偶尔会报写入失败。由于这次是在 x86 上，所以肯定不是上次 [MTK Chipset 上的驱动问题](/post/usb-uas-quirks-on-mtk)。比较遗憾的是 `dmesg` 消息已经被刷掉了，没有留下记录，所以有可能是 `UAS` 驱动的问题，但更有可能是线本身受干扰比较严重。比较神秘的是之后用这根线挂 HDD 就没出现过问题，所以也可能是供电问题？

总之，交换了源盘和目标盘，目标盘挂在主板 SATA 上，源盘挂在易驱线上，读写就都正常了。As a reference，这根线用的芯片是 `174c:55aa`，需要遇到类似情况的网友帮帮忙来定位问题了。

### 重新安装 GRUB

复制之后直接尝试启动，发现启动不起来。和群友学习了一下 GRUB EFI 的工作原理，得知需要重新 `grub-install` 一下，原因是虽然 rootfs 分区 UUID 没有变，但是 Disk UUID 变了，所以需要把新的 EFI executable path 写到 NVRAM 里面，要不然 BIOS 不知道。  

### 打包数据

为什么上面这个 `dmesg` 没有存档呢？因为后续在 rsync Windows 数据到 NAS 备份盘的时候，发现了更加惊悚的一幕：

<figure>
  <img src="https://layered-assets.thu.fail/migration-2025-dmesg.jpg" class="preview">
  <figcaption>dmesg</figcaption>
</figure>

第一反应是线又坏了：前往小米之家购买了高级本命红颜色数据线，并且从 `ntfs3g` 更换为 `ntfs3`，还是爆炸，并且炸的更加严重，`rsync` 会直接彻底卡死。多次运行后注意到坏掉的 sector 稳定，所以真的是坏道了，而且 `ntfs3` 遇到坏道以后状态会直接爆炸，后续没办法再处理任何读取：

<figure>
  <img src="https://layered-assets.thu.fail/migration-2025-ntfs3.jpg" class="preview">
  <figcaption>dmesg</figcaption>
</figure>

所以为了至少救一点数据出来，换回了 `ntfs3g`。还好只有一个文件坏了，而且做了 [Parchive](https://wiki.archlinux.org/title/Parchive)，所以可以修回来，不过还是挺哈人的...

SMART 信息如下，应该已经坏了很久了。这台机器的 SMART 通知用的 SMTP 服务器挂了（自建 SMTP 服务器 TLS 证书过期，Certbot 没有正确执行 Hook 把 maddy 重启），所以没收到通知...

```
SMART Attributes Data Structure revision number: 10
Vendor Specific SMART Attributes with Thresholds:
ID# ATTRIBUTE_NAME          FLAG     VALUE WORST THRESH TYPE      UPDATED  WHEN_FAILED RAW_VALUE
  1 Raw_Read_Error_Rate     0x010f   084   062   ---    Pre-fail  Always       -       601824
  3 Spin_Up_Time            0x0103   088   086   ---    Pre-fail  Always       -       0
  4 Start_Stop_Count        0x0032   086   086   ---    Old_age   Always       -       14941
  5 Reallocated_Sector_Ct   0x0133   099   099   ---    Pre-fail  Always       -       208
  7 Seek_Error_Rate         0x000f   089   060   ---    Pre-fail  Always       -       908686414
  9 Power_On_Hours          0x0032   051   051   ---    Old_age   Always       -       43564
 10 Spin_Retry_Count        0x0013   100   100   ---    Pre-fail  Always       -       0
 12 Power_Cycle_Count       0x0032   100   100   ---    Old_age   Always       -       162
184 End-to-End_Error        0x0032   100   100   ---    Old_age   Always       -       0
187 Reported_Uncorrect      0x0032   001   001   ---    Old_age   Always       -       137
188 Command_Timeout         0x0032   100   001   ---    Old_age   Always       -       4522669620495
189 High_Fly_Writes         0x003a   055   055   ---    Old_age   Always       -       45
190 Airflow_Temperature_Cel 0x0022   059   029   ---    Old_age   Always       -       41 (Min/Max 41/71)
191 G-Sense_Error_Rate      0x0032   100   100   ---    Old_age   Always       -       0
192 Power-Off_Retract_Count 0x0032   100   100   ---    Old_age   Always       -       128
193 Load_Cycle_Count        0x0032   093   093   ---    Old_age   Always       -       15979
194 Temperature_Celsius     0x0022   041   071   ---    Old_age   Always       -       41 (0 13 0 0 0)
195 Hardware_ECC_Recovered  0x001a   036   003   ---    Old_age   Always       -       601824
196 Reallocated_Event_Count 0x0032   000   000   ---    Old_age   Always       -       57167
197 Current_Pending_Sector  0x0012   100   100   ---    Old_age   Always       -       27
198 Offline_Uncorrectable   0x0010   100   100   ---    Old_age   Offline      -       0
199 UDMA_CRC_Error_Count    0x003e   200   200   ---    Old_age   Always       -       0
240 Head_Flying_Hours       0x0000   100   253   ---    Old_age   Offline      -       20053 (226 47 0)
241 Total_LBAs_Written      0x0000   100   253   ---    Old_age   Offline      -       14240009369
242 Total_LBAs_Read         0x0000   100   253   ---    Old_age   Offline      -       1115691404091
```

## What else

除此之外还出现了一些搞笑情况，比如：

1. 在几乎同时，我工位上的工作站 990Pro 又掉盘了...我还以为是我手动为了损管给关了，结果第二天到了工位一看，怎么在 BIOS 里，Storage 空空的，这下坏了。
2. 断网检查了一圈没有恶意文件，然后网线一插，还是没网，心里一想坏了路由器上的脚本写炸了，结果排查了半天，最后发现是工位这一排的交换机电源线松了，然后是国庆所以无人注意到...欢迎报考世界一流大学计算机系.jpg
3. 学校提供的最新的 Windows 安装媒介镜像：
  <figure>
    <img src="https://layered-assets.thu.fail/migration-2025-lang.jpg" class="preview">
    <figcaption>English (Traditional)</figcaption>
  </figure>

4. 在小米之家购买 USB 线实录：

> 我：咱们这有兼容 USB 3 或者 Thunerbolt 的数据线吗？ \
> 店员：...?
> 
> 
> 我：咱这儿最好的数据线是啥？ \
> 店员：[拿来一个 A to C 的线] \
> 我：不不不，要 C to C 的
> 
> 接过 C to C 的线，翻过来看规格。 \
> 小米：规格 1A \
> 我：...?

5. 为了在 archiso 里面跑 `gparted`，安装了一个 `gdm`。结果 `gdm` 在启动图形界面的过程（包括创建 `xdg` 目录）不会有任何其他“忙碌”指示，需要干等大概两分钟，然后 archiso 又有一个特别长的 motd，导致我一直以为是 Xorg 哪里挂了...

  The best part：如果这个时候切换 Terminal，`gdm` 会直接把 session 杀掉...

  <figure>
    <img src="https://layered-assets.thu.fail/migration-2025-gdm.jpg" class="preview">
    <figcaption>gdm</figcaption>
  </figure>

6. 主机是一个 NUC10，所以主板 SATA 是个排线，经过这一晚上折腾最后松了，于是：

  <figure>
    <img src="https://layered-assets.thu.fail/migration-2025-ata.jpg" class="preview">
    <figcaption>ata</figcaption>
  </figure>

## Final remarks

最后在群友的建议下购入了 HBA 卡，搞正经 NAS 了。

对于诈骗本身而言，有一个很大的隐患是很多 Key 都在工作机上，而恶意软件被执行的时候是有一个活跃的 SSH 连接在一个窗口上的。如果恶意软件有远控能力的话，那很容易所有服务器都被打穿了。还好后续分析了一下就是个简单币圈诈骗软件，不过还是最好推进一下用 YubiKey 登录。

不过在用电视工作的时候距离电脑 USB 口好远，不知道有没有远程 USB 的设备呢？USB/IP on RaspberryPi?