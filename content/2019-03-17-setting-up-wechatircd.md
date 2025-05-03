---
title: 设置 wechatircd
tags: 搭积木
legacy: true
force_publish_time: 2019-03-17T09:39:46.063Z
force_update_time: 2019-05-18T08:53:58.702Z
---

终于受不了 Windows Insider 隔三差五推更新了。Fast Ring 也不能一周三个更新啊...然后晚上一睡觉起来一看微信没了，服了。

wechatircd 放在服务器上

```bash
yay -S wechatircd-git
systemctl start wechatircd
```

然后用 Chromium
```bash
tmux

# Within tmux
xvfb-run -n 99 chromium --user-data-dir=$HOME/.config/chromium-wechatircd --no-sandbox
```
no-sandbox 当然是因为我懒得设置隔离用户了，直接 root 跑的

跑一个 vnc 到本地

```bash
pacman -S x11vnc
x11vnc -display :99 -localhost
```

在 Local，WSL 外面跑 vcxsrv，WSL 里面：
```bash
export DISPLAY=:0
export LIBGL_ALWAYS_INDIRECT=1
ssh [YOUR_IP_HERE] -L 5900:localhost:5900

# On another tab
pacman -S tigervnc
vncviewer localhost:5900
```

然后就可以看到 Chromium 了

安装一个 tampermonkey，装上 wechatircd 的脚本，信任一下证书，之后额外装一个 Extension: EditThisCookie，用来导出服务器 Chromium 上的 Cookie 扔到本地的 Chrome 里。 `document.cookie="..."` 不太管用，可能是因为 HTTPOnly 之类的设置。

然后打开 https://wx2.qq.com，照常登陆，用 EditThisCookie 把曲奇复制出来，服务器上的操作就可以结束了。我还在服务器上用 tmux 跑了个 WeeChat，因为服务器上碰巧有 LE 的证书，然后有的时候懒得再 Windows 上装 IRC 客户端，直接用 Glowing bear 就可以了。

wechatircd 的 IRC 监听端口是 6667，额外反代一个用来 DCC 的端口，映射方向是反着的
```
ssh [YOUR_IP_HERE] -L 6667:localhost:6667 -R 5000:localhost:5000

# On another tab
pacman -S weechat
weechat

# Within WeeChat
/server add wechat 127.1/6667 -autoconnect
/set xfer.network.own_ip 127.0.0.1
/set xfer.network.port_range 5000
```

然后如果用 Glowing bear:
```
/relay add wechat 9001
/set relay.network.password [PASSWORD]
```

Chrome 导入一下 Cookie，访问 https://www.glowing-bear.org ，连接一下就好了，发图片文件、收图片文件都可以。

---

最后为了使用自动爬图，换成了 thelounge，魔改了一下 crawler 把自己的 Cookie 放进去了，就可以看到微信的图片。

下一步希望能把 thelounge 自带的文件上传改成 DCC，这样可以直接发送微信图片/文件。现在发出去是一个链接，其他微信用户非常挠头

到现在为止接近一个月的时间，没有需要我重新扫码，稳定性非常靠谱。
