---
title: SeqCst fences in C++
tags: 微架构,Fences
---

考虑典中典 Store buffering litmus test，在 C++ 中的实现。

```
x.store(1, relaxed)  |  y.store(1, relaxed)
a = y.load(relaxed)  |  b = x.load(relaxed)
```

在 Sequentially consistent 的内存模型 (SC) 下，是肯定不会发生 `a == b == 0` 的，但是现实是一个远比 SC 更丑恶的地方。Store buffer 导致弱内存序中，特别是在 TSO 上也会发生 `a == b == 0` 的情况，而 TSO 中所有 Acquire 和 Release 语义全都是 No-op，所以两个线程两个访存之间分别加上 AcqRel Fence 也无法避免这个行为。

一种恢复 SC 中这段代码的行为的方法是把所有访问的 relaxed 都换成 `seq_cst`，C++ 标准要求所有 SeqCst Atomic 操作都在同一个全序内。另一种方法在两侧两个访存中间分别加上一个 SeqCst Fence，因此一种常见的定义/解释 SeqCst Fence 的方法是：

> 它是 AcqRel Fence，并且额外保证 $W \to R$ 顺序。

但是 Virtually 没有任何一个语言的内存模型是直接这么定义的。这个刻画准确吗？它 Sound & complete 吗？

作为一个工科猪还是以 C++ 为例。这句话的前一半首先是对的，标准里说使用 `std::memory_order_seq_cst` 的 Fence 是一个...

> ...sequentially consistent acquire and release atomic fence<sup>[1]</sup>...

...That's a long name. Anyway，这意味着需要仔细看的只有后半部分。先说结论，在 [MCA](/post/mca) 系统中，$W \to R$ 是一个充分条件，但不必要。在更弱的系统中（e.g. IRIW 允许不同观测顺序），这个“先后”就很难定义了。

在前一篇博文中简要提及了，如果满足 MCA，那么存在一个 Global total order $G$ 对所有线程的所有内存操作排序。这一排序中的一部分可以使用访存观测到，这个可以被观测结果确认的子序就是如下三者的并的闭包：

- `rf` / Read from: [atomic.order] $\P 3.1$
- `mo` / Modification: [atomic.order] $\P 3.2$
- `rb` / Read before 或者部分文献叫作 `fr` / From read: [atomic.order] $\P 3.3$

C++ 标准把这个叫作 _Coherence-ordered before_<sup>[2]</sup>。C++ 对于 SeqCst 操作的要求是所有 SeqCst 操作构成一个全序 $S$，然后 $S + $sequenced-before 和 Coherence-ordered before 兼容 ([atomics.order] $\P$ 4)。但是如果保持 SeqCst Fence 保持 $W \to R$，那么它会在 $G$ 中保证有一个位置正好可以把这个 Fence 插入进去。这个时候注意到 $S$ 和 Coherence-ordered before 都是 $G$ 的一个子序，一定兼容。

<small>(这里缺张图，如果我把 Mermaid 和内嵌 Typst 修好了就加，嘿嘿)</small>

讨论另一个方向，事实上有点难定义。什么叫必要性？删掉这个条件的话，直接恢复成 AcqRel Fence 那么一开始的 SB 就是一个反例，所以好像确实是必要的。但是硬件实现确实可以比 AcqRel + preserves $W \to R$ 要更弱，例如如果整个系统现在只有一个 Inflight SeqCst 操作就是这个 Fence，那么硬件可以不保证任何序，然后一对 $W \to R$ 在 $G$ 中被交换顺序后被另一对访存观测到：

$$
R \to_{rb} W' \to_{hb} R' \to_{rb} W
$$

事实上这是 C++ 标准中明确允许的一件事：[atomics.order] $\P$ 6

> Note 4 : We do not require that S be consistent with “happens before” (6.9.2.2). This allows more efficient implementation of `memory_order::acquire` and `memory_order::release` on some machine architectures. It can produce surprising results when these are mixed with `memory_order::seq_cst` accesses. — end note

在 MCA + perserves $W \to R$ 时，$S$ 和 Happens before 也一致了。我暂时没有找到这里并未指名道姓的架构是啥，是否需要 Non-MCA，如果后续想通了将会更新本文。

在非 MCA 的系统中，“先后”变得模糊了，但是上述 Coherence-ordered before (cob) 是使用内存访问观测到的一个序，因此还是可以定义的，只不过这个序并不需要作为某个全局序的子序，本身也不一定是一个全序。

从硬件实现的角度，如果我们把“先后”的视角放在在核心上，即把这个先后解读为之前所有的访存都已经全局可见，后续访存才开始执行的话，可以把这些 Fence 发生的时间定义为这个同步点的 Wall-clock。对于其他 Sequentially-consisten 的 AMO，如果在其本身已经有一个全序 $S$<sup>[3]</sup> 以后也是以类似的方式控制前后的其他访存，那么可以在 $S$ 的基础上扩展，把 Fence 都加进去：

逐个处理每个 Fence F。可以找到目前 S 中所有和 F 相关的其他 SeqCst 访存或者 Fence K，相关指在 $([F] sb [F] \union ([F] sb ; (rf \cup fr \cup mo) ; sb [F]))^+$ 序的前驱或后继。上述阻塞所有访存的实现方式保证了这是一个和 S 兼容的序，并且这里是固定两端为 Fence 后进行一个传递闭包，这是为了避免首先添加的两个本身不直接通过观测相关的 SeqCst 操作后续由于倒序导致第三个和两者都相关的 SeqCst 访存无法插入。

---

[1] N4917 [atomics.fence]

[2] 注意到，在不考虑 Mix-sized access 时 (effectively all general-purposed hardware, 因为大家的缓存都是按缓存行访问的)，这个子序中的每一个连通分量只包含一个地址。所以基本所有硬件内存续都包含一个公理叫作：

$$
acyclic((rf \cup fr \cup mo)^+ ; po\_loc)
$$

意思是LSU、缓存等部件不能让相同地址的访存莫名其妙换顺序，用 C++ 术语是 Coherence-ordered before 和 Sequenced before 兼容 ([intro.races] $\P$ 14-17)。PTX 的文章中直接把这个叫 SC-per-location。这是 Full SC 的一个弱化：

$$
SC = acyclic((rf \cup fr \cup mo)^+ ; po)
$$

[3] 对于其他带访存的 SeqCst AMO，这个序的存在不是自然的，比如在 IRIW 中，两个写入线程只有一个写，前后没有别的访存需要进行排序。所以需要额外进行跨线程的同步。
