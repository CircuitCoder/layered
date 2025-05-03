---
title: 在线种种子
tags: 搭积木, 约稿
legacy: true
force_publish_time: 2019-05-18T09:18:45.095Z
force_update_time: 2019-05-18T10:30:41.305Z
---

百度不太行，为了用离线下载还要购买**大**会员。自己摸一个

## TL;DR
- [rTorrent](https://github.com/rakshasa/rtorrent): 下载后台
- [flood](https://github.com/Flood-UI/flood): 下载前台
- filebrowser: 高端版本 Nginx autoindex
- nginx + LE: 转发
- systemd: dOiNg SyStEmD sTuFf

## 假设环境
一台独立的 Linux 主机，拥有 root 权限。

以下以 ArchLinux 作为示例发行版

## 安装依赖
```bash
pacman -S nginx certbot certbot-nginx rtorrent go nodejs npm git python2 base-devel
```

go 是用来编译一个 filebrowser 的 fork 的，主仓库的版本没有缩略图，而且已经十万年没有 Commit 了。

python2 是用来编译 Node 的 native extensions。由于 Arch 早就把 Python2 除名了，所以需要安一个。

base-devel 是 Arch 的一个包的集合，我们用到的是 make 和 gcc。应该大多数发行版都是自带的把...这个 Arch 是因为是被我从 alpine bootstrap 起来的，所以当时缓存在内存里，空间比较小，就没得。

## 下载部分

我们希望能够做到以下事情：
- 可以远程管理
- 可以自动把下载完的文件挪动到另一个目录，这样可以避免打开服务器上还没下完的文件
- 限制上传 Ratio
- 死掉之后能够重启，还能够继续下

以上除了远程管理用 WebUI 解决以外，rTorrent 都可以解决。为此 rTorrent 需要一个配置文件，`~/.rtorrent.rc`。作为示例，我的配置如下：

- 假设 rTorrent 的工作路径位于 /store/rtorrent。这个路径会存放 Log 和 Session 之类的东西，以及下到一半的
- 假设我们希望下好的文件放到 /store/ready
- 假设使用 root(挺不安全但是我服务器上反正没啥东西)

```
# /root/.rtorrent.rc

#############################################################################
# A minimal rTorrent configuration that provides the basic features
# you want to have in addition to the built-in defaults.
#
# See https://github.com/rakshasa/rtorrent/wiki/CONFIG-Template
# for an up-to-date version.
#############################################################################


## Instance layout (base paths)
method.insert = cfg.basedir,  private|const|string, (cat,"/store/rtorrent/")
method.insert = cfg.download, private|const|string, (cat,(cfg.basedir),"download")
method.insert = cfg.logs,     private|const|string, (cat,(cfg.basedir),"log/")
method.insert = cfg.logfile,  private|const|string, (cat,(cfg.logs),"rtorrent-",(system.time),".log")
method.insert = cfg.session,  private|const|string, (cat,(cfg.basedir),".session/")
method.insert = cfg.watch,    private|const|string, (cat,(cfg.basedir),"watch/")


## Create instance directories
execute.throw = sh, -c, (cat,\
    "mkdir -p \"",(cfg.download),"\" ",\
    "\"",(cfg.logs),"\" ",\
    "\"",(cfg.session),"\" ",\
    "\"",(cfg.watch),"/load\" ",\
    "\"",(cfg.watch),"/start\" ")


## Listening port for incoming peer traffic (fixed; you can also randomize it)
network.port_range.set = 50000-50000
network.port_random.set = no


## Tracker-less torrent and UDP tracker support
## (conservative settings for 'private' trackers, change for 'public')
dht.mode.set = auto
protocol.pex.set = no

trackers.use_udp.set = no


# 这里是 Rtorrent 项目给出的推荐 Throttle 设置
## Peer settings
throttle.max_uploads.set = 100
throttle.max_uploads.global.set = 250

throttle.min_peers.normal.set = 20
throttle.max_peers.normal.set = 60
throttle.min_peers.seed.set = 30
throttle.max_peers.seed.set = 80
trackers.numwant.set = 80

protocol.encryption.set = allow_incoming,try_outgoing,enable_retry


## Limits for file handle resources, this is optimized for
## an `ulimit` of 1024 (a common default). You MUST leave
## a ceiling of handles reserved for rTorrent's internal needs!
network.http.max_open.set = 50
network.max_open_files.set = 600
network.max_open_sockets.set = 300


## Memory resource usage (increase if you have a large number of items loaded,
## and/or the available resources to spend)
pieces.memory.max.set = 1800M
network.xmlrpc.size_limit.set = 4M


## Basic operational settings (no need to change these)
session.path.set = (cat, (cfg.session))
directory.default.set = (cat, (cfg.download))
log.execute = (cat, (cfg.logs), "execute.log")
#log.xmlrpc = (cat, (cfg.logs), "xmlrpc.log")
execute.nothrow = sh, -c, (cat, "echo >",\
    (session.path), "rtorrent.pid", " ",(system.pid))


## Other operational settings (check & adapt)
encoding.add = utf8
system.umask.set = 0027
system.cwd.set = (directory.default)
network.http.dns_cache_timeout.set = 25
schedule2 = monitor_diskspace, 15, 60, ((close_low_diskspace, 1000M))
#pieces.hash.on_completion.set = no
#view.sort_current = seeding, greater=d.ratio=
#keys.layout.set = qwerty
#network.http.capath.set = "/etc/ssl/certs"
#network.http.ssl_verify_peer.set = 0
#network.http.ssl_verify_host.set = 0


## Some additional values and commands
method.insert = system.startup_time, value|const, (system.time)
method.insert = d.data_path, simple,\
    "if=(d.is_multi_file),\
        (cat, (d.directory), /),\
        (cat, (d.directory), /, (d.name))"
method.insert = d.session_file, simple, "cat=(session.path), (d.hash), .torrent"


## Watch directories (add more as you like, but use unique schedule names)
## Add torrent
schedule2 = watch_load, 11, 10, ((load.verbose, (cat, (cfg.watch), "load/*.torrent")))
## Add & download straight away
schedule2 = watch_start, 10, 10, ((load.start_verbose, (cat, (cfg.watch), "start/*.torrent")))


## Run the rTorrent process as a daemon in the background
## (and control via XMLRPC sockets)
#system.daemon.set = true
#network.scgi.open_local = (cat,(session.path),rpc.socket)
#execute.nothrow = chmod,770,(cat,(session.path),rpc.socket)


## Logging:
##   Levels = critical error warn notice info debug
##   Groups = connection_* dht_* peer_* rpc_* storage_* thread_* tracker_* torrent_*
print = (cat, "Logging to ", (cfg.logfile))
log.open_file = "log", (cfg.logfile)
log.add_output = "info", "log"
#log.add_output = "tracker_debug", "log"

### END of rtorrent.rc ###

# 这一部分控制自动移动完成的文件
method.insert = d.get_finished_dir, simple, "cat=/store/ready/,$d.custom1="
method.insert = d.move_to_complete, simple, "d.directory.set=$argument.1=; execute=mkdir,-p,$argument.1=; execute=mv,-u,$argument.0=,$argument.1=; d.save_full_session="
method.set_key = event.download.finished,move_complete,"d.move_to_complete=$d.data_path=,$d.get_finished_dir="

# 这一行指定了 XMLRPC Socket，之后会在 SystemD 里以 Daemon 模式启动 rtorrent，flood 需要连接这个 Unix Socket
scgi_local = /var/run/rtorrent.sock

# 配置上传 Ratio，以下数字的单位都是 0.01，所以下面配置的意思是，最少上传 10 倍，最多 100 倍
ratio.enable=

ratio.min.set=1000
ratio.max.set=10000

# 达到了 ratio 之后自动停止
method.set = group.seeding.ratio.command, "d.close="
```

rTorrent 的 wiki 位于 [https://github.com/rakshasa/rtorrent/wiki](https://github.com/rakshasa/rtorrent/wiki)，可以自行观摩。

测试一下 rTorrent 配置
```bash
mkdir -p /store/rtorrent /store/ready
rtorrent
```

应该会正常启动 rTorrent。使用 Ctrl-q 退出

之后写一个 systemd 配置
```ini
# /etc/systemd/system/rtorrent.service

[Unit]
Description=rTorrent Daemon
After=network.target

[Service]
KillMode=process
User=root
ExecStart=/usr/bin/rtorrent -o system.daemon.set=true
WorkingDirectory=/store/rtorrent
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

`Restart=on-failure` 的意思是当返回值不是 0 的时候自动重启。

最后把 rTorrent 启动起来
```
systemctl enable --now rtorrent
systemctl status rtorrent
```

应该会显示 `Active: active (running)`

注意，如果使用非 Root 用户运行的话，可能需要考虑 `/var/run` 目录的可写性。可以通过多加一层路径 `/var/run/rtorrent` 解决。

接下来搞一个 Flood 作为前端。作为示例：
- 暴露给 Nginx 的反代端口是 8013

```bash
cd /store
git clone https://github.com/Flood-UI/flood.git
cd flood

# 做一些配置，主要是监听端口和密钥。
# 因为我们用 Nginx 搞 TLS/SSL，所以在 Flood 这里不用启动 SSL 支持
# 这样生成 16 个字符的密钥：
head /dev/urandom | tr -dc A-Za-z0-9 | head -c 16 ; echo ''
cp config.template.js config.js && editor config.js
# 在你喜欢的编辑器里把 floodServerPort 和 secret 改掉。作为示例
# floodServerPort: 8013,
# secret: 'abcdefghijklmn',

# 装依赖 & 编译静态资源
npm install && npm run build

# Creating an optimized production build 这一步非常慢
```

测试能不能正常执行，就在 flood 的目录内：
```bash
npm start
# Ctrl-C 结束
```

一切正常的话说明 Flood 本身可以跑起来了。之后我们需要一个 Systemd 服务来控制，以及一个 Nginx site。先把 systemd 配置写了。

- 上面是在 /store/flood 里安装的 flood，下面的 service unit 配置也对应
- ArchLinux 安装的 npm 位于 /usr/bin/npm，可能不同的发行版不一样，用 `which npm` 检查一下

```ini
# /etc/systemd/system/flood.service

[Unit]
Description=Flood rTorrent Web UI
After=network.target rtorrent.service

[Service]
WorkingDirectory=/store/flood
ExecStart=/usr/bin/npm start
User=root

[Install]
WantedBy=multi-user.target
```

之后启动并检查状态
``` bash
systemctl enable --now flood
systemctl status flood
```

接下来搞 nginx。
- 这里你需要一个域名，我们假设叫做 `rt.box.c-3.moe`，并且解析已经指过来了

Ubuntu 系列 Nginx 有一个 sites-enabled 目录，用来存放所有 sites。Arch 没有，Debian 只有一个 conf.d，不完全一样。为了给这些发行版添加类似的目录，在 `/etc/nginx/nginx.conf` 内做以下修改：

```
# /etc/nginx/nginx.conf

http {

  # ...
  
  include sites-enabled/*;
}
```

建立 `/etc/nginx/sites-enabled` 目录后，进去一个文件，叫做 `rt`:
```
# /etc/nginx/sites-enabled/rt
server {
  listen 80;
  server_name rt.box.c-3.moe;

  location / {
    proxy_set_header Host $host;
    proxy_pass http://localhost:8013/;
  }
}
```

如果你的反代端口不是 8013，要作出对应修改。

之后启动 nginx:
```bash
systemctl enable --now nginx
```

访问 `http://rt.box.c-3.moe`，应该就可以看到初始设置页了。在设置之前先把 SSL 证书搞了

```bash
certbot --nginx
# 根据提示回答问题，redirect 那里选择自动重定向 (输入 2)
```

浏览器刷新一下，就变成 https 了。

创建账户随便写，下面的连接选项选 Unix Socket，路径写 `/var/run/rtorrent.sock` 或者改成的别的的路径。点 Create 之后就可以进到主页面了。

右上角加号添加，Destination 可以不用填，因为配置了 rTorrent 的默认下载路径。对话框下方 Start Torrent 不选的话默认是不开始下的。

现在其实已经开始用了...如果你对文件下载不需要很 fancy 的 UI，把 nginx 直接指过去就行：

在 `/etc/nginx/sites-enabled/rt` 里面第一个 server 块里，server_name 后面直接加几行：

```
server {
  # ...
  server_nane rt.box.c-3.moe;
  
  location /dwn {
    autoindex on;
    alias /store/ready;
  }
  
  # ...
}
```

之后更新 Nginx 配置：
```
systemctl reload nginx
```

访问 `https://rt.box.c-3.moe/dwn` 就可以看到下好的文件了。Chrome 也可以直接放视频，一秒变成流媒体。
