---
title: restic store on HDD
tags: 踩坑
force_publish_time: 2023-08-14T14:34:46.656Z
force_update_time: 2023-08-14T14:34:46.656Z
---

因为懒得倒垃圾，现在 Restic 里面一共有快 40k 个 snapshot

```bash
> ~ ls /srv/restic/snapshots | wc -l
39236
```

之前 restic 是放在 MinIO 里的，但是每次 restic 需要推新的 snapshot 或者列出 snapshot 的时候，需要把整个 snapshot 全量同步到本地。MinIO 放在 ext4 上，底下是 HDD，读 40k 个小文件直接把 IO 打爆了，然后超时。

灵车 Idea：RAID1 on HDD/tmpfs。然后读取全都从 tmpfs 里读，相当于让 tmpfs 作为一个 writeback cache。mdadm 里有两个选项专门用来处理这件事：

- `--write-mostly`: 指定某个设备主要处理写，读从其他设备读。把比较慢的设备 (In our case, storage on HDD) 放在这个选项后面。
- `--write-behind`: 允许写提前完成。

这样可以搞出来一个 Good enough™ 的缓存。如果一致性需要更好一些，可以把 write-behind 去掉。最后由于 mdadm 需要在设备上面建 raid，需要把 dd 出来的文件给 loop mount 一下。

```bash
> dd if=/dev/zero of=/restic-disk bs=1M count=768
> cp /restic-disk /tmp/restic-disk-0

> losetup /dev/loop0 /restic-disk
> losetup /dev/loop1 /tmp/restic-disk-0
> mdadm --create --verbose /dev/md0 --level=1 --raid-devices=2 /dev/loop1 --write-mostly /dev/loop0 --write-behind=256 --bitmap=internal
```

最后，在重启之后这个 md 会挂掉（因为两个 loop device 都不在）。重建的时候需要先把 HDD 上的镜像给加上，然后 mark clear，之后再重建，要不一键删库。
