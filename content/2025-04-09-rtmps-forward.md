---
title: RTMP(S) proxy with NGINX
tags: 灵车
---

由于最近 Tunight 会议软件换成了腾讯会议，已经很久没办法直接推 YouTube 流了，十分头疼。在一个腾讯会议服务器可以摸到的服务器上设置一个 RTMP Proxy，既可以解决推流问题，这样以后不再需要 OBS 直播腾讯会议窗口了，以后也可以在多个平台上同时推流。

考虑到 Stream key 的安全性，使用 RTMPS。由于 RTMPS 就是 RTMP 直接套了一层 TLS，使用 NGINX Stream 做 TLS Termination 即可。如下配置是从 [https://serverfault.com/a/1019344](https://serverfault.com/a/1019344) 略加修改抄来的：

```nginx
stream {
    log_format basic '$remote_addr [$time_local] '
                 '$protocol $status $bytes_sent $bytes_received '
                 '$session_time';
    access_log /var/log/nginx/stream.log basic buffer=32k;
    upstream backend {
        server 127.0.0.1:1936;
    }
    server {
        listen 1935 ssl;
        proxy_pass backend;
        ssl_certificate /etc/letsencrypt/live/rtmp.example.com/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/rtmp.example.com/privkey.pem;
    }
}

rtmp {
    access_log /var/log/nginx/rtmp.log;
    server {
        listen 127.0.0.1:1936;
        chunk_size 4096;

        application <key> {
            live on;
            record off;
            push rtmp://a.rtmp.youtube.com/live2/<YouTube stream key>;
        }
    }
}
```

`<key>` 应该是一个随机字符串。在同一个 `application` 块内添加多个 `push` directive 可以同时推多个流，添加 `application` 可以增加一个 proxy endpoint.

注意事项：
1. OBS 填路径的时候，应该把 Stream key 留空，推流地址写 `rtmps://rtmp.example.com:1935/<key>`。这是因为在上述配置中用于验证的 `<key>` 随机字符串是在 `application` 位置，而不是 RTMP URL 的 name 位置。`nginx-rtmp-module` 缺乏使用 name 做验证的能力，我也没找到通过 name 修改 `push` 目标的方法，所以只能写在 `application`.
2. 默认 RTMPS 端口是 443，如果想用 `certbot --nginx` 的话它会自己搞出来一个 HTTPS 的 `server` 块儿，和 Stream 的 `server` 块儿就冲突了。因此这里使用了 1935 避开了 HTTPS 的端口，代价是写推流地址的时候需要带端口。
3. RTMP 监听在 `127.0.0.1` 上。如果同时希望接受未经加密的 RTMP，`listen` 只写一个端口即可。
