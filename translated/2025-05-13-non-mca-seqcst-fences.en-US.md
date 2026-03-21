---
title: C++ SeqCst 在 Non-MCA 系统上的实现
tags: 微架构,Fences
translated: llm
source: zh-CN
---

[<del>昨天</del> <del>前天</del> 上周的文章](seqcst-fences)最后的命题伪证了：

> 这是一个错误结论：SeqCst ld/st/AMO 存在全序 + 所有 SeqCst 操作等待/阻拦前后所有类型其他访存 $\implies$ C++11 SeqCst Semantics

问题是 SeqCst ld/st/AMO 的全序可能和 Fence 不兼容，所以如何在 Non-MCA 系统上实现 `std::memory_order_seq_cst` 还是一个非常 Nontrivial 的事情，需要把 SeqCst ld/st/AMO 的实现方法也考虑进来。本文在上篇文章提出的设计的基础上细化一下 SeqCst ld/st/AMO 的实现，并且给出一个比较详细的证明，说明这一设计符合 C++11 SeqCst Semantics。这显然不是唯一的设计，也不是所有系统下都最自然的设计，不过可以认为是一个 MCA 系统[不再等待所有 ProbeAck](mca) 之后得到的 Non-MCA 系统一个比较直观的设计。

<details>
<summary>各种序和符号的定义</summary>

- $co$: Coherence order，和 C++ 标准中的 Modification order 基本同义。
- $rf$: Read-from，$W \to_{rf} R$ 表示 R 读到了 W 的值，可以理解为 “W 早于 R”。
- $fr$: From-read，部分文献称为 Read-before ($rb$)，$R \to_{fr} W$ 表示 R 读到了 W 在 $co$ 序之前某个操作写入的值，可以理解为“R 早于 W”
- $sw$: Synchronize-with，在本文中狭义解释为一个 Release 操作写入的值被一个 Acquire 操作读到。标准库中有别的 $sw$ 操作，这里不做讨论。
- $cob$: Coherence-ordered before
- $bwcb, ra, ppsc$ 都是本文中定义的关系，分别指 Base wall-clock before, read-after 和 partial preserved SC

分号 ($;$) 表示关系连接，即：

$$
a ; b := \{ (X, Y) \in dom(a) \times codom(b) \mid exists Z, XaZ \land ZbY \}
$$

中括号 ($[S]$) 表示 S 类型的操作上的 Identity 关系，即：

$$
[S] := \{ (X, X) \mid X \in S \}
$$

中括号可以用于固定一个序的两端，例如 $[F]; sb; [F]$ 表示 $sb$ 关系中两端都是 Fence ($F$) 的子关系。
</details>

## The Hardware

实现很重要的一个属性是希望尽量在核心“局部”可以实现这个排序，不需要通过总线上或者其他信道上和别的核心进行访存之外的通信。很遗憾，SeqCst 的语义并不能完全在局部完成，需要的硬件功能集合包括：

1. 所有 SeqCst 操作会等待同一线程 sequenced-before 的所有操作完成，然后才开始本操作。等待本操作完成之后，才开始 sequenced-after 的其他操作。这里“完成”指的是全局可见之后，在硬件实现上需要核心发出的写操作对应的回应蕴含它已经全局可见了。
  - Acquire / Release 操作也要进行类似的等待。不过 Acquire 只阻止 $R \rightarrow *$，Release 只阻止 $* \rightarrow W$。
  - 此外，Acquire / Release AMO 弱于 Relaxed AMO + Acquire / Release Fence，原因是 Acquire / Release AMO 只控制其绑定的 AMO 操作和其他访存操作的顺序。
<!-- - 额外的，需要 SeqCst st/AMO 操作的全局可见顺序一致。<sup>[2]</sup> -->
2. 额外的，所有 SeqCst 操作结束时必须保证，该操作读取到的值必须全局可见。（对于 Fence，本线程之前所有 Load / AMO 读到的值都全局可见）。<sup>[2]</sup>

可以画一张图，横轴方向 Wall clock，每个线程一条时间轴，Fence 标记为一个点，其他访存标记为核心视角开始执行到收到回应结束执行的时刻。

<figure>
TRANSLATE_MANUAL_FIXME
<figcaption>
图1: 两个线程，只包含 SeqCst 的一个时序图。t ->, 点是 Fence，范围是其他访存操作。
</figcaption>
</figure>

在这个图中，并且如果 $A \rightarrow_{rf \cup fr \cup co} B$，那么在图上，A 的前边沿一定早于 B 的后边沿<sup>[4]</sup>。把某操作 $X$ 的前边沿记作 $start(X)$，后边沿记作 $end(X)$，在时间上 $A$ 时刻早于 $B$ 时刻记作 $A \prec B$。那么：

$$
M \to_{rf \cup fr \cup co} N \implies start(M) \prec end(N)
$$

这一事实将用于排序各个两侧的同步操作。

## Sketch proof

证明的思路大概是首先构造一个关系，可以包含 SeqCst 需要保证的所有序。如果这个关系不包含环，那么做传递闭包后是一个偏序，之后可以全序化。

证明大概分作两步：

第一步是根据 SeqCst 的执行时序，有一个很自然的基础序：如果两个 SeqCst 操作不互相重叠，那么在时间上完全更早发生的操作，应该在所有需要保证的序中都早于另一个操作。把这个序称作 Base wall-clock before $bwcb$，这是一个偏序，并且限制到同一个线程内是一个全序。

<figure>
TRANSLATE_MANUAL_FIXME
<figcaption>
图2: 图 1 中的 SeqCst 操作构成的 bwcb。本图中只画出了部分箭头，传递闭包是完整的序。
</figcaption>
</figure>

第二步就是说明 $bwcb$ 添加 SeqCst 其他要求保证的序之后依旧不会成环。事实上，很大一块要添加的关系已经是 $bwcb$ 的一个子序了。

SeqCst 操作所形成的全序 $S$ 需要兼容的序包括<sup>[3]</sup>：
- Strongly happens-before，这部分可以理解为 SeqCst 操作被其他例如 AcqRel-pair 同步构成的要求。
- $([F]; sb)?; cob; (sb; [F])?$，这部分可以理解为 SC 中“顺序一致”这一要求。

## 吸收 Strongly happens-before

首先处理 SeqCst 操作之间的 Strongly happens-before，其实这已经是 $bwcb$ 的一个子序了，所以不需要额外处理：

$$
([SC]; shb; [SC]) \subset bwcb
$$

<details>
<summary>证明</summary>

Strongly happens-before 是一个关系的传递闭包，所以可能有多个中间操作，每一跳如果是 A Strongly happens-before D，可能性包括：
1. A Sequenced-before D
2. A synchronize-with D，并且 A 和 D 都是 SeqCst 操作。
3. $\exists B,C, s.t.$ A sequenced-before B, B simply happens-before C, C sequenced-before D。Simply happens-before 也是一个传递闭包，共两种情况：
    - B sequenced-before C
    - B synchronize-with C

因为我们最后要进行线性化，所以如果一个传递闭包中的一个关系有一段是第二种情况的话，可以直接切开当成前中后三段单独的关系加到要进行全序化的关系中。把剩下的所有闭包都做好，可以发现最终要考虑的关系是：

$$
sb; (sw^+; sb)^*
$$

要证明：

$$
\forall A, B \in SeqCst, A \to_{sb; (sw^+; sb)^*} B \implies end(A) \prec begin(B)
$$

### 同步操作 $\implies begin(-) \prec end(-)$

首先，如果只有一个 $sb$，根据两侧的操作都是 SeqCst，这是显然的。所以只需要考虑至少有一段 $sw^+$ 的情况，此时同样由于最两端的操作都是 SeqCst，只需证明：

$$
\forall A, B, A \to_{sw^+ ; (sb; sw^+)^*} B \implies begin(A) \prec end(B)
$$

特别地，这里 A 和 B 不需要是 SeqCst 操作。但是因为他们都参与了 $sw$，所以一定是 Acquire and/or Release 操作。我们可以对 Kleene star 的展开个数进行归纳

## $sw^+$

首先讨论只有一段 $sw^+$ 的情况，这是归纳的 Base case，也会在归纳的后续步骤中用到。

我们声称：

$$
A \to_{sw}^+ B \implies begin(A) \prec end(B)
$$

原因是，如果有 $A \to_{sw}^+ B$，那么 A 和 B 是对同一个原子对象的访问，A 是 Release 操作，B 是 Acquire 操作，并且可能有 $k \geq 0$ 个对同一个原子对象的 Acquire-Release AMO 操作：$M_1, ..., M_k$，满足：

$$
A \to_{rf} M_1 \to_{rf} ... \to_{rf} M_k \to_{rf} B
$$

根据原子操作的原子性，一定有：$A \to_{co} M_1 \to_{co} ... \to_{co} M_k$。注意到 B 读取到的是 A 或者 A 在这一原子对象 Coherence 序之后的另一个写入的值，因此 B 完成一定晚于 A 开始的时间。

另一种解释的方法是 B 读取的值依赖 A 写入的值，因此 B 完成时刻一定晚于 A 开始的时刻。<sup>[5]</sup>

## 添加 $sb; sw^+$

下面讨论归纳中的一步。如果有 $B \to_{sb} C \to_{sw}^+ D$，并且如果有 $begin(A) \prec end(B)$，那么注意 $C$ 必须是 Acquire 操作，因此 $B \to_{sb} C \implies end(B) \prec begin(C)$。把他们串起来：

$$
begin(A) \prec end(B) \prec begin(C) \prec end(D)
$$

</details>

## 顺序一致性：$([F]; sb)?; cob; (sb; [F])?$

最后剩下的就是这些关系。抄袭一下 SC11 的论文，我们把它叫作 $ppsc$ (Partial preserved SC)

$$
ppsc := ([F]; sb)?; cob; (sb; [F])?
$$

需要证明把它加入 $bwcb$ 之后不会产生环。假设如果有环存在，事实上我们可以只考虑最多有一条 $bwcb$ 边的环，如果有一个环中有多个 $bwcb$ 边，那么一定存在有一个环最多只有一个 $bwcb$ 边，其他边都是 $([F]; sb)?; cob ;(sb; [F])?$。

<details>
<summary>证明</summary>

归纳，每次通过 $bwcb$ 传递性消掉一条 $bwcb$ 边。如果环中有至少两条 $bwcb$ 边：

$$
A \to_{bwcb} B \to ... \to C \to_{bwcb} D \to ... \to A
$$

那么 $A$ 和 $B$ 不重叠，$C$ 和 $D$ 不重叠。这意味着 $C, D$ 不能同时和 $A, B$ 重叠。因此：
- 如果 $C$ 和 $A$ 不重叠，那么 $A \to_{bwcb} C \to_{bwcb} D \to ... \to A$，或者 $C \to_{bwcb} A \to_{bwcb} B \to ... \to C$，这样环可以消掉一个 $bwcb$。
- 如果 $B$ 和 $C$ 不重叠，那么 $A \to_{bwcb} B \to_{bwcb} C \to_{bwcb} D \to ... \to A$，或者 $C \to_{bwcb} B \to ... \to C$
- 如果 $D$ 和 $A$ 不重叠，那么 $C \to_{bwcb} D \to_{bwcb} A \to_{bwcb} B \to ... \to C$ 或者 $A \to_{bwcb} D \to ... \to A$
- 如果 $D$ 和 $B$ 不重叠，那么 $C \to_{bwcb} D \to_{bwcb} B \to ... \to C$ 或者 $A \to_{bwcb} B \to_{bwcb} D \to ... \to A$
</details>

因此只需考虑两个情况：有一个 $bwcb$ 边，或者没有。

### 有一条 $bwcb$ 边

此时，成环等价于存在一个 $ppsc$ 链，让链尾操作完全发生在链头操作之前。因此要证明不存在环，只需证明不存在这样的 $ppsc$ 链即可，也就是只需证：

$$
\begin{align}
& \forall A, M_1, ..., M_k, B \in SeqCst,\\
& A \to_{ppsc} M_1 \to_{ppsc} ... \to_{ppsc} M_k \to_{ppsc} B \\
\implies & begin(A) \prec end(B)
\end{align}
$$

看上去非常像归纳，但是其实归纳是证不出来的，因为每一段只能构成 $begin(-) \prec end(-)$ 的关系，这不是传递的。必须要考虑其中每个操作具体的类型。

首先一个引理：

> 如果 $A \to_{cob} B$，其中 $B$ 是一个 SeqCst 内存操作，或者 $A \to_{cob} B \to_{sb} F$，其中 $F$ 是一个 SeqCst Fence，那么 $begin(A) \prec end(B)$，或者对于 Fence 时 $begin(A) \prec end(F)$

<details>
<summary>证明</summary>

考虑 $\to_{cob}$ 这一段，由于 $cob$ 被定义为 $(rf \cup fr \cup co)^+$，除了 $cob$ 两端的操作，中间可能有其他对于同一个原子对象的 Load / Store / AMO 操作。我们再定义一个 $rf$ 的扩展：Read after $ra := co?; rf \supseteq rf$，可以理解为写入早于读取发生。我们允许这一链条中内存操作由 $ra \cup fr \cup co$ 相连。

- 首先，如果在这一链条中部（不在两端）存在 AMO 在链条中起的作用不只是其中读取一半或者写入一半产生的，那么存在另一个具有相同端点的链，其中这个 AMO 被去掉。这样我们可以把所有链条中的 AMO 都删去或者只当作普通的读取或写入。

  具体而言，如果有 $A \to_{ra \cup fr \cup co} B \to_{ra \cup fr \cup co} C$，其中 $B$ 是 AMO，和 $A$ 的关联与和 $C$ 的关联并不同时是读取的那一半或者写入的那一半，那么有两种情况：

  - $A \to_{ra} B \to_{ra \cup co} C$
  - $A \to_{fr \cup co} B \to_{fr} C$

  注意到 $fr := rf^{-1}; co$，并且根据原子操作的原子性：

  - $A \to_{ra} B \to_{ra} C \implies A \to_{co} B \to_{ra} C \implies A \to_{ra} C$
  - $A \to_{ra} B \to_{co} C \implies A \to_{co} B \to_{co} C \implies A \to_{co} C$
  - $A \to_{fr} B \to_{fr} C \implies A \to_{fr} B \to_{co} C \implies A \to_{fr} C$
  - $A \to_{co} B \to_{fr} C \implies A \to_{co} B \to_{co} C \implies A \to_{co} C$

- 随后，在链条中部的 Load 也可以被略掉。原因是在链条中部的读取只能构成如下 Pattern：

  $$
  ... A \to_{ra} B \to_{fr} C ...
  $$

  由于 $fr := rf^{-1}; co$，因此 $ra; fr = co; co = co$，所以 $A \to_{co} C$。
- 最后，多个连续的写入可以合并为一个：

  使用 $W$ 表示写，$R$ 表示读：

  - $W_A \to_{co} W_B \to_{co} W_C \implies W_A \to_{co} W_C$
  - $R_A \to_{fr} W_B \to_{co} W_C \implies R_A \to_{fr} W_C$
  - $W_A \to_{co} W_B \to_{rf} R_C \implies W_A \to_{ra} W_C$

于是在考虑 $A \to_{cob} B$ 的时候，事实上只有三种可能性。使用 $W$ 表示写入，$R$ 表示读取：

1. $W_A \to_{co} W_B$
2. $R_A \to_{fr} W_B$
3. $W_A \to_{ra} R_B$
4. $R_A \to_{fr} W_C \to_{ra} R_B$

需要证明的是 $begin(A) \prec end(B)$（或者 Fence 的情况下 $begin(A) \prec end(F)$）。前两种情况比较自然，后两种情况需要略加说明。

**对于第三种情况**，注意到对于同一原子变量的所有写入，所有核心必须以相同的顺序观测。<sup>[6]</sup> 所以如果 $W_A \to_{co} W_C \to_{rf} R_B$，那么 B 完成时，C 已经部分可见，因此 A 也已经部分可见，因此一定晚于 A 开始执行。

**对于第四种情况**，需要用到 B 是一个 SeqCst 读取（或者随后 F 是一个 SeqCst Fence）。在 B (或者 F) 完成时，根据对 SeqCst 读取的额外要求，B 读到的值必须已经全局可见了，那么 C 也必须全局可见了。注意到，$W_A \to_{fr} W_C$，因此 A 开始执行必须早于 C 全局可见的时刻。

</details>

利用这个引理，可以发现，如果我们把 $ppsc$ 链条根据 Fence 划分开来，构成由 Fence 连接的内部无 Fence 段，我们可以根据这个划分出的段数进行归纳，如果把每段两侧的 Fence 状态都完全讨论清楚的话，是可以证明的整条链条的开始操作 A 和末尾操作 B 保证 $begin(A) \prec end(B)$ 的。

<details>
<summary>证明</summary>

首先，注意到在没有 Fence 参与的情况下，$ppsc$ 就是 $cob$ 关系，而 $cob$ 传递。所以下述每段内只会写一个 $cob$。

考虑划分出的段数。如果只有一段，有四种可能性：
- 两端均无 Fence，直接使用引理。
- 开头有 Fence：$F_A \to_{sb} B \to_{cob} C$。使用引理，并且 $begin(F_A) \prec end(F_A) \prec begin(B) \prec end(C)$
- 末尾有 Fence：直接使用引理。
- 开头末尾都有 Fence：上述两种情况的方法合并即可。

接下来进行归纳。在链条末尾新加一段由 Fence 切分开的内部无 Fence 段，那么这一段一定由 Fence 开始：

- 如果目前处理这段结尾不是 Fence：已知 $A \to_{ppsc}^+ F \to_{sb} B \to_{cob} C$，根据归纳假设

  $$
  begin(A) \prec end(F) \prec begin(B) \prec end(C)
  $$

- 如果目前处理这段结尾是 Fence，处理方法完全一样。

</details>

### 无 $bwcb$ 边

此时成环直接由 $ppsc$ 成环。在讨论这样的环的存在性时，可以只考虑只有一个 Fence 的情况，因为如果有多于一个 Fence，由于 Fence 在一个时刻发生，所以两个 Fence 一定能比较先后，把环的其中一半换成 $bwcb$ 即可。

所以只需证明，不存在这样的环：

$$
F \to_{sb} A \to_{cob} B \to_{sb} F
$$

其中 A 和 B 无须是 SeqCst 操作，但 F 一定是 SeqCst Fence。使用前述引理，这一性质是显然的。

---

<div class="footnotes">

- [1] 这里依赖不是指 C++ 的没人用的 consume，而是说为了完成这个读一定需要某个操作带有的值。
- [2] 这一条是没办法完全在局部实现的，在总线上需要灌一个 Barrier 下去。不过目前唯一不支持 MCA 的（还勉强活着的）架构是 POWER，其实现仅会在 SMT 共享 Store buffer 时发生 Non-MCA 的现象，外面的缓存还是 Fully coherent and MCA 的，所以这个 Barrier 直接做成清空核心 Store Buffer 即可，代价和复杂度也不是特别高。 <!-- 不要求和其他更弱的访存操作也保持原子性。也就是说只有 SeqCst 的写入操作的生效顺序需要所有线程同意。很遗憾，这部分看上去还是需要整个缓存系统配合实现，可能需要 LLC 上有一把大锁。 -->
- [3] N4917 [atomics.order] & [intro.race]
- [4] 特别注意，如果把条件扩张成 Coherence-ordered before 之后并不能保证这件事情！核心是因为 Coherence-ordered before 是 $rf \cup fr \cup co$ 的一个传递闭包。C++ 标准做了这个闭包，结果导致了 C++ 目前标准过强，在 x86 上目前的编译是 Unsound 的，将会在下篇文章中具体讨论。[搞清楚这个细节](https://stackoverflow.com/questions/79622116/in-the-independent-read-independent-write-iriw-scenario-is-changing-loads-to)是这篇文章拖了一周的原因...
- [5] 注意，AMO 操作可能实际执行的操作不依赖之前的值（例如 exchange），但是为了保证这样的 AMO 链对于其他内存操作的排序总都有如同 carry dependency 的排序能力，内存模型通常禁止这样的 AMO 提前做 forward。其中一个例子是 RVWMO 不允许 `amoswap` 做 local-bypass。
  
  另一方面，通常所有的内存模型（语言或者硬件）都会要求对同一对象（地址）的操作有一个统一的修改顺序（Write coherence）。如果有些线程（核心）对部分距离较近的修改可见了，那么硬件必须要求这个线程（核心）之后不会忽然看到一个更老的来自其他写入突然可见。（比如如果一个 Store 从一个做 bypass 的 Store buffer 进入了一个不做 bypass 的 Store buffer，就会有这个问题）。 如果某个有 Store 成分的内存访问在其他核心变得可见的时刻一定是在自己的执行时段内（a.k.a. 上篇博客提到的“有效的回应”），那么也可以保证这样的 AMO 链能保证头尾两个访问的相互顺序（因为最后一个读取的完成时刻，一定在最早一个写入在读取发生的缓存结构处生效的时刻之后）。

  Write coherence 规则的存在导致硬件实现不能干这种事情：对于一个还没有 Commit 的写先去请求 Shared Grant，然后假装已经写入了。当这个 Grant 被 Revoke 的时候，把这个还没有发出的写直接丢掉。这种实现下，这个被丢掉的写 Effectively 被别的核心观测到的时候是在它还没开始执行时就发生了。
- [6] 见上方 [5] 中第二段开始的对于 Write coherence 的说明。

</div>
