---
title: Chisel3 踩坑实录
tags: 踩坑
force_publish_time: 2019-12-01T15:01:20.119Z
force_update_time: 2020-03-21T04:35:43.490Z
---

简单记一下最近写 Chisel3 遇到的各种各样玄学问题，作为参考。

1. Verilator 是唯一一个可以正常仿真 SyncReadMem 而且可以输出波形图的后端，而且跑得很快，问题是 printf 的时候会丢东西，所以如果用 printf 调试，treadle 比较好
2. Mem\[Vec\[T\]\] 比 Seq\[Mem\[T\]\] 好，后者在 Verilator 里 VecInit(mems.map...) 可能读不出来东西，生成出来时序也不太行，但是前者的信号名字会有个前缀
3. Mux1H is a thing, 生成出来的时序比 MuxCase(seq.map(f)) 效果好很多
4. ChiselEnum 甚至时序会好一些，神秘

然后是一些犄角旮旯里的东西：

## MultiIOModule
就不用把十万个信号都写到同一个 val io 里面了。比如如果在写处理器的 InstrFetch:

```scala
class InstrFetch(implicit val opts: CoreOpts) extends MultiIOModule {
  val toCtrl = IO(new Bundle { /* ... */ })
  val toL1IC = IO(new Bundle { /* ... */ })
  val toExec = IO(new Bundle { /* ... */ })
}
```

然后在外面就可以
```scala
val instrfetch = Module(new InstrFetch())
val l1ic = Module(new L1IC())
val exec = Module(new Exec())
/* ... */

instrfetch.toL1IC <> l1ic.toIF
instrfetch.toExec <> exec.toIF
/* ... */
```

## Memory elaboration
SyncReadMem 通常会被 Vivado 整成 BRAM, Mem 会被整成 LUTRAM，但是前提是，读取口和写入口的数量有限。例如如果要求零周期，但是同时最多可能有两个并发写入口的话，就会被整成 Register bank。

读取口的复用应该是 firrtl 可以完成的优化，但是有的时候这个优化不生效。即使是两个互斥条件下的写入也会被 firrtl 生成两个写入口，然后就爆炸。例如这种：

```scala
when(cond) {
  mem.write(addr, data1);
}.otherwise {
  mem.write(addr, data2)
}
````

这个可能会生成两个写入口。因此写成这样更好

```scala
mem.write(addr, Mux(cond, data1, data2))
```

或者用另外一个 wire 控制写入。

```scala
val writing = Wire(Bool())
val waddr = Wire(UInt())
val wdata = Wire(UInt())

mem.write(waddr, wdata, writing)

// Default value
writing := false.B
waddr := DontCare
wdata := DontCare

def write(addr, data) {
  waddr := addr
  wdata := data
  writing := true.B
}
```

## Memory mask
如果 Memory 的类型是一个 `Vec[T]`，传进去的第三个参数就可以是一个 `Vec[Bool]` 表示写入 mask。如果不是一个 `Vec[T]`，第三个参数可以是一个 `Bool`
