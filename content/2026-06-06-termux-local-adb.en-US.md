---
title: Termux local ADB and secure access
tags: Android, 灵车
---

Sometimes we want to use Termux to connect to the host Android device's ADB directly. One use case is that on debug builds (builds with ADB root shell enabled), we can go into a root shell and then, for example, set up FUSE mounts or iptables.

[Previously](/post/android-nfs) on my old LineageOS installation, we noticed a weird "emulator-5554" device showing up whenever we used `adb devices` inside Termux. This is curious because there is definitely no emulator running on an Android device, and I have no recollection of tampering with port 5554. It turns out that I'd previously set a TCP listener on port 5555 using:

```bash
adb root
adb shell "setprop service.adb.tcp.port 5555"

# Or temporarily
adb tcpip 5555
```

Android emulators by default put their serial ports on even ports starting from 5554, and ADB listeners on the following odd ports. Whenever ADB clients [find an ADB listener **on localhost**](https://github.com/joneschrisg/android-system-core/blob/master/adb/transport_local.c#L136) that lands in these ranges, they interpret it as an emulator device, so ADB shows an `emulator-5554` device, even if there is nothing on port 5554.

```
/ # adb devices
List of devices attached
emulator-5554   device
```

Note that this is an *unsecured* endpoint, different from the modern wireless ADB (`adb pair` / `adb connect`) mechanism, which uses an authenticated, encrypted connection to the ADB daemon. This is insecure in two ways:
- Anyone can connect to it without authentication. By default it listens on `0.0.0.0`, and we have no way of changing that.
- The connection is not encrypted.

But it also has several benefits over wireless ADB:
- You don't need to pair or connect to the device first, which might be tedious. Since the pairing code dialog shows up as a modal dialog, you need to use a split screen to simultaneously see the dialog and interact with Termux.
- The port is fixed, so we can automate accessing a root shell using a script. Wireless ADB's port will change on every boot.

If we want to enable the ADB TCP listener on port 5555, we'd better use other means to restrict access to the port, especially if we are going to enable root `adb shell` access. Note that if you think this is too much of a burden, you may want to stick with modern wireless ADB instead.

We can do this with the netfilter subsystem (`iptables` or `nftables`).

## Securing ADB TCP listener

First check if our kernel supports `iptables` or `nftables`. Both will do, but if neither is available, you might want to just use modern wireless ADB.

```bash
# In Termux unprivileged shell
zcat /proc/config.gz | grep IPTABLES
zcat /proc/config.gz | grep NF_TABLES
```

I have `iptables` enabled. The following rules should be sufficient to only allow local access from the Termux user, and block anything else (other loopback users, remote access, etc.)

```bash
TERMUX_USER=$(stat -c %u /data/data/com.termux)

# Drop everything not coming from loopback
iptables -A INPUT ! -i lo -p tcp --dport 5555 -j DROP
# On loopback, drop everything not coming from the Termux user
# Allow shell (UID 2000) and root (UID 0) just in case you need native debugging
iptables -A OUTPUT -o lo -p tcp --dport 5555 -m owner --uid-owner 2000 -j ACCEPT
iptables -A OUTPUT -o lo -p tcp --dport 5555 -m owner --uid-owner 0 -j ACCEPT
# Allow Termux
iptables -A OUTPUT -o lo -p tcp --dport 5555 -m owner --uid-owner $TERMUX_USER -j ACCEPT
# Drop everything else
iptables -A OUTPUT -o lo -p tcp --dport 5555 -j DROP
```

Place this script somewhere that will be executed on boot. For example, Magisk users have a [boot script directory](https://topjohnwu.github.io/Magisk/guides.html#boot-scripts) `/data/adb/service.d`. If you're using LineageOS with root ADB enabled, you can use `adb remount` to directly get a writable `/system` and just place the script in `/system/etc/init.d`. Just be careful. For myself, I'm content with just running the script manually after boot.

## Bonus: starting Termux bash inside an ADB root shell

It turns out that `adb shell <command>` [will run the command in non-interactive mode](https://stackoverflow.com/questions/18275504/reading-input-interactively-from-adb-shell-command/30798253#30798253) (no PTY allocation), so we cannot just use `adb shell $(which bash)` to start a bash shell. So if you need an interactive session, you have to manually enter `adb shell` and type the bash executable path yourself. Most of the time it's at `/data/data/com.termux/files/usr/bin/bash`; you can use `which bash` to find it. Also remember to `export PATH=/data/data/com.termux/files/usr/bin:$PATH`.

If you only need to run a script, you can use `adb shell`. Remember to add a shebang (`#!/data/data/com.termux/files/usr/bin/bash`) at the top of the script.
