---
title: 掐灭数字人生
tags: 认真学习
legacy: true
force_publish_time: 2019-03-28T18:28:58.287Z
force_update_time: 2019-07-15T08:31:53.473Z
---

### 勘误 @ 2019-4-26
模拟时的参数值用等号连接

---

我们终于有了认真学习这个 Tag。

事情的起因是我不想在台式机上装 Quartus。SO 和 Google 告诉我：GHDL

## 安装
The wrong way:
```bash
$ aruman -S ghdl

~~ calculating solutions...

:: The following 2 package(s) are getting installed:
   core/gcc-ada  /            ->  8.2.1+20181127-1
   aur/ghdl      /            ->  0.36-1

?? Do you want to continue? Y/n: y

... one hours later ...
[ Something about compiling GCC ]
^C^C^C^C^C^C
```

研究了一下发现 GHDL 有两个版本，一个用 GCC 做后端，一个用 mcode，ghdl 这个包是用 GCC 的，编译 GCC 十万年，直接从源码编译默认用 mcode，也不需要 GCC source，快很多：
```bash
$ git clone https://github.com/ghdl/ghdl.git
$ cd ghdl && ./configure --prefix=/usr/local && make
$ make install
```

## Simulation
先得写一个顶级 entity
```
ghdl -a *.vhdl
ghdl -e main
ghdl -r main --stop-time=100ns --vcd=wave.vcd
gtkwave wave.vcd
```
