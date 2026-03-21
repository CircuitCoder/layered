---
title: NixOS in a (nspawn) box
tags: Linux
---

最近开始高强度 Vibe，继续推进把思考转移给<ruby>流浪猫<rp>(</rp><rt>LLM</rt><rp>)</rp></ruby>的伟大历程。为了让 Agent 能够通宵工作，跳过所有 Approval，需要把它放到一个容器里。为了能够让多个容器可以共享部分文件系统内容（e.g. 基础库，编译器，etc），一个常见方法是 Docker 然后让他们都共享 Overlay，但是容器重建之后已经下好的东西还是丢了。

Idea：NixOS，但是所有容器共享 daemon 和 store，所有构建交给 Host 上的 Nix daemon 做，这样可以最大化利用缓存，共享文件系统内容，还顺便提供了 Immutability 和 Reproducibility。

结论是这是可以工作的，见 [CircuitCoder/nixos-nspawn-container](https://github.com/CircuitCoder/nixos-nspawn-container). 基本流程是：

- 在 Host 上，根据 NixOS 的初始配置，构建一个 system derivation，symlink 到 `/nix/var/nix/gc-roots/per-container/<ID>/system`.
- 生成一个 rootfs，里面把初始配置复制进去放到 `/etc/nixos/configuration.nix`.
- 生成 nspawn 配置，把 socket，store，还有 per-container 的 gcroot 给 bind mount 进去。

nspawn 和 NixOS 配置会有一些 Caveat，记录一下。

## nspawn rootfs

nspawn 管的很宽，[他会看 Rootfs 里面有没有 `os-release`](https://github.com/systemd/systemd/blob/61bceb1/src/nspawn/nspawn.c#L6356-L6369)，没有的话拒绝执行。

问题：他是在进行 Bind mount 和 chroot 之前检查的。然后 NixOS 会在启动之后把 `/etc` 里面内容全都变成 symlink，然后 nspawn 看不懂 `os-release` 内容就爆炸了...

还好 nspawn 除了 `/etc/os-release` 之外[还会检查一个 fallback `/usr/lib/os-release`](https://github.com/systemd/systemd/blob/7c1075fb8ff2d3b87fa463d542e2e00ac086cbd3/src/basic/os-util.c#L105-L114)，这个目录（暂时）不会被 NixOS 覆盖掉，所以可以把 `os-release` 放在这里。不过只能在这里放一个文件而不是 Symlink 了。

## gcroots

为了避免 Host 上的 GC 把容器里面在用的东西给扬了，常见的做法是把容器的 system derivation 放到 `gcroots` 下面。Nix 已经有一个 `/nix/var/nix/gcroots/per-container` 目录专门用来干这件事儿了，所以可以进行如下的 Bind mount:

```
/nix/var/nix/gcroots/per-container/<ID> -> /nix/var/nix/profiles
```

这样容器里用到的所有 profile 都会自动进到 Host 的 gcroots 里。

一些要注意的地方：NixOS expects rootfs 在 `/nix/var/nix/profiles/system` 下，`nixos-rebuild` 会生成的也都会在这个目录下放，所以这个目录得 RW mount，而且如果开 UID namespace 的话，里面的 root 在外面没有权限写这个目录，所以得开 idmap。如果在 zfs 上，没有 idmap 支持的话，可能得把 UID namespace 关了。

## Initial build

在普通 Nix setup 上其实也可以 build NixOS system derivation:

```bash
nix-build "$CHANNEL" -A system -I "nixos-config=$CONFIG" --no-out-link
```

NixOS 会预期 system derivation 在 `/nix/var/nix/profiles/system` 下面，所以我们需要手动把它 symlink 到 `/nix/var/nix/gcroots/per-container/<ID>/system`.

## Init

nspawn 默认会去找 `/usr/lib/systemd/systemd` 来当 init。NixOS 里面的 systemd 在 store 里，所以这样自然找不到。不过我们可以用 system derivation 里面的 init wrapper 脚本，注意得用容器里面的路径。在 nspawn 配置里需要加：

```
[Exec]
Parameters=/nix/var/nix/profiles/system/init
```

## NixOS config

首先，因为 daemon socket 是外面来的，我们得把容器里面的 daemon 干掉，并且要求所有 Nix 操作经过 daemon：

```nix
boot.isContainer = true;

# Daemon socket is bind mounted from the host
systemd.services.nix-daemon.enable = false;
systemd.sockets.nix-daemon.enable = false;

# Store is ro-mounted
nix.gc.automatic = false;
nix.optimise.automatic = false;

# Force commands through the daemon
environment.variables.NIX_REMOTE = "daemon";
```

虽然即使这样做了，nix 命令还是会抱怨找不到 db。我们可以把 db 也 RO bind mount 进去：`NIX_REMOTE = "daemon"` 的时候，nix 不会直接修改 db，一定会通过 daemon。此外，这个 setup 在初次启动的时候，不会把外面的 channel 也加进去，所以如果 `configuration.nix` 依赖了特定 channel，在第一次 rebuild 之前在里面对应跑一次 `nix-channel --add` 就行了。

NixOS 默认自然不会预期自己在容器里面执行。SystemD 会自动检测容器的存在，但是 NixOS 的各个脚本默认会预期自己在物理机上执行，这导致 `nixos-rebuild switch` 的时候 NixOS 的 activation script 会尝试 mount 各种 special fs，但是这些 fs 已经被 nspawn 管理了。注意到 switch 并不会 pivot root，所以之前已经 mount 好的东西不会掉。我们只需要让 NixOS 不要自己 mount：

```nix
system.activationScripts.specialfs = lib.mkForce "";
```