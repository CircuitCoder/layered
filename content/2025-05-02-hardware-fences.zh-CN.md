---
title: Fences 的硬件实现
tags: 微架构,Fences
---

最近在研究小栅栏。本文简单介绍一下注意到的普通的小栅栏的硬件实现注意事项。

这里普通的小栅栏指普通的 Acquire / Release Fences，暂时先不考虑 SeqCst，将后续有文章具体讨论它。

Acquire / Release semantics 的定义比较简单，在大多数 ISA / 编译器 / 高级语言实现中都是一致的，大概都会是如下形式：
- 在线程 1 中，A 内存操作发生在 X Release Store “之前”
- 在线程 2 中，B 内存操作发生在 Y Acquire Load “之后”
- Y 观测到 X 的值
- 那么 B 必须发生在 A “之后”

这里一堆 “之前之后” 取决于不同的层级，在这一系列事件中担当的职责，或者针对不同种类的指令定义有所不同。通常而言，同一个线程内的先后关系由 Program order 指定，不同线程之间的“先后关系”并不是全序，但是被确定的部分会反映到修改序或者观测序上，例如如果对同一个地址的 Store A 发生在 Load B 之前，那么 B 可能读到 A 的值，或者 A 之后，B 之前另一个 Store 的值。<sup>[1]</sup>

注意这里真正建立先后关系的是生效的 Rel-Acq 对。在处理器眼里，如果 Acq Ld 读到了 Rel St，那么这个“读到了”一定发生在某个硬件结构上，他自然有个先后关系：Rel St “先”在这个器件上生效了，Acq Ld “后”读到了这个器件上的值，Whatever it means。微架构实现 AMO 序的关键就在于把这个器件上“读到了”这个自然的先后关系沿着 Program order 在两个核心上向两侧扩展。

因此本文接下来讨论的主要是两件事儿：
- 怎么扩展 Program order
- More subtly, 怎么捕捉这个“读到了”的先后关系，把这个序变成一个可以扩展的基础

## AMO 操作的实现框架

写锁的时候通常不会直接用 Fence，原因是 AMO 写起来直觉多了，而且大多数时候只有一个 Sentinel，所以同步操作可以和某个特定的内存地址/内存操作绑定。相比之下，Fence 的形式化定义会复杂很多，主要困难的地方就在于它没有像上文例子中一个绑定明确的，构成 Rel-Acq pair。然而在硬件实现上，通常是将 AMO + Order 实现为 Relaxed AMO + Fence 副作用，这里 Fence 副作用指影响不同访存指令的生效顺序。

举个例子。RISC-V 微架构实现 Acquire Load 的时候，通常会执行这个 Load，然后等待 Load queue 全部清空（或者如果 L1 保证顺序处理请求，全部发往 L1）。这个正好和进行一个普通的 Load，然后进行一个 `fence.r.rw` 是一样的。

之所以这么做，是因为硬件上本来已经知道了 Program order，但是现代处理器会做很多优化，导致动态执行时，内存操作生效的真实顺序和 Program order 不同。所以硬件实现“用 Program order 扩展先后关系”，其实是“保持生效顺序和 Program order 一致”，因此所有的 Ordering 会变成类似 Fence 的操作是自然的。

考虑到 Rel 和写入绑定，Acq 和读取绑定<sup>[2]</sup>，因此最终硬件需要做的是这两件事情<sup>[3]</sup>：
- 对于 Rel Fence，保证**之后发生的写**都在之前发生的任意访存之后生效：保证 $R \to W, W \to W$ 顺序
- 对于 Acq Fence，保证**之前发生的读**都在之后发生的任意访存之前生效：保证 $R \to W, R \to R$ 顺序

## 硬件保持顺序的实现

考虑一个典型的乱序处理器架构。硬件中缓存层级的存在，导致每一个访存操作通常是沿着多级执行/缓存结构发放下去的，而唯一知道 Program order 的器件是 LSU，它可以看到 ROB Index。

如下描述中，“下级”指更接近主存，例如 Store buffer 是 LSU 下级，L2 是 L1DC 下级。下级对应系统中更广泛的可见范围，例如 L1DC 只在本核心可见，LLC 在所有 Coherent core 可见。

如下列表基本涵盖了每一级器件的不同选择：
- (1) 如果下级器件唯一，并且可以保证生效顺序保持接受请求的顺序，那么可以由 Fence 同步下级**接收请求**的顺序，Fence 不发往下一级。
  - Note: 如果总线保序，由 Fence 同步发送请求的顺序即可。总线不保序的典型例子：Congestion-aware Routing NoC
- (2) 如果下级器件不唯一，或不能保证生效顺序保持接受请求的顺序，那么有两个选择：
  - (2.i) 如果下级器件都可以保证产生一个回应，能够有效刻画这个请求的在系统全局的生效情况（e.g. 收到回应的时候保证已经生效了），那么可以由 Fence 同步下级**完成请求**的顺序。Fence 不发往下一级。
  - (2.ii) 由下级器件协助执行 Fence。

导致实现会这么复杂，是因为存在一些常见的坑，总体而言有两个：Multi-copy atomicity 和提交保序。

### NUMA / LLC Slices

<details>
<summary>2025-07-20 更新说明</summary>

在更新前，本段文字对于 MCA 的说明不准确。即使在存在写请求<strong>到达</strong>不同 Coherence home 的延迟不同，只要要求写 Ack 保证写全局可见即可，这个系统依旧是保持 MCA 的。特别地，即使 Unified LLC 的系统中，如果 NoC 存在任何动态路由，都可能导致请求换序。
</details>

考虑一个 NUMA 结构，LLC 有多个 Slice，不同的 L2 到不同的 Slice 的延迟不同。这个时候，即使总线保证每个器件按顺序处理请求<sup>[5]</sup>，也无法只通过发送顺序进行同步，因为这个请求真正到达对应 Slice 的时间可能不同。常见的总线协议会通过写回应保证某个写一定生效，但是也存在系统不包含写回应，或者写回应收到时并不能保证所有系统内的 Agent 都可以读到写入的数据<sup>[10]</sup>。用 AMBA 的术语，这一系统中的访存缺乏 Multi-copy atomicity。一个后果是不同的写可能会以不同顺序被不同核心观测到。

考虑如下例子：

```
Initial
[x] = [lock] = 0

Th 0               Th 1
ST [x] <- 1        LD L <- [lock]
Fence Release      Fence Acquire
ST [lock] <- 1     LD R <- [x]
```

如果 `lock` 的 Home line 距离 Th 0 更近，[x] 距离 Th 1 更近，那么如果只保证 L2 发往各个 LLC Slice 的顺序和 Program order 一致，也可能会发生 `R = 0, L = 1` 的结果。加个 `if` 也不行（分支预测 Yes！）。注意到，这里由于缓存是一个层级结构，LLC 有多个 Slice 导致了 L2 本身无法保证请求按顺序生效，因此要不然 L2 本身需要 Fence-aware，要不然上级结构需要根据 L2 的回应进行同步。

关于 Multi-copy atomicity 的实现和影响将也会有[后续文章](mca)讨论。无论如何，在总线缺乏 MCA 的情况下，肯定需要在某一级 Block 请求了，最简单的方法是所有级别都不 Fence aware，直接在 LSU 上一把大锁：Fence 等待先前的所有请求完成之后，再开始之后的请求。

然而检测访存完成也需要小心处理。等待请求完成需要依赖“完成”是准确有效的。Load 的完成是自然的，因为 Load 有一个返回值，当这个值回到 LSU 自然整个访存子系统都完成了。<small>什么？Load value prediction？唉搞微架构的，下次聊</small>

对于写入，常见架构设计上是一个 Fire-and-forget 的设计，提交到 Store buffer 内就是胜利，认为就全局生效了，实际上并没有。如果外面的缓存不支持 MCA，那么需要有特殊的 Barrier 消息，或者等待总线上保证全局可见的 Ack<sup>[6]</sup>。

### Request reorder

那么如果总线和 L1 外面的缓存层级保证 MCA 呢？所幸 RV (Tilelink) 和 ARMv8 (AMBA) 都保证 MCA。然而即使有 MCA，也需要考虑可能把请求交换顺序的地方，保证了原子性也可以把整个两大块儿副作用完全交换顺序，例如 Tilelink。

在总线以内，如果 Store buffer 到 L1 这段结构可以保持生效顺序，由于唯一一个需要保持的 $W \to *$ 序是 $W \to W$ 序，这部分请求会全部经过 Store buffer，那么这段结构至少也许至少不需要做额外处理。麻烦的是，有两个经典的设计会打乱这两个结构中的请求处理顺序：Write buffer coalescing 和 MSHR out-of-order issue。

因此，即使总线具有 MCA，LSU 还是需要分别阻止总线上可能发生的请求交换顺序的情况。
- 如果总线或者 L2 及以下的结构可以交换请求顺序，那么还是得在 L1 MSHR 这里跟踪一下请求的完成情况，这也许就是最好的做法
- 如果总线是保序的，那么 LSU 还是得处理一下 Store buffer 和 L1 的顺序问题。当然，LSU 自己的请求提交顺序也要保证。下面具体讨论一下上述的两个经典设计：

### Write buffer coalescing

因为 $W \to R$ 序不被保证，所以按顺序处理的 (Committed) write buffer 是无须清空的。但是如果 Write buffer 可能合并请求的话，那就可能导致 $W \to W$ 序被打破，此时进行 Release fence 时 Write buffer 需要清空，或者至少等到不存在可能合并的行之后再 enqueue。

在 MICRO 2024 现场看到了一个非常有趣的论文，通过修改 Coherence protocol 解决了这个 $W \to W$ 保序的问题，有兴趣的同学可以阅读。<sup>[4]</sup>

### MSHR scheduling

另一个可能出现的问题是，MSHR Scheduling 也可能不会遵循一开始进入该级缓存的顺序。还是上面那个锁的例子中：

```
Initial
[x] = [lock] = 0

Th 0               Th 1
ST [x] <- 1        LD L <- [lock]
Fence Release      Fence Acquire
ST [lock] <- 1     LD R <- [x]
```

如果只清空了 Write buffer, 那么最极端的情况下可能发生的事情是，Th 0 的 L1DC 中 `x, lock` 都 Miss，进入 MSHR，先发送 `lock` 的 Probe, 完成，Replay 也完成，之后被 Th 1 一侧 Probe 回去，完成写回，在这段时间中 `x` 的 Probe 一直没有发生，因此随后 Th 1 中的 `x` 无论是 Hit 还是从 LLC Refill，都可以有 $R = 0, L = 1$。

因此，在 MSHR 可能被乱序 Sequence 时，LSU & L1DC 通常需要做两件事情：
1. MSHR 在总线给出回应时再释放。由于一般 L1 设计都是 Write-allocate 的，MSHR 需要等待 Refill 结果，所以这里会更类似读取的回应。
2. $W \to *$ Fence 等待 MSHR 清空。

Alternatively, Write buffer 当 Miss 的时候等待 Refill 完成再释放，相当于 Store buffer 做 Replay，那等待 Store buffer 清空就好了。这一设计在 TSO 上更常见一点。

### Termination?

如果需要保序的两个请求有一个请求在某一级缓存终止了，但是这一级缓存不是 LLC，那它的全局可见性如何呢？

对于 Fully-coherent cache，这个问题不大。在某一级缓存终止代表这一级缓存持有足够强的权限，这一请求的全局可见性及其相关的序会由一致性协议保证——虽然这里也有一些坑，一致性协议本身必须有足够强的序。<sup>[7]</sup>

对于不 Coherent 的缓存，例如 GPU，通常需要这个操作一直穿透到有一致性的地方，比如 GPU 的所有 Store 都需要一直写到 L2。

## “读取”序与 Coherence

最后简单讨论一下 Rel-Acq 对之间读取关系的序是怎么建立的。注意到，由于 Acq Ld 读取到了 Rel St 的值，因此 Acq Ld 的生效时间一定不早于 Rel St 的生效时间，在 Rel-Acq 对前后扩展其他内存操作时根据生效即可扩展出其他内存操作之间生效的先后关系。

如果再靠近一些硬件实现，并且放松一些，Acq Rl 的**结束**一定晚于 Rel St **开始**。因此在最暴力的实现中，直接等待前序指令完全结束，再开始执行后续指令是正确的。

---

<div class="footnotes">
[1] 在三个 Context 下具体讨论一下这些都在鬼扯什么：

**首先讨论在 C++ 标准中的定义。** 以下章节号以 [N4917 C++26 Draft](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2022/n4917.pdf) 为准，因为穷学生买不起标准。

C++ 执行的单位是表达式，因此 Program order 这里其实指 "Sequenced before" 关系。"Happens before" 的定义正好就是我们这里的“先后关系”，由 "Sequenced before" 和 "Inter-thread happens before" 取并，后者刻画了跨线程的先后关系。"Inter-thread happens before" 关系生成时用到的 "Synchronized with" 包含了例子中生效的 Rel-Acq 对。这些定义全部来自 6.9.2.2 [intro.races] Paragraph (10).

关于这个先后关系怎么反映到副作用的最终效果和表达式的求值结果上，见同一节 Paragraph (14 - 20)。特别地，对于**同一个**原子对象，Modification order 是一个全序(6.9.22 [intro.races] Paragraph 4)。**同一个**这个条件非常关键，

**其次，讨论一下 RISC-V 中的定义。** RVWMO 是好东西，定义了一个 Global memory order，概念上比较简单：写就是写生效的时刻，读取需要根据 Bypass 决定是否需要根据写向后延迟。这里先后关系直接就是这个 Global memory order 上的序了。因为 Rel-Acq pair 有一个“读取到”的关系，它直接固定了这两个访存在 Global memory order 上的相对位置，随后通过 Preserved Program Order 在两侧扩展 Program Order。

**最后，讨论一下在 NVIDIA PTX 中的定义。** NVIDIA PTX 属于一个不上不下的环境，它到硬件上还需要编译一次。PTX 的内存序定义中，通过 Rel-Acq pair / chain 生成的关系称作 Causality order，Coherence order 指所有对相同地址写入的一个全序。要求 Causality order 是 Coherence order 的子集，并且和 read from / from read (read before) 兼容。这里有点麻烦的地方是由于 PTX 的内存模型允许 Non-coherent caches，所以引入了 Scope 的概念，指令内部编码可见域，然后生成 Causality order 的时候只能用互相可见的 Rel-Acq pair。具体见 NV 的文章<sup>[8]</sup>

[2] Fences 也是这样的。 C++ 标准见 33.5.11 [atomics.fences]，RV 里 `fence.aq` 和 `fence.rl` 分别是 `fence.r.rw` 和 `fence.rw.w` 的别名。这里有一点有趣的地方，就是因为 Rel 和 Acq 一个是挡前面，一个是挡后面，如果真的用 Fence 写的话，需要挂到 AMO 不同的两侧，Rel Fences 挂前面，Acq Fences 挂后面。这个可以参考 NV 的论文中对于 Acquire / Release Pattern 的定义，以及查看 PTX `ld.acquire` / `st.release` 编译出的 SASS 指令，可以对其他一些拧巴底层原因略窥一二。

[3] Remark: 注意到上述的这些 AMO 操作或者 Fence 中没有任何一个会保证 $W \to R$ 顺序，这也是为什么在 x86-TSO 上除了 SeqCst 操作其他所有序都是 No-op，因为 x86-TSO 只会违背 $W \to R$ PO 序。但是 SeqCst 在各种各样地方上的定义都不太一样，具体在属于它的那篇文章再细节讨论把...

[4] J. M. Cebrian, M. Jahre and A. Ros, "Temporarily Unauthorized Stores: Write First, Ask for Permission Later," 2024 57th IEEE/ACM International Symposium on Microarchitecture (MICRO), Austin, TX, USA, 2024, pp. 810-822, doi: [10.1109/MICRO61859.2024.00065.](https://doi.org/10.1109/MICRO61859.2024.00065)

[5] 比如 AXI。In contrast, Tilelink 不保证 (SiFive Tilelink Spec 1.9.3, 6.5 P45)

[6] CHI-A 是一个不保证 Mdan但有特殊 Barrier 的总线。相比下，CHI-B 要求了 MCA 并且 Deprecate 了 Barrier 消息。对于 Ack 所保证的全局可见性，可以参考 SiFive Tilelink Spec 1.9.3, 6.5 P45 要求回应必须有效反应请求的生效情况，并且如果已经给出一个请求回应，后续收到的请求生效一定在前面已给出回应的请求之后。

[7] 这里“足够强”指的是内存一致性协议必须有效保证各种序，尤其是 Coherence order 是成立的，例如 Tilelink 中需要一个 E channel 发送 GrantAck，以避免总线上消息换序导致 Total coherence order 的丢失。如下是一个例子，在没有 GrantAck 时，两个 Master 都想要写权限，所有消息针对的是同一个 Block。

```
Master A            Slave              Master B
                      <--- Acquire --------
    <--- Probe -------
    ---- ProbeAck --->
    ---- Acquire ---->
                      -- Grant ----\/----->
                      -- Probe ----/\
                      <- ProbeAck - | -----
                                    \----->
    <--- Grant -------
```

最后由 Master B 收到的 Grant 要不然完全不 Make sense，要不然就是两个 Master 都认为自己有写权限，但 Slave 觉得 B 没有。

另一个可以考虑的假设情况是 Coherence master 不等待 ProbeAck 就下发 Grant，这个时候破坏的是 MCA。关于这点的简述见<sup>[9]</sup>。

[8] Daniel Lustig, Sameer Sahasrabuddhe, and Olivier Giroux. 2019. A Formal Analysis of the NVIDIA PTX Memory Consistency Model. In Proceedings of the Twenty-Fourth International Conference on Architectural Support for Programming Languages and Operating Systems (ASPLOS '19). Association for Computing Machinery, New York, NY, USA, 257–270. [https://doi.org/10.1145/3297858.3304043](https://doi.org/10.1145/3297858.3304043)


[9] Christopher Pulte, Shaked Flur, Will Deacon, Jon French, Susmit Sarkar, and Peter Sewell. 2017. Simplifying ARM concurrency: multicopy-atomic axiomatic and operational models for ARMv8. Proc. ACM Program. Lang. 2, POPL, Article 19 (January 2018), 29 pages. [https://doi.org/10.1145/3158107](https://doi.org/10.1145/3158107)

[10] 一个例子是 PowerPC 下的共享 Store buffer。这可以导致 SMT 的邻居可以早于其他核心上的线程观测到一个写入。与之对比，x86-TSO 实际上要求 SMT 中的 Store buffer 必须拆分。

</div>
